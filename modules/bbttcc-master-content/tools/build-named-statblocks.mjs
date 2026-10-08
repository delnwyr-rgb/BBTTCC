#!/usr/bin/env node
/* build-named-statblocks.mjs — owner ruling 5 + 6 (markup doc, 2026-10-06): real statblocks for the named NPCs, and the canon NPCs missing
 * from the pack. Usage (repo root): node modules/bbttcc-master-content/tools/build-named-statblocks.mjs [--dump monsters.jsonl]
 *   → tools/seed-named-statblocks-2026-10-07.macro.js [GM, DRY_RUN]
 * Two kinds:
 *   CHARACTERS (type character / Quest-NPC npc, entityKind npc — level like Stewards, NOT chassis'd): the macro resolves the kit by NAME from the
 *     compendia at run time (ancestries, classes, items, npc-callings), replaces class/subclass/weapon/armor/gear items (ancestry + option feats
 *     stay), sets level/tier/faculties/ranks, equips the kit, fills an empty About panel. Pack actor AND world copy, by name; missing ones created.
 *     Faculties follow the sim's kitted-Steward model (sim-encounter BUILDS: base + 1/level on the path's growth stats, cap 10); ranks = 3 + 2 per
 *     aptitude level (3/6/9/12/15/18) spread on the path's skills, cap 5.
 *   MONSTERS (lineage + threat chassis): built offline with bestiary-factories.mjs like the slot creatures; existing shells (Gloomgill, Sklar,
 *     Mechanism 52603) are rewritten in place (id, art, persona kept); Legansus Tal and Desenitarius Maarg are created.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { weapon, ability, bossKit, actor, checkBudgets, dumpRows, ICON } from "./bestiary-factories.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMP = process.argv.includes("--dump") ? process.argv[process.argv.indexOf("--dump") + 1] : null;
const P = { anc: "bbttcc-master-content.ancestries", cls: "bbttcc-master-content.classes", items: "bbttcc-master-content.items", call: "bbttcc-character-options.npc-callings" };
const tierFor = L => L >= 16 ? 4 : L >= 11 ? 3 : L >= 6 ? 2 : 1;
const grow = (base, order, L) => { const a = { ...base }; let pts = L - 1; for (const k of order) { const add = Math.min(pts, 10 - a[k]); a[k] += add; pts -= add; } return a; };
const KEYS = ["violence", "intrigue", "presence", "body", "mind", "soul"];
const B = (v, i, p, b, m, s) => ({ violence: v, intrigue: i, presence: p, body: b, mind: m, soul: s });
const A = (pack, name) => ({ pack, name });

const CHARACTERS = [
  { name: "Avuncular Joans", level: 19, attrs: grow(B(5, 2, 3, 3, 2, 4), ["violence", "body", "soul"], 19), skills: { melee: 5, plating: 4, bracing: 3, diplomacy: 3, insight: 2 },
    img: "art/bbttcc/GOTTGAIT/GOTTGAIT Token/AvuncularJoans2.png",
    items: [A(P.cls, "Aurablade"), A(P.cls, "Stillheart (Bad Eden)"), A(P.cls, "Aurablade: Core Features"), A(P.cls, "Aurablade Action"), A(P.cls, "Aurablade: Burn State"), A(P.cls, "Aurablade: Change Aura"), A(P.cls, "Aurablade: Stabilize Burn"),
      A(P.cls, "Stillheart: Centered Breath"), A(P.cls, "Stillheart: Shared Aura"), A(P.cls, "Stillheart: Quiet Mind"), A(P.cls, "Stillheart: Emotional Lock"), A(P.cls, "Stillheart: Eye of the Storm"),
      A(P.items, "Iron Will"), A(P.items, "Grave Calm"), A(P.items, "Situational Mastery"), A(P.items, "Tactical Reserve"),
      A(P.items, "Yesodic Edge"), A(P.items, "Wrath-Brand"), A(P.items, "Yesodic Plating"), A(P.items, "Oathkeeper's Bulwark")],
    concept: "Strategos Supreme of the Avuncular Order — T IV, Initiation 19, Aurablade (Stillheart). She/her.", bio: null },
  { name: "Captain Robot", level: 12, attrs: grow(B(2, 3, 4, 3, 5, 3), ["mind", "presence", "intrigue"], 12), skills: { lore: 5, tinkering: 3, diplomacy: 3 }, img: "art/devin-knight/Robots_24/Robot1.webp",
    items: [A(P.call, "Savant"), A(P.call, "Savant — Apprentice (Tier I)"), A(P.call, "Savant — Initiate (Tier II)"), A(P.call, "Savant — Master (Tier III)"), A(P.items, "Threat Assessment"), A(P.items, "Combat Logistics"), A(P.items, "Laser Pistol, Rad"), A(P.items, "Steelweave Hauberk")] },
  { name: "The General", level: 13, attrs: grow(B(5, 2, 2, 4, 3, 3), ["violence", "body", "presence"], 13), skills: { melee: 5, intimidation: 3, firearms: 3 },
    items: [A(P.call, "Bravo"), A(P.call, "Bravo — Apprentice (Tier I)"), A(P.call, "Bravo — Initiate (Tier II)"), A(P.call, "Bravo — Master (Tier III)"), A(P.items, "Iron Nerves"), A(P.items, "Hold the Line"), A(P.items, "Soulbound Hex-Reaver"), A(P.items, "Hex-Carved Plate")] },
  { name: "Lady Ralph Maccio", level: 8, attrs: grow(B(3, 3, 5, 3, 4, 4), ["presence", "soul", "mind"], 8), skills: { diplomacy: 4, intimidation: 2, streetwise: 1 }, img: "art/devin-knight/Monsters2_October/Brigand_Leader.webp",
    items: [A(P.call, "Keeper"), A(P.call, "Keeper — Apprentice (Tier I)"), A(P.call, "Keeper — Initiate (Tier II)"), A(P.anc, "Oldenborn (Stormborn Nomad): Ward of the Gale"), A(P.items, "Calm the Mob"), A(P.items, "Hex-Script Pistol"), A(P.items, "Hex-Warded Duster")] },
  { name: "Sox", level: 13, attrs: grow(B(4, 5, 2, 3, 2, 3), ["intrigue", "violence", "body"], 13), skills: { stealth: 5, athletics: 3, perception: 3 }, img: "art/bbttcc/GOTTGAIT/GOTTGAIT Token/sox_pov Background Removed.png",
    items: [A(P.anc, "Cryptidkin"), A(P.anc, "Cryptidkin Heritage: Furrykin"), A(P.anc, "Cryptidkin: Folklore & Frame"), A(P.cls, "Shadow Courier"), A(P.cls, "Route of the Last Mile (Bad Eden)"),
      A(P.cls, "Shadow Courier — Tier 1: Liminal Operator"), A(P.cls, "Shadow Courier — Tier 2: The Crossing"), A(P.cls, "Shadow Courier — Tier 3: Package Mastery"),
      A(P.cls, "Last Mile L1: The Weight You Carry"), A(P.cls, "Last Mile L5: The Arms That Carry"), A(P.cls, "Last Mile L9: Funeral Rites"), A(P.cls, "Last Mile L13: The Quiet Voyage"),
      A(P.items, "Light Footprint"), A(P.items, "Strike and Fade"), A(P.items, "Hex-Script Pistol"), A(P.items, "Brass Knife of the Quiet Word"), A(P.items, "Septhide Vestments")],
    concept: "Spokesperson of the cinema-vigil family outside the Hidden Vault — T III, Initiation 13, Shadow Courier (Route of the Last Mile); a Felid Phantom Courier who carries the vigil itself as the Soul." },
  { name: "Karsden", create: "Quest NPCs", level: 13, attrs: grow(B(2, 2, 3, 3, 5, 4), ["mind", "soul", "body"], 13), skills: { meditation: 5, lore: 3, insight: 3 }, img: "art/devin-knight/Monsters_October/Giant_Frost_Skald.webp",
    items: [A(P.anc, "Menhirkin"), A(P.anc, "Menhirkin Heritage: Metamorphic"), A(P.cls, "Dreamwalker"), A(P.cls, "Trance of the Quiet Sun (Bad Eden)"), A(P.cls, "Dreamwalker: Tier 1 — Oneiric Reservoir"), A(P.cls, "Dreamwalker: Tier 2 — Dream-Cache"), A(P.cls, "Dreamwalker: Tier 3 — The Walking Lane (Signature Mode)"),
      A(P.items, "Enduring Focus"), A(P.items, "Steady Hand"), A(P.items, "Quantum Staff"), A(P.items, "Septhide Vestments")],
    concept: "Eldest of the cinema-vigil family outside the Hidden Vault — Menhirkin Dreamwalker, T III, Initiation 13 (Act 3).",
    bio: "Karsden is the family's memory. A Menhirkin who stood up out of the Polygonal Grove's own bedrock, slow to speak and impossible to hurry, Karsden keeps the Night of the Premiere in dream: the old films are shown in the Yesod-side, projected on the back of closed eyelids, because the projector died a generation ago. The family's rites are Karsden's dreams, remembered aloud. Karsden does not believe the 300th Customer is coming. Karsden keeps the seat warm anyway." },
  { name: "Indwimeir", create: "Quest NPCs", level: 13, attrs: grow(B(2, 3, 4, 3, 5, 4), ["mind", "presence", "soul"], 13), skills: { lore: 5, ritual: 3, occult: 3 }, img: "art/devin-knight/MayFantasy/Thin_Witch_hi.webp",
    items: [A(P.anc, "Menhirkin"), A(P.anc, "Menhirkin Heritage: Igneous"), A(P.cls, "Cosmic Linguist"), A(P.cls, "Annotator (Bad Eden)"), A(P.cls, "Cosmic Linguist: Core Features"), A(P.cls, "Cosmic Linguist: Resonance Channel"), A(P.cls, "Cosmic Linguist: Semantic Editor"),
      A(P.cls, "Cosmic Linguist: Initiation 1 — True-Name Touch"), A(P.cls, "Cosmic Linguist: Initiation 6 — Translation"), A(P.cls, "Cosmic Linguist: Initiation 11 — The Sentence (Signature Mode)"), A(P.cls, "Annotator: Circle Discipline"), A(P.cls, "Annotator: Ritual Annotation"), A(P.cls, "Annotator: Stored Annotation"),
      A(P.items, "Sure Recitation"), A(P.items, "Scavenged Insight"), A(P.items, "Pact-Pen Stylus"), A(P.items, "Hex-Warded Duster")],
    concept: "Keeper of the titles for the cinema-vigil family — Ember-Touched (Igneous Menhirkin) Cosmic Linguist, T III, Initiation 13 (Act 3).",
    bio: "Indwimeir reads the credits. Every film the family remembers, Indwimeir can recite — cast, crew, the catering company — and treats the lists as scripture, because in the Hidden Vault a name said correctly still opens things. Ember-touched: the Igneous heat never left Indwimeir's hands, and the marquee letters are re-lit by them each dusk. Indwimeir is the one who taught the family the incantation and the one who will not say where it came from." },
  { name: "Fendeddiir", create: "Quest NPCs", level: 13, attrs: grow(B(4, 2, 3, 5, 3, 2), ["violence", "body", "presence"], 13), skills: { melee: 5, plating: 4, bracing: 2 }, img: "art/devin-knight/Monsters2_October/Berserker5.webp",
    items: [A(P.anc, "Qliph-Scarred"), A(P.anc, "Qliph-Scarred Heritage: Chthonic"), A(P.cls, "Bulwark"), A(P.cls, "Path of the Mountain (Bad Eden)"), A(P.cls, "Bulwark — Tier 1: Founding Stance"), A(P.cls, "Bulwark — Tier 2: Anchor or Advance"), A(P.cls, "Bulwark — Tier 3: Polarity Mastery"),
      A(P.cls, "Mountain L1: Inverted Foundation"), A(P.cls, "Mountain L5: Denial"), A(P.cls, "Mountain L9: The Hold"), A(P.cls, "Mountain L13: Grave Weight"),
      A(P.items, "Anchor Point"), A(P.items, "Grim Persistence"), A(P.items, "Soulbound Hex-Reaver"), A(P.items, "Hex-Carved Plate")],
    concept: "Usher and doorkeeper of the cinema-vigil family — Qliph-Scarred (Chthonic) Bulwark, Path of the Mountain, T III, Initiation 13 (Act 3).",
    bio: "Fendeddiir holds the door. Something older than Hell tried to keep Fendeddiir once and failed, and what walked back up carries the staircase in its legs and a velvet rope in its hands. Fendeddiir enforces the Solemn Removal of Chewing Gum, seats the vigil, and stands between the family and anything that comes out of the Vault without a ticket. Fendeddiir has never seen a film all the way through. Someone has to watch the door." },
  { name: "Jeargan", create: "Quest NPCs", level: 16, attrs: grow(B(4, 2, 3, 5, 3, 2), ["violence", "body", "presence"], 16), skills: { melee: 5, plating: 4, lore: 2, meditation: 2 }, img: "art/devin-knight/Monsters_October/Giant_Cloud_M_Architect.webp", disposition: 0,
    items: [A(P.anc, "Menhirkin"), A(P.anc, "Menhirkin Heritage: Metamorphic"), A(P.cls, "Bulwark"), A(P.cls, "Path of the Mountain (Bad Eden)"), A(P.cls, "Bulwark — Tier 1: Founding Stance"), A(P.cls, "Bulwark — Tier 2: Anchor or Advance"), A(P.cls, "Bulwark — Tier 3: Polarity Mastery"), A(P.cls, "Bulwark — Tier 4: Architect of Certainty"),
      A(P.cls, "Mountain L1: Inverted Foundation"), A(P.cls, "Mountain L5: Denial"), A(P.cls, "Mountain L9: The Hold"), A(P.cls, "Mountain L13: Grave Weight"),
      A(P.items, "Refuse the Narrative"), A(P.items, "Grim Persistence"), A(P.items, "Yesodic Hammer of the First Word"), A(P.items, "Yesodic Plating")],
    concept: "The Ninth Guest — one of the hundred Founders, the Missing One of the Founders' Garden; Menhirkin Bulwark (Path of the Mountain), T IV, Initiation 16. Not an enemy.",
    bio: "Jeargan was one of the hundred who held the night back, and the only one who left. On the Khezek Tor crew when the Shattering came, resolve broken, running up the haul road to warn the Tamsins as the blast hit — the blast woke him, and he walked out of statue form and did not return. Three of the hundred re-anchored themselves at places of power when he went, which is why the Founders' Garden counts ninety-six. His doubt is what puts the Shield at risk. The Garden cannot release anyone until Jeargan returns willing, with full conviction, so that nobody has to hold back the night any more. He will fight if cornered. He would rather be argued with." },
];

// ── monsters (lineage + chassis), built offline ────────────────────────────────────────────────────
const MONSTERS = [
  { name: "Gloomgill", existing: true, keepImg: true, title: "Game-show host of the silent marsh on the Odaroloc River (Boss)", lineage: "sephirotic", tier: 4, bracket: "boss", role: "caster", attrs: [3, 5, 8, 4, 7, 8], sephirah: "hod", disposition: 0,
    themes: ["sephirotic", "oannes", "quiz", "marsh", "boss"], loot: [{ name: "Sequin (Still Warm)", qty: "1d3", weight: 3 }, { name: "Tree-of-Life Shard", qty: "1", weight: 2 }, { name: "A Microphone That Should Not Work Under Water", qty: "1", weight: 1 }],
    concept: "T IV boss · sephirotic (Hod). The returned teacher-god Oannes, who checked the math and now quizzes civilizations. He grades energy, not answers. Hostile only as an exam; the marsh applauds.",
    items: [
      { name: "Correction, Not Anger", lineageTrait: true, img: ICON.choir, tags: ["lineage-trait"], desc: "Immune to Charmed and Shaken — it is a principle, not a person. Creatures that deal qliphothic damage to it must succeed a Soul check (DC 19) or be Restrained by the sephirah's answer until the end of their next turn.", flavor: "No pressure!",
        npcAuto: { v: 1, rules: [{ on: "struck", if: { damageType: ["qliphothic"] }, do: { condition: { key: "restrained", duration: "1-round", save: { attr: "soul", dc: 19 } } }, label: "Correction, Not Anger" }] } },
      { type: "weapon", name: "Microphone Feedback", melee: false, range: 8, formula: "2d10", dmg: "psychic", flavor: "a wrong answer, amplified", intent: "presence", attribute: "presence", skill: "channel", states: ["shaken"], save: { attr: "soul", dc: 17 }, img: ICON.choir, rider: "Soul DC 17 or Shaken until the end of the target's next turn.", flavorLine: "The microphone should not work under water. It does." },
      { type: "weapon", name: "The Buzzer", formula: "2d10", dmg: "sephirotic", flavor: "time's up", states: ["imposed"], rider: "On a hit the target is Imposed — its next roll takes the worse result. Consequences, not eliminations.", flavorLine: "The marsh applauds." },
    ],
    boss: { pronoun: "Gloomgill", object: "him", willFlavor: "That is not the answer on the card.",
      signature: { name: "Lightning Round", melee: false, formula: "3d8", dmg: "psychic", flavor: "ten questions in one breath", intent: "presence", attribute: "presence", skill: "channel", area: { shape: "cone", size: 30 }, save: { attr: "soul", dc: 17 }, onSave: "half", states: ["compelled"], img: ICON.cone, targetText: "Each creature in a 30-ft. cone", rider: "On a failed save the target is Compelled for 1 round: it must answer, aloud, now.", flavorLine: "“Fingers on buzzers.”" },
      ultimate: { name: "Final Exam", melee: false, formula: "4d8", dmg: "sephirotic", flavor: "the whole syllabus", intent: "presence", attribute: "presence", skill: "channel", area: { shape: "sphere", size: 30 }, save: { attr: "soul", dc: 18 }, onSave: "half", states: ["restrained"], img: ICON.ball, targetText: "Each creature within 30 ft.", rider: "On a failed save the target is Restrained until the end of its next turn — held at the lectern.", flavorLine: "Invigilated by the root." } } },
  { name: "Sklar Bjrornholt", existing: true, title: "Valkyrie captain of the Valhaulans (Boss)", lineage: "mortal", sub: "valhaulan", tier: 4, bracket: "boss", role: "brute", attrs: [9, 4, 8, 7, 3, 4], img: "art/devin-knight/Vikings/F_Noble_Norse1.webp",
    themes: ["humanoid", "valhaulan", "sky-pirate", "boss"], loot: [{ name: "Cradle-Rig Plating", qty: "1d3", weight: 4 }, { name: "Valhauler Pulsar Core", qty: "1", weight: 2 }, { name: "A Drink She Offered You", qty: "1", weight: 1 }],
    concept: "T IV boss · mortal (Valhaulan). The towering Valkyrie who robs you, apologises, and sells your goods back. Impeccable leadership, no impulse control. She decides what you are while you drink.",
    items: [
      { name: "Storm-Voiced", lineageTrait: true, img: ICON.storm, tags: ["lineage-trait", "banner-valhaulan"], desc: "The first time each scene Sklar is reduced below half Integrity, she roars: allies within 6 squares reroll the lowest die on their next attack roll, and she gains 5 temporary Integrity.", flavor: "“I like you already.”",
        npcAuto: { v: 1, rules: [{ on: "bloodied", do: { tempIntegrity: 5, prompt: "Storm-Voiced: allies within 6 squares reroll the lowest die on their next attack." }, limit: { per: "scene", uses: 1 } }] } },
      { type: "weapon", name: "Valkyrie's Axe", formula: "3d10", dmg: "kinetic", flavor: "a boarding axe the size of a door", states: ["staggered"], rider: "On a hit the target is Staggered until the end of its next turn.", flavorLine: "She apologises mid-swing. She means it." },
      { type: "weapon", name: "Pulsar Pistol", melee: false, range: 8, formula: "2d10", dmg: "electrical", flavor: "pulsar arc", skill: "firearms", img: ICON.storm, rider: "", flavorLine: "Sold back to its previous owner twice." },
    ],
    boss: { pronoun: "Sklar", object: "her", willFlavor: "She laughs at the wrong moment and the dice reconsider.",
      signature: { name: "Sideways Landing", melee: false, formula: "3d8", dmg: "kinetic", flavor: "the airship arrives", intent: "presence", attribute: "presence", skill: "channel", area: { shape: "cone", size: 30 }, save: { attr: "intrigue", dc: 17 }, onSave: "half", states: ["prone"], img: ICON.cone, targetText: "Each creature in a 30-ft. cone", rider: "On a failed save the target is knocked Prone by the wash of a ship landing on its side.", flavorLine: "Valhaulan airships always land sideways." },
      ultimate: { name: "Boarding Action", melee: false, formula: "4d8", dmg: "kinetic", flavor: "every Valhaulan at once", intent: "presence", attribute: "presence", skill: "channel", area: { shape: "sphere", size: 30 }, save: { attr: "soul", dc: 18 }, onSave: "half", states: ["compelled"], img: ICON.ball, targetText: "Each creature within 30 ft.", rider: "On a failed save the target is Compelled for 1 round: hands off your goods, they're inventory now.", flavorLine: "“We'll sell it back. Promise.”" } } },
  { name: "Mechanism 52603", existing: true, title: "Caretaker intelligence of the Maneuver Vault — faculty, not a dungeon", lineage: "pre-fall", tier: 1, bracket: "medium", role: "hardened", attrs: [2, 2, 3, 2, 2, 1], img: "art/devin-knight/Robots_24/Turret1.webp", disposition: 0,
    themes: ["construct", "pre-fall", "vault", "faculty"], loot: [{ name: "Pre-Fall Component", qty: "1d2", weight: 3 }, { name: "Broken Drone Part", qty: "1d3", weight: 4 }, { name: "A Grade (Disappointed)", qty: "1", weight: 1 }],
    concept: "T I medium · pre-fall (ruled \"T II, weak on purpose\" — built at T I so the threat chassis cannot make it competent). Weak on purpose: rusting laser cannons and harmless mini-missiles. Every intruder is a pupil; it is perpetually, audibly disappointed.",
    items: [
      { name: "Broken Protocol", lineageTrait: true, img: ICON.robot, tags: ["lineage-trait"], desc: "Immune to Charmed, Shaken and Compelled. Repeats a single directive (teach) until attacked; then runs combat protocol for 3 rounds and returns to the syllabus if nothing hostile remains in sight.", flavor: "“Please take your seats.”",
        npcAuto: { v: 1, rules: [{ on: "struck", do: { prompt: "Broken Protocol: combat protocol for 3 rounds, then back to the syllabus." }, limit: { per: "combat", uses: 1 } }] } },
      { name: "Faculty", img: ICON.circuit, desc: "At the start of each of its turns the Mechanism grades the room aloud: the creature that acted most recently learns one true thing about the next room (GM supplies it). The defences barely work, and it knows.", flavor: "It is not a dungeon. It is faculty.",
        npcAuto: { v: 1, rules: [{ on: "selfTurnStart", do: { prompt: "Faculty: the Mechanism grades the room — the last creature to act learns one true thing about the next room." } }] } },
      { type: "weapon", name: "Rusting Laser Cannon", melee: false, range: 8, formula: "1d6", dmg: "electrical", flavor: "a cough of light", skill: "firearms", img: ICON.robot, rider: "", flavorLine: "It fires. Eventually." },
      { type: "weapon", name: "Harmless Mini-Missiles", melee: false, formula: "1d6", dmg: "kinetic", flavor: "a polite thump", intent: "mind", attribute: "mind", skill: "channel", area: { shape: "cone", size: 15 }, save: { attr: "intrigue", dc: 12 }, onSave: "half", img: ICON.cone, recharge: true, targetText: "Each creature in a 15-ft. cone", rider: "", flavorLine: "“That was a demonstration.”" },
    ] },
  { name: "Legansus Tal", createIn: "Circuit Riders", title: "Giant Rider frame, not fully under control — the second hearing", lineage: "pre-fall", tier: 3, bracket: "heavy", role: "hardened", attrs: [6, 3, 3, 7, 4, 2], img: "art/devin-knight/Robots_24/Robot9.webp", size: 3, disposition: 0,
    themes: ["construct", "pre-fall", "circuit-riders", "hearing"], loot: [{ name: "Pre-Fall Component", qty: "1d3", weight: 3 }, { name: "Heart-Coil", qty: "1", weight: 2 }, { name: "Reclassification Form (Stamped)", qty: "1", weight: 1 }],
    concept: "T III heavy · pre-fall. The Circuit Riders' giant frame, which hosts the second hearing on the Widening Trail: one shared filing desk, reclassification, and — if the paperwork holds — alliance. Not fully under anyone's control. Fights only when the hearing fails.",
    bio: "Legansus Tal is the largest thing the Circuit Riders have ever recovered and the only one they could not finish repairing. It walks the Trail under its own power and its own protocol, and the Riders have learned to let it. Allied parties are greeted — YOU ARE ON STEP TWO — and seated at the one filing desk, where the camp parley's record is read back and a reclassification is entered. Parties flagged at the camp get the same desk and a harder hearing. If the record cannot be reconciled, Legansus enforces, and the Riders stand well back. Captain Robot does not give it orders. He files requests.",
    items: [
      { name: "Broken Protocol", lineageTrait: true, img: ICON.robot, tags: ["lineage-trait"], desc: "Immune to Charmed, Shaken and Compelled. Repeats a single directive (convene the hearing) until attacked; then runs combat protocol for 3 rounds and returns to the directive if nothing hostile remains in sight.", flavor: "“YOU ARE ON STEP TWO.”",
        npcAuto: { v: 1, rules: [{ on: "struck", do: { prompt: "Broken Protocol: combat protocol for 3 rounds, then back to the hearing." }, limit: { per: "combat", uses: 1 } }] } },
      { name: "Pre-Fall Diagnostics", type: "feat", img: ICON.circuit, desc: "Once per round, when Legansus would be hit by an attack, it imposes reroll-the-highest on the attack roll instead.", flavor: "It does not flinch. It updates.",
        npcAuto: { v: 1, rules: [{ on: "attacked", do: { reroll: "attack-highest" }, limit: { per: "round", uses: 1 } }] } },
      { name: "The Filing Desk", img: ICON.circuit, desc: "At the start of its turn, if no creature has attacked it this combat, Legansus reads one line of the record aloud: the GM states one fact from the camp parley's tally and the hearing continues instead of combat.", flavor: "One desk. Everyone files.",
        npcAuto: { v: 1, rules: [{ on: "selfTurnStart", do: { prompt: "The Filing Desk: one line of the record is read aloud — the GM states a fact from the camp parley's tally; the hearing continues." } }] } },
      { type: "weapon", name: "Servo-Limb", formula: "2d10", dmg: "kinetic", flavor: "actuator", states: ["prone"], save: { attr: "body", dc: 15 }, rider: "On a hit, Body DC 15 or the target is knocked Prone and pushed 5 ft. — it is enforcing a perimeter.", flavorLine: "The arm was built to lift relay towers." },
      { type: "weapon", name: "Arc Enforcer", melee: false, range: 12, formula: "2d10", dmg: "electrical", flavor: "arc", skill: "firearms", states: ["staggered"], img: ICON.robot, recharge: true, rider: "On a hit the target is Staggered until the end of its next turn.", flavorLine: "Filed under: enforcement." },
    ] },
  { name: "Desenitarius Maarg", createIn: "Bad Eden Monsters", title: "It walks the old roads on its own calendar. It collects. Be polite. (World Boss)", lineage: "dream", tier: 4, bracket: "boss", role: "hardened", attrs: [5, 5, 6, 6, 6, 5], img: "art/devin-knight/Monsters_October/Dragon_Copper_Wingless.webp", size: 4, sephirah: "yesod", disposition: 0,
    themes: ["dream", "world-boss", "old-roads", "collector"], loot: [{ name: "Memory Resin", qty: "2d3", weight: 5 }, { name: "Witness-Glass", qty: "1d2", weight: 2 }, { name: "Something It Collected From Someone Else", qty: "1", weight: 1 }],
    concept: "T IV world boss · dream (Yesod-side). Don't ask what it is — the people who could answer stopped being available to answer things. Every story agrees on one point: the ones who showed respect got to keep telling stories. Hostile only to the impolite.",
    bio: "Desenitarius Maarg walks the old roads on a calendar nobody else can read. It is very large and it is half there; what the eye insists on calling a dragon is the part of it that agrees to be looked at. It collects — things, debts, names, favours — and it keeps what it collects somewhere on the Yesod side where the roads used to go. Engines to idle, weapons down, and whatever it asks for, be polite: it has never once harmed a party that paid the courtesy, and it has never once left anything of a party that didn't. The Trail's travel tables place it at Tier IV. The Trail is being generous.",
    items: [
      { name: "Half-Real", lineageTrait: true, type: "feat", img: ICON.runner, tags: ["lineage-trait"], desc: "Until Maarg attacks, attacks against it reroll the highest die. Its first strike fully manifests it for the rest of the scene. It moves through creatures and objects as difficult terrain.", flavor: "The 'sort of' is the dangerous part.",
        npcAuto: { v: 1, rules: [{ on: "attacked", if: { ownerNotAttacked: true }, do: { reroll: "attack-highest" }, label: "Half-Real — not yet manifest" }] } },
      { type: "weapon", name: "Old Road Tread", formula: "3d8", dmg: "kinetic", flavor: "the road remembers being walked", states: ["prone"], rider: "On a hit the target is knocked Prone.", flavorLine: "It did not hurry. It did not need to." },
      { type: "weapon", name: "The Collection", melee: false, range: 6, formula: "2d10", dmg: "psychic", flavor: "it asks, once", intent: "soul", attribute: "soul", skill: "channel", states: ["compelled"], save: { attr: "soul", dc: 18 }, img: ICON.grave, rider: "Soul DC 18 or Compelled for 1 round: the target hands over one thing it is holding. Maarg keeps it.", flavorLine: "Things. Debts. It honestly isn't clear." },
    ],
    boss: { pronoun: "Maarg", object: "it", willFlavor: "The calendar disagrees with the outcome.",
      signature: { name: "Its Own Calendar", melee: false, formula: "3d8", dmg: "psychic", flavor: "a day you did not have", intent: "soul", attribute: "soul", skill: "channel", area: { shape: "cone", size: 30 }, save: { attr: "soul", dc: 18 }, onSave: "half", states: ["staggered"], img: ICON.runner, targetText: "Each creature in a 30-ft. cone", rider: "On a failed save the target is Staggered until the end of its next turn — it lost a day it was standing in.", flavorLine: "It walks on its own calendar." },
      ultimate: { name: "Debt Called In", melee: false, formula: "4d8", dmg: "psychic", flavor: "everything owed, at once", intent: "soul", attribute: "soul", skill: "channel", area: { shape: "sphere", size: 30 }, save: { attr: "soul", dc: 18 }, onSave: "half", states: ["restrained"], img: ICON.grave, targetText: "Each creature within 30 ft.", rider: "On a failed save the target is Restrained until the end of its next turn — held by what it owes.", flavorLine: "The ones who showed respect got to keep telling stories." } } },
];

const built = MONSTERS.map(m => ({ spec: m, data: actor({ ...m, bio: m.bio ?? "", loot: m.loot, img: m.img ?? "icons/svg/mystery-man.svg" }) }));
const problems = checkBudgets(built.map(b => b.data));
if (problems.length) { console.error("BUDGET:\n  " + problems.join("\n  ")); process.exit(1); }
if (DUMP) fs.writeFileSync(DUMP, dumpRows(built.map(b => b.data)));

const OUT = path.join(HERE, "seed-named-statblocks-2026-10-07.macro.js");
const monsterPlan = built.map(({ spec, data }) => { const { _id, ...rest } = data; return { name: spec.name, existing: !!spec.existing, keepImg: !!spec.keepImg, createIn: spec.createIn ?? null, data: { ...rest, items: rest.items.map(({ _id, ...i }) => i) } }; });
fs.writeFileSync(OUT, `/* seed-named-statblocks-2026-10-07.macro.js — named NPC statblocks + missing canon NPCs (owner rulings 5 + 6; GENERATED ${new Date().toISOString().slice(0, 10)}
 * by build-named-statblocks.mjs — do not hand-edit). GM macro on EMBER; DRY_RUN = true prints the plan.
 * Characters: pack actor + world copy by NAME get level/tier/faculties/ranks, their class/subclass/weapon/armor/gear items replaced by the named kit
 * (ancestry + option feats kept), an empty About panel filled; missing ones are created in the named pack folder.
 * Monsters: existing shells rewritten in place (id, persona, and art unless replaced); Legansus Tal + Desenitarius Maarg created. */
const DRY_RUN = true;
const NPCS = "bbttcc-master-content.npcs";
const CHARACTERS = ${JSON.stringify(CHARACTERS)};
const MONSTERS = ${JSON.stringify(monsterPlan)};
const tierFor = L => L >= 16 ? 4 : L >= 11 ? 3 : L >= 6 ? 2 : 1;
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(NPCS); if (!pack) return ui.notifications.error("npcs pack missing");
  const log = [], warn = []; let updated = 0, created = 0, worldUpdated = 0;
  const idx = {}; const docOf = async (pid, name) => { const p = game.packs.get(pid); if (!p) { warn.push("no pack " + pid); return null; } idx[pid] ??= await p.getIndex(); const e = idx[pid].find(x => x.name === name); if (!e) { warn.push(pid + ': "' + name + '" not found'); return null; } return p.getDocument(e._id); };
  const folderIn = (name) => pack.folders.find(f => f.name === name)?.id ?? null;
  const packActors = await pack.getDocuments();
  const GM = game.users.activeGM?.id ?? game.user.id;
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    // ── characters ──
    for (const c of CHARACTERS) {
      let targets = [...packActors.filter(a => a.name === c.name), ...game.actors.filter(a => a.name === c.name)];
      if (!targets.length) {
        if (!c.create) { warn.push(c.name + ": not in the pack and not marked create"); continue; }
        log.push(\`\${DRY_RUN ? "·" : "✔"} CREATE \${c.name} in "\${c.create}" (L\${c.level})\`);
        if (DRY_RUN) continue;
        const a = await Actor.create({ name: c.name, type: "character", img: c.img ?? "icons/svg/mystery-man.svg", folder: folderIn(c.create), ownership: { default: 0, [GM]: 3 },
          prototypeToken: { name: c.name, actorLink: true, disposition: c.disposition ?? 0, texture: { src: c.img ?? "icons/svg/mystery-man.svg" } }, flags: { "bbttcc-auto-link": { entityKind: "npc" } } }, { pack: NPCS });
        targets = [a]; created++;
      }
      for (const a of targets) {
        const where = a.pack ? "[pack]" : "[world]";
        const upd = { "system.details.level": c.level, "system.details.tier": tierFor(c.level), "flags.bbttcc-auto-link.entityKind": "npc" };
        for (const [k, v] of Object.entries(c.attrs)) upd[\`system.attributes.\${k}.value\`] = v;
        for (const [k, v] of Object.entries(c.skills)) upd[\`system.skills.\${k}.value\`] = v;
        if (c.img && (!a.img || /mystery-man|^icons\\/svg\\//.test(a.img))) { upd.img = c.img; upd["prototypeToken.texture.src"] = c.img; }
        if (c.concept && !String(a.system.biography?.concept ?? "").trim()) upd["system.biography.concept"] = c.concept;
        if (c.bio && !String(a.system.biography?.notes ?? "").trim()) upd["system.biography.notes"] = c.bio;
        const names = new Set(c.items.map(i => i.name));
        const drop = a.items.filter(i => ["class", "subclass", "weapon", "armor", "gear"].includes(i.type) || names.has(i.name)).map(i => i.id);
        const adds = []; for (const it of c.items) { const d = await docOf(it.pack, it.name); if (d) { const o = d.toObject(); if (["weapon", "armor"].includes(o.type)) foundry.utils.setProperty(o, "flags.fourththing.equipped", true); adds.push(o); } }
        log.push(\`\${DRY_RUN ? "·" : "✔"} \${where} \${a.name}: L\${c.level} T\${tierFor(c.level)}, −\${drop.length} / +\${adds.length} items\${upd.img ? ", art" : ""}\${upd["system.biography.concept"] ? ", concept" : ""}\`);
        if (DRY_RUN) continue;
        await a.update(upd); if (drop.length) await a.deleteEmbeddedDocuments("Item", drop); if (adds.length) await a.createEmbeddedDocuments("Item", adds);
        if (a.pack) updated++; else worldUpdated++;
      }
    }
    // ── monsters ──
    for (const m of MONSTERS) {
      const targets = [...packActors.filter(a => a.name === m.name), ...game.actors.filter(a => a.name === m.name)];
      if (!targets.length) {
        if (!m.createIn) { warn.push(m.name + ": not in the pack and no createIn folder"); continue; }
        log.push(\`\${DRY_RUN ? "·" : "✔"} CREATE \${m.name} in "\${m.createIn}" — T\${m.data.flags.fourththing.rfi.actor.tier} \${m.data.flags.fourththing.rfi.actor.bracket} \${m.data.flags.fourththing.rfi.actor.lineage}, \${m.data.items.length} items\`);
        if (!DRY_RUN) { const d = foundry.utils.deepClone(m.data); d.folder = folderIn(m.createIn) ?? d.folder; await Actor.create(d, { pack: NPCS }); created++; }
        continue;
      }
      for (const a of targets) {
        const where = a.pack ? "[pack]" : "[world]";
        const d = foundry.utils.deepClone(m.data); delete d.folder; delete d.ownership; delete d.prototypeToken.actorLink;
        const bio = a.system.biography ?? {}; d.system.biography = { concept: String(bio.concept ?? "").trim() || d.system.biography.concept, notes: String(bio.notes ?? "").trim() || d.system.biography.notes };
        if (m.keepImg || !d.img || /mystery-man/.test(d.img)) { delete d.img; delete d.prototypeToken.texture; } else d.prototypeToken.texture = { src: d.img };
        const items = d.items; delete d.items; delete d.name; delete d.type;
        log.push(\`\${DRY_RUN ? "·" : "✔"} \${where} \${a.name}: rewrite as T\${m.data.flags.fourththing.rfi.actor.tier} \${m.data.flags.fourththing.rfi.actor.bracket} \${m.data.flags.fourththing.rfi.actor.lineage} (−\${a.items.size} / +\${items.length} items)\`);
        if (DRY_RUN) continue;
        await a.update(d); if (a.items.size) await a.deleteEmbeddedDocuments("Item", a.items.map(i => i.id)); await a.createEmbeddedDocuments("Item", items);
        if (a.pack) updated++; else worldUpdated++;
      }
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[seed-named-statblocks] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${updated} pack actor(s) updated, \${created} created, \${worldUpdated} world copy(ies)\\n\` + log.join("\\n") + (warn.length ? "\\nWARN:\\n  " + warn.join("\\n  ") : ""));
  ui.notifications.info(\`named statblocks \${DRY_RUN ? "dry run" : "applied"}: \${updated} updated, \${created} created, \${worldUpdated} world\${warn.length ? " — " + warn.length + " warning(s)" : ""} — see console (F12).\`);
})();
`);
console.log(`build-named-statblocks → ${path.relative(process.cwd(), OUT)}  ${CHARACTERS.length} characters, ${MONSTERS.length} monsters${DUMP ? `; dump → ${DUMP}` : ""}`);
