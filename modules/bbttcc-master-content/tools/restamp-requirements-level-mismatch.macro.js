// Bad Eden master-content / tools / restamp-requirements-level-mismatch.macro.js
//
// Repair macro for the 2026-05-19 playtest finding: a handful of class-feature
// items (Pactkeeper Initiations, Cosmic Linguist Initiations, Dreamwalker Tier
// 2/3/4) carry the correct level gate in `system.requirements` as prose
// ("Pactkeeper (6th level)") but had `system.prerequisites.level` left at 1.
// applyPathFeatures() trusts the stamped field first, so every Tier feat
// floods onto a brand-new character.
//
// This macro scans the classes + subclasses packs, parses "(Nth level)" out of
// system.requirements, and updates system.prerequisites.level whenever it
// disagrees. Idempotent — re-running after a clean pass is a no-op.
//
// USAGE:
//   1. Open this world as GM.
//   2. Paste into a Script macro and run. DRY_RUN=true prints the plan only.
//   3. Flip DRY_RUN=false and re-run to write.

const DRY_RUN = true;
const PACKS = [
  "bbttcc-master-content.classes",
  "bbttcc-master-content.subclasses"
];

const REQ_LEVEL_RE = /\(\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*level\s*\)/i;

const report = { dryRun: DRY_RUN, scanned: 0, fixed: 0, perPack: {} };

for (const packId of PACKS) {
  const pack = game.packs.get(packId);
  if (!pack) { console.warn(`[restamp-req] Pack not found: ${packId}`); continue; }

  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });

  const docs = await pack.getDocuments();
  const updates = [];
  const samples = [];

  for (const doc of docs) {
    if (doc.type !== "feat") continue;
    report.scanned++;

    const req = String(doc.system?.requirements ?? "");
    const m = req.match(REQ_LEVEL_RE);
    if (!m) continue;

    const required = parseInt(m[1], 10);
    if (!Number.isFinite(required) || required <= 0) continue;

    const stamped = Number(doc.system?.prerequisites?.level);
    if (stamped === required) continue;

    samples.push({ name: doc.name, was: stamped, now: required, requirements: req });
    updates.push({ _id: doc.id, "system.prerequisites.level": required });
  }

  if (!DRY_RUN && updates.length) {
    await pack.documentClass.updateDocuments(updates, { pack: packId });
  }
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });

  report.fixed += updates.length;
  report.perPack[packId] = { fixed: updates.length, samples };
}

console.group("[restamp-requirements-level-mismatch] report");
console.log("DRY_RUN:", DRY_RUN);
console.table([{ scanned: report.scanned, fixed: report.fixed }]);
for (const [pk, s] of Object.entries(report.perPack)) {
  console.group(pk);
  console.table(s.samples);
  console.groupEnd();
}
console.groupEnd();

const verb = DRY_RUN ? "would fix" : "fixed";
ui.notifications.info(`Requirements-level restamp: ${verb} ${report.fixed} item(s). See console.`);
