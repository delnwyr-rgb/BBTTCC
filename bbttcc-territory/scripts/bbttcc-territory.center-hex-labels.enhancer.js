/* bbttcc-territory — Center Hex Labels on Canvas (HexChrome QoL)
 * Fix2: compute polygon centroid from DrawingDocument.shape.points when available.
 * Local bounds centering can still look "offset" for polygons because bounds center ≠ shape center
 * when the polygon is skewed, rotated, or the drawing contains padding.
 *
 * Non-destructive: does NOT update DrawingDocument data; it adjusts the PIXI text each refresh.
 * Applies only to BBTTCC territory hex drawings:
 *   flags.bbttcc-territory.isHex === true OR flags.bbttcc-territory.kind === "territory-hex"
 */

(() => {
  const MOD = "bbttcc-territory";
  const log  = (...a)=>console.log(`[${MOD}][center-labels]`, ...a);
  const warn = (...a)=>console.warn(`[${MOD}][center-labels]`, ...a);

  function isTerritoryHex(drawing){
    const doc = drawing?.document ?? drawing;
    const f = doc?.flags?.[MOD] || doc?.getFlag?.(MOD) || {};
    return f.isHex === true || String(f.kind || "").toLowerCase() === "territory-hex";
  }

  function polygonCentroid(points){
    // points: [x0,y0,x1,y1,...] in local space
    if (!Array.isArray(points) || points.length < 6) return null;
    const n = Math.floor(points.length / 2);
    let area = 0, cx = 0, cy = 0;
    for (let i=0;i<n;i++){
      const x0 = Number(points[i*2] ?? 0);
      const y0 = Number(points[i*2+1] ?? 0);
      const j = (i+1) % n;
      const x1 = Number(points[j*2] ?? 0);
      const y1 = Number(points[j*2+1] ?? 0);
      const a = (x0 * y1) - (x1 * y0);
      area += a;
      cx += (x0 + x1) * a;
      cy += (y0 + y1) * a;
    }
    area *= 0.5;
    if (!isFinite(area) || Math.abs(area) < 1e-6) {
      // Fallback: average vertices
      let sx=0, sy=0;
      for (let i=0;i<n;i++){ sx += Number(points[i*2]||0); sy += Number(points[i*2+1]||0); }
      return { x: sx/n, y: sy/n };
    }
    cx /= (6 * area);
    cy /= (6 * area);
    if (!isFinite(cx) || !isFinite(cy)) return null;
    return { x: cx, y: cy };
  }

  function getTargetXY(drawing){
    const doc = drawing?.document;
    const shape = doc?.shape;
    // Prefer polygon centroid for hex drawings (shape.type === "p")
    if (shape?.type === "p" && Array.isArray(shape.points)) {
      const c = polygonCentroid(shape.points);
      if (c) return c;
    }
    // Fallback: width/height center (local)
    const w = Number(shape?.width ?? doc?.width ?? 0);
    const h = Number(shape?.height ?? doc?.height ?? 0);
    if (w > 0 && h > 0) return { x: w/2, y: h/2 };

    // Last resort: local bounds center
    try {
      const b = drawing?.getLocalBounds?.();
      if (b) return { x: b.x + b.width/2, y: b.y + b.height/2 };
    } catch {}
    return null;
  }

  function centerLabel(drawing){
    if (!drawing) return;
    if (!isTerritoryHex(drawing)) return;

    const txt = drawing.text ?? drawing._text;
    if (!txt) return;

    const p = getTargetXY(drawing);
    if (!p) return;

    try {
      if (txt.anchor?.set) txt.anchor.set(0.5, 0.5);
      if (txt.position?.set) txt.position.set(p.x, p.y);
      else { txt.x = p.x; txt.y = p.y; }
      txt.rotation = 0;
      txt.visible = true;
    } catch (e) {
      warn("Failed to center label", e);
    }
  }

  Hooks.on("drawDrawing", (drawing) => { try { centerLabel(drawing); } catch {} });
  Hooks.on("refreshDrawing", (drawing) => { try { centerLabel(drawing); } catch {} });

  Hooks.on("canvasReady", () => {
    try {
      const layer = canvas?.drawings;
      for (const d of layer?.placeables ?? []) centerLabel(d);
      log("Installed (polygon centroid centering).");
    } catch (e) {
      warn("Init failed", e);
    }
  });
})();
