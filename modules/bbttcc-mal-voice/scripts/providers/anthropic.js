/* bbttcc-mal-voice/scripts/providers/anthropic.js
 * Phase 2A.2 → Foundation v2 — Anthropic (Claude) provider adapter.
 *
 * Browser-side fetch to https://api.anthropic.com/v1/messages with BYO key.
 * Uses the `anthropic-dangerous-direct-browser-access: true` opt-in header
 * (the BYO-key model). Since 2026-10-02 the key is a CLIENT setting on the
 * GM's machine only: GM seats fetch directly; player seats relay through the
 * GM (see GM RELAY below) and never hold the key.
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
 *     apiKey?:      string,              // override settings (GM seat only)
 *     relay?:       { kind, ... }        // player seat: relayed to the GM as this kind
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

  // Owner ruling 2026-10-02: the key lives ONLY on the GM's machine (client
  // setting). A player seat never calls the provider — it relays a request of
  // a registered kind to the active GM, which validates and calls (see the
  // GM RELAY section below). No relay descriptor = no call.
  if (!globalThis.game?.user?.isGM) {
    if (opts.relay && typeof opts.relay === "object") return await relay(opts);
    return _err("GM_ONLY", "AI calls from a player seat must go through the GM relay (no `relay` descriptor given).");
  }

  const apiKey = opts.apiKey || settings.apiKey();
  if (!apiKey) {
    return _err("NO_API_KEY", "No Anthropic API key on this GM machine. Set one in Module Settings → AI Faction/GM Advisor → API key (stored in this browser only).");
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

// ============================================================
// GM RELAY (owner ruling 2026-10-02 — the key never reaches a player browser)
//
// Player seat:  call({ ..., relay: { kind, ...kindPayload }, stream, onDelta })
//   → gmExec "malVoice.provider.call" { kind, reqId, stream, ...kindPayload }
//   → the PRIMARY GM validates (sender, kind builder, per-user rate limit),
//     REBUILDS the request from GM-side data (system prompt, model, maxTokens
//     — the player never supplies those), calls Anthropic with its own key,
//     and acks the normal result shape.
//   Streaming: the GM throttles text-so-far onto the bbttcc-core socket
//   channel ({op:"malVoice.delta", reqId, toUserId, seq, text}; gm-exec's own
//   listener ignores ops it doesn't know) and the requesting seat feeds its
//   onDelta. The ack carries the final text, so a lost delta never matters.
//
// Kinds are registered per call-site with registerRelayKind(kind, builder):
//   builder(payload, { user, meta }) -> { ok:true, request:{system, messages|
//   userMessage, tools?, toolChoice?, schema?, maxTokens, temperature?, model?},
//   logId, maxTokensCap? (≤1024; default RELAY_LIMITS.maxTokens) }
//   | { ok:false, error, message }.   Unknown kinds are refused.
//   Kinds: "npc" (npc-dialogue), "voice" (trigger-engine — every registered
//   voice incl. the onboarding Operator), "echoRoster" (fourththing Echo Gen).
// ============================================================
const RELAY_TYPE       = "malVoice.provider.call";
const DELTA_CHANNEL    = "module.bbttcc-core";   // bbttcc-core declares socket:true
const DELTA_OP         = "malVoice.delta";
const DELTA_THROTTLE   = 150;
const RELAY_TIMEOUT_MS = 150000;                  // two streamed calls + one retry, worst case
const RELAY_LIMITS     = { perMinute: 12, perHour: 240, inFlight: 2, maxTokens: 400 };

const RELAY_KINDS     = new Map();   // kind -> builder
const DELTA_LISTENERS = new Map();   // reqId -> { onDelta, seq }  (requesting seat)
const RATE            = new Map();   // userId -> { stamps: number[], inFlight }
let _relaySeq = 0;

function registerRelayKind(kind, builder) {
  if (typeof kind !== "string" || !kind || typeof builder !== "function") return false;
  RELAY_KINDS.set(kind, builder);
  return true;
}

function _gmExec() { return globalThis.game?.bbttcc?.api?.gmExec || null; }

// Is there a GM seat that could answer a relayed call right now?
function gmOnline() {
  try {
    const g = _gmExec();
    if (typeof g?.primaryGmId === "function") return !!g.primaryGmId();
    return !!game.users?.activeGM;
  } catch (_e) { return false; }
}

// ----- Requesting (player) seat -----
async function relay(opts) {
  const g = _gmExec();
  if (typeof g?.call !== "function") return _err("RELAY_UNAVAILABLE", "bbttcc-core's GM relay (gmExec) is not loaded.");
  if (!gmOnline()) return _err("NO_GM", "No GM is connected — AI voices speak through the GM's seat.");
  const reqId = `${game.user.id}.${Date.now().toString(36)}.${++_relaySeq}`;
  const streaming = !!opts.stream && typeof opts.onDelta === "function";
  if (streaming) DELTA_LISTENERS.set(reqId, { onDelta: opts.onDelta, seq: 0 });
  try {
    const res = await g.call(RELAY_TYPE, { ...opts.relay, reqId, stream: streaming }, { timeoutMs: RELAY_TIMEOUT_MS });
    return (res && typeof res === "object") ? res : _err("BAD_RELAY_RESPONSE", "The GM relay returned nothing.");
  } catch (e) {
    const msg = String(e?.message || e);
    return _err(/timed out/i.test(msg) ? "RELAY_TIMEOUT" : "RELAY_FAILED", msg);
  } finally {
    DELTA_LISTENERS.delete(reqId);   // late deltas after the ack are ignored
  }
}

function _onDeltaMessage(msg) {
  try {
    if (msg?.op !== DELTA_OP || msg.toUserId !== game.user?.id) return;
    const l = DELTA_LISTENERS.get(msg.reqId);
    if (!l) return;
    const seq = Number(msg.seq) || 0;
    if (seq <= l.seq) return;
    l.seq = seq;
    l.onDelta(String(msg.text ?? ""), "");
  } catch (_e) { /* display-only */ }
}

// ----- GM side -----
function _rateCheck(userId) {
  const now = Date.now();
  const st = RATE.get(userId) || { stamps: [], inFlight: 0 };
  st.stamps = st.stamps.filter(t => now - t < 3600000);
  RATE.set(userId, st);
  if (st.inFlight >= RELAY_LIMITS.inFlight) return _err("RATE_LIMITED", "Too many AI calls in flight from this seat.");
  if (st.stamps.filter(t => now - t < 60000).length >= RELAY_LIMITS.perMinute) return _err("RATE_LIMITED", `More than ${RELAY_LIMITS.perMinute} AI calls in a minute from this seat.`);
  if (st.stamps.length >= RELAY_LIMITS.perHour) return _err("RATE_LIMITED", `More than ${RELAY_LIMITS.perHour} AI calls in an hour from this seat.`);
  st.stamps.push(now);
  return null;
}

async function _relayHandler(payload, meta) {
  const user = game.users?.get?.(meta?.fromUserId) || null;
  if (!user || meta?.local || user.isGM) return _err("RELAY_REFUSED", "The AI relay serves player seats only (GM seats call directly).");
  const kind = String(payload?.kind || "");
  const builder = RELAY_KINDS.get(kind);
  if (!builder) return _err("RELAY_REFUSED", `Unknown AI relay kind '${kind}'.`);
  if (!globalThis.game?.bbttcc?.mal?.settings?.apiKey?.()) {
    return _err("NO_API_KEY", "The GM's machine has no AI key set (Module Settings → AI Faction/GM Advisor → API key).");
  }
  const limited = _rateCheck(user.id);
  if (limited) { warn(`relay refused for ${user.name}: ${limited.message}`); return limited; }

  let built;
  try { built = await builder(payload, { user, meta }); }
  catch (e) { return _err("RELAY_REFUSED", `Request rejected: ${e?.message || e}`); }
  if (!built?.ok || !built.request) {
    warn(`relay '${kind}' refused for ${user.name}: ${built?.message || "invalid request"}`);
    return _err(built?.error || "RELAY_REFUSED", built?.message || "Request rejected by the GM relay.");
  }
  const req = built.request;
  // A builder may raise its own token ceiling (GM-side code, e.g. Echo Gen's 8-member batch) — never past 1024.
  const maxCap = Math.max(RELAY_LIMITS.maxTokens, Math.min(1024, Number(built.maxTokensCap) || 0));

  const st = RATE.get(user.id);
  st.inFlight++;
  let timer = null, pending = null, last = 0, seq = 0, closed = false;
  const emit = (text) => {
    try { game.socket.emit(DELTA_CHANNEL, { op: DELTA_OP, reqId: String(payload.reqId || ""), toUserId: user.id, seq: ++seq, text }); } catch (_e) {}
  };
  const onDelta = payload.stream ? (text) => {
    if (closed) return;
    pending = text;
    const now = Date.now();
    if (now - last >= DELTA_THROTTLE) { last = now; emit(text); }
    else if (!timer) timer = setTimeout(() => { timer = null; last = Date.now(); if (!closed && pending != null) emit(pending); }, DELTA_THROTTLE);
  } : undefined;

  const t0 = Date.now();
  let res;
  try {
    res = await call({
      system:      req.system,
      messages:    req.messages,
      userMessage: req.userMessage,
      tools:       req.tools,
      toolChoice:  req.toolChoice,
      model:       req.model || undefined,
      maxTokens:   Math.min(maxCap, Math.max(16, Number(req.maxTokens) || 256)),
      temperature: req.temperature,
      schema:      (req.schema && typeof req.schema === "object") ? req.schema : undefined,
      stream:      !!payload.stream,
      onDelta
    });
  } finally {
    closed = true;
    if (timer) { clearTimeout(timer); timer = null; }
    st.inFlight = Math.max(0, st.inFlight - 1);
  }

  // Relayed calls bill the GM's key — log them where the budget check reads.
  try {
    if (res?.ok) {
      const entries = (game.settings.get(MODULE_ID, "callLog") || []).slice(-199);
      entries.push({
        ts: Date.now(), voiceId: built.logId || kind, hook: `relay:${kind}`, viaUserId: user.id,
        model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens,
        cacheReadTokens: res.cacheReadTokens ?? 0, cacheWriteTokens: res.cacheWriteTokens ?? 0,
        costUSD: res.costEstimateUSD, durationMs: Date.now() - t0
      });
      await game.settings.set(MODULE_ID, "callLog", entries);
    }
  } catch (_e) { /* non-fatal */ }
  return res;
}

// ----- Shared validators for kind builders -----
function _capStr(v, max) {
  const s = String(v ?? "");
  return s.length <= max ? s : null;
}

// Tool DEFINITIONS a player seat may send: allowlisted names, bounded size,
// rebuilt to the three API fields (nothing else rides along).
function _sanitizeTools(tools, allowNames, { maxTools = 6, maxDefChars = 8000 } = {}) {
  if (tools == null) return undefined;
  if (!Array.isArray(tools) || tools.length > maxTools) return null;
  const out = [];
  for (const t of tools) {
    if (!t || !allowNames.has(t.name)) return null;
    const description = _capStr(t.description, 3000);
    if (description == null) return null;
    const schema = (t.input_schema && typeof t.input_schema === "object") ? t.input_schema : null;
    if (!schema) return null;
    let size = 0;
    try { size = JSON.stringify(schema).length; } catch (_e) { return null; }
    if (size + description.length > maxDefChars) return null;
    out.push({ name: t.name, description, input_schema: schema });
  }
  return out.length ? out : undefined;
}

// Conversation turns a player seat may send: user/assistant strings, plus the
// one tool round (assistant text/tool_use with allowlisted names; user
// tool_result). Bounded per turn and in total. Returns null when malformed.
function _sanitizeMessages(list, { toolNames = new Set(), maxTurns = 48, maxTurnChars = 6000, maxTotalChars = 90000 } = {}) {
  if (!Array.isArray(list) || !list.length || list.length > maxTurns) return null;
  let total = 0;
  const out = [];
  for (const m of list) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content === "string") {
      if (m.content.length > maxTurnChars) return null;
      total += m.content.length;
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (!Array.isArray(m.content) || !m.content.length || m.content.length > 8) return null;
    const blocks = [];
    for (const b of m.content) {
      if (b?.type === "text" && m.role === "assistant") {
        const t = _capStr(b.text, maxTurnChars); if (t == null) return null;
        total += t.length; blocks.push({ type: "text", text: t });
      } else if (b?.type === "tool_use" && m.role === "assistant") {
        if (!toolNames.has(b.name)) return null;
        let inp = "{}"; try { inp = JSON.stringify(b.input ?? {}); } catch (_e) { return null; }
        if (inp.length > 2000) return null;
        total += inp.length;
        blocks.push({ type: "tool_use", id: String(b.id || "").slice(0, 128), name: b.name, input: b.input ?? {} });
      } else if (b?.type === "tool_result" && m.role === "user") {
        const c = _capStr(b.content, 2000); if (c == null) return null;
        total += c.length;
        const blk = { type: "tool_result", tool_use_id: String(b.tool_use_id || "").slice(0, 128), content: c };
        if (b.is_error) blk.is_error = true;
        blocks.push(blk);
      } else return null;
    }
    out.push({ role: m.role, content: blocks });
  }
  return total <= maxTotalChars ? out : null;
}

// ----- Install at game.bbttcc.mal.providers.anthropic -----
let _relayArmed = false;
function _install() {
  try {
    globalThis.game.bbttcc      ??= { api: {} };
    globalThis.game.bbttcc.mal  ??= {};
    globalThis.game.bbttcc.mal.providers ??= {};

    globalThis.game.bbttcc.mal.providers.anthropic = {
      call,
      relay,
      gmOnline,
      registerRelayKind,
      relayKinds: () => [...RELAY_KINDS.keys()],
      relayUtil: { capStr: _capStr, sanitizeTools: _sanitizeTools, sanitizeMessages: _sanitizeMessages },
      RELAY_LIMITS,
      DEFAULT_MODEL,
      COST_TABLE,
      estimateCost: _estimateCost
    };

    if (!_relayArmed) {
      _relayArmed = true;
      const g = _gmExec();
      if (typeof g?.register === "function") g.register(RELAY_TYPE, _relayHandler);
      else warn("bbttcc-core gmExec missing — player-seat AI calls cannot be relayed.");
      try { game.socket?.on?.(DELTA_CHANNEL, _onDeltaMessage); } catch (e) { warn("delta listener failed:", e?.message || e); }
    }
    log(`Adapter installed at game.bbttcc.mal.providers.anthropic (v2: caching + structured output + streaming; player seats relay via the GM).`);
  } catch (e) {
    warn("Failed to install adapter:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
