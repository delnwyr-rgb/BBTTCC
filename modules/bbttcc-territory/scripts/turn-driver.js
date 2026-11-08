import { LOGI, LEDGER_DAY_COST, LANE_HEX_BONUS, LANE_BY_MODIFIER_SURGE_MULT } from "/modules/bbttcc-core/scripts/economy.constants.js";
// Bad Eden Territory — Turn Driver
// Pipeline: (0) Promote post.pending → turn.pending (Apply only)
// → (1) Planned Raids (Dry=preview, Apply=commit per faction via compat)
// → (2) delegate advanceTurn
// → (3) OP Regen (proportional, Apply only)
// → (3.25) Logistics Pressure (Overextension v1) — demand/capacity/ratio (Apply only)
// → (3.5) Normalize queued shape (nextRound → nextTurn)
// → (4) Apply queued turn.pending (Apply only) [raid queued effects only]
// → (5) Hard cleanup (immediate + deferred pass)

const NS = "[bbttcc-turn]";
const log  = (...a)=>console.log(NS, ...a);
const warn = (...a)=>console.warn(NS, ...a);

function _bbttccTurnFx(){ try { return game?.bbttcc?.api?.fx || null; } catch(_e){ return null; } }
async function _bbttccTurnFxPlay(key, ctx={}, opts={}){
  try {
    const fx = _bbttccTurnFx();
    if (!fx || typeof fx.playKey !== "function") return { ok:false, skipped:true };
    return await fx.playKey(String(key||""), ctx || {}, opts || {});
  } catch(_e){ return { ok:false, error:_e }; }
}
async function _bbttccTurnFxPresentation(events=[], opts={}){
  try {
    const fx = _bbttccTurnFx();
    if (!fx || typeof fx.playTurnPresentation !== "function") return { ok:false, skipped:true };
    return await fx.playTurnPresentation(events, opts);
  } catch(_e){ return { ok:false, error:_e }; }
}


const MOD_FACTIONS  = "bbttcc-factions";
const MOD_TERRITORY = "bbttcc-territory";
// Table announcements (2026-10-12): Apply-time turn cards, track updates and raid round cards used
// to be hard-whispered to the GM list, so players never saw a Turn go by. World setting
// bbttcc-territory.tableAnnouncements decides: "public" (default) = whole table, "gm" = whisper.
const tableAudience = () => { try { if (game.settings.get("bbttcc-territory", "tableAnnouncements") === "gm") return (game.users ?? []).filter(u => u.isGM).map(u => u.id); } catch (_e) {} return []; };
// ONE price for a planned activity (strategic review #3/#4, 2026-10-28). The planner list, ⓘ tooltip, Dry preview,
// faction-sheet queue, Domain tab and payActivityCost all read THIS: the entry's recipe (chosen fuel + terrain
// surcharge, baked at plan time) → the row's cost → its opCosts. Keys fold to the bank's lowercase channels.
const PLAN_COST_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
function normalizeActivityCost(cost){
  const out = {};
  for (const [k, v] of Object.entries(cost || {})) {
    const key = String(k || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!PLAN_COST_KEYS.includes(key)) continue;
    const n = Number(v) || 0;
    if (n > 0) out[key] = (out[key] || 0) + n;
  }
  return out;
}
// faction (optional): apply the steward spend discounts (CO21 — Dave 2026-10-28: strategic activities get them) so a
// screen shows what the turn will bill. Planned entries store the BASE price; the discount is taken once, at billing.
function activityCost({ entry = null, effect = null, key = null, faction = null } = {}){
  const k = String(key || entry?.activityKey || entry?.activity || "");
  const eff = effect || game.bbttcc?.api?.raid?.EFFECTS?.[k] || game.bbttcc?.api?.raid?.EFFECTS?.[k.toLowerCase()] || null;
  const recipe = entry?.recipe?.cost;
  const pick = (c) => (c && typeof c === "object" && Object.keys(normalizeActivityCost(c)).length) ? c : null;
  let base = normalizeActivityCost(pick(recipe) || pick(eff?.cost) || pick(eff?.opCosts) || {});
  if (!faction) return base;
  // Oblivion Protocol (owner ruling 2026-11-04): the purge costs what it purges: 20 marks per point of Domain Darkness,
  // split Intrigue / Faith, never less than the listed 60 + 60. A channel can't be asked for more than its bank can
  // hold, so past that the price stops and strategic-throughput's handler purges only the points that were paid for.
  if (k === "oblivion_protocol") {
    const raw = faction.getFlag?.(MOD_FACTIONS, "darkness");
    const dark = Math.max(0, Number((raw && typeof raw === "object") ? raw.global : raw) || 0);
    const caps = game.bbttcc?.facts?.faction?.caps?.(faction) || {};
    const per = (ch) => { const listed = Number(base[ch]) || 0; const cap = Number(caps[ch]); return Math.max(listed, Number.isFinite(cap) ? Math.min(dark * 10, cap) : dark * 10); };
    base = normalizeActivityCost({ ...base, intrigue: per("intrigue"), faith: per("faith") });
  }
  try { const d = game.bbttcc?.api?.op?.discounted; return d ? normalizeActivityCost(d(faction, base)) : base; } catch (_e) { return base; }
}
const fmtActivityCost = (c) => PLAN_COST_KEYS.filter(k => (Number(c?.[k]) || 0) > 0).map(k => `${c[k]} ${k === "softpower" ? "soft power" : k === "nonlethal" ? "non-lethal" : k}`).join(" · ");

Hooks.once("init", () => {
  try {
    game.settings.register(MOD_TERRITORY, "tableAnnouncements", {
      name: "Turn & raid announcements",
      hint: "Where the Turn Driver's Apply cards, the track updates (radiation, darkness, loyalty, integration, economy, facilities, garrison) and the raid round / siege / casualty cards post. Dry previews, ledger back-outs and spy dossiers stay whispered regardless.",
      scope: "world", config: true, type: String, default: "public",
      choices: { public: "Everyone at the table", gm: "GM whisper only" }
    });
  } catch (e) { warn("tableAnnouncements setting register failed", e); }
  // Turn lock (strategic review #10, 2026-10-28) — WORLD-level, so a second GM seat sees it too.
  try { game.settings.register(MOD_TERRITORY, "turnInFlight", { scope: "world", config: false, type: Object, default: {} }); }
  catch (e) { warn("turnInFlight setting register failed", e); }
});

/* ---------------------- world turn lock (review #10) ----------------------
 * window._bbttccTurnLock only guarded the clicking browser, and was released before the
 * wrappers (garrison, tracks, requests, pressure) finished. The lock now lives in a world
 * setting and api.turn.runAdvance holds it across the WHOLE territory.advanceTurn chain.
 * The base driver refuses an Apply while another run holds it. A lock older than
 * TURN_LOCK_STALE_MS is treated as abandoned (crashed tab) so a turn can never jam. */
const TURN_LOCK_STALE_MS = 10 * 60 * 1000;
function turnLockHeld(){
  try {
    const l = game.settings.get(MOD_TERRITORY, "turnInFlight") || {};
    if (!l.token || (Date.now() - Number(l.ts || 0)) > TURN_LOCK_STALE_MS) return null;
    return l;
  } catch (_e) { return null; }
}
async function acquireTurnLock(){
  if (turnLockHeld()) return null;
  const token = `${game.user?.id}.${Date.now()}`;
  await game.settings.set(MOD_TERRITORY, "turnInFlight", { token, userId: game.user?.id, userName: game.user?.name, ts: Date.now() });
  return token;
}
async function releaseTurnLock(token){
  try { if (token && turnLockHeld()?.token === token) await game.settings.set(MOD_TERRITORY, "turnInFlight", {}); }
  catch (e) { warn("turn lock release failed", e); }
}
const turnLockMessage = (l) => `Advance Turn skipped — a Turn is already running${l?.userName ? ` (started by ${l.userName})` : ""}.`;
// The outermost Apply: hold the world lock until every advanceTurn wrapper has finished.
async function runAdvance(args = {}){
  const terr = game.bbttcc?.api?.territory;
  if (!args?.apply) return terr.advanceTurn(args);
  // Lock Turn Advance (World State panel, wired 2026-10-28 — the checkbox used to do nothing)
  try {
    if (game.bbttcc?.api?.world?.getState?.()?.locks?.turnAdvance === true) {
      ui.notifications?.warn?.("Turn Advance is locked. Untick Lock Turn Advance in the World State panel to advance.");
      return { changed:false, skipped:true, locked:"world" };
    }
  } catch (_eL) {}
  if (window._bbttccTurnOuter) { ui.notifications?.warn?.(turnLockMessage({ userName: game.user?.name })); return { changed:false, skipped:true }; }
  window._bbttccTurnOuter = "pending";   // synchronous — a double click can't slip in while the lock write is in flight
  let token = null;
  try {
    token = await acquireTurnLock();
    if (!token) { const l = turnLockHeld(); ui.notifications?.warn?.(turnLockMessage(l)); return { changed:false, skipped:true, lockedBy: l?.userName || null }; }
    window._bbttccTurnOuter = token;
    return await terr.advanceTurn(args);
  } finally {
    window._bbttccTurnOuter = null;
    await releaseTurnLock(token);
  }
}
/* =====================================================================
 * Strategic Throughput Registry (Tier 1) — BOOTSTRAP
 * Purpose:
 * - Ensure game.bbttcc.api.raid.STRATEGIC_THROUGHPUT exists even if the
 *   dedicated script file is not loaded by module.json yet.
 * - Keeps Alpha stable: if another module publishes this registry, we
 *   do not overwrite it.
 * ===================================================================== */
function __bbttccInstallStrategicThroughputIfMissing(){
  // #34 (2026-10-28): the old Tier-1 fallback registry installed its OWN handlers when strategic-throughput.js was
  // missing — and they disagreed with the real ones (Charity Drive wrote NaN over the darkness box, Ration
  // Distribution a dead tf.loyalty, Harvest Season the wrong price). A missing registry is now said out loud;
  // consumePlanned routes those rows to the legacy apply()/refund path instead of a second, wrong rulebook.
  try {
    const raid = game.bbttcc?.api?.raid;
    if (raid?.STRATEGIC_THROUGHPUT && Object.keys(raid.STRATEGIC_THROUGHPUT).length) return;
    warn("STRATEGIC_THROUGHPUT is missing — bbttcc-raid/scripts/strategic-throughput.js did not load. Planned strategic activities will refund instead of resolving.");
    if (game.user?.isGM) ui.notifications?.error?.("Strategic activities engine not loaded (strategic-throughput.js) — planned activities will refund, not resolve.");
  } catch (_e) {}
}

// Install on ready so console checks return true without waiting for Advance Turn.
Hooks.once("ready", __bbttccInstallStrategicThroughputIfMissing);
try { if (game?.ready) __bbttccInstallStrategicThroughputIfMissing(); } catch(_e) {}


/* -------------------- ensure raid.consumePlanned (Alpha) ------------------ */
function ensureConsumePlannedShim(){
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.raid ??= {};
  const raid = game.bbttcc.api.raid;

  if (typeof raid.consumePlanned === "function") return true;

  const FCT_ID = MOD_FACTIONS;
  const deepClone = (x)=>foundry.utils.duplicate(x);

  const getEffects = ()=> raid.EFFECTS || {};
  const getEffect  = (k)=> {
    const key = String(k||"");
    const E = getEffects();
    return E[key] || E[key.toLowerCase()] || E[key.toUpperCase()] || null;
  };
  const inferPrimaryKey = (effect)=> effect?.primaryKey || effect?.primaryOp || effect?.primary || null;

  // SIM-BADEDEN fix 2026-06-05 (Bug 2): planned activities previously billed a
  // token `amount:1` of the primary key via faction APIs that don't exist
  // (spendOk:false every time) — strategic activities were effectively FREE.
  // Now: bill the FULL declared cost vector (marks) straight from opBank, the
  // same direct-bank style the Garrison Upkeep Engine uses. Discrete-cost law:
  // if the faction can't cover the whole vector, the activity does NOT run.
  const OP_KEYS_CANON = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  function normalizeCostVector(cost){
    const out = {};
    for (const [k, v] of Object.entries(cost || {})) {
      const key = String(k || "").toLowerCase().replace(/[^a-z]/g, "");
      const canon = key === "softpower" ? "softpower" : key === "nonlethal" ? "nonlethal" : key;
      if (!OP_KEYS_CANON.includes(canon)) continue;
      const n = Number(v) || 0;
      if (n > 0) out[canon] = (out[canon] || 0) + n;
    }
    return out;
  }

  // Activities whose throughput handler commits its own OP (begin_siege derives
  // the buffer from its declared cost and op.commit's it — billing here too
  // would double-charge the lead).
  const SELF_BILLING_ACTIVITIES = new Set(["begin_siege"]);

  async function payActivityCost({ factionActor, effect, entry }){
    if (SELF_BILLING_ACTIVITIES.has(String(entry?.activityKey || ""))) {
      return { ok:true, selfBilling:true, paid:{} };
    }
    // ⚗ Fuel recipe (2026-09-11): a planned entry may carry its own cost vector (the recipe the
    // faction chose in the planner); it replaces the row's default price outright.
    const base = activityCost({ entry, effect });   // the shared price (review #3, 2026-10-28)
    if (!Object.keys(base).length) return { ok:true, free:true, paid:{} };
    // Steward discounts (Dave 2026-10-28): afford + bill the discounted price; op.commit applies the same discount.
    const cost = activityCost({ entry, effect, faction: factionActor });

    const bank = foundry.utils.duplicate(factionActor.getFlag(MOD_FACTIONS, "opBank") || {});
    const short = {};
    for (const [k, need] of Object.entries(cost)) {
      const have = Number(bank[k]) || 0;
      if (have < need) short[k] = need - have;
    }
    if (Object.keys(short).length) {
      return { ok:false, insufficient: short, cost, paid:{} };
    }
    // #37 (2026-10-28): through op.commit — the per-faction commit queue, so garrison upkeep / rig output / facility
    // credits can no longer overwrite (or be overwritten by) this debit. noDiscount keeps the shown price = billed
    // price (steward discounts on strategic activities are an open ruling); allowOvercap: regen landed unclamped.
    const op = game.bbttcc?.api?.op;
    if (op && typeof op.commit === "function") {
      const neg = {}; for (const [k, v] of Object.entries(base)) neg[k] = -v;
      const r = await op.commit(factionActor.id, neg, { source: "strategic", label: `Planned: ${effect?.label || entry?.activityKey}`, allowOvercap: true });
      if (r?.ok === false) return { ok:false, insufficient: (r.underflow && Object.keys(r.underflow).length) ? r.underflow : cost, cost, paid:{} };
      // paid = what actually left the bank after the discount — the refund and ↩ Back out give back exactly this
      const paid = {}; for (const [k, v] of Object.entries(r?.finalCost || {})) if (Number(v) < 0) paid[k] = -Number(v);
      return { ok:true, paid: Object.keys(paid).length ? paid : cost, discounts: r?.discounts || null };
    }
    for (const [k, need] of Object.entries(cost)) bank[k] = (Number(bank[k]) || 0) - need;
    await factionActor.update({ [`flags.${MOD_FACTIONS}.opBank`]: bank });
    return { ok:true, paid: cost };
  }

  // ⚗ Fuel side effects (owner ruling 2026-09-12): each recipe may carry
  // fx = { faction:{loyaltyDelta,darknessDelta}, hex:{darknessDelta,loyaltyDelta,addModifiers,removeModifiers} }.
  // (faction.moraleDelta is accepted and ignored — faction Morale retired 2026-10-18, ruling 19. hex.moraleDelta is
  //  accepted and FOLDED INTO hex loyaltyDelta — hex Morale retired 2026-10-18 too; hex Loyalty is the hex's indicator now.)
  // Faction tracks are written directly (darkness is the {global,[hexId]} BOX — never a bare
  // number). Hex effects are QUEUED on the target hex's turn.pending, which applyHexPendingSweep
  // lands later this same Advance (modifiers → recompute; numeric deltas → mods.*).
  async function applyRecipeSideEffects({ factionActor, entry }){
    const fx = entry?.recipe?.fx || {}; const notes = [];
    const fac = fx.faction || {};
    const upd = {};
    const f = factionActor.flags?.[MOD_FACTIONS] || {};
    for (const [k, flagKey] of [["loyaltyDelta","loyalty"]]) {
      const d = safeNum(fac[k]); if (!d) continue;
      const before = safeNum(f[flagKey], 50); const after = Math.max(0, Math.min(100, before + d));
      upd[`flags.${MOD_FACTIONS}.${flagKey}`] = after; notes.push(`${flagKey} ${before}→${after}`);
    }
    if (safeNum(fac.darknessDelta)) {
      const box = (f.darkness && typeof f.darkness === "object" && !Array.isArray(f.darkness)) ? clone(f.darkness) : { global: safeNum(f.darkness) };
      const before = safeNum(box.global); box.global = Math.max(0, before + safeNum(fac.darknessDelta));   // #35: DARK_CAP 10, as adjustFactionDarkness
      upd[`flags.${MOD_FACTIONS}.darkness`] = box; notes.push(`darkness ${before}→${box.global}`);
    }
    if (Object.keys(upd).length) await factionActor.update(upd);
    const hx = fx.hex || {};
    if (entry?.targetUuid && Object.keys(hx).length) {
      try {
        const t = await fromUuid(entry.targetUuid); const d = t?.document ?? t;
        if (d?.update) {
          const tf = clone(d.flags?.[MOD_TERRITORY] || {}); const pend = clone(tf.turn?.pending || {});
          for (const k of ["darknessDelta","loyaltyDelta"]) { const v = safeNum(hx[k]) + (k === "loyaltyDelta" ? safeNum(hx.moraleDelta) : 0); if (v) { pend[k] = safeNum(pend[k]) + v; notes.push(`hex ${k.replace(/Delta$/,"")} ${v > 0 ? "+" : ""}${v}`); } }
          const add = Array.isArray(hx.addModifiers) ? hx.addModifiers.filter(Boolean) : []; const rm = Array.isArray(hx.removeModifiers) ? hx.removeModifiers.filter(Boolean) : [];
          if (add.length || rm.length) { pend.repairs = pend.repairs || {}; if (add.length) { pend.repairs.addModifiers = [...new Set([...(pend.repairs.addModifiers || []), ...add])]; notes.push(`hex +${add.join("/")}`); } if (rm.length) { pend.repairs.removeModifiers = [...new Set([...(pend.repairs.removeModifiers || []), ...rm])]; notes.push(`hex −${rm.join("/")}`); } }
          await d.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: pend });
        }
      } catch (e) { warn("recipe hex fx failed", entry?.targetUuid, e); }
    }
    return { notes };
  }
  async function runEffectBestEffort({ effect, entry, factionActor, apply, spendResult = null }){
    if (!effect) return { ok:true, skipped:true };

    const ctx = {
      apply: !!apply,
      entry,
      // SIM-BADEDEN fix 2026-06-05 (Bug 1): the wilderness/supply-line/depot
      // effect handlers destructure `{ actor, entry }` — without `actor` every
      // one of them bailed with "No faction actor." and territory development
      // was silently impossible from the planner path.
      actor: factionActor,
      attackerId: entry?.attackerId || factionActor?.id,
      factionId: factionActor?.id,
      activityKey: entry?.activityKey,
      targetType: entry?.targetType || "hex",
      targetUuid: entry?.targetUuid || null,
      targetName: entry?.targetName || null,
      defenderId: entry?.defenderId || null,
      rigId: entry?.rigId || null,
      notes: entry?.note || entry?.notes || "",
      // What payActivityCost billed — the activity ledger records it so ↩ Back out can refund it (review #17, 2026-10-28).
      paidCost: (spendResult && spendResult.paid) ? foundry.utils.duplicate(spendResult.paid) : {}
    };

    try {
      if (typeof effect.onConsume === "function")  return { ok:true, result: await effect.onConsume(ctx) };
      if (typeof effect.consume === "function")    return { ok:true, result: await effect.consume(ctx) };
      if (typeof effect.apply === "function")      return { ok:true, result: await effect.apply(ctx) };
      if (typeof effect.handler === "function")    return { ok:true, result: await effect.handler(ctx) };
      if (typeof effect.run === "function")        return { ok:true, result: await effect.run(ctx) };
    } catch (e) {
      warn(`Effect handler failed for ${entry?.activityKey} (non-fatal).`, e);
      return { ok:false, error:e };
    }
    // #39 (2026-10-28): a storyOnly row is GM-adjudicated by design — whisper the GM, it DID happen.
    if (effect.storyOnly) {
      const msg = `${factionActor?.name || "A Domain"} ran <b>${effect.label || entry?.activityKey}</b>${entry?.targetName ? ` on ${entry.targetName}` : ""} — a story activity: <b>GM adjudicates</b> what it does.${entry?.note ? ` <i>${foundry.utils.escapeHTML(String(entry.note))}</i>` : ""}`;
      try { await ChatMessage.create({ content: `<p>${msg}</p>`, whisper: (game.users ?? []).filter(u => u.isGM).map(u => u.id), speaker: { alias: "Bad Eden Turn Driver" } }); } catch (_e) {}
      return { ok:true, storyOnly:true, result: "GM adjudicates" };
    }
    // 2026-09-12: a strategic row that reaches here has NO handler — the enhancer that gives it
    // one did not install (load-order race). The faction was still billed. Say so, loudly.
    const noHandler = `⚠ ${entry?.activityKey}: effect registered without a handler — nothing ran (enhancer not installed this session?)`;
    warn(noHandler, effect);
    try { ui.notifications?.warn?.(noHandler); } catch (_e) {}
    return { ok:true, skipped:true, noHandler:true, result: noHandler };
  }

  function finalizeEntry({ entry, factionActor, effect, effectResult, spendResult }){
    const primaryKey = inferPrimaryKey(effect);
    const now = Date.now();
    return {
      ts: now,
      date: (new Date(now)).toLocaleString(),
      type: "raid",
      kind: "strategic",
      attackerId: entry.attackerId || factionActor.id,
      activityKey: entry.activityKey,
      targetType: entry.targetType || "hex",
      targetUuid: entry.targetUuid || null,
      targetName: entry.targetName || null,
      defenderId: entry.defenderId || null,
      rigId: entry.rigId || null,
      note: entry.note || "",
      plannedTs: entry.ts,
      primaryKey,
      opSpent: (spendResult && spendResult.paid) ? spendResult.paid : {},
      ...(entry.recipe ? { recipe: entry.recipe } : {}),
      spendResult: spendResult || null,
      effectResult: effectResult || null,
      summary: `${factionActor.name} executed ${entry.activityKey} on ${entry.targetName || entry.targetType || "target"}${entry.recipe?.label ? ` via ${entry.recipe.label}` : ""}${Array.isArray(effectResult?.recipeFx) && effectResult.recipeFx.length ? ` — ${effectResult.recipeFx.join(", ")}` : ""}`
    };
  }

  // Strategic review #2 (2026-10-28): canPlan ran only at PLAN time, so an activity whose target changed
  // before the Advance (hex taken, rig already fixed, two Domains on one wild hex) was billed in full and
  // logged "executed". Re-ask the row's own canPlan on the GM BEFORE paying; a refusal costs nothing.
  // Fail-open (like the planner): a canPlan that throws lets the activity through.
  async function resolutionRefusal({ factionActor, effect, entry }){
    if (typeof effect?.canPlan !== "function") return null;
    try {
      const base = { actor: factionActor, activityKey: String(entry?.activityKey || ""), toHexUuid: entry?.toHexUuid || null, entry, resolving: true };
      let ctx;
      if (entry?.targetType === "rig") {
        const rigId = entry?.rigId || null;
        ctx = Object.assign(base, { targetType: "rig", defender: game.actors.get(String(entry?.defenderId || "").replace(/^Actor\./, "")) || null, rigId, rigActor: rigId ? (game.actors.get(rigId) || null) : null });
      } else {
        if (!entry?.targetUuid) return null;
        const t = await fromUuid(entry.targetUuid); const d = t?.document ?? t;
        if (!d) return null;
        ctx = Object.assign(base, { targetDoc: d, targetFlags: d.getFlag?.(MOD_TERRITORY) || d.flags?.[MOD_TERRITORY] || {} });
      }
      const v = await effect.canPlan(ctx);
      return (v && v.ok === false) ? String(v.reason || "the target no longer qualifies") : null;
    } catch (e) { warn("resolution canPlan failed (fail-open)", entry?.activityKey, e); return null; }
  }

  // A resolved activity that did not happen: a handler returned {ok:false}, threw, or was never installed.
  function effectFailureReason(effectResult){
    if (!effectResult) return null;
    if (effectResult.noHandler) return "no handler is installed for it this session";
    if (effectResult.ok === false) return String(effectResult.reason || effectResult.error?.message || effectResult.error || "its effect failed");
    const r = effectResult.result;
    if (r && typeof r === "object" && r.ok === false) return String(r.reason || r.error || "its effect was refused");
    return null;
  }

  // Give back exactly what payActivityCost took (fresh bank read — handlers may have moved marks since).
  async function refundActivityCost({ factionActor, spendResult }){
    const paid = spendResult?.paid || {};
    if (!Object.keys(paid).length) return {};
    const op = game.bbttcc?.api?.op;
    if (op && typeof op.commit === "function") {   // #37: same queue as the debit
      const r = await op.commit(factionActor.id, paid, { source: "strategic", label: "Refund — planned activity did not happen", noDiscount: true, allowOvercap: true });
      if (r?.ok !== false) return paid;
    }
    const bank = foundry.utils.duplicate(factionActor.getFlag(MOD_FACTIONS, "opBank") || {});
    for (const [k, v] of Object.entries(paid)) bank[k] = (Number(bank[k]) || 0) + (Number(v) || 0);
    await factionActor.update({ [`flags.${MOD_FACTIONS}.opBank`]: bank });
    return paid;
  }
  const fmtMarks = (v) => Object.entries(v || {}).map(([k, n]) => `${n} ${k}`).join(", ");
  const activityLabel = (effect, entry) => effect?.label || entry?.activityKey || "activity";

  raid.consumePlanned = async function consumePlanned({ factionId, apply=true } = {}) {
    const factionActor = game.actors.get(factionId);
    if (!factionActor) throw new Error("consumePlanned: faction actor not found.");

    const wl = deepClone(factionActor.getFlag(FCT_ID, "warLogs") || []);
    // Onboarding practice orders (#15, 2026-10-28) never run and never bill — they are dropped here.
    const practice = wl.filter(e => e?.type === "planned" && e?.practice === true);
    const planned = wl.filter(e => e?.type === "planned" && e?.practice !== true && String(e?.attackerId) === String(factionActor.id));
    if (!planned.length) {
      if (apply && practice.length) await factionActor.setFlag(FCT_ID, "warLogs", wl.filter(e => !(e?.type === "planned" && e?.practice === true)));
      return { changed: !!(apply && practice.length), count:0, rows:[] };
    }

    const finalizedEntries = [];
    const unresolved = [];
    // #32 (2026-10-28): each order leaves the queue in the SAME write as its result — a throw or a closed tab
    // mid-loop no longer leaves paid orders "planned" to bill again next Advance.
    const sameEntry = (a, b) => a?.type === "planned" && (a.id && b.id ? a.id === b.id : a.ts === b.ts) && String(a.activityKey) === String(b.activityKey);
    const persist = async (entry, row) => {
      if (!apply) return;
      const cur = deepClone(factionActor.getFlag(FCT_ID, "warLogs") || []);
      const next = cur.filter(e => !sameEntry(e, entry));
      next.push(row);
      await factionActor.setFlag(FCT_ID, "warLogs", next);
    };
    const record = async (entry, row) => { finalizedEntries.push(row); await persist(entry, row); };

    for (const entry of planned.sort((a,b)=>(a.ts||0)-(b.ts||0))) {
      const effect = getEffect(entry.activityKey);
      const primaryKey = inferPrimaryKey(effect);

      // #38 (2026-10-28): no catalog row (option dropped, JSON failed to load, typo) → NOT consumed free and logged
      // "executed": it stays planned, the GM is told, and it can be cancelled from the Domain tab.
      if (!effect) { unresolved.push(entry); continue; }

      // SIM-BADEDEN fix 2026-06-05 (Bug 2): pay the FULL declared cost vector
      // up front; an activity the faction cannot afford is refused outright
      // (consumed from the queue, logged unaffordable, effect NOT run).
      // Truce / Border Patrol (2026-09-09): a refused raid costs nothing.
      // Bill at plan (Dave 2026-11-02): raid.planActivity charges the price when the order is planned and stamps
      // entry.paid — that IS the spend result (no second bill; refusals / failures refund it). Entries planned
      // before the change carry no `paid` and keep the bill-at-Advance path below.
      const prepaid = (entry?.paid && typeof entry.paid === "object" && Object.keys(entry.paid).length) ? normalizeActivityCost(entry.paid) : null;
      const refundPrepaid = async () => {
        if (!prepaid) return {};
        try { return await refundActivityCost({ factionActor, spendResult: { paid: prepaid } }); }
        catch (eR) { warn("prepaid refund failed", entry?.activityKey, eR); return {}; }
      };
      if (apply) {
        const refusal = await raidRefusalFor({ factionActor, effect, entry });
        if (refusal) {
          const refunded = await refundPrepaid();
          await record(entry, Object.assign(
            finalizeEntry({ entry, factionActor, effect, effectResult: { ok:false, skipped:"refused" }, spendResult: { ok:true, paid:{}, refunded } }),
            { summary: Object.keys(refunded).length ? `${String(refusal).replace(/[.\s]+$/, "")}. Refunded ${fmtMarks(refunded)} marks.` : refusal }
          ));
          continue;
        }
        const stale = await resolutionRefusal({ factionActor, effect, entry });
        if (stale) {
          const refunded = await refundPrepaid();
          await record(entry, Object.assign(
            finalizeEntry({ entry, factionActor, effect, effectResult: { ok:false, skipped:"refused-at-resolution", reason: stale }, spendResult: { ok:true, paid:{}, refunded } }),
            { summary: `${factionActor.name} could not ${activityLabel(effect, entry)}${entry.targetName ? ` on ${entry.targetName}` : ""}: ${stale.replace(/[.\s]+$/, "")}. ${Object.keys(refunded).length ? `Refunded ${fmtMarks(refunded)} marks.` : "Nothing was charged."}` }
          ));
          continue;
        }
      }

      let spendResult = apply
        ? (prepaid ? { ok:true, paid: prepaid, prepaid:true } : await payActivityCost({ factionActor, effect, entry }))
        : { ok:true, preview:true, paid:{} };

      if (apply && spendResult.ok === false) {
        await record(entry, Object.assign(
          finalizeEntry({ entry, factionActor, effect, effectResult: { ok:false, skipped:"insufficient-op" }, spendResult }),
          { summary: `${factionActor.name} could NOT afford ${entry.activityKey} (short: ${Object.entries(spendResult.insufficient||{}).map(([k,v])=>`${k}:${v}`).join(", ")}) — activity refused.` }
        ));
        continue;
      }

      // Going home (Dave 2026-11-02): with home weeks to spare the Stewards run the order in person — part of its
      // price comes back BEFORE the effect runs, so paidCost (activity ledger, ↩ Back out, failure refund) is the net.
      if (apply && __homeAdvance?.weeks > 0 && spendResult?.ok !== false) {
        const back = homeRefundFor(spendResult.paid, __homeAdvance.weeks);
        if (Object.keys(back).length) {
          let given = {};
          try {
            const op = game.bbttcc?.api?.op;
            if (op && typeof op.commit === "function") {
              const r = await op.commit(factionActor.id, back, { source: "strategic", label: "The Stewards ran it themselves (time at home)", noDiscount: true, allowOvercap: true });
              if (r?.ok !== false) given = back;
            } else {
              const bank = foundry.utils.duplicate(factionActor.getFlag(MOD_FACTIONS, "opBank") || {});
              for (const [k, v] of Object.entries(back)) bank[k] = (Number(bank[k]) || 0) + v;
              await factionActor.update({ [`flags.${MOD_FACTIONS}.opBank`]: bank });
              given = back;
            }
          } catch (eH) { warn("home refund failed", entry?.activityKey, eH); }
          if (Object.keys(given).length) {
            const net = {};
            for (const [k, v] of Object.entries(spendResult.paid || {})) { const n = safeNum(v) - safeNum(given[k]); if (n > 0) net[k] = n; }
            spendResult = Object.assign({}, spendResult, { paid: net, homeRefund: given, homeWeeks: __homeAdvance.weeks });
          }
        }
      }

      let effectResult = null;

      // ------------------------------------------------------------
      // Strategic Throughput Routing (Apply only)
      // ------------------------------------------------------------
      if (effect?.kind === "strategic" && apply) {
        const throughput = game.bbttcc?.api?.raid?.STRATEGIC_THROUGHPUT;
        const handler = throughput?.[String(entry.activityKey || "").trim()];

        if (typeof handler === "function") {
          try {
            const hr = await handler({
              factionId: factionActor.id,
              attackerId: entry.attackerId || factionActor.id,
              activityKey: entry.activityKey,
              targetUuid: entry.targetUuid || null,
              targetName: entry.targetName || null,
              toHexUuid: entry.toHexUuid || null,     // route/exchange rows (2026-09-09)
              notes: entry.note || entry.notes || "",
              entry,
              paidCost: (spendResult && spendResult.paid) ? foundry.utils.duplicate(spendResult.paid) : {}   // the ledger records it for ↩ Back out
            });
            // A handler that refuses returns {ok:false, reason} (siege counters, muster drill…) — keep it.
            effectResult = (hr && typeof hr === "object" && hr.ok === false)
              ? { ok:false, routed:"strategic-throughput", reason: hr.reason || hr.error || null }
              : { ok:true, routed:"strategic-throughput" };
          } catch (e) {
            // #33 (2026-10-28): no legacy apply() on top of a handler that already wrote half its effect (Propaganda
            // landed +4). A throw is a failure: refunded below, the GM sees why.
            console.warn("[bbttcc-turn] strategic throughput handler failed:", entry.activityKey, e);
            effectResult = { ok:false, routed:"strategic-throughput", reason: `its handler failed (${e?.message || e})` };
          }
        } else {
          // Not wired yet → fall back to legacy apply/consume/run handler if present
          effectResult = await runEffectBestEffort({ effect, entry, factionActor, apply, spendResult });
        }

      } else {
        // Non-strategic, or Dry preview → legacy handler path
        effectResult = await runEffectBestEffort({ effect, entry, factionActor, apply, spendResult });
      }

      // Review #2 (2026-10-28): the activity did not happen → refund, no fuel fx, say so (not "executed").
      const failed = apply ? effectFailureReason(effectResult) : null;
      if (failed) {
        let refunded = {};
        try { refunded = await refundActivityCost({ factionActor, spendResult }); }
        catch (eR) { warn("refund failed", entry?.activityKey, eR); }
        await record(entry, Object.assign(
          finalizeEntry({ entry, factionActor, effect, effectResult: Object.assign({}, effectResult, { ok:false, reason: failed }), spendResult: Object.assign({}, spendResult, { paid:{}, refunded }) }),
          { summary: `${factionActor.name} could not ${activityLabel(effect, entry)}${entry.targetName ? ` on ${entry.targetName}` : ""}: ${failed}.${Object.keys(refunded).length ? ` Refunded ${fmtMarks(refunded)} marks.` : ""}` }
        ));
        continue;
      }

      // ⚗ Fuel side effects land only when the activity itself resolved (2026-09-12).
      if (apply && effectResult?.ok && entry?.recipe?.fx) {
        try { const r = await applyRecipeSideEffects({ factionActor, entry }); if (r?.notes?.length) effectResult = Object.assign({}, effectResult, { recipeFx: r.notes }); }
        catch (eFx) { warn("recipe side effects failed", entry?.activityKey, eFx); }
      }
      const done = finalizeEntry({ entry, factionActor, effect, effectResult, spendResult });
      if (spendResult?.homeRefund && Object.keys(spendResult.homeRefund).length) done.summary += ` — run in person (time at home): ${fmtMarks(spendResult.homeRefund)} marks back`;
      await record(entry, done);
    }

    if (apply && practice.length) {
      const cur = deepClone(factionActor.getFlag(FCT_ID, "warLogs") || []);
      await factionActor.setFlag(FCT_ID, "warLogs", cur.filter(e => !(e?.type === "planned" && e?.practice === true)));
    }
    if (apply && unresolved.length) {
      const names = unresolved.map(e => String(e.activityKey || "?")).join(", ");
      warn(`consumePlanned: ${factionActor.name} has planned orders with no catalog row — left planned:`, names);
      try { await ChatMessage.create({ content: `<p>⚠ <b>${foundry.utils.escapeHTML(factionActor.name)}</b>: ${unresolved.length} planned order(s) have no activity behind them (<code>${foundry.utils.escapeHTML(names)}</code>) — nothing ran, nothing more was charged (a price paid when planned stays paid; cancelling refunds it). They stay on the plan; cancel them from the Domain tab or restore the activity.</p>`, whisper: (game.users ?? []).filter(u => u.isGM).map(u => u.id), speaker: { alias: "Bad Eden Turn Driver" } }); } catch (_e) {}
    }

    return { changed: finalizedEntries.length > 0, count: finalizedEntries.length, rows: finalizedEntries, unresolved: unresolved.length };
  };

  log("Installed raid.consumePlanned shim (Turn Driver).");
  return true;
}

/* -------------------------------- helpers -------------------------------- */
function isFactionActor(a){
  try {
    if (!a) return false;
    if (a.getFlag?.(MOD_FACTIONS,"isFaction") === true) return true;
    const t = (a.system?.details?.type?.value ?? "").toString().toLowerCase();
    if (t === "faction") return true;
    const cls = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls||"").includes("BBTTCCFactionSheet");
  } catch { return false; }
}
function allFactions(){ return (game.actors?.contents ?? []).filter(isFactionActor); }
function getFlag(a, path, dflt){ try { return foundry.utils.getProperty(a.flags, path) ?? dflt; } catch { return dflt; } }
function clone(x){ return foundry.utils.deepClone(x); }

function zeroRes(){ return { food:0, materials:0, trade:0, military:0, knowledge:0, defense:0 }; }
function zeroOps(){ return { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0 }; }
function addOps(a,b){ const out = foundry.utils.deepClone(a); for (const k of Object.keys(b)) out[k] = (out[k]||0) + (b[k]||0); return out; }
function fmtOpsRow(ops){
  const keys = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  return keys.filter(k => (ops[k]||0) > 0).map(k => `<b>${(ops[k]||0)}</b> ${k}`).join(" • ") || "—";
}

function safeNum(x, d=0){ const n = Number(x); return Number.isFinite(n) ? n : d; }
function safeStr(x){ return String(x ?? ""); }

/* ----------------------- world turn bump (bbttcc-world) -----------------------
 * OP schedules use world.turn as their clock.
 * The strategic Advance Turn pipeline must bump world.turn exactly once per Apply.
 * We do this here (end of pipeline, before bbttcc:advanceTurn:end) so scheduled
 * OP ticks fire immediately on the newly-advanced turn.
 * --------------------------------------------------------------------------- */
async function bumpWorldTurnBestEffort(){
  try {
    const worldApi = game?.bbttcc?.api?.world;
    if (!worldApi || typeof worldApi.getState !== "function") return { ok:false, skipped:true, reason:"no-world-api" };

    const st = worldApi.getState() || {};
    const cur = Math.max(0, Math.floor(Number(st.turn || 0) || 0));
    const next = cur + 1;

    const note = "Advance Turn (strategic)";

    // Primary: applyGMEdit (preferred API)
    if (typeof worldApi.applyGMEdit === "function") {
      const tries = [
        () => worldApi.applyGMEdit({ turn: next, note }),
        () => worldApi.applyGMEdit({ patch: { turn: next }, note }),
        () => worldApi.applyGMEdit({ changes: { turn: next }, note }),
        () => worldApi.applyGMEdit({ update: { turn: next }, note }),
        () => worldApi.applyGMEdit({ turn: next })
      ];
      for (const fn of tries) {
        try { await fn(); return { ok:true, turn: next }; }
        catch (_e) {}
      }
    }

    // Fallback: setState/updateState patterns (if present)
    if (typeof worldApi.setState === "function") {
      try { await worldApi.setState(Object.assign({}, st, { turn: next }), { note }); return { ok:true, turn: next }; }
      catch (_e) {}
    }
    if (typeof worldApi.updateState === "function") {
      try { await worldApi.updateState({ turn: next }, { note }); return { ok:true, turn: next }; }
      catch (_e) {}
    }

    // Last resort: no-op
    return { ok:false, skipped:true, reason:"no-writer" };
  } catch (e) {
    warn("bumpWorldTurnBestEffort failed", e);
    return { ok:false, error:e };
  }
}

/* ------------------------------- defaults -------------------------------- */
const DEFAULT_REGEN_MAP = {
  food:"logistics", materials:"economy", trade:"diplomacy",
  military:"violence", knowledge:"intrigue"
};
const DEFAULT_FACTORS = { food:1, materials:1, trade:1, military:1, knowledge:1 };

/* --------------------------------- TERRITORY → STOCKPILE FALLBACK ---------------------------------- */
/** Sum per-hex resources for a faction from drawings/tiles across all scenes. */
function deriveStockpileFromOwnedHexes(factionId){
  const sum = { food:0, materials:0, trade:0, military:0, knowledge:0 };
  try {
    for (const sc of game.scenes ?? []) {
      // Drawings
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MOD_TERRITORY]; if (!tf) continue;
        const owner = tf.factionId || tf.ownerId || "";
        if (owner !== factionId) continue;
        const r = _hexYield(tf);   // facts.hex.resources (2026-09-12)
        sum.food      += safeNum(r.food);
        sum.materials += safeNum(r.materials);
        sum.trade     += safeNum(r.trade);
        sum.military  += safeNum(r.military);
        sum.knowledge += safeNum(r.knowledge);
      }
      // Tiles
      for (const t of sc.tiles ?? []) {
        const tf = t.flags?.[MOD_TERRITORY]; if (!tf) continue;
        const owner = tf.factionId || tf.ownerId || "";
        if (owner !== factionId) continue;
        const r = _hexYield(tf);   // facts.hex.resources (2026-09-12)
        sum.food      += safeNum(r.food);
        sum.materials += safeNum(r.materials);
        sum.trade     += safeNum(r.trade);
        sum.military  += safeNum(r.military);
        sum.knowledge += safeNum(r.knowledge);
      }
    }
  } catch (e) { warn("deriveStockpileFromOwnedHexes failed", e); }
  return sum;
}

/** Returns true if all stockpile values are zero/empty. */
function isEmptyStockpile(stock) {
  const keys = ["food","materials","trade","military","knowledge"];
  return keys.every(k => !safeNum(stock?.[k]));
}

/* --------------------------------- math ---------------------------------- */
function computeOpsFromStockpile(stockpile, regenMap, factors){
  const delta = zeroOps();
  for (const [res, amtRaw] of Object.entries(stockpile||{})) {
    const amt = safeNum(amtRaw); if (!amt || amt <= 0) continue;
    const key = regenMap[res]; if (!key) continue;
    const fac = safeNum(factors?.[res], 1); if (!(fac > 0)) continue;
    const gained = Math.floor(amt * fac);
    if (gained > 0) delta[key] = (delta[key]||0) + gained;
  }
  return delta;
}

/* ======================= LOGISTICS PRESSURE (v1) =========================
 * Computes and stores:
 *   flags.bbttcc-factions.logistics = { demand, capacity, ratio, band, breakdown, updatedTs }
 * Alpha-friendly: visible + legible, does NOT apply harsh penalties yet.
 * This sprint: Overextension signal only.
 * ------------------------------------------------------------------------ */
// LOGI lives in the economy constants table (item 5, 2026-09-12)

function classifyOverextension(ratio){
  if (!Number.isFinite(ratio)) return "critical";
  if (ratio <= 0.8) return "stable";
  if (ratio <= 1.0) return "stretched";
  if (ratio <= 1.2) return "overextended";
  if (ratio <= 1.5) return "strained";
  return "critical";
}

// --- Territory scanning helpers ---
function isOwnedByFaction(tf, factionId){
  const owner = tf?.factionId || tf?.ownerId || "";
  return String(owner) === String(factionId);
}

// Hex yield is a FACT owned by territory main.js (facts.hex.resources, computed on read from
// type × size + sephirah + modifiers). No cache read here: if facts are missing that is a load
// error worth seeing, not something to paper over with stale flags.
function _hexYield(tf){
  const fn = game.bbttcc?.facts?.hex?.resources;
  if (typeof fn !== "function") { warn("facts.hex.resources missing — territory income cannot be computed"); return { food:0, materials:0, trade:0, military:0, knowledge:0 }; }
  return fn(tf);
}
function getAllOwnedHexDocs(factionId){
  const out = [];
  try {
    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MOD_TERRITORY];
        if (!tf) continue;
        if (!isOwnedByFaction(tf, factionId)) continue;
        out.push({ doc: d, tf, scene: sc, kind: "drawing" });
      }
      for (const t of sc.tiles ?? []) {
        const tf = t.flags?.[MOD_TERRITORY];
        if (!tf) continue;
        if (!isOwnedByFaction(tf, factionId)) continue;
        out.push({ doc: t, tf, scene: sc, kind: "tile" });
      }
    }
  } catch (e) {
    warn("getAllOwnedHexDocs failed", e);
  }
  return out;
}

// Best-effort axial coords extractor: supports multiple schema shapes
function getAxial(tf){
  const q = tf?.hex?.q ?? tf?.axial?.q ?? tf?.q ?? tf?.col ?? tf?.xq ?? null;
  const r = tf?.hex?.r ?? tf?.axial?.r ?? tf?.r ?? tf?.row ?? tf?.yr ?? null;
  if (q === null || r === null) return null;
  const qq = Number(q), rr = Number(r);
  if (!Number.isFinite(qq) || !Number.isFinite(rr)) return null;
  return { q: qq, r: rr };
}

function axialDist(a, b){
  // cube conversion: (q,r,s) where s = -q-r
  const aq = a.q, ar = a.r, as = -aq - ar;
  const bq = b.q, br = b.r, bs = -bq - br;
  return Math.max(Math.abs(aq-bq), Math.abs(ar-br), Math.abs(as-bs));
}

function docCenter(doc){
  // Drawings/Tiles: prefer center if present, else x/y + w/h.
  const x = safeNum(doc?.x);
  const y = safeNum(doc?.y);
  const w = safeNum(doc?.width ?? doc?.shape?.width);
  const h = safeNum(doc?.height ?? doc?.shape?.height);
  return { x: x + (w/2), y: y + (h/2) };
}

function approxGridDistSteps(docA, docB){
  const a = docCenter(docA);
  const b = docCenter(docB);
  const px = Math.hypot(a.x - b.x, a.y - b.y);
  // 10-29 (#35): the hexes' own scene grid — canvas.grid is whatever scene the advancing GM is viewing (a battlemap).
  const grid = safeNum(docA?.parent?.grid?.size ?? docB?.parent?.grid?.size ?? canvas?.grid?.size, 100);
  const steps = px / (grid > 0 ? grid : 100);
  return steps;
}

function chooseCoreHex(owned){
  if (!owned.length) return null;

  const hasMod = (tf, needle) => {
    const mods = Array.isArray(tf?.modifiers) ? tf.modifiers : [];
    return mods.some(m => safeStr(m).toLowerCase() === needle);
  };
  const isCity = (tf) => {
    const t = safeStr(tf?.type).toLowerCase();
    const mods = Array.isArray(tf?.modifiers) ? tf.modifiers : [];
    return t === "city" || mods.some(m => safeStr(m).toLowerCase().includes("city"));
  };

  // Capital modifier wins
  const cap = owned.find(h => hasMod(h.tf, "capital"));
  if (cap) return cap;
  // City type next
  const city = owned.find(h => isCity(h.tf));
  if (city) return city;
  // Fallback: first owned
  return owned[0];
}

function countIntegrationStates(owned){
  let short = 0, occ = 0, full = 0;

  for (const h of owned) {
    // SIM-BADEDEN tuning 2026-06-05: a hex with NO integration flag is settled
    // home territory (peaceful claim/founding), NOT an occupation. The old
    // default (no flag → prog 0 → occ) put every starting faction at
    // occupation-grade demand (×2/hex) from turn 1 — all three sim factions
    // opened at ratio ≥1.1 (strained/overextended) before making a single move.
    if (!h.tf?.integration) continue;
    const integ = h.tf.integration;
    const state = safeStr(integ?.state || integ?.phase || "").toLowerCase();
    const prog  = safeNum(integ?.progress, safeNum(integ?.tier, 0));

    // Heuristics:
    // - explicit state strings if present
    // - else infer from progress (0 = occupation, 1-3 short, 4+ full)
    if (state.includes("occupation")) { occ++; continue; }
    if (state.includes("full")) { full++; continue; }
    if (state.includes("short")) { short++; continue; }

    if (prog <= 0) occ++;
    else if (prog <= 3) short++;
    else full++;
  }

  return { short, occ, full };
}

function countSpecials(owned){
  let city = 0, special = 0;
  let depot = 0, majorPort = 0, roadNet = 0, supplyLine = 0;

  const isMod = (mods, needle) => mods.some(m => safeStr(m).toLowerCase() === needle);
  const hasAny = (mods, needles) => needles.some(n => mods.some(m => safeStr(m).toLowerCase().includes(n)));

  for (const h of owned) {
    const tf = h.tf || {};
    const t = safeStr(tf.type).toLowerCase();
    const mods = Array.isArray(tf.modifiers) ? tf.modifiers : [];

    const isCityHex = (t === "city") || mods.some(m => safeStr(m).toLowerCase().includes("city"));
    if (isCityHex) city++;

    // conservative special list
    const isSpecial = hasAny(mods, ["ruins","megastructure","outpost","port","trade hub","vault","rail yard"]);
    if (isSpecial && !isCityHex) special++;

    // infra (capacity)
    if (isMod(mods, "logistics depot") || mods.some(m => safeStr(m).toLowerCase().includes("depot"))) depot++;
    if (isMod(mods, "major port") || mods.some(m => safeStr(m).toLowerCase().includes("major port"))) majorPort++;
    if (isMod(mods, "road network") || mods.some(m => safeStr(m).toLowerCase().includes("road"))) roadNet++;
    // SIM-BADEDEN tuning 2026-06-05: count Supply Line hexes for capacity credit
    if (mods.some(m => { const t = safeStr(m).toLowerCase(); return t.includes("supply line") || t.includes("supply cache"); })) supplyLine++;   // Supply Cache = logistics infra too (2026-09-09)
  }

  return { city, special, depot, majorPort, roadNet, supplyLine };
}



function readRigs(factionActor){
  const f = factionActor.flags?.[MOD_FACTIONS] || {};
  const rigs = Array.isArray(f.rigs) ? f.rigs : [];
  const activeRigId = f.activeRigId || null;

  let active = 0, logistics = 0;
  for (const r of rigs) {
    const rid = r?.id || r?._id || null;
    const isActive = !!(r?.active || (activeRigId && rid && String(activeRigId) === String(rid)));
    if (isActive) active++;

    const type = safeStr(r?.type).toLowerCase();
    const tags = safeStr(r?.mobilityTags).toLowerCase();
    const preset = safeStr(r?.presetKey || r?.preset).toLowerCase();

    const isLogi = (
      type.includes("support") ||
      type.includes("scout") ||
      preset.includes("support") ||
      tags.includes("support") ||
      tags.includes("supply") ||
      tags.includes("logistics")
    );

    if (isLogi) logistics++;
  }
  // if no rigs list but activeRigId exists, assume 1 active
  if (!rigs.length && activeRigId) active = 1;
  return { activeRigCount: active, logisticsRigCount: logistics };
}

// Effective logistics CAP in marks (2026-09-10). Mirrors op-engine's _readCaps
// resolution order exactly — explicit opCaps → opCapPer → tier band (tier flag,
// else 1 since ruling 18, 2026-10-18 retired the badge) — so a faction with NO
// explicit opCaps flag is sized by its tier band like every wizard-built
// faction. Bank is the last resort only if the flag object is malformed.
// Logistics CAPACITY cap in marks — facts.faction (op-engine) is the one home for tier / caps /
// the capacity floor (2026-09-12, "fix the boat"). The bank is the last resort only if facts are
// absent (logged), never a normal path.
function _logisticsCapMarks(factionActor, bank){
  const fn = game.bbttcc?.facts?.faction?.logisticsCapMarks;
  if (typeof fn === "function") { try { return fn(factionActor); } catch (e) { warn("facts.faction.logisticsCapMarks failed", e); } }
  warn("facts.faction missing — logistics capacity falling back to the bank for", factionActor?.name);
  return safeNum(bank?.logistics);
}

async function computeLogisticsPressureForFaction(factionActor){
  const fid = factionActor.id;

  // 1) Faction-side inputs
  const bank = clone(getFlag(factionActor, `${MOD_FACTIONS}.opBank`, zeroOps()));
  // bank values are MARKS (1 OP = 10 marks); logistics capacity formula was authored in OP units.
  // SIM-BADEDEN tuning 2026-06-05: capacity now keys off the logistics CAP
  // (organizational potential), not the current bank. The old bank-keyed
  // formula was a death spiral: spending logistics (on the very supply lines
  // meant to relieve pressure) cut capacity → worse band → −35% logistics
  // regen → bank pinned at 0 → ratio 10.0 forever (observed turns 3–20, all
  // three sim factions). Falls back to bank if no cap is set.
  // 2026-09-10: resolve the cap through _logisticsCapMarks (explicit opCaps →
  // opCapPer → TIER BAND), never straight to the bank. Onboarding-founded
  // factions carry no explicit opCaps flag; the raw-flag read below sized
  // Errata off its shrinking bank (capacity 3, ratio 1.33 STRAINED) while the
  // wizard-built Sweet Release, same moves, read its caps (ratio 0.67 stable).
  const logisticsMarks = _logisticsCapMarks(factionActor, bank);
  const logisticsOP = Math.floor(logisticsMarks / 10);   // rule unit: one "logistics slot" per 10 marks (not a displayed quantity)

  const { activeRigCount, logisticsRigCount } = readRigs(factionActor);

  // Trade routes: try warlog parse first, else derive on active scene if possible.
  // Trade routes: stored edges are the ONLY counter (facts.routes, 2026-09-12). The war-log parse and
  // the nearest-six geometry guess are gone — three counters for one fact was how a faction read 2
  // routes it never built.
  const tradeRouteCount = (typeof game.bbttcc?.facts?.routes?.trade === "function") ? game.bbttcc.facts.routes.trade(fid) : 0;

  // 2) Territory-side inputs
  const owned = getAllOwnedHexDocs(fid);
  const totalHexes = owned.length;

  const core = chooseCoreHex(owned);

  let avgDist = 0;
  if (core && totalHexes > 0) {
    // Prefer axial distance if present on both ends
    const coreAx = getAxial(core.tf);
    let sum = 0;
    for (const h of owned) {
      const a = coreAx;
      const b = getAxial(h.tf);
      let d = 0;
      if (a && b) d = axialDist(a, b);
      else d = approxGridDistSteps(core.doc, h.doc);
      sum += safeNum(d);
    }
    avgDist = sum / totalHexes;
  }
  const distSteps = Math.floor(avgDist);

  const { short: shortIntegCount, occ: occupationCount, full: fullIntegCount } = countIntegrationStates(owned);
  const { city: cityCount, special: specialCount, depot: infraDepotCount, majorPort: infraMajorPortCount, roadNet: infraRoadNetCount, supplyLine: infraSupplyLineCount } = countSpecials(owned);

  // 3) Compute Demand
  const baseDemand = totalHexes * LOGI.DEMAND_TERRITORY_PER_HEX;
  const integDemand = (shortIntegCount * LOGI.DEMAND_SHORT_PER_HEX) + (occupationCount * LOGI.DEMAND_OCCUPATION_PER_HEX);
  const distanceDemand = distSteps * LOGI.DEMAND_DISTANCE_PER_STEP;
  const specialDemand = (cityCount * LOGI.DEMAND_CITY_PER_HEX) + (specialCount * LOGI.DEMAND_SPECIAL_PER_HEX);
  const rigDemand = activeRigCount * LOGI.DEMAND_RIG_PER_ACTIVE;

  // Sprawl surcharge (v1.2): max(0, totalHexes - 4)^2 * 0.25
  const sprawlExcess = Math.max(0, Number(totalHexes || 0) - LOGI.SPRAWL_THRESHOLD);
  const sprawlDemand = (sprawlExcess > 0)
    ? (Math.pow(sprawlExcess, LOGI.SPRAWL_EXP) * LOGI.SPRAWL_MULT)
    : 0;

  const demand = baseDemand + integDemand + distanceDemand + specialDemand + rigDemand + sprawlDemand;

  // 4) Compute Capacity
  const opCapacity = logisticsOP * LOGI.CAPACITY_PER_LOGISTICS_OP;
  // 2026-09-10 (owner ruling): linear, like every other capacity source — floor(n/2) pairs
  // gave a faction's FIRST trade route nothing at all.
  const tradeCapacity = tradeRouteCount * LOGI.CAPACITY_PER_TRADEROUTE;
  const integrationCapacity = fullIntegCount * LOGI.CAPACITY_FULL_INTEG_PER_HEX;
  const infraCapacity =
    (infraDepotCount * LOGI.CAPACITY_INFRA_DEPOT) +
    (infraMajorPortCount * LOGI.CAPACITY_INFRA_MAJORPORT) +
    (infraRoadNetCount * LOGI.CAPACITY_INFRA_ROADNET) +
    (infraSupplyLineCount * LOGI.CAPACITY_INFRA_SUPPLYLINE);
  const rigCapacity = logisticsRigCount * LOGI.CAPACITY_LOGI_RIG;

  const capacity = opCapacity + tradeCapacity + integrationCapacity + infraCapacity + rigCapacity;

  // 5) Ratio & band
  const ratio = capacity > 0 ? (demand / capacity) : Infinity;
  const band = classifyOverextension(ratio);

  // 6) Payload
  const payload = {
    demand: Math.round(demand * 100) / 100,
    capacity: Math.round(capacity * 100) / 100,
    ratio: (Number.isFinite(ratio) ? Math.round(ratio * 1000) / 1000 : ratio),
    band,
    updatedTs: Date.now(),
    breakdown: {
      demand: { baseDemand, integDemand, distanceDemand, specialDemand, rigDemand, sprawlDemand },
      capacity: { opCapacity, tradeCapacity, integrationCapacity, infraCapacity, rigCapacity },
      counts: { totalHexes, sprawlExcess,
        shortIntegCount,
        occupationCount,
        fullIntegCount,
        cityCount,
        specialCount,
        infraDepotCount,
        infraMajorPortCount,
        infraRoadNetCount,
        infraSupplyLineCount,
        activeRigCount,
        logisticsRigCount,
        tradeRouteCount,
        distSteps
      }
    }
  };

  return payload;
}

// Cap clamp after the spend (2026-09-12) — see advanceOPRegen deferCapClamp. Marks above the
// cap are still lost (caps stay hard — owner ruling), but only what the faction did not spend.
async function clampBanksToCaps(){
  const rows = [];
  for (const A of allFactions()) {
    try {
      const bank = clone(getFlag(A, `${MOD_FACTIONS}.opBank`, zeroOps()));
      const caps = effectiveCapsFor(A);
      const lost = {}; let dirty = false;
      for (const k of Object.keys(bank)) {
        const cap = Number(caps[k] ?? 0) + (Number(caps[k] ?? 0) > 0 ? capBumpFor(A, k) : 0);
        if (cap > 0 && Number(bank[k]) > cap) { lost[k] = Number(bank[k]) - cap; bank[k] = cap; dirty = true; }
      }
      if (!dirty) continue;
      const wl = clone(getFlag(A, `${MOD_FACTIONS}.warLogs`, [])) || [];
      wl.push({ ts: Date.now(), date: (new Date()).toLocaleString(), type: "turn", activity: "cap_clamp", summary: `Over cap after spend — lost ${Object.entries(lost).map(([k, v]) => `${v} ${k}`).join(", ")}.` });
      await A.update({ [`flags.${MOD_FACTIONS}.opBank`]: bank, [`flags.${MOD_FACTIONS}.warLogs`]: wl });
      rows.push({ factionId: A.id, lost });
    } catch (e) { warn("clampBanksToCaps failed for", A?.name, e); }
  }
  return { changed: rows.length > 0, rows };
}

async function computeLogisticsPressureForAllFactions({ apply=false } = {}){
  if (!apply) return { changed:false, rows:[] };
  const rows = [];
  const updates = [];
  for (const F of allFactions()) {
    try {
      const metrics = await computeLogisticsPressureForFaction(F);
      rows.push({ factionId: F.id, factionName: F.name, ...metrics });
      updates.push(F.update({ [`flags.${MOD_FACTIONS}.logistics`]: metrics }));
    } catch (e) {
      warn("computeLogisticsPressureForFaction failed for", F?.name, e);
    }
  }
  if (updates.length) await Promise.allSettled(updates);
  return { changed: updates.length > 0, rows };
}

/* ------------------------------- OP regen -------------------------------- */
/* ------------- territory matrix income (RES_TO_OP, leyline-aware) ----------
 * SIM-BADEDEN 2026-06-05 (owner call): main.js has carried the INTENDED income
 * engine all along — resourcesToOP() converts each hex's resources into a
 * weighted six-bucket OP vector (incl. nonLethal + softPower, which the crude
 * DEFAULT_REGEN_MAP never feeds), modulated by the hex's leyline flowState
 * (surge ×1.3, stagnation ×0.6, inversion swaps V↔SP / D↔I). It was only ever
 * used as a UI cache ("harmless for UI"). This wires it into real income:
 * per-hex, per-flow-state, summed per faction. The matrix has no logistics
 * lane (it predates food→logistics), so food keeps feeding logistics 1:1.
 * Falls back to the legacy stockpile map when the API/hexes are unavailable.
 * -------------------------------------------------------------------------- */
// Culture + faith lane bonuses (owner ruling 2026-09-12; resource weights are RES_TO_OP rows in
// territory main.js). Per hex TYPE (temples pray, cities mix), per SIZE ("people pray and sing"),
// and per stationed FACILITY — a facility is a stationary `rig` actor in the hex's holdings, keyed
// by name the same way the holdings DC bonus is (garrison/forge/cannon/trade). A dedicated temple
// facility earns faith on any hex; St Gilliam's is a B&B, so no bonus unless someone builds one.
// LANE_HEX_BONUS lives in the economy constants table
function laneHexBonus(tf){
  const type = String(tf?.type || "").toLowerCase(), size = String(tf?.size || "").toLowerCase();
  const out = { culture:0, faith:0 };
  const facNames = [];
  try {
    for (const id of (Array.isArray(tf?.holdings?.rigIds) ? tf.holdings.rigIds : [])) {
      const R = game.bbttcc?.rigs;   // rig accessor (2026-10-08): works on dnd5e vehicles too
      const a = game.actors?.get(String(id)); if (!a || !R?.isRig(a)) continue;
      if (String(R.data(a)?.identity?.mobility || "mobile").toLowerCase() === "mobile") continue;   // mobile rigs are rigs, not facilities
      facNames.push(String(a.name || "").toLowerCase());
    }
  } catch (_e) {}
  // by hex MODIFIER (2026-09-13, Red Thread Field): a named holding pays a lane, doubled on a leyline surge
  const modNames = (Array.isArray(tf?.modifiers) ? tf.modifiers : []).map(m => String(m || "").trim().toLowerCase());
  const surge = String(tf?.leylines?.flowState || "normal").toLowerCase() === "surge";
  for (const [lane, L] of Object.entries(LANE_HEX_BONUS)) {
    let v = (L.byType[type] || 0) + (L.bySize[size] || 0);
    for (const n of facNames) for (const [key, b] of Object.entries(L.byFacility)) if (n.includes(key)) { v += b; break; }
    for (const [key, b] of Object.entries(L.byModifier || {})) if (modNames.includes(key)) v += b * (surge ? LANE_BY_MODIFIER_SURGE_MULT : 1);
    out[lane] = v;
  }
  return out;
}
function computeTerritoryMatrixIncome(factionActor){
  try {
    const convert = game.bbttcc?.api?.territory?.resourcesToOP;
    if (typeof convert !== "function") return null;
    const owned = getAllOwnedHexDocs(factionActor.id);
    if (!owned.length) return null;
    const KEYMAP = { economy:"economy", violence:"violence", nonLethal:"nonlethal", intrigue:"intrigue", diplomacy:"diplomacy", softPower:"softpower", culture:"culture", faith:"faith" };   // culture/faith lanes 2026-09-12
    const out = zeroOps();
    const flows = {};
    for (const h of owned) {
      const tf = h.tf || {};
      const res = _hexYield(tf);   // facts.hex.resources — yield COMPUTED on read (2026-09-12)
      const flow = String(tf.leylines?.flowState || "normal");
      flows[flow] = (flows[flow] || 0) + 1;
      const v = convert(res, flow) || {};
      for (const [mk, canon] of Object.entries(KEYMAP)) out[canon] += safeNum(v[mk]);
      out.logistics += safeNum(res.food); // preserved legacy logistics lane
      const lb = laneHexBonus(tf); out.culture += lb.culture; out.faith += lb.faith;   // type / size / facility bonus (2026-09-12)
    }
    for (const k of Object.keys(out)) out[k] = Math.max(0, Math.round(safeNum(out[k])));
    return { delta: out, flows };
  } catch (e) {
    warn("territory matrix income failed; falling back to stockpile map", e);
    return null;
  }
}

// One-clock economy (Dave 2026-11-02): the month's base income, computed WITHOUT writing the bank or posting a
// card — the same numbers advanceOPRegen(apply:true) credits, BEFORE the Unity / Enlightened wrappers. persist:true
// (advanceOPRegen only) keeps the old side effect of saving a stockpile derived from owned hexes.
async function computeRegenIncomeFor(A, { persist=false } = {}){
  // 1) Read bank + existing stock
  const opBank  = clone(getFlag(A, `${MOD_FACTIONS}.opBank`,    zeroOps()));
  let   stock   = clone(getFlag(A, `${MOD_FACTIONS}.stockpile`, zeroRes()));

  // 2) Fallback: derive stockpile from owned hexes if empty
  if (isEmptyStockpile(stock)) {
    const derived = deriveStockpileFromOwnedHexes(A.id);
    // Write the derived stockpile so future turns don't have to rebuild it
    stock = derived;
    if (persist) try { await A.update({ [`flags.${MOD_FACTIONS}.stockpile`]: stock }); } catch {}
  }

  // 3) Regen parameters (allow per-faction overrides)
  const map     = { ...DEFAULT_REGEN_MAP, ...(getFlag(A, `${MOD_FACTIONS}.opRegenMap`, {})||{}) };
  const factors = { ...DEFAULT_FACTORS,  ...(getFlag(A, `${MOD_FACTIONS}.opRegenFactors`, {})||{}) };

  // 4) Compute OP delta — territory matrix first (intended engine), legacy
  // stockpile map as fallback. Matrix income flows live from hexes each
  // turn; the stockpile burn-down only applies on the legacy path.
  const matrix = computeTerritoryMatrixIncome(A);
  const usedMatrix = !!matrix;
  const opsDelta = usedMatrix ? matrix.delta : computeOpsFromStockpile(stock, map, factors);

  // 4.1) Overextension → Logistics regen multiplier (Alpha v1)
  // We compute logistics pressure on-demand here so the penalty applies immediately this turn.
  let over = null;
  try {
    over = await computeLogisticsPressureForFaction(A);
  } catch (e) {
    warn("Overextension: logistics metric compute failed (non-fatal).", A?.name, e);
    over = null;
  }

  let logiMult = 1;
  if (over?.band === "overextended") logiMult = 0.90;
  else if (over?.band === "strained") logiMult = 0.80;
  else if (over?.band === "critical") logiMult = 0.65;

  let logiBefore = safeNum(opsDelta.logistics);
  if (logiMult !== 1 && logiBefore > 0) {
    opsDelta.logistics = Math.floor(logiBefore * logiMult);
  }
  // Per-faction income plan (2026-09-09): bonuses.regenPlan[{inTurns, mult, channels?}] — entries due now (inTurns ≤ 1) multiply this Advance's income.
  const regenNotes = [];
  try {
    const plan = A.getFlag("bbttcc-factions", "bonuses")?.regenPlan;
    if (Array.isArray(plan)) for (const e of plan) {
      if (safeNum(e?.inTurns, 1) > 1) continue;
      const mult = Number(e?.mult); if (!Number.isFinite(mult) || mult === 1) continue;
      const chans = Array.isArray(e?.channels) && e.channels.length ? e.channels : Object.keys(opsDelta);
      for (const k of chans) { const b0 = safeNum(opsDelta[k]); if (b0 > 0) opsDelta[k] = Math.floor(b0 * mult); }
      regenNotes.push(`${e?.label || "income plan"}: ${chans.length === Object.keys(opsDelta).length ? "all channels" : chans.join("/")} ×${mult}`);
    }
  } catch (e) { warn("regenPlan apply failed", e); }
  // Loyalty stability (wired 2026-09-10, owner ruling): advance-turn.tracks
  // doLoyaltyPhase1 writes bonuses.nextTurn.opGainPct (−20/−10/+5/+10 by
  // loyalty band) for THE NEXT Advance — this one. It had no reader and no
  // expiry, so it only ever accumulated (Errata −40% by turn 2). Applied here
  // to every channel's income; tickFactionBonuses (after regen) expires it
  // and defenseDC together, so each turn's loyalty phase starts clean.
  try {
    const pctRaw = Number(A.getFlag("bbttcc-factions", "bonuses")?.nextTurn?.opGainPct);
    const pct = Number.isFinite(pctRaw) ? Math.max(-100, Math.min(100, pctRaw)) : 0;
    if (pct !== 0) {
      const mult = 1 + pct / 100;
      for (const k of Object.keys(opsDelta)) { const b0 = safeNum(opsDelta[k]); if (b0 > 0) opsDelta[k] = Math.max(0, Math.floor(b0 * mult)); }
      regenNotes.push(`loyalty stability: all channels ${pct > 0 ? "+" : ""}${pct}%`);
    }
  } catch (e) { warn("loyalty opGainPct apply failed", e); }
  // The Town Militia, DRILLED (STORY FLOW D-3, 2026-09-17): +5 marks Violence per Advance while drilled or standing
  try {
    const ms = game.bbttcc?.api?.raid?.militia?.state ? game.bbttcc.api.raid.militia.state(A) : null;
    if (ms && ms.rung >= 2) { opsDelta.violence = safeNum(opsDelta.violence) + 5; regenNotes.push("the militia drills: Violence +5 marks"); }
  } catch (e) { warn("militia regen apply failed", e); }
  // Steward identity income (rulings CO3 as amended + CO21, 2026-10-26). Flat part = the OP engine's member reader
  // (flags.bbttcc-character-options.bonuses, OP × MARKS_PER_OP, facts.faction.memberIncome). The rest reads
  // flags.fourththing.domainIncome on an assigned steward's items: pct (all channels or `channels`),
  // perHexType [{types, channel, op}] counted over the Domain's hexes (type or terrain key), perHexes {channel, per, op, min}.
  try {
    const flat = game.bbttcc?.facts?.faction?.memberIncome?.(A) || {};
    const flatNotes = [];
    for (const [k, v] of Object.entries(flat)) { const n = safeNum(v); if (n > 0 && (k in opsDelta)) { opsDelta[k] = safeNum(opsDelta[k]) + n; flatNotes.push(`${k} +${n}`); } }
    if (flatNotes.length) regenNotes.push(`steward identity: ${flatNotes.join(", ")}`);
    const mpo = Number(game.bbttcc?.api?.op?.marksPerOp?.()) || 0;   // the live ratio authority; 0 = unavailable → skip the hex parts
    const ownedHexes = getAllOwnedHexDocs(A.id);
    const hexTypes = ownedHexes.map(h => {
      const tf = h.tf || {}; const terr = (tf.terrain && typeof tf.terrain === "object") ? tf.terrain.key : (tf.terrainKey || tf.terrainType || tf.terrain);
      return [String(tf.type || "").toLowerCase(), String(terr || "").toLowerCase()];
    });
    const stewards = stewardsOf(A);
    for (const st of stewards) for (const it of (st.items?.contents || [])) {
      const di = it.flags?.fourththing?.domainIncome;
      if (!di || typeof di !== "object") continue;
      const pct = safeNum(di.pct);
      if (pct) {
        const chs = (Array.isArray(di.channels) && di.channels.length ? di.channels : Object.keys(opsDelta)).filter(k => k in opsDelta);
        for (const k of chs) { const b0 = safeNum(opsDelta[k]); if (b0 > 0) opsDelta[k] = Math.floor(b0 * (1 + pct / 100)); }
        regenNotes.push(`${it.name}: ${chs.length === Object.keys(opsDelta).length ? "all channels" : chs.join("/")} ${pct > 0 ? "+" : ""}${pct}%`);
      }
      if (!(mpo > 0)) continue;
      for (const row of (Array.isArray(di.perHexType) ? di.perHexType : [])) {
        const types = (Array.isArray(row?.types) ? row.types : []).map(s => String(s).toLowerCase()); const k = row?.channel;
        if (!(k in opsDelta) || !types.length) continue;
        const n = hexTypes.filter(([ty, te]) => types.includes(ty) || types.includes(te)).length;
        const gain = n * safeNum(row.op) * mpo;
        if (gain > 0) { opsDelta[k] = safeNum(opsDelta[k]) + gain; regenNotes.push(`${it.name}: ${n} hex${n === 1 ? "" : "es"} → ${k} +${gain}`); }
      }
      const ph = di.perHexes;
      if (ph && (ph.channel in opsDelta)) {
        const gain = Math.max(safeNum(ph.min), Math.floor(ownedHexes.length / Math.max(1, safeNum(ph.per, 1)))) * safeNum(ph.op) * mpo;
        if (gain > 0) { opsDelta[ph.channel] = safeNum(opsDelta[ph.channel]) + gain; regenNotes.push(`${it.name}: ${ownedHexes.length} hexes → ${ph.channel} +${gain}`); }
      }
    }
  } catch (e) { warn("steward identity income failed (non-fatal)", e); }
  const totalGained = Object.values(opsDelta).reduce((a,b)=>a+b,0);
  return { opBank, stock, map, factors, matrix, usedMatrix, opsDelta, over, logiMult, logiBefore, regenNotes, totalGained };
}
// Public: computeRegenIncome(factionActor | id) → { pool: marks } (side-effect free).
async function computeRegenIncome(factionActor){
  const A = (typeof factionActor === "string") ? game.actors.get(factionActor) : factionActor;
  if (!A) return {};
  const { opsDelta } = await computeRegenIncomeFor(A, { persist:false });
  const out = {}; for (const [k, v] of Object.entries(opsDelta || {})) out[k] = safeNum(v);
  return out;
}

/* ---------------- weekly income slices (one clock, Dave 2026-11-02) ----------------
 * A World Turn is a month of 30 Turn Ledger days. The month's income is paid in four weekly
 * slices at the START of each week (slice 1 from day 0, 2 at ≥7 days spent, 3 at ≥14, 4 at ≥21):
 * floor(base income / 4) per pool, clamped to caps when it lands (a full bank wastes it —
 * spend it or lose it). Each faction records what it was paid NOMINALLY this turn on
 * flags.bbttcc-factions.incomeSlices = { turn, slices:[1,..], nominal:{pool:marks} }.
 * The Advance still runs the full regen (so Unity / Enlightened wrappers see the whole month)
 * and then debits this turn's nominal slices back out — net = the month's total, paid early.
 * ------------------------------------------------------------------------------------ */
const INCOME_SLICE_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
function worldTurnNow(){
  try { return Math.max(0, Math.floor(Number(game.bbttcc?.api?.world?.getState?.()?.turn || 0) || 0)); } catch { return 0; }
}
// dueIncomeSlices(spentDays) → the slice numbers due so far this month, e.g. 9 → [1, 2].
function dueIncomeSlices(spentDays = 0){
  const d = Math.max(0, safeNum(spentDays));
  const out = [1];
  if (d >= 7) out.push(2);
  if (d >= 14) out.push(3);
  if (d >= 21) out.push(4);
  return out;
}
// This turn's slice record for a faction (a record from another turn reads as empty).
function incomeSliceRecord(A, turn = worldTurnNow()){
  const r = getFlag(A, `${MOD_FACTIONS}.incomeSlices`, null);
  if (!r || typeof r !== "object" || safeNum(r.turn, -1) !== turn) return { turn, slices: [], nominal: {} };
  return { turn, slices: Array.isArray(r.slices) ? r.slices.map(Number) : [], nominal: (r.nominal && typeof r.nominal === "object") ? clone(r.nominal) : {} };
}
function incomeSliceCaps(A){
  const caps = clone(effectiveCapsFor(A) || {});
  for (const k of INCOME_SLICE_KEYS) { const c = safeNum(caps[k]); if (c > 0) caps[k] = c + capBumpFor(A, k); }
  return caps;
}
let __incomeSliceChain = Promise.resolve();
async function _payIncomeSliceNow({ slice } = {}){
  const n = Math.floor(Number(slice));
  if (!game.user?.isGM) return { ok:false, reason:"gm-only" };
  if (!(n >= 1 && n <= 4)) return { ok:false, reason:"slice must be 1..4" };
  // A slice landing in the middle of an Advance would be recorded against the turn that is ending.
  if (window._bbttccTurnLock) return { ok:false, reason:"turn-running" };
  // Round 4 (2026-11-05): worldTurnNow reads 0 while the world API is still attaching. That read as a new month and paid an already paid slice on page load.
  if (!game.bbttcc?.api?.world?.getState?.()) return { ok:false, reason:"world-not-ready" };
  const turn = worldTurnNow();
  const op = game.bbttcc?.api?.op;
  const rows = [];
  for (const A of allFactions()) {
    try {
      const rec = incomeSliceRecord(A, turn);
      if (rec.slices.includes(n)) { rows.push({ factionId: A.id, factionName: A.name, skipped: "already-paid" }); continue; }
      const income = await computeRegenIncome(A);
      const pay = {};
      for (const k of INCOME_SLICE_KEYS) { const v = Math.floor(Math.max(0, safeNum(income[k])) / 4); if (v > 0) pay[k] = v; }
      let landed = {}, lost = {};
      if (Object.keys(pay).length) {
        if (op && typeof op.commit === "function") {
          const r = await op.commit(A.id, pay, { source: "income", label: `Week ${n} income`, noDiscount: true, clampToCap: true, opCaps: incomeSliceCaps(A) });
          if (r?.ok === false) { warn("income slice commit refused", A.name, r); rows.push({ factionId: A.id, factionName: A.name, error: r?.error || "commit refused" }); continue; }
          lost = r?.clamped || {};
          for (const [k, v] of Object.entries(pay)) { const got = v - safeNum(lost[k]); if (got > 0) landed[k] = got; }
        } else {
          const bank = clone(getFlag(A, `${MOD_FACTIONS}.opBank`, zeroOps()));
          const caps = incomeSliceCaps(A);
          for (const [k, v] of Object.entries(pay)) {
            const cap = safeNum(caps[k]); const before = safeNum(bank[k]);
            const room = cap > 0 ? Math.max(0, cap - before) : v;
            const got = Math.min(v, room);
            bank[k] = before + got; if (got > 0) landed[k] = got; if (v > got) lost[k] = v - got;
          }
          await A.update({ [`flags.${MOD_FACTIONS}.opBank`]: bank });
        }
      }
      // Record the NOMINAL slice (what the month owed), whatever the cap wasted — the Advance debits exactly this.
      const nominal = {};
      for (const k of INCOME_SLICE_KEYS) nominal[k] = safeNum(rec.nominal[k]) + safeNum(pay[k]);
      await A.update({ [`flags.${MOD_FACTIONS}.incomeSlices`]: { turn, slices: [...rec.slices, n].sort(), nominal } });
      rows.push({ factionId: A.id, factionName: A.name, paid: pay, landed, lost });
    } catch (e) { warn("payIncomeSlice failed for", A?.name, e); rows.push({ factionId: A?.id, factionName: A?.name, error: String(e?.message || e) }); }
  }
  const paidRows = rows.filter(r => r.paid);
  if (paidRows.length) {
    const esc = foundry.utils.escapeHTML;
    const fmt = (o) => fmtActivityCost(o) || "nothing";
    const lines = paidRows.map(r => `<li><b>${esc(r.factionName)}</b>: ${esc(fmt(r.landed))}${Object.keys(r.lost || {}).length ? ` <em>(full — ${esc(fmt(r.lost))} lost to the cap)</em>` : ""}</li>`).join("");
    try {
      await ChatMessage.create({
        content: `<p><b>Week ${n}:</b> the Domains' income comes in —</p><ul>${lines}</ul>`,
        whisper: (game.users ?? []).filter(u => u.isGM).map(u => u.id),
        speaker: { alias: "Bad Eden Turn Driver" }
      });
    } catch (_e) {}
  }
  return { ok:true, slice: n, turn, rows };
}
// payIncomeSlice({ slice }) — GM only, idempotent per (world turn, slice). Calls are serialized.
function payIncomeSlice(args = {}){
  const run = __incomeSliceChain.then(() => _payIncomeSliceNow(args), () => _payIncomeSliceNow(args));
  __incomeSliceChain = run.catch(() => {});
  return run;
}
// Advance (apply only): after the full regen, take this turn's nominal slices back out of each bank and clear the record.
async function debitPaidIncomeSlices(){
  const turn = worldTurnNow();
  const op = game.bbttcc?.api?.op;
  const rows = [];
  for (const A of allFactions()) {
    try {
      const raw = getFlag(A, `${MOD_FACTIONS}.incomeSlices`, null);
      if (!raw) continue;
      const rec = incomeSliceRecord(A, turn);   // a record from another turn is stale: cleared, never debited
      const bank = clone(getFlag(A, `${MOD_FACTIONS}.opBank`, zeroOps()));
      const debit = {}, short = {};
      for (const k of INCOME_SLICE_KEYS) {
        const want = Math.max(0, safeNum(rec.nominal[k])); if (!want) continue;
        const take = Math.min(want, Math.max(0, safeNum(bank[k])));   // income shrank since the slice: never below 0
        if (take > 0) debit[k] = take; if (want > take) short[k] = want - take;
      }
      if (Object.keys(debit).length) {
        const neg = {}; for (const [k, v] of Object.entries(debit)) neg[k] = -v;
        let done = false;
        if (op && typeof op.commit === "function") {
          const r = await op.commit(A.id, neg, { source: "income", label: "Weekly income slices already paid", noDiscount: true, allowOvercap: true });
          done = r?.ok !== false;
        }
        if (!done) {
          const b2 = clone(getFlag(A, `${MOD_FACTIONS}.opBank`, zeroOps()));
          for (const [k, v] of Object.entries(debit)) b2[k] = Math.max(0, safeNum(b2[k]) - v);
          await A.update({ [`flags.${MOD_FACTIONS}.opBank`]: b2 });
        }
      }
      await A.unsetFlag(MOD_FACTIONS, "incomeSlices");
      if (rec.slices.length) {
        const wl = clone(getFlag(A, `${MOD_FACTIONS}.warLogs`, [])) || [];
        wl.push({ ts: Date.now(), date: (new Date()).toLocaleString(), type: "turn", activity: "income_slices",
          summary: `${rec.slices.length} weekly slice(s) already paid this month (${fmtActivityCost(debit) || "nothing"}) — the Advance credited only the rest.${Object.keys(short).length ? ` Income shrank since: ${fmtActivityCost(short)} could not be taken back.` : ""}` });
        await A.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl });
        rows.push({ factionId: A.id, factionName: A.name, slices: rec.slices.length, debit, short });
      }
    } catch (e) { warn("debitPaidIncomeSlices failed for", A?.name, e); }
  }
  return { changed: rows.length > 0, rows };
}

/* ---------------- going home (one clock, Dave 2026-11-02) ----------------
 * "If the table stops early, the remaining days become time at home. The Stewards run the month's
 * planned activities in person for a bonus, and recover." At an APPLIED Advance the Turn Ledger's
 * remaining days are read BEFORE anything else runs (the campaign module resets the ledger at
 * advanceTurn:end): homeWeeks = min(3, floor(remaining / 7)). Per home week:
 *   • IN PERSON — every planned activity that resolves gets HOME_REFUND_PCT_PER_WEEK % of the price it
 *     was billed back (per channel, floored) BEFORE its effect runs, so the price the activity ledger
 *     records (and ↩ Back out / a failure refund give back) is the net one. No activity outcome in the
 *     catalog scales uniformly (each throughput handler writes its own fixed deltas), so the bonus is
 *     on the price: the Stewards did the work themselves.
 *   • RECOVER — each Domain's assigned Steward(s) ease one level of Strain (game.fourththing.strain.recover,
 *     the same step a Soma Break takes).
 * ---------------------------------------------------------------------------------------------- */
const HOME_WEEKS_MAX = 3;
const HOME_REFUND_PCT_PER_WEEK = 10;
const HOME_STRAIN_PER_WEEK = 1;
// The snapshot this Advance runs under (set at the top of an applied driverAdvanceTurn, cleared in its finally).
let __homeAdvance = null;   // { weeks, remaining, month } | null
function homeWeeksFromRemaining(remaining){
  const r = Number(remaining);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.max(0, Math.min(HOME_WEEKS_MAX, Math.floor(r / 7)));
}
// Public: homeWeeks() → the home weeks the current month would give if the GM advanced now (read-only, live ledger).
function homeWeeks(){
  try {
    const b = game.bbttcc?.api?.world?.getTimeBudget?.();
    if (!b || !Number.isFinite(Number(b.remaining))) return 0;
    return homeWeeksFromRemaining(b.remaining);
  } catch { return 0; }
}
function homeRefundFor(paid, weeks){
  const out = {};
  const w = Math.max(0, Math.floor(Number(weeks) || 0));
  if (!w) return out;
  for (const [k, v] of Object.entries(paid || {})) {
    const n = Math.floor(safeNum(v) * HOME_REFUND_PCT_PER_WEEK * w / 100);
    if (n > 0) out[k] = Math.min(n, safeNum(v));
  }
  return out;
}
// The Steward of a Domain (ONE STEWARD, ONE DOMAIN, 2026-11-07): the OP engine's reader — the roster's one Steward,
// else every character assigned (NPC Domains). Fallback keeps the old filter if the facts layer isn't up.
function stewardsOf(A){
  const f = game.bbttcc?.facts?.faction?.stewards;
  if (typeof f === "function") { try { return f(A) || []; } catch (_e) { /* fall through */ } }
  return (game.actors?.contents || []).filter(a => a.type === "character" && a.getFlag?.(MOD_FACTIONS, "factionId") === A.id);
}
async function homeRecoverStewards(weeks){
  const rows = [];
  const S = game.fourththing?.strain;
  const n = Math.max(0, Math.floor(Number(weeks) || 0)) * HOME_STRAIN_PER_WEEK;
  if (!n || typeof S?.recover !== "function" || typeof S?.get !== "function") return rows;
  for (const A of allFactions()) {
    for (const st of stewardsOf(A)) {
      try {
        const before = safeNum(S.get(st));
        if (before <= 0) continue;
        await S.recover(st, n, "time at home");
        const after = safeNum(S.get(st));
        if (after < before) rows.push({ factionId: A.id, factionName: A.name, actorId: st.id, name: st.name, before, after });
      } catch (e) { warn("home recovery failed for", st?.name, e); }
    }
  }
  return rows;
}
// One line to the table, in the turn-end voice. Rows = consumePlanned rows (resolved ones carry spendResult.homeRefund).
async function postHomeLine({ home, plannedRows = [], recovered = [] } = {}){
  if (!home?.weeks) return;
  const esc = foundry.utils.escapeHTML;
  const byFaction = new Map();
  for (const r of plannedRows) {
    const hr = r?.spendResult?.homeRefund;
    if (!hr || !Object.keys(hr).length || r?.effectResult?.ok === false) continue;
    const id = String(r.attackerId || "");
    const cur = byFaction.get(id) || { n: 0, back: {} };
    cur.n += 1; for (const [k, v] of Object.entries(hr)) cur.back[k] = safeNum(cur.back[k]) + safeNum(v);
    byFaction.set(id, cur);
  }
  const W = home.weeks;
  const ran = [...byFaction.entries()].map(([id, v]) => `${esc(game.actors.get(id)?.name || "a Domain")}: ${v.n} order${v.n === 1 ? "" : "s"}, ${esc(fmtActivityCost(v.back) || "nothing")} back`);
  const rec = recovered.map(r => `${esc(r.name)} Strain ${r.before} → ${r.after}`);
  const parts = [];
  parts.push(ran.length ? `they ran the orders themselves (${ran.join("; ")})` : "no orders to run, so they rested");
  if (rec.length) parts.push(`and recovered (${rec.join(", ")})`);
  try {
    await ChatMessage.create({
      content: `<p><b>Month ${home.month}:</b> the Stewards came home with ${W} week${W === 1 ? "" : "s"} to spare — ${parts.join(" ")}.</p>`,
      whisper: tableAudience(),
      speaker: { alias: "Bad Eden Turn Driver" }
    });
  } catch (_e) {}
}

async function advanceOPRegen({ apply=false, factionId=null, deferCapClamp=false } = {}){
  const targets = factionId ? [game.actors.get(factionId)].filter(Boolean) : allFactions();
  const results = [];

  for (const A of targets) {
    try {
      const { opBank, stock, map, factors, matrix, usedMatrix, opsDelta, over, logiMult, logiBefore, regenNotes, totalGained } = await computeRegenIncomeFor(A, { persist:true });

      const row = { factionId: A.id, factionName: A.name, gained: totalGained, opsDelta, applied:false };
      results.push(row);

      if (apply && totalGained > 0) {
        // proportional burn-down of stockpile (simple floor-based consume) —
        // LEGACY PATH ONLY: matrix income flows live from territory and does
        // not consume the stockpile (it stays a material store for builds).
        const newStock = clone(stock);
        if (!usedMatrix) {
          for (const [res, amtRaw] of Object.entries(stock||{})) {
            const amt = safeNum(amtRaw); if (!amt || amt <= 0) continue;
            const key = map[res]; if (!key) continue;
            const fac = safeNum(factors?.[res], 1); if (!(fac > 0)) continue;
            const gainedRes = Math.floor(amt * fac); if (gainedRes <= 0) continue;
            const consumed = Math.min(amt, Math.ceil(gainedRes / fac));
            newStock[res] = Math.max(0, amt - consumed);
          }
        }

        const newBank = addOps(opBank, opsDelta);
        // ------------------------------------------------------------
        // OP CAP ENFORCEMENT
        // ------------------------------------------------------------
        // 2026-09-12: with REGEN BEFORE SPEND the clamp must wait until planned activities
        // have been paid — a bank sitting at cap otherwise throws this turn's income away
        // before the spend it was meant to fund (Errata lost 18 economy on the first Advance
        // under the new order). driverAdvanceTurn passes deferCapClamp and calls
        // clampBanksToCaps() after plannedRaidsStep; dry runs / legacy callers clamp here.
        if (!deferCapClamp) try {
          const caps = effectiveCapsFor(A);
          const keys = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

          for (const k of keys) {
            const cap = Number(caps[k] ?? 0) + (Number(caps[k] ?? 0) > 0 ? capBumpFor(A, k) : 0);   // temporary cap bumps (Training Drills)
            if (cap > 0) {
              newBank[k] = Math.min(Number(newBank[k] ?? 0), cap);
            }
          }
        } catch (e) {
          console.warn("[bbttcc-turn] OP cap clamp failed", e);
        }
        await A.update({ [`flags.${MOD_FACTIONS}.opBank`]: newBank, [`flags.${MOD_FACTIONS}.stockpile`]: newStock });

        const warLogs = clone(getFlag(A, `${MOD_FACTIONS}.warLogs`, [])) || [];
        if (regenNotes.length) warLogs.push({ ts: Date.now(), date: (new Date()).toLocaleString(), type: "turn", activity: "regen_plan", summary: `Income plan: ${regenNotes.join("; ")}.` });
        // Overextension note (only when it actually reduces logistics regen)
        if (logiMult !== 1 && logiBefore > 0) {
          const nowTs = Date.now();
          const pct = Math.round((1 - logiMult) * 100);
          const ratioStr = (typeof over?.ratio === "number" && isFinite(over.ratio)) ? over.ratio.toFixed(3) : "—";
          warLogs.push({
            ts: nowTs,
            date: (new Date(nowTs)).toLocaleString(),
            type: "turn",
            activity: "overextension",
            summary: `Overextension: ${over?.band || "unknown"} — Logistics regen -${pct}% (ratio ${ratioStr}) [${logiBefore}→${opsDelta.logistics}]`
          });
        }
        warLogs.push({ type:"commit", date:(new Date()).toLocaleString(), summary:`OP Regen${usedMatrix ? ` (territory matrix · flows: ${Object.entries(matrix.flows).map(([k,n])=>`${k}×${n}`).join(", ")})` : ""}: ${fmtOpsRow(opsDelta)}` });
        await A.update({ [`flags.${MOD_FACTIONS}.warLogs`]: warLogs });

        await ChatMessage.create({
          content: `<p><b>${foundry.utils.escapeHTML(A.name)}</b> — <i>Advance OP (Apply)</i><br/>Gained: ${fmtOpsRow(opsDelta)}</p>`,
          whisper: tableAudience(),
          speaker: { alias: "Bad Eden Turn Driver" }
        });

        row.applied = true;
      }

    } catch (e) { warn("advanceOPRegen failed for faction:", A?.name, e); }
  }

  if (!apply) {
    const lines = results.map(r => `<li><b>${foundry.utils.escapeHTML(r.factionName)}</b>: ${fmtOpsRow(r.opsDelta)}</li>`).join("") || "<li>—</li>";
    await ChatMessage.create({
      content: `<p><i>Advance OP (Dry)</i> — projected gains:</p><ul>${lines}</ul>`,
      whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
      speaker: { alias: "Bad Eden Turn Driver" }
    });
  }

  return { changed: apply && results.some(r=>r.applied), rows: results };
}

/* ------------------------- warLog migration (sing→pl) -------------------- */
async function migrateWarLogPluralIfNeeded(A){
  try {
    const flags = clone(A.flags?.[MOD_FACTIONS] ?? {});
    const singular = Array.isArray(flags.warLog) ? flags.warLog : null;
    const plural   = Array.isArray(flags.warLogs) ? flags.warLogs : [];
    if (!singular || !singular.length) return false;
    const byKey = new Map();
    for (const e of [...plural, ...singular]) {
      const k = `${e?.ts ?? ""}|${(e?.activity||e?.activityKey||"").toLowerCase()}|${(e?.type||"").toLowerCase()}`;
      byKey.set(k, e);
    }
    const merged = [...byKey.values()];
    await A.update({ [`flags.${MOD_FACTIONS}.warLogs`]: merged });
    return true;
  } catch (e) { warn("migrateWarLogPluralIfNeeded failed for", A?.name, e); return false; }
}

/* ---------------------- (0) Promote post → turn (Apply) ------------------ */
function _mergeObjects(target={}, src={}){
  const out = clone(target);
  for (const [k,v] of Object.entries(src||{})) {
    if (Array.isArray(v)) out[k] = [...(out[k]||[]), ...v];
    else if (v && typeof v === "object") out[k] = _mergeObjects(out[k]||{}, v);
    else out[k] = v;
  }
  return out;
}

async function promotePostToTurn(){
  const updates = [];

  // Factions: overwrite (turn.pending is per-turn staging; post.pending is deferred queue)
  for (const F of allFactions()) {
    const flags = clone(F.flags?.[MOD_FACTIONS] ?? {});
    const post  = clone(flags.post?.pending ?? {});
    if (Object.keys(post).length) {
      updates.push(F.update({
        [`flags.${MOD_FACTIONS}.turn.pending`]: clone(post),
        [`flags.${MOD_FACTIONS}.post.pending`]: null
      }));
    }
  }

  // Hexes
  for (const sc of game.scenes ?? []) {
    const drawings = sc.drawings ?? [];
    for (const d of drawings) {
      const tf = d.flags?.[MOD_TERRITORY];
      if (!tf) continue;
      const post = clone(tf.post?.pending ?? {});
      if (!Object.keys(post).length) continue;
      const pathTurn = `flags.${MOD_TERRITORY}.turn.pending`;
      const pathPost = `flags.${MOD_TERRITORY}.post.pending`;
      updates.push(d.update({ [pathTurn]: clone(post), [pathPost]: null }, { parent: sc }));
    }
  }

  if (updates.length) await Promise.allSettled(updates);
  return { changed: updates.length > 0 };
}

/* --------------------------- (1) Planned raids --------------------------- */
// DRY = preview from warLogs; APPLY = call compat per faction with factionId
//
// Turn Ledger P4 (2026-07-08, owner-locked "time = 2nd currency"): planned
// strategic activities are FUNDED BY THE MONTH'S UNSPENT DAYS. Each entry has
// a day price; entries the remainder can't fund HOLD (stay planned into the
// next turn — the crew visibly waits) and only funded entries reach
// consumePlanned. Funded days are debited to the world clock as
// source:"development". Worlds without the ledger API degrade to old behavior.
// LEDGER_DAY_COST lives in the economy constants table
function ledgerDayCostFor(key){
  const k = String(key || "").toLowerCase();
  if (LEDGER_DAY_COST[k] != null) return LEDGER_DAY_COST[k];
  if (/^found_site_/.test(k)) return 2;
  return 2;                                  // default: any planned activity = 2 days
}
function ledgerRemainingDays(){
  try {
    const b = game.bbttcc?.api?.world?.getTimeBudget?.();
    if (b && Number.isFinite(b.remaining)) return b.remaining;
  } catch (_e) {}
  return null;                               // ledger absent — no gating
}

async function plannedRaidsStep({ apply=false } = {}){
  const raid = game.bbttcc?.api?.raid;
  if (!raid) return { changed:false, rows:[] };

  const FXS = allFactions();
  await Promise.all(FXS.map(A => migrateWarLogPluralIfNeeded(A)));

  if (apply && typeof raid.consumePlanned === "function") {
    // ── Turn Ledger funding pass: hold what the month can't pay for ────────
    // Owner ruling R7 (2026-09-13): the day-funding gate is retired — a planned activity costs
    // marks and one turn, never days. (ledgerRemainingDays stays for display.)
    const budgeted = null;
    let daysLeft = budgeted == null ? Infinity : budgeted;
    const funded = [];
    const held = [];
    if (budgeted != null) {
      for (const F of FXS) {
        const flags = F.flags?.[MOD_FACTIONS] || {};
        const logs = Array.isArray(flags.warLogs) ? clone(flags.warLogs) : [];
        let dirty = false;
        for (const e of logs) {
          if (String(e?.type).toLowerCase() !== "planned") continue;
          const key = String(e.activity || e.activityKey || "").toLowerCase();
          const price = ledgerDayCostFor(key) + (Number(e?.recipe?.days) || 0);   // slow fuels cost days (2026-09-12)
          if (price <= daysLeft) {
            daysLeft = Math.round((daysLeft - price) * 100) / 100;
            funded.push({ faction: F.name, key, price });
          } else {
            e.type = "planned_hold";        // shielded from consumePlanned, restored below
            dirty = true;
            held.push({ faction: F.name, key, price });
          }
        }
        if (dirty) await F.update({ [`flags.${MOD_FACTIONS}.warLogs`]: logs });
      }
    }

    let changed = false;
    const rows = [];
    for (const F of FXS) {
      try {
        const res = await raid.consumePlanned({ factionId: F.id, apply:true });
        if (res?.changed || res?.applied || res?.didWork || res?.count) changed = true;
        if (Array.isArray(res?.rows)) rows.push(...res.rows);
      } catch (e) { warn("consumePlanned error for", F?.name, e); }
    }

    // Restore holds → planned (they queue again next turn).
    if (held.length) {
      for (const F of FXS) {
        const flags = F.flags?.[MOD_FACTIONS] || {};
        const logs = Array.isArray(flags.warLogs) ? clone(flags.warLogs) : [];
        let dirty = false;
        for (const e of logs) {
          if (String(e?.type).toLowerCase() === "planned_hold") { e.type = "planned"; dirty = true; }
        }
        if (dirty) await F.update({ [`flags.${MOD_FACTIONS}.warLogs`]: logs });
      }
    }

    // Debit the funded labor to the world clock (shows in the Ledger whisper).
    const fundedDays = Math.round(funded.reduce((a, x) => a + x.price, 0) * 100) / 100;
    if (budgeted != null && fundedDays > 0) {
      try {
        await game.bbttcc.api.world.addTime(fundedDays, {
          source: "development",
          note: `Development labor: ${funded.length} planned action(s) funded (${fundedDays} days)`
        });
      } catch (e) { warn("ledger development debit failed", e); }
    }
    if (held.length) {
      const esc = foundry.utils.escapeHTML;
      try {
        await ChatMessage.create({
          content: `<p><i class="fas fa-hourglass-half"></i> <b>Turn Ledger:</b> the month ran out of days — ${held.length} planned action(s) HOLD until next turn (the crew waited):</p>
            <ul>${held.map(h => `<li><b>${esc(h.faction)}</b>: ${esc(h.key.replace(/_/g, " "))} (${h.price}d)</li>`).join("")}</ul>`,
          whisper: tableAudience(),
          speaker: { alias: "Bad Eden Turn Driver" }
        });
      } catch (_e) {}
    }
    return { changed, rows };
  }

  // DRY preview
  const rows = [];
  let any = false;
  const EFFECTS = (raid && raid.EFFECTS) || {};
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const canAfford = (bank={}, cost={}) => OP_KEYS.every(k => safeNum(bank[k]) >= safeNum(cost[k]));

  for (const F of FXS) {
    const flags = F.flags?.[MOD_FACTIONS] || {};
    const bank0 = flags.opBank || {};
    // Regen lands before plans are paid (2026-09-12): preview affordability against bank + this turn's income.
    const bank = foundry.utils.duplicate(bank0);
    // One clock (2026-11-02): add only the income NOT yet paid as weekly slices this turn.
    try {
      const inc = await computeRegenIncome(F);
      const paidNominal = incomeSliceRecord(F).nominal;
      for (const k of OP_KEYS) bank[k] = safeNum(bank[k]) + Math.max(0, safeNum(inc[k]) - safeNum(paidNominal[k]));
    } catch (_eInc) {}
    const logs  = Array.isArray(flags.warLogs) ? flags.warLogs : [];
    const planned = logs.filter(e => String(e?.type).toLowerCase() === "planned");
    if (!planned.length) continue;

    // Apply pays rows one after another in plan order — preview against a RUNNING bank (review #4, 2026-10-28).
    for (const e of planned.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
      const key = String(e.activity || e.activityKey || "").toLowerCase();
      const spec = EFFECTS[key];
      const label = spec?.label || (key ? key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()) : "(unknown)");
      // Bill at plan (2026-11-02): an entry stamped `paid` already left the bank — it is not charged again.
      const prepaid = (e?.paid && typeof e.paid === "object" && Object.keys(e.paid).length) ? normalizeActivityCost(e.paid) : null;
      const cost = prepaid || activityCost({ entry: e, effect: spec, key, faction: F });   // steward discounts as billed
      const afford = prepaid ? true : canAfford(bank, cost);
      if (afford && !prepaid) for (const k of OP_KEYS) bank[k] = safeNum(bank[k]) - safeNum(cost[k]);
      rows.push({ faction: F.name, factionId: F.id, activity: key, label, cost, canAfford: afford, prepaid: !!prepaid });
      any = true;
    }
  }

  const fmt = (c)=>OP_KEYS.filter(k=>safeNum(c[k])>0).map(k=>`${c[k]} ${k}`).join(", ")||"—";
  const __hwDry = homeWeeks();
  await ChatMessage.create({
    content: (any
      ? `<p><i>Planned Activities (Dry Preview)</i> — paid in plan order after this turn\u2019s income</p><ul>${rows.map(r => `<li><b>${foundry.utils.escapeHTML(r.faction)}</b>: ${foundry.utils.escapeHTML(r.label)} — ${fmt(r.cost)}${r.prepaid ? " <em>(paid when planned)</em>" : ""} ${r.canAfford?"":"<em>(cannot afford after the orders before it, even with this turn\u2019s income)</em>"}</li>`).join("")}</ul>`
      : `<p><i>Planned Activities (Dry Preview)</i>: none queued.</p>`)
      + (__hwDry > 0 ? `<p><i>Time at home:</i> ${__hwDry} week${__hwDry === 1 ? "" : "s"} to spare if you advance now — each order that resolves gives back ${HOME_REFUND_PCT_PER_WEEK * __hwDry}% of its price, and each Steward eases ${HOME_STRAIN_PER_WEEK * __hwDry} level${HOME_STRAIN_PER_WEEK * __hwDry === 1 ? "" : "s"} of Strain.</p>` : ""),
    whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
    speaker: { alias: "Bad Eden Turn Driver" }
  });

  return { changed:false, rows };
}

/* -------- (3.5) Normalize queued shapes: nextRound → nextTurn (Apply) ---- */
async function normalizePendingShapes(){
  const updates = [];
  for (const F of allFactions()) {
    const flags = clone(F.flags?.[MOD_FACTIONS] ?? {});
    const turn  = clone(flags.turn?.pending ?? {});
    if (turn.nextRound && typeof turn.nextRound === "object") {
      const nt = clone(turn.nextTurn ?? {});
      const merged = _mergeObjects(nt, turn.nextRound);
      turn.nextTurn = merged;
      delete turn.nextRound;
      updates.push(F.update({ [`flags.${MOD_FACTIONS}.turn.pending`]: turn }));
    }
  }
  if (updates.length) await Promise.allSettled(updates);
  return { changed: updates.length > 0 };
}

/* -------------------- (4) consume queued turn.pending -------------------- */
// SIM-BADEDEN fix 2026-06-05 (dead-letter queue #1): hex `turn.pending.repairs`
// had NO working consumer — ~15 strategic activities (Supply Line, Trade Route,
// Fortify, Supply Depot, Diplomatic Mission, …) billed real OP, queued their hex
// changes, and hardCleanupQueued() wiped the queue unapplied every turn. The
// raid-side wrappers (queue-drawings v1.0.8, consumePlanned.shim v1.0.7) all
// wrap a base consumeQueuedTurnEffects that no build ever defines. This sweep
// applies hex pendings directly, then clears them; the raid consumer (if one
// ever materializes) still runs first and simply leaves nothing to sweep.
async function applyHexPendingSweep(){
  const dup = (x)=>foundry.utils.duplicate(x ?? {});
  let appliedHexes = 0;
  for (const sc of game.scenes ?? []) {
    const patches = [];
    const modifierChanged = [];   // 2026-09-10: hexes whose modifier list changed → recompute resources after the write
    for (const d of sc.drawings ?? []) {
      const tf = d.flags?.[MOD_TERRITORY];
      if (!tf || !(tf.isHex === true || tf.kind === "territory-hex")) continue;
      const pend = dup(tf.turn?.pending || {});
      if (!Object.keys(pend).length) continue;

      const f = dup(tf);
      let actionable = false;

      // modifiers (repairs queue — new + legacy shapes)
      f.modifiers = Array.isArray(f.modifiers) ? f.modifiers.slice() : [];
      if (Array.isArray(pend.repairs?.removeModifiers) && pend.repairs.removeModifiers.length) {
        const rm = new Set(pend.repairs.removeModifiers.map(String));
        f.modifiers = f.modifiers.filter(m => !rm.has(String(m)));
        actionable = true;
      }
      if (Array.isArray(pend.repairs?.addModifiers) && pend.repairs.addModifiers.length) {
        for (const m of pend.repairs.addModifiers) if (!f.modifiers.includes(m)) f.modifiers.push(m);
        actionable = true;
      }
      if (Array.isArray(pend.repairs?.requests) && pend.repairs.requests.length) {
        const rmLegacy = new Set(pend.repairs.requests.map(x => typeof x === "string" ? x : x?.tag).filter(Boolean));
        if (rmLegacy.size) { f.modifiers = f.modifiers.filter(m => !rmLegacy.has(m)); actionable = true; }
      }

      // route edges (2026-09-07): stored on the hex as flags.bbttcc-territory.routes = [{hexUuid, kind, since}]
      f.routes = Array.isArray(f.routes) ? f.routes.slice() : [];
      if (Array.isArray(pend.routes) && pend.routes.length) {
        for (const r of pend.routes) {
          if (!r?.hexUuid) continue;
          if (!f.routes.some(x => x?.hexUuid === r.hexUuid && x?.kind === (r.kind || "trade"))) f.routes.push({ hexUuid: String(r.hexUuid), kind: String(r.kind || "trade"), since: Date.now() });
        }
        actionable = true;
      }
      // numeric deltas → mods (darknessDelta → mods.darkness, the field setHexDarkness writes — 2026-09-12)
      // moraleDelta → mods.loyalty: hex Morale retired 2026-10-18 (ruling 19 ext.), a stale queued moraleDelta lands on Loyalty.
      const mods = dup(f.mods || {});
      for (const [pk, mk] of [["defenseDelta","defense"],["tradeYieldDelta","tradeYield"],["loyaltyDelta","loyalty"],["moraleDelta","loyalty"],["enemyLoyaltyDelta","enemyLoyalty"],["radiationRisk","radiation"],["darknessDelta","darkness"]]) {
        const v = safeNum(pend[pk]);
        if (v) { mods[mk] = safeNum(mods[mk]) + v; actionable = true; }
      }

      if (!actionable) continue;
      if (JSON.stringify(f.modifiers) !== JSON.stringify(Array.isArray(tf.modifiers) ? tf.modifiers : [])) modifierChanged.push(d);
      const applied = Array.isArray(f.turn?.applied) ? f.turn.applied.slice() : [];
      applied.push({ ts: Date.now(), data: pend });
      patches.push({
        _id: d.id,
        [`flags.${MOD_TERRITORY}.modifiers`]: f.modifiers,
        [`flags.${MOD_TERRITORY}.routes`]: f.routes,
        [`flags.${MOD_TERRITORY}.mods`]: mods,
        [`flags.${MOD_TERRITORY}.turn.applied`]: applied,
        // v14 dropped "-=key" deletion (2026-10-01) — ForcedDeletion where the core provides it.
        ...(foundry.data?.operators?.ForcedDeletion
          ? { [`flags.${MOD_TERRITORY}.turn.pending`]: new foundry.data.operators.ForcedDeletion() }
          : { [`flags.${MOD_TERRITORY}.turn.-=pending`]: null })
      });
    }
    if (patches.length) {
      await sc.updateEmbeddedDocuments("Drawing", patches);
      appliedHexes += patches.length;
      // Production modifiers (Trade Hub +50% trade, Well-Maintained, …) only reach
      // flags.resources — what regen reads — through the recompute (2026-09-10).
      const recompute = game.bbttcc?.api?.territory?.recomputeHexResources;
      if (typeof recompute === "function") for (const d of modifierChanged) {
        try { await recompute(d, { source: "pending-sweep" }); } catch (e) { warn("hex resource recompute failed for", d?.id, e); }
      }
    }
  }
  if (appliedHexes) log(`Hex pending sweep: applied queued strategic effects on ${appliedHexes} hex(es).`);
  return { changed: appliedHexes > 0, appliedHexes };
}

async function applyQueuedPostEffects(){
  const raid = game.bbttcc?.api?.raid;
  let changed = false;
  if (raid?.consumeQueuedTurnEffects) {
    for (const F of allFactions()) {
      try {
        const res = await raid.consumeQueuedTurnEffects({ factionId: F.id });
        if (res?.changed || res?.appliedAt) changed = true;
      } catch (e) { warn("consumeQueuedTurnEffects error for", F?.name, e); }
    }
  }
  // Direct hex sweep — catches everything the (often missing/broken) raid
  // consumer chain didn't apply, BEFORE hardCleanupQueued wipes it.
  try {
    const swept = await applyHexPendingSweep();
    if (swept.changed) changed = true;
  } catch (e) { warn("applyHexPendingSweep failed", e); }
  return { changed, rows:[] };
}

/* ------------- (4b) mature scheduled OP bonuses (deferred income) ---------- */
// SIM-BADEDEN fix 2026-06-05 (dead-letter queue #2): `bonuses.scheduled`
// (written by both STRATEGIC_THROUGHPUT registries for "+N OP next turn"
// income — Harvest Season, Supply Overrun, Prayer in the Smoke, …) had NO
// consumer anywhere. Deferred income never arrived. This step ticks each
// entry's turnOffset on Apply and pays matured opDeltas (MARKS) into opBank,
// clamped to opCaps.
/* ---------------- faction bonus consumers (2026-09-09) ----------------
 * flags.bbttcc-factions.bonuses.{regenPlan[], capBump{}, truce{}, nextTurn{borderPatrol, noMoraleLoss, spyInsertion}}
 * Written by strategic-throughput handlers; read here, in advanceOPRegen, in
 * consumePlanned (raid refusal) and in advance-turn.tracks (noMoraleLoss — retired 2026-10-18 ruling 19,
 * Blessed Ground). tickFactionBonuses() runs once per applied Advance and is
 * the only thing that expires them — hardCleanupQueued never touches bonuses.
 */
// Effective caps (2026-10-01): the OP engine's fallback chain (explicit opCaps → opCapPer →
// tier band) via facts.faction.caps — the raw opCaps flag alone left band-sized factions uncapped.
function effectiveCapsFor(F){
  try { const c = game.bbttcc?.facts?.faction?.caps?.(F); if (c && typeof c === "object") return c; } catch {}
  return F?.getFlag?.(MOD_FACTIONS, "opCaps") || {};
}
function capBumpFor(F, k){
  try { const b = F.getFlag(MOD_FACTIONS, "bonuses")?.capBump?.[k]; return (b && safeNum(b.turns) > 0) ? safeNum(b.add) : 0; } catch { return 0; }
}
async function raidRefusalFor({ factionActor, effect, entry }){
  try {
    if (effect?.kind === "strategic") return null;
    const raid = game.bbttcc?.api?.raid || {};
    const key = String(entry.activityKey || "").toLowerCase();
    const types = raid.TYPES || raid.getTypes?.() || {};
    const canon = String((typeof raid.resolveCanonical === "function" ? raid.resolveCanonical(key) : null) || types[key]?.raidType || key).toLowerCase();
    if (!types[canon] && !types[key]) return null;               // not a raid entry
    let defender = entry.defenderId ? game.actors.get(entry.defenderId) : null;
    if (!defender && entry.targetUuid) {
      const ref = await fromUuid(entry.targetUuid); const d = ref?.document ?? ref;
      const tf = d?.flags?.[MOD_TERRITORY] || {}; const oid = tf.factionId || tf.ownerId;
      defender = oid ? game.actors.get(oid) : null;
    }
    if (!defender || defender.id === factionActor.id) return null;
    const bA = factionActor.getFlag(MOD_FACTIONS, "bonuses") || {};
    const bD = defender.getFlag(MOD_FACTIONS, "bonuses") || {};
    const truce = safeNum(bA.truce?.[defender.id]?.turns) > 0 || safeNum(bD.truce?.[factionActor.id]?.turns) > 0;
    if (truce) return `${factionActor.name} did NOT raid ${entry.targetName || defender.name}: Peace Accords with ${defender.name} hold. No OP spent.`;
    if (canon === "intrigue" && safeNum(bD.nextTurn?.borderPatrol) > 0) return `${factionActor.name}'s infiltration of ${entry.targetName || defender.name} was turned back by ${defender.name}'s Border Patrol. No OP spent.`;
  } catch (e) { warn("raidRefusalFor failed (fail-open)", e); }
  return null;
}
let __plannedSnapshot = null;   // #28: { factionId → { planned[], bank } } taken just before this Advance's plans resolve
async function spyReport(F, spy){
  try {
    const T = game.actors.get(spy?.targetFactionId); if (!T) return;
    const snap = __plannedSnapshot?.get?.(String(T.id)) || null;
    const bank = snap?.bank || T.getFlag(MOD_FACTIONS, "opBank") || {};
    const planned = (snap?.planned || (T.getFlag(MOD_FACTIONS, "warLogs") || []).filter(e => e?.type === "planned")).map(e => `${foundry.utils.escapeHTML(String(e.activityKey || e.activity || "?"))} → ${foundry.utils.escapeHTML(String(e.targetName || "?"))}`);
    const ids = new Set(ChatMessage.getWhisperRecipients("GM").map(u => u.id));
    for (const u of game.users ?? []) { try { if (F.testUserPermission?.(u, "OWNER")) ids.add(u.id); } catch {} }
    const keys = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    await ChatMessage.create({ whisper: [...ids], speaker: { alias: "Bad Eden" },
      content: `<div style="border-left:3px solid #6c8ebf;padding:.35em .6em;background:rgba(108,142,191,.08);"><b>Spy Insertion — ${foundry.utils.escapeHTML(T.name)}</b><div style="font-size:.9em;margin-top:.25em">Bank (marks): ${keys.map(k => `${k} <b>${safeNum(bank[k])}</b>`).join(" · ")}<br>Planned this turn: ${planned.length ? planned.join("; ") : "nothing"}</div></div>` });
    const wl = clone(F.getFlag(MOD_FACTIONS, "warLogs") || []);
    wl.push({ ts: Date.now(), date: (new Date()).toLocaleString(), type: "turn", activity: "spy_insertion", summary: `Spy Insertion: ${T.name}'s bank and plans reported (see whisper).` });
    await F.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl });
  } catch (e) { warn("spyReport failed", e); }
}
// flags.bbttcc-factions.victory.tempCapBonus { all?, <opKey>? } (marks; Keter Unity Bonus) — the OP
// engine's factionCaps adds it; it lives until the next applied Advance, cleared here before regen.
async function clearTempCapBonuses(){
  for (const F of allFactions()) {
    try {
      const t = F.getFlag(MOD_FACTIONS, "victory")?.tempCapBonus;
      if (t === undefined) continue;
      await F.unsetFlag(MOD_FACTIONS, "victory.tempCapBonus");
    } catch (e) { warn("clearTempCapBonuses failed for", F?.name, e); }
  }
}
async function tickFactionBonuses(){
  for (const F of allFactions()) {
    try {
      const b = clone(F.getFlag(MOD_FACTIONS, "bonuses") || {});
      let dirty = false; const notes = [];
      if (Array.isArray(b.regenPlan) && b.regenPlan.length) {
        const next = [];
        // Review #1 (2026-10-28): "applied" only for an entry advanceOPRegen actually multiplied (finite mult ≠ 1).
        for (const e of b.regenPlan) { const t = safeNum(e?.inTurns, 1); if (t <= 1) { const m = Number(e?.mult); notes.push(Number.isFinite(m) && m !== 1 ? `${e?.label || "income plan"} ×${m} applied to this turn's income` : `${e?.label || "income plan"} expired`); continue; } next.push(Object.assign({}, e, { inTurns: t - 1 })); }
        b.regenPlan = next; dirty = true;
      }
      if (b.capBump && typeof b.capBump === "object") {
        for (const [k, v] of Object.entries(b.capBump)) { const t = safeNum(v?.turns) - 1; if (t <= 0) { delete b.capBump[k]; notes.push(`${k} cap bump ended`); } else b.capBump[k] = Object.assign({}, v, { turns: t }); }
        if (!Object.keys(b.capBump).length) delete b.capBump; dirty = true;
      }
      if (b.truce && typeof b.truce === "object") {
        for (const [id, v] of Object.entries(b.truce)) { const t = safeNum(v?.turns) - 1; if (t <= 0) { delete b.truce[id]; notes.push(`truce with ${v?.with || id} ended`); } else b.truce[id] = Object.assign({}, v, { turns: t }); }
        if (!Object.keys(b.truce).length) delete b.truce; dirty = true;
      }
      const nt = b.nextTurn || {};
      if (nt.borderPatrol) { const t = safeNum(nt.borderPatrol) - 1; if (t <= 0) { delete nt.borderPatrol; notes.push("Border Patrol stood down"); } else nt.borderPatrol = t; dirty = true; }
      // noMoraleLoss / moraleBonus: faction Morale retired 2026-10-18 (ruling 19) — stale slots are
      // cleared without being applied (nothing reads them any more).
      if (nt.noMoraleLoss) { delete nt.noMoraleLoss; dirty = true; }
      if (nt.moraleBonus !== undefined) { delete nt.moraleBonus; dirty = true; }
      // Loyalty stability one-turn effects (2026-09-10): consumed this Advance
      // (opGainPct in advanceOPRegen, defenseDC by raid defense DC readers) —
      // clear so tracks' loyalty phases write a fresh value, never a running sum.
      if (nt.opGainPct !== undefined) { delete nt.opGainPct; dirty = true; }
      if (nt.defenseDC !== undefined) { delete nt.defenseDC; dirty = true; }
      if (nt.attackDC !== undefined) { delete nt.attackDC; dirty = true; }   // attacker-side next-raid shift, consumed at Add Round (2026-09-12)
      if (nt.spyInsertion) { const due = safeNum(nt.spyInsertion.due, 1) - 1; if (due <= 0) { await spyReport(F, nt.spyInsertion); delete nt.spyInsertion; } else nt.spyInsertion = Object.assign({}, nt.spyInsertion, { due }); dirty = true; }
      if (dirty) {
        // A merge-write never drops a deleted key (owner hit it 2026-09-21: the golden save's −20% survived the Advance
        // and the fresh band landed on top → Errata −40%). Unset the subtree, then write the survivors [[reference_v14_flag_deletion_syntax]].
        try { await F.unsetFlag(MOD_FACTIONS, "bonuses"); } catch (eU) { warn("bonuses unset failed", F?.name, eU); }
        const upd = { [`flags.${MOD_FACTIONS}.bonuses`]: b };
        if (notes.length) { const wl = clone(F.getFlag(MOD_FACTIONS, "warLogs") || []); wl.push({ ts: Date.now(), date: (new Date()).toLocaleString(), type: "turn", activity: "bonuses", summary: notes.join("; ") + "." }); upd[`flags.${MOD_FACTIONS}.warLogs`] = wl; }
        await F.update(upd);
      }
    } catch (e) { warn("tickFactionBonuses failed for", F?.name, e); }
  }
}

async function applyScheduledOPBonuses(){
  const dup = (x)=>foundry.utils.duplicate(x ?? {});
  const rows = [];
  for (const F of allFactions()) {
    try {
      const bonuses = dup(F.getFlag(MOD_FACTIONS, "bonuses") || {});
      const sched = Array.isArray(bonuses.scheduled) ? bonuses.scheduled : [];
      if (!sched.length) continue;

      const matured = [];
      const remaining = [];
      for (const s of sched) {
        const t = safeNum(s?.turnOffset, 1) - 1;
        if (t <= 0) matured.push(s);
        else remaining.push(Object.assign({}, s, { turnOffset: t }));
      }
      // Always write the ticked offsets back (2026-10-01): skipping the write when nothing
      // matured froze turnOffset ≥ 2 entries forever.

      let bank = dup(F.getFlag(MOD_FACTIONS, "opBank") || {});
      const caps = dup(effectiveCapsFor(F));
      const gained = {};
      const lost = {};   // marks that hit the tier cap (owner ruling 2026-09-09: caps stay hard — but say so)
      for (const s of matured) {
        for (const [k, v] of Object.entries(s?.opDelta || {})) {
          const n = safeNum(v);
          if (!n) continue;
          // #36 (2026-10-28): land the payout UNCLAMPED — the post-spend clampBanksToCaps enforces the cap after this
          // Advance's planned activities have paid, exactly like regen (deferCapClamp). Clamping here lost marks
          // the same Advance could have spent.
          bank[k] = safeNum(bank[k]) + n;
          gained[k] = safeNum(gained[k]) + n;
        }
      }

      bonuses.scheduled = remaining;
      const updates = { [`flags.${MOD_FACTIONS}.bonuses`]: bonuses };
      if (Object.keys(gained).length) updates[`flags.${MOD_FACTIONS}.opBank`] = bank;
      await F.update(updates);

      if (Object.keys(gained).length || Object.keys(lost).length) {
        const wl = dup(F.getFlag(MOD_FACTIONS, "warLogs") || []);
        const txt = Object.entries(gained).filter(([,v]) => v).map(([k,v]) => `${k}:+${v}`).join(", ") || "nothing";
        const lostTxt = Object.entries(lost).map(([k,v]) => `${k}:${v}`).join(", ");
        wl.push({ ts: Date.now(), date: (new Date()).toLocaleString(), type: "turn", activity: "scheduled_op", summary: `Scheduled income matured: ${txt} marks.` });
        await F.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl });
        rows.push({ factionId: F.id, gained });
      }
    } catch (e) { warn("applyScheduledOPBonuses failed for", F?.name, e); }
  }
  return { changed: rows.length > 0, rows };
}

/* ------------------------- (5) hard cleanup (Apply) ---------------------- */
async function hardCleanupQueued(){
  const updates = [];
  for (const F of allFactions()) {
    updates.push(F.update({
      [`flags.${MOD_FACTIONS}.post.pending`]: null,
      [`flags.${MOD_FACTIONS}.turn.pending`]: null
    }));
  }
  for (const sc of game.scenes ?? []) {
    const drawings = sc.drawings ?? [];
    for (const d of drawings) {
      if (!d.flags?.[MOD_TERRITORY]) continue;
      updates.push(d.update({
        [`flags.${MOD_TERRITORY}.turn.pending`]: null,
        [`flags.${MOD_TERRITORY}.post.pending`]: null
      }, { parent: sc }));
    }
  }
  if (updates.length) await Promise.allSettled(updates);
  return { cleared: updates.length > 0 };
}

/* ----------------------------- driver wrapper ---------------------------- */
function installDriver(){
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.territory ??= {};

  const terr = game.bbttcc.api.territory;
  // Guard: avoid clobbering wrappers (e.g., advance-turn.tracks.js) by reinstalling repeatedly
  if (terr.__bbttccTurnDriverInstalled) return;
  terr.__bbttccTurnDriverInstalled = true;

  if (typeof terr.advanceTurn === "function" && terr.advanceTurn !== driverAdvanceTurn) {
    terr._delegateAdvanceTurn = terr.advanceTurn;
  }

  terr.advanceTurn     = driverAdvanceTurn;
  terr.advanceOPRegen  = advanceOPRegen;

  // Compatibility: many UIs/macros expect a turn-scoped API surface.
  game.bbttcc.api.turn ??= {};
  // Canonical aliases
  game.bbttcc.api.turn.advanceTurn ??= async (args={}) => terr.advanceTurn(args);
  game.bbttcc.api.turn.advanceOPRegen ??= async (args={}) => terr.advanceOPRegen(args);
  // Legacy-friendly names
  game.bbttcc.api.turn.runTurn ??= game.bbttcc.api.turn.advanceTurn;
  game.bbttcc.api.turn.runOPRegen ??= game.bbttcc.api.turn.advanceOPRegen;

  log("Turn Driver: promote post→turn, planned raids, delegate, auto-regen (+hex fallback), logistics pressure, normalize queued, queued-consume, hard cleanup.");
}

async function driverAdvanceTurn({ apply=false, sceneId=null } = {}) {
  if (window._bbttccTurnLock) {
    console.warn("[bbttcc-turn] AdvanceTurn skipped — another Turn is already running.");
    try { ui.notifications?.warn?.("Advance Turn skipped — another Turn is already running."); } catch {}
    return { changed:false, skipped:true };
  }
  // World lock (review #10): an Apply runs only under runAdvance's token, or takes the lock itself
  // (macro / console callers) — never on top of another seat's turn.
  let ownToken = null;
  if (apply) {
    const held = turnLockHeld();
    if (held && held.token !== window._bbttccTurnOuter) {
      console.warn("[bbttcc-turn]", turnLockMessage(held));
      try { ui.notifications?.warn?.(turnLockMessage(held)); } catch {}
      return { changed:false, skipped:true, lockedBy: held.userName || null };
    }
    if (!held) {
      try { ownToken = await acquireTurnLock(); } catch (e) { warn("turn lock acquire failed", e); }
      if (!ownToken && turnLockHeld()) { const l = turnLockHeld(); try { ui.notifications?.warn?.(turnLockMessage(l)); } catch {} return { changed:false, skipped:true, lockedBy: l?.userName || null }; }
    }
  }
  window._bbttccTurnLock = true;
  // Going home (Dave 2026-11-02): read the month's unspent days NOW — the campaign module resets the ledger at
  // advanceTurn:end. Applied Advances only; a dry run just mentions it in the planned-activities preview.
  __homeAdvance = null;
  if (apply) {
    try {
      const b = game.bbttcc?.api?.world?.getTimeBudget?.();
      const weeks = b ? homeWeeksFromRemaining(b.remaining) : 0;
      if (weeks > 0) __homeAdvance = { weeks, remaining: Number(b.remaining) || 0, month: Math.max(1, worldTurnNow()) };
    } catch (e) { warn("home weeks read failed (non-fatal)", e); }
  }
  Hooks.callAll("bbttcc:advanceTurn:begin", { apply });
  if (apply) { try { await _bbttccTurnFxPlay("turn_start", { label:"Advance Turn" }, { phase:"invoke", broadcast:true }); } catch(_eFxStart) {} }

  try {
    const terr = game.bbttcc?.api?.territory ?? {};
    let promoted = { changed:false };
    if (apply) promoted = await promotePostToTurn();

    let base = { changed:false, rows:[] };
    if (typeof terr._delegateAdvanceTurn === "function") {
      base = (await terr._delegateAdvanceTurn({ apply, sceneId })) ?? base;
    }

    // Mature deferred OP income ("+N next turn") BEFORE regen so it lands
    // the turn it comes due. (Dead-letter queue #2 fix, 2026-06-05.)
    let scheduledOP = { changed:false, rows:[] };
    if (apply) scheduledOP = await applyScheduledOPBonuses();

    // Phase door + cadence tier floor BEFORE regen (2026-09-12, owner ruling, sim'd first):
    // the calendar hard doors are opened against the turn this Advance PRODUCES (cur + 1) —
    // the Act's tier floor then raises opCaps before income lands. The old order (door at
    // advanceTurn:end) let turn 1 of a new act clamp every full channel's income against the
    // old tier's caps (Mark 5 cap_clamp). The end-of-turn door stays as a safety net.
    if (apply) {
      const director = game.bbttcc?.api?.campaign?.director;
      try {
        if (typeof director?.openCalendarDoors === "function") {
          const cur = Math.max(0, Math.floor(Number(game.bbttcc?.api?.world?.getState?.()?.turn || 0) || 0));
          const doors = await director.openCalendarDoors({ turn: cur + 1, via: "pre-regen" });
          if (doors?.opened?.length) log(`pre-regen calendar door opened → phase ${doors.opened.join(",")} (turn ${cur} → ${cur + 1})`);
        }
      } catch (e) { warn("pre-regen calendar door failed (non-fatal)", e); }
      try { if (typeof director?.reconcileLevels === "function") await director.reconcileLevels({ reason: "pre-regen" }); }
      catch (e) { warn("pre-regen tier reconcile failed (non-fatal)", e); }
    }

    // Keter Unity Bonus cap lift (owner ruling 2026-10-02) lasts until the next Advance: drop it
    // BEFORE regen; the Unity wrapper on advanceOPRegen re-grants it if the faction still earns it.
    if (apply) await clearTempCapBonuses();

    let regen = { changed:false, rows:[] };
    // Through the API (2026-10-01) so the wrappers installed on it (Unity Bonus, Enlightened
    // +10% regen) run; both forward opts, so deferCapClamp still reaches the base.
    if (apply) regen = await (game.bbttcc?.api?.territory?.advanceOPRegen || advanceOPRegen)({ apply:true, deferCapClamp:true });
    // One clock (Dave 2026-11-02): the month's income already paid as weekly slices comes back out of the bank — the
    // full regen above still ran (Unity / Enlightened see the whole month); net = the month's total, paid early.
    // Before the planned spend + cap clamp. Dry runs never touch the slice record.
    let slicesPaid = { changed:false, rows:[] };
    if (apply) { try { slicesPaid = await debitPaidIncomeSlices(); } catch (e) { warn("weekly slice debit failed (non-fatal)", e); } }

    // REGEN BEFORE SPEND (owner ruling 2026-09-12, sim OP_ECONOMY_SIM_2026_09_11.md set C):
    // planned activities are paid from the bank AFTER this turn's income lands, so a
    // faction plans against what it will have, not what it had — "Turn 0 less punitive".
    // Still BEFORE tickFactionBonuses: truces / Border Patrol read by raidRefusalFor
    // must hold for this Advance's raids before they expire.
    if (apply) ensureConsumePlannedShim();
    // #28 (2026-10-28): Spy Insertion reports what a rival had PLANNED — snapshot it (and the bank it planned
    // against) before plannedRaidsStep consumes every queue; the bonus tick's spyReport reads the snapshot.
    if (apply) { try { __plannedSnapshot = new Map(allFactions().map(F => [String(F.id), { planned: clone((F.getFlag(MOD_FACTIONS, "warLogs") || []).filter(e => e?.type === "planned" && e?.practice !== true)), bank: clone(F.getFlag(MOD_FACTIONS, "opBank") || {}) }])); } catch (_e) { __plannedSnapshot = null; } }
    const planned = await plannedRaidsStep({ apply });
    // Going home: the Stewards recover, and the table hears how the spare weeks went (one line).
    let homeRecovered = [];
    if (apply && __homeAdvance?.weeks > 0) {
      try { homeRecovered = await homeRecoverStewards(__homeAdvance.weeks); } catch (e) { warn("home recovery failed (non-fatal)", e); }
      try { await postHomeLine({ home: __homeAdvance, plannedRows: planned.rows || [], recovered: homeRecovered }); } catch (e) { warn("home line failed (non-fatal)", e); }
    }
    if (apply) await clampBanksToCaps();     // caps bite AFTER the spend (2026-09-12) — income funds this turn's plans first
    if (apply) await tickFactionBonuses();   // expire regenPlan / capBump / truce / nextTurn boons (2026-09-09)

    let logistics = { changed:false, rows:[] };
    if (apply) logistics = await computeLogisticsPressureForAllFactions({ apply:true });

    let normalized = { changed:false };
    if (apply) normalized = await normalizePendingShapes();

    let queued = { changed:false, rows:[] };
    if (apply) queued = await applyQueuedPostEffects();

    // Immediate cleanup
    if (apply) await hardCleanupQueued();

    // Deferred cleanup (wins against wrapper ordering)
    if (apply) {
      setTimeout(() => {
        hardCleanupQueued().catch(e => warn("deferred hardCleanupQueued failed", e));
      }, 0);
    }

    // Bump world.turn (bbttcc-world) so scheduled OP effects have a real clock.
    // This must happen BEFORE bbttcc:advanceTurn:end fires (which ticks schedules).
    if (apply) {
      const wres = await bumpWorldTurnBestEffort();
      if (wres && wres.ok) log("World Turn advanced:", wres.turn);
      else log("World Turn NOT advanced (non-fatal):", (wres && (wres.reason || wres.error)) || "unknown");
    }

    const __rows = [...(planned.rows||[]), ...(base.rows||[]), ...(regen.rows||[]), ...(logistics.rows||[]), ...(queued.rows||[])];
    if (apply) {
      try {
        const events = [];
        if (promoted.changed) events.push({ label: "Post Effects Promoted", tone: "info" });
        if ((planned.rows||[]).length) events.push({ label: `Planned Actions: ${(planned.rows||[]).length}`, tone: "info" });
        if ((regen.rows||[]).length) events.push({ label: `OP Regenerated: ${(regen.rows||[]).length} factions`, tone: "good" });
        if ((slicesPaid.rows||[]).length) { const nS = Math.max(...slicesPaid.rows.map(r => r.slices || 0)); events.push({ label: `${nS} weekly slice(s) already paid`, tone: "info" }); }
        if ((logistics.rows||[]).length) events.push({ label: `Logistics Pressure: ${(logistics.rows||[]).length} factions`, tone: "warn" });
        if (normalized.changed) events.push({ label: "Queued Effects Normalized", tone: "info" });
        if (queued.changed) events.push({ label: "Queued Effects Applied", tone: "good" });
        if (events.length) await _bbttccTurnFxPresentation(events, { speed:"slow", pauseBetween:900, broadcast:true });
        await _bbttccTurnFxPlay("turn_complete", { outcome: "Advance Turn Complete" }, { phase:"resolve", broadcast:true });
      } catch(_eFxEnd) {}
    }

    return {
      changed: !!(promoted.changed || planned.changed || base.changed || scheduledOP.changed || regen.changed || logistics.changed || normalized.changed || queued.changed),
      rows: __rows
    };
  } finally {
    window._bbttccTurnLock = false;
    __homeAdvance = null;
    if (ownToken) await releaseTurnLock(ownToken);
    // HARVEST NODES REGROW (owner ruling 2026-09-20: harvest once, regrow after a turn advance). Every scene's nodes
    // refill to their ceiling at the end of an APPLIED turn. GM-only, never on a dry run.
    if (apply && game.user?.isGM) {
      try {
        const H = game.fourththing?.harvest; let n = 0;
        if (H?.regrow) for (const sc of (game.scenes?.contents || [])) { try { const r = await H.regrow(sc); n += Number(r?.count || 0); } catch (_eS) {} }
        // …and the HEX nodes (flags.bbttcc-territory.resourceNodes on the region maps' hex drawings) — the ones the Hex Sheet harvests.
        const T = game.bbttcc?.api?.territory; let hn = 0;
        if (T?.regrowAllHexNodes) { try { const r = await T.regrowAllHexNodes(); hn = Number(r?.count || 0); } catch (_eH) {} }
        if (n || hn) console.log("[bbttcc-territory] harvest nodes regrown:", { sceneNodes: n, hexNodes: hn });
      } catch (eR) { console.warn("[bbttcc-territory] harvest regrow failed", eR); }
    }
    // Pass `apply` so listeners can skip mutations on a dry-run / preview.
    Hooks.callAll("bbttcc:advanceTurn:end", { apply });
  }
}

async function enqueueTurnRequest({
  key,
  value,
  factionId,
  hexUuid,
  target,
  source,
  campaignId,
  beatId
} = {}) {
  key = String(key || "").trim();
  if (!key) return { ok: false, error: "no key provided" };

  const v = (value && typeof value === "object") ? value : {};
  // (The local `const MOD_X = MOD_X ?? …` shadows that lived here were TDZ
  // self-references — they threw on EVERY keyed request, killing beat Turn
  // Requests and the Minor Repair activity. Module-scope consts cover this.
  // Fixed 2026-07-08.)

  const facTarget =
    factionId ||
    v.factionId ||
    v.actorId ||
    null;

  // A faction-scoped repair carries the hex in value.hexUuid — that is the repair's TARGET,
  // not the queue's home (2026-10-01): routing it to the hex parked Minor Repair requests on
  // flags.bbttcc-territory.requests.repairs, which nothing consumes.
  const factionRepair = key === "repairs" && !!facTarget && !!v.hexUuid;
  const hexTarget = factionRepair ? null : (
    hexUuid ||
    v.hexUuid ||
    v.target ||
    target ||
    null);

  // -----------------------------------------------------------------------
  // HEX-LEVEL REQUESTS
  // -----------------------------------------------------------------------
  if (hexTarget) {
    let doc = null;
    try {
      doc = await fromUuid(hexTarget);
    } catch (e) {
      warn("enqueueTurnRequest: invalid hexUuid/target", hexTarget, e);
      return { ok: false, error: "invalid hexUuid/target" };
    }
    if (!doc) {
      warn("enqueueTurnRequest: hex document not found", hexTarget);
      return { ok: false, error: "hex doc not found" };
    }

    const requests = await doc.getFlag(MOD_TERRITORY, "requests") || {};

    switch (key) {
      case "cleanseCorruption":
      case "clearRockslide":
      case "destroyHex": {
        // boolean flags; api.turn.processRequests looks for presence only
        requests[key] = true;
        break;
      }
      case "statusSet": {
        // requests.statusSet is a string newStatus. 10-29 (#18): never the value object itself — a Beat Editor row
        // ({mode,target,amount,note}) queued the object and processRequests wrote it into the hex's status flag.
        let s = (typeof value === "string") ? value
          : (typeof v.status === "string") ? v.status
          : (typeof v.value === "string") ? v.value
          : (value == null) ? "secured" : "";
        if (s === value && !s.trim()) s = "secured";   // old default for an empty string value
        if (!s.trim()) return { ok: false, error: "statusSet needs a status string (value.status)" };
        requests.statusSet = s.trim();
        break;
      }
      default: {
        // Generic future hook: stash the object as-is
        requests[key] = v;
        break;
      }
    }

    await doc.setFlag(MOD_TERRITORY, "requests", requests);

    log("enqueueTurnRequest HEX", {
      key,
      hexUuid: doc.uuid,
      name: doc.name,
      requests
    });

    return { ok: true, scope: "hex", key, hexUuid: doc.uuid };
  }

  // -----------------------------------------------------------------------
  // FACTION-LEVEL REPAIR REQUESTS
  // -----------------------------------------------------------------------
  if (facTarget && v.hexUuid) {
    const A =
      game.actors.get(facTarget) ||
      game.actors.get(String(facTarget).replace(/^Actor\./, ""));
    if (!A) {
      warn("enqueueTurnRequest: faction/actor not found", facTarget);
      return { ok: false, error: "faction/actor not found" };
    }

    const flags = foundry.utils.deepClone(A.flags?.[MOD_FACTIONS] || {});
    const existing =
      flags.requests?.repairs?.requests && Array.isArray(flags.requests.repairs.requests)
        ? flags.requests.repairs.requests.slice()
        : [];

    existing.push({
      target: v.hexUuid,
      tag: v.tag || (key !== "repairs" ? key : "") || "Damaged Infrastructure",
      source: source || "campaign",
      campaignId: campaignId || null,
      beatId: beatId || null
    });

    // Write only the queue (not the whole namespace — a snapshot write reverts concurrent changes).
    await A.update({ [`flags.${MOD_FACTIONS}.requests.repairs.requests`]: existing });

    log("enqueueTurnRequest REPAIR", {
      key,
      factionId: A.id,
      count: existing.length
    });

    return { ok: true, scope: "faction", key, factionId: A.id };
  }

  // -----------------------------------------------------------------------
  // No target found
  // -----------------------------------------------------------------------
  warn("enqueueTurnRequest: could not classify request; no hexUuid or factionId", {
    key,
    value
  });
  return { ok: false, error: "no target (hexUuid or factionId) in value" };
}



/* ---------------------------- hook install ------------------------------- */
Hooks.once("init", installDriver);
if (game?.ready) installDriver();
Hooks.once("ready", installDriver);
Hooks.on("canvasReady", installDriver);

/* ------------------------ console helpers -------------------------------- */
// 2026-10-28: these used to run at the top level, while Foundry's `game` is still the load-time placeholder that
// Game.create() replaces — every api.turn helper below (executeOPRegen, enqueueRequest, runAdvance, activityCost…)
// was silently lost. Publish on init + ready against the real game instead.
function __bbttccPublishTurnApi() {
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.turn ??= {};

  /**
   * OP regen helper (already used by console / macros)
   */
  game.bbttcc.api.turn.executeOPRegen = advanceOPRegen;
  // Compatibility aliases: some UIs/macros call game.bbttcc.api.turn.advanceTurn()/advanceOPRegen()
  game.bbttcc.api.turn.advanceTurn = game.bbttcc.api.turn.advanceTurn || (async (args={}) => game.bbttcc.api.territory.advanceTurn(args));
  game.bbttcc.api.turn.advanceOPRegen = game.bbttcc.api.turn.advanceOPRegen || (async (args={}) => game.bbttcc.api.territory.advanceOPRegen(args));

  /**
   * New: compute logistics pressure now (Apply-style write to flags).
   */
  game.bbttcc.api.turn.computeLogisticsPressure = computeLogisticsPressureForAllFactions;
  game.bbttcc.api.turn.computeLogisticsPressureForFaction = async (factionId) => {
    const A = game.actors.get(factionId);
    if (!A) throw new Error("computeLogisticsPressureForFaction: faction actor not found.");
    const metrics = await computeLogisticsPressureForFaction(A);
    await A.update({ [`flags.${MOD_FACTIONS}.logistics`]: metrics });
    return metrics;
  };

  /**
   * New: enqueue a structured turn request that will be consumed by
   * api.turn.processRequests() on the next advanceTurn({ apply:true }).
   *
   * See enqueueTurnRequest() above for payload details.
   */
  game.bbttcc.api.turn.enqueueRequest = enqueueTurnRequest;
  // Review #10 (2026-10-28): the ONE way to Apply a turn — holds the world turn lock across every wrapper.
  game.bbttcc.api.turn.runAdvance = runAdvance;
  game.bbttcc.api.turn.turnLock = () => turnLockHeld();
  // The one planned-activity price (review #3/#4/#5, 2026-10-28): activityCost({entry?, effect?, key?}) → {channel: marks}.
  game.bbttcc.api.turn.activityCost = activityCost;
  game.bbttcc.api.turn.formatActivityCost = fmtActivityCost;
  // One clock (Dave 2026-11-02): the month's income in four weekly slices.
  game.bbttcc.api.turn.computeRegenIncome = computeRegenIncome;   // (factionActor|id) → {pool: marks}, side-effect free, before wrappers
  game.bbttcc.api.turn.payIncomeSlice = payIncomeSlice;           // ({slice:1..4}) GM only, idempotent per world turn
  game.bbttcc.api.turn.dueIncomeSlices = dueIncomeSlices;         // (spentDays) → [1..4] due so far
  game.bbttcc.api.turn.incomeSliceRecord = incomeSliceRecord;     // (factionActor, turn?) → {turn, slices, nominal}
  // Going home (Dave 2026-11-02): () → 0..3 home weeks the current month gives if advanced now (read-only).
  game.bbttcc.api.turn.homeWeeks = homeWeeks;
}
Hooks.once("init", __bbttccPublishTurnApi);
Hooks.once("ready", __bbttccPublishTurnApi);
if (game?.ready) __bbttccPublishTurnApi();
