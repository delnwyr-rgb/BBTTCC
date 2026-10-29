/**
 * patch-kt-mine-endings-exit-2026-10-28.macro.js
 * Startup beat lint (Dave 10-28, after patch-kt-after-the-seal): "3 dead-end venue(s)". Calder's new door made the Mine That
 * Answered Back reachable from the town, and its three endings (seal / exploit / open) had no way out. Each gets
 * "Back up to the switchback" → khezek_tor_quest_scene, the same shape as the Seal's "Back down the shaft".
 * Idempotent (rerun = 0). DRY_RUN first. Backup of `campaigns` → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const report = []; const conflicts = []; let changes = 0;
  const HUB = "khezek_tor_quest_scene";
  if (!byId(HUB)) conflicts.push(`${HUB}: not found`);
  for (const id of ["khezek_tor_mine_that_answered_back_seal", "khezek_tor_mine_that_answered_back_exploit", "khezek_tor_mine_that_answered_back_open"]) {
    const b = byId(id); if (!b) { conflicts.push(`${id}: not found`); continue; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => String(c?.label || "").trim())) continue;
    b.choices.push({ label: "Back up to the switchback", next: HUB, description: "", checkStat: "", checkDC: 0, failNext: "" });
    changes++; report.push(`+ ${id}: "Back up to the switchback" → ${HUB}`);
  }

  console.log(`[kt mine endings exit 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-mine-exit-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Mine's endings lead back to the switchback.`);
})();
