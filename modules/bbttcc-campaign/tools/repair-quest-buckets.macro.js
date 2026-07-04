/* repair-quest-buckets.macro.js — de-duplicate quest bucket entries (2026-07-03)
 *
 * Foundry's setFlag MERGES objects, so quest bucket TRANSITIONS (active →
 * completed/archived) never actually deleted the source entry: quests could
 * sit in two buckets at once, and "is active" gates never closed (live-caught:
 * the sealed stabilizer deal stayed offerable). The engine is fixed
 * (deletion-sync before setFlag, deployed 2026-07-03); this macro repairs
 * EXISTING duplicates: for every faction actor, any quest present in more
 * than one bucket keeps only the most recently touched entry.
 *
 * DRY_RUN default true. Run as GM.
 */
(async () => {
  const DRY_RUN = false;
  const MOD = "bbttcc-factions";
  const BUCKETS = ["active", "completed", "archived"];

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const report = [];
  let repaired = 0;

  for (const actor of game.actors.contents) {
    const q = actor.getFlag(MOD, "quests");
    if (!q) continue;
    const seen = {};   // questId -> [{bucket, ts}]
    for (const bucket of BUCKETS) {
      for (const [qid, entry] of Object.entries(q[bucket] || {})) {
        (seen[qid] = seen[qid] || []).push({ bucket, ts: Number(entry?.lastTouchedTs || 0) });
      }
    }
    const del = {};
    for (const [qid, hits] of Object.entries(seen)) {
      if (hits.length < 2) continue;
      hits.sort((a, b) => b.ts - a.ts);          // newest first — that one stays
      const keep = hits[0];
      for (const h of hits.slice(1)) {
        del[`flags.${MOD}.quests.${h.bucket}.-=${qid}`] = null;
        report.push(`${actor.name}: "${qid}" in ${hits.map(x => x.bucket).join("+")} → keep ${keep.bucket}, drop ${h.bucket}`);
      }
    }
    if (Object.keys(del).length) {
      repaired++;
      if (!DRY_RUN) await actor.update(del, { render: false });
    }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[repair-quest-buckets] ${banner}\n` + (report.length ? report.map(r => "  • " + r).join("\n") : "  • no duplicates found"));
  ui.notifications.info(`Quest bucket repair: ${banner} ${report.length} duplicate(s) across ${repaired} actor(s) (see console)`);
})();
