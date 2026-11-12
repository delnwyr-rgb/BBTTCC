// modules/bbttcc-territory/scripts/super-mode.js
// SUPER MODE (Dave 2026-11-06/07, plan SUPER_MODE_PLAN_2026_11_06.md): in any combat a Steward CALLS a Draw of one of
// the coalition's maneuvers, places its area, and every seat PLEDGES marks from its own Domain's matching pool. When
// the pledges cover the price the caller fires it on their turn (it spends their Action): foes roll a defense check at
// disadvantage (Strikes / Zones), allies get the boon. Power = the CALLER's Steward tier; grade = the maneuver's tier.
// Draws per round = the leader's (campaign.factionId) Domain tier, minimum 1. Overdraw = a free T1 Draw for 1 Strain
// + 1 leader Darkness + 3 Notice, once per Steward per fight. Notice (monthly, on the leader) ≥ 5 pulls the table out
// mid-fight into the Watcher beat. Imported by combat-dock.enhancer.js (no manifest change).
//
// Every write runs on the GM (gmExec types superMode.*): banks through op.commit, damage through the system chokepoint,
// conditions/temp Integrity/Imposed/Strain through the system's own APIs. State lives on the combat:
// flags.bbttcc-territory.superMode = { round, draws, calls{}, zones[], overdrawn[], discount }.
import { SUPER_CATALOG } from "./super-mode.catalog.js";

const MOD = "bbttcc-territory";
const FLAG = "superMode";
const TAG = "[bbttcc-super]";
const CARD_ID = "bbttcc-super-card";
const WATCHER_BEAT = "adversary_super_draw_watcher";
const WATCHER_FALLBACK = "adversary_reality_tear_watcher_notices";
const NOTICE_AT = 5;
const warn = (...a) => console.warn(TAG, ...a);
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

export const POWER = {
  1: { dc: 16, d: "2d6+4", b: 1, w: 10, h: 11, mult: 1 },
  2: { dc: 24, d: "3d8+10", b: 2, w: 20, h: 23, mult: 1.5 },
  3: { dc: 28, d: "4d8+15", b: 3, w: 30, h: 33, mult: 2 },
  4: { dc: 30, d: "5d8+22", b: 4, w: 40, h: 44, mult: 2.5 }
};
export const GRADE = {
  1: { ft: 15, x: 1, rounds: 1, base: 40 },
  2: { ft: 20, x: 1.25, rounds: 2, base: 70 },
  3: { ft: 30, x: 1.5, rounds: 2, base: 110 },
  4: { ft: 40, x: 2, rounds: 3, base: 160 }
};
const POOL_LABEL = { violence: "Violence", nonlethal: "Non-Lethal", intrigue: "Intrigue", economy: "Economy", softpower: "Soft Power",
  diplomacy: "Diplomacy", logistics: "Logistics", culture: "Culture", faith: "Faith" };
const SHAPE_ICON = { Strike: "fa-burst", Zone: "fa-circle-radiation", Boon: "fa-arrow-up", Ward: "fa-shield-halved", Mend: "fa-heart-pulse", Turn: "fa-bolt" };
const COND_LABEL = (k) => CONFIG?.fourththing?.CONDITIONS?.[k]?.label ?? (k.charAt(0).toUpperCase() + k.slice(1));
const BY_KEY = new Map(SUPER_CATALOG.map(r => [r.key, r]));

// ── Readers ──────────────────────────────────────────────────────────────
const sysOf = (a) => a?.system?.system ?? a?.system ?? {};
function campaignNow() {
  const C = game.bbttcc?.api?.campaign; const id = C?.getActiveCampaignId?.(); const c = id ? C.getCampaign(id) : null;
  return { C, id, c };
}
const clean = (x) => String((typeof x === "string" ? x : (x?.uuid || x?.id)) || "").replace(/^Actor\./, "");
export function leader() { const { c } = campaignNow(); const id = clean(c?.factionId); return id ? game.actors.get(id) : null; }
export function coalition() {
  const { c } = campaignNow();
  const ids = [...new Set([c?.factionId, ...(Array.isArray(c?.factionIds) ? c.factionIds : [])].map(clean).filter(Boolean))];
  return ids.map(id => game.actors.get(id)).filter(Boolean);
}
const domainTier = (f) => { try { return Number(game.bbttcc?.facts?.faction?.tier?.(f)) || 1; } catch (_e) { return 1; } };
export const drawsPerRound = () => Math.max(1, domainTier(leader()));
const bankOf = (f) => { const b = f?.getFlag?.("bbttcc-factions", "opBank") || {}; const o = {}; for (const k of Object.keys(POOL_LABEL)) o[k] = Math.max(0, Math.floor(Number(b[k]) || 0)); return o; };
export function stewardPower(actor) {
  const lvl = Number(sysOf(actor)?.details?.level ?? 1) || 1;
  return lvl >= 16 ? 4 : lvl >= 11 ? 3 : lvl >= 6 ? 2 : 1;
}
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
/** Price in marks per pool for one row at Power P, after the fight's running discount. */
export function priceOf(row, P, discount = null) {
  const total = GRADE[row.grade].base * POWER[P].mult;
  const out = {};
  for (const [pool, share] of Object.entries(row.pools)) out[pool] = round5(total * share);
  if (discount && (discount.uses || 0) > 0) {
    if (discount.pct) for (const k of Object.keys(out)) out[k] = Math.max(0, Math.round(out[k] * (1 - discount.pct / 100) / 5) * 5);
    if (discount.flat && discount.pool && out[discount.pool] != null) out[discount.pool] = Math.max(0, out[discount.pool] - discount.flat);
  }
  return out;
}
/** Rows any coalition Domain can use (the raid console's full gate, player view). */
export function coalitionRows() {
  const can = game.bbttcc?.api?.raid?.canUseManeuver;
  const doms = coalition();
  return SUPER_CATALOG.filter(r => doms.some(f => { try { return typeof can !== "function" || can(f, r.key, { ignoreGM: true })?.ok; } catch (_e) { return false; } }));
}
const stateOf = (combat) => foundry.utils.deepClone(combat?.getFlag?.(MOD, FLAG) || {});
function freshState(combat, st) {
  const s = st || stateOf(combat);
  s.calls ??= {}; s.zones ??= []; s.overdrawn ??= [];
  if (s.round !== combat.round) { s.round = combat.round; s.draws = 0; }
  s.draws ??= 0;
  return s;
}
// setFlag MERGES objects, so a withdrawn call or pledge would linger — replace the whole flag.
async function saveState(combat, st) { await combat.update({ [`flags.${MOD}.-=${FLAG}`]: null }); await combat.update({ [`flags.${MOD}.${FLAG}`]: st }); }
const ownsDomain = (user, f) => { try { return !!user?.isGM || !!f?.testUserPermission?.(user, "OWNER"); } catch (_e) { return false; } };
const pledgedTotal = (call) => { const t = {}; for (const p of Object.values(call.pledges || {})) for (const [k, n] of Object.entries(p)) t[k] = (t[k] || 0) + (Number(n) || 0); return t; };
const covered = (call) => { const t = pledgedTotal(call); return Object.entries(call.price).every(([k, n]) => (t[k] || 0) >= n); };

// ── GM side ──────────────────────────────────────────────────────────────
const _gmQueue = { p: Promise.resolve() };
const gmSerial = (fn) => { const run = _gmQueue.p.then(fn, fn); _gmQueue.p = run.catch(() => {}); return run; };

async function gmCall(payload, meta) {
  const combat = game.combat; if (!combat?.started) return { ok: false, reason: "No combat running." };
  const row = BY_KEY.get(payload.key); if (!row) return { ok: false, reason: "Unknown maneuver." };
  const caller = game.actors.get(payload.actorId); if (!caller || caller.type !== "character") return { ok: false, reason: "Only a Steward can call a Draw." };
  const u = game.users.get(meta?.fromUserId);
  if (u && !u.isGM && !caller.testUserPermission(u, "OWNER")) return { ok: false, reason: "That Steward isn't yours." };
  if (!combat.combatants.find(c => c.actorId === caller.id)) return { ok: false, reason: `${caller.name} isn't in this fight.` };
  const st = freshState(combat);
  const overdraw = !!payload.overdraw;
  if (overdraw) {
    if (row.grade !== 1) return { ok: false, reason: "An Overdraw is a T1 Draw." };
    if (st.overdrawn.includes(caller.id)) return { ok: false, reason: `${caller.name} has already Overdrawn this fight.` };
  }
  const P = stewardPower(caller);
  const id = foundry.utils.randomID();
  const g = GRADE[row.grade];
  let tplId = null;
  try {
    const [t] = await combat.scene.createEmbeddedDocuments("MeasuredTemplate", [{
      t: "circle", user: meta?.fromUserId || game.user.id, x: payload.x, y: payload.y, distance: g.ft, direction: 0,
      fillColor: overdraw ? "#8b1e3f" : "#e0a020", borderColor: "#fff2c0", fillAlpha: 0.18,
      flags: { [MOD]: { superCall: id } }
    }]);
    tplId = t?.id ?? null;
  } catch (e) { warn("template create failed", e); }
  st.calls[id] = {
    id, key: row.key, label: row.label, grade: row.grade, P, overdraw,
    callerId: caller.id, callerName: caller.name, userId: meta?.fromUserId || game.user.id,
    tplId, x: payload.x, y: payload.y, ft: g.ft, round: combat.round,
    price: overdraw ? {} : priceOf(row, P, st.discount), discounted: !overdraw && !!st.discount, pledges: {}
  };
  await saveState(combat, st);
  return { ok: true, id };
}

async function gmPledge(payload, meta) {
  const combat = game.combat; const st = freshState(combat); const call = st.calls?.[payload.callId];
  if (!call) return { ok: false, reason: "That Draw is gone." };
  const f = game.actors.get(clean(payload.factionId));
  if (!f || !coalition().some(x => x.id === f.id)) return { ok: false, reason: "Only coalition Domains can pledge." };
  const u = game.users.get(meta?.fromUserId);
  if (u && !ownsDomain(u, f)) return { ok: false, reason: `${f.name} isn't your Domain.` };
  const bank = bankOf(f); const p = {};
  for (const [k, n] of Object.entries(payload.amounts || {})) {
    if (!(k in call.price)) continue;
    const v = Math.max(0, Math.min(bank[k], Math.floor(Number(n) || 0)));
    if (v) p[k] = v;
  }
  if (Object.keys(p).length) call.pledges[f.id] = p; else delete call.pledges[f.id];
  await saveState(combat, st);
  return { ok: true };
}

async function gmWithdraw(payload, meta) {
  const combat = game.combat; const st = freshState(combat); const call = st.calls?.[payload.callId];
  if (!call) return { ok: true };
  const u = game.users.get(meta?.fromUserId);
  if (u && !u.isGM && call.userId !== u.id) return { ok: false, reason: "Only the caller or the GM can withdraw it." };
  delete st.calls[payload.callId];
  if (call.tplId) try { await combat.scene.deleteEmbeddedDocuments("MeasuredTemplate", [call.tplId]); } catch (_e) {}
  await saveState(combat, st);
  return { ok: true };
}

async function gmFire(payload, meta) {
  const combat = game.combat; const st = freshState(combat); const call = st.calls?.[payload.callId];
  if (!call) return { ok: false, reason: "That Draw is gone." };
  const u = game.users.get(meta?.fromUserId);
  if (u && !u.isGM && call.userId !== u.id) return { ok: false, reason: "Only the Steward who called it can fire it." };
  const caller = game.actors.get(call.callerId);
  const cb = combat.combatants.find(c => c.actorId === call.callerId);
  if (!caller || !cb) return { ok: false, reason: "The caller has left the fight." };
  if (!(u?.isGM) && combat.combatant?.id !== cb.id) return { ok: false, reason: `Fire it on ${caller.name}'s turn.` };
  if (sysOf(caller)?.actions?.actionUsed && !(u?.isGM)) return { ok: false, reason: `${caller.name}'s Action is spent this turn.` };
  const limit = drawsPerRound();
  if (st.draws >= limit) return { ok: false, reason: `The coalition has drawn ${st.draws} of ${limit} this round.` };
  if (!call.overdraw && !covered(call)) return { ok: false, reason: "The pledges don't cover it yet." };
  const row = BY_KEY.get(call.key);

  // 1) Pay: every pledge, all or nothing.
  const paid = [];
  if (!call.overdraw) {
    const need = { ...call.price };
    const op = game.bbttcc?.api?.op;
    for (const [fid, p] of Object.entries(call.pledges)) {
      const take = {};
      for (const [k, n] of Object.entries(p)) { const t = Math.min(n, need[k] || 0); if (t > 0) { take[k] = -t; need[k] -= t; } }
      if (!Object.keys(take).length) continue;
      const res = await op.commit(fid, take, { source: "super-mode", reason: `Super Mode: ${call.label}` });
      if (!res?.committed && res?.ok === false) {
        for (const pr of paid) { try { await op.commit(pr.fid, Object.fromEntries(Object.entries(pr.spent).map(([k, n]) => [k, n])), { noDiscount: true, allowOvercap: true, source: "super-mode-refund" }); } catch (_e) {} }
        return { ok: false, reason: `${game.actors.get(fid)?.name ?? "A Domain"} couldn't pay (${res?.error || "bank changed"}). Nothing was spent.` };
      }
      const spent = {};
      for (const k of Object.keys(take)) { const d = (Number(res?.before?.[k]) || 0) - (Number(res?.after?.[k]) || 0); if (d > 0) spent[k] = d; }
      paid.push({ fid, name: game.actors.get(fid)?.name ?? fid, spent });
    }
  }

  // 2) Spend the Action, count the Draw, update the discount.
  try { await caller.update({ "system.actions.actionUsed": true }); } catch (_e) {}
  st.draws += 1;
  if (call.discounted && st.discount?.uses > 0) { st.discount.uses -= 1; if (st.discount.uses <= 0) delete st.discount; }
  if (row.disc) st.discount = { ...row.disc };
  if (call.overdraw) st.overdrawn.push(caller.id);
  delete st.calls[call.id];
  const g = GRADE[row.grade];
  if (call.tplId) st.zones.push({ tplId: call.tplId, key: row.key, P: call.P, callerId: caller.id, until: combat.round + g.rounds, zone: row.s === "Zone", x: call.x, y: call.y, ft: call.ft });
  await saveState(combat, st);

  // 3) Resolve on the map.
  const lines = await resolveEffect(row, call, caller, combat);

  // 4) Prices beyond marks: Overdraw, Darkness, Notice.
  const extra = [];
  const L = leader();
  let dk = Number(row.dk) || 0;
  if (call.overdraw) {
    try { await game.fourththing?.strain?.gain?.(caller, 1, "Overdraw"); } catch (e) { warn("strain", e); }
    dk += 1; extra.push(`${esc(caller.name)} takes 1 Strain`);
  }
  if (dk && L) {
    const cur = L.getFlag("bbttcc-factions", "darkness") || {};
    const before = Number(cur.global) || 0;
    await L.setFlag("bbttcc-factions", "darkness", { ...cur, global: before + dk });
    extra.push(`${esc(L.name)} Darkness ${before} → ${before + dk}`);
  }
  const noticeAdd = call.overdraw ? 3 : row.grade === 4 ? 3 : row.grade === 3 ? 2 : 0;
  let pulled = false;
  if (noticeAdd && L) {
    const n0 = Number(L.getFlag(MOD, "superNotice")) || 0, n1 = n0 + noticeAdd;
    if (n1 >= NOTICE_AT) { pulled = true; await L.setFlag(MOD, "superNotice", 0); extra.push(`Notice ${n0} → ${n1}: <b>something on the Other Side looks up</b>`); }
    else { await L.setFlag(MOD, "superNotice", n1); extra.push(`Notice ${n0} → ${n1} of ${NOTICE_AT}`); }
  }

  // 5) The card.
  const payLine = call.overdraw ? `<b>Overdraw</b> — torn from the ground, no marks`
    : paid.map(p => `${esc(p.name)}: ${Object.entries(p.spent).map(([k, n]) => `${n} ${POOL_LABEL[k]}`).join(" + ")}`).join(" · ");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caller }),
    content: `<div class="fourththing-roll bbttcc-super-chat">
      <div class="ft-roll-header"><span class="ft-roll-name">✦ ${esc(caller.name)} draws <b>${esc(row.label)}</b></span></div>
      <p style="margin:.15rem 0;font-size:.78rem;opacity:.85">T${row.grade} ${esc(row.s)} · Power ${call.P}${row.c ? ` · ${esc(row.c === "evasion" ? "guard" : row.c)} check DC ${POWER[call.P].dc} at disadvantage` : ""} · ${g.ft} ft · ${g.rounds} round${g.rounds > 1 ? "s" : ""}</p>
      <p style="margin:.15rem 0;font-size:.78rem">${payLine}</p>
      ${lines.length ? `<ul style="margin:.25rem 0 .25rem 1rem;padding:0;font-size:.8rem">${lines.map(l => `<li>${l}</li>`).join("")}</ul>` : `<p style="font-size:.8rem;opacity:.7">Nobody in the area.</p>`}
      ${row.r ? `<p style="margin:.2rem 0;font-size:.76rem;color:#c9a227"><i class="fas fa-scroll"></i> ${esc(row.r)}</p>` : ""}
      ${extra.length ? `<p style="margin:.2rem 0;font-size:.76rem;color:#c46a8a">${extra.join(" · ")}</p>` : ""}
    </div>`
  });
  Hooks.callAll("bbttcc:superMode:drawn", { key: row.key, callerId: caller.id, P: call.P, overdraw: call.overdraw, paid });

  // 6) The big overshoot pulls the table out mid-fight (ruling 6).
  if (pulled) setTimeout(() => watcher(caller).catch(e => warn("watcher", e)), 900);
  return { ok: true };
}

async function watcher(caller) {
  const { C, id, c } = campaignNow(); if (!C || !id) return;
  const has = (b) => (c?.beats || []).some(x => x.id === b);
  const beat = has(WATCHER_BEAT) ? WATCHER_BEAT : has(WATCHER_FALLBACK) ? WATCHER_FALLBACK : null;
  if (!beat) { ChatMessage.create({ whisper: game.users.filter(u => u.isGM).map(u => u.id), content: `<p>✦ The Watcher Notices — no beat ${WATCHER_BEAT} in this campaign.</p>` }); return; }
  await C.runBeat(id, beat, { source: "super-mode", actorId: caller?.id });
}

// One D roll per Draw (like any area attack), applied to everyone it lands on.
async function resolveEffect(row, call, caller, combat, only = null) {
  const P = POWER[call.P], g = GRADE[row.grade];
  const lines = [];
  const callerTok = combat.combatants.find(c => c.actorId === caller.id)?.token;
  const myDisp = callerTok?.disposition ?? 1;
  const inArea = tokensIn(combat.scene, call.x, call.y, call.ft).filter(t => !only || t.id === only);
  const foes = inArea.filter(t => myDisp !== 0 && t.disposition === -myDisp && t.actor);
  const allies = inArea.filter(t => t.disposition === myDisp && t.actor);
  const B = P.b;
  let D = 0;
  if (row.d) { const r = await new Roll(P.d).evaluate(); D = Math.floor(r.total * g.x); lines.push(`Damage roll ${P.d} = ${r.total}${g.x !== 1 ? ` × ${g.x}` : ""} → <b>${D}</b>`); }

  // Binary defenses (Dave 2026-11-07): the catalog's "evasion" checks are Guard now — Integrity harm attacks Guard.
  const cKey = row.c === "evasion" ? "guard" : row.c;
  if (row.c) for (const t of foes) {
    const a = t.actor; const s = sysOf(a);
    const def = Number(s?.derived?.[cKey]?.value ?? 10);
    const pen = Number(game.fourththing?.strain?.bite?.(a)?.rollPenalty) || 0;
    const chk = await game.fourththing.rolls.flatCheck({ bonus: def - 10 - pen, dc: P.dc, mode: "disadvantage", explode: false, label: `${row.label} (${cKey})` });
    const fail = !chk.ok; const bits = [];
    if (row.d) {
      const amt = Math.floor(D * row.d * (fail ? 1 : 0.5));
      if (amt > 0) { await game.bbttcc.combat.applyDamage(a, amt, { damageType: row.dt || "kinetic" }); bits.push(`${amt} damage`); }
    }
    if (fail) {
      for (const k of row.f || []) if (await setCond(a, k, true)) bits.push(COND_LABEL(k));
      if (row.imp) { try { if (await game.fourththing.impose.apply(a, { source: row.label })) bits.push("Imposed"); } catch (_e) {} }
      if (row.fdf) { await defenseAE(a, row.fdf, B, g.rounds, row.label); bits.push(Object.entries(row.fdf).map(([k, m]) => `${m * B > 0 ? "+" : ""}${m * B} ${k}`).join(", ")); }
    }
    lines.push(`${esc(t.name)}: ${cKey} ${chk.total} vs ${P.dc} — <b>${fail ? "fails" : "holds"}</b>${bits.length ? ` · ${bits.join(" · ")}` : fail ? "" : " · nothing"}`);
  }
  if (row.fimp) for (const t of foes) { try { if (await game.fourththing.impose.apply(t.actor, { source: row.label })) lines.push(`${esc(t.name)}: Imposed`); } catch (_e) {} }

  const allyBits = new Map();
  const add = (t, s) => { if (!allyBits.has(t.id)) allyBits.set(t.id, { t, b: [] }); allyBits.get(t.id).b.push(s); };
  for (const t of allies) {
    const a = t.actor;
    if (row.t) { const w = Math.floor(P.w * g.x * row.t); await game.fourththing.tempIntegrity.grant(a, w, row.label, { quiet: true }); add(t, `${w} temp Integrity`); }
    if (row.h) { const h = Math.floor(P.h * g.x * row.h); await game.bbttcc.combat.applyDamage(a, h, { op: "heal" }); add(t, `+${h} Integrity`); }
    if (row.atk || row.rr) {
      const bank = Array.isArray(a.flags?.fourththing?.aidBanked) ? [...a.flags.fourththing.aidBanked] : [];
      if (row.atk) { const n = Math.max(1, Math.round(B * row.atk)); bank.push({ kind: "bonus", bonus: n, context: "attack", from: row.label, note: "Super Mode" }); add(t, `+${n} next attack`); }
      if (row.rr) { bank.push({ kind: "reroll-lowest", from: row.label }); add(t, "banked reroll"); }
      await a.update({ "flags.fourththing.aidBanked": bank });
    }
    if (row.df) { await defenseAE(a, row.df, B, g.rounds, row.label); add(t, Object.entries(row.df).map(([k, m]) => `+${m * B} ${k}`).join(", ") + ` for ${g.rounds} rd`); }
    for (const k of row.cl || []) if (sysOf(a)?.conditions?.[k] === true && await setCond(a, k, false)) add(t, `clears ${COND_LABEL(k)}`);
    if (row.st) { try { await game.fourththing.strain.gain(a, row.st, row.label); add(t, `${row.st} Strain`); } catch (_e) {} }
  }
  if (row.aa) {
    const pick = row.aa === "all" ? allies : allies.slice().sort((p, q) => dist(p, call) - dist(q, call)).slice(0, 1);
    for (const t of pick) { await t.actor.setFlag("fourththing", "actAgainAvailable", true); add(t, "⚡ Act Again"); }
  }
  for (const { t, b } of allyBits.values()) lines.push(`${esc(t.name)}: ${b.join(" · ")}`);
  return lines;
}
const dist = (t, c) => Math.hypot((t.object?.center?.x ?? t.x) - c.x, (t.object?.center?.y ?? t.y) - c.y);
function tokensIn(scene, x, y, ft) {
  const d = scene.dimensions ?? canvas.dimensions;
  const px = ft * (d.size / d.distance);
  return scene.tokens.filter(t => {
    const w = (t.width || 1) * d.size, h = (t.height || 1) * d.size;
    const cx = t.x + w / 2, cy = t.y + h / 2;
    return Math.hypot(cx - x, cy - y) <= px + Math.min(w, h) / 2 - 1;   // any part of the token's footprint
  });
}
async function setCond(a, k, want) {
  const s = sysOf(a);
  if ((s?.conditions?.[k] === true) === want) return want;
  try { return (await game.fourththing.toggleCondition(a, k)) === want || (sysOf(a)?.conditions?.[k] === true) === want; } catch (_e) { return false; }
}
async function defenseAE(a, df, B, rounds, label) {
  const KEY = { guard: "system.derived.guard.aeBonus", resolve: "system.derived.resolve.aeBonus" };   // Evasion retired 2026-11-11
  const changes = Object.entries(df).filter(([k]) => KEY[k]).map(([k, m]) => ({ key: KEY[k], mode: 2, value: String(m * B), priority: 20 }));
  if (!changes.length) return;
  try {
    await a.createEmbeddedDocuments("ActiveEffect", [{ name: `✦ ${label}`, img: "icons/svg/aura.svg", origin: a.uuid,
      duration: { rounds, startRound: game.combat?.round ?? 0 }, changes, flags: { [MOD]: { superMode: true, until: (game.combat?.round ?? 0) + rounds } } }]);
  } catch (e) { warn("defense AE", e); }
}

// Round / turn upkeep on the GM: expire areas + their effects, tick Zones on a foe's turn start.
async function gmUpkeep(combat, changed) {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  if (!("round" in changed) && !("turn" in changed)) return;
  const st = stateOf(combat); if (!st?.zones?.length && !Object.keys(st?.calls || {}).length) return;
  const s = freshState(combat, st);
  if ("round" in changed) {
    const gone = s.zones.filter(z => z.until <= combat.round);
    s.zones = s.zones.filter(z => z.until > combat.round);
    const tpl = gone.map(z => z.tplId).filter(id => id && combat.scene?.templates?.get(id));
    if (tpl.length) try { await combat.scene.deleteEmbeddedDocuments("MeasuredTemplate", tpl); } catch (_e) {}
    for (const cb of combat.combatants) {
      const a = cb.actor; if (!a) continue;
      const old = a.effects.filter(e => e.flags?.[MOD]?.superMode && Number(e.flags[MOD].until) <= combat.round).map(e => e.id);
      if (old.length) try { await a.deleteEmbeddedDocuments("ActiveEffect", old); } catch (_e) {}
    }
    await saveState(combat, s);
  }
  const cur = combat.combatant?.token; if (!cur?.actor) return;
  for (const z of s.zones.filter(z => z.zone)) {
    const row = BY_KEY.get(z.key); const caller = game.actors.get(z.callerId);
    const cTok = combat.combatants.find(c => c.actorId === z.callerId)?.token;
    if (!row || !caller || !cTok || cur.disposition !== -cTok.disposition) continue;
    if (!tokensIn(combat.scene, z.x, z.y, z.ft).some(t => t.id === cur.id)) continue;
    const lines = await resolveEffect({ ...row, t: 0, h: 0, atk: 0, rr: 0, df: null, cl: null, aa: null, st: 0, fimp: false }, { P: z.P, x: z.x, y: z.y, ft: z.ft }, caller, combat, cur.id)
      .catch((e) => { warn("zone tick", e); return []; });
    if (lines.length) ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: caller }), content: `<div class="fourththing-roll"><b>✦ ${esc(row.label)}</b> — ${esc(cur.name)} starts its turn in the zone<ul style="margin:.2rem 0 .2rem 1rem;font-size:.8rem">${lines.map(l => `<li>${l}</li>`).join("")}</ul></div>` });
  }
}

async function gmCleanup(combat) {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  const st = combat.getFlag?.(MOD, FLAG); if (!st) return;
  const ids = [...(st.zones || []).map(z => z.tplId), ...Object.values(st.calls || {}).map(c => c.tplId)].filter(id => id && combat.scene?.templates?.get(id));
  if (ids.length) try { await combat.scene.deleteEmbeddedDocuments("MeasuredTemplate", ids); } catch (_e) {}
  for (const cb of combat.combatants) {
    const a = cb.actor; if (!a) continue;
    const old = a.effects.filter(e => e.flags?.[MOD]?.superMode).map(e => e.id);
    if (old.length) try { await a.deleteEmbeddedDocuments("ActiveEffect", old); } catch (_e) {}
  }
}

// ── Seat-side calls ──────────────────────────────────────────────────────
async function send(type, payload) {
  const gx = game.bbttcc?.api?.gmExec;
  try {
    const r = await gx.call(`superMode.${type}`, payload, { timeoutMs: 30000 });
    if (r && r.ok === false && r.reason) ui.notifications?.warn?.(r.reason);
    return r;
  } catch (e) { ui.notifications?.warn?.("Super Mode needs the GM online."); warn(e); return { ok: false }; }
}

// ── Picker (called from the dock) ────────────────────────────────────────
export async function openPicker(actor) {
  const combat = game.combat; if (!combat?.started || !actor) return;
  const st = freshState(combat, stateOf(combat));
  const P = stewardPower(actor);
  const rows = coalitionRows();
  const doms = coalition();
  const hold = {}; for (const f of doms) for (const [k, n] of Object.entries(bankOf(f))) hold[k] = (hold[k] || 0) + n;
  const canOver = !st.overdrawn.includes(actor.id);
  const limit = drawsPerRound();
  const SHAPES = ["Strike", "Zone", "Boon", "Ward", "Mend", "Turn"];
  const body = SHAPES.map(sh => {
    const rs = rows.filter(r => r.s === sh).sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label));
    if (!rs.length) return "";
    return `<div class="sm-group"><div class="sm-group-h"><i class="fas ${SHAPE_ICON[sh]}"></i> ${sh}</div>` + rs.map(r => {
      const price = priceOf(r, P, st.discount);
      const short = Object.entries(price).filter(([k, n]) => (hold[k] || 0) < n);
      const priceTxt = Object.entries(price).map(([k, n]) => `<span class="${(hold[k] || 0) < n ? "sm-short" : ""}">${n} ${POOL_LABEL[k]}</span>`).join(" + ");
      const tip = [row2text(r, P), short.length ? `Short: ${short.map(([k, n]) => `${n - (hold[k] || 0)} ${POOL_LABEL[k]}`).join(", ")}` : ""].filter(Boolean).join(" — ");
      return `<div class="sm-row ${short.length ? "is-short" : ""}" data-tooltip="${esc(tip)}">
        <button type="button" class="sm-pick" data-key="${r.key}" ${short.length ? "disabled" : ""}><span class="sm-t">T${r.grade}</span> ${esc(r.label)}</button>
        <span class="sm-price">${priceTxt}</span>
        ${r.grade === 1 && canOver ? `<button type="button" class="sm-over" data-key="${r.key}" data-tooltip="Overdraw: free, but 1 Strain, +1 Darkness and +3 Notice. Once per Steward per fight.">Overdraw</button>` : ""}
      </div>`;
    }).join("") + `</div>`;
  }).join("");
  const head = `<p class="sm-head">Power <b>${P}</b> (${esc(actor.name)}'s tier) · Draws this round <b>${st.draws}/${limit}</b>${st.discount ? ` · <span class="sm-disc">next Draw ${st.discount.pct ? `−${st.discount.pct}%` : `−${st.discount.flat} ${POOL_LABEL[st.discount.pool]}`}</span>` : ""}<br>
    Coalition holds: ${Object.entries(hold).filter(([, n]) => n).map(([k, n]) => `${n} ${POOL_LABEL[k]}`).join(" · ") || "nothing"}</p>`;
  let picked = null;
  await foundry.applications.api.DialogV2.wait({
    window: { title: "✦ Super Mode — call a Draw", icon: "fas fa-star" },
    classes: ["bbttcc-super-picker"],
    position: { width: 600, height: 660 },
    content: `<div class="sm-picker">${head}${body || `<p>No coalition maneuvers can be drawn.</p>`}</div>`,
    buttons: [{ action: "cancel", label: "Close", default: true }],
    rejectClose: false,
    render: (_ev, app) => {
      const root = app?.element ?? app;
      root.querySelectorAll(".sm-pick, .sm-over").forEach(b => b.addEventListener("click", () => { picked = { key: b.dataset.key, overdraw: b.classList.contains("sm-over") }; app.close(); }));
    }
  });
  if (!picked) return;
  const row = BY_KEY.get(picked.key);
  const at = await placeArea(actor, GRADE[row.grade].ft, picked.overdraw);
  if (!at) return;
  await send("call", { key: row.key, actorId: actor.id, x: at.x, y: at.y, overdraw: picked.overdraw });
}
function row2text(r, P) {
  const p = POWER[P], bits = [];
  if (r.c) bits.push(`${r.c === "evasion" ? "guard" : r.c} check DC ${p.dc} at disadvantage`);
  if (r.d) bits.push(`${r.d === 1 ? "" : "½"}D (${p.d}) on a fail, half on a pass`);
  if (r.f?.length) bits.push(r.f.map(COND_LABEL).join(" + ") + " on a fail");
  if (r.imp) bits.push("Imposed on a fail");
  if (r.t) bits.push(`${r.t === 1 ? "" : "½"}W temp Integrity`);
  if (r.h) bits.push(`${r.h === 1 ? "" : r.h === 2 ? "2×" : "½"}H heal`);
  if (r.atk) bits.push(`+${Math.max(1, Math.round(p.b * r.atk))} next attack`);
  if (r.rr) bits.push("banked reroll");
  if (r.df) bits.push(Object.entries(r.df).map(([k, m]) => `+${m * p.b} ${k}`).join(", "));
  if (r.aa) bits.push(r.aa === "all" ? "every ally inside acts again" : "nearest ally acts again");
  if (r.dk) bits.push(`Darkness +${r.dk}`);
  if (r.r) bits.push(r.r);
  return bits.join(" · ");
}

// Circle placer (a compact port of the system's ftPlaceAreaTemplate): preview follows the cursor, click places, Esc / right-click cancels.
function placeArea(actor, ft, overdraw) {
  if (!canvas?.scene) return Promise.resolve(null);
  const TplDoc = CONFIG.MeasuredTemplate.documentClass, TplObj = CONFIG.MeasuredTemplate.objectClass;
  const tok = actor.getActiveTokens?.()[0];
  const doc = new TplDoc({ t: "circle", user: game.user.id, distance: ft, direction: 0, x: tok?.center?.x ?? 0, y: tok?.center?.y ?? 0, fillColor: overdraw ? "#8b1e3f" : "#e0a020" }, { parent: canvas.scene });
  const preview = new TplObj(doc);
  const prior = canvas.activeLayer; canvas.templates.activate();
  canvas.templates.preview.addChild(preview); preview.draw();
  const tip = document.createElement("div"); tip.className = "ft-template-hitcount"; document.body.appendChild(tip);
  ui.notifications?.info?.(`Place the Draw (${ft} ft) — click to place, Esc to cancel.`);
  return new Promise(resolve => {
    let done = false;
    const fin = (ok) => {
      if (done) return; done = true;
      canvas.stage.off("pointermove", mv); canvas.stage.off("mousedown", dn); canvas.stage.off("rightdown", rt); window.removeEventListener("keydown", ky, true);
      const at = { x: preview.document.x, y: preview.document.y };
      try { tip.remove(); preview.destroy({ children: true }); } catch (_e) {}
      try { prior?.activate?.(); } catch (_e) {}
      resolve(ok ? at : null);
    };
    const mv = (ev) => {
      const p = ev.data.getLocalPosition(canvas.stage);
      let s = p; try { s = canvas.grid.getSnappedPosition?.(p.x, p.y, 2) ?? p; } catch (_e) {}
      preview.document.updateSource({ x: s.x, y: s.y }); preview.refresh();
      const cx = ev.clientX ?? ev.data?.originalEvent?.clientX, cy = ev.clientY ?? ev.data?.originalEvent?.clientY;
      if (cx != null) { tip.style.left = `${cx + 18}px`; tip.style.top = `${cy + 14}px`; }
      const myDisp = tok?.document?.disposition ?? 1;
      const inside = tokensIn(canvas.scene, s.x, s.y, ft);
      const foes = inside.filter(t => myDisp !== 0 && t.disposition === -myDisp).length, allies = inside.filter(t => t.disposition === myDisp).length;
      tip.innerHTML = `<b>${foes}</b> foe${foes === 1 ? "" : "s"} · <b>${allies}</b> all${allies === 1 ? "y" : "ies"}`;
    };
    const dn = (ev) => { if (ev.data?.button === 2) return; fin(true); };
    const rt = () => fin(false);
    const ky = (ev) => { if (ev.key === "Escape") { ev.stopImmediatePropagation(); fin(false); } };
    canvas.stage.on("pointermove", mv); canvas.stage.on("mousedown", dn); canvas.stage.on("rightdown", rt); window.addEventListener("keydown", ky, true);
  });
}

// ── The Draw card: every open call, live pledges, for every seat ────────
function myDomains() { return coalition().filter(f => ownsDomain(game.user, f)); }
export function renderCard() {
  let el = document.getElementById(CARD_ID);
  const combat = game.combat;
  const st = combat?.started ? combat.getFlag(MOD, FLAG) : null;
  const calls = Object.values(st?.calls || {});
  if (!calls.length) { el?.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = CARD_ID; document.body.appendChild(el); wireCard(el); }
  const mine = myDomains();
  const limit = drawsPerRound(); const used = st.round === combat.round ? (st.draws || 0) : 0;
  el.innerHTML = calls.map(call => {
    const tot = pledgedTotal(call);
    const ok = call.overdraw || covered(call);
    const isCaller = game.user.isGM || call.userId === game.user.id;
    const priceRows = call.overdraw ? `<div class="sc-over">Overdraw — no marks. 1 Strain, +1 Darkness, +3 Notice.</div>`
      : Object.entries(call.price).map(([k, n]) => {
        const have = tot[k] || 0;
        return `<div class="sc-pool"><span class="sc-pl">${POOL_LABEL[k]}</span><span class="sc-bar"><span style="width:${Math.min(100, Math.round(100 * have / Math.max(1, n)))}%"></span></span><span class="sc-n ${have >= n ? "is-ok" : ""}">${have}/${n}</span></div>`;
      }).join("");
    const who = Object.entries(call.pledges || {}).map(([fid, p]) => `${esc(game.actors.get(fid)?.name ?? "?")}: ${Object.entries(p).map(([k, n]) => `${n} ${POOL_LABEL[k]}`).join(" + ")}`).join(" · ");
    const pledgeUI = call.overdraw ? "" : mine.map(f => {
      const b = bankOf(f); const p = call.pledges?.[f.id] || {};
      return `<div class="sc-mine" data-call="${call.id}" data-fid="${f.id}"><span class="sc-dom">${esc(f.name)}</span>` +
        Object.keys(call.price).map(k => `<label>${POOL_LABEL[k]} <input type="number" min="0" max="${b[k]}" step="5" data-pool="${k}" value="${p[k] ?? ""}" placeholder="0"> <small>of ${b[k]}</small></label>`).join("") +
        `<button type="button" data-sc="pledge">Pledge</button></div>`;
    }).join("");
    return `<div class="sc-call ${ok ? "is-ready" : ""}">
      <div class="sc-title">✦ <b>${esc(call.label)}</b> <span class="sc-meta">T${call.grade} · Power ${call.P} · called by ${esc(call.callerName)}</span></div>
      ${priceRows}${who ? `<div class="sc-who">${who}</div>` : ""}${pledgeUI}
      <div class="sc-btns">
        ${isCaller ? `<button type="button" data-sc="fire" data-call="${call.id}" ${ok && used < limit ? "" : "disabled"} data-tooltip="${ok ? (used < limit ? "Fire it — spends your Action, on your turn" : `The coalition has drawn ${used}/${limit} this round`) : "Waiting on pledges"}">✦ Draw (${used}/${limit} this round)</button>` : ""}
        ${isCaller ? `<button type="button" data-sc="withdraw" data-call="${call.id}">Withdraw</button>` : ""}
        <button type="button" data-sc="pan" data-call="${call.id}" data-tooltip="Show the area"><i class="fas fa-location-crosshairs"></i></button>
      </div></div>`;
  }).join("");
}
function wireCard(el) {
  el.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-sc]"); if (!b) return;
    const combat = game.combat; const st = combat?.getFlag(MOD, FLAG) || {};
    if (b.dataset.sc === "pledge") {
      const box = b.closest(".sc-mine"); const amounts = {};
      box.querySelectorAll("input[data-pool]").forEach(i => { amounts[i.dataset.pool] = Number(i.value) || 0; });
      b.disabled = true; await send("pledge", { callId: box.dataset.call, factionId: box.dataset.fid, amounts }); b.disabled = false;
      return;
    }
    const call = st.calls?.[b.dataset.call]; if (!call) return;
    if (b.dataset.sc === "pan") return canvas.animatePan({ x: call.x, y: call.y, duration: 300 });
    if (b.dataset.sc === "withdraw") return send("withdraw", { callId: call.id });
    if (b.dataset.sc === "fire") { b.disabled = true; await send("fire", { callId: call.id }); }
  });
}

const CSS = `
#${CARD_ID}{position:fixed;right:12px;bottom:calc(var(--cd-dock-h,90px) + 16px);z-index:95;width:340px;max-height:60vh;overflow:auto;display:flex;flex-direction:column;gap:8px;font-size:12px}
#${CARD_ID} .sc-call{background:rgba(18,14,6,.94);border:1px solid #c9a227;border-radius:8px;padding:8px 10px;color:#f1e6c8;box-shadow:0 4px 18px rgba(0,0,0,.5)}
#${CARD_ID} .sc-call.is-ready{border-color:#f5d36b;box-shadow:0 0 14px rgba(245,211,107,.45)}
#${CARD_ID} .sc-title{font-size:13px;margin-bottom:4px}#${CARD_ID} .sc-meta{opacity:.65;font-size:11px}
#${CARD_ID} .sc-pool{display:flex;align-items:center;gap:6px;margin:2px 0}#${CARD_ID} .sc-pl{width:72px}
#${CARD_ID} .sc-bar{flex:1;height:7px;background:#3a3020;border-radius:4px;overflow:hidden}#${CARD_ID} .sc-bar span{display:block;height:100%;background:linear-gradient(90deg,#c9a227,#f5d36b)}
#${CARD_ID} .sc-n{width:58px;text-align:right}#${CARD_ID} .sc-n.is-ok{color:#9be29b}
#${CARD_ID} .sc-who{opacity:.8;font-size:11px;margin:3px 0}#${CARD_ID} .sc-over{color:#e0889f}
#${CARD_ID} .sc-mine{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:5px;padding-top:5px;border-top:1px dashed #6b5a2a}
#${CARD_ID} .sc-mine label{display:flex;align-items:center;gap:3px}#${CARD_ID} .sc-mine input{width:56px;height:22px}
#${CARD_ID} .sc-dom{font-weight:bold;width:100%}#${CARD_ID} .sc-btns{display:flex;gap:6px;margin-top:6px}
#${CARD_ID} button{flex:0 0 auto;line-height:20px;padding:0 8px;background:#2b2412;color:#f1e6c8;border:1px solid #8a7330;border-radius:4px;cursor:pointer}
#${CARD_ID} button[data-sc=fire]:not([disabled]){background:#7a5a10;border-color:#f5d36b;font-weight:bold}#${CARD_ID} button[disabled]{opacity:.45;cursor:default}
.bbttcc-super-picker .sm-head{margin:0 0 6px;font-size:12px}.bbttcc-super-picker .sm-group{margin-bottom:8px}
.bbttcc-super-picker .sm-group-h{font-weight:bold;border-bottom:1px solid #8a7330;margin-bottom:3px}
.bbttcc-super-picker .sm-row{display:flex;align-items:center;gap:6px;margin:2px 0}.bbttcc-super-picker .sm-pick{flex:0 0 220px;text-align:left}
.bbttcc-super-picker .sm-price{flex:1;font-size:11px}.bbttcc-super-picker .sm-short{color:#d36b6b}.bbttcc-super-picker .is-short .sm-pick{opacity:.5}
.bbttcc-super-picker .sm-t{display:inline-block;min-width:20px;font-size:10px;opacity:.7}.bbttcc-super-picker .sm-over{flex:0 0 auto;font-size:10px;color:#e0889f}
.bbttcc-super-picker .sm-disc{color:#9be29b}
#bbttcc-combat-dock .cd-super{background:linear-gradient(90deg,#5a4210,#8a6a18);border:1px solid #f5d36b;color:#fff3c4;font-weight:bold;border-radius:5px;padding:0 9px;cursor:pointer}
`;
// ── Boot ─────────────────────────────────────────────────────────────────
Hooks.once("ready", () => {
  try {
    game.bbttcc ??= {};
    if (!document.getElementById("bbttcc-super-css")) { const el = document.createElement("style"); el.id = "bbttcc-super-css"; el.textContent = CSS; document.head.appendChild(el); }
    game.bbttcc.superMode = { openPicker, renderCard, coalitionRows, priceOf, stewardPower, drawsPerRound, leader, coalition, CATALOG: SUPER_CATALOG, POWER, GRADE };
    const gx = game.bbttcc?.api?.gmExec;
    if (game.user.isGM && gx?.register) {
      gx.register("superMode.call", (p, m) => gmSerial(() => gmCall(p, m)));
      gx.register("superMode.pledge", (p, m) => gmSerial(() => gmPledge(p, m)));
      gx.register("superMode.withdraw", (p, m) => gmSerial(() => gmWithdraw(p, m)));
      gx.register("superMode.fire", (p, m) => gmSerial(() => gmFire(p, m)));
    }
    renderCard();
    console.log(`${TAG} ready — ${SUPER_CATALOG.length} Draws (game.bbttcc.superMode)`);
  } catch (e) { warn("boot failed", e); }
});
Hooks.on("updateCombat", (combat, changed) => {
  if (combat.id === game.combat?.id) renderCard();
  gmSerial(() => gmUpkeep(combat, changed)).catch(e => warn("upkeep", e));
});
Hooks.on("deleteCombat", (combat) => { document.getElementById(CARD_ID)?.remove(); gmCleanup(combat).catch(e => warn("cleanup", e)); });
Hooks.on("updateActor", (a) => { if (document.getElementById(CARD_ID) && a.getFlag?.("bbttcc-factions", "isFaction")) renderCard(); });
// Notice is monthly: the leader's count resets at the Advance.
Hooks.on("bbttcc:advanceTurn:end", async ({ apply } = {}) => {
  if (!apply || !game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  try { const L = leader(); if (L && L.getFlag(MOD, "superNotice")) await L.setFlag(MOD, "superNotice", 0); } catch (e) { warn("notice reset", e); }
});
