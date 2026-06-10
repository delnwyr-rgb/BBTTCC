// Bad Eden master-content / tools / cleanup-mis-imported-tier-feats.macro.js
//
// Companion to restamp-requirements-level-mismatch.macro.js. Walks every
// Character actor in the world and removes any owned feat whose corrected
// unlock level (per the fourththing progression module) exceeds the actor's
// current level. Idempotent — owned feats whose gates are already satisfied
// are left alone.
//
// Run this AFTER:
//   (a) updating the fourththing system (parser hardening), and
//   (b) running restamp-requirements-level-mismatch.macro.js with DRY_RUN=false.
//
// USAGE:
//   1. Open this world as GM.
//   2. Paste into a Script macro. DRY_RUN=true prints the plan only.
//   3. Flip DRY_RUN=false and re-run to delete the offending owned items.

const DRY_RUN = true;

const derive = game.fourththing?._progression?.deriveItemUnlockLevel;
if (typeof derive !== "function") {
  ui.notifications.error("Run from a world with the fourththing system loaded.");
  return;
}

const report = { dryRun: DRY_RUN, actorsScanned: 0, actorsWithRemovals: 0, totalRemoved: 0, perActor: [] };

for (const actor of game.actors) {
  if (actor.type !== "character") continue;
  report.actorsScanned++;

  const actorLevel = (actor.system?.system ?? actor.system)?.details?.level ?? 1;
  const toRemove = [];

  for (const item of actor.items) {
    if (item.type !== "feat") continue;
    const { level } = derive(item);
    if (Number.isFinite(level) && level > actorLevel) {
      toRemove.push({ id: item.id, name: item.name, gate: level, actorLevel });
    }
  }

  if (!toRemove.length) continue;
  report.actorsWithRemovals++;
  report.totalRemoved += toRemove.length;
  report.perActor.push({ actor: actor.name, actorLevel, removed: toRemove });

  if (!DRY_RUN) {
    await actor.deleteEmbeddedDocuments("Item", toRemove.map(r => r.id));
  }
}

console.group("[cleanup-mis-imported-tier-feats] report");
console.log("DRY_RUN:", DRY_RUN);
console.table([{ actorsScanned: report.actorsScanned, actorsWithRemovals: report.actorsWithRemovals, totalRemoved: report.totalRemoved }]);
for (const entry of report.perActor) {
  console.group(`${entry.actor} (level ${entry.actorLevel})`);
  console.table(entry.removed);
  console.groupEnd();
}
console.groupEnd();

const verb = DRY_RUN ? "would remove" : "removed";
ui.notifications.info(`Cleanup: ${verb} ${report.totalRemoved} feat(s) from ${report.actorsWithRemovals} actor(s). See console.`);
