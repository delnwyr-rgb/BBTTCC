// modules/bbttcc-territory/scripts/bbttcc-toolbar-augment.enhancer.js
// BBTTCC Hex Chrome HUD toolbar augment — top control bar edition

(() => {
  const TAG = "[bbttcc-ui/toolbar-augment]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  function killLegacyTravelPills() {
    try {
      const ids = ["bbttcc-travel-console-btn", "bbttcc-travel-mode-btn"];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    } catch (e) {
      warn("killLegacyTravelPills error", e);
    }
  }

  function getToolbarRoot() {
    return document.getElementById("bbttcc-toolbar")
      || document.querySelector("[data-bbttcc-toolbar]")
      || document.querySelector(".bbttcc-toolbar");
  }

  function getMainRow(toolbar) {
    return toolbar?.querySelector(".bbttcc-toolbar-main")
      || toolbar?.querySelector(".row")
      || toolbar;
  }

  function ensureButton(toolbar, { id, label, icon, onClick }) {
    if (!toolbar) return;
    let btn = toolbar.querySelector(`#${id}`);
    if (btn) return;

    const row = getMainRow(toolbar);

    btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.className = "bbttcc-btn";
    btn.innerHTML = `<i class="fas fa-${icon}"></i><span>${label}</span>`;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      try {
        onClick();
      } catch (e) {
        warn(`Button ${id} click handler error`, e);
      }
    }, { capture: true });

    row.appendChild(btn);
  }

  function augmentToolbar() {
    try {
      const toolbar = getToolbarRoot();
      killLegacyTravelPills();
      if (!toolbar) return;

      const overviewButtons = toolbar.querySelectorAll("#bbttcc-overview-btn");
      if (overviewButtons.length > 1) {
        for (let i = 1; i < overviewButtons.length; i++) overviewButtons[i].remove();
        log(`Removed ${overviewButtons.length - 1} duplicate Overview button(s).`);
      }

      const bbttccUi = game.bbttcc?.ui || {};
      if (bbttccUi.travelConsole) {
        ensureButton(toolbar, {
          id: "bbttcc-btn-travel-console",
          label: "Travel Console",
          icon: "route",
          onClick: () => bbttccUi.travelConsole.render(true)
        });
      }

      const terrApi = game.bbttcc?.api?.territory;
      if (terrApi) {
        ensureButton(toolbar, {
          id: "bbttcc-btn-turn-driver",
          label: "Turn Driver",
          icon: "forward",
          onClick: async () => {
            try {
              if (!game.user?.isGM) {
                ui.notifications?.warn?.("Only the GM can advance the turn.");
                return;
              }

              const sceneId = canvas?.scene?.id || null;

              const ok = await Dialog.confirm({
                title: "Advance Turn",
                content: "<p>Advance the strategic turn now? This will apply all pending effects.</p>",
                yes: () => true,
                no: () => false,
                defaultYes: false
              }).catch(() => false);

              if (!ok) return;

              if (typeof terrApi.advanceTurn === "function") {
                const result = await terrApi.advanceTurn({ apply: true, sceneId });
                console.log("[bbttcc-ui] Turn advanced via toolbar:", result);
              } else {
                console.warn("[bbttcc-ui] Turn Driver: advanceTurn API not available.");
                ui.notifications?.error?.("Turn Driver: advanceTurn API not available.");
              }
            } catch (e) {
              console.warn("[bbttcc-ui] Turn Driver button error", e);
              ui.notifications?.error?.("Turn Driver encountered an error. See console for details.");
            }
          }
        });
      }

      killLegacyTravelPills();
      log("BBTTCC control bar augmented (Travel Console + Turn Driver).");
    } catch (e) {
      warn("augmentToolbar error", e);
    }
  }

  function refresh() {
    setTimeout(augmentToolbar, 0);
  }

  Hooks.on("ready", refresh);
  Hooks.on("canvasReady", refresh);
  Hooks.on("renderSceneControls", refresh);
})();