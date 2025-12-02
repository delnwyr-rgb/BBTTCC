// bbttcc-encounters/scripts/trigger.manager.js

(() => {
  const TAG = "[bbttcc-encounters/triggers]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  function getAPI() {
    return game.bbttcc?.api?.encounters || null;
  }

  // Travel encounter trigger
  Hooks.on("bbttcc:afterTravel", async (ctx = {}) => {
    try {
      // Do not auto-launch for previews
      if (ctx.preview) return;

      const enc = ctx.encounter || {};
      const encKey = enc.result?.key || enc.key;

      if (!enc.triggered || !encKey) return;

      const api = getAPI();
      if (!api || typeof api.launchFromEncounterCtx !== "function") {
        warn("afterTravel: Encounter API not ready");
        return;
      }

      log("afterTravel: auto-launching encounter for key", encKey, ctx);
      await api.launchFromEncounterCtx(ctx);
    } catch (err) {
      warn("Error in afterTravel trigger", err);
    }
  });

  Hooks.once("ready", () => {
    log("Trigger manager ready (listening for bbttcc:afterTravel)");
  });
})();
