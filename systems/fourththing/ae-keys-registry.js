// Roll for Initiation — Active Effect Key Registry
// ─────────────────────────────────────────────────────────────────────────────
// Curated catalog of every AE change-key the fourththing engine actually
// reads. Powers the searchable typeahead in the Active Effect editor (see
// ae-key-picker.enhancer.js).
//
// Modules can extend the registry at runtime:
//   game.fourththing.ae.register({ key: "flags.bbttcc-territory.foo", label: "Hex Foo", category: "Hex / Strategic", desc: "..." });
//   game.fourththing.ae.registerMany([ ... ]);
//
// Schema:
//   { key, label, category, modes?, desc?, readBy?, valueHint? }
//     - key:       canonical document path the engine reads
//     - label:     human-readable display name
//     - category:  group label for the UI (alphabetical sort within group)
//     - modes:     suggested AE change modes (informational; engine only
//                  reads "add" universally per feedback_fourththing_roll_path_aes)
//     - desc:      one-sentence description shown as tooltip / inline help
//     - readBy:    list of engine functions that consume this key
//     - valueHint: human placeholder ("integer", "0..6", "comma-sep list", etc.)
// ─────────────────────────────────────────────────────────────────────────────

const ATTRS = ["violence", "intrigue", "presence", "body", "mind", "soul"];
const SKILLS = [
  "brawl", "melee", "firearms", "athletics", "stealth", "hacking", "tinkering",
  "streetwise", "diplomacy", "intimidation", "empathy", "performance",
  "perception", "investigation", "lore", "occult", "faith", "meditation",
  "ritual", "insight", "plating", "weave", "warding"
];
const CONDITIONS = [
  "staggered", "scarred", "calmed", "blinded", "prone", "shaken",
  "burning", "restrained", "charmed", "compelled", "dying"
];

function entry(key, label, category, opts = {}) {
  return Object.assign({ key, label, category, modes: ["add", "override"] }, opts);
}

const SEED = [
  // ── Core Attributes (6) ─────────────────────────────────────────────────
  ...ATTRS.map(a => entry(
    `system.attributes.${a}.value`,
    `Attribute — ${a.charAt(0).toUpperCase() + a.slice(1)}`,
    "Attributes",
    {
      desc: `Adds to ${a} attribute. All ${a}-based 2d10 checks and ${a}-skill rolls consume this via appliedEffects.`,
      readBy: ["RfiHarvest.attempt", "ft-progression: rebuildSkillsAndAttrs", "module.js: roll-paths"]
    }
  )),

  // ── Skills (23) ─────────────────────────────────────────────────────────
  ...SKILLS.map(s => entry(
    `system.skills.${s}.value`,
    `Skill — ${s.charAt(0).toUpperCase() + s.slice(1)}`,
    "Skills",
    {
      desc: `Adds to ${s} skill checks. Stacks with the underlying attribute bonus.`,
      readBy: ["module.js: skill roll paths", "ft-progression"]
    }
  )),

  // ── Magic / Manifestation Resources ────────────────────────────────────
  entry("system.magic.clarity.value",   "Clarity — Current",   "Magic / Manifestation", { desc: "Player-spendable Clarity. Decremented on cast costs." }),
  entry("system.magic.clarity.max",     "Clarity — Max",       "Magic / Manifestation", { desc: "Clarity ceiling. Caster discipline `clarityMaxBonus` adds here." }),
  entry("system.magic.noise.value",     "Noise — Current",     "Magic / Manifestation", { desc: "Magical noise floor. Higher = louder, easier to detect." }),
  entry("system.magic.noise.max",       "Noise — Max",         "Magic / Manifestation", { desc: "Noise ceiling before pressure mechanics trigger." }),
  entry("system.magic.sephirah",        "Sephirothic Lock",    "Magic / Manifestation", { desc: "The sefirah an UNALIGNED actor (foes, pre-identity) invokes with when the item names none. A Steward's Sephirotic Alignment overrides it.", valueHint: "string" }),

  // ── Manifestation Discipline Shifts (set on feature items, aggregated) ──
  // Read off the actor (Active Effects) as well as off each item's own flags — getDisciplineShifts sums both (2026-10-29).
  entry("flags.fourththing.discipline.passive.reachDiscount",     "Discipline — Reach Discount (passive)",     "Manifestation Discipline", { desc: "Subtracts from Blood-Debt cost when extending Reach. Always-on.", valueHint: "integer" }),
  entry("flags.fourththing.discipline.passive.misfireBandShift",  "Discipline — Misfire Band Shift (passive)", "Manifestation Discipline", { desc: "Adds to d10 misfire bias. Negative values = better outcomes.", valueHint: "integer (negative=safer)" }),
  entry("flags.fourththing.discipline.passive.clarityMaxBonus",   "Discipline — Clarity Max Bonus (passive)",  "Manifestation Discipline", { desc: "Raises Clarity ceiling at data-prep time." }),
  entry("flags.fourththing.discipline.passive.upkeepScale",       "Discipline — Upkeep Scale (passive)",       "Manifestation Discipline", { desc: "Multiplier on per-tick upkeep cost. <1 = cheaper, >1 = more expensive.", valueHint: "float (0.5–2.0 typical)" }),
  entry("flags.fourththing.discipline.passive.concurrencyBonus",  "Discipline — Concurrency Bonus (passive)",  "Manifestation Discipline", { desc: "Informational; surfaced in the upkeep card. How many extra manifestations can be held." }),
  entry("flags.fourththing.discipline.mode.key",                  "Discipline — Mode Key (gated)",             "Manifestation Discipline", { desc: "Mode flag this item gates on (e.g. clSentence, wlRefraction). Grants only apply when the mode is ON.", valueHint: "string" }),
  entry("flags.fourththing.discipline.mode.grants.reachDiscount",     "Discipline — Reach Discount (mode-gated)",     "Manifestation Discipline", { desc: "Reach discount that applies only while the gated Mode is active.", valueHint: "integer" }),
  entry("flags.fourththing.discipline.mode.grants.misfireBandShift",  "Discipline — Misfire Band Shift (mode-gated)", "Manifestation Discipline", { desc: "Misfire shift that applies only while the gated Mode is active.", valueHint: "integer" }),
  entry("flags.fourththing.discipline.mode.grants.clarityMaxBonus",   "Discipline — Clarity Max Bonus (mode-gated)",  "Manifestation Discipline", { desc: "Clarity ceiling bonus that applies only while the gated Mode is active." }),
  entry("flags.fourththing.discipline.mode.grants.upkeepScale",       "Discipline — Upkeep Scale (mode-gated)",       "Manifestation Discipline", { desc: "Upkeep scale that applies only while the gated Mode is active.", valueHint: "float" }),
  entry("flags.fourththing.discipline.mode.grants.concurrencyBonus",  "Discipline — Concurrency Bonus (mode-gated)",  "Manifestation Discipline", { desc: "Concurrency bonus that applies only while the gated Mode is active." }),

  // ── Derived Stats ───────────────────────────────────────────────────────
  entry("system.derived.integrity.value",  "Integrity — Current",  "Derived Stats", { desc: "Hit-point analog. Decrements on damage." }),
  entry("system.derived.integrity.max",    "Integrity — Max",      "Derived Stats", { desc: "Integrity ceiling. Modified by RFI Integrity Scaling per level." }),
  entry("system.derived.integrity.temp",   "Integrity — Temp",     "Derived Stats", { desc: "Temporary integrity (overflow buffer)." }),
  entry("system.derived.stress.value",     "Stress — Current",     "Derived Stats", { desc: "Mental/social pressure track." }),
  entry("system.derived.stress.max",       "Stress — Max",         "Derived Stats", { desc: "Stress ceiling." }),
  entry("system.derived.guard.value",      "Guard",                "Derived Stats", { desc: "Defensive guard rating used by armor-skill resolution." }),
  // system.derived.evasion.* retired 2026-11-11 (Dave, phase 2) — Evasion is no longer computed; grant Guard instead.
  entry("system.derived.resolve.value",    "Resolve",              "Derived Stats", { desc: "Resolve track for fear, charm, and willpower." }),
  entry("system.derived.initiative.bonus", "Initiative — Bonus",   "Derived Stats", { desc: "Flat bonus to initiative rolls. Stacks with item-flag passives (flags.fourththing.passives.initiative.bonus). Applied via Combat tracker + NPC sheet's Surge Init button.", readBy: ["Combat.rollInitiative", "_onFtNpcSurgeInit"] }),

  // ── Resources (resource pools the engine spends) ────────────────────────
  entry("system.resources.frameDice.current", "Frame Dice — Current", "Resources", { desc: "Bulwark / Path-of-Frame defensive dice pool." }),
  entry("system.resources.frameDice.max",     "Frame Dice — Max",     "Resources", { desc: "Frame Dice ceiling." }),
  entry("system.resources.stress.current",    "Stress (resource) — Current", "Resources", { desc: "Stress as a resource pool (separate from derived.stress in some paths)." }),
  entry("system.resources.burn.current",      "Burn — Current",       "Resources", { desc: "LEGACY — Burn is folded into Surge (2026-10-29); nothing reads this. Target system.resources.surge.value." }),
  entry("system.resources.burn.max",          "Burn — Max",           "Resources", { desc: "LEGACY — unused since Burn folded into Surge (2026-10-29)." }),
  entry("system.resources.aura.state",        "Aura — State",         "Resources", { desc: "Aurablade aura state (off / kindled / blazing).", valueHint: "string" }),
  entry("system.resources.accessDice.current","Access Dice — Current","Resources", { desc: "Shadow Courier access pool." }),
  entry("system.resources.accessDice.max",    "Access Dice — Max",    "Resources", { desc: "Access Dice ceiling." }),
  entry("system.resources.ruinCharges.current","Ruin Charges — Current","Resources", { desc: "Bulwark Ruin Charges pool." }),
  entry("system.resources.ruinCharges.max",   "Ruin Charges — Max",   "Resources", { desc: "Ruin Charges ceiling." }),
  entry("system.resources.dreamResonance.active",      "Dream Resonance — Active",      "Resources", { desc: "Dream Resonance toggle." }),
  entry("system.resources.dreamResonance.insightUsed", "Dream Resonance — Insight Used","Resources", { desc: "Insights spent this Soma Break." }),
  entry("system.resources.dreamResonance.hexSephirah", "Dream Resonance — Hex Sephirah","Resources", { desc: "Currently locked sephirah for resonance." }),
  entry("system.resources.forgeCharge.relicUsed",      "Forge Charge — Relic Used",     "Resources", { desc: "Relic-Forge charges spent." }),
  entry("system.resources.forgeCharge.sparksRepaired", "Forge Charge — Sparks Repaired","Resources", { desc: "Sparks repaired via Forge Charge." }),
  entry("system.resources.surge.value",    "Surge — Current",     "Resources", { desc: "Per-Soma Break surge tally." }),
  entry("system.resources.pace.current",   "Pace — Current",      "Resources", { desc: "Shadow Courier Pace pool." }),
  entry("system.resources.pace.max",       "Pace — Max",          "Resources", { desc: "Pace ceiling." }),
  entry("system.resources.package.current","Package Slot — Current","Resources", { desc: "Carried Package count." }),
  entry("system.resources.package.max",    "Package Slot — Max",  "Resources", { desc: "Package carry ceiling." }),
  entry("system.resources.package.type",   "Package Type",        "Resources", { desc: "Active Package type (string).", valueHint: "string" }),
  entry("system.resources.package.id",     "Package ID",          "Resources", { desc: "Active Package id (string).", valueHint: "string" }),
  entry("system.resources.package.carried","Package Carried",     "Resources", { desc: "Boolean — has a Package on hand." }),

  // ── Defenses (resist/immune/vuln) ───────────────────────────────────────
  entry("system.defenses.resistances",   "Defenses — Resistances",   "Defenses", { desc: "Damage resistances. Comma-separated keys (e.g. body,intrigue).", valueHint: "comma-sep list" }),
  entry("system.defenses.immunities",    "Defenses — Immunities",    "Defenses", { desc: "Damage immunities. Comma-separated keys.", valueHint: "comma-sep list" }),
  entry("system.defenses.vulnerabilities","Defenses — Vulnerabilities","Defenses", { desc: "Damage vulnerabilities. Comma-separated keys.", valueHint: "comma-sep list" }),

  // ── Item Defense Grants (read while the item is equipped + skill-gated) ──
  // Put these on an ITEM's Active Effect (one damage-type/condition per row, or
  // comma-separated). ftComputeDefenses reads them inside the gated item loop, so
  // they only apply while the item is equipped and its armor skill is trained.
  entry("flags.fourththing.grant.resists",     "Grant — Resistance (while equipped)",  "Item Defense Grants", { desc: "Item grants this damage resistance while equipped/trained. One type per row, or comma-sep.", readBy: ["ftComputeDefenses"], valueHint: "damage-type key" }),
  entry("flags.fourththing.grant.immunes",     "Grant — Immunity (while equipped)",    "Item Defense Grants", { desc: "Item grants this damage immunity while equipped/trained.", readBy: ["ftComputeDefenses"], valueHint: "damage-type key" }),
  entry("flags.fourththing.grant.vulns",       "Grant — Vulnerability (while equipped)","Item Defense Grants", { desc: "Item imposes this damage vulnerability while equipped.", readBy: ["ftComputeDefenses"], valueHint: "damage-type key" }),
  entry("flags.fourththing.grant.condImmunes", "Grant — Condition Immunity (while equipped)","Item Defense Grants", { desc: "Item grants immunity to this condition while equipped/trained.", readBy: ["ftComputeDefenses"], valueHint: "condition key" }),
  entry("flags.fourththing.grant.guard",       "Grant — Guard bonus (armor)",          "Item Defense Grants", { desc: "Armor's Guard modifier. Takes precedence over native guardBonus; scaled by armor-skill rank.", readBy: ["ftComputeArmorBonus"], valueHint: "integer (±)" }),
  entry("flags.fourththing.grant.evasion",     "Grant — Evasion (RETIRED → Guard)",    "Item Defense Grants", { desc: "RETIRED 2026-11-11 — use Grant — Guard. A legacy positive row still folds into the item's Guard as max(guard, evasion) + ⌊min/2⌋; negatives are ignored.", readBy: ["_ftArmorGuardRaw"], valueHint: "integer (+)" }),
  entry("flags.fourththing.grant.resolve",     "Grant — Resolve bonus (armor)",        "Item Defense Grants", { desc: "Armor's Resolve modifier. Takes precedence over native resolveBonus; scaled by armor-skill rank.", readBy: ["ftComputeArmorBonus"], valueHint: "integer (±)" }),
  entry("flags.fourththing.grant.surgeCap",    "Grant — Surge cap (while equipped)",   "Item Defense Grants", { desc: "Worn or wielded item raises the Steward's Surge cap by this much while equipped (summed across items, clamped to +4). 2026-10-31 Halloween hoard.", readBy: ["_ftSurgeCap"], valueHint: "integer (+)" }),

  // ── Conditions (boolean flags) ──────────────────────────────────────────
  ...CONDITIONS.map(c => entry(
    `system.conditions.${c}`,
    `Condition — ${c.charAt(0).toUpperCase() + c.slice(1)}`,
    "Conditions",
    { desc: `Boolean — actor has the ${c} condition.`, valueHint: "true|false", modes: ["override"] }
  )),

  // ── Last Stand ──────────────────────────────────────────────────────────
  entry("system.lastStand.active",    "Last Stand — Active",    "Last Stand", { desc: "Boolean — character is in Last Stand." }),
  entry("system.lastStand.failures",  "Last Stand — Failures",  "Last Stand", { desc: "Failures accumulated this Last Stand." }),
  entry("system.lastStand.successes", "Last Stand — Successes", "Last Stand", { desc: "Successes accumulated this Last Stand." }),
  entry("system.lastStand.ledger",    "Last Stand — Ledger",    "Last Stand", { desc: "Ledger array of last-stand events.", valueHint: "JSON array" }),

  // ── Blood Debt ──────────────────────────────────────────────────────────
  entry("system.bloodDebt.value",  "Blood Debt — Current", "Blood Debt", { desc: "Current Blood Debt total. Spent on Reach extension." }),
  entry("system.bloodDebt.ledger", "Blood Debt — Ledger",  "Blood Debt", { desc: "Ledger array of debt-incur events.", valueHint: "JSON array" }),

  // ── Radiation ───────────────────────────────────────────────────────────
  entry("system.radiation.rp",         "Radiation — RP",         "Radiation", { desc: "Radiation Points accumulated." }),
  entry("system.radiation.thresholds", "Radiation — Thresholds", "Radiation", { desc: "Threshold ladder for radiation effects.", valueHint: "JSON" }),

  // ── Actions (per-turn flags) ────────────────────────────────────────────
  entry("system.actions.actionUsed",   "Action Used",     "Actions", { desc: "Boolean — main action consumed this turn.", modes: ["override"] }),
  entry("system.actions.bonusUsed",    "Bonus Action Used","Actions", { desc: "Boolean — bonus action consumed this turn.", modes: ["override"] }),
  entry("system.actions.reactionUsed", "Reaction Used",   "Actions", { desc: "Boolean — reaction consumed this turn.", modes: ["override"] }),

  // ── Details ─────────────────────────────────────────────────────────────
  entry("system.details.level",       "Details — Level",        "Details", { desc: "Character level." }),
  entry("system.details.tier",        "Details — Tier",         "Details", { desc: "Character tier (I–IV)." }),
  entry("system.details.skillPoints", "Details — Skill Points", "Details", { desc: "Unspent skill points pool." }),

  // ── Manifestation (item-level fields) ───────────────────────────────────
  // NOT AE-reachable (teeth P36, 2026-11-08): FourthThingItem never applies its own effects, and a transferred effect
  // writes these keys onto the ACTOR, where nothing reads them. Kept so an existing effect still sorts into this group;
  // the descriptions name the real enums so a GM reading one knows what the field holds. Edit the item instead.
  entry("system.manifestation.costValue",      "Manifestation — Cost Value",  "Manifestation Item", { desc: "Not AE-reachable (edit the item). Amount of the extra cost (1–10), paid on top of the tier's Clarity.", valueHint: "integer" }),
  entry("system.manifestation.costType",       "Manifestation — Extra Cost",  "Manifestation Item", { desc: "Not AE-reachable (edit the item). Extra cost on top of the tier's Clarity: none / stress / noise / strain. Every manifestation always pays its tier in Clarity (T1 1 · T2 2 · T3 3 · T4 4).", valueHint: "none|stress|noise|strain" }),
  entry("system.manifestation.stability",      "Manifestation — Stability",   "Manifestation Item", { desc: "Not AE-reachable (edit the item). How long it lasts: instant (resolves and is gone) / sustained (the scene; tier Clarity when the scene ends) / bound (across scenes; tier Clarity per Soma Break). Legacy \"enduring\" reads as bound.", valueHint: "instant|sustained|bound" }),
  entry("system.manifestation.duration",       "Manifestation — Duration",    "Manifestation Item", { desc: "Not AE-reachable (edit the item). Derived from stability (instant / scene / persistent) — the normalizer overwrites it; set stability instead.", valueHint: "instant|scene|persistent" }),
  entry("system.intent",       "Manifestation — Intent (attribute)",   "Manifestation Item", { desc: "Not AE-reachable (edit the item). The faculty the item rolls with (cast or attack) AND adds to its damage or heal roll. Weapons default to Violence.", valueHint: "violence|intrigue|presence|body|mind|soul" }),
  entry("system.channel",      "Manifestation — Channel (attribute)",  "Manifestation Item", { desc: "Not AE-reachable (edit the item). Attribute used as channel in the cast formula.", valueHint: "violence|intrigue|presence|body|mind|soul" }),
  entry("system.sephirah",     "Manifestation — Sephirah",             "Manifestation Item", { desc: "Not AE-reachable (edit the item). Fallback sefirah (keter/chokhmah/binah/…) for an unaligned actor — sets the +1 Align bonus. A Steward's Sephirotic Alignment overrides it.", valueHint: "string" }),
  // system.activation (legacy string) retired 2026-11-08 — system.manifestation.activation.type (action / bonus / reaction / none) is the only activation field.
  // system.range (the power "Range Baseline" key) retired 2026-11-08 (teeth P25) — read only as a legacy shim; rangeFt is the one range.
  entry("system.manifestation.rangeFt", "Manifestation — Range (ft)",  "Manifestation Item", { desc: "Not AE-reachable (edit the item). The manifestation's range in feet — the one range every check reads. 0 = touch / self. A Form's Short/Long follow it.", valueHint: "integer" }),
  entry("system.uses.spent",   "Manifestation — Uses Spent",           "Manifestation Item", { desc: "Not AE-reachable (edit the item). Per-Soma-Break use counter for limited manifestations." }),

  // ── RFI Item Flags (item-AEs that mutate the carrier item) ──────────────
  entry("flags.fourththing.rfi.item.tier",        "Item — Tier",         "Item Flags", { desc: "RFI item tier (I/II/III/IV).", valueHint: "I|II|III|IV" }),
  entry("flags.fourththing.rfi.item.frame",       "Item — Frame",        "Item Flags", { desc: "RFI frame (weapon/armor/tool/sigil/vehicle/consumable/container/material).", valueHint: "string" }),
  entry("flags.fourththing.rfi.item.charges",     "Item — Charges",      "Item Flags", { desc: "RFI item charge pool." }),
  entry("flags.fourththing.rfi.item.bound",       "Item — Bound",        "Item Flags", { desc: "Bound state (free/attuned/soulbound).", valueHint: "string" }),
  entry("flags.fourththing.rfi.item.harmonized",  "Item — Harmonized",   "Item Flags", { desc: "Boolean — crafted with great success." }),
  entry("flags.fourththing.rfi.item.upkeep.mode", "Item — Upkeep Mode",  "Item Flags", { desc: "passive | active.", valueHint: "string" }),
  entry("flags.fourththing.rfi.item.upkeep.per",  "Item — Upkeep Cadence","Item Flags", { desc: "none | turn | scene | soma-break.", valueHint: "string" }),

  // ── Faction (assigned to a character/NPC) ───────────────────────────────
  entry("system.faction.id",   "Faction — ID",   "Faction", { desc: "Owning faction actor id." }),
  entry("system.faction.name", "Faction — Name", "Faction", { desc: "Owning faction display name." })
];

class AERegistry {
  constructor() {
    this._map = new Map();
    for (const e of SEED) this._add(e);
  }
  _add(e) {
    if (!e || !e.key) return;
    const norm = Object.assign({ modes: ["add", "override"], category: "Other" }, e);
    this._map.set(e.key, norm);
  }
  register(entryObj) { this._add(entryObj); return this; }
  registerMany(arr)  { (arr || []).forEach(e => this._add(e)); return this; }
  get(key)           { return this._map.get(key) || null; }
  has(key)           { return this._map.has(key); }
  all()              { return [...this._map.values()]; }
  byCategory()       {
    const out = new Map();
    for (const e of this._map.values()) {
      if (!out.has(e.category)) out.set(e.category, []);
      out.get(e.category).push(e);
    }
    for (const arr of out.values()) arr.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }
  /** Print a markdown table of every key. Re-runnable when the registry grows. */
  docs() {
    const lines = ["| Category | Key | Label | Description |", "| --- | --- | --- | --- |"];
    const groups = [...this.byCategory().entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [cat, entries] of groups) {
      for (const e of entries) {
        lines.push(`| ${cat} | \`${e.key}\` | ${e.label} | ${e.desc || ""} |`);
      }
    }
    const md = lines.join("\n");
    console.log(md);
    return md;
  }
}

export const AE_REGISTRY = new AERegistry();
export default AE_REGISTRY;
