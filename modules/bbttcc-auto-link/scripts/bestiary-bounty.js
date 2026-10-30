/* Bad Eden Auto-Link — Bestiary Bounty engine (2026-09-04)
 *
 * Pays a faction for RESOLVING a bestiary creature. One event, one listener,
 * per the engine retrospective:
 *
 *   Hooks.callAll("bbttcc:bestiary:resolved", payload)   ← the spine
 *   game.bbttcc.api.bestiary.resolve(actor, {method, factionId})  ← the authority
 *
 * The bounty (flags.fourththing.rfi.actor.price.bounty, or computed from
 * tier × bracket via computeCreaturePricing) is credited to the OP pool that
 * matches HOW the creature was resolved — not to a fixed reward pool:
 *
 *   kill      → violence      talkdown → nonlethal    parley  → diplomacy
 *   capture   → intrigue      cleanse  → softpower    rite    → faith
 *
 * This is the lever that makes mercy and rite economically real without a
 * separate reward table. Credits are CLAMPED to the bucket cap (the OP
 * engine would otherwise refuse the whole commit); overflow is reported as
 * lost to the cap. A creature pays once — the resolution is stamped on it.
 *
 * Surfaces:
 *   • Auto-offer: when a lineage-flagged NPC's Integrity drops to 0 the
 *     primary GM gets a whispered card with a faction picker and the six
 *     method buttons. (preUpdateActor stashes the prior value so the card
 *     fires on the crossing, not on every later tick.)
 *   • Manual: game.bbttcc.api.bestiary.offer(actor) posts the same card any
 *     time (talk-downs never drop Integrity), and .resolve() credits directly.
 *
 * Loaded via `import "./bestiary-bounty.js"` from monster-builder.js so no
 * manifest edit (and no cache-bust ceremony) was needed.
 */

const MOD = "bbttcc-auto-link";
const NS  = `${MOD}/bestiary-bounty`;

export const METHODS = {
  kill:     { pool: "violence",  label: "Killed",             verb: "killed" },
  talkdown: { pool: "nonlethal", label: "Talked down",        verb: "talked down" },
  parley:   { pool: "diplomacy", label: "Parleyed",           verb: "parleyed with" },
  capture:  { pool: "intrigue",  label: "Captured",           verb: "captured" },
  cleanse:  { pool: "softpower", label: "Cleansed / banished", verb: "cleansed" },
  rite:     { pool: "faith",     label: "Laid to rest by rite", verb: "laid to rest" }
};

const _esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const _opFmt = (marks) => `${marks} marks`;

export function isBestiary(actor) {
  const a = actor?.flags?.fourththing?.rfi?.actor;
  return !!(a && (a.lineage || a.bestiary));
}

/* Bounty in marks for a creature: stamped price first, rubric second. */
export function bountyFor(actor) {
  const a = actor?.flags?.fourththing?.rfi?.actor ?? {};
  const stamped = Number(a.price?.bounty ?? a.price?.marks);
  if (Number.isFinite(stamped) && stamped > 0) return { marks: stamped, currency: a.price?.currency ?? "violence", source: "stamped" };
  const fn = game.fourththing?.pricing?.computeCreaturePricing;
  if (typeof fn === "function" && (a.tier || actor?.system?.tier)) {
    const p = fn({ tier: a.tier ?? actor.system.tier, bracket: a.bracket ?? "light", lineage: a.lineage ?? "" });
    return { marks: p.bounty, currency: p.currency, source: "rubric" };
  }
  return { marks: 0, currency: "violence", source: "none" };
}

export function listFactions() {
  return (game.actors?.contents ?? [])
    .filter(a => {
      try {
        const k = game.bbttcc?.api?.actorKind?.(a);
        if (k) return k === "faction";
        return !!(a.getFlag?.("bbttcc-factions", "isFaction") || a?.flags?.["bbttcc-factions"]?.isFaction);
      } catch { return false; }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ── Who fought (Dave 2026-10-30) ─────────────────────────────────────── */
// "We should just credit the domains of the stewards involved in the fight, rather than asking which domain vanquished
// it." The fighters = Stewards among the creature's combatants (or, out of combat, Stewards with a token on its scene);
// each one's domain is credited the full bounty. Read at the kill, while the combat still exists.
function _isSteward(a) {
  try { const k = game.bbttcc?.api?.actorKind?.(a); if (k) return k === "steward"; } catch (_e) {}
  return a?.type === "character" && !String(a?.flags?.["bbttcc-auto-link"]?.entityKind ?? "").trim();
}
function _fighterFactionIds(actor) {
  const out = [];
  const add = (a) => {
    if (!a || !_isSteward(a)) return;
    const fid = String(a.flags?.["bbttcc-factions"]?.factionId || "").replace(/^Actor\./, "");
    if (fid && game.actors?.get(fid) && !out.includes(fid)) out.push(fid);
  };
  try {
    const combat = _activeCombatOf(actor);
    if (combat) for (const cb of combat.combatants) add(cb.actor);
    else {
      const scene = actor?.token?.parent ?? actor?.getActiveTokens?.()[0]?.document?.parent ?? canvas?.scene ?? null;
      for (const t of scene?.tokens ?? []) add(t.actor);
    }
  } catch (e) { console.warn(`[${NS}] fighter lookup failed`, e); }
  return out;
}

/* ── Card ─────────────────────────────────────────────────────────────── */

// review P2 (2026-10-28): monster-builder actors are unlinked, so the creature that drops is a
// synthetic token actor whose uuid dies with its token. Freeze what the card and the credit need
// at kill/offer time so a deleted corpse token can still be posted and paid.
function _snapshot(actor, { fighters = null } = {}) {
  const a = actor?.flags?.fourththing?.rfi?.actor ?? {};
  return {
    uuid: actor.uuid, id: actor.id, name: actor.name, img: actor.img,
    fighterFactionIds: Array.isArray(fighters) ? fighters : _fighterFactionIds(actor),
    bounty: bountyFor(actor),
    title: a.title || "", lineage: a.lineage || "", subLineage: a.subLineage || "",
    tier: a.tier ?? null, bracket: a.bracket ?? ""
  };
}

function _cardHTML(snap, { factionId = "" } = {}) {
  const b = snap.bounty;
  const a = snap;
  const factions = listFactions();
  const fighters = (snap.fighterFactionIds || []).map(id => game.actors?.get(id)).filter(Boolean);
  const everyone = fighters.length ? `<option value="@fighters"${factionId ? "" : " selected"}>Everyone in the fight — ${_esc(fighters.map(f => f.name).join(", "))}</option>` : "";
  const opts = [everyone || '<option value="">— choose the faction that resolved it —</option>']
    .concat(factions.map(f => `<option value="${f.id}"${f.id === factionId ? " selected" : ""}>${fighters.length ? "Only " : ""}${_esc(f.name)}</option>`)).join("");
  const buttons = Object.entries(METHODS).map(([k, m]) =>
    `<button type="button" data-bbttcc-bounty-method="${k}" title="credits ${m.pool}" style="flex:1 1 45%; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.05rem; height:auto; line-height:1.15; white-space:normal; word-break:normal; overflow-wrap:normal; text-align:center; font-size:0.78rem; padding:0.3rem 0.4rem;"><span>${_esc(m.label)}</span><span style="opacity:0.7; font-size:0.72rem;">→ ${m.pool}</span></button>`).join("");
  return `
<div class="bbttcc-bounty-card" data-bbttcc-bounty-actor="${_esc(snap.uuid)}" style="border:1px solid rgba(46,170,94,0.6); border-radius:6px; padding:0.5rem;">
  <div style="display:flex; align-items:center; gap:0.5rem;">
    <img src="${_esc(snap.img)}" style="width:36px; height:36px; object-fit:cover; border:none;"/>
    <div><strong>${_esc(snap.name)}</strong><br/><span style="font-size:0.78rem; opacity:0.8;">${_esc(a.title || [a.lineage, a.subLineage].filter(Boolean).join(" · ") || "bestiary")} · T${_esc(a.tier ?? "?")} ${_esc(a.bracket ?? "")}</span></div>
  </div>
  <div style="margin-top:0.4rem; font-size:0.8rem;">Bounty <strong>${_opFmt(b.marks)}</strong>${b.source === "rubric" ? " <em>(rubric — no stamped price)</em>" : ""}. Credited to the pool that matches how it was resolved${fighters.length ? ", to each domain in the fight" : ""}.</div>
  <select data-bbttcc-bounty-faction style="width:100%; margin-top:0.4rem;">${opts}</select>
  <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.4rem;">${buttons}</div>
</div>`;
}

function _receiptHTML({ actor, rows, method, marks, pool }) {
  const m = METHODS[method];
  const names = rows.map(r => r.faction?.name ?? "A faction");
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "A faction");
  const lines = rows.map(r => `${_esc(r.faction?.name ?? "?")}: credited ${_opFmt(r.credited)}${r.lost > 0 ? `, <em>${_opFmt(r.lost)} lost to the cap</em>` : ""}`).join("<br/>");
  return `
<div class="bbttcc-bounty-receipt" style="border:1px solid rgba(46,170,94,0.6); border-radius:6px; padding:0.5rem;">
  <strong>${_esc(who)}</strong> ${_esc(m?.verb ?? "resolved")} <strong>${_esc(actor?.name ?? "the creature")}</strong>.<br/>
  <span style="font-size:0.8rem;">Bounty ${_opFmt(marks)} each → <strong>${_esc(pool)}</strong><br/>${lines}</span>
</div>`;
}

/* Post the offer card, whispered to GMs. Returns the ChatMessage. */
export async function offer(actor, { factionId = "", fighters = null } = {}) {
  if (!actor) return null;
  if (actor.flags?.fourththing?.rfi?.actor?.resolved) {
    ui.notifications?.info?.(`${actor.name} has already paid its bounty.`);
    return null;
  }
  return _postOffer(_snapshot(actor, { fighters }), { factionId });
}

function _postOffer(snap, { factionId = "" } = {}) {
  const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
  return ChatMessage.create({
    content: _cardHTML(snap, { factionId }),
    whisper: gmIds,
    speaker: { alias: "Bestiary" },
    flags: { [MOD]: { bountyOffer: { actorUuid: snap.uuid, snapshot: snap } } }
  });
}

/* ── The authority ────────────────────────────────────────────────────── */

export async function resolve(actorOrUuid, { method = "kill", factionId, factionIds = null, marks = null, messageId = null, snapshot = null } = {}) {
  if (!game.user.isGM) { ui.notifications?.warn?.("Bounties are GM work."); return { ok: false, reason: "not-gm" }; }
  let actor = actorOrUuid;
  if (typeof actorOrUuid === "string") { try { actor = await fromUuid(actorOrUuid); } catch (_e) { actor = null; } }
  // review P2 (2026-10-28): token gone → pay from the card's snapshot (nothing to stamp).
  const snap = actor ? null : (snapshot?.uuid ? snapshot : null);
  if (!actor && !snap) { ui.notifications?.warn?.("That creature is gone (its token was deleted) and the card has no snapshot — credit it by hand with api.bestiary.resolve(..., { marks })."); return { ok: false, reason: "no-actor" }; }
  const m = METHODS[method]; if (!m) return { ok: false, reason: "bad-method" };
  // "@fighters" (the card's default, 2026-10-30) = every domain with a Steward in the fight; factionIds = an explicit list
  let ids = Array.isArray(factionIds) && factionIds.length ? factionIds
    : factionId === "@fighters" ? (snapshot?.fighterFactionIds?.length ? snapshot.fighterFactionIds : (actor ? _fighterFactionIds(actor) : []))
    : (factionId ? [factionId] : []);
  const factions = [...new Set(ids.map(String))].map(id => game.actors.get(id)).filter(Boolean);
  if (!factions.length) { ui.notifications?.warn?.("Pick the faction that resolved it."); return { ok: false, reason: "no-faction" }; }
  const faction = factions[0];
  if (actor?.flags?.fourththing?.rfi?.actor?.resolved) { ui.notifications?.info?.(`${actor.name} has already paid its bounty.`); return { ok: false, reason: "already" }; }
  // 10-29: a card that already paid can't pay again; a snapshot (token gone, nothing to stamp)
  // pays once — any GM-authored bounty message for that uuid marked resolved means it's spent.
  if (messageId && game.messages.get(messageId)?.flags?.[MOD]?.bountyOffer?.resolved) { ui.notifications?.info?.("That bounty card has already been paid."); return { ok: false, reason: "already" }; }
  if (snap && _snapshotPaid(snap.uuid)) { ui.notifications?.info?.(`${snap.name} has already paid its bounty.`); return { ok: false, reason: "already" }; }
  if (!actor) actor = { uuid: snap.uuid, id: snap.id, name: snap.name };

  const b = snap ? snap.bounty : bountyFor(actor);
  const amount = Number.isFinite(Number(marks)) && Number(marks) > 0 ? Number(marks) : b.marks;
  const pool = m.pool;
  const op = game.bbttcc?.api?.op;
  if (!op?.commit) { ui.notifications?.error?.("OP engine unavailable."); return { ok: false, reason: "no-op-engine" }; }

  // Each domain is clamped to ITS cap: preview, subtract this bucket's overflow (and any total overflow), commit.
  const rows = [];
  for (const F of factions) {
    let credited = amount, lost = 0;
    try {
      const pv = await op.preview(F.id, { [pool]: amount }, { source: "bestiary", label: `Bounty preview — ${actor.name}` });
      const bucketOver = Number(pv?.overcap?.buckets?.[pool]?.overflow ?? 0);
      const totalOver  = Number(pv?.overcap?.total?.overflow ?? 0);
      lost = Math.max(0, Math.min(amount, Math.max(bucketOver, totalOver)));
      credited = amount - lost;
    } catch (e) { console.warn(`[${NS}] preview failed; committing uncapped`, e); }
    // The spine: announce before the ledger moves so listeners see the intent (one event per credited domain).
    const payload = { actorUuid: actor.uuid, actorId: actor.id, actorName: actor.name, factionId: F.id, method, pool, marks: amount, credited, lost, by: game.user.id };
    try { Hooks.callAll("bbttcc:bestiary:resolved", payload); } catch (_e) {}
    let res = { ok: true, committed: false };
    if (credited > 0) {
      res = await op.commit(F.id, { [pool]: credited }, { source: "bestiary", label: `Bounty — ${actor.name} (${m.label.toLowerCase()})`, note: `${m.verb} by ${factions.map(f => f.name).join(", ")}; ${lost ? `${lost} marks lost to the cap` : "full credit"}` });
      if (!res?.committed) { ui.notifications?.warn?.(`Bounty for ${actor.name} was refused for ${F.name} (see console).`); console.warn(`[${NS}] commit refused`, F.name, res); continue; }
    }
    rows.push({ faction: F, credited, lost, res, payload });
  }
  if (!rows.length) return { ok: false, reason: "refused" };

  if (!snap) try { await actor.update({ "flags.fourththing.rfi.actor.resolved": { method, factionId: rows[0].faction.id, factionIds: rows.map(r => r.faction.id), marks: amount, credited: rows.reduce((t, r) => t + r.credited, 0), at: Date.now(), by: game.user.id } }); }
  catch (e) { console.warn(`[${NS}] could not stamp resolution on ${actor.name}`, e); }

  const receipt = _receiptHTML({ actor, rows, method, marks: amount, pool });
  try {
    const msg = messageId ? game.messages.get(messageId) : null;
    if (msg) await msg.update({ content: receipt, [`flags.${MOD}.bountyOffer.resolved`]: true });
    // 10-29: the receipt carries the resolved marker too, so a snapshot paid by hand still dedupes.
    else await ChatMessage.create({ content: receipt, speaker: { alias: "Bestiary" }, flags: { [MOD]: { bountyOffer: { actorUuid: actor.uuid, resolved: true } } } });
  } catch (_e) {}
  ui.notifications?.info?.(`${rows.map(r => r.faction.name).join(", ")} collect${rows.length > 1 ? "" : "s"} ${_opFmt(amount)} of ${pool} each for ${actor.name}.`);
  return { ok: true, ...rows[0].payload, factionIds: rows.map(r => r.faction.id), credited: rows.map(r => ({ factionId: r.faction.id, credited: r.credited, lost: r.lost })) };
}

/* 10-29: has a GM-authored bounty message for this uuid already been resolved? */
function _snapshotPaid(uuid) {
  if (!uuid) return false;
  return (game.messages?.contents ?? []).some(m => {
    const bo = m.flags?.[MOD]?.bountyOffer;
    return bo?.resolved && bo.actorUuid === uuid && m.author?.isGM;
  });
}

/* ── Card buttons ─────────────────────────────────────────────────────── */

function _bindCard(message, html) {
  const root = html?.querySelector ? html : html?.[0];
  if (!root) return;
  const card = root.querySelector("[data-bbttcc-bounty-actor]");
  if (!card) return;
  // 10-29: only a GM-authored card posted by _postOffer is live — a player can write a lookalike
  // card (content + flags are theirs to set), so its uuid/snapshot must never drive a credit.
  const offerFlag = message.flags?.[MOD]?.bountyOffer ?? null;
  if (!game.user.isGM || !message.author?.isGM || !offerFlag?.actorUuid || offerFlag.resolved) { card.querySelectorAll("button").forEach(b => { b.disabled = true; }); return; }
  card.querySelectorAll("[data-bbttcc-bounty-method]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const factionId = card.querySelector("[data-bbttcc-bounty-faction]")?.value ?? "";
      card.querySelectorAll("button").forEach(b => { b.disabled = true; });
      // 10-29: uuid comes from the GM-written flags, not the card's DOM attribute.
      const snapshot = offerFlag.snapshot?.uuid === offerFlag.actorUuid ? offerFlag.snapshot : null;
      const r = await resolve(offerFlag.actorUuid, { method: btn.dataset.bbttccBountyMethod, factionId, messageId: message.id, snapshot });
      if (!r?.ok) card.querySelectorAll("button").forEach(b => { b.disabled = false; });
    });
  });
}
Hooks.on("renderChatMessageHTML", (message, html) => { try { _bindCard(message, html); } catch (e) { console.warn(`[${NS}] card bind failed`, e); } });

/* ── Auto-offer on the 0-Integrity crossing (primary GM only) ─────────── */

Hooks.on("preUpdateActor", (actor, changes, options) => {
  try {
    if (!isBestiary(actor)) return;
    const next = foundry.utils.getProperty(changes, "system.derived.integrity.value");
    if (next === undefined) return;
    options._bbttccPrevInteg = Number(actor.system?.derived?.integrity?.value ?? NaN);
  } catch (_e) {}
});
Hooks.on("updateActor", (actor, changes, options) => {
  try {
    if (!game.user.isGM) return;
    const primary = game.users?.activeGM ?? null;
    if (primary && primary.id !== game.user.id) return;
    if (!isBestiary(actor)) return;
    const prev = Number(options?._bbttccPrevInteg);
    const next = Number(foundry.utils.getProperty(changes, "system.derived.integrity.value"));
    if (!Number.isFinite(prev) || !Number.isFinite(next)) return;
    if (prev > 0 && next <= 0) {
      // 2026-10-09 — mid-combat kills queue their bounty card until the
      // combat ends (trailer playtest: a card per kill buried the fight's
      // roll cards). Out of combat the card posts at once, as before.
      const combat = _activeCombatOf(actor);
      if (combat) {
        // review P3 (2026-10-28): the queue lives on the combat document (a flag) so a GM reload
        // or a primary-GM handoff mid-fight doesn't lose it; the Map is just a write-through cache.
        const q = _pendingBounties.get(combat.id) ?? _queueOf(combat);
        if (!q.some(e => e.uuid === actor.uuid)) q.push(_snapshot(actor));
        _pendingBounties.set(combat.id, q);
        combat.setFlag(MOD, "pendingBounties", q).catch(e => console.warn(`[${NS}] could not persist bounty queue`, e));
        return;
      }
      offer(actor).catch(() => {});
    }
  } catch (e) { console.warn(`[${NS}] auto-offer failed`, e); }
});

const _pendingBounties = new Map(); // combatId -> bounty snapshots (cache of the combat flag)
function _queueOf(combat) {
  const raw = combat?.getFlag?.(MOD, "pendingBounties") ?? combat?.flags?.[MOD]?.pendingBounties ?? [];
  return (Array.isArray(raw) ? raw : []).map(e => (typeof e === "string" ? { uuid: e } : e)).filter(e => e?.uuid);
}
function _isPrimaryGM() {
  if (!game.user.isGM) return false;
  const primary = game.users?.activeGM ?? null;
  return !primary || primary.id === game.user.id;
}
function _activeCombatOf(actor) {
  try {
    for (const c of game.combats ?? []) {
      if (!c.started) continue;
      if (c.combatants.some(cb => cb.actorId === actor.id || cb.actor?.uuid === actor.uuid)) return c;
    }
  } catch (_e) {}
  return null;
}
// the queued snapshot remembers who fought (the combat is gone by the time the card posts)
const e2fighters = (snap) => (Array.isArray(snap?.fighterFactionIds) ? snap.fighterFactionIds : null);
async function _flushBounties(combat, { clearFlag = false } = {}) {
  const q = [];
  for (const e of [...(_pendingBounties.get(combat.id) ?? []), ..._queueOf(combat)]) if (!q.some(x => x.uuid === e.uuid)) q.push(e);
  _pendingBounties.delete(combat.id);
  if (clearFlag && q.length) { try { await combat.unsetFlag(MOD, "pendingBounties"); } catch (_e) {} }
  for (const snap of q) {
    try {
      let a = null;
      try { a = await fromUuid(snap.uuid); } catch (_e) {}
      if (a) await offer(a, { fighters: e2fighters(snap) });
      else if (snap.name) await _postOffer(snap);   // token deleted mid-fight — post from the snapshot
      else ui.notifications?.warn?.(`A queued bounty (${snap.uuid}) lost its creature before combat ended.`);
    } catch (_e) {}
  }
}
Hooks.on("deleteCombat", (combat) => { try { if (_isPrimaryGM()) _flushBounties(combat); } catch (_e) {} });
// 10-29: Combat#started is a getter (round > 0), never in a diff — a stop/reset shows up as round → 0.
Hooks.on("updateCombat", (combat, changes) => {
  try { if (_isPrimaryGM() && "round" in (changes ?? {}) && Number(changes.round) === 0) _flushBounties(combat, { clearFlag: true }); } catch (_e) {}
});

/* ── Install ──────────────────────────────────────────────────────────── */

function _install() {
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.bestiary = { METHODS, isBestiary, bountyFor, listFactions, offer, resolve };
  } catch (_e) {}
}
_install();
Hooks.once("ready", _install);
