/* patch-beat-polish-act01c-2026-10-20.macro.js — Dave's THIRD round of Beat Polish doc edits of 2026-10-20 (Act 0–1 tab), found by the
 *  pre-rebuild export diff (13 chunks changed since the evening swap; 11 applied here, 2 held back):
 *
 *   thatwards_ho_opening_scene              the "ninth training thing" paragraph is cut; "having a bad time" in italics
 *   allesh_gilliam_father_tamsin_conversation_3   + "But also I'm not actually a priest of anything."
 *   ag_confessor_counterfeit                "pre-recorded footage on loop"; "it costs exactly this:"
 *   ag_pipeline_garren_reads                "Keep that. Nothing there is an accident."
 *   allesh_gilliam_wall_stands_straight     "No more pouting." (Dave typed "puting" — read as pouting)
 *   fixit_cinematic_intro                   the corpse line and "So is the math." are cut
 *   rc_gully_third_round                    "darling" → "dolls" in the Chupacabra-story line
 *   fixit_general_store_coversation         Mara described (excitable, middle-aged Jackalope lady in overalls) + "Meet Mara Quickhands."
 *   fixit_late_run_fail                     cruellest → cruelest
 *   khezek_tor_sable_welcome                "You walk loud. It's ok."
 *   khezek_tor_mine_that_answered_back_seal "a goddamned medal"
 *   HELD: fixit_mystery_bin_fail choice note "Need to add Item Self Warming Sock" (a task, not player text — see chat);
 *         khezek_tor_mine_that_answered_back_open memory line gained a stray "**L**et**'s**" keystroke (left as it was).
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
    if (to && !from.includes(to) && d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }   // already there (and `to` is not just a piece of `from`)
    if (d.includes(from)) { b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; }
    if (to === "" || d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    report.push(`⚠ ${id}: baseline text not found for "${note}"`);
  };

  rep("thatwards_ho_opening_scene", "This is like, what, your ninth training thing so far? Sorry for all the words! Almost done! For some values of done.\n\n", "", "the ninth-training-thing paragraph is cut");
  rep("thatwards_ho_opening_scene", "is probably having a bad time.", "is probably having a <i>bad time</i>.", "bad time, italics");
  rep("allesh_gilliam_father_tamsin_conversation_3", "I’m aware that isn’t a very theological answer. I’m bad at those.”", "I’m aware that isn’t a very theological answer. I’m bad at those. But also I'm not actually a priest of anything.”", "not actually a priest of anything");
  rep("ag_confessor_counterfeit", "has started showing it paintings. It is an advantage, a real one, and it costs exactly what it looks like it costs:", "has started showing it pre-recorded footage on loop. It is an advantage, a real one, and it costs exactly this:", "pre-recorded footage on loop");
  rep("ag_pipeline_garren_reads", "\"Keep that. Anyone who runs a gate will want to see it, and the ones who don't will want it more.\"", "\"Keep that. Nothing there is an accident.\"", "Garren: nothing there is an accident");
  rep("allesh_gilliam_wall_stands_straight", "The wall stands the way walls are supposed to stand, like it never had an opinion.", "The wall stands the way walls are supposed to stand. No more pouting.", "no more pouting");
  rep("fixit_cinematic_intro", "From the road, the place looks like a corpse that refused to lie down.\n\n", "", "the corpse line is cut");
  rep("fixit_cinematic_intro", "The generators are running.\n\nSo is the math.", "The generators are running.", "so is the math — cut");
  rep("rc_gully_third_round", "“Everybody down there knows a Chupacabra story, darling.", "“Everybody down there knows a Chupacabra story, dolls.", "dolls");
  rep("fixit_general_store_coversation", "There is no price list. Mara, or whoever stands here, looks at you for a while", "There is no price list. An excitable, middle aged Jackalope lady in overalls looks at you for a while", "Mara described");
  rep("fixit_general_store_coversation", "the way a ledger would if ledgers hummed.", "the way a ledger would if ledgers hummed.\n\nMeet Mara Quickhands.", "Meet Mara Quickhands");
  rep("fixit_late_run_fail", "it is the cruellest thing anyone says about Thistle all day", "it is the cruelest thing anyone says about Thistle all day", "cruelest");
  rep("khezek_tor_sable_welcome", "\"You walk loud. That's not a criticism. It's data.\"", "\"You walk loud. It's ok.\"", "Sable: it's ok");
  rep("khezek_tor_mine_that_answered_back_seal", "which from Calder is a medal.", "which from Calder is a goddamned medal.", "a goddamned medal");

  console.log(`[beat-polish act01c 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-beat-polish-act01c-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Beat Polish Act 0–1, round three.`);
})();
