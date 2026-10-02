// modules/bbttcc-factions/scripts/faction-pressure.enhancer.js
// Bad Eden — Pressure Flags (Overextension/Upkeep/Risk) writer
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
    // One number per Turn Driver band (2026-09-08): strained and critical used
    // to share 3, and the Assets chip labelled 3 "CRITICAL" — so a STRAINED
    // faction read CRITICAL in one chip and STRAINED in the banner beside it.
    if (k === "stable") return 0;
    if (k === "stretched") return 1;
    if (k === "overextended") return 2;
    if (k === "strained") return 3;
    if (k === "critical") return 4;
    return 0;
  }

  function bandToRisk(n) {
    if (n >= 3) return "high";      // strained, critical
    if (n === 2) return "medium";   // overextended
    return "low";
  }

  function detectUnpaidUpkeepFromWarLogs(actor, sinceTs = null) {
    // Garrison Upkeep Engine writes:
    // { activity:"garrison_upkeep", unpaid:true|false, ... } :contentReference[oaicite:3]{index=3}
    const warLogs = readWarLogs(actor);

    const last = [...warLogs].reverse().find(e => {
      const act = String(e?.activity || "").toLowerCase();
      return act === "garrison_upkeep";
    });

    // Only an entry written by THIS turn's upkeep run counts: the upkeep engine writes
    // nothing for a faction with no conquest-state hexes, so an old unpaid entry would
    // otherwise stay "current" forever.
    const current = (sinceTs == null) || (Number(last?.ts ?? 0) >= sinceTs);

    return {
      unpaidUpkeep: current && !!last?.unpaid,
      lastUpkeepTs: last?.ts ?? null
    };
  }

  async function writePressureForAll(sinceTs = null) {
    const facs = (game.actors?.contents ?? []).filter(isFactionActor);
    if (!facs.length) return;

    const updates = [];
    for (const A of facs) {
      const logisticsBand = readLogisticsBand(A);
      const bandNum = bandToNum(logisticsBand);

      const { unpaidUpkeep, lastUpkeepTs } = detectUnpaidUpkeepFromWarLogs(A, sinceTs);

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

  // Pressure must be computed AFTER garrison upkeep, which runs in an advanceTurn
  // WRAPPER after the driver has already fired bbttcc:advanceTurn:end — so listening
  // to that hook always read last turn's upkeep. Instead wrap territory.advanceTurn
  // OUTERMOST (installed one tick after ready, once every ready-time wrapper is in),
  // write pressure after the whole turn resolves, then fire bbttcc:pressure:written
  // (the tier-stability counter listens for it). 2026-10-01.
  function install() {
    const terr = game.bbttcc?.api?.territory;
    if (!terr || typeof terr.advanceTurn !== "function") {
      console.warn(TAG, "territory.advanceTurn not found; pressure writer not installed.");
      return;
    }
    if (terr.__bbttccPressureWrapped) return;
    const base = terr.advanceTurn.bind(terr);
    terr.advanceTurn = async function advanceTurnPressureWrapped(args = {}) {
      const t0 = Date.now();
      const res = await base(args);
      try {
        // Apply turns only, on the GM; a skipped (turn-locked) or failed turn writes nothing.
        if (game.user?.isGM && args?.apply && !res?.skipped && !res?.error) {
          await writePressureForAll(t0);
          Hooks.callAll("bbttcc:pressure:written", { apply: true, sinceTs: t0 });
        }
      } catch (e) {
        console.warn(TAG, "pressure write failed:", e);
      }
      return res;
    };
    terr.__bbttccPressureWrapped = true;
    console.log(TAG, "installed (outermost advanceTurn wrapper).");
  }

  Hooks.once("ready", () => { setTimeout(install, 0); });
})();
