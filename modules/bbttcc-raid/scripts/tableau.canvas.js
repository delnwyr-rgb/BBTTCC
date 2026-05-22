// modules/bbttcc-raid/scripts/tableau.canvas.js
//
// BBTTCC Tableau — forced-perspective canvas substrate
// Spec: bbttcc-raid/TABLEAU_SUBSTRATE.md (system-level) · COURTLY_INTRIGUE_SPEC.md §3 (first consumer)
//
// System-level capability — NOT courtly-specific. Any scene can opt in by
// setting flags.bbttcc-raid.tableau.enabled = true; any token can participate
// by setting flags.bbttcc-raid.tableauActor = true. Validated consumers
// include courtly tableaux, forced-perspective combat, cinematic entrances,
// duels, ambush staging, and non-raid dialog/vendor scenes.
//
// How it works:
//   * Tokens flagged tableauActor get visual scale based on Y position
//     (higher Y / closer to camera = larger; lower Y / further back = smaller)
//   * Z-order follows Y so closer tokens draw on top of farther ones
//   * Scale is VISUAL-ONLY (token.mesh.scale, token.mesh.sort) — not persisted
//     to the document, so re-deriving from Y on every refresh is free and
//     self-correcting if Foundry's own refresh stomps us
//   * Mechanical distance (strike range, line-of-sight) is unaffected — it
//     uses document coords, not visual scale. Visual ≠ mechanical is the
//     correct tabletop call.
//
// GM tuning UI: bbttcc-master-content/tools/tableau-tune.macro.js

(() => {
  const MOD = "bbttcc-raid";
  const TAG = "[bbttcc-raid/tableau]";

  const DEFAULTS = Object.freeze({
    enabled: false,
    frontY: 800,
    backY:  200,
    minScale: 0.25,
    maxScale: 1.00,
    // Ease-in: closer-to-back shrinks fast, closer-to-front stays near full.
    // 1.0 = linear; >1 = more aggressive falloff into the distance.
    curve:    1.8,
    zSortByY: true
  });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp  = (a, b, t)   => a + (b - a) * t;

  function getTableau(scene) {
    if (!scene) return null;
    const raw = scene.flags?.[MOD]?.tableau;
    if (!raw || raw.enabled !== true) return null;
    return { ...DEFAULTS, ...raw };
  }

  function isTableauActor(tokenDoc) {
    return tokenDoc?.flags?.[MOD]?.tableauActor === true;
  }

  // Restore vanilla appearance for tokens that previously had spike scale/sort.
  // Don't hardcode mesh.scale to (1,1) — that's only correct if the source
  // texture is exactly the footprint size. For typical tokens with multi-
  // thousand-pixel art, the correct visual scale is `footprint / textureSize`
  // (computed by Foundry from texture.fit). Ask Foundry to recompute via
  // render flags instead of guessing.
  function resetToken(token) {
    if (!token?.mesh) return;
    try {
      token.mesh.sort = 0;
      token.renderFlags?.set?.({ refreshMesh: true, refreshShader: true });
    } catch (_e) {}
  }

  function applyDepth(token) {
    try {
      if (!token?.mesh) return;
      const scene = token.scene || canvas?.scene;
      const cfg = getTableau(scene);
      // If tableau is off or this token isn't a participant, do nothing.
      // Don't reset here — Foundry's own refresh already ran and set
      // mesh.scale correctly from texture.fit. Touching it now (even to
      // (1,1)) clobbers fit math and makes textures render at native size.
      // Explicit reset happens at transition points (disable/flag-off/scene-off).
      if (!cfg) return;
      if (!isTableauActor(token.document)) return;

      const y = Number(token.document?.y ?? 0);
      const range = (cfg.frontY - cfg.backY) || 1;
      const tRaw = clamp((y - cfg.backY) / range, 0, 1);
      // Curve > 1 makes the back of the stage shrink fast while keeping
      // front-of-stage near full size. Linear = 1.0.
      const curveExp = Math.max(0.1, Number(cfg.curve ?? 1));
      const tCurved = Math.pow(tRaw, curveExp);
      const s = lerp(cfg.minScale, cfg.maxScale, tCurved);

      token.mesh.scale.set(s, s);

      // Scale border + bars to match the visual, anchored to the mesh's
      // visual center (which sits at the token's footprint center because
      // mesh anchor is 0.5/0.5). Offset = footprint_size × (1-s)/2 so the
      // shrunk graphic still hugs the visible token.
      const w = Number(token.w || 0);
      const h = Number(token.h || 0);
      const ox = w * (1 - s) / 2;
      const oy = h * (1 - s) / 2;
      if (token.border) {
        token.border.scale.set(s, s);
        token.border.position.set(ox, oy);
      }
      if (token.bars) {
        token.bars.scale.set(s, s);
        token.bars.position.set(ox, oy);
      }
      if (token.nameplate) {
        // Nameplate hangs just below the visible token. Default Foundry y = h
        // (below the footprint); after scale we want it below the *visual*
        // edge: oy + h*s + small pad.
        token.nameplate.scale.set(s, s);
        token.nameplate.position.set(w / 2, oy + h * s + 4);
      }

      if (cfg.zSortByY) {
        token.mesh.sort = Math.round(y);
        // Ensure parent will honour zIndex/sort.
        const parent = token.mesh.parent;
        if (parent && parent.sortableChildren !== true) {
          parent.sortableChildren = true;
        }
      }
    } catch (e) {
      console.warn(TAG, "applyDepth error", e);
    }
  }

  function applyAll() {
    if (!canvas?.tokens?.placeables) return;
    const cfg = getTableau(canvas?.scene);
    for (const tk of canvas.tokens.placeables) {
      // On a tableau-disabled scene, only previously-tagged tokens need an
      // explicit reset (ask Foundry to redo its fit math). Everything else
      // is already correct from Foundry's own refresh.
      if (!cfg) {
        if (isTableauActor(tk.document)) resetToken(tk);
        continue;
      }
      applyDepth(tk);
    }
  }

  // --- Canvas guide lines (visual feedback for frontY/backY) -------------

  let _guides = null;

  function drawGuides(scene) {
    clearGuides();
    if (!scene || !canvas?.scene || canvas.scene.id !== scene.id) return;
    const cfg = scene.flags?.[MOD]?.tableau;
    if (!cfg) return;
    const front = Number(cfg.frontY ?? 0);
    const back  = Number(cfg.backY  ?? 0);
    const w     = canvas.dimensions?.width || 1920;

    const root = new PIXI.Container();
    root.zIndex = 99999;
    root.eventMode = "none";

    const g = new PIXI.Graphics();
    g.lineStyle(4, 0xff5555, 0.85); // back (red)
    g.moveTo(0, back);  g.lineTo(w, back);
    g.lineStyle(4, 0x55ff55, 0.85); // front (green)
    g.moveTo(0, front); g.lineTo(w, front);
    root.addChild(g);

    try {
      const labelBase = { fontFamily: "Arial", fontSize: 22, stroke: 0x000000, strokeThickness: 4 };
      const tFront = new PIXI.Text(`▲ FRONT — max scale  (Y=${front})`, { ...labelBase, fill: 0x55ff55 });
      tFront.position.set(20, front - 32);
      const tBack  = new PIXI.Text(`▼ BACK — min scale  (Y=${back})`,  { ...labelBase, fill: 0xff5555 });
      tBack.position.set(20, back + 8);
      root.addChild(tFront, tBack);
    } catch (_e) {}

    const parent = canvas.interface || canvas.controls || canvas.stage;
    if (parent) {
      parent.addChild(root);
      parent.sortableChildren = true;
      _guides = root;
    }
  }

  function clearGuides() {
    if (_guides) {
      try { if (_guides.parent) _guides.parent.removeChild(_guides); } catch (_e) {}
      try { _guides.destroy({ children: true }); } catch (_e) {}
    }
    _guides = null;
  }

  // --- Hooks ---------------------------------------------------------------

  // refreshToken fires after Foundry's internal _refresh, so our mesh writes
  // land last. Movement, vision tweaks, sheet edits all trigger refresh.
  Hooks.on("refreshToken", (token) => applyDepth(token));

  // Initial paint on scene load.
  Hooks.on("canvasReady", () => applyAll());

  // Tableau config changes → recompute everyone (and refresh guides if shown).
  Hooks.on("updateScene", (scene, changes) => {
    const touched = foundry.utils.getProperty(changes, `flags.${MOD}.tableau`);
    if (touched !== undefined) {
      applyAll();
      if (_guides) drawGuides(scene);
    }
  });

  // Clear guides on scene swap so we don't orphan PIXI graphics.
  Hooks.on("canvasTearDown", () => clearGuides());

  // Token flag flipped → recompute that token (and reset if turned off).
  Hooks.on("updateToken", (tokenDoc, changes) => {
    const flagTouched = foundry.utils.getProperty(changes, `flags.${MOD}.tableauActor`);
    if (flagTouched === undefined) return;
    const tk = tokenDoc.object;
    if (!tk) return;
    if (flagTouched === true) applyDepth(tk);
    else resetToken(tk);
  });

  // --- GM API surface ------------------------------------------------------

  function installApi() {
    if (!game.bbttcc) game.bbttcc = {};
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};
    game.bbttcc.api.raid.tableau = {
      DEFAULTS,
      readConfig: (scene = canvas?.scene) => getTableau(scene) || { ...DEFAULTS, enabled: false },
      enable: async (partial = {}, scene = canvas?.scene) => {
        if (!scene) return ui.notifications?.warn("No active scene.");
        const cur = scene.flags?.[MOD]?.tableau || {};
        const next = { ...DEFAULTS, ...cur, ...partial, enabled: true };
        await scene.update({ [`flags.${MOD}.tableau`]: next });
        applyAll();
        return next;
      },
      disable: async (scene = canvas?.scene) => {
        if (!scene) return;
        await scene.update({ [`flags.${MOD}.tableau.enabled`]: false });
        for (const tk of canvas.tokens.placeables) resetToken(tk);
      },
      setFrontBack: async (frontY, backY, scene = canvas?.scene) => {
        if (!scene) return;
        await scene.update({
          [`flags.${MOD}.tableau.frontY`]: Number(frontY),
          [`flags.${MOD}.tableau.backY`]:  Number(backY)
        });
        applyAll();
      },
      markActor: async (tokenOrDoc, on = true) => {
        const doc = tokenOrDoc?.document ?? tokenOrDoc;
        if (!doc?.update) return;
        await doc.update({ [`flags.${MOD}.tableauActor`]: !!on });
      },
      applyAll,
      showGuides: (scene = canvas?.scene) => drawGuides(scene),
      hideGuides: () => clearGuides()
    };
  }

  Hooks.once("ready", () => {
    installApi();
    console.log(TAG, "Phase A spike ready. API: game.bbttcc.api.raid.tableau");
  });

  console.log(TAG, "Courtly Tableau (Phase A spike) loaded");
})();
