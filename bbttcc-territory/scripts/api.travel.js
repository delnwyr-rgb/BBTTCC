/* bbttcc-travel/scripts/api.travel.js
 * Hex Movement MVP (Terrain cost + Encounter wiring + War Log)
 * Foundry v13.348 / dnd5e 5.1.9
 *
 * Drop this file into any active BBTTCC module's /scripts folder and ensure it is loaded.
 * On ready, it publishes `game.bbttcc.api.travel` with:
 *   - travelHex({ factionId, hexFrom, hexTo }) -> { ok, cost, encounter: {triggered, tier, result}, summary }
 *   - rollEncounter(tier) -> { tier, key, label }
 * Emits hooks: 'bbttcc:beforeTravel', 'bbttcc:afterTravel' for crew/feature modifiers.
 */

(() => {
  const MOD_FACTIONS  = "bbttcc-factions";
  const MOD_TERRITORY = "bbttcc-territory";
  const TAG = "[bbttcc-travel]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // ---------------- Utils (mirrors compat intent) ----------------
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const clamp0 = v => Math.max(0, Number(v ?? 0) || 0);
  const copy = (obj)=>foundry.utils.duplicate(obj ?? {});
  function zOP(){ const o={}; for (const k of OP_KEYS) o[k]=0; return o; }
  function addInto(dst, src){ for (const k of Object.keys(src||{})){ const kk=String(k).toLowerCase(); if (!OP_KEYS.includes(kk)) continue; dst[kk]=(dst[kk]||0)+Number(src[k]||0); } return dst; }
  function spendBank(bank=zOP(), cost=zOP()){ const next=copy(bank); for (const k of OP_KEYS) next[k]=clamp0((next[k]||0)-(cost[k]||0)); return next; }
  function canAfford(bank=zOP(), cost=zOP()){ for (const k of OP_KEYS) if (Number(bank[k]||0) < Number(cost[k]||0)) return false; return true; }
  function nowISO(){ try { return new Date().toLocaleString(); } catch { return ""; } }
  function ensure(obj, path, init) {
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

  // ---------------- Terrain costs & encounter chances ----------------
  // Keys should match your hex flags: flags["bbttcc-territory"].terrain.key  (fallbacks by name text).
  const TERRAIN = {
    plains:        { label:"Plains / Grasslands", cost:{ economy:1 },                     chance:10, tier:1 },
    forest:        { label:"Forest / Jungle",      cost:{ economy:1, intrigue:1 },        chance:20, tier:2 },
    mountains:     { label:"Mountains / Highlands",cost:{ economy:2, logistics:1 },       chance:30, tier:3 },
    canyon:        { label:"Canyons / Badlands",   cost:{ economy:1, violence:1 },        chance:20, tier:2 },
    swamp:         { label:"Swamp / Mire",         cost:{ economy:2, nonlethal:1 },       chance:30, tier:3 },
    desert:        { label:"Desert / Ash Wastes",  cost:{ economy:2 },                    chance:20, tier:2 },
    river:         { label:"River / Lake",         cost:{ economy:1, logistics:1 },       chance:10, tier:1 },
    ocean:         { label:"Sea / Ocean",          cost:{ economy:3, logistics:2 },       chance:35, tier:3 },
    ruins:         { label:"Ruins / Urban",        cost:{ economy:1, intrigue:1 },        chance:30, tier:3 },
    wasteland:     { label:"Wasteland / Radiation",cost:{ economy:1, faith:1 },           chance:40, tier:4 },
  };

  function _normalizeTerrainKey(flags){
    const t = (flags?.terrain?.key || flags?.terrain || flags?.type || "").toString().toLowerCase();
    if (!t) return null;
    // simple normalizer
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
    return t; // assume already a key
  }

  // Crew/feature hook surface: external enhancers can mutate cost/chance
  function _applyPreTravelHooks(ctx){
    try { Hooks.callAll("bbttcc:beforeTravel", ctx); } catch (e) { warn("beforeTravel hook error", e); }
  }
  function _applyPostTravelHooks(ctx){
    try { Hooks.callAll("bbttcc:afterTravel", ctx); } catch (e) { warn("afterTravel hook error", e); }
  }

  // -------------- Encounter tables (basic) --------------
  // If bbttcc-travel/scripts/encounters.js is present, we use that instead.
  const _DEFAULT_ENCOUNTERS = {
    1: [ { key:"broken_bridge", label:"Broken Bridge (hazard)" },
         { key:"scout_signs",   label:"Old Scout Signs (discovery)" } ],
    2: [ { key:"bandit_ambush", label:"Bandit Ambush (combat)" },
         { key:"acid_bog",      label:"Acid Bog (hazard)" } ],
    3: [ { key:"rockslide",     label:"Rockslide / Leviathan Wake (hazard)" },
         { key:"raider_raze",   label:"Raider Raze Team (combat)" } ],
    4: [ { key:"qliphotic_whorl", label:"Qliphotic Whorl (corruption)" },
         { key:"apex_predator",   label:"Apex Predator / War-Machine (combat)" } ],
  };

  function _encounterTables(){
    const ext = game.bbttcc?.api?.travel?.__encounters;
    if (ext && typeof ext.rollEncounter === "function") return ext;
    // inline minimal roller
    return {
      rollEncounter: (tier=1) => {
        const list = _DEFAULT_ENCOUNTERS[Number(tier)||1] || _DEFAULT_ENCOUNTERS[1];
        const pick = list[Math.floor(Math.random()*list.length)] || { key:"unknown", label:"Unknown" };
        return { tier:Number(tier)||1, key:pick.key, label:pick.label };
      }
    };
  }

  async function _getActor(idOrUuid){
    if (!idOrUuid) return null;
    const id = _stripActorId(idOrUuid);
    return game.actors.get(id) || (String(idOrUuid).startsWith("Actor.") ? await fromUuid(idOrUuid) : null);
  }

  // -------------- Core API: travelHex --------------
  async function travelHex({ factionId, hexFrom, hexTo } = {}){
    const A = await _getActor(factionId);
    if (!A) throw new Error("travelHex: faction not found");

    // Resolve hex docs (DrawingDocument or Actor with territory flags)
    const fromDoc = hexFrom ? (await fromUuid(hexFrom)) : null;
    const toDoc   = hexTo   ? (await fromUuid(hexTo))   : null;
    const toFlags = copy((toDoc?.document ?? toDoc)?.flags?.[MOD_TERRITORY] ?? {});
    const fromFlags = copy((fromDoc?.document ?? fromDoc)?.flags?.[MOD_TERRITORY] ?? {});
    const tKey = _normalizeTerrainKey(toFlags);
    const terr = TERRAIN[tKey] || TERRAIN.plains;

    // Base cost & chance
    const cost = copy(terr.cost || {});
    let chance = Number(terr.chance || 0);
    const tier  = Number(terr.tier || 1);

    // Context for hooks
    const ctx = {
      actor: A,
      from: { doc: fromDoc, flags: fromFlags },
      to:   { doc: toDoc,   flags: toFlags, terrainKey: tKey, terrain: terr },
      cost, chance, tier,
      notes: []
    };

    _applyPreTravelHooks(ctx); // crew/extenders may adjust cost/chance/tier/notes

    // Spend OPs
    const flags = copy(A.flags?.[MOD_FACTIONS] ?? {});
    let bank    = copy(flags.opBank || zOP());
    let pools   = copy(flags.pools  || zOP());

    if (!canAfford(bank, cost)) {
      ui.notifications?.warn?.("Not enough OP in Turn Bank to travel.");
      const summary = `Travel failed (insufficient OP) — need ${Object.entries(cost).map(([k,v])=>`${k}:${v}`).join(", ")}`;
      await pushWarLog(A, { type:"travel", summary, from: (fromFlags?.name||fromDoc?.name)||null, to:(toFlags?.name||toDoc?.name)||null });
      return { ok:false, cost, encounter:{ triggered:false, tier:null, result:null }, summary };
    }

    bank  = spendBank(bank, cost);
    pools = spendBank(pools, cost);
    await A.update({ [`flags.${MOD_FACTIONS}.opBank`]: bank, [`flags.${MOD_FACTIONS}.pools`]: pools });

    // Roll for encounter (percentile vs chance)
    const rolled = Math.floor(Math.random()*100)+1;
    const triggered = rolled <= Number(chance||0);
    const roller = _encounterTables();
    const encounter = triggered ? roller.rollEncounter(ctx.tier) : { tier: null, key:null, label:"Safe travel" };

    // Build summary & log
    const fromName = (fromFlags?.name || fromDoc?.name || "Unknown From");
    const toName   = (toFlags?.name   || toDoc?.name   || "Unknown To");
    const costStr  = Object.entries(cost).map(([k,v])=>`${k}:${v}`).join(", ");
    const encStr   = triggered ? `Encounter (Tier ${encounter.tier}): ${encounter.label}` : "No encounter";
    const summary  = `Traveled ${fromName} → ${toName} • Spent ${costStr} • Roll ${rolled}/${chance}% • ${encStr}`;

    _applyPostTravelHooks({ ...ctx, rolled, encounter, summary });

    await pushWarLog(A, { type:"travel", summary, from:fromName, to:toName, cost, rolled, chance, encounter });

    log(summary);
    return { ok:true, cost, encounter:{ triggered, tier:encounter.tier, result:encounter }, summary };
  }

  function ensureNS(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.travel ??= {};
  }

  function publish(){
    ensureNS();
    // Merge so extenders (like encounters.js) can attach under api.travel.__encounters
    const existing = game.bbttcc.api.travel;
    const api = Object.assign({}, existing, {
      travelHex,
      rollEncounter: (tier)=>_encounterTables().rollEncounter(tier),
      __terrain: TERRAIN
    });
    game.bbttcc.api.travel = api;
    log("Travel API published on game.bbttcc.api.travel");
  }

  if (globalThis?.Hooks?.once) Hooks.once("ready", publish);
  try { if (globalThis?.game?.ready === true) publish(); } catch {}
})();