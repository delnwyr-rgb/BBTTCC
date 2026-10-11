/* bbttcc-core/scripts/window-defaults.enhancer.js
 *
 * Global window-default sweep: makes every window in the Bad Eden stack
 * resizable + scrollable by default.
 *
 * Two pieces:
 *
 *   1. Dialog constructor patch — Foundry's V1 Dialog only paints a resize
 *      handle when `options.resizable` is true at construction time, so we
 *      wrap the Dialog constructor to merge that flag in if the caller
 *      didn't already set it. ~50 `new Dialog(...)` sites across our
 *      modules pick this up automatically.
 *
 *   2. Render-time CSS patch — on every `render*` hook, we walk the
 *      rendered window's `.window-content` (V1) / `.window-content` (V2)
 *      and ensure it has `overflow: auto` and a sensible max-height, so
 *      content scrolls inside the frame instead of overflowing it. This
 *      covers V1 Application, V2 ApplicationV2, FormApplication,
 *      ActorSheet, and Dialog regardless of how each was constructed.
 *
 * Both steps are no-ops if the caller already opted into stricter
 * behavior (e.g. an app that explicitly sets `resizable: false`).
 */

(() => {
  const TAG = "[bbttcc-core/window-defaults]";

  // -------------------- 1) Dialog constructor wrap --------------------
  function patchDialogConstructor() {
    try {
      const D = globalThis.Dialog;
      if (!D || D.__bbttccDefaultsWrapped) return;
      const Original = D;

      function PatchedDialog(data, options) {
        // Caller may pass options as 2nd arg (V1 idiom); merge resizable
        // default in unless explicitly set.
        const opts = (options && typeof options === "object") ? Object.assign({}, options) : {};
        if (!Object.prototype.hasOwnProperty.call(opts, "resizable")) opts.resizable = true;
        return Reflect.construct(Original, [data, opts], new.target || PatchedDialog);
      }

      // Preserve prototype chain + statics so `instanceof Dialog` still works
      // and Dialog.confirm / Dialog.prompt still resolve.
      PatchedDialog.prototype = Original.prototype;
      Object.setPrototypeOf(PatchedDialog, Original);
      PatchedDialog.__bbttccDefaultsWrapped = true;

      // Replace global. Foundry's modules will continue to see the patched
      // constructor on subsequent `new Dialog(...)` calls.
      globalThis.Dialog = PatchedDialog;
      console.log(TAG, "Dialog constructor patched (resizable default = true).");
    } catch (e) {
      console.warn(TAG, "Dialog patch failed:", e);
    }
  }

  // -------------------- 2) Render-time CSS injection ------------------
  // Foundry V1 windows have a .window-content child element; V2 windows
  // have a .window-content as well. Both should scroll their inner body
  // when content overflows. We set a sensible max-height (94vh) so the
  // window can't push past the viewport on small screens.
  function applyScrollDefaults(rootEl) {
    try {
      if (!rootEl || !(rootEl instanceof HTMLElement)) return;
      // Skip if a caller has explicitly opted out via dataset.
      if (rootEl.dataset.bbttccNoScrollDefault === "1") return;

      const wc = rootEl.classList.contains("window-content")
        ? rootEl
        : rootEl.querySelector(":scope > .window-content");
      if (!wc) return;

      // Preserve any explicit overflow set by the app's own CSS.
      const cs = getComputedStyle(wc);
      const ovY = cs.overflowY;
      if (ovY === "" || ovY === "visible") wc.style.overflowY = "auto";

      // Avoid pushing past the viewport on tall content; 94vh leaves
      // room for the title bar.
      if (!wc.style.maxHeight) wc.style.maxHeight = "94vh";

      // Ensure the inner content can use full width.
      if (!wc.style.width) wc.style.width = "100%";
    } catch (_e) { /* non-fatal; visual-only */ }
  }

  function hookRender(hookName) {
    Hooks.on(hookName, (app, html /* jQuery|HTMLElement */) => {
      try {
        // V1 hooks pass jQuery; V2 hooks pass HTMLElement (or app.element).
        const el = (html && html[0]) ? html[0] : (html instanceof HTMLElement ? html : (app?.element?.[0] ?? app?.element));
        applyScrollDefaults(el);
      } catch (_e) { /* non-fatal */ }
    });
  }

  // -------------------- bootstrap ------------------------------------
  Hooks.once("setup", () => {
    patchDialogConstructor();
  });

  Hooks.once("ready", () => {
    // Fire on every render, regardless of app variety.
    hookRender("renderApplication");        // V1 base
    hookRender("renderDialog");             // V1 Dialog
    hookRender("renderFormApplication");    // V1 forms
    hookRender("renderActorSheet");         // V1 actor sheets
    hookRender("renderApplicationV2");      // V2 base (covers HandlebarsApplicationMixin)
    hookRender("renderActorSheetV2");       // V2 actor sheets

    console.log(TAG, "render-time scroll defaults installed across V1 + V2 hooks.");
  });
})();

/* ---------------------------------------------------------------------
 * 3) Hidden-tab video load guard (2026-10-11)
 *
 * A video texture (e.g. a .webm scene background) whose load STARTS while
 * the browser tab is hidden (background tab, covered window) never resolves
 * in Chrome — not even after the tab comes back — so the scene sits at
 * "98% Loading" forever. Measured on Ember: 52/53 files loaded, the .webm
 * still pending after 5+ min; a fresh load of the same file then took
 * 0.77 s, and a refresh with the tab in front drew the scene in 8 s.
 *
 * Fix, video sources only:
 *   a) don't start the load until the tab is visible;
 *   b) if the tab is hidden mid-load and the load is still pending once the
 *      tab is visible again, retry under a cache-busted URL (a fresh PIXI
 *      asset) and cache it under the original src.
 * Image loads are untouched.
 * ------------------------------------------------------------------- */
(() => {
  const TAG = "[bbttcc-core/hidden-tab-video]";
  const GRACE_MS = 1500;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const whenVisible = () => !document.hidden ? Promise.resolve() : new Promise(res => {
    const on = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", on); res(); } };
    document.addEventListener("visibilitychange", on);
  });

  function install() {
    const TL = foundry?.canvas?.TextureLoader;
    const VH = foundry?.helpers?.media?.VideoHelper;
    if (!TL?.prototype?.loadTexture || typeof VH?.hasVideoExtension !== "function") {
      console.warn(TAG, "TextureLoader / VideoHelper not found — guard not installed.");
      return;
    }
    const orig = TL.prototype.loadTexture;
    if (orig.__bbttccHiddenTabGuard) return;

    const guarded = async function (src) {
      if (typeof src !== "string" || !VH.hasVideoExtension(src)) return orig.call(this, src);

      if (document.hidden) console.log(TAG, `tab hidden — holding video load until visible: ${src}`);
      await whenVisible();

      let wasHidden = false;
      const onVis = () => { if (document.hidden) wasHidden = true; };
      document.addEventListener("visibilitychange", onVis);
      try {
        let done = false;
        const first = orig.call(this, src);
        const settled = first.then(v => ({ v }), e => ({ e })).finally(() => { done = true; });
        while (!done) {
          const r = await Promise.race([settled, sleep(GRACE_MS).then(() => null)]);
          if (r) { if ("e" in r) throw r.e; return r.v; }
          if (wasHidden && !document.hidden) break;   // hidden mid-load, back now, still pending
        }
        if (done) return first;

        console.warn(TAG, `video load stalled after the tab was hidden — retrying: ${src}`);
        const asset = await PIXI.Assets.load(foundry.utils.getCacheBustURL(src));
        const base = asset?.baseTexture ?? null;
        if (!base?.valid) return first;                // retry failed — fall back to the original wait
        this.setCache(src, base);
        return base;
      } finally {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
    guarded.__bbttccHiddenTabGuard = true;
    TL.prototype.loadTexture = guarded;
    console.log(TAG, "installed (video textures wait for a visible tab; stalled loads retry).");
  }

  // init runs before setup → canvas draw, so the first scene load is covered.
  Hooks.once("init", install);
})();
