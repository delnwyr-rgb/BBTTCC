/* patch-wick-dead-ends-2-2026-10-26.macro.js — the rest of Wick's dead ends (Dave, 2026-10-26: "let's fix up all the dead ends").
 *  Same shape as patch-wick-dead-ends-2026-10-26: a reply with next = "" ends the routed chain (out of the town / camp / heist),
 *  and its answer was only the button subtitle. Each question now opens a small answer beat (old subtitle = its text) with exits.
 *   ag_wick_seen (Act 2)          3 questions → answers (Ask something else / Leave him to his vigil); "Leave him to his vigil." → the Vacancy desk
 *   ag_tamsin_on_wick (Act 2)     2 questions → answers (More about Wick / Ask something else → Tamsin's table)
 *   ag_tamsin_on_wick_redeemed    "Is any of it real?" → answer (Ask something else)
 *   ag_tamsin_on_wick_pike        "Does Wick know?" → answer (Ask something else)
 *   odie_wick_proud (Act 3)       2 questions → answers (Ask something else / Back to the camp)
 *   odie_wick_the_hour (Act 3)    2 questions → answers that offer the other question + "Take the timetable."; "Take the timetable." → the camp
 *                                 (never routes back into the hour beat itself: it carries the Receipt)
 *   ag_wick_room (Act 2 heist)    3 searches → answers (Keep looking / Put everything back square); "Put everything back square." → the Vacancy desk
 *   ag_wick_shrine (Act 2 road)   2 looks → answers that offer the other look + "Ride on." ("Ride on." stays an ending: it hands back to the ride)
 *   finale_wick_at_the_gate       "Ask him what was in the drops." → answer offering the two endings (the endings stay endings: it's the epilogue)
 *  Also: dialogueOffer:false on every answer beat (round 1's four too) — a speaker beat with choices is otherwise offered as a
 *  conversation opener on its own. Answer beats are built from a whitelist (no memoryText / storyChain / pinLeg / effects copied).
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
  const need = (id) => { const b = byId.get(id); if (!b) report.push(`⚠ ${id}: not found`); return b; };
  const ch = (label, next, over = {}) => Object.assign({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" }, over);
  const findC = (b, label) => (b?.choices || []).find(x => x && x.label === label);

  const VACANCY = "allesh_gilliam_vacancy_intro", TAMSIN = "allesh_gilliam_father_tamsin_conversation", CAMP = "wt_cult_camp";

  // answer beat built from a whitelist of the parent (speaker/scene/quest/act gate only)
  const mkAnswer = (p, id, label, description) => {
    const act = Number((p.inject?.requires || []).find(r => r && r.flag === "storyPhase" && r.gte != null)?.gte) || 1;
    return {
      id, label, type: p.type === "exploration" ? "exploration" : "dialog", timeScale: p.timeScale || "scene",
      tags: p.tags || "", politicalTags: "", questId: p.questId || null, questStep: p.questStep ?? null, story: p.story ? JSON.parse(J(p.story)) : undefined,
      speakerActorId: p.speakerActorId || null, sceneId: p.sceneId || null, hexName: p.hexName ?? null, targetHexUuid: p.targetHexUuid ?? null,
      outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, worldEffects: {}, refs: {},
      inject: { repeatable: true, oncePerHex: false, requires: [{ flag: "storyPhase", gte: act }] }, dialogueOffer: false, timePoints: 0,
      playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      description, choices: []
    };
  };
  // parent's choice `label` → new answer beat `id` (text = description), exits = choices()
  const answer = (parentId, label, id, title, description, exits) => {
    const p = need(parentId); if (!p) return;
    const c = findC(p, label); if (!c) return report.push(`⚠ ${parentId}: choice ${label} not found`);
    let nb = byId.get(id);
    if (!nb) {
      nb = mkAnswer(p, id, title, description); nb.choices = exits();
      camp.beats.splice(camp.beats.indexOf(p) + 1, 0, nb); byId.set(id, nb);
      changes++; report.push(`✚ ${id}: new answer beat (${title})`);
    } else report.push(`· ok ${id} exists`);
    if (c.next === id && !c.description) return report.push(`· ok ${parentId}: ${label} → ${id}`);
    c.next = id; c.description = ""; changes++; report.push(`✚ ${parentId}: ${label} → ${id}`);
  };
  // a closing choice that ended the chain → route it home (its subtitle stays: it's how you leave)
  const routeExit = (parentId, label, next) => { const p = need(parentId); if (!p) return; const c = findC(p, label);
    if (!c) return report.push(`⚠ ${parentId}: choice ${label} not found`);
    if (c.next === next) return report.push(`· ok ${parentId}: ${label} → ${next}`);
    c.next = next; changes++; report.push(`✚ ${parentId}: ${label} → ${next}`); };

  // ── ag_wick_seen (Act 2, the Vacancy) ──────────────────────────────────────
  const seenExits = () => [ch("Ask something else.", "ag_wick_seen"), ch("Leave him to his vigil.", VACANCY)];
  answer("ag_wick_seen", "What do you carry up there?", "ag_wick_seen_carry", "Allesh-Gilliam — What He Carries",
    "\"Paper. Folded small, the same way every time. I do not read it. A courier who reads is a spy, and I have been many things on that road but not that.\"\n\nA pause the length of a schedule.\n\n\"Not yet.\"", seenExits);
  answer("ag_wick_seen", "Who pays exact for that?", "ag_wick_seen_pays", "Allesh-Gilliam — Who Pays Exact",
    "\"The hour pays. I carry for the hour.\"\n\nHe will not say a name in a room with a ledger in it. \"Names carry. I carry. One of us is enough.\"", seenExits);
  answer("ag_wick_seen", "We could have stopped you on the road.", "ag_wick_seen_road", "Allesh-Gilliam — The Nod on the Switchbacks",
    "\"You could have. You didn't. I noticed that too.\"\n\nHe looks at his boots, lined up toward the door. \"I am a man who notices when the hour moves. It moved on the switchbacks. I have not decided yet which way.\"", seenExits);
  routeExit("ag_wick_seen", "Leave him to his vigil.", VACANCY);

  // ── Father Tamsin on Wick (Act 2, St Gilliam's) ────────────────────────────
  const tamsinExits = () => [ch("Ask more about Wick.", "ag_tamsin_on_wick"), ch("Ask something else.", TAMSIN)];
  answer("ag_tamsin_on_wick", "\"Why only the wax candles?\"", "ag_tamsin_wick_wax", "Allesh-Gilliam — Father Tamsin on the Wax",
    "\"Are they?\" He looks at the nearest one as if it might answer. \"He brings his own. I assumed it was devotion. Everything he does, I assume is devotion. That's rather the point of him.\"\n\nThe kettle goes back on the hob a little hard.", tamsinExits);
  answer("ag_tamsin_on_wick", "\"You know a lot about him.\"", "ag_tamsin_wick_chair", "Allesh-Gilliam — Father Tamsin's Chair",
    "\"I know a lot about everyone. It's the chair. People sit in it and tell me things, and I remember them, because remembering is most of what the job is.\"", tamsinExits);
  answer("ag_tamsin_on_wick_redeemed", "\"Is any of it real?\"", "ag_tamsin_wick_real", "Allesh-Gilliam — Father Tamsin, Is Any of It Real",
    "\"He trims well. I've watched him a hundred times. A person can be careful with a thing he doesn't believe in.\"\n\nA small, tired smile. \"I would know.\"", () => [ch("Ask something else.", TAMSIN)]);
  answer("ag_tamsin_on_wick_pike", "\"Does Wick know?\"", "ag_tamsin_wick_knows", "Allesh-Gilliam — Father Tamsin, Does Wick Know",
    "\"He knows the candle moved on time. That's all he has ever needed to know.\"", () => [ch("Ask something else.", TAMSIN)]);

  // ── The Odie camp (Act 3) ──────────────────────────────────────────────────
  const proudExits = () => [ch("Ask something else.", "odie_wick_proud"), ch("Back to the camp.", CAMP)];
  answer("odie_wick_proud", "Who moved it?", "odie_wick_who_moved", "Who Moved the Hour",
    "\"The one who shouts.\"\n\nHe will not say a name at a camp. \"Names carry. I carry. One of us is enough.\"", proudExits);
  answer("odie_wick_proud", "Has he asked you for an eye?", "odie_wick_an_eye", "Twice",
    "\"Twice. I need both for the road.\"\n\nA pause the length of a schedule. \"He said that was what everybody says. He sounded very tired.\"", proudExits);

  const TIMETABLE = "He is already walking back, on time for the next thing, which is nothing.";
  answer("odie_wick_the_hour", "Ask what Sklar knows.", "odie_wick_sklar_knows", "What Sklar Knows",
    "\"She knows the rope is wrong. She doesn't know the hour. Nobody told her.\"\n\nHe considers. \"I'm telling you. I notice that.\"",
    () => [ch("Ask him why he's telling you.", "odie_wick_why_tell"), ch("Take the timetable.", CAMP, { description: TIMETABLE })]);
  answer("odie_wick_the_hour", "Ask him why he's telling you.", "odie_wick_why_tell", "Why He's Telling You",
    "\"Because the hour moved. A courier can forgive anything but that.\"\n\nHe puts the slate away. \"I haven't forgiven it. I am just early.\"",
    () => [ch("Ask what Sklar knows.", "odie_wick_sklar_knows"), ch("Take the timetable.", CAMP, { description: TIMETABLE })]);
  routeExit("odie_wick_the_hour", "Take the timetable.", CAMP);

  // ── The pilgrim's room (Act 2 heist) ───────────────────────────────────────
  const roomExits = () => [ch("Keep looking.", "ag_wick_room"), ch("Put everything back square.", VACANCY, { description: "Military-square, the way he left it. He would notice anything else." })];
  answer("ag_wick_room", "Count the candles again.", "ag_wick_room_candles", "The Pilgrim's Room — Forty-One",
    "Forty-one. Nobody's devotion needs forty-one. A schedule might.", roomExits);
  answer("ag_wick_room", "Hold the fibre up to the light.", "ag_wick_room_fibre", "The Pilgrim's Room — The Fibre",
    "Cut to fit a drip tray, waxed on one side so a fold arrives dry. Someone sends small things this way and wants them to arrive in one piece.", roomExits);
  answer("ag_wick_room", "Read the times.", "ag_wick_room_times", "The Pilgrim's Room — The Times",
    "St Gilliam's at dusk. The first switchback by midnight. Then hours you'd have to climb all night to keep.\n\nHe keeps them.", roomExits);
  routeExit("ag_wick_room", "Put everything back square.", VACANCY);

  // ── The first shrine (Act 2, on the ride) — "Ride on." stays an ending: it hands back to the ride ──
  const RIDE = "Up the switchbacks. The next shrine is where he said it would be, and the one after that.";
  answer("ag_wick_shrine", "Look closer at the drip tray.", "ag_wick_shrine_tray", "Khezek Switchbacks — The Drip Tray",
    "Same make as St Gilliam's. Same scrape. Whatever was folded here was folded small.",
    () => [ch("Climb to the next one.", "ag_wick_shrine_next"), ch("Ride on.", "", { description: RIDE })]);
  answer("ag_wick_shrine", "Climb to the next one.", "ag_wick_shrine_next", "Khezek Switchbacks — The Next Shrine",
    "Another stub, another tray, another scrape. The road goes all the way up to Khezek Tor, and so do the shrines.",
    () => [ch("Look closer at the drip tray.", "ag_wick_shrine_tray"), ch("Ride on.", "", { description: RIDE })]);

  // ── Finale epilogue — the two endings stay endings; the question gets an answer first ──
  { const p = need("finale_wick_at_the_gate");
    const ends = () => (p?.choices || []).filter(x => x && x.label !== "Ask him what was in the drops.").map(x => JSON.parse(J(x)));
    answer("finale_wick_at_the_gate", "Ask him what was in the drops.", "finale_wick_the_drops", "After — What Was in the Drops",
      "\"Instructions. Folded the same way. I never read them; a courier who reads is a spy.\"\n\nHe considers this. \"I suppose I was that as well. I read the last one. It asked for an eye.\"", ends); }

  // ── dialogueOffer:false on every answer beat (round 1 included) ────────────
  for (const id of ["ag_wick_the_order", "ag_wick_trim_dusk", "ag_wick_shrines_later", "ag_wick_the_slate"]) {
    const b = need(id); if (!b) continue;
    if (b.dialogueOffer === false) report.push(`· ok ${id}: routing only`);
    else { b.dialogueOffer = false; changes++; report.push(`✚ ${id}: dialogueOffer:false (routing only)`); }
  }

  console.log(`[wick dead ends 2 2026-10-26] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-wick-dead-ends-2-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — none of Wick's questions end the scene now.`);
})();
