// modules/bbttcc-raid/scripts/raid-planner-mode.enhancer.js
// BBTTCC — Raid Console Planning Mode Helper
//
// Provides:
//   game.bbttcc.api.raid.forcePlanningMode()
//
// Usage:
//   1. Open the Raid Console normally (GM or via Faction sheet).
//   2. In console or a Macro, call:
//        game.bbttcc.api.raid.forcePlanningMode();
//
// This will:
//   - Add a banner: "Planning Mode — simulation only. No OP spend, no war logs."
//   - Disable Commit buttons in the Manage panel
//   - Disable "Post" buttons in the rounds table
//   - Disable Log Attacker / Log Defender checkboxes.
//
// Core raid behavior (when not in planning mode) remains unchanged.

(() => {
  const TAG = "[bbttcc-raid-planner-mode]";

  function applyPlanningModeToRoot(root) {
    if (!root) return;

    // 1) Banner at the top of the console.
    const header = root.querySelector(".window-header") || root.querySelector("header");
    if (header && !root.querySelector("[data-bbttcc-planning-banner]")) {
      const banner = document.createElement("div");
      banner.dataset.bbttccPlanningBanner = "1";
      banner.style.margin = "4px 8px 6px";
      banner.style.padding = "4px 8px";
      banner.style.borderRadius = "4px";
      banner.style.fontSize = "11px";
      banner.style.fontWeight = "600";
      banner.style.background = "rgba(30,64,175,0.15)";
      banner.style.color = "#bfdbfe";
      banner.textContent = "Planning Mode — simulation only. No OP spend, no war logs.";
      header.parentElement.insertBefore(banner, header.nextSibling);
    }

    // 2) Disable POST buttons
    root.querySelectorAll('button[data-act="post"]').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed";
      btn.title = "Disabled in planning mode.";
    });

    // 3) Disable COMMIT buttons in Manage panel
    root.querySelectorAll('button[data-manage-act="commit"]').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed";
      btn.title = "Disabled in planning mode.";
    });

    // 4) Disable Log Attacker / Log Defender toggles
    root.querySelectorAll('input[data-id="logWar"], input[data-id="logDef"]').forEach(cb => {
      cb.disabled = true;
      cb.checked = false;
      cb.title = "Logging disabled in planning mode.";
      cb.closest("label")?.classList?.add("bbttcc-disabled");
    });
  }

  Hooks.once("init", () => {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.raid = game.bbttcc.api.raid || {};

    game.bbttcc.api.raid.forcePlanningMode = function forcePlanningMode() {
      // AppV2 raid console root lives directly in the DOM.
      const root =
        document.querySelector("#bbttcc-raid-console") ||
        document.querySelector(".bbttcc-raid-console");

      if (!root) {
        ui.notifications?.warn?.("Open the Raid Console first, then call forcePlanningMode().");
        console.warn(TAG, "No .bbttcc-raid-console element found.");
        return;
      }

      applyPlanningModeToRoot(root);
      console.log(TAG, "Forced planning-mode UI applied.");
    };

    console.log(TAG, "forcePlanningMode helper registered on game.bbttcc.api.raid.");
  });
})();
