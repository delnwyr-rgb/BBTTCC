/* REVIEW NOTE: Tier victory gate enhancer is progression snapshot logic and intentionally retained during faction-sheet layout cleanup. */
// modules/bbttcc-factions/scripts/faction-tier-victorygate.enhancer.js
// BBTTCC — Victory Badge → Tier Eligibility (Identity gate)
//
// Reads:
//   flags.bbttcc-factions.victory.badge.key   (or victory.badgeKey)
// Writes:
//   flags.bbttcc-factions.progression.victory = {
//     badgeKey,
//     tierFromBadge,
//     requiredBadgeForNextTier,
//     meetsNextTier,
//     updatedTs
//   }
//
// Optional behavior (safe default):
// - If flags.bbttcc-factions.tier is missing/undefined, it sets tier = tierFromBadge.
// - If tier already exists, it does NOT overwrite it.
//   (So future tier criteria can supersede badge mapping cleanly.)
//
// Badge keys come from your Victory enhancer’s badgeFor() mapping:
//   emerging, rising, dominant, transcendent, ascendant :contentReference[oaicite:1]{index=1}

(() => {
  const TAG  = "[bbttcc-factions/victory-tiergate]";
  const MODF = "bbttcc-factions";

  const get = (o, p, d) => {
    try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; }
  };

  function isFactionActor(a) {
    try { return a?.getFlag?.(MODF, "isFaction") === true; } catch { return false; }
  }

  function readBadgeKey(actor) {
    // Support both styles used in your codebase.
    const k1 = String(get(actor, `flags.${MODF}.victory.badge.key`, "") || "").trim();
    const k2 = String(get(actor, `flags.${MODF}.victory.badgeKey`, "") || "").trim();
    return String((k1 || k2 || "emerging")).toLowerCase();
  }

  // Badge → Tier mapping (authoritative for Identity gate; not the whole tier system)
  function tierFromBadge(badgeKey) {
    // emerging/rising/dominant/transcendent/ascendant :contentReference[oaicite:2]{index=2}
    switch (String(badgeKey || "").toLowerCase()) {
      case "rising":       return 1;
      case "dominant":     return 2;
      case "transcendent": return 3;
      case "ascendant":    return 4;
      case "emerging":
      default:             return 0;
    }
  }

  // Required badge key to satisfy the “Identity” gate for each tier-up
  function requiredBadgeForNextTier(curTier) {
    // Design lock we set:
    // T0→T1 requires Rising
    // T1→T2 requires Dominant
    // T2→T3 requires Transcendent
    // T3→T4 requires Ascendant
    const t = Number(curTier ?? 0);
    if (t <= 0) return "rising";
    if (t === 1) return "dominant";
    if (t === 2) return "transcendent";
    if (t === 3) return "ascendant";
    return null; // already at T4
  }

  function meetsRequiredBadge(badgeKey, requiredKey) {
    if (!requiredKey) return true;

    const order = ["emerging", "rising", "dominant", "transcendent", "ascendant"];
    const have = order.indexOf(String(badgeKey || "").toLowerCase());
    const need = order.indexOf(String(requiredKey || "").toLowerCase());
    if (need < 0) return false;
    if (have < 0) return false;
    return have >= need;
  }

  async function applyVictoryEligibilitySnapshot(actor) {
    const badgeKey = readBadgeKey(actor);

    // Current tier (if unset, treat as derived from badge for snapshot purposes)
    const curTierRaw = get(actor, `flags.${MODF}.tier`, null);
    const curTier = (curTierRaw === null || curTierRaw === undefined)
      ? tierFromBadge(badgeKey)
      : Math.max(0, Math.min(4, Math.floor(Number(curTierRaw) || 0)));

    const requiredKey = requiredBadgeForNextTier(curTier);
    const meetsNext = meetsRequiredBadge(badgeKey, requiredKey);

    const snapshot = {
      badgeKey,
      tierFromBadge: tierFromBadge(badgeKey),
      requiredBadgeForNextTier: requiredKey,
      meetsNextTier: meetsNext,
      updatedTs: Date.now()
    };

    const patch = {
      [`flags.${MODF}.progression.victory`]: snapshot
    };

    // Optional: set tier only if missing (do not override manual tier)
    if (curTierRaw === null || curTierRaw === undefined) {
      patch[`flags.${MODF}.tier`] = snapshot.tierFromBadge;
    }

    await actor.update(patch, { diff: true, recursive: true });
  }

  async function runForAllFactions() {
    const facs = (game.actors?.contents ?? []).filter(isFactionActor);
    if (!facs.length) return;
    await Promise.allSettled(facs.map(a => applyVictoryEligibilitySnapshot(a)));
  }

  Hooks.once("ready", () => {
    // End-of-turn is where badges/VP are most likely to have just changed.
    Hooks.on("bbttcc:advanceTurn:end", async () => {
      try {
        // Defer one tick to ensure victory/badge enhancers have finished writing first.
        await new Promise(r => setTimeout(r, 0));
        await runForAllFactions();
      } catch (e) {
        console.warn(TAG, "tier eligibility update failed:", e);
      }
    });

    // Also update when a faction actor's victory flag changes (manual edits or scripts).
    Hooks.on("updateActor", async (actor, data) => {
      try {
        if (!isFactionActor(actor)) return;
        const touchedVictory =
          foundry.utils.hasProperty(data, `flags.${MODF}.victory`) ||
          foundry.utils.hasProperty(data, `flags.${MODF}.victory.badge`) ||
          foundry.utils.hasProperty(data, `flags.${MODF}.victory.badgeKey`);
        if (!touchedVictory) return;

        await applyVictoryEligibilitySnapshot(actor);
      } catch (e) {
        console.warn(TAG, "updateActor victory hook failed:", e);
      }
    });

    console.log(TAG, "installed");
  });
})();
