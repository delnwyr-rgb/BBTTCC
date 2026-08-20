// Bad Eden — Tableau: GM live-tuning control panel
// ─────────────────────────────────────────────────────────────────────────────
// Per-scene live tuning for the forced-perspective tableau substrate
// (courtly tableaux, combat staging, cinematic scenes, etc.). Sliders update
// tokens in real time as you drag — every input event debounce-persists the
// value to `scene.flags.bbttcc-raid.tableau` so each scene keeps its own feel.
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
    ui.notifications.warn("Tableau tune: GM only.");
    return;
  }
  const api = foundry.utils.getProperty(game, "bbttcc.api.raid.tableau");
  if (!api) {
    ui.notifications.error("Tableau substrate not loaded. Check bbttcc-raid module is active.");
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
  // Stage band = where the ARTWORK really is. A 16:9 backdrop on a taller canvas
  // carries baked-in black bars that the scene rect counts as stage, so every
  // default below is derived from the art, not from the dead pixels around it.
  const bandTop = Number.isFinite(Number(cur.stageTop))    ? Number(cur.stageTop)    : sy;
  const bandBot = Number.isFinite(Number(cur.stageBottom)) ? Number(cur.stageBottom) : (sy + sh);
  const bandH   = Math.max(1, bandBot - bandTop);
  const v0   = {
    enabled:  !!cur.enabled,
    stageTop:    Number.isFinite(Number(cur.stageTop))    ? Number(cur.stageTop)    : "",
    stageBottom: Number.isFinite(Number(cur.stageBottom)) ? Number(cur.stageBottom) : "",
    frontY:   Number(cur.frontY   ?? Math.round(bandTop + bandH * 0.90)),
    backY:    Number(cur.backY    ?? Math.round(bandTop + bandH * 0.10)),
    tokenSize: Number(cur.tokenSize ?? 6),
    minScale: Number(cur.minScale ?? 0.25),
    maxScale: Number(cur.maxScale ?? 1.00),
    curve:    Number(cur.curve    ?? 1.8)
  };

  const fmt = (n, d = 2) => Number(n).toFixed(d);

  // Layout rule (per memory: [[dialogv2-scroll-pattern]]): V13/14 dialogs
  // ignore form-level flex/height and will inflate to fill the viewport. So
  // the FORM is plain block; only per-row containers use flex; the whole
  // thing sits inside an explicit max-height scroll wrapper.
  const rowStyle = 'display:flex; align-items:center; gap:8px; margin:6px 0;';
  const labelStyle = 'min-width:110px;';
  const valStyle = 'min-width:40px; text-align:right; font-family:monospace;';

  const content = `
    <div style="max-height:60vh; overflow-y:auto; padding-right:6px;">
      <form class="ft-tableau-form">
        <p class="hint" style="margin:0 0 8px;">
          <b>${scene.name}</b> — scene area Y ∈ [${sy}, ${sy + sh}] (${sh}px tall)<br/>
          ${(v0.stageTop !== "" || v0.stageBottom !== "")
            ? `<span style="color:#e8c84a;">stage (art) Y ∈ [${Math.round(bandTop)}, ${Math.round(bandBot)}] (${Math.round(bandH)}px tall) — ${Math.round(sh - bandH)}px of letterbox ignored</span><br/>`
            : `<span style="opacity:.6;">stage = whole scene (no letterbox declared)</span><br/>`}
          Status: <span data-status>${v0.enabled ? "✅ ENABLED" : "⛔ disabled"}</span>
        </p>

        <hr style="margin:6px 0;"/>
        <p style="margin:0 0 4px;"><b>Depth Curve</b> — drag sliders to feel the perspective on this backdrop.</p>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Curve</label>
          <input type="range" name="curve" min="0.5" max="3.5" step="0.1" value="${v0.curve}" style="flex:1; min-width:0;"/>
          <span data-label="curve" style="${valStyle}">${fmt(v0.curve, 1)}</span>
        </div>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Min scale</label>
          <input type="range" name="minScale" min="0.05" max="1.00" step="0.05" value="${v0.minScale}" style="flex:1; min-width:0;"/>
          <span data-label="minScale" style="${valStyle}">${fmt(v0.minScale)}</span>
        </div>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Max scale</label>
          <input type="range" name="maxScale" min="0.50" max="5.00" step="0.05" value="${v0.maxScale}" style="flex:1; min-width:0;"/>
          <span data-label="maxScale" style="${valStyle}">${fmt(v0.maxScale)}</span>
        </div>
        <p class="hint" style="margin:-2px 0 4px 118px; font-size:0.85em;">
          1.0 = native token size. Push higher for dramatic foreground figures.
        </p>

        <hr style="margin:8px 0 6px;"/>
        <p style="margin:0 0 4px;"><b>Stage Zone</b> — Y bounds of the perspective region (in canvas px).</p>

        <p class="hint" style="margin:4px 0;">
          <span style="color:#5f5;">▲ green line</span> = front (max scale);
          <span style="color:#f55;">▼ red line</span> = back (min scale).
          Drag a token to where you want each line, then click "Set from selected".
        </p>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Stage top</label>
          <input type="number" name="stageTop" value="${v0.stageTop}" step="20" placeholder="(scene top)" style="width:110px;"/>
          <button type="button" data-act="setStageTopFromToken" style="white-space:nowrap;">Set from selected ▲</button>
        </div>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Stage bottom</label>
          <input type="number" name="stageBottom" value="${v0.stageBottom}" step="20" placeholder="(scene bottom)" style="width:110px;"/>
          <button type="button" data-act="setStageBottomFromToken" style="white-space:nowrap;">Set from selected ▼</button>
        </div>
        <p style="opacity:.7; font-size:11px; margin:2px 0 8px;">
          Where the ARTWORK starts and ends, when the backdrop has black bars baked into it.
          Leave blank to use the whole scene. Tokens dragged into a bar scale as if standing at
          the nearest edge of the picture instead of off-stage at full size, and Reset to Defaults
          spreads the perspective across the art rather than the dead pixels.
        </p>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Front Y</label>
          <input type="number" name="frontY" value="${v0.frontY}" step="20" style="width:110px;"/>
          <button type="button" data-act="setFrontFromToken" style="white-space:nowrap;">Set from selected ▲</button>
        </div>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Back Y</label>
          <input type="number" name="backY" value="${v0.backY}" step="20" style="width:110px;"/>
          <button type="button" data-act="setBackFromToken" style="white-space:nowrap;">Set from selected ▼</button>
        </div>

        <hr style="margin:8px 0 6px;"/>

        <div style="${rowStyle}">
          <label style="${labelStyle}">Drop size</label>
          <input type="number" name="tokenSize" value="${v0.tokenSize}" min="0" max="20" step="1" style="width:110px;"/>
          <button type="button" data-act="sizeExisting" style="white-space:nowrap;">Apply to existing 1×1</button>
        </div>
        <p style="opacity:.7; font-size:11px; margin:2px 0 6px;">
          Tokens dropped on this scene at Foundry's default 1×1 are grown to this footprint
          automatically — tableau art is portrait-scale, not battlemap-scale. Any other size is
          treated as deliberate and left alone; 0 turns the auto-size off. Depth multiplies on top.
        </p>

        <div style="display:flex; gap:6px; flex-wrap:wrap; margin:6px 0;">
          <button type="button" data-act="markSel">Mark Selected as Courtier</button>
          <button type="button" data-act="unmarkSel">Unmark Selected</button>
          <button type="button" data-act="reset">Reset to Defaults</button>
          <button type="button" data-act="disable" style="color:#c66;">Disable Tableau</button>
        </div>

        <p class="hint" style="margin:6px 0 0;">
          Sliders apply <b>LIVE</b> — drag and watch tokens resize. Settings persist per scene.
        </p>
      </form>
    </div>
  `;

  new Dialog({
    title: "Courtly Tableau — Live Tuning",
    content,
    buttons: { close: { label: "Close" } },
    default: "close",
    close: () => { try { api.hideGuides(); } catch (_e) {} },
    render: (html) => {
      try { api.showGuides(scene); } catch (_e) {}
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

      const numOrNull = (sel) => {
        const raw = String(form.querySelector(sel).value ?? "").trim();
        return raw === "" ? null : Number(raw);
      };
      const readForm = () => ({
        stageTop:    numOrNull('[name="stageTop"]'),
        stageBottom: numOrNull('[name="stageBottom"]'),
        tokenSize: Number(form.querySelector('[name="tokenSize"]').value),
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

          if (act === "setFrontFromToken") {
            if (sel.length !== 1) return ui.notifications.warn("Select exactly one token to anchor Front Y.");
            // Use the token's footprint center as the anchor so the line
            // sits at the visual middle of the token, not its top-left.
            const tk = sel[0];
            const y = Math.round(Number(tk.document?.y ?? 0) + (tk.h || 0) / 2);
            const input = form.querySelector('[name="frontY"]');
            input.value = y;
            updateLabels();
            persist(readForm());
            ui.notifications.info(`Front Y set to ${y} (token "${tk.name || tk.id}" center).`);
          } else if (act === "setBackFromToken") {
            if (sel.length !== 1) return ui.notifications.warn("Select exactly one token to anchor Back Y.");
            const tk = sel[0];
            const y = Math.round(Number(tk.document?.y ?? 0) + (tk.h || 0) / 2);
            const input = form.querySelector('[name="backY"]');
            input.value = y;
            updateLabels();
            persist(readForm());
            ui.notifications.info(`Back Y set to ${y} (token "${tk.name || tk.id}" center).`);
          } else if (act === "setStageTopFromToken" || act === "setStageBottomFromToken") {
            // Top edge takes the token's TOP, bottom edge its BOTTOM — you drag a
            // token flush against the letterbox seam and the edge snaps to the
            // side of it that touches the art (Front/Back Y use centres, because
            // those mark where a token STANDS, not where the picture stops).
            if (sel.length !== 1) return ui.notifications.warn("Select exactly one token to anchor the stage edge.");
            const tk = sel[0];
            const top = act === "setStageTopFromToken";
            const y = Math.round(Number(tk.document?.y ?? 0) + (top ? 0 : (tk.h || 0)));
            form.querySelector(top ? '[name="stageTop"]' : '[name="stageBottom"]').value = y;
            persist(readForm());
            ui.notifications.info(`Stage ${top ? "top" : "bottom"} set to ${y} (token "${tk.name || tk.id}").`);
          } else if (act === "sizeExisting") {
            // Retro-fit the drop-time size onto tokens already on the scene.
            // Persist the field first so the API reads the value on screen.
            persist(readForm());
            const target = Number(form.querySelector('[name="tokenSize"]').value) || 0;
            if (target <= 0) return ui.notifications.warn("Set a drop size above 0 first.");
            await api.sizeExisting(canvas.scene, { size: target });
          } else if (act === "markSel") {
            if (!sel.length) return ui.notifications.warn("No tokens selected.");
            for (const tk of sel) await api.markActor(tk, true);
            ui.notifications.info(`Marked ${sel.length} as courtier.`);
          } else if (act === "unmarkSel") {
            if (!sel.length) return ui.notifications.warn("No tokens selected.");
            for (const tk of sel) await api.markActor(tk, false);
            ui.notifications.info(`Unmarked ${sel.length}.`);
          } else if (act === "reset") {
            // Derive from the CURRENT stage band, not the scene rect — resetting
            // the curve should not throw away a letterbox the GM measured.
            const rTop = numOrNull('[name="stageTop"]') ?? sy;
            const rBot = numOrNull('[name="stageBottom"]') ?? (sy + sh);
            const rH   = Math.max(1, rBot - rTop);
            const defaults = {
              frontY:   Math.round(rTop + rH * 0.90),
              backY:    Math.round(rTop + rH * 0.10),
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
