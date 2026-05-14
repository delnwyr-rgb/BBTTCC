// modules/bbttcc-territory/scripts/bbttcc-travel-pill-kill.enhancer.js
// BBTTCC — remove legacy "Open Travel Planner" pill from hex-travel-mode.
//
// hex-travel-mode.js creates a top-right <div id="bbttcc-travel-mode-btn">
// with text "Open Travel Planner" on every canvasReady. We don't want that
// anymore now that the Hex Chrome BBTTCC toolbar is the canonical UI.

(() => {
  const TAG = "[bbttcc-ui/travel-pill-kill]";
  const log  = (...a)=>console.log(TAG, ...a);

  function killPill() {
    const el = document.getElementById("bbttcc-travel-mode-btn");
    if (el) {
      el.remove();
      log("Removed legacy 'Open Travel Planner' pill.");
    }
  }

  function refresh() {
    // Let other hooks run first so the pill can be created, then remove it.
    setTimeout(killPill, 0);
  }

  Hooks.once("ready", refresh);
  Hooks.on("canvasReady", refresh);
})();
