// modules/bbttcc-factions/scripts/faction-header-cleanup.enhancer.js
// BBTTCC — Faction Header Cleanup + Raid Planner launcher (Enhancer-Only, Safe)

(() => {
  const MOD = "bbttcc-factions";
  const TAG = "[bbttcc-header-cleanup]";

  /**
   * Hide deprecated header buttons:
   * - Advance Turn (Dry / Apply)
   * - Advance OP (Dry / Apply)
   * - Commit Turn
   *
   * Only keep "Ritual".
   */
  function hideOldButtons(root) {
    const ctrl = root.querySelector("#bbttcc-faction-ctrls");
    if (!ctrl) return;

    const btns = [...ctrl.querySelectorAll("button")];
    btns.forEach(b => {
      const act = b.dataset.act || "";
      if (act && act !== "ritual") {
        b.style.display = "none";
      }
    });
  }

  /**
   * Add resource-flow explanation to Bank/Stockpile section.
   * NOTE: the container is #bbttcc-faction-strips, created in module.js
   */
  function addFlowHint(root) {
    const strip = root.querySelector("#bbttcc-faction-strips");
    if (!strip) return;

    // Only add it once
    if (strip.querySelector("[data-bbttcc-flow]")) return;

    const hint = document.createElement("div");
    hint.dataset.bbttccFlow = "1";
    hint.style.marginTop = "4px";
    hint.style.fontSize = "11px";
    hint.style.opacity = "0.8";
    hint.style.color = "#111";
    hint.innerHTML = `
      <em>Resource Flow:</em>
      Turn Yield → <b>Bank</b> → <b>Stockpile</b> → <b>OP Bank</b><br>
      <span style="font-size:10px; opacity:0.75;">(GM Turn Console performs the conversions)</span>
    `;
    strip.appendChild(hint);
  }

  /**
   * Improve OP Bank table readability.
   */
  function restyleOPBank(root) {
    const opStrip = root.querySelector("#bbttcc-opbank-strip");
    if (!opStrip) return;

    opStrip.style.minWidth = "320px";
    opStrip.style.padding = "4px 6px";
    opStrip.style.background = "rgba(248,250,252,0.6)";
    opStrip.style.border = "1px solid rgba(0,0,0,0.15)";
    opStrip.style.borderRadius = "6px";

    const table = opStrip.querySelector("table");
    if (table) {
      table.style.fontSize = "12px";
      table.style.width = "100%";
      table.style.tableLayout = "fixed";
      table.style.background = "rgba(255,255,255,0.6)";
      table.style.border = "1px solid rgba(0,0,0,0.12)";
      table.style.borderRadius = "4px";
    }
  }

  /**
   * Replace the inline Raid Plan staging grid with a simple
   * "Open Raid Planner" panel that launches the Raid Console
   * pre-set to this faction as attacker.
   *
   * Uses a global handshake flag:
   *    globalThis.__bbttccNextRaidPlannerFactionId = actor.id
   *
   * The raid module's planner enhancer will claim that flag on
   * the next render of BBTTCC_RaidConsole and mark that instance
   * as a planner.
   */
  function wireRaidPlanner(root, actor) {
    const panel = root.querySelector("#bbttcc-raidplan-strip");
    if (!panel || !actor) return;

    // Only wire once per render
    if (panel.dataset.bbttccRaidPlanner === "1") return;
    panel.dataset.bbttccRaidPlanner = "1";

    panel.replaceChildren();

    const title = document.createElement("div");
    title.style.fontSize = "12px";
    title.style.fontWeight = "600";
    title.textContent = "Raid Planner";

    const desc = document.createElement("div");
    desc.style.fontSize = "11px";
    desc.style.opacity = "0.8";
    desc.style.textAlign = "right";
    desc.innerHTML = `
      Stage OP spends and maneuvers<br>
      in a sandbox planning console.
    `;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "Open Raid Planner";
    btn.style.marginTop = "4px";
    btn.style.padding = "4px 10px";
    btn.style.borderRadius = "6px";
    btn.style.border = "1px solid rgba(255,255,255,0.18)";
    btn.style.background = "rgba(37,99,235,0.85)";
    btn.style.color = "#f9fafb";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try {
        const raidApi = game.bbttcc?.api?.raid;
        if (!raidApi || typeof raidApi.openRaidConsole !== "function") {
          ui.notifications?.warn?.("Raid Console API is not available.");
          return;
        }

        // Handshake: mark the NEXT Raid Console render as a planner for this faction.
        globalThis.__bbttccNextRaidPlannerFactionId = actor.id;

        const consoleApp = await raidApi.openRaidConsole();
        if (!consoleApp) return;

        // Pre-select this faction as attacker for convenience.
        try {
          consoleApp.vm ??= {};
          consoleApp.vm.attackerId = actor.id;
          await consoleApp.render(false);
        } catch (ee) {
          console.warn(TAG, "Could not preset attacker on Raid Console:", ee);
        }
      } catch (e) {
        console.warn(TAG, "Raid Planner open failed:", e);
      }
    });

    panel.appendChild(title);
    panel.appendChild(desc);
    panel.appendChild(btn);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const root = html[0];
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
