/* patch-r3-act1-2026-10-20.macro.js — Dave's Act 0–1 read-through notes of 2026-10-20 (evening), four items:
 *
 *  1  ag_title_card   "There is no guarantee that the players will be away from Allesh Gilliam. The text should know where the
 *                      stewards are." → the Title Card's after-text uses the NEW {{#at Allesh-Gilliam}}…{{else}}…{{/at}} story token
 *                      (module.js, same day): in town it says the lists are waiting and Pike's runner is already looking; away it
 *                      says back to town.
 *  2  ag_plumb_cracks "I don't think I understand why there are two different things here with the same prompts" — the two
 *                      "Give us the note" rows are one choice with two exits: the table that has caught Wick's WAX tell (any tallow
 *                      secret-check hit) gets `ag_plumb_note_taken` (the Receipt is armed); a table that has not gets `_plain`.
 *                      Only one row ever shows. Their after-texts now differ so the doc (and the GM) can tell them apart.
 *  3  ag_plumb_to_the_wall  "Who are the crew that are writing this? What do those statements mean?" — the NOT US paragraph now
 *                      names Pike's wall crew, says what NOT US means (not their welding, and they knew it), and why the second
 *                      patch was laid crooked. Dave to wordsmith.
 *  4  story.quest on 28 Act-1 beats that had none (the Reliable lease chain, Wick's shrines and the heist, Father Tamsin on Wick,
 *                      the first signature) so the Beat Polish doc files them in walk order after their parents instead of in a
 *                      "no script step" heap at the bottom of the tab. Nothing in play reads story.quest (doc order only).
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
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };
  const repChoice = (id, pick, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const c = (b.choices || []).find(pick);
    if (!c) { report.push(`⚠ ${id}: choice not found for "${note}"`); return; }
    if (c.description === to) { report.push(`· ok ${id}: ${note}`); return; }
    c.description = to; changes++; report.push(`✚ ${id}: ${note}`);
  };

  /* 1 · the Title Card knows where you are */
  repChoice("ag_title_card", c => /trouble starts/i.test(String(c?.label || "")),
    "{{#at Allesh-Gilliam}}The lists are waiting, and Pike's runner is already looking for you.{{else}}Back to town — where the lists are waiting.{{/at}}",
    "Title Card after-text knows whether you are in town");

  /* 2 · the two note rows read differently */
  repChoice("ag_plumb_cracks", c => c?.next === "ag_plumb_note_taken", "He lets go of it like it was hot. The seal is wax, and you already know what wax means in this town.", "note row (wax caught): after-text");
  repChoice("ag_plumb_cracks", c => c?.next === "ag_plumb_note_taken_plain", "He lets go of it like it was hot. Sealed, folded small, the paper of somebody who expects to be obeyed.", "note row (plain): after-text");

  /* 3 · NOT US, explained */
  rep("ag_plumb_to_the_wall",
    "<p>\"Two. The same span has been patched twice, by the same crew, and they chalked their opinion on the inside face where I would never look. It says NOT US. The second patch was laid crooked on purpose. So the lean would show. So somebody would COME.\" He looks at the wall like it is the first honest thing he has met in this town. \"It wanted to be caught.\"</p>",
    "<p>\"Two. That span has been patched twice, both times by Pike's own wall crew, and the second time they chalked a message on the inside face, where a Structural Authority from CANADA would never look. It says NOT US. Meaning the lean is not their welding, and they knew it, and nobody was going to take a wall crew's word over a man with a certificate. So they laid the second patch crooked. On purpose. So the lean would show from the street. So somebody would finally COME and ask.\" He looks at the wall like it is the first honest thing he has met in this town. \"The wall wanted to be caught leaning. The crew made sure it was.\"</p>",
    "NOT US — Pike's wall crew, what the chalk means, why the crooked patch");

  /* 4 · story.quest for the keyless Act-1 chains */
  const QUEST = {
    allesh_gilliam: ["ag_wick_the_flame", "ag_wick_the_shrines", "ag_wick_shrine", "ag_wick_the_bed", "ag_wick_room", "ag_wick_room_heist_offer", "ag_wick_room_caught", "ag_vacancy_upstairs",
      "ag_tamsin_on_wick", "ag_tamsin_on_wick_redeemed", "ag_tamsin_on_wick_pike", "ag_tamsin_on_wick_exposed",
      "ag_first_signature", "reliable_the_lease", "reliable_lease_terms", "reliable_lease_home", "rc_gearbox_coffee", "reliable_lease_last_turn", "reliable_lease_lapsed"],
    fixit_farm: ["reliable_price", "reliable_bought", "reliable_gearbox_signs", "reliable_lease_parley", "reliable_parley_renewed", "reliable_parley_keys", "reliable_parley_stalemate", "reliable_parley_lost"]
  };
  for (const [q, ids] of Object.entries(QUEST)) for (const id of ids) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    const cur = b.story && typeof b.story === "object" ? b.story : {};
    if (cur.quest === q) { report.push(`· ok ${id}: story.quest ${q}`); continue; }
    if (cur.quest) { report.push(`⚠ ${id}: already ${cur.quest} — left alone`); continue; }
    b.story = { ...cur, quest: q }; changes++; report.push(`✚ ${id}: story.quest → ${q}`);
  }

  console.log(`[r3 act1 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-r3-act1-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Act 1 read-through, round 3.`);
})();
