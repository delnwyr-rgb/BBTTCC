/* Bad Eden Auto-Link — RFI Monster Builder (lineage edition, 2026-09-04)
 *
 * Creates a type:"npc" actor that renders with the native fourththing NPC
 * sheet (FACULTIES + MANIFESTATIONS layout). Distinct from the NPC Builder
 * (classed PCs on the character sheet).
 *
 * 2026-09-04 — rebuilt around the eight Bad Eden LINEAGES (see
 * BESTIARY_AUDIT_2026_09_03.md §3–4). What changed and why:
 *
 *   • The tab bar is LINEAGES (Wild · Mortal · Hex-Touched · Pre-Fall ·
 *     Sephirotic · Qliphothic · Dream · Revenant), not D&D creature types.
 *     Picking a lineage applies its SIGNATURE even with no template: default
 *     damage type, resist/vuln pair, condition immunities, stress ratio,
 *     currency, Tree position, and it seeds the Lineage Trait item. Mortal
 *     sub-groups by BANNER, Sephirotic by sephirah, Qliphothic by qliphah +
 *     Lesser/Greater grade.
 *   • Templates are EXEMPLARS read from the world: any actor in the NPC Pack
 *     (bbttcc-master-content.npcs, "Bad Eden Monsters") or the world that
 *     carries flags.fourththing.rfi.actor.lineage shows up as a chip under its
 *     lineage; ones flagged `exemplar: true` lead. Adding a template = flagging
 *     an actor — never editing this file. Chosen exemplars prefill the whole
 *     form and their items are cloned on create (envelope-derived damage
 *     formulas rescale to the tier × bracket the GM picked).
 *   • "Save as exemplar" writes the new creature back into the pack with the
 *     flag set, so the pack and the builder can no longer diverge.
 *   • Boss is a bracket (integrity/damage rows) AND a kit: Fractured Will +
 *     Signature + Ultimate scaffolds, the pattern Gerald / Varrenthyx / every
 *     Qliphoth Greater already follow.
 *   • Defenses are constrained chip pickers over FT.DAMAGE_TYPES (+ flavors)
 *     and FT.CONDITIONS — no more free-text "radiant" / "fire".
 *   • `role` is mechanical only (brute/caster/stealth/scout/hardened); the
 *     descriptive line ("Qliphothic Tyrant (Thaumiel — Lesser)") lives in
 *     flags.fourththing.rfi.actor.title.
 *   • Stamps lineage / subLineage / creatureType (mapped, array with "swarm")
 *     / qliphah / tier / bracket / price (computeCreaturePricing) so the
 *     Manifestation Engine, Mal-voice, the market and the bounty engine all
 *     read the same facts.
 *
 * The NPC sheet renders manifestations DIRECTLY from owned items
 * (type:"power" + manifestation-flagged type:"weapon") and trait/feature
 * items in the Features section — no system.manifestations.library UUID
 * registration is needed (that's a boss-only concern).
 */

import "./bestiary-bounty.js";

const MOD = "bbttcc-auto-link";
const PACK_ID = "bbttcc-master-content.npcs";
const ROOT_FOLDER = "Bad Eden Monsters";

/* ──────────────────────────────────────────────────────────────────────────
 *  CANON TABLES (envelopes match seed-bestiary + backfill-bestiary-lineage)
 *  ──────────────────────────────────────────────────────────────────────── */

const TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };
const ROMAN    = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const LEVEL_BY_TIER = { 1: 1, 2: 8, 3: 13, 4: 18 };

// Per-bracket × tier integrity envelope. "boss" = heavy × 1.25, which is where
// the hand-authored bosses and the Qliphoth Greaters already sit (110–135 at T4).
const INTEGRITY = {
  light:  { I: 25, II: 32, III: 39, IV:  46 },
  medium: { I: 40, II: 50, III: 60, IV:  70 },
  heavy:  { I: 60, II: 75, III: 90, IV: 105 },
  boss:   { I: 75, II: 95, III: 115, IV: 135 }
};

// Damage formula by bracket × tier.
const DMG = {
  light:  { I: "1d6",  II: "1d8",  III: "2d6",  IV: "2d8"  },
  medium: { I: "1d8",  II: "1d10", III: "2d8",  IV: "2d10" },
  heavy:  { I: "1d10", II: "2d6",  III: "2d10", IV: "2d12" },
  boss:   { I: "2d6",  II: "2d8",  III: "3d8",  IV: "4d8"  }
};

// Fractured Will uses per scene, by tier (bosses only).
const FRACTURED_WILL_BY_TIER = { I: 1, II: 2, III: 2, IV: 3 };

// System damage canon (FT.DAMAGE_TYPES). The broad "energy" type was retired
// 2026-06-20 — map it forward by flavor the same way the system's read-time
// shim does, so kits never write a retired type.
const DAMAGE_TYPES = ["kinetic", "electrical", "thermal", "chemical", "poison", "psychic", "sephirotic", "qliphothic", "radiation"];
const DAMAGE_FLAVORS = { thermal: ["hot", "cold"], chemical: ["acid", "base"] };
const TRACK_BY_TYPE = { psychic: "stress", qliphothic: "stress", radiation: "radiation" };
function rfiType(canon, flavor = "") {
  const t = String(canon ?? "").toLowerCase();
  if (t === "energy") {
    const f = String(flavor).toLowerCase();
    if (/cold|ice|frost/.test(f)) return "thermal";
    if (/fire|hot|flame|heat|burn|cinder|ember|smolder|laser/.test(f)) return "thermal";
    if (/acid|base|alkal|caustic/.test(f)) return "chemical";
    return "electrical";
  }
  if (t === "radiant") return "sephirotic";
  if (t === "fire") return "thermal";
  if (t === "physical") return "kinetic";
  return DAMAGE_TYPES.includes(t) ? t : "kinetic";
}
function rfiTrack(type) { return TRACK_BY_TYPE[type] ?? "integrity"; }

// Combat-relevant condition immunities offered by the picker (FT.CONDITIONS
// also carries environmental states like drowning / vacuum — not offered).
const CONDITION_KEYS = ["charmed", "shaken", "compelled", "calmed", "staggered", "restrained", "prone", "blinded", "burning", "scarred"];

const ROLE_OPTS = ["brute", "caster", "stealth", "scout", "hardened"];
const BRACKET_OPTS = ["light", "medium", "heavy", "boss"];
const SEPHIRAH_OPTS = ["kether", "chokmah", "binah", "chesed", "geburah", "tiferet", "netzach", "hod", "yesod", "malkuth", "qliphoth"];
const FACULTY_KEYS = ["violence", "intrigue", "presence", "body", "mind", "soul"];

// Default attribute (faculty) per role — feeds engage dialog auto-bonus.
const ROLE_ATTRIBUTE = { brute: "violence", stealth: "violence", scout: "violence", hardened: "violence", caster: "soul" };
const ROLE_SKILL     = { brute: "melee", stealth: "melee", scout: "firearms", hardened: "melee", caster: "channel" };

// Attribute baselines by role (+1 per tier above I).
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
 *  LINEAGES — the eight blessed groups and their signatures
 *  (BESTIARY_AUDIT_2026_09_03.md §3, ruled 2026-09-04)
 *  ──────────────────────────────────────────────────────────────────────── */

// Mortal sub-lineages: the BANNER supplies the Lineage Trait.
const MORTAL_BANNERS = {
  raider:     { label: "Raider",     trait: { name: "Ambush Crew", desc: "In the first round of combat, the raider rerolls the lowest die on attack rolls against any creature that hasn't acted yet. If reduced below half Integrity, they must succeed a DC 12 Soul check at the start of their turn or disengage and run.", flavor: "They fight like people who have to eat tonight." }, currency: "violence" },
  sept:       { label: "Sept",       trait: { name: "Minor Ward", desc: "Once per round, when an ally within 6 squares would take damage, the Sept member may use a reaction to grant them resistance to that instance.", flavor: "They are not very good at it. They are very sincere about it." }, currency: "softpower" },
  witness:    { label: "Witness",    trait: { name: "Reports Up", desc: "On death, the Witness's last sight is transmitted to the nearest Witness within a mile. While any other Witness is within a mile, this one cannot be surprised.", flavor: "Gathers, reports, dies anonymously." }, currency: "intrigue" },
  valhaulan:  { label: "Valhaulan",  trait: { name: "Storm-Voiced", desc: "The first time each scene this Valhaulan is reduced below half Integrity, they roar: allies within 6 squares reroll the lowest die on their next attack roll, and the Valhaulan gains 5 temporary Integrity.", flavor: "Storm's a-comin'. The storm has opinions." }, currency: "violence" },
  cultist:    { label: "Cultist",    trait: { name: "Each Spell Is Also a Wound", desc: "Whenever the cultist uses a save-based or qliphothic attack, they also take 1 qliphothic damage to Stress. When they fail a check against being Charmed or Shaken, they may instead succeed once per scene by taking 1d4 Stress.", flavor: "They were told the hum would stop. It did not stop." }, currency: "softpower" },
  "oath-bound": { label: "Oath-Bound", trait: { name: "Sworn", desc: "Immune to Charmed and Compelled. The first time this creature is reduced to 0 Integrity, it instead drops to 1 and gains +2 on its next attack roll — the oath tries one more thing.", flavor: "Will die before breaking it. Has, several times." }, currency: "diplomacy" },
  "beast-folk": { label: "Beast-Folk", trait: { name: "Entrepreneurial", desc: "Once per scene the beast-folk may offer a deal instead of a strike: the target rolls Mind vs DC 12 or spends its next action considering the offer. Sells the map, then sells your route.", flavor: "There was something a bit ENTREPRENEURIAL about them." }, currency: "softpower" },
  unaffiliated: { label: "Unaffiliated", trait: { name: "Nobody's Banner", desc: "This mortal answers to no faction. When reduced below half Integrity they may surrender, flee, or turn coat — GM's call, rolled openly on a d6: 1–2 surrender, 3–4 flee, 5–6 fight on.", flavor: "Everyone's from somewhere. Not everyone admits it." }, currency: "violence" }
};

// The ten Qliphoth (Shells). hullOf = the sephirah the shell is the husk of;
// vice names the Aura every member carries; nouns title Lesser / Greater.
const QLIPHOTH = {
  thaumiel:        { label: "Thaumiel",        hullOf: "keter",   vice: "Duality",     nounLesser: "Tyrant",   nounGreater: "Lord",        aura: "Any creature that starts its turn within 2 squares is battered by contradictory commands: it rolls twice and keeps the worse result on skill checks until the start of its next turn." },
  ghagiel:         { label: "Ghagiel",         hullOf: "chokmah", vice: "Obstruction", nounLesser: "Vermin",   nounGreater: "Juggernaut",  aura: "The 3 squares around this creature are difficult terrain for thought itself: a creature that starts its turn inside rolls twice-keep-worse on Mind checks until the start of its next turn." },
  satariel:        { label: "Satariel",        hullOf: "binah",   vice: "Concealment", nounLesser: "Ambusher", nounGreater: "Parasite",    aura: "Any creature that starts its turn within 6 squares hears faint whispers in a voice it knows: it rolls twice-keep-worse on checks to read intentions or see through deception until the start of its next turn." },
  gamchicoth:      { label: "Gamchicoth",      hullOf: "chesed",  vice: "Excess",      nounLesser: "Tempter",  nounGreater: "Catastrophe", aura: "Any creature that starts its turn within 4 squares must succeed a Resolve check (DC by tier) or spend its bonus action on one reckless, pleasurable thing." },
  golachab:        { label: "Golachab",        hullOf: "geburah", vice: "Cruelty",     nounLesser: "Tormentor", nounGreater: "Cataclysm",  aura: "Any creature that takes damage while within 4 squares takes an extra 1d4 psychic damage to Stress — this creature's attention makes every wound articulate." },
  thagirion:       { label: "Thagirion",       hullOf: "tiferet", vice: "Contention",  nounLesser: "Agitator", nounGreater: "Engine",      aura: "Any creature that starts its turn within 6 squares grows argumentative: it rolls twice-keep-worse on Presence checks to persuade or de-escalate until the start of its next turn." },
  "harab-serapel": { label: "Harab Serapel",   hullOf: "netzach", vice: "Avarice",     nounLesser: "Predator", nounGreater: "Calamity",    aura: "Any creature that starts its turn within 6 squares must succeed a Resolve check (DC by tier) or spend its movement moving toward the most valuable object it can see." },
  samael:          { label: "Samael",          hullOf: "hod",     vice: "Vanity",      nounLesser: "Seducer",  nounGreater: "Idol",        aura: "Any creature that starts its turn within 6 squares and can see this creature rolls twice-keep-worse on checks to resist being Charmed until the start of its next turn." },
  gamaliel:        { label: "Gamaliel",        hullOf: "yesod",   vice: "Obscenity",   nounLesser: "Parasite", nounGreater: "Weather",     aura: "Any creature that starts its turn within 4 squares must succeed a Resolve check (DC by tier) or take 1d4 psychic damage to Stress as a repressed impulse surfaces, spoken aloud." },
  nahemoth:        { label: "Nahemoth",        hullOf: "malkuth", vice: "Materialism", nounLesser: "Remnant",  nounGreater: "Golem",       aura: "Any creature that starts its turn within 2 squares must succeed a Resolve check (DC by tier) or be Staggered until the end of its turn, crushed by pure pointlessness." }
};

const SEPHIROTH_LABELS = { kether: "Kether", chokmah: "Chokmah", binah: "Binah", chesed: "Chesed", geburah: "Geburah", tiferet: "Tiferet", netzach: "Netzach", hod: "Hod", yesod: "Yesod", malkuth: "Malkuth" };

const LINEAGES = [
  { key: "wild", label: "Wild", domain: "Malkuth-born fauna · Predator authoring",
    tree: "malkuth", creatureType: "beast", role: "brute", bracket: "light",
    damageType: "kinetic", damageFlavor: "bite", resist: [], vuln: [], condImm: [],
    stressRatio: 0.5, currency: "violence", themes: ["wild", "predator"],
    loot: [{ name: "Herd Leather", qty: "1d2", weight: 5 }, { name: "Reagent Gland", qty: "1", weight: 2 }],
    trait: { name: "Territory", desc: "Choose terrain (still water, burn-zone, rubble, canopy) or pack. Terrain: while in it, the first attack each combat rerolls the lowest die and the creature is hidden until it acts. Pack: reroll the lowest die on attack rolls against any creature within 1 square of an ally that isn't incapacitated.", flavor: "It was here first. It intends to be here after." },
    strike: { name: "Bite", melee: true, reach: 5, damageType: "kinetic", damageFlavor: "bite", riderText: "On a hit, the target is marked by scent until the end of the scene — this creature and its kin reroll the lowest die when tracking it." },
    sub: null },

  { key: "mortal", label: "Mortal", domain: "People with a banner · Combatant authoring",
    tree: "malkuth", creatureType: "humanoid", role: "brute", bracket: "medium",
    damageType: "kinetic", damageFlavor: "blade", resist: [], vuln: [], condImm: [],
    stressRatio: 0.5, currency: "violence", themes: ["humanoid"],
    loot: [{ name: "Scrap Salvage", qty: "1d2", weight: 5 }, { name: "Cold-Iron", qty: "1", weight: 2 }],
    trait: null, // supplied by the banner
    strike: { name: "Sidearm", melee: true, reach: 5, damageType: "kinetic", damageFlavor: "blade", riderText: "" },
    sub: { label: "Banner", options: Object.entries(MORTAL_BANNERS).map(([k, v]) => ({ key: k, label: v.label })) } },

  { key: "hex-touched", label: "Hex-Touched", domain: "Warped by hex-script · Corruption authoring",
    tree: "malkuth", creatureType: "aberration", role: "stealth", bracket: "light",
    damageType: "kinetic", damageFlavor: "shard", resist: ["kinetic"], vuln: ["sephirotic"], condImm: [],
    stressRatio: 0.5, currency: "intrigue", themes: ["hex-touched"],
    loot: [{ name: "Hex-Glyph Plate", qty: "1", weight: 3 }, { name: "Heart-Iron Shaving", qty: "1d2", weight: 4 }],
    trait: { name: "The Hex Tries One More Thing", desc: "When reduced to 0 Integrity, the creature acts for one more round with reroll-the-lowest on attacks, then drops. When a creature within 1 square drops to 0 Integrity, this one gains 5 temporary Integrity.", flavor: "Still recognizably what it was. That is the worst part." },
    strike: { name: "Hex-Bite", melee: true, reach: 5, damageType: "kinetic", damageFlavor: "shard", riderText: "On a hit, the target also takes 1 qliphothic damage to Stress — the hex sings into the wound." },
    sub: null },

  { key: "pre-fall", label: "Pre-Fall", domain: "Relic constructs · Protocol authoring",
    tree: "hod", creatureType: "construct", role: "hardened", bracket: "medium",
    damageType: "electrical", damageFlavor: "arc", resist: ["kinetic"], vuln: ["chemical"], condImm: ["charmed", "shaken", "compelled"],
    stressRatio: 0.4, currency: "intrigue", themes: ["construct", "pre-fall"],
    loot: [{ name: "Pre-Fall Component", qty: "1", weight: 3 }, { name: "Heart-Coil", qty: "1", weight: 2 }],
    trait: { name: "Broken Protocol", desc: "Immune to Charmed, Shaken and Compelled. Repeats a single directive (patrol, scan, enforce, greet) until attacked; then runs combat protocol for 3 rounds and returns to the directive if nothing hostile remains in sight. Anyone without pre-Fall credentials is an intruder — that is everyone alive.", flavor: "It is still patrolling. The patrol route includes the place you are standing." },
    strike: { name: "Servo-Limb", melee: true, reach: 5, damageType: "kinetic", damageFlavor: "actuator", riderText: "On a hit, the target must succeed a Body check (DC by tier) or be pushed 5 ft. — it is enforcing a perimeter, not killing." },
    sub: null },

  { key: "sephirotic", label: "Sephirotic", domain: "Emanations of the Tree · Correction authoring",
    tree: "tiferet", creatureType: "elemental", role: "caster", bracket: "medium",
    damageType: "sephirotic", damageFlavor: "", resist: ["psychic"], vuln: ["qliphothic"], condImm: ["charmed", "shaken"],
    stressRatio: 0.7, currency: "softpower", themes: ["sephirotic"],
    loot: [{ name: "Tree-of-Life Shard", qty: "1", weight: 2 }, { name: "Prayer Resin", qty: "1d2", weight: 4 }],
    trait: { name: "Correction, Not Anger", desc: "Immune to Charmed and Shaken — it is a principle, not a person. Creatures that deal qliphothic damage to it must succeed a Soul check (DC by tier) or be Restrained by the sephirah's answer until the end of their next turn. It does not pursue anyone who leaves its ground.", flavor: "It does not hate intruders. It corrects them." },
    strike: { name: "Emanation", melee: false, shortRange: 30, longRange: 90, damageType: "sephirotic", damageFlavor: "", riderText: "On a hit against a creature with the qliphothic tag, the damage die rerolls the lowest." },
    sub: { label: "Sephirah", options: Object.entries(SEPHIROTH_LABELS).map(([k, v]) => ({ key: k, label: v })) } },

  { key: "qliphothic", label: "Qliphothic", domain: "The Shells · Vice authoring",
    tree: "qliphoth", creatureType: "fiend", role: "caster", bracket: "medium",
    damageType: "qliphothic", damageFlavor: "", resist: ["qliphothic"], vuln: ["sephirotic"], condImm: ["charmed"],
    stressRatio: 0.5, currency: "softpower", themes: ["qliphothic"],
    loot: [{ name: "Shell-Residue", qty: "1", weight: 3 }, { name: "The Thing It Wanted (Worthless. Priceless.)", qty: "1", weight: 1 }],
    trait: null, // Aura of <Vice> from the qliphah; Greaters add Fractured Will
    strike: { name: "Hollow Touch", melee: true, reach: 5, damageType: "qliphothic", damageFlavor: "", riderText: "Damage goes to Stress. On a hit the target must succeed a Resolve check (DC by tier) or be Compelled toward the shell's vice until the end of its next turn." },
    sub: { label: "Qliphah", options: Object.entries(QLIPHOTH).map(([k, v]) => ({ key: k, label: `${v.label} (hull of ${SEPHIROTH_LABELS[v.hullOf] ?? v.hullOf})` })) },
    grade: true },

  { key: "dream", label: "Dream", domain: "Yesod-side things · Half-real authoring",
    tree: "yesod", creatureType: "undead", role: "stealth", bracket: "medium",
    damageType: "psychic", damageFlavor: "", resist: ["kinetic"], vuln: ["sephirotic"], condImm: ["shaken"],
    stressRatio: 1.0, currency: "nonlethal", themes: ["dream"],
    loot: [{ name: "Memory Resin", qty: "1d2", weight: 5 }, { name: "Witness-Glass", qty: "1", weight: 1 }],
    trait: { name: "Half-Real", desc: "Until this creature attacks, attacks against it reroll the highest die. Its first strike fully manifests it for the rest of the scene. It moves through creatures and objects as difficult terrain and takes 1d10 kinetic if it ends its turn inside something solid.", flavor: "It is here. Sort of. The 'sort of' is the dangerous part." },
    strike: { name: "Dreamcut", melee: true, reach: 5, damageType: "psychic", damageFlavor: "", riderText: "Damage goes to Stress. On a hit the target also loses 1 Clarity." },
    sub: null },

  { key: "revenant", label: "Revenant", domain: "The dead that stayed · Grief authoring",
    tree: "malkuth", creatureType: "undead", role: "caster", bracket: "light",
    damageType: "qliphothic", damageFlavor: "warmth-theft", resist: ["kinetic"], vuln: ["sephirotic"], condImm: ["charmed", "shaken"],
    stressRatio: 0.8, currency: "softpower", themes: ["revenant", "haunting"],
    loot: [{ name: "Salt Block", qty: "1d3", weight: 5 }, { name: "Memory Resin", qty: "1", weight: 2 }],
    trait: { name: "Crystallized Grief", desc: "Immune to Charmed and Shaken — it is already nothing but those things. When it deals qliphothic damage, it regains Integrity equal to the Stress inflicted. Laid to rest, not killed: at 0 Integrity it reforms next dusk unless the grief that made it is named aloud.", flavor: "Salt remembers what salt is for." },
    strike: { name: "Drain-Touch", melee: true, reach: 5, damageType: "qliphothic", damageFlavor: "warmth-theft", riderText: "On a hit, the target's Stress increases by 1d4 and the revenant regains that much Integrity. The target feels cold for an hour." },
    sub: null }
];
const LINEAGE_BY_KEY = Object.fromEntries(LINEAGES.map(l => [l.key, l]));

/* ──────────────────────────────────────────────────────────────────────────
 *  ITEM FACTORIES (kit specs use { kind: "trait"|"attack"|"save"|"feature" })
 *  ──────────────────────────────────────────────────────────────────────── */

function _damageFormula(spec, override) { return override || DMG[spec.bracket]?.[spec.tier] || DMG.light.I; }
function _saveDC(spec, override) {
  if (Number.isFinite(override)) return override;
  return 10 + TIER_INT[spec.tier] + (spec.role === "caster" ? 1 : 0) + (spec.bracket === "boss" ? 2 : 0);
}
function _kitTags(spec, extra = []) {
  return ["monster-builder", `tier-${spec.tier.toLowerCase()}`, `role-${spec.role}`, ...(spec.lineage ? [`lineage-${spec.lineage}`] : []), ...extra];
}

function makeAttackItem(spec, atk) {
  const formula = _damageFormula(spec, atk.damageOverride);
  const dType   = rfiType(atk.damageType, atk.damageFlavor);
  const isMelee = !!atk.melee;
  const intent  = atk.intent ?? "violence";
  const skill   = atk.skill ?? (isMelee ? "melee" : (spec.role === "scout" ? "firearms" : "ranged"));
  const attr    = atk.attribute ?? ROLE_ATTRIBUTE[spec.role] ?? "violence";
  const flavor  = atk.damageFlavor ?? "";
  const range   = isMelee
    ? { short: Math.max(1, Math.round((atk.reach ?? 5) / 5)), long: Math.max(1, Math.round((atk.reach ?? 5) / 5)) }
    : { short: Math.max(1, Math.round((atk.shortRange ?? 60) / 5)), long: Math.max(1, Math.round((atk.longRange ?? 180) / 5)) };
  const reachLabel = isMelee ? `reach ${atk.reach ?? 5} ft.` : `range ${atk.shortRange ?? 60}/${atk.longRange ?? 180} ft.`;
  return {
    name: atk.name, type: "weapon", img: atk.img ?? "icons/svg/sword.svg",
    system: {
      category: isMelee ? "melee" : "ranged", intent, skill,
      damage: { formula, attribute: attr, type: dType, damageFlavor: flavor, track: rfiTrack(dType) },
      range, tags: _kitTags(spec, atk.tags ?? []),
      effect: atk.riderText ?? "", flavor: atk.flavor ?? "",
      description: { value: `<p><strong>Strike.</strong> ${reachLabel}, one target. Damage: <code>${formula}</code> ${dType}${flavor ? ` (${flavor})` : ""} + ${attr}.${atk.riderText ? " " + atk.riderText : ""}</p>${atk.flavor ? `<p><em>${atk.flavor}</em></p>` : ""}`, chat: "" }
    },
    effects: [], flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "attack" } } } },
    folder: null, sort: 0, ownership: { default: 0 }
  };
}

function makeSaveItem(spec, save) {
  const formula = _damageFormula(spec, save.damageOverride);
  const dType   = rfiType(save.damageType, save.damageFlavor);
  const dc      = _saveDC(spec, save.dcOverride);
  const attr    = save.attribute ?? ROLE_ATTRIBUTE[spec.role] ?? "soul";
  const skill   = save.skill ?? ROLE_SKILL[spec.role] ?? "channel";
  const intent  = save.intent ?? "presence";
  const flavor  = save.damageFlavor ?? "";
  const shape   = save.template?.shape ?? "radius";
  const size    = save.template?.size ?? 10;
  const SAVE_TO_DEFENSE = { con: "Resolve", dex: "Evasion", wis: "Resolve", str: "Guard", int: "Resolve", cha: "Resolve", body: "Resolve", presence: "Resolve", mind: "Resolve", soul: "Resolve", violence: "Guard", intrigue: "Evasion" };
  const targetDefense = SAVE_TO_DEFENSE[save.saveAbility] ?? "Resolve";
  const useSuffix = save.recharge ? ` (Recharge ${save.recharge})` : (save.usesPerScene ? ` (${save.usesPerScene}/scene)` : (save.usesPerDay ? ` (${save.usesPerDay}/Day)` : ""));
  const useText = save.recharge ? ` Recharge ${save.recharge}.` : (save.usesPerScene ? ` ${save.usesPerScene} per scene.` : (save.usesPerDay ? ` ${save.usesPerDay} per day.` : ""));
  const range = { short: Math.max(1, Math.round(size / 5)), long: Math.max(1, Math.round(size / 5)) };
  return {
    name: save.name + useSuffix, type: "weapon", img: save.img ?? "icons/svg/explosion.svg",
    system: {
      category: "ranged", intent, skill,
      damage: { formula, attribute: attr, type: dType, damageFlavor: flavor, track: rfiTrack(dType) },
      range, tags: _kitTags(spec, ["aoe", `shape-${shape}`, ...(save.tags ?? [])]),
      effect: `${shape.charAt(0).toUpperCase() + shape.slice(1)} ${size} ft. — targets roll vs ${targetDefense} (DC ${dc}). Half damage on success.${save.riderText ? " " + save.riderText : ""}${useText}`,
      flavor: save.flavor ?? "",
      description: { value: `<p><strong>Area Attack.</strong> ${save.targetText ?? `Each creature in a ${size}-ft. ${shape}`} rolls <strong>${targetDefense}</strong> vs DC ${dc}. Hit: <code>${formula}</code> ${dType}${flavor ? ` (${flavor})` : ""} + ${attr}; half on success.${save.riderText ? " " + save.riderText : ""}${useText ? `<br/><em>${useText.trim()}</em>` : ""}</p>${save.flavor ? `<p><em>${save.flavor}</em></p>` : ""}`, chat: "" }
    },
    effects: [], flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "save", aoeShape: shape, aoeSize: size, dcAbility: save.saveAbility, dc } } } },
    folder: null, sort: 0, ownership: { default: 0 }
  };
}

function makeTraitItem(spec, trait) {
  return {
    name: trait.name, type: "feat", img: trait.img ?? "icons/svg/upgrade.svg",
    system: {
      category: "technique", source: { revision: 1, rules: "2024" },
      tags: _kitTags(spec, ["passive", ...(trait.tags ?? [])]),
      description: { value: `<p>${trait.desc}</p>${trait.flavor ? `<p><em>${trait.flavor}</em></p>` : ""}`, chat: "" },
      activities: {}, uses: { spent: 0, recovery: [] }, advancement: {}, identifier: "", crewed: false, enchant: {},
      prerequisites: { items: [], repeatable: false }, properties: [], requirements: "", type: { value: "", subtype: "" }
    },
    effects: [], flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "trait" } } } },
    folder: null, sort: 0, ownership: { default: 0 }
  };
}

function makeFeatureItem(spec, feat) {
  return {
    name: feat.name, type: "feature", img: feat.img ?? "icons/magic/symbols/symbol-runes-purple.webp",
    system: {
      category: "principle", source: "", tags: _kitTags(spec, feat.tags ?? []),
      description: { value: `<p><strong>Passive.</strong> ${feat.desc}</p>${feat.flavor ? `<p><em>${feat.flavor}</em></p>` : ""}`, chat: "" }
    },
    effects: [], flags: { fourththing: { rfi: { item: { tier: spec.tier, frame: "feature" } } } },
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

/* Lineage kit — what a creature gets from its group when no exemplar is chosen
 * (and the Lineage Trait / Aura / boss scaffolds even when one is). */
function lineageKit(spec, { sub = "", grade = "lesser", name = "" } = {}) {
  const lin = LINEAGE_BY_KEY[spec.lineage];
  if (!lin) return [];
  const kit = [];
  if (lin.key === "mortal") {
    const banner = MORTAL_BANNERS[sub] ?? MORTAL_BANNERS.unaffiliated;
    kit.push({ kind: "trait", ...banner.trait, tags: ["lineage-trait", `banner-${sub || "unaffiliated"}`] });
  } else if (lin.key === "qliphothic") {
    const q = QLIPHOTH[sub];
    const vice = q?.vice ?? "the Shell";
    kit.push({ kind: "feature", name: `Aura of ${vice}`, tags: ["lineage-trait", "aura", ...(q ? [`qliphah-${sub}`] : [])],
      desc: q?.aura ?? "Any creature that starts its turn within 4 squares feels the Shell's hollowness: it rolls twice-keep-worse on Resolve checks until the start of its next turn.",
      flavor: "Hollow where a self should be." });
  } else if (lin.trait) {
    kit.push({ kind: "trait", ...lin.trait, tags: ["lineage-trait"] });
  }
  return kit;
}

function bossKit(spec, name = "the creature") {
  const uses = FRACTURED_WILL_BY_TIER[spec.tier] ?? 2;
  const lin = LINEAGE_BY_KEY[spec.lineage];
  const dType = lin?.damageType ?? "kinetic";
  return [
    { kind: "feature", name: `Fractured Will (${uses}/scene)`, tags: ["boss", "fractured-will"],
      desc: `When ${name} fails a check, some part of it refuses the outcome: it succeeds instead. ${uses} time${uses === 1 ? "" : "s"} per scene.`,
      flavor: "The mask cracks a little each time." },
    { kind: "save", name: "Signature", recharge: "5–6", saveAbility: "soul", damageType: dType, damageFlavor: lin?.damageFlavor ?? "",
      template: { shape: "cone", size: 30 }, targetText: "Each creature in a 30-ft. cone", tags: ["boss", "signature"],
      riderText: "GM: name this. The one thing this creature does that nothing else does.", flavor: "Rename me. Give me a rider." },
    { kind: "save", name: "Ultimate", usesPerScene: 1, saveAbility: "dex", damageType: dType, damageFlavor: lin?.damageFlavor ?? "",
      damageOverride: (DMG.boss[spec.tier] ?? "3d8").replace(/^(\d+)/, (m) => String(Number(m) + 1)),
      template: { shape: "radius", size: 30 }, targetText: "Each creature within 30 ft.", tags: ["boss", "ultimate"],
      riderText: "ULTIMATE — usable only at or below half Integrity. GM: name this, give it a scar.", flavor: "Rename me." }
  ];
}

/* ──────────────────────────────────────────────────────────────────────────
 *  EXEMPLARS — templates are actors, read from the pack + the world
 *  ──────────────────────────────────────────────────────────────────────── */

let _exemplarCache = null;

async function loadExemplarIndex({ force = false } = {}) {
  if (_exemplarCache && !force) return _exemplarCache;
  const rows = [];
  const F = "flags.fourththing.rfi.actor";
  try {
    const pack = game.packs.get(PACK_ID);
    if (pack) {
      const index = await pack.getIndex({ fields: [`${F}.lineage`, `${F}.subLineage`, `${F}.tier`, `${F}.bracket`, `${F}.exemplar`, `${F}.title`, "system.role", "img", "folder"] });
      for (const e of index) {
        const a = foundry.utils.getProperty(e, F) ?? {};
        if (!a.lineage) continue;
        rows.push({ uuid: e.uuid, name: e.name, img: e.img, lineage: a.lineage, sub: a.subLineage ?? "", tier: a.tier ?? "", bracket: a.bracket ?? "", exemplar: !!a.exemplar, title: a.title ?? "", source: "pack" });
      }
    }
  } catch (e) { console.warn(`[${MOD}/monster-builder] pack index failed`, e); }
  try {
    for (const w of game.actors?.contents ?? []) {
      const a = w.flags?.fourththing?.rfi?.actor ?? {};
      if (!a.lineage) continue;
      rows.push({ uuid: w.uuid, name: w.name, img: w.img, lineage: a.lineage, sub: a.subLineage ?? "", tier: a.tier ?? "", bracket: a.bracket ?? "", exemplar: !!a.exemplar, title: a.title ?? "", source: "world" });
    }
  } catch (_e) {}
  rows.sort((x, y) => (Number(y.exemplar) - Number(x.exemplar)) || (TIER_INT[x.tier] ?? 9) - (TIER_INT[y.tier] ?? 9) || x.name.localeCompare(y.name));
  _exemplarCache = rows;
  return rows;
}

function listExemplars(lineage) {
  return (_exemplarCache ?? []).filter(r => !lineage || r.lineage === lineage);
}

/* Write an actor into the NPC Pack's "Bad Eden Monsters" folder as an exemplar
 * of its lineage. Unlocks / re-locks the pack around the write. */
async function saveAsExemplar(actor) {
  if (!game.user.isGM) throw new Error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) throw new Error(`Pack ${PACK_ID} not found.`);
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  try {
    const folder = pack.folders?.getName?.(ROOT_FOLDER) ?? pack.folders?.find?.(f => f.name === ROOT_FOLDER) ?? null;
    const data = actor.toObject();
    delete data._id;
    data.folder = folder?.id ?? null;
    data.ownership = { default: 0 };
    foundry.utils.setProperty(data, "flags.fourththing.rfi.actor.exemplar", true);
    const created = await Actor.create(data, { pack: PACK_ID });
    _exemplarCache = null;
    return created;
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 *  HTML / DIALOG
 *  ──────────────────────────────────────────────────────────────────────── */

function _esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const _stripHtml = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function _factionOptions() {
  const factions = (game.actors?.contents ?? [])
    .filter(a => {
      try {
        const k = game.bbttcc?.api?.actorKind?.(a);
        if (k) return k === "faction";
        return a.getFlag?.("bbttcc-factions", "isFaction") || a?.flags?.["bbttcc-factions"]?.isFaction;
      } catch { return false; }
    })
    .map(a => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return ['<option value="">— Unaffiliated —</option>'].concat(factions.map(f => `<option value="${f.id}">${_esc(f.name)}</option>`)).join("");
}

const TAB_ACTIVE = "cursor:pointer; padding:0.25rem 0.75rem; border:1px solid #2eaa5e; border-radius:4px; font-size:0.8rem; background:rgba(46,170,94,0.28); color:inherit;";
const TAB_IDLE   = "cursor:pointer; padding:0.25rem 0.75rem; border:1px solid rgba(255,255,255,0.18); border-radius:4px; font-size:0.8rem; background:rgba(255,255,255,0.06); color:inherit;";
const CHIP_ON    = "cursor:pointer; border:1px solid #2eaa5e; background:rgba(46,170,94,0.22);";
const CHIP_OFF   = "cursor:pointer; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06);";

function _lineageTabsHTML() {
  return LINEAGES.map(l => `<button type="button" class="bbttcc-mb-tab" data-bbttcc-lineage="${_esc(l.key)}" style="${TAB_IDLE}">${_esc(l.label)}</button>`).join(" ");
}

function _subRowsHTML() {
  return LINEAGES.filter(l => l.sub).map(l => `
    <div data-bbttcc-subrow="${_esc(l.key)}" style="display:none; align-items:center; gap:0.5rem; margin-top:0.4rem; flex-wrap:wrap;">
      <label style="margin:0; font-size:0.78rem; opacity:0.85;">${_esc(l.sub.label)}</label>
      <select data-bbttcc-sub="${_esc(l.key)}" style="max-width:20rem;">
        ${l.sub.options.map((o, i) => `<option value="${_esc(o.key)}"${i === 0 ? " selected" : ""}>${_esc(o.label)}</option>`).join("")}
      </select>
      ${l.grade ? `<label style="margin:0 0 0 0.5rem; font-size:0.78rem; opacity:0.85;">Grade</label>
      <select data-bbttcc-grade="${_esc(l.key)}"><option value="lesser" selected>Lesser</option><option value="greater">Greater (boss)</option></select>` : ""}
    </div>`).join("");
}

function _exemplarRowsHTML(index) {
  return LINEAGES.map(l => {
    const rows = index.filter(r => r.lineage === l.key);
    const chips = rows.map(r => `
      <button type="button" class="ft-manifest-chip" data-bbttcc-exemplar="${_esc(r.uuid)}" data-bbttcc-exlineage="${_esc(l.key)}"
              title="${_esc(r.title || r.name)} · T${_esc(r.tier || "?")} ${_esc(r.bracket || "")} · ${r.source}${r.exemplar ? " · exemplar" : ""}"
              style="${CHIP_OFF}${r.exemplar ? " font-weight:600;" : ""}">${r.exemplar ? "★ " : ""}${_esc(r.name)}</button>`).join(" ")
      || `<span class="ft-prev-align-note" style="opacity:0.7;">No ${_esc(l.label)} creatures carry a lineage flag yet — run the bestiary backfill, or create one below and tick "save as exemplar".</span>`;
    return `<div data-bbttcc-exrow="${_esc(l.key)}" style="display:none; flex-wrap:wrap; gap:0.35rem; margin-top:0.4rem; max-height:7.5rem; overflow-y:auto;">${chips}</div>`;
  }).join("");
}

function _damageChipsHTML(field) {
  const chips = [];
  for (const t of DAMAGE_TYPES) {
    chips.push(`<button type="button" class="ft-manifest-chip" data-bbttcc-defchip="${field}" data-bbttcc-def="${t}" style="${CHIP_OFF}">${t}</button>`);
    for (const f of (DAMAGE_FLAVORS[t] ?? [])) chips.push(`<button type="button" class="ft-manifest-chip" data-bbttcc-defchip="${field}" data-bbttcc-def="${t}:${f}" style="${CHIP_OFF}">${t}:${f}</button>`);
  }
  return `<div style="display:flex; flex-wrap:wrap; gap:0.3rem;">${chips.join(" ")}</div><input type="hidden" data-bbttcc-field="${field}" value=""/>`;
}
function _conditionChipsHTML(field) {
  return `<div style="display:flex; flex-wrap:wrap; gap:0.3rem;">${CONDITION_KEYS.map(c => `<button type="button" class="ft-manifest-chip" data-bbttcc-defchip="${field}" data-bbttcc-def="${c}" style="${CHIP_OFF}">${c}</button>`).join(" ")}</div><input type="hidden" data-bbttcc-field="${field}" value=""/>`;
}

const _opts = (list, sel, labelFn = (v) => v.charAt(0).toUpperCase() + v.slice(1)) =>
  list.map(v => `<option value="${v}"${String(v) === String(sel) ? " selected" : ""}>${labelFn(v)}</option>`).join("");

export async function openMonsterBuilder() {
  const index = await loadExemplarIndex();
  const factionOpts = _factionOptions();

  const facultyGrid = FACULTY_KEYS.map(k => `
    <div class="ft-cast-field" style="display:flex; align-items:center; gap:0.35rem;">
      <label style="flex:1 1 auto; margin-bottom:0; text-transform:none; opacity:1; font-size:0.78rem;">${k.charAt(0).toUpperCase() + k.slice(1)}</label>
      <input type="number" data-bbttcc-attr="${k}" value="2" min="-2" max="10" style="width:3.2rem; text-align:right;"/>
    </div>`).join("");

  const content = `
<div class="ft-cast-dialog ft-manifest-dialog bbttcc-monster-builder">
  <div class="ft-manifest-dialog-guide" style="border-color:#2eaa5eaa; background:rgba(46,170,94,0.08);">
    <div class="ft-manifest-dialog-title">Create Monster</div>
    <div class="ft-manifest-dialog-domain">Bestiary · Lineage authoring</div>
    <div class="ft-manifest-dialog-copy">
      Pick a <strong>lineage</strong> — what made this thing. The lineage's signature snaps in
      (damage type, resist/vuln, condition immunities, stress ratio, currency, Tree position,
      and its Lineage Trait). Then, optionally, pick an <strong>exemplar</strong> from the pack to
      prefill the whole stat block and clone its strikes and features.
    </div>
    <div class="bbttcc-mb-tabs" style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-top:0.55rem;">${_lineageTabsHTML()}</div>
    ${_subRowsHTML()}
    <div class="ft-prev-label" style="margin-top:0.5rem;">Exemplars</div>
    ${_exemplarRowsHTML(index)}
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.6rem;">
    <div class="ft-prev-label">Who is this?</div>
    <div class="ft-prev-align-note">Name them. The title is the descriptive line on the sheet; the role below is mechanical.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Name <span style="color:#f87171">*</span></label>
      <input type="text" data-bbttcc-field="name" required autofocus placeholder="e.g. Glass-Eyed Wolf, Salt-Sister, Crossing Guard"/></div>
    <div class="ft-cast-field"><label>Title</label>
      <input type="text" data-bbttcc-field="title" placeholder="e.g. Qliphothic Tyrant (Thaumiel — Lesser)"/></div>
    <div class="ft-cast-field"><label>Archetype (slug)</label>
      <input type="text" data-bbttcc-field="archetype" placeholder="e.g. ash-wolf"/></div>
    <div class="ft-cast-field"><label>Faction</label>
      <select data-bbttcc-field="factionId">${factionOpts}</select></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Concept</label>
      <textarea data-bbttcc-field="concept" rows="2" placeholder="What is this creature in plain language? What does encountering it feel like?"></textarea></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Signature / Third Thing</label>
      <input type="text" data-bbttcc-field="signature" placeholder="The one strange detail that makes this creature unmistakable."/></div>
    <div class="ft-cast-field"><label>Token Disposition</label>
      <select data-bbttcc-field="disposition"><option value="-1" selected>Hostile</option><option value="0">Neutral</option><option value="1">Friendly</option><option value="-2">Secret</option></select></div>
    <div class="ft-cast-field" style="display:flex; align-items:center; gap:0.4rem; padding-top:1.2rem;">
      <input type="checkbox" data-bbttcc-field="swarm" id="bbttcc-mb-swarm"/><label for="bbttcc-mb-swarm" style="margin:0; text-transform:none; opacity:1;">Many-as-one (swarm)</label></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Shape and scale</div>
    <div class="ft-prev-align-note">Role + Tier sets faculty baselines; Bracket × Tier sets the integrity envelope; the lineage sets the stress ratio. <strong>Boss</strong> adds Fractured Will + Signature + Ultimate scaffolds. Changing role / tier / bracket recomputes faculties, integrity and stress.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Role</label><select data-bbttcc-field="role">${_opts(ROLE_OPTS, "brute")}</select></div>
    <div class="ft-cast-field"><label>Tier</label><select data-bbttcc-field="tier">${_opts([1, 2, 3, 4], 1, (t) => `Tier ${"I".repeat(t)}`)}</select></div>
    <div class="ft-cast-field"><label>Bracket</label><select data-bbttcc-field="bracket">${_opts(BRACKET_OPTS, "light")}</select></div>
    <div class="ft-cast-field"><label>Sephirah</label><select data-bbttcc-field="sephirah">${_opts(SEPHIRAH_OPTS, "malkuth")}</select></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Faculties</div>
    <div class="ft-prev-align-note">Standard six. Auto-fills from role × tier; tweak for a specific creature.</div>
  </div>
  <div class="ft-cast-grid" style="grid-template-columns: 1fr 1fr 1fr;">${facultyGrid}</div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Tracks</div>
    <div class="ft-prev-align-note">Integrity = physical track; Stress = mind/soul track. Guard / Evasion / Resolve derive at commit from tier + role.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Integrity (Max)</label><input type="number" data-bbttcc-field="integrity" value="25" min="1" step="1"/></div>
    <div class="ft-cast-field"><label>Stress (Max)</label><input type="number" data-bbttcc-field="stress" value="12" min="1" step="1"/></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Defenses</div>
    <div class="ft-prev-align-note">System damage canon only. The lineage pre-toggles its pair; click to change.</div>
  </div>
  <div class="ft-cast-field ft-cast-span-2"><label>Resistances</label>${_damageChipsHTML("resistances")}</div>
  <div class="ft-cast-field ft-cast-span-2" style="margin-top:0.4rem;"><label>Immunities</label>${_damageChipsHTML("immunities")}</div>
  <div class="ft-cast-field ft-cast-span-2" style="margin-top:0.4rem;"><label>Vulnerabilities</label>${_damageChipsHTML("vulnerabilities")}</div>
  <div class="ft-cast-field ft-cast-span-2" style="margin-top:0.4rem;"><label>Condition immunities</label>${_conditionChipsHTML("conditionImmunities")}</div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Provenance</div>
    <div class="ft-prev-align-note">Themes are bestiary tags (comma-separated). Currency is the pool a bounty credits by default — the bounty engine still credits whatever pool matches how it was resolved.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field ft-cast-span-2"><label>Themes</label><input type="text" data-bbttcc-field="themes" placeholder="comma-separated, e.g. wild, predator, pack"/></div>
    <div class="ft-cast-field"><label>Default currency</label>
      <select data-bbttcc-field="currency">${_opts(["violence", "nonlethal", "intrigue", "diplomacy", "softpower", "economy", "faith"], "violence")}</select></div>
    <div class="ft-cast-field" style="display:flex; align-items:center; gap:0.4rem; padding-top:1.2rem;">
      <input type="checkbox" data-bbttcc-field="saveExemplar" id="bbttcc-mb-exemplar"/><label for="bbttcc-mb-exemplar" style="margin:0; text-transform:none; opacity:1;">Also save to the NPC Pack as an exemplar</label></div>
  </div>

  <p style="opacity:0.7; font-size:0.78rem; margin:0.6rem 0 0;" data-bbttcc-kitnote>
    With no exemplar chosen, the creature gets its Lineage Trait and one lineage strike. Bosses add Fractured Will, a Signature and an Ultimate to rename.
  </p>

  <!-- Hidden plumbing — read at commit. -->
  <input type="hidden" data-bbttcc-field="_lineage" value="wild"/>
  <input type="hidden" data-bbttcc-field="_exemplarUuid" value=""/>
  <input type="hidden" data-bbttcc-field="_exemplarTier" value=""/>
  <input type="hidden" data-bbttcc-field="_exemplarBracket" value=""/>
</div>`;

  // DialogV2 (ApplicationV2). The content is wrapped in a <form>; every chip
  // and tab is type="button" so nothing submits by accident. The create
  // button's callback return value is what wait() resolves with.
  const DialogV2 = foundry.applications.api.DialogV2;
  let result = null;
  try {
    result = await DialogV2.wait({
      window: { title: "Create RFI Monster", icon: "fas fa-paw", resizable: true },
      classes: ["fourththing", "ft-manifestation-wizard-window", "bbttcc-monster-builder-window"],
      position: { width: 780, height: 860 },
      content,
      rejectClose: false,
      buttons: [
        { action: "create", label: "Create Monster", icon: "fas fa-paw", default: true,
          callback: async (_ev, _btn, dialog) => _commit(dialog.element) },
        { action: "cancel", label: "Cancel", callback: () => null }
      ],
      render: (_ev, dialog) => {
        const root = dialog.element;
        _wireDefenseChips(root);
        _wireLineageTabs(root);
        _wireSubSelects(root);
        _wireExemplarChips(root);
        _wireDerivedRecompute(root);
      }
    });
  } catch (e) { console.warn(`[${MOD}/monster-builder] dialog failed`, e); result = null; }
  return (result && typeof result === "object") ? result : null;
}

/* ── form helpers ─────────────────────────────────────────────────────── */
const _get = (root, name) => root.querySelector(`[data-bbttcc-field="${name}"]`);
const _val = (root, name) => { const el = _get(root, name); if (!el) return ""; return el.type === "checkbox" ? el.checked : el.value; };
const _set = (root, name, v) => { const el = _get(root, name); if (!el || v == null) return; if (el.type === "checkbox") el.checked = !!v; else el.value = v; };
const _setAttr = (root, k, v) => { const el = root.querySelector(`[data-bbttcc-attr="${k}"]`); if (el && v != null) el.value = v; };

function _defKey(e) { return typeof e === "string" ? e : `${e?.type ?? ""}${e?.flavor ? ":" + e.flavor : ""}`; }
function _setChips(root, field, list) {
  const keys = new Set((list ?? []).map(_defKey));
  root.querySelectorAll(`[data-bbttcc-defchip="${field}"]`).forEach(b => { b.style.cssText = keys.has(b.dataset.bbttccDef) ? CHIP_ON : CHIP_OFF; });
  _set(root, field, [...keys].join(","));
}
function _wireDefenseChips(root) {
  root.querySelectorAll("[data-bbttcc-defchip]").forEach(b => {
    b.addEventListener("click", () => {
      const field = b.dataset.bbttccDefchip;
      const cur = new Set(String(_val(root, field) || "").split(",").filter(Boolean));
      if (cur.has(b.dataset.bbttccDef)) cur.delete(b.dataset.bbttccDef); else cur.add(b.dataset.bbttccDef);
      _setChips(root, field, [...cur]);
    });
  });
}

function _lineageStressRatio(root) {
  const lin = LINEAGE_BY_KEY[_val(root, "_lineage")];
  let ratio = lin?.stressRatio ?? 0.5;
  if (lin?.key === "qliphothic" && root.querySelector('[data-bbttcc-grade="qliphothic"]')?.value === "greater") ratio = 0.9;
  return ratio;
}

function _recompute(root) {
  const role    = String(_val(root, "role") || "brute");
  const bracket = String(_val(root, "bracket") || "light");
  const tier    = Math.max(1, Math.min(4, Number(_val(root, "tier")) || 1));
  const attrs   = attrsFor(role, tier);
  for (const k of FACULTY_KEYS) _setAttr(root, k, attrs[k]);
  const integ = INTEGRITY[bracket]?.[ROMAN[tier]] ?? 25;
  _set(root, "integrity", integ);
  _set(root, "stress", Math.max(1, Math.floor(integ * _lineageStressRatio(root))));
}

/* Lineage tab → apply the signature. Never clobbers the name. */
function _applyLineage(root, key) {
  const lin = LINEAGE_BY_KEY[key]; if (!lin) return;
  _set(root, "_lineage", key);
  _set(root, "_exemplarUuid", ""); _set(root, "_exemplarTier", ""); _set(root, "_exemplarBracket", "");
  root.querySelectorAll(".bbttcc-mb-tab").forEach(t => { t.style.cssText = (t.dataset.bbttccLineage === key) ? TAB_ACTIVE : TAB_IDLE; });
  root.querySelectorAll("[data-bbttcc-subrow]").forEach(r => { r.style.display = (r.dataset.bbttccSubrow === key) ? "flex" : "none"; });
  root.querySelectorAll("[data-bbttcc-exrow]").forEach(r => { r.style.display = (r.dataset.bbttccExrow === key) ? "flex" : "none"; });
  root.querySelectorAll("[data-bbttcc-exemplar]").forEach(b => { b.style.cssText = CHIP_OFF + (b.textContent.trim().startsWith("★") ? " font-weight:600;" : ""); });
  const dom = root.querySelector(".ft-manifest-dialog-domain"); if (dom) dom.textContent = `Bestiary · ${lin.domain}`;

  _set(root, "role", lin.role); _set(root, "bracket", lin.bracket);
  _set(root, "sephirah", lin.tree);
  _set(root, "currency", lin.currency);
  _set(root, "themes", lin.themes.join(", "));
  _setChips(root, "resistances", lin.resist);
  _setChips(root, "immunities", []);
  _setChips(root, "vulnerabilities", lin.vuln);
  _setChips(root, "conditionImmunities", lin.condImm);
  _applySub(root);
  _recompute(root);
}

/* Sub-lineage / grade → sephirah, title suggestion, currency, boss for Greaters. */
function _applySub(root) {
  const key = _val(root, "_lineage"); const lin = LINEAGE_BY_KEY[key]; if (!lin) return;
  const sub = root.querySelector(`[data-bbttcc-sub="${key}"]`)?.value ?? "";
  if (key === "mortal") {
    const b = MORTAL_BANNERS[sub]; if (b) { _set(root, "currency", b.currency); _set(root, "themes", ["humanoid", sub].join(", ")); }
  } else if (key === "sephirotic") {
    if (SEPHIROTH_LABELS[sub]) { _set(root, "sephirah", sub); _set(root, "themes", ["sephirotic", sub].join(", ")); }
  } else if (key === "qliphothic") {
    const q = QLIPHOTH[sub]; const grade = root.querySelector('[data-bbttcc-grade="qliphothic"]')?.value ?? "lesser";
    if (q) {
      const noun = grade === "greater" ? q.nounGreater : q.nounLesser;
      if (!_val(root, "title") || /^Qliphothic /.test(_val(root, "title"))) _set(root, "title", `Qliphothic ${noun} (${q.label} — ${grade === "greater" ? "Greater" : "Lesser"})`);
      _set(root, "themes", ["qliphothic", sub, grade, ...(grade === "greater" ? ["boss"] : [])].join(", "));
      if (grade === "greater" && _val(root, "bracket") !== "boss") _set(root, "bracket", "boss");
      if (grade === "lesser" && _val(root, "bracket") === "boss") _set(root, "bracket", lin.bracket);
    }
  }
}

function _wireLineageTabs(root) {
  root.querySelectorAll(".bbttcc-mb-tab").forEach(tab => tab.addEventListener("click", () => _applyLineage(root, tab.dataset.bbttccLineage)));
  _applyLineage(root, _val(root, "_lineage") || "wild");
}
function _wireSubSelects(root) {
  root.querySelectorAll("[data-bbttcc-sub], [data-bbttcc-grade]").forEach(sel => sel.addEventListener("change", () => { _applySub(root); _recompute(root); }));
}
function _wireDerivedRecompute(root) {
  for (const k of ["role", "tier", "bracket"]) _get(root, k)?.addEventListener("change", () => _recompute(root));
}

/* Exemplar chip → load the actor and prefill everything from it. */
function _wireExemplarChips(root) {
  root.querySelectorAll("[data-bbttcc-exemplar]").forEach(btn => {
    btn.addEventListener("click", async () => {
      let doc = null;
      try { doc = await fromUuid(btn.dataset.bbttccExemplar); } catch (_e) {}
      if (!doc) { ui.notifications?.warn?.("Exemplar could not be loaded."); return; }
      const a = doc.flags?.fourththing?.rfi?.actor ?? {}; const sys = doc.system ?? {};
      root.querySelectorAll("[data-bbttcc-exemplar]").forEach(b => { b.style.cssText = (b === btn ? CHIP_ON : CHIP_OFF) + (b.textContent.trim().startsWith("★") ? " font-weight:600;" : ""); });
      _set(root, "_exemplarUuid", doc.uuid);
      const tierNum = TIER_INT[a.tier] ?? Number(sys.tier) ?? 1;
      let bracket = String(a.bracket || "").toLowerCase(); if (bracket === "elite") bracket = "boss"; if (!BRACKET_OPTS.includes(bracket)) bracket = "light";
      _set(root, "_exemplarTier", ROMAN[tierNum] ?? "I"); _set(root, "_exemplarBracket", bracket);

      // Identity
      _set(root, "name", doc.name);
      _set(root, "title", a.title ?? (ROLE_OPTS.includes(String(sys.role)) ? "" : (sys.role ?? "")));
      _set(root, "archetype", a.archetype ?? "");
      _set(root, "concept", _stripHtml(sys.notes ?? ""));
      const bio = _stripHtml(sys.details?.biography?.value ?? sys.description ?? "");
      const sig = bio.match(/Signature\.\s*(.+?)(?:\s+Concept\.|$)/)?.[1] ?? "";
      _set(root, "signature", sig);
      _set(root, "swarm", Array.isArray(doc.flags?.fourththing?.creatureType) && doc.flags.fourththing.creatureType.includes("swarm"));

      // Sub-lineage + grade
      const subSel = root.querySelector(`[data-bbttcc-sub="${a.lineage}"]`); if (subSel && a.subLineage) subSel.value = a.subLineage;
      const gradeSel = root.querySelector('[data-bbttcc-grade="qliphothic"]'); if (gradeSel) gradeSel.value = (a.qliphah?.grade === "greater" || bracket === "boss") ? "greater" : "lesser";

      // Shape
      _set(root, "role", ROLE_OPTS.includes(String(a.bestiary?.role)) ? a.bestiary.role : (ROLE_OPTS.includes(String(sys.role)) ? sys.role : "brute"));
      _set(root, "tier", tierNum); _set(root, "bracket", bracket);
      _set(root, "sephirah", SEPHIRAH_OPTS.includes(sys.magic?.sephirah) ? sys.magic.sephirah : (sys.magic?.sephirah === "gevurah" ? "geburah" : _val(root, "sephirah")));
      for (const k of FACULTY_KEYS) _setAttr(root, k, sys.attributes?.[k]?.value ?? 2);
      _set(root, "integrity", sys.derived?.integrity?.max ?? 25);
      _set(root, "stress", sys.derived?.stress?.max ?? 12);
      _setChips(root, "resistances", sys.defenses?.resistances ?? []);
      _setChips(root, "immunities", sys.defenses?.immunities ?? []);
      _setChips(root, "vulnerabilities", sys.defenses?.vulnerabilities ?? []);
      _setChips(root, "conditionImmunities", sys.conditionImmunities ?? []);
      _set(root, "themes", (a.bestiary?.themes ?? []).join(", "));
      if (a.price?.currency) _set(root, "currency", a.price.currency);
      const note = root.querySelector("[data-bbttcc-kitnote]");
      if (note) note.textContent = `Cloning ${doc.items?.size ?? doc.items?.length ?? 0} item(s) from ${doc.name}. Envelope-derived damage formulas rescale to the tier × bracket you pick; the Lineage Trait is added if missing.`;
    });
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 *  COMMIT — build npc actor + seed kit items
 *  ──────────────────────────────────────────────────────────────────────── */

function _parseDefChips(csv) {
  return String(csv || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).map(k => {
    const [t, f] = k.split(":");
    return f ? { type: t, flavor: f } : t;
  });
}

/* Clone an exemplar's items, rescaling envelope-derived formulas. */
function _cloneExemplarItems(doc, fromSpec, toSpec) {
  const out = [];
  const fromFormula = DMG[fromSpec.bracket]?.[fromSpec.tier];
  const toFormula   = DMG[toSpec.bracket]?.[toSpec.tier];
  for (const it of doc.items ?? []) {
    const data = it.toObject ? it.toObject() : foundry.utils.duplicate(it);
    delete data._id; data.folder = null; data.ownership = { default: 0 };
    if (data.type === "weapon" && data.system?.damage) {
      const cur = String(data.system.damage.formula ?? "").trim();
      if (fromFormula && toFormula && cur === fromFormula) data.system.damage.formula = toFormula;
      const t = rfiType(data.system.damage.type, data.system.damage.damageFlavor);
      data.system.damage.type = t; data.system.damage.track = rfiTrack(t);
    }
    foundry.utils.setProperty(data, "flags.fourththing.rfi.item.tier", toSpec.tier);
    out.push(data);
  }
  return out;
}

async function _commit(root) {
  if (!root) return null;
  const read = (name) => _val(root, name);
  const readAttr = (k) => Number(root.querySelector(`[data-bbttcc-attr="${k}"]`)?.value ?? 0) || 0;
  const csv  = (name) => String(read(name) || "").split(",").map(s => s.trim()).filter(Boolean);

  const name = String(read("name") || "").trim();
  if (!name) { ui.notifications?.warn?.("RFI Monster needs a name."); return null; }

  const lineageKey = String(read("_lineage") || "wild");
  const lin        = LINEAGE_BY_KEY[lineageKey] ?? LINEAGES[0];
  const sub        = root.querySelector(`[data-bbttcc-sub="${lineageKey}"]`)?.value ?? "";
  const grade      = lineageKey === "qliphothic" ? (root.querySelector('[data-bbttcc-grade="qliphothic"]')?.value ?? "lesser") : "";
  const role       = ROLE_OPTS.includes(String(read("role"))) ? String(read("role")) : "brute";
  const bracket    = BRACKET_OPTS.includes(String(read("bracket"))) ? String(read("bracket")) : "light";
  const tierNum    = Math.max(1, Math.min(4, Number(read("tier")) || 1));
  const tierRoman  = ROMAN[tierNum];
  const sephirah   = SEPHIRAH_OPTS.includes(String(read("sephirah"))) ? String(read("sephirah")) : lin.tree;
  const title      = String(read("title") || "").trim();
  const archetype  = String(read("archetype") || "").trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const concept    = String(read("concept") || "").trim();
  const signature  = String(read("signature") || "").trim();
  const factionId  = String(read("factionId") || "").trim();
  const disposition = Number(read("disposition") ?? -1);
  const isSwarm    = !!read("swarm");
  const isBoss     = bracket === "boss";
  const currency   = String(read("currency") || lin.currency);

  const attributes = {}; for (const k of FACULTY_KEYS) attributes[k] = { value: readAttr(k) };
  const integMax  = Math.max(1, Number(read("integrity")) || INTEGRITY[bracket][tierRoman] || 25);
  const stressMax = Math.max(1, Number(read("stress"))    || Math.floor(integMax * _lineageStressRatio(root)));

  const guard   = 10 + tierNum + (isBoss ? 2 : 0);
  const evasion = guard + (role === "stealth" ? 2 : 0);
  const resolve = guard + (role === "caster"  ? 2 : 0);

  const resistances        = _parseDefChips(read("resistances"));
  const immunities         = _parseDefChips(read("immunities"));
  const vulnerabilities    = _parseDefChips(read("vulnerabilities"));
  const conditionImmunities = csv("conditionImmunities");
  const themes             = csv("themes");

  // Exemplar (optional)
  const exemplarUuid = String(read("_exemplarUuid") || "");
  let exemplar = null;
  if (exemplarUuid) { try { exemplar = await fromUuid(exemplarUuid); } catch (_e) {} }
  const img  = exemplar?.img || "icons/svg/mystery-man.svg";
  const loot = exemplar?.flags?.fourththing?.rfi?.actor?.bestiary?.lootTable ?? lin.loot;

  // Price — creature rubric (§6).
  let price = null;
  try {
    const p = game.fourththing?.pricing?.computeCreaturePricing?.({ tier: tierRoman, bracket, lineage: lineageKey });
    if (p) price = { marks: p.bounty, bounty: p.bounty, hire: p.hire, ransom: p.ransom, currency, gmOverride: false,
      notes: `T${tierRoman} ${bracket} ${lineageKey} — bounty ${p.bounty}${p.hire != null ? ` / hire ${p.hire}` : ""} marks; credited to the pool matching the method (default ${currency})` };
    else console.warn(`[${MOD}/monster-builder] computeCreaturePricing unavailable — actor created without a price`);
  } catch (e) { console.debug(`[${MOD}/monster-builder] pricing unavailable (non-fatal)`, e); }

  const creatureType = isSwarm ? [lin.creatureType, "swarm"] : lin.creatureType;
  const q = lineageKey === "qliphothic" ? QLIPHOTH[sub] : null;

  const data = {
    name, type: "npc", img,
    flags: {
      [MOD]: { entityKind: "monster", createdViaMonsterBuilder: true, createdAt: Date.now(), lineage: lineageKey, exemplarUuid: exemplarUuid || null },
      fourththing: {
        creatureType,
        rfi: { actor: {
          tier: tierRoman, bracket, archetype, lineage: lineageKey,
          ...(sub ? { subLineage: sub } : {}),
          ...(title ? { title } : {}),
          ...(q ? { qliphah: { name: q.label, hullOf: q.hullOf, grade: grade || "lesser" } } : {}),
          bestiary: { themes, role, lootTable: loot },
          ...(price ? { price } : {})
        } }
      }
    },
    system: {
      role, tier: tierNum, factionId, notes: concept || "",
      details:    { level: LEVEL_BY_TIER[tierNum] ?? tierNum, tier: tierNum, statPoints: 0, skillPoints: 0 },
      faction:    { id: factionId || null, loyalty: 0 },
      attributes, skills: {},
      derived: { integrity: { value: integMax, max: integMax }, stress: { value: stressMax, max: stressMax }, guard: { value: guard }, evasion: { value: evasion }, resolve: { value: resolve } },
      magic: { clarity: { value: 2, max: 5 }, noise: { value: 0, max: 10 }, sephirah },
      resources: {
        frameDice: { current: 0, max: 0 }, ruinCharges: { current: 0, max: 0 }, pace: { current: 0, max: 0 },
        package: { type: "", id: "", carried: false }, burn: { current: 0, max: 8 }, aura: { state: "none" },
        surge: { value: 0, max: 10, sceneResetAt: null }, dreamResonance: { active: false, insightUsed: false, hexSephirah: "" },
        forgeCharge: { relicUsed: false, sparksRepaired: 0 }
      },
      conditions: {},
      actions:    { actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFt: 0, movementBudgetFt: 30 },
      defenses:   { resistances, immunities, vulnerabilities },
      conditionImmunities,
      tags: [...new Set([...themes, ...(q ? ["qliphothic", `qliphah-${sub}`, `hull-of-${q.hullOf}`, grade || "lesser"] : [])])],
      radiation: { rp: 0, thresholds: { minor: 25, major: 50, severe: 75 } },
      darkness:  { value: 0, taint: 0, fragments: [] }
    },
    prototypeToken: { actorLink: false, disposition }
  };
  if (factionId) data.flags["bbttcc-factions"] = { factionId };

  const descParts = [];
  if (title)     descParts.push(`<p><em>${_esc(title)}</em></p>`);
  if (concept)   descParts.push(`<p><strong>Concept.</strong> ${_esc(concept)}</p>`);
  if (signature) descParts.push(`<p><strong>Signature.</strong> ${_esc(signature)}</p>`);
  if (descParts.length) {
    foundry.utils.setProperty(data, "system.details.biography", { value: descParts.join("\n"), public: "" });
    foundry.utils.setProperty(data, "system.description", descParts.join("\n"));
  }

  let actor;
  try { actor = await Actor.create(data); }
  catch (err) { console.error(`[${MOD}/monster-builder] Actor.create failed`, err); ui.notifications?.error?.(`Failed to create RFI Monster: ${err?.message || err}`); return null; }
  if (!actor) return null;

  // ── Items: exemplar clone (rescaled) or lineage strike; + lineage trait; + boss kit.
  const spec = { tier: tierRoman, bracket, role, lineage: lineageKey };
  let items = [];
  try {
    if (exemplar) {
      const fromSpec = { tier: String(read("_exemplarTier") || tierRoman), bracket: String(read("_exemplarBracket") || bracket) };
      items = _cloneExemplarItems(exemplar, fromSpec, spec);
    } else if (lin.strike) {
      items = buildItemsForKit(spec, [{ kind: "attack", ...lin.strike }]);
    }
    const have = new Set(items.map(i => String(i.name).toLowerCase()));
    const lineageItems = buildItemsForKit(spec, lineageKit(spec, { sub, grade, name }));
    for (const li of lineageItems) if (!have.has(String(li.name).toLowerCase())) { items.push(li); have.add(String(li.name).toLowerCase()); }
    if (isBoss && ![...have].some(n => n.startsWith("fractured will"))) {
      for (const bi of buildItemsForKit(spec, bossKit(spec, name))) if (!have.has(String(bi.name).toLowerCase())) items.push(bi);
    }
    if (items.length) await actor.createEmbeddedDocuments("Item", items);
  } catch (e) { console.warn(`[${MOD}/monster-builder] kit seed failed (non-fatal):`, e); }

  // ── Save as exemplar (optional)
  let savedExemplar = null;
  if (read("saveExemplar")) {
    try { savedExemplar = await saveAsExemplar(actor); }
    catch (e) { console.warn(`[${MOD}/monster-builder] save-as-exemplar failed`, e); ui.notifications?.warn?.(`Created ${actor.name}, but saving it to the pack failed: ${e?.message || e}`); }
  }

  actor.sheet?.render(true);
  ui.notifications?.info?.(`Created RFI Monster: ${actor.name} (${lin.label}${sub ? ` · ${sub}` : ""} · T${tierRoman} ${bracket} ${role}) — ${items.length} item(s)${exemplar ? ` from ${exemplar.name}` : ""}${savedExemplar ? " · saved to the NPC Pack as an exemplar" : ""}`);
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
      lineages: LINEAGES,
      qliphoth: QLIPHOTH,
      banners: MORTAL_BANNERS,
      envelopes: { INTEGRITY, DMG },
      loadExemplarIndex, listExemplars, saveAsExemplar,
      // Legacy names kept for callers that introspected the old catalog.
      get categories() { return LINEAGES.map(l => ({ key: l.key, label: l.label, domain: l.domain })); },
      get templates()  { return _exemplarCache ?? []; }
    };
  } catch (_e) {}
}
_install();
Hooks.once("ready", () => { _install(); loadExemplarIndex().catch(() => {}); });
