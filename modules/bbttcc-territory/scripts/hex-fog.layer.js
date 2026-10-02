/* modules/bbttcc-territory/scripts/hex-fog.layer.js
 * Bad Eden Hex Fog of War (v1)
 *
 * Paints a solid black mask across the entire scene with hex-shaped holes
 * punched for every hex Drawing whose `document.hidden === false`. GMs
 * bypass the layer by default; the GM Player View macro can flip the layer
 * visible to preview what players see.
 *
 * Tokens (owner ruling 2026-10-02): fog hides tokens from PLAYER seats — a token
 * the viewer does not own, whose centre is not inside a revealed hex, is hidden
 * (refreshToken hook). The viewer's own tokens always show; the GM owns every
 * token, so the GM (preview or not) still sees everything, as with core fog.
 * The fog graphic itself stays BELOW tokens so owned tokens are never painted over.
 *
 * Discovery state lives in `document.hidden` (per-Drawing, per-scene). The
 * "Bad Eden Toggle One Hex Visibility" GM macro is the canonical reveal trigger.
 *
 * Refresh triggers:
 *   - canvasReady (scene change / first load)
 *   - createDrawing / updateDrawing(hidden) / deleteDrawing
 *   - bbttcc:territory:hexUpdated
 *   - explicit api.refresh() call
 *
 * Public API:
 *   game.bbttcc.api.territory.fog = {
 *     refresh(),
 *     setVisibleForGM(bool),
 *     isEnabled(),
 *     setEnabled(bool),
 *   }
 */

(() => {
  const MOD = "bbttcc-territory";
  const TAG = "[bbttcc-fog]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // Polygon inflate ratio. ~2.5% pushes adjacent revealed hexes into a
  // continuous revealed region (no hairline antialiasing seams).
  const INFLATE = 0.025;

  // Settings keys
  const S_ENABLED  = "hexFogEnabled";        // world: master switch (default true)
  const S_GM_VIEW  = "hexFogGMPreview";      // client: GM sees fog too (default false)
  const S_COLOR    = "hexFogColor";          // world: fill color (default #000000)
  const S_ALPHA    = "hexFogAlpha";          // world: fill alpha (default 1.0)

  // ---------- helpers ----------
  function isHexDoc(doc) {
    const f = doc?.flags?.[MOD] ?? {};
    return f.isHex === true || String(f.kind || "").toLowerCase() === "territory-hex";
  }

  // World-space polygon points for a hex Drawing. Mirrors the toggle-macro
  // pattern (and main.js's hexVerts/toRelativePoints) — Drawing.shape.points
  // are scene-relative offsets from doc.x/doc.y.
  function worldPolygonForDoc(doc) {
    const x = Number(doc.x || 0);
    const y = Number(doc.y || 0);
    const pts = doc?.shape?.points;
    if (Array.isArray(pts) && pts.length >= 6) {
      // Flat array [x0,y0,x1,y1,...] in world space.
      const abs = new Array(pts.length);
      for (let i = 0; i < pts.length; i += 2) {
        abs[i]     = x + Number(pts[i]     || 0);
        abs[i + 1] = y + Number(pts[i + 1] || 0);
      }
      return abs;
    }
    // Rectangle fallback (rare for Bad Eden hexes, but keep parity with toggle macro).
    const w = Number(doc.shape?.width  || doc.width  || 0);
    const h = Number(doc.shape?.height || doc.height || 0);
    return [x, y, x+w, y, x+w, y+h, x, y+h];
  }

  // Inflate polygon outward from its centroid by `ratio`. Eliminates seams
  // between adjacent revealed hexes during ERASE blending.
  function inflatePolygon(pts, ratio) {
    if (!pts || pts.length < 6) return pts;
    let cx = 0, cy = 0, n = pts.length / 2;
    for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i+1]; }
    cx /= n; cy /= n;
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      out[i]   = cx + (pts[i]   - cx) * (1 + ratio);
      out[i+1] = cy + (pts[i+1] - cy) * (1 + ratio);
    }
    return out;
  }

  function hexToInt(hex) {
    try {
      const s = String(hex || "#000000").replace("#","").trim();
      return parseInt(s.length === 3 ? s.split("").map(c=>c+c).join("") : s.slice(0,6), 16) | 0;
    } catch { return 0x000000; }
  }

  // ---------- the layer ----------
  let _fogGfx = null;          // PIXI.Graphics
  let _rafScheduled = false;   // debounce via rAF
  // Revealed (inflated) hex polygons + bbox, as last drawn — the token-hiding test.
  // _fogActive = fog is drawn for THIS seat on THIS scene; when false, no token is hidden.
  let _fogActive = false;
  let _revealed = [];          // [{ pts, minX, minY, maxX, maxY }]

  function _pointInPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, k = pts.length - 2; i < pts.length; k = i, i += 2) {
      const xi = pts[i], yi = pts[i + 1], xk = pts[k], yk = pts[k + 1];
      if (((yi > py) !== (yk > py)) && (px < (xk - xi) * (py - yi) / ((yk - yi) || 1e-9) + xi)) inside = !inside;
    }
    return inside;
  }
  function _isFogged(px, py) {
    if (!_fogActive) return false;
    for (const r of _revealed) {
      if (px < r.minX || px > r.maxX || py < r.minY || py > r.maxY) continue;
      if (_pointInPoly(px, py, r.pts)) return false;
    }
    return true;
  }
  // Hide a token under the fog for this seat. Only ever turns visibility OFF —
  // Foundry recomputes it on every refreshVisibility, so a reveal restores it.
  function _applyFogToToken(token) {
    try {
      if (!token) return;
      const c = token.center;
      const hide = _fogActive && !token.document?.isOwner && !!c && _isFogged(Number(c.x), Number(c.y));
      if (!hide) {
        // walked out of the fog on a position-only refresh: let Foundry recompute visibility once
        if (token._bbttccFogHidden) { token._bbttccFogHidden = false; token.renderFlags?.set?.({ refreshVisibility: true }); }
        return;
      }
      token._bbttccFogHidden = true;
      token.visible = false;
      if (token.mesh) token.mesh.visible = false;
    } catch (_e) {}
  }
  function _refreshAllTokenVisibility() {
    try { for (const t of canvas?.tokens?.placeables ?? []) t.renderFlags?.set?.({ refreshVisibility: true }); } catch (_e) {}
  }

  function ensureLayer() {
    if (_fogGfx && !_fogGfx.destroyed) return _fogGfx;
    if (!canvas?.ready) return null;

    const g = new PIXI.Graphics();
    g.name = "bbttcc-hex-fog";
    g.eventMode = "none";       // never absorb pointer events
    g.interactive = false;
    g.interactiveChildren = false;

    // Sit above the scene background mesh, below the Drawings layer.
    // canvas.primary holds the background tile/mesh; Drawings live on
    // canvas.drawings which is a separate sibling group rendered above us.
    // zIndex high enough to clear tiles/tokens within canvas.primary but
    // they still render below canvas.drawings.
    const parent = canvas.primary ?? canvas.stage;
    parent.addChild(g);
    parent.sortableChildren = true;
    g.zIndex = 999;
    // canvas.primary sorts by elevation → sortLayer → sort → zIndex (2026-10-01): zIndex alone left
    // the fog in the SCENE band under every tile. Pin it just above ground-level TILES (map art,
    // landmarks) and below DRAWINGS / TOKENS. Tokens under fog are hidden per seat instead
    // (owner ruling 2026-10-02, refreshToken hook below), so the viewer's own tokens never vanish.
    try {
      const SL = foundry.canvas?.groups?.PrimaryCanvasGroup?.SORT_LAYERS ?? globalThis.PrimaryCanvasGroup?.SORT_LAYERS;
      g.elevation = 0;
      g.sortLayer = (Number(SL?.TILES) || 500) + 50;
      if (Number(SL?.DRAWINGS) && g.sortLayer >= SL.DRAWINGS) g.sortLayer = SL.DRAWINGS - 1;
      parent.sortDirty = true;
    } catch (_e) {}
    log("fog layer attached", { parent: parent?.constructor?.name, primaryChildren: canvas.primary?.children?.length });

    _fogGfx = g;
    return g;
  }

  function destroyLayer() {
    try {
      if (_fogGfx && !_fogGfx.destroyed) {
        _fogGfx.parent?.removeChild(_fogGfx);
        _fogGfx.destroy({ children: true });
      }
    } catch (e) { warn("destroyLayer failed", e); }
    _fogGfx = null;
  }

  function shouldRenderForThisUser() {
    try {
      if (!game.settings.get(MOD, S_ENABLED)) return false;
    } catch { return false; }
    if (game.user?.isGM) {
      try { return !!game.settings.get(MOD, S_GM_VIEW); } catch { return false; }
    }
    return true;
  }

  function refresh() {
    try {
      if (!canvas?.ready) return;

      const wasActive = _fogActive;
      const visible = shouldRenderForThisUser();
      if (!visible) {
        if (_fogGfx) _fogGfx.visible = false;
        _fogActive = false; _revealed = [];
        if (wasActive) _refreshAllTokenVisibility();
        return;
      }

      // Scope guard: only render fog on scenes that actually contain hex
      // Drawings. Without this, every non-hex scene gets a full-screen
      // black mask for players (no hexes = no holes to punch).
      const placeables = canvas.drawings?.placeables ?? [];
      let hexCount = 0;
      for (const p of placeables) {
        if (isHexDoc(p?.document)) { hexCount++; break; }
      }
      if (hexCount === 0) {
        if (_fogGfx) _fogGfx.visible = false;
        _fogActive = false; _revealed = [];
        if (wasActive) _refreshAllTokenVisibility();
        return;
      }

      const g = ensureLayer();
      if (!g) return;
      g.visible = true;
      g.clear();

      // Fill: full scene rect (so fog extends past the hex grid to scene edges).
      const rect = canvas.dimensions?.sceneRect ?? canvas.dimensions?.rect ?? { x:0, y:0, width: canvas.dimensions?.width || 0, height: canvas.dimensions?.height || 0 };
      const color = hexToInt((() => { try { return game.settings.get(MOD, S_COLOR); } catch { return "#000000"; } })());
      const alpha = (() => { try { return Number(game.settings.get(MOD, S_ALPHA) ?? 1); } catch { return 1; } })();

      // Build the fog as a single shape: outer rectangle minus hex-shaped
      // holes. PIXI Graphics' beginHole/endHole creates true alpha-zero
      // cutouts within a single fill, which is more reliable than ERASE
      // blend (ERASE works at the alpha-buffer level and can be defeated
      // by parent container compositing). With true holes, anything in
      // the rendering order below this Graphics shows through cleanly.
      const holes = [];
      for (const p of placeables) {
        const doc = p?.document;
        if (!doc) continue;
        if (!isHexDoc(doc)) continue;
        if (doc.hidden === true) continue; // still hidden = stays under fog
        const poly = worldPolygonForDoc(doc);
        if (!poly || poly.length < 6) continue;
        holes.push(inflatePolygon(poly, INFLATE));
      }

      g.beginFill(color, alpha);
      g.drawRect(rect.x, rect.y, rect.width, rect.height);
      for (const hole of holes) {
        g.beginHole();
        g.drawPolygon(hole);
        g.endHole();
      }
      g.endFill();

      _revealed = holes.map(pts => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]); }
        return { pts, minX, minY, maxX, maxY };
      });
      _fogActive = alpha > 0;
      _refreshAllTokenVisibility();

      log(`refresh: ${holes.length} revealed / ${placeables.length} drawings (fog ${visible ? "on" : "off"})`);
    } catch (e) {
      warn("refresh failed", e);
    }
  }

  function scheduleRefresh() {
    if (_rafScheduled) return;
    _rafScheduled = true;
    requestAnimationFrame(() => {
      _rafScheduled = false;
      refresh();
    });
  }

  // ---------- settings ----------
  Hooks.once("init", () => {
    try {
      game.settings.register(MOD, S_ENABLED, {
        name: "Hex Fog of War",
        hint: "Black out scene background under hexes that are hidden from players. GMs see through it by default.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => scheduleRefresh()
      });
      game.settings.register(MOD, S_GM_VIEW, {
        name: "GM: Preview Fog of War",
        hint: "When ON, the GM also sees the fog (matches the player view). Off by default so GMs can author the map.",
        scope: "client",
        config: true,
        type: Boolean,
        default: false,
        onChange: () => scheduleRefresh()
      });
      game.settings.register(MOD, S_COLOR, {
        name: "Hex Fog Color",
        hint: "Hex color string. Default #000000 (true black).",
        scope: "world",
        config: true,
        type: String,
        default: "#000000",
        onChange: () => scheduleRefresh()
      });
      game.settings.register(MOD, S_ALPHA, {
        name: "Hex Fog Opacity",
        hint: "0.0 (invisible) to 1.0 (opaque). Default 1.0.",
        scope: "world",
        config: true,
        type: Number,
        default: 1.0,
        range: { min: 0, max: 1, step: 0.05 },
        onChange: () => scheduleRefresh()
      });
    } catch (e) {
      warn("settings register failed", e);
    }
  });

  // ---------- hooks ----------
  Hooks.on("canvasReady", () => {
    destroyLayer(); // canvas reset; old PIXI tree is gone
    _fogActive = false; _revealed = [];
    scheduleRefresh();
  });

  Hooks.on("canvasTearDown", () => { destroyLayer(); _fogActive = false; _revealed = []; });

  // Fog hides tokens (player seats): runs after every token refresh, incl. each
  // animation frame's position refresh, so a token walking into a revealed hex appears.
  Hooks.on("refreshToken", (token) => _applyFogToToken(token));

  Hooks.on("createDrawing", (doc) => { if (isHexDoc(doc)) scheduleRefresh(); });
  Hooks.on("deleteDrawing", (doc) => { if (isHexDoc(doc)) scheduleRefresh(); });
  Hooks.on("updateDrawing", (doc, changes) => {
    if (!isHexDoc(doc)) return;
    if ("hidden" in changes || "shape" in changes || "x" in changes || "y" in changes) {
      scheduleRefresh();
    }
  });

  // Bad Eden's own update broadcast — covers flag-only edits that don't
  // touch hidden but might affect display assumptions later.
  Hooks.on("bbttcc:territory:hexUpdated", () => scheduleRefresh());

  // ---------- API ----------
  Hooks.once("ready", () => {
    try {
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.api = game.bbttcc.api || {};
      game.bbttcc.api.territory = game.bbttcc.api.territory || {};
      game.bbttcc.api.territory.fog = {
        refresh: () => scheduleRefresh(),
        setVisibleForGM: async (on) => {
          try { await game.settings.set(MOD, S_GM_VIEW, !!on); } catch (e) { warn("setVisibleForGM failed", e); }
        },
        isEnabled: () => {
          try { return !!game.settings.get(MOD, S_ENABLED); } catch { return false; }
        },
        setEnabled: async (on) => {
          if (!game.user?.isGM) {
            ui.notifications?.warn?.("Hex Fog enable/disable is GM-only.");
            return;
          }
          try { await game.settings.set(MOD, S_ENABLED, !!on); } catch (e) { warn("setEnabled failed", e); }
        }
      };
      log("API ready: game.bbttcc.api.territory.fog");
      scheduleRefresh();
    } catch (e) { warn("ready hook failed", e); }
  });
})();
