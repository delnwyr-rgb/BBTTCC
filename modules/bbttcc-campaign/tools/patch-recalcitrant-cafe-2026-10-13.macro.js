/* patch-recalcitrant-cafe-2026-10-13.macro.js — RUN IN-WORLD (GM, each live instance). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RECALCITRANT CAFE (Dave, 2026-10-13 — "make the town walk's choices have impact"). Drax's welcome already says it:
 * "Gruff Men With Coffee … The Recalcitrant Cafe. Someone write that down." This is the writing down.
 *
 * SEVEN MEALS, one per host, each behind a conversation that can go bad:
 *   Pike   (AG)  coffee   — rule: take the cup and shut up          · break: set it down and ask what's in it
 *   Etta   (AG)  skewer   — rule: the Long Market runs on not asking · break: ask AGAIN what's in it
 *   Tamsin (AG)  cauldron — Presence check DC 11 (take charity without measuring or being measured)
 *   Elsin  (LY)  supper   — Presence check DC 11 (say grace in zero wasted words)
 *   Bez    (KT)  bench    — rule: Bez does not take requests         · break: ask for it without the gray bits
 *   Drax   (KT)  tar      — rule: guests stay off the lifts          · break: hop a lift for a look
 *   Gully  (FX)  amber    — rule: second one, you say where you're from · break: keep it to yourself
 * Goes well → a MEAL beat (worldEffects.partyEffects: a timed buff on every Steward until the turn ends; WME §2n) and the beat
 * is marked played. Goes bad → a SOURED beat (coalition morale −2, the town's standing −1 step); the offer stands next visit —
 * none of these people hold a grudge past a night's sleep.
 * THE COFFEE: "Young Gearbox's Forgotten Coffee" — a gear Item in The Absolutely Reliable's hold. Brewing it (rc_gearbox_coffee,
 * offered from the lease card and both Day's End beats) needs ALL SEVEN meals played and the lease not lapsed (the tin leaves
 * with the hovercraft). It grants every Steward the spark "recalcitrant_cafe" integrated (WME §2o → the Enlightenment ladder
 * steps; never lowers) + a permanent "Member — The Recalcitrant Cafe" feature. One pot. Exactly one.
 * Needs: world-mutation-engine §2n/§2o (deployed 2026-10-13). Idempotent; one backup. Town factions resolved BY NAME at run time
 * (relationship rows are skipped, with a report line, where a town has no faction actor).
 * HOW TO RUN: 1) hard-reload; 2) run (DRY_RUN = true) → console (F12); 3) DRY_RUN = false, run again; 4) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m); const actorEdits = [];
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id} (already)`); };
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  // ── town factions, BY NAME (never hardcode which actors founded this world) ──────────────────────────────────────────
  const kindOf = game.bbttcc?.api?.actorKind;
  const isFaction = (a) => { try { return typeof kindOf === "function" ? kindOf(a) === "faction" : !!a?.getFlag?.("bbttcc-factions", "roster"); } catch (_e) { return false; } };
  const factionByName = (re) => game.actors.contents.find(a => isFaction(a) && re.test(String(a.name || "")));
  const TOWN = {
    ag: factionByName(/allesh/i), ly: factionByName(/lyrenn/i), kt: factionByName(/khezek/i), fx: factionByName(/fixit|furrier|jackalope/i),
  };
  for (const [k, a] of Object.entries(TOWN)) say(a ? `· town faction ${k} = ${a.name} (${a.id})` : `⚠ town faction ${k} not found — soured beats there cost morale only (no standing step)`);

  // ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  const HUB = { ag: "allesh_gilliam_town_walk", ly: "lyrenn_town_walk", kt: "khezek_tor_town_walk", fx: "fixit_town_walk" };
  const mkFrom = (parentId, id, label, description, { choices = [], worldEffects = {}, memoryText = null, speaker, where } = {}) => {
    const tpl = byId.get(parentId); if (!tpl) { say(`✗ MISSING parent ${parentId} for ${id}`); return null; }
    const b = foundry.utils.deepClone(tpl);
    Object.assign(b, { id, label, description, type: "dialog", choices, worldEffects, hexName: null, targetHexUuid: null, sceneId: null });
    b.tags = Array.from(new Set(String(b.tags || "").split(",").map(t => t.trim()).filter(Boolean).concat(["recalcitrant-cafe"]))).join(",");
    b.inject = { ...(tpl.inject || {}), repeatable: false, oncePerHex: false, requires: Array.isArray(tpl.inject?.requires) ? foundry.utils.deepClone(tpl.inject.requires) : [] };
    if (tpl.story && tpl.story.quest) b.story = { quest: tpl.story.quest }; else delete b.story;   // keep plain quest membership, never a start/end role
    delete b.award; delete b.questStep; delete b.phaseEntry;
    if (speaker !== undefined) { if (speaker) b.speakerActorId = speaker; else delete b.speakerActorId; }
    if (where) b.where = where; else delete b.where;
    if (memoryText) b.memoryText = memoryText; else delete b.memoryText;
    if (b.cinematic) b.cinematic = { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null };
    return b;
  };
  const buff = (name, note, { attribute = null, bonus = 1, strainRelief = 0, img } = {}) => ({
    name, note, duration: "turn", turns: 1, ...(img ? { img } : {}),
    ...(attribute ? { checkBonus: [{ context: "check", attribute, bonus, note: name }] } : {}),
    ...(strainRelief ? { strainRelief } : {}),
  });
  const soured = (town) => ({
    factionEffects: [{ factionId: "@coalition", moraleDelta: -2 }],
    ...(TOWN[town] ? { relationshipEffects: [{ sourceFactionId: "@coalition", targetFactionId: TOWN[town].id, step: -1 }] } : {}),
  });
  const back = (town, label = "Back to the Round") => ch(label, HUB[town]);

  // ── the seven meals + seven sourings ──────────────────────────────────────────────────────────────────────────────────
  const MEALS = ["rc_pike_coffee", "rc_etta_skewer", "rc_tamsin_cauldron", "rc_elsin_supper", "rc_bez_bench", "rc_drax_tar", "rc_gully_amber"];
  const NEW = [
    // PIKE ─ coffee
    mkFrom("allesh_gilliam_yarrow_welcome", "rc_pike_coffee", "Allesh-Gilliam — Legally Coffee",
`You drink it. You do not ask. Somewhere behind the scar, something that was braced for a question un-braces.

It is terrible. It is also, in the specific way of a hot thing handed to you by someone who did not have to, the best thing you've had since the hovercraft. Pike refills his own, not yours — you'll learn that's a compliment: he thinks you can find the pot.

"Boards'll make more sense with that in you," he says, and it's true. The patrol colours stop being colours and start being people.

<i>Pike's coffee: +1 on Mind checks until the turn ends. Gruff Men With Coffee, chapter one.</i>`,
      { memoryText: "Drank Marshal Pike's coffee without asking what was in it. He noticed.",
        worldEffects: { partyEffects: [buff("Pike's Coffee (legally)", "Hot, black, measured. The boards make more sense with it in you.", { attribute: "mind", img: "icons/consumables/drinks/coffee.webp" })] },
        choices: [ch("Ask what the boards are for", "ag_yarrow_answer_boards"), back("ag")] }),
    mkFrom("allesh_gilliam_yarrow_welcome", "rc_pike_soured", "Allesh-Gilliam — You Measured Him",
`You set the cup down. "What's in it?"

The room does not get colder, because the room was never warm. Pike looks at the cup, then at you, with the expression of a man adding a line to a ledger he'd hoped to keep short.

"Water," he says. "Mostly." He picks the cup up and pours it back into the pot, which is the single most eloquent thing anyone has done to you today.

"Town'll show you what it needs," he says. "Tonight it needed you to drink the coffee." He tips his head at the door. "Sleep behind the wall. Tomorrow's still allowed to wait. I'm allowed to wonder, though."

<i>The crew saw that. Morale −2; Allesh-Gilliam's standing slips a step. He'll pour again after you've slept — Pike doesn't hold a grudge, he just files it.</i>`,
      { memoryText: "Asked Marshal Pike what was in the coffee. He poured it back into the pot.",
        worldEffects: soured("ag"), choices: [back("ag", "Sleep on it")] }),

    // ETTA ─ skewer
    mkFrom("allesh_gilliam_etta_welcome", "rc_etta_skewer", "Allesh-Gilliam — Dinner, Named Is Extra",
`You eat the skewer. All of it. You do not ask.

Etta watches you not ask with the frank pleasure of a woman watching a decision get made well. "There," she says, like a diagnosis. "You'll do." A second skewer appears in your hand by a mechanism you did not observe.

It is — it's REALLY good. Whatever it is. You are at peace with whatever it is. People on the row who were doing the wary once-over are doing a different once-over now: she fed them, and they ate.

<i>Etta's skewer: +1 on Presence checks until the turn ends. The Long Market has decided about you.</i>`,
      { memoryText: "Ate Etta Bloom's skewer without asking what was on it. Seconds appeared.",
        worldEffects: { partyEffects: [buff("Etta's Skewer", "Warm, unnamed, REALLY good. The row saw you eat it.", { attribute: "presence", img: "icons/consumables/food/cooked-kebab-meat-skewer-orange.webp" })] },
        choices: [back("ag", "Thank her and move on")] }),
    mkFrom("allesh_gilliam_etta_welcome", "rc_etta_soured", "Allesh-Gilliam — The Other Currency",
`"No, but what's actually IN it?"

Etta's smile does not go anywhere. That's the frightening part. It stays exactly where it is while everything behind it quietly packs up and leaves.

"Named is extra," she says again, gently, the way you'd repeat something to a child who has been told. She takes the skewer back. Takes it BACK. Out of your hand. Turns and gives it to the kid who's been walking in your footsteps, who eats it in three bites without a single question, and looks at you like you failed a test he passed at six.

"Come by when you've slept," Etta says. "I find people decide better on the far side of a night." She pats your arm. It is not a warm pat.

<i>Morale −2; Allesh-Gilliam's standing slips a step. The skewer will be offered again. The question won't be answered.</i>`,
      { memoryText: "Asked Etta Bloom twice what was on the skewer. She gave the skewer to a child.",
        worldEffects: soured("ag"), choices: [back("ag", "Sleep on it")] }),

    // TAMSIN ─ cauldron
    mkFrom("allesh_gilliam_tamsin_welcome", "rc_tamsin_cauldron", "Allesh-Gilliam — From the Cauldron",
`The cauldron at the back of St Gilliam's has been going since before the pews went to firewood, and it has never once been empty. Father Tamsin ladles without looking at the bowl, because he's looking at you, and whatever he sees there he decides is fine.

"Nobody gets measured at this door," he says, "and that includes by themselves. Sit." He sets it in front of you. It's soup in the way a hymn is a song.

Gary, at the far table, says something about the plumbing. Tamsin says GARY without turning round.

<i>St Gilliam's cauldron: +1 on Soul checks until the turn ends, and one level of Strain lifts off anyone carrying it. Nobody measured you. Rarer than you'd think.</i>`,
      { memoryText: "Took a bowl from Father Tamsin's cauldron without asking what it cost.",
        worldEffects: { partyEffects: [buff("St Gilliam's Cauldron", "Never empty. Nobody measured. Soup the way a hymn is a song.", { attribute: "soul", strainRelief: 1, img: "icons/consumables/food/bowl-stew-brown.webp" })] },
        choices: [ch("Ask what the building used to be", "ag_tamsin_answer_building"), back("ag", "Thank him — the Round isn't finished")] }),
    mkFrom("allesh_gilliam_tamsin_welcome", "rc_tamsin_soured", "Allesh-Gilliam — You Asked What You Owed",
`"What do I owe you for it?"

It comes out wrong. You hear it come out wrong. Father Tamsin's ladle stops halfway, and for the first time since you walked in, the light through the windows isn't helping anybody.

"Nobody gets measured at this door," he says, quietly. "I'd have thought that cut both ways." He sets the bowl back on the rail by the cauldron — not thrown, not snatched, just returned to the people it's for — and dries his hands on the towel with the ketchup history.

"Have the day first. Come back when the asking's gone out of you." Gary, at the far table, does not say anything about the plumbing. Even Gary.

<i>Morale −2; Allesh-Gilliam's standing slips a step. The cauldron's never empty. It will be there after you've slept.</i>`,
      { memoryText: "Asked Father Tamsin what the soup cost. He put the bowl back on the rail.",
        worldEffects: soured("ag"), choices: [back("ag", "Sleep on it")] }),

    // ELSIN ─ supper
    mkFrom("lyrenn_elsin_welcome", "rc_elsin_supper", "Lyrenn — Supper, Said Right",
`You say grace. It is four words long. Elsin Quade's eyebrows — which have been held at "verdict pending" since the handshake — settle.

"Good," she says, which from Elsin is a paragraph. The table fills in the Lyrenn way: nobody passes anything, bowls simply arrive where hands are. The stew is heavy and green and honest, and under it is bread that was a field this morning.

Rowan, from the doorway, says the rhythm's off tonight. Elsin says the rhythm's fine, eat. Both of them are right.

<i>Supper at Elsin's: +1 on Body checks until the turn ends. Four words. She counted.</i>`,
      { memoryText: "Said grace at Elsin Quade's table in four words. She approved.",
        worldEffects: { partyEffects: [buff("Supper at Elsin's", "Heavy, green, honest. Bread that was a field this morning.", { attribute: "body", img: "icons/consumables/food/bowl-stew-tofu-potato-brown.webp" })] },
        choices: [ch("Offer to wash up", "lyrenn_town_walk", { description: "She lets you. That's the second compliment of the evening and you should not expect a third." }), back("ly", "Say goodnight")] }),
    mkFrom("lyrenn_elsin_welcome", "rc_elsin_soured", "Lyrenn — Wasted Words",
`You say grace. It goes on. You hear it going on and you cannot find the end of it, and somewhere around the part about the long road here Elsin Quade puts her spoon down.

She does not interrupt. Lyrenn doesn't. She waits until you run out, which takes a while, and then she says: "Eat." Not kindly. Not unkindly. The way you'd say it to a hired hand on his first day.

The bowls arrive where hands are. Yours is smaller. Nobody mentions it, which in Lyrenn is how you mention things.

<i>Morale −2; Lyrenn's standing slips a step. Her table is set every night. Say less next time.</i>`,
      { memoryText: "Said grace at Elsin Quade's table at length. The bowl got smaller.",
        worldEffects: soured("ly"), choices: [back("ly", "Say goodnight")] }),

    // BEZ ─ bench
    mkFrom("khezek_tor_town_walk", "rc_bez_bench", "Khezek Tor — The Bench",
`You eat what Bez gives you. Gray bits and all. You will never learn what it was, and by the third bite you have stopped wanting to, because by the third bite you are, as advertised, turning back into a person.

Bez nods once. The full Khezek Tor citizenship ceremony. The miner beside you shoves down the bench another inch, which is the second ceremony, and nobody tells you that one exists.

Somewhere down the row Drax Calder is explaining to a new sorter why a lift is like a promise. You don't hear the end of it. You're eating.

<i>Bez's bench: +1 on Body checks until the turn ends, and one level of Strain comes off. You came up gray. You left a person.</i>`,
      { memoryText: "Ate what Bez gave you, gray bits included. Bez nodded.",
        worldEffects: { partyEffects: [buff("Bez's Bench", "Gray bits and all. By the third bite you were a person again.", { attribute: "body", strainRelief: 1, img: "icons/consumables/food/bowl-ribs-meat-rice-mash-brown-white.webp" })] },
        choices: [ch("Meet Drax Calder", "khezek_tor_drax_welcome"), back("kt", "Back to the mine's mouth")] }),
    mkFrom("khezek_tor_town_walk", "rc_bez_soured", "Khezek Tor — A Request",
`"Could I get it without the gray bits?"

The drum-stoves keep going. The fiddle keeps going. Everything keeps going except Bez, who stops, and a stopped Bez turns out to be the loudest thing at the mine's mouth.

Bez takes the bowl back. Bez scrapes it, slowly, into the pot, which is where it came from and where, Bez's whole posture says, it is perfectly happy to stay. The miner beside you does not shove down the bench. The miner beside you shoves UP it, half an inch, which you'd have thought wasn't a thing.

Bez does not take requests. Bez has never needed to. You have just explained to the entire shift why.

<i>Morale −2; Khezek Tor's standing slips a step. The bench will have room tomorrow. The gray bits are not negotiable.</i>`,
      { memoryText: "Asked Bez for it without the gray bits. The shift went quiet.",
        worldEffects: soured("kt"), choices: [back("kt", "Sleep on it")] }),

    // DRAX ─ tar
    mkFrom("khezek_tor_drax_welcome", "rc_drax_tar", "Khezek Tor — The Tar",
`You drink the tar. It fights back. You win, narrowly, and Drax Calder — who has not looked up from the chalk — says "Hm," which the sorter next to you later translates as "the new watch can take a cup."

It does something to your sense of the mountain. The hum in the rock that answers if you hum first? You can hear it now without humming. That's the tar. Or it's the mine deciding to know you a little early.

"Stay off the lifts," Drax says, tapping a mark true. "I say it to everyone. I say it twice to the ones I like."

<i>Miner's tar: +1 on Mind checks until the turn ends. Stacks with Pike's — Gruff Men With Coffee, chapter two.</i>`,
      { memoryText: "Drank Drax Calder's tar and stayed off the lifts. He said it twice.",
        worldEffects: { partyEffects: [buff("Miner's Tar", "It fights back. You win, narrowly. The rock hums without being asked.", { attribute: "mind", img: "icons/consumables/drinks/coffee.webp" })] },
        choices: [ch("Ask about the chalk marks", "khezek_tor_town_walk", { description: "Every line somebody's shift, somebody's tonnage, somebody's name. He shows you his own. It's short." }), back("kt", "Let him work")] }),
    mkFrom("khezek_tor_drax_welcome", "rc_drax_soured", "Khezek Tor — The Lift",
`You hop the lift. Just for a look. Just to the first landing, to see the Brace from above the way the shift sees it.

The lift takes you. The lift, it turns out, is one of the ones that is not load-bearing, and it says so, loudly, about a third of the way up, and you come down faster than you went, in a shower of chalk dust and one very old bolt.

Drax Calder has not moved. Drax Calder does not need to move. "Guests eat first," he says, "and stay off the lifts. Both rules are load-bearing." He looks at the lift. "One of them was." He hands you a brush. Not a cup. A brush.

<i>Morale −2; Khezek Tor's standing slips a step. The tar will be poured again. The lift will not be forgotten — Drax notices.</i>`,
      { memoryText: "Hopped a lift at Khezek Tor for a look. It was not load-bearing. Drax handed you a brush.",
        worldEffects: soured("kt"), choices: [back("kt", "Sleep on it")] }),

    // GULLY ─ amber
    mkFrom("fixit_gullywasher_welcome", "rc_gully_amber", "Furrier's Fixit Farm — Where You're From",
`You drink the amber thing. Your eyebrows file their report. Gully slides the second one down the bar without being asked, and waits.

You tell him where you're from. All of it, or enough of it. He listens the way bartenders listen, which is with the glass and not the eyes, and when you finish he nods like a man checking a box.

"That'll do." A third glass appears. "Mine's a better story. You're buying." He leans in. "And a thing you'll want to know, since you're the new folks on the Reliable: the kid left a coffee tin in her galley. Gearbox. Scratched a note on it, near as he gets to words. DON'T OPEN TILL YOU'VE EATEN EVERYWHERE." Gully polishes a glass. "House rule. Not mine. His."

<i>The amber thing: +1 on Intrigue checks until the turn ends. Everybody in this room is from somewhere else. Now so are you.</i>`,
      { memoryText: "Told Gully where you're from over the second amber thing. He mentioned Gearbox's coffee tin in the Reliable's galley.",
        worldEffects: { partyEffects: [buff("The Amber Thing", "Peaches that did something unforgivable and got away with it.", { attribute: "intrigue", img: "icons/consumables/drinks/alcohol-beer-stein-wooden-brown.webp" })] },
        choices: [ch("Ask his name", "fixit_town_walk", { description: "\"Behind the bar? Gully.\" A glass gets polished. \"Everywhere else — you're getting there.\"" }), back("fx", "Back to the yard")] }),
    mkFrom("fixit_gullywasher_welcome", "rc_gully_soured", "Furrier's Fixit Farm — Nowhere In Particular",
`You drink the amber thing. Gully slides the second one down the bar and waits. You drink that too, and when he asks, you say: nowhere in particular.

The Gullywasher is the one room in the wasteland where everybody's from somewhere else. You've just told the room you're from nowhere, which is the one place nobody in it respects.

Gully takes the second glass. Takes it mid-sip. "First one's on the Farm," he says, polishing, pleasant as a closed door. "Second one has a price. You didn't pay it." The teamster asleep sitting up with the full glass does not wake, but the glass somehow seems further from you than it was.

<i>Morale −2; the Farm's standing slips a step. The first one's always on the Farm. Come back with an answer.</i>`,
      { memoryText: "Told Gully you're from nowhere in particular. He took the second glass back mid-sip.",
        worldEffects: soured("fx"), choices: [back("fx", "Back to the yard")] }),

    // THE COFFEE
    mkFrom("reliable_the_lease", "rc_gearbox_coffee", "The Absolutely Reliable — Young Gearbox's Forgotten Coffee",
`The tin has been in the galley since the day he dropped you here. Scratched on the lid, in the block capitals of a man who treats words like bolts — use the fewest that hold — DON'T OPEN TILL YOU'VE EATEN EVERYWHERE.

You have eaten everywhere. Pike's coffee, Etta's skewer, the cauldron, Elsin's table, Bez's bench, the tar, the amber thing. The whole Recalcitrant Cafe, every grudging course of it. Somebody wrote it down.

You open the tin. It's coffee. Actual coffee — beans, not tar, not legally-coffee, the kind of thing that stopped existing fifty years before the Shattering and should not be in a hovercraft galley in East Texas. There's a second note under the lid, and it says: SHE RUNS BEST WITH PEOPLE IN HER WHO'VE BEEN FED.

You brew it. The Reliable's engine ticks. Probably coincidence.

<i>Every Steward integrates the spark <b>The Recalcitrant Cafe</b> — the Enlightenment ladder steps, and it never steps back — and keeps a permanent membership nobody will ever print a card for. One pot. Exactly one.</i>`,
      { where: "anywhere", speaker: null,
        memoryText: "Brewed Young Gearbox's forgotten coffee aboard The Absolutely Reliable after eating everywhere. The Recalcitrant Cafe, founded.",
        worldEffects: {
          sparkGrants: [{ key: "recalcitrant_cafe", name: "The Recalcitrant Cafe", note: "Young Gearbox's forgotten coffee, brewed after eating everywhere." }],
          partyEffects: [{ name: "Member — The Recalcitrant Cafe", duration: "permanent", img: "icons/consumables/drinks/coffee.webp",
            note: "You ate at every table that fed you without asking, and drank the forgotten coffee. Gruff Men With Coffee, honorary. Bez and Etta still won't say what was in it." }],
        },
        choices: [ch("Pour.", "", { description: "The pot goes round. Nobody asks what's in it." })] }),
  ].filter(Boolean);
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }
  // the coffee beat's own gate: every meal played, the lease not lapsed (the tin leaves with the hovercraft)
  const COFFEE_REQ = [...MEALS.map(id => ({ beatMark: id })), { beatMark: "reliable_lease_lapsed", not: true }];
  edit("rc_gearbox_coffee", b => { b.inject = { ...(b.inject || {}), repeatable: false, requires: foundry.utils.deepClone(COFFEE_REQ) }; }, "gate = all seven meals + lease not lapsed");

  // ── rewire the hosts: the eat/drink choice → MEAL, a rule-break → SOURED, a check for Tamsin and Elsin ─────────────────
  const retarget = (b, re, next) => { const c = (b.choices || []).find(x => re.test(String(x?.label || ""))); if (!c) { say(`⚠ ${b.id}: no choice matching ${re}`); return; } c.next = next; };
  const addBefore = (b, re, choice) => { b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(c => c.next === choice.next && c.label === choice.label)) return; const i = b.choices.findIndex(c => re.test(String(c?.label || ""))); b.choices.splice(i >= 0 ? i : b.choices.length, 0, choice); };
  edit("allesh_gilliam_yarrow_welcome", b => {
    retarget(b, /^drink the coffee/i, "rc_pike_coffee");
    addBefore(b, /^ask what the boards|^leave him/i, ch("Set the cup down and ask what's in it", "rc_pike_soured", { description: "He said take it. He didn't say ask." }));
  }, "coffee → meal · the question → soured");
  edit("allesh_gilliam_etta_welcome", b => { retarget(b, /^eat the skewer/i, "rc_etta_skewer"); }, "skewer → meal");
  edit("ag_etta_answer_skewer", b => {
    addBefore(b, /^thank|^move on|^back/i, ch("Take seconds. Don't ask.", "rc_etta_skewer", { description: "Named is extra. You decline the extra." }));
    addBefore(b, /^thank|^move on|^back/i, ch("Ask again. What's IN it?", "rc_etta_soured", { description: "The Long Market runs on two currencies. You're about to spend the wrong one." }));
  }, "seconds → meal · ask again → soured");
  edit("allesh_gilliam_tamsin_welcome", b => {
    addBefore(b, /^ask what the building|^thank him/i, ch("Take a bowl from the cauldron", "rc_tamsin_cauldron", { checkStat: "presence", checkDC: 11, failNext: "rc_tamsin_soured", description: "Nobody gets measured at this door. That includes by you. (Presence, DC 11)" }));
  }, "the cauldron (Presence DC 11 → meal / soured)");
  edit("lyrenn_elsin_welcome", b => {
    addBefore(b, /^compliment the stew|^offer to wash|^say goodnight/i, ch("Say grace. Briefly.", "rc_elsin_supper", { checkStat: "presence", checkDC: 11, failNext: "rc_elsin_soured", description: "Zero wasted words. She's counting. (Presence, DC 11)" }));
  }, "grace (Presence DC 11 → supper / soured)");
  edit("khezek_tor_town_walk", b => {
    retarget(b, /^eat what bez/i, "rc_bez_bench");
    addBefore(b, /^meet drax/i, ch("Ask Bez for it without the gray bits", "rc_bez_soured", { description: "Bez does not take requests. Bez has never needed to. Find out why." }));
  }, "bench → meal · the request → soured");
  edit("khezek_tor_drax_welcome", b => {
    retarget(b, /^drink the miner/i, "rc_drax_tar");
    addBefore(b, /^ask about the chalk|^let him work/i, ch("Hop a lift for a look at the Brace", "rc_drax_soured", { description: "Guests stay off the lifts. Both rules are load-bearing. Some of the lifts are not." }));
  }, "tar → meal · the lift → soured");
  edit("fixit_gullywasher_welcome", b => {
    retarget(b, /^drink the amber/i, "rc_gully_amber");
    addBefore(b, /^ask his name|^back to the yard/i, ch("Drink — and keep where you're from to yourself", "rc_gully_soured", { description: "Second one, you tell him where you're from. That's the house rule. You're about to test it." }));
  }, "amber → meal · nowhere → soured");

  // ── offer the brew wherever the coalition is home: the lease card + both Day's End beats ──────────────────────────────
  const BREW = () => ch("Brew Young Gearbox's forgotten coffee", "rc_gearbox_coffee", { requires: [...foundry.utils.deepClone(COFFEE_REQ), { beatMark: "rc_gearbox_coffee", not: true }], description: "The tin in the galley. DON'T OPEN TILL YOU'VE EATEN EVERYWHERE. You have." });
  for (const id of ["reliable_the_lease", "ag_days_end", "days_end_thatwards"]) {
    if (!byId.get(id)) { say(`⚠ ${id} missing here — the brew is not offered from it`); continue; }
    edit(id, b => { b.choices = Array.isArray(b.choices) ? b.choices : []; if (!b.choices.some(c => c.next === "rc_gearbox_coffee")) b.choices.unshift(BREW()); }, "offers the brew (hidden until all seven meals)");
  }

  // ── the tin itself: a gear Item in The Absolutely Reliable's hold ─────────────────────────────────────────────────────
  const rig = game.actors.contents.find(a => a.type === "rig" && /absolutely reliable/i.test(String(a.name || "")));
  if (!rig) say("✗ MISSING rig actor The Absolutely Reliable — the coffee tin was not placed");
  else if (rig.items.some(it => /forgotten coffee/i.test(String(it.name || "")))) say(`· ok item Young Gearbox's Forgotten Coffee (already aboard ${rig.name})`);
  else { changes++; say(`✚ item Young Gearbox's Forgotten Coffee → ${rig.name}'s hold`); actorEdits.push(() => Item.create({
    name: "Young Gearbox's Forgotten Coffee", type: "gear", img: "icons/consumables/drinks/coffee.webp",
    system: { slot: "misc", category: "gear", quantity: 1, source: "The Absolutely Reliable — galley", tags: ["recalcitrant-cafe", "quest"],
      description: { value: "<p>A dented tin, left on the galley shelf the day Young Gearbox dropped you here. Scratched on the lid, in block capitals: <b>DON'T OPEN TILL YOU'VE EATEN EVERYWHERE.</b></p><p>It is heavier than an empty tin. It smells, faintly, through the seam, like something that stopped existing fifty years before the Shattering.</p><p><i>Eat at every table that feeds you without asking what's in it — Pike, Etta, Tamsin, Elsin, Bez, Drax, Gully — then brew it aboard. One pot. Exactly one. The tin leaves with the hovercraft if the lease lapses.</i></p>", chat: "" } },
    flags: { "bbttcc-campaign": { recalcitrantCafe: "coffee-tin" } } }, { parent: rig })); }

  console.group(`[patch-recalcitrant-cafe-2026-10-13] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s)`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`The Recalcitrant Cafe DRY RUN: ${changes} change(s) — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("The Recalcitrant Cafe: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-recalcitrant-cafe-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  for (const fn of actorEdits) await fn();
  ui.notifications.info(`The Recalcitrant Cafe applied: ${changes} change(s). F5.`);
})();
