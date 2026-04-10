// modules/bbttcc-core/scripts/bbttcc-ui-cleanup.enhancer.js
// BBTTCC — Remove legacy UI pills/buttons, but KEEP the GM toolbar.
//
// This script only removes old floating bits like the pre-HexChrome
// "Open Travel Console" and "Open Travel Planner" pills.
//

(() => {
  const TAG = "[bbttcc-ui/cleanup]";

  function clean() {
    if (!game.user?.isGM) return;

    const ids = [
      "bbttcc-travel-console-btn", // old floating Travel Console button
      "bbttcc-travel-mode-btn"     // old "Open Travel Planner" pill
      // NOTE: we deliberately do NOT touch:
      //   - bbttcc-overview-btn
      //   - bbttcc-overview-fallback
      //   - bbttcc-toolbar
      // because those are part of the current GM toolbar cluster.
    ];

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.remove();
    }

    console.log(TAG, "Removed legacy travel pills; GM toolbar left intact.");
  }

  Hooks.once("ready", clean);
  Hooks.on("canvasReady", clean);
})();
