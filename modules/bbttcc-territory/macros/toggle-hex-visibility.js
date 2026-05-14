// BBTTCC Toggle One Hex Visibility
// GM macro — click a BBTTCC hex to flip hidden/visible

(async () => {
  if (!game.user?.isGM) { ui.notifications.warn("GM only."); return; }

  const MOD = "bbttcc-territory";

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
      ui.notifications.info("Hex toggle cancelled.");
    }
  };

  const onPointerDown = async (evt) => {
    if (finished) return;
    cleanup();

    const wpt = worldFromEvent(evt);
    const clicked = hexAtWorldPoint(wpt);

    console.log("[BBTTCC Toggle] click", {
      world: { x: Math.round(wpt.x), y: Math.round(wpt.y) },
      hit: !!clicked,
      id: clicked?.id,
      name: clicked ? hexName(clicked) : null
    });

    if (!clicked) { ui.notifications.warn("No hex found under click."); return; }

    const nextHidden = !clicked.hidden;
    await canvas.scene.updateEmbeddedDocuments("Drawing", [
      { _id: clicked.id, hidden: nextHidden }
    ]);

    ui.notifications.info(`${nextHidden ? "Hid" : "Revealed"}: ${hexName(clicked)}`);
  };

  ui.notifications.info("Click a hex to toggle its visibility. Press Esc to cancel.");
  window.addEventListener("keydown", onKeyDown, true);
  canvas.stage.once("pointerdown", onPointerDown);
})();
