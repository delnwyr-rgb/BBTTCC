/**
 * patch-gloomgill-milestones-2026-11-02.macro.js — ONE CLOCK pacing (Dave 2026-11-02: "milestones, rather than days"), same shape as
 * patch-story-milestones (Crown Mall, the grief towns). Live-caught at Lake Suspicious: the Exam is ONE scene, but its script's steps
 * charged a day per beat — the intro (2), the ten questions (10, one step) and the verdict — 13 days of the month for a quiz, two
 * weekly income slices paid mid-show. The arrival (`intro`) and the verdict (`verdict`) are the milestones; the questions cost nothing.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const PLAN = { gloomgill: ["intro", "verdict"] };
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; let changes = 0;
  for (const [key, ids] of Object.entries(PLAN)) {
    const sc = camp.story?.scripts?.[key]; if (!sc || !Array.isArray(sc.steps)) { report.push(`⚠ ${key}: no data script`); continue; }
    for (const id of ids) { const st = sc.steps.find(s => s && s.id === id); if (!st) { report.push(`⚠ ${key}.${id}: no such step`); continue; } if (st.milestone === true) { report.push(`· ok ${key}.${id}`); continue; } st.milestone = true; changes++; report.push(`✚ ${key}.${id}: milestone`); }
  }
  console.log(`[gloomgill milestones 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__gloomMs = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-gloomgill-milestones-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Exam costs its arrival and its verdict.`);
})();
