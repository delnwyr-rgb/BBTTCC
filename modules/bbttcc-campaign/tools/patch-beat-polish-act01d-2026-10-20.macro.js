/* patch-beat-polish-act01d-2026-10-20.macro.js — Dave's FOURTH round of Beat Polish doc edits of 2026-10-20 (Act 0–1 tab), found by the
 *  pre-rebuild export diff (7 chunks changed since the night swap):
 *
 *   kt_official_word_open_fail   "It is tonnage." cut
 *   khezek_tor_the_brace         the two paragraphs are one; "The other half won't say." → "The other half says it out loud."
 *                                (Dave typed "says sayit out loud" — read as "says it out loud"; flagged in chat)
 *   khezek_tor_the_maw           the ore just glows; whispers = the shape words make IN THE BRAIN; "The miners call it bad company."
 *   khezek_tor_the_lift_hall     "spoken to, sometimes, which is both important and necessary."; the "wrong about the order" sentence cut
 *   khezek_upper_galleries       "the cult's camp" → "the camp of Tamsin's employer"
 *   lyrenn_opening_scene         the solar-cloth paragraph cut; "when one thinks about a rake too hard"
 *   lyrenn_town_walk             "no fuss no muss. You can respect that. You're pretty sure your food is going to taste better now somehow."
 *                                (Dave typed "you're food" — read as "your food"; flagged in chat)
 *
 *  Guarded by the live baseline; idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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
    if (to && !from.includes(to) && d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (d.includes(from)) { b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; }
    if (to === "" || d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    report.push(`⚠ ${id}: baseline text not found for "${note}"`);
  };

  rep("kt_official_word_open_fail", "It is not an answer. It is tonnage. He goes back to work", "It is not an answer. He goes back to work", "tonnage cut");
  rep("khezek_tor_the_brace", "the hex will change, and stay changed.<p>The Brace went up after", "the hex will change, and stay changed. The Brace went up after", "one paragraph");
  rep("khezek_tor_the_brace", "Half the town thinks the mountain did it on purpose. The other half won't say.</p>", "Half the town thinks the mountain did it on purpose. The other half says it out loud.", "the other half says it out loud");
  rep("khezek_tor_the_maw", "The walls are veined with ore that glows the way a memory glows, in pulses, and when the mine rests the whispers come up, not words, more the shape words make before anyone has decided to say them.", "The walls are veined with ore that glows. When the mine rests the whispers come up, not words, more the shape words make in the brain before anyone has decided to say them.", "the ore glows; words in the brain");
  rep("khezek_tor_the_maw", "The miners call it company.", "The miners call it bad company.", "bad company");
  rep("khezek_tor_the_lift_hall", "and spoken to, sometimes, by people who would deny it upstairs.", "and spoken to, sometimes, which is both important and necessary.", "important and necessary");
  rep("khezek_tor_the_lift_hall", "which Brennig puts down to guilt and love, in whichever order. He is wrong about the order, and about a third thing he doesn't know to count.", "which Brennig puts down to guilt and love.", "the order sentence cut");
  rep("khezek_upper_galleries", "and there it is — the cult's camp, seen from a ridge", "and there it is — the camp of Tamsin's employer, seen from a ridge", "Tamsin's employer");
  rep("lyrenn_opening_scene", "Solar cloth hangs between poles like tired flags. Wind chimes made from irrigation parts sing constantly, keeping pests—mundane and otherwise—uneasy.\n\n", "", "solar-cloth paragraph cut");
  rep("lyrenn_opening_scene", "when one thinks about it and a rake too hard.", "when one thinks about a rake too hard.", "a rake too hard");
  rep("lyrenn_town_walk", "and go back to it: no ceremony, no suspicion, just a place with too much growing to stop for anybody.", "and go back to it: no fuss no muss. You can respect that. You're pretty sure your food is going to taste better now somehow.", "no fuss no muss");

  console.log(`[beat-polish act01d 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-beat-polish-act01d-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Beat Polish Act 0–1, round four.`);
})();
