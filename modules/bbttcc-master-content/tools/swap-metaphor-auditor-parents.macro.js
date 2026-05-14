// BBTTCC master-content / tools / swap-metaphor-auditor-parents.macro.js
//
// One-shot fix: Metaphor Apostle was filed under Pactkeeper, and Auditor was
// filed under Cosmic Linguist. This swaps each subclass's `system.classIdentifier`
// (and folder placement, if the pack uses per-class folders) so:
//
//   Metaphor Apostle  →  Cosmic Linguist
//   Auditor           →  Pactkeeper
//
// USAGE:
//   1. Open a Script macro in Foundry as GM.
//   2. Paste this entire file in.
//   3. Run with DRY_RUN = true and read the console report.
//   4. If the swap looks right, set DRY_RUN = false and re-run.
//
// SAFETY:
//   - Idempotent: re-running after the swap will detect the corrected state
//     and skip (it only flips when current classIdentifier matches the WRONG
//     parent).
//   - Only touches the two named subclass items.

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.subclasses";
// Each row: subclass NAME → { wrongParent, correctParent, correctParentName }
const SWAPS = [
  { name: "Metaphor Apostle", wrongParent: "pactkeeper",      correctParent: "cosmic_linguist", correctParentName: "Cosmic Linguist" },
  { name: "Auditor",          wrongParent: "cosmic_linguist", correctParent: "pactkeeper",      correctParentName: "Pactkeeper" }
];

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }

const wasLocked = pack.locked;
if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });

const docs = await pack.getDocuments();
const allFolders = pack.folders?.contents ?? [];
const findFolderByName = (n) => allFolders.find(f => f.name === n);

const report = [];

for (const swap of SWAPS) {
  const doc = docs.find(d => d.type === "subclass" && d.name === swap.name);
  if (!doc) {
    report.push({ name: swap.name, status: "NOT FOUND", details: "no subclass doc with that name" });
    continue;
  }
  const currentClass = doc.system?.classIdentifier ?? "";
  if (currentClass === swap.correctParent) {
    report.push({ name: swap.name, status: "ALREADY CORRECT", currentClass });
    continue;
  }
  if (currentClass !== swap.wrongParent) {
    report.push({ name: swap.name, status: "UNEXPECTED PARENT (skip)", currentClass, expected: swap.wrongParent });
    continue;
  }

  const targetFolder = findFolderByName(swap.correctParentName) ?? null;
  const updates = { _id: doc.id, "system.classIdentifier": swap.correctParent };
  if (targetFolder && doc.folder?.id !== targetFolder.id) updates.folder = targetFolder.id;

  if (!DRY_RUN) {
    await doc.update(updates);
  }
  report.push({
    name: swap.name,
    status: DRY_RUN ? "WOULD SWAP" : "SWAPPED",
    from: swap.wrongParent,
    to: swap.correctParent,
    folderMove: targetFolder ? `→ folder "${swap.correctParentName}"` : "no folder change"
  });
}

if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });

console.group("[swap-metaphor-auditor-parents]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
ui.notifications.info(`Subclass swap report (${DRY_RUN ? "DRY RUN" : "applied"}) — see console.`);
