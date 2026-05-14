/* REVIEW NOTE: Tier stability enhancer is progression-state logic and intentionally retained during faction-sheet layout cleanup. */
// modules/bbttcc-factions/scripts/faction-tier-stability.enhancer.js
// BBTTCC — Tier Advancement: Stability Counters (v1.0)
//
// Writes deterministic, actor-only stability progress for tier advancement.
//
// Updates (per Apply turn):
//   flags.bbttcc-factions.progression.stability = {
//     stableTurns,            // consecutive Apply turns with unpaidUpkeep === false
//     maxOverextDuringSpan,   // highest overextensionBand observed during the current stable span
//     lastApplyTs,
//     lastUnpaidTs
//   }
//
// Reads:
//   flags.bbttcc-factions.pressure = { unpaidUpkeep, overextensionBand, ... }
// (pressure is written by faction-pressure.enhancer.js)

(() => {
  const TAG  = "[bbttcc-factions/tier-stability]";
  const MODF = "bbttcc-factions";

  const get = (o, p, d) => {
    try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; }
  };

  function isFactionActor(a) {
    try { return a?.getFlag?.(MODF, "isFaction") === true; } catch { return false; }
  }

  function clampInt(n, min, max) {
    n = Math.floor(Number(n ?? 0) || 0);
    return Math.max(min, Math.min(max, n));
  }

  function readPressure(actor) {
    const p = get(actor, `flags.${MODF}.pressure`, {}) || {};
    return {
      unpaidUpkeep: !!p.unpaidUpkeep,
      overextensionBand: clampInt(p.overextensionBand, 0, 3),
      updatedTs: Number(p.updatedTs ?? 0) || 0
    };
  }

  async function applyStabilityUpdate(actor) {
    const pressure = readPressure(actor);

    const cur = get(actor, `flags.${MODF}.progression.stability`, {}) || {};
    const prevStable = clampInt(cur.stableTurns, 0, 9999);
    const prevMaxOver = clampInt(cur.maxOverextDuringSpan, 0, 3);

    const now = Date.now();

    let stableTurns = prevStable;
    let maxOverextDuringSpan = prevMaxOver;
    let lastUnpaidTs = cur.lastUnpaidTs ?? null;

    if (pressure.unpaidUpkeep) {
      // Failure resets the streak.
      stableTurns = 0;
      maxOverextDuringSpan = 0;
      lastUnpaidTs = now;
    } else {
      // Paid this turn: extend streak and track worst band during the streak.
      stableTurns = prevStable + 1;
      maxOverextDuringSpan = Math.max(prevMaxOver, pressure.overextensionBand);
    }

    const patch = {
      stableTurns,
      maxOverextDuringSpan,
      lastApplyTs: now,
      lastUnpaidTs
    };

    await actor.update({ [`flags.${MODF}.progression.stability`]: patch }, { diff: true, recursive: true });
  }

  async function runForAllFactions() {
    const facs = (game.actors?.contents ?? []).filter(isFactionActor);
    if (!facs.length) return;
    await Promise.allSettled(facs.map(a => applyStabilityUpdate(a)));
  }

  Hooks.once("ready", () => {
    Hooks.on("bbttcc:advanceTurn:end", async (ctx) => {
      try {
        // Only advance stability counters on Apply turns if ctx.apply is provided.
        if (ctx && typeof ctx === "object" && "apply" in ctx && !ctx.apply) return;

        // Defer one tick so pressure/unpaid flags are already written.
        await new Promise(r => setTimeout(r, 0));
        await runForAllFactions();
      } catch (e) {
        console.warn(TAG, "stability update failed:", e);
      }
    });

    console.log(TAG, "installed (bbttcc:advanceTurn:end, Apply-only, deferred).");
  });
})();
