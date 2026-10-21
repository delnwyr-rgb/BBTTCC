/* patch-wick-seen-good-room-2026-10-20.macro.js — two Allesh-Gilliam fixes (Dave, 2026-10-20 evening):
 *
 *  1  "Does Wick ever admit to being busted because the stewards saw him?" — he never did. `kt_courier_has_a_face` (the toll-post
 *     sighting after the Upper Galleries) wrote a mark nothing read; the next Wick beat was the cult camp in Act 3.
 *     NEW  ag_wick_seen   at the Vacancy, Act 2, once, after the sighting: Wick acknowledges it the only way a courier can — he does
 *                         not lie and he does not explain. Three questions, each answered in the courier's code (the road, the paper,
 *                         the hour). Being seen now counts as suspicion: `ag_wick_seen` joins the anyOf on `ag_confessor_dead_drop`.
 *
 *  2  "let's keep consistent and move the beats back to Allesh Gilliam. They're part of the first convo with Greeley." —
 *     `kt_good_room`, `kt_back_room_roster`, `kt_good_room_fail` take story.quest allesh_gilliam and "Allesh-Gilliam —" labels (the doc
 *     files them under the town); the Khezek-Tor script step "The Good Room" is marked borrow:true (live + story-scripts.js) so the
 *     quest log keeps the Cough chain in order; Greeley's first conversation (`ag_greeley_answer_cough`) and the Waiting Room intro
 *     gain the door "Put the manifest on the bar." (needs the dropped manifest + the Official Word quest open; hidden once the roster
 *     has been read).
 *
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
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });

  /* 1 · Wick, seen ─────────────────────────────────────────────────────────── */
  const SEEN = "ag_wick_seen", WICK = "Vv8mDrdsPJnCBLeA", VACANCY = "YVDerfXKLjIciku1";
  if (!byId.get(SEEN)) {
    const nb = {
      id: SEEN, label: "Allesh-Gilliam — The Pilgrim Who Was Seen", type: "dialog", timeScale: "scene", timePoints: 0,
      questId: "quest_Cq1v3hJpXarX5rXJ", tags: "allesh_gilliam wick courier story", politicalTags: "",
      description: "He is in the corner with his boots off and lined up square, and this time he does not stand when you come in. He has been waiting for you to come in. That is the difference.\n\n\"You were on the switchbacks,\" he says, before you can. \"I was on the switchbacks. The road is not a secret. It is a road.\" He says it without heat, the way he pays, exact to the mark. \"I nodded. You nodded. I have thought about that nod for two days, which is more than I have thought about most things.\"\n\nHe does not ask what you were doing up there. He assumes you know what he was doing up there. He is a courier; he has never once been asked, and he is finding out what it is like.\n\n\"I do not lie,\" he says. \"I would like that noted somewhere. I also do not explain. Those are the two halves of the job, and I have kept both since the night of the Cough. If you are going to ask, ask. I will tell you exactly as much as I carry.\"",
      memoryText: "Back at the Vacancy, Wick admitted the switchbacks before the Stewards could raise them: he does not lie, he does not explain, he carries paper for the hour. He has thought about the nod for two days.",
      outcomes: { success: null, failure: null },
      inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
        requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: "kt_courier_has_a_face" }, { beatMark: "ag_confessor_relief", not: true }] },
      actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      sceneId: VACANCY, speakerActorId: WICK, priority: "high", storyChain: "allesh_gilliam", story: { quest: "allesh_gilliam" },
      choices: [
        ch("What do you carry up there?", "", "\"Paper. Folded small, the same way every time. I do not read it. A courier who reads is a spy, and I have been many things on that road but not that.\" A pause the length of a schedule. \"Not yet.\""),
        ch("Who pays exact for that?", "", "\"The hour pays. I carry for the hour.\" He will not say a name in a room with a ledger in it. \"Names carry. I carry. One of us is enough.\""),
        ch("We could have stopped you on the road.", "", "\"You could have. You didn't. I noticed that too.\" He looks at his boots, lined up toward the door. \"I am a man who notices when the hour moves. It moved on the switchbacks. I have not decided yet which way.\""),
        ch("Leave him to his vigil.", "", "He nods, the way pilgrims nod. Polite. Unhurried. Not, this time, already elsewhere.")
      ],
      worldEffects: {}
    };
    const anchor = byId.get("ag_wick_the_bed"); const at = anchor ? camp.beats.indexOf(anchor) + 1 : camp.beats.length;
    camp.beats.splice(at, 0, nb); byId.set(SEEN, nb); changes++; report.push(`✚ beat ${SEEN} — ${nb.label}`);
  } else report.push(`· ok ${SEEN}: present`);
  {
    const dd = byId.get("ag_confessor_dead_drop");
    const rq = dd && Array.isArray(dd.inject?.requires) ? dd.inject.requires : null;
    const grp = rq && rq.find(r => r && Array.isArray(r.anyOf) && r.anyOf.some(x => x && x.beatMark === "ag_tallow_courier_hit"));
    if (!grp) report.push("⚠ dead drop: suspicion anyOf not found");
    else if (grp.anyOf.some(x => x && x.beatMark === SEEN)) report.push("· ok dead drop: being seen counts");
    else { grp.anyOf.push({ beatMark: SEEN }); changes++; report.push("✚ dead drop: being seen on the switchbacks counts as suspicion"); }
  }

  /* 2 · the Good Room goes home ───────────────────────────────────────────── */
  const ROOM = { kt_good_room: "Allesh-Gilliam — The Good Room", kt_back_room_roster: "Allesh-Gilliam — The Back-Room Roster", kt_good_room_fail: "Allesh-Gilliam — The Room Stays Shut" };
  for (const [id, label] of Object.entries(ROOM)) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    let n = 0;
    if ((b.story || {}).quest !== "allesh_gilliam" || (b.story || {}).chapter) { const st = { ...(b.story || {}), quest: "allesh_gilliam" }; delete st.chapter; b.story = st; n++; }   // the_official_word is a Khezek-Tor chapter
    if (b.label !== label) { b.label = label; n++; }
    if (n) { changes += n; report.push(`✚ ${id}: Allesh-Gilliam (quest + label)`); } else report.push(`· ok ${id}`);
  }
  {
    const st = (camp.story?.scripts?.khezek_tor?.steps || []).find(s => s.id === "room");
    if (!st) report.push("⚠ khezek_tor step 'room' not found");
    else if (st.borrow === true && /Waiting Room/.test(String(st.label || ""))) report.push("· ok khezek_tor step 'room': borrowed");
    else { st.borrow = true; st.label = "The Good Room (the Waiting Room, Allesh-Gilliam)"; changes++; report.push("✚ khezek_tor step 'room': borrow:true, label names the place"); }
  }
  const DOOR = () => ch("Put the manifest on the bar.", "kt_good_room", "The back room has been shut since the Cough. The manifest is the reason she has been waiting for.",
    { requires: [{ beatMark: "kt_dropped_manifest" }, { questBucket: "quest_kt_official_word", is: "active" }, { beatMark: "kt_back_room_roster", not: true }] });
  for (const id of ["ag_greeley_answer_cough", "allesh_gilliam_waiting_room_intro"]) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => c?.next === "kt_good_room")) { report.push(`· ok ${id}: manifest door`); continue; }
    const leave = b.choices.findIndex(c => /^(leave|back to the round)/i.test(String(c?.label || "")));
    if (leave >= 0) b.choices.splice(leave, 0, DOOR()); else b.choices.push(DOOR());
    changes++; report.push(`✚ ${id}: "Put the manifest on the bar." → the Good Room (gated on the manifest + the Official Word)`);
  }

  /* 3 · The Files, Filed knows how the word was given (Dave: "Again we are stating something that doesn't know how the issue was resolved") */
  {
    const b = byId.get("kt_pulled_files_filed");
    const from = "The word the outfit gave is provable now, and the crews, who heard it thin or heard it whole, hear it again, and eat.";
    const to = "{{#played kt_official_word_given}}The word the outfit gave at the cookline, names and all, is provable now; the crews who heard it whole hear it again with a date under it, and eat.{{/played}}{{#played kt_official_word_thin}}The word the outfit gave at the cookline was thin, a knowing with nothing in its hands. Now it has a folder and a date, and the crews who nodded at it like weather hear it again, and stop nodding, and eat.{{/played}}";
    if (!b) report.push("⚠ kt_pulled_files_filed: not found");
    else if (String(b.description).includes("{{#played kt_official_word_given}}")) report.push("· ok kt_pulled_files_filed: knows");
    else if (!String(b.description).includes(from)) report.push("⚠ kt_pulled_files_filed: baseline not found");
    else { b.description = b.description.replace(from, to); changes++; report.push("✚ kt_pulled_files_filed: given / thin as played-spans"); }
  }

  console.log(`[wick-seen-good-room 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-wick-seen-good-room-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Wick was seen; the Good Room is Greeley's.`);
})();
