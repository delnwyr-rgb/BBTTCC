/* modules/bbttcc-territory/scripts/turn-requests.enhancer.js
 * BBTTCC — Auto Process Requests on Advance Turn (Apply)
 * Adds a re-entrancy guard to prevent infinite recursion.
 *
 * Behavior:
 *   - If args.factionId / actorId / attackerId is provided, process requests
 *     just for that faction.
 *   - Otherwise, process ALL pending requests (global pass).
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
    if (!turn || typeof turn.processRequests !== "function") {
      return warn("turn.processRequests not found; enhancer idle.");
    }

    const orig = terr.advanceTurn.bind(terr);

    terr.advanceTurn = async function advanceTurn_withRequests(args = {}){
      // Prevent recursion if something inside processRequests triggers advanceTurn again
      if (_isRunning) return orig(args);

      const res = await orig(args);

      try {
        if (args?.apply && !_isRunning) {
          _isRunning = true;

          const factionId = args.factionId || args.actorId || args.attackerId || null;

          if (factionId) {
            // Per-faction mode: process only this faction’s requests
            const out = await turn.processRequests({ factionId, apply: true });
            log("Processed queued requests after Advance Turn (per faction):", out);
          } else {
            // Global mode: no factionId was provided (e.g. Turn Driver from toolbar).
            // Let processRequests decide how to scan and consume all pending requests.
            log("No factionId provided to advanceTurn; processing ALL pending requests.");
            const out = await turn.processRequests({ apply: true });
            log("Processed queued requests after Advance Turn (global):", out);
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
