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
    allesh_gilliam_waiting_room_exterior: `This used to be a medical clinic. Now it is a bar.

The owner is a medic named Doc Greeley.

Drunk people get hurt. The synergy is there is you look hard enough.`,
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

  const changed = report.text.length + report.replies.length;
  if (!DRY_RUN && changed) await C.saveCampaign(id, { ...c, beats });
  console.log("R4TEXT " + JSON.stringify(report));
  ui.notifications.info(`Round 4 beat text: ${DRY_RUN ? "dry run" : "applied"}, ${changed} change(s).`);
})();
