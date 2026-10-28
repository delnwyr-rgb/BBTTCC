// bbttcc-master-content/tools/refresh-doctrines-pack-text-2026-10-28.macro.js
// Strategic review follow-up (2026-10-28): the doctrine compendium cards still read the retired Morale / Unity /
// Empathy Meter effects and pre-scale prices. This refreshes the rules paragraph + the Cost line from the runtime
// catalog (flavour text untouched) in bbttcc-master-content.doctrines and its 5E twin bad-eden-5e.doctrines.
// Data: doctrines-pack-text-2026-10-28.json (built from api.raid.activityText + api.turn.activityCost on ember).
// Safe by construction: a row is written only when the live description still equals the expected old text —
// anything edited in-world since is reported, never overwritten. In-world updateDocuments (no LevelDB rsync).
// Run as GM: DRY_RUN = true first, then false; a rerun reports 0 to update. Packs are per instance — run once on
// each instance (any world where the module is active).
const DRY_RUN = true;
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  const data = await fetch("modules/bbttcc-master-content/tools/doctrines-pack-text-2026-10-28.json", { cache: "no-store" }).then(r => r.json());
  const report = {};
  for (const [packId, rows] of Object.entries(data.packs)) {
    const pack = game.packs.get(packId);
    if (!pack) { report[packId] = "not available in this world"; continue; }
    const docs = await pack.getDocuments();
    const byKey = new Map(docs.map(d => [`${d.flags?.bbttcc?.kind}:${d.flags?.bbttcc?.key}`, d]));
    const updates = [], conflicts = []; let already = 0;
    for (const r of rows) {
      const d = byKey.get(`${r.kind}:${r.key}`);
      if (!d) { conflicts.push(`${r.name}: not in the pack`); continue; }
      const cur = d.system?.description?.value ?? "";
      if (cur === r.new) { already++; continue; }
      if (cur !== r.old) { conflicts.push(`${r.name}: live text differs from the expected old text — skipped`); continue; }
      const u = { _id: d.id, "system.description.value": r.new };
      if (r.rfiHash) u["flags.bad-eden-5e.rfi.hash"] = r.rfiHash;
      updates.push(u);
    }
    if (!DRY_RUN && updates.length) {
      const wasLocked = pack.locked;
      if (wasLocked) await pack.configure({ locked: false });
      try { await Item.updateDocuments(updates, { pack: packId }); }
      finally { if (wasLocked) await pack.configure({ locked: true }); }
    }
    report[packId] = { [DRY_RUN ? "wouldUpdate" : "updated"]: updates.length, alreadyCurrent: already, conflicts };
  }
  console.log("[refresh-doctrines-pack-text]", DRY_RUN ? "DRY RUN" : "APPLIED", report);
  ui.notifications.info(`Doctrine pack text ${DRY_RUN ? "(dry run)" : "applied"} — see console.`);
  return report;
})();
