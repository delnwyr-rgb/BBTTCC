/* bbttcc-mal-voice/scripts/voice-registry.js
 * Phase 2A.3 — Voice registry + persistence.
 *
 * A voice is a config block that describes:
 *   - WHO speaks (id, name, system prompt, speakAs portrait)
 *   - WHEN they speak (triggers: hooks with optional filter + debounce)
 *   - HOW they speak (model, temperature, maxTokens, audience, output channel)
 *   - WITH WHAT CONTEXT (contextBuilder reference, or default snapshot)
 *
 * Voices persist to the `registeredVoices` world setting (per spec §10
 * sign-off). On `ready`:
 *   1. Hydrate registry from world setting
 *   2. Then default voice configs (e.g. Mal in voices/mal.js) call
 *      `register()` — those overlay anything stored under the same id,
 *      so default voice updates roll out cleanly across versions.
 *
 * Public surface at `game.bbttcc.mal.voices`:
 *   register(config)   -> normalized voice spec
 *   unregister(id)     -> boolean
 *   get(id)            -> voice spec or null
 *   list()             -> all voice specs
 *   enabled()          -> only voices with enabled !== false
 *   setEnabled(id, on) -> boolean
 *   schema()           -> the JSON-shape doc for a voice config
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8.2 voice config schema
 */

const MODULE_ID = "bbttcc-mal-voice";
const TAG = "[mal-voice:registry]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const REGISTRY = new Map();         // id -> normalized spec
const CALLBACKS = { onRegister: [], onUnregister: [] };

// "trigger-resolved" = the contextBuilder will set context._audienceOverride
// dynamically per trigger (used by Faction Advisor to whisper to the correct
// faction's leader based on which faction the trigger references).
const AUDIENCE_VALUES = ["broadcast", "gm", "faction", "player", "trigger-resolved"];
const OUTPUT_VALUES   = ["chat", "whisper", "sheetPopup", "tokenSpeechBubble"];

function _isFn(x) { return typeof x === "function"; }

// Normalize + validate a voice spec. Throws on hard errors, warns on soft.
function _normalize(spec) {
  if (!spec || typeof spec !== "object") throw new Error("voice spec must be an object");
  const id = String(spec.id || "").trim();
  if (!id) throw new Error("voice.id required");
  if (!/^[a-z0-9_-]+$/i.test(id)) throw new Error(`voice.id must be alphanumeric/_/- (got '${id}')`);

  const name = String(spec.name || id).trim();
  const enabled = spec.enabled !== false;  // default true
  const systemPrompt = String(spec.systemPrompt || "").trim();
  if (!systemPrompt) warn(`voice '${id}' has empty systemPrompt — calls will rely entirely on userMessage`);

  const model       = String(spec.model || "").trim();    // empty = use module default
  const provider    = String(spec.provider || "").trim();  // empty = use module default
  const maxTokens   = Number.isFinite(spec.maxTokens)   ? Number(spec.maxTokens)   : 256;
  const temperature = Number.isFinite(spec.temperature) ? Number(spec.temperature) : 0.85;

  const audienceRaw = spec.audience || "broadcast";
  // audience can be "broadcast" | "gm" | "faction:<id>" | "player:<id>"
  const audienceBase = String(audienceRaw).split(":")[0];
  if (!AUDIENCE_VALUES.includes(audienceBase)) {
    throw new Error(`voice.audience must start with one of ${AUDIENCE_VALUES.join("|")} (got '${audienceRaw}')`);
  }

  const outputChannel = String(spec.outputChannel || "chat");
  if (!OUTPUT_VALUES.includes(outputChannel)) {
    throw new Error(`voice.outputChannel must be one of ${OUTPUT_VALUES.join("|")} (got '${outputChannel}')`);
  }

  const speakAs = (spec.speakAs && typeof spec.speakAs === "object") ? { ...spec.speakAs } : { alias: name };

  // Triggers: array of { hook, filter?, debounceMs? }
  let triggers = [];
  if (Array.isArray(spec.triggers)) {
    for (const t of spec.triggers) {
      if (!t || typeof t !== "object") continue;
      const hook = String(t.hook || "").trim();
      if (!hook) continue;
      triggers.push({
        hook,
        filter:     _isFn(t.filter) ? t.filter : (typeof t.filter === "string" ? t.filter : null),
        debounceMs: Number.isFinite(t.debounceMs) ? Number(t.debounceMs) : 0
      });
    }
  }

  // contextBuilder may be a function (live) or a string key (resolved later by trigger engine)
  const contextBuilder = _isFn(spec.contextBuilder) ? spec.contextBuilder
                       : (typeof spec.contextBuilder === "string" ? spec.contextBuilder : "default");

  return {
    id, name, enabled,
    systemPrompt,
    provider, model, maxTokens, temperature,
    audience: audienceRaw,
    outputChannel, speakAs,
    triggers,
    contextBuilder,
    // Foundation v2: stream replies into the chat card token-by-token
    // (chat channel only); prepend the shared cached lore primer.
    stream:  spec.stream === true,
    useLore: spec.useLore !== false,
    // Optional chat-card palette override: { border, bg, fontStyle }.
    style:   (spec.style && typeof spec.style === "object") ? { ...spec.style } : null,
    // Free-form metadata bag for voice-specific extensions.
    meta: (spec.meta && typeof spec.meta === "object") ? { ...spec.meta } : {}
  };
}

// ----- Persistence helpers -----
// We don't store functions — only serializable bits. Function-valued fields
// (contextBuilder, filter) get coerced to string keys or dropped.
function _persistable(spec) {
  const out = { ...spec };
  if (typeof out.contextBuilder === "function") out.contextBuilder = "custom";
  out.triggers = (spec.triggers || []).map(t => ({
    hook: t.hook,
    filter: (typeof t.filter === "function") ? null : t.filter,
    debounceMs: t.debounceMs
  }));
  return out;
}

async function _persist() {
  try {
    if (!game?.user?.isGM) return;  // only GM writes world settings
    const obj = {};
    for (const [id, spec] of REGISTRY.entries()) obj[id] = _persistable(spec);
    await game.settings.set(MODULE_ID, "registeredVoices", obj);
  } catch (e) {
    warn("persistence failed:", e?.message || e);
  }
}

function _hydrate() {
  try {
    const stored = game.settings.get(MODULE_ID, "registeredVoices") || {};
    let n = 0;
    for (const [id, spec] of Object.entries(stored)) {
      try {
        const norm = _normalize({ ...spec, id });
        REGISTRY.set(id, norm);
        n++;
      } catch (e) {
        warn(`hydrate skipped '${id}':`, e?.message || e);
      }
    }
    if (n) log(`Hydrated ${n} voice(s) from world setting.`);
  } catch (e) {
    warn("hydrate failed:", e?.message || e);
  }
}

// ----- Public API -----
function register(spec) {
  const norm = _normalize(spec);
  const existed = REGISTRY.has(norm.id);
  REGISTRY.set(norm.id, norm);
  log(`Registered '${norm.id}' (${existed ? "overwrote" : "new"}, triggers=${norm.triggers.length})`);
  _persist();  // fire and forget
  for (const cb of CALLBACKS.onRegister) { try { cb(norm); } catch (_) {} }
  return norm;
}

function unregister(id) {
  const had = REGISTRY.delete(id);
  if (had) {
    log(`Unregistered '${id}'`);
    _persist();
    for (const cb of CALLBACKS.onUnregister) { try { cb(id); } catch (_) {} }
  }
  return had;
}

function get(id) { return REGISTRY.get(id) || null; }
function list()  { return Array.from(REGISTRY.values()); }
function enabled() { return list().filter(v => v.enabled !== false); }

function setEnabled(id, on) {
  const spec = REGISTRY.get(id);
  if (!spec) return false;
  spec.enabled = !!on;
  _persist();
  return true;
}

function onRegister(cb)   { if (_isFn(cb)) CALLBACKS.onRegister.push(cb); }
function onUnregister(cb) { if (_isFn(cb)) CALLBACKS.onUnregister.push(cb); }

function schema() {
  return {
    id:             "string, /^[a-z0-9_-]+$/i, unique",
    name:           "string, display name",
    enabled:        "boolean, default true",
    systemPrompt:   "string, the LLM system prompt",
    provider:       "string, '' | 'anthropic' | 'openai' | 'ollama' | 'custom-endpoint' ('' = module default)",
    model:          "string, '' = provider default",
    maxTokens:      "number, default 256",
    temperature:    "number, default 0.85",
    audience:       "string, 'broadcast' | 'gm' | 'faction:<id>' | 'player:<id>'",
    outputChannel:  "string, 'chat' | 'whisper' | 'sheetPopup' | 'tokenSpeechBubble'",
    speakAs:        "object, { alias?, actorId?, tokenId? }",
    triggers:       "array of { hook, filter?: fn|string, debounceMs?: number }",
    contextBuilder: "function | 'default' | string key for trigger engine to resolve",
    stream:         "boolean, default false — stream reply into the chat card token-by-token",
    useLore:        "boolean, default true — prepend the shared cached Bad Eden lore primer",
    style:          "object|null, { border, bg, fontStyle } chat-card palette override",
    meta:           "object, free-form extension bag"
  };
}

// ----- Install -----
function _install() {
  try {
    globalThis.game.bbttcc     ??= { api: {} };
    globalThis.game.bbttcc.mal ??= {};
    globalThis.game.bbttcc.mal.voices = Object.assign(globalThis.game.bbttcc.mal.voices || {}, {
      register, unregister, get, list, enabled, setEnabled,
      onRegister, onUnregister, schema,
      _size: () => REGISTRY.size
    });

    _hydrate();
    log(`Registry installed (${REGISTRY.size} voice(s) after hydration).`);
  } catch (e) {
    warn("install failed:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
