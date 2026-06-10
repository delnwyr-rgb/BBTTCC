/* Bad Eden Auto-Link — RFI Monster Builder
 *
 * Creates a type:"npc" actor that renders with the native fourththing NPC
 * sheet (FACULTIES + MANIFESTATIONS layout). Distinct from the NPC Builder
 * (classed PCs on the character sheet).
 *
 * 2026-05-27 — Creature-type templates sprint.
 *
 * Builder rebuilt to mirror the Boss Builder authoring panel: a category
 * tab bar (Beasts / Humanoids / Undead / Constructs / Aberrations / Fiends /
 * Elementals / Swarms), starter chips that pre-fill the full canon stat
 * block, and on-create seeding of trait / strike / save / feature items
 * via the same factory shapes the bestiary seed macros use. Calibrated to
 * the 28-creature canon roster in bbttcc-master-content/tools/seed-bestiary*
 * — seven kits are ported verbatim, one (Lisa Frank Elemental) is fresh.
 *
 * The NPC sheet renders manifestations DIRECTLY from owned items
 * (type:"power" + manifestation-flagged type:"weapon") and trait/feature
 * items in the Features section — no system.manifestations.library UUID
 * registration is needed (that's a boss-only concern).
 */

const MOD = "bbttcc-auto-link";

/* ──────────────────────────────────────────────────────────────────────────
 *  CANON TABLES (ported from bbttcc-master-content/tools/seed-bestiary*)
 *  ──────────────────────────────────────────────────────────────────────── */

const TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };
const ROMAN    = { 1: "I", 2: "II", 3: "III", 4: "IV" };

// Per-bracket × tier integrity envelope (matches seed-bestiary.macro.js).
const INTEGRITY = {
  light:  { I: 25, II: 32, III: 39, IV:  46 },
  medium: { I: 40, II: 50, III: 60, IV:  70 },
  heavy:  { I: 60, II: 75, III: 90, IV: 105 }
};

// Damage formula by bracket × tier (matches seed-bestiary-attacks.macro.js).
const DMG = {
  light:  { I: "1d6",  II: "1d8",  III: "2d6",  IV: "2d8"  },
  medium: { I: "1d8",  II: "1d10", III: "2d8",  IV: "2d10" },
  heavy:  { I: "1d10", II: "2d6",  III: "2d10", IV: "2d12" }
};

// RFI 7-damage canon.
function rfiType(canon) {
  const valid = ["kinetic", "energy", "sephirotic", "qliphothic", "psychic", "poison", "radiation"];
  return valid.includes(canon) ? canon : "kinetic";
}

// Default attribute (faculty) per role — feeds engage dialog auto-bonus.
const ROLE_ATTRIBUTE = {
  brute: "violence", stealth: "violence", scout: "violence",
  hardened: "violence", caster: "soul"
};

// Default skill per role — feeds engage dialog skill-bonus.
const ROLE_SKILL = {
  brute: "melee", stealth: "melee", scout: "firearms",
  hardened: "melee", caster: "channel"
};

// Attribute baselines by role (+1 per tier above I, applied at prefill).
function attrsFor(role, tierNum) {
  const t = Math.max(1, Math.min(4, Number(tierNum) || 1));
  const bonus = t - 1;
  const base = {
    brute:    { violence: 3, intrigue: 1, presence: 2, body: 3, mind: 1, soul: 1 },
    caster:   { violence: 1, intrigue: 2, presence: 2, body: 1, mind: 2, soul: 4 },
    stealth:  { violence: 2, intrigue: 4, presence: 1, body: 2, mind: 2, soul: 1 },
    scout:    { violence: 2, intrigue: 3, presence: 2, body: 2, mind: 3, soul: 1 },
    hardened: { violence: 2, intrigue: 1, presence: 2, body: 4, mind: 1, soul: 2 }
  }[role] || { violence: 2, intrigue: 2, presence: 2, body: 2, mind: 2, soul: 2 };
  const out = {};
  for (const k of Object.keys(base)) out[k] = base[k] + bonus;
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 *  ITEM FACTORIES (ported from seed-bestiary-attacks.macro.js — kit specs
 *  use { kind: "trait" | "attack" | "save" | "feature", ...payload }).
 *  ──────────────────────────────────────────────────────────────────────── */

function _damageFormula(spec, override) {
  if (override) return override;
  return DMG[spec.bracket][spec.tier];
}
function _saveDC(spec, override) {
  if (Number.isFinite(override)) return override;
  return 10 + TIER_INT[spec.tier] + (spec.role === "caster" ? 1 : 0);
}

function makeAttackItem(spec, atk) {
  const formula = _damageFormula(spec, atk.damageOverride);
  const dType   = rfiType(atk.damageType);
  const isMelee = !!atk.melee;
  const intent  = atk.intent ?? "violence";
  const skill   = atk.skill ?? (isMelee ? "melee" : (spec.role === "scout" ? "firearms" : "ranged"));
  const attr    = atk.attribute ?? ROLE_ATTRIBUTE[spec.role] ?? "violence";
  const flavor  = atk.damageFlavor ?? "";
  const range   = isMelee
    ? { short: Math.max(1, Math.round((atk.reach ?? 5) / 5)), long: Math.max(1, Math.round((atk.reach ?? 5) / 5)) }
    : { short: Math.max(1, Math.round((atk.shortRange ?? 60) / 5)), long: Math.max(1, Math.round((atk.longRange ?? 180) / 5)) };
  const reachLabel = isMelee
    ? `reach ${atk.reach ?? 5} ft.`
    : `range ${atk.shortRange ?? 60}/${atk.longRange ?? 180} ft.`;
  return {
    name: atk.name,
    type: "weapon",
    img:  atk.img ?? "icons/svg/sword.svg",
    system: {
      category: isMelee ? "melee" : "ranged",
      intent, skill,
      damage: {
        formula, attribute: attr, type: dType, damageFlavor: flavor,
        track: (dType === "psychic" || dType === "qliphothic") ? "stress" : "integrity"
      },
      range,
      tags: ["monster-builder-template", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`],
      effect: atk.riderText ?? "",
      flavor: atk.flavor ?? "",
      description: {
        value: `<p><strong>Strike.</strong> ${reachLabel}, one target. Damage: <code>${formula}</code> ${dType}${flavor ? ` (${flavor})` : ""} + ${attr}.${atk.riderText ? " " + atk.riderText : ""}</p>${atk.flavor ? `<p><em>${atk.flavor}</em></p>` : ""}`,
        chat: ""
      }
    },
    effects: [],
    flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "attack" } } } },
    folder: null, sort: 0, ownership: { default: 0 }
  };
}

function makeSaveItem(spec, save) {
  const formula = _damageFormula(spec, save.damageOverride);
  const dType   = rfiType(save.damageType);
  const dc      = _saveDC(spec, save.dcOverride);
  const attr    = save.attribute ?? ROLE_ATTRIBUTE[spec.role] ?? "soul";
  const skill   = save.skill ?? ROLE_SKILL[spec.role] ?? "channel";
  const intent  = save.intent ?? "presence";
  const flavor  = save.damageFlavor ?? "";
  const shape   = save.template?.shape ?? "radius";
  const size    = save.template?.size ?? 10;
  const SAVE_TO_DEFENSE = {
    con: "Resolve", dex: "Evasion", wis: "Resolve",
    str: "Guard", int: "Resolve", cha: "Resolve",
    body: "Resolve", presence: "Resolve", mind: "Resolve", soul: "Resolve",
    violence: "Guard", intrigue: "Evasion"
  };
  const targetDefense = SAVE_TO_DEFENSE[save.saveAbility] ?? "Resolve";
  const rechargeSuffix = save.recharge ? ` (Recharge ${save.recharge})` : (save.usesPerDay ? ` (${save.usesPerDay}/Day)` : "");
  const range = { short: Math.max(1, Math.round(size / 5)), long: Math.max(1, Math.round(size / 5)) };
  return {
    name: save.name + rechargeSuffix,
    type: "weapon",
    img:  save.img ?? "icons/svg/explosion.svg",
    system: {
      category: "ranged",
      intent, skill,
      damage: {
        formula, attribute: attr, type: dType, damageFlavor: flavor,
        track: (dType === "psychic" || dType === "qliphothic") ? "stress" : "integrity"
      },
      range,
      tags: ["monster-builder-template", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`, "aoe", `shape-${shape}`],
      effect: `${shape.charAt(0).toUpperCase() + shape.slice(1)} ${size} ft. — targets roll vs ${targetDefense} (DC ${dc}). Half damage on success.${save.riderText ? " " + save.riderText : ""}${save.recharge ? ` Recharge ${save.recharge}.` : (save.usesPerDay ? ` ${save.usesPerDay}/Day.` : "")}`,
      flavor: save.flavor ?? "",
      description: {
        value: `<p><strong>Area Attack.</strong> ${save.targetText ?? `Each creature in a ${size}-ft. ${shape}`} rolls <strong>${targetDefense}</strong> vs DC ${dc}. Hit: <code>${formula}</code> ${dType}${flavor ? ` (${flavor})` : ""} + ${attr}; half on success.${save.riderText ? " " + save.riderText : ""}${save.recharge ? `<br/><em>Recharge ${save.recharge}.</em>` : (save.usesPerDay ? `<br/><em>${save.usesPerDay} per day.</em>` : "")}</p>${save.flavor ? `<p><em>${save.flavor}</em></p>` : ""}`,
        chat: ""
      }
    },
    effects: [],
    flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "save", aoeShape: shape, aoeSize: size, dcAbility: save.saveAbility, dc } } } },
    folder: null, sort: 0, ownership: { default: 0 }
  };
}

function makeTraitItem(spec, trait) {
  return {
    name: trait.name,
    type: "feat",
    img:  trait.img ?? "icons/svg/upgrade.svg",
    system: {
      category: "technique",
      source: { revision: 1, rules: "2024" },
      tags: ["monster-builder-template", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`, "passive"],
      description: { value: `<p>${trait.desc}</p>${trait.flavor ? `<p><em>${trait.flavor}</em></p>` : ""}`, chat: "" },
      activities: {}, uses: { spent: 0, recovery: [] }, advancement: {},
      identifier: "", crewed: false, enchant: {},
      prerequisites: { items: [], repeatable: false },
      properties: [], requirements: "", type: { value: "", subtype: "" }
    },
    effects: [],
    flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "trait" } } } },
    folder: null, sort: 0, ownership: { default: 0 }
  };
}

function makeFeatureItem(spec, feat) {
  return {
    name: feat.name,
    type: "feature",
    img:  feat.img ?? "icons/magic/symbols/symbol-runes-purple.webp",
    system: {
      category: "principle", source: "",
      tags: ["monster-builder-template", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`],
      description: { value: `<p><strong>Passive.</strong> ${feat.desc}</p>${feat.flavor ? `<p><em>${feat.flavor}</em></p>` : ""}`, chat: "" }
    },
    effects: [],
    flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "feature" } } } },
    folder: null, sort: 0, ownership: { default: 0 }
  };
}

function buildItemsForKit(spec, items) {
  const out = [];
  for (const entry of items) {
    if (entry.kind === "trait")        out.push(makeTraitItem(spec,   entry));
    else if (entry.kind === "attack")  out.push(makeAttackItem(spec,  entry));
    else if (entry.kind === "save")    out.push(makeSaveItem(spec,    entry));
    else if (entry.kind === "feature") out.push(makeFeatureItem(spec, entry));
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
 *  CREATURE-TYPE CATEGORIES + STARTER CHIPS
 *  Each chip pre-fills the form; the `kit` is seeded on commit. Damage
 *  formulas scale to the form's tier × bracket at create time, so the GM
 *  can promote a T1 wolf into a T3 dire-thing and the powers scale.
 *  ──────────────────────────────────────────────────────────────────────── */

const CREATURE_CATEGORIES = [
  { key: "beast",      label: "Beasts",      domain: "Wildlife · Predator authoring" },
  { key: "humanoid",   label: "Humanoids",   domain: "Mortal · Combatant authoring" },
  { key: "undead",     label: "Undead",      domain: "Revenant · Haunt authoring" },
  { key: "construct",  label: "Constructs",  domain: "Relic · Automaton authoring" },
  { key: "aberration", label: "Aberrations", domain: "Hex-Touched · Eldritch authoring" },
  { key: "fiend",      label: "Fiends",      domain: "Dream · Predator-of-souls authoring" },
  { key: "elemental",  label: "Elementals",  domain: "Saturated · Force-made-flesh authoring" },
  { key: "swarm",      label: "Swarms",      domain: "Many-as-one authoring" }
];

const CREATURE_STARTERS = [

  // ── BEASTS ──────────────────────────────────────────────────────────────
  // Apex pack hunter; reference creature class — fully authored canon kit.
  { key: "ash-wolf", category: "beast", label: "Ash Wolf",
    description: "T1 light brute · apex pack hunter of the burn-zones. Coat smokes when angered.",
    defaults: {
      role: "brute", bracket: "light", tier: 1, sephirah: "malkuth",
      archetype: "ash-wolf",
      themes: "wildlife, predator, pack",
      resistances: "", immunities: "", vulnerabilities: "",
      conditionImmunities: "",
      concept: "Apex pack hunter of the burn-zones. Coat smokes when angered.",
      signature: "The coat smokes when angered. The bite carries the heat.",
      currency: "violence",
      img: "icons/creatures/abilities/wolf-howl-moon-grey.webp",
      loot: [
        { name: "Herd Leather", qty: "1d2", weight: 5 },
        { name: "Ash-Wood",     qty: "1",   weight: 3 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Pack Tactics",
        desc: "The ash wolf has reroll the lowest die on attack rolls against any creature within 5 ft. of an ally that isn't incapacitated.",
        flavor: "They circle. They cut you off. Then they bite." },
      { kind: "attack",
        name: "Smoldering Bite",
        melee: true, reach: 5,
        damageType: "kinetic", damageFlavor: "bite",
        riderText: "On a hit, the target's clothing or fur catches a slow burn — 1 energy damage at the start of its next turn unless it spends an action to put it out.",
        flavor: "The coat smokes when angered. The bite carries the heat." },
      { kind: "save",
        name: "Burn-Zone Lunge",
        recharge: "5–6",
        saveAbility: "dex",
        damageType: "energy", damageFlavor: "cinder",
        template: { shape: "line", size: 15 },
        targetText: "Each creature in a 15-ft. line the wolf moves through",
        riderText: "Wolf can move up to its speed in a straight line as part of this action; it doesn't provoke opportunity attacks from the line.",
        flavor: "It runs along the burn and lets the burn run along it." }
    ]
  },

  // ── HUMANOIDS ───────────────────────────────────────────────────────────
  // Disciplined raider infantry — the workhorse mortal antagonist.
  { key: "raider-marauder", category: "humanoid", label: "Raider Marauder",
    description: "T2 medium brute · standing infantry of a raider warband. Disciplined enough to hold a line.",
    defaults: {
      role: "brute", bracket: "medium", tier: 2, sephirah: "malkuth",
      archetype: "raider-marauder",
      themes: "humanoid, raider, military",
      resistances: "", immunities: "", vulnerabilities: "",
      conditionImmunities: "",
      concept: "Standing infantry of a raider warband. Disciplined enough to hold a line.",
      signature: "The line is the doctrine; the doctrine works.",
      currency: "violence",
      img: "icons/environment/people/commoner.webp",
      loot: [
        { name: "Heart-Iron", qty: "1",   weight: 4 },
        { name: "Rad-Iron",   qty: "1d2", weight: 3 },
        { name: "Cold-Iron",  qty: "1",   weight: 2 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Discipline of the Line",
        desc: "While within 5 ft. of at least one ally Marauder, the marauder has reroll-the-lowest on attack rolls. The line is the doctrine; the doctrine works.",
        flavor: "Trained to hold position. Trained to break position only on the captain's word." },
      { kind: "attack",
        name: "Line-Cleaver",
        melee: true, reach: 5,
        damageType: "kinetic", damageFlavor: "cleaver",
        riderText: "On a hit, if any adjacent ally Marauder hasn't acted this round, that ally may immediately move up to 5 ft. as a reaction (closing the line).",
        flavor: "Big single-edged blade. Designed to interrupt postures, not lives." },
      { kind: "attack",
        name: "Suppression Volley",
        melee: false, shortRange: 60, longRange: 180,
        damageType: "kinetic", damageFlavor: "slug-volley",
        riderText: "Reduced damage (1d6 instead of base) but on a hit, the target has reroll-the-highest on their next attack roll (suppressed).",
        flavor: "Less about killing them and more about making them not stand up." }
    ]
  },

  // ── UNDEAD ──────────────────────────────────────────────────────────────
  // Battlefield revenant of crystallized grief.
  { key: "salt-wraith", category: "undead", label: "Salt Wraith",
    description: "T1 light caster · battlefield revenant of crystallized grief. Drains warmth and resolve.",
    defaults: {
      role: "caster", bracket: "light", tier: 1, sephirah: "malkuth",
      archetype: "salt-wraith",
      themes: "undead, haunting",
      resistances: "kinetic", immunities: "", vulnerabilities: "radiant",
      conditionImmunities: "charmed, shaken",
      concept: "Battlefield revenant of crystallized grief. Drains warmth and resolve.",
      signature: "The wraith does not speak. The salt speaks for it.",
      currency: "softpower",
      img: "icons/creatures/magical/spirit-undead-armored-blue.webp",
      loot: [
        { name: "Salt Block",    qty: "1d3", weight: 5 },
        { name: "Memory Resin",  qty: "1",   weight: 2 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Crystallized Grief",
        desc: "The wraith has resistance to kinetic damage and vulnerability to sephirotic damage. Cannot be Charmed or Shaken (it is already nothing but those things).",
        flavor: "Salt remembers what salt is for. The wraith remembers the screaming." },
      { kind: "attack",
        name: "Drain-Touch",
        melee: true, reach: 5,
        damageType: "qliphothic", damageFlavor: "warmth-theft",
        riderText: "On a hit, the target's Stress increases by 1d4 and the wraith regains that much Integrity. The target feels cold for an hour.",
        flavor: "It does not hate you. It just needs what you have." },
      { kind: "save",
        name: "Salt-Sermon",
        saveAbility: "cha",
        damageType: "psychic", damageFlavor: "lament",
        template: { shape: "radius", size: 15 },
        targetText: "Each creature within 15 ft.",
        riderText: "Failed-save targets remember a death that wasn't theirs — Shaken until the start of their next turn.",
        flavor: "The wraith does not speak. The salt speaks for it." }
    ]
  },

  // ── CONSTRUCTS ──────────────────────────────────────────────────────────
  // Pre-Fall relic guardian still on patrol.
  { key: "pre-fall-sentinel", category: "construct", label: "Pre-Fall Sentinel",
    description: "T2 medium hardened · a relic guardian still patrolling a pre-Fall installation. Doesn't recognize the new world.",
    defaults: {
      role: "hardened", bracket: "medium", tier: 2, sephirah: "malkuth",
      archetype: "pre-fall-sentinel",
      themes: "construct, pre-fall, guardian",
      resistances: "kinetic, radiant", immunities: "", vulnerabilities: "",
      conditionImmunities: "charmed, shaken, compelled",
      concept: "A relic guardian still patrolling a pre-Fall installation. Doesn't recognize the new world.",
      signature: "It is still patrolling. The patrol route includes the place you are standing.",
      currency: "intrigue",
      img: "icons/commodities/tech/cog-steel.webp",
      loot: [
        { name: "Pre-Fall Component", qty: "1", weight: 2 },
        { name: "Heart-Coil",         qty: "1", weight: 3 },
        { name: "Scribed Steel",      qty: "1", weight: 4 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Outdated Recognition",
        desc: "The sentinel has resistance to kinetic and sephirotic damage and is immune to Charmed / Shaken / Compelled. Treats anyone without proper pre-fall credentials as a hostile intruder (i.e., everyone alive).",
        flavor: "It is still patrolling. The patrol route includes the place you are standing." },
      { kind: "attack",
        name: "Pre-Fall Halberd",
        melee: true, reach: 10,
        damageType: "kinetic", damageFlavor: "polearm-edge",
        riderText: "On a hit, the target must succeed a DC 13 Body save or be pushed 5 ft. (the sentinel is enforcing a perimeter, not killing).",
        flavor: "The blade has not been sharpened since before the Fall. It does not need to be." },
      { kind: "attack",
        name: "Classification Scan",
        melee: false, shortRange: 60, longRange: 180,
        damageType: "energy", damageFlavor: "scan-beam",
        riderText: "On a hit, target is flagged: until the sentinel falls, ALL pre-fall constructs within 1 mile know the target's exact position. Cumulative — multiple scans deepen the flag.",
        flavor: "A blue line touches you. You feel briefly less alone, and very afraid." }
    ]
  },

  // ── ABERRATIONS / HEX-TOUCHED ───────────────────────────────────────────
  // Reference creature — fully authored canon kit.
  { key: "crystal-lurker", category: "aberration", label: "Crystal Lurker",
    description: "T2 light stealth · hex-touched humanoid encased in slow-growing crystal armor. Strikes from cave shadows.",
    defaults: {
      role: "stealth", bracket: "light", tier: 2, sephirah: "malkuth",
      archetype: "crystal-lurker",
      themes: "hex-touched, ambusher, cave",
      resistances: "", immunities: "", vulnerabilities: "",
      conditionImmunities: "",
      concept: "Hex-touched humanoid encased in slow-growing crystal armor. Strikes from cave shadows.",
      signature: "The armor is not finished. It is still growing.",
      currency: "intrigue",
      img: "icons/magic/water/water-iceberg-bubbles.webp",
      loot: [
        { name: "Crystal Fragment", qty: "1d3", weight: 5 },
        { name: "Fogged Quartz",    qty: "1",   weight: 3 },
        { name: "Focused Crystal",  qty: "1",   weight: 1 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Crystal Carapace",
        desc: "First attack each combat against the lurker has reroll-the-highest (the carapace turns the first blow). After the carapace cracks, the lurker gains +1 to its next attack roll (the loose shards bite).",
        flavor: "The armor is not finished. It is still growing." },
      { kind: "attack",
        name: "Crystal Spike",
        melee: true, reach: 5,
        damageType: "kinetic", damageFlavor: "shard-punch",
        riderText: "On a hit, the target takes 1 additional damage at the start of its next turn unless it spends an action to remove the embedded shard.",
        flavor: "The lurker does not let go of the strike. The strike does not let go of you." },
      { kind: "save",
        name: "Dazzle-Burst",
        recharge: "5–6",
        saveAbility: "con",
        damageType: "sephirotic", damageFlavor: "refracted-light",
        template: { shape: "radius", size: 15 },
        targetText: "Each creature within 15 ft. that can see the lurker",
        riderText: "Failed-save targets are Blinded until the start of their next turn.",
        flavor: "The cavern catches fire. Slowly. In every direction." }
    ]
  },

  // ── FIENDS ──────────────────────────────────────────────────────────────
  // Dream-fiend echo harvester.
  { key: "soma-reaper", category: "fiend", label: "Soma-Reaper",
    description: "T3 medium stealth · a dream-fiend that harvests Soma-Break echoes from sleepers. Half-real until it strikes.",
    defaults: {
      role: "stealth", bracket: "medium", tier: 3, sephirah: "yesod",
      archetype: "soma-reaper",
      themes: "fiend, dream, harvester",
      resistances: "", immunities: "", vulnerabilities: "",
      conditionImmunities: "shaken",
      concept: "A dream-fiend that harvests Soma-Break echoes from sleepers. Half-real until it strikes.",
      signature: "It is here. Sort of. The 'sort of' is the dangerous part.",
      currency: "nonlethal",
      img: "icons/creatures/magical/spirit-undead-horned-blue.webp",
      loot: [
        { name: "Marrow Tincture", qty: "1",   weight: 4 },
        { name: "Memory Resin",    qty: "1d2", weight: 5 },
        { name: "Witness-Glass",   qty: "1",   weight: 1 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Half-Real",
        desc: "Until the soma-reaper attacks, attacks against it have reroll-the-highest. The first strike fully manifests it. After that, normal targeting applies for the rest of the scene.",
        flavor: "It is here. Sort of. The 'sort of' is the dangerous part." },
      { kind: "attack",
        name: "Dreamcut",
        melee: true, reach: 5,
        damageType: "psychic", damageFlavor: "sleep-edge",
        riderText: "On a hit, target also loses 1d4 Clarity (the reaper harvests Soma-Break echoes from waking minds too).",
        flavor: "A wound that you don't notice until you try to wake up from it." },
      { kind: "attack",
        name: "Echo-Pluck",
        melee: false, shortRange: 30, longRange: 90,
        damageType: "psychic", damageFlavor: "memory-thread",
        riderText: "On a hit, the target forgets the last meaningful thing they did until end of next turn (lose access to that action's benefits — e.g., a buff just granted is missed).",
        flavor: "It is not stealing memory. It is just reading the strand back. Backwards." },
      { kind: "save",
        name: "Soma-Drain Field",
        recharge: "5–6",
        saveAbility: "wis",
        damageType: "psychic", damageFlavor: "echo-pull",
        template: { shape: "radius", size: 20 },
        targetText: "Each creature within 20 ft.",
        riderText: "On a failed save, the target's next Soma Break restores half as much (one stage of harvest). Multiple failures stack; refreshes on a true rest.",
        flavor: "The room briefly tastes of someone else's morning." }
    ]
  },

  // ── ELEMENTALS ──────────────────────────────────────────────────────────
  // Reference creature — authored fresh in canon voice.
  { key: "lisa-frank-elemental", category: "elemental", label: "Lisa Frank Elemental",
    description: "T1 medium caster · an elemental of saturated joy — color given will and motion. Beautiful, overwhelming, and not remotely safe.",
    defaults: {
      role: "caster", bracket: "medium", tier: 1, sephirah: "tiferet",
      archetype: "joy-elemental-saturated",
      themes: "elemental, joy, saturated",
      resistances: "energy", immunities: "", vulnerabilities: "qliphothic",
      conditionImmunities: "charmed, shaken",
      concept: "An elemental of saturated joy — color given will and motion. Beautiful, overwhelming, and not remotely safe. Where it walks, the air goes glittery and people remember being eight.",
      signature: "It does not roar. It hums a song you almost recognize, and the song is louder than your name.",
      currency: "softpower",
      img: "icons/magic/light/explosion-star-pink.webp",
      loot: [
        { name: "Prism Shard",  qty: "1d2", weight: 5 },
        { name: "Joy-Resin",    qty: "1",   weight: 3 },
        { name: "Saturated Pigment", qty: "1", weight: 2 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Saturated",
        desc: "Creatures starting their turn within 10 ft. of the elemental must succeed a DC 11 Mind save or have reroll-the-highest on attack rolls until the start of their next turn (overwhelmed by color). Immune to Charmed and Shaken — it is nothing but mood.",
        flavor: "It is too much. It was always going to be too much. The dial does not have a lower setting." },
      { kind: "attack",
        name: "Prism Lash",
        melee: true, reach: 5,
        damageType: "energy", damageFlavor: "rainbow-arc",
        riderText: "On a hit, the target briefly delights against their will — they have reroll-the-highest on their next damage roll against the elemental (it's hard to swing meanly at a thing this pretty).",
        flavor: "A whip of saturated light. It does not burn. It dyes." },
      { kind: "save",
        name: "Glitterburst",
        recharge: "5–6",
        saveAbility: "con",
        damageType: "sephirotic", damageFlavor: "saturated-light",
        template: { shape: "radius", size: 15 },
        targetText: "Each creature within 15 ft.",
        riderText: "Failed-save targets are Blinded until the start of their next turn (overwhelmed by color); a thin layer of glitter clings to skin and gear and refuses to wash out for the rest of the scene.",
        flavor: "The room becomes a feeling. The feeling has a color. The color is everywhere." },
      { kind: "feature",
        name: "Made of Mood",
        desc: "Immune to poison, disease, and exhaustion. Resistance to energy damage. The first time the elemental would drop to 0 Integrity, it instead bursts into a harmless shower of color — next round it re-forms at half Integrity in the same square. Once per scene.",
        flavor: "The joy is hard to kill. The joy was never the body. The body was always the joy's idea." }
    ]
  },

  // ── SWARMS ──────────────────────────────────────────────────────────────
  // Boils out of stagnant mire when disturbed.
  { key: "bog-skitter-swarm", category: "swarm", label: "Bog-Skitter Swarm",
    description: "T1 light brute · insect swarm that boils out of stagnant mire when disturbed. Bites are venomous.",
    defaults: {
      role: "brute", bracket: "light", tier: 1, sephirah: "malkuth",
      archetype: "bog-skitter",
      themes: "wildlife, swarm, insect",
      resistances: "", immunities: "", vulnerabilities: "fire",
      conditionImmunities: "",
      concept: "Insect swarm that boils out of stagnant mire when disturbed. Bites are venomous.",
      signature: "Not one thing. Many things that have agreed on a direction.",
      currency: "violence",
      img: "icons/creatures/abilities/mouth-teeth-rotted.webp",
      loot: [
        { name: "Mire-Resin",   qty: "1d2", weight: 4 },
        { name: "Reagent Moss", qty: "1",   weight: 2 }
      ]
    },
    kit: [
      { kind: "trait",
        name: "Swarm",
        desc: "The swarm occupies the same space as another creature and can move through any opening at least 1 inch wide. While it has more than half its Integrity, attacks against it have reroll-the-highest.",
        flavor: "Not one thing. Many things that have agreed on a direction." },
      { kind: "attack",
        name: "Boiling Bites",
        melee: true, reach: 0,
        damageType: "poison", damageFlavor: "venom",
        riderText: "Auto-hits any creature sharing the swarm's space. On a hit, target must succeed a DC 12 Body save or have reroll-the-highest on its next action (venom haze).",
        flavor: "There is no first bite. There is only the realization of biting." },
      { kind: "save",
        name: "Mire-Disperse",
        saveAbility: "dex",
        damageType: "poison", damageFlavor: "stinging-mist",
        template: { shape: "radius", size: 10 },
        targetText: "Each creature within 10 ft. when the swarm is bloodied (half Integrity or lower)",
        riderText: "Triggers automatically the first time the swarm drops below half Integrity — the swarm scatters wide before re-coalescing.",
        flavor: "Wound it and it just becomes a wider problem." }
    ]
  }
];

/* ──────────────────────────────────────────────────────────────────────────
 *  HTML / DIALOG
 *  ──────────────────────────────────────────────────────────────────────── */

function _esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function _factionOptions() {
  const factions = (game.actors?.contents ?? [])
    .filter(a => {
      try {
        return a.getFlag?.("bbttcc-factions", "isFaction")
          || a?.flags?.["bbttcc-factions"]?.isFaction
          || String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase() === "faction";
      } catch { return false; }
    })
    .map(a => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return ['<option value="">— Unaffiliated —</option>']
    .concat(factions.map(f => `<option value="${f.id}">${_esc(f.name)}</option>`))
    .join("");
}

function _categoryTabsHTML() {
  return CREATURE_CATEGORIES.map(c => `
    <button type="button" class="bbttcc-mb-tab" data-bbttcc-cat="${_esc(c.key)}"
            style="cursor:pointer; padding:0.25rem 0.75rem; border:1px solid rgba(255,255,255,0.18); border-radius:4px; font-size:0.8rem; background:rgba(255,255,255,0.06); color:inherit;">
      ${_esc(c.label)}
    </button>`).join(" ");
}

function _chipRowsHTML() {
  return CREATURE_CATEGORIES.map(c => {
    const chips = CREATURE_STARTERS
      .filter(t => t.category === c.key)
      .map((t, i) => {
        const idx = CREATURE_STARTERS.indexOf(t);
        return `
          <button type="button" class="ft-manifest-chip" data-bbttcc-starter="${_esc(t.key)}"
                  data-bbttcc-idx="${idx}" title="${_esc(t.description)}"
                  style="cursor:pointer; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06);">
            ${_esc(t.label)}
          </button>`;
      }).join(" ") || `<span class="ft-prev-align-note" style="opacity:0.7;">No templates in this category yet.</span>`;
    return `<div data-bbttcc-chiprow="${_esc(c.key)}" style="display:none; flex-wrap:wrap; gap:0.35rem; margin-top:0.4rem;">${chips}</div>`;
  }).join("");
}

const ROLE_OPTS = ["brute", "caster", "stealth", "scout", "hardened"];
const BRACKET_OPTS = ["light", "medium", "heavy"];
const SEPHIRAH_OPTS = [
  "kether", "chokmah", "binah", "chesed", "geburah",
  "tiferet", "netzach", "hod", "yesod", "malkuth"
];
const FACULTY_KEYS = ["violence", "intrigue", "presence", "body", "mind", "soul"];

function _bracketOpts(sel = "light") {
  return BRACKET_OPTS.map(b => `<option value="${b}"${b === sel ? " selected" : ""}>${b.charAt(0).toUpperCase() + b.slice(1)}</option>`).join("");
}
function _roleOpts(sel = "brute") {
  return ROLE_OPTS.map(r => `<option value="${r}"${r === sel ? " selected" : ""}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`).join("");
}
function _tierOpts(sel = 1) {
  return [1, 2, 3, 4].map(t => `<option value="${t}"${Number(sel) === t ? " selected" : ""}>Tier ${"I".repeat(t)}</option>`).join("");
}
function _sephirahOpts(sel = "malkuth") {
  return SEPHIRAH_OPTS.map(s => `<option value="${s}"${s === sel ? " selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("");
}

export async function openMonsterBuilder() {
  const factionOpts = _factionOptions();
  const tabsHTML    = _categoryTabsHTML();
  const chipRowsHTML = _chipRowsHTML();

  const facultyGrid = FACULTY_KEYS.map(k => `
    <div class="ft-cast-field" style="display:flex; align-items:center; gap:0.35rem;">
      <label style="flex:1 1 auto; margin-bottom:0; text-transform:none; opacity:1; font-size:0.78rem;">${k.charAt(0).toUpperCase() + k.slice(1)}</label>
      <input type="number" data-bbttcc-attr="${k}" value="2" min="-2" max="10" style="width:3.2rem; text-align:right;"/>
    </div>`).join("");

  const content = `
<div class="ft-cast-dialog ft-manifest-dialog bbttcc-monster-builder">
  <div class="ft-manifest-dialog-guide" style="border-color:#2eaa5eaa; background:rgba(46,170,94,0.08);">
    <div class="ft-manifest-dialog-title">Create Monster</div>
    <div class="ft-manifest-dialog-domain">Bestiary · Stat-block authoring</div>
    <div class="ft-manifest-dialog-copy">
      Bring a creature into the world. Pick a category, pick a template, and the
      whole canon stat block snaps in — faculties, integrity, defenses, themes.
      The kit (strikes, saves, passive traits) seeds onto the actor on create.
    </div>

    <div class="bbttcc-mb-tabs" style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.55rem;">
      ${tabsHTML}
    </div>

    ${chipRowsHTML}

    <ul class="ft-manifest-dialog-list" style="margin-top:0.4rem;">
      <li>Pick a category tab, then a template chip — faculties / integrity / stress / defenses prefill.</li>
      <li>Bracket × Tier sets the integrity envelope; role + tier sets faculty baselines. You can edit any number afterwards.</li>
      <li>On create, the template's trait / strike / save / feature items are embedded — they show up on the NPC sheet's Strikes + Features sections.</li>
    </ul>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.6rem;">
    <div class="ft-prev-label">Who is this?</div>
    <div class="ft-prev-align-note">Name them, name what they are. Faction is optional.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Name <span style="color:#f87171">*</span></label>
      <input type="text" data-bbttcc-field="name" required autofocus placeholder="e.g. Glass-Eyed Wolf, Salt-Sister, Crystal Lurker"/></div>
    <div class="ft-cast-field"><label>Archetype</label>
      <input type="text" data-bbttcc-field="archetype" placeholder="e.g. ash-wolf, joy-elemental-saturated"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Concept</label>
      <textarea data-bbttcc-field="concept" rows="2" placeholder="What is this creature in plain language? What does encountering it feel like?"></textarea></div>
    <div class="ft-cast-field"><label>Faction</label>
      <select data-bbttcc-field="factionId">${factionOpts}</select></div>
    <div class="ft-cast-field"><label>Token Disposition</label>
      <select data-bbttcc-field="disposition">
        <option value="-1" selected>Hostile</option>
        <option value="0">Neutral</option>
        <option value="1">Friendly</option>
        <option value="-2">Secret</option>
      </select></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Shape and scale</div>
    <div class="ft-prev-align-note">Role + Tier sets faculty baselines; Bracket × Tier sets the integrity envelope. Editing role / tier / bracket recomputes the derived block — your manual faculty / integrity edits are overwritten.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Role</label>
      <select data-bbttcc-field="role">${_roleOpts("brute")}</select></div>
    <div class="ft-cast-field"><label>Tier</label>
      <select data-bbttcc-field="tier">${_tierOpts(1)}</select></div>
    <div class="ft-cast-field"><label>Bracket</label>
      <select data-bbttcc-field="bracket">${_bracketOpts("light")}</select></div>
    <div class="ft-cast-field"><label>Sephirah</label>
      <select data-bbttcc-field="sephirah">${_sephirahOpts("malkuth")}</select></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Faculties</div>
    <div class="ft-prev-align-note">Standard six. Auto-fills from role × tier; tweak as needed for a specific creature.</div>
  </div>
  <div class="ft-cast-grid" style="grid-template-columns: 1fr 1fr 1fr;">
    ${facultyGrid}
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Tracks</div>
    <div class="ft-prev-align-note">Integrity = physical track; Stress = mind/soul track. Guard / Evasion / Resolve derive at commit from tier + role.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Integrity (Max)</label>
      <input type="number" data-bbttcc-field="integrity" value="25" min="1" step="1"/></div>
    <div class="ft-cast-field"><label>Stress (Max)</label>
      <input type="number" data-bbttcc-field="stress" value="12" min="1" step="1"/></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Defenses and provenance</div>
    <div class="ft-prev-align-note">Comma-separated damage / condition tags. Themes are used by encounter tables; signature is the one strange detail that makes this creature unmistakable.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field ft-cast-span-2"><label>Resistances</label>
      <input type="text" data-bbttcc-field="resistances" placeholder="e.g. kinetic, radiant"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Immunities</label>
      <input type="text" data-bbttcc-field="immunities" placeholder="e.g. poison, fear"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Vulnerabilities</label>
      <input type="text" data-bbttcc-field="vulnerabilities" placeholder="e.g. fire, radiant, true-name"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Condition Immunities</label>
      <input type="text" data-bbttcc-field="conditionImmunities" placeholder="e.g. charmed, shaken, compelled"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Themes (bestiary tags)</label>
      <input type="text" data-bbttcc-field="themes" placeholder="comma-separated, e.g. wildlife, predator, pack"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Signature / Third Thing</label>
      <input type="text" data-bbttcc-field="signature" placeholder="The one strange detail that makes this creature unmistakable."/></div>
  </div>

  <p style="opacity:0.7; font-size:0.78rem; margin:0.6rem 0 0;">
    Templates seed a curated kit (trait + strike + save, sometimes a feature). After creation, open the sheet to add more, retune defenses, or restamp art.
  </p>

  <!-- Hidden plumbing — read at commit. -->
  <input type="hidden" data-bbttcc-field="_starterKey" value=""/>
  <input type="hidden" data-bbttcc-field="_category"   value="beast"/>
</div>`;

  return new Promise((resolve) => {
    const dlg = new Dialog({
      title: "Create RFI Monster",
      content,
      buttons: {
        create: {
          icon: "<i class='fas fa-paw'></i>",
          label: "Create Monster",
          callback: async (html) => {
            const root = (html instanceof HTMLElement ? html : html[0]);
            const actor = await _commit(root);
            resolve(actor);
          }
        },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "create",
      render: (html) => {
        _wireCategoryTabs(html);
        _wireStarterChips(html);
        _wireDerivedRecompute(html);
      }
    }, {
      classes: ["fourththing", "ft-manifestation-wizard-window", "bbttcc-monster-builder-window"],
      width: 760,
      height: 820,
      resizable: true
    });
    dlg.render(true);
  });
}

/* Category tab switching — show one chip row at a time, highlight active. */
function _wireCategoryTabs(html) {
  const root = (html instanceof HTMLElement ? html : html?.[0]);
  if (!root) return;
  const activeCss = "cursor:pointer; padding:0.25rem 0.75rem; border:1px solid #2eaa5e; border-radius:4px; font-size:0.8rem; background:rgba(46,170,94,0.28); color:inherit;";
  const idleCss   = "cursor:pointer; padding:0.25rem 0.75rem; border:1px solid rgba(255,255,255,0.18); border-radius:4px; font-size:0.8rem; background:rgba(255,255,255,0.06); color:inherit;";
  const DOMAINS = Object.fromEntries(CREATURE_CATEGORIES.map(c => [c.key, c.domain]));

  const setCat = (cat) => {
    root.dataset.bbttccCategory = cat;
    const catEl = root.querySelector('[data-bbttcc-field="_category"]');
    if (catEl) catEl.value = cat;
    root.querySelectorAll(".bbttcc-mb-tab").forEach(t => {
      t.style.cssText = (t.dataset.bbttccCat === cat) ? activeCss : idleCss;
    });
    root.querySelectorAll("[data-bbttcc-chiprow]").forEach(r => {
      r.style.display = (r.dataset.bbttccChiprow === cat) ? "flex" : "none";
    });
    const dom = root.querySelector(".ft-manifest-dialog-domain");
    if (dom) dom.textContent = DOMAINS[cat] ?? "Bestiary · Stat-block authoring";
  };

  root.querySelectorAll(".bbttcc-mb-tab").forEach(tab => {
    tab.addEventListener("click", () => setCat(tab.dataset.bbttccCat));
  });
  setCat(root.querySelector('[data-bbttcc-field="_category"]')?.value || "beast");
}

/* Chip click → prefill the whole form (faculties, integrity/stress, defenses,
 * themes, concept, signature). Records the chip key in a hidden input so the
 * commit path can recover the kit to seed.
 */
function _wireStarterChips(html) {
  const root = (html instanceof HTMLElement ? html : html?.[0]);
  if (!root) return;
  root.querySelectorAll("[data-bbttcc-starter]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.bbttccIdx);
      const tpl = CREATURE_STARTERS[idx];
      if (!tpl) return;
      const d = tpl.defaults;
      const set = (name, val) => {
        if (val == null) return;
        const el = root.querySelector(`[data-bbttcc-field="${name}"]`);
        if (el) el.value = val;
      };
      const setAttr = (k, v) => {
        const el = root.querySelector(`[data-bbttcc-attr="${k}"]`);
        if (el && v != null) el.value = v;
      };

      // Identity / narrative.
      set("_starterKey", tpl.key);
      set("name", tpl.label);
      set("archetype", d.archetype ?? tpl.key);
      set("concept", d.concept ?? "");
      set("signature", d.signature ?? "");

      // Shape and scale.
      set("role", d.role ?? "brute");
      set("tier", d.tier ?? 1);
      set("bracket", d.bracket ?? "light");
      set("sephirah", d.sephirah ?? "malkuth");

      // Faculties — auto-derived from role × tier.
      const attrs = attrsFor(d.role ?? "brute", d.tier ?? 1);
      for (const k of FACULTY_KEYS) setAttr(k, attrs[k]);

      // Tracks.
      const integ = INTEGRITY[d.bracket ?? "light"]?.[ROMAN[d.tier ?? 1]] ?? 25;
      set("integrity", integ);
      set("stress", Math.floor(integ * 0.5));

      // Defenses + themes.
      set("resistances",         d.resistances ?? "");
      set("immunities",          d.immunities ?? "");
      set("vulnerabilities",     d.vulnerabilities ?? "");
      set("conditionImmunities", d.conditionImmunities ?? "");
      set("themes",              d.themes ?? "");

      // Highlight active chip.
      root.querySelectorAll("[data-bbttcc-starter]").forEach(b => {
        b.style.background = b === btn ? "rgba(46,170,94,0.22)" : "rgba(255,255,255,0.06)";
      });
    });
  });
}

/* When role / tier / bracket change, recompute the derived stat block
 * (faculties, integrity, stress). Defenses / themes / concept / signature
 * are author-set and never auto-recomputed.
 */
function _wireDerivedRecompute(html) {
  const root = (html instanceof HTMLElement ? html : html?.[0]);
  if (!root) return;
  const get = (name) => root.querySelector(`[data-bbttcc-field="${name}"]`)?.value ?? "";
  const set = (name, val) => {
    const el = root.querySelector(`[data-bbttcc-field="${name}"]`);
    if (el) el.value = val;
  };
  const recompute = () => {
    const role    = String(get("role")    || "brute");
    const bracket = String(get("bracket") || "light");
    const tier    = Math.max(1, Math.min(4, Number(get("tier")) || 1));
    const attrs   = attrsFor(role, tier);
    for (const k of FACULTY_KEYS) {
      const el = root.querySelector(`[data-bbttcc-attr="${k}"]`);
      if (el) el.value = attrs[k];
    }
    const integ = INTEGRITY[bracket]?.[ROMAN[tier]] ?? 25;
    set("integrity", integ);
    set("stress", Math.floor(integ * 0.5));
  };
  for (const k of ["role", "tier", "bracket"]) {
    const el = root.querySelector(`[data-bbttcc-field="${k}"]`);
    if (el) el.addEventListener("change", recompute);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 *  COMMIT — build npc actor + seed kit items
 *  ──────────────────────────────────────────────────────────────────────── */

async function _commit(root) {
  if (!root) return null;
  const read = (name) => root.querySelector(`[data-bbttcc-field="${name}"]`)?.value ?? "";
  const readAttr = (k) => Number(root.querySelector(`[data-bbttcc-attr="${k}"]`)?.value ?? 0) || 0;
  const csv  = (name) => String(read(name) || "").split(",").map(s => s.trim()).filter(Boolean);

  const name = String(read("name") || "").trim();
  if (!name) {
    ui.notifications?.warn?.("RFI Monster needs a name.");
    return null;
  }

  const role        = String(read("role") || "brute");
  const bracket     = String(read("bracket") || "light");
  const tierNum     = Math.max(1, Math.min(4, Number(read("tier")) || 1));
  const tierRoman   = ROMAN[tierNum];
  const sephirah    = String(read("sephirah") || "malkuth");
  const archetype   = String(read("archetype") || "").trim() || name.toLowerCase().replace(/\s+/g, "-");
  const concept     = String(read("concept") || "").trim();
  const signature   = String(read("signature") || "").trim();
  const factionId   = String(read("factionId") || "").trim();
  const disposition = Number(read("disposition") ?? -1);

  // Faculties — read from form (chip prefilled, GM may have tweaked).
  const attributes = {};
  for (const k of FACULTY_KEYS) attributes[k] = { value: readAttr(k) };

  // Tracks — read from form; recompute defaults if blank/invalid.
  const integMax  = Math.max(1, Number(read("integrity")) || INTEGRITY[bracket][tierRoman] || 25);
  const stressMax = Math.max(1, Number(read("stress"))    || Math.floor(integMax * 0.5));

  // Derived defenses — canon formulas (matches seed-bestiary.macro.js).
  const guard   = 10 + tierNum;
  const evasion = guard + (role === "stealth" ? 2 : 0);
  const resolve = guard + (role === "caster"  ? 2 : 0);

  const resistances        = csv("resistances");
  const immunities         = csv("immunities");
  const vulnerabilities    = csv("vulnerabilities");
  const conditionImmunities = csv("conditionImmunities");
  const themes             = csv("themes");

  // Pull starter key (used to source kit + loot + img).
  const starterKey = String(read("_starterKey") || "");
  const starter = starterKey ? CREATURE_STARTERS.find(t => t.key === starterKey) : null;
  const img = starter?.defaults?.img || "icons/svg/mystery-man.svg";
  const loot = Array.isArray(starter?.defaults?.loot) ? starter.defaults.loot : [];
  const currency = starter?.defaults?.currency || "violence";
  const category = String(read("_category") || starter?.category || "");

  // Best-effort RFI pricing (non-fatal if unavailable).
  let price = null;
  try {
    const p = game.fourththing?.pricing?.computeBossPricing?.({ tier: tierRoman, bracket });
    if (p) {
      price = {
        marks: p.bounty, bounty: p.bounty, hire: p.hire, ransom: p.ransom,
        currency, gmOverride: false,
        notes: `T${tierRoman} ${bracket} ${role} (bestiary) — bounty ${p.bounty} / hire ${p.hire} / ransom ${p.ransom} marks (paid in ${currency})`
      };
    }
  } catch (e) {
    console.debug("[bbttcc-auto-link/monster-builder] pricing unavailable (non-fatal)", e);
  }

  // type:"npc" → native fourththing NPC sheet (FACULTIES + MANIFESTATIONS).
  const data = {
    name,
    type: "npc",
    img,
    flags: {
      [MOD]: {
        entityKind: "monster",
        createdViaMonsterBuilder: true,
        createdAt: Date.now(),
        templateKey: starterKey || null,
        templateCategory: category || null
      },
      fourththing: {
        rfi: {
          actor: {
            tier: tierRoman,
            bracket,
            archetype,
            bestiary: { themes, role, lootTable: loot },
            ...(price ? { price } : {})
          }
        }
      }
    },
    system: {
      role,
      tier: tierNum,
      factionId,
      notes: concept || "",
      details:    { level: tierNum, tier: tierNum, statPoints: 0, skillPoints: 0 },
      faction:    { id: factionId || null, loyalty: 0 },
      attributes,
      skills:     {},
      derived: {
        integrity: { value: integMax, max: integMax },
        stress:    { value: stressMax, max: stressMax },
        guard:     { value: guard },
        evasion:   { value: evasion },
        resolve:   { value: resolve }
      },
      magic: { clarity: { value: 2, max: 5 }, noise: { value: 0, max: 10 }, sephirah },
      resources: {
        frameDice:   { current: 0, max: 0 },
        ruinCharges: { current: 0, max: 0 },
        pace:        { current: 0, max: 0 },
        package:     { type: "", id: "", carried: false },
        burn:        { current: 0, max: 8 },
        aura:        { state: "none" },
        surge:       { value: 0, max: 10, sceneResetAt: null },
        dreamResonance: { active: false, insightUsed: false, hexSephirah: "" },
        forgeCharge: { relicUsed: false, sparksRepaired: 0 }
      },
      conditions: {},
      actions:    { actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFt: 0, movementBudgetFt: 30 },
      defenses:   { resistances, immunities, vulnerabilities },
      conditionImmunities,
      tags: themes,
      radiation: { rp: 0, thresholds: { minor: 25, major: 50, severe: 75 } },
      darkness:  { value: 0, taint: 0, fragments: [] }
    },
    prototypeToken: { actorLink: false, disposition }
  };

  if (factionId) {
    data.flags["bbttcc-factions"] = { factionId };
  }

  // Stash concept + signature into the sheet's notes/biography so they show
  // up natively without further authoring.
  const descParts = [];
  if (concept)   descParts.push(`<p><strong>Concept.</strong> ${_esc(concept)}</p>`);
  if (signature) descParts.push(`<p><strong>Signature.</strong> ${_esc(signature)}</p>`);
  if (descParts.length) {
    foundry.utils.setProperty(data, "system.details.biography", { value: descParts.join("\n"), public: "" });
    foundry.utils.setProperty(data, "system.description", descParts.join("\n"));
  }

  let actor;
  try {
    actor = await Actor.create(data);
  } catch (err) {
    console.error("[bbttcc-auto-link/monster-builder] Actor.create failed", err);
    ui.notifications?.error?.(`Failed to create RFI Monster: ${err?.message || err}`);
    return null;
  }
  if (!actor) return null;

  // Seed the template kit (trait / strike / save / feature items) at the
  // form's tier × bracket × role so damage scales to whatever the GM picked.
  let kitCount = 0;
  if (starter?.kit?.length) {
    try {
      const spec  = { tier: tierRoman, bracket, role };
      const items = buildItemsForKit(spec, starter.kit);
      if (items.length) {
        const created = await actor.createEmbeddedDocuments("Item", items);
        kitCount = created?.length ?? 0;
        console.log("[bbttcc-auto-link/monster-builder] seeded kit",
          { actorId: actor.id, template: starterKey, count: kitCount, names: items.map(i => i.name) });
      }
    } catch (e) {
      console.warn("[bbttcc-auto-link/monster-builder] kit seed failed (non-fatal):", e);
    }
  }

  actor.sheet?.render(true);
  const kitHint = kitCount ? ` — seeded ${kitCount} item(s) from ${starter.label}` : (starter ? ` — ${starter.label} template (no items)` : "");
  ui.notifications?.info?.(`Created RFI Monster: ${actor.name} (T${tierRoman} ${bracket} ${role})${kitHint}`);
  return actor;
}

/* ──────────────────────────────────────────────────────────────────────────
 *  INSTALL
 *  ──────────────────────────────────────────────────────────────────────── */

function _install() {
  globalThis.BBTTCC_MonsterBuilder = globalThis.BBTTCC_MonsterBuilder || {};
  globalThis.BBTTCC_MonsterBuilder.open = openMonsterBuilder;
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.monsterBuilder = {
      open: openMonsterBuilder,
      // Expose templates so other tools (encounter generators, doc macros)
      // can introspect / extend the creature-type catalog.
      categories: CREATURE_CATEGORIES,
      templates: CREATURE_STARTERS
    };
  } catch (_e) {}
}
_install();
Hooks.once("ready", _install);
