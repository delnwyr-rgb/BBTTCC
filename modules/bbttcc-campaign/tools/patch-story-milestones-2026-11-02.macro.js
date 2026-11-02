/**
 * patch-story-milestones-2026-11-02.macro.js — ONE CLOCK pacing (Dave 2026-11-02: "Agreed on milestones, rather than days"). Crown Mall
 * took 11 days because every dialog step of its script cost a day. Dense locations mark the steps that move the clock
 * (step.milestone = true; the engine then charges only those — module.js _oneClockStepBeats):
 *   • crown_mall: Donny's door, the archive, the clip, the terms (4 days, was 8)
 *   • the grief towns (chuckle_creek, soft_landing, stillwater): the arrival, the step that hands over the town's receipt (done.mark),
 *     and the last step (3 days, was 10–13)
 * The Widening Trail, Father Tamsin and every unmarked script keep a day per step. Idempotent (rerun = 0). DRY_RUN first.
 * Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const PLAN = { crown_mall: ["donny", "archive", "clip", "mall"] };
  const GRIEF = ["chuckle_creek", "soft_landing", "stillwater"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; let changes = 0;
  const mark = (key, ids) => {
    const sc = camp.story?.scripts?.[key]; if (!sc || !Array.isArray(sc.steps)) { report.push(`⚠ ${key}: no data script`); return; }
    for (const st of sc.steps) { const want = ids.includes(st.id); if (want && st.milestone !== true) { st.milestone = true; changes++; report.push(`✚ ${key}.${st.id}: milestone`); } }
  };
  for (const [k, ids] of Object.entries(PLAN)) mark(k, ids);
  for (const k of GRIEF) {
    const sc = camp.story?.scripts?.[k]; if (!sc?.steps?.length) { report.push(`⚠ ${k}: no data script`); continue; }
    const ids = new Set([sc.steps[0].id, sc.steps[sc.steps.length - 1].id, ...sc.steps.filter(st => st?.done?.mark).map(st => st.id)]);
    mark(k, [...ids]);
  }
  if (!changes) report.push("· nothing to change");
  console.log(`[story milestones 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__milestones = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-story-milestones-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} milestone(s).`);
})();
