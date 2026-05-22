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
 * BYO-key: the GM (or each user) supplies an Anthropic / OpenAI / Ollama
 * / custom-endpoint API key. We never operate a backend.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8 (Phase 2)
 */

const MODULE_ID = "bbttcc-mal-voice";
const TAG = "[mal-voice]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const PROVIDER_CHOICES = {
  "anthropic":       "Anthropic (Claude)",
  "openai":          "OpenAI (GPT)",
  "ollama":          "Ollama (local)",
  "custom-endpoint": "Custom endpoint"
};

const POLICY_CHOICES = {
  "gm-key-powers-all":  "GM's key powers all broadcast voices (recommended)",
  "each-user-pays":     "Each user supplies their own key for private whispers"
};

// ----- Settings registration -----
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "apiProvider", {
    name:    "API provider",
    hint:    "Which LLM provider to use. BYO-key — no backend operated by BBTTCC.",
    scope:   "world",
    config:  true,
    type:    String,
    choices: PROVIDER_CHOICES,
    default: "anthropic"
  });

  game.settings.register(MODULE_ID, "apiKey", {
    name:    "API key",
    hint:    "Your provider API key. Stored locally in your world settings. Never transmitted anywhere except directly to the chosen provider.",
    scope:   "world",
    config:  true,
    type:    String,
    default: ""
  });

  game.settings.register(MODULE_ID, "model", {
    name:    "Model",
    hint:    "Model identifier. For Anthropic: claude-sonnet-4-7 or claude-opus-4-7. For OpenAI: gpt-4o or gpt-4o-mini. For Ollama: llama3, mistral, etc. Leave blank to use provider default.",
    scope:   "world",
    config:  true,
    type:    String,
    default: ""
  });

  game.settings.register(MODULE_ID, "customEndpoint", {
    name:    "Custom endpoint URL",
    hint:    "Only used when provider = Custom endpoint. Full URL including path.",
    scope:   "world",
    config:  true,
    type:    String,
    default: ""
  });

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
    hint:    "Who pays for broadcast voices vs whispers.",
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
    default: {}
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
        apiKey:    () => game.settings.get(MODULE_ID, "apiKey"),
        model:     () => game.settings.get(MODULE_ID, "model"),
        endpoint:  () => game.settings.get(MODULE_ID, "customEndpoint"),
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

    log(`Installed at game.bbttcc.mal (v${globalThis.game.bbttcc.mal.version}). Provider: ${game.bbttcc.mal.settings.provider()}. Key configured: ${!!game.bbttcc.mal.settings.apiKey()}.`);
  } catch (e) {
    warn("Failed to install game.bbttcc.mal:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
