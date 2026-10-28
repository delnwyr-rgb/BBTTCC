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
// Applied in order; a later file's "old" is the earlier file's "new". Second file = the Darkness ruling (raids never
// lower Darkness — 12 raid cards read Loyalty instead), added 2026-10-28 late.
const DATA = [
  "modules/bbttcc-master-content/tools/doctrines-pack-text-2026-10-28.json",
  "modules/bbttcc-master-content/tools/doctrines-pack-text-darkness-2026-10-28.json"
];
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  const report = {};
  for (const url of DATA) {
  const data = await fetch(url, { cache: "no-store" }).then(r => r.json());
  const tag = url.split("/").pop();
  for (const [packId, rows] of Object.entries(data.packs)) {
    const pack = game.packs.get(packId);
    if (!pack) { report[`${tag} → ${packId}`] = "not available in this world"; continue; }
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
    report[`${tag} → ${packId}`] = { [DRY_RUN ? "wouldUpdate" : "updated"]: updates.length, alreadyCurrent: already, conflicts };
  }
  }
  console.log("[refresh-doctrines-pack-text]", DRY_RUN ? "DRY RUN" : "APPLIED", report);
  ui.notifications.info(`Doctrine pack text ${DRY_RUN ? "(dry run)" : "applied"} — see console.`);
  return report;
})();
