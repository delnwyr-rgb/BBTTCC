/* bbttcc-territory — Center Hex Labels on Canvas (HexChrome QoL)
 * Fix2: compute polygon centroid from DrawingDocument.shape.points when available.
 * Local bounds centering can still look "offset" for polygons because bounds center ≠ shape center
 * when the polygon is skewed, rotated, or the drawing contains padding.
 *
 * Non-destructive: does NOT update DrawingDocument data; it adjusts the PIXI text each refresh.
 * Applies only to Bad Eden territory hex drawings:
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

  // ── BATCHED HEX LABELS (2026-10-26, map-travel perf pass) ───────────────────────────────────────────
  // Measured in a lab copy of Bad Eden: every hex is a PrimaryGraphics with its PreciseText label as a CHILD,
  // so the primary group draws outline, label, outline, label… — 2 objects per hex that never batch. 141
  // hexes ≈ 10 fps on an M3 Max; the labels alone are half of it. Here each territory hex's label stops
  // rendering in place (renderable=false, still laid out and centred above) and a Sprite sharing the label's
  // own texture is drawn in ONE PrimaryCanvasContainer at the Drawings sort layer with a sort above every
  // drawing — so labels sit over every hex and under every token, exactly as before, but as one run of
  // sprites. The hex outlines then run back-to-back too. Client setting `batchHexLabels` (default on) is the
  // per-browser escape hatch: off = Foundry's own labels.
  const S_BATCH = "batchHexLabels";
  Hooks.once("init", () => {
    try {
      game.settings.register(MOD, S_BATCH, {
        name: "Batch hex labels (faster hex maps)",
        hint: "Draws every hex name in one layer instead of one per hex, which roughly doubles the frame rate on hex maps. Turn off only if hex names look wrong.",
        scope: "client", config: true, type: Boolean, default: true,
        onChange: () => { try { canvas?.ready && canvas.draw(); } catch (_e) {} }
      });
    } catch (e) { warn("batch setting registration failed", e); }
  });
  const batchOn = () => { try { return game.settings.get(MOD, S_BATCH) !== false; } catch (_e) { return true; } };
  const LIFT = { cont: null, sprites: new Map() };
  function liftHost() {
    if (LIFT.cont && !LIFT.cont.destroyed && LIFT.cont.parent === canvas?.primary) return LIFT.cont;
    const PCC = foundry?.canvas?.primary?.PrimaryCanvasContainer;
    if (!PCC || !canvas?.primary) return null;
    const c = new PCC();
    c.name = "bbttcc-hex-labels";
    c.eventMode = "none"; c.interactiveChildren = false;
    c.elevation = 0;
    c.sortLayer = foundry.canvas.groups.PrimaryCanvasGroup.SORT_LAYERS.DRAWINGS;   // 600 — under TOKENS (700)
    c.sort = Number.MAX_SAFE_INTEGER;                                            // above every drawing
    canvas.primary.addChild(c);
    LIFT.cont = c; LIFT.sprites = new Map();
    return c;
  }
  function unlift(id) {
    const sp = LIFT.sprites.get(id); if (!sp) return;
    LIFT.sprites.delete(id);
    try { if (!sp.destroyed) sp.destroy({ texture: false, baseTexture: false }); } catch (_e) {}
  }
  function liftLabel(drawing) {
    if (!drawing?.id || !isTerritoryHex(drawing)) return;
    const txt = drawing.text ?? drawing._text; const mesh = txt?.parent;
    if (!batchOn() || !txt || !mesh || txt.destroyed) { if (txt && !txt.destroyed) txt.renderable = true; unlift(drawing.id); return; }
    const host = liftHost(); if (!host) { txt.renderable = true; return; }
    try { txt.updateText?.(true); } catch (_e) {}
    txt.renderable = false;
    let sp = LIFT.sprites.get(drawing.id);
    if (!sp || sp.destroyed) { sp = new PIXI.Sprite(txt.texture); sp.eventMode = "none"; host.addChild(sp); LIFT.sprites.set(drawing.id, sp); }
    if (sp.texture !== txt.texture) sp.texture = txt.texture;
    sp.anchor.set(txt.anchor?.x ?? 0.5, txt.anchor?.y ?? 0.5);
    // scene coords = the hex mesh's position + the label's offset inside it, through the mesh's rotation/scale/pivot
    // (computed by hand: primary-group objects keep their own transform bookkeeping, so localTransform/toGlobal lie)
    const r = mesh.rotation || 0, cs = Math.cos(r), sn = Math.sin(r);
    const lx = ((txt.x || 0) - (mesh.pivot?.x || 0)) * (mesh.scale?.x ?? 1), ly = ((txt.y || 0) - (mesh.pivot?.y || 0)) * (mesh.scale?.y ?? 1);
    sp.position.set((mesh.x || 0) + lx * cs - ly * sn, (mesh.y || 0) + lx * sn + ly * cs);
    sp.scale.set((txt.scale?.x ?? 1) * (mesh.scale?.x ?? 1), (txt.scale?.y ?? 1) * (mesh.scale?.y ?? 1));
    sp.rotation = (mesh.rotation || 0) + (txt.rotation || 0);
    sp.alpha = (mesh.alpha ?? 1) * (txt.alpha ?? 1);
    sp.visible = !!(String(txt.text || "").length && txt.visible !== false && mesh.visible !== false
      && drawing.visible !== false && drawing.renderable !== false && (drawing.isVisible ?? true));
  }
  // the label's texture is ours to share, never to destroy; the Drawing owns it
  Hooks.on("destroyDrawing", (drawing) => { try { unlift(drawing?.id); } catch {} });
  Hooks.on("canvasTearDown", () => { LIFT.cont = null; LIFT.sprites = new Map(); });

  Hooks.on("drawDrawing", (drawing) => { try { centerLabel(drawing); liftLabel(drawing); } catch {} });
  Hooks.on("refreshDrawing", (drawing) => { try { centerLabel(drawing); liftLabel(drawing); } catch {} });

  Hooks.on("canvasReady", () => {
    try {
      const layer = canvas?.drawings;
      for (const d of layer?.placeables ?? []) { centerLabel(d); liftLabel(d); }
      log(`Installed (polygon centroid centering${batchOn() ? `, ${LIFT.sprites.size} label(s) batched` : ""}).`);
    } catch (e) {
      warn("Init failed", e);
    }
  });
  Hooks.once("ready", () => { try { game.bbttcc ??= {}; game.bbttcc.api ??= {}; game.bbttcc.api.territory ??= {};
  game.bbttcc.api.territory.hexLabels = { relift: () => { for (const d of canvas?.drawings?.placeables ?? []) liftLabel(d); return LIFT.sprites.size; }, count: () => LIFT.sprites.size }; } catch (_e) {} });
})();

/* ── Quest markers on the hex map (owner ask 2026-09-22) ──────────────────────
 * A glyph on every territory hex that carries story: linked quests (Quests tab → Link Hex, or the Survey
 * rule's Word) and, for the GM, unplayed hex-tied beats. Data comes from
 * game.bbttcc.api.territory.questMarkers.list(scene); player visibility follows the quest-links rule
 * (hinted, or fog already lifted). Setting "Quest markers": gm (default) · all · off. Click a marker →
 * the hex sheet. Non-destructive: PIXI objects on the drawings layer, rebuilt on every refresh.
 */
(() => {
  const MOD = "bbttcc-territory";
  const S_MARKERS = "questMarkers";
  const TAG = `[${MOD}][quest-markers]`;
  let _cont = null, _timer = null, _shapes = null, _glyphs = null;
  // BATCHED (2026-10-26 perf pass): every marker's Graphics live in _shapes and every glyph/number Text in
  // _glyphs, so the frame draws all discs then all glyphs instead of disc, glyph, disc, glyph… (measured:
  // 28 interleaved markers cost ~15 fps on a hex map). The per-marker Container in _shapes keeps the
  // hover/click; glyphs are eventMode none and follow the marker's position + alpha.
  const glyphAt = (g, t, lx = 0, ly = 0) => { t.eventMode = "none"; t.position.set(g.x + lx, g.y + ly); t.alpha = g.alpha; _glyphs.addChild(t); };
  const mode = () => { try { return String(game.settings.get(MOD, S_MARKERS) || "gm"); } catch (_e) { return "gm"; } };
  Hooks.once("init", () => {
    try {
      game.settings.register(MOD, S_MARKERS, {
        name: "Quest markers on hex maps",
        hint: "Mark hexes that carry quests or unplayed story beats. gm = the GM sees every story hex (players see hinted ones); all = players also see fog-revealed linked hexes; off = no markers.",
        scope: "world", config: true, type: String, choices: { gm: "GM (+ hinted for players)", all: "Everyone (linked + hinted)", off: "Off" }, default: "gm",
        onChange: () => schedule()
      });
    } catch (e) { console.warn(TAG, "setting registration failed", e); }
  });
  function clear() { try { if (_cont && !_cont.destroyed) _cont.destroy({ children: true }); } catch (_e) {} _cont = null; _shapes = null; _glyphs = null; }
  function centerOf(d) {
    try {
      const obj = d.object; const doc = d;
      const local = (() => {
        const shape = doc?.shape;
        if (shape?.type === "p" && Array.isArray(shape.points) && shape.points.length >= 6) {
          const n = Math.floor(shape.points.length / 2); let sx = 0, sy = 0;
          for (let i = 0; i < n; i++) { sx += Number(shape.points[i * 2] || 0); sy += Number(shape.points[i * 2 + 1] || 0); }
          return { x: sx / n, y: sy / n };
        }
        return { x: Number(shape?.width ?? doc?.width ?? 0) / 2, y: Number(shape?.height ?? doc?.height ?? 0) / 2 };
      })();
      return { x: Number(doc.x || 0) + local.x, y: Number(doc.y || 0) + local.y, bounds: obj?.bounds };
    } catch (_e) { return null; }
  }
  // Bridges (owner ruling 2026-09-25): a crossing built by a faction is public infrastructure — everyone
  // sees it, whatever the quest-marker setting. Colour-blind-safe: an intact bridge is a GOLD plank on a
  // dark disc; a cut bridge is a GREY plank with a slash through it (shape carries the state, not hue).
  function drawBridges() {
    const isGM = !!game.user?.isGM;
    for (const d of canvas.scene.drawings ?? []) {
      const tf = d.flags?.[MOD]; const cr = tf?.crossing; if (!tf || !cr || typeof cr !== "object") continue;
      const c = centerOf(d); if (!c) continue;
      const cut = Number(cr.integrity ?? 1) <= 0;
      const holder = game.actors.get(String(cr.factionId || ""))?.name || "unknown";
      const size = Math.max(20, Math.min(36, Math.round((c.bounds?.height || 160) * 0.2)));
      const g = new PIXI.Container(); g.eventMode = "static"; g.cursor = "pointer";
      const col = cut ? 0x9aa7b8 : 0xffd54f;
      const bg = new PIXI.Graphics(); bg.beginFill(0x0a1220, 0.9); bg.lineStyle(2.5, col, 0.95); bg.drawCircle(0, 0, size * 0.62); bg.endFill(); g.addChild(bg);
      const plank = new PIXI.Graphics();
      plank.lineStyle(Math.max(3, size * 0.16), col, 1); plank.moveTo(-size * 0.42, size * 0.08); plank.lineTo(size * 0.42, size * 0.08);      // the deck
      plank.lineStyle(Math.max(2, size * 0.1), col, 1); plank.moveTo(-size * 0.42, size * 0.08); plank.quadraticCurveTo(0, -size * 0.5, size * 0.42, size * 0.08);   // the arch
      plank.moveTo(-size * 0.22, size * 0.08); plank.lineTo(-size * 0.22, size * 0.32); plank.moveTo(size * 0.22, size * 0.08); plank.lineTo(size * 0.22, size * 0.32);  // piers
      if (cut) { plank.lineStyle(Math.max(3, size * 0.14), 0xffffff, 1); plank.moveTo(-size * 0.45, size * 0.45); plank.lineTo(size * 0.45, -size * 0.45); }
      g.addChild(plank);
      const tip = `${String(tf.name || d.text || "hex")}: ${cut ? "bridge CUT" : "bridge"}${cr.name ? ` "${cr.name}"` : ""} — held by ${holder}${cut ? "" : `, toll ${Number(cr.toll ?? 5)} marks for the neutral`}`;
      g.on("pointerover", () => { try { ui.notifications?.info?.(tip, { permanent: false, console: false }); } catch (_e) {} });
      g.on("pointerdown", (ev) => { try { ev.stopPropagation?.(); const open = game.bbttcc?.api?.territory?.openHexSheet; if (open && isGM) open(d.uuid); else ui.notifications?.info?.(tip); } catch (_e) {} });
      g.position.set(c.x - (c.bounds ? c.bounds.width * 0.28 : size), c.y + (c.bounds ? c.bounds.height * 0.28 : size));
      _shapes.addChild(g);
    }
  }
  function draw() {
    clear();
    if (!canvas?.ready || !canvas.scene) return;
    // canvas.interface, not canvas.drawings (2026-10-01): the Drawings layer goes non-interactive
    // whenever it is not the active layer, so hover/click never fired on the Token layer.
    const parent = canvas.interface || canvas.drawings || canvas.stage;
    _cont = new PIXI.Container(); _cont.eventMode = "passive"; _cont.interactiveChildren = true; _cont.zIndex = 9000; parent.addChild(_cont);
    _shapes = new PIXI.Container(); _shapes.eventMode = "passive"; _shapes.interactiveChildren = true; _cont.addChild(_shapes);
    _glyphs = new PIXI.Container(); _glyphs.eventMode = "none"; _glyphs.interactiveChildren = false; _cont.addChild(_glyphs);
    try { drawBridges(); } catch (e) { console.warn(TAG, "bridge markers failed", e); }
    const m = mode(); if (m === "off") return;
    const api = game.bbttcc?.api?.territory?.questMarkers; if (!api?.list) return;
    const isGM = !!game.user?.isGM;
    let rows = [];
    try { rows = api.list(canvas.scene) || []; } catch (e) { console.warn(TAG, "list failed", e); return; }
    if (!isGM) rows = rows.filter(r => r.anyHinted || (m === "all" && r.playerVisible));
    if (!rows.length) return;
    for (const r of rows) {
      const c = centerOf(r.drawing); if (!c) continue;
      const g = new PIXI.Container(); g.eventMode = "static"; g.cursor = "pointer";
      const size = Math.max(22, Math.min(40, Math.round((c.bounds?.height || 160) * 0.22)));
      // Colour-blind-safe (owner is red-green CVD, 2026-09-22): the three states sit on the blue↔yellow axis
      // AND differ in shape, so no state depends on hue alone —
      //   story (GM)      : gold ✦ in a plain ring
      //   hinted (players): sky-blue ✦ in a double ring
      //   word sent, unvisited: white ✉ on a blue square
      const state = (r.wordSent && !r.visited) ? "word" : (r.anyHinted ? "hinted" : "story");
      const color = state === "word" ? 0xffffff : state === "hinted" ? 0x4fc3ff : 0xffd54f;
      const ring  = state === "word" ? 0x3d7cff : color;
      const bg = new PIXI.Graphics();
      bg.beginFill(state === "word" ? 0x123a7a : 0x0a1220, 0.9); bg.lineStyle(2.5, ring, 0.95);
      if (state === "word") bg.drawRoundedRect(-size * 0.62, -size * 0.62, size * 1.24, size * 1.24, size * 0.18);
      else bg.drawCircle(0, 0, size * 0.62);
      bg.endFill();
      if (state === "hinted") { bg.lineStyle(1.5, ring, 0.8); bg.drawCircle(0, 0, size * 0.78); }
      g.addChild(bg);
      const glyph = new PIXI.Text(state === "word" ? "✉" : "✦", new PIXI.TextStyle({ fontFamily: "sans-serif", fontSize: size, fill: color, stroke: 0x000000, strokeThickness: 3 }));
      glyph.anchor.set(0.5, 0.55); const glyphLocal = [0, 0];
      const n = (r.linked?.length || 0) + (isGM ? (r.unplayed || 0) : 0);
      if (n > 1) {
        const badge = new PIXI.Text(String(n), new PIXI.TextStyle({ fontFamily: "sans-serif", fontSize: Math.round(size * 0.5), fontWeight: "700", fill: 0xffffff, stroke: 0x000000, strokeThickness: 3 }));
        const bb = new PIXI.Graphics(); bb.beginFill(0x000000, 0.75); bb.drawCircle(size * 0.5, -size * 0.45, size * 0.32); bb.endFill(); g.addChild(bb);
        badge.anchor.set(0.5, 0.5); var badgeText = badge, badgeLocal = [size * 0.5, -size * 0.45];
      } else { var badgeText = null, badgeLocal = null; }
      // dim, unhinted story = a whisper only the GM sees
      if (isGM && !r.anyHinted && !r.linked?.length) g.alpha = 0.7;
      g.position.set(c.x + (c.bounds ? c.bounds.width * 0.28 : size), c.y - (c.bounds ? c.bounds.height * 0.28 : size));
      glyphAt(g, glyph, ...glyphLocal); if (badgeText) glyphAt(g, badgeText, ...badgeLocal);
      const names = [...(r.linked || []).map(l => `${l.name}${l.hinted ? " (hinted)" : ""}`), ...(isGM ? r.storyNames : [])];
      const tip = `${r.hexName}: ${names.join(" · ") || "story"}${isGM && r.unplayed ? ` — ${r.unplayed} unplayed beat${r.unplayed === 1 ? "" : "s"}` : ""}${r.wordSent && !r.visited ? " — word sent, unvisited" : ""}`;
      g.on("pointerover", () => { try { ui.notifications?.info?.(tip, { permanent: false, console: false }); } catch (_e) {} });
      g.on("pointerdown", (ev) => { try { ev.stopPropagation?.(); const open = game.bbttcc?.api?.territory?.openHexSheet; if (open && isGM) open(r.hexUuid); else ui.notifications?.info?.(tip); } catch (_e) {} });
      _shapes.addChild(g);
    }
    console.log(TAG, `drew ${_shapes.children.length} marker(s) (batched: ${_glyphs.children.length} glyph text(s))`);
  }
  function schedule() { if (_timer) clearTimeout(_timer); _timer = setTimeout(() => { _timer = null; try { draw(); } catch (e) { console.warn(TAG, "draw failed", e); } }, 250); }
  Hooks.on("canvasReady", schedule);
  Hooks.on("canvasTearDown", clear);
  for (const h of ["createDrawing", "updateDrawing", "deleteDrawing"]) Hooks.on(h, (doc) => { if (doc?.flags?.[MOD] || doc?.parent?.id === canvas?.scene?.id) schedule(); });
  for (const h of ["bbttcc:story:changed", "bbttcc:survey:word", "bbttcc:hex:visited", "bbttcc-campaign:storyUpdated", "bbttcc:questMarkers:refresh", "bbttcc:beat:resolved", "bbttcc:crossing:changed"]) Hooks.on(h, schedule);
  Hooks.on("updateSetting", (s) => { if (String(s?.key || "").endsWith(`${MOD}.${S_MARKERS}`)) schedule(); });
})();
