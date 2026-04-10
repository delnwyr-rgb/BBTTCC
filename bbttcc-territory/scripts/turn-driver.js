// BBTTCC Territory — Turn Driver
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
/* =====================================================================
 * Strategic Throughput Registry (Tier 1) — BOOTSTRAP
 * Purpose:
 * - Ensure game.bbttcc.api.raid.STRATEGIC_THROUGHPUT exists even if the
 *   dedicated script file is not loaded by module.json yet.
 * - Keeps Alpha stable: if another module publishes this registry, we
 *   do not overwrite it.
 * ===================================================================== */
function __bbttccInstallStrategicThroughputIfMissing(){
  try {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.raid ??= {};

    const raid = game.bbttcc.api.raid;
    if (raid.STRATEGIC_THROUGHPUT && Object.keys(raid.STRATEGIC_THROUGHPUT).length) return;

    const MODF = MOD_FACTIONS;
    const MODT = MOD_TERRITORY;

    const safeDup = (x)=> {
      try { return foundry.utils.duplicate(x ?? {}); }
      catch { return JSON.parse(JSON.stringify(x ?? {})); }
    };

    async function pushWarLog(A, summary){
      try {
        const wl = Array.isArray(A.getFlag(MODF,"warLogs")) ? A.getFlag(MODF,"warLogs").slice() : [];
        const now = Date.now();
        wl.push({ ts: now, date: (new Date(now)).toLocaleString(), type:"turn", activity:"strategic", summary });
        await A.update({ [`flags.${MODF}.warLogs`]: wl });
      } catch (e) {
        warn("StrategicThroughput pushWarLog failed", e);
      }
    }

    async function scheduleDeferredOP(A, opDelta, turnOffset=1){
      const bonuses = safeDup(A.getFlag(MODF,"bonuses") || {});
      bonuses.scheduled = Array.isArray(bonuses.scheduled) ? bonuses.scheduled.slice() : [];
      bonuses.scheduled.push({ turnOffset: Number(turnOffset||1), opDelta: safeDup(opDelta||{}) });
      await A.update({ [`flags.${MODF}.bonuses`]: bonuses });
    }

    async function adjustFactionTrack(A, key, delta){
      const before = Number(A.getFlag(MODF, key) ?? 0);
      const after  = Math.max(0, Math.min(100, before + Number(delta||0)));
      await A.update({ [`flags.${MODF}.${key}`]: after });
      return { before, after };
    }

    async function adjustHexTrack(hexUuid, track, delta){
      if (!hexUuid) return false;
      const ref = await fromUuid(hexUuid).catch(()=>null);
      const doc = ref?.document ?? ref;
      if (!doc) return false;
      const tf = safeDup(doc.flags?.[MODT] || {});
      tf[track] = Math.max(0, Number(tf[track]||0) + Number(delta||0));
      await doc.update({ [`flags.${MODT}`]: tf }, { parent: doc.parent });
      return true;
    }

    const T = Object.create(null);

    // --- Tier 1 wired (initial tranche) ---
    T.harvest_season = async (ctx) => {
      const A = game.actors.get(ctx.factionId);
      if (!A) return;
      await scheduleDeferredOP(A, { economy: 1 }, 1);
      await pushWarLog(A, "Harvest Season: +1 Economy next turn.");
    };

    T.minor_repair = async (ctx) => {
      const A = game.actors.get(ctx.factionId);
      if (!A) return;
      if (!ctx.targetUuid) {
        await pushWarLog(A, "Minor Repair: no target hex; nothing queued.");
        return;
      }
      if (game.bbttcc?.api?.turn?.enqueueRequest) {
        await game.bbttcc.api.turn.enqueueRequest({
          key: "repairs",
          factionId: A.id,
          value: { hexUuid: ctx.targetUuid, tag: "Damaged Infrastructure" }
        });
        await pushWarLog(A, "Minor Repair: queued Damaged Infrastructure removal.");
      } else {
        // Fallback: queue the repair request directly on faction flags (matches api.turn.processRequests schema)
        try {
          const flags = safeDup(A.flags?.[MODF] || {});
          flags.requests = flags.requests || {};
          flags.requests.repairs = flags.requests.repairs || {};
          const arr = Array.isArray(flags.requests.repairs.requests) ? flags.requests.repairs.requests.slice() : [];
          arr.push({
            target: ctx.targetUuid,
            tag: "Damaged Infrastructure",
            source: "strategic-throughput",
            campaignId: null,
            beatId: null
          });
          flags.requests.repairs.requests = arr;
          await A.update({ [`flags.${MODF}`]: flags });
          await pushWarLog(A, "Minor Repair: queued Damaged Infrastructure removal (direct queue).");
        } catch (e) {
          await pushWarLog(A, "Minor Repair: failed to queue repair (no enqueueRequest).");
          warn("Minor Repair direct queue failed", e);
        }
      }
    };

    T.ration_distribution = async (ctx) => {
      const A = game.actors.get(ctx.factionId);
      if (!A) return;
      const ok = await adjustHexTrack(ctx.targetUuid, "loyalty", +1);
      await pushWarLog(A, ok ? "Ration Distribution: target hex Loyalty +1." : "Ration Distribution: no target hex.");
    };

    T.charity_drive = async (ctx) => {
      const A = game.actors.get(ctx.factionId);
      if (!A) return;
      const res = await adjustFactionTrack(A, "darkness", -1);
      await pushWarLog(A, `Charity Drive: Darkness ${res.before} → ${res.after}.`);
    };

    T.civic_audit = async (ctx) => {
      const A = game.actors.get(ctx.factionId);
      if (!A) return;
      const res = await adjustFactionTrack(A, "loyalty", +1);
      await pushWarLog(A, `Civic Audit: Loyalty ${res.before} → ${res.after}.`);
    };

    T.training_drills = async (ctx) => {
      const A = game.actors.get(ctx.factionId);
      if (!A) return;
      const bonuses = safeDup(A.getFlag(MODF,"bonuses") || {});
      bonuses.nextTurn = bonuses.nextTurn || {};
      bonuses.nextTurn.moraleBonus = Number(bonuses.nextTurn.moraleBonus || 0) + 1;
      await A.update({ [`flags.${MODF}.bonuses`]: bonuses });
      await pushWarLog(A, "Training Drills: +1 Morale next raid.");
    };

    raid.STRATEGIC_THROUGHPUT = T;
    log("Strategic Throughput bootstrap installed (Tier 1).");
  } catch (e) {
    warn("Strategic Throughput bootstrap failed (non-fatal).", e);
  }
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

  async function spendOPBestEffort({ factionActor, primaryKey, amount=1, ctx={} }){
    try {
      const fapi = game?.bbttcc?.api?.factions;
      if (typeof fapi?.spendOP === "function") {
        return await fapi.spendOP({ factionId: factionActor.id, key: primaryKey, amount, ctx });
      }
      if (typeof fapi?.adjustOP === "function") {
        return await fapi.adjustOP({ factionId: factionActor.id, key: primaryKey, delta: -Math.abs(amount), ctx });
      }
      if (typeof factionActor?.bbttccSpendOP === "function") {
        return await factionActor.bbttccSpendOP(primaryKey, amount, ctx);
      }
    } catch (e) {
      warn("OP spend attempt failed (non-fatal).", e);
      return { ok:false, error:e };
    }
    warn("No OP spend function found; skipping OP spend (alpha).");
    return { ok:false, skipped:true };
  }

  async function runEffectBestEffort({ effect, entry, factionActor, apply }){
    if (!effect) return { ok:true, skipped:true };

    const ctx = {
      apply: !!apply,
      entry,
      attackerId: entry?.attackerId || factionActor?.id,
      factionId: factionActor?.id,
      activityKey: entry?.activityKey,
      targetType: entry?.targetType || "hex",
      targetUuid: entry?.targetUuid || null,
      targetName: entry?.targetName || null,
      defenderId: entry?.defenderId || null,
      rigId: entry?.rigId || null,
      notes: entry?.note || entry?.notes || ""
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
    return { ok:true, skipped:true };
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
      opSpent: primaryKey ? { [primaryKey]: 1 } : {},
      spendResult: spendResult || null,
      effectResult: effectResult || null,
      summary: `${factionActor.name} executed ${entry.activityKey} on ${entry.targetName || entry.targetType || "target"}`
    };
  }

  raid.consumePlanned = async function consumePlanned({ factionId, apply=true } = {}) {
    const factionActor = game.actors.get(factionId);
    if (!factionActor) throw new Error("consumePlanned: faction actor not found.");

    const wl = deepClone(factionActor.getFlag(FCT_ID, "warLogs") || []);
    const planned = wl.filter(e => e?.type === "planned" && String(e?.attackerId) === String(factionActor.id));
    if (!planned.length) return { changed:false, count:0, rows:[] };

    const finalizedEntries = [];

    for (const entry of planned.sort((a,b)=>(a.ts||0)-(b.ts||0))) {
      const effect = getEffect(entry.activityKey);
      const primaryKey = inferPrimaryKey(effect);

      const spendResult = primaryKey
        ? await spendOPBestEffort({ factionActor, primaryKey, amount: 1, ctx:{ reason:"consumePlanned", entry } })
        : { ok:false, skipped:true };

      let effectResult = null;
  
      // ------------------------------------------------------------
      // Strategic Throughput Routing (Apply only)
      // ------------------------------------------------------------
      if (effect?.kind === "strategic" && apply) {
        const throughput = game.bbttcc?.api?.raid?.STRATEGIC_THROUGHPUT;
        const handler = throughput?.[String(entry.activityKey || "").trim()];

        if (typeof handler === "function") {
          try {
            await handler({
              factionId: factionActor.id,
              activityKey: entry.activityKey,
              targetUuid: entry.targetUuid || null,
              targetName: entry.targetName || null,
              notes: entry.note || entry.notes || ""
            });
            effectResult = { ok:true, routed:"strategic-throughput" };
          } catch (e) {
            console.warn("[bbttcc-turn] strategic throughput handler failed (fallback to legacy):", entry.activityKey, e);
            effectResult = await runEffectBestEffort({ effect, entry, factionActor, apply });
          }
        } else {
          // Not wired yet → fall back to legacy apply/consume/run handler if present
          effectResult = await runEffectBestEffort({ effect, entry, factionActor, apply });
        }

      } else {
        // Non-strategic, or Dry preview → legacy handler path
        effectResult = await runEffectBestEffort({ effect, entry, factionActor, apply });
      }

      finalizedEntries.push(finalizeEntry({ entry, factionActor, effect, effectResult, spendResult }));
    }

    
    // Re-fetch warLogs to preserve any Strategic Throughput handler writes
    const currentLogs = deepClone(factionActor.getFlag(FCT_ID, "warLogs") || []);
    const plannedTsSet = new Set(planned.map(e => e.ts));
    const next = currentLogs.filter(e => !(e?.type === "planned" && plannedTsSet.has(e.ts)));
    next.push(...finalizedEntries);
    await factionActor.setFlag(FCT_ID, "warLogs", next);


    return { changed:true, count: finalizedEntries.length, rows: finalizedEntries };
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

function zeroRes(){ return { food:0, materials:0, trade:0, military:0, knowledge:0, technology:0, defense:0 }; }
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
  military:"violence", knowledge:"intrigue", technology:"economy"
};
const DEFAULT_FACTORS = { food:1, materials:1, trade:1, military:1, knowledge:1, technology:1 };

/* --------------------------------- TERRITORY → STOCKPILE FALLBACK ---------------------------------- */
/** Sum per-hex resources for a faction from drawings/tiles across all scenes. */
function deriveStockpileFromOwnedHexes(factionId){
  const sum = { food:0, materials:0, trade:0, military:0, knowledge:0, technology:0 };
  try {
    for (const sc of game.scenes ?? []) {
      // Drawings
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MOD_TERRITORY]; if (!tf) continue;
        const owner = tf.factionId || tf.ownerId || "";
        if (owner !== factionId) continue;
        const r = tf.resources || {};
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
        const r = tf.resources || {};
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
  const keys = ["food","materials","trade","military","knowledge","technology"];
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
const LOGI = Object.freeze({
  DEMAND_TERRITORY_PER_HEX: 1.0,
  DEMAND_SHORT_PER_HEX: 1.0,
  DEMAND_OCCUPATION_PER_HEX: 2.0,
  DEMAND_DISTANCE_PER_STEP: 0.5, // floor(avgDist) * 0.5
  DEMAND_CITY_PER_HEX: 1.0,
  DEMAND_SPECIAL_PER_HEX: 0.5,
  DEMAND_RIG_PER_ACTIVE: 0.5,

  // Sprawl surcharge: max(0, hexes-4)^2 * 0.25
  SPRAWL_THRESHOLD: 4,
  SPRAWL_EXP: 2,
  SPRAWL_MULT: 0.25,

  CAPACITY_PER_LOGISTICS_OP: 1.0,
  CAPACITY_PER_TRADEPAIR: 1.0,
  CAPACITY_FULL_INTEG_PER_HEX: 0.5,
  CAPACITY_INFRA_DEPOT: 1.0,
  CAPACITY_INFRA_MAJORPORT: 1.0,
  CAPACITY_INFRA_ROADNET: 0.5,
  CAPACITY_LOGI_RIG: 0.5
});

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
  const grid = safeNum(canvas?.grid?.size, 100);
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
    const integ = h.tf?.integration || {};
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
  let depot = 0, majorPort = 0, roadNet = 0;

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
  }

  return { city, special, depot, majorPort, roadNet };
}

function deriveTradeRouteCountFromWarLogs(factionActor){
  try {
    const logs = factionActor.getFlag(MOD_FACTIONS, "warLogs") || [];
    for (let i = logs.length - 1; i >= 0; i--) {
      const e = logs[i];
      if (!e) continue;
      const s = safeStr(e.summary);
      if (!s.includes("Trade Routes:")) continue;
      const m = s.match(/Trade Routes:\s*(\d+)/i);
      if (m) return safeNum(m[1], 0);
      break;
    }
  } catch {}
  return null;
}

function deriveTradeRouteCountFromScene(factionId){
  try {
    const scene = canvas?.scene;
    const draws = canvas?.drawings?.placeables ?? [];
    if (!scene || !draws.length) return null;

    const isTradeHubHex = (tf) => {
      const mods = Array.isArray(tf?.modifiers) ? tf.modifiers : [];
      const type = safeStr(tf?.type).toLowerCase();
      if (mods.some(m => safeStr(m).toLowerCase() === "trade hub")) return true;
      if (type.includes("port")) return true;
      return false;
    };

    const neighbors = (draw, all) => {
      const c = draw.center ?? { x: draw.x + draw.w/2, y: draw.y + draw.h/2 };
      return all
        .filter(d => d.id !== draw.id)
        .map(d => {
          const cc = d.center ?? { x: d.x + d.w/2, y: d.y + d.h/2 };
          return { d, dist: Math.hypot(cc.x - c.x, cc.y - c.y) };
        })
        .sort((a,b)=>a.dist-b.dist)
        .slice(0, 6)
        .map(x=>x.d);
    };

    const edges = new Set();
    for (const hub of draws) {
      const tfHub = hub.document?.flags?.[MOD_TERRITORY];
      if (!tfHub) continue;
      const owner = tfHub.factionId || tfHub.ownerId;
      if (String(owner) !== String(factionId)) continue;
      if (!isTradeHubHex(tfHub)) continue;

      for (const n of neighbors(hub, draws)) {
        const tfN = n.document?.flags?.[MOD_TERRITORY];
        if (!tfN) continue;
        const ownerN = tfN.factionId || tfN.ownerId;
        if (String(ownerN) !== String(factionId)) continue;
        const key = [hub.id, n.id].sort().join("|");
        edges.add(key);
      }
    }
    return edges.size;
  } catch {
    return null;
  }
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

async function computeLogisticsPressureForFaction(factionActor){
  const fid = factionActor.id;

  // 1) Faction-side inputs
  const bank = clone(getFlag(factionActor, `${MOD_FACTIONS}.opBank`, zeroOps()));
  const logisticsOP = safeNum(bank.logistics);

  const { activeRigCount, logisticsRigCount } = readRigs(factionActor);

  // Trade routes: try warlog parse first, else derive on active scene if possible.
  let tradeRouteCount = deriveTradeRouteCountFromWarLogs(factionActor);
  if (tradeRouteCount === null) {
    const derived = deriveTradeRouteCountFromScene(fid);
    tradeRouteCount = (derived === null) ? 0 : derived;
  }

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
  const { city: cityCount, special: specialCount, depot: infraDepotCount, majorPort: infraMajorPortCount, roadNet: infraRoadNetCount } = countSpecials(owned);

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
  const tradeCapacity = Math.floor(tradeRouteCount / 2) * LOGI.CAPACITY_PER_TRADEPAIR;
  const integrationCapacity = fullIntegCount * LOGI.CAPACITY_FULL_INTEG_PER_HEX;
  const infraCapacity =
    (infraDepotCount * LOGI.CAPACITY_INFRA_DEPOT) +
    (infraMajorPortCount * LOGI.CAPACITY_INFRA_MAJORPORT) +
    (infraRoadNetCount * LOGI.CAPACITY_INFRA_ROADNET);
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
        activeRigCount,
        logisticsRigCount,
        tradeRouteCount,
        distSteps
      }
    }
  };

  return payload;
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
async function advanceOPRegen({ apply=false, factionId=null } = {}){
  const targets = factionId ? [game.actors.get(factionId)].filter(Boolean) : allFactions();
  const results = [];

  for (const A of targets) {
    try {
      // 1) Read bank + existing stock
      const opBank  = clone(getFlag(A, `${MOD_FACTIONS}.opBank`,    zeroOps()));
      let   stock   = clone(getFlag(A, `${MOD_FACTIONS}.stockpile`, zeroRes()));

      // 2) Fallback: derive stockpile from owned hexes if empty
      if (isEmptyStockpile(stock)) {
        const derived = deriveStockpileFromOwnedHexes(A.id);
        // Write the derived stockpile so future turns don't have to rebuild it
        stock = derived;
        try { await A.update({ [`flags.${MOD_FACTIONS}.stockpile`]: stock }); } catch {}
      }

      // 3) Regen parameters (allow per-faction overrides)
      const map     = { ...DEFAULT_REGEN_MAP, ...(getFlag(A, `${MOD_FACTIONS}.opRegenMap`, {})||{}) };
      const factors = { ...DEFAULT_FACTORS,  ...(getFlag(A, `${MOD_FACTIONS}.opRegenFactors`, {})||{}) };

      // 4) Compute OP delta
      const opsDelta = computeOpsFromStockpile(stock, map, factors);

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
      const totalGained = Object.values(opsDelta).reduce((a,b)=>a+b,0);

      const row = { factionId: A.id, factionName: A.name, gained: totalGained, opsDelta, applied:false };
      results.push(row);

      if (apply && totalGained > 0) {
        // proportional burn-down of stockpile (simple floor-based consume)
        const newStock = clone(stock);
        for (const [res, amtRaw] of Object.entries(stock||{})) {
          const amt = safeNum(amtRaw); if (!amt || amt <= 0) continue;
          const key = map[res]; if (!key) continue;
          const fac = safeNum(factors?.[res], 1); if (!(fac > 0)) continue;
          const gainedRes = Math.floor(amt * fac); if (gainedRes <= 0) continue;
          const consumed = Math.min(amt, Math.ceil(gainedRes / fac));
          newStock[res] = Math.max(0, amt - consumed);
        }

        const newBank = addOps(opBank, opsDelta);
        // ------------------------------------------------------------
        // OP CAP ENFORCEMENT
        // ------------------------------------------------------------
        try {
          const caps = A.getFlag("bbttcc-factions", "opCaps") || {};
          const keys = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

          for (const k of keys) {
            const cap = Number(caps[k] ?? 0);
            if (cap > 0) {
              newBank[k] = Math.min(Number(newBank[k] ?? 0), cap);
            }
          }
        } catch (e) {
          console.warn("[bbttcc-turn] OP cap clamp failed", e);
        }
        await A.update({ [`flags.${MOD_FACTIONS}.opBank`]: newBank, [`flags.${MOD_FACTIONS}.stockpile`]: newStock });

        const warLogs = clone(getFlag(A, `${MOD_FACTIONS}.warLogs`, [])) || [];
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
        warLogs.push({ type:"commit", date:(new Date()).toLocaleString(), summary:`OP Regen: ${fmtOpsRow(opsDelta)}` });
        await A.update({ [`flags.${MOD_FACTIONS}.warLogs`]: warLogs });

        await ChatMessage.create({
          content: `<p><b>${foundry.utils.escapeHTML(A.name)}</b> — <i>Advance OP (Apply)</i><br/>Gained: ${fmtOpsRow(opsDelta)}</p>`,
          whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
          speaker: { alias: "BBTTCC Turn Driver" }
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
      speaker: { alias: "BBTTCC Turn Driver" }
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
async function plannedRaidsStep({ apply=false } = {}){
  const raid = game.bbttcc?.api?.raid;
  if (!raid) return { changed:false, rows:[] };

  const FXS = allFactions();
  await Promise.all(FXS.map(A => migrateWarLogPluralIfNeeded(A)));

  if (apply && typeof raid.consumePlanned === "function") {
    let changed = false;
    const rows = [];
    for (const F of FXS) {
      try {
        const res = await raid.consumePlanned({ factionId: F.id, apply:true });
        if (res?.changed || res?.applied || res?.didWork || res?.count) changed = true;
        if (Array.isArray(res?.rows)) rows.push(...res.rows);
      } catch (e) { warn("consumePlanned error for", F?.name, e); }
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
    const bank  = flags.opBank || {};
    const logs  = Array.isArray(flags.warLogs) ? flags.warLogs : [];
    const planned = logs.filter(e => String(e?.type).toLowerCase() === "planned");
    if (!planned.length) continue;

    for (const e of planned) {
      const key = String(e.activity || e.activityKey || "").toLowerCase();
      const spec = EFFECTS[key];
      const label = spec?.label || (key ? key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()) : "(unknown)");
      const cost = spec?.cost || {};
      const afford = canAfford(bank, cost);
      rows.push({ faction: F.name, factionId: F.id, activity: key, label, cost, canAfford: afford });
      any = true;
    }
  }

  const fmt = (c)=>OP_KEYS.filter(k=>safeNum(c[k])>0).map(k=>`${c[k]} ${k}`).join(", ")||"—";
  await ChatMessage.create({
    content: any
      ? `<p><i>Planned Activities (Dry Preview)</i></p><ul>${rows.map(r => `<li><b>${foundry.utils.escapeHTML(r.faction)}</b>: ${foundry.utils.escapeHTML(r.label)} — ${fmt(r.cost)} ${r.canAfford?"":"<em>(cannot afford)</em>"}</li>`).join("")}</ul>`
      : `<p><i>Planned Activities (Dry Preview)</i>: none queued.</p>`,
    whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
    speaker: { alias: "BBTTCC Turn Driver" }
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
async function applyQueuedPostEffects(){
  const raid = game.bbttcc?.api?.raid;
  if (!raid?.consumeQueuedTurnEffects) return { changed:false, rows:[] };
  let changed = false;
  for (const F of allFactions()) {
    try {
      const res = await raid.consumeQueuedTurnEffects({ factionId: F.id });
      if (res?.changed || res?.appliedAt) changed = true;
    } catch (e) { warn("consumeQueuedTurnEffects error for", F?.name, e); }
  }
  return { changed, rows:[] };
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
  window._bbttccTurnLock = true;
  Hooks.callAll("bbttcc:advanceTurn:begin");
  if (apply) { try { await _bbttccTurnFxPlay("turn_start", { label:"Advance Turn" }, { phase:"invoke" }); } catch(_eFxStart) {} }

  try {
    const terr = game.bbttcc?.api?.territory ?? {};
    let promoted = { changed:false };
    if (apply) promoted = await promotePostToTurn();

    if (apply) ensureConsumePlannedShim();
    const planned = await plannedRaidsStep({ apply });

    let base = { changed:false, rows:[] };
    if (typeof terr._delegateAdvanceTurn === "function") {
      base = (await terr._delegateAdvanceTurn({ apply, sceneId })) ?? base;
    }

    let regen = { changed:false, rows:[] };
    if (apply) regen = await advanceOPRegen({ apply:true });

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
        if ((logistics.rows||[]).length) events.push({ label: `Logistics Pressure: ${(logistics.rows||[]).length} factions`, tone: "warn" });
        if (normalized.changed) events.push({ label: "Queued Effects Normalized", tone: "info" });
        if (queued.changed) events.push({ label: "Queued Effects Applied", tone: "good" });
        if (events.length) await _bbttccTurnFxPresentation(events, { speed:"slow", pauseBetween:900 });
        await _bbttccTurnFxPlay("turn_complete", { outcome: "Advance Turn Complete" }, { phase:"resolve" });
      } catch(_eFxEnd) {}
    }

    return {
      changed: !!(promoted.changed || planned.changed || base.changed || regen.changed || logistics.changed || normalized.changed || queued.changed),
      rows: __rows
    };
  } finally {
    window._bbttccTurnLock = false;
    Hooks.callAll("bbttcc:advanceTurn:end");
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
  const MOD_TERRITORY = MOD_TERRITORY ?? "bbttcc-territory";
  const MOD_FACTIONS  = MOD_FACTIONS  ?? "bbttcc-factions";

  const hexTarget =
    hexUuid ||
    v.hexUuid ||
    v.target ||
    target ||
    null;

  const facTarget =
    factionId ||
    v.factionId ||
    v.actorId ||
    null;

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
        // requests.statusSet is a string newStatus
        requests.statusSet = v.status || v.value || value || "secured";
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
      tag: v.tag || key || "Damaged Infrastructure",
      source: source || "campaign",
      campaignId: campaignId || null,
      beatId: beatId || null
    });

    flags.requests          = flags.requests || {};
    flags.requests.repairs  = { ...(flags.requests.repairs || {}), requests: existing };

    await A.update({ [`flags.${MOD_FACTIONS}`]: flags });

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
game.bbttcc ??= { api:{} };
game.bbttcc.api ??= {};
game.bbttcc.api.turn ??= game.bbttcc.api.turn || {};

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
