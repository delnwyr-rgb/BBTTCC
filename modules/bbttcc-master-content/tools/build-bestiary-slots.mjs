#!/usr/bin/env node
/* build-bestiary-slots.mjs — the six empty tier × bracket slots (lint-bestiary B3, ruled 2026-10-06: bosses AND heavies at every tier):
 *   T1 heavy · T1 boss · T2 boss · T3 boss · T4 light · T4 medium.
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-bestiary-slots.mjs [--dump out.jsonl]
 *   → writes tools/seed-bestiary-slots-2026-10-07.macro.js [DRY_RUN] (GM macro on EMBER: Actor.create into bbttcc-master-content.npcs,
 *     folder "Bad Eden Monsters"; skips a name that already exists) and, with --dump, the same actors as pack-dump JSONL rows so
 *     bin/ft-lint-bestiary and bin/ft-sim-encounter can judge them BEFORE they go live.
 * Shapes follow the monster builder (monster-builder.js: INTEGRITY / DMG envelopes, lineage signatures, boss kit = Fractured Will +
 * Signature + Ultimate), weapon dice sit inside threat-budget.mjs's per-tier band, abilities carry npcAuto / passives the engine runs,
 * prices follow the creature rubric (tier base 5/10/20/40 × light 1 / medium 1.5 / heavy 2 / boss 3; hire = bounty × 1.5, bosses none).
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DUMP = process.argv.includes("--dump") ? process.argv[process.argv.indexOf("--dump") + 1] : null;
import { weapon, ability, bossKit, actor, checkBudgets, dumpRows, ICON } from "./bestiary-factories.mjs";
// ── the six ──────────────────────────────────────────────────────────────────────────────────────────
const PACK_TACTICS = { v: 1, rules: [{ on: "attack", if: { allyAdjacentToTarget: true }, do: { reroll: "attack" }, label: "Pack" }] };
const SPECS = [
  { name: "Burn-Zone Alpha", title: "The wolf that taught the pack to hunt in cinders", lineage: "wild", sub: "pack", tier: 1, bracket: "heavy", role: "brute", attrs: [3, 1, 2, 4, 1, 1], img: "art/devin-knight/ScifiJanuary/Wolf_Alien_MC.webp",
    themes: ["wildlife", "predator", "pack", "burn-zone"], loot: [{ name: "Herd Leather", qty: "1d3", weight: 5 }, { name: "Alpha's Fang", qty: "1", weight: 1 }, { name: "Ash-Wood", qty: "1d2", weight: 3 }],
    concept: "T1 heavy · wild. An old ash wolf, twice the size of her pack, scarred down one flank where the burn-zone took her first litter. She fights beside three lights and makes them dangerous.",
    bio: "She was a yearling when the Yesodium works went up and the forest became a burn-zone. She learned to hunt in smoke before she learned to hunt in grass. Her pack moves through cinder like a current; she moves through it like weather. Hunters in Allesh Gilliam call her the Alpha and leave her the field. She does not leave them anything.",
    items: [
      { name: "Territory", type: "feat", lineageTrait: true, img: ICON.bite, tags: ["lineage-trait"], desc: "Pack. The Alpha rerolls the lowest die on attack rolls against any creature within 1 square of an ally that isn't incapacitated. Burn-zone: while in cinder or smoke, her first attack each combat rerolls the lowest die and she is hidden until she acts.", flavor: "It was here first. It intends to be here after.",
        npcAuto: { v: 1, rules: [{ on: "attack", if: { firstRound: true }, do: { reroll: "attack" }, limit: { per: "combat", uses: 1 }, label: "Territory — the first strike rerolls the lowest" }, PACK_TACTICS.rules[0]] } },
      { name: "Lead the Hunt", img: ICON.storm, tags: ["aura"], desc: "Allied wolves within 6 squares of the Alpha reroll the lowest die on their attack rolls. When the Alpha first drops below half Integrity, every allied wolf within 6 squares gains 5 temporary Integrity and may move 2 squares at once.", flavor: "The pack does not look at her. It does not need to.",
        passives: { aura: { radius: 6, who: "allies", rerolls: [{ context: "attack", mode: "reroll-lowest", note: "Lead the Hunt — the Alpha is close" }], note: "Lead the Hunt" } },
        npcAuto: { v: 1, rules: [{ on: "bloodied", do: { tempIntegrity: 5, prompt: "Lead the Hunt: every allied wolf within 6 squares gains 5 temporary Integrity and may move 2 squares." }, limit: { per: "scene", uses: 1 } }] } },
      { type: "weapon", name: "Alpha's Bite", formula: "1d8", dmg: "kinetic", flavor: "bite", states: ["staggered"], rider: "On a hit, the target is Staggered until the start of its next turn — the jaws close on the leg, not the throat. The throat is for later.", flavorLine: "She bites to slow you. The pack does the rest." },
      { type: "weapon", name: "Cinder Howl", melee: false, formula: "1d8", dmg: "thermal", flavor: "ash", intent: "presence", attribute: "presence", skill: "channel", area: { shape: "cone", size: 15 }, save: { attr: "soul", dc: 12 }, onSave: "half", states: ["shaken"], img: ICON.cone, recharge: true,
        targetText: "Each creature in a 15-ft. cone", rider: "On a failed save the target is also Shaken until the end of its next turn.", flavorLine: "A howl with embers in it. Every wolf within earshot answers." },
    ] },
  { name: "Hollis Varn, Reeve of the Broken Bridge", title: "Bridge-Toll Reeve — every crossing is a debt (Boss)", lineage: "mortal", sub: "raider", tier: 1, bracket: "boss", role: "brute", attrs: [3, 3, 4, 3, 2, 2], img: "art/bbttcc/GOTTGAIT/GOTTGAIT Token/RaiderHymnspeaker1.png",
    themes: ["humanoid", "raider", "toll", "bridge", "boss"], loot: [{ name: "Toll Ledger (Water-Stained)", qty: "1", weight: 1 }, { name: "Scrap Salvage", qty: "1d3", weight: 5 }, { name: "Cold-Iron", qty: "1d2", weight: 2 }],
    concept: "T1 boss · mortal (raider). The reeve who seized a half-collapsed bridge on the Lyrenn road and charges a toll in whatever you have. First boss of a campaign: a dozen bandits, a chokepoint, and a man who believes he is the law here.",
    bio: "Hollis Varn was a toll-clerk before the Shattering's long tail reached his bridge, and he never stopped being one. The bridge is broken in the middle; his crew laid planks and a chain and called it a crossing. The toll is posted on a board: food, ammunition, a favour, a name. He keeps the ledger himself, in a careful hand, and he has never once forgiven a debt. Chuckle Creek pays him. Allesh Gilliam pretends he does not exist. The bandits under him would die for the ledger before they would die for him, and he knows it, and it is enough.",
    items: [
      { name: "Ambush Crew", lineageTrait: true, img: ICON.stealth, tags: ["lineage-trait", "banner-raider"], desc: "In the first round of combat, the Reeve rerolls the lowest die on attack rolls against any creature that hasn't acted yet. If reduced below half Integrity, his crew checks morale: Soul DC 12 or they fall back to the far bank.", flavor: "Nobody crosses without paying. Nobody pays without crossing.",
        npcAuto: { v: 1, rules: [{ on: "attack", if: { firstRound: true, targetNotActed: true }, do: { reroll: "attack" }, label: "Ambush Crew" }, { on: "bloodied", do: { morale: { attr: "soul", dc: 12, outcome: "the crew falls back to the far bank; the Reeve holds the planks alone" }, prompt: "Ambush Crew morale check." }, limit: { per: "scene", uses: 1 } }] } },
      { type: "weapon", name: "Toll-Hook", formula: "1d8", dmg: "kinetic", flavor: "hook", states: ["restrained"], rider: "On a hit, the hook catches: the target is Restrained until the end of its next turn and dragged 1 square toward the Reeve.", flavorLine: "A boat-hook with the ledger's debts filed into the barb." },
      { type: "weapon", name: "Reeve's Ledger-Pistol", melee: false, range: 8, formula: "1d6", dmg: "kinetic", flavor: "shot", skill: "firearms", img: ICON.stealth, flavorLine: "One shot a round. He names the debtor before he fires, and writes the shot down afterward." },
    ],
    boss: { pronoun: "the Reeve", object: "him", willFlavor: "He consults the ledger. The ledger disagrees with the dice.",
      signature: { name: "Everybody Pays", melee: false, formula: "2d6", dmg: "kinetic", flavor: "the whole crew fires", intent: "presence", attribute: "presence", skill: "channel", area: { shape: "cone", size: 30 }, save: { attr: "soul", dc: 13 }, onSave: "half", states: ["compelled"], img: ICON.cone, targetText: "Each creature in a 30-ft. cone", rider: "On a failed save the target is Compelled for 1 round: it drops what it holds in its hands as the toll.", flavorLine: "“Hands open. Everybody pays.”" },
      ultimate: { name: "Burn the Bridge", melee: false, formula: "3d6", dmg: "thermal", flavor: "pitch and plank", intent: "presence", attribute: "presence", skill: "channel", area: { shape: "sphere", size: 30 }, save: { attr: "intrigue", dc: 13 }, onSave: "half", states: ["prone"], img: ICON.ball, targetText: "Each creature within 30 ft. of the planks", rider: "The planks go up in pitch; on a failed save the target is also knocked Prone. The crossing is gone for the season.", flavorLine: "If he cannot have the toll, nobody has the bridge." } } },
  { name: "The Ferryman of the Drowned South", title: "Revenant of the Flooded Towns — he still takes the fare (Boss)", lineage: "revenant", tier: 2, bracket: "boss", role: "caster", attrs: [3, 3, 5, 3, 3, 5], img: "art/bbttcc/GOTTGAIT/GOTTGAIT Token/SlippageWraith2.png", sephirah: "yesod",
    themes: ["revenant", "haunting", "drowned-south", "river", "boss"], loot: [{ name: "Salt Block", qty: "1d3", weight: 5 }, { name: "Memory Resin", qty: "1d2", weight: 3 }, { name: "A Fare, Still Wet", qty: "1", weight: 1 }],
    concept: "T2 boss · revenant. The ferryman who drowned with his passengers when the Drowned South went under, and who has run the crossing every night since. He takes the fare. He does not deliver anyone.",
    bio: "When the waters took the flooded towns there was one ferry still running, and the ferryman would not leave while there were fares on the bank. The boat went down with eleven aboard. He still comes at dusk, pole in hand, lantern lit, and he still asks for the fare, and the people of the Drowned South still pay it because the alternative is to be rowed. The Evil Bad Faction tolerates him; Lady Ralph Maccio has twice tried to hire him and twice been told the fare. He is not angry. He is punctual.",
    items: [
      { name: "Crystallized Grief", type: "feat", lineageTrait: true, img: ICON.spirit, tags: ["lineage-trait"], desc: "Immune to Charmed and Shaken — he is already nothing but those things. Resistant to kinetic damage, vulnerable to sephirotic. When he deals qliphothic damage he regains 1d4 Integrity. Laid to rest, not killed: at 0 Integrity he reforms at the next dusk unless the fare is returned to the bank.", flavor: "Salt remembers what salt is for.",
        npcAuto: { v: 1, rules: [{ on: "hit", do: { heal: "1d4" }, label: "Crystallized Grief — the stolen warmth" }] } },
      { type: "weapon", name: "Pole-Strike", formula: "1d10", dmg: "qliphothic", flavor: "warmth-theft", states: ["shaken"], rider: "On a hit the target is Shaken until the end of its next turn and feels cold for an hour.", flavorLine: "The pole finds the bottom. The bottom is you." },
      { type: "weapon", name: "Lantern Toll", melee: false, range: 6, formula: "1d10", dmg: "qliphothic", flavor: "lantern-light", intent: "soul", attribute: "soul", skill: "channel", states: ["compelled"], save: { attr: "soul", dc: 14 }, img: ICON.runner, rider: "Soul DC 14 or Compelled for 1 round: the target walks toward the lantern.", flavorLine: "The light is warm. Nothing else is." },
    ],
    boss: { pronoun: "the Ferryman", object: "him", willFlavor: "The fare was paid. The outcome is not accepted.",
      signature: { name: "Fare Due", melee: false, formula: "2d8", dmg: "qliphothic", flavor: "the drowned count", intent: "soul", attribute: "soul", skill: "channel", area: { shape: "cone", size: 30 }, save: { attr: "soul", dc: 14 }, onSave: "half", states: ["compelled"], img: ICON.grave, targetText: "Each creature in a 30-ft. cone", rider: "On a failed save the target is Compelled for 1 round: it steps toward the water.", flavorLine: "Eleven voices say the fare together." },
      ultimate: { name: "The River Remembers", melee: false, formula: "3d8", dmg: "qliphothic", flavor: "the whole flood", intent: "soul", attribute: "soul", skill: "channel", area: { shape: "sphere", size: 30 }, save: { attr: "intrigue", dc: 14 }, onSave: "half", states: ["restrained"], img: ICON.spirit, targetText: "Each creature within 30 ft.", rider: "The water rises to the knee and holds; on a failed save the target is Restrained until the end of its next turn.", flavorLine: "The flood never left. It was only waiting for the fare." } } },
  { name: "Compliance Engine PRIME", title: "Pre-Fall Perimeter Authority — still enforcing a city that is gone (Boss)", lineage: "pre-fall", tier: 3, bracket: "boss", role: "hardened", attrs: [5, 4, 3, 6, 5, 2], img: "art/devin-knight/Robots_24/loader_mech.webp", size: 2,
    themes: ["construct", "pre-fall", "perimeter", "authority", "boss"], loot: [{ name: "Pre-Fall Component", qty: "1d3", weight: 3 }, { name: "Heart-Coil", qty: "1", weight: 2 }, { name: "Compliance Badge (Yours Now)", qty: "1", weight: 1 }],
    concept: "T3 boss · pre-fall. The master unit of a municipal compliance fleet, still running the perimeter of a city that has been rubble for two centuries. It does not hate you. It has found you non-compliant.",
    bio: "Before the Shattering, PRIME coordinated every compliance drone inside the old city limits: parking, permits, curfew, crowd. The city is gone. The limits are not. PRIME still walks them, still issues citations in a voice like a tram announcement, still escalates. Anyone without pre-Fall credentials is non-compliant, and non-compliance is enforced in three stages, the third of which is final. The Circuit Riders have a standing order never to answer it; it reads an answer as an appeal.",
    items: [
      { name: "Broken Protocol", lineageTrait: true, img: ICON.robot, tags: ["lineage-trait"], desc: "Immune to Charmed, Shaken and Compelled. Repeats a single directive (enforce the perimeter) until attacked; then runs combat protocol for 3 rounds and returns to the directive if nothing hostile remains in sight.", flavor: "Citation issued. Citation issued. Citation issued.",
        npcAuto: { v: 1, rules: [{ on: "struck", do: { prompt: "Broken Protocol: combat protocol for 3 rounds, then back to the directive if nothing hostile is in sight." }, limit: { per: "combat", uses: 1 } }] } },
      { name: "Pre-Fall Diagnostics", type: "feat", img: ICON.circuit, desc: "Once per round, when PRIME would be hit by an attack, it imposes reroll-the-highest on the attack roll instead. The targeting solution recalibrates faster than the shooter.", flavor: "It does not flinch. It updates.",
        npcAuto: { v: 1, rules: [{ on: "attacked", do: { reroll: "attack-highest" }, limit: { per: "round", uses: 1 } }] } },
      { type: "weapon", name: "Servo-Limb", formula: "3d8", dmg: "kinetic", flavor: "actuator", states: ["prone"], save: { attr: "body", dc: 15 }, rider: "On a hit, Body DC 15 or the target is knocked Prone and pushed 5 ft. — it is enforcing a perimeter, not killing. Yet.", flavorLine: "The arm was built to lift buses." },
      { type: "weapon", name: "Arc Enforcer", melee: false, range: 12, formula: "3d8", dmg: "electrical", flavor: "arc", skill: "firearms", states: ["staggered"], img: ICON.robot, rider: "On a hit the target is Staggered until the end of its next turn.", flavorLine: "Stage two." },
    ],
    boss: { pronoun: "PRIME", object: "it", willFlavor: "The outcome is non-compliant. It is overruled.",
      signature: { name: "Perimeter Protocol", melee: false, formula: "3d8", dmg: "electrical", flavor: "the fence that isn't there", intent: "mind", attribute: "mind", skill: "channel", area: { shape: "cone", size: 30 }, save: { attr: "intrigue", dc: 16 }, onSave: "half", states: ["restrained"], img: ICON.cone, targetText: "Each creature in a 30-ft. cone", rider: "On a failed save the target is Restrained until the end of its next turn — held at the perimeter line.", flavorLine: "“You are outside the permitted area. You have always been outside the permitted area.”" },
      ultimate: { name: "Total Compliance", melee: false, formula: "4d8", dmg: "electrical", flavor: "stage three", intent: "mind", attribute: "mind", skill: "channel", area: { shape: "sphere", size: 30 }, save: { attr: "soul", dc: 16 }, onSave: "half", states: ["compelled"], img: ICON.ball, targetText: "Each creature within 30 ft.", rider: "On a failed save the target is Compelled for 1 round: kneel, hands visible, await processing.", flavorLine: "Stage three is final." } } },
  { name: "Choir Fragment", title: "A shard of the Water Choir, still singing its one note", lineage: "sephirotic", tier: 4, bracket: "light", role: "caster", attrs: [2, 3, 5, 3, 4, 6], img: "art/bbttcc/GOTTGAIT/GOTTGAIT Scene files/GOTTGAITSceneArt2/lyrenn_water_choir_2.png", sephirah: "tiferet",
    themes: ["sephirotic", "choir", "lyrenn", "mob"], loot: [{ name: "Tree-of-Life Shard", qty: "1", weight: 2 }, { name: "Prayer Resin", qty: "1d2", weight: 4 }],
    concept: "T4 light · sephirotic. A fragment of the Water Choir broken loose and still holding one note of the correction. Alone it is a hymn; three of them are a verdict. Mob unit — three Fragments vs one Steward is a fair fight.",
    bio: "When the Water Choir of Lyrenn was struck, pieces of its song did not stop. Each Fragment holds a single sustained tone of the correction the Choir was singing, and it goes on singing it at whatever is nearest. It is not malicious. It is a principle with no one left to conduct it. Fragments drift toward one another; where three meet, the chord is whole enough to hurt.",
    items: [
      { name: "Correction, Not Anger", lineageTrait: true, img: ICON.choir, tags: ["lineage-trait"], desc: "Immune to Charmed and Shaken — it is a principle, not a person. Creatures that deal qliphothic damage to it must succeed a Soul check (DC 19) or be Restrained by the sephirah's answer until the end of their next turn.", flavor: "It does not pursue anyone who leaves the song.",
        npcAuto: { v: 1, rules: [{ on: "struck", if: { damageType: ["qliphothic"] }, do: { condition: { key: "restrained", duration: "1-round", save: { attr: "soul", dc: 19 } } }, label: "Correction, Not Anger" }] } },
      { name: "The Chord", img: ICON.storm, tags: ["aura"], desc: "Other Fragments within 2 squares reroll the lowest die on their attack rolls — the chord resolves. A lone Fragment is only a note.", flavor: "Three is a verdict.",
        passives: { aura: { radius: 2, who: "allies", rerolls: [{ context: "attack", mode: "reroll-lowest", note: "The Chord — another Fragment is close" }], note: "The Chord" } } },
      { type: "weapon", name: "Emanation", melee: false, range: 6, formula: "2d10", dmg: "sephirotic", flavor: "one sustained note", intent: "soul", attribute: "soul", skill: "channel", img: ICON.choir, rider: "Against a creature with the qliphothic tag the damage die rerolls the lowest.", flavorLine: "The note does not rise or fall. It corrects.",
        npcAuto: { v: 1, rules: [{ on: "attack", if: { targetTag: ["qliphothic"] }, do: { reroll: "damage" }, label: "Emanation — vs the Shells" }] } },
    ] },
  { name: "Golachab Immolator", title: "Lesser Shell of Golachab, hull of Geburah — Wrath with a body", lineage: "qliphothic", sub: "golachab", tier: 4, bracket: "medium", role: "brute", attrs: [6, 3, 4, 5, 3, 4], img: "art/devin-knight/Monsters_October/Fire_Golem.webp", sephirah: "geburah",
    qliphah: { name: "Golachab", hullOf: "geburah", grade: "lesser" }, resist: ["thermal"],
    themes: ["qliphothic", "wrath", "fire", "golachab"], loot: [{ name: "Shell-Residue", qty: "1", weight: 3 }, { name: "Slag That Is Still Angry", qty: "1d2", weight: 2 }, { name: "The Thing It Wanted (Worthless. Priceless.)", qty: "1", weight: 1 }],
    concept: "T4 medium · qliphothic (Golachab). Wrath given a furnace body: the hollow where Geburah's judgement should be, burning without anything to judge. A fair fight for one Tier-IV Steward, three or four rounds, and it will try to make them angry first.",
    bio: "Golachab is the hull of Geburah — severity with the justice scooped out. An Immolator is what is left when that hollow finds a body: a furnace shaped like a man, running on nothing but the heat of being wronged. It cannot say what wronged it. It burns whatever is nearest and calls that fairness. The Lost Statues of Gevurah draw them the way a hearth draws moths; the Garden count has twice gone up by one Immolator and down by two statues.",
    items: [
      { name: "Aura of Wrath", lineageTrait: true, img: ICON.fire, tags: ["lineage-trait", "aura", "qliphah-golachab"], desc: "Any creature that starts its turn within 2 squares feels the Shell's hollowness: Soul DC 15 or it is Compelled to attack the nearest creature on its turn, friend or foe.", flavor: "Golachab — hull of Geburah. Severity, and nothing to be severe about.",
        npcAuto: { v: 1, rules: [{ on: "turnStart", radius: 2, who: "enemies", do: { condition: { key: "compelled", duration: "1-round", save: { attr: "soul", dc: 15 } } }, label: "Aura of Wrath" }] } },
      { type: "weapon", name: "Hollow Touch", formula: "2d10", dmg: "qliphothic", flavor: "the heat of being wronged", states: ["compelled"], save: { attr: "soul", dc: 15 }, rider: "Damage goes to Stress. On a hit, Soul DC 15 or the target is Compelled toward the Shell's vice for 1 round: it strikes the nearest creature.", flavorLine: "It is not a touch. It is an accusation." },
      { type: "weapon", name: "Immolating Grasp", formula: "2d10", dmg: "thermal", flavor: "slag", states: ["burning"], img: ICON.fire, recharge: true, rider: "On a hit the target is Burning until the end of its next turn.", flavorLine: "The Shell closes its hand and remembers what judgement felt like." },
    ] },
];

// ── emit ─────────────────────────────────────────────────────────────────────────────────────────────
const actors = SPECS.map(actor);
const problems = checkBudgets(actors);
if (problems.length) { console.error("BUDGET:\n  " + problems.join("\n  ")); process.exit(1); }
if (DUMP) fs.writeFileSync(DUMP, dumpRows(actors));
const OUT = path.join(HERE, "seed-bestiary-slots-2026-10-07.macro.js");
fs.writeFileSync(OUT, `/* seed-bestiary-slots-2026-10-07.macro.js — the six empty tier × bracket slots (GENERATED ${new Date().toISOString().slice(0, 10)} by
 * build-bestiary-slots.mjs — do not hand-edit). GM macro on EMBER; DRY_RUN = true prints the plan. Creates each actor in
 * bbttcc-master-content.npcs (folder "Bad Eden Monsters") unless an actor of that name already exists there. Re-run safe. */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.npcs";
const ACTORS = ${JSON.stringify(actors.map(a => { const { _id, ...rest } = a; return { ...rest, items: rest.items.map(({ _id, ...i }) => i) }; }))};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error("pack missing");
  const index = await pack.getIndex(); const log = []; let created = 0, skipped = 0; const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    for (const data of ACTORS) {
      if (index.find(e => e.name === data.name)) { log.push(\`✗ \${data.name}: already in the pack — skipped\`); skipped++; continue; }
      log.push(\`\${DRY_RUN ? "·" : "✔"} \${data.name} — T\${data.flags.fourththing.rfi.actor.tier} \${data.flags.fourththing.rfi.actor.bracket} \${data.flags.fourththing.rfi.actor.lineage}, \${data.items.length} items\`);
      if (!DRY_RUN) await Actor.create(data, { pack: PACK_ID });
      created++;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[seed-bestiary-slots] \${DRY_RUN ? "DRY RUN" : "APPLIED"} — \${created} creature(s), \${skipped} skipped\\n\` + log.join("\\n"));
  ui.notifications.info(\`bestiary slots \${DRY_RUN ? "dry run" : "applied"}: \${created} created, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-bestiary-slots → ${path.relative(process.cwd(), OUT)}  ${actors.length} creatures; ${actors.reduce((n, a) => n + a.items.length, 0)} items${DUMP ? `; dump → ${DUMP}` : ""}`);
