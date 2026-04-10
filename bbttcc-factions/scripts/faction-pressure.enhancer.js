// modules/bbttcc-factions/scripts/faction-pressure.enhancer.js
// BBTTCC — Pressure Flags (Overextension/Upkeep/Risk) writer
// Reviewed for faction-sheet cleanup sprint: data writer only; retained by design.
//
// Reads:
// - flags.bbttcc-factions.logistics.band          (Turn Driver)  :contentReference[oaicite:0]{index=0}
// - flags.bbttcc-factions.warLogs[] entries with activity:"garrison_upkeep" and unpaid:true|false
//   (Garrison Upkeep Engine)                      :contentReference[oaicite:1]{index=1}
//
// Writes:
// - flags.bbttcc-factions.pressure = {
//     overextensionBand, unpaidUpkeep, risk, logisticsBand, updatedTs, source
//   }
//
// Non-invasive: does not change any math or penalties — only surfaces truth.
// This file does not inject sheet UI and is safe to keep during tab/layout refactors.

(() => {
  const TAG  = "[bbttcc-factions/pressure]";
  const MODF = "bbttcc-factions";

  const getProp = (o, p, d) => {
    try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; }
  };

  function isFactionActor(a) {
    try { return a?.getFlag?.(MODF, "isFaction") === true; } catch { return false; }
  }

  // Robust reader: tolerate legacy accidental nesting under flags.bbttcc-factions.bbttcc-factions.*
  function readFactionFlags(actor) {
    const root = actor?.flags?.[MODF] ?? {};
    const nested = (root && typeof root === "object") ? (root[MODF] ?? null) : null;
    return { root, nested };
  }

  function readWarLogs(actor) {
    const { root, nested } = readFactionFlags(actor);
    const a = Array.isArray(root?.warLogs) ? root.warLogs : null;
    if (a) return a;
    const b = Array.isArray(nested?.warLogs) ? nested.warLogs : null;
    if (b) return b;
    const c = actor?.getFlag?.(MODF, "warLogs");
    return Array.isArray(c) ? c : [];
  }

  function readLogisticsBand(actor) {
    const { root, nested } = readFactionFlags(actor);
    const a = root?.logistics?.band;
    if (a != null) return String(a);
    const b = nested?.logistics?.band;
    if (b != null) return String(b);
    const c = actor?.getFlag?.(MODF, "logistics");
    return String(c?.band || "stable");
  }

  function bandToNum(band) {
    const k = String(band || "").toLowerCase();
    // Turn Driver bands: stable, stretched, overextended, strained, critical :contentReference[oaicite:2]{index=2}
    if (k === "stable") return 0;
    if (k === "stretched") return 1;
    if (k === "overextended") return 2;
    if (k === "strained") return 3;
    if (k === "critical") return 3;
    return 0;
  }

  function bandToRisk(n) {
    if (n >= 3) return "high";
    if (n === 2) return "medium";
    return "low";
  }

  function detectUnpaidUpkeepFromWarLogs(actor) {
    // Garrison Upkeep Engine writes:
    // { activity:"garrison_upkeep", unpaid:true|false, ... } :contentReference[oaicite:3]{index=3}
    const warLogs = readWarLogs(actor);

    const last = [...warLogs].reverse().find(e => {
      const act = String(e?.activity || "").toLowerCase();
      return act === "garrison_upkeep";
    });

    return {
      unpaidUpkeep: !!last?.unpaid,
      lastUpkeepTs: last?.ts ?? null
    };
  }

  async function writePressureForAll() {
    const facs = (game.actors?.contents ?? []).filter(isFactionActor);
    if (!facs.length) return;

    const updates = [];
    for (const A of facs) {
      const logisticsBand = readLogisticsBand(A);
      const bandNum = bandToNum(logisticsBand);

      const { unpaidUpkeep, lastUpkeepTs } = detectUnpaidUpkeepFromWarLogs(A);

      // Risk escalates if upkeep is unpaid, regardless of overextension band.
      const risk = unpaidUpkeep ? "high" : bandToRisk(bandNum);

      const pressure = {
        overextensionBand: bandNum,
        unpaidUpkeep,
        risk,
        logisticsBand: String(logisticsBand),
        lastUpkeepTs,
        updatedTs: Date.now(),
        source: "turn-driver.logistics + garrison_upkeep.warLogs"
      };

      updates.push(A.update({ [`flags.${MODF}.pressure`]: pressure }));
    }

    if (updates.length) await Promise.allSettled(updates);
  }

  Hooks.once("ready", () => {
    Hooks.on("bbttcc:advanceTurn:end", async (...args) => {
      try {
        // Defer one tick so garrison upkeep + facility effects + war logs settle first.
        await new Promise(resolve => setTimeout(resolve, 0));
        await writePressureForAll();
      } catch (e) {
        console.warn(TAG, "pressure write failed:", e);
      }
    });

    console.log(TAG, "installed (bbttcc:advanceTurn:end, deferred).");
  });
})();
