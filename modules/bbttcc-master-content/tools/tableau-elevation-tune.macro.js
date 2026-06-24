// BBTTCC — Tableau: 3D Elevation Depth tuner
// ─────────────────────────────────────────────────────────────────────────────
// Per-scene live tuning for the ELEVATION axis of the tableau substrate — the
// fake-3D mode where a token's Foundry elevation drives its visual scale, so
// descending reads as further/smaller and rising as closer/larger. Underwater /
// air / space scenes auto-enable this when you link them; use this to taste it.
//
// Move a token up/down with the Token HUD elevation field (the ⬍ value) and
// watch it resize. Sliders persist to scene.flags.bbttcc-raid.tableau live.
//
//   game.bbttcc.api.raid.tableau.enable({ axis:"elevation", nearElev:0, farElev:-60 })
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) { ui.notifications.warn("Tableau tune: GM only."); return; }
  const api = foundry.utils.getProperty(game, "bbttcc.api.raid.tableau");
  if (!api) { ui.notifications.error("Tableau substrate not loaded (bbttcc-raid)."); return; }
  const scene = canvas?.scene;
  if (!scene) { ui.notifications.warn("No active scene."); return; }

  const cur = api.readConfig(scene);
  const v0 = {
    nearElev: Number(cur.nearElev ?? 40),
    farElev:  Number(cur.farElev  ?? -40),
    minScale: Number(cur.minScale ?? 0.35),
    maxScale: Number(cur.maxScale ?? 1.25),
    curve:    Number(cur.curve    ?? 1.5),
    depthSource: String(cur.depthSource || "elevation")
  };
  const fmt = (n, d = 2) => Number(n).toFixed(d);
  const row = "display:flex; align-items:center; gap:8px; margin:6px 0;";
  const lab = "min-width:96px;";
  const val = "min-width:46px; text-align:right; font-family:monospace;";

  const content = `
    <div style="max-height:60vh; overflow-y:auto; padding-right:6px;">
      <form class="ft-tableau-elev-form">
        <p class="hint" style="margin:0 0 8px;">
          <b>${scene.name}</b> — fake-3D depth by token <b>elevation</b>.<br/>
          Status: <span data-status>${cur.enabled && cur.axis === "elevation" ? "✅ ENABLED (elevation)" : "⛔ off / not elevation"}</span>
        </p>
        <hr style="margin:6px 0;"/>
        <div style="${row}">
          <label style="${lab}">Depth from</label>
          <select name="depthSource" style="flex:1; min-width:0;">
            <option value="elevation" ${v0.depthSource === "elevation" ? "selected" : ""}>Token elevation (move via Token HUD · Levels OFF)</option>
            <option value="flag" ${v0.depthSource === "flag" ? "selected" : ""}>Depth flag (leaves elevation for Levels · move via ± below)</option>
          </select>
        </div>
        <div style="${row}">
          <label style="${lab}">Scene top</label>
          <input type="number" name="nearElev" value="${v0.nearElev}" step="5" style="width:90px;"/>
          <button type="button" data-act="nearFromTok" style="white-space:nowrap;">Set from selected ▲ (biggest)</button>
        </div>
        <div style="${row}">
          <label style="${lab}">Deepest</label>
          <input type="number" name="farElev" value="${v0.farElev}" step="5" style="width:90px;"/>
          <button type="button" data-act="farFromTok" style="white-space:nowrap;">Set from selected ▼ (smallest)</button>
        </div>
        <p class="hint" style="margin:-2px 0 6px 100px; font-size:0.85em;">
          Scene top = biggest (near plane), Deepest = smallest. Ground map sits at elevation 0.
          Depth never sinks a token under the map — render order is pinned.
        </p>
        <hr style="margin:8px 0 6px;"/>
        <div style="${row}">
          <label style="${lab}">Min scale</label>
          <input type="range" name="minScale" min="0.05" max="1.00" step="0.05" value="${v0.minScale}" style="flex:1; min-width:0;"/>
          <span data-label="minScale" style="${val}">${fmt(v0.minScale)}</span>
        </div>
        <div style="${row}">
          <label style="${lab}">Max scale</label>
          <input type="range" name="maxScale" min="0.50" max="3.00" step="0.05" value="${v0.maxScale}" style="flex:1; min-width:0;"/>
          <span data-label="maxScale" style="${val}">${fmt(v0.maxScale)}</span>
        </div>
        <div style="${row}">
          <label style="${lab}">Curve</label>
          <input type="range" name="curve" min="0.5" max="3.5" step="0.1" value="${v0.curve}" style="flex:1; min-width:0;"/>
          <span data-label="curve" style="${val}">${fmt(v0.curve, 1)}</span>
        </div>
        <hr style="margin:8px 0 6px;"/>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin:6px 0;">
          <button type="button" data-act="enable">Enable (elevation)</button>
          <button type="button" data-act="nudgeUp">Selected +10 ⬆</button>
          <button type="button" data-act="nudgeDown">Selected −10 ⬇</button>
          <button type="button" data-act="disable" style="color:#c66;">Disable</button>
        </div>
        <p class="hint" style="margin:6px 0 0;">Sliders apply LIVE. Move a token's elevation (Token HUD) to see it resize.</p>
      </form>
    </div>`;

  new Dialog({
    title: "Tableau — 3D Elevation Depth",
    content,
    buttons: { close: { label: "Close" } },
    default: "close",
    render: (html) => {
      const root = html[0] || html;
      const form = root.querySelector("form") || root;
      const statusEl = form.querySelector("[data-status]");
      const readForm = () => ({
        axis: "elevation",
        depthSource: form.querySelector('[name="depthSource"]').value,
        nearElev: Number(form.querySelector('[name="nearElev"]').value),
        farElev:  Number(form.querySelector('[name="farElev"]').value),
        minScale: Number(form.querySelector('[name="minScale"]').value),
        maxScale: Number(form.querySelector('[name="maxScale"]').value),
        curve:    Number(form.querySelector('[name="curve"]').value)
      });
      const labels = () => {
        const v = readForm();
        form.querySelector('[data-label="minScale"]').textContent = fmt(v.minScale);
        form.querySelector('[data-label="maxScale"]').textContent = fmt(v.maxScale);
        form.querySelector('[data-label="curve"]').textContent    = fmt(v.curve, 1);
      };
      let timer = null;
      const persist = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          await api.enable(readForm(), scene);
          if (statusEl) statusEl.textContent = "✅ ENABLED (elevation)";
        }, 80);
      };
      form.querySelectorAll("input, select").forEach(el => el.addEventListener("input", () => { labels(); persist(); }));
      form.querySelectorAll("input, select").forEach(el => el.addEventListener("change", () => { labels(); persist(); }));

      form.querySelectorAll("button[data-act]").forEach(btn => btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const act = btn.dataset.act;
        const sel = canvas.tokens?.controlled || [];
        if (act === "nearFromTok" || act === "farFromTok") {
          if (sel.length !== 1) return ui.notifications.warn("Select exactly one token.");
          const e = Number(sel[0].document?.elevation ?? 0);
          form.querySelector(act === "nearFromTok" ? '[name="nearElev"]' : '[name="farElev"]').value = e;
          persist(); ui.notifications.info(`${act === "nearFromTok" ? "Near" : "Far"} elev set to ${e}.`);
        } else if (act === "nudgeUp" || act === "nudgeDown") {
          if (!sel.length) return ui.notifications.warn("No tokens selected.");
          const d = act === "nudgeUp" ? 10 : -10;
          const useFlag = form.querySelector('[name="depthSource"]').value === "flag";
          for (const tk of sel) {
            if (useFlag && api.setDepth) await api.setDepth(tk, d, { relative: true, scene });
            else await tk.document.update({ elevation: Number(tk.document.elevation ?? 0) + d });
          }
        } else if (act === "enable") {
          await api.enable(readForm(), scene);
          if (statusEl) statusEl.textContent = "✅ ENABLED (elevation)";
        } else if (act === "disable") {
          await api.disable(scene);
          if (statusEl) statusEl.textContent = "⛔ disabled";
        }
      }));
    }
  }, { width: 560 }).render(true);
})();
