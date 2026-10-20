/* patch-voice-off-2026-10-20.macro.js — every beat's voice track OFF by default (Dave, Story Review Ledger round 2 open asks, 2026-10-20):
 *  "We are going to re-record all voice audio. They should all be off by default, TBH, as none of the VO is correct anymore :)"
 *
 *  Sets `beat.audio.enabled = false` on every beat that has it on. The `src` / volume / broadcast flags are KEPT so a re-recorded
 *  take only needs the switch flipped back (or the file replaced at the same path). Reports the count per act-ish prefix.
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const report = []; let changes = 0; const byPrefix = {};
  for (const b of camp.beats) {
    const a = b && b.audio;
    if (!a || typeof a !== "object" || !a.enabled) continue;
    a.enabled = false; changes++;
    const p = String(b.id || "").split("_")[0] || "?"; byPrefix[p] = (byPrefix[p] || 0) + 1;
  }
  const withSrc = camp.beats.filter(b => b?.audio && String(b.audio.src || b.audio.playlistSoundUuid || "").trim()).length;
  report.push(`voice tracks switched off: ${changes} · beats that still carry a src for re-recording: ${withSrc}`);
  report.push(Object.entries(byPrefix).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(" · "));

  console.log(`[voice-off 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — every voice track is already off.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-voice-off-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — ${changes} voice track(s) off by default.`);
})();
