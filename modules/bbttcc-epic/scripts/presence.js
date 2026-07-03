// modules/bbttcc-epic/scripts/presence.js
// Bad Eden — Epic Play · P2: THE PRESENCE METER
// Per-Steward Presence, born at Convergence (P1's `bbttcc:epic:converged` hook), pooling
// to a faction "party total". Two-sided: the party total = REACH (capacity to repair the
// world, gated in P3); the single highest unmasked Steward = WEIGHT (who Yaldabaoth hunts,
// consequenced in P4). Masking sheds Weight at the cost of Reach — the intrinsic trade.
//
// SCOPE: meter + pooling + masking + bands + API + `bbttcc:epic:presence:changed` hook +
// read-only displays. Accrual here = convergence-seed + manual GM adjust ONLY; auto-accrual
// from acts of repair = P3, Adversary/hunt consequences = P4.
// DESIGN: EPIC_P2_SPEC.md (v1.0). RFI-only (guarded via the shared system check).

const MOD = "bbttcc-epic";
const FCT = "bbttcc-factions";
const NS  = "[bbttcc-epic/presence]";
const warn = (...a) => console.warn(NS, ...a);
const log  = (...a) => console.log(NS, ...a);

// ── OWNER-TUNABLE ────────────────────────────────────────────────────────────────
// Seed granted the instant a Steward Converges (non-zero so the meter reads "you matter
// now"). Band breakpoints are on the ABSOLUTE party total (party size is a tuning dial —
// a larger fellowship of ascended bodhisattvas IS more significant). Tune after playtest.
const BASE_PRESENCE = 2;
function presenceFactor(total) {
  const t = Number(total) || 0;
  if (t >= 20) return { key: "apex", label: "Apex — the Sitra Achra moves openly" };
  if (t >= 12) return { key: "high", label: "High — named horrors wake and hunt" };
  if (t >= 6)  return { key: "mid",  label: "Mid — factions coordinate against you" };
  return             { key: "low",  label: "Low — the world stirs" };
}

function ftActive() { return game?.system?.id === "fourththing"; }
function isConvergedFlag(actor) { return !!actor?.getFlag?.(MOD, "converged")?.value; }
export function getPresence(actor) { return actor?.getFlag?.(MOD, "presence") ?? null; }
export function isMasked(actor) { return !!getPresence(actor)?.masked; }

function factionOf(actor) {
  const id = actor?.getFlag?.(FCT, "factionId");
  return id ? (game.actors?.get(id) ?? null) : null;
}
function membersOf(faction) {
  return (game.actors?.contents ?? []).filter(a =>
    a.type === "character" &&
    a.getFlag(FCT, "factionId") === faction.id &&
    a.getFlag(MOD, "converged")?.value);
}

// Single source of truth for the pool. total & hunted EXCLUDE masked members; count = all
// converged members (masked or not).
function computeParty(faction) {
  if (!faction) return { total: 0, huntedId: null, band: presenceFactor(0).key, count: 0 };
  const members = membersOf(faction);
  let total = 0, huntedId = null, huntedVal = -1;
  for (const m of members) {
    const p = m.getFlag(MOD, "presence");
    if (!p || p.masked) continue;
    const v = Number(p.value) || 0;
    total += v;
    if (v > huntedVal) { huntedVal = v; huntedId = m.id; }
  }
  return { total, huntedId, band: presenceFactor(total).key, count: members.length };
}

// ── Party aggregation — mirror of enlightenment.js syncFactionLevel ────────────────
const _flocks = new Map();
export async function syncFactionPresence(actor) {
  const faction = factionOf(actor);
  if (!faction) return;
  const prev = _flocks.get(faction.id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => _syncFactionPresence(faction));
  _flocks.set(faction.id, next);
  try { await next; } finally { if (_flocks.get(faction.id) === next) _flocks.delete(faction.id); }
}
async function _syncFactionPresence(faction) {
  try {
    if (!faction.isOwner) return; // only a client that can write the faction does so
    const party = computeParty(faction);
    const cur = faction.getFlag(MOD, "presenceParty");
    if (cur && cur.total === party.total && cur.huntedId === party.huntedId &&
        cur.band === party.band && cur.count === party.count) return;
    await faction.setFlag(MOD, "presenceParty", party);
  } catch (e) { warn("faction presence sync failed", e); }
}

// ── Reads (API) ────────────────────────────────────────────────────────────────────
export function partyTotal(ref) {
  const faction = ref?.type === "character" ? factionOf(ref) : ref;
  if (!faction) { // solo Steward, no faction
    const p = ref?.getFlag?.(MOD, "presence");
    return (p && !p.masked) ? (Number(p.value) || 0) : 0;
  }
  return computeParty(faction).total;
}
export function hunted(ref) {
  const faction = ref?.type === "character" ? factionOf(ref) : ref;
  if (!faction) return null;
  const id = computeParty(faction).huntedId;
  return id ? (game.actors?.get(id) ?? null) : null;
}
export function band(ref) { return presenceFactor(partyTotal(ref)); }

// ── Writes (API) ─────────────────────────────────────────────────────────────────
const _alocks = new Map();
function _lockActor(actor, fn) {
  const prev = _alocks.get(actor.id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  _alocks.set(actor.id, next);
  return next.finally(() => { if (_alocks.get(actor.id) === next) _alocks.delete(actor.id); });
}
async function _write(actor, value, masked, delta, reason) {
  await actor.setFlag(MOD, "presence", { value: Math.max(0, Number(value) || 0), masked: !!masked });
  try { Hooks.callAll("bbttcc:epic:presence:changed", actor, { value: Math.max(0, Number(value) || 0), delta, reason }); }
  catch (e) { warn("presence:changed dispatch failed", e); }
  await syncFactionPresence(actor);
}
export async function adjust(actor, delta, reason = "") {
  if (!ftActive() || !actor) return null;
  if (!isConvergedFlag(actor)) { warn(`adjust on non-converged ${actor?.name} ignored`); return null; }
  return _lockActor(actor, async () => {
    const p = getPresence(actor) ?? { value: 0, masked: false };
    const value = Math.max(0, (Number(p.value) || 0) + (Number(delta) || 0));
    await _write(actor, value, p.masked, Number(delta) || 0, reason);
    return value;
  });
}
export async function set(actor, value, reason = "") {
  if (!ftActive() || !actor) return null;
  if (!isConvergedFlag(actor)) { warn(`set on non-converged ${actor?.name} ignored`); return null; }
  return _lockActor(actor, async () => {
    const p = getPresence(actor) ?? { value: 0, masked: false };
    const v = Math.max(0, Number(value) || 0);
    await _write(actor, v, p.masked, v - (Number(p.value) || 0), reason);
    return v;
  });
}
async function _setMask(actor, masked) {
  if (!ftActive() || !actor || !isConvergedFlag(actor)) return;
  return _lockActor(actor, async () => {
    const p = getPresence(actor) ?? { value: 0, masked: false };
    if (!!p.masked === masked) return;
    await _write(actor, p.value, masked, 0, masked ? "masked" : "unmasked");
  });
}
export async function mask(actor)   { return _setMask(actor, true); }
export async function unmask(actor) { return _setMask(actor, false); }

// Called by P1's resetConvergence — un-remembering who you are drops your Weight.
export async function clearPresence(actor) {
  try {
    if (actor?.getFlag?.(MOD, "presence")) await actor.unsetFlag(MOD, "presence");
    await syncFactionPresence(actor);
  } catch (e) { warn("clearPresence failed", e); }
}

// Seed on Convergence (idempotent — never resets a grown meter).
async function seedOnConverge(actor) {
  if (!ftActive() || !isConvergedFlag(actor)) return;
  try {
    if (!getPresence(actor)) await actor.setFlag(MOD, "presence", { value: BASE_PRESENCE, masked: false });
    await syncFactionPresence(actor);
  } catch (e) { warn("seed failed", e); }
}

// ── Display helpers (consumed by epic-gate.js Ascension panel) ─────────────────────
export function buildPresenceRows(actor) {
  if (!isConvergedFlag(actor)) return "";
  const p = getPresence(actor) ?? { value: 0, masked: false };
  const masked = !!p.masked;
  const faction = factionOf(actor);
  const party = faction ? computeParty(faction) : null;
  const total = party ? party.total : (masked ? 0 : (Number(p.value) || 0));
  const bandInfo = presenceFactor(total);
  const amHunted = !!party && party.huntedId === actor.id;

  let html = `<div class="bbttcc-epic-presence">
      <span class="be-pr-label">Presence</span>
      <span class="be-pr-val ${masked ? "is-masked" : ""}">${masked ? "MASKED" : (Number(p.value) || 0)}</span>
      <button type="button" class="bbttcc-epic-mask-btn" data-actor="${actor.id}" title="${masked ? "Step back into the light (restores Reach + Weight)" : "Work in shadow — shed Weight, lose Reach"}">${masked ? "Unmask" : "Mask"}</button>
    </div>`;

  if (game.user?.isGM && party) {
    const huntedName = party.huntedId ? (game.actors?.get(party.huntedId)?.name ?? "—") : "— none —";
    html += `<div class="bbttcc-epic-party">
        <span class="be-pr-label">Party</span>
        <span class="be-pr-val">${party.total}</span>
        <span class="be-pr-band be-band-${bandInfo.key}">${bandInfo.label}</span>
        <span class="be-pr-hunted ${amHunted ? "is-me" : ""}">🎯 ${huntedName}</span>
      </div>`;
  }
  return html;
}
export function wirePresenceButtons(root, actor) {
  try {
    const $root = root?.jquery ? root : $(root);
    $root.find(".bbttcc-epic-mask-btn").off("click.bbepic").on("click.bbepic", async (ev) => {
      ev.preventDefault();
      if (isMasked(actor)) await unmask(actor); else await mask(actor);
    });
  } catch (_e) {}
}

// ── Faction-sheet chip (self-identifying: only factions carry presenceParty) ───────
function $wrap(html) {
  try { return (typeof jQuery !== "undefined" && html instanceof jQuery) ? html : $(html); }
  catch (_e) { return null; }
}
function injectFactionChip(app, html) {
  try {
    if (!ftActive()) return;
    const actor = app?.actor;
    const party = actor?.getFlag?.(MOD, "presenceParty");
    if (!party) return; // characters + non-epic factions have none
    const $html = $wrap(html); if (!$html || !$html.length) return;
    // Land INSIDE the sheet's content, never on the app root: AppV2 hands the
    // whole window element to the render hook, and prepending to it put the
    // chip ABOVE the title bar where the frame's layout stretched it into a
    // giant empty banner (owner hit this on faction sheets 2026-07-03).
    let target = $html.find(".sheet-body").first();
    if (!target.length) target = $html.find(".window-content").first();
    if (!target.length) target = $html.hasClass("window-content") ? $html : null;
    if (!target || !target.length) return;
    $html.find("#bbttcc-epic-faction-presence").remove();
    const bandInfo = presenceFactor(party.total);
    const huntedName = party.huntedId ? (game.actors?.get(party.huntedId)?.name ?? "—") : "— none —";
    const chip = $(`
      <section id="bbttcc-epic-faction-presence" class="bbttcc-epic-faction-presence" style="flex:0 0 auto;align-self:stretch;">
        <span class="be-pr-label">Presence</span>
        <span class="be-pr-val">${party.total}</span>
        <span class="be-pr-band be-band-${bandInfo.key}">${bandInfo.label}</span>
        <span class="be-pr-hunted">🎯 ${huntedName}</span>
        <small class="be-pr-count">${party.count} converged</small>
      </section>`);
    target.prepend(chip);
  } catch (_e) {}
}

// ── Hooks + API registration ───────────────────────────────────────────────────────
Hooks.on("bbttcc:epic:converged", async (actor) => { try { await seedOnConverge(actor); } catch (e) { warn("ignition failed", e); } });
Hooks.on("renderActorSheet",   (app, html) => { try { injectFactionChip(app, html); } catch (e) { warn("faction chip error", e); } });
Hooks.on("renderActorSheetV2", (app, html) => { try { injectFactionChip(app, html); } catch (e) { warn("faction chip v2 error", e); } });

Hooks.on("ready", async () => {
  try {
    if (!ftActive()) return;
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = game.fourththing.epic || {};
    game.fourththing.epic.presence = Object.assign(game.fourththing.epic.presence || {}, {
      get: getPresence, isMasked, adjust, set, mask, unmask,
      partyTotal, hunted, band, sync: syncFactionPresence,
    });

    // Back-fill sweep: recompute each converged member's faction once (values may have
    // drifted while offline / on another client). Single reconciler (active GM).
    const gm = game.users?.activeGM;
    if (gm && !gm.isSelf) { log("Presence ready (sweep deferred to active GM)."); return; }
    const done = new Set();
    for (const a of game.actors?.contents ?? []) {
      if (a.type !== "character" || !a.isOwner || !a.getFlag(MOD, "converged")?.value) continue;
      const f = factionOf(a); const key = f?.id ?? a.id;
      if (done.has(key)) continue; done.add(key);
      await syncFactionPresence(a);
    }
    log("Presence ready.");
  } catch (e) { warn("ready error", e); }
});
