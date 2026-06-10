// Bad Eden Reveal Clicked Hex + Adjacent Hexes
// GM macro — reveal clicked hex + neighbors within RADIUS

(async () => {
  if (!game.user?.isGM) { ui.notifications.warn("GM only."); return; }

  const MOD = "bbttcc-territory";
  const RADIUS = 1;

  const isHexDrawing = (doc) => {
    const f = doc?.flags?.[MOD] ?? {};
    return f.isHex === true || String(f.kind || "").toLowerCase() === "territory-hex";
  };

  const hexName = (doc) => {
    const f = doc?.flags?.[MOD] ?? {};
    return String(f.name || doc.text || "(Hex)").trim();
  };

  function worldPolygonFor(doc) {
    const x = Number(doc.x || 0);
    const y = Number(doc.y || 0);
    const pts = doc?.shape?.points;
    if (Array.isArray(pts) && pts.length >= 6) {
      const abs = new Array(pts.length);
      for (let i = 0; i < pts.length; i += 2) {
        abs[i]     = x + Number(pts[i]     || 0);
        abs[i + 1] = y + Number(pts[i + 1] || 0);
      }
      return { type: "poly", points: abs };
    }
    const w = Number(doc.shape?.width  || doc.width  || 0);
    const h = Number(doc.shape?.height || doc.height || 0);
    return { type: "rect", x, y, w, h };
  }

  function centerOf(doc) {
    const g = worldPolygonFor(doc);
    if (g.type === "poly") {
      let minX =  Infinity, minY =  Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < g.points.length; i += 2) {
        const px = g.points[i], py = g.points[i + 1];
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
    return { x: g.x + g.w / 2, y: g.y + g.h / 2 };
  }

  function approxHexDistance(a, b) {
    const ca = centerOf(a), cb = centerOf(b);
    const distPx = Math.hypot(ca.x - cb.x, ca.y - cb.y);
    const step = Number(canvas.scene?.grid?.size || 100);
    return Math.round(distPx / step);
  }

  // Same pattern main.js uses for hex placement — known good in this scene setup.
  function worldFromEvent(ev) {
    try {
      if (ev?.data?.getLocalPosition) return ev.data.getLocalPosition(canvas.app.stage);
      if (ev?.global) return canvas.stage.worldTransform.applyInverse(ev.global);
    } catch (_e) {}
    return canvas.mousePosition ?? { x: 0, y: 0 };
  }

  function hexAtWorldPoint(wpt) {
    const placeables = canvas.drawings?.placeables ?? [];
    for (let i = placeables.length - 1; i >= 0; i--) {
      const doc = placeables[i]?.document;
      if (!isHexDrawing(doc)) continue;
      const g = worldPolygonFor(doc);
      if (g.type === "poly") {
        if (new PIXI.Polygon(g.points).contains(wpt.x, wpt.y)) return doc;
      } else {
        if (wpt.x >= g.x && wpt.y >= g.y && wpt.x <= g.x + g.w && wpt.y <= g.y + g.h) return doc;
      }
    }
    return null;
  }

  async function revealDocs(docs) {
    const updates = docs.filter(d => d?.hidden).map(d => ({ _id: d.id, hidden: false }));
    if (!updates.length) return 0;
    await canvas.scene.updateEmbeddedDocuments("Drawing", updates);
    return updates.length;
  }

  const allDocs = (canvas.drawings?.placeables ?? [])
    .map(p => p.document)
    .filter(isHexDrawing);

  if (!allDocs.length) { ui.notifications.warn("No Bad Eden hex drawings found on this scene."); return; }

  ui.notifications.info("Click a hex to reveal it and adjacent hexes. Press Esc to cancel.");

  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    try { canvas.stage.off("pointerdown", onPointerDown); } catch (_e) {}
    try { window.removeEventListener("keydown", onKeyDown, true); } catch (_e) {}
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      cleanup();
      ui.notifications.info("Hex reveal cancelled.");
    }
  };

  const onPointerDown = async (evt) => {
    if (finished) return;
    cleanup();

    const wpt = worldFromEvent(evt);
    const clicked = hexAtWorldPoint(wpt);

    console.log("[Bad Eden Reveal] click", {
      world: { x: Math.round(wpt.x), y: Math.round(wpt.y) },
      hit: !!clicked,
      id: clicked?.id,
      name: clicked ? hexName(clicked) : null
    });

    if (!clicked) { ui.notifications.warn("No hex found under click."); return; }

    const targets = allDocs.filter(doc => approxHexDistance(clicked, doc) <= RADIUS);
    const changed = await revealDocs(targets);

    ui.notifications.info(
      `Revealed ${targets.length} hex(es) around ${hexName(clicked)}${changed ? ` (${changed} newly visible)` : ""}.`
    );
  };

  window.addEventListener("keydown", onKeyDown, true);
  canvas.stage.once("pointerdown", onPointerDown);
})();
