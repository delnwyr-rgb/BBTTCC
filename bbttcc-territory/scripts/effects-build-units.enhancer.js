// modules/bbttcc-territory/scripts/effects-build-units.enhancer.js
// BBTTCC — Build Units integration for Strategic Activities
//
// Wraps certain raid/strategic EFFECTS so that when they apply
// (fortify, repair, build asset / infrastructure), they automatically
// spend Build Units via
//   game.bbttcc.api.territory.buildUnits.spendForAction(...)
//
// This file does NOT change your existing EFFECTS implementations;
// it only decorates matching entries based on their activity keys.

(() => {
  const TAG = "[bbttcc-territory/effects-build-units]";

  // ---------------------------------------------------------------------------
  // Map activity keys → BU action
  //
  // Feel free to tweak this list later. These keys come directly from:
  //   Object.keys(game.bbttcc.api.raid.EFFECTS)
  // and we group them by what they *do* in-fiction.
  // ---------------------------------------------------------------------------
  const ACTIVITY_BU_ACTION = {
    // --- Fortification / Defense -------------------------------------------
    fortify_hex: "fortify",
    secure_perimeter: "fortify",

    // --- Repairs / cleanup / fixing infrastructure -------------------------
    minor_repair: "repair",
    reconstruction_drive: "repair",

    // --- Infrastructure & construction (treated as "asset" for now) -------
    develop_infrastructure: "asset",
    develop_infrastructure_std: "asset",
    infrastructure_expansion: "asset",
    develop_outpost_stability: "asset",
    upgrade_outpost_settlement: "asset",
    establish_outpost: "asset",

    // Founding hard sites (assume BU-heavy)
    found_site_farm: "asset",
    found_site_mine: "asset",
    found_site_port: "asset",
    found_site_temple: "asset",
    found_site_research: "asset",
    found_site_fortress: "asset"
  };

  function guessHexUuid(ctx) {
    return (
      ctx?.hexUuid ||
      ctx?.targetHexUuid ||
      ctx?.drawingUuid ||
      ctx?.hexId ||
      ctx?.hex?.uuid ||
      null
    );
  }

  function guessFactionId(ctx) {
    return (
      ctx?.factionId ||
      ctx?.attackerId ||
      ctx?.ownerId ||
      ctx?.actorId ||
      null
    );
  }

  function installWrappers() {
    const raid = game.bbttcc?.api?.raid;
    const buApi = game.bbttcc?.api?.territory?.buildUnits;

    if (!raid || !raid.EFFECTS) {
      console.warn(TAG, "raid.EFFECTS not found; BU effect wrapper idle.");
      return;
    }
    if (!buApi || typeof buApi.spendForAction !== "function") {
      console.warn(TAG, "buildUnits.spendForAction not available; BU effect wrapper idle.");
      return;
    }

    const effects = raid.EFFECTS;
    let wrappedCount = 0;

    for (const [key, spec] of Object.entries(effects)) {
      const actionKey = ACTIVITY_BU_ACTION[key];
      if (!actionKey) continue;                 // not a BU-linked activity
      if (!spec || typeof spec.apply !== "function") continue;
      if (spec.__bbttccBUWrapped) continue;     // already wrapped

      const baseApply = spec.apply;

      spec.apply = async function wrappedEffectApply(ctx = {}) {
        // Run the original effect first.
        const result = await baseApply.call(this, ctx).catch(e => {
          console.warn(TAG, "Base EFFECT apply failed for", key, e);
          throw e;
        });

        try {
          const hexUuid   = guessHexUuid(ctx);
          const factionId = guessFactionId(ctx);
          if (!hexUuid || !factionId) {
            // Not enough info to spend BUs; skip quietly.
            return result;
          }

          const note = `Activity: ${key}`;
          await buApi.spendForAction({
            factionId,
            hexUuid,
            action: actionKey,
            note
          });
        } catch (e) {
          console.warn(TAG, "BU spending for activity", key, "failed:", e);
        }

        return result;
      };

      spec.__bbttccBUWrapped = true;
      wrappedCount++;
    }

    if (wrappedCount) {
      console.log(TAG, `Wrapped ${wrappedCount} EFFECTS for BU spending.`);
    } else {
      console.log(TAG, "No matching EFFECTS to wrap (check ACTIVITY_BU_ACTION keys).");
    }
  }

  Hooks.once("ready", installWrappers);
  try {
    if (game?.ready) installWrappers();
  } catch {}

})();
