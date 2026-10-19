// bbttcc-raid/scripts/raid-morale.enhancer.js
//
// RETIRED 2026-10-18 (ruling 19): the faction Morale meter is no longer part of the game.
// This enhancer used to wrap raid.applyPostRoundEffects to adjust flags['bbttcc-factions'].morale
// by raid outcome (attacker {win:+5, stalemate:+2, loss:-5}, defender mirrored, per-faction
// overrides via flags['bbttcc-factions'].moraleRules) and append a "Morale ±N — Raid <outcome>"
// warLog line. All writes are removed. The file is kept (and still listed in module.json) so
// nothing that expects it to load breaks; it installs nothing. Stress / Extension / the
// pressure ladders carry the consequence of a raid outcome now.

(() => {
  const TAG = "[bbttcc-raid/raid-morale]";
  Hooks.once("ready", () => {
    console.log(TAG, "retired 2026-10-18 (ruling 19): faction Morale rewards disabled; nothing installed.");
  });
})();
