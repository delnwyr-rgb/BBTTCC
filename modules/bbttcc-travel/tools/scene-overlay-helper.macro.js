// scene-overlay-helper.macro.js — RUN IN-WORLD (GM). Places a blended overlay Tile on the current scene.
// ─────────────────────────────────────────────────────────────────────────────
// BAD EDEN · SCENE OVERLAY HELPER — drop circuit / sigil / hex art onto an exported
// Dungeon Alchemist (or any) battlemap as a Foundry Tile, with a real PIXI blend mode
// so it READS as glowing light, not a flat sticker. Pick a (transparent) PNG, choose
// how it sits, and it's placed + persistently re-blended on every canvas refresh.
//   • Blend modes: Add / Screen (the glow looks), Multiply (burn-in), or Normal.
//   • Fit: cover the whole scene, or a custom size in grid squares at your view centre.
//   • Layer: Ground (below tokens, e.g. floor circuitry) or Overlay (above tokens, e.g. wards).
//   • Optional gentle alpha PULSE so sigils breathe.
//   • Snap-to-grid, opacity, and a "clear existing overlays first" toggle for fast iteration.
// HOW IT WORKS: Foundry Tiles have no blendMode in their schema, so we stash the look in
//   flags["bbttcc-travel"].overlay and re-apply it to tile.mesh on drawTile/refreshTile +
//   a ticker for the pulse. The hooks register ONCE per session (idempotent guard).
// MAKE IT PERMANENT: this macro's hook block survives until reload. To keep overlays
//   blended across reloads, lift the `applyOverlay` / `tickPulse` / hook-registration
//   block verbatim into a bbttcc-travel init script (no schema change needed).
// Self-contained. No ft-deploy needed to try it — paste into a GM macro and run.
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  if (!canvas?.scene)   return ui.notifications.warn("No active scene — view a scene first.");

  const MOD = "bbttcc-travel";                 // flag scope (a real, registered module)
  const OVERLAY_LIB = "art/bbttcc/GOTTGAIT/Circuits and Sigils"; // FilePicker starting folder
  const log = (...a) => console.log("[overlay-helper]", ...a);

  // ── 1. PERSISTENT BLEND APPLIER (registered once per session) ───────────────
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

  const applyOverlay = (tile) => {
    const o = tile?.document?.getFlag?.(MOD, "overlay");
    const mesh = tile?.mesh;
    if (!o || !mesh) return;
    mesh.blendMode = blendOf(o.blend);
    if (o.tint != null) { try { mesh.tint = Number(o.tint); } catch (_e) {} }
    if (!o.pulse) mesh.alpha = o.baseAlpha ?? 1;   // pulse path drives alpha in the ticker
  };

  const tickPulse = () => {
    const dt = (canvas?.app?.ticker?.deltaMS ?? 16) / 1000;
    for (const tile of (canvas?.tiles?.placeables ?? [])) {
      const o = tile?.document?.getFlag?.(MOD, "overlay");
      const mesh = tile?.mesh;
      if (!o?.pulse || !mesh) continue;
      tile._bbttccPhase = (tile._bbttccPhase ?? 0) + dt * (o.pulseSpeed ?? 1);
      const base = o.baseAlpha ?? 1, amp = o.pulseAmp ?? 0.25;
      mesh.alpha = Math.max(0, Math.min(1, base + amp * Math.sin(tile._bbttccPhase)));
      mesh.blendMode = blendOf(o.blend);          // keep enforced through refreshes
    }
  };

  game.bbttcc = game.bbttcc || {};
  if (!game.bbttcc.__overlayHooked) {
    Hooks.on("drawTile", applyOverlay);
    Hooks.on("refreshTile", applyOverlay);
    canvas.app.ticker.add(tickPulse);
    game.bbttcc.__overlayHooked = true;
    game.bbttcc.overlayApply = applyOverlay;       // exposed for re-apply / debugging
    log("blend hooks + pulse ticker registered");
  }
  // Re-blend anything already on this scene (e.g. after a reload + re-run).
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

      <label>Rotation (°)</label>
      <span><input type="number" name="rotation" value="0" min="0" max="359" step="15" style="width:70px">
        <small style="opacity:.7">spins around its center — handy for round sigils</small></span>

      <label>Tint (hex, opt)</label>
      <input type="text" name="tint" placeholder="#39d6ff" style="width:90px">

      <label>Pulse</label>
      <span><input type="checkbox" name="pulse"> breathe
        &nbsp; amp <input type="number" name="pulseAmp" value="0.2" min="0" max="0.5" step="0.05" style="width:55px">
        speed <input type="number" name="pulseSpeed" value="1.2" min="0.1" max="5" step="0.1" style="width:55px"></span>

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
            rotation: ((Number(f.rotation.value) || 0) % 360 + 360) % 360,
            tint: (f.tint.value || "").trim(),
            pulse: f.pulse.checked,
            pulseAmp: Number(f.pulseAmp.value) || 0.2,
            pulseSpeed: Number(f.pulseSpeed.value) || 1.2,
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

  // ── 5. OPTIONAL WIPE + CREATE ───────────────────────────────────────────────
  if (opts.wipe) {
    const stale = scene.tiles.filter((t) => t.getFlag?.(MOD, "overlay")).map((t) => t.id);
    if (stale.length) { await scene.deleteEmbeddedDocuments("Tile", stale); log(`cleared ${stale.length} old overlay(s)`); }
  }

  const tileData = {
    texture: { src, scaleX: 1, scaleY: 1, alphaThreshold: 0, ...(tintNum != null ? { tint: opts.tint } : {}) },
    x, y, width, height,
    rotation: opts.rotation ?? 0,
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
    } } },
  };

  const [doc] = await scene.createEmbeddedDocuments("Tile", [tileData]);
  // drawTile fires on render and re-blends, but force it once in case the placeable
  // is already drawn (e.g. re-run on the same scene).
  const placeable = canvas.tiles?.get?.(doc.id);
  if (placeable) applyOverlay(placeable);

  ui.notifications.info(`Overlay placed (${opts.blend}${opts.pulse ? " · pulsing" : ""}). Drag/scale it on the Tiles layer.`);
  log("placed overlay tile", doc.id, tileData);
})();
