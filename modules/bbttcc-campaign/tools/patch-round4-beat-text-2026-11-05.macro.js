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
    if (String(b.description).includes(s.from)) { b.description = b.description.replace(s.from, s.to); report.text.push(s.beat); }
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
