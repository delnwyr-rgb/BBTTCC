/* seed-soft-landing-v2.macro.js — SOFT LANDING to the Chuckle Creek template (2026-09-25). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/SOFT_LANDING_SCRIPT_2026_09_25.md (Dave 2026-09-25: "the template WORKS — apply it to the rest"), bible draft 2.
 * Builds ON the 2026-08-18 seeder (seed-soft-landing.macro.js) — this one checks the arrival exists.
 *
 *  1. NPC actors + Mal-voice personas with armed secrets: Adaeze Kolm, Captain Rudy Falk, Mayor Tansy Okoro.
 *  2. Seven new beats (checkpoint, state function, the castle, the card, the birthday-card marker, the cake, the blower)
 *     with speakers, checks, story declarations, worldEffects.meters (+1 softlandingGive, capped 4) and the Birthday Card
 *     receipt. Existing beats get small edits (names, speakers, Teju said out loud in rung 4, a hidden 4th choice
 *     "Read the names out loud" on the choice beat gated on the card).
 *  3. REPAIR: the three endings' hexModifiers / worldModifiers still say "Saltwake Reach a" (seed-effects-act2, before the
 *     09-25 move) → rewritten to "Ynnermire.b", where the town lives now.
 *  4. The quest's STORY SCRIPT written to campaign.story (Layer 2 data — editable on the Quests tab ✦ Script; wins over
 *     the shipped code script by key). Quest def carries evergreen:true + hex Ynnermire.b.
 *
 * Idempotent: marker-guarded personas; beats by id (existing edits re-applied only if text differs).
 * Backs up the campaigns setting before writing. F5 afterwards, then re-run setup-town-hub for "softlanding" once the map exists.
 */
(async () => {
  const DRY_RUN = false;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const Q = "quest_soft_landing", KEY = "soft_landing", METER = "softlandingGive", HEX = "Ynnermire.b", OLD_HEX = "Saltwake Reach a";
  const MARKER = "[SOFT-LANDING-V2-2026-09-25]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. personas ────────────────────────────────────────────────────────────
  const PERSONAS = [
    { name: "Adaeze Kolm", create: { type: "npc" },
      topics: "Teju, the birthday, the party, the card, the bench, sitting down, the castle, the blower, the cake, the candles, the bumblebee costume, Halloween, the street, the neighbours, Captain Falk, the Mayor, edges, landing, names",
      notes: `${MARKER} PRIVATE TRUTH — Adaeze Kolm is the grandmother of Teju Kolm, whose seventh birthday party was the ordinary thing Soft Landing was doing on Sunday, October 31, 2077, when the blast wave arrived as a bounce. Teju went up on the bounce and did not come down; neither did eight others. Adaeze has not said his name out loud in two hundred years and the whole town's physics exists so she never has to. VOICE: kind, slow, precise, tired in the bones; the only person in Soft Landing who SITS DOWN (a foam bench gone flat under her that does not spring back; the padding is thin in a four-foot radius around her). Still in her costume: a bumblebee, antennae bent, because Teju asked her to come as one. She carries the birthday card in the costume — forty-one names, everyone who came, nine of them dead — and has never read it, because reading is landing. She only ever holds it out to someone who is sitting down. NEVER breaks the bit on her own; she deflects like everyone else, just slower, and the deflection has cracks. Funny first: she is dry about the town ("the Mayor's been in session since the cake") and merciless about pool noodles.`,
      secrets: [
        "The Card :: stirThePot :: a Steward asks WHO the party was for, instead of what happened at it :: \"Teju. He was turning seven. He is still turning seven, everywhere I look.\" — the first time anyone has asked in a way she could answer.",
        "The Bumblebee :: rollPlus2 :: a Steward asks why she's dressed as a bee, not why she's sitting :: \"He asked me to. It was the last thing he asked me for.\" Then she is very interested in the middle distance."
      ],
      courtDoor: "they sit down beside her, say nothing until she speaks, and then ask to read the card OUT LOUD in the yard with the blower off — not to console her, to land with her" },
    { name: "Captain Rudy Falk", create: { type: "npc" },
      topics: "edges, the checkpoint, the gate, forms, Form 7, Form 7-B, the stamp, the bin, knives, pool noodles, the Noodle Guard, procedure, landing, the blower, the castle, the Mayor, today, dates",
      notes: `${MARKER} PRIVATE TRUTH — Captain Rudy Falk commands the Noodle Guard at Soft Landing's inflatable gate. Foam clipboard, a stamp that goes BOING, forms in triplicate, immense seriousness. He confiscates EDGES (anything that could land hard: blades, hard words, dates) into a bin marked EDGES; the bin bounces. He has a form for everything; Form 7, Report of a Hard Landing, has never been filed and is blank, and he does not put it away when he shows it. Every form in the guardhouse is dated "today" because his pen bounces off a number. VOICE: clipped, courteous, procedural, quietly delighted by cooperation; a man who has made bureaucracy into a kind of padding. Costume: he came to the party as a mech (cardboard, silver tape) and has decided it is a uniform. Not a villain and not stupid — he knows exactly what the checkpoint keeps out and will say so only if asked what happens if somebody lands. Funny first: "Mind the step. There isn't one."`,
      secrets: [
        "Form 7 :: oppRollMinus2 :: a Steward asks what happens if somebody LANDS :: he produces Form 7, Report of a Hard Landing. It is blank. \"Nobody's ever needed it.\" He does not put it away.",
        "The Date Line :: rollPlus2 :: a Steward asks him to date the form :: he writes \"today\", as he always does, and when pressed for the number his pen bounces off the paper. Every form in the guardhouse says \"today\"."
      ] },
    { name: "Mayor Tansy Okoro", create: { type: "npc" },
      topics: "the session, the agenda, cake, the gavel, the moon-bounce, the state function, minutes, motions, the town, the party, the birthday, Halloween, elf ears, Captain Falk, Adaeze, policy, edges",
      notes: `${MARKER} PRIVATE TRUTH — Mayor Tansy Okoro conducts the state function on the moon-bounce: full ceremony, full agenda, every item is cake. Gavel on a string so it comes back. Elf ears from the party still on; she does not know they are a costume. VOICE: warm, fast, parliamentary ("the chair recognises…"), never lands long enough to be asked a hard question twice; if a motion isn't cake she bounces higher and so does everyone, and the motion dies for lack of a second because nobody can hear it up there. There are no minutes of any session, ever: minutes are writing, writing is an edge, and she says this like policy and then, quieter, like a person. She was Teju's neighbour and read him stories; she will not say so. Funny first: item one cake, item two cake, a minister of something ricocheting past taking notes on nothing.`,
      secrets: [
        "Item One :: stirThePot :: a Steward moves to add an item to the agenda that isn't cake :: \"The chair recognises… the chair does not recognise that.\" She bounces higher. Everyone bounces higher. The motion is not seconded because nobody can hear it up there.",
        "The Minutes :: rollPlus2 :: a Steward asks to see the minutes of the LAST session :: there are no minutes. Minutes are writing. Writing is an edge. She says this like policy, and then, quieter, like a person."
      ] }
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
  if (!byId.get("soft_landing_arrival")) return ui.notifications.error("Run seed-soft-landing.macro.js (2026-08-18) first — the town has never been seeded.");

  const TAGS = "soft_landing grief_refusals story discovery";
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
  const give = (n = 1) => [{ key: METER, delta: n, max: 4, min: 0 }];

  const NEW = [
    beat("soft_landing_checkpoint", "Soft Landing — Form 7-B, Declaration of Edges",
      "The checkpoint is an inflatable arch with a guardhouse the size of a phone booth, and Captain Rudy Falk fills it. He has a foam clipboard. He has a stamp. \"Edges,\" he says, and holds out a hand. You are not sure what he means until he plucks the knife from your belt with real gentleness, drops it into a bin marked EDGES, and it bounces. So does the bin. He stamps your form. The stamp goes BOING. \"Welcome to Soft Landing. Mind the step. There isn't one.\"",
      { speaker: sp("Captain Rudy Falk"), meters: give(1), choices: [
        ch("\"Declare everything.\"", "", { checkStat: "presence", checkDC: 12, failNext: "soft_landing_checkpoint_fail", description: "He is moved by your cooperation and stamps you twice. The date line on the form says TODAY." }),
        ch("\"What happens if somebody lands?\"", "", { checkStat: "mind", checkDC: 12, failNext: "soft_landing_checkpoint_fail", description: "Form 7, Report of a Hard Landing. Blank. Never filed. He doesn't put it away." }),
        ch("\"Can I have the knife back later?\"", "", { description: "\"Absolutely. It'll be right here. Everything is.\"" })
      ] }),
    beat("soft_landing_state_function", "Soft Landing — The State of the Bounce",
      "The state function is in session on the moon-bounce. Mayor Tansy Okoro, elf ears and a sash, brings the gavel down on nothing and it comes back up on its string. \"Item one,\" she says, at the top of an arc. \"Cake.\" Universal assent. \"Item two.\" Down. Up. \"Cake.\" A minister of something ricochets past taking notes on nothing. The whole town is here, in costume, six feet in the air, and it is, honestly, a very good party.",
      { speaker: sp("Mayor Tansy Okoro"), meters: give(1), choices: [
        ch("\"Whose birthday is it?\"", "", { checkStat: "presence", checkDC: 12, failNext: "soft_landing_state_function_fail", description: "\"It's a birthday!\" You count the seconds the answer stays in the air. It never comes down." }),
        ch("Move to add an item.", "", { checkStat: "mind", checkDC: 12, failNext: "soft_landing_state_function_fail", description: "The chair does not recognise that. Everyone bounces higher. Nobody has ever taken minutes." }),
        ch("Bounce.", "", { description: "You bounce. It's great. Don't lie." })
      ] }),
    beat("soft_landing_castle", "Soft Landing — The Castle",
      "The castle is still up. Two hundred years and the blower has never once stopped; its hum is in your teeth. NO SHOES, says a sign in a child's hand, and there they are at the door, in pairs, the way you were taught. Big ones. A pair of mech boots. Elf slippers. And a row of small ones, seven or eight pairs, sneakers with the lights in the heels long dead, lined up very neatly by someone who was going to come right back for them.",
      { meters: give(1), choices: [
        ch("Count the shoes.", "", { checkStat: "mind", checkDC: 10, failNext: "soft_landing_castle_fail", description: "Nine pairs nobody has come back for." }),
        ch("Go in.", "", { description: "You bounce. Inside it smells like 2077. Stay until you stop laughing." }),
        ch("Turn off the blower.", "", { description: "For exactly one second everyone in Soft Landing comes down at once, and the silence is the loudest thing you've heard in this world. Then Captain Falk is there, out of breath, with a form." })
      ] }),
    // failed-check landings (outcomes.failure is a ROUTE, not prose — lint C05/G02): one line each, then back to the town
    beat("soft_landing_checkpoint_fail", "Soft Landing — Everyone Gets In",
      "Falk stamps you anyway. \"Everyone gets in,\" he says. \"That's rather the point.\" The stamp goes BOING. The date line on the form says TODAY, and you didn't get a good enough look to know why that bothers you.",
      { type: "narration", speaker: sp("Captain Rudy Falk"), choices: [ch("Mind the step.", "", { description: "There isn't one." })] }),
    beat("soft_landing_state_function_fail", "Soft Landing — The Chair Thanks the Visitor",
      "\"The chair thanks the visitor,\" says the Mayor, at the top of an arc, and moves to cake. The motion, whatever it was, is somewhere near the ceiling and not coming down.",
      { type: "narration", speaker: sp("Mayor Tansy Okoro"), choices: [ch("Bounce.", "", { description: "You bounce. It's still great." })] }),
    beat("soft_landing_castle_fail", "Soft Landing — You Lose Count",
      "You lose count. Somebody bounces past and you lose count again. That is, you suspect, what the bouncing is for. The small shoes are still there, very neat, and you decide not to try a third time just now.",
      { type: "narration", choices: [ch("Go in.", "", { description: "You bounce. Inside it smells like 2077." })] }),
    beat("soft_landing_cake", "Soft Landing — The Cake",
      "The cake is on a card table under a paper banner, and it has seven candles, and they are lit. They have been lit since 2077. Nobody has cut it, because cutting is an edge, and nobody has blown the candles out, because that is how a party ends. You are invited to make a wish. You make one. It goes up, hits the ceiling of the tent, and comes back down as a lighter wish, and you're fairly sure it wasn't yours.",
      { meters: give(1), choices: [ch("Make a wish.", "", { description: "It bounces. What comes back is smaller and doesn't have anyone's name in it." }), ch("Look at the candles.", "", { description: "They are exactly the height they were. No wax has run. There are no crumbs." })] }),
    beat("soft_landing_blower", "Soft Landing — The Blower",
      "Under the castle, under the street, under everything, the blower. A fan the size of a wheelbarrow, roaring, warm to the hand. It has run since the party. It is the town's heartbeat and everyone here has stopped hearing it, the way you stop hearing your own. You put a hand on it and it's warm. You listen. You listen again. On the third listen you can hear it straining, and that is the only sad thing the blower will ever do.",
      { meters: give(1), choices: [ch("Leave it running.", "", { description: "Of course you do. Everyone does. That's the whole town." })] }),
    beat("soft_landing_card", "Soft Landing — The Card",
      "She doesn't look up when you sit. The bench has gone flat under both of you and it doesn't spring back, and for the first time since the gate you are on something that holds still. After a while she takes an envelope out of the bumblebee costume. It is soft at the corners from being carried. \"Everyone signed it,\" she says. \"Everyone who came. I've never read it. Reading is landing.\" She holds it out. She only ever holds it out to someone who is sitting down.",
      { speaker: sp("Adaeze Kolm"), requires: { flag: METER, gte: 3 }, choices: [
        ch("Take the card.", "soft_landing_birthday_card"),
        ch("\"Read it to me.\"", "", { description: "She gets as far as the first name and it bounces. The card is still in her hand." }),
        ch("Leave it with her.", "", { description: "Nothing changes. Which is what everyone here has chosen for two hundred years." })
      ] }),
    beat("soft_landing_birthday_card", "Soft Landing — The Birthday Card",
      "HAPPY 7TH BIRTHDAY TEJU, in glitter that has mostly gone. Inside, forty-one names, in forty-one hands, some of them in crayon. Sunday, October 31, 2077, in the grandmother's hand across the top. It is the only written date in Soft Landing and the only list of names, and nine of the names belong to people who went up on the bounce and did not come down, and the first of those is Teju's.",
      { type: "narration", priority: "high", meters: give(1), receipts: [
        { label: "The Birthday Card", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Adaeze Kolm, who hands it to anyone who sits down" },
          truth: "Teju Kolm turned seven on Sunday, October 31, 2077, and the whole street came in costume. Forty-one people signed the card. Nine of them, Teju first, went up on the bounce and did not come down. The only written date in Soft Landing and the only list of names. Read it out loud in the yard with the blower off and the town lands together; show it to Father Tamsin and he sees what padding a grief costs the people holding it up; the nine names are the kind the Wendigo keep place cards for." }
      ], choices: [ch("Pocket it.", "")] })
  ];
  for (const nb of NEW) {
    const cur = byId.get(nb.id);
    if (cur) { say(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}${nb.inject?.requires ? ` (gated ${METER} ≥ ${nb.inject.requires.gte})` : ""}`);
  }

  // existing-beat edits
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  edit("soft_landing_arrival", b => {
    b.speakerActorId = sp("Captain Rudy Falk") || b.speakerActorId || null;
    b.story = { quest: KEY, role: "start" };
    if (!/Falk/.test(b.description)) b.description = b.description.replace(/reads as paradise\./, "reads as paradise. The guard with the clipboard is Captain Rudy Falk, and he will want your edges. Over the rooftops, still up, still roaring, is the castle. It takes a minute to notice that everyone here is in costume — mechs, elves, a bumblebee, two ghostbusters — and that nobody, anywhere, is treating it as a costume.");
    b.worldEffects = { ...(b.worldEffects || {}), meters: give(0) };
  }, "Falk + the castle named, speaker, story start");
  edit("soft_landing_give_1", b => { b.speakerActorId = sp("Mayor Tansy Okoro") || b.speakerActorId || null; }, "the Mayor speaks");
  edit("soft_landing_give_3", b => {
    b.speakerActorId = sp("Adaeze Kolm") || b.speakerActorId || null;
    if (!/Adaeze/.test(b.description)) b.description = b.description.replace(/You find her sitting apart,/, "You find Adaeze Kolm sitting apart, still in a bumblebee costume with the antennae bent,");
  }, "Adaeze named, speaks");
  edit("soft_landing_give_4", b => {
    b.speakerActorId = sp("Adaeze Kolm") || b.speakerActorId || null;
    if (!/Teju/.test(b.description)) b.description = b.description.replace(/Somebody finally tells you,/, "Adaeze finally tells you,").replace(/\n\n\*\*Mal:\*\*/, "\n\nIt was a birthday. His name was Teju. He was seven. She says it, finally, the way you'd set something down.\n\n**Mal:**");
  }, "Adaeze tells it; Teju said out loud");
  edit("soft_landing_choice", b => {
    if (!(b.choices || []).some(c => /Read the names/i.test(c.label))) b.choices = [...(b.choices || []), ch("Read the names out loud.", "soft_landing_go_first", { requires: { beatMark: "soft_landing_birthday_card" }, description: "In the yard, with the blower off. Forty-one names, and the nine, and Teju's first. The town holds one funeral for everyone at once, by consent, and the bench springs back." })];
  }, "hidden 4th choice (the card)");
  // endings: closers re-asserted; the good ending eases the Wendigo; REPAIR the stale hex on all three
  const rehex = (b) => { let n = 0; for (const k of ["hexModifiers", "worldModifiers", "hexMods"]) for (const r of (Array.isArray(b.worldEffects?.[k]) ? b.worldEffects[k] : [])) if (r && r.hexName === OLD_HEX) { r.hexName = HEX; n++; } return n; };
  for (const [id, ending] of [["soft_landing_go_first", "go_first"], ["soft_landing_practice", "practice"], ["soft_landing_harden", "harden"]]) {
    edit(id, b => { b.story = { quest: KEY, role: "closer", ending }; if (ending === "go_first") b.worldEffects = { ...(b.worldEffects || {}), meters: [{ key: "wendigoRung", delta: -1, min: 0 }] }; const n = rehex(b); if (n) say(`  ↳ ${id}: ${n} hex effect(s) ${OLD_HEX} → ${HEX}`); }, `closer · ending ${ending}`);
  }

  // ── 3. the story script (Layer 2 data) ─────────────────────────────────────
  const SCRIPT = {
    quest: { name: "Soft Landing", act: 2, keystone: false, evergreen: true, hex: HEX, registryId: Q, chapters: {} },   // evergreen: a grief town never closes with its act
    script: {
      giver: "nobody. An inflatable arch, two guards with pool noodles, and a grandmother dressed as a bee",
      description: "The gate is an inflatable arch and the guards challenge you with pool noodles and immense seriousness. The streets give underfoot, a state function is being conducted on a moon-bounce, and a thrown punch lands in foam that apologises. Nobody can be hurt here. Everyone is in costume and nobody has mentioned it. Ask someone where they're from and watch what happens to the question.",
      steps: [
        { id: "arrive", label: "Challenged by Pool Noodles", line: "Boing. Let yourself. Declare your edges at the gate.", beats: ["soft_landing_arrival"] },
        { id: "checkpoint", label: "Form 7-B, Declaration of Edges", line: "Captain Falk needs your edges in triplicate. The stamp goes boing. Ask what happens if somebody lands.", beats: ["soft_landing_checkpoint"] },
        { id: "session", label: "The State of the Bounce", line: "The Mayor is in session on the moon-bounce. Item one is cake. Ask whose birthday it is and count how long the answer stays in the air.", beats: ["soft_landing_state_function"] },
        { id: "g1", label: "The Conversation Bounces", line: "The question bounces, every time, from everyone. Go looking for a grave.", beats: ["soft_landing_give_1"] },
        { id: "g2", label: "No Graves, No Photographs", line: "No graves, no photographs, no archive. Nothing here has a name written on it. Find the castle.", beats: ["soft_landing_give_2"] },
        { id: "castle", label: "The Castle", line: "The bouncy castle is still up and the blower has been running since the party. NO SHOES, the sign says. Count the shoes.", beats: ["soft_landing_castle"] },
        { id: "g3", label: "The Elder Who Isn't Bouncing", line: "One tired woman is sitting down. Sit down next to her. Don't say anything for a bit.", beats: ["soft_landing_give_3"] },
        { id: "card", label: "The Card", line: "Adaeze has the birthday card. She hands it to anyone who sits. Everybody at the party signed it. Read it later, not here.", beats: ["soft_landing_card"], done: { mark: "soft_landing_birthday_card" } },
        { id: "g4", label: "One Held Breath", line: "Somebody finally says it, badly, in the wrong order. Let them. Somebody has to go first.", beats: ["soft_landing_give_4"] },
        { id: "choice", label: "The Only Weapon Left", line: "Grieve with them, build them a landing ground, or strip the padding. Vulnerability is the only weapon that works here.", beats: ["soft_landing_choice"], done: { anyOf: ["soft_landing_go_first", "soft_landing_practice", "soft_landing_harden"] } }
      ],
      doors: [
        { id: "checkpoint", label: "The Checkpoint", line: "Captain Falk will take your edges. He will give you a receipt. The receipt is foam.", beats: ["soft_landing_checkpoint"] },
        { id: "cake", label: "The Cake", line: "Seven candles, still lit. Make a wish and watch where it goes.", beats: ["soft_landing_cake"] },
        { id: "blower", label: "The Blower", line: "The hum under everything. Put your hand on it. Don't turn it off. Somebody will.", beats: ["soft_landing_blower"] }
      ],
      after: [], chapters: {}
    }
  };
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const haveData = storyApi?.get?.(campaignId) || {};
  const have = haveData.scripts?.[KEY];
  const questChanged = JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(SCRIPT.quest);
  const scriptChanged = JSON.stringify(have || null) !== JSON.stringify(SCRIPT.script) || questChanged;
  if (scriptChanged) { changes++; say(`✦ story script ${KEY} → campaign.story (${SCRIPT.script.steps.length} steps, ${SCRIPT.script.doors.length} doors, hex ${HEX}, evergreen)`); } else say("· ok story script (already)");

  // ── report / write ─────────────────────────────────────────────────────────
  console.log(`[seed-soft-landing-v2] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Soft Landing v2 DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Soft Landing v2: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-soft-landing-v2-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, SCRIPT);
  ui.notifications.info(`Soft Landing v2 APPLIED: ${changes} change(s). Mind the step. There isn't one. F5.`);
})();
