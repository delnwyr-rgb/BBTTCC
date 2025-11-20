// modules/bbttcc-factions/scripts/vp-engine.js
// BBTTCC — Permanent Victory Point Engine (ready-safe)
//
// Restores the working sprint behavior:
// - VP gain each Advance Turn (Apply)
// - Formula score = (0.5*Unity + 0.3*Morale + 0.2*Loyalty)/100
// - vpGain = round(score*2), capped at +3/turn
// - Unity > 0 gate (Spark + aligned hexes)
// - Exposes computeVPGain / applyVPGain under game.bbttcc.api.victory

(() => {
  const MODF = "bbttcc-factions";
  const TAG  = "[bbttcc-victory-engine]";

  // Weights & caps (from previous sprint)
  const W_UNITY  = 0.5;
  const W_MORALE = 0.3;
  const W_LOYAL  = 0.2;
  const SCALE    = 2;
  const VP_CAP   = 3;

  Hooks.once("ready", () => {
    try {
      // Make sure the bbttcc namespace exists but DON'T overwrite it.
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.api = game.bbttcc.api || {};
      const vx = (game.bbttcc.api.victory = game.bbttcc.api.victory || {});

      /**
       * Compute VP gain for a faction actor.
       * Returns { gain, score, unity, morale, loyalty, before, after }
       * OR null if no VP should be granted.
       */
      vx.computeVPGain = function computeVPGain(actor) {
        if (!actor?.getFlag) return null;

        const victory = actor.getFlag(MODF, "victory") || {};
        const unity   = Number(victory.unity   ?? 0);
        const morale  = Number(actor.getFlag(MODF, "morale")  ?? 50);
        const loyalty = Number(actor.getFlag(MODF, "loyalty") ?? 50);

        // Gate: Unity must be > 0 (Spark + aligned hexes)
        if (unity <= 0) return null;

        const before = Number(victory.vp || 0);

        const score = (W_UNITY * unity + W_MORALE * morale + W_LOYAL * loyalty) / 100;
        let gain = Math.round(score * SCALE);

        if (gain <= 0) return null;
        if (gain > VP_CAP) gain = VP_CAP;

        const after = before + gain;

        return {
          gain,
          score,
          unity,
          morale,
          loyalty,
          before,
          after
        };
      };

      /**
       * Apply VP gain to the faction actor and return a line for GM whisper.
       * Used by advance-turn.tracks.js → doVictoryGain().
       */
      vx.applyVPGain = async function applyVPGain(actor) {
        const res = vx.computeVPGain(actor);
        if (!res) return null;

        const victory = foundry.utils.duplicate(actor.getFlag(MODF, "victory") || {});
        victory.vp = res.after;

        await actor.update({ [`flags.${MODF}.victory`]: victory });

        return (
          `• <b>${foundry.utils.escapeHTML(actor.name)}</b>: ` +
          `+${res.gain} VP ` +
          `(score ${res.score.toFixed(3)}; ` +
          `U ${res.unity}% / M ${res.morale}% / L ${res.loyalty}%)`
        );
      };

      console.log(TAG, "Victory Engine ready & attached to game.bbttcc.api.victory.");
    } catch (e) {
      console.warn(TAG, "init failed:", e);
    }
  });
})();
