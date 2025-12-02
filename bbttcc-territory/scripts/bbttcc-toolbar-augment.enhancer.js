// modules/bbttcc-territory/scripts/bbttcc-toolbar-augment.enhancer.js
// BBTTCC Hex Chrome HUD toolbar augment (stable version)
//
// Responsibilities:
// - Ensure the BBTTCC toolbar (#bbttcc-toolbar) has:
//     • Overview button (from overview-button.js)
//     • Travel Console button
//     • Turn Driver button (advances the strategic turn)
//     • Raid / Plan buttons (added by raid module; we leave those alone)
// - Remove legacy top-right travel pills created by older modules:
//     • <div id="bbttcc-travel-console-btn">Open Travel Console</div>
//       (from bbttcc-travel-console.js)
//     • <div id="bbttcc-travel-mode-btn">Open Travel Planner</div>
//       (from hex-travel-mode.js)
// - Re-run safely whenever the canvas / scene controls redraw.

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

  function ensureButton(toolbar, { id, label, icon, onClick }) {
    if (!toolbar) return;
    let btn = toolbar.querySelector(`#${id}`);
    if (btn) return;

    const row = toolbar.querySelector(".row") || toolbar;

    btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.className = "bbttcc-btn";
    btn.style.marginLeft = "4px";
    btn.innerHTML = `<i class="fas fa-${icon}"></i> ${label}`;
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
      const toolbar = document.getElementById("bbttcc-toolbar");
      // Even if toolbar isn't there yet, still remove legacy pills.
      killLegacyTravelPills();
      if (!toolbar) return;

      // Make sure Overview dedup still works: if multiple, keep the first.
      const overviewButtons = toolbar.querySelectorAll("#bbttcc-overview-btn");
      if (overviewButtons.length > 1) {
        const keep = overviewButtons[0];
        for (let i = 1; i < overviewButtons.length; i++) {
          overviewButtons[i].remove();
        }
        log(`Removed ${overviewButtons.length - 1} duplicate Overview button(s).`);
      }

      // Travel Console button — uses the V1 travel console app we still like.
      // The console app is created in bbttcc-travel-console.js:
      //   Hooks.once("ready", () => { game.bbttcc.ui.travelConsole = new BBTTCC_TravelConsole(); ... })
      const bbttccUi = game.bbttcc?.ui || {};
      if (bbttccUi.travelConsole) {
        ensureButton(toolbar, {
          id: "bbttcc-btn-travel-console",
          label: "Travel Console",
          icon: "route",
          onClick: () => bbttccUi.travelConsole.render(true)
        });
      }

      // Turn Driver button — actually advance the strategic turn.
      // Uses game.bbttcc.api.territory.advanceTurn({ apply, sceneId }).
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

              // Dialog.confirm expects yes/no as FUNCTIONS, not strings.
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

      // Finally, make sure legacy pills are gone (in case they were created after we started)
      killLegacyTravelPills();

      log("BBTTCC HUD toolbar augmented (Travel Console + Turn Driver).");
    } catch (e) {
      warn("augmentToolbar error", e);
    }
  }

  function refresh() {
    // Run after other ready/canvas hooks so their UI has a chance to spawn.
    setTimeout(augmentToolbar, 0);
  }

  Hooks.on("ready", refresh);
  Hooks.on("canvasReady", refresh);
  Hooks.on("renderSceneControls", refresh);
})();
