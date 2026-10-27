/* patch-dead-ends-sweep-2026-10-26.macro.js — every remaining dead-end reply in the campaign (Dave, 2026-10-26: "151 please go ahead! 17 please remove").
 *  Why: a choice with next = "" ENDS the routed chain — out of the town / scene — and its answer only ever showed as the button subtitle.
 *  Triage of all 227 such replies on beats that also route somewhere: 59 deliberate endings left alone (fights, ride/saddle up,
 *  "not now / the offer keeps", leaving expedition sites, Stormborn paper handoffs, finale endings), 17 placeholder exits removed,
 *  151 fixed here (FIX list below, reviewed by hand).
 *   FIX     each reply → a new answer beat `ans_<parent>_<slug>`: the old subtitle is its text; its choices = the parent's other
 *           choices (other questions now open their own answers; onward/exit rows copied as-is). It never routes BACK into the
 *           parent: re-entering a beat re-applies its worldEffects (Receipts, meters — the once-memo doesn't ride the chain).
 *           Four replies with no answer text are quiet exits → routed to their hub (QUIET).
 *           Soft Landing's card has no exit of its own → its answers add "Back to the street." (EXTRA_EXIT).
 *   REMOVE  15 "Something else" + 2 bare "Leave" placeholders (the HQ already has "Call it a day").
 *   Answer beats are routing-only: dialogueOffer:false, no questId/story (else the quest log's frontier offers them as the next
 *   step), the parent's act gate + inject.evergreen (an undeclared beat would otherwise seal by act while its declared parent stays
 *   open; the gate keeps the lint's act inference honest), timeScale "moment" + timePoints 0 (a bare "scene" costs a full day).
 *   Also normalizes tonight's 21 Wick answer beats (patch-wick-dead-ends + -2) to the same routing-only shape.
 *  Idempotent; DRY_RUN default true; backs up `campaigns`; true copy via JSON. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const J = (v) => JSON.stringify(v);
  const ch = (label, next, over = {}) => Object.assign({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" }, over);

  const FIX = [["fixit_route_board_pegs","Ask about the wagon."],
    ["fixit_route_board_pegs","Ask who pays for the pegs down the coast."],
    ["fixit_route_board_pegs","Ask what Pip and Patter won't carry."],
    ["lyrenn_plinth_returns","Put a palm on the ground."],
    ["lyrenn_plinth_returns","Ask Rowan what it was waiting for."],
    ["lyrenn_plinth_returns","Say nothing. Let the Ring breathe."],
    ["lyrenn_choir_children","\"Who's in charge?\""],
    ["lyrenn_whisper","\"Where did it come from?\""],
    ["lyrenn_whisper","Write it down."],
    ["founders_garden_the_count","Count the cairns against the three basins."],
    ["bandit_envoy","Take the eel jerky."],
    ["bandit_envoy","Refuse it, politely."],
    ["trojan_paperwork","Ask the clerk what else she has seen like it."],
    ["chuckle_rung_3","\"Try again.\""],
    ["soft_landing_give_3","\"Ask her why she isn't bouncing.\""],
    ["soft_landing_give_3","Feel the ground around her."],
    ["soft_landing_give_3","Offer to bounce with her."],
    ["stillwater_crack_3","\"Sit with him.\""],
    ["chuckle_pie","Ask about the man with the anvil."],
    ["chuckle_piano_kid","\"Eleven thousand and what?\""],
    ["chuckle_piano_kid","\"Does it hurt?\""],
    ["chuckle_piano_kid","Pull him out from under it."],
    ["chuckle_creek_itself","Laugh with it."],
    ["chuckle_creek_itself","Listen for where it starts."],
    ["chuckle_hollis","Tip yours back."],
    ["chuckle_hollis","\"Ask him what year it is.\""],
    ["chuckle_hollis","\"Ask him to stop.\""],
    ["chuckle_projector","Sit and watch."],
    ["chuckle_projector","\"Ask what it plays.\""],
    ["chuckle_projector","Look behind the screen."],
    ["chuckle_projector","\"Ask who runs it.\""],
    ["chuckle_tape_shelf","Let the tape in the deck run to the end."],
    ["chuckle_tape_shelf","Leave it."],
    ["soft_landing_checkpoint","\"Can I have the knife back later?\""],
    ["soft_landing_state_function","Bounce."],
    ["soft_landing_castle","Go in."],
    ["soft_landing_castle","Turn off the blower."],
    ["soft_landing_cake","Make a wish."],
    ["soft_landing_cake","Look at the candles."],
    ["soft_landing_blower","Leave it running."],
    ["soft_landing_card","\"Read it to me.\""],
    ["soft_landing_card","Leave it with her."],
    ["soft_landing_birthday_card","Pocket it."],
    ["stillwater_lemonade","\"Whose nickel is that?\""],
    ["stillwater_bandstand","\"What's the song?\""],
    ["stillwater_paper","Read him the date out loud."],
    ["stillwater_paper","\"What's tomorrow's headline?\""],
    ["stillwater_paper","Keep the paper."],
    ["stillwater_platform","Walk the rails out."],
    ["stillwater_waving","Wave once more."],
    ["stillwater_permit","Show Cal the expiry."],
    ["stillwater_permit","Leave it."],
    ["ag_confessor_pilgrim","\"Where are you headed after St Gilliam's?\""],
    ["ag_confessor_pilgrim","Ask Verna what the star means."],
    ["ag_pipeline_backward","The lights. Note the Mall."],
    ["kt_official_word","Let Calder say it."],
    ["fixit_load_the_crate","Ask about the three doorstops."],
    ["lyrenn_vault_label","Keep the label."],
    ["lyrenn_vault_label","Keep the label. Leave the seeds."],
    ["mall_watch_clip","Watch it to the end."],
    ["mall_watch_clip","Ask who was holding the camera."],
    ["mall_watch_clip","\"That's Marnie.\""],
    ["wt_cult_camp","\"The kettle.\""],
    ["fc_seated","Ask who set the table."],
    ["fc_seated","Ask why your name."],
    ["fc_night_one","Show them the Service Manifest."],
    ["fc_night_one","Show them the Guest List."],
    ["hod_clerk_window","Ask what the permit is for."],
    ["hod_clerk_window","Ask if it's Beaumont."],
    ["hod_clerk_window","Ask what the light wants."],
    ["hod_the_vote","Ask who the nine were."],
    ["hod_the_vote","Ask if she'd vote the same way now."],
    ["hod_dispatcher_booth","Ask what it is trying to finish."],
    ["hod_dispatcher_booth","Tell it the vote was real."],
    ["statues_sexton","Ask what the pickets are grading."],
    ["statues_sexton","Ask who else has been."],
    ["statues_sexton","Ask whose post they're covering."],
    ["statues_sable_bleeding","Ask what the Garden is holding."],
    ["statues_sable_bleeding","Ask what they want you to do at the third."],
    ["balcones_lawn_chair","Ask what it wants."],
    ["balcones_lawn_chair","Ask how long he's been here."],
    ["balcones_complaint","Ask it what would settle the complaint."],
    ["balcones_complaint","Tell it the night wasn't yours."],
    ["siege_culvert_gate","Stand in the doorway and say nothing."],
    ["siege_culvert_sit","Ask about the drainage."],
    ["siege_culvert_sit","Say it: this is the treaty."],
    ["bandit_books","Lay the Caravan Route on the table."],
    ["bandit_books","Show her the Back-Room Roster."],
    ["bandit_books_audit_fail","Apologize to the hall, and decide."],
    ["trojan_the_eleven","Ask who sent them."],
    ["trojan_the_eleven","Ask about the berth."],
    ["trojan_the_eleven","Show them the Sideways Manifest."],
    ["trojan_same_hand","\"The name-cards.\""],
    ["cadence_tempo_at_the_gate","Ask who lettered the card."],
    ["cadence_collection","Close the box."],
    ["cadence_viewing_mound","Buy a refreshment."],
    ["cadence_viewing_mound","Ask which sentries are humming."],
    ["tifaret_the_ring","Ask the forest what it could not improve."],
    ["tifaret_the_ring","Walk the ring once, saying nothing."],
    ["tifaret_heading_confirmed","Leave the ring as it is."],
    ["tifaret_tree_person","Ask what road that is."],
    ["tifaret_tree_person","Ask it to come with you."],
    ["tifaret_tree_person","Say thank you."],
    ["founders_garden_the_sign","You came by the mall's route board."],
    ["founders_garden_the_sign","Look for who re-set it."],
    ["founders_garden_the_sign","Ask about family pricing."],
    ["founders_garden_the_hand","A wave."],
    ["founders_garden_the_hand","A vote."],
    ["founders_garden_the_hand","Hold on."],
    ["founders_garden_the_hand","Reaching for someone who left."],
    ["founders_garden_the_terms","Ask what 'relieved' means."],
    ["founders_garden_the_terms","Hold the Vault Label against the smooth line."],
    ["founders_garden_the_gap","Read the Terms of the Watch aloud, to them."],
    ["finale_the_crates","Ask her what the fuel costs."],
    ["finale_sklar_turns","Ask her the name."],
    ["finale_sklar_turns","Ask her the OTHER name."],
    ["hum_t2_same_two","Ask Coll what the two kinds are."],
    ["hum_t2_same_two","Ask Bit where they're headed."],
    ["hum_t2_quiet_offer","You've met before. Say so."],
    ["hum_t2_quiet_offer","Ask what it costs."],
    ["hum_t2_loud_offer","Count the seats again."],
    ["hum_t2_loud_offer","Ask where the volunteers are from."],
    ["hum_t2_fourth_roof","Knock anyway."],
    ["hum_t2_fourth_roof","Count them back."],
    ["hum_t2_the_post","Cut a notch of your own."],
    ["hum_t2_the_post","Say what you've been taking."],
    ["hum_t2_bee_teller_meet","Ask her to explain the post."],
    ["hum_t2_mask_stack","Count them again."],
    ["hum_t2_mask_stack","Ask who carves the next one."],
    ["ninth_guest_the_name","Say it out loud, once."],
    ["ninth_guest_the_name","Leave the line as he left it."],
    ["odie_korl_gossip","Why doesn't she throw him out?"],
    ["odie_korl_gossip","Has anyone given him an eye?"],
    ["sw_outside","\"The roads.\""],
    ["sw_outside","\"The Battles.\""],
    ["sw_outside","\"The Shattering.\""],
    ["sw_may","\"Ask to see the ticket.\""],
    ["sw_may","\"Ask what he's like.\""],
    ["sw_may","Look up the line."],
    ["cc_corner_table","\"Pour the fourth coffee for her.\""],
    ["cc_ask_about_winnie","\"How old is she?\""],
    ["cc_ask_about_winnie","\"When did you last see her?\""],
    ["cc_ask_about_winnie","\"What was she like as a baby?\""],
    ["cc_walk_with_dewey","\"Ask him what the number is.\""],
    ["cc_walk_with_dewey","\"Ask him where he sleeps.\""],
    ["sl_ask_around","\"Where are you from?\""],
    ["sl_ask_around","\"Who did you come here with?\""],
    ["sl_ask_around","\"What did you do before?\""],
    ["sl_houses","\"Ask to see the family photographs.\""],
    ["sl_houses","\"Ask where the graveyard is.\""],
    ["sl_houses","\"Ask for the oldest thing in the house.\""]];
  const REMOVE = [["allesh_gilliam_introduction_to_hq","Leave"],
    ["allesh_gilliam_introduction_to_hq","Something else"],
    ["allesh_gilliam_the_east_wall_intro","Something else"],
    ["lyrenn_main_scene","Something else"],
    ["khezek_tor_quest_scene","Something else?"],
    ["maneuver_vault_approach","Something Else"],
    ["maneuver_vault_infiltration","Something Else"],
    ["maneuver_vault_infiltration_fail","Something Else"],
    ["maneuver_vault_foyer_of_procedure","Something else"],
    ["maneuver_vault_echo_archive","Something Else"],
    ["maneuver_vault_echo_archive_success","Something else"],
    ["maneuver_vault_slippage_chamber","Something Else"],
    ["maneuver_vault_the_containment_loop","Something else"],
    ["maneuver_vault_the_containment_loop_let_pip_learn","Something else"],
    ["maneuver_vault_the_containment_loop_let_pip_learn_more","Something else"],
    ["enc_hidden_vault_locals","Leave"],
    ["enc_hidden_vault_locals","Something else"]];
  const QUIET = {   // parent|label → hub (no answer text: these are exits that dropped you out of town)
    "soft_landing_birthday_card|Pocket it.": "soft_landing_arrival",
    "lyrenn_vault_label|Keep the label.": "lyrenn_quest_scene",
    "lyrenn_vault_label|Keep the label. Leave the seeds.": "lyrenn_quest_scene",
    "tifaret_heading_confirmed|Leave the ring as it is.": "forest_of_tifaret_merge"
  };
  const EXTRA_EXIT = { soft_landing_card: ch("Back to the street.", "soft_landing_arrival") };
  const WICK_ANSWERS = ["ag_wick_the_order", "ag_wick_trim_dusk", "ag_wick_shrines_later", "ag_wick_the_slate",
    "ag_wick_seen_carry", "ag_wick_seen_pays", "ag_wick_seen_road", "ag_tamsin_wick_wax", "ag_tamsin_wick_chair", "ag_tamsin_wick_real",
    "ag_tamsin_wick_knows", "odie_wick_who_moved", "odie_wick_an_eye", "odie_wick_sklar_knows", "odie_wick_why_tell",
    "ag_wick_room_candles", "ag_wick_room_fibre", "ag_wick_room_times", "ag_wick_shrine_tray", "ag_wick_shrine_next", "finale_wick_the_drops"];

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).slice(0, 5).join("_");
  const ansId = (p, label) => `ans_${p}_${slug(label)}`;
  const title = (p, label) => `${p.label || p.id} — ${String(label).replace(/^["“]+|["”]+$/g, "").replace(/[.!]+$/, "")}`;
  // routing-only shape (shared by new answers and tonight's Wick answers)
  const actOf = (b) => { const r = (b?.inject?.requires || []).find(x => x && x.flag === "storyPhase" && x.gte != null); return r ? Number(r.gte) : null; };
  const shape = (b, act) => { let n = 0;
    const set = (k, v) => { if (J(b[k]) !== J(v)) { b[k] = v; n++; } };
    const del = (k) => { if (k in b) { delete b[k]; n++; } };
    set("dialogueOffer", false); set("timeScale", "moment"); set("timePoints", 0);
    set("inject", { repeatable: true, oncePerHex: false, evergreen: true, requires: act != null ? [{ flag: "storyPhase", gte: act }] : [] });
    del("questId"); del("questStep"); del("story"); del("storyChain"); del("memoryText"); del("pinLeg"); del("where");
    return n; };

  // ── 1. remove the 17 placeholders ─────────────────────────────────────────
  for (const [pid, label] of REMOVE) {
    const p = byId.get(pid); if (!p) { report.push(`⚠ ${pid}: not found`); continue; }
    const i = (p.choices || []).findIndex(c => c && c.label === label && !c.next);
    if (i < 0) { report.push(`· ok ${pid}: "${label}" already gone`); continue; }
    p.choices.splice(i, 1); changes++; report.push(`✂ ${pid}: "${label}" removed`);
  }

  // ── 2. point each dead reply at its answer (or its hub) ────────────────────
  const made = [];   // [parentId, answeredLabel, answerId]
  for (const [pid, label] of FIX) {
    const p = byId.get(pid); if (!p) { report.push(`⚠ ${pid}: not found`); continue; }
    const c = (p.choices || []).find(x => x && x.label === label);
    if (!c) { report.push(`⚠ ${pid}: "${label}" not found`); continue; }
    const hub = QUIET[`${pid}|${label}`];
    if (hub) {
      if (c.next === hub) report.push(`· ok ${pid}: "${label}" → ${hub}`);
      else if (!c.next) { c.next = hub; changes++; report.push(`✚ ${pid}: "${label}" → ${hub} (quiet exit)`); }
      else report.push(`⚠ ${pid}: "${label}" now routes to ${c.next} — left alone`);
      continue;
    }
    const id = ansId(pid, label);
    let a = byId.get(id);
    if (!a) {
      if (c.next) { report.push(`⚠ ${pid}: "${label}" now routes to ${c.next} — left alone`); continue; }
      const text = String(c.description || "").trim();
      if (!text) { report.push(`⚠ ${pid}: "${label}" has no answer text — left alone`); continue; }
      a = { id, label: title(p, label), type: ["dialog", "narration", "exploration"].includes(p.type) ? p.type : "dialog",
        tags: p.tags || "", politicalTags: "", speakerActorId: p.speakerActorId || null, sceneId: p.sceneId || null,
        hexName: p.hexName ?? null, targetHexUuid: p.targetHexUuid ?? null,
        outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, worldEffects: {}, refs: {},
        playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
        description: text, choices: [] };
      shape(a, actOf(p));
      camp.beats.splice(camp.beats.indexOf(p) + 1, 0, a); byId.set(id, a);
      changes++; report.push(`✚ ${id}: new answer beat`);
    }
    if (c.next !== id || c.description) { c.next = id; c.description = ""; changes++; report.push(`✚ ${pid}: "${label}" → ${id}`); }
    made.push([pid, label, id]);
  }

  // ── 3. each answer offers the parent's other choices (never the parent itself) ──
  for (const [pid, label, id] of made) {
    const p = byId.get(pid), a = byId.get(id);
    const want = (p.choices || []).filter(x => x && x.label !== label && x.next !== pid).map(x => JSON.parse(J(x)));
    if (EXTRA_EXIT[pid] && !want.some(x => x.next === EXTRA_EXIT[pid].next)) want.push(JSON.parse(J(EXTRA_EXIT[pid])));
    if (!want.length) report.push(`⚠ ${id}: parent has nothing else to offer`);
    if (J(a.choices) !== J(want)) { a.choices = want; changes++; report.push(`✚ ${id}: ${want.length} choice(s)`); }
  }

  // ── 4. tonight's Wick answers → routing-only shape ─────────────────────────
  for (const id of WICK_ANSWERS) { const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    const n = shape(b, actOf(b)); if (n) { changes++; report.push(`✚ ${id}: routing-only shape (${n} field(s))`); } else report.push(`· ok ${id}: routing-only`); }

  const summary = report.filter(l => !l.startsWith("· ok") && !/: \d+ choice\(s\)$/.test(l) && !/: new answer beat$/.test(l) && !/" → ans_/.test(l));
  console.log(`[dead ends sweep 2026-10-26] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s) · ${made.length} answered · ${report.filter(l => l.startsWith("✂")).length} removed · ${report.filter(l => l.startsWith("⚠")).length} warning(s)\n` + summary.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-dead-ends-sweep-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — no more dead-end replies.`);
})();
