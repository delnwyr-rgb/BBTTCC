/* bbttcc-mal-voice/scripts/advisor-triggers.js
 * Advisor trigger wiring (2026-08-28, atlas dormant #17).
 *
 * The GM Advisor and Faction Advisor voices declared trigger hooks that nothing
 * emitted, so they only ever fired via smoketest. This file gives them:
 *
 *   ALWAYS ON (manual, zero ambient cost):
 *   • game.bbttcc.mal.advisors.gm({mode})       — consult the GM Advisor now
 *   • game.bbttcc.mal.advisors.faction(id)      — consult a faction's Advisor now
 *   • a "🕯 Advisor" button on the faction sheet (GM + faction owners)
 *
 *   OPT-IN (world setting "advisorAmbient", DEFAULT OFF — every fire is a real
 *   Anthropic call on the world's key):
 *   • bbttcc:scene:enter        emitted on scene activation (GM client only)
 *   • bbttcc:faction:sheetOpened emitted when a faction sheet opens (60s voice debounce)
 *
 * bbttcc:faction:opChanged and bbttcc:raid:initiate stay unemitted for now —
 * opChanged is too noisy to pay for, and raid-initiate belongs to bbttcc-raid
 * when it wants to own that emit. Pre-raid advice = press the sheet button.
 */

const MOD = "bbttcc-mal-voice";
const TAG = "[mal-voice:advisor-triggers]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

function _keyConfigured() {
  try { return !!String(game.settings.get(MOD, "apiKey") || "").trim(); }
  catch { return false; }
}

function _fire(voiceId, hook, args = {}) {
  const triggers = game.bbttcc?.mal?.triggers;
  if (typeof triggers?.fire !== "function") {
    ui.notifications?.warn?.("Mal voice engine not loaded.");
    return null;
  }
  if (!_keyConfigured()) {
    ui.notifications?.warn?.("No API key configured (module settings → Bad Eden AI Voice).");
    return null;
  }
  return triggers.fire(voiceId, { hook, args });
}

/* ── Manual consult API ────────────────────────────────────────────────────── */
function consultGM({ mode = "free" } = {}) {
  return _fire("gm-advisor", "bbttcc:gm:advise", { mode });
}

function consultFaction(factionId) {
  if (!factionId) return void ui.notifications?.warn?.("consultFaction: factionId required.");
  // "manual" is deliberately NOT a declared trigger hook — undeclared hooks skip
  // the per-hook debounce, so a button press never loses to the ambient 60s window.
  return _fire("faction-advisor", "manual", { factionId, manual: true });
}

/* ── Faction sheet button ──────────────────────────────────────────────────── */
function _injectAdvisorButton(app, html) {
  try {
    const actor = app?.actor ?? app?.document;
    if (!actor?.getFlag?.("bbttcc-factions", "isFaction")) return;
    if (!(game.user?.isGM || actor.isOwner)) return;
    const $html = html instanceof jQuery ? html : $(html);
    if ($html.find(".bbttcc-advisor-btn").length) return;
    const header = $html.find(".window-header .window-title").first();
    if (!header.length) return;
    const btn = $(`<a class="bbttcc-advisor-btn" title="Consult this faction's Advisor (one AI call)" style="margin-left:8px; flex:0;">🕯 Advisor</a>`);
    btn.on("click", (ev) => { ev.preventDefault(); consultFaction(actor.id); });
    header.after(btn);
  } catch (_e) { /* never break a sheet render */ }
}

/* ── Ambient emitters (opt-in) ─────────────────────────────────────────────── */
let _sceneEnterArmed = false; // skip the initial canvasReady at world load

function _ambientOn() {
  try { return game.settings.get(MOD, "advisorAmbient") === true; }
  catch { return false; }
}

function _install() {
  try {
    game.settings.register(MOD, "advisorAmbient", {
      name: "Ambient advisor triggers",
      hint: "When on, the GM Advisor fires on scene changes and the Faction Advisor on faction-sheet opens (60s debounce). Every fire is one real API call on this world's key. Manual consults (the 🕯 Advisor button, game.bbttcc.mal.advisors.*) work regardless.",
      scope: "world", config: true, type: Boolean, default: false
    });
  } catch (_e) { /* already registered */ }

  game.bbttcc ??= {};
  game.bbttcc.mal ??= {};
  game.bbttcc.mal.advisors = { gm: consultGM, faction: consultFaction };

  Hooks.on("renderBBTTCCFactionSheet", _injectAdvisorButton);
  Hooks.on("renderActorSheet", _injectAdvisorButton);

  Hooks.on("canvasReady", () => {
    if (!_sceneEnterArmed) { _sceneEnterArmed = true; return; }
    if (!_ambientOn() || !game.user?.isGM || !_keyConfigured()) return;
    try {
      Hooks.callAll("bbttcc:scene:enter", { sceneId: canvas?.scene?.id, sceneName: canvas?.scene?.name });
    } catch (_e) {}
  });

  Hooks.on("renderBBTTCCFactionSheet", (app) => {
    if (!_ambientOn() || !_keyConfigured()) return;
    const actor = app?.actor ?? app?.document;
    if (!actor?.getFlag?.("bbttcc-factions", "isFaction")) return;
    if (!(game.user?.isGM || actor.isOwner)) return;
    try {
      Hooks.callAll("bbttcc:faction:sheetOpened", { factionId: actor.id });
    } catch (_e) {}
  });

  log("Advisor triggers installed (manual always; ambient =", _ambientOn(), ").");
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
