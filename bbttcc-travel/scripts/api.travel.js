/* bbttcc-travel/scripts/api.travel.js
 * Hex Movement MVP (Terrain cost + Encounter wiring + War Log)
 * Foundry v13.348 / dnd5e 5.1.9
 *
 * Publishes game.bbttcc.api.travel:
 *   - travelHex({ factionId, hexFrom, hexTo }) -> { ok, cost, encounter:{triggered,tier,result}, summary }
 *   - previewTravelHex({ factionId, hexFrom, hexTo }) -> same as travelHex but NO OP SPEND / NO WAR LOG
 *   - rollEncounter(tier) -> { tier, key, label }
 * Emits hooks: 'bbttcc:beforeTravel', 'bbttcc:afterTravel' for crew/feature modifiers.
 */

(() => {
  const MOD_FACTIONS  = "bbttcc-factions";
  const MOD_TERRITORY = "bbttcc-territory";
  const TAG  = "[bbttcc-travel]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // ---------------- Utils ----------------
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  const nowISO = ()=> new Date().toISOString();

  function copy(x){
    return x && typeof x === "object" ? foundry.utils.deepClone(x) : x;
  }

  function zOP(){
    const o = {};
    for (const k of OP_KEYS) o[k] = 0;
    return o;
  }

  function canAfford(bank, cost){
    bank = bank || zOP();
    cost = cost || zOP();
    for (const k of OP_KEYS) {
      const have = Number(bank[k] || 0);
      const need = Number(cost[k] || 0);
      if (have < need) return false;
    }
    return true;
  }

  function spendBank(bank, cost){
    bank = copy(bank || zOP());
    cost = cost || zOP();
    for (const k of OP_KEYS) {
      const need = Number(cost[k] || 0);
      if (!need) continue;
      bank[k] = Number(bank[k] || 0) - need;
      if (bank[k] < 0) bank[k] = 0;
    }
    return bank;
  }

  async function _getActor(factionId){
    if (!factionId) return null;
    const id = _stripActorId(factionId);
    const byId = game.actors.get(id);
    if (byId) return byId;
    const byName = game.actors.find(a => a.name === factionId);
    if (byName) return byName;
    try {
      if (factionId.startsWith("Actor.") && fromUuid) {
        const doc = await fromUuid(factionId);
        if (doc && doc instanceof Actor) return doc;
      }
    } catch (e) {
      warn("Error resolving actor from uuid", e);
    }
    return null;
  }

  async function _resolveHex(idOrUuid){
    if (!idOrUuid) return null;
    if (typeof idOrUuid === "string" && idOrUuid.startsWith("Scene.")) {
      try {
        const d = await fromUuid(idOrUuid);
        return d;
      } catch (e) {
        warn("resolveHex fromUuid error", e);
        return null;
      }
    }
    const sc = canvas?.scene;
    if (!sc) return null;
    const hitDrawing = sc.drawings?.get(idOrUuid);
    if (hitDrawing) return hitDrawing;
    const hitTile = sc.tiles?.get(idOrUuid);
    if (hitTile) return hitTile;
    if (typeof idOrUuid === "string") {
      try {
        const d = await fromUuid(idOrUuid);
        return d;
      } catch (e) {
        warn("resolveHex fromUuid fallback error", e);
      }
    }
    return null;
  }

  function _normalizeTerrainKey(flags){
    const t = String(flags?.terrain?.key || flags?.terrainKey || flags?.terrainType || "").trim().toLowerCase();
    if (!t) return "";
    if (t.includes("plain")||t.includes("grass")) return "plains";
    if (t.includes("forest")||t.includes("jungle")) return "forest";
    if (t.includes("mount")||t.includes("highland")) return "mountains";
    if (t.includes("canyon")||t.includes("badland")) return "canyon";
    if (t.includes("swamp")||t.includes("mire")) return "swamp";
    if (t.includes("desert")||t.includes("ash")) return "desert";
    if (t.includes("river")||t.includes("lake")) return "river";
    if (t.includes("sea")||t.includes("ocean")) return "ocean";
    if (t.includes("ruin")||t.includes("urban")||t.includes("wreck")) return "ruins";
    if (t.includes("waste")||t.includes("radiation")||t.includes("zone")) return "wasteland";
    return t;
  }

  // API hook surfaces
  function _applyPreTravelHooks(ctx){
    try { Hooks.callAll("bbttcc:beforeTravel", ctx); } catch (e) { warn("beforeTravel hook error", e); }
  }

  function _applyPostTravelHooks(ctx){
    try { Hooks.callAll("bbttcc:afterTravel", ctx); } catch (e) { warn("afterTravel hook error", e); }
  }

  // ---------------- Default encounter table (can be overridden) ----------------
  const _DEFAULT_ENCOUNTERS = {
    1: [ { key:"broken_bridge",   label:"Broken Bridge (hazard)" },
         { key:"scout_signs",     label:"Scout Signs / Tracks (intel)" } ],
    2: [ { key:"bandit_ambush",   label:"Bandit Ambush (combat)" },
         { key:"acid_bog",        label:"Acid Bog (hazard)" } ],
    3: [ { key:"rockslide",       label:"Rockslide / Leviathan Wake (hazard)" },
         { key:"raider_raze",     label:"Raider Raze Team (combat)" } ],
    4: [ { key:"qliphotic_whorl", label:"Qliphotic Whorl (corruption)" },
         { key:"apex_predator",   label:"Apex Predator / War-Machine (combat)" } ],
  };

  function _encounterTables(){
    const ext = game.bbttcc?.api?.travel?.__encounters;
    if (ext && typeof ext.rollEncounter === "function") return ext;
    return {
      rollEncounter: (tier=1) => {
        const list = _DEFAULT_ENCOUNTERS[Number(tier)||1] || _DEFAULT_ENCOUNTERS[1];
        const pick = list[Math.floor(Math.random()*list.length)] || { key:"unknown", label:"Unknown" };
        return Object.assign({ tier }, pick);
      }
    };
  }

  // ---------------- Terrain costs & encounter chances ----------------
  // Keys should match your hex flags: flags["bbttcc-territory"].terrain.key / terrainType.
  const TERRAIN = {
    plains:    { label:"Plains / Grasslands",       cost:{ economy:1 },               chance:10, tier:1 },
    forest:    { label:"Forest / Jungle",           cost:{ economy:1, intrigue:1 },   chance:20, tier:2 },
    mountains: { label:"Mountains / Highlands",     cost:{ economy:2, logistics:1 },  chance:30, tier:3 },
    canyon:    { label:"Canyons / Badlands",        cost:{ economy:1, violence:1 },   chance:20, tier:2 },
    swamp:     { label:"Swamp / Mire",              cost:{ economy:2, nonlethal:1 },  chance:30, tier:3 },
    desert:    { label:"Desert / Ash Wastes",       cost:{ economy:2 },               chance:20, tier:2 },
    river:     { label:"River / Lake",              cost:{ economy:1, logistics:1 },  chance:10, tier:1 },
    ocean:     { label:"Sea / Ocean",               cost:{ economy:3, logistics:2 },  chance:35, tier:3 },
    ruins:     { label:"Ruins / Urban",             cost:{ economy:1, intrigue:1 },   chance:30, tier:3 },
    wasteland: { label:"Wasteland / Radiation",     cost:{ economy:1, faith:1 },      chance:40, tier:4 },
  };

  // ---------------- Small helpers ----------------
  function _ensure(obj, path, init){
    const parts = String(path).split(".");
    let cur = obj;
    for (let i=0;i<parts.length;i++) {
      const k = parts[i];
      if (cur[k] === undefined) cur[k] = (i === parts.length-1 ? (init ?? {}) : {});
      cur = cur[k];
    }
    return cur;
  }
  const _stripActorId = id => (typeof id === "string" && id.startsWith("Actor.")) ? id.slice(6) : id;

  async function pushWarLog(actor, entry){
    const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {});
    const wl = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
    wl.push({ ts: Date.now(), date: nowISO(), ...entry });
    await actor.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl });
  }

// ---------------- Core travel (mutating) ----------------
async function travelHex({ factionId, hexFrom, hexTo } = {}){

  const A = await _getActor(factionId);
  if (!A) throw new Error("travelHex: faction not found");

  const fromObj = hexFrom ? await _resolveHex(hexFrom) : null;
  const toObj   = hexTo   ? await _resolveHex(hexTo)   : null;

  const fromFlags = copy((fromObj?.document ?? fromObj)?.flags?.[MOD_TERRITORY] ?? {});
  const toFlags   = copy((toObj  ?.document ?? toObj  )?.flags?.[MOD_TERRITORY] ?? {});

  const tKey = _normalizeTerrainKey(toFlags) || "plains";
  const terr = TERRAIN[tKey] || TERRAIN.plains;

  const cost   = copy(terr.cost || {});
  let   chance = Number(terr.chance || 0);
  const tier   = Number(terr.tier || 1);

  const ctx = {
    actor: A,
    from: { obj: fromObj, flags: fromFlags },
    to:   { obj: toObj,   flags: toFlags, terrainKey: tKey, terrain: terr },
    cost, chance, tier,
    notes: []
  };

  _applyPreTravelHooks(ctx); // crew/extenders may adjust cost/chance/tier/notes

  // Spend OPs from Turn Bank + Pools
  const flags = copy(A.flags?.[MOD_FACTIONS] ?? {});
  let bank    = copy(flags.opBank || zOP());
  let pools   = copy(flags.pools  || zOP());

  if (!canAfford(bank, cost)) {
    ui.notifications?.warn?.("Not enough OP in Turn Bank to travel.");
    const summary = `Travel failed (insufficient OP) — need ${Object.entries(cost).map(([k,v])=>`${k}:${v}`).join(", ")}`;
    await pushWarLog(A, { type:"travel", summary, from:"Unknown From", to:"Unknown To" });
    return { ok:false, cost, encounter:{ triggered:false, tier:null, result:null }, summary };
  }

  bank  = spendBank(bank, cost);
  pools = spendBank(pools, cost);
  await A.update({
    [`flags.${MOD_FACTIONS}.opBank`]:  bank,
    [`flags.${MOD_FACTIONS}.pools`]:  pools
  });

  // Roll for encounter
  const rolled    = Math.floor(Math.random()*100)+1;
  const triggered = rolled <= Number(chance||0);
  const roller    = _encounterTables();
  const encObj    = triggered ? roller.rollEncounter(ctx.tier)
                              : { tier:null, key:null, label:"Safe travel" };

  const fromName =
    fromFlags?.name ||
    fromObj?.document?.text ||
    fromObj?.document?.name ||
    "Unknown From";

  const toName =
    toFlags?.name ||
    toObj?.document?.text ||
    toObj?.document?.name ||
    "Unknown To";

  const costStr = Object.entries(cost).map(([k,v])=>`${k}:${v}`).join(", ");

  const encStr = triggered
    ? `Encounter (Tier ${encObj.tier}): ${encObj.label}`
    : "No encounter";

  const summary =
    `Traveled ${fromName} → ${toName} • Spent ${costStr} ` +
    `• Roll ${rolled}/${chance}% • ${encStr}`;

  // IMPORTANT: wrap encounter to include triggered + result, like the return format
  const encounterCtx = { triggered, tier: encObj.tier, result: encObj };

  _applyPostTravelHooks({
    source: "travel",
    ...ctx,
    rolled,
    encounter: encounterCtx,
    summary
  });

  await pushWarLog(A, {
    type: "travel",
    summary,
    from: fromName,
    to:   toName,
    cost,
    rolled,
    chance,
    encounter: encObj   // warLog keeps simple result; fine for history
  });

  log(summary);

  return {
    ok: true,
    cost,
    encounter: encounterCtx,
    summary
  };
}

  // ---------------- Preview travel (non-mutating) ----------------
  async function previewTravelHex({ factionId, hexFrom, hexTo } = {}){
    const A = await _getActor(factionId);
    if (!A) throw new Error("previewTravelHex: faction not found");

    const fromObj = hexFrom ? await _resolveHex(hexFrom) : null;
    const toObj   = hexTo   ? await _resolveHex(hexTo)   : null;

    const fromFlags = copy((fromObj?.document ?? fromObj)?.flags?.[MOD_TERRITORY] ?? {});
    const toFlags   = copy((toObj  ?.document ?? toObj  )?.flags?.[MOD_TERRITORY] ?? {});

    const tKey = _normalizeTerrainKey(toFlags) || "plains";
    const terr = TERRAIN[tKey] || TERRAIN.plains;

    const cost = copy(terr.cost || {});
    let   chance = Number(terr.chance || 0);
    const tier   = Number(terr.tier || 1);

    const ctx = {
      actor: A,
      from: { obj: fromObj, flags: fromFlags },
      to:   { obj: toObj,   flags: toFlags, terrainKey: tKey, terrain: terr },
      cost, chance, tier,
      notes: []
    };

    // Let beforeTravel hooks adjust cost/chance/tier/notes, but do not spend OP or write logs.
    _applyPreTravelHooks(ctx);

    chance = Number(ctx.chance ?? chance);

    // Roll for encounter, but do not mutate any world state.
    const rolled    = Math.floor(Math.random()*100)+1;
    const triggered = rolled <= Number(chance || 0);
    const roller    = _encounterTables();
    const encObj    = triggered ? roller.rollEncounter(ctx.tier) : { tier:null, key:null, label:"Safe travel" };

    const fromName =
      fromFlags?.name ||
      fromObj?.document?.text ||
      fromObj?.document?.name ||
      "Unknown From";

    const toName =
      toFlags?.name ||
      toObj?.document?.text ||
      toObj?.document?.name ||
      "Unknown To";

    const costStr = Object.entries(cost).map(([k,v])=>`${k}:${v}`).join(", ");
    const encStr  = triggered ? `Encounter (Tier ${encObj.tier}): ${encObj.label}` : "No encounter";
    const summary = `PREVIEW: Travel ${fromName} → ${toName} • Would spend ${costStr} • Roll ${rolled}/${chance}% • ${encStr}`;

    // Fire post-travel hooks in preview mode so listeners (like encounter preview) can respond.
    _applyPostTravelHooks({ ...ctx, rolled, encounter: encObj, summary, preview:true });

    log(summary);
    return { ok:true, preview:true, cost, encounter:{ triggered, tier:encObj.tier, result:encObj }, summary };
  }

  // ---------------- Publish API ----------------
  function ensureNS(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
  }

  function publish(){
    ensureNS();
    const existing = game.bbttcc.api.travel || {};
    const api = Object.assign({}, existing, {
      travelHex,
      previewTravelHex,
      rollEncounter: (tier)=>_encounterTables().rollEncounter(tier),
      __terrain: TERRAIN
    });
    game.bbttcc.api.travel = api;
    log("Travel API published on game.bbttcc.api.travel");
  }

  if (globalThis?.Hooks?.once) Hooks.once("ready", publish);
  try { if (globalThis?.game?.ready === true) publish(); } catch {}
})();
