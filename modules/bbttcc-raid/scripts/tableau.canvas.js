// modules/bbttcc-raid/scripts/tableau.canvas.js
//
// Bad Eden Tableau — forced-perspective canvas substrate
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
    // Depth axis: "y" = forced-perspective by screen position (the original
    // courtly tableau); "elevation" = fake-3D by the token's Foundry elevation,
    // so descending (lower elevation) reads as further/smaller and rising reads
    // as closer/larger. Underwater/air/space scenes auto-enable the elevation axis.
    axis: "y",
    frontY: 800,
    backY:  200,
    // Elevation-axis bounds (in the scene's elevation units). nearElev maps to
    // maxScale (closest/biggest), farElev to minScale (furthest/smallest).
    // Default model: scene-TOP (surface/ceiling) is biggest, the ground map at
    // elevation 0 sits mid, and descending below reads as deeper/smaller. Render
    // order is pinned to baseElevation so depth NEVER sinks a token under the map.
    nearElev: 40,
    farElev:  -40,
    // Where to read a token's depth from:
    //   "elevation" → token.document.elevation (move via Token HUD; best with
    //                 Foundry Levels OFF).
    //   "flag"      → flags.bbttcc-raid.<depthFlag> (leaves real elevation alone,
    //                 so Levels keeps every token on one floor; move via the tune
    //                 macro's ± nudge). Use this when running Levels.
    depthSource: "elevation",
    depthFlag: "tableauDepth",
    // The fixed render-plane elevation for tableau tokens. Foundry sorts the
    // canvas by elevation, drawing elevation<0 BEHIND the background; pinning the
    // mesh to one plane keeps depth purely cosmetic (scale + sort), never sunk.
    baseElevation: 0,
    minScale: 0.25,
    maxScale: 1.00,
    // Ease-in: closer-to-back shrinks fast, closer-to-front stays near full.
    // 1.0 = linear; >1 = more aggressive falloff into the distance.
    curve:    1.8,
    zSortByY: true
  });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp  = (a, b, t)   => a + (b - a) * t;

  // Foundry's texture-fit base scale for a token mesh: the mesh.scale that
  // renders the art at the token's FOOTPRINT (what Foundry's own refresh
  // computes from texture.fit). Token art spans wildly different source
  // resolutions — a 2000px portrait idles near 0.05, a 100px sprite near 1.0 —
  // so any depth scale must multiply onto this base, never replace it.
  // texture.scaleX sign is preserved so directional-art mirroring survives.
  function fitScale(token) {
    const texW = Number(token?.mesh?.texture?.width)  || 0;
    const texH = Number(token?.mesh?.texture?.height) || 0;
    const w = Number(token?.w) || 0;
    const h = Number(token?.h) || 0;
    if (!(texW > 0 && texH > 0 && w > 0 && h > 0)) return null;
    const fit = String(token.document?.texture?.fit || "contain");
    let bx, by;
    switch (fit) {
      case "fill":   bx = w / texW; by = h / texH; break;
      case "cover":  bx = by = Math.max(w / texW, h / texH); break;
      case "width":  bx = by = w / texW; break;
      case "height": bx = by = h / texH; break;
      default:       bx = by = Math.min(w / texW, h / texH); break; // contain
    }
    return {
      x: bx * Number(token.document?.texture?.scaleX ?? 1),
      y: by * Number(token.document?.texture?.scaleY ?? 1)
    };
  }

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
      // Restore the real render elevation we may have pinned to the base plane.
      token.mesh.elevation = Number(token.document?.elevation ?? 0);
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

      // Depth driver: screen-Y (forced perspective) or elevation (fake 3D).
      // tRaw ∈ [0,1]: 0 = furthest (minScale), 1 = closest (maxScale). sortKey
      // orders draw depth (higher = drawn on top / nearer the camera).
      let tRaw, sortKey;
      if (String(cfg.axis) === "elevation") {
        const depth = (String(cfg.depthSource) === "flag")
          ? Number(foundry.utils.getProperty(token.document, `flags.${MOD}.${cfg.depthFlag || "tableauDepth"}`) ?? 0)
          : Number(token.document?.elevation ?? 0);
        const span = (Number(cfg.nearElev) - Number(cfg.farElev)) || 1;
        tRaw = clamp((depth - Number(cfg.farElev)) / span, 0, 1);
        sortKey = depth;
      } else {
        const y = Number(token.document?.y ?? 0);
        const range = (cfg.frontY - cfg.backY) || 1;
        tRaw = clamp((y - cfg.backY) / range, 0, 1);
        sortKey = y;
      }
      // Curve > 1 makes the back of the stage shrink fast while keeping
      // front-of-stage near full size. Linear = 1.0.
      const curveExp = Math.max(0.1, Number(cfg.curve ?? 1));
      const tCurved = Math.pow(tRaw, curveExp);
      const s = lerp(cfg.minScale, cfg.maxScale, tCurved);

      // `s` is a factor RELATIVE to the token's normal on-canvas size;
      // mesh.scale is ABSOLUTE (texture px → world px). Writing `s` directly
      // discards the fit math and renders art at nativeSize × s — high-res
      // tokens blow up to poster size no matter what footprint the GM sets.
      // Scale the fit base instead, so depth honours token size + token image
      // scale like every other render path. (No texture yet → skip; the
      // drawToken re-apply lands once the mesh has real dimensions.)
      const base = fitScale(token);
      if (!base) return;
      token.mesh.scale.set(base.x * s, base.y * s);

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

      // On the elevation axis, pin the token's RENDER elevation to a constant
      // base plane. Foundry draws elevation<0 behind the scene background, so
      // without this a token "one foot down" vanishes under the map. Depth then
      // controls scale + relative sort only; document.elevation is untouched
      // (vision / Levels still see the real value).
      if (String(cfg.axis) === "elevation") {
        try { token.mesh.elevation = Number(cfg.baseElevation ?? 0); } catch (_e) {}
      }

      if (cfg.zSortByY) {
        token.mesh.sort = Math.round(sortKey);
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
    // The front/back lines are a screen-Y concept — meaningless on the elevation
    // axis (depth is the token's elevation, not its position). Skip them there.
    if (String(cfg.axis) === "elevation") return;
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

  // A texture.src change (directional art swap, polymorph) triggers a FULL
  // token redraw — mesh/border/bars rebuilt at natural size, and the next
  // refresh tick may render a frame later. Re-assert depth the moment the
  // redraw completes so a depth-scaled token never flashes full-size chrome.
  Hooks.on("drawToken", (token) => applyDepth(token));

  // Auto-enrol: ANY token dropped onto a tableau-enabled scene joins the depth
  // layer — drag from the Actors tab, a hex sheet, or a compendium alike. The
  // diorama IS the stage, so new arrivals should depth-scale without a macro
  // step. Respects an explicitly pre-set flag (muster/holdings bake true; set
  // false via tableau.markActor(token, false) to exempt a token). No applyAll
  // needed — refreshToken applies depth as soon as the new token renders.
  Hooks.on("preCreateToken", (doc) => {
    try {
      if (!getTableau(doc.parent)) return;
      const cur = foundry.utils.getProperty(doc, `flags.${MOD}.tableauActor`);
      if (cur !== undefined) return;
      // Structures are the STAGE, not actors on it (owner call 2026-06-04): the depth
      // curve makes a back-of-stage wall comically tiny next to a foreground muster,
      // and no token footprint compensates. Buildings hold their authored size —
      // opt one in via the Token HUD masks button or tableau.markActor(tok, true).
      const isStructure = game.actors?.get?.(doc.actorId)?.getFlag?.("bbttcc-structures", "hasStructure") === true;
      if (isStructure) return;
      doc.updateSource({ [`flags.${MOD}.tableauActor`]: true });
    } catch (e) { console.warn(TAG, "preCreateToken auto-enrol failed", e); }
  });

  // --- Token HUD toggle: per-token tableau participation ---------------------
  // GM-only, shown only on tableau-enabled scenes. One click flips the token
  // between "scales with depth" (🎭 lit) and "pinned at true size". An explicit
  // flag (true OR false) always beats the auto-enrolment defaults, so a pin
  // survives re-staging; the updateToken handler above applies/resets the mesh.
  Hooks.on("renderTokenHUD", (hud, html) => {
    try {
      if (!game.user?.isGM) return;
      const doc = hud?.object?.document;
      const scene = doc?.parent ?? canvas?.scene;
      if (!doc || !getTableau(scene)) return;
      // v13+ AppV2 HUD is a <form>, and HTMLFormElement[0] indexes its own
      // inputs — only unwrap [0] for actual jQuery (v11/12), never elements.
      const root = html instanceof HTMLElement ? html : (html?.[0] ?? html);
      const col = root?.querySelector?.(".col.right");
      if (!col || col.querySelector('[data-action="bbttcc-tableau"]')) return;
      const on = isTableauActor(doc);
      const btn = document.createElement("div");
      btn.className = `control-icon${on ? " active" : ""}`;
      btn.dataset.action = "bbttcc-tableau";
      btn.title = on
        ? "Tableau: scales with depth — click to PIN at true size"
        : "Tableau: pinned at true size — click to scale with depth";
      btn.innerHTML = `<i class="fa-solid fa-masks-theater"></i>`;
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        await doc.update({ [`flags.${MOD}.tableauActor`]: !on });
        try { hud.render(); } catch (_e) {}
      });
      col.appendChild(btn);
    } catch (e) { console.warn(TAG, "token HUD tableau toggle failed", e); }
  });

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

  // Token flag flipped → recompute (or reset if turned off). Elevation change →
  // recompute too, so moving a token up/down on an elevation-axis scene re-scales
  // it live (refreshToken also fires, but watch elevation explicitly for safety).
  Hooks.on("updateToken", (tokenDoc, changes) => {
    const flagTouched  = foundry.utils.getProperty(changes, `flags.${MOD}.tableauActor`);
    const elevTouched  = changes?.elevation !== undefined;
    // The custom depth flag (flag-source mode) — recompute when it moves.
    const depthTouched = foundry.utils.getProperty(changes, `flags.${MOD}`) !== undefined
      && /tableauDepth|depth/i.test(JSON.stringify(changes?.flags?.[MOD] ?? {}));
    if (flagTouched === undefined && !elevTouched && !depthTouched) return;
    const tk = tokenDoc.object;
    if (!tk) return;
    if (flagTouched === false) { resetToken(tk); return; }
    applyDepth(tk);
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
      // Set/nudge a token's tableau depth in "flag" source mode (leaves real
      // elevation alone — Levels-safe). `relative:true` adds to the current value.
      setDepth: async (tokenOrDoc, value, { relative = false, scene = canvas?.scene } = {}) => {
        const doc = tokenOrDoc?.document ?? tokenOrDoc;
        if (!doc?.update) return;
        const flag = String(getTableau(scene)?.depthFlag || "tableauDepth");
        const cur = Number(foundry.utils.getProperty(doc, `flags.${MOD}.${flag}`) ?? 0);
        await doc.update({ [`flags.${MOD}.${flag}`]: relative ? cur + Number(value) : Number(value) });
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
