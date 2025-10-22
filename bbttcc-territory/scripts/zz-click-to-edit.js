// modules/bbttcc-territory/scripts/zz-click-to-edit.js
// v13-safe, robust click-to-edit for BBTTCC hexes.
// Listens on stage, renderer view, and document (capture) to ensure we see the click.
// Uses coordinate resolver; works even if the Drawing can't be selected.

(() => {
  const MOD = "bbttcc-territory";
  const TAG = "[bbttcc-click]";

  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  /* ---------------- Settings ---------------- */
  Hooks.once("init", () => {
    game.settings.register(MOD, "clickToEditEnabled", {
      name: "Click to Edit Hexes",
      hint: "Open the BBTTCC Hex Editor via single-click (with a modifier) or double-click.",
      scope: "client", config: true, type: Boolean, default: true
    });
    game.settings.register(MOD, "clickToEditModifier", {
      name: "Modifier for Single-Click",
      hint: "Which modifier must be held for single-click. Double-click always opens.",
      scope: "client", config: true, type: String,
      choices: { alt:"Alt", shift:"Shift", none:"None (single-click always opens)" },
      default: "none" // easier first-run; change anytime in Settings
    });
    game.settings.register(MOD, "useCoordinateResolver", {
      name: "Use Coordinate Resolver",
      hint: "Find the hex under the cursor from world coordinates (recommended).",
      scope: "client", config: true, type: Boolean, default: true
    });
  });

  /* ---------------- Helpers ---------------- */
  const enabledAndGM = () => !!game.user?.isGM && !!game.settings.get(MOD, "clickToEditEnabled");

  function modifierSatisfied(evt){
    const mod = game.settings.get(MOD, "clickToEditModifier");  // "alt" | "shift" | "none"
    if (mod === "none") return true;
    const e = evt?.originalEvent ?? evt?.data?.originalEvent ?? evt;
    return mod === "alt" ? !!e?.altKey : !!e?.shiftKey;
  }

  function uiClicked(evt){
    // Don't trigger when clicking inside Foundry UI windows/sidebars
    const t = evt?.target;
    if (!(t instanceof HTMLElement)) return false;
    return !!t.closest?.(".app, #sidebar, .ui, .window-app, #ui-top, #ui-left, #ui-bottom, #ui-right");
  }

  const docOf   = d => d?.document ?? d;
  const flagsOf = d => (docOf(d)?.flags?.[MOD] ?? {});
  function isHexDrawing(d) {
    const doc = docOf(d), f = flagsOf(doc);
    if (f.isHex === true) return true;
    if (String(f.kind||"").toLowerCase() === "territory-hex") return true;
    const shape = doc?.shape ?? d?.shape;
    const n = Array.isArray(shape?.points) ? shape.points.length : 0; // hex ~12 points (6 verts)
    return shape?.type === "p" && n >= 10;
  }

  async function openHexEditor(d){
    try {
      const uuid = docOf(d)?.uuid;
      if (!uuid) return ui.notifications?.warn?.("Hex not found.");
      if (game.bbttcc?.api?.territory?.openHexConfig) return game.bbttcc.api.territory.openHexConfig(uuid);
      if (game.bbttcc?.api?.territory?.claim)       return game.bbttcc.api.territory.claim(uuid);
      ui.notifications?.warn?.("BBTTCC Hex Editor API is not available.");
    } catch (e) {
      warn("openHexEditor failed", e);
      ui.notifications?.error?.("Failed to open Hex Editor (see console).");
    }
  }

  function worldPointFrom(evt){
    // Prefer FederatedPointerEvent global, else Foundry's mousePosition, else (0,0)
    const fed = evt?.data ?? evt;
    if (fed?.global) return { x: fed.global.x, y: fed.global.y };
    return canvas.mousePosition ?? { x: 0, y: 0 };
  }

  function hexUnderWorldPoint(pt){
    const placeables = canvas.drawings?.placeables ?? [];
    // top-most first
    for (let i = placeables.length - 1; i >= 0; i--){
      const p = placeables[i];
      if (!isHexDrawing(p)) continue;
      try {
        // robust local conversion (handles rotation/scale)
        const local = p.toLocal(new PIXI.Point(pt.x, pt.y));
        // hitArea -> polygon -> AABB
        if (p.hitArea?.contains?.(local.x, local.y)) return p;
        const sh = p.document.shape;
        if (sh?.type === "p" && Array.isArray(sh.points)) {
          const poly = new PIXI.Polygon(sh.points);
          if (poly.contains(local.x, local.y)) return p;
        }
        const w = sh?.width ?? p.width ?? 0, h = sh?.height ?? p.height ?? 0;
        if (local.x>=0 && local.y>=0 && local.x<=w && local.y<=h) return p;
      } catch { /* skip */ }
    }
    return null;
  }

  /* ---------------- Primary handlers ---------------- */
  async function handlePointerDown(evt, source){
    if (!enabledAndGM()) return;
    if (!game.settings.get(MOD, "useCoordinateResolver")) return;
    if (uiClicked(evt)) return;
    if (!modifierSatisfied(evt)) return;

    const pt = worldPointFrom(evt);
    const hex = hexUnderWorldPoint(pt);

    log(`${source}: click @`, { x: Math.round(pt.x), y: Math.round(pt.y), hit: !!hex, id: hex?.id, name: flagsOf(hex?.document)?.name });

    if (!hex) return;
    evt?.stopPropagation?.();
    await openHexEditor(hex.document);
  }

  async function handleDoubleClick(evt, source){
    if (!enabledAndGM()) return;
    if (uiClicked(evt)) return;

    // Double-click should always open if a hex is under cursor (ignores modifier)
    const pt = worldPointFrom(evt);
    const hex = hexUnderWorldPoint(pt);

    log(`${source}: dblclick @`, { x: Math.round(pt.x), y: Math.round(pt.y), hit: !!hex, id: hex?.id, name: flagsOf(hex?.document)?.name });

    if (!hex) return;
    evt?.stopPropagation?.();
    await openHexEditor(hex.document);
  }

  /* ---------------- Wire up listeners ---------------- */
  function attachListeners(){
    if (!canvas?.stage || !canvas?.app?.view) return;

    // 1) Foundry hooks (Drawing events) — still useful when they fire
    Hooks.off("clickDrawing", onClickDrawing);
    Hooks.off("dblclickDrawing", onDblclickDrawing);
    Hooks.on("clickDrawing", onClickDrawing);
    Hooks.on("dblclickDrawing", onDblclickDrawing);

    // 2) PIXI stage pointerdown/dblclick (works over scene area)
    canvas.stage.off("pointerdown", onStagePointerDown);
    canvas.stage.off("dblclick", onStageDblClick);
    canvas.stage.on("pointerdown", onStagePointerDown);
    canvas.stage.on("dblclick", onStageDblClick);

    // 3) Renderer view + document capture fallback (catches everything)
    canvas.app.view.removeEventListener("pointerdown", onViewPointerDown, { capture: true });
    canvas.app.view.addEventListener("pointerdown", onViewPointerDown, { capture: true });

    document.removeEventListener("dblclick", onDocumentDblClick, true);
    document.addEventListener("dblclick", onDocumentDblClick, true);

    log("click-to-edit ready — listeners attached (stage/view/document)");
  }

  // Delegates
  const onClickDrawing     = async (drawing, evt) => handlePointerDown(evt, "clickDrawing");
  const onDblclickDrawing  = async (drawing, evt) => handleDoubleClick(evt, "dblclickDrawing");
  const onStagePointerDown = async (evt)          => handlePointerDown(evt, "stage");
  const onStageDblClick    = async (evt)          => handleDoubleClick(evt, "stage");
  const onViewPointerDown  = async (evt)          => handlePointerDown(evt, "view");
  const onDocumentDblClick = async (evt)          => handleDoubleClick(evt, "document");

  Hooks.on("canvasReady", attachListeners);
  Hooks.on("canvasPan",   attachListeners);
  Hooks.once("ready",     attachListeners);
})();
