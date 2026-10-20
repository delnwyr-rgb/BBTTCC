/* patch-story-review-grief-2026-10-19.macro.js — STORY REVIEW LEDGER, "Act 2 findings: the grief towns" rows 1–11, ALL Accept (Dave, 2026-10-19)
 *  Chuckle Creek · Soft Landing · Stillwater. Row 12 (strip ⚙ GM notes from the player card) is an ENGINE fix, not in this macro.
 *  Halloween 2077 named as the cause in both hedging beats; the Crown Mall / Tanneritos foreshadowing pulled back to Act 2 knowledge
 *  (the stewards write the New Episode until they meet the Tanneritos — the hand-off is an Act 4 hook); Pearl named at the corner table;
 *  Marnie's "it"; Dewey's hat; seven pairs; the design note behind the gear; the GM-speak choice; two hundred years; the Odaroloc.
 *  Every edit guarded by the live baseline. DRY_RUN default true; GM only; backs up `campaigns`.
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
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const report = []; let changes = 0;
  const ok = (m) => report.push("· ok " + m);
  const add = (m) => { changes++; report.push("✚ " + m); };
  const warn = (m) => report.push("⚠ " + m);
  const B = (id) => { const b = byId.get(id); if (!b) warn(`${id}: beat missing`); return b; };
  const rep = (id, from, to, field = "description") => {
    const b = B(id); if (!b) return;
    const cur = String(b[field] || "");
    if (to ? cur.includes(to) : !cur.includes(from)) return ok(`${id}.${field} already reads the new text`);
    if (!cur.includes(from)) return warn(`${id}.${field}: baseline not found — skipped`);
    b[field] = cur.replace(from, to); add(`${id}.${field}: text`);
  };
  const setChoiceField = (id, label, field, to) => {
    const b = B(id); if (!b) return;
    const c = (b.choices || []).find(c => c && c.label === label);
    if (!c) return warn(`${id}: choice '${label}' not found`);
    if (c[field] === to) return ok(`${id} › '${label}'.${field} already set`);
    c[field] = to; add(`${id} › '${label}'.${field}`);
  };

  // ── Row 1: the cause has a date ──
  rep("chuckle_showrunner",
    "It found a town drowning. A plague, a raid, a Shattering-grief too large to hold — the details have been edited out, kindly. And it did the only mercy it understood:",
    "It found a town on the worst night there has ever been. Movie night, Halloween, 2077. And it did the only mercy it understood:");
  rep("soft_landing_give_4",
    "A plague, or a flood, or a Shattering-grief that took nearly everyone's nearly-everyone inside a single stretch of days. And the survivors did the only thing that kept them upright:",
    "It was the night everyone else calls the Shattering. Here it was a seventh birthday. On Halloween, even. It took nearly everyone's nearly-everyone inside a single stretch of hours, and the survivors did the only thing that kept them upright:");

  // ── Row 2: the stack, without the mall ──
  rep("chuckle_tape_shelf",
    "stacked weird — leaning towers, spines every direction, the way nobody stacks tapes unless they learned it somewhere. You have seen tapes stacked exactly like this before, in a mall, eleven hexes down the coast. One slot",
    "stacked weird — leaning towers, spines every direction. The stacking of these video tapes defies the laws of physics. And feng shui. And it makes your eyes hurt. You wonder where she learned it, and you would definitely notice Chekhov's Video Tapes later if you saw something stacked the same way. One slot");
  {
    const st = camp.story?.scripts?.chuckle_creek?.steps?.find(s => s && s.id === "stack");
    const to = "Marnie's booth is where the show is made. The tapes are stacked weird — remember how. Find the slip.";
    if (!st) warn("script chuckle_creek: step stack missing");
    else if (st.line === to) ok("chuckle_creek step stack: line set");
    else if (!/you've seen tapes stacked like that before/.test(String(st.line || ""))) warn("chuckle_creek step stack: line moved — skipped");
    else { st.line = to; add("chuckle_creek step 'The Stack': line (no more 'seen before')"); }
  }

  // ── Row 3: the stewards write the New Episode; the Tanneritos are an Act 4 hand-off ──
  rep("chuckle_new_episode",
    "Someone has to write it, and the Tanneritos are exactly, almost embarrassingly, the right people — a faction that takes fun seriously as a load-bearing sacred thing rather than an anaesthetic. The town keeps its soft physics.",
    "Someone has to write it. For now that someone is you, and you will want help from people who take fun seriously as a load-bearing thing rather than an anaesthetic. There is a mall down the coast full of them, you're told; until you find it, the pen is yours. The town keeps its soft physics.");
  rep("chuckle_showrunner",
    " (If the Tanneritos are already here, and they may well be, you'll find some of them half-inside it and not entirely sure when they last left.)",
    "");
  rep("chuckle_showrunner",
    "Its name is Marnie Vell. She ran the projector. She still does.",
    "Its name is Marnie Vell. She ran the projector. She still does.\n\n⚙ GM: if the Tanneritos (Act 4, the Crown Mall) are already in play, some of them are half-inside the show and not entirely sure when they last left. When the stewards meet them, the New Episode's pen can be handed off — and the Tanneritos pay for it.");

  // ── Row 4: Pearl at the corner table ──
  rep("chuckle_rung_2",
    "The woman at the corner table sets two places. She pours a second coffee, adds the sugar without asking, and talks across the empty chair",
    "Pearl, off shift, sits at the corner table and sets the fourth place. She pours Winnie's coffee, adds the sugar without asking, and talks across the empty chair");

  // ── Row 5: Marnie's "it" ──
  rep("chuckle_credits",
    "\"I said it to keep a room from screaming,\" she says. \"It worked. It's still working. I don't know how to say the other thing.\"",
    "\"That's on the tape too,\" she says. \"I said it to keep a room from screaming. It worked. It's still working. I don't know how to say the other thing.\"");

  // ── Row 6: the hat is Hollis's ──
  rep("chuckle_rung_3", "he is back at the diner, hat tipped, suitcase gone, joke un-begun,", "he is back at the diner, suitcase gone, joke un-begun,");

  // ── Row 7: nine pairs ──
  rep("soft_landing_castle", "And a row of small ones, seven or eight pairs,", "And a row of small ones, seven pairs,");

  // ── Row 8: the design note goes behind the gear ──
  rep("soft_landing_practice",
    " (Note the family rhyme: Chuckle Creek's New Episode, Stillwater's Covenant, this. The middle path is always MANAGED survival.)",
    "");
  rep("soft_landing_practice",
    "⚙ GM: `cushioned` persists but decays over Turns as the ground gets used; alignment unlocks gradually rather than at once.",
    "⚙ GM: `cushioned` persists but decays over Turns as the ground gets used; alignment unlocks gradually rather than at once. Note the family rhyme: Chuckle Creek's New Episode, Stillwater's Covenant, this. The middle path is always MANAGED survival.");

  // ── Row 9: no rung talk in a player line ──
  setChoiceField("stillwater_paper", "Keep the paper.", "description", "The ink is wet in your pocket. It stays wet. It's a piece of the before. Somebody here is going to need to see a piece of the after.");

  // ── Row 10: two hundred years ──
  rep("stillwater_crack_2", "There has not been a train on this line in decades. There has not been a line.", "There has not been a train on this line in two hundred years. There has not been a line.");

  // ── Row 11: the Odaroloc, not the Ynnermire ──
  rep("stillwater_crack_4", "At the edge of town, where the road runs out into the Ynnermire,", "At the edge of town, where the road runs out toward the Odaroloc,");
  setChoiceField("stillwater_platform", "Walk the rails out.", "description", "A hundred yards. Then grass. Then the Odaroloc, which has opinions.");

  console.log(`[patch-story-review-grief] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Grief towns DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Grief towns: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-review-grief-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Grief towns APPLIED: ${changes} change(s). Halloween, 2077.`);
})();
