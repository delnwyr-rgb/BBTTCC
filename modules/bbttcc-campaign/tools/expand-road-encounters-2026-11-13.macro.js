/*
 * expand-road-encounters-2026-11-13.macro.js — the bestiary on the road (Dave 2026-11-13: "Now that we've rebalanced our
 * NPC pack, I'd like to expand our travel encounter tables to be as inclusive of our entire pack of creatures as possible.
 * We can re-use maps that are in play officially elsewhere as battlemaps for this purpose.") + Apex Predator OFF the
 * Tier-1 road tables (it is a Tier-III heavy; the encounter budget rule is "never a tier up").
 *
 * HOW A ROAD FIGHT WORKS (the code this macro feeds):
 *   - bbttcc-travel/scripts/hex-travel.js _resolveTravelTier: a leg's tier = 1 + floor(hexDanger/4) of the destination hex
 *     (setting bbttcc-core.travelTierSource "danger"); while the ALPHA CUT is on every leg rolls the tier-1 tables
 *     (_alphaTierCap; bbttcc-core alphaCut = true on ember, travelHighTier not overridden).
 *   - api.travel.js pickEncounterFromCampaignTables: table travel_<terrain>_t<N> (else travel_generic_t<N>, cascading DOWN),
 *     rows filtered by conditions.terrain, conditions.phaseGte/phaseLte (storyPhase), conditions.scale (menace.js
 *     entryScaleOk: a rig party still draws foot rows — the beat's menace card regulates), the beat's own storyPhase gate,
 *     once/repeatable, one-of-each-per-ride; weightedPick over row.weight (0 = parked).
 *   - bbttcc-encounters/scripts/spawner.interface.js onStageReady: the beat's sceneId is the battlemap; it tops the scene up
 *     to encounter.count hostiles named encounter.actorName and each encounter.also[{actorName,count}] (world actor by
 *     name, else imported once from bbttcc-master-content.npcs). Pre-placed hostile tokens on a reused map would ALSO
 *     fight — so this macro only takes a map that has no hostile/neutral tokens and a grid (checked live, per packet).
 *   - Wins clear the hex menace (worldEffects.hexMenace clear) and pay the bounty (beat.award, bbttcc-campaign module.js
 *     _awardCreature: kill / talkdown; a mortal kill adds 1 Darkness).
 *
 * GROUP SIZES follow the ENCOUNTER budget (systems/fourththing/threat-chassis.js ENCOUNTER): light 1 / medium 2 / heavy 4 /
 * boss 8; an average fight for 4 Stewards = 8 points at the tier anchor (L3 / L8 / L13 / L18), ±1 per level; a foe one tier
 * DOWN counts half; never a tier up. Phase gates keep the party's tier >= the foes' tier: storyPhase 2 ≈ L2, 3 ≈ L4,
 * 4 ≈ L6 (Tier II), 5 ≈ L8 (round-three level log). T3 / T4 rows wait behind T3_PHASE / T4_PHASE (Part Two; Dave to set).
 * Tier-II packets also get a MIRROR row on the tier-1 tables of their terrains (phaseGte 4, row.alphaMirror = true) so
 * they can actually be drawn while the alpha cut pins every leg to tier 1; drop the mirrors when the cut lifts.
 *
 * WHAT IT WRITES (bbttcc-campaign settings, active campaign):
 *   campaigns      + 7 beats per packet (intro, outcomes menu, win/lose/run, parley success/fail) — only ids that don't
 *                    exist yet; an existing id is never overwritten (reported).
 *   encounterTables + one row per packet per table (skipped when the table already rows that beat);
 *                   − rows on *_t1 tables whose beat fields the Apex Predator (enc_apex_predator, enc_mutant_wildlife_t3).
 * DRY RUN by default; globalThis.__expandRoadEncDry = false applies. Before any write a JournalEntry
 * "Road encounter expansion backup 2026-11-13" stores the before-JSON of encounterTables + the list of beat ids added.
 * Idempotent: a second run = 0 changes. Report → globalThis.__expandRoadEncReport.
 * Prose is draft-1 (Mal's voice, short); no VO files.
 */
(async () => {
  const DRY_RUN = globalThis.__expandRoadEncDry !== false;
  const NS = "bbttcc-campaign";
  const PACK = "bbttcc-master-content.npcs";
  const BACKUP_NAME = "Road encounter expansion backup 2026-11-13";
  const SRC_TAG = "road_bestiary_2026_11_13";

  // <plan> — pure (no Foundry globals below this line until </plan>)
  const T1_PHASE = 2;     // Act 2 = first act with road fights (Bandit Ambush gate); party ≈ L2–L4
  const T2_PHASE = 4;     // Act 4 = L6, the party's first Tier-II act
  const T3_PHASE = 7;     // ⚠ Part Two (party L11+) — Dave to confirm; dormant until then
  const T4_PHASE = 10;    // ⚠ late Part Two (party L16+) — Dave to confirm
  const PHASE = { 1: T1_PHASE, 2: T2_PHASE, 3: T3_PHASE, 4: T4_PHASE };
  const DC = { 1: 12, 2: 15, 3: 18, 4: 21 };
  const POINTS = { light: 1, medium: 2, heavy: 4, boss: 8 };

  // Battlemaps already in play (scene id → what uses it today). Pools are tried in order; the live check takes the first
  // that exists, has a grid and carries no hostile/neutral tokens. W is the safe fallback (three road beasts share it).
  const SC = {
    W:  "lv9ajFvwF8JW4GcR",   // Mutant Wildlife T2 / Scavenger Beast / Ash Wolves — open wild ground, spawned foes
    A:  "YqMTNoh16gMukXza",   // Mutant Wildlife T3 (Apex Predator spawned by name)
    H:  "kVBYeEgVGDxJvifz",   // The Hexknight — the road and its toll
    EW: "3uuTDbAt9NgbqK6S",   // The East Wall — The Thing in the Plate (Allesh-Gilliam)
    KG: "ewhnzejDEXX69yOl",   // Khezek-Tor — The Gallery Is Not Empty
    KS: "ZnsoInY3R0nbn5q7",   // Khezek-Tor — What Leans in the Shaft
    KC: "lN3LeoaB9TMPtSZV",   // Khezek Tor — The Camp on the Switchbacks
    TC: "cbnZz1ZmjGwwWT0O",   // The Tree's Session — The Channel Draws Something (Obstructor Demon)
    AB: "XMjNBsIkp6mE6WJf",   // Acid Bog
    BB: "ax1cH7rdF2Vx8NyS",   // Broken Bridge
    RS: "qNfQvnPC9aRn0DWf",   // Rockslide
    RP: "XRHhy6KwISJ0ISwl",   // Minor Radiation Pocket
    QW: "rF5hHHGYPbN3ftSl",   // Qlipothic Whorl
    WF: "hQmEae6I7qZNzW9j",   // Weather Front
    SE: "LNNyMh3epyiw7BU9",   // Spark Echo
    BF: "AuzTN1PihzE8Qivb",   // The Burnt Flats
    SM: "mNEAW05GWh9COWBo",   // The Singing Mire
    PG: "oL2C02h8Abt5SAbg",   // The Polygonal Grove
    MV: "hgqpw8869Q6OZVKQ",   // The Maneuver Vault — Approach
    RT: "0wj866uxY5FqTGH1",   // The Watcher Notices — Reality Tear
    // token-free copies of W / A made 2026-11-13 for road fights only (story maps carry pre-placed foes)
    OG: "Z88r9caMfWkHKYYb",   // Road Battle — Open Ground (copy of W)
    BG: "wUfuDJd1Tc3HhDuY"    // Road Battle — Broken Ground (copy of A)
  };

  // The bestiary (pack ids from the 11-12 post-fix dump). tier / bracket mirror flags.fourththing.rfi.actor.
  const M = {
    "Ash Wolf": ["GZeM7IAl471weU8b", 1, "light"], "Burn-Zone Alpha": ["mKtVF9qB8ouHtYyf", 1, "heavy"],
    "Reed-Skin Stalker": ["IHzUhG1mabHnm6pL", 1, "light"], "Bog-Skitter Swarm": ["juFbGL3HEuoWcuHV", 1, "light"],
    "Hex-Touched Stray": ["tXgo1gl88cgf1hcc", 1, "light"], "Dust Scavenger": ["oJw1L631OqPbIgAK", 1, "light"],
    "Septless Wanderer": ["WvR3YPMYK9dd1lEH", 1, "light"], "Jackalope Tinker-Scout": ["tYObKsKdkK5JHB0i", 1, "light"],
    "Yesodium Tick-Hound": ["DCFDuwrSVxC3xIDZ", 1, "medium"], "Salt Wraith": ["RQeXqKj5Q5fNLeRw", 1, "light"],
    "Pre-Fall Drone": ["jo8jbDD5O01VQcxG", 1, "light"], "Thaumielite Despot": ["QT2xnNzPOYRA0Wz4", 1, "medium"],
    "Nahemoth Husk": ["BvNe8KEqyzjNxiFc", 1, "light"], "Ghagielite Blinder": ["X6OcEP6YbKkYNdiw", 1, "light"],
    "Satariel Veil-Spinner": ["zVWpSrwZCA3TL5Dp", 1, "medium"],
    "Razor Raider": ["a3iLY82GvIfBScr2", 2, "medium"], "Raider Marauder": ["8m5eJTobhX6riEEN", 2, "medium"],
    "Battle-Bassinet Berserker": ["0qEJRPazunAo51Fl", 2, "heavy"], "Valhaulan Spark Adept": ["ZOttfT1AftTApkwf", 2, "medium"],
    "Hex-Iron Berserker": ["sJdEi1VglScR4Urz", 2, "medium"], "Vow-Bound Thrall": ["VpkA2FQ0ElY0bzDE", 2, "light"],
    "Sept Acolyte": ["2lynvMMqn0imas2k", 2, "light"], "Bone Patriarch": ["tZv6AIxvw4v6dB5L", 2, "medium"],
    "Witness Initiate": ["OhNxMsImWa4bBZYA", 2, "light"], "Crossing Guard (Lapsed Protocol)": ["57JfvyC87YsRERDe", 2, "heavy"],
    "Pre-Fall Sentinel": ["gIHcgJ2aS9L6y3yf", 2, "medium"], "Cinder-Hawk Mother": ["8l45F9lX2Cuzqk7B", 2, "medium"],
    "Crystal Lurker": ["7APmN7sGfyALCeCc", 2, "light"], "Marsh-Tongue Hex": ["u6JS59QSJHwoev1d", 2, "medium"],
    "S'narchy Burger Mascot (Reanimated)": ["NZwUSJxiR3jQWWP5", 2, "medium"], "CACA": ["a9orjOV99MnMObho", 2, "medium"],
    "Golachab Flayer": ["QphIxEIKKyq8HLgf", 2, "medium"], "Harab Serapel Scavenger": ["SmVDBIAjrDFTRjxt", 2, "medium"],
    "Thagirion Disputant": ["VWK3Fg8ozMPRipmD", 2, "medium"], "Gamchicoth Reveller": ["jLzxG6ZynTW6UNZU", 2, "light"],
    "Samaelite Poisoner": ["sfNdTpowMundsPbC", 2, "heavy"],
    "Witness-Warden Lieutenant": ["5MA3L8ebRzPLhaBP", 3, "medium"], "Yesodium Cultist Adept": ["VWAetNyf6j4OO6gE", 3, "medium"],
    "Hex-Touched Champion": ["DzXn1wcsC7OWwvE4", 3, "medium"], "Soma-Reaper": ["lAn4USFvKWoAVVwy", 3, "medium"],
    "Gamalielite Dream-Twister": ["usU6xHOysv7adf8j", 3, "light"], "Whispering Deceiver": ["hIOAU3bYR4KkdPhw", 3, "medium"],
    "Please-Stop-Hitting-Yourself (Qliphothic Loop)": ["ipexaGZlhurZKpc3", 3, "light"], "The Gilded Tyrant": ["m1Wzc1wbRFO7kl7j", 3, "heavy"],
    "War Incarnate": ["uyiTmCco8gDsuHde", 3, "heavy"], "Obstructor Demon": ["vYVjgcHYwwYRM6J1", 3, "heavy"],
    "Pre-Fall Battlemind": ["nAl4cJIYsqzvJtOd", 3, "heavy"], "Compliance Engine PRIME": ["qDuH7PdGNGGqeChb", 3, "boss"],
    "Choir Fragment": ["qc6eArPx9K7r7eCX", 4, "light"], "Hex-Warlord's Honored Guard": ["mUM4tXeqeUagkLRJ", 4, "heavy"],
    "Pre-Fall Apex Construct": ["bY5b3zOkFr7RbcNU", 4, "heavy"], "Golachab Immolator": ["kpkoeR7Tedyvqs4c", 4, "medium"],
    "Inferno of Cruelty": ["vpPWkftzLsEwoY9k", 4, "heavy"], "Abomination of Excess": ["P8e2EX1lbLBFk2gL", 4, "heavy"],
    "Witness Apotheon": ["le5vxgOyNRqbVnbo", 4, "heavy"], "Avatar of the Veil": ["PqhdO2hojxFosDX0", 4, "heavy"]
  };

  // Packets: key, tier (= the packet's foe tier → table tier + phase gate), foes [[name, count], …] (first = the beat's
  // actorName + bounty creature), terrains, scene pool, talk door {stat, label, desc, ok}, fight label, prose.
  const P = (o) => ({ ...o, scenes: [...(o.scenes ?? []), ...["OG", "BG"].filter(k => !(o.scenes ?? []).includes(k))] });   // clean road copies as the last fallback
  const PACKETS = [
    // ── TIER I (tier-1 tables, Act 2+) ──────────────────────────────────────────────────────────────────────────────
    P({ key: "ash_pack", tier: 1, label: "Ash Wolf Pack", foes: [["Ash Wolf", 6]], terrains: ["ashwastes", "plains", "canyons"], scenes: ["BF", "RP", "W"],
      intro: "Smoke on the ridge, low and moving against the wind. Then the smoke has legs. Six of them have decided you are the most interesting thing in the burn-zone, and they are not wrong.",
      talk: { stat: "empathy", label: "Stand still and let the pack decide", desc: "Ash wolves test before they commit. Don't run, don't reach, and let them smell that you are more trouble than meat. (Roster member rolls Empathy.)", ok: "The lead wolf's coat stops smoking. One by one they peel off toward something easier. You are, officially, not dinner." },
      fight: "Back to back — make them pay for every bite" }),
    P({ key: "alpha_pack", tier: 1, label: "The Alpha's Pack", foes: [["Burn-Zone Alpha", 1], ["Ash Wolf", 5]], terrains: ["ashwastes", "forest"], scenes: ["BF", "W"],
      intro: "She is twice the size of the others and scarred down one flank, and she doesn't circle. She just stands in the road and lets her pack fan out behind you. This is her road. You are on it.",
      talk: { stat: "empathy", label: "Give her the road", desc: "An old alpha has nothing to prove. Step aside, eyes down, and let her see you are passing through her ground, not taking it. (Roster member rolls Empathy.)", ok: "She watches you go the long way round, every step of it. Then she yawns. Somewhere, a pack is very disappointed." },
      fight: "Take the alpha and the pack breaks" }),
    P({ key: "reed_skin", tier: 1, label: "Still Water", foes: [["Reed-Skin Stalker", 4], ["Bog-Skitter Swarm", 2]], terrains: ["swamp", "river"], scenes: ["SM", "AB", "BB", "W"],
      intro: "The water is too still. Nothing in this marsh is ever still, and yet here we are: a flat black mirror, a reed bank that is a little too tidy, and the hum of something swarming just under the surface.",
      talk: { stat: "empathy", label: "Back away from the water's edge", desc: "Ambush hunters only commit when you are in reach. Give the bank a wide, slow berth and don't splash. (Roster member rolls Empathy.)", ok: "The reeds settle. The mirror stays a mirror. You take the long, dry way and nobody gets pulled under." },
      fight: "Stir the water and fight on your feet" }),
    P({ key: "bog_skitter", tier: 1, label: "Bog-Skitter Boil", foes: [["Bog-Skitter Swarm", 4]], terrains: ["swamp"], scenes: ["AB", "SM", "W"],
      intro: "Somebody stepped on the wrong tussock. The mire belches, and then it boils: a few thousand venomous somethings, very upset about the roof coming in.",
      talk: { stat: "sur", label: "Smoke them down", desc: "Swarms hate smoke more than they hate you. Wet tinder, slow movements, and a very patient retreat. (Roster member rolls Lore.)", ok: "The swarm sulks back into the mud. Everybody counts their ankles. Everybody still has two." },
      fight: "Swat, stomp, and burn" }),
    P({ key: "hex_strays", tier: 1, label: "Hex-Touched Strays", foes: [["Hex-Touched Stray", 5]], terrains: ["plains", "forest", "canyons", "mountains"], scenes: ["W", "A"],
      intro: "Dogs, mostly. The hex-script got into them the way water gets into a basement — slow, everywhere, permanent. Their eyes are the wrong colour and they are very, very hungry.",
      talk: { stat: "empathy", label: "Throw them the jerky and walk", desc: "They were somebody's dogs once. Food on the ground, nobody running, nobody shouting. (Roster member rolls Empathy.)", ok: "They fall on the jerky like it owes them money. You are a quarter mile down the road before they look up." },
      fight: "Put them down kindly and quickly" }),
    P({ key: "dust_scavengers", tier: 1, label: "Dust Scavengers", foes: [["Dust Scavenger", 4], ["Septless Wanderer", 2]], terrains: ["ashwastes", "plains", "canyons"], scenes: ["RP", "H", "W"],
      intro: "Scrap-clad, rusty-knifed, and grinning like they've already counted your rations. Two of them are mumbling prayers to nobody. The prayers are not helping their aim.",
      talk: { stat: "intimidation", label: "Make them do the arithmetic", desc: "Scavengers hunt the weak. Show them how expensive you would be. (Roster member rolls Intimidation.)", ok: "They do the math out loud, argue about it, and decide the next caravan looks juicier. Good maths." },
      fight: "Teach them the lesson the hard way" }),
    P({ key: "jackalope_toll", tier: 1, label: "The Jackalope Toll", foes: [["Jackalope Tinker-Scout", 3], ["Dust Scavenger", 2]], terrains: ["plains", "river", "forest"], scenes: ["H", "BB", "W"],
      intro: "A jackalope with optics wired into its antlers sells you a map of the road ahead. It is a very good map. It is so good that the people waiting at the next bend are on it.",
      talk: { stat: "per", label: "Buy the route back — at a discount", desc: "Tinker-scouts are entrepreneurs first and ambushers second. Make the better offer. (Roster member rolls Diplomacy.)", ok: "Deal. The jackalope sells the ambushers YOUR fake route instead and tips its antlers. Somebody is going to have a confusing afternoon, and it isn't you." },
      fight: "No deal — spring the ambush first" }),
    P({ key: "tick_hounds", tier: 1, label: "Good Boys, Mostly", foes: [["Yesodium Tick-Hound", 3]], terrains: ["mountains", "canyons"], scenes: ["KS", "KG", "RS", "W"],
      intro: "Three mine-dogs come trotting down the scree, glowing faintly, tails going. They shed something that makes your skin itch at a genetic level. They would like to play. Their idea of play has teeth.",
      talk: { stat: "empathy", label: "Who's a good boy?", desc: "They were bred to like miners. Kneel, hold out a hand, and keep it steady while the Geiger clicks. (Roster member rolls Empathy.)", ok: "Belly rubs all round. Everybody washes their hands twice. The dogs escort you to the next ridge and go home, glowing." },
      fight: "Not good boys — weapons up" }),
    P({ key: "salt_wraiths", tier: 1, label: "Salt Wraiths", foes: [["Salt Wraith", 5]], terrains: ["ashwastes", "plains", "canyons"], scenes: ["WF", "RP", "W"],
      intro: "An old battlefield, crusted white. The salt stands up in the shapes of the people who died here, and the air goes cold enough to fog your breath. They don't want anything. They just remember wanting.",
      talk: { stat: "soul", label: "Name the dead and let them rest", desc: "Grief that crystallised can be spoken to. Say something true over the field and mean it. (Roster member rolls Soul.)", ok: "One by one the shapes slump back into the crust. The cold goes with them. Somebody says a name nobody here knew, and it seems to help." },
      fight: "Shatter them before the cold gets in" }),
    P({ key: "drones", tier: 1, label: "Broken Protocol", foes: [["Pre-Fall Drone", 6]], terrains: ["plains", "canyons", "mountains"], scenes: ["MV", "H", "W"],
      intro: "A line of little pre-Fall servitors trundles out of the ruins and forms a perimeter around you, chirping the same error code in unison. You are, apparently, an unauthorised delivery.",
      talk: { stat: "mind", label: "Find the override", desc: "Every loop has a reset. Read the panel, guess the old code, and say it in a confident voice. (Roster member rolls Mind.)", ok: "The drones chirp ACKNOWLEDGED, file you as a parcel, and wave you through with tiny flags. Paperwork: the oldest magic." },
      fight: "Scrap them for parts" }),
    P({ key: "despot_court", tier: 1, label: "The Despot's Court", foes: [["Thaumielite Despot", 1], ["Nahemoth Husk", 5]], terrains: ["plains", "canyons", "ashwastes"], scenes: ["QW", "W"],
      intro: "In the ruin of a strip mall a two-faced thing holds court over a shuffling crowd of husks. One face whispers about its own greatness. The other face has just noticed you, and it is issuing decrees.",
      talk: { stat: "insight", label: "Agree with both faces at once", desc: "A tyrant of contradictions can be talked into knots. Find the order it can't give without countermanding itself. (Roster member rolls Insight.)", ok: "Both faces start arguing about you, then about each other. The husks wait for a ruling that never comes. You leave while the court is in session." },
      fight: "Depose it" }),
    P({ key: "blinders", tier: 1, label: "A Thought, Interrupted", foes: [["Ghagielite Blinder", 6]], terrains: ["forest", "plains", "mountains", "river"], scenes: ["SE", "W"],
      intro: "You were in the middle of planning the next leg when the air filled with fluttering, impossible wings. Now nobody can remember what the plan was. The wings are very pretty. Don't look at the wings.",
      talk: { stat: "meditation", label: "Empty your heads", desc: "Blinders feed on complex thought. Think about nothing. Breathe. Be extremely boring. (Roster member rolls Meditation.)", ok: "Starved of ideas, the swarm drifts off toward a more interesting party. Everybody's plan comes back, slightly worse." },
      fight: "Swat the thoughts out of the air" }),
    P({ key: "veil_spinners", tier: 1, label: "The Oasis That Isn't", foes: [["Satariel Veil-Spinner", 3]], terrains: ["canyons", "ashwastes", "mountains"], scenes: ["RS", "A", "W"],
      intro: "There's water up ahead. Shade, palms, a well with a bucket. It is exactly what you wanted, which is the first problem. The second problem has too many legs and too many white eyes.",
      talk: { stat: "insight", label: "Refuse the oasis out loud", desc: "A Veil-Spinner feeds on the moment you realise. Realise it first, on purpose, and deny it the meal. (Roster member rolls Insight.)", ok: "The oasis flickers and folds up like a cheap set. Three disappointed shadows skitter back into the rocks. You drink from your own canteens, smugly." },
      fight: "Cut through the web" }),

    // ── TIER II (tier-2 tables + generic_t2, Act 4+; mirrored onto tier-1 tables while the alpha cut holds) ────────────
    P({ key: "raider_warband", tier: 2, label: "Raider Warband", foes: [["Raider Marauder", 3], ["Razor Raider", 2]], terrains: ["plains", "canyons", "ashwastes", "mountains"], scenes: ["KC", "H", "W"],
      intro: "A real warband this time — not cousins with pipe rifles, but a line that holds and two shock troopers revving chainblades at the front. Somebody up there has a grenade and is very excited about it.",
      talk: { stat: "intimidation", label: "Show them what you've already beaten", desc: "Warbands respect a reputation. Make sure they've heard of you, and that they believe it. (Roster member rolls Intimidation.)", ok: "The line wavers, the grenade goes back in its pouch, and the warband finds an urgent appointment elsewhere." },
      fight: "Break the line" }),
    P({ key: "valhaulan_raid", tier: 2, label: "Valhaulan Raiding Party", foes: [["Battle-Bassinet Berserker", 1], ["Valhaulan Spark Adept", 2]], terrains: ["mountains", "plains", "river"], scenes: ["KC", "H", "W"],
      intro: "First the lullaby — at full volume, from an armoured cradle-rig stomping down the road. Then the thunder, from two hymn-speakers with storm-wired hammers. Valhaulans. They will apologise afterwards. Sincerely.",
      talk: { stat: "intimidation", label: "Challenge them to a proper boast-off", desc: "Valhaulans love a duel of words as much as a duel of hammers. Out-boast them. (Roster member rolls Intimidation.)", ok: "The Berserker laughs so hard the cradle rocks. They declare you honoured foes, rob you of nothing, and sell you a souvenir." },
      fight: "Meet the storm head on" }),
    P({ key: "hex_iron_cell", tier: 2, label: "Hex-Iron Cell", foes: [["Hex-Iron Berserker", 2], ["Vow-Bound Thrall", 4]], terrains: ["forest", "swamp", "canyons"], scenes: ["PG", "W"],
      intro: "Two cultists with hex-iron singing through their skin, and four soldiers behind them with vow-bones in their necks. The cultists don't feel pain properly. The thralls aren't allowed to stop.",
      talk: { stat: "intimidation", label: "Order the thralls to stand down", desc: "A vow-bone answers to authority. Sound like the authority. (Roster member rolls Intimidation.)", ok: "The thralls freeze mid-step. Without them the berserkers sing to an empty clearing, lose interest, and wander off still humming." },
      fight: "Cut the cell apart" }),
    P({ key: "sept_rite", tier: 2, label: "A Sept Rite on the Road", foes: [["Sept Acolyte", 4], ["Bone Patriarch", 1]], terrains: ["forest", "river", "plains"], scenes: ["PG", "SE", "W"],
      intro: "A procession in the road: four acolytes chanting small blessings, and an old man jangling a string of finger-bones, every one an ancestor with an opinion. The ancestors have decided you are the sacrifice.",
      talk: { stat: "ritual", label: "Join the rite — correctly", desc: "Every rite has a place for a stranger. Find it, and fill it better than they expected. (Roster member rolls Ritual.)", ok: "The Patriarch listens to his bones, frowns, and grudgingly blesses your road instead. The acolytes are thrilled. The ancestors are outvoted." },
      fight: "Break the circle" }),
    P({ key: "witness_patrol", tier: 2, label: "Witness Patrol", foes: [["Witness Initiate", 5]], terrains: ["plains", "river", "forest"], scenes: ["H", "W"],
      intro: "Five junior eyes of the Witness order have been following you for a day, taking notes. They have decided they have enough notes. Now they would like to make sure nobody else reads them.",
      talk: { stat: "stealth", label: "Give them nothing to see", desc: "Witnesses hunt what they can record. Vanish into the scrub and let them report an empty road. (Roster member rolls Stealth.)", ok: "The patrol argues over whether you were ever there at all, files a report saying 'inconclusive', and goes home." },
      fight: "Take the notebooks" }),
    P({ key: "crossing_guard", tier: 2, label: "Lapsed Protocol", foes: [["Crossing Guard (Lapsed Protocol)", 1], ["Pre-Fall Sentinel", 2]], terrains: ["plains", "canyons"], scenes: ["H", "MV", "W"],
      intro: "A crossing guard in a stop-sign exo-frame steps into the road with its paddle up, two sentinels flanking it. It is enforcing a traffic ordinance for an intersection that hasn't existed in two hundred years. It would like to see your papers.",
      talk: { stat: "mind", label: "Produce some papers", desc: "It needs a document. Any document. Make it look municipal. (Roster member rolls Mind.)", ok: "The guard scans your laundry list, beeps approvingly and waves you across. The sentinels salute. Civic order is restored." },
      fight: "Jaywalk, aggressively" }),
    P({ key: "sentinel_post", tier: 2, label: "Sentinel Post", foes: [["Pre-Fall Sentinel", 2], ["Pre-Fall Drone", 4]], terrains: ["mountains", "canyons", "plains"], scenes: ["MV", "RS", "W"],
      intro: "A pre-Fall installation still has a perimeter, and you have just walked into it. Two sentinels unfold from the rocks; their drones swarm out to box you in. Nobody told them the world ended.",
      talk: { stat: "mind", label: "Claim to be the relief shift", desc: "Sentinels wait for the shift change that never came. Be it. (Roster member rolls Mind.)", ok: "SHIFT CHANGE ACKNOWLEDGED. The sentinels power down to sleep for the first time in centuries. You feel oddly responsible for them now." },
      fight: "Breach the perimeter" }),
    P({ key: "cinder_hawks", tier: 2, label: "Cinder-Hawk Nesting Ground", foes: [["Cinder-Hawk Mother", 3]], terrains: ["mountains", "canyons", "ashwastes"], scenes: ["RS", "A", "W"],
      intro: "The cliff above is ringed with nests, and three very large, very angry mothers have noticed you walking underneath them. They are smaller than the legends. They are meaner than you'd hoped.",
      talk: { stat: "empathy", label: "Show you're no threat to the nests", desc: "Mothers defend, they don't hunt. Keep low, keep moving, keep your hands away from the cliff. (Roster member rolls Empathy.)", ok: "The hawks shadow you to the end of the cliff and peel off, screaming one last opinion. Fair enough." },
      fight: "Fight them out of the sky" }),
    P({ key: "crystal_lurkers", tier: 2, label: "Crystal Lurkers", foes: [["Crystal Lurker", 6]], terrains: ["mountains", "canyons"], scenes: ["KG", "KS", "W"],
      intro: "The cave mouth glitters. So does the shadow just inside it. And the one next to it. Six hex-touched shapes in slow-growing crystal armour wait for you to come into reach.",
      talk: { stat: "perception", label: "Spot them first and call each one out", desc: "Lurkers only strike from hiding. Point at every one of them, loudly. (Roster member rolls Perception.)", ok: "Spotted, named and embarrassed, the lurkers retreat deeper into the dark. You find another way round." },
      fight: "Smash the crystal" }),
    P({ key: "marsh_tongue", tier: 2, label: "The Marsh Sings Back", foes: [["Marsh-Tongue Hex", 2], ["Reed-Skin Stalker", 4]], terrains: ["swamp", "river"], scenes: ["SM", "AB", "W"],
      intro: "Two voices rise out of the mire, singing in tongues no human throat should manage. The reeds sway in time. So do the stalkers in the reeds.",
      talk: { stat: "occult", label: "Sing the counter-verse", desc: "Every eldritch song has a reply. Find the words that close the verse. (Roster member rolls Occult.)", ok: "Your answer lands off-key but correct. The song ends. The marsh goes quiet and very, very wet." },
      fight: "Silence the singers" }),
    P({ key: "mascot", tier: 2, label: "Proudly Overcooked", foes: [["S'narchy Burger Mascot (Reanimated)", 3]], terrains: ["plains"], scenes: ["EW", "H", "W"],
      intro: "Three cracked fast-food mascots have climbed down off their signs, grins frozen mid-sarcasm, speech bubbles flickering PROUDLY OVERCOOKED SINCE THE SHATTERING. Beware the magic of cinema.",
      talk: { stat: "performance", label: "Place an order", desc: "They were built to take orders. Give them one, in the right voice, with a smile. (Roster member rolls Performance.)", ok: "The mascots turn as one, chant YOUR ORDER WILL BE READY SHORTLY and march off to a kitchen that hasn't existed in two centuries." },
      fight: "Send it back to the kitchen" }),
    P({ key: "caca", tier: 2, label: "Charismatic, Aggressive Cover Art", foes: [["CACA", 3]], terrains: ["forest", "river", "plains"], scenes: ["SE", "PG", "W"],
      intro: "Colour, with intent. Three walking explosions of saturated joy come tumbling over the hill and the air turns to glitter. Everyone suddenly remembers being eight. It is overwhelming and absolutely not safe.",
      talk: { stat: "soul", label: "Feel it and let it pass", desc: "Joy wants witnesses, not opponents. Let it wash over you without grabbing at it. (Roster member rolls Soul.)", ok: "The colour flows round you and away, leaving everyone slightly sticky and weirdly happy. Nobody mentions it for the rest of the day." },
      fight: "Fight the joy" }),
    P({ key: "flayers", tier: 2, label: "Flayers at the Old Pit", foes: [["Golachab Flayer", 3]], terrains: ["ashwastes", "canyons"], scenes: ["BF", "QW", "W"],
      intro: "There was an atrocity here, long ago, and the Flayers still patrol it, whips of solid flame trailing in the ash. They glow from inside. They'd like you angry; they feed better that way.",
      talk: { stat: "meditation", label: "Refuse to get angry", desc: "Golachab feeds on wrath. Don't give it any. Breathe, and keep walking. (Roster member rolls Meditation.)", ok: "Nothing to burn. The Flayers lose interest and drift back to their pit, muttering about the youth of today." },
      fight: "Put out the fire" }),
    P({ key: "harab_scavengers", tier: 2, label: "Ember-Ravens", foes: [["Harab Serapel Scavenger", 3]], terrains: ["plains", "ashwastes", "mountains"], scenes: ["A", "W"],
      intro: "Three ravens the size of lions land on the wreck ahead, embers still clinging to their feathers. They don't attack. They just show you things — piles of gold, a full larder, everything you've ever wanted — and wait for you to walk into the beak.",
      talk: { stat: "mind", label: "Look away from the visions", desc: "Avarice on the wing only works if you want something. Want nothing, loudly. (Roster member rolls Mind.)", ok: "The visions gutter out. The ravens shriek, insulted, and lift off toward a greedier caravan." },
      fight: "Ground them" }),
    P({ key: "disputants", tier: 2, label: "An Argument Walks In", foes: [["Thagirion Disputant", 2], ["Gamchicoth Reveller", 3]], terrains: ["plains", "river"], scenes: ["QW", "W"],
      intro: "Two tall, patchwork things with nothing but mouths start an argument with you the moment you crest the rise. Behind them, three capering revellers are offering everyone a drink. Nobody drink.",
      talk: { stat: "insight", label: "Agree with everything", desc: "Disputants starve without a fight. Concede every point, cheerfully, and decline the cup. (Roster member rolls Insight.)", ok: "With nobody to disagree with, the Disputants turn on each other. The revellers take their side of the argument. You leave them to it." },
      fight: "Shut them up" }),
    P({ key: "samaelite", tier: 2, label: "The Silver Tongue", foes: [["Samaelite Poisoner", 1], ["Gamchicoth Reveller", 2]], terrains: ["swamp", "forest", "river"], scenes: ["SM", "PG", "W"],
      intro: "A beautiful serpentine creature coils across the road and tells you how wonderful you are. All of it is true. That is how you know it's poisoned. Two revellers dance attendance, cups brimming.",
      talk: { stat: "insight", label: "Hear the flattery for what it is", desc: "The poison is in believing it. Name the hook and refuse it. (Roster member rolls Insight.)", ok: "The Poisoner sighs, compliments your discernment — sincerely, for once — and slides off into the reeds with her entourage." },
      fight: "Strike before the next compliment" }),

    // ── TIER III (tier-3 tables + generic_t3, T3_PHASE+) ──────────────────────────────────────────────────────────────
    P({ key: "witness_cell", tier: 3, label: "A Witness Cell", foes: [["Witness-Warden Lieutenant", 2], ["Witness Initiate", 4]], terrains: ["plains", "river", "forest"], scenes: ["H", "W"],
      intro: "The initiates were only the eyes. These two are the hands: Witness-Warden lieutenants, who decide what the order does about what it has seen. It has seen you.",
      talk: { stat: "stealth", label: "Become a rumour", desc: "A Witness can only act on a record. Leave none. (Roster member rolls Stealth.)", ok: "The cell loses you between one note and the next and spends the evening arguing about whose fault it was." },
      fight: "Take the cell apart" }),
    P({ key: "yesodium_cult", tier: 3, label: "The Yesodium Channel", foes: [["Yesodium Cultist Adept", 3], ["Hex-Iron Berserker", 2]], terrains: ["mountains", "canyons"], scenes: ["KG", "KS", "W"],
      intro: "Three adepts on the ridge are humming the Yesodium channel, and every note opens a wound in them and a crack in the air. Their hex-iron muscle stands ready to keep you from interrupting.",
      talk: { stat: "ritual", label: "Break the hum from inside", desc: "A channel is a song with one wrong note in it. Sing that note. (Roster member rolls Ritual.)", ok: "The channel collapses mid-chord. The adepts fall to their knees, bleeding and relieved. Their muscle carries them home." },
      fight: "Interrupt them the hard way" }),
    P({ key: "hex_champions", tier: 3, label: "Champions Who Lost Slowly", foes: [["Hex-Touched Champion", 3]], terrains: ["forest", "swamp", "plains"], scenes: ["PG", "W"],
      intro: "Three would-be heroes who took a hex-pact to win, and have been losing ever since, in slow motion. They challenge you formally. Their armour is mostly pact now.",
      talk: { stat: "per", label: "Remind them what they swore it for", desc: "The pact took the win, not the reason. Find the reason. (Roster member rolls Diplomacy.)", ok: "One of them laughs, and it sounds like a person. They lower their blades and let you pass, and stand a little straighter after." },
      fight: "Grant them the fight they asked for" }),
    P({ key: "dream_fiends", tier: 3, label: "The Sleepers' Road", foes: [["Soma-Reaper", 2], ["Gamalielite Dream-Twister", 3]], terrains: ["forest", "swamp", "river"], scenes: ["RT", "PG", "W"],
      intro: "Everyone is very tired all of a sudden. The edges of things go soft. Two half-real reapers drift in to harvest whatever you dream, and three smoke-shapes start wearing your faces.",
      talk: { stat: "meditation", label: "Stay awake together", desc: "Dream-fiends only take the sleeping. Keep each other talking, counting, breathing. (Roster member rolls Meditation.)", ok: "Nobody nods off. The fiends thin to smoke and are gone with the next breeze, hungry." },
      fight: "Wake up swinging" }),
    P({ key: "deceivers", tier: 3, label: "The Secret That Grew a Mind", foes: [["Whispering Deceiver", 2], ["Please-Stop-Hitting-Yourself (Qliphothic Loop)", 2]], terrains: ["plains", "canyons", "ashwastes"], scenes: ["QW", "RT", "W"],
      intro: "The ruin hums with spectral faces, each one whispering something you did and never told anyone. Two loops of broken Qliphoth wait beside them, ready to hand back whatever you throw.",
      talk: { stat: "insight", label: "Say the secret out loud first", desc: "A Deceiver's power is the repression. Confess, and it has nothing left to feed on. (Roster member rolls Insight.)", ok: "Somebody says it out loud. It's awful, briefly. Then the faces fade, and the loops have nothing to return." },
      fight: "Fight what you can't unhear" }),
    P({ key: "gilded_tyrant", tier: 3, label: "The Gilded Tyrant", foes: [["The Gilded Tyrant", 1], ["Nahemoth Husk", 6]], terrains: ["ashwastes", "plains", "canyons"], scenes: ["QW", "W"],
      intro: "Twelve feet of dripping gold and screaming faces lurches out of what used to be a bank, its husks shuffling ahead of it like customers in a queue that never moves.",
      talk: { stat: "mind", label: "Offer it nothing at all", desc: "Nahemoth wants to own. Show it empty hands and empty pockets. (Roster member rolls Mind.)", ok: "Nothing to take. The Tyrant loses interest mid-lurch and goes back to counting itself." },
      fight: "Melt it down" }),
    P({ key: "war_incarnate", tier: 3, label: "War Incarnate", foes: [["War Incarnate", 1], ["Razor Raider", 4], ["Raider Marauder", 2]], terrains: ["ashwastes", "plains"], scenes: ["BF", "W"],
      intro: "Fifteen feet of rusted swords and green ghost-light, four arms, and a warband marching behind it that doesn't remember deciding to follow. Not a soldier. The cause.",
      talk: { stat: "intimidation", label: "Refuse the war", desc: "War Incarnate needs someone to fight. Make the raiders doubt the cause. (Roster member rolls Intimidation.)", ok: "One raider lowers a chainblade. Then another. Without an army, the thing falters, and the ghost-light fades to a glow." },
      fight: "Fight the war itself" }),
    P({ key: "obstructors", tier: 3, label: "Anti-Thought", foes: [["Obstructor Demon", 2]], terrains: ["forest", "mountains"], scenes: ["TC", "PG", "W"],
      intro: "Two faceless lead giants plod toward you, drinking the sound out of the air. Ideas die near them. The closer they get, the harder it is to remember why you shouldn't just stand there.",
      talk: { stat: "mind", label: "Think one stubborn thought", desc: "Obstructors drown complex thought. Hold one simple, stubborn idea and walk it home. (Roster member rolls Mind.)", ok: "The giants can't find purchase on something so simple. They plod past you after a library somewhere." },
      fight: "Bring them down before you forget how" }),
    P({ key: "battlemind", tier: 3, label: "The Battlemind's Perimeter", foes: [["Pre-Fall Battlemind", 1], ["Pre-Fall Sentinel", 4]], terrains: ["canyons", "mountains", "plains"], scenes: ["MV", "A", "W"],
      intro: "An ancient battlefield AI wakes up in its frame, counts you, and dispatches four sentinels to flank. It is patient. It has been patient for two hundred years.",
      talk: { stat: "mind", label: "Declare an armistice", desc: "It's still fighting the last war. Tell it that war is over, in its own terms. (Roster member rolls Mind.)", ok: "ARMISTICE ACKNOWLEDGED. The Battlemind recalls its sentinels and powers down into the first peace it has known." },
      fight: "Out-think the machine" }),
    P({ key: "prime", tier: 3, label: "Non-Compliant", foes: [["Compliance Engine PRIME", 1]], terrains: ["plains"], scenes: ["MV", "H", "W"], weight: 1,
      intro: "The master unit of a compliance fleet strides out of the rubble, still running the perimeter of a city that has been dust for two centuries. It does not hate you. It has found you non-compliant.",
      talk: { stat: "mind", label: "File for an exemption", desc: "PRIME follows procedure. Find the procedure that lets you go. (Roster member rolls Mind.)", ok: "EXEMPTION GRANTED. PRIME stamps the air in front of you and returns to its rounds. You are, for now, compliant." },
      fight: "Become non-compliant" }),

    // ── TIER IV (generic_t4, T4_PHASE+) ────────────────────────────────────────────────────────────────────────────────
    P({ key: "choir_fragments", tier: 4, label: "A Verdict in Eight Voices", foes: [["Choir Fragment", 8]], terrains: [], scenes: ["SE", "W"],
      intro: "Eight fragments of the Water Choir, each still holding one note of the correction. Alone, each is a hymn. Together they are a verdict, and you are the one being judged.",
      talk: { stat: "soul", label: "Sing the missing note", desc: "A broken chord wants completing. Give it the note it lost. (Roster member rolls Soul.)", ok: "The chord resolves. The fragments fall silent, one by one, and drift away like rain." },
      fight: "Break the chord" }),
    P({ key: "honored_guard", tier: 4, label: "The Warlord's Honored Guard", foes: [["Hex-Warlord's Honored Guard", 2]], terrains: [], scenes: ["H", "KC", "W"],
      intro: "Two elite bodyguards stand across the road, sworn to a Hex-Warlord who isn't here. They have killed more heroes than they remember, and they would like to forget a few more.",
      talk: { stat: "intimidation", label: "Make them count the cost", desc: "Bodyguards guard. Make it plain you aren't after their Warlord — and that you would win. (Roster member rolls Intimidation.)", ok: "They weigh it, nod once, and step aside. Professionals." },
      fight: "Go through them" }),
    P({ key: "apex_construct", tier: 4, label: "The Last War-Machine", foes: [["Pre-Fall Apex Construct", 1], ["Pre-Fall Battlemind", 2]], terrains: [], scenes: ["MV", "A", "W"],
      intro: "A relic war-machine from before the Fall, somehow still powered, flanked by two battlefield minds that have been waiting for a reason. You are a reason.",
      talk: { stat: "mind", label: "Speak in its old codes", desc: "It still answers to a command chain. Become the chain. (Roster member rolls Mind.)", ok: "STAND DOWN ACCEPTED. The construct kneels, the Battleminds go dark, and the valley is very quiet." },
      fight: "Bring down the machine" }),
    P({ key: "immolation", tier: 4, label: "The Furnace and the Fire", foes: [["Golachab Immolator", 2], ["Inferno of Cruelty", 1]], terrains: [], scenes: ["BF", "QW", "W"],
      intro: "Two furnace-bodied Immolators stalk ahead of a vortex of emerald soulfire that screams as it turns. They want you angry. The fire wants you, full stop.",
      talk: { stat: "meditation", label: "Give it nothing to burn", desc: "Golachab burns wrath. Be calm enough to be fireproof. (Roster member rolls Meditation.)", ok: "No fuel. The Immolators gutter, the Inferno starves to a flicker, and you walk through the warm ash untouched." },
      fight: "Fight fire" }),
    P({ key: "abomination", tier: 4, label: "Excess", foes: [["Abomination of Excess", 2]], terrains: [], scenes: ["QW", "W"],
      intro: "Two heaps of glistening flesh, all mouths and mismatched eyes, roll down the valley swallowing everything in their path. They are what growth looks like with nothing to stop it.",
      talk: { stat: "soul", label: "Be enough", desc: "Excess can't take what is already content. Want nothing more than what you have. (Roster member rolls Soul.)", ok: "The Abominations slide past, finding nothing to grow into, and lumber on toward a richer valley." },
      fight: "Cut it down to size" }),
    P({ key: "apotheon", tier: 4, label: "The One Who Sees Everything", foes: [["Witness Apotheon", 1], ["Witness-Warden Lieutenant", 4]], terrains: [], scenes: ["H", "W"],
      intro: "A Witness who looked too long stands in the road, flanked by four lieutenants. It speaks only when ending things. It has opened its mouth.",
      talk: { stat: "stealth", label: "Be beneath its notice", desc: "It sees everything — so give it nothing worth seeing. (Roster member rolls Stealth.)", ok: "The Apotheon closes its mouth. You were never interesting enough to end." },
      fight: "Close its eyes" }),
    P({ key: "avatar_veil", tier: 4, label: "Where the Veil Walks", foes: [["Avatar of the Veil", 1], ["Choir Fragment", 4]], terrains: [], scenes: ["RT", "SE", "W"],
      intro: "The world rearranges itself around a walking thinning of the Veil. Choir fragments orbit it like moths. The road behind you is no longer where you left it.",
      talk: { stat: "soul", label: "Hold onto what's real", desc: "The Veil only moves what isn't anchored. Anchor each other. (Roster member rolls Soul.)", ok: "The Avatar passes through you like weather. When it's gone the road is back where it belongs, mostly." },
      fight: "Tear through the Veil" })
  ];

  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const beatIdOf = (p) => `enc_road_${p.key}`;
  const tablesFor = (p) => {
    const out = [];
    if (p.tier === 4) { out.push({ tableId: "travel_generic_t4", terrain: null, mirror: false }); return out; }
    for (const t of p.terrains) out.push({ tableId: `travel_${t}_t${p.tier}`, terrain: t, mirror: false });
    if (p.tier >= 2) out.push({ tableId: `travel_generic_t${p.tier}`, terrain: null, mirror: false });
    if (p.tier === 2) for (const t of p.terrains) out.push({ tableId: `travel_${t}_t1`, terrain: t, mirror: true });
    return out;
  };
  const pointsOf = (p) => p.foes.reduce((s, [n, c]) => s + (POINTS[M[n]?.[2]] ?? 2) * c, 0);

  function buildRow(p, tgt, campaignId) {
    const cond = {};
    if (tgt.terrain) cond.terrain = tgt.terrain;
    cond.tier = String(tgt.mirror ? 1 : p.tier);
    cond.phaseGte = PHASE[p.tier];
    cond.scale = "foot";
    const row = { campaignId, beatId: beatIdOf(p), weight: Number(p.weight) || 1, conditions: cond, src: SRC_TAG };
    if (tgt.mirror) row.alphaMirror = true;
    return row;
  }

  // quest_travel_encounters steps run to 960 today; each packet gets its own block of 10 from 1000 (lint Q04: no duplicates)
  const stepBase = (p) => 1000 + PACKETS.indexOf(p) * 10;
  function buildBeats(p, sceneId) {
    const id = beatIdOf(p), [lead, leadN] = p.foes[0], q0 = stepBase(p);
    const also = p.foes.slice(1).map(([n, c]) => ({ actorName: n, count: c }));
    const enc = { key: `road_${p.key}`, tier: p.tier, actorName: lead, count: leadN, ...(also.length ? { also } : {}) };
    const inject = { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" };
    const base = (bid, label, type, description, choices, extra = {}) => ({
      id: bid, label, type, description, tags: `travel ${SRC_TAG}`, encounter: { ...enc, ...(also.length ? { also: also.map(a => ({ ...a })) } : {}) },
      scene: { uuid: "" }, choices, worldEffects: {}, timeScale: "leg", politicalTags: "", inject: { ...inject }, actors: [],
      questId: "quest_travel_encounters", questStep: q0, questRole: null, targetHexUuid: null, turnNumber: null, timePoints: 0,
      sceneId, playerFacing: true, pacing: { ambient: true }, ...extra
    });
    const ch = (label, next, description = "", check = null) => ({ label, next, description, checkStat: check?.stat || "", checkDC: check?.dc || 0, failNext: check?.failNext || "" });
    const noun = p.label;
    return [
      base(id, p.label, "dialog", p.intro, [
        ch(p.talk.label, `${id}_parley_success`, p.talk.desc, { stat: p.talk.stat, dc: DC[p.tier], failNext: `${id}_parley_fail` }),
        ch(p.fight, `${id}_outcomes`, "Fight on the map — the GM calls the result after.")
      ], { menace: { enabled: true, label: noun.toLowerCase(), clock: 3 } }),
      base(`${id}_outcomes`, `${noun} (Outcomes)`, "outcome_trigger", "Steel out, map down. When it's decided, call it:", [
        ch("Win", `${id}_outcomes_win`), ch("Lose", `${id}_outcomes_lose`), ch("Run", `${id}_outcomes_run`)
      ], { questStep: q0 + 3 }),
      base(`${id}_outcomes_win`, `${noun} (Win)`, "outcome_trigger", "The last of them goes down or goes away, and the road is yours again. Somebody checks the packs. Somebody checks themselves.", [],
        { questStep: q0 + 4, worldEffects: { hexMenace: { action: "clear" } }, award: { method: "kill", creature: lead, creatureId: null } }),
      base(`${id}_outcomes_lose`, `${noun} (Lose)`, "outcome_trigger", "You get out, which is the important part. You leave some supplies, some pride and a little skin on the road behind you.", [], { questStep: q0 + 5 }),
      base(`${id}_outcomes_run`, `${noun} (Run)`, "outcome_trigger", "Discretion, valour, et cetera. You leave them the road and take the long way round.", [], { questStep: q0 + 6 }),
      base(`${id}_parley_success`, `${noun} — Talked Down`, "outcome_trigger", p.talk.ok, [ch("Continue", "")],
        { tags: "travel words_door " + SRC_TAG, questStep: q0 + 1, worldEffects: { hexMenace: { action: "clear" } }, award: { method: "talkdown", creature: lead, creatureId: null },
          memoryText: `The party talked down ${noun.toLowerCase()} on the road without a fight.` }),
      base(`${id}_parley_fail`, `${noun} — Wrong Read`, "outcome_trigger", "It doesn't land. Whatever you said, they heard something else, and now nobody is talking.", [ch("So be it", `${id}_outcomes`)],
        { tags: "travel words_door " + SRC_TAG, questStep: q0 + 2 })
    ];
  }

  /** Pure planner. ctx: { campaign, tables, packIndex: Map(id → name) | null, sceneCheck(id) → {ok, why, name} } */
  function plan(ctx) {
    const { campaign, tables } = ctx;
    const out = { beatsAdd: [], beatsExisting: [], rowsAdd: [], rowsExisting: [], rowsRemove: [], skipped: [], scenes: {}, foes: {}, missingTables: [] };
    const beatIds = new Set((campaign.beats || []).map(b => b?.id));
    const beatById = new Map((campaign.beats || []).map(b => [b?.id, b]));

    // 1. Apex Predator off the tier-1 tables (the T3 heavy is never a tier-1 foe).
    const apexBeats = new Set((campaign.beats || []).filter(b => b && (b.id === "enc_apex_predator" || String(b.encounter?.actorName || "").trim() === "Apex Predator")).map(b => b.id));
    for (const [tid, t] of Object.entries(tables)) {
      if (!/_t1$/.test(tid)) continue;
      (t.entries || []).forEach((e, i) => { if (apexBeats.has(e?.beatId)) out.rowsRemove.push({ tableId: tid, index: i, beatId: e.beatId, row: e }); });
    }

    // 2. Packets.
    for (const p of PACKETS) {
      // foes resolve against the pack (id first, then exact name)
      let bad = null;
      for (const [n] of p.foes) {
        const want = M[n];
        if (!want) { bad = `no bestiary row for "${n}"`; break; }
        if (ctx.packIndex) {
          const byId = ctx.packIndex.get(want[0]);
          if (byId === n) { out.foes[n] = { id: want[0], via: "id" }; continue; }
          const hit = [...ctx.packIndex.entries()].find(([, nm]) => nm === n);
          if (hit) { out.foes[n] = { id: hit[0], via: "name", note: `pack id ${hit[0]} ≠ expected ${want[0]}` }; continue; }
          bad = `"${n}" not in ${PACK}`; break;
        } else out.foes[n] = { id: want[0], via: "unverified" };
      }
      if (bad) { out.skipped.push({ key: p.key, why: bad }); continue; }

      const id = beatIdOf(p);
      let sceneId = null;
      if (beatIds.has(id)) sceneId = beatById.get(id)?.sceneId || null;
      else {
        const tried = [];
        for (const k of p.scenes) {
          const sid = SC[k]; const r = ctx.sceneCheck ? ctx.sceneCheck(sid) : { ok: true, why: "unverified" };
          tried.push({ key: k, id: sid, ok: r.ok, why: r.why, name: r.name });
          if (r.ok) { sceneId = sid; break; }
        }
        if (!sceneId) { const r = ctx.sceneCheck ? ctx.sceneCheck(SC.W) : { ok: true }; if (r.ok) { sceneId = SC.W; tried.push({ key: "W", id: SC.W, ok: true, why: "fallback", name: r.name }); } }
        out.scenes[p.key] = { chosen: sceneId, tried };
        if (!sceneId) { out.skipped.push({ key: p.key, why: "no usable battlemap" }); continue; }
      }

      for (const b of buildBeats(p, sceneId)) {
        if (beatIds.has(b.id)) out.beatsExisting.push(b.id); else out.beatsAdd.push(b);
      }
      for (const tgt of tablesFor(p)) {
        const t = tables[tgt.tableId];
        if (!t) { out.missingTables.push({ key: p.key, tableId: tgt.tableId }); continue; }
        if ((t.entries || []).some(e => e?.beatId === id)) { out.rowsExisting.push({ tableId: tgt.tableId, beatId: id }); continue; }
        out.rowsAdd.push({ tableId: tgt.tableId, row: buildRow(p, tgt, campaign.id), points: pointsOf(p), tier: p.tier, mirror: tgt.mirror });
      }
    }
    return out;
  }

  /** Apply a plan to plain objects (mutates). Returns change count. */
  function applyPlan(pl, campaign, tables) {
    let n = 0;
    campaign.beats = campaign.beats || [];
    for (const b of pl.beatsAdd) { campaign.beats.push(b); n++; }
    const byTable = {};
    for (const r of pl.rowsRemove) (byTable[r.tableId] = byTable[r.tableId] || []).push(r.index);
    for (const [tid, idxs] of Object.entries(byTable)) {
      const drop = new Set(idxs); tables[tid].entries = tables[tid].entries.filter((_, i) => !drop.has(i)); n += idxs.length;
    }
    for (const r of pl.rowsAdd) { tables[r.tableId].entries.push(r.row); n++; }
    return n;
  }
  globalThis.__expandRoadEncLib = { PACKETS, M, SC, PHASE, POINTS, plan, applyPlan, buildBeats, tablesFor, pointsOf, beatIdOf };
  // </plan>

  if (globalThis.__expandRoadEncLibOnly) return;
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  let campaignId = null;
  try { campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.() || null; } catch (_e) {}
  if (!campaignId) { try { campaignId = game.settings.get(NS, "activeCampaignId") || null; } catch (_e) {} }
  const campaign = camps?.[campaignId];
  if (!campaign) return ui.notifications?.error(`Active campaign '${campaignId}' not found.`);
  if (!campaign.id) campaign.id = campaignId;
  const tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : foundry.utils.deepClone(tablesRaw);
  const tablesBefore = JSON.parse(JSON.stringify(tables));

  // pack index (id → name)
  let packIndex = null;
  try {
    const pack = game.packs?.get?.(PACK);
    if (pack) { const idx = await pack.getIndex(); packIndex = new Map([...idx].map(e => [e._id, e.name])); }
  } catch (e) { console.warn("[expand-road-encounters] pack index failed", e); }

  // live battlemap check: exists, has a grid, no hostile/neutral tokens (they would join the fight)
  const H = (globalThis.CONST?.TOKEN_DISPOSITIONS?.HOSTILE ?? -1), N0 = (globalThis.CONST?.TOKEN_DISPOSITIONS?.NEUTRAL ?? 0);
  const sceneCheck = (game.scenes && typeof game.scenes.get === "function") ? (sid) => {
    const s = game.scenes.get(sid);
    if (!s) return { ok: false, why: "no such scene" };
    const gridType = Number(s.grid?.type ?? 1);
    if (gridType === 0) return { ok: false, why: "gridless", name: s.name };
    const toks = [...(s.tokens ?? [])];
    const foes = toks.filter(t => { const d = Number(t.disposition); return d === H || d === N0; });
    if (foes.length) return { ok: false, why: `${foes.length} hostile/neutral token(s): ${[...new Set(foes.map(t => t.name))].slice(0, 4).join(", ")}`, name: s.name };
    return { ok: true, why: toks.length ? `${toks.length} friendly token(s)` : "clean", name: s.name };
  } : null;

  const pl = plan({ campaign, tables, packIndex, sceneCheck });
  const changes = pl.beatsAdd.length + pl.rowsAdd.length + pl.rowsRemove.length;
  const report = {
    DRY_RUN, campaignId, changes,
    beatsAdded: pl.beatsAdd.length, beatsExisting: pl.beatsExisting.length,
    rowsAdded: pl.rowsAdd.length, rowsExisting: pl.rowsExisting.length,
    rowsRemoved: pl.rowsRemove.map(r => `${r.tableId}:${r.beatId}`),
    skipped: pl.skipped, missingTables: pl.missingTables, scenes: pl.scenes, foes: pl.foes,
    packets: PACKETS.map(p => ({ key: p.key, tier: p.tier, points: pointsOf(p), beat: beatIdOf(p), tables: tablesFor(p).map(t => t.tableId + (t.mirror ? "(mirror)" : "")) }))
  };

  if (!DRY_RUN && changes) {
    const backup = { at: new Date().toISOString(), campaignId, encounterTables: tablesBefore, beatsAdded: pl.beatsAdd.map(b => b.id), rowsRemoved: pl.rowsRemove.map(r => ({ tableId: r.tableId, row: r.row })) };
    try {
      const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const existing = (game.journal?.contents ?? []).filter(j => String(j.name).startsWith(BACKUP_NAME)).length;
      await JournalEntry.create({ name: existing ? `${BACKUP_NAME} (pass ${existing + 1})` : BACKUP_NAME, pages: [{ name: "before", type: "text", text: { content: `<pre>${esc(JSON.stringify(backup, null, 1))}</pre>` } }] });
    } catch (e) { report.error = `backup failed — nothing written: ${e?.message || e}`; globalThis.__expandRoadEncReport = report; return ui.notifications?.error(report.error); }
    applyPlan(pl, campaign, tables);
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
    await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  }

  globalThis.__expandRoadEncReport = report;
  console.log(`[expand-road-encounters] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${pl.beatsAdd.length} beats, ${pl.rowsAdd.length} rows added, ${pl.rowsRemove.length} Apex rows removed, ${pl.skipped.length} packets skipped`, report);
  ui.notifications?.info(`Road encounters ${DRY_RUN ? "dry run" : "applied"}: ${changes} changes (${pl.beatsAdd.length} beats, +${pl.rowsAdd.length}/−${pl.rowsRemove.length} rows)${pl.skipped.length ? `, ${pl.skipped.length} skipped` : ""}.`);
})();
