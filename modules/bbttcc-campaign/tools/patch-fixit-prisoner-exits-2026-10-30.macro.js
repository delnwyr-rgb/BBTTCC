/**
 * patch-fixit-prisoner-exits-2026-10-30.macro.js — Dave, 10-30, startup lint "4 dead-end venue(s)". Surfaced (not caused)
 * by patch-fixit-exteriors-go-in: the Arc Bay exterior now leads inside, so the lint walks Gearbox's conversation → "What's
 * the deal with the crying Fey?" → the Weeping Prisoner, whose four endings (outcome_trigger, quest complete) had NO
 * choices — picking one ended the whole chain cold. Same fix as the KT mine endings (10-28): one exit back to the hub.
 *   fixit_weeping_prisoner_{justice,punishment,mercy,not_our_problem}  + "Back to the bay." → fixit_arc_bay_conversation
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const IDS = ["fixit_weeping_prisoner_justice", "fixit_weeping_prisoner_punishment", "fixit_weeping_prisoner_mercy", "fixit_weeping_prisoner_not_our_problem"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; const conflicts = []; let changes = 0;
  if (!beats.some(b => b?.id === "fixit_arc_bay_conversation")) conflicts.push("fixit_arc_bay_conversation: hub not found");
  for (const id of IDS) {
    const b = beats.find(x => x && String(x.id) === id);
    if (!b) { conflicts.push(`${id}: beat not found`); continue; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (!b.choices.some(c => String(c?.next) === "fixit_arc_bay_conversation")) {
      b.choices.push({ label: "Back to the bay.", next: "fixit_arc_bay_conversation", description: "", checkStat: "", checkDC: 0, failNext: "" });
      changes++; report.push(`✚ ${id}: "Back to the bay." → fixit_arc_bay_conversation`);
    }
  }
  console.log(`[fixit prisoner exits 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__prisonerExits = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-prisoner-exits-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the crying Fey's endings lead back to the bay.`);
})();
