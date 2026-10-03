/* bbttcc-mal-voice/scripts/module.js
 * Phase 2A.1 — module shell + settings + namespace bootstrap.
 *
 * Registers Foundry settings (BYO API key model) and installs the
 * `game.bbttcc.mal` namespace. Subsequent §2A files extend it:
 *   §2A.2 providers.js   -> game.bbttcc.mal.providers
 *   §2A.3 voice-registry -> game.bbttcc.mal.voices.{register,get,list,...}
 *   §2A.4 trigger-engine -> game.bbttcc.mal.triggers
 *   §2A.5 output-channel -> game.bbttcc.mal.output
 *
 * BYO-key: the GM supplies an Anthropic API key, stored as a CLIENT setting in
 * the GM's own browser (owner ruling 2026-10-02). Player seats never hold it —
 * their AI calls relay through the active GM (providers/anthropic.js). We
 * never operate a backend.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8 (Phase 2)
 */

const MODULE_ID = "bbttcc-mal-voice";
const TAG = "[mal-voice]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// Only the Anthropic provider is implemented (providers/anthropic.js). The
// openai / ollama / custom-endpoint options used to be offered here but always
// returned PROVIDER_NOT_INSTALLED — trimmed 2026-08-28 (atlas cleanup). Add a
// provider file first, then restore its choice.
const PROVIDER_CHOICES = {
  "anthropic": "Anthropic (Claude)"
};

const POLICY_CHOICES = {
  "gm-key-powers-all":  "GM's key powers all broadcast voices (recommended)",
  "each-user-pays":     "Each user supplies their own key for private whispers"
};

// ----- Settings registration -----
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "apiProvider", {
    name:    "API provider",
    hint:    "Which LLM provider to use. BYO-key — no backend operated by Bad Eden.",
    scope:   "world",
    config:  true,
    type:    String,
    choices: PROVIDER_CHOICES,
    default: "anthropic"
  });

  // Owner ruling 2026-10-02: CLIENT scope = this browser's localStorage only —
  // never stored on the server, never sent to other seats. Only GM seats use
  // it; player seats relay every AI call through the active GM (providers/
  // anthropic.js GM RELAY). Hidden from players' settings at `setup`. The old
  // world-scope value is migrated into the GM's browser and deleted at ready.
  game.settings.register(MODULE_ID, "apiKey", {
    name:    "API key (GM machine only)",
    hint:    "Your Anthropic API key. Stored ONLY in this browser on this GM machine — it is never saved to the world or sent to players. Player NPC conversations and advisors are relayed through the connected GM's seat and use this key there (rate-limited per player). Enter it on every machine/browser you GM from; clearing this browser's site data clears it.",
    scope:   "client",
    config:  true,
    type:    String,
    default: ""
  });

  game.settings.register(MODULE_ID, "model", {
    name:    "Model",
    hint:    "Model identifier. For Anthropic: claude-sonnet-5 (default — best balance), claude-haiku-4-5 (cheapest, high-frequency barks), claude-opus-4-8 (premium, ~2x Sonnet cost). For Ollama: llama3, mistral, etc. Leave blank to use provider default.",
    scope:   "world",
    config:  true,
    type:    String,
    default: ""
  });

  // "customEndpoint" setting removed 2026-08-28 — it was only meaningful for the
  // never-implemented custom-endpoint provider and nothing read it.

  game.settings.register(MODULE_ID, "monthlyBudgetUSD", {
    name:    "Monthly budget (USD)",
    hint:    "Soft cap on estimated API spend per month. Warns before exceeding; does not hard-block.",
    scope:   "world",
    config:  true,
    type:    Number,
    default: 10,
    range:   { min: 0, max: 1000, step: 1 }
  });

  game.settings.register(MODULE_ID, "defaultPolicy", {
    name:    "Voice key policy",
    hint:    "Who pays for broadcast voices vs whispers. (Currently informational: since 2026-10-02 every AI call — GM or relayed from a player seat — uses the key on the GM's machine.)",
    scope:   "world",
    config:  true,
    type:    String,
    choices: POLICY_CHOICES,
    default: "gm-key-powers-all"
  });

  game.settings.register(MODULE_ID, "debug", {
    name:    "Debug logging",
    hint:    "Verbose console logging for prompt assembly, provider calls, and trigger dispatch. Off in production.",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false
  });

  // Internal: registered voice configs (world-scope, per §10 sign-off).
  game.settings.register(MODULE_ID, "registeredVoices", {
    scope:   "world",
    config:  false,
    type:    Object,
    default: {},
    // Push voices.setEnabled() to every client's in-memory registry.
    onChange: (v) => { try { game.bbttcc?.mal?.voices?._syncEnabled?.(v); } catch (_e) {} }
  });

  // Internal: audit log of recent calls (capped, ring buffer).
  game.settings.register(MODULE_ID, "callLog", {
    scope:   "world",
    config:  false,
    type:    Array,
    default: []
  });

  log("Settings registered.");
});

// Players never see the key field (game.user exists from `setup`).
Hooks.once("setup", () => {
  try {
    const cfg = game.settings.settings.get(`${MODULE_ID}.apiKey`);
    if (cfg && !game.user?.isGM) cfg.config = false;
  } catch (_e) {}
});

// ----- One-time key migration: world setting → this GM's browser -----
// Before 2026-10-02 the key was a world Setting document (sent to every seat).
// On a GM seat: copy its value into this browser's client setting (unless one
// is already set here), then DELETE the world document so no seat receives it
// again. Idempotent — once the world doc is gone this is a no-op.
async function _migrateWorldKey() {
  if (!game.user?.isGM) return;
  const key = `${MODULE_ID}.apiKey`;
  let doc = null;
  try { doc = game.settings.storage.get("world")?.getSetting?.(key, null) || null; } catch (_e) { doc = null; }
  if (!doc) return;
  let worldValue = "";
  try {
    const raw = doc._source?.value;
    worldValue = (typeof raw === "string") ? String(JSON.parse(raw) ?? "") : String(raw ?? "");
  } catch (_e) { worldValue = String(doc._source?.value ?? ""); }
  worldValue = worldValue.trim();
  const local = String(game.settings.get(MODULE_ID, "apiKey") || "").trim();
  try {
    if (worldValue && !local) await game.settings.set(MODULE_ID, "apiKey", worldValue);
    await doc.delete();
    if (worldValue) {
      ui.notifications?.info(`AI Advisor: the API key moved into THIS browser's client settings and was removed from the world — players can no longer read it. ${local ? "(This browser already had a key; it was kept.) " : ""}Re-enter it on any other machine you GM from.`, { permanent: true });
    }
    log(`world-scope apiKey migrated (${worldValue ? (local ? "kept existing local key" : "copied to this GM browser") : "was empty"}) and deleted.`);
  } catch (e) {
    warn("world apiKey migration failed (needs a full GM with settings permission):", e?.message || e);
  }
}

// ----- Namespace bootstrap + ready check -----
function _install() {
  try {
    globalThis.game.bbttcc      ??= { api: {} };
    globalThis.game.bbttcc.mal  ??= {};

    Object.assign(globalThis.game.bbttcc.mal, {
      MODULE_ID,
      version: "0.1.0",

      // Settings accessors
      settings: {
        get: (key) => game.settings.get(MODULE_ID, key),
        set: (key, value) => game.settings.set(MODULE_ID, key, value),
        provider:  () => game.settings.get(MODULE_ID, "apiProvider"),
        // GM seats only — a player seat never holds (or uses) a key.
        apiKey:    () => game.user?.isGM ? String(game.settings.get(MODULE_ID, "apiKey") || "").trim() : "",
        // Can THIS seat get an AI reply right now? GM: a key is set here.
        // Player: a GM is connected to relay through (the GM's key is checked there).
        canCall:   () => game.user?.isGM
          ? !!String(game.settings.get(MODULE_ID, "apiKey") || "").trim()
          : !!globalThis.game?.bbttcc?.mal?.providers?.anthropic?.gmOnline?.(),
        model:     () => game.settings.get(MODULE_ID, "model"),
        endpoint:  () => "", // custom-endpoint provider removed 2026-08-28; kept so mal.settings shape is stable
        budget:    () => game.settings.get(MODULE_ID, "monthlyBudgetUSD"),
        policy:    () => game.settings.get(MODULE_ID, "defaultPolicy"),
        debug:     () => !!game.settings.get(MODULE_ID, "debug")
      },

      // Provider / voice / trigger / output sub-namespaces are populated
      // by subsequent §2A.* scripts as they load.
      providers: globalThis.game.bbttcc.mal.providers || {},
      voices:    globalThis.game.bbttcc.mal.voices    || {},
      triggers:  globalThis.game.bbttcc.mal.triggers  || {},
      output:    globalThis.game.bbttcc.mal.output    || {}
    });

    // Verify the agent registry is present — we depend on it for context.
    const agent = globalThis.game?.bbttcc?.api?.agent;
    if (!agent?.capabilities) {
      warn("game.bbttcc.api.agent.capabilities() not available. Mal Voice cannot read game state until bbttcc-raid is active and the agent registry is installed.");
    } else {
      const caps = agent.capabilities();
      log(`Bootstrapped against agent registry v${caps.version} (${caps.verbs.length} verbs).`);
    }

    log(`Installed at game.bbttcc.mal (v${globalThis.game.bbttcc.mal.version}). Provider: ${game.bbttcc.mal.settings.provider()}. ${game.user?.isGM ? `Key on this GM machine: ${!!game.bbttcc.mal.settings.apiKey()}.` : "Player seat — AI calls relay through the GM."}`);
    _migrateWorldKey().catch(e => warn("key migration threw:", e?.message || e));
  } catch (e) {
    warn("Failed to install game.bbttcc.mal:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
