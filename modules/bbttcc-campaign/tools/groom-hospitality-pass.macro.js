/* groom-hospitality-pass.macro.js — Phase-1 hospitality pass
 * (2026-07-15, HOSPITALITY-PASS-2026-07-15.md — the ✍ sprint spun off the
 *  Phase Charter: "NPCs currently put PCs to work immediately")
 *
 * THE PROBLEM: choice navigation (runBeat) deliberately ignores
 * inject.requires — gates only govern what the Director OFFERS. So at
 * Phase 1 the town routes still funnel straight into quest lists and
 * work-assignment dialogs (Joan's sendoff → "Quest List", Yarrow assigns
 * the Stabilizer + East Wall on first hello, Etta opens with the Vault).
 *
 * THE FIX (needs the phaseEntry engine seam in bbttcc-campaign module.js,
 * deployed 2026-07-15):
 *  1. Creates 11 new Phase-1 beats — a "town walk" hospitality hub per
 *     town + NPC welcome beats (Yarrow, Etta, Elsin, Rowan, Drax, Sable
 *     Nine, the Gullywasher bartender). All gated storyPhase gte 1.
 *  2. Stamps phaseEntry = { belowPhase: 2, to: <P1 variant> } on the
 *     work-assignment routers, so ALL existing wiring (Leave choices,
 *     Joan's sendoff, scene flows) lands on hospitality below Phase 2
 *     and on the original hooks at Phase 2+. Zero choices rewired.
 *  3. Two label edits: Joan's "Go To Allesh Gilliam Quest List" →
 *     "Walk your new town" · Fixit's "Launch Quest List?" → "Head inside".
 *  4. Welcome beats copy speakerActorId from their P2 convo siblings
 *     (portrait/tableau parity for free).
 *
 * Idempotent · DRY_RUN default true · backs up campaigns before writing.
 * Run as GM on EACH instance. Validate: with storyPhase < 2, run
 * avuncular_joans_speech → its choice should land on the AG town walk.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── the redirect map: work-assignment router → Phase-1 variant ───────────
  const PHASE_ENTRY = {
    allesh_gilliam_quest_hub_1:         "allesh_gilliam_town_walk",
    allesh_gilliam_introduction_to_hq:  "allesh_gilliam_yarrow_welcome",
    allesh_gilliam_the_long_market_intro: "allesh_gilliam_etta_welcome",
    lyrenn_main_scene:                  "lyrenn_town_walk",
    khezek_tor_main_scene:              "khezek_tor_town_walk",
    khezek_tor_quest_scene:             "khezek_tor_town_walk",
    fixit_intro_scene:                  "fixit_town_walk",
    fixit_gullywasher_interior_convo:   "fixit_gullywasher_welcome",
  };
  const BELOW_PHASE = 2;

  // welcome beat → the P2 convo beat whose speakerActorId it inherits
  const SPEAKER_FROM = {
    allesh_gilliam_yarrow_welcome: "allesh_gilliam_introduction_to_hq",
    allesh_gilliam_etta_welcome:   "allesh_gilliam_etta_bloom_conversation",
    lyrenn_elsin_welcome:          "lyrenn_elsin_quade_convo",
    lyrenn_rowan_welcome:          "lyrenn_rowan_of_the_loam_convo",
    khezek_tor_drax_welcome:       "khezek_tor_drax_calder_convo",
    khezek_tor_sable_welcome:      "khezek_tor_sable_nine_convo",
  };

  // choice label edits (target beats unchanged — the redirect does the rest)
  const LABEL_EDITS = [
    { beat: "avuncular_joans_speech", match: /quest list/i,
      label: "Walk your new town",
      desc: "Yours now. All of it. Better go be met." },
    { beat: "fixit_cinematic_intro", match: /launch quest list/i,
      label: "Head inside",
      desc: "Go on. The math is friendly today." },
  ];

  // ── the Phase-1 beats (quest resolved by NAME at run time) ────────────────
  const NB = (id, quest, label, timePoints, description, choices) =>
    ({ id, quest, label, timePoints, description, choices });
  const C = (label, next, desc) => ({ label, next: next || "", description: desc || "" });

  const NEW_BEATS = [

    // ═══ ALLESH-GILLIAM ══════════════════════════════════════════════════
    NB("allesh_gilliam_town_walk", "Allesh-Gilliam",
       "Allesh-Gilliam — The Welcome Round", 0.5,
`Nobody hands you a to-do list. That's tomorrow's problem — today the town wants to be met.

Word of your arrival moves faster than you do. By the second street, people have already sorted you: nod, wave, wary once-over, one kid walking exactly in your footsteps like it's a game with rules. Somebody's smoking brisket in a half-buried school bus. The wall creaks. The chimes answer.

Allesh-Gilliam doesn't ask what you're going to fix. It asks whether you'll eat here, sleep here, learn names here. Everything else — and there is going to be an EVERYTHING else — keeps until you've been introduced.

Where to first?`,
      [
        C("The HQ", "allesh_gilliam_hq_cinematics",
          "Your new command center / former S'narchy Burger. Go stand in it and feel like you're in charge. Practice your in-charge face. You have one, right?"),
        C("Marshal Pike, at the HQ", "allesh_gilliam_yarrow_welcome",
          "The man himself. He will not get up. Go say hi anyway — it's how the coffee happens."),
        C("St Gilliam's", "allesh_gilliam_st_gilliams_cinematics",
          "Father Tamsin runs the church-slash-bed-and-breakfast. There is food, and nobody measures you. Genuinely cannot overstate how rare that combination is."),
        C("The Long Market", "allesh_gilliam_the_long_market_intro",
          "Commerce! Gossip! Etta Bloom! At least one of these three will size you up for a shelf. Browse anyway."),
        C("The Waiting Room", "allesh_gilliam_waiting_room_intro",
          "The bar. It used to be a clinic, and in several load-bearing ways it still is."),
        C("The Vacancy", "allesh_gilliam_vacancy_intro",
          "The motel. Verna counts everything. Wave at her. Be countable."),
        C("The Plumb Office", "allesh_gilliam_plumb_office_intro",
          "The town's Structural Authority (self-certified). An experience."),
        C("The Muster", "allesh_gilliam_muster_intro",
          "The militia. GOOD VIBES ONLY. But also GUNS and SWORDS and SHOUTING."),
        C("Call it a day", "",
          "Boots off. Roof overhead. The town exhales, and — look at that — so do you."),
      ]),

    NB("allesh_gilliam_yarrow_welcome", "Allesh-Gilliam",
       "Allesh-Gilliam — Pike Doesn't Get Up", 0.25,
`Marshal Yarrow Pike doesn't stand when you enter. He leans against the counter like it's the only thing in the room that hasn't disappointed him yet.

Scar across the jaw. Eyes that measure distances automatically. He measures yours.

"So you're the new variable."

He lets that sit while he pours two cups of something that is legally coffee. Slides one across. Doesn't watch to see if you drink it — which is, you will learn, Pike for hospitality.

"Town'll show you what it needs soon enough. It always does. Tonight it doesn't need a thing from you except to know your face."

He tips his cup toward the glowing menu boards — hex readouts, patrol routes, soft-warning colors.

"That's the town, breathing. You'll learn to read it. Not tonight."

A pause that almost qualifies as friendly.

"Eat something. Sleep behind the wall. Tomorrow's allowed to wait for you — that's an order I only give once."`,
      [
        C("Drink the coffee", "",
          "It is HOT and it is BROWN, and beyond that no promises were made or kept. Pike nods about one millimeter. You're fairly sure that's a medal."),
        C("Ask what the boards are for", "",
          "\"Tomorrow,\" he says. Not unkindly. The boards glow on, keeping the town's pulse where everyone can see it."),
        C("Leave him to it", "allesh_gilliam_town_walk"),
      ]),

    NB("allesh_gilliam_etta_welcome", "Allesh-Gilliam",
       "Allesh-Gilliam — Tea at the Long Market", 0.25,
`A roofed strip of welded awnings runs down what used to be Main Street. Food from Lyrenn. Ore and tools from Khezek Tor. Jackalope goods passing through, quietly.

A matronly Menhirkin in an intricate robe intercepts you with the serenity of continental drift. Etta Bloom — the closest thing Allesh-Gilliam has to a mayor, which is not very close, and that's how everyone prefers it.

"There you are," she says, like you were expected and only slightly late. "Walk with me. Don't buy anything yet — the prices are wrong today. They're always wrong the day something interesting arrives, and today that's you."

She steers you down the row: who bakes, who barters, who waters the beer (nobody, twice a week). She presses a warm skewer of something into your hand. It's good. It's REALLY good.

"Questions keep," she says, patting your arm. "Come by when you've slept. I find people decide better on the far side of a night's sleep. And I do like people who decide well."`,
      [
        C("Eat the skewer", "",
          "Unidentified. Delicious. Statistically it was at least 40% something you'd rather not name, and you find you are at peace with that."),
        C("Ask what's on the skewer", "",
          "Etta smiles like a door closing gently. \"Seconds?\""),
        C("Thank her and move on", "allesh_gilliam_town_walk"),
      ]),

    // ═══ LYRENN ══════════════════════════════════════════════════════════
    NB("lyrenn_town_walk", "Lyrenn",
       "Lyrenn — Walking the Rows", 0.5,
`Lyrenn doesn't greet you. It notices you — which around here is the same thing, done more honestly.

The rows bend with the light. Wind chimes made from irrigation parts keep up their constant nervous music. Workers straighten as you pass, tip a tool, and go back to it: no ceremony, no suspicion, just a place with too much growing to stop for anybody.

Somebody has left a jug of cold well-water and two cups on a fence post along the main path. It was not there a minute ago. Nobody nearby takes credit.

The soil is dark, the air is sweet, and the whole hex is paying attention. Be worth paying attention to.

Who do you want to meet?`,
      [
        C("The Green Ring", "lyrenn_green_ring_cinematic",
          "The town circle. Where Lyrenn talks TO itself, ABOUT itself, in front of itself. Radial farming and communal grievances."),
        C("Meet Elsin Quade", "lyrenn_elsin_welcome",
          "Keeper of the ledgers. A handshake like a soil report."),
        C("Meet Rowan of the Loam", "lyrenn_rowan_welcome",
          "Keeper of the listening. Do not expect them to hurry. The ground doesn't."),
        C("Drink the well-water", "",
          "Cold. Clean. Faintly mineral. The fence post creaks in a way you'd swear was \"you're welcome.\""),
        C("Call it a day", "",
          "You sleep in a loft over the co-op. The chimes work the night shift. The land files you under: PENDING."),
      ]),

    NB("lyrenn_elsin_welcome", "Lyrenn",
       "Lyrenn — Supper at Elsin's Table", 0.25,
`Elsin Quade takes your measure over one firm handshake and zero wasted words. Then, verdict rendered, she does the most disarming thing available to her: she feeds you.

Her table is co-op plank, scrubbed pale. The meal is squash, bread, and a stew that doesn't need to explain itself. She serves you first — that's policy, not affection — and eats like a woman who has budgeted exactly enough time for eating and intends to hit the estimate. The ledger sits closed on the shelf. You get the sense that it being closed, in front of you, on your first night, is a statement of some kind.

"Farm feeds the town," she says, by way of grace. "Town holds the wall. Wall keeps the farm. That's the whole religion."

She refills your bowl without asking.

"Everything else is weather."`,
      [
        C("Compliment the stew", "",
          "\"It's food,\" she says. But the corner of her mouth files an exception."),
        C("Offer to wash up", "",
          "She watches you dry each bowl like an auditor. You pass. PROBABLY."),
        C("Say goodnight", "lyrenn_town_walk"),
      ]),

    NB("lyrenn_rowan_welcome", "Lyrenn",
       "Lyrenn — Rowan Introduces You to the Ground", 0.25,
`You find Rowan of the Loam standing in a fallow row, doing nothing at all, doing it with total commitment.

They study you like a half-remembered dream. Then they crouch, press one palm flat to the soil, and gesture — unhurried, unmistakable — for you to do the same.

The ground is warm where it should be cool. Under the warmth, very faint, a rhythm. Not a heartbeat. More like breathing heard through a wall.

"It likes to know the weight of new people," Rowan says. "Now it knows yours."

They straighten up and give you the rarest thing in Bad Eden: a smile with nothing behind it but the smile.

"Welcome to Lyrenn. Walk gently the first week. It notices manners."`,
      [
        C("Ask what the rhythm is", "",
          "Rowan considers. \"Growing,\" they decide, \"is a sound, if you're patient.\" That is apparently the whole answer."),
        C("Sit in the fallow row a while", "",
          "You and Rowan do nothing together, expertly, until sundown. This is — and you'd fight anyone who said otherwise — one of the ten best meetings of your life."),
        C("Head back", "lyrenn_town_walk"),
      ]),

    // ═══ KHEZEK TOR ══════════════════════════════════════════════════════
    NB("khezek_tor_town_walk", "Khezek Tor",
       "Khezek Tor — A Seat at the Cookline", 0.5,
`You hear Khezek Tor before you see it. A low, constant vibration — stone grinding against memory. Floodlights burning day and night. Not for visibility. For warning.

But at the shift change, the mountain shows you its other face: the cookline.

A welded row of drum-stoves at the mine's mouth, run by a granite-armed cook named Bez who does not take requests and has never needed to. Miners come up gray, eat, and turn back into people by the third bite. A place gets made for you on the bench — no discussion, someone just shoves down and it exists.

Tin plate. Real portions. Somebody's fiddle, played badly, loved anyway.

Nobody asks what you're going to do about anything. Down here, showing up at the cookline IS the introduction.`,
      [
        C("Eat what Bez gives you", "",
          "You will never learn what it was. You will dream about it anyway. Bez nods once — the full Khezek Tor citizenship ceremony."),
        C("Meet Drax Calder", "khezek_tor_drax_welcome",
          "The foreman. He'll talk while he works. He never stops working."),
        C("Meet Sable Nine", "khezek_tor_sable_welcome",
          "The mapmaker. Keeps their maps folded like secrets, because they are."),
        C("Listen to the fiddle", "",
          "Three songs. All arguably the same song. The mountain hums under it, one register too low, like a very large uncle joining the chorus."),
        C("Call it a day", "",
          "You bunk in a container barrack. It is EXACTLY as comfortable as it sounds — and somehow you're out in minutes. The mountain rocks nobody to sleep. And yet."),
      ]),

    NB("khezek_tor_drax_welcome", "Khezek Tor",
       "Khezek Tor — Calder Talks While He Works", 0.25,
`Drax Calder doesn't shake hands — his are full. Chalk in one, level in the other, and a length of the Brace in front of him that he treats the way other people treat a sleeping animal.

"New watch," he says. Not a question. Word beat you down the mountain.

He keeps working while he talks, and what he talks about is the shift: who's on it, who's new, whose kid just moved from sorting to carting and got cheered down the whole line. The ledger behind him is rock, chalk, and arithmetic older than the coalition — every line somebody's shift, somebody's tonnage, somebody's name.

"You'll want to know the mine eventually," he says, tapping a chalk mark back into true. "The mine'll want to know you first. That part takes exactly as long as it takes."

He hands you a cup of the tar the miners call coffee.

"Tonight, you're a guest. Guests eat first and stay off the lifts. Both rules are load-bearing."`,
      [
        C("Drink the miner's coffee", "",
          "It stands up to the spoon. Possibly to a pickaxe. Your ancestors — ALL of them — feel this one."),
        C("Ask about the chalk marks", "",
          "\"Chalk's cheap,\" Calder says. \"Surprises aren't.\" He's watching the marks while he says it, so you know it's the closest thing he has to a lullaby."),
        C("Let him work", "khezek_tor_town_walk"),
      ]),

    NB("khezek_tor_sable_welcome", "Khezek Tor",
       "Khezek Tor — Sable Nine, at a Polite Distance", 0.25,
`Sable Nine has claimed the end of the bench nearest the light, folded over a map like a bird over an egg.

You get one eye. Then the other. The map, you notice, gets folded FIRST — before the greeting, before anything.

"You're the new watch," they say quietly. "You walk loud. That's not a criticism. It's data."

Up close, Sable is all economy: charcoal fingers, careful voice, the stillness of somebody who spends whole shifts listening to rock. They do not show you the maps. They do show you the good seat — back to the wall, view of the mouth, where the draft doesn't reach. In Sable Nine terms this is roughly a bouquet of flowers.

"Sit there when you visit," they say. "I'll know it's you without looking up. That saves us both a little."`,
      [
        C("Take the good seat", "",
          "The draft misses you entirely. Sable, not looking up, almost smiles. You have been ENTERED INTO THE RECORD."),
        C("Ask what they're mapping", "",
          "\"The mine,\" says Sable, in the tone of someone answering a different question than the one you asked. The folded map stays folded."),
        C("Leave them to it", "khezek_tor_town_walk"),
      ]),

    // ═══ FURRIER'S FIXIT FARM ════════════════════════════════════════════
    NB("fixit_town_walk", "Furrier's Fixit Farm",
       "Furrier's Fixit Farm — Open for Browsing", 0.5,
`Up close, the corpse that refused to lie down turns out to be extremely alive: generators humming, chimes clattering their endless key-and-casing argument, and a hand-painted OPEN sign with three exclamation points — one of which was clearly added later, in different paint. Somebody here believes in customer service. Somebody else here fixed the first somebody's spelling. (It used to say OPNE.)

A Jackalope kid — Pip, or possibly Patter — materializes at your elbow, walks you exactly one lap of the yard, points out the Gullywasher ("bar"), the Counter ("closed till Mara says"), Arc Bay ("LOUD later"), and the Generator hall ("escort only, it's not personal"), accepts no questions, and vanishes on the half-hop.

Best first-day tour you've ever had, honestly.`,
      [
        C("The Gullywasher", "fixit_saloon_cinematic",
          "There's a bar! The bartender situation is... look, just go see the bartender situation."),
        C("Browse the yard", "",
          "Rig parts, salvage sorted with terrifying precision, and a bin labeled MYSTERY (AS IS, NO REFUNDS, STOP ASKING). You do not buy the mystery. The mystery will keep."),
        C("Call it a day", "",
          "You bed down in the caravan loft. The chimes never fully stop. Neither, you suspect, does the math."),
      ]),

    NB("fixit_gullywasher_welcome", "Furrier's Fixit Farm",
       "Furrier's Fixit Farm — First Round's Cultural", 0.25,
`There is a Chupacabra standing behind the bar, washing glasses. Oh shit — he's the bartender.

That was not on your post-apocalyptic 5D bingo card this morning.

He clocks your face doing the thing every new face does, gives it precisely two seconds of patience, and slides a glass down the bar. Something amber. Something carbonated, aggressively.

"House rule," he says. The accent is pure ranch country. "First one's on the Farm. Second one, you tell me where you're from. Third one, I tell you where I'M from, and you buy THAT round, because it's a better story."

Around you: Jackalopes off shift, a teamster asleep sitting up with a full glass in hand (nobody touches it), and a dartboard where the bullseye has been relabeled ANYWHERE. The Gullywasher, it turns out, is exactly what it looks like: the one room in the wasteland where everybody's from somewhere else, and that's the whole point.`,
      [
        C("Drink the amber thing", "",
          "It tastes like peaches that did something unforgivable and got away with it. You'd order another, but your eyebrows are still filing their report."),
        C("Ask his name", "",
          "\"Behind the bar? Gully.\" A glass gets polished. \"Everywhere else — we'll see if you earn it.\""),
        C("Back to the yard", "fixit_town_walk"),
      ]),
  ];

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  let questsRaw = game.settings.get(NS, "quests");
  const quests = typeof questsRaw === "string" ? JSON.parse(questsRaw) : questsRaw;
  const report = [];
  let changes = 0;

  const qidByName = {};
  for (const q of Object.values(quests || {})) if (q?.id) qidByName[String(q.name || "").trim()] = q.id;
  const beatById = id => camp.beats.find(b => String(b?.id) === String(id));

  // ── 1. create the Phase-1 beats ───────────────────────────────────────────
  for (const nb of NEW_BEATS) {
    if (beatById(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    const questId = qidByName[nb.quest];
    if (!questId) { report.push(`⚠ SKIP ${nb.id}: quest "${nb.quest}" not found`); continue; }
    const beat = {
      id: nb.id, label: nb.label, type: "dialog", timeScale: "scene",
      timePoints: nb.timePoints, questId,
      tags: "", politicalTags: "",
      outcomes: { success: null, failure: null },
      inject: { requires: [{ flag: "storyPhase", gte: 1 }] },
      actors: [],
      choices: nb.choices.map(c => ({ label: c.label, next: c.next, description: c.description })),
      worldEffects: {},
      description: nb.description,
      playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true,
      playerFacingContent: true, showToPlayers: true,
      audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false },
    };
    const src = beatById(SPEAKER_FROM[nb.id]);
    if (src?.speakerActorId) beat.speakerActorId = src.speakerActorId;
    camp.beats.push(beat);
    changes++; report.push(`✚ beat created: ${nb.id}${beat.speakerActorId ? " (speaker inherited)" : ""}`);
  }

  // ── 2. phaseEntry stamps ──────────────────────────────────────────────────
  for (const [from, to] of Object.entries(PHASE_ENTRY)) {
    const b = beatById(from);
    if (!b) { report.push(`⚠ SKIP phaseEntry ${from}: beat not found`); continue; }
    if (!beatById(to)) { report.push(`⚠ SKIP phaseEntry ${from}: target ${to} missing`); continue; }
    if (b.phaseEntry?.to === to && Number(b.phaseEntry?.belowPhase) === BELOW_PHASE) {
      report.push(`· ok phaseEntry (already) ${from} → ${to}`); continue;
    }
    b.phaseEntry = { belowPhase: BELOW_PHASE, to };
    changes++; report.push(`⚡ phaseEntry: ${from} → ${to} (below phase ${BELOW_PHASE})`);
  }

  // ── 2½. choice adds (merge into beats that ALREADY exist from a prior
  //        apply — creation above already includes these on fresh worlds) ────
  const CHOICE_ADDS = [
    { beat: "allesh_gilliam_town_walk", after: "The HQ",
      choice: { label: "Marshal Pike, at the HQ", next: "allesh_gilliam_yarrow_welcome",
        description: "The man himself. He will not get up. Go say hi anyway — it's how the coffee happens." } },
  ];
  for (const a of CHOICE_ADDS) {
    const b = beatById(a.beat);
    if (!b) { report.push(`⚠ SKIP choice add: beat ${a.beat} not found`); continue; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => String(c?.label) === a.choice.label)) { report.push(`· ok choice (already) ${a.beat} ← "${a.choice.label}"`); continue; }
    const idx = b.choices.findIndex(c => String(c?.label) === a.after);
    if (idx >= 0) b.choices.splice(idx + 1, 0, a.choice); else b.choices.push(a.choice);
    changes++; report.push(`⚡ choice added: ${a.beat} ← "${a.choice.label}"`);
  }

  // ── 3. label edits ────────────────────────────────────────────────────────
  for (const e of LABEL_EDITS) {
    const b = beatById(e.beat);
    if (!b) { report.push(`⚠ SKIP label edit: beat ${e.beat} not found`); continue; }
    const ch = (b.choices || []).find(c => e.match.test(String(c?.label || "")));
    if (!ch) {
      const done = (b.choices || []).some(c => String(c?.label) === e.label);
      report.push(done ? `· ok label (already) ${e.beat} → "${e.label}"` : `⚠ SKIP label edit ${e.beat}: no choice matches ${e.match}`);
      continue;
    }
    report.push(`⚡ label: ${e.beat} "${ch.label}" → "${e.label}"`);
    ch.label = e.label;
    if (e.desc && !ch.description) ch.description = e.desc;
    changes++;
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[groom-hospitality] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Hospitality pass DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Hospitality pass: nothing to do — already groomed.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-hospitality-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Hospitality pass APPLIED: ${changes} change(s). Below Phase 2, the towns now host before they hire.`);
})();
