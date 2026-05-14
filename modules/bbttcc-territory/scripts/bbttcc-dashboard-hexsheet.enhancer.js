// modules/bbttcc-territory/scripts/bbttcc-dashboard-hexsheet.enhancer.js
// BBTTCC — Dashboard Enhancer: Add "Sheet" button next to row actions (AppV2-safe)
// Fix: guarantee we pass a real UUID (avoid null.startsWith crash in Foundry internals)

(() => {
  const TAG = "[bbttcc-dashboard/hexsheet]";

  function getRoot(app, html) {
    if (app?.form instanceof HTMLElement) return app.form;
    try {
      if (html && html[0] instanceof HTMLElement) return html[0];
      if (html instanceof HTMLElement) return html;
    } catch (_) {}
    return document.querySelector("#bbttcc-territory-dashboard");
  }

  function resolveUuidFromRow(actionsRow) {
    // Prefer any existing button that already carries uuid
    const hasUuid = actionsRow.querySelector("[data-uuid]");
    const uuidA = hasUuid?.dataset?.uuid;
    if (uuidA) return uuidA;

    // Prefer Edit (your HBS sets data-uuid on edit)
    const edit = actionsRow.querySelector('button[data-action="edit"]');
    const uuidB = edit?.dataset?.uuid;
    if (uuidB) return uuidB;

    // Try Focus if it has uuid
    const focus = actionsRow.querySelector('button[data-action="focus"]');
    const uuidC = focus?.dataset?.uuid;
    if (uuidC) return uuidC;

    // Fallback: resolve from drawing id if present
    const id = edit?.dataset?.id || focus?.dataset?.id;
    if (id && canvas?.scene?.drawings) {
      const dr = canvas.scene.drawings.get(id);
      return dr?.uuid || "";
    }
    return "";
  }

  function makeSheetButton(uuid, id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bbttcc-hexsheet-btn";
    btn.dataset.uuid = uuid || "";
    btn.dataset.id = id || "";
    btn.innerHTML = `<i class="fas fa-scroll"></i> Sheet`;
    btn.style.marginLeft = "4px";

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        let u = btn.dataset.uuid;

        // Last-chance fallback from id
        if (!u && btn.dataset.id && canvas?.scene?.drawings) {
          const dr = canvas.scene.drawings.get(btn.dataset.id);
          u = dr?.uuid || "";
        }

        if (!u) {
          ui.notifications?.warn?.("Could not resolve hex UUID for sheet.");
          return;
        }

        const fn = game.bbttcc?.api?.territory?.openHexSheet;
        if (typeof fn !== "function") {
          ui.notifications?.warn?.("Hex Sheet API not available.");
          return;
        }

        fn(u);
      } catch (e) {
        console.warn(TAG, "Sheet open failed:", e);
        ui.notifications?.error?.("Failed to open Hex Sheet (see console).");
      }
    });

    return btn;
  }

  function inject(root) {
    if (!root) return;

    // We’ll inject once per row (actions flexrow)
    const actionRows = root.querySelectorAll("td:last-child .flexrow");
    actionRows.forEach((actionsRow) => {
      if (actionsRow.querySelector(".bbttcc-hexsheet-btn")) return;

      const edit = actionsRow.querySelector('button[data-action="edit"]');
      const focus = actionsRow.querySelector('button[data-action="focus"]');

      const id = edit?.dataset?.id || focus?.dataset?.id || "";
      const uuid = resolveUuidFromRow(actionsRow);

      // If we can’t resolve uuid now, still inject but it will warn instead of crashing Foundry
      actionsRow.appendChild(makeSheetButton(uuid, id));
    });
  }

  Hooks.on("renderBBTTCC_TerritoryDashboard", (app, html) => {
    try { inject(getRoot(app, html)); }
    catch (err) { console.warn(TAG, "Error injecting Sheet buttons:", err); }
  });

  Hooks.once("ready", () => console.log(TAG, "Dashboard Hex Sheet enhancer installed (UUID-safe)."));
})();
