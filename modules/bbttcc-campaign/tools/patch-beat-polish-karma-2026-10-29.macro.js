/**
 * patch-beat-polish-karma-2026-10-29.macro.js — the one writer edit made in the Beat Polish doc since the 10-21 rebuild
 * (Coast towns tab, Offices slide 8): "Give suffering an un-ignorable face. Give it agency." → "…Give karma agency."
 * Spliced live before the 10-29 rebuild-from-live so the rebuild does not overwrite it.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const BEAT = "fates_and_destinies_8";
  const FROM = "Give suffering an un-ignorable face. Give it agency.";
  const TO = "Give suffering an un-ignorable face. Give karma agency.";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const b = beats.find(x => x && String(x.id) === BEAT);
  if (!b) return ui.notifications.error(`${BEAT} not found — nothing written.`);
  let changes = 0;
  if (String(b.description || "").includes(FROM)) { b.description = b.description.replace(FROM, TO); changes++; }
  else if (!String(b.description || "").includes(TO)) return ui.notifications.error(`${BEAT}: neither line found — nothing written.`);
  console.log(`[beat polish karma 2026-10-29] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)`);
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s).`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-bp-karma-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Offices slide 8 says "Give karma agency."`);
})();
