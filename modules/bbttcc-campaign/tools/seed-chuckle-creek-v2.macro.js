/* seed-chuckle-creek-v2.macro.js — CHUCKLE CREEK to the bible (2026-09-22). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/CHUCKLE_CREEK_SCRIPT_2026_09_22.md (Dave: "I really dig it — let's produce it"), bible draft 2.
 * Builds ON the 2026-08-18 seeder (run that first if the town has never been seeded — this one checks).
 *
 *  1. NPC actors + Mal-voice personas with armed secrets: Pearl Ottway, Marnie Vell, Dewey Pratt, Hollis Bandy.
 *  2. Seven new beats (pie, piano kid, tape shelf, rental-slip marker, credits, the creek, Hollis) with
 *     speakers, checks, story declarations, worldEffects.meters (+1 chucklecreekSeen, capped 4) and the
 *     Rental Slip receipt. Existing beats get small edits (names, the plaque, the showrunner's choices move
 *     to chuckle_credits; a hidden 4th choice "Play the tape to the end" gated on the slip).
 *  3. The quest's STORY SCRIPT written to campaign.story (Layer 2 data — editable on the Quests tab ✦ Script;
 *     wins over the shipped code script by key).
 *
 * Idempotent: marker-guarded personas; beats by id (existing edits re-applied only if text differs).
 * Backs up the campaigns setting before writing. F5 afterwards.
 */
(async () => {
  const DRY_RUN = false;                      // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const Q = "quest_chuckle_creek", KEY = "chuckle_creek", METER = "chucklecreekSeen";
  const MARKER = "[CHUCKLE-CREEK-V2-2026-09-22]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. personas ────────────────────────────────────────────────────────────
  const PERSONAS = [
    { name: "Pearl Ottway", create: { type: "npc" },
      topics: "the diner, pie, coffee, the corner table, Winnie, last winter, Hollis, the creek, Marnie and the projector, movie night, the grange hall, the town, hats, costumes, Halloween",
      notes: `${MARKER} PRIVATE TRUTH — Pearl Ottway runs the Creekside Diner in Chuckle Creek. VOICE: warm, fast, never still; feeds people whether or not they're hungry; calls everyone honey; "you look like a before picture." She sets FOUR places at the corner table and sits at three of them in turn so nobody's lonely. The fourth is Winnie's, her daughter, who is "off-screen" — Winnie died on movie night, 2077; Pearl has not said so in two hundred years and the town's whole physics exists so she never has to. She cannot say the word "week", "winter" or a year: the question slides off and she gets very busy. If a Steward is kind and patient she will name the pie she made for Winnie's last birthday, and then she cannot name the year, and then she is very busy. NEVER breaks the bit on her own. Funny first: the pie is forty percent pie and sixty percent optimism. HALLOWEEN (canon): movie night was Halloween night 2077 and everyone in town is STILL IN COSTUME — Pearl's is a 1950s carhop with a paper hat; she does not know it is a costume; Winnie was dressed as a ghostbuster, which Pearl will say only if asked what Winnie WORE, never what happened.`,
      secrets: [
        "The Fourth Plate :: stirThePot :: a Steward asks WHO the fourth plate is for instead of why it is empty :: \"Winnie's. She's off-screen. She's always off-screen, that girl, she'll be along.\" — the first time anyone has asked in a way Pearl could answer.",
        "Last Winter :: rollPlus2 :: a Steward asks Pearl what she MADE for Winnie's last birthday, not when it was :: Pearl names the pie (a buttermilk chess pie with a laugh-track of meringue). Then she reaches for the year and it isn't there, and she is suddenly very busy with the coffee."
      ] },
    { name: "Marnie Vell", create: { type: "npc" },
      topics: "the projector, the tapes, the stack, the booth, movie night, Halloween, the grange hall, the show, episodes, reruns, the laugh track, the legal pad, credits, 2077, Crown Mall Video, the rental, the due date, Pearl, Winnie, the title card",
      notes: `${MARKER} PRIVATE TRUTH — Marnie Vell is the Showrunner of Chuckle Creek. She ran the projector on movie night, 2077, and had the microphone when the window went white, and she said "Ha, that's on the tape too," and the room laughed instead of screaming, and she has been keeping them laughing ever since. VOICE: dry, tired, precise, a stage manager's clip; hates the laugh track she can't turn off; writes every episode on a legal pad. Not a villain — a woman who made one kind joke and has paid for it in reruns for two centuries. She has never let the tape reach its credits because credits mean it's over. She is not hiding; she is the pleasant background hum. She wants the season to end and does not know how to say the other thing. THE BOOTH (canon 2026-09-25): the grange shows a cartoon "movie machine" — an old-time film projector, because that is what a cartoon thinks a projector is. The REAL machinery is in Marnie's booth, the one room the cartoon never redrew: a VHS deck patched into an LCD projector, and the tapes from Crown Mall Video stacked weird, the way Crown Mall stacks them. One slot is empty. Marnie's costume: she came as a projectionist. It was not a joke then either.`,
      secrets: [
        "That's On the Tape Too :: oppRollMinus2 :: a Steward asks Marnie what the LAST thing on the tape was, or asks to see the credits :: \"There aren't any credits. I never let it get to the credits. Credits mean it's over.\"",
        "The Legal Pad :: rollPlus2 :: a Steward asks what NEXT week's episode is :: There is no next week's episode. Every page of the pad is the same page, in the same hand, dated the same night. She shows you."
      ],
      courtDoor: "they bring the rental slip and ask her to let the tape run to the credits with the town watching — not to confess, to finish" },
    { name: "Dewey Pratt", create: { type: "npc" },
      topics: "the piano, the number, gags, the seam, the edge of town, the backdrop, rocks, Pearl, Hollis, being new, four minutes, the movie machine, costumes",
      notes: `${MARKER} PRIVATE TRUTH — Dewey Pratt, ten, gets flattened by an upright piano every episode and springs up laughing with a noise like a party horn. He has done it eleven thousand and six times and counts. He is tired in a way kids shouldn't be, and he is the only person in town who has noticed the seam where the scene changes. VOICE: cheerful, blunt, a little proud, wanders off mid-sentence; offers to do the gag again ("it's in about four minutes"). He tried to walk past the edge once and was back at the diner before he finished trying. He will show a Steward the seam if they follow instead of ask. Costume: a cardboard-box mech with one arm missing (it fell off in 2077; he does not miss it). Ask him what the projector is and he says "the movie machine" — nobody in town remembers what a VHS was; that forgetting is a clue.`,
      secrets: [
        "The Seam :: rollPlus2 :: a Steward asks Dewey where the scene CHANGES, or follows him when he wanders off between gags :: He shows them the edge of town where the painted road stops and the backdrop meets the sky. \"Nobody walks past there. I tried once. I was back at the diner before I finished trying.\""
      ] },
    { name: "Hollis Bandy", create: { type: "npc" },
      topics: "anvils, hats",
      notes: `${MARKER} PRIVATE TRUTH — Hollis Bandy, the anvil man. Takes an anvil to the skull in the opening gag, flattens to the thickness of a playing card, springs back, tips his hat. He says NOTHING. Ever. If asked a question he tips his hat. If asked three times he tips it slower, and that is the only sad thing he will ever do. He is the town's metronome. Mal should never give him a line.`,
      secrets: [] }
  ];
  const actorIds = {};
  for (const p of PERSONAS) {
    let actor = (game.actors?.contents || []).find(a => a.name === p.name);
    if (!actor) { say(`✚ CREATE actor "${p.name}"`); changes++; if (!DRY_RUN) actor = await Actor.create({ name: p.name, type: p.create.type }); }
    if (!actor) continue;
    actorIds[p.name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${p.name}`); continue; }
    const next = { ...cur };
    next.topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    next.notes  = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    if (p.secrets.length) { const raw = String(cur.secretsRaw || ""); const fresh = p.secrets.filter(l => !raw.includes(l.split("::")[0].trim())); if (fresh.length) next.secretsRaw = [raw.trim(), ...fresh].filter(Boolean).join("\n"); }
    if (p.courtDoor && !String(cur.courtDoor || "").trim()) next.courtDoor = p.courtDoor;
    changes++; say(`✚ persona ${p.name} +${p.secrets.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", next);
  }
  const sp = (n) => actorIds[n] || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  if (!byId.get("chuckle_arrival")) return ui.notifications.error("Run seed-chuckle-creek.macro.js (2026-08-18) first — the town has never been seeded.");

  const TAGS = "chuckle_creek grief_refusals story discovery";
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, meters = null, receipts = null, story = null, requires = null, timePoints = 0, priority = "background", memoryText = null, questEffects = null, outcomes = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q, tags: TAGS, politicalTags: "",
    description, outcomes: outcomes || { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority,
    ...(speaker ? { speakerActorId: speaker } : {}),
    ...(story ? { story } : { story: { quest: KEY } }),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(meters ? { meters } : {}), ...(receipts ? { receipts } : {}), ...(questEffects ? { questEffects } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const seen = (n = 1) => [{ key: METER, delta: n, max: 4, min: 0 }];

  const NEW = [
    beat("chuckle_pie", "Chuckle Creek — The Pie Is Mostly Steam",
      "Pearl sets down a pie that is, on inspection, about forty percent pie. The rest is steam, arranged with real artistry, and a kind of aggressive optimism you can taste. \"Eat,\" she says. \"You look like a before picture.\" Hollis Bandy, at the counter, takes an anvil to the head from nowhere in particular, flattens, springs back, and tips his hat to you. Nobody looks up. The creek, outside, chuckles.",
      { speaker: sp("Pearl Ottway"), meters: seen(1), outcomes: { success: null, failure: "Pearl pats your hand. \"You'll get there, honey.\" More pie appears. It is, somehow, more steam than before." }, choices: [
        ch("\"This is the best pie I've had in weeks.\"", "", { checkStat: "presence", checkDC: 12, description: "Pearl warms — and says \"weeks? honey, what's a week.\"" }),
        ch("\"Where does the steam go?\"", "", { checkStat: "mind", checkDC: 12, description: "There are no crumbs on any plate in the diner. Not one." }),
        ch("Ask about the man with the anvil.", "", { description: "\"Hollis? Hollis is fine. Hollis is always fine.\"" })
      ] }),
    beat("chuckle_piano_kid", "Chuckle Creek — The Piano Kid",
      "A piano falls on a child. It's a full-size upright, and it lands with the sound a piano makes, and the boy under it is flat as a doormat for exactly one second before he inflates back up with a noise like a party horn and laughs so hard he has to sit down. \"Eleven thousand and six,\" he says, to nobody. Then, to you: \"You're new. Want to see it again? It's in about four minutes.\"",
      { speaker: sp("Dewey Pratt"), meters: seen(1), choices: [
        ch("\"Eleven thousand and what?\"", "", { description: "He looks at you like you're the first person who heard him." }),
        ch("\"Does it hurt?\"", "", { description: "\"Nope. That's the whole thing about here.\"" }),
        ch("\"Where do you go when it's not your turn?\"", "", { description: "He wanders. Follow him later — he knows where the scene changes." })
      ] }),
    beat("chuckle_creek_itself", "Chuckle Creek — The Creek",
      "The creek actually chuckles. Not a brook's babble — a chuckle, low and companionable, the sound of someone who has just remembered a good one. You stand in it up to the ankles and wait for it to tell you. It doesn't. It just keeps chuckling, and after a while you notice the laugh has no source, the way a laugh track has no source.",
      { meters: seen(1), choices: [ch("Laugh with it.", "", { description: "It gets louder. Politely." }), ch("Listen for where it starts.", "", { description: "It doesn't start. It has been going the whole time." })] }),
    beat("chuckle_hollis", "Chuckle Creek — Hollis Bandy",
      "Hollis Bandy takes an anvil to the skull for you, personally, as a courtesy. He flattens to the thickness of a playing card, springs back, and tips his hat. You ask him something. He tips his hat. You ask again. He tips his hat. You ask a third time, and he tips it slower, and that is the only sad thing Hollis Bandy will ever do.",
      { speaker: sp("Hollis Bandy"), meters: seen(1), choices: [ch("Tip yours back.", "", { description: "He nods. You are, apparently, in." })] }),
    beat("chuckle_projector", "Chuckle Creek — The Movie Machine",
      "The grange hall is exactly as it was the night it happened, which you now understand is the point. Folding chairs in rows. A pull-down screen. A popcorn cart. And on a card table, an old-time film projector, all brass and reels, warm and ticking, throwing cartoons at the screen. You ask what it is. \"The movie machine,\" says Dewey, as if you'd asked what a chair was. You ask what it plays. \"Movies.\" You ask what they're on. He looks at the reels, and for the first time since you met him he doesn't have an answer. Nobody in Chuckle Creek remembers what a VHS was.",
      { speaker: sp("Dewey Pratt"), meters: seen(1), choices: [
        ch("\"Who runs it?\"", "", { description: "\"Marnie. From the booth. You can't go in the booth.\"" }),
        ch("Look behind the screen.", "", { description: "A plywood wall, painted. Behind the plywood, a real wall. Behind the real wall, the booth." })
      ] }),
    beat("chuckle_tape_shelf", "Chuckle Creek — The Stack",
      "Marnie's booth is the one room the cartoon never redrew. Real shadows. A VHS deck patched into an LCD projector with a cable that has been repaired eleven times. A legal pad. And against the wall, the tapes: dozens of them in bright sleeves, stacked weird — leaning towers, spines every direction, the way nobody stacks tapes unless they learned it somewhere. You have seen tapes stacked exactly like this before, in a mall, eleven hexes down the coast. One slot in the stack is empty. There's a rental slip tucked in it.",
      { requires: { flag: METER, gte: 3 }, choices: [
        ch("Take the slip.", "chuckle_rental_slip"),
        ch("Put the missing tape back in the deck.", "", { description: "The credits start to roll on the grange screen and Marnie, from the doorway, kills the power. The slip is still there." }),
        ch("Leave it.", "", { description: "Nothing changes. Which is what everyone here has chosen for two hundred years." })
      ] }),
    beat("chuckle_rental_slip", "Chuckle Creek — The Rental Slip",
      "CROWN MALL VIDEO, the slip says, in a font that was already retro in 2077. One tape, rented October 31, 2077, in pencil. DUE: NOVEMBER 1. Never returned, because there was no November 1. It is the only written date in Chuckle Creek and it is in your hand, and somewhere down the coast a late fee has been running for two hundred years.",
      { type: "narration", priority: "high", meters: seen(1), receipts: [
        { label: "The Rental Slip", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the stack in Marnie's booth" },
          truth: "Chuckle Creek rented one tape from Crown Mall Video on Halloween night 2077 and never returned it — DUE NOVEMBER 1, and there was no November 1. The only written date in town. Produce it at the credits and the town can watch the end together; produce it to Father Tamsin and he will see what one kind lie kept alive for two hundred years; produce it at Crown Mall and Kickflip will quote you the late fee." }
      ], choices: [ch("Pocket it.", "")] }),
    beat("chuckle_credits", "Chuckle Creek — Roll Credits",
      "Marnie hands you the microphone. It's live. It's been live since 2077. \"I said it to keep a room from screaming,\" she says. \"It worked. It's still working. I don't know how to say the other thing.\" Somewhere in the diner Pearl is setting a fourth plate. The creek chuckles. Hollis tips his hat.",
      { speaker: sp("Marnie Vell"), priority: "high", timePoints: 1, choices: [
        ch("Series Finale — let consequence back in", "chuckle_finale"),
        ch("New Episode — keep the broadcast, kill the rerun", "chuckle_new_episode"),
        ch("Cancelled — pull the plug now", "chuckle_cancelled"),
        ch("Play the tape to the end.", "chuckle_finale", { requires: { beatMark: "chuckle_rental_slip" }, description: "The town watches the credits together. Pearl says Winnie's name out loud during them. It is a funeral with a laugh track and it is the best day Chuckle Creek has had since 2077." })
      ] })
  ];
  for (const nb of NEW) {
    const cur = byId.get(nb.id);
    if (cur) { say(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}${nb.inject?.requires ? ` (gated ${METER} ≥ ${nb.inject.requires.gte})` : ""}`);
  }
  // v3 (2026-09-25): the shelf moved into Marnie's booth + the due date — re-apply if the earlier v2 text is live
  const v3 = (id) => NEW.find(b => b.id === id);
  for (const id of ["chuckle_tape_shelf", "chuckle_rental_slip"]) {
    const live = byId.get(id), want = v3(id);
    if (live && want && !/Crown Mall/i.test(live.description)) { Object.assign(live, { label: want.label, description: want.description, choices: want.choices, worldEffects: want.worldEffects }); changes++; say(`✎ ${id}: v3 text (the booth, the due date)`); }
  }
  // v3.1 (2026-09-25, lint E15/C05 on the seeded save): receipt acquisition must be earned|stolen; the pie's checks get a failure line
  { const live = byId.get("chuckle_rental_slip"); const r = live?.worldEffects?.receipts?.[0]; if (r && r.acquisition === "found") { r.acquisition = "earned"; r.source = { name: "the stack in Marnie's booth" }; changes++; say("✎ chuckle_rental_slip: receipt acquisition found → earned"); } }
  { const live = byId.get("chuckle_pie"); const want = NEW.find(b => b.id === "chuckle_pie"); if (live && want && !live.outcomes?.failure) { live.outcomes = want.outcomes; changes++; say("✎ chuckle_pie: failure outcome"); } }
  // existing-beat edits
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  edit("chuckle_arrival", b => {
    b.speakerActorId = sp("Pearl Ottway") || b.speakerActorId || null;
    b.story = { quest: KEY, role: "start" };
    if (!/Pearl/.test(b.description)) b.description = b.description.replace(/tips his hat to you\./, "tips his hat to you. That's Hollis Bandy. The woman already pouring you coffee you didn't order is Pearl Ottway, and the diner is hers, and so, for the next little while, are you. It takes a minute to notice that everyone here is in costume — a carhop, a cardboard mech, an elf, two ghostbusters — and that nobody, anywhere, is treating it as a costume.");
    b.worldEffects = { ...(b.worldEffects || {}), meters: seen(0) };
  }, "Pearl + Hollis named, speaker, story start");
  edit("chuckle_rung_2", b => { b.speakerActorId = sp("Pearl Ottway") || b.speakerActorId || null; if (!/Winnie/.test(b.description)) b.description = b.description.replace(/Her daughter, she explains,/, "Winnie, she explains — her daughter —"); }, "Winnie named, Pearl speaks");
  edit("chuckle_rung_3", b => { b.speakerActorId = sp("Dewey Pratt") || b.speakerActorId || null; }, "Dewey speaks");
  edit("chuckle_rung_4", b => { if (!/IN LOVING MEMORY/.test(b.description)) b.description += "\n\nThe card reads, in the same warm hand every time: IN LOVING MEMORY — MOVIE NIGHT — 2077 — \"THAT'S ON THE TAPE TOO.\" Under it, names. One of them is on a plate at the diner."; }, "the plaque's line");
  edit("chuckle_showrunner", b => {
    b.speakerActorId = sp("Marnie Vell") || b.speakerActorId || null;
    b.choices = [ch("Take the microphone.", "chuckle_credits")];
    if (!/Marnie/.test(b.description)) b.description += "\n\nIts name is Marnie Vell. She ran the projector. She still does.";
  }, "Marnie speaks; choices moved to chuckle_credits");
  for (const [id, ending] of [["chuckle_finale", "credits"], ["chuckle_new_episode", "renewed"], ["chuckle_cancelled", "cancelled"]]) {
    edit(id, b => { b.story = { quest: KEY, role: "closer", ending }; if (ending === "credits") b.worldEffects = { ...(b.worldEffects || {}), meters: [{ key: "wendigoRung", delta: -1, min: 0 }] }; if (ending === "cancelled") b.worldEffects = { ...(b.worldEffects || {}), meters: [] }; }, `closer · ending ${ending}`);
  }

  // ── 3. the story script (Layer 2 data) ─────────────────────────────────────
  const SCRIPT = {
    quest: { name: "Chuckle Creek", act: 2, keystone: false, hex: "Chuckle Creek", registryId: Q, chapters: {} },
    script: {
      giver: "nobody. A road that ends in a painted backdrop, and a woman who wants you to eat",
      description: "The sky is a painted backdrop and the sun has a face. A man takes an anvil to the skull, flattens to the thickness of a playing card, springs back, and tips his hat. Nothing here can hurt anyone, the pie is mostly steam and enthusiasm, and the creek actually chuckles. Everyone is in costume and nobody has mentioned it. Enjoy it. They have, since Halloween night, 2077.",
      steps: [
        { id: "arrive", label: "Everything Is a Bit", line: "Let yourself enjoy it. The delight is the evidence. Order the pie.", beats: ["chuckle_arrival"] },
        { id: "pie", label: "The Pie Is Mostly Steam", line: "The pie is mostly steam and enthusiasm, and you will finish it. Pearl has questions about your hat.", beats: ["chuckle_pie"] },
        { id: "kid", label: "The Piano Kid", line: "A piano lands on a kid. He gets up laughing. Ask him how many times.", beats: ["chuckle_piano_kid"] },
        { id: "machine", label: "The Movie Machine", line: "The grange hall has a projector all brass and reels. Ask what it plays. Ask what it plays them ON.", beats: ["chuckle_projector"] },
        { id: "r1", label: "There Is No Last Winter", line: "Nobody here has a past tense. Ask Pearl what she made for the last birthday.", beats: ["chuckle_rung_1"] },
        { id: "r2", label: "The Chair at the Table", line: "There's a fourth plate. Ask who it's for. Then don't say anything for a bit.", beats: ["chuckle_rung_2"] },
        { id: "r3", label: "You Try to Leave With Someone", line: "Nobody leaves Chuckle Creek. Dewey knows where the scene changes. Follow him.", beats: ["chuckle_rung_3"] },
        { id: "stack", label: "The Stack", line: "Marnie's booth is where the show is made. The tapes are stacked weird — you've seen tapes stacked like that before. Find the slip.", beats: ["chuckle_tape_shelf"], done: { mark: "chuckle_rental_slip" } },
        { id: "r4", label: "The Title Card", line: "The title card is a memorial plaque. Read the names. One of them is on a plate at the diner.", beats: ["chuckle_rung_4"] },
        { id: "showrunner", label: "The Showrunner", line: "Marnie has the microphone. Ask her what the last thing on the tape was.", beats: ["chuckle_showrunner"] },
        { id: "credits", label: "Roll Credits", line: "Series finale, new episode, or cancelled. Sit with how badly someone had to want this.", beats: ["chuckle_credits"], done: { anyOf: ["chuckle_finale", "chuckle_new_episode", "chuckle_cancelled"] } }
      ],
      doors: [
        { id: "diner", label: "Pearl's Diner", line: "Pearl will feed you whether or not you're hungry. Ask about anything but winter.", beats: ["chuckle_arrival"] },
        { id: "creek", label: "The Creek", line: "The creek actually chuckles. Stand in it and see if it's laughing with you.", beats: ["chuckle_creek_itself"] },
        { id: "hollis", label: "Hollis Bandy", line: "Hollis will take an anvil for you. He will not take a question.", beats: ["chuckle_hollis"] }
      ],
      after: [], chapters: {}
    }
  };
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const have = storyApi?.get?.(campaignId)?.scripts?.[KEY];
  const scriptChanged = JSON.stringify(have || null) !== JSON.stringify(SCRIPT.script);
  if (scriptChanged) { changes++; say(`✦ story script chuckle_creek → campaign.story (${SCRIPT.script.steps.length} steps, ${SCRIPT.script.doors.length} doors)`); } else say("· ok story script (already)");

  // ── report / write ─────────────────────────────────────────────────────────
  console.log(`[seed-chuckle-creek-v2] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Chuckle Creek v2 DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Chuckle Creek v2: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-chuckle-creek-v2-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, SCRIPT);
  ui.notifications.info(`Chuckle Creek v2 APPLIED: ${changes} change(s). That's on the tape too. F5.`);
})();
