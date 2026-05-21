// modules/bbttcc-raid/scripts/courtly-tableau.spike.js
//
// BBTTCC Courtly Intrigue — Phase A Spike: Tableau depth-scale + z-sort
// Spec: bbttcc-raid/COURTLY_INTRIGUE_SPEC.md §3
//
// Validates the canvas technique for portrait-token tableau scenes:
//   * Tokens flagged tableauActor get visual scale based on Y position
//     (higher Y / closer to camera = larger; lower Y / further back = smaller)
//   * Z-order follows Y so closer tokens draw on top of farther ones
//   * Scale is VISUAL-ONLY (token.mesh.scale, token.mesh.sort) — not persisted
//     to the document, so re-deriving from Y on every refresh is free and
//     self-correcting if Foundry's own refresh stomps us.
//
// Spike exit criteria: drag a flagged token in a tableau-enabled scene and
// see it scale + reorder live, with no document churn.

(() => {
  const MOD = "bbttcc-raid";
  const TAG = "[bbttcc-raid/tableau]";

  const DEFAULTS = Object.freeze({
    enabled: false,
    frontY: 800,
    backY:  200,
    minScale: 0.40,
    maxScale: 1.00,
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

  // Restore vanilla appearance for tokens that previously had spike scale/sort
  // (e.g. after disable() or after un-flagging a token).
  function resetToken(token) {
    if (!token?.mesh) return;
    try {
      token.mesh.scale.set(1, 1);
      token.mesh.sort = 0;
    } catch (_e) {}
  }

  function applyDepth(token) {
    try {
      if (!token?.mesh) return;
      const scene = token.scene || canvas?.scene;
      const cfg = getTableau(scene);
      if (!cfg) return resetToken(token);
      if (!isTableauActor(token.document)) return;

      const y = Number(token.document?.y ?? 0);
      const range = (cfg.frontY - cfg.backY) || 1;
      const t = clamp((y - cfg.backY) / range, 0, 1);
      const s = lerp(cfg.minScale, cfg.maxScale, t);

      token.mesh.scale.set(s, s);

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
    for (const tk of canvas.tokens.placeables) applyDepth(tk);
  }

  // --- Hooks ---------------------------------------------------------------

  // refreshToken fires after Foundry's internal _refresh, so our mesh writes
  // land last. Movement, vision tweaks, sheet edits all trigger refresh.
  Hooks.on("refreshToken", (token) => applyDepth(token));

  // Initial paint on scene load.
  Hooks.on("canvasReady", () => applyAll());

  // Tableau config changes → recompute everyone.
  Hooks.on("updateScene", (scene, changes) => {
    const touched = foundry.utils.getProperty(changes, `flags.${MOD}.tableau`);
    if (touched !== undefined) applyAll();
  });

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
      applyAll
    };
  }

  Hooks.once("ready", () => {
    installApi();
    console.log(TAG, "Phase A spike ready. API: game.bbttcc.api.raid.tableau");
  });

  console.log(TAG, "Courtly Tableau (Phase A spike) loaded");
})();
