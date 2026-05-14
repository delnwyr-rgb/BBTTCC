// PATCHMARK: visuals-grid-snap-token-pick-retry-20251220
/* BBTTCC — Travel Visuals
 * Draw route overlay + animate token along Travel Console legs.
 *
 * Fixes:
 * - Grid/hex-safe centering: snap to grid center + snapped top-left.
 * - Correct token selection: prefer token whose actorId matches the Travel Console-selected faction.
 * - Back-compat: supports legacy runVisuals(app, uuidsArray) calls.
 * - Retry: if called while an encounter scene is active (no faction token present), retry until token exists.
 */

(() => {
  const TAG = "[bbttcc-travel-visuals]";
  console.log(TAG, "loaded; awaiting explicit runVisuals calls");

  // ---------------------------------------------------------------------------
  // Grid helpers
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Hex-centroid helpers
  //
  // BBTTCC territory hexes are polygon Drawings. `placeable.center` returns the
  // BOUNDING-BOX center; for polygons with padding / skew / non-uniform scale
  // that point can sit visibly off the polygon's geometric centroid — far
  // enough that the moved token looks like it landed in the wrong hex. The
  // bbttcc-territory center-hex-labels enhancer already solved this for label
  // placement (compute centroid from shape.points). We mirror that math for
  // token placement so visuals + labels agree.
  // ---------------------------------------------------------------------------

  function polygonCentroid(points) {
    if (!Array.isArray(points) || points.length < 6) return null;
    const n = Math.floor(points.length / 2);
    let area = 0, cx = 0, cy = 0;
    for (let i = 0; i < n; i++) {
      const x0 = Number(points[i * 2]     ?? 0);
      const y0 = Number(points[i * 2 + 1] ?? 0);
      const j  = (i + 1) % n;
      const x1 = Number(points[j * 2]     ?? 0);
      const y1 = Number(points[j * 2 + 1] ?? 0);
      const a  = (x0 * y1) - (x1 * y0);
      area += a;
      cx   += (x0 + x1) * a;
      cy   += (y0 + y1) * a;
    }
    area *= 0.5;
    if (!isFinite(area) || Math.abs(area) < 1e-6) {
      // Degenerate polygon — average vertices
      let sx = 0, sy = 0;
      for (let i = 0; i < n; i++) {
        sx += Number(points[i * 2]     || 0);
        sy += Number(points[i * 2 + 1] || 0);
      }
      return { x: sx / n, y: sy / n };
    }
    cx /= (6 * area);
    cy /= (6 * area);
    if (!isFinite(cx) || !isFinite(cy)) return null;
    return { x: cx, y: cy };
  }

  // Returns the hex's visual centroid in SCENE-pixel coordinates. For polygon
  // drawings, computes the true centroid from shape.points (local space) and
  // adds the drawing's document-space position.
  //
  // IMPORTANT: prefer `doc.x`/`doc.y` over `obj.x`/`obj.y`. The placeable's
  // PIXI position can be 0 transiently — e.g., right after a canvas redraw
  // between travel legs — even though the document still holds the real
  // scene coords. Reading `obj.x` in that window puts the token at the scene
  // origin (the "ship icon at top-left of empty hex grid" symptom).
  //
  // Also includes a sanity check: if the computed centroid lands wildly
  // outside the drawing's bounding box, fall back to the bbox center. This
  // catches degenerate polygons or unexpected coordinate-system surprises.
  function hexVisualCenter(obj) {
    try {
      const doc   = obj?.document;
      const shape = doc?.shape;
      if (!doc) {
        if (obj?.center) return { x: obj.center.x, y: obj.center.y };
        return null;
      }

      // Document data is the source of truth for position; PIXI placeable
      // state can be torn down and recreated on canvas redraws.
      const ox = Number(doc.x ?? obj?.x ?? 0);
      const oy = Number(doc.y ?? obj?.y ?? 0);
      const w  = Number(shape?.width  ?? doc.width  ?? 0);
      const h  = Number(shape?.height ?? doc.height ?? 0);

      if (shape?.type === "p" && Array.isArray(shape.points)) {
        const local = polygonCentroid(shape.points);
        if (local && Number.isFinite(local.x) && Number.isFinite(local.y)) {
          const sceneCx = ox + local.x;
          const sceneCy = oy + local.y;
          // Sanity bounds check — if both width and height are positive, the
          // centroid should sit within [0, w] x [0, h] in local space.
          // Allow a small tolerance for rounding.
          if (w > 0 && h > 0) {
            const tol = 2;
            const inBounds =
              local.x >= -tol && local.x <= w + tol &&
              local.y >= -tol && local.y <= h + tol;
            if (inBounds) return { x: sceneCx, y: sceneCy };
            console.warn(TAG, "polygon centroid out of bbox; falling back to bbox center", {
              uuid: doc.uuid, ox, oy, w, h, local
            });
          } else {
            // Bbox unknown — trust the centroid
            return { x: sceneCx, y: sceneCy };
          }
        }
      }

      // Polygon path failed or shape is non-polygon. Use bbox center derived
      // from document data, since obj.center can be stale on redraws.
      if (w > 0 && h > 0) return { x: ox + w / 2, y: oy + h / 2 };
      if (obj?.center)    return { x: obj.center.x, y: obj.center.y };
    } catch (e) {
      console.warn(TAG, "hexVisualCenter failed", e);
    }
    return null;
  }

  function tokenDimsPx(token) {
    try {
      if (token?.w && token?.h) return { w: token.w, h: token.h };
      const gs = canvas?.grid?.size || 100;
      return {
        w: Number(token?.document?.width || 1) * gs,
        h: Number(token?.document?.height || 1) * gs
      };
    } catch (_e) {
      return { w: 100, h: 100 };
    }
  }

  // ---------------------------------------------------------------------------
  // Token selection (correct faction token)
  // ---------------------------------------------------------------------------

  function getSelectedFactionIdFromConsole(app) {
    try {
      // V1: app.element is jQuery → app.element[0] is the HTMLElement.
      // V2: app.element IS the HTMLElement directly.
      const html = (app?.element instanceof HTMLElement) ? app.element : (app?.element?.[0] || null);
      if (!html) return null;
      const sel = html.querySelector?.('select[data-role="faction"]');
      const id = sel?.value ? String(sel.value) : null;
      return id || null;
    } catch (_e) {
      return null;
    }
  }

  function pickTokenForFaction(factionId) {
    try {
      const all = canvas?.tokens?.placeables || [];
      const controlled = canvas?.tokens?.controlled || [];

      // Faction tokens are typically unlinked — t.actor.id is the synthetic
      // per-token id; the world Actor id lives at t.document.actorId. Check
      // both so unlinked faction tokens resolve. See feedback memory.
      const matches = (t) => {
        if (!t || !factionId) return false;
        const linked = String(t?.actor?.id || "");
        const source = String(t?.document?.actorId || "");
        const fid    = String(factionId);
        return linked === fid || source === fid;
      };

      if (factionId) {
        const ctl = controlled.find(matches);
        if (ctl) return ctl;
        const any = all.find(matches);
        if (any) return any;
      }

      // fallback
      if (controlled.length) return controlled[0];
      return all.find(t => !t.hidden) || all[0] || null;
    } catch (_e) {
      return null;
    }
  }

  async function resolveTokenWithRetry({ explicitToken, factionId, app, tries = 18, delayMs = 250 } = {}) {
    if (explicitToken) return explicitToken;

    const wantFactionId = factionId || getSelectedFactionIdFromConsole(app);

    for (let i = 0; i < tries; i++) {
      const t = pickTokenForFaction(wantFactionId);
      if (t) return t;
      // Called during an encounter scene; wait for auto-return to map.
      await new Promise(r => setTimeout(r, delayMs));
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Route / planner parsing
  // ---------------------------------------------------------------------------

  function normalizeArgs(arg2) {
    // Legacy signature: runVisuals(app, uuidsArray)
    if (Array.isArray(arg2)) return { uuids: arg2 };

    // Modern: runVisuals(app, { uuids, token, factionId })
    if (arg2 && typeof arg2 === "object") return arg2;

    return {};
  }

  function readPlannerToUuids(app) {
    try {
      // V1: app.element is jQuery; V2: it's an HTMLElement.
      const html = (app?.element instanceof HTMLElement) ? app.element : (app?.element?.[0] || null);
      if (!html) return [];
      const rows = Array.from(html.querySelectorAll(".rp-legs .rp-leg-row"));
      return rows
        .map(r => r.dataset.toUuid || r.dataset.toId || "")
        .filter(Boolean);
    } catch (_e) {
      return [];
    }
  }

  async function resolveCentersFromUuids(uuids) {
    const coords = [];
    for (const uuid of uuids) {
      const doc = await fromUuid(uuid).catch(() => null);
      const obj = doc?.object ?? null;
      const c = hexVisualCenter(obj);
      if (c) coords.push([c.x, c.y, obj]);
    }
    return coords;
  }

  // ---------------------------------------------------------------------------
  // Visuals
  // ---------------------------------------------------------------------------

  async function moveTokenPath(token, points, stepDelay = 900) {
    const dims = tokenDimsPx(token);

    for (const [cx0, cy0] of points) {
      // The input coords ARE the destination hex's geometric center (from
      // resolveCentersFromUuids reading drawing.center). Use them directly;
      // no grid snap, no grid re-center. Both introduced offsets in v13+
      // on mixed-grid scenes. Token top-left = hexCenter − dims/2 places
      // the token's center exactly on the hex center.
      const tl = { x: cx0 - (dims.w / 2), y: cy0 - (dims.h / 2) };

      await token.document.update(
        { x: tl.x, y: tl.y },
        { animate: true, render: false, bbttccTravelVisuals: true }
      );

      await new Promise(r => setTimeout(r, stepDelay));
    }
  }

  // Travel Engine v2 carry-over (2026-05-12) — +N passenger badge that tracks
  // the lead token during stack travel. Spawned by runVisuals when the caller
  // passes passengerCount > 0; ticked off requestAnimationFrame so the badge
  // glides with the token instead of jumping per-leg. Returns a { destroy }
  // handle for cleanup at end of route.
  function spawnPassengerBadge(parent, token, count) {
    const cont = new PIXI.Container();
    cont.eventMode = "none";
    parent.addChild(cont);

    const bg = new PIXI.Graphics();
    bg.beginFill(0x1a3a5a, 0.88);
    bg.lineStyle(2, 0x88c8ff, 1);
    bg.drawCircle(0, 0, 14);
    bg.endFill();
    cont.addChild(bg);

    const style = new PIXI.TextStyle({
      fontFamily: "sans-serif",
      fontSize: 15,
      fontWeight: "700",
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2
    });
    const txt = new PIXI.Text(`+${count}`, style);
    txt.anchor.set(0.5, 0.5);
    cont.addChild(txt);

    let alive = true;
    function tick() {
      if (!alive || cont.destroyed) return;
      const sprite = token._object ?? token.object ?? null;
      if (sprite && sprite.position) {
        const dims = tokenDimsPx(token);
        // Top-right of the token sprite.
        cont.x = sprite.position.x + dims.w * 0.88;
        cont.y = sprite.position.y + dims.h * 0.12;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {
      destroy: () => {
        alive = false;
        try { cont.destroy({ children: true }); } catch (_e) {}
      }
    };
  }

  // Travel Engine v2 — Phase D: portal pulse at a hex center.
  // Animates a gold ring expanding outward + fading over ~600ms. PIXI v7
  // Graphics, parented to the route overlay so cleanup is automatic.
  function spawnPortalPulse(parent, x, y, { color = 0xffd700, ringWidth = 4, maxRadius = 70, durationMs = 600 } = {}) {
    const ring = new PIXI.Graphics();
    ring.eventMode = "none";
    parent.addChild(ring);
    const startTs = performance.now();
    function tick() {
      const t = (performance.now() - startTs) / durationMs;
      if (!ring || ring.destroyed) return;
      if (t >= 1) { try { ring.destroy(); } catch (_e) {} return; }
      const radius = maxRadius * t;
      const alpha = Math.max(0, 1 - t);
      ring.clear();
      ring.lineStyle(ringWidth, color, alpha);
      ring.drawCircle(x, y, radius);
      // Inner soft halo
      ring.lineStyle(ringWidth * 2, color, alpha * 0.25);
      ring.drawCircle(x, y, radius * 0.6);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  async function runVisuals(app, arg2 = undefined) {
    const opts = normalizeArgs(arg2);

    try {
      // 1) Resolve token (retry-safe)
      const token = await resolveTokenWithRetry({
        explicitToken: opts.token || null,
        factionId: opts.factionId || null,
        app
      });

      if (!token) {
        console.warn(TAG, "no suitable token found; skipping visuals");
        return;
      }

      // 2) Determine route
      const uuids = Array.isArray(opts.uuids) && opts.uuids.length
        ? opts.uuids
        : readPlannerToUuids(app);

      if (!uuids.length) {
        console.log(TAG, "no legs in planner; nothing to visualize");
        return;
      }

      // Phase D: optional leg metadata (parallel to `uuids`). legMeta[i].gate
      // truthy → segment ENDING at uuids[i] is a leyline / gate hop and gets
      // gold styling + a portal pulse at both endpoints.
      const legMeta = Array.isArray(opts.legMeta) ? opts.legMeta : [];
      const isGateLeg = (i) => !!legMeta[i]?.gate;

      // Carry-over (2026-05-12) — stack travel +N badge above the lead token.
      // Caller passes passengerCount = joiningFactionIds.length; 0 → no badge.
      const passengerCount = Math.max(0, Number(opts.passengerCount) || 0);

      // 3) Resolve centers
      const coords = await resolveCentersFromUuids(uuids);
      if (!coords.length) {
        console.log(TAG, "no drawable coordinates resolved; aborting visuals");
        return;
      }

      // 4) Draw overlay (non-interactive)
      const parentLayer = canvas.foreground ?? canvas.stage;
      const name = "bbttcc-route-overlay";
      parentLayer.getChildByName?.(name)?.destroy({ children: true });

      const overlay = new PIXI.Container();
      overlay.name = name;
      overlay.interactive = false;
      overlay.interactiveChildren = false;
      overlay.eventMode = "none";
      parentLayer.addChild(overlay);

      // Render each segment individually so gate legs get their own style.
      // legMeta is indexed by destination leg (uuids[i] is leg i's `toUuid`),
      // and the polyline segment ENDING at uuids[i] is therefore segment i.
      // Note: coords[0] is also the destination of leg 0 (token starts off-path),
      // so the first overlay segment is coords[0]→coords[1] = end of leg 0
      // → end of leg 1, governed by legMeta[1].
      for (let i = 0; i < coords.length - 1; i++) {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[i + 1];
        const seg = new PIXI.Graphics();
        seg.eventMode = "none";
        if (isGateLeg(i + 1)) {
          // Gold gate styling — wider line + soft halo for emphasis.
          seg.lineStyle(6, 0xffd700, 0.35);
          seg.moveTo(x1, y1); seg.lineTo(x2, y2);
          seg.lineStyle(3, 0xffe680, 0.95);
          seg.moveTo(x1, y1); seg.lineTo(x2, y2);
        } else {
          seg.lineStyle(3, 0x33aaff, 0.6);
          seg.moveTo(x1, y1); seg.lineTo(x2, y2);
        }
        overlay.addChild(seg);
      }

      // Spawn the +N passenger badge BEFORE motion so it's tracking from the
      // first step. Destroyed in cleanup below alongside the overlay.
      const passengerBadge = (passengerCount > 0)
        ? spawnPassengerBadge(overlay, token, passengerCount)
        : null;

      // 5) Animate
      await new Promise(r => setTimeout(r, 200));
      // Pulse at the very first hex (entry-side of the route) if leg 0 was a gate.
      if (isGateLeg(0)) {
        const [sx, sy] = coords[0];
        spawnPortalPulse(overlay, sx, sy);
      }

      // Drive the token + per-leg portal pulses for gate hops.
      const dims = tokenDimsPx(token);
      for (let i = 0; i < coords.length; i++) {
        const [cx, cy] = coords[i];
        // Pulse on entry to a gate leg (segment i ending here).
        if (isGateLeg(i)) {
          spawnPortalPulse(overlay, cx, cy);
        }
        const tl = { x: cx - (dims.w / 2), y: cy - (dims.h / 2) };
        await token.document.update(
          { x: tl.x, y: tl.y },
          { animate: true, render: false, bbttccTravelVisuals: true }
        );
        await new Promise(r => setTimeout(r, 900));
      }

      // 6) Cleanup overlay (and passenger badge if any)
      passengerBadge?.destroy();
      overlay.destroy({ children: true });

      console.log(TAG, "Moved token", { token: token.name, actorId: token.actor?.id, gateLegs: legMeta.filter(m => m?.gate).length });
    } catch (err) {
      console.error(TAG, err);
      ui.notifications?.error?.(`Travel Visuals error: ${err.message}`);
    }
  }

  Hooks.once("ready", () => {
    game.bbttcc ??= { api: {} };
    game.bbttcc.runVisuals = runVisuals;
    console.log(TAG, "runVisuals registered at game.bbttcc.runVisuals");
  });
})();
