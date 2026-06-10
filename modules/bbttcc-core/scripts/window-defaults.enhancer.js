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
