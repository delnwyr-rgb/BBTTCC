// scene-overlay-manager.macro.js — RUN IN-WORLD (GM). Toggle / remove BBTTCC overlay Tiles.
// ─────────────────────────────────────────────────────────────────────────────
// BAD EDEN · SCENE OVERLAY MANAGER — companion to scene-overlay-helper.macro.js.
// Lists every overlay Tile on the CURRENT scene (those carrying the
// flags["bbttcc-travel"].overlay stamp), with per-overlay show/hide + delete, bulk
// Show/Hide/Delete-all, AND toggle the gold "Hexchrome" glow-FRAME on/off without
// re-placing. Use it to declutter, A/B a look, or clean up. Only touches OUR overlay
// tiles — hand-placed art Tiles (no overlay flag) are left alone.
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
  //   running both macros never double-hooks. (Ideal permanent home: a bbttcc-travel
  //   init script; until then both siblings carry a copy.)
  game.bbttcc = game.bbttcc || {};
  const blendOf = (name) => {
    const B = PIXI.BLEND_MODES;
    return ({ normal: B.NORMAL, add: B.ADD, screen: B.SCREEN, multiply: B.MULTIPLY, overlay: B.OVERLAY ?? B.NORMAL })[name] ?? B.NORMAL;
  };
  const frameLayer = () => {
    if (!canvas?.primary) return null;
    let L = game.bbttcc.__overlayFrameLayer;
    if (!L || L._destroyed || L.parent !== canvas.primary) {
      L = new PIXI.Container();
      L.label = L.name = "bbttcc-overlay-frames";
      L.sortableChildren = true; L.eventMode = "none"; L.zIndex = 8000;
      canvas.primary.addChild(L);
      game.bbttcc.__overlayFrameLayer = L;
    }
    return L;
  };
  const clearFrame = (id) => {
    const L = game.bbttcc.__overlayFrameLayer;
    if (!L || L._destroyed) return;
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
      if (!o.pulse) mesh.alpha = o.baseAlpha ?? 1;
    }
    drawFrame(tile);
  };
  const tickPulse = () => {
    const dt = (canvas?.app?.ticker?.deltaMS ?? 16) / 1000;
    for (const tile of (canvas?.tiles?.placeables ?? [])) {
      const o = tile?.document?.getFlag?.(MOD, "overlay");
      if (!o?.pulse) continue;
      tile._bbttccPhase = (tile._bbttccPhase ?? 0) + dt * (o.pulseSpeed ?? 1);
      const s = Math.sin(tile._bbttccPhase), amp = o.pulseAmp ?? 0.25;
      const mesh = tile?.mesh;
      if (mesh) { mesh.alpha = Math.max(0, Math.min(1, (o.baseAlpha ?? 1) + amp * s)); mesh.blendMode = blendOf(o.blend); }
      const fr = tile._bbttccFrame;
      if (o.frame && fr && !fr._destroyed) fr.alpha = Math.max(0, Math.min(1, 1 - amp + amp * s));
    }
  };
  if (!game.bbttcc.__overlayHooked) {
    Hooks.on("drawTile", applyOverlay);
    Hooks.on("refreshTile", applyOverlay);
    Hooks.on("deleteTile", (d) => clearFrame(d.id));
    Hooks.on("canvasReady", () => { game.bbttcc.__overlayFrameLayer = null; });
    canvas.app.ticker.add(tickPulse);
    game.bbttcc.__overlayHooked = true;
    game.bbttcc.overlayApply = applyOverlay;
    log("effect hooks + pulse ticker registered (from manager)");
  }
  for (const tile of (canvas?.tiles?.placeables ?? [])) applyOverlay(tile);

  const overlays = scene.tiles.filter((t) => t.getFlag?.(MOD, "overlay"));
  if (!overlays.length) return ui.notifications.info("No BBTTCC overlays on this scene.");

  const basename = (p) => String(p || "").split("/").pop() || "(no image)";
  const rows = overlays.map((t, i) => {
    const o = t.getFlag(MOD, "overlay") ?? {};
    const dim = `${Math.round(t.width)}×${Math.round(t.height)}`;
    const tags = [o.blend, o.pulse ? "pulse" : null, o.frame ? "frame" : null, t.hidden ? "HIDDEN" : null].filter(Boolean).join(" · ");
    return `<tr>
      <td><input type="checkbox" name="sel" value="${t.id}" checked></td>
      <td style="opacity:${t.hidden ? .5 : 1}"><code>${foundry.utils.escapeHTML?.(basename(t.texture?.src)) ?? basename(t.texture?.src)}</code></td>
      <td style="white-space:nowrap"><small>${dim}</small></td>
      <td><small style="opacity:.75">${tags || "normal"}</small></td>
    </tr>`;
  }).join("");

  const content = `
    <p style="margin:0 0 6px"><small style="opacity:.75">Tick the overlays to act on, then choose an action. Bulk buttons act on the ticked rows; “All” buttons ignore the ticks.</small></p>
    <form class="bbttcc-overlay-manager">
      <p style="margin:0 0 8px">
        <label>Frame colour
          <input type="color" name="frameColor" value="#e0a82e" style="width:46px;height:24px;vertical-align:middle;padding:0;border:none;background:none">
        </label>
        <small style="opacity:.65">— applied when you hit <b>Frame ON</b> (recolours existing frames too)</small>
      </p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--color-border-light-2,#666)">
          <th><input type="checkbox" name="selAll" checked title="select all"></th>
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
