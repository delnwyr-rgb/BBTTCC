// scene-overlay-manager.macro.js — RUN IN-WORLD (GM). Toggle / remove BBTTCC overlay Tiles.
// ─────────────────────────────────────────────────────────────────────────────
// BAD EDEN · SCENE OVERLAY MANAGER — companion to scene-overlay-helper.macro.js.
// Lists every overlay Tile on the CURRENT scene (those carrying the
// flags["bbttcc-travel"].overlay stamp), with per-overlay show/hide + delete, bulk
// Show/Hide/Delete-all, toggle the gold "Hexchrome" glow-FRAME on/off, and EDIT — re-open
// the full Helper-style interface for one overlay to retune its look / geometry / image in
// place. Use it to declutter, A/B a look, or clean up. Only touches OUR overlay tiles —
// hand-placed art Tiles (no overlay flag) are left alone.
// Bundles the SAME effect renderer as the helper (guarded by one shared key, so running
// both never double-hooks) → blend/pulse/frame render even if the helper wasn't run this
// session. Self-contained. No ft-deploy / restart — paste into a GM Script macro and run.
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  if (!canvas?.scene)   return ui.notifications.warn("No active scene — view a scene first.");

  const MOD = "bbttcc-travel";
  const scene = canvas.scene;
  const log = (...a) => console.log("[overlay-manager]", ...a);

  // ── SHARED EFFECT RENDERER (identical to scene-overlay-helper.macro.js) ──────
  //   Bundled so this manager renders blend/pulse/frame standalone — even if the
  //   helper wasn't run this session. Registers ONCE via the shared guard key, so
  //   running both macros never double-hooks. (Permanent home since 2026-07-04:
  //   scripts/scene-overlay-renderer.js — this copy is for in-session hot-swap tuning.)
  game.bbttcc = game.bbttcc || {};
  const blendOf = (name) => {
    const B = PIXI.BLEND_MODES;
    return ({ normal: B.NORMAL, add: B.ADD, screen: B.SCREEN, multiply: B.MULTIPLY, overlay: B.OVERLAY ?? B.NORMAL })[name] ?? B.NORMAL;
  };
  const frameLayer = () => {
    if (!canvas?.primary) return null;
    let L = game.bbttcc.__overlayFrameLayer;
    if (!L || L.destroyed || L.parent !== canvas.primary) {
      // Adopt an existing layer on this scene's primary before creating a new
      // one — a lost reference must NEVER orphan a still-rendering layer, or
      // its frames duplicate (clearFrame only searches the current layer).
      L = canvas.primary.children?.find((c) => c.name === "bbttcc-overlay-frames" && !c.destroyed);
      if (!L) {
        L = new PIXI.Container();
        L.label = L.name = "bbttcc-overlay-frames";
        L.sortableChildren = true; L.eventMode = "none"; L.zIndex = 8000;
        canvas.primary.addChild(L);
      }
      game.bbttcc.__overlayFrameLayer = L;
    }
    return L;
  };
  const clearFrame = (id) => {
    const L = game.bbttcc.__overlayFrameLayer;
    if (!L || L.destroyed) return;
    const ex = L.children?.find((c) => c.name === `frame:${id}`);
    if (ex) { L.removeChild(ex); ex.destroy({ children: true }); }
  };
  const drawFrame = (tile) => {
    const doc = tile?.document; if (!doc) return;
    clearFrame(doc.id);
    const o = doc.getFlag?.(MOD, "overlay");
    if (!o?.frame) { tile._bbttccFrame = null; return; }
    const L = frameLayer(); if (!L) return;
    const w = doc.width, h = doc.height;
    const mesh = tile.mesh;
    const ax = mesh?.anchor?.x ?? 0.5, ay = mesh?.anchor?.y ?? 0.5;
    const g = new PIXI.Graphics();
    g.name = `frame:${doc.id}`; g.eventMode = "none";
    if (mesh?.parent) {   // bind to the mesh's real transform so the frame stays on the image
      g.position.copyFrom(L.toLocal(mesh.getGlobalPosition(new PIXI.Point())));
      g.rotation = mesh.rotation || 0;
    } else {
      g.position.set(doc.x + w / 2, doc.y + h / 2);
      g.rotation = ((doc.rotation || 0) * Math.PI) / 180;
    }
    const col = o.frameColor ?? 0xe0a82e, sheen = 0xfff1a8;
    const rad = o.frameRadius ?? Math.min(w, h) * 0.06;
    const t = o.frameThickness ?? Math.max(3, Math.min(w, h) * 0.012);
    const gi = o.frameGlow ?? 1;
    const left = -ax * w, top = -ay * h;
    const rect = (inset, r) => g.drawRoundedRect(left + inset, top + inset, w - 2 * inset, h - 2 * inset, Math.max(0, r));
    for (const [m, a] of [[3.4, 0.05], [2.4, 0.08], [1.6, 0.13]]) { g.lineStyle({ width: t * m, color: col, alpha: a * gi, join: "round" }); rect(0, rad); }
    g.lineStyle({ width: t, color: col, alpha: 0.95, join: "round" }); rect(0, rad);
    g.lineStyle({ width: Math.max(1, t * 0.4), color: sheen, alpha: 0.5, join: "round" }); rect(t, Math.max(0, rad - t));
    g.alpha = 1; L.addChild(g); tile._bbttccFrame = g;
  };
  const applyOverlay = (tile) => {
    const o = tile?.document?.getFlag?.(MOD, "overlay");
    const mesh = tile?.mesh;
    if (o && mesh) {
      mesh.blendMode = blendOf(o.blend);
      if (o.tint != null) { try { mesh.tint = Number(o.tint); } catch (_e) {} }
      else { try { mesh.tint = 0xffffff; } catch (_e) {} }   // clear tint when removed
      if (!o.pulse) mesh.alpha = o.baseAlpha ?? 1;
    }
    drawFrame(tile);
  };
  const tick = () => {
    const dt = (canvas?.app?.ticker?.deltaMS ?? 16) / 1000;
    for (const tile of (canvas?.tiles?.placeables ?? [])) {
      try {
      const o = tile?.document?.getFlag?.(MOD, "overlay");
      if (!o) continue;
      const mesh = tile?.mesh;
      const fr = tile._bbttccFrame;
      if (o.spin && mesh) {   // rotation around centre; spinMode "sway" = oscillate across spinArc°
        const base = ((tile.document.rotation || 0) * Math.PI) / 180;
        const rate = ((o.spinSpeed ?? 30) * Math.PI) / 180;
        if (o.spinMode === "sway") {
          const half = Math.max(0.01, ((o.spinArc ?? 60) * Math.PI) / 360);  // ± half the sweep
          tile._bbttccSpin = (tile._bbttccSpin ?? 0) + Math.abs(rate) * dt;
          mesh.rotation = base + half * Math.sin(tile._bbttccSpin / half);
        } else {
          tile._bbttccSpin = (tile._bbttccSpin ?? 0) + rate * dt;
          mesh.rotation = base + tile._bbttccSpin;
        }
        if (o.frame && fr && !fr.destroyed) fr.rotation = mesh.rotation;
      }
      if (o.pulse) {
        tile._bbttccPhase = (tile._bbttccPhase ?? 0) + dt * (o.pulseSpeed ?? 1);
        const s = Math.sin(tile._bbttccPhase), amp = o.pulseAmp ?? 0.25;
        if (mesh) { mesh.alpha = Math.max(0, Math.min(1, (o.baseAlpha ?? 1) + amp * s)); mesh.blendMode = blendOf(o.blend); }
        if (o.frame && fr && !fr.destroyed) fr.alpha = Math.max(0, Math.min(1, 1 - amp + amp * s));
      }
      } catch (_e) {
        // Stale mesh mid-scene-swap must not throw out of a ticker callback.
      }
    }
  };
  // (Re)register + tear down any prior registration so a re-paste hot-swaps cleanly.
  const onDelete = (d) => clearFrame(d.id);
  // Scene swap: null the ref at canvasTearDown (the layer dies with the old
  // primary). Nulling at canvasReady orphaned the just-built layer → dup frames.
  const onTearDown = () => { game.bbttcc.__overlayFrameLayer = null; };
  // Post-settle sweep: redraw frames with the real mesh transforms.
  const onReady = () => {
    for (const tile of (canvas?.tiles?.placeables ?? [])) {
      try { applyOverlay(tile); } catch (_e) {}
    }
  };
  const prev = game.bbttcc.__overlayReg;
  if (prev) {
    try {
      Hooks.off("drawTile", prev.applyOverlay);
      Hooks.off("refreshTile", prev.applyOverlay);
      Hooks.off("deleteTile", prev.onDelete);
      Hooks.off("canvasReady", prev.onReady);
      if (prev.onTearDown) Hooks.off("canvasTearDown", prev.onTearDown);
      canvas.app.ticker.remove(prev.tick);
    } catch (_e) {}
  }
  Hooks.on("drawTile", applyOverlay);
  Hooks.on("refreshTile", applyOverlay);
  Hooks.on("deleteTile", onDelete);
  Hooks.on("canvasReady", onReady);
  Hooks.on("canvasTearDown", onTearDown);
  canvas.app.ticker.add(tick);
  game.bbttcc.__overlayReg = { applyOverlay, tick, onDelete, onReady, onTearDown };
  game.bbttcc.overlayApply = applyOverlay;
  log("effect hooks + ticker (re)registered (from manager)");
  for (const tile of (canvas?.tiles?.placeables ?? [])) applyOverlay(tile);

  const overlays = scene.tiles.filter((t) => t.getFlag?.(MOD, "overlay"));
  if (!overlays.length) return ui.notifications.info("No BBTTCC overlays on this scene.");

  const basename = (p) => String(p || "").split("/").pop() || "(no image)";
  // Rows default UNTICKED; overlay tiles currently selected (controlled) on the
  // canvas come pre-ticked — click a tile, run the manager, and it's ready to act on.
  const controlled = new Set((canvas.tiles?.controlled ?? []).map((p) => p.id));
  const rows = overlays.map((t, i) => {
    const o = t.getFlag(MOD, "overlay") ?? {};
    const dim = `${Math.round(t.width)}×${Math.round(t.height)}`;
    const tags = [o.blend, o.pulse ? "pulse" : null, o.spin ? (o.spinMode === "sway" ? "sway" : "spin") : null, o.frame ? "frame" : null, t.hidden ? "HIDDEN" : null].filter(Boolean).join(" · ");
    return `<tr>
      <td><input type="checkbox" name="sel" value="${t.id}" ${controlled.has(t.id) ? "checked" : ""}></td>
      <td style="opacity:${t.hidden ? .5 : 1}"><code>${foundry.utils.escapeHTML?.(basename(t.texture?.src)) ?? basename(t.texture?.src)}</code></td>
      <td style="white-space:nowrap"><small>${dim}</small></td>
      <td><small style="opacity:.75">${tags || "normal"}</small></td>
    </tr>`;
  }).join("");

  const content = `
    <p style="margin:0 0 6px"><small style="opacity:.75">Tick the overlays to act on, then choose an action. Nothing is ticked by default — overlay tiles you have selected on the canvas come pre-ticked. Bulk buttons act on the ticked rows; “All” buttons ignore the ticks.</small></p>
    <form class="bbttcc-overlay-manager">
      <p style="margin:0 0 8px">
        <label>Frame colour
          <input type="color" name="frameColor" value="#e0a82e" style="width:46px;height:24px;vertical-align:middle;padding:0;border:none;background:none">
        </label>
        <small style="opacity:.65">— applied when you hit <b>Frame ON</b> (recolours existing frames too)</small>
      </p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--color-border-light-2,#666)">
          <th><input type="checkbox" name="selAll" title="select all"></th>
          <th>Image</th><th>Size</th><th>Look</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </form>
    <p style="margin:8px 0 0"><small style="opacity:.6">${overlays.length} overlay(s) on “${foundry.utils.escapeHTML?.(scene.name) ?? scene.name}”.</small></p>`;

  const DialogV2 = foundry.applications.api?.DialogV2;
  if (!DialogV2) return ui.notifications.error("DialogV2 unavailable — update Foundry.");

  const selectedIds = (dlg) =>
    [...dlg.element.querySelectorAll('input[name="sel"]:checked')].map((el) => el.value);

  // Re-open the full Helper-style interface for ONE existing overlay and update it
  // in place (look + geometry + optionally swap the image).
  const editOverlay = async (id) => {
    const t = scene.tiles.get(id);
    if (!t) return;
    const o = t.getFlag(MOD, "overlay") ?? {};
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    const hex = (n, dflt) => (n != null ? foundry.utils.Color.from(n).toString() : dflt);
    const sel = (v, want) => (v === want ? "selected" : "");
    const curLayer = (t.elevation ?? 0) > 0 ? "overlay" : "ground";
    // Older tiles have no spinMode — infer direction from the sign of spinSpeed.
    const curSpinMode = o.spinMode ?? ((o.spinSpeed ?? 30) < 0 ? "ccw" : "cw");
    const src0 = String(t.texture?.src || "");
    const esc = (s) => foundry.utils.escapeHTML?.(s) ?? s;

    const content = `
      <form class="bbttcc-overlay-edit" style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;">
        <label>Image</label>
        <span><code id="ov-src">${esc(basename(src0))}</code>
          <button type="button" name="pick" style="margin-left:6px">Change…</button>
          <input type="hidden" name="newSrc" value=""></span>

        <label>Blend</label>
        <select name="blend">
          <option value="add" ${sel(o.blend, "add")}>Add — glowing light</option>
          <option value="screen" ${sel(o.blend, "screen")}>Screen — softer glow</option>
          <option value="multiply" ${sel(o.blend, "multiply")}>Multiply — burn-in</option>
          <option value="normal" ${sel(o.blend, "normal")}>Normal — flat decal</option>
        </select>

        <label>Layer</label>
        <select name="layer">
          <option value="ground" ${sel(curLayer, "ground")}>Ground — below tokens</option>
          <option value="overlay" ${sel(curLayer, "overlay")}>Overlay — above tokens</option>
        </select>

        <label>Opacity</label>
        <input type="number" name="alpha" value="${o.baseAlpha ?? 0.85}" min="0" max="1" step="0.05" style="width:70px">

        <label>Spin</label>
        <span><input type="checkbox" name="spin" ${o.spin ? "checked" : ""}> rotate around centre
          &nbsp; <select name="spinMode">
            <option value="cw" ${sel(curSpinMode, "cw")}>&#10227; clockwise</option>
            <option value="ccw" ${sel(curSpinMode, "ccw")}>&#10226; counter-clockwise</option>
            <option value="sway" ${sel(curSpinMode, "sway")}>&#8646; sway back &amp; forth</option>
          </select>
          speed <input type="number" name="spinSpeed" value="${Math.abs(o.spinSpeed ?? 30)}" min="0" max="360" step="5" style="width:64px"> °/sec
          arc <input type="number" name="spinArc" value="${o.spinArc ?? 60}" min="5" max="360" step="5" style="width:60px">°
          <small style="opacity:.7">(arc = total sweep, sway only)</small></span>

        <label>Tint</label>
        <span><input type="checkbox" name="tintOn" ${o.tint != null ? "checked" : ""}> apply
          <input type="color" name="tint" value="${hex(o.tint, "#39d6ff")}" style="width:46px;height:24px;vertical-align:middle;padding:0;border:none;background:none"></span>

        <label>Pulse</label>
        <span><input type="checkbox" name="pulse" ${o.pulse ? "checked" : ""}> breathe
          &nbsp; amp <input type="number" name="pulseAmp" value="${o.pulseAmp ?? 0.2}" min="0" max="0.5" step="0.05" style="width:55px">
          speed <input type="number" name="pulseSpeed" value="${o.pulseSpeed ?? 1.2}" min="0.1" max="5" step="0.1" style="width:55px"></span>

        <label>Gold frame glow</label>
        <span><input type="checkbox" name="frame" ${o.frame ? "checked" : ""}> halo frame
          &nbsp; colour <input type="color" name="frameColor" value="${hex(o.frameColor, "#e0a82e")}" style="width:46px;height:24px;vertical-align:middle;padding:0;border:none;background:none">
          intensity <input type="number" name="frameGlow" value="${o.frameGlow ?? 1}" min="0" max="3" step="0.25" style="width:55px"></span>
      </form>`;

    const vals = await DialogV2.wait({
      window: { title: `Edit overlay — ${basename(src0)}` },
      content,
      rejectClose: false,
      render: (_ev, dlg) => {
        dlg.element.querySelector('button[name="pick"]')?.addEventListener("click", () => {
          new FP({ type: "image", current: src0, callback: (p) => {
            dlg.element.querySelector('input[name="newSrc"]').value = p;
            const c = dlg.element.querySelector("#ov-src"); if (c) c.textContent = basename(p);
          } }).render(true);
        });
      },
      buttons: [
        { action: "save", label: "Save", default: true, callback: (_e, _b, d) => {
          const f = d.element.querySelector("form").elements;
          return {
            newSrc: (f.newSrc.value || "").trim(),
            blend: f.blend.value,
            layer: f.layer.value,
            alpha: Math.max(0, Math.min(1, Number(f.alpha.value) || 0.85)),
            spin: f.spin.checked,
            spinMode: f.spinMode.value,
            spinSpeed: (f.spinMode.value === "ccw" ? -1 : 1) * Math.abs(Number(f.spinSpeed.value) || 30),
            spinArc: Number(f.spinArc.value) || 60,
            tint: f.tintOn.checked ? (f.tint.value || "").trim() : "",
            pulse: f.pulse.checked,
            pulseAmp: Number(f.pulseAmp.value) || 0.2,
            pulseSpeed: Number(f.pulseSpeed.value) || 1.2,
            frame: f.frame.checked,
            frameColor: (f.frameColor.value || "").trim(),
            frameGlow: Number(f.frameGlow.value) || 1,
          };
        } },
        { action: "cancel", label: "Cancel" },
      ],
    });
    if (!vals || vals === "cancel") return;

    let tintNum = null;
    if (vals.tint) { try { tintNum = foundry.utils.Color.from(vals.tint).valueOf(); } catch (_e) {} }
    let frameColorNum = 0xe0a82e;
    try { frameColorNum = foundry.utils.Color.from(vals.frameColor || "#e0a82e").valueOf(); } catch (_e) {}

    const upd = {
      _id: id,
      rotation: vals.spin ? 0 : (t.rotation ?? 0),   // base angle; spin animates on top
      elevation: vals.layer === "overlay" ? 20 : 0,
      sort: vals.layer === "overlay" ? 100 : -10,
      [`flags.${MOD}.overlay.blend`]: vals.blend,
      [`flags.${MOD}.overlay.baseAlpha`]: vals.alpha,
      [`flags.${MOD}.overlay.tint`]: tintNum,
      [`flags.${MOD}.overlay.pulse`]: vals.pulse,
      [`flags.${MOD}.overlay.pulseAmp`]: vals.pulseAmp,
      [`flags.${MOD}.overlay.pulseSpeed`]: vals.pulseSpeed,
      [`flags.${MOD}.overlay.spin`]: vals.spin,
      [`flags.${MOD}.overlay.spinMode`]: vals.spinMode,
      [`flags.${MOD}.overlay.spinSpeed`]: vals.spinSpeed,
      [`flags.${MOD}.overlay.spinArc`]: vals.spinArc,
      [`flags.${MOD}.overlay.frame`]: vals.frame,
      [`flags.${MOD}.overlay.frameColor`]: frameColorNum,
      [`flags.${MOD}.overlay.frameGlow`]: vals.frameGlow,
    };
    if (vals.newSrc) upd["texture.src"] = vals.newSrc;
    await scene.updateEmbeddedDocuments("Tile", [upd]);
    const pl = canvas.tiles?.get?.(id); if (pl) game.bbttcc.overlayApply?.(pl);
    log(`edited ${id}`);
    ui.notifications.info(`Overlay updated${vals.newSrc ? " (image replaced)" : ""}.`);
  };

  const result = await DialogV2.wait({
    window: { title: "Scene Overlay Manager" },
    content,
    rejectClose: false,
    render: (_ev, dlg) => {
      // "select all" header checkbox drives the row checkboxes.
      const all = dlg.element.querySelector('input[name="selAll"]');
      all?.addEventListener("change", () => {
        dlg.element.querySelectorAll('input[name="sel"]').forEach((el) => { el.checked = all.checked; });
      });
    },
    buttons: [
      { action: "edit",      label: "Edit…",         callback: (_e, _b, d) => ({ op: "edit",     ids: selectedIds(d) }) },
      { action: "hide",      label: "Hide ticked",   callback: (_e, _b, d) => ({ op: "hide",     ids: selectedIds(d) }) },
      { action: "show",      label: "Show ticked",   callback: (_e, _b, d) => ({ op: "show",     ids: selectedIds(d) }) },
      { action: "frameOn",   label: "Frame ON",      callback: (_e, _b, d) => ({ op: "frameOn",  ids: selectedIds(d), frameColor: d.element.querySelector('input[name="frameColor"]')?.value || "#e0a82e" }) },
      { action: "frameOff",  label: "Frame off",     callback: (_e, _b, d) => ({ op: "frameOff", ids: selectedIds(d) }) },
      { action: "delete",    label: "Delete ticked", callback: (_e, _b, d) => ({ op: "delete",   ids: selectedIds(d) }) },
      { action: "hideAll",   label: "Hide all",      callback: () => ({ op: "hide",   ids: overlays.map((t) => t.id) }) },
      { action: "showAll",   label: "Show all",      callback: () => ({ op: "show",   ids: overlays.map((t) => t.id) }) },
      { action: "deleteAll", label: "Delete ALL",    callback: () => ({ op: "delete", ids: overlays.map((t) => t.id) }) },
      { action: "cancel",    label: "Close", default: true },
    ],
  });
  if (!result || result === "cancel" || !result.ids?.length) return;

  const { op, ids } = result;

  if (op === "edit") {
    if (ids.length !== 1) return ui.notifications.warn("Tick exactly ONE overlay to edit.");
    return editOverlay(ids[0]);
  }

  if (op === "frameOn" || op === "frameOff") {
    const on = op === "frameOn";
    let colNum = 0xe0a82e;   // Hexchrome gold fallback
    try { colNum = foundry.utils.Color.from(result.frameColor || "#e0a82e").valueOf(); } catch (_e) {}
    const updates = ids.map((id) => {
      if (!on) return { _id: id, [`flags.${MOD}.overlay.frame`]: false };
      const o = scene.tiles.get(id)?.getFlag(MOD, "overlay") ?? {};
      return {
        _id: id,
        [`flags.${MOD}.overlay.frame`]: true,
        [`flags.${MOD}.overlay.frameColor`]: colNum,           // the picked colour (recolours)
        [`flags.${MOD}.overlay.frameGlow`]: o.frameGlow ?? 1,
      };
    });
    await scene.updateEmbeddedDocuments("Tile", updates);
    // refreshTile fires on update and redraws, but force-apply too for immediacy.
    for (const id of ids) { const t = canvas.tiles?.get?.(id); if (t) game.bbttcc.overlayApply?.(t); }
    log(`${op} ${ids.length}`);
    return ui.notifications.info(`Gold frame ${on ? "ON" : "off"} for ${ids.length} overlay(s).`);
  }

  if (op === "delete") {
    if (op === "delete" && ids.length === overlays.length) {
      const ok = await DialogV2.confirm({
        window: { title: "Delete overlays?" },
        content: `<p>Delete <b>${ids.length}</b> overlay tile(s) on this scene? This can’t be undone.</p>`,
      });
      if (!ok) return;
    }
    await scene.deleteEmbeddedDocuments("Tile", ids);
    log(`deleted ${ids.length}`);
    return ui.notifications.info(`Deleted ${ids.length} overlay(s).`);
  }

  const hidden = op === "hide";
  await scene.updateEmbeddedDocuments("Tile", ids.map((id) => ({ _id: id, hidden })));
  log(`${op} ${ids.length}`);
  ui.notifications.info(`${hidden ? "Hid" : "Showed"} ${ids.length} overlay(s).`);
})();
