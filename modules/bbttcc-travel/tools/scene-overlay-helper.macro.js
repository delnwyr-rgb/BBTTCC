// scene-overlay-helper.macro.js — RUN IN-WORLD (GM). Places a blended overlay Tile on the current scene.
// ─────────────────────────────────────────────────────────────────────────────
// BAD EDEN · SCENE OVERLAY HELPER — drop circuit / sigil / hex art onto an exported
// Dungeon Alchemist (or any) battlemap as a Foundry Tile, with a real PIXI blend mode
// so it READS as glowing light, not a flat sticker. Pick a (transparent) PNG, choose
// how it sits, and it's placed + persistently re-blended on every canvas refresh.
//   • Blend modes: Add / Screen (the glow looks), Multiply (burn-in), or Normal.
//   • Fit: cover the whole scene, or a custom size in grid squares at your view centre.
//   • Layer: Ground (below tokens, e.g. floor circuitry) or Overlay (above tokens, e.g. wards).
//   • Optional gentle alpha PULSE so sigils breathe, and SPIN (continuous rotation
//     around the tile centre, speed in °/sec, ± = direction — great for round sigils).
//   • GOLD FRAME GLOW: the GM control-bar "Hexchrome" halo drawn as a glowing bordered
//     frame around the tile (PIXI Graphics, not a texture filter — reliable, no shader
//     clash; tracks the tile on move/rotate; breathes if Pulse is also on).
//   • Snap-to-grid, opacity, and a "clear existing overlays first" toggle for fast iteration.
// HOW IT WORKS: Foundry Tiles have no blendMode in their schema, so we stash the look in
//   flags["bbttcc-travel"].overlay and re-apply it to tile.mesh on drawTile/refreshTile +
//   a ticker for the pulse. The gold frame is drawn into a container on canvas.primary
//   (world-space) keyed by tile id. The hooks register ONCE per session (idempotent guard).
// PERMANENT SINCE 2026-07-04: the renderer now ALSO lives in the module at
//   scripts/scene-overlay-renderer.js (loaded at init → overlays survive reloads with
//   no ritual). This macro's copy remains for in-session hot-swap tuning — pasting it
//   tears down the module registration and takes over until the next reload.
// Self-contained. No ft-deploy needed to try it — paste into a GM macro and run.
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  if (!canvas?.scene)   return ui.notifications.warn("No active scene — view a scene first.");

  const MOD = "bbttcc-travel";                 // flag scope (a real, registered module)
  const OVERLAY_LIB = "art/bbttcc/GOTTGAIT/Circuits and Sigils"; // FilePicker starting folder
  const log = (...a) => console.log("[overlay-helper]", ...a);

  // ── 1. PERSISTENT EFFECT APPLIER (registered once per session) ──────────────
  game.bbttcc = game.bbttcc || {};

  const blendOf = (name) => {
    const B = PIXI.BLEND_MODES;
    return ({
      normal:   B.NORMAL,
      add:      B.ADD,
      screen:   B.SCREEN,
      multiply: B.MULTIPLY,
      overlay:  B.OVERLAY ?? B.NORMAL,
    })[name] ?? B.NORMAL;
  };

  // -- Gold glow-FRAME: the GM control-bar "Hexchrome" look as a drawn frame around
  //    a tile. Same proven recipe as the capital-hex overlays (main.js): concentric
  //    strokes = wide low-alpha halo + crisp border + inner sheen, on a container
  //    parented to canvas.primary (world-space, so it survives pan/zoom for free). --
  const frameLayer = () => {
    if (!canvas?.primary) return null;
    let L = game.bbttcc.__overlayFrameLayer;
    if (!L || L._destroyed || L.parent !== canvas.primary) {
      L = new PIXI.Container();
      L.label = L.name = "bbttcc-overlay-frames";
      L.sortableChildren = true;
      L.eventMode = "none";
      L.zIndex = 8000;
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
    const doc = tile?.document;
    if (!doc) return;
    clearFrame(doc.id);
    const o = doc.getFlag?.(MOD, "overlay");
    if (!o?.frame) { tile._bbttccFrame = null; return; }
    const L = frameLayer();
    if (!L) return;
    const w = doc.width, h = doc.height;
    const mesh = tile.mesh;
    const ax = mesh?.anchor?.x ?? 0.5, ay = mesh?.anchor?.y ?? 0.5;
    const g = new PIXI.Graphics();
    g.name = `frame:${doc.id}`;
    g.eventMode = "none";
    // Bind to the mesh's ACTUAL transform (anchor point + rotation), converted into
    // the frame layer's space, so the frame can't drift from the image. Fallback to
    // document coords only if the mesh isn't drawn yet.
    if (mesh?.parent) {
      g.position.copyFrom(L.toLocal(mesh.getGlobalPosition(new PIXI.Point())));
      g.rotation = mesh.rotation || 0;
    } else {
      g.position.set(doc.x + w / 2, doc.y + h / 2);
      g.rotation = ((doc.rotation || 0) * Math.PI) / 180;
    }
    const col   = o.frameColor ?? 0xe0a82e;            // Hexchrome gold
    const sheen = 0xfff1a8;
    const rad   = o.frameRadius ?? Math.min(w, h) * 0.06;
    const t     = o.frameThickness ?? Math.max(3, Math.min(w, h) * 0.012);
    const gi    = o.frameGlow ?? 1;                    // halo intensity multiplier
    const left = -ax * w, top = -ay * h;               // rect placed per mesh anchor
    const rect = (inset, r) => g.drawRoundedRect(left + inset, top + inset, w - 2 * inset, h - 2 * inset, Math.max(0, r));
    for (const [mult, a] of [[3.4, 0.05], [2.4, 0.08], [1.6, 0.13]]) {  // wide soft halo
      g.lineStyle({ width: t * mult, color: col, alpha: a * gi, join: "round" });
      rect(0, rad);
    }
    g.lineStyle({ width: t, color: col, alpha: 0.95, join: "round" });   // crisp border
    rect(0, rad);
    g.lineStyle({ width: Math.max(1, t * 0.4), color: sheen, alpha: 0.5, join: "round" }); // inner sheen
    rect(t, Math.max(0, rad - t));
    g.alpha = 1;
    L.addChild(g);
    tile._bbttccFrame = g;
  };

  const applyOverlay = (tile) => {
    const o = tile?.document?.getFlag?.(MOD, "overlay");
    const mesh = tile?.mesh;
    if (o && mesh) {
      mesh.blendMode = blendOf(o.blend);
      if (o.tint != null) { try { mesh.tint = Number(o.tint); } catch (_e) {} }
      else { try { mesh.tint = 0xffffff; } catch (_e) {} }   // clear tint when removed
      if (!o.pulse) mesh.alpha = o.baseAlpha ?? 1;   // pulse path drives alpha in the ticker
    }
    drawFrame(tile);                                  // (re)draw the gold frame if enabled
  };

  const tick = () => {
    const dt = (canvas?.app?.ticker?.deltaMS ?? 16) / 1000;
    for (const tile of (canvas?.tiles?.placeables ?? [])) {
      const o = tile?.document?.getFlag?.(MOD, "overlay");
      if (!o) continue;
      const mesh = tile?.mesh;
      const fr = tile._bbttccFrame;
      // SPIN — rotation around the tile centre (speed °/sec, ± = direction).
      // spinMode "sway" = oscillate back & forth across spinArc° (total sweep)
      // instead of full circles; peak angular speed ≈ |spinSpeed|.
      if (o.spin && mesh) {
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
        if (o.frame && fr && !fr._destroyed) fr.rotation = mesh.rotation;   // frame spins along
      }
      // PULSE — breathing alpha (mesh + frame).
      if (o.pulse) {
        tile._bbttccPhase = (tile._bbttccPhase ?? 0) + dt * (o.pulseSpeed ?? 1);
        const s = Math.sin(tile._bbttccPhase), amp = o.pulseAmp ?? 0.25;
        if (mesh) { mesh.alpha = Math.max(0, Math.min(1, (o.baseAlpha ?? 1) + amp * s)); mesh.blendMode = blendOf(o.blend); }
        if (o.frame && fr && !fr._destroyed) fr.alpha = Math.max(0, Math.min(1, 1 - amp + amp * s));
      }
    }
  };

  // (Re)register hooks + ticker, tearing down any prior registration this session so a
  // re-paste always hot-swaps the latest logic (no stale closures, no double-apply).
  const onDelete = (d) => clearFrame(d.id);
  const onReady = () => { game.bbttcc.__overlayFrameLayer = null; };  // primary rebuilt on scene swap
  const prev = game.bbttcc.__overlayReg;
  if (prev) {
    try {
      Hooks.off("drawTile", prev.applyOverlay);
      Hooks.off("refreshTile", prev.applyOverlay);
      Hooks.off("deleteTile", prev.onDelete);
      Hooks.off("canvasReady", prev.onReady);
      canvas.app.ticker.remove(prev.tick);
    } catch (_e) {}
  }
  Hooks.on("drawTile", applyOverlay);
  Hooks.on("refreshTile", applyOverlay);              // fires on move/resize → frame tracks
  Hooks.on("deleteTile", onDelete);
  Hooks.on("canvasReady", onReady);
  canvas.app.ticker.add(tick);
  game.bbttcc.__overlayReg = { applyOverlay, tick, onDelete, onReady };
  game.bbttcc.overlayApply = applyOverlay;            // exposed for re-apply / debugging
  log("effect hooks + ticker (re)registered");
  // Re-apply to anything already on this scene (e.g. after a reload + re-run).
  for (const tile of (canvas?.tiles?.placeables ?? [])) applyOverlay(tile);

  // ── 2. PICK THE OVERLAY IMAGE ───────────────────────────────────────────────
  const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
  const src = await new Promise((resolve) => {
    let chosen = null;
    new FP({
      type: "image",
      current: OVERLAY_LIB,
      callback: (path) => { chosen = path; resolve(path); },
    }).render(true);
    // FilePicker has no "cancel" callback — resolve(null) if the window is closed unused.
    Hooks.once("closeFilePicker", () => resolve(chosen));
  });
  if (!src) return ui.notifications.info("Overlay cancelled — no image chosen.");

  // ── 3. OPTIONS DIALOG ───────────────────────────────────────────────────────
  const DialogV2 = foundry.applications.api?.DialogV2;
  if (!DialogV2) return ui.notifications.error("DialogV2 unavailable — update Foundry.");

  const content = `
    <form class="bbttcc-overlay-form" style="display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;">
      <label>Blend</label>
      <select name="blend">
        <option value="add" selected>Add — glowing light (circuits / sigils)</option>
        <option value="screen">Screen — softer glow</option>
        <option value="multiply">Multiply — burn-in / etched</option>
        <option value="normal">Normal — flat decal</option>
      </select>

      <label>Fit</label>
      <select name="fit">
        <option value="scene" selected>Cover whole scene</option>
        <option value="custom">Custom size (grid squares)</option>
      </select>

      <label>Size (sq, W×H)</label>
      <span><input type="number" name="w" value="6" min="1" step="1" style="width:60px"> ×
            <input type="number" name="h" value="6" min="1" step="1" style="width:60px">
            <small style="opacity:.7">(custom fit only)</small></span>

      <label>Layer</label>
      <select name="layer">
        <option value="ground" selected>Ground — below tokens (floor art)</option>
        <option value="overlay">Overlay — above tokens (wards)</option>
      </select>

      <label>Opacity</label>
      <input type="number" name="alpha" value="0.85" min="0" max="1" step="0.05" style="width:70px">

      <label>Spin</label>
      <span><input type="checkbox" name="spin"> rotate around centre
        &nbsp; <select name="spinMode">
          <option value="cw" selected>&#10227; clockwise</option>
          <option value="ccw">&#10226; counter-clockwise</option>
          <option value="sway">&#8646; sway back &amp; forth</option>
        </select>
        speed <input type="number" name="spinSpeed" value="30" min="0" max="360" step="5" style="width:64px"> °/sec
        arc <input type="number" name="spinArc" value="60" min="5" max="360" step="5" style="width:60px">°
        <br><small style="opacity:.7">arc = total sweep, sway only — great for pendulum wards; CW/CCW spin round sigils</small></span>

      <label>Tint (optional)</label>
      <span><input type="checkbox" name="tintOn"> apply
        <input type="color" name="tint" value="#39d6ff" style="width:46px;height:24px;vertical-align:middle;padding:0;border:none;background:none"></span>

      <label>Pulse</label>
      <span><input type="checkbox" name="pulse"> breathe
        &nbsp; amp <input type="number" name="pulseAmp" value="0.2" min="0" max="0.5" step="0.05" style="width:55px">
        speed <input type="number" name="pulseSpeed" value="1.2" min="0.1" max="5" step="0.1" style="width:55px"></span>

      <label>Gold frame glow</label>
      <span><input type="checkbox" name="frame"> halo frame (the GM-bar "Hexchrome" look)
        &nbsp; colour <input type="color" name="frameColor" value="#e0a82e" style="width:46px;height:24px;vertical-align:middle;padding:0;border:none;background:none">
        intensity <input type="number" name="frameGlow" value="1" min="0" max="3" step="0.25" style="width:55px">
        <br><small style="opacity:.7">draws a glowing bordered frame around the tile (pairs with Pulse to breathe)</small></span>

      <label>Snap to grid</label>
      <span><input type="checkbox" name="snap" checked></span>

      <label>Clear old overlays</label>
      <span><input type="checkbox" name="wipe"> delete this scene's BBTTCC overlays first</span>
    </form>
    <p style="opacity:.7;margin:6px 0 0"><small>Image: <code>${foundry.utils.escapeHTML?.(src) ?? src}</code></small></p>`;

  const opts = await DialogV2.wait({
    window: { title: "Scene Overlay — place blended art" },
    content,
    rejectClose: false,
    buttons: [
      { action: "place", label: "Place Overlay", default: true,
        callback: (_ev, _btn, dlg) => {
          const f = dlg.element.querySelector("form").elements;
          return {
            blend: f.blend.value,
            fit: f.fit.value,
            w: Number(f.w.value) || 6,
            h: Number(f.h.value) || 6,
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
            snap: f.snap.checked,
            wipe: f.wipe.checked,
          };
        } },
      { action: "cancel", label: "Cancel" },
    ],
  });
  if (!opts || opts === "cancel") return;

  // ── 4. GEOMETRY ─────────────────────────────────────────────────────────────
  const scene = canvas.scene;
  const grid  = scene?.grid?.size ?? canvas.grid?.size ?? 100;
  const dim   = canvas.dimensions ?? {};
  let x, y, width, height;

  if (opts.fit === "scene") {
    x = dim.sceneX ?? 0;
    y = dim.sceneY ?? 0;
    width  = dim.sceneWidth  ?? dim.width  ?? scene.width  ?? grid * 20;
    height = dim.sceneHeight ?? dim.height ?? scene.height ?? grid * 20;
  } else {
    width  = Math.max(1, opts.w) * grid;
    height = Math.max(1, opts.h) * grid;
    const c = canvas.stage?.pivot ?? { x: (dim.width ?? 0) / 2, y: (dim.height ?? 0) / 2 };
    x = (c.x ?? 0) - width / 2;
    y = (c.y ?? 0) - height / 2;
    if (opts.snap) {
      const s = canvas.grid?.getSnappedPoint?.({ x, y }, { mode: 1 })
             ?? canvas.grid?.getSnappedPosition?.(x, y) ?? { x, y };
      x = s.x; y = s.y;
    }
  }

  let tintNum = null;
  if (opts.tint) { try { tintNum = foundry.utils.Color.from(opts.tint).valueOf(); } catch (_e) {} }

  let frameColorNum = 0xe0a82e;   // Hexchrome gold default
  if (opts.frame && opts.frameColor) {
    try { frameColorNum = foundry.utils.Color.from(opts.frameColor).valueOf(); } catch (_e) {}
  }

  // ── 5. OPTIONAL WIPE + CREATE ───────────────────────────────────────────────
  if (opts.wipe) {
    const stale = scene.tiles.filter((t) => t.getFlag?.(MOD, "overlay")).map((t) => t.id);
    if (stale.length) { await scene.deleteEmbeddedDocuments("Tile", stale); log(`cleared ${stale.length} old overlay(s)`); }
  }

  const tileData = {
    texture: { src, scaleX: 1, scaleY: 1, alphaThreshold: 0, ...(tintNum != null ? { tint: opts.tint } : {}) },
    x, y, width, height,
    rotation: 0,                            // base angle; spin animates on top of this
    elevation: opts.layer === "overlay" ? 20 : 0,
    sort: opts.layer === "overlay" ? 100 : -10,
    hidden: false,
    locked: false,
    occlusion: { mode: 0 },                 // NONE — never auto-fade
    restrictions: { light: false, weather: false },
    flags: { [MOD]: { overlay: {
      blend: opts.blend,
      baseAlpha: opts.alpha,
      tint: tintNum,
      pulse: opts.pulse,
      pulseAmp: opts.pulseAmp,
      pulseSpeed: opts.pulseSpeed,
      spin: opts.spin,
      spinMode: opts.spinMode,
      spinSpeed: opts.spinSpeed,
      spinArc: opts.spinArc,
      frame: opts.frame,
      frameColor: frameColorNum,
      frameGlow: opts.frameGlow,
    } } },
  };

  const [doc] = await scene.createEmbeddedDocuments("Tile", [tileData]);
  // drawTile fires on render and re-blends, but force it once in case the placeable
  // is already drawn (e.g. re-run on the same scene).
  const placeable = canvas.tiles?.get?.(doc.id);
  if (placeable) applyOverlay(placeable);

  ui.notifications.info(`Overlay placed (${opts.blend}${opts.frame ? " · gold frame" : ""}${opts.pulse ? " · pulsing" : ""}${opts.spin ? " · spinning" : ""}). Drag/scale it on the Tiles layer.`);
  log("placed overlay tile", doc.id, tileData);
})();
