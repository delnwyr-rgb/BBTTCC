// modules/bbttcc-core/scripts/alpha-cut.js
// ALPHA CUT (2026-10-17) — one world switch that hides Beta-only surfaces from PLAYER seats.
//
// The GM screen is never affected. Nothing is deleted or disabled: a hidden key just means the
// player-facing opener (tab, button, scene control, macro, wizard step) is not rendered.
//
// Ruling doc: Claude Doc "Bad Eden Alpha Cut" (2026-10-17) — the Shown / Trimmed / GM-only / Hidden table.
//
// API (game.bbttcc.alpha):
//   enabled()        → the world setting is on
//   active()         → enabled() && this seat is not a GM
//   hidden(key)      → active() && key not in the show-anyway list      ← modules call THIS
//   shown(key)       → !hidden(key)
//   keys             → { key: label } (the vocabulary; unknown keys are still honoured)
//   overrides()      → Set of keys forced visible via the "alphaCutShow" setting
//   refresh()        → re-apply the body class and re-render open windows
// Hook: "bbttcc:alpha:changed" ({ enabled, overrides }) after either setting changes.
// Body class: <body class="bbttcc-alpha"> on player seats while active (for CSS-only hides).
//
// Imported from bbttcc-ui-cleanup.enhancer.js so no module.json edit is needed (same pattern as
// scene-nav-folders.js).

const ID  = "bbttcc-core";
const TAG = "[bbttcc-core/alpha-cut]";

/** The vocabulary. Keys are stable strings; labels are for the settings hint and future GM panel. */
export const ALPHA_KEYS = Object.freeze({
  // Character side (system + auto-link + character-options)
  "crew":                "Crew (sheet section, wizard step, HUD)",
  "associations":        "Occult associations (sheet section, wizard step, pickers)",
  "manifestationWizard": "Manifestation wizard (players only author their Signatures — one slot per tier)",
  "sheetTabsExtra":      "Character sheet tabs beyond the Alpha three",
  "radiationApp":        "Radiation windows beyond the sheet chip",
  "tikkunApp":           "Tikkun / Sparks windows beyond the earned-spark card",
  "epic":                "Epic play (Tier 5)",
  // Strategic side
  "siege":               "Sieges (raid console tab, HUD, macros)",
  "raidDoors":           "Raid doors — the story opens the table (Domain ⚔ Raid, faction Open Raid, toolbar Raid; ruling 22)",
  "marketFacilities":    "Market: Facilities tab",
  "marketHexAssets":     "Market: Hex assets tab",
  "catalogEditor":       "Market: catalog editor",
  "coalitionBank":       "Banks: coalition bank",
  "facilityConsole":     "Facility console",
  "hexEdit":             "Hex map editing (sheet edit controls, create hex)",
  "travelHighTier":      "Travel tables above tier 1",
  "campaignTools":       "Campaign tools (beat builder, visualizer, editor, stage cues)",
  "advisors":            "Mal advisors (GM / faction / watcher)",
  "factionMetersExtra":  "Faction meters beyond the Alpha three"
});

function _get(key, fallback) {
  try { return game.settings.get(ID, key); } catch (_e) { return fallback; }
}

function enabled() { return _get("alphaCut", false) === true; }

function overrides() {
  const raw = String(_get("alphaCutShow", "") || "");
  return new Set(raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean));
}

function active() {
  if (!enabled()) return false;
  try { return !game.user?.isGM; } catch (_e) { return false; }
}

function hidden(key) {
  if (!active()) return false;
  if (overrides().has(String(key))) return false;
  return true;
}

function shown(key) { return !hidden(key); }

// cut(key) (2026-10-28): the CONTENT rule, not the screen — true whenever the Alpha Cut is on and the key isn't
// overridden, on EVERY seat, the GM's included. hidden() spares the GM screen on purpose (it's for surfaces); what a
// character is BUILT from must not depend on who sat at the wizard (a GM-built Bulwark got a crew + association the
// Alpha sheet then never showed, with their aptitudes and rerolls still live).
function cut(key) {
  if (!enabled()) return false;
  return !overrides().has(String(key));
}

function _applyBodyClass() {
  try { document.body.classList.toggle("bbttcc-alpha", active()); } catch (_e) {}
}

function _rerenderOpenWindows() {
  try {
    // AppV1 windows
    for (const app of Object.values(ui.windows || {})) {
      try { app.render(false); } catch (_e) {}
    }
    // AppV2 instances
    const inst = foundry?.applications?.instances;
    if (inst && typeof inst.forEach === "function") {
      inst.forEach(app => { try { app.render(false); } catch (_e) {} });
    }
    // Scene controls (v12/v13 both accept a bare render)
    try { ui.controls?.render(true); } catch (_e) {}
  } catch (_e) {}
}

function refresh() {
  _injectCss();
  _applyBodyClass();
  _rerenderOpenWindows();
  try { Hooks.callAll("bbttcc:alpha:changed", { enabled: enabled(), overrides: [...overrides()] }); } catch (_e) {}
}

/**
 * CSS-only hides, injected so the manifest stays untouched. Any element carrying
 * data-alpha-hide="<key>" vanishes on player seats while the cut is active, unless
 * that key is in the show-anyway list (the rule is rebuilt on every refresh so the
 * overrides hold for CSS hides too).
 */
function _buildCss() {
  const nots = [...overrides()].map(k => `:not([data-alpha-hide="${k.replace(/["\\]/g, "")}"])`).join("");
  return `
/* ALPHA CUT — player seats only (body.bbttcc-alpha). GM screens never carry this class. */
body.bbttcc-alpha [data-alpha-hide]${nots} { display: none !important; }
`;
}

function _injectCss() {
  try {
    let el = document.getElementById("bbttcc-alpha-cut-css");
    if (!el) {
      el = document.createElement("style");
      el.id = "bbttcc-alpha-cut-css";
      document.head.appendChild(el);
    }
    el.textContent = _buildCss();
  } catch (_e) {}
}

Hooks.once("init", () => {
  try {
    game.settings.register(ID, "alphaCut", {
      name: "Alpha Cut (hide Beta features from players)",
      hint: "When on, player seats do not see Beta-only surfaces: crew & associations, the manifestation wizard, sieges, facilities, the coalition bank, hex editing, high-tier travel, campaign tools, advisors and the extra sheet tabs. The GM screen is never affected.",
      scope: "world", config: true, type: Boolean, default: true,
      onChange: () => refresh()
    });
    game.settings.register(ID, "alphaCutShow", {
      name: "Alpha Cut: show anyway",
      hint: "Comma-separated keys to keep visible for players even while the Alpha Cut is on. Keys: " + Object.keys(ALPHA_KEYS).join(", ") + ".",
      scope: "world", config: true, type: String, default: "",
      onChange: () => refresh()
    });
  } catch (e) { console.warn(TAG, "settings registration failed", e); }

  game.bbttcc = game.bbttcc || {};
  game.bbttcc.alpha = { enabled, active, hidden, shown, cut, overrides, refresh, keys: ALPHA_KEYS };
});

Hooks.once("ready", () => {
  _injectCss();
  _applyBodyClass();
  console.log(TAG, active() ? "ACTIVE on this player seat" : (enabled() ? "on (GM seat, unaffected)" : "off"));
});
