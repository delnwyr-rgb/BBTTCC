/* seed-sarmoung-hum-retrofit.macro.js — THE SARMOUNG HUM: Tier 1 touch-ups (2026-09-27) + TIER 2 "THE SHAPE" (2026-10-02). RUN IN-WORLD (GM). DRY_RUN default true.
 * 2026-10-02 — Dave ruled "Let's move it up a tier": the Hum is TIER 2 from Act 3 on (~/SARMOUNG_HUM_RETROFIT_2026_10_02.md). The six Tier-1
 * rungs stay as they are (ambient, one per act). On top of them: an eight-step arc in the Chuckle shape, every touch inside the ladder's
 * Tier-2 allowance — both patrons with REAL gifts (taking them is encouraged), the roofs become NOTICEABLE (meter humRoofs; still not
 * walkable — the nine pinned houses are untouched), rooflines DOABLE (one route, one small effect), the two-ledgers artifact (the ONE
 * receipt), the bee-teller (telling the bees DOABLE; eye-honey TASTABLE — the two unreachable Tier-2 beats from 08-15 are now reachable),
 * the walker who keeps the correct distance (wordless), the mask stack (COUNTABLE, one gap, something due), three endings.
 * STILL FORBIDDEN AND NOT USED: branch names, the word "relay", any prehistory, the Wiggle Rule described, "tikkun", any NPC who explains.
 * Nobody who KNOWS is named (role-names only: the Immaculate Courier, the Song Leader, the Bee-Teller — the bee-teller's name is Dave's mint).
 * Source: ~/SARMOUNG_HUM_RETROFIT_2026_09_27.md. The Hum is UNSCRIPTED BY RULING (09-15) and the Revelation Ladder's Tier 1 forbids naming,
 * rewarding, meters, receipts, closers. This seeder therefore does only: Bit/Coll speakers on the two tent beats (their personas + court secrets
 * already exist), an exit that survives Act 1, and one COUNTABLE (non-rewarding) exit on each of rungs 2–6. No script, no receipt, no roles.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const bit = (game.actors?.contents || []).find(a => a.name === "Scavenger — Bit"), coll = (game.actors?.contents || []).find(a => a.name === "Scavenger — Coll");
  if (!bit || !coll) say("✗ Bit / Coll actors not found — speakers skipped");

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  if (!byId.get("hum_quiet_tent")) return ui.notifications.error("hum_quiet_tent missing — the Hum was never seeded here.");
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);

  edit("hum_quiet_tent", b => { if (!b.speakerActorId && bit) b.speakerActorId = bit.id; }, "Bit speaks");
  edit("hum_quiet_tent_ask", b => { if (!b.speakerActorId && coll) b.speakerActorId = coll.id; }, "Coll speaks");
  addChoice("hum_quiet_tent", ch("On to wherever the road goes.", "", { description: "The woman changes the water in the basin nobody uses. Bit puts his boots back on. Nobody says goodbye; it's a tent." }), "an exit that survives Act 1");
  // countable, not rewarding
  addChoice("hum_loud_revival", ch("Count the seats.", "", { description: "Three hundred. You count twice. The town has eighty people in it and the singing is excellent." }), "countable exit");
  addChoice("hum_quiet_decline", ch("Ask after their dead in return.", "", { description: "They tell you the number, and they are glad to have been asked, and they still don't eat." }), "countable exit");
  addChoice("hum_loud_echo", ch("Ask the smith what she knew how to do.", "", { description: "\"Everything I do. Hands-first. She didn't know my name.\" He goes back to work and hits it harder than it needs." }), "countable exit");
  addChoice("hum_quiet_ledger", ch("Read the tally down.", "", { description: "The numbers only ever go down. The most recent cut is not recent. You do not add one." }), "countable exit");
  addChoice("hum_loud_handwriting", ch("Stand there a while longer.", "", { description: "It keeps not spelling anything for exactly as long as you stand there. Then you leave, and it is still not spelling anything." }), "countable exit");


  // ══════════════════════════════════════════════════════════════════════════
  // TIER 2 — THE SHAPE (2026-10-02, owner ruling "Let's move it up a tier")
  // ══════════════════════════════════════════════════════════════════════════
  const MAL = "bbttcc-mal-voice", MARKER = "[HUM-TIER-2-2026-10-02]";
  const KEY = "sarmoung_hum", Q = "quest_sarmoung_hum", METER = "humRoofs";
  const P3 = { flag: "storyPhase", gte: 3 };

  // ── personas: Bit + Coll get one Tier-2 secret each; three role-named NPCs (nobody who KNOWS gets a name) ──
  const BIT_ID = byId.get("hum_quiet_tent")?.speakerActorId || bit?.id || null;
  const COLL_ID = byId.get("hum_quiet_tent_ask")?.speakerActorId || coll?.id || null;
  const ADD_SECRETS = [
    [BIT_ID, "The Other Tent :: stirThePot :: a Steward asks Bit which tent PAID better :: The loud one, by a mile: free food, a second helping, and nobody ever once asked him to leave. The quiet one paid exact and asked after his dead. He has been back to both. He does not know why he keeps going back to the quiet one, and he would like you to stop asking."],
    [COLL_ID, "Same Fence :: rollPlus2 :: a Steward shows Coll the rubbing from the post, or asks whether the quiet place and the loud place were ever one place :: Coll goes quiet, which is the loudest thing Coll does. \"It was a fence argument. We stood in the middle of it. One side went quiet. The other side got a tent.\" Both sides still count the fence. Coll will not say which side Coll would have stood on."]
  ];
  for (const [aid, line] of ADD_SECRETS) {
    const actor = aid ? game.actors?.get?.(aid) || (game.actors?.contents || []).find(a => a.id === aid) : null;
    if (!actor) { say(`✗ speaker actor ${aid} not found — secret skipped`); continue; }
    const cur = actor.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || "");
    if (raw.includes(line.split("::")[0].trim())) { say(`· ok persona ${actor.name} (Tier 2 secret)`); continue; }
    changes++; say(`✚ persona ${actor.name} +1 Tier-2 secret`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, secretsRaw: [raw.trim(), line].filter(Boolean).join("\n") });
  }
  const NEW_PERSONAS = [
    { name: "The Immaculate Courier", topics: "the road, courtesies, the meal, your dead, paying over, counting, mercy, the quiet towns, the gift",
      notes: `${MARKER} PRIVATE TRUTH — one of the immaculate travelers from the road (no dust past the ankle). VOICE: every courtesy in the right order, your name back to you correctly the first time, warm, unhurried, genuinely merciful; pays OVER and waves off change; orders food and never eats it, then thanks the cook specifically; asks after your dead the way you'd ask after a knee. Their gift is REAL: they quietly settle what is hurting a faction, and nobody has to be asked about it again. They do not explain what they are, who sent them, or what they count; asked, they answer the literal question and nothing behind it. TIER 2: never name a group, a doctrine, a branch, a history. Horror arrives by arithmetic, never by menace — they are kind the whole time.`,
      secrets: ["The Column :: oppRollMinus2 :: a Steward asks what they are COUNTING :: \"Everyone, eventually. Gently. It's kinder in pencil.\" Then they ask after your dead again, write the answer down in a small neat column, and thank you for it.",
        "Paid Over :: favorPlus1 :: a Steward refuses the gift and still thanks them for the meal :: They are genuinely moved. They leave a coin for the cook anyway, and a second coin 'for the one you lost,' and will not say how they knew there was one."] },
    { name: "The Song Leader", topics: "the meeting, the big canvas, singing, the welcome, volunteers, new faces, abundance, the ledger, the gift",
      notes: `${MARKER} PRIVATE TRUTH — leads the meeting under the big canvas (three hundred seats, eighty townsfolk). VOICE: booming, delighted, generous to the point of pressure; second helpings that cannot be refused; everybody is NEW and everybody is thrilled about it. Her gift is REAL: willing hands, as many as you can feed, for any hex you name. Her line, said cheerfully and never explained: "We can out-populate the ledger." She does not say whose ledger. She does not explain what she is, who sent her, or where the singers come from. TIER 2: never name a group, a doctrine, a branch, a history. She is generous the whole time.`,
      secrets: ["Everybody's New :: stirThePot :: a Steward asks where any ONE singer is from :: Ask them; they're from the meeting. \"Isn't it wonderful? Nobody here is ever the last of anything.\"",
        "Out-Populate :: rollPlus2 :: a Steward asks what 'the ledger' is :: She laughs. \"The ledger is whoever's counting, honey.\" And she sings the next verse louder, and that is all you get."] },
    { name: "The Bee-Teller", topics: "the hives, the black cloth, your dead, telling the bees, thin honey, the masks, the hill, what's due",
      notes: `${MARKER} PRIVATE TRUTH — keeps six hives behind a poor, clean house with a low corrugated roof; the hives are older than the house. VOICE: plain, practical, unhurried, no ceremony; keeps a strip of black cloth for news of the dead and tells the bees out loud, in full sentences, with the name and the date. Gives thin sour honey with a four-word instruction (a drop each eye) and thinks the honey is the boring part. She KNOWS, and she will not explain — not the post, not the masks, not the roofs; "not mine to say." TIER 2: REFUSED mode; she never explains, never names a group, never says what anything is for. Owner mint: her name is Dave's to give — never invent one.`,
      secrets: ["Not Mine to Say :: oppRollMinus2 :: a Steward asks her to read the rubbing from the post, or to explain anything at all :: She looks at it a long while and hands it back. \"Not mine to say.\" Then she goes out back and tells the bees there's been a visitor with a question, and that is all she tells anybody.",
        "The Jar :: favorPlus1 :: a Steward tells the bees about one of their own dead, in full sentences, with the date :: She gives you a small jar of thin sour honey and four words: a drop each eye. She does not say what it is for. Over about a day, you find out."] }
  ];
  const npcIds = {};
  for (const p of NEW_PERSONAS) {
    let actor = (game.actors?.contents || []).find(a => a.name === p.name);
    if (!actor) { say(`✚ CREATE actor "${p.name}"`); changes++; if (!DRY_RUN) actor = await Actor.create({ name: p.name, type: "npc" }); }
    if (!actor) continue;
    npcIds[p.name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${p.name}`); continue; }
    changes++; say(`✚ persona ${p.name} +${p.secrets.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...p.secrets].filter(Boolean).join("\n") });
  }
  const sp = (n) => npcIds[n] || null;

  // ── beats ──
  const TAGS = "sarmoung_hum story tier2";
  const roof = (n = 1) => [{ key: METER, delta: n, max: 9, min: 0 }];
  const coalition = (opDeltas) => [{ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas, allowOvercap: false }];
  const beat = (id, label, description, { type = "narration", speaker = null, choices = null, receipts = null, requires = null, meters = null, timePoints = 0, priority = "background", memoryText = null, story = null, repeatable = false, extraFx = null, routing = false } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: "quest_travel_encounters", tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: requires || [P3] },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}), ...(routing ? { dialogueOffer: false } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(meters ? { meters } : {}), ...(receipts ? { receipts } : {}), ...(extraFx || {}) }
  });
  const M = (id) => ({ beatMark: id });
  const close = (ending, text) => ({ questEffects: [{ action: "complete", questId: Q, beatId: "", state: "completed", text }] });

  const NEW = [
    beat("hum_t2_same_two", "The Same Two",
      "Bit and Coll, again. They are sitting out a squall under the eave of a low house with a corrugated roof, the poor-but-clean kind, nobody home in the way that suggests somebody just was. Bit waves like you are old friends, which by now you sort of are. \"Three jobs since the tent,\" he says. \"Crowd at a hanging that got called off. Two travelers at a ford. Two travelers at a different ford. They keep using us.\" Coll is watching the road both ways. \"There's two kinds of tent now,\" Coll says, to nobody. \"Have you noticed? Quiet ones and loud ones. Never in the same week.\" Bit says Coll has been like this since the fence.",
      { type: "dialog", speaker: BIT_ID, requires: [P3], meters: roof(1), story: { quest: KEY, role: "start" },
        memoryText: "Bit and Coll turned up on the road again, and Coll said there are two kinds of tent now: quiet ones and loud ones.",
        choices: [
          ch("Ask Coll what the two kinds are.", "", { description: "\"The quiet ones pay you. The loud ones feed you. Neither one asks you to leave.\" Coll thinks about it. \"That's the part I don't like.\"" }),
          ch("Ask Bit where they're headed.", "", { description: "\"Wherever the next scene needs two.\" He puts his boots back on. \"There's singing up the road, if you're going that way. And a nice couple who won't eat their dinner.\"" }),
          ch("There's a quiet pair up ahead.", "hum_t2_quiet_offer"),
          ch("There's singing up the road.", "hum_t2_loud_offer")
        ] }),
    beat("hum_t2_quiet_offer", "The Quiet Offer",
      "The immaculate travelers. A roadside table under a low tin roof, two bowls going cold in front of them, the bill already paid, and over. They know your name and say it right the first time. They have heard, they say gently, that your holdings are carrying something heavy — a debt, a quarrel, a hex that will not settle — and they would like to take it off your hands. Quietly. Nobody will need to be asked about it again. They mean it. It is the kindest thing anyone has offered you on this road, and they are already reaching for a pencil.",
      { type: "dialog", speaker: sp("The Immaculate Courier"), requires: [P3, M("hum_t2_same_two")], meters: roof(1),
        choices: [
          ch("You've met before. Say so.", "", { requires: { beatMark: "hum_quiet_decline" }, description: "\"We have,\" the Courier says, delighted. \"You asked after our dead. Nobody does that.\" The bowls are still full." }),
          ch("Ask what it costs.", "", { description: "\"Nothing you'd notice.\" It is true. You check, later, and you can't find what it cost. That is not the same as nothing." }),
          ch("Take it.", "hum_t2_quiet_taken"),
          ch("Decline, and thank them for the meal.", "hum_t2_quiet_declined")
        ] }),
    beat("hum_t2_quiet_taken", "The Quiet Offer — Taken",
      "They do it while you are finishing your tea. By the time you are home, the heavy thing is lighter: the ledger balances, the quarrel has gone quiet, nobody mentions the hex. Your treasurer finds coin she cannot account for and decides not to. The Courier writes one small neat figure in a column and blows on it to dry.",
      { requires: [P3, M("hum_t2_quiet_offer")], routing: true, memoryText: "The Stewards took the immaculate travelers' quiet gift; a heavy thing in their holdings went quiet.",
        extraFx: { factionEffects: coalition({ economy: 20 }) }, choices: [ch("Don't ask.", "")] }),
    beat("hum_t2_quiet_declined", "The Quiet Offer — Declined",
      "They are not offended. They are, if anything, touched. They thank the cook by name for the meal they did not eat, leave a coin for her anyway, and a second coin on your side of the table, 'for the one you lost.' Neither of them asks how you are getting on with the heavy thing. They already know.",
      { requires: [P3, M("hum_t2_quiet_offer")], routing: true, choices: [ch("Pick up the coin, or don't.", "")] }),
    beat("hum_t2_loud_offer", "The Loud Offer",
      "The big canvas again, or one exactly like it, and the singing is still excellent. The Song Leader finds you before you find a seat; she has heard about you, she has heard EVERYTHING about you, and she wants to help. Willing hands. Forty of them, fifty, as many as you can feed, cheerful and capable and new, for any hex you care to name. \"We can out-populate the ledger,\" she says, and laughs, and does not say whose ledger. Somebody puts a second helping in front of you. The low tin roof of a house you didn't notice on the way in is shaking a little with the bass.",
      { type: "dialog", speaker: sp("The Song Leader"), requires: [P3, M("hum_t2_same_two")], meters: roof(1),
        choices: [
          ch("Count the seats again.", "", { requires: { beatMark: "hum_loud_revival" }, description: "More than last time. The town is the same size." }),
          ch("Ask where the volunteers are from.", "", { description: "\"From the meeting!\" She means it. So do they." }),
          ch("Take them.", "hum_t2_loud_taken"),
          ch("Decline, and stay for the singing.", "hum_t2_loud_declined")
        ] }),
    beat("hum_t2_loud_taken", "The Loud Offer — Taken",
      "They come the next morning, singing. They are good at everything and grateful for anything, they never once ask to be paid, and within a week the hex you named is louder than it has been since the Shattering. Nobody there can tell you any of their names, including, after a while, them. They are very happy. You are almost sure of it.",
      { requires: [P3, M("hum_t2_loud_offer")], routing: true, memoryText: "The Stewards took the Song Leader's gift; willing hands, all of them new, filled a hex with noise.",
        extraFx: { factionEffects: coalition({ culture: 10, softpower: 10 }) }, choices: [ch("Learn the chorus.", "")] }),
    beat("hum_t2_loud_declined", "The Loud Offer — Declined",
      "She is not offended either. She hugs you, which you did not agree to, and gives you a bag of bread for the road, and says the offer stands, because everything she offers stands. The singing follows you farther down the road than singing should.",
      { requires: [P3, M("hum_t2_loud_offer")], routing: true, choices: [ch("Keep the bread.", "")] }),
    beat("hum_t2_roof", "Another Roof Like That",
      "A low house beside the road: corrugated roof, pitched a little wrong, the poor side of clean. A swept step. A water butt with a lid on it. Nobody home, in the way that suggests somebody just was. Nothing about it is remarkable, and you will not remember why you looked.",
      { requires: [P3, M("hum_t2_same_two")], repeatable: true, meters: roof(1),
        choices: [ch("Noted.", ""), ch("Look at the roofline a moment longer.", "", { description: "The pitch leans the same way the road does. Probably it's the wind." })] }),
    beat("hum_t2_fourth_roof", "The Fourth Roof",
      "Somebody in the party says it before anyone can stop them: \"That's the fourth roof like that.\" And then nobody can stop seeing it. Low, corrugated, pitched a little wrong — the SAME a little wrong, every time, all of them leaning one way, the way grass leans when something has walked through it. Every one of them poor, clean, swept, and empty in the way that means someone just stepped out. Nobody answers the door. You do not try very hard.",
      { requires: [P3, { flag: METER, gte: 4 }], priority: "high", memoryText: "A Steward said it out loud: that's the fourth roof like that. The roofs all lean the same way.",
        choices: [
          ch("Follow the way the roofs lean.", "hum_t2_follow_the_pitch"),
          ch("Knock anyway.", "", { description: "Nobody. A strip of black cloth is tied to the handle, neatly, the way you'd tie something you do often." }),
          ch("Count them back.", "", { description: "Four that you remember. You suspect more that you don't." })
        ] }),
    beat("hum_t2_follow_the_pitch", "Following the Pitch",
      "You follow the lean of the roofs, which is a ridiculous way to navigate, and it takes half a day off the road. Nobody can explain it. The track you end up on is older than the one you were on, and better drained, and somebody keeps it, and it brings you out at a crossroads beside a waypost you think you have passed before.",
      { requires: [P3, M("hum_t2_fourth_roof")], routing: true, extraFx: { factionEffects: coalition({ logistics: 10 }) },
        choices: [ch("The waypost.", "hum_t2_the_post")] }),
    beat("hum_t2_the_post", "Both Faces of the Post",
      "It is the post with the tally on it — or one just like it, oiled where the numbers are, kept. You have read this face before: the numbers only ever go DOWN. Walk around it. The other face is cut by a different hand with a different tool, and it is just as old and just as loved, and its numbers only ever go UP. The same town's name is burned into the cap. Both faces start from the same figure at the top. Then one patiently subtracts, and the other patiently adds, for a very long time, and neither has ever once corrected the other. Near the bottom of the down face, a fresh cut, small and neat, in pencil-grey. Near the bottom of the up face, a fresh one too. Whatever you took on this road, both faces have already counted it. If you took nothing, there is still a notch for you on each side: one down, one up. You count the actual town at the crossroads, honestly, twice. Neither face is right.",
      { requires: [P3, M("hum_t2_follow_the_pitch")], priority: "high", timePoints: 1,
        memoryText: "The Stewards found the waypost's other face: one town counted twice, one face only subtracting, one only adding, and both had already counted what the Stewards took.",
        receipts: [{ label: "Both Faces of the Post (a rubbing)", effectKey: "stirThePot", acquisition: "earned", source: { name: "the waypost at the crossroads" }, truth: "One town, counted twice: one face of the post only ever subtracts, the other only ever adds, both are kept with love, and both had already counted what the Stewards took on the road. Produced to anyone who keeps a count of people, or who has given the Stewards something, it makes them say which face they cut; they will not lie about it, and neither will be ashamed." }],
        choices: [
          ch("Take a rubbing of both faces.", "hum_t2_bee_teller_meet", { description: "Charcoal and the back of a map. The two faces come out on one sheet, back to back, and do not agree." }),
          ch("Cut a notch of your own.", "", { description: "You don't. Your hand will not decide which face." }),
          ch("Say what you've been taking.", "", { description: "Out loud, in the road. It sounds worse than it was. That is the point of saying it out loud." })
        ] }),
    beat("hum_t2_bee_teller_meet", "Somebody Keeps Bees",
      "Down the old track from the post: one more low house with a corrugated roof, and behind it six hives that are older than the house. A woman in a wide hat is checking the water. She looks at your rubbing for a long time without reading it and hands it back. \"Not mine to say,\" she says. Then she asks, practically, whether anybody has died since the last time somebody told the bees — anybody of yours, anybody you were responsible for. She asks it the way you'd ask whether the gate was shut.",
      { type: "dialog", speaker: sp("The Bee-Teller"), requires: [P3, M("hum_t2_the_post")], priority: "high", meters: roof(1),
        memoryText: "A bee-keeper behind a low corrugated house would not read the post's rubbing — 'not mine to say' — and asked whether anyone of theirs had died.",
        choices: [
          ch("Tell the bees about your dead.", "t2_bee_teller"),
          ch("Ask about the jar on the windowsill.", "t2_eye_honey_use", { description: "Thin, sour, faintly citric, and it will not behave in a spoon. \"A drop each eye.\"" }),
          ch("Ask her to explain the post.", "", { description: "\"Not mine to say.\" She goes out back and tells the bees there's been a visitor with a question. That is all she tells anybody." }),
          ch("Ask about the hill behind the hives.", "hum_t2_mask_stack")
        ] }),
    beat("hum_t2_mask_stack", "The Stack in the Cave",
      "A cave in the hill behind the hives, dry, swept, and on a ledge a stack of carved wooden masks, each laid on the one below, each a different hand. The wood greys with age from the bottom up, a step of weathering between each mask and the next, regular as a clock. Count them. Then count the steps of grey. Partway up, the grey jumps two steps at once: one mask was never carved. Nobody has filled the gap; nobody has pretended it isn't there. And on the top mask, the dust has settled everywhere except one clean shape exactly the size of a mask, as if one is expected. The bee-teller, at the mouth of the cave, says one is carved \"when it's time,\" and will not say how long that is. She looks at you a little too long.",
      { requires: [P3, M("hum_t2_bee_teller_meet")], priority: "high", memoryText: "In a cave behind the bee-keeper's hives, a stack of masks: one missing partway up, and a clean space on top where the next one is due.",
        choices: [
          ch("Count them again.", "", { description: "Same count. Same gap. Same clean space on top. The wood can be counted; that's the point of wood." }),
          ch("Ask who carves the next one.", "", { description: "\"Whoever's here when it's time.\"" }),
          ch("Walk back out into the light.", "hum_t2_what_you_took")
        ] }),
    beat("hum_t2_what_you_took", "What You Took",
      "Back at the crossroads with a rubbing that will not agree with itself, the taste of thin honey or the memory of being offered it, a cave with a gap in it, and the quiet and the loud still going on either side of the road, both of them kind, both of them generous, both of them counting. Something very old has been keeping something going. Two lots of people want it, and they want opposite things, and they have both been very good to you. The people who actually know are poor, scattered, and will not explain. And somewhere there is a thing that is due.",
      { requires: [P3, M("hum_t2_the_post"), M("hum_t2_mask_stack")], routing: true,
        choices: [
          ch("Let it hum.", "hum_t2_end_hum"),
          ch("Show the rubbing to both of them.", "hum_t2_end_asked"),
          ch("Go back and tell the bees.", "hum_t2_end_told")
        ] }),
    beat("hum_t2_end_hum", "Let It Hum",
      "You walk on. You keep what you kept and you decline what you declined, and nobody is offended, because nobody ever is. The quiet towns stay quiet and the loud ones stay loud. The roofs keep leaning. Both patrons will be back, with bigger gifts, because everything they offer stands. You will notice the roofs now for the rest of your lives. That was the price, and you paid it without being asked.",
      { requires: [P3, M("hum_t2_what_you_took")], routing: true, priority: "high", story: { quest: KEY, role: "closer", ending: "hum" },
        memoryText: "The Stewards let the hum go on: kept what they kept, and can't stop seeing the roofs.",
        extraFx: close("hum", "Two kinds of tent, both kind, both counting. You let it hum. The roofs still lean.") , choices: [ch("Walk on.", "")] }),
    beat("hum_t2_end_asked", "Which Face Did You Cut",
      "You find the Courier at a clean table and the Song Leader under the canvas, and you show each of them the rubbing. Neither one lies. The Courier puts one finger, gently, on the face that goes down, and says, \"That one. It's kinder in pencil.\" The Song Leader slaps her palm on the face that goes up and says, \"That one! Isn't it wonderful?\" Neither is ashamed. Neither asks which face you would have cut. Each of them, separately, asks after the other, the way you'd ask after an old friend who moved away.",
      { requires: [P3, M("hum_t2_what_you_took"), M("hum_t2_the_post")], routing: true, priority: "high", story: { quest: KEY, role: "closer", ending: "asked" },
        memoryText: "Shown the rubbing, the Courier claimed the face that subtracts and the Song Leader the face that adds; neither lied, neither was ashamed.",
        extraFx: close("asked", "One face each, owned without shame. They asked after each other."), choices: [ch("Fold the rubbing away.", "")] }),
    beat("hum_t2_end_told", "Telling the Bees",
      "You go back down the old track and you tell the bees. Not your dead this time — the town. Both faces of it, out loud, in full sentences: what it was, what it is on each side of the post, what you took and from whom, the date. It takes a while. The bee-teller does not tie a cloth to anything. When you finish she listens a moment, in case there is a reply, and then nods. \"That'll do,\" she says, and goes to check the water. On the way out you notice that the hive nearest the house has been listening the whole time, and that you are no longer quite sure which way the roofs lean.",
      { requires: [P3, M("hum_t2_what_you_took"), M("hum_t2_bee_teller_meet")], routing: true, priority: "high", story: { quest: KEY, role: "closer", ending: "told" },
        memoryText: "The Stewards told the bees the whole count of one town, both faces, out loud. The bee-teller said that'll do.",
        extraFx: { ...close("told", "You told the bees the whole count, both faces, out loud. That'll do."), factionEffects: coalition({ faith: 10 }) }, choices: [ch("Leave the bees to it.", "")] }),
    beat("hum_t2_forty_paces", "The Walker at Forty Paces",
      "For three legs of the road there has been someone behind you at the same distance. Not closer, not farther. When the ford is out, the walker is somehow on the right bank first, pointing at the shallows. When you stop to eat, the walker stops too, and eats, and doesn't come over. Wave, and the walker waves back. You could close the distance; you find you don't want to, and you can't say why.",
      { requires: [P3, M("hum_t2_same_two")],
        choices: [
          ch("Wave the walker closer.", "", { description: "A wave back. No closer." }),
          ch("Tell the walker to go.", "", { description: "A nod. No farther." }),
          ch("Leave water at the next stop.", "", { description: "In the morning the canteen is full, rinsed, and set a little farther down the road than where you left it." })
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  // the two Tier-2 beats authored 2026-08-15 and left unreachable: wire them to the bee-teller
  edit("t2_bee_teller", b => {
    b.questId = "quest_travel_encounters"; b.storyChain = KEY; b.story = { quest: KEY };
    b.inject = { ...(b.inject || {}), cooldownTurns: 0, repeatable: true, requires: [P3, M("hum_t2_bee_teller_meet")] };
    if (sp("The Bee-Teller") && !b.speakerActorId) b.speakerActorId = sp("The Bee-Teller");
  }, "reachable from the bee-teller; repeatable (tell them every time)");
  edit("t2_eye_honey_use", b => {
    b.questId = "quest_travel_encounters"; b.storyChain = KEY; b.story = { quest: KEY }; b.dialogueOffer = false;
    b.inject = { ...(b.inject || {}), cooldownTurns: 0, repeatable: false, requires: [P3, M("hum_t2_bee_teller_meet")] };
  }, "reachable from the bee-teller (tastable)");

  // ── ✦ story script (Layer-2 data; the Hum had none — UNSCRIPTED by the 09-15 ruling, lifted by the 10-02 tier move) ──
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const codeQuest = storyApi?.code?.()?.quests?.[KEY] || { name: "Two Kinds of Tent", act: 0, keystone: false, hex: "", registryId: Q, chapters: {} };
  const QUEST = { ...JSON.parse(JSON.stringify(codeQuest)), act: 3, background: true };   // background: fills idle time, never the NOW headline (story-model 2026-10-02)
  const SCRIPT = {
    giver: "Bit and Coll, again. They get reused. So, it turns out, do towns.",
    description: "There are two kinds of tent on the roads now: quiet ones that pay you and loud ones that feed you, never in the same week, and neither ever asks you to leave. Both have gifts, and the gifts are real. Somewhere between them stands a waypost that counts one town twice, and down an old track behind it somebody keeps bees and will not explain anything at all.",
    steps: [
      { id: "same", label: "The Same Two", line: "Bit and Coll again, under a low tin roof. Coll says there are two kinds of tent now. Ask what the two kinds are.", beats: ["hum_t2_same_two"], done: { mark: "hum_t2_same_two" } },
      { id: "quiet", label: "The Quiet Offer", group: "offers", line: "The immaculate pair want to take something heavy off your hands. Their gift is real. Take it, or thank them for the meal.", beats: ["hum_t2_quiet_offer", "hum_t2_quiet_taken", "hum_t2_quiet_declined"], done: { anyOf: ["hum_t2_quiet_taken", "hum_t2_quiet_declined"] } },
      { id: "loud", label: "The Loud Offer", group: "offers", line: "The Song Leader has willing hands for any hex you name. Their gift is real too. Take it, or stay for the singing.", beats: ["hum_t2_loud_offer", "hum_t2_loud_taken", "hum_t2_loud_declined"], done: { anyOf: ["hum_t2_loud_taken", "hum_t2_loud_declined"] } },
      { id: "roofs", label: "Roofs Like That", line: "Low, corrugated, pitched a little wrong. Keep your eyes open on the road. Someone is going to say it.", beats: ["hum_t2_roof", "hum_t2_fourth_roof"], done: { mark: "hum_t2_fourth_roof" } },
      { id: "post", label: "Both Faces of the Post", line: "The roofs all lean one way. Follow the lean, ridiculous as it is, and read the waypost from BOTH sides.", beats: ["hum_t2_follow_the_pitch", "hum_t2_the_post"], done: { mark: "hum_t2_the_post" } },
      { id: "bees", label: "Somebody Keeps Bees", line: "Down the old track, six hives older than the house. She won't read your rubbing. Answer her question instead.", beats: ["hum_t2_bee_teller_meet", "t2_eye_honey_use"], done: { mark: "hum_t2_bee_teller_meet" } },
      { id: "masks", label: "The Stack in the Cave", line: "Behind the hives, a stack of masks. Count the wood. Count the gaps. Count the space on top.", beats: ["hum_t2_mask_stack"], done: { mark: "hum_t2_mask_stack" } },
      { id: "took", label: "What You Took", line: "Back at the crossroads. Let it hum, show the rubbing to both of them, or go back and tell the bees.", beats: ["hum_t2_what_you_took", "hum_t2_end_hum", "hum_t2_end_asked", "hum_t2_end_told"], done: { anyOf: ["hum_t2_end_hum", "hum_t2_end_asked", "hum_t2_end_told"] } }
    ],
    doors: [
      { id: "walker", label: "The Walker at Forty Paces", line: "Someone keeps the same distance behind you, leg after leg. Wave. See what happens. See what doesn't.", beats: ["hum_t2_forty_paces"] },
      { id: "tell", label: "Somebody Has to Tell Them", line: "When one of yours dies, the bees have to be told. Full sentences, the name, the date.", beats: ["t2_bee_teller"] },
      { id: "roof", label: "Another Roof Like That", line: "Poor, clean, swept, nobody home. Noted.", beats: ["hum_t2_roof"] }
    ],
    after: [],
    chapters: {}
  };
  const haveData = storyApi?.get?.(campaignId) || {};
  { const lS = haveData.scripts?.[KEY]; if (lS?.after) SCRIPT.after = Array.from(new Set([...(lS.after || []), ...SCRIPT.after])); }   // union: never drop another seeder's after-entries
  let scriptChanged = !!storyApi && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST));
  { const lS = haveData.scripts?.[KEY]; if (scriptChanged && lS && !String(JSON.stringify(lS)).includes("hum_t2_same_two")) { scriptChanged = false; say(`⚠ story script ${KEY}: a live script exists that this seeder did not write — NOT overwritten`); } }
  if (!storyApi) say("✗ story data API missing — story script NOT written (hard-reload and re-run)");
  else if (scriptChanged) { changes++; say(`✦ story script ${KEY} → campaign.story (Tier 2: ${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors; quest act ${QUEST.act})`); }
  else say("· ok story script (already)");

  console.log(`[seed-sarmoung-hum-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Sarmoung Hum (Tier 1 + Tier 2) DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Sarmoung Hum: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-hum-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Sarmoung Hum (Tier 1 + Tier 2) APPLIED: ${changes} change(s). Two kinds of tent. F5.`);
})();
