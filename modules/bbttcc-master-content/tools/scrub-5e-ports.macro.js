/**
 * scrub-5e-ports.macro.js — GM script macro (2026-09-04)
 *
 * Rewrites the fourteen 5e-ported creatures in the NPC Pack's "Bad Eden
 * Monsters" folder into Roll For Initiation vocabulary (BESTIARY_AUDIT §5 #7):
 *
 *   • "+7 to hit … Hit: 16 (2d10+5) piercing" → RFI strike text; flat +N damage
 *     bonuses removed (the faculty already adds); ranges set in squares.
 *   • Legendary Resistance → Fractured Will; Legendary Actions → reactions / bonus
 *     actions; "disadvantage" → reroll-the-highest; grappled → Restrained (escape:
 *     Violence check); stunned / dazed → Staggered; "1/Day" → 1/scene.
 *   • Concept + Signature written into notes / biography where they were blank
 *     (the builder's exemplar prefill reads "Signature." from the bio).
 *   • The seven empty `power` items get real bodies (cost line + effect + flavor)
 *     and correct damage types (they were the retired "energy").
 *   • Renames: "Tier 1 Predator (Scavenger Beast)" → "Scavenger Beast";
 *     "Tier 2 Predator (Wastes Stalker)" → "Wastes Stalker";
 *     "Qlipothic Shambler" → "Qliphothic Shambler".
 *
 * Stat envelopes are NOT touched (Gilbert stays at 161 — owner's call).
 * DRY_RUN = true prints the plan; flip to false to write. Idempotent-ish:
 * re-running re-applies identical text. Pack unlocked / re-locked around writes.
 */
const DRY_RUN = false;
const PACK_ID = "bbttcc-master-content.npcs";
const ROOT_FOLDER = "Bad Eden Monsters";

const P = (s) => `<p>${s}</p>`;
const bio = (concept, signature) => `${P(`<strong>Concept.</strong> ${concept}`)}\n${P(`<strong>Signature.</strong> ${signature}`)}`;
const strike = (reach, formula, type, attr, rider = "", flavor = "") =>
  `${P(`<strong>Strike.</strong> ${reach}, one target. Damage: <code>${formula}</code> ${type} + ${attr}.${rider ? " " + rider : ""}`)}${flavor ? P(`<em>${flavor}</em>`) : ""}`;
const power = ({ concept, effect, clarity, noise, activation, target, range, flavor, mode = "working" }) =>
  `${P(`<strong>${mode.charAt(0).toUpperCase() + mode.slice(1)}.</strong> <em>${concept}</em>`)}\n${P(effect)}\n${P(`<strong>Cost.</strong> ${clarity} Clarity${noise ? `, +${noise} Noise` : ""} · ${activation} · ${target} / ${range}.`)}\n${P(`<em>${flavor}</em>`)}`;

// Per-actor plan. items keyed by CURRENT item name. Fields: name (rename),
// effect, description, formula, type, range {short,long} (squares), tags.
const PLAN = {
  "Road Bandit": {
    notes: "The bottom rung of every raider warband: somebody's cousin with a pipe rifle and a bad plan. Fights in crews, fires early, runs when the crew thins.",
    bio: bio("The bottom rung of every raider warband. Somebody's cousin with a pipe rifle and a bad plan.", "Fires the first shot a full second before anyone told them to."),
    items: {
      "Pipe Rifle": { formula: "1d8", range: { short: 12, long: 36 }, effect: "Salvage rifle. On a hit against a target that hasn't acted yet this combat, the damage die rerolls the lowest.",
        description: strike("range 60/180 ft.", "1d8", "kinetic", "violence", "On a hit against a target that hasn't acted yet this combat, the damage die rerolls the lowest.", "Held together with tape and confidence.") },
      "Shiv": { formula: "1d6", effect: "Sharpened scrap. On a hit against a Prone or Restrained target, +1d4 kinetic.",
        description: strike("reach 5 ft.", "1d6", "kinetic", "violence", "On a hit against a Prone or Restrained target, +1d4 kinetic.", "Nobody's proud of the shiv.") },
      "Ambush Crew": { description: P("In the first round of combat, the bandit rerolls the lowest die on attack rolls against any creature that hasn't taken a turn yet.") },
      "Poor Discipline": { description: P("If reduced below half Integrity, the bandit must succeed a Soul check vs DC 12 at the start of its turn or disengage and move away at full speed.") }
    }
  },
  "Commander Road Bandit": {
    notes: "The one who owns the map. Keeps the crew pointed at the road and the loot pointed at the lockbox. Better shot than the crew, worse nerves than they think.",
    bio: bio("The one who owns the map. Keeps the crew pointed at the road and the loot pointed at the lockbox.", "Shouts the plan loud enough that the party hears it too."),
    items: {
      "Pipe Rifle": { formula: "1d8", range: { short: 12, long: 36 }, effect: "Commander's rifle — better sighted than the crew's. On a hit, one ally bandit within 6 squares may immediately move up to 2 squares as a reaction (the commander's shot is the signal).",
        description: strike("range 60/180 ft.", "1d8", "kinetic", "violence", "On a hit, one ally bandit within 6 squares may immediately move 2 squares as a reaction — the commander's shot is the signal.", "The one rifle in the crew with a real scope.") },
      "Shiv": { formula: "1d6", effect: "Sharpened scrap. On a hit against a Prone or Restrained target, +1d4 kinetic.",
        description: strike("reach 5 ft.", "1d6", "kinetic", "violence", "On a hit against a Prone or Restrained target, +1d4 kinetic.") },
      "Shiv (Offhand)": { formula: "1d6", effect: "Bonus action after a Shiv hit: one more stab, same target. Damage die rerolls the highest (the off hand is the bad hand).",
        description: strike("reach 5 ft.", "1d6", "kinetic", "violence", "Bonus action, only after a Shiv hit this turn, same target. Damage die rerolls the highest.", "The off hand is the bad hand.") },
      "Ambush Crew": { description: P("In the first round of combat, the bandit rerolls the lowest die on attack rolls against any creature that hasn't taken a turn yet.") },
      "Poor Discipline": { name: "Holds the Line (Barely)", description: P("If reduced below half Integrity, the commander must succeed a Soul check vs DC 12 at the start of its turn or order a retreat: every bandit within 6 squares disengages and moves away at full speed.") }
    }
  },
  "Razor Raider": {
    notes: "Warband shock trooper with a chainblade and one grenade. Opens with the grenade, closes with the blade, and follows anyone who drops.",
    bio: bio("Warband shock trooper with a chainblade and one grenade. Opens with the grenade, closes with the blade.", "Revs the chainblade before the fight starts, just so you know."),
    items: {
      "Chainblade": { formula: "1d12", effect: "Chain-driven cleaver. On a hit, the target is Staggered until the start of its next turn; on a critical hit, it is also Prone.",
        description: strike("reach 5 ft.", "1d12", "kinetic", "violence", "On a hit, the target is Staggered until the start of its next turn; on a critical hit, it is also Prone.", "Pull cord. Swing. Repeat until quiet.") },
      "Fragmentation Grenade (1/Day)": { name: "Fragmentation Grenade (1/scene)", effect: "Radius 10 ft. within 60 ft. — targets roll vs Evasion (DC 13). Half damage on success. 1 per scene.",
        description: P("<strong>Area Attack.</strong> Each creature in a 10-ft. radius within 60 ft. rolls <strong>Evasion</strong> vs DC 13. Hit: <code>4d6</code> kinetic + violence; half on success.<br/><em>1 per scene.</em>") + P("<em>Pull pin. Throw. Apologize later.</em>") },
      "Overkill": { description: P("When the raider reduces a creature to 0 Integrity, it may move up to half its speed and make one Chainblade attack as a bonus action.") },
      "Intimidation Pressure": { description: P("At the start of combat, one creature the raider can see within 6 squares must succeed a Soul check vs DC 13 or be Shaken until the end of its next turn.") }
    }
  },
  "Tier 1 Predator (Scavenger Beast)": {
    name: "Scavenger Beast",
    notes: "A dog-sized thing that eats what the Wastes leave behind and, on a bad day, what they haven't finished with yet. Cowardly alone, brave in threes.",
    bio: bio("A dog-sized thing that eats what the Wastes leave behind and, on a bad day, what they haven't finished with yet.", "Circles twice before it commits. Count the circles."),
    items: {
      "Bite": { formula: "1d8", effect: "On a hit against a target below half Integrity, the damage die rerolls the lowest — it can smell the opening.",
        description: strike("reach 5 ft.", "1d8", "kinetic", "violence", "On a hit against a target below half Integrity, the damage die rerolls the lowest — it can smell the opening.") },
      "Skittish": { description: P("If the beast takes damage from a creature it can't see, it immediately moves up to half its speed away without provoking reaction strikes.") }
    }
  },
  "Tier 2 Predator (Wastes Stalker)": {
    name: "Wastes Stalker",
    notes: "The grown version. Hunts ruined interiors in pairs, one to flush and one to finish. Rubble-coloured until it isn't.",
    bio: bio("The grown version. Hunts ruined interiors in pairs, one to flush and one to finish.", "You only ever see the second one."),
    items: {
      "Claws": { formula: "1d10", effect: "On a hit against a Prone target, +1d6 kinetic.",
        description: strike("reach 5 ft.", "1d10", "kinetic", "violence", "On a hit against a Prone target, +1d6 kinetic.") },
      "Ambush Strike": { description: P("If the stalker is hidden from a target when it hits it, the hit deals +2d6 kinetic and the target must succeed a Body check vs DC 13 or be knocked Prone.") },
      "Pack Hunter": { description: P("The stalker rerolls the lowest die on attack rolls against a creature if at least one ally stalker is within 1 square of the target and not Staggered.") },
      "Camouflage": { description: P("The stalker rerolls the lowest die on Intrigue checks to hide in rubble, brush, or ruined interiors.") }
    }
  },
  "Apex Predator": {
    notes: "The thing the Wastes Stalkers are afraid of. A territory has exactly one, and the territory is wherever it is standing. It does not hunt the party; it hunts whatever is bleeding.",
    bio: bio("The thing the Wastes Stalkers are afraid of. A territory has exactly one, and the territory is wherever it is standing.", "Stops eating to watch you. Then goes back to eating."),
    items: {
      "Rending Bite": { formula: "2d10", effect: "On a hit, the target is Restrained in the jaws (escape: Violence check vs DC 15). While a creature is held, the predator's Claws hit it automatically.",
        description: strike("reach 5 ft.", "2d10", "kinetic", "violence", "On a hit, the target is Restrained in the jaws (escape: Violence check vs DC 15). While a creature is held, the predator's Claws hit it automatically.") },
      "Claws": { formula: "2d8", effect: "Two sets. Against a Restrained or Prone target, the damage die rerolls the lowest.",
        description: strike("reach 5 ft.", "2d8", "kinetic", "violence", "Against a Restrained or Prone target, the damage die rerolls the lowest.") },
      "Pounce": { formula: "2d10", effect: "If the predator moves at least 4 squares straight toward a creature and hits it with this attack on the same turn, the target must succeed a Body check vs DC 15 or be knocked Prone. If it is Prone, the predator may make one Claws attack as a bonus action.",
        description: strike("reach 5 ft., after 4+ squares of straight movement", "2d10", "kinetic", "violence", "The target must succeed a Body check vs DC 15 or be knocked Prone. If it is Prone, the predator may make one Claws attack as a bonus action.", "It was already in the air when you noticed it.") },
      "Blood Frenzy": { description: P("The predator rerolls the lowest die on melee attack rolls against any creature that isn't at full Integrity.") },
      "Territorial": { description: P("If a creature ends its turn within 2 squares of the apex predator, the predator may make one Rending Bite against it as a reaction (1/round).") }
    }
  },
  "Slippage Wraith": {
    bio: bio("A person who slipped between moments and came back hungry. It flickers between where it is, where it was, and where the victim wishes it had gone.", "Its footprints arrive after it does."),
    items: {
      "Rift Claw": { formula: "1d8", effect: "The wraith tears the target with displaced time. On a hit, the target cannot take reactions until the start of its next turn.",
        description: strike("reach 5 ft.", "1d8", "psychic", "violence", "Damage goes to Stress. On a hit, the target cannot take reactions until the start of its next turn.", "You feel it a second before it lands, and a second after.") },
      "Slipped Through": { description: P("Reaction, when struck: the wraith displaces 1 square. The attacker briefly forgets which target they aimed at — they reroll the highest die on their next attack roll this exchange.") },
      "Slip the Frame": { description: P("Reaction, when targeted by an attack the wraith can see: it teleports up to 3 squares to an unoccupied space it can see. The triggering attack rerolls the highest die.") },
      "Temporal Afterimage": { description: P("After the wraith moves 2 squares or more, attack rolls against it reroll the highest die until the start of its next turn.") },
      "Unmoored Presence": { description: P("A creature that starts its turn within 2 squares of the wraith must succeed a Soul check vs DC 15 or have its movement reduced by 2 squares until the start of its next turn as local time thickens around it.") },
      "Incorporeal Slip": { description: P("The wraith moves through creatures and objects as if they were difficult terrain. It takes 1d10 kinetic damage if it ends its turn inside an object.") },
      "Frame Drift": { type: "qliphothic", description: power({ concept: "Stop being entirely present.", effect: "Phase the wraith partially out of the current frame. Until the start of its next turn, attackers reroll the highest die on attacks against it; each missed attack costs the attacker 1d6 qliphothic damage to Stress as the slip bleeds back into them.", clarity: 1, noise: 2, activation: "action", target: "self", range: "self", flavor: "The air around it remembers things that didn't happen." }) }
    }
  },
  "Gilbert, Eternally Cleaning Not Leaning Theater Attendant": {
    bio: bio("A panic-wound knot of Qliphothic hospitality protocol, ruined nostalgia, and weaponized customer service, stranded mid-screening when the world broke. Hundreds of guests are arriving any second. Nothing is ever ready.", "The mop is his witness. If shown genuine civic purpose he inverts into a Sephirotic Assistant Manager and the theater reopens."),
    items: {
      "Usher's Broom": { formula: "2d6", type: "kinetic", effect: "Reach 10 ft. On a hit, +2d6 psychic damage to Stress. If the target is standing amid trash, spilled popcorn, loose film, or theater seating, it must succeed an Intrigue check vs DC 15 or fall Prone.",
        description: strike("reach 10 ft.", "2d6", "kinetic", "violence", "On a hit, +2d6 psychic damage to Stress. If the target is standing amid trash, spilled popcorn, loose film, or theater seating, it must succeed an Intrigue check vs DC 15 or fall Prone.", "Sweeps you up with everything else.") },
      "Legendary Resistance (3/Day)": { name: "Fractured Will (3/scene)", description: P("<strong>Passive.</strong> When Gilbert fails a check, the theater's protocol overrides the outcome: he succeeds instead. Three times per scene. Each time, something in the lobby breaks.") },
      "Legendary Action — Spot Clean": { name: "Spot Clean (bonus)", description: P("<strong>Bonus action.</strong> Gilbert moves up to half his speed without provoking reaction strikes, provided he moves toward spilled terrain, rubble, loose objects, or the nearest aesthetically offensive creature.") },
      "Legendary Action — Quiet In The Theater": { name: "Quiet In The Theater (reaction)", description: P("<strong>Reaction, when a creature within 12 squares speaks, shouts, or casts.</strong> That creature must succeed a Body check vs DC 16 or be unable to speak above a whisper — and unable to cast manifestations with a spoken component — until the end of its next turn.") },
      "Weaponized Shame": { effect: "One target within 60 ft. rolls vs Resolve (DC 16). On a failure, the target is rattled until the end of its next turn — it rerolls the highest die on its next attack roll or check." },
      "Not Ready For Guests!": { effect: "Each enemy within 20 ft. rolls vs Resolve (DC 16). Half damage on success. On a failure, the target is also pushed up to 15 ft. Gilbert then gains 15 temporary Integrity. Triggers automatically the first time Gilbert is reduced below half Integrity." },
      "Multiattack": { description: P("Gilbert makes two attacks with Usher's Broom, or one Usher's Broom attack and uses Weaponized Shame.") }
    }
  },
  "Aggressive Sapling Kiddo": {
    bio: bio("An awakened harmony-aspect of the forest, driven violent by refusal. Young, small, and absolutely certain. It does not hate intruders. It corrects them.", "Blooms when it is angry. The petals are the warning."),
    items: {
      "Slam": { description: strike("reach 5 ft.", "1d8", "sephirotic", "violence", "", "A crushing limb strike infused with harmonic force.") },
      "Bloom of Correction": { description: P("Radiant petals erupt in a 3-square radius. Each creature inside rolls vs Resolve (DC 14); on a failure it takes 1d8 sephirotic damage and is Restrained until the start of the Tree Being's next turn.") },
      "Corrective Pulse (recharges on a Soma Break)": { description: P("Creatures of the Tree Being's choice within 6 squares must succeed a Presence check vs DC 14 or be Staggered until the end of their next turn as the forest imposes alignment pressure. Recharges on a Soma Break.") },
      "Harmonic Rejection": { description: P("Creatures that deal qliphothic damage to the Tree Being must succeed a Soul check vs DC 15 or be Restrained by spectral vines until the end of their next turn.") },
      "Bough of Just Sentence": { type: "sephirotic", description: power({ concept: "A bough that interrogates by judgment.", effect: "A luminous bough extends from the bark toward one creature within near range. The target must speak the truest thing they fear; on a failed Resolve check (DC by tier), they take 2d6 sephirotic damage to Stress and are Calmed for one exchange while the tree weighs the answer.", clarity: 2, noise: 1, activation: "action", target: "single", range: "near", flavor: "Bark grows over the wound and sings hymns until they answer." }) }
    }
  },
  "Aggressive Tiferet Tree Person": {
    bio: bio("An awakened harmony-aspect of the forest of Early Tiferet, driven violent by refusal. It corrects intruders at scale, more in disappointment than anger. Blades barely interest it; sephirotic force it drinks like rain.", "Fire is the one argument it truly fears, and it knows you know."),
    items: {
      "Root-Limb Slam": { description: strike("reach 5 ft.", "2d8", "sephirotic", "violence", "", "A crushing limb strike infused with harmonic force.") },
      "Bloom of Correction": { description: P("Radiant petals erupt in a 3-square radius. Each creature inside rolls vs Resolve (DC 16); on a failure it takes 2d8 sephirotic damage and is Restrained until the start of the Tree Being's next turn.") },
      "Corrective Pulse (recharges on a Soma Break)": { description: P("Creatures of the Tree Being's choice within 6 squares must succeed a Presence check vs DC 16 or be Staggered until the end of their next turn as the forest imposes alignment pressure. Recharges on a Soma Break.") },
      "Harmonic Rejection": { description: P("Creatures that deal qliphothic damage to the Tree Being must succeed a Soul check vs DC 16 or be Restrained by spectral vines until the end of their next turn.") },
      "Bough of Just Sentence": { type: "sephirotic", description: power({ concept: "A bough that interrogates by judgment.", effect: "A luminous bough extends from the bark toward one creature within near range. The target must speak the truest thing they fear; on a failed Resolve check (DC by tier), they take 3d6 sephirotic damage to Stress and are Calmed for one exchange while the tree weighs the answer.", clarity: 2, noise: 1, activation: "action", target: "single", range: "near", flavor: "Bark grows over the wound and sings hymns until they answer." }) }
    }
  },
  "Valhaulan Spark Adept": {
    notes: "A Valhaulan hymn-speaker who wired the storm into a hammer. Fights at the front where the ward holds and the vow can hear its target.",
    bio: bio("A Valhaulan hymn-speaker who wired the storm into a hammer. Fights at the front where the ward holds and the vow can hear its target.", "Every miss against them is answered by lightning. They count on it."),
    items: {
      "Radiant Spike": { formula: "2d6", range: { short: 12, long: 12 }, effect: "A thrown spike of storm-bright sephirotic light. On a hit against a target the adept has sworn a Spark Vow against, +1d6 electrical.",
        description: strike("range 60 ft.", "2d6", "sephirotic", "violence", "On a hit against a target the adept has sworn a Spark Vow against, +1d6 electrical.", "It hums the vow on the way in.") },
      "Disorienting Pulse (recharges on a Soma Break)": { description: P("Each creature of the adept's choice within 3 squares must succeed a Soul check vs DC 13 or be disoriented until the end of its next turn: no reaction strikes, and it rolls twice-keep-worse on Mind checks. Recharges on a Soma Break.") },
      "Yesodic Ward": { name: "Hammer-Ward (reaction, 3/scene)", description: P("<strong>Reaction, when hit by an attack.</strong> The adept gains +2 Guard against that attack, which may turn it into a miss. Three times per scene.") },
      "Spark Rite": { description: P("If the adept starts its turn within 2 squares of a Spark (a bound Spark of the Tree in any state), it regains 5 Integrity.") },
      "Hammer-Bright Ward": { type: "electrical", description: power({ mode: "form", concept: "A bright halo around the haft of any weapon.", effect: "While wielding a martial Form, the adept has +1 Guard. While the ward holds, kinetic damage the adept deals counts as electrical.", clarity: 1, noise: 0, activation: "bonus", target: "self", range: "self", flavor: "Sparks crawl up the haft." }) },
      "Spark Vow": { type: "electrical", description: power({ concept: "A martial pact with a sky that keeps score.", effect: "Name a target within far range and speak a vow against them. The next time that target misses an attack against the adept or an ally, lightning answers: it takes 2d8 electrical damage. The vow lasts one scene; only one Spark Vow may be active at a time.", clarity: 2, noise: 1, activation: "action", target: "single", range: "far", flavor: "Ozone smell, and a bell rings somewhere in Valhaul." }) }
    }
  },
  "Lisa Frank Elemental": {
    notes: "An elemental of saturated joy — colour given will and motion. Beautiful, overwhelming, and not remotely safe. Where it walks the air goes glittery and people remember being eight.",
    bio: bio("An elemental of saturated joy — colour given will and motion. Beautiful, overwhelming, and not remotely safe.", "It does not roar. It hums a song you almost recognize, and the song is louder than your name."),
    items: {
      "Chromatic Slam": { formula: "2d8", effect: "A fistful of impossible colour. Damage goes to Stress. On a hit, the target rerolls the highest die on its next damage roll against the Elemental — it is hard to swing meanly at a thing this pretty.",
        description: strike("reach 5 ft.", "2d8", "psychic", "violence", "Damage goes to Stress. On a hit, the target rerolls the highest die on its next damage roll against the Elemental.", "It does not bruise. It dyes.") },
      "Weaponized Whimsy": { description: P("When the Elemental is attacked, it releases a burst of overwhelming colour and affirmation. The attacker must succeed a Soul check vs DC 15 or be Staggered until the end of its next turn.") },
      "Aura of Aggressive Positivity": { description: P("Creatures within 2 squares must succeed a Presence check vs DC 14 at the start of their turn or roll twice-keep-worse on hostile actions against the Elemental until the start of their next turn.") },
      "Weakness: Boredom": { description: P("If ignored for a full round, or if a creature successfully distracts it with a new aesthetic or a sincere compliment, the Elemental is Staggered until the end of its next turn.") },
      "Glitter Aftermath": { description: P("When reduced to 0 Integrity, the Elemental bursts into harmless glitter. Every creature present carries a cosmetic glitter effect that refuses to wash out for the rest of the arc, and rerolls the lowest die on its next Soft Power interaction.") },
      "Rainbow Cascade": { type: "sephirotic", description: power({ concept: "An eruption of impossible colour.", effect: "Release a saturated wave. Each creature within near range makes a Resolve check (DC by tier); on a failure it takes 2d6 sephirotic damage and is Charmed for one exchange — it sees only beauty in the Elemental.", clarity: 2, noise: 1, activation: "action", target: "burst", range: "near", flavor: "Animal silhouettes briefly inhabit the landscape behind the targets — a unicorn, a kitten, a dolphin." }) }
    }
  },
  "Qlipothic Shambler": {
    name: "Qliphothic Shambler",
    bio: bio("A failed growth from the underside of reality: roots, carrion, wet teeth, and apologetic geometry. It drags pieces of the Qliphoth behind it like a torn cloak.", "The smell of a garden that gave up."),
    items: {
      "Grasping Vines": { formula: "1d6", effect: "Snaring roots lash out from underfoot. On a hit, the target is Restrained (escape: Violence check vs DC 14) and pulled up to 2 squares toward the shambler.",
        description: strike("reach 5 ft.", "1d6", "kinetic", "violence", "On a hit, the target is Restrained (escape: Violence check vs DC 14) and pulled up to 2 squares toward the shambler.") },
      "Rot-Branch": { description: strike("reach 5 ft.", "1d6", "qliphothic", "violence", "Damage goes to Stress.", "A splintered limb clubs the target and injects grave-rot.") },
      "Corpse-Root Mass": { description: P("The shambler ignores difficult terrain made of plants, rubble, mud, or remains. A creature that starts its turn Restrained by the shambler takes 1d10 qliphothic damage to Stress.") },
      "Sloughing Filth": { description: P("When the shambler first drops below half Integrity, each hostile creature within 2 squares must succeed a Body check vs DC 14 or take 1d6 poison damage and roll twice-keep-worse on attacks until the end of its next turn.") },
      "Qlipothic Lurch": { name: "Qliphothic Lurch", description: P("If the shambler moves at least 3 squares straight toward a creature and then hits it with Rot-Branch on the same turn, the target must succeed a Body check vs DC 15 or fall Prone.") },
      "Hollow Hunger": { type: "qliphothic", description: power({ concept: "Ambient hunger spilled outward from a wound that never closed.", effect: "The shambler's mouth opens onto a place that isn't here. Each creature within near range makes a Resolve check (DC by tier); on a failure it takes 2d6 qliphothic damage to Stress and is Shaken until the start of its next turn.", clarity: 2, noise: 2, activation: "action", target: "burst", range: "near", flavor: "The room briefly tastes of iron and a memory you didn't have." }) }
    }
  },
  "Jommetry Serpent": {
    notes: "A snake made of angles. It reads the line a strike will take before the strike is thrown, and it is usually somewhere else by then. Harmless until cornered; cornering it is the hard part.",
    bio: bio("A snake made of angles. It reads the line a strike will take before the strike is thrown, and is usually somewhere else by then.", "The room briefly grows a corner that wasn't drawn."),
    items: {
      "Read the Vector": { description: P("<strong>Passive.</strong> Once per scene, the Serpent may reroll the lowest die on one defense check by reading where the strike was going to swing.") },
      "Angle of Arrival": { description: power({ concept: "Travel along a line nobody drew.", effect: "Move along an impossible chord and reappear at any point within near range without provoking reaction strikes. The Serpent's next attack this turn rerolls the lowest die.", clarity: 1, noise: 0, activation: "action", target: "self", range: "near", flavor: "The room briefly grows a corner that wasn't drawn." }) }
    }
  }
};

const TRACK_BY_TYPE = { psychic: "stress", qliphothic: "stress", radiation: "radiation" };

function planActor(a) {
  const plan = PLAN[a.name]; if (!plan) return null;
  const update = {}; const items = []; const notes = [];
  if (plan.name && plan.name !== a.name) { update.name = plan.name; notes.push(`rename → ${plan.name}`); }
  if (plan.notes && String(a.system?.notes ?? "").trim() !== plan.notes) update["system.notes"] = plan.notes;
  if (plan.bio) { update["system.details.biography"] = { value: plan.bio, public: "" }; update["system.description"] = plan.bio; }
  for (const [itemName, ch] of Object.entries(plan.items ?? {})) {
    const it = a.items.find(i => i.name === itemName);
    if (!it) { notes.push(`⚠ item not found: ${itemName}`); continue; }
    const u = { _id: it.id };
    if (ch.name) u.name = ch.name;
    if (ch.effect !== undefined) u["system.effect"] = ch.effect;
    if (ch.description !== undefined) u["system.description.value"] = ch.description;
    if (it.type === "weapon") {
      if (ch.formula !== undefined) u["system.damage.formula"] = ch.formula;
      if (ch.type) { u["system.damage.type"] = ch.type; u["system.damage.track"] = TRACK_BY_TYPE[ch.type] ?? "integrity"; }
      if (ch.range) { u["system.range.short"] = ch.range.short; u["system.range.long"] = ch.range.long; }
    } else if (it.type === "power") {
      if (ch.type) { u["system.damageType"] = ch.type; u["system.damageRoll.type"] = ch.type; u["system.damageRoll.track"] = TRACK_BY_TYPE[ch.type] ?? "integrity"; }
    }
    const tags = Array.isArray(it.system?.tags) ? it.system.tags : [];
    if (!tags.includes("rfi-scrubbed")) u["system.tags"] = [...tags.filter(t => t !== "5e-port"), "rfi-scrubbed"];
    items.push(u);
  }
  const atags = Array.isArray(a.system?.tags) ? a.system.tags : (typeof a.system?.tags === "string" ? a.system.tags.split(",").map(s => s.trim()).filter(Boolean) : []);
  if (!atags.includes("rfi-scrubbed")) update["system.tags"] = [...atags.filter(t => t !== "5e-port"), "rfi-scrubbed"];
  return { update, items, notes };
}

(async () => {
  if (!game.user.isGM) return ui.notifications.warn("Scrub 5e ports: GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications.error(`Scrub 5e ports: pack ${PACK_ID} not found.`);
  const folders = pack.folders;
  const under = (fid) => { let f = folders.get(fid); while (f) { if (f.name === ROOT_FOLDER) return true; f = f.folder; } return false; };
  const docs = (await pack.getDocuments()).filter(d => d.type === "npc" && under(d.folder?.id) && PLAN[d.name]);
  const missing = Object.keys(PLAN).filter(n => !docs.some(d => d.name === n));
  if (missing.length) console.warn("[scrub-5e-ports] not found in pack (already renamed?):", missing);

  const plans = docs.map(a => ({ a, ...planActor(a) }));
  const lines = plans.map(p => `  • ${p.a.name}: ${Object.keys(p.update).length} field(s), ${p.items.length} item(s)${p.notes.length ? " — " + p.notes.join("; ") : ""}`);
  console.log(`[scrub-5e-ports] ${DRY_RUN ? "DRY RUN — would update" : "UPDATING"} ${plans.length} actor(s):\n${lines.join("\n")}`);
  console.log("[scrub-5e-ports] full plans:", plans.map(p => ({ name: p.a.name, update: p.update, items: p.items })));
  if (DRY_RUN) { ui.notifications.warn(`Scrub 5e ports: DRY RUN — ${plans.length} actor(s) would change. See console (F12). Set DRY_RUN=false to apply.`); return; }

  const wasLocked = pack.locked; if (wasLocked) await pack.configure({ locked: false });
  let ok = 0, failed = 0;
  try {
    for (const p of plans) {
      try {
        if (p.items.length) await p.a.updateEmbeddedDocuments("Item", p.items);
        if (Object.keys(p.update).length) await p.a.update(p.update);
        ok++;
      } catch (e) { failed++; console.warn("[scrub-5e-ports] failed", p.a.name, e); }
    }
  } finally { if (wasLocked) await pack.configure({ locked: true }); }
  ui.notifications.info(`Scrub 5e ports: updated ${ok}/${plans.length} actor(s)${failed ? ` (${failed} failed — see console)` : ""}.`);
})();
