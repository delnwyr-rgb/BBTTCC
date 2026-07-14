// scene-overlay-renderer.js — PERMANENT home of the BBTTCC scene-overlay renderer.
// ─────────────────────────────────────────────────────────────────────────────
// Re-applies the overlay "look" stored in flags["bbttcc-travel"].overlay to tile
// meshes on drawTile/refreshTile (+ a ticker for pulse/spin, + the gold Hexchrome
// frame). Lifted verbatim from scene-overlay-helper.macro.js so overlays survive
// full reloads with no macro ritual — the Helper/Manager macros remain the
// placement/edit UIs and can still hot-swap this renderer in-session via the
// game.bbttcc.__overlayReg tear-down/re-register pattern (module version returns
// on next reload).
(() => {
  "use strict";

  const MOD = "bbttcc-travel"; // flag scope
  const log = (...a) => console.log("[overlay-renderer]", ...a);

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
  //    a tile. Concentric strokes = wide low-alpha halo + crisp border + inner sheen,
  //    on a container parented to canvas.primary (world-space). --
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
        L.sortableChildren = true;
        L.eventMode = "none";
        L.zIndex = 8000;
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
      try {
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
        if (o.frame && fr && !fr.destroyed) fr.rotation = mesh.rotation;   // frame spins along
      }
      // PULSE — breathing alpha (mesh + frame).
      if (o.pulse) {
        tile._bbttccPhase = (tile._bbttccPhase ?? 0) + dt * (o.pulseSpeed ?? 1);
        const s = Math.sin(tile._bbttccPhase), amp = o.pulseAmp ?? 0.25;
        if (mesh) { mesh.alpha = Math.max(0, Math.min(1, (o.baseAlpha ?? 1) + amp * s)); mesh.blendMode = blendOf(o.blend); }
        if (o.frame && fr && !fr.destroyed) fr.alpha = Math.max(0, Math.min(1, 1 - amp + amp * s));
      }
      } catch (_e) {
        // A stale/destroyed mesh mid-scene-swap must not throw out of a ticker
        // callback — an uncaught error here stalls the frame's remaining ticker
        // listeners (canvas pan animation included) EVERY frame.
      }
    }
  };

  const onDelete = (d) => clearFrame(d.id);
  // Scene swap: the old layer dies WITH the old primary group during teardown —
  // drop the reference then (never at canvasReady: by ready-time the new scene's
  // drawTile pass has already built a live layer, and nulling the ref there
  // orphaned it → every later refreshTile drew into a SECOND layer → the
  // "duplicated glowing border" bug).
  const onTearDown = () => { game.bbttcc.__overlayFrameLayer = null; };
  // After the scene settles, re-apply every overlay: frames drawn mid-draw can
  // capture a not-yet-settled mesh transform (frame stranded near the origin);
  // this sweep redraws them in place with the real transforms.
  const onReady = () => {
    for (const tile of (canvas?.tiles?.placeables ?? [])) {
      try { applyOverlay(tile); } catch (_e) {}
    }
  };

  // Hooks register at init so the initial canvas draw (which fires drawTile per tile
  // BEFORE "ready") is already covered. The ticker + a safety re-apply sweep land at
  // "ready". Same __overlayReg registry as the macros, so a macro paste can still
  // tear this down and hot-swap tuned logic mid-session.
  Hooks.once("init", () => {
    game.bbttcc = game.bbttcc || {};
    const prev = game.bbttcc.__overlayReg;
    if (prev) {
      try {
        Hooks.off("drawTile", prev.applyOverlay);
        Hooks.off("refreshTile", prev.applyOverlay);
        Hooks.off("deleteTile", prev.onDelete);
        Hooks.off("canvasReady", prev.onReady);
        if (prev.onTearDown) Hooks.off("canvasTearDown", prev.onTearDown);
        canvas?.app?.ticker?.remove(prev.tick);
      } catch (_e) {}
    }
    Hooks.on("drawTile", applyOverlay);
    Hooks.on("refreshTile", applyOverlay);              // fires on move/resize → frame tracks
    Hooks.on("deleteTile", onDelete);
    Hooks.on("canvasReady", onReady);
    Hooks.on("canvasTearDown", onTearDown);
    game.bbttcc.__overlayReg = { applyOverlay, tick, onDelete, onReady, onTearDown };
    game.bbttcc.overlayApply = applyOverlay;            // exposed for re-apply / debugging
    log("overlay renderer hooks registered (module init)");
  });

  Hooks.once("ready", () => {
    // Only add the ticker if this registration is still the active one (a macro
    // paste between init and ready would have replaced it and added its own).
    if (game.bbttcc.__overlayReg?.tick === tick) canvas?.app?.ticker?.add(tick);
    // Safety sweep: re-apply to anything already drawn.
    for (const tile of (canvas?.tiles?.placeables ?? [])) game.bbttcc.overlayApply?.(tile);
    log("overlay renderer ticker active; existing overlays re-applied");
  });
})();
