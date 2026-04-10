/* REVIEW NOTE: Tier advancement API is engine/read-only and intentionally retained during faction-sheet layout cleanup. */
// modules/bbttcc-factions/scripts/faction-tier-advancement-api.enhancer.js
// BBTTCC — Tier Advancement Read-Only API (v1.1)
//
// Exposes:
//   game.bbttcc.api.factions.getTierAdvancementReport(factionIdOrActor)
//   game.bbttcc.api.factions.canAdvanceTier(factionIdOrActor) -> boolean
//
// Read-only: does NOT mutate tier.
// Uses:
// - flags.bbttcc-factions.progression.victory  (Identity gate, from victory-tiergate enhancer)
// - flags.bbttcc-factions.pressure             (Snapshot stability + overext band)
// - flags.bbttcc-factions.progression.stability (Stability counters, from tier-stability enhancer)
// - Territory scan (Reach gate): owned hex count + integration progress
//
// Notes:
// - Stability is primarily evaluated from progression.stability.* (consecutive paid turns).
// - If pressure.unpaidUpkeep is true on the current turn, stability fails immediately (safety).

(() => {
  const TAG  = "[bbttcc-factions/tier-advancement-api]";
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";

  const get = (o, p, d) => {
    try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; }
  };

  function isFactionActor(a) {
    try { return a?.getFlag?.(MODF, "isFaction") === true; } catch { return false; }
  }

  async function resolveFactionActor(idOrActor) {
    if (!idOrActor) return null;
    if (idOrActor?.documentName === "Actor") return idOrActor;

    const s = String(idOrActor);
    if (!s) return null;

    try {
      if (s.startsWith("Actor.")) return await fromUuid(s);
      return game.actors?.get?.(s) ?? null;
    } catch {
      return null;
    }
  }

  // -------- Tier thresholds (v1.1) --------
  // Stability now uses: minStableTurns + maxOverextDuringSpan (from progression.stability)
  const TIER_REQ = {
    // T0 -> T1
    0: {
      nextTier: 1,
      reach: { minHexes: 2, minHexesAtOrAbove: { progress: 3, count: 1 } },
      stability: { minStableTurns: 2, maxOverextDuringSpan: 1 },
      identity: { requiresVictoryMeetsNextTier: true }
    },
    // T1 -> T2
    1: {
      nextTier: 2,
      reach: { minHexes: 4, minAvgIntegration: 3 },
      stability: { minStableTurns: 3, maxOverextDuringSpan: 1 },
      identity: { requiresVictoryMeetsNextTier: true }
    },
    // T2 -> T3
    2: {
      nextTier: 3,
      reach: { minHexes: 7, minHexesAtOrAbove: { progress: 5, count: 2 } },
      stability: { minStableTurns: 4, maxOverextDuringSpan: 1 },
      identity: { requiresVictoryMeetsNextTier: true }
    },
    // T3 -> T4 (Mythic ramp: allow span to touch STRAINED)
    3: {
      nextTier: 4,
      reach: { minHexes: 10, minHexesAtOrAbove: { progress: 6, count: 1 } },
      stability: { minStableTurns: 5, maxOverextDuringSpan: 2 },
      identity: { requiresVictoryMeetsNextTier: true }
    }
  };

  function clampTier(n) {
    const t = Math.floor(Number(n ?? 0) || 0);
    return Math.max(0, Math.min(4, t));
  }

  function readTier(actor) {
    const raw = get(actor, `flags.${MODF}.tier`, null);
    if (raw === null || raw === undefined) {
      const snap = get(actor, `flags.${MODF}.progression.victory`, null);
      if (snap && Number.isFinite(Number(snap.tierFromBadge))) return clampTier(snap.tierFromBadge);
      return 0;
    }
    return clampTier(raw);
  }

  // -------- Reach: scan owned hex drawings --------
  function isHexDrawing(dr) {
    const tf = dr?.flags?.[MODT] ?? {};
    if (tf.isHex === true || tf.kind === "territory-hex") return true;
    const pts = dr?.shape?.points;
    if (dr?.shape?.type === "p" && Array.isArray(pts) && pts.length === 12) return true;
    return false;
  }

  function ownedByFaction(tf, factionId, factionName) {
    const ownerId = String(tf?.factionId || tf?.ownerId || "");
    const ownerName = String(tf?.faction || tf?.ownerName || "");
    if (ownerId && ownerId === String(factionId)) return true;
    if (ownerName && factionName && ownerName.trim() === String(factionName).trim()) return true;
    return false;
  }

  function integrationProgress(tf) {
    const p = Number(tf?.integration?.progress ?? 0);
    return Number.isFinite(p) ? p : 0;
  }

  function scanTerritoryReach(factionActor) {
    const fid = factionActor.id;
    const fname = factionActor.name;

    let total = 0;
    let sumProg = 0;
    const progressCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };

    for (const sc of (game.scenes?.contents ?? [])) {
      for (const dr of (sc.drawings?.contents ?? [])) {
        if (!isHexDrawing(dr)) continue;
        const tf = dr.flags?.[MODT] ?? {};
        if (!ownedByFaction(tf, fid, fname)) continue;

        total++;
        const prog = Math.max(0, Math.min(6, Math.round(integrationProgress(tf))));
        sumProg += prog;
        progressCounts[prog] = (progressCounts[prog] || 0) + 1;
      }
    }

    const avg = total ? (sumProg / total) : 0;

    const countAtOrAbove = (n) => {
      let c = 0;
      for (let i=n; i<=6; i++) c += (progressCounts[i] || 0);
      return c;
    };

    return {
      totalHexes: total,
      avgIntegration: Number(avg.toFixed(2)),
      progressCounts,
      countAtOrAbove
    };
  }

  // -------- Stability + Identity snapshots --------
  function readPressure(actor) {
    const p = get(actor, `flags.${MODF}.pressure`, {}) || {};
    return {
      overextensionBand: Number(p.overextensionBand || 0),
      unpaidUpkeep: !!p.unpaidUpkeep,
      risk: String(p.risk || "low"),
      logisticsBand: String(p.logisticsBand || ""),
      lastUpkeepTs: p.lastUpkeepTs ?? null
    };
  }

  function readVictorySnapshot(actor) {
    const v = get(actor, `flags.${MODF}.progression.victory`, {}) || {};
    return {
      badgeKey: String(v.badgeKey || ""),
      tierFromBadge: Number(v.tierFromBadge ?? 0),
      requiredBadgeForNextTier: v.requiredBadgeForNextTier ?? null,
      meetsNextTier: !!v.meetsNextTier,
      updatedTs: v.updatedTs ?? null
    };
  }

  function readStabilityProgress(actor) {
    const s = get(actor, `flags.${MODF}.progression.stability`, {}) || {};
    return {
      stableTurns: Number(s.stableTurns ?? 0) || 0,
      maxOverextDuringSpan: Number(s.maxOverextDuringSpan ?? 0) || 0,
      lastApplyTs: s.lastApplyTs ?? null,
      lastUnpaidTs: s.lastUnpaidTs ?? null
    };
  }

  function evalReach(reach, req) {
    const reasons = [];
    let ok = true;

    if (req.minHexes != null && reach.totalHexes < req.minHexes) {
      ok = false;
      reasons.push(`Need ≥${req.minHexes} hexes (have ${reach.totalHexes}).`);
    }

    if (req.minAvgIntegration != null && reach.avgIntegration < req.minAvgIntegration) {
      ok = false;
      reasons.push(`Need avg integration ≥${req.minAvgIntegration} (have ${reach.avgIntegration}).`);
    }

    if (req.minHexesAtOrAbove) {
      const needProg = Number(req.minHexesAtOrAbove.progress || 0);
      const needCnt  = Number(req.minHexesAtOrAbove.count || 0);
      const haveCnt  = reach.countAtOrAbove(needProg);
      if (haveCnt < needCnt) {
        ok = false;
        reasons.push(`Need ≥${needCnt} hexes at integration ${needProg}+ (have ${haveCnt}).`);
      }
    }

    return { ok, reasons };
  }

  function evalStability(pressure, stabilityProg, req) {
    const reasons = [];
    let ok = true;

    // Immediate fail-safe: if unpaid this turn, you're not stable.
    if (pressure.unpaidUpkeep) {
      ok = false;
      reasons.push("Unpaid upkeep detected this turn.");
    }

    const needTurns = Number(req.minStableTurns ?? 0) || 0;
    const haveTurns = Number(stabilityProg.stableTurns ?? 0) || 0;
    if (needTurns > 0 && haveTurns < needTurns) {
      ok = false;
      reasons.push(`Need ${needTurns} consecutive paid turns (have ${haveTurns}).`);
    }

    const allowedMax = Number(req.maxOverextDuringSpan ?? 999) || 999;
    const haveMax = Number(stabilityProg.maxOverextDuringSpan ?? 0) || 0;
    if (haveMax > allowedMax) {
      ok = false;
      reasons.push(`Overextension too high during stability span (max band ${haveMax}, allowed ${allowedMax}).`);
    }

    return { ok, reasons };
  }

  function evalIdentity(victorySnap, req) {
    const reasons = [];
    let ok = true;

    if (req.requiresVictoryMeetsNextTier && !victorySnap.meetsNextTier) {
      ok = false;
      reasons.push(
        `Victory badge gate not met (need ${victorySnap.requiredBadgeForNextTier || "?"}, have ${victorySnap.badgeKey || "?"}).`
      );
    }

    return { ok, reasons };
  }

  async function getTierAdvancementReport(factionIdOrActor) {
    const actor = await resolveFactionActor(factionIdOrActor);
    if (!actor) return { ok: false, error: "Faction not found" };
    if (!isFactionActor(actor)) return { ok: false, error: "Actor is not a faction", actorId: actor.id };

    const tier = readTier(actor);
    const req = TIER_REQ[tier];

    if (!req) {
      return {
        ok: true,
        actorId: actor.id,
        actorName: actor.name,
        tier,
        nextTier: null,
        canAdvance: false,
        reason: "No requirements defined (already at max tier or tier config missing)."
      };
    }

    const reach = scanTerritoryReach(actor);
    const pressure = readPressure(actor);
    const victory = readVictorySnapshot(actor);
    const stabilityProg = readStabilityProgress(actor);

    const reachRes = evalReach(reach, req.reach);
    const stabRes  = evalStability(pressure, stabilityProg, req.stability);
    const idRes    = evalIdentity(victory, req.identity);

    const canAdvance = reachRes.ok && stabRes.ok && idRes.ok;

    return {
      ok: true,
      actorId: actor.id,
      actorName: actor.name,
      tier,
      nextTier: req.nextTier,
      canAdvance,
      gates: {
        reach: {
          ok: reachRes.ok,
          reasons: reachRes.reasons,
          snapshot: reach
        },
        stability: {
          ok: stabRes.ok,
          reasons: stabRes.reasons,
          snapshot: {
            ...pressure,
            ...stabilityProg
          }
        },
        identity: {
          ok: idRes.ok,
          reasons: idRes.reasons,
          snapshot: victory
        }
      }
    };
  }

  async function canAdvanceTier(factionIdOrActor) {
    const rep = await getTierAdvancementReport(factionIdOrActor);
    return !!rep?.canAdvance;
  }

  Hooks.once("ready", () => {
    try {
      game.bbttcc ??= {};
      game.bbttcc.api ??= {};
      game.bbttcc.api.factions ??= {};

      game.bbttcc.api.factions.getTierAdvancementReport ??= getTierAdvancementReport;
      game.bbttcc.api.factions.canAdvanceTier ??= canAdvanceTier;

      console.log(TAG, "API ready: game.bbttcc.api.factions.{getTierAdvancementReport, canAdvanceTier}");
    } catch (e) {
      console.warn(TAG, "API wiring failed:", e);
    }
  });
})();
