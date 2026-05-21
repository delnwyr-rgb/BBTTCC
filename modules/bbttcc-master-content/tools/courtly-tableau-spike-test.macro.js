// BBTTCC — Courtly Tableau Phase A spike: live-tuning control panel
// ─────────────────────────────────────────────────────────────────────────────
// Per-scene live tuning for the depth-scale tableau. Sliders update tokens
// in real time as you drag — every input event debounce-persists the value
// to `scene.flags.bbttcc-raid.tableau` so each scene keeps its own feel.
//
// Drop this into a Script macro (or import as a hotbar macro) and run from
// inside the scene you want to configure.
//
// Tableau API (also callable from console):
//   game.bbttcc.api.raid.tableau.enable({ curve: 2.2, minScale: 0.20 })
//   game.bbttcc.api.raid.tableau.setFrontBack(2484, 756)
//   game.bbttcc.api.raid.tableau.markActor(canvas.tokens.controlled[0], true)
//   game.bbttcc.api.raid.tableau.readConfig()
//   game.bbttcc.api.raid.tableau.disable()
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user?.isGM) {
    ui.notifications.warn("Tableau spike: GM only.");
    return;
  }
  const api = foundry.utils.getProperty(game, "bbttcc.api.raid.tableau");
  if (!api) {
    ui.notifications.error("Tableau spike script not loaded. Check bbttcc-raid module.");
    return;
  }
  const scene = canvas?.scene;
  if (!scene) {
    ui.notifications.warn("No active scene.");
    return;
  }

  const dims = scene.dimensions || {};
  const sy   = Number(dims.sceneY ?? 0);
  const sh   = Number(dims.sceneHeight ?? 1080);
  const cur  = api.readConfig(scene);
  const v0   = {
    enabled:  !!cur.enabled,
    frontY:   Number(cur.frontY   ?? Math.round(sy + sh * 0.90)),
    backY:    Number(cur.backY    ?? Math.round(sy + sh * 0.10)),
    minScale: Number(cur.minScale ?? 0.25),
    maxScale: Number(cur.maxScale ?? 1.00),
    curve:    Number(cur.curve    ?? 1.8)
  };

  const fmt = (n, d = 2) => Number(n).toFixed(d);

  const content = `
    <form class="ft-tableau-form" style="display:flex; flex-direction:column; gap:8px;">
      <p class="hint" style="margin:0;">
        <b>${scene.name}</b> — scene area Y ∈ [${sy}, ${sy + sh}] (${sh}px tall)<br/>
        Status: <span data-status>${v0.enabled ? "✅ ENABLED" : "⛔ disabled"}</span>
      </p>

      <hr style="margin:4px 0;"/>
      <p style="margin:0;"><b>Depth Curve</b> — drag sliders to feel the perspective on this backdrop.</p>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <label style="min-width:110px;">Curve</label>
        <input type="range" name="curve" min="0.5" max="3.5" step="0.1" value="${v0.curve}" style="flex:1;"/>
        <span data-label="curve" style="min-width:40px; text-align:right; font-family:monospace;">${fmt(v0.curve, 1)}</span>
      </div>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <label style="min-width:110px;">Min scale</label>
        <input type="range" name="minScale" min="0.05" max="1.00" step="0.05" value="${v0.minScale}" style="flex:1;"/>
        <span data-label="minScale" style="min-width:40px; text-align:right; font-family:monospace;">${fmt(v0.minScale)}</span>
      </div>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <label style="min-width:110px;">Max scale</label>
        <input type="range" name="maxScale" min="0.50" max="2.00" step="0.05" value="${v0.maxScale}" style="flex:1;"/>
        <span data-label="maxScale" style="min-width:40px; text-align:right; font-family:monospace;">${fmt(v0.maxScale)}</span>
      </div>

      <hr style="margin:4px 0;"/>
      <p style="margin:0;"><b>Stage Zone</b> — Y bounds of the perspective region (in canvas px).</p>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <label style="min-width:110px;">Front Y</label>
        <input type="number" name="frontY" value="${v0.frontY}" step="20" style="width:110px;"/>
        <span class="hint" style="flex:1;">higher Y = closer to camera (full scale here)</span>
      </div>

      <div class="form-group" style="display:flex; align-items:center; gap:8px;">
        <label style="min-width:110px;">Back Y</label>
        <input type="number" name="backY" value="${v0.backY}" step="20" style="width:110px;"/>
        <span class="hint" style="flex:1;">lower Y = back wall (min scale here)</span>
      </div>

      <hr style="margin:4px 0;"/>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button type="button" data-act="markSel">Mark Selected as Courtier</button>
        <button type="button" data-act="unmarkSel">Unmark Selected</button>
        <button type="button" data-act="reset">Reset to Defaults</button>
        <button type="button" data-act="disable" style="color:#c66;">Disable Tableau</button>
      </div>

      <p class="hint" style="margin:4px 0 0;">
        Sliders apply <b>LIVE</b> — drag and watch tokens resize. Settings persist per scene.
      </p>
    </form>
  `;

  new Dialog({
    title: "Courtly Tableau — Live Tuning",
    content,
    buttons: { close: { label: "Close" } },
    default: "close",
    render: (html) => {
      const root     = html[0] || html;
      const form     = root.querySelector("form") || root;
      const statusEl = form.querySelector("[data-status]");

      let timer = null;
      const persist = (partial) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          await api.enable(partial, scene);
          if (statusEl) statusEl.textContent = "✅ ENABLED";
        }, 80);
      };

      const readForm = () => ({
        curve:    Number(form.querySelector('[name="curve"]').value),
        minScale: Number(form.querySelector('[name="minScale"]').value),
        maxScale: Number(form.querySelector('[name="maxScale"]').value),
        frontY:   Number(form.querySelector('[name="frontY"]').value),
        backY:    Number(form.querySelector('[name="backY"]').value)
      });

      const updateLabels = () => {
        const vv = readForm();
        form.querySelector('[data-label="curve"]').textContent    = fmt(vv.curve, 1);
        form.querySelector('[data-label="minScale"]').textContent = fmt(vv.minScale);
        form.querySelector('[data-label="maxScale"]').textContent = fmt(vv.maxScale);
      };

      form.querySelectorAll("input").forEach((el) => {
        el.addEventListener("input", () => {
          updateLabels();
          persist(readForm());
        });
      });

      form.querySelectorAll("button[data-act]").forEach((btn) => {
        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          const act = btn.dataset.act;
          const sel = canvas.tokens?.controlled || [];

          if (act === "markSel") {
            if (!sel.length) return ui.notifications.warn("No tokens selected.");
            for (const tk of sel) await api.markActor(tk, true);
            ui.notifications.info(`Marked ${sel.length} as courtier.`);
          } else if (act === "unmarkSel") {
            if (!sel.length) return ui.notifications.warn("No tokens selected.");
            for (const tk of sel) await api.markActor(tk, false);
            ui.notifications.info(`Unmarked ${sel.length}.`);
          } else if (act === "reset") {
            const defaults = {
              frontY:   Math.round(sy + sh * 0.90),
              backY:    Math.round(sy + sh * 0.10),
              minScale: 0.25,
              maxScale: 1.00,
              curve:    1.8
            };
            form.querySelector('[name="curve"]').value    = defaults.curve;
            form.querySelector('[name="minScale"]').value = defaults.minScale;
            form.querySelector('[name="maxScale"]').value = defaults.maxScale;
            form.querySelector('[name="frontY"]').value   = defaults.frontY;
            form.querySelector('[name="backY"]').value    = defaults.backY;
            updateLabels();
            persist(defaults);
            ui.notifications.info("Reset to defaults.");
          } else if (act === "disable") {
            await api.disable(scene);
            if (statusEl) statusEl.textContent = "⛔ disabled";
            ui.notifications.info("Tableau disabled.");
          }
        });
      });
    }
  }, { width: 580 }).render(true);
})();
