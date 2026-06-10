// Bad Eden master-content / tools / prune-pactkeeper-cruft.macro.js
//
// Deletes the 4 dead Pactkeeper feat items left over from initial creation —
// their handlers were retired in the 2026-05-22 Phase-1.5 pass and the orphan
// resource pools (pactLeverage / civicCharge / administrativePressure) were purged
// in the 2026-05-28 Surge redesign. These items do nothing; they just clutter the
// compendium browser and old sheets. Removes from BOTH the pack AND embedded copies
// on world actors. Does NOT touch the live "Pactkeeper" class doc or the canon 4.
//
// USAGE: paste into a script macro. DRY_RUN=true → review console (F12); false → delete.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";
const DEAD_NAMES = new Set([
  "Pactkeeper: Administrative Pressure",
  "Pactkeeper: Civic Charge",
  "Pactkeeper: Invoke Precedent",
  "Pactkeeper: Spend Civic Charge",
]);

const report = [];

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); }
else {
  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });
  const docs = await pack.getDocuments();
  const ids = docs.filter(d => DEAD_NAMES.has(d.name)).map(d => d.id);
  for (const d of docs) if (DEAD_NAMES.has(d.name)) report.push({ where: "PACK", name: d.name, id: d.id, status: DRY_RUN ? "would delete" : "deleted" });
  if (!DRY_RUN && ids.length) await pack.documentClass.deleteDocuments(ids, { pack: PACK_ID });
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });
}

for (const actor of game.actors) {
  const ids = actor.items.filter(it => DEAD_NAMES.has(it.name)).map(it => it.id);
  if (!ids.length) continue;
  for (const it of actor.items) if (DEAD_NAMES.has(it.name)) report.push({ where: `actor:${actor.name}`, name: it.name, id: it.id, status: DRY_RUN ? "would delete" : "deleted" });
  if (!DRY_RUN) await actor.deleteEmbeddedDocuments("Item", ids);
}

console.group("[prune-pactkeeper-cruft]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
ui.notifications.info(`Pactkeeper cruft: ${DRY_RUN ? "would delete" : "deleted"} ${report.length} item(s). See console (F12).`);
