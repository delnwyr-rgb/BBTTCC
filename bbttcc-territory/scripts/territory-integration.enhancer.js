// modules/bbttcc-territory/scripts/territory-integration.enhancer.js
// BBTTCC — Integration Track Enhancer
//
// Wraps game.bbttcc.api.territory.applyOutcome so that when a Resolution outcome
// is applied to a hex, we also advance (or reset) that hex's integration track,
// and, for wilderness hexes, gently apply stage-based effects (size/pop/status).
//
// Also normalizes legacy status "claimed" → "occupied" when integration changes,
// so the data model stays aligned with the simplified status set.
//
// This does NOT replace the Resolution Engine; it just layers on integration
// behavior after the normal outcome logic runs.

(() => {
  const TAG  = "[bbttcc-integration]";
  const MODT = "bbttcc-territory";

  function clampProgress(v) {
    v = Number.isFinite(v) ? Number(v) : 0;
    if (v < 0) v = 0;
    if (v > 6) v = 6;
    return Math.round(v);
  }

  /** Derive a stage key from integration progress (0–6). */
  function stageKeyFromProgress(progress) {
    const p = clampProgress(progress);
    if (p >= 6) return "integrated";
    if (p === 5) return "settled";
    if (p >= 3) return "developing";
    if (p >= 1) return "outpost";
    return "wild";
  }

  /**
   * Decide how an outcome should affect integration.progress.
   * Returns one of:
   *   { mode:"add", delta }
   *   { mode:"max", min, add? }
   *   { mode:"reset" }
   * or null for "no integration effect".
   */
  function integrationEffectForOutcome(outcomeKey, tier, spec) {
    switch (String(outcomeKey || "")) {
      case "justice_reformation":
      case "liberation":
        // Gentle, just / liberating outcomes → small but meaningful progress.
        return { mode: "add", delta: 1 };

      case "best_friends_integration":
        // Big jump: heavily relational integration.
        // Ensure at least mid-track, then bump.
        return { mode: "max", min: 4, add: 1 };

      case "retribution_subjugation":
        // You can integrate territory through fear, but at a cost elsewhere.
        return { mode: "add", delta: 1 };

      case "salt_the_earth":
        // Hard reset — territory is wrecked and must be rebuilt.
        return { mode: "reset" };

      default:
        return null;
    }
  }

  /**
   * Apply stage-based effects to a hex when integration crosses a stage boundary.
   *
   * Very conservative:
   * - Only adjusts wilderness hexes (type:"wilderness"), so we don't shrink old cities.
   * - Focuses on size, population, and a little status sanity.
   * - Also normalizes "claimed" → "occupied" when an owner exists.
   */
  async function applyStageEffects(hex, prevProgress, nextProgress) {
    const prevStage = stageKeyFromProgress(prevProgress);
    const nextStage = stageKeyFromProgress(nextProgress);

    const tf = hex.flags?.[MODT] ?? {};
    const rawStatus = String(tf.status || "unclaimed");
    const ownerId = tf.factionId || tf.ownerId || "";

    const patch = { _id: hex.id };

    // Normalize legacy "claimed" to "occupied" if this hex is owned.
    if (rawStatus === "claimed" && ownerId) {
      patch[`flags.${MODT}.status`] = "occupied";
    }

    // Only wilderness hexes get stage-based evolution.
    const type = String(tf.type || "");
    if (type !== "wilderness") {
      // If we only needed to normalize "claimed", we may still have a patch.
      const keys = Object.keys(patch);
      if (keys.length > 1) {
        try {
          await hex.update(patch);
          console.log(TAG, "Status normalized (claimed→occupied) on non-wilderness hex", {
            hex: hex.name ?? hex.text ?? hex.id,
            patch
          });
        } catch (e) {
          console.warn(TAG, "Failed to normalize status on hex:", hex.uuid ?? hex.id, e);
        }
      }
      return;
    }

    // If no stage change, we may still just normalize status.
    if (prevStage === nextStage) {
      const keys = Object.keys(patch);
      if (keys.length > 1) {
        try {
          await hex.update(patch);
          console.log(TAG, "Status normalized on wilderness hex (no stage change)", {
            hex: hex.name ?? hex.text ?? hex.id,
            patch
          });
        } catch (e) {
          console.warn(TAG, "Failed to normalize status on wilderness hex:", hex.uuid ?? hex.id, e);
        }
      }
      return;
    }

    const status = (patch[`flags.${MODT}.status`] || rawStatus);
    const size    = String(tf.size || "");
    const pop     = String(tf.population || "");

    function ensureOccupiedIfOwned() {
      if (!ownerId) return;
      const normStatus = String(status || "unclaimed");
      if (!normStatus || normStatus === "unclaimed") {
        patch[`flags.${MODT}.status`] = "occupied";
      }
    }

    switch (nextStage) {
      case "wild": {
        // Very light touch: ensure wilderness defaults if missing.
        if (!status) patch[`flags.${MODT}.status`] = "unclaimed";
        if (!pop) patch[`flags.${MODT}.population`] = "uninhabited";
        if (!size) patch[`flags.${MODT}.size`] = "outpost";
        break;
      }

      case "outpost": {
        // Wilderness foothold: small garrison, low population.
        ensureOccupiedIfOwned();

        if (!size || size === "town" || size === "village") {
          patch[`flags.${MODT}.size`] = "outpost";
        }
        if (!pop || pop === "uninhabited") {
          patch[`flags.${MODT}.population`] = "low";
        }
        break;
      }

      case "developing": {
        // Wilderness is being actively developed; gently nudge upward.
        ensureOccupiedIfOwned();

        if (size === "outpost") {
          // Bump to a small settlement footprint.
          patch[`flags.${MODT}.size`] = "village";
        }
        if (pop === "uninhabited" || pop === "low") {
          patch[`flags.${MODT}.population`] = "medium";
        }
        break;
      }

      case "settled":
      case "integrated": {
        // Fully part of someone's domain; ensure at least medium population.
        ensureOccupiedIfOwned();

        if (pop === "uninhabited" || pop === "low") {
          patch[`flags.${MODT}.population`] = "medium";
        }
        break;
      }
    }

    // If we didn't actually change anything, skip the update.
    const keys = Object.keys(patch);
    if (keys.length <= 1) return; // only _id present

    try {
      await hex.update(patch);
      console.log(TAG, "Stage effects applied", {
        hex: hex.name ?? hex.text ?? hex.id,
        prevProgress,
        nextProgress,
        prevStage,
        nextStage,
        patch
      });
    } catch (e) {
      console.warn(TAG, "Failed to apply stage effects to hex:", hex.uuid ?? hex.id, e);
    }
  }

  /**
   * Apply integration changes for a single outcome application.
   */
  async function applyIntegrationFromOutcome(args = {}, result) {
    const { hexUuid, outcomeKey, tier } = args;
    if (!hexUuid || !outcomeKey) return;

    const outcomeSpec = (globalThis.BBTTCC_RESOLUTIONS || {})[outcomeKey] || {};
    const effect = integrationEffectForOutcome(outcomeKey, tier, outcomeSpec);
    if (!effect) return; // this outcome doesn't touch integration

    let doc;
    try {
      doc = await fromUuid(hexUuid);
    } catch (e) {
      console.warn(TAG, "Failed to resolve hex UUID for integration update:", hexUuid, e);
      return;
    }
    const hex = doc?.document ?? doc;
    if (!hex?.setFlag) return;

    // Current integration state (if any)
    let integ = await hex.getFlag(MODT, "integration");
    if (integ == null) integ = {};
    const prev = clampProgress(integ.progress ?? 0);
    let next = prev;

    if (effect.mode === "reset") {
      next = 0;
    } else if (effect.mode === "add") {
      next = prev + Number(effect.delta || 0);
    } else if (effect.mode === "max") {
      const min = Number(effect.min ?? 0);
      next = Math.max(prev, min);
      if (effect.add) next += Number(effect.add);
    }

    next = clampProgress(next);
    if (next === prev) {
      // No actual change; nothing to write.
      return;
    }

    // Record simple history
    const history = Array.isArray(integ.history) ? integ.history.slice() : [];
    history.push({
      ts: Date.now(),
      outcomeKey: String(outcomeKey),
      tier: tier || null,
      prev,
      next
    });
    // keep last ~20 entries
    integ.history = history.slice(-20);
    integ.progress = next;

    try {
      await hex.setFlag(MODT, "integration", integ);
      console.log(TAG, "Integration updated", {
        hex: hex.name ?? hex.text ?? hex.id,
        outcomeKey,
        tier,
        prev,
        next
      });
    } catch (e) {
      console.warn(TAG, "Failed to set integration flag on hex:", hexUuid, e);
    }

    // After integration changes, apply stage effects + status normalization.
    try {
      await applyStageEffects(hex, prev, next);
    } catch (e) {
      console.warn(TAG, "Stage effects overlay failed for outcome:", args, e);
    }
  }

  // Hook into the Resolution Engine's applyOutcome once the game is ready
  Hooks.once("ready", () => {
    const terrApi = game.bbttcc?.api?.territory;
    if (!terrApi || typeof terrApi.applyOutcome !== "function") {
      console.warn(TAG, "territory.applyOutcome not found; integration enhancer disabled.");
      return;
    }

    const originalApplyOutcome = terrApi.applyOutcome;

    terrApi.applyOutcome = async function wrappedApplyOutcome(args = {}) {
      // Preserve original behavior
      const result = await originalApplyOutcome.call(this, args);
      // Then overlay integration behavior (non-fatal if it breaks)
      try {
        await applyIntegrationFromOutcome(args, result);
      } catch (e) {
        console.warn(TAG, "Integration overlay failed for outcome:", args, e);
      }
      return result;
    };

    console.log(TAG, "Integration enhancer hooked into territory.applyOutcome.");
  });

})();
