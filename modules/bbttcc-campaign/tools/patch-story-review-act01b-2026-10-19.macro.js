/* patch-story-review-act01b-2026-10-19.macro.js — STORY REVIEW LEDGER, "Act 0–1 findings" rows 1–35, ALL Accept (Dave, 2026-10-19)
 *  Rows 3 (the playtest faction ids → @coalition) ships separately as patch-coalition-ids-2026-10-19 (global).
 *  Rows 22 (Master Pike is deliberate) and 23 (Pike already says "Variables") need no change.
 *  Every text edit is guarded by the live baseline (cur===to → ok · cur!==from → ⚠ skip); new beats/choices are keyed by id/label.
 *  Writes `campaigns` and (live only) `quests` (row 20: arrivalGiver). DRY_RUN default true; GM only; backs up `campaigns`.
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
  // description: replace a guarded substring
  const rep = (id, from, to, field = "description") => {
    const b = B(id); if (!b) return;
    const cur = String(b[field] || "");
    if (to ? cur.includes(to) : !cur.includes(from)) return ok(`${id}.${field} already reads the new text`);
    if (!cur.includes(from)) return warn(`${id}.${field}: baseline not found — skipped`);
    b[field] = cur.replace(from, to); add(`${id}.${field}: text`);
  };
  // whole description with baseline guard
  const setDesc = (id, from, to) => {
    const b = B(id); if (!b) return;
    const cur = String(b.description || "");
    if (cur === to) return ok(`${id}: description already set`);
    if (from != null && cur !== from) return warn(`${id}: description moved since the review — skipped`);
    b.description = to; add(`${id}: description`);
  };
  const choiceBy = (b, pred) => (b.choices || []).find(pred);
  const setChoiceField = (id, label, field, to, pred) => {
    const b = B(id); if (!b) return;
    const c = choiceBy(b, pred || (c => c && c.label === label));
    if (!c) return warn(`${id}: choice '${label}' not found`);
    if (c[field] === to) return ok(`${id} › '${label}'.${field} already set`);
    c[field] = to; add(`${id} › '${label}'.${field}`);
  };
  const addChoice = (id, choice, where = "end", afterLabel = null) => {
    const b = B(id); if (!b) return;
    b.choices = b.choices || [];
    if (b.choices.some(c => c && c.label === choice.label && c.next === choice.next)) return ok(`${id}: choice '${choice.label}' exists`);
    if (where === "start") b.choices.unshift(choice);
    else if (where === "after") { const i = b.choices.findIndex(c => c && c.label === afterLabel); b.choices.splice(i < 0 ? b.choices.length : i + 1, 0, choice); }
    else b.choices.push(choice);
    add(`${id}: choice '${choice.label}' → ${choice.next}`);
  };
  const addRequire = (id, cond, label = null) => {
    const b = B(id); if (!b) return;
    let host;
    if (label) { host = choiceBy(b, c => c && c.label === label); if (!host) return warn(`${id}: choice '${label}' not found`); }
    else { b.inject = b.inject || {}; host = b.inject; }
    let reqs = host.requires; if (!Array.isArray(reqs)) reqs = reqs ? [reqs] : [];
    const key = JSON.stringify(cond);
    if (reqs.some(r => JSON.stringify(r) === key)) return ok(`${id}${label ? " › '" + label + "'" : ""}: gate present`);
    host.requires = reqs.concat([cond]); add(`${id}${label ? " › '" + label + "'" : ""}: gate ${key}`);
  };
  const dropRequire = (id, pred, what) => {
    const b = B(id); if (!b) return;
    const reqs = Array.isArray(b.inject?.requires) ? b.inject.requires : [];
    const kept = reqs.filter(r => !pred(r));
    if (kept.length === reqs.length) return ok(`${id}: ${what} already lifted`);
    b.inject.requires = kept; add(`${id}: ${what} lifted`);
  };
  const PF = { playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true };

  // ── Row 1: That One Night gets a road in — title card → a2 → first pay → HQ; first Act-2 script step ──
  setChoiceField("ag_title_card", "The trouble starts", "next", "a2_that_one_night");
  setChoiceField("a2_that_one_night", "Noted.", "next", "ag_first_pay");
  setChoiceField("a2_that_one_night", "Noted.", "description", "By morning the words start arriving. Pike's runner is one of them.");
  {
    const sc = camp.story?.scripts?.allesh_gilliam;
    if (!sc || !Array.isArray(sc.steps)) warn("script allesh_gilliam: steps missing");
    else if (sc.steps.some(s => s && s.id === "that_night")) ok("script allesh_gilliam: step that_night present");
    else { sc.steps.unshift({ id: "that_night", label: "That One Night", line: "Nobody agrees on the hour, only that it was the same hour for everyone. Hear what the night did before Pike tells you what it costs.", beats: ["a2_that_one_night"], borrow: true }); add("script allesh_gilliam: step 'That One Night' inserted first"); }
  }

  // ── Row 2: one old lean, one new jump ──
  rep("allesh_gilliam_the_east_wall_intro", "Ask anyone when the bow started and you get the same answer", "Ask anyone when the bow got bad and you get the same answer");
  rep("ag_plumb_to_the_wall",
    "\"One. The lean did not start with a weld. It started THAT NIGHT. Something under Khezek-Tor pulled, and the wall has been leaning toward it ever since, like a dog toward a kitchen.",
    "\"One. The lean did not start with a weld. It started last winter, when something under Khezek-Tor first pulled, and THAT NIGHT it jumped. The wall has been leaning toward it ever since, like a dog toward a kitchen.");
  rep("ag_plumb_to_the_wall", "the lean began That One Night (something under Khezek-Tor pulled)", "the lean began last winter when something under Khezek-Tor first pulled, and jumped That One Night", "memoryText");
  {
    const b = B("ag_plumb_to_the_wall");
    const r = b && (b.worldEffects?.receipts || []).find(x => x && x.label === "The Lean Began That One Night");
    const from = "The bow did not begin with the Architect's survey or a bad weld. It began the night everyone felt kinda weird: something under Khezek-Tor pulled, and the wall has leaned toward that pull ever since. Produced in court, 'cosmetic' is indefensible and Pike has his root cause.";
    const to = "The bow did not begin with the Architect's survey or a bad weld. It began last winter, when something under Khezek-Tor first pulled, and it jumped the night everyone felt kinda weird. The wall has leaned toward that pull ever since. Produced in court, 'cosmetic' is indefensible and Pike has his root cause.";
    if (!r) warn("ag_plumb_to_the_wall: receipt 'The Lean Began That One Night' not found");
    else if (r.truth === to) ok("ag_plumb_to_the_wall: receipt truth already set");
    else if (r.truth !== from) warn("ag_plumb_to_the_wall: receipt truth moved — skipped");
    else { r.truth = to; add("ag_plumb_to_the_wall: receipt truth (last winter + the jump)"); }
  }
  rep("ag_leygate_visit", "\"It's been remembering wrong since that one night.", "\"It's been remembering wrong since the Cough, and worse since that one night.");

  // ── Row 4: Day's End script line (hexes are assigned off camera; Domain per ruling 16) ──
  {
    const st = camp.story?.scripts?.allesh_gilliam?.arrival?.steps?.find(s => s && s.id === "daysend");
    const to = "Set each Domain's plans, then the GM runs the turn. The River Heart lies open to the south, collapsed, so all of it is on the map already. Ride it when you're ready.";
    if (!st) warn("script allesh_gilliam.arrival: step daysend missing");
    else if (st.line === to) ok("arrival step daysend: line set");
    else if (!/^Divvy the hexes/.test(String(st.line || ""))) warn("arrival step daysend: line moved — skipped");
    else { st.line = to; add("arrival step daysend: line (no more divvying)"); }
  }

  // ── Row 5: Pike's closure counts the hexes the table actually holds ──
  rep("allesh_gilliam_pike_closure", "Three hexes, one working leygate, and a wall that's still bowing but now bowing on record.", "{{coalition.hexCount}} hexes, one working leygate, and a wall that is finally on record.");
  rep("allesh_gilliam_pike_closure", "Three hexes stopped feeling like a dare.", "The hexes stopped feeling like a dare.", "memoryText");
  setChoiceField("allesh_gilliam_pike_closure", "Call it a day — the map has your names on it", "description", "Your hexes, one working leygate, a wall on record. The day is spent.");
  {
    const b = B("allesh_gilliam_pike_closure");
    const q = b && (b.worldEffects?.questEffects || []).find(x => x && x.action === "complete");
    if (q) { const to = "Your hexes, one working leygate, and your names on Pike's map."; if (q.text === to) ok("pike_closure quest text set"); else { q.text = to; add("pike_closure: quest completion text"); } }
  }

  // ── Row 6: the failure beat — Mal, then Pike pours (the success beat already carries Dave's attribution) ──
  rep("allesh_gilliam_east_wall_failure",
    "For what it's worth: the wall didn't beat you. Whatever leaned on it first did. My money says that thing's under Khezek Tor, being someone's future problem. Possibly yours. Prove me wrong; I'd enjoy it.",
    "Pike pours. \"For what it's worth: the wall didn't beat you. Whatever leaned on it first did. My money says that thing's under Khezek Tor, being someone's future problem. Possibly yours. Prove me wrong; I'd enjoy it.\"");

  // ── Row 7: the Muster waits for the militia ──
  addRequire("allesh_gilliam_introduction_to_hq", { questBucket: "quest_ag_town_militia", is: "active" }, "The Muster — Captain Brakk's militia");

  // ── Row 8: the lease card routes back to First Night (the way in already exists) ──
  addChoice("reliable_the_lease", { label: "Back to the evening.", next: "ag_first_night_soma_break", description: "The card goes back under the spanner. The night is still yours.", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "ag_first_night_soma_break" }, { beatMark: "hum_quiet_tent", not: true }] }, "after", "Look around your new home.");

  // ── Row 9: Etta in armor on day one ──
  rep("allesh_gilliam_etta_welcome", "A matronly Menhirkin in an intricate robe intercepts you", "A matronly Menhirkin in an intricate set of armor intercepts you");

  // ── Row 10: the dream choice stops contradicting the kettle ──
  setChoiceField("allesh_gilliam_father_tamsin_conversation", "That night. You had it too — tell me about the dream.", "description", "He said the valley dreams loud. He didn't say what it dreams.");

  // ── Row 11: the gate's cost is a courier, not a body count ──
  rep("allesh_gilliam_marshall_yarrow_convo_1",
    "“It broke. Same night. Stabilizer failed. Stabilizers never fail. That’s their northstar.”",
    "“It broke. Same night. Stabilizer failed. Stabilizers never fail. That’s their northstar.”\n\n“Sent a courier the wrong shape. We got most of him back. Old Handfoot McGee is good people though, even now. He doesn’t mind if you stare.”");

  // ── Row 12: the manifest sentence is earned by the manifest ──
  rep("ag_tamsin_confrontation",
    "<p>He does not mention his brother at the Lift Hall. He does not have to; you have seen the manifest with the middle Tamsin still on it, and you have seen who visits Brennig more than any parish requires. Whatever passes through this room passes up the mountain by a road with family on both ends of it.</p>",
    "");
  addChoice("ag_tamsin_confrontation", { label: "The manifest. The middle Tamsin is still on it.", next: "ag_confessor_relief", description: "He does not mention his brother at the Lift Hall. He does not have to; you have seen the manifest with the middle Tamsin still on it, and you have seen who visits Brennig more than any parish requires. Whatever passes through this room passes up the mountain by a road with family on both ends of it.", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "kt_dropped_manifest" }] }, "after", "\"On the road, mostly.\" Those were his words, Father. You had them.");

  // ── Row 13: the three Act-1 meals keep (cap lifted, Act-2 ways in and out) ──
  const isCap = (r) => r && r.flag === "storyPhase" && r.lte === 1;
  for (const id of ["rc_elsin_supper", "rc_elsin_soured", "rc_bez_bench", "rc_drax_tar"]) {
    dropRequire(id, isCap, "Act-1 cap");
    const b = B(id); if (b) { b.inject = b.inject || {}; if (b.inject.evergreen !== true) { b.inject.evergreen = true; add(`${id}: evergreen (an Act-1 quest beat the Act-2 hubs may route to)`); } else ok(`${id}: evergreen`); }
  }
  const A1 = [{ flag: "storyPhase", lte: 1 }], A2 = [{ flag: "storyPhase", gte: 2 }];
  const gateOld = (id, labels) => { const b = B(id); if (!b) return; for (const c of b.choices || []) { if (labels.includes(c.label) && !c.requires) { c.requires = A1; add(`${id} › '${c.label}': Act-1 exit`); } } };
  gateOld("rc_elsin_supper", ["Offer to wash up", "Say goodnight"]);
  gateOld("rc_elsin_soured", ["Sleep on it", "Leave", "Say goodnight"]);
  gateOld("rc_bez_bench", ["Meet Drax Calder", "Back to the mine's mouth"]);
  gateOld("rc_drax_tar", ["Ask about the chalk marks", "Let him work"]);
  addChoice("rc_elsin_supper", { label: "Back to the rows.", next: "lyrenn_quest_scene", description: "", checkStat: "", checkDC: 0, failNext: "", requires: A2 });
  addChoice("rc_elsin_soured", { label: "Back to the rows.", next: "lyrenn_quest_scene", description: "", checkStat: "", checkDC: 0, failNext: "", requires: A2 });
  addChoice("rc_bez_bench", { label: "Back to the mountain.", next: "khezek_tor_quest_scene", description: "", checkStat: "", checkDC: 0, failNext: "", requires: A2 });
  addChoice("rc_drax_tar", { label: "Back to the mountain.", next: "khezek_tor_quest_scene", description: "", checkStat: "", checkDC: 0, failNext: "", requires: A2 });
  addChoice("lyrenn_quest_scene", { label: "Supper at Elsin's — say grace, briefly", next: "rc_elsin_supper", description: "Zero wasted words. She's counting. (Presence, DC 11)", checkStat: "presence", checkDC: 11, failNext: "rc_elsin_soured", requires: [{ beatMark: "rc_elsin_supper", not: true }, { beatMark: "rc_elsin_soured", not: true }] }, "after", "Talk to Rowan of the Loam");
  addChoice("khezek_tor_quest_scene", { label: "The cookline — eat what Bez gives you", next: "rc_bez_bench", description: "Gray bits and all. Bez nods once — the full Khezek Tor citizenship ceremony.", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "rc_bez_bench", not: true }] }, "after", "The Upper Galleries — follow the courier's route");
  addChoice("khezek_tor_quest_scene", { label: "Drax Calder's tar", next: "rc_drax_tar", description: "It stands up to the spoon. Possibly to a pickaxe.", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "rc_drax_tar", not: true }] }, "after", "The cookline — eat what Bez gives you");

  // ── Row 14: the tent (already on the road out) stops calling a loud town quiet ──
  rep("hum_quiet_tent", "“This town used to be LOUD,” Bit says.", "“This end of town used to be LOUD,” Bit says.");

  // ── Rows 15 + 16: two empty cards ──
  setDesc("allesh_gilliam_st_gilliams_cinematics", "", "St Gilliams. A church that is actually a B&B but is still run by a person whose name begins with \"Father.\" Also someone here has a serious candle problem. You swear you saw a fire station around here somewhere …");
  setDesc("allesh_gilliam_marshall_yarrow_convo", "", "Pike waits. He is good at it.");

  // ── Row 17: the question trees, in character (Pike 1/2/4/echo are Dave's 10-19 text and stay) ──
  setDesc("allesh_gilliam_father_tamsin_conversation_1",
    "He doesn’t answer immediately.\n\n“It wants to not be extracted like an enemy.”\n\nA gentle smile.\n\n“You can feed a town without treating the earth like a battlefield.”",
    "“Not to be mined like an enemy.” He says it to the kettle, not to you, which is how you know he has said it before. “You can feed a town without treating the ground like a battlefield. Khezek-Tor takes. It takes well, I’ll give them that. Nobody up there has ever once said thank you to the rock, and the rock, I think, has started keeping count.”\n\nHe pours. “I’m a priest. Counting is the other fellow’s job. But I notice when something else starts doing it.”");
  setDesc("allesh_gilliam_father_tamsin_conversation_2",
    "“No.”\n\nA pause.\n\n“I think it’s tired.”\n\nHe meets your eyes.\n\n“Anger is sharp. Fatigue is worse.”",
    "“Angry? No.” He turns the cup a quarter turn. “Anger is a secondary emotion, you know, like a thing that only follows along behind another thing. And I’m too tired to have more than one emotion at a time right now.”\n\nHe looks at the cup as if it had asked. “Tired. That’s what it is. I know the look. I keep a soup kitchen.”");
  setDesc("allesh_gilliam_father_tamsin_conversation_3",
    "“Less noise.”\n\n“Fewer rushed decisions.”\n\n“More gratitude.”",
    "“Quieter.” He thinks about it properly, which takes a while, and the kettle fills the time. “Fewer things decided in a hurry by people who were going to leave anyway. Somebody saying thank you to the ground and meaning it, out loud, where the ground can hear.”\n\nHe sets the cup down. “I’d settle for the dreams stopping. I’d settle for one night. I’m aware that isn’t a very theological answer. I’m bad at those.”");
  setDesc("allesh_gilliam_father_tamsin_conversation_4",
    "He smiles faintly.\n\n“Because leaving is easier.”\n\nThat’s all he gives.",
    "“Because leaving is easier.” He smiles, faintly, at his own hands. “I’ve done the easy thing once already. It worked out about how you’d expect.”\n\nThat is all he gives you, and the kettle, which has opinions on most subjects, keeps this one to itself.");
  setDesc("allesh_gilliam_father_tamsin_conversation",
    "Father Tamsin senses that you are curious. He folds his hands. And without prompting, tells you his echo story.\n\n“I was a healer.”\n\nA gentle tone.\n\n“There was a night I chose who to save.”\n\nNo bitterness. No drama.\n\n“Someone asked for mercy. I told myself there wasn’t enough.”\n\nA pause.\n\n“There was.”\n\nA longer one. “That was another life. The gate had my family’s name over it then, and the valley went hungry under it, and we called that stewardship.” He does not say the name.\n\nHe meets your eyes kindly.\n\n“I think I’m here to never withhold comfort again.”\n\n“And to see if the mountain can forgive.”\n\nHe reaches for the kettle and misses it by an inch, the way a man does on no sleep. The hands remember where it should be; the eyes are somewhere else.\n\n“Forgive me. The valley has been dreaming loud again, since that night. It always did, before.” He finds the kettle on the second try. “I don't suppose you'd want to hear about it. People don't, mostly. I tell them anyway.”",
    "Father Tamsin can tell you are curious. He folds his hands and tells you his echo story without being asked, which is a thing priests do, and most of them know it.\n\n“I was a healer. There was a night I chose who to save. Someone asked for mercy and I told myself there wasn’t enough.” He lets that sit exactly as long as it deserves. “There was.”\n\n“That was another life. The gate had my family’s name over it then, and the valley went hungry under it, and we called that stewardship.” He does not say the name. He meets your eyes, and kindly. “I think I’m here to never withhold comfort again. And to see if the mountain can forgive.”\n\nHe reaches for the kettle and misses it by an inch, the way a man does on no sleep. The hands remember where it should be; the eyes are somewhere else.\n\n“Forgive me. The valley has been dreaming loud again, since that night. It always did, before.” He finds the kettle on the second try. “I don't suppose you'd want to hear about it. People don't, mostly. I tell them anyway.”");
  setDesc("allesh_gilliam_etta_bloom_conversation_echo",
    "She laughs softly.\n\n“Oh, sweet summer children.”\n\n“You think I spun out incomplete?”\n\nShe tilts her head.\n\n“I was a treasurer once. Pre-Shattering or post, doesn’t matter.”\n\n“I balanced something that wasn’t meant to balance.”\n\nHer eyes flick toward the coastline.\n\n“I moved debt.”\n\nA pause.\n\n“Not money. Consequence.”\n\nShe smooths a crate edge.\n\n“I think I’m here to watch what happens when it comes due.”\n\nA faint smile.\n\n“And to make sure it lands where it teaches the right lesson.”",
    "She laughs, softly, the way you laugh at a child who has asked whether the sea is deep.\n\n“Oh, sweet summer children. You think I spun out incomplete?” She tilts her head, deciding how much of this you can carry. “I was a treasurer once. Pre-Shattering or post, it doesn’t matter which; the job doesn’t change. I balanced something that was never meant to balance.”\n\nHer eyes flick toward the coast road, and back, and she smooths a crate edge that did not need smoothing.\n\n“I moved debt, my dears. Not money. Consequence. A great deal of it, to places it wasn’t owed.” A pause, and a smile with not much in it. “I think I’m here to watch what happens when it comes due. And to make sure it lands where it teaches the right lesson.”");
  // Pike 3 comes back with the stopwatch (Dave's text in the chip note); the question Dave cut on 10-19 returns under a new label
  setDesc("allesh_gilliam_marshall_yarrow_convo_3",
    "“Pick something visible.”\n\n“Finish it.”\n\n“No speeches.”\n\nHe folds his arms.\n\n“If people see follow-through once, they’ll lend you patience twice.”",
    "“Pick something people can see from the wall. Finish it. Don’t make a speech about it, and if you must, make it short, because I’ll be timing you.”\n\nThere is now a stopwatch function flashing on one of the menu boards. With your names on them, and words flashing in red beside them saying things like SLOW and STILL IN HQ FOR SOME REASON.");
  addChoice("allesh_gilliam_marshall_yarrow_convo", { label: "AJ said keep one promise. Which one?", next: "allesh_gilliam_marshall_yarrow_convo_3", description: "", checkStat: "", checkDC: 0, failNext: "" }, "after", "Show us the wall that’s wrong. Um. Please.");

  // ── Row 18: a second road into Etta's conversation after the brush-off — at retail ──
  if (!byId.has("ag_etta_bought_in")) {
    const nb = { id: "ag_etta_bought_in", label: "Allesh-Gilliam — Preserves at Today's Prices", type: "dialog", timeScale: "scene", timePoints: 0, tags: "allesh-gilliam etta", politicalTags: "",
      outcomes: { success: null, failure: null },
      inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ flag: "storyPhase", gte: 2 }] },
      actors: [],
      description: "You buy the preserves. You buy them at today’s price, which is the wrong one, and you do not say so, and that — not the money — is what turns her around.\n\n“Well,” Etta says, wrapping the jar in a sheet of somebody’s old sheet music, “you can be taught.” She does not lean in. She does not lower her voice. She tells you what she tells you across the counter, at retail, the way she would tell anyone who paid: the bunker is real, the Valhaulans are in it, and the seal her mapmaker found faces outward.\n\n“The rest,” she says, patting the jar, “keeps. Come back when you can afford the rest, my dears.”\n\n<i>⚙ GM: the Bunker conversation opens, but at retail — ten marks out of the coalition's economy for preserves nobody needed.</i>",
      choices: [
        { label: "Hear the rest anyway.", next: "allesh_gilliam_etta_bloom_conversation", description: "She sighs, and sells you the rest too.", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Leave", next: "allesh_gilliam_introduction_to_hq", description: "", checkStat: "", checkDC: 0, failNext: "" }
      ],
      encounter: { key: "", tier: null, actorName: "" },
      worldEffects: { territoryOutcome: null, factionEffects: [{ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: { economy: -10 }, allowOvercap: false }], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
      memoryText: "Bought Etta's preserves at the wrong price without saying so. She opened the Bunker conversation at retail.",
      questId: "quest_Cq1v3hJpXarX5rXJ", questStep: 311, questRole: null, targetHexUuid: null, turnNumber: null,
      cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null }, journal: { enabled: false, entryId: null, force: false }, unlocks: { maneuvers: [], strategics: [] },
      sceneId: "q9zMsGlxPRjewuhw", speakerActorId: "O6QOjE1ZJ9Ef7e7k", dialogueOffer: false, story: { quest: "allesh_gilliam" }, ...PF };
    camp.beats.push(nb); byId.set(nb.id, nb); add("new beat ag_etta_bought_in (questStep 311)");
  } else ok("ag_etta_bought_in exists");
  addChoice("allesh_gilliam_etta_brushoff", { label: "Buy something first.", next: "ag_etta_bought_in", description: "The prices are wrong today. Pay them anyway, and don’t mention it.", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "ag_etta_bought_in", not: true }] }, "start");

  // ── Rows 19 + 20: outside the gate; Avuncular Joans ──
  {
    const st = camp.story?.scripts?.allesh_gilliam?.arrival?.steps?.find(s => s && s.id === "joan");
    const to = "Avuncular Joans is waiting just outside the gate. Hear her out.";
    if (!st) warn("arrival step joan missing");
    else if (st.line === to) ok("arrival step joan: line set");
    else if (st.line !== "Joan is waiting just inside the gate. Hear her out.") warn("arrival step joan: line moved — skipped");
    else { st.line = to; add("arrival step joan: outside the gate, Avuncular Joans"); }
    const arr = camp.story?.scripts?.allesh_gilliam?.arrival;
    if (arr && arr.giver === "Avuncular Joan") { arr.giver = "Avuncular Joans"; add("script allesh_gilliam.arrival.giver → Avuncular Joans"); } else if (arr) ok("arrival giver already Joans");
  }
  rep("avuncular_joans_speech", "Avuncular Joan waits for you just outside the gate.", "Avuncular Joans waits for you just outside the gate.");
  let questsRaw = null, questsWasStr = false, quests = null, questsChanged = false;
  try { questsRaw = game.settings.get(NS, "quests"); questsWasStr = typeof questsRaw === "string"; quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw); } catch (_e) { quests = null; }
  if (quests && quests.quest_Cq1v3hJpXarX5rXJ) {
    const q = quests.quest_Cq1v3hJpXarX5rXJ;
    if (q.arrivalGiver === "Avuncular Joan") { q.arrivalGiver = "Avuncular Joans"; questsChanged = true; add("quests.quest_Cq1v3hJpXarX5rXJ.arrivalGiver → Avuncular Joans"); }
    else ok("quest arrivalGiver already Joans");
  } else warn("quests setting not available here (sim) — arrivalGiver untouched");

  // ── Row 21: S'narchy Burger is canon ──
  rep("allesh_gilliam_hq_cinematics", "The Snarky Burger sign still glows outside", "The S'narchy Burger sign still glows outside");
  setChoiceField("allesh_gilliam_town_walk", "The HQ — Marshal Pike", "description", "Your new command center / former S'narchy Burger. Go stand in it and feel like you're in charge. Practice your in-charge face. You have one, right?");

  // ── Row 24: half a day is enough ──
  rep("ag_tallow_wick_routes_hit", "You have been in Allesh-Gilliam long enough to know what it burns in every lamp and sconce, and it isn't that.", "Half a day in Allesh-Gilliam is enough to know what it burns in every lamp and sconce, and it isn't that.");

  // ── Row 25: second is where the talking is ──
  setDesc("allesh_gilliam_etta_bloom_conversation_hesitate",
    "Etta’s tone softens—not kinder, but steadier.\n\n“You’re not the only coalition looking for a place the Valhaulans already found.”\n\n\"But you're the ones I want to be second to the prize. And then maybe we all talk. My dear ones.\"",
    "Etta’s tone steadies. “You’re not the only coalition hunting a place the Valhaulans already found. I’d rather it was you who got there second, my dears. First is where the funerals are. Then we all talk.”");

  // ── Row 27: weather pushes ──
  rep("ag_east_wall_read_ok",
    "the pressure shows itself: not weather, not raiders — a slow, patient lean from Thatwards by North, toward Khezek Tor, the way a rope goes taut when someone far away picks up the other end.",
    "the pressure shows itself. Weather pushes. Raiders push. This is a slow, patient lean from Thatwards by North, toward Khezek Tor, the way a rope goes taut when someone far away picks up the other end — a lean that says: I am paying attention to something important. You should too. And you're mobile!");

  // ── Row 28: the bowl goes back gently ──
  rep("rc_tamsin_soured", "He sets the bowl back on the rail by the cauldron — not thrown, not snatched, just returned to the people it's for — and dries his hands", "He sets the bowl back on the rail by the cauldron, gently, for the people it's for, and dries his hands");

  // ── Row 29: Young Gearbox, human ──
  rep("allesh_gilliam_opening_scene", "Your driver, a mechanic named Young Gearbox, is NOT a Jackalope. He's a human, a Neanderthal, which is confusing. But you understand that he works for the Jackalopes, which you have heard are your friends.", "Your driver, a mechanic named Young Gearbox, turns out to be a human. A Neanderthal, which is confusing, because he works for the Jackalopes, who you have heard are your friends.");

  // ── Row 30: approaching, once ──
  rep("allesh_gilliam_the_long_market_intro", "Approaching you, you see a matronly looking Menhirkin in an intricate set of armor approaching you.", "A matronly looking Menhirkin in an intricate set of armor is approaching you.");

  // ── Row 31: the supper's biography ──
  rep("ag_first_night_soma_break", "somebody's supper riding the air all the way down the street. Then being shot and put into an oven, magically. It's beautiful.", "somebody's supper riding the air all the way down the street, having been shot, plucked and ovened with what smells like real affection. It's beautiful.");

  // ── Row 32: the Jackalope sentences ride to the Fixit choice ──
  setChoiceField("allesh_gilliam_introduction_to_hq", "Head to the Leygate", "description", "Time to check out your busted-ass equipment.");
  setChoiceField("allesh_gilliam_introduction_to_hq", "Ride for Furrier's Fixit Farm", "description", "You've met the Jackalopes before. They're fine. Good in a pinch. Definitely good to stay on the good side of the merchants around here. Seeing one of their above ground Enclaves could be educational. A third sign, nailed on later: WE FIX IT (MOSTLY). It sits on the road either way.");

  // ── Row 33: what the star means ──
  setChoiceField("ag_confessor_pilgrim", "Ask Verna what the star means.", "description", "\"Pilgrim Wick\" is what he gave her. She'll tell you what he gave. Never why he's here. A guest's business is sacred. Especially PILGRIM business.");

  // ── Row 34: a wall that already stood straight does not stand straight again ──
  addRequire("allesh_gilliam_wall_stands_straight", { beatMark: "allesh_gilliam_east_wall_success", not: true });

  // ── Row 35: DC 0 was a missing DC — the nine op checks become DC 12 ──
  for (const b of camp.beats) for (const c of b.choices || []) {
    if (c && typeof c.checkStat === "string" && c.checkStat.startsWith("op.") && Number(c.checkDC) === 0) { c.checkDC = 12; add(`${b.id} › '${c.label}': DC 0 → 12`); }
  }

  console.log(`[patch-story-review-act01b] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Story review Act 0–1 rows DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Story review Act 0–1 rows: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-review-act01b-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (questsChanged) await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Story review Act 0–1 rows APPLIED: ${changes} change(s). Pike is timing you.`);
})();
