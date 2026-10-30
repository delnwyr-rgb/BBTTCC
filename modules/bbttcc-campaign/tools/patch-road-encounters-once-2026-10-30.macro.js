/**
 * patch-road-encounters-once-2026-10-30.macro.js — Dave, 10-30: "the Wendigo beats should only fire once in a campaign …
 * that and the radiation and the bridge and rockslide should only fire once in their initial forms at least." (Other
 * bog-based encounters — a real Acid Boggart fight — are new beats, not these.)
 * The road openers become once-only (inject.repeatable = false). hex-travel's _blockedByBeatRules already skips a fired
 * once-only beat (firedCount > 0 → "once-only"), so a table roll that lands on one passes the leg quietly / picks another.
 * The outcome beats behind each opener stay repeatable (they only run from inside it).
 *   enc_acid_bog · enc_broken_bridge · enc_minor_radiation_pocket · enc_rockslide_cinematic · enc_rockslide
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const IDS = ["enc_acid_bog", "enc_broken_bridge", "enc_minor_radiation_pocket", "enc_rockslide_cinematic", "enc_rockslide"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; const conflicts = []; let changes = 0;
  for (const id of IDS) {
    const b = beats.find(x => x && String(x.id) === id);
    if (!b) { conflicts.push(`${id}: beat not found`); continue; }
    b.inject = b.inject || {};
    if (b.inject.repeatable !== false) { report.push(`✎ ${id} (${b.label}): repeatable ${b.inject.repeatable} → false (once per campaign)`); b.inject.repeatable = false; changes++; }
  }
  console.log(`[road encounters once 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__roadOnce = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-road-once-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the road's opening encounters fire once per campaign.`);
})();
