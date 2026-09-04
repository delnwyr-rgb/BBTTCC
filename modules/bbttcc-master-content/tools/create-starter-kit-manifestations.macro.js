// Bad Eden — Starter Manifestation Kits (2026-09-01)
// ─────────────────────────────────────────────────────────────────────────────
// 81 path/doctrine starter manifestations: every path+doctrine combo gets a
// basic kit granted at character creation (and via the sheet's "+ Apply Path
// Features" button for existing stewards).
//   • Non-TCC paths (Bulwark, Aurablade, Soul-Smith, Harmony Marshal,
//     Shadow Courier): 2 path-core + 1 doctrine signature → 3 per combo.
//     All Forms (sustained/bound/enduring) — non-TCCs cannot cast Workings.
//   • TCC paths (Cosmic Linguist, Pactkeeper, Dreamwalker, Wyrdlens Adept):
//     5 path-core + 3 doctrine signatures → 8 per combo, instant Workings
//     front and center.
//
// All items land in `bbttcc-master-content.items` under the folder
// "Starter Kits — Path Manifestations", stamped with:
//   flags.fourththing.starterKit = { path, doctrine, core }
// which is what game.fourththing._progression.grantStarterManifestations
// matches on (path = class identifier, doctrine = subclass identifier or ""
// for path-core items).
//
// Idempotent — re-running skips items that already exist by name unless
// FORCE_CREATE = true. Paste into a Script Macro and run as GM. Requires the
// fourththing system (uses game.fourththing.createManifestationItemData).
// Lints before writing: aborts if any non-TCC spec is "instant" or any combo
// doesn't total exactly 3 (non-TCC) / 8 (TCC).
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user.isGM) {
    ui.notifications?.error("GM only — this macro authors compendium content.");
    return;
  }

  const PACK_ID      = "bbttcc-master-content.items";
  const FOLDER_NAME  = "Starter Kits — Path Manifestations";
  const DRY_RUN      = false;
  const FORCE_CREATE = false;

  const builder = game?.fourththing?.createManifestationItemData;
  if (typeof builder !== "function") {
    ui.notifications?.error("fourththing.createManifestationItemData not loaded — reload Foundry after system update.");
    return;
  }

  const pack = game.packs?.get?.(PACK_ID);
  if (!pack) {
    ui.notifications?.error(`Pack not found: ${PACK_ID}`);
    return;
  }

  // Ensure folder exists inside the compendium.
  let folder = (pack.folders?.contents ?? []).find(f => f.name === FOLDER_NAME) ?? null;
  if (!folder && !DRY_RUN) {
    folder = await Folder.create({ name: FOLDER_NAME, type: "Item", color: "#2a6f8a" }, { pack: PACK_ID });
  }

  // Index existing items in the pack (idempotency).
  const index = await pack.getIndex();
  const existingByName = new Map(index.map(e => [e.name, e]));

  // ── SPEC HELPERS ──────────────────────────────────────────────────────────
  // dmg(n, "dX", type, track, attribute, flavor) → damageRoll; dmg(0) → none.
  const dmg = (number, die, type, track, attribute = "intrigue", flavor = "") => {
    if (!number || !die) return { op: "none", number: 0, die: "d6", attribute: "", type: "kinetic", flavor: "", track: "integrity" };
    return { op: "damage", number, die, attribute, type, flavor, track };
  };
  // states(["shaken"], { duration, saveEachRound, saveAttribute }) → appliedStates.
  const states = (keys, opts = {}) => ({
    states: keys,
    duration:      opts.duration ?? "1-round",
    saveEachRound: opts.saveEachRound ?? false,
    saveAttribute: opts.saveAttribute ?? "soul",
    saveDcMode:    "cast-dc",
    saveDcFixed:   15,
    saveAttributeOverrides: opts.saveAttributeOverrides ?? {}
  });
  // wards([["guard","+",2]]) → buff/ward appliedEffects (explicit op per row).
  const wards = (triples = []) => ({
    modifiers: triples.map(([stat, op, value]) => ({ stat, op, value })),
    resists: [], immunes: []
  });
  // debuffs([["evasion",2]]) → negative appliedEffects on the target.
  const debuffs = (pairs = []) => ({
    modifiers: pairs.map(([stat, value]) => ({ stat, op: "-", value })),
    resists: [], immunes: []
  });

// Starter-kit specs — non-TCC paths (25)
const SPECS_NONTCC = [

  // ══════════════════════════════════════════════════════════════════════════
  // BULWARK — the wall that chose you back
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "Borrowed Bastion",
    kind: "weapon", path: "bulwark", doctrine: "", tier: 1,
    form: "weapon", func: "harm", stability: "bound", interactionModel: "weapon",
    intent: "violence", category: "melee", skill: "melee",
    damageFormula: "2d6", damageType: "kinetic", damageTrack: "integrity",
    rangeShort: 1, rangeLong: 1,
    sephirah: "gevurah", channel: "body",
    appliedStates: states(["staggered"], { saveAttribute: "body" }),
    concept: "A door-sized section of brutalist wall from a building that never existed, worn on the forearm. It has strong opinions about standing between you and things.",
    effect: "Melee attack: 2d6 kinetic (integrity). On hit: Body defense vs Cast DC or Staggered for 1 round.",
    flavor: "Somewhere a building is missing this. The building has learned to live with loss. Your enemies won't.",
    tags: ["starter-kit", "weapon", "cc"]
  },
  {
    name: "Wall of My People",
    kind: "power", path: "bulwark", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "field", func: "protect", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area",
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    area: { shape: "sphere", size: 30 },
    maintenanceKey: "1-clarity-scene",
    concept: "The names of everyone you're protecting settle over the ground like poured foundation. Allies inside stand behind all of them at once.",
    effect: "Sustained zone (30-ft sphere): allies inside gain Guard +2 for the scene. Upkeep 1 Clarity per scene.",
    flavor: "It's not a metaphor. It's masonry with a mailing list.",
    tags: ["starter-kit", "ward", "aoe"]
  },
  {
    name: "Pressure Front",
    kind: "power", path: "bulwark", doctrine: "bbttcc-bulwark-avalanche", tier: 1,
    intent: "violence", channel: "body", sephirah: "gevurah",
    form: "field", func: "harm", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "action", target: "area",
    damageRoll: dmg(1, "d6", "kinetic", "integrity", "violence", "advancing weight"),
    appliedStates: states(["prone"], { saveAttribute: "body" }),
    area: { shape: "cone", size: 15 },
    concept: "You carry the exact moment an avalanche decides. Point it somewhere.",
    effect: "Release the front in a 15-ft cone: 1d6 kinetic (integrity), and each target saves Body vs Cast DC or is knocked Prone.",
    flavor: "Snow doesn't hate anyone. That's what makes it so good at this.",
    tags: ["starter-kit", "aoe", "cc"]
  },
  {
    name: "Keystone Verdict",
    kind: "power", path: "bulwark", doctrine: "bbttcc-bulwark-cataclyst", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "binah",
    form: "sigil", func: "harm", stability: "sustained", interactionModel: "mark",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "kinetic", "integrity", "intrigue", "the one brick that mattered"),
    appliedEffects: debuffs([["guard", 2]]),
    concept: "Every structure has the one brick holding the argument together. You circle it in chalk that was never chalk.",
    effect: "Mark the load-bearing point of a target within 30 ft: 1d6 kinetic (integrity) and Guard −2 for the scene while the mark holds.",
    flavor: "Everything is load-bearing if you're honest about it. Most people aren't. Walls never are.",
    tags: ["starter-kit", "debuff", "mark"]
  },
  {
    name: "The Ground Remembers You",
    kind: "power", path: "bulwark", doctrine: "bbttcc-bulwark-mountain", tier: 1,
    intent: "presence", channel: "body", sephirah: "malkuth",
    form: "vestment", func: "protect", stability: "enduring", interactionModel: "worn",
    scale: "personal", duration: "persistent", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 1], ["resolve", "+", 1]]),
    concept: "You introduce yourself to the bedrock, formally, once. After that it counts you as terrain.",
    effect: "Enduring vestment (self): Guard +1 and Resolve +1. The ground counts you as terrain — forced movement against your will fails.",
    flavor: "Mountains don't win arguments. They just outlast everyone who had one.",
    tags: ["starter-kit", "ward", "stance"]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // AURABLADE — choose your edge
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "Mercy's Edge",
    kind: "weapon", path: "aurablade", doctrine: "", tier: 1,
    form: "weapon", func: "harm", stability: "bound", interactionModel: "weapon",
    intent: "presence", category: "melee", skill: "melee",
    damageFormula: "1d6", damageType: "psychic", damageTrack: "stress",
    rangeShort: 1, rangeLong: 1,
    sephirah: "chesed", channel: "soul",
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    concept: "A blade of pale aura that cuts between a person and their worst intentions. Flesh unmarked; fight removed.",
    effect: "Melee attack with Presence: 1d6 psychic (stress). On hit: Soul defense vs Cast DC or Shaken for 1 round. Leaves no wound — only the memory of having been spared.",
    flavor: "The most upsetting thing you can do to some people is decline to kill them. Loudly.",
    tags: ["starter-kit", "weapon", "nonlethal"]
  },
  {
    name: "Wrath-Brand",
    kind: "weapon", path: "aurablade", doctrine: "", tier: 1,
    form: "weapon", func: "harm", stability: "bound", interactionModel: "weapon",
    intent: "violence", category: "melee", skill: "melee",
    damageFormula: "2d6", damageType: "energy", damageTrack: "integrity",
    rangeShort: 1, rangeLong: 1,
    sephirah: "gevurah", channel: "body",
    appliedStates: states(["burning"], { saveAttribute: "body" }),
    concept: "The same aura, run hot — a brand of righteous heat that says the quiet part with fire.",
    effect: "Melee attack: 2d6 energy (integrity). On hit: Body defense vs Cast DC or Burning for 1 round.",
    flavor: "Mercy has a sibling. The sibling does not get invited to things, for reasons about to be demonstrated.",
    tags: ["starter-kit", "weapon", "fire"]
  },
  {
    name: "Hymn of the Open Vein",
    kind: "power", path: "aurablade", doctrine: "bbttcc-aurablade-blood-hymn", tier: 1,
    intent: "presence", channel: "body", sephirah: "gevurah",
    form: "rite", func: "protect", stability: "sustained", interactionModel: "mark",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["resolve", "+", 2]]),
    maintenanceKey: "1-stress-scene",
    concept: "The old war-hymn only sings in a voice that's bleeding. You provide the voice. It provides everything else.",
    effect: "Sustained self-rite: Resolve +2 for the scene. Upkeep 1 Stress per scene — the hymn is paid in your own blood.",
    flavor: "All the best songs cost somebody something. This one just skips the middleman.",
    tags: ["starter-kit", "ward", "blood"]
  },
  {
    name: "Breath Before the Cut",
    kind: "power", path: "aurablade", doctrine: "bbttcc-aurablade-stillheart", tier: 1,
    intent: "presence", channel: "mind", sephirah: "binah",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 1], ["initiative", "+", 1]]),
    concept: "You put on the stillness like a coat. Your pulse does not rise. Your blade does not hurry. It doesn't have to.",
    effect: "Sustained vestment (self): Evasion +1 and Initiative +1 for the scene.",
    flavor: "Everyone else brought adrenaline. You brought punctuality.",
    tags: ["starter-kit", "ward", "stance"]
  },
  {
    name: "The Unstitching",
    kind: "power", path: "aurablade", doctrine: "bbttcc-aurablade-void-edge", tier: 1,
    intent: "intrigue", channel: "soul", sephirah: "keter",
    form: "sigil", func: "harm", stability: "sustained", interactionModel: "mark",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d4", "psychic", "stress", "intrigue", "the snip"),
    appliedEffects: debuffs([["resolve", 2]]),
    concept: "The Void Edge doesn't cut things. It cuts the stitch between things — a target and the certainty it was leaning on.",
    effect: "Target within 30 ft: 1d4 psychic (stress) and Resolve −2 for the scene, as one thread they were leaning on is snipped.",
    flavor: "Everything is attached to something. Mal recommends not asking what YOU'RE attached to. Too late.",
    tags: ["starter-kit", "debuff", "mark"]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SOUL-SMITH — everything can be mended, some things loudly
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "Hearth-Nail Covenant",
    kind: "power", path: "soul-smith", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "yesod",
    form: "rite", func: "protect", stability: "sustained", interactionModel: "structure",
    scale: "scene", duration: "scene", target: "area",
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    area: { shape: "sphere", size: 15 },
    maintenanceKey: "1-clarity-scene",
    concept: "Drive one true nail into a room and it becomes a place. Places hold together — including the people in them.",
    effect: "Consecrate a room or camp (15-ft sphere): allies inside gain Guard +2 for the scene. Upkeep 1 Clarity per scene.",
    flavor: "Home is where somebody hammered a nail in on purpose. That's it. That's the whole secret.",
    tags: ["starter-kit", "ward", "aoe"]
  },
  {
    name: "Anvil Stance",
    kind: "weapon", path: "soul-smith", doctrine: "", tier: 1,
    form: "weapon", func: "harm", stability: "bound", interactionModel: "weapon",
    intent: "violence", category: "melee", skill: "melee",
    damageFormula: "1d6", damageType: "kinetic", damageTrack: "integrity",
    rangeShort: 1, rangeLong: 1,
    sephirah: "tiferet", channel: "body",
    appliedStates: states(["staggered"], { saveAttribute: "body" }),
    concept: "Your stance becomes the anvil. Whatever you strike is, briefly, the workpiece.",
    effect: "Melee attack: 1d6 kinetic (integrity), ground-driven. On hit: Body defense vs Cast DC or Staggered for 1 round.",
    flavor: "The hammer isn't the important part. The hammer was never the important part. Don't tell the hammer.",
    tags: ["starter-kit", "weapon", "cc"]
  },
  {
    name: "Repaired Memory",
    kind: "power", path: "soul-smith", doctrine: "bbttcc-soul-smith-smith-bound-light", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "single",
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    concept: "Take one of their good memories — a birthday that went fine, a door held open — and forge it into plate. Hammered light, worn as armor.",
    effect: "Touch an ally: they gain Guard +2 for the scene as one good memory is forged into a breastplate.",
    flavor: "Nostalgia, but load-rated.",
    tags: ["starter-kit", "ward", "ally"]
  },
  {
    name: "Victory's Down Payment",
    kind: "weapon", path: "soul-smith", doctrine: "bbttcc-soul-smith-smith-victory", tier: 1,
    form: "weapon", func: "harm", stability: "bound", interactionModel: "weapon",
    intent: "violence", category: "melee", skill: "melee",
    damageFormula: "2d6", damageType: "sephirotic", damageTrack: "integrity",
    rangeShort: 1, rangeLong: 1,
    sephirah: "netzach", channel: "body",
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    concept: "A weapon forged from a victory you haven't won yet, released to you early, on credit.",
    effect: "Melee attack: 2d6 sephirotic (integrity). On hit: Soul defense vs Cast DC or Shaken for 1 round — the target glimpses how this ends.",
    flavor: "It's not a trophy if you take it before the win. Except this one. The paperwork went through.",
    tags: ["starter-kit", "weapon", "morale"]
  },
  {
    name: "Reliquary Vow",
    kind: "power", path: "soul-smith", doctrine: "bbttcc-soul-smith-smith-spark-reclaimer", tier: 1,
    intent: "presence", channel: "soul", sephirah: "yesod",
    form: "rite", func: "protect", stability: "enduring", interactionModel: "mark",
    scale: "personal", duration: "persistent", target: "single",
    damageRoll: dmg(0),
    appliedEffects: wards([["resolve", "+", 2]]),
    concept: "Salvage something broken — a hinge, a locket, a promise — and bind a vow into it. It is now a relic. Relics keep their people.",
    effect: "Enduring rite: bind a vow into a salvaged relic. Its bearer gains Resolve +2 while the vow is kept.",
    flavor: "One man's trash is another man's holy artifact with a warranty written in oath-language.",
    tags: ["starter-kit", "ward", "relic"]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // HARMONY MARSHAL — the adult in the room, cosmically licensed
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "Measured Breath Accord",
    kind: "power", path: "harmonymarshal", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "tiferet",
    form: "field", func: "command", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area",
    damageRoll: dmg(0),
    appliedStates: states(["calmed"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    area: { shape: "sphere", size: 30 },
    maintenanceKey: "1-clarity-scene",
    concept: "The room is set to one lawful breath. Chaos may proceed, but it pays rent, in advance, at the counter.",
    effect: "Sustained zone (30-ft sphere): hostiles inside save Soul vs Cast DC each round or are Calmed until they save. Upkeep 1 Clarity per scene.",
    flavor: "In, two three four. Out, two three four. Riots are just breathing that got ahead of itself.",
    tags: ["starter-kit", "aoe", "cc"]
  },
  {
    name: "Marshal's Mantle",
    kind: "power", path: "harmonymarshal", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 1], ["resolve", "+", 1]]),
    concept: "A mantle of visible jurisdiction. People can tell you're the adult in the room. So can the room.",
    effect: "Sustained vestment (self): Guard +1 and Resolve +1 for the scene.",
    flavor: "Authority is 90% posture, 9% laundry, and 1% cosmic mandate. The mantle handles the laundry.",
    tags: ["starter-kit", "ward", "stance"]
  },
  {
    name: "Everyone Gets A Chair",
    kind: "power", path: "harmonymarshal", doctrine: "bbttcc-harmony-marshal-marshal-accord", tier: 1,
    intent: "presence", channel: "mind", sephirah: "chesed",
    form: "construct", func: "command", stability: "sustained", interactionModel: "structure",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["compelled"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "A chair that wasn't there, and now insists. Negotiation begins whether or not anyone scheduled it.",
    effect: "Target within 30 ft: Soul defense vs Cast DC each round or Compelled — they must sit, parley, and take no hostile action until they save.",
    flavor: "You can't stay mad in a chair with lumbar support. This is documented.",
    tags: ["starter-kit", "cc", "parley"]
  },
  {
    name: "Lucid Standard",
    kind: "power", path: "harmonymarshal", doctrine: "bbttcc-harmony-marshal-marshal-overwatch", tier: 1,
    intent: "presence", channel: "mind", sephirah: "binah",
    form: "construct", func: "protect", stability: "sustained", interactionModel: "structure",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 2]]),
    concept: "Plant the standard and keep watch. Under your sightline, an ally is very hard to surprise, because you already weren't.",
    effect: "Plant the standard: one ally you can see within 30 ft gains Evasion +2 for the scene, so long as you can see them.",
    flavor: "Being watched by someone who likes you: statistically the best armor nobody sells.",
    tags: ["starter-kit", "ward", "ally"]
  },
  {
    name: "Cadence Standard",
    kind: "power", path: "harmonymarshal", doctrine: "bbttcc-harmony-marshal-marshal-resolve", tier: 1,
    intent: "presence", channel: "body", sephirah: "netzach",
    form: "echo", func: "protect", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area",
    damageRoll: dmg(0),
    appliedEffects: wards([["resolve", "+", 2]]),
    area: { shape: "sphere", size: 20 },
    maintenanceKey: "1-clarity-scene",
    concept: "A marching cadence that keeps counting whether or not anyone is marching. The line holds to the beat.",
    effect: "Sustained cadence (20-ft sphere): allies inside gain Resolve +2 for the scene while the beat holds. Upkeep 1 Clarity per scene.",
    flavor: "Left. Left. Left, right, left. Congratulations: you are now unbreakable, and slightly annoying.",
    tags: ["starter-kit", "ward", "aoe"]
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SHADOW COURIER — the route is sacred, the paperwork is negotiable
  // ══════════════════════════════════════════════════════════════════════════
  {
    name: "Threshold Cloak",
    kind: "power", path: "shadow_courier", doctrine: "", tier: 1,
    intent: "intrigue", channel: "body", sephirah: "yesod",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 2]]),
    concept: "You are dressed in the moment just before a door opens. That moment is famously hard to hit.",
    effect: "Sustained vestment (self): Evasion +2 for the scene.",
    flavor: "Nobody looks at a doorway. They look at what comes through it. Be the doorway.",
    tags: ["starter-kit", "ward", "stealth"]
  },
  {
    name: "Wayhound Companion",
    kind: "power", path: "shadow_courier", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "construct", func: "harm", stability: "sustained", interactionModel: "companion",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "kinetic", "integrity", "intrigue", "phantom bite"),
    appliedStates: states(["restrained"], { saveAttribute: "body" }),
    concept: "A hound made of every shortcut you've ever taken. It knows the way, and it knows how to hold a stranger's ankle about it.",
    effect: "Summon the Wayhound for the scene. It harries a target within 30 ft: 1d6 kinetic (integrity), and Body defense vs Cast DC or Restrained for 1 round.",
    flavor: "Good boy. Technically a metaphor. Still a good boy.",
    tags: ["starter-kit", "companion", "cc"]
  },
  {
    name: "The Unlisted Stair",
    kind: "power", path: "shadow_courier", doctrine: "bbttcc-shadow-courier-courier-black-stair", tier: 1,
    intent: "intrigue", channel: "body", sephirah: "binah",
    form: "gate", func: "move", stability: "sustained", interactionModel: "structure",
    scale: "personal", duration: "turn", target: "self", rangeFt: 30,
    damageRoll: dmg(0),
    concept: "A service stairwell that isn't on anyone's plans, connecting here to there. Management doesn't know about it. Management never will.",
    effect: "Sustained gate: a stair connects your position to a spot within 30 ft — across a gap, up a wall, past a barrier. You (and one guest you lead) may climb it; it declines to exist for anyone else.",
    flavor: "Every building has one stairwell management doesn't know about. Every building. Yes, that one. Especially that one.",
    tags: ["starter-kit", "movement", "route"]
  },
  {
    name: "Signed On Delivery",
    kind: "power", path: "shadow_courier", doctrine: "bbttcc-shadow-courier-courier-last-mile", tier: 1,
    intent: "intrigue", channel: "body", sephirah: "malkuth",
    form: "sigil", func: "protect", stability: "enduring", interactionModel: "mark",
    scale: "personal", duration: "persistent", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    concept: "Declare the parcel — object, message, or person under escort — and the route itself countersigns. The route wants what you're carrying to arrive.",
    effect: "Enduring mark: declare one carried parcel. While you carry it toward its recipient, Guard +2. The mark fades on delivery — deliveries do not fade.",
    flavor: "The route cares about the package arriving. Whether YOU arrive is a separate line item.",
    tags: ["starter-kit", "ward", "delivery"]
  },
  {
    name: "Passphrase: Please",
    kind: "power", path: "shadow_courier", doctrine: "bbttcc-shadow-courier-courier-wayfarer-tongue", tier: 1,
    intent: "presence", channel: "mind", sephirah: "hod",
    form: "gate", func: "command", stability: "sustained", interactionModel: "event",
    scale: "personal", duration: "action", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["charmed"], { saveAttribute: "soul" }),
    concept: "The courtesy every door was raised on, spoken in the old tongue. Doorkeepers remember their manners. So do locks.",
    effect: "A doorkeeper (or a lock's lingering spirit) within 30 ft: Soul defense vs Cast DC or Charmed for 1 round — it wants to let you through. Mundane locks simply feel appreciated, and open.",
    flavor: "'Please' is a skeleton key. Mal has been saying this for nine hundred years. Nobody writes it down.",
    tags: ["starter-kit", "cc", "parley", "doors"]
  }
];
// Starter-kit specs — Cosmic Linguist + Pactkeeper (28)
const SPECS_CL_PK = [

  // ═══════════════════════════════════════════════════════════════════════════
  // COSMIC LINGUIST — path core (5; 3 instant Workings + 2 forms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Margin Note: Not Yet",
    kind: "power", path: "cosmic_linguist", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "binah",
    form: "sigil", func: "command", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["staggered"], { saveAttribute: "mind" }),
    concept: "You jot a small editorial note in the air beside an event that is happening too soon. The universe, embarrassed, agrees to circle back.",
    effect: "One target within 30 ft: Mind defense vs Cast DC. On fail: Staggered (movement halved, −2 attacks) for 1 round while causality re-reads the paragraph.",
    flavor: "Mal: 'The cosmos respects exactly one thing, and it's a correction politely worded.'",
    tags: ["starter-kit", "instant", "cc", "reused"]
  },
  {
    name: "Footnote",
    kind: "power", path: "cosmic_linguist", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "hod",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d4", "psychic", "stress", "intrigue", "a small, devastating citation"),
    appliedStates: states(["shaken"], { saveAttribute: "mind" }),
    concept: "A tiny superscript numeral appears over the target's head. They become unbearably aware there is a note about them, at the bottom, in smaller print.",
    effect: "One target within 30 ft takes 1d4 psychic (stress); Mind defense vs Cast DC or Shaken for 1 round.",
    flavor: "Mal: 'Nobody reads the footnotes. That's what makes them load-bearing.'",
    tags: ["starter-kit", "instant", "stress", "reused"]
  },
  {
    name: "Strikethrough",
    kind: "power", path: "cosmic_linguist", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "gevurah",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "psychic", "stress", "intrigue", "one load-bearing word, deleted"),
    appliedStates: states(["shaken"], { saveAttribute: "mind" }),
    concept: "You draw one clean horizontal line through a word the target was standing on — 'inevitable,' usually. The sentence sags.",
    effect: "One target within 30 ft takes 1d6 psychic (stress); Mind defense vs Cast DC or Shaken for 1 round.",
    flavor: "Mal: 'It's still legible under the line. That's the cruel part. They can see what they used to mean.'",
    tags: ["starter-kit", "instant", "stress", "reused"]
  },
  {
    name: "Italic Emphasis",
    kind: "power", path: "cosmic_linguist", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "tiferet",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["resolve", "+", 2]]),
    concept: "You set yourself in italics. Everything you say and do leans forward slightly, and the world takes it as intended.",
    effect: "You (or one touched ally) gain Resolve +2 for the scene while emphatically slanted.",
    flavor: "Mal: 'You can tell they mean it. Typographically.'",
    tags: ["starter-kit", "ward", "reused"]
  },
  {
    name: "Living Glossary",
    kind: "power", path: "cosmic_linguist", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "hod",
    form: "construct", func: "reveal", stability: "sustained", interactionModel: "companion",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    maintenanceKey: "1-clarity-scene",
    damageRoll: dmg(0),
    appliedStates: states(["compelled"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "A small floating book follows you and loudly defines every term your enemy uses. It has opinions about their word choices. It cites sources.",
    effect: "Companion construct for the scene (1 Clarity/scene upkeep). One target within 30 ft: Soul defense vs Cast DC each round or Compelled — they must argue with the glossary instead of acting freely, until they save.",
    flavor: "Mal: '\"Ambush, noun: see also — oh, they're already mad. Good, it's working.\"'",
    tags: ["starter-kit", "companion", "cc", "reused"]
  },

  // ─── Cosmic Linguist › Annotator (3) ──────────────────────────────────────
  {
    name: "Marginalia Drift",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-annotator", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "binah",
    form: "sigil", func: "bind", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["restrained"], { saveAttribute: "body" }),
    concept: "Your accumulated margin-notes peel off their pages and swarm the target, cross-referencing them into place. Asterisks around the ankles. Daggers at the cuffs.",
    effect: "One target within 30 ft: Body defense vs Cast DC. On fail: Restrained for 1 round, pinned under commentary.",
    flavor: "Mal: 'Death by a thousand annotations. Well. Inconvenience by forty of them.'",
    tags: ["starter-kit", "instant", "cc", "reused"]
  },
  {
    name: "Citation Needed",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-annotator", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "hod",
    form: "sigil", func: "reveal", stability: "sustained", interactionModel: "mark",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: debuffs([["resolve", 2]]),
    appliedStates: states([], { duration: "scene", saveAttribute: "mind" }),
    concept: "A glowing bracketed tag hangs over the target's head, flagging their entire posture as an unsupported claim. Everyone can see it. Everyone judges.",
    effect: "One target within 30 ft is marked for the scene: Resolve −2 while their confidence remains unsourced.",
    flavor: "Mal: 'Their whole personality just got flagged for review. I've been saying this for years.'",
    tags: ["starter-kit", "debuff", "mark"]
  },
  {
    name: "Errata Slip",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-annotator", tier: 1,
    intent: "presence", channel: "mind", sephirah: "binah",
    form: "sigil", func: "repair", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 1], ["resolve", "+", 1]]),
    concept: "You issue a small official correction to an ally: 'For \"doomed,\" read \"fine.\"' Reality, sheepish about the typo, complies.",
    effect: "One ally within 30 ft gains Guard +1 and Resolve +1 for the scene, as corrected.",
    flavor: "Mal: 'The previous edition of you contained errors. This one's been fixed. Mostly.'",
    tags: ["starter-kit", "ward", "support"]
  },

  // ─── Cosmic Linguist › Metaphor Apostle (3) ───────────────────────────────
  {
    name: "Tied Up At The Moment",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-metaphor-apostle", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "echo", func: "bind", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["restrained"], { saveAttribute: "body" }),
    concept: "You observe, mildly, that the target seems tied up right now. The figure of speech takes this as instructions.",
    effect: "One target within 30 ft: Body defense vs Cast DC. On fail: Restrained for 1 round by an entirely rhetorical rope.",
    flavor: "Mal: 'The rope isn't real. Their schedule conflict, however, is now very literal.'",
    tags: ["starter-kit", "instant", "cc"]
  },
  {
    name: "The Weight Of The World",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-metaphor-apostle", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "echo", func: "harm", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "psychic", "stress", "intrigue", "everything, briefly, on their shoulders"),
    appliedStates: states(["staggered"], { saveAttribute: "body" }),
    concept: "For one second, the target carries the weight of the world. Not the planet — the idiom. It is heavier.",
    effect: "One target within 30 ft takes 1d6 psychic (stress); Body defense vs Cast DC or Staggered for 1 round under the load.",
    flavor: "Mal: 'Atlas shrugged. This guy buckled. There's a lesson in there about stretching first.'",
    tags: ["starter-kit", "instant", "stress"]
  },
  {
    name: "Thick Skin, Literally",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-metaphor-apostle", tier: 1,
    intent: "presence", channel: "body", sephirah: "chesed",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    concept: "You compliment an ally on being thick-skinned, and the metaphor settles over them like a well-worn duster: insults and shrapnel alike now mostly bounce.",
    effect: "One ally within 30 ft (or yourself) gains Guard +2 for the scene.",
    flavor: "Mal: 'Rhino-adjacent. Emotionally AND ballistically.'",
    tags: ["starter-kit", "ward"]
  },

  // ─── Cosmic Linguist › Redactor (3) ───────────────────────────────────────
  {
    name: "Redacted",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-redactor", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "gevurah",
    form: "sigil", func: "command", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["blinded"], { saveAttribute: "mind" }),
    concept: "A crisp black bar stamps itself across the target's eyes. Their view of the scene is now classified above their clearance.",
    effect: "One target within 30 ft: Mind defense vs Cast DC. On fail: Blinded for 1 round behind the censor bar.",
    flavor: "Mal: 'They can appeal the redaction in writing. Processing time: one round. Convenient.'",
    tags: ["starter-kit", "instant", "cc"]
  },
  {
    name: "The Delete Key",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-redactor", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "gevurah",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "psychic", "stress", "intrigue", "one word of theirs, gone"),
    appliedStates: states(["shaken"], { saveAttribute: "mind" }),
    concept: "You select one word the target was using — 'confidence' is popular — and press delete. They feel it go.",
    effect: "One target within 30 ft takes 1d6 psychic (stress); Mind defense vs Cast DC or Shaken for 1 round, groping for the missing word.",
    flavor: "Mal: 'No, it's not in the trash. The trash is a mercy. This was Shift-Delete.'",
    tags: ["starter-kit", "instant", "stress"]
  },
  {
    name: "Heavily Redacted",
    kind: "power", path: "cosmic_linguist", doctrine: "bbttcc-cosmic-linguist-linguist-redactor", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "binah",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 2]]),
    concept: "You strike sensitive details from an ally's public record: outline, heading, current position. Onlookers get the gist and nothing actionable.",
    effect: "One ally within 30 ft (or yourself) gains Evasion +2 for the scene — hard to hit what's mostly black bars.",
    flavor: "Mal: 'Witness protection, but for your silhouette.'",
    tags: ["starter-kit", "ward", "stealth"]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PACTKEEPER — path core (5; 3 instant Workings + 2 forms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Long Ledger",
    kind: "power", path: "pactkeeper", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "malkuth",
    form: "sigil", func: "reveal", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    concept: "You open the ledger — the long one — and read the target's running balance aloud. Every favor taken, every kindness unpaid, itemized, with interest.",
    effect: "One target within 30 ft: Soul defense vs Cast DC. On fail: Shaken for 1 round under the arithmetic of what they owe.",
    flavor: "Mal: 'Everybody's fine with karma until it shows up with line items.'",
    tags: ["starter-kit", "instant", "cc", "reused"]
  },
  {
    name: "Cite Precedent",
    kind: "power", path: "pactkeeper", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "rite", func: "command", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["calmed"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "You cite the prior case — the one where this exact fight already happened and everyone regretted it. The precedent is binding.",
    effect: "One target within 30 ft: Soul defense vs Cast DC each round or Calmed — unwilling to escalate — until they save.",
    flavor: "Mal: 'See Everybody v. Everybody, ruling: knock it off. Upheld on appeal.'",
    tags: ["starter-kit", "instant", "cc", "reused"]
  },
  {
    name: "Penalty Clause",
    kind: "power", path: "pactkeeper", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "gevurah",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "qliphothic", "stress", "presence", "the lie cuts him"),
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    concept: "The target broke a promise — to you, to someone, to themselves; there's always one. You invoke the fine print, and the breach collects.",
    effect: "One target within 30 ft takes 1d6 qliphothic (stress); Soul defense vs Cast DC or Shaken for 1 round.",
    flavor: "Mal: 'Nobody reads section 12(b). Section 12(b) reads YOU.'",
    tags: ["starter-kit", "instant", "stress", "reused"]
  },
  {
    name: "Standing Oath",
    kind: "power", path: "pactkeeper", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["resolve", "+", 2]]),
    concept: "You renew a promise you have never broken and wear it like a coat. It has weathered worse than today.",
    effect: "You (or one touched ally) gain Resolve +2 for the scene while the oath stands.",
    flavor: "Mal: 'Some armor is riveted. Some is just a sentence somebody refused to take back.'",
    tags: ["starter-kit", "ward", "reused"]
  },
  {
    name: "Clause Lantern",
    kind: "power", path: "pactkeeper", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "hod",
    form: "tool", func: "reveal", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area", rangeFt: 30,
    maintenanceKey: "1-clarity-scene",
    area: { shape: "sphere", size: 30 },
    damageRoll: dmg(0),
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    concept: "A lantern that burns the terms of every deal in the room. Hidden costs curl up out of it as smoke, in a legible font.",
    effect: "30 ft zone for the scene (1 Clarity/scene upkeep). Enemies in the light: Soul defense vs Cast DC or Shaken for 1 round as their fine print becomes public.",
    flavor: "Mal: 'Ambiance AND discovery. Every restaurant should have one. No restaurant would survive one.'",
    tags: ["starter-kit", "zone", "aoe", "reused"]
  },

  // ─── Pactkeeper › Archivist of Precedent (3) ──────────────────────────────
  {
    name: "Bind Witness",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-archivist-of-precedent", tier: 1,
    intent: "presence", channel: "soul", sephirah: "binah",
    form: "rite", func: "bind", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["compelled"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "You swear the target in. Whatever they do next is testimony, and the record does not permit evasive action.",
    effect: "One target within 30 ft: Soul defense vs Cast DC each round or Compelled — bound to the stand, answering — until they save.",
    flavor: "Mal: 'Do you swear to tell the truth? Doesn't matter. The paperwork already assumed you would.'",
    tags: ["starter-kit", "instant", "cc", "reused"]
  },
  {
    name: "The Record Shows",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-archivist-of-precedent", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "binah",
    form: "sigil", func: "reveal", stability: "sustained", interactionModel: "mark",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: debuffs([["evasion", 2]]),
    appliedStates: states([], { duration: "scene", saveAttribute: "mind" }),
    concept: "You enter the target's position into the record — location, stance, habits, tells. The record is public. The record updates in real time.",
    effect: "One target within 30 ft is marked for the scene: Evasion −2 while their every move is a matter of record.",
    flavor: "Mal: 'Hard to dodge when your dodge is pre-registered. With diagrams.'",
    tags: ["starter-kit", "debuff", "mark"]
  },
  {
    name: "Amicus Brief",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-archivist-of-precedent", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "sigil", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 1], ["resolve", "+", 1]]),
    concept: "You file a friend-of-the-court brief on an ally's behalf: history itself weighs in, noting that people like them have prevailed before.",
    effect: "One ally within 30 ft gains Guard +1 and Resolve +1 for the scene, with precedent on their side.",
    flavor: "Mal: 'It's a hug, but citable.'",
    tags: ["starter-kit", "ward", "support"]
  },

  // ─── Pactkeeper › Auditor (3) ─────────────────────────────────────────────
  {
    name: "Court of Seven",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-auditor", tier: 1,
    intent: "presence", channel: "soul", sephirah: "gevurah",
    form: "rite", func: "command", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area", rangeFt: 30,
    maintenanceKey: "1-clarity-scene",
    area: { shape: "sphere", size: 20 },
    damageRoll: dmg(0),
    appliedStates: states(["compelled"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "Seven empty chairs assemble around the target area. Whoever sits in them is unclear. That they are presiding is not.",
    effect: "20 ft zone for the scene (1 Clarity/scene upkeep). Enemies inside: Soul defense vs Cast DC each round or Compelled to account for themselves before the bench, until they save.",
    flavor: "Mal: 'You are now in session. All rise. Yes, mid-gunfight. The court has seen worse dockets.'",
    tags: ["starter-kit", "zone", "aoe", "cc", "reused"]
  },
  {
    name: "Sanction Protocol",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-auditor", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "gevurah",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d4", "psychic", "stress", "intrigue", "irregularities, itemized"),
    appliedEffects: debuffs([["guard", 2]]),
    appliedStates: states([], { duration: "1-round", saveAttribute: "mind" }),
    concept: "You flag the target's defenses as non-compliant. Findings are published immediately. Their armor develops an audit trail, and the audit trail has gaps.",
    effect: "One target within 30 ft takes 1d4 psychic (stress) and suffers Guard −2 for 1 round while the findings circulate.",
    flavor: "Mal: 'Turns out the breastplate was expensed under \"miscellaneous.\" Denied.'",
    tags: ["starter-kit", "instant", "debuff"]
  },
  {
    name: "Freeze Assets",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-auditor", tier: 1,
    intent: "presence", channel: "soul", sephirah: "gevurah",
    form: "sigil", func: "bind", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["restrained"], { saveAttribute: "soul" }),
    concept: "Pending review, the target's assets are frozen. All of them. Including the arms and legs, which are, technically, assets.",
    effect: "One target within 30 ft: Soul defense vs Cast DC. On fail: Restrained for 1 round pending investigation.",
    flavor: "Mal: 'Your account has been locked for suspicious activity. The suspicious activity was \"charging at the Pactkeeper.\"'",
    tags: ["starter-kit", "instant", "cc"]
  },

  // ─── Pactkeeper › Steward of Living Communities (3) ───────────────────────
  {
    name: "Covenant Hearth",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-steward-of-living-communities", tier: 1,
    intent: "presence", channel: "soul", sephirah: "malkuth",
    form: "field", func: "protect", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area", rangeFt: 30,
    maintenanceKey: "1-clarity-scene",
    area: { shape: "sphere", size: 15 },
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    concept: "You kindle the old agreement — the one where a fire means everyone around it is, for now, one household. The warmth has terms, and the terms hold.",
    effect: "15 ft zone for the scene (1 Clarity/scene upkeep). Allies inside gain Guard +2 while the hearth-covenant holds.",
    flavor: "Mal: 'Home is where somebody signed for you. This counts. It's small, but it counts.'",
    tags: ["starter-kit", "zone", "ward", "support"]
  },
  {
    name: "Mutual Aid Clause",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-steward-of-living-communities", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "rite", func: "protect", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    appliedStates: states([], { duration: "1-round", saveAttribute: "soul" }),
    concept: "You invoke the clause every real community keeps in force: when one of ours is in trouble, the neighbors show up. Briefly, invisibly, they do.",
    effect: "One ally within 30 ft immediately gains Guard +2 for 1 round as the neighborhood arrives.",
    flavor: "Mal: 'Forty invisible casseroles and a guy with a truck. You cannot buy this coverage.'",
    tags: ["starter-kit", "instant", "ward", "support"]
  },
  {
    name: "We Signed For Each Other",
    kind: "power", path: "pactkeeper", doctrine: "bbttcc-pactkeeper-steward-of-living-communities", tier: 1,
    intent: "presence", channel: "soul", sephirah: "malkuth",
    form: "field", func: "command", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area", rangeFt: 30,
    maintenanceKey: "1-clarity-scene",
    area: { shape: "sphere", size: 30 },
    damageRoll: dmg(0),
    appliedStates: states(["calmed"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "You read out the mutual-defense compact this ground remembers: everyone here has been vouched for by someone. Violence becomes a breach of a promise with witnesses.",
    effect: "30 ft zone for the scene (1 Clarity/scene upkeep). Enemies inside: Soul defense vs Cast DC each round or Calmed — unwilling to break the compact — until they save.",
    flavor: "Mal: 'Peer pressure, notarized.'",
    tags: ["starter-kit", "zone", "aoe", "cc"]
  }
];
// Starter-kit specs — Dreamwalker + Wyrdlens Adept (28)
const SPECS_DW_WL = [

  // ═══════════════════════════════════════════════════════════════════════════
  // DREAMWALKER — path core (5; 3 instant workings, 2 sustained forms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Sleep-Loop",
    kind: "power", path: "dreamwalker", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "echo", func: "bind", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["charmed"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "You hand the target the same ten seconds of a very pleasant dream, on repeat. They keep almost finishing it. It keeps almost being finished.",
    effect: "One creature within 30 ft: Soul defense vs Cast DC. On fail: Charmed, re-saving each round until they shake the loop.",
    flavor: "Mal: 'It's the one where their teeth aren't falling out and everyone claps. Of course they went back in.'",
    tags: ["starter-kit", "dreamwalker", "cc", "reused"]
  },
  {
    name: "Carry-the-Unsayable",
    kind: "power", path: "dreamwalker", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "yesod",
    form: "echo", func: "harm", stability: "instant", interactionModel: "event",
    scale: "scene", duration: "instant", target: "area",
    damageRoll: dmg(1, "d4", "psychic", "stress", "presence", "the dream nobody agreed to have"),
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    area: { shape: "sphere", size: 20 },
    concept: "You open your mouth and let out the part of last night's dream that language refuses to hold. Everyone nearby catches a piece of it.",
    effect: "All enemies in a 20-ft sphere: Soul defense vs Cast DC. On fail: 1d4 psychic (stress) and Shaken for 1 round.",
    flavor: "Mal: 'There's no word for it. That's the problem. Now it's THEIR problem.'",
    tags: ["starter-kit", "dreamwalker", "aoe", "reused"]
  },
  {
    name: "Hypnagogic Shrug",
    kind: "power", path: "dreamwalker", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "sigil", func: "command", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["staggered"], { saveAttribute: "mind" }),
    concept: "You gift one enemy the 3 p.m. feeling. The full-body head-nod. The where-was-I. Mid-swing, if you time it right.",
    effect: "One creature within 30 ft: Mind defense vs Cast DC. On fail: Staggered (movement halved, −2 attacks) for 1 round.",
    flavor: "Mal: 'Everybody's fought a war on six hours of sleep. Now they're fighting yours on none.'",
    tags: ["starter-kit", "dreamwalker", "cc", "new"]
  },
  {
    name: "Impossible Second Self",
    kind: "power", path: "dreamwalker", doctrine: "", tier: 1,
    intent: "intrigue", channel: "soul", sephirah: "yesod",
    form: "echo", func: "transform", stability: "sustained", interactionModel: "companion",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 1], ["initiative", "+", 1]]),
    concept: "A dream-double peels off and keeps you company — scouting corners, standing in doorways, being the you that gets shot at first.",
    effect: "Self, sustained for the scene: +1 Evasion and +1 Initiative while your double is on the field.",
    flavor: "Mal: 'Two of you. Because the universe looked at one and said, sure, why not, double it.'",
    tags: ["starter-kit", "dreamwalker", "ward", "reused"]
  },
  {
    name: "Dream-Twin",
    kind: "power", path: "dreamwalker", doctrine: "", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "echo", func: "protect", stability: "sustained", interactionModel: "companion",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 2]]),
    concept: "You dream a twin for an ally and set it half a step to their left, where the bullet was going to be.",
    effect: "One ally within 30 ft, sustained for the scene: +2 Evasion while the twin shadows them.",
    flavor: "Mal: 'Best bodyguard in Bad Eden. Doesn't eat, doesn't sleep, technically IS sleep.'",
    tags: ["starter-kit", "dreamwalker", "ward", "ally", "reused"]
  },

  // ── Dreamwalker · Trance of the Quiet Sun (3) ──────────────────────────────
  {
    name: "Warm Milk Ultimatum",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-quiet-sun", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "field", func: "command", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["calmed"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "The Quiet Sun leans on one furious person with the entire warm weight of every nap they ever refused. It is not a suggestion.",
    effect: "One creature within 30 ft: Soul defense vs Cast DC. On fail: Calmed, re-saving each round until the drowsy warmth lifts.",
    flavor: "Mal: 'You will be soothed. This is a stick-up. Hands where I can tuck them in.'",
    tags: ["starter-kit", "dreamwalker", "quiet-sun", "cc", "new"]
  },
  {
    name: "Siesta Sanctum",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-quiet-sun", tier: 1,
    intent: "presence", channel: "soul", sephirah: "tiferet",
    form: "field", func: "protect", stability: "sustained", interactionModel: "zone",
    scale: "scene", duration: "scene", target: "area",
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 1], ["resolve", "+", 1]]),
    area: { shape: "sphere", size: 20 },
    concept: "A pocket of golden afternoon settles over your people — hammock light, porch warmth, the certainty that nothing bad happens before dinner.",
    effect: "Allies in a 20-ft sphere, sustained for the scene: +1 Guard and +1 Resolve while they stay in the warm light.",
    flavor: "Mal: 'Somewhere it's always 2 p.m. on a Sunday. She just brings it to the gunfight.'",
    tags: ["starter-kit", "dreamwalker", "quiet-sun", "aoe", "ward", "new"]
  },
  {
    name: "The Good Dream",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-quiet-sun", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "rite", func: "heal", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["resolve", "+", 2]]),
    concept: "You slip an ally thirty seconds of the good one — the flying one, the one where the dog is still alive — and they come back steadier.",
    effect: "One ally within 30 ft: shake off fear (GM clears Shaken/Charmed from a dream-adjacent source) and gain +2 Resolve for the scene.",
    flavor: "Mal: 'Thirty seconds of the dream where it all worked out. Non-refundable. Extremely effective.'",
    tags: ["starter-kit", "dreamwalker", "quiet-sun", "support", "new"]
  },

  // ── Dreamwalker · Trance of the Sapphire Gate (3) ──────────────────────────
  {
    name: "Doorframe Discount",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-sapphire-gate", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "gate", func: "move", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "self", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 1]]),
    concept: "All doorways are the same doorway if you fell asleep in enough of them. Step into any opening; step out of another one nearby.",
    effect: "Step through any doorway, arch, or gap and emerge from another within 30 ft. The disorientation you leave behind grants you +1 Evasion for the scene.",
    flavor: "Mal: 'Doors are a franchise. She has the loyalty card.'",
    tags: ["starter-kit", "dreamwalker", "sapphire-gate", "mobility", "new"]
  },
  {
    name: "Latchkey Lullaby",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-sapphire-gate", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "tool", func: "move", stability: "bound", interactionModel: "tool",
    scale: "personal", duration: "persistent", target: "self",
    damageRoll: dmg(0),
    concept: "A small blue key that exists because you dreamed you owned it. It opens any lock that is, at that moment, asleep — and most locks are always asleep.",
    effect: "Bound tool: once per scene, open one mundane lock, latch, or seal by singing it three descending notes. Wards, alarms, and anything actively watched are beyond it.",
    flavor: "Mal: 'Every lock dreams of being a door. This key is deeply unethical about that.'",
    tags: ["starter-kit", "dreamwalker", "sapphire-gate", "utility", "bound", "new"]
  },
  {
    name: "Threshold Vertigo",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-sapphire-gate", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "yesod",
    form: "gate", func: "command", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["prone"], { saveAttribute: "body" }),
    concept: "You convince the ground under one enemy's next step that it is briefly a threshold to somewhere five feet away and slightly lower.",
    effect: "One creature within 30 ft: Body defense vs Cast DC. On fail: their step lands wrong-side-of-elsewhere — Prone for 1 round.",
    flavor: "Mal: 'Missing the last stair, as a service.'",
    tags: ["starter-kit", "dreamwalker", "sapphire-gate", "cc", "new"]
  },

  // ── Dreamwalker · Trance of the Thousand Faces (3) ─────────────────────────
  {
    name: "Borrowed Face",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-thousand-faces", tier: 1,
    intent: "intrigue", channel: "soul", sephirah: "hod",
    form: "body", func: "transform", stability: "sustained", interactionModel: "transformation",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 1]]),
    concept: "You reach into the crowd of selves you've dreamed being and put one on. It fits. It always fits. That's the unsettling part.",
    effect: "Self, sustained for the scene: wear a plausible face and bearing of your choosing (passes casual scrutiny; close inspection is a contested test) and gain +1 Evasion — nobody aims well at someone they misremember.",
    flavor: "Mal: 'Today she's a customs inspector named Doreen. Doreen has a lanyard. You don't argue with a lanyard.'",
    tags: ["starter-kit", "dreamwalker", "thousand-faces", "infiltration", "reused"]
  },
  {
    name: "Committee of Me",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-thousand-faces", tier: 1,
    intent: "presence", channel: "mind", sephirah: "hod",
    form: "echo", func: "command", stability: "instant", interactionModel: "event",
    scale: "scene", duration: "instant", target: "area",
    damageRoll: dmg(0),
    appliedStates: states(["staggered"], { saveAttribute: "soul" }),
    area: { shape: "sphere", size: 15 },
    concept: "For one breath, every you that you have ever dreamed of being stands up at once. There are a lot of you. Some are waving.",
    effect: "All enemies in a 15-ft sphere: Soul defense vs Cast DC. On fail: Staggered (movement halved, −2 attacks) for 1 round while they sort out which of you is load-bearing.",
    flavor: "Mal: 'Quorum reached. Motion to be unhittable carries, eleven to zero, all in favor being her.'",
    tags: ["starter-kit", "dreamwalker", "thousand-faces", "aoe", "cc", "new"]
  },
  {
    name: "Understudy",
    kind: "power", path: "dreamwalker", doctrine: "bbttcc-dreamwalker-thousand-faces", tier: 1,
    intent: "presence", channel: "soul", sephirah: "yesod",
    form: "echo", func: "protect", stability: "sustained", interactionModel: "companion",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    concept: "One of your spare selves learns an ally's part and shadows them through the scene, stepping into the worst moments in their place.",
    effect: "One ally within 30 ft, sustained for the scene: +2 Guard while your understudy rehearses their pain for them.",
    flavor: "Mal: 'The show must go on. Just not, technically, happening to you.'",
    tags: ["starter-kit", "dreamwalker", "thousand-faces", "ward", "ally", "new"]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WYRDLENS ADEPT — path core (5; 3 instant workings, 2 sustained forms)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: "Lensing",
    kind: "power", path: "wyrdlens-adept", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "hod",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d4", "psychic", "stress", "intrigue", "focused to a point"),
    appliedStates: states(["shaken"], { saveAttribute: "mind" }),
    concept: "You fold every stray glance in the room through one lens and focus it on a single point behind the target's eyes.",
    effect: "One creature within 30 ft: Mind defense vs Cast DC. On fail: 1d4 psychic (stress) and Shaken for 1 round.",
    flavor: "Mal: 'Kid used to fry ants. Now the ants are existential and the magnifying glass is everyone's attention.'",
    tags: ["starter-kit", "wyrdlens", "stress", "reused"]
  },
  {
    name: "Correspondence Strike",
    kind: "power", path: "wyrdlens-adept", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "chokmah",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "energy", "integrity", "intrigue", "sympathetic break"),
    appliedStates: states(["staggered"], { saveAttribute: "body" }),
    concept: "As above, so below; as the bottle you just cracked, so the knee of the man holding it. You break the small thing and the big thing agrees.",
    effect: "One creature within 30 ft: Body defense vs Cast DC. On fail: 1d6 energy and Staggered for 1 round as the correspondence lands.",
    flavor: "Mal: 'Sympathy is a beautiful force of cosmic unity. Also you can hit a guy with it.'",
    tags: ["starter-kit", "wyrdlens", "damage", "reused"]
  },
  {
    name: "Spoiler Alert",
    kind: "power", path: "wyrdlens-adept", doctrine: "", tier: 1,
    intent: "presence", channel: "mind", sephirah: "hod",
    form: "sigil", func: "reveal", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["staggered"], { saveAttribute: "mind" }),
    concept: "You read the target's next move off the wyrd and announce it to the room, loudly, with commentary, before they do it.",
    effect: "One creature within 30 ft: Mind defense vs Cast DC. On fail: their telegraphed plan collapses — Staggered (movement halved, −2 attacks) for 1 round.",
    flavor: "Mal: 'He was going to feint left. Everyone knows he was going to feint left. He knows everyone knows. Watch him not.'",
    tags: ["starter-kit", "wyrdlens", "cc", "new"]
  },
  {
    name: "Angle of Witness",
    kind: "power", path: "wyrdlens-adept", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "chokmah",
    form: "field", func: "reveal", stability: "sustained", interactionModel: "mark",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: debuffs([["evasion", 2]]),
    concept: "Everything impossible is only impossible from most angles. You hold open the one angle from which the target can absolutely, definitely, be hit.",
    effect: "One creature within 30 ft, sustained for the scene: −2 Evasion while you keep the angle open for your allies.",
    flavor: "Mal: 'There's always a spot where the untouchable guy is just a guy. It's usually behind the ego.'",
    tags: ["starter-kit", "wyrdlens", "debuff", "reused"]
  },
  {
    name: "Wide Angle",
    kind: "power", path: "wyrdlens-adept", doctrine: "", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "chokmah",
    form: "vestment", func: "protect", stability: "sustained", interactionModel: "worn",
    scale: "personal", duration: "scene", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 2]]),
    concept: "You stop looking at the fight and start looking at the whole frame — every line of fire a thread of light you simply stand between.",
    effect: "Self, sustained for the scene: +2 Evasion while you watch the composition instead of the punches.",
    flavor: "Mal: 'Can't hit the photographer. Union rules. Cosmic union, but still.'",
    tags: ["starter-kit", "wyrdlens", "ward", "reused"]
  },

  // ── Wyrdlens · Refraction of Foresight (3) ─────────────────────────────────
  {
    name: "Already Ducked",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-foresight", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "chokmah",
    form: "sigil", func: "protect", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 2]]),
    concept: "You watch the next second arrive a second early and lend it to whoever needs it. By the time the swing exists, its target already isn't there.",
    effect: "Self or one ally within 30 ft: +2 Evasion for the scene — they keep being where the attack was going to have been.",
    flavor: "Mal: 'Dodging is for people who wait until it happens. Amateurs.'",
    tags: ["starter-kit", "wyrdlens", "foresight", "ward", "new"]
  },
  {
    name: "Sigil of Seeing",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-foresight", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "hod",
    form: "sigil", func: "reveal", stability: "sustained", interactionModel: "mark",
    scale: "personal", duration: "scene", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["evasion", "+", 1], ["initiative", "+", 1]]),
    concept: "A small mark over an ally's brow that shows them the half-second ahead of now — where the punch starts, when the door opens.",
    effect: "One ally within 30 ft, sustained for the scene: +1 Evasion and +1 Initiative while the sigil glows.",
    flavor: "Mal: 'A little eye that watches the future so yours can watch the road. Everyone needs a hobby.'",
    tags: ["starter-kit", "wyrdlens", "foresight", "ward", "ally", "reused"]
  },
  {
    name: "Tuesday's Newspaper",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-foresight", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "chokmah",
    form: "sigil", func: "reveal", stability: "instant", interactionModel: "event",
    scale: "personal", duration: "instant", target: "self",
    damageRoll: dmg(0),
    appliedEffects: wards([["initiative", "+", 2]]),
    concept: "You skim tomorrow's headline about the next sixty seconds. It's mostly weather and violence, but it's YOUR weather and violence.",
    effect: "Ask the GM one yes/no question about the coming minute (answered truthfully as the wyrd currently bends) and gain +2 Initiative for the scene.",
    flavor: "Mal: 'Spoilers: somebody makes a terrible decision in the next minute. The lens just tells you which body it happens to.'",
    tags: ["starter-kit", "wyrdlens", "foresight", "utility", "new"]
  },

  // ── Wyrdlens · Refraction of Mercy (3) ─────────────────────────────────────
  {
    name: "Atlas Prism",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-mercy", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "tool", func: "protect", stability: "bound", interactionModel: "tool",
    scale: "personal", duration: "persistent", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 2]]),
    concept: "A palm-sized prism that carries the weight of the world one refraction at a time — you aim it at someone and the incoming harm bends around their edges.",
    effect: "Bound tool: one ally within 30 ft gains +2 Guard for the scene as the prism bends the worst of it wide.",
    flavor: "Mal: 'It doesn't stop the hit. It just files it under someone with broader shoulders. The prism has VERY broad shoulders.'",
    tags: ["starter-kit", "wyrdlens", "mercy", "ward", "bound", "reused"]
  },
  {
    name: "Pulled Punch Postulate",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-mercy", tier: 1,
    intent: "presence", channel: "soul", sephirah: "chesed",
    form: "field", func: "command", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedStates: states(["calmed"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "You refract one enemy's violence through the kindest available version of them. The swing arrives as a hesitation.",
    effect: "One creature within 30 ft: Soul defense vs Cast DC. On fail: Calmed, re-saving each round while mercy holds the angle.",
    flavor: "Mal: 'Somewhere in there is the guy who feeds a stray cat. The lens just gives him the wheel for a minute.'",
    tags: ["starter-kit", "wyrdlens", "mercy", "cc", "new"]
  },
  {
    name: "The Kind Angle",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-mercy", tier: 1,
    intent: "presence", channel: "soul", sephirah: "tiferet",
    form: "field", func: "protect", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(0),
    appliedEffects: wards([["guard", "+", 1], ["resolve", "+", 1]]),
    concept: "You show an ally themselves from the one angle where they're already the person who survives this. Light does the rest.",
    effect: "One ally within 30 ft: +1 Guard and +1 Resolve for the scene, seen kindly and standing taller for it.",
    flavor: "Mal: 'Everyone has a good side. Hers can stop shrapnel.'",
    tags: ["starter-kit", "wyrdlens", "mercy", "ward", "ally", "new"]
  },

  // ── Wyrdlens · Refraction of Truth (3) ─────────────────────────────────────
  {
    name: "Unmasking Flash",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-truth", tier: 1,
    intent: "presence", channel: "mind", sephirah: "binah",
    form: "field", func: "reveal", stability: "instant", interactionModel: "event",
    scale: "scene", duration: "instant", target: "area",
    damageRoll: dmg(1, "d4", "psychic", "stress", "presence", "seen exactly"),
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    area: { shape: "sphere", size: 15 },
    concept: "One camera-flash of absolute accuracy. Disguises, glamours, and comfortable self-images all develop at once, in public.",
    effect: "All enemies in a 15-ft sphere: Soul defense vs Cast DC. On fail: 1d4 psychic (stress) and Shaken for 1 round; mundane disguises and surface glamours in the area collapse outright.",
    flavor: "Mal: 'Everybody looks like their ID photo for one second. No one has ever forgiven the lens for this.'",
    tags: ["starter-kit", "wyrdlens", "truth", "aoe", "reveal", "new"]
  },
  {
    name: "Deposition Lens",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-truth", tier: 1,
    intent: "intrigue", channel: "mind", sephirah: "binah",
    form: "tool", func: "bind", stability: "sustained", interactionModel: "tool",
    scale: "personal", duration: "scene", target: "single", rangeFt: 15,
    damageRoll: dmg(0),
    appliedStates: states(["compelled"], { duration: "until-saved", saveEachRound: true, saveAttribute: "soul" }),
    concept: "A monocle-sized lens on a brass stalk. Whoever you study through it finds that lying has developed a paperwork problem.",
    effect: "One creature within 15 ft, sustained: Soul defense vs Cast DC. On fail: Compelled to answer what is asked plainly, re-saving each round under the lens.",
    flavor: "Mal: 'Sworn testimony, except the oath is physics.'",
    tags: ["starter-kit", "wyrdlens", "truth", "cc", "utility", "new"]
  },
  {
    name: "The Real Shape",
    kind: "power", path: "wyrdlens-adept", doctrine: "bbttcc-wyrdlens-adept-truth", tier: 1,
    intent: "presence", channel: "mind", sephirah: "binah",
    form: "sigil", func: "harm", stability: "instant", interactionModel: "mark",
    scale: "personal", duration: "instant", target: "single", rangeFt: 30,
    damageRoll: dmg(1, "d6", "psychic", "stress", "presence", "the mirror with no favors in it"),
    appliedStates: states(["shaken"], { saveAttribute: "soul" }),
    concept: "You show one enemy the exact shape of what they are, uncropped, unfiltered, with the lighting they've been avoiding since the war.",
    effect: "One creature within 30 ft: Soul defense vs Cast DC. On fail: 1d6 psychic (stress) and Shaken for 1 round.",
    flavor: "Mal: 'The truth doesn't hurt. THIS truth hurts. There's a difference and it's 1d6.'",
    tags: ["starter-kit", "wyrdlens", "truth", "stress", "new"]
  }
];

  const SPECS = [...SPECS_NONTCC, ...SPECS_CL_PK, ...SPECS_DW_WL];

  // ── PATH METADATA (labels for pathResonance + folder icon per path) ───────
  const PATH_META = {
    "bulwark":         { label: "Bulwark",         tcc: false, img: "icons/equipment/shield/heater-steel-worn.webp" },
    "aurablade":       { label: "Aurablade",       tcc: false, img: "icons/skills/melee/blade-tip-energy-green.webp" },
    "soul-smith":      { label: "Soul-Smith",      tcc: false, img: "icons/tools/smithing/anvil.webp" },
    "harmonymarshal":  { label: "Harmony Marshal", tcc: false, img: "icons/magic/holy/meditation-chi-focus-blue.webp" },
    "shadow_courier":  { label: "Shadow Courier",  tcc: false, img: "icons/magic/movement/trail-streak-zigzag-yellow.webp" },
    "cosmic_linguist": { label: "Cosmic Linguist", tcc: true,  img: "icons/sundries/documents/document-sealed-signatures-red.webp" },
    "pactkeeper":      { label: "Pactkeeper",      tcc: true,  img: "icons/sundries/scrolls/scroll-runed-brown-purple.webp" },
    "dreamwalker":     { label: "Dreamwalker",     tcc: true,  img: "icons/magic/control/sleep-bubble-purple.webp" },
    "wyrdlens-adept":  { label: "Wyrdlens Adept",  tcc: true,  img: "icons/magic/perception/eye-tendrils-web-purple.webp" }
  };

  // ── LINT PASS (abort before writing anything) ─────────────────────────────
  const problems = [];
  const seenNames = new Set();
  const comboCount = {}; // "path|doctrine" → n  (core items count toward every combo)
  for (const s of SPECS) {
    const meta = PATH_META[s.path];
    if (!meta) { problems.push(`${s.name}: unknown path "${s.path}"`); continue; }
    if (seenNames.has(s.name)) problems.push(`duplicate spec name: ${s.name}`);
    seenNames.add(s.name);
    if (!meta.tcc && s.stability === "instant") problems.push(`${s.name}: non-TCC path ${s.path} cannot have stability "instant"`);
    const key = s.path + "|" + (s.doctrine || "*core*");
    comboCount[key] = (comboCount[key] ?? 0) + 1;
  }
  for (const [pathId, meta] of Object.entries(PATH_META)) {
    const core = comboCount[pathId + "|*core*"] ?? 0;
    const wantCore = meta.tcc ? 5 : 2;
    const wantSig  = meta.tcc ? 3 : 1;
    if (core !== wantCore) problems.push(`${meta.label}: ${core} core items, expected ${wantCore}`);
    const doctrines = Object.keys(comboCount).filter(k => k.startsWith(pathId + "|") && !k.endsWith("*core*"));
    if (doctrines.length !== 3) problems.push(`${meta.label}: ${doctrines.length} doctrines with signatures, expected 3`);
    for (const k of doctrines) {
      if (comboCount[k] !== wantSig) problems.push(`${k}: ${comboCount[k]} signature items, expected ${wantSig}`);
    }
  }
  if (problems.length) {
    console.error("[starter-kits] LINT FAILED — nothing written:\n" + problems.join("\n"));
    ui.notifications?.error(`Starter kits: ${problems.length} lint problem(s) — see console (F12). Nothing written.`);
    return;
  }

  // ── BUILD + STAMP ─────────────────────────────────────────────────────────
  let created = 0, skipped = 0, failed = 0;
  for (const spec of SPECS) {
    if (existingByName.has(spec.name) && !FORCE_CREATE) { skipped++; continue; }
    const meta = PATH_META[spec.path];
    try {
      const resonance = spec.doctrine
        ? `${meta.label} — ${spec.doctrine.replace(/^bbttcc-/, "").replace(/-/g, " ")}`
        : meta.label;
      const values = {
        name: spec.name,
        tier: spec.tier ?? 1,
        intent: spec.intent,
        channel: spec.channel,
        sephirah: spec.sephirah,
        mode: "hermetic",
        stability: spec.stability,
        form: spec.form,
        function: spec.func,
        interactionModel: spec.interactionModel,
        scale: spec.scale ?? "personal",
        duration: spec.duration ?? (spec.appliedStates?.duration ?? "instant"),
        maintenanceKey: spec.maintenanceKey ?? "none",
        damageRoll: spec.damageRoll,
        appliedStates: spec.appliedStates,
        appliedEffects: spec.appliedEffects,
        area: spec.area,
        rangeFt: spec.rangeFt ?? 0,
        target: spec.target,
        concept: spec.concept,
        effect: spec.effect,
        flavor: spec.flavor,
        pathResonance: resonance,
        tags: [...(spec.tags ?? []), "starter-kit", `path:${spec.path}`, spec.doctrine ? "doctrine-signature" : "path-core"],
        costType: "clarity",
        costValue: 1,
        activation_block: { type: "action", consumePool: true },
        // weapon-kind extras (ignored for powers)
        category: spec.category,
        skill: spec.skill,
        damageFormula: spec.damageFormula,
        damageType: spec.damageType,
        damageTrack: spec.damageTrack,
        rangeShort: spec.rangeShort,
        rangeLong: spec.rangeLong
      };
      const itemData = builder(null, spec.kind === "weapon" ? "weapon" : "power", values);

      itemData.flags = itemData.flags ?? {};
      itemData.flags.fourththing = itemData.flags.fourththing ?? {};
      itemData.flags.fourththing.starterKit = {
        path: spec.path,
        doctrine: spec.doctrine || "",
        core: !spec.doctrine
      };

      if (folder?.id) itemData.folder = folder.id;
      itemData.img = meta.img;

      if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
      created++;
    } catch (err) {
      console.warn(`[starter-kits] Failed to create '${spec.name}':`, err);
      failed++;
    }
  }

  // Per-combo summary table for the console.
  console.log("[starter-kits] per-combo totals (core + signatures):");
  for (const [pathId, meta] of Object.entries(PATH_META)) {
    const core = comboCount[pathId + "|*core*"] ?? 0;
    const rows = Object.keys(comboCount)
      .filter(k => k.startsWith(pathId + "|") && !k.endsWith("*core*"))
      .map(k => `${k.split("|")[1]}: ${core}+${comboCount[k]}=${core + comboCount[k]}`);
    console.log(`  ${meta.label} (${meta.tcc ? "TCC" : "non-TCC"}): ${rows.join(" · ")}`);
  }

  const msg = `Starter Manifestation Kits — created ${created}, skipped ${skipped} existing${failed ? `, failed ${failed}` : ""}. Folder: ${FOLDER_NAME}.`;
  ui.notifications?.info(msg);
  console.log("[bbttcc-master-content/starter-kits]", msg);
})();
