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

// ============================================================
// Context-size guards. The raw snapshot from agent.invoke("snapshot")
// includes the entire raid API namespace + maneuver registry — ~25k
// tokens of mostly-irrelevant data per call. Slim aggressively before
// putting it in the user message. Anthropic rate limit is 30k input
// tokens/min on the lowest tier, so unbounded contexts blow up fast.
// ============================================================

// Extract only the essential bits from the agent's snapshot. Voice
// contextBuilders that need richer per-faction state should query
// observation.snapshot({factionId}) directly rather than reading from
// the global snapshot.
function slimSnapshot(snap) {
  if (!snap || typeof snap !== "object") return null;
  return {
    ts:    snap.ts || Date.now(),
    ready: !!snap.ready,
    user:  snap.user ? { id: snap.user.id, name: snap.user.name, isGM: !!snap.user.isGM } : null
  };
}

// Hard cap on any nested object we hand to the LLM. Converts to JSON,
// truncates if over budget, returns either the original object or a
// truncation marker. Default cap ~3000 chars = ~750 tokens.
function truncateForLLM(obj, maxChars = 3000) {
  if (obj == null) return obj;
  let str;
  try { str = JSON.stringify(obj); } catch (_) { return obj; }
  if (str.length <= maxChars) return obj;
  return {
    _truncated: true,
    _originalLength: str.length,
    _cap: maxChars,
    partial: str.substring(0, maxChars) + "…"
  };
}

// ----- Default context builder (used by Mal and any voice that doesn't
//       declare its own contextBuilder). Slim by default.
async function defaultContextBuilder(voice, triggerArgs) {
  const agent = globalThis.game?.bbttcc?.api?.agent;
  let snapshot = null;
  if (agent?.invoke) {
    try {
      const s = await agent.invoke("snapshot", {});
      if (s && s.ok !== false) snapshot = slimSnapshot(s);
    } catch (e) {
      warn("snapshot fetch failed:", e?.message || e);
    }
  }

  // Mal benefits from a tiny name-context for the active world. Pull a
  // single faction name if the trigger references one, plus the current
  // scene name. Both are cheap (<200 chars) and dramatically improve
  // Mal's grounding without adding tokens.
  const args = triggerArgs.args || {};
  const factionId = args.factionId || args.attackerFactionId || null;
  let factionName = null;
  if (factionId && globalThis.game?.actors) {
    factionName = globalThis.game.actors.get(factionId)?.name || null;
  }
  const sceneName = globalThis.game?.scenes?.active?.name || null;

  return {
    trigger:    { hook: triggerArgs.hook || "manual", args },
    snapshot,
    nameContext: { factionId, factionName, sceneName },
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
// System prompt is assembled as cached blocks: [shared lore primer, voice
// persona], both flagged for 1h-TTL prompt caching. The primer block is
// byte-identical across ALL voices, so after the first call each hour it's
// served from Anthropic's prompt cache at ~0.1x input price — every voice
// gets deep world grounding nearly free. Volatile per-trigger context stays
// in the user message where it can't invalidate the cached prefix.
function _voiceSystem(voice) {
  const lore = globalThis.game?.bbttcc?.mal?.lore;
  const usePrimer = (voice.useLore !== false) && (lore?.enabled?.() !== false);
  const primer = usePrimer ? (lore?.getPrimer?.() || "") : "";
  const system = [];
  if (primer) system.push({ text: primer, cache: "1h" });
  if (voice.systemPrompt) system.push({ text: voice.systemPrompt, cache: "1h" });
  return system;
}

async function _callProvider(voice, context, streamHandle = null) {
  const settings = globalThis.game?.bbttcc?.mal?.settings;
  if (!settings) return { ok: false, error: "MODULE_NOT_READY", message: "game.bbttcc.mal not installed" };

  const providerName = voice.provider || settings.provider();
  const provider = globalThis.game?.bbttcc?.mal?.providers?.[providerName];
  if (!provider?.call) {
    return { ok: false, error: "PROVIDER_NOT_INSTALLED", message: `Provider '${providerName}' not installed (Phase 2A ships anthropic only)` };
  }

  // `_audienceOverride` steers THIS seat's chat render; it is not for the model.
  const { _audienceOverride, ...forModel } = (context && typeof context === "object") ? context : { context };
  const userMessage = JSON.stringify(forModel, null, 2);
  const system = _voiceSystem(voice);
  return await provider.call({
    system,
    systemPrompt: voice.systemPrompt,   // back-compat for older adapters
    userMessage,
    model:        voice.model || undefined,
    maxTokens:    voice.maxTokens,
    temperature:  voice.temperature,
    stream:       !!streamHandle,
    onDelta:      streamHandle ? (text) => streamHandle.update(text) : undefined,
    // Player seat: the GM rebuilds system/model/maxTokens from ITS registry
    // entry for this voice; only the voice id, hook and context travel.
    relay:        { kind: "voice", voiceId: voice.id, hook: context?.trigger?.hook || "manual", userMessage }
  });
}

// GM-side builder for relayed voice calls (owner ruling 2026-10-02). A player
// seat may fire Mal / the Watcher / the Faction Advisor (for a faction it
// owns); GM-audience voices (GM Advisor) are refused — they speak to the GM,
// and the GM's own seat fires them.
function _voiceRelayBuilder(payload, { user }) {
  const voice = globalThis.game?.bbttcc?.mal?.voices?.get?.(String(payload?.voiceId || ""));
  if (!voice) return { ok: false, error: "RELAY_REFUSED", message: `Unknown voice '${payload?.voiceId}'.` };
  if (voice.enabled === false) return { ok: false, error: "VOICE_DISABLED", message: `Voice '${voice.id}' is disabled.` };
  if (String(voice.audience).split(":")[0] === "gm") return { ok: false, error: "RELAY_REFUSED", message: `Voice '${voice.id}' speaks to the GM only.` };
  const userMessage = String(payload?.userMessage ?? "");
  if (!userMessage || userMessage.length > 16000) return { ok: false, error: "RELAY_REFUSED", message: "Voice context missing or too large." };
  let ctx = null;
  try { ctx = JSON.parse(userMessage); } catch (_e) { ctx = null; }
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx)) return { ok: false, error: "RELAY_REFUSED", message: "Voice context must be a JSON object." };
  if (voice.id === "faction-advisor") {
    const f = ctx.factionId ? globalThis.game?.actors?.get?.(String(ctx.factionId)) : null;
    if (!f || !f.testUserPermission?.(user, "OWNER")) {
      return { ok: false, error: "RELAY_REFUSED", message: "The Faction Advisor speaks only for a faction this seat owns." };
    }
  }
  return {
    ok: true,
    logId: voice.id,
    request: {
      system: _voiceSystem(voice),
      userMessage,
      model: voice.model || undefined,
      maxTokens: voice.maxTokens,
      temperature: voice.temperature
    }
  };
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

  // Player seats relay through the GM (owner ruling 2026-10-02). GM-audience
  // voices are the GM seat's own business; with no GM connected nothing can
  // answer — say so for a manual consult, stay quiet for ambient fires.
  if (!game?.user?.isGM) {
    if (String(voice.audience).split(":")[0] === "gm") return { ok: false, error: "GM_SEAT_ONLY" };
    if (!globalThis.game?.bbttcc?.mal?.providers?.anthropic?.gmOnline?.()) {
      if (hook === "manual") ui.notifications?.info?.(`${voice.name}: the line is dead — advisors speak through the GM's seat, and no GM is connected.`);
      return { ok: false, error: "NO_GM", message: "No GM connected to relay the call." };
    }
  }

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

  // Streaming: open a live chat card BEFORE the provider call so deltas have
  // somewhere to land. Falls back to buffered output if beginStream fails.
  let streamHandle = null;
  const output = globalThis.game?.bbttcc?.mal?.output;
  if (voice.stream === true && output?.beginStream) {
    try { streamHandle = await output.beginStream({ voice, context }); }
    catch (e) { warn(`beginStream failed for '${voiceId}':`, e?.message); streamHandle = null; }
  }

  // Call provider
  const t0 = performance.now();
  const result = await _callProvider(voice, context, streamHandle);
  const durationMs = Math.round(performance.now() - t0);
  if (!result.ok) {
    warn(`provider call failed for '${voiceId}' (${result.error}): ${result.message}`);
    if (streamHandle) { try { await streamHandle.cancel(); } catch (_e) {} }
    return result;
  }

  // Render output
  if (streamHandle) {
    try { await streamHandle.finalize(result.text || ""); }
    catch (e) { warn("finalize failed:", e?.message); }
  } else {
    await _output(voice, result.text || "", context);
  }

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
        cacheReadTokens: result.cacheReadTokens ?? 0,
        cacheWriteTokens: result.cacheWriteTokens ?? 0,
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
      slimSnapshot,
      truncateForLLM,
      _subscribeHook,
      _subscribedHooks: () => [...HOOK_HANDLERS.keys()]
    });

    _wireAllVoices();

    // GM relay kind for voices fired on player seats.
    globalThis.game?.bbttcc?.mal?.providers?.anthropic?.registerRelayKind?.("voice", _voiceRelayBuilder);

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
