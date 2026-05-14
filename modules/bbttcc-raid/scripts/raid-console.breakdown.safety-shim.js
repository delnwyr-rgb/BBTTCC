// bbttcc-raid/scripts/raid-console.breakdown.safety-shim.js
// Apply safe DC breakdown to the Raid Console by detecting its DOM (.bbttcc-raid-console)
// instead of relying on an exported class or a fixed window id.

(() => {
  const PATCHED = new WeakSet();

  function applyTo(app) {
    try {
      if (!app || PATCHED.has(app)) return;

      const orig =
        app._computeTopDcBreakdown ??
        app.computeTopDcBreakdown ??
        null;

      function safeComputeTopDcBreakdown(ctx) {
        try {
          const out = (orig ? orig.call(app, ctx) : null) || {};
          const n = v => (Number.isFinite(v) ? Number(v) : 0);
          return {
            base:        n(out.base),
            defProjBonus:n(out.defProjBonus),
            diff:        n(out.diff),
            facDef:      n(out.facDef),
            nextB:       n(out.nextB),
            projected:   Number.isFinite(out.projected)
              ? Number(out.projected)
              : n(out.base) + n(out.defProjBonus) + n(out.diff) + n(out.facDef) + n(out.nextB),
            breakdown:   (typeof out.breakdown === "string" && out.breakdown) || ""
          };
        } catch (err) {
          console.warn("[bbttcc-raid:shim] breakdown failed; defaults used.", err);
          return { base:0, defProjBonus:0, diff:0, facDef:0, nextB:0, projected:0, breakdown:"" };
        }
      }

      // Install on the instance
      app._computeTopDcBreakdown = safeComputeTopDcBreakdown;
      if (!app.computeTopDcBreakdown) app.computeTopDcBreakdown = safeComputeTopDcBreakdown;

      PATCHED.add(app);
      console.log("[bbttcc-raid:shim] Applied to raid console instance.");
    } catch (e) {
      console.warn("[bbttcc-raid:shim] Unexpected error applying shim", e);
    }
  }

  // V1 & V2 render hooks; detect by DOM
  const onRender = (app, html) => {
    try {
      const root = html?.[0] || html?.element || app?.element?.[0];
      if (root && root.querySelector?.(".bbttcc-raid-console")) applyTo(app);
    } catch {}
  };

  Hooks.on?.("renderApplication", onRender);
  Hooks.on?.("renderApplicationV2", onRender);

  // If already open when ready fires, try once more by DOM
  Hooks.once?.("ready", () => {
    try {
      for (const id in ui.windows) {
        const w = ui.windows[id];
        const root = w?.element?.[0];
        if (root?.querySelector?.(".bbttcc-raid-console")) applyTo(w);
      }
    } catch {}
  });
})();
