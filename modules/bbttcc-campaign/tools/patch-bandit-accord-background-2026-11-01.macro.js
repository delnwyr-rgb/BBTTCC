/**
 * patch-bandit-accord-background-2026-11-01.macro.js — Dave, 11-01: "the visualizer now says 'the drowned south keeps count'
 * is the next quest, but that's waiting on random encounters so shouldn't be a quest that I fire, right?"
 *
 * Right. The Bandit Accord grows from what the table does to bandits on the road — its opening is the reeds noticing, and
 * its rungs are mercy counts, not errands. The story model already has the shape (owner ruling 2026-10-02, the Sarmoung Hum):
 * a BACKGROUND quest fills idle time only — NOW offers it when nothing foreground is fresh and no door is open; it never
 * headlines over a foreground quest. The quest stays active and visible in the log with its Next line.
 *   campaign.story.quests.bandit_accord.background = true
 * Idempotent (rerun = 0). Pure `apply(camp)` (node lint proof) + Foundry runner. DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const BANDIT_BG_PATCH = (() => {
  function apply(camp) {
    const report = [], conflicts = []; let changes = 0;
    const q = camp.story?.quests?.bandit_accord;
    if (!q) return { changes, report, conflicts: ["campaign.story.quests.bandit_accord not found (the quest def lives in code only here — add it to campaign.story.quests first)"] };
    if (q.background === true) report.push("· ok bandit_accord is a background quest");
    else { q.background = true; changes++; report.push("✚ bandit_accord: background — fills idle time, never the NOW headline"); }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = BANDIT_BG_PATCH;                                    // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = BANDIT_BG_PATCH.apply(camp);
  console.log(`[bandit accord background 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__banditAccordBackground = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-bandit-accord-background-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the reeds count in the background.`);
})();
