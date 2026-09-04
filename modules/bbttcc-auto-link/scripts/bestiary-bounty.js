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
const _opFmt = (marks) => `${marks} marks (${(marks / 10).toFixed(1)} OP)`;

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

/* ── Card ─────────────────────────────────────────────────────────────── */

function _cardHTML(actor, { factionId = "" } = {}) {
  const b = bountyFor(actor);
  const a = actor.flags?.fourththing?.rfi?.actor ?? {};
  const factions = listFactions();
  const opts = ['<option value="">— choose the faction that resolved it —</option>']
    .concat(factions.map(f => `<option value="${f.id}"${f.id === factionId ? " selected" : ""}>${_esc(f.name)}</option>`)).join("");
  const buttons = Object.entries(METHODS).map(([k, m]) =>
    `<button type="button" data-bbttcc-bounty-method="${k}" title="credits ${m.pool}" style="flex:1 1 30%; font-size:0.78rem; padding:0.25rem 0.4rem;">${_esc(m.label)}<br/><span style="opacity:0.7;">→ ${m.pool}</span></button>`).join("");
  return `
<div class="bbttcc-bounty-card" data-bbttcc-bounty-actor="${_esc(actor.uuid)}" style="border:1px solid rgba(46,170,94,0.6); border-radius:6px; padding:0.5rem;">
  <div style="display:flex; align-items:center; gap:0.5rem;">
    <img src="${_esc(actor.img)}" style="width:36px; height:36px; object-fit:cover; border:none;"/>
    <div><strong>${_esc(actor.name)}</strong><br/><span style="font-size:0.78rem; opacity:0.8;">${_esc(a.title || [a.lineage, a.subLineage].filter(Boolean).join(" · ") || "bestiary")} · T${_esc(a.tier ?? "?")} ${_esc(a.bracket ?? "")}</span></div>
  </div>
  <div style="margin-top:0.4rem; font-size:0.8rem;">Bounty <strong>${_opFmt(b.marks)}</strong>${b.source === "rubric" ? " <em>(rubric — no stamped price)</em>" : ""}. Credited to the pool that matches how it was resolved.</div>
  <select data-bbttcc-bounty-faction style="width:100%; margin-top:0.4rem;">${opts}</select>
  <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.4rem;">${buttons}</div>
</div>`;
}

function _receiptHTML({ actor, faction, method, marks, credited, lost, pool }) {
  const m = METHODS[method];
  return `
<div class="bbttcc-bounty-receipt" style="border:1px solid rgba(46,170,94,0.6); border-radius:6px; padding:0.5rem;">
  <strong>${_esc(faction?.name ?? "A faction")}</strong> ${_esc(m?.verb ?? "resolved")} <strong>${_esc(actor?.name ?? "the creature")}</strong>.<br/>
  <span style="font-size:0.8rem;">Bounty ${_opFmt(marks)} → <strong>${_esc(pool)}</strong>: credited ${_opFmt(credited)}${lost > 0 ? `, <em>${_opFmt(lost)} lost to the cap</em>` : ""}.</span>
</div>`;
}

/* Post the offer card, whispered to GMs. Returns the ChatMessage. */
export async function offer(actor, { factionId = "" } = {}) {
  if (!actor) return null;
  if (actor.flags?.fourththing?.rfi?.actor?.resolved) {
    ui.notifications?.info?.(`${actor.name} has already paid its bounty.`);
    return null;
  }
  const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
  return ChatMessage.create({
    content: _cardHTML(actor, { factionId }),
    whisper: gmIds,
    speaker: { alias: "Bestiary" },
    flags: { [MOD]: { bountyOffer: { actorUuid: actor.uuid } } }
  });
}

/* ── The authority ────────────────────────────────────────────────────── */

export async function resolve(actorOrUuid, { method = "kill", factionId, marks = null, messageId = null } = {}) {
  if (!game.user.isGM) { ui.notifications?.warn?.("Bounties are GM work."); return { ok: false, reason: "not-gm" }; }
  const actor = typeof actorOrUuid === "string" ? await fromUuid(actorOrUuid) : actorOrUuid;
  if (!actor) return { ok: false, reason: "no-actor" };
  const m = METHODS[method]; if (!m) return { ok: false, reason: "bad-method" };
  const faction = factionId ? game.actors.get(factionId) : null;
  if (!faction) { ui.notifications?.warn?.("Pick the faction that resolved it."); return { ok: false, reason: "no-faction" }; }
  if (actor.flags?.fourththing?.rfi?.actor?.resolved) { ui.notifications?.info?.(`${actor.name} has already paid its bounty.`); return { ok: false, reason: "already" }; }

  const b = bountyFor(actor);
  const amount = Number.isFinite(Number(marks)) && Number(marks) > 0 ? Number(marks) : b.marks;
  const pool = m.pool;
  const op = game.bbttcc?.api?.op;
  if (!op?.commit) { ui.notifications?.error?.("OP engine unavailable."); return { ok: false, reason: "no-op-engine" }; }

  // Clamp to the cap: preview, subtract this bucket's overflow (and any total overflow).
  let credited = amount, lost = 0;
  try {
    const pv = await op.preview(faction.id, { [pool]: amount }, { source: "bestiary", label: `Bounty preview — ${actor.name}` });
    const bucketOver = Number(pv?.overcap?.buckets?.[pool]?.overflow ?? 0);
    const totalOver  = Number(pv?.overcap?.total?.overflow ?? 0);
    lost = Math.max(0, Math.min(amount, Math.max(bucketOver, totalOver)));
    credited = amount - lost;
  } catch (e) { console.warn(`[${NS}] preview failed; committing uncapped`, e); }

  // The spine: announce before the ledger moves so listeners see the intent.
  const payload = { actorUuid: actor.uuid, actorId: actor.id, actorName: actor.name, factionId: faction.id, method, pool, marks: amount, credited, lost, by: game.user.id };
  try { Hooks.callAll("bbttcc:bestiary:resolved", payload); } catch (_e) {}

  let res = { ok: true, committed: false };
  if (credited > 0) {
    res = await op.commit(faction.id, { [pool]: credited }, { source: "bestiary", label: `Bounty — ${actor.name} (${m.label.toLowerCase()})`, note: `${m.verb} by ${faction.name}; ${lost ? `${lost} marks lost to the cap` : "full credit"}` });
    if (!res?.committed) { ui.notifications?.warn?.(`Bounty for ${actor.name} was refused by the OP engine (see console).`); console.warn(`[${NS}] commit refused`, res); return { ok: false, reason: "refused", res }; }
  }

  try { await actor.update({ "flags.fourththing.rfi.actor.resolved": { method, factionId: faction.id, marks: amount, credited, lost, at: Date.now(), by: game.user.id } }); }
  catch (e) { console.warn(`[${NS}] could not stamp resolution on ${actor.name}`, e); }

  const receipt = _receiptHTML({ actor, faction, method, marks: amount, credited, lost, pool });
  try {
    const msg = messageId ? game.messages.get(messageId) : null;
    if (msg) await msg.update({ content: receipt, [`flags.${MOD}.bountyOffer.resolved`]: true });
    else await ChatMessage.create({ content: receipt, speaker: { alias: "Bestiary" } });
  } catch (_e) {}
  ui.notifications?.info?.(`${faction.name} collects ${_opFmt(credited)} of ${pool} for ${actor.name}${lost ? ` (${lost} marks lost to the cap)` : ""}.`);
  return { ok: true, ...payload, res };
}

/* ── Card buttons ─────────────────────────────────────────────────────── */

function _bindCard(message, html) {
  const root = html?.querySelector ? html : html?.[0];
  if (!root) return;
  const card = root.querySelector("[data-bbttcc-bounty-actor]");
  if (!card) return;
  if (!game.user.isGM) { card.querySelectorAll("button").forEach(b => { b.disabled = true; }); return; }
  card.querySelectorAll("[data-bbttcc-bounty-method]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const factionId = card.querySelector("[data-bbttcc-bounty-faction]")?.value ?? "";
      card.querySelectorAll("button").forEach(b => { b.disabled = true; });
      const r = await resolve(card.dataset.bbttccBountyActor, { method: btn.dataset.bbttccBountyMethod, factionId, messageId: message.id });
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
    if (prev > 0 && next <= 0) offer(actor).catch(() => {});
  } catch (e) { console.warn(`[${NS}] auto-offer failed`, e); }
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
