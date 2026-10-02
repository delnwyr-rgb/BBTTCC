// v1.0.8 — Bad Eden TURN consumer extender for hex DRAWINGS — RETIRED (2026-10-01).
//
// This shim used to wrap raid.consumeQueuedTurnEffects with its own hex-drawing sweep.
// That sweep called helpers (dup/get/set) that were never defined, so once the base
// pass-through existed it threw a ReferenceError for EVERY faction on EVERY applied
// Advance Turn (losing the inner chain's result and any wrapper's post-step). Fixing the
// helpers would have been worse: its sweep knows fewer pending keys (no routes, no
// darknessDelta, no resource recompute) than bbttcc-territory turn-driver's
// applyHexPendingSweep — which already runs right after consumeQueuedTurnEffects and is
// the one authority for hex turn.pending. So the shim installs nothing now.
//
// Kept in module.json (no manifest edit → no restart/cache-bust needed); safe to drop
// from esmodules on the next manifest pass.

(() => {
  const TAG = "[bbttcc/consumePlanned]";
  const note = () => console.log(TAG, "retired — hex turn.pending is applied by turn-driver applyHexPendingSweep.");
  if (globalThis.game?.ready) note(); else if (globalThis.Hooks) Hooks.once("ready", note);
})();
