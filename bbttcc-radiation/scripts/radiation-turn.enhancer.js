// modules/bbttcc-radiation/scripts/radiation-turn.enhancer.js
// BBTTCC — Radiation Turn Enhancer (R2)
// Per-turn RP changes for factions & PCs/NPCs based on scene zone + hex radiation.
//
// Design:
//  - Factions: full RP from Zone + Hex radiation (stacked).
//  - PCs/NPCs: half RP (floored). If in a fully safe area, −1 RP (rest/detox).
//  - No actor↔faction syncing (avoids loops). They both respond to environment.
//  - Active scene only (matches overlay + most GM focus).

(() => {
  const TAG      = "[bbttcc-radiation/turn]";
  const MODF     = "bbttcc-factions";
  const MODT     = "bbttcc-territory";

  const gmIds = () => game.users?.filter(u => u.isGM).map(u => u.id) ?? [];

  function zoneIntensityToAmount(intensity) {
    const k = String(intensity || "none").toLowerCase();
    switch (k) {
      case "low":      return 0.5;
      case "moderate": return 1;
      case "high":     return 2;
      case "storm":    return 3;
      case "none":
      default:         return 0;
    }
  }

  function drawingContainsPoint(d, x, y) {
    try {
      if (typeof d.containsPoint === "function") {
        return d.containsPoint(new PIXI.Point(x, y));
      }
      const b = d.bounds;
      if (!b) return false;
      return b.contains(x, y);
    } catch {
      return false;
    }
  }

  function findHexAtPoint(x, y) {
    const list = canvas?.drawings?.placeables ?? [];
    for (const d of list) {
      const tf = d.document.flags?.[MODT];
      if (!tf) continue;
      if (drawingContainsPoint(d, x, y)) return d;
    }
    return null;
  }

  async function handleAdvanceTurnEnd() {
    try {
      const radApi = game.bbttcc?.api?.radiation;
      if (!radApi || typeof radApi.get !== "function" || typeof radApi.add !== "function") {
        console.warn(TAG, "Radiation API not ready; skipping per-turn actor pass.");
        return;
      }

      const zoneApi = game.bbttcc?.api?.radiation?.zone;
      const scene   = canvas?.scene;
      if (!scene) return;

      const zone   = zoneApi && typeof zoneApi.getScene === "function"
        ? zoneApi.getScene(scene)
        : null;
      const zInt   = zone?.intensity || "none";
      const zBase  = zoneIntensityToAmount(zInt);

      const tokens = canvas.tokens?.placeables ?? [];
      if (!tokens.length) return;

      const gm = gmIds();
      const lines = [];

      for (const token of tokens) {
        const actor = token.actor;
        if (!actor) continue;

        const isFaction = actor.getFlag?.(MODF, "isFaction") === true;
        const isPCOrNPC = !isFaction && (actor.type === "character" || actor.type === "npc");
        if (!isFaction && !isPCOrNPC) continue;

        // --- Zone exposure ---
        let zoneAmt = 0;
        if (zBase > 0) {
          if (isFaction) {
            zoneAmt = zBase;
          } else if (isPCOrNPC) {
            // PCs/NPCs get half the exposure (floored).
            zoneAmt = Math.floor(zBase / 2);
          }
        }

        // --- Hex-level exposure ---
        const hex = findHexAtPoint(token.center.x, token.center.y);
        let hexAmt = 0;
        const hexSources = [];

        if (hex) {
          const tf    = hex.document.flags?.[MODT] || {};
          const conds = Array.isArray(tf.conditions) ? tf.conditions : [];
          const mods  = (typeof tf.mods === "object" && tf.mods) ? tf.mods : {};

          if (conds.includes("Radiated")) {
            hexAmt += 1;
            hexSources.push("Radiated");
          }
          if (conds.includes("Contaminated")) {
            hexAmt += 1;
            hexSources.push("Contaminated");
          }
          const mVal = Number(mods.radiation || 0);
          if (mVal > 0) {
            hexAmt += mVal;
            hexSources.push(`mods.radiation ${mVal}`);
          }

          if (hexAmt > 0 && isPCOrNPC) {
            // PCs/NPCs get half of hex exposure (floored).
            hexAmt = Math.floor(hexAmt / 2);
          }
        }

        // --- Safe-zone decay for PCs/NPCs ---
        let decay = 0;
        const isZoneSafe = (zBase === 0);
        const isHexSafe  = (!hexAmt && (!hex || !hexSources.length));

        if (isPCOrNPC && isZoneSafe && isHexSafe) {
          decay = -1; // bleed off 1 RP per turn in fully safe area
        }

        // Factions do NOT get decay here; they already have Purified hex → RP cleansing
        // via doRadiationBleedPurifiedActors in advance-turn.tracks.js. 

        const totalDelta = (zoneAmt + hexAmt + decay);
        if (!totalDelta) continue;

        const before = radApi.get(actor.id);
        const after  = await radApi.add(actor.id, totalDelta);

        const dir  = totalDelta > 0 ? "+" : "−";
        const abs  = Math.abs(totalDelta);
        const srcBits = [];

        if (zoneAmt) srcBits.push(`Zone ${String(zInt).toUpperCase()}`);
        if (hexSources.length) srcBits.push(`Hex ${hexSources.join(", ")}`);
        if (decay < 0) srcBits.push("Safe Rest");

        const srcStr = srcBits.length
          ? ` — <i>${srcBits.join(" • ")}</i>`
          : "";

        lines.push(
          `• <b>${foundry.utils.escapeHTML(actor.name)}</b>: `
          + `Radiation ${dir}${abs} RP (${before} → ${after})${srcStr}`
        );
      }

      if (lines.length && gm.length) {
        await ChatMessage.create({
          content: `<p><b>Radiation Turn Update</b></p>${lines.join("<br/>")}`,
          whisper: gm,
          speaker: { alias: "BBTTCC Radiation" }
        }).catch(()=>{});
      }

    } catch (e) {
      console.warn(TAG, "handleAdvanceTurnEnd failed:", e);
    }
  }

  Hooks.on("bbttcc:advanceTurn:end", handleAdvanceTurnEnd);
  Hooks.once("ready", () => {
    console.log(TAG, "Per-turn radiation enhancer ready (AdvanceTurn integration).");
  });
})();
