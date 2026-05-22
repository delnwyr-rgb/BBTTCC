// bbttcc-raid/scripts/siege-supply-bfs.js
// SIEGE_RAID_TYPE_SPEC.md Phase B — real BFS along Supply Line modifier chain.
//
// Replaces the Phase A stub in siege-state.js with a real graph walk.
// Predicate (per spec §3):
//   hex.modifiers.includes("Supply Line")
//   AND hex.factionId ∈ allowedFactionIds  (attacker, peacetime allies, raid supporters)
//
// Termination: the chain reaches a hex that is a NEIGHBOR of the siege target.
// (The target hex itself is the enemy; we don't traverse THROUGH it.)
//
// Neighbor model: mirrors bbttcc-territory's convention (6 nearest hexes by
// pixel distance — see advance-turn.tracks.js:117). Phase G can upgrade to
// axial-aware neighbors when reliably present.

(() => {
  const TAG = "[bbttcc/siege-supply-bfs]";
  const MOD_T = "bbttcc-territory";
  const RAD_MAX_NEIGHBORS = 6;

  globalThis.__bbttcc_siege_supply_bfs_loaded_v1 = Date.now();

  function _safeNum(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function _docCenter(doc){
    const x = _safeNum(doc?.x);
    const y = _safeNum(doc?.y);
    const w = _safeNum(doc?.width ?? doc?.shape?.width);
    const h = _safeNum(doc?.height ?? doc?.shape?.height);
    return { x: x + w / 2, y: y + h / 2 };
  }

  /**
   * _collectHexes — scan all scenes for hex-flagged docs.
   * Returns map uuid → { uuid, doc, sceneId, center }
   */
  function _collectHexes(){
    const out = new Map();
    for (const scene of (game.scenes || [])) {
      const colls = [scene.drawings, scene.notes, scene.tokens, scene.tiles];
      for (const coll of colls) {
        if (!coll) continue;
        for (const doc of coll) {
          const f = doc?.flags?.[MOD_T];
          if (!f?.isHex) continue;
          out.set(doc.uuid, {
            uuid: doc.uuid,
            doc,
            sceneId: scene.id,
            center: _docCenter(doc),
            tf: f
          });
        }
      }
    }
    return out;
  }

  /**
   * _buildNeighborMap — for each hex, find the 6 nearest hexes ON THE SAME SCENE
   * by pixel distance. Mirrors bbttcc-territory's neighborsOfDraw convention.
   */
  function _buildNeighborMap(hexes){
    const map = new Map();
    const bySceneAll = new Map();
    for (const h of hexes.values()) {
      if (!bySceneAll.has(h.sceneId)) bySceneAll.set(h.sceneId, []);
      bySceneAll.get(h.sceneId).push(h);
    }
    for (const h of hexes.values()) {
      const sceneList = bySceneAll.get(h.sceneId) || [];
      const ranked = sceneList
        .filter(o => o.uuid !== h.uuid)
        .map(o => ({ uuid: o.uuid, dist: Math.hypot(o.center.x - h.center.x, o.center.y - h.center.y) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, RAD_MAX_NEIGHBORS)
        .map(o => o.uuid);
      map.set(h.uuid, ranked);
    }
    return map;
  }

  function _hexOwner(tf){
    const candidates = [tf?.factionId, tf?.ownerFactionId, tf?.controllerFactionId, tf?.faction];
    for (const c of candidates) {
      if (typeof c === "string" && c.length > 0) return c;
    }
    return null;
  }

  function _hexTerrainKey(tf){
    if (typeof tf?.terrain === "string") return tf.terrain.toLowerCase();
    if (tf?.terrain?.key) return String(tf.terrain.key).toLowerCase();
    if (tf?.terrainKey) return String(tf.terrainKey).toLowerCase();
    if (tf?.terrainType) return String(tf.terrainType).toLowerCase();
    return "plains";
  }

  function _hasMod(tf, name){
    const mods = Array.isArray(tf?.modifiers) ? tf.modifiers : [];
    return mods.includes(name);
  }

  function _isSeaHex(tf){
    const t = _hexTerrainKey(tf);
    return t === "sea";
  }

  /**
   * Real BFS implementation.
   * Walks from depot through Supply-Line-modifier hexes owned by allowed factions
   * until it finds a hex adjacent to the siege target.
   *
   * @param siegeTargetHexUuid  destination (enemy hex)
   * @param depotHexUuid        origin (attacker's qualified depot)
   * @param allowedFactionIds   factions whose hexes can host Supply Line traversal
   * @param navalAllowed        if true, sea hexes are traversable (Beached Camp / isNavalSupply)
   *
   * Returns: { ok, path: [uuid...], length, reason, hops }
   */
  async function realBfsSupplyPath({ siegeTargetHexUuid, depotHexUuid, allowedFactionIds = [], navalAllowed = false }){
    if (!siegeTargetHexUuid || !depotHexUuid) {
      return { ok: false, path: [], length: 0, reason: "missing endpoints" };
    }

    const hexes = _collectHexes();
    const target = hexes.get(siegeTargetHexUuid);
    const depot = hexes.get(depotHexUuid);

    if (!target) return { ok: false, path: [], length: 0, reason: "target hex not found in scenes" };
    if (!depot)  return { ok: false, path: [], length: 0, reason: "depot hex not found in scenes" };

    if (depot.sceneId !== target.sceneId) {
      return { ok: false, path: [], length: 0, reason: "depot and target are on different scenes" };
    }

    const neighbors = _buildNeighborMap(hexes);
    const targetNeighborSet = new Set(neighbors.get(siegeTargetHexUuid) || []);

    // Trivial case: depot IS adjacent to (or IS) the target.
    if (siegeTargetHexUuid === depotHexUuid || targetNeighborSet.has(depotHexUuid)) {
      return { ok: true, path: [depotHexUuid], length: 0, hops: 0, reason: "depot adjacent to target" };
    }

    const allowed = new Set(allowedFactionIds.filter(Boolean));

    function canTraverse(uuid){
      if (uuid === siegeTargetHexUuid) return false;  // never traverse THROUGH target
      const h = hexes.get(uuid);
      if (!h) return false;
      const tf = h.tf;
      const owner = _hexOwner(tf);
      if (!allowed.has(owner)) return false;
      // Sea hex restriction
      if (_isSeaHex(tf) && !navalAllowed) return false;
      // Must have Supply Line modifier
      // Exception: depot itself doesn't need it (it's the origin)
      if (uuid === depotHexUuid) return true;
      return _hasMod(tf, "Supply Line");
    }

    // BFS
    const queue = [depotHexUuid];
    const prev = new Map();
    prev.set(depotHexUuid, null);

    let found = null;

    while (queue.length) {
      const cur = queue.shift();
      // Termination: cur is a neighbor of target
      if (cur !== depotHexUuid && targetNeighborSet.has(cur)) {
        found = cur;
        break;
      }
      // Also accept if depot itself is in target's neighbor set (handled above).

      const ns = neighbors.get(cur) || [];
      for (const n of ns) {
        if (prev.has(n)) continue;
        if (!canTraverse(n)) {
          // We can still SEE that n is a target neighbor — but only if traversable.
          // Skip non-traversable.
          continue;
        }
        prev.set(n, cur);
        // Check immediately if this candidate is in target's neighbor set
        if (targetNeighborSet.has(n)) {
          found = n;
          break;
        }
        queue.push(n);
      }
      if (found) break;
    }

    if (!found) {
      return { ok: false, path: [], length: 0, reason: "no supply chain reaches the target" };
    }

    // Reconstruct path
    const path = [];
    for (let cur = found; cur !== null; cur = prev.get(cur)) {
      path.unshift(cur);
      if (cur === depotHexUuid) break;
    }

    return {
      ok: true,
      path,
      length: path.length - 1,
      hops: path.length - 1,
      reason: `supply chain of ${path.length - 1} hop(s)`
    };
  }

  function _install(){
    const S = globalThis.__bbttccSiegeState;
    if (!S) {
      // siege-state.js hasn't loaded yet; retry.
      setTimeout(_install, 250);
      return;
    }
    // Replace the Phase A stub on both the internals object and the public API
    S.bfsSupplyPath = realBfsSupplyPath;
    if (game?.bbttcc?.api?.siege) {
      game.bbttcc.api.siege.bfsSupplyPath = realBfsSupplyPath;
    }
    // Provide raw access for testing
    S.bfsSupplyPath_v1 = realBfsSupplyPath;
    console.log(TAG, "real BFS installed; replaces Phase A stub on __bbttccSiegeState + game.bbttcc.api.siege");
  }

  Hooks.once("init", _install);
  Hooks.once("ready", _install);
  if (game?.ready) _install();

  console.log(TAG, "loaded");
})();
