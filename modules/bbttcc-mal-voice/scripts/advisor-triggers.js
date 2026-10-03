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
 *   Anthropic call on the GM's key; player seats relay through the GM):
 *   • bbttcc:scene:enter        emitted on scene activation (GM client only)
 *   • bbttcc:faction:sheetOpened emitted on the seat that opened a faction sheet it
 *     owns (once per open, 60s voice debounce), whispered to that seat + GMs
 *
 * bbttcc:faction:opChanged and bbttcc:raid:initiate stay unemitted for now —
 * opChanged is too noisy to pay for, and raid-initiate belongs to bbttcc-raid
 * when it wants to own that emit. Pre-raid advice = press the sheet button.
 */

const MOD = "bbttcc-mal-voice";
const TAG = "[mal-voice:advisor-triggers]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// GM seat: a key is set in this browser. Player seat: a GM is connected to
// relay through (the key lives on the GM's machine — owner ruling 2026-10-02).
function _keyConfigured() {
  try { return !!game.bbttcc?.mal?.settings?.canCall?.(); }
  catch { return false; }
}

function _fire(voiceId, hook, args = {}) {
  const triggers = game.bbttcc?.mal?.triggers;
  if (typeof triggers?.fire !== "function") {
    ui.notifications?.warn?.("Mal voice engine not loaded.");
    return null;
  }
  if (!_keyConfigured()) {
    if (game.user?.isGM) ui.notifications?.warn?.("No API key on this GM machine (Module Settings → AI Faction/GM Advisor → API key).");
    else ui.notifications?.info?.("The Advisor's line is dead — advisors speak through the GM's seat, and no GM is connected.");
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
// Skip the world-load canvasReady only if it hasn't fired yet. _install runs at
// `ready`, usually AFTER that first canvasReady — so start armed when the canvas
// is already up, else the first REAL scene change was swallowed.
let _sceneEnterArmed = false;
const _openFactionSheets = new Set(); // ambient sheetOpened fires once per open

function _ambientOn() {
  try { return game.settings.get(MOD, "advisorAmbient") === true; }
  catch { return false; }
}

function _install() {
  try {
    game.settings.register(MOD, "advisorAmbient", {
      name: "Ambient advisor triggers",
      hint: "When on, the GM Advisor fires on scene changes and the Faction Advisor on faction-sheet opens — whispered to whoever opened the sheet (60s debounce). Every fire is one real API call on the GM's key (player seats relay through the connected GM). Manual consults (the 🕯 Advisor button, game.bbttcc.mal.advisors.*) work regardless.",
      scope: "world", config: true, type: Boolean, default: false
    });
  } catch (_e) { /* already registered */ }

  game.bbttcc ??= {};
  game.bbttcc.mal ??= {};
  game.bbttcc.mal.advisors = { gm: consultGM, faction: consultFaction };

  Hooks.on("renderBBTTCCFactionSheet", _injectAdvisorButton);
  Hooks.on("renderActorSheet", _injectAdvisorButton);

  _sceneEnterArmed = !!globalThis.canvas?.ready;

  Hooks.on("canvasReady", () => {
    if (!_sceneEnterArmed) { _sceneEnterArmed = true; return; }
    if (!_ambientOn() || !game.user?.isGM || !_keyConfigured()) return;
    try {
      Hooks.callAll("bbttcc:scene:enter", { sceneId: canvas?.scene?.id, sceneName: canvas?.scene?.name });
    } catch (_e) {}
  });

  Hooks.on("closeBBTTCCFactionSheet", (app) => { _openFactionSheets.delete(app?.appId ?? app?.id); });
  Hooks.on("renderBBTTCCFactionSheet", (app, _html, _ctx, options) => {
    if (!_ambientOn() || !_keyConfigured()) return;
    // An OPEN, not every re-render (actor updates re-render open sheets). The
    // faction sheet is a v1 ActorSheet (no isFirstRender) — track open app ids.
    if (options?.isFirstRender === false) return;
    const appKey = app?.appId ?? app?.id;
    if (appKey != null) { if (_openFactionSheets.has(appKey)) return; _openFactionSheets.add(appKey); }
    const actor = app?.actor ?? app?.document;
    if (!actor?.getFlag?.("bbttcc-factions", "isFaction")) return;
    // Owner ruling 2026-10-02: the advisor speaks to WHOEVER opened the sheet,
    // on that seat (this render hook only runs on the opening client — once
    // per open via _openFactionSheets). A player's call relays through the GM's
    // key. Observers who don't own the faction get no advisor.
    if (!(game.user?.isGM || actor.isOwner)) return;
    try {
      Hooks.callAll("bbttcc:faction:sheetOpened", { factionId: actor.id, userId: game.user.id });
    } catch (_e) {}
  });

  log("Advisor triggers installed (manual always; ambient =", _ambientOn(), ").");
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
