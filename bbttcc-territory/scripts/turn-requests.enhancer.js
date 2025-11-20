/* modules/bbttcc-territory/scripts/turn-requests.enhancer.js
 * BBTTCC — Auto Process Requests on Advance Turn (Apply)
 * Adds a re-entrancy guard to prevent infinite recursion.
 */
(() => {
  const TAG = "[bbttcc-turn/auto-requests]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);
  let _isRunning = false;  // 🔒 guard flag

  function install(){
    const terr = game.bbttcc?.api?.territory;
    const turn = game.bbttcc?.api?.turn;
    if (!terr || typeof terr.advanceTurn !== "function") {
      return warn("territory.advanceTurn not found; enhancer idle.");
    }
    const orig = terr.advanceTurn.bind(terr);

    terr.advanceTurn = async function advanceTurn_withRequests(args = {}){
      // prevent recursion
      if (_isRunning) return orig(args);
      const res = await orig(args);
      try {
        if (args?.apply && turn?.processRequests && !_isRunning) {
          _isRunning = true;
          const factionId = args.factionId || args.actorId || args.attackerId || null;
          if (factionId) {
            const out = await turn.processRequests({ factionId, apply: true });
            log("Processed queued requests after Advance Turn:", out);
          } else {
            warn("No factionId provided to advanceTurn; skipping processRequests.");
          }
        }
      } catch (e) {
        warn("processRequests failed after Advance Turn:", e);
      } finally {
        _isRunning = false;
      }
      return res;
    };

    log("Installed wrapper on territory.advanceTurn (auto processRequests on Apply) with recursion guard.");
  }

  if (globalThis?.Hooks?.once) Hooks.once("ready", install);
  try { if (globalThis?.game?.ready === true) install(); } catch {}
})();
