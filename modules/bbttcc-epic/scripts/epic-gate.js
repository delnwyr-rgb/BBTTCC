// modules/bbttcc-epic/scripts/epic-gate.js
// Bad Eden — Epic Play · P1: THE GATE
// Per-Steward Convergence detection. When a Steward hits BOTH apexes at once —
// the Boiling-Point band (level >= 18) AND the enlightenment apex (`enlightened`,
// or `qliphothic` for the corrupt path) — their "mojo returns": we latch a flag,
// post a one-time beat, and fire `bbttcc:epic:converged` for later phases to build
// Presence / World-Health / capstones on top of.
//
// DESIGN: EPIC_PLAY_DESIGN.md (v0.2) + EPIC_P1_SPEC.md (v1.0).
// SCOPE: P1 is detection + a visible moment + a hook. NO powers (those are P5).
// RFI-ONLY: hard-gated to game.system.id === "fourththing" (see EPIC_PLAY_DESIGN §RFI).
//
// Why this touches ZERO system-core files: the existing tier system is welded to
// 1–4 (TIER_ROMAN has no slot 5), so Epic's "Tier 5" band is its OWN concept here,
// never routed through ft-progression.tierForLevel. 100% additive new module.

import { buildPresenceRows, wirePresenceButtons, clearPresence } from "./presence.js";
import { worldHealth } from "./repair.js";

const MOD = "bbttcc-epic";
const ENL = "bbttcc-character-options"; // owner of the enlightenment flag we read
const NS  = "[bbttcc-epic]";
const log  = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

// ─── System gate ────────────────────────────────────────────────────────────────
// Epic is an RFI-exclusive selling point — 5E/Foundry hard-cap at level 20, so the
// L18–30 band can't exist there. Do nothing on any non-fourththing system.
function ftActive() { return game?.system?.id === "fourththing"; }

// ─── Epic band (NOT the feat-gating tier) ────────────────────────────────────────
// boiling = Act I climax (L18–20); ascent = Act II (L21–30), reserved for release 2.
export function epicBand(level) {
  const L = Number(level) || 0;
  if (L >= 21) return "ascent";
  if (L >= 18) return "boiling";
  return null;
}

// ─── Reads ───────────────────────────────────────────────────────────────────────
// Defensive double-system read, matching systems/fourththing/ft-progression.js:1054.
function readLevel(actor) {
  const sys = actor?.system?.system ?? actor?.system;
  return Number(sys?.details?.level ?? 1) || 1;
}
function readEnlightenment(actor) {
  return actor?.getFlag?.(ENL, "enlightenment")?.level ?? "unawakened";
}

// ─── Convergence ─────────────────────────────────────────────────────────────────
export function computeConvergence(actor) {
  const level = readLevel(actor);
  const enl   = readEnlightenment(actor);
  const inBand   = level >= 18;                                  // Boiling-Point band
  const isBright = enl === "enlightened";                        // soul apex (bright)
  const isCorrupt = enl === "qliphothic";                        // soul apex (corrupt)
  const soulApex = isBright || isCorrupt;
  const converged = inBand && soulApex;
  const path = isCorrupt ? "thaumiel" : "keter";
  return { level, enl, inBand, isBright, isCorrupt, soulApex, converged, path, band: epicBand(level) };
}

export function isConverged(actor) {
  return !!actor?.getFlag?.(MOD, "converged")?.value;
}
export function convergencePath(actor) {
  return actor?.getFlag?.(MOD, "converged")?.path ?? null;
}

// Serialize per-actor evaluation so rapid updateActor bursts can't double-latch.
const _locks = new Map();
async function evaluate(actor) {
  if (!ftActive() || !actor || actor.type !== "character") return;
  const prev = _locks.get(actor.id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => _evaluate(actor));
  _locks.set(actor.id, next);
  try { await next; } finally { if (_locks.get(actor.id) === next) _locks.delete(actor.id); }
}

async function _evaluate(actor) {
  const latched = actor.getFlag(MOD, "converged");
  if (latched?.value) return;                       // latch: once true, never re-fires

  const c = computeConvergence(actor);
  if (!c.converged) return;

  try {
    // Claim the latch FIRST (race-safe) so the beat fires exactly once.
    await actor.setFlag(MOD, "converged", { value: true, path: c.path, atLevel: c.level, ts: Date.now() });
  } catch (e) { warn("failed to set converged flag", e); return; }

  try { await postBeat(actor, c.path); } catch (e) { warn("beat failed", e); }
  try { Hooks.callAll("bbttcc:epic:converged", actor, { path: c.path, level: c.level }); }
  catch (e) { warn("hook dispatch failed", e); }
  log(`${actor.name} CONVERGED — path: ${c.path} @ L${c.level}`);
}

// GM escape hatch — convergence is sticky by design ("you don't un-remember who you
// were"), but a GM can clear it after a respec / mistaken trigger.
export async function resetConvergence(actor) {
  if (!actor) return;
  try {
    await actor.unsetFlag(MOD, "converged");
    await clearPresence(actor); // un-remembering who you are drops your Weight from the world (P2)
    log(`reset convergence on ${actor.name}`);
  } catch (e) { warn("reset failed", e); }
}

// ─── The "mojo returns" beat ─────────────────────────────────────────────────────
async function postBeat(actor, path) {
  const keter = path === "keter";
  const title = keter ? "✦ THE MOJO RETURNS ✦" : "† THE FALSE CROWN †";
  const body = keter
    ? `<strong>${actor.name}</strong> remembers. Across every lifetime the full self floods back at once — the bodhisattva, awake and entire. <em>The Crown is within reach.</em>`
    : `<strong>${actor.name}</strong> reaches the apex along the broken path — power without redemption. The two contending heads stir. <em>The false crown beckons.</em>`;
  const content = `
    <div class="bbttcc-epic-beat ${keter ? "is-keter" : "is-thaumiel"}">
      <div class="bbttcc-epic-beat-title">${title}</div>
      <div class="bbttcc-epic-beat-body">${body}</div>
      <div class="bbttcc-epic-beat-foot">Convergence — Tier 5 (Boiling Point) &amp; the apex of Enlightenment. Bad Eden · Epic Play</div>
    </div>`;

  const data = { content, speaker: ChatMessage.getSpeaker({ actor }) };
  // Keter is a table milestone (public); Thaumiel stays a GM secret until it shows.
  if (!keter) data.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  await ChatMessage.create(data);
}

// ─── Sheet readout — the "Ascension" panel ───────────────────────────────────────
// Injected via renderActorSheet (mirrors enlightenment.js decorateSheet — no system
// template edit). P1 shows the INNER (personal) gate only; the OUTER Malkuth (% hexes
// aligned) is a placeholder until P3 (World-Health).
function $wrap(html) {
  // Robust against both jQuery (V1 sheets) and raw HTMLElement (ApplicationV2).
  try { return (typeof jQuery !== "undefined" && html instanceof jQuery) ? html : $(html); }
  catch (_e) { return null; }
}
function axisRow(label, ok, note) {
  const mark = ok ? `<span class="be-ok">✓</span>` : `<span class="be-no">✗</span>`;
  return `<div class="bbttcc-epic-axis">${mark}<span class="be-axis-label">${label}</span>${note ? `<span class="be-axis-note">${note}</span>` : ""}</div>`;
}
function decorateSheet(app, html) {
  try {
    if (!ftActive()) return;
    const actor = app?.actor;
    if (!actor || actor.type !== "character") return;
    const $html = $wrap(html);
    if (!$html || !$html.length) return;

    const c = computeConvergence(actor);
    const latched = actor.getFlag(MOD, "converged");
    const converged = !!latched?.value;
    const path = (latched?.path ?? c.path);

    const target = $html.find(".sheet-body").first().length ? $html.find(".sheet-body").first() : $html;
    if (!target.length) return;
    target.find("#bbttcc-epic-ascension").remove();

    const statusLine = converged
      ? `<div class="bbttcc-epic-status ${path === "keter" ? "is-keter" : "is-thaumiel"}">── CONVERGED · ${path.toUpperCase()} ──</div>`
      : `<div class="bbttcc-epic-status is-pending">Not yet converged</div>`;

    // P3: the Outer Malkuth axis is now live (% of hexes reunified & aligned; ✓ at 100%).
    let wh = null;
    try { wh = worldHealth(); } catch (_e) {}
    const outerNote = (wh && wh.total) ? `${wh.pct}% · ${wh.aligned}/${wh.total} hexes` : "— no hexes —";
    const outerOk = !!(wh && wh.total && wh.pct >= 100);

    const rows = [
      axisRow(`Boiling-Point band (L18+)`, c.inBand, `Lvl ${c.level}${c.inBand ? " · in band" : " · need 18"}`),
      axisRow(`Soul apex (Enlightened)`, c.soulApex, c.soulApex ? (c.isCorrupt ? "qliphothic path" : "") : `current: ${titleCase(c.enl)}`),
      axisRow(`Outer Malkuth (world)`, outerOk, outerNote),
    ].join("");

    // P2: Presence chip (+ GM party line) — empty string until the Steward is Converged.
    const presenceRows = buildPresenceRows(actor);

    const panel = $(`
      <section id="bbttcc-epic-ascension" class="bbttcc-epic-ascension">
        <div class="bbttcc-epic-head"><strong>Ascension</strong><small>The Gate · Bad Eden</small></div>
        ${statusLine}
        <div class="bbttcc-epic-axes">${rows}</div>
        ${presenceRows ? `<div class="bbttcc-epic-presence-wrap">${presenceRows}</div>` : ""}
      </section>
    `);
    target.prepend(panel);
    if (presenceRows) wirePresenceButtons(panel, actor);
  } catch (_e) { /* never break a sheet render */ }
}

function titleCase(s) {
  s = String(s || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
}

// ─── Hooks + API ─────────────────────────────────────────────────────────────────
Hooks.on("updateActor", async (actor, changes, _opts, userId) => {
  try {
    if (!ftActive() || actor?.type !== "character") return;
    if (userId !== game.user?.id) return;                 // single writer = the editing user
    if (!actor.isOwner) return;
    const u = foundry.utils;
    const touched = u.hasProperty(changes, "system.details.level")
                 || u.hasProperty(changes, `flags.${ENL}.enlightenment`);
    if (!touched) return;                                 // ignore unrelated updates (incl. our own latch flag)
    await evaluate(actor);
  } catch (e) { warn("updateActor handler error", e); }
});

Hooks.on("renderActorSheet", (app, html) => { try { decorateSheet(app, html); } catch (e) { warn("decorateSheet error", e); } });
// Defensive: some V2 sheets emit the V2-suffixed hook instead. The panel de-dupes itself.
Hooks.on("renderActorSheetV2", (app, html) => { try { decorateSheet(app, html); } catch (e) { warn("decorateSheetV2 error", e); } });

Hooks.on("ready", async () => {
  try {
    if (!ftActive()) { log("not fourththing — Epic dormant."); return; }
    // Expose the API surface (create the namespace if the system hasn't yet).
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = Object.assign(game.fourththing.epic || {}, {
      isConverged, convergencePath, computeConvergence, epicBand, evaluate, resetConvergence,
    });

    // One-time back-fill sweep: catch Stewards already at the apex before this module
    // existed. Single reconciler (active GM) to avoid every client racing on setFlag.
    const gm = game.users?.activeGM;
    if (gm && !gm.isSelf) { log("Epic Gate ready (sweep deferred to active GM)."); return; }
    for (const a of game.actors?.contents ?? []) {
      if (a.type === "character" && a.isOwner) await evaluate(a);
    }
    log("Epic Gate ready.");
  } catch (e) { warn("ready error", e); }
});
