// BBTTCC Territory — Turn Driver
// Pipeline: (0) Promote post.pending → turn.pending (Apply only)
// → (1) Planned Raids (Dry=preview, Apply=commit per faction via compat)
// → (2) delegate advanceTurn → (3) OP Regen (proportional, Apply only)
// → (3.5) Normalize queued shape (nextRound → nextTurn)
// → (4) Apply queued turn.pending (Apply only)
// → (5) Hard cleanup

const NS = "[bbttcc-turn]";
const log  = (...a)=>console.log(NS, ...a);
const warn = (...a)=>console.warn(NS, ...a);

const MOD_FACTIONS  = "bbttcc-factions";
const MOD_TERRITORY = "bbttcc-territory";

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

/* ------------------------------- defaults -------------------------------- */
const DEFAULT_REGEN_MAP = {
  food:"logistics", materials:"economy", trade:"diplomacy",
  military:"violence", knowledge:"intrigue", technology:"economy"
};
const DEFAULT_FACTORS = { food:1, materials:1, trade:1, military:1, knowledge:1, technology:1 };

/* --------------------------------- TERRITORY → STOCKPILE FALLBACK ---------------------------------- */
/** Sum per-hex resources for a faction from drawings/tiles across all scenes.
 * Uses flags saved by Territory Hex Editor (resources: food, materials, trade, military, knowledge). */
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
        sum.food      += Number(r.food      || 0);
        sum.materials += Number(r.materials || 0);
        sum.trade     += Number(r.trade     || 0);
        sum.military  += Number(r.military  || 0);
        sum.knowledge += Number(r.knowledge || 0);
      }
      // Tiles (just in case we have any hexes as tiles)
      for (const t of sc.tiles ?? []) {
        const tf = t.flags?.[MOD_TERRITORY]; if (!tf) continue;
        const owner = tf.factionId || tf.ownerId || "";
        if (owner !== factionId) continue;
        const r = tf.resources || {};
        sum.food      += Number(r.food      || 0);
        sum.materials += Number(r.materials || 0);
        sum.trade     += Number(r.trade     || 0);
        sum.military  += Number(r.military  || 0);
        sum.knowledge += Number(r.knowledge || 0);
      }
    }
  } catch (e) { warn("deriveStockpileFromOwnedHexes failed", e); }
  return sum;
}

/** Returns true if all stockpile values are zero/empty. */
function isEmptyStockpile(stock) {
  const keys = ["food","materials","trade","military","knowledge","technology"];
  return keys.every(k => !Number(stock?.[k]||0));
}

/* --------------------------------- math ---------------------------------- */
function computeOpsFromStockpile(stockpile, regenMap, factors){
  const delta = zeroOps();
  for (const [res, amtRaw] of Object.entries(stockpile||{})) {
    const amt = Number(amtRaw||0); if (!amt || amt <= 0) continue;
    const key = regenMap[res]; if (!key) continue;
    const fac = Number(factors?.[res] ?? 1); if (!(fac > 0)) continue;
    const gained = Math.floor(amt * fac);
    if (gained > 0) delta[key] = (delta[key]||0) + gained;
  }
  return delta;
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
      const totalGained = Object.values(opsDelta).reduce((a,b)=>a+b,0);

      const row = { factionId: A.id, factionName: A.name, gained: totalGained, opsDelta, applied:false };
      results.push(row);

      if (apply && totalGained > 0) {
        // proportional burn-down of stockpile (simple floor-based consume)
        const newStock = clone(stock);
        for (const [res, amtRaw] of Object.entries(stock||{})) {
          const amt = Number(amtRaw||0); if (!amt || amt <= 0) continue;
          const key = map[res]; if (!key) continue;
          const fac = Number(factors?.[res] ?? 1); if (!(fac > 0)) continue;
          const gainedRes = Math.floor(amt * fac); if (gainedRes <= 0) continue;
          const consumed = Math.min(amt, Math.ceil(gainedRes / fac));
          newStock[res] = Math.max(0, amt - consumed);
        }

        const newBank = addOps(opBank, opsDelta);
        await A.update({ [`flags.${MOD_FACTIONS}.opBank`]: newBank, [`flags.${MOD_FACTIONS}.stockpile`]: newStock });

        const warLogs = clone(getFlag(A, `${MOD_FACTIONS}.warLogs`, [])) || [];
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

  // Factions
  for (const F of allFactions()) {
    const flags = clone(F.flags?.[MOD_FACTIONS] ?? {});
    const post  = clone(flags.post?.pending ?? {});
    if (Object.keys(post).length) {
      const turn = clone(flags.turn?.pending ?? {});
      const merged = _mergeObjects(turn, post);
      updates.push(F.update({
        [`flags.${MOD_FACTIONS}.turn.pending`]: merged,
        [`flags.${MOD_FACTIONS}.post.pending`]: {}
      }));
    }
  }

  // Hexes (scan all scenes' drawings for bbttcc-territory flags)
  for (const sc of game.scenes ?? []) {
    const drawings = sc.drawings ?? [];
    for (const d of drawings) {
      const tf = d.flags?.[MOD_TERRITORY];
      if (!tf) continue;
      const post = clone(tf.post?.pending ?? {});
      if (!Object.keys(post).length) continue;
      const turn = clone(tf.turn?.pending ?? {});
      const merged = _mergeObjects(turn, post);
      const pathTurn = `flags.${MOD_TERRITORY}.turn.pending`;
      const pathPost = `flags.${MOD_TERRITORY}.post.pending`;
      updates.push(d.update({ [pathTurn]: merged, [pathPost]: {} }, { parent: sc }));
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
  const canAfford = (bank={}, cost={}) => OP_KEYS.every(k => Number(bank[k]||0) >= Number(cost[k]||0));

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

  const fmt = (c)=>OP_KEYS.filter(k=>(c[k]||0)>0).map(k=>`${c[k]} ${k}`).join(", ")||"—";
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
      [`flags.${MOD_FACTIONS}.post.pending`]: {},
      [`flags.${MOD_FACTIONS}.turn.pending`]: {}
    }));
  }
  for (const sc of game.scenes ?? []) {
    const drawings = sc.drawings ?? [];
    for (const d of drawings) {
      if (!d.flags?.[MOD_TERRITORY]) continue;
      updates.push(d.update({
        [`flags.${MOD_TERRITORY}.turn.pending`]: {},
        [`flags.${MOD_TERRITORY}.post.pending`]: {}
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

  if (typeof terr.advanceTurn === "function" && terr.advanceTurn !== driverAdvanceTurn) {
    terr._delegateAdvanceTurn = terr.advanceTurn;
  }

  terr.advanceTurn     = driverAdvanceTurn;
  terr.advanceOPRegen  = advanceOPRegen;

  log("Turn Driver: promote post→turn, planned raids, delegate, auto-regen (+hex fallback), normalize queued, queued-consume, hard cleanup.");
}

async function driverAdvanceTurn({ apply=false, sceneId=null } = {}) {
  if (window._bbttccTurnLock) {
    console.warn("[bbttcc-turn] AdvanceTurn skipped — another Turn is already running.");
    return { changed:false, skipped:true };
  }
  window._bbttccTurnLock = true;
  Hooks.callAll("bbttcc:advanceTurn:begin");

  try {
    const terr = game.bbttcc?.api?.territory ?? {};
    let promoted = { changed:false };
    if (apply) promoted = await promotePostToTurn();
    const planned = await plannedRaidsStep({ apply });
    let base = { changed:false, rows:[] };
    if (typeof terr._delegateAdvanceTurn === "function") {
      base = (await terr._delegateAdvanceTurn({ apply, sceneId })) ?? base;
    }
    let regen = { changed:false, rows:[] };
    if (apply) regen = await advanceOPRegen({ apply:true });
    let normalized = { changed:false };
    if (apply) normalized = await normalizePendingShapes();
    let queued = { changed:false, rows:[] };
    if (apply) queued = await applyQueuedPostEffects();
    if (apply) await hardCleanupQueued();

    return {
      changed: !!(promoted.changed || planned.changed || base.changed || regen.changed || normalized.changed || queued.changed),
      rows:    [...(planned.rows||[]), ...(base.rows||[]), ...(regen.rows||[]), ...(queued.rows||[])]
    };
  } finally {
    window._bbttccTurnLock = false;
    Hooks.callAll("bbttcc:advanceTurn:end");
  }
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
game.bbttcc.api.turn.executeOPRegen = advanceOPRegen;
