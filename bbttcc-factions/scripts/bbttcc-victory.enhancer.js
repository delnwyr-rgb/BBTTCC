/* bbttcc-factions/scripts/bbttcc-victory.enhancer.js
 *
 * Unified Victory enhancer:
 * - Reads Unity (Spark + Alignment), Morale, Loyalty, Darkness
 * - Computes raw VP gain per Apply
 * - Applies Darkness-based resistance to VP gain
 * - Updates Victory VP + Badge tier
 * - Sends GM whispers summarizing gains, resistance, and badge changes
 *
 * Assumes:
 * - flags.bbttcc-factions.victory.unity has been set by your Unity/Tikkun logic
 * - flags.bbttcc-factions.morale and .loyalty are maintained elsewhere
 * - flags.bbttcc-factions.darkness.global is driven by the Darkness system
 */

(() => {
  const TAG  = "[bbttcc-victory]";
  const MODF = "bbttcc-factions";

  const get = (o, p, d) => {
    try { return foundry.utils.getProperty(o, p) ?? d; }
    catch { return d; }
  };

  // ===== Victory gain tuning =====
  const W_UNITY  = 0.50;
  const W_MORALE = 0.30;
  const W_LOYAL  = 0.20;
  const SCALE            = 2;
  const CAP_PER_APPLY    = 3;

  function darknessFactor(d) {
    d = Number(d || 0);
    if (d >= 10) return 0.25;
    if (d >= 7)  return 0.50;
    if (d >= 4)  return 0.75;
    return 1.0;
  }

  function badgeFor(vp = 0) {
    vp = Number(vp || 0);
    if (vp >= 20) return { key: "ascendant",    label: "Ascendant" };
    if (vp >= 15) return { key: "transcendent", label: "Transcendent" };
    if (vp >= 10) return { key: "dominant",     label: "Dominant" };
    if (vp >= 5)  return { key: "rising",       label: "Rising" };
    return { key: "emerging", label: "Emerging" };
  }

  async function victoryPass() {
    const facs = (game.actors?.contents ?? []).filter(a => a.getFlag?.(MODF, "isFaction"));
    if (!facs.length) return;

    const gmIds = game.users.filter(u => u.isGM).map(u => u.id) ?? [];

    const updates     = [];
    const gainLines   = [];
    const resistLines = [];
    const badgeLines  = [];

    for (const A of facs) {
      const flags   = A.flags?.[MODF] || {};
      const victory = foundry.utils.duplicate(flags.victory || {});

      const unity   = Number(victory.unity || 0);
      const morale  = Number(flags.morale  ?? 0);
      const loyalty = Number(flags.loyalty ?? 0);
      const darkBox = flags.darkness || {};
      const darkness = Number(darkBox.global || 0);

      // Ensure vp numeric
      const vpPrev = Number(victory.vp || 0);

      // Weighted score [0..1]
      const score = Math.max(
        0,
        (W_UNITY  * unity +
         W_MORALE * morale +
         W_LOYAL  * loyalty) / 100
      );

      let rawGain = Math.round(score * SCALE);
      rawGain     = Math.min(CAP_PER_APPLY, rawGain);

      let appliedGain = rawGain;
      let lost        = 0;

      if (rawGain > 0) {
        const f = darknessFactor(darkness);
        appliedGain = Math.round(rawGain * f);
        lost        = rawGain - appliedGain;
        if (appliedGain < 0) appliedGain = 0;
      }

      const vpNext = vpPrev + (appliedGain > 0 ? appliedGain : 0);
      victory.vp   = vpNext;

      // ---- Logging: Gain & Resistance ----
      if (appliedGain > 0) {
        gainLines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: +${appliedGain} VP `
          + `(Unity ${unity}%, Morale ${morale}%, Loyalty ${loyalty}%)`
        );
      }

      if (lost > 0) {
        resistLines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: `
          + `Darkness ${darkness} resisted ${lost} VP (raw ${rawGain} → ${appliedGain})`
        );
      }

      // ---- Badge update ----
      const prevBadgeKey = String(victory.badge?.key || victory.badgeKey || "");
      const nextBadge = badgeFor(vpNext);

      if (nextBadge.key !== prevBadgeKey) {
        victory.badge = {
          key:   nextBadge.key,
          label: nextBadge.label,
          vp:    vpNext,
          at:    Date.now()
        };
        victory.badgeKey   = nextBadge.key;
        victory.badgeLabel = nextBadge.label;

        badgeLines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: `
          + `<i>${nextBadge.label}</i> (VP ${vpNext})`
        );
      }

      updates.push(
        A.update({
          [`flags.${MODF}.victory`]: victory
        })
      );
    }

    if (updates.length) await Promise.allSettled(updates);

    // ---- Chat summaries ----
    if (gainLines.length) {
      await ChatMessage.create({
        content: `<p><b>Victory Update</b></p>${gainLines.join("<br/>")}`,
        whisper: gmIds,
        speaker: { alias: "BBTTCC Victory" }
      }).catch(() => {});
    }

    if (resistLines.length) {
      await ChatMessage.create({
        content: `<p><b>Victory Resistance (Darkness)</b></p>${resistLines.join("<br/>")}`,
        whisper: gmIds,
        speaker: { alias: "BBTTCC Victory" }
      }).catch(() => {});
    }

    if (badgeLines.length) {
      await ChatMessage.create({
        content: `<p><b>Victory Badge Update</b></p>${badgeLines.join("<br/>")}`,
        whisper: gmIds,
        speaker: { alias: "BBTTCC Victory" }
      }).catch(() => {});
    }
  }

  function install() {
    const terr = game.bbttcc?.api?.territory;
    if (!terr || typeof terr.advanceTurn !== "function") {
      console.warn(TAG, "territory.advanceTurn not found; install skipped.");
      return;
    }
    if (terr.__bbttccVictoryWrapped) {
      console.log(TAG, "Victory enhancer already installed.");
      return;
    }

    const base = terr.advanceTurn.bind(terr);

    terr.advanceTurn = async function advanceTurnVictoryWrapped(args = {}) {
      const res = await base(args).catch(e => {
        console.warn(TAG, "base advanceTurn error in victory wrapper:", e);
        return { changed:false, rows:[], error:true };
      });

      try {
        if (args?.apply) {
          await victoryPass();
        }
      } catch (e) {
        console.warn(TAG, "Victory pass failed:", e);
      }

      return res;
    };

    terr.__bbttccVictoryWrapped = true;
    console.log(TAG, "Victory enhancer installed.");
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();
