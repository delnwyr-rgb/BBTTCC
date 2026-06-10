// Bad Eden master-content / tools / stamp-prerequisite-levels.macro.js
//
// Idempotent migration: walks every feat in the bbttcc-master-content packs
// and stamps `system.prerequisites.level` to its canonical unlock level so the
// "+ Apply Path Features" filter and any future auto-grant hook can read one
// structured field instead of regex-scanning name/identifier/requirements/desc.
//
// USAGE:
//   1. Open this Foundry world as a GM.
//   2. Create a new Script macro and paste this entire file in.
//   3. Run it. By default it does a DRY RUN — change DRY_RUN below to false
//      and re-run to actually write.
//   4. After a successful write, open the Bad Eden Character Wizard's
//      "+ Apply Path Features" button on a Tier-1 actor — only the L1
//      features for their path/doctrine should import.
//
// SAFETY:
//   - Skips any feat that already has a non-zero system.prerequisites.level
//     (so re-running is harmless).
//   - Skips items that produce no level signal (passive identity items —
//     e.g. "Pactkeeper: Core Features" — which should always be granted).
//   - Logs a per-pack report to the console so you can verify before flipping
//     DRY_RUN off.

const DRY_RUN = true;
const PACKS = [
  "bbttcc-master-content.classes",
  "bbttcc-master-content.subclasses"
];

const derive = game.fourththing?._progression?.deriveItemUnlockLevel;
if (typeof derive !== "function") {
  ui.notifications.error("Run from a world with the fourththing system loaded.");
  return;
}

const report = { dryRun: DRY_RUN, scanned: 0, stamped: 0, alreadyStamped: 0, untiered: 0, perPack: {} };

for (const packId of PACKS) {
  const pack = game.packs.get(packId);
  if (!pack) { console.warn(`[stamp-prereq] Pack not found: ${packId}`); continue; }

  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });

  const stats = { scanned: 0, stamped: 0, alreadyStamped: 0, untiered: 0, samples: [] };
  const docs = await pack.getDocuments();
  const updates = [];

  for (const doc of docs) {
    if (doc.type !== "feat") continue;
    stats.scanned++;
    const existing = Number(doc.system?.prerequisites?.level);
    if (Number.isFinite(existing) && existing > 0) { stats.alreadyStamped++; continue; }

    const { level } = derive(doc);
    if (!Number.isFinite(level) || level <= 0) {
      stats.untiered++;
      if (stats.samples.length < 5) stats.samples.push({ name: doc.name, decision: "untiered (no signal)" });
      continue;
    }

    stats.stamped++;
    if (stats.samples.length < 5) stats.samples.push({ name: doc.name, decision: `level ${level}` });
    updates.push({ _id: doc.id, "system.prerequisites.level": level });
  }

  if (!DRY_RUN && updates.length) {
    await pack.documentClass.updateDocuments(updates, { pack: packId });
  }
  if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });

  report.scanned += stats.scanned;
  report.stamped += stats.stamped;
  report.alreadyStamped += stats.alreadyStamped;
  report.untiered += stats.untiered;
  report.perPack[packId] = stats;
}

console.group("[stamp-prerequisite-levels] report");
console.log("DRY_RUN:", DRY_RUN);
console.table([{ scanned: report.scanned, stamped: report.stamped, alreadyStamped: report.alreadyStamped, untiered: report.untiered }]);
for (const [pk, s] of Object.entries(report.perPack)) {
  console.group(pk);
  console.table(s.samples);
  console.log(`scanned=${s.scanned}  stamped=${s.stamped}  alreadyStamped=${s.alreadyStamped}  untiered=${s.untiered}`);
  console.groupEnd();
}
console.groupEnd();

const verb = DRY_RUN ? "would stamp" : "stamped";
ui.notifications.info(`Prereq levels: ${verb} ${report.stamped}, ${report.alreadyStamped} already done, ${report.untiered} untiered. See console.`);
