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

  function gridCenter(x, y) {
    try {
      const c = canvas?.grid?.getCenter?.(x, y);
      if (Array.isArray(c) && c.length >= 2) return { x: c[0], y: c[1] };
    } catch (e) {}
    return { x, y };
  }

  function snapTopLeft(x, y) {
    try {
      const s = canvas?.grid?.getSnappedPosition?.(x, y, 1);
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y)) return { x: s.x, y: s.y };
    } catch (e) {}
    return { x, y };
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
      const html = app?.element?.[0];
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

      if (factionId) {
        const ctl = controlled.find(t => String(t?.actor?.id || "") === String(factionId));
        if (ctl) return ctl;

        const any = all.find(t => String(t?.actor?.id || "") === String(factionId));
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
      const html = app?.element?.[0];
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
      if (obj?.center) {
        const c = gridCenter(obj.center.x, obj.center.y);
        coords.push([c.x, c.y, obj]);
      }
    }
    return coords;
  }

  // ---------------------------------------------------------------------------
  // Visuals
  // ---------------------------------------------------------------------------

  async function moveTokenPath(token, points, stepDelay = 900) {
    const dims = tokenDimsPx(token);

    for (const [cx0, cy0] of points) {
      const c = gridCenter(cx0, cy0);
      const tl = { x: c.x - (dims.w / 2), y: c.y - (dims.h / 2) };
      const snapped = snapTopLeft(tl.x, tl.y);

      await token.document.update(
        { x: snapped.x, y: snapped.y },
        { animate: true, render: false, bbttccTravelVisuals: true }
      );

      await new Promise(r => setTimeout(r, stepDelay));
    }
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

      const g = new PIXI.Graphics();
      g.eventMode = "none";
      g.lineStyle(3, 0x33aaff, 0.6);

      for (let i = 0; i < coords.length - 1; i++) {
        const [x1, y1] = coords[i];
        const [x2, y2] = coords[i + 1];
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
      }
      overlay.addChild(g);

      // 5) Animate
      await new Promise(r => setTimeout(r, 200));
      await moveTokenPath(token, coords.map(([x, y]) => [x, y]), 900);

      // 6) Cleanup overlay
      overlay.destroy({ children: true });

      console.log(TAG, "Moved token", { token: token.name, actorId: token.actor?.id });
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
