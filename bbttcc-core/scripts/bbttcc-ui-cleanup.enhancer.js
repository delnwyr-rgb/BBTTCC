// modules/bbttcc-core/scripts/bbttcc-ui-cleanup.enhancer.js
// BBTTCC — Remove legacy UI toolbars & buttons

(() => {
  const TAG = "[bbttcc-ui/cleanup]";

  function clean() {
    if (!game.user?.isGM) return;

    const ids = [
      "bbttcc-travel-console-btn", // old Travel Console button
      "bbttcc-travel-mode-btn",    // old Travel Planner HUD button
      "bbttcc-overview-btn",       // old Overview-in-toolbar
      "bbttcc-overview-fallback",  // floating fallback Overview
      "bbttcc-toolbar"             // old BBTTCC toolbar container
    ];

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }
  }

  Hooks.once("ready", clean);
  Hooks.on("canvasReady", clean);
})();
