/* patch-story-review-act01-2026-10-19.macro.js — STORY REVIEW, ACT 0–1, BATCH 1 (Ledger "Doc versus live" rows 1–15, all Accept, 2026-10-18/19):
 *  A. Dave's Beat Polish edits that never reached ember (rows 1–10, 12): Pike's HQ speech + the Pike question tree
 *     (question 3 dropped, question 4 relabelled), the East Wall bus tantrum + survey/tally trims + "says Pike",
 *     Garren "say hi to Young Gearbox" + grin + install trim, Verna's second star + smirk, lease card / lapsed /
 *     coffee tin, adam_kadmon trim, Fixit yard without the early Chupacabra, "whgo" → "who", "Gully pours",
 *     shrines "Please", and Wick's "won't feed the flame on fat" line CUT (the wax seam is a secret check now).
 *     Spliced into the live text word by word so the live paragraphing, HTML and curly quotes survive.
 *  B. Row 14 — ag_tamsin_on_wick rewritten (Dave 10-18: "it will be very obvious that Tamsin and Wick are in cahoots…
 *     I was trying to play it more subtle"): a priest's bland account, the pour stays as the one visible tell, the free
 *     "Word for word" choice is gone, and the catch is a SECRET Insight 12 "Watch him pour." whose hit notices an
 *     attribution slip (Tamsin has Wick's "on the road, mostly" and credits Verna, who never said it). Two new
 *     look-alike beats; the confrontation gains one hit-gated opening.
 *  C. Row 15 — ag_wick_shrine no longer finishes the players' sentence.
 *  Row 11 (ag_plumb_cracks): live kept, the doc is corrected instead. Row 13: notes-only, doc side.
 *  Idempotent (every edit is guarded by the baseline text it replaces); DRY_RUN default true; backs up `campaigns`. GM only.
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

  /* ── A. Dave's doc edits ─────────────────────────────────────────────── */
  const DESC = {
 "allesh_gilliam_introduction_to_hq": {
  "from": "Pike sent a runner before the coffee was hot: come to the HQ, bring whoever reads maps. He doesn’t stand when you enter — you’ve seen that trick — but the boards behind him are lit the wrong colors this morning, and he’s looking at them, not you.\n\n“Night like that, and the town’s still standing. So. You’re the new variable.”\n\nHe gestures at the glowing menu boards.\n\n“That wall holds if people believe it will. That land feeds us if we don’t lie to it. And that gate?”\n\nHe taps a flickering leyline readout.\n\n“That thing is remembering wrong. Since last night, worse.”\n\nHe finally looks directly at you.\n\n“Fix one promise first. Then we’ll see how long you last. Fix two, well, maybe people might follow instead of holding their breath. Or measuring you for a box.\n\nWe need a replacement Leygate Stabilizer, and the only place I know that has one is Furrier's Fixit. Probably good you know them.\n\nAlso,\" he gestures at the maps again, and one section of city wall that stands out as … wrong.\n\nSee if you can tell us what we're doing wrong.\"",
  "to": "Pike sent a runner before the coffee was hot: come to the HQ, bring whoever reads maps. He doesn’t stand when you enter — you’ve seen that trick — but the boards behind him are lit the wrong colors this morning, and he’s looking at them, not you.\n\n“Variables,” that’s you, “Trouble.”\n\nHe gestures at the glowing menu boards.\n\n“Patch of the East Wall won’t hold a fix. Patched more walls than Greeley’s patched drunkards. Ngh. Don’t repeat that.”\n\nHe taps a flickering leyline readout.\n\n“They both broken same night, same time, a week ago.”\n\nOh. That One Night. Should have known. So much foreshadowing.\n\n“Leygate’s remembering wrong. Bad stabilizer now. Supposed to be stable, so we’ve no parts on hand. Something that scrambles and unscrambles your innards needs to be able to think clear.”\n\nHe finally looks directly at you.\n\n“Get the wall to behave. We’re doing something wrong. It’s pissed about something. Now it’s Steward business.\n\nPlus — we need a replacement Leygate Stabilizer, and the only place I know that has one is Furrier's Fixit. You met them. Probably good you know them too.”\n\nHe points to the agitated menu. “Wall.” He points to another spot, which may or may not be a repurposed grease stain. “Leygate. Talk to Garren.” He points Thatwards by Woods. “Farm.”\n\nThen he points at the door. “Go.”\n\n“Please?” Clearly an afterthought, but it was well meant. The hat helps sell it."
 },
 "allesh_gilliam_marshall_yarrow_convo_1": {
  "from": "Yarrow doesn’t bristle. That’s important.\n\n“It flickered. We believed the previous report instead of the current signal.”\n\nA pause.\n\n“Belief killed timing.”\n\n“You ever trust a system because it worked yesterday?”\n\nHe watches your answer like a entire firing line watching a potential victim.",
  "to": "“It broke. Same night. Stabilizer failed. Stabilizers never fail. That’s their northstar.”"
 },
 "allesh_gilliam_marshall_yarrow_convo_2": {
  "from": "He nods once.\n\nNo speech. Just walks you to the map.\n\n“This section bows inward.”\n\nHe taps it.\n\n“Architect says it's cosmetic.”\n\nHe waits.",
  "to": "He nods once.\n\nNo speech. Just walks you to the map.\n\n“This section.”\n\nHe taps it.\n\n“You can’t fix it, make Plumb earn his keep. Or maybe the other way around.”\n\nHe waits."
 },
 "allesh_gilliam_marshall_yarrow_convo_4": {
  "from": "A beat.\n\n“No.”\n\nNot hostile. Just factual.\n\n“But I don’t distrust you either.”\n\n“You’re unproven. That’s neutral.”",
  "to": "A beat.\n\n“No.”\n\n“And we do. But, it’s here,” he spreads his fingers out in a small gesture that encompasses the entire world. “So everyone does. You included.”"
 },
 "allesh_gilliam_marshall_yarrow_echo": {
  "from": "Yarrow doesn’t answer immediately.\n\nHe shifts his weight.\n\n“Unfinished?”\n\nA dry exhale.\n\n“I was supposed to hold a gate once.”\n\nHis eyes drift to the leyline readout.\n\n“It failed. Or I failed it. Depends how you write history.”\n\nA long pause.\n\n“People died because we trusted something that flickered.”\n\nHe looks at you without blinking.\n\n“I think I’m here to see one promise actually hold.”\n\nA beat.\n\n“Just one. Clean. No hedging.”\n\nHis jaw tightens slightly.\n\n“After that? Maybe I go quiet.”",
  "to": "Yarrow doesn’t answer immediately.\n\nHe shifts his weight.\n\n“Unfinished?”\n\nA dry exhale.\n\n“I was supposed to hold a gate once.”\n\nHis eyes drift to the leyline readout.\n\n“It failed. Or I failed it. Depends how you write history.”\n\n“Or maybe that was a movie. Things here are muddled.”\n\nA long pause.\n\n“I want to see people safe even when there’s danger about.”\n\nHe looks at you without blinking.\n\n“And I’ve recruited you to my cause. Maybe it’ll all work out.”\n\nA beat.\n\nHis jaw loosens slightly.\n\n“After that? Maybe it’s up and out.”"
 },
 "allesh_gilliam_the_east_wall_intro": {
  "from": "The East Wall smells like fresh weld and tired optimism.\n\nBeyond it: scrub, wind, and things that do not respect fences.\n\nOn this side: people who would like to sleep tonight.\n\nScouts rotate constantly. Someone patched the same section twice already.\n\nThe wall is holding.\n\nFor now.\n\nAsk anyone when the bow started and you get the same answer with the same look: that one night. The one everyone felt and nobody can name. Nobody's found daylight between the two. The Architect has an office and an opinion; the wall has a lean and a schedule. One of them is honest.",
  "to": "The East Wall smells like fresh weld and tired optimism.\n\nBeyond it: scrub, wind, and things that do not respect fences.\n\nOn this side: people who would like to sleep tonight.\n\nScouts rotate constantly. Someone patched the same section twice already.\n\nThe wall is holding.\n\nFor now.\n\nAsk anyone when the bow started and you get the same answer with the same look: that one night. The one everyone felt and nobody can name. Nobody's found daylight between the two. And now the wall is all but throwing the bits and pieces of an old bus, that they have been trying for the last three days to use as supports, at their heads with remarkable accuracy and force for something with no eyes or arms.\n\nIf you didn't know better, you'd say it was having a temper tantrum."
 },
 "allesh_gilliam_east_wall_success": {
  "from": "Making a good first impression is important. Making a good first impression that also shows that you know what you're doing? THAT means you won't be killed in your sleep by locals dissatisfied with leadership.\n\nPeople are blunt here. Or sharp. Or grating. Or medical grade bone sawing.\n\nThe wall stands straight — properly, no theater. But fixing a symptom is not the same as meeting the cause, and my money says the cause is under a mountain that's been tired lately. That's a hunch, not a finding. Someday, someone should go ask it what it's tired of — and bring me something I can write down.",
  "to": "Making a good first impression is important. Making a good first impression that also shows that you know what you're doing? THAT means you won't be killed in your sleep by locals dissatisfied with leadership.\n\nPeople are blunt here. Or sharp. Or grating. Or medical grade bone sawing.\n\nThe wall stands straight — properly, no theater. \"But fixing a symptom is not the same as meeting the cause,\" says Pike, \"and my money says the cause is under a mountain that's been tired lately. That's a hunch, not a finding. Someday, someone should go ask it what it's tired of — and bring me something I can write down.\""
 },
 "ag_leygate_delivery": {
  "from": "The crate from Furrier's Fixit sits at the foot of the Leygate, and Garren is reading the stabilizer's serial number to himself like it's the name of someone he owes money to. He has kept this gate alive on salvage and apology since that one night, and now the real part is here, delivered by the Stewards, witnessed by whoever's smart enough to stop and watch. He wipes his hands before he touches it. That's the whole speech.",
  "to": "The crate from Furrier's Fixit sits at the foot of the Leygate, and Garren is reading the stabilizer's serial number to himself like it's the name of someone he owes money to. He has kept this gate alive on salvage and apology since that one night, and now the real part is here, delivered by the Stewards, witnessed by whoever's smart enough to stop and watch. He wipes his hands before he touches it. Then turns to you, gives you a huge grin, and a thumbs up. That's the whole speech.\n\nGarren's good people."
 },
 "ag_leygate_installed": {
  "from": "The install takes an hour and Garren makes it look like surgery, which in every way that matters it is. The new stabilizer seats, the hum drops half an octave into something the whole town will sleep better under, and the Leygate stops flickering mid-thought like a liar losing track of the story. Garren checks it three times, then signs the new certification slowly, like the pen weighs something — and if you're still there to see it, you'll notice he dates it, reads his own signature back, and closes the log gently, the way you close a door on a room where something finally stopped hurting. The gate remembers right. The town will hear it before dark.",
  "to": "The install takes an hour and Garren makes it look like surgery, which in every way that matters it is. The new stabilizer seats, the hum drops half an octave, and the Leygate stops flickering mid-thought. Garren checks it three times, then signs the new certification slowly, with an incredibly satisfied air about him. The gate remembers right. The town will hear it before dark."
 },
 "ag_confessor_pilgrim": {
  "from": "He's in the corner with his boots off and lined up square, and he stands when you come in the way people stand in church. Verna, behind the desk, is counting something aloud, and the something is stars: there is a little star beside his name in the ledger. \"Pays exact,\" she says. \"Never sleeps in the bed. I put a little star.\" She counts the stars. One. Then, quieter, two.",
  "to": "He's in the corner with his boots off and lined up square, and he stands when you come in the way people stand in church. Verna, behind the desk, is counting something aloud, and the something is stars: there is a little star beside his name in the ledger. \"Pays exact,\" she says. \"Never sleeps in the bed. I put a little star.\" She counts the stars. One. Then two. Two is a big deal."
 },
 "ag_confessor_pilgrim_fail": {
  "from": "He's a walker. You're not. By the second switchback he is an itinerary and you are a person with a stitch, and when you get back to the Vacancy Verna has a cup of something waiting and does not ask. She puts a very small star next to your name.",
  "to": "He's a walker. You're not. Apparently. By the second switchback he is gone, and you are a person with a stitch. When you get back to the Vacancy Verna has a cup of something waiting and does not ask. Although she does smirk. But not in a way that would allow you to call her on it.\n\nShe's good.\n\nShe puts a very small star next to your name.\n\nDammit."
 },
 "reliable_the_lease": {
  "from": "Young Gearbox leaves the paperwork on the galley table, weighted with a spanner he forgot or meant to leave, and nobody can tell which. One card, block capitals, a hovercraft drawn in the margin with more love than accuracy: THE ABSOLUTELY RELIABLE. LEASED THREE TURNS TO THE NEW FOLKS. CERTIFIED BY ME. Under that, smaller: IT IS NOT ABSOLUTELY RELIABLE. And under that, smaller still, in Mara's hand: BUT IT IS RELIABLE ENOUGH. BRING IT BACK OR BUY IT.",
  "to": "Young Gearbox leaves the paperwork on the galley table, weighted with a spanner he forgot or meant to leave, and nobody can tell which. One card, block capitals, a hovercraft drawn in the margin with more love than accuracy: THE ABSOLUTELY RELIABLE. LEASED THREE TURNS TO THE NEW FOLKS. CERTIFIED BY ME. Under that, smaller: IT IS NOT ABSOLUTELY RELIABLE. And under that, smaller still, in a neat, crisp, hand: BUT IT IS RELIABLE ENOUGH. BRING IT BACK OR BUY IT. MARA"
 },
 "rc_gearbox_coffee": {
  "from": "The tin has been in the galley since the day he dropped you here. Scratched on the lid, in the block capitals of a man who treats words like bolts — use the fewest that hold — DON'T OPEN TILL YOU'VE EATEN EVERYWHERE.\n\nYou have eaten everywhere. Pike's coffee, Etta's skewer, the cauldron, Elsin's table, Bez's bench, the tar, the amber thing. The whole Recalcitrant Cafe, every grudging course of it. Somebody wrote it down.\n\nYou open the tin. It's coffee. Actual coffee — beans, not tar, not legally-coffee, the kind of thing that stopped existing fifty years before the Shattering and should not be in a hovercraft galley in East Texas. There's a second note under the lid, and it says: SHE RUNS BEST WITH PEOPLE IN HER WHO'VE BEEN FED.\n\nYou brew it. The Reliable's engine ticks. Probably coincidence.\n\n<i>Every Steward integrates the spark <b>The Recalcitrant Cafe</b> — the Enlightenment ladder steps, and it never steps back — and keeps a permanent membership nobody will ever print a card for. One pot. Exactly one.</i>",
  "to": "You have found a tin of something in the Absolutely Reliable. It could not possibly have been there before, but yet it clearly was as you remember it. How could you not have noticed it?\n\nPlot convenience.\n\nYou open the tin. It's coffee. Actual coffee — beans, not tar, not legally-coffee, the kind of thing that stopped existing fifty years before the Shattering and should not be in a hovercraft galley in East Texas. There's a second note under the lid, and it says: SHE RUNS BEST WITH PEOPLE IN HER WHO'VE BEEN FED.\n\nYou brew it. The Reliable's engine ticks. Probably coincidence.\n\n<i>Every Steward integrates the spark <b>The Recalcitrant Cafe</b> — the Enlightenment ladder steps, and it never steps back — and keeps a permanent membership nobody will ever print a card for. One pot. Exactly one.</i>"
 },
 "reliable_lease_lapsed": {
  "from": "Somebody from the Farm comes up the road at dawn with a key and an apology, and The Absolutely Reliable goes home with your fingerprints on it. Your rigs look smaller, parked alone. At the Vacancy, Verna already has the rooms made up, because the sign is never wrong. \"Four rooms,\" she says. \"Pays exact or pays late, I'll put a mark either way.\" Upstairs, one door has a star beside it in her ledger. Your new neighbour never sleeps in his bed.",
  "to": "Somebody from the Farm comes up the road at dawn with a key and an apology, and The Absolutely Reliable goes home with your fingerprints on it. Your rigs look smaller, parked alone. At the Vacancy, Verna already has the rooms made up, because the sign is never wrong. \"Four rooms,\" she says. \"Pays exact or pays late, I'll put a mark either way.\" Upstairs, one door has a star beside it in her ledger. Your new neighbour never sleeps in his bed.\n\nYou're paying to rent rooms in your own fortress and can't keep up payments on your car.\n\nThis all is tremendously uncomfortable.\n\nSkip to the next bit, it probably maybe gets better."
 },
 "ag_wick_the_flame": {
  "from": "\"The flame,\" he says, as if you'd asked the time. \"Civilization is a fire somebody has to keep. Most people think it keeps itself. It doesn't. St Gilliam's has many fires and few keepers, so I trim. A long wick smokes. A short one drowns.\" He turns a hand over: something pale under the nails. \"My order won't feed the flame on fat. It has to burn clean.\"",
  "to": "\"The flame,\" he says, as if you'd asked the time. \"Civilization is a fire somebody has to keep. Most people think it keeps itself. It doesn't. St Gilliam's has many fires and few keepers, so I trim. A long wick smokes. A short one drowns.\" He turns a hand over: something pale under the nails."
 },
 "ag_wick_the_shrines": {
  "from": "\"Up the switchbacks,\" he says. \"A shrine every hour of the climb, where the road bends and the wind can't reach. A stone, a niche, a candle. Somebody walking in the dark finds a flame and knows the road was kept.\" He seems to genuinely like the picture. \"You may visit them. Pilgrims do. Leave them as you find them.\"",
  "to": "\"Up the switchbacks,\" he says. \"A shrine every hour of the climb, where the road bends and the wind can't reach. A stone, a niche, a candle. Somebody walking in the dark finds a flame and knows the road was kept.\" He seems to genuinely like the picture. \"You may visit them. Pilgrims do. Please, leave them as you find them.\""
 },
 "fixit_intro_scene": {
  "from": "The yard, from the middle of it: generators, chimes, the OPEN!!! sign, a Chupacabra visible through a bar window washing a glass and looking at you the way you are looking at him. Everything here is for sale, for some values of sale, and everybody here is deciding what you are.",
  "to": "The yard, from the middle of it: generators, chimes, the OPEN!!! sign. Everything here is for sale, for some values of sale, and everybody here is deciding what you are."
 }
};
  for (const [id, { from, to }] of Object.entries(DESC)) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: NOT FOUND`); continue; }
    const cur = String(b.description || "");
    if (cur === to) { report.push(`· ok ${id}`); continue; }
    if (cur !== from) { report.push(`⚠ ${id}: text changed since the baseline — skipped`); continue; }
    b.description = to; changes++; report.push(`✚ ${id}: description (Dave)`);
  }
  const HAND = {
 "fates_and_destinies_adam_kadmon": [
  [
   "<p>Oh, hey, there you are! Welcome! Very nice to see you again. I expect you just experienced a few words from Mal. Hope you don’t mind that they are experimenting with some new phrases.</p>\n<p>Speaking of, let’s get you grounded!",
   "<p>Welcome! Very nice to see you again.</p>\n<p>No time to waste, literally! So, let’s get you grounded!"
  ]
 ],
 "ag_east_wall_survey": [
  [
   " Walk the span with a line and a level and give the wall the first measurement it has ever had.</p>",
   " This was done very recently.</p>"
  ]
 ],
 "ag_east_wall_survey_ok": [
  [
   " COSMETIC can argue with a lot of things. It cannot argue with a number.</p>",
   "</p>"
  ]
 ],
 "ag_east_wall_read_ok": [
  [
   "a slow, patient lean from the east, toward the mountain, the way",
   "a slow, patient lean from Thatwards by North, toward Khezek Tor, the way"
  ]
 ],
 "ag_east_wall_patched": [
  [
   " The clipboard stays nailed to its post. COSMETIC, underlined twice.</p>",
   "</p>"
  ]
 ],
 "ag_leygate_visit": [
  [
   "sits in the Arc Bay at Furrier's Fixit, where the Jackalopes keep it like a promise nobody's earned yet.<p>",
   "sits in the Arc Bay at Furrier's Fixit.<p>"
  ],
  [
   "So don't lose the spanner.\"</p>",
   "So don't lose the spanner. And say hi to Young Gearbox for me. Tell me if he says hi back. That would be remarkable.\"</p><p>How does he get to call her JOAN?</p>"
  ]
 ]
};
  for (const [id, pairs] of Object.entries(HAND)) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: NOT FOUND`); continue; }
    for (const [from, to] of pairs) {
      const cur = String(b.description || "");
      if (cur.includes(from)) { b.description = cur.replace(from, to); changes++; report.push(`✚ ${id}: "${from.slice(0, 40)}…" → Dave`); }
      else report.push(cur.includes(to) ? `· ok ${id}` : `⚠ ${id}: span not found — skipped`);
    }
  }
  const CHOICE = [
 {
  "id": "allesh_gilliam_introduction_to_hq",
  "label": "Check out the East Wall",
  "from": "So THAT sounded like a challenge. Pike seems fairly keen on being unimpressed. It would be awesome to make him impressed. Impress him, impress others more easily. Or at least piss them off less easily. Actually who knows I'm done making predictions.",
  "to": "Pretty clear where you're needed first. All depends on whether you want to be contrary or not."
 },
 {
  "id": "reliable_the_lease",
  "label": "Brew Young Gearbox's forgotten coffee",
  "from": "The tin in the galley. DON'T OPEN TILL YOU'VE EATEN EVERYWHERE. You have.",
  "to": "You haven't encountered any other beats where you got to cook things yourself. And all the coffee you have so far, narratively, have been canonically AWFUL."
 },
 {
  "id": "fixit_intro_scene",
  "label": "Generator",
  "from": "Power generator = tended by people who know about energy = Venn diagram with people whgo know about Leyline MacGuffins. Hopefully. You're new at ... judgement ...",
  "to": "Power generator = tended by people who know about energy = Venn diagram with people who know about Leyline MacGuffins. Hopefully. You're new at ... judgement ..."
 },
 {
  "id": "fixit_late_run_road",
  "label": "Stop for a drink in his honour. Several.",
  "from": "Three bars, all of them the Gullywasher's side door. Dougan pours one for the crate and drinks it for him.",
  "to": "Three bars, all of them the Gullywasher's side door. Gully pours one for the crate and drinks it for him."
 }
];
  for (const { id, label, from, to } of CHOICE) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: NOT FOUND`); continue; }
    const c = (b.choices || []).find(x => String(x?.label || "") === label);
    if (!c) { report.push(`⚠ ${id}: choice "${label}" not found`); continue; }
    const cur = String(c.description || "");
    if (cur === to) { report.push(`· ok ${id} / "${label}"`); continue; }
    if (cur !== from) { report.push(`⚠ ${id} / "${label}": changed since the baseline — skipped`); continue; }
    c.description = to; changes++; report.push(`✚ ${id} / "${label}": choice text (Dave)`);
  }
  {  // the Pike question tree: question 3 is gone, question 4 is relabelled
    const b = byId.get("allesh_gilliam_marshall_yarrow_convo");
    if (!b) report.push("⚠ allesh_gilliam_marshall_yarrow_convo: NOT FOUND");
    else {
      const i3 = (b.choices || []).findIndex(c => String(c?.next || "") === "allesh_gilliam_marshall_yarrow_convo_3");
      if (i3 >= 0) { b.choices.splice(i3, 1); changes++; report.push("✚ marshall_yarrow_convo: question 3 ('fix one promise') dropped"); }
      else report.push("· ok marshall_yarrow_convo: question 3 already gone");
      const c4 = (b.choices || []).find(c => String(c?.next || "") === "allesh_gilliam_marshall_yarrow_convo_4");
      const L4 = "You don’t trust us. AJ … er … Avuncular Joans said there were reasons.";
      if (!c4) report.push("⚠ marshall_yarrow_convo: question 4 not found");
      else if (c4.label === L4) report.push("· ok marshall_yarrow_convo: question 4 relabelled");
      else { c4.label = L4; changes++; report.push("✚ marshall_yarrow_convo: question 4 relabelled (Dave)"); }
    }
  }

  /* ── B. Father Tamsin on the pilgrim — subtle ────────────────────────── */
  const AG = "quest_Cq1v3hJpXarX5rXJ", CHURCH = "SNenbFtoUm9jv5uE";
  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = () => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] });
  const mk = (id, questStep, label, description, memoryText, choices) => ({
    id, label, type: "narration", timeScale: "scene", tags: "allesh_gilliam,wick-cover", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ flag: "storyPhase", gte: 1 }] },
    actors: [], choices, encounter: { key: "", tier: null, actorName: "" }, worldEffects: WE(), description, memoryText,
    questId: AG, questStep, questRole: null, targetHexUuid: null, turnNumber: null,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false }, unlocks: { maneuvers: [], strategics: [] },
    timePoints: 0, dialogueOffer: false, sceneId: CHURCH, story: { quest: "allesh_gilliam" },
    refs: {}, playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
  });
  const addBeat = (nb) => { if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); return; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id} — ${nb.label}`); };
  const backToTamsin = [ch("Back to the kettle.", "", { next: "ag_tamsin_on_wick" })];
  addBeat(mk("ag_tamsin_wick_slip_hit", 391, "Allesh-Gilliam — The Pour",
    "Verna said he pays exact and never sleeps in the bed. She never said where he does sleep.\n\n\"On the road, mostly\" is Wick's sentence, in Wick's order, and Tamsin has it. He tops up his own cup. It was already full.",
    "WICK'S SENTENCE (noticed): Father Tamsin has Wick's own words about sleeping on the road, and credited Verna, who never said them.", backToTamsin));
  addBeat(mk("ag_tamsin_wick_slip_miss", 392, "Allesh-Gilliam — The Pour",
    "A priest talking about a parishioner. He tops up a cup. The kettle ticks.",
    "The party watched Father Tamsin pour and saw a priest with a kettle.", backToTamsin));
  {
    const b = byId.get("ag_tamsin_on_wick");
    if (!b) report.push("⚠ ag_tamsin_on_wick: NOT FOUND");
    else {
      const TALLOW = { anyOf: ["ag_tallow_wick_routes_hit", "ag_tallow_flame_hit", "ag_tallow_pilgrim_hit", "ag_tallow_courier_hit", "ag_tallow_seal_hit"].map(id => ({ beatMark: id })) };
      const desc = "\"Pilgrim Wick.\" He has to think about it, or does a fair job of looking as if he has to. \"He comes at dusk and trims my candles. Asked permission the first time, which nobody does. Keeps some shrine up the switchbacks, I'm told; I've never been up. Quiet. Early. Leaves the church tidier than he found it, which puts him ahead of most of the parish.\"\n\nHe pours, though nobody's cup is empty.\n\n\"Verna says he hardly uses the bed. Sleeps on the road, mostly. A devout man. Devout like a… like something that is very devout. Sorry. I'm bad at those.\"";
      const exits = (b.choices || []).filter(c => ["allesh_gilliam_tamsin_welcome", "allesh_gilliam_father_tamsin_conversation"].includes(String(c?.next || "")));
      const choices = [
        ch("Watch him pour.", "", { checkStat: "ins", checkDC: 12, secret: true, next: "ag_tamsin_wick_slip_hit", failNext: "ag_tamsin_wick_slip_miss", requires: [{ beatMark: "ag_tamsin_wick_slip_hit", not: true }, { beatMark: "ag_tamsin_wick_slip_miss", not: true }] }),
        ch("\"Why only the wax candles?\"", "\"Are they?\" He looks at the nearest one as if it might answer. \"He brings his own. I assumed it was devotion. Everything he does, I assume is devotion. That's rather the point of him.\" The kettle goes back on the hob a little hard.", { requires: [TALLOW] }),
        ch("\"You know a lot about him.\"", "\"I know a lot about everyone. It's the chair. People sit in it and tell me things, and I remember them, because remembering is most of what the job is.\""),
        ...(exits.length ? exits : [ch("Back to the bread.", "", { next: "allesh_gilliam_tamsin_welcome", requires: { flag: "storyPhase", lte: 1 } }), ch("Ask something else.", "", { next: "allesh_gilliam_father_tamsin_conversation", requires: { flag: "storyPhase", gte: 2 } })])
      ];
      const same = b.description === desc && JSON.stringify(b.choices) === JSON.stringify(choices);
      if (same) report.push("· ok ag_tamsin_on_wick: already subtle");
      else { b.description = desc; b.choices = choices; changes++; report.push("✚ ag_tamsin_on_wick: rewritten — the pour is the tell, the catch is a secret Insight 12, 'Word for word' is gone"); }
      if (String(b.memoryText || "").includes("word for word")) { b.memoryText = ""; changes++; report.push("✚ ag_tamsin_on_wick: memory text cleared"); }
    }
    const conf = byId.get("ag_tamsin_confrontation");
    if (!conf) report.push("⚠ ag_tamsin_confrontation: NOT FOUND");
    else {
      conf.choices = Array.isArray(conf.choices) ? conf.choices : [];
      if (conf.choices.some(c => c?.requires?.some?.(r => r.beatMark === "ag_tamsin_wick_slip_hit"))) report.push("· ok ag_tamsin_confrontation: the catch already cashes in");
      else { conf.choices.unshift(ch("\"On the road, mostly.\" Those were his words, Father. You had them.", "He closes his eyes. \"Yes,\" he says. \"I thought you might have heard that.\"", { next: "ag_confessor_relief", requires: [{ beatMark: "ag_tamsin_wick_slip_hit" }] })); changes++; report.push("✚ ag_tamsin_confrontation: + hit-gated opening → ag_confessor_relief"); }
    }
  }

  /* ── C. the shrine stops finishing the sentence ──────────────────────── */
  {
    const b = byId.get("ag_wick_shrine");
    const from = "Somebody is keeping a road, all right. It isn't the flame's.", to = "Somebody is keeping a road.";
    if (!b) report.push("⚠ ag_wick_shrine: NOT FOUND");
    else if (String(b.description).includes(from)) { b.description = b.description.replace(from, to); changes++; report.push("✚ ag_wick_shrine: the narrator stops short"); }
    else report.push(String(b.description).includes(to) ? "· ok ag_wick_shrine" : "⚠ ag_wick_shrine: closing line not found — skipped");
  }

  console.log(`[patch-story-review-act01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Story review Act 0–1 DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Story review Act 0–1: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-review-act01-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Story review Act 0–1 APPLIED: ${changes} change(s). Tamsin pours. Nobody says anything.`);
})();
