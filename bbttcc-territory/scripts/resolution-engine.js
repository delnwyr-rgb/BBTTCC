// modules/bbttcc-territory/scripts/resolution-engine.js
// BBTTCC — Resolution Engine (plain script, no ES modules)
//
// Wires up:
//   game.bbttcc.api.territory.applyOutcome({...})
//   game.bbttcc.api.territory.saltHex({...})
//
// Uses window.BBTTCC_RESOLUTIONS from resolutions.js.

(() => {
  const TAG  = "[bbttcc-resolution]";
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";

  function clamp(v, min, max) {
    v = Number(v || 0);
    return Math.max(min, Math.min(max, v));
  }

  Hooks.once("ready", () => {
    const RESOLUTIONS = window.BBTTCC_RESOLUTIONS || {};
    if (!Object.keys(RESOLUTIONS).length) {
      console.warn(TAG, "No RESOLUTIONS found on window.BBTTCC_RESOLUTIONS.");
    }

    // Ensure api surface
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};

    if (!game.bbttcc.api.territory) {
      console.error(TAG, "No game.bbttcc.api.territory found; cannot install resolution engine.");
      return;
    }

    const terrApi = game.bbttcc.api.territory;

    // ---------------------------------------------------------
    // Core: applyOutcome
    // ---------------------------------------------------------
    terrApi.applyOutcome = async function applyOutcome({
      factionId,
      hexUuid,
      outcomeKey,
      tier = "owner_action",
      context = {}
    } = {}) {

      if (!factionId) throw new Error(`${TAG} Missing factionId.`);
      if (!hexUuid)  throw new Error(`${TAG} Missing hexUuid.`);
      if (!outcomeKey) throw new Error(`${TAG} Missing outcomeKey.`);

      const outcome = RESOLUTIONS[outcomeKey];
      if (!outcome) {
        throw new Error(`${TAG} Unknown outcomeKey: ${outcomeKey}`);
      }

      // -------------------------------------------------------
      // Resolve hex Document
      // -------------------------------------------------------
      const hex = await fromUuid(hexUuid);
      if (!hex) throw new Error(`${TAG} Hex not found for uuid: ${hexUuid}`);

      // Ownership check if required
      if (outcome.requiresOwnership) {
        const currentFlags = hex.flags?.[MODT] || {};
        const owner = currentFlags.factionId || currentFlags.ownerId;
        if (!owner || String(owner) !== String(factionId)) {
          throw new Error(`${TAG} Outcome ${outcomeKey} requires hex ownership by faction ${factionId}.`);
        }
      }

      // Tier check
      if (outcome.allowedTiers && !outcome.allowedTiers.includes(tier)) {
        throw new Error(
          `${TAG} Outcome ${outcomeKey} not allowed for tier ${tier}. ` +
          `Allowed: ${outcome.allowedTiers.join(", ")}`
        );
      }

      // -------------------------------------------------------
      // HEX EFFECTS
      // -------------------------------------------------------
      const tf = foundry.utils.duplicate(hex.flags?.[MODT] || {});

      if (outcome.hex) {
        const h = outcome.hex;

        if (h.status) tf.status = h.status;

        if (h.productionMult !== undefined) {
          tf.productionMult = h.productionMult;
        }

        if (h.addModifiers && Array.isArray(h.addModifiers)) {
          tf.modifiers = tf.modifiers || [];
          for (const m of h.addModifiers) {
            if (!tf.modifiers.includes(m)) tf.modifiers.push(m);
          }
        }

        if (h.removeModifiers && Array.isArray(h.removeModifiers)) {
          tf.modifiers = (tf.modifiers || []).filter(x => !h.removeModifiers.includes(x));
        }

        if (h.removePopulation) {
          tf.population = 0;
        }
      }

      // -------------------------------------------------------
      // OCCUPATION / INTEGRATION METADATA
      // -------------------------------------------------------
      if (outcome.integration) {
        // Snapshot the integration spec on the hex so the per-turn
        // Occupation/Integration pipeline can read it later.
        tf.integration = {
          outcomeKey,
          tier,
          appliedAt: Date.now(),
          spec: foundry.utils.duplicate(outcome.integration),
          // These will be used by the per-turn integration engine later.
          progress: 0,
          lastTurnProcessed: null
        };
      }

      await hex.update({ [`flags.${MODT}`]: tf });

      // -------------------------------------------------------
      // FACTION TRACK EFFECTS
      // -------------------------------------------------------
      const A = game.actors.get(factionId);
      if (!A) throw new Error(`${TAG} Faction actor not found: ${factionId}`);

      const F = foundry.utils.duplicate(A.flags?.[MODF] || {});
      const T = outcome.tracks || {};

      if (T.moraleDelta !== undefined) {
        F.morale = clamp((F.morale || 0) + T.moraleDelta, 0, 100);
      }

      if (T.loyaltyDelta !== undefined) {
        F.loyalty = clamp((F.loyalty || 0) + T.loyaltyDelta, 0, 100);
      }

      if (T.darknessDelta !== undefined) {
        const curD = (F.darkness && typeof F.darkness.global === "number") ? F.darkness.global : 0;
        F.darkness = { global: clamp(curD + T.darknessDelta, 0, 10) };
      }

      // Stash raw track deltas for debugging / later use (violence attrition, empathy, etc.)
      F._resolution_effects = T;

      // -------------------------------------------------------
      // VICTORY / UNITY one-time bonuses
      // -------------------------------------------------------
      const V = foundry.utils.duplicate(F.victory || {});
      const Vcfg = outcome.victory || {};

      if (Vcfg.vpOnce) {
        V.vp = Number(V.vp || 0) + Number(Vcfg.vpOnce || 0);
      }

      if (Vcfg.unityOnce) {
        V.unity = Number(V.unity || 0) + Number(Vcfg.unityOnce || 0);
      }

      F.victory = V;

      await A.update({ [`flags.${MODF}`]: F });

      // -------------------------------------------------------
      // WAR LOG ENTRY
      // -------------------------------------------------------
      const msg = {
        ts: Date.now(),
        type: "resolution",
        factionId,
        hexUuid,
        outcome: outcomeKey,
        tier,
        effects: T,
        context
      };

      const existingLogs = A.getFlag(MODF, "warLogs") || [];
      existingLogs.push(msg);

      if (typeof A.setField === "function") {
        await A.setField(`flags.${MODF}.warLogs`, existingLogs);
      } else {
        await A.setFlag(MODF, "warLogs", existingLogs);
      }

      // GM whisper
      try {
        const gmIds = game.users?.filter(u => u.isGM).map(u => u.id) || [];
        const hexName = hex.name || hex.text || hex.id;
        const lines = [
          `<b>${foundry.utils.escapeHTML(A.name)}</b> used ` +
            `<b>${foundry.utils.escapeHTML(outcome.label || outcomeKey)}</b> ` +
            `on <i>${foundry.utils.escapeHTML(hexName)}</i>.`,
          `<small>Tier: ${tier}; Tracks: ${JSON.stringify(T)}</small>`
        ];
        await ChatMessage.create({
          content: `<p><b>Resolution Applied</b></p>${lines.join("<br/>")}`,
          whisper: gmIds,
          speaker: { alias: "BBTTCC Resolution" }
        });
      } catch (e) {
        console.warn(TAG, "Failed to create resolution chat message:", e);
      }

      return msg;
    };

    // ---------------------------------------------------------
    // Convenience: saltHex owner-action
    // ---------------------------------------------------------
    terrApi.saltHex = async function saltHex({ factionId, hexUuid, context = {} } = {}) {
      return terrApi.applyOutcome({
        factionId,
        hexUuid,
        outcomeKey: "salt_the_earth",
        tier: "owner_action",
        context
      });
    };

    console.log(TAG, "Resolution Engine ready.");
  });

})();
