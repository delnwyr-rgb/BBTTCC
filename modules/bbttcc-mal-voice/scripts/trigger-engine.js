/* bbttcc-mal-voice/scripts/trigger-engine.js
 * Phase 2A.4 — Trigger engine + context builder.
 *
 * Bridges Foundry hooks → registered voice configs → provider call → output:
 *
 *   1. On voice registration, subscribe Foundry hooks the voice declares.
 *   2. When a hook fires, find all enabled voices whose triggers list that
 *      hook. For each: apply debounce, run filter, build context, call
 *      provider with voice's systemPrompt + JSON-encoded user message,
 *      hand result to output channel.
 *   3. Expose `fire(voiceId, { hook, args, mode?, lengthHint? })` for the
 *      §2A.6 smoketest macro and other manual triggers.
 *
 * Default context builder pulls a snapshot via the agent registry
 * (game.bbttcc.api.agent.invoke("snapshot")) so voices see real game state.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8.2 voice config schema
 */

const TAG = "[mal-voice:trigger]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const DEBOUNCE = new Map();        // `${voiceId}:${hook}` -> last fire timestamp ms
const HOOK_HANDLERS = new Map();   // hook name -> the wrapped Foundry hook handler fn

// ----- Mode inference (gentle hint, never overrides explicit mode) -----
function _inferMode(triggerArgs) {
  const h = String(triggerArgs.hook || "").toLowerCase();
  if (/(roundcommit|scaraccrued|outcome|misfire|fail|win|kill)/.test(h)) return "outcome";
  if (/(scene|enter|approach|intro)/.test(h))                              return "atmospheric";
  return "snark";
}

// ----- Default context builder -----
async function defaultContextBuilder(voice, triggerArgs) {
  const agent = globalThis.game?.bbttcc?.api?.agent;
  let snapshot = null;
  if (agent?.invoke) {
    try {
      const s = await agent.invoke("snapshot", {});
      if (s && s.ok !== false) snapshot = s;
    } catch (e) {
      warn("snapshot fetch failed:", e?.message || e);
    }
  }
  return {
    trigger:    { hook: triggerArgs.hook || "manual", args: triggerArgs.args || {} },
    snapshot,
    mode:       triggerArgs.mode       || _inferMode(triggerArgs),
    lengthHint: triggerArgs.lengthHint || (triggerArgs.mode === "atmospheric" ? 80 : 30)
  };
}

// ----- Filter resolution (function or string key) -----
function _passesFilter(trigger, triggerArgs) {
  const f = trigger?.filter;
  if (!f) return true;
  if (typeof f === "function") {
    try { return !!f(triggerArgs); } catch (e) { warn("filter threw:", e?.message); return false; }
  }
  if (typeof f === "string") {
    // Built-in string filters:
    if (f === "misfire") return !!(triggerArgs.args?.misfire || triggerArgs.args?.outcome === "misfire");
    if (f === "failure") {
      const o = String(triggerArgs.args?.outcome || "").toLowerCase();
      return /(fail|loss|defeat|detected)/.test(o);
    }
    if (f === "success") {
      const o = String(triggerArgs.args?.outcome || "").toLowerCase();
      return /(success|win|great)/.test(o);
    }
    warn(`unknown string filter '${f}' — passing through`);
    return true;
  }
  return true;
}

// ----- Provider dispatch -----
async function _callProvider(voice, context) {
  const settings = globalThis.game?.bbttcc?.mal?.settings;
  if (!settings) return { ok: false, error: "MODULE_NOT_READY", message: "game.bbttcc.mal not installed" };

  const providerName = voice.provider || settings.provider();
  const provider = globalThis.game?.bbttcc?.mal?.providers?.[providerName];
  if (!provider?.call) {
    return { ok: false, error: "PROVIDER_NOT_INSTALLED", message: `Provider '${providerName}' not installed (Phase 2A ships anthropic only)` };
  }

  const userMessage = JSON.stringify(context, null, 2);
  return await provider.call({
    systemPrompt: voice.systemPrompt,
    userMessage,
    model:        voice.model || undefined,
    maxTokens:    voice.maxTokens,
    temperature:  voice.temperature
  });
}

// ----- Output dispatch -----
async function _output(voice, text, context) {
  const output = globalThis.game?.bbttcc?.mal?.output;
  if (output?.render) {
    try { return await output.render({ voice, text, context }); }
    catch (e) { warn("output.render threw:", e?.message); }
  }
  // Fallback path (no output channel installed yet — e.g. during early dev):
  console.log(`%c[${voice.name}]%c ${text}`, "color:#c66;font-weight:bold", "");
  if (game?.user?.isGM && ui?.notifications?.info) {
    ui.notifications.info(`[${voice.name}] ${text}`);
  }
}

// ----- Public: fire(voiceId, triggerArgs) -----
async function fire(voiceId, triggerArgs = {}) {
  const voices = globalThis.game?.bbttcc?.mal?.voices;
  const voice = voices?.get?.(voiceId);
  if (!voice) return { ok: false, error: "NO_VOICE", message: `Voice '${voiceId}' not registered` };
  if (voice.enabled === false) return { ok: false, error: "VOICE_DISABLED", message: `Voice '${voiceId}' disabled` };

  const hook = triggerArgs.hook || "manual";
  const trig = voice.triggers.find(t => t.hook === hook) || null;

  // Debounce
  const debounceMs = trig?.debounceMs ?? 0;
  if (debounceMs > 0) {
    const dKey = `${voiceId}:${hook}`;
    const last = DEBOUNCE.get(dKey) || 0;
    if (Date.now() - last < debounceMs) {
      return { ok: false, error: "DEBOUNCED", debounceMs, sinceLastMs: Date.now() - last };
    }
    DEBOUNCE.set(dKey, Date.now());
  }

  // Filter
  if (trig && !_passesFilter(trig, triggerArgs)) {
    return { ok: false, error: "FILTERED" };
  }

  // Build context
  let context;
  try {
    const builder = (typeof voice.contextBuilder === "function") ? voice.contextBuilder : defaultContextBuilder;
    context = await builder(voice, triggerArgs);
  } catch (e) {
    warn(`contextBuilder threw for '${voiceId}':`, e?.message);
    context = { trigger: { hook, args: triggerArgs.args || {} }, snapshot: null, mode: "snark", lengthHint: 30 };
  }

  // Call provider
  const t0 = performance.now();
  const result = await _callProvider(voice, context);
  const durationMs = Math.round(performance.now() - t0);
  if (!result.ok) {
    warn(`provider call failed for '${voiceId}' (${result.error}): ${result.message}`);
    return result;
  }

  // Render output
  await _output(voice, result.text || "", context);

  // Append to call log (capped ring buffer at 200)
  try {
    if (game?.user?.isGM) {
      const settings = globalThis.game?.bbttcc?.mal?.settings;
      const log = (game.settings.get("bbttcc-mal-voice", "callLog") || []).slice(-199);
      log.push({
        ts: Date.now(),
        voiceId,
        hook,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUSD: result.costEstimateUSD,
        durationMs
      });
      await game.settings.set("bbttcc-mal-voice", "callLog", log);
    }
  } catch (e) { /* non-fatal */ }

  return {
    ok:           true,
    voiceId,
    text:         result.text,
    inputTokens:  result.inputTokens,
    outputTokens: result.outputTokens,
    costUSD:      result.costEstimateUSD,
    durationMs
  };
}

// ----- Hook subscription -----
function _subscribeHook(hook) {
  if (HOOK_HANDLERS.has(hook)) return;
  const handler = async (...args) => {
    const voices = globalThis.game?.bbttcc?.mal?.voices?.enabled?.() || [];
    for (const voice of voices) {
      if (!voice.triggers?.some(t => t.hook === hook)) continue;
      try {
        await fire(voice.id, { hook, args: args[0] || {} });
      } catch (e) {
        warn(`fire failed for '${voice.id}' on '${hook}':`, e?.message);
      }
    }
  };
  Hooks.on(hook, handler);
  HOOK_HANDLERS.set(hook, handler);
}

function _wireAllVoices() {
  const voices = globalThis.game?.bbttcc?.mal?.voices?.list?.() || [];
  const hooks = new Set();
  for (const v of voices) for (const t of v.triggers || []) hooks.add(t.hook);
  for (const h of hooks) _subscribeHook(h);
  log(`Wired ${hooks.size} hook(s): ${[...hooks].join(", ") || "(none)"}`);
}

// ----- Install -----
function _install() {
  try {
    globalThis.game.bbttcc     ??= { api: {} };
    globalThis.game.bbttcc.mal ??= {};
    globalThis.game.bbttcc.mal.triggers = Object.assign(globalThis.game.bbttcc.mal.triggers || {}, {
      fire,
      defaultContextBuilder,
      _subscribeHook,
      _subscribedHooks: () => [...HOOK_HANDLERS.keys()]
    });

    _wireAllVoices();

    // Wire newly-registered voices retroactively.
    const voices = globalThis.game?.bbttcc?.mal?.voices;
    if (voices?.onRegister) {
      voices.onRegister((voice) => {
        for (const t of voice.triggers || []) _subscribeHook(t.hook);
      });
    }

    log(`Trigger engine installed.`);
  } catch (e) {
    warn("install failed:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
