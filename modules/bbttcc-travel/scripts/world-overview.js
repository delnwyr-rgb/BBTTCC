/* Bad Eden – World Overview / Regional Hub (spike v0.1)
 *
 * A low-drawing "world map" scene whose clickable polygon Drawings are *region links*.
 * Clicking a region plays a zoom-dive + flash, then views the linked detail scene
 * (where the real hexes + travel live). Detail scenes linked to a hub get a
 * "⬅ World Map" button to return.
 *
 * Why a separate, self-contained transition (native canvas.animatePan + CSS flash):
 * keeps the spike dependency-free and reliable regardless of fx-integration internals.
 *
 * Data model (all under the "bbttcc-travel" flag scope):
 *   - Overview (hub) scene:   flags["bbttcc-travel"].isWorldHub = true
 *   - Region link Drawing:    flags["bbttcc-travel"].regionLink = { targetSceneUuid, label }
 *   - Detail scene:           flags["bbttcc-travel"].hubSceneUuid = <overview scene uuid>
 *
 * Click mechanism mirrors hex-travel-mode.js's *reliable* path: a stage pointerdown
 * listener + a polygon/rect hit-test (NOT the softer clickDrawing hook).
 */
(() => {
  const SCOPE = "bbttcc-travel";

  // ---------- hit-test (mirrors hex-travel.js getHexAtPoint: scene-space bounds first) ----------
  function drawingContainsGlobal(d, gx, gy) {
    try {
      // Primary: placeable bounds are in scene coords — perfect for rectangles.
      if (d.bounds?.contains?.(gx, gy)) return true;
      if (d.containsPoint?.(new PIXI.Point(gx, gy))) return true;
      // Precise fallback for polygons: test in the drawing's local space.
      const local = d.toLocal(new PIXI.Point(gx, gy));
      const shape = d.document.shape || {};
      const t = (shape.type || "").toLowerCase();
      if (t === "p" || (Array.isArray(shape.points) && shape.points.length >= 6)) {
        const poly = new PIXI.Polygon(shape.points);
        return poly.contains(local.x, local.y);
      }
      const w = Number(shape.width  ?? d.document.width  ?? d.width  ?? 0);
      const h = Number(shape.height ?? d.document.height ?? d.height ?? 0);
      return local.x >= 0 && local.y >= 0 && local.x <= w && local.y <= h;
    } catch (e) { return false; }
  }

  const regionLinkOf  = (d) => d?.document?.flags?.[SCOPE]?.regionLink || null;
  const regionDrawings = () =>
    canvas.drawings.placeables.filter(d => !!regionLinkOf(d));

  function hitRegionAt(gx, gy) {
    const all = regionDrawings()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .reverse();
    for (const d of all) if (drawingContainsGlobal(d, gx, gy)) return d;
    return null;
  }

  const isWorldHub = () => !!canvas?.scene?.flags?.[SCOPE]?.isWorldHub;
  const hubUuidOf  = () => canvas?.scene?.flags?.[SCOPE]?.hubSceneUuid || null;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- self-contained "rad" transition ----------
  function ensureShakeStyle() {
    if (document.getElementById("bbttcc-wo-style")) return;
    const s = document.createElement("style");
    s.id = "bbttcc-wo-style";
    s.textContent = `
      @keyframes bbttcc-wo-shake {
        0%,100%{transform:translate(0,0)} 20%{transform:translate(-4px,2px)}
        40%{transform:translate(4px,-2px)} 60%{transform:translate(-3px,-2px)}
        80%{transform:translate(3px,2px)}
      }
      .bbttcc-wo-shaking{ animation: bbttcc-wo-shake 240ms ease-in-out; }
    `;
    document.head.appendChild(s);
  }

  function flash(color = "#bfe3ff") {
    const el = document.createElement("div");
    el.style.cssText = `
      position:fixed; inset:0; z-index:99999; pointer-events:none; opacity:0;
      transition:opacity 170ms ease-out;
      background: radial-gradient(circle at center, ${color} 0%, rgba(255,255,255,0) 72%);`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "0.9";
      setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 420); }, 150);
    });
  }

  function shake() {
    ensureShakeStyle();
    const board = document.getElementById("board") || canvas?.app?.view;
    if (!board) return;
    board.classList.add("bbttcc-wo-shaking");
    setTimeout(() => board.classList.remove("bbttcc-wo-shaking"), 260);
  }

  let _busy = false;
  async function diveToScene(targetSceneUuid, focus, { flashColor = "#bfe3ff" } = {}) {
    if (_busy) return;
    let scene;
    try { scene = await fromUuid(targetSceneUuid); } catch (e) { scene = null; }
    if (!(scene instanceof Scene)) {
      ui.notifications?.warn("World Map: linked scene not found (was it deleted?).");
      return;
    }
    _busy = true;
    try {
      // 1) zoom-dive toward the focus point on the current canvas
      if (focus && canvas?.animatePan) {
        const maxZoom = (CONFIG?.Canvas?.maxZoom ?? 3);
        const target  = Math.min(maxZoom, (canvas.stage.scale.x || 1) * 2.4);
        await canvas.animatePan({ x: focus.x, y: focus.y, scale: target, duration: 680 });
      }
      // 2) the rad bit
      shake();
      flash(flashColor);
      await wait(230);
      // 3) land on the detail scene (per-user, non-destructive; GM can .activate() to pull the table)
      await scene.view();
      await wait(120);
      flash(flashColor);
    } catch (err) {
      console.error("[bbttcc worldmap] dive failed:", err);
      ui.notifications?.error?.(`World Map dive error: ${err?.message ?? err}`);
    } finally {
      _busy = false;
    }
  }

  async function diveBack() {
    const uuid = hubUuidOf();
    if (!uuid) return;
    const scene = await fromUuid(uuid);
    if (!(scene instanceof Scene)) {
      ui.notifications?.warn("World Map: hub scene not found.");
      return;
    }
    if (_busy) return;
    _busy = true;
    try {
      if (canvas?.animatePan) {
        const target = Math.max((CONFIG?.Canvas?.minZoom ?? 0.1), (canvas.stage.scale.x || 1) * 0.5);
        await canvas.animatePan({ scale: target, duration: 520 });
      }
      shake();
      flash("#d8c8ff");
      await wait(200);
      await scene.view();
    } finally {
      _busy = false;
    }
  }

  // ---------- hover highlight (overview only) ----------
  let _hl = null;
  function clearHighlight() {
    try { _hl?.destroy(true); } catch (e) {}
    _hl = null;
    if (canvas?.app?.view) canvas.app.view.style.cursor = "";
  }
  function drawHighlight(d) {
    clearHighlight();
    const b = d.bounds;
    const g = new PIXI.Graphics();
    g.zIndex = 900;
    g.lineStyle(5, 0xffffff, 0.95);
    g.beginFill(0xbfe3ff, 0.18);
    g.drawRoundedRect(b.x, b.y, b.width, b.height, 10);
    g.endFill();
    canvas.stage.addChild(g);
    _hl = g;
    if (canvas?.app?.view) canvas.app.view.style.cursor = "pointer";
  }

  // ---------- stage interaction (overview hub) ----------
  function localPos(event) {
    const stage = canvas.app.stage;
    // Foundry v12 (PIXI7) and v13/14 (PIXI8): FederatedPointerEvent.getLocalPosition(target).
    if (typeof event?.getLocalPosition === "function") return event.getLocalPosition(stage);
    if (typeof event?.data?.getLocalPosition === "function") return event.data.getLocalPosition(stage);
    // last resort: map global screen coords through the stage transform
    const g = event?.global ?? event?.data?.global ?? { x: 0, y: 0 };
    return stage.toLocal(g);
  }

  function onHubPointerDown(event) {
    try {
      const btn = event.button ?? event.data?.originalEvent?.button ?? 0;
      if (btn !== 0) return; // left-click only
      const p = localPos(event);
      const hit = hitRegionAt(p.x, p.y);
      if (!hit) return; // empty space → let normal pan proceed
      const link = regionLinkOf(hit);
      if (!link?.targetSceneUuid) return;
      event.stopPropagation?.();
      diveToScene(link.targetSceneUuid, hit.center);
    } catch (err) {
      console.error("[bbttcc worldmap] pointerdown error:", err);
      ui.notifications?.error?.(`World Map click error: ${err?.message ?? err}`);
    }
  }

  let _moveBroken = false; // if hover-highlight ever throws, stop trying (don't flood console)
  function onHubPointerMove(event) {
    if (_moveBroken) return;
    try {
      const p = localPos(event);
      const hit = hitRegionAt(p.x, p.y);
      if (hit) drawHighlight(hit);
      else clearHighlight();
    } catch (err) {
      _moveBroken = true;
      clearHighlight();
      console.error("[bbttcc worldmap] hover-highlight disabled after error:", err);
    }
  }

  const _stage = { down: null, move: null };
  function unbindStage() {
    if (_stage.down) canvas.stage.off("pointerdown", _stage.down);
    if (_stage.move) canvas.stage.off("pointermove", _stage.move);
    _stage.down = _stage.move = null;
    clearHighlight();
  }
  function bindStage() {
    unbindStage();
    _stage.down = onHubPointerDown;
    _stage.move = onHubPointerMove;
    canvas.stage.on("pointerdown", _stage.down);
    canvas.stage.on("pointermove", _stage.move);
  }

  // ---------- "⬅ World Map" button (detail scenes) ----------
  function removeBackButton() {
    document.getElementById("bbttcc-worldmap-back")?.remove();
  }
  function addBackButton() {
    removeBackButton();
    const btn = document.createElement("div");
    btn.id = "bbttcc-worldmap-back";
    btn.style.cssText = `
      position:absolute; top: 6px; right: 320px; z-index: 200;
      background: rgba(20,20,20,.9); color:#fff; padding:6px 10px; border-radius:8px;
      cursor:pointer; font: 12px Helvetica; box-shadow: 0 0 6px rgba(0,0,0,.35);`;
    btn.textContent = "⬅ World Map";
    btn.title = "Return to the world overview";
    btn.onclick = () => diveBack();
    document.body.appendChild(btn);
  }

  // ---------- wire-up ----------
  function onCanvasReady() {
    removeBackButton();
    unbindStage();
    if (isWorldHub()) {
      bindStage();
      const n = regionDrawings().length;
      ui.notifications?.info?.(`World Overview: click a region to dive in (${n} linked).`);
    } else if (hubUuidOf()) {
      addBackButton();
    }
  }

  Hooks.on("canvasReady", onCanvasReady);

  Hooks.once("ready", () => {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.worldMap = {
      dive: (uuid, focus) => diveToScene(uuid, focus),
      back: () => diveBack(),
      _hitRegionAt: hitRegionAt,
      _isHub: isWorldHub
    };
    console.log("[bbttcc] World Overview (spike v0.1) ready.");
  });
})();
