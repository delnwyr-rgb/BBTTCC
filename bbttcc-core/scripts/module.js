// bbttcc-core/module.js
// FULL REPLACEMENT — Core bootstrap hardened + GM Write Layer install hook
//
// Notes:
// - Does NOT overwrite existing game.bbttcc.api (merges instead).
// - Registers core world settings used by GM tools.
// - Loads gm API installer if present on globalThis (or via dynamic import fallback).
//
// Syntax-safe: no optional chaining, no object spread, no async/await.

const CORE_ID = "bbttcc-core";

function _log()  { console.log.apply(console, arguments); }
function _warn() { console.warn.apply(console, arguments); }

function _ensureRoot() {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.api = game.bbttcc.api || {};

  // Preserve anything already registered by other modules.
  const api = game.bbttcc.api;

  if (!api.core) api.core = { version: "1.0.0" };

  // Provide stable "slots" other modules can fill (do not null them if already set).
  if (typeof api.factions === "undefined")          api.factions = null;
  if (typeof api.territory === "undefined")         api.territory = null;
  if (typeof api.characterOptions === "undefined")  api.characterOptions = null;
  if (typeof api.campaign === "undefined")          api.campaign = null;
  if (typeof api.encounters === "undefined")        api.encounters = null;

  return api;
}

function _registerSettings() {
  try {
    game.settings.register(CORE_ID, "gmEditMode", {
      name: "GM Edit Mode",
      hint: "Enables GM-only direct write tools (manual edits) across BBTTCC.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register(CORE_ID, "gmAuditLog", {
      name: "GM Audit Log",
      hint: "Internal log of GM manual edits (JSON array).",
      scope: "world",
      config: false,
      type: String,
      default: "[]"
    });
  } catch (e) {
    _warn(`[${CORE_ID}] settings register failed`, e);
  }
}

function _installGMApi() {
  const api = _ensureRoot();

  // Prefer already-loaded installer (if module.json loads scripts/api.gm.js)
  if (globalThis.BBTTCC_GM_API && typeof globalThis.BBTTCC_GM_API.install === "function") {
    try {
      globalThis.BBTTCC_GM_API.install(game.bbttcc);
      _log(`[${CORE_ID}] GM API installed (global installer)`);
      return;
    } catch (e) {
      _warn(`[${CORE_ID}] GM API install failed`, e);
      return;
    }
  }

  // Fallback: attempt dynamic import relative to this module (Foundry supports it).
  // This requires module.json to allow module scripts, but is harmless if it fails.
  try {
    // eslint-disable-next-line no-undef
    import(`./scripts/api.gm.js`).then(function () {
      if (globalThis.BBTTCC_GM_API && typeof globalThis.BBTTCC_GM_API.install === "function") {
        try {
          globalThis.BBTTCC_GM_API.install(game.bbttcc);
          _log(`[${CORE_ID}] GM API installed (dynamic import)`);
        } catch (e2) {
          _warn(`[${CORE_ID}] GM API install after import failed`, e2);
        }
      } else {
        _warn(`[${CORE_ID}] GM API import succeeded but installer missing`);
      }
    }).catch(function (e) {
      _warn(`[${CORE_ID}] GM API dynamic import failed (ok if not yet wired in module.json)`, e);
    });
  } catch (e) {
    _warn(`[${CORE_ID}] GM API dynamic import not available`, e);
  }
}

Hooks.once("init", function () {
  _ensureRoot();
  _registerSettings();
  _log(`[${CORE_ID}] init`);
});

Hooks.once("ready", function () {
  _installGMApi();
  _log(`[${CORE_ID}] ready`);
});
