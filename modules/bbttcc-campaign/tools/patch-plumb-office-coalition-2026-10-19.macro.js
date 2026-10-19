/* patch-plumb-office-coalition-2026-10-19.macro.js — THE PLUMB OFFICE: WHY HE'S HERE (Dave, Beat Polish doc, 2026-10-19):
 *  Dave's one Beat Polish edit that the Story Review Act 0–1 macro deliberately left in the doc only — now a yes.
 *  `allesh_gilliam_plumb_office_intro` gains two closing paragraphs: the Avuncular Coalition brought Aldous to
 *  Allesh-Gilliam for his gift with construction; interestingly, that has not translated into knowing how to construct things.
 *  Idempotent (text guard); DRY_RUN default true; backs up `campaigns`. GM only.
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
  const b = camp.beats.find(x => x.id === "allesh_gilliam_plumb_office_intro");
  if (!b) return ui.notifications.error("allesh_gilliam_plumb_office_intro not found.");
  const report = []; let changes = 0;

  const KEY = "the Avuncular Coalition brought him to Allesh-Gilliam";
  const BASE_TAIL = "He has a slightly panicked look on his face as you enter.";
  const P1 = "In theory, the Avuncular Coalition brought him to Allesh-Gilliam because he has a gift with construction.";
  const P2 = "Interestingly, this has not translated into actual knowledge of … how to construct things.";
  const desc = String(b.description || "");
  if (desc.includes(KEY)) report.push("· ok plumb office: sentence already present");
  else if (!desc.trimEnd().endsWith(BASE_TAIL)) report.push("⚠ plumb office: baseline tail not found — beat text has moved, skipped");
  else {
    const html = /<p[\s>]/i.test(desc);
    b.description = html ? desc.replace(/\s*$/, "") + `<p>${P1}</p><p>${P2}</p>` : desc.replace(/\s*$/, "") + `\n\n${P1}\n\n${P2}`;
    changes++; report.push("✚ plumb office: two closing paragraphs appended" + (html ? " (html)" : " (plain)"));
  }

  console.log(`[patch-plumb-office-coalition] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Plumb office DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Plumb office: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-plumb-office-coalition-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Plumb office APPLIED: ${changes} change(s). In theory.`);
})();
