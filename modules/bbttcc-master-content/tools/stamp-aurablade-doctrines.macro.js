// Bad Eden master-content / tools / stamp-aurablade-doctrines.macro.js
//
// One-shot fix for the Aurablade doctrine drift. Stamps `system.prerequisites.level`
// on each of the 15 Blood Hymn / Stillheart / Void Edge doctrine feats per the
// canonical mapping derived from each feat's description body ("Level N — …").
//
// CANONICAL MAPPING (Aurablade doctrines use a non-standard L3/L6/L10/L14/L18
// ladder — class-side gives L1 mechanics; doctrines kick in at L3):
//
//   Blood Hymn:  Escalation=3, Lifetithe=6, Crimson Arc=10, Terror Charge=14, Final Crescendo=18
//   Stillheart:  Centered Breath=3, Shared Aura=6, Quiet Mind=10, Emotional Lock=14, Eye of the Storm=18
//   Void Edge:   Null Field=3, Silence of Will=6, Dread Cut=10, Emotional Erasure=14, Final Quiet=18
//
// USAGE:
//   1. DRY_RUN=true → run, read the dialog
//   2. Flip DRY_RUN=false → re-run

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";

const MAPPING = {
  "Blood Hymn: Escalation":       3,
  "Blood Hymn: Lifetithe":        6,
  "Blood Hymn: Crimson Arc":      10,
  "Blood Hymn: Terror Charge":    14,
  "Blood Hymn: Final Crescendo":  18,
  "Stillheart: Centered Breath":  3,
  "Stillheart: Shared Aura":      6,
  "Stillheart: Quiet Mind":       10,
  "Stillheart: Emotional Lock":   14,
  "Stillheart: Eye of the Storm": 18,
  "Void Edge: Null Field":        3,
  "Void Edge: Silence of Will":   6,
  "Void Edge: Dread Cut":         10,
  "Void Edge: Emotional Erasure": 14,
  "Void Edge: Final Quiet":       18
};

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }

const wasLocked = pack.locked;
if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });

const allDocs = await pack.getDocuments();
const updates = [];
const report = [];

for (const [name, level] of Object.entries(MAPPING)) {
  const doc = allDocs.find(d => d.type === "feat" && d.name === name);
  if (!doc) {
    report.push({ name, status: "NOT FOUND" });
    continue;
  }
  const cur = Number(doc.system?.prerequisites?.level);
  if (Number.isFinite(cur) && cur === level) {
    report.push({ name, currentLevel: cur, newLevel: level, status: "already correct" });
    continue;
  }
  updates.push({ _id: doc.id, "system.prerequisites.level": level });
  report.push({ name, currentLevel: Number.isFinite(cur) && cur > 0 ? cur : "(unset)", newLevel: level, status: DRY_RUN ? "WOULD STAMP" : "STAMPED" });
}

if (!DRY_RUN && updates.length) {
  await pack.documentClass.updateDocuments(updates, { pack: PACK_ID });
}
if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });

console.group("[stamp-aurablade-doctrines]");
console.log("DRY_RUN:", DRY_RUN);
console.table(report);
console.groupEnd();
ui.notifications.info(`Aurablade doctrines: ${DRY_RUN ? "would stamp" : "stamped"} ${updates.length} feat(s) — see console.`);
