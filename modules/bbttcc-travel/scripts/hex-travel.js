// PATCHMARK: v13-roll-asyncopt-removed-and-tintguard-20251215-035023
// PATCH: units-first travel distance fields (distanceUnits + derived distanceMiles from Foundry grid) — 20251218
/* Bad Eden – Hex Travel Visual Engine (v1.1+parity)
 * Foundry v13 compatible
 *
 * Restores parity with the “5:11 PM” known-good behavior:
 *  - Travel Console passes UUIDs → resolve hex refs robustly
 *  - Terrain lookup works with both camelCase and normalized keys
 *  - OP preview remains intact (TERRAIN_TABLE exported unchanged)
 *  - OP spend uses OP engine (game.bbttcc.api.op.*) with legacy fallback
 *  - Roll evaluation uses async evaluate() (v13)
 *  - Return shape includes ok/summary/cost/encounter for console + whispers
 */

(() => {
  const MOD_FCT = "bbttcc-factions";
  const MOD_TERR = "bbttcc-territory";
  const SCOPE_TRV = "bbttcc-travel";

  // --- Config ----------------------------------------------------------------
  // Costs are MARKS (1 OP = 10 marks). Per-step terrain cost = N OP × 10.
const TERRAIN_TABLE = {
    "plains":        { cost: { economy:10 }, tier:1, bias:"balanced" },
    "grasslands":    { cost: { economy:10 }, tier:1, bias:"balanced" },
    "forest":        { cost: { economy:10, intrigue:10 }, tier:2, bias:"hazard" },
    "jungle":        { cost: { economy:10, intrigue:10 }, tier:2, bias:"hazard" },
    "mountains":     { cost: { economy:20, logistics:10 }, tier:3, bias:"hazard" },
    "highlands":     { cost: { economy:20, logistics:10 }, tier:3, bias:"hazard" },
    "canyons":       { cost: { economy:10, violence:10 }, tier:2, bias:"combat" },
    "badlands":      { cost: { economy:10, violence:10 }, tier:2, bias:"combat" },
    "swamp":         { cost: { economy:20, nonLethal:10 }, tier:3, bias:"hazard" },
    "mire":          { cost: { economy:20, nonLethal:10 }, tier:3, bias:"hazard" },
    "desert":        { cost: { economy:20 }, tier:2, bias:"discovery" },
    "ashWastes":     { cost: { economy:20 }, tier:2, bias:"discovery" },
    "river":         { cost: { economy:10, logistics:10 }, tier:1, bias:"discovery", medium:"water", depthBand:"surface" },
    "lake":          { cost: { economy:10, logistics:10 }, tier:1, bias:"discovery", medium:"water", depthBand:"surface" },
    "sea":           { cost: { economy:30, logistics:20 }, tier:4, bias:"discovery", medium:"water", depthBand:"surface" },
    "ocean":         { cost: { economy:30, logistics:20 }, tier:4, bias:"discovery", medium:"water", depthBand:"surface" },
    // Underwater dive bands — reached by Diving from a surface-water hex (see
    // game.bbttcc.api.travel.dive). Each band requires a water-sub (submersible)
    // rig; depth governs Crushing pressure in underwater combat (FT.SUBMERSION_BITE).
    "reef":          { cost: { economy:20, logistics:10 }, tier:2, bias:"discovery", medium:"water", depthBand:"reef" },
    "depths":        { cost: { economy:30, logistics:20 }, tier:3, bias:"hazard",    medium:"water", depthBand:"deep" },
    "abyss":         { cost: { economy:40, logistics:20 }, tier:4, bias:"extreme",   medium:"water", depthBand:"abyss" },
    // Aerial bands — reached by Ascending from a hex (see game.bbttcc.api.travel
    // .ascend). Sky/stratosphere need an air rig (flyer); orbit needs a space rig.
    "sky":           { cost: { economy:10, logistics:10 }, tier:2, bias:"discovery", medium:"air",   altBand:"sky" },
    "stratosphere":  { cost: { economy:20, logistics:20 }, tier:3, bias:"hazard",    medium:"air",   altBand:"stratosphere" },
    "orbit":         { cost: { economy:40, logistics:30 }, tier:4, bias:"extreme",   medium:"space", altBand:"orbit" },
    "ruins":         { cost: { economy:10, intrigue:10 }, tier:2, bias:"mix" },
    "urbanWreckage": { cost: { economy:10, intrigue:10 }, tier:2, bias:"mix" },
    "wasteland":     { cost: { economy:10, faith:10 }, tier:4, bias:"extreme" },
    "radiation":     { cost: { economy:10, faith:10 }, tier:4, bias:"extreme" }
  };

  // Visual toggles
  const VISUALS = {
    trail: true,
    popups: true,
    dicePulse: true,
    encounterMarker: true,
    trailFadeMs: 5000,
    popupMs: 2500,
    pulseMs: 900
  };

  const TAG = "[bbttcc-travel/hex-travel]";
// --- Compatibility shim: prevent Token tint null crash (v13/v14 / dnd5e) ---
//
// Foundry's Token._refreshState writes to this.mesh.tint. During multi-leg
// travel animation — and briefly at canvas redraw between legs — the PIXI
// mesh can be null even though the placeable still exists. The original
// shim caught the crash AFTER orig.apply threw, which quiets the console
// warn but doesn't stop Foundry's ticker from re-invoking _refreshState
// every animation frame (the 99-deep rAF stack we saw in logs). Root cause
// remains the null mesh, so we now short-circuit BEFORE calling orig when
// mesh is missing — the call becomes a cheap no-op and the next frame's
// refresh either finds the mesh (token ready) or no-ops again. Outer
// try/catch stays as a backstop for any other tint-related tantrums.
(() => {
  try {
    const TokenCls = CONFIG?.Token?.objectClass;
    if (!TokenCls?.prototype) return;
    if (TokenCls.prototype.__bbttccTintGuardInstalled) return;
    TokenCls.prototype.__bbttccTintGuardInstalled = true;

    const orig = TokenCls.prototype._refreshState;
    if (typeof orig !== "function") return;

    let warnedCrash = false;
    TokenCls.prototype._refreshState = function(...args) {
      // Pre-flight: if the mesh is gone, orig.apply WILL throw (and kick off
      // the rAF retry storm). Skip silently — Foundry will call us again
      // once the mesh is ready.
      if (!this.mesh) return;
      try {
        return orig.apply(this, args);
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes("setting 'tint'") || msg.includes("setting properties of null")) {
          if (!warnedCrash) {
            warnedCrash = true;
            console.warn(TAG, "Suppressed Token tint crash (compat shim).", e);
          }
          return;
        }
        throw e;
      }
    };
    console.log(TAG, "Tint crash guard installed.");
  } catch (e) {
    console.warn(TAG, "Tint crash guard install failed:", e);
  }
})();
  console.log(TAG, "Loaded patched hex-travel.js (UUID + terrain + OP + v13 parity)");

  // --- Utility ---------------------------------------------------------------

  function isFactionActor(actor) {
    return !!actor?.getFlag(MOD_FCT, "isFaction");
  }

  function getFactionAPI() {
    return game?.bbttcc?.api?.factions || game.modules.get("bbttcc-raid")?.api?.factions;
  }

  function getRaidAPI() {
    return game?.bbttcc?.api?.raid || game.modules.get("bbttcc-raid")?.api?.raid;
  }

  function getFactionColor(actor) {
    return actor?.getFlag(MOD_FCT, "color") || "#33AAFF";
  }

  function normalizeTerrainKey(t) {
    return String(t || "").replace(/\s+/g, "").replace(/[^\w]/g, "").toLowerCase();
  }

  // Highest authored tier for a terrain in the Campaign Builder's travel tables.
  // Why: the hardcoded TERRAIN_TABLE pegs each terrain to a fixed tier (e.g. swamp=3),
  // which forces DC/OP-cost ladder + encounter label to that tier even when the GM has
  // only authored lower-tier tables. Treat the campaign-tables ladder as authoritative
  // when present; fall back to the hardcoded tier when the GM hasn't authored anything.
  function _resolveTerrainTierFromCampaign(terrainKey, fallbackTier) {
    try {
      const tables = game.settings?.get?.("bbttcc-campaign", "encounterTables") || {};
      const norm = normalizeTerrainKey(terrainKey);
      if (!norm) return Number(fallbackTier || 1);
      const re = new RegExp(`^travel_${norm}_t(?:ier)?(\\d+)$`, "i");
      let max = 0;
      for (const id of Object.keys(tables)) {
        const m = String(id).match(re);
        if (!m) continue;
        const n = Number(m[1] || 0);
        if (Number.isFinite(n) && n > max) max = n;
      }
      return max > 0 ? max : Number(fallbackTier || 1);
    } catch (_e) {
      return Number(fallbackTier || 1);
    }
  }

  // Build a normalized lookup table from TERRAIN_TABLE without changing the exported keys.
  const TERRAIN_NORM = (() => {
    const map = {};
    for (const [k, spec] of Object.entries(TERRAIN_TABLE)) {
      map[normalizeTerrainKey(k)] = spec;
    }
    // Common aliases (worlds store either singular/plural or casing variants)
    const alias = {
      canyon: "canyons",
      badland: "badlands",
      marsh: "swamp",
      ashwastes: "ashWastes",
      urbanwreckage: "urbanWreckage"
    };
    for (const [a, b] of Object.entries(alias)) {
      const bn = normalizeTerrainKey(b);
      if (map[bn] && !map[normalizeTerrainKey(a)]) {
        map[normalizeTerrainKey(a)] = map[bn];
      }
    }
    return map;
  })();

  // ───────────────────────────────────────────────────────────────────────────
  // MOVEMENT DOMAINS — terrain↔rig medium gating (water vertical, 2026-06-23)
  // ───────────────────────────────────────────────────────────────────────────
  // A rig declares system.travel.domains (array of FT.MOVEMENT_DOMAINS keys).
  // To traverse a hex whose terrain medium ≠ land, the travelling faction must
  // own a rig whose domains cover that medium (on-foot parties always have land).
  // Surface water needs water-surface OR water-sub (a sub can run on the surface);
  // a depth band (reef/deep/abyss) needs water-sub specifically. Air → air|space;
  // space → space. Default (no medium on a terrain) = land.
  const RIG_TYPE = "rig";
  const RIG_FLAG = "bbttcc-factions";

  // The medium a terrain spec belongs to. Falls back to "land".
  function terrainMedium(spec) {
    const m = String(spec?.medium || "").toLowerCase();
    return m || "land";
  }

  // Which domain keys satisfy a terrain spec. Returns null for plain land
  // (no gate). For water, surface accepts surface OR sub; depth requires sub.
  function requiredDomainsForTerrain(spec) {
    const medium = terrainMedium(spec);
    // Land is unrestricted (everyone has "land"); a flyer/orbital also passes.
    if (medium === "land") return null;
    if (medium === "water") {
      const band = String(spec?.depthBand || "surface").toLowerCase();
      // Surface water: a boat, a sub, OR anything that flies over it (air/space).
      // Underwater bands (reef/deep/abyss): only a submersible can go down.
      return (band === "surface")
        ? ["water-surface", "water-sub", "air", "space"]
        : ["water-sub"];
    }
    // Air (sky/stratosphere): a flyer or an orbital craft.
    if (medium === "air")   return ["air", "space"];
    // Space (orbit): orbital only.
    if (medium === "space") return ["space"];
    return null;
  }

  // Domains a single rig provides (defaults to land if unset/legacy).
  function rigDomains(rig) {
    const sys = rig?.system?.system ?? rig?.system ?? {};
    const raw = sys?.travel?.domains;
    const list = Array.isArray(raw) ? raw.map(d => String(d).toLowerCase()).filter(Boolean) : [];
    return list.length ? list : ["land"];
  }

  // Rigs a faction can travel with: type:"rig", mobile/hybrid (a stationary
  // emplacement can't ferry the party), linked to the faction via either the
  // identity.factionOwnerId field or the bbttcc-factions.factionId flag.
  function factionRigs(factionId) {
    const fid = String(factionId || "");
    if (!fid) return [];
    return Array.from(game.actors ?? []).filter(a => {
      if (a?.type !== RIG_TYPE) return false;
      const sys = a?.system?.system ?? a?.system ?? {};
      const mobility = String(sys?.identity?.mobility || "mobile").toLowerCase();
      if (mobility === "stationary") return false;
      const ownerA = String(sys?.identity?.factionOwnerId || "");
      const ownerB = String(a?.flags?.[RIG_FLAG]?.factionId || "");
      return ownerA === fid || ownerB === fid;
    });
  }

  // The union of domains a faction can field: always "land" (on-foot members)
  // plus every domain across its mobile/hybrid rigs.
  function factionTravelDomains(factionId) {
    const set = new Set(["land"]);
    for (const rig of factionRigs(factionId)) for (const d of rigDomains(rig)) set.add(d);
    return set;
  }

  // The gate check: can this faction enter a hex of this terrain spec?
  // Returns { ok, medium, required, have, rigs } — ok:true when unrestricted
  // (land) or the faction has at least one satisfying domain.
  function canFactionEnterTerrain(factionId, spec) {
    const required = requiredDomainsForTerrain(spec);
    const have = factionTravelDomains(factionId);
    if (!required) return { ok: true, medium: terrainMedium(spec), required: null, have: [...have] };
    const ok = required.some(d => have.has(d));
    return {
      ok,
      medium: terrainMedium(spec),
      depthBand: String(spec?.depthBand || "surface"),
      required,
      have: [...have],
      rigs: ok ? factionRigs(factionId).filter(r => rigDomains(r).some(d => required.includes(d))).map(r => r.name) : []
    };
  }

  // ── Diving (P2): surface-water hex → underwater scene via transition.dive ──
  // A surface-water hex Drawing carries flags["bbttcc-travel"].diveScene (target
  // scene uuid) + .diveBand (reef/deep/abyss). The underwater scene carries a
  // returnLink (⬅ Surface) + flags.fourththing.underwater = { band }. Diving is
  // gated on the faction owning a submersible (water-sub) RATED for the band's
  // depth. Setup via tools/setup-underwater-dive.macro.js.
  const DEPTH_BAND_INDEX = { surface: 0, reef: 1, deep: 2, depths: 2, abyss: 3 };

  // Deepest band the faction's submersibles can safely reach (-1 = owns no sub).
  function factionSubDepth(factionId) {
    let best = -1;
    for (const rig of factionRigs(factionId)) {
      if (!rigDomains(rig).includes("water-sub")) continue;
      const sys = rig?.system?.system ?? rig?.system ?? {};
      best = Math.max(best, Number(sys?.travel?.depthRating ?? 0) || 0);
    }
    return best;
  }

  // Per-hex band→sceneUuid map (set via the Hex Config "Depth Links" section).
  // Falls back to the legacy single diveScene/diveBand pair.
  function hexDiveScenes(hexDoc) {
    const f = hexDoc?.flags?.[SCOPE_TRV] || hexDoc?.document?.flags?.[SCOPE_TRV] || {};
    const map = (f.diveScenes && typeof f.diveScenes === "object") ? { ...f.diveScenes } : {};
    if (f.diveScene) { const b = String(f.diveBand || "reef").toLowerCase(); if (!map[b]) map[b] = f.diveScene; }
    // Keep only entries with a real value, lowercase the band keys.
    const out = {};
    for (const [b, v] of Object.entries(map)) if (v) out[String(b).toLowerCase()] = v;
    return out;
  }

  async function diveFromHex(factionId, hexUuid, opts = {}) {
    const transition = game.bbttcc?.api?.transition;
    if (!transition?.dive) return { ok: false, reason: "no-transition-api", message: "Scene transition primitive not loaded." };
    let hexDoc = null;
    try { hexDoc = await fromUuid(hexUuid); } catch (_e) {}
    const map = hexDiveScenes(hexDoc);
    const linked = Object.keys(map);
    if (!linked.length) return { ok: false, reason: "no-dive-link", message: "This hex has no depth links — open its Hex Config → Depth Links and assign a scene." };

    const subDepth = factionSubDepth(factionId);
    if (subDepth < 0) { const m = "No submersible — diving needs a rig with the Water (Submerged) domain."; ui.notifications?.warn?.(m); return { ok: false, reason: "no-sub", message: m }; }

    // Bands the sub can reach (depthRating ≥ band index), deepest first.
    const reachable = linked.filter(b => (DEPTH_BAND_INDEX[b] ?? 1) <= subDepth)
                            .sort((a, b) => (DEPTH_BAND_INDEX[b] ?? 1) - (DEPTH_BAND_INDEX[a] ?? 1));
    if (!reachable.length) {
      const shallowest = Math.min(...linked.map(b => DEPTH_BAND_INDEX[b] ?? 1));
      const m = `Your submersible (depth ${subDepth}) can't reach this hex's depths (shallowest link needs ${shallowest}).`;
      ui.notifications?.warn?.(m); return { ok: false, reason: "too-shallow", message: m };
    }

    // Pick the requested band if it's linked + reachable, else the deepest reachable.
    let band = String(opts.band || "").toLowerCase();
    if (!band || !reachable.includes(band)) band = reachable[0];
    const sceneUuid = map[band];
    await transition.dive(sceneUuid, { hexUuid, label: `Dive — ${band}`, flashColor: "#1f8fdd", audience: opts.audience || "view", focus: opts.focus, ...opts });
    return { ok: true, band, sceneUuid };
  }

  // Ascend ONE band toward the surface/ground (reef/deep/abyss · sky/strat/orbit).
  // From a depth/altitude scene, step to the next-shallower linked band of the
  // same originating hex; only when there's no shallower band linked does it
  // return all the way to the surface/ground scene. Used by both water (Surface)
  // and air (Descend) — symmetric "one level up toward the origin".
  async function surfaceFromScene(opts = {}) {
    const transition = game.bbttcc?.api?.transition;
    if (!transition?.back) return { ok: false, reason: "no-transition-api" };
    const sc = canvas?.scene || game.scenes?.active || null;
    const f = sc?.flags?.[SCOPE_TRV] || {};
    const uw = sc?.flags?.fourththing?.underwater;
    const al = sc?.flags?.fourththing?.aloft;
    const env = uw ? "underwater" : (al ? "aloft" : null);
    const band = (uw || al)?.band ? String((uw || al).band).toLowerCase() : null;
    const origin = f.diveOrigin;
    const water = env !== "aloft";
    const flashColor = water ? "#1f8fdd" : "#7cc6ff";

    // Stepwise: is there a shallower band of this hex linked? If so, go there.
    if (env && band && origin?.hexUuid) {
      const idx = water ? DEPTH_BAND_INDEX : ALT_BAND_INDEX;
      let hex = null; try { hex = await fromUuid(origin.hexUuid); } catch (_e) {}
      const map = hex ? (water ? hexDiveScenes(hex) : hexSkyScenes(hex)) : {};
      const cur = idx[band] ?? 1;
      const lower = Object.keys(map)
        .filter(b => (idx[b] ?? 1) < cur)
        .sort((a, b) => (idx[b] ?? 1) - (idx[a] ?? 1)); // closest band below first
      if (lower.length) {
        const nextBand = lower[0];
        await transition.back(map[nextBand], { label: nextBand, flashColor, ...opts });
        return { ok: true, band: nextBand, stepped: true };
      }
    }

    // No shallower band — surface/descend all the way to the recorded origin.
    const target = origin?.surfaceSceneUuid || f.returnLink?.targetSceneUuid;
    if (!target) { const m = "This scene has no ground/surface to return to."; ui.notifications?.warn?.(m); return { ok: false, reason: "no-return-link", message: m }; }
    await transition.back(target, { label: f.returnLink?.label || (water ? "Surface" : "Descend"), flashColor, ...opts });
    return { ok: true, surfaced: true };
  }

  // ── Ascending (air vertical): hex → aerial scene via transition.dive ────────
  // Mirrors diving. A hex Drawing carries flags["bbttcc-travel"].skyScenes
  // (band → scene uuid; sky/stratosphere/orbit). The aerial scene carries a
  // returnLink (⬅ Descend) + flags.fourththing.aloft = { band }. Gated on the
  // faction owning a flyer (air) — or an orbital craft (space) for the orbit band.
  const ALT_BAND_INDEX = { sky: 1, stratosphere: 2, orbit: 3 };

  // Highest altitude band a faction can reach: space → orbit(3), air → strat(2).
  function factionAirReach(factionId) {
    const have = factionTravelDomains(factionId);
    if (have.has("space")) return 3;
    if (have.has("air")) return 2;
    return 0;
  }

  function hexSkyScenes(hexDoc) {
    const f = hexDoc?.flags?.[SCOPE_TRV] || hexDoc?.document?.flags?.[SCOPE_TRV] || {};
    const map = (f.skyScenes && typeof f.skyScenes === "object") ? { ...f.skyScenes } : {};
    const out = {};
    for (const [b, v] of Object.entries(map)) if (v) out[String(b).toLowerCase()] = v;
    return out;
  }

  async function ascendFromHex(factionId, hexUuid, opts = {}) {
    const transition = game.bbttcc?.api?.transition;
    if (!transition?.dive) return { ok: false, reason: "no-transition-api", message: "Scene transition primitive not loaded." };
    let hexDoc = null;
    try { hexDoc = await fromUuid(hexUuid); } catch (_e) {}
    const map = hexSkyScenes(hexDoc);
    const linked = Object.keys(map);
    if (!linked.length) return { ok: false, reason: "no-sky-link", message: "This hex has no altitude links — open its Hex Config → Altitude Links and assign a scene." };

    const reach = factionAirReach(factionId);
    if (reach <= 0) { const m = "No flyer — ascending needs a rig with the Air domain (orbit needs Space)."; ui.notifications?.warn?.(m); return { ok: false, reason: "no-flyer", message: m }; }

    const reachable = linked.filter(b => (ALT_BAND_INDEX[b] ?? 1) <= reach)
                            .sort((a, b) => (ALT_BAND_INDEX[b] ?? 1) - (ALT_BAND_INDEX[a] ?? 1));
    if (!reachable.length) {
      const m = "Your craft can't reach this hex's altitude — orbit needs a Space-domain rig.";
      ui.notifications?.warn?.(m); return { ok: false, reason: "too-high", message: m };
    }

    let band = String(opts.band || "").toLowerCase();
    if (!band || !reachable.includes(band)) band = reachable[0];
    const sceneUuid = map[band];
    await transition.dive(sceneUuid, { hexUuid, label: `Ascend — ${band}`, flashColor: "#7cc6ff", audience: opts.audience || "view", focus: opts.focus, ...opts });
    return { ok: true, band, sceneUuid };
  }

  function getHexAtPoint(x, y) {
    const dwgs = canvas.drawings.placeables;
    for (const d of dwgs) {
      const f = d.document?.flags?.[MOD_TERR];   // getFlag(scope) w/o key returns undefined — read flags directly
      if (!f) continue;
      const pt = new PIXI.Point(x, y);
      if (d.bounds?.contains(x, y) || d.containsPoint?.(pt)) return d;
    }
    return null;
  }

  async function resolveDrawingRef(ref) {
    // Accept: drawing id, UUID (Scene.<sid>.Drawing.<did>), DrawingDocument, placeable, or {id|uuid}
    if (!ref) return null;

    // Placeable Drawing
    if (ref?.document && ref?.center) return ref;

    // DrawingDocument -> placeable
    if (ref?.documentName === "Drawing") {
      const id = ref.id ?? ref._id;
      return canvas?.drawings?.get(id) || ref.object || null;
    }

    // Wrapper object
    if (typeof ref === "object") {
      if (ref.uuid) ref = ref.uuid;
      else if (ref.id) ref = ref.id;
      else return null;
    }

    if (typeof ref !== "string") return null;
    const s = ref.trim();
    if (!s) return null;

    // UUID fast-path
    const idx = s.lastIndexOf(".Drawing.");
    if (idx !== -1) {
      const did = s.slice(idx + ".Drawing.".length);
      return canvas?.drawings?.get(did) || null;
    }

    // Plain drawing id
    return canvas?.drawings?.get(s) || null;
  }

  function getHexTerrainSpec(drawing) {
    // getFlag(scope) with no key returns undefined (getProperty guard) → every hex
    // read as plains. Read flags directly; handle placeable OR document input.
    const flags = drawing?.document?.flags?.[MOD_TERR] || drawing?.flags?.[MOD_TERR] || {};

    // Terrain may be stored as:
    // - terrainType: "plains" OR a human label like "Mountains / Highlands"
    // - terrain: "plains"
    // - terrain: { key:"mountains", label:"Mountains / Highlands" }
    const rawVal =
      (flags?.terrain && typeof flags.terrain === "object" ? (flags.terrain.key || flags.terrain.label) : null) ||
      flags.terrainKey ||
      flags.terrainType ||
      flags.terrain ||
      "";

    const raw = String(rawVal || "").trim();
    const low = raw.toLowerCase();

    // Heuristic mapping (matches Travel Console behavior)
    const mapped =
      (low.includes("mountain") || low.includes("highland")) ? "mountains" :
      (low.includes("canyon") || low.includes("badland")) ? "canyons" :
      (low.includes("swamp") || low.includes("mire") || low.includes("marsh")) ? "swamp" :
      (low.includes("forest") || low.includes("jungle")) ? "forest" :
      (low.includes("desert") || low.includes("ash")) ? "desert" :
      (low.includes("river") || low.includes("lake")) ? "river" :
      (low.includes("sea") || low.includes("ocean")) ? "ocean" :
      (low.includes("ruin") || low.includes("urban")) ? "ruins" :
      (low.includes("wasteland") || low.includes("radiation")) ? "wasteland" :
      (low.includes("plain") || low.includes("grass")) ? "plains" :
      raw;

    const keyNorm = normalizeTerrainKey(mapped);
    const spec =
      (mapped && TERRAIN_TABLE[mapped]) ||
      (raw && TERRAIN_TABLE[raw]) ||
      TERRAIN_NORM[keyNorm] ||
      null;

    return { raw: mapped, key: keyNorm, spec, flags };
  }



  function clone(o) { return foundry.utils.duplicate(o || {}); }

  function normalizeCostKeys(cost) {
  const out = {};
  for (const [k, v] of Object.entries(cost || {})) {
    const kk = String(k || "").toLowerCase();
    out[kk] = Number(v || 0);
  }
  return out;
}

  async function spendOP({ factionId, cost, reason = "travel" }) {
    const actor = game.actors.get(factionId);
    if (!actor) throw new Error("spendOP: faction actor not found");

    const op = game?.bbttcc?.api?.op;
    if (!op || typeof op.commit !== "function") {
      throw new Error("Faction OP spend not available (op engine commit missing).");
    }

    // Canonical signature: op.commit(factionId, deltas, reason)
    // Convert positive cost into negative deltas.
    const deltas = {};
    for (const [k, v] of Object.entries(cost || {})) {
      const kk = String(k || "").toLowerCase();
      const n = Number(v || 0);
      if (!Number.isFinite(n) || n <= 0) continue;
      deltas[kk] = -Math.abs(Math.round(n));
    }

    if (!Object.keys(deltas).length) {
      return { ok: true, via: "none", deltas };
    }

    const res = await op.commit(factionId, deltas, reason);
    console.log(TAG, "OP spend committed via op.commit(factionId,deltas,reason)", { factionId, deltas, reason, res });
    return { ok: true, via: "op.commit", deltas, res };
  }

  function getFactionIntrigueMod(actor) {
    try {
      const fx = actor?.flags?.[MOD_FCT] || {};   // getFlag(scope) w/o key returns undefined — read flags directly
      return Number(
        foundry.utils.getProperty(fx, "skills.intrigue.mod") ??
        foundry.utils.getProperty(fx, "mods.intrigue") ??
        0
      );
    } catch (_e) { return 0; }
  }

  // Darkness can increase travel DCs / encounter pressure.
  // Safe fallback: uses faction flags.bbttcc-factions.darkness.{global|<hexId>} if present.
  function darknessEncounterBoost(actor, toDrawing) {
    try {
      const fx = actor?.flags?.[MOD_FCT] || {};   // getFlag(scope) w/o key returns undefined — read flags directly
      const d = fx?.darkness || {};
      const hexId = toDrawing?.id || toDrawing?.document?.id || null;
      const regional = (hexId && (d[hexId] != null)) ? Number(d[hexId] || 0) : 0;
      const global = Number(d.global || 0);
      const maxD = Math.max(regional, global);
      // Match established behavior elsewhere: high darkness bumps difficulty modestly.
      return (Number.isFinite(maxD) && maxD >= 7) ? 2 : 0;
    } catch (_e) {
      return 0;
    }
  }

  // --- Encounter-chance dial (GM world settings) -----------------------------
  // The travel check succeeds when roll >= DC; an encounter fires on failure, so
  // a HIGHER DC means encounters are MORE frequent. These two settings let the GM
  // tune the master frequency without code edits. Defaults (15 / 2) reproduce the
  // historical hardcoded behavior exactly.
  const ENC_DIAL_NS = "bbttcc-core"; // always-registered module, avoids unregistered-key crashes
  const ENC_BASE_DC_KEY = "travelEncounterBaseDC";
  const ENC_TIER_STEP_KEY = "travelEncounterTierStep";
  const DOMAIN_GATE_KEY = "travelDomainGate";

  function _ensureEncounterDialSettings() {
    try {
      if (!game.settings?.settings?.has(`${ENC_DIAL_NS}.${ENC_BASE_DC_KEY}`)) {
        game.settings.register(ENC_DIAL_NS, ENC_BASE_DC_KEY, {
          name: "Travel: Encounter Base DC",
          hint: "Base difficulty of every travel check (2d10 + Intrigue + scout). The party must roll >= this to pass; failure triggers an encounter. HIGHER = more encounters. Default 12 (retuned 2026-08-22 for the 2d10 regime — a world that stored the old d20-era 15 should be set back to 12).",
          scope: "world", config: true, type: Number, default: 12
        });
      }
      if (!game.settings?.settings?.has(`${ENC_DIAL_NS}.${ENC_TIER_STEP_KEY}`)) {
        game.settings.register(ENC_DIAL_NS, ENC_TIER_STEP_KEY, {
          name: "Travel: Encounter DC per Tier",
          hint: "Extra DC added per terrain danger tier (1-4). HIGHER = dangerous terrain ramps encounter chance faster. Default 2.",
          scope: "world", config: true, type: Number, default: 2
        });
      }
      if (!game.settings?.settings?.has(`${ENC_DIAL_NS}.${DOMAIN_GATE_KEY}`)) {
        game.settings.register(ENC_DIAL_NS, DOMAIN_GATE_KEY, {
          name: "Travel: Enforce Movement Domains",
          hint: "When ON, a faction can only enter water/air/space hexes if it owns a rig that handles that medium (a boat, a sub, a flyer). When OFF, any faction can travel anywhere. Default ON.",
          scope: "world", config: true, type: Boolean, default: true
        });
      }
    } catch (e) {
      console.warn(TAG, "Encounter dial settings registration failed (non-blocking):", e);
    }
  }

  function _encounterDc(tier, dcMod, darknessBump) {
    _ensureEncounterDialSettings();
    let base = 15, step = 2;
    try { base = Number(game.settings.get(ENC_DIAL_NS, ENC_BASE_DC_KEY)); } catch (_e) {}
    try { step = Number(game.settings.get(ENC_DIAL_NS, ENC_TIER_STEP_KEY)); } catch (_e) {}
    if (!Number.isFinite(base)) base = 15;
    if (!Number.isFinite(step)) step = 2;
    return base + ((Number(tier) || 0) * step) + (Number(dcMod) || 0) + (Number(darknessBump) || 0);
  }


  // --- Visuals ---------------------------------------------------------------

  // Transient FX cleanup registry. These effects live on canvas.stage, which is
  // NOT rebuilt on a scene swap — a travel trail / popup / pulse still animating
  // when the scene changes would survive onto the next scene (ghost graphics at
  // old-scene coords). Every effect registers its cleanup here; timers route
  // through it, and canvasTearDown reaps whatever is still alive.
  const _fxCleanups = new Set();
  function _onFxDone(fn) {
    const done = () => { _fxCleanups.delete(done); try { fn(); } catch (_e) {} };
    _fxCleanups.add(done);
    return done;
  }

  function drawTrail(a, b, color = "#33AAFF") {
    if (!VISUALS.trail) return;
    const g = new PIXI.Graphics();
    g.lineStyle(4, PIXI.utils.string2hex(color), 0.9);
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    canvas.stage.addChild(g);
    const done = _onFxDone(() => { if (!g.destroyed) g.destroy(true); });
    setTimeout(done, VISUALS.trailFadeMs);
  }

  function popupText(pos, text) {
    if (!VISUALS.popups) return;
    const style = new PIXI.TextStyle({
      fontFamily: "Helvetica", fontSize: 18, fill: 0xFFFFFF, stroke: 0x000000, strokeThickness: 4
    });
    const t = new PIXI.Text(text, style);
    t.anchor.set(0.5, 1.2);
    t.position.set(pos.x, pos.y);
    canvas.stage.addChild(t);
    const done = _onFxDone(() => { if (!t.destroyed) t.destroy(true); });
    const dy = -40;
    const ms = VISUALS.popupMs;
    const start = Date.now();
    const tick = () => {
      if (t.destroyed) { done(); return; }   // reaped by a scene swap mid-flight
      const p = Math.min(1, (Date.now() - start) / ms);
      t.position.y = pos.y + dy * p;
      t.alpha = 1 - p;
      if (p < 1) requestAnimationFrame(tick); else done();
    };
    tick();
  }

  function pulseToken(token, colorHex = "#00FF66") {
    if (!VISUALS.dicePulse || !token) return;
    const c = PIXI.utils.string2hex(colorHex);
    let state = 0;
    const id = setInterval(() => {
      state++;
      const on = state % 2 === 1;
      try {
        if (token.destroyed) return;         // token died (scene swap) — done() reaps
        token.border = token.border || new PIXI.Graphics();
        token.border.clear();
        token.border.lineStyle(6, c, on ? 0.9 : 0.2);
        const b = token.getBounds();
        token.border.drawRoundedRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8, 8);
        if (!token.border.parent) canvas.stage.addChild(token.border);
      } catch(e) {}
    }, 150);
    const done = _onFxDone(() => {
      clearInterval(id);
      try { if (token.border && !token.border.destroyed) token.border.destroy(true); } catch(e) {}
      token.border = null;
    });
    setTimeout(done, VISUALS.pulseMs);
  }

  let _encounterSymbols = new Map();
  function placeEncounterIcon(hexDrawing, label="Encounter") {
    if (!VISUALS.encounterMarker || !hexDrawing) return;
    const center = hexDrawing.center;
    const style = new PIXI.TextStyle({ fontFamily:"Helvetica", fontSize:22, fill:0xFFD166, stroke:0x000000, strokeThickness:4 });
    const icon = new PIXI.Text("⚔️", style);
    icon.anchor.set(0.5, 0.5);
    icon.position.set(center.x, center.y);
    icon.interactive = true;
    icon.buttonMode = true;
    icon.eventMode = "static";
    icon.cursor = "pointer";
    icon.on("pointerdown", () => ui.notifications?.info?.(`${label}: resolve via your Raid/Scenario UI.`));
    canvas.stage.addChild(icon);
    let grow = true;
    const id = setInterval(() => {
      icon.scale.set(grow ? 1.15 : 1.0);
      grow = !grow;
    }, 400);
    _encounterSymbols.set(hexDrawing.id, { icon, id });
    setTimeout(() => removeEncounterIcon(hexDrawing.id), 15000);
  }
  function removeEncounterIcon(hexId) {
    const rec = _encounterSymbols.get(hexId);
    if (!rec) return;
    clearInterval(rec.id);
    try { if (!rec.icon.destroyed) rec.icon.destroy(true); } catch(e) {}
    _encounterSymbols.delete(hexId);
  }

  // Scene swap: reap every transient effect still animating (they live on the
  // persistent canvas.stage and would ghost onto the next scene otherwise).
  Hooks.on("canvasTearDown", () => {
    for (const done of [..._fxCleanups]) done();
    for (const hexId of [..._encounterSymbols.keys()]) removeEncounterIcon(hexId);
  });

  // --- Core Travel -----------------------------------------------------------

  async function travelHex(opts = {}) {
    const {
      factionId,
      hexFrom,
      hexTo,
      tokenId = null,
      // Optional override from callers (e.g., Travel Console) to keep preview + core in sync
      terrainKey: terrainKeyOverride = null,
      terrain: terrainOverride = null,
      // Per-leg GM nudge to the encounter DC (from Travel Console GM Overrides).
      // Positive = more dangerous (more encounters). Mitigation bridge adds on top.
      dcMod: dcModOverride = 0
    } = opts;
    if (!factionId || !hexFrom || !hexTo) throw new Error("travelHex: missing factionId/hexFrom/hexTo");
    const actor = game.actors.get(factionId);
    if (!isFactionActor(actor)) throw new Error("travelHex: actor is not a faction");

    const from = await resolveDrawingRef(hexFrom);
    const to   = await resolveDrawingRef(hexTo);
    if (!to) throw new Error(`travelHex: destination hex not found (hexTo=${String(hexTo)})`);

    // ----------------------------------------------------------
    // Leyline Gate override (Remote Adjacency) — B.2 Step 2C
    // ----------------------------------------------------------
    let gateOverride = null;

    try {
      const leyApi = game.bbttcc?.api?.territory?.leylines;
      if (leyApi?.resolveRemoteAdjacency) {
        const res = await leyApi.resolveRemoteAdjacency({
          hexUuid: from?.document?.uuid || from?.uuid,
          factionId
        });

        if (res?.ok && Array.isArray(res.links)) {
          const match = res.links.find(l =>
            l.toUuid === (to?.document?.uuid || to?.uuid)
          );
          if (match) {
            gateOverride = {
              strength: Number(match.strength || 0.5),
              kind: "ley-gate"
            };
          }
        }
      }
    } catch (e) {
      console.warn("[bbttcc-travel] gate check failed (non-fatal)", e);
    }


    // Terrain: prefer destination, fallback to source, then plains
    let { spec, key, flags: terrFlags, raw } = getHexTerrainSpec(to);
    
    // If caller provided an explicit terrain override, trust it.
    // This is primarily used by the Travel Console which already normalized terrain keys from hex flags.
    const _ov = String(terrainKeyOverride || terrainOverride || "").trim();
    if (_ov) {
      const low = _ov.toLowerCase();
      const mapped =
        (low.includes("mountain") || low.includes("highland")) ? "mountains" :
        (low.includes("canyon") || low.includes("badland")) ? "canyons" :
        (low.includes("swamp") || low.includes("mire") || low.includes("marsh")) ? "swamp" :
        (low.includes("forest") || low.includes("jungle")) ? "forest" :
        (low.includes("desert") || low.includes("ash")) ? "desert" :
        (low.includes("river") || low.includes("lake")) ? "river" :
        (low.includes("sea") || low.includes("ocean")) ? "ocean" :
        (low.includes("ruin") || low.includes("urban")) ? "ruins" :
        (low.includes("wasteland") || low.includes("radiation")) ? "wasteland" :
        (low.includes("plain") || low.includes("grass")) ? "plains" :
        low;

      const specOv = TERRAIN_TABLE[mapped] || TERRAIN_NORM[normalizeTerrainKey(mapped)] || null;
      if (specOv) {
        spec = specOv;
        key = normalizeTerrainKey(mapped);
        raw = mapped;
      }
    }
if (!spec) {
      const fb = getHexTerrainSpec(from);
      if (fb?.spec) {
        spec = fb.spec; key = fb.key; terrFlags = fb.flags; raw = fb.raw;
      }
    }
    if (!spec) {
      spec = TERRAIN_NORM[normalizeTerrainKey("plains")] || { cost: { economy:10 }, tier:1, bias:"balanced" };  // marks (1 OP); matches TERRAIN_TABLE scale, not OP-scale 1
      key = normalizeTerrainKey("plains");
      terrFlags = terrFlags || {};
      raw = raw || "plains";
    }

const grid = canvas?.scene?.grid || {};
const milesPerHex = Number(grid.distance || 0);
const milesUnits = String(grid.units || "");
const distanceUnits = (() => {
  // Units-first: mechanical movement cost per hex. Default 1.
  const v =
    terrFlags?.travelUnits ??
    terrFlags?.moveUnits ??
    terrFlags?.units ??
    terrFlags?.travel?.units ??
    1;
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
})();
const distanceMiles = milesPerHex ? (distanceUnits * milesPerHex) : null;
    const ctx = {
      factionId, actor, from, to,
      terrainKey: key,
      terrainTier: _resolveTerrainTierFromCampaign(key, spec.tier),
      cost: clone(spec.cost),
      crew: actor.getFlag(MOD_FCT, "crew") || [],
      preventHazard: false,
      dcMod: Number(dcModOverride) || 0,
      token: tokenId ? canvas.tokens.get(tokenId) : null,
      distanceUnits,
      distanceMiles,
      distanceMilesUnits: milesUnits,
      distanceUnitsLabel: "hex-units"
    };

    if (gateOverride) {
      ctx.gate = gateOverride;
    }

    // ──────────────────────────────────────────────────────────────────────
    // MOVEMENT-DOMAIN HARD GATE (water vertical, 2026-06-23)
    // A faction can't drive onto water / into the air / out to orbit without a
    // rig that handles that medium. Bail BEFORE any OP spend or hook. GM can
    // override per-call with opts.bypassDomainGate (Travel Console "force") or
    // disable globally via the world setting.
    // ──────────────────────────────────────────────────────────────────────
    try {
      _ensureEncounterDialSettings();
      let gateOn = true;
      try { gateOn = game.settings.get(ENC_DIAL_NS, DOMAIN_GATE_KEY) !== false; } catch (_e) {}
      if (gateOn && opts.bypassDomainGate !== true) {
        const gate = canFactionEnterTerrain(factionId, spec);
        if (!gate.ok) {
          const domLabel = (k) => game.fourththing?.constants?.MOVEMENT_DOMAINS?.[k]?.label || k;
          const need = gate.required.map(domLabel).join(" or ");
          const mediumWord = gate.medium === "water"
            ? (gate.depthBand === "surface" ? "open water" : `the ${gate.depthBand}`)
            : gate.medium;
          const msg = `${actor.name} can't cross into ${mediumWord} (${key}) — needs a rig with: ${need}. Build or bring one, or have the GM force passage.`;
          ui.notifications?.warn?.(msg);
          console.log(TAG, "Domain gate BLOCKED travel:", { factionId, terrain: key, ...gate });
          return { ok: false, blocked: true, reason: "domain-gate", terrainKey: key, gate, summary: msg };
        }
      }
    } catch (e) {
      console.warn(TAG, "domain gate check failed (non-fatal, allowing travel)", e);
    }

    // Ley Gate discount (Option 1): reduce OP cost by strength
    // mult = 1 - 0.4*strength  (strength 0.5 => 0.8 => ~20% cheaper)
    if (ctx.gate && ctx.gate.kind === "ley-gate") {
      const str = Number(ctx.gate.strength ?? 0.5);
      const strength = Number.isFinite(str) ? Math.max(0, Math.min(1, str)) : 0.5;
      const mult = Math.max(0, 1 - (0.4 * strength));

      for (const k of Object.keys(ctx.cost || {})) {
        ctx.cost[k] = Math.max(0, Math.round(Number(ctx.cost[k] || 0) * mult));
      }

      console.log(TAG, "Ley Gate discount applied:", { strength, mult, cost: ctx.cost });
    }

    // Dev-6 free passage (owner directive 2026-06-06): a fully-developed hex
    // (development.stage / integration.progress == 6) costs NOTHING to move
    // through for the OWNING faction and its ALLIES (relations tier >= allied).
    // Civilization means roads. Applied after the gate discount, before GM
    // overrides (costSet still has final authority).
    try {
      const tf = to?.document?.flags?.[MOD_TERR] || to?.flags?.[MOD_TERR] || {};
      const devStage = Number(tf.development?.stage ?? tf.integration?.progress ?? 0);
      if (devStage >= 6) {
        const hexOwnerId = String(tf.factionId || tf.ownerId || "").trim();
        let freeRide = false, why = "";
        if (hexOwnerId && hexOwnerId === factionId) { freeRide = true; why = "owner"; }
        else if (hexOwnerId) {
          const rel = game.bbttcc?.api?.factions?.relations;
          const ALLIED = 5; // relations tier ladder: ..., friendly=4, allied=5
          if (rel?.tier && Number(rel.tier(hexOwnerId, factionId)) >= ALLIED) { freeRide = true; why = "allied"; }
        }
        if (freeRide) {
          for (const k of Object.keys(ctx.cost || {})) ctx.cost[k] = 0;
          ctx.devSixFreePassage = why;
          console.log(TAG, "Dev-6 free passage:", { hexOwnerId, factionId, why });
        }
      }
    } catch (e) {
      console.warn(TAG, "dev-6 free-passage check failed (non-fatal)", e);
    }


    
    // ----------------------------------------------------------
    // GM / Caller Cost Overrides (manual travel discounts/surcharges)
    //
    // Supported opts:
    //   - costMult: number (e.g., 0.8 => 20% cheaper, 1.25 => 25% more)
    //   - costAdd:  object of OP deltas to ADD after multiplier (positive/negative)
    //   - costSet:  object to REPLACE ctx.cost entirely (final authority)
    //
    // Notes:
    // - This is applied AFTER terrain + gate discounts, BEFORE OP spend.
    // - Intended for character benefits ("reduce travel cost") and GM rulings.
    // ----------------------------------------------------------
    // Thread source/policy through to bbttcc:afterTravel listeners
    ctx.source = (opts && opts.source) ? String(opts.source) : (ctx.source || null);
    ctx.encounterPolicy = (opts && opts.encounterPolicy) ? String(opts.encounterPolicy) : (ctx.encounterPolicy || null);

    try {
      const cmRaw =
        (opts && (opts.costMult != null ? opts.costMult : (opts.opCostMult != null ? opts.opCostMult : null)));
      const cm = Number(cmRaw);
      const hasMult = (cmRaw != null) && Number.isFinite(cm) && cm > 0 && cm !== 1;

      const addRaw =
        (opts && (opts.costAdd != null ? opts.costAdd : (opts.opCostAdd != null ? opts.opCostAdd : null)));
      const setRaw =
        (opts && (opts.costSet != null ? opts.costSet : (opts.opCostSet != null ? opts.opCostSet : null)));

      if (setRaw && typeof setRaw === "object") {
        ctx.cost = normalizeCostKeys(setRaw);
        ctx._costOverride = { kind: "set", set: clone(ctx.cost) };
      } else {
        if (hasMult) {
          for (const k of Object.keys(ctx.cost || {})) {
            ctx.cost[k] = Math.max(0, Math.round(Number(ctx.cost[k] || 0) * cm));
          }
          ctx._costOverride = ctx._costOverride || {};
          ctx._costOverride.mult = cm;
        }

        if (addRaw && typeof addRaw === "object") {
          const add = normalizeCostKeys(addRaw);
          for (const k2 of Object.keys(add)) {
            const v = Number(add[k2] || 0);
            if (!Number.isFinite(v) || v === 0) continue;
            const cur = Number(ctx.cost[k2] || 0);
            ctx.cost[k2] = Math.max(0, Math.round(cur + v));
          }
          ctx._costOverride = ctx._costOverride || {};
          ctx._costOverride.add = add;
        }
      }

      if (ctx._costOverride) console.log(TAG, "Applied cost override:", ctx._costOverride, "Final cost:", ctx.cost);
    } catch (e) {
      console.warn(TAG, "Cost override failed (non-blocking):", e);
    }

// ==========================================================
    // SCOUT SIGNS (ALPHA):
    // - Supports one-shot travel modifiers at flags.bbttcc-factions.travelMods.next
    // - Supports auto-trigger Scout Signs (band-aware) BEFORE travel roll
    //
    // One-shot modifiers (consumed immediately):
    //   - encounterTierDelta: adjusts ctx.terrainTier (affects DC + encounter label/tier)
    //   - encounterChanceDelta: applied as a modifier to the travel roll (positive = safer)
    //   - abortTravel: cancels travel before OP spend
    //   - preventHazard: sets ctx.preventHazard (treat failed roll as safe-prevented)
    //
    // Auto-trigger Scout Signs:
    //   - If triggered, launches the appropriate Scout Signs scene + outcome dialog
    //   - The chosen outcome writes travelMods.next, which is then applied to THIS SAME hop
    // ==========================================================

    function _integrationMod(progress0to6) {
      const p = Math.max(0, Math.min(6, Math.round(Number(progress0to6 || 0))));
      if (p >= 4) return -2;
      if (p >= 2) return 0;
      return +2;
    }

    function _specialMod(modifiersArr) {
      const mods = Array.isArray(modifiersArr) ? modifiersArr : [];
      let m = 0;
      for (const raw of mods) {
        const k = String(raw || "").toLowerCase();
        if (!k) continue;
        // Treat these as explicit danger multipliers
        if (k.includes("radiation") || k.includes("contaminated")) m += 2;
        else if (k.includes("difficult terrain")) m += 1;
        else if (k.includes("hostile population")) m += 1;
      }
      return m;
    }

    function _deriveBandFromHex(ctx, toDrawing) {
      const tf = toDrawing?.document?.flags?.[MOD_TERR] || toDrawing?.flags?.[MOD_TERR] || {};
      const claimed = !!tf.factionId;
      const progress = tf?.integration?.progress ?? 0;
      const mods = tf.modifiers || [];
      // Pressure Index (distance omitted — this is local banding for auto-scout only)
      // Base from terrain tier (tier 1 => 0, tier 2 => 1, etc.)
      const base = Math.max(0, Number(ctx.terrainTier || 1) - 1);
      const claimM = claimed ? -1 : +1;
      const integM = _integrationMod(progress);
      const specM = _specialMod(mods);
      const pressure = base + claimM + integM + specM;

      // Band thresholds
      if (pressure <= 0) return "I";
      if (pressure <= 3) return "II";
      return "III";
    }

    async function _consumeAndApplyTravelMods(actor, ctx) {
      let scoutRollMod = 0;
      const scoutMod = actor.getFlag(MOD_FCT, "travelMods")?.next || null;

      if (!scoutMod) return { scoutRollMod: 0, applied: false, aborted: false, mod: null };

      // Consume immediately (one-shot)
      try {
        await actor.setFlag(MOD_FCT, "travelMods.next", null);
      } catch (e) {}

      // Abort travel cleanly (no OP spend, no warlog)
      if (scoutMod.abortTravel) {
        ui.notifications?.info?.("Travel aborted (Scout Signs).");
        return { scoutRollMod: 0, applied: true, aborted: true, mod: scoutMod };
      }

      // Tier shift (minimum 1)
      if (Number.isFinite(scoutMod.encounterTierDelta)) {
        ctx.terrainTier = Math.max(1, ctx.terrainTier + Number(scoutMod.encounterTierDelta));
      }

      // Chance shift implemented as roll modifier (+ = safer, - = riskier)
      if (Number.isFinite(scoutMod.encounterChanceDelta)) {
        scoutRollMod += Number(scoutMod.encounterChanceDelta);
      }

      // Optional: prevent hazard
      if (scoutMod.preventHazard) ctx.preventHazard = true;

      console.log(TAG, "Applied Scout Signs travel mod:", scoutMod);
      return { scoutRollMod, applied: true, aborted: false, mod: scoutMod };
    }

    // Auto Scout Signs (legacy) has been retired.
    // Scout Signs is now authored and tuned via Campaign Travel Tables.
    async function _maybeAutoScoutSigns(_actor, _ctx, _from, _to) {
      return { triggered: false, reason: "disabled" };
    }

    // 1) Apply any pre-existing one-shot mod (e.g., queued by a previous Scout Signs)
    let scoutRollMod = 0;
    {
      const r = await _consumeAndApplyTravelMods(actor, ctx);
      scoutRollMod += r.scoutRollMod;
      if (r.aborted) return r.mod ? { ok: false, aborted: true, reason: "scout-sign", mod: r.mod } : { ok: false, aborted: true };
    }

    // 2) Legacy auto Scout Signs disabled (campaign tables own frequency now).
    { await _maybeAutoScoutSigns(actor, ctx, from, to); }

    // Per-leg armed mitigation (Travel Console may pass an explicit ability-key list to spend on
    // THIS leg; null = auto-consume default). The mitigation bridge reads ctx.armedMitigation.
    ctx.armedMitigation = (opts.armedMitigation !== undefined) ? opts.armedMitigation : null;
    Hooks.callAll("bbttcc:beforeTravel", ctx);

    const a = from?.center || ctx.token?.center || { x: to.center.x - 20, y: to.center.y - 20 };
    const b = to.center;
    drawTrail(a, b, getFactionColor(actor));

    await spendOP({ factionId, cost: ctx.cost });

    const mid = { x: (a.x + b.x)/2, y: (a.y + b.y)/2 };
    const costTxt = Object.entries(ctx.cost).map(([k,v]) => (v>0?`-${v} ${labelOP(k)}`:null)).filter(Boolean).join(", ");
    if (costTxt) popupText(mid, costTxt);

    const intrigueMod = getFactionIntrigueMod(actor);
    const darknessBump = darknessEncounterBoost(actor, to);
    const dc = _encounterDc(ctx.terrainTier, ctx.dcMod, darknessBump);

    // Owner ruling 2026-08-22: travel joins the tactical layer's 2d10 regime
    // (the d20 here was the last holdout of a separate math). Advantage rolls
    // 3d10 keep-high-2, matching strikes/saves everywhere else. Pair with the
    // retuned Encounter Base DC (12) — the old base 15 was authored against
    // a d20's flat distribution.
    const rollFormula = ctx.travelAdvantage ? "3d10kh2 + @int + @scout" : "2d10 + @int + @scout";
    const roll = await (new Roll(rollFormula, { int: intrigueMod, scout: scoutRollMod })).evaluate();
    let total = roll.total;
    let success = total >= dc;
    // Encounter-mitigation reroll (Wheel of Fortune T4 "Force the Reroll", mitigates:["encounter"]):
    // on a missed travel check, a covering roster ability rerolls once and keeps the better result.
    if (!success && !ctx.preventHazard && ctx.encounterMitigation?.covered) {
      const r2 = await (new Roll(rollFormula, { int: intrigueMod, scout: scoutRollMod })).evaluate();
      ctx.encounterReroll = { first: total, second: r2.total, by: ctx.encounterMitigation.abilities || [] };
      if (r2.total > total) { total = r2.total; success = total >= dc; }
    }
    pulseToken(ctx.token ?? canvas.tokens.controlled[0] ?? canvas.tokens.placeables[0], success ? "#00FF66" : "#FF3366");
    popupText(b, `Travel Check ${total} vs DC ${dc} ${success ? "✅" : "❌"}${ctx.encounterReroll ? " ↻" : ""}`);

    const travelStub = {
      active: true,
      factionId,
      hexFrom, hexTo,
      terrainType: terrFlags?.terrainType || raw || key,
      opCost: ctx.cost,
      distanceUnits: ctx.distanceUnits,
      distanceMiles: ctx.distanceMiles,
      distanceMilesUnits: ctx.distanceMilesUnits,
      crewUsed: ctx.crew,
      result: success ? "safe" : (ctx.preventHazard ? "safe" : "encounter"),
      encounterTier: ctx.terrainTier
    };
    // Travel-stub flag is informational metadata that lets GMs see "last travel
    // through this hex" on the hex sheet. Players can't update Drawing flags
    // (Foundry permission), so the previous .catch(()=>{}) silently rejected
    // but Foundry still logged a noisy red error. Just gate by GM — the flag
    // will be written on the GM client's mirror render, or skipped harmlessly.
    if (game.user?.isGM) {
      await to.document.setFlag(MOD_TERR, "travel", travelStub).catch(()=>{});
    }

    let encounterLabel = "";
    let encounter = { triggered: false };
    if (!success && !ctx.preventHazard) {
      const raid = getRaidAPI();
      if (raid?.scheduleEvent) {
        await raid.scheduleEvent({ kind: "travelEncounter", tier: ctx.terrainTier, hexId: to.id, terrain: raw || key, factionId });
      }
      encounterLabel = `Encounter (Tier ${ctx.terrainTier})`;
      encounter = { triggered: true, tier: ctx.terrainTier, label: encounterLabel };
      placeEncounterIcon(to, encounterLabel);
    }

    await writeWarLog(actor, {
      kind: "travel",
      hexFrom, hexTo,
      terrain: terrFlags?.terrainType || raw || key,
      opSpent: ctx.cost,
      roll: total,
      dc,
      result: success ? "safe" : (ctx.preventHazard ? "safe-prevented" : "encounter"),
      note: encounterLabel
    });

    Hooks.callAll("bbttcc:afterTravel", { ...ctx, success, rollTotal: total, dc });

    // ---------------------------------------------------------------------------
    // Campaign Engine — OPTION B: Travel Threshold Injection
    // Fires after travel resolution. Silence is valid.
    // ---------------------------------------------------------------------------
    try {
      const injector = game.bbttcc?.api?.campaigns?.injector;

      if (injector?.maybeInject && !game.combat?.started) {
        const terrFlags = to?.document?.flags?.[MOD_TERR] || to?.flags?.[MOD_TERR] || {};

        const thresholdCtx = {
          source: "travel",
          trigger: "travel_threshold",

          factionId: ctx.factionId || actor?.id || null,
          hexUuid: to?.document?.uuid || to?.uuid || null,

          terrain: String(
            terrFlags.terrainType ||
            terrFlags.terrain ||
            ctx.terrainKey ||
            "wilderness"
          ).toLowerCase(),

          radiation: terrFlags.radiationTier || terrFlags.radiation || null,

          // Optional pressure band (safe fallback if missing)
          band: (() => {
            try {
              const prog = terrFlags.integration?.progress ?? 0;
              if (prog >= 4) return "I";
              if (prog >= 2) return "II";
              return "III";
            } catch {
              return null;
            }
          })(),

          success,
          encounter: encounter?.triggered ? encounter : null
        };

    injector.maybeInject("travel_threshold", thresholdCtx);
  }
} catch (e) {
  console.warn(TAG, "Travel Threshold injection failed (non-blocking):", e);
}


    const summary = encounter.triggered ? `Travel encounter (Tier ${ctx.terrainTier})` : "Travel OK";
    return {
      ok: true,
      summary,
      cost: ctx.cost,
      distanceUnits: ctx.distanceUnits,
      distanceMiles: ctx.distanceMiles,
      distanceMilesUnits: ctx.distanceMilesUnits,
      distanceUnitsLabel: ctx.distanceUnitsLabel,
      success,
      dc,
      roll: total,
      encounter,
      context: ctx
    };
  }

  function labelOP(k) {
    const kk = String(k || "");
    const L = {
      economy: "Economy OP",
      logistics: "Logistics",
      intrigue: "Intrigue OP",
      violence: "Violence OP",
      nonLethal: "Non-Lethal OP",
      faith: "Faith OP",
      diplomacy: "Diplomacy OP",
      softPower: "Soft Power OP"
    };
    return L[kk] || kk;
  }

  async function writeWarLog(actor, entry) {
  const api = getFactionAPI();

  // Prefer canonical factions API if present
  try {
    if (api?.logWar) {
      return await api.logWar(actor.id, entry);
    }
  } catch (e) {
    console.warn("[bbttcc-travel] api.logWar failed; falling back to flag write", e);
  }

  // Flag fallback: match expected War Logs shape
  const prev = actor.getFlag(MOD_FCT, "warLogs") || [];

  const ts = Date.now();
  const date = new Date(ts).toLocaleString();

  // Normalize into the common War Log schema used elsewhere:
  // - ts (number), date (string), type ("travel"), summary (string)
  // - plus travel-specific fields from `entry`
  const result = entry?.result || (entry?.success ? "safe" : "encounter");
  const terrain = entry?.terrain || entry?.terrainType || entry?.terrainKey || "";
  const fromName =
  entry?.fromName ||
  entry?.from?.document?.text ||
  entry?.hexFromName ||
  "";

const toName =
  entry?.toName ||
  entry?.to?.document?.text ||
  entry?.hexToName ||
  "";

  const summary =
    entry?.summary ||
    entry?.note ||
    (fromName && toName
      ? `${fromName} → ${toName}${terrain ? ` (${terrain})` : ""} • ${result}`
      : (terrain ? `${terrain} • ${result}` : result));

  prev.push({
    ts,
    date,
    type: "travel",
    summary,
    ...entry
  });

  await actor.setFlag(MOD_FCT, "warLogs", prev);
}


  // Token hook: trigger travel when crossing hexes
  Hooks.on("updateToken", async (doc, changes, opts) => {
    if (opts?.bbttccTravelVisuals) return;
    if (changes.x === undefined && changes.y === undefined) return;
    const token = canvas.tokens.get(doc.id);
    const actor = token?.actor;
    if (!isFactionActor(actor)) return;

    const prevX = doc._source.x ?? doc.x, prevY = doc._source.y ?? doc.y;
    const fromHex = getHexAtPoint(prevX, prevY);
    const toHex   = getHexAtPoint(doc.x ?? prevX, doc.y ?? prevY);
    if (!fromHex || !toHex || fromHex.id === toHex.id) return;

    try {
      await travelHex({ factionId: actor.id, hexFrom: fromHex.id, hexTo: toHex.id, tokenId: token.id });
    } catch (err) {
      console.error(TAG, "travelHex error:", err);
      ui.notifications?.error?.(`Travel failed: ${err.message}`);
    }
  });

  
// ---------------------------------------------------------------------------
// Campaign Engine MVP — Beat Injector (Scout Signs hook first)
// ---------------------------------------------------------------------------
const CAMPAIGN_STORE_NS = "bbttcc-campaign";
const CAMPAIGN_STORE_KEY = "campaigns";

// We store injector state + active campaign selection in a world-scoped setting
// registered under bbttcc-core (always present) to avoid unregistered-key crashes.
const INJ_SETTING_NS = "bbttcc-core";
const INJ_SETTING_KEY = "campaignInjectorState";
const INJ_ACTIVE_KEY = "campaignInjectorActiveCampaignId";

function _safeGetSetting(ns, key, fallback) {
  try { return game.settings.get(ns, key); } catch (_e) { return fallback; }
}
async function _safeSetSetting(ns, key, value) {
  try { return await game.settings.set(ns, key, value); } catch (e) { throw e; }
}

function _normalizeCampaignStore(raw) {
  if (!raw) return { map: {}, list: [] };
  if (Array.isArray(raw)) {
    const list = raw.filter(Boolean);
    const map = Object.fromEntries(list.filter(c => c?.id).map(c => [c.id, c]));
    return { map, list };
  }
  if (typeof raw === "object") {
    const map = raw;
    const list = Object.values(map).filter(Boolean);
    return { map, list };
  }
  return { map: {}, list: [] };
}

function _getCampaignStore() {
  const raw = _safeGetSetting(CAMPAIGN_STORE_NS, CAMPAIGN_STORE_KEY, null);
  return _normalizeCampaignStore(raw);
}

function _ensureInjectorSettingsRegistered() {
  try {
    // Register if missing
    if (!game.settings?.settings?.has(`${INJ_SETTING_NS}.${INJ_SETTING_KEY}`)) {
      game.settings.register(INJ_SETTING_NS, INJ_SETTING_KEY, {
        name: "Campaign Injector State",
        hint: "Internal storage for the Campaign Engine Beat Injector (MVP).",
        scope: "world",
        config: false,
        type: Object,
        default: { version: 1, lastInjectedAt: 0, lastInjectedTurn: 0, beatHistory: {} }
      });
    }
    if (!game.settings?.settings?.has(`${INJ_SETTING_NS}.${INJ_ACTIVE_KEY}`)) {
      game.settings.register(INJ_SETTING_NS, INJ_ACTIVE_KEY, {
        name: "Campaign Injector Active Campaign",
        hint: "Internal active campaign id for Campaign Engine Beat Injector (MVP).",
        scope: "world",
        config: false,
        type: String,
        default: ""
      });
    }
  } catch (e) {
    console.warn(TAG, "Injector settings registration failed (non-blocking):", e);
  }
}

function _getTurnIndexFallback() {
  // Prefer a Bad Eden turn counter if one exists; otherwise 0.
  // MVP-safe: cooldown enforcement still works via timestamp if needed later.
  const t = game.bbttcc?.api?.turn?.getTurnIndex?.() ?? game.bbttcc?.api?.turn?.turnIndex;
  return Number.isFinite(Number(t)) ? Number(t) : 0;
}

function _getInjectorState() {
  _ensureInjectorSettingsRegistered();
  return _safeGetSetting(INJ_SETTING_NS, INJ_SETTING_KEY, { version: 1, lastInjectedAt: 0, lastInjectedTurn: 0, beatHistory: {} });
}

async function _setInjectorState(state) {
  _ensureInjectorSettingsRegistered();
  return _safeSetSetting(INJ_SETTING_NS, INJ_SETTING_KEY, state);
}

function _getActiveCampaignId() {
  _ensureInjectorSettingsRegistered();
  const raw = _safeGetSetting(INJ_SETTING_NS, INJ_ACTIVE_KEY, "");
  return raw || null;
}

async function _setActiveCampaignId(campaignId) {
  _ensureInjectorSettingsRegistered();
  await _safeSetSetting(INJ_SETTING_NS, INJ_ACTIVE_KEY, String(campaignId || ""));
  return true;
}

function _ctxToTags(triggerType, ctx) {
  const tags = [];
  if (triggerType) tags.push(`trigger.${triggerType}`);
  if (ctx?.terrain) tags.push(`terrain.${String(ctx.terrain).toLowerCase()}`);
  if (ctx?.band) tags.push(`band.${String(ctx.band).toUpperCase()}`);
  if (ctx?.radiation) tags.push(`radiation.${String(ctx.radiation).toLowerCase()}`);
  if (ctx?.tone) tags.push(`tone.${String(ctx.tone).toLowerCase()}`);
  return tags;
}

function _beatTags(beat) {
  const t = beat?.tags;
  if (!t) return [];
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === "string") return t.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function _matchBeat(triggerType, ctxTags, beat) {
  const tags = _beatTags(beat);
  if (!tags.length) return null;

  // Hard filters: if beat declares trigger./terrain./band. it must match.
  const hardPrefixes = ["trigger.", "terrain.", "band."];
  for (const pref of hardPrefixes) {
    const declared = tags.filter(t => t.startsWith(pref));
    if (declared.length) {
      const ok = declared.some(t => ctxTags.includes(t));
      if (!ok) return null;
    }
  }

  let score = 0;
  for (const t of tags) if (ctxTags.includes(t)) score++;
  if (score <= 0) return null;

  return { beatId: beat?.id, score, tagCount: tags.length, tags };
}

function _combatActive() {
  // Conservative: if there is an active combat with a round/turn, don't inject.
  return !!game.combat?.started;
}

/**
 * Determine whether the global injector cooldown blocks this trigger.
 *
 * Global cooldown is intended to prevent multiple *ambient* injections
 * (e.g. travel_threshold, scout_signs) from firing in rapid succession.
 *
 * Terminal / authoritative triggers (like hex_enter) must bypass this,
 * otherwise arrival beats can be suppressed by prior travel events.
 */
function _cooldownBlocked(state, nowTurn, globalCooldownTurns = 1, triggerType = null) {
  // No cooldown configured
  if (!globalCooldownTurns) return false;

  // Explicitly exempt terminal triggers
  if (triggerType === "hex_enter") return false;

  const last = Number(state?.lastInjectedTurn || 0);
  return (nowTurn - last) < globalCooldownTurns;
}

function _beatState(state, beatId) {
  state.beatHistory ??= {};
  state.beatHistory[beatId] ??= { firedCount: 0, lastFiredAt: 0, lastFiredTurn: 0, firedHexes: {}, firedFactions: {} };
  return state.beatHistory[beatId];
}

function _blockedByBeatRules(state, beat, ctx, nowTurn) {
  const beatId = beat?.id;
  if (!beatId) return { blocked: true, why: "missing beat.id" };

  const inject = beat?.inject || {};
  const rec = _beatState(state, beatId);

  const repeatable = inject.repeatable === true;
  if (!repeatable && rec.firedCount > 0) return { blocked: true, why: "once-only" };

  const cooldownTurns = Number(inject.cooldownTurns || 0);
  if (cooldownTurns > 0 && (nowTurn - Number(rec.lastFiredTurn || 0)) < cooldownTurns) {
    return { blocked: true, why: `cooldownTurns(${cooldownTurns})` };
  }

  if (inject.oncePerHex && ctx?.hexUuid) {
    if (rec.firedHexes?.[ctx.hexUuid]) return { blocked: true, why: "oncePerHex" };
  }

  if (inject.oncePerFaction && ctx?.factionId) {
    if (rec.firedFactions?.[ctx.factionId]) return { blocked: true, why: "oncePerFaction" };
  }

  return { blocked: false };
}

async function _logToStoryConsole(message, data) {
  // Prefer the story engine logger if present
  const story = game.bbttcc?.api?.story?.gottgait;
  if (story?.logBeat) {
    try { await story.logBeat(message, data); return; } catch (e) { /* fallthrough */ }
  }

  // Fallback: append directly to bbttcc-core.gottgaitStoryState if it exists.
  try {
    const key = "gottgaitStoryState";
    const state = _safeGetSetting("bbttcc-core", key, {}) || {};
    state.beats ??= [];
    state.beats.push({ ts: Date.now(), message, data });
    await _safeSetSetting("bbttcc-core", key, state);
  } catch (e) {
    // totally non-blocking
  }
}

async function _executeBeat(campaignId, beatId, triggerType, ctx, winner) {
  // Find a runner
  const runBeat =
    game.bbttcc?.api?.campaign?.runBeat ||
    game.bbttcc?.api?.campaigns?.runBeat ||
    null;

  if (typeof runBeat !== "function") {
    return { ok: false, why: "campaign runBeat API not found", winner };
  }

  try {
    // Canonical signature confirmed: runBeat(campaignId, beatId)
    await runBeat(campaignId, beatId);

    await _logToStoryConsole(
      `Injected Campaign Beat: ${beatId}`,
      { source: "bbttcc-campaign-injector", triggerType, campaignId, beatId, ctx }
    );

    return { ok: true, fired: true, campaignId, beatId, winner };
  } catch (e) {
    console.warn(TAG, "Injected beat execution failed:", e);
    return { ok: false, why: String(e?.message || e), campaignId, beatId, winner };
  }
}

const CampaignBeatInjector = {
  getState: _getInjectorState,
  clearState: async () => _setInjectorState({ version: 1, lastInjectedAt: 0, lastInjectedTurn: 0, beatHistory: {} }),

  getActiveCampaignId: _getActiveCampaignId,
  setActiveCampaignId: _setActiveCampaignId,

  // NEW: run a specific beatId with gating + defaults (used by Hex Entry)
  maybeRunBeatById: async ({ campaignId, beatId, triggerType="manual", ctx=null, defaults=null } = {}) => {
    try {
      if (_combatActive()) return { ok: false, triggerType, why: "combat active" };
      if (!campaignId) campaignId = _getActiveCampaignId();
      if (!campaignId) return { ok: false, triggerType, why: "no active campaign" };
      if (!beatId) return { ok: false, triggerType, why: "missing beatId" };

      const { map } = _getCampaignStore();
      const campaign = map[campaignId];
      const beats = Array.isArray(campaign?.beats) ? campaign.beats : [];

      const nowTurn = _getTurnIndexFallback();
      const state = _getInjectorState();

      if (_cooldownBlocked(state, nowTurn, 1, triggerType)) return { ok: false, triggerType, why: "global cooldown" };

      // Find beat record if it exists (so we can respect inject settings if authored)
      let beat = null;
      for (const b of beats) {
        if (b?.id === beatId) { beat = b; break; }
      }

      // Build an effective inject rule set:
      // - prefer authored beat.inject if present
      // - else defaults (e.g. oncePerHex true for hex_enter)
      const effectiveBeat = beat ? beat : { id: beatId, inject: {} };
      const inject = (effectiveBeat.inject && typeof effectiveBeat.inject === "object") ? effectiveBeat.inject : {};

      // Apply defaults only when the beat didn’t explicitly set the field.
      // Specifically: Hex Entry default oncePerHex = true.
      const effInject = Object.assign({}, inject);
      if (defaults && typeof defaults === "object") {
        if (defaults.oncePerHex === true && typeof effInject.oncePerHex === "undefined") {
          effInject.oncePerHex = true;
        }
        if (typeof defaults.repeatable === "boolean" && typeof effInject.repeatable === "undefined") {
          effInject.repeatable = defaults.repeatable;
        }
        if (typeof defaults.cooldownTurns === "number" && typeof effInject.cooldownTurns === "undefined") {
          effInject.cooldownTurns = defaults.cooldownTurns;
        }
        if (typeof defaults.oncePerFaction === "boolean" && typeof effInject.oncePerFaction === "undefined") {
          effInject.oncePerFaction = defaults.oncePerFaction;
        }
      }

      // Gate using the same state/logic as tag-injection.
      // We temporarily project effInject onto the beat-like object.
      const projected = Object.assign({}, effectiveBeat, { inject: effInject });

      const rule = _blockedByBeatRules(state, projected, ctx, nowTurn);
      if (rule.blocked) return { ok: true, fired: false, triggerType, why: rule.why, campaignId, beatId };

      // Execute beat
      const execRes = await _executeBeat(campaignId, beatId, triggerType, ctx, { beatId, direct:true });
      if (!execRes.ok) return execRes;

      // Record state
      const rec = _beatState(state, beatId);
      rec.firedCount = Number(rec.firedCount || 0) + 1;
      rec.lastFiredAt = Date.now();
      rec.lastFiredTurn = nowTurn;

      if (ctx?.hexUuid && effInject.oncePerHex) {
        rec.firedHexes ??= {};
        rec.firedHexes[String(ctx.hexUuid)] = (rec.firedHexes[String(ctx.hexUuid)] || 0) + 1;
      }

      if (ctx?.factionId && effInject.oncePerFaction) {
        rec.firedFactions ??= {};
        rec.firedFactions[String(ctx.factionId)] = (rec.firedFactions[String(ctx.factionId)] || 0) + 1;
      }

      state.lastInjectedAt = Date.now();
      state.lastInjectedTurn = nowTurn;

      await _setInjectorState(state);

      return { ok: true, fired: true, triggerType, campaignId, beatId };
    } catch (e) {
      console.warn(TAG, "maybeRunBeatById failed (non-blocking):", e);
      return { ok: false, triggerType, why: String(e?.message || e), campaignId, beatId };
    }
  },

  dryRun: async (triggerType, ctx) => {
    const campaignId = _getActiveCampaignId();
    if (!campaignId) return { ok: false, triggerType, why: "no active campaign (or campaign has no beats)" };

    const { map } = _getCampaignStore();
    const campaign = map[campaignId];
    const beats = Array.isArray(campaign?.beats) ? campaign.beats : [];
    if (!beats.length) return { ok: false, triggerType, why: "no active campaign (or campaign has no beats)" };

    const ctxTags = _ctxToTags(triggerType, ctx);
    const candidates = beats.map(b => _matchBeat(triggerType, ctxTags, b)).filter(Boolean);

    let winner = null;
    if (candidates.length) {
      candidates.sort((a,b) => (b.score - a.score) || (b.tagCount - a.tagCount));
      winner = candidates[0];
    }

    return { ok: true, triggerType, ctxTags, candidates, winner };
  },

  maybeInject: async (triggerType, ctx) => {
    if (_combatActive()) return { ok: false, triggerType, why: "combat active" };

    const campaignId = _getActiveCampaignId();
    if (!campaignId) return { ok: false, triggerType, why: "no active campaign (or campaign has no beats)" };

    const { map } = _getCampaignStore();
    const campaign = map[campaignId];
    const beats = Array.isArray(campaign?.beats) ? campaign.beats : [];
    if (!beats.length) return { ok: false, triggerType, why: "no active campaign (or campaign has no beats)" };

    const nowTurn = _getTurnIndexFallback();
    const state = _getInjectorState();

    if (_cooldownBlocked(state, nowTurn, 1, triggerType)) return { ok: false, triggerType, why: "global cooldown" };

    const ctxTags = _ctxToTags(triggerType, ctx);
    const matches = [];
    for (const beat of beats) {
      const m = _matchBeat(triggerType, ctxTags, beat);
      if (!m) continue;
      const rule = _blockedByBeatRules(state, beat, ctx, nowTurn);
      if (rule.blocked) continue;
      matches.push({ ...m, _beat: beat });
    }

    if (!matches.length) return { ok: true, triggerType, ctxTags, candidates: [], winner: null };

    matches.sort((a,b) => (b.score - a.score) || (b.tagCount - a.tagCount));
    const winner = matches[0];
    const beat = winner._beat;

    const execRes = await _executeBeat(campaignId, beat.id, triggerType, ctx, { beatId: beat.id, score: winner.score, tagCount: winner.tagCount, tags: winner.tags });
    if (!execRes.ok) return execRes;

    // Record state (only on success)
    const rec = _beatState(state, beat.id);
    rec.firedCount = Number(rec.firedCount || 0) + 1;
    rec.lastFiredAt = Date.now();
    rec.lastFiredTurn = nowTurn;
    if (ctx?.hexUuid) {
      rec.firedHexes ??= {};
      rec.firedHexes[String(ctx.hexUuid)] = (rec.firedHexes[String(ctx.hexUuid)] || 0) + 1;
    }
    if (ctx?.factionId) {
      rec.firedFactions ??= {};
      rec.firedFactions[String(ctx.factionId)] = (rec.firedFactions[String(ctx.factionId)] || 0) + 1;
    }
    state.lastInjectedAt = Date.now();
    state.lastInjectedTurn = nowTurn;

    await _setInjectorState(state);

    return { ok: true, fired: true, triggerType, campaignId, beatId: beat.id, winner: execRes.winner };
  }
};

// Install API on ready
Hooks.once("ready", () => {
  _ensureInjectorSettingsRegistered();
  game.bbttcc ??= { api: {} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.campaigns ??= {};
  game.bbttcc.api.campaigns.injector = CampaignBeatInjector;

  // Convenience alias: some scripts look for campaigns.runBeat; map to campaign.runBeat if present
  if (!game.bbttcc.api.campaigns.runBeat && typeof game.bbttcc?.api?.campaign?.runBeat === "function") {
    game.bbttcc.api.campaigns.runBeat = game.bbttcc.api.campaign.runBeat.bind(game.bbttcc.api.campaign);
  }

  console.log(TAG, "Campaign Beat Injector registered at game.bbttcc.api.campaigns.injector");
});


// --- API registration -------------------------------------------------------

function registerTravelAPI() {
  game.bbttcc = game.bbttcc || { api: {} };
  game.bbttcc.api = game.bbttcc.api || {};
  game.bbttcc.api.travel = game.bbttcc.api.travel || {};

  const api = game.bbttcc.api;

  // If a canonical wrapper exists (bbttcc-travel/api.travel.js), do NOT overwrite it.
  // Instead, register THIS engine as the core implementation under __coreTravel.
  // The wrapper will call through to __coreTravel when ready.
  api.travel.__coreTravel = travelHex;
  api.__coreTravelHex = travelHex;

  // Back-compat: only publish as travelHex if nothing else has claimed it yet.
  if (typeof api.travelHex !== "function") api.travelHex = travelHex;
  if (typeof api.travel.travelHex !== "function") api.travel.travelHex = travelHex;

  // Encounter-chance dial: register the GM settings so they appear in the
  // Configure Settings menu, and expose the DC helper so other travel paths
  // (e.g. hex-travel-mode interactive mode) compute DC the same way.
  _ensureEncounterDialSettings();

  // OP preview contract (Travel Console reads this)
  api._hexTravel = {
    TERRAIN_TABLE,
    getHexAtPoint,
    getHexTerrainSpec,
    _encounterDc
  };

  // Movement-domain gating surface — reused by combat (underwater zone detection),
  // the dive transition, and any UI that wants to preview reachability.
  api.travel.domains = {
    terrainMedium,
    requiredDomainsForTerrain,
    rigDomains,
    factionRigs,
    factionTravelDomains,
    canFactionEnterTerrain,
    // Convenience: gate a faction against a terrain KEY (resolves the spec).
    canEnterTerrainKey: (factionId, terrainKey) => {
      const spec = TERRAIN_TABLE[terrainKey] || TERRAIN_NORM[normalizeTerrainKey(terrainKey)] || null;
      return canFactionEnterTerrain(factionId, spec || {});
    },
    factionSubDepth,
    factionAirReach
  };

  // Diving: surface-water hex ⇵ underwater scene (gated on a depth-rated sub).
  api.travel.dive    = diveFromHex;
  api.travel.surface = surfaceFromScene;
  // Ascending: hex ⇵ aerial scene (gated on an air/space rig). surface() also
  // descends — it just follows whatever returnLink the active scene carries.
  api.travel.ascend  = ascendFromHex;
  api.travel.descend = surfaceFromScene;

  console.log(TAG, "Hex Travel Visual Engine registered.", {
    hasWrapper: (api.travelHex !== travelHex),
    coreStored: true
  });
}

// Normal Foundry lifecycle
Hooks.once("ready", registerTravelAPI);

// Safety net: if this file loads after ready (hot reload / load-order drift)
if (game?.ready) {
  registerTravelAPI();
}
})();