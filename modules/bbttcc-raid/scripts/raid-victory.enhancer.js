// bbttcc-raid/scripts/raid-victory.enhancer.js
//
// RETIRED 2026-10-18 (ruling 18): the Victory (VP + badge) and Unity faction meters are
// no longer part of the game. This enhancer used to
//   1) wrap raid.EFFECTS[*].apply to add victory.unity / unityDelta on consume, and
//   2) wrap raid.applyPostRoundEffects to award Unity by outcome (+2 win / +1 stalemate / -2 loss),
//      with a legacy flags.bbttcc-factions.unity fallback.
// Both writes are removed. The file is kept (and still listed in module.json) so nothing
// that expects it to load breaks; it installs nothing.

(() => {
  const TAG = "[bbttcc-raid/victory-enhancer]";
  Hooks.once("ready", () => {
    console.log(TAG, "retired 2026-10-18 (ruling 18): Unity rewards disabled; nothing installed.");
  });
})();
