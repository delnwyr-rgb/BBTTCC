// modules/bbttcc-territory/scripts/bbttcc-dashboard-hexsheet.enhancer.js
// BBTTCC — Dashboard Enhancer: Add "Sheet" button next to Focus/Edit/Delete
//
// This enhancer looks for the Focus button in each hex row of the
// Territory Dashboard and adds a "Sheet" button that opens the
// 4X-style Hex Sheet UI (BBTTCC_HexSheet).

(() => {
  const TAG = "[bbttcc-dashboard/hexsheet]";

  /** Create a small "Sheet" button wired to openHexSheet(uuid/id). */
  function makeSheetButton(dataset) {
    const btn = document.createElement("button");
    btn.className = "bbttcc-hexsheet-btn";
    btn.dataset.uuid = dataset.uuid || "";
    btn.dataset.id   = dataset.id   || "";
    btn.type = "button";

    btn.style.marginLeft = "4px";
    btn.style.padding = "2px 6px";
    btn.style.fontSize = "0.75rem";
    btn.style.borderRadius = "4px";
    btn.style.border = "1px solid rgba(148,163,184,0.6)";
    btn.style.background = "rgba(15,23,42,0.8)";
    btn.style.color = "#e5e7eb";
    btn.style.cursor = "pointer";
    btn.style.whiteSpace = "nowrap";

    btn.textContent = "Sheet";

    btn.addEventListener("click", async ev => {
      ev.stopPropagation();
      ev.preventDefault();
      try {
        let uuid = btn.dataset.uuid;
        // Fallback: resolve from id if we only have an id
        if (!uuid && btn.dataset.id && canvas?.scene?.drawings) {
          const dr = canvas.scene.drawings.get(btn.dataset.id);
          uuid = dr?.uuid;
        }
        if (!uuid) {
          ui.notifications?.warn?.("Could not resolve hex UUID for sheet.");
          return;
        }
        if (typeof game.bbttcc?.api?.territory?.openHexSheet === "function") {
          game.bbttcc.api.territory.openHexSheet(uuid);
        } else {
          ui.notifications?.warn?.("Hex Sheet API not available.");
        }
      } catch (e) {
        console.warn(TAG, "Failed to open hex sheet:", e);
        ui.notifications?.error?.("Hex Sheet failed to open (see console).");
      }
    });

    return btn;
  }

  /** Inject "Sheet" buttons whenever the Territory Dashboard renders. */
  Hooks.on("renderBBTTCC_TerritoryDashboard", (app, html) => {
    try {
      const root = html[0] || html;
      if (!root) return;

      // Find all Focus buttons — they already carry id/uuid data we need
      const focusButtons = root.querySelectorAll('button[data-action="focus"]');
      focusButtons.forEach(focusBtn => {
        const cell = focusBtn.closest("td");
        if (!cell) return;

        // Avoid double injection
        if (cell.querySelector(".bbttcc-hexsheet-btn")) return;

        const sheetBtn = makeSheetButton(focusBtn.dataset);
        cell.appendChild(sheetBtn);
      });
    } catch (err) {
      console.warn(TAG, "Error injecting Sheet buttons:", err);
    }
  });

  Hooks.once("ready", () => {
    console.log(TAG, "Dashboard Hex Sheet enhancer installed (Focus→Sheet wired).");
  });

})();
