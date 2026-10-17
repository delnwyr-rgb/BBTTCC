/* patch-tamsin-dream-tell-2026-10-16.macro.js — THE DREAM GETS A TELL (Dave, 2026-10-16):
 *  "allesh_gilliam_father_tamsin_conversation — we're asking about Tamsin's dream. It hasn't come up before then.
 *   So how do the players know to ask?"  They didn't: the only prior mention was the Quest Log's door line.
 *
 *  - The Act 2 conversation gains a closing tell: Tamsin reaches for the kettle and misses, says the valley has been
 *    dreaming loud again since that night (= a2_that_one_night), and that people never want to hear it.
 *  - The row "The dream. Tell me about the dream." becomes "That night. You had it too — tell me about the dream."
 *    No new gate: the conversation is already Act-2-only, and gating on the director's opener card could hide the
 *    row for a table whose GM declined it.
 *  Idempotent (marker + label guards); DRY_RUN default true; backs up `campaigns`. GM only.
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
  const b = camp.beats.find(x => x.id === "allesh_gilliam_father_tamsin_conversation");
  if (!b) return ui.notifications.error("allesh_gilliam_father_tamsin_conversation not found.");
  const report = []; let changes = 0;

  const TELL_KEY = "The valley has been dreaming loud again";
  const P1 = "He reaches for the kettle and misses it by an inch, the way a man does on no sleep. The hands remember where it should be; the eyes are somewhere else.";
  const P2 = "“Forgive me. The valley has been dreaming loud again, since that night. It always did, before.” He finds the kettle on the second try. “I don't suppose you'd want to hear about it. People don't, mostly. I tell them anyway.”";
  const desc = String(b.description || "");
  if (!desc.includes(TELL_KEY)) {
    const html = /<p[\s>]/i.test(desc);
    b.description = html ? desc.replace(/\s*$/, "") + `<p>${P1}</p><p>${P2}</p>` : desc.replace(/\s*$/, "") + `\n\n${P1}\n\n${P2}`;
    changes++; report.push("✚ conversation: the kettle tell appended" + (html ? " (html)" : " (plain)"));
  } else report.push("· ok conversation: tell already present");

  const row = (b.choices || []).find(c => c?.next === "ag_tamsin_the_dream");
  if (!row) report.push("⚠ row → ag_tamsin_the_dream not found");
  else if (row.label !== "That night. You had it too — tell me about the dream.") {
    row.label = "That night. You had it too — tell me about the dream.";
    if (!String(row.description || "").trim()) row.description = "He does not answer with words.";
    changes++; report.push("✚ row relabelled: 'That night. You had it too — tell me about the dream.'");
  } else report.push("· ok row already relabelled");

  console.log(`[patch-tamsin-dream-tell] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Tamsin dream-tell DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Tamsin dream-tell: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-tamsin-dream-tell-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Tamsin dream-tell APPLIED: ${changes} change(s). The kettle knows.`);
})();
