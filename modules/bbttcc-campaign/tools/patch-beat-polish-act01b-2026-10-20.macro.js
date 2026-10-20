/* patch-beat-polish-act01b-2026-10-20.macro.js — Dave's SECOND round of Beat Polish doc edits of 2026-10-20 (Act 0–1 tab),
 *  found when the doc was exported for its rebuild from live (six chunks changed since the morning export):
 *
 *   ag_confessor_pilgrim        "Ask Verna what the star means." after-text → Verna's hobby line (pilgrims: buckles, hats, racism)
 *   ag_tallow_pilgrim_hit       "He is not." → "Wick is a wax guy."
 *   ag_confessor_pilgrim_fail   the walker line gets its fourth-wall aside ("Put more points in Body maybe?"), stitch in your back
 *   ag_tamsin_confrontation     "does not perform innocence — he was never good at performances…" → "does not attempt to exude innocence."
 *   ag_confessor_relief         same cut + the relief played physically ("Oh thank whatever," criss cross applesauce on the floor)
 *   ag_confessor_counterfeit    present tense, "lie. Repeatedly. Creatively." as its own paragraph
 *
 *  Copy-edit on Dave's text: "or over racism" → "or overt racism". Every edit guarded by the live baseline; idempotent;
 *  DRY_RUN default true; backs up `campaigns`. GM only.
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
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const rep = (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };
  const repChoice = (id, labelRe, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const c = (b.choices || []).find(x => labelRe.test(String(x?.label || "")));
    if (!c) { report.push(`⚠ ${id}: choice ${labelRe} not found`); return; }
    if (c.description === to) { report.push(`· ok ${id}: ${note}`); return; }
    c.description = to; changes++; report.push(`✚ ${id}: ${note}`);
  };

  repChoice("ag_confessor_pilgrim", /ask verna what the star means/i,
    "I'm interested in people. It's a hobby. Pilgrim Wick is interesting, for a pilgrim who has no buckles, interesting hats, or overt racism.",
    "Verna's star after-text — people are a hobby");
  rep("ag_tallow_pilgrim_hit", "The whole street is tallow. He is not.", "The whole street is tallow. Wick is a wax guy.", "Wick is a wax guy");
  rep("ag_confessor_pilgrim_fail",
    "He's a walker. You're not. Apparently. By the second switchback he is gone, and you are a person with a stitch. When",
    "He's a walker. For narrative purposes, you're not. Apparently. Put more points in Body maybe? Regardless, by the second switchback he is gone, and you are a person with a stitch in your back. When",
    "the walker line, fourth wall and all");
  rep("ag_tamsin_confrontation",
    "Tamsin does not perform innocence — he was never good at performances, which is presumably why the darkness had to work through something true. What he believes",
    "Tamsin does not attempt to exude innocence. What he believes",
    "no performance line");
  rep("ag_confessor_relief",
    "He does not deny it. He was never good at performances, which is why the dark had to work through something true. He folds his hands, and he says the thing he has been rehearsing for a year and a half, and it comes out exactly as badly as he feared:",
    "He does not deny it. He does not attempt to exude innocence. He folds his hands, and he says the thing he has been rehearsing for a year and a half. It comes out exactly as badly as he feared:",
    "relief, opening");
  rep("ag_confessor_relief",
    "The kettle ticks. \"I am relieved,\" he says. \"I have been waiting to be caught since the first candle, and you took your time about it, and I am so relieved I could sit on the floor.\"",
    "The kettle ticks. \"Oh thank whatever,\" he says, and promptly sits criss cross applesauce on the floor. \"I have been waiting to be caught since the first candle, and you took your time about it. I am so relieved.\"",
    "relief, the floor");
  rep("ag_confessor_counterfeit",
    "You said nothing. You smiled, accepted the tea, and began to lie with the care of people arranging flowers. Tamsin passes it all along faithfully",
    "You say nothing. You smile, accept the tea, and lie. Repeatedly. Creatively.\n\nTamsin passes it all along faithfully",
    "counterfeit, present tense");

  console.log(`[beat-polish act01b 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-beat-polish-act01b-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Beat Polish Act 0–1, round two.`);
})();
