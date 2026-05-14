// modules/bbttcc-factions/scripts/faction-health-display.js
// BBTTCC — Faction Health display sync (render hook)
//
// Focused responsibility:
// - Reads canonical faction health flags
// - Syncs the visible "Faction Health" fieldset on the Overview tab
//
// Intentionally NOT owned here:
// - legacy Victory / Unity retained-header strip updates
// - tab wiring / tab activation
//
// The sheet template + module.js own tab structure and activation.

(() => {
  const MODF = "bbttcc-factions";
  const TAG  = "[bbttcc-faction-health]";

  function readHealthFlags(actor) {
    const root = (actor && actor.flags && actor.flags[MODF]) || {};
    const nested = (root && typeof root === "object") ? (root[MODF] || null) : null;

    const pick = (k, fallback) => {
      if (root && Object.prototype.hasOwnProperty.call(root, k) && root[k] !== undefined) return root[k];
      if (nested && Object.prototype.hasOwnProperty.call(nested, k) && nested[k] !== undefined) return nested[k];
      const v = actor && actor.getFlag ? actor.getFlag(MODF, k) : undefined;
      return (v === undefined) ? fallback : v;
    };

    const victory  = pick("victory", {}) || {};
    const darkness = pick("darkness", {}) || {};
    const morale   = pick("morale", 0);
    const loyalty  = pick("loyalty", 0);

    let darknessValue = 0;
    if (darkness && typeof darkness === "object" && typeof darkness.global === "number") {
      darknessValue = darkness.global;
    } else if (typeof darkness === "number") {
      darknessValue = darkness;
    }

    return {
      vp: Number(victory && victory.vp !== undefined ? victory.vp : 0),
      unity: Number(victory && victory.unity !== undefined ? victory.unity : 0),
      morale: Number(morale || 0),
      loyalty: Number(loyalty || 0),
      darkness: Number(darknessValue || 0)
    };
  }

  function findFactionHealthFieldset(root) {
    if (!root) return null;
    const fieldsets = Array.from(root.querySelectorAll("fieldset"));
    return fieldsets.find(f => {
      const legend = f.querySelector("legend");
      const text = ((legend && legend.textContent) || "").trim().toLowerCase();
      return text === "faction health";
    }) || null;
  }

  function syncFactionHealthFieldset(root, vals) {
    const fs = findFactionHealthFieldset(root);
    if (!fs) {
      console.debug(TAG, "Faction Health fieldset not found on sheet.");
      return;
    }

    const meters = fs.querySelectorAll(".bbttcc-meter");
    if (!meters || !meters.length) return;

    if (meters[0]) meters[0].textContent = String(vals.vp);
    if (meters[1]) meters[1].textContent = String(vals.unity) + "%";
    if (meters[2]) meters[2].textContent = String(vals.morale) + "%";
    if (meters[3]) meters[3].textContent = String(vals.loyalty) + "%";
    if (meters[4]) meters[4].textContent = String(vals.darkness);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html /*, data */) => {
    try {
      const actor = app && app.actor;
      if (!actor) return;

      const root = html && html[0];
      if (!root) return;

      const vals = readHealthFlags(actor);
      syncFactionHealthFieldset(root, vals);
    } catch (e) {
      console.warn(TAG, "render hook error:", e);
    }
  });

  console.log(TAG, "Faction Health display render hook installed.");
})();
