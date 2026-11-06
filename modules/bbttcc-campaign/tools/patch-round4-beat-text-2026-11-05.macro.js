/**
 * patch-round4-beat-text-2026-11-05.macro.js — Dave's live beat text from the Round 4 play-through, kept word for word.
 * TEXT replaces a beat's description. REPLIES adds an answer beat and the choice that reaches it (answer-beat shape from the
 * 2026-10-26 dead-end sweep: its choices are the parent's other choices, never a route back into the parent).
 * Idempotent. DRY_RUN first (globalThis.__r4TextDry = false applies). GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__r4TextDry !== false;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const TEXT = {
    ag_wick_the_shrines: `“Up the switchbacks around Khezek Tor. I try to place one every hour of my climb, in someplace that the wind can’t reach but travelers can see. A crevasse, a stone, a candle. It’s beautiful. It’s reassuring.

“And it helps people see at night on those switchbacks which is SUPER important.”

He is really into walking and fire.

Fair enough.`,
    ag_vacancy_pilgrim_wick: `He’s in the lounge with his boots off, but his relaxation is immediately replaced with enthusiasm as he sees you approaching!

“Hello Stewards! So glad to see you.”

He stands, almost to attention, and grins broadly in what appears to be genuine gladness.

“How may I be of assistance?”`,
    ag_wick_the_order: `“The Old Routes,” he says which, to be fair, would need to be followed by a word like “Delaware” or “France” to be an actual answer, but frustratingly it does not.

Instead, “We go where the flame is thin.”

Any attempts to get a more specific response from him seem to confuse and agitate him.`,
    ag_wick_the_flame: `“The flame,” he says proudly. “Civilization is a fire someone has to keep. Most people think it keeps itself. WRONG.”

He is enthusiastic!

“So St Gilliam’s has the most fire in town in one easily accessible place. And Father Tamsin has enough to do as it is, feeding and … sleeping? … the needy.

“I sometimes have help from someone called Gary. I like working with Gary. He’s pretty certain everyone at St Gilliam’s is going to be murdered by ghosts, and not plumbing. He was very emphatic about that last part, even though I never brought plumbing up.”{{#played ag_title_card}} He turns a hand over: something pale under the nails.{{/played}}`,
    rc_etta_skewer: `You eat the skewer of whatever.

Etta watches you intently, her mouth opening and closing slightly in time with yours.

It’s marvelous.

You look around.

Everyone, all the shoppers and merchants and intelligent furniture and etc, are staring at you intently.

They all immediately break eye contact and hurriedly go back to whatever they had been doing, while whistling tunelessly.

You’re PRETTY sure you caught a few smiles, though, right before they vanished behind racks of jeans and fake runestones.

You look back. Etta is smiling slightly too.

A second skewer has appeared in your hand through an unknown mechanism.

“You’ll do fine,” she says.`,
    ag_tamsin_answer_building: `“I’m pretty sure you know the answer to this, as it’s been mentioned in previous boxed text, but here’s the TL;DR

“This used to be a church. Since god is more of an occupation now - not much use for such things. They’re as out of place as that one thing that you see in a group of other things that doesn’t belong.” He makes a grimace, takes out a small notebook, and crosses something out.

“I’m trying to work on my analogies.

“I thought that it might make a good place for folks to rest and recover from Bad Eden as much as they can before sending themselves back out into the mess.

“It also helped that we got a deal because the previous owners thought it was haunted. Which it is not. No MATTER,” and here he turns to look at a group of townsfolk sitting around a table a few yards away, “WHAT GARY SAYS, THE NOISES ARE THE PLUMBING. And so was this enterprise of giving back born.”`,
    rc_tamsin_cauldron: `Father Tamsin ladles out a rustic bowl of Bad Eden, and it is comfort in a bowl.

This guy needs to open a chain of church themed B&Bs for the unfortunate that serve Michelin level food.

It also helps that the server is so freaking nice. See, he’s so nice I didn’t use a swear here.

Gary, at the far table, says something about the plumbing.

“GARY,” says Tamsin, without turning around.`,
    allesh_gilliam_tamsin_welcome: `St Gilliam’s still looks like a church on the inside, and somehow it makes it seem more cosy. That’s a remarkable feat given the history of organized religion.

A man - obviously Father Tamsin, he moves like he owns the scene - approaches you, wiping his hands on a towel. They appear to be caked with pie dough.

“Ah, Stewards. I had hoped you’d stop by for a nosh and a sit. Both are present here in LOADS. Whereas St Gilliam’s was once a church, now it helps people, providing for their material needs.

You seem to be being followed by children who are walking in a strangely majestic fashion. Shoo Tormasiin! Begone Avilaara! Can’t you see the Stewards want rest, not tiny gyrating shadows!”

The children laugh and scram. Tamsin looks after them fondly.

“Sit and eat. Bread’s hot and fresh. Stew’s got some of Elsie’s finest from yesterday’s harvest. Chef’s kiss.”

He had apparently already set you a table, before you arrived.`,
    rc_pike_coffee: `You drink it without question.

It is terrible. It is also the best thing you’ve had since you left Coraliindra.

Pike refills his mug, but not yours. He has decided that you are competent enough to find and use the pot yourself.

“Get a bit of focus going. Things always look better after coffee.”

He’s right. The Patrol Boards make slightly more sense now, somehow ...`,
    allesh_gilliam_waiting_room_exterior: `This used to be a medical clinic. Now it is a bar.

The owner is a medic named Doc Greeley.

Drunk people get hurt. The synergy is there if you look hard enough.`,
    ag_walk_wick: `You stride into town in a way that you hope is reassuringly heroic.

Cam footage later reveals that it was not, but people got the point.

Given what you had heard about Bad Eden, most of which was, well, BAD, this place seems LESS so.

There’s a dude smoking brisket! That is as TEXAN as it gets. And it smells delicious, and not at all like it’s being cooked in the hull of a burned out half buried school bus.

AJ (air guitar) told you people here have reasons not to trust you. That translates as wary curiosity apparently.

You realize you are being followed by a child, who is attempting to walk in your footsteps.

Cam footage later reveals that he looked reassuringly heroic.

And a helpful sort of fellow, a Menhirkin in a long dusty coat and dark sunglasses, climbs down from a ladder where he appears to have been repairing a window, grinning, with his hand extended.

“Welcome New Civic Leaders! Right on time! I am Wick, a Pilgrim of the Old Routes. Allow me to point you in the many right directions you may now explore here.

Marshal Pike is at your Headquarters. He arrives promptly at 7 AM every morning, and is grumpy until he has had his coffee. And also after. He can help give you the lay of the land here!

Etta Bloom, or Mayor Bloom as I like to call her but I should really stop because she has told me to many times, is in at the Long Market by 9 AM. She’s a Bad Eden native with a bit of Sky Pirate in her past.

If you are hungry and destitute, or just want a sandwich and a nap, my dear friend Father Tamsin holds forth at St Gilliam’s, a building that is far more church like now that it has stopped trying to be a church and is now a bed and breakfast. Cauldron is on at 10 AM!

If you want a drink and a war story, head to The Waiting Room and don’t tell Doc I sent you. She does not like me because I point out things that are true repeatedly. She never closes and is always there. This is creepy. Again do NOT tell her I sent you.

If you need a place to stay, which you do not, or local gossip, which you do, head to The Vacancy. They have rooms available. And also gossip. And also Me! I have a room there.

And see that Water Tower over there?”

You do.

“City engineer lives there. He spends very little time in the city, though. So he must be very good at his job, having only seen the town in full once.

Again, welcome my friends! I hope we speak again!”

And without waiting for anyone to do anything except blink, he hurries away down the street and vanishes into the dust.`
  };

  // Part of a beat's text swapped, leaving its return-visit spans alone.
  const SWAPS = [{
    beat: "ag_vacancy_pilgrim_wick",
    from: `Verna doesn't lower her voice, because she wants him to hear it. "I didn't trust him. A man who pays for a bed and never sleeps in it, what's he doing all night? Then I worked it out. Nothing. He's out on the road being a saint, and I've got a room I never turn down, sheets I never wash, and rent to the mark every week since the night of the Cough. He fixed the ice machine. He carried the Hendersons' piano. Favorite guest." She points her pen at you. "Don't tell the others."`,
    to: `@@STRUCK@@`
  }, {
    beat: "allesh_gilliam_vacancy_exterior",
    from: ` Verna keeps the ledger; the ledger keeps everyone else.`,
    to: ``
  }, {
    beat: "allesh_gilliam_yarrow_welcome",
    from: `in a precisely, measured, calculated way`,
    to: `in a precisely measured, calculated way`
  }, {
    beat: "allesh_gilliam_yarrow_welcome",
    from: `Marshal Yarrow Pike doesn't stand when you enter. He leans against the counter like it's the only thing in the room that hasn't disappointed him yet. He has a "perpetually disappointed vibe."

Scar across the jaw. Wears a tri-corner hat unironically and rocks it. Eyes that measure distances automatically. He measures yours.

Uncomfortable.`,
    to: `Marshal Yarrow Pike, (you find out later that Marshal is his first name), doesn’t straighten up as you enter, but rather remains leaning, in a precisely measured, calculated way designed to evince the UTMOST sense of unimpressed-ness.

He has a perpetually disappointed vibe - like nothing has ever really measured up in his eyes - and he is not expecting his life to change anytime soon.

He also wears a tri-corner hat unironically, and rocks it.`
  }, {
    beat: "allesh_gilliam_yarrow_welcome",
    from: `A pause that almost qualifies as friendly.

"Eat something. Sleep behind the wall. Tomorrow's allowed to wait for you — that's an order I only give once.

"And tomorrow, it's your turn to start giving orders."`,
    to: `“Eat something. Sleep. Then take a look around. THEN give orders.”`
  }, {
    beat: "allesh_gilliam_waiting_room_intro",
    from: `Doc Greeley, one of the rare Eidolons to call Bad Eden home, pours like she's writing prescriptions, and the room is loud in the specific way of people who survived something together and have agreed to discuss anything else. In the cellar there's one room kept spotless, with the cellar door shut. Nobody jokes in there.`,
    to: `Doc Greeley, one of the rare Eidolons to call Bad Eden home, has the haunted look in her eyes of an early game NPC with a complicated backstory but no real character arc.

She is definitely a doctor who has seen some shit.

In the cellar there's one room kept spotless, with the cellar door shut. Nobody jokes in there.`
  }];

  const REPLIES = [{
    id: "ans_allesh_gilliam_waiting_room_intro_wick_sent_us",
    parent: "allesh_gilliam_waiting_room_intro",
    speakerFrom: "ag_greeley_answer_cough",
    label: "Hey, Wick the Pilgrim sent us",
    beatLabel: "Allesh-Gilliam — The Waiting Room — Hey, Wick the Pilgrim sent us",
    tags: "arrival greeley wick",
    requires: [{ beatMark: "ag_walk_wick" }],
    at: 1,
    text: `Doc Greeley’s nose wrinkles in distaste, and then she sighs. “Well. I can’t help it that he talks to people. He thinks we’re ‘don’t need a lot of sleep buddies.’ That’s … and he wouldn’t cut it out.”

This is the town in which you now reside!`
  }];

  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats);
  const find = (x) => beats.find(b => b.id === x);
  // Keep each beat's own paragraph format: siblings are <p> HTML, older beats are plain text with blank lines.
  const fit = (text, like) => /^\s*<p>/i.test(String(like || "")) ? text.split(/\n\s*\n/).map(p => `<p>${p.trim()}</p>`).join("\n") : text;
  const report = { DRY_RUN, text: [], replies: [] };

  for (const [beatId, text] of Object.entries(TEXT)) {
    const b = find(beatId); if (!b) throw new Error(`no beat ${beatId}`);
    const next = fit(text, b.description);
    if (b.description !== next) { b.description = next; report.text.push(beatId); }
  }

  for (const s of SWAPS) {
    const b = find(s.beat); if (!b) throw new Error(`no beat ${s.beat}`);
    if (String(b.description).includes(s.from)) { b.description = s.to === "@@STRUCK@@" ? b.description.replace(s.from, "").replace(/\n{3,}/g, "\n\n") : b.description.replace(s.from, s.to); report.text.push(s.beat); }
    else if (s.to === "@@STRUCK@@") continue;
    else if (!String(b.description).includes(s.to)) console.warn("R4TEXT swap text not found in", s.beat, s.from.slice(0, 50));
  }

  for (const r of REPLIES) {
    const parent = find(r.parent), model = find(r.speakerFrom);
    if (!parent || !model) throw new Error(`missing parent or model for ${r.id}`);
    const others = (parent.choices || []).filter(x => x.next !== r.id);
    const description = fit(r.text, model.description);
    let beat = find(r.id);
    if (!beat) {
      beat = foundry.utils.deepClone(model);
      for (const k of ["questId", "questStep", "questRole", "story", "digest", "nextLine"]) delete beat[k];
      Object.assign(beat, { id: r.id, label: r.beatLabel, tags: r.tags, timeScale: "moment", timePoints: 0, dialogueOffer: false });
      beat.inject = { ...beat.inject, repeatable: false, evergreen: true, requires: [{ flag: "storyPhase", gte: 1 }] };
      beats.splice(beats.indexOf(parent) + 1, 0, beat);
      report.replies.push(`add beat ${r.id}`);
    }
    if (beat.description !== description) { beat.description = description; report.replies.push(`text ${r.id}`); }
    const answerChoices = foundry.utils.deepClone(others);
    if (JSON.stringify(beat.choices) !== JSON.stringify(answerChoices)) { beat.choices = answerChoices; report.replies.push(`choices ${r.id}`); }
    if (!(parent.choices || []).some(x => x.next === r.id)) {
      parent.choices.splice(r.at, 0, { label: r.label, next: r.id, description: "", checkStat: "", checkDC: 0, failNext: "", requires: r.requires });
      report.replies.push(`choice on ${r.parent}`);
    }
  }

  // Dave: Wick is not a town walk choice. He plays when you go in, then you walk the town.
  const walk = find("allesh_gilliam_town_walk");
  if ((walk.choices || []).some(x => x.next === "ag_walk_wick")) { walk.choices = walk.choices.filter(x => x.next !== "ag_walk_wick"); report.text.push("walk: Wick choice off"); }
  if (walk.entryFirst?.beat !== "ag_walk_wick") { walk.entryFirst = { beat: "ag_walk_wick" }; report.text.push("walk: Wick plays on the way in"); }

  // Dave: going to a person reads "speak with", not "find".
  const SPEAK = { "Find the Marshal": "Speak with the Marshal", "The kettle is warm — find Father Tamsin": "The kettle is warm — speak with Father Tamsin", "Find Brennig at his desk": "Speak with Brennig at his desk" };
  for (const b of beats) for (const ch of (b.choices || [])) if (SPEAK[ch.label]) { report.text.push(`${b.id}: ${ch.label}`); ch.label = SPEAK[ch.label]; }

  // Dave: Pike is not on the HQ exterior. A story load restores scene tokens, so the map's token spots remember it.
  const EXTERIOR = game.scenes.get("bhPP40A9TJBPmXuO");
  if (EXTERIOR) {
    const allSpots = foundry.utils.duplicate(game.settings.get("bbttcc-encounters", "tokenSpots") || {});
    const ext = allSpots[EXTERIOR.id];
    if (!ext?.absent?.includes("Marshal Yarrow Pike")) {
      allSpots[EXTERIOR.id] = { name: EXTERIOR.name, pcs: [], foes: {}, npcs: {}, ...ext, absent: [...(ext?.absent || []), "Marshal Yarrow Pike"], at: Date.now() };
      report.text.push("HQ exterior: Pike stays off");
      if (!DRY_RUN) await game.settings.set("bbttcc-encounters", "tokenSpots", allSpots);
    }
  }

  // Dave: nobody rolls to take a bowl, and a table can turn the Father down.
  const tamsin = find("allesh_gilliam_tamsin_welcome");
  const bowl = (tamsin.choices || []).find(x => x.next === "rc_tamsin_cauldron");
  if (bowl?.checkStat) { Object.assign(bowl, { checkStat: "", checkDC: 0, failNext: "", description: String(bowl.description || "").replace(/\s*\(Presence, DC 11\)/, "") }); report.text.push("cauldron: no check"); }
  const REFUSE = "Refuse the Father’s hospitality.";
  if (!(tamsin.choices || []).some(x => x.label === REFUSE)) {
    const at = tamsin.choices.findIndex(x => /^Thank him/.test(x.label));
    tamsin.choices.splice(at < 0 ? tamsin.choices.length : at, 0, { label: REFUSE, next: "allesh_gilliam_town_walk", description: "", checkStat: "", checkDC: 0, failNext: "" });
    report.text.push("Tamsin: refuse choice");
  }

  // Dave: the Round's town doors go through the exterior, like the HQ and St Gilliam's, and an exterior holds for 5 seconds.
  const ROUND = { allesh_gilliam_long_market_exterior: "The Long Market", allesh_gilliam_waiting_room_exterior: "The Waiting Room", allesh_gilliam_vacancy_exterior: "The Vacancy", allesh_gilliam_plumb_tower_exterior: "The Plumb Office" };
  const round = find("allesh_gilliam_town_walk");
  for (const [next, label] of Object.entries(ROUND)) {
    const ch = (round.choices || []).find(x => x.label === label);
    if (ch && find(next) && ch.next !== next) { ch.next = next; report.text.push(`Round: ${label} via exterior`); }
  }
  const sceneName = (s) => game.scenes.get(String(s || "").replace(/^Scene\./, ""))?.name || "";
  let held = 0;
  for (const b of beats) {
    if (!b.cinematic?.enabled || !(Number(b.cinematic.durationMs) > 5000)) continue;
    if (!/exterior/i.test(b.id) && !/exterior/i.test(sceneName(b.cinematic.startSceneId))) continue;
    b.cinematic.durationMs = 5000; held++;
  }
  if (held) report.text.push(`exteriors at 5s: ${held}`);

  // Round 4: these town beats had no player-facing flag, so their text never reached a player's seat and the last card stayed up.
  for (const id of ["allesh_gilliam_vacancy_intro", "allesh_gilliam_waiting_room_intro", "allesh_gilliam_plumb_office_intro", "allesh_gilliam_muster_intro", "allesh_gilliam_st_gilliams_cinematics"]) {
    const x = find(id);
    if (x && !x.playerFacing) { Object.assign(x, { playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true }); report.text.push(`player-facing: ${id}`); }
  }

  // Dave: story text reaches players. Every beat with no player-facing setting at all gets one; beats explicitly set off stay off.
  const PF = ["playerFacing", "playerFacingDialog", "dialogPlayerFacing", "playerFacingContent", "showToPlayers"];
  let pfOn = 0;
  for (const x of beats) if (PF.every(k => x[k] === undefined)) { for (const k of PF) x[k] = true; pfOn++; }
  if (pfOn) report.text.push(`player-facing on: ${pfOn}`);

  // Dave: the Stewards know Wick, so Verna gets asked about him by name.
  const vacancy = find("allesh_gilliam_vacancy_intro");
  const VERNA_REPLY = "ans_allesh_gilliam_vacancy_intro_is_that_wick";
  const guest = (vacancy.choices || []).find(x => x.next === "ag_vacancy_pilgrim_wick");
  if (guest) { Object.assign(guest, { label: "Hey, is that Pilgrim Wick?", next: VERNA_REPLY, description: "" }); report.text.push("Vacancy: Wick choice renamed"); }
  if (!find(VERNA_REPLY)) {
    const reply = foundry.utils.deepClone(find("ag_greeley_answer_cough"));
    for (const k of ["questId", "questStep", "questRole", "story", "digest", "nextLine"]) delete reply[k];
    Object.assign(reply, { id: VERNA_REPLY, label: "Allesh-Gilliam — The Vacancy — Hey, is that Pilgrim Wick?", tags: "arrival verna wick", timeScale: "moment", timePoints: 0, dialogueOffer: false,
      speakerActorId: game.actors.getName("Verna Tulliver")?.id || null,
      description: `“Yep. He pays on time every time, never sleeps in his bed so I don’t have to clean it up. A gentleman and a scholar in my book.”

And with that she writes “gentleman and scholar” next to Wick’s name in the book.`,
      choices: [
        { label: "Go talk to Pilgrim Wick", next: "ag_vacancy_pilgrim_wick", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Leave", next: "allesh_gilliam_town_walk", description: "", checkStat: "", checkDC: 0, failNext: "" }
      ] });
    reply.inject = { ...reply.inject, repeatable: true, evergreen: true, requires: [{ flag: "storyPhase", gte: 1 }] };
    beats.splice(beats.indexOf(vacancy) + 1, 0, reply);
    report.text.push("Vacancy: Verna's reply");
  }

  // Dave: Wick isn't suspicious in this act, so the old routes carry no suspicion check.
  const oldRoutes = find("ag_vacancy_pilgrim_wick_routes");
  if ((oldRoutes?.choices || []).some(x => x.next === "ag_tallow_wick_routes_hit")) { oldRoutes.choices = oldRoutes.choices.filter(x => x.next !== "ag_tallow_wick_routes_hit"); report.text.push("Old Routes: no suspicion check"); }

  // Dave: no "discover Wick" choices in Act 1. These two seed the shrines and the slate, so they wait for Act 2.
  for (const [beatId, next] of [["ag_wick_the_shrines", "ag_wick_shrines_later"], ["ag_wick_the_bed", "ag_wick_the_slate"]]) {
    const ch = (find(beatId)?.choices || []).find(x => x.next === next);
    if (ch && !ch.requires) { ch.requires = [{ flag: "storyPhase", gte: 2 }]; report.text.push(`Act 2 only: ${next}`); }
  }

  // Dave: Wick's hub is a greeting; his itinerary and the questions come when the Stewards ask about him. "Ask something else" returns to the questions, not the hello.
  const WICK_HUB = "ag_vacancy_pilgrim_wick", WICK_ABOUT = "ag_vacancy_pilgrim_wick_about";
  const wickHub = find(WICK_HUB);
  if (!find(WICK_ABOUT)) {
    const about = foundry.utils.deepClone(wickHub);
    for (const k of ["questId", "questStep", "questRole", "story", "digest", "nextLine"]) delete about[k];
    Object.assign(about, { id: WICK_ABOUT, label: "Allesh-Gilliam — The Guest Who Keeps Vigil — About Himself", timeScale: "moment", timePoints: 0, dialogueOffer: false,
      description: `He tells you where he's been: St Gilliam's for the candles, the high shrines above Khezek Tor, and here, for the bed he doesn't use.` });
    about.inject = { ...about.inject, repeatable: true, evergreen: true };
    wickHub.choices = [
      { label: "Actually, we’re curious about you! Tell us about yourself, Pilgrim Wick!", next: WICK_ABOUT, description: "", checkStat: "", checkDC: 0, failNext: "" },
      ...(wickHub.choices || []).filter(x => /^Leave him/.test(x.label))
    ];
    beats.splice(beats.indexOf(wickHub) + 1, 0, about);
    report.text.push("Wick: greeting hub + about beat");
  }
  for (const x of beats) if (x.id !== WICK_HUB && x.id !== WICK_ABOUT) for (const ch of (x.choices || [])) {
    if (ch.next === WICK_HUB && /^Ask something else/.test(ch.label)) { ch.next = WICK_ABOUT; report.text.push(`${x.id}: back to the questions`); }
  }

  // Dave: leaving Wick reads "Let him rest."
  let restN = 0;
  for (const x of beats) for (const ch of (x.choices || [])) if (/^Leave him to his vigil\.?$/.test(String(ch.label || "").trim())) { ch.label = "Let him rest."; restN++; }
  if (restN) report.text.push(`Let him rest: ${restN}`);

  // Dave: Offices of Fates and Destinies is no longer a quest. Thatward's Ho stays, on its own, with the new line.
  const tw = find("thatwards_ho_opening_scene");
  if (tw?.story?.chapter) { delete tw.story.chapter; report.text.push("Thatwards Ho: no chapter"); }
  const allQuests = foundry.utils.deepClone(C.quests.getAllQuests());
  const WELCOME_LINE = "You're in Bad Eden now. Welcome home?";
  let questsChanged = false;
  if (allQuests.quest_ycEa0uXzTzsbK4qP) { delete allQuests.quest_ycEa0uXzTzsbK4qP; questsChanged = true; report.text.push("Offices quest removed"); }
  if (allQuests.quest_thatwards_opening && allQuests.quest_thatwards_opening.description !== WELCOME_LINE) { allQuests.quest_thatwards_opening.description = WELCOME_LINE; questsChanged = true; report.text.push("Thatwards Ho: Mal's line"); }
  if (!DRY_RUN && questsChanged) await C.quests.setAllQuests(allQuests);
  for (const a of game.actors) {
    const q = a.flags?.["bbttcc-factions"]?.quests; if (!q) continue;
    for (const bucket of ["active", "completed", "archived"]) if (q[bucket]?.quest_ycEa0uXzTzsbK4qP) {
      report.text.push(`${a.name}: Offices off the log`);
      if (!DRY_RUN) await a.update({ [`flags.bbttcc-factions.quests.${bucket}.-=quest_ycEa0uXzTzsbK4qP`]: null });
    }
  }

  // Dave: the opening plays through, then players can click doors.
  const WAIT = { beat: "allesh_gilliam_opening_scene", message: "Hear out the briefing and get off the Jackalope first." };
  const doorsChanged = JSON.stringify(c.doorsWaitFor) !== JSON.stringify(WAIT);
  if (doorsChanged) report.text.push("doors wait for Welcome");

  const changed = report.text.length + report.replies.length;
  if (!DRY_RUN && changed) await C.saveCampaign(id, { ...c, beats, doorsWaitFor: WAIT });
  console.log("R4TEXT " + JSON.stringify(report));
  ui.notifications.info(`Round 4 beat text: ${DRY_RUN ? "dry run" : "applied"}, ${changed} change(s).`);
})();
