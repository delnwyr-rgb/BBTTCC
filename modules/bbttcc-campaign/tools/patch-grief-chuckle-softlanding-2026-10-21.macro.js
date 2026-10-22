/* patch-grief-chuckle-softlanding-2026-10-21.macro.js — GRIEF TOWNS REWORK, Chuckle Creek + Soft Landing.
 *  Story Review Ledger: round 1 rows CC1–CC16 / SL1–SL12 as ACCEPTED, amended by round 2 rows R1–R13 (all ACCEPTED by Dave 2026-10-21).
 *
 *  The principle (Dave): discovery BUILDS — each rung needs the one before it and sends the table back to a place it has been, with more context.
 *  The swing is never offered (R1): cc_swing / sl_swing are GM-fired beats with no inbound route.
 *
 *  CHUCKLE CREEK ladder: hub (nameless, doors, costume compliments R2) → diner: pie + ONE tell (cc_table_set, R4) → "Come back after closing"
 *  (cc_corner_table, Pearl emotes R5) → the fourth chair → rung 2 → "Ask her about Winnie" (cc_ask_about_winnie, R6; replaces "last winter")
 *  → rung 1 (requires rung 2, R7) → Dewey's walk offered only after rung 1 (R8), he resets to the PIANO (R9) → rung 3 → the seam read on the hub,
 *  hidden until rung 3 (R10) → rung 4 → the Showrunner (requires rung 4). Grange = a menu from the start; the booth walks open after rung 4.
 *  SOFT LANDING ladder: hub (doors; the houses hidden until give_1, R12) → the bench (give_3, with things to do; "Sit down" → the card) → the
 *  birthday card (names) → "Ask about Teju" on the bounce, hidden until the card (R11) → give_1 → the houses → give_2 (knows Chuckle Creek, R12)
 *  → "Ask her what happened" hidden until give_2 (R13) → give_4 → The Only Weapon Left (requires give_4).
 *  Meters `chucklecreekSeen` / `softlandingGive` retired (Dave: "retire them"); every beat in both towns gets the storyPhase ≥ 2 act gate.
 *  Mal does bits at the doors and stops, out loud, at rung 1 of each town. Dave's paragraphs that moved are kept verbatim where they now land.
 *
 *  Idempotent; DRY_RUN default true; backs up `campaigns`; also updates the two quest-registry blurbs. GM only.
 *  Quest-log ladders (order + lines) live in scripts/story-scripts.js — same commit.
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
  const report = []; let changes = 0; let questsDirty = false;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const row = (label, next, description = "", requires = null, extra = {}) => Object.assign({ label, next, description, checkStat: "", checkDC: 0, failNext: "" }, extra, requires ? { requires } : {});
  const ACT2 = { flag: "storyPhase", gte: 2 };
  const played = (id) => ({ beatMark: id });

  // ---- helpers (all idempotent) ----
  const setDesc = (id, to, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); if (b.description === to) return report.push(`· ok ${id}: ${note}`); b.description = to; changes++; report.push(`✚ ${id}: ${note}`); };
  const rep = (id, from, to, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); const d = String(b.description || "");
    if (to && d.includes(to) && (to.includes(from) || !d.includes(from))) return report.push(`· ok ${id}: ${note}`); if (d.includes(from)) { b.description = d.replace(from, to); changes++; return report.push(`✚ ${id}: ${note}`); } report.push(`⚠ ${id}: baseline not found for "${note}"`); };
  const appendPara = (id, para, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); const d = String(b.description || ""); if (d.includes(para)) return report.push(`· ok ${id}: ${note}`); b.description = d.replace(/\s+$/, "") + "\n\n" + para; changes++; report.push(`✚ ${id}: ${note}`); };
  const setMem = (id, to, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); if (b.memoryText === to) return report.push(`· ok ${id}: ${note}`); b.memoryText = to; changes++; report.push(`✚ ${id}: ${note}`); };
  const setChoices = (id, list, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); if (same(b.choices, list)) return report.push(`· ok ${id}: ${note}`); b.choices = foundry.utils.deepClone(list); changes++; report.push(`✚ ${id}: ${note}`); };
  const addRow = (id, r, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); b.choices = Array.isArray(b.choices) ? b.choices : [];
    const ex = b.choices.find(c => c.label === r.label); if (ex) { if (same(ex, r)) return report.push(`· ok ${id}: ${note}`); for (const k of Object.keys(ex)) delete ex[k]; Object.assign(ex, foundry.utils.deepClone(r)); changes++; return report.push(`✚ ${id}: ${note} (row updated)`); }
    b.choices.push(foundry.utils.deepClone(r)); changes++; report.push(`✚ ${id}: ${note}`); };
  const dropRow = (id, label, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); const n = (b.choices || []).length; b.choices = (b.choices || []).filter(c => c.label !== label); if (b.choices.length < n) { changes++; report.push(`✚ ${id}: ${note}`); } else report.push(`· ok ${id}: ${note}`); };
  const setRequires = (id, rq, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); b.inject = b.inject || {}; if (same(b.inject.requires, rq)) return report.push(`· ok ${id}: ${note}`); b.inject.requires = foundry.utils.deepClone(rq); changes++; report.push(`✚ ${id}: ${note}`); };
  const dropMeter = (id, key, note) => { const b = byId.get(id); if (!b) return report.push(`⚠ ${id}: not found`); const m = b.worldEffects?.meters; if (!Array.isArray(m)) return report.push(`· ok ${id}: ${note}`);
    const n = m.length; b.worldEffects.meters = m.filter(x => x?.key !== key); if (!b.worldEffects.meters.length) delete b.worldEffects.meters; if ((b.worldEffects.meters?.length ?? 0) !== n) { changes++; report.push(`✚ ${id}: ${note}`); } else report.push(`· ok ${id}: ${note}`); };
  const newBeat = (tplId, id, label, description, choices, opts = {}, note) => { if (byId.has(id)) return report.push(`· ok ${id}: ${note}`); const tpl = byId.get(tplId); if (!tpl) return report.push(`⚠ ${tplId}: template not found`);
    const nb = foundry.utils.deepClone(tpl); nb.id = id; nb.label = label; nb.description = description; nb.choices = foundry.utils.deepClone(choices);
    delete nb.questStep; delete nb.refs; nb.inject = nb.inject || {}; delete nb.inject.requires; if (nb.worldEffects) { delete nb.worldEffects.meters; delete nb.worldEffects.receipts; delete nb.worldEffects.questEffects; }
    if (nb.audio) { nb.audio.enabled = false; nb.audio.src = ""; } if (opts.type) nb.type = opts.type; nb.priority = "background"; nb.story = { quest: opts.quest };
    if ("speaker" in opts) { if (opts.speaker) nb.speakerActorId = opts.speaker; else delete nb.speakerActorId; } if (opts.scene) nb.sceneId = opts.scene;
    if (opts.memoryText) nb.memoryText = opts.memoryText; else delete nb.memoryText;
    camp.beats.push(nb); byId.set(id, nb); changes++; report.push(`✚ ${id}: ${note}`); };
  const questBlurb = (qid, from, to, note) => { const qsRaw = game.settings.get(NS, "quests"); const qs = typeof qsRaw === "string" ? JSON.parse(qsRaw) : foundry.utils.deepClone(qsRaw); const q = qs?.[qid];   // deepClone: a DRY RUN must never mutate the live client object if (!q) return report.push(`⚠ quests.${qid}: not found`);
    const d = String(q.description || ""); const enc = (t) => t.replace(/'/g, "&#x27;"), enc2 = (t) => t.replace(/'/g, "&#39;");
    const hit = [from, enc(from), enc2(from)].find(f => d.includes(f)); if (!hit) { if ([to, enc(to), enc2(to)].some(t => d.includes(t))) return report.push(`· ok quests.${qid}: ${note}`); return report.push(`⚠ quests.${qid}: baseline not found`); }
    camp.__quests = camp.__quests || qs; camp.__quests[qid].description = d.replace(hit, hit === from ? to : (hit === enc(from) ? enc(to) : enc2(to))); questsDirty = true; changes++; report.push(`✚ quests.${qid}: ${note}`); };

  // =====================================================================================================================
  //  CHUCKLE CREEK
  // =====================================================================================================================
  const CC = "chuckle_arrival", CBACK = row("Back to the street", CC);
  const PEARL = "KkitDSabTpvCBRyH", DEWEY = "TMZYvjy1EjEKDr0M", HOLLIS = "51KRytzXHiuDPNj7";
  const SC_DINER = "qIQzCtAhCggG6MUW", SC_STREET = "yBhoAx8pozave2Iv", SC_GRANGE = "dAmD90H0worCVr8H", SC_EDGE = "PiL3ZW4pBk43Zyed", SC_SEAM = "JNlzdPrFP74NiKMe";
  const cc = { quest: "chuckle_creek" };

  // CC1 + R2 — the hub
  setDesc(CC,
    "The sky is a painted backdrop and the sun has a face, and the face is pleased to see you. A man on the corner takes an anvil to the skull, flattens to the thickness of a playing card, springs back, and tips his hat. Nobody looks up. Everyone on the street is in costume — a carhop, a cardboard mech, an elf, two ghostbusters — and nobody, anywhere, is treating it as a costume. A carhop tells you she loves yours. So does the elf. So does the man who was just flattened. Nobody asks what you're supposed to be; they're sure you know. (Everyone in costume on a weekday. Check one off the bingo card. Then check the bingo card, because the card is in costume too.) The creek chuckles. Actually chuckles — a low delighted burble, exactly like somebody enjoying a joke two rooms away. A diner. A grange hall with its doors open and cartoon light leaking out. A kid sitting very still under a piano that has not fallen yet.\n\n" +
    "Nothing is on fire. Nobody wants anything from you. Gravity here is a suggestion that most people politely decline. Pick a door.\n\n" +
    "⚙ GM: LET THE TABLE ENJOY THIS. The bait is the joy itself, and the longer they laugh, the harder the turn lands. Rung 0 is in plain sight: the kid under the piano is tired in a way children should not be. He has done this before. Many times. If somebody swings at Hollis unprovoked, play \"(GM) If Someone Swings\" — it is not on the menu by design.",
    "CC1/R2 hub text — no names, no swing, costume compliments, the doors");
  setChoices(CC, [
    row("The diner", "cc_diner"),
    row("The man with the anvil", "chuckle_hollis"),
    row("The kid under the piano", "chuckle_piano_kid"),
    row("The grange hall", "chuckle_projector"),
    row("The creek", "chuckle_creek_itself"),
    row("\"Watch the seam when the scene changes.\"", "chuckle_rung_4", "", [played("chuckle_rung_3")], { checkStat: "mind", checkDC: 12, failNext: "cc_seam_missed" })
  ], "CC1/R10 hub doors + the seam read (hidden until rung 3)");
  dropMeter(CC, "chucklecreekSeen", "CC1 meter retired on the hub");

  // CC2 + R1 — the swing, GM-fired only
  newBeat("chuckle_hollis", "cc_swing", "(GM) If Someone Swings",
    "You swing in earnest, because somebody at the table was always going to, and the world simply declines. The blade becomes a rubber chicken halfway through the arc. The man sees a halo of tweeting birds, sits down hard, and laughs, and so does everybody, including, somehow, the chicken. He gets up and tips his hat. You have the distinct feeling of having been forgiven for something you haven't finished doing yet.\n\n" +
    "**Mal:** *\"That's the physics. Nobody can be hurt here. Hold on to how good that feels. You'll want it later, for scale.\"*\n\n" +
    "⚙ GM: fire this only if a player hits someone unprovoked. It is not offered anywhere.",
    [CBACK], Object.assign({ speaker: HOLLIS, scene: SC_STREET, memoryText: "The Stewards swung at Hollis Bandy. The blade was a chicken. Everybody laughed, including Hollis." }, cc), "CC2/R1 cc_swing — GM-fired, no route in");

  // CC3 + R3 — the diner door
  newBeat("chuckle_pie", "cc_diner", "Chuckle Creek — The Diner",
    "The woman already pouring you coffee you didn't order is the owner, and the diner is hers, and so, for the next little while, are you. Chrome, red vinyl, a pie case fogged from the inside. A radio playing something you almost know. One table in the corner is set for four, and nobody is at it. \"Sit,\" she says. \"You look like a before picture.\" You realise you have not been introduced and have somehow already been adopted.\n\n" +
    "(A diner with a chrome counter and a woman who calls you honey. The author would like it noted that this is the second one in the campaign, and that he is not sorry.)",
    [
      row("Eat the pie", "chuckle_pie"),
      row("\"Ask who the corner table is for.\"", "cc_table_set"),
      row("\"Come back after closing.\"", "cc_corner_table", "", [played("cc_table_set")]),
      row("\"Ask her about Winnie.\"", "cc_ask_about_winnie", "", [played("chuckle_rung_2")]),
      CBACK
    ], Object.assign({ speaker: PEARL, scene: SC_DINER }, cc), "CC3/R3 cc_diner — pie and one tell");

  // R4 — the tell
  newBeat("chuckle_pie_fail", "cc_table_set", "Chuckle Creek — That's Set",
    "\"Oh, that's set,\" she says, and her hand stays on the fourth cup a beat longer than a hand needs to, and she looks at the door — not the way you look at a door, the way you look at a clock. Then she tops up your cup, which was full.",
    [row("Back to the counter", "cc_diner")], Object.assign({ speaker: PEARL, scene: SC_DINER, memoryText: "Pearl's corner table is set for four. Her hand stayed on the fourth cup." }, cc), "R4 cc_table_set — the cry for help she can't say");

  // CC6 + R5 — after closing
  newBeat("chuckle_rung_2", "cc_corner_table", "Chuckle Creek — After Closing",
    "After closing the diner is the only dark thing in town, and even that is a warm dark, like a television left on in another room. Pearl, off shift, sits at the corner table and sets the fourth place. Three cups. Then a fourth. She adds the sugar to the fourth without asking.\n\n" +
    "She does not look at you. She looks at the door the way you look at a clock, and when the scene changes — you have started to feel the seams — her hand goes to the fourth cup and holds it, and holds it, and lets go.",
    [
      row("\"Sit in the fourth chair.\"", "cc_fourth_chair"),
      row("\"Ask who she's waiting for.\"", "chuckle_rung_2"),
      row("\"Pour the fourth coffee for her.\"", "", "She lets you. \"Thank you, honey. Two sugars.\" She does not say who takes two sugars."),
      row("\"Ask her about Winnie.\"", "cc_ask_about_winnie", "", [played("chuckle_rung_2")]),
      row("Leave her to it", CC)
    ], Object.assign({ speaker: PEARL, scene: SC_DINER }, cc), "CC6/R5 cc_corner_table — she emotes it");

  // CC7 — the fourth chair
  newBeat("chuckle_rung_2", "cc_fourth_chair", "Chuckle Creek — The Fourth Chair",
    "You sit in the fourth chair. Pearl looks at you, and for one second you are not a person in a chair, you are a chair being occupied, and her face does the thing faces do when a shot comes back around wrong. Then she smiles and pours. \"You'll want to move, honey. Winnie's just off-screen.\" She says it exactly like that — off-screen — as if it were a location, like the porch, or the shop.",
    [
      row("Move", "chuckle_rung_2"),
      row("Stay sitting", "chuckle_rung_2", "She pours around you. The sugar goes in. The coffee goes cold in front of you, and she does not drink hers either.")
    ], Object.assign({ speaker: PEARL, scene: SC_DINER }, cc), "CC7 cc_fourth_chair");

  // CC8 — rung 2 as outcome
  setDesc("chuckle_rung_2",
    "Winnie, she explains — her daughter — is just off-screen at the moment. She is not sad. She is not deluded, either, in any way you can put a finger on. She is simply waiting for the shot to come back around, and she has waited long enough that the waiting has stopped being a thing she notices.",
    "CC8 rung 2 text (the sitting happened)");
  setMem("chuckle_rung_2", "Pearl sets a fourth place every night. Winnie is off-screen.", "CC8 memory");
  setChoices("chuckle_rung_2", [row("\"Ask her about Winnie.\"", "cc_ask_about_winnie"), CBACK], "CC8/R6 rows");
  setRequires("chuckle_rung_2", [ACT2], "CC8 meter gate dropped");

  // R6 — ask about Winnie (replaces "last winter")
  newBeat("chuckle_pie", "cc_ask_about_winnie", "Chuckle Creek — Ask About Winnie",
    "You ask about Winnie, because the fourth cup has made it the only question. She lights up.",
    [
      row("\"How old is she?\"", "", "\"Seven.\" Present tense, and she is so pleased you asked."),
      row("\"When did you last see her?\"", "", "\"Just now!\" She looks at the door. \"She's just off-screen, honey.\""),
      row("\"What was she like as a baby?\"", "", "Real effort — the tip-of-the-tongue face — and then: \"Oh, she's a pistol.\" Is. \"Pie?\""),
      row("\"Try one more, and watch her face.\"", "chuckle_rung_1"),
      row("Back to the counter", "cc_diner")
    ], Object.assign({ speaker: PEARL, scene: SC_DINER }, cc), "R6 cc_ask_about_winnie — three framings, then the read");
  setRequires("cc_ask_about_winnie", [ACT2, played("chuckle_rung_2")], "R6 requires rung 2");

  // CC5 + R7 — rung 1 as outcome, after the table
  setDesc("chuckle_rung_1",
    "You try one more time, and this time you watch her face while the question goes in. Something else comes out, cheerful and adjacent and utterly empty, and it isn't evasion. She isn't hiding a thing. There is no PAST TENSE here. There is only the current episode, and the current episode is going nicely.\n\n" +
    "**Mal:** *\"I'm going to stop doing bits for a minute.\"*",
    "CC5 rung 1 text (Mal stops doing bits)");
  setMem("chuckle_rung_1", "Pearl Ottway has no past tense for Winnie. Chuckle Creek has no past tense at all.", "CC5 memory");
  setChoices("chuckle_rung_1", [CBACK], "CC5 back row");
  setRequires("chuckle_rung_1", [ACT2, played("chuckle_rung_2")], "R7 rung 1 requires rung 2");

  // CC9 + R8 — the piano kid
  addRow("chuckle_piano_kid", row("\"Where do you go when it's not your turn?\"", "cc_walk_with_dewey", "\"Around.\" He shrugs under four hundred pounds of piano. \"You can come, if you want. I know where it gets quiet.\"", [played("chuckle_rung_1")]), "CC9/R8 the walk, offered after rung 1");
  addRow("chuckle_piano_kid", row("Pull him out from under it.", "", "You get him clear with a second to spare. The piano lands on nothing. He looks at the empty spot with something that is not quite disappointment and not quite relief, and the next one is already falling."), "CC9 protective row");
  addRow("chuckle_piano_kid", CBACK, "CC9 back row");
  dropMeter("chuckle_piano_kid", "chucklecreekSeen", "CC9 meter retired");

  // CC10 — the walk
  newBeat("chuckle_rung_3", "cc_walk_with_dewey", "Chuckle Creek — Between Pianos",
    "His name is Dewey, which he tells you as if it's a secret, which here it may be. Between pianos he walks: behind the grange, along the creek, out toward where the painted sky meets the painted ground. He talks the whole way, a joke with a very long setup. You notice he never once looks at the horizon.\n\n" +
    "(Chekhov's Horizon. The author is not even pretending any more.)",
    [
      row("\"Walk him to the edge of town.\"", "chuckle_rung_3"),
      row("\"Ask him what the number is.\"", "", "\"Pianos.\" He says it the way you'd say Tuesdays."),
      row("\"Ask him where he sleeps.\"", "", "He thinks about it. \"I don't think I've needed to.\" He isn't sad about it. He's eight."),
      row("Go back", CC)
    ], Object.assign({ speaker: DEWEY, scene: SC_EDGE }, cc), "CC10 cc_walk_with_dewey");
  setRequires("cc_walk_with_dewey", [ACT2, played("chuckle_rung_1")], "R8 requires rung 1");

  // CC11 + R9 — rung 3 as outcome, resets to the piano
  setDesc("chuckle_rung_3",
    "He wants to come. He is delighted to come — he packs a comically small suitcase, waves to the whole street, walks with you to the edge of town telling a joke with a very long setup. And at the boundary he simply RESETS. Mid-sentence, mid-stride: he is back under the piano, suitcase gone, joke un-begun, greeting you with unfeigned pleasure as if you had just arrived. He will never once be frightened, because nothing is happening to him. Nobody leaves Chuckle Creek. Leaving would require the episode to END, and the episode does not end.",
    "CC11/R9 rung 3 text (he resets to the piano)");
  setMem("chuckle_rung_3", "Dewey walked to the edge of town with the Stewards and reset to the piano. Nobody leaves Chuckle Creek.", "CC11 memory");
  setChoices("chuckle_rung_3", [
    row("\"Try again.\"", "", "He does it again. Same suitcase. Same joke. He is so glad to see you."),
    row("Go find him under the piano.", CC)
  ], "CC11/R9 rows");
  setRequires("chuckle_rung_3", [ACT2, played("chuckle_rung_1")], "rung 3 requires rung 1");

  // CC12 — the Movie Machine as a menu
  setDesc("chuckle_projector",
    "The grange hall is exactly as it was the night it happened, which you will understand later is the point. Folding chairs in rows. A pull-down screen. A popcorn cart that is still warm. And on a card table, an old-time film projector, all brass and reels, warm and ticking, throwing cartoons at the screen. A kid you might recognise is working the reels with enormous seriousness.",
    "CC12 projector text");
  setChoices("chuckle_projector", [
    row("Sit and watch.", "", "A cartoon town. A cartoon diner. A cartoon kid under a cartoon piano. It runs about four minutes ahead of the street outside, and when the cartoon anvil lands you hear the real one through the wall."),
    row("\"Ask what it plays.\"", "", "\"Movies.\" You ask what they're on. He looks at the reels and, for the first time since you met him, he doesn't have an answer. Nobody in Chuckle Creek remembers what a VHS was."),
    row("Look behind the screen.", "", "A plywood wall, painted. Behind the plywood, a real wall. Behind the real wall, a door with a window in it, and the window is dark."),
    row("\"Ask who runs it.\"", "", "\"Marnie. From the booth.\" Dewey lowers his voice. \"You can't go in the booth.\" He says it the way people here say everything: happily, and as if it were weather."),
    row("Try the booth door.", "chuckle_tape_shelf", "", null, { checkStat: "body", checkDC: 12, failNext: "cc_booth_locked" }),
    row("Walk into the booth.", "chuckle_tape_shelf", "", [played("chuckle_rung_4")]),
    CBACK
  ], "CC12 projector menu");
  dropMeter("chuckle_projector", "chucklecreekSeen", "CC12 meter retired");
  setRequires("chuckle_tape_shelf", [ACT2], "CC12 tape shelf: meter gate → act gate (reached by the booth door)");
  setRequires("chuckle_booth_exterior", [ACT2], "CC12 booth exterior: meter gate → act gate");

  // CC13 — the door that is not a door
  newBeat("chuckle_pie_fail", "cc_booth_locked", "Chuckle Creek — Not a Door That Opens",
    "The door does not open. It isn't locked; it is simply not a door that opens, the way the sky here is not a sky that rains. From inside, very faintly, the sound of a tape being rewound. Then the cartoon on the screen behind you skips, and when you turn back, the door is a plywood wall, painted.\n\n" +
    "⚙ GM: the booth opens on a second Body attempt, or walks open once the table has seen the title card.",
    [row("Back to the hall", "chuckle_projector")], Object.assign({ speaker: null, scene: SC_GRANGE }, cc), "CC13 cc_booth_locked");

  // CC14 + R10 — the title card, discovered
  setMem("chuckle_rung_4", "The Stewards saw the title card between scenes. It is a memorial. The names are on it.", "CC14 memory");
  setChoices("chuckle_rung_4", [row("Find whoever is running this", "chuckle_showrunner"), row("Not yet. Back to the street", CC)], "CC14 rows");
  setRequires("chuckle_rung_4", [ACT2, played("chuckle_rung_3")], "R10 rung 4 requires rung 3");
  setRequires("chuckle_showrunner", [ACT2, played("chuckle_rung_4")], "the Showrunner requires the title card (last rung alone)");

  // CC15 — the failed read
  newBeat("chuckle_rung_4", "cc_seam_missed", "Chuckle Creek — Consoled",
    "You look right at it and the scene changes anyway, the way they do, and whatever was there is gone before your eye agrees it was there. Across the street Hollis tips his hat at you, which he does for everyone, and you have the unpleasant sense of having been consoled.",
    [CBACK], Object.assign({ speaker: null, scene: SC_SEAM }, cc), "CC15 cc_seam_missed");

  // CC16 — Hollis
  addRow("chuckle_hollis", row("\"Ask him what year it is.\"", "", "He tips his hat. You are starting to think the hat is the answer."), "CC16 year row");
  addRow("chuckle_hollis", row("\"Ask him to stop.\"", "", "He stops. For three full seconds nothing happens to Hollis Bandy, and he looks at his hands like he has never seen them, and then the anvil comes, and the relief on his face is the second sad thing Hollis Bandy will ever do."), "CC16 stop row");
  addRow("chuckle_hollis", CBACK, "CC16 back row");
  dropMeter("chuckle_hollis", "chucklecreekSeen", "CC16 meter retired");

  // doors kept verbatim: back rows + meters
  addRow("chuckle_creek_itself", CBACK, "creek back row");
  dropMeter("chuckle_creek_itself", "chucklecreekSeen", "creek meter retired");
  addRow("chuckle_pie", row("Back to the counter", "cc_diner"), "pie back row");
  dropMeter("chuckle_pie", "chucklecreekSeen", "pie meter retired");
  dropMeter("chuckle_rental_slip", "chucklecreekSeen", "rental slip meter retired (receipt kept)");

  questBlurb("quest_chuckle_creek", "Enjoy it. Then ask somebody what last winter was like.", "Enjoy it. Then pick a door.", "quest blurb — no more last winter");

  // =====================================================================================================================
  //  SOFT LANDING
  // =====================================================================================================================
  const SL = "soft_landing_arrival", SBACK = row("Back to the street", SL);
  const OKORO = "Z731OVuQtbOC8CeB", ADAEZE = "83ciQqkdJiCLxQgb";
  const SC_GATE = "yI6IdUkuDGX4YOH1", SC_BOUNCE = "IF5ax24f0OYivH4Z", SC_BENCH = "2KmGoWlRT2cbsPv6", SC_TOWN = "msDaFL1HaHJmZ2Kc";
  const sl = { quest: "soft_landing" };

  // SL1 + R1 — the hub
  setDesc(SL,
    "The gate is an inflatable arch, sagging slightly in the middle, and the guards challenge you with pool noodles and immense seriousness. The streets give underfoot — you BOING faintly with every step, and by the third street you have stopped trying not to. Children ricochet between buildings. So do several adults, one of whom appears to be a minister of something. A formal state function is being conducted, with full ceremony, on a moon-bounce. Over the rooftops, still up, still roaring, is the castle. Everyone is in costume — mechs, elves, a bumblebee, two ghostbusters — and nobody, anywhere, is treating it as a costume. Three people tell you they love yours before you reach the first corner.\n\n" +
    "(Two ghostbusters. Third town running. The author has either a type or a budget.)\n\n" +
    "Nothing has an edge. The cutlery at the party is foam. The lampposts are foam. Somewhere under everything a fan is roaring, and nobody hears it. On a bench at the edge of the party a bumblebee with bent antennae is sitting very, very still.\n\n" +
    "⚙ GM: let them play. Let them LOVE it. Rung 0 is in plain sight for anyone who looks twice — even the cutlery is foam. The softness isn't whimsy. It is total, and someone is afraid of every edge in the world. If somebody throws a punch unprovoked, play \"(GM) If Someone Swings\" — it is not on the menu by design.",
    "SL1/R1 hub text — no Falk by name, no swing, the doors");
  setChoices(SL, [
    row("The checkpoint", "soft_landing_checkpoint"),
    row("The state function", "soft_landing_state_function"),
    row("The castle", "soft_landing_castle"),
    row("The cake", "soft_landing_cake"),
    row("The bumblebee who isn't bouncing", "soft_landing_give_3"),
    row("The houses", "sl_houses", "", [played("soft_landing_give_1")]),
    row("Follow the hum down", "soft_landing_blower")
  ], "SL1/R12 hub doors (the houses hidden until give_1)");
  dropMeter(SL, "softlandingGive", "SL1 meter retired on the hub");

  // SL2 + R1 — the swing, GM-fired only
  newBeat("soft_landing_checkpoint_fail", "sl_swing", "(GM) If Someone Swings",
    "Somebody misunderstands somebody — or doesn't, and swings anyway — and the world simply absorbs it. The fist lands in foam, the foam apologises, everyone laughs, and the person you hit offers you a slice of cake. Nobody can be hurt here. Hold on to how good that feels.\n\n" +
    "**Mal:** *\"You hit a town and the town said thank you. I'm not judging. I'm counting.\"*\n\n" +
    "⚙ GM: fire this only if a player hits someone unprovoked. It is not offered anywhere.",
    [row("Bounce", SL)], Object.assign({ speaker: null, scene: SC_TOWN, type: "dialog", memoryText: "The Stewards threw a punch in Soft Landing. The foam apologised." }, sl), "SL2/R1 sl_swing — GM-fired, no route in");

  // SL3 — the checkpoint
  appendPara("soft_landing_checkpoint", "(Form 7-B. Bureaucracy survived the end of the world. The author would like it on record that this is the least surprising thing in the campaign.)", "SL3 Form 7-B aside");
  addRow("soft_landing_checkpoint", row("Mind the step", SL), "SL3 back row");
  dropMeter("soft_landing_checkpoint", "softlandingGive", "SL3 meter retired");

  // SL4 — the state function
  addRow("soft_landing_state_function", row("\"Ask the Mayor where she's from.\"", "sl_ask_around"), "SL4 → sl_ask_around");
  addRow("soft_landing_state_function", row("Climb down", SL), "SL4 back row");
  dropMeter("soft_landing_state_function", "softlandingGive", "SL4 meter retired");

  // SL5 + R11 — ask around
  newBeat("soft_landing_state_function", "sl_ask_around", "Soft Landing — Ask Me Anything",
    "Between arcs she lands beside you, sash askew, delighted. \"Ask me anything! Item three!\" You ask the ordinary thing.",
    [
      row("\"Where are you from?\"", "", "\"Here!\" Up. Down. \"Well — here-ish.\" A joke about a hamlet called Elsewhere arrives in its place, and it's a good joke, and you laugh, and the question is gone."),
      row("\"Who did you come here with?\"", "", "\"Everyone!\" She gestures at the air, which is full of people. The gesture includes nobody in particular."),
      row("\"What did you do before?\"", "", "\"Before cake?\" Universal laughter. A minister ricochets past. You realise you've been handed a smaller question and are holding it."),
      row("\"Ask about Teju, and watch where it goes.\"", "soft_landing_give_1", "", [played("soft_landing_birthday_card")]),
      row("Bounce", "soft_landing_state_function")
    ], Object.assign({ speaker: OKORO, scene: SC_BOUNCE }, sl), "SL5/R11 sl_ask_around — three framings; Teju once you have the card");

  // SL6 + R11 — give_1 as outcome
  setDesc("soft_landing_give_1",
    "You ask about Teju. And the name BOUNCES. Not rudely. It is deflected with real warmth, redirected into a joke, absorbed and returned as something lighter, every single time, by every single person, with a fluency that no group of people arrives at by accident. They are not avoiding grief carelessly. They have engineered the deflection, and they have practised it for years.\n\n" +
    "**Mal:** *\"Okay. Bits over for a bit.\"*",
    "R11 give_1 text (the name bounces; Mal stops doing bits)");
  setMem("soft_landing_give_1", "Nobody in Soft Landing will say Teju's name back to you. The deflection is practised.", "R11 memory");
  setChoices("soft_landing_give_1", [row("Back down", SL)], "SL6 back row");
  setRequires("soft_landing_give_1", [ACT2, played("soft_landing_birthday_card")], "R11 give_1 requires the card");

  // SL7 + R12 — the houses
  newBeat("soft_landing_give_2", "sl_houses", "Soft Landing — The Houses",
    "You are invited into several houses, warmly, within the hour. Foam doorframes. Foam mantelpieces. A kettle that is somehow also foam and somehow also boiling. The walls are bright and bare in the way of a place that was decorated this morning.",
    [
      row("\"Ask to see the family photographs.\"", "", "\"Photographs!\" A delighted search. A drawer full of party hats. Another. Nobody is embarrassed. Nobody finds one."),
      row("\"Ask where the graveyard is.\"", "", "The word doesn't bounce. It just doesn't arrive. Your host asks if you'd like to see the trampoline."),
      row("\"Ask for the oldest thing in the house.\"", "", "A pair of child's sneakers, kept on the mantel, lights in the heels long dead. \"Those are Teju's,\" says nobody. The host says, \"Those are for the castle,\" and smiles, and you let it go, for now."),
      row("\"Put it together.\"", "soft_landing_give_2"),
      SBACK
    ], Object.assign({ speaker: null, scene: SC_TOWN }, sl), "SL7 sl_houses");
  setRequires("sl_houses", [ACT2, played("soft_landing_give_1")], "R12 the houses require give_1");

  // SL8 + R12 — give_2 as outcome
  setDesc("soft_landing_give_2",
    "{{#played chuckle_rung_1}}You have seen this once already, in a town with a creek that laughed, and this time you know what you are looking for. {{/played}}There are no graves. No memorial stones, no plaques, no cairns, not so much as a name scratched into a wall. There are no old photographs in any house you were invited into, and you were invited into several, warmly. There is no monument to anything. There is no ARCHIVE.\n\n" +
    "This is not a people who moved on. Moving on leaves traces. These people never forgot a thing. They took away every surface a memory could land on, on purpose, as civic policy — and then padded the policy so it wouldn't hurt to touch.",
    "SL8/R12 give_2 text (knows Chuckle Creek)");
  setMem("soft_landing_give_2", "Soft Landing has no graves, no photographs, no archive. The absence is policy.", "SL8 memory");
  setChoices("soft_landing_give_2", [SBACK], "SL8 back row");
  setRequires("soft_landing_give_2", [ACT2, played("soft_landing_give_1")], "R12 give_2 requires give_1");

  // SL9 — the bench door (Adaeze named once you sit)
  rep("soft_landing_give_3", "You find Adaeze Kolm sitting apart, still in a bumblebee costume with the antennae bent,", "You find the bumblebee sitting apart, antennae bent,", "SL9 she is not named until you sit");
  setChoices("soft_landing_give_3", [
    row("\"Sit down.\"", "soft_landing_card"),
    row("\"Ask her why she isn't bouncing.\"", "", "She considers it with real courtesy. \"Tired, love.\" The antennae nod. That is the whole answer and it is the truest thing anyone in this town has said to you."),
    row("Feel the ground around her.", "", "Four feet of hard. Beyond it, give. You could draw the circle with chalk."),
    row("Offer to bounce with her.", "", "She laughs, which costs her something. \"Oh, I'd come down.\" She says it like a diagnosis."),
    row("Leave her be", SL)
  ], "SL9 bench rows");
  setRequires("soft_landing_give_3", [ACT2], "SL9 meter gate dropped (a door now)");
  rep("soft_landing_card", "She doesn't look up when you sit.", "Her name is Adaeze Kolm, which she offers the way you'd offer a seat. She doesn't look up when you sit.", "SL9 named once you sit");
  setRequires("soft_landing_card", [ACT2], "SL9 card: meter gate → act gate");

  // SL10 + R13 — the birthday card
  setChoices("soft_landing_birthday_card", [
    row("Pocket it.", ""),
    row("\"Ask her what happened.\"", "soft_landing_give_4", "", [played("soft_landing_give_2")]),
    row("Give it back", "soft_landing_card", "She takes it the way you'd take back something you'd set down.")
  ], "SL10/R13 card rows (what happened — once the archive is found missing)");
  dropMeter("soft_landing_birthday_card", "softlandingGive", "SL10 meter retired (receipt kept)");

  // SL11 — give_4 and the closer
  setRequires("soft_landing_give_4", [ACT2, played("soft_landing_give_2")], "R13 give_4 requires give_2");
  setRequires("soft_landing_choice", [ACT2, played("soft_landing_give_4")], "The Only Weapon Left requires One Held Breath (last rung alone)");

  // doors kept verbatim: back rows + meters
  addRow("soft_landing_castle", SBACK, "castle back row"); dropMeter("soft_landing_castle", "softlandingGive", "castle meter retired");
  addRow("soft_landing_cake", SBACK, "cake back row"); dropMeter("soft_landing_cake", "softlandingGive", "cake meter retired");
  addRow("soft_landing_blower", row("Back up", SL), "blower back row"); dropMeter("soft_landing_blower", "softlandingGive", "blower meter retired");

  questBlurb("quest_soft_landing", "Ask someone where they're from and watch what happens to the question.", "Find the one who isn't bouncing.", "quest blurb — the bench first");

  // ---- Act gate on every beat of both towns (keeps the campaign lint's act inference honest; P07 stays at baseline) ----
  for (const b of camp.beats) {
    if (!/^(chuckle_|cc_|soft_landing_|sl_)/.test(b.id)) continue;
    b.inject = b.inject || {}; let rq = b.inject.requires; rq = rq == null ? [] : (Array.isArray(rq) ? rq : [rq]);
    const kept = rq.filter(r => !(r && (r.flag === "chucklecreekSeen" || r.flag === "softlandingGive")));
    const hasAct = kept.some(r => r && r.flag === "storyPhase");
    const next = hasAct ? kept : [ACT2, ...kept];
    if (same(next, rq)) continue;
    b.inject.requires = next; changes++; report.push(`✚ ${b.id}: act gate (meter gate dropped: ${kept.length !== rq.length})`);
  }

  console.log(`[grief chuckle+softlanding 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-grief-cc-sl-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  const quests = camp.__quests; delete camp.__quests;
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (questsDirty && quests) { const qsRaw = game.settings.get(NS, "quests"); await game.settings.set(NS, "quests", typeof qsRaw === "string" ? JSON.stringify(quests) : quests); }
  ui.notifications.info(`Applied ${changes} change(s) — Grief Towns rework, Chuckle Creek + Soft Landing.`);
})();
