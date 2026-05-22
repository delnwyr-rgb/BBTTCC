/* bbttcc-mal-voice/scripts/providers/anthropic.js
 * Phase 2A.2 — Anthropic (Claude) provider adapter.
 *
 * Browser-side fetch to https://api.anthropic.com/v1/messages with BYO key.
 * Uses the `anthropic-dangerous-direct-browser-access: true` opt-in header
 * (the BYO-key model: key sits in world settings, only ever transmitted
 * directly to Anthropic).
 *
 * API:
 *   game.bbttcc.mal.providers.anthropic.call({
 *     systemPrompt: string,
 *     userMessage:  string,
 *     model?:       string,            // default from settings
 *     maxTokens?:   number,            // default 256
 *     temperature?: number,            // default 0.85
 *     apiKey?:      string             // override settings
 *   })
 *   -> Promise<{
 *        ok:       boolean,
 *        text?:    string,             // the model's reply
 *        inputTokens?:    number,
 *        outputTokens?:   number,
 *        costEstimateUSD?: number,
 *        model?:   string,
 *        stopReason?: string,
 *        error?:   string,             // error code if !ok
 *        message?: string,             // human-readable error
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

// Cost estimates (USD per million tokens, input / output). Best-effort —
// users can refresh if Anthropic publishes new pricing. Defaults align
// with claude-sonnet-4-x / claude-opus-4-x publicly published rates.
const COST_TABLE = {
  "claude-opus-4-7":      { in:  15.00, out: 75.00 },
  "claude-opus-4-6":      { in:  15.00, out: 75.00 },
  "claude-sonnet-4-7":    { in:   3.00, out: 15.00 },
  "claude-sonnet-4-6":    { in:   3.00, out: 15.00 },
  "claude-haiku-4-5":     { in:   1.00, out:  5.00 },
  // Older fallbacks
  "claude-3-5-sonnet":    { in:   3.00, out: 15.00 },
  "claude-3-5-haiku":     { in:   0.80, out:  4.00 }
};

// Latest Sonnet is 4.6 (Sonnet didn't bump with Opus 4.7). Use Opus only when
// the user explicitly opts in via Module Settings → Model — Opus is 5× cost.
const DEFAULT_MODEL = "claude-sonnet-4-6";

function _estimateCost(model, inputTokens, outputTokens) {
  const rate = COST_TABLE[model];
  if (!rate) return null;
  return ((inputTokens / 1_000_000) * rate.in) + ((outputTokens / 1_000_000) * rate.out);
}

function _err(error, message, extra = {}) {
  return { ok: false, error, message, ...extra };
}

async function call(opts = {}) {
  const settings = globalThis.game?.bbttcc?.mal?.settings;
  if (!settings) return _err("MODULE_NOT_READY", "game.bbttcc.mal not installed");

  const apiKey = opts.apiKey || settings.apiKey();
  if (!apiKey) {
    return _err("NO_API_KEY", "No Anthropic API key configured. Set one in Module Settings → BBTTCC Mal Voice → API key.");
  }

  const model       = opts.model       || settings.model() || DEFAULT_MODEL;
  const maxTokens   = Number(opts.maxTokens   ?? 256);
  const temperature = Number(opts.temperature ?? 0.85);
  const systemPrompt = opts.systemPrompt || "";
  const userMessage  = opts.userMessage  || "";

  if (!userMessage) return _err("EMPTY_MESSAGE", "userMessage is required");

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt || undefined,
    messages: [{ role: "user", content: userMessage }]
  };

  const debug = settings.debug();
  if (debug) {
    log(`call() model=${model} maxTokens=${maxTokens} temp=${temperature} systemLen=${systemPrompt.length} userLen=${userMessage.length}`);
  }

  // Retry once on 429 (rate limit) or 5xx transient.
  let attempt = 0;
  let retried = false;
  while (attempt < 2) {
    attempt++;
    let resp, data;
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

    try {
      data = await resp.json();
    } catch (e) {
      return _err("BAD_RESPONSE", `Could not parse response JSON (status ${resp.status})`, { retried });
    }

    if (!resp.ok) {
      const errType = data?.error?.type || `HTTP_${resp.status}`;
      const errMsg  = data?.error?.message || `HTTP ${resp.status}`;
      // Retry once on 429 / 5xx
      if (attempt === 1 && (resp.status === 429 || resp.status >= 500)) {
        retried = true;
        await new Promise(r => setTimeout(r, 1200));
        continue;
      }
      return _err(errType, errMsg, { retried, status: resp.status });
    }

    // Success — parse content blocks. Anthropic returns content: [{ type:"text", text:"..."}, ...]
    const textBlocks = Array.isArray(data?.content) ? data.content.filter(b => b?.type === "text") : [];
    const text = textBlocks.map(b => b.text || "").join("").trim();

    const inputTokens  = Number(data?.usage?.input_tokens  ?? 0);
    const outputTokens = Number(data?.usage?.output_tokens ?? 0);
    const costEstimateUSD = _estimateCost(model, inputTokens, outputTokens);

    if (debug) {
      log(`call() ok model=${data?.model || model} in=${inputTokens} out=${outputTokens} cost=$${costEstimateUSD?.toFixed(4) ?? "?"} stop=${data?.stop_reason}`);
    }

    return {
      ok:           true,
      text,
      model:        data?.model || model,
      inputTokens,
      outputTokens,
      costEstimateUSD,
      stopReason:   data?.stop_reason || null,
      retried
    };
  }

  // Should never reach here, but defensively:
  return _err("UNKNOWN", "Retry loop exhausted without resolution");
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
    log(`Adapter installed at game.bbttcc.mal.providers.anthropic.`);
  } catch (e) {
    warn("Failed to install adapter:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
