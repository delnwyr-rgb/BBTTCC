// bbttcc-raid/scripts/siege-state.js
// SIEGE_RAID_TYPE_SPEC.md §2-§3 — state schema, helpers, API exposure.
// Phase A: schema + helpers + API surface. Phase B authors the strategic tick.

(() => {
  globalThis.__bbttcc_siege_state_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const MOD_S = "bbttcc-structures";
  const TAG = "[bbttcc/siege-state]";

  // ---- Spec §3 lookup tables ----
  // NOTE: real territory data uses PLURAL terrain keys ("mountains", "hills", "swamps", etc.)
  // — keys below cover both forms via normalization in terrainModifier().
  const TERRAIN_MODIFIERS = {
    // Plural (canonical, matches real hex data)
    radiated:     { drain: 1.8, grace: 0 },
    mountains:    { drain: 1.5, grace: 1 },
    badlands:     { drain: 1.5, grace: 1 },
    canyons:      { drain: 1.5, grace: 1 },
    volcanic:     { drain: 1.5, grace: 1 },
    swamps:       { drain: 1.4, grace: 1 },
    tundra:       { drain: 1.4, grace: 1 },
    desert:       { drain: 1.3, grace: 1 },
    jungle:       { drain: 1.3, grace: 1 },
    forests:      { drain: 1.2, grace: 2 },
    coast:        { drain: 1.0, grace: 2 },
    hills:        { drain: 1.0, grace: 2 },
    plains:       { drain: 1.0, grace: 2 },
    sea:          { drain: 0.7, grace: 1 },
    // Singular aliases (compat)
    mountain:     { drain: 1.5, grace: 1 },
    canyon:       { drain: 1.5, grace: 1 },
    swamp:        { drain: 1.4, grace: 1 },
    forest:       { drain: 1.2, grace: 2 },
    plain:        { drain: 1.0, grace: 2 },
    hill:         { drain: 1.0, grace: 2 },
    // Wilderness fallback
    wilderness:   { drain: 1.2, grace: 1 }
  };

  const SIZE_PROFILES = {
    skirmish:   { baseDrain: 8, targetTurns: 3 },
    standard:   { baseDrain: 5, targetTurns: 6 },
    protracted: { baseDrain: 3, targetTurns: 12 },
    epic:       { baseDrain: 2, targetTurns: 20 }
  };

  const DEPOT_MARQUEE_MODIFIERS = new Set([
    "Fortified", "Trade Hub", "Capital", "Major Settlement", "Beached Camp"
  ]);

  const FAIL_STATE_MODIFIERS = new Set([
    "Razed", "Burned", "Plague", "Damaged Infrastructure"
  ]);

  // ---- Pure helpers (no Foundry deps) ----

  function genSiegeId(){
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return `siege-${t}-${r}`;
  }

  function terrainModifier(terrainKey){
    const k = String(terrainKey || "").toLowerCase().trim();
    return TERRAIN_MODIFIERS[k] || TERRAIN_MODIFIERS.plains;
  }

  function makeSiegeState({
    attackerFactionId,
    supportingFactionIds = [],
    startedTurn,
    layers = [],
    sizeProfile = "standard",
    buffer = {},
    bufferStartingTotal = 0,
    supplyOriginHexId,
    supplyOriginType = "owned_hex",
    supplyPathHexIds = [],
    gracePeriodTurns = 2,
    isNavalSupply = false,
    eventDeckId = "generic",
    attackerChampions = [],
    defenderChampions = [],
    intent = "sack"
  } = {}){
    const profile = SIZE_PROFILES[sizeProfile] || SIZE_PROFILES.standard;
    return {
      siegeId: genSiegeId(),
      attackerFactionId,
      supportingFactionIds: supportingFactionIds.slice(),
      startedTurn: startedTurn ?? null,
      layers: layers.map((l, idx) => ({
        layerId: l.layerId || `layer-${idx}`,
        structureActorId: l.structureActorId,
        sceneId: l.sceneId || null,
        transitionRule: l.transitionRule || "razed",
        thresholdPct: l.thresholdPct ?? null,
        stockpileMax: l.stockpileMax ?? null,
        stockpileCurrent: l.stockpileCurrent ?? null,
        breached: false,
        breachedAtTurn: null,
        breachedBy: null
      })),
      currentLayerIdx: 0,
      sizeProfile,
      targetTurns: profile.targetTurns,
      buffer: {
        violence: 0, logistics: 0, economy: 0,
        softPower: 0, diplomacy: 0, faith: 0, intrigue: 0,
        ...buffer
      },
      bufferStartingTotal,
      supplyOriginHexId: supplyOriginHexId || null,
      supplyOriginType,
      supplyPathHexIds: supplyPathHexIds.slice(),
      supplyStatus: "supplied",
      supplySeveredAtTurn: null,
      gracePeriodTurns,
      isNavalSupply,
      perTurnDrain: {},
      conditionsBreakdown: {},
      // ---- Threat-vector state (Phase C) ----
      // Per-turn pulse counters — netted + reset each strategic tick.
      interdictionsThisTurn: 0,
      escortPipsThisTurn: 0,
      // Persistent severance bookkeeping: path hexes whose "Supply Line" modifier
      // has been stripped by Interdict/Sortie and not yet Counter-Interdicted.
      // Survives across turns until restored or the siege resolves.
      interdictedHexIds: [],
      // Running tally of defender holdings lost to Sorties (outcome bookkeeping; Phase E/F roster write-back).
      sortieCasualtiesTotal: 0,
      // ---- Counter-activity state (Phase E.1) ----
      defenderAnytimeBudget: 0,   // Reinforce Garrison / Champion Defends Wall — consumed by E.2 budget calc
      renewalPool: 0,             // Reinforce Garrison — defender repair pool (Phase F)
      championLocks: {},          // Champion Defends Wall — { championId: untilTurn }
      omenReroll: false,          // Pray for Omen — next Event Deck draw re-rolls in defender's favor (Phase F)
      stormAssault: null,         // Storm Final Assault — { budgetMult, turn } consumed by the next convene
      pendingTerms: null,         // Sue for Terms / Demand Surrender — { type, turn, resolved }
      reliefWaves: [],
      // ---- Pending faction-morale deltas (Phase E.3 → drained by Phase F) ----
      // Morale changes that land MID-siege (e.g. a relief force repulsed → defender −1)
      // have no siege-ending `bbttcc:siege:outcome` hook to apply them, so we accumulate
      // them here as structured records. Phase F's outcome write-back drains this array
      // IN ADDITION to the §8 outcome-matrix morale (which keys off the terminal status).
      // Each entry: { factionId, delta, reason, turn }.
      pendingMoraleDeltas: [],
      attackerChampions: attackerChampions.slice(),
      defenderChampions: defenderChampions.slice(),
      eventDeckId,
      eventsFired: [],
      narrativeBeats: [],
      intent,
      status: "active",
      endedTurn: null
    };
  }

  function appendNarrativeBeat(state, beat){
    state.narrativeBeats = Array.isArray(state.narrativeBeats) ? state.narrativeBeats : [];
    const out = {
      turn: beat.turn ?? null,
      kind: beat.kind,
      title: beat.title || "",
      description: beat.description || ""
    };
    if (Array.isArray(beat.actorIds)) out.actorIds = beat.actorIds.slice();
    if (beat.payload !== undefined) out.payload = beat.payload;
    state.narrativeBeats.push(out);
    return state;
  }

  /**
   * Record a pending faction-morale delta on the siege state (Phase E.3 → Phase F drains).
   * For morale changes that land mid-siege (no terminal outcome hook to carry them).
   * Mutates + returns state. `delta` is signed (−1 = lost a point of morale).
   */
  function recordMoraleDelta(state, { factionId, delta, reason = "", turn = null } = {}){
    if (!factionId || !Number.isFinite(delta) || delta === 0) return state;
    state.pendingMoraleDeltas = Array.isArray(state.pendingMoraleDeltas) ? state.pendingMoraleDeltas : [];
    state.pendingMoraleDeltas.push({ factionId, delta, reason, turn });
    return state;
  }

  // ---- Foundry hex helpers ----

  function _hexFlagsBlock(doc){
    return doc?.flags?.[MOD_T] || {};
  }

  function hexOwner(doc){
    // Canonical field in real data is `factionId` (confirmed via in-game probe 2026-05-22).
    // Empty string means unclaimed; treat as null.
    const f = _hexFlagsBlock(doc);
    const candidates = [f?.factionId, f?.ownerFactionId, f?.controllerFactionId, f?.faction];
    for (const c of candidates) {
      if (typeof c === "string" && c.length > 0) return c;
    }
    return null;
  }

  /**
   * isFactionActor — canonical Faction discriminator.
   * Mirrors `module.raid-planner.js:400-401`. An actor qualifies if EITHER:
   *   - flags["bbttcc-factions"].isFaction === true, OR
   *   - system.details.type.value === "faction"
   * Stewards (PCs) and other actors return false.
   */
  function isFactionActor(actor){
    if (!actor) return false;
    if (actor.getFlag?.(MOD_F, "isFaction") === true) return true;
    const t = foundry.utils.getProperty(actor, "system.details.type.value");
    return String(t || "").toLowerCase() === "faction";
  }

  function hexModifiers(doc){
    const mods = _hexFlagsBlock(doc)?.modifiers;
    return Array.isArray(mods) ? mods : [];
  }

  function hexTerrainKey(doc){
    const f = _hexFlagsBlock(doc);
    const t = f?.terrain;
    // Check terrain.key first (object form), then top-level terrainKey/terrainType, then string terrain.
    if (typeof t === "object" && t?.key) return String(t.key).toLowerCase();
    if (typeof t === "string") return t.toLowerCase();
    if (f?.terrainKey) return String(f.terrainKey).toLowerCase();
    if (f?.terrainType) return String(f.terrainType).toLowerCase();
    return "plains";
  }

  function hexHoldings(doc){
    return _hexFlagsBlock(doc)?.holdings || { rigIds: [], bossIds: [] };
  }

  function hexStructureActorIds(doc){
    const ids = _hexFlagsBlock(doc)?.structureActorIds;
    return Array.isArray(ids) ? ids.slice() : [];
  }

  function hexHasActiveSiege(doc){
    return !!_hexFlagsBlock(doc)?.siege;
  }

  // ---- Depot qualification (spec §3) ----

  function validateDepot(hexDoc, attackerFactionId){
    if (!hexDoc) return { ok: false, reason: "Hex not found" };
    if (hexOwner(hexDoc) !== attackerFactionId) {
      return { ok: false, reason: "Hex must be owned by the attacker" };
    }
    const mods = hexModifiers(hexDoc);
    const hasMarquee = mods.some(m => DEPOT_MARQUEE_MODIFIERS.has(m));
    if (!hasMarquee) {
      return { ok: false, reason: `Hex needs a marquee modifier: ${Array.from(DEPOT_MARQUEE_MODIFIERS).join(" / ")}` };
    }
    const holdings = hexHoldings(hexDoc);
    const hasHoldings = ((holdings.rigIds || []).length + (holdings.bossIds || []).length) > 0;
    if (!hasHoldings) {
      return { ok: false, reason: "Hex must have a non-empty holdings roster (rigs or bosses)" };
    }
    if (hexHasActiveSiege(hexDoc)) {
      return { ok: false, reason: "Hex is currently under siege" };
    }
    const failMod = mods.find(m => FAIL_STATE_MODIFIERS.has(m));
    if (failMod) {
      return { ok: false, reason: `Hex is in a fail-state (${failMod})` };
    }
    return { ok: true, reason: null };
  }

  // ---- Siege state CRUD on hex flags ----

  async function _hexDocFromUuid(hexUuid){
    if (!hexUuid) return null;
    const ref = await fromUuid(hexUuid);
    return ref?.document ?? ref ?? null;
  }

  async function getSiegeState(hexUuid){
    const doc = await _hexDocFromUuid(hexUuid);
    return doc?.flags?.[MOD_T]?.siege || null;
  }

  async function setSiegeState(hexUuid, state){
    const doc = await _hexDocFromUuid(hexUuid);
    if (!doc) throw new Error(`Hex not found: ${hexUuid}`);
    await doc.update({ [`flags.${MOD_T}.siege`]: state }, { parent: doc.parent });
    return state;
  }

  async function clearSiegeState(hexUuid){
    const doc = await _hexDocFromUuid(hexUuid);
    if (!doc) return;
    await doc.update({ [`flags.${MOD_T}.-=siege`]: null }, { parent: doc.parent });
  }

  function listActiveSieges(){
    const out = [];
    for (const scene of (game.scenes || [])) {
      const collections = [scene.drawings, scene.notes, scene.tokens, scene.tiles];
      for (const coll of collections) {
        if (!coll) continue;
        for (const doc of coll) {
          const siege = doc?.flags?.[MOD_T]?.siege;
          if (siege && siege.status === "active") {
            const tf = doc.flags?.[MOD_T] || {};
            out.push({
              hexUuid: doc.uuid,
              hexName: tf.name || doc.id || "Unknown Hex",
              sceneId: scene.id,
              siege
            });
          }
        }
      }
    }
    return out;
  }

  // ---- Supply BFS (Phase A stub; Phase B implements full graph walk) ----

  async function bfsSupplyPath({ siegeTargetHexUuid, depotHexUuid, allowedFactionIds = [] }){
    if (!siegeTargetHexUuid || !depotHexUuid) {
      return { ok: false, path: [], reason: "missing endpoints" };
    }
    if (siegeTargetHexUuid === depotHexUuid) {
      return { ok: true, path: [depotHexUuid], length: 0, reason: "depot is target" };
    }
    // Phase A stub: assumes direct adjacency (one-hop).
    // Phase B walks the hex adjacency graph along "Supply Line" modifier chain
    // filtered by hex.ownerFactionId ∈ allowedFactionIds.
    return {
      ok: true,
      path: [depotHexUuid, siegeTargetHexUuid],
      length: 1,
      reason: "Phase A stub: assumed direct path"
    };
  }

  // ---- Champion snapshot ----

  function snapshotChampions(factionActor, extraActorIds = []){
    if (!factionActor) return [];
    const roster = factionActor.getFlag?.(MOD_F, "championRoster") || [];
    const ids = new Set([
      ...(Array.isArray(roster) ? roster : []),
      ...extraActorIds
    ]);
    return Array.from(ids).map(actorId => ({
      actorId,
      status: "active",
      reason: "siege_start"
    }));
  }

  // ---- Event Deck picker ----

  function pickEventDeck(hexDoc){
    const terrain = hexTerrainKey(hexDoc);
    const mods = hexModifiers(hexDoc);
    if (mods.includes("Sacred") || mods.includes("Holy Site")) return "sacred";
    if (terrain === "sea" || terrain === "coast") return "naval";
    if (terrain === "desert") return "desert";
    return "generic";
  }

  // ---- Threat-vector helpers (Phase C) ----

  /**
   * Find active sieges whose supply path includes the given hex.
   * Threat vectors (Interdict / Counter-Interdict / Sortie) target a SUPPLY-PATH hex,
   * which may serve more than one concurrent siege.
   * @param {string} hexUuid
   * @param {object} [opts]
   * @param {boolean} [opts.includeTarget=false] include sieges where the hex IS the besieged target
   * @param {boolean} [opts.interdictedOnly=false] only sieges already listing the hex in interdictedHexIds
   * @returns {Array<{hexUuid, hexName, sceneId, siege}>}
   */
  function findSiegesUsingHex(hexUuid, { includeTarget = false, interdictedOnly = false } = {}){
    if (!hexUuid) return [];
    return listActiveSieges().filter(entry => {
      const s = entry.siege;
      if (!s) return false;
      if (interdictedOnly) return (s.interdictedHexIds || []).includes(hexUuid);
      const onPath = (s.supplyPathHexIds || []).includes(hexUuid);
      if (!onPath) return false;
      // Exclude the besieged hex itself (the path endpoint) unless explicitly requested —
      // you can't interdict a supply line at its destination.
      if (!includeTarget && entry.hexUuid === hexUuid) return false;
      return true;
    });
  }

  /**
   * Round-robin shave of OP from a buffer object across its non-empty categories.
   * Mirrors siege-tick.js::_drainBuffer so threat vectors and the tick deduct identically.
   * Mutates `buffer` in place. Returns { shaved, remaining, deducted }.
   */
  function shaveBuffer(buffer, amount){
    const deducted = { violence: 0, logistics: 0, economy: 0, softPower: 0, diplomacy: 0, faith: 0, intrigue: 0 };
    let remaining = Math.max(0, Number(amount) || 0);
    const want = remaining;
    const categories = Object.keys(buffer || {}).filter(k => buffer[k] > 0);
    if (!categories.length) return { shaved: 0, remaining: want, deducted };
    while (remaining > 0) {
      let drewAny = false;
      for (const cat of categories) {
        if (buffer[cat] <= 0) continue;
        buffer[cat] -= 1;
        deducted[cat] += 1;
        remaining -= 1;
        drewAny = true;
        if (remaining <= 0) break;
      }
      if (!drewAny) break;
    }
    return { shaved: want - remaining, remaining, deducted };
  }

  function bufferTotal(buffer){
    return Object.values(buffer || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  // ---- Champion status change (cascade detail deferred to Phase F) ----

  async function applyChampionStatusChange({ siegeId, championId, newStatus, source = "manual", side = null }){
    const all = listActiveSieges();
    const hit = all.find(s => s.siege?.siegeId === siegeId);
    if (!hit) {
      console.warn(TAG, "applyChampionStatusChange: siege not found", siegeId);
      return false;
    }
    const state = foundry.utils.duplicate(hit.siege);

    const tryUpdate = (arr) => {
      if (!Array.isArray(arr)) return false;
      const c = arr.find(c => c.actorId === championId);
      if (!c) return false;
      const prev = c.status;
      c.status = newStatus;
      c.reason = source;
      appendNarrativeBeat(state, {
        turn: game.bbttcc?.api?.world?.getState?.()?.turn ?? null,
        kind: "champion_status",
        title: `Champion ${prev} → ${newStatus}`,
        actorIds: [championId],
        payload: { prev, next: newStatus, source }
      });
      return true;
    };

    let updated = false;
    if (side === "attacker" || !side) updated = tryUpdate(state.attackerChampions) || updated;
    if (side === "defender" || !side) updated = tryUpdate(state.defenderChampions) || updated;

    if (!updated) {
      console.warn(TAG, "applyChampionStatusChange: champion not found", championId);
      return false;
    }

    await setSiegeState(hit.hexUuid, state);
    Hooks.callAll("bbttcc:siege:championStatus", {
      siegeId, championId, status: newStatus, source, side
    });
    return true;
  }

  // ---- API exposure (per bbttcc-api-exposure-pattern) ----

  function _installSiegeAPI(){
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};

    Object.assign(game.bbttcc.api.siege, {
      // schema + factories
      makeSiegeState,
      appendNarrativeBeat,
      recordMoraleDelta,
      terrainModifier,

      // state CRUD
      getState: getSiegeState,
      setState: setSiegeState,
      clearState: clearSiegeState,
      list: listActiveSieges,

      // validation
      validateDepot,
      bfsSupplyPath,
      isFaction: isFactionActor,

      // champions
      snapshotChampions,
      applyChampionStatusChange,

      // threat vectors (Phase C)
      findSiegesUsingHex,
      shaveBuffer,
      bufferTotal,

      // misc
      pickEventDeck,

      // constants (read-only refs)
      TERRAIN_MODIFIERS,
      SIZE_PROFILES,
      DEPOT_MARQUEE_MODIFIERS: Array.from(DEPOT_MARQUEE_MODIFIERS),
      FAIL_STATE_MODIFIERS: Array.from(FAIL_STATE_MODIFIERS)
    });
  }

  Hooks.once("init", _installSiegeAPI);
  Hooks.once("ready", _installSiegeAPI);
  if (game?.ready) _installSiegeAPI();

  // Expose internals to siege-throughput.js without going through public API
  globalThis.__bbttccSiegeState = {
    makeSiegeState, appendNarrativeBeat, recordMoraleDelta, terrainModifier,
    getSiegeState, setSiegeState, clearSiegeState, listActiveSieges,
    validateDepot, bfsSupplyPath, snapshotChampions,
    applyChampionStatusChange, pickEventDeck,
    findSiegesUsingHex, shaveBuffer, bufferTotal,
    hexOwner, hexModifiers, hexTerrainKey, hexHoldings,
    hexStructureActorIds, hexHasActiveSiege,
    isFactionActor,
    TERRAIN_MODIFIERS, SIZE_PROFILES,
    DEPOT_MARQUEE_MODIFIERS, FAIL_STATE_MODIFIERS,
    MOD_T, MOD_F, MOD_S
  };

  console.log(TAG, "loaded; API at game.bbttcc.api.siege");
})();
