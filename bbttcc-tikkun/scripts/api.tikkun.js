console.log("[bbttcc-tikkun/api] LOADED CORRECT FILE");
/* bbttcc-tikkun/api.tikkun.js — Great Work Core API (C1)
 *
 * Provides:
 *  - Actor-level Spark storage and constellation helpers
 *  - Simple phase markers: identify / acquire / integrate / corrupt
 *  - Faction-level Great Work readiness evaluation
 *
 * Compatible with:
 *  - tikkun-hotfix.js (only fills in missing functions)
 *  - tikkun-sparks.enhancer.js (faction integration helpers)
 */

(() => {
  const MOD  = "bbttcc-tikkun";
  const TAG  = "[bbttcc-tikkun/api]";
  const MODF = "bbttcc-factions";

  const get   = (o, p, d) => { try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; } };
  const clone = (x) => foundry.utils.deepClone(x || {});

  /* ----------------------------------------------------------------------- */
  /* Namespace helpers                                                       */
  /* ----------------------------------------------------------------------- */

  function ensureNS() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.tikkun ??= {};
  }

  function _asActor(aOrId) {
    if (!aOrId) return null;
    if (aOrId instanceof Actor) return aOrId;
    return game.actors?.get(String(aOrId).replace(/^Actor\./, "")) ?? null;
  }

  function _asFaction(fOrId) {
    const A = _asActor(fOrId);
    if (!A) return null;
    const isFaction =
      A.getFlag?.(MODF, "isFaction") === true ||
      String(get(A, "system.details.type.value", "")).toLowerCase() === "faction";
    return isFaction ? A : null;
  }

  /* ----------------------------------------------------------------------- */
  /* Actor-level Spark storage                                               */
  /* ----------------------------------------------------------------------- */

  function _getSparkMap(actor) {
    const raw = get(actor, `flags.${MOD}.sparks`, {});
    // Legacy shape: numeric or anything non-object → treat as empty map
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return clone(raw);
  }

  async function _setSparkMap(actor, map) {
    await actor.update({ [`flags.${MOD}.sparks`]: map });
    return map;
  }

  function _ensureSpark(map, key, cfg = {}) {
    const id = cfg.id || key;
    if (!map[id]) {
      map[id] = {
        id,
        key,
        name:       cfg.name       || key,
        kind:       cfg.kind       || null,   // conceptual / vestigial / animate
        sephirah:   cfg.sephirah   || null,   // chesed / gevurah / ...
        status:     cfg.status     || "unknown",
        identified: !!cfg.identified,
        acquired:   !!cfg.acquired,
        integrated: !!cfg.integrated,
        corrupted:  !!cfg.corrupted,
        history:    []
      };
    }
    return map[id];
  }

  function _pushHistory(spark, entry) {
    const e = { ts: Date.now(), ...entry };
    (spark.history ??= []).push(e);
    if (spark.history.length > 30) spark.history = spark.history.slice(-30);
  }

  /* ----------------------------------------------------------------------- */
  /* Core actor-level API: hasSpark / gatherSpark / getAllSparks             */
  /* ----------------------------------------------------------------------- */

  async function hasSpark(actorOrId, key) {
    const actor = _asActor(actorOrId);
    if (!actor || !key) return false;
    const map  = get(actor, `flags.${MOD}.sparks`, {});
    const rec  = map?.[key] || Object.values(map).find((s) => s.key === key);
    if (!rec) return false;
    const st = String(rec.status || "").toLowerCase();
    // Treat gathered or integrated as "has" for gating (e.g., Spark of Mercy)
    return rec.integrated === true || st === "gathered" || st === "integrated";
  }

  async function gatherSpark(actorOrId, sparkCfg) {
    const actor = _asActor(actorOrId);
    if (!actor || !sparkCfg) throw new Error("gatherSpark: missing actor or spark config");
    const key = sparkCfg.key || sparkCfg.id;
    if (!key) throw new Error("gatherSpark: spark.key or spark.id required");

    const map = _getSparkMap(actor);
    const s   = _ensureSpark(map, key, { ...sparkCfg, status: "gathered" });
    s.identified = true;
    s.acquired   = true;

    _pushHistory(s, { phase: "gather", note: "Spark gathered via gatherSpark()" });

    await _setSparkMap(actor, map);
    ui.notifications?.info?.(`${actor.name} gathered ${s.name}`);
    return s;
  }

  function getAllSparks(actorOrId) {
    const actor = _asActor(actorOrId);
    if (!actor) return {};
    return _getSparkMap(actor);
  }

  /* ----------------------------------------------------------------------- */
  /* Constellation helpers (actor-level)                                     */
  /* ----------------------------------------------------------------------- */

  async function createConstellationForActor(actorId, { overwrite = false } = {}) {
    const actor = _asActor(actorId);
    if (!actor) throw new Error("createConstellationForActor: actor not found");

    const map = overwrite ? {} : _getSparkMap(actor);

    // Minimal 3-spark constellation scaffold.
    const base = [
      { key: "spark_conceptual", name: "Conceptual Spark", kind: "conceptual" },
      { key: "spark_vestigial",  name: "Vestigial Spark",  kind: "vestigial"  },
      { key: "spark_animate",    name: "Animate Spark",    kind: "animate"    }
    ];

    for (const cfg of base) {
      const s = _ensureSpark(map, cfg.key, { ...cfg, status: "unseen" });
      _pushHistory(s, { phase: "constellation", note: "Constellation initialized." });
    }

    await _setSparkMap(actor, map);
    return map;
  }

  async function markSparkPhase({ actorId, sparkKey, phase, note = "" }) {
    const actor = _asActor(actorId);
    if (!actor) throw new Error("markSparkPhase: actor not found");
    const key = sparkKey;
    const map = _getSparkMap(actor);
    const s   = map[key] || Object.values(map).find((sp) => sp.key === key);
    if (!s) throw new Error("markSparkPhase: spark not found");

    switch (String(phase || "").toLowerCase()) {
      case "identified":
        s.identified = true;
        s.status     = "identified";
        break;
      case "acquired":
        s.acquired = true;
        s.status   = "gathered";
        break;
      case "integrated":
        s.integrated = true;
        s.status     = "integrated";
        break;
      case "corrupted":
        s.corrupted = true;
        s.status    = "corrupted";
        break;
      default:
        s.status = phase;
    }

    _pushHistory(s, { phase, note });
    await _setSparkMap(actor, map);
    return s;
  }

  // Simple phase helpers — these will get richer in later passes (costs/DCs).
  async function identifySpark(opts)           { return markSparkPhase({ ...opts, phase: "identified" }); }
  async function acquireSpark(opts)            { return markSparkPhase({ ...opts, phase: "acquired"   }); }
  async function integrateSparkCharacter(opts) { return markSparkPhase({ ...opts, phase: "integrated"  }); }

  /* ----------------------------------------------------------------------- */
  /* Faction-level Great Work state                                          */
  /* ----------------------------------------------------------------------- */

  function readFactionSparks(faction) {
    // Use shapes created by tikkun-sparks.enhancer.js
    const integrated = get(faction, `flags.${MODF}.tikkun.integrated`, {}) || {};
    const map        = get(faction, `flags.${MODF}.sparks`, {}) || {};
    const arr        = get(faction, `flags.${MODF}.victory.sparks`, []) || [];
    return { integrated, map, array: arr };
  }

  function readFactionMetrics(faction) {
    const victory  = get(faction, `flags.${MODF}.victory`, {})  || {};
    const darkness = get(faction, `flags.${MODF}.darkness`, {}) || {};
    return {
      vp:       Number(victory.vp ?? 0),
      unity:    Number(victory.unity ?? 0),
      darkness: Number(darkness.global ?? 0)
    };
  }

  function getGreatWorkState(factionId, {
    sparkThreshold = 3,
    vpThreshold    = 10,
    unityThreshold = 30,
    maxDarkness    = 3
  } = {}) {
    const F = _asFaction(factionId);
    if (!F) throw new Error("getGreatWorkState: faction not found");

    const sparks  = readFactionSparks(F);
    const metrics = readFactionMetrics(F);

    const sparkCountByMap = Object.values(sparks.map).reduce((a, b) => a + Number(b || 0), 0);
    const sparkCountByArr = sparks.array.reduce((a, e) => a + Number(e?.count || 0), 0);
    const sparkCount      = Math.max(sparkCountByMap, sparkCountByArr);

    const integratedKeys   = Object.keys(sparks.integrated || {});
    const integratedCount  = integratedKeys.length;

    const corrupted        = get(F, `flags.${MODF}.tikkun.corrupted`, {}) || {};
    const corruptedKeys    = Object.keys(corrupted).filter((k) => corrupted[k]);

    const haveSparks   = sparkCount >= sparkThreshold || integratedCount >= sparkThreshold;
    const haveUnity    = metrics.unity    >= unityThreshold;
    const haveVP       = metrics.vp       >= vpThreshold;
    const darknessOK   = metrics.darkness <= maxDarkness;
    const noCorruption = corruptedKeys.length === 0;

    const ready = !!(haveSparks && haveUnity && haveVP && darknessOK && noCorruption);

    const reasons = [];
    if (!haveSparks)   reasons.push(`Need more Sparks (${sparkCount}/${sparkThreshold})`);
    if (!haveUnity)    reasons.push(`Unity too low (${metrics.unity}/${unityThreshold})`);
    if (!haveVP)       reasons.push(`Victory VP too low (${metrics.vp}/${vpThreshold})`);
    if (!darknessOK)   reasons.push(`Darkness too high (${metrics.darkness} > ${maxDarkness})`);
    if (!noCorruption) reasons.push(`Corrupted sparks present: ${corruptedKeys.join(", ")}`);

    return {
      factionId:   F.id,
      factionName: F.name,
      ready,
      reasons,
      metrics,
      sparkCount,
      integratedCount,
      integratedKeys,
      corruptedKeys
    };
  }

  function getGreatWorkStateForAllFactions(opts = {}) {
    const out = [];
    for (const A of game.actors?.contents ?? []) {
      const F = _asFaction(A);
      if (!F) continue;
      try {
        out.push(getGreatWorkState(F.id, opts));
      } catch (e) {
        console.warn(TAG, "getGreatWorkState failed for", F.name, e);
      }
    }
    return out;
  }

  /* ----------------------------------------------------------------------- */
  /* Install API after world is ready                                       */
  /* ----------------------------------------------------------------------- */

  function installAPI() {
    try {
      ensureNS();
      const API = game.bbttcc.api.tikkun;

      API.hasSpark                        = hasSpark;
      API.gatherSpark                     = gatherSpark;
      API.getAllSparks                    = getAllSparks;

      API.createConstellationForActor     = createConstellationForActor;
      API.markSparkPhase                  = markSparkPhase;
      API.identifySpark                   = identifySpark;
      API.acquireSpark                    = acquireSpark;
      API.integrateSparkCharacter         = integrateSparkCharacter;

      API.getGreatWorkState               = getGreatWorkState;
      API.getGreatWorkStateForAllFactions = getGreatWorkStateForAllFactions;

      console.log(TAG, "API ready (installAPI):", Object.keys(API));
    } catch (e) {
      console.warn(TAG, "installAPI failed:", e);
    }
  }

  // Ensure we install on ready (after other hooks), and also immediately if game is already ready.
  Hooks.once("ready", installAPI);
  try { if (game?.ready) installAPI(); } catch {}

})();
