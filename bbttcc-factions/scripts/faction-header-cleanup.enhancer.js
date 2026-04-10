// modules/bbttcc-factions/scripts/faction-header-cleanup.enhancer.js
// BBTTCC — Faction Header Cleanup + Raid Planner launcher (Enhancer-Only, Safe)
// Refit for the post-header-cleanup faction sheet layout.

(() => {
  const MOD = "bbttcc-factions";
  const TAG = "[bbttcc-header-cleanup]";

  /**
   * Hide deprecated controls if an older control strip is still present.
   * Newer template versions should not rely on this enhancer for layout.
   */
  function hideOldButtons(root) {
    const ctrl = root.querySelector("#bbttcc-faction-ctrls");
    if (!ctrl) return;

    const btns = Array.from(ctrl.querySelectorAll("button"));
    btns.forEach((b) => {
      const act = String((b.dataset && b.dataset.act) || "").trim();
      if (!act) return;
      if (act !== "ritual" && act !== "open-ritual") {
        b.style.display = "none";
      }
    });
  }

  /**
   * Legacy no-op.
   * Bank / Stockpile flow hint was tied to the old retained header shell
   * and should not be re-added in the cleaned sheet.
   */
  function addFlowHint() {
    return;
  }

  /**
   * Light readability touch-up for OP content if the older strip still exists.
   * Safe to no-op on the new sheet structure.
   */
  function restyleOPBank(root) {
    const opStrip = root.querySelector("#bbttcc-opbank-strip");
    if (!opStrip) return;

    opStrip.style.minWidth = "320px";
    opStrip.style.padding = "4px 6px";
    opStrip.style.background = "rgba(248,250,252,0.35)";
    opStrip.style.border = "1px solid rgba(0,0,0,0.12)";
    opStrip.style.borderRadius = "6px";

    const table = opStrip.querySelector("table");
    if (table) {
      table.style.fontSize = "12px";
      table.style.width = "100%";
      table.style.tableLayout = "fixed";
      table.style.background = "rgba(255,255,255,0.5)";
      table.style.border = "1px solid rgba(0,0,0,0.1)";
      table.style.borderRadius = "4px";
    }
  }

  async function openRaidPlanner(actor) {
    if (!actor) return;

    try {
      const raidApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid;
      if (!raidApi || typeof raidApi.openRaidConsole !== "function") {
        if (ui && ui.notifications && typeof ui.notifications.warn === "function") {
          ui.notifications.warn("Raid Console API is not available.");
        }
        return;
      }

      globalThis.__bbttccNextRaidPlannerFactionId = actor.id;

      const consoleApp = await raidApi.openRaidConsole();
      if (!consoleApp) return;

      try {
        if (!consoleApp.vm) consoleApp.vm = {};
        consoleApp.vm.attackerId = actor.id;
        await consoleApp.render(false);
      } catch (ee) {
        console.warn(TAG, "Could not preset attacker on Raid Console:", ee);
      }
    } catch (e) {
      console.warn(TAG, "Raid Planner open failed:", e);
    }
  }

  function buildRaidPlannerPanel(actor) {
    const panel = document.createElement("div");
    panel.dataset.bbttccRaidPlannerPanel = "1";
    panel.className = "bbttcc-raid-planner-panel";
    panel.style.display = "grid";
    panel.style.gridTemplateColumns = "1fr auto";
    panel.style.gap = "8px";
    panel.style.alignItems = "center";
    panel.style.padding = "10px 12px";
    panel.style.marginBottom = "10px";
    panel.style.border = "1px solid rgba(15,23,42,0.14)";
    panel.style.borderRadius = "10px";
    panel.style.background = "rgba(248,250,252,0.6)";

    const textWrap = document.createElement("div");

    const title = document.createElement("div");
    title.style.fontSize = "13px";
    title.style.fontWeight = "700";
    title.textContent = "Raid Planner";

    const desc = document.createElement("div");
    desc.style.fontSize = "11px";
    desc.style.opacity = "0.82";
    desc.textContent = "Open the planning console with this faction pre-selected as attacker.";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "Open Raid Planner";
    btn.style.padding = "6px 10px";
    btn.style.borderRadius = "8px";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      openRaidPlanner(actor);
    });

    textWrap.appendChild(title);
    textWrap.appendChild(desc);
    panel.appendChild(textWrap);
    panel.appendChild(btn);
    return panel;
  }

  /**
   * Legacy compatibility:
   * - if the old #bbttcc-raidplan-strip exists, rewrite it in place
   * - otherwise, inject a compact launcher panel at the top of Activities
   */
  function wireRaidPlanner(root, actor) {
    if (!actor) return;

    const legacyPanel = root.querySelector("#bbttcc-raidplan-strip");
    if (legacyPanel) {
      if (legacyPanel.dataset.bbttccRaidPlanner === "1") return;
      legacyPanel.dataset.bbttccRaidPlanner = "1";
      legacyPanel.replaceChildren();
      const panel = buildRaidPlannerPanel(actor);
      panel.style.marginBottom = "0";
      legacyPanel.appendChild(panel);
      return;
    }

    const activitiesTab = root.querySelector('.bbttcc-tab[data-tab="activities"]');
    if (!activitiesTab) return;
    if (activitiesTab.querySelector('[data-bbttcc-raid-planner-panel="1"]')) return;

    const panel = buildRaidPlannerPanel(actor);
    activitiesTab.prepend(panel);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const root = html && html[0];
      if (!root) return;

      hideOldButtons(root);
      addFlowHint(root);
      restyleOPBank(root);
      wireRaidPlanner(root, app.actor);
    } catch (e) {
      console.warn(TAG, "render hook error", e);
    }
  });

  console.log(TAG, "Header Cleanup + Raid Planner Enhancer active.");
})();
