/* bbttcc-mal-voice/scripts/providers/anthropic.js
 * Phase 2A.2 → Foundation v2 — Anthropic (Claude) provider adapter.
 *
 * Browser-side fetch to https://api.anthropic.com/v1/messages with BYO key.
 * Uses the `anthropic-dangerous-direct-browser-access: true` opt-in header
 * (the BYO-key model: key sits in world settings, only ever transmitted
 * directly to Anthropic).
 *
 * v2 additions:
 *   - Prompt caching: `system` may be an array of blocks with per-block
 *     cache flags -> Anthropic `cache_control` (ephemeral, optional 1h TTL).
 *   - Structured outputs: pass `schema` (JSON Schema, object root) and the
 *     response is constrained via output_config.format json_schema; the
 *     parsed object comes back as `json`.
 *   - Streaming: pass `stream: true` + `onDelta(fullTextSoFar, delta)` and
 *     the reply streams via SSE; resolves with the same result shape.
 *   - Model-family sanitization: Sonnet 5 / Opus 4.7+ / Fable 5 reject
 *     `temperature` (400) — the adapter silently drops it there. Sonnet 5
 *     runs adaptive thinking when `thinking` is omitted, which adds latency
 *     and tokens to short barks — the adapter sends {type:"disabled"}
 *     unless the caller passes an explicit `thinking` config.
 *
 * API:
 *   game.bbttcc.mal.providers.anthropic.call({
 *     systemPrompt?: string,             // legacy single-string system
 *     system?: string | Array<{ text, cache?: boolean|"5m"|"1h" }>,
 *     userMessage?: string,              // single-turn shorthand
 *     messages?: Array<{ role: "user"|"assistant", content: string|Array }>,  // multi-turn (wins over userMessage; content blocks pass through)
 *     tools?:      Array<object>,        // Anthropic tool definitions
 *     toolChoice?: object,               // e.g. {type:"none"} to suppress further calls
 *     model?:       string,              // default from settings
 *     maxTokens?:   number,              // default 256
 *     temperature?: number,              // dropped on models that reject it
 *     schema?:      object,              // JSON Schema -> structured output
 *     stream?:      boolean,             // SSE streaming
 *     onDelta?:     (text, delta) => void,
 *     thinking?:    object,              // explicit thinking config override
 *     apiKey?:      string               // override settings
 *   })
 *   -> Promise<{
 *        ok:       boolean,
 *        text?:    string,               // the model's reply
 *        json?:    object|null,          // parsed reply when schema was given
 *        inputTokens?:      number,      // uncached input tokens
 *        outputTokens?:     number,
 *        cacheReadTokens?:  number,      // served from prompt cache (~0.1x)
 *        cacheWriteTokens?: number,      // written to prompt cache (~1.25x)
 *        costEstimateUSD?: number,
 *        model?:   string,
 *        stopReason?: string,
 *        error?:   string,               // error code if !ok
 *        message?: string,               // human-readable error
 *        retried?: boolean
 *      }>
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8.3 BYO-key
 */

const MODULE_ID = "bbttcc-mal-voice";
const TAG = "[mal-voice:anthropic]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION  = "2023-06-01";

// Cost estimates (USD per million tokens, input / output). Current published
// rates as of 2026-07. Cache reads bill ~0.1x input, cache writes ~1.25x.
// (claude-sonnet-5 has intro pricing of $2/$10 through 2026-08-31; we use
// the sticker rate so estimates err high.)
const COST_TABLE = {
  "claude-fable-5":       { in:  10.00, out: 50.00 },
  "claude-opus-4-8":      { in:   5.00, out: 25.00 },
  "claude-opus-4-7":      { in:   5.00, out: 25.00 },
  "claude-opus-4-6":      { in:   5.00, out: 25.00 },
  "claude-sonnet-5":      { in:   3.00, out: 15.00 },
  "claude-sonnet-4-6":    { in:   3.00, out: 15.00 },
  "claude-sonnet-4-5":    { in:   3.00, out: 15.00 },
  "claude-haiku-4-5":     { in:   1.00, out:  5.00 },
  // Older fallbacks
  "claude-3-5-sonnet":    { in:   3.00, out: 15.00 },
  "claude-3-5-haiku":     { in:   0.80, out:  4.00 }
};

// Current-generation Sonnet: near-Opus quality at Sonnet cost. Use Opus 4.8
// only when the user explicitly opts in via Module Settings → Model; Haiku
// 4.5 is the cheap tier for high-frequency barks.
const DEFAULT_MODEL = "claude-sonnet-5";

function _rateFor(model) {
  const m = String(model || "");
  if (COST_TABLE[m]) return COST_TABLE[m];
  // Prefix match handles dated snapshots (e.g. claude-haiku-4-5-20251001).
  const key = Object.keys(COST_TABLE).find(k => m.startsWith(k));
  return key ? COST_TABLE[key] : null;
}

function _estimateCost(model, inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) {
  const rate = _rateFor(model);
  if (!rate) return null;
  return ((inputTokens      / 1_000_000) * rate.in)
       + ((outputTokens     / 1_000_000) * rate.out)
       + ((cacheReadTokens  / 1_000_000) * rate.in * 0.10)
       + ((cacheWriteTokens / 1_000_000) * rate.in * 1.25);
}

// Per-family request-shape rules (sending the wrong params is a hard 400).
function _modelCaps(model) {
  const m = String(model || "");
  const isFable      = /fable-5|mythos-5/.test(m);
  const isOpus47Plus = /opus-4-[789]/.test(m);
  const isSonnet5    = /sonnet-5/.test(m);
  return {
    // temperature/top_p/top_k rejected with 400 on these families
    noSampling: isFable || isOpus47Plus || isSonnet5,
    // Sonnet 5 defaults to adaptive thinking when `thinking` is omitted —
    // wrong default for short low-latency barks, so we disable explicitly.
    disableThinking: isSonnet5,
    // Fable 5 rejects an explicit {type:"disabled"} — must omit entirely.
    neverSendThinking: isFable
  };
}

// Build the `system` request field from either the legacy string or an
// array of { text, cache } blocks. cache: true|"5m" -> ephemeral 5m,
// "1h" -> ephemeral with 1h TTL. Max 4 cache breakpoints per request —
// callers pass at most 2 (lore primer + persona).
function _buildSystem(opts) {
  const src = opts.system ?? opts.systemPrompt ?? "";
  if (!src) return undefined;
  if (typeof src === "string") return src;
  if (!Array.isArray(src)) return String(src);
  const blocks = [];
  for (const b of src) {
    if (!b) continue;
    const text = (typeof b === "string") ? b : String(b.text ?? "");
    if (!text) continue;
    const block = { type: "text", text };
    const cache = (typeof b === "object") ? b.cache : false;
    if (cache) {
      block.cache_control = { type: "ephemeral" };
      if (cache === "1h") block.cache_control.ttl = "1h";
    }
    blocks.push(block);
  }
  return blocks.length ? blocks : undefined;
}

function _err(error, message, extra = {}) {
  return { ok: false, error, message, ...extra };
}

function _usageFromData(u) {
  return {
    inputTokens:      Number(u?.input_tokens  ?? 0),
    outputTokens:     Number(u?.output_tokens ?? 0),
    cacheReadTokens:  Number(u?.cache_read_input_tokens     ?? 0),
    cacheWriteTokens: Number(u?.cache_creation_input_tokens ?? 0)
  };
}

// Consume an SSE response body, invoking onDelta with the accumulated text.
// Also reconstructs tool_use blocks (content_block_start type tool_use +
// input_json_delta accumulation) so callers can run the tool loop.
// Returns { text, content, toolUses, usage, stopReason, model } or throws.
async function _consumeStream(resp, onDelta) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let stopReason = null;
  let respModel = null;
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const blocks = new Map();   // stream index -> partial block record

  const handleEvent = (evt) => {
    switch (evt?.type) {
      case "message_start": {
        respModel = evt.message?.model || respModel;
        Object.assign(usage, _usageFromData(evt.message?.usage));
        break;
      }
      case "content_block_start": {
        const cb = evt.content_block;
        if (cb?.type === "tool_use") {
          blocks.set(evt.index, { type: "tool_use", id: cb.id, name: cb.name, _json: "" });
        } else if (cb?.type === "text") {
          blocks.set(evt.index, { type: "text", text: "" });
        }
        break;
      }
      case "content_block_delta": {
        const rec = blocks.get(evt.index);
        if (evt.delta?.type === "text_delta") {
          text += evt.delta.text;
          if (rec?.type === "text") rec.text += evt.delta.text;
          if (onDelta) { try { onDelta(text, evt.delta.text); } catch (_e) {} }
        } else if (evt.delta?.type === "input_json_delta" && rec?.type === "tool_use") {
          rec._json += evt.delta.partial_json || "";
        }
        break;
      }
      case "content_block_stop": {
        const rec = blocks.get(evt.index);
        if (rec?.type === "tool_use") {
          try { rec.input = rec._json ? JSON.parse(rec._json) : {}; } catch (_e) { rec.input = {}; }
          delete rec._json;
        }
        break;
      }
      case "message_delta": {
        stopReason = evt.delta?.stop_reason ?? stopReason;
        if (Number.isFinite(evt.usage?.output_tokens)) usage.outputTokens = evt.usage.output_tokens;
        break;
      }
      case "error": {
        const e = new Error(evt.error?.message || "stream error");
        e.code = evt.error?.type || "STREAM_ERROR";
        throw e;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      let evt;
      try { evt = JSON.parse(payload); } catch (_e) { continue; }
      handleEvent(evt);
    }
  }

  // Rebuild the assistant content array in stream order (echo it back verbatim
  // in tool_result continuations).
  const content = [...blocks.entries()].sort((a, b) => a[0] - b[0]).map(([, rec]) => {
    if (rec.type === "tool_use") return { type: "tool_use", id: rec.id, name: rec.name, input: rec.input ?? {} };
    return { type: "text", text: rec.text };
  }).filter(b => b.type === "tool_use" || (b.text && b.text.length));

  return { text: text.trim(), content, usage, stopReason, model: respModel };
}

async function call(opts = {}) {
  const settings = globalThis.game?.bbttcc?.mal?.settings;
  if (!settings) return _err("MODULE_NOT_READY", "game.bbttcc.mal not installed");

  const apiKey = opts.apiKey || settings.apiKey();
  if (!apiKey) {
    return _err("NO_API_KEY", "No Anthropic API key configured. Set one in Module Settings → Bad Eden Mal Voice → API key.");
  }

  const model       = opts.model || settings.model() || DEFAULT_MODEL;
  const maxTokens   = Number(opts.maxTokens   ?? 256);
  const temperature = Number(opts.temperature ?? 0.85);
  const userMessage = opts.userMessage || "";
  const streaming   = !!opts.stream;

  // Multi-turn conversations pass `messages` directly; `userMessage` is the
  // single-turn shorthand. The API is stateless — send full history each call.
  let messages;
  if (Array.isArray(opts.messages) && opts.messages.length) {
    messages = opts.messages
      .filter(m => m && (m.role === "user" || m.role === "assistant") && m.content)
      // Strings pass as strings; content-block arrays (tool_use / tool_result
      // round-trips) pass through untouched.
      .map(m => ({ role: m.role, content: (typeof m.content === "string") ? m.content : m.content }));
    if (!messages.length) return _err("EMPTY_MESSAGE", "messages[] contained no valid turns");
    if (messages[0].role !== "user") messages.unshift({ role: "user", content: "(the conversation begins)" });
  } else {
    if (!userMessage) return _err("EMPTY_MESSAGE", "userMessage or messages[] is required");
    messages = [{ role: "user", content: userMessage }];
  }

  const caps = _modelCaps(model);
  const body = {
    model,
    max_tokens: maxTokens,
    messages
  };
  if (!caps.noSampling && Number.isFinite(temperature)) body.temperature = temperature;
  if (opts.thinking && !caps.neverSendThinking) body.thinking = opts.thinking;
  else if (caps.disableThinking && !opts.thinking) body.thinking = { type: "disabled" };

  const system = _buildSystem(opts);
  if (system) body.system = system;

  if (opts.schema && typeof opts.schema === "object") {
    body.output_config = { format: { type: "json_schema", schema: opts.schema } };
  }
  if (Array.isArray(opts.tools) && opts.tools.length) {
    body.tools = opts.tools;
    if (opts.toolChoice && typeof opts.toolChoice === "object") body.tool_choice = opts.toolChoice;
  }
  if (streaming) body.stream = true;

  const debug = settings.debug();
  if (debug) {
    const sysLen = (typeof system === "string") ? system.length
                 : Array.isArray(system) ? system.reduce((s, b) => s + (b.text?.length || 0), 0) : 0;
    log(`call() model=${model} maxTokens=${maxTokens} stream=${streaming} schema=${!!opts.schema} systemLen=${sysLen} userLen=${userMessage.length}`);
  }

  // Retry once on 429 (rate limit) or 5xx transient. Once an SSE stream has
  // begun delivering deltas we do NOT retry (partial text already rendered).
  let attempt = 0;
  let retried = false;
  while (attempt < 2) {
    attempt++;
    let resp;
    try {
      resp = await fetch(ANTHROPIC_ENDPOINT, {
        method:  "POST",
        headers: {
          "Content-Type":                              "application/json",
          "x-api-key":                                 apiKey,
          "anthropic-version":                         ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      // Network-level error (CORS, DNS, offline).
      warn("fetch threw:", e?.message || e);
      return _err("NETWORK_ERROR", e?.message || String(e), { retried });
    }

    if (!resp.ok) {
      let data = null;
      try { data = await resp.json(); } catch (_e) {}
      const errType = data?.error?.type || `HTTP_${resp.status}`;
      const errMsg  = data?.error?.message || `HTTP ${resp.status}`;
      if (attempt === 1 && (resp.status === 429 || resp.status >= 500)) {
        retried = true;
        await new Promise(r => setTimeout(r, 1200));
        continue;
      }
      return _err(errType, errMsg, { retried, status: resp.status });
    }

    // ----- Streaming path -----
    if (streaming) {
      let streamed;
      try {
        streamed = await _consumeStream(resp, opts.onDelta);
      } catch (e) {
        return _err(e.code || "STREAM_ERROR", e?.message || String(e), { retried });
      }
      // stop=refusal with ZERO delivered text: the safety layer declined the
      // completion outright (observed 2026-08-21 mid-negotiation — the NPC
      // rendered as "…"). Nothing streamed, so one retry is safe; refusing
      // twice returns a typed error so callers can fall back to scripted text
      // instead of silence.
      if (streamed.stopReason === "refusal" && !streamed.text) {
        if (attempt === 1) {
          retried = true;
          warn("stop=refusal with empty text — retrying once");
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        return _err("REFUSAL", "Model declined this completion twice (stop=refusal, empty text).", { retried });
      }
      return _finish(streamed.text, streamed.model || model, streamed.usage, streamed.stopReason, retried, opts, debug, streamed.content);
    }

    // ----- Buffered path -----
    let data;
    try {
      data = await resp.json();
    } catch (e) {
      return _err("BAD_RESPONSE", `Could not parse response JSON (status ${resp.status})`, { retried });
    }

    const content = Array.isArray(data?.content) ? data.content : [];
    const text = content.filter(b => b?.type === "text").map(b => b.text || "").join("").trim();
    // Same refusal handling as the streaming path (see above).
    if (data?.stop_reason === "refusal" && !text) {
      if (attempt === 1) {
        retried = true;
        warn("stop=refusal with empty text — retrying once");
        await new Promise(r => setTimeout(r, 400));
        continue;
      }
      return _err("REFUSAL", "Model declined this completion twice (stop=refusal, empty text).", { retried });
    }
    return _finish(text, data?.model || model, _usageFromData(data?.usage), data?.stop_reason || null, retried, opts, debug, content);
  }

  // Should never reach here, but defensively:
  return _err("UNKNOWN", "Retry loop exhausted without resolution");
}

function _finish(text, model, usage, stopReason, retried, opts, debug, content = null) {
  const costEstimateUSD = _estimateCost(model, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens);

  // Tool calls the model requested this turn (empty array when none). The
  // caller executes them and continues the conversation by echoing `content`
  // back as the assistant turn plus a user turn of tool_result blocks.
  const toolUses = Array.isArray(content)
    ? content.filter(b => b?.type === "tool_use").map(b => ({ id: b.id, name: b.name, input: b.input ?? {} }))
    : [];

  // Structured output: the constrained reply is guaranteed-valid JSON text.
  let json = null;
  if (opts.schema) {
    try { json = JSON.parse(text); } catch (_e) { json = null; }
  }

  if (debug) {
    log(`call() ok model=${model} in=${usage.inputTokens} out=${usage.outputTokens} cacheRead=${usage.cacheReadTokens} cacheWrite=${usage.cacheWriteTokens} cost=$${costEstimateUSD?.toFixed(4) ?? "?"} stop=${stopReason}`);
  }

  return {
    ok:               true,
    text,
    json,
    content:          content ?? (text ? [{ type: "text", text }] : []),
    toolUses,
    model,
    inputTokens:      usage.inputTokens,
    outputTokens:     usage.outputTokens,
    cacheReadTokens:  usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    costEstimateUSD,
    stopReason,
    retried
  };
}

// ----- Install at game.bbttcc.mal.providers.anthropic -----
function _install() {
  try {
    globalThis.game.bbttcc      ??= { api: {} };
    globalThis.game.bbttcc.mal  ??= {};
    globalThis.game.bbttcc.mal.providers ??= {};

    globalThis.game.bbttcc.mal.providers.anthropic = {
      call,
      DEFAULT_MODEL,
      COST_TABLE,
      estimateCost: _estimateCost
    };
    log(`Adapter installed at game.bbttcc.mal.providers.anthropic (v2: caching + structured output + streaming).`);
  } catch (e) {
    warn("Failed to install adapter:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
