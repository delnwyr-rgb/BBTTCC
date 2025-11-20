// modules/bbttcc-factions/scripts/faction-health-display.js
// BBTTCC — Faction Health display hook (permanent)
//
// Reads the real faction flags (victory, unity, morale, loyalty, darkness)
// and overwrites the "Faction Health" meters on the faction sheet after render.
// This is the same behavior we used via console wrapper last sprint, just
// turned into a stable module script.

(() => {
  const MODF = "bbttcc-factions";
  const TAG  = "[bbttcc-faction-health]";

  /**
   * Helper: pull victory/morale/loyalty/darkness flags from the actor.
   */
  function readHealthFlags(actor) {
    const victory  = actor.getFlag(MODF, "victory")  || {};
    const darkness = actor.getFlag(MODF, "darkness") || {};
    const morale   = actor.getFlag(MODF, "morale");
    const loyalty  = actor.getFlag(MODF, "loyalty");

    return {
      vp: Number(victory.vp ?? 0),
      unity: Number(victory.unity ?? 0),
      morale: Number(morale ?? 0),
      loyalty: Number(loyalty ?? 0),
      darkness: (typeof darkness.global === "number")
        ? darkness.global
        : (typeof darkness === "number" ? darkness : 0)
    };
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html /*, data */) => {
    try {
      const actor = app.actor;
      if (!actor) return;

      const vals = readHealthFlags(actor);

      // Find the fieldset whose legend is "Faction Health"
      const root = html[0];
      if (!root) return;

      const fieldsets = root.querySelectorAll("fieldset");
      const fs = [...fieldsets].find(f =>
        (f.querySelector("legend")?.textContent || "")
          .trim()
          .toLowerCase() === "faction health"
      );
      if (!fs) {
        console.debug(TAG, "Faction Health fieldset not found on sheet.");
        return;
      }

      // The template already renders 5 .bbttcc-meter spans in order:
      // 0: Victory VP
      // 1: Unity %
      // 2: Morale %
      // 3: Loyalty %
      // 4: Darkness
      const meters = fs.querySelectorAll(".bbttcc-meter");
      if (meters[0]) meters[0].textContent = String(vals.vp);
      if (meters[1]) meters[1].textContent = `${vals.unity}%`;
      if (meters[2]) meters[2].textContent = `${vals.morale}%`;
      if (meters[3]) meters[3].textContent = `${vals.loyalty}%`;
      if (meters[4]) meters[4].textContent = String(vals.darkness);

      // Optional tiny nudge to force the browser to repaint if needed
      fs.style.outline = "transparent";
      setTimeout(() => { fs.style.outline = ""; }, 0);

    } catch (e) {
      console.warn(TAG, "render hook error:", e);
    }
  });

  console.log(TAG, "Faction Health render hook installed.");
})();
