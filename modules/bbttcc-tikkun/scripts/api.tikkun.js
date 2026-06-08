console.log("[bbttcc-tikkun/api] LOADED CORRECT FILE");
/* bbttcc-tikkun/api.tikkun.js — Great Work Core API (C1 + Phase A.1)
 *
 * Provides:
 *  - Actor-level Spark storage and constellation helpers
 *  - Simple phase markers: identify / acquire / integrate / corrupt
 *  - Faction-level Great Work readiness evaluation
 *
 * Spark counting (Phase A.1):
 *  - Faction spark count is the MAX of:
 *      • faction-level sparks (flags.bbttcc-factions.*)
 *      • sum of integrated sparks on all characters belonging to that faction
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
        // Phase E of B3 — deposit bridge. `deposited` flips on the explicit
        // character→faction handover; until then the personal `integrated`
        // is just the operative absorbing the spark.
        deposited:  !!cfg.deposited,
        history:    []
      };
    } else {
      // Backfill `deposited` on legacy records that predate Phase E.
      if (typeof map[id].deposited !== "boolean") map[id].deposited = false;
    }
    return map[id];
  }

  function _pushHistory(spark, entry) {
    const e = { ts: Date.now(), ...entry };
    (spark.history ??= []).push(e);
    if (spark.history.length > 30) spark.history = spark.history.slice(-30);
  }

  /* ----------------------------------------------------------------------- */
  /* Method×sephirah alignment (Phase C of B3 — auto-corruption)             */
  /* ----------------------------------------------------------------------- */
  // Per-sephirah fallback alignment table. Used when the spark item's
  // system.alignedMethods / misalignedMethods arrays are empty. Mirrors the
  // table baked into the 30 authored sparks (see packs-source/sparks/_generate.mjs).
  const SEPHIRAH_METHOD_ALIGNMENT = {
    keter:   { aligned: ["faith", "soul", "diplomacy"],            misaligned: ["violence", "nonlethal"] },
    chokmah: { aligned: ["intrigue", "soul", "logistics"],         misaligned: ["violence", "siege"] },
    binah:   { aligned: ["intrigue", "diplomacy", "logistics"],    misaligned: ["violence", "nonlethal"] },
    chesed:  { aligned: ["nonlethal", "diplomacy", "softpower", "faith"], misaligned: ["violence", "siege"] },
    gevurah: { aligned: ["violence", "siege"],                     misaligned: ["softpower", "diplomacy", "nonlethal"] },
    tiferet: { aligned: ["diplomacy", "softpower", "faith"],       misaligned: ["violence"] },
    netzach: { aligned: ["violence", "siege", "logistics"],        misaligned: ["nonlethal", "intrigue"] },
    hod:     { aligned: ["intrigue", "diplomacy", "softpower"],    misaligned: ["violence", "siege"] },
    yesod:   { aligned: ["intrigue", "soul", "faith"],             misaligned: ["violence", "siege"] },
    malkuth: { aligned: ["economy", "logistics", "body"],          misaligned: ["violence"] }
  };

  // Returns "aligned" | "misaligned" | "neutral".
  // - aligned: methodTag is in the spark's aligned list (or sephirah default)
  // - misaligned: methodTag is in the spark's misaligned list (or sephirah default)
  // - neutral: methodTag exists but isn't on either list (no special effect).
  // Empty/missing methodTag returns "neutral" — the gather is GM-curated, no auto-corruption.
  function checkMethodAlignment(methodTag, sparkItemOrFlagSpark) {
    const tag = String(methodTag ?? "").toLowerCase().trim();
    if (!tag) return "neutral";

    // Pull aligned/misaligned from the item's system data first; fall back to
    // sephirah defaults when arrays are empty.
    const sys = sparkItemOrFlagSpark?.system ?? sparkItemOrFlagSpark ?? {};
    let aligned    = Array.isArray(sys.alignedMethods)    ? sys.alignedMethods    : null;
    let misaligned = Array.isArray(sys.misalignedMethods) ? sys.misalignedMethods : null;
    if ((!aligned?.length || !misaligned?.length) && sys.sephirah) {
      const fallback = SEPHIRAH_METHOD_ALIGNMENT[sys.sephirah];
      if (fallback) {
        if (!aligned?.length)    aligned    = fallback.aligned;
        if (!misaligned?.length) misaligned = fallback.misaligned;
      }
    }
    aligned    ??= [];
    misaligned ??= [];

    if (aligned.map(s => String(s).toLowerCase()).includes(tag))    return "aligned";
    if (misaligned.map(s => String(s).toLowerCase()).includes(tag)) return "misaligned";
    return "neutral";
  }

  /* ----------------------------------------------------------------------- */
  /* Spark-item resolution (Phase A.5 of B3 — migration shim)                */
  /* ----------------------------------------------------------------------- */

  // Resolve a spark item from the bbttcc-tikkun.sparks pack. Accepts either
  // a full UUID ("Compendium.bbttcc-tikkun.sparks.Item.<id>"), a short item
  // id, or a stable identifier flag ("spark_chesed_conceptual"). Returns the
  // pack document or null. Cached per-call site at module scope to avoid
  // repeated index lookups during a single beat resolution.
  let _sparkPackIndexCache = null;
  async function _ensureSparkIndex() {
    if (_sparkPackIndexCache) return _sparkPackIndexCache;
    const pack = game.packs?.get("bbttcc-tikkun.sparks");
    if (!pack) return null;
    try {
      const idx = await pack.getIndex({ fields: ["name", "type", "img", "system.sephirah", "system.kind", "flags.bbttcc-tikkun.identifier"] });
      _sparkPackIndexCache = { pack, idx };
      return _sparkPackIndexCache;
    } catch (e) { return null; }
  }
  // Invalidate when the pack changes so authoring updates land without reload.
  Hooks.on("createItem",  (doc) => { if (doc?.pack === "bbttcc-tikkun.sparks") _sparkPackIndexCache = null; });
  Hooks.on("updateItem",  (doc) => { if (doc?.pack === "bbttcc-tikkun.sparks") _sparkPackIndexCache = null; });
  Hooks.on("deleteItem",  (doc) => { if (doc?.pack === "bbttcc-tikkun.sparks") _sparkPackIndexCache = null; });

  async function _resolveSparkItem(keyOrUuid) {
    if (!keyOrUuid) return null;
    const s = String(keyOrUuid);
    // Full UUID path
    if (s.startsWith("Compendium.")) {
      try { return await fromUuid(s); } catch { return null; }
    }
    const handle = await _ensureSparkIndex();
    if (!handle) return null;
    // Match by flag identifier or by short item id.
    const entry = handle.idx.find(e =>
      String(e.flags?.["bbttcc-tikkun"]?.identifier ?? "") === s ||
      String(e._id ?? "") === s
    );
    if (!entry) return null;
    try { return await handle.pack.getDocument(entry._id); } catch { return null; }
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

    // Phase A.5 enrichment — if the cfg.key matches a Sparks pack item, pull
    // authoritative metadata (sephirah/kind/img/alignedMethods/repair) from
    // the item so the flag record carries it forward. Pack-driven values
    // override caller-supplied defaults; explicit cfg keys still win.
    const item = sparkCfg.sparkUuid
      ? await _resolveSparkItem(sparkCfg.sparkUuid)
      : await _resolveSparkItem(key);
    const enriched = item ? {
      name:     sparkCfg.name     ?? item.name,
      kind:     sparkCfg.kind     ?? item.system?.kind     ?? null,
      sephirah: sparkCfg.sephirah ?? item.system?.sephirah ?? null,
      sparkUuid: sparkCfg.sparkUuid ?? item.uuid,
      img:      sparkCfg.img ?? item.img
    } : {};

    const map = _getSparkMap(actor);
    const s   = _ensureSpark(map, key, { ...sparkCfg, ...enriched, status: "gathered" });
    s.identified = true;
    s.acquired   = true;
    // Phase C of B3 — `corrupted` flag must propagate even when the spark
    // already exists in the map. _ensureSpark only seeds defaults on first
    // creation, so re-gathering a clean spark via a misaligned method must
    // explicitly flip the flag here.
    if (sparkCfg.corrupted && !s.corrupted) {
      s.corrupted = true;
      _pushHistory(s, {
        phase: "corrupted",
        note:  sparkCfg.corruptionReason || "Misaligned method on gather"
      });
    }

    _pushHistory(s, { phase: "gather", note: sparkCfg.note || "Spark gathered via gatherSpark()" });

    await _setSparkMap(actor, map);
    ui.notifications?.info?.(`${actor.name} gathered ${s.name}${s.corrupted ? " (Corrupted)" : ""}`);
    // Emit corruption from the CORE so EVERY gather path (direct API, not just
    // beats) propagates to the faction corruption gate. (Gauntlet finding #1.)
    if (s.corrupted) {
      try { Hooks.callAll("bbttcc:spark:corrupted", { actor, sparkKey: key, sparkItem: item, sephirah: s.sephirah ?? null, spark: s }); } catch (_e) {}
    }
    return s;
  }

  // Convenience: gather a spark by its pack-item UUID. Walks the pack item
  // for sephirah/kind/aligned-methods/etc., then routes to gatherSpark().
  // Used by the Phase B beat-driven listener so authors only need to supply
  // a sparkUuid in beat metadata.
  async function gatherSparkByItem(actorOrId, sparkUuidOrKey, extraCfg = {}) {
    const item = await _resolveSparkItem(sparkUuidOrKey);
    if (!item) throw new Error(`gatherSparkByItem: no spark resolves from "${sparkUuidOrKey}"`);
    const identifier = item.flags?.["bbttcc-tikkun"]?.identifier ?? item.id;
    return gatherSpark(actorOrId, {
      key:       extraCfg.key ?? identifier,
      name:      item.name,
      kind:      item.system?.kind ?? null,
      sephirah:  item.system?.sephirah ?? null,
      sparkUuid: item.uuid,
      img:       item.img,
      ...extraCfg
    });
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
    // Re-marking a spark corrupted (e.g. the beat-listener integrate path) must also
    // propagate to the faction corruption gate. (Gauntlet finding #1.)
    if (String(phase || "").toLowerCase() === "corrupted") {
      try { Hooks.callAll("bbttcc:spark:corrupted", { actor, sparkKey: s.key || key, sparkItem: null, sephirah: s.sephirah ?? null, spark: s }); } catch (_e) {}
    }
    return s;
  }

  // Simple phase helpers — these will get richer in later passes (costs/DCs).
  async function identifySpark(opts)           { return markSparkPhase({ ...opts, phase: "identified" }); }
  async function acquireSpark(opts)            { return markSparkPhase({ ...opts, phase: "acquired"   }); }
  async function integrateSparkCharacter(opts) { return markSparkPhase({ ...opts, phase: "integrated"  }); }

  /* ----------------------------------------------------------------------- */
  /* Phase E of B3 — Char→Faction deposit bridge                             */
  /* ----------------------------------------------------------------------- */
  // depositSpark is the explicit handover step. The character must have
  // personally integrated the spark first AND the spark must NOT be
  // corrupted (run repair first if so). On commit:
  //   • Marks the character spark as `deposited: true`.
  //   • Calls the faction-level `integrateSpark(factionId, sparkKey, count: 1)`
  //     which writes the three faction storage formats + war-log entry.
  //   • Fires `bbttcc:spark:deposited` for downstream listeners.
  async function depositSpark({ actorId, sparkKey, factionId, note = "" } = {}) {
    const actor = _asActor(actorId);
    if (!actor) throw new Error("depositSpark: actor not found");
    const map = _getSparkMap(actor);
    const s   = map[sparkKey] || Object.values(map).find(x => x.key === sparkKey);
    if (!s) throw new Error(`depositSpark: spark "${sparkKey}" not found on ${actor.name}`);
    if (!s.integrated) throw new Error(`depositSpark: ${s.name ?? sparkKey} is not yet integrated personally`);
    if (s.corrupted)   throw new Error(`depositSpark: ${s.name ?? sparkKey} is corrupted — run a repair ritual first`);
    if (s.deposited)   throw new Error(`depositSpark: ${s.name ?? sparkKey} is already deposited`);

    // Resolve faction. Caller can override; default = actor's flag.
    const fid = factionId || actor.getFlag?.("bbttcc-factions", "factionId");
    if (!fid) throw new Error("depositSpark: no faction linked to actor");
    const faction = game.actors?.get(fid);
    if (!faction) throw new Error(`depositSpark: faction ${fid} not found`);

    // Faction-level integration write. Faction-side function lives in
    // tikkun-sparks.enhancer.js and writes all three storage shapes.
    const sephKey = String(s.sephirah || sparkKey).toLowerCase();
    const factionApi = game?.bbttcc?.api?.tikkun?.integrateSpark;
    if (typeof factionApi === "function") {
      try {
        await factionApi({ factionId: fid, key: sephKey, count: 1 });
      } catch (e) {
        // Don't strand the deposit — log and continue with the character flip.
        console.warn("[bbttcc-tikkun/api] faction integrateSpark failed during deposit:", e);
      }
    }

    s.deposited = true;
    _pushHistory(s, { phase: "deposited", note: note || `Deposited to ${faction.name}` });
    await _setSparkMap(actor, map);

    try {
      Hooks.callAll("bbttcc:spark:deposited", {
        actor, sparkKey, sephirah: sephKey, factionId: fid, faction, spark: s
      });
    } catch (e) { /* listeners isolated */ }

    ui.notifications?.info?.(`${actor.name} deposited ${s.name} to ${faction.name}.`);

    // Chat narration — visible so the table sees the handover land.
    const sephLabel = (game.fourththing?.constants?.SEPHIROTH?.[sephKey]?.label ?? sephKey);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker?.({ actor }) ?? {},
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#6fcf97">✦ Spark Deposited: ${s.name}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem">${actor.name} hands the <i>${sephLabel}</i> spark over to <b>${faction.name}</b>. The Great Work absorbs it; the faction's count rises.</p>
      </div>`
    });

    return s;
  }

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

  /** Phase A.1 — aggregate integrated sparks from all characters of this faction. */
  function aggregateCharacterSparksForFaction(fid) {
    const factionId = String(fid || "");
    if (!factionId || !game.actors) return 0;
    let count = 0;

    try {
      for (const A of game.actors.contents ?? []) {
        if (String(A.type || "").toLowerCase() !== "character") continue;

        // Basic belonging: by bbttcc-factions.factionId flag (primary)
        const fFlag = A.getFlag(MODF, "factionId");
        if (!fFlag || String(fFlag) !== factionId) continue;

        const sparkMap = _getSparkMap(A);
        for (const s of Object.values(sparkMap)) {
          // Corrupted sparks must NOT count toward Great-Work readiness — corruption
          // is the central cost/risk; a tainted spark in an operative's hands is not
          // progress until it's repaired (then re-deposited). (Gauntlet finding #1+#2,
          // 2026-06-07: corrupted+integrated sparks were inflating sparkCount.)
          if (s && (s.integrated || String(s.status || "").toLowerCase() === "integrated") && !s.corrupted) {
            count++;
          }
        }
      }
    } catch (e) {
      console.warn(TAG, "aggregateCharacterSparksForFaction failed for", factionId, e);
    }

    return count;
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

    // NEW: character-side sparks
    const charSparkCount  = aggregateCharacterSparksForFaction(F.id);

    const sparkCount      = Math.max(sparkCountByMap, sparkCountByArr, charSparkCount);

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
      API.gatherSparkByItem               = gatherSparkByItem;
      API.resolveSparkItem                = _resolveSparkItem;
      API.checkMethodAlignment            = checkMethodAlignment;
      API.SEPHIRAH_METHOD_ALIGNMENT       = SEPHIRAH_METHOD_ALIGNMENT;
      API.getAllSparks                    = getAllSparks;

      API.createConstellationForActor     = createConstellationForActor;
      API.markSparkPhase                  = markSparkPhase;
      API.identifySpark                   = identifySpark;
      API.acquireSpark                    = acquireSpark;
      API.integrateSparkCharacter         = integrateSparkCharacter;
      API.depositSpark                    = depositSpark;

      API.getGreatWorkState               = getGreatWorkState;
      API.getGreatWorkStateForAllFactions = getGreatWorkStateForAllFactions;

      console.log(TAG, "API ready (installAPI):", Object.keys(API));
    } catch (e) {
      console.warn(TAG, "installAPI failed:", e);
    }
  }

  Hooks.once("ready", installAPI);
  try { if (game?.ready) installAPI(); } catch {}

})();
