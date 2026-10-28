/**
 * patch-soft-landing-teju-2026-10-28.macro.js
 * Dave (Quest Log writer sheet, 2026-10-28): players should be able to learn Teju's name "in a discussion with a member
 * of the town council, or the lady on the bench" — not only by reading the birthday card. Adds:
 *   · ans_soft_landing_state_function_minister — at the Mayor's session, the minister's notes say TEJU (a council member)
 *   · ans_soft_landing_give_3_who_the_party_was_for — Adaeze, on the bench, says the name and the age
 *   · a choice reaching each from its scene (and from that scene's sibling answers)
 *   · soft_landing_give_1 ("The Conversation Bounces", ask the town about Teju) opens on ANY of: the card, the minister,
 *     Adaeze — it used to wait on the card alone.
 * Answer beats follow the dead-end-sweep shape: routing-only (dialogueOffer:false, no questId/story), the parent's
 * storyPhase gate + evergreen, timeScale "moment" / 0 points, and their choices = the parent's OTHER choices (never back
 * into the parent — re-entry re-applies its effects). Cloned from a live sibling answer so speaker/scene match.
 * Idempotent (skips what exists); DRY_RUN first. Backup of `campaigns` → Data/bbttcc-exports/. GM only.
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
  const report = []; const conflicts = [];
  const NEW = [
    { id: "ans_soft_landing_state_function_minister", parent: "soft_landing_state_function", template: "ans_soft_landing_state_function_bounce",
      siblings: ["ans_soft_landing_state_function_bounce"],
      choiceLabel: "Catch the minister taking notes.",
      label: "Soft Landing — The State of the Bounce — The Minister's Notes",
      description: "You catch the minister of something on the way down. His clipboard is blank except for one word, written small at the top of every page, over and over, the way you'd practise a signature. You read it upside down before he bounces out of reach: TEJU. He sees you see it. \"Cake,\" he says, kindly, and is gone at the top of an arc." },
    { id: "ans_soft_landing_give_3_who_the_party_was_for", parent: "soft_landing_give_3", template: "ans_soft_landing_give_3_ask_her_why_she_isn",
      siblings: ["ans_soft_landing_give_3_ask_her_why_she_isn", "ans_soft_landing_give_3_feel_the_ground_around_her", "ans_soft_landing_give_3_offer_to_bounce_with_her"],
      choiceLabel: "\"Ask her who the party was for.\"",
      label: "The Elder Who Isn't Bouncing — Who the party was for",
      description: "She doesn't answer right away. The antennae go still. \"Teju,\" she says, to the middle distance. \"Seven.\" Then nothing else, and you understand that the nothing else is the hard part." }
  ];
  for (const n of NEW) {
    const parent = byId(n.parent), tpl = byId(n.template);
    if (!parent || !tpl) { conflicts.push(`${n.id}: parent or template missing`); continue; }
    if (!byId(n.id)) {
      const b = JSON.parse(JSON.stringify(tpl));
      b.id = n.id; b.label = n.label; b.description = n.description;
      b.choices = (parent.choices || []).filter(c => c && c.next !== n.id && c.label !== n.choiceLabel).map(c => JSON.parse(JSON.stringify(c)));
      b.dialogueOffer = false; delete b.questId; delete b.story; b.timeScale = "moment"; b.timePoints = 0;
      b.inject = { ...(b.inject || {}), repeatable: true, evergreen: true, requires: JSON.parse(JSON.stringify(parent.inject?.requires || [])) };
      b.worldEffects = {};
      beats.push(b); report.push(`+ beat ${n.id}`);
    }
    for (const hostId of [n.parent, ...n.siblings]) {
      const host = byId(hostId); if (!host) { conflicts.push(`${hostId}: not found`); continue; }
      host.choices = Array.isArray(host.choices) ? host.choices : [];
      if (host.choices.some(c => c && c.next === n.id)) continue;
      const leave = host.choices.findIndex(c => /^(climb down|leave her be)/i.test(String(c?.label || "")));
      const ch = { label: n.choiceLabel, next: n.id, description: "", checkStat: "", checkDC: 0, failNext: "" };
      if (leave >= 0) host.choices.splice(leave, 0, ch); else host.choices.push(ch);
      report.push(`+ choice on ${hostId} → ${n.id}`);
    }
  }
  // the Teju question opens on the card OR either new answer
  const g1 = byId("soft_landing_give_1");
  const OLD = { beatMark: "soft_landing_birthday_card" };
  const NEWC = { anyOf: [{ beatMark: "soft_landing_birthday_card" }, { beatMark: NEW[0].id }, { beatMark: NEW[1].id }] };
  if (!g1) conflicts.push("soft_landing_give_1: not found");
  else {
    const req = Array.isArray(g1.inject?.requires) ? g1.inject.requires : [];
    const iNew = req.findIndex(c => JSON.stringify(c) === JSON.stringify(NEWC));
    const iOld = req.findIndex(c => JSON.stringify(c) === JSON.stringify(OLD));
    if (iNew >= 0) { /* already */ }
    else if (iOld >= 0) { req[iOld] = NEWC; report.push("~ soft_landing_give_1 gate: card OR minister OR Adaeze"); }
    else conflicts.push("soft_landing_give_1: gate differs from the expected — skipped");
  }
  console.log(`[soft landing teju] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${report.length} change(s), ${conflicts.length} conflict(s)`, report, conflicts);
  window.__tejuReport = { dry: DRY_RUN, changes: report, conflicts };
  if (DRY_RUN || !report.length) return ui.notifications.info(`Teju patch ${DRY_RUN ? "(dry run)" : ""}: ${report.length} change(s).`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-teju-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Teju patch applied: ${report.length} change(s).`);
})();
