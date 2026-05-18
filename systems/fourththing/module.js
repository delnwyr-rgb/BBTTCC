// Fourth Thing System — module.js  v0.3.0
// Sprint A: Magic Engine | Sprint B: Combat Engine | Sprint C: BBTTCC Bridge

import {
  getBBTTCCContext,
  getTerrainMagicModifiers,
  getIdentityData,
  getLinkedFaction,
  getFactionEchoAssets,
  ftEnsureEchoAssetsBootstrap,
  openBridge,
  openRadiation,
  openTikkunPopup,
  openIdentityChooser,
  openFactionSheet,
  setActorFaction,
  applyIdentitySlotChange,
  setActorPoliticalPhilosophy,
  setActorEnlightenment,
  setActorEchoAssetSlot,
  applyActorClassChange,
  applyActorAncestryChange,
  applyActorSubclassChange,
  applyActorHeritageChange
} from "./bbttcc-bridge.js";
import {
  getDisciplineShifts,
  getReachDiscount,
  getMisfireBandShift,
  getClarityMaxBonus,
  getUpkeepScale,
  getConcurrencyBonus,
  summarizeDiscipline
} from "./manifestation-discipline.js";

import {
  ftTranslate,
  detectASIs,
  applyASIs,
  STAT_TO_FT
} from "./ft-translation.js";

import {
  levelUp,
  openSpendSkillPoints,
  applySkillGrantsFromFeatures,
  extractSkillGrantsFromFeature,
  promoteStampedAptitudeAEs,
  applyPathFeatures,
  syncAuraEffects,
  skillRollWithRank,
  getAllSkillAEBonuses,
  getAllAttrAEBonuses,
  collectRerolls,
  applyRerollGrants,
  consumeAnnotationReroll,
  collectResourceGrants,
  fireResourceGrants,
  collectTriggers,
  fireTriggers,
  resetSomaBreakTriggerLimits,
  SKILL_RANK_DATA,
  tierForLevel,
  SKILL_POINT_LEVELS,
  deriveItemUnlockLevel
} from "./ft-progression.js";

import {
  dispatchFeatureAction,
  detectActivePools,
  getResources,
  AURA_STATES,
  getBurnBand,
  openSpendFrameDie,
  openFrameDiePool,
  openAurabladeAction,
  openChangeAura,
  openStabilizeBurn,
  openBurnState,
  openSpendAccessDie,
  openAccessPool,
  openBreakerRuin,
  openDreamwalkerResonance,
  openDreamwalkerDeployCache,
  openDreamwalkerEchoReservoir,
  openDreamwalkerSpendEchoDie,
  openSoulSmithForge,
  openPassiveClassInfo,
  // Sprint F — new handlers
  openBulwarkSpendFrame,
  openBulwarkFramePool,
  openBulwarkRuin,
  openBulwarkStance,
  openShadowCourierPackage,
  openShadowCourierCrossing,
  openShadowCourierPassive,
  openCosmicLinguistAuthority,
  openCosmicLinguistAnnotation,
  openPactkeeperLeverage,
  openPactkeeperBindingClause,
  openPactkeeperPrecedent,
  openPactkeeperCivicCharge,
  openPactkeeperSpendCivicCharge,
  openPactkeeperPressure,
  openPactkeeperBindSubject,
  openCounterManifestation,
  // Buried per-use Phase 1 — Ancestry cores (2026-04-27)
  openMenhirkinHexRecognition,
  openEchoDiverTemporalFlinch,
  openSephirotScionAttunement,
  openQliphScarredSaturation,
  // Buried per-use Phase 2 — Heritage-unique + ancestry feats (2026-04-27)
  openMenhirkinIgneousPicker,
  openMenhirkinIgneousHeatMemory,
  openOldenbornRustlandPatch,
  openFurrykinPredatorPatience,
  openOldenbornPhoenixOath,
  openOldenbornHearthDominion,
  openOldenbornSunScar,
  // Buried per-use Phase 3 — Species multi-ability pickers (2026-04-27)
  openCircuitbornAbilities,
  openCircuitbornAttentionResonance,
  openCircuitbornGlitchSurge,
  openHumanAbilities,
  openHumanAdaptive,
  openHumanTenacious,
  openStormbornWardOfTheGale,
  // Buried per-use Phase 4 — Character options (data-driven, 2026-04-27)
  openCharOptAbility,
  isActionableFeature,
  // Action-economy audit pass 2026-05-04 — exposed for tools/audit-action-economy-gaps
  CHAR_OPT_ABILITIES,
  FEATURE_ROUTER
} from "./ft-class-automation.js";

import RfiItems    from "./rfi-items.js";
import RfiCrafting from "./rfi-crafting.js";
import RfiHarvest  from "./rfi-harvest.js";

// ─── Constants ──────────────────────────────────────────────────────────────

const FT = {
  SEPHIROTH: {
    gevurah: { label: "Gevurah", color: "#c03030", domain: "Judgment, precision force"      },
    chesed:  { label: "Chesed",  color: "#4a90d9", domain: "Healing, generosity"            },
    yesod:   { label: "Yesod",   color: "#9b59b6", domain: "Dreams, illusion, gateways"    },
    netzach: { label: "Netzach", color: "#27ae60", domain: "Momentum, triumph"              },
    hod:     { label: "Hod",     color: "#d4a017", domain: "Sigils, form, geometry"         },
    binah:   { label: "Binah",   color: "#546e7a", domain: "Boundaries, law, understanding" },
    tiferet: { label: "Tiferet", color: "#e8c84a", domain: "Harmony, balance"               },
    malkuth: { label: "Malkuth", color: "#78909c", domain: "Matter, stability"              },
    keter:   { label: "Keter",   color: "#b0bec5", domain: "Unity, nondual force"           },
    chokmah: { label: "Chokmah", color: "#7e57c2", domain: "Wisdom, founding insight"       }
  },
  INTENTS: {
    violence: { label: "Violence", attr: "violence" },
    intrigue: { label: "Intrigue", attr: "intrigue" },
    presence: { label: "Presence", attr: "presence" }
  },
  CHANNELS: {
    body: { label: "Body", attr: "body" },
    mind: { label: "Mind", attr: "mind" },
    soul: { label: "Soul", attr: "soul" }
  },
  MODES: {
    hermetic:  { label: "Hermetic",  desc: "Ritual — stable, structured, low Noise" },
    chaos:     { label: "Chaos",     desc: "Gnosis — fast, volatile, high Surge"    },
    ascendant: { label: "Ascendant", desc: "Enlightenment — effortless, near-silent"}
  },
  // Tier-clamped misfire table. Each d10 band names a category; the magnitude
  // scales with the tier the caster was operating at (reach-up uses the target
  // tier, ordinary misfire uses the caster's own tier).
  MISFIRE: {
    "1-2": {
      name: "Reality Flicker",
      byTier: {
        1: "Terrain warps 1d4 ft; a latent detail flickers into visibility.",
        2: "The room warps; latent illusions flare. Light and shadow trade places for a moment.",
        3: "The site warps; hidden things surface. A wall remembers an older shape.",
        4: "A district-scale warp. Factions notice. The map remembers this for a season."
      }
    },
    "3-4": {
      name: "Emotional Backfire",
      byTier: {
        1: "1d4 Stress to the caster.",
        2: "1d6 Stress to the caster.",
        3: "2d6 Stress to the caster.",
        4: "+1 Blood Debt added to the ledger."
      }
    },
    "5-6": {
      name: "Qliphothic Echo",
      byTier: {
        1: "+1 Noise until rested.",
        2: "+2 Noise until rested.",
        3: "+3 Noise and the caster is Scarred until end of scene.",
        4: "+1 Blood Debt and the caster is Scarred until redeemed."
      }
    },
    "7-8": {
      name: "Paradox Scar",
      byTier: {
        1: "Scarred condition for one turn.",
        2: "Scarred condition for the scene.",
        3: "Scarred condition through the night / session.",
        4: "Scarred until redeemed in the fiction."
      }
    },
    "9": {
      name: "Battlefield Distortion",
      byTier: {
        1: "The caster rolls Resolve vs DC 12 or is Staggered.",
        2: "Near allies roll Resolve vs DC 14 or are Staggered.",
        3: "Everyone in the site rolls Resolve vs DC 16 or is Staggered.",
        4: "Faction tremor: −1 OP of the manifestation's intent type this strategic turn."
      }
    },
    "10": {
      name: "Catastrophic Resonance",
      byTier: {
        1: "A scene-level disaster. GM narrates.",
        2: "A room/scene-scale disaster. Structural or emotional cost.",
        3: "A site or mission-level disaster. Qliphothic incursion, collapse, or surge.",
        4: "A region-scale disaster with a permanent mark on the strategic map."
      }
    }
  },
  INTENT_COLORS:  { violence: "#c03030", intrigue: "#546e7a", presence: "#4a90d9" },
  CHANNEL_COLORS: { body: "#27ae60",     mind: "#d4a017",     soul: "#9b59b6"     },
  MANIFESTATION_FORMS: {
    sigil:     { label: "Sigil" },
    field:     { label: "Field" },
    echo:      { label: "Echo" },
    vestment:  { label: "Vestment" },
    weapon:    { label: "Weapon" },
    tool:      { label: "Tool" },
    rite:      { label: "Rite" },
    construct: { label: "Construct" },
    body:      { label: "Body-shift" },
    gate:      { label: "Gate" }
  },
  MANIFESTATION_FUNCTIONS: {
    harm:      { label: "Harm" },
    protect:   { label: "Protect" },
    reveal:    { label: "Reveal" },
    move:      { label: "Move" },
    repair:    { label: "Repair" },
    command:   { label: "Command" },
    transform: { label: "Transform" },
    bind:      { label: "Bind" }
  },
  MANIFESTATION_DURATIONS: {
    instant:    { label: "Instant" },
    action:     { label: "Action" },
    scene:      { label: "Scene" },
    turn:       { label: "Turn" },
    persistent: { label: "Persistent" }
  },
  MANIFESTATION_STABILITIES: {
    instant:   { label: "Instant" },
    sustained: { label: "Sustained" },
    bound:     { label: "Bound" },
    enduring:  { label: "Enduring" }
  },
  MANIFESTATION_INTERACTIONS: {
    event:          { label: "Event" },
    weapon:         { label: "Weapon" },
    tool:           { label: "Tool" },
    worn:           { label: "Worn Thing" },
    companion:      { label: "Companion" },
    zone:           { label: "Zone / Field" },
    mark:           { label: "Mark / Condition" },
    structure:      { label: "Structure / Object" },
    transformation: { label: "Transformation" },
    other:          { label: "Other" }
  },
  MANIFESTATION_COSTS: {
    none:    { label: "No fixed cost" },
    clarity: { label: "Clarity" },
    noise:   { label: "Noise" },
    stress:  { label: "Stress" },
    burn:    { label: "Burn" },
    custom:  { label: "Custom" }
  },
  MANIFESTATION_SCALES: {
    personal: { label: "Personal" },
    scene:    { label: "Scene" },
    faction:  { label: "Faction" },
    hex:      { label: "Hex" }
  },
  MANIFESTATION_TIERS: {
    0: { label: "T0 Fiat",      footprint: "spoken cue · 'Let there be …' · trivial / ambient flicker",  clarityCost: 0 },
    1: { label: "T1 Personal",  footprint: "one body / object / sense",       clarityCost: 1 },
    2: { label: "T2 Scene",     footprint: "one room / group / conversation", clarityCost: 2 },
    3: { label: "T3 Operation", footprint: "district / mission / night",      clarityCost: 3 },
    4: { label: "T4 Age",       footprint: "region / generation / treaty",    clarityCost: 5 }
  },
  CLARITY_BY_TIER: { 1: 5, 2: 7, 3: 10, 4: 14 },
  // Cast DC ladder (2026-05-06). Replaces the static DC 15 — higher-tier
  // workings demand a stiffer base. Reach naturally compounds: a T2 caster
  // reaching to T3 now rolls at DC 16, which (paired with the tier-scaled
  // misfire column) makes the cost of stretch tangible. Per-cast UI/manual
  // overrides still allowed (5..30) for GM scene-pressure modifiers.
  CAST_DC_BY_TIER: { 1: 12, 2: 14, 3: 16, 4: 18 }
};

function ftTierCastDC(tier) {
  const t = Math.max(1, Math.min(4, Number(tier) || 1));
  return FT.CAST_DC_BY_TIER?.[t] ?? 15;
}

// Trad Caster Classes — the four manifestation-as-primary-tool paths. TCCs
// get a deeper Clarity pool, a per-cast discount, exclusive access to T0
// Fiats (narrative "Let there be …" cues), and exclusive access to "working"-stability
// (instant) manifestations. Non-TCCs are restricted to "form"-stability shapes
// (sustained / bound / enduring) — they can still author and use them.
const FT_TCC_IDENTIFIERS = new Set([
  "cosmic_linguist",
  "wyrdlens-adept",
  "dreamwalker",
  "pactkeeper"
]);

function isTCC(actor) {
  if (!actor?.items) return false;
  for (const it of actor.items) {
    if (it?.type !== "class") continue;
    const id = it?.system?.identifier ?? "";
    if (FT_TCC_IDENTIFIERS.has(id)) return true;
  }
  return false;
}

// Master aptitude schema — same 23 skills the character template carries.
// NPCs store {value} only (label/attribute derive from this list at render
// time) so a fresh NPC's `system.skills: {}` doesn't bloat the doc, but the
// sheet still renders the full ladder for the GM to click ranks into.
const FT_SKILL_MASTER = [
  { key: "brawl",        attribute: "violence", label: "Brawl"         },
  { key: "melee",        attribute: "violence", label: "Melee"         },
  { key: "firearms",     attribute: "violence", label: "Firearms"      },
  { key: "athletics",    attribute: "violence", label: "Athletics"     },
  { key: "stealth",      attribute: "intrigue", label: "Stealth"       },
  { key: "hacking",      attribute: "intrigue", label: "Hacking"       },
  { key: "tinkering",    attribute: "intrigue", label: "Tinkering"     },
  { key: "streetwise",   attribute: "intrigue", label: "Streetwise"    },
  { key: "weave",        attribute: "intrigue", label: "Weave"         },
  { key: "diplomacy",    attribute: "presence", label: "Diplomacy"     },
  { key: "intimidation", attribute: "presence", label: "Intimidation"  },
  { key: "empathy",      attribute: "presence", label: "Empathy"       },
  { key: "performance",  attribute: "presence", label: "Performance"   },
  { key: "perception",   attribute: "mind",     label: "Perception"    },
  { key: "investigation",attribute: "mind",     label: "Investigation" },
  { key: "lore",         attribute: "mind",     label: "Lore"          },
  { key: "occult",       attribute: "mind",     label: "Occult"        },
  { key: "faith",        attribute: "soul",     label: "Faith"         },
  { key: "meditation",   attribute: "soul",     label: "Meditation"    },
  { key: "ritual",       attribute: "soul",     label: "Ritual"        },
  { key: "insight",      attribute: "soul",     label: "Insight"       },
  { key: "warding",      attribute: "soul",     label: "Warding"       },
  { key: "plating",      attribute: "body",     label: "Plating"       }
];

// Integrity scaling brackets — feeds the per-level boost in prepareDerivedData.
// Vanguard = front-line bodies; Mid = versatile/skirmisher; Caster = TCC + recon.
// Per-level boost = bracket base + ⌊Body/2⌋. Default bracket is "mid".
const FT_INTEGRITY_BRACKETS = {
  vanguard: { base: 4, classes: ["bulwark", "titanbound", "breaker", "aurablade", "harmony_marshal", "harmony-marshal"] },
  mid:      { base: 3, classes: ["shadowjack", "shadow_courier", "shadow-courier", "soul_smith", "soul-smith", "phantom_courier", "phantom-courier"] },
  caster:   { base: 2, classes: ["dreamwalker", "wyrdlens_adept", "wyrdlens-adept", "cosmic_linguist", "cosmic-linguist", "pactkeeper"] }
};
const FT_INTEGRITY_BRACKET_INDEX = (() => {
  const idx = {};
  for (const [bracket, def] of Object.entries(FT_INTEGRITY_BRACKETS)) {
    for (const id of def.classes) idx[id.toLowerCase().replace(/-/g, "_")] = { bracket, base: def.base };
  }
  return idx;
})();

function ftIntegrityBracketFor(actor) {
  if (!actor?.items) return { bracket: "mid", base: FT_INTEGRITY_BRACKETS.mid.base };
  for (const it of actor.items) {
    if (it?.type !== "class") continue;
    const id = String(it.system?.identifier ?? "").toLowerCase().replace(/-/g, "_");
    if (!id) continue;
    const hit = FT_INTEGRITY_BRACKET_INDEX[id];
    if (hit) return hit;
  }
  return { bracket: "mid", base: FT_INTEGRITY_BRACKETS.mid.base };
}

// Rig defense brackets (B11.A — 2026-05-12). Guard/Evasion are bracket-derived
// (±3 from the medium 12/11 baseline); Resolve is flat. All three get +tier
// on top in prepareDerivedData. Frame-item bracket overrides the actor-level
// one when present, matching the sheet's frame-row resolution order.
const FT_RIG_DEFENSE_BY_BRACKET = {
  personal: { guard:  9, evasion: 14, resolve: 10 },
  light:    { guard: 10, evasion: 13, resolve: 10 },
  medium:   { guard: 12, evasion: 11, resolve: 10 },
  heavy:    { guard: 14, evasion:  9, resolve: 10 },
  siege:    { guard: 15, evasion:  8, resolve: 10 }
};

// B12 ramming weight — multiplies tier into the ram damage formula
// (`${tier × weight}d6`, target full, attacker half). Mirrors the
// defense table's bracket axis. Light vs heavy → light takes more.
const FT_RIG_BRACKET_WEIGHT = {
  personal: 1, light: 2, medium: 3, heavy: 4, siege: 5
};

function ftRigBracketFor(actor) {
  const sys = actor?.system?.system ?? actor?.system ?? {};
  const frameItem = (actor?.items ?? []).find?.(
    i => i?.flags?.fourththing?.rigGear?.subtype === "rig-frame"
  );
  const bracket = frameItem?.flags?.fourththing?.rigFrame?.bracket
               ?? sys?.integrity?.bracket
               ?? "medium";
  return FT_RIG_DEFENSE_BY_BRACKET[bracket] ? bracket : "medium";
}

// Stability options surfaced in the manifestation wizard. Non-TCCs see only
// Form stabilities (sustained / bound / enduring); the engine rejects an
// `instant`-stability cast from non-TCCs at runtime regardless, but pruning
// the dropdown keeps the UI honest.
function ftStabilityOptionsForActor(actor) {
  const all = FT.MANIFESTATION_STABILITIES;
  if (isTCC(actor)) return all;
  return Object.fromEntries(Object.entries(all).filter(([k]) => k !== "instant"));
}

// Inference map for pre-existing items that only declare a `scale`.
const FT_MANIFESTATION_SCALE_TO_TIER = {
  personal: 1,
  scene:    2,
  faction:  3,
  hex:      4
};

// Resolve a d10 misfire roll against the tier-scaled table. Tier clamps to 1..4.
function ftResolveMisfire(d10, tier = 1) {
  const clamped = Math.max(1, Math.min(4, Math.floor(Number(tier) || 1)));
  const key = d10 <= 2 ? "1-2"
            : d10 <= 4 ? "3-4"
            : d10 <= 6 ? "5-6"
            : d10 <= 8 ? "7-8"
            : d10 ===  9 ? "9"
            : "10";
  const entry = FT.MISFIRE[key];
  return {
    rolled: d10,
    tier: clamped,
    name: entry?.name ?? "Misfire",
    desc: entry?.byTier?.[clamped] ?? "Unexpected consequence."
  };
}

const FT_MANIFESTATION_PATH_LENSES = [
  {
    rx: /aurablade/i,
    label: "Aurablade lens",
    prompts: [
      "Emotion should choose the edge: fury, mercy, resolve, or dread.",
      "Good manifestations feel hot, immediate, and a little dangerous.",
      "Burn should matter in the fiction, not just on the track."
    ]
  },
  {
    rx: /bulwark|titanbound|breaker/i,
    label: "Bulwark lens",
    prompts: [
      "Think in mass, anchoring, pressure waves, denial, and shelter.",
      "Forms want to be walls, frames, impacts, braces, or moving fortifications.",
      "A good Bulwark manifestation changes the battlefield shape."
    ]
  },
  {
    rx: /shadow courier|phantom courier|shadowjack/i,
    label: "Shadow Courier lens",
    prompts: [
      "Thresholds matter: doors, crossings, deliveries, rumors, arrivals.",
      "Your manifestations should feel like transit, smuggling, or sudden appearance.",
      "Ask what is being carried, hidden, or brought through."
    ]
  },
  {
    rx: /dreamwalker/i,
    label: "Dreamwalker lens",
    prompts: [
      "Lean into mirrors, doubles, dream-logic, and unreal movement.",
      "A Dreamwalker working should solve problems sideways rather than head-on.",
      "Ask what becomes symbolic, porous, or impossible-but-true."
    ]
  },
  {
    rx: /soul[- ]smith/i,
    label: "Soul-Smith lens",
    prompts: [
      "Make memory, devotion, or repair tactile.",
      "Forms want to be relics, restorations, sacramental tools, or repaired lives.",
      "A Soul-Smith manifestation should feel crafted, consecrated, and costly."
    ]
  },
  {
    rx: /cosmic linguist/i,
    label: "Cosmic Linguist lens",
    prompts: [
      "Treat reality like editable text: footnotes, substitutions, emphasis, deletion.",
      "A good working changes meaning first and matter second.",
      "Name the sentence you are editing, not just the effect you want."
    ]
  },
  {
    rx: /pactkeeper/i,
    label: "Pactkeeper lens",
    prompts: [
      "Witness, obligation, penalty, and precedent are your native verbs.",
      "Manifestations should sound like agreements reality now has to honor.",
      "Always ask who is bound, what clause bites, and how it is enforced."
    ]
  },
  {
    rx: /harmony marshal/i,
    label: "Harmony Marshal lens",
    prompts: [
      "Steward the room: calm, cadence, formations, de-escalation, lawful presence.",
      "Your workings should reorder conflict rather than merely overpower it.",
      "A Harmony Marshal manifestation should feel authoritative without becoming sterile."
    ]
  },
  {
    rx: /wyrdlens adept/i,
    label: "Wyrdlens lens",
    prompts: [
      "Perception is force: lenses, correspondences, revelations, impossible angles.",
      "Manifestations should expose hidden structure or let you act through it.",
      "Ask what becomes visible, legible, or newly targetable."
    ]
  }
];

const FT_MANIFESTATION_DOCTRINE_LENSES = [
  {
    rx: /annotator/i,
    label: "Annotator doctrine",
    prompts: [
      "Prefer surgical changes with precise scope.",
      "A small note should produce a large consequence.",
      "You are strongest when the edit looks modest."
    ]
  },
  {
    rx: /metaphor apostle/i,
    label: "Metaphor Apostle doctrine",
    prompts: [
      "Reality bends when likeness is declared and believed.",
      "Your workings should hinge on symbolic equivalence.",
      "Say what counts as what now."
    ]
  },
  {
    rx: /redactor/i,
    label: "Redactor doctrine",
    prompts: [
      "Power lies in omission, silence, and removal.",
      "A good redaction is terrifying because it leaves clean edges.",
      "Ask what word, path, memory, or option disappears."
    ]
  },
  {
    rx: /archivist/i,
    label: "Archivist doctrine",
    prompts: [
      "Past rulings and remembered vows should do work in the present.",
      "Manifestations feel indexed, cited, and hard to argue with.",
      "Let history become leverage."
    ]
  },
  {
    rx: /auditor/i,
    label: "Auditor doctrine",
    prompts: [
      "Expose imbalance, debt, fraud, or hidden cost.",
      "Good workings reveal the true ledger of a scene.",
      "A manifestation should make somebody owe the room an answer."
    ]
  },
  {
    rx: /steward/i,
    label: "Steward doctrine",
    prompts: [
      "Protect the agreement and the vulnerable party together.",
      "Your manifestations should preserve trust while sharpening consequence.",
      "Ask what boundary keeps the whole thing from collapsing."
    ]
  },
  {
    rx: /wayfarer/i,
    label: "Wayfarer doctrine",
    prompts: [
      "Movement is mercy: routes, deliveries, and impossible arrival.",
      "A good manifestation opens the road for someone who needs it.",
      "Think in safe passage, not just teleportation."
    ]
  },
  {
    rx: /black stair/i,
    label: "Black Stair doctrine",
    prompts: [
      "Thresholds should feel predatory, covert, or weaponized.",
      "Manifestations should make crossings dangerous for the wrong people.",
      "Ask who gets through and who really, really doesn't."
    ]
  },
  {
    rx: /last mile/i,
    label: "Last Mile doctrine",
    prompts: [
      "Carry the unbearable thing to where it must go.",
      "Your workings should feel intimate, burdensome, and exact.",
      "A manifestation should answer: who bears the package now?"
    ]
  },
  {
    rx: /cataclyst/i,
    label: "Cataclyst doctrine",
    prompts: [
      "Trade stability for eruption on purpose.",
      "Stances and shifts should feel like controlled disaster.",
      "Ask what breaks so something stronger can move."
    ]
  },
  {
    rx: /avalanche/i,
    label: "Avalanche doctrine",
    prompts: [
      "Momentum is the point, not collateral damage.",
      "Your manifestations should hit like geography deciding to move.",
      "Keep the fiction fast, loud, and undeniable."
    ]
  },
  {
    rx: /mountain/i,
    label: "Mountain doctrine",
    prompts: [
      "Durability, refusal, and rootedness come first.",
      "A good manifestation should make the scene bounce off you.",
      "Ask what becomes immovable, load-bearing, or patient."
    ]
  }
];

const FT_MANIFESTATION_USAGE_CUES = {
  generic: [
    "Start with what you are bringing into the world, not with taxonomy.",
    "If it mostly happens, it will tend to read like a Working. If it mostly stays, it will tend to read like a Form.",
    "Stability and interaction tell the table whether this manifestation flashes, lingers, binds, or endures."
  ],
  power: [
    "Ephemeral and ritual manifestations usually live here: rites, revelations, transformations, echoes, curses, and one-scene miracles."
  ],
  weapon: [
    "Stable manifestations usually live here: blades, tools, vestments, companions, lingering zones, and strange objects that stay."
  ],
  ritual: [
    "Ongoing manifestations want a visible upkeep rhythm: breath, vow, hymn, pain, attention, or repeated cost."
  ]
};

const FT_MANIFESTATION_STARTERS = {
  ephemeral: {
    label: "Ephemeral",
    kind: "power",
    helper: "It happens, strikes, unfolds, appears briefly, or resolves.",
    defaults: {
      family: "working",
      form: "sigil",
      function: "transform",
      stability: "instant",
      interactionModel: "event",
      duration: "instant",
      scale: "personal",
      costType: "clarity",
      costValue: 1
    }
  },
  stable: {
    label: "Stable",
    kind: "weapon",
    helper: "It remains, can be carried, worn, inhabited, wielded, or sustained.",
    defaults: {
      family: "form",
      form: "weapon",
      function: "harm",
      stability: "bound",
      interactionModel: "weapon",
      duration: "scene",
      scale: "personal",
      costType: "none",
      costValue: 0
    }
  },
  ritual: {
    label: "Ritual / Ongoing",
    kind: "power",
    helper: "It remains because attention, rhythm, cost, or vow keeps it alive.",
    defaults: {
      family: "working",
      form: "rite",
      function: "bind",
      stability: "sustained",
      interactionModel: "event",
      duration: "scene",
      scale: "scene",
      costType: "stress",
      costValue: 1,
      maintenanceCost: "1 Stress per scene maintained"
    }
  },
  working: {
    label: "Working preset",
    kind: "power",
    helper: "A manifestation in motion. Best for strikes, revelations, transformations, curses, bursts, and one-scene miracles.",
    defaults: {
      family: "working",
      form: "sigil",
      function: "transform",
      stability: "instant",
      interactionModel: "event",
      duration: "instant",
      scale: "personal",
      costType: "clarity",
      costValue: 1
    }
  },
  form: {
    label: "Form preset",
    kind: "weapon",
    helper: "A manifestation that has learned how to stay. Best for blades, vestments, companions, wards, lingering zones, and strange objects.",
    defaults: {
      family: "form",
      form: "weapon",
      function: "harm",
      stability: "bound",
      interactionModel: "weapon",
      duration: "scene",
      scale: "personal",
      costType: "none",
      costValue: 0
    }
  }
};

const FT_MANIFESTATION_THIRD_THING_PROMPTS = [
  "What is the visible tell that always marks this as your work?",
  "What taboo, side-effect, or weird rule keeps it from being a generic spell?",
  "What does the GM get to complicate when this goes loud, messy, or overused?"
];

// ─── Core helpers ─────────────────────────────────────────────────────────────

function ftAlignmentMod(sephirah, intent, channel) {
  const rules = {
    gevurah: () => intent === "violence"                           ? 1 : 0,
    chesed:  () => intent === "presence"                           ? 1 : 0,
    yesod:   () => (intent === "intrigue" || channel === "soul")   ? 1 : 0,
    netzach: () => (intent === "violence" && channel === "body")   ? 1 : 0,
    hod:     () => channel === "mind"                              ? 1 : 0,
    binah:   () => (channel === "mind" || intent === "intrigue")   ? 1 : 0,
    tiferet: () => channel === "soul"                              ? 1 : 0,
    malkuth: () => channel === "body"                              ? 1 : 0,
    keter:   () => 1
  };
  return (rules[sephirah] ?? (() => 0))();
}

function ftCap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""; }
function ftNoiseClass(n) { return n >= 8 ? "noise-critical" : n >= 5 ? "noise-high" : n >= 3 ? "noise-mid" : "noise-ok"; }
function ftLabelFromMap(map, key, fallback = "") {
  return map?.[key]?.label ?? fallback ?? key;
}

// Legacy weapon skill keys → canonical actor skill keys. Pre-2026-05 weapons
// authored with `system.skill: "ranged"` etc. don't match any actor skill on
// the steward, which made the engage dropdown fall to the first option.
const FT_LEGACY_SKILL_ALIASES = {
  ranged: "firearms", gun: "firearms", guns: "firearms",
  gunnery: "firearms", archery: "firearms", bow: "firearms", marksmanship: "firearms",
  unarmed: "brawl", fists: "brawl", fist: "brawl", martialarts: "brawl", brawling: "brawl",
  blade: "melee", blades: "melee", sword: "melee", swords: "melee"
};

// Resolve the weapon's skill key to one that exists on the actor. Preference
// chain: exact match → alias map → category-based fallback (`ranged`→firearms,
// `melee`→melee) → first available skill on the actor.
function ftResolveWeaponSkill(actor, weaponSkillKey, weaponCategory = "") {
  const sysData = actor?.system?.system ?? actor?.system ?? {};
  const skills  = sysData?.skills ?? {};
  const key = String(weaponSkillKey ?? "").toLowerCase().trim();
  if (key && skills[key]) return key;
  const aliased = FT_LEGACY_SKILL_ALIASES[key];
  if (aliased && skills[aliased]) return aliased;
  const cat = String(weaponCategory ?? "").toLowerCase().trim();
  if (cat === "ranged" && skills.firearms) return "firearms";
  if (cat === "melee"  && skills.melee)    return "melee";
  return Object.keys(skills)[0] ?? "melee";
}

// Which target defense a weapon naturally swings at. Ranged → evasion (dodge);
// melee → guard (parry/block). Falls back to guard for unknown categories.
function ftWeaponTargetDefense(item) {
  const cat = String(item?.system?.category ?? "").toLowerCase();
  if (cat === "ranged") return "evasion";
  return "guard";
}

// Find an item suitable for an Attack of Opportunity. AoO can fire on any
// melee effect (weapon or Form manifestation) per RFI canon. Equipped melee
// weapons are preferred; falls back to any melee weapon, then any weapon-tagged
// melee Form manifestation. Returns null if nothing usable.
function ftFindMeleeAttackItem(actor) {
  if (!actor?.items) return null;
  const isMelee = (it) => String(it?.system?.category ?? "").toLowerCase() === "melee";
  const equipped = (it) => !!it.getFlag?.("fourththing", "equipped");
  const weapons = Array.from(actor.items).filter(i => i.type === "weapon");
  return weapons.find(w => isMelee(w) && equipped(w))
      ?? weapons.find(w => isMelee(w))
      ?? null;
}

// Open the Engage dialog programmatically. Extracted from _onFtStrike so the
// AoO chat-button consumer can re-use the exact same flow (target banner,
// defense auto-pick, flank banner, faculty-to-damage, animation, etc.).
// Rig weapon firing (B11.C — 2026-05-12). Canonical API for a boarded
// steward/NPC firing one of their rig's weapons. Wraps ftOpenEngageDialog
// with pre-flight: weapon must be a rig-weapon on a rig, caller must be
// boarded on that rig as gunner/crew. The dialog itself enforces the
// destroyed-rig guard and the per-round gunner gate.
async function ftRigWeaponFire(steward, weapon) {
  if (!steward || !weapon) return;
  const subtype = weapon?.flags?.fourththing?.rigGear?.subtype;
  if (subtype !== "rig-weapon" || weapon.parent?.type !== "rig") {
    ui.notifications?.warn(`${weapon?.name ?? "Item"} is not a rig-weapon.`);
    return;
  }
  const rig = weapon.parent;
  const boarded = steward.getFlag?.("fourththing", "boardedRig");
  if (!boarded || boarded.rigId !== rig.id) {
    ui.notifications?.warn(`${steward.name} is not boarded on ${rig.name}.`);
    return;
  }
  // 2026-05-13 — Refined: gate on whether the rig has a Gunner role
  // authored, not on bracket. If `capacity.gunner.max === 0`, no gunner
  // role exists → any boarded role (typically just the pilot on a solo
  // rig) can fire.
  const _frameItem = (rig?.items ?? []).find?.(it => it?.flags?.fourththing?.rigGear?.subtype === "rig-frame");
  const _gunnerCap = Number(rig?.system?.crew?.capacity?.gunner?.max
                         ?? _frameItem?.flags?.fourththing?.rigFrame?.capacity?.gunner?.max
                         ?? 0);
  const _hasGunnerRole = _gunnerCap > 0;
  const _allowFireForRole = _hasGunnerRole
    ? (boarded.role === "gunner" || boarded.role === "crew")
    : true;
  if (!_allowFireForRole) {
    ui.notifications?.warn(`${steward.name}: only Gunner or Crew can fire rig weapons (role: ${boarded.role}).`);
    return;
  }
  return ftOpenEngageDialog(steward, weapon);
}

function ftOpenEngageDialog(actor, item) {
  if (!actor || !item) return;

  // B11.C rig-weapon detection. When item is a rig-weapon owned by a rig,
  // frame the dialog + chat as "fire from rig", run the destroyed guard,
  // and enforce the per-round gunner gate. The setter for the gate flag
  // runs after the engage callback resolves, so dialog cancellations
  // don't burn the gunner's shot for the round.
  const rigSubtype = item?.flags?.fourththing?.rigGear?.subtype;
  const isRigWeapon = rigSubtype === "rig-weapon" && item?.parent?.type === "rig";
  const rig = isRigWeapon ? item.parent : null;

  if (rig && rig.system?.identity?.state === "destroyed") {
    ui.notifications?.warn(`${rig.name} is destroyed — its weapons can't fire.`);
    return;
  }
  // 2026-05-13 — Per-weapon gate (was per-gunner). A gunner with multiple
  // rig weapons can fire each one once per round. Tracked in
  // `combat.rigWeaponsFiredThisRound[weaponId]`. Cleared on _onFtNewTurn.
  if (rig && actor?.flags?.fourththing?.combat?.rigWeaponsFiredThisRound?.[item.id]) {
    ui.notifications?.warn(`${actor.name}: ${item.name} already fired this round.`);
    return;
  }

  const intent  = item?.system?.intent   ?? "violence";
  const skill   = item?.system?.skill    ?? "melee";
  const dmgF    = item?.system?.damage?.formula      ?? "";
  const dmgT    = item?.system?.damage?.type         ?? "kinetic";
  const dmgFlv  = item?.system?.damage?.damageFlavor ?? "";
  const label   = item?.name ?? "Strike";
  const chatLabel = rig ? `${label} · ${rig.name}` : label;

  return new Dialog({
    title:   rig ? `Fire ${label} · ${rig.name}` : `Engage: ${label}`,
    content: buildAttackDialogHTML(actor, item),
    render: (html) => {
      const $h = html?.find ? html : $(html);
      const $sel = $h.find("select[name='defense']");
      const $val = $h.find("input[name='defenseValue']");
      $sel.on("change", function () {
        const opt = this.selectedOptions[0];
        if (!opt) return;
        const t = opt.dataset.targetVal;
        const s = opt.dataset.selfVal;
        const next = (t && t !== "" && t !== "?") ? Number(t)
                   : (s && s !== "?")             ? Number(s)
                   : null;
        if (Number.isFinite(next)) $val.val(next);
      });
    },
    buttons: {
      strike: {
        icon:  "<i class='fas fa-sword'></i>",
        label: "Engage",
        callback: async (html) => {
          const defense      = html.find("[name='defense']").val()        || "guard";
          const defVal       = parseInt(html.find("[name='defenseValue']").val()) || 14;
          const selIntent    = html.find("[name='intent']").val()         || intent;
          const selSkill     = html.find("[name='skill']").val()          || skill;
          const applyCost    = html.find("[name='applyCost']").is(":checked");
          const costAssessment = ftAssessManifestationCost(actor, item, "weapon");

          if (applyCost && costAssessment?.autoSupported && !costAssessment.canPay) {
            ui.notifications?.warn(`${actor.name}: cannot currently pay ${costAssessment.label}.`);
            return false;
          }

          const restraint    = parseInt(html.find("[name='restraintReduction']").val()) || 0;
          const targetTokens = Array.from(game.user?.targets ?? []);
          const targetActor  = targetTokens[0]?.actor ?? null;
          const flankBonus   = Number(html.find(".ft-cast-dialog").attr("data-ft-flank-bonus")) || 0;

          const result = await game.fourththing.rolls.attackTest(actor, {
            intent: selIntent, skill: selSkill,
            defense, defenseValue: defVal,
            label: chatLabel, damageFormula: dmgF, damageType: dmgT, damageFlavor: dmgFlv,
            costNote: costAssessment?.label ?? "",
            signature: item?.system?.manifestation?.signature ?? "",
            thirdThing: item?.system?.manifestation?.thirdThing ?? "",
            target: targetActor, restraintReduction: restraint,
            flankBonus
          });

          ftPlayAutoAnimation(actor, item, { hit: !!result?.success });

          if (applyCost && costAssessment) {
            const applied = await ftApplyManifestationCost(actor, costAssessment);
            if (applied.applied) ui.notifications?.info(`${actor.name}: ${applied.summary}.`);
          }

          // B11.C: burn the per-round gunner gate AFTER the roll resolves so
          // dialog cancels don't consume it. Records last-fired ids for the
          // panel's visual state + downstream debugging.
          if (rig && result) {
            // 2026-05-13 — Per-weapon gate: stamp the specific weapon id in
            // a map so other weapons stay fire-able this round.
            const combat = actor.flags?.fourththing?.combat ?? {};
            const fired = { ...(combat.rigWeaponsFiredThisRound ?? {}) };
            fired[item.id] = true;
            await actor.setFlag("fourththing", "combat", {
              ...combat,
              rigWeaponsFiredThisRound: fired,
              lastFiredRigId:    rig.id,
              lastFiredWeaponId: item.id
            });
          }

          return result;
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "strike"
  }).render(true);
}

// Count flanking allies of `attackerActor` against `targetActor` (Phase 3).
// Returns the number of OTHER same-disposition tokens within melee reach of
// the target, NOT counting the attacker itself. Flanking bonus per RFI canon
// is exactly this count: 1 ally → +1, 2 allies → +2, all attackers benefit.
// Uses chebyshev distance (D&D 5e default — diagonals = orthogonals at 5 ft
// each square) so adjacent counts as in-reach for a 5 ft weapon.
function ftCountFlankers(attackerActor, targetActor, { reachFt = 5 } = {}) {
  if (!attackerActor || !targetActor) return { count: 0, names: [] };
  const targetTok   = targetActor.getActiveTokens?.()?.[0];
  const attackerTok = attackerActor.getActiveTokens?.()?.[0];
  if (!targetTok || !attackerTok) return { count: 0, names: [] };
  if (targetTok.id === attackerTok.id) return { count: 0, names: [] };
  const scene = targetTok.scene ?? canvas.scene;
  const gridSize = scene?.grid?.size     ?? 100;
  const gridDist = scene?.grid?.distance ?? 5;
  const attackerDisp = attackerTok.document?.disposition ?? attackerTok.disposition ?? 0;
  const tx = targetTok.center?.x ?? targetTok.x;
  const ty = targetTok.center?.y ?? targetTok.y;
  const reachPx = (reachFt / gridDist) * gridSize;
  const fudge   = gridSize * 0.05;
  const names = [];
  for (const tok of canvas.tokens?.placeables ?? []) {
    if (tok.id === targetTok.id || tok.id === attackerTok.id) continue;
    if (tok.document?.hidden) continue;
    const disp = tok.document?.disposition ?? tok.disposition ?? 0;
    if (disp !== attackerDisp) continue;
    const cx = tok.center?.x ?? tok.x;
    const cy = tok.center?.y ?? tok.y;
    const cheb = Math.max(Math.abs(cx - tx), Math.abs(cy - ty));
    if (cheb <= reachPx + fudge) names.push(tok.name);
  }
  return { count: names.length, names };
}

// Phase 2 / G4 (2026-05-12): canvas VFX bridge for rig combat events.
// Mirrors the bbttcc-travel-visuals PIXI pattern (no Sequencer/AA dep).
// Plays a ring-pulse on a target token for impact/explosion/repair, and
// a directed line + double-impact for ramming collisions. Subscribed to
// `bbttcc:rig:damaged` + `bbttcc:rig:destroyed` so the hits land
// automatically; the ram/repair handlers call into the spawners
// directly. AA bridge below still runs for per-item weapon configs —
// these PIXI VFX are the universal fallback + event-driven layer.

const _FT_COMBAT_VFX_PRESETS = {
  impact:    { color: 0xff5252, ringWidth: 4, maxRadiusMult: 0.9, durationMs: 480 },
  explosion: { color: 0xff9a3c, ringWidth: 6, maxRadiusMult: 1.8, durationMs: 900 },
  repair:    { color: 0xa6e22e, ringWidth: 3, maxRadiusMult: 0.8, durationMs: 600 },
  collision: { color: 0xffcd3c, ringWidth: 5, maxRadiusMult: 1.1, durationMs: 600 },
  sweep:     { color: 0xc1a3ff, ringWidth: 4, maxRadiusMult: 1.4, durationMs: 720 },
  // S3a.4: Infiltration / stealth palette — muted teals + amber escalation
  stealthPing:    { color: 0x2dd4bf, ringWidth: 2, maxRadiusMult: 0.7, durationMs: 520 },
  detectionPing:  { color: 0xfbbf24, ringWidth: 3, maxRadiusMult: 1.0, durationMs: 640 },
  alarmWave:      { color: 0xef4444, ringWidth: 5, maxRadiusMult: 2.4, durationMs: 1100 },
  progressPulse:  { color: 0x14b8a6, ringWidth: 3, maxRadiusMult: 0.9, durationMs: 560 }
};

function _ftPlaceableForActor(actor) {
  if (!actor) return null;
  const tok = actor.getActiveTokens?.()?.[0];
  if (!tok) return null;
  return tok.object ?? tok;
}

function ftPlayCombatVfx(target, kind = "impact", opts = {}) {
  if (!canvas?.tokens) return;
  let placeable = null;
  if (target?.center) placeable = target;
  else if (target?.object) placeable = target.object;
  else if (target?.getActiveTokens) placeable = _ftPlaceableForActor(target);
  if (!placeable) return;
  const preset = _FT_COMBAT_VFX_PRESETS[kind] ?? _FT_COMBAT_VFX_PRESETS.impact;
  const x = placeable.center?.x ?? placeable.x;
  const y = placeable.center?.y ?? placeable.y;
  const w = placeable.w ?? placeable.width ?? 100;
  const color    = opts.color      ?? preset.color;
  const ringW    = opts.ringWidth  ?? preset.ringWidth;
  const maxR     = opts.maxRadius  ?? (w * preset.maxRadiusMult);
  const duration = opts.durationMs ?? preset.durationMs;
  const parent   = canvas.tokens;
  const ring = new PIXI.Graphics();
  ring.eventMode = "none";
  parent.addChild(ring);
  const startTs = performance.now();
  function tick() {
    const t = (performance.now() - startTs) / duration;
    if (!ring || ring.destroyed) return;
    if (t >= 1) { try { parent.removeChild(ring); ring.destroy(); } catch (_) {} return; }
    const r = maxR * t;
    const a = Math.max(0, 1 - t);
    ring.clear();
    ring.lineStyle(ringW, color, a);
    ring.drawCircle(x, y, r);
    ring.lineStyle(ringW * 2, color, a * 0.25);
    ring.drawCircle(x, y, r * 0.6);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function ftPlayRamCollisionVfx(sourceActor, targetActor) {
  if (!canvas?.tokens) return;
  const src = _ftPlaceableForActor(sourceActor);
  const tgt = _ftPlaceableForActor(targetActor);
  if (!src || !tgt) {
    // Fallback: just impact the target if we can find it.
    if (tgt) ftPlayCombatVfx(tgt, "collision");
    return;
  }
  const x1 = src.center?.x ?? src.x;
  const y1 = src.center?.y ?? src.y;
  const x2 = tgt.center?.x ?? tgt.x;
  const y2 = tgt.center?.y ?? tgt.y;
  const parent = canvas.tokens;
  const line = new PIXI.Graphics();
  line.eventMode = "none";
  parent.addChild(line);
  const startTs = performance.now();
  const duration = 480;
  function tick() {
    const t = (performance.now() - startTs) / duration;
    if (!line || line.destroyed) return;
    if (t >= 1) { try { parent.removeChild(line); line.destroy(); } catch (_) {} return; }
    const a = Math.max(0, 1 - t);
    line.clear();
    line.lineStyle(5, 0xffcd3c, a);
    line.moveTo(x1, y1);
    line.lineTo(x2, y2);
    line.lineStyle(10, 0xffcd3c, a * 0.18);
    line.moveTo(x1, y1);
    line.lineTo(x2, y2);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  ftPlayCombatVfx(tgt, "collision", { maxRadius: (tgt.w ?? 100) * 1.1 });
  ftPlayCombatVfx(src, "impact",   { color: 0xff9a3c, maxRadius: (src.w ?? 100) * 0.7, durationMs: 360 });
}

// Raid maneuver "fire" VFX — rotating arc around the target token.
// Falls back to no-op when target lacks a canvas placeable (hex drawings etc.).
function ftPlaySweepArcVfx(target, opts = {}) {
  if (!canvas?.tokens) return;
  let placeable = null;
  if (target?.center) placeable = target;
  else if (target?.object) placeable = target.object;
  else if (target?.getActiveTokens) placeable = _ftPlaceableForActor(target);
  if (!placeable) return;
  const preset = _FT_COMBAT_VFX_PRESETS.sweep;
  const x = placeable.center?.x ?? placeable.x;
  const y = placeable.center?.y ?? placeable.y;
  const w = placeable.w ?? placeable.width ?? 100;
  const color    = opts.color      ?? preset.color;
  const ringW    = opts.ringWidth  ?? preset.ringWidth;
  const maxR     = opts.maxRadius  ?? (w * preset.maxRadiusMult);
  const duration = opts.durationMs ?? preset.durationMs;
  const arcSpan  = opts.arcSpan    ?? (Math.PI * 2 / 3);
  const parent   = canvas.tokens;
  const g = new PIXI.Graphics();
  g.eventMode = "none";
  parent.addChild(g);
  const startTs = performance.now();
  function tick() {
    const t = (performance.now() - startTs) / duration;
    if (!g || g.destroyed) return;
    if (t >= 1) { try { parent.removeChild(g); g.destroy(); } catch (_) {} return; }
    const r = maxR * (0.3 + 0.7 * t);
    const rot = (Math.PI * 2) * t - Math.PI / 2;
    const a = Math.max(0, 1 - t);
    g.clear();
    g.lineStyle(ringW, color, a);
    g.arc(x, y, r, rot, rot + arcSpan);
    g.lineStyle(ringW * 0.6, color, a * 0.5);
    g.arc(x, y, r * 0.85, rot + Math.PI, rot + Math.PI + arcSpan * 0.7);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Bridge to Automated Animations (theripper93/Otigon, module id "autoanimations").
// AA only auto-fires off system-specific hooks (dnd5e/sw5e/etc.); a custom system
// has to call its public API. AA reads its per-item flag config off the item arg,
// so the picker the user set up in the item sheet is honored without any matching
// on our side. Silent no-op if the module is missing or disabled. Source-token
// fallback chain: getActiveTokens()[0].document → its placeable → controlled
// token document → controlled placeable. AA wants a TokenDocument when isEmbedded.
function ftPlayAutoAnimation(actor, item, { hit = true } = {}) {
  if (!item) return;
  if (!game.modules.get("autoanimations")?.active) return;
  const aa = globalThis.AutomatedAnimations ?? window.AutomatedAnimations;
  if (!aa?.playAnimation) return;
  const sourceToken = actor?.getActiveTokens?.()?.[0]?.document
                   ?? actor?.getActiveTokens?.()?.[0]
                   ?? canvas?.tokens?.controlled?.[0]?.document
                   ?? canvas?.tokens?.controlled?.[0];
  if (!sourceToken) return;
  const targets = Array.from(game.user?.targets ?? []);
  try {
    aa.playAnimation(sourceToken, item, { targets, hit, hitTargets: hit ? targets : [] });
  } catch (err) {
    console.warn("[fourththing] AutoAnimations playAnimation threw:", err);
  }
}

// Phase 2 / G4: subscribe combat hooks to canvas VFX. Fire-and-forget so
// missing tokens (off-canvas actors) silently no-op. Foundry hooks are
// local-only by default — the client whose action triggered the damage
// is the one that paints. Acceptable v1; cross-client broadcast via
// socket relay is a follow-up if tables want everyone to see every hit.
Hooks.on("bbttcc:rig:damaged", ({ rig, amount } = {}) => {
  if (!rig || !(amount > 0)) return;
  try { ftPlayCombatVfx(rig, "impact"); } catch (e) { console.warn("[fourththing] impact VFX", e); }
});

Hooks.on("bbttcc:rig:destroyed", ({ rig } = {}) => {
  if (!rig) return;
  try { ftPlayCombatVfx(rig, "explosion"); } catch (e) { console.warn("[fourththing] explosion VFX", e); }
});

// 2026-05-13 — Mirror VFX subscribers for boss damage. Impact ring on
// every hit; explosion on defeat (integrity → 0). Same animation pattern
// as rigs so the visual language is consistent.
Hooks.on("bbttcc:boss:damaged", ({ boss, amount } = {}) => {
  if (!boss || !(amount > 0)) return;
  try { ftPlayCombatVfx(boss, "impact"); } catch (e) { console.warn("[fourththing] boss impact VFX", e); }
});

Hooks.on("bbttcc:boss:defeated", ({ boss } = {}) => {
  if (!boss) return;
  try { ftPlayCombatVfx(boss, "explosion"); } catch (e) { console.warn("[fourththing] boss defeat VFX", e); }
});

function ftManifestationGuide(sephirah = "tiferet") {
  const seph = FT.SEPHIROTH[sephirah] ?? FT.SEPHIROTH.tiferet;
  const prompts = {
    gevurah: ["clean cuts, verdicts, severance", "disciplined force", "hard edges and consequences"],
    chesed:  ["shelter, mercy, restoration", "softening harm", "gifts that multiply"],
    yesod:   ["dream logic, mirrors, hidden doors", "echoes and doubles", "movement through the unreal"],
    netzach: ["speed, pressure, momentum", "unstoppable advance", "victory through motion"],
    hod:     ["sigils, geometry, engineered pattern", "precise wording", "beautiful constraints"],
    binah:   ["law, containers, warded space", "measured limits", "binding through understanding"],
    tiferet: ["balance, synthesis, elegant symmetry", "healing through alignment", "beauty with consequence"],
    malkuth: ["matter, grounding, sturdy utility", "making the unreal tactile", "practical tools and bodies"],
    keter:   ["unity, impossible simplicity", "clean intention", "high-strangeness without ornament"]
  };
  return {
    key: sephirah,
    label: seph.label,
    color: seph.color,
    domain: seph.domain,
    prompts: prompts[sephirah] ?? prompts.tiferet
  };
}

function ftManifestationDefaults(kind = "power") {
  const base = {
    tier: 1,
    family: kind === "weapon" ? "form" : "working",
    concept: "",
    form: kind === "weapon" ? "weapon" : "sigil",
    function: kind === "weapon" ? "harm" : "transform",
    stability: kind === "weapon" ? "bound" : "instant",
    interactionModel: kind === "weapon" ? "weapon" : "event",
    costType: kind === "weapon" ? "none" : "clarity",
    costValue: kind === "weapon" ? 0 : 1,
    costText: "",
    duration: kind === "weapon" ? "scene" : "instant",
    durationText: "",
    triggerText: "",
    scale: "personal",
    targetText: "",
    rangeAreaText: "",
    maintenanceCost: "",
    riskText: "",
    pathResonance: "",
    fictionalPermission: "",
    gmCalibration: "",
    mechanicalHook: "",
    signature: "",
    thirdThing: "",
    opCost: { pool: "", value: 0 },
    // Phase A — structured mechanical hooks. Phase B will surface them; Phase
    // C will read them in the cast path. Defaults are inert (no template, no
    // pool consumption gate, no save) so existing items behave identically.
    area:       { shape: "none",   size: 0 },
    activation: { type: "action",  consumePool: true },
    save:       { enabled: false,  defense: "evasion", attribute: "", dcMode: "derived", dcFixed: 15 },
    // Post-cast effect resolution. shape="auto" preserves legacy behavior
    // (damage rolls + applies on cast success). shape="attack" runs a second
    // 2d10x10 + intent + channel roll vs target's static defense; misses skip
    // the damage application — no misfire (cast was clean). shape="save"
    // rolls 2d10x10 + saveAttribute for the target vs the cast DC; on success
    // the damage is halved (onSave="half") or negated (onSave="negate").
    // shape="contested" rolls both sides; ties go to the target (defensive
    // bias). On target win, damage halves or negates per onContestLoss.
    resolution: {
      shape:         "auto",
      // attack-shape fields:
      attackVs:      "evasion",          // "guard" | "evasion" | "resolve"
      attackBonus:   "intent+channel",   // shorthand for the bonus formula
      // save-shape fields:
      saveAttribute: "body",             // any of the six faculties
      saveDcMode:    "cast-dc",          // "cast-dc" reuses the cast difficulty; "fixed" uses saveDcFixed
      saveDcFixed:   15,
      onSave:        "half",             // "negate" | "half"
      // saveByPrompt=true posts a chat-card Save button instead of GM auto-rolling.
      // Singular-target only — AoE always GM-side. The button rehydrates cast
      // context from a chat-message flag and resolves damage/states on click.
      saveByPrompt:  false,
      // contested-shape fields:
      contestCasterAttribute: "intent+channel", // "intent+channel" or any single faculty
      contestTargetAttribute: "body",           // target rolls this faculty
      onContestLoss:          "negate"          // "negate" | "half" — outcome when target wins (ties → target)
    },
    // Conditions applied to the target on a successful resolution. Each
    // condition becomes an ActiveEffect on the target with save-each-round
    // metadata if enabled. saveAttribute = target's faculty rolled at start
    // of each turn vs DC; success removes the effect.
    appliedStates: {
      states:        [],          // array of FT.CONDITIONS keys, e.g. ["staggered","burning"]
      duration:      "1-round",   // "1-round" | "2-rounds" | "3-rounds" | "scene" | "until-saved"
      saveEachRound: false,
      saveAttribute: "body",      // target's faculty for the recurring save
      saveDcMode:    "cast-dc",
      saveDcFixed:   15,
      // Per-condition save-attribute override (2026-05-06). Map of
      // conditionKey → faculty key. If a state has an entry, its recurring
      // save uses this attribute instead of the global saveAttribute. Lets
      // a single cast apply Burning (Body to shake) AND Compelled (Soul to
      // shake) without forcing one shared attribute. Empty {} = all states
      // inherit the global saveAttribute (legacy behavior).
      saveAttributeOverrides: {}
    }
  };

  return foundry.utils.deepClone(base);
}

// Manifestation Editor Overhaul — Phase A. Structured damage roll shape used
// by Phase C in castManifestation. `op` switches damage vs heal; `attribute`
// (faculty) is added to the rolled total; `track` selects which actor track
// receives the result. Defaults to op:"none" so legacy items roll nothing.
function ftDamageRollDefaults() {
  return { op: "none", number: 0, die: "d6", attribute: "", type: "kinetic", flavor: "", track: "integrity" };
}

// Phase C — place a Foundry MeasuredTemplate at the caster's token center.
// Player drags to position. Maps RFI shapes → Foundry template types:
// cone→cone, sphere→circle, line→ray, cube→rect, cylinder→circle (height
// not modeled — Foundry's MeasuredTemplate is 2D only).
async function ftPlaceAreaTemplate(actor, area) {
  if (!canvas?.scene) return null;
  const token = actor?.getActiveTokens?.()?.[0];
  if (!token) {
    ui.notifications?.warn(`${actor.name}: cannot place area template — no active token on this scene.`);
    return null;
  }
  const SHAPE_MAP = { cone: "cone", sphere: "circle", line: "ray", cube: "rect", cylinder: "circle" };
  const t = SHAPE_MAP[area.shape];
  if (!t) return null;
  const distance = Math.max(5, Number(area.size) || 5);
  const data = {
    t, user: game.user.id, distance, direction: 0,
    x: token.center?.x ?? token.x, y: token.center?.y ?? token.y,
    fillColor: game.user.color ?? "#ff5500"
  };
  if (t === "cone") data.angle = 53;   // standard 5e cone angle
  if (t === "ray")  data.width = 5;    // 5 ft default line width
  try {
    const docs = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [data]);
    return docs?.[0] ?? null;
  } catch (err) {
    console.warn("[fourththing] template placement failed:", err);
    return null;
  }
}

// Walk all token placeables on the active scene and return those whose
// center point falls inside the template's PIXI shape. Standard V14 pattern:
// shapes are local-anchored at (0,0), so subtract template origin before
// hit-testing. Caster's actor (and any other excluded actor IDs) skipped —
// friendlies-in-blast handling is GM call, but auto-self-blast feels wrong.
function _ftTokensInTemplate(templateDoc, { excludeActorIds = new Set() } = {}) {
  const t = templateDoc?.object;
  if (!t || !t.shape) return [];
  const tokens = canvas?.tokens?.placeables ?? [];
  const out = [];
  for (const tok of tokens) {
    const a = tok.actor;
    if (!a || excludeActorIds.has(a.id)) continue;
    const cx = tok.center?.x ?? (tok.x + (tok.w ?? 0) / 2);
    const cy = tok.center?.y ?? (tok.y + (tok.h ?? 0) / 2);
    if (t.shape.contains(cx - t.x, cy - t.y)) out.push(tok);
  }
  return out;
}

// saveByPrompt — post a deferred Save button chat card. The cast's damage +
// state apply are queued behind the click; clicking rolls the save on the
// target's side, then walks the same downstream apply path with the resulting
// multiplier. Context lives on the chat-message flag so we can rehydrate
// without rolling damage twice. Singular-target only — AoE always GM-side.
// Phase D 2026-05-08 — Dreamwalker per-rest one-shot flag readers. Each
// returns the bonus value if active and identifies the AE clone to consume
// after the roll. Flags live under flags.bbttcc.dreamwalker.* — set by the
// AEs cloned via openDreamwalkerFeatActivate. Consumption deletes the
// corresponding AE from the actor (Foundry handles the flag clearing on next
// prepareData).
function _ftReadDwOneShots(actor, { context = "check" } = {}) {
  const f = actor?.flags?.bbttcc?.dreamwalker ?? {};
  const out = { bonusD6: 0, bonusD4: 0, advantage: false, sources: [] };
  // Omen-Thread Weaving (L10) — +1d6 on next check / save / attack
  if ((Number(f.omenThreadD6) || 0) > 0) {
    out.bonusD6 += 1;
    out.sources.push({ key: "flags.bbttcc.dreamwalker.omenThreadD6", label: "Omen-Thread (+1d6)" });
  }
  // Foresight Thread (L2 Dream-Thread Tuning option) — +1d4 on next attack /
  // save / attribute check (class text says "after seeing the roll" — we
  // consume pre-roll for engine simplicity; tunable in playtest).
  if ((Number(f.foresightD4) || 0) > 0) {
    out.bonusD4 += 1;
    out.sources.push({ key: "flags.bbttcc.dreamwalker.foresightD4", label: "Foresight Thread (+1d4)" });
  }
  // Fractal Self (L18) — advantage on next attack / check (reroll-lowest).
  if (context === "attack" || context === "check") {
    if ((Number(f.fractalAdvantage) || 0) > 0) {
      out.advantage = true;
      out.sources.push({ key: "flags.bbttcc.dreamwalker.fractalAdvantage", label: "Fractal Self (reroll-lowest)" });
    }
  }
  return out;
}

async function _ftConsumeDwOneShots(actor, oneShots) {
  if (!actor || !oneShots?.sources?.length) return;
  const toDelete = [];
  for (const src of oneShots.sources) {
    const ae = (actor.effects ?? []).find(e =>
      !e.disabled && (e.changes ?? []).some(c => c.key === src.key)
    );
    if (ae) toDelete.push(ae.id);
  }
  if (toDelete.length) {
    try { await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete); }
    catch (e) { console.warn("Roll for Initiation | DW one-shot consume failed", e); }
  }
}

// Phase D 2026-05-08 — chat-card context expiry helper. Saves a stamped
// `expiresAt` onto every multi-step chat context (savePrompt / aoeSavePrompt /
// misfireConvert / aoeApplyAll). Click handlers call this helper at the top;
// when expired, button disables + a notification fires so a long session's
// stale buttons don't re-apply effects.
function _ftCtxExpired(ctx, btn, label = "Action") {
  const exp = Number(ctx?.expiresAt) || 0;
  if (exp > 0 && Date.now() > exp) {
    ui.notifications?.warn(`${label} expired (chat card is older than its window).`);
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.4";
      btn.textContent = (btn.textContent || "").replace(/^/, "✕ ");
    }
    return true;
  }
  return false;
}

// Phase C 2026-05-07 — Misfire conversion follow-up card. Posted by
// castManifestation after a misfire when the actor is eligible:
//   • Wyrdlens Adept tier 4+ → Tikkun Sight (1/Soma Break, refunds 1 Surge → Clarity)
//   • Pactkeeper tier 2+ (Init 6+) → Renegotiate (accepts a narrative debt)
// Conversion is narrative — the GM applies the base-tier effect at the table.
// Bookkeeping (Surge refund + debt ledger) fires from the click handler.
async function _ftPostMisfireConversionCard(actor, item, misfireData, { castDc, manTier, mode } = {}) {
  if (!actor || !item || !misfireData) return null;
  const sys  = actor.system?.system ?? actor.system ?? {};
  const tier = Math.max(1, Math.min(4, Number(sys?.details?.tier) || 1));
  const hasWL = actor.items?.some(it => it.type === "class" && (it.system?.identifier === "wyrdlens-adept" || it.system?.identifier === "wyrdlens_adept"));
  const hasPK = actor.items?.some(it => it.type === "class" && it.system?.identifier === "pactkeeper");
  const wlReady = hasWL && tier >= 4 && !actor.flags?.fourththing?.disciplineUsed?.wlTikkunSight;
  const pkReady = hasPK && tier >= 2;
  if (!wlReady && !pkReady) return null;

  const ctx = {
    casterUuid: actor.uuid,
    itemUuid:   item.uuid,
    itemName:   item.name,
    misfire:    { rolled: misfireData.rolled, name: misfireData.name },
    castDc, manTier, mode,
    // 24h expiry — chat-card buttons stop working after a day so a long
    // session doesn't accidentally re-apply effects to dead/moved targets.
    expiresAt: Date.now() + 86400000
  };
  const buttons = [];
  if (wlReady) buttons.push(`<button class="ft-misfire-convert-btn" data-gate="wlTikkunSight" style="background:#1a2f3a;color:#a0c8d8;border:1px solid #3a6a8a;padding:0.3rem 0.6rem;border-radius:4px;cursor:pointer;text-align:left">🔭 Tikkun Sight — refund Surge as Clarity (1/Soma Break)</button>`);
  if (pkReady) buttons.push(`<button class="ft-misfire-convert-btn" data-gate="pkRenegotiate" style="background:#1f2a2a;color:#a0c8b8;border:1px solid #3a6a5a;padding:0.3rem 0.6rem;border-radius:4px;cursor:pointer;text-align:left">§ Renegotiate — accept narrative debt</button>`);
  const html = `<div class="fourththing-roll ft-misfire-convert-card" style="border-color:#8a6a2a">
    <div class="ft-roll-header"><span class="ft-roll-name" style="color:#f5d97a">⚖ ${ftEscapeHtml(item.name)} — Misfire conversion available</span></div>
    <p style="margin:0.4rem 0;font-size:0.82rem">Misfire ${misfireData.rolled} (${ftEscapeHtml(misfireData.name)}) rolled. Convert to base-tier success?</p>
    <div style="display:flex;flex-direction:column;gap:0.3rem;align-items:flex-start;">${buttons.join("")}</div>
    <p style="margin:0.4rem 0 0;font-size:0.7rem;opacity:0.55">Conversion is narrative — GM applies the base-tier effect at the table. Bookkeeping (Surge refund / debt ledger) fires automatically on click.</p>
  </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    flags: { fourththing: { misfireConvertContext: ctx } }
  });
}

async function _ftHandleMisfireConvertClick(btn, message) {
  if (btn.disabled) return;
  const ctx = message?.getFlag?.("fourththing", "misfireConvertContext");
  if (!ctx) {
    ui.notifications?.warn("Misfire conversion context missing.");
    btn.disabled = true;
    return;
  }
  if (_ftCtxExpired(ctx, btn, "Misfire conversion")) return;
  const caster = await fromUuid(ctx.casterUuid).catch(() => null);
  if (!caster) { ui.notifications?.warn("Caster not found."); btn.disabled = true; return; }
  if (!caster.testUserPermission?.(game.user, "OWNER") && !game.user.isGM) {
    ui.notifications?.warn(`Only ${caster.name}'s owner (or the GM) can convert this misfire.`);
    return;
  }
  const gate = btn.dataset?.gate;
  const sys  = caster.system?.system ?? caster.system ?? {};

  if (gate === "wlTikkunSight") {
    if (caster.flags?.fourththing?.disciplineUsed?.wlTikkunSight) {
      ui.notifications?.warn(`${caster.name}: Tikkun Sight already used this Soma Break.`);
      return;
    }
    const curSurge   = Number(sys?.resources?.surge?.value) || 0;
    const curClarity = Number(sys?.magic?.clarity?.value)   || 0;
    const maxClarity = Number(sys?.magic?.clarity?.max)     || 5;
    const refundAmount = Math.min(1, Math.max(0, maxClarity - curClarity));
    const updates = { "flags.fourththing.disciplineUsed.wlTikkunSight": true };
    if (refundAmount > 0) updates["system.magic.clarity.value"]   = curClarity + refundAmount;
    if (curSurge > 0)     updates["system.resources.surge.value"] = Math.max(0, curSurge - 1);
    await caster.update(updates);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `<div class="fourththing-roll" style="border-color:#3a6a8a">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0c8d8">🔭 Tikkun Sight — ${ftEscapeHtml(ctx.itemName)}</span></div>
        <p style="margin:0.3rem 0;font-size:0.82rem">Misfire converted to base-tier success. ${refundAmount > 0 ? `+${refundAmount} Clarity refunded` : "Clarity already at max — refund forfeited"}.</p>
        <p style="margin:0;font-size:0.72rem;opacity:0.6">Once per Soma Break. GM applies the base-tier effect at the table.</p>
      </div>`
    });
  } else if (gate === "pkRenegotiate") {
    const debt = await new Promise(resolve => {
      new Dialog({
        title: "Pactkeeper — Renegotiate",
        content: `<div class="ft-cast-dialog">
          <p style="font-size:0.8rem;margin:0 0 0.4rem">Accept the narrative debt the GM offers, then phrase the renegotiation:</p>
          <input type="text" name="debt" placeholder="e.g., 'A favor owed to the Verdict Court next session'" style="width:100%"/>
        </div>`,
        buttons: {
          bind:   { label: "Bind the debt", callback: html => resolve(html.find("[name='debt']").val()?.trim() || "(unspecified — GM tracks)") },
          cancel: { label: "Cancel",        callback: () => resolve(null) }
        },
        default: "bind",
        close:   () => resolve(null)
      }).render(true);
    });
    if (debt == null) return;
    const ledger = Array.isArray(caster.flags?.fourththing?.pkNarrativeDebts) ? caster.flags.fourththing.pkNarrativeDebts : [];
    const entry  = { ts: Date.now(), debt, source: ctx.itemName, misfire: ctx.misfire?.name };
    await caster.update({ "flags.fourththing.pkNarrativeDebts": [...ledger, entry] });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `<div class="fourththing-roll" style="border-color:#3a6a5a">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0c8b8">§ Renegotiate — ${ftEscapeHtml(ctx.itemName)}</span></div>
        <p style="margin:0.3rem 0;font-size:0.82rem">Misfire renegotiated to base-tier success.</p>
        <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85"><b>Debt:</b> ${ftEscapeHtml(debt)}</p>
        <p style="margin:0;font-size:0.72rem;opacity:0.55">GM applies base-tier effect; debt logged on Pactkeeper for future scenes.</p>
      </div>`
    });
  }
  btn.closest(".ft-misfire-convert-card")?.querySelectorAll("button").forEach(b => { b.disabled = true; b.style.opacity = "0.4"; b.style.cursor = "default"; });
}

// AoE Save-prompt card (Phase D 2026-05-08). One card per affected token in
// the AoE walk; each target's owner clicks Save to roll their own. The pre-
// rolled AoE base damage is snapshotted onto the chat-message context so each
// target multiplies the SAME base damage (mirrors the canonical AoE semantic).
async function _ftPostAoeSavePromptCard(actor, target, item, mf, dr, baseDmg, trackKey, { castDc, intent, channel, rollOverride = null } = {}) {
  const r = mf.resolution ?? {};
  const saveAttr = r.saveAttribute || "body";
  const dc = r.saveDcMode === "fixed" ? (Number(r.saveDcFixed) || 15) : (Number(castDc) || 15);
  const onSave = ["negate", "half"].includes(r.onSave) ? r.onSave : "half";
  const ctx = {
    casterUuid: actor.uuid,
    targetUuid: target.uuid,
    itemUuid:   item.uuid,
    castDc, intent, channel,
    resolution: foundry.utils.deepClone(r),
    appliedStates: foundry.utils.deepClone(mf.appliedStates ?? {}),
    damageRoll: foundry.utils.deepClone(dr ?? {}),
    aoeBaseDmg: Number(baseDmg) || 0,
    aoeTrackKey: String(trackKey || "integrity"),
    rollOverride: rollOverride || null,
    expiresAt: Date.now() + 86400000
  };
  const opLabel = dr?.op === "heal" ? "heal" : (dr?.op === "damage" ? "damage" : "effect");
  const html = `<div class="fourththing-roll ft-aoe-save-prompt-card">
    <div class="ft-roll-header"><span class="ft-roll-name">⚖ ${ftEscapeHtml(item.name)} (AoE) — Save vs ${ftCap(saveAttr)} (DC ${dc})</span></div>
    <p style="margin:0.4rem 0;font-size:0.82rem">
      <b>${ftEscapeHtml(target.name)}</b>, click below to roll your save against <b>${ftEscapeHtml(actor.name)}</b>'s working.
      <span style="opacity:0.75">On ${onSave === "negate" ? "success: no " + opLabel : "success: half " + opLabel}.</span>
    </p>
    <button class="ft-aoe-save-prompt-btn" data-message-id="">Roll save (2d10x10 + ${ftCap(saveAttr)})</button>
  </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    flags: { fourththing: { aoeSavePromptContext: ctx } }
  });
}

async function _ftHandleAoeSavePromptClick(btn, message) {
  if (btn.disabled) return;
  const ctx = message?.getFlag?.("fourththing", "aoeSavePromptContext");
  if (!ctx) {
    ui.notifications?.warn("AoE save prompt context missing — card may be from an older cast.");
    btn.disabled = true;
    return;
  }
  if (_ftCtxExpired(ctx, btn, "AoE save prompt")) return;
  const caster = await fromUuid(ctx.casterUuid).catch(() => null);
  const target = await fromUuid(ctx.targetUuid).catch(() => null);
  const item   = await fromUuid(ctx.itemUuid).catch(() => null);
  if (!caster || !target || !item) {
    ui.notifications?.warn("AoE save prompt: caster / target / item not found.");
    btn.disabled = true;
    return;
  }
  if (!target.testUserPermission?.(game.user, "OWNER") && !game.user.isGM) {
    ui.notifications?.warn(`Only ${target.name}'s owner (or the GM) can roll this save.`);
    return;
  }
  btn.disabled = true;
  try {
    const sav = await game.fourththing.rolls.resolveManifestationSave(caster, target, item, ctx.resolution, {
      castDc: ctx.castDc,
      rollOverride: ctx.rollOverride || null
    });
    let mult = 1;
    if (sav?.saved) mult = (sav.onSave === "negate") ? 0 : 0.5;

    const dr = ctx.damageRoll;
    const baseDmg = Number(ctx.aoeBaseDmg) || 0;
    if (dr?.op !== "none" && baseDmg > 0 && mult > 0) {
      const desc = await game.fourththing.rolls._applyDamageToActor(target, baseDmg, {
        op: dr.op, track: ctx.aoeTrackKey, damageType: dr.type, damageFlavor: dr.flavor,
        perTargetMultiplier: mult
      });
      if (desc) await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">⚔ ${ftEscapeHtml(item.name)} — ${ftEscapeHtml(target.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem">${ftEscapeHtml(desc)}</p></div>`
      });
    }
    if (mult > 0 && Array.isArray(ctx.appliedStates?.states) && ctx.appliedStates.states.length) {
      try {
        await game.fourththing.applyManifestationStates(caster, target, item, { appliedStates: ctx.appliedStates }, { castDc: ctx.castDc });
      } catch (e) {
        console.warn("AoE save prompt: applyManifestationStates failed", e);
      }
    }
    btn.style.opacity = "0.5";
    btn.textContent = sav?.saved ? `✓ Saved (${sav.onSave === "negate" ? "no" : "half"} damage)` : "✗ Failed";
  } catch (e) {
    console.error("AoE save prompt resolve failed", e);
    btn.disabled = false;
    ui.notifications?.error("AoE save resolution failed — see console.");
  }
}

// AoE Apply-All click handler. Reads the snapshot from the chat-message
// flag, walks pending entries, applies damage per target with the stored
// multiplier. GM-only (or actor-owner). Disables the button after one click.
async function _ftHandleAoeApplyAllClick(btn, message) {
  if (btn.disabled) return;
  const ctx = message?.getFlag?.("fourththing", "aoeApplyAllContext");
  if (!ctx) {
    ui.notifications?.warn("AoE apply-all context missing.");
    btn.disabled = true;
    return;
  }
  if (_ftCtxExpired(ctx, btn, "AoE apply-all")) return;
  const caster = await fromUuid(ctx.casterUuid).catch(() => null);
  if (!caster) { ui.notifications?.warn("Caster not found."); btn.disabled = true; return; }
  if (!caster.testUserPermission?.(game.user, "OWNER") && !game.user.isGM) {
    ui.notifications?.warn(`Only ${caster.name}'s owner (or the GM) can apply this AoE damage.`);
    return;
  }
  btn.disabled = true;
  const dr = ctx.dr ?? {};
  const baseDmg = Number(ctx.baseDmg) || 0;
  const trackKey = String(ctx.trackKey || "integrity");
  const lines = [];
  for (const entry of (ctx.pending ?? [])) {
    const tgt = await fromUuid(entry.uuid).catch(() => null);
    if (!tgt) { lines.push(`${entry.name}: target not found (skipped)`); continue; }
    try {
      const desc = await game.fourththing.rolls._applyDamageToActor(tgt, baseDmg, {
        op: dr.op, track: trackKey, damageType: dr.type, damageFlavor: dr.flavor,
        perTargetMultiplier: Number(entry.mult) || 1
      });
      if (desc) lines.push(desc);
    } catch (e) {
      console.warn("AoE apply-all: per-target apply failed", entry.name, e);
      lines.push(`${entry.name}: error (see console)`);
    }
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster }),
    content: `<div class="fourththing-roll" style="border-color:#5fb35f">
      <div class="ft-roll-header"><span class="ft-roll-name">⚔ ${ftEscapeHtml(ctx.itemName ?? "AoE")} — Applied</span></div>
      <ul style="margin:0.3rem 0 0;padding-left:1.2rem;font-size:0.78rem">${lines.map(l => `<li>${ftEscapeHtml(l)}</li>`).join("")}</ul>
    </div>`
  });
  btn.style.opacity = "0.5";
  btn.textContent = "✓ Applied";
}

async function _ftPostSavePromptCard(actor, target, item, mf, dr, { castDc, intent, channel, rollOverride = null } = {}) {
  const r = mf.resolution ?? {};
  const saveAttr = r.saveAttribute || "body";
  const dc = r.saveDcMode === "fixed" ? (Number(r.saveDcFixed) || 15) : (Number(castDc) || 15);
  const onSave = ["negate", "half"].includes(r.onSave) ? r.onSave : "half";
  const ctx = {
    casterUuid: actor.uuid,
    targetUuid: target.uuid,
    itemUuid:   item.uuid,
    castDc,
    intent, channel,
    // Snapshot resolution + appliedStates + damageRoll so later sheet edits
    // don't retroactively change a posted card's outcome.
    resolution: foundry.utils.deepClone(r),
    appliedStates: foundry.utils.deepClone(mf.appliedStates ?? {}),
    damageRoll: foundry.utils.deepClone(dr ?? {}),
    rollOverride: rollOverride || null,
    expiresAt: Date.now() + 86400000
  };
  const opLabel = dr?.op === "heal" ? "heal" : (dr?.op === "damage" ? "damage" : "effect");
  const html = `<div class="fourththing-roll ft-save-prompt-card">
    <div class="ft-roll-header"><span class="ft-roll-name">⚖ ${ftEscapeHtml(item.name)} — Save vs ${ftCap(saveAttr)} (DC ${dc})</span></div>
    <p style="margin:0.4rem 0;font-size:0.82rem">
      <b>${ftEscapeHtml(target.name)}</b>, click below to roll your save against <b>${ftEscapeHtml(actor.name)}</b>'s working.
      <span style="opacity:0.75">On ${onSave === "negate" ? "success: no " + opLabel : "success: half " + opLabel}.</span>
    </p>
    <button class="ft-save-prompt-btn" data-message-id="">Roll save (2d10x10 + ${ftCap(saveAttr)})</button>
  </div>`;
  const msg = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    flags: { fourththing: { savePromptContext: ctx } }
  });
  return msg;
}

async function _ftHandleSavePromptClick(btn, message) {
  if (btn.disabled) return;
  const ctx = message?.getFlag?.("fourththing", "savePromptContext");
  if (!ctx) {
    ui.notifications?.warn("Save prompt context missing — card may be from an older cast.");
    return;
  }
  if (_ftCtxExpired(ctx, btn, "Save prompt")) return;
  const caster = await fromUuid(ctx.casterUuid).catch(() => null);
  const target = await fromUuid(ctx.targetUuid).catch(() => null);
  const item   = await fromUuid(ctx.itemUuid).catch(() => null);
  if (!caster || !target || !item) {
    ui.notifications?.warn("Save prompt: caster / target / item not found (may have been deleted).");
    btn.disabled = true;
    return;
  }
  // Permission: target's owner OR GM. Players see the card but only the
  // owner of the target should be able to roll their own save.
  if (!target.testUserPermission?.(game.user, "OWNER") && !game.user.isGM) {
    ui.notifications?.warn(`Only ${target.name}'s owner (or the GM) can roll this save.`);
    return;
  }
  btn.disabled = true;
  try {
    const sav = await game.fourththing.rolls.resolveManifestationSave(caster, target, item, ctx.resolution, {
      castDc: ctx.castDc,
      rollOverride: ctx.rollOverride || null
    });
    let mult = 1;
    if (sav?.saved) mult = (sav.onSave === "negate") ? 0 : 0.5;

    // Apply damage with the resolved multiplier. Reuse ftRollManifestationDamage
    // for the chat card + Apply button (same as singular non-prompt path).
    const dr = ctx.damageRoll;
    if (dr?.op !== "none" && Number(dr?.number) > 0 && mult > 0) {
      await ftRollManifestationDamage(caster, item, dr, { multiplier: mult });
    }
    // Apply states with the same gate.
    if (mult > 0 && Array.isArray(ctx.appliedStates?.states) && ctx.appliedStates.states.length) {
      // applyManifestationStates reads mf.appliedStates — pass a synthetic mf
      // shape with the snapshotted appliedStates so it doesn't re-read the
      // (potentially edited) item.
      try {
        await game.fourththing.applyManifestationStates(caster, target, item, { appliedStates: ctx.appliedStates }, { castDc: ctx.castDc });
      } catch (e) {
        console.warn("Roll for Initiation | savePrompt applyManifestationStates failed", e);
      }
    }
    btn.textContent   = sav?.saved ? `Saved (${sav.onSave === "negate" ? "negated" : "halved"})` : `Failed save`;
    btn.style.opacity = "0.5";
  } catch (err) {
    console.warn("Roll for Initiation | savePrompt click failed", err);
    btn.disabled = false;
    ui.notifications?.error("Save prompt failed (see console).");
  }
}

// Phase C — roll a manifestation's structured damage/heal and post a chat
// card with an Apply button. Bakes the rolled total into data-formula so
// the apply path applies the same number rather than re-rolling. Heal flows
// through the same apply button via data-op="heal" (extended in applyDamage).
async function ftRollManifestationDamage(actor, item, dr, { multiplier = 1 } = {}) {
  if (!actor || !item || !dr || dr.op === "none") return null;
  if (!Number.isFinite(dr.number) || dr.number <= 0) return null;
  const sys = actor.system?.system ?? actor.system;
  const attrVal = dr.attribute ? Number(sys?.attributes?.[dr.attribute]?.value) || 0 : 0;
  const baseFormula  = `${dr.number}${dr.die}`;
  const finalFormula = attrVal !== 0
    ? `${baseFormula} ${attrVal >= 0 ? "+" : "−"} ${Math.abs(attrVal)}`
    : baseFormula;
  const roll = new Roll(attrVal !== 0 ? `${baseFormula} + ${attrVal}` : baseFormula);
  await roll.evaluate();
  const rawTotal   = roll.total;
  // Multiplier — used by save-shape resolution to halve damage on a successful
  // save. Flooring keeps the apply value an integer; multiplier === 1 is the
  // default no-op so legacy callers behave identically.
  const safeMult   = (Number.isFinite(multiplier) && multiplier >= 0) ? multiplier : 1;
  const finalTotal = Math.max(0, Math.floor(rawTotal * safeMult));
  const multTag    = safeMult !== 1 ? ` <span style="color:#a0d4ff;font-size:0.78rem">(×${safeMult} on save)</span>` : "";
  const isHeal     = dr.op === "heal";
  const opLabel    = isHeal ? "Healing" : "Damage";
  const opIcon     = isHeal ? "❤" : "⚔";
  const trackKey   = isHeal ? (dr.track || "integrity") : (FT.DAMAGE_TYPES?.[dr.type]?.track ?? dr.track ?? "integrity");
  const facultyTag = attrVal !== 0 ? ` <span style="opacity:0.7;font-size:0.78rem">(${baseFormula} ${attrVal >= 0 ? "+" : "−"} ${Math.abs(attrVal)} ${ftCap(dr.attribute)})</span>` : "";
  const html = `<div class="fourththing-roll">
    <div class="ft-roll-header"><span class="ft-roll-name">${opIcon} ${ftEscapeHtml(item.name)} — ${opLabel}${multTag}</span></div>
    <div class="ft-result-row ft-success">
      <span class="ft-total">${finalTotal}</span>
      <span class="ft-outcome">${opLabel}${dr.flavor ? ` · ${ftEscapeHtml(dr.flavor)}` : ""}</span>
    </div>
    <div class="ft-dmg-row">
      <span class="ft-dmg-label">${opLabel}</span>
      <span class="ft-dmg-formula">${finalFormula} = <b>${rawTotal}</b>${safeMult !== 1 ? ` → <b>${finalTotal}</b>` : ""}${facultyTag}</span>
      <span class="ft-dmg-type ${dr.type}">${ftCap(dr.type)}</span>
      <button class="ft-apply-dmg-btn"
              data-formula="${finalTotal}"
              data-damage-type="${dr.type}"
              data-damage-flavor="${dr.flavor ?? ""}"
              data-track="${trackKey}"
              data-op="${dr.op}">
        ${isHeal ? "Heal target" : "Apply to target"}
      </button>
    </div>
  </div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    rolls: [roll]
  });
  return roll;
}

function ftNormalizeDamageRoll(system = {}) {
  const dr = foundry.utils.mergeObject(
    ftDamageRollDefaults(),
    foundry.utils.deepClone(system?.damageRoll ?? {}),
    { inplace: false }
  );
  // Coerce types so handlebars renders cleanly.
  dr.op        = ["damage", "heal", "none"].includes(dr.op) ? dr.op : "none";
  dr.number    = Math.max(0, Math.min(20, Number(dr.number) || 0));
  dr.die       = ["d4", "d6", "d8", "d10", "d12", "d10x10"].includes(dr.die) ? dr.die : "d6";
  dr.attribute = String(dr.attribute ?? "");
  dr.type      = String(dr.type ?? "kinetic");
  dr.flavor    = String(dr.flavor ?? "");
  dr.track     = String(dr.track ?? "integrity");
  return dr;
}

function ftNormalizeManifestationData(system = {}, kind = "power") {
  const mf = foundry.utils.mergeObject(
    ftManifestationDefaults(kind),
    foundry.utils.deepClone(system?.manifestation ?? {}),
    { inplace: false }
  );

  if (!mf.targetText && system?.target) {
    mf.targetText = ftCap(system.target);
  }

  if (!mf.rangeAreaText) {
    if (kind === "weapon" && system?.range) {
      const short = Number(system.range.short ?? 0) || 0;
      const long = Number(system.range.long ?? short) || short || 0;
      if (short || long) mf.rangeAreaText = long > short ? `${short} / ${long}` : `${short}`;
    } else if (typeof system?.range === "string" && system.range) {
      mf.rangeAreaText = ftCap(system.range);
    }
  }

  if (!mf.concept && typeof system?.effect === "string" && system.effect.length <= 160) {
    mf.concept = system.effect;
  }

  // Tier normalization. Explicit tier wins; otherwise infer from legacy scale
  // so pre-existing items load at a plausible tier without migration.
  const explicitTier = Number(mf.tier);
  if (Number.isFinite(explicitTier) && explicitTier >= 1 && explicitTier <= 4) {
    mf.tier = Math.floor(explicitTier);
  } else {
    mf.tier = FT_MANIFESTATION_SCALE_TO_TIER[mf.scale] ?? 1;
  }

  if (!mf.opCost || typeof mf.opCost !== "object") mf.opCost = { pool: "", value: 0 };
  mf.opCost.pool = typeof mf.opCost.pool === "string" ? mf.opCost.pool : "";
  mf.opCost.value = Number(mf.opCost.value) || 0;

  // Phase A — structured mechanical hook coercion.
  if (!mf.area || typeof mf.area !== "object") mf.area = { shape: "none", size: 0 };
  mf.area.shape = ["none", "cone", "sphere", "line", "cube", "cylinder"].includes(mf.area.shape) ? mf.area.shape : "none";
  mf.area.size  = Math.max(0, Math.min(120, Number(mf.area.size) || 0));

  if (!mf.activation || typeof mf.activation !== "object") mf.activation = { type: "action", consumePool: true };
  mf.activation.type        = ["action", "bonus", "reaction", "none"].includes(mf.activation.type) ? mf.activation.type : "action";
  mf.activation.consumePool = mf.activation.consumePool !== false; // default true

  if (!mf.save || typeof mf.save !== "object") mf.save = { enabled: false, defense: "evasion", attribute: "", dcMode: "derived", dcFixed: 15 };
  mf.save.enabled   = mf.save.enabled === true;
  mf.save.defense   = ["guard", "evasion", "resolve"].includes(mf.save.defense) ? mf.save.defense : "evasion";
  mf.save.attribute = String(mf.save.attribute ?? "");
  mf.save.dcMode    = ["fixed", "derived"].includes(mf.save.dcMode) ? mf.save.dcMode : "derived";
  mf.save.dcFixed   = Math.max(5, Math.min(40, Number(mf.save.dcFixed) || 15));

  // Post-cast effect resolution (2026-05-05). Coerces every shape's fields to
  // safe defaults so the sheet UI can read any field without conditional
  // initialization. Only the field set matching the chosen shape is engaged
  // by the engine; the rest sit dormant.
  if (!mf.resolution || typeof mf.resolution !== "object") mf.resolution = {};
  const VALID_FACULTIES = ["violence", "intrigue", "presence", "body", "mind", "soul"];
  mf.resolution.shape         = ["auto", "attack", "save", "contested"].includes(mf.resolution.shape) ? mf.resolution.shape : "auto";
  mf.resolution.attackVs      = ["guard", "evasion", "resolve"].includes(mf.resolution.attackVs) ? mf.resolution.attackVs : "evasion";
  mf.resolution.attackBonus   = String(mf.resolution.attackBonus ?? "intent+channel");
  mf.resolution.saveAttribute = VALID_FACULTIES.includes(mf.resolution.saveAttribute) ? mf.resolution.saveAttribute : "body";
  mf.resolution.saveDcMode    = ["cast-dc", "fixed"].includes(mf.resolution.saveDcMode) ? mf.resolution.saveDcMode : "cast-dc";
  mf.resolution.saveDcFixed   = Math.max(5, Math.min(40, Number(mf.resolution.saveDcFixed) || 15));
  mf.resolution.onSave        = ["negate", "half"].includes(mf.resolution.onSave) ? mf.resolution.onSave : "half";
  mf.resolution.saveByPrompt  = mf.resolution.saveByPrompt === true;
  mf.resolution.contestCasterAttribute = (mf.resolution.contestCasterAttribute === "intent+channel" || VALID_FACULTIES.includes(mf.resolution.contestCasterAttribute))
    ? mf.resolution.contestCasterAttribute
    : "intent+channel";
  mf.resolution.contestTargetAttribute = VALID_FACULTIES.includes(mf.resolution.contestTargetAttribute) ? mf.resolution.contestTargetAttribute : "body";
  mf.resolution.onContestLoss          = ["negate", "half"].includes(mf.resolution.onContestLoss) ? mf.resolution.onContestLoss : "negate";

  // Applied states (2026-05-06). Accept array OR object map (wizard form
  // hands an object map; storage is array). Filter to known condition keys.
  if (!mf.appliedStates || typeof mf.appliedStates !== "object") mf.appliedStates = {};
  let stateList = mf.appliedStates.states;
  if (Array.isArray(stateList)) {
    // already array — filter
  } else if (stateList && typeof stateList === "object") {
    stateList = Object.entries(stateList).filter(([, v]) => v === true || v === "true").map(([k]) => k);
  } else {
    stateList = [];
  }
  const validConds = new Set(Object.keys(FT.CONDITIONS ?? {}));
  mf.appliedStates.states        = stateList.filter(k => validConds.has(k));
  mf.appliedStates.duration      = ["1-round", "2-rounds", "3-rounds", "scene", "until-saved"].includes(mf.appliedStates.duration) ? mf.appliedStates.duration : "1-round";
  mf.appliedStates.saveEachRound = mf.appliedStates.saveEachRound === true;
  mf.appliedStates.saveAttribute = VALID_FACULTIES.includes(mf.appliedStates.saveAttribute) ? mf.appliedStates.saveAttribute : "body";
  mf.appliedStates.saveDcMode    = ["cast-dc", "fixed"].includes(mf.appliedStates.saveDcMode) ? mf.appliedStates.saveDcMode : "cast-dc";
  mf.appliedStates.saveDcFixed   = Math.max(5, Math.min(40, Number(mf.appliedStates.saveDcFixed) || 15));
  // Per-condition save-attribute overrides — drop unknown keys + invalid
  // faculties. Form data may arrive with empty-string values for unused
  // rows; those filter out here.
  const rawOverrides = (mf.appliedStates.saveAttributeOverrides && typeof mf.appliedStates.saveAttributeOverrides === "object")
    ? mf.appliedStates.saveAttributeOverrides : {};
  const cleanOverrides = {};
  for (const [k, v] of Object.entries(rawOverrides)) {
    if (validConds.has(k) && VALID_FACULTIES.includes(v)) cleanOverrides[k] = v;
  }
  mf.appliedStates.saveAttributeOverrides = cleanOverrides;

  return mf;
}

function ftManifestationStarterConfig(starter = "", kind = "power") {
  const fallback = kind === "weapon" ? "form" : "working";
  const key = starter && FT_MANIFESTATION_STARTERS[starter] ? starter : fallback;
  return FT_MANIFESTATION_STARTERS[key];
}

function ftManifestationModeLabel(system = {}, kind = "power") {
  const mf = ftNormalizeManifestationData(system, kind);
  const formLean = ["bound", "enduring"].includes(mf.stability)
    || ["weapon", "tool", "worn", "companion", "zone", "structure"].includes(mf.interactionModel);
  return formLean ? "Form" : "Working";
}

function ftManifestationFrameChips(kind, system = {}) {
  const mf = ftNormalizeManifestationData(system, kind);
  const chips = [];

  if (mf.form) chips.push(ftLabelFromMap(FT.MANIFESTATION_FORMS, mf.form, ftCap(mf.form)));
  if (mf.function) chips.push(ftLabelFromMap(FT.MANIFESTATION_FUNCTIONS, mf.function, ftCap(mf.function)));
  if (mf.stability) chips.push(ftLabelFromMap(FT.MANIFESTATION_STABILITIES, mf.stability, ftCap(mf.stability)));
  if (mf.interactionModel) chips.push(ftLabelFromMap(FT.MANIFESTATION_INTERACTIONS, mf.interactionModel, ftCap(mf.interactionModel)));
  if (mf.durationText) chips.push(mf.durationText);
  else if (mf.duration) chips.push(ftLabelFromMap(FT.MANIFESTATION_DURATIONS, mf.duration, ftCap(mf.duration)));

  const costLabel = ftManifestationCostLabel(kind, system);
  if (costLabel) chips.push(costLabel);

  if (mf.scale && mf.scale !== "personal") {
    chips.push(ftLabelFromMap(FT.MANIFESTATION_SCALES, mf.scale, ftCap(mf.scale)));
  }

  return chips;
}

function ftManifestationCostLabel(kind, system = {}) {
  const mf = ftNormalizeManifestationData(system, kind);
  if (mf.costText) return mf.costText;

  const legacy = [];
  if (kind === "power") {
    if ((system.clarityRequired ?? 0) > 0) legacy.push(`Clarity ${system.clarityRequired}`);
    if ((system.noiseGain ?? 0) > 0) legacy.push(`Noise +${system.noiseGain}`);
  }

  const costType = mf.costType ?? (legacy.length ? "custom" : "none");
  const costValue = Number(mf.costValue ?? 0) || 0;

  if (costType === "none") return legacy.join(" · ") || "No fixed cost";
  if (costType === "clarity") return `Clarity ${costValue || system.clarityRequired || 1}`;
  if (costType === "noise")   return `Noise +${costValue || system.noiseGain || 1}`;
  if (costType === "stress")  return `Stress ${costValue || 1}`;
  if (costType === "burn")    return `Burn ${costValue || 1}`;
  if (costType === "custom")  return mf.costText || legacy.join(" · ") || "Custom";
  return `${ftCap(costType)} ${costValue || 1}`;
}

function ftBuildManifestationRow(item, kind = "power") {
  const doc = item?.toObject ? item.toObject() : item;
  const system = doc?.system ?? {};
  const mf = ftNormalizeManifestationData(system, kind);
  const chips = ftManifestationFrameChips(kind, system);
  const costLabel = ftManifestationCostLabel(kind, system);
  const modeLabel = ftManifestationModeLabel(system, kind);
  const tier = Math.max(1, Math.min(4, Number(mf.tier) || 1));
  const tierInfo = FT.MANIFESTATION_TIERS?.[tier] ?? FT.MANIFESTATION_TIERS?.[1];
  const stability = mf.stability ?? "instant";
  const stabilityLabel = FT.MANIFESTATION_STABILITIES?.[stability]?.label ?? ftCap(stability);

  return {
    ...(doc ?? {}),
    id: item?.id ?? doc?._id,
    system: { ...system, manifestation: mf },
    typeLabel: modeLabel,
    actionLabel: kind === "power" ? "Invoke" : "Engage",
    summary: mf.targetText || mf.rangeAreaText || (
      kind === "power"
        ? `${ftCap(system.intent ?? "presence")} · ${ftCap(system.channel ?? "soul")}`
        : `${ftCap(system.intent ?? "violence")} · ${ftCap(system.skill ?? "melee")}`
    ),
    chips,
    costLabel,
    tier,
    tierLabel: `T${tier}`,
    tierBaseClarity: tierInfo?.clarityCost ?? 1,
    tierFootprint: tierInfo?.footprint ?? "",
    stability,
    stabilityLabel,
    isForm: modeLabel === "Form",
    isWorking: modeLabel === "Working",
    // Strike is reserved for Forms whose interactionModel is `weapon`. Other
    // Form shapes (companion, zone, structure, tool, worn, event) render a
    // "Manifest" button that routes through the cast (ftCast) handler instead.
    isWeaponForm: modeLabel === "Form" && mf.interactionModel === "weapon",
    interactionModel: mf.interactionModel ?? (kind === "weapon" ? "weapon" : "event"),
    desc: mf.concept || system.effect || system.flavor || system.description?.value || "",
    signature: mf.signature || "",
    thirdThing: mf.thirdThing || ""
  };
}
function ftCollectManifestationLenses(actor) {
  const items = Array.from(actor?.items ?? []);
  const classNames = items.filter(i => i.type === "class").map(i => String(i.name ?? ""));
  const doctrineNames = items.filter(i => i.type === "subclass").map(i => String(i.name ?? ""));

  const pathLenses = FT_MANIFESTATION_PATH_LENSES.filter(lens =>
    classNames.some(name => lens.rx.test(name))
  );
  const doctrineLenses = FT_MANIFESTATION_DOCTRINE_LENSES.filter(lens =>
    doctrineNames.some(name => lens.rx.test(name))
  );

  return { classNames, doctrineNames, pathLenses, doctrineLenses };
}

function ftBuildManifestationCoach(actor, { kind = "power", system = {} } = {}) {
  const rawActorSys = actor ? (actor.system?.system ?? actor.system ?? {}) : {};
  const mf = ftNormalizeManifestationData(system, kind);
  const sephirah = system.sephirah ?? rawActorSys?.magic?.sephirah ?? "tiferet";
  const guide = ftManifestationGuide(sephirah);
  const { pathLenses, doctrineLenses } = ftCollectManifestationLenses(actor);

  const form = mf.form ?? (kind === "weapon" ? "weapon" : "sigil");
  const fn = mf.function ?? (kind === "weapon" ? "harm" : "transform");
  const scale = mf.scale ?? "personal";
  const stability = mf.stability ?? (kind === "weapon" ? "bound" : "instant");
  const interaction = mf.interactionModel ?? (kind === "weapon" ? "weapon" : "event");
  const durationChip = mf.durationText || ftLabelFromMap(FT.MANIFESTATION_DURATIONS, mf.duration, ftCap(mf.duration));
  const frame = `${ftLabelFromMap(FT.MANIFESTATION_FORMS, form, ftCap(form))} → ${ftLabelFromMap(FT.MANIFESTATION_FUNCTIONS, fn, ftCap(fn))} · ${ftLabelFromMap(FT.MANIFESTATION_STABILITIES, stability, ftCap(stability))} · ${ftLabelFromMap(FT.MANIFESTATION_INTERACTIONS, interaction, ftCap(interaction))}${durationChip ? ` · ${durationChip}` : ""}${scale !== "personal" ? ` · ${ftLabelFromMap(FT.MANIFESTATION_SCALES, scale, ftCap(scale))}` : ""}`;

  const modeLabel = ftManifestationModeLabel(system, kind);
  const shellCue = modeLabel === "Form"
    ? "If it mainly remains in the world as a thing, zone, companion, or tool, let it lean Form."
    : "If it mainly happens, resolves, reveals, transforms, or bursts, let it lean Working.";

  return {
    guide,
    kindLabel: modeLabel,
    frame,
    usageCues: [...FT_MANIFESTATION_USAGE_CUES.generic, shellCue, ...(FT_MANIFESTATION_USAGE_CUES[kind] ?? [])].slice(0, 4),
    pathLenses: pathLenses.slice(0, 2),
    doctrineLenses: doctrineLenses.slice(0, 2),
    thirdThingPrompts: FT_MANIFESTATION_THIRD_THING_PROMPTS
  };
}

function buildManifestationCoachHTML(actor, { kind = "power", system = {} } = {}) {
  const coach = ftBuildManifestationCoach(actor, { kind, system });
  const lensChips = [
    ...coach.pathLenses.map(l => `<span class="ft-manifest-coach-chip lens">${ftEscapeHtml(l.label)}</span>`),
    ...coach.doctrineLenses.map(l => `<span class="ft-manifest-coach-chip doctrine">${ftEscapeHtml(l.label)}</span>`)
  ].join("");

  const lensPrompts = [
    ...coach.pathLenses.flatMap(l => l.prompts.slice(0, 2)),
    ...coach.doctrineLenses.flatMap(l => l.prompts.slice(0, 2))
  ].slice(0, 4);

  return `
<div class="ft-manifest-coach">
  <div class="ft-manifest-coach-section">
    <div class="ft-prev-label">Usage cues</div>
    <div class="ft-manifest-guide-body">
      ${coach.usageCues.map(cue => `<span class="ft-manifest-guide-prompt">${ftEscapeHtml(cue)}</span>`).join("")}
    </div>
  </div>
  <div class="ft-manifest-coach-section">
    <div class="ft-prev-label">Current frame</div>
    <div class="ft-manifest-guide-body">
      <span class="ft-manifest-coach-chip frame">${ftEscapeHtml(coach.kindLabel)}</span>
      <span class="ft-manifest-coach-chip">${ftEscapeHtml(coach.frame)}</span>
      ${lensChips}
    </div>
  </div>
  ${lensPrompts.length ? `
  <div class="ft-manifest-coach-section">
    <div class="ft-prev-label">Class flavor</div>
    <div class="ft-manifest-guide-body">
      ${lensPrompts.map(prompt => `<span class="ft-manifest-guide-prompt">${ftEscapeHtml(prompt)}</span>`).join("")}
    </div>
  </div>` : ""}
  <div class="ft-manifest-coach-section">
    <div class="ft-prev-label">Third Thing</div>
    <div class="ft-manifest-guide-body">
      ${coach.thirdThingPrompts.map(prompt => `<span class="ft-manifest-guide-prompt">${ftEscapeHtml(prompt)}</span>`).join("")}
    </div>
  </div>
  ${buildManifestationGlossaryHTML()}
</div>`;
}

// Inline manifestation glossary appended below the coach. Five collapsible
// rows — one per knob (Clarity / Reach / Misfire / Concurrency / Noise) — plus
// a footer link to the full Manifestation Glossary journal in the
// bbttcc-master-content.documentation pack. Authored 2026-04-27 alongside the
// caster discipline pilot to fix the "no in-app definition" gap.
function buildManifestationGlossaryHTML() {
  const rows = [
    ["Clarity",     "Your focus pool. Spent on cast (T1=1, T2=2, T3=3, T4=5) and on per-tick upkeep for sustained manifestations. Max scales with Steward tier (T1=5, T2=7, T3=10, T4=14). Recovers fully on Soma Break, half-fills on Scene Break. TCCs +5 to max; Dreamwalker stacks up to +3 more."],
    ["Reach",       "Casting one tier above your own. Surge: cast at higher tier, misfire on the higher column. Blood Debt: cast at higher tier, +1 Blood Debt, no misfire. Two tiers above is rejected. Cosmic Linguist Discipline: −1 to −2 Blood-Debt-reach cost."],
    ["Misfire",     "The d10 failure table (1-2 Reality Flicker → 10 Catastrophic Resonance). Mode-bias: Hermetic −2, Chaos +2, Ascendant skip. Negative shifts = milder bands. Wyrdlens Discipline: −2 to −4 additive shift. Reach pushes the column up by one tier."],
    ["Concurrency", "How many sustained / bound / enduring manifestations you have active at once. No hard cap — soft-capped by the Clarity needed to pay each tick's upkeep. Pactkeeper Discipline: passive +1, +3 with Sealed Pact (informational; surfaces on upkeep cards)."],
    ["Noise",       "Metaphysical residue from Chaos-mode casts (+2 per cast). 0–10 pool, separate from Clarity. Doesn't drop on its own; high Noise feeds Corruption / Intrigue detection / Lattice attention at GM thresholds. Hermetic and Ascendant generate 0 Noise. Scene Break shaves 1."],
    ["Workings vs Forms", "Workings (instant) resolve and end; Forms (sustained / bound / enduring) persist and pay upkeep. <b>Only TCCs can manifest workings.</b> Non-TCCs are restricted to forms — they shape the world by holding it open, not by intervening directly."],
    ["TCC Bonuses", "Trad Caster Classes (Cosmic Linguist, Wyrdlens Adept, Dreamwalker, Pactkeeper) get: +5 Clarity max, −1 Clarity per cast (floor 0), exclusive access to T0 Fiats and to Workings."],
    ["T0 Fiat",     "TCC-only spoken cue. Must begin with \"Let there be …\". No roll, no resource, no upkeep — the 'I light the candle with a thought' register, always available between proper workings. Click the ◌ Fiat button on the sheet."],
    ["Scene Break", "Lighter recovery cadence between Soma Breaks. Refills Clarity to at least half max (round up), shaves 1 Noise. Universal — anyone can take one between scenes via the ◐ Scene Break button."]
  ];
  const items = rows.map(([term, body]) =>
    `<div class="ft-manifest-glossary-row"><b>${term}</b><span> — ${ftEscapeHtml(body)}</span></div>`
  ).join("");
  return `
  <div class="ft-manifest-coach-section">
    <details class="ft-manifest-glossary">
      <summary class="ft-prev-label" style="cursor:pointer">Glossary — what do these knobs mean?</summary>
      <div class="ft-manifest-glossary-body" style="font-size:0.78rem;line-height:1.35;opacity:0.9;padding:0.35rem 0.1rem 0.1rem">
        ${items}
        <div style="opacity:0.6;font-size:0.72rem;margin-top:0.4rem">Full reference: <i>Manifestation Glossary</i> journal in BBTTCC Documentation compendium.</div>
      </div>
    </details>
  </div>`;
}

function ftAssessManifestationCost(actor, item, kind = "power") {
  const system = item?.system ?? {};
  const mf = system.manifestation ?? {};
  const rawSys = actor ? (actor.system?.system ?? actor.system ?? {}) : {};

  let type = mf.costType ?? "none";
  let value = Number(mf.costValue ?? 0) || 0;

  if (kind === "power") {
    const legacyClarity = Number(system.clarityRequired ?? 0) || 0;
    const legacyNoise = Number(system.noiseGain ?? 0) || 0;
    if ((!mf.costType || mf.costType === "none") && legacyClarity > 0) {
      type = "clarity";
      value = legacyClarity;
    } else if ((!mf.costType || mf.costType === "none") && legacyNoise > 0) {
      type = "noise";
      value = legacyNoise;
    }
  }

  const normalizedValue = type === "none" || type === "custom" ? value : Math.max(1, value || 1);
  const assessment = {
    type,
    value: normalizedValue,
    label: ftManifestationCostLabel(kind, system),
    autoSupported: false,
    manualOnly: false,
    canPay: true,
    current: null,
    projected: null,
    max: null,
    resourceLabel: "",
    path: "",
    preview: ""
  };

  switch (type) {
    case "clarity": {
      const current = rawSys?.magic?.clarity?.value ?? 0;
      const max = rawSys?.magic?.clarity?.max ?? 5;
      assessment.autoSupported = true;
      assessment.current = current;
      assessment.projected = Math.max(0, current - normalizedValue);
      assessment.max = max;
      assessment.canPay = current >= normalizedValue;
      assessment.resourceLabel = "Clarity";
      assessment.path = "system.magic.clarity.value";
      break;
    }
    case "noise": {
      const current = rawSys?.magic?.noise?.value ?? 0;
      const max = rawSys?.magic?.noise?.max ?? 10;
      assessment.autoSupported = true;
      assessment.current = current;
      assessment.projected = Math.min(max, current + normalizedValue);
      assessment.max = max;
      assessment.canPay = true;
      assessment.resourceLabel = "Noise";
      assessment.path = "system.magic.noise.value";
      break;
    }
    case "stress": {
      const current = rawSys?.derived?.stress?.value;
      const max = rawSys?.derived?.stress?.max;
      if (Number.isFinite(current)) {
        assessment.autoSupported = true;
        assessment.current = current;
        assessment.projected = Math.max(0, current - normalizedValue);
        assessment.max = Number.isFinite(max) ? max : current;
        assessment.canPay = current >= normalizedValue;
        assessment.resourceLabel = "Stress";
        assessment.path = "system.derived.stress.value";
      } else {
        assessment.manualOnly = true;
      }
      break;
    }
    case "burn": {
      const current = rawSys?.resources?.burn?.current;
      const max = rawSys?.resources?.burn?.max;
      if (Number.isFinite(current) && Number.isFinite(max)) {
        assessment.autoSupported = true;
        assessment.current = current;
        assessment.projected = Math.min(max, current + normalizedValue);
        assessment.max = max;
        assessment.canPay = current + normalizedValue <= max;
        assessment.resourceLabel = "Burn";
        assessment.path = "system.resources.burn.current";
      } else {
        assessment.manualOnly = true;
      }
      break;
    }
    case "custom":
      assessment.manualOnly = true;
      break;
    case "none":
    default:
      break;
  }

  if (assessment.autoSupported) {
    assessment.preview = `${assessment.resourceLabel}: ${assessment.current} → ${assessment.projected}`;
  } else if (assessment.manualOnly) {
    assessment.preview = `Manual cost: ${assessment.label}`;
  } else {
    assessment.preview = assessment.label || "No fixed cost";
  }

  return assessment;
}

async function ftApplyManifestationCost(actor, assessment) {
  if (!assessment || assessment.type === "none") {
    return { applied: false, summary: "No fixed cost" };
  }
  if (!assessment.autoSupported) {
    return { applied: false, summary: assessment.preview || assessment.label || "Manual cost" };
  }

  const rawSys = actor.system?.system ?? actor.system ?? {};
  let current = assessment.current;
  let projected = assessment.projected;
  let canPay = assessment.canPay;

  switch (assessment.type) {
    case "clarity": {
      current = rawSys?.magic?.clarity?.value ?? 0;
      projected = Math.max(0, current - assessment.value);
      canPay = current >= assessment.value;
      break;
    }
    case "noise": {
      const max = rawSys?.magic?.noise?.max ?? 10;
      current = rawSys?.magic?.noise?.value ?? 0;
      projected = Math.min(max, current + assessment.value);
      canPay = true;
      break;
    }
    case "stress": {
      current = rawSys?.derived?.stress?.value ?? 0;
      projected = Math.max(0, current - assessment.value);
      canPay = current >= assessment.value;
      break;
    }
    case "burn": {
      const max = rawSys?.resources?.burn?.max ?? 0;
      current = rawSys?.resources?.burn?.current ?? 0;
      projected = Math.min(max, current + assessment.value);
      canPay = current + assessment.value <= max;
      break;
    }
    default:
      break;
  }

  if (!canPay) {
    return { applied: false, blocked: true, summary: assessment.preview || assessment.label || "Cannot pay cost" };
  }

  await actor.update({ [assessment.path]: projected });
  return {
    applied: true,
    summary: `${assessment.resourceLabel} ${current} → ${projected}`
  };
}

// Caster-pool + caster-tier helpers (2026-05-11) — Boss Sheet Slice 2.
// Bosses don't have system.magic.clarity (Steward Clarity pool) or
// system.details.tier — their adversarial analogues are
// system.manifestations.surge and system.integrity.tier. These helpers
// normalize the read/write paths so castManifestation + ftChargeUpkeep can
// stay actor-type agnostic.
function _ftCasterPool(actor) {
  const sys = actor?.system?.system ?? actor?.system ?? {};
  if (actor?.type === "boss") {
    const s = sys.manifestations?.surge ?? {};
    return {
      writePath: "system.manifestations.surge.current",
      maxPath:   "system.manifestations.surge.max",
      current:   Number(s.current) || 0,
      max:       Number(s.max) || 0,
      label:     "Surge"
    };
  }
  const c = sys.magic?.clarity ?? {};
  return {
    writePath: "system.magic.clarity.value",
    maxPath:   "system.magic.clarity.max",
    current:   Number(c.value) || 0,
    max:       Number(c.max) || 0,
    label:     "Clarity"
  };
}
function _ftCasterTier(actor) {
  const sys = actor?.system?.system ?? actor?.system ?? {};
  if (actor?.type === "boss") return Math.max(1, Math.min(4, Number(sys.integrity?.tier) || 1));
  return Math.max(1, Math.min(4, Number(sys?.details?.tier) || 1));
}

// Rig defense reader (B11.A — 2026-05-12). Canonical type-aware accessor for
// Guard/Evasion/Resolve. All actor types now populate `derived.<key>.value`
// in prepareDerivedData, so this is mostly a fallback-safe wrapper — but it
// pins the contract so B11.B/C and downstream raid code don't need to know
// where each actor type stores its trio.
function _ftRigDefenseValue(actor, key) {
  const sys = actor?.system?.system ?? actor?.system ?? {};
  const v = Number(sys?.derived?.[key]?.value);
  return Number.isFinite(v) ? v : 10;
}

// Rig destruction cascade (B11.B — 2026-05-12). When a rig's integrity drops
// to zero, every steward/NPC boarded on it takes `tier × 2` untyped
// integrity damage and is ejected (boardedRig flag cleared). Routes through
// the same `_applyDamageToActor` so the dying cycle, triggers, and chat
// notifications all fire for crew the same way they would for any hit.
// Damage is untyped (no damageType) so crew resist/immune/vuln tables are
// bypassed — the cascade represents structural failure, not a damage
// element. Fires `bbttcc:rig:destroyed` after the cascade resolves.
async function _ftCascadeRigDestruction(rigActor) {
  if (!rigActor || rigActor.type !== "rig") return [];
  const sys = rigActor.system?.system ?? rigActor.system ?? {};
  const tier = Math.max(1, Math.min(4, Number(sys?.integrity?.tier) || 1));
  const cascadeDmg = tier * 2;

  const crew = (game.actors?.contents ?? []).filter(a => {
    const f = a?.flags?.fourththing?.boardedRig;
    return f?.rigId === rigActor.id;
  });

  const summaries = [];
  for (const member of crew) {
    try {
      const desc = await game.fourththing.rolls._applyDamageToActor(member, cascadeDmg, {
        op: "damage", track: "integrity", damageType: "", damageFlavor: ""
      });
      if (desc) summaries.push(desc);
    } catch (err) {
      console.warn(`fourththing | rig destruction cascade: ${member.name}`, err);
    }
    try { await member.unsetFlag?.("fourththing", "boardedRig"); } catch (_) { /* noop */ }
  }

  const body = summaries.length
    ? `<ul style="margin:0.25rem 0;padding-left:1.2rem;font-size:0.82rem">${
        summaries.map(s => `<li>${s}</li>`).join("")
      }</ul>`
    : `<p style="margin:0.25rem 0;font-size:0.82rem;opacity:0.7;font-style:italic">No crew aboard.</p>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: rigActor }),
    content: `<div class="fourththing-roll">
      <div class="ft-roll-header"><span class="ft-roll-name" style="color:#eb5757">⚙ ${rigActor.name} destroyed — crew ejected${summaries.length ? ` (T${tier} → ${cascadeDmg} dmg)` : ""}</span></div>
      ${body}
    </div>`
  });

  return summaries;
}

// ── castManifestation: full tier-aware cast flow ───────────────────────────
// Resolves a manifestation cast end-to-end, honoring the tier ruleset:
//   * mode (hermetic/chaos/ascendant) shifts Clarity cost, Noise gain, misfire
//     d10 bias; ascendant pays +1 Blood Debt in place of Clarity
//   * reachPath (surge/bloodDebt) handles casting one tier above the steward
//   * tier-scaled misfire is rolled automatically on failure (skipped if the
//     reach was paid via Blood Debt)
//   * sustained/bound/enduring manifestations are pushed to the active tracker
//     at flags.fourththing.activeManifestations so upkeep can be billed later
async function castManifestation(actor, item, {
  intent, channel, sephirah, label = "Manifestation", difficulty = null,
  mode = "hermetic", reachPath = "",
  target = null, restraintReduction = 0,
  resonanceSpend = null,
  useOverlay = false,
  bankToCache = false,
  freeClarity = false,
  useAoeSavePrompts = false,
  aoeApplyConfirm = false
} = {}) {
  const rawSys = actor?.system?.system ?? actor?.system ?? {};
  const stewardTier = _ftCasterTier(actor);
  const mf = item ? ftNormalizeManifestationData(item.system ?? {}, item.type === "weapon" ? "weapon" : "power") : null;
  const manTier = mf ? Math.max(1, Math.min(4, Number(mf.tier) || 1)) : stewardTier;
  // Tier-scaled DC (2026-05-06). Programmatic callers that omit `difficulty`
  // get the per-tier baseline; UI callers pass the dialog input which
  // pre-fills with the tier baseline but is overrideable.
  if (difficulty == null) difficulty = ftTierCastDC(manTier);

  // ── Cosmic Linguist — Resonance Channel resolve ────────────────────────────
  // Resolves the dialog's allocation against the live pool, debits dice,
  // bumps Strain on aggressive use, and threads the channel modifiers into
  // downstream resolution/damage/state-apply passes. Non-CL casts (or no
  // spend) skip silently.
  const rsRaw = resonanceSpend ?? {};
  const rsTotal = (Number(rsRaw.resolveDc) || 0) + (Number(rsRaw.damageDie) || 0)
               + (Number(rsRaw.extendDur) || 0) + (Number(rsRaw.defenseImpose) || 0)
               + (Number(rsRaw.stabilize) || 0);
  const resAvail = Number(rawSys?.resources?.resonanceDice?.current) || 0;
  if (rsTotal > resAvail) {
    ui.notifications?.warn(`${actor.name}: not enough Resonance Dice (allocated ${rsTotal}, have ${resAvail}). Cast aborted.`);
    return false;
  }
  const rs = {
    resolveDc:     Number(rsRaw.resolveDc) || 0,
    damageDie:     Number(rsRaw.damageDie) || 0,
    extendDur:     Number(rsRaw.extendDur) || 0,
    defenseImpose: Number(rsRaw.defenseImpose) || 0,
    stabilize:     Number(rsRaw.stabilize) || 0,
    aggressive:    rsRaw.aggressive === true,
    total:         rsTotal
  };
  // Bump appliedStates duration N steps (capped at "until-saved").
  const _DURATION_LADDER = ["1-round", "2-rounds", "3-rounds", "scene", "until-saved"];
  if (rs.extendDur > 0 && mf?.appliedStates?.duration) {
    const idx = _DURATION_LADDER.indexOf(mf.appliedStates.duration);
    if (idx >= 0) {
      const newIdx = Math.min(_DURATION_LADDER.length - 1, idx + rs.extendDur);
      mf.appliedStates.duration = _DURATION_LADDER[newIdx];
    }
  }

  // ── Dreamwalker — Bank to Dream-Cache (Phase C 2026-05-07) ────────────────
  // Short-circuits the cast: snapshot manifestation context onto
  // system.resources.dreamCache, skip Clarity payment + roll. Deploy from the
  // sheet next scene via the Cache chip's Deploy button (no Clarity, but does
  // pay upkeep on sustained shapes).
  if (item && bankToCache) {
    if (rawSys?.resources?.dreamCache?.banked) {
      ui.notifications?.warn(`${actor.name}: Dream-Cache already holds "${rawSys.resources.dreamCache.name || "(unnamed)"}". Deploy or empty it first.`);
      return false;
    }
    await actor.update({
      "system.resources.dreamCache.banked": true,
      "system.resources.dreamCache.name":   item.name,
      "system.resources.dreamCache.tier":   manTier,
      "system.resources.dreamCache.itemId": item.id
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll" style="border-color:#6a3a8a">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#c8a0ff">◯ Dream-Cache — ${ftEscapeHtml(item.name)} banked (T${manTier})</span></div>
        <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.85">Manifestation banked between scenes. Deploy from the sheet next scene without paying Clarity (upkeep still due on sustained shapes). Empties on Soma Break.</p>
      </div>`
    });
    return true;
  }

  // ── Wyrdlens — Probability Overlay validation (Phase C 2026-05-07) ────────
  // Confirms the actor has the 1/round token before consuming. The reroll
  // itself is performed inside magicTest via an injected synthetic grant.
  // Debit happens regardless of cast success — the reroll IS the value.
  if (useOverlay) {
    const overlayCur = Number(rawSys?.resources?.probabilityOverlay?.current) || 0;
    if (overlayCur < 1) {
      ui.notifications?.warn(`${actor.name}: Probability Overlay already used this round.`);
      useOverlay = false;
    }
  }

  const reachBy = manTier - stewardTier;
  const actorIsTCC = isTCC(actor);

  // Workings vs Forms gating — non-TCCs may only manifest persistent shapes
  // (sustained / bound / enduring "forms"). The active "working" register
  // (instant resolution) is reserved for TCCs as their primary tool.
  // Items without an explicit stability are treated as legacy and pass through.
  // Boss actors (2026-05-11) are exempt — they are adversarial casters whose
  // entire shtick is resolving Workings against the party.
  const declaredStability = mf?.stability ?? null;
  if (declaredStability === "instant" && !actorIsTCC && actor?.type !== "boss") {
    ui.notifications?.warn(`${actor.name}: only Trad Caster Classes (Cosmic Linguist, Wyrdlens Adept, Dreamwalker, Pactkeeper) can resolve a working in the active register. Non-TCCs may sustain forms.`);
    return false;
  }

  // ── Blood Debt manifestation lockout (2026-05-09 refit, wired 2026-05-10) ─
  // The `manifestation` sacrifice in bbttcc-bridge stamps
  // `flags.fourththing.manifestationLockout` with a tier counter (1 OP-grant
  // path actually costs 4 OP per tier — set in the dialog). The lockout
  // bars casts at-or-below that tier until the next Soma Break clears it.
  const lockoutTiers = Number(actor.flags?.fourththing?.manifestationLockout) || 0;
  if (lockoutTiers > 0 && manTier <= lockoutTiers) {
    ui.notifications?.warn(`${actor.name}: T${manTier} manifestations are locked out (Blood Debt — ${lockoutTiers} tier${lockoutTiers > 1 ? "s" : ""} sealed). Clears on next Soma Break.`);
    return false;
  }

  if (reachBy > 1) {
    ui.notifications?.warn(`${actor.name}: T${manTier} is out of reach. Canon allows reaching only one tier above yours.`);
    return false;
  }
  if (reachBy === 1 && !reachPath) {
    ui.notifications?.warn(`${actor.name}: choose Surge or Blood Debt to reach T${manTier}.`);
    return false;
  }
  if (reachBy <= 0) reachPath = "";

  // Phase C — activation pool gate. If the manifestation declares
  // `manifestation.activation.consumePool`, refuse the cast when the pool's
  // already used. Marked spent after the cast resolves successfully.
  const POOL_KEY_FROM_TYPE = { action: "actionUsed", bonus: "bonusUsed", reaction: "reactionUsed" };
  if (item && mf?.activation?.consumePool) {
    const poolKey = POOL_KEY_FROM_TYPE[mf.activation.type];
    if (poolKey && rawSys?.actions?.[poolKey]) {
      ui.notifications?.warn(`${actor.name}: ${mf.activation.type} already used this turn.`);
      return false;
    }
  }

  const baseClarity = FT.MANIFESTATION_TIERS?.[manTier]?.clarityCost ?? 1;

  // Mode shifts.
  const modeConfig = {
    hermetic:  { clarityShift: +1, noiseGain: 0, misfireBias: -2, ascendant: false, label: "Hermetic" },
    chaos:     { clarityShift: -1, noiseGain: 2, misfireBias: +2, ascendant: false, label: "Chaos" },
    ascendant: { clarityShift:  0, noiseGain: 0, misfireBias:  0, ascendant: true,  label: "Ascendant" }
  };
  const cfg = modeConfig[mode] ?? modeConfig.hermetic;
  if (cfg.ascendant && stewardTier < 3) {
    ui.notifications?.warn(`${actor.name}: Ascendant mode is T3+ only.`);
    return false;
  }

  // Resolve Clarity cost (mode adjusts; ascendant skips Clarity entirely;
  // TCCs get a -1 cast discount that floors at 0 for safety).
  // freeClarity:true bypasses the Clarity cost entirely (Phase C 2026-05-07
  // — Dreamwalker Dream-Cache deploy fires this; Blood Debt + Noise still due).
  // Boss casts (2026-05-11) draw from the Surge bank via _ftCasterPool.
  const tccDiscount = actorIsTCC ? 1 : 0;
  const clarityCost = (cfg.ascendant || freeClarity) ? 0 : Math.max(0, baseClarity + cfg.clarityShift - tccDiscount);
  const casterPool = _ftCasterPool(actor);
  const curClarity = casterPool.current;

  // Resolve Blood Debt cost (reach-BD + ascendant both accrue Blood Debt).
  // Discipline-aware: Reach-BD cost is reduced by getReachDiscount(actor).
  let bloodDebtCost = 0;
  const reachDiscount = Math.max(0, Number(getReachDiscount(actor)) || 0);
  if (reachPath === "bloodDebt") bloodDebtCost += Math.max(0, 1 - reachDiscount);
  if (cfg.ascendant) bloodDebtCost += 1;

  // Resolve Noise gain (mode; no base Noise cost for manifestations).
  const noiseGain = cfg.noiseGain;

  if (!cfg.ascendant && curClarity < clarityCost) {
    ui.notifications?.warn(`${actor.name}: need ${clarityCost} ${casterPool.label} (have ${curClarity}).`);
    return false;
  }

  // Misfire column: reach pushes the target one tier higher than the caster.
  const misfireTier = reachPath ? manTier : stewardTier;
  const skipMisfire = reachPath === "bloodDebt" || cfg.ascendant;

  const costPieces = [];
  if (clarityCost > 0) costPieces.push(`Clarity ${clarityCost}`);
  if (bloodDebtCost > 0) costPieces.push(`Blood Debt +${bloodDebtCost}`);
  if (noiseGain > 0) costPieces.push(`Noise +${noiseGain}`);
  if (reachPath) costPieces.push(`Reach→T${manTier} via ${reachPath === "surge" ? "Surge" : "Blood Debt"}`);
  if (cfg.ascendant) costPieces.push("Ascendant");
  if (tccDiscount > 0 && !cfg.ascendant) costPieces.push(`TCC discount −${tccDiscount}`);
  const costNote = costPieces.join(" · ") || "No mechanical cost";

  // Discipline misfire shift folds into modeMisfireBias (negative=better).
  const disciplineBandShift = Number(getMisfireBandShift(actor)) || 0;
  const totalMisfireBias = cfg.misfireBias + disciplineBandShift;

  // Surface discipline shifts in the cost note so the GM/player sees the deltas.
  const discNote = summarizeDiscipline(actor);
  const finalCostNote = discNote ? `${costNote} · Discipline: ${discNote}` : costNote;

  // Fire the roll first so the chat card shows before we commit resource writes.
  const result = await game.fourththing.rolls.magicTest(actor, {
    intent, channel, sephirah, label, difficulty,
    costNote: finalCostNote,
    signature: mf?.signature ?? "",
    thirdThing: mf?.thirdThing ?? "",
    misfireTier, skipMisfire,
    modeMisfireBias: totalMisfireBias,
    target, restraintReduction,
    useOverlay
  });

  ftPlayAutoAnimation(actor, item, { hit: result?.success !== false });

  // Wyrdlens — debit Probability Overlay after the roll (success OR fail —
  // the reroll has already been consumed, no refund on miss).
  if (useOverlay) {
    try {
      const cur = Number((actor.system?.system ?? actor.system)?.resources?.probabilityOverlay?.current) || 0;
      if (cur > 0) await actor.update({ "system.resources.probabilityOverlay.current": cur - 1 });
    } catch (e) { console.warn("Roll for Initiation | overlay debit failed", e); }
  }

  // Phase C 2026-05-07 — Misfire conversion offer for Wyrdlens (Tikkun Sight)
  // and Pactkeeper (Renegotiate). Posts a follow-up chat card with conversion
  // buttons when the actor is eligible. No-op for everyone else.
  if (item && result?.misfireData) {
    await _ftPostMisfireConversionCard(actor, item, result.misfireData, { castDc: difficulty, manTier, mode });
  }

  // Phase C — post-success automation: pool consumption, area template,
  // attack-shape resolution (2026-05-05), and structured damage/heal roll.
  // All gated on cast success. Damage additionally gated on attack hit when
  // the manifestation declares resolution.shape="attack" with a target.
  const castSuccess = result?.success !== false;
  if (item && castSuccess) {
    if (mf?.activation?.consumePool) {
      const poolKey = POOL_KEY_FROM_TYPE[mf.activation.type];
      if (poolKey) await actor.update({ [`system.actions.${poolKey}`]: true });
    }

    // Resonance Channel debit + Strain bump (CL only — no-op when total=0).
    // Runs only on cast success so a missed cast doesn't burn the dice.
    if (rs.total > 0 || rs.aggressive) {
      const updates = {};
      if (rs.total > 0) {
        updates["system.resources.resonanceDice.current"] = Math.max(0, resAvail - rs.total);
      }
      if (rs.aggressive) {
        const curStrain = Number(rawSys?.resources?.strain?.value) || 0;
        updates["system.resources.strain.value"] = Math.min(10, curStrain + 1);
      }
      try { await actor.update(updates); } catch (e) { console.warn("Roll for Initiation | resonance spend update failed", e); }

      // Chat announcement of channels spent — useful even when 0 dice but
      // aggressive=true ticks Strain. Defense-impose + stabilize land here as
      // GM-applied notes (no engine wiring yet).
      const lines = [];
      if (rs.resolveDc)     lines.push(`+${rs.resolveDc} target save DC`);
      if (rs.damageDie)     lines.push(`+${rs.damageDie} damage die${rs.damageDie === 1 ? "" : "s"}`);
      if (rs.extendDur)     lines.push(`extend duration ${rs.extendDur} step${rs.extendDur === 1 ? "" : "s"}`);
      if (rs.defenseImpose) lines.push(`target rolls <b>3d10kl2</b> instead of 2d10x10 on save (engine-applied; channel × ${rs.defenseImpose})`);
      if (rs.stabilize)     lines.push(`stabilized vs counter/dispel (+${rs.stabilize} to counter DC; engine-applied)`);
      if (rs.aggressive)    lines.push(`<span style="color:#ffc8c8">+1 Strain (aggressive)</span>`);
      if (lines.length) {
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="fourththing-roll" style="border-color:#5a3a8a">
            <div class="ft-roll-header"><span class="ft-roll-name" style="color:#c8c8ff">✦ ${ftEscapeHtml(label)} — Resonance Channels (${rs.total} die${rs.total === 1 ? "" : "s"} spent)</span></div>
            <ul style="margin:0.3rem 0 0;padding-left:1.2rem;font-size:0.78rem;line-height:1.5">${lines.map(l => `<li>${l}</li>`).join("")}</ul>
          </div>`
        });
      }
    }

    let placedTemplate = null;
    if (mf?.area?.shape && mf.area.shape !== "none") {
      placedTemplate = await ftPlaceAreaTemplate(actor, mf.area);
    }

    // Detect AoE first — picks the post-success dispatch path.
    const aoeTokens = placedTemplate
      ? _ftTokensInTemplate(placedTemplate, { excludeActorIds: new Set([actor.id]) })
      : [];
    const aoeActors = Array.from(new Set(
      aoeTokens.map(tok => tok.actor).filter(a => !!a && a.id !== actor.id)
    ));
    const useAoE = aoeActors.length > 0;
    const dr = ftNormalizeDamageRoll(item.system ?? {});
    // Resonance Channel: extra damage dice stack onto the rolled total.
    if (rs.damageDie > 0) dr.number = Math.max(0, dr.number + rs.damageDie);
    // Effective DC the TARGET faces on saves — base difficulty + resonance
    // resolveDc bonus. Caster's cast roll is unaffected (already happened).
    const targetSaveCastDc = difficulty + rs.resolveDc;
    const resolution = mf?.resolution;

    // saveByPrompt — singular save-shape with the prompt flag short-circuits
    // the synchronous save + damage/state apply. Posts a chat-card Save button
    // that the target's owner clicks to roll; the click handler resolves
    // damage + states. AoE always GM-side (multi-target prompts are noisy).
    const usePromptSave = !useAoE
      && resolution?.shape === "save"
      && resolution?.saveByPrompt === true
      && !!target;

    if (usePromptSave) {
      await _ftPostSavePromptCard(actor, target, item, mf, dr, {
        castDc: targetSaveCastDc, intent, channel,
        rollOverride: rs.defenseImpose > 0 ? "3d10kl2" : null
      });
      // Skip downstream — handled on click. Resource writes (clarity / BD /
      // active tracker) still run below since the cast itself succeeded.
    } else {

    // Effect-shape resolution. shape="attack" → caster vs target.defense
    // (miss = no damage). shape="save" → target rolls vs cast DC (success
    // halves or negates damage per onSave). shape="auto" or no target = legacy
    // auto-apply. Damage is gated on the resulting damageMultiplier:
    //   1   = full damage   (cast hit + attack hit, OR save failed)
    //   0.5 = half damage   (saved with onSave="half")
    //   0   = no damage     (attack missed, OR saved with onSave="negate")
    let damageMultiplier = 1;
    if (resolution?.shape === "attack" && target) {
      const atk = await game.fourththing.rolls.resolveManifestationAttack(actor, target, item, resolution, {
        intent, channel
      });
      if (!atk?.hit) damageMultiplier = 0;
    } else if (resolution?.shape === "save" && target && !useAoE) {
      // Skipped under AoE — per-target saves run inside the AoE walk below.
      const sav = await game.fourththing.rolls.resolveManifestationSave(actor, target, item, resolution, {
        castDc: targetSaveCastDc,
        rollOverride: rs.defenseImpose > 0 ? "3d10kl2" : null
      });
      if (sav?.saved) {
        if (sav.onSave === "negate")    damageMultiplier = 0;
        else if (sav.onSave === "half") damageMultiplier = 0.5;
      }
    } else if (resolution?.shape === "contested" && target && !useAoE) {
      const con = await game.fourththing.rolls.resolveManifestationContest(actor, target, item, resolution, {
        intent, channel
      });
      if (con && !con.casterWins) {
        if (con.onContestLoss === "negate")    damageMultiplier = 0;
        else if (con.onContestLoss === "half") damageMultiplier = 0.5;
      }
    }

    if (useAoE) {
      // AoE mode — per-target resolution drives both damage AND states.
      // Roll damage once; multiply by each target's per-resolution multiplier.
      // attack-shape AoE: uniform outcome (one attack roll → blanket result).
      let baseDmg = 0;
      let baseRollHtml = "";
      const sys = actor.system?.system ?? actor.system;
      const attrVal = dr.attribute ? Number(sys?.attributes?.[dr.attribute]?.value) || 0 : 0;
      const trackKey = dr.op === "heal" ? (dr.track || "integrity") : (FT.DAMAGE_TYPES?.[dr.type]?.track ?? dr.track ?? "integrity");
      if (dr.op !== "none" && dr.number > 0) {
        const baseFormula = `${dr.number}${dr.die}`;
        const finalFormula = attrVal !== 0 ? `${baseFormula} + ${attrVal}` : baseFormula;
        const roll = new Roll(finalFormula);
        await roll.evaluate();
        baseDmg = roll.total;
        const opIcon  = dr.op === "heal" ? "❤" : "⚔";
        const opLabel = dr.op === "heal" ? "Healing" : "Damage";
        baseRollHtml = `<div class="fourththing-roll" style="margin-bottom:0.4rem">
          <div class="ft-roll-header"><span class="ft-roll-name">${opIcon} ${ftEscapeHtml(item.name)} — ${opLabel} (AoE base)</span></div>
          <div class="ft-dmg-row"><span class="ft-dmg-formula">${finalFormula} = <b>${baseDmg}</b></span><span class="ft-dmg-type ${dr.type}">${ftCap(dr.type)}</span></div>
        </div>`;
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: baseRollHtml,
          rolls: [roll]
        });
      }

      // AoE Save-prompt path (Phase D 2026-05-08). When opted-in via cast
      // dialog, post one Save card per target instead of GM-rolling. Each
      // card's owner clicks to roll their save; their card's handler applies
      // the pre-rolled baseDmg with the resulting multiplier. Skips the rest
      // of the AoE walk for damage/states (handled lazily on click).
      if (useAoeSavePrompts && resolution?.shape === "save" && baseDmg > 0) {
        for (const aoeActor of aoeActors) {
          await _ftPostAoeSavePromptCard(actor, aoeActor, item, mf, dr, baseDmg, trackKey, {
            castDc: targetSaveCastDc, intent, channel,
            rollOverride: rs.defenseImpose > 0 ? "3d10kl2" : null
          });
        }
        // Skip the synchronous walk — each card resolves independently.
      } else {
        const dmgLines   = [];
        const stateLines = [];
        // Snapshot per-target damage info for the Apply All confirm path.
        const pendingDmg = [];

        for (const aoeActor of aoeActors) {
          let aoeMult = 1;
          if (resolution?.shape === "save") {
            const sav = await game.fourththing.rolls.resolveManifestationSave(actor, aoeActor, item, resolution, {
              castDc: targetSaveCastDc,
              rollOverride: rs.defenseImpose > 0 ? "3d10kl2" : null
            });
            if (sav?.saved) aoeMult = (sav.onSave === "negate") ? 0 : 0.5;
          } else if (resolution?.shape === "contested") {
            const con = await game.fourththing.rolls.resolveManifestationContest(actor, aoeActor, item, resolution, { intent, channel });
            if (con && !con.casterWins) aoeMult = (con.onContestLoss === "negate") ? 0 : 0.5;
          } else if (resolution?.shape === "attack") {
            aoeMult = damageMultiplier;
          }

          // Damage path — when aoeApplyConfirm is OFF, apply now (current
          // behavior). When ON, snapshot for the post-walk confirm card.
          if (baseDmg > 0 && aoeMult > 0) {
            if (aoeApplyConfirm) {
              pendingDmg.push({ uuid: aoeActor.uuid, name: aoeActor.name, mult: aoeMult });
            } else {
              const desc = await game.fourththing.rolls._applyDamageToActor(aoeActor, baseDmg, {
                op: dr.op, track: trackKey, damageType: dr.type, damageFlavor: dr.flavor,
                perTargetMultiplier: aoeMult
              });
              if (desc) dmgLines.push(desc);
            }
          } else if (dr.op !== "none" && dr.number > 0) {
            dmgLines.push(`${aoeActor.name}: resisted — no ${dr.op === "heal" ? "healing" : "damage"}`);
          }

          // States — same multiplier gate. (Always immediate; the confirm
          // step is only for damage application, not state-AE creation.)
          if (mf?.appliedStates?.states?.length) {
            if (aoeMult > 0) {
              try {
                await game.fourththing.applyManifestationStates(actor, aoeActor, item, mf, { castDc: targetSaveCastDc });
                stateLines.push(`${aoeActor.name}: states applied`);
              } catch (e) {
                console.warn("Roll for Initiation | applyManifestationStates AoE failed", aoeActor.name, e);
                stateLines.push(`${aoeActor.name}: error (see console)`);
              }
            } else {
              stateLines.push(`${aoeActor.name}: resisted — no states`);
            }
          }
        }

        // Combined per-target summary card.
        if (dmgLines.length || stateLines.length) {
          const dmgSection = dmgLines.length
            ? `<div style="margin-bottom:0.3rem"><b>Damage outcomes:</b><br>${dmgLines.map(l => `&nbsp;&nbsp;• ${ftEscapeHtml(l)}`).join("<br>")}</div>`
            : "";
          const stateSection = stateLines.length
            ? `<div><b>State application:</b><br>${stateLines.map(l => `&nbsp;&nbsp;• ${ftEscapeHtml(l)}`).join("<br>")}</div>`
            : "";
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div style="font-size:0.85rem"><b>${ftEscapeHtml(item.name)}</b> — area effects (${aoeActors.length} target${aoeActors.length === 1 ? "" : "s"}):<br>${dmgSection}${stateSection}</div>`
          });
        }

        // Apply All confirm card — posted when aoeApplyConfirm is ON and
        // there's pending damage. Click to apply all snapshotted entries.
        if (aoeApplyConfirm && pendingDmg.length > 0) {
          const ctx = {
            casterUuid: actor.uuid,
            itemUuid:   item.uuid,
            itemName:   item.name,
            baseDmg,
            trackKey,
            dr: { op: dr.op, type: dr.type, flavor: dr.flavor, number: dr.number, die: dr.die },
            pending: pendingDmg,
            expiresAt: Date.now() + 86400000
          };
          const lines = pendingDmg.map(p => {
            const finalDmg = Math.floor(baseDmg * p.mult);
            return `<li>${ftEscapeHtml(p.name)} — ${finalDmg} ${ftCap(dr.type)} ${dr.op === "heal" ? "healing" : "damage"}${p.mult < 1 ? ` (×${p.mult})` : ""}</li>`;
          }).join("");
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll ft-aoe-apply-all-card" style="border-color:#5fb35f">
              <div class="ft-roll-header"><span class="ft-roll-name">⚔ ${ftEscapeHtml(item.name)} — Apply All (${pendingDmg.length} target${pendingDmg.length === 1 ? "" : "s"})</span></div>
              <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.85">Pending damage application:</p>
              <ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.78rem">${lines}</ul>
              <button class="ft-aoe-apply-all-btn" data-message-id="" style="background:#1f3a1f;color:#a0d8a0;border:1px solid #5fb35f;padding:0.3rem 0.6rem;border-radius:4px;cursor:pointer;margin-top:0.3rem">Apply All Damage</button>
            </div>`,
            flags: { fourththing: { aoeApplyAllContext: ctx } }
          });
        }
      }
    } else {
      // Singular path — picked target only, current chat-card-Apply UX.
      if (dr.op !== "none" && dr.number > 0 && damageMultiplier > 0) {
        await ftRollManifestationDamage(actor, item, dr, { multiplier: damageMultiplier });
      }
      if (target && damageMultiplier > 0 && mf?.appliedStates?.states?.length) {
        try {
          await game.fourththing.applyManifestationStates(actor, target, item, mf, { castDc: targetSaveCastDc });
        } catch (e) {
          console.warn("Roll for Initiation | applyManifestationStates failed", e);
        }
      }
    }
    }  // close usePromptSave else
  }

  // Apply resource changes now that the roll is committed.
  // Caster-pool writePath is type-aware: stewards debit Clarity, bosses Surge.
  const updates = {};
  if (clarityCost > 0) updates[casterPool.writePath] = Math.max(0, curClarity - clarityCost);
  if (noiseGain > 0 && actor?.type !== "boss") {
    const curNoise = Number(rawSys?.magic?.noise?.value) || 0;
    const maxNoise = Number(rawSys?.magic?.noise?.max) || 10;
    updates["system.magic.noise.value"] = Math.min(maxNoise, curNoise + noiseGain);
  }
  if (Object.keys(updates).length) await actor.update(updates);

  if (bloodDebtCost > 0 && game.fourththing?.bloodDebt?.add) {
    await game.fourththing.bloodDebt.add(actor, {
      value: bloodDebtCost,
      source: cfg.ascendant ? "ascendant-cast" : "reach-cast",
      tag: `T${manTier}`,
      note: `${label} — ${cfg.label}${reachPath === "bloodDebt" ? " · Reach-BD" : ""}`
    });
  }

  // Active tracker: sustained/bound/enduring manifestations stay on the sheet
  // until dropped or culled by upkeep.
  const stability = mf?.stability ?? "instant";
  if (item && ["sustained", "bound", "enduring"].includes(stability) && result?.success !== false) {
    await ftAddActiveManifestation(actor, item, { tier: manTier, stability, mode, reachPath, target, stabilizeBonus: rs.stabilize || 0 });
  }

  return result;
}

// Active-manifestation tracker. One entry per active instance of a manifestation.
// Phase D 2026-05-08: also tags `pactBound: true` when the manifestation's
// target matches the actor's currently-bound Pactkeeper subject (per The
// Bargain canon). ftChargeUpkeep grants free passes only to pactBound entries
// — replaces the permissive first-N-free interpretation from Phase A.
async function ftAddActiveManifestation(actor, item, { tier, stability, mode, reachPath, target = null, stabilizeBonus = 0 }) {
  const existing = actor.getFlag("fourththing", "activeManifestations") ?? [];
  const pactSubject = actor.flags?.fourththing?.pactSubject ?? null;
  const pactBound = !!(pactSubject?.uuid && target?.uuid && pactSubject.uuid === target.uuid);
  const entry = {
    instanceId: foundry.utils.randomID(16),
    itemId: item.id,
    itemName: item.name,
    tier: Number(tier) || 1,
    stability,
    mode: mode || "hermetic",
    reachPath: reachPath || "",
    castAt: Date.now(),
    targetUuid: target?.uuid ?? "",
    targetName: target?.name ?? "",
    pactBound,
    // CL Resonance Channel "Stabilize" — N adds to counter/dispel DC.
    // Phase D 2026-05-08: counter engine reads this; channel allocation lands
    // here at cast time.
    stabilizeBonus: Math.max(0, Number(stabilizeBonus) || 0)
  };
  await actor.setFlag("fourththing", "activeManifestations", [...existing, entry]);
  return entry;
}

async function ftDropActiveManifestation(actor, instanceId) {
  const existing = actor.getFlag("fourththing", "activeManifestations") ?? [];
  const filtered = existing.filter(e => e.instanceId !== instanceId);
  if (filtered.length === existing.length) return false;
  await actor.setFlag("fourththing", "activeManifestations", filtered);
  return true;
}

// Bill upkeep against a subset of stability cadences. Entries the actor
// cannot afford are dropped; a chat card summarizes billed + dropped items.
// Upkeep formula: 1 Clarity × tier per active entry of the matching stability.
async function ftChargeUpkeep(actor, { stabilities = [], cadence = "tick" } = {}) {
  if (!actor || !Array.isArray(stabilities) || !stabilities.length) return { billed: [], dropped: [] };
  const active = actor.getFlag("fourththing", "activeManifestations") ?? [];
  if (!active.length) return { billed: [], dropped: [] };

  const matching = active.filter(e => stabilities.includes(e.stability));
  if (!matching.length) return { billed: [], dropped: [] };

  const rawSys = actor.system?.system ?? actor.system ?? {};
  // Boss casts (2026-05-11) bill upkeep against the Surge bank via _ftCasterPool.
  const upkPool = _ftCasterPool(actor);
  let curClarity = upkPool.current;
  const billed = [];
  const dropped = [];
  const surviving = [...active];

  // Discipline upkeep scale (e.g. Sealed Pact halves per-tick upkeep).
  const upkeepScale = Math.max(0, Number(getUpkeepScale(actor)) || 1);
  // Discipline concurrency bonus — pact-subject scoped (Phase D 2026-05-08).
  // Free passes apply ONLY to entries with `pactBound: true` (manifestations
  // cast targeting the currently-bound Pactkeeper subject). Cap = N. Replaces
  // the Phase A permissive first-N-free interpretation per class canon.
  let freePasses = Math.max(0, Number(getConcurrencyBonus(actor)) || 0);

  for (const entry of matching) {
    const baseCost = Math.max(0, Number(entry.tier) || 1);
    const scaled   = Math.max(0, Math.ceil(baseCost * upkeepScale));
    let cost  = scaled;
    let freed = false;
    if (cost > 0 && freePasses > 0 && entry.pactBound === true) {
      cost = 0;
      freed = true;
      freePasses -= 1;
    }
    if (curClarity >= cost) {
      curClarity -= cost;
      billed.push({ ...entry, cost, freed });
    } else {
      dropped.push({ ...entry, cost, reason: "insufficient-clarity" });
      const idx = surviving.findIndex(e => e.instanceId === entry.instanceId);
      if (idx >= 0) surviving.splice(idx, 1);
    }
  }

  const updates = {};
  const paid = billed.reduce((sum, b) => sum + b.cost, 0);
  if (paid > 0) updates[upkPool.writePath] = Math.max(0, upkPool.current - paid);
  if (Object.keys(updates).length) await actor.update(updates);
  if (dropped.length) await actor.setFlag("fourththing", "activeManifestations", surviving);

  if (billed.length || dropped.length) {
    const billedHtml = billed.length
      ? `<div class="ft-prev-align-note"><b>Upkeep billed (${cadence}):</b> ${billed.map(b => `${b.itemName} (T${b.tier}, ${b.freed ? "<span style='color:#a0d4ff'>free</span>" : b.cost})`).join(" · ")}</div>`
      : "";
    const droppedHtml = dropped.length
      ? `<div class="ft-prev-align-note" style="color:#ff8a8a"><b>Dropped (could not pay):</b> ${dropped.map(d => `${d.itemName} (T${d.tier})`).join(" · ")}</div>`
      : "";
    const discNote = summarizeDiscipline(actor);
    const discHtml = discNote
      ? `<div class="ft-prev-align-note" style="opacity:0.75"><b>Discipline:</b> ${discNote}</div>`
      : "";
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">⟳ Upkeep — ${actor.name}</span></div>${billedHtml}${droppedHtml}${discHtml}</div>`
    });
  }

  return { billed, dropped };
}

function buildManifestationCostBoxHTML(assessment, { inputName = "applyCost" } = {}) {
  if (!assessment || assessment.type === "none") {
    return `
<div class="ft-manifest-costbox">
  <div class="ft-prev-label">Cost</div>
  <div class="ft-prev-align-note">No fixed cost.</div>
</div>`;
  }

  const checkbox = assessment.autoSupported
    ? `<label class="ft-manifest-cost-toggle"><input type="checkbox" name="${inputName}" checked/> Auto-apply ${ftEscapeHtml(assessment.label)}</label>`
    : "";
  const statusClass = assessment.autoSupported && !assessment.canPay ? " blocked" : "";

  return `
<div class="ft-manifest-costbox${statusClass}">
  <div class="ft-prev-label">Cost</div>
  <div class="ft-manifest-chip-row">
    <span class="ft-manifest-chip">${ftEscapeHtml(assessment.label)}</span>
    ${assessment.autoSupported ? `<span class="ft-manifest-chip">${ftEscapeHtml(assessment.preview)}</span>` : ""}
    ${assessment.manualOnly ? `<span class="ft-manifest-chip">Track manually</span>` : ""}
  </div>
  <div class="ft-prev-align-note">${ftEscapeHtml(
    assessment.autoSupported
      ? (assessment.canPay ? "This can be applied automatically after the roll." : "You cannot currently pay this cost automatically.")
      : (assessment.manualOnly ? "This cost is narrative or uses a resource the engine cannot safely infer here." : "No automatic cost application for this manifestation.")
  )}</div>
  ${checkbox}
</div>`;
}

function buildManifestationWizardHTML(actor, { kind = "power", starter = "" } = {}) {
  const rawSys = actor.system?.system ?? actor.system;
  const starterCfg = ftManifestationStarterConfig(starter, kind);
  const wizardKind = starterCfg?.kind ?? kind;
  const defaults = foundry.utils.mergeObject(
    ftManifestationDefaults(wizardKind),
    foundry.utils.deepClone(starterCfg?.defaults ?? {}),
    { inplace: false }
  );
  const guide = ftManifestationGuide(rawSys?.magic?.sephirah ?? "tiferet");
  const mkOpts = (map, current) => Object.entries(map).map(([k, v]) =>
    `<option value="${k}"${k === current ? " selected" : ""}>${v.label}</option>`
  ).join("");

  const guideBlock = `
    <div class="ft-manifest-dialog-guide" style="border-color:${guide.color}55;background:${guide.color}14">
      <div class="ft-manifest-dialog-title">Create Manifestation</div>
      <div class="ft-manifest-dialog-domain">${guide.label} resonance · ${guide.domain}</div>
      <div class="ft-manifest-dialog-copy">Bring a new piece of imagination into the world. Start with what it is, what it does, and what makes it strange. The old language of Working and Form still exists, but you do not need to solve that first.</div>
      <div class="ft-manifest-guide-body">
        <span class="ft-manifest-chip">${starterCfg?.label ?? (wizardKind === "weapon" ? "Stable" : "Ephemeral")}</span>
        <span class="ft-manifest-chip">${starterCfg?.helper ?? "Choose whether the manifestation mainly happens or mainly stays."}</span>
      </div>
      <ul class="ft-manifest-dialog-list">
        ${guide.prompts.map(p => `<li>${p}</li>`).join("")}
      </ul>
    </div>`;

  const coachBlock = buildManifestationCoachHTML(actor, {
    kind: wizardKind,
    system: {
      sephirah: rawSys?.magic?.sephirah ?? "tiferet",
      manifestation: defaults
    }
  });

  if (wizardKind === "weapon") {
    return `
<div class="ft-cast-dialog ft-manifest-dialog">
  ${guideBlock}
  ${coachBlock}
  <div class="ft-manifest-dialog-section">
    <div class="ft-prev-label">What are you making?</div>
    <div class="ft-prev-align-note">Describe the manifestation in plain language first. Poetry can come after clarity.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Name</label><input type="text" name="name" placeholder="e.g. Thorn Verdict"/></div>
    <div class="ft-cast-field"><label>Expression</label><select name="manifestForm">${mkOpts(FT.MANIFESTATION_FORMS, defaults.form)}</select></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Concept</label><textarea name="concept" rows="2" placeholder="What are you bringing into the world?"></textarea></div>

    <div class="ft-cast-field"><label>Function</label><select name="manifestFunction">${mkOpts(FT.MANIFESTATION_FUNCTIONS, defaults.function)}</select></div>
    <div class="ft-cast-field"><label>Stability</label><select name="manifestStability">${mkOpts(ftStabilityOptionsForActor(actor), defaults.stability)}</select></div>
    <div class="ft-cast-field"><label>Interaction Model</label><select name="manifestInteraction">${mkOpts(FT.MANIFESTATION_INTERACTIONS, defaults.interactionModel)}</select></div>
    <div class="ft-cast-field"><label>Form Type</label>
      <select name="category">
        <option value="melee" selected>Melee</option>
        <option value="ranged">Ranged</option>
        <option value="thrown">Thrown</option>
        <option value="unarmed">Unarmed</option>
      </select>
    </div>

    <div class="ft-cast-field"><label>Intent</label><select name="intent">${mkOpts(FT.INTENTS, "violence")}</select></div>
    <div class="ft-cast-field"><label>Skill</label>
      <select name="skill">
        <option value="brawl">Brawl</option>
        <option value="melee" selected>Melee</option>
        <option value="firearms">Firearms</option>
        <option value="athletics">Athletics</option>
        <option value="stealth">Stealth</option>
      </select>
    </div>
    <div class="ft-cast-field"><label>Damage Formula</label><input type="text" name="damageFormula" value="2d6"/></div>
    <div class="ft-cast-field"><label>Damage Type</label><select name="damageType">${mkOpts(FT.DAMAGE_TYPES, "kinetic")}</select></div>
    <div class="ft-cast-field"><label>Track</label>
      <select name="damageTrack">
        <option value="integrity" selected>Integrity</option>
        <option value="stress">Stress</option>
        <option value="radiation">Radiation</option>
      </select>
    </div>
    <div class="ft-cast-field"><label>Short Range</label><input type="number" name="rangeShort" value="1" min="0"/></div>
    <div class="ft-cast-field"><label>Long Range</label><input type="number" name="rangeLong" value="1" min="0"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Target / Reach</label><input type="text" name="targetText" placeholder="One foe, a doorway, a circle around you, whoever carries the vow..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Range / Area Notes</label><input type="text" name="rangeAreaText" placeholder="Near, 3 / 6, the room, the threshold, a carried object..."/></div>

    <div class="ft-cast-field"><label>Duration Baseline</label><select name="duration">${mkOpts(FT.MANIFESTATION_DURATIONS, defaults.duration)}</select></div>
    <div class="ft-cast-field"><label>Scale</label><select name="scale">${mkOpts(FT.MANIFESTATION_SCALES, defaults.scale)}</select></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Duration / Trigger</label><input type="text" name="durationText" placeholder="Until dawn, for one exchange, while the vow is spoken..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Trigger</label><input type="text" name="triggerText" placeholder="When the bearer is touched by fear, when the threshold is crossed..."/></div>

    <div class="ft-cast-field"><label>Cost Type</label><select name="costType">${mkOpts(FT.MANIFESTATION_COSTS, defaults.costType)}</select></div>
    <div class="ft-cast-field"><label>Cost Value</label><input type="number" name="costValue" value="${defaults.costValue ?? 0}" min="0"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Cost</label><input type="text" name="costText" placeholder="1 Burn, 1 Stress per scene, Clarity 2 and the blade remembers your shame..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Maintenance Cost</label><input type="text" name="maintenanceCost" value="${ftEscapeHtml(defaults.maintenanceCost ?? "")}" placeholder="Leave blank if it does not keep costing anything."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Risk / Fallout</label><input type="text" name="riskText" placeholder="What can go wrong, fray, attract notice, or scar the caster?"/></div>

    <div class="ft-cast-field ft-cast-span-2"><label>Signature</label><input type="text" name="signature" placeholder="What tells people this could only have come from you?"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Third Thing</label><input type="text" name="thirdThing" placeholder="The one eerie detail that makes this more than a generic spell or item."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Path / Doctrine / Resonance</label><input type="text" name="pathResonance" placeholder="What belief, oath, appetite, wound, or philosophy gives this manifestation its logic?"/></div>

    <div class="ft-cast-field ft-cast-span-2"><label>What does this clearly allow in the fiction?</label><textarea name="fictionalPermission" rows="2" placeholder="What should everyone at the table understand this manifestation can absolutely do?"></textarea></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Mechanical Hook</label><input type="text" name="mechanicalHook" placeholder="Bonus, condition, damage, movement, protection, reveal, pressure..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>GM Calibration</label><textarea name="gmCalibration" rows="2" placeholder="What should the GM help tune for fairness, spectacle, or consequence?"></textarea></div>

    <div class="ft-cast-field ft-cast-span-2"><label>Effect / Use Notes</label><textarea name="effect" rows="3" placeholder="What does this manifestation do beyond its raw damage profile?"></textarea></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Flavor</label><textarea name="flavor" rows="2" placeholder="Texture, symbolism, attitude, or visual language"></textarea></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Tags</label><input type="text" name="tags" placeholder="comma-separated, e.g. thorned, ceremonial, echo-forged"/></div>
  </div>
</div>`;
  }

  return `
<div class="ft-cast-dialog ft-manifest-dialog">
  ${guideBlock}
  ${coachBlock}
  <div class="ft-manifest-dialog-section">
    <div class="ft-prev-label">What are you making?</div>
    <div class="ft-prev-align-note">Start with intent, not taxonomy. Ask what appears, what it changes, and what makes it weirdly yours.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Name</label><input type="text" name="name" placeholder="e.g. Mercy Lattice"/></div>
    <div class="ft-cast-field"><label>Expression</label><select name="manifestForm">${mkOpts(FT.MANIFESTATION_FORMS, defaults.form)}</select></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Concept</label><textarea name="concept" rows="2" placeholder="What are you bringing into the world?"></textarea></div>

    <div class="ft-cast-field"><label>Function</label><select name="manifestFunction">${mkOpts(FT.MANIFESTATION_FUNCTIONS, defaults.function)}</select></div>
    <div class="ft-cast-field"><label>Stability</label><select name="manifestStability">${mkOpts(ftStabilityOptionsForActor(actor), defaults.stability)}</select></div>
    <div class="ft-cast-field"><label>Interaction Model</label><select name="manifestInteraction">${mkOpts(FT.MANIFESTATION_INTERACTIONS, defaults.interactionModel)}</select></div>
    <div class="ft-cast-field"><label>Intent</label><select name="intent">${mkOpts(FT.INTENTS, "presence")}</select></div>
    <div class="ft-cast-field"><label>Channel</label><select name="channel">${mkOpts(FT.CHANNELS, "soul")}</select></div>
    <div class="ft-cast-field"><label>Sephirah</label><select name="sephirah">${mkOpts(FT.SEPHIROTH, rawSys?.magic?.sephirah ?? "tiferet")}</select></div>
    <div class="ft-cast-field"><label>Style</label><select name="mode">${mkOpts(FT.MODES, "hermetic")}</select></div>

    <div class="ft-cast-field"><label>Activation</label>
      <select name="activation">
        <option value="action" selected>Action</option>
        <option value="bonus">Bonus</option>
        <option value="reaction">Reaction</option>
        <option value="ritual">Ritual</option>
      </select>
    </div>
    <div class="ft-cast-field"><label>Target Shape</label>
      <select name="target">
        <option value="self">Self</option>
        <option value="single" selected>Single</option>
        <option value="burst">Burst</option>
        <option value="area">Area</option>
        <option value="faction">Faction</option>
      </select>
    </div>
    <div class="ft-cast-field"><label>Range Baseline</label>
      <select name="range">
        <option value="self">Self</option>
        <option value="touch">Touch</option>
        <option value="near" selected>Near</option>
        <option value="far">Far</option>
        <option value="sight">Sight</option>
        <option value="hex">Hex-scale</option>
      </select>
    </div>
    <div class="ft-cast-field ft-cast-span-2"><label>Target / Reach</label><input type="text" name="targetText" placeholder="One foe, the room, everyone who hears the hymn, the doorway you are touching..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Range / Area Notes</label><input type="text" name="rangeAreaText" placeholder="Near, touch, the room, sightline, a hex, whoever crosses the ward..."/></div>

    <div class="ft-cast-field"><label>Duration Baseline</label><select name="duration">${mkOpts(FT.MANIFESTATION_DURATIONS, defaults.duration)}</select></div>
    <div class="ft-cast-field"><label>Scale</label><select name="scale">${mkOpts(FT.MANIFESTATION_SCALES, defaults.scale)}</select></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Duration / Trigger</label><input type="text" name="durationText" placeholder="Until dawn, for one exchange, while the singer continues..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Trigger</label><input type="text" name="triggerText" placeholder="When the vow is broken, when fear enters the room, when the bearer lies..."/></div>

    <div class="ft-cast-field"><label>Cost Type</label><select name="costType">${mkOpts(FT.MANIFESTATION_COSTS, defaults.costType)}</select></div>
    <div class="ft-cast-field"><label>Cost Value</label><input type="number" name="costValue" value="${defaults.costValue ?? 1}" min="0"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Cost</label><input type="text" name="costText" placeholder="1 Clarity, 2 Noise, 1 Burn and the room remembers you..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Maintenance Cost</label><input type="text" name="maintenanceCost" value="${ftEscapeHtml(defaults.maintenanceCost ?? "")}" placeholder="Leave blank if it does not keep costing anything."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Risk / Fallout</label><input type="text" name="riskText" placeholder="What can go wrong, fray, attract notice, or scar the caster?"/></div>

    <div class="ft-cast-field ft-cast-span-2"><label>Signature</label><input type="text" name="signature" placeholder="What tells people this could only have come from you?"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Third Thing</label><input type="text" name="thirdThing" placeholder="The one eerie detail that makes this more than a stock effect."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Path / Doctrine / Resonance</label><input type="text" name="pathResonance" placeholder="What path, doctrine, or obsession does this expression belong to?"/></div>

    <div class="ft-cast-field ft-cast-span-2"><label>What does this clearly allow in the fiction?</label><textarea name="fictionalPermission" rows="2" placeholder="What should everybody at the table understand this manifestation can absolutely do?"></textarea></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Mechanical Hook</label><input type="text" name="mechanicalHook" placeholder="Bonus, condition, damage, movement, protection, reveal, pressure..."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>GM Calibration</label><textarea name="gmCalibration" rows="2" placeholder="Scope, duration, collateral weirdness, what breaks it, who resists it..."></textarea></div>

    <div class="ft-cast-field ft-cast-span-2"><label>Effect Formula</label><input type="text" name="damage" placeholder="Optional — e.g. 2d6 or 1d8+presence"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Description</label><textarea name="effect" rows="3" placeholder="What changes in the world when you invoke this?"></textarea></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Flavor</label><textarea name="flavor" rows="2" placeholder="Texture, symbolism, attitude, or visual language"></textarea></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Tags</label><input type="text" name="tags" placeholder="comma-separated, e.g. mirrored, restorative, hush"/></div>
  </div>
</div>`;
}

function readManifestationWizardValues(html, kind = "power") {
  const get = (name) => html.find(`[name='${name}']`).val();
  const getNum = (name, fallback = 0) => {
    const raw = Number(get(name));
    return Number.isFinite(raw) ? raw : fallback;
  };
  const tags = String(get("tags") ?? "")
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

  const base = {
    name: String(get("name") ?? "").trim(),
    concept: String(get("concept") ?? "").trim(),
    form: String(get("manifestForm") ?? (kind === "weapon" ? "weapon" : "sigil")),
    function: String(get("manifestFunction") ?? (kind === "weapon" ? "harm" : "transform")),
    stability: String(get("manifestStability") ?? (kind === "weapon" ? "bound" : "instant")),
    interactionModel: String(get("manifestInteraction") ?? (kind === "weapon" ? "weapon" : "event")),
    duration: String(get("duration") ?? (kind === "weapon" ? "scene" : "instant")),
    durationText: String(get("durationText") ?? "").trim(),
    triggerText: String(get("triggerText") ?? "").trim(),
    scale: String(get("scale") ?? "personal"),
    targetText: String(get("targetText") ?? "").trim(),
    rangeAreaText: String(get("rangeAreaText") ?? "").trim(),
    costType: String(get("costType") ?? (kind === "power" ? "clarity" : "none")),
    costValue: getNum("costValue", kind === "power" ? 1 : 0),
    costText: String(get("costText") ?? "").trim(),
    maintenanceCost: String(get("maintenanceCost") ?? "").trim(),
    riskText: String(get("riskText") ?? "").trim(),
    signature: String(get("signature") ?? "").trim(),
    thirdThing: String(get("thirdThing") ?? "").trim(),
    pathResonance: String(get("pathResonance") ?? "").trim(),
    fictionalPermission: String(get("fictionalPermission") ?? "").trim(),
    gmCalibration: String(get("gmCalibration") ?? "").trim(),
    mechanicalHook: String(get("mechanicalHook") ?? "").trim(),
    effect: String(get("effect") ?? "").trim(),
    flavor: String(get("flavor") ?? "").trim(),
    tags
  };

  if (kind === "weapon") {
    return {
      ...base,
      category: String(get("category") ?? "melee"),
      intent: String(get("intent") ?? "violence"),
      skill: String(get("skill") ?? "melee"),
      damageFormula: String(get("damageFormula") ?? "2d6"),
      damageType: String(get("damageType") ?? "kinetic"),
      damageTrack: String(get("damageTrack") ?? "integrity"),
      rangeShort: getNum("rangeShort", 1),
      rangeLong: getNum("rangeLong", 1)
    };
  }

  return {
    ...base,
    intent: String(get("intent") ?? "presence"),
    channel: String(get("channel") ?? "soul"),
    sephirah: String(get("sephirah") ?? "tiferet"),
    mode: String(get("mode") ?? "hermetic"),
    activation: String(get("activation") ?? "action"),
    target: String(get("target") ?? "single"),
    range: String(get("range") ?? "near"),
    damage: String(get("damage") ?? "").trim()
  };
}

function createManifestationItemData(actor, kind = "power", values = {}) {
  const tags = Array.from(new Set([
    ...(values.tags ?? []),
    values.form,
    values.function,
    values.stability,
    values.interactionModel
  ].filter(Boolean)));

  const manifestation = foundry.utils.mergeObject(
    ftManifestationDefaults(kind),
    {
      tier: Number(values.tier) >= 1 && Number(values.tier) <= 4 ? Number(values.tier) : 1,
      family: kind === "weapon" ? "form" : "working",
      concept: values.concept,
      form: values.form,
      function: values.function,
      stability: values.stability,
      interactionModel: values.interactionModel,
      costType: values.costType,
      costValue: values.costValue,
      costText: values.costText,
      duration: values.duration,
      durationText: values.durationText,
      triggerText: values.triggerText,
      scale: values.scale,
      targetText: values.targetText,
      rangeAreaText: values.rangeAreaText,
      maintenanceCost: values.maintenanceCost,
      riskText: values.riskText,
      pathResonance: values.pathResonance,
      fictionalPermission: values.fictionalPermission,
      gmCalibration: values.gmCalibration,
      mechanicalHook: values.mechanicalHook,
      signature: values.signature,
      thirdThing: values.thirdThing,
      // Wizard V2 plumbing — area / activation / resolution / appliedStates
      // authored in the stepwise wizard pass through `values` as nested
      // objects. appliedStates.states arrives as either an array (legacy /
      // direct stamping) or an object map (wizard checkbox harvest); the
      // normalizer coerces either to a clean array.
      area:          values.area,
      activation:    values.activation_block,
      resolution:    values.resolution,
      appliedStates: values.appliedStates
    },
    { inplace: false }
  );

  if (kind === "weapon") {
    return {
      name: values.name || "New Manifestation",
      type: "weapon",
      img: values.img || "icons/svg/sword.svg",
      system: {
        category: values.category || "melee",
        intent: values.intent || "violence",
        skill: values.skill || "melee",
        damage: {
          formula: values.damageFormula || "2d6",
          attribute: values.intent || "violence",
          type: values.damageType || "kinetic",
          track: values.damageTrack || "integrity"
        },
        range: {
          short: Number(values.rangeShort ?? 1) || 1,
          long: Number(values.rangeLong ?? 1) || 1
        },
        tags,
        effect: values.effect || "",
        flavor: values.flavor || "",
        manifestation
      }
    };
  }

  const clarityRequired = values.costType === "clarity" ? (Number(values.costValue ?? 1) || 1) : 0;
  const noiseGain = values.costType === "noise" ? (Number(values.costValue ?? 1) || 1) : 0;

  // Wizard V2 may pass a structured damageRoll. Falls back to defaults (op:none)
  // so legacy callers don't break.
  const damageRoll = ftNormalizeDamageRoll({ damageRoll: values.damageRoll ?? null });

  return {
    name: values.name || "New Manifestation",
    type: "power",
    img: values.img || "icons/svg/aura.svg",
    system: {
      intent: values.intent || "presence",
      channel: values.channel || "soul",
      sephirah: values.sephirah || (actor?.system?.magic?.sephirah ?? "tiferet"),
      mode: values.mode || "hermetic",
      clarityRequired,
      noiseGain,
      activation: values.activation || "action",
      target: values.target || "single",
      range: values.range || "near",
      damage: values.damage || "",
      damageRoll,
      effect: values.effect || "",
      flavor: values.flavor || "",
      tags,
      category: "manifestation",
      manifestation
    }
  };
}

async function openManifestationStarterDialog(actor) {
  const tcc = isTCC(actor);
  const chips = tcc
    ? `<span class="ft-manifest-chip">Ephemeral — it happens</span>
       <span class="ft-manifest-chip">Stable — it stays</span>
       <span class="ft-manifest-chip">Ritual / Ongoing — it keeps costing</span>`
    : `<span class="ft-manifest-chip">Stable — it stays</span>
       <span class="ft-manifest-chip">Ritual / Ongoing — it keeps costing</span>`;
  const tccNote = tcc ? "" : `
    <div class="ft-prev-align-note" style="font-size:0.75rem;opacity:0.7;margin-top:0.4rem;font-style:italic">
      Non-TCCs manifest by holding shapes open — Forms only. Workings (instant interventions) are reserved for Trad Caster Classes.
    </div>`;

  return new Promise((resolve) => {
    const buttons = {};
    if (tcc) {
      buttons.ephemeral = {
        icon: "<i class='fas fa-bolt'></i>",
        label: "Ephemeral",
        callback: async () => resolve(await openManifestationWizardV2(actor, { kind: "power", starter: "ephemeral" }))
      };
    }
    buttons.stable = {
      icon: "<i class='fas fa-shield-alt'></i>",
      label: "Stable",
      callback: async () => resolve(await openManifestationWizardV2(actor, { kind: "weapon", starter: "stable" }))
    };
    buttons.ritual = {
      icon: "<i class='fas fa-circle-notch'></i>",
      label: "Ritual / Ongoing",
      callback: async () => resolve(await openManifestationWizardV2(actor, { kind: "power", starter: "ritual" }))
    };
    buttons.cancel = {
      label: "Cancel",
      callback: () => resolve(null)
    };

    new Dialog({
      title: "New Manifestation",
      content: `
<div class="ft-manifest-dialog">
  <div class="ft-manifest-dialog-guide">
    <div class="ft-manifest-dialog-title">How does it enter the world?</div>
    <div class="ft-manifest-dialog-copy">Choose a starting posture. This is a starting point, not a prison.</div>
    <div class="ft-manifest-guide-body">${chips}</div>
    ${tccNote}
  </div>
</div>`,
      buttons,
      default: tcc ? "ephemeral" : "stable"
    }).render(true);
  });
}

async function openManifestationWizard(actor, { kind = "power", starter = "" } = {}) {
  // Non-TCC gate — defense-in-depth alongside the cast-time check. If a
  // non-TCC reaches the wizard via a Working/Ephemeral entry point (direct
  // button, macro, etc.), redirect them to the Ritual starter and notify.
  if (!isTCC(actor) && (starter === "ephemeral" || starter === "working")) {
    ui.notifications?.info(`${actor.name}: only TCCs may author Workings. Routing to Ritual / Ongoing — your manifestations persist as Forms.`);
    starter = "ritual";
    kind = "power";
  }

  const starterCfg = ftManifestationStarterConfig(starter, kind);
  const wizardKind = starterCfg?.kind ?? kind;
  const titleLabel = starterCfg?.label ?? (wizardKind === "weapon" ? "Stable" : "Ephemeral");
  return new Promise((resolve) => {
    new Dialog({
      title: `Manifestation Engine — ${titleLabel}`,
      content: buildManifestationWizardHTML(actor, { kind: wizardKind, starter }),
      buttons: {
        create: {
          icon: wizardKind === "weapon" ? "<i class='fas fa-sword'></i>" : "<i class='fas fa-magic'></i>",
          label: "Create Manifestation",
          callback: async (html) => {
            const values = readManifestationWizardValues(html, wizardKind);
            const itemData = createManifestationItemData(actor, wizardKind, values);
            const created = await actor.createEmbeddedDocuments("Item", [itemData]);
            if (created?.[0]) created[0].sheet.render(true);
            resolve(created?.[0] ?? null);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "create"
    }, {
      // Make the wizard a real authoring surface: wide, tall, resizable,
      // and scrollable when the form spills past the available height.
      classes: ["fourththing", "ft-manifestation-wizard-window"],
      width: 760,
      height: 820,
      resizable: true
    }).render(true);
  });
}

// ─── Manifestation Wizard V2 — stepwise authoring (Phase 1, 2026-05-06) ─────
// Parallel to openManifestationWizard. Same data flow into
// createManifestationItemData; wraps the field set into 7 paginated steps
// with delegated nav. No occult CSS yet — Phase 3 territory. Phase 2 (smart
// cascading defaults + live preview) is planned but not in this pass.

const _FT_WIZ_V2_FACULTIES = ["violence", "intrigue", "presence", "body", "mind", "soul"];

// Phase 3 — sigil glyphs per step. Hermetic / alchemical leaning, nothing
// stereotypically occult-kitsch. Each glyph is a single unicode codepoint so
// there's no SVG asset dependency.

// Curated icon library — FilePicker default-opens here on Step 7. Players
// (Trusted Player perm) can browse and pick; falls back to a kind-default
// icon when the user doesn't pick. Path is relative to Foundry user data
// root and uses raw spaces (FilePicker handles URL encoding internally).
const FT_ICON_LIBRARY_PATH = "art/bbttcc/GOTTGAIT/BBTTCC Button Icons";

const _FT_WIZ_V2_SIGILS = {
  concept:    "☉",  // sun — first principle, kindling the idea
  form:       "⊕",  // monad-cross — form becoming substance
  targeting:  "✠",  // cross — fixing focus on a thing
  effect:     "⚡",  // discharge — the working acts
  resolution: "⚖",  // balance — weighing of intent vs. world
  cost:       "◐",  // half-moon — cycles, what it takes to maintain
  soul:       "✦"   // star — quintessence, the third thing
};

function _ftWizV2Steps(kind) {
  const base = [
    { id: "concept",    label: "Concept",          render: _ftWizV2RenderConcept,   validate: (s) => s.name?.trim() ? { ok: true } : { ok: false, errors: ["Name is required to create the manifestation."] } },
    { id: "form",       label: "Form & Function",  render: _ftWizV2RenderForm },
    { id: "targeting",  label: "Targeting",        render: _ftWizV2RenderTargeting },
    { id: "effect",     label: "Effect",           render: kind === "weapon" ? _ftWizV2RenderEffectWeapon : _ftWizV2RenderEffectPower },
    { id: "resolution", label: "Resolution",       render: _ftWizV2RenderResolution },
    { id: "cost",       label: "Cost & Cadence",   render: _ftWizV2RenderCost },
    { id: "soul",       label: "Soul & Review",    render: _ftWizV2RenderSoulAndReview }
  ];
  return base;
}

// ── Helper builders ────────────────────────────────────────────────────────
function _ftWizV2Sel(name, map, current, { tooltip = "" } = {}) {
  const opts = Object.entries(map).map(([k, v]) => {
    const label = (typeof v === "string") ? v : (v?.label ?? k);
    return `<option value="${k}"${k === current ? " selected" : ""}>${label}</option>`;
  }).join("");
  return `<select name="${name}"${tooltip ? ` data-tooltip="${tooltip}"` : ""}>${opts}</select>`;
}
function _ftWizV2Txt(name, value, placeholder = "") {
  return `<input type="text" name="${name}" value="${ftEscapeHtml(String(value ?? ""))}" placeholder="${ftEscapeHtml(placeholder)}"/>`;
}
function _ftWizV2Num(name, value, { min = 0, max = 999 } = {}) {
  return `<input type="number" name="${name}" value="${Number(value) || 0}" min="${min}" max="${max}"/>`;
}
function _ftWizV2Area(name, value, placeholder = "", rows = 3) {
  return `<textarea name="${name}" rows="${rows}" placeholder="${ftEscapeHtml(placeholder)}">${ftEscapeHtml(String(value ?? ""))}</textarea>`;
}
function _ftWizV2Chk(name, checked) {
  return `<input type="checkbox" name="${name}" ${checked ? "checked" : ""}/>`;
}
function _ftWizV2FacultiesMap() {
  return Object.fromEntries(_FT_WIZ_V2_FACULTIES.map(k => [k, ftCap(k)]));
}

// ── Step renderers ─────────────────────────────────────────────────────────
function _ftWizV2RenderConcept(state) {
  return `
    <p class="ft-wiz-v2-coach">Bring a new piece of imagination into the world. Start with what it is, what it does, and what makes it strange.</p>
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Name</label>${_ftWizV2Txt("name", state.name, "e.g. Thorn Verdict")}</div>
      <div class="ft-cast-field"><label>Expression</label>${_ftWizV2Sel("form", FT.MANIFESTATION_FORMS, state.form)}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Concept</label>${_ftWizV2Area("concept", state.concept, "What are you bringing into the world?", 2)}</div>
    </div>`;
}

function _ftWizV2RenderForm(state, { actor }) {
  const stabilityMap = ftStabilityOptionsForActor(actor);
  return `
    <p class="ft-wiz-v2-coach">How does it act on the world, and how long does it stay?</p>
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Function</label>${_ftWizV2Sel("function", FT.MANIFESTATION_FUNCTIONS, state.function)}</div>
      <div class="ft-cast-field"><label>Stability</label>${_ftWizV2Sel("stability", stabilityMap, state.stability)}</div>
      <div class="ft-cast-field"><label>Interaction Model</label>${_ftWizV2Sel("interactionModel", FT.MANIFESTATION_INTERACTIONS, state.interactionModel)}</div>
      <div class="ft-cast-field"><label>Scale</label>${_ftWizV2Sel("scale", FT.MANIFESTATION_SCALES, state.scale)}</div>
    </div>`;
}

function _ftWizV2RenderTargeting(state) {
  const areaShape = state.area?.shape ?? "none";
  return `
    <p class="ft-wiz-v2-coach">Who or what does it touch, and across how much space?</p>
    <div class="ft-cast-grid">
      <div class="ft-cast-field ft-cast-span-2"><label>Target / Reach</label>${_ftWizV2Txt("targetText", state.targetText, "One foe, a doorway, a circle around you...")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Range / Area Notes</label>${_ftWizV2Txt("rangeAreaText", state.rangeAreaText, "Near, 3 / 6, the room, a carried object...")}</div>
      <div class="ft-cast-field"><label>Area shape</label>${_ftWizV2Sel("area.shape", { none: "None", cone: "Cone", sphere: "Sphere", line: "Line", cube: "Cube", cylinder: "Cylinder" }, areaShape)}</div>
      <div class="ft-cast-field"><label>Area size (ft)</label>${_ftWizV2Num("area.size", state.area?.size, { min: 0, max: 120 })}</div>
    </div>`;
}

function _ftWizV2RenderEffectPower(state) {
  const dr = state.damageRoll ?? {};
  const ap = state.appliedStates ?? {};
  const stateMap = ap.states ?? {};
  // Render checkbox grid for FT.CONDITIONS. Use `appliedStates.states.<key>`
  // as the form name; createManifestationItemData converts the resulting
  // object map to an array of selected keys.
  const condChecks = Object.entries(FT.CONDITIONS ?? {}).map(([key, cfg]) => {
    const checked = stateMap?.[key] === true || (Array.isArray(stateMap) && stateMap.includes(key));
    return `<label class="ft-wiz-v2-cond-chip" data-tooltip="${ftEscapeHtml(cfg.desc ?? "")}" style="border-color:${cfg.color}66">
      <input type="checkbox" name="appliedStates.states.${key}" ${checked ? "checked" : ""}/>
      <span class="ft-wiz-v2-cond-dot" style="background:${cfg.color}"></span>
      <span class="ft-wiz-v2-cond-label">${cfg.label}</span>
    </label>`;
  }).join("");
  const saveSubFields = ap.saveEachRound ? `
      <div class="ft-cast-field"><label>Save attribute</label>${_ftWizV2Sel("appliedStates.saveAttribute", _ftWizV2FacultiesMap(), ap.saveAttribute ?? "body")}</div>
      <div class="ft-cast-field"><label>DC mode</label>${_ftWizV2Sel("appliedStates.saveDcMode", { "cast-dc": "Cast DC (default 15)", fixed: "Fixed" }, ap.saveDcMode ?? "cast-dc")}</div>
      ${ap.saveDcMode === "fixed" ? `<div class="ft-cast-field"><label>DC</label>${_ftWizV2Num("appliedStates.saveDcFixed", ap.saveDcFixed ?? 15, { min: 5, max: 40 })}</div>` : ""}
  ` : "";
  return `
    <p class="ft-wiz-v2-coach">Does the working harm, heal, or transform without measurable damage? Configure the structured damage/heal roll the cast path will roll on success — and which conditions land alongside it.</p>
    <div class="ft-wiz-v2-subhead">Damage / Heal Roll</div>
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Operation</label>${_ftWizV2Sel("damageRoll.op", { none: "None (no roll)", damage: "Damage", heal: "Heal" }, dr.op ?? "none")}</div>
      <div class="ft-cast-field"><label>Number of dice</label>${_ftWizV2Num("damageRoll.number", dr.number, { min: 0, max: 20 })}</div>
      <div class="ft-cast-field"><label>Die</label>${_ftWizV2Sel("damageRoll.die", { d4: "d4", d6: "d6", d8: "d8", d10: "d10", d12: "d12", d10x10: "d10 (exploding)" }, dr.die ?? "d6")}</div>
      <div class="ft-cast-field"><label>Faculty bonus</label>${_ftWizV2Sel("damageRoll.attribute", { "": "— none —", ..._ftWizV2FacultiesMap() }, dr.attribute ?? "")}</div>
      <div class="ft-cast-field"><label>Damage type</label>${_ftWizV2Sel("damageRoll.type", FT.DAMAGE_TYPES, dr.type ?? "kinetic")}</div>
      <div class="ft-cast-field"><label>Track</label>${_ftWizV2Sel("damageRoll.track", { integrity: "Integrity", stress: "Stress", clarity: "Clarity", noise: "Noise" }, dr.track ?? "integrity")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Damage flavor</label>${_ftWizV2Txt("damageRoll.flavor", dr.flavor, "e.g. 'fire' (energy:fire) or 'sanctified'")}</div>
    </div>
    <div class="ft-wiz-v2-subhead" style="margin-top:0.6rem">Conditions Applied</div>
    <p style="font-size:0.74rem;opacity:0.7;margin:0 0 0.4rem;font-style:italic">Pick states the working inflicts. Applied only when resolution lands (full or half). Tooltips show effects.</p>
    <div class="ft-wiz-v2-cond-grid">${condChecks}</div>
    <div class="ft-cast-grid" style="margin-top:0.4rem">
      <div class="ft-cast-field"><label>Duration</label>${_ftWizV2Sel("appliedStates.duration", { "1-round": "1 round", "2-rounds": "2 rounds", "3-rounds": "3 rounds", scene: "Scene", "until-saved": "Until saved" }, ap.duration ?? "1-round")}</div>
      <div class="ft-cast-field"><label style="display:flex;gap:0.4rem;align-items:center;cursor:pointer">${_ftWizV2Chk("appliedStates.saveEachRound", ap.saveEachRound === true)}<span>Save each round to shake off</span></label></div>
      ${saveSubFields}
    </div>`;
}

function _ftWizV2RenderEffectWeapon(state) {
  return `
    <p class="ft-wiz-v2-coach">How does this manifested form harm? Combat-style attack profile.</p>
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Form Type</label>${_ftWizV2Sel("category", { melee: "Melee", ranged: "Ranged", thrown: "Thrown", unarmed: "Unarmed" }, state.category ?? "melee")}</div>
      <div class="ft-cast-field"><label>Intent</label>${_ftWizV2Sel("intent", FT.INTENTS, state.intent ?? "violence")}</div>
      <div class="ft-cast-field"><label>Skill</label>${_ftWizV2Sel("skill", { brawl: "Brawl", melee: "Melee", firearms: "Firearms", athletics: "Athletics", stealth: "Stealth" }, state.skill ?? "melee")}</div>
      <div class="ft-cast-field"><label>Damage formula</label>${_ftWizV2Txt("damageFormula", state.damageFormula ?? "2d6", "2d6")}</div>
      <div class="ft-cast-field"><label>Damage type</label>${_ftWizV2Sel("damageType", FT.DAMAGE_TYPES, state.damageType ?? "kinetic")}</div>
      <div class="ft-cast-field"><label>Track</label>${_ftWizV2Sel("damageTrack", { integrity: "Integrity", stress: "Stress", radiation: "Radiation" }, state.damageTrack ?? "integrity")}</div>
      <div class="ft-cast-field"><label>Short Range</label>${_ftWizV2Num("rangeShort", state.rangeShort ?? 1, { min: 0, max: 999 })}</div>
      <div class="ft-cast-field"><label>Long Range</label>${_ftWizV2Num("rangeLong", state.rangeLong ?? 1, { min: 0, max: 999 })}</div>
    </div>`;
}

function _ftWizV2RenderResolution(state) {
  const r = state.resolution ?? {};
  const shape = r.shape ?? "auto";
  const dr = state.damageRoll ?? {};
  const dmgWarning = (shape !== "auto" && (dr.op === "none" || !Number(dr.number)))
    ? `<p class="ft-wiz-v2-warn" style="color:#e8c84a;font-size:0.78rem;margin:0.4rem 0">⚠ Step 4 has no damage roll configured — Resolution gates damage, so an attack/save/contested shape currently has nothing to gate. Consider Auto or revisit Step 4.</p>`
    : "";
  const subAttack = shape === "attack" ? `
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Attack vs</label>${_ftWizV2Sel("resolution.attackVs", FT.DEFENSES, r.attackVs ?? "evasion")}</div>
    </div>` : "";
  const subSave = shape === "save" ? `
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Save attribute</label>${_ftWizV2Sel("resolution.saveAttribute", _ftWizV2FacultiesMap(), r.saveAttribute ?? "body")}</div>
      <div class="ft-cast-field"><label>DC mode</label>${_ftWizV2Sel("resolution.saveDcMode", { "cast-dc": "Cast DC (default 15)", fixed: "Fixed" }, r.saveDcMode ?? "cast-dc")}</div>
      ${(r.saveDcMode === "fixed") ? `<div class="ft-cast-field"><label>DC</label>${_ftWizV2Num("resolution.saveDcFixed", r.saveDcFixed ?? 15, { min: 5, max: 40 })}</div>` : ""}
      <div class="ft-cast-field"><label>On save</label>${_ftWizV2Sel("resolution.onSave", { negate: "Negate damage", half: "Half damage" }, r.onSave ?? "half")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label style="display:flex;gap:0.4rem;align-items:center;cursor:pointer" data-tooltip="If on, the cast posts a Save button chat card instead of the GM auto-rolling — target's owner clicks to roll their own save. Singular-target only; AoE always GM-side.">${_ftWizV2Chk("resolution.saveByPrompt", r.saveByPrompt === true)}<span>Prompt target to roll save (chat-card button)</span></label></div>
    </div>` : "";
  const subContest = shape === "contested" ? `
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Caster bonus</label>${_ftWizV2Sel("resolution.contestCasterAttribute", { "intent+channel": "Intent + Channel (default)", ..._ftWizV2FacultiesMap() }, r.contestCasterAttribute ?? "intent+channel")}</div>
      <div class="ft-cast-field"><label>Target attribute</label>${_ftWizV2Sel("resolution.contestTargetAttribute", _ftWizV2FacultiesMap(), r.contestTargetAttribute ?? "body")}</div>
      <div class="ft-cast-field"><label>On target win</label>${_ftWizV2Sel("resolution.onContestLoss", { negate: "Negate damage", half: "Half damage" }, r.onContestLoss ?? "negate")}</div>
    </div>` : "";
  return `
    <p class="ft-wiz-v2-coach">When the cast lands, what makes the effect <em>actually</em> hit?  Cast-fail fires misfire (unchanged); this picks the second-roll shape that gates the damage.</p>
    <div class="ft-cast-grid">
      <div class="ft-cast-field ft-cast-span-2"><label>Resolution shape</label>${_ftWizV2Sel("resolution.shape", { auto: "Auto-apply (no second roll)", attack: "Attack — caster vs target defense", save: "Save — target rolls vs cast DC", contested: "Contested — both roll, higher wins" }, shape)}</div>
    </div>
    ${subAttack}${subSave}${subContest}${dmgWarning}`;
}

function _ftWizV2RenderCost(state) {
  const a = state.activation_block ?? {};
  return `
    <p class="ft-wiz-v2-coach">What does it cost, when do you spend that, and how long does it run?</p>
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Cost type</label>${_ftWizV2Sel("costType", FT.MANIFESTATION_COSTS, state.costType)}</div>
      <div class="ft-cast-field"><label>Cost value</label>${_ftWizV2Num("costValue", state.costValue, { min: 0, max: 99 })}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Cost (free text)</label>${_ftWizV2Txt("costText", state.costText, "1 Burn, 1 Stress per scene, Clarity 2 and the blade remembers your shame...")}</div>
      <div class="ft-cast-field"><label>Activation</label>${_ftWizV2Sel("activation_block.type", { action: "Action", bonus: "Bonus action", reaction: "Reaction", none: "Free / passive" }, a.type ?? "action")}</div>
      <div class="ft-cast-field"><label style="display:flex;gap:0.4rem;align-items:center;cursor:pointer">${_ftWizV2Chk("activation_block.consumePool", a.consumePool !== false)}<span>Consume pool on cast</span></label></div>
      <div class="ft-cast-field"><label>Duration baseline</label>${_ftWizV2Sel("duration", FT.MANIFESTATION_DURATIONS, state.duration)}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Duration / Trigger</label>${_ftWizV2Txt("durationText", state.durationText, "Until dawn, for one exchange, while the vow is spoken...")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Trigger</label>${_ftWizV2Txt("triggerText", state.triggerText, "When the bearer is touched by fear, when the threshold is crossed...")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Maintenance cost</label>${_ftWizV2Txt("maintenanceCost", state.maintenanceCost, "Leave blank if it does not keep costing anything.")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Risk / fallout</label>${_ftWizV2Txt("riskText", state.riskText, "What can go wrong, fray, attract notice, or scar the caster?")}</div>
    </div>`;
}

// ── Magnitude v1.1 — tier suggester ────────────────────────────────────────
// Per RFI Manifestation Magnitude v1.1: tier = footprint, but mechanical
// magnitude (damage / area / state weight / fixed-DC) has its own per-tier
// budget. The suggester scores each input independently and returns the
// HIGHEST tier required (any single factor pushes the whole working up).
// Used by Step 7 to surface "Suggested tier: T2" with a one-click apply.
const _FT_WIZ_V2_DIE_AVG = { d4: 2.5, d6: 3.5, d8: 4.5, d10: 5.5, d12: 6.5, d10x10: 6.1 };

// Damage Major anchors: T1 1d6 (~3.5), T2 2d6 (~7), T3 3d6 (~10.5), T4 5d6 (~17.5).
// Snap to the highest tier whose anchor we don't exceed; flag overshoot at T4.
function _ftWizV2DamageBudgetTier(dr) {
  if (!dr || (dr.op !== "damage" && dr.op !== "heal") || !(Number(dr.number) > 0)) return { tier: 0, note: null };
  const avg = _FT_WIZ_V2_DIE_AVG[dr.die] ?? 3.5;
  const total = Number(dr.number) * avg;
  let tier;
  if      (total <= 4)  tier = 1;
  else if (total <= 8)  tier = 2;
  else if (total <= 12) tier = 3;
  else                  tier = 4;
  const overshoot = total > 18 ? " (above T4 anchor)" : "";
  const opLabel = dr.op === "heal" ? "Healing" : "Damage";
  return { tier, note: `${opLabel} ${dr.number}${dr.die} (avg ${total.toFixed(1)})${overshoot} → T${tier}` };
}

// Range/area anchors: T1 self/touch, T2 ≤30ft, T3 ≤60ft, T4 district / >60ft.
function _ftWizV2AreaBudgetTier(area) {
  if (!area || area.shape === "none" || !(Number(area.size) > 0)) return { tier: 0, note: null };
  const sz = Number(area.size);
  let tier;
  if      (sz <= 5)  tier = 1;
  else if (sz <= 30) tier = 2;
  else if (sz <= 60) tier = 3;
  else               tier = 4;
  return { tier, note: `${area.shape} ${sz}ft → T${tier}` };
}

// Applied-states weight: 1 short-duration state = T1; longer or multi-state
// climbs the ladder. saveEachRound softens (target can shake out → -1 weight),
// scene / until-saved without a recurring save stiffens (+1 weight).
function _ftWizV2StatesBudgetTier(ap) {
  if (!ap) return { tier: 0, note: null };
  const keys = Array.isArray(ap.states)
    ? ap.states.filter(Boolean)
    : (ap.states && typeof ap.states === "object"
        ? Object.entries(ap.states).filter(([, v]) => v === true).map(([k]) => k)
        : []);
  if (!keys.length) return { tier: 0, note: null };
  const dur = ap.duration ?? "1-round";
  const longLasting = (dur === "scene" || dur === "until-saved");
  let weight = keys.length;
  if (longLasting)            weight += 1;
  if (ap.saveEachRound === true) weight -= 1;
  let tier;
  if      (weight <= 1) tier = 1;
  else if (weight <= 2) tier = 2;
  else if (weight <= 4) tier = 3;
  else                  tier = 4;
  const tag = `${keys.length} state${keys.length > 1 ? "s" : ""}, ${dur}${ap.saveEachRound ? ", save-each-round" : ""}`;
  return { tier, note: `${tag} → T${tier}` };
}

// Fixed DC overrides: default = 8 + tier + faculty (~12-14 at T1). Author
// pushing DC up implies a higher tier intent. Reads both resolution.save and
// appliedStates.save fixed-DC fields; takes the max.
function _ftWizV2DcBudgetTier(state) {
  const r  = state.resolution ?? {};
  const ap = state.appliedStates ?? {};
  const dcs = [];
  if (r.shape === "save" && r.saveDcMode === "fixed" && Number(r.saveDcFixed) > 0) dcs.push(Number(r.saveDcFixed));
  if (ap.saveDcMode === "fixed" && Number(ap.saveDcFixed) > 0)                       dcs.push(Number(ap.saveDcFixed));
  if (!dcs.length) return { tier: 0, note: null };
  const dc = Math.max(...dcs);
  let tier;
  if      (dc <= 14) tier = 1;
  else if (dc <= 17) tier = 2;
  else if (dc <= 20) tier = 3;
  else               tier = 4;
  return { tier, note: `fixed DC ${dc} → T${tier}` };
}

function _ftWizV2SuggestTier(state) {
  const factors = [
    _ftWizV2DamageBudgetTier(state.damageRoll),
    _ftWizV2AreaBudgetTier(state.area),
    _ftWizV2StatesBudgetTier(state.appliedStates),
    _ftWizV2DcBudgetTier(state)
  ].filter(f => f.tier > 0);
  const tier = factors.length ? Math.max(...factors.map(f => f.tier)) : 1;
  return { tier, breakdown: factors };
}

function _ftWizV2TierLabel(n) {
  return FT.MANIFESTATION_TIERS?.[n]?.label ?? `T${n}`;
}

function _ftWizV2RenderSoulAndReview(state, { actor }) {
  const r = state.resolution ?? {};
  const dr = state.damageRoll ?? {};
  const summary = [
    state.name ? `<b>${ftEscapeHtml(state.name)}</b>` : `<i>Unnamed</i>`,
    state.form ? FT.MANIFESTATION_FORMS?.[state.form]?.label ?? state.form : null,
    state.function ? FT.MANIFESTATION_FUNCTIONS?.[state.function]?.label ?? state.function : null,
    state.stability ? FT.MANIFESTATION_STABILITIES?.[state.stability]?.label ?? state.stability : null,
    state.scale ? FT.MANIFESTATION_SCALES?.[state.scale]?.label ?? state.scale : null
  ].filter(Boolean).join(" · ");
  const fxBits = (dr.op && dr.op !== "none" && dr.number > 0)
    ? `${dr.number}${dr.die ?? "d6"}${dr.attribute ? ` + ${ftCap(dr.attribute)}` : ""} ${dr.type ?? "kinetic"} → ${dr.track ?? "integrity"}`
    : "no roll";
  const resBits = (r.shape && r.shape !== "auto") ? r.shape : "auto-apply";
  const costBits = state.costType && state.costValue
    ? `${state.costValue} ${state.costType}` : (state.costText || "no fixed cost");

  // Magnitude v1.1 suggestion banner. Highlights only when the configured
  // tier diverges from what the inputs warrant, otherwise shows a green ✓.
  const sug = _ftWizV2SuggestTier(state);
  const cur = Number(state.tier ?? 1) || 1;
  const matches = sug.tier === cur;
  const bColor = matches ? "rgba(120,200,140,0.55)" : "rgba(232,200,74,0.6)";
  const bBg    = matches ? "rgba(120,200,140,0.08)" : "rgba(232,200,74,0.08)";
  const headline = matches
    ? `Magnitude check ✓ — current tier <b>${_ftWizV2TierLabel(cur)}</b> matches Magnitude v1.1 budget.`
    : `Magnitude suggests <b>${_ftWizV2TierLabel(sug.tier)}</b> (you've configured for <b>${_ftWizV2TierLabel(cur)}</b>).`;
  const breakdownHtml = sug.breakdown.length
    ? `<ul style="margin:0.3rem 0 0;padding-left:1.2rem;font-size:0.74rem;line-height:1.5;opacity:0.85">${
        sug.breakdown.map(f => `<li>${ftEscapeHtml(f.note)}</li>`).join("")
      }</ul>`
    : `<div style="margin-top:0.3rem;opacity:0.6;font-style:italic;font-size:0.74rem">No magnitude inputs configured — minimum tier T1.</div>`;
  const applyBtn = matches
    ? ""
    : `<button type="button" data-wiz-action="apply-tier" data-tier="${sug.tier}" class="ft-wiz-v2-apply-tier" style="margin-top:0.4rem;padding:0.25rem 0.6rem;font-size:0.78rem">Set tier to ${_ftWizV2TierLabel(sug.tier)}</button>`;

  const iconImg = state.img || "icons/svg/aura.svg";
  return `
    <p class="ft-wiz-v2-coach">The texture that makes this <em>your</em> manifestation. Then a quick look-over and you're done.</p>
    <div class="ft-cast-grid">
      <div class="ft-cast-field ft-cast-span-2">
        <label data-tooltip="The icon that shows on the item, on the player HUD, and in chat cards. Pick from the curated BBTTCC icon library or any image you can browse to.">Icon</label>
        <div style="display:flex;gap:0.5rem;align-items:center;padding:0.3rem;border:1px solid rgba(232,200,74,0.18);border-radius:4px;background:rgba(20,12,40,0.4)">
          <img src="${ftEscapeHtml(iconImg)}" style="width:48px;height:48px;border:1px solid rgba(232,200,74,0.3);border-radius:4px;background:#0a0814;object-fit:cover" alt="manifestation icon"/>
          <button type="button" data-wiz-action="pick-image" style="padding:0.3rem 0.6rem;font-size:0.78rem">Choose from icon library…</button>
          <span style="font-size:0.72rem;opacity:0.55;flex:1;word-break:break-all">${ftEscapeHtml(iconImg)}</span>
        </div>
      </div>
      <div class="ft-cast-field ft-cast-span-2"><label>Signature</label>${_ftWizV2Txt("signature", state.signature, "What tells people this could only have come from you?")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Third Thing</label>${_ftWizV2Txt("thirdThing", state.thirdThing, "The one eerie detail that makes this more than a stock effect.")}</div>
      <div class="ft-cast-field ft-cast-span-2"><label>Path / Doctrine / Resonance</label>${_ftWizV2Txt("pathResonance", state.pathResonance, "What belief, oath, appetite, wound, or philosophy gives this its logic?")}</div>
    </div>
    <div class="ft-wiz-v2-summary" style="margin-top:0.6rem;padding:0.6rem;border:1px solid rgba(232,200,74,0.3);border-radius:4px;background:rgba(232,200,74,0.05)">
      <div style="font-size:0.82rem;font-weight:600;color:#e8c84a;margin-bottom:0.3rem">Review</div>
      <div style="font-size:0.78rem;line-height:1.5;opacity:0.9">
        ${summary || "<i>(insufficient detail)</i>"}<br>
        <span style="opacity:0.7">Tier:</span> ${_ftWizV2TierLabel(cur)}<br>
        <span style="opacity:0.7">Effect:</span> ${fxBits}<br>
        <span style="opacity:0.7">Resolution:</span> ${resBits}<br>
        <span style="opacity:0.7">Cost:</span> ${ftEscapeHtml(String(costBits))}
      </div>
    </div>
    <div class="ft-wiz-v2-tier-suggest" style="margin-top:0.6rem;padding:0.6rem;border:1px solid ${bColor};border-radius:4px;background:${bBg}">
      <div style="font-size:0.82rem;font-weight:600;margin-bottom:0.2rem">⚖ Magnitude (v1.1)</div>
      <div style="font-size:0.78rem;line-height:1.4">${headline}</div>
      ${breakdownHtml}
      ${applyBtn}
    </div>`;
}

// ── Shell + nav ────────────────────────────────────────────────────────────
function _ftWizV2RenderShell(actor, state, STEPS) {
  const i = state._currentStep;
  const step = STEPS[i];
  const stepHtml = step.render(state, { actor });
  // Stepper — sigils + connecting filigree lines. Each pip carries the glyph
  // for its step; the link spans use ::before/::after CSS for the line art.
  const indicatorParts = [];
  STEPS.forEach((s, idx) => {
    const cls = idx === i ? "active" : (idx < i ? "done" : "pending");
    indicatorParts.push(`
      <span class="ft-wiz-v2-step-pip ${cls}" data-step-idx="${idx}" data-tooltip="${idx + 1}. ${s.label}">
        <span class="ft-wiz-v2-step-sigil">${_FT_WIZ_V2_SIGILS[s.id] ?? "✦"}</span>
        <span class="ft-wiz-v2-step-label">${s.label}</span>
      </span>`);
    if (idx < STEPS.length - 1) {
      indicatorParts.push(`<span class="ft-wiz-v2-step-link ${idx < i ? "done" : "pending"}"></span>`);
    }
  });
  const isLast = i === STEPS.length - 1;
  const previewHtml = _ftWizV2BuildPreview(state);
  const stepSigil   = _FT_WIZ_V2_SIGILS[step.id] ?? "✦";
  const stepNum     = String(i + 1).padStart(2, "0");
  return `
    <div class="ft-wiz-v2" data-actor-id="${actor?.id ?? "world"}" data-step-id="${step.id}">
      <div class="ft-wiz-v2-banner">
        <span class="ft-wiz-v2-banner-glyph">${stepSigil}</span>
        <span class="ft-wiz-v2-banner-eyebrow">Manifestation Engine · Step ${stepNum} of ${String(STEPS.length).padStart(2, "0")}</span>
        <span class="ft-wiz-v2-banner-title">${step.label}</span>
      </div>
      <div class="ft-wiz-v2-stepper">${indicatorParts.join("")}</div>
      <div class="ft-wiz-v2-preview" data-tooltip="Live summary of what you've built so far. Updates as you navigate.">${previewHtml}</div>
      <div class="ft-wiz-v2-body" data-step-id="${step.id}">${stepHtml}</div>
      <div class="ft-wiz-v2-cascade-note"></div>
      <div class="ft-wiz-v2-errors"></div>
      <div class="ft-wiz-v2-nav">
        <button type="button" data-wiz-action="back" ${i === 0 ? "disabled" : ""}><span class="ft-wiz-v2-btn-glyph">◁</span><span>Back</span></button>
        ${isLast
          ? `<button type="button" data-wiz-action="finish" class="ft-wiz-v2-finish"><span class="ft-wiz-v2-btn-glyph">✦</span><span>Manifest</span></button>`
          : `<button type="button" data-wiz-action="next"><span>Next</span><span class="ft-wiz-v2-btn-glyph">▷</span></button>`}
      </div>
    </div>`;
}

function _ftWizV2Harvest(root, state) {
  const body = root.querySelector(".ft-wiz-v2-body");
  if (!body) return [];
  state._touched ??= new Set();
  const changed = [];
  body.querySelectorAll("[name]").forEach(el => {
    const path = el.name;
    let v;
    if (el.type === "checkbox")    v = el.checked;
    else if (el.type === "number") v = el.value === "" ? 0 : Number(el.value);
    else                            v = el.value;
    const old = foundry.utils.getProperty(state, path);
    if (old !== v) {
      // User-driven change → mark touched so cascades can't overwrite later.
      state._touched.add(path);
      changed.push(path);
    }
    foundry.utils.setProperty(state, path, v);
  });
  return changed;
}

// ── Cascade engine ─────────────────────────────────────────────────────────
// Maps trigger field changes to suggested downstream defaults. Cascades NEVER
// overwrite a user-touched field. The default-comparison alone isn't enough
// because earlier cascades can move fields off-default — `_touched` is the
// authoritative "user picked this" marker (set only by harvest).
const _FT_WIZ_V2_CASCADES = {
  function: {
    harm: {
      "damageRoll.op":         "damage",
      "damageRoll.number":     2,
      "damageRoll.die":        "d6",
      "damageRoll.attribute":  "violence",
      "damageRoll.type":       "kinetic",
      "damageRoll.track":      "integrity",
      "resolution.shape":      "attack",
      "resolution.attackVs":   "evasion"
    },
    protect: {
      "damageRoll.op":         "none",
      "resolution.shape":      "auto"
    },
    reveal: {
      "damageRoll.op":         "none",
      "resolution.shape":      "auto"
    },
    move: {
      "damageRoll.op":         "none",
      "resolution.shape":      "contested",
      "resolution.contestCasterAttribute": "intent+channel",
      "resolution.contestTargetAttribute": "body",
      "resolution.onContestLoss":          "negate"
    },
    repair: {
      "damageRoll.op":         "heal",
      "damageRoll.number":     2,
      "damageRoll.die":        "d8",
      "damageRoll.attribute":  "presence",
      "damageRoll.track":      "integrity",
      "resolution.shape":      "auto"
    },
    command: {
      "damageRoll.op":         "none",
      "resolution.shape":      "save",
      "resolution.saveAttribute": "soul",
      "resolution.saveDcMode":    "cast-dc",
      "resolution.onSave":        "negate",
      "appliedStates.states.compelled": true,
      "appliedStates.duration":         "until-saved",
      "appliedStates.saveEachRound":    true,
      "appliedStates.saveAttribute":    "soul"
    },
    transform: {
      "damageRoll.op":         "none",
      "resolution.shape":      "save",
      "resolution.saveAttribute": "body",
      "resolution.saveDcMode":    "cast-dc",
      "resolution.onSave":        "negate"
    },
    bind: {
      "damageRoll.op":         "none",
      "resolution.shape":      "save",
      "resolution.saveAttribute": "body",
      "resolution.saveDcMode":    "cast-dc",
      "resolution.onSave":        "negate",
      "appliedStates.states.restrained": true,
      "appliedStates.duration":          "until-saved",
      "appliedStates.saveEachRound":     true,
      "appliedStates.saveAttribute":     "body"
    }
  },
  interactionModel: {
    weapon: {
      "damageRoll.op":         "damage",
      "resolution.shape":      "attack",
      "resolution.attackVs":   "evasion"
    },
    zone: {
      "resolution.shape":      "save",
      "resolution.saveAttribute": "body"
    },
    mark: {
      "resolution.shape":      "save",
      "resolution.saveAttribute": "soul"
    },
    transformation: {
      "resolution.shape":      "save",
      "resolution.saveAttribute": "body",
      "resolution.onSave":        "negate"
    }
  },
  stability: {
    instant:   { duration: "instant" },
    sustained: { duration: "scene", maintenanceCost: "1 Clarity per scene" },
    bound:     { duration: "persistent" },
    enduring:  { duration: "persistent" }
  }
};

function _ftWizV2ApplyCascade(state, changedPaths) {
  state._touched ??= new Set();
  const writes = [];
  for (const path of changedPaths) {
    const rules = _FT_WIZ_V2_CASCADES[path];
    if (!rules) continue;
    const triggerVal = foundry.utils.getProperty(state, path);
    const targets    = rules[triggerVal];
    if (!targets) continue;
    for (const [targetPath, targetVal] of Object.entries(targets)) {
      if (state._touched.has(targetPath)) continue;
      foundry.utils.setProperty(state, targetPath, targetVal);
      writes.push({ from: `${path}=${triggerVal}`, to: `${targetPath}=${targetVal}` });
    }
  }
  return writes;
}

// ── Live preview chip ──────────────────────────────────────────────────────
function _ftWizV2BuildPreview(state) {
  const bits = [];
  if (state.name) bits.push(`<b>${ftEscapeHtml(state.name)}</b>`);
  if (state.function && FT.MANIFESTATION_FUNCTIONS?.[state.function]) {
    bits.push(FT.MANIFESTATION_FUNCTIONS[state.function].label.toLowerCase());
  }
  if (state.stability && FT.MANIFESTATION_STABILITIES?.[state.stability]) {
    bits.push(FT.MANIFESTATION_STABILITIES[state.stability].label.toLowerCase());
  }
  const dr = state.damageRoll ?? {};
  if (dr.op === "damage" && dr.number > 0) {
    bits.push(`${dr.number}${dr.die ?? "d6"} ${dr.type ?? "kinetic"}`);
  } else if (dr.op === "heal" && dr.number > 0) {
    bits.push(`heal ${dr.number}${dr.die ?? "d8"}`);
  }
  const r = state.resolution ?? {};
  if (r.shape === "attack")         bits.push(`attack vs ${ftCap(r.attackVs ?? "evasion")}`);
  else if (r.shape === "save")      bits.push(`save: ${ftCap(r.saveAttribute ?? "body")}`);
  else if (r.shape === "contested") bits.push(`contest vs ${ftCap(r.contestTargetAttribute ?? "body")}`);
  // Applied states — pull selected condition keys from the wizard's object
  // map (or array if pre-stamped). Show up to 3 + count overflow.
  const ap = state.appliedStates ?? {};
  let stateKeys = [];
  if (Array.isArray(ap.states)) stateKeys = ap.states;
  else if (ap.states && typeof ap.states === "object") {
    stateKeys = Object.entries(ap.states).filter(([, v]) => v === true).map(([k]) => k);
  }
  if (stateKeys.length) {
    const durTag = { "1-round": "1r", "2-rounds": "2r", "3-rounds": "3r", scene: "scene", "until-saved": "save-ends" }[ap.duration] ?? "";
    const labels = stateKeys.slice(0, 3).map(k => FT.CONDITIONS?.[k]?.label?.toLowerCase() ?? k);
    const more   = stateKeys.length > 3 ? ` +${stateKeys.length - 3}` : "";
    const saveTag = ap.saveEachRound ? ` <span style="color:#a0d4ff">↻</span>` : "";
    bits.push(`${labels.join(", ")}${more}${durTag ? ` (${durTag})` : ""}${saveTag}`);
  }
  if (state.costType && state.costType !== "none" && Number(state.costValue) > 0) {
    bits.push(`${state.costValue} ${state.costType}`);
  }
  if (!bits.length) return `<span style="opacity:0.5;font-style:italic">your manifestation will sketch itself here as you go…</span>`;
  return bits.join(` <span style="opacity:0.4">·</span> `);
}

async function openManifestationWizardV2(actor, { kind = "power", starter = "", targetFolder = null } = {}) {
  // Mirror the non-TCC gate from the legacy wizard. Skipped for actor-less
  // GM authoring (targetFolder mode) — the GM can author any starter shape.
  if (actor && !isTCC(actor) && (starter === "ephemeral" || starter === "working")) {
    ui.notifications?.info(`${actor.name}: only TCCs may author Workings. Routing to Ritual / Ongoing — your manifestations persist as Forms.`);
    starter = "ritual";
    kind = "power";
  }
  const starterCfg = ftManifestationStarterConfig(starter, kind);
  const wizardKind = starterCfg?.kind ?? kind;
  const titleLabel = starterCfg?.label ?? (wizardKind === "weapon" ? "Stable" : "Ephemeral");

  // Initial state — defaults + starter overrides + name slot. The
  // `activation_block` key holds the structured manifestation.activation
  // object (the bare `activation` key is the legacy top-level string).
  const defaults = foundry.utils.mergeObject(
    ftManifestationDefaults(wizardKind),
    foundry.utils.deepClone(starterCfg?.defaults ?? {}),
    { inplace: false }
  );
  const state = foundry.utils.deepClone(defaults);
  state.name = "";
  state.activation_block = defaults.activation ? foundry.utils.deepClone(defaults.activation) : { type: "action", consumePool: true };
  state.damageRoll = ftDamageRollDefaults();
  // Wizard form harvests `appliedStates.states.<condKey> = bool` from the
  // checkbox grid — coerce the array-shape default to an object map so
  // setProperty writes don't mutate an array. Normalizer converts back.
  state.appliedStates = foundry.utils.deepClone(defaults.appliedStates ?? {});
  state.appliedStates.states = {};
  // Default icon — kind-appropriate fallback. Step 7 lets the author swap
  // via FilePicker (curated icon library at FT_ICON_LIBRARY_PATH).
  state.img = wizardKind === "weapon" ? "icons/svg/sword.svg" : "icons/svg/aura.svg";
  state._currentStep = 0;

  const STEPS = _ftWizV2Steps(wizardKind);

  return new Promise((resolve) => {
    let resolved = false;
    const dialog = new Dialog({
      title: `Manifestation Engine — ${titleLabel} (V2)`,
      content: _ftWizV2RenderShell(actor, state, STEPS),
      buttons: {
        cancel: { label: "Cancel", callback: () => { if (!resolved) { resolved = true; resolve(null); } } }
      },
      default: "cancel",
      close: () => { if (!resolved) { resolved = true; resolve(null); } }
    }, {
      classes: ["fourththing", "ft-manifest-wizard-v2-window"],
      width: 760,
      height: 820,
      resizable: true
    });
    dialog.render(true);

    Hooks.once("renderDialog", (d, $html) => {
      if (d !== dialog) return;
      const root = $html[0] ?? $html;
      const wizRoot = root.querySelector?.(".ft-wiz-v2") ?? root.find?.(".ft-wiz-v2")?.[0];
      if (!wizRoot) return;

      wizRoot.addEventListener("click", async (ev) => {
        const action = ev.target?.closest?.("[data-wiz-action]")?.dataset?.wizAction;
        if (!action) return;

        // Always harvest current step's values before navigating. Then fire
        // any cascades from the changed trigger fields — cascades only write
        // to non-touched downstream fields, so user choices survive.
        const changed = _ftWizV2Harvest(wizRoot, state);
        const cascadeWrites = _ftWizV2ApplyCascade(state, changed);
        const errBox = wizRoot.querySelector(".ft-wiz-v2-errors");
        if (errBox) errBox.textContent = "";

        if (action === "back") {
          if (state._currentStep > 0) state._currentStep--;
        } else if (action === "pick-image") {
          // FilePicker scoped to the curated BBTTCC icon library. Trusted
          // Player perm gates browse access — players without it will see
          // an empty picker. Picked path stamps onto state.img and triggers
          // a re-render so the preview updates immediately.
          const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
          new FP({
            type: "image",
            current: state.img && state.img !== "icons/svg/aura.svg" && state.img !== "icons/svg/sword.svg"
              ? state.img
              : FT_ICON_LIBRARY_PATH,
            callback: (path) => {
              state.img = path;
              state._touched ??= new Set();
              state._touched.add("img");
              // Force re-render of the current step so the preview updates.
              const fresh = _ftWizV2RenderShell(actor, state, STEPS);
              const tmp = document.createElement("div");
              tmp.innerHTML = fresh;
              const newWiz = tmp.firstElementChild;
              wizRoot.innerHTML = newWiz?.innerHTML ?? "";
            }
          }).render(true);
          return; // Don't fall through to nav re-render.
        } else if (action === "apply-tier") {
          // Magnitude v1.1 banner click. Stamp suggested tier + mark touched
          // so the cascade engine can't overwrite it on later nav.
          const newTier = Number(ev.target.closest("[data-tier]")?.dataset?.tier);
          if (Number.isFinite(newTier) && newTier >= 1 && newTier <= 4) {
            state.tier = newTier;
            state._touched ??= new Set();
            state._touched.add("tier");
          }
        } else if (action === "next") {
          const cur = STEPS[state._currentStep];
          if (cur.validate) {
            const r = cur.validate(state);
            if (!r.ok) { if (errBox) errBox.textContent = r.errors.join(" · "); return; }
          }
          if (state._currentStep < STEPS.length - 1) state._currentStep++;
        } else if (action === "finish") {
          // Final validation pass on every step.
          for (let i = 0; i < STEPS.length; i++) {
            if (STEPS[i].validate) {
              const r = STEPS[i].validate(state);
              if (!r.ok) {
                state._currentStep = i;
                wizRoot.innerHTML = _ftWizV2RenderShell(actor, state, STEPS).match(/<div class="ft-wiz-v2"[^>]*>([\s\S]*)<\/div>/)?.[1] ?? "";
                const eb = wizRoot.querySelector(".ft-wiz-v2-errors");
                if (eb) eb.textContent = r.errors.join(" · ");
                return;
              }
            }
          }
          try {
            const itemData = createManifestationItemData(actor, wizardKind, state);
            // Two-mode create: actor-embedded (default) vs world Item with
            // optional targetFolder (GM library authoring path).
            let created = null;
            if (actor) {
              const docs = await actor.createEmbeddedDocuments("Item", [itemData]);
              created = docs?.[0] ?? null;
            } else {
              if (targetFolder?.id) itemData.folder = targetFolder.id;
              created = await Item.create(itemData);
            }
            if (created) created.sheet.render(true);
            resolved = true;
            resolve(created);
            dialog.close();
          } catch (e) {
            console.warn("Roll for Initiation | wizard V2 finish failed", e);
            ui.notifications?.error(`Manifestation Wizard V2: create failed (see console).`);
          }
          return;
        } else {
          return;
        }

        // Re-render shell. Replace the wizard root's INNER content (preserving
        // the outer div + click delegation listener).
        const fresh = _ftWizV2RenderShell(actor, state, STEPS);
        const tmp = document.createElement("div");
        tmp.innerHTML = fresh;
        const newWiz = tmp.firstElementChild;
        wizRoot.innerHTML = newWiz?.innerHTML ?? "";

        // Surface cascade writes so the player knows the wizard suggested
        // values they can override on later steps. Auto-fades on next nav.
        if (cascadeWrites.length) {
          const note = wizRoot.querySelector(".ft-wiz-v2-cascade-note");
          if (note) {
            note.innerHTML = `<span style="opacity:0.85">✦ Suggested defaults filled:</span> ${
              cascadeWrites.map(w => `<span style="opacity:0.7">${ftEscapeHtml(w.to)}</span>`).join(", ")
            } <span style="opacity:0.55;font-style:italic">— overrideable on later steps.</span>`;
          }
        }
      });
    });
  });
}

// ─── Sprint B: Combat constants ───────────────────────────────────────────────

FT.CONDITIONS = {
  staggered:  { label: "Staggered",  color: "#f2994a", desc: "Movement halved; −2 to attack rolls."                },
  scarred:    { label: "Scarred",    color: "#9b59b6", desc: "Paradox mark; −1 Clarity until end of scene."        },
  calmed:     { label: "Calmed",     color: "#4a90d9", desc: "Cannot take violent actions willingly."              },
  blinded:    { label: "Blinded",    color: "#546e7a", desc: "Attack rolls at disadvantage; cannot target far."    },
  prone:      { label: "Prone",      color: "#78909c", desc: "Melee attacks against you +2; ranged −2."            },
  shaken:     { label: "Shaken",     color: "#e8c84a", desc: "−2 to Resolve checks; Stress costs +1."             },
  burning:    { label: "Burning",    color: "#c03030", desc: "1d4 Integrity damage at start of each turn."         },
  restrained: { label: "Restrained", color: "#27ae60", desc: "Cannot move; Evasion reduced to base 10."           },
  charmed:    { label: "Charmed",    color: "#e07ec6", desc: "Cannot take hostile action against the source; source has reroll-lowest on social checks against you." },
  compelled:  { label: "Compelled",  color: "#7d3cff", desc: "On your turn you must spend at least one action toward a directive named by the source; otherwise you may act freely." },
  dying:      { label: "Dying",      color: "#8b0000", desc: "Integrity reduced to 0. Make a Last Stand roll at the start of each of your turns. 3 successes → stabilize at 1 Integrity. 3 failures → Cross the Threshold." },
  surprise:   { label: "Surprised",  color: "#cc7a00", desc: "Cannot take any action on the first round of combat. Ends at the start of your next turn." }
};

FT.DEFENSES = {
  guard:   { label: "Guard",   formula: "10 + Violence + Body",    desc: "Resists physical force"       },
  evasion: { label: "Evasion", formula: "10 + Intrigue + Body",    desc: "Resists being struck at all"  },
  resolve: { label: "Resolve", formula: "10 + Presence + Soul",    desc: "Resists mental/psychic force" }
};

// Canonical RFI damage list (v1.0 compliance sweep).
// Elemental fiction (fire/cold/lightning/acid) folds into "energy" — preserved on items
// via the separate damageFlavor field. Radiation is a distinct track that ticks
// system.radiation.rp instead of an integrity/stress bar.
FT.DAMAGE_TYPES = {
  kinetic:    { label: "Kinetic",    track: "integrity" },
  energy:     { label: "Energy",     track: "integrity" },
  poison:     { label: "Poison",     track: "integrity" },
  psychic:    { label: "Psychic",    track: "stress"    },
  sephirotic: { label: "Sephirotic", track: "integrity" },
  qliphothic: { label: "Qliphothic", track: "stress"    },
  radiation:  { label: "Radiation",  track: "radiation" }
};

// ─── Armor skill rank scaling ─────────────────────────────────────────────────
// Wearer's rank in the armor's declared armorSkill decides how much of the item's
// guardBonus/evasionBonus/resolveBonus it delivers, plus a flat defense bump at
// Expert+. Scene-triggered effects (Master reroll, Legendary auto-success) are
// TODO(armor-scene) — content authors them, runtime wiring is a later sprint.
FT.ARMOR_RANK_SCALE = {
  0: { mult: 0,   flat: 0, label: "Untrained — worn wrong, no benefit" },
  1: { mult: 0.5, flat: 0, label: "Trained — half bonuses" },
  2: { mult: 1,   flat: 0, label: "Proficient — full bonuses" },
  3: { mult: 1,   flat: 1, label: "Expert — full bonuses, +1 defense" },
  4: { mult: 1,   flat: 2, label: "Master — full bonuses, +2 defense" },
  5: { mult: 1,   flat: 3, label: "Legendary — full bonuses, +3 defense" }
};

FT.ARMOR_SKILLS = ["plating", "weave", "warding"];

// ─── Combat Actions (Phase 1: codified RFI action lexicon) ────────────────────
// Each entry consumes a pool (action/bonus/reaction) and applies a mechanical
// effect — flag, derived bump (read in prepareDerivedData), or chained roll.
// Surfaces as one-click buttons on the Engagement tab. Per-turn flags are
// cleared in _onFtNewTurn; combat.hidden persists across turns until the
// steward acts overtly (GM call).
FT.COMBAT_ACTIONS = {
  dash: {
    label: "Dash", icon: "🏃", cost: "actionUsed",
    desc: "Spend your action to add your walk speed to your movement budget for this turn.",
    apply: async (actor) => {
      const sys = actor.system?.system ?? actor.system;
      const baseSpeed = Number(sys?.derived?.movement?.walk) || 30;
      const cur = Number(sys?.actions?.movementBudgetFt) || 0;
      await actor.update({ "system.actions.movementBudgetFt": cur + baseSpeed });
      return `${actor.name} dashes — movement budget +${baseSpeed} ft (now ${cur + baseSpeed} ft).`;
    }
  },
  disengage: {
    label: "Disengage", icon: "🚶", cost: "actionUsed",
    desc: "Your movement does not provoke attacks of opportunity until end of turn.",
    apply: async (actor) => {
      await actor.setFlag("fourththing", "combat", { ...(actor.flags?.fourththing?.combat ?? {}), disengaged: true });
      return `${actor.name} disengages — movement won't provoke AoO until end of turn.`;
    }
  },
  hold: {
    label: "Hold", icon: "⏳", cost: "actionUsed",
    desc: "Set a trigger condition. Convert your spent action into a reaction you can fire when the trigger fires.",
    apply: async (actor) => {
      const trigger = await new Promise((resolve) => {
        new Dialog({
          title:   `Hold — ${actor.name}`,
          content: `<p style="margin:0.4rem 0">What trigger fires your held action?</p>
                    <input type="text" name="trigger" style="width:100%" placeholder="e.g., when an enemy enters my reach"/>`,
          buttons: {
            ok:     { label: "Hold",   callback: (html) => resolve(html.find("[name='trigger']").val() || "(unspecified)") },
            cancel: { label: "Cancel", callback: () => resolve(null) }
          },
          default: "ok"
        }).render(true);
      });
      if (!trigger) return null;
      const cur = actor.flags?.fourththing?.combat ?? {};
      await actor.setFlag("fourththing", "combat", { ...cur, holding: { trigger, set: Date.now() } });
      return `${actor.name} holds — ready to react when ${trigger}.`;
    }
  },
  aid: {
    label: "Aid", icon: "🤝", cost: "actionUsed",
    desc: "Aid a targeted ally — they gain a banked reroll-lowest on their next roll this scene.",
    apply: async (actor) => {
      const targets = Array.from(game.user?.targets ?? []);
      const ally = targets[0]?.actor;
      if (!ally) {
        ui.notifications?.warn("Target an ally token first, then click Aid.");
        return null;
      }
      const banked = ally.getFlag("fourththing", "aidBanked") ?? [];
      banked.push({ from: actor.name, kind: "reroll-lowest", set: Date.now() });
      await ally.setFlag("fourththing", "aidBanked", banked);
      return `${actor.name} aids ${ally.name} — reroll-lowest banked for ${ally.name}'s next roll this scene.`;
    }
  },
  hide: {
    label: "Hide", icon: "🌑", cost: "actionUsed",
    desc: "Roll Stealth (Intrigue). On a high roll vs. observers' Perception, you become hidden.",
    apply: async (actor) => {
      await game.fourththing.rolls.attributeTest(actor, {
        attribute: "intrigue", skill: "stealth", label: "Hide"
      });
      const cur = actor.flags?.fourththing?.combat ?? {};
      await actor.setFlag("fourththing", "combat", { ...cur, hidden: true });
      return `${actor.name} hides — Stealth rolled. GM: compare to observers' Perception. Hidden flag set.`;
    }
  },
  dodge: {
    label: "Dodge", icon: "🛡", cost: "actionUsed",
    desc: "+2 to Guard, Evasion, and Resolve until the start of your next turn.",
    apply: async (actor) => {
      const cur = actor.flags?.fourththing?.combat ?? {};
      await actor.setFlag("fourththing", "combat", { ...cur, dodging: true });
      return `${actor.name} takes the Dodge — +2 to all defenses until next turn.`;
    }
  }
};

async function ftPerformCombatAction(actor, key) {
  const def = FT.COMBAT_ACTIONS[key];
  if (!def) { ui.notifications?.warn(`Unknown combat action: ${key}`); return; }
  const sys  = actor.system?.system ?? actor.system;
  const used = sys?.actions?.[def.cost] ?? false;
  if (used) {
    ui.notifications?.warn(`${actor.name} has already used their ${def.cost.replace(/Used$/, "")} this turn.`);
    return;
  }
  const summary = await def.apply(actor);
  if (summary === null) return; // cancelled or failed validation
  await actor.update({ [`system.actions.${def.cost}`]: true });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fourththing-roll">
                <div class="ft-roll-header"><span class="ft-roll-name">${def.icon} ${def.label}</span></div>
                <p style="margin:0.2rem 0;font-size:0.85rem">${ftEscapeHtml(summary)}</p>
                <p style="margin:0.15rem 0 0;font-size:0.72rem;opacity:0.65">${ftEscapeHtml(def.desc)}</p>
              </div>`
  });
}

// ─── Defense engine (Phases 1–3) ──────────────────────────────────────────────
// Actors declare base defenses at system.defenses.{resistances,immunities,vulnerabilities}
// (GM-editable) and base condition immunities at system.conditionImmunities.
// Items can grant additional entries via flags.fourththing.grants.
//
// Damage-type entries accept either:
//   - flat string  "energy"                 (all energy damage)
//   - structured   { type: "energy", flavor: "fire" }  (only energy w/ fire flavor)
// The pipeline applies immunity (×0), then vulnerability (×2), then resistance (×½, floor).
// An entry matches a hit when types match AND (entry has no flavor OR flavor matches).
function _ftNormalizeDefenseEntry(e, validTypeSet) {
  if (e == null) return null;
  if (typeof e === "string") {
    const type = e.toLowerCase();
    return validTypeSet.has(type) ? { type, flavor: null } : null;
  }
  if (typeof e === "object") {
    const type = String(e.type ?? "").toLowerCase();
    if (!validTypeSet.has(type)) return null;
    const flavor = e.flavor ? String(e.flavor).toLowerCase() : null;
    return { type, flavor };
  }
  return null;
}

function _ftMergeEntries(target, entries, validTypeSet) {
  for (const raw of (Array.isArray(entries) ? entries : [])) {
    const norm = _ftNormalizeDefenseEntry(raw, validTypeSet);
    if (!norm) continue;
    target.set(`${norm.type}|${norm.flavor ?? ""}`, norm);
  }
}

function ftComputeDefenses(actor, sys) {
  const validTypes  = new Set(Object.keys(FT.DAMAGE_TYPES));
  const validConds  = new Set(Object.keys(FT.CONDITIONS ?? {}));
  const resistMap = new Map();
  const immuneMap = new Map();
  const vulnMap   = new Map();
  const condImmunes = new Set();

  _ftMergeEntries(resistMap, sys?.defenses?.resistances,     validTypes);
  _ftMergeEntries(immuneMap, sys?.defenses?.immunities,      validTypes);
  _ftMergeEntries(vulnMap,   sys?.defenses?.vulnerabilities, validTypes);
  for (const c of (sys?.conditionImmunities ?? [])) {
    const k = String(c ?? "").toLowerCase();
    if (validConds.has(k)) condImmunes.add(k);
  }

  if (actor?.items) {
    for (const item of actor.items) {
      const grants     = item.flags?.fourththing?.grants;
      const armorRes   = (item.type === "armor") ? item.system?.resistances : null;
      const hasArmorRes = Array.isArray(armorRes) && armorRes.length > 0;
      // Skip items that contribute nothing — neither flag-grants nor native
      // armor resistances. Pre-fix bug: the bail also dropped armor with native
      // resistances on the floor, so things like Foam Finger's ["kinetic"]
      // never reached the resist map.
      if (!grants && !hasArmorRes) continue;

      // Equipped gate — armor uses native system.equipped (read by armor calc
      // too); weapons + gear use the flag toggle from the inventory tab. Items
      // with neither field (purely narrative grants) are not gated here.
      const sysEquipped  = item.system?.equipped;
      const flagEquipped = item.getFlag?.("fourththing", "equipped");
      const hasEquipField = (sysEquipped !== undefined) || (flagEquipped !== undefined);
      if (hasEquipField) {
        const equipped = item.type === "armor" ? !!sysEquipped : !!flagEquipped;
        if (!equipped) continue;
      }

      // Armor skill gate — protection requires the wearer be at least Trained
      // in the armor's declared skill (rank ≥ 1). Untrained armor delivers the
      // material but not the practice; resistance grants are dormant.
      if (item.type === "armor") {
        const skillKey = (item.system?.armorSkill && FT.ARMOR_SKILLS.includes(item.system.armorSkill))
          ? item.system.armorSkill
          : "weave";
        const rank = sys?.skills?.[skillKey]?.value ?? 0;
        if (rank < 1) continue;
      }

      // Native armor resistances first — string array of damage types or
      // {type,flavor} objects. _ftMergeEntries normalizes both.
      if (hasArmorRes) _ftMergeEntries(resistMap, armorRes, validTypes);

      // Then explicit grants flag (modules + authored content).
      if (grants) {
        _ftMergeEntries(resistMap, grants.resistances,     validTypes);
        _ftMergeEntries(immuneMap, grants.immunities,      validTypes);
        _ftMergeEntries(vulnMap,   grants.vulnerabilities, validTypes);
        for (const c of (grants.conditionImmunities ?? [])) {
          const k = String(c ?? "").toLowerCase();
          if (validConds.has(k)) condImmunes.add(k);
        }
      }
    }
  }

  // Immunity shadows resistance and vulnerability on the same (type, flavor).
  // A broader type-only immunity shadows any flavor variant of that type too.
  const hasTypeOnlyImmune = new Set([...immuneMap.values()].filter(e => !e.flavor).map(e => e.type));
  for (const [key, e] of [...resistMap.entries()]) {
    if (immuneMap.has(key) || hasTypeOnlyImmune.has(e.type)) resistMap.delete(key);
  }
  for (const [key, e] of [...vulnMap.entries()]) {
    if (immuneMap.has(key) || hasTypeOnlyImmune.has(e.type)) vulnMap.delete(key);
  }

  return {
    resistances:        [...resistMap.values()],
    immunities:         [...immuneMap.values()],
    vulnerabilities:    [...vulnMap.values()],
    conditionImmunities: [...condImmunes]
  };
}

// Given a damage hit (type + optional flavor) and an entry list, return whether
// any entry matches. An entry with flavor=null matches the type broadly; an
// entry with flavor set requires the hit's flavor to match.
function ftDefenseMatches(entries, hitType, hitFlavor) {
  if (!Array.isArray(entries) || !hitType) return false;
  const t = String(hitType).toLowerCase();
  const f = hitFlavor ? String(hitFlavor).toLowerCase() : "";
  for (const e of entries) {
    if (!e || e.type !== t) continue;
    if (!e.flavor) return true;         // type-only entry always matches
    if (e.flavor === f) return true;    // flavor match
  }
  return false;
}

// ─── Consume engine ───────────────────────────────────────────────────────────
// Reads `flags.fourththing.rfi.item.consume` on an item and applies its effects
// to the actor: track adjustments (heal/damage/clarify/etc.), condition removal,
// charge decrement (with auto-delete at 0), and a chat receipt.
//
// consume shape:
//   { effects: [
//       { kind:"track", track:"integrity", op:"add",      formula:"1d6+1" },
//       { kind:"track", track:"stress",    op:"subtract", delta:2 },
//       { kind:"condition", op:"remove",   condition:"poisoned" }
//     ],
//     decrement: true   // -1 charge after consume
//   }
const FT_TRACK_PATHS = {
  integrity:  { path: "system.derived.integrity.value",      max: "system.derived.integrity.max",  floor: 0 },
  stress:     { path: "system.derived.stress.value",         max: "system.derived.stress.max",     floor: 0 },
  clarity:    { path: "system.magic.clarity.value",          max: "system.magic.clarity.max",      floor: 0 },
  noise:      { path: "system.magic.noise.value",            max: "system.magic.noise.max",        floor: 0 },
  radiation:  { path: "system.radiation.rp",                 max: null,                            floor: 0 },
  burn:       { path: "system.resources.burn.current",       max: "system.resources.burn.max",     floor: 0 },
  bloodDebt:  { path: "system.bloodDebt.value",              max: null,                            floor: 0 },
  frameDice:  { path: "system.resources.frameDice.current",  max: "system.resources.frameDice.max", floor: 0 },
  accessDice: { path: "system.resources.accessDice.current", max: "system.resources.accessDice.max", floor: 0 },
  ruin:       { path: "system.resources.ruinCharges.current",max: "system.resources.ruinCharges.max", floor: 0 }
};

async function _ftResolveAmount(actor, eff) {
  if (Number.isFinite(eff.delta)) return { amount: Number(eff.delta), rolled: null };
  if (eff.formula) {
    const roll = new Roll(String(eff.formula));
    await roll.evaluate();
    return { amount: roll.total, rolled: roll };
  }
  return { amount: 0, rolled: null };
}

async function runConsumeEffects(actor, item, consume) {
  if (!actor || !item || !consume) return;
  const updates = {};
  const summary = [];
  const allRolls = [];

  for (const eff of (consume.effects ?? [])) {
    if (eff.kind === "track") {
      const spec = FT_TRACK_PATHS[eff.track];
      if (!spec) { summary.push(`<li>unknown track: ${eff.track}</li>`); continue; }
      const cur  = Number(foundry.utils.getProperty(actor, spec.path) ?? 0);
      let max    = spec.max ? Number(foundry.utils.getProperty(actor, spec.max) ?? 0) : null;
      const { amount, rolled } = await _ftResolveAmount(actor, eff);
      if (rolled) allRolls.push(rolled);
      let next = cur;
      if (eff.op === "add")        next = cur + amount;
      else if (eff.op === "subtract") next = cur - amount;
      else if (eff.op === "set")   next = amount;
      else if (eff.op === "setMax" && max !== null) next = max;
      // Clamp.
      if (Number.isFinite(spec.floor)) next = Math.max(spec.floor, next);
      if (max !== null) next = Math.min(max, next);
      updates[spec.path] = next;
      const arrow = next === cur ? "·" : (next > cur ? "↑" : "↓");
      const formulaTag = rolled ? ` (${eff.formula} → ${rolled.total})` : "";
      summary.push(`<li><b>${eff.track}</b>${formulaTag}: ${cur} ${arrow} ${next}</li>`);
    } else if (eff.kind === "condition") {
      if (eff.op === "remove") {
        const key = String(eff.condition || "").toLowerCase();
        if (!key) continue;
        updates[`system.conditions.${key}`] = false;
        summary.push(`<li>condition cleared: <b>${key}</b></li>`);
      }
    }
  }

  if (Object.keys(updates).length) await actor.update(updates);

  // Charge bookkeeping — decrement and delete-at-0.
  let chargeNote = "";
  if (consume.decrement !== false) {
    const charges = Number(item.getFlag("fourththing", "rfi.item.charges") ?? 1);
    const nextCharges = Math.max(0, charges - 1);
    if (nextCharges <= 0) {
      await item.delete();
      chargeNote = " (consumed — last charge)";
    } else {
      await item.setFlag("fourththing", "rfi.item.charges", nextCharges);
      chargeNote = ` (${nextCharges} charge${nextCharges === 1 ? "" : "s"} remaining)`;
    }
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fourththing-roll ft-magic-roll">
                <div class="ft-misfire-box standalone" style="border-color:#5fb35f">
                  <span class="ft-misfire-label">🧪 ${item.name}${chargeNote}</span>
                  <ul class="ft-consume-list" style="margin:0.2rem 0 0 1.2rem;padding:0">${summary.join("")}</ul>
                </div></div>`
  });
  return { ok: true, updates, item: item.id };
}

// ─── Forge dialog (Crafting UI) ───────────────────────────────────────────────
// Lists every recipe across the world + visible compendia, marks which are
// craftable from the actor's current materials, lets the player click to forge.
async function openForgeDialog(actor) {
  if (!actor) return;
  const all = await RfiCrafting.recipesAvailable(actor, { includeMissing: true });
  const inv = RfiCrafting.inventory(actor);

  const tierPalette = { I: "#7aa9d4", II: "#5fb35f", III: "#d4a35f", IV: "#d46a6a" };
  const rows = all.map(({ item, ok, missing, recipe, difficulty }) => {
    const matCells = recipe.map(r => {
      const have = inv[r.key] || 0;
      const cls  = have >= r.qty ? "ok" : "low";
      return `<span class="forge-mat forge-mat-${cls}" title="${r.key}">${r.key} ${have}/${r.qty}</span>`;
    }).join(" ");
    const tierBadge = `<span class="forge-tier" style="background:${tierPalette[difficulty.tier] ?? "#888"}">T${difficulty.tier}</span>`;
    const btn = ok
      ? `<button type="button" class="forge-craft-btn" data-uuid="${item.uuid}">Forge</button>`
      : `<button type="button" class="forge-craft-btn" disabled title="Missing materials">—</button>`;
    return `<tr class="forge-row${ok ? "" : " forge-row-low"}">
              <td>${tierBadge}</td>
              <td class="forge-name"><a class="forge-open" data-uuid="${item.uuid}">${item.name}</a></td>
              <td class="forge-dc">DC ${difficulty.dc}<br><span class="forge-skill">${difficulty.skill}</span></td>
              <td class="forge-mats">${matCells}</td>
              <td class="forge-act">${btn}</td>
            </tr>`;
  }).join("");

  const invSummary = Object.entries(inv).sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([k, n]) => `<span class="forge-inv-pill">${k} ×${n}</span>`).join(" ") || "<i>no materials on hand</i>";

  const html = `
    <div class="ft-forge-dialog">
      <div class="forge-inv-row"><b>Materials:</b> ${invSummary}</div>
      <table class="forge-table">
        <thead><tr>
          <th>Tier</th><th>Recipe</th><th>DC</th><th>Materials</th><th></th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="5"><i>No recipes found in available libraries.</i></td></tr>`}</tbody>
      </table>
    </div>`;

  const dlg = new Dialog({
    title: `Forge — ${actor.name}`,
    content: html,
    buttons: { close: { label: "Close" } },
    default: "close",
    render: ($html) => {
      const root = $html?.[0] ?? $html;
      root.querySelectorAll?.(".forge-craft-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (btn.disabled) return;
          const uuid = btn.dataset.uuid;
          const item = await fromUuid(uuid);
          if (!item) return;
          btn.disabled = true;
          await RfiCrafting.tryCraft(actor, item);
          // Re-open to refresh inventory.
          dlg.close();
          openForgeDialog(actor);
        });
      });
      root.querySelectorAll?.(".forge-open").forEach(a => {
        a.addEventListener("click", async (ev) => {
          ev.preventDefault();
          const item = await fromUuid(a.dataset.uuid);
          if (item?.sheet) item.sheet.render(true);
        });
      });
    }
  }, { width: 720, height: 600, resizable: true });
  dlg.render(true);
}

// ─── Gather dialog (Harvest UI) ───────────────────────────────────────────────
async function openGatherDialog(actor) {
  if (!actor) return;
  const scene = canvas?.scene ?? game.scenes?.current;
  const nodes = RfiHarvest.scanScene(scene);
  const live  = nodes.filter(n => Number(n.harvest.charges ?? 0) > 0);

  const tierPalette = { I: "#7aa9d4", II: "#5fb35f", III: "#d4a35f", IV: "#d46a6a" };
  const rows = nodes.map(({ doc, harvest, name }, idx) => {
    const charges = Number(harvest.charges ?? 0);
    const tier    = harvest.tier ?? "I";
    const tierBadge = `<span class="forge-tier" style="background:${tierPalette[tier] ?? "#888"}">T${tier}</span>`;
    const status = charges <= 0 ? "depleted" : `${charges} left`;
    const btn = charges > 0
      ? `<button type="button" class="forge-craft-btn gather-btn" data-doc-id="${doc.id}" data-doc-type="${doc.documentName}">Gather</button>`
      : `<button type="button" class="forge-craft-btn" disabled>—</button>`;
    return `<tr class="forge-row${charges > 0 ? "" : " forge-row-low"}">
              <td>${tierBadge}</td>
              <td class="forge-name">${name}</td>
              <td class="forge-dc">DC ${harvest.dc ?? 12}<br><span class="forge-skill">${harvest.skill ?? "soul"}</span></td>
              <td class="forge-mats"><span class="forge-mat forge-mat-${charges > 0 ? "ok" : "low"}">${status}</span></td>
              <td class="forge-act">${btn}</td>
            </tr>`;
  }).join("");

  const empty = nodes.length === 0
    ? `<tr><td colspan="5"><i>No harvest nodes in this scene. A GM marks them with the Mark Harvest Node macro.</i></td></tr>`
    : "";

  const html = `
    <div class="ft-forge-dialog">
      <div class="forge-inv-row"><b>Scene:</b> ${scene?.name ?? "—"} · <b>${live.length}</b> active node${live.length === 1 ? "" : "s"} of ${nodes.length}</div>
      <table class="forge-table">
        <thead><tr>
          <th>Tier</th><th>Node</th><th>DC</th><th>Charges</th><th></th>
        </tr></thead>
        <tbody>${rows}${empty}</tbody>
      </table>
    </div>`;

  const dlg = new Dialog({
    title: `Gather — ${actor.name}`,
    content: html,
    buttons: { close: { label: "Close" } },
    default: "close",
    render: ($html) => {
      const root = $html?.[0] ?? $html;
      root.querySelectorAll?.(".gather-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (btn.disabled) return;
          const docId   = btn.dataset.docId;
          const docType = btn.dataset.docType;
          const sourceDoc = (docType === "Tile")
            ? scene.tiles.get(docId)
            : (docType === "Token") ? scene.tokens.get(docId) : null;
          if (!sourceDoc) return;
          btn.disabled = true;
          await RfiHarvest.attempt(actor, sourceDoc);
          dlg.close();
          openGatherDialog(actor);
        });
      });
    }
  }, { width: 720, height: 540, resizable: true });
  dlg.render(true);
}

function ftComputeArmorBonus(actor, sys) {
  const result = { guard: 0, evasion: 0, resolve: 0, breakdown: [] };
  if (!actor?.items) return result;

  for (const item of actor.items) {
    if (item.type !== "armor") continue;
    const a = item.system ?? {};
    if (a.equipped === false) continue;

    const skillKey = a.armorSkill && FT.ARMOR_SKILLS.includes(a.armorSkill)
      ? a.armorSkill
      : "weave"; // default per Appendix A: light/med → weave
    const rank = sys?.skills?.[skillKey]?.value ?? 0;
    const scale = FT.ARMOR_RANK_SCALE[rank] ?? FT.ARMOR_RANK_SCALE[0];

    // Round (not floor) so +1 armor at Trained (mult 0.5) still grants +1
    // instead of silently zeroing. Half-bonuses canon preserved: +1→+1, +2→+1,
    // +3→+2, +4→+2 at Trained; full bonuses at Proficient and above.
    const g = Math.round((a.guardBonus   ?? 0) * scale.mult) + (a.guardBonus   > 0 ? scale.flat : 0);
    const e = Math.round((a.evasionBonus ?? 0) * scale.mult) + (a.evasionBonus > 0 ? scale.flat : 0);
    const r = Math.round((a.resolveBonus ?? 0) * scale.mult) + (a.resolveBonus > 0 ? scale.flat : 0);

    result.guard   += g;
    result.evasion += e;
    result.resolve += r;
    result.breakdown.push({
      item:   item.name,
      skill:  skillKey,
      rank,
      guard: g, evasion: e, resolve: r
    });
  }
  return result;
}

// ─── Chat HTML builders ───────────────────────────────────────────────────────


function buildMagicChatHTML({ label, intent, channel, sephirah, attrIntent, attrChannel,
                               clarity, noise, alignMod, total, difficulty, success,
                               misfireData, diceResults, terrainLabel,
                               explosionDice = [], surgeBanked = 0, doubleTen = false,
                               costNote = "", signature = "", thirdThing = "" }) {
  const sephData = FT.SEPHIROTH[sephirah] ?? { label: sephirah, color: "#888" };
  const ic = FT.INTENT_COLORS[intent]   ?? "#888";
  const cc = FT.CHANNEL_COLORS[channel] ?? "#888";

  const diceRow = diceResults.map(d =>
    `<span class="ft-die${d.result >= 8 ? " ft-die-high" : d.result <= 2 ? " ft-die-low" : ""}">${d.result}</span>`
  ).join("");
  // Surge / Act-Again surfacing — same shape as Engage card.
  const explodeTail = explosionDice.length
    ? ` <span style="color:#e8c84a;font-weight:600">!→${explosionDice.join("+")}</span>`
    : "";
  const surgeTail = surgeBanked
    ? ` <span style="color:#e8c84a;font-weight:600">+${surgeBanked} Surge banked</span>`
    : "";
  const dblTenTail = doubleTen
    ? ` <span style="color:#4a90d9;font-weight:600">· Double-10 — Act Again</span>`
    : "";
  const critRow = (explosionDice.length || doubleTen)
    ? `<p style="font-size:0.74rem;opacity:0.85;margin:0.25rem 0 0">Dice:${explodeTail}${surgeTail}${dblTenTail}</p>`
    : "";

  const misfireBlock = misfireData ? `
    <div class="ft-misfire-box">
      <span class="ft-misfire-label">⚡ Misfire ${misfireData.rolled} — ${misfireData.name}</span>
      <p class="ft-misfire-desc">${misfireData.desc}</p>
    </div>` : "";

  const terrainPill = terrainLabel
    ? `<span class="ft-terrain-pill">⬡ ${terrainLabel}</span>`
    : "";

  const metaBlock = (costNote || signature || thirdThing) ? `
    <div class="ft-manifest-chat-meta">
      ${costNote ? `<div><b>Cost:</b> ${ftEscapeHtml(costNote)}</div>` : ""}
      ${signature ? `<div><b>Signature:</b> ${ftEscapeHtml(signature)}</div>` : ""}
      ${thirdThing ? `<div><b>Third Thing:</b> ${ftEscapeHtml(thirdThing)}</div>` : ""}
    </div>` : "";

  return `
<div class="fourththing-roll ft-magic-roll">
  <div class="ft-roll-header">
    <span class="ft-roll-name">${label}</span>
    <span class="ft-seph-pill" style="background:${sephData.color}22;border-color:${sephData.color}88;color:${sephData.color}">${sephData.label}</span>
    ${terrainPill}
  </div>
  <div class="ft-roll-tags">
    <span class="ft-tag" style="background:${ic}22;border-color:${ic}55;color:${ic}">${ftCap(intent)}</span>
    <span class="ft-tag" style="background:${cc}22;border-color:${cc}55;color:${cc}">${ftCap(channel)}</span>
  </div>
  <div class="ft-formula-row">
    <span class="ft-dice-group">${diceRow}</span>
    <span class="ft-formula-parts">
      <span class="ft-fp" title="${ftCap(intent)}">+${attrIntent}</span>
      <span class="ft-fp" title="${ftCap(channel)}">+${attrChannel}</span>
      <span class="ft-fp ft-clarity" title="Clarity">+${clarity}</span>
      <span class="ft-fp ft-align" title="Alignment">+${alignMod}</span>
      <span class="ft-fp ft-noise" title="Noise">−${noise}</span>
    </span>
  </div>
  <div class="ft-result-row ${success ? "ft-success" : "ft-failure"}">
    <span class="ft-total">${total}</span>
    <span class="ft-vs-dc">vs DC ${difficulty}</span>
    <span class="ft-outcome">${success ? "✦ Success" : "✗ Failed"}</span>
  </div>
  ${critRow}
  ${metaBlock}
  ${misfireBlock}
</div>`;
}

// Manifestation knob tooltips — single source of truth so labels in the cast
// dialog, sheet, and chat cards share the same one-liners. Full reference
// lives in the BBTTCC Documentation > Manifestation Glossary journal.
const FT_KNOB_TIPS = {
  clarity:     "Clarity — focus pool. Spent on cast (T1=1 / T2=2 / T3=3 / T4=5) and per-tick upkeep on sustained manifestations. Max scales with Steward tier (5/7/10/14). Recovers fully on Soma Break, half-fills on Scene Break. TCCs +5 to max; Dreamwalker stacks up to +3 more.",
  reach:       "Reach — casting one tier above your own. Surge: misfire on the higher column. Blood Debt: +1 Blood Debt, no misfire. Two tiers above is rejected. Cosmic Linguist Discipline reduces Blood-Debt-reach cost.",
  misfire:     "Misfire — d10 failure table (1-2 mild → 10 catastrophic). Hermetic shifts d10 −2, Chaos +2, Ascendant skips. Reach pushes the column up by one tier. Wyrdlens Discipline shifts the d10 down (better outcomes).",
  concurrency: "Concurrency — count of sustained / bound / enduring manifestations active at once. No hard cap; soft-capped by Clarity needed to pay each tick's upkeep. Pactkeeper Discipline grants free upkeep slots (first N entries cost 0).",
  noise:       "Noise — metaphysical residue from Chaos-mode casts (+2 per cast). 0–10 pool. Doesn't drop on its own; high Noise feeds Corruption / Intrigue detection / Lattice attention at GM thresholds. Hermetic and Ascendant generate 0 Noise. Scene Break shaves 1.",
  bloodDebt:   "Blood Debt — separate ledger that catches up later. Accrued by Blood-Debt-reach (+1) and Ascendant casts (+1). High Blood Debt has narrative consequences set by the GM.",
  workings:    "Workings vs Forms — Workings (instant) resolve and end. Forms (sustained / bound / enduring) persist and pay upkeep. Only Trad Caster Classes can manifest workings; non-TCCs are restricted to forms.",
  tccDiscount: "TCC discount — Trad Caster Classes pay 1 less Clarity per cast (floor 0). Stacks with mode shifts. Surfaces in the cost note when it fires.",
  lesser:      "Fiat (T0) — TCC-only spoken cue. Must begin with \"Let there be …\". No roll, no resource, no upkeep. The 'I light the candle with a thought' register. Always available.",
  sceneBreak:  "Scene Break — light recovery cadence. Refills Clarity to at least half max (round up), shaves 1 Noise. Universal — anyone can take one between scenes."
};

function buildCastDialogHTML(actor, { intent, channel, sephirah, label, item = null }) {
  const sys      = actor.system?.system ?? actor.system;
  const clarity  = sys.magic?.clarity?.value ?? 3;
  const clarityMax = sys.magic?.clarity?.max ?? 5;
  const noise    = sys.magic?.noise?.value   ?? 0;
  const attrI    = sys.attributes?.[intent]?.value  ?? 0;
  const attrC    = sys.attributes?.[channel]?.value ?? 0;
  const alignMod = ftAlignmentMod(sephirah, intent, channel);
  const nc       = ftNoiseClass(noise);
  const signature = item?.system?.manifestation?.signature ?? "";
  const thirdThing = item?.system?.manifestation?.thirdThing ?? "";

  const mf = item ? ftNormalizeManifestationData(item.system ?? {}, item.type === "weapon" ? "weapon" : "power") : null;
  const stewardTier = Math.max(1, Math.min(4, Number(sys?.details?.tier) || 1));
  const manTier = mf ? Math.max(1, Math.min(4, Number(mf.tier) || 1)) : stewardTier;
  const tierInfo = FT.MANIFESTATION_TIERS[manTier] ?? FT.MANIFESTATION_TIERS[1];
  const baseClarity = tierInfo.clarityCost;
  const opCost = mf?.opCost ?? { pool: "", value: 0 };
  const bloodDebt = Number(sys?.bloodDebt?.value) || 0;
  const reachNeeded = manTier > stewardTier;
  const reachBy = manTier - stewardTier;
  const reachPossible = reachBy === 1; // Canon: reach only one tier above yours.
  const stability = mf?.stability ?? "instant";
  const stabilityLabel = FT.MANIFESTATION_STABILITIES?.[stability]?.label ?? ftCap(stability);

  const mkOpts = (map, current) =>
    Object.entries(map).map(([k, v]) =>
      `<option value="${k}"${k === current ? " selected" : ""}>${v.label}</option>`
    ).join("");

  const modeBlock = `
  <div class="ft-cast-field ft-cast-span-2">
    <label title="${FT_KNOB_TIPS.misfire}">Mode (stance) — affects Clarity, Noise &amp; Misfire</label>
    <div class="ft-mode-row">
      <label class="ft-mode-opt"><input type="radio" name="castMode" value="hermetic" checked/>
        <b>Hermetic</b> <span>+1 Clarity · no Noise · misfire d10 −2 · +1 action setup</span></label>
      <label class="ft-mode-opt"><input type="radio" name="castMode" value="chaos"/>
        <b>Chaos</b> <span>−1 Clarity · +2 Noise · misfire d10 +2 · fast</span></label>
      <label class="ft-mode-opt"><input type="radio" name="castMode" value="ascendant" ${stewardTier < 3 ? "disabled" : ""}/>
        <b>Ascendant</b> <span>+1 Blood Debt (in place of Clarity) · no Noise · no misfire${stewardTier < 3 ? " · <em>T3+ only</em>" : ""}</span></label>
    </div>
  </div>`;

  const reachBlock = reachNeeded ? (reachPossible ? `
  <div class="ft-cast-field ft-cast-span-2 ft-reach-block">
    <label title="${FT_KNOB_TIPS.reach}">Reach — this is <b>T${manTier}</b>, you are <b>T${stewardTier}</b></label>
    <div class="ft-mode-row">
      <label class="ft-mode-opt"><input type="radio" name="reachPath" value="surge" checked/>
        <b>Surge</b> <span>cast at T${manTier}; on failure, misfire rolls on the T${manTier} column</span></label>
      <label class="ft-mode-opt"><input type="radio" name="reachPath" value="bloodDebt" ${bloodDebt >= 0 ? "" : "disabled"}/>
        <b>Blood Debt</b> <span>+1 Blood Debt; clean cast at T${manTier}, no misfire</span></label>
    </div>
  </div>` : `
  <div class="ft-cast-field ft-cast-span-2 ft-reach-block ft-reach-fail">
    <label title="${FT_KNOB_TIPS.reach}">Out of reach</label>
    <p class="ft-prev-align-note" style="color:#ff8a8a">This is T${manTier} — more than one tier above your T${stewardTier}. You cannot reach this far.</p>
  </div>`) : "";

  const opCostNote = (manTier === 4 && opCost?.value > 0)
    ? `<div class="ft-prev-align-note"><b>Faction cost:</b> ${opCost.value} ${ftCap(opCost.pool || "op")} OP</div>`
    : (manTier === 4 ? `<div class="ft-prev-align-note" style="color:#ff8a8a">T4 manifestation has no declared <code>opCost</code>. GM will adjudicate faction cost.</div>` : "");

  // Cosmic Linguist — Resonance Channel section. Only renders when the
  // caster is CL with at least 1 Resonance Die available. Each channel
  // accepts dice (clamped to currently-available pool); aggressive use ticks
  // Strain. Defense-impose + stabilize land as chat-announced GM-applied
  // hooks for now (engine-side wiring is follow-on work).
  // AoE opts (Phase D 2026-05-08). Surfaced only when the manifestation
  // declares an area shape — otherwise the toggles are inert.
  const _hasArea = (() => {
    if (!item?.system) return false;
    const mf = ftNormalizeManifestationData(item.system, item.type === "weapon" ? "weapon" : "power");
    const shape = mf?.area?.shape ?? "none";
    return shape && shape !== "none";
  })();
  const _hasSaveShape = (() => {
    if (!item?.system) return false;
    const mf = ftNormalizeManifestationData(item.system, item.type === "weapon" ? "weapon" : "power");
    return mf?.resolution?.shape === "save";
  })();
  const aoeBlock = _hasArea ? `
  <div class="ft-cast-field ft-cast-span-2 ft-aoe-opts-block" data-tooltip="AoE controls — only visible when the manifestation declares an area shape.">
    ${_hasSaveShape ? `<label style="display:flex;gap:0.5rem;align-items:center;cursor:pointer;color:#a0d4ff;margin-bottom:0.2rem">
      <input type="checkbox" name="useAoeSavePrompts"/>
      <span>⚖ Prompt each target for their save (instead of GM-side rolls)</span>
    </label>` : ""}
    <label style="display:flex;gap:0.5rem;align-items:center;cursor:pointer;color:#a0d8a0">
      <input type="checkbox" name="aoeApplyConfirm"/>
      <span>⚔ Pause before applying AoE damage (Apply All button)</span>
    </label>
  </div>` : "";

  // Wyrdlens Adept — Probability Overlay (Phase C 2026-05-07).
  // 1/round token: rerolls the lowest die on the cast roll. Visible only when
  // the caster has the overlay pool with >0 current. Spent on cast success or
  // fail (the reroll itself is the value — don't refund on miss).
  const overlay = sys?.resources?.probabilityOverlay ?? { current: 0, max: 0 };
  const overlayBlock = (overlay.current > 0) ? `
  <div class="ft-cast-field ft-cast-span-2 ft-wl-overlay-block" data-tooltip="Wyrdlens Adept — Probability Overlay. 1/round: reroll the lowest die on this cast. Refreshes at start of your turn.">
    <label style="display:flex;gap:0.5rem;align-items:center;cursor:pointer;color:#a0c8d8">
      <input type="checkbox" name="wlUseOverlay"/>
      <span>🔭 Probability Overlay (reroll lowest die — ${overlay.current}/${overlay.max} available)</span>
    </label>
  </div>` : "";

  // Dreamwalker — Dream-Cache bank toggle (Phase C 2026-05-07). Banks the
  // manifestation between scenes; deploy from the sheet next scene without
  // paying Clarity. Empty cache only — refuses if cache already holds something.
  const dreamCache = sys?.resources?.dreamCache ?? { banked: false, name: "" };
  const dwClass = actor?.items?.find?.(it => it?.type === "class" && it?.system?.identifier === "dreamwalker");
  const dreamCacheBlock = (dwClass && !dreamCache.banked) ? `
  <div class="ft-cast-field ft-cast-span-2 ft-dw-cache-block" data-tooltip="Dreamwalker — Dream-Cache. Skip the cast and bank this manifestation between scenes; deploy from the sheet next scene without paying Clarity (still pays upkeep).">
    <label style="display:flex;gap:0.5rem;align-items:center;cursor:pointer;color:#c8a0ff">
      <input type="checkbox" name="dwBankToCache"/>
      <span>◯ Bank to Dream-Cache (skip this cast — deploy next scene)</span>
    </label>
  </div>` : "";

  const resonance = sys?.resources?.resonanceDice ?? { current: 0, max: 0 };
  const resonanceBlock = (resonance.current > 0) ? `
  <div class="ft-cast-field ft-cast-span-2 ft-cl-resonance-block" data-tooltip="Cosmic Linguist — Resonance Channels. Each die spent stacks one channel benefit on this cast. Aggressive use ticks Strain (forcing contradiction or misaligned power).">
    <label style="color:#c8c8ff">✦ Resonance Channels — <b>${resonance.current}</b> / ${resonance.max} dice available</label>
    <div class="ft-cast-grid" style="margin-top:0.3rem">
      <div class="ft-cast-field" data-tooltip="+1 to the target's save/contest DC per die spent. Caster's cast roll is unaffected — only the target's resistance bar."><label>+Resolve DC</label><input type="number" name="resResolveDc" value="0" min="0" max="${resonance.current}"/></div>
      <div class="ft-cast-field" data-tooltip="Append +1 damage die per die spent (same die size as the manifestation's damage roll)."><label>+Damage die</label><input type="number" name="resDamageDie" value="0" min="0" max="${resonance.current}"/></div>
      <div class="ft-cast-field" data-tooltip="Bump the appliedStates duration one step per die (1-round → 2-rounds → 3-rounds → scene → until-saved)."><label>+Duration step</label><input type="number" name="resExtendDur" value="0" min="0" max="${resonance.current}"/></div>
      <div class="ft-cast-field" data-tooltip="GM-applied: target rolls 3d10kl2 instead of 2d10x10 on a chosen defense for this cast. Announced in chat — apply at GM table."><label>Defense impose</label><input type="number" name="resDefenseImpose" value="0" min="0" max="${resonance.current}"/></div>
      <div class="ft-cast-field" data-tooltip="GM-applied: this cast is stabilized vs counter/dispel. Announced in chat."><label>Stabilize</label><input type="number" name="resStabilize" value="0" min="0" max="${resonance.current}"/></div>
      <div class="ft-cast-field ft-cast-span-2"><label style="display:flex;gap:0.4rem;align-items:center;cursor:pointer" data-tooltip="Forcing contradiction or misaligned power: +1 Strain on this cast (caps 10).">
        <input type="checkbox" name="resAggressive"/>
        <span>Aggressive (+1 Strain on cast)</span>
      </label></div>
    </div>
  </div>` : "";

  return `
<div class="ft-cast-dialog">
  <div class="ft-cast-header-row">
    <span class="ft-manifest-chip ft-tier-pill ft-tier-${manTier}">T${manTier} · ${tierInfo.label.replace(/^T\d\s/, "")}</span>
    <span class="ft-manifest-chip">${stabilityLabel}</span>
    <span class="ft-manifest-chip" title="${FT_KNOB_TIPS.clarity}">Base ${baseClarity} Clarity</span>
    <span class="ft-manifest-chip ft-footprint">${tierInfo.footprint}</span>
  </div>

  <div class="ft-cast-grid">
    ${modeBlock}
    ${reachBlock}
    <div class="ft-cast-field"><label>Intent</label>
      <select name="intent">${mkOpts(FT.INTENTS, intent)}</select></div>
    <div class="ft-cast-field"><label>Channel</label>
      <select name="channel">${mkOpts(FT.CHANNELS, channel)}</select></div>
    <div class="ft-cast-field"><label>Sephirah</label>
      <select name="sephirah">${mkOpts(FT.SEPHIROTH, sephirah)}</select></div>
    <div class="ft-cast-field" data-tooltip="Tier baseline DC: T1 12 · T2 14 · T3 16 · T4 18. Override for GM scene pressure (cover, ritual aids, hostile resonance).">
      <label>Difficulty (DC) <span style="opacity:0.55;font-weight:400;font-size:0.78em">— T${manTier} baseline ${ftTierCastDC(manTier)}</span></label>
      <input type="number" name="difficulty" value="${ftTierCastDC(manTier)}" min="5" max="30"/></div>
    <div class="ft-cast-field" title="Pull the punch by up to your tier. The amount you reduce is banked as a +1d4 Restraint die against the same target on your next roll. Helps avoid Reality Tears.">
      <label>Restraint pull</label>
      <input type="number" name="restraintReduction" value="0" min="0" max="${stewardTier}"/>
    </div>
  </div>

  <div class="ft-cast-preview">
    <div class="ft-preview-stats">
      <span class="ft-prev-stat" title="${FT_KNOB_TIPS.clarity}">
        <span class="ft-prev-label">Clarity</span>
        <span class="ft-prev-val ft-clarity">${clarity} / ${clarityMax}</span>
      </span>
      <span class="ft-prev-stat" title="${FT_KNOB_TIPS.noise}">
        <span class="ft-prev-label">Noise</span>
        <span class="ft-prev-val ${nc}">${noise}</span>
      </span>
      <span class="ft-prev-stat" title="${FT_KNOB_TIPS.bloodDebt}">
        <span class="ft-prev-label">Blood Debt</span>
        <span class="ft-prev-val">${bloodDebt}</span>
      </span>
      <span class="ft-prev-stat">
        <span class="ft-prev-label">Align</span>
        <span class="ft-prev-val ft-align">+${alignMod}</span>
      </span>
    </div>
    <div class="ft-preview-formula">
      2d10 + ${attrI} <em>(${ftCap(intent)})</em>
           + ${attrC} <em>(${ftCap(channel)})</em>
           + ${clarity} <em>(Clarity)</em>
           + ${alignMod} <em>(Align)</em>
           − ${noise} <em>(Noise)</em>
    </div>
  </div>
  ${opCostNote}
  ${aoeBlock}
  ${overlayBlock}
  ${dreamCacheBlock}
  ${resonanceBlock}
  ${(signature || thirdThing) ? `
  <div class="ft-manifest-costbox">
    <div class="ft-prev-label">Identity of the manifestation</div>
    ${signature ? `<div class="ft-prev-align-note"><b>Signature:</b> ${ftEscapeHtml(signature)}</div>` : ""}
    ${thirdThing ? `<div class="ft-prev-align-note"><b>Third Thing:</b> ${ftEscapeHtml(thirdThing)}</div>` : ""}
  </div>` : ""}
</div>`;
}

function buildAttackChatHTML({ label, intent, skill, defense, defenseValue,
                                attrVal, skillVal, total, success,
                                diceResults, damageFormula, damageType,
                                damageFlavor = "",
                                damageFacultyMod = 0, damageBaseFormula = "",
                                explosionDice = [], surgeBanked = 0, doubleTen = false,
                                costNote = "", signature = "", thirdThing = "" }) {
  const ic = FT.INTENT_COLORS[intent] ?? "#888";
  const defData = FT.DEFENSES[defense] ?? { label: defense };
  const diceRow = diceResults.map(d =>
    `<span class="ft-die${d.result >= 8 ? " ft-die-high" : d.result <= 2 ? " ft-die-low" : ""}">${d.result}</span>`
  ).join("");
  // Surge / Act-Again surfacing — only render if a 10 actually exploded or both
  // base dice came up 10. Mirrors the Aptitude-card breakdown line so players
  // get consistent visual feedback across roll paths.
  const explodeTail = explosionDice.length
    ? ` <span style="color:#e8c84a;font-weight:600">!→${explosionDice.join("+")}</span>`
    : "";
  const surgeTail = surgeBanked
    ? ` <span style="color:#e8c84a;font-weight:600">+${surgeBanked} Surge banked</span>`
    : "";
  const dblTenTail = doubleTen
    ? ` <span style="color:#4a90d9;font-weight:600">· Double-10 — Act Again</span>`
    : "";
  const critRow = (explosionDice.length || doubleTen)
    ? `<p style="font-size:0.74rem;opacity:0.85;margin:0.25rem 0 0">Dice:${explodeTail}${surgeTail}${dblTenTail}</p>`
    : "";
  // If a faculty mod was baked into the formula, show the breakdown so the
  // player can see why the damage roll has +5 (or whatever the attribute was).
  const facultyTail = (damageFacultyMod && damageBaseFormula)
    ? ` <span style="opacity:0.7;font-size:0.78rem">(${damageBaseFormula} ${damageFacultyMod >= 0 ? "+" : "−"} ${Math.abs(damageFacultyMod)} ${ftCap(intent)})</span>`
    : "";
  const dmgBlock = damageFormula ? `
    <div class="ft-dmg-row">
      <span class="ft-dmg-label">Damage</span>
      <span class="ft-dmg-formula">${damageFormula}${facultyTail}</span>
      <span class="ft-dmg-type ${damageType ?? ""}">${ftCap(damageType ?? "")}</span>
      <button class="ft-apply-dmg-btn"
              data-formula="${damageFormula}"
              data-damage-type="${damageType ?? ""}"
              data-damage-flavor="${damageFlavor ?? ""}"
              data-track="${FT.DAMAGE_TYPES[damageType]?.track ?? "integrity"}">
        Apply to target
      </button>
    </div>` : "";
  const metaBlock = (costNote || signature || thirdThing) ? `
    <div class="ft-manifest-chat-meta">
      ${costNote ? `<div><b>Cost:</b> ${ftEscapeHtml(costNote)}</div>` : ""}
      ${signature ? `<div><b>Signature:</b> ${ftEscapeHtml(signature)}</div>` : ""}
      ${thirdThing ? `<div><b>Third Thing:</b> ${ftEscapeHtml(thirdThing)}</div>` : ""}
    </div>` : "";
  return `
<div class="fourththing-roll ft-attack-roll">
  <div class="ft-roll-header">
    <span class="ft-roll-name">${label}</span>
    <span class="ft-defense-pill">vs ${defData.label} ${defenseValue}</span>
  </div>
  <div class="ft-roll-tags">
    <span class="ft-tag" style="background:${ic}22;border-color:${ic}55;color:${ic}">${ftCap(intent)}</span>
    <span class="ft-tag ft-skill-tag">${ftCap(skill)}</span>
  </div>
  <div class="ft-formula-row">
    <span class="ft-dice-group">${diceRow}</span>
    <span class="ft-formula-parts">
      <span class="ft-fp" title="${ftCap(intent)}">+${attrVal}</span>
      <span class="ft-fp" title="${ftCap(skill)}">+${skillVal}</span>
    </span>
  </div>
  <div class="ft-result-row ${success ? "ft-success" : "ft-failure"}">
    <span class="ft-total">${total}</span>
    <span class="ft-vs-dc">vs ${defenseValue}</span>
    <span class="ft-outcome">${success ? "✦ Hit" : "✗ Miss"}</span>
  </div>
  ${critRow}
  ${metaBlock}
  ${success ? dmgBlock : ""}
</div>`;
}

function buildAttackDialogHTML(actor, item) {
  const sysData  = actor.system?.system ?? actor.system;
  const skills   = sysData?.skills     ?? {};
  const derived  = sysData?.derived    ?? {};

  // Auto-resolve target context from the user's first targeted token.
  const targetToken = Array.from(game.user?.targets ?? [])[0] ?? null;
  const targetActor = targetToken?.actor ?? null;
  const targetDerived = (targetActor?.system?.system ?? targetActor?.system)?.derived ?? {};
  const targetDefenses = {
    guard:    Number(targetDerived.guard?.value)    || 0,
    evasion:  Number(targetDerived.evasion?.value)  || 0,
    resolve:  Number(targetDerived.resolve?.value)  || 0
  };

  // Phase 3 — flanking. Count same-disposition allies within reach of target;
  // bonus = ally count (so 1 ally → +1, 2 allies → +2). Only applies for
  // melee category — ranged shots don't get the same coordination benefit.
  const isMelee = String(item?.system?.category ?? "").toLowerCase() === "melee";
  const flank = (isMelee && targetActor) ? ftCountFlankers(actor, targetActor) : { count: 0, names: [] };
  const flankBonus = flank.count;

  // Weapon-driven defaults: skill via alias resolver (legacy "ranged"→firearms),
  // intent from authored field, target defense from category (ranged→evasion).
  const intent       = item?.system?.intent ?? "violence";
  const resolvedSkill = ftResolveWeaponSkill(actor, item?.system?.skill, item?.system?.category);
  const preferredDefense = ftWeaponTargetDefense(item);

  // Defense value defaults to target's matching defense if a target is set,
  // else falls back to the attacker's own (legacy behavior, lets you scratch-roll).
  const initialDefVal = targetActor
    ? (targetDefenses[preferredDefense] || derived[preferredDefense]?.value || 14)
    : (derived[preferredDefense]?.value ?? 14);

  // Defense options carry data-target-* so the render hook can live-fill the
  // value field when the user picks a different defense in the dropdown.
  const defOpts = Object.entries(FT.DEFENSES).map(([k, v]) => {
    const ownVal = derived[k]?.value ?? "?";
    const tgtVal = targetActor ? (targetDefenses[k] ?? "?") : null;
    const display = targetActor ? `${v.label} (target ${tgtVal} · self ${ownVal})` : `${v.label} (${ownVal})`;
    const sel = (k === preferredDefense) ? " selected" : "";
    return `<option value="${k}" data-target-val="${tgtVal ?? ""}" data-self-val="${ownVal}"${sel}>${display}</option>`;
  }).join("");
  // 2026-05-13 — NPCs store skills as `{ value: N }` only (no label /
  // attribute per the FT_SKILL_MASTER design at line ~334). Without
  // deriving from the master list, the dropdown shows "undefined" for
  // every NPC skill. Build a lookup once and fall through master → actor
  // entry → kebab-cased key for the label.
  const _ftSkillMasterLookup = (() => {
    const m = {};
    try { for (const s of (FT_SKILL_MASTER || [])) m[s.key] = s.label; } catch (_) {}
    return m;
  })();
  // Union the actor's existing skill keys WITH the master list so the
  // picker always offers every canonical skill, even when the NPC hasn't
  // ranked into it yet (NPCs default to empty `skills: {}`).
  const _ftSkillKeys = new Set([
    ...Object.keys(skills || {}),
    ...((typeof FT_SKILL_MASTER !== "undefined" && Array.isArray(FT_SKILL_MASTER)) ? FT_SKILL_MASTER.map(s => s.key) : [])
  ]);
  const skillOpts = Array.from(_ftSkillKeys).map(k => {
    const v = skills?.[k] ?? {};
    const label = v?.label || _ftSkillMasterLookup[k] || ftCap(String(k).replace(/_/g, " "));
    return `<option value="${k}" ${k === resolvedSkill ? "selected" : ""}>${label}</option>`;
  }).join("");
  const intentOpts = Object.entries(FT.INTENTS).map(([k, v]) =>
    `<option value="${k}" ${k === intent ? "selected" : ""}>${v.label}</option>`
  ).join("");
  const costAssessment = item ? ftAssessManifestationCost(actor, item, "weapon") : null;
  const costBox = item ? buildManifestationCostBoxHTML(costAssessment, { inputName: "applyCost" }) : "";
  const signature = item?.system?.manifestation?.signature ?? "";
  const thirdThing = item?.system?.manifestation?.thirdThing ?? "";
  const stewardTier = Math.max(1, Math.min(4, Number(sysData?.details?.tier) || 1));

  const targetBanner = targetActor
    ? `<div class="ft-prev-align-note" style="margin:0 0 0.5rem;font-size:0.82rem">
         <b>Target:</b> ${ftEscapeHtml(targetActor.name)} —
         G${targetDefenses.guard} · E${targetDefenses.evasion} · R${targetDefenses.resolve}
       </div>`
    : `<div class="ft-prev-align-note" style="margin:0 0 0.5rem;font-size:0.82rem;opacity:0.65">
         <b>Target:</b> none — defense values default to self.
       </div>`;

  const flankBanner = (flankBonus > 0)
    ? `<div class="ft-prev-align-note" style="margin:0 0 0.5rem;font-size:0.82rem;background:rgba(232,200,74,0.08);border-left:3px solid #e8c84a;padding:0.3rem 0.55rem;border-radius:3px">
         <b style="color:#e8c84a">⚔ Flanked: +${flankBonus}</b> — ${flankBonus + 1} melee threats${flank.names.length ? ` (you + ${flank.names.map(n => ftEscapeHtml(n)).join(", ")})` : ""}.
       </div>`
    : "";

  return `
<div class="ft-cast-dialog" data-ft-flank-bonus="${flankBonus}">
  ${targetBanner}
  ${flankBanner}
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Intent</label><select name="intent">${intentOpts}</select></div>
    <div class="ft-cast-field"><label>Skill</label><select name="skill">${skillOpts}</select></div>
    <div class="ft-cast-field"><label>Target defense</label><select name="defense">${defOpts}</select></div>
    <div class="ft-cast-field"><label>Defense value</label>
      <input type="number" name="defenseValue" value="${initialDefVal}" min="5" max="40"/>
    </div>
    <div class="ft-cast-field" title="Pull the punch by up to your tier. The amount you reduce is banked as a +1d4 Restraint die against the same target on your next roll. Helps avoid Reality Tears.">
      <label>Restraint pull</label>
      <input type="number" name="restraintReduction" value="0" min="0" max="${stewardTier}"/>
    </div>
  </div>
  ${costBox}
  ${(signature || thirdThing) ? `
  <div class="ft-manifest-costbox">
    <div class="ft-prev-label">Identity of the manifestation</div>
    ${signature ? `<div class="ft-prev-align-note"><b>Signature:</b> ${ftEscapeHtml(signature)}</div>` : ""}
    ${thirdThing ? `<div class="ft-prev-align-note"><b>Third Thing:</b> ${ftEscapeHtml(thirdThing)}</div>` : ""}
  </div>` : ""}
</div>`;
}

function ftEscapeHtml(value = "") {
  try { return foundry.utils.escapeHTML(String(value ?? "")); }
  catch (_e) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

function ftNormalizeEchoName(value, kind = "crew") {
  let out = String(value ?? "").trim();
  if (!out) return "";
  if (kind === "crew") {
    out = out.replace(/^Crew Type:\s*/i, "");
    out = out.replace(/^Awesome Crew:\s*/i, "");
  } else {
    out = out.replace(/^Occult Association:\s*/i, "");
    out = out.replace(/^Occult:\s*/i, "");
  }
  return out.trim();
}

function ftParseEchoText(value = "", kind = "crew") {
  return Array.from(new Set(String(value ?? "")
    .split(/\r?\n|,/)
    .map(v => ftNormalizeEchoName(v, kind))
    .filter(Boolean)));
}

// Principles tab grouping: classify a feature/feat/class/subclass/race item into
// one of: path | ancestry | identity | other. Used by the Principles tab to
// render features in labeled groups instead of one flat list.
const FT_IDENTITY_CATEGORIES = new Set([
  "character-archetypes", "archetype", "archetypes",
  "sephirothic-alignments", "alignment", "alignments",
  "crew-types", "crew", "occult-associations", "occult",
  "enlightenment-levels", "enlightenment"
]);
const FT_IDENTITY_NAME_RX = /^(Archetype|Alignment|Crew Type|Occult Association|Enlightenment):/i;

function ftClassifyPrinciple(item, {
  className = "",
  ancestryName = "",
  classGrantNames = null,
  ancestryGrantNames = null
} = {}) {
  const type = item?.type;
  if (type === "class" || type === "subclass") return "path";
  if (type === "race") return "ancestry";

  const name = String(item?.name ?? "");
  const identifier = String(item?.system?.identifier ?? "");
  const category = item?.flags?.["bbttcc-character-options"]?.category
    ?? item?.getFlag?.("bbttcc-character-options", "category")
    ?? "";
  const source = item?.flags?.["bbttcc-auto-link"]?.source
    ?? item?.getFlag?.("bbttcc-auto-link", "source")
    ?? "";
  const ftSource = item?.flags?.fourththing?.principleSource
    ?? item?.getFlag?.("fourththing", "principleSource")
    ?? "";

  if (ftSource === "class" || source === "class" || source === "subclass") return "path";
  if (ftSource === "ancestry" || source === "race" || source === "ancestry") return "ancestry";
  if (ftSource === "identity" || source === "identity") return "identity";

  if (FT_IDENTITY_CATEGORIES.has(category)) return "identity";
  if (FT_IDENTITY_NAME_RX.test(name)) return "identity";
  if (identifier.startsWith("archetype-") || identifier.startsWith("alignment-")) return "identity";

  // Match against names actually granted by the actor's class/ancestry advancement
  // (catches features that don't carry a name prefix like "Harmony Marshal: ...").
  const lcName = name.trim().toLowerCase();
  if (classGrantNames?.has?.(lcName)) return "path";
  if (ancestryGrantNames?.has?.(lcName)) return "ancestry";

  if (className) {
    if (name.startsWith(`${className}:`) || name.startsWith(`${className} —`) || name.startsWith(`${className} -`)) return "path";
  }
  if (ancestryName) {
    const shortAncestry = ancestryName.split(/[\s(]/)[0].trim();
    if (name.startsWith(`${ancestryName}:`) || name.startsWith(`${ancestryName} —`)) return "ancestry";
    if (shortAncestry && name.startsWith(`${shortAncestry}:`)) return "ancestry";
  }

  return "other";
}

// Cache of UUID → Set<lowercase item name> built by walking ItemGrant advancements.
// Keyed by class/ancestry doc UUID. Cleared on world close; safe to leave between
// sheet renders — the underlying compendium docs don't change at runtime.
const FT_GRANT_NAME_CACHE = new Map();

async function ftCollectGrantedNames(uuid) {
  if (!uuid) return new Set();
  if (FT_GRANT_NAME_CACHE.has(uuid)) return FT_GRANT_NAME_CACHE.get(uuid);

  const names = new Set();
  try {
    const doc = await fromUuid(uuid);
    if (doc) {
      const advancements = Object.values(doc.system?.advancement ?? {});
      for (const adv of advancements) {
        if (adv.type !== "ItemGrant") continue;
        for (const entry of (adv.configuration?.items ?? [])) {
          try {
            const granted = await fromUuid(entry.uuid);
            const granted_name = String(granted?.name ?? "").trim().toLowerCase();
            if (granted_name) names.add(granted_name);
          } catch (_e) { /* skip missing grant target */ }
        }
      }
    }
  } catch (e) {
    console.warn("Roll for Initiation | ftCollectGrantedNames failed for", uuid, e);
  }

  FT_GRANT_NAME_CACHE.set(uuid, names);
  return names;
}

function buildEchoAssetsManagerHTML(faction, echoAssets = {}, eligible = { crew: [], occult: [] }) {
  const fmt = (arr = []) => Array.isArray(arr) ? arr.join("\n") : "";

  // Pool of every name the steward could have here = current active + reserve
  // + any auto-detected legacy. Dropdown-driven add for easy switching when
  // the steward has multiple crew/occult acquired through play.
  const crewPool = ftUniqueStringsLocal([
    ...(echoAssets.activeCrew ?? []),
    ...(echoAssets.reserveCrew ?? []),
    ...(echoAssets.legacyCrew ?? []),
    ...(eligible.crew ?? [])
  ]);
  const occultPool = ftUniqueStringsLocal([
    ...(echoAssets.activeOccult ?? []),
    ...(echoAssets.reserveOccult ?? []),
    ...(echoAssets.legacyOccult ?? []),
    ...(eligible.occult ?? [])
  ]);

  const opt = (name) => `<option value="${ftEscapeHtml(name)}">${ftEscapeHtml(name)}</option>`;
  const crewOpts   = crewPool.length   ? crewPool.map(opt).join("")   : `<option value="" disabled>No crew detected yet</option>`;
  const occultOpts = occultPool.length ? occultPool.map(opt).join("") : `<option value="" disabled>No occult detected yet</option>`;

  const tier = echoAssets.tier ?? 0;
  const crewLabel   = `Active Crew  ${echoAssets.crewStatusLabel   ?? `${echoAssets.activeCrewCount   ?? 0} / ${echoAssets.crewSlots   ?? 2}`}`;
  const occultLabel = `Active Occult  ${echoAssets.occultStatusLabel ?? `${echoAssets.activeOccultCount ?? 0} / ${echoAssets.occultSlots ?? 2}`}`;

  return `
  <div class="ft-echo-dialog ft-cast-dialog">
    <div class="ft-echo-dialog-note">
      <b>${ftEscapeHtml(faction?.name ?? "Linked Faction")}</b> — Tier <b>T${tier}</b>.
      Crew pool defaults to <b>${echoAssets.defaultCrewSlots ?? 2}</b>, Occult pool defaults to <b>${echoAssets.defaultOccultSlots ?? 2}</b>. Override below if needed.
    </div>
    ${echoAssets.overCapacity ? `<div class="ft-echo-dialog-warning">A pool is currently over capacity. Save is still allowed so you can stage assets while choosing what stays active.</div>` : ""}
    <div class="ft-cast-grid">
      <div class="ft-cast-field"><label>Crew Slots</label><input type="number" name="crewSlots" min="1" max="20" value="${echoAssets.crewSlots ?? 2}"/></div>
      <div class="ft-cast-field"><label>Occult Slots</label><input type="number" name="occultSlots" min="1" max="20" value="${echoAssets.occultSlots ?? 2}"/></div>

      <div class="ft-cast-field ft-cast-span-2">
        <label>${ftEscapeHtml(crewLabel)}</label>
        <div style="display:flex;gap:0.4rem;align-items:flex-start">
          <textarea name="activeCrew" rows="3" placeholder="One per line" style="flex:1">${ftEscapeHtml(fmt(echoAssets.activeCrew))}</textarea>
          <div style="display:flex;flex-direction:column;gap:0.25rem;min-width:11rem">
            <select name="crewPool">${crewOpts}</select>
            <button type="button" data-ft-add="activeCrew">Add → Active</button>
            <button type="button" data-ft-add="reserveCrew">Add → Reserve</button>
          </div>
        </div>
      </div>
      <div class="ft-cast-field ft-cast-span-2">
        <label>Reserve Crew</label>
        <textarea name="reserveCrew" rows="3" placeholder="Known but not currently manifested">${ftEscapeHtml(fmt(echoAssets.reserveCrew))}</textarea>
      </div>

      <div class="ft-cast-field ft-cast-span-2">
        <label>${ftEscapeHtml(occultLabel)}</label>
        <div style="display:flex;gap:0.4rem;align-items:flex-start">
          <textarea name="activeOccult" rows="3" placeholder="One per line" style="flex:1">${ftEscapeHtml(fmt(echoAssets.activeOccult))}</textarea>
          <div style="display:flex;flex-direction:column;gap:0.25rem;min-width:11rem">
            <select name="occultPool">${occultOpts}</select>
            <button type="button" data-ft-add="activeOccult">Add → Active</button>
            <button type="button" data-ft-add="reserveOccult">Add → Reserve</button>
          </div>
        </div>
      </div>
      <div class="ft-cast-field ft-cast-span-2">
        <label>Reserve Occult</label>
        <textarea name="reserveOccult" rows="3" placeholder="Known but not currently manifested">${ftEscapeHtml(fmt(echoAssets.reserveOccult))}</textarea>
      </div>
    </div>
    <p class="ft-echo-dialog-foot">Use the dropdowns to swap between acquired crew/occult. Each pool (Crew, Occult) has its own capacity = Tier + 1.</p>
  </div>`;
}

// Local helper — bbttcc-bridge.js exports ftUniqueStrings but the dialog
// builder only sees module.js's import surface. Tiny dedupe used inline.
function ftUniqueStringsLocal(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(v => String(v ?? "").trim())
    .filter(Boolean)));
}

async function openEchoAssetsManager(actor, sheetApp = null) {
  const faction = getLinkedFaction(actor);
  if (!faction) return ui.notifications?.warn("No linked faction available for this Steward.");

  // Auto-detect + persist crew/occult from the steward before showing the dialog,
  // so the textareas are pre-populated even on the very first open after a
  // faction link is made.
  await ftEnsureEchoAssetsBootstrap(faction, actor);

  const echoAssets = getFactionEchoAssets(faction, actor);

  // Eligible pool for the dropdowns: anything the steward currently has
  // detected on their sheet, even if not currently in active/reserve.
  const eligible = {
    crew:   echoAssets.legacyCrew   ?? [],
    occult: echoAssets.legacyOccult ?? []
  };

  new Dialog({
    title: `Echo Assets — ${faction.name}`,
    content: buildEchoAssetsManagerHTML(faction, echoAssets, eligible),
    render: (html) => {
      // Dropdown-driven add: select an eligible name, click "Add → Active"
      // or "Add → Reserve" to append it to the corresponding textarea.
      const $html = html instanceof HTMLElement ? $(html) : html;
      $html.find("[data-ft-add]").on("click", (ev) => {
        ev.preventDefault();
        const targetName = ev.currentTarget.dataset.ftAdd;
        const isCrew = /Crew/i.test(targetName);
        const $select = $html.find(`[name='${isCrew ? "crewPool" : "occultPool"}']`);
        const value = String($select.val() ?? "").trim();
        if (!value) return;
        const $ta = $html.find(`[name='${targetName}']`);
        const lines = String($ta.val() ?? "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (lines.includes(value)) return;
        lines.push(value);
        $ta.val(lines.join("\n"));
      });
    },
    buttons: {
      save: {
        icon: "<i class='fas fa-users-cog'></i>",
        label: "Save",
        callback: async (html) => {
          const read = (name) => html.find(`[name='${name}']`).val() ?? "";

          const activeCrew = ftParseEchoText(read("activeCrew"), "crew");
          const reserveCrew = ftParseEchoText(read("reserveCrew"), "crew").filter(v => !activeCrew.includes(v));
          const activeOccult = ftParseEchoText(read("activeOccult"), "occult");
          const reserveOccult = ftParseEchoText(read("reserveOccult"), "occult").filter(v => !activeOccult.includes(v));

          const crewSlotsRaw   = Number(read("crewSlots"));
          const occultSlotsRaw = Number(read("occultSlots"));
          const crewSlots   = Number.isFinite(crewSlotsRaw)   && crewSlotsRaw   > 0 ? Math.max(1, Math.floor(crewSlotsRaw))   : (echoAssets.defaultCrewSlots   ?? 2);
          const occultSlots = Number.isFinite(occultSlotsRaw) && occultSlotsRaw > 0 ? Math.max(1, Math.floor(occultSlotsRaw)) : (echoAssets.defaultOccultSlots ?? 2);

          const payload = {
            crewSlots,
            occultSlots,
            activeCrew,
            reserveCrew,
            activeOccult,
            reserveOccult,
            updatedTs: Date.now(),
            stewardId: actor.id,
            stewardName: actor.name
          };

          await faction.update({
            "flags.fourththing.echoAssets": payload
          });

          const crewOver   = activeCrew.length   > crewSlots;
          const occultOver = activeOccult.length > occultSlots;
          if (crewOver || occultOver) {
            ui.notifications?.warn(`${faction.name}: saved Echo assets — Crew ${activeCrew.length}/${crewSlots}, Occult ${activeOccult.length}/${occultSlots} (over capacity).`);
          } else {
            ui.notifications?.info(`${faction.name}: Echo assets updated — Crew ${activeCrew.length}/${crewSlots}, Occult ${activeOccult.length}/${occultSlots}.`);
          }
          sheetApp?.render?.(true);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "save"
  }).render(true);
}

// ─── Foundry init ──────────────────────────────────────────────────────────────

Hooks.once("init", function () {
  console.log("Roll for Initiation | Initializing v0.4.0 — Foundation Refactor");

  // BBTTCC Display font — registered so it appears in Foundry's font dropdowns
  // (Drawings, Scene text, journal rich-text editor). CSS usage is also wired
  // via @font-face in styles/fourththing.css for system UI.
  try {
    CONFIG.fontDefinitions ??= {};
    CONFIG.fontDefinitions["BBTTCC Display"] = {
      editor: true,
      fonts: [{
        urls: [
          "systems/fourththing/fonts/bbttcc-display/BBTTCC-Display.woff2",
          "systems/fourththing/fonts/bbttcc-display/BBTTCC-Display.woff",
          "systems/fourththing/fonts/bbttcc-display/BBTTCC-Display.ttf"
        ],
        weight: 700,
        style: "normal"
      }]
    };
  } catch (e) {
    console.warn("Roll for Initiation | BBTTCC Display font registration failed", e);
  }

  game.fourththing = foundry.utils.mergeObject(game.fourththing ?? {}, {
    rolls: {},
    constants: FT,
    items:   RfiItems,
    craft:   RfiCrafting,
    harvest: RfiHarvest,
    // Engine helpers exposed for tools macros + cross-module callers
    collectRerolls,
    applyRerollGrants,
    collectResourceGrants,
    fireResourceGrants,
    collectTriggers,
    fireTriggers,
    getAlignmentModifier: ftAlignmentMod,
    echoAssets: {
      get: (actorOrId) => {
        const actor = typeof actorOrId === "string" ? game.actors?.get(actorOrId) : actorOrId;
        if (!actor) return null;
        const faction = getLinkedFaction(actor);
        return getFactionEchoAssets(faction, actor);
      },
      openManager: async (actorOrId) => {
        const actor = typeof actorOrId === "string" ? game.actors?.get(actorOrId) : actorOrId;
        if (!actor) return null;
        return openEchoAssetsManager(actor);
      }
    },
    _syncAuraEffects: syncAuraEffects,
    _progression: {
      tierForLevel,
      deriveItemUnlockLevel,
      applyPathFeatures,
      applySkillGrantsFromFeatures,
      extractSkillGrantsFromFeature,
      promoteStampedAptitudeAEs,
      levelUp
    },
    _classAutomation: {
      dispatchFeatureAction,
      isActionableFeature,
      openSpendFrameDie, openFrameDiePool,
      openAurabladeAction, openChangeAura, openStabilizeBurn, openBurnState,
      openSpendAccessDie, openAccessPool,
      openBreakerRuin, openDreamwalkerResonance, openDreamwalkerDeployCache, openDreamwalkerEchoReservoir, openDreamwalkerSpendEchoDie, openSoulSmithForge, openPassiveClassInfo,
      // Sprint F
      openBulwarkSpendFrame, openBulwarkFramePool, openBulwarkRuin, openBulwarkStance,
      openShadowCourierPackage, openShadowCourierCrossing, openShadowCourierPassive,
      openCosmicLinguistAuthority, openCosmicLinguistAnnotation,
      openPactkeeperLeverage, openPactkeeperBindingClause, openPactkeeperPrecedent,
      openPactkeeperCivicCharge, openPactkeeperSpendCivicCharge, openPactkeeperPressure, openPactkeeperBindSubject,
      openCounterManifestation,
      // Buried per-use Phase 1 — Ancestry cores
      openMenhirkinHexRecognition, openEchoDiverTemporalFlinch,
      openSephirotScionAttunement, openQliphScarredSaturation,
      // Buried per-use Phase 2 — Heritage-unique + ancestry feats
      openMenhirkinIgneousPicker, openMenhirkinIgneousHeatMemory,
      openOldenbornRustlandPatch, openFurrykinPredatorPatience,
      openOldenbornPhoenixOath, openOldenbornHearthDominion,
      openOldenbornSunScar,
      // Buried per-use Phase 3 — Species multi-ability pickers
      openCircuitbornAbilities, openCircuitbornAttentionResonance,
      openCircuitbornGlitchSurge,
      openHumanAbilities, openHumanAdaptive, openHumanTenacious,
      openStormbornWardOfTheGale,
      // Buried per-use Phase 4 — Character options
      openCharOptAbility,
      // Action-economy audit pass 2026-05-04 — exposed for the tools macro
      CHAR_OPT_ABILITIES,
      FEATURE_ROUTER
    }
  });

  // Reset legendary skill use on scene change
  Hooks.on("canvasReady", () => {
    const { resetLegendaryOnSceneChange } = game.fourththing._progression ?? {};
    if (resetLegendaryOnSceneChange) resetLegendaryOnSceneChange();
  });

  // Register abilities config so BBTTCC Character Wizard reads our attributes
  // instead of falling back to D&D5E defaults.
  const rfiConfig = {
    abilities: {
      violence: { label: "Violence", abbreviation: "VIO", type: "physical" },
      intrigue:  { label: "Intrigue",  abbreviation: "INT", type: "physical" },
      presence:  { label: "Presence",  abbreviation: "PRE", type: "social"   },
      body:      { label: "Body",      abbreviation: "BOD", type: "physical" },
      mind:      { label: "Mind",      abbreviation: "MND", type: "mental"   },
      soul:      { label: "Soul",      abbreviation: "SOL", type: "spiritual"}
    }
  };
  CONFIG.fourththing = rfiConfig;
  CONFIG["fourththing"] = rfiConfig;
  CONFIG["roll-for-initiation"] = rfiConfig;
  game.rollForInitiation = game.fourththing;
  // Point game.system.config at our config so BBTTCC can read it
  if (!game.system.config) {
    Object.defineProperty(game.system, "config", {
      get: () => CONFIG["fourththing"] ?? CONFIG.fourththing,
      configurable: true
    });
  }

  // ── Pre-load partials (AppV2 doesn't auto-register these) ─────────────────
  (foundry.applications.handlebars.loadTemplates ?? loadTemplates)([
    "systems/fourththing/templates/partials/inventory-list.hbs",
    "systems/fourththing/templates/partials/powers-list.hbs",
    "systems/fourththing/templates/partials/item-effects.hbs",
    "systems/fourththing/templates/items/weapon-sheet.hbs",
  ]);

  // ── Sheet tooltip lookups ───────────────────────────────────────────────────
  // Single source of truth for hover-help text on the steward sheet.
  // Keep mechanics-first, one short fiction beat. Used by ftFacultyTip /
  // ftPoolTip / ftDefenseTip / ftAptColTip helpers below.
  globalThis.FT_FACULTY_TIPS = {
    violence:  "Violence — raw force, pressure, willingness to harm. Drives Brawl, Aim, melee aptitudes; feeds Guard (10 + Violence + Body + armor).",
    intrigue:  "Intrigue — guile, finesse, working the angle. Drives Stealth, Sleight, Weave armor; feeds Evasion (10 + Intrigue + Body + armor).",
    presence:  "Presence — bearing, voice, weight in a room. Drives Diplomacy, Intimidation, Performance; feeds Resolve (10 + Presence + Soul + armor).",
    body:      "Body — stamina and structure. Drives Athletics, Plating armor. Feeds Integrity max (10 + 3·Body + per-level bracket) AND contributes to both Guard and Evasion.",
    mind:      "Mind — memory, reason, pattern-finding. Drives Lore, Insight, Tech. Feeds Stress max (10 + 2·Mind + Soul).",
    soul:      "Soul — conviction, attunement, the shape of your faith. Drives Occult, Faith, Warding armor. Feeds Stress max and Resolve."
  };
  globalThis.FT_POOL_TIPS = {
    integrity: "Integrity — your physical track. Reduced by kinetic, energy, poison, and sephirotic damage. Max = 10 + 3·Body + per-level bracket (vanguard 4 / mid 3 / caster 2 + ⌊Body/2⌋). Refills on Soma Break.",
    stress:    "Stress — your mental/spiritual track. Reduced by psychic and qliphothic damage. Max = 10 + 2·Mind + Soul. Refills on Soma Break."
  };
  globalThis.FT_DEFENSE_TIPS = {
    guard:   "Guard — defense vs. brute-force/melee strikes. 10 + Violence + Body + equipped armor. Higher Guard makes head-on hits glance off.",
    evasion: "Evasion — defense vs. ranged shots, traps, area effects. 10 + Intrigue + Body + equipped armor. Higher Evasion means you weren't standing where they aimed.",
    resolve: "Resolve — defense vs. social, mental, manifestation pressure. 10 + Presence + Soul + equipped armor. Targeted by psychic, qliphothic, and most influence rolls."
  };
  globalThis.FT_APT_COLUMN_TIPS = {
    name:    "Aptitude — what you're rolling. Hover the name to see its canonical label; the colored tag is your rank tier.",
    attr:    "Faculty — the attribute added to this aptitude's roll. Each aptitude is keyed to one Faculty.",
    rank:    "Rank pips (0–5). Click to set: 0 Untrained · 1 Trained (no fumble) · 2 Proficient (reroll lowest) · 3 Expert (floor 4) · 4 Master (3d10 drop lowest) · 5 Legendary (1/scene auto-succeed).",
    ae:      "Active Effect bonus — flat bonus from items, manifestations, or conditions currently affecting this aptitude.",
    total:   "Total bonus added to this aptitude's 2d10. Total = Faculty + Rank + AE."
  };

  // ── Handlebars helpers ──────────────────────────────────────────────────────
  Handlebars.registerHelper("ftCap",        str    => ftCap(str));
  Handlebars.registerHelper("ftSephColor",  key    => FT.SEPHIROTH[key]?.color  ?? "#888");
  Handlebars.registerHelper("ftSephLabel",  key    => FT.SEPHIROTH[key]?.label  ?? key);
  Handlebars.registerHelper("ftSephDomain", key    => FT.SEPHIROTH[key]?.domain ?? "");
  Handlebars.registerHelper("ftNoiseClass", n      => ftNoiseClass(n));
  // Tooltip lookups for sheet labels — single source of truth
  Handlebars.registerHelper("ftFacultyTip", key => FT_FACULTY_TIPS[key] ?? "");
  Handlebars.registerHelper("ftPoolTip",    key => FT_POOL_TIPS[key]    ?? "");
  Handlebars.registerHelper("ftDefenseTip", key => FT_DEFENSE_TIPS[key] ?? "");
  Handlebars.registerHelper("ftAptColTip",  key => FT_APT_COLUMN_TIPS[key] ?? "");
  // Fallback comparison/math helpers (some Foundry builds omit these)
  Handlebars.registerHelper("gte",          (a, b) => a >= b);
  Handlebars.registerHelper("lte",          (a, b) => a <= b);
  Handlebars.registerHelper("eq",           (a, b) => a === b);
  Handlebars.registerHelper("multiply",     (a, b) => a * b);
  // Sprint D: translate feature description HTML from 5E terms → FT terms
  Handlebars.registerHelper("ftTranslate",  html => new Handlebars.SafeString(ftTranslate(html ?? "")));
  // Utility helpers for resource pip tracks
  Handlebars.registerHelper("times", (n) => Array.from({length: Math.max(0, n ?? 0)}, (_, i) => i));
  Handlebars.registerHelper("add",  (a, b) => (a ?? 0) + (b ?? 0));
  Handlebars.registerHelper("sub",  (a, b) => (a ?? 0) - (b ?? 0));
  Handlebars.registerHelper("or",   (a, b) => a ?? b);

  // Fix sheet title bar — "TYPES.Actor.character" → readable label
  game.i18n.translations["TYPES.Actor.character"] = "Steward";
  game.i18n.translations["TYPES.Actor.npc"]       = "Figure";
  game.i18n.translations["TYPES.Item.power"]      = "Manifestation";
  game.i18n.translations["TYPES.Item.weapon"]     = "Manifestation Form";
  game.i18n.translations["TYPES.Item.feature"]    = "Principle";
  game.i18n.translations["TYPES.Item.feat"]       = "Technique";
  game.i18n.translations["TYPES.Item.class"]      = "Path";
  game.i18n.translations["TYPES.Item.subclass"]   = "Doctrine";
  game.i18n.translations["TYPES.Item.race"]       = "Ancestry";

  // ── Reality Tear / Overshoot — settings ──────────────────────────────────
  // Bands fire when total exceeds DC by 20+. Cosmetic at +20, mechanical from
  // +30 up. Tier gate keeps peer-on-peer rolls quiet — the ground only creaks
  // when a higher-tier actor punches down on a lower-tier target.
  game.settings.register("fourththing", "overshootEnabled", {
    name: "Reality Tear — enable Overshoot",
    hint: "When a roll exceeds its DC by 20+, generate cosmetic ripples / mechanical tears scaling with overshoot.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register("fourththing", "overshootTierGate", {
    name: "Reality Tear — tier gate",
    hint: "Only fire when the actor's tier ≥ the target's tier. Peer rolls stay quiet.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register("fourththing", "overshootSkillChecks", {
    name: "Reality Tear — skill checks",
    hint: "Generic checks have no target tier. Off = never tear on skill checks. GM-opt = caller must opt in. Always = fire whenever a DC is supplied.",
    scope: "world", config: true, type: String, default: "gm-opt",
    choices: { "off": "Off", "gm-opt": "GM opt-in", "always": "Always" }
  });

  // ── Sprint D: TierEngine recalc stub ─────────────────────────────────────
  // BBTTCC's character-options module calls game.system.recalcActor(actor).
  // We provide a Fourth Thing-native implementation that reads FT attributes
  // and returns the OP budget structure the TierEngine expects.
  game.system.recalcActor = function(actor) {
    try {
      const rawSys = actor.system?.system ?? actor.system;
      const attrs  = rawSys?.attributes ?? {};
      const v = attrs.violence?.value ?? 2;
      const i = attrs.intrigue?.value ?? 2;
      const p = attrs.presence?.value ?? 2;
      const b = attrs.body?.value     ?? 2;
      const m = attrs.mind?.value     ?? 2;
      const s = attrs.soul?.value     ?? 2;
      // Map FT attributes to BBTTCC OP categories
      return {
        violence:   v,
        nonlethal:  Math.floor(v / 2),
        intrigue:   i,
        economy:    Math.floor((i + m) / 2),
        softpower:  Math.floor((p + s) / 2),
        diplomacy:  p,
        logistics:  b,
        culture:    Math.floor((p + m) / 2),
        faith:      s,
        total:      v + i + p + b + m + s
      };
    } catch(e) {
      console.warn("Roll for Initiation | recalcActor failed:", e);
      return { total: 0 };
    }
  };

  // ── Reality Tear / Overshoot — engine ────────────────────────────────────
  // Bands keyed off (total − dc):
  //   Ripple    +20–29  cosmetic only
  //   Tear      +30–39  burn 1 Surge if banked, else +1 Noise
  //   Rupture   +40–49  +1 Blood Debt + flavor-column misfire (tier-clamped)
  //   Sundering +50+    +1 Blood Debt + 1 Clarity loss + Adversary Beat banner
  // Names are unified across character / faction / raid actors.
  function _ftOvershootBand(over) {
    if (over >= 50) return { key: "sundering", label: "Sundering", color: "#ff4d4d" };
    if (over >= 40) return { key: "rupture",   label: "Rupture",   color: "#ff8a3d" };
    if (over >= 30) return { key: "tear",      label: "Tear",      color: "#e8c84a" };
    if (over >= 20) return { key: "ripple",    label: "Ripple",    color: "#9b9bff" };
    return null;
  }

  game.fourththing.rolls.applyOvershoot = async function (actor, {
    target = null, total, dc, kind = "tactical", optIn = false
  } = {}) {
    if (!actor || !Number.isFinite(Number(total)) || !Number.isFinite(Number(dc))) return null;
    if (!game.settings.get("fourththing", "overshootEnabled")) return null;

    const over = Number(total) - Number(dc);
    const band = _ftOvershootBand(over);
    if (!band) return null;

    const sys        = actor.system?.system ?? actor.system;
    const actorTier  = Math.max(1, Number(sys?.details?.tier) || 1);
    const targetSys  = target?.system?.system ?? target?.system;
    const targetTier = Math.max(1, Number(targetSys?.details?.tier) || 1);

    // Tier gate: peer or punch-up rolls stay quiet.
    if (target && game.settings.get("fourththing", "overshootTierGate") && actorTier < targetTier) {
      return null;
    }
    // No target ⇒ skill-check toggle decides.
    if (!target) {
      const mode = game.settings.get("fourththing", "overshootSkillChecks");
      if (mode === "off") return null;
      if (mode === "gm-opt" && !optIn) return null;
    }

    const noiseCur = Number(sys?.magic?.noise?.value)     || 0;
    const claCur   = Number(sys?.magic?.clarity?.value)   || 0;
    const surgeCur = Number(sys?.resources?.surge?.value) || 0;
    const debtCur  = Number(sys?.bloodDebt?.value)        || 0;

    const lines = [];
    const patch = {};
    let misfire = null;

    if (band.key === "ripple") {
      lines.push("Cosmetic ripple — lights flicker, dust lifts, animals flinch.");
    } else if (band.key === "tear") {
      if (surgeCur > 0) {
        patch["system.resources.surge.value"] = surgeCur - 1;
        lines.push(`1 Surge spent involuntarily (Surge ${surgeCur} → ${surgeCur - 1}).`);
      } else {
        const next = Math.min(10, noiseCur + 1);
        patch["system.magic.noise.value"] = next;
        lines.push(`Noise ${noiseCur} → ${next}.`);
      }
      lines.push("Hairline reality fracture. Sub-tier NPCs are <b>shaken</b> 1 round.");
    } else if (band.key === "rupture") {
      patch["system.bloodDebt.value"] = debtCur + 1;
      lines.push(`Blood Debt ${debtCur} → ${debtCur + 1}.`);
      try {
        const m = new Roll("1d10");
        await m.evaluate();
        if (typeof ftResolveMisfire === "function") {
          misfire = ftResolveMisfire(m.total, actorTier);
        }
      } catch (e) { /* misfire is decorative */ }
      lines.push("Visible 10 ft warp. <b>Adversary / Watcher takes notice.</b>");
    } else if (band.key === "sundering") {
      patch["system.bloodDebt.value"]      = debtCur + 1;
      patch["system.magic.clarity.value"]  = Math.max(0, claCur - 1);
      lines.push(`Blood Debt ${debtCur} → ${debtCur + 1} · Clarity ${claCur} → ${Math.max(0, claCur - 1)}.`);
      lines.push("Law-of-nature break in 30 ft for 1 round. <b>Adversary draws a Beat.</b>");
    }

    if (Object.keys(patch).length) {
      try { await actor.update(patch); } catch (e) { console.warn("Roll for Initiation | overshoot patch failed", e); }
    }

    const misfireHtml = misfire
      ? `<div style="margin-top:0.3rem;font-size:0.78rem;opacity:0.85"><b>Echo:</b> ${misfire.name} <span style="opacity:0.6">(T${misfire.tier})</span> — ${misfire.desc}</div>`
      : "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:${band.color}">✦ Reality ${band.label} — overshoot +${over}${target ? ` vs. ${target.name}` : ""}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.9">${lines.join("<br>")}</p>
        ${misfireHtml}
      </div>`
    });

    Hooks.callAll("fourththing.overshoot", { actor, target, total, dc, over, band: band.key, kind });
    return { band: band.key, over, misfire };
  };

  // Restraint die — pre-roll opt-in to pull the punch by up to actorTier; the
  // amount pulled is banked as a +1d4 Restraint die on the next roll vs. the
  // same target. Stored as a flag so it survives across roll calls.
  game.fourththing.rolls.bankRestraint = async function (actor, target, amount) {
    if (!actor || !target) return 0;
    const sys = actor.system?.system ?? actor.system;
    const cap = Math.max(1, Number(sys?.details?.tier) || 1);
    const reduce = Math.max(0, Math.min(cap, Number(amount) || 0));
    if (reduce <= 0) return 0;
    await actor.setFlag("fourththing", "restraint", {
      targetId: target.id ?? String(target),
      reduction: reduce,
      sides: 4,
      ts: Date.now()
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0d4ff">✦ ${actor.name} pulls the punch (-${reduce})</span></div>
        <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85">Banked +1d4 Restraint die for next roll vs. ${target?.name ?? "same target"}.</p>
      </div>`
    });
    return reduce;
  };

  game.fourththing.rolls.consumeRestraint = async function (actor, target) {
    if (!actor) return { reduction: 0, bonus: 0 };
    const r = actor.getFlag?.("fourththing", "restraint");
    if (!r) return { reduction: 0, bonus: 0 };
    if (target?.id && r.targetId && r.targetId !== target.id) return { reduction: 0, bonus: 0 };
    const sides = r.sides ?? 4;
    const bonusRoll = new Roll(`1d${sides}`);
    await bonusRoll.evaluate();
    await actor.unsetFlag("fourththing", "restraint");
    return { reduction: r.reduction ?? 0, bonus: bonusRoll.total };
  };

  // ── Roll: standard ────────────────────────────────────────────────────────
  // Optional caller args:
  //   dc                  — DC for overshoot detection. No DC ⇒ no overshoot.
  //   target              — actor whose tier gates the band check.
  //   applyOvershoot      — explicit GM opt-in for skill-check style rolls.
  //   restraintReduction  — pre-declared "pull the punch" amount (clamped to actor tier);
  //                          subtracted from the rolled total and banked vs. target.
  //   kind                — telemetry tag (default "tactical").
  game.fourththing.rolls.attributeTest = async function (actor, {
    attribute, skill = null, label = "",
    dc = null, target = null, applyOvershoot = false, restraintReduction = 0, kind = "tactical"
  } = {}) {
    const rawSys   = actor.system?.system ?? actor.system;
    const attrVal  = rawSys?.attributes?.[attribute]?.value ?? 0;
    const skillVal = skill ? (rawSys?.skills?.[skill]?.value ?? 0) : 0;

    // Passive AE bonuses (mode 2 = ADD) on the attribute and (optional) skill.
    // Roll path was bypassing actor.appliedEffects entirely — Aurablade auras,
    // heritages, path passives etc. were authored but never landing.
    const aeContribs = [];
    let aeAttr = 0, aeSkill = 0;
    for (const effect of actor.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || !change.key?.endsWith(".value")) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        if (change.key === `system.attributes.${attribute}.value`) {
          aeAttr += v;
          aeContribs.push({ src, label: attribute, value: v });
        } else if (skill && change.key === `system.skills.${skill}.value`) {
          aeSkill += v;
          aeContribs.push({ src, label: skill, value: v });
        }
      }
    }
    const totalBonus = attrVal + skillVal + aeAttr + aeSkill;

    // Dreamwalker per-rest one-shot bonus dice — consumed on use.
    const _dw = _ftReadDwOneShots(actor, { context: "check" });
    const _dwExtra = (_dw.bonusD6 ? ` + ${_dw.bonusD6}d6` : "") + (_dw.bonusD4 ? ` + ${_dw.bonusD4}d4` : "");

    // RFI canon: d10s explode on 10 — each extra die banks +1 Surge. Foundry's
    // x10 modifier chains the explosions natively so the dice tray and total
    // stay correct.
    const formula = `2d10x10 + ${totalBonus}${_dwExtra}`;
    const roll    = new Roll(formula);
    await roll.evaluate();

    const allResults = roll.terms[0]?.results ?? [];
    const baseDice   = allResults.slice(0, 2).map(r => r.result);
    const explosions = Math.max(0, allResults.length - 2);
    const doubleTen  = baseDice.filter(v => v === 10).length >= 2;

    if (explosions > 0) {
      const curSurge = rawSys?.resources?.surge?.value ?? 0;
      await actor.update({ "system.resources.surge.value": curSurge + explosions });
    }
    if (doubleTen) await actor.setFlag("fourththing", "bonusActionAvailable", true);

    // Shape B reroll grants — passive items can grant reroll-lowest/highest on
    // this roll (e.g. "advantage on Body checks" from a heritage). Surge for
    // rerolled 10s is NOT banked (v1 limitation — explosion chain already
    // resolved at this point); the original explosion bookkeeping above stands.
    const rerollGrants = collectRerolls(actor, { context: "check", skill, attribute });
    if (_dw.advantage) rerollGrants.push({ sourceItemName: "Fractal Self", mode: "reroll-lowest" });
    const rerollResult = await applyRerollGrants(roll, rerollGrants, totalBonus);
    await consumeAnnotationReroll(actor, rerollResult.applied);
    // Consume any DW one-shots used on this roll (omen d6, foresight d4,
    // fractal advantage). Append a chat note crediting the source(s).
    if (_dw.sources.length) await _ftConsumeDwOneShots(actor, _dw);

    // Restraint: pull the punch on this roll, bank +1d4 vs. target for next.
    let pulled = 0;
    if (target && Number(restraintReduction) > 0) {
      pulled = await game.fourththing.rolls.bankRestraint(actor, target, restraintReduction);
    }
    // Consume any prior banked restraint vs. this target as a bonus to *this* roll.
    let bonus = 0;
    if (target) {
      const r = await game.fourththing.rolls.consumeRestraint(actor, target);
      bonus = r.bonus || 0;
    }
    const adjustedTotal = roll.total - pulled + bonus;

    const noteBits = [];
    if (explosions > 0) noteBits.push(`+${explosions} Surge banked`);
    if (doubleTen)      noteBits.push(`Double 10 — Act Again available`);
    if (pulled > 0)     noteBits.push(`Restraint −${pulled} pulled (banked +1d4 vs. ${target?.name ?? "target"})`);
    if (bonus > 0)      noteBits.push(`Restraint +${bonus} consumed`);
    if (aeContribs.length) {
      const parts = aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`);
      noteBits.push(`Passives: ${parts.join(", ")}`);
    }
    if (rerollResult.applied.length) {
      const parts = rerollResult.applied.map(r => `${r.mode === "reroll-lowest" ? "↑" : "↓"} ${r.before}→${r.after} (${r.source})`);
      noteBits.push(`Reroll: ${parts.join(", ")}`);
    }
    if (_dw.sources.length) {
      noteBits.push(`Dreamwalker: ${_dw.sources.map(s => s.label).join(", ")}`);
    }
    const noteHtml = noteBits.length
      ? `<p style="font-size:0.78rem;color:#e8c84a;margin:0.2rem 0 0">${noteBits.join(" · ")}</p>`
      : "";

    const totalHtml = (pulled || bonus)
      ? `${formula} = ${roll.total} → <b>${adjustedTotal}</b>`
      : `${formula} = <b>${roll.total}</b>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<div class="fourththing-roll"><h3>${label || "Roll for Initiation Check"}</h3>
                <p><b>Formula:</b> ${totalHtml}</p>${noteHtml}</div>`
    });

    // Reality Tear pass — uses the adjusted total so Restraint actually muffles overshoot.
    if (Number.isFinite(Number(dc))) {
      await game.fourththing.rolls.applyOvershoot(actor, {
        target, total: adjustedTotal, dc: Number(dc), kind, optIn: !!applyOvershoot
      });

      // Phase C trigger: fire on-skill-fail / on-skill-success when DC is known.
      const passed = adjustedTotal >= Number(dc);
      const event  = passed ? "on-skill-success" : "on-skill-fail";
      const tags   = [skill, attribute].filter(Boolean);
      await fireTriggers(actor, event, { tags, scope: "self" });
    }

    return roll;
  };

  // ── Roll: magic ────────────────────────────────────────────────────────────
  // Options:
  //   misfireTier — overrides the column used for the misfire lookup. Used
  //                 during reach-up casts so the consequence scales to the
  //                 target tier, not the caster's tier.
  //   skipMisfire — caller has pre-paid (e.g. reach-via-Blood-Debt) and
  //                 wants no misfire roll regardless of the result.
  //   modeMisfireBias — integer shift applied to the d10 (Hermetic −2, Chaos +2,
  //                 capped to [1,10]) from the stance toggle.
  game.fourththing.rolls.magicTest = async function (actor, {
    intent, channel, sephirah, label = "Manifestation", difficulty = 15,
    costNote = "", signature = "", thirdThing = "",
    misfireTier, skipMisfire = false, modeMisfireBias = 0,
    target = null, restraintReduction = 0,
    item = null,
    useOverlay = false
  } = {}) {
    // Item-driven cast: clamp misfire to the item's tier and inherit signature
    // when the caller didn't pass one explicitly.
    if (item && RfiItems.is.isGear(item)) {
      const rfi = RfiItems.get(item);
      if (!Number.isFinite(misfireTier)) misfireTier = RfiItems.getMisfireTier(item);
      if (!signature && rfi?.signature)  signature   = rfi.signature;
      if (!label || label === "Manifestation") label = item.name ?? label;
    }
    const sys      = actor.system?.system ?? actor.system;
    // Boss casts (2026-05-11) — bosses don't carry Steward-shaped attributes
    // or a Clarity pool, so synthesize: intent/channel attrs default to the
    // boss tier (a T3 boss gets +3 +3 push), Clarity := current Surge, Noise
    // := 0. Keeps the magicTest formula shape uniform across actor types.
    const isBossCaster = actor?.type === "boss";
    const bossTier = isBossCaster ? Math.max(1, Math.min(4, Number(sys?.integrity?.tier) || 1)) : 0;
    const attrI    = isBossCaster ? bossTier : (sys.attributes?.[intent]?.value  ?? 0);
    const attrC    = isBossCaster ? bossTier : (sys.attributes?.[channel]?.value ?? 0);
    const clarity  = isBossCaster ? (Number(sys?.manifestations?.surge?.current) || 0)
                                   : (sys.magic?.clarity?.value ?? 3);
    const noise    = isBossCaster ? 0 : (sys.magic?.noise?.value   ?? 0);
    const alignMod = ftAlignmentMod(sephirah, intent, channel);

    // Passive AE bonuses on intent/channel attributes, magic.clarity, magic.noise.
    // Clarity/intent/channel push posTotal up; noise AEs push the noise term
    // (which is subtracted) — so +1 noise via cursed gear hurts the cast,
    // -1 noise reduction helps. Mode 2 ADD captures both directions correctly.
    const aeContribs = [];
    let aeIntent = 0, aeChannel = 0, aeClarity = 0, aeNoise = 0;
    for (const effect of actor.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || !change.key?.endsWith(".value")) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        if (change.key === `system.attributes.${intent}.value`) {
          aeIntent += v;
          aeContribs.push({ src, label: intent, value: v });
        } else if (change.key === `system.attributes.${channel}.value`) {
          aeChannel += v;
          aeContribs.push({ src, label: channel, value: v });
        } else if (change.key === "system.magic.clarity.value") {
          aeClarity += v;
          aeContribs.push({ src, label: "Clarity", value: v });
        } else if (change.key === "system.magic.noise.value") {
          aeNoise += v;
          aeContribs.push({ src, label: "Noise", value: v });
        }
      }
    }

    // Sprint C: terrain resonance bonus
    const terrain       = getTerrainMagicModifiers(actor);
    const terrainAlign  = terrain.alignBonus  ?? 0;
    const terrainNoise  = terrain.noiseBonus  ?? 0;
    const totalAlign    = alignMod + terrainAlign;
    const totalNoise    = noise + terrainNoise + aeNoise;

    const posTotal = attrI + attrC + clarity + totalAlign + aeIntent + aeChannel + aeClarity;
    // RFI canon: d10s explode on 10. Each explosion banks +1 Surge; double-10
    // base flags Act Again. Same engine as Engage/Steward — keeps all three
    // tactical roll paths visually + mechanically consistent.
    const formula  = `2d10x10 + ${posTotal} - ${totalNoise}`;
    const roll     = new Roll(formula);
    await roll.evaluate();
    const rawTotal      = roll.total;
    const allDieResults = roll.dice[0]?.results ?? [];
    const diceResults   = allDieResults.slice(0, 2);
    const explosionDice = allDieResults.slice(2).map(r => r.result);
    const explosions    = explosionDice.length;
    const baseDiceVals  = diceResults.map(r => r.result);
    const doubleTen     = baseDiceVals.filter(v => v === 10).length >= 2;

    if (explosions > 0) {
      if (isBossCaster) {
        // Boss surge bank lives at system.manifestations.surge.{current, max,
        // exploded}; cap deposits at .max but track the raw explosion count
        // separately in `.exploded` so the GM can see how juiced the dice were.
        const s = sys?.manifestations?.surge ?? { current: 0, max: 6, exploded: 0 };
        const curS = Number(s.current) || 0;
        const maxS = Number(s.max) || 6;
        const expS = Number(s.exploded) || 0;
        await actor.update({
          "system.manifestations.surge.current": Math.min(maxS, curS + explosions),
          "system.manifestations.surge.exploded": expS + explosions
        });
      } else {
        const curSurge = sys?.resources?.surge?.value ?? 0;
        await actor.update({ "system.resources.surge.value": curSurge + explosions });
      }
    }
    if (doubleTen && !isBossCaster) await actor.setFlag("fourththing", "bonusActionAvailable", true);

    // Shape B reroll grants — context "caster-check" + per-attribute narrowing
    // covers the two pieces of magic vocabulary that came up in the survey.
    const rerollGrants = [
      ...collectRerolls(actor, { context: "caster-check", attribute: intent }),
      ...collectRerolls(actor, { context: "caster-check", attribute: channel })
    ];
    // Wyrdlens — Probability Overlay synthetic grant (Phase C 2026-05-07).
    // Caller passed the cast-time checkbox; debit happens in castManifestation
    // after this returns (so the reroll lands but the pool drains exactly once).
    if (useOverlay) {
      rerollGrants.push({ sourceItemName: "Wyrdlens — Probability Overlay", mode: "reroll-lowest" });
    }
    const rerollResult = await applyRerollGrants(roll, rerollGrants, posTotal - totalNoise);
    await consumeAnnotationReroll(actor, rerollResult.applied);

    // Restraint pass — bank pull-the-punch, then consume any prior banked die.
    let pulled = 0;
    if (target && Number(restraintReduction) > 0) {
      pulled = await game.fourththing.rolls.bankRestraint(actor, target, restraintReduction);
    }
    let bonus = 0;
    if (target) {
      const r = await game.fourththing.rolls.consumeRestraint(actor, target);
      bonus = r.bonus || 0;
    }
    const total   = roll.total - pulled + bonus;
    const success = total >= difficulty;

    let misfireData = null;
    if (!success && !skipMisfire) {
      const mRoll = new Roll("1d10");
      await mRoll.evaluate();
      const biased = Math.max(1, Math.min(10, mRoll.total + (Number(modeMisfireBias) || 0)));
      const useTier = Number.isFinite(misfireTier) ? misfireTier : (sys?.details?.tier ?? 1);
      misfireData = ftResolveMisfire(biased, useTier);
    }

    const restraintNote = (pulled || bonus)
      ? `<p style="font-size:0.78rem;color:#a0d4ff;margin:0.2rem 0 0">${[
          pulled > 0 ? `Restraint −${pulled} pulled (banked +1d4 vs. ${target?.name ?? "target"})` : "",
          bonus  > 0 ? `Restraint +${bonus} consumed`                                              : ""
        ].filter(Boolean).join(" · ")}</p>`
      : "";

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  buildMagicChatHTML({ label, intent, channel, sephirah,
                                    attrIntent: attrI, attrChannel: attrC,
                                    clarity, noise: totalNoise, alignMod: totalAlign,
                                    total, difficulty, success, misfireData, diceResults,
                                    terrainLabel: terrain.terrainLabel,
                                    explosionDice, surgeBanked: explosions, doubleTen,
                                    costNote, signature, thirdThing }) + restraintNote + (aeContribs.length
        ? `<p style="font-size:0.78rem;color:#e8c84a;margin:0.2rem 0 0">Passives: ${
            aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")
          }</p>`
        : "") + (rerollResult.applied.length
        ? `<p style="font-size:0.78rem;color:#a0d4ff;margin:0.2rem 0 0">Reroll: ${
            rerollResult.applied.map(r => `${r.mode === "reroll-lowest" ? "↑" : "↓"} ${r.before}→${r.after} (${r.source})`).join(", ")
          }</p>`
        : "")
    });

    // Auto-apply Qliphothic Echo (misfire 5-6) + terrain noise
    if (misfireData?.rolled >= 5 && misfireData?.rolled <= 6) {
      const newNoise = Math.min(10, (noise + terrainNoise) + 1);
      await actor.update({ "system.magic.noise.value": newNoise });
      ui.notifications?.warn(`${actor.name}: Qliphothic Echo — Noise is now ${newNoise}.`);
    } else if (terrainNoise > 0 && !success) {
      // Qliphothic terrain adds noise on any failure
      const newNoise = Math.min(10, noise + 1);
      await actor.update({ "system.magic.noise.value": newNoise });
      ui.notifications?.warn(`${actor.name}: Qliphothic terrain adds Noise — now ${newNoise}.`);
    }

    // Reality Tear — manifestations are always on; difficulty is the DC.
    if (success) {
      await game.fourththing.rolls.applyOvershoot(actor, {
        target, total, dc: Number(difficulty), kind: "manifestation", optIn: true
      });
    }

    return { roll, success, misfireData };
  };

  // ── Roll: manifestation attack (post-cast resolution) ─────────────────────
  // Fires AFTER a successful cast check when the manifestation declares
  // resolution.shape="attack". 2d10x10 + intent + channel + AE adds vs the
  // target's static defense (Guard/Evasion/Resolve). Misses skip the damage
  // path (narrative miss only). Misfire NEVER fires from this roll — cast-fail
  // and target-resist are intentionally distinct outcomes:
  //   cast fails  → misfire (Tree pushed back)
  //   attack misses → narrative glance (working manifested but didn't land)
  game.fourththing.rolls.resolveManifestationAttack = async function (actor, target, item, resolution = {}, {
    intent = "intrigue", channel = "presence"
  } = {}) {
    if (!actor || !target) return { hit: false, reason: "missing-actor-or-target" };
    const sys  = actor.system?.system  ?? actor.system  ?? {};
    const tSys = target.system?.system ?? target.system ?? {};

    const attackVs = ["guard", "evasion", "resolve"].includes(resolution.attackVs) ? resolution.attackVs : "evasion";
    const defenseValue = Number(tSys?.derived?.[attackVs]?.value) || 10;

    const intentVal  = Number(sys?.attributes?.[intent]?.value)  || 0;
    const channelVal = Number(sys?.attributes?.[channel]?.value) || 0;

    // AE adds on intent + channel attributes (v14 change.type === "add").
    const aeContribs = [];
    let aeIntent = 0, aeChannel = 0;
    for (const effect of actor.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || !change.key?.endsWith(".value")) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        if (change.key === `system.attributes.${intent}.value`) {
          aeIntent += v;
          aeContribs.push({ src, label: intent, value: v });
        } else if (change.key === `system.attributes.${channel}.value`) {
          aeChannel += v;
          aeContribs.push({ src, label: channel, value: v });
        }
      }
    }

    const totalBonus = intentVal + channelVal + aeIntent + aeChannel;
    const formula    = `2d10x10 + ${totalBonus}`;
    const roll       = new Roll(formula);
    await roll.evaluate();

    const dieResults    = roll.dice?.[0]?.results ?? [];
    const explosions    = Math.max(0, dieResults.length - 2);
    const baseDice      = dieResults.slice(0, 2).map(r => r.result);
    const explosionVals = dieResults.slice(2).map(r => r.result);

    if (explosions > 0) {
      try {
        const cur = Number(sys?.resources?.surge?.value) || 0;
        await actor.update({ "system.resources.surge.value": cur + explosions });
      } catch (e) { /* surge resource missing — silent */ }
    }

    const total = roll.total;
    const hit   = total >= defenseValue;

    const surgeNote = explosions > 0
      ? ` <span style="color:#e8c84a;font-weight:600">+${explosions} Surge banked</span>`
      : "";
    const explodeTail = explosionVals.length
      ? ` <span style="color:#e8c84a">+ ${explosionVals.join(", ")}</span>`
      : "";
    const aeNote = aeContribs.length
      ? `<p style="font-size:0.78rem;color:#e8c84a;margin:0.2rem 0 0">Passives: ${aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")}</p>`
      : "";

    const headerColor = hit ? "#5fb35f" : "#c45f5f";
    const headerLabel = hit ? "HIT"     : "MISS";
    const html = `<div class="fourththing-roll">
      <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">⚔ ${ftEscapeHtml(item?.name ?? "Manifestation")} — ${headerLabel} vs ${ftEscapeHtml(target.name)}</span></div>
      <div class="ft-result-row ${hit ? "ft-success" : "ft-failure"}">
        <span class="ft-total">${total}</span>
        <span class="ft-outcome">vs ${ftCap(attackVs)} ${defenseValue}</span>
      </div>
      <p style="font-size:0.78rem;opacity:0.85;margin:0.2rem 0 0">
        Roll: ${baseDice.join(", ")}${explodeTail} + ${totalBonus} (${ftCap(intent)} + ${ftCap(channel)})${surgeNote}
      </p>
      ${hit ? "" : `<p style="font-size:0.78rem;opacity:0.7;margin:0.2rem 0 0;font-style:italic">The working manifested, but the moment glanced off. (No misfire — cast was clean.)</p>`}
      ${aeNote}
    </div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  html
    });

    return { hit, total, defenseValue, explosions };
  };

  // ── Roll: manifestation save (post-cast resolution) ───────────────────────
  // Fires AFTER a successful cast check when the manifestation declares
  // resolution.shape="save". Target rolls 2d10x10 + saveAttribute (with AE
  // adds on the target's side) vs the cast DC (or a fixed override). On
  // success, the caller halves or negates the damage application per the
  // resolution.onSave field. Misfire NEVER fires from this roll — same canon
  // as attack-shape (cast-fail and target-resist are distinct outcomes).
  //
  // Pilot model (2026-05-05): GM auto-rolls FOR the target. Future flag
  // `saveByPrompt: true` will route to a target-clicks-button chat card.
  game.fourththing.rolls.resolveManifestationSave = async function (actor, target, item, resolution = {}, {
    castDc = 15,
    rollOverride = null
  } = {}) {
    if (!actor || !target) return { saved: false, reason: "missing-actor-or-target" };
    const sys = target.system?.system ?? target.system ?? {};

    const validAttrs = ["violence", "intrigue", "presence", "body", "mind", "soul"];
    const saveAttr   = validAttrs.includes(resolution.saveAttribute) ? resolution.saveAttribute : "body";
    const dcMode     = resolution.saveDcMode === "fixed" ? "fixed" : "cast-dc";
    const dc         = dcMode === "fixed" ? (Number(resolution.saveDcFixed) || 15) : (Number(castDc) || 15);
    const onSave     = ["negate", "half"].includes(resolution.onSave) ? resolution.onSave : "half";

    const attrVal = Number(sys?.attributes?.[saveAttr]?.value) || 0;

    // AE adds on the SAVE attribute (target side, since target is rolling).
    const aeContribs = [];
    let aeAttr = 0;
    for (const effect of target.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || !change.key?.endsWith(".value")) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        if (change.key === `system.attributes.${saveAttr}.value`) {
          aeAttr += v;
          aeContribs.push({ src, label: saveAttr, value: v });
        }
      }
    }

    const totalBonus = attrVal + aeAttr;
    // CL Resonance Channel — defenseImpose forces 3d10kl2 (3 dice, keep
    // lowest 2) instead of 2d10x10. Worse expected total, no explosions.
    // Phase D 2026-05-08 wiring; engine branch closes the deferred item.
    const formula    = rollOverride === "3d10kl2"
      ? `3d10kl2 + ${totalBonus}`
      : `2d10x10 + ${totalBonus}`;
    const roll       = new Roll(formula);
    await roll.evaluate();

    const dieResults    = roll.dice?.[0]?.results ?? [];
    const explosions    = Math.max(0, dieResults.length - 2);
    const baseDice      = dieResults.slice(0, 2).map(r => r.result);
    const explosionVals = dieResults.slice(2).map(r => r.result);

    // Target banks Surge from explosions — they're the active roller.
    if (explosions > 0) {
      try {
        const cur = Number(sys?.resources?.surge?.value) || 0;
        await target.update({ "system.resources.surge.value": cur + explosions });
      } catch (e) { /* surge missing — silent */ }
    }

    const total = roll.total;
    const saved = total >= dc;

    const surgeNote = explosions > 0
      ? ` <span style="color:#e8c84a;font-weight:600">+${explosions} Surge banked</span>`
      : "";
    const explodeTail = explosionVals.length
      ? ` <span style="color:#e8c84a">+ ${explosionVals.join(", ")}</span>`
      : "";
    const aeNote = aeContribs.length
      ? `<p style="font-size:0.78rem;color:#e8c84a;margin:0.2rem 0 0">Passives: ${aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")}</p>`
      : "";

    const headerColor      = saved ? "#5fb35f" : "#c45f5f";
    const headerLabel      = saved ? "RESISTED" : "FAILED SAVE";
    const consequenceLabel = saved
      ? (onSave === "negate" ? "no effect" : "halved")
      : "full effect";

    const html = `<div class="fourththing-roll">
      <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">🛡 ${ftEscapeHtml(target.name)} — ${ftCap(saveAttr)} save vs ${ftEscapeHtml(item?.name ?? "Manifestation")}: ${headerLabel}</span></div>
      <div class="ft-result-row ${saved ? "ft-success" : "ft-failure"}">
        <span class="ft-total">${total}</span>
        <span class="ft-outcome">vs DC ${dc} → ${consequenceLabel}</span>
      </div>
      <p style="font-size:0.78rem;opacity:0.85;margin:0.2rem 0 0">
        Roll: ${baseDice.join(", ")}${explodeTail} + ${totalBonus} (${ftCap(saveAttr)})${surgeNote}
      </p>
      ${aeNote}
    </div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: target }),
      flavor:  html
    });

    return { saved, total, dc, onSave, explosions };
  };

  // ── Roll: manifestation contest (post-cast resolution) ────────────────────
  // Both sides roll 2d10x10 + their respective bonus; higher total wins. Ties
  // go to the target (defensive bias — "your working tried, theirs held"). On
  // target win, damage halves or negates per resolution.onContestLoss. Both
  // sides bank Surge from their own explosions. Misfire NEVER fires from this
  // roll — same canon as attack and save.
  //
  // Caster bonus: "intent+channel" shorthand uses both cast attributes; any
  // single faculty name (e.g. "violence") uses just that one. AE adds on the
  // chosen attribute(s) are walked for both sides.
  game.fourththing.rolls.resolveManifestationContest = async function (actor, target, item, resolution = {}, {
    intent = "intrigue", channel = "presence"
  } = {}) {
    if (!actor || !target) return { casterWins: false, reason: "missing-actor-or-target" };
    const cSys = actor.system?.system  ?? actor.system  ?? {};
    const tSys = target.system?.system ?? target.system ?? {};

    const validAttrs = ["violence", "intrigue", "presence", "body", "mind", "soul"];

    // Caster side — "intent+channel" shorthand or single faculty.
    const cAttrSpec = String(resolution.contestCasterAttribute ?? "intent+channel");
    const cKeys     = (cAttrSpec === "intent+channel")
                      ? [intent, channel].filter(a => validAttrs.includes(a))
                      : (validAttrs.includes(cAttrSpec) ? [cAttrSpec] : [intent, channel].filter(a => validAttrs.includes(a)));
    const cKeyLabels = cKeys.map(ftCap).join(" + ");

    // Target side — single faculty.
    const tKey = validAttrs.includes(resolution.contestTargetAttribute) ? resolution.contestTargetAttribute : "body";
    const onContestLoss = ["negate", "half"].includes(resolution.onContestLoss) ? resolution.onContestLoss : "negate";

    // ─ Caster's roll ────────────────────────────────────────────────────────
    const cBaseAttr = cKeys.reduce((sum, k) => sum + (Number(cSys?.attributes?.[k]?.value) || 0), 0);
    const cAEContribs = [];
    let cAE = 0;
    for (const effect of actor.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || !change.key?.endsWith(".value")) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        for (const k of cKeys) {
          if (change.key === `system.attributes.${k}.value`) {
            cAE += v;
            cAEContribs.push({ src, label: k, value: v });
          }
        }
      }
    }
    const cBonus  = cBaseAttr + cAE;
    const cRoll   = new Roll(`2d10x10 + ${cBonus}`);
    await cRoll.evaluate();
    const cDie    = cRoll.dice?.[0]?.results ?? [];
    const cExplos = Math.max(0, cDie.length - 2);
    const cBase   = cDie.slice(0, 2).map(r => r.result);
    const cTail   = cDie.slice(2).map(r => r.result);
    if (cExplos > 0) {
      try {
        const cur = Number(cSys?.resources?.surge?.value) || 0;
        await actor.update({ "system.resources.surge.value": cur + cExplos });
      } catch (e) { /* surge missing — silent */ }
    }
    const cTotal = cRoll.total;

    // ─ Target's roll ────────────────────────────────────────────────────────
    const tBaseAttr = Number(tSys?.attributes?.[tKey]?.value) || 0;
    const tAEContribs = [];
    let tAE = 0;
    for (const effect of target.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || !change.key?.endsWith(".value")) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        if (change.key === `system.attributes.${tKey}.value`) {
          tAE += v;
          tAEContribs.push({ src, label: tKey, value: v });
        }
      }
    }
    const tBonus  = tBaseAttr + tAE;
    const tRoll   = new Roll(`2d10x10 + ${tBonus}`);
    await tRoll.evaluate();
    const tDie    = tRoll.dice?.[0]?.results ?? [];
    const tExplos = Math.max(0, tDie.length - 2);
    const tBase   = tDie.slice(0, 2).map(r => r.result);
    const tTail   = tDie.slice(2).map(r => r.result);
    if (tExplos > 0) {
      try {
        const cur = Number(tSys?.resources?.surge?.value) || 0;
        await target.update({ "system.resources.surge.value": cur + tExplos });
      } catch (e) { /* surge missing — silent */ }
    }
    const tTotal = tRoll.total;

    // Tie → target wins. Strict greater-than for caster.
    const casterWins = cTotal > tTotal;

    // ─ Combined chat card ───────────────────────────────────────────────────
    const renderSide = (label, base, tail, bonus, total, attrLabel, explos, aeContribs) => {
      const tailHtml   = tail.length ? ` <span style="color:#e8c84a">+ ${tail.join(", ")}</span>` : "";
      const surgeHtml  = explos > 0 ? ` <span style="color:#e8c84a;font-weight:600">+${explos} Surge</span>` : "";
      const aeHtml = aeContribs.length
        ? `<span style="color:#e8c84a;font-size:0.74rem"> · Passives: ${aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")}</span>`
        : "";
      return `<div style="margin:0.2rem 0;padding:0.3rem 0.4rem;background:rgba(255,255,255,0.04);border-radius:3px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:0.82rem"><b>${label}</b> <span style="opacity:0.6">— ${attrLabel}</span></span>
          <span style="font-size:0.96rem;font-weight:700">${total}</span>
        </div>
        <p style="font-size:0.74rem;opacity:0.85;margin:0.15rem 0 0">
          ${base.join(", ")}${tailHtml} + ${bonus}${surgeHtml}${aeHtml}
        </p>
      </div>`;
    };

    const headerColor = casterWins ? "#5fb35f" : "#c45f5f";
    const headerLabel = casterWins ? "CASTER WINS" : "TARGET RESISTS";
    const consequence = casterWins
      ? "full effect"
      : (onContestLoss === "negate" ? "no effect" : "halved");

    const html = `<div class="fourththing-roll">
      <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">🤝 ${ftEscapeHtml(item?.name ?? "Manifestation")} — Contested vs ${ftEscapeHtml(target.name)}: ${headerLabel}</span></div>
      <div class="ft-result-row ${casterWins ? "ft-success" : "ft-failure"}">
        <span class="ft-total">${cTotal} vs ${tTotal}</span>
        <span class="ft-outcome">→ ${consequence}${cTotal === tTotal ? " (tie → target)" : ""}</span>
      </div>
      ${renderSide(actor.name, cBase, cTail, cBonus, cTotal, cKeyLabels, cExplos, cAEContribs)}
      ${renderSide(target.name, tBase, tTail, tBonus, tTotal, ftCap(tKey), tExplos, tAEContribs)}
    </div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: html,
      rolls:   [cRoll, tRoll]
    });

    return {
      casterWins, casterTotal: cTotal, targetTotal: tTotal,
      onContestLoss, casterExplosions: cExplos, targetExplosions: tExplos
    };
  };

  // ── Roll: misfire ──────────────────────────────────────────────────────────
  // Optional `tier` override; defaults to the actor's Steward tier.
  // Discipline-aware: pulls misfireBandShift from the actor's feature flags and
  // any optional caller-supplied modeMisfireBias (Hermetic/Chaos). Negative
  // shift = milder band. The raw d10 is shown alongside the biased value so
  // players can see what the discipline did.
  game.fourththing.rolls.misfireRoll = async function (actor, { tier, item = null, modeMisfireBias = 0 } = {}) {
    const roll = new Roll("1d10");
    await roll.evaluate();
    const sys = actor?.system?.system ?? actor?.system ?? {};
    // Item tier wins over actor tier when an item drove the misfire.
    const itemTier = item && RfiItems.is.isGear(item) ? RfiItems.getMisfireTier(item) : null;
    const useTier = Number.isFinite(tier) ? tier
                  : (itemTier ?? sys?.details?.tier ?? 1);

    // Apply mode bias (caller-passed) + actor discipline shift (item flags).
    const disciplineShift = Number(getMisfireBandShift(actor)) || 0;
    const totalShift = (Number(modeMisfireBias) || 0) + disciplineShift;
    const biased = Math.max(1, Math.min(10, roll.total + totalShift));
    const result = ftResolveMisfire(biased, useTier);

    const shiftBits = [];
    if (Number(modeMisfireBias)) shiftBits.push(`mode ${modeMisfireBias > 0 ? "+" : ""}${modeMisfireBias}`);
    if (disciplineShift)         shiftBits.push(`discipline ${disciplineShift > 0 ? "+" : ""}${disciplineShift}`);
    const shiftNote = totalShift !== 0
      ? `<p class="ft-misfire-desc" style="opacity:0.7;font-size:0.78rem;margin:0.15rem 0 0">d10 raw <b>${roll.total}</b> → <b>${biased}</b> after shift (${shiftBits.join(" · ")})</p>`
      : "";

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<div class="fourththing-roll ft-magic-roll">
                  <div class="ft-misfire-box standalone">
                    <span class="ft-misfire-label">⚡ Misfire ${biased}${totalShift !== 0 ? ` <span style="opacity:0.5">(d10 ${roll.total})</span>` : ""} — ${result.name} <span style="opacity:0.6">(T${result.tier})</span></span>
                    <p class="ft-misfire-desc">${result.desc}</p>
                    ${shiftNote}
                  </div></div>`
    });
    return { roll, result, biased, shift: totalShift };
  };

  // ── Roll: attack (Sprint B) ────────────────────────────────────────────────
  // `target` is the defender actor (used for Reality Tear tier gate + Restraint
  // banking). Caller can also pass `restraintReduction` to pull the punch.
  game.fourththing.rolls.attackTest = async function (actor, {
    intent = "violence", skill = "melee", defense = "guard",
    defenseValue = 14, label = "Strike", damageFormula = "", damageType = "kinetic",
    damageFlavor = "",
    costNote = "", signature = "", thirdThing = "",
    target = null, restraintReduction = 0,
    flankBonus = 0
  } = {}) {
    const rawSys  = actor.system?.system ?? actor.system;
    const attrVal  = rawSys?.attributes?.[intent]?.value ?? 0;
    const skillVal = rawSys?.skills?.[skill]?.value      ?? 0;

    // Passive AE bonuses on intent attribute + skill (mode 2 = ADD).
    // Same pattern as attributeTest — the roll path used to bypass appliedEffects.
    const aeContribs = [];
    let aeAttr = 0, aeSkill = 0;
    for (const effect of actor.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || !change.key?.endsWith(".value")) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        if (change.key === `system.attributes.${intent}.value`) {
          aeAttr += v;
          aeContribs.push({ src, label: intent, value: v });
        } else if (change.key === `system.skills.${skill}.value`) {
          aeSkill += v;
          aeContribs.push({ src, label: skill, value: v });
        }
      }
    }
    const flankMod  = Math.max(0, Number(flankBonus) || 0);
    const total_mod = attrVal + skillVal + aeAttr + aeSkill + flankMod;
    // RFI canon: d10s explode on 10. Each explosion banks +1 Surge; two
    // base 10s also flag "Act Again" so the sheet exposes the bonus action.
    const formula   = `2d10x10 + ${total_mod}`;

    const roll  = new Roll(formula);
    await roll.evaluate();
    const rawTotal      = roll.total;
    const allDieResults = roll.dice[0]?.results ?? [];
    const diceResults   = allDieResults.slice(0, 2);
    const explosionDice = allDieResults.slice(2).map(r => r.result);
    const explosions    = explosionDice.length;
    const baseDice      = diceResults.map(r => r.result);
    const doubleTen     = baseDice.filter(v => v === 10).length >= 2;

    if (explosions > 0) {
      const curSurge = rawSys?.resources?.surge?.value ?? 0;
      await actor.update({ "system.resources.surge.value": curSurge + explosions });
    }
    if (doubleTen) await actor.setFlag("fourththing", "bonusActionAvailable", true);

    // Shape B reroll grants — context "attack" narrowed by skill/attribute.
    const rerollGrants = collectRerolls(actor, { context: "attack", skill, attribute: intent });
    const rerollResult = await applyRerollGrants(roll, rerollGrants, total_mod);
    await consumeAnnotationReroll(actor, rerollResult.applied);

    // Restraint pass — bank pull-the-punch, then consume any prior banked die.
    let pulled = 0;
    if (target && Number(restraintReduction) > 0) {
      pulled = await game.fourththing.rolls.bankRestraint(actor, target, restraintReduction);
    }
    let bonus = 0;
    if (target) {
      const r = await game.fourththing.rolls.consumeRestraint(actor, target);
      bonus = r.bonus || 0;
    }
    const total   = roll.total - pulled + bonus;
    const success = total >= defenseValue;

    const restraintNote = (pulled || bonus)
      ? `<p style="font-size:0.78rem;color:#a0d4ff;margin:0.2rem 0 0">${[
          pulled > 0 ? `Restraint −${pulled} pulled (banked +1d4 vs. ${target?.name ?? "target"})` : "",
          bonus  > 0 ? `Restraint +${bonus} consumed`                                              : ""
        ].filter(Boolean).join(" · ")}</p>`
      : "";

    // Faculty → damage. The chosen intent attribute (plus any AE bonus to it)
    // adds to the damage roll on a hit. Skill is left out — proficiency drives
    // accuracy, raw faculty drives force. The +mod is baked straight into the
    // formula so the Apply button rolls the final number with no extra plumbing.
    const damageFacultyMod = (Number(attrVal) || 0) + (Number(aeAttr) || 0);
    const finalDamageFormula = (damageFormula && damageFacultyMod !== 0)
      ? `${damageFormula} ${damageFacultyMod >= 0 ? "+" : "-"} ${Math.abs(damageFacultyMod)}`
      : (damageFormula || "");

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  buildAttackChatHTML({
        label, intent, skill, defense, defenseValue,
        attrVal, skillVal, total, success, diceResults,
        explosionDice, surgeBanked: explosions, doubleTen,
        damageFormula: success ? finalDamageFormula : "",
        damageFacultyMod, damageBaseFormula: damageFormula,
        damageType, damageFlavor, costNote, signature, thirdThing
      }) + restraintNote + (flankMod > 0
        ? `<p style="font-size:0.78rem;color:#e8c84a;margin:0.2rem 0 0">⚔ Flanking: +${flankMod} (${flankMod + 1} melee threats)</p>`
        : "") + (aeContribs.length
        ? `<p style="font-size:0.78rem;color:#e8c84a;margin:0.2rem 0 0">Passives: ${
            aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")
          }</p>`
        : "") + (rerollResult.applied.length
        ? `<p style="font-size:0.78rem;color:#a0d4ff;margin:0.2rem 0 0">Reroll: ${
            rerollResult.applied.map(r => `${r.mode === "reroll-lowest" ? "↑" : "↓"} ${r.before}→${r.after} (${r.source})`).join(", ")
          }</p>`
        : "")
    });

    // Reality Tear — attacks are always on; defenseValue is the DC. Tier gate
    // means a Tier-IV bashing a Tier-I mook is when the ground actually breaks.
    if (success) {
      await game.fourththing.rolls.applyOvershoot(actor, {
        target, total, dc: Number(defenseValue), kind: "attack", optIn: true
      });

      // Phase C trigger: on-attack-hit. Payload includes:
      //   tags  — for predicate.tag matching (skill, defense, intent)
      //   maxDie — for predicate.dieMin (e.g. Polarity Mastery's "any die ≥ 8")
      const baseDieValues = (roll.terms?.[0]?.results ?? []).slice(0, 2).map(r => r.result);
      const maxDie = Math.max(0, ...baseDieValues);
      const tags = [skill, defense, intent, damageType].filter(Boolean);
      await fireTriggers(actor, "on-attack-hit", { tags, maxDie, scope: "self" });
    }
    return { roll, success };
  };

  // ── Apply damage from chat button ──────────────────────────────────────────
  // Phase 3 engine: system.derived.defenses = { resistances, immunities, vulnerabilities }
  // is computed per-actor in prepareDerivedData. Entries are { type, flavor } objects.
  // Pipeline order: immunity (×0) → vulnerability (×2) → resistance (×½, floor).
  // Radiation track always accumulates since it has its own damage key.
  // Per-actor damage / heal apply. Extracted from applyDamageFromButton so
  // the AoE cast path can call into the same defense math + dying-cycle +
  // trigger plumbing instead of duplicating it. baseDmg is the un-scaled
  // damage value; perTargetMultiplier scales for AoE save outcomes (1.0 /
  // 0.5 / 0). Returns a short description for chat-card summaries.
  game.fourththing.rolls._applyDamageToActor = async function (actor, baseDmg, {
    op = "damage", track = "integrity", damageType = "", damageFlavor = "",
    perTargetMultiplier = 1
  } = {}) {
    if (!actor) return null;
    const rawSys = actor.system?.system ?? actor.system;
    const safeMult = (Number.isFinite(perTargetMultiplier) && perTargetMultiplier >= 0) ? perTargetMultiplier : 1;
    const scaled = Math.max(0, Math.floor((Number(baseDmg) || 0) * safeMult));

    if (op === "heal") {
      if (track === "radiation") return `${actor.name}: cannot heal radiation`;
      const cur = rawSys?.derived?.[track]?.value ?? 0;
      const max = rawSys?.derived?.[track]?.max   ?? cur + scaled;
      const newVal = Math.min(max, cur + scaled);
      await actor.update({ [`system.derived.${track}.value`]: newVal });
      return `${actor.name}: ${track} ${cur} → ${newVal} (+${newVal - cur})`;
    }

    // Resolve defense multiplier (immunity shadows; vuln + resist stack).
    let defMult = 1;
    const tags = [];
    if (damageType) {
      const def = rawSys?.derived?.defenses ?? {};
      const flavorLabel = damageFlavor ? `${damageType}:${damageFlavor}` : damageType;
      if (ftDefenseMatches(def.immunities, damageType, damageFlavor)) {
        defMult = 0;
        tags.push(`immune to ${flavorLabel}`);
      } else {
        if (ftDefenseMatches(def.vulnerabilities, damageType, damageFlavor)) {
          defMult *= 2;
          tags.push(`vulnerable to ${flavorLabel}`);
        }
        if (ftDefenseMatches(def.resistances, damageType, damageFlavor)) {
          defMult *= 0.5;
          tags.push(`resist ${flavorLabel}`);
        }
      }
    }
    const defenseTag = tags.length ? ` (${tags.join(", ")})` : "";
    const dmg = Math.floor(scaled * defMult);

    if (track === "radiation") {
      const cur = rawSys?.radiation?.rp ?? 0;
      const newVal = cur + dmg;
      await actor.update({ "system.radiation.rp": newVal });
      const thr = rawSys?.radiation?.thresholds ?? { minor: 25, major: 50, severe: 75 };
      const crossed = [];
      for (const [name, val] of Object.entries(thr)) {
        if (cur < val && newVal >= val) crossed.push(`${name} (${val})`);
      }
      const thrNote = crossed.length ? ` — crossed ${crossed.join(", ")}` : "";
      return `${actor.name}: radiation ${cur} → ${newVal} (+${dmg})${defenseTag}${thrNote}`;
    }

    const cur    = rawSys?.derived?.[track]?.value ?? 0;
    const newVal = Math.max(0, cur - dmg);

    // Fires BEFORE the write so a Frame Die can react while still standing.
    // Guarded so already-destroyed rigs (cur===0) re-hit by AoE don't re-fire.
    if (track === "integrity" && (cur - dmg) <= 0 && cur > 0) {
      await fireTriggers(actor, "on-would-drop-to-zero", { amount: dmg, scope: "self" });
    }

    // B11.B (2026-05-12): rigs and bosses store canonical integrity at
    // system.integrity, not system.derived.integrity (which is a read-only
    // mirror seeded in prepareDerivedData). Write to the canonical store.
    // Rigs additionally flip identity.state to "destroyed" on the transition
    // from >0 to 0 (token wreck overlay reads identity.state). Bosses use
    // their phase ladder for "defeated" semantics — no state flip here.
    const isRig = actor.type === "rig";
    const isBoss = actor.type === "boss";
    const isStructural = isRig || isBoss;
    const rigDestroyed = isRig && track === "integrity" && cur > 0 && newVal <= 0;
    const writeKey = (isStructural && track === "integrity")
      ? "system.integrity.value"
      : `system.derived.${track}.value`;
    const updates = { [writeKey]: newVal };
    if (rigDestroyed) updates["system.identity.state"] = "destroyed";
    if (isBoss && track === "integrity") {
      console.log(`[fourththing] boss damage: ${actor.name} integrity ${cur} → ${newVal} (writeKey=${writeKey})`);
    }
    await actor.update(updates);

    // Damage-while-dying: +1 failure (or +2 if massive ≥ tier × 5).
    if (track === "integrity" && actor.type === "character" && rawSys?.conditions?.dying) {
      const tier   = rawSys?.details?.tier ?? 1;
      const massive = dmg >= tier * 5;
      await game.fourththing.deathMech.addFailures(actor, massive ? 2 : 1);
    }

    // on-damage-taken trigger after the write so resistances have applied.
    if (dmg > 0) {
      const trigTags = [damageType, damageFlavor].filter(Boolean);
      await fireTriggers(actor, "on-damage-taken", { amount: dmg, tags: trigTags, scope: "self" });
    }

    // B11.B rig hooks + destruction cascade.
    if (isRig && track === "integrity") {
      if (dmg > 0) {
        Hooks.callAll("bbttcc:rig:damaged", { rig: actor, amount: dmg, type: damageType, flavor: damageFlavor, newIntegrity: newVal });
      }
      if (rigDestroyed) {
        Hooks.callAll("bbttcc:rig:destroyed", { rig: actor, finalHit: dmg });
        await _ftCascadeRigDestruction(actor);
      }
    }
    // 2026-05-13 — Boss damage hooks (parallel to rig hooks). Powers the
    // boss-impact + boss-defeat VFX subscribers. Bosses don't trigger a
    // crew cascade — defeat is tracked via integrity + phase ladder.
    if (isBoss && track === "integrity") {
      if (dmg > 0) {
        Hooks.callAll("bbttcc:boss:damaged", { boss: actor, amount: dmg, type: damageType, flavor: damageFlavor, newIntegrity: newVal });
      }
      if (newVal <= 0 && cur > 0) {
        Hooks.callAll("bbttcc:boss:defeated", { boss: actor, finalHit: dmg });
      }
    }

    const destroyedTag = rigDestroyed ? " — DESTROYED" : "";
    return `${actor.name}: ${track} ${cur} → ${newVal} (−${dmg})${defenseTag}${destroyedTag}`;
  };

  game.fourththing.rolls.applyDamageFromButton = async function (btn) {
    const formula      = btn.dataset.formula;
    const track        = btn.dataset.track ?? "integrity";
    const damageType   = String(btn.dataset.damageType   ?? "").toLowerCase();
    const damageFlavor = String(btn.dataset.damageFlavor ?? "").toLowerCase();
    const op           = String(btn.dataset.op ?? "damage").toLowerCase();
    const targets      = game.user.targets;

    if (!targets.size) {
      ui.notifications.warn("No tokens targeted. Target a token first, then click Apply.");
      return;
    }

    const roll = new Roll(formula);
    await roll.evaluate();
    const baseDmg = roll.total;

    for (const token of targets) {
      const actor = token.actor;
      if (!actor) continue;
      const desc = await game.fourththing.rolls._applyDamageToActor(actor, baseDmg, {
        op, track, damageType, damageFlavor, perTargetMultiplier: 1
      });
      if (desc) ui.notifications.info(desc);
    }

    btn.textContent   = `Applied`;
    btn.disabled      = true;
    btn.style.opacity = "0.5";
  };

  // ── Soma Break ─────────────────────────────────────────────────────────────
  // One-ceremony refresh of every rechargeable resource (Soma Break — RFI canon).
  // Friction counters (noise, radiation, darkness) and narrative conditions are preserved.
  game.fourththing.actions = game.fourththing.actions ?? {};

  // Manifestation Wizard V2 — canonical entry point. All in-tree callers
  // now route through V2 (six callsites flipped 2026-05-06). Legacy
  // openManifestationWizard is kept defined but unreferenced for now.
  game.fourththing.wizardV2 = openManifestationWizardV2;

  // castManifestation — exposed for module-level callers (Phase C 2026-05-07,
  // Dreamwalker Dream-Cache Deploy in ft-class-automation needs to re-fire
  // a cast at no Clarity cost).
  game.fourththing.castManifestation = castManifestation;

  // createManifestationItemData — exposed 2026-05-17 so the BBTTCC Boss
  // Builder (bbttcc-auto-link/scripts/boss-builder.js) can synthesize
  // template-appropriate manifestations as embedded items at boss-create
  // time without having to replicate the schema. Same shape the wizard
  // produces; safe to call with minimal `values` objects.
  game.fourththing.createManifestationItemData = createManifestationItemData;
  game.fourththing.actions.somaBreak = async function (actor, { confirmed = false } = {}) {
    if (!actor) return;

    // Soft GM gate: first press in a scene just works; repeat presses prompt confirmation.
    const sceneId   = game.scenes?.current?.id ?? null;
    const lastBreak = actor.getFlag("fourththing", "lastSomaBreakScene");
    if (!confirmed && lastBreak && sceneId && lastBreak === sceneId) {
      const ok = await Dialog.confirm({
        title:   "Soma Break",
        content: `<p style="font-size:0.85rem">Another Soma Break this scene?</p>
                  <p style="font-size:0.78rem;opacity:0.75;font-style:italic">
                    Soma Breaks are GM-gated — confirm the fiction justifies it.
                  </p>`
      });
      if (!ok) return;
    }

    const rawSys = actor.system?.system ?? actor.system;
    const sys    = rawSys ?? {};

    // Bill Bound/Enduring upkeep against pre-refill Clarity. Anything we
    // can't afford is dropped before the Soma Break refills the pool.
    await ftChargeUpkeep(actor, { stabilities: ["bound", "enduring"], cadence: "Soma Break" });

    const updates = {
      "system.magic.clarity.value":            sys.magic?.clarity?.max            ?? 5,
      // Refill to the live max. The literal fallbacks used to be `?? 3` which
      // leaked the dnd5e template default when max was undefined (e.g. fresh
      // wizard-created Bulwark before prepareDerivedData runs). Drop to `?? 0`
      // — derived prep will set the right max immediately on the next render
      // and current can grow into it on the next refill rather than overshoot.
      "system.resources.frameDice.current":    sys.resources?.frameDice?.max      ?? 0,
      "system.resources.accessDice.current":   sys.resources?.accessDice?.max     ?? 0,
      "system.resources.ruinCharges.current":  sys.resources?.ruinCharges?.max    ?? 0,
      // Cosmic Linguist — Resonance refills to max; Strain wipes (the friction
      // counter resets when the caster centers themselves at the deeper rest).
      "system.resources.resonanceDice.current": sys.resources?.resonanceDice?.max ?? 0,
      "system.resources.strain.value":          0,
      // Phase B 2026-05-07 — narrative caster pools refill on Soma Break,
      // mirroring the CL ceremony.
      "system.resources.clAuthority.current":   sys.resources?.clAuthority?.max   ?? 0,
      "system.resources.pactLeverage.current":  sys.resources?.pactLeverage?.max  ?? 0,
      "system.resources.probabilityOverlay.current": sys.resources?.probabilityOverlay?.max ?? 0,
      // Dream-Cache empties on Soma Break — banked manifestations expire when
      // the caster's between-scenes lane closes at the deeper rest.
      "system.resources.dreamCache.banked":     false,
      "system.resources.dreamCache.name":       "",
      "system.resources.dreamCache.tier":       0,
      "system.resources.dreamCache.itemId":     "",
      "system.resources.burn.current":         0,
      "system.resources.forgeCharge.relicUsed": false,
      "system.resources.surge.value":          0,
      "system.derived.integrity.value":        sys.derived?.integrity?.max        ?? 16,
      "system.derived.stress.value":           sys.derived?.stress?.max           ?? 16
    };

    // Structural stress (Titanbound) is a rechargeable, not a friction counter.
    if (sys.resources?.stress?.max !== undefined) {
      updates["system.resources.stress.current"] = 0;
    }

    // Dreamwalker — Dream Echo Reservoir gains 1 die per Soma Break (capped
    // at maxDice=2 per canonical L13 feature). prepareDerivedData clamps later;
    // we just push current up by 1 here.
    if (sys.resources?.echoDice?.maxDice > 0) {
      const _curEcho = Number(sys.resources.echoDice.dice ?? 0) || 0;
      const _maxEcho = Number(sys.resources.echoDice.maxDice ?? 0) || 0;
      updates["system.resources.echoDice.dice"] = Math.min(_maxEcho, _curEcho + 1);
    }

    // Reset all item uses (feats, features, weapon/power ability slots).
    const itemUpdates = [];
    for (const item of actor.items ?? []) {
      const maxUses   = item.system?.uses?.max   ?? 0;
      const spentUses = item.system?.uses?.spent ?? 0;
      if (maxUses > 0 && spentUses > 0) {
        itemUpdates.push({ _id: item.id, "system.uses.spent": 0 });
      }
    }

    // Restore any aptitude ranks burned via Manifestation sacrifice (Blood
    // Debt refit 2026-05-09). Burned ranks live in flags.fourththing.aptitudeBurn
    // as an array of { key, ranks, ts, source }. Add them back and clear the flag.
    try {
      const burnFlag = actor.flags?.fourththing?.aptitudeBurn;
      if (Array.isArray(burnFlag) && burnFlag.length) {
        for (const entry of burnFlag) {
          if (!entry?.key) continue;
          const path = `system.skills.${entry.key}.value`;
          const cur  = Number(foundry.utils.getProperty(actor, path) ?? 0) || 0;
          updates[path] = cur + Math.max(0, Number(entry.ranks) || 0);
        }
      }
    } catch (_e) {}

    // Clear manifestation lockout flag (Blood Debt refit 2026-05-09).
    if (Number(actor.flags?.fourththing?.manifestationLockout) > 0) {
      updates["flags.fourththing.-=manifestationLockout"] = null;
    }

    await actor.update(updates);
    if (itemUpdates.length) await actor.updateEmbeddedDocuments("Item", itemUpdates);
    if (sceneId) await actor.setFlag("fourththing", "lastSomaBreakScene", sceneId);
    if (Array.isArray(actor.flags?.fourththing?.aptitudeBurn) && actor.flags.fourththing.aptitudeBurn.length) {
      await actor.unsetFlag("fourththing", "aptitudeBurn");
    }
    // Clear the one-shot double-10 bonus action if it lingered across scenes.
    if (actor.flags?.fourththing?.bonusActionAvailable) {
      await actor.unsetFlag("fourththing", "bonusActionAvailable");
    }

    // Auto-reset per-discipline use trackers used by _openSomaBreakAbility
    // (boolean) and _openTierUsesPerSomaBreak (number). Without this, players
    // had to manually click "Reset" on each ability's dialog after a Soma
    // Break — a long-standing UX papercut. Wired 2026-04-29 with the Phase 3
    // tier-uses helper so the new mechanic resets cleanly.
    const ftFlags = actor.flags?.fourththing ?? {};
    const flagResets = {};
    for (const k of Object.keys(ftFlags.disciplineUsed  ?? {})) flagResets[`flags.fourththing.disciplineUsed.${k}`]  = false;
    for (const k of Object.keys(ftFlags.disciplineSpent ?? {})) flagResets[`flags.fourththing.disciplineSpent.${k}`] = 0;
    if (Object.keys(flagResets).length) await actor.update(flagResets);

    // Phase D — fire any items that grant a resource on Soma Break (passive
    // "+1 Intrigue OP per Soma Break", "Pace refills" etc.).
    const grantResult = await fireResourceGrants(actor, "per-soma-break");
    const grantNote = grantResult.fired.length
      ? `<p style="margin:0.3rem 0 0;font-size:0.78rem;color:#a0d4ff">Resource grants: ${
          grantResult.fired.map(g => `${g.amount === "refill" ? "↻" : `+${g.amount}`} ${g.resource} → ${g.target} (${g.source})`).join(", ")
        }</p>`
      : "";

    // Phase C — reset soma-break-windowed trigger limits, then fire on-soma-break triggers
    await resetSomaBreakTriggerLimits(actor);
    const trigResult = await fireTriggers(actor, "on-soma-break", { scope: "self" });
    const trigNote = trigResult.fired.length
      ? `<p style="margin:0.3rem 0 0;font-size:0.78rem;color:#cfa0ff">Triggers: ${
          trigResult.fired.map(t => `${t.summary} (${t.source})`).join(", ")
        }</p>`
      : "";

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header">
          <span class="ft-roll-name">❈ Soma Break — ${actor.name}</span>
        </div>
        <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.85">
          The body remembers what it was. Uses restored, tracks reset, Integrity and Stress refilled.
        </p>
        <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.55;font-style:italic">
          Noise, Radiation, and Darkness persist — they require fiction to reduce.
        </p>${grantNote}${trigNote}
      </div>`
    });

    return { itemsReset: itemUpdates.length, grantResult, trigResult };
  };

  // ── Scene Break — half-Clarity refill, clear 1 Noise ───────────────────────
  // Lighter recovery cadence between Soma Breaks. Refills Clarity to at least
  // half its max (round up), shaves 1 Noise off the pool, and posts a chat
  // card. Universal — every actor can take a Scene Break — but the deeper
  // pool TCCs carry means they get more out of it. No flag tracking; can be
  // taken multiple times per scene if the GM allows the fiction.
  game.fourththing.actions.sceneBreak = async function (actor) {
    if (!actor) return;
    const rawSys = actor.system?.system ?? actor.system ?? {};
    const sys    = rawSys ?? {};
    const curC   = Number(sys.magic?.clarity?.value) || 0;
    const maxC   = Number(sys.magic?.clarity?.max)   || 5;
    const halfC  = Math.ceil(maxC / 2);
    const newC   = Math.min(maxC, Math.max(curC, halfC));
    const curN   = Number(sys.magic?.noise?.value)   || 0;
    const newN   = Math.max(0, curN - 1);

    const updates = {};
    const deltas  = [];
    if (newC !== curC) { updates["system.magic.clarity.value"] = newC; deltas.push(`Clarity ${curC} → ${newC}`); }
    if (newN !== curN) { updates["system.magic.noise.value"]   = newN; deltas.push(`Noise ${curN} → ${newN}`); }
    if (Object.keys(updates).length) await actor.update(updates);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name">◐ Scene Break — ${actor.name}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.85">
          A breath between scenes. The pressure eases — not gone, but enough.
        </p>
        ${deltas.length
          ? `<p style="margin:0.2rem 0;font-size:0.78rem">${deltas.join(" · ")}</p>`
          : `<p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.55;font-style:italic">Already at scene-break baseline; nothing recovered.</p>`}
        <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.55;font-style:italic">
          Refills Clarity to at least half max, shaves 1 Noise. Soma Break is the deeper reset.
        </p>
      </div>`
    });
    return { newClarity: newC, newNoise: newN };
  };

  // ── Fiat (T0) — TCC-only no-roll spoken cue ────────────────────────────────
  // Always-available cantrip-flavor cast: no roll, no misfire, no resource
  // cost, no upkeep. The "I light the candle with a thought" register that
  // makes a TCC feel like a caster between proper workings. Restricted to
  // Trad Caster Classes — non-TCCs do not have access.
  //
  // Narrative constraint: Fiats MUST begin with "Let there be …". The action
  // auto-prepends the phrase if the caller's text doesn't already lead with it.
  function _ensureFiatPrefix(s) {
    const t = String(s || "").trim();
    if (!t) return "";
    return /^let there be\b/i.test(t) ? t : `Let there be ${t}`;
  }

  game.fourththing.actions.fiat = async function (actor, { description = "" } = {}) {
    if (!actor) return;
    if (!isTCC(actor)) {
      ui.notifications?.warn(`${actor.name}: Fiats are reserved for Trad Caster Classes (Cosmic Linguist, Wyrdlens Adept, Dreamwalker, Pactkeeper).`);
      return false;
    }

    // Player-supplied flavor text via prompt; falls back to a generic line.
    let desc = description;
    if (!desc) {
      desc = await Dialog.prompt({
        title:   "Fiat (T0)",
        content: `<p style="font-size:0.78rem;margin:0 0 0.4rem">A trivial spoken cue — no check, no resource. Every Fiat begins with <b>"Let there be …"</b>. Complete the phrase.</p>
                  <div style="display:flex;gap:0.35rem;align-items:center">
                    <span style="font-size:0.82rem;font-style:italic;opacity:0.85">Let there be</span>
                    <input type="text" name="desc" placeholder="…light. …a candle. …a door that knows my name." style="flex:1;padding:0.3rem 0.4rem"/>
                  </div>`,
        label:   "Speak the Fiat",
        callback: (html) => html.find("[name='desc']").val() || ""
      }).catch(() => null);
      if (desc === null) return; // cancelled
      if (!desc) desc = "an ambient flicker — no completion was offered";
    }

    const phrase = _ensureFiatPrefix(desc);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name">◌ Fiat — ${actor.name}</span></div>
        <p style="margin:0.3rem 0;font-size:0.82rem;font-style:italic">"${foundry.utils.escapeHTML?.(phrase) ?? phrase}"</p>
        <p style="margin:0.2rem 0;font-size:0.7rem;opacity:0.5">
          T0 · spoken cue · 'Let there be …' · no roll · no resource
        </p>
      </div>`
    });
    return true;
  };
  // Back-compat alias for any existing macros / external callers.
  game.fourththing.actions.lesserManifestation = game.fourththing.actions.fiat;

  // ── End Scene — Sustained manifestation upkeep tick ────────────────────────
  // Sustained workings cost 1 Clarity × tier per scene. Callable from the
  // Active strip on the manifestation tab or via macro.
  game.fourththing.actions.endScene = async function (actor) {
    if (!actor) return;
    return ftChargeUpkeep(actor, { stabilities: ["sustained"], cadence: "End Scene" });
  };

  // ── Condition toggle ───────────────────────────────────────────────────────
  // V1 condition→AE change baker. Returns the changes[] for an AE created when a
  // condition is applied. Empty for now — the roll path consumes
  //   system.attributes.<x>.value, system.skills.<x>.value, system.magic.clarity.value
  // (see attributeTest/attackTest at ~3304/3304/3617). Condition descriptions
  // reference attack rolls, defenses, and movement — none of which have AE keys yet.
  // Fill these in as engine support lands; the AE itself already provides token-HUD
  // visibility and the States-tab Conditions row.
  function _ftConditionAEChanges(_condKey) {
    return [];
  }

  // Mirror a condition flag onto an ActiveEffect so it shows on the token HUD,
  // appears under the States tab, and is programmatically queryable. Tagged
  // with flags.fourththing.condition so we can find/delete it on toggle off.
  async function _ftSyncConditionAE(actor, condKey, on) {
    const cond = FT.CONDITIONS?.[condKey];
    if (!cond) return;
    const existing = actor.effects?.find(e => e.flags?.fourththing?.condition === condKey);
    if (on) {
      if (existing) return;
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        name:    cond.label,
        icon:    "icons/svg/aura.svg",
        img:     "icons/svg/aura.svg",
        tint:    cond.color,
        origin:  actor.uuid,
        statuses: [condKey],
        changes: _ftConditionAEChanges(condKey),
        flags:   { fourththing: { condition: condKey } }
      }]);
    } else if (existing) {
      await existing.delete();
    }
  }

  game.fourththing.toggleCondition = async function (actor, condKey) {
    const rawSys  = actor.system?.system ?? actor.system;
    const current = rawSys?.conditions?.[condKey] ?? false;
    const newVal  = !current;
    // Phase 3: refuse to set a condition true if the actor is immune to it.
    // Derived immunities (union of base + item grants) are computed each prepareDerivedData.
    if (newVal === true) {
      const immune = rawSys?.derived?.defenses?.conditionImmunities ?? [];
      if (immune.includes(condKey)) {
        ui.notifications?.info?.(`${actor.name} is immune to ${FT.CONDITIONS?.[condKey]?.label ?? condKey}.`);
        return current;
      }
    }
    await actor.update({ [`system.conditions.${condKey}`]: newVal });
    await _ftSyncConditionAE(actor, condKey, newVal);
    const cond = FT.CONDITIONS[condKey];
    if (newVal) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="fourththing-roll">
          <span class="ft-condition-applied" style="color:${cond.color}">
            ◈ ${actor.name} gains condition: <b>${cond.label}</b>
          </span>
          <p class="ft-condition-desc">${cond.desc}</p>
        </div>`
      });
    }
    return newVal;
  };

  // ── Apply manifestation states to a target ─────────────────────────────
  // Walks a manifestation's appliedStates block and creates ActiveEffects on
  // the target for each condition. Each AE carries flags.fourththing.condition
  // (so toggle/clear logic recognises it) AND flags.fourththing.appliedManifestation
  // (carrying save-each-round metadata that _ftHandleTurnStart consumes).
  // Respects derived condition immunities. Posts a single chat card listing
  // applied + skipped states.
  game.fourththing.applyManifestationStates = async function (caster, target, item, mf, { castDc = 15 } = {}) {
    if (!caster || !target || !mf?.appliedStates?.states?.length) return null;
    const cfg = mf.appliedStates;
    const tSys = target.system?.system ?? target.system ?? {};
    const immune = new Set(tSys?.derived?.defenses?.conditionImmunities ?? []);

    // Resolve duration to AE duration object. "until-saved" / "scene" don't
    // tick rounds — they're ended by the save-each-round handler or scene
    // boundary. Round-based durations get `rounds` so Foundry decrements.
    const combat = game.combat;
    const dur = cfg.duration ?? "1-round";
    const roundsByKey = { "1-round": 1, "2-rounds": 2, "3-rounds": 3 };
    const aeDuration = (roundsByKey[dur] && combat)
      ? { rounds: roundsByKey[dur], startRound: combat.round, startTurn: combat.turn, combat: combat.id }
      : {};

    const dc = cfg.saveDcMode === "fixed" ? (Number(cfg.saveDcFixed) || 15) : (Number(castDc) || 15);
    const globalSaveAttr = cfg.saveAttribute || "body";
    const overrides = (cfg.saveAttributeOverrides && typeof cfg.saveAttributeOverrides === "object")
      ? cfg.saveAttributeOverrides : {};

    const applied = [];
    const skipped = [];
    for (const condKey of cfg.states) {
      const cond = FT.CONDITIONS?.[condKey];
      if (!cond) continue;
      if (immune.has(condKey)) {
        skipped.push({ key: condKey, reason: "immune" });
        continue;
      }
      // De-dupe — if target already carries this condition, skip rather than
      // stacking AEs (Foundry would render duplicate icons in the HUD).
      const existing = target.effects?.find?.(e => e.flags?.fourththing?.condition === condKey);
      if (existing) {
        skipped.push({ key: condKey, reason: "already-active" });
        continue;
      }

      // Per-condition save attribute — falls back to global when no override.
      const saveAttr = overrides[condKey] || globalSaveAttr;

      const aeData = {
        name:    cond.label,
        icon:    "icons/svg/aura.svg",
        img:     "icons/svg/aura.svg",
        tint:    cond.color,
        origin:  caster.uuid,
        statuses: [condKey],
        changes: (typeof _ftConditionAEChanges === "function") ? _ftConditionAEChanges(condKey) : [],
        duration: aeDuration,
        flags: {
          fourththing: {
            condition: condKey,
            appliedManifestation: {
              source:        caster.uuid,
              itemId:        item?.id ?? null,
              itemName:      item?.name ?? "Manifestation",
              dc,
              saveAttribute: saveAttr,
              saveEachRound: cfg.saveEachRound === true,
              durationKind:  dur,
              startRound:    combat?.round ?? null,
              startTurn:     combat?.turn ?? null
            }
          }
        }
      };

      try {
        await target.createEmbeddedDocuments("ActiveEffect", [aeData]);
        await target.update({ [`system.conditions.${condKey}`]: true });
        applied.push(condKey);
      } catch (e) {
        console.warn("Roll for Initiation | applyManifestationStates create failed", condKey, e);
        skipped.push({ key: condKey, reason: "create-failed" });
      }
    }

    // Chat surfacing.
    if (applied.length || skipped.length) {
      const appliedHtml = applied.length
        ? `<p style="margin:0.2rem 0;font-size:0.82rem"><b>Applied:</b> ${applied.map(k => {
            const c = FT.CONDITIONS?.[k];
            return `<span style="color:${c?.color ?? "#aaa"}">◈ ${c?.label ?? k}</span>`;
          }).join(" · ")}</p>`
        : "";
      const skippedHtml = skipped.length
        ? `<p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.75"><b>Skipped:</b> ${skipped.map(s => `${FT.CONDITIONS?.[s.key]?.label ?? s.key} (${s.reason})`).join(", ")}</p>`
        : "";
      const durLabel = { "1-round": "1 round", "2-rounds": "2 rounds", "3-rounds": "3 rounds", "scene": "scene", "until-saved": "until saved" }[dur] ?? dur;
      const overrideAppliedKeys = applied.filter(k => overrides[k]);
      const overrideNote = overrideAppliedKeys.length
        ? ` <span style="opacity:0.7">(${overrideAppliedKeys.map(k => `${FT.CONDITIONS?.[k]?.label ?? k}: ${ftCap(overrides[k])}`).join(", ")})</span>`
        : "";
      const saveLine = (cfg.saveEachRound && applied.length)
        ? `<p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85;color:#a0d4ff">↻ Save each round: <b>${ftCap(globalSaveAttr)}</b> vs DC <b>${dc}</b> — success ends the effect.${overrideNote}</p>`
        : `<p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.7">Duration: <b>${durLabel}</b>.</p>`;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: caster }),
        content: `<div class="fourththing-roll">
          <div class="ft-roll-header"><span class="ft-roll-name">◈ ${ftEscapeHtml(item?.name ?? "Manifestation")} — states applied to ${ftEscapeHtml(target.name)}</span></div>
          ${appliedHtml}${skippedHtml}${saveLine}
        </div>`
      });
    }

    return { applied, skipped };
  };

  // Hook: when an applied-manifestation AE is deleted (auto-expiry, save
  // success, or manual removal), clear the matching system.conditions flag
  // so the sheet's States tab stays in sync.
  Hooks.on("preDeleteActiveEffect", async (effect) => {
    const condKey = effect?.flags?.fourththing?.condition;
    const isApplied = effect?.flags?.fourththing?.appliedManifestation;
    if (!condKey || !isApplied) return;
    const actor = effect.parent;
    if (!actor || !actor.update) return;
    try { await actor.update({ [`system.conditions.${condKey}`]: false }); }
    catch (e) { /* actor may already be torn down — silent */ }
  });

  // ── Death & Dying: Last Stand engine ──────────────────────────────────────
  // Canon: when integrity hits 0 the actor enters Last Stand. On the start of
  // each of their turns they roll 2d10x10 (Surge engine). Both natural 10s =
  // Vision Surge (stabilize at 1 + flavor). Any 1 = failure tick. Else success.
  // 3 successes stabilize; 3 failures Cross the Threshold (Phase 2 wires the
  // Blood Debt + faction OP commit that follows).
  game.fourththing.deathMech = game.fourththing.deathMech ?? {};

  game.fourththing.deathMech.enterLastStand = async function (actor) {
    if (!actor) return;
    const sys = actor.system?.system ?? actor.system;
    if (sys?.conditions?.dying) return; // already dying
    await actor.update({
      "system.conditions.dying":       true,
      "system.lastStand.active":       true,
      "system.lastStand.successes":    0,
      "system.lastStand.failures":     0,
      "system.lastStand.ledger":       []
    });
    await _ftSyncConditionAE(actor, "dying", true);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#ff7373">☠ ${actor.name} enters Last Stand</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.85">Integrity has collapsed. The body holds the line — for now. Roll Last Stand at the start of each turn.</p>
      </div>`
    });
    Hooks.callAll("fourththing.enteredLastStand", actor);
  };

  game.fourththing.deathMech.stabilize = async function (actor, { vision = false } = {}) {
    if (!actor) return;
    const sys = actor.system?.system ?? actor.system;
    await actor.update({
      "system.conditions.dying":       false,
      "system.lastStand.active":       false,
      "system.lastStand.successes":    0,
      "system.lastStand.failures":     0,
      "system.derived.integrity.value": Math.max(1, sys?.derived?.integrity?.value ?? 0)
    });
    await _ftSyncConditionAE(actor, "dying", false);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#4a90d9">✦ ${actor.name} stabilizes${vision ? " — Vision Surge" : ""}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.85">${vision
          ? "Both dice bloom to 10. A vision cuts through the dark; the steward returns at 1 Integrity with something new in their eye."
          : "Three successes — the body holds. Revived at 1 Integrity."}</p>
      </div>`
    });
    Hooks.callAll("fourththing.stabilized", actor, { vision });
  };

  game.fourththing.deathMech.crossThreshold = async function (actor) {
    if (!actor) return;
    const sys  = actor.system?.system ?? actor.system;
    const tier = sys?.details?.tier ?? 1;
    await actor.update({
      "system.lastStand.active":    false
      // NB: conditions.dying stays true until Phase 2/3 resolves (Redemption ritual or Reincarnation).
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#ff7373">☠☠ ${actor.name} Crosses the Threshold</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.85">The body lets go. The debt is called. (Tier ${tier} — awaiting Blood Debt commit.)</p>
        <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.55;font-style:italic">Phase 2/3 will auto-attempt Redemption via the faction OP bank; until wired, the GM resolves manually.</p>
      </div>`
    });
    Hooks.callAll("fourththing.thresholdCrossed", actor, { tier });
  };

  game.fourththing.deathMech.rollLastStand = async function (actor) {
    if (!actor) return null;
    const sys = actor.system?.system ?? actor.system;
    if (!sys?.conditions?.dying) return null;

    const roll = new Roll("2d10x10");
    await roll.evaluate();
    const all     = roll.terms[0]?.results ?? [];
    const base    = all.slice(0, 2).map(r => r.result);
    const anyOne  = base.includes(1);
    const bothTen = base.filter(v => v === 10).length >= 2;

    // Resolve outcome
    let outcome; // "vision" | "success" | "failure"
    if (bothTen)      outcome = "vision";
    else if (anyOne)  outcome = "failure";
    else              outcome = "success";

    const prior      = sys.lastStand ?? { successes: 0, failures: 0, ledger: [] };
    const successes  = (prior.successes ?? 0) + (outcome === "success" ? 1 : 0);
    const failures   = (prior.failures  ?? 0) + (outcome === "failure" ? 1 : 0);
    const ledger     = [...(prior.ledger ?? []), {
      turn: game.combat?.round ?? 0,
      dice: base,
      outcome,
      ts: Date.now()
    }];

    const color = outcome === "vision" ? "#4a90d9" : outcome === "success" ? "#27ae60" : "#ff8a8a";
    const label = outcome === "vision" ? "Vision Surge" : outcome === "success" ? "Success" : "Failure";

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `<div class="fourththing-roll">
        <h3 style="color:${color};margin:0">Last Stand — ${label}</h3>
        <p style="margin:0.2rem 0;font-size:0.82rem">Dice: <b>${base.join(", ")}</b> · Successes <b>${successes}/3</b> · Failures <b>${failures}/3</b></p>
      </div>`
    });

    // Vision: stabilize immediately regardless of count.
    if (outcome === "vision") {
      await game.fourththing.deathMech.stabilize(actor, { vision: true });
      return { outcome, successes, failures };
    }

    // Persist counters + ledger before cascade decisions.
    await actor.update({
      "system.lastStand.successes": successes,
      "system.lastStand.failures":  failures,
      "system.lastStand.ledger":    ledger
    });

    if (successes >= 3) {
      await game.fourththing.deathMech.stabilize(actor);
    } else if (failures >= 3) {
      await game.fourththing.deathMech.crossThreshold(actor);
    }
    return { outcome, successes, failures };
  };

  // Apply a failure tick directly (called when a dying actor takes damage).
  game.fourththing.deathMech.addFailures = async function (actor, n = 1) {
    if (!actor || n <= 0) return;
    const sys = actor.system?.system ?? actor.system;
    if (!sys?.conditions?.dying) return;
    const failures = (sys.lastStand?.failures ?? 0) + n;
    await actor.update({ "system.lastStand.failures": failures });
    if (failures >= 3) await game.fourththing.deathMech.crossThreshold(actor);
  };

  // ── Redemption ritual ─────────────────────────────────────────────────────
  // Commits (tier × 5) OP from the linked faction's bank (violence by default),
  // clears the Blood Debt ledger, revives the actor at 1 Integrity, and applies
  // the Soma Break penalty — tier × 2 Stress damage + Scarred condition. The
  // penalty reflects canon: the body came back but remembers the Threshold.
  game.fourththing.deathMech.redeem = async function (actor, { category = "violence", costOverride = null, silent = false } = {}) {
    if (!actor) return { ok: false, reason: "no-actor" };
    if (!game.user.isGM) {
      ui.notifications?.warn("Redemption must be resolved by the GM.");
      return { ok: false, reason: "not-gm" };
    }

    const sys  = actor.system?.system ?? actor.system;
    const tier = Number(sys?.details?.tier ?? 1);
    const cost = Number(costOverride ?? (tier * 5));

    // Re-probe right before commit — faction OP may have shifted since the
    // threshold card was posted.
    const probe = game.fourththing.bloodDebt.probe(actor, { cost, category });
    if (!probe.faction) {
      ui.notifications?.error(`${actor.name}: no linked faction — Redemption unavailable.`);
      return { ok: false, reason: "no-faction" };
    }
    if (!probe.canCover) {
      ui.notifications?.warn(`${actor.name}: ${probe.faction.name} only has ${probe.available} ${category} OP (needs ${cost}).`);
      return { ok: false, reason: "insufficient-op", probe };
    }

    const opApi = game.bbttcc?.api?.op;
    if (!opApi?.commit) {
      ui.notifications?.error("bbttcc-factions OP engine not loaded — cannot commit Redemption.");
      return { ok: false, reason: "no-engine" };
    }

    const commitResult = await opApi.commit(
      probe.faction.id,
      { [category]: -cost },
      { context: "blood-debt-redemption", actorId: actor.id, tier }
    );
    if (!commitResult?.committed) {
      ui.notifications?.error(`Redemption commit rejected: ${commitResult?.error ?? "unknown"}`);
      return { ok: false, reason: "commit-rejected", result: commitResult };
    }

    // Clear the debt (archives snapshot under flags.fourththing.bloodDebtHistory).
    await game.fourththing.bloodDebt.clear(actor, { reason: "redemption" });

    // Revive with Soma Break penalty.
    const curStress   = Number(sys?.derived?.stress?.value ?? 0);
    const stressCost  = tier * 2;
    const newStress   = Math.max(0, curStress - stressCost);
    await actor.update({
      "system.conditions.dying":        false,
      "system.conditions.scarred":      true,
      "system.lastStand.active":        false,
      "system.lastStand.successes":     0,
      "system.lastStand.failures":      0,
      "system.lastStand.ledger":        [],
      "system.derived.integrity.value": 1,
      "system.derived.stress.value":    newStress,
      "flags.fourththing.-=awaitingReincarnation": null
    });

    if (!silent) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="fourththing-roll">
          <div class="ft-roll-header"><span class="ft-roll-name" style="color:#4a90d9">⚖ Blood Debt Redeemed — ${actor.name}</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.9">
            <b>${probe.faction.name}</b> covers the debt: <b>${cost} ${category} OP</b> spent from the bank.
          </p>
          <p style="margin:0.2rem 0;font-size:0.82rem">
            The steward returns at <b>1 Integrity</b>, ${stressCost} Stress expended, <b>Scarred</b> until the scene ends.
          </p>
          <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.55;font-style:italic">
            The body remembers what it almost lost. The ledger is closed — for now.
          </p>
        </div>`
      });
    }

    Hooks.callAll("fourththing.redeemed", actor, { cost, category, faction: probe.faction, tier });
    return { ok: true, cost, category, faction: probe.faction, tier };
  };

  // ── Reincarnation (stub) ──────────────────────────────────────────────────
  // Phase 4 will build the full regen flow (heritage reroll, Echo Asset loss,
  // carry-forward ledger). For now this flags the actor as awaiting GM
  // resolution and fires a hook so downstream tooling can pick it up.
  game.fourththing.deathMech.forceReincarnation = async function (actor, { reason = "threshold" } = {}) {
    if (!actor) return { ok: false, reason: "no-actor" };
    if (!game.user.isGM) {
      ui.notifications?.warn("Reincarnation must be resolved by the GM.");
      return { ok: false, reason: "not-gm" };
    }
    const sys  = actor.system?.system ?? actor.system;
    const tier = Number(sys?.details?.tier ?? 1);
    await actor.setFlag("fourththing", "awaitingReincarnation", {
      reason,
      tier,
      bloodDebtSnapshot: game.fourththing.bloodDebt.get(actor),
      ts: Date.now()
    });

    ChatMessage.create({
      whisper: game.users.filter(u => u.isGM).map(u => u.id),
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#ff7373">☠ Reincarnation pending — ${actor.name}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem">Tier ${tier}. Blood Debt ledger preserved for carry-forward. Body is gone.</p>
        <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.55;font-style:italic">
          Reason: ${reason}. Phase 4 will surface the regen wizard; for now, GM resolves manually.
        </p>
      </div>`
    });
    Hooks.callAll("fourththing.reincarnationPending", actor, { reason, tier });
    return { ok: true, tier };
  };

  // ── Blood Debt: native ledger ─────────────────────────────────────────────
  // First-class actor data at system.bloodDebt. Replaces the orphaned
  // bbttcc-core flag ledger (flags.bbttcc.identity.bloodDebt). A ready-time
  // migration (see below) folds any legacy flag data in and clears it.
  game.fourththing.bloodDebt = game.fourththing.bloodDebt ?? {};

  game.fourththing.bloodDebt.get = function (actor) {
    if (!actor) return { value: 0, ledger: [] };
    const sys = actor.system?.system ?? actor.system;
    const bd  = sys?.bloodDebt ?? {};
    return {
      value:  Number(bd.value ?? 0),
      ledger: Array.isArray(bd.ledger) ? [...bd.ledger] : []
    };
  };

  game.fourththing.bloodDebt.add = async function (actor, { value = 1, source = "manual", tag = "", note = "" } = {}) {
    if (!actor) return null;
    const cur    = game.fourththing.bloodDebt.get(actor);
    const entry  = {
      value:  Number(value) || 0,
      source: String(source),
      tag:    String(tag),
      note:   String(note),
      ts:     Date.now()
    };
    const ledger = [...cur.ledger, entry];
    const total  = cur.value + entry.value;
    await actor.update({
      "system.bloodDebt.value":  total,
      "system.bloodDebt.ledger": ledger
    });
    Hooks.callAll("fourththing.bloodDebtChanged", actor, { delta: entry.value, total, entry });
    return { total, entry };
  };

  game.fourththing.bloodDebt.clear = async function (actor, { reason = "redemption" } = {}) {
    if (!actor) return null;
    const cur = game.fourththing.bloodDebt.get(actor);
    if (cur.value === 0 && cur.ledger.length === 0) return { cleared: 0 };
    // Archive the ledger under a flag for history (non-authoritative, inspectable).
    const archive = (await actor.getFlag("fourththing", "bloodDebtHistory")) ?? [];
    archive.push({ clearedAt: Date.now(), reason, snapshot: cur });
    await actor.setFlag("fourththing", "bloodDebtHistory", archive);
    await actor.update({
      "system.bloodDebt.value":  0,
      "system.bloodDebt.ledger": []
    });
    Hooks.callAll("fourththing.bloodDebtCleared", actor, { reason, snapshot: cur });
    return { cleared: cur.value };
  };

  // Probe the linked faction's OP bank for a proposed cost without committing.
  // Default category is "violence" (death/body loss); callers may override per
  // cause of death. Returns { available, canCover, faction, category, cost }.
  game.fourththing.bloodDebt.probe = function (actor, { cost = 0, category = "violence" } = {}) {
    const faction = getLinkedFaction(actor);
    if (!faction) return { available: 0, canCover: false, faction: null, category, cost };
    // Faction OP lives in faction.system.op (per bbttcc-factions). We read
    // directly rather than invoking op-engine preview so the probe stays
    // safe in the absence of bbttcc-factions.
    const sys   = faction.system?.system ?? faction.system;
    const opBag = sys?.op ?? sys?.operations ?? {};
    const bucket = opBag?.[category];
    const available = Number(bucket?.value ?? bucket ?? 0);
    return {
      faction,
      category,
      cost,
      available,
      canCover: available >= cost
    };
  };

  // ── Wire threshold → native ledger + interactive GM ritual card ──────────
  // On crossing the Threshold, append a ledger entry, probe the linked faction
  // for cost coverage, and whisper an interactive chat card to GMs with Redeem
  // / Reincarnation buttons. The card self-disables after the GM resolves so
  // it cannot be double-committed.
  Hooks.on("fourththing.thresholdCrossed", async (actor, { tier = 1 } = {}) => {
    if (!actor || actor.type !== "character") return;
    if (!game.user.isGM) return; // one authoritative card per threshold

    const { total } = await game.fourththing.bloodDebt.add(actor, {
      value:  tier,
      source: "threshold",
      tag:    "Crossed the Threshold",
      note:   `Integrity collapse during combat, Tier ${tier}.`
    });

    const cost  = tier * 5;
    const probe = game.fourththing.bloodDebt.probe(actor, { cost, category: "violence" });
    const factionName = probe.faction?.name ?? "—";

    // Pull together the status block + action buttons.
    const statusLine = probe.canCover
      ? `<span style="color:#4a90d9">Redemption possible</span> — ${factionName} holds ${probe.available} violence OP.`
      : probe.faction
        ? `<span style="color:#ff8a8a">Redemption blocked</span> — ${factionName} only has ${probe.available} violence OP. Reincarnation required.`
        : `<span style="color:#ff8a8a">No linked faction</span> — Redemption unavailable. Reincarnation required.`;

    const redeemBtn = probe.canCover
      ? `<button class="ft-redeem-btn" data-actor-id="${actor.id}" data-cost="${cost}" data-category="violence"
                 style="margin-right:0.3rem;padding:0.35rem 0.6rem;background:rgba(74,144,217,0.12);
                        border:1px solid rgba(74,144,217,0.5);border-radius:4px;color:#4a90d9;cursor:pointer;
                        font-weight:600;font-size:0.82rem">⚖ Redeem (${cost} ${probe.faction?.name ?? ""} OP)</button>`
      : "";
    const reincarnateBtn = `<button class="ft-reincarnate-btn" data-actor-id="${actor.id}"
                 style="padding:0.35rem 0.6rem;background:rgba(255,138,138,0.14);
                        border:1px solid rgba(255,138,138,0.55);border-radius:4px;color:#ff8a8a;cursor:pointer;
                        font-weight:600;font-size:0.82rem">☠ Force Reincarnation</button>`;

    ChatMessage.create({
      whisper:  game.users.filter(u => u.isGM).map(u => u.id),
      speaker:  ChatMessage.getSpeaker({ actor }),
      content:  `<div class="fourththing-roll ft-redemption-card" data-actor-id="${actor.id}">
        <div class="ft-roll-header"><span class="ft-roll-name" style="color:#ff7373">⚖ Blood Debt called — ${actor.name}</span></div>
        <p style="margin:0.2rem 0;font-size:0.82rem">Ledger +${tier} (total: <b>${total}</b>). Redemption cost: <b>${cost} OP</b> (violence).</p>
        <p style="margin:0.2rem 0;font-size:0.82rem">${statusLine}</p>
        <div style="margin-top:0.4rem">${redeemBtn}${reincarnateBtn}</div>
        <p class="ft-redemption-outcome" style="margin:0.3rem 0 0;font-size:0.72rem;opacity:0.55;font-style:italic">Awaiting GM resolution.</p>
      </div>`
    });
  });

  // ── FourthThingActor ───────────────────────────────────────────────────────
  class FourthThingActor extends Actor {
    prepareDerivedData() {
      super.prepareDerivedData();
      // Unwrap double-system nesting from template.json "system" wrapper
      const sys = this.system?.system ?? this.system;

      // Rig defense derive (B11.A — 2026-05-12). Rigs don't carry attributes,
      // so the standard 10+attr+attr formula doesn't apply. Guard/Evasion come
      // from frame bracket; Resolve is flat. All three +tier on top. Live here
      // so the existing manifestation/weapon attack path (which reads
      // `derived.<defense>.value`) Just Works against rigs.
      // Boss defense derive (2026-05-12 playtest fix). Mirrors the rig
      // branch but defaults to the heavier "heavy" bracket. Bosses store
      // canonical integrity + defenses at the same paths rigs do; same
      // mirror pattern. The write-path fix below routes damage to canonical.
      if (this.type === "boss" && sys?.integrity) {
        const bracket = sys.integrity.bracket || "heavy";
        const tier = Math.max(1, Math.min(4, Number(sys.integrity.tier) || 1));
        const table = FT_RIG_DEFENSE_BY_BRACKET[bracket] ?? FT_RIG_DEFENSE_BY_BRACKET.heavy;
        sys.derived         ??= {};
        sys.derived.guard   ??= {}; sys.derived.guard.value   = table.guard   + tier;
        sys.derived.evasion ??= {}; sys.derived.evasion.value = table.evasion + tier;
        sys.derived.resolve ??= {}; sys.derived.resolve.value = table.resolve + tier;
        sys.derived.defenseBracket = bracket;
        // Mirror canonical so the unified _applyDamageToActor reads work.
        sys.derived.integrity ??= {};
        sys.derived.integrity.value = Number(sys.integrity.value) || 0;
        sys.derived.integrity.max   = Number(sys.integrity.max)   || 0;
        sys.derived.defenses = sys.defenses ?? { resistances: [], immunities: [], vulnerabilities: [] };
        // Damage-tracking unification 2026-05-13 — Phase ladder is now a
        // DERIVED VIEW of integrity. As integrity drops, phaseIdx advances
        // proportionally through the authored ladder. The boss sheet's
        // phase pill and the raid console's hit-track readout both read
        // this derived value going forward. The stored
        // `phases.currentPhase` field stays for back-compat / GM override
        // (a GM can manually set it; otherwise the derived value wins).
        const ladder = Array.isArray(sys?.phases?.ladder) ? sys.phases.ladder : [];
        const intMax = Number(sys.integrity.max) || 0;
        if (ladder.length > 0 && intMax > 0) {
          const intPct = Math.max(0, Math.min(1, Number(sys.integrity.value) / intMax));
          const dmgPct = 1 - intPct;
          const derivedIdx = Math.min(ladder.length - 1, Math.floor(dmgPct * ladder.length));
          sys.derived.phaseIdx = derivedIdx;
          sys.derived.phaseLabel = String(ladder[derivedIdx]?.label || ladder[derivedIdx]?.name || `Phase ${derivedIdx + 1}`);
          // Live-update the canonical currentPhase as well so existing UIs
          // that read `system.phases.currentPhase` stay in sync without
          // needing to know about the derived value.
          sys.phases.currentPhase = derivedIdx;
        }
        return;
      }

      if (this.type === "rig" && sys?.integrity) {
        const bracket = ftRigBracketFor(this);
        const tier = Math.max(1, Math.min(4, Number(sys.integrity.tier) || 1));
        const table = FT_RIG_DEFENSE_BY_BRACKET[bracket];
        sys.derived         ??= {};
        sys.derived.guard   ??= {}; sys.derived.guard.value   = table.guard   + tier;
        sys.derived.evasion ??= {}; sys.derived.evasion.value = table.evasion + tier;
        sys.derived.resolve ??= {}; sys.derived.resolve.value = table.resolve + tier;
        sys.derived.defenseBracket = bracket;
        // B12: per-round combat state stacked onto base defenses. Pilot
        // holds → +1 Guard; pilot evades → +2 Evasion; any crew braces →
        // +1 Guard. Cleared by pilot's _onFtNewTurn.
        const cmb = this.flags?.fourththing?.combat ?? {};
        if (cmb.holding) sys.derived.guard.value   += 1;
        if (cmb.evading) sys.derived.evasion.value += 2;
        if (cmb.brace)   sys.derived.guard.value   += 1;
        // B11.B mirror: canonical integrity + defenses surface through the
        // derived path so the unified _applyDamageToActor read flow Just
        // Works for rigs. Writes still target system.integrity.value (the
        // canonical store) — the apply function branches on actor.type.
        sys.derived.integrity ??= {};
        sys.derived.integrity.value = Number(sys.integrity.value) || 0;
        sys.derived.integrity.max   = Number(sys.integrity.max)   || 0;
        sys.derived.defenses = sys.defenses ?? { resistances: [], immunities: [], vulnerabilities: [] };
        return;
      }

      if (!sys?.attributes) return;
      const v = sys.attributes.violence?.value ?? 0;
      const i = sys.attributes.intrigue?.value ?? 0;
      const p = sys.attributes.presence?.value ?? 0;
      const b = sys.attributes.body?.value     ?? 0;
      const m = sys.attributes.mind?.value     ?? 0;
      const s = sys.attributes.soul?.value     ?? 0;

      sys.derived           ??= {};
      sys.derived.integrity ??= {};
      sys.derived.stress    ??= {};
      sys.derived.guard     ??= {};
      sys.derived.evasion   ??= {};
      sys.derived.resolve   ??= {};

      // Integrity = base derivative (Body) + per-level class-bracketed boost.
      // Brackets: vanguard 4, mid 3, caster 2. Boost = bracket base + ⌊Body/2⌋
      // applied for each level past 1. L1 is identical to the legacy formula.
      const charLevel = Math.max(1, Number(sys.details?.level) || 1);
      const intBracket = ftIntegrityBracketFor(this);
      const intPerLevel = intBracket.base + Math.floor(b / 2);
      sys.derived.integrity.max    = 10 + 3 * b + (charLevel - 1) * intPerLevel;
      sys.derived.integrity.value ??= sys.derived.integrity.max;
      sys.derived.integrity.bracket    = intBracket.bracket;
      sys.derived.integrity.perLevel   = intPerLevel;
      sys.derived.stress.max       = 10 + 2 * m + s;
      sys.derived.stress.value    ??= sys.derived.stress.max;
      sys.derived.guard.value      = 10 + v + b;
      sys.derived.evasion.value    = 10 + i + b;
      sys.derived.resolve.value    = 10 + p + s;

      // Rank-scaled armor bonuses from equipped armor items. See FT.ARMOR_RANK_SCALE.
      const armorBonus = ftComputeArmorBonus(this, sys);
      sys.derived.guard.value   += armorBonus.guard;
      sys.derived.evasion.value += armorBonus.evasion;
      sys.derived.resolve.value += armorBonus.resolve;
      sys.derived.armorBreakdown = armorBonus.breakdown;

      // Phase 1 codified action — Dodge: +2 to all defenses while flag set.
      // Cleared on _onFtNewTurn (i.e., expires at start of your next turn).
      if (this.flags?.fourththing?.combat?.dodging) {
        sys.derived.guard.value   += 2;
        sys.derived.evasion.value += 2;
        sys.derived.resolve.value += 2;
      }

      sys.derived.defenses = ftComputeDefenses(this, sys);

      // Movement (RFI canon): walk defaults to 30 ft. Items can grant
      // climb-equals-walk via flags.fourththing.passives.movement.climbEqualsWalk.
      // Future bumps (swim/fly/walkBonus) can layer on the same flag namespace.
      sys.derived.movement ??= {};
      sys.derived.movement.walk  = 30;
      sys.derived.movement.climb = 0;
      sys.derived.movement.swim  = 0;
      sys.derived.movement.fly   = 0;
      for (const item of (this.items ?? [])) {
        const mv = item.flags?.fourththing?.passives?.movement;
        if (!mv) continue;
        if (mv.climbEqualsWalk) sys.derived.movement.climb = sys.derived.movement.walk;
        if (typeof mv.climb === "number") sys.derived.movement.climb = Math.max(sys.derived.movement.climb, mv.climb);
        if (typeof mv.swim  === "number") sys.derived.movement.swim  = Math.max(sys.derived.movement.swim,  mv.swim);
        if (typeof mv.fly   === "number") sys.derived.movement.fly   = Math.max(sys.derived.movement.fly,   mv.fly);
        if (typeof mv.walkBonus === "number") sys.derived.movement.walk += mv.walkBonus;
      }

      // Initiative bonus reader (RFI canon: 2026-04-29; AE-aware 2026-05-05).
      // Items declare flags.fourththing.passives.initiative.bonus = N. AEs
      // targeting system.derived.initiative.bonus are written by
      // applyActiveEffects BEFORE this method runs — preserve that base value
      // and accumulate item-flag bonuses on top so @derived.initiative.bonus
      // in roll data reflects both contributions.
      sys.derived.initiative ??= {};
      const aeInitBase = Number(sys.derived.initiative.bonus) || 0;
      sys.derived.initiative.bonus = aeInitBase;
      for (const item of (this.items ?? [])) {
        const init = item.flags?.fourththing?.passives?.initiative;
        if (!init) continue;
        if (typeof init.bonus === "number") sys.derived.initiative.bonus += init.bonus;
      }

      // Vision reader (Phase 4 — 2026-04-29). Items declare
      // flags.fourththing.passives.vision.{darkvision, lowLight, tremorsense, blindsight} = ftRange.
      // Surfaces in sys.derived.vision for the sheet AND auto-syncs the token
      // (see updateActor hook below — Foundry's prototype sight gets max'd
      // against any granted ranges).
      sys.derived.vision ??= {};
      sys.derived.vision.darkvision  = 0;
      sys.derived.vision.lowLight    = 0;
      sys.derived.vision.tremorsense = 0;
      sys.derived.vision.blindsight  = 0;
      for (const item of (this.items ?? [])) {
        const vs = item.flags?.fourththing?.passives?.vision;
        if (!vs) continue;
        if (typeof vs.darkvision  === "number") sys.derived.vision.darkvision  = Math.max(sys.derived.vision.darkvision,  vs.darkvision);
        if (typeof vs.lowLight    === "number") sys.derived.vision.lowLight    = Math.max(sys.derived.vision.lowLight,    vs.lowLight);
        if (typeof vs.tremorsense === "number") sys.derived.vision.tremorsense = Math.max(sys.derived.vision.tremorsense, vs.tremorsense);
        if (typeof vs.blindsight  === "number") sys.derived.vision.blindsight  = Math.max(sys.derived.vision.blindsight,  vs.blindsight);
      }

      // Bulwark resource pools — Frame Dice + Ruin Charges share one formula:
      //   max(2, ceil((Violence value + Bulwark Initiation) / 3)), capped at 8.
      // Only applied when the actor carries a Bulwark class item; otherwise
      // template defaults (max 3) stand for non-Bulwark stewards.
      const bulwarkClass = this.items?.find?.(i => i.type === "class" && i.system?.identifier === "bulwark");
      if (bulwarkClass) {
        const bulwarkLvl = sys.details?.level ?? 1;
        const poolMax = Math.min(8, Math.max(2, Math.ceil((v + bulwarkLvl) / 3)));
        sys.resources             ??= {};
        sys.resources.frameDice   ??= { current: 0, max: 0 };
        sys.resources.ruinCharges ??= { current: 0, max: 0 };
        sys.resources.frameDice.max   = poolMax;
        sys.resources.ruinCharges.max = poolMax;
        // Clamp current down to the recomputed max. Without this, a stale
        // refill (or wizard-created character with `current = 3` from the
        // template default) shows e.g. Ruin 3/2 even though the formula
        // capped the pool at 2. We only clamp DOWN — never up — so the
        // user's spent state is preserved.
        sys.resources.frameDice.current   = Math.min(Number(sys.resources.frameDice.current   ?? 0), poolMax);
        sys.resources.ruinCharges.current = Math.min(Number(sys.resources.ruinCharges.current ?? 0), poolMax);
      } else {
        // Non-Bulwark stewards: Frame/Ruin pools are inert. Template defaults
        // (3/3) leaked through to the retired Breaker panel; zero them so any
        // residual UI / chip rendering shows nothing rather than ghost values.
        if (sys.resources?.frameDice) {
          sys.resources.frameDice.max = 0;
          sys.resources.frameDice.current = 0;
        }
        if (sys.resources?.ruinCharges) {
          sys.resources.ruinCharges.max = 0;
          sys.resources.ruinCharges.current = 0;
        }
      }

      // Shadow Courier resource pool — Pace shares the same formula:
      //   max(2, ceil((Intrigue value + Shadow Courier Initiation) / 3)), cap 8.
      // Refilled by Package delivery and Soma Break (latter handled by the
      // existing somaBreak action; package-delivery refill is doctrine-driven).
      const courierClass = this.items?.find?.(i => i.type === "class" && i.system?.identifier === "shadow_courier");
      if (courierClass) {
        const courierLvl = sys.details?.level ?? 1;
        const paceMax = Math.min(8, Math.max(2, Math.ceil((i + courierLvl) / 3)));
        sys.resources       ??= {};
        sys.resources.pace  ??= { current: 0, max: 0 };
        sys.resources.pace.max = paceMax;
        // Same clamp as Bulwark Frame/Ruin — never let stored current exceed
        // the recomputed max.
        sys.resources.pace.current = Math.min(Number(sys.resources.pace.current ?? 0), paceMax);
      }

      // Cosmic Linguist resource pools — Resonance Dice + Strain (2026-05-06).
      // Resonance: same formula as Bulwark/Courier — max(2, ceil((mind+lvl)/3))
      // capped at 8. Mind-anchored because CL is "manifestation as accurate
      // sentence." 1/round auto-gain handled in _ftHandleTurnStart; full refill
      // on Soma Break.
      // Strain: friction counter, soft-cap 10. Ticks up on aggressive Resonance
      // use ("force a contradiction"); resets to 0 on Soma Break.
      const cosmicLinguistClass = this.items?.find?.(it => it.type === "class" && it.system?.identifier === "cosmic_linguist");
      if (cosmicLinguistClass) {
        const clLvl = sys.details?.level ?? 1;
        const resonanceMax = Math.min(8, Math.max(2, Math.ceil((m + clLvl) / 3)));
        sys.resources                ??= {};
        sys.resources.resonanceDice  ??= { current: 0, max: 0 };
        sys.resources.strain         ??= { value: 0, max: 10 };
        sys.resources.resonanceDice.max     = resonanceMax;
        sys.resources.resonanceDice.current = Math.min(Number(sys.resources.resonanceDice.current ?? 0), resonanceMax);
        sys.resources.strain.max     = 10;
        sys.resources.strain.value   = Math.max(0, Math.min(10, Number(sys.resources.strain.value ?? 0)));
      } else {
        // Non-CL stewards: zero out so any stale flag values stop showing.
        if (sys.resources?.resonanceDice) {
          sys.resources.resonanceDice.max = 0;
          sys.resources.resonanceDice.current = 0;
        }
        if (sys.resources?.strain) {
          sys.resources.strain.max = 0;
          sys.resources.strain.value = 0;
        }
      }

      // ── Phase B sheet-pool surfacing (2026-05-07) ─────────────────────────
      // Migrate clAuthority / pkLeverage from flag-based narrative pools to
      // system.resources, and surface Wyrdlens Probability Overlay (1/round)
      // + Dreamwalker Dream-Cache slot as first-class pools next to
      // Resonance/Strain. Tier-scaled max for Authority/Leverage matches the
      // doctrine-heavy CL/PK rhythm: 5/6/7/8.
      const _phaseBTier = Math.max(1, Math.min(4, Number(sys.details?.tier) || 1));

      if (cosmicLinguistClass) {
        const authMax = 4 + _phaseBTier;
        sys.resources.clAuthority ??= { current: 0, max: authMax };
        sys.resources.clAuthority.max = authMax;
        sys.resources.clAuthority.current = Math.min(Number(sys.resources.clAuthority.current ?? 0), authMax);
      } else if (sys.resources?.clAuthority) {
        sys.resources.clAuthority.max = 0;
        sys.resources.clAuthority.current = 0;
      }

      const pactkeeperClass = this.items?.find?.(it => it.type === "class" && it.system?.identifier === "pactkeeper");
      if (pactkeeperClass) {
        const levMax = 4 + _phaseBTier;
        sys.resources              ??= {};
        sys.resources.pactLeverage ??= { current: 0, max: levMax };
        sys.resources.pactLeverage.max = levMax;
        sys.resources.pactLeverage.current = Math.min(Number(sys.resources.pactLeverage.current ?? 0), levMax);

        // Pactkeeper Civic Charge dice pool — canon per Pactkeeper Core
        // Features (compendium item v2PteOnTErjsVZ66). Die size scales by
        // character level: L1-4 d6, L5-10 d8, L11-16 d10, L17+ d12.
        // Max stored dice = max(1, Soul modifier). Earned ≤1/round by
        // stabilizing / non-violence / contract-enforce / closure / aligned-cast.
        const _pkLvl    = Math.max(1, Number(sys.details?.level) || 1);
        const _pkDieSz  = _pkLvl >= 17 ? "d12" : _pkLvl >= 11 ? "d10" : _pkLvl >= 5 ? "d8" : "d6";
        const _pkSoul   = Math.max(0, Number(sys.attributes?.soul?.value) || 0);
        const _pkCcMax  = Math.max(1, _pkSoul);
        sys.resources.civicCharge ??= { dice: 0, maxDice: _pkCcMax, dieSize: _pkDieSz };
        sys.resources.civicCharge.maxDice = _pkCcMax;
        sys.resources.civicCharge.dieSize = _pkDieSz;
        sys.resources.civicCharge.dice    = Math.min(Number(sys.resources.civicCharge.dice ?? 0), _pkCcMax);

        // Administrative Pressure track (1-2 Low, 3-5 Moderate, 6+ High).
        // Soft cap at 10 — narrative pressure beyond that is rarely numeric.
        sys.resources.administrativePressure ??= { value: 0, max: 10 };
        sys.resources.administrativePressure.max = 10;
        sys.resources.administrativePressure.value = Math.max(0, Math.min(10, Number(sys.resources.administrativePressure.value ?? 0)));
      } else {
        if (sys.resources?.pactLeverage) {
          sys.resources.pactLeverage.max = 0;
          sys.resources.pactLeverage.current = 0;
        }
        if (sys.resources?.civicCharge) {
          sys.resources.civicCharge.dice = 0;
          sys.resources.civicCharge.maxDice = 0;
        }
        if (sys.resources?.administrativePressure) {
          sys.resources.administrativePressure.value = 0;
          sys.resources.administrativePressure.max = 0;
        }
      }

      // Wyrdlens identifier appears as both `wyrdlens-adept` (dash, in
      // FT_TCC_IDENTIFIERS) and `wyrdlens_adept` (underscore) across the
      // codebase. Accept both — class items in the wild may carry either.
      const wyrdlensClass = this.items?.find?.(it => it.type === "class" && (it.system?.identifier === "wyrdlens-adept" || it.system?.identifier === "wyrdlens_adept"));
      if (wyrdlensClass) {
        sys.resources                    ??= {};
        sys.resources.probabilityOverlay ??= { current: 1, max: 1 };
        sys.resources.probabilityOverlay.max = 1;
        sys.resources.probabilityOverlay.current = Math.min(Number(sys.resources.probabilityOverlay.current ?? 1), 1);
      } else if (sys.resources?.probabilityOverlay) {
        sys.resources.probabilityOverlay.max = 0;
        sys.resources.probabilityOverlay.current = 0;
      }

      const dreamwalkerClass = this.items?.find?.(it => it.type === "class" && it.system?.identifier === "dreamwalker");
      if (dreamwalkerClass) {
        sys.resources            ??= {};
        sys.resources.dreamCache ??= { name: "", tier: 0, itemId: "", banked: false };

        // Dream Echo Reservoir — L13 Dreamwalker feature (canonical compendium
        // item tAsGXgZrgFdpNyVi). Pool of d6 Echo Dice, max 2, gain 1 per
        // Soma Break. Three spend modes: Self-Resonance (+1d6 to own failed
        // check after seeing the roll), Shared Echo (+1d6 to ally's failed
        // check within 30 ft), World-Tuning (-1d6 to environmental DC vs you).
        // Pool surfaces only when the actor carries the feat.
        const _hasEchoFeat = this.items?.some?.(it => it.type === "feat" && it.system?.identifier === "dream-echo-reservoir");
        if (_hasEchoFeat) {
          sys.resources.echoDice ??= { dice: 0, maxDice: 2 };
          sys.resources.echoDice.maxDice = 2;
          sys.resources.echoDice.dice    = Math.min(Number(sys.resources.echoDice.dice ?? 0), 2);
        } else if (sys.resources?.echoDice) {
          sys.resources.echoDice.dice = 0;
          sys.resources.echoDice.maxDice = 0;
        }
      } else {
        if (sys.resources?.dreamCache) {
          sys.resources.dreamCache.banked = false;
          sys.resources.dreamCache.name   = "";
          sys.resources.dreamCache.tier   = 0;
          sys.resources.dreamCache.itemId = "";
        }
        if (sys.resources?.echoDice) {
          sys.resources.echoDice.dice = 0;
          sys.resources.echoDice.maxDice = 0;
        }
      }

      // Clarity max scales with Steward tier (manifestation tier ruleset v1.0).
      // T1=5, T2=7, T3=10, T4=14. Existing saved `max` is respected if it
      // exceeds the tier baseline (for narrative boons like relics/pacts).
      sys.magic         ??= {};
      sys.magic.clarity ??= { value: 0, max: 0 };
      const stewardTier = Math.max(1, Math.min(4, Number(sys.details?.tier ?? sys.tier) || 1));
      const clarityBase = FT.CLARITY_BY_TIER[stewardTier] ?? 5;
      const storedMax   = Number(sys.magic.clarity.max) || 0;
      const disciplineBonus = getClarityMaxBonus(this);
      const tccBonus    = isTCC(this) ? 5 : 0;
      sys.magic.clarity.max = Math.max(clarityBase, storedMax) + disciplineBonus + tccBonus;
      sys.magic.clarity.tierBase = clarityBase;
    }
  }

  // ── AppV2 ─────────────────────────────────────────────────────────────────
  const { HandlebarsApplicationMixin } = foundry.applications.api;
  const { ActorSheetV2, ItemSheetV2 }  = foundry.applications.sheets;

  // ── FourthThingCombat ─────────────────────────────────────────────────────
  class FourthThingCombat extends Combat {
    async rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
      // RFI canon (2026-05-05): 2d10x10 + Intrigue + derived.initiative.bonus,
      // with Surge banking on explosions. Reimplemented from super so we can
      // interleave per-combatant Surge accounting and surface it in the chat
      // card flavor — matches Engage / attribute / magic roll paths.
      ids = (typeof ids === "string") ? [ids] : (ids ?? []);
      const currentId    = this.combatant?.id;
      const chatRollMode = game.settings?.get?.("core", "rollMode") ?? "roll";
      const baseFormula  = formula ?? "2d10x10 + @attributes.intrigue.value + @derived.initiative.bonus";

      const updates  = [];
      const messages = [];

      for (const [i, id] of ids.entries()) {
        const combatant = this.combatants.get(id);
        if (!combatant?.isOwner) continue;
        const actor    = combatant.actor;
        const rollData = actor?.getRollData?.() ?? {};
        const roll     = new Roll(baseFormula, rollData);
        try { await roll.evaluate(); }
        catch (e) { console.warn("Roll for Initiation | initiative roll failed", combatant.name, e); continue; }

        // Count explosions on the first die-pool term (excludes the 2 base dice).
        const dieResults = roll.dice?.[0]?.results ?? [];
        const explosions = Math.max(0, dieResults.length - 2);
        let surgeNote = "";
        if (explosions > 0 && actor) {
          try {
            const sys = actor.system?.system ?? actor.system;
            const cur = Number(sys?.resources?.surge?.value) || 0;
            await actor.update({ "system.resources.surge.value": cur + explosions });
            surgeNote = ` <span style="color:#e8c84a;font-weight:600">+${explosions} Surge banked</span>`;
          } catch (e) { /* actor lacks surge resource or update blocked — silent */ }
        }

        updates.push({ _id: id, initiative: roll.total });

        const flavorBase = game.i18n?.format?.("COMBAT.RollsInitiative", { name: combatant.name })
                        ?? `${combatant.name} rolls initiative.`;
        const messageData = foundry.utils.mergeObject({
          speaker: ChatMessage.getSpeaker({ actor, token: combatant.token, alias: combatant.name }),
          flavor:  flavorBase + surgeNote,
          flags:   { "core.initiativeRoll": true }
        }, messageOptions);
        const chatData = await roll.toMessage(messageData, { create: false, rollMode: chatRollMode });
        if (i > 0) chatData.sound = null;
        messages.push(chatData);
      }

      if (!updates.length) return this;
      await this.updateEmbeddedDocuments("Combatant", updates);
      if (updateTurn && currentId) {
        const idx = this.turns.findIndex(t => t.id === currentId);
        if (idx >= 0) await this.update({ turn: idx });
      }
      if (messages.length) await ChatMessage.implementation.create(messages);
      return this;
    }
  }

  // Shared turn-start handler. De-duped across every turn-change hook Foundry
  // has shipped (v11 combatTurn, v12+ combatTurnChange, and updateCombat as a
  // low-level fallback) so the same turn only rolls Last Stand once.
  let _ftLastTurnKey = null;
  async function _ftHandleTurnStart(source, combat, current) {
    if (!combat) return;
    const key = `${combat.id}:${combat.round}:${combat.turn}`;
    if (key === _ftLastTurnKey) return;
    _ftLastTurnKey = key;

    // `current` shape varies across Foundry versions:
    //   combatTurn       → { combatantId, turn }
    //   combatTurnChange → Combatant | { id } | { combatantId }
    //   updateCombat     → pulled from combat.combatant directly
    let combatant = null;
    if (current?.combatantId) combatant = combat.combatants.get(current.combatantId);
    else if (current?.id)     combatant = combat.combatants.get(current.id) ?? current;
    else if (current?.actor)  combatant = current;
    combatant ??= combat?.combatant ?? null;

    const actor = combatant?.actor;
    console.log(`Roll for Initiation | turn-start via ${source}`, { actor: actor?.name, type: actor?.type });
    if (!actor) return;

    // Reset per-turn action economy + reseed movement budget from current walk speed.
    const sysSnap = actor.system?.system ?? actor.system;
    const walkFt  = Number(sysSnap?.derived?.movement?.walk) || 30;
    await actor.update({
      "system.actions.actionUsed":      false,
      "system.actions.bonusUsed":       false,
      "system.actions.reactionUsed":    false,
      "system.actions.movementUsedFt":  0,
      "system.actions.movementBudgetFt": walkFt
    });

    if (actor.type === "character") {
      const sys = actor.system?.system ?? actor.system;
      const dying  = sys?.conditions?.dying === true;
      const active = sys?.lastStand?.active === true;
      console.log(`Roll for Initiation | Last Stand gate`, { dying, active, source });
      if (dying && active) {
        try { await game.fourththing.deathMech.rollLastStand(actor); }
        catch (err) { console.error("Roll for Initiation | Last Stand roll failed", err); }
      }
    }

    // Cosmic Linguist — Resonance auto-gain (1/round at start of CL's turn).
    // Caps at the recomputed max (set in prepareDerivedData). Skipped when
    // already at cap to avoid noisy chat.
    if (actor.type === "character") {
      const isCL = actor.items?.some?.(it => it.type === "class" && it.system?.identifier === "cosmic_linguist");
      if (isCL) {
        const sys = actor.system?.system ?? actor.system;
        const cur = Number(sys?.resources?.resonanceDice?.current) || 0;
        const max = Number(sys?.resources?.resonanceDice?.max)     || 0;
        if (max > 0 && cur < max) {
          try { await actor.update({ "system.resources.resonanceDice.current": cur + 1 }); }
          catch (e) { /* update blocked — silent */ }
        }
      }

      // Wyrdlens Adept — Probability Overlay refresh (Phase B 2026-05-07).
      // T2 grants 1 reroll-lowest per round. The pool sits at max=1; we just
      // top current back to max at start of WL's turn so a previous-round
      // spend resets cleanly.
      const isWL = actor.items?.some?.(it => it.type === "class" && (it.system?.identifier === "wyrdlens-adept" || it.system?.identifier === "wyrdlens_adept"));
      if (isWL) {
        const sys = actor.system?.system ?? actor.system;
        const cur = Number(sys?.resources?.probabilityOverlay?.current) || 0;
        const max = Number(sys?.resources?.probabilityOverlay?.max)     || 0;
        if (max > 0 && cur < max) {
          try { await actor.update({ "system.resources.probabilityOverlay.current": max }); }
          catch (e) { /* update blocked — silent */ }
        }
      }

      // Pactkeeper — Civic Charge per-round gain limit reset. Class text caps
      // gain at 1 die/round; flag tracks whether this round's earn already
      // happened. Cleared at start of PK's turn so the next round's earn
      // becomes available.
      const isPK = actor.items?.some?.(it => it.type === "class" && it.system?.identifier === "pactkeeper");
      if (isPK && actor.flags?.fourththing?.pkChargeGainedThisRound) {
        try { await actor.unsetFlag("fourththing", "pkChargeGainedThisRound"); }
        catch (e) { /* unset blocked — silent */ }
      }

      // Sig Mode — ongoing upkeep tick (Phase D 2026-05-08). Each active stance
      // costs 1 Clarity per turn while held. If the actor can't pay, drop the
      // mode and post a chat note. Per-class mode keys + display labels live
      // in _SIG_MODE_KEYS so the chat card names the right stance.
      const _SIG_MODE_KEYS = {
        clSentence:    { label: "The Sentence",    color: "#c8c8ff" },
        wlRefraction:  { label: "Refraction",      color: "#a0c8d8" },
        dwWalkingLane: { label: "The Walking Lane",color: "#c8a0ff" },
        pkSealedPact:  { label: "Sealed Pact",     color: "#a0c8b8" }
      };
      const _activeModes = actor.flags?.fourththing?.modes ?? {};
      const _activeModeKeys = Object.keys(_SIG_MODE_KEYS).filter(k => _activeModes[k] === true);
      if (_activeModeKeys.length) {
        const sysSnap = actor.system?.system ?? actor.system;
        let curClarity = Number(sysSnap?.magic?.clarity?.value) || 0;
        const upkeepCostPer = 1; // per turn, per stance held — tunable.
        const totalCost = upkeepCostPer * _activeModeKeys.length;
        if (curClarity >= totalCost) {
          try { await actor.update({ "system.magic.clarity.value": curClarity - totalCost }); }
          catch (e) { /* update blocked — silent */ }
          // Quiet upkeep tick — only chat-announce when there's a state change.
          // Tick without notification keeps round-rollover lean.
        } else {
          // Drop ALL active stances when can't pay. Cleanest behavior — partial
          // pay would force the player to choose, which adds round-of-play UX
          // noise that isn't worth it for an edge case.
          const newModes = foundry.utils.deepClone(_activeModes);
          for (const k of _activeModeKeys) newModes[k] = false;
          try { await actor.setFlag("fourththing", "modes", newModes); }
          catch (e) { /* update blocked — silent */ }
          const droppedLines = _activeModeKeys.map(k => `<li><span style="color:${_SIG_MODE_KEYS[k].color}">⟁ ${_SIG_MODE_KEYS[k].label}</span></li>`).join("");
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#8a3a3a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#ff8a8a">⟁ Stance dropped — insufficient Clarity</span></div>
              <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.85">${actor.name} could not pay ${totalCost} Clarity (had ${curClarity}). Dropped:</p>
              <ul style="margin:0.2rem 0 0;padding-left:1.2rem;font-size:0.78rem">${droppedLines}</ul>
            </div>`
          });
        }
      }
    }

    // Save-each-round automation. Walk owned effects with the saveEachRound
    // flag set; roll 2d10x10 + saveAttribute vs DC; on success, delete the AE
    // (the preDeleteActiveEffect hook will clear system.conditions for us).
    try {
      const saveEffects = (actor.effects ?? []).filter(e =>
        e.flags?.fourththing?.appliedManifestation?.saveEachRound === true
        && !e.disabled
      );
      for (const eff of saveEffects) {
        const meta = eff.flags.fourththing.appliedManifestation;
        const sys  = actor.system?.system ?? actor.system ?? {};
        const attrKey = meta.saveAttribute || "body";
        const dc      = Number(meta.dc) || 15;
        const attrVal = Number(sys?.attributes?.[attrKey]?.value) || 0;
        // Walk AEs for the save-attribute add (target rolls with their own
        // appliedEffects honoured — same pattern as resolveManifestationSave).
        let aeAttr = 0;
        for (const ae of (actor.appliedEffects ?? [])) {
          if (ae.disabled) continue;
          for (const ch of (ae.changes ?? [])) {
            if (ch.type !== "add" || !ch.key?.endsWith(".value")) continue;
            if (ch.key === `system.attributes.${attrKey}.value`) aeAttr += Number(ch.value) || 0;
          }
        }
        const total = attrVal + aeAttr;
        const roll  = new Roll(`2d10x10 + ${total}`);
        await roll.evaluate();
        const dieResults = roll.dice?.[0]?.results ?? [];
        const explos     = Math.max(0, dieResults.length - 2);
        if (explos > 0) {
          const cur = Number(sys?.resources?.surge?.value) || 0;
          try { await actor.update({ "system.resources.surge.value": cur + explos }); }
          catch (e) { /* surge missing — silent */ }
        }
        const saved = roll.total >= dc;
        const condLabel = FT.CONDITIONS?.[meta.condition ?? eff.flags.fourththing.condition]?.label ?? "condition";
        const headerColor = saved ? "#5fb35f" : "#c45f5f";
        const headerLabel = saved ? "SHAKEN OFF" : "STILL AFFLICTED";
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor:  `<div class="fourththing-roll">
            <div class="ft-roll-header"><span class="ft-roll-name" style="color:${headerColor}">↻ ${ftEscapeHtml(actor.name)} — ${ftCap(attrKey)} save vs ${ftEscapeHtml(condLabel)}: ${headerLabel}</span></div>
            <div class="ft-result-row ${saved ? "ft-success" : "ft-failure"}">
              <span class="ft-total">${roll.total}</span>
              <span class="ft-outcome">vs DC ${dc}${explos > 0 ? ` · +${explos} Surge` : ""}</span>
            </div>
            ${meta.itemName ? `<p style="margin:0.2rem 0 0;font-size:0.74rem;opacity:0.7">From: ${ftEscapeHtml(meta.itemName)}</p>` : ""}
          </div>`
        });
        if (saved) {
          try { await eff.delete(); }
          catch (e) { console.warn("Roll for Initiation | save-each-round AE delete failed", e); }
        }
      }
    } catch (err) {
      console.warn("Roll for Initiation | save-each-round handler failed", err);
    }
  }

  Hooks.on("combatTurn",       (combat, prior, current) => _ftHandleTurnStart("combatTurn", combat, current));
  Hooks.on("combatTurnChange", (combat, prior, current) => _ftHandleTurnStart("combatTurnChange", combat, current));
  Hooks.on("updateCombat", async (combat, changes) => {
    if (changes.turn === undefined && changes.round === undefined) return;
    await _ftHandleTurnStart("updateCombat", combat, combat.combatant);
  });

  // Phase C trigger: on-move. Fires when a token moves a non-zero distance.
  // Uses preUpdateToken so we have the old position (tokenDoc.x/y still pre-update here)
  // alongside the new (change.x/y). Distance converted to scene feet via grid metrics.
  // Fire-and-forget — must not block the update pipeline.
  Hooks.on("preUpdateToken", (tokenDoc, change, _options, userId) => {
    if (change.x === undefined && change.y === undefined) return;
    if (game.user.id !== userId) return;
    const actor = tokenDoc.actor;
    if (!actor) return;
    const scene    = tokenDoc.parent;
    const gridSize = scene?.grid?.size     ?? 100;
    const gridDist = scene?.grid?.distance ?? 5;
    const newX = change.x ?? tokenDoc.x;
    const newY = change.y ?? tokenDoc.y;
    const dx   = newX - tokenDoc.x;
    const dy   = newY - tokenDoc.y;
    const distanceFt = Math.round((Math.hypot(dx, dy) / gridSize) * gridDist);
    if (distanceFt <= 0) return;
    fireTriggers(actor, "on-move", { amount: distanceFt, scope: "self" })
      .catch(err => console.error("fourththing | on-move trigger failed", err));

    // Movement budget accumulator — only debits while actor is in combat.
    // Soft-warn when over budget; never blocks the move (RFI tactical play
    // permits Surge / Soma-Break workarounds the system can't introspect).
    if (game.combat?.combatants?.find(c => c.actor?.id === actor.id)) {
      const sysSnap = actor.system?.system ?? actor.system;
      const cur     = Number(sysSnap?.actions?.movementUsedFt)   || 0;
      const budget  = Number(sysSnap?.actions?.movementBudgetFt) || 0;
      const next    = cur + distanceFt;
      actor.update({ "system.actions.movementUsedFt": next })
        .then(() => {
          if (budget > 0 && next > budget && cur <= budget) {
            ui.notifications?.warn(`${actor.name}: movement ${next}ft exceeds budget ${budget}ft. (GM judgment — Dash, Surge, or terrain?)`);
          }
        })
        .catch(err => console.error("fourththing | movement debit failed", err));

      // Phase 4: AoO detection. Fire a generic `fourththing.targetLeftReach`
      // event for every other-disposition observer that THREATENED the
      // pre-position but does NOT threaten the post-position. Default reach
      // = 5 ft. Disengage flag stamps `suppressed: true`; built-in feat
      // consumer respects it. Held-action workings can ignore it.
      try {
        const moverDisp = tokenDoc.disposition ?? 0;
        const suppressed = actor.flags?.fourththing?.combat?.disengaged === true;
        const reachPx = (5 / gridDist) * gridSize;
        const fudge   = gridSize * 0.05;
        const moverHalfW = ((tokenDoc.width  || 1) * gridSize) / 2;
        const moverHalfH = ((tokenDoc.height || 1) * gridSize) / 2;
        const oldCx = tokenDoc.x + moverHalfW;
        const oldCy = tokenDoc.y + moverHalfH;
        const newCx = newX + moverHalfW;
        const newCy = newY + moverHalfH;
        for (const tok of canvas.tokens?.placeables ?? []) {
          if (tok.id === tokenDoc.id) continue;
          if (tok.document?.hidden) continue;
          if (!tok.actor) continue;
          const obsDisp = tok.document?.disposition ?? 0;
          if (obsDisp === moverDisp) continue; // allies don't threaten each other
          const ox = tok.center?.x ?? tok.x;
          const oy = tok.center?.y ?? tok.y;
          const oldD = Math.max(Math.abs(ox - oldCx), Math.abs(oy - oldCy));
          const newD = Math.max(Math.abs(ox - newCx), Math.abs(oy - newCy));
          const wasInReach = oldD <= reachPx + fudge;
          const isInReach  = newD <= reachPx + fudge;
          if (wasInReach && !isInReach) {
            Hooks.callAll("fourththing.targetLeftReach", {
              observerToken: tok,
              observerActor: tok.actor,
              moverToken:    tokenDoc,
              moverActor:    actor,
              suppressed,
              fromX: tokenDoc.x, fromY: tokenDoc.y,
              toX:   newX,       toY:   newY
            });
          }
        }
      } catch (err) {
        console.error("fourththing | targetLeftReach detection failed", err);
      }
    }
  });

  // Built-in feat-gated AoO consumer. Reads the same `fourththing.targetLeftReach`
  // event any working/held-action can listen to. Gate: actor flag
  // `flags.fourththing.passives.combat.attackOfOpportunity = true` (set by the
  // AoO feat's AE — feat content authored separately). Reaction gate enforced.
  // Disengage stamp respected. Posts a chat prompt with a Strike button so the
  // player chooses whether to commit; reaction is consumed only on Strike.
  Hooks.on("fourththing.targetLeftReach", async ({ observerActor, moverActor, suppressed }) => {
    if (suppressed) return;
    if (!observerActor || !moverActor) return;
    if (!observerActor.flags?.fourththing?.passives?.combat?.attackOfOpportunity) return;
    const sys = observerActor.system?.system ?? observerActor.system;
    if (sys?.actions?.reactionUsed) return;
    const item = ftFindMeleeAttackItem(observerActor);
    if (!item) return; // nothing to swing with
    const html = `<div class="fourththing-roll">
      <div class="ft-roll-header"><span class="ft-roll-name">⚔ Attack of Opportunity</span></div>
      <p style="margin:0.3rem 0;font-size:0.85rem"><b>${ftEscapeHtml(moverActor.name)}</b> is leaving <b>${ftEscapeHtml(observerActor.name)}</b>'s reach.</p>
      <button type="button" class="ft-aoo-strike" data-observer-uuid="${observerActor.uuid}" data-mover-uuid="${moverActor.uuid}" data-item-id="${item.id}"
              style="padding:0.3rem 0.7rem;background:rgba(232,138,138,0.15);border:1px solid rgba(232,138,138,0.6);color:#e88a8a;border-radius:3px;cursor:pointer;font-size:0.85rem">⚔ Strike with ${ftEscapeHtml(item.name)} (consumes reaction)</button>
      <p style="margin:0.25rem 0 0;font-size:0.7rem;opacity:0.55">Ignore this prompt to skip — your reaction is preserved.</p>
    </div>`;
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: observerActor }),
      content: html
    }).catch(err => console.error("fourththing | AoO chat prompt failed", err));
  });

  // Integrity → 0 detector: enters Last Stand on collapse; exits if healed above 0.
  // Characters only — NPCs drop on zero without the dying cycle.
  Hooks.on("updateActor", async (actor, changes) => {
    if (actor.type !== "character") return;
    const newIntegrity = foundry.utils.getProperty(changes, "system.derived.integrity.value");
    if (newIntegrity === undefined) return;
    const sys = actor.system?.system ?? actor.system;
    const dying = sys?.conditions?.dying === true;

    if (newIntegrity <= 0 && !dying) {
      try { await game.fourththing.deathMech.enterLastStand(actor); }
      catch (err) { console.error("Roll for Initiation | enterLastStand failed", err); }
    } else if (newIntegrity > 0 && dying) {
      // Healed out of it — clear Last Stand state quietly.
      await actor.update({
        "system.conditions.dying":    false,
        "system.lastStand.active":    false,
        "system.lastStand.successes": 0,
        "system.lastStand.failures":  0
      });
      await _ftSyncConditionAE(actor, "dying", false);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="fourththing-roll">
          <div class="ft-roll-header"><span class="ft-roll-name" style="color:#27ae60">✦ ${actor.name} is pulled back</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.85">Healed above 0 Integrity — Last Stand aborted.</p>
        </div>`
      });
      Hooks.callAll("fourththing.revivedFromDying", actor);
    }
  });

  // ── Vision auto-sync (Phase 4 — 2026-04-29) ────────────────────────────────
  // When an item is added / updated / removed, recompute granted vision and
  // push the maximum range onto the actor's prototype token + any active
  // tokens. Foundry's sight.range is the max range; we also flip
  // sight.enabled for non-zero values. Tremorsense / blindsight surface as
  // detection modes (basicSight + tremorsense).
  async function _ftSyncTokenVision(actor) {
    if (!actor || actor.type !== "character") return;
    const sys = actor.system?.system ?? actor.system;
    const v = sys?.derived?.vision;
    if (!v) return;
    const maxSight = Math.max(v.darkvision || 0, v.lowLight || 0);
    const updates = {};
    // Prototype token sight
    const protoSight = actor.prototypeToken?.sight ?? {};
    if ((protoSight.range ?? 0) < maxSight || protoSight.visionMode !== (maxSight ? "darkvision" : protoSight.visionMode)) {
      if (maxSight > 0) {
        updates["prototypeToken.sight.enabled"]    = true;
        updates["prototypeToken.sight.range"]      = maxSight;
        updates["prototypeToken.sight.visionMode"] = "darkvision";
      }
    }
    // Detection modes — tremorsense + blindsight if granted.
    // V14: detectionModes can come back as a non-array iterable depending on
    // DataModel state (esp. mid-import / mid-create). Coerce defensively.
    const _rawDetect = actor.prototypeToken?.detectionModes;
    const protoDetect = Array.isArray(_rawDetect) ? _rawDetect
      : (_rawDetect && typeof _rawDetect[Symbol.iterator] === "function") ? Array.from(_rawDetect)
      : [];
    const wantDetect = [];
    if (v.tremorsense > 0) wantDetect.push({ id: "feelTremor", enabled: true, range: v.tremorsense });
    if (v.blindsight  > 0) wantDetect.push({ id: "seeAll",     enabled: true, range: v.blindsight });
    // Merge: keep existing non-fourththing modes, replace ours
    const keepers = protoDetect.filter(m => !["feelTremor", "seeAll"].includes(m.id));
    const merged = [...keepers, ...wantDetect];
    // Only update if changed
    const oldFiltered = protoDetect.filter(m => ["feelTremor","seeAll"].includes(m.id));
    const oldKey = JSON.stringify(oldFiltered.map(m => [m.id, m.range, m.enabled]).sort());
    const newKey = JSON.stringify(wantDetect.map(m => [m.id, m.range, m.enabled]).sort());
    if (oldKey !== newKey) updates["prototypeToken.detectionModes"] = merged;
    if (Object.keys(updates).length) {
      try { await actor.update(updates); }
      catch (e) { console.warn(`fourththing: vision sync failed for ${actor.name}: ${e.message}`); }
    }
    // Push to active tokens too
    for (const tok of actor.getActiveTokens?.(false, true) ?? []) {
      const tokUpdates = {};
      if (maxSight > 0 && (tok.sight?.range ?? 0) < maxSight) {
        tokUpdates["sight.enabled"]    = true;
        tokUpdates["sight.range"]      = maxSight;
        tokUpdates["sight.visionMode"] = "darkvision";
      }
      if (oldKey !== newKey) tokUpdates["detectionModes"] = merged;
      if (Object.keys(tokUpdates).length) {
        try { await tok.update(tokUpdates); }
        catch (e) { console.warn(`fourththing: token vision sync failed: ${e.message}`); }
      }
    }
  }
  game.fourththing.syncTokenVision = _ftSyncTokenVision;

  for (const evt of ["createItem", "updateItem", "deleteItem"]) {
    Hooks.on(evt, (item, _data, _opts, _userId) => {
      const flags = item.flags?.fourththing?.passives?.vision;
      // Cheap gate — only re-sync if this item had/has a vision flag, or if
      // we're processing a fresh import (createItem) which might add one.
      if (!flags && evt !== "createItem" && evt !== "deleteItem") return;
      const actor = item.parent;
      if (!actor || !(actor instanceof Actor)) return;
      _ftSyncTokenVision(actor);
    });
  }

  // ── Shared defense mutation helpers ───────────────────────────────────────
  // Extracted so the inline NPC sheet editor AND the character-sheet popout
  // dialog can share mutation logic without duplicating the array handling.

  async function ftApplyDefenseCycle(actor, key) {
    if (!actor || !key || !FT.DAMAGE_TYPES[key]) return;
    const rawSys = actor.system?.system ?? actor.system;
    const base = rawSys?.defenses ?? { resistances: [], immunities: [] };
    const resistances = Array.isArray(base.resistances) ? [...base.resistances] : [];
    const immunities  = Array.isArray(base.immunities)  ? [...base.immunities]  : [];
    const ri = resistances.indexOf(key);
    const ii = immunities.indexOf(key);
    if (ri < 0 && ii < 0) resistances.push(key);
    else if (ri >= 0)     { resistances.splice(ri, 1); immunities.push(key); }
    else                  immunities.splice(ii, 1);
    await actor.update({
      "system.defenses.resistances": resistances,
      "system.defenses.immunities":  immunities
    });
  }

  async function ftApplyVulnToggle(actor, key) {
    if (!actor || !key || !FT.DAMAGE_TYPES[key]) return;
    const rawSys = actor.system?.system ?? actor.system;
    const base = rawSys?.defenses ?? {};
    const list = Array.isArray(base.vulnerabilities) ? [...base.vulnerabilities] : [];
    const idx = list.findIndex(e =>
      (typeof e === "string" && e.toLowerCase() === key) ||
      (e && typeof e === "object" && String(e.type ?? "").toLowerCase() === key && !e.flavor)
    );
    if (idx >= 0) list.splice(idx, 1);
    else          list.push(key);
    await actor.update({ "system.defenses.vulnerabilities": list });
  }

  async function ftApplyCondImmuneToggle(actor, key) {
    if (!actor || !key || !(FT.CONDITIONS ?? {})[key]) return;
    const rawSys = actor.system?.system ?? actor.system;
    const list = Array.isArray(rawSys?.conditionImmunities) ? [...rawSys.conditionImmunities] : [];
    const idx = list.findIndex(x => String(x ?? "").toLowerCase() === key);
    if (idx >= 0) list.splice(idx, 1);
    else          list.push(key);
    await actor.update({ "system.conditionImmunities": list });
  }

  // Render the defense editor body (chip grids + help text) for an actor at
  // the current moment. Called on dialog open and re-called after each
  // mutation so the chips reflect the new state.
  function ftBuildDefenseEditorDialogHTML(actor) {
    const rawSys = actor.system?.system ?? actor.system;
    const sysData = rawSys?.toObject ? rawSys.toObject() : JSON.parse(JSON.stringify(rawSys ?? {}));
    const base = sysData.defenses ?? { resistances: [], immunities: [], vulnerabilities: [] };
    const condBase = Array.isArray(sysData.conditionImmunities) ? sysData.conditionImmunities : [];
    const _hasBase = (arr, key) => (arr ?? []).some(e =>
      (typeof e === "string" && e.toLowerCase() === key) ||
      (e && typeof e === "object" && String(e.type ?? "").toLowerCase() === key && !e.flavor)
    );
    const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
    const types = Object.entries(FT.DAMAGE_TYPES).map(([k, cfg]) => ({
      key: k, label: cfg.label,
      baseResist: _hasBase(base.resistances, k),
      baseImmune: _hasBase(base.immunities,  k),
      baseVuln:   _hasBase(base.vulnerabilities, k)
    }));
    const conds = Object.entries(FT.CONDITIONS ?? {}).map(([k, cfg]) => ({
      key: k, label: cfg.label,
      baseImmune: condBase.map(x => String(x ?? "").toLowerCase()).includes(k)
    }));

    const cycleChip = t => {
      const cls  = t.baseImmune ? "ft-chip-immune" : t.baseResist ? "ft-chip-resist" : "ft-chip-none";
      const icon = t.baseImmune ? "⦿" : t.baseResist ? "◑" : "○";
      return `<button type="button" class="ft-chip ft-chip-edit ${cls}" data-ft-def-action="cycle" data-type="${esc(t.key)}" title="${esc(t.label)}: click to cycle none → resist → immune">${icon} ${esc(t.label)}</button>`;
    };
    const vulnChip = t => {
      const cls  = t.baseVuln ? "ft-chip-vuln" : "ft-chip-none";
      const icon = t.baseVuln ? "▲" : "○";
      return `<button type="button" class="ft-chip ft-chip-edit ${cls}" data-ft-def-action="vuln" data-type="${esc(t.key)}" title="${esc(t.label)}: click to toggle vulnerability (×2)">${icon} ${esc(t.label)}</button>`;
    };
    const condChip = c => {
      const cls  = c.baseImmune ? "ft-chip-cond-immune" : "ft-chip-none";
      const icon = c.baseImmune ? "✦" : "○";
      return `<button type="button" class="ft-chip ft-chip-edit ${cls}" data-ft-def-action="cond" data-condition="${esc(c.key)}" title="Condition: ${esc(c.label)}">${icon} ${esc(c.label)}</button>`;
    };

    return `
      <div class="ft-def-dialog-body">
        <label class="ft-def-editor-label">Base defenses — click to cycle</label>
        <div class="ft-def-chips ft-def-chips-edit">${types.map(cycleChip).join("")}</div>
        <label class="ft-def-editor-label">Base vulnerabilities — click to toggle</label>
        <div class="ft-def-chips ft-def-chips-edit">${types.map(vulnChip).join("")}</div>
        <label class="ft-def-editor-label">Condition immunities — click to toggle</label>
        <div class="ft-def-chips ft-def-chips-edit">${conds.map(condChip).join("")}</div>
        <p class="ft-def-hint">○ none · ◑ resist (½) · ⦿ immune (×0) · ▲ vulnerable (×2) · ✦ condition immune. Item grants stack on top; flavor carve-outs show as qualified chips on the main sheet.</p>
      </div>
    `;
  }

  // ── Surge spend: reposition initiative ─────────────────────────────────────
  // Spend N Surge to slot into a new place in the active combat's initiative
  // order. Surge is deducted only on confirm. New initiative is the midpoint
  // between the chosen anchor and the next combatant on the picked side
  // (above/below) — falls back to anchor ±1 at the ends.
  async function _ftRepositionInitiative(actor, cost) {
    const combat = game.combat;
    if (!combat) {
      ui.notifications?.warn(`${actor.name}: no active combat — start one first.`);
      return false;
    }
    const myCombatant = combat.combatants.find(c => c.actorId === actor.id);
    if (!myCombatant) {
      ui.notifications?.warn(`${actor.name}: not a combatant in the current encounter.`);
      return false;
    }
    const rolled = combat.combatants.filter(c => Number.isFinite(c.initiative));
    if (rolled.length < 2) {
      ui.notifications?.warn(`${actor.name}: need at least two rolled combatants to reposition between.`);
      return false;
    }
    const sorted = [...rolled].sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));

    const row = (c) => {
      const isSelf = c.id === myCombatant.id;
      const init   = Number(c.initiative ?? 0).toFixed(2).replace(/\.00$/, "");
      const btns = isSelf
        ? `<span style="opacity:0.6;font-size:0.74rem">— you —</span>`
        : `<button type="button" class="ft-init-pos" data-target="${c.id}" data-side="above"
                   style="padding:0.2rem 0.5rem;margin-right:0.25rem;background:rgba(232,200,74,0.1);border:1px solid rgba(232,200,74,0.4);border-radius:3px;color:#e8c84a;cursor:pointer;font-size:0.74rem">↑ Above</button>
           <button type="button" class="ft-init-pos" data-target="${c.id}" data-side="below"
                   style="padding:0.2rem 0.5rem;background:rgba(232,200,74,0.1);border:1px solid rgba(232,200,74,0.4);border-radius:3px;color:#e8c84a;cursor:pointer;font-size:0.74rem">↓ Below</button>`;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.35rem 0.2rem;border-bottom:1px solid rgba(255,255,255,0.06)">
        <span style="font-size:0.82rem"><b>${c.name}</b> <span style="opacity:0.55">— init ${init}</span></span>
        <span>${btns}</span>
      </div>`;
    };

    const html = `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;opacity:0.75;margin:0 0 0.4rem">
        Spend <b style="color:#e8c84a">${cost} Surge</b> to step out of the moment and re-enter the order
        above or below the chosen combatant.
      </p>
      ${sorted.map(row).join("")}
    </div>`;

    return new Promise((resolve) => {
      const d = new Dialog({
        title:   `Reposition Initiative — ${actor.name}`,
        content: html,
        buttons: { cancel: { label: "Cancel", callback: () => resolve(false) } },
        default: "cancel",
        close:   () => resolve(false)
      });
      d.render(true);

      Hooks.once("renderDialog", (di, $html) => {
        if (di !== d) return;
        $html.find(".ft-init-pos").on("click", async (ev) => {
          const targetId = String(ev.currentTarget.dataset.target);
          const side     = String(ev.currentTarget.dataset.side);
          const target   = combat.combatants.get(targetId);
          if (!target) return;

          const targetInit = Number(target.initiative);
          const others = sorted.filter(c => c.id !== myCombatant.id && c.id !== target.id);
          let newInit;
          if (side === "above") {
            const above = others.filter(c => Number(c.initiative) > targetInit)
                                .sort((a, b) => Number(a.initiative) - Number(b.initiative))[0];
            newInit = above ? (targetInit + Number(above.initiative)) / 2 : targetInit + 1;
          } else {
            const below = others.filter(c => Number(c.initiative) < targetInit)
                                .sort((a, b) => Number(b.initiative) - Number(a.initiative))[0];
            newInit = below ? (targetInit + Number(below.initiative)) / 2 : targetInit - 1;
          }

          // Deduct Surge + apply initiative change. Rounded to 2 decimals so
          // the order display stays readable; midpoint averaging guarantees
          // strict ordering between integer-init neighbors.
          const cur = Number(actor.system?.system?.resources?.surge?.value
                          ?? actor.system?.resources?.surge?.value) || 0;
          if (cur < cost) {
            ui.notifications?.warn(`${actor.name}: insufficient Surge (need ${cost}, have ${cur}).`);
            d.close();
            resolve(false);
            return;
          }
          newInit = Math.round(Number(newInit) * 100) / 100;

          try {
            await actor.update({ "system.resources.surge.value": cur - cost });
            await myCombatant.update({ initiative: newInit });
          } catch (e) {
            console.warn("Roll for Initiation | reposition update failed", e);
            ui.notifications?.error(`${actor.name}: reposition failed (see console).`);
            d.close();
            resolve(false);
            return;
          }

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✦ ${actor.name} repositions — ${side === "above" ? "above" : "below"} ${target.name}</span></div>
              <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.85">
                Spent <b style="color:#e8c84a">${cost} Surge</b> (${cur} → ${cur - cost}). New initiative <b>${newInit}</b>.
              </p>
            </div>`
          });
          d.close();
          resolve(true);
        });
      });
    });
  }

  // ── FourthThingCharacterSheet ──────────────────────────────────────────────
  class FourthThingCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

    static DEFAULT_OPTIONS = {
      classes:  ["fourththing", "sheet", "actor"],
      position: { width: 1240, height: 980 },
      window:   { resizable: true },
      actions: {
        ftRoll:           FourthThingCharacterSheet._onFtRoll,
        ftCast:           FourthThingCharacterSheet._onFtCast,
        ftCastPower:      FourthThingCharacterSheet._onFtCast,       // alias
        ftMisfire:        FourthThingCharacterSheet._onFtMisfire,
        ftStrike:         FourthThingCharacterSheet._onFtStrike,
        ftWeaponRoll:     FourthThingCharacterSheet._onFtStrike,     // alias
        ftSkillRoll:      FourthThingCharacterSheet._onFtSkillRoll,
        ftSetSkillRank:   FourthThingCharacterSheet._onFtSetSkillRank,
        ftConditionToggle:FourthThingCharacterSheet._onFtConditionToggle,
        ftActionToggle:   FourthThingCharacterSheet._onFtActionToggle,
        ftCombatAction:   FourthThingCharacterSheet._onFtCombatAction,
        ftMoveAdjust:     FourthThingCharacterSheet._onFtMoveAdjust,
        ftNewTurn:        FourthThingCharacterSheet._onFtNewTurn,
        ftActAgain:       FourthThingCharacterSheet._onFtActAgain,
        ftSurgeSpend:     FourthThingCharacterSheet._onFtSurgeSpend,
        ftSomaBreak:      FourthThingCharacterSheet._onFtSomaBreak,
        ftSceneBreak:     FourthThingCharacterSheet._onFtSceneBreak,
        ftLesserManifest: FourthThingCharacterSheet._onFtLesserManifest,
        ftFiat:           FourthThingCharacterSheet._onFtFiat,
        ftManifestCreate: FourthThingCharacterSheet._onFtManifestCreate,
        ftPowerCreate:    FourthThingCharacterSheet._onFtPowerCreate,
        ftManifestDrop:     FourthThingCharacterSheet._onFtManifestDrop,
        ftManifestEndScene: FourthThingCharacterSheet._onFtManifestEndScene,
        ftGuidanceToggle:   FourthThingCharacterSheet._onFtGuidanceToggle,
        ftItemEdit:       FourthThingCharacterSheet._onFtItemEdit,
        ftItemDelete:     FourthThingCharacterSheet._onFtItemDelete,
        ftItemEquip:      FourthThingCharacterSheet._onFtItemEquip,
        ftConsume:        FourthThingCharacterSheet._onFtConsume,
        ftForge:          FourthThingCharacterSheet._onFtForge,
        ftGather:         FourthThingCharacterSheet._onFtGather,
        ftWeaponCreate:   FourthThingCharacterSheet._onFtWeaponCreate,
        // Sprint C: BBTTCC bridge actions
        ftBBTTCCBridge:   FourthThingCharacterSheet._onFtBBTTCCBridge,
        ftBBTTCCRadiation:FourthThingCharacterSheet._onFtBBTTCCRadiation,
        ftBBTTCCTikkun:   FourthThingCharacterSheet._onFtBBTTCCTikkun,
        ftBBTTCCFaction:  FourthThingCharacterSheet._onFtBBTTCCFaction,
        ftEchoAssetsManage: FourthThingCharacterSheet._onFtEchoAssetsManage,
        ftBBTTCCIdentity: FourthThingCharacterSheet._onFtBBTTCCIdentity,
        ftASIApply:       FourthThingCharacterSheet._onFtASIApply,
        ftUseFeature:     FourthThingCharacterSheet._onFtUseFeature,
        ftClassAction:    FourthThingCharacterSheet._onFtClassAction,
        ftEditPortrait:   FourthThingCharacterSheet._onFtEditPortrait,
        // Sprint E: progression
        ftLevelUp:          FourthThingCharacterSheet._onFtLevelUp,
        ftSpendSkillPoints: FourthThingCharacterSheet._onFtSpendSkillPoints,
        ftGrantSkillRanks:  FourthThingCharacterSheet._onFtGrantSkillRanks,
        ftApplyPathFeatures:FourthThingCharacterSheet._onFtApplyPathFeatures,
        ftToggleEditMode:   FourthThingCharacterSheet._onFtToggleEditMode,
        ftAddEffect:        FourthThingCharacterSheet._onFtAddEffect,
        ftDefenseRoll:      FourthThingCharacterSheet._onFtDefenseRoll,
        ftDefenseCycle:     FourthThingCharacterSheet._onFtDefenseCycle,
        ftVulnToggle:       FourthThingCharacterSheet._onFtVulnToggle,
        ftCondImmuneToggle: FourthThingCharacterSheet._onFtCondImmuneToggle,
        ftDefensesOpen:     FourthThingCharacterSheet._onFtDefensesOpen,
        // Bulwark Inevitability merged-pool +/- (Cataclyst L17 capstone)
        ftBulwarkInevAdjust:    FourthThingCharacterSheet._onFtBulwarkInevAdjust,
        // Shadow Courier Package management
        ftCourierPackageEdit:   FourthThingCharacterSheet._onFtCourierPackageEdit,
        ftCourierPackageDeliver:FourthThingCharacterSheet._onFtCourierPackageDeliver
      },
      dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: null }],
      form: { submitOnChange: true, closeOnSubmit: false }
    };

    static PARTS = {
      sheet: { template: "systems/fourththing/templates/actors/character-sheet.hbs" }
    };

    tabGroups = { primary: "core" };

    async _prepareContext(options) {
      const actor = this.actor;
      try {
      // V14 + template.json with "system" wrapper creates actor.system = {system:{...}}
      // Unwrap defensively so this works whether template.json is fixed or not.
      const rawSys  = actor.system?.system ?? actor.system;
      const sysData = rawSys?.toObject ? rawSys.toObject() : JSON.parse(JSON.stringify(rawSys ?? {}));

      const attributes = sysData.attributes ?? {};
      const skills     = sysData.skills     ?? {};
      const derived    = sysData.derived    ?? {};
      const magic      = sysData.magic      ?? {};
      const conditions = sysData.conditions ?? {};
      const actions    = sysData.actions    ?? {};

      // Derived defenses — recompute at context time because sys.derived.defenses
      // isn't declared in template.json and may get stripped by toObject().
      const defensesBase    = sysData.defenses ?? { resistances: [], immunities: [], vulnerabilities: [] };
      const condImmunesBase = Array.isArray(sysData.conditionImmunities) ? sysData.conditionImmunities : [];
      const defensesDerived = ftComputeDefenses(actor, sysData);
      // Helper: does an entry list include this type at all (either type-only or any flavor)?
      const _hasType = (list, key) => (list ?? []).some(e => e?.type === key);
      // Helper: collect flavor labels for a type, if any flavor-qualified entries exist.
      const _flavorsFor = (list, key) => (list ?? []).filter(e => e?.type === key && e?.flavor).map(e => e.flavor);
      // Base arrays can still be flat strings (legacy); _hasBase treats both shapes.
      const _hasBase = (arr, key) => (arr ?? []).some(e =>
        (typeof e === "string" && e.toLowerCase() === key) ||
        (e && typeof e === "object" && String(e.type ?? "").toLowerCase() === key && !e.flavor)
      );
      const defenseTypeList = Object.entries(FT.DAMAGE_TYPES).map(([key, cfg]) => ({
        key,
        label: cfg.label,
        baseResist:  _hasBase(defensesBase.resistances,     key),
        baseImmune:  _hasBase(defensesBase.immunities,      key),
        baseVuln:    _hasBase(defensesBase.vulnerabilities, key),
        derivedResist: _hasType(defensesDerived.resistances,     key),
        derivedImmune: _hasType(defensesDerived.immunities,      key),
        derivedVuln:   _hasType(defensesDerived.vulnerabilities, key),
        // Flavor chips: rendered separately from the type-only chip when an
        // item grants a flavor carve-out.
        resistFlavors: _flavorsFor(defensesDerived.resistances,     key),
        immuneFlavors: _flavorsFor(defensesDerived.immunities,      key),
        vulnFlavors:   _flavorsFor(defensesDerived.vulnerabilities, key)
      }));
      // Condition-immunity listing for chips + editor.
      const condList = Object.entries(FT.CONDITIONS ?? {}).map(([key, cfg]) => ({
        key,
        label: cfg.label,
        baseImmune:    condImmunesBase.map(x => String(x ?? "").toLowerCase()).includes(key),
        derivedImmune: defensesDerived.conditionImmunities.includes(key)
      }));
      derived.defenses = defensesDerived;

      // Ensure magic defaults
      magic.clarity  ??= { value: 3, max: 5 };
      magic.noise    ??= { value: 0, max: 10 };
      magic.sephirah ??= "tiferet";

      // Pre-compute pip state so HBS needs no helpers
      const clarityPips = Array.from({ length: magic.clarity.max ?? 5 }, (_, i) => ({
        filled: i < (magic.clarity.value ?? 0)
      }));

      // Pre-compute condition list for template
      const conditionList = Object.entries(FT.CONDITIONS).map(([key, cfg]) => ({
        key, label: cfg.label, color: cfg.color, desc: cfg.desc,
        active: conditions[key] ?? false
      }));
      const activeConditions = conditionList.filter(c => c.active);

      // Sprint C: BBTTCC bridge context
      const bbttcc = await getBBTTCCContext(actor);

      // Sprint D: class resource pools
      let resources   = {};
      let activePools = {};
      let burnBand    = { label: "Controlled", color: "#27ae60", desc: "Stable." };
      let auraState   = "none";
      try {
        resources   = sysData.resources ?? {};
        activePools = detectActivePools ? detectActivePools(actor) : {};
        const burn  = resources.burn?.current ?? 0;
        burnBand    = getBurnBand ? getBurnBand(burn) : burnBand;
        auraState   = resources.aura?.state ?? "none";
      } catch(poolErr) {
        console.error("Roll for Initiation | Resource pool context failed:", poolErr);
      }

      // Sprint E: level, skill ranks, AE bonuses
      const details      = sysData.details ?? { level: 1, tier: 1, statPoints: 0, skillPoints: 0 };
      const skillAE      = getAllSkillAEBonuses ? getAllSkillAEBonuses(actor) : {};
      const attrAE       = getAllAttrAEBonuses  ? getAllAttrAEBonuses(actor)  : {};

      // Display-only slang relabel for Aptitudes. Schema/keys/labels in template.json
      // stay canonical (powers, grants, and item descriptions still reference the
      // straight names) — we only swap the visible label and attach a reluctant
      // "fine, it's the real name" tooltip per row.
      const SLANG_APTITUDE = {
        brawl:        { label: "Throwing Hands",                tip: "Fine, Brawl" },
        melee:        { label: "Sword Energy",                  tip: "Melee, whatever" },
        firearms:     { label: "Pew Pew",                       tip: "Firearms ... sure, I guess" },
        athletics:    { label: "Touched Grass",                 tip: "Whatever, Athletics" },
        stealth:      { label: "Low-Key",                       tip: "Fine, it's Stealth" },
        hacking:      { label: "Goblin Mode (Online)",          tip: "Hacking. Sure." },
        tinkering:    { label: "Jank-Crafting",                 tip: "OK fine, Tinkering" },
        streetwise:   { label: "Knows a Guy",                   tip: "Streetwise, I guess" },
        weave:        { label: "Cassius Clay Energy",           tip: "Weave, whatever" },
        diplomacy:    { label: "Yapping",                       tip: "Diplomacy, ugh" },
        intimidation: { label: "Big Mad",                       tip: "Fine — Intimidation" },
        empathy:      { label: "I Feel You Boo",                tip: "Empathy ... sure" },
        performance:  { label: "Main Character Moment",         tip: "Performance, I guess" },
        perception:   { label: "Check That Shit Out",           tip: "Fine, Perception" },
        investigation:{ label: "Sleuthing Hours",               tip: "Investigation, whatever" },
        lore:         { label: "Reads the Wiki",                tip: "Lore. Sure." },
        occult:       { label: "Spooky Knowledge",              tip: "Occult, I guess" },
        faith:        { label: "Touched by an Angel or Whatever", tip: "Fine, Faith" },
        meditation:   { label: "Logged Off",                    tip: "Meditation, whatever" },
        ritual:       { label: "Ceremonial Vibes",              tip: "Ritual, sure" },
        insight:      { label: "Lie Detector",                  tip: "Insight ... sure, I guess" },
        warding:      { label: "Boundary Setting (Lit.)",       tip: "Warding, ugh" },
        plating:      { label: "Tank Mode",                     tip: "Fine — Plating" }
      };

      // Build enriched skill list with precomputed pips (avoids nested-each context issues).
      // Skips malformed skill entries that lack either `label` or `attribute` — these show
      // up as blank rows on the sheet (typical cause: partial keystroke committed as a key,
      // e.g., "ins" instead of "insight"). Log once per entry so they can be cleaned up.
      const enrichedSkills = Object.entries(skills).flatMap(([key, skill]) => {
        const canonLabel = String(skill?.label ?? "").trim();
        const attribute  = String(skill?.attribute ?? "").trim();
        if (!canonLabel || !attribute) {
          console.warn(`Roll for Initiation | skipping malformed skill "${key}" on ${actor.name} — missing label/attribute. Remove with: actor.update({"system.skills.-=${key}": null})`);
          return [];
        }
        const slang = SLANG_APTITUDE[key];
        const label = slang?.label ?? canonLabel;
        const slangTooltip = slang?.tip ?? canonLabel;
        const rank   = skill.value ?? 0;
        // Beeb's "Touched Grass +9 / Untrained" symptom traces to legacy actors
        // that ended up with skill.value > 5 from old chargen passes. The
        // SKILL_RANK_DATA table only defines 0–5, so the fallback used to
        // misleadingly say "Untrained" with bonus = rank. Clamp the lookup at
        // 5 so any over-cap source rank displays as Legendary; preserve the
        // raw rank in `rank` so the breakdown still shows the actual stored
        // value, but use the clamped data for label/color.
        const rankClamped = Math.max(0, Math.min(5, Number(rank) || 0));
        const rd     = SKILL_RANK_DATA?.[rankClamped] ?? { label: "Untrained", color: "#546e7a", bonus: rankClamped };
        const skillAEB = skillAE[key] ?? 0;
        const attrAEB  = attrAE[attribute] ?? 0;
        const aeB    = skillAEB + attrAEB;
        const attrV  = attributes[attribute]?.value ?? 2;
        const pips   = Array.from({length: 5}, (_, i) => ({
          idx:    i + 1,
          filled: i < rankClamped,
          color:  i < rankClamped ? rd.color : null
        }));
        return [{ key, ...skill, label, slangTooltip, rank, rankData: rd, pips, aeBonus: aeB,
                 attrBonus: attrV, totalBonus: attrV + rank + aeB,
                 breakdown: `${attrV} ${attribute}${rank ? ` + ${rank} rank` : ""}${aeB ? ` + ${aeB} AE` : ""}` }];
      });

      const rawPowers = Array.from(actor.items).filter(i => i.type === "power");
      const rawWeapons = Array.from(actor.items).filter(i => i.type === "weapon");
      // Manifested weapons (origin: crafted) → Manifestations tab.
      // Mundane/looted/vendor weapons → Inventory tab (joined into `gear` below).
      const manifestedWeapons = rawWeapons.filter(i => RfiItems.is.isManifestation(i));
      const mundaneWeapons    = rawWeapons.filter(i => !RfiItems.is.isManifestation(i));
      const manifestPowers = rawPowers.map(i => ftBuildManifestationRow(i, "power"));
      const manifestForms  = manifestedWeapons.map(i => ftBuildManifestationRow(i, "weapon"));
      const manifestationGuide = ftManifestationGuide(magic.sephirah);

      // Unified manifestation list (grouped by tier) replaces the legacy
      // Motion/Stay split in the cleaned-up tab. Stability chip tells the
      // Form/Working story per row.
      const manifestAll = [...manifestPowers, ...manifestForms]
        .sort((a, b) => (a.tier - b.tier) || String(a.name ?? "").localeCompare(String(b.name ?? "")));

      // Active manifestation tracker — resolve back to item info for display.
      const activeRaw = actor.getFlag("fourththing", "activeManifestations") ?? [];
      const activeManifestations = activeRaw.map(e => {
        const item = actor.items.get(e.itemId);
        return {
          ...e,
          exists: !!item,
          img: item?.img ?? "icons/svg/mystery-man.svg",
          name: item?.name ?? e.itemName ?? "Lost Manifestation",
          stabilityLabel: FT.MANIFESTATION_STABILITIES?.[e.stability]?.label ?? ftCap(e.stability ?? ""),
          upkeepHint: e.stability === "sustained" ? `${e.tier} Clarity / scene`
                    : e.stability === "bound"     ? `${e.tier} Clarity / Soma Break`
                    : e.stability === "enduring"  ? `${e.tier} Clarity / Soma Break + OP tick`
                    : ""
        };
      });

      // Guidance panel collapse state — user-level preference, default closed.
      const guidanceOpen = !!(game.user?.getFlag("fourththing", "manifestGuidanceOpen"));

      const featureClassName = bbttcc?.identity?.cls ?? "";
      const featureAncestryName = bbttcc?.identity?.ancestry ?? "";
      const coTopForGrants = actor.flags?.["bbttcc-character-options"] ?? {};
      const linksForGrants = coTopForGrants.nativeLinks ?? {};
      const classGrantNames = await ftCollectGrantedNames(coTopForGrants.classUuid ?? linksForGrants.classUuid ?? "");
      const ancestryGrantNames = await ftCollectGrantedNames(coTopForGrants.speciesUuid ?? linksForGrants.speciesUuid ?? "");
      const featuresEnriched = Array.from(actor.items)
        .filter(i => ["feature","feat","class","subclass","race"].includes(i.type))
        .map(i => ({
          ...(i.toObject ? i.toObject() : i),
          id: i.id,
          typeLabel: ({
            feature: "Principle",
            feat: "Technique",
            class: "Path",
            subclass: "Doctrine",
            race: "Ancestry"
          })[i.type] ?? i.type,
          hasActiveAbility: isActionableFeature(i),
          group: ftClassifyPrinciple(i, {
            className: featureClassName,
            ancestryName: featureAncestryName,
            classGrantNames,
            ancestryGrantNames
          })
        }));

      // Bulwark resource pools — only render header chips if the actor carries
      // a Bulwark class item (otherwise frame/ruin defaults from template would
      // misleadingly show on every Steward).
      const _bulwarkCls = Array.from(actor.items).find(i => i.type === "class" && i.system?.identifier === "bulwark");
      const _bulwarkMerged = !!actor.flags?.fourththing?.bulwark?.inevitabilityMerged;
      const _frameC = resources.frameDice?.current   ?? 0;
      const _frameM = resources.frameDice?.max       ?? 0;
      const _ruinC  = resources.ruinCharges?.current ?? 0;
      const _ruinM  = resources.ruinCharges?.max     ?? 0;
      const bulwarkPools = _bulwarkCls ? {
        frame:  { current: _frameC, max: _frameM },
        ruin:   { current: _ruinC,  max: _ruinM  },
        merged: _bulwarkMerged,
        inev:   _bulwarkMerged ? { current: _frameC + _ruinC, max: _frameM + _ruinM } : null
      } : null;

      // TCC flag — surfaces the Fiat (T0) button on the sheet for
      // Trad Caster Class actors (Cosmic Linguist, Wyrdlens Adept, Dreamwalker,
      // Pactkeeper). Engine enforces independently; this is just UI gating.
      const actorIsTCC = isTCC(actor);

      // Shadow Courier — Pace pool + Package slot, plus route detection so the
      // Deliver action can fire route-specific delivery effects automatically.
      const _courierCls = Array.from(actor.items).find(i => i.type === "class" && i.system?.identifier === "shadow_courier");
      const _courierSub = _courierCls
        ? Array.from(actor.items).find(i => i.type === "subclass" && /^bbttcc-shadow-courier/.test(i.system?.identifier ?? ""))
        : null;
      const _courierRouteKey = (() => {
        const id = _courierSub?.system?.identifier ?? "";
        if (id.includes("wayfarer"))   return "wayfarer";
        if (id.includes("black-stair"))return "blackstair";
        if (id.includes("last-mile"))  return "lastmile";
        return null;
      })();
      const _hasPackageMastery = _courierCls && Array.from(actor.items)
        .some(i => i.type === "feat" && i.system?.identifier === "shadow_courier_tier3_package_mastery");
      const shadowCourierState = _courierCls ? {
        pace:    { current: resources.pace?.current ?? 0, max: resources.pace?.max ?? 0 },
        package: {
          type:    resources.package?.type    ?? "",
          id:      resources.package?.id      ?? "",
          carried: resources.package?.carried ?? false
        },
        routeKey:           _courierRouteKey,
        hasPackageMastery:  _hasPackageMastery
      } : null;

      // Cosmic Linguist — Resonance Dice + Strain + Authority (Phase B 2026-05-07).
      // Resonance auto-gains 1/round at turn start; full refill on Soma Break.
      // Strain ticks via "aggressive" Resonance spends; resets on Soma Break.
      // Authority is the older narrative pool, now first-class on the sheet.
      const _clCls = Array.from(actor.items).find(it => it.type === "class" && it.system?.identifier === "cosmic_linguist");
      const cosmicLinguistState = _clCls ? {
        resonance: {
          current: resources.resonanceDice?.current ?? 0,
          max:     resources.resonanceDice?.max     ?? 0
        },
        strain: {
          value: resources.strain?.value ?? 0,
          max:   resources.strain?.max   ?? 10
        },
        authority: {
          current: resources.clAuthority?.current ?? 0,
          max:     resources.clAuthority?.max     ?? 0
        }
      } : null;

      // Phase B (2026-05-07) — Wyrdlens / Dreamwalker / Pactkeeper sheet states.
      // Mirrors cosmicLinguistState — null when the actor doesn't carry the
      // class, otherwise a snapshot of pool data ready for HBS chip rendering.
      const _wlCls = Array.from(actor.items).find(it => it.type === "class" && (it.system?.identifier === "wyrdlens-adept" || it.system?.identifier === "wyrdlens_adept"));
      const wyrdlensState = _wlCls ? {
        overlay: {
          current: resources.probabilityOverlay?.current ?? 0,
          max:     resources.probabilityOverlay?.max     ?? 1
        }
      } : null;

      const _dwCls = Array.from(actor.items).find(it => it.type === "class" && it.system?.identifier === "dreamwalker");
      const _hasEchoFeat = _dwCls && Array.from(actor.items).some(it => it.type === "feat" && it.system?.identifier === "dream-echo-reservoir");
      const dreamwalkerState = _dwCls ? {
        cache: {
          banked: resources.dreamCache?.banked === true,
          name:   resources.dreamCache?.name   ?? "",
          tier:   Number(resources.dreamCache?.tier ?? 0)
        },
        echo: _hasEchoFeat ? {
          dice:    resources.echoDice?.dice    ?? 0,
          maxDice: resources.echoDice?.maxDice ?? 2
        } : null
      } : null;

      // Sig Mode stance pills (Phase D 2026-05-08). One pill per active stance,
      // surfaced in the header chip row. Click drops the stance via dispatcher.
      const _modeFlags = actor.flags?.fourththing?.modes ?? {};
      const _SIG_MODE_DEF = {
        clSentence:    { label: "The Sentence",    handler: "cl_mode_sentence",    color: "#c8c8ff", border: "#5a3a8a", bg: "#1f1f3a" },
        wlRefraction:  { label: "Refraction",      handler: "wl_mode_refraction",  color: "#a0c8d8", border: "#3a6a8a", bg: "#1a2f3a" },
        dwWalkingLane: { label: "Walking Lane",    handler: "dw_mode_walking_lane",color: "#c8a0ff", border: "#6a3a8a", bg: "#2a1f3a" },
        pkSealedPact:  { label: "Sealed Pact",     handler: "pk_mode_sealed_pact", color: "#a0c8b8", border: "#3a6a5a", bg: "#1f2a2a" }
      };
      const sigModePills = Object.entries(_SIG_MODE_DEF)
        .filter(([k]) => _modeFlags[k] === true)
        .map(([k, def]) => ({ key: k, ...def }));

      const _pkCls = Array.from(actor.items).find(it => it.type === "class" && it.system?.identifier === "pactkeeper");
      const _pressureValue = Number(resources.administrativePressure?.value ?? 0);
      const _pressureBand  = _pressureValue >= 6 ? "high"
                          : _pressureValue >= 3 ? "moderate"
                          : _pressureValue >= 1 ? "low"
                          : "none";
      const _pactSubject = actor.flags?.fourththing?.pactSubject ?? null;
      const pactkeeperState = _pkCls ? {
        leverage: {
          current: resources.pactLeverage?.current ?? 0,
          max:     resources.pactLeverage?.max     ?? 0
        },
        civicCharge: {
          dice:    resources.civicCharge?.dice    ?? 0,
          maxDice: resources.civicCharge?.maxDice ?? 1,
          dieSize: resources.civicCharge?.dieSize ?? "d6"
        },
        pressure: {
          value: _pressureValue,
          max:   resources.administrativePressure?.max ?? 10,
          band:  _pressureBand,
          bandLabel: _pressureBand === "none" ? "Clear"
                   : _pressureBand === "low"  ? "Low"
                   : _pressureBand === "moderate" ? "Moderate"
                   : "High"
        },
        pactSubject: _pactSubject?.uuid ? {
          uuid: _pactSubject.uuid,
          name: _pactSubject.name ?? "(unnamed)"
        } : null
      } : null;

      // Death & Dying: surface Last Stand pips + Blood Debt ledger so the
      // template renders without inline date math or pip arithmetic.
      const lastStandRaw = sysData.lastStand ?? { active: false, successes: 0, failures: 0, ledger: [] };
      const lsData = {
        active:     lastStandRaw.active === true,
        successes:  Number(lastStandRaw.successes ?? 0),
        failures:   Number(lastStandRaw.failures  ?? 0),
        successPips: Array.from({ length: 3 }, (_, i) => ({ filled: i < Number(lastStandRaw.successes ?? 0) })),
        failurePips: Array.from({ length: 3 }, (_, i) => ({ filled: i < Number(lastStandRaw.failures  ?? 0) }))
      };
      const isDying = conditions.dying === true;

      const bdRaw = sysData.bloodDebt ?? { value: 0, ledger: [] };
      const bdEntries = (Array.isArray(bdRaw.ledger) ? bdRaw.ledger : []).slice().reverse().map(e => {
        const ts = Number(e?.ts ?? 0);
        const d  = ts ? new Date(ts) : null;
        return {
          value:     Number(e?.value ?? 0),
          source:    String(e?.source ?? "manual"),
          tag:       String(e?.tag ?? ""),
          note:      String(e?.note ?? ""),
          dateLabel: d ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""
        };
      });
      const bdData = {
        value:    Number(bdRaw.value ?? 0),
        hasDebt:  (Number(bdRaw.value ?? 0) > 0) || bdEntries.length > 0,
        entries:  bdEntries,
        awaitingReincarnation: !!actor.flags?.fourththing?.awaitingReincarnation
      };

      return {
        actor,
        system:        sysData,
        attributes,
        skills,
        enrichedSkills,
        details,
        derived,
        magic:         { ...magic, clarityPips, noisePercent: (magic.noise.value ?? 0) * 10 },
        conditions:    conditionList,
        activeConditions,
        isDying,
        lastStand:     lsData,
        bloodDebt:     bdData,
        bulwarkPools,
        isTCC: actorIsTCC,
        shadowCourierState,
        cosmicLinguistState,
        wyrdlensState,
        dreamwalkerState,
        pactkeeperState,
        sigModePills,
        actions:       { actionUsed: actions.actionUsed ?? false,
                         bonusUsed:  actions.bonusUsed  ?? false,
                         reactionUsed: actions.reactionUsed ?? false },
        actionEconomy: (() => {
          const mv        = sysData?.derived?.movement ?? {};
          const walkFt    = Number(mv.walk) || 30;
          const movUsed   = Number(actions.movementUsedFt)   || 0;
          const movBudget = Number(actions.movementBudgetFt) || walkFt;
          const remaining = Math.max(0, movBudget - movUsed);
          const pct       = movBudget > 0 ? Math.min(100, (movUsed / movBudget) * 100) : 0;
          return {
            actionUsed:           actions.actionUsed   ?? false,
            bonusUsed:            actions.bonusUsed    ?? false,
            reactionUsed:         actions.reactionUsed ?? false,
            movementUsedFt:       movUsed,
            movementBudgetFt:     movBudget,
            movementRemainingFt:  remaining,
            movementPct:          Math.round(pct),
            movementOver:         movUsed > movBudget,
            speeds: {
              walk:  Number(mv.walk)  || 0,
              climb: Number(mv.climb) || 0,
              swim:  Number(mv.swim)  || 0,
              fly:   Number(mv.fly)   || 0
            }
          };
        })(),
        ftFlags:       actor.flags?.fourththing ?? {},
        resources,
        activePools,
        burnBand,
        auraState,
        auraData:      (AURA_STATES ?? {})[auraState] ?? { label: "None", color: "#78909c", desc: "" },
        powers:        rawPowers,
        weapons:       rawWeapons,
        manifestPowers,
        manifestForms,
        manifestAll,
        activeManifestations,
        guidanceOpen,
        manifestationGuide,
        manifestationCoachHtml: buildManifestationCoachHTML(actor, {
          kind: "power",
          system: {
            sephirah: magic.sephirah,
            manifestation: { form: "sigil", function: "transform", duration: "instant", scale: "personal" }
          }
        }),
        features:      featuresEnriched,
        featureGroups: {
          path:     featuresEnriched.filter(f => f.group === "path"),
          ancestry: featuresEnriched.filter(f => f.group === "ancestry"),
          identity: featuresEnriched.filter(f => f.group === "identity"),
          other:    featuresEnriched.filter(f => f.group === "other")
        },
        // Inventory: armor + gear + mundane (non-crafted) weapons. Crafted
        // gear/armor/weapons live in the Manifestations tab instead. Each row
        // is enriched with RFI flag data + a key stat line so the partial can
        // render without reaching back into raw item docs.
        gear: [
          ...Array.from(actor.items).filter(i => ["armor","gear"].includes(i.type) && !RfiItems.is.isManifestation(i)),
          ...mundaneWeapons
        ].map(i => {
          const rfi = RfiItems.get(i);
          const isEquipped = i.type === "armor"
            ? !!i.system?.equipped
            : !!i.getFlag("fourththing", "equipped");
          const dmg = i.system?.damage?.formula;
          const dmgType = i.system?.damage?.type;
          const stat = i.type === "weapon"
              ? `${dmg ?? ""}${dmgType ? ` ${dmgType}` : ""}${i.system?.category ? ` · ${i.system.category}` : ""}`.trim()
            : i.type === "armor"
              ? (() => {
                  const sgn = (n) => (n > 0 ? `+${n}` : `${n}`);
                  return [
                    i.system?.guardBonus    ? `Guard ${sgn(i.system.guardBonus)}`     : "",
                    i.system?.evasionBonus  ? `Evasion ${sgn(i.system.evasionBonus)}` : "",
                    i.system?.resolveBonus  ? `Resolve ${sgn(i.system.resolveBonus)}` : "",
                    i.system?.armorSkill    ? `[${i.system.armorSkill}]`              : ""
                  ].filter(Boolean).join(" · ");
                })()
            : (() => {
                // Gear stat line: prefer consumable charges, then resistance grants
                // (so "shields rad" reads better than "misc"), then the first non-
                // boilerplate tag. Falls back to the slot only if nothing else is
                // worth saying.
                const rfi = RfiItems.get(i);
                if (rfi?.frame === "consumable") {
                  const ch = Number(rfi.charges ?? 0);
                  return ch > 1 ? `${ch} doses` : "single-use";
                }
                const grantedResist = i.flags?.fourththing?.grants?.resistances;
                if (Array.isArray(grantedResist) && grantedResist.length) {
                  const types = grantedResist.map(g => typeof g === "string" ? g : g?.type).filter(Boolean);
                  if (types.length) return `resists ${types.join(", ")}`;
                }
                const tags = Array.isArray(i.system?.tags) ? i.system.tags : [];
                const meaningful = tags.find(t => !/^(consumable|gear|misc|tier-)/i.test(String(t)));
                if (meaningful) return String(meaningful);
                return rfi?.frame || i.system?.slot || "";
              })();
          const qty = Number(i.system?.quantity ?? 0);
          return {
            id:    i.id,
            uuid:  i.uuid,
            name:  i.name,
            img:   i.img,
            type:  i.type,
            stat,
            qty:   qty > 1 ? qty : null,
            isEquipped,
            rfi:   rfi ?? null,
            tier:  rfi?.tier ?? null,
            frame: rfi?.frame ?? null,
            origin: rfi?.origin ?? null,
            signature: rfi?.signature ?? "",
            // True when the item carries a consume block — surfaces the Use
            // button on the inventory row.
            isConsumable: !!rfi?.consume,
            charges:      Number(rfi?.charges ?? 0) || null
          };
        }),
        manifestedGear: Array.from(actor.items).filter(i => ["armor","gear"].includes(i.type) && RfiItems.is.isManifestation(i)),
        ...(() => {
          // Shared change-formatter used by BOTH activeEffects (editable list)
          // and passiveEffects (read-only player view). Drops flag/gating
          // changes (gates aren't user-facing), and chooses a humanized text
          // per change key shape.
          const formatChange = (c) => {
            const key  = String(c.key ?? "");
            const type = c.type;
            const raw  = c.value;
            const num  = Number(raw);
            const isNumeric = Number.isFinite(num);

            if (key.startsWith("flags.") || type === "custom") return null;

            const stat = key.match(/^system\.(attributes|skills|derived|magic|resources)\.([^.]+)\.(value|max)$/);
            if (stat) {
              const label = stat[2].charAt(0).toUpperCase() + stat[2].slice(1);
              const valueStr = (typeof raw === "string" && /^[+-]/.test(raw))
                ? raw
                : ((type === "add" && isNumeric && num >= 0) ? `+${raw}` : `${raw}`);
              return { format: "stat", text: `${valueStr} ${label}` };
            }

            const skillBonus = key.match(/^system\.skills\.([^.]+)\.bonuses\.(check|save)$/);
            if (skillBonus) {
              const label = skillBonus[1].charAt(0).toUpperCase() + skillBonus[1].slice(1);
              const kind  = skillBonus[2] === "save" ? "save" : "check";
              const valueStr = (typeof raw === "string" && /^[+-]/.test(raw)) ? raw : (isNumeric && num >= 0 ? `+${raw}` : `${raw}`);
              return { format: "stat", text: `${valueStr} ${label} ${kind}` };
            }

            const trait = key.match(/^system\.traits\.(dr|di|dv|ci)\.value$/);
            if (trait) {
              const labelMap = { dr: "Resistance", di: "Immunity", dv: "Vulnerability", ci: "Condition Immunity" };
              return { format: "trait", text: `${labelMap[trait[1]]}: ${raw}` };
            }

            const last = key.split(".").pop();
            return { format: "other", text: `${last}: ${raw}` };
          };

          // Pretty effect-name fallback for system-generated tags like
          // "ft-aura-fury" → "Fury Aura" (Aurablade canon).
          const prettifyAura = (name) => {
            const m = String(name ?? "").match(/^ft-aura-(.+)$/);
            if (!m) return name;
            const state = m[1].charAt(0).toUpperCase() + m[1].slice(1);
            return `${state} Aura`;
          };

          return {
            // Condition-mirror AEs render under their own States-tab section
            // (built from `conditions` context), so suppress them here to avoid
            // double-listing under "States & Modifiers".
            activeEffects: (() => {
              const rows = Array.from(actor.effects ?? [])
                .filter(e => !e.flags?.fourththing?.condition)
                .map(e => ({
                  id: e.id,
                  name: prettifyAura(e.name),
                  icon: e.icon,
                  disabled: e.disabled,
                  isAura: !!e.flags?.fourththing?.auraEffect,
                  changeTags: (e.changes ?? []).map(formatChange).filter(Boolean),
                  sourceName: e.flags?.fourththing?.source ?? e.origin ?? "",
                  _primaryKey: e.changes?.[0]?.key || ""
                }));
              return _ftCategorizeEffects(rows).flat;
            })(),
            activeEffectGroups: (() => {
              const rows = Array.from(actor.effects ?? [])
                .filter(e => !e.flags?.fourththing?.condition)
                .map(e => ({
                  id: e.id,
                  name: prettifyAura(e.name),
                  icon: e.icon,
                  disabled: e.disabled,
                  isAura: !!e.flags?.fourththing?.auraEffect,
                  changeTags: (e.changes ?? []).map(formatChange).filter(Boolean),
                  sourceName: e.flags?.fourththing?.source ?? e.origin ?? "",
                  _primaryKey: e.changes?.[0]?.key || ""
                }));
              return _ftCategorizeEffects(rows).groups;
            })(),
            passiveEffects: (actor.appliedEffects ?? [])
              .filter(e => !e.flags?.fourththing?.auraEffect)
              .filter(e => Array.isArray(e.changes) && e.changes.length > 0)
              .map(e => ({
                id: e.id,
                name: e.parent?.name && e.parent !== actor ? e.parent.name : e.name,
                icon: e.icon ?? e.img ?? "icons/svg/aura.svg",
                disabled: e.disabled,
                effectName: e.name,
                changes: e.changes.map(formatChange).filter(Boolean)
              }))
              .filter(p => p.changes.length > 0),
            // Phase C triggers — items declaring `flags.fourththing.triggers`
            triggerRows: (() => {
              const eventLabel = {
                "on-attack-hit":"on attack hit","on-damage-taken":"on damage taken",
                "on-skill-fail":"on skill fail","on-skill-success":"on skill success",
                "on-self-or-ally-hit":"when self/ally hit","on-would-drop-to-zero":"when dropping to 0",
                "on-soma-break":"on Soma Break","on-move":"on move",
                "on-delivery":"on delivery","on-agreement":"on agreement",
                "on-rest":"on rest","on-scene-start":"scene start","on-scene-end":"scene end",
                "on-combat-start":"combat start","on-combat-end":"combat end",
                "on-cast":"on cast","on-misfire":"on misfire","on-help-action":"on help",
                "on-turn-start":"turn start","on-turn-end":"turn end","on-kill":"on kill"
              };
              const rows = [];
              for (const item of actor.items ?? []) {
                const trigs = item.flags?.fourththing?.triggers;
                if (!Array.isArray(trigs) || trigs.length === 0) continue;
                rows.push({
                  itemId:   item.id,
                  itemName: item.name,
                  itemImg:  item.img ?? "icons/svg/aura.svg",
                  badges: trigs.map(t => ({
                    eventLabel: eventLabel[t.event] ?? t.event,
                    effectKind: t.effect?.kind ?? "?",
                    limit:      t.limit ? `${t.limit.uses}/${t.limit.window}` : null,
                    note:       t.note ?? null
                  }))
                });
              }
              return rows;
            })(),
            // Phase D resource grants — items declaring `flags.fourththing.resourceGrants`
            resourceGrantRows: (() => {
              const cadenceLabel = {
                "per-soma-break": "Soma Break",
                "per-scene":      "scene",
                "per-scene-start":"scene start",
                "per-scene-end":  "scene end",
                "per-scenario":   "scenario",
                "per-campaign-start": "campaign start",
                "per-strategic-turn": "strategic turn",
                "per-turn":       "turn",
                "on-condition":   "on trigger"
              };
              const resourceLabel = (r) => {
                if (typeof r !== "string") return String(r);
                if (r.endsWith("-op")) return r.replace(/-op$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) + " OP";
                return r.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              };
              const rows = [];
              for (const item of actor.items ?? []) {
                const grants = item.flags?.fourththing?.resourceGrants;
                if (!Array.isArray(grants) || grants.length === 0) continue;
                rows.push({
                  itemId:   item.id,
                  itemName: item.name,
                  itemImg:  item.img ?? "icons/svg/aura.svg",
                  badges: grants.map(g => ({
                    text: `${g.amount === "refill" ? "↻" : `+${g.amount}`} ${resourceLabel(g.resource)}`,
                    cadence: cadenceLabel[g.cadence] ?? g.cadence,
                    target:  g.target ?? null,
                    note:    g.note ?? null
                  }))
                });
              }
              return rows;
            })(),
            // Shape B reroll grants — items declaring `flags.fourththing.rerolls`
            rerollGrants: (() => {
              const fmtCtx = (g) => {
                const parts = [];
                if (g.context && g.context !== "check") parts.push(g.context);
                if (g.skill)     parts.push(g.skill);
                if (g.attribute) parts.push(g.attribute);
                if (!parts.length) parts.push("checks");
                return parts.join(" · ");
              };
              const rows = [];
              for (const item of actor.items ?? []) {
                const grants = item.flags?.fourththing?.rerolls;
                if (!Array.isArray(grants) || grants.length === 0) continue;
                rows.push({
                  itemId:   item.id,
                  itemName: item.name,
                  itemImg:  item.img ?? "icons/svg/aura.svg",
                  badges: grants.map(g => ({
                    arrow: g.mode === "reroll-lowest" ? "↑" : "↓",
                    text:  fmtCtx(g),
                    vs:    g.vs ?? null,
                    note:  g.note ?? null
                  }))
                });
              }
              return rows;
            })()
          };
        })(),
        bbttcc,
        SEPHIROTH:     FT.SEPHIROTH,
        INTENTS:       FT.INTENTS,
        CHANNELS:      FT.CHANNELS,
        MODES:         FT.MODES,
        CONDITIONS:    FT.CONDITIONS,
        DEFENSES:      FT.DEFENSES,
        DAMAGE_TYPES:  FT.DAMAGE_TYPES,
        defenseTypes:  defenseTypeList,
        defensesBase,
        condImmunityList: condList,
        SKILL_RANK_DATA: SKILL_RANK_DATA ?? {},
        isEditable:    this.isEditable,
      };
      } catch(err) {
        console.error("Roll for Initiation | _prepareContext FAILED:", err);
        // Return minimal context so sheet at least renders something
        return { actor, system: {}, attributes: {}, skills: {}, derived: {},
                 magic: { clarity: { value: 3, max: 5 }, noise: { value: 0, max: 10 }, sephirah: "tiferet", clarityPips: [], noisePercent: 0 },
                 conditions: [], activeConditions: [], actions: {}, resources: {}, activePools: {},
                 burnBand: { label: "Controlled", color: "#27ae60" },
                 auraState: "none", auraData: { label: "None", color: "#78909c", desc: "" },
                 powers: [], weapons: [], manifestPowers: [], manifestForms: [],
                 manifestationGuide: ftManifestationGuide("tiferet"), manifestationCoachHtml: "",
                 features: [], featureGroups: { path: [], ancestry: [], identity: [], other: [] },
                 gear: [], bbttcc: { active: false, identity: {}, tikkun: {}, terrain: {} },
                 SEPHIROTH: FT.SEPHIROTH, INTENTS: FT.INTENTS, CHANNELS: FT.CHANNELS,
                 MODES: FT.MODES, CONDITIONS: FT.CONDITIONS, DEFENSES: FT.DEFENSES, isEditable: true };
      }
    }

    _onRender(context, options) {
      this._bindTabClicks();
      this._applyActiveTab();
      this._bindInlineEditors();
      this._restoreEditMode();
      this._bindDragDrop();
    }

    // Wire compendium → sheet drops. Native DOM events, idempotent per element.
    // Errors here must NOT break the sheet — they're logged and swallowed.
    _bindDragDrop() {
      try {
        const el = this.element;
        if (!el || el.dataset.ftDropBound === "1") return;
        el.dataset.ftDropBound = "1";
        el.addEventListener("dragover", this._onDragOver.bind(this));
        el.addEventListener("drop",      this._onDrop.bind(this));
        for (const row of el.querySelectorAll("[data-item-id]")) {
          row.setAttribute("draggable", "true");
          row.addEventListener("dragstart", this._onDragStart.bind(this));
        }
      } catch (err) {
        console.error("Roll for Initiation | drag-drop wiring failed:", err);
      }
    }

    _restoreEditMode() {
      if (!this._bbttccEditMode) return;
      const sheet = this.element?.querySelector(".ft-sheet");
      if (sheet) sheet.classList.add("ft-edit-mode");
      const btn = this.element?.querySelector(".ft-edit-mode-btn");
      if (btn) {
        btn.textContent = "✓ Editing";
        btn.classList.add("ft-edit-active");
      }
    }

    _bindInlineEditors() {
      const el = this.element;
      if (!el) return;

      el.querySelectorAll("[data-ft-inline-edit]").forEach(node => {
        if (node.dataset.ftBound === "1") return;
        node.dataset.ftBound = "1";

        node.addEventListener("change", async (ev) => {
          const target = ev.currentTarget;
          const field = target?.dataset?.ftInlineEdit;
          const value = target?.value ?? "";
          try {
            switch (field) {
              case "faction":
                await setActorFaction(this.actor, value);
                break;
              case "archetype":
                await applyIdentitySlotChange(this.actor, "archetype", value);
                break;
              case "political":
                await setActorPoliticalPhilosophy(this.actor, value);
                break;
              case "sephirotic":
                await applyIdentitySlotChange(this.actor, "sephirothicAlignment", value);
                break;
              case "enlightenment":
                await setActorEnlightenment(this.actor, value);
                break;
              case "class":
                await applyActorClassChange(this.actor, value);
                break;
              case "ancestry":
                await applyActorAncestryChange(this.actor, value);
                break;
              case "heritage":
                await applyActorHeritageChange(this.actor, value);
                break;
              case "subclass":
                await applyActorSubclassChange(this.actor, value);
                break;
              case "crew":
                await setActorEchoAssetSlot(this.actor, "crew", value);
                break;
              case "occult":
                await setActorEchoAssetSlot(this.actor, "occult", value);
                break;
              default:
                return;
            }
            this.render();
          } catch (err) {
            console.error("Roll for Initiation | inline identity edit failed:", field, err);
            ui.notifications?.warn(`Could not update ${field || "identity"}. Check console for details.`);
          }
        });
      });
    }

    // Bind tab click handlers ONCE per element. The previous implementation
    // (`_activateTabs`) added a fresh `click` listener every render AND
    // recursively called itself from inside the handler — so each click
    // doubled the listener count on every tab, producing exponential growth
    // and the "slower and slower → freeze" behavior reported on rapid tab
    // switching. Guard with `dataset.ftTabBound` so each button is wired once.
    _bindTabClicks() {
      const el = this.element;
      if (!el) return;
      el.querySelectorAll(".ft-tabs .item").forEach(btn => {
        if (btn.dataset.ftTabBound === "1") return;
        btn.dataset.ftTabBound = "1";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.tabGroups.primary = btn.dataset.tab;
          this._applyActiveTab();
        });
      });
    }

    // Toggle the `.active` class on tab buttons and tab panels for the current
    // primary tab. NO listener binding here — safe to call from click handlers
    // and from render without leaks.
    _applyActiveTab() {
      const el = this.element;
      if (!el) return;
      const active = this.tabGroups.primary ?? "core";
      el.querySelectorAll(".ft-tabs .item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === active);
      });
      el.querySelectorAll(".ft-body .tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === active);
      });
    }

    // Action handlers — `this` is the sheet instance

    static async _onFtRoll(event, target) {
      return game.fourththing.rolls.attributeTest(this.actor, {
        attribute: target.dataset.attribute,
        skill:     target.dataset.skill || null,
        label:     target.dataset.label || ""
      });
    }

    static async _onFtCast(event, target) {
      const itemId  = target.closest("[data-item-id]")?.dataset.itemId;
      const item    = itemId ? this.actor.items.get(itemId) : null;
      const rawSys  = this.actor.system?.system ?? this.actor.system;
      const intent  = item?.system?.intent   ?? "presence";
      const channel = item?.system?.channel  ?? "soul";
      const seph    = item?.system?.sephirah ?? rawSys?.magic?.sephirah ?? "tiferet";
      const label   = item?.name             ?? "Manifestation";
      const actor   = this.actor;

      new Dialog({
        title:   `Invoke: ${label}`,
        content: buildCastDialogHTML(actor, { intent, channel, sephirah: seph, label, item }),
        buttons: {
          cast: {
            icon:  "<i class='fas fa-magic'></i>",
            label: "Invoke",
            callback: async (html) => {
              const dc   = parseInt(html.find("[name='difficulty']").val()) || 15;
              const selI = html.find("[name='intent']").val()   || intent;
              const selC = html.find("[name='channel']").val()  || channel;
              const selS = html.find("[name='sephirah']").val() || seph;
              const mode = html.find("[name='castMode']:checked").val() || "hermetic";
              const reachPathVal = html.find("[name='reachPath']:checked").val() || "";
              const restraint    = parseInt(html.find("[name='restraintReduction']").val()) || 0;
              const targetTokens = Array.from(game.user?.targets ?? []);
              const target       = targetTokens[0]?.actor ?? null;
              // Cosmic Linguist Resonance Channel allocation (no-op for non-CL).
              const resonanceSpend = {
                resolveDc:      Math.max(0, parseInt(html.find("[name='resResolveDc']").val())      || 0),
                damageDie:      Math.max(0, parseInt(html.find("[name='resDamageDie']").val())      || 0),
                extendDur:      Math.max(0, parseInt(html.find("[name='resExtendDur']").val())      || 0),
                defenseImpose:  Math.max(0, parseInt(html.find("[name='resDefenseImpose']").val())  || 0),
                stabilize:      Math.max(0, parseInt(html.find("[name='resStabilize']").val())      || 0),
                aggressive:     html.find("[name='resAggressive']").is(":checked") === true
              };
              const useOverlay  = html.find("[name='wlUseOverlay']").is(":checked")  === true;
              const bankToCache = html.find("[name='dwBankToCache']").is(":checked") === true;
              const useAoeSavePrompts = html.find("[name='useAoeSavePrompts']").is(":checked") === true;
              const aoeApplyConfirm   = html.find("[name='aoeApplyConfirm']").is(":checked")   === true;
              return castManifestation(actor, item, {
                intent: selI, channel: selC, sephirah: selS,
                label, difficulty: dc, mode, reachPath: reachPathVal,
                target, restraintReduction: restraint, resonanceSpend,
                useOverlay, bankToCache,
                useAoeSavePrompts, aoeApplyConfirm
              });
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "cast"
      }).render(true);
    }

    static async _onFtMisfire(event, target) {
      return game.fourththing.rolls.misfireRoll(this.actor);
    }

    static async _onFtManifestCreate(event, target) {
      // Direct V2 launch — the legacy starter dialog (Ephemeral/Stable/Ritual)
      // was an extra click; V2 step 1 (Concept) covers the same intent. Preset
      // buttons (Working/Form/Ritual) still pass an explicit `data-starter`
      // for one-click flavored opens. Bare "+ New Manifestation" → no starter.
      const starter = target?.dataset?.starter || "";
      const cfg = starter
        ? ftManifestationStarterConfig(starter, starter === "stable" || starter === "form" ? "weapon" : "power")
        : null;
      return openManifestationWizardV2(this.actor, {
        kind: cfg?.kind ?? "power",
        starter
      });
    }

    static async _onFtPowerCreate(event, target) {
      // Non-TCCs are redirected to "ritual" by the wizard's entry gate,
      // with a chat-notification — no special handling needed here.
      return openManifestationWizardV2(this.actor, { kind: "power", starter: "working" });
    }

    static async _onFtManifestDrop(event, target) {
      const instanceId = target?.dataset?.instanceId;
      if (!instanceId) return;
      const dropped = await ftDropActiveManifestation(this.actor, instanceId);
      if (dropped) ui.notifications?.info(`${this.actor.name}: manifestation dropped.`);
    }

    static async _onFtManifestEndScene(event, target) {
      return game.fourththing?.actions?.endScene?.(this.actor);
    }

    static async _onFtGuidanceToggle(event, target) {
      const cur = !!game.user?.getFlag("fourththing", "manifestGuidanceOpen");
      await game.user?.setFlag("fourththing", "manifestGuidanceOpen", !cur);
      this.render(false);
    }

    static async _onFtItemEdit(event, target) {
      const id   = target.closest("[data-item-id]")?.dataset.itemId;
      const item = id ? this.actor.items.get(id) : null;
      if (item) item.sheet.render(true);
    }

    static async _onFtItemDelete(event, target) {
      const id   = target.closest("[data-item-id]")?.dataset.itemId;
      const item = id ? this.actor.items.get(id) : null;
      if (!item) return;
      return Dialog.confirm({
        title:   "Delete Item",
        content: `<p>Remove <b>${item.name}</b>? This cannot be undone.</p>`,
        yes:     () => this.actor.deleteEmbeddedDocuments("Item", [id])
      });
    }

    static async _onFtItemEquip(event, target) {
      const id   = target.closest("[data-item-id]")?.dataset.itemId;
      const item = id ? this.actor.items.get(id) : null;
      if (!item) return;
      // Armor uses the native system.equipped (read by armor calc).
      // Weapons + gear use a flag so we don't have to extend their schema.
      if (item.type === "armor") {
        const next = !item.system?.equipped;
        await item.update({ "system.equipped": next });
      } else {
        const cur  = !!item.getFlag("fourththing", "equipped");
        await item.setFlag("fourththing", "equipped", !cur);
      }
    }

    static async _onFtConsume(event, target) {
      const id   = target.closest("[data-item-id]")?.dataset.itemId;
      const item = id ? this.actor.items.get(id) : null;
      if (!item) return;
      const consume = item.getFlag("fourththing", "rfi.item.consume");
      if (!consume) {
        ui.notifications?.warn(`${item.name} has no consume effects defined.`);
        return;
      }
      return runConsumeEffects(this.actor, item, consume);
    }

    static async _onFtForge(event, target) {
      return openForgeDialog(this.actor);
    }

    static async _onFtGather(event, target) {
      return openGatherDialog(this.actor);
    }

    static async _onFtStrike(event, target) {
      const itemId  = target.closest("[data-item-id]")?.dataset.itemId;
      const item    = itemId ? this.actor.items.get(itemId) : null;
      if (!item) return;
      return ftOpenEngageDialog(this.actor, item);
    }

    static async _onFtConditionToggle(event, target) {
      const condKey = target.dataset.condition;
      if (!condKey) return;
      await game.fourththing.toggleCondition(this.actor, condKey);
      this.render();
    }

    static async _onFtSetSkillRank(event, target) {
      const targetRank = Number(target.dataset.targetRank ?? 0);
      const skillKey   = target.closest("[data-skill]")?.dataset?.skill;
      const actor      = this.actor;
      if (!skillKey || !Number.isFinite(targetRank)) return;
      const sys = actor.system?.system ?? actor.system;
      const cur = Number(sys?.skills?.[skillKey]?.value ?? 0);
      // Click filled pip at current rank → decrement (standard star-rating pattern).
      const newRank = (cur === targetRank) ? Math.max(0, targetRank - 1) : Math.min(5, Math.max(0, targetRank));
      if (newRank === cur) return;
      await actor.update({ [`system.skills.${skillKey}.value`]: newRank });
    }

    // Defense check (Guard / Evasion / Resolve). Mirrors the NPC sheet's
    // ftNpcDefenseRoll path — 2d10x10 + derived defense value, posted to chat.
    // Used when something asks the steward to make a defense check actively.
    static async _onFtDefenseRoll(event, target) {
      const actor = this.actor;
      const which = String(target.dataset.defense || "guard");
      const sys   = actor.system?.system ?? actor.system ?? {};
      const v     = Number(sys.derived?.[which]?.value ?? 10);
      const roll  = await new Roll(`2d10x10 + ${v}`).roll();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor:  `${actor.name} — ${ftCap(which)} check (DC ${v})`
      });
    }

    static async _onFtSkillRoll(event, target) {
      const skill         = target.dataset.skill;
      let   attribute     = target.dataset.attribute;
      const actor         = this.actor;
      if (!skill || !attribute) return;

      // Aurablade Presence Edge — when an Aurablade rolls Melee, offer to swap
      // the keyed attribute from violence → presence for this roll. Flag is
      // stamped at chargen by stamp-class-l1-aptitudes.macro.js (Phase A 2026-05-04).
      const aurabladeMeleeAlt = actor.flags?.fourththing?.aurablade?.meleeAttrOption;
      if (skill === "melee" && aurabladeMeleeAlt && aurabladeMeleeAlt !== attribute) {
        const choice = await new Promise((resolve) => {
          new Dialog({
            title: "Aurablade — Melee Attribute",
            content: `<p style="margin:0.4rem 0">Channel the blade through which faculty?</p>
                      <p style="font-size:0.78rem;opacity:0.75;margin:0.2rem 0">Aurablades may key Melee off Violence (default) or Presence (the aura sings the cut).</p>`,
            buttons: {
              violence: { label: "Violence (default)", callback: () => resolve("violence") },
              alt:      { label: aurabladeMeleeAlt.charAt(0).toUpperCase() + aurabladeMeleeAlt.slice(1), callback: () => resolve(aurabladeMeleeAlt) }
            },
            default: "alt",
            close: () => resolve(attribute)
          }).render(true);
        });
        if (choice) attribute = choice;
      }

      const result = await skillRollWithRank(actor, { attribute, skill,
        label: actor.system?.skills?.[skill]?.label ?? skill });

      const { total, roll, rankData, attrVal, aeBonus, totalBonus,
              aeAttrContribs,
              isFumble, mechNote, rerollNote, label,
              surgeBanked, doubleTen, dieResults, kept } = result;

      // Build chat card
      const rankColor = rankData?.color ?? "#888";
      const notes = [mechNote, rerollNote].filter(Boolean).join(" · ");

      // Dice breakdown line — surface explosions + Surge banks so players can
      // SEE what happened on a 10. Each die shows base value, then any
      // exploded sub-rolls in parens. Dropped dice (rank 4+ keep-best-2) are
      // marked with strikethrough so the math is obvious.
      const keptIds = new Set((kept || []).map(d => d));
      const diceHtml = (dieResults || []).map(d => {
        const explodedTail = d.explosions.length
          ? ` <span style="color:#e8c84a;font-weight:600">!→${d.explosions.join("+")}</span>`
          : "";
        const isKept = !kept || kept.includes(d);
        return isKept
          ? `<span class="ft-dice-pip">${d.base}${explodedTail}</span>`
          : `<span class="ft-dice-pip" style="opacity:0.4;text-decoration:line-through">${d.base}${explodedTail}</span>`;
      }).join(" · ");
      const surgeNote = surgeBanked
        ? ` <span style="color:#e8c84a;font-weight:600">+${surgeBanked} Surge banked</span>`
        : "";
      const dblTenNote = doubleTen
        ? ` <span style="color:#4a90d9;font-weight:600">· Double-10 — Act Again</span>`
        : "";
      const breakdownHtml = (dieResults && dieResults.length)
        ? `<p style="font-size:0.74rem;opacity:0.85;margin:0.25rem 0 0">Dice: ${diceHtml}${surgeNote}${dblTenNote}</p>`
        : "";
      const passivesHtml = (aeAttrContribs && aeAttrContribs.length)
        ? `<p style="font-size:0.78rem;color:#e8c84a;margin:0.2rem 0 0">Passives: ${
            aeAttrContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")
          }</p>`
        : "";

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `<div class="fourththing-roll ft-attack-roll">
          <div class="ft-roll-header">
            <span class="ft-roll-name">${label}</span>
            <span class="ft-seph-pill" style="background:${rankColor}22;border-color:${rankColor}88;color:${rankColor}">
              ${rankData?.label ?? "Untrained"}
            </span>
          </div>
          <div class="ft-roll-formula">
            <span class="ft-fp" title="${attribute}">+${attrVal}</span>
            <span class="ft-fp" title="rank ${rankData?.bonus}">+${rankData?.bonus ?? 0}</span>
            ${aeBonus ? `<span class="ft-fp ft-ae-bonus" title="AE bonuses">+${aeBonus}</span>` : ""}
          </div>
          <div class="ft-roll-result ${isFumble ? 'ft-fumble' : total >= 20 ? 'ft-success' : ''}">
            <span class="ft-total">${isFumble ? '✗ Fumble' : total}</span>
          </div>
          ${breakdownHtml}
          ${passivesHtml}
          ${notes ? `<p style="font-size:0.72rem;opacity:0.55;margin:0.2rem 0 0">${notes}</p>` : ""}
        </div>`
      });
    }

    static async _onFtActionToggle(event, target) {
      const actionKey = target.dataset.actionKey;
      if (!actionKey) return;
      const rawSys = this.actor.system?.system ?? this.actor.system;
      const current = rawSys?.actions?.[actionKey] ?? false;
      await this.actor.update({ [`system.actions.${actionKey}`]: !current });
    }

    static async _onFtCombatAction(event, target) {
      const key = String(target.dataset.combatAction || "");
      return ftPerformCombatAction(this.actor, key);
    }

    // Manual movement adjust — used when the auto-debit on token move misses
    // (token-less moves, narrative repositioning, GM corrections). Clamped at 0;
    // soft-warn fires from the existing token-move hook if budget is exceeded.
    static async _onFtMoveAdjust(event, target) {
      const delta = Number(target.dataset.delta) || 0;
      if (!delta) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      const cur = Number(sys?.actions?.movementUsedFt) || 0;
      const budget = Number(sys?.actions?.movementBudgetFt) || 0;
      const next = Math.max(0, cur + delta);
      await this.actor.update({ "system.actions.movementUsedFt": next });
      if (delta > 0 && budget > 0 && next > budget && cur <= budget) {
        ui.notifications?.warn(`${this.actor.name}: movement ${next}ft exceeds budget ${budget}ft.`);
      }
    }

    static async _onFtNewTurn(event, target) {
      const sysSnap = this.actor.system?.system ?? this.actor.system;
      const walkFt  = Number(sysSnap?.derived?.movement?.walk) || 30;
      await this.actor.update({
        "system.actions.actionUsed":      false,
        "system.actions.bonusUsed":       false,
        "system.actions.reactionUsed":    false,
        "system.actions.movementUsedFt":  0,
        "system.actions.movementBudgetFt": walkFt
      });
      // Double-10 bonus-action is one-shot and per-turn — clear it on turn reset too.
      if (this.actor.flags?.fourththing?.bonusActionAvailable) {
        await this.actor.unsetFlag("fourththing", "bonusActionAvailable");
      }
      // Clear per-turn combat flags (Dodge / Disengage / Hold + B11.C rig
      // weapon fire gate + B12 pilot/engineer gates). combat.hidden
      // persists across turns until the steward acts overtly.
      const combat = this.actor.flags?.fourththing?.combat;
      const hasPerTurnFlag = combat && (
        combat.dodging || combat.disengaged || combat.holding ||
        combat.rigWeaponFiredThisRound || combat.rigWeaponsFiredThisRound ||
        combat.pilotActionUsedThisRound || combat.engineerRepairedThisRound
      );
      if (hasPerTurnFlag) {
        const next = { ...combat };
        delete next.dodging;
        delete next.disengaged;
        delete next.holding;
        delete next.rigWeaponFiredThisRound;        // legacy bool (BC)
        delete next.rigWeaponsFiredThisRound;       // 2026-05-13 per-weapon map
        delete next.lastFiredRigId;
        delete next.lastFiredWeaponId;
        delete next.pilotActionUsedThisRound;
        delete next.engineerRepairedThisRound;
        await this.actor.setFlag("fourththing", "combat", next);
      }

      // B12: when this steward is the pilot of a rig, reset the rig's
      // per-round combat state (holding / evading / brace / hexesMoved)
      // at the start of the pilot's turn. Defense bumps in
      // prepareDerivedData expire naturally once the flags clear.
      const boarded = this.actor.flags?.fourththing?.boardedRig;
      if (boarded?.rigId && boarded.role === "pilot") {
        const rig = game.actors?.get(boarded.rigId);
        const rigCmb = rig?.flags?.fourththing?.combat;
        if (rig && rigCmb && (rigCmb.holding || rigCmb.evading || rigCmb.brace || rigCmb.hexesMoved)) {
          const nextRigCmb = { ...rigCmb };
          delete nextRigCmb.holding;
          delete nextRigCmb.evading;
          delete nextRigCmb.brace;
          delete nextRigCmb.hexesMoved;
          await rig.setFlag("fourththing", "combat", nextRigCmb);
        }
      }
      ui.notifications.info(`${this.actor.name}: actions reset for new turn.`);
    }

    static async _onFtActAgain(event, target) {
      // Clear the flag and make sure bonus is available to use.
      await this.actor.unsetFlag("fourththing", "bonusActionAvailable");
      await this.actor.update({ "system.actions.bonusUsed": false });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="fourththing-roll">
          <div class="ft-roll-header"><span class="ft-roll-name">⚡ ${this.actor.name} acts again</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.8">
            Both base dice showed 10 — the moment folds back on itself. Bonus action regained.
          </p>
        </div>`
      });
    }

    static async _onFtSurgeSpend(event, target) {
      const actor  = this.actor;
      const rawSys = actor.system?.system ?? actor.system;
      const surge  = rawSys?.resources?.surge?.value ?? 0;

      if (surge <= 0) {
        ui.notifications.warn(`${actor.name}: no Surge banked to spend.`);
        return;
      }

      const opt = (cost, key, label, fiction) => `
        <button type="button" class="ft-surge-opt" data-cost="${cost}" data-effect="${key}"
                ${surge < cost ? "disabled" : ""}
                style="display:block;width:100%;text-align:left;padding:0.5rem 0.6rem;margin-bottom:0.4rem;
                       background:${surge < cost ? "rgba(255,255,255,0.03)" : "rgba(232,200,74,0.1)"};
                       border:1px solid ${surge < cost ? "rgba(255,255,255,0.1)" : "rgba(232,200,74,0.4)"};
                       border-radius:4px;color:${surge < cost ? "rgba(255,255,255,0.3)" : "#e8c84a"};cursor:${surge < cost ? "default" : "pointer"}">
          <div style="font-weight:600;font-size:0.82rem">${cost} Surge — ${label}</div>
          <div style="font-size:0.72rem;opacity:0.75;margin-top:0.15rem;font-style:italic">${fiction}</div>
        </button>`;

      const html = `<div class="ft-cast-dialog">
        <p style="font-size:0.78rem;opacity:0.7;margin:0 0 0.5rem">
          Banked: <b style="color:#e8c84a">${surge} Surge</b>. Choose one:
        </p>
        ${opt(1, "narrative-bonus-die", "Add +1d10 exploding to a roll you are about to make.",
              "You press the moment — the dice remember what they were doing.")}
        ${opt(2, "narrative-miss",      "Reaction: treat one incoming attack as a miss.",
              "You slide sideways through the moment.")}
        ${opt(3, "reposition-init",     "Reposition: pick a new spot in the initiative order (combat only).",
              "You step out of the moment and re-enter where you choose. The Tree shrugs.")}
        ${opt(3, "narrative-refund",    "Refund one manifestation or power use when it resolves.",
              "The working didn't cost you. The Tree paid instead.")}
        ${opt(5, "narrative-fiction",   "Reshape one beat of fiction in the scene (GM-gated, 1/scene).",
              "A small miracle. A door that wasn't there. A body that didn't quite fall.")}
      </div>`;

      const dialog = new Dialog({
        title: `Spend Surge — ${actor.name}`,
        content: html,
        buttons: { close: { label: "Close" } },
        default: "close"
      });
      dialog.render(true);

      Hooks.once("renderDialog", (d, $html) => {
        if (d !== dialog) return;
        $html.find(".ft-surge-opt").on("click", async (e) => {
          const cost   = parseInt(e.currentTarget.dataset.cost);
          const effect = String(e.currentTarget.dataset.effect || "narrative");
          const cur    = actor.system?.system?.resources?.surge?.value
                      ?? actor.system?.resources?.surge?.value ?? 0;
          if (cur < cost) return;

          if (effect === "reposition-init") {
            dialog.close();
            await _ftRepositionInitiative(actor, cost);
            return;
          }

          await actor.update({ "system.resources.surge.value": cur - cost });
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✦ ${actor.name} spends ${cost} Surge</span></div>
              <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.8">
                Surge ${cur} → ${cur - cost}. GM adjudicates the effect.
              </p>
            </div>`
          });
          dialog.close();
        });
      });
    }

    static async _onFtSomaBreak(event, target) {
      return game.fourththing?.actions?.somaBreak?.(this.actor);
    }

    static async _onFtSceneBreak(event, target) {
      return game.fourththing?.actions?.sceneBreak?.(this.actor);
    }

    static async _onFtLesserManifest(event, target) {
      // Legacy data-action name kept so older HBS layouts still bind. Routes to fiat.
      return game.fourththing?.actions?.fiat?.(this.actor);
    }
    static async _onFtFiat(event, target) {
      return game.fourththing?.actions?.fiat?.(this.actor);
    }

    static async _onFtWeaponCreate(event, target) {
      return openManifestationWizardV2(this.actor, { kind: "weapon", starter: "form" });
    }

    // ── Sprint C: BBTTCC bridge action handlers ──────────────────────────────

    static async _onFtBBTTCCBridge(event, target) {
      openBridge(this.actor);
    }

    static async _onFtBBTTCCRadiation(event, target) {
      openRadiation(this.actor);
    }

    static async _onFtBBTTCCTikkun(event, target) {
      openTikkunPopup(this.actor);
    }

    static async _onFtBBTTCCFaction(event, target) {
      openFactionSheet(this.actor);
    }

    static async _onFtEchoAssetsManage(event, target) {
      return openEchoAssetsManager(this.actor, this);
    }

    static async _onFtBBTTCCIdentity(event, target) {
      const identityType = target.dataset.identityType;
      if (!identityType) return;
      openIdentityChooser(this.actor, this, identityType);
    }

    // Stub for BBTTCC advancement system compatibility
    async _onDropSingleItem(itemData) {
      return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    // ── Drag-drop handlers ─────────────────────────────────────────────────────
    // Binding happens in _bindDragDrop (called from _onRender above).
    _onDragStart(event) {
      const el = event.currentTarget;
      const itemId = el?.dataset?.itemId;
      const item   = itemId ? this.actor.items.get(itemId) : null;
      if (!item) return;
      event.dataTransfer.setData("text/plain", JSON.stringify({
        type: "Item",
        uuid: item.uuid
      }));
    }
    _onDragOver(event) {
      event.preventDefault();
    }
    async _onDrop(event) {
      event.preventDefault();
      try {
        const raw = event.dataTransfer?.getData("text/plain");
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        if (data?.type !== "Item") return;
        const item = await Item.implementation.fromDropData(data);
        if (!item) return;
        if (item.parent?.id === this.actor.id) return; // no self-drop
        const itemData = item.toObject();
        return this._onDropSingleItem(itemData);
      } catch (err) {
        console.error("Roll for Initiation | _onDrop failed:", err);
        ui.notifications?.error("Could not drop that item — see console.");
      }
    }

    // Sprint D: ASI — detect and apply ability score improvements from features
    static async _onFtASIApply(event, target) {
      const actor  = this.actor;
      const itemId = target.closest("[data-item-id]")?.dataset.itemId;
      const item   = itemId ? actor.items.get(itemId) : null;
      const desc   = item?.system?.description?.value ?? "";
      const asis   = detectASIs(desc);

      if (!asis.length) {
        return ui.notifications.info("No attribute improvements detected in this feature.");
      }

      const rawSys = actor.system?.system ?? actor.system;
      const attrs  = rawSys?.attributes ?? {};

      // Build a dialog showing detected ASIs
      const rows = asis.map(a =>
        `<div class="ft-asi-row">
           <span class="ft-asi-label">+${a.amount} ${a.ftAttr}</span>
           <span class="ft-asi-current">(currently ${attrs[a.ftAttr]?.value ?? 2}
             → <b>${Math.min(10, (attrs[a.ftAttr]?.value ?? 2) + a.amount)}</b>)</span>
         </div>`
      ).join("");

      new Dialog({
        title:   "Apply Attribute Advancement",
        content: `<div class="ft-cast-dialog">
          <p style="margin:0 0 0.5rem;opacity:0.7;font-size:0.82rem">
            This feature grants the following attribute improvements:
          </p>
          ${rows}
        </div>`,
        buttons: {
          apply: {
            label: "Apply",
            callback: async () => {
              await applyASIs(actor, asis);
              ui.notifications.info(`${actor.name}: attribute advancement applied.`);
              this.render();
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "apply"
      }).render(true);
    }

    // Sprint D: use feature — dispatches to class automation handler
    static async _onFtUseFeature(event, target) {
      const itemId = target.closest("[data-item-id]")?.dataset.itemId;
      const item   = itemId ? this.actor.items.get(itemId) : null;
      console.log("[ftUseFeature] itemId=", itemId, "item=", item?.name, "identifier=", item?.system?.identifier);
      if (!item) { console.warn("[ftUseFeature] no item found for", itemId); return; }
      try {
        const handled = await dispatchFeatureAction(this.actor, item);
        console.log("[ftUseFeature] dispatchFeatureAction returned:", handled);
        // No router entry → fall back to opening the item sheet so the player
        // can read the description / take any manual action. Avoids the
        // stale "no automation defined" toast for items that just lack a
        // registered handler but still carry useful content.
        if (handled === null || handled === undefined) {
          item.sheet?.render(true, { focus: true });
        }
      } catch (err) {
        console.error("[ftUseFeature] dispatch threw:", err);
        ui.notifications.error(`${item.name}: dispatch failed — see console.`);
      }
    }

    // Sprint D: direct class action from resource panel buttons
    // Uses closures over the top-level ft-class-automation.js imports
    // Sprint F: extended for Bulwark, Shadow Courier, Cosmic Linguist, Pactkeeper
    static async _onFtClassAction(event, target) {
      const handler = target.dataset.handler;
      if (!handler) return;
      const mod = game.fourththing._classAutomation;
      if (!mod) return ui.notifications.warn("Path automation module not loaded.");
      const DISPATCH = {
        // ─── DEPRECATED 2026-05-14 (NPC Parity Sprint C cleanup) ─────────
        // These dispatcher entries are kept for macro back-compat but are
        // no longer referenced by any character / NPC sheet template:
        //  · titanbound_spend / _pool — Titanbound class retired, replaced
        //    by Bulwark; no items of titanbound class type exist.
        //  · breaker_ruin — Breaker class retired, replaced by Bulwark.
        // Verify zero call-site usage over the next campaign window before
        // hard-removing in a future cleanup sprint.
        titanbound_spend:      (a) => mod.openSpendFrameDie(a),
        titanbound_pool:       (a) => mod.openFrameDiePool(a),
        breaker_ruin:          (a) => mod.openBreakerRuin(a),
        // ─── ACTIVE ─────────────────────────────────────────────────────
        shadowjack_spend:      (a) => mod.openSpendAccessDie(a),
        shadowjack_pool:       (a) => mod.openAccessPool(a),
        // Existing
        aurablade_action:      (a) => mod.openAurabladeAction(a),
        aurablade_change_aura: (a) => mod.openChangeAura(a),
        aurablade_stabilize:   (a) => mod.openStabilizeBurn(a),
        aurablade_burn:        (a) => mod.openBurnState(a),
        dreamwalker_resonance:        (a) => mod.openDreamwalkerResonance(a),
        dreamwalker_deploy_cache:     (a) => mod.openDreamwalkerDeployCache(a),
        // DEPRECATED 2026-05-14 — singular kept for macro BC; live key is
        // dream_echo_reservoir_spend (plural — wired to Spend button).
        dream_echo_reservoir:         (a) => mod.openDreamwalkerEchoReservoir(a),
        dream_echo_reservoir_spend:   (a) => mod.openDreamwalkerSpendEchoDie(a),
        soul_smith_forge:      (a) => mod.openSoulSmithForge(a),
        // Sprint F — Bulwark
        bulwark_spend_frame:   (a) => mod.openBulwarkSpendFrame(a),
        bulwark_frame_pool:    (a) => mod.openBulwarkFramePool(a),
        bulwark_ruin:          (a) => mod.openBulwarkRuin(a),
        bulwark_stance:        (a) => mod.openBulwarkStance(a),
        // Sprint F — Shadow Courier (Pace pool replaces legacy Access Dice;
        // Pace edits inline on the resource panel, no spend/pool dialogs needed.)
        shadow_courier_package:      (a) => mod.openShadowCourierPackage(a),
        shadow_courier_crossing:     (a) => mod.openShadowCourierCrossing(a),
        // Sprint F — Cosmic Linguist
        cosmic_linguist_authority:   (a) => mod.openCosmicLinguistAuthority(a),
        cosmic_linguist_annotation:  (a) => mod.openCosmicLinguistAnnotation(a),
        // Sprint F — Pactkeeper
        pactkeeper_leverage:                 (a) => mod.openPactkeeperLeverage(a),
        pactkeeper_binding_clause:           (a) => mod.openPactkeeperBindingClause(a),
        pactkeeper_precedent:                (a) => mod.openPactkeeperPrecedent(a),
        // DEPRECATED 2026-05-14 — singular superseded by
        // pactkeeper_spend_civic_charge (the live key on both sheets).
        pactkeeper_civic_charge:             (a) => mod.openPactkeeperCivicCharge(a),
        pactkeeper_spend_civic_charge:       (a) => mod.openPactkeeperSpendCivicCharge(a),
        // DEPRECATED 2026-05-14 — no template surface; the chip is
        // display-only and read-only edits flow via inline number input.
        pactkeeper_administrative_pressure:  (a) => mod.openPactkeeperPressure(a),
        pactkeeper_bind_subject:             (a) => mod.openPactkeeperBindSubject(a),
        // DEPRECATED 2026-05-14 — no template surface; Counter is wired
        // into the cast-time flow (compat-bridge), not surfaced as a button.
        counter_manifestation:               (a) => mod.openCounterManifestation(a),
      };
      const fn = DISPATCH[handler];
      if (fn) await fn(this.actor);
      else ui.notifications.warn(`No handler for: ${handler}`);
    }

    // #6: Portrait click → file picker
    static async _onFtEditPortrait(event, target) {
      const fp = new FilePicker({
        type:     "image",
        current:  this.actor.img,
        callback: async (path) => {
          await this.actor.update({ img: path });
          // Also update prototype token
          await this.actor.update({ "prototypeToken.texture.src": path });
        }
      });
      fp.render(true);
    }

    // Sprint E: Level up
    static async _onFtLevelUp(event, target) {
      await levelUp(this.actor);
      this.render();
    }

    // Sprint E: Spend skill points
    static async _onFtSpendSkillPoints(event, target) {
      await openSpendSkillPoints(this.actor);
    }

    // Sprint E: Auto-grant skill ranks from class features
    static async _onFtGrantSkillRanks(event, target) {
      const granted = await applySkillGrantsFromFeatures(this.actor);
      if (granted.length) {
        ui.notifications.info(`${this.actor.name}: aptitude rank 1 granted in ${granted.join(", ")}.`);
        this.render();
      } else {
        ui.notifications.info("No new aptitude ranks to grant from current principles.");
      }
    }

    // Sprint F: Apply Path Features — import class core + chosen subclass features
    static async _onFtApplyPathFeatures(event, target) {
      const result = await applyPathFeatures(this.actor);
      if (result.error) {
        ui.notifications.warn(`${this.actor.name}: ${result.error}`);
        return;
      }
      if (result.imported.length) {
        ui.notifications.info(`${this.actor.name}: imported ${result.imported.length} path principle${result.imported.length > 1 ? "s" : ""} — ${result.imported.join(", ")}`);
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div class="fourththing-roll">
            <div class="ft-roll-header">
              <span class="ft-roll-name">✦ Path Features Applied: ${this.actor.name}</span>
            </div>
            <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.8">
              Imported: <b>${result.imported.join(", ")}</b>.
              ${result.skipped.length ? `<br/><span style="opacity:0.6">Already owned: ${result.skipped.join(", ")}.</span>` : ""}
            </p>
          </div>`
        });
        this.render();
      } else if (result.skipped.length) {
        ui.notifications.info(`${this.actor.name}: all ${result.skipped.length} available path principles already on sheet.`);
      } else {
        ui.notifications.info(`${this.actor.name}: no path principles to apply.`);
      }
    }

    // Sprint E: Toggle edit mode — adds/removes ft-edit-mode class on the .ft-sheet root
    // of the template (CSS selectors are .ft-sheet.ft-edit-mode, so the class must live
    // on that element, not on the outer AppV2 wrapper). State is persisted on the sheet
    // instance so it survives submitOnChange re-renders.
    static _onFtToggleEditMode(event, target) {
      const sheet = this.element?.querySelector(".ft-sheet");
      if (!sheet) return;
      const active = sheet.classList.toggle("ft-edit-mode");
      this._bbttccEditMode = active;
      target.textContent = active ? "✓ Editing" : "✎ Edit";
      target.classList.toggle("ft-edit-active", active);
      // AppV2 sized the outer frame for view-mode content; revealing edit-only
      // blocks (resource inputs, skill-rank inputs, identity grid) grows the
      // content substantially. Force a re-measure on the next frame so the
      // frame recomputes instead of leaving stale flex measurements that
      // previously required a manual resize to clear.
      requestAnimationFrame(() => {
        try { this.setPosition({ height: "auto" }); } catch (_e) { /* noop */ }
      });
    }

    // Cycle / toggle handlers delegate to the shared helpers so the NPC
    // sheet (which still renders the editor inline) and the character-sheet
    // popout dialog share one source of truth for mutation logic.
    static async _onFtDefenseCycle(event, target) {
      return ftApplyDefenseCycle(this.actor, target.dataset.type);
    }

    static async _onFtVulnToggle(event, target) {
      return ftApplyVulnToggle(this.actor, target.dataset.type);
    }

    static async _onFtCondImmuneToggle(event, target) {
      return ftApplyCondImmuneToggle(this.actor, target.dataset.condition);
    }

    // Open the defenses/vulnerabilities/condition-immunities editor as a
    // popout dialog. The body rebuilds after each chip click so the icons
    // reflect the new state. Replaces the in-header inline editor that
    // previously ate ~250px of vertical space in edit mode.
    static async _onFtDefensesOpen(event, target) {
      const actor = this.actor;
      const bind = (bodyEl) => {
        bodyEl.querySelectorAll("[data-ft-def-action]").forEach(btn => {
          btn.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const act = btn.dataset.ftDefAction;
            if (act === "cycle")     await ftApplyDefenseCycle(actor, btn.dataset.type);
            else if (act === "vuln") await ftApplyVulnToggle(actor, btn.dataset.type);
            else if (act === "cond") await ftApplyCondImmuneToggle(actor, btn.dataset.condition);
            // Rebuild the body in place so chip icons refresh.
            bodyEl.innerHTML = ftBuildDefenseEditorDialogHTML(actor);
            const fresh = bodyEl.querySelector(".ft-def-dialog-body");
            if (fresh) bind(fresh);
          });
        });
      };

      const dlg = new Dialog({
        title:   `Defenses — ${actor.name}`,
        content: `<div class="ft-def-dialog-wrap">${ftBuildDefenseEditorDialogHTML(actor)}</div>`,
        buttons: { close: { icon: "<i class='fas fa-check'></i>", label: "Done" } },
        default: "close",
        render: (html) => {
          const root = (html instanceof HTMLElement) ? html : (html?.[0] ?? null);
          const body = root?.querySelector(".ft-def-dialog-body");
          if (body) bind(body);
        }
      }, { classes: ["fourththing", "ft-def-dialog"], width: 560 });
      dlg.render(true);
    }

    // Sprint E: Add effect and open its sheet for editing
    static async _onFtAddEffect(event, target) {
      const created = await this.actor.createEmbeddedDocuments("ActiveEffect", [{
        name:    "New Effect",
        icon:    "icons/svg/aura.svg",
        changes: [],
        disabled: false,
        flags:   { fourththing: { source: "manual" } }
      }]);
      if (created[0]) created[0].sheet?.render(true);
    }

    // ── Bulwark Inevitability merged-pool +/- (Cataclyst L17) ──────────────
    // After the L17 capstone fires, Frame and Ruin show as a single
    // Inevitability chip. Underlying storage is still frameDice + ruinCharges
    // (the pools didn't actually merge in template.json), so spend drains
    // ruin first / fill tops up frame first to keep both legitimate.
    static async _onFtBulwarkInevAdjust(event, target) {
      const actor  = this.actor;
      const delta  = parseInt(target?.dataset?.delta ?? "0", 10);
      if (!delta) return;
      // 2026-05-13 — optional `data-pool="frame"|"ruin"` to spend/recover
      // from a single pool when the un-merged Bulwark UX is in play. Omitting
      // the attribute keeps the legacy combined behavior (Cataclyst merge).
      const pool   = String(target?.dataset?.pool ?? "").toLowerCase();
      const rawSys = actor.system?.system ?? actor.system;
      const fC = rawSys?.resources?.frameDice?.current   ?? 0;
      const fM = rawSys?.resources?.frameDice?.max       ?? 0;
      const rC = rawSys?.resources?.ruinCharges?.current ?? 0;
      const rM = rawSys?.resources?.ruinCharges?.max     ?? 0;
      const updates = {};

      // Pool-specific path: Frame only.
      if (pool === "frame") {
        const need = Math.abs(delta);
        if (delta < 0) {
          if (fC < need) { ui.notifications.warn(`${actor.name}: Frame Dice pool too low.`); return; }
          updates["system.resources.frameDice.current"] = fC - need;
        } else {
          if (fC >= fM) { ui.notifications.warn(`${actor.name}: Frame Dice pool already full.`); return; }
          updates["system.resources.frameDice.current"] = Math.min(fM, fC + need);
        }
        await actor.update(updates);
        return;
      }

      // Pool-specific path: Ruin only.
      if (pool === "ruin") {
        const need = Math.abs(delta);
        if (delta < 0) {
          if (rC < need) { ui.notifications.warn(`${actor.name}: Ruin Charges pool too low.`); return; }
          updates["system.resources.ruinCharges.current"] = rC - need;
        } else {
          if (rC >= rM) { ui.notifications.warn(`${actor.name}: Ruin Charges pool already full.`); return; }
          updates["system.resources.ruinCharges.current"] = Math.min(rM, rC + need);
        }
        await actor.update(updates);
        return;
      }

      // Combined (merged Inevitability) path — unchanged from prior behavior.
      if (delta < 0) {
        // Spend: drain Ruin first, then Frame.
        const need = Math.abs(delta);
        if (fC + rC < need) {
          ui.notifications.warn(`${actor.name}: Inevitability pool too low.`);
          return;
        }
        const fromRuin  = Math.min(rC, need);
        const fromFrame = need - fromRuin;
        if (fromRuin)  updates["system.resources.ruinCharges.current"] = rC - fromRuin;
        if (fromFrame) updates["system.resources.frameDice.current"]   = fC - fromFrame;
      } else {
        // Recover: top up Frame first, then Ruin (narrative parity).
        let need = delta;
        const room = (fM - fC) + (rM - rC);
        if (room <= 0) {
          ui.notifications.warn(`${actor.name}: Inevitability pool already full.`);
          return;
        }
        if (need > room) need = room;
        const toFrame = Math.min(fM - fC, need);
        const toRuin  = need - toFrame;
        if (toFrame) updates["system.resources.frameDice.current"]   = fC + toFrame;
        if (toRuin)  updates["system.resources.ruinCharges.current"] = rC + toRuin;
      }
      await actor.update(updates);
    }

    // ── Shadow Courier — Package editor ─────────────────────────────────────
    static async _onFtCourierPackageEdit(event, target) {
      const actor  = this.actor;
      const rawSys = actor.system?.system ?? actor.system;
      const pkg    = rawSys?.resources?.package ?? { type: "", id: "", carried: false };
      const html = `<div class="ft-courier-pkg-dialog" style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.85rem">
        <p style="opacity:0.7;font-size:0.78rem;margin:0">
          One Package at a time. Type sets fictional handling; ID is a free-form note. Toggle <em>Carried</em> on when the slot is filled.
        </p>
        <label style="display:flex;flex-direction:column;gap:0.2rem">
          <span style="opacity:0.7;font-size:0.74rem">Type</span>
          <input type="text" name="pkg-type" value="${foundry.utils.escapeHTML(pkg.type ?? "")}" placeholder="Message / Blade / Key / Soul / Reply / …" style="padding:0.3rem"/>
        </label>
        <label style="display:flex;flex-direction:column;gap:0.2rem">
          <span style="opacity:0.7;font-size:0.74rem">Identifier (free-form)</span>
          <input type="text" name="pkg-id" value="${foundry.utils.escapeHTML(pkg.id ?? "")}" placeholder="Letter to Sephira / Captain's confession / …" style="padding:0.3rem"/>
        </label>
        <label style="display:flex;align-items:center;gap:0.4rem">
          <input type="checkbox" name="pkg-carried" ${pkg.carried ? "checked" : ""}/>
          <span>Carried</span>
        </label>
      </div>`;
      const dialog = new Dialog({
        title: `Edit Package — ${actor.name}`,
        content: html,
        buttons: {
          save: {
            label: "Save",
            callback: async (dlgHtml) => {
              const root = dlgHtml instanceof HTMLElement ? dlgHtml : dlgHtml[0] ?? dlgHtml;
              const get = (n) => root.querySelector(`[name="${n}"]`);
              const t = (get("pkg-type")?.value ?? "").trim();
              const i = (get("pkg-id")?.value ?? "").trim();
              const c = !!get("pkg-carried")?.checked;
              await actor.update({
                "system.resources.package.type":    t,
                "system.resources.package.id":     i,
                "system.resources.package.carried":c
              });
            }
          },
          clear: {
            label: "Clear Slot",
            callback: async () => {
              await actor.update({
                "system.resources.package.type":    "",
                "system.resources.package.id":     "",
                "system.resources.package.carried":false
              });
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "save"
      });
      dialog.render(true);
    }

    // ── Shadow Courier — Deliver Package ────────────────────────────────────
    // Refills Pace, clears Package, and posts a chat card with route-specific
    // delivery effects. Effects that touch on-actor state (Black Stair Access
    // Die refund) are auto-applied; effects that touch faction/hex state
    // (faction OP delta, Darkness reduction) are listed for the GM.
    static async _onFtCourierPackageDeliver(event, target) {
      const actor  = this.actor;
      const rawSys = actor.system?.system ?? actor.system;
      const pkg    = rawSys?.resources?.package ?? { type: "", id: "", carried: false };
      if (!pkg.carried) {
        ui.notifications.warn(`${actor.name}: Package slot is empty — nothing to deliver.`);
        return;
      }
      const courierSub = Array.from(actor.items).find(i => i.type === "subclass" && /^bbttcc-shadow-courier/.test(i.system?.identifier ?? ""));
      const subId = courierSub?.system?.identifier ?? "";
      const route = subId.includes("wayfarer")    ? "wayfarer"
                  : subId.includes("black-stair") ? "blackstair"
                  : subId.includes("last-mile")   ? "lastmile"
                  : null;
      const hasMastery = Array.from(actor.items)
        .some(i => i.type === "feat" && i.system?.identifier === "shadow_courier_tier3_package_mastery");

      const html = `<div class="ft-courier-deliver-dialog" style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.85rem">
        <p style="opacity:0.85;margin:0">
          Confirm delivery of <b>${foundry.utils.escapeHTML(pkg.type || "Package")}</b>${pkg.id ? `: <em>${foundry.utils.escapeHTML(pkg.id)}</em>` : ""}.
        </p>
        <label style="display:flex;flex-direction:column;gap:0.2rem">
          <span style="opacity:0.7;font-size:0.74rem">Recipient faction (optional, for chat note)</span>
          <input type="text" name="recv-faction" placeholder="e.g. The Cantor's Guild" style="padding:0.3rem"/>
        </label>
        <label style="display:flex;flex-direction:column;gap:0.2rem">
          <span style="opacity:0.7;font-size:0.74rem">Recipient hex (optional, for chat note)</span>
          <input type="text" name="recv-hex" placeholder="e.g. Hex 04-12 / Talanu" style="padding:0.3rem"/>
        </label>
        <p style="opacity:0.65;font-size:0.75rem;margin:0.2rem 0 0;font-style:italic">
          Pace will refill to max. Package slot will clear. Doctrine effects post to chat.
        </p>
      </div>`;

      const dialog = new Dialog({
        title: `Deliver Package — ${actor.name}`,
        content: html,
        buttons: {
          deliver: {
            label: "Deliver",
            callback: async (dlgHtml) => {
              const root = dlgHtml instanceof HTMLElement ? dlgHtml : dlgHtml[0] ?? dlgHtml;
              const recvFaction = (root.querySelector('[name="recv-faction"]')?.value ?? "").trim();
              const recvHex     = (root.querySelector('[name="recv-hex"]')?.value ?? "").trim();
              const paceMax     = rawSys?.resources?.pace?.max ?? 0;

              const updates = {
                "system.resources.pace.current":    paceMax,
                "system.resources.package.type":    "",
                "system.resources.package.id":     "",
                "system.resources.package.carried":false
              };
              await actor.update(updates);

              // Build per-route effect bullets for the chat card.
              const lines = [];
              const recv = recvFaction ? `<b>${foundry.utils.escapeHTML(recvFaction)}</b>` : "the recipient faction";
              const hex  = recvHex     ? `<b>${foundry.utils.escapeHTML(recvHex)}</b>`     : "the recipient hex";
              lines.push(`<li>Pace refilled to <b>${paceMax}/${paceMax}</b>.</li>`);
              if (route === "wayfarer") {
                lines.push(`<li>${recv} gains <b>+1 Intrigue OP</b> (apply on faction sheet).</li>`);
                if (hasMastery) lines.push(`<li><em>Package Mastery:</em> ${recv} gains an additional <b>+1 Intrigue OP</b>.</li>`);
              } else if (route === "blackstair") {
                lines.push(`<li>Base Black Stair delivery resolves narratively (no on-actor mechanical effect).</li>`);
                if (hasMastery) lines.push(`<li><em>Package Mastery:</em> route doctrine bonus — GM/player adjudicate the narrative twist.</li>`);
              } else if (route === "lastmile") {
                lines.push(`<li>${recv} gains <b>+1 Morale OP</b> (apply on faction sheet).</li>`);
                lines.push(`<li>Reduce <b>Darkness</b> in ${hex} by <b>1 point</b>.</li>`);
                if (hasMastery) lines.push(`<li><em>Package Mastery:</em> Reduce Darkness in ${hex} by an additional <b>1 point</b>.</li>`);
              } else {
                lines.push(`<li>No Route doctrine detected on actor — doctrine effects skipped.</li>`);
              }

              ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: `<div class="fourththing-roll">
                  <div class="ft-roll-header"><span class="ft-roll-name">✦ Package delivered — ${foundry.utils.escapeHTML(pkg.type || "Package")}${pkg.id ? `: ${foundry.utils.escapeHTML(pkg.id)}` : ""}</span></div>
                  <ul style="margin:0.3rem 0 0;padding-left:1.1rem;font-size:0.82rem">${lines.join("")}</ul>
                </div>`
              });

              // Phase C trigger: on-delivery. Tags: lowercased package type and route, so
              // predicate.tag can match e.g. "intel" or "route:wayfarer".
              const pkgType = String(pkg.type ?? "").toLowerCase().trim();
              const trigTags = [pkgType, route ? `route:${route}` : null].filter(Boolean);
              await fireTriggers(actor, "on-delivery", { tags: trigTags, scope: "self" });
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "deliver"
      });
      dialog.render(true);
    }

    // #8: Title bar — override to show just the actor name
    get title() { return this.actor?.name ?? "Steward"; }
  }

  // ── FourthThingNPCSheet ────────────────────────────────────────────────────
  class FourthThingNPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

    static DEFAULT_OPTIONS = {
      classes:  ["fourththing", "sheet", "actor", "npc"],
      position: { width: 720, height: 820 },
      window:   { resizable: true },
      // Reuse character sheet's static handlers wherever the logic only reads
      // this.actor + the clicked target (so they work for either sheet class).
      actions:  {
        ftDefenseCycle:        FourthThingCharacterSheet._onFtDefenseCycle,
        ftVulnToggle:          FourthThingCharacterSheet._onFtVulnToggle,
        ftCondImmuneToggle:    FourthThingCharacterSheet._onFtCondImmuneToggle,
        ftToggleEditMode:      FourthThingCharacterSheet._onFtToggleEditMode,
        ftCast:                FourthThingCharacterSheet._onFtCast,
        ftCastPower:           FourthThingCharacterSheet._onFtCast,
        ftStrike:              FourthThingCharacterSheet._onFtStrike,
        ftWeaponRoll:          FourthThingCharacterSheet._onFtStrike,
        ftConditionToggle:     FourthThingCharacterSheet._onFtConditionToggle,
        ftActionToggle:        FourthThingCharacterSheet._onFtActionToggle,
        ftNewTurn:             FourthThingCharacterSheet._onFtNewTurn,
        ftItemEdit:            FourthThingCharacterSheet._onFtItemEdit,
        ftItemDelete:          FourthThingCharacterSheet._onFtItemDelete,
        ftSomaBreak:           FourthThingCharacterSheet._onFtSomaBreak,
        ftSceneBreak:          FourthThingCharacterSheet._onFtSceneBreak,
        // Faculty + Defense rolls — share the steward path so NPCs benefit
        // from the same AE-aware roll plumbing once skill ranks/AEs are added.
        ftRoll:                FourthThingCharacterSheet._onFtRoll,
        ftDefenseRoll:         FourthThingCharacterSheet._onFtDefenseRoll,
        // Manifestation / class / faction parity actions — all reuse the
        // steward statics (they read `this.actor.*` only and are type-agnostic).
        ftMisfire:             FourthThingCharacterSheet._onFtMisfire,
        ftLesserManifest:      FourthThingCharacterSheet._onFtLesserManifest,
        ftFiat:                FourthThingCharacterSheet._onFtFiat,
        ftEditPortrait:        FourthThingCharacterSheet._onFtEditPortrait,
        ftBBTTCCFaction:       FourthThingCharacterSheet._onFtBBTTCCFaction,
        ftBBTTCCBridge:        FourthThingCharacterSheet._onFtBBTTCCBridge,
        ftBBTTCCRadiation:     FourthThingCharacterSheet._onFtBBTTCCRadiation,
        ftBulwarkInevAdjust:   FourthThingCharacterSheet._onFtBulwarkInevAdjust,
        ftCourierPackageEdit:  FourthThingCharacterSheet._onFtCourierPackageEdit,
        ftCourierPackageDeliver: FourthThingCharacterSheet._onFtCourierPackageDeliver,
        // Class action dispatcher — drives Bulwark Spend Frame / Ruin /
        // Stance dialogs (and all other discipline-specific spend dialogs).
        // Type-agnostic: reads target.dataset.handler + calls openX(actor).
        ftClassAction:         FourthThingCharacterSheet._onFtClassAction,
        // Edit-mode toggle — exposes raw rank inputs and other normally-locked
        // fields (CSS .ft-edit-only reveals on .ft-sheet.ft-edit-mode).
        ftToggleEditMode:      FourthThingCharacterSheet._onFtToggleEditMode,
        // Advance Initiation — same dialog stewards use; type-agnostic.
        ftLevelUp:             FourthThingCharacterSheet._onFtLevelUp,
        // Force-apply the path features folder walk after a class drop, or
        // to top up a creature whose advancement state drifted.
        ftGrantSkillRanks:     FourthThingCharacterSheet._onFtGrantSkillRanks,
        ftApplyPathFeatures:   FourthThingCharacterSheet._onFtApplyPathFeatures,
        // Aptitudes — same pip click + rolled-skill path the steward uses.
        ftSetSkillRank:        FourthThingCharacterSheet._onFtSetSkillRank,
        ftSkillRoll:           FourthThingCharacterSheet._onFtSkillRoll,
        // Manifestation engine — Add Feature / preset entries for the GM.
        ftManifestCreate:      FourthThingCharacterSheet._onFtManifestCreate,
        ftPowerCreate:         FourthThingCharacterSheet._onFtPowerCreate,
        ftWeaponCreate:        FourthThingCharacterSheet._onFtWeaponCreate,
        ftManifestEndScene:    FourthThingCharacterSheet._onFtManifestEndScene,
        ftManifestDrop:        FourthThingCharacterSheet._onFtManifestDrop,
        ftGuidanceToggle:      FourthThingCharacterSheet._onFtGuidanceToggle,
        // Inventory + feature actions.
        ftItemEquip:           FourthThingCharacterSheet._onFtItemEquip,
        ftConsume:             FourthThingCharacterSheet._onFtConsume,
        ftUseFeature:          FourthThingCharacterSheet._onFtUseFeature,
        ftGather:              FourthThingCharacterSheet._onFtGather,
        ftForge:               FourthThingCharacterSheet._onFtForge,
        // NPC Parity Sprint A (2026-05-14) — combat-economy actions.
        // All four read this.actor + target dataset only, so the character
        // sheet's statics drop in cleanly. Templates surface them in the
        // new ft-npc-combat-strip below the toolbar.
        ftCombatAction:        FourthThingCharacterSheet._onFtCombatAction,
        ftMoveAdjust:          FourthThingCharacterSheet._onFtMoveAdjust,
        ftActAgain:            FourthThingCharacterSheet._onFtActAgain,
        ftSurgeSpend:          FourthThingCharacterSheet._onFtSurgeSpend,
        // NPC Parity Sprint C (2026-05-14) — MED/LOW cleanup actions.
        // Both already exist as type-agnostic statics; just wire here.
        // ftAddEffect → opens the V14 ActiveEffectConfig in author mode.
        // ftBBTTCCTikkun → opens the Tikkun bridge panel for this actor.
        ftAddEffect:           FourthThingCharacterSheet._onFtAddEffect,
        ftBBTTCCTikkun:        FourthThingCharacterSheet._onFtBBTTCCTikkun,
        // Legacy NPC-only roll handlers retained for back-compat with any
        // saved macros / external callers; new sheet uses ftRoll/ftDefenseRoll.
        ftNpcAttrRoll:         FourthThingNPCSheet._onFtNpcAttrRoll,
        ftNpcDefenseRoll:      FourthThingNPCSheet._onFtNpcDefenseRoll,
        ftNpcSurgeInit:        FourthThingNPCSheet._onFtNpcSurgeInit,
      },
      form:     { submitOnChange: true, closeOnSubmit: false }
    };

    static PARTS = {
      sheet: { template: "systems/fourththing/templates/actors/npc-sheet.hbs" }
    };

    // ── NPC-only roll handlers ───────────────────────────────────────────────
    // 2d10 exploding (Surge) + attribute. Mirrors PC roll plumbing without
    // dragging in skill-rank/AE bonus paths the NPC doesn't have.
    static async _onFtNpcAttrRoll(event, target) {
      const actor = this.actor;
      const attr  = String(target.dataset.attr || "violence");
      const sys   = actor.system?.system ?? actor.system ?? {};
      const v     = Number(sys.attributes?.[attr]?.value ?? 0);
      const roll  = await new Roll(`2d10x10 + ${v}`).roll();
      await roll.toMessage({
        speaker:   ChatMessage.getSpeaker({ actor }),
        flavor:    `${actor.name} — ${ftCap(attr)} check`
      });
    }
    static async _onFtNpcDefenseRoll(event, target) {
      const actor = this.actor;
      const which = String(target.dataset.defense || "guard");
      const sys   = actor.system?.system ?? actor.system ?? {};
      const v     = Number(sys.derived?.[which]?.value ?? 10);
      const roll  = await new Roll(`2d10x10 + ${v}`).roll();
      await roll.toMessage({
        speaker:   ChatMessage.getSpeaker({ actor }),
        flavor:    `${actor.name} — ${ftCap(which)} check (DC ${v})`
      });
    }
    static async _onFtNpcSurgeInit(event, target) {
      const actor = this.actor;
      const sys   = actor.system?.system ?? actor.system ?? {};
      const v     = Number(sys.attributes?.intrigue?.value ?? 0);
      const bonus = Number(sys.derived?.initiative?.bonus ?? 0);
      const total = v + bonus;
      const bonusTag = bonus ? ` ${bonus >= 0 ? "+" : ""}${bonus} init bonus` : "";
      const roll  = await new Roll(`2d10x10 + ${total}`).roll();

      // Surge bank on explosions — matches Combat tracker initiative path.
      const dieResults = roll.dice?.[0]?.results ?? [];
      const explosions = Math.max(0, dieResults.length - 2);
      let surgeNote = "";
      if (explosions > 0) {
        try {
          const cur = Number(sys?.resources?.surge?.value) || 0;
          await actor.update({ "system.resources.surge.value": cur + explosions });
          surgeNote = ` <span style="color:#e8c84a;font-weight:600">+${explosions} Surge banked</span>`;
        } catch (e) { /* surge resource missing — silent */ }
      }

      await roll.toMessage({
        speaker:  ChatMessage.getSpeaker({ actor }),
        flavor:   `${actor.name} — Surge initiative (Intrigue${bonusTag})${surgeNote}`
      });
    }

    _onRender(context, options) {
      // V2 doesn't auto-bind compendium drops; mirror the character sheet path.
      this._bindDragDrop();
    }
    _bindDragDrop() {
      try {
        const el = this.element;
        if (!el || el.dataset.ftNpcDropBound === "1") return;
        el.dataset.ftNpcDropBound = "1";
        el.addEventListener("dragover", (ev) => ev.preventDefault());
        el.addEventListener("drop", this._onDrop.bind(this));
        for (const row of el.querySelectorAll("[data-item-id]")) {
          row.setAttribute("draggable", "true");
          row.addEventListener("dragstart", (ev) => {
            const itemId = row?.dataset?.itemId;
            const item   = itemId ? this.actor.items.get(itemId) : null;
            if (!item) return;
            ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
          });
        }
      } catch (err) {
        console.error("Roll for Initiation | NPC drag-drop wiring failed:", err);
      }
    }
    // Fire `system.advancement` ItemGrant rows for a freshly-dropped item.
    // Walks every ItemGrant whose level ≤ maxLevel, resolves each entry uuid,
    // dedupes against existing actor items by `type::name`, and creates the
    // rest as embedded docs with a lineage flag pointing back to the source.
    // Idempotent — re-running won't double-grant.
    static async _ftFireItemGrants(actor, sourceItem, maxLevel = 1) {
      if (!actor || !sourceItem) return [];
      const advRaw = sourceItem.system?.advancement ?? {};
      const advRows = Array.isArray(advRaw) ? advRaw : Object.values(advRaw);
      const queued = [];
      for (const row of advRows) {
        if (!row || row.type !== "ItemGrant") continue;
        if ((row.level ?? 0) > maxLevel) continue;
        const entries = row.configuration?.items ?? [];
        for (const entry of entries) {
          try {
            const granted = await fromUuid(entry.uuid);
            if (granted) queued.push(granted.toObject());
          } catch (_e) { /* unresolvable uuid — skip */ }
        }
      }
      if (!queued.length) return [];
      const owned = new Set((actor.items ?? []).map(i => `${i.type}::${i.name}`));
      const cleaned = [];
      for (const obj of queued) {
        const key = `${obj.type}::${obj.name}`;
        if (owned.has(key)) continue;
        owned.add(key);
        const c = foundry.utils.deepClone(obj);
        delete c._id;
        foundry.utils.setProperty(c, "flags.fourththing.grantedBy", sourceItem.name);
        cleaned.push(c);
      }
      return cleaned.length ? actor.createEmbeddedDocuments("Item", cleaned) : [];
    }

    async _onDrop(event) {
      event.preventDefault();
      try {
        const raw = event.dataTransfer?.getData("text/plain");
        if (!raw) return;
        let data; try { data = JSON.parse(raw); } catch { return; }
        if (data?.type !== "Item") return;
        const item = await Item.implementation.fromDropData(data);
        if (!item) return;
        if (item.parent?.id === this.actor.id) return;

        const itemData = item.toObject();
        const created  = await this.actor.createEmbeddedDocuments("Item", [itemData]);
        const droppedItem = created?.[0];
        if (!droppedItem) return created;

        const npcLevel = Number(this.actor.system?.system?.details?.level
                              ?? this.actor.system?.details?.level) || 1;

        // Class / subclass — pull in the entire class-features folder via
        // applyPathFeatures (broader than ItemGrants alone; matches the
        // wizard + level-up flow). Folder lookup is bounded by tier/level
        // gates derived from each feature's prerequisites.
        if (itemData.type === "class" || itemData.type === "subclass") {
          try {
            const result = await applyPathFeatures(this.actor);
            const skillResult = await applySkillGrantsFromFeatures(this.actor);
            const pieces = [];
            if (result?.imported?.length) pieces.push(`+${result.imported.length} principles`);
            if (skillResult?.length)      pieces.push(`+aptitude rank in ${skillResult.join(", ")}`);
            if (result?.error && !result?.imported?.length) pieces.push(result.error);
            if (pieces.length) {
              ChatMessage.create({
                user: game.user.id,
                content: `<p style="font-size:0.78rem">✦ <b>${this.actor.name}</b> · ${droppedItem.name} → ${pieces.join(" · ")}</p>`,
                whisper: [game.user.id]
              });
            }
          } catch (e) {
            console.error("Roll for Initiation | NPC class drop auto-grant failed:", e);
          }
        }

        // Ancestry / species / heritage / generic — walk the dropped item's
        // own ItemGrant rows for level ≤ NPC level. Non-advancement items
        // no-op cleanly. Class/subclass already covered above (folder walk
        // is broader); skip to avoid duplicate grants.
        if (!["class", "subclass"].includes(itemData.type)) {
          try {
            const granted = await FourthThingNPCSheet._ftFireItemGrants(this.actor, droppedItem, npcLevel);
            if (granted?.length) {
              ChatMessage.create({
                user: game.user.id,
                content: `<p style="font-size:0.78rem">✦ <b>${this.actor.name}</b> · ${droppedItem.name} → +${granted.length} granted item${granted.length > 1 ? "s" : ""}</p>`,
                whisper: [game.user.id]
              });
            }
          } catch (e) {
            console.error("Roll for Initiation | NPC item drop ItemGrant failed:", e);
          }
        }

        return created;
      } catch (err) {
        console.error("Roll for Initiation | NPC _onDrop failed:", err);
        ui.notifications?.error("Could not drop that item — see console.");
      }
    }

    async _prepareContext(options) {
      const actor  = this.actor;
      const rawSys = actor.system?.system ?? actor.system;
      const sysData = rawSys?.toObject ? rawSys.toObject() : JSON.parse(JSON.stringify(rawSys ?? {}));

      const defensesBase    = sysData.defenses ?? { resistances: [], immunities: [], vulnerabilities: [] };
      const condImmunesBase = Array.isArray(sysData.conditionImmunities) ? sysData.conditionImmunities : [];
      const defensesDerived = ftComputeDefenses(actor, sysData);
      const _hasType = (list, key) => (list ?? []).some(e => e?.type === key);
      const _flavorsFor = (list, key) => (list ?? []).filter(e => e?.type === key && e?.flavor).map(e => e.flavor);
      const _hasBase = (arr, key) => (arr ?? []).some(e =>
        (typeof e === "string" && e.toLowerCase() === key) ||
        (e && typeof e === "object" && String(e.type ?? "").toLowerCase() === key && !e.flavor)
      );
      const defenseTypeList = Object.entries(FT.DAMAGE_TYPES).map(([key, cfg]) => ({
        key, label: cfg.label,
        baseResist:  _hasBase(defensesBase.resistances,     key),
        baseImmune:  _hasBase(defensesBase.immunities,      key),
        baseVuln:    _hasBase(defensesBase.vulnerabilities, key),
        derivedResist: _hasType(defensesDerived.resistances,     key),
        derivedImmune: _hasType(defensesDerived.immunities,      key),
        derivedVuln:   _hasType(defensesDerived.vulnerabilities, key),
        resistFlavors: _flavorsFor(defensesDerived.resistances,     key),
        immuneFlavors: _flavorsFor(defensesDerived.immunities,      key),
        vulnFlavors:   _flavorsFor(defensesDerived.vulnerabilities, key)
      }));
      const condList = Object.entries(FT.CONDITIONS ?? {}).map(([key, cfg]) => ({
        key, label: cfg.label,
        baseImmune:    condImmunesBase.map(x => String(x ?? "").toLowerCase()).includes(key),
        derivedImmune: defensesDerived.conditionImmunities.includes(key)
      }));

      // Item partition: weapons (strikes), powers + manifested gear
      // (manifestations), class identity items (path/doctrine/ancestry),
      // and everything else (features/notes).
      const items = Array.from(actor.items);
      const weapons       = items.filter(i => i.type === "weapon");
      const powers        = items.filter(i => i.type === "power");
      const classIdTypes  = ["class", "subclass", "race", "species"];
      const classItems    = items.filter(i => classIdTypes.includes(i.type));
      const manifestRows  = [
        ...powers.map(i => ftBuildManifestationRow(i, "power")),
        ...weapons.filter(i => RfiItems.is.isManifestation(i)).map(i => ftBuildManifestationRow(i, "weapon"))
      ].sort((a,b) => (a.tier - b.tier) || String(a.name ?? "").localeCompare(String(b.name ?? "")));
      const strikeRows    = weapons.map(i => ({
        id: i.id, uuid: i.uuid, name: i.name, img: i.img,
        formula: i.system?.damage?.formula ?? "",
        type:    i.system?.damage?.type ?? "",
        skill:   i.system?.skill ?? "violence",
        intent:  i.system?.intent ?? "violence",
        category: i.system?.category ?? "",
      }));
      const TYPE_LABELS = { class: "Path", subclass: "Doctrine", race: "Ancestry", species: "Ancestry" };
      const classRows = classItems.map(i => ({
        id: i.id, uuid: i.uuid, name: i.name, img: i.img,
        type: i.type, typeLabel: TYPE_LABELS[i.type] ?? ftCap(i.type),
        identifier: i.system?.identifier ?? ""
      }));
      const featureRows   = items
        .filter(i => !["weapon", "power", ...classIdTypes].includes(i.type))
        .map(i => ({
          id: i.id, uuid: i.uuid, name: i.name, img: i.img, type: i.type,
          // 2026-05-13 — mirror character sheet: features that route to an
          // active ability dispatch (per-use picker, info summary, active
          // routine) get a ▶ Use button. NPC sheet already wires ftUseFeature
          // to the same handler as the character sheet.
          hasActiveAbility: isActionableFeature(i),
          desc: i.system?.description?.value ?? ""
        }));

      // Conditions toggles list
      const conditions = sysData.conditions ?? {};
      const conditionList = Object.entries(FT.CONDITIONS).map(([key, cfg]) => ({
        key, label: cfg.label, color: cfg.color, desc: cfg.desc, active: conditions[key] ?? false
      }));
      const activeConditions = conditionList.filter(c => c.active);

      // Details — prefer details.tier/level, fall back to legacy top-level tier
      // for NPCs created before the schema was extended.
      const details = {
        level:       Math.max(1, Number(sysData.details?.level ?? 1)),
        tier:        Math.max(1, Math.min(4, Number(sysData.details?.tier ?? sysData.tier ?? 1))),
        statPoints:  Number(sysData.details?.statPoints  ?? 0),
        skillPoints: Number(sysData.details?.skillPoints ?? 0)
      };
      const TIER_ROMAN = ["", "I", "II", "III", "IV"];
      const tier = details.tier;
      const tierOptions = [1,2,3,4].map(n => ({ value: n, label: `Tier ${TIER_ROMAN[n]}`, selected: n === tier }));

      // Magic panel — clarity pips + noise percent for the manifestation block.
      const magic = sysData.magic ?? {};
      magic.clarity  ??= { value: 0, max: 5 };
      magic.noise    ??= { value: 0, max: 10 };
      magic.sephirah ??= "malkuth";
      const clarityPips = Array.from({ length: magic.clarity.max ?? 5 }, (_, i) => ({
        filled: i < (magic.clarity.value ?? 0)
      }));
      const magicCtx = { ...magic, clarityPips, noisePercent: (magic.noise.value ?? 0) * 10 };

      // BBTTCC bridge context — feeds identity pills + faction OP snapshot.
      // Wrapped so a missing/inactive bridge doesn't break the NPC sheet.
      let bbttcc = { active: false, identity: {}, faction: null };
      try {
        bbttcc = await getBBTTCCContext(actor);
      } catch (e) {
        console.warn("Roll for Initiation | NPC bbttcc context failed:", e);
      }

      // Class resource pools — Bulwark Frame/Ruin and Shadow Courier Pace —
      // recomputed in prepareDerivedData. Surface only when the NPC actually
      // carries the class item, so we don't show ghost chips on plain monsters.
      const resources = sysData.resources ?? {};
      const _bulwarkCls = classItems.find(i => i.type === "class" && i.system?.identifier === "bulwark");
      const _bulwarkMerged = !!actor.flags?.fourththing?.bulwark?.inevitabilityMerged;
      const _frameC = resources.frameDice?.current   ?? 0;
      const _frameM = resources.frameDice?.max       ?? 0;
      const _ruinC  = resources.ruinCharges?.current ?? 0;
      const _ruinM  = resources.ruinCharges?.max     ?? 0;
      const bulwarkPools = (_bulwarkCls && (_frameM > 0 || _ruinM > 0)) ? {
        frame:  { current: _frameC, max: _frameM },
        ruin:   { current: _ruinC,  max: _ruinM  },
        merged: _bulwarkMerged,
        inev:   _bulwarkMerged ? { current: _frameC + _ruinC, max: _frameM + _ruinM } : null
      } : null;

      const _courierCls = classItems.find(i => i.type === "class" && i.system?.identifier === "shadow_courier");
      const _courierSub = _courierCls
        ? classItems.find(i => i.type === "subclass" && /^bbttcc-shadow-courier/.test(i.system?.identifier ?? ""))
        : null;
      const _courierRouteKey = (() => {
        const id = _courierSub?.system?.identifier ?? "";
        if (id.includes("wayfarer"))   return "wayfarer";
        if (id.includes("black-stair"))return "blackstair";
        if (id.includes("last-mile"))  return "lastmile";
        return null;
      })();
      const shadowCourierState = _courierCls ? {
        pace:    { current: resources.pace?.current ?? 0, max: resources.pace?.max ?? 0 },
        package: {
          type:    resources.package?.type    ?? "",
          id:      resources.package?.id      ?? "",
          carried: resources.package?.carried ?? false
        },
        routeKey: _courierRouteKey
      } : null;

      // NPC Parity Sprint C (2026-05-14) — Active manifestation tracker.
      // Mirrors char-sheet builder; resolves the activeManifestations flag
      // array back to item info for the Active strip's End Scene + Drop
      // controls. Surfaced under `activeManifestations` on the return.
      const _activeMfRaw = actor.getFlag("fourththing", "activeManifestations") ?? [];
      const activeManifestations = Array.isArray(_activeMfRaw) ? _activeMfRaw.map(e => {
        const it = actor.items.get(e.itemId);
        return {
          ...e,
          exists: !!it,
          img:    it?.img ?? "icons/svg/mystery-man.svg",
          name:   it?.name ?? e.itemName ?? "Lost Manifestation",
          stabilityLabel: FT.MANIFESTATION_STABILITIES?.[e.stability]?.label ?? ftCap(e.stability ?? ""),
          upkeepHint: e.stability === "sustained" ? `${e.tier} Clarity / scene`
                    : e.stability === "bound"     ? `${e.tier} Clarity / Soma Break`
                    : e.stability === "enduring"  ? `${e.tier} Clarity / Soma Break + OP tick`
                    : ""
        };
      }) : [];

      // NPC Parity Sprint B (2026-05-14) — Dreamwalker class panel state.
      // Cache banks one manifestation between scenes; Echo Reservoir (L13+
      // feat) bottles 2 d6 per Soma Break for Self-Resonance / Shared Echo
      // / World-Tuning spends. Echo block is null when the feat isn't present.
      const _dwCls = classItems.find(i => i.type === "class" && i.system?.identifier === "dreamwalker");
      const _hasEchoFeat = _dwCls && items.some(i => i.type === "feat" && i.system?.identifier === "dream-echo-reservoir");
      const dreamwalkerState = _dwCls ? {
        cache: {
          banked: resources.dreamCache?.banked === true,
          name:   resources.dreamCache?.name   ?? "",
          tier:   Number(resources.dreamCache?.tier ?? 0)
        },
        echo: _hasEchoFeat ? {
          dice:    resources.echoDice?.dice    ?? 0,
          maxDice: resources.echoDice?.maxDice ?? 2
        } : null
      } : null;

      // NPC Parity Sprint B (2026-05-14) — Aurablade class panel state.
      // No state object — character sheet uses `activePools.aurablade` as the
      // gate and consumes raw `resources.burn` + derived `burnBand/auraData`.
      // Mirror that exactly. `getBurnBand` and `AURA_STATES` are module-level
      // imports already in scope.
      const _abBurn     = Number(resources.burn?.current ?? 0);
      const _abBurnBand = (typeof getBurnBand === "function") ? getBurnBand(_abBurn) : { label: "Controlled", color: "#27ae60", desc: "Stable." };
      const _abAuraState = resources.aura?.state ?? "none";
      const _abAuraData  = (AURA_STATES ?? {})[_abAuraState] ?? { label: "None", color: "#78909c", desc: "" };

      // NPC Parity Sprint B (2026-05-14) — Cosmic Linguist class panel state.
      // Mirrors char-sheet builder; Resonance auto-gains 1/round, Strain
      // ticks on aggressive spends, Authority is the older narrative pool.
      const _clCls = classItems.find(i => i.type === "class" && i.system?.identifier === "cosmic_linguist");
      const cosmicLinguistState = _clCls ? {
        resonance: {
          current: resources.resonanceDice?.current ?? 0,
          max:     resources.resonanceDice?.max     ?? 0
        },
        strain: {
          value: resources.strain?.value ?? 0,
          max:   resources.strain?.max   ?? 10
        },
        authority: {
          current: resources.clAuthority?.current ?? 0,
          max:     resources.clAuthority?.max     ?? 0
        }
      } : null;

      // NPC Parity Sprint B (2026-05-14) — Pactkeeper class panel state.
      // Mirrors the character sheet's pactkeeperState builder so the same
      // dispatcher buttons (pactkeeper_leverage, _binding_clause, _precedent,
      // _spend_civic_charge, _bind_subject) work cleanly on NPC Pactkeepers.
      const _pkCls = classItems.find(i => i.type === "class" && i.system?.identifier === "pactkeeper");
      const _pkPressureValue = Number(resources.administrativePressure?.value ?? 0);
      const _pkPressureBand  = _pkPressureValue >= 6 ? "high"
                            : _pkPressureValue >= 3 ? "moderate"
                            : _pkPressureValue >= 1 ? "low"
                            : "none";
      const _pkPactSubject = actor.flags?.fourththing?.pactSubject ?? null;
      const pactkeeperState = _pkCls ? {
        leverage: {
          current: resources.pactLeverage?.current ?? 0,
          max:     resources.pactLeverage?.max     ?? 0
        },
        civicCharge: {
          dice:    resources.civicCharge?.dice    ?? 0,
          maxDice: resources.civicCharge?.maxDice ?? 1,
          dieSize: resources.civicCharge?.dieSize ?? "d6"
        },
        pressure: {
          value: _pkPressureValue,
          max:   resources.administrativePressure?.max ?? 10,
          band:  _pkPressureBand,
          bandLabel: _pkPressureBand === "none" ? "Clear"
                   : _pkPressureBand === "low"  ? "Low"
                   : _pkPressureBand === "moderate" ? "Moderate"
                   : "High"
        },
        pactSubject: _pkPactSubject?.uuid ? {
          uuid: _pkPactSubject.uuid,
          name: _pkPactSubject.name ?? "(unnamed)"
        } : null
      } : null;

      const actorIsTCC = isTCC(actor);

      const attributeRows = Object.entries(sysData.attributes ?? {}).map(([key, a]) => ({
        key, label: ftCap(key), value: Number(a?.value ?? 0)
      }));

      // Aptitudes — derive from the master schema so NPCs render the full
      // ladder even when `system.skills` is the default empty bag. AE bonuses
      // route through the same getAllSkillAEBonuses path as stewards so an
      // ancestry/heritage that grants +1 Perception lights up here too.
      const skillsStored = sysData.skills ?? {};
      const skillAE      = getAllSkillAEBonuses ? getAllSkillAEBonuses(actor) : {};
      const attrAE       = getAllAttrAEBonuses  ? getAllAttrAEBonuses(actor)  : {};
      const enrichedSkills = FT_SKILL_MASTER.map(spec => {
        const stored = skillsStored[spec.key] ?? {};
        const rank   = Number(stored.value ?? 0);
        // Clamp rank for label/pip lookup — see steward sheet builder above
        // for context (over-cap source ranks from legacy actors).
        const rankClamped = Math.max(0, Math.min(5, rank));
        const rd     = SKILL_RANK_DATA?.[rankClamped] ?? { label: "Untrained", color: "#546e7a", bonus: rankClamped };
        const skillAEB = skillAE[spec.key] ?? 0;
        const attrAEB  = attrAE[spec.attribute] ?? 0;
        const aeB    = skillAEB + attrAEB;
        const attrV  = sysData.attributes?.[spec.attribute]?.value ?? 0;
        const pips   = Array.from({length: 5}, (_, i) => ({
          idx:    i + 1,
          filled: i < rankClamped,
          color:  i < rankClamped ? rd.color : null
        }));
        return {
          key: spec.key, attribute: spec.attribute, label: spec.label,
          slangTooltip: spec.label,
          rank, rankData: rd, pips,
          aeBonus: aeB, attrBonus: attrV,
          totalBonus: attrV + rank + aeB,
          breakdown: `${attrV} ${spec.attribute}${rank ? ` + ${rank} rank` : ""}${aeB ? ` + ${aeB} AE` : ""}`
        };
      });

      // Inventory — armor + gear + mundane (non-manifested) weapons. Crafted
      // gear/armor/weapons surface in the Manifestations section.
      const mundaneWeapons = weapons.filter(i => !RfiItems.is.isManifestation(i));
      const gear = [
        ...items.filter(i => ["armor","gear"].includes(i.type) && !RfiItems.is.isManifestation(i)),
        ...mundaneWeapons
      ].map(i => {
        const rfi = RfiItems.get(i);
        const isEquipped = i.type === "armor"
          ? !!i.system?.equipped
          : !!i.getFlag("fourththing", "equipped");
        const dmg     = i.system?.damage?.formula;
        const dmgType = i.system?.damage?.type;
        const stat = i.type === "weapon"
            ? `${dmg ?? ""}${dmgType ? ` ${dmgType}` : ""}${i.system?.category ? ` · ${i.system.category}` : ""}`.trim()
          : i.type === "armor"
            ? (() => {
                const sgn = (n) => (n > 0 ? `+${n}` : `${n}`);
                return [
                  i.system?.guardBonus    ? `Guard ${sgn(i.system.guardBonus)}`     : "",
                  i.system?.evasionBonus  ? `Evasion ${sgn(i.system.evasionBonus)}` : "",
                  i.system?.resolveBonus  ? `Resolve ${sgn(i.system.resolveBonus)}` : "",
                  i.system?.armorSkill    ? `[${i.system.armorSkill}]`              : ""
                ].filter(Boolean).join(" · ");
              })()
          : (() => {
              if (rfi?.frame === "consumable") {
                const ch = Number(rfi.charges ?? 0);
                return ch > 1 ? `${ch} doses` : "single-use";
              }
              const grantedResist = i.flags?.fourththing?.grants?.resistances;
              if (Array.isArray(grantedResist) && grantedResist.length) {
                const types = grantedResist.map(g => typeof g === "string" ? g : g?.type).filter(Boolean);
                if (types.length) return `resists ${types.join(", ")}`;
              }
              const tags = Array.isArray(i.system?.tags) ? i.system.tags : [];
              const meaningful = tags.find(t => !/^(consumable|gear|misc|tier-)/i.test(String(t)));
              if (meaningful) return String(meaningful);
              return rfi?.frame || i.system?.slot || "";
            })();
        const qty = Number(i.system?.quantity ?? 0);
        return {
          id: i.id, uuid: i.uuid, name: i.name, img: i.img, type: i.type,
          stat, qty: qty > 1 ? qty : null, isEquipped,
          rfi: rfi ?? null,
          tier: rfi?.tier ?? null, frame: rfi?.frame ?? null, origin: rfi?.origin ?? null,
          signature: rfi?.signature ?? "",
          isConsumable: !!rfi?.consume,
          charges: Number(rfi?.charges ?? 0) || null
        };
      });

      // Manifestation guidance hint for the wizard sephirah panel — needs the
      // actor's current sephirah; helper falls back gracefully if missing.
      const manifestationGuide = ftManifestationGuide ? ftManifestationGuide(magic.sephirah) : null;

      return {
        actor, system: sysData,
        defenseTypes: defenseTypeList,
        condImmunityList: condList,
        DAMAGE_TYPES: FT.DAMAGE_TYPES,
        CONDITIONS:   FT.CONDITIONS,
        SEPHIROTH:    FT.SEPHIROTH,
        attributeRows,
        manifestRows,
        hasManifestations: manifestRows.length > 0,
        activeManifestations,
        manifestationGuide,
        strikeRows,
        hasStrikes: strikeRows.length > 0,
        classRows,
        hasClassIdentity: classRows.length > 0,
        featureRows,
        hasFeatures: featureRows.length > 0,
        enrichedSkills,
        gear,
        hasInventory: gear.length > 0,
        conditionList,
        activeConditions,
        hasActiveConditions: activeConditions.length > 0,
        tier,
        tierLabel: `Tier ${TIER_ROMAN[tier]}`,
        tierOptions,
        details,
        magic: magicCtx,
        bbttcc,
        bulwarkPools,
        shadowCourierState,
        cosmicLinguistState,
        dreamwalkerState,
        pactkeeperState,
        burnBand:  _abBurnBand,
        auraState: _abAuraState,
        auraData:  _abAuraData,
        // 2026-05-13 — surface active pools so the NPC sheet can render the
        // same Bulwark Spend/Ruin/Stance buttons the character sheet does.
        activePools: (typeof detectActivePools === "function") ? detectActivePools(actor) : {},
        actorIsTCC,
        isTCC: actorIsTCC,
        actionEconomy: (() => {
          const a         = sysData.actions ?? {};
          const mv        = sysData?.derived?.movement ?? {};
          const walkFt    = Number(mv.walk) || 30;
          const movUsed   = Number(a.movementUsedFt)   || 0;
          const movBudget = Number(a.movementBudgetFt) || walkFt;
          const movRem    = Math.max(0, movBudget - movUsed);
          const movPct    = (movBudget > 0)
            ? Math.min(100, Math.round((movUsed / movBudget) * 100))
            : 0;
          return {
            actionUsed:        a.actionUsed   ?? false,
            bonusUsed:         a.bonusUsed    ?? false,
            reactionUsed:      a.reactionUsed ?? false,
            movementUsedFt:    movUsed,
            movementBudgetFt:  movBudget,
            movementRemainingFt: movRem,
            movementPct:       movPct,
            movementOver:      movUsed > movBudget,
            speeds: {
              walk:  Number(mv.walk)  || walkFt,
              climb: Number(mv.climb) || 0,
              swim:  Number(mv.swim)  || 0,
              fly:   Number(mv.fly)   || 0
            }
          };
        })(),
        // NPC Parity Sprint A (2026-05-14) — top-level surfaces that the
        // ftSurgeSpend / ftActAgain / ftCombatAction panels read. Mirrors
        // character-sheet contracts so the same templates work cleanly.
        resources: sysData?.resources ?? {},
        ftFlags:   actor?.flags?.fourththing ?? {},
        isEditable: this.isEditable,
        isGM: !!game.user?.isGM,
      };
    }
  }

  // Shared item-sheet action: click the portrait → open the FilePicker so the
  // user can swap the manifestation's icon. `this` is the sheet instance.
  async function _ftOnEditItemImg(event, target) {
    const fp = new FilePicker({
      type:     "image",
      current:  this.item.img,
      callback: async (path) => {
        await this.item.update({ img: path });
      }
    });
    fp.render(true);
  }

  // Manifestation sheet has Edit and Display modes, persisted per-user on the
  // item. Default mode resolves from role (GM=edit, player=display) when no
  // user override is set. Toggle button lives in the sheet header.
  function _ftReadManifestMode(item) {
    const uid = game.user?.id;
    const stored = item?.getFlag?.("fourththing", "manifestSheetMode") ?? null;
    if (uid && stored && typeof stored === "object" && stored[uid]) return stored[uid] === "edit" ? "edit" : "display";
    return game.user?.isGM ? "edit" : "display";
  }
  async function _ftOnToggleManifestMode(event, target) {
    const item = this.item;
    const uid  = game.user?.id;
    if (!item || !uid) return;
    const cur  = _ftReadManifestMode(item);
    const next = cur === "edit" ? "display" : "edit";
    const stored = foundry.utils.deepClone(item.getFlag("fourththing", "manifestSheetMode") ?? {});
    stored[uid] = next;
    await item.setFlag("fourththing", "manifestSheetMode", stored);
    this.render();
  }

  // ── FourthThingRigSheet (Phase 2 — RIG_BOSS_SCHEMA.md) ─────────────────────
  // Crew-piloted rigs (mobile/stationary/hybrid). Tabbed: Identity / Crew /
  // Combat / Gear / Output / Travel / GM Edit. Drop items to equip into slots
  // (subtype-routed); drop characters/npcs to assign crew; drop a faction
  // actor to set owner.
  class FourthThingRigSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

    static DEFAULT_OPTIONS = {
      classes:  ["fourththing", "sheet", "actor", "rig"],
      position: { width: 1040, height: 880 },
      window:   { resizable: true },
      actions:  {
        ftEditPortrait:        FourthThingCharacterSheet._onFtEditPortrait,
        ftToggleEditMode:      FourthThingCharacterSheet._onFtToggleEditMode,
        ftDefenseCycle:        FourthThingCharacterSheet._onFtDefenseCycle,
        ftDefenseRoll:         FourthThingCharacterSheet._onFtDefenseRoll,
        ftVulnToggle:          FourthThingCharacterSheet._onFtVulnToggle,
        ftCondImmuneToggle:    FourthThingCharacterSheet._onFtCondImmuneToggle,
        ftItemEdit:            FourthThingCharacterSheet._onFtItemEdit,
        ftItemDelete:          FourthThingCharacterSheet._onFtItemDelete,
        // Rig-specific actions
        ftRigOwnerPick:        FourthThingRigSheet._onFtRigOwnerPick,
        ftRigOwnerClear:       FourthThingRigSheet._onFtRigOwnerClear,
        ftRigDeploy:           FourthThingRigSheet._onFtRigDeploy,
        ftRigRecall:           FourthThingRigSheet._onFtRigRecall,
        ftRigCrewDisembark:    FourthThingRigSheet._onFtRigCrewDisembark,
        ftRigCrewOpenSheet:    FourthThingRigSheet._onFtRigCrewOpenSheet,
        ftRigIntegrityAdjust:  FourthThingRigSheet._onFtRigIntegrityAdjust,
        ftRigDuplicate:        FourthThingRigSheet._onFtRigDuplicate
      },
      dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: null }],
      form:     { submitOnChange: true, closeOnSubmit: false }
    };

    static PARTS = {
      sheet: { template: "systems/fourththing/templates/actors/rig-sheet.hbs" }
    };

    tabGroups = { primary: "identity" };

    async _prepareContext(options) {
      const actor   = this.actor;
      const rawSys  = actor.system?.system ?? actor.system;
      const sysData = rawSys?.toObject ? rawSys.toObject() : JSON.parse(JSON.stringify(rawSys ?? {}));

      const integrity = sysData.integrity ?? { value: 0, max: 0, tier: 1, bracket: "medium" };
      const integrityPct = integrity.max > 0
        ? Math.max(0, Math.min(100, Math.round((Number(integrity.value)||0) / Number(integrity.max) * 100)))
        : 0;

      const ownerId = sysData.identity?.factionOwnerId ?? "";
      const owner   = ownerId ? game.actors?.get(ownerId) : null;

      // Crew slot resolution — turn slots[].actorId into displayable refs
      const crewSlotsRaw = Array.isArray(sysData.crew?.slots) ? sysData.crew.slots : [];
      const crewSlots = crewSlotsRaw.map((s, i) => {
        const a = s.actorId ? game.actors?.get(s.actorId) : null;
        return { ...s, idx: i, actor: a ? { id: a.id, name: a.name, img: a.img } : null };
      });

      // Group equipped items by gear subtype flag. Polish pass (2026-05-12)
      // enriches each item with display fields so the template doesn't have
      // to spelunk getFlag() per row.
      const items = Array.from(actor.items ?? []);
      const bySubtype = { frame: [], weapon: [], system: [], output: [], unsorted: [] };
      for (const it of items) {
        const sub = it.getFlag?.("fourththing", "rigGear")?.subtype ?? "";
        if (sub === "rig-frame")          bySubtype.frame.push(it);
        else if (sub === "rig-weapon")    bySubtype.weapon.push(it);
        else if (sub === "rig-system")    bySubtype.system.push(it);
        else if (sub === "output-module") bySubtype.output.push(it);
        else bySubtype.unsorted.push(it);
      }

      // Frame row enrichment — surfaces the load-bearing rigFrame stats inline
      // on the hero tile so the GM doesn't have to open the item sheet to see
      // bracket / base integrity / slot caps / allowed mobility.
      const frameItem = bySubtype.frame[0] ?? null;
      const frameFlags = frameItem?.flags?.fourththing?.rigFrame ?? null;
      // 2026-05-17 — Pilot Mount substrate (B13.D Phase A). Personal-bracket
      // frames typically have slots.weapon = 0 but can still mount ONE weapon
      // that the pilot fires (bikes, hexmobiles, etc.). The `pilotMount` flag
      // adds +1 to the weapon slot cap; downstream fire path (line ~853) already
      // routes pilot-fires when gunner.max === 0.
      const _baseWeaponSlots = Number(frameFlags?.slots?.weapon ?? 0) || 0;
      const _hasPilotMount   = !!frameFlags?.pilotMount;
      const frameRow = frameItem ? {
        id: frameItem.id, name: frameItem.name, img: frameItem.img,
        bracket: frameFlags?.bracket ?? integrity.bracket ?? "—",
        baseIntegrity: Number(frameFlags?.baseIntegrity) || 0,
        tierStep: Number(frameFlags?.tierStep) || 0,
        pilotMount: _hasPilotMount,
        slotCaps: {
          weapon: _baseWeaponSlots + (_hasPilotMount ? 1 : 0),
          weaponBase: _baseWeaponSlots,
          pilotMount: _hasPilotMount ? 1 : 0,
          system: Number(frameFlags?.slots?.system ?? 0) || 0,
          output: Number(frameFlags?.slots?.output ?? 0) || 0
        },
        mobilityAllowed: Array.isArray(frameFlags?.mobilityAllowed) ? frameFlags.mobilityAllowed : [],
        has: !!frameFlags
      } : null;

      const _passiveOf = (it) => !!it?.flags?.fourththing?.rigGear?.passive;
      const _tierOf = (it) => {
        const raw = it?.flags?.fourththing?.rfi?.item?.tier ?? null;
        if (typeof raw === "string") {
          const m = raw.match(/^I{1,3}V?$/i);
          if (m) return { I: 1, II: 2, III: 3, IV: 4 }[raw.toUpperCase()] ?? null;
        }
        const n = Number(raw);
        return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
      };
      const _yieldEntries = (it) => {
        const y = it?.flags?.fourththing?.rigGear?.yield ?? null;
        if (!y || typeof y !== "object") return [];
        return Object.entries(y)
          .map(([k, v]) => ({ key: k, value: Number(v) || 0 }))
          .filter(e => e.value > 0)
          .sort((a, b) => b.value - a.value);
      };

      const enrichWeapon = (w) => {
        const s = w.system ?? {};
        const dmg = s.damage?.formula ?? "";
        const range = s.range ? (s.range.long > s.range.short ? `${s.range.short}/${s.range.long}` : `${s.range.short ?? 0}`) : "";
        return {
          id: w.id, name: w.name, img: w.img,
          tier: _tierOf(w),
          damage: dmg,
          damageType: s.damage?.type ?? "",
          range
        };
      };
      const enrichSystem = (s) => ({
        id: s.id, name: s.name, img: s.img,
        tier: _tierOf(s),
        passive: _passiveOf(s)
      });
      const enrichOutput = (o) => ({
        id: o.id, name: o.name, img: o.img,
        tier: _tierOf(o),
        yieldEntries: _yieldEntries(o),
        mobileLegal: !!o?.flags?.fourththing?.rigGear?.mobileLegal
      });
      const enrichUnsorted = (u) => ({
        id: u.id, name: u.name, img: u.img, type: u.type
      });

      const weaponRows = bySubtype.weapon.map(enrichWeapon);
      const systemRows = bySubtype.system.map(enrichSystem);
      const outputRows = bySubtype.output.map(enrichOutput);
      const unsortedRows = bySubtype.unsorted.map(enrichUnsorted);

      const gear = {
        frame:    frameItem,
        frameRow,
        weapons:  weaponRows,
        systems:  systemRows,
        outputs:  outputRows,
        unsorted: unsortedRows,
        slotUsage: {
          weapon: { used: weaponRows.length, max: frameRow?.slotCaps.weapon ?? 0 },
          system: { used: systemRows.length, max: frameRow?.slotCaps.system ?? 0 },
          output: { used: outputRows.length, max: frameRow?.slotCaps.output ?? 0 }
        }
      };
      // Per-row overage flag for visual warning when slots exceed frame caps.
      gear.slotOverage = {
        weapon: gear.slotUsage.weapon.used > gear.slotUsage.weapon.max,
        system: gear.slotUsage.system.used > gear.slotUsage.system.max,
        output: gear.slotUsage.output.used > gear.slotUsage.output.max
      };

      // Faction picker options — actors with bbttcc-factions namespace
      const factions = (game.actors ?? []).filter(a => {
        const f = a.flags?.["bbttcc-factions"];
        return f && (f.isFaction === true || f.identity || f.op);
      }).map(a => ({ id: a.id, name: a.name }));

      const mobility = sysData.identity?.mobility ?? "mobile";
      const state    = sysData.identity?.state ?? "parked";
      const isStationary = mobility === "stationary";
      const hasOutputs   = (gear.outputs?.length ?? 0) > 0;

      // Polish pass (2026-05-12) — crew tile data. Per-role filled counts let
      // the Crew tile show "filled/max" and dim individual role tiles when
      // empty. cap.X.max == 0 → role unsupported by frame; rendered as "—".
      const cap = sysData.crew?.capacity ?? {};
      const _roleKeys = ["pilot", "gunner", "engineer", "crew"];
      const _filledByRole = { pilot: 0, gunner: 0, engineer: 0, crew: 0 };
      for (const s of crewSlots) {
        if (s.actor && _roleKeys.includes(s.role)) _filledByRole[s.role] += 1;
      }
      const crewByRole = _roleKeys.map(role => {
        const max = Number(cap?.[role]?.max ?? 0) || 0;
        const min = Number(cap?.[role]?.min ?? 0) || 0;
        const filled = _filledByRole[role] || 0;
        return {
          role,
          label: role.charAt(0).toUpperCase() + role.slice(1),
          min, max, filled,
          supported: max > 0,
          empty: filled === 0,
          fullySeated: max > 0 && filled >= max
        };
      });
      const crewCapacityTotal = crewByRole.reduce((s, r) => s + r.max, 0);
      const crewFilledTotal   = crewByRole.reduce((s, r) => s + r.filled, 0);

      const activeTab = this.tabGroups.primary ?? "identity";
      const gmEdit    = game.user?.isGM && (game.settings.get("bbttcc-core","gmEditMode") ?? false);

      const tabs = [
        { id: "identity", label: "Identity",  visible: true,                  active: activeTab === "identity" },
        { id: "crew",     label: "Crew",      visible: true,                  active: activeTab === "crew" },
        { id: "combat",   label: "Combat",    visible: true,                  active: activeTab === "combat" },
        { id: "gear",     label: "Gear",      visible: true,                  active: activeTab === "gear" },
        { id: "output",   label: "Output",    visible: hasOutputs || isStationary, active: activeTab === "output" },
        { id: "travel",   label: "Travel",    visible: !isStationary,         active: activeTab === "travel" },
        { id: "gmedit",   label: "GM Edit",   visible: gmEdit,                active: activeTab === "gmedit" }
      ];

      // Defense rows — canonical FT.DAMAGE_TYPES (7 RFI types)
      const resistList = sysData.defenses?.resistances     ?? [];
      const immuneList = sysData.defenses?.immunities      ?? [];
      const vulnList   = sysData.defenses?.vulnerabilities ?? [];
      const defenseRows = Object.entries(FT.DAMAGE_TYPES ?? {}).map(([key, info]) => {
        const isResist = resistList.includes(key);
        const isImmune = immuneList.includes(key);
        const isVuln   = vulnList.some(e =>
          (typeof e === "string" && e.toLowerCase() === key) ||
          (e && typeof e === "object" && String(e.type ?? "").toLowerCase() === key && !e.flavor)
        );
        const cycleState = isImmune ? "immune" : (isResist ? "resist" : "none");
        return { key, label: info.label ?? key, isResist, isImmune, isVuln, cycleState };
      });

      // B11.A (2026-05-12) — Guard/Evasion/Resolve trio derived in
      // FourthThingActor.prepareDerivedData from frame bracket + tier. Surfaced
      // here as a tile row above the resist/immune/vuln table so the GM can see
      // the contact defenses at a glance. Bracket source is the frame item if
      // equipped, else the actor-level integrity.bracket.
      const _rigBracket = sysData.derived?.defenseBracket
                       ?? frameRow?.bracket
                       ?? sysData.integrity?.bracket
                       ?? "medium";
      const _rigTier = Math.max(1, Math.min(4, Number(sysData.integrity?.tier) || 1));
      const _bracketLabel = _rigBracket.charAt(0).toUpperCase() + _rigBracket.slice(1);
      const defenseDerived = {
        bracket: _rigBracket,
        bracketLabel: _bracketLabel,
        tier: _rigTier,
        guard:   Number(sysData.derived?.guard?.value)   || 10,
        evasion: Number(sysData.derived?.evasion?.value) || 10,
        resolve: Number(sysData.derived?.resolve?.value) || 10,
        formulaHint: `${_bracketLabel} bracket · T${_rigTier} (base + tier)`
      };

      return {
        actor,
        owner: owner ? { id: owner.id, name: owner.name, img: owner.img } : null,
        factions,
        system: sysData,
        identity: sysData.identity ?? {},
        crew: { ...(sysData.crew ?? {}), slots: crewSlots },
        gear,
        integrity,
        integrityPct,
        defenses: sysData.defenses ?? { resistances: [], immunities: [], vulnerabilities: [] },
        defenseDerived,
        defenseRows,
        output: sysData.output ?? { modules: [], basePerTurn: {} },
        travel: sysData.travel ?? { speed: 0, range: 0, hazardResist: 0 },
        crewByRole,
        crewCapacityTotal,
        crewFilledTotal,
        tabs,
        activeTab,
        isMobile:     mobility !== "stationary",
        isStationary,
        isHybrid:     mobility === "hybrid",
        isParked:     state === "parked",
        isDeployed:   state === "deployed",
        isDestroyed:  state === "destroyed",
        outputPct:    ({ parked: 100, deployed: 50, destroyed: 0 })[state] ?? 100,
        gmEdit
      };
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this._bindRigTabs();
      this._applyActiveRigTab();
      this._bindRigDragDrop();
      this._bindRigInlineEditors();
    }

    _bindRigTabs() {
      const el = this.element;
      if (!el) return;
      el.querySelectorAll(".ft-tabs .item").forEach(btn => {
        if (btn.dataset.ftTabBound === "1") return;
        btn.dataset.ftTabBound = "1";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.tabGroups.primary = btn.dataset.tab;
          this._applyActiveRigTab();
        });
      });
    }

    _applyActiveRigTab() {
      const el = this.element;
      if (!el) return;
      const active = this.tabGroups.primary ?? "identity";
      el.querySelectorAll(".ft-tabs .item").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === active);
      });
      el.querySelectorAll(".ft-body .tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === active);
      });
    }

    _bindRigDragDrop() {
      const el = this.element;
      if (!el || el.dataset.ftRigDropBound === "1") return;
      el.dataset.ftRigDropBound = "1";
      el.addEventListener("dragover", (ev) => ev.preventDefault());
      el.addEventListener("drop",     (ev) => this._onDrop(ev));
      // Make embedded item rows draggable so users can drag gear back off
      for (const row of el.querySelectorAll("[data-item-id]")) {
        row.setAttribute("draggable", "true");
        row.addEventListener("dragstart", (ev) => {
          const itemId = row.dataset.itemId;
          const item   = itemId ? this.actor.items.get(itemId) : null;
          if (!item) return;
          ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
        });
      }
    }

    // Live-edit form fields with [data-ft-rig-edit]
    _bindRigInlineEditors() {
      const el = this.element;
      if (!el) return;
      el.querySelectorAll("[data-ft-rig-edit]").forEach(node => {
        if (node.dataset.ftRigBound === "1") return;
        node.dataset.ftRigBound = "1";
        node.addEventListener("change", async (ev) => {
          const path = ev.currentTarget.dataset.ftRigEdit;
          if (!path) return;
          const raw = ev.currentTarget.value;
          const num = Number(raw);
          const val = (ev.currentTarget.type === "number" || (raw !== "" && !isNaN(num))) ? num : raw;
          await this.actor.update({ [path]: val });
        });
      });
    }

    async _onDrop(event) {
      event.preventDefault();
      try {
        const raw = event.dataTransfer?.getData("text/plain");
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }

        // Item drop — equip into a slot (subtype-routed) or apply template
        if (data?.type === "Item") {
          const item = await Item.implementation.fromDropData(data);
          if (!item) return;
          if (item.parent?.id === this.actor.id) return;
          // Rig-template — apply config instead of embedding
          const subtype = item.getFlag?.("fourththing", "rigGear")?.subtype;
          if (subtype === "rig-template") {
            return this._applyRigTemplate(item);
          }
          const itemData = item.toObject();
          delete itemData._id;
          foundry.utils.setProperty(itemData, "flags.core.sourceId", item.uuid);
          await this.actor.createEmbeddedDocuments("Item", [itemData]);
          return;
        }

        // Actor drop — crew slot, owner zone, or first-empty-slot fallback
        if (data?.type === "Actor") {
          const dropped = await Actor.implementation.fromDropData(data);
          if (!dropped) return;
          const slotEl  = event.target.closest?.("[data-rig-crew-slot]");
          const ownerEl = event.target.closest?.("[data-rig-owner-drop]");

          if (slotEl && (dropped.type === "character" || dropped.type === "npc")) {
            const idx = Number(slotEl.dataset.rigCrewSlot);
            return this._assignCrewSlot(idx, dropped);
          }
          const isFaction = !!(dropped.flags?.["bbttcc-factions"]?.isFaction
                             || dropped.flags?.["bbttcc-factions"]?.op
                             || dropped.flags?.["bbttcc-factions"]?.identity);
          if (ownerEl || isFaction) {
            return this.actor.update({ "system.identity.factionOwnerId": dropped.id });
          }
          if (dropped.type === "character" || dropped.type === "npc") {
            const slots = foundry.utils.deepClone(this.actor.system?.crew?.slots ?? []);
            const empty = slots.findIndex(s => !s.actorId);
            if (empty >= 0) return this._assignCrewSlot(empty, dropped);
            slots.push({ role: "crew", actorId: dropped.id, label: dropped.name });
            return this.actor.update({ "system.crew.slots": slots });
          }
        }
      } catch (err) {
        console.error("Roll for Initiation | Rig _onDrop failed:", err);
        ui.notifications?.error("Could not drop that — see console.");
      }
    }

    async _assignCrewSlot(idx, dropped) {
      // Determine the role this slot is for (preserved if slot already has one)
      const slots = foundry.utils.deepClone(this.actor.system?.crew?.slots ?? []);
      while (slots.length <= idx) slots.push({ role: "crew", actorId: "", label: "" });
      const role = slots[idx].role || "crew";
      // Delegate to the boarding helper for full state machine (flag, hide tokens, badge)
      return ftBoardRig(dropped, this.actor, role);
    }

    async _applyRigTemplate(tplItem) {
      const cfg = tplItem.getFlag?.("fourththing", "rigTemplate")?.config;
      if (!cfg) { ui.notifications?.warn("Template has no config payload."); return; }

      // Lookup helper — find item by name across all Item packs (master-content first)
      const findItem = async (name) => {
        if (!name) return null;
        // Try the source pack first
        const sourcePack = tplItem.pack;
        if (sourcePack) {
          const pk = game.packs.get(sourcePack);
          if (pk) {
            const idx = await pk.getIndex();
            const hit = idx.find(e => e.name === name);
            if (hit) return pk.getDocument(hit._id);
          }
        }
        // Fallback: scan all Item packs
        for (const pk of game.packs) {
          if (pk.documentName !== "Item") continue;
          const idx = await pk.getIndex();
          const hit = idx.find(e => e.name === name);
          if (hit) return pk.getDocument(hit._id);
        }
        // World-level Items as a last resort
        return game.items?.getName?.(name) ?? null;
      };

      // Apply identity + integrity from frame
      const update = {};
      if (cfg.identity) {
        for (const [k, v] of Object.entries(cfg.identity)) {
          update[`system.identity.${k}`] = v;
        }
      }

      // Resolve frame to derive integrity + slots + capacity + actions
      const frameItem = await findItem(cfg.frame);
      if (frameItem) {
        const f = frameItem.getFlag("fourththing", "rigFrame") ?? {};
        if (f.bracket)        update["system.integrity.bracket"] = f.bracket;
        if (f.baseIntegrity != null) {
          update["system.integrity.max"]   = Number(f.baseIntegrity);
          update["system.integrity.value"] = Number(f.baseIntegrity);
        }
        if (f.capacity) update["system.crew.capacity"] = f.capacity;
        if (f.travel)   update["system.travel"]        = { ...this.actor.system.travel, ...f.travel };
      }

      await this.actor.update(update);

      // Embed the items (frame + each weapon/system/output)
      const toEmbed = [];
      const embedOne = async (name) => {
        const it = await findItem(name);
        if (!it) return;
        const data = it.toObject();
        delete data._id;
        foundry.utils.setProperty(data, "flags.core.sourceId", it.uuid);
        toEmbed.push(data);
      };
      if (cfg.frame) await embedOne(cfg.frame);
      for (const w of (cfg.gear?.weapons ?? [])) await embedOne(w);
      for (const s of (cfg.gear?.systems ?? [])) await embedOne(s);
      for (const o of (cfg.gear?.outputs ?? [])) await embedOne(o);
      if (toEmbed.length) await this.actor.createEmbeddedDocuments("Item", toEmbed);

      ui.notifications?.info(`Applied template: ${tplItem.name} (${toEmbed.length} items embedded).`);
    }

    // ── Static action handlers ──────────────────────────────────────────────
    static async _onFtRigOwnerPick(event, target) {
      const factions = (game.actors ?? []).filter(a => {
        const f = a.flags?.["bbttcc-factions"];
        return f && (f.isFaction === true || f.identity || f.op);
      });
      if (!factions.length) {
        ui.notifications?.warn("No factions found in this world.");
        return;
      }
      const opts = factions.map(f => `<option value="${f.id}">${foundry.utils.escapeHTML?.(f.name) ?? f.name}</option>`).join("");
      const html = `<form><div class="form-group"><label>Faction Owner</label><select name="factionId" style="width:100%">${opts}</select></div></form>`;
      let factionId = null;
      try {
        factionId = await foundry.applications.api.DialogV2.wait({
          window: { title: "Pick Faction Owner" },
          content: html,
          buttons: [
            { action: "ok",     label: "Set Owner", default: true,
              callback: (ev, btn, dialog) => dialog.element.querySelector("select[name=factionId]")?.value },
            { action: "cancel", label: "Cancel" }
          ]
        });
      } catch { factionId = null; }
      if (!factionId || factionId === "cancel") return;
      return this.actor.update({ "system.identity.factionOwnerId": factionId });
    }

    static async _onFtRigOwnerClear(event, target) {
      return this.actor.update({ "system.identity.factionOwnerId": "" });
    }

    static async _onFtRigDeploy(event, target) {
      const sys = this.actor.system?.system ?? this.actor.system;
      if ((sys.identity?.mobility ?? "mobile") === "stationary") {
        ui.notifications?.warn("Stationary rigs cannot deploy.");
        return;
      }
      const scene = canvas?.scene;
      if (!scene) { ui.notifications?.warn("No active scene to deploy to."); return; }
      const x = Math.round(canvas.dimensions.width / 2);
      const y = Math.round(canvas.dimensions.height / 2);
      const tokenDoc = await this.actor.getTokenDocument({ x, y });
      const created  = await scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
      await this.actor.update({
        "system.identity.state":           "deployed",
        "system.identity.binding.sceneId": scene.id,
        "system.identity.binding.tokenId": created[0]?.id ?? ""
      });
      ui.notifications?.info(`${this.actor.name} deployed to ${scene.name}.`);
    }

    static async _onFtRigRecall(event, target) {
      const sys = this.actor.system?.system ?? this.actor.system;
      const sceneId = sys.identity?.binding?.sceneId;
      const tokenId = sys.identity?.binding?.tokenId;
      if (sceneId && tokenId) {
        const scene = game.scenes?.get(sceneId);
        const tok   = scene?.tokens?.get(tokenId);
        if (tok) await scene.deleteEmbeddedDocuments("Token", [tokenId]);
      }
      await this.actor.update({
        "system.identity.state":           "parked",
        "system.identity.binding.sceneId": "",
        "system.identity.binding.tokenId": ""
      });
      ui.notifications?.info(`${this.actor.name} recalled.`);
    }

    static async _onFtRigCrewDisembark(event, target) {
      const idx = Number(target.closest("[data-rig-crew-slot]")?.dataset?.rigCrewSlot ?? -1);
      if (idx < 0) return;
      const slots = this.actor.system?.crew?.slots ?? [];
      const slot  = slots[idx];
      if (!slot?.actorId) return;
      const steward = game.actors?.get(slot.actorId);
      if (steward) {
        return ftDisembarkSteward(steward);  // clears flag, restores tokens, removes from rig slots
      }
      // Fallback if steward actor was deleted: just clear the slot
      const fresh = foundry.utils.deepClone(slots);
      fresh[idx].actorId = "";
      return this.actor.update({ "system.crew.slots": fresh });
    }

    static async _onFtRigCrewOpenSheet(event, target) {
      const idx = Number(target.closest("[data-rig-crew-slot]")?.dataset?.rigCrewSlot ?? -1);
      const slots = this.actor.system?.crew?.slots ?? [];
      const slot  = slots[idx];
      if (!slot?.actorId) return;
      game.actors?.get(slot.actorId)?.sheet?.render(true);
    }

    static async _onFtRigIntegrityAdjust(event, target) {
      const delta = Number(target.dataset?.delta ?? 0);
      if (!delta) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      const cur = Number(sys.integrity?.value ?? 0);
      const max = Number(sys.integrity?.max ?? 0);
      const next = Math.max(0, Math.min(max, cur + delta));
      return this.actor.update({ "system.integrity.value": next });
    }

    // B13.C — 2026-05-17. Opens the Rig Builder pre-filled with this
    // rig's current state so the GM can tweak before creating a new
    // actor. Doesn't modify the source rig.
    static async _onFtRigDuplicate(_event, _target) {
      try {
        const api = globalThis.BBTTCC_RigBuilder
                 ?? game.bbttcc?.api?.rigBuilder;
        if (typeof api?.seedFromActor !== "function" || typeof api?.open !== "function") {
          return ui.notifications?.warn?.("Rig Builder not available — cannot duplicate.");
        }
        const seed = api.seedFromActor(this.actor);
        if (!seed) return ui.notifications?.warn?.("Could not build a duplicate seed for this rig.");
        await api.open({ seed });
      } catch (err) {
        console.error("[fourththing] _onFtRigDuplicate failed", err);
        ui.notifications?.error?.("Could not open the Rig Builder for duplication.");
      }
    }

    get title() { return this.actor?.name ?? "Rig"; }
  }

  // ── FourthThingBossSheet (Phase 3 — RIG_BOSS_SCHEMA.md) ────────────────────
  // Adversarial bosses with phase ladder, Surge bank, manifestation library,
  // OP-economy raid profile, registry-loaded powers + behaviors. Tabbed:
  // Identity / Phases / Combat / Manifest / Powers / Behaviors / Raid / GM.
  // Absorbs the full authoring affordance of bbttcc-raid/boss-config-app.js
  // (BOSS_TEMPLATES + BOSS_POWERS + BOSS_POWER_PACKS surfaced via GM tab).
  class FourthThingBossSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

    static DEFAULT_OPTIONS = {
      classes:  ["fourththing", "sheet", "actor", "boss"],
      position: { width: 1080, height: 920 },
      window:   { resizable: true },
      actions:  {
        ftEditPortrait:        FourthThingCharacterSheet._onFtEditPortrait,
        ftToggleEditMode:      FourthThingCharacterSheet._onFtToggleEditMode,
        ftDefenseCycle:        FourthThingCharacterSheet._onFtDefenseCycle,
        ftDefenseRoll:         FourthThingCharacterSheet._onFtDefenseRoll,
        ftVulnToggle:          FourthThingCharacterSheet._onFtVulnToggle,
        ftCondImmuneToggle:    FourthThingCharacterSheet._onFtCondImmuneToggle,
        ftSurgeSpend:          FourthThingCharacterSheet._onFtSurgeSpend,
        ftItemEdit:            FourthThingCharacterSheet._onFtItemEdit,
        ftItemDelete:          FourthThingCharacterSheet._onFtItemDelete,
        // Boss-specific
        ftBossIntegrityAdjust: FourthThingBossSheet._onFtBossIntegrityAdjust,
        ftBossSurgeAdjust:     FourthThingBossSheet._onFtBossSurgeAdjust,
        ftBossMomentumAdjust:  FourthThingBossSheet._onFtBossMomentumAdjust,
        ftBossPhaseAdvance:    FourthThingBossSheet._onFtBossPhaseAdvance,
        ftBossPhaseRetreat:    FourthThingBossSheet._onFtBossPhaseRetreat,
        ftBossPhaseAdd:        FourthThingBossSheet._onFtBossPhaseAdd,
        ftBossPhaseRemove:     FourthThingBossSheet._onFtBossPhaseRemove,
        ftBossTemplateApply:   FourthThingBossSheet._onFtBossTemplateApply,
        ftBossPowerAdd:        FourthThingBossSheet._onFtBossPowerAdd,
        ftBossPowerRemove:     FourthThingBossSheet._onFtBossPowerRemove,
        ftBossPackApply:       FourthThingBossSheet._onFtBossPackApply,
        ftBossNormalize:       FourthThingBossSheet._onFtBossNormalize,
        ftBossManeuverAdd:     FourthThingBossSheet._onFtBossManeuverAdd,
        ftBossManeuverPick:    FourthThingBossSheet._onFtBossManeuverPick,
        ftBossManeuverRemove:  FourthThingBossSheet._onFtBossManeuverRemove,
        // Phase 8 polish (2026-05-10)
        ftBossManifestPick:    FourthThingBossSheet._onFtBossManifestPick,
        ftBossManifestCreate:  FourthThingBossSheet._onFtBossManifestCreate,
        ftBossManifestCast:    FourthThingBossSheet._onFtBossManifestCast,
        ftBossManifestRemove:  FourthThingBossSheet._onFtBossManifestRemove,
        ftBossBehaviorPhaseSet: FourthThingBossSheet._onFtBossBehaviorPhaseSet,
        // B13.C — 2026-05-17
        ftBossDuplicate:       FourthThingBossSheet._onFtBossDuplicate
      },
      dragDrop: [{ dragSelector: "[data-item-id]", dropSelector: null }],
      form:     { submitOnChange: true, closeOnSubmit: false }
    };

    static PARTS = {
      sheet: { template: "systems/fourththing/templates/actors/boss-sheet.hbs" }
    };

    tabGroups = { primary: "identity" };

    async _prepareContext(options) {
      const actor   = this.actor;
      const rawSys  = actor.system?.system ?? actor.system;
      const sysData = rawSys?.toObject ? rawSys.toObject() : JSON.parse(JSON.stringify(rawSys ?? {}));

      const integrity = sysData.integrity ?? { value: 0, max: 0, tier: 1, bracket: "heavy" };
      const integrityPct = integrity.max > 0
        ? Math.max(0, Math.min(100, Math.round((Number(integrity.value)||0) / Number(integrity.max) * 100)))
        : 0;

      const phases = sysData.phases ?? { ladder: [], currentPhase: 0 };
      const ladder = (Array.isArray(phases.ladder) ? phases.ladder : []).map((p, i) => ({
        idx: i,
        label: p.label ?? `Phase ${i+1}`,
        integrityThreshold: p.integrityThreshold ?? 0,
        manifestationGrants: Array.isArray(p.manifestationGrants) ? p.manifestationGrants : [],
        surgeBoost: p.surgeBoost ?? 0,
        active: i === phases.currentPhase
      }));
      const currentPhaseEntry = ladder[phases.currentPhase] ?? null;

      const factionId = sysData.identity?.factionId ?? "";
      const faction   = factionId ? game.actors?.get(factionId) : null;

      // Defense rows (canonical FT.DAMAGE_TYPES)
      const resistList = sysData.defenses?.resistances     ?? [];
      const immuneList = sysData.defenses?.immunities      ?? [];
      const vulnList   = sysData.defenses?.vulnerabilities ?? [];
      const defenseRows = Object.entries(FT.DAMAGE_TYPES ?? {}).map(([key, info]) => {
        const isResist = resistList.includes(key);
        const isImmune = immuneList.includes(key);
        const isVuln   = vulnList.some(e =>
          (typeof e === "string" && e.toLowerCase() === key) ||
          (e && typeof e === "object" && String(e.type ?? "").toLowerCase() === key && !e.flavor)
        );
        return { key, label: info.label ?? key, isResist, isImmune, isVuln };
      });

      // Manifestation library — resolve UUIDs for display. Each row carries
      // tier + tag chips so the GM can scan the library and recognize at-a-
      // glance whether an entry matches the boss's tier band and archetype.
      const manifestations = sysData.manifestations ?? { library: [], surge: { current: 0, max: 6 }, momentum: 0 };
      const bossTierCtx = Math.max(1, Math.min(4, Number(sysData.integrity?.tier) || 1));
      const libraryItems = [];
      for (const uuid of (manifestations.library ?? [])) {
        try {
          const doc = await fromUuid(uuid);
          if (!doc) continue;
          const ds = doc.system ?? {};
          const flagTags = doc.flags?.fourththing?.bossArchetypeTags;
          const sysTags  = ds.tags;
          const rawTags  = Array.isArray(flagTags) && flagTags.length ? flagTags
                          : (Array.isArray(sysTags) ? sysTags : []);
          const tags = rawTags.map(t => String(t || "").trim()).filter(Boolean);
          const tier = Math.max(1, Math.min(4, Number(ds?.manifestation?.tier) || Number(ds?.tier) || 1));
          libraryItems.push({
            uuid, name: doc.name, img: doc.img,
            tier,
            tags,
            tagChipsShown: tags.slice(0, 3),
            tagChipsMore:  Math.max(0, tags.length - 3),
            inReach: tier <= bossTierCtx + 1,
            overTier: tier > bossTierCtx + 1
          });
        } catch (e) { /* skip broken refs */ }
      }

      // Bridge to bbttcc-raid registries (BOSS_TEMPLATES + BOSS_POWERS + BOSS_POWER_PACKS).
      const bossApi = game.bbttcc?.api?.raid ?? {};
      const templateOptions = (bossApi.bossTemplates ?? []).map(t => ({ key: t.key, label: t.label, description: t.description }));

      // Compute the set of installed behavior IDs from raidProfile.behaviorsRaw
      // so the picker dropdowns + catalog browser can mark which powers
      // are already on this boss. Without this, GMs see all powers listed
      // identically and hit "already present" dedupe warnings when adding.
      // (2026-05-17 patch — user feedback: dedupe was reading as an error.)
      const installedBehaviorIds = (() => {
        const raw = sysData.raidProfile?.behaviorsRaw || "[]";
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = []; }
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.map(b => String(b?.id ?? b?.key ?? "").trim()).filter(Boolean));
      })();
      const _powerInstalled = (powerKey) => {
        const allPwrs = bossApi.bossPowers ?? [];
        const p = allPwrs.find(x => x.key === powerKey);
        const id = p?.behavior?.id ?? powerKey;
        return installedBehaviorIds.has(String(id));
      };

      const packOptions = (bossApi.bossPowerPacks ?? []).map(p => {
        const powers = Array.isArray(p.powers) ? p.powers : [];
        const installedInPack = powers.filter(_powerInstalled).length;
        return {
          key: p.key,
          label: p.label,
          description: p.description,
          count: powers.length,
          installedCount: installedInPack,
          allInstalled: powers.length > 0 && installedInPack === powers.length
        };
      });

      // Slice 3 (2026-05-11) — phase-grouped boss powers. The bossPowers
      // registry carries `behavior.phase` ("round_end" | "after_roll" |
      // "round_start"); group so the GM sees what fires when. when/effects
      // summaries are derived inline (best-effort — the registry shape is
      // legacy-shaped JSON).
      const _summarizeWhen = (when) => {
        if (!when || typeof when !== "object") return "";
        const parts = [];
        for (const [k, v] of Object.entries(when)) {
          if (typeof v === "boolean") parts.push(v ? k : `!${k}`);
          else parts.push(`${k}=${v}`);
        }
        return parts.join(" · ");
      };
      const _summarizeWorldEffects = (we) => {
        if (!we || typeof we !== "object") return "";
        const bits = [];
        if (Array.isArray(we.factionEffects)) {
          for (const f of we.factionEffects) {
            const fp = Object.entries(f)
              .filter(([_, v]) => v != null && v !== 0)
              .map(([k, v]) => `${k}=${v}`);
            if (fp.length) bits.push(fp.join(", "));
          }
        }
        if (we.warLog) bits.push(`log: ${String(we.warLog).slice(0, 60)}${String(we.warLog).length > 60 ? "…" : ""}`);
        return bits.join(" · ");
      };
      const _powerRow = (p) => {
        const when    = p?.behavior?.when ?? null;
        const effects = p?.behavior?.effects?.worldEffects ?? null;
        const endRaid = p?.behavior?.endRaid?.outcome ?? "";
        const id = p?.behavior?.id ?? p.key;
        return {
          key: p.key,
          label: p.label,
          description: p.description ?? "",
          phase: p?.behavior?.phase ?? "any",
          whenSummary:    _summarizeWhen(when),
          effectsSummary: _summarizeWorldEffects(effects),
          endRaid,
          installed: installedBehaviorIds.has(String(id))
        };
      };
      const allPowerRows = (bossApi.bossPowers ?? []).map(_powerRow);
      const PHASE_ORDER = ["round_start", "after_roll", "round_end", "any"];
      const _phaseLabel = (p) => ({
        round_start: "Round Start",
        after_roll:  "After Roll",
        round_end:   "Round End",
        any:         "Any / Unphased"
      })[p] ?? p;
      const _phaseMap = {};
      for (const row of allPowerRows) {
        (_phaseMap[row.phase] ??= []).push(row);
      }
      const phaseGroupedPowers = PHASE_ORDER
        .filter(p => _phaseMap[p]?.length)
        .map(p => ({ phase: p, label: _phaseLabel(p), powers: _phaseMap[p] }));
      // Powers not in PHASE_ORDER buckets (defensive — registry growth).
      for (const p of Object.keys(_phaseMap)) {
        if (PHASE_ORDER.includes(p)) continue;
        phaseGroupedPowers.push({ phase: p, label: _phaseLabel(p), powers: _phaseMap[p] });
      }
      // Flat list still exposed for the simple Add-Power select fallback.
      const powerOptions = allPowerRows.map(p => ({ key: p.key, label: p.label, phase: p.phase }));

      // Slice 3 — Standard Maneuvers catalog. Reads game.bbttcc.api.raid.EFFECTS,
      // normalizes (lowercase raidTypes, merged opCosts), buckets by tier, and
      // surfaces deduped raidType options for the picker filter.
      const _normManLower = (s) => String(s || "").trim().toLowerCase();
      const _maneuverFromEffect = (key, e) => {
        const tier = Number(e?.tier);
        const tierBucket = (tier >= 1 && tier <= 4) ? `T${tier}` : "untiered";
        const rt = Array.isArray(e?.raidTypes) ? e.raidTypes.map(_normManLower).filter(Boolean) : [];
        const rtDedup = [...new Set(rt)];
        const opCostMerge = {};
        const src = e?.opCosts ?? e?.cost ?? {};
        for (const [k, v] of Object.entries(src)) {
          const nk = _normManLower(k);
          const nv = Number(v) || 0;
          if (!nv) continue;
          opCostMerge[nk] = Math.max(opCostMerge[nk] || 0, nv);
        }
        return {
          key, label: e?.label ?? key,
          tier: Number.isFinite(tier) ? tier : null,
          tierBucket,
          raidTypes: rtDedup,
          opCosts: opCostMerge,
          opSummary: Object.entries(opCostMerge).map(([k, v]) => `${v} ${k}`).join(" · "),
          text: String(e?.text ?? "").slice(0, 140),
          rarity: e?.rarity ?? "",
          family: e?.family ?? ""
        };
      };
      const EFFECTS = bossApi.EFFECTS ?? {};
      const maneuverOptions = Object.entries(EFFECTS)
        .filter(([_, e]) => (e?.kind ?? "maneuver") === "maneuver")
        .map(([k, e]) => _maneuverFromEffect(k, e))
        .sort((a, b) => {
          const ta = a.tier ?? 99, tb = b.tier ?? 99;
          return ta - tb || a.label.localeCompare(b.label);
        });
      // Deduped raidType set for the filter dropdown.
      const _rtSet = new Set();
      for (const m of maneuverOptions) for (const rt of m.raidTypes) _rtSet.add(rt);
      const maneuverRaidTypes = [...(_rtSet)].sort();
      // Group maneuvers by tier bucket for the picker optgroups.
      const _bucketOrder = ["T1", "T2", "T3", "T4", "untiered"];
      const _byBucket = {};
      for (const m of maneuverOptions) (_byBucket[m.tierBucket] ??= []).push(m);
      const maneuverByBucket = _bucketOrder
        .filter(b => _byBucket[b]?.length)
        .map(b => ({
          bucket: b,
          label: (b === "untiered") ? "Untiered (legacy)" : b,
          count: _byBucket[b].length,
          isUntiered: b === "untiered",
          maneuvers: _byBucket[b]
        }));

      // Raid profile — legacy OP economy
      const raidProfile = sysData.raidProfile ?? {
        key: "", mode: "hybrid", moraleHits: 4, hitTrack: "", tagsRaw: "",
        opStats: {}, behaviorsRaw: "[]"
      };
      const opEntries = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"]
        .map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), value: Number(raidProfile.opStats?.[k] ?? 0) }));
      let behaviorsParsed = [];
      try { behaviorsParsed = JSON.parse(raidProfile.behaviorsRaw || "[]"); } catch { behaviorsParsed = []; }
      const behaviorRows = (Array.isArray(behaviorsParsed) ? behaviorsParsed : []).map((b, i) => ({
        idx: i,
        id: b.id ?? b.key ?? `behavior-${i}`,
        label: b.label ?? b.id ?? `Behavior ${i+1}`,
        phase: b.phase ?? "—",
        whenSummary: b.when ? Object.entries(b.when).map(([k,v]) => `${k}=${v}`).join(", ") : "",
        endRaid: b.endRaid ? (b.endRaid.outcome ?? "yes") : ""
      }));

      // Doctrine maneuverKeys (legacy raid doctrine) — Slice 3 resolves each
      // stored key against the maneuverOptions catalog so the pills can show
      // labels + tier badges. Unresolved keys still render as raw pills (with
      // a "?" marker) so the GM can spot stale/typo'd doctrines.
      const doctrine = sysData.doctrine ?? { slot: "", maneuverKeys: [] };
      const maneuverKeys = Array.isArray(doctrine.maneuverKeys) ? doctrine.maneuverKeys : [];
      const _manIdx = {};
      for (const m of maneuverOptions) _manIdx[m.key] = m;
      const maneuverPills = maneuverKeys.map(k => {
        const m = _manIdx[k];
        if (m) return { key: k, label: m.label, tier: m.tier, tierBucket: m.tierBucket, opSummary: m.opSummary, raidTypes: m.raidTypes, found: true };
        return { key: k, label: k, tier: null, tierBucket: "untiered", opSummary: "", raidTypes: [], found: false };
      });

      const activeTab = this.tabGroups.primary ?? "identity";
      const gmEdit    = game.user?.isGM && (game.settings.get("bbttcc-core","gmEditMode") ?? false);

      const tabs = [
        { id: "identity", label: "Identity",      visible: true,  active: activeTab === "identity" },
        { id: "phases",   label: "Phase Ladder",  visible: true,  active: activeTab === "phases" },
        { id: "combat",   label: "Combat",        visible: true,  active: activeTab === "combat" },
        { id: "manifest", label: "Manifestations",visible: true,  active: activeTab === "manifest" },
        { id: "powers",   label: "Powers",        visible: true,  active: activeTab === "powers" },
        { id: "behaviors",label: "Behaviors",     visible: true,  active: activeTab === "behaviors" },
        { id: "raid",     label: "Raid Profile",  visible: true,  active: activeTab === "raid" },
        { id: "gmedit",   label: "GM Edit",       visible: gmEdit,active: activeTab === "gmedit" }
      ];

      return {
        actor,
        faction: faction ? { id: faction.id, name: faction.name, img: faction.img } : null,
        system: sysData,
        identity: sysData.identity ?? {},
        identityArchetypeTagsCsv: Array.isArray(sysData?.identity?.archetypeTags)
          ? sysData.identity.archetypeTags.join(", ") : "",
        phases,
        ladder,
        currentPhaseEntry,
        integrity,
        integrityPct,
        defenses: sysData.defenses ?? { resistances: [], immunities: [], vulnerabilities: [] },
        defenseRows,
        manifestations,
        libraryItems,
        doctrine,
        maneuverKeys,
        maneuverPills,
        maneuverOptions,
        maneuverByBucket,
        maneuverRaidTypes,
        phaseGroupedPowers,
        powers: sysData.powers ?? { powers: [], cooldowns: {} },
        behaviors: sysData.behaviors ?? { behaviors: [], triggerState: {} },
        raidStats: sysData.raidStats ?? { rounds: 0, morale: 3, infiltration: 0, alarm: 0 },
        raidProfile,
        opEntries,
        behaviorRows,
        templateOptions,
        powerOptions,
        packOptions,
        tabs,
        activeTab,
        gmEdit
      };
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      this._bindBossTabs();
      this._applyActiveBossTab();
      this._bindBossDragDrop();
      this._bindBossInlineEditors();
      this._bindBossManeuverInput();
    }

    // Empty-input guard on the Add Maneuver button (Phase 8 polish, 2026-05-10).
    // The button is rendered with `disabled`; this listener toggles it as the
    // user types, so the click never fires on an empty key and the user never
    // sees the "Enter a maneuver key" warning.
    _bindBossManeuverInput() {
      const input = this.element?.querySelector("input[data-role=maneuver-key-input]");
      const btn   = this.element?.querySelector(".ft-maneuver-add-btn");
      if (!input || !btn) return;
      if (input.dataset.ftManeuverInputBound === "1") return;
      input.dataset.ftManeuverInputBound = "1";
      const update = () => {
        const has = String(input.value || "").trim().length > 0;
        btn.disabled = !has;
        btn.dataset.tooltip = has ? "Add this maneuver to the doctrine." : "Type a maneuver key first.";
      };
      input.addEventListener("input", update);
      input.addEventListener("change", update);
      update();
    }

    _bindBossTabs() {
      const el = this.element;
      if (!el) return;
      el.querySelectorAll(".ft-tabs .item").forEach(btn => {
        if (btn.dataset.ftTabBound === "1") return;
        btn.dataset.ftTabBound = "1";
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.tabGroups.primary = btn.dataset.tab;
          this._applyActiveBossTab();
        });
      });
    }

    _applyActiveBossTab() {
      const el = this.element;
      if (!el) return;
      const active = this.tabGroups.primary ?? "identity";
      el.querySelectorAll(".ft-tabs .item").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === active));
      el.querySelectorAll(".ft-body .tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === active));
    }

    _bindBossDragDrop() {
      const el = this.element;
      if (!el || el.dataset.ftBossDropBound === "1") return;
      el.dataset.ftBossDropBound = "1";
      el.addEventListener("dragover", (ev) => ev.preventDefault());
      el.addEventListener("drop",     (ev) => this._onDrop(ev));
    }

    _bindBossInlineEditors() {
      const el = this.element;
      if (!el) return;
      el.querySelectorAll("[data-ft-boss-edit]").forEach(node => {
        if (node.dataset.ftBossBound === "1") return;
        node.dataset.ftBossBound = "1";
        node.addEventListener("change", async (ev) => {
          const path = ev.currentTarget.dataset.ftBossEdit;
          if (!path) return;
          const raw = ev.currentTarget.value;
          const num = Number(raw);
          const isNum = ev.currentTarget.type === "number" || (raw !== "" && !isNaN(num));
          await this.actor.update({ [path]: isNum ? num : raw });
        });
      });
      // CSV-array variant (2026-05-11 — Boss Sheet Slice 2). Comma-separated
      // text input writes to an array path. Used by `identity.archetypeTags`.
      el.querySelectorAll("[data-ft-boss-edit-csv]").forEach(node => {
        if (node.dataset.ftBossCsvBound === "1") return;
        node.dataset.ftBossCsvBound = "1";
        node.addEventListener("change", async (ev) => {
          const path = ev.currentTarget.dataset.ftBossEditCsv;
          if (!path) return;
          const arr = String(ev.currentTarget.value || "")
            .split(",")
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
          await this.actor.update({ [path]: arr });
        });
      });
    }

    async _onDrop(event) {
      event.preventDefault();
      try {
        const raw = event.dataTransfer?.getData("text/plain");
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }

        // Drop manifestation Item / boss-template / generic embed
        if (data?.type === "Item") {
          const item = await Item.implementation.fromDropData(data);
          if (!item) return;
          // Boss-template — apply config payload
          const subtype = item.getFlag?.("fourththing", "rigGear")?.subtype;
          if (subtype === "boss-template") {
            return this._applyBossTemplate(item);
          }
          // Manifestation (power) → add to library by UUID, don't embed
          if (item.type === "power") {
            const library = Array.isArray(this.actor.system?.manifestations?.library)
              ? [...this.actor.system.manifestations.library] : [];
            if (!library.includes(item.uuid)) library.push(item.uuid);
            await this.actor.update({ "system.manifestations.library": library });
            return;
          }
          // Otherwise embed (boss-augment etc.)
          const itemData = item.toObject();
          delete itemData._id;
          foundry.utils.setProperty(itemData, "flags.core.sourceId", item.uuid);
          await this.actor.createEmbeddedDocuments("Item", [itemData]);
          return;
        }

        // Drop a faction actor → set faction binding
        if (data?.type === "Actor") {
          const dropped = await Actor.implementation.fromDropData(data);
          if (!dropped) return;
          const isFaction = !!(dropped.flags?.["bbttcc-factions"]?.isFaction
                             || dropped.flags?.["bbttcc-factions"]?.op
                             || dropped.flags?.["bbttcc-factions"]?.identity);
          if (isFaction) {
            return this.actor.update({ "system.identity.factionId": dropped.id });
          }
        }
      } catch (err) {
        console.error("Roll for Initiation | Boss _onDrop failed:", err);
        ui.notifications?.error("Could not drop that — see console.");
      }
    }

    async _applyBossTemplate(tplItem) {
      const cfg = tplItem.getFlag?.("fourththing", "bossTemplate")?.config;
      if (!cfg) { ui.notifications?.warn("Template has no config payload."); return; }
      const update = {};
      const flatten = (obj, prefix) => {
        for (const [k, v] of Object.entries(obj ?? {})) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (v !== null && typeof v === "object" && !Array.isArray(v)) flatten(v, path);
          else update[`system.${path}`] = v;
        }
      };
      // Apply identity, raidProfile, doctrine, integrity, manifestations.surge/momentum
      if (cfg.identity)       flatten(cfg.identity,       "identity");
      if (cfg.raidProfile)    flatten(cfg.raidProfile,    "raidProfile");
      if (cfg.doctrine)       flatten(cfg.doctrine,       "doctrine");
      if (cfg.integrity)      flatten(cfg.integrity,      "integrity");
      if (cfg.manifestations) {
        if (cfg.manifestations.surge)    flatten(cfg.manifestations.surge,    "manifestations.surge");
        if (cfg.manifestations.momentum != null) update["system.manifestations.momentum"] = cfg.manifestations.momentum;
      }
      // Phase ladder is array — set whole
      if (cfg.phases) {
        if (Array.isArray(cfg.phases.ladder))    update["system.phases.ladder"]       = cfg.phases.ladder;
        if (cfg.phases.currentPhase != null)     update["system.phases.currentPhase"] = cfg.phases.currentPhase;
      }
      await this.actor.update(update);
      ui.notifications?.info(`Applied boss template: ${tplItem.name}`);
    }

    // ── Static action handlers ──────────────────────────────────────────────
    static async _onFtBossIntegrityAdjust(event, target) {
      const delta = Number(target.dataset?.delta ?? 0);
      if (!delta) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      const cur = Number(sys.integrity?.value ?? 0);
      const max = Number(sys.integrity?.max ?? 0);
      const next = Math.max(0, Math.min(max, cur + delta));
      return this.actor.update({ "system.integrity.value": next });
    }

    static async _onFtBossSurgeAdjust(event, target) {
      const delta = Number(target.dataset?.delta ?? 0);
      if (!delta) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      const cur = Number(sys.manifestations?.surge?.current ?? 0);
      const max = Number(sys.manifestations?.surge?.max ?? 6);
      const next = Math.max(0, Math.min(max, cur + delta));
      return this.actor.update({ "system.manifestations.surge.current": next });
    }

    static async _onFtBossMomentumAdjust(event, target) {
      const delta = Number(target.dataset?.delta ?? 0);
      if (!delta) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      const cur = Number(sys.manifestations?.momentum ?? 0);
      const next = Math.max(0, cur + delta);
      return this.actor.update({ "system.manifestations.momentum": next });
    }

    static async _onFtBossPhaseAdvance(event, target) {
      const sys = this.actor.system?.system ?? this.actor.system;
      const ladder = Array.isArray(sys.phases?.ladder) ? sys.phases.ladder : [];
      const cur = Number(sys.phases?.currentPhase ?? 0);
      if (cur >= ladder.length - 1) return;
      const next = cur + 1;
      const nextEntry = ladder[next];
      const update = { "system.phases.currentPhase": next };
      if (nextEntry?.surgeBoost) {
        const curSurge = Number(sys.manifestations?.surge?.current ?? 0);
        const maxSurge = Number(sys.manifestations?.surge?.max ?? 6);
        update["system.manifestations.surge.current"] = Math.min(maxSurge, curSurge + Number(nextEntry.surgeBoost));
      }
      await this.actor.update(update);
      ui.notifications?.info(`${this.actor.name}: entered ${nextEntry?.label ?? `Phase ${next+1}`}.`);
    }

    static async _onFtBossPhaseRetreat(event, target) {
      const sys = this.actor.system?.system ?? this.actor.system;
      const cur = Number(sys.phases?.currentPhase ?? 0);
      if (cur <= 0) return;
      return this.actor.update({ "system.phases.currentPhase": cur - 1 });
    }

    static async _onFtBossPhaseAdd(event, target) {
      const sys = this.actor.system?.system ?? this.actor.system;
      const ladder = Array.isArray(sys.phases?.ladder) ? [...sys.phases.ladder] : [];
      ladder.push({
        label: `Phase ${ladder.length + 1}`,
        integrityThreshold: 50,
        onEnterEffects: [],
        manifestationGrants: [],
        surgeBoost: 0
      });
      return this.actor.update({ "system.phases.ladder": ladder });
    }

    static async _onFtBossPhaseRemove(event, target) {
      const idx = Number(target.closest("[data-phase-idx]")?.dataset?.phaseIdx ?? -1);
      if (idx < 0) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      const ladder = Array.isArray(sys.phases?.ladder) ? [...sys.phases.ladder] : [];
      ladder.splice(idx, 1);
      const cur = Math.min(Number(sys.phases?.currentPhase ?? 0), Math.max(0, ladder.length - 1));
      return this.actor.update({ "system.phases.ladder": ladder, "system.phases.currentPhase": cur });
    }

    static async _onFtBossTemplateApply(event, target) {
      const tplKey = this.element?.querySelector("[data-role=template-picker]")?.value;
      if (!tplKey) { ui.notifications?.warn("Pick a template first."); return; }
      const tpl = (game.bbttcc?.api?.raid?.bossTemplates ?? []).find(t => t.key === tplKey);
      if (!tpl) { ui.notifications?.warn("Template not found."); return; }
      const d = tpl.defaults ?? {};
      const update = {};
      if (d.mode)      update["system.raidProfile.mode"]       = d.mode;
      if (d.hitTrack)  update["system.raidProfile.hitTrack"]   = d.hitTrack;
      if (d.tags)      update["system.raidProfile.tagsRaw"]    = d.tags;
      if (d.stats) {
        for (const [k, v] of Object.entries(d.stats)) {
          update[`system.raidProfile.opStats.${k}`] = Number(v) || 0;
        }
      }
      if (Array.isArray(d.behaviors)) {
        update["system.raidProfile.behaviorsRaw"] = JSON.stringify(d.behaviors, null, 2);
      }
      await this.actor.update(update);
      ui.notifications?.info(`Applied template: ${tpl.label}`);
    }

    static async _onFtBossPowerAdd(event, target) {
      const powerKey = this.element?.querySelector("[data-role=power-picker]")?.value;
      if (!powerKey) { ui.notifications?.warn("Pick a power first."); return; }
      const power = (game.bbttcc?.api?.raid?.bossPowers ?? []).find(p => p.key === powerKey);
      if (!power) { ui.notifications?.warn("Power not found."); return; }
      const sys = this.actor.system?.system ?? this.actor.system;
      let parsed = [];
      try { parsed = JSON.parse(sys.raidProfile?.behaviorsRaw || "[]"); } catch { parsed = []; }
      if (!Array.isArray(parsed)) parsed = [];
      // Avoid dupes by id. Clearer message — this is the expected outcome
      // when the boss was created via a starter chip that already seeded a
      // power pack (e.g. Qliphothic Auditor → Audit Pack → Audit Pressure).
      const id = power.behavior?.id ?? power.key;
      if (parsed.some(b => (b.id ?? b.key) === id)) {
        ui.notifications?.info(`"${power.label}" is already installed on this boss — see the Behaviors tab.`);
        return;
      }
      parsed.push(foundry.utils.deepClone(power.behavior ?? { id, label: power.label }));
      ui.notifications?.info(`Added power: ${power.label}.`);
      return this.actor.update({ "system.raidProfile.behaviorsRaw": JSON.stringify(parsed, null, 2) });
    }

    static async _onFtBossPowerRemove(event, target) {
      const idx = Number(target.closest("[data-behavior-idx]")?.dataset?.behaviorIdx ?? -1);
      if (idx < 0) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      let parsed = [];
      try { parsed = JSON.parse(sys.raidProfile?.behaviorsRaw || "[]"); } catch { parsed = []; }
      if (!Array.isArray(parsed)) parsed = [];
      parsed.splice(idx, 1);
      return this.actor.update({ "system.raidProfile.behaviorsRaw": JSON.stringify(parsed, null, 2) });
    }

    static async _onFtBossPackApply(event, target) {
      const packKey = this.element?.querySelector("[data-role=pack-picker]")?.value;
      if (!packKey) { ui.notifications?.warn("Pick a power pack first."); return; }
      const pack = (game.bbttcc?.api?.raid?.bossPowerPacks ?? []).find(p => p.key === packKey);
      if (!pack) { ui.notifications?.warn("Pack not found."); return; }
      const powerKeys = Array.isArray(pack.powers) ? pack.powers : [];
      const allPowers = game.bbttcc?.api?.raid?.bossPowers ?? [];
      const sys = this.actor.system?.system ?? this.actor.system;
      let parsed = [];
      try { parsed = JSON.parse(sys.raidProfile?.behaviorsRaw || "[]"); } catch { parsed = []; }
      if (!Array.isArray(parsed)) parsed = [];
      let added = 0;
      for (const pk of powerKeys) {
        const p = allPowers.find(x => x.key === pk);
        if (!p) continue;
        const id = p.behavior?.id ?? p.key;
        if (parsed.some(b => (b.id ?? b.key) === id)) continue;
        parsed.push(foundry.utils.deepClone(p.behavior ?? { id, label: p.label }));
        added++;
      }
      await this.actor.update({ "system.raidProfile.behaviorsRaw": JSON.stringify(parsed, null, 2) });
      // Clearer message — if 0 were added, surface why (everything was
      // already installed, e.g. from a starter-chip seed). If some were
      // added, say how many of the pack's total powers landed.
      if (added === 0) {
        ui.notifications?.info(`"${pack.label}" — all ${powerKeys.length} powers were already installed. See the Behaviors tab.`);
      } else if (added < powerKeys.length) {
        ui.notifications?.info(`Applied "${pack.label}": ${added} new behavior(s) added (${powerKeys.length - added} already installed).`);
      } else {
        ui.notifications?.info(`Applied "${pack.label}": ${added} new behavior(s) added.`);
      }
    }

    static async _onFtBossNormalize(event, target) {
      const sys = this.actor.system?.system ?? this.actor.system;
      let parsed = [];
      try { parsed = JSON.parse(sys.raidProfile?.behaviorsRaw || "[]"); } catch { parsed = []; }
      if (!Array.isArray(parsed)) parsed = [];
      // Deduplicate by id, normalize phase strings, drop empty entries
      const seen = new Set();
      const cleaned = [];
      for (const b of parsed) {
        if (!b || typeof b !== "object") continue;
        const id = String(b.id ?? b.key ?? "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const phase = String(b.phase ?? "").trim() || "round_end";
        cleaned.push({ ...b, id, phase });
      }
      await this.actor.update({ "system.raidProfile.behaviorsRaw": JSON.stringify(cleaned, null, 2) });
      ui.notifications?.info(`Normalized: ${cleaned.length} behaviors.`);
    }

    static async _onFtBossManeuverAdd(event, target) {
      const input = this.element?.querySelector("input[data-role=maneuver-key-input]");
      const key = String(input?.value ?? "").trim();
      if (!key) { ui.notifications?.warn("Enter a maneuver key."); return; }
      const sys = this.actor.system?.system ?? this.actor.system;
      const list = Array.isArray(sys.doctrine?.maneuverKeys) ? [...sys.doctrine.maneuverKeys] : [];
      if (list.includes(key)) { ui.notifications?.warn(`Maneuver ${key} already present.`); return; }
      list.push(key);
      if (input) input.value = "";
      return this.actor.update({ "system.doctrine.maneuverKeys": list });
    }

    static async _onFtBossManeuverRemove(event, target) {
      const key = target.closest("[data-maneuver-key]")?.dataset?.maneuverKey;
      if (!key) return;
      const sys = this.actor.system?.system ?? this.actor.system;
      const list = (Array.isArray(sys.doctrine?.maneuverKeys) ? sys.doctrine.maneuverKeys : []).filter(k => k !== key);
      return this.actor.update({ "system.doctrine.maneuverKeys": list });
    }

    // Slice 3 (2026-05-11): curated maneuver picker. Replaces the free-text
    // input. Filters the EFFECTS catalog by tier band and raidType. Untiered
    // legacy entries are a selectable bucket. Writes to doctrine.maneuverKeys
    // with dedup; reuses the same array contract _onFtBossManeuverRemove uses.
    static async _onFtBossManeuverPick(event, target) {
      event?.preventDefault?.();
      const DialogV2 = foundry.applications.api?.DialogV2;
      if (!DialogV2) { ui.notifications?.error("DialogV2 unavailable."); return; }

      const actor = this.actor;
      const sysData = actor.system?.system ?? actor.system ?? {};
      const bossTier = Math.max(1, Math.min(4, Number(sysData?.integrity?.tier) || 1));
      const bossApi = game.bbttcc?.api?.raid ?? {};
      const EFFECTS = bossApi.EFFECTS ?? {};
      const existing = new Set(Array.isArray(sysData?.doctrine?.maneuverKeys) ? sysData.doctrine.maneuverKeys : []);

      // Build the same maneuverOptions shape used by _prepareContext, but
      // keyed for inline use in the dialog. (Duplicated here intentionally —
      // _prepareContext fires per-render, the dialog needs a snapshot too.)
      const _norm = s => String(s || "").trim().toLowerCase();
      const all = Object.entries(EFFECTS)
        .filter(([_, e]) => (e?.kind ?? "maneuver") === "maneuver")
        .map(([k, e]) => {
          const tier = Number(e?.tier);
          const rt = Array.isArray(e?.raidTypes) ? [...new Set(e.raidTypes.map(_norm).filter(Boolean))] : [];
          const opSrc = e?.opCosts ?? e?.cost ?? {};
          const opMerged = {};
          for (const [k2, v] of Object.entries(opSrc)) {
            const nk = _norm(k2); const nv = Number(v) || 0;
            if (nv) opMerged[nk] = Math.max(opMerged[nk] || 0, nv);
          }
          return {
            key: k,
            label: e?.label ?? k,
            tier: Number.isFinite(tier) ? tier : null,
            tierBucket: (tier >= 1 && tier <= 4) ? `T${tier}` : "untiered",
            raidTypes: rt,
            opSummary: Object.entries(opMerged).map(([k2, v]) => `${v} ${k2}`).join(" · "),
            text: String(e?.text ?? "").slice(0, 160)
          };
        })
        .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.label.localeCompare(b.label));

      if (!all.length) {
        ui.notifications?.warn("No maneuvers in game.bbttcc.api.raid.EFFECTS — is bbttcc-raid loaded?");
        return;
      }

      const rtSet = new Set();
      for (const m of all) for (const rt of m.raidTypes) rtSet.add(rt);
      const raidTypeOpts = [...rtSet].sort();

      // The two filter dropdowns + the maneuver select. Filter state is held
      // on local vars; rebuildSelect rewrites the <select> innerHTML in place.
      let filterTier = "match";  // match = ≤ bossTier+1 (default — most useful)
      let filterRT   = "any";

      const renderOpt = (m) => {
        const cost = m.opSummary ? ` · ${m.opSummary}` : "";
        const dup  = existing.has(m.key) ? " ✓" : "";
        return `<option value="${ftEscapeHtml(m.key)}">${ftEscapeHtml(m.label)} — ${m.tierBucket}${cost}${dup}</option>`;
      };

      const applyFilters = () => {
        const within = (m) => {
          if (filterTier === "all") return true;
          if (filterTier === "untiered") return m.tierBucket === "untiered";
          if (filterTier === "match") return m.tier == null || m.tier <= bossTier + 1;
          if (filterTier.startsWith("T")) return `T${m.tier}` === filterTier;
          return true;
        };
        const rtOk = (m) => filterRT === "any" || m.raidTypes.includes(filterRT);
        return all.filter(m => within(m) && rtOk(m));
      };

      const buildSelect = () => {
        const list = applyFilters();
        if (!list.length) return `<option value="" disabled>No maneuvers match this filter.</option>`;
        // Group within filter result by tier bucket.
        const order = ["T1", "T2", "T3", "T4", "untiered"];
        const grouped = {};
        for (const m of list) (grouped[m.tierBucket] ??= []).push(m);
        return order
          .filter(b => grouped[b]?.length)
          .map(b => {
            const label = (b === "untiered") ? "Untiered (legacy)" : b;
            return `<optgroup label="${label}">${grouped[b].map(renderOpt).join("")}</optgroup>`;
          })
          .join("");
      };

      let pickedKey = null;

      const tierOptions = `
        <option value="match" selected>Boss-reach (≤ T${bossTier + 1}) + untiered</option>
        <option value="T1">T1</option>
        <option value="T2">T2</option>
        <option value="T3">T3</option>
        <option value="T4">T4</option>
        <option value="untiered">Untiered (legacy)</option>
        <option value="all">All</option>`;

      const rtOptionsHtml = `<option value="any" selected>Any raidType</option>` +
        raidTypeOpts.map(rt => `<option value="${ftEscapeHtml(rt)}">${ftEscapeHtml(rt)}</option>`).join("");

      const dialog = new DialogV2({
        window: { title: `Add Raid Maneuver — ${actor.name}`, resizable: true },
        position: { width: 720, height: 640 },
        content: `
          <form style="display:flex;flex-direction:column;height:100%;min-height:0;">
            <p style="margin:0 0 0.45rem 0;font-size:0.82rem;opacity:0.85;flex:0 0 auto;">
              Boss tier <b>T${bossTier}</b> · ${all.length} maneuvers in catalog · ✓ already on doctrine
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;flex:0 0 auto;">
              <label style="font-size:0.78rem;display:flex;flex-direction:column;gap:0.15rem;">Tier
                <select name="tier">${tierOptions}</select></label>
              <label style="font-size:0.78rem;display:flex;flex-direction:column;gap:0.15rem;">Raid Type
                <select name="rt">${rtOptionsHtml}</select></label>
            </div>
            <select name="key" size="20" style="width:100%;flex:1 1 auto;min-height:300px;overflow-y:auto;">${buildSelect()}</select>
          </form>`,
        buttons: [
          { action: "confirm", label: "Add", default: true,
            callback: (_e, _b, dlg) => { pickedKey = dlg.element.querySelector("select[name=key]")?.value || null; } },
          { action: "cancel", label: "Cancel", callback: () => { pickedKey = null; } }
        ],
        rejectClose: false
      });

      await dialog.render(true);
      try {
        const root = dialog.element;
        const tierSel = root?.querySelector("select[name=tier]");
        const rtSel   = root?.querySelector("select[name=rt]");
        const keySel  = root?.querySelector("select[name=key]");
        const rebuild = () => {
          filterTier = tierSel?.value || "match";
          filterRT   = rtSel?.value   || "any";
          if (keySel) keySel.innerHTML = buildSelect();
        };
        tierSel?.addEventListener("change", rebuild);
        rtSel?.addEventListener("change", rebuild);
      } catch (e) { console.warn("[boss-maneuver-pick] filter wire failed", e); }

      if (typeof dialog.wait === "function") await dialog.wait().catch(() => null);
      else await new Promise(r => { const t = () => dialog.rendered ? setTimeout(t, 100) : r(); t(); });

      if (!pickedKey) return;
      if (existing.has(pickedKey)) { ui.notifications?.warn(`Maneuver ${pickedKey} already on doctrine.`); return; }
      const list = [...existing, pickedKey];
      await this.actor.update({ "system.doctrine.maneuverKeys": list });
      ui.notifications?.info(`Added maneuver: ${pickedKey}.`);
    }

    // Phase 8 polish (2026-05-10): explicit picker for adding a `power` item
    // to the manifestation library, so users have a non-drag-drop path.
    static async _onFtBossManifestPick(event, target) {
      event?.preventDefault?.();
      const DialogV2 = foundry.applications.api?.DialogV2;
      if (!DialogV2) { ui.notifications?.error("DialogV2 unavailable."); return; }

      const actor = this.actor;
      const sysData = actor.system?.system ?? actor.system ?? {};
      const bossTier = Math.max(1, Math.min(4, Number(sysData?.integrity?.tier) || 1));
      const bossTags = new Set(
        (Array.isArray(sysData?.identity?.archetypeTags) ? sysData.identity.archetypeTags : [])
          .map(t => String(t || "").trim().toLowerCase()).filter(Boolean)
      );

      // Collect all `power` items across compendia + world. Capture tier + tags.
      // Tags: prefer flags.fourththing.bossArchetypeTags[]; fall back to
      // system.tags[]; empty array → "untagged" pool.
      const candidates = [];
      const pushCand = (d, packLabel) => {
        const itemSys = d.system ?? {};
        const flagTags = d.flags?.fourththing?.bossArchetypeTags;
        const sysTags  = itemSys.tags;
        const rawTags  = Array.isArray(flagTags) && flagTags.length ? flagTags
                        : (Array.isArray(sysTags) ? sysTags : []);
        const tags = rawTags.map(t => String(t || "").trim().toLowerCase()).filter(Boolean);
        const tier = Math.max(1, Math.min(4, Number(itemSys?.manifestation?.tier) || Number(itemSys?.tier) || 1));
        candidates.push({
          uuid: d.uuid, name: d.name, img: d.img, pack: packLabel,
          tier, tags
        });
      };
      for (const pack of game.packs) {
        if (pack.documentName !== "Item") continue;
        try {
          const docs = await pack.getDocuments();
          for (const d of docs) if (d.type === "power") pushCand(d, pack.collection);
        } catch (e) { console.warn(`[boss-manifest-pick] pack ${pack.collection} failed`, e); }
      }
      for (const d of game.items) if (d.type === "power") pushCand(d, "(world)");
      candidates.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

      if (!candidates.length) {
        ui.notifications?.warn("No `power` (manifestation) items found in compendia or world.");
        return;
      }

      // Bucket by archetype-tag relevance. Tier cap is boss tier + 1 (so the
      // GM can drop in a Reach option) — items above that fall into the "Other"
      // bucket and only appear when Show All is checked.
      const tierCap = bossTier + 1;
      const buckets = { match: [], universal: [], untagged: [], other: [] };
      for (const c of candidates) {
        const overTier = c.tier > tierCap;
        const tagged   = c.tags.length > 0;
        const isUniversal = c.tags.includes("boss-universal");
        const tagOverlap  = bossTags.size && c.tags.some(t => bossTags.has(t));
        if (overTier) { buckets.other.push(c); continue; }
        if (tagOverlap) buckets.match.push(c);
        else if (isUniversal) buckets.universal.push(c);
        else if (!tagged) buckets.untagged.push(c);
        else buckets.other.push(c);
      }

      // Slice 2 polish (2026-05-12): native <select size="10"> wasn't reliably
      // rendering its option list inside DialogV2 (cramped on Mac/Safari, blank
      // on some skins). Replaced with a div-based clickable row list — same
      // data, more controllable styling, and the + Add buttons live ON the
      // rows themselves so the GM can stage multiple adds without closing.
      const bossTagsLabel = bossTags.size
        ? `[${[...bossTags].slice(0, 4).join(", ")}${bossTags.size > 4 ? "…" : ""}]`
        : "(none set on this boss)";

      const renderRow = (c, groupKey, inLibrary) => `
        <div class="ft-boss-pick-row" data-uuid="${c.uuid}" data-group="${groupKey}">
          <img src="${c.img || "icons/svg/mystery-man.svg"}" class="ft-boss-pick-row-img" alt=""/>
          <span class="ft-manifest-chip ft-tier-pill ft-tier-${c.tier} ft-boss-pick-row-tier">T${c.tier}</span>
          <span class="ft-boss-pick-row-name">${ftEscapeHtml(c.name)}</span>
          ${c.tags.length ? `<span class="ft-boss-pick-row-tags">${c.tags.slice(0,3).map(t => `<span class="ft-tag-chip">${ftEscapeHtml(t)}</span>`).join("")}${c.tags.length > 3 ? `<span class="ft-tag-chip ft-tag-chip-more">+${c.tags.length - 3}</span>` : ""}</span>` : ""}
          <button type="button" class="ft-mini-btn ft-boss-pick-add" data-uuid="${c.uuid}"${inLibrary ? " disabled" : ""}>${inLibrary ? "✓ In Library" : "+ Add"}</button>
        </div>`;

      const renderGroupBlock = (label, list, groupKey, libSet) => {
        if (!list.length) return "";
        return `
          <div class="ft-boss-pick-group">
            <div class="ft-boss-pick-group-label">${ftEscapeHtml(label)} <span class="ft-boss-pick-group-count">(${list.length})</span></div>
            ${list.map(c => renderRow(c, groupKey, libSet.has(c.uuid))).join("")}
          </div>`;
      };

      const buildList = (showAll, libSet) => {
        const blocks = [
          renderGroupBlock("Archetype Matches", buckets.match, "match", libSet),
          renderGroupBlock("Universal",         buckets.universal, "universal", libSet),
          renderGroupBlock("Untagged",          buckets.untagged, "untagged", libSet)
        ];
        if (showAll) blocks.push(renderGroupBlock("Other / Out of Tier", buckets.other, "other", libSet));
        const inner = blocks.filter(Boolean).join("");
        return inner || `<div class="ft-boss-pick-empty">No candidates match the current filter.</div>`;
      };

      // Live library snapshot — updated on each + Add click.
      const initialLib = Array.isArray(actor.system?.manifestations?.library) ? [...actor.system.manifestations.library] : [];
      const liveLib = new Set(initialLib);

      const dialog = new DialogV2({
        window: { title: `Add Manifestation — ${actor.name}` },
        content: `
          <div class="ft-boss-pick-dialog">
            <p style="margin:0 0 0.35rem 0;font-size:0.82rem;opacity:0.9;">
              Boss tier <b>T${bossTier}</b> · archetype tags ${ftEscapeHtml(bossTagsLabel)}
            </p>
            <p style="margin:0 0 0.5rem 0;font-size:0.74rem;opacity:0.65;">
              Click <b>+ Add</b> on a row to add it to the library. Library updates immediately — add as many as you like, then close.
            </p>
            <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.8rem;margin:0 0 0.5rem 0;">
              <input type="checkbox" name="showAll"/>Show all (include out-of-tier and tag-mismatched)
            </label>
            <div class="ft-boss-pick-row-list" data-role="pick-list">${buildList(false, liveLib)}</div>
          </div>`,
        buttons: [
          { action: "done", label: "Done", default: true, callback: () => {} }
        ],
        rejectClose: false
      });

      await dialog.render(true);

      // Wire interactions: Show All toggles the list rebuild; each + Add commits
      // immediately and disables the row. The list refresh preserves liveLib
      // state so already-added rows stay marked.
      try {
        const root = dialog.element;
        const listEl = root?.querySelector("[data-role=pick-list]");
        const cb = root?.querySelector("input[name=showAll]");
        const rebuild = () => { if (listEl) listEl.innerHTML = buildList(!!cb?.checked, liveLib); };
        cb?.addEventListener("change", rebuild);
        // Delegated click handler on the row list — survives rebuilds.
        listEl?.addEventListener("click", async (ev) => {
          const btn = ev.target?.closest?.(".ft-boss-pick-add");
          if (!btn || btn.disabled) return;
          const uuid = btn.dataset.uuid;
          if (!uuid || liveLib.has(uuid)) return;
          liveLib.add(uuid);
          // Optimistic UI flip before the actor write resolves.
          btn.disabled = true;
          btn.textContent = "✓ In Library";
          try {
            await actor.update({ "system.manifestations.library": [...liveLib] });
          } catch (e) {
            console.warn("[boss-manifest-pick] add failed", e);
            liveLib.delete(uuid);
            btn.disabled = false;
            btn.textContent = "+ Add";
            ui.notifications?.error("Could not add manifestation. See console.");
          }
        });
      } catch (e) { console.warn("[boss-manifest-pick] wire failed", e); }

      if (typeof dialog.wait === "function") await dialog.wait().catch(() => null);
      else await new Promise(r => { const t = () => dialog.rendered ? setTimeout(t, 100) : r(); t(); });
    }

    // Boss Sheet Polish (2026-05-12): wire the canonical V2 Manifestation
    // Wizard to the boss sheet. Opens the wizard in author-only mode
    // (actor=null) so the engine creates a world Item rather than embedding
    // on the boss (the boss library is a UUID array, not embedded items).
    // The resulting Item's UUID is auto-appended to system.manifestations.library.
    // Starter defaults to "working" — bosses are adversarial Workings-casters;
    // the actor=null mode bypasses the non-TCC restraint gate on Workings.
    static async _onFtBossManifestCreate(event, target) {
      event?.preventDefault?.();
      const actor = this.actor;
      const wiz = game.fourththing?.wizardV2;
      if (typeof wiz !== "function") {
        ui.notifications?.error("Manifestation Wizard V2 unavailable (game.fourththing.wizardV2 is not exposed).");
        return;
      }
      // Use the dedicated folder if the GM has authored one for boss content;
      // otherwise drop at world-items root. Folder lookup is best-effort by name.
      const folder = game.folders?.find?.(f =>
        f.type === "Item" && /boss\s*manifestations?/i.test(f.name || "")) ?? null;
      const created = await wiz(null, { kind: "power", starter: "working", targetFolder: folder });
      if (!created) return; // user cancelled
      const lib = Array.isArray(actor.system?.manifestations?.library)
        ? [...actor.system.manifestations.library] : [];
      if (!lib.includes(created.uuid)) {
        lib.push(created.uuid);
        await actor.update({ "system.manifestations.library": lib });
      }
      ui.notifications?.info(`${actor.name}: added "${created.name}" to manifestation library.`);
    }

    // Boss Sheet Slice 2 (2026-05-11): invoke a manifestation from the curated
    // library. Resolves the UUID, opens a slim boss-flavored cast dialog, then
    // calls the shared castManifestation engine. Boss state (Surge pool,
    // integrity.tier) is read by _ftCasterPool/_ftCasterTier inside the engine.
    static async _onFtBossManifestCast(event, target) {
      event?.preventDefault?.();
      const uuid = target?.dataset?.uuid;
      if (!uuid) return;
      const item = await fromUuid(uuid).catch(() => null);
      if (!item || item.type !== "power") {
        ui.notifications?.warn("Manifestation not found (broken UUID?).");
        return;
      }
      const actor = this.actor;
      const sysData = actor.system?.system ?? actor.system ?? {};
      const bossTier = Math.max(1, Math.min(4, Number(sysData?.integrity?.tier) || 1));
      const itemSys  = item.system ?? {};
      const mf       = ftNormalizeManifestationData(itemSys, "power");
      const manTier  = Math.max(1, Math.min(4, Number(mf?.tier) || 1));
      const intent   = itemSys.intent   ?? "presence";
      const channel  = itemSys.channel  ?? "soul";
      const sephirah = itemSys.sephirah ?? "tiferet";
      const stability = mf?.stability ?? "instant";
      const stabilityLabel = FT.MANIFESTATION_STABILITIES?.[stability]?.label ?? ftCap(stability);
      const surge = sysData.manifestations?.surge ?? { current: 0, max: 6 };
      const reachBy = manTier - bossTier;
      const baseClarity = FT.MANIFESTATION_TIERS?.[manTier]?.clarityCost ?? 1;
      const dcDefault = ftTierCastDC(manTier);

      const mkOpts = (map, current) =>
        Object.entries(map).map(([k, v]) =>
          `<option value="${k}"${k === current ? " selected" : ""}>${v.label}</option>`
        ).join("");

      const reachBlock = (reachBy === 1) ? `
        <div class="ft-cast-field ft-cast-span-2 ft-reach-block">
          <label>Reach — manifestation is <b>T${manTier}</b>, boss is <b>T${bossTier}</b></label>
          <div class="ft-mode-row">
            <label class="ft-mode-opt"><input type="radio" name="reachPath" value="surge" checked/>
              <b>Surge</b> <span>cast at T${manTier}; misfire rolls on T${manTier} column</span></label>
          </div>
        </div>`
        : (reachBy > 1) ? `
        <div class="ft-cast-field ft-cast-span-2 ft-reach-block ft-reach-fail">
          <label>Out of reach</label>
          <p class="ft-prev-align-note" style="color:#ff8a8a">Manifestation is T${manTier}, boss is T${bossTier}. Reach only allows +1 tier.</p>
        </div>` : "";

      const hasArea = mf?.area?.shape && mf.area.shape !== "none";
      const hasSaveShape = mf?.resolution?.shape === "save";
      const aoeBlock = hasArea ? `
        <div class="ft-cast-field ft-cast-span-2 ft-aoe-opts-block">
          ${hasSaveShape ? `<label style="display:flex;gap:0.5rem;align-items:center;cursor:pointer;color:#a0d4ff;margin-bottom:0.2rem">
            <input type="checkbox" name="useAoeSavePrompts"/>
            <span>⚖ Prompt each target for their save</span>
          </label>` : ""}
          <label style="display:flex;gap:0.5rem;align-items:center;cursor:pointer;color:#a0d8a0">
            <input type="checkbox" name="aoeApplyConfirm"/>
            <span>⚔ Pause before applying AoE damage (Apply All)</span>
          </label>
        </div>` : "";

      const ascendantDisabled = bossTier < 3 ? "disabled" : "";

      const content = `
        <div class="ft-cast-dialog ft-boss-cast-dialog">
          <div class="ft-cast-header-row">
            <span class="ft-manifest-chip ft-tier-pill ft-tier-${manTier}">T${manTier}</span>
            <span class="ft-manifest-chip">${stabilityLabel}</span>
            <span class="ft-manifest-chip" data-tooltip="Base Surge cost (Clarity stand-in for boss casts).">Base ${baseClarity} Surge</span>
            <span class="ft-manifest-chip">Surge ${surge.current}/${surge.max}</span>
          </div>
          <div class="ft-cast-grid">
            <div class="ft-cast-field ft-cast-span-2">
              <label>Mode (stance) — shifts Surge cost &amp; misfire</label>
              <div class="ft-mode-row">
                <label class="ft-mode-opt"><input type="radio" name="castMode" value="hermetic" checked/>
                  <b>Hermetic</b> <span>+1 Surge · misfire d10 −2</span></label>
                <label class="ft-mode-opt"><input type="radio" name="castMode" value="chaos"/>
                  <b>Chaos</b> <span>−1 Surge · misfire d10 +2</span></label>
                <label class="ft-mode-opt"><input type="radio" name="castMode" value="ascendant" ${ascendantDisabled}/>
                  <b>Ascendant</b> <span>no Surge · no misfire${bossTier < 3 ? " · <em>T3+ boss</em>" : ""}</span></label>
              </div>
            </div>
            ${reachBlock}
            <div class="ft-cast-field"><label>Intent</label>
              <select name="intent">${mkOpts(FT.INTENTS, intent)}</select></div>
            <div class="ft-cast-field"><label>Channel</label>
              <select name="channel">${mkOpts(FT.CHANNELS, channel)}</select></div>
            <div class="ft-cast-field"><label>Sephirah</label>
              <select name="sephirah">${mkOpts(FT.SEPHIROTH, sephirah)}</select></div>
            <div class="ft-cast-field">
              <label>Difficulty (DC) <span style="opacity:0.55;font-weight:400;font-size:0.78em">— T${manTier} baseline ${dcDefault}</span></label>
              <input type="number" name="difficulty" value="${dcDefault}" min="5" max="30"/></div>
          </div>
          ${aoeBlock}
          ${(mf?.signature || mf?.thirdThing) ? `
          <div class="ft-manifest-costbox">
            <div class="ft-prev-label">Identity of the manifestation</div>
            ${mf.signature ? `<div class="ft-prev-align-note"><b>Signature:</b> ${ftEscapeHtml(mf.signature)}</div>` : ""}
            ${mf.thirdThing ? `<div class="ft-prev-align-note"><b>Third Thing:</b> ${ftEscapeHtml(mf.thirdThing)}</div>` : ""}
          </div>` : ""}
        </div>`;

      new Dialog({
        title:   `Boss Invoke: ${item.name}`,
        content,
        buttons: {
          cast: {
            icon:  "<i class='fas fa-magic'></i>",
            label: "Invoke",
            callback: async (html) => {
              const dc   = parseInt(html.find("[name='difficulty']").val()) || dcDefault;
              const selI = html.find("[name='intent']").val()   || intent;
              const selC = html.find("[name='channel']").val()  || channel;
              const selS = html.find("[name='sephirah']").val() || sephirah;
              const mode = html.find("[name='castMode']:checked").val() || "hermetic";
              const reachPathVal = html.find("[name='reachPath']:checked").val() || "";
              const targetTokens = Array.from(game.user?.targets ?? []);
              const targetActor  = targetTokens[0]?.actor ?? null;
              const useAoeSavePrompts = html.find("[name='useAoeSavePrompts']").is(":checked") === true;
              const aoeApplyConfirm   = html.find("[name='aoeApplyConfirm']").is(":checked")   === true;
              return castManifestation(actor, item, {
                intent: selI, channel: selC, sephirah: selS,
                label: item.name, difficulty: dc, mode, reachPath: reachPathVal,
                target: targetActor,
                useAoeSavePrompts, aoeApplyConfirm
              });
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "cast"
      }).render(true);
    }

    // Boss sheet polish (2026-05-11): remove a manifestation entry from the
    // curated library. UUID-keyed because library is an array of UUIDs.
    static async _onFtBossManifestRemove(event, target) {
      event?.preventDefault?.();
      const uuid = target?.dataset?.uuid;
      if (!uuid) return;
      const lib = Array.isArray(this.actor.system?.manifestations?.library) ? [...this.actor.system.manifestations.library] : [];
      const next = lib.filter(u => u !== uuid);
      if (next.length === lib.length) return; // nothing to remove
      await this.actor.update({ "system.manifestations.library": next });
    }

    // Phase 8 polish: inline phase dropdown on behaviors table. Reads the
    // chosen phase from the select, parses the existing behaviorsRaw JSON,
    // updates the matching index, re-stringifies.
    static async _onFtBossBehaviorPhaseSet(event, target) {
      const idx = Number(target?.dataset?.behaviorIdx);
      if (!Number.isFinite(idx)) return;
      const valueRaw = target?.value ?? "any";
      const value = (valueRaw === "any") ? "any" : Number(valueRaw);
      const sys = this.actor.system?.system ?? this.actor.system;
      let parsed;
      try { parsed = JSON.parse(sys.raidProfile?.behaviorsRaw || "[]"); } catch { parsed = []; }
      if (!Array.isArray(parsed) || !parsed[idx]) return;
      parsed[idx].phase = value;
      return this.actor.update({ "system.raidProfile.behaviorsRaw": JSON.stringify(parsed, null, 2) });
    }

    // B13.C — 2026-05-17. Opens the Boss Builder pre-filled with this
    // boss's current state so the GM can tweak before creating a new
    // actor. Doesn't modify the source boss.
    static async _onFtBossDuplicate(_event, _target) {
      try {
        const api = globalThis.BBTTCC_BossBuilder
                 ?? game.bbttcc?.api?.bossBuilder;
        if (typeof api?.seedFromActor !== "function" || typeof api?.open !== "function") {
          return ui.notifications?.warn?.("Boss Builder not available — cannot duplicate.");
        }
        const seed = api.seedFromActor(this.actor);
        if (!seed) return ui.notifications?.warn?.("Could not build a duplicate seed for this boss.");
        await api.open({ seed });
      } catch (err) {
        console.error("[fourththing] _onFtBossDuplicate failed", err);
        ui.notifications?.error?.("Could not open the Boss Builder for duplication.");
      }
    }

    get title() { return this.actor?.name ?? "Boss"; }
  }

  // ── Effect categorize/sort/group helper (shared by character + item sheets) ──
  // Looks up each effect's primary change-key in the fourththing AE registry
  // (game.fourththing.ae) to derive a category, sorts by [category, name],
  // and produces both a flat sorted list AND a grouped {category, effects[]}[]
  // shape so templates can render section headers without an extra pass.
  // Effects with no change rows fall under "Empty"; unregistered keys fall
  // under "Other / Custom".
  function _ftCategorizeEffects(rows) {
    const reg = game.fourththing?.ae;
    const get = reg?.get ? reg.get.bind(reg) : () => null;
    const CAT_ORDER = [
      "Attributes", "Skills", "Magic / Manifestation", "Manifestation Discipline",
      "Manifestation Item", "Derived Stats", "Resources", "Defenses", "Conditions",
      "Last Stand", "Blood Debt", "Radiation", "Actions", "Details",
      "Item Flags", "Faction", "Hex / Strategic", "Other / Custom", "Empty"
    ];
    const catRank = (c) => {
      const i = CAT_ORDER.indexOf(c);
      return i < 0 ? CAT_ORDER.length : i;
    };
    const out = rows.map(r => {
      const firstKey = r._primaryKey || "";
      let cat;
      if (!firstKey) cat = "Empty";
      else {
        const meta = get(firstKey);
        cat = meta?.category || "Other / Custom";
      }
      return { ...r, category: cat };
    });
    out.sort((a, b) => {
      const ra = catRank(a.category), rb = catRank(b.category);
      if (ra !== rb) return ra - rb;
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    const groups = [];
    let cur = null;
    for (const r of out) {
      if (!cur || cur.category !== r.category) {
        cur = { category: r.category, effects: [] };
        groups.push(cur);
      }
      cur.effects.push(r);
    }
    return { flat: out, groups };
  }

  // ── Item Active Effect helpers (shared by Power/Weapon/Feature sheets) ──
  // Builds the context shape the item-effects.hbs partial expects, and the
  // four action handlers wired through DEFAULT_OPTIONS.actions. The change-key
  // input on the spawned ActiveEffectConfig dialog gets the typeahead via the
  // ae-key-picker.enhancer.js render hook — no extra wiring needed here.
  function _ftBuildItemEffectsContext(item) {
    const rows = [];
    const effs = (item?.effects?.contents) ? item.effects.contents : [];
    for (const e of effs) {
      const changes = Array.isArray(e.changes) ? e.changes : [];
      const changeTags = changes.slice(0, 6).map(c => {
        const key = String(c?.key || "").trim();
        const v   = String(c?.value ?? "");
        const short = key.split(".").slice(-2).join(".") || "(unset)";
        return {
          text: `${short} ${v ? "= " + v : ""}`.trim(),
          full: `${key}${v ? "  =  " + v : ""}`
        };
      });
      rows.push({
        id:       e.id,
        name:     e.name || "(unnamed effect)",
        icon:     e.icon || e.img || "icons/svg/aura.svg",
        disabled: !!e.disabled,
        changeTags,
        _primaryKey: changes[0]?.key || ""
      });
    }
    return _ftCategorizeEffects(rows);
  }

  async function _ftOnAddItemEffect(event, target) {
    const item = this.item;
    if (!item) return;
    const created = await item.createEmbeddedDocuments("ActiveEffect", [{
      name:     "New Effect",
      icon:     "icons/svg/aura.svg",
      changes:  [],
      disabled: false,
      flags:    { fourththing: { source: "manual" } }
    }]);
    if (created[0]) created[0].sheet?.render(true);
  }

  function _ftEffectIdFrom(target) {
    const row = target?.closest?.("[data-effect-id]");
    return row?.dataset?.effectId || target?.dataset?.effectId || null;
  }

  async function _ftOnEditItemEffect(event, target) {
    const item = this.item;
    const id   = _ftEffectIdFrom(target);
    const eff  = item?.effects?.get(id);
    if (eff) eff.sheet?.render(true);
  }

  async function _ftOnDeleteItemEffect(event, target) {
    const item = this.item;
    const id   = _ftEffectIdFrom(target);
    if (!item || !id) return;
    const eff = item.effects.get(id);
    if (!eff) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete Effect" },
      content: `<p>Delete <strong>${foundry.utils.escapeHTML(eff.name)}</strong>?</p>`
    }).catch(() => false);
    if (ok) await eff.delete();
  }

  async function _ftOnToggleItemEffect(event, target) {
    const item = this.item;
    const id   = _ftEffectIdFrom(target);
    const eff  = item?.effects?.get(id);
    if (!eff) return;
    await eff.update({ disabled: !eff.disabled });
  }

  // ── FourthThingPowerSheet ─────────────────────────────────────────────────
  class FourthThingPowerSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    static DEFAULT_OPTIONS = {
      classes:  ["fourththing", "sheet", "item", "power"],
      position: { width: 560, height: 640 },
      window:   { resizable: true },
      actions:  { ftEditItemImg: _ftOnEditItemImg, ftToggleManifestMode: _ftOnToggleManifestMode,
                  ftAddItemEffect: _ftOnAddItemEffect, ftEditItemEffect: _ftOnEditItemEffect,
                  ftDeleteItemEffect: _ftOnDeleteItemEffect, ftToggleItemEffect: _ftOnToggleItemEffect },
      form:     { submitOnChange: true, closeOnSubmit: false }
    };

    static PARTS = {
      sheet: { template: "systems/fourththing/templates/items/power-sheet.hbs" }
    };

    async _prepareContext(options) {
      const system = foundry.utils.deepClone(this.item.toObject().system ?? {});
      system.effect ??= "";
      system.flavor ??= "";
      system.manifestation = ftNormalizeManifestationData(system, "power");
      system.damageRoll    = ftNormalizeDamageRoll(system);
      const { intent, channel, sephirah } = system;
      const sheetMode = _ftReadManifestMode(this.item);
      // Build an object map of currently-selected condition keys so the
      // template can render checkbox `checked` state via `{{lookup … key}}`
      // without needing a custom `includes` helper.
      const selectedStates = Array.isArray(system.manifestation.appliedStates?.states)
        ? Object.fromEntries(system.manifestation.appliedStates.states.map(k => [k, true]))
        : {};
      // Per-condition save-attribute override rows (one per CHECKED state).
      // The advanced panel only renders when ≥1 state is selected.
      const overridesMap = system.manifestation.appliedStates?.saveAttributeOverrides ?? {};
      const overrideRows = (system.manifestation.appliedStates?.states ?? []).map(k => ({
        key: k,
        label: FT.CONDITIONS?.[k]?.label ?? k,
        color: FT.CONDITIONS?.[k]?.color ?? "#aaa",
        override: overridesMap[k] ?? ""
      }));
      return {
        item:       this.item,
        system,
        SEPHIROTH:  FT.SEPHIROTH,
        INTENTS:    FT.INTENTS,
        CHANNELS:   FT.CHANNELS,
        MODES:      FT.MODES,
        DAMAGE_TYPES: FT.DAMAGE_TYPES,
        CONDITIONS: FT.CONDITIONS,
        APPLIED_STATE_DURATIONS: { "1-round": "1 round", "2-rounds": "2 rounds", "3-rounds": "3 rounds", scene: "Scene", "until-saved": "Until saved" },
        appliedStatesSelected: selectedStates,
        appliedStatesOverrideRows: overrideRows,
        MANIFESTATION_FORMS: FT.MANIFESTATION_FORMS,
        MANIFESTATION_FUNCTIONS: FT.MANIFESTATION_FUNCTIONS,
        MANIFESTATION_DURATIONS: FT.MANIFESTATION_DURATIONS,
        MANIFESTATION_STABILITIES: FT.MANIFESTATION_STABILITIES,
        MANIFESTATION_INTERACTIONS: FT.MANIFESTATION_INTERACTIONS,
        MANIFESTATION_COSTS: FT.MANIFESTATION_COSTS,
        MANIFESTATION_SCALES: FT.MANIFESTATION_SCALES,
        // Phase A option lists for the Phase B editor dropdowns.
        DAMAGE_DICE:        ["d4", "d6", "d8", "d10", "d12", "d10x10"],
        DAMAGE_OPS:         { damage: "Damage", heal: "Heal", none: "None" },
        AREA_SHAPES:        { none: "None", cone: "Cone", sphere: "Sphere", line: "Line", cube: "Cube", cylinder: "Cylinder" },
        ACTIVATION_TYPES:   { action: "Action", bonus: "Bonus action", reaction: "Reaction", none: "Free / passive" },
        DEFENSES:           FT.DEFENSES,
        TRACKS:             { integrity: "Integrity", stress: "Stress", clarity: "Clarity", noise: "Noise" },
        // Post-cast effect-resolution editor (2026-05-05).
        FACULTIES:          { ...FT.INTENTS, ...FT.CHANNELS },
        RESOLUTION_SHAPES: {
          auto:      "Auto-apply (no second roll)",
          attack:    "Attack — caster vs target defense",
          save:      "Save — target rolls vs cast DC",
          contested: "Contested — both roll, higher wins"
        },
        SAVE_DC_MODES:      { "cast-dc": "Cast DC (default 15)", "fixed": "Fixed" },
        ON_RESOLVE_OUTCOMES: { negate: "Negate damage", half: "Half damage" },
        CONTEST_CASTER_OPTS: { "intent+channel": "Intent + Channel (default)", violence: "Violence", intrigue: "Intrigue", presence: "Presence", body: "Body", mind: "Mind", soul: "Soul" },
        manifestationModeLabel: ftManifestationModeLabel(system, "power"),
        manifestationFrameChips: ftManifestationFrameChips("power", system),
        manifestationCostLabel: ftManifestationCostLabel("power", system),
        alignMod:   ftAlignmentMod(sephirah, intent, channel),
        manifestationCoachHtml: buildManifestationCoachHTML(this.item.actor, { kind: "power", system }),
        isEditable: this.isEditable,
        isEditMode: sheetMode === "edit",
        sheetMode,
        itemEffects:       _ftBuildItemEffectsContext(this.item).flat,
        itemEffectGroups:  _ftBuildItemEffectsContext(this.item).groups,
        effectsSectionOpen: !!game.user?.isGM,
      };
    }

    // The appliedStates condition-grid posts as an object map
    // (`states.<key>: bool`) because Foundry's FormDataExtended
    // expands dotted names into nested objects. Coerce back to the canonical
    // array shape before the doc update — otherwise mergeObject sees
    // object-vs-array and the on-disk data drifts. Array replaces cleanly.
    _prepareSubmitData(event, form, formData) {
      const data = super._prepareSubmitData(event, form, formData);
      const path = "system.manifestation.appliedStates.states";
      const raw  = foundry.utils.getProperty(data, path);
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const keys = Object.entries(raw)
          .filter(([, v]) => v === true || v === "true")
          .map(([k]) => k);
        foundry.utils.setProperty(data, path, keys);
      }
      return data;
    }
  }

  // ── FourthThingWeaponSheet ────────────────────────────────────────────────
  class FourthThingWeaponSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    static DEFAULT_OPTIONS = {
      classes:  ["fourththing", "sheet", "item", "weapon"],
      position: { width: 560, height: 700 },
      window:   { resizable: true },
      actions:  { ftEditItemImg: _ftOnEditItemImg, ftToggleManifestMode: _ftOnToggleManifestMode,
                  ftAddItemEffect: _ftOnAddItemEffect, ftEditItemEffect: _ftOnEditItemEffect,
                  ftDeleteItemEffect: _ftOnDeleteItemEffect, ftToggleItemEffect: _ftOnToggleItemEffect },
      form:     { submitOnChange: true, closeOnSubmit: false }
    };

    static PARTS = {
      sheet: { template: "systems/fourththing/templates/items/weapon-sheet.hbs" }
    };

    async _prepareContext(options) {
      const system = foundry.utils.deepClone(this.item.toObject().system ?? {});
      system.effect ??= "";
      system.flavor ??= "";
      system.range ??= { short: 1, long: 1 };
      system.manifestation = ftNormalizeManifestationData(system, "weapon");
      system.damage ??= { formula: "2d6", attribute: system.intent ?? "violence", type: "kinetic", track: "integrity" };
      system.damage.track ??= "integrity";
      const sheetMode = _ftReadManifestMode(this.item);
      const selectedStates = Array.isArray(system.manifestation.appliedStates?.states)
        ? Object.fromEntries(system.manifestation.appliedStates.states.map(k => [k, true]))
        : {};
      const overridesMap = system.manifestation.appliedStates?.saveAttributeOverrides ?? {};
      const overrideRows = (system.manifestation.appliedStates?.states ?? []).map(k => ({
        key: k,
        label: FT.CONDITIONS?.[k]?.label ?? k,
        color: FT.CONDITIONS?.[k]?.color ?? "#aaa",
        override: overridesMap[k] ?? ""
      }));
      return {
        item:        this.item,
        system,
        INTENTS:     FT.INTENTS,
        DAMAGE_TYPES: FT.DAMAGE_TYPES,
        MANIFESTATION_FORMS: FT.MANIFESTATION_FORMS,
        MANIFESTATION_FUNCTIONS: FT.MANIFESTATION_FUNCTIONS,
        MANIFESTATION_DURATIONS: FT.MANIFESTATION_DURATIONS,
        MANIFESTATION_STABILITIES: FT.MANIFESTATION_STABILITIES,
        MANIFESTATION_INTERACTIONS: FT.MANIFESTATION_INTERACTIONS,
        MANIFESTATION_COSTS: FT.MANIFESTATION_COSTS,
        MANIFESTATION_SCALES: FT.MANIFESTATION_SCALES,
        DEFENSES:           FT.DEFENSES,
        FACULTIES:          { ...FT.INTENTS, ...FT.CHANNELS },
        CONDITIONS:         FT.CONDITIONS,
        RESOLUTION_SHAPES: {
          auto:      "Auto-apply (no second roll)",
          attack:    "Attack — caster vs target defense",
          save:      "Save — target rolls vs cast DC",
          contested: "Contested — both roll, higher wins"
        },
        SAVE_DC_MODES:      { "cast-dc": "Cast DC (default 15)", "fixed": "Fixed" },
        ON_RESOLVE_OUTCOMES: { negate: "Negate damage", half: "Half damage" },
        CONTEST_CASTER_OPTS: { "intent+channel": "Intent + Channel (default)", violence: "Violence", intrigue: "Intrigue", presence: "Presence", body: "Body", mind: "Mind", soul: "Soul" },
        APPLIED_STATE_DURATIONS: { "1-round": "1 round", "2-rounds": "2 rounds", "3-rounds": "3 rounds", scene: "Scene", "until-saved": "Until saved" },
        appliedStatesSelected: selectedStates,
        appliedStatesOverrideRows: overrideRows,
        manifestationModeLabel: ftManifestationModeLabel(system, "weapon"),
        manifestationFrameChips: ftManifestationFrameChips("weapon", system),
        manifestationCostLabel: ftManifestationCostLabel("weapon", system),
        manifestationCoachHtml: buildManifestationCoachHTML(this.item.actor, { kind: "weapon", system }),
        isEditable:  this.isEditable,
        isEditMode:  sheetMode === "edit",
        sheetMode,
        itemEffects:       _ftBuildItemEffectsContext(this.item).flat,
        itemEffectGroups:  _ftBuildItemEffectsContext(this.item).groups,
        effectsSectionOpen: !!game.user?.isGM,
      };
    }

    // Same coercion as the power sheet — appliedStates condition checkboxes
    // post as `states.<key>: bool`, but on-disk shape is an array of selected
    // keys. Without this, mergeObject sees object-vs-array and drifts.
    _prepareSubmitData(event, form, formData) {
      const data = super._prepareSubmitData(event, form, formData);
      const path = "system.manifestation.appliedStates.states";
      const raw  = foundry.utils.getProperty(data, path);
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const keys = Object.entries(raw)
          .filter(([, v]) => v === true || v === "true")
          .map(([k]) => k);
        foundry.utils.setProperty(data, path, keys);
      }
      return data;
    }
  }

  // ── FourthThingFeatureSheet (feat / feature / class / subclass / race / species) ────
  // Shared sheet for narrative/rules items with a rich-text description, so
  // imported dnd5e-style feats, heritages, and class/doctrine grants render
  // their `system.description.value` HTML instead of falling through to
  // Foundry's unstyled generic ItemSheetV2. Handles both `race` (legacy)
  // and `species` (dnd5e v5+) item types.
  class FourthThingFeatureSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

    static FT_TYPE_LABELS = {
      feature:  "Principle",
      feat:     "Technique",
      class:    "Path",
      subclass: "Doctrine",
      race:     "Ancestry",
      species:  "Ancestry",
      gear:     "Gear",
      armor:    "Armor"
    };

    // Normalize dnd5e v5 source object → readable string. dnd5e stores source
    // as `{ revision, rules, book, custom, license }`; the legacy fourththing
    // schema treats source as a plain string. Without this, the input field
    // renders the literal text "[object Object]".
    static normalizeSource(raw) {
      if (raw == null) return "";
      if (typeof raw === "string") return raw;
      if (typeof raw === "object") {
        const parts = [];
        if (raw.custom) parts.push(String(raw.custom));
        if (raw.book)   parts.push(String(raw.book));
        if (raw.page)   parts.push(`p.${raw.page}`);
        if (raw.rules)  parts.push(`(${raw.rules} rules)`);
        return parts.join(" ").trim();
      }
      return String(raw);
    }

    static DEFAULT_OPTIONS = {
      classes:  ["fourththing", "sheet", "item", "feature"],
      position: { width: 560, height: 620 },
      actions:  { ftEditItemImg: _ftOnEditItemImg,
                  ftAddItemEffect: _ftOnAddItemEffect, ftEditItemEffect: _ftOnEditItemEffect,
                  ftDeleteItemEffect: _ftOnDeleteItemEffect, ftToggleItemEffect: _ftOnToggleItemEffect },
      form:     { submitOnChange: true, closeOnSubmit: false }
    };

    static PARTS = {
      sheet: { template: "systems/fourththing/templates/items/feature-sheet.hbs" }
    };

    async _prepareContext(options) {
      const system = foundry.utils.deepClone(this.item.toObject().system ?? {});
      system.description ??= { value: "", chat: "" };
      system.description.value ??= "";
      // Description fallback chain — check three places before showing "No description":
      //   1. system.description.value           (native fourththing items)
      //   2. flags.fourththing.rfi.item.lore    (RFI material/gear/weapon authoring schema)
      //   3. flags.fourththing.rfi.item.legacySystem.description.value
      //                                         (dnd5e items coerced via FourthThingItem)
      const rfi = this.item.flags?.fourththing?.rfi?.item;
      if (!system.description.value && rfi?.lore) {
        system.description.value = String(rfi.lore);
      }
      if (!system.description.value) {
        const legacyDesc = rfi?.legacySystem?.description?.value;
        if (legacyDesc) system.description.value = String(legacyDesc);
      }
      // RFI signature line — short evocative tagline shown italic under the name.
      const rfiSignature = rfi?.signature ? String(rfi.signature) : "";
      system.category ??= "";
      system.source = FourthThingFeatureSheet.normalizeSource(system.source);
      const tags = Array.isArray(system.tags) ? system.tags : [];
      const typeLabel = FourthThingFeatureSheet.FT_TYPE_LABELS[this.item.type] ?? ftCap(this.item.type || "item");
      const categoryLabel = system.category ? ftCap(String(system.category)) : "";

      // Pre-render description HTML through Foundry's enricher so links,
      // inline rolls, and secret blocks resolve (matches dnd5e read-mode
      // parity). Falls back to the raw value if enrichHTML is unavailable.
      let enrichedDescription = "";
      try {
        const enricher = foundry.applications?.ux?.TextEditor?.implementation?.enrichHTML
          ?? globalThis.TextEditor?.enrichHTML;
        if (enricher) {
          enrichedDescription = await enricher(system.description.value || "", {
            relativeTo: this.item,
            secrets: this.item.isOwner,
            async: true
          });
        } else {
          enrichedDescription = String(system.description.value || "");
        }
      } catch (_e) {
        enrichedDescription = String(system.description.value || "");
      }

      // RFI structured badges — surface tier / charges / frame from the rfi flag
      // namespace so material and gear items show their craft data at a glance.
      const rfiBadges = [];
      if (rfi?.tier)              rfiBadges.push(`Tier ${rfi.tier}`);
      if (Number.isFinite(Number(rfi?.charges)) && Number(rfi.charges) > 0) {
        rfiBadges.push(`×${rfi.charges}`);
      }
      if (rfi?.frame && rfi.frame !== "tool") rfiBadges.push(ftCap(String(rfi.frame)));
      if (rfi?.bound && rfi.bound !== "free") rfiBadges.push(ftCap(String(rfi.bound)));
      if (rfi?.origin && rfi.origin !== "found") rfiBadges.push(ftCap(String(rfi.origin)));

      return {
        item:              this.item,
        system,
        typeLabel,
        categoryLabel,
        tagList:           tags,
        hasIdentifier:     this.item.type === "class",
        hasClassIdentifier:this.item.type === "subclass",
        enrichedDescription,
        isEditable:        this.isEditable,
        rfiSignature,
        rfiBadges,
        itemEffects:       _ftBuildItemEffectsContext(this.item).flat,
        itemEffectGroups:  _ftBuildItemEffectsContext(this.item).groups,
        effectsSectionOpen:!!game.user?.isGM
      };
    }
  }

  // ── FourthThingItem ────────────────────────────────────────────────────────
  // Coerces legacy dnd5e item types to fourththing-valid types AT CONSTRUCTION
  // time. Required because the document constructor validates `type` against
  // `system.json` itemTypes BEFORE any hook fires, so dropping a dnd5e item
  // (type="equipment") onto a fourththing actor throws before preCreateItem
  // can mutate it. The original system block is stashed under
  // flags.fourththing.rfi.item.legacySystem for description recovery.
  class FourthThingItem extends Item {
    constructor(data, context) {
      const coerced = FourthThingItem._coerceData(data);
      super(coerced ?? data, context);
    }
    static _coerceData(data) {
      if (!data || typeof data !== "object" || !data.type) return null;
      let newType = null;
      switch (data.type) {
        case "equipment":
          // dnd5e overloads equipment for both armor and miscellaneous gear.
          // Armor pieces have a non-zero system.armor.value.
          newType = (Number(data.system?.armor?.value) > 0) ? "armor" : "gear";
          break;
        case "consumable":
        case "tool":
        case "loot":
        case "backpack":  newType = "gear";    break;
        case "spell":     newType = "power";   break;
        case "base":
        case "enchantment": newType = "feature"; break;
        default: return null;
      }
      if (newType === data.type) return null;

      const legacySystem = data.system ? foundry.utils.deepClone(data.system) : {};
      const cloned = foundry.utils.deepClone(data);
      cloned.type   = newType;
      cloned.system = {};
      cloned.flags  = cloned.flags ?? {};
      cloned.flags.fourththing = cloned.flags.fourththing ?? {};
      cloned.flags.fourththing.rfi = cloned.flags.fourththing.rfi ?? {};
      cloned.flags.fourththing.rfi.item = cloned.flags.fourththing.rfi.item ?? {};
      // Don't clobber an explicitly-authored legacySystem.
      if (!cloned.flags.fourththing.rfi.item.legacySystem) {
        cloned.flags.fourththing.rfi.item.legacySystem = legacySystem;
      }
      return cloned;
    }
  }

  // ── Register document classes ─────────────────────────────────────────────
  CONFIG.Actor.documentClass  = FourthThingActor;
  CONFIG.Combat.documentClass = FourthThingCombat;
  CONFIG.Item.documentClass   = FourthThingItem;

  (foundry.applications.apps.DocumentSheetConfig ?? DocumentSheetConfig).registerSheet(Actor, "fourththing", FourthThingCharacterSheet, {
    types: ["character"], makeDefault: true, label: "Steward Sheet"
  });
  (foundry.applications.apps.DocumentSheetConfig ?? DocumentSheetConfig).registerSheet(Actor, "fourththing", FourthThingNPCSheet, {
    types: ["npc"], makeDefault: true, label: "Figure Sheet"
  });
  (foundry.applications.apps.DocumentSheetConfig ?? DocumentSheetConfig).registerSheet(Actor, "fourththing", FourthThingRigSheet, {
    types: ["rig"], makeDefault: true, label: "Rig Sheet"
  });
  (foundry.applications.apps.DocumentSheetConfig ?? DocumentSheetConfig).registerSheet(Actor, "fourththing", FourthThingBossSheet, {
    types: ["boss"], makeDefault: true, label: "Boss Sheet"
  });
  (foundry.applications.apps.DocumentSheetConfig ?? DocumentSheetConfig).registerSheet(Item, "fourththing", FourthThingPowerSheet, {
    types: ["power"], makeDefault: true, label: "Manifestation Sheet"
  });
  (foundry.applications.apps.DocumentSheetConfig ?? DocumentSheetConfig).registerSheet(Item, "fourththing", FourthThingWeaponSheet, {
    types: ["weapon"], makeDefault: true, label: "Manifestation Form Sheet"
  });
  (foundry.applications.apps.DocumentSheetConfig ?? DocumentSheetConfig).registerSheet(Item, "fourththing", FourthThingFeatureSheet, {
    types: ["feat", "feature", "class", "subclass", "race", "species", "gear", "armor"], makeDefault: true, label: "Principle Sheet"
  });

  console.log("Roll for Initiation | AppV2 sheets registered (v0.4.0 — Foundation Refactor).");
});

Hooks.once("ready", async () => {
  console.log("Roll for Initiation | System ready — Foundation Refactor active.");

  // Blood Debt migration: fold legacy bbttcc-core flag ledger into native
  // system.bloodDebt. Idempotent — actors with no legacy flags are skipped.
  try {
    if (!game.user?.isGM) return;
    let count = 0;
    for (const actor of game.actors ?? []) {
      if (actor.type !== "character") continue;
      const legacyIdent = foundry.utils.getProperty(actor, "flags.bbttcc.identity.bloodDebt");
      const legacyModel = foundry.utils.getProperty(actor, "flags.bbttcc-bridge.bloodDebtModel");
      const legacyVal    = Number(legacyIdent?.value ?? legacyModel?.value ?? 0);
      const legacyLedger = [
        ...(Array.isArray(legacyIdent?.ledger) ? legacyIdent.ledger : []),
        ...(Array.isArray(legacyModel?.ledger) ? legacyModel.ledger : [])
      ];
      if (legacyVal === 0 && legacyLedger.length === 0) continue;

      const nativeBD = actor.system?.bloodDebt ?? actor.system?.system?.bloodDebt ?? { value: 0, ledger: [] };
      const merged   = {
        value:  (Number(nativeBD.value) || 0) + legacyVal,
        ledger: [...(nativeBD.ledger ?? []), ...legacyLedger.map(e => ({ ...e, source: e.source ?? "legacy" }))]
      };
      await actor.update({
        "system.bloodDebt.value":               merged.value,
        "system.bloodDebt.ledger":              merged.ledger,
        "flags.bbttcc.identity.-=bloodDebt":    null,
        "flags.bbttcc-bridge.-=bloodDebtModel": null
      });
      count++;
    }
    if (count > 0) ui.notifications?.info(`Blood Debt: migrated ${count} character(s) from legacy flag ledger.`);
  } catch (err) {
    console.error("Roll for Initiation | Blood Debt migration failed", err);
  }
});

// Remap D&D5E item types that BBTTCC imports into valid Fourth Thing types.
// "feat" → "feature", "class" → "feature", "subclass" → "feature"
// "spell" → "power", "loot" → "gear", "equipment" → "gear"
const FT_TYPE_MAP = {
  feat:      "feature",
  class:     "feature",
  subclass:  "feature",
  heritage:  "feature",
  ancestry:  "feature",
  doctrine:  "feature",
  spell:     "power",
  loot:      "gear",
  equipment: "gear",
  consumable:"gear",
  tool:      "gear",
  backpack:  "gear",
};

Hooks.on("preCreateItem", (item, data, options, userId) => {
  const mapped = FT_TYPE_MAP[item.type];
  if (mapped) {
    // V14: type changes require system to also be updated with a ForcedReplacement.
    // Pass both type and a clean system object to satisfy the validator.
    item.updateSource({ type: mapped, system: {} }, { dryRun: false });
  }
});

// Delegated chat listener — use renderChatMessageHTML (V14+) with fallback to renderChatMessage
const _chatHook = typeof ChatMessage.prototype.renderHTML !== "undefined"
  ? "renderChatMessageHTML"
  : "renderChatMessage";

Hooks.on(_chatHook, (message, html) => {
  // renderChatMessageHTML passes an HTMLElement; renderChatMessage passes jQuery
  const root = html instanceof HTMLElement ? html : html[0];

  // Phase 4 — AoO Strike button. Looks up observer + mover via uuid, targets
  // the mover's token so the engage dialog auto-pulls their defenses, consumes
  // the observer's reaction, and opens the standard Engage flow with the chosen
  // item. Disabled after click so a single prompt can't double-fire.
  root.querySelectorAll(".ft-aoo-strike").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        const observer = await fromUuid(btn.dataset.observerUuid);
        const mover    = await fromUuid(btn.dataset.moverUuid);
        if (!observer || !mover) {
          ui.notifications?.warn("AoO actors not found — token may have been deleted.");
          return;
        }
        const sys = observer.system?.system ?? observer.system;
        if (sys?.actions?.reactionUsed) {
          ui.notifications?.warn(`${observer.name}'s reaction is already used.`);
          return;
        }
        const item = observer.items.get(btn.dataset.itemId) ?? ftFindMeleeAttackItem(observer);
        if (!item) {
          ui.notifications?.warn(`${observer.name} has no equipped melee weapon for an AoO.`);
          return;
        }
        await observer.update({ "system.actions.reactionUsed": true });
        const moverToken = mover.getActiveTokens?.()?.[0];
        if (moverToken) game.user.updateTokenTargets([moverToken.id]);
        ftOpenEngageDialog(observer, item);
      } catch (err) {
        console.error("fourththing | AoO strike-button failed", err);
        btn.disabled = false;
      }
    });
  });

  root.querySelectorAll(".ft-apply-dmg-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const formula = btn.dataset.formula;
      const track   = btn.dataset.track ?? "integrity";
      const targets = game.user.targets;

      if (!targets.size) {
        ui.notifications.warn("No tokens targeted. Target a token first, then click Apply.");
        return;
      }

      const roll = new Roll(formula);
      await roll.evaluate();
      const dmg = roll.total;

      for (const token of targets) {
        const actor = token.actor;
        if (!actor) continue;
        const rawSys = actor.system?.system ?? actor.system;
        const cur    = rawSys?.derived?.[track]?.value ?? 0;
        const newVal = Math.max(0, cur - dmg);
        await actor.update({ [`system.derived.${track}.value`]: newVal });
        ui.notifications.info(`${actor.name}: ${track} ${cur} → ${newVal} (−${dmg})`);
      }

      btn.textContent   = `Applied −${dmg}`;
      btn.disabled      = true;
      btn.style.opacity = "0.5";
    });
  });

  // Save-prompt button (saveByPrompt resolution path). Target's owner clicks
  // to roll their save — the click handler resolves damage + states with the
  // resulting multiplier. Context lives on the chat message's flag.
  root.querySelectorAll(".ft-save-prompt-btn").forEach(btn => {
    btn.addEventListener("click", () => _ftHandleSavePromptClick(btn, message));
  });

  // Misfire conversion buttons (Wyrdlens Tikkun Sight / Pactkeeper Renegotiate).
  // Caster's owner clicks to convert a misfire to base-tier success; bookkeeping
  // (Surge → Clarity refund or narrative-debt ledger entry) fires automatically.
  root.querySelectorAll(".ft-misfire-convert-btn").forEach(btn => {
    btn.addEventListener("click", () => _ftHandleMisfireConvertClick(btn, message));
  });

  // AoE save-prompt buttons — per-target Save in an AoE; target's owner clicks
  // to roll. Resolves save + applies pre-rolled base damage with multiplier.
  root.querySelectorAll(".ft-aoe-save-prompt-btn").forEach(btn => {
    btn.addEventListener("click", () => _ftHandleAoeSavePromptClick(btn, message));
  });

  // AoE Apply All confirm — single GM-side button to apply pending AoE damage
  // when the world setting / cast checkbox gates auto-apply.
  root.querySelectorAll(".ft-aoe-apply-all-btn").forEach(btn => {
    btn.addEventListener("click", () => _ftHandleAoeApplyAllClick(btn, message));
  });

  // Redemption ritual buttons (GM-only; other clients see disabled buttons).
  const disableCard = (clickedBtn, outcomeText, outcomeColor) => {
    const card = clickedBtn.closest(".ft-redemption-card");
    if (!card) return;
    card.querySelectorAll("button").forEach(b => {
      b.disabled = true;
      b.style.opacity = "0.4";
      b.style.cursor = "default";
    });
    const outcome = card.querySelector(".ft-redemption-outcome");
    if (outcome) {
      outcome.textContent = outcomeText;
      outcome.style.color = outcomeColor;
      outcome.style.opacity = "0.9";
      outcome.style.fontStyle = "normal";
    }
  };

  root.querySelectorAll(".ft-redeem-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      if (!game.user.isGM) { ui.notifications?.warn("Only the GM can resolve Redemption."); return; }
      const actor = game.actors.get(btn.dataset.actorId);
      if (!actor) { ui.notifications?.error("Actor not found."); return; }
      const costOverride = Number(btn.dataset.cost) || null;
      const category     = btn.dataset.category ?? "violence";
      const result = await game.fourththing.deathMech.redeem(actor, { category, costOverride });
      if (result?.ok) disableCard(btn, `Resolved: Redeemed (−${result.cost} ${result.category} OP from ${result.faction?.name ?? "faction"}).`, "#4a90d9");
      else            disableCard(btn, `Redemption failed: ${result?.reason ?? "unknown"} — falling back to GM discretion.`, "#ff8a8a");
    });
  });

  root.querySelectorAll(".ft-reincarnate-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      if (!game.user.isGM) { ui.notifications?.warn("Only the GM can resolve Reincarnation."); return; }
      const actor = game.actors.get(btn.dataset.actorId);
      if (!actor) { ui.notifications?.error("Actor not found."); return; }
      const ok = await Dialog.confirm({
        title:   "Force Reincarnation",
        content: `<p>Commit <b>${actor.name}</b> to Reincarnation? The Blood Debt ledger carries forward; the body is lost.</p>`
      });
      if (!ok) return;
      const result = await game.fourththing.deathMech.forceReincarnation(actor, { reason: "gm-declined-redemption" });
      if (result?.ok) disableCard(btn, `Resolved: Reincarnation pending (Tier ${result.tier}). Manual regen flow required.`, "#ff7373");
      else            disableCard(btn, `Reincarnation flag failed: ${result?.reason ?? "unknown"}.`, "#ff8a8a");
    });
  });
});

// ── RFI Item Sheet Strip ─────────────────────────────────────────────────────
// Compact display strip injected into every item sheet (custom + default
// ItemSheetV2). Shows tier badge, frame, footprint pip, signature, origin tag,
// and bound state. Hidden for non-gear items (feat, spell, class, etc.).
function _buildRfiSheetStrip(item) {
  const rfi = RfiItems.get(item);
  if (!rfi) return "";

  const tierColor = { I: "#7aa9d4", II: "#5fb35f", III: "#d4a35f", IV: "#d46a6a" }[rfi.tier] || "#888";
  const frameIcon = {
    weapon: "⚔", armor: "🛡", tool: "🔧", sigil: "✦", vehicle: "🚙",
    consumable: "🧪", container: "🎒"
  }[rfi.frame] || "◆";

  // Footprint pip — N filled circles, capped at 6 for display, then a number.
  const fp = Math.max(0, Math.min(99, Number(rfi.footprint) || 0));
  const pipCount = Math.min(fp, 6);
  const pips = "●".repeat(pipCount) + "○".repeat(Math.max(0, 6 - pipCount));
  const pipDisplay = fp > 6 ? `${pips} ×${fp}` : pips;

  const upkeepLine = (rfi.upkeep?.mode === "passive" && rfi.upkeep?.per === "none")
    ? "single-use"
    : `${rfi.upkeep?.mode ?? "passive"} / ${rfi.upkeep?.per ?? "scene"}`;

  const sigLine  = rfi.signature ? `<div class="rfi-strip-sig">⟡ ${foundry.utils.escapeHTML?.(rfi.signature) ?? rfi.signature}</div>` : "";
  const harmonizedBadge = rfi.requiresHarmonization
    ? `<span class="rfi-strip-harmonized rfi-harm-${rfi.harmonized ? "on" : "off"}" title="${rfi.harmonized ? "Harmonized — forged on a Great Success" : "Unharmonized — forged on a basic success"}">${rfi.harmonized ? "✦ HARMONIZED" : "○ unharmonized"}</span>`
    : "";
  const reachStr = rfi.reach === "self" ? "self"
                 : rfi.reach === "touch" ? "touch"
                 : /^\d+$/.test(String(rfi.reach)) ? `${rfi.reach} ft`
                 : rfi.reach;

  // Lore body — falls back to legacySystem.description.value (the dnd5e
  // description field that gets stranded when an item is coerced to a
  // fourththing type with no description slot in template.json). Renders any
  // HTML the description carried; we trust authored content.
  const lore = rfi.lore
    ?? foundry.utils.getProperty(rfi, "legacySystem.description.value")
    ?? "";
  const loreBlock = lore ? `<div class="rfi-strip-lore">${lore}</div>` : "";

  return `
    <div class="rfi-item-strip" data-frame="${rfi.frame}" data-tier="${rfi.tier}">
      <div class="rfi-strip-row">
        <span class="rfi-strip-tier" style="background:${tierColor}">T${rfi.tier}</span>
        <span class="rfi-strip-frame" title="Frame">${frameIcon} ${rfi.frame}</span>
        <span class="rfi-strip-pip" title="Footprint cost (${rfi.footprint})">${pipDisplay}</span>
        <span class="rfi-strip-reach" title="Reach">↦ ${reachStr}</span>
        <span class="rfi-strip-bound rfi-bound-${rfi.bound}" title="Bound state">${rfi.bound}</span>
        <span class="rfi-strip-origin" title="Origin">${rfi.origin}</span>
        <span class="rfi-strip-upkeep" title="Upkeep">${upkeepLine}</span>
      </div>
      ${harmonizedBadge ? `<div class="rfi-strip-harmonized-row">${harmonizedBadge}</div>` : ""}
      ${sigLine}
      ${loreBlock}
    </div>`;
}

// Custom fourththing item sheets (Power / Weapon / Feature) ship with their
// own rich manifestation UI; injecting the strip there causes layout overflow
// on certain skins. The strip is most useful on default-rendered items
// (gear, armor, default ItemSheet/ItemSheetV2). Skip the custom sheets.
const _RFI_STRIP_SKIP_SHEETS = new Set([
  "FourthThingPowerSheet",
  "FourthThingWeaponSheet",
  "FourthThingFeatureSheet"
]);
function _ftInjectRfiStrip(sheet, html) {
  try {
    if (sheet?.constructor?.name && _RFI_STRIP_SKIP_SHEETS.has(sheet.constructor.name)) return;
    const item = sheet?.document ?? sheet?.item;
    if (!item) return;
    const stripHtml = _buildRfiSheetStrip(item);
    if (!stripHtml) return;
    // `html` may be an HTMLElement (AppV2) or a jQuery wrapper (V1).
    const root = html?.[0] ?? html;
    if (!root || root.querySelector?.(".rfi-item-strip")) return; // idempotent
    const anchor = root.querySelector?.(".window-content") ?? root;
    if (!anchor) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = stripHtml.trim();
    anchor.insertBefore(wrap.firstChild, anchor.firstChild);
  } catch (e) {
    console.warn("Roll for Initiation | RFI item strip injection failed", e);
  }
}
// Cover both V2 and V1 item sheets — items without a registered fourththing
// sheet (gear, armor in current state) fall back to V1, which would skip the
// V2 hook entirely and leave the sheet body empty.
Hooks.on("renderItemSheetV2", _ftInjectRfiStrip);
Hooks.on("renderItemSheet",   _ftInjectRfiStrip);

// ── Hex Configuration Dialog → Resource Node button ──────────────────────
// The Hex Configuration is a v1 Dialog (form.bbttcc-hex-config), opened from
// the canvas hex actions. It doesn't carry the drawing UUID in the DOM, so
// we resolve the hex doc by matching the dialog's name field against drawings
// on the active scene. Adds a "🜨 Resource Node" row inside the form.
Hooks.on("renderDialog", (dialog, html, _data) => {
  try {
    if (!game.user?.isGM) return; // GM-only: players cannot mark or edit nodes.
    const root = html?.[0] ?? html;
    const form = root?.querySelector?.("form.bbttcc-hex-config")
              ?? root?.querySelector?.(".bbttcc-hex-config");
    if (!form) return;
    if (form.querySelector(".rfi-hex-resource-node-row")) return; // idempotent

    const row = document.createElement("div");
    row.className = "rfi-hex-resource-node-row";
    row.style.cssText = "margin:0.5rem 0;padding:0.5rem 0.75rem;background:rgba(212,163,95,0.10);border:1px solid rgba(212,163,95,0.45);border-radius:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;";
    row.innerHTML = `
      <div style="font-size:0.8rem;color:#ffd28a">
        <b>Resource Node</b>
        <div style="opacity:0.75;font-size:0.74rem;margin-top:0.15rem">Mark this hex as a harvestable source. Players see it in the Gather UI.</div>
      </div>
      <button type="button" class="rfi-hex-resource-node-btn" style="background:rgba(212,163,95,0.18);border:1px solid rgba(212,163,95,0.55);color:#ffd28a;padding:0.3rem 0.7rem;border-radius:3px;cursor:pointer;font-size:0.82rem;letter-spacing:0.04em;white-space:nowrap">🜨 Configure Node</button>
    `;
    // Insert near top of the form for visibility.
    const firstChild = form.firstElementChild;
    if (firstChild) form.insertBefore(row, firstChild.nextElementSibling ?? firstChild);
    else form.appendChild(row);

    row.querySelector(".rfi-hex-resource-node-btn").addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();

      // Resolve the drawing by name match against the dialog's name input.
      const nameInput = form.querySelector("input[name='name']");
      const hexName   = nameInput?.value?.trim();
      const scene     = canvas?.scene;
      let drawing = null;
      if (scene && hexName) {
        for (const d of scene.drawings) {
          const tf = d.flags?.["bbttcc-territory"];
          if (tf?.name && String(tf.name).trim() === hexName) { drawing = d; break; }
        }
      }
      if (!drawing) {
        ui.notifications?.warn(`Could not resolve the underlying hex drawing by name "${hexName}". Try the Hex Sheet button instead, or ensure the name is unique on this scene.`);
        return;
      }
      await RfiHarvest.openMarkDialog(drawing, { titleSuffix: `from Hex Config: ${hexName}` });
    });
  } catch (e) {
    console.warn("Roll for Initiation | hex-config resource-node button injection failed", e);
  }
});

// ── Hex Sheet → Resource Node button ──────────────────────────────────────
// The bbttcc-territory hex sheet (BBTTCC_HexSheet) doesn't expose canvas
// selection, but its underlying hex doc can carry our harvest flag like any
// other document. Inject a "🜨 Resource Node" button into the window header
// that opens the mark/edit dialog operating on the hex doc.
Hooks.on("renderBBTTCC_HexSheet", (sheet, html, _ctx) => {
  try {
    if (!game.user?.isGM) return; // GM-only: players cannot mark or edit nodes.
    const root = html?.[0] ?? html;
    if (!root || root.querySelector?.(".rfi-resource-node-btn")) return;
    const header = root.closest?.(".window-app")?.querySelector?.(".window-header")
                 ?? root.querySelector?.(".window-header")
                 ?? sheet.element?.querySelector?.(".window-header");
    if (!header) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "header-control rfi-resource-node-btn";
    btn.title = "Mark or edit this hex's harvest resource node";
    btn.innerHTML = "🜨 Resource Node";
    btn.style.cssText = "background:rgba(212,163,95,0.12);border:1px solid rgba(212,163,95,0.50);color:#ffd28a;padding:0.2rem 0.5rem;border-radius:3px;cursor:pointer;font-size:0.78rem;margin:0 0.25rem;letter-spacing:0.04em;";
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const hexDoc = sheet?._hexDoc;
      if (!hexDoc) {
        ui.notifications?.warn("Hex document not yet resolved — try again in a moment.");
        return;
      }
      await RfiHarvest.openMarkDialog(hexDoc, { titleSuffix: "from Hex Sheet" });
    });

    // Insert before the close button if present, else at the end.
    const closeBtn = header.querySelector(".header-button.close, [data-action='close']");
    if (closeBtn) header.insertBefore(btn, closeBtn);
    else header.appendChild(btn);
  } catch (e) {
    console.warn("Roll for Initiation | hex-sheet resource-node button injection failed", e);
  }
});

// ─── Phase 5: Crew piloting flow (boarding state machine) ──────────────────
// Boarded steward = `flags.fourththing.boardedRig: <rigActorId>` + role.
// Mechanically: token hidden on boarding, rig token displays boarded count
// badge, sheets get a BOARDED banner with disembark + frame action list.
// Action ROUTING through rig stats (attacks/defenses) is deferred to a
// follow-up sprint — Phase 5 lands the state machine + UX surfacing only.

/**
 * Board a steward onto a rig.
 * @param {Actor} steward - character or npc actor
 * @param {Actor} rig     - rig actor
 * @param {string} role   - "pilot" | "gunner" | "engineer" | "crew" (default: best fit)
 */
async function ftBoardRig(steward, rig, role = null) {
  if (!steward || !rig || rig.type !== "rig") return;
  if (rig.system?.identity?.state === "destroyed") {
    ui.notifications?.warn(`${rig.name} is destroyed and cannot be boarded.`);
    return;
  }

  // 2026-05-18 — Boarding mutates the rig actor (system.crew.slots),
  // which requires OWNER on the rig. Players never own rigs by default,
  // so relay to an active GM via the existing module.bbttcc-raid socket
  // (same pattern as ftActivateBattleScene above). GM-side handler
  // re-enters ftBoardRig with full perms.
  if (!game.user?.isGM && !rig.isOwner) {
    if (!game.users?.some?.(u => u.isGM && u.active)) {
      ui.notifications?.warn("No GM is online to confirm boarding.");
      return;
    }
    const payload = { t: "ft-boardRig", stewardId: steward.id, rigId: rig.id, role };
    console.log("[ft:relay] emit ft-boardRig on system.fourththing", payload);
    game.socket?.emit?.("system.fourththing", payload);
    ui.notifications?.info(`Boarding request sent — ${steward.name} → ${rig.name}.`);
    return;
  }

  // Pick a slot — prefer requested role, else first empty, else push new
  const slots = foundry.utils.deepClone(rig.system?.crew?.slots ?? []);
  const cap   = rig.system?.crew?.capacity ?? {};
  const tryRole = (r) => slots.findIndex(s => s.role === r && !s.actorId);
  let idx = role ? tryRole(role) : -1;
  if (idx < 0) {
    // Try roles in order of demand
    for (const r of ["pilot", "gunner", "engineer", "crew"]) {
      const max = Number(cap[r]?.max ?? 0);
      const occupied = slots.filter(s => s.role === r && s.actorId).length;
      const empty    = tryRole(r);
      if (empty >= 0 && occupied < max) { idx = empty; break; }
      if (max > 0 && occupied < max) {
        // No empty slot exists but capacity available — push a new one
        slots.push({ role: r, actorId: "", label: "" });
        idx = slots.length - 1;
        break;
      }
    }
  }
  if (idx < 0) {
    ui.notifications?.warn(`${rig.name} has no crew capacity available.`);
    return;
  }

  if (!slots[idx]) slots[idx] = { role: role ?? "crew", actorId: "", label: "" };
  slots[idx].actorId = steward.id;
  slots[idx].label   = slots[idx].label || steward.name;
  await rig.update({ "system.crew.slots": slots });

  // Stamp steward flag
  await steward.setFlag("fourththing", "boardedRig", { rigId: rig.id, role: slots[idx].role, slotIdx: idx });

  // Hide steward's tokens on the current scene (so they appear "inside" the rig)
  if (canvas?.scene && game.user?.isGM) {
    const stewardTokens = canvas.scene.tokens.filter(t => t.actorId === steward.id);
    if (stewardTokens.length) {
      const updates = stewardTokens.map(t => ({ _id: t.id, hidden: true }));
      await canvas.scene.updateEmbeddedDocuments("Token", updates);
    }
  }

  // 2026-05-18 — Grant Observer on the rig to each user who owns this
  // steward, so they can open the rig sheet from the Crew HUD. Idempotent:
  // only promotes (never demotes), and only runs GM-side since rig
  // ownership updates require GM permission.
  if (game.user?.isGM) {
    _ftGrantRigObserverToStewardOwners(rig, steward);
  }

  // Refresh rig token (boarded count badge)
  _ftRefreshRigTokenBadge(rig);

  ui.notifications?.info(`${steward.name} boarded ${rig.name} as ${slots[idx].role}.`);
}

// Promote any user who OWNS a boarded steward to at least OBSERVER on
// the rig they're crewing. No-op if they're already OBSERVER+.
async function _ftGrantRigObserverToStewardOwners(rig, steward) {
  if (!rig || !steward || !game.user?.isGM) return;
  const OBS = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  const OWN = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER    ?? 3;
  const ownerIds = Object.entries(steward.ownership ?? {})
    .filter(([uid, lvl]) => uid !== "default" && Number(lvl) >= OWN)
    .map(([uid]) => uid)
    .filter(uid => game.users?.get(uid) && !game.users.get(uid).isGM);
  if (!ownerIds.length) return;
  const next = foundry.utils.deepClone(rig.ownership ?? {});
  let changed = false;
  for (const uid of ownerIds) {
    const cur = Number(next[uid] ?? next.default ?? 0);
    if (cur < OBS) { next[uid] = OBS; changed = true; }
  }
  if (changed) {
    try { await rig.update({ ownership: next }, { diff: false }); }
    catch (e) { console.warn("[fourththing] grant Observer on rig failed", e); }
  }
}

// Backfill: on GM ready, scan rigs and ensure every boarded steward's
// owners hold at least Observer on the rig. Handles boardings made
// before the 2026-05-18 fix.
Hooks.once("ready", async () => {
  if (!game.user?.isGM) return;
  try {
    for (const rig of (game.actors ?? [])) {
      if (rig.type !== "rig") continue;
      const slots = rig.system?.crew?.slots ?? [];
      for (const slot of slots) {
        if (!slot?.actorId) continue;
        const steward = game.actors.get(slot.actorId);
        if (!steward) continue;
        await _ftGrantRigObserverToStewardOwners(rig, steward);
      }
    }
  } catch (e) { console.warn("[fourththing] rig-Observer backfill failed", e); }
});

/** Disembark a steward from whatever rig they're on. */
async function ftDisembarkSteward(steward) {
  if (!steward) return;
  const flag = steward.getFlag?.("fourththing", "boardedRig");
  if (!flag?.rigId) return;
  const rig = game.actors?.get(flag.rigId);

  // 2026-05-18 — Same GM-relay reason as ftBoardRig: rig.update for the
  // crew slot clear requires OWNER. Token un-hide is also GM-only.
  if (!game.user?.isGM && rig && !rig.isOwner) {
    if (!game.users?.some?.(u => u.isGM && u.active)) {
      ui.notifications?.warn("No GM is online to confirm disembark.");
      return;
    }
    const payload = { t: "ft-disembarkSteward", stewardId: steward.id };
    console.log("[ft:relay] emit ft-disembarkSteward on system.fourththing", payload);
    game.socket?.emit?.("system.fourththing", payload);
    ui.notifications?.info(`Disembark request sent — ${steward.name}.`);
    return;
  }

  // Clear slot on the rig
  if (rig) {
    const slots = foundry.utils.deepClone(rig.system?.crew?.slots ?? []);
    const idx = slots.findIndex(s => s.actorId === steward.id);
    if (idx >= 0) {
      slots[idx].actorId = "";
      await rig.update({ "system.crew.slots": slots });
    }
  }

  // Clear flag, restore token visibility
  await steward.unsetFlag("fourththing", "boardedRig");
  if (canvas?.scene && game.user?.isGM) {
    const stewardTokens = canvas.scene.tokens.filter(t => t.actorId === steward.id);
    if (stewardTokens.length) {
      const updates = stewardTokens.map(t => ({ _id: t.id, hidden: false }));
      await canvas.scene.updateEmbeddedDocuments("Token", updates);
    }
  }

  if (rig) _ftRefreshRigTokenBadge(rig);
  ui.notifications?.info(`${steward.name} disembarked${rig ? ` from ${rig.name}` : ""}.`);

  // B12.C: chat-card polish on dismount. Gives the table visual feedback
  // for the mounted→dismounted transition. Steward's action pool stays
  // as-is (whatever was spent before bailing).
  if (rig) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: steward }),
      content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#d4a35f">🚪 ${steward.name} disembarks from ${rig.name}</span></div>
        <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.8">Crew slot freed. Combat actions resume from steward HUD.</p></div>`
    });
  }
}

/** Force-refresh the boarded count badge on a rig's tokens. */
function _ftRefreshRigTokenBadge(rig) {
  if (!canvas?.scene || !rig) return;
  const tokens = canvas.tokens?.placeables?.filter(t => t.actor?.id === rig.id) ?? [];
  for (const tok of tokens) {
    try { _ftDrawRigBoardedBadge(tok); } catch { /* swallow */ }
  }
}

/** PIXI overlay: boarded-count chip on rig tokens. */
function _ftDrawRigBoardedBadge(token) {
  if (!token?.actor || token.actor.type !== "rig") return;
  // Remove any existing badge
  if (token._ftBoardedBadge) {
    token.removeChild(token._ftBoardedBadge);
    token._ftBoardedBadge.destroy({ children: true });
    token._ftBoardedBadge = null;
  }
  const slots = token.actor.system?.crew?.slots ?? [];
  const occupied = slots.filter(s => s.actorId).length;
  if (occupied <= 0) return;

  // V14 PIXI v7 — use (string, options) signature, NOT object form
  const text = new PIXI.Text(`👥 ${occupied}`, {
    fontFamily: "Signika, sans-serif",
    fontSize: 18,
    fill: 0xffffff,
    stroke: 0x000000,
    strokeThickness: 4,
    align: "center"
  });
  text.anchor.set(0.5, 0);
  text.x = (token.w ?? token.width ?? 100) / 2;
  text.y = -22;
  token.addChild(text);
  token._ftBoardedBadge = text;
}

// Draw badges when tokens are first drawn on canvas
Hooks.on("drawToken", (token) => {
  try { _ftDrawRigBoardedBadge(token); } catch (e) { /* swallow */ }
});

// Refresh badges when rig actor crew updates
Hooks.on("updateActor", (actor, changes) => {
  if (actor?.type !== "rig") return;
  if (!foundry.utils.hasProperty(changes, "system.crew.slots")) return;
  _ftRefreshRigTokenBadge(actor);
});

// ─── Crew Action Panel on character/npc sheets (Carryover 4) ───────────────
// When a steward is boarded on a rig, replace the simple banner with a richer
// Crew Action Panel: rig-weapons (gunner-fireable via existing engage dialog),
// frame-defined actions (clickable, post chat), Open Rig + Disembark.
//
// Rig-weapon attacks route through `ftOpenEngageDialog(stewardActor,rigWeapon)`
// — same combat flow as a steward's own weapon, but the damage formula and
// range come from the rig-weapon item, while the steward's combat skill drives
// the to-hit roll. Effective "boarded steward fires the rig's gun".

const _FT_CREW_ACTION_DESC = {
  steer:           "Move the rig at frame speed.",
  ram:             "Charge a target — collision damage scaled by integrity bracket.",
  "hold-position": "Steady the rig — gunners gain advantage until next pilot turn.",
  evasive:         "Disadvantage on attacks against the rig until next turn.",
  swerve:          "Reaction — avoid an incoming attack (skill check vs incoming roll).",
  "tack-against-wind": "Sail-frame variant: move + grant +reach against downwind targets.",
  "raise-sail":    "Toggle sail to high-speed mode.",
  "lower-sail":    "Toggle sail to low-speed mode.",
  "fire-weapon":   "Activate equipped rig-weapon (use the buttons below).",
  "aimed-shot":    "Spend action + bonus — increased damage / accuracy on next fire.",
  suppression:     "Use weapon to impose a condition (per weapon's grant).",
  reload:          "Refresh weapon ammo or cooldown.",
  "opportunity-fire": "Reaction — fire at enemy entering reach.",
  repair:          "Tinkering check — restore rig integrity.",
  "boost-system":  "Bonus — temp buff to a `rig-system` until end of round.",
  "vent-heat":     "Reset a cooldown on a weapon or system.",
  "cycle-power":   "Reset a cooldown.",
  "counter-sabotage": "Reaction — cancel a hostile boarding or sabotage attempt.",
  "operate-module":"Activate a specific `rig-system` or `output-module`.",
  brace:           "Bonus — soft defense buff.",
  signal:          "Bonus — coordination buff to crew or allies.",
  "hold-on":       "Reaction — reduce damage to self when the rig is hit."
};

// B12: Crew action dispatcher (2026-05-12). Replaces the previous
// chat-log stubs for the canonical movement + combat actions. Handles
// steer / hold-position / evasive / ram / repair / brace; everything
// else still falls through to a stub chat (aimed-shot, suppression,
// reload, opportunity-fire, signal, hold-on, swerve, etc. — these
// remain content-tagged for future phases).
//
// Per-round gates live on the steward (`flags.fourththing.combat`):
//   pilotActionUsedThisRound  — gates steer/hold/evasive/ram
//   engineerRepairedThisRound — gates repair
// Per-round rig state lives on the rig (`flags.fourththing.combat`):
//   holding / evading / brace — defense bumps in prepareDerivedData
//   hexesMoved                — informational tracking
// Both reset on the pilot's _onFtNewTurn (see character sheet handler).
//
// Action economy is real here: steer/hold/evasive/ram/repair consume
// the steward's `system.actions.actionUsed`; brace consumes bonusUsed.
async function _ftHandleCrewAction(steward, rig, actionId, frameItem) {
  if (!steward || !rig) return;
  if (rig.system?.identity?.state === "destroyed") {
    ui.notifications?.warn(`${rig.name} is destroyed.`);
    return;
  }
  const flag      = steward.getFlag?.("fourththing", "boardedRig");
  const role      = flag?.role ?? "crew";
  const tier      = Math.max(1, Math.min(4, Number(rig.system?.integrity?.tier) || 1));
  const bracket   = ftRigBracketFor(rig);
  const speed     = Math.max(1, Number(frameItem?.flags?.fourththing?.rigFrame?.travel?.speed ?? rig.system?.travel?.speed) || 1);
  const cmb       = rig.flags?.fourththing?.combat ?? {};
  const stCmb     = steward.flags?.fourththing?.combat ?? {};
  const stSys     = steward.system?.system ?? steward.system ?? {};
  const sysActs   = stSys?.actions ?? {};

  const warn = (msg) => { ui.notifications?.warn(msg); return false; };
  const requirePilot    = () => role === "pilot"    || warn(`${steward.name}: only the Pilot can do that (role: ${role}).`);
  const requireEngineer = () => role === "engineer" || warn(`${steward.name}: only the Engineer can repair (role: ${role}).`);
  const requirePilotGate = () => !stCmb.pilotActionUsedThisRound || warn(`${steward.name}: pilot action already taken this round.`);
  const requireAction    = () => !sysActs.actionUsed              || warn(`${steward.name}: action already used this turn.`);
  const requireBonus     = () => !sysActs.bonusUsed               || warn(`${steward.name}: bonus action already used this turn.`);
  const setRigCombat = (patch) => rig.setFlag("fourththing", "combat", { ...cmb, ...patch });
  const setPilotGate = () => steward.setFlag("fourththing", "combat", { ...stCmb, pilotActionUsedThisRound: true });
  const setEngGate   = () => steward.setFlag("fourththing", "combat", { ...stCmb, engineerRepairedThisRound: true });
  const consumeAction = () => steward.update({ "system.actions.actionUsed": true });
  const consumeBonus  = () => steward.update({ "system.actions.bonusUsed":  true });
  const cardSpeaker = ChatMessage.getSpeaker({ actor: rig });

  switch (actionId) {
    case "steer": {
      if (!requirePilot() || !requirePilotGate() || !requireAction()) return;
      const prevMoved = Number(cmb.hexesMoved) || 0;
      await setRigCombat({ hexesMoved: prevMoved + speed });
      await setPilotGate();
      await consumeAction();
      ChatMessage.create({
        speaker: cardSpeaker,
        content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#d4a35f">🎮 ${steward.name} steers ${rig.name}</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem">Pilot action — rig may move up to <b>${speed} hex</b> this round (GM moves the token).</p></div>`
      });
      return;
    }

    case "hold-position": {
      if (!requirePilot() || !requirePilotGate() || !requireAction()) return;
      await setRigCombat({ holding: true });
      await setPilotGate();
      await consumeAction();
      ChatMessage.create({
        speaker: cardSpeaker,
        content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#7ec0ff">🛡 ${rig.name} holds position</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem"><b>+1 Guard</b> until the next pilot turn (${steward.name}).</p></div>`
      });
      return;
    }

    case "evasive": {
      if (!requirePilot() || !requirePilotGate() || !requireAction()) return;
      await setRigCombat({ evading: true });
      await setPilotGate();
      await consumeAction();
      ChatMessage.create({
        speaker: cardSpeaker,
        content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#7ec0ff">💨 ${rig.name} evades</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem"><b>+2 Evasion</b> until the next pilot turn (${steward.name}).</p></div>`
      });
      return;
    }

    case "brace": {
      if (!requireBonus()) return;
      await setRigCombat({ brace: true });
      await consumeBonus();
      ChatMessage.create({
        speaker: cardSpeaker,
        content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#7ec0ff">⚓ ${steward.name} braces ${rig.name}</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem"><b>+1 Guard</b> until the next pilot turn.</p></div>`
      });
      return;
    }

    case "ram": {
      if (!requirePilot() || !requirePilotGate() || !requireAction()) return;
      const targets = Array.from(game.user?.targets ?? []);
      const targetActor = targets[0]?.actor;
      if (!targetActor) { ui.notifications?.warn("Target a token first (the ram needs an objective)."); return; }
      const weight = FT_RIG_BRACKET_WEIGHT[bracket] || 3;
      const dice   = Math.max(1, tier * weight);
      const roll   = new Roll(`${dice}d6`);
      await roll.evaluate();
      const dmgTarget = Math.max(1, Number(roll.total) || 1);
      const dmgSelf   = Math.max(1, Math.floor(dmgTarget / 2));
      const descT = await game.fourththing.rolls._applyDamageToActor(targetActor, dmgTarget, {
        op: "damage", track: "integrity", damageType: "kinetic", damageFlavor: "ram"
      });
      const descS = await game.fourththing.rolls._applyDamageToActor(rig, dmgSelf, {
        op: "damage", track: "integrity", damageType: "kinetic", damageFlavor: "ram"
      });
      // Phase 2 VFX: collision line + dual impact. Runs after damage
      // apply so the destroyed-state ring (if any) fires on top via the
      // bbttcc:rig:destroyed hook subscriber.
      try { ftPlayRamCollisionVfx(rig, targetActor); } catch (e) { console.warn("[fourththing] ram VFX", e); }
      await setRigCombat({ hexesMoved: Math.max(Number(cmb.hexesMoved) || 0, speed) });
      await setPilotGate();
      await consumeAction();
      await roll.toMessage({
        speaker: cardSpeaker,
        flavor: `<div class="ft-roll-header"><span class="ft-roll-name" style="color:#eb5757">💥 ${rig.name} rams ${targetActor.name}</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem"><b>${dice}d6</b> · ${bracket} ×${weight} × T${tier} → <b>${dmgTarget}</b> dmg (target) · <b>${dmgSelf}</b> feedback (self half)</p>
          <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85">${descT}<br>${descS}</p>`
      });
      return;
    }

    case "repair": {
      if (!requireEngineer() || !requireAction()) return;
      if (stCmb.engineerRepairedThisRound) { ui.notifications?.warn(`${steward.name}: already repaired this round.`); return; }
      const intrigue = Number(stSys?.attributes?.intrigue?.value) || 0;
      const tinkering = Number(stSys?.skills?.tinkering?.value)   || 0;
      const mod = intrigue + tinkering;
      const dc  = 10;
      const roll = new Roll(`2d10x10 + ${mod}`);
      await roll.evaluate();
      const success = roll.total >= dc;
      const margin  = success ? Math.max(0, Math.floor((roll.total - dc) / 5)) : 0;
      const restore = success ? (tier + margin) : 0;
      if (restore > 0) {
        const cur = Number(rig.system?.integrity?.value) || 0;
        const max = Number(rig.system?.integrity?.max)   || cur + restore;
        await rig.update({ "system.integrity.value": Math.min(max, cur + restore) });
        // Phase 2 VFX: green pulse on the rig token for successful repair.
        try { ftPlayCombatVfx(rig, "repair"); } catch (e) { console.warn("[fourththing] repair VFX", e); }
      }
      await setEngGate();
      await consumeAction();
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: steward }),
        flavor: `<div class="ft-roll-header"><span class="ft-roll-name" style="color:#7ec0ff">🔧 ${steward.name} repairs ${rig.name} (DC${dc})</span></div>
          <p style="margin:0.2rem 0;font-size:0.82rem">${success ? `Success — <b>+${restore}</b> integrity (T${tier} + ${margin} margin).` : "Failed — no repair this round."}</p>
          <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.7">Intrigue ${intrigue} + Tinkering ${tinkering} = +${mod}</p>`
      });
      return;
    }

    default: {
      const desc = _FT_CREW_ACTION_DESC[actionId] ?? "";
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: steward }),
        content: `<div style="border-left:3px solid #d4a35f;padding-left:.5rem;"><strong>${steward.name}</strong> [${role} · ${rig.name}]<br><strong>${actionId}</strong>${desc ? `<br><em>${desc}</em>` : ""}</div>`
      });
      return;
    }
  }
}

// 2026-05-18 — Crew-controls content + binders shared between the
// character/NPC sheet banner (.ft-boarded-banner) and the floating
// on-canvas Crew HUD (#ft-crew-hud). Single source of truth for the
// boarded-rig UI so the two surfaces stay in lockstep.
function _ftCollectCrewControlsContext(actor) {
  if (!actor) return null;
  const flag = actor.getFlag?.("fourththing", "boardedRig");
  if (!flag?.rigId) return null;
  const rig = game.actors?.get(flag.rigId);
  if (!rig) return null;

  // Frame-defined actions for this role
  const frameItem = (rig.items ?? []).find(it => it.getFlag?.("fourththing", "rigGear")?.subtype === "rig-frame");
  const frameActions = frameItem?.getFlag?.("fourththing", "rigFrame")?.actions?.[flag.role] ?? [];

  // Rig weapons (only gunners + crew can fire — pilots/engineers focus elsewhere)
  // 2026-05-13 — Gate on whether the rig has a Gunner role authored, not
  // on bracket. If `capacity.gunner.max === 0`, no gunner role exists →
  // the pilot IS the gunner. Naturally covers personal rigs (which have
  // no gunner slot) AND any future frame with a single-seat config
  // regardless of bracket.
  const gunnerCap = Number(rig.system?.crew?.capacity?.gunner?.max
                        ?? frameItem?.flags?.fourththing?.rigFrame?.capacity?.gunner?.max
                        ?? 0);
  const hasGunnerRole = gunnerCap > 0;
  const canFireWeapons = hasGunnerRole
    ? ((flag.role === "gunner") || (flag.role === "crew"))
    : true; // No gunner role authored → any boarded role can fire.
  const rigWeapons = canFireWeapons
    ? (rig.items ?? []).filter(it => it.getFlag?.("fourththing", "rigGear")?.subtype === "rig-weapon")
    : [];

  return { flag, rig, frameItem, frameActions, rigWeapons };
}

function _ftBuildCrewControlsHtml(actor, ctx) {
  const { flag, rig, frameActions, rigWeapons } = ctx;
  const esc = (s) => foundry.utils.escapeHTML?.(String(s)) ?? String(s);

  // 2026-05-13 — Per-WEAPON visual lockout. Each weapon disables
  // independently based on whether it specifically fired this round.
  // The rigDestroyed gate still blocks all weapons (rig is wreckage).
  const rigDestroyed = rig.system?.identity?.state === "destroyed";
  const firedMap = actor?.flags?.fourththing?.combat?.rigWeaponsFiredThisRound ?? {};
  const weaponFired = (wId) => !!firedMap[wId];

  const headerHTML = `
    <div style="display:flex;align-items:center;gap:.5rem;">
      <strong>BOARDED:</strong>
      <img src="${esc(rig.img)}" alt="" style="width:24px;height:24px;border-radius:3px;object-fit:cover;border:1px solid #888;"/>
      <span class="ft-boarded-rig-name" style="font-weight:600;">${esc(rig.name)}</span>
      <span class="ft-boarded-role" style="opacity:.85;">[${esc(flag.role)}]</span>
      <button type="button" class="ft-boarded-open-rig" style="margin-left:auto;font-size:0.75rem;padding:.15rem .5rem;">Open Rig</button>
      <button type="button" class="ft-boarded-disembark" style="font-size:0.75rem;padding:.15rem .5rem;">Disembark</button>
    </div>`;

  const _styleFireOk  = `style="display:flex;align-items:center;gap:.3rem;padding:.2rem .4rem;border:1px solid #d4a35f;background:rgba(0,0,0,0.3);color:#ffd28a;border-radius:3px;cursor:pointer;font-size:0.75rem;"`;
  const _styleFireOff = `disabled style="display:flex;align-items:center;gap:.3rem;padding:.2rem .4rem;border:1px solid #888;background:rgba(0,0,0,0.2);color:#aaa;border-radius:3px;cursor:not-allowed;font-size:0.75rem;opacity:0.55;"`;
  const anyFired = Object.keys(firedMap || {}).length > 0;
  const headerNote = rigDestroyed
    ? ` · <span style="color:#ff9a6b">rig destroyed</span>`
    : (anyFired ? ` · <span style="color:#ff9a6b">some weapons fired this round</span>` : "");
  const weaponHTML = rigWeapons.length ? `
    <div style="display:flex;flex-direction:column;gap:.2rem;border-top:1px solid rgba(212,163,95,0.3);padding-top:.3rem;">
      <div style="font-size:0.7rem;letter-spacing:.05em;opacity:.85;">FIRE WEAPON · your combat skill + this weapon's stats${headerNote}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.25rem;">
        ${rigWeapons.map(w => {
          const blocked = rigDestroyed || weaponFired(w.id);
          const btnExtra = blocked ? _styleFireOff : _styleFireOk;
          const tooltip = blocked && !rigDestroyed
            ? `${esc(w.name)} — fired this round`
            : esc(w.system?.description?.value?.replace(/<[^>]+>/g, "")?.slice(0, 120) ?? w.name);
          return `
          <button type="button" class="ft-rig-fire-btn" data-item-id="${esc(w.id)}" data-tooltip="${tooltip}" ${btnExtra}>
            <img src="${esc(w.img)}" style="width:16px;height:16px;border-radius:2px;"/>
            <span>${esc(w.name)}</span>
          </button>`;
        }).join("")}
      </div>
    </div>
  ` : "";

  const actionHTML = frameActions.length ? `
    <div style="display:flex;flex-direction:column;gap:.2rem;border-top:1px solid rgba(212,163,95,0.3);padding-top:.3rem;">
      <div style="font-size:0.7rem;letter-spacing:.05em;opacity:.85;">CREW ACTIONS · ${esc(flag.role)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:.25rem;">
        ${frameActions.map(a => {
          const desc = _FT_CREW_ACTION_DESC[a] ?? "";
          return `<button type="button" class="ft-crew-action-btn" data-action-id="${esc(a)}" data-tooltip="${esc(desc)}" style="padding:.15rem .4rem;border:1px solid #888;border-radius:3px;font-size:0.7rem;background:rgba(0,0,0,0.25);color:#fff;cursor:pointer;">${esc(a)}</button>`;
        }).join("")}
      </div>
    </div>` : "";

  return headerHTML + weaponHTML + actionHTML;
}

function _ftBindCrewControls(rootEl, actor, ctx, { onDisembark } = {}) {
  const { rig, frameItem, flag } = ctx;
  const esc = (s) => foundry.utils.escapeHTML?.(String(s)) ?? String(s);

  rootEl.querySelector(".ft-boarded-open-rig")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    const OBS = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
    const canView = rig.testUserPermission?.(game.user, OBS)
                 ?? (rig.permission >= OBS);
    if (!canView) {
      ui.notifications?.warn(`${rig.name}: ask the GM to (re-)board you — rig permissions are out of sync.`);
      return;
    }
    rig.sheet?.render(true);
  });
  rootEl.querySelector(".ft-boarded-disembark")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    await ftDisembarkSteward(actor);
    if (typeof onDisembark === "function") onDisembark();
  });

  // Wire rig-weapon fire buttons → ftRigWeaponFire (B11.C canonical API).
  // The helper handles boarding/role/destroyed/per-round gate checks and
  // delegates to ftOpenEngageDialog for the actual roll. Steward is the
  // rolling actor; the rig-weapon item drives damage/range.
  rootEl.querySelectorAll(".ft-rig-fire-btn").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (btn.disabled) return;
      const itemId = btn.dataset.itemId;
      const item   = rig.items.get(itemId);
      if (!item) { ui.notifications?.warn("Weapon item not found on rig."); return; }
      if (typeof ftRigWeaponFire === "function") {
        ftRigWeaponFire(actor, item);
      } else if (typeof ftOpenEngageDialog === "function") {
        ftOpenEngageDialog(actor, item);
      } else {
        ui.notifications?.warn("Engage dialog not available — fallback chat.");
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div><strong>${esc(actor.name)}</strong> fires <em>${esc(item.name)}</em> from <strong>${esc(rig.name)}</strong>.</div>`
        });
      }
    });
  });

  // B12: route through the canonical crew-action dispatcher. Handles
  // steer / hold-position / evasive / brace / ram / repair with real
  // role + per-round + action-economy gates. Unknown actions still fall
  // through to a stub chat from inside the dispatcher.
  rootEl.querySelectorAll(".ft-crew-action-btn").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const actionId = btn.dataset.actionId;
      if (typeof _ftHandleCrewAction === "function") {
        _ftHandleCrewAction(actor, rig, actionId, frameItem);
      } else {
        const desc = _FT_CREW_ACTION_DESC[actionId] ?? "";
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div style="border-left:3px solid #d4a35f;padding-left:.5rem;"><strong>${esc(actor.name)}</strong> [${esc(flag.role)} · ${esc(rig.name)}]<br><strong>${esc(actionId)}</strong>${desc ? `<br><em>${esc(desc)}</em>` : ""}</div>`
        });
      }
    });
  });
}

Hooks.on("renderApplicationV2", (app, html) => {
  try {
    const actor = app?.actor;
    if (!actor || (actor.type !== "character" && actor.type !== "npc")) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    if (root.querySelector(".ft-boarded-banner")) return;

    const ctx = _ftCollectCrewControlsContext(actor);
    if (!ctx) return;

    const banner = document.createElement("div");
    banner.className = "ft-boarded-banner";
    banner.style.cssText = "padding:.5rem .75rem;margin:.25rem;border:1px solid #d4a35f;background:rgba(212,163,95,0.10);color:#ffd28a;border-radius:4px;font-size:0.85rem;display:flex;flex-direction:column;gap:.4rem;";
    banner.innerHTML = _ftBuildCrewControlsHtml(actor, ctx);
    _ftBindCrewControls(banner, actor, ctx, { onDisembark: () => app.render(false) });

    const body = root.querySelector(".window-content") ?? root;
    body.insertBefore(banner, body.firstChild);
  } catch (e) {
    console.warn("Roll for Initiation | crew action panel injection failed", e);
  }
});

// ─── Token HUD: Board / Disembark / Open Rig buttons ───────────────────────
Hooks.on("renderTokenHUD", (hud, html, data) => {
  try {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const tokenDoc = hud?.object?.document;
    const actor    = tokenDoc?.actor;
    if (!actor) return;

    const rightCol = root.querySelector(".col.right") ?? root.querySelector(".right");
    if (!rightCol) return;

    const mkBtn = (icon, title, handler) => {
      const div = document.createElement("div");
      div.className = "control-icon";
      div.title = title;
      div.innerHTML = `<i class="fas ${icon}"></i>`;
      div.style.cssText = "background:rgba(0,0,0,0.6);border:1px solid #d4a35f;border-radius:3px;color:#ffd28a;cursor:pointer;";
      div.addEventListener("click", async (ev) => { ev.preventDefault(); await handler(); });
      return div;
    };

    if (actor.type === "character" || actor.type === "npc") {
      const flag = actor.getFlag?.("fourththing", "boardedRig");
      if (flag?.rigId) {
        rightCol.appendChild(mkBtn("fa-door-open", "Disembark Rig", () => ftDisembarkSteward(actor)));
      } else {
        rightCol.appendChild(mkBtn("fa-truck-pickup", "Board a Rig…", async () => {
          // Open picker — list rigs on current scene first, else all rigs
          const sceneRigs = (canvas?.scene?.tokens ?? []).filter(t => t.actor?.type === "rig").map(t => t.actor);
          const allRigs   = game.actors.filter(a => a.type === "rig");
          const list      = sceneRigs.length ? sceneRigs : allRigs;
          if (!list.length) { ui.notifications?.warn("No rigs available to board."); return; }
          const opts = list.map(r => `<option value="${r.id}">${foundry.utils.escapeHTML?.(r.name) ?? r.name}${r === sceneRigs[0] ? " (on scene)" : ""}</option>`).join("");
          const html = `<form>
            <div class="form-group"><label>Rig</label><select name="rigId" style="width:100%">${opts}</select></div>
            <div class="form-group"><label>Role</label>
              <select name="role" style="width:100%">
                <option value="">(auto-pick best fit)</option>
                <option value="pilot">Pilot</option>
                <option value="gunner">Gunner</option>
                <option value="engineer">Engineer</option>
                <option value="crew">Crew</option>
              </select>
            </div>
          </form>`;
          let result = null;
          try {
            result = await foundry.applications.api.DialogV2.wait({
              window: { title: `Board a Rig — ${actor.name}` },
              content: html,
              buttons: [
                { action: "ok", label: "Board", default: true,
                  callback: (ev, btn, dialog) => ({
                    rigId: dialog.element.querySelector("select[name=rigId]")?.value,
                    role:  dialog.element.querySelector("select[name=role]")?.value || null
                  }) },
                { action: "cancel", label: "Cancel" }
              ]
            });
          } catch { result = null; }
          if (!result || result === "cancel" || !result.rigId) return;
          const rig = game.actors.get(result.rigId);
          if (!rig) return;
          await ftBoardRig(actor, rig, result.role);
        }));
      }
    }

    if (actor.type === "rig") {
      rightCol.appendChild(mkBtn("fa-id-card", "Open Rig Sheet", () => actor.sheet?.render(true)));
    }
  } catch (e) {
    console.warn("Roll for Initiation | token HUD injection failed", e);
  }
});

// ─── Floating Crew Controls HUD ───────────────────────────────────────────
// 2026-05-18 — When a user's controlled token is boarded on a rig, mirror
// the .ft-boarded-banner contents onto a persistent on-canvas panel so
// players don't need their character sheet open during engagements.
// Mirrors the raid HUD pattern at _ftBuildRaidHudHtml/_ftRenderRaidHud.
// Build + bind logic is shared with the sheet banner via
// _ftBuildCrewControlsHtml / _ftBindCrewControls.
let __ftCrewHudEl = null;
let __ftCrewHudRenderTimer = null;
let __ftCrewHudActiveActorId = null;

function _ftPickHudSteward() {
  if (!game.user) return null;
  // GM: respect the controlled-token selection so the GM can switch
  // between stewards. (Returning null when no boarded token is selected
  // keeps the HUD out of the GM's way when they're working on the map.)
  if (game.user.isGM) {
    const controlled = canvas?.tokens?.controlled ?? [];
    for (const t of controlled) {
      const a = t?.actor;
      if (!a) continue;
      if (a.type !== "character" && a.type !== "npc") continue;
      if (a.getFlag?.("fourththing", "boardedRig")?.rigId) return a;
    }
    return null;
  }
  // Player: token control is unreliable (boarded tokens are hidden, so
  // the player can't re-select them once focus shifts). Scan visible
  // actors directly. We need OBSERVER+ (level 2) to read the boardedRig
  // flag — OWNER isn't required because the actual mutations (fire,
  // crew action) socket-relay to the GM when the player can't update.
  // Prefer the assigned character.
  const canRead = (a) => a?.testUserPermission?.(game.user, "OBSERVER") ?? false;
  const own = game.user.character;
  if (own && canRead(own) && own.getFlag?.("fourththing", "boardedRig")?.rigId) {
    console.log("[ft:hud] picked assigned character", own.name);
    return own;
  }
  for (const a of (game.actors ?? [])) {
    if (a.type !== "character" && a.type !== "npc") continue;
    if (!canRead(a)) continue;
    if (a.getFlag?.("fourththing", "boardedRig")?.rigId) {
      console.log("[ft:hud] picked observable boarded actor", a.name);
      return a;
    }
  }
  // Diagnostic: list everything we could read but skipped (so we can see
  // why an apparently-boarded PC isn't getting picked up).
  const allActors = (game.actors ?? []).filter(a => a.type === "character" || a.type === "npc");
  const visible = allActors.filter(a => canRead(a));
  const boarded = visible.filter(a => a.getFlag?.("fourththing", "boardedRig")?.rigId);
  const ownChar = game.user.character;
  console.log("[ft:hud] picker returned null.",
              "\n  total char/npc actors in world=", allActors.map(a => `${a.name}{canRead:${canRead(a)},isOwner:${a.isOwner},boarded:${!!a.getFlag?.('fourththing','boardedRig')?.rigId}}`),
              "\n  user.character=", ownChar ? `${ownChar.name}{canRead:${canRead(ownChar)},isOwner:${ownChar.isOwner},boarded:${!!ownChar.getFlag?.('fourththing','boardedRig')?.rigId}}` : "(none)",
              "\n  visible (canRead=true)=", visible.map(a => a.name),
              "\n  of which boarded=", boarded.map(a => a.name));
  return null;
}

// HUD-specific linear layout. Same classes/data-attrs as the block
// banner so _ftBindCrewControls binds either layout identically.
function _ftBuildCrewHudLinearHtml(actor, ctx) {
  const { flag, rig, frameActions, rigWeapons } = ctx;
  const esc = (s) => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
  const rigDestroyed = rig.system?.identity?.state === "destroyed";
  const firedMap = actor?.flags?.fourththing?.combat?.rigWeaponsFiredThisRound ?? {};

  const fireBtn = (w) => {
    const blocked = rigDestroyed || !!firedMap[w.id];
    const style = blocked
      ? `disabled style="display:inline-flex;align-items:center;gap:.25rem;padding:.15rem .4rem;border:1px solid #888;background:rgba(0,0,0,0.2);color:#aaa;border-radius:3px;font-size:0.72rem;opacity:0.55;cursor:not-allowed;"`
      : `style="display:inline-flex;align-items:center;gap:.25rem;padding:.15rem .4rem;border:1px solid #d4a35f;background:rgba(0,0,0,0.3);color:#ffd28a;border-radius:3px;font-size:0.72rem;cursor:pointer;"`;
    const tip = blocked && !rigDestroyed ? `${esc(w.name)} — fired this round` : esc(w.system?.description?.value?.replace(/<[^>]+>/g, "")?.slice(0, 120) ?? w.name);
    return `<button type="button" class="ft-rig-fire-btn" data-item-id="${esc(w.id)}" data-tooltip="${tip}" ${style}>
      <img src="${esc(w.img)}" style="width:14px;height:14px;border-radius:2px;"/><span>${esc(w.name)}</span>
    </button>`;
  };

  const actionBtn = (a) => {
    const desc = _FT_CREW_ACTION_DESC[a] ?? "";
    return `<button type="button" class="ft-crew-action-btn" data-action-id="${esc(a)}" data-tooltip="${esc(desc)}" style="padding:.15rem .4rem;border:1px solid #888;border-radius:3px;font-size:0.7rem;background:rgba(0,0,0,0.25);color:#fff;cursor:pointer;">${esc(a)}</button>`;
  };

  const sep = `<span style="opacity:.4;">·</span>`;

  return `<div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
    <img src="${esc(rig.img)}" alt="" style="width:20px;height:20px;border-radius:3px;object-fit:cover;border:1px solid #888;"/>
    <span style="font-weight:600;">${esc(rig.name)}</span>
    <span style="opacity:.85;font-size:0.75rem;">[${esc(flag.role)}]</span>
    ${rigWeapons.length ? `${sep}${rigWeapons.map(fireBtn).join("")}` : ""}
    ${frameActions.length ? `${sep}${frameActions.map(actionBtn).join("")}` : ""}
    ${sep}
    <button type="button" class="ft-boarded-open-rig" style="padding:.15rem .5rem;font-size:0.72rem;">Open Rig</button>
    <button type="button" class="ft-boarded-disembark" style="padding:.15rem .5rem;font-size:0.72rem;">Disembark</button>
  </div>`;
}

function _ftPositionCrewHud() {
  if (!__ftCrewHudEl) return;
  let centerX = window.innerWidth / 2;
  let bottomY = 80; // sensible default above hotbar
  const board = document.getElementById("board");
  if (board) {
    const rect = board.getBoundingClientRect();
    if (rect && rect.width > 0) centerX = rect.left + rect.width / 2;
  }
  // Sit just above the macro hotbar if present.
  const hotbar = document.getElementById("hotbar") ?? document.querySelector("#ui-bottom #hotbar");
  if (hotbar) {
    const hb = hotbar.getBoundingClientRect();
    if (hb && hb.top > 0) bottomY = Math.max(8, window.innerHeight - hb.top + 8);
  }
  __ftCrewHudEl.style.left = `${Math.round(centerX)}px`;
  __ftCrewHudEl.style.bottom = `${bottomY}px`;
  __ftCrewHudEl.style.transform = "translateX(-50%)";
}

function _ftRenderCrewHud() {
  if (__ftCrewHudRenderTimer) {
    clearTimeout(__ftCrewHudRenderTimer);
    __ftCrewHudRenderTimer = null;
  }
  __ftCrewHudRenderTimer = setTimeout(() => {
    __ftCrewHudRenderTimer = null;
    try {
      const actor = _ftPickHudSteward();
      if (!actor) {
        if (__ftCrewHudEl) { __ftCrewHudEl.remove(); __ftCrewHudEl = null; }
        __ftCrewHudActiveActorId = null;
        return;
      }
      const ctx = _ftCollectCrewControlsContext(actor);
      if (!ctx) {
        if (__ftCrewHudEl) { __ftCrewHudEl.remove(); __ftCrewHudEl = null; }
        __ftCrewHudActiveActorId = null;
        return;
      }
      const inner = _ftBuildCrewHudLinearHtml(actor, ctx);
      if (!__ftCrewHudEl) {
        __ftCrewHudEl = document.createElement("div");
        __ftCrewHudEl.id = "ft-crew-hud";
        __ftCrewHudEl.className = "ft-crew-hud";
        __ftCrewHudEl.style.cssText = "position:fixed;z-index:120;display:flex;align-items:center;padding:.35rem .6rem;border:1px solid #d4a35f;background:rgba(20,20,28,0.92);color:#ffd28a;border-radius:6px;font-family:'Signika',sans-serif;font-size:0.85rem;box-shadow:0 4px 12px rgba(0,0,0,0.5);pointer-events:auto;backdrop-filter:blur(2px);max-width:min(1200px,92vw);";
        document.body.appendChild(__ftCrewHudEl);
      }
      __ftCrewHudEl.innerHTML = inner;
      _ftBindCrewControls(__ftCrewHudEl, actor, ctx);
      __ftCrewHudActiveActorId = actor.id;
      _ftPositionCrewHud();
    } catch (e) {
      console.warn("[fourththing] Crew HUD render failed", e);
    }
  }, 60);
}

// Lifecycle: render whenever token control, the steward's boardedRig
// flag, the rig's combat state, or the rig's item list changes.
Hooks.on("controlToken", () => _ftRenderCrewHud());
Hooks.on("updateActor", (actor) => {
  // Cheap relevance gate: only re-render if the change concerns the
  // steward currently shown OR a rig that any boarded steward references.
  if (!actor) return;
  if (actor.id === __ftCrewHudActiveActorId) return _ftRenderCrewHud();
  if (actor.type === "rig") {
    const showing = __ftCrewHudActiveActorId ? game.actors?.get(__ftCrewHudActiveActorId) : null;
    if (showing?.getFlag?.("fourththing", "boardedRig")?.rigId === actor.id) return _ftRenderCrewHud();
  }
  // Otherwise: still re-render if no HUD currently shown — the update
  // might have just boarded somebody we now want to display.
  if (!__ftCrewHudActiveActorId) _ftRenderCrewHud();
});
Hooks.on("createItem", (item) => { if (item?.parent?.type === "rig") _ftRenderCrewHud(); });
Hooks.on("deleteItem", (item) => { if (item?.parent?.type === "rig") _ftRenderCrewHud(); });
Hooks.on("updateItem", (item) => { if (item?.parent?.type === "rig") _ftRenderCrewHud(); });
Hooks.on("canvasReady", () => _ftRenderCrewHud());
Hooks.once("ready", () => _ftRenderCrewHud());

// Expose helpers for macros / external callers
(() => {
  const root = (typeof globalThis !== "undefined" ? globalThis : window);
  root.ftBoardRig         = ftBoardRig;
  root.ftDisembarkSteward = ftDisembarkSteward;
  Hooks.once("ready", () => {
    game.fourththing = game.fourththing ?? {};
    game.fourththing.rig = game.fourththing.rig ?? {};
    game.fourththing.rig.board     = ftBoardRig;
    game.fourththing.rig.disembark = ftDisembarkSteward;
  });
})();

// ─── Phase 4C: Maneuver fire-mode runtime classifier ───────────────────────
// Explicit `eff.fireMode` wins (set by bbttcc-raid/scripts/effects-fire-mode-tags.js
// at ready). Otherwise heuristic regex match on `eff.text`. Defaults to "anytime".
// Mirrors the rules in tools/audit-maneuvers-fire-mode.macro.js — keep in sync.
const _FT_FIRE_MODE_RULES = {
  postCommit: [
    /\bon\s+success\b/i,
    /\bon\s+victory\b/i,
    /\bon\s+fail(ure)?\b/i,
    /\bafter\s+(the\s+)?(round|victory|combat|raid)\b/i,
    /\bnext\s+(round|turn)\b/i,
    /\brequires?\s+(victory|success)/i,
    /\bif\s+(you\s+)?win\b/i,
    /\bif\s+the\s+(attacker|defender)\s+(wins|succeeds)/i,
    /\bgain\s+initiative\s+for\s+next/i,
    /\bre-?run\s+last\s+round/i,
    /\brepeat\s+last\s+round/i,
  ],
  preRoll: [
    /\bthis\s+round\b/i,
    /\bthis\s+turn\b/i,
    /\breroll\b/i,
    /\b(dis)?advantage\b/i,
    /\bauto-?win\b/i,
    /\bnullify\b/i,
    /\breflect\b/i,
    /\bcancel\s+enemy\b/i,
    /\bnegate\b/i,
    /\bignore\s+(one|first|.{0,15}?(modifier|loss|effect|circumstance))/i,
    /[+\-]\d+\s+.{0,30}?(attack|defense|defence|roll|dc|morale|guard|evasion)/i,
    /\bnext\s+(attack|defense|defence|roll)/i,
    /\bdefender\s+dc\b/i,
    /\bopposed\s+roll\b/i,
    /\bapply\s+.{0,20}twice\b/i,
    /\breduce\s+(incoming\s+)?damage\b/i,
    /\boppon(ents?|ent's)\s+roll\b/i,
    /\bborrow\s+\+?\d*\s*enemy\s+op\b/i,
    /\bbefore\s+rolling\b/i,
  ],
};

function _ftInferManeuverFireMode(effOrText) {
  if (!effOrText) return { fireMode: "anytime", source: "default" };
  const eff = (typeof effOrText === "string") ? { text: effOrText } : effOrText;
  if (eff.fireMode) return { fireMode: String(eff.fireMode), source: "tagged" };
  const text = String(eff.text || eff.effects?.text || "").trim();
  if (!text) return { fireMode: "anytime", source: "no-text" };
  for (const p of _FT_FIRE_MODE_RULES.postCommit) if (p.test(text)) return { fireMode: "post-commit", source: "heuristic" };
  for (const p of _FT_FIRE_MODE_RULES.preRoll)    if (p.test(text)) return { fireMode: "pre-roll",    source: "heuristic" };
  return { fireMode: "anytime", source: "default" };
}

Hooks.once("ready", () => {
  game.fourththing = game.fourththing ?? {};
  game.fourththing.maneuvers = game.fourththing.maneuvers ?? {};
  game.fourththing.maneuvers.inferFireMode = _ftInferManeuverFireMode;
  game.fourththing.vfx = game.fourththing.vfx ?? {};
  game.fourththing.vfx.playCombat   = ftPlayCombatVfx;
  game.fourththing.vfx.playSweepArc = ftPlaySweepArcVfx;
});

// ─── Phase 7: Raid console bridge ──────────────────────────────────────────
// Boss actors auto-register their def into `game.bbttcc.api.raid.boss` so
// they appear in the raid console's creature picker alongside legacy defs.
// One-way sync: actor → registry. Mutations to system.raidProfile /
// doctrine.maneuverKeys / name / img re-register. Live integrity sync
// (raid-engine writeback to actor) is a follow-up.

function _ftBossActorToRaidDef(bossActor) {
  if (!bossActor || bossActor.type !== "boss") return null;
  const sys = bossActor.system?.system ?? bossActor.system;
  const rp  = sys?.raidProfile ?? {};
  if (!rp.key || !String(rp.key).trim()) return null;
  let behaviors = [];
  try { behaviors = JSON.parse(rp.behaviorsRaw || "[]"); } catch { behaviors = []; }
  if (!Array.isArray(behaviors)) behaviors = [];
  return {
    key:          String(rp.key).trim(),
    label:        bossActor.name,
    image:        bossActor.img,
    mode:         rp.mode ?? "hybrid",
    moraleHits:   Number(rp.moraleHits ?? 4),
    hitTrack:     rp.hitTrack ?? "",
    tags:         rp.tagsRaw ?? "",
    stats:        foundry.utils.deepClone(rp.opStats ?? {}),
    behaviors,
    maneuverKeys: Array.isArray(sys?.doctrine?.maneuverKeys) ? [...sys.doctrine.maneuverKeys] : [],
    actorId:      bossActor.id,
    sourceActor:  bossActor.uuid
  };
}

function _ftRegisterBossActor(bossActor) {
  try {
    const def = _ftBossActorToRaidDef(bossActor);
    if (!def) return;
    const api = game.bbttcc?.api?.raid?.boss;
    if (!api?.registerBoss) return;
    api.registerBoss(def.key, def);
  } catch (e) {
    console.warn("[fourththing/raid-bridge] register failed", e);
  }
}

function _ftUnregisterBossActor(bossActor) {
  try {
    const sys = bossActor.system?.system ?? bossActor.system;
    const key = sys?.raidProfile?.key;
    if (!key) return;
    const api = game.bbttcc?.api?.raid?.boss;
    if (!api?.unregisterBoss) return;
    api.unregisterBoss(key);
  } catch (e) {
    console.warn("[fourththing/raid-bridge] unregister failed", e);
  }
}

Hooks.on("createActor", (actor) => {
  if (actor?.type === "boss") _ftRegisterBossActor(actor);
});

Hooks.on("updateActor", (actor, changes) => {
  if (actor?.type !== "boss") return;
  const triggers = ["name", "img", "system.raidProfile", "system.doctrine.maneuverKeys"];
  if (triggers.some(t => foundry.utils.hasProperty(changes, t))) {
    _ftRegisterBossActor(actor);
  }
});

Hooks.on("deleteActor", (actor) => {
  if (actor?.type === "boss") _ftUnregisterBossActor(actor);
});

let _ftBossSeedRan = false;
function _ftSeedBossActorsToRegistry() {
  if (_ftBossSeedRan) return;
  if (!game.bbttcc?.api?.raid?.boss?.registerBoss) return;
  _ftBossSeedRan = true;
  let seeded = 0, skipped = 0;
  for (const actor of game.actors ?? []) {
    if (actor.type !== "boss") continue;
    if (!actor.system?.raidProfile?.key) { skipped++; continue; }
    _ftRegisterBossActor(actor);
    seeded++;
  }
  if (seeded || skipped) {
    console.log(`[fourththing/raid-bridge] seeded ${seeded} Boss actors into raid registry (${skipped} skipped — no raidProfile.key)`);
  }
}

Hooks.once("ready", () => {
  // bossRegistry.js attaches its API at "ready" too — give it a tick to land
  setTimeout(_ftSeedBossActorsToRegistry, 1500);
  game.fourththing = game.fourththing ?? {};
  game.fourththing.boss = game.fourththing.boss ?? {};
  game.fourththing.boss.registerActor     = _ftRegisterBossActor;
  game.fourththing.boss.unregisterActor   = _ftUnregisterBossActor;
  game.fourththing.boss.actorToRaidDef    = _ftBossActorToRaidDef;
  game.fourththing.boss.seedAllToRegistry = _ftSeedBossActorsToRegistry;
});

// ─── Phase 8: Token visual canon ───────────────────────────────────────────
// Rig tokens get mobility-coded corner brackets; boss tokens get a colored
// phase ring. Overlays draw on top of the standard token texture, redraw
// on relevant updates, and clean up on token destroy.

const _FT_RIG_BRACKET_COLOR = {
  stationary: 0x8a5a2b,  // anchor brown
  mobile:     0xd4a35f,  // wheel gold
  hybrid:     0xc36a2b   // mixed amber
};

// Phase ring color ramp — neutral → warm → urgent
const _FT_BOSS_PHASE_COLORS = [
  0xcccccc,  // 0 (initial / observed)
  0xf2c94c,  // 1 (yellow / pressured)
  0xf2994a,  // 2 (orange / wounded)
  0xeb5757,  // 3 (red / cornered)
  0x9c1f1f   // 4+ (deep red / final)
];

function _ftDrawRigVisualCanon(token) {
  if (!token?.actor || token.actor.type !== "rig") return;

  // Tear down existing
  if (token._ftRigCanon) {
    token.removeChild(token._ftRigCanon);
    token._ftRigCanon.destroy({ children: true });
    token._ftRigCanon = null;
  }

  const sys      = token.actor.system?.system ?? token.actor.system;
  const mobility = sys?.identity?.mobility ?? "mobile";
  const state    = sys?.identity?.state    ?? "parked";

  const w = token.w ?? token.width  ?? 100;
  const h = token.h ?? token.height ?? 100;
  const color = _FT_RIG_BRACKET_COLOR[mobility] ?? 0xd4a35f;
  const alpha = state === "destroyed" ? 0.25 : (state === "deployed" ? 0.95 : 0.7);
  const armLen = Math.min(w, h) * 0.18;
  const thickness = 3;

  const g = new PIXI.Graphics();
  g.lineStyle(thickness, color, alpha);

  // Stationary = closed/anchored corners (full L brackets at all 4 corners)
  // Mobile     = open corners (short tick marks pointing inward)
  // Hybrid     = mixed (top corners closed, bottom corners open) → docked
  //              behaves like stationary, deployed like mobile
  const drawCornerL = (cx, cy, dx, dy) => {
    g.moveTo(cx + dx * armLen, cy);
    g.lineTo(cx, cy);
    g.lineTo(cx, cy + dy * armLen);
  };
  const drawCornerTick = (cx, cy, dx, dy) => {
    g.moveTo(cx + dx * (armLen * 0.5), cy);
    g.lineTo(cx + dx * armLen,         cy);
    g.moveTo(cx, cy + dy * (armLen * 0.5));
    g.lineTo(cx, cy + dy * armLen);
  };

  const corners = [
    { x: 0, y: 0, dx:  1, dy:  1, top: true },   // top-left
    { x: w, y: 0, dx: -1, dy:  1, top: true },   // top-right
    { x: 0, y: h, dx:  1, dy: -1, top: false },  // bottom-left
    { x: w, y: h, dx: -1, dy: -1, top: false }   // bottom-right
  ];

  for (const c of corners) {
    let closed;
    if (mobility === "stationary") closed = true;
    else if (mobility === "mobile") closed = false;
    else /* hybrid */ closed = c.top;
    if (closed) drawCornerL(c.x, c.y, c.dx, c.dy);
    else        drawCornerTick(c.x, c.y, c.dx, c.dy);
  }

  // State pip (top-left, inside the bracket) — small icon-like marker
  if (state === "destroyed") {
    g.lineStyle(2, 0xeb5757, 0.9);
    g.moveTo(armLen * 0.3, armLen * 0.3);
    g.lineTo(armLen * 0.9, armLen * 0.9);
    g.moveTo(armLen * 0.9, armLen * 0.3);
    g.lineTo(armLen * 0.3, armLen * 0.9);
  }

  token.addChild(g);
  token._ftRigCanon = g;
}

function _ftDrawBossPhaseRing(token) {
  if (!token?.actor || token.actor.type !== "boss") return;

  if (token._ftBossRing) {
    token.removeChild(token._ftBossRing);
    token._ftBossRing.destroy({ children: true });
    token._ftBossRing = null;
  }

  const sys = token.actor.system?.system ?? token.actor.system;
  const phases = sys?.phases ?? { ladder: [], currentPhase: 0 };
  const ladder = Array.isArray(phases.ladder) ? phases.ladder : [];
  const cur    = Math.max(0, Math.min(_FT_BOSS_PHASE_COLORS.length - 1, Number(phases.currentPhase) || 0));
  const total  = Math.max(1, ladder.length);

  const w = token.w ?? token.width  ?? 100;
  const h = token.h ?? token.height ?? 100;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) / 2 + 4;
  const color = _FT_BOSS_PHASE_COLORS[cur] ?? 0xcccccc;

  const g = new PIXI.Graphics();
  g.lineStyle(4, color, 0.85);
  g.drawCircle(cx, cy, radius);

  // Phase ladder pip arc — fills clockwise from top, segment per phase
  if (total > 1) {
    g.lineStyle(0);
    const segArc = (Math.PI * 2) / total;
    for (let i = 0; i < total; i++) {
      const angleStart = -Math.PI / 2 + i * segArc;
      const angleEnd   = angleStart + segArc * 0.85;  // small gap between segs
      const segColor   = i <= cur
        ? (_FT_BOSS_PHASE_COLORS[Math.min(i, _FT_BOSS_PHASE_COLORS.length - 1)] ?? color)
        : 0x444444;
      g.lineStyle(3, segColor, i <= cur ? 0.95 : 0.4);
      g.arc(cx, cy, radius + 6, angleStart, angleEnd, false);
    }
  }

  token.addChild(g);
  token._ftBossRing = g;
}

function _ftRefreshTokenCanonForActor(actor) {
  if (!canvas?.tokens) return;
  const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actor.id);
  for (const tok of tokens) {
    try {
      if (actor.type === "rig")  _ftDrawRigVisualCanon(tok);
      if (actor.type === "boss") _ftDrawBossPhaseRing(tok);
    } catch (e) { /* swallow */ }
  }
}

// Hooks
Hooks.on("drawToken", (token) => {
  try {
    if (token?.actor?.type === "rig")  _ftDrawRigVisualCanon(token);
    if (token?.actor?.type === "boss") _ftDrawBossPhaseRing(token);
  } catch (e) { /* swallow */ }
});

Hooks.on("updateActor", (actor, changes) => {
  if (actor?.type === "rig") {
    if (foundry.utils.hasProperty(changes, "system.identity.mobility")
     || foundry.utils.hasProperty(changes, "system.identity.state")) {
      _ftRefreshTokenCanonForActor(actor);
    }
  }
  if (actor?.type === "boss") {
    if (foundry.utils.hasProperty(changes, "system.phases.currentPhase")
     || foundry.utils.hasProperty(changes, "system.phases.ladder")) {
      _ftRefreshTokenCanonForActor(actor);
    }
  }
});



// ─── Carryover 1: Auto phase-advance on integrity threshold ────────────────
Hooks.on("updateActor", async (actor, changes) => {
  if (actor?.type !== "boss") return;
  if (!foundry.utils.hasProperty(changes, "system.integrity.value")) return;
  if (!game.user?.isGM) return;

  const sys = actor.system?.system ?? actor.system;
  const ladder = Array.isArray(sys?.phases?.ladder) ? sys.phases.ladder : [];
  if (!ladder.length) return;

  const cur = Math.max(0, Number(sys?.phases?.currentPhase ?? 0));
  const max = Number(sys?.integrity?.max ?? 0);
  if (max <= 0) return;
  const value = Number(sys?.integrity?.value ?? 0);
  const pct   = (value / max) * 100;

  let target = cur;
  for (let i = ladder.length - 1; i > cur; i--) {
    const t = Number(ladder[i].integrityThreshold ?? 100);
    if (pct <= t) { target = i; break; }
  }
  if (target <= cur) return;

  const update = { "system.phases.currentPhase": target };
  let surgeAdd = 0;
  const newGrants = [];
  for (let i = cur + 1; i <= target; i++) {
    const p = ladder[i];
    if (p?.surgeBoost) surgeAdd += Number(p.surgeBoost) || 0;
    if (Array.isArray(p?.manifestationGrants)) newGrants.push(...p.manifestationGrants);
  }
  if (surgeAdd) {
    const curSurge = Number(sys?.manifestations?.surge?.current ?? 0);
    const maxSurge = Number(sys?.manifestations?.surge?.max ?? 6);
    update["system.manifestations.surge.current"] = Math.min(maxSurge, curSurge + surgeAdd);
  }
  if (newGrants.length) {
    const lib = Array.isArray(sys?.manifestations?.library) ? [...sys.manifestations.library] : [];
    for (const uuid of newGrants) {
      if (uuid && !lib.includes(uuid)) lib.push(uuid);
    }
    update["system.manifestations.library"] = lib;
  }

  await actor.update(update);

  const targetEntry = ladder[target];
  const phaseLabel  = targetEntry?.label ?? `Phase ${target + 1}`;
  const esc = (s) => foundry.utils.escapeHTML?.(String(s)) ?? String(s);
  ChatMessage.create({
    speaker: { alias: actor.name },
    content: [
      `<div style="border-left:3px solid #d4a35f;padding-left:.5rem;">`,
      `<strong>${esc(actor.name)}</strong> enters <em>${esc(phaseLabel)}</em>.`,
      surgeAdd ? `<br><small>+${surgeAdd} Surge</small>` : "",
      newGrants.length ? `<br><small>+${newGrants.length} manifestation grant${newGrants.length === 1 ? "" : "s"}</small>` : "",
      `</div>`
    ].join("")
  });
});

// ─── Carryover 2: RETIRED 2026-05-14 (Damage Tracking Unification) ─────────
// Previously mirrored `bbttcc-raid.bossState[bossKey].damageStep` → boss
// actor's `system.integrity.value`. Replaced by the raid console writing
// integrity directly via `_applyDamageToActor` at round commit (see
// bbttcc-raid/scripts/module.raid-console.js — "Damage Tracking
// Unification 2026-05-13" block in _commitRound). The bossState world
// setting remains as a legacy read surface for behaviors / AI code that
// references damageStep; new code reads from integrity directly.

// ─── Carryover 3: Legacy config-app shim button binder ─────────────────────
// The retired rig-config-app.hbs and facility-config-app.hbs templates render
// a static shim with `[data-ft-shim-action]` buttons. Bind their handlers
// here so the legacy apps (which still pass through to these templates)
// route users to the new actor sheets.

Hooks.on("renderApplicationV2", (app, html) => {
  try {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const shimRoot = root.querySelector(".bbttcc-rig-config-shim, .bbttcc-facility-config-shim");
    if (!shimRoot) return;
    if (shimRoot.dataset.ftShimBound === "1") return;
    shimRoot.dataset.ftShimBound = "1";

    shimRoot.querySelectorAll("[data-ft-shim-action]").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const action = btn.dataset.ftShimAction;
        try {
          if (action === "create-rig") {
            const created = await Actor.create({ name: "New Rig", type: "rig" });
            if (created) created.sheet?.render(true);
            await app.close?.();
          } else if (action === "create-facility") {
            // Stationary rig = facility under the unified model
            const created = await Actor.create({
              name: "New Facility",
              type: "rig",
              system: { identity: { mobility: "stationary", state: "parked" } }
            });
            if (created) created.sheet?.render(true);
            await app.close?.();
          } else if (action === "open-actors-rigs") {
            ui.actors?.activate?.();
            ui.notifications?.info("Actors sidebar opened — filter by type 'rig'.");
          } else if (action === "show-legacy") {
            const cont = shimRoot.querySelector(".ft-legacy-dump") ?? (() => {
              const d = document.createElement("pre");
              d.className = "ft-legacy-dump";
              d.style.cssText = "margin-top:1rem;padding:.75rem;background:#111;color:#9c9;font-size:0.7rem;border:1px solid #444;border-radius:3px;max-height:300px;overflow:auto;white-space:pre-wrap;";
              shimRoot.appendChild(d);
              return d;
            })();
            const actor = app.actor ?? app.object ?? app.faction;
            const legacy = actor?.flags?.["bbttcc-factions"]?.rigs
                        ?? actor?.flags?.["bbttcc-territory"]?.facilities
                        ?? null;
            cont.textContent = legacy && Object.keys(legacy).length
              ? JSON.stringify(legacy, null, 2)
              : "(no legacy rig/facility data on this actor)";
          }
        } catch (e) {
          console.warn("Roll for Initiation | shim button failed", e);
          ui.notifications?.error("Shim action failed — see console.");
        }
      });
    });
  } catch (e) {
    console.warn("Roll for Initiation | shim binder failed", e);
  }
});

// ─── Phase 3 / G8 — Unified Raid HUD (2026-05-12) ──────────────────────────
// Top-of-canvas pill bar that appears when any raid console is open. Shows
// raid type · current round · phase · scenario meter (morale / alarm /
// influence / infiltration). Reads live state from the raid console's vm
// (`globalThis.__bbttccRaidOpenConsoles`) plus the target boss/rig actor
// for phase + meter values. Dismissible per session; re-shows on the
// next round commit.
//
// HTML overlay (not PIXI) — HUDs need text + buttons. Positioned `fixed`
// above the canvas via z-index. Foundry hooks `renderApplicationV2` +
// `closeApplicationV2` + `updateActor` drive re-renders.

let __ftRaidHudEl = null;
let __ftRaidHudDismissed = false;
let __ftRaidHudRenderTimer = null;

// HUD palette — three-faculty simplification (2026-05-12). Three canonical
// raid types + a generic `raid` fallback. Legacy 11-type keys still
// classified by `_ftClassifyRaidKind` below so old in-flight raids render
// with the right parent kind's color.
const _FT_RAID_KIND_PRESETS = {
  violence: { icon: "⚔", label: "Violence Raid",  color: "#eb5757" },
  intrigue: { icon: "🥷", label: "Intrigue Raid",  color: "#7ec0ff" },
  presence: { icon: "♕",  label: "Presence Raid",  color: "#d4a35f" },
  raid:     { icon: "⚡", label: "Raid",           color: "#d4a35f" }
};

function _ftActiveRaidConsole() {
  const consoles = globalThis.__bbttccRaidOpenConsoles;
  if (!consoles || !consoles.size) return null;
  for (const app of consoles) {
    if (app?.rendered) return app;
  }
  return null;
}

function _ftClassifyRaidKind(activityKey) {
  // Three-faculty simplification (2026-05-12). Maps any raid key — canonical
  // OR legacy — to the canonical violence/intrigue/presence. Falls back
  // through the raid registry (`raid.TYPES[key].raidType`) for the legacy
  // entries that carry an explicit canonical link, then fuzzy-matches by
  // string for unrecognized keys (mid-migration safety).
  const k = String(activityKey || "").toLowerCase();
  if (k === "violence" || k === "intrigue" || k === "presence") return k;
  try {
    const full = game.bbttcc?.api?.raid?.TYPES || {};
    const entry = full[k];
    if (entry?.raidType) return entry.raidType;
  } catch (_) { /* noop */ }
  // Fuzzy fallback (covers in-flight sessions before BC mapping is loaded).
  if (k.includes("infiltration") || k.includes("espionage")) return "intrigue";
  if (k.includes("courtly") || k.includes("intrigue") || k.includes("propaganda") || k.includes("diplom")) return "presence";
  if (k.includes("siege") || k.includes("assault") || k.includes("blockade") || k.includes("strike") || k.includes("attack")) return "violence";
  return "raid";
}

function _ftResolveRaidTargetActor(vm) {
  if (!vm) return null;
  const uuid = vm.targetUuid;
  if (uuid && typeof foundry?.utils?.fromUuidSync === "function") {
    try {
      const doc = foundry.utils.fromUuidSync(uuid);
      if (doc?.documentName === "Actor") return doc;
    } catch (_) { /* noop */ }
  }
  const defenderId = vm.defenderId;
  if (defenderId) {
    const defender = game.actors?.get(defenderId);
    if (defender) return defender;
  }
  return null;
}

function _ftBuildRaidHudHtml(consoleApp) {
  // S3a.4.2 — Accept the console APP (not just vm) so we can read live
  // scenario state from __infilScenario. Tolerate legacy callers that pass vm.
  const consoleVm = (consoleApp && typeof consoleApp === "object" && "vm" in consoleApp) ? consoleApp.vm : consoleApp;
  let infilState = null;
  try {
    const _app = (consoleApp && typeof consoleApp === "object" && "__infilScenario" in consoleApp) ? consoleApp : null;
    if (_app?.__infilScenario?.getState) infilState = _app.__infilScenario.getState();
  } catch (_) { /* noop */ }
  const rounds = Array.isArray(consoleVm?.rounds) ? consoleVm.rounds : [];
  const roundNo = rounds.length || 0;
  const lastRound = rounds[rounds.length - 1] ?? null;
  const activityKey = consoleVm?.activityKey ?? "raid";
  const kind = _ftClassifyRaidKind(activityKey);
  const preset = _FT_RAID_KIND_PRESETS[kind] ?? _FT_RAID_KIND_PRESETS.raid;
  const activityLabel = lastRound?.activityLabel || preset.label;
  const target = _ftResolveRaidTargetActor(consoleVm);
  const targetName = consoleVm?.targetName || target?.name || "—";

  const tgtSys  = target?.system?.system ?? target?.system ?? {};
  const morale  = Number(tgtSys?.raidStats?.morale)       ?? null;
  const moraleMax = Number(tgtSys?.raidProfile?.moraleHits) || 4;
  const alarm   = Number(tgtSys?.raidStats?.alarm)        || 0;
  const infilt  = Number(tgtSys?.raidStats?.infiltration) || 0;

  // 2026-05-13 — Phase pill is target-type-aware. Three modes:
  //   • Hex target: read bound Battle Scenes from
  //     `hex.flags.bbttcc-raid.battleScenes` + `currentSceneIdx` → show
  //     "Scene N/M — <label>" (the actual multi-scene progression).
  //   • Boss/creature target: read `phases.currentPhase` + `phases.ladder` →
  //     show the authored phase label (e.g., "Throned / Wounded / Broken").
  //   • Neither applies → omit the phase pill entirely (no more "Phase 1"
  //     fallback that doesn't mean anything).
  let phaseLabel = "";
  let phaseHasContent = false;
  const targetType = String(consoleVm?.targetType || "").toLowerCase();

  if (targetType === "hex" && consoleVm?.targetUuid) {
    try {
      const hexDoc = foundry?.utils?.fromUuidSync?.(consoleVm.targetUuid);
      const bs = hexDoc?.flags?.["bbttcc-raid"]?.battleScenes;
      const cur = Number(hexDoc?.flags?.["bbttcc-raid"]?.currentSceneIdx) || 0;
      if (Array.isArray(bs) && bs.length) {
        const entry = bs[cur] ?? bs[0];
        const sceneName = entry?.label || (entry?.sceneId ? (game.scenes?.get?.(entry.sceneId)?.name) : null) || `Scene ${cur + 1}`;
        phaseLabel = `Scene ${cur + 1}/${bs.length} — ${sceneName}`;
        phaseHasContent = true;
      }
    } catch (_) { /* noop */ }
  } else if (target) {
    const phaseIdx = Number(tgtSys?.phases?.currentPhase) || 0;
    const phaseLadder = Array.isArray(tgtSys?.phases?.ladder) ? tgtSys.phases.ladder : [];
    if (phaseLadder.length > 0) {
      const phaseEntry = phaseLadder[phaseIdx];
      phaseLabel = phaseEntry?.label || phaseEntry?.name || `Phase ${phaseIdx + 1}`;
      phaseHasContent = true;
    }
  }

  const integrityVal = Number(tgtSys?.integrity?.value) || 0;
  const integrityMax = Number(tgtSys?.integrity?.max)   || 0;

  const esc = (s) => foundry?.utils?.escapeHTML?.(String(s)) ?? String(s);

  // Scenario meter — picks the right axis for the raid kind
  let meterHtml = "";
  if (kind === "intrigue") {
    // S3a.4.2 — Read live state from __infilScenario when present (single
    // source of truth). Falls back to actor-flag reads for legacy sessions
    // that don't yet have a scenario attached.
    const aVal = infilState ? Number(infilState.alarm    || 0) : alarm;
    const aMax = infilState ? Number(infilState.alarmMax || 5) : 5;
    const pVal = infilState ? Number(infilState.progress    || 0) : 0;
    const pMax = infilState ? Number(infilState.progressMax || 0) : 0;
    const outcome = infilState?.outcome || "ongoing";
    const alarmColor = aVal >= aMax ? "#ef4444" : (aVal >= aMax - 1 ? "#fbbf24" : "#9ca3af");
    meterHtml = `<span title="Alarm" style="color:${alarmColor}">🚨 ${aVal}/${aMax}</span>`;
    if (pMax > 0) {
      const pColor = pVal >= pMax ? "#2dd4bf" : "#5eead4";
      meterHtml += `<span style="opacity:.6;">·</span><span title="Progress" style="color:${pColor}">🥷 ${pVal}/${pMax}</span>`;
    }
    if (outcome && outcome !== "ongoing") {
      const oMeta = ({ clean:["🥷 CLEAN","#2dd4bf"], messy:["⚠ MESSY","#fbbf24"], detected:["🚨 DETECTED","#ef4444"], lockdown:["🚨 LOCKDOWN","#ef4444"] })[outcome];
      if (oMeta) meterHtml += `<span style="opacity:.6;">·</span><span style="color:${oMeta[1]};font-weight:bold;">${oMeta[0]}</span>`;
    }
  } else if (kind === "presence") {
    meterHtml = `<span title="Influence" style="color:#d4a35f">♕ ${alarm || infilt || 0}</span>`;
  } else {
    // assault / siege / generic raid → morale + integrity
    if (Number.isFinite(morale) && morale !== null) {
      meterHtml = `<span title="Morale" style="color:#ff8c8c">❤ ${morale}/${moraleMax}</span>`;
    }
    if (integrityMax > 0) {
      const intPct = Math.round((integrityVal / integrityMax) * 100);
      const intColor = intPct > 66 ? "#a6e22e" : intPct > 33 ? "#e8c84a" : "#eb5757";
      meterHtml += (meterHtml ? `<span style="opacity:.6;">·</span>` : "") +
        `<span title="Integrity" style="color:${intColor}">⛨ ${integrityVal}/${integrityMax}</span>`;
    }
  }

  return `<div id="ft-raid-hud" class="ft-raid-hud" style="position:fixed;top:60px;z-index:120;display:flex;align-items:center;gap:.5rem;padding:.4rem .8rem;background:rgba(20,20,28,0.92);color:#ffd28a;border:1px solid ${preset.color};border-radius:6px;font-family:'Signika',sans-serif;font-size:0.85rem;box-shadow:0 4px 12px rgba(0,0,0,0.5);pointer-events:auto;backdrop-filter:blur(2px);">
    <span style="font-size:1rem;line-height:1;" title="${esc(kind)}">${preset.icon}</span>
    <strong style="color:${preset.color};">${esc(activityLabel)}</strong>
    <span style="opacity:.6;">·</span>
    <span>Round <b>${(kind === "intrigue" && infilState) ? Number(infilState.round || 0) : (roundNo || 1)}</b></span>
    ${phaseHasContent ? `<span style="opacity:.6;">·</span><span title="${targetType === "hex" ? "Battle scene progression" : "Boss phase"}">${esc(phaseLabel)}</span>` : ""}
    ${target ? `<span style="opacity:.6;">·</span><span style="opacity:.85;" title="Target">${esc(targetName)}</span>` : (consoleVm?.targetName ? `<span style="opacity:.6;">·</span><span style="opacity:.85;" title="Target">${esc(consoleVm.targetName)}</span>` : "")}
    ${meterHtml ? `<span style="opacity:.6;">·</span>${meterHtml}` : ""}
    <button type="button" class="ft-raid-hud-dismiss" title="Dismiss until next round" style="margin-left:.3rem;padding:0 .45rem;background:transparent;border:1px solid #666;color:#999;border-radius:3px;cursor:pointer;font-family:inherit;font-size:0.85rem;line-height:1.3;">×</button>
  </div>`;
}

// 2026-05-13 — Compute HUD position relative to the canvas BOARD center
// (not the full viewport) so the right-side GM sidebar doesn't obscure it.
// Vertical anchor sits below the BBTTCC top toolbar (#bbttcc-toolbar)
// when present so the HUD doesn't hide behind it. Falls back to a
// reasonable default offset otherwise.
function _ftPositionRaidHud() {
  if (!__ftRaidHudEl) return;
  let centerX = window.innerWidth / 2;
  const board = document.getElementById("board");
  if (board) {
    const rect = board.getBoundingClientRect();
    if (rect && rect.width > 0) centerX = rect.left + rect.width / 2;
  }
  // Find the bottom edge of any BBTTCC top-bar so we sit below it.
  let topY = 60; // sensible default if no toolbar exists
  const toolbar = document.getElementById("bbttcc-toolbar")
                ?? document.querySelector("[data-bbttcc-toolbar]")
                ?? document.querySelector(".bbttcc-toolbar");
  if (toolbar) {
    const tbar = toolbar.getBoundingClientRect();
    if (tbar && tbar.bottom > 0) topY = Math.round(tbar.bottom + 8);
  }
  __ftRaidHudEl.style.left = `${Math.round(centerX)}px`;
  __ftRaidHudEl.style.top  = `${topY}px`;
  __ftRaidHudEl.style.transform = "translateX(-50%)";
}

function _ftRenderRaidHud() {
  if (__ftRaidHudRenderTimer) {
    clearTimeout(__ftRaidHudRenderTimer);
    __ftRaidHudRenderTimer = null;
  }
  __ftRaidHudRenderTimer = setTimeout(() => {
    __ftRaidHudRenderTimer = null;
    try {
      const console_ = _ftActiveRaidConsole();
      // 2026-05-13 diagnostic — log the HUD render decision so empty-HUD
      // bugs can be diagnosed from the console.
      try {
        const set = globalThis.__bbttccRaidOpenConsoles;
        console.log("[fourththing:raid-hud] render check", {
          consolesInSet: set?.size ?? 0,
          renderedConsoleFound: !!console_,
          dismissed: __ftRaidHudDismissed,
          hudExists: !!__ftRaidHudEl,
          consoleNames: set ? Array.from(set).map(a => `${a?.constructor?.name}(rendered=${a?.rendered})`) : []
        });
      } catch (_) {}
      if (!console_ || __ftRaidHudDismissed) {
        if (__ftRaidHudEl) {
          __ftRaidHudEl.remove();
          __ftRaidHudEl = null;
        }
        return;
      }
      const html = _ftBuildRaidHudHtml(console_);
      if (!__ftRaidHudEl) {
        const tpl = document.createElement("div");
        tpl.innerHTML = html;
        __ftRaidHudEl = tpl.firstElementChild;
        document.body.appendChild(__ftRaidHudEl);
        _ftPositionRaidHud();
      } else {
        // Re-render in place to preserve transform/position. Replace
        // children rather than swap the element so click bindings
        // re-bind cleanly.
        const tpl = document.createElement("div");
        tpl.innerHTML = html;
        const next = tpl.firstElementChild;
        __ftRaidHudEl.innerHTML = next.innerHTML;
        // Refresh border color if kind changed
        __ftRaidHudEl.style.borderColor = next.style.borderColor;
        _ftPositionRaidHud();
      }
      __ftRaidHudEl.querySelector(".ft-raid-hud-dismiss")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        __ftRaidHudDismissed = true;
        if (__ftRaidHudEl) {
          __ftRaidHudEl.remove();
          __ftRaidHudEl = null;
        }
      }, { once: true });
    } catch (e) {
      console.warn("[fourththing] Raid HUD render failed", e);
    }
  }, 60);
}

// Trigger render whenever any AppV2 opens/closes (raid console included)
// and whenever a relevant actor updates. 2026-05-13 — also clear the
// dismissal flag whenever ANY raid console becomes the active one, not
// just on a class-name string match (the raid console's class name may
// differ from "raid" so the strict match silently failed to clear
// dismissal).
Hooks.on("renderApplicationV2", () => {
  if (globalThis.__bbttccRaidOpenConsoles?.size > 0) {
    __ftRaidHudDismissed = false;
  }
  _ftRenderRaidHud();
});

Hooks.on("closeApplicationV2", () => _ftRenderRaidHud());
Hooks.on("closeApplication",   () => _ftRenderRaidHud()); // V1 fallback

// S3a.4.2 — re-render HUD when infiltration scenario state changes so the
// alarm/progress meters update live without waiting for an AppV2 re-render.
Hooks.on("bbttcc:infiltration:alarmChanged",    () => _ftRenderRaidHud());
Hooks.on("bbttcc:infiltration:progressChanged", () => _ftRenderRaidHud());
Hooks.on("bbttcc:infiltration:outcomeResolved", () => _ftRenderRaidHud());

// 2026-05-13 — Belt-and-suspenders re-render on canvas ready and on a
// short timer after world ready, since the raid console may register
// itself in `__bbttccRaidOpenConsoles` AFTER our initial `ready` HUD
// render fires.
Hooks.on("canvasReady", () => _ftRenderRaidHud());

// Reposition the HUD when the viewport or sidebar geometry changes so it
// stays centered over the canvas board (not the full viewport).
window.addEventListener("resize", () => _ftPositionRaidHud());
Hooks.on("collapseSidebar", () => setTimeout(_ftPositionRaidHud, 50));
Hooks.on("expandSidebar",   () => setTimeout(_ftPositionRaidHud, 50));

Hooks.on("updateActor", (actor, changed) => {
  if (!actor) return;
  const raidStatsChanged = changed?.system?.raidStats || changed?.system?.phases;
  const sessionChanged   = changed?.flags?.["bbttcc-raid"]?.raidSession !== undefined;
  if (raidStatsChanged || sessionChanged) {
    // Round commit clears the dismissal so the player sees the new state
    if (sessionChanged) __ftRaidHudDismissed = false;
    _ftRenderRaidHud();
  }
});

Hooks.once("ready", () => _ftRenderRaidHud());

// ─── Phase 4B — Crew + Occult Battlemap Markers (2026-05-12) ──────────────
// PIXI token decorators showing affiliation identity above (Crews) and at
// the corner (Occult Associations). Mirrors `_ftDrawRigVisualCanon`. SCENE-
// GATED: skip the strategic hex map for performance — markers render only
// on battle scenes (anything that isn't the strategic map). Detection:
// scene flag `flags.fourththing.strategicMap === true` (explicit), OR
// scene contains hex drawings flagged with `bbttcc-territory` data.
//
// Affiliation source: replicates bbttcc-bridge.js `ftScanActorForAssetNames`
// inline (no cross-module dep). Reads identity flag from
// `bbttcc-character-options` AND scans actor items for "Crew Type:" /
// "Occult Association:" naming convention.
//
// Colors + glyphs are name-hashed (no canonical color exists in the
// schema) — stable per crew/association name across sessions.

const _FT_AFFIL_PALETTE = [
  0xd4a35f, 0x7ec0ff, 0xa6e22e, 0xeb5757, 0xff8ac4,
  0xb87fff, 0xe8c84a, 0x3ce67c, 0xff9a3c, 0x9bb4d8
];

const _FT_OCCULT_GLYPHS = ["✶", "❖", "✦", "✷", "☥", "✸", "✺", "❂", "✪", "❀"];

function _ftHashFromString(s) {
  const str = String(s || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function _ftHashColorFromString(s) { return _FT_AFFIL_PALETTE[_ftHashFromString(s) % _FT_AFFIL_PALETTE.length]; }
function _ftHashGlyphFromString(s) { return _FT_OCCULT_GLYPHS[_ftHashFromString(s) % _FT_OCCULT_GLYPHS.length]; }

// Strategic-map cache. WeakMap on scene doc — auto-clears on scene swap.
const _ftStrategicMapCache = new WeakMap();
function _ftSceneIsStrategicMap(scene) {
  if (!scene) return false;
  if (_ftStrategicMapCache.has(scene)) return _ftStrategicMapCache.get(scene);
  // Explicit battle-scene flag wins as override — a bound battle scene is
  // never treated as strategic even if it happens to carry hex drawings.
  if (scene.flags?.["bbttcc-raid"]?.battleScene === true) {
    _ftStrategicMapCache.set(scene, false);
    return false;
  }
  let isStrategic = !!(scene.flags?.fourththing?.strategicMap || scene.flags?.bbttcc?.strategicMap);
  if (!isStrategic) {
    try {
      const drawings = scene.drawings?.contents ?? Array.from(scene.drawings ?? []);
      isStrategic = drawings.some(d => d?.flags?.["bbttcc-territory"]);
    } catch (_) { /* noop */ }
  }
  _ftStrategicMapCache.set(scene, isStrategic);
  return isStrategic;
}

// Inline scan — mirrors bbttcc-bridge.js ftScanActorForAssetNames.
function _ftScanActorAffiliations(actor, kind) {
  if (!actor) return [];
  const out = new Set();
  const namePattern = kind === "crew"
    ? /^(?:Crew Type|Awesome Crew):\s*/i
    : /^(?:Occult Association|Occult):\s*/i;
  const idPrefix = kind === "crew" ? "crew-" : "occult-";
  const strip = (s) => String(s ?? "").replace(namePattern, "")
                                       .replace(/\s*\((?:Tier|T)\s*\d+\)\s*$/i, "")
                                       .trim();
  try {
    const blk = actor?.flags?.["bbttcc-character-options"]?.identity?.[kind];
    if (blk) {
      const raw = blk.displayName ?? blk.name ?? blk.label ?? "";
      const s = strip(raw);
      if (s) out.add(s);
    }
  } catch (_) {}
  try {
    for (const it of (actor.items ?? [])) {
      const nm = String(it?.name ?? "");
      const ident = String(it?.system?.identifier ?? "");
      if (namePattern.test(nm) || (ident && ident.startsWith(idPrefix))) {
        const s = strip(nm);
        if (s) out.add(s);
      }
    }
  } catch (_) {}
  return Array.from(out);
}

function _ftDrawCrewBanner(token) {
  if (!token?.actor) return;
  if (token._ftCrewBanner) {
    try { token.removeChild(token._ftCrewBanner); token._ftCrewBanner.destroy({ children: true }); } catch (_) {}
    token._ftCrewBanner = null;
  }
  if (_ftSceneIsStrategicMap(canvas?.scene)) return;
  if (!["character", "npc"].includes(token.actor.type)) return;

  const crews = _ftScanActorAffiliations(token.actor, "crew");
  if (!crews.length) return;

  const w = token.w ?? token.width ?? 100;
  const container = new PIXI.Container();
  container.eventMode = "none";

  const chipH = 13;
  const chipGap = 2;
  // Stack chips upward from just above the token
  let yOff = -(chipH + 4);
  for (let i = crews.length - 1; i >= 0; i--) {
    const name = crews[i];
    const color = _ftHashColorFromString(name);

    const txt = new PIXI.Text(name, new PIXI.TextStyle({
      fontFamily: "Signika, Arial, sans-serif",
      fontSize: 10,
      fill: 0xffd28a,
      stroke: 0x000000,
      strokeThickness: 2
    }));
    const padding = 12;
    const chipW = txt.width + padding;

    const chip = new PIXI.Graphics();
    chip.beginFill(0x000000, 0.65);
    chip.lineStyle(1.5, color, 0.95);
    chip.drawRoundedRect(0, 0, chipW, chipH, 2);
    chip.endFill();
    const tick = new PIXI.Graphics();
    tick.beginFill(color, 1);
    tick.drawRect(0, 2, 3, chipH - 4);
    tick.endFill();
    chip.addChild(tick);
    txt.position.set(6, 1);
    chip.addChild(txt);

    chip.x = (w - chipW) / 2;
    chip.y = yOff;
    container.addChild(chip);
    yOff -= (chipH + chipGap);
  }

  token.addChild(container);
  token._ftCrewBanner = container;
}

function _ftDrawOccultMarker(token) {
  if (!token?.actor) return;
  if (token._ftOccultMarker) {
    try { token.removeChild(token._ftOccultMarker); token._ftOccultMarker.destroy({ children: true }); } catch (_) {}
    token._ftOccultMarker = null;
  }
  if (_ftSceneIsStrategicMap(canvas?.scene)) return;
  if (!["character", "npc"].includes(token.actor.type)) return;

  const associations = _ftScanActorAffiliations(token.actor, "occult");
  if (!associations.length) return;

  const h = token.h ?? token.height ?? 100;
  const container = new PIXI.Container();
  container.eventMode = "none";

  const glyphSize = 14;
  let xOff = 2;
  for (const name of associations) {
    const color = _ftHashColorFromString(name);
    const glyph = _ftHashGlyphFromString(name);
    const cx = xOff + glyphSize * 0.55;
    const cy = h - glyphSize * 0.55 - 2;

    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.lineStyle(1.2, color, 0.95);
    bg.drawCircle(cx, cy, glyphSize * 0.55);
    bg.endFill();

    const txt = new PIXI.Text(glyph, new PIXI.TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: glyphSize - 3,
      fill: color
    }));
    txt.anchor.set(0.5, 0.5);
    txt.position.set(cx, cy);

    container.addChild(bg);
    container.addChild(txt);
    xOff += glyphSize + 2;
  }

  token.addChild(container);
  token._ftOccultMarker = container;
}

function _ftRefreshAffiliationsForActor(actor) {
  if (!canvas?.tokens) return;
  const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actor?.id);
  for (const tok of tokens) {
    try { _ftDrawCrewBanner(tok); } catch (_) {}
    try { _ftDrawOccultMarker(tok); } catch (_) {}
  }
}

// Hooks wiring. drawToken for initial paint; updateActor for identity-flag
// changes; createItem/deleteItem/updateItem for crew/occult-feature add/
// remove/rename; updateScene + canvasReady to bust the strategic-map cache.
Hooks.on("drawToken", (token) => {
  try {
    if (token?.actor?.type === "character" || token?.actor?.type === "npc") {
      _ftDrawCrewBanner(token);
      _ftDrawOccultMarker(token);
    }
  } catch (e) { console.warn("[fourththing] affiliation marker draw failed", e); }
});

Hooks.on("updateActor", (actor, changed) => {
  if (!actor || !["character", "npc"].includes(actor.type)) return;
  if (changed?.flags?.["bbttcc-character-options"]) _ftRefreshAffiliationsForActor(actor);
});

Hooks.on("createItem", (item) => {
  const a = item?.parent;
  if (a?.type === "character" || a?.type === "npc") _ftRefreshAffiliationsForActor(a);
});
Hooks.on("deleteItem", (item) => {
  const a = item?.parent;
  if (a?.type === "character" || a?.type === "npc") _ftRefreshAffiliationsForActor(a);
});
Hooks.on("updateItem", (item, changed) => {
  const a = item?.parent;
  if (!a || !["character","npc"].includes(a.type)) return;
  if (changed?.name !== undefined || changed?.system?.identifier !== undefined) {
    _ftRefreshAffiliationsForActor(a);
  }
});

Hooks.on("updateScene", (scene) => { _ftStrategicMapCache.delete(scene); });
Hooks.on("canvasReady", () => {
  if (!canvas?.tokens) return;
  for (const tok of canvas.tokens.placeables) {
    try {
      if (tok.actor?.type === "character" || tok.actor?.type === "npc") {
        _ftDrawCrewBanner(tok);
        _ftDrawOccultMarker(tok);
      }
    } catch (_) {}
  }
});

// ─── Phase 5 — Multi-scene Violence Raid Orchestrator (2026-05-12) ────────
// Binds Foundry scenes to hex drawings as a sequence of battle scenes.
// When a hex-target raid round resolves with success, prompts the GM to
// advance to the next bound battle scene. On final-scene success, flips
// the hex's `lastOutcome` flag (Occupation). Hex sheet gains a Battle
// Scenes panel showing the bound list with Activate / Unbind buttons and
// a "+ Bind Active Scene" button.
//
// Schema (on hex drawing):
//   flags["bbttcc-raid"].battleScenes:    [{ sceneId, label, order }, ...]
//   flags["bbttcc-raid"].currentSceneIdx: number (0-based index into the list)
//   flags["bbttcc-raid"].lastOutcome:     { kind, attackerId, attackerName, timestamp }
//
// Schema (on bound battle scene):
//   flags["bbttcc-raid"].battleScene: true   — also overrides strategic-map gate
//
// API exposed at `game.bbttcc.api.raid.battleScenes.*` for macros and
// downstream modules. Designed to be raid-type-agnostic (works for any
// hex-target raid), though primarily for Violence raids per the design.

function _ftGetHexBattleScenes(hexDoc) {
  const raw = hexDoc?.flags?.["bbttcc-raid"]?.battleScenes ?? [];
  return Array.isArray(raw) ? raw : [];
}
function _ftGetHexCurrentSceneIdx(hexDoc) {
  return Number(hexDoc?.flags?.["bbttcc-raid"]?.currentSceneIdx) || 0;
}
async function _ftSetHexBattleScenes(hexDoc, list) {
  if (!hexDoc?.update) return;
  await hexDoc.update(
    { "flags.bbttcc-raid.battleScenes": list },
    { parent: hexDoc.parent ?? null }
  );
}
async function _ftSetHexCurrentSceneIdx(hexDoc, idx) {
  if (!hexDoc?.update) return;
  await hexDoc.update(
    { "flags.bbttcc-raid.currentSceneIdx": Math.max(0, Number(idx) || 0) },
    { parent: hexDoc.parent ?? null }
  );
}

async function ftBindBattleSceneToHex(hexDoc, scene, opts = {}) {
  if (!hexDoc || !scene) return false;
  const list = _ftGetHexBattleScenes(hexDoc).slice();
  if (list.some(e => e.sceneId === scene.id)) {
    ui.notifications?.warn(`"${scene.name}" is already bound to this hex.`);
    return false;
  }
  list.push({ sceneId: scene.id, label: opts.label || scene.name, order: list.length });
  await _ftSetHexBattleScenes(hexDoc, list);
  try { await scene.update({ "flags.bbttcc-raid.battleScene": true }); } catch (_) {}
  _ftStrategicMapCache.delete(scene);
  ui.notifications?.info(`Bound "${scene.name}" as battle scene ${list.length}.`);
  return true;
}

async function ftUnbindBattleSceneFromHex(hexDoc, sceneId) {
  if (!hexDoc) return false;
  const list = _ftGetHexBattleScenes(hexDoc).filter(e => e.sceneId !== sceneId);
  await _ftSetHexBattleScenes(hexDoc, list);
  const cur = _ftGetHexCurrentSceneIdx(hexDoc);
  if (cur >= list.length) await _ftSetHexCurrentSceneIdx(hexDoc, Math.max(0, list.length - 1));
  ui.notifications?.info(`Battle scene unbound.`);
  return true;
}

async function ftActivateBattleScene(hexDoc, idx) {
  const list = _ftGetHexBattleScenes(hexDoc);
  const entry = list[idx];
  if (!entry) { ui.notifications?.warn(`No bound battle scene at index ${idx + 1}.`); return false; }
  const scene = game.scenes?.get(entry.sceneId);
  if (!scene) { ui.notifications?.warn(`Bound scene not found (it may have been deleted).`); return false; }
  if (!game.user?.isGM) {
    game.socket?.emit?.("module.bbttcc-raid", { t: "ft-activateBattleScene", sceneId: scene.id, hexUuid: hexDoc?.uuid, idx });
    ui.notifications?.info(`Requesting GM to activate "${scene.name}"…`);
    return true;
  }
  await scene.activate();
  await _ftSetHexCurrentSceneIdx(hexDoc, idx);
  return true;
}

function _ftFindHexDrawingById(hexId) {
  if (!hexId) return null;
  for (const scene of game.scenes ?? []) {
    const draw = scene.drawings?.get?.(hexId);
    if (draw) return draw;
  }
  return null;
}

// GM socket relay for player-triggered scene activation + boarding.
// 2026-05-18 diagnostic — log every message on every client so we can
// trace where the relay chain breaks. Handle on any active GM; for
// idempotent ops (scene activate) the duplicate is harmless. For
// boarding we de-dupe with a recent-payload cache.
console.log("[ft:relay] file-load mark reached at relay-block top");
const __ftRelaySeen = new Map();
function _ftRelaySeenRecently(key, windowMs = 3000) {
  const now = Date.now();
  for (const [k, t] of __ftRelaySeen) if (now - t > windowMs) __ftRelaySeen.delete(k);
  if (__ftRelaySeen.has(key)) return true;
  __ftRelaySeen.set(key, now);
  return false;
}
function _ftRelayHandler(channel) {
  return (msg) => {
    try {
      console.log(`[ft:relay] RECEIVED on ${channel}`, msg, "isGM=", !!game.user?.isGM, "userId=", game.user?.id);
      if (msg?.t === "ft-relay-ping") {
        console.log(`[ft:relay] PING from user ${msg.fromUserId} (${msg.fromName}) on ${channel}`);
        return;
      }
      if (!game.user?.isGM) return;
      if (msg?.t === "ft-activateBattleScene") {
        if (_ftRelaySeenRecently(`activate:${msg.sceneId}:${msg.idx}`)) return;
        const scene = game.scenes?.get(msg.sceneId);
        if (!scene) return;
        const hex = msg.hexUuid ? foundry.utils.fromUuidSync(msg.hexUuid) : null;
        scene.activate().then(() => {
          if (hex) _ftSetHexCurrentSceneIdx(hex, Number(msg.idx) || 0);
        });
      } else if (msg?.t === "ft-boardRig") {
        if (_ftRelaySeenRecently(`board:${msg.stewardId}:${msg.rigId}`)) return;
        const steward = game.actors?.get(msg.stewardId);
        const rig     = game.actors?.get(msg.rigId);
        if (!steward || !rig) { console.warn("[ft:relay] ft-boardRig missing actor(s)", msg); return; }
        console.log("[ft:relay] handling ft-boardRig", steward.name, "→", rig.name);
        ftBoardRig(steward, rig, msg.role || null);
      } else if (msg?.t === "ft-disembarkSteward") {
        if (_ftRelaySeenRecently(`disembark:${msg.stewardId}`)) return;
        const steward = game.actors?.get(msg.stewardId);
        if (!steward) { console.warn("[ft:relay] ft-disembarkSteward missing steward", msg); return; }
        console.log("[ft:relay] handling ft-disembarkSteward", steward.name);
        ftDisembarkSteward(steward);
      }
    } catch (e) {
      console.error("[ft:relay] handler threw", e);
    }
  };
}
function _ftRegisterRelayListeners(reason) {
  try {
    if (!game?.socket) { console.warn(`[ft:relay] (${reason}) no game.socket`); return; }
    if (globalThis.__ftRelayRegistered) { console.log(`[ft:relay] (${reason}) already registered, skipping`); return; }
    globalThis.__ftRelayRegistered = true;
    console.log(`[ft:relay] (${reason}) registering listeners — isGM=`, !!game.user?.isGM, "userId=", game.user?.id);
    game.socket.on("system.fourththing", _ftRelayHandler("system.fourththing"));
    game.socket.on("module.bbttcc-raid", _ftRelayHandler("module.bbttcc-raid"));
    setTimeout(() => {
      const pingPayload = { t: "ft-relay-ping", fromUserId: game.user?.id, fromName: game.user?.name };
      console.log("[ft:relay] emit ping on system.fourththing", pingPayload);
      game.socket?.emit?.("system.fourththing", pingPayload);
    }, 500);
  } catch (e) {
    console.error("[ft:relay] register threw", e);
  }
}
// Register at file-load AND at ready (defensive: in case `ready` already
// fired by the time this file was parsed, or in case Hooks.once silently
// dropped this callback).
if (typeof game !== "undefined" && game?.socket) {
  _ftRegisterRelayListeners("file-load");
}
Hooks.on("ready", () => _ftRegisterRelayListeners("ready-hook-on"));
Hooks.once("ready", () => _ftRegisterRelayListeners("ready-hook-once"));

// Expose API for macros + other modules.
Hooks.once("ready", () => {
  game.bbttcc ??= { api: {} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.raid ??= {};
  game.bbttcc.api.raid.battleScenes = {
    list:     _ftGetHexBattleScenes,
    current:  _ftGetHexCurrentSceneIdx,
    bind:     ftBindBattleSceneToHex,
    unbind:   ftUnbindBattleSceneFromHex,
    activate: ftActivateBattleScene
  };
});

// Hex sheet panel injection — adds a "Battle Scenes" UI to the
// BBTTCC_HexSheet. Reads `app._hexDoc` for the underlying drawing.
Hooks.on("renderApplicationV2", (app, html) => {
  try {
    const className = app?.constructor?.name ?? "";
    if (!className.includes("HexSheet") && !className.includes("BBTTCC_Hex")) return;
    const hexDoc = app._hexDoc ?? app.document ?? app.drawing ?? app.object;
    if (!hexDoc) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    if (root.querySelector(".ft-battle-scenes-panel")) return;

    const list = _ftGetHexBattleScenes(hexDoc);
    const currentIdx = _ftGetHexCurrentSceneIdx(hexDoc);
    const outcome = hexDoc.flags?.["bbttcc-raid"]?.lastOutcome;
    const isGM = !!game.user?.isGM;
    const esc = (s) => foundry?.utils?.escapeHTML?.(String(s)) ?? String(s);

    const itemsHtml = list.length ? list.map((entry, i) => {
      const isCurrent = i === currentIdx;
      const indicator = isCurrent ? '<span style="color:#a6e22e;font-weight:bold;">▶</span>' : `<span style="opacity:0.5;">${i + 1}.</span>`;
      const name = esc(entry.label || entry.sceneId);
      return `<div class="ft-bs-row" style="display:flex;align-items:center;gap:.4rem;padding:.2rem .35rem;border-radius:3px;${isCurrent ? "background:rgba(166,226,46,0.08);" : ""}">
        <span style="flex:0 0 1.2em;text-align:center;">${indicator}</span>
        <span style="flex:1 1 auto;color:#ffd28a;">${name}</span>
        <button type="button" class="ft-bs-activate" data-idx="${i}" style="font-size:0.72rem;padding:.1rem .4rem;background:rgba(212,163,95,0.18);border:1px solid #d4a35f;color:#ffd28a;border-radius:3px;cursor:pointer;">Activate</button>
        ${isGM ? `<button type="button" class="ft-bs-unbind" data-scene-id="${esc(entry.sceneId)}" title="Unbind" style="font-size:0.72rem;padding:.1rem .35rem;background:rgba(235,87,87,0.12);border:1px solid #666;color:#bbb;border-radius:3px;cursor:pointer;">×</button>` : ""}
      </div>`;
    }).join("") : `<p style="margin:.2rem 0;font-style:italic;opacity:0.6;font-size:0.78rem;">No battle scenes bound. ${isGM ? "Use the button below or the API." : "Ask the GM to bind scenes."}</p>`;

    const bindBtnHtml = isGM ? `<button type="button" class="ft-bs-bind" style="margin-top:.4rem;font-size:0.76rem;padding:.25rem .6rem;background:rgba(166,226,46,0.12);border:1px solid #a6e22e;color:#a6e22e;border-radius:3px;cursor:pointer;">+ Bind Active Scene</button>` : "";
    const outcomeHtml = outcome ? `<p style="margin:.35rem 0 0;font-size:0.74rem;color:#a6e22e;">Last raid: <b>${esc(outcome.kind || "")}</b>${outcome.attackerName ? ` by ${esc(outcome.attackerName)}` : ""}</p>` : "";

    // 2026-05-13 — Render the panel as a `bbttcc-hex-card` matching the
    // hex sheet's other cards (Resources, Quests, GM Notes), and insert
    // it inside the right-column scroller alongside them. Previously the
    // panel was appended to `.window-content` (outermost), which placed
    // it BELOW the two-column grid and partially offscreen.
    const panel = document.createElement("div");
    panel.className = "bbttcc-hex-card ft-battle-scenes-panel";
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-weight:800;">⚔ Battle Scenes</div>
        ${bindBtnHtml.replace('class="ft-bs-bind"', 'class="ft-bs-bind bbttcc-btn bbttcc-btn-small"')}
      </div>
      <div class="ft-bs-list" style="display:flex;flex-direction:column;gap:.2rem;">${itemsHtml}</div>
      ${outcomeHtml}`;

    panel.querySelectorAll(".ft-bs-activate").forEach(btn => btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await ftActivateBattleScene(hexDoc, Number(btn.dataset.idx));
    }));
    panel.querySelectorAll(".ft-bs-unbind").forEach(btn => btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const sceneId = btn.dataset.sceneId;
      if (!sceneId) return;
      const ok = await Dialog.confirm({ title: "Unbind battle scene", content: "<p>Remove this scene from the hex's battle scene list? The scene itself won't be deleted.</p>" });
      if (!ok) return;
      await ftUnbindBattleSceneFromHex(hexDoc, sceneId);
      app.render?.(false);
    }));
    panel.querySelector(".ft-bs-bind")?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const scene = canvas?.scene;
      if (!scene) { ui.notifications?.warn("No active scene to bind."); return; }
      if (_ftSceneIsStrategicMap(scene)) {
        const ok = await Dialog.confirm({ title: "Bind strategic map?", content: "<p>This scene looks like a strategic hex map. Bind anyway? (Usually you want a separate battle scene.)</p>" });
        if (!ok) return;
      }
      await ftBindBattleSceneToHex(hexDoc, scene);
      app.render?.(false);
    });

    // Insertion target: prefer the right-column scroller next to Quests/
    // GM Notes. Fall back to main.bbttcc-pane, then .window-content.
    const mainPane = root.querySelector("main.bbttcc-pane");
    const scroller = mainPane?.querySelector(".bbttcc-pane-scroll") ?? mainPane;
    if (scroller) {
      // Insert just before the Quests card if present (cards order:
      // Resources → ... → Battle Scenes → Quests → GM Notes).
      const questsCard = scroller.querySelector('[data-bbttcc-quests-card="1"]');
      if (questsCard) {
        scroller.insertBefore(panel, questsCard);
      } else {
        scroller.appendChild(panel);
      }
    } else {
      const body = root.querySelector(".window-content") ?? root;
      body.appendChild(panel);
    }
  } catch (e) { console.warn("[fourththing] battle-scenes panel injection failed", e); }
});

// Bridge new actor-type bosses into the raid console's boss registry
// (2026-05-12 playtest fix). The raid console reads bosses from
// `game.bbttcc.api.raid.boss` via `bossApi.list()` / `bossApi.get(key)`.
// Legacy pattern was per-boss files (bosses.gloomgill.js) calling
// `registerBoss(key, def)` at world-ready. Our fourththing actor-type
// bosses carry the same shape in `actor.system.raidProfile` etc. but
// never auto-register, so they don't appear in the creature picker.
// This bridge auto-registers every boss-type actor on ready, and keeps
// the registry in sync on create/update/delete.
// Polls until a probe returns truthy; resolves with the value or null on
// timeout. Used to wait for the bbttcc-raid module's APIs to attach during
// world load — there's a race window where fourththing's `ready` hook can
// fire before bbttcc-raid's `_attach()` has run, especially with many
// modules loaded.
async function _ftWaitForApi(probe, { timeoutMs = 5000, intervalMs = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const v = probe(); if (v) return v; } catch (_) {}
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return null;
}

Hooks.once("ready", async () => {
  try {
    const bossApi = await _ftWaitForApi(() => {
      const api = game.bbttcc?.api?.raid?.boss;
      return api?.registerBoss ? api : null;
    });
    if (!bossApi) {
      console.warn("[fourththing] boss bridge: raid.boss API never appeared after 5s — skipping");
      return;
    }
    console.log("[fourththing] boss bridge: raid.boss API ready, attaching bridge");

    function _ftBuildBossDefFromActor(actor) {
      const sys = actor.system?.system ?? actor.system ?? {};
      const profile = sys.raidProfile ?? {};
      const doctrine = sys.doctrine  ?? {};
      const behaviorsBlock = sys.behaviors ?? {};
      const ladder = Array.isArray(sys.phases?.ladder) ? sys.phases.ladder : [];

      let hitTrack = profile.hitTrack;
      if (typeof hitTrack === "string") {
        hitTrack = hitTrack.split(",").map(s => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(hitTrack) || !hitTrack.length) {
        // Fall back to phase ladder labels if no explicit hitTrack
        hitTrack = ladder.map(p => String(p?.label || p?.name || "")).filter(Boolean);
      }

      const tags = (typeof profile.tagsRaw === "string"
        ? profile.tagsRaw.split(",").map(s => s.trim()).filter(Boolean)
        : (Array.isArray(profile.tags) ? profile.tags : []));

      return {
        label: actor.name,
        mode: String(profile.mode || "abstract"),
        tags,
        hitTrack: hitTrack.length ? hitTrack : undefined,
        moraleHits: Number(profile.moraleHits) || 1,
        stats: (profile.opStats && typeof profile.opStats === "object") ? profile.opStats : {},
        maneuverKeys: Array.isArray(doctrine.maneuverKeys) ? doctrine.maneuverKeys : [],
        behaviors: Array.isArray(behaviorsBlock.behaviors) ? behaviorsBlock.behaviors : [],
        presentation: { image: actor.img || "" },
        meta: { actorId: actor.id, actorUuid: actor.uuid }
      };
    }

    function _ftBossKey(actor) {
      // Prefer the GM-authored `raidProfile.key` slug (matches the older
      // Phase 7 bridge AND the legacy boss registry pattern, e.g.,
      // "hex-warlord"). Fall back to actor.id only when no slug is set.
      const sys = actor?.system?.system ?? actor?.system ?? {};
      const slug = String(sys?.raidProfile?.key ?? "").trim();
      return slug || actor.id;
    }

    function _ftSyncBossActor(actor) {
      if (!actor || actor.type !== "boss") return;
      try {
        bossApi.registerBoss(_ftBossKey(actor), _ftBuildBossDefFromActor(actor));
        // Auto-link prototype token so canvas-token damage updates the base
        // actor's `system.integrity.value` (otherwise unlinked tokens hold
        // synthetic actorData overrides and the base actor stays unchanged).
        if (actor.prototypeToken?.actorLink !== true) {
          actor.update({ "prototypeToken.actorLink": true }).catch(() => {});
        }
      } catch (e) {
        console.warn(`[fourththing] boss bridge: failed to register "${actor.name}"`, e);
      }
    }

    // 2026-05-13 — Extended to cover BOTH bosses AND rigs. Same problem:
    // unlinked tokens hold synthetic actorData; damage writes get lost on
    // the canvas while the base sheet stays full HP. Linked tokens
    // propagate writes cleanly to the base actor.
    const _ftLinkableTypes = new Set(["boss", "rig"]);

    async function _ftLinkExistingTokens() {
      try {
        let relinked = 0;
        for (const scene of (game.scenes?.contents ?? [])) {
          const updates = [];
          for (const t of (scene.tokens?.contents ?? [])) {
            if (_ftLinkableTypes.has(t.actor?.type) && !t.actorLink) {
              updates.push({ _id: t.id, actorLink: true });
            }
          }
          if (updates.length) {
            await scene.updateEmbeddedDocuments("Token", updates);
            relinked += updates.length;
          }
        }
        if (relinked) console.log(`[fourththing] auto-link sweep: relinked ${relinked} deployed boss/rig token(s)`);
      } catch (e) {
        console.warn("[fourththing] auto-link sweep failed", e);
      }
    }

    // 2026-05-13 — Auto-link RIG actors' prototype tokens too (mirroring the
    // boss bridge auto-link). New tokens placed AFTER this point are
    // linked by default.
    function _ftEnsureRigsLinked() {
      try {
        for (const actor of (game.actors?.contents ?? [])) {
          if (actor.type !== "rig") continue;
          if (actor.prototypeToken?.actorLink !== true) {
            actor.update({ "prototypeToken.actorLink": true }).catch(() => {});
          }
        }
      } catch (e) { console.warn("[fourththing] rig prototype-link sweep failed", e); }
    }

    // 2026-05-13 — Catch any NEW token placement and force-link if it's a
    // boss/rig type. Handles the timing gap where a token is dropped on
    // canvas before the prototype-token auto-link sweep can take effect.
    Hooks.on("createToken", async (tokenDoc) => {
      try {
        if (!_ftLinkableTypes.has(tokenDoc?.actor?.type)) return;
        if (tokenDoc.actorLink) return;
        await tokenDoc.update({ actorLink: true });
        console.log(`[fourththing] auto-linked new ${tokenDoc.actor.type} token: ${tokenDoc.name}`);
      } catch (e) { console.warn("[fourththing] createToken auto-link failed", e); }
    });

    // Initial bulk register
    let count = 0;
    for (const actor of (game.actors?.contents ?? [])) {
      if (actor.type === "boss") {
        _ftSyncBossActor(actor);
        count++;
      }
    }
    console.log(`[fourththing] boss bridge: registered ${count} actor-type bosses with raid registry`);
    _ftEnsureRigsLinked();
    _ftLinkExistingTokens();

    // Keep in sync on actor changes
    Hooks.on("createActor", (actor) => {
      if (actor?.type === "boss") _ftSyncBossActor(actor);
    });
    Hooks.on("updateActor", (actor, changed) => {
      if (actor?.type !== "boss") return;
      const relevant = changed?.name !== undefined
        || changed?.img  !== undefined
        || changed?.system?.raidProfile
        || changed?.system?.doctrine
        || changed?.system?.behaviors
        || changed?.system?.phases?.ladder;
      if (relevant) _ftSyncBossActor(actor);
    });
    Hooks.on("deleteActor", (actor) => {
      if (actor?.type === "boss" && typeof bossApi.unregisterBoss === "function") {
        try { bossApi.unregisterBoss(actor.id); } catch (_) {}
      }
    });

    // RETIRED 2026-05-14 (Damage Tracking Unification). The `updateSetting`
    // hook that mirrored `bbttcc-raid.bossState[bossKey].damageStep` →
    // `system.phases.currentPhase` + `system.raidStats.morale` is no longer
    // needed: the phase is derived from integrity in prepareDerivedData,
    // and morale was deprecated as a boss-level concept (bosses have
    // integrity + phases; morale lives on factions). The raid console
    // writes integrity directly at round commit. See raid-console.js
    // "Damage Tracking Unification" comment in _commitRound + the
    // unified _ensureRoundBossMeta read path.
  } catch (e) {
    console.warn("[fourththing] boss bridge init failed", e);
  }
});

// Wrap raid.applyPostRoundEffects to drive the orchestrator. Composes
// safely on top of victory/morale/post2turn wraps via the
// previous-function-capture pattern.
Hooks.once("ready", async () => {
  const raid = await _ftWaitForApi(() => {
    const r = game.bbttcc?.api?.raid;
    return (r && typeof r.applyPostRoundEffects === "function") ? r : null;
  });
  if (!raid) {
    console.warn("[fourththing] Phase 5 orchestrator: raid.applyPostRoundEffects never appeared after 5s — skipping");
    return;
  }
  console.log("[fourththing] Phase 5 orchestrator: wrapping applyPostRoundEffects");
  const orig = raid.applyPostRoundEffects;
  raid.applyPostRoundEffects = async function ftPhase5Wrap(args = {}) {
    const res = await orig(args);
    try {
      // 2026-05-13 diagnostic — log every decision point so the advance-
      // prompt-not-firing bug can be diagnosed from the console.
      const targetHexId = args?.targetHexId;
      const success = args?.success === true;
      console.log("[fourththing:phase5] applyPostRoundEffects fired", {
        targetHexId,
        success,
        hasOutcome: !!args?.outcome,
        outcome: args?.outcome,
        attackerId: args?.attackerId,
        defenderId: args?.defenderId
      });
      if (!targetHexId) {
        console.log("[fourththing:phase5] BAIL — no targetHexId in args (round wasn't against a hex target, or hex target id wasn't recorded)");
        return res;
      }

      const hexDoc = _ftFindHexDrawingById(targetHexId);
      if (!hexDoc) {
        console.log(`[fourththing:phase5] BAIL — hex drawing not found for id ${targetHexId} (drawing may have been deleted)`);
        return res;
      }
      const list = _ftGetHexBattleScenes(hexDoc);
      console.log(`[fourththing:phase5] hex ${hexDoc.id} has ${list.length} bound battle scene(s)`);
      if (!list.length) {
        console.log("[fourththing:phase5] BAIL — no battle scenes bound to this hex (bind some via the hex sheet panel)");
        return res;
      }

      const currentIdx = _ftGetHexCurrentSceneIdx(hexDoc);
      const nextIdx = currentIdx + 1;
      const isFinal = currentIdx >= list.length - 1;
      console.log(`[fourththing:phase5] currentSceneIdx=${currentIdx}, nextIdx=${nextIdx}, isFinal=${isFinal}, success=${success}`);

      if (!success) {
        console.log("[fourththing:phase5] BAIL — round was not a success; failure means GM resolves manually");
        return res;
      }

      if (!isFinal) {
        // Prompt to advance — GM-only (the prompt would be noise for players)
        if (!game.user?.isGM) {
          console.log("[fourththing:phase5] BAIL — not GM; advance prompt is GM-only");
          return res;
        }
        const entry = list[nextIdx];
        const scene = entry ? game.scenes?.get(entry.sceneId) : null;
        if (!scene) {
          console.log(`[fourththing:phase5] BAIL — next scene entry resolves to no scene doc (entry=`, entry, ")");
          return res;
        }
        console.log(`[fourththing:phase5] FIRING advance prompt for scene ${scene.id} (${scene.name})`);
        Dialog.confirm({
          title: "Advance to Next Battle Scene?",
          content: `<p>Round resolved successfully. Advance to <b>${entry.label || scene.name}</b> (${nextIdx + 1} of ${list.length})?</p>`,
          yes: async () => { await ftActivateBattleScene(hexDoc, nextIdx); }
        });
      } else {
        // Final scene — flip the hex to Occupation outcome
        const attackerId = args?.attackerId ?? args?.attacker ?? null;
        const attacker = attackerId ? game.actors?.get(String(attackerId)) : null;
        if (game.user?.isGM) {
          await hexDoc.update({
            "flags.bbttcc-raid.lastOutcome": {
              kind: "occupation",
              attackerId: attackerId || null,
              attackerName: attacker?.name || "",
              timestamp: Date.now()
            }
          }, { parent: hexDoc.parent ?? null });
        }
        ChatMessage.create({
          content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#a6e22e">⚑ Raid Victory — Hex Outcome: Occupation</span></div>
            <p style="margin:.2rem 0;font-size:0.82rem">Final battle scene resolved. Hex flips to <b>${attacker?.name || "attacker"}</b>'s control.</p>
            <p style="margin:.2rem 0;font-size:0.74rem;opacity:0.75">GM may apply liberation outcome instead if appropriate to the campaign state.</p></div>`
        });
      }
    } catch (e) { console.warn("[fourththing] Phase 5 orchestrator wrap failed", e); }
    return res;
  };
  console.log("[fourththing] Phase 5 orchestrator: wrapped raid.applyPostRoundEffects");
});

// ─── Phase 5.5 — Tactical Resolution override (2026-05-13) ──────────────────
// Bridges the strategic raid round and the tactical battle scene. When a
// round is open and the GM has just finished a tactical fight on the
// bound battle scene, they can mark the round Attacker-Won / Defender-Won
// / Stalemate directly instead of letting the strategic dice roll.
//
// Implementation: render hook injects three buttons next to each round's
// existing Commit button. Click handler commits the round with the manual
// outcome by calling `applyPostRoundEffects` directly with the chosen
// success flag, then marks the round closed + re-renders. Strategic dice
// roll is bypassed entirely on this path.

async function _ftCommitRoundTactical(consoleApp, roundIdx, outcomeKind) {
  if (!consoleApp?.vm?.rounds) return;
  if (!game.user?.isGM) {
    ui.notifications?.warn?.("Only the GM can resolve tactical outcomes.");
    return;
  }
  const r = consoleApp.vm.rounds[roundIdx];
  if (!r) return ui.notifications?.warn?.(`Round ${roundIdx + 1} not found.`);
  if (r.committed) return ui.notifications?.warn?.(`Round ${roundIdx + 1} already committed.`);

  const isWin = outcomeKind === "win";
  const isStalemate = outcomeKind === "stalemate";

  // Stamp the round with the manual outcome + close it.
  r.tacticalOutcome  = outcomeKind;
  r.outcome          = isWin ? "Tactical Win" : (isStalemate ? "Tactical Stalemate" : "Tactical Loss");
  r.total            = null;   // No dice were rolled
  r.dcFinal          = null;
  r.open             = false;
  r.committed        = true;
  r.committedAt      = Date.now();
  r.committedVia     = "tactical-resolution";

  // Resolve attacker/defender for the post-round hook.
  const attackerId = r.attackerId;
  const defenderId = r.defenderId || null;

  // Maneuver lists (empty if not staged).
  const maneuversAtt = Array.isArray(r.mansSelected)    ? r.mansSelected.slice()    : [];
  const maneuversDef = Array.isArray(r.mansSelectedDef) ? r.mansSelectedDef.slice() : [];

  // Hex target id if applicable (drives Phase 5 orchestrator's advance logic).
  const targetHexId = (r.targetType === "hex") ? (r.targetHexId || (r.targetUuid ? String(r.targetUuid).split(".").pop() : null)) : null;
  console.log("[fourththing:tactical-commit]", {
    roundIdx,
    outcomeKind,
    targetType: r.targetType,
    targetHexId,
    targetUuid: r.targetUuid,
    attackerId,
    isWin
  });

  // Call applyPostRoundEffects — this runs the existing Unity/morale
  // enhancers PLUS my Phase 5 orchestrator wrap (scene advance on success,
  // occupation flip on final-scene victory).
  try {
    const post = game.bbttcc?.api?.raid?.applyPostRoundEffects;
    if (typeof post === "function") {
      await post({
        attackerId, defenderId,
        success: isWin,
        outcome: isStalemate ? "stalemate" : (isWin ? "win" : "loss"),
        maneuversAtt, maneuversDef,
        targetHexId
      });
    }
  } catch (e) { console.warn("[fourththing] tactical commit: post-round failed", e); }

  // Persist + re-render the console.
  try { await consoleApp._saveSessionNow?.(); } catch (_) {}
  try { await consoleApp.render(false); } catch (_) {}

  // Chat card so the table sees the resolution.
  const attacker = attackerId ? game.actors?.get(String(attackerId)) : null;
  const defender = defenderId ? game.actors?.get(String(defenderId)) : null;
  const label = isWin ? "Attacker Wins" : (isStalemate ? "Stalemate" : "Defender Wins");
  const color = isWin ? "#a6e22e" : (isStalemate ? "#e8c84a" : "#eb5757");
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker || defender || null }),
    content: `<div class="fourththing-roll">
      <div class="ft-roll-header"><span class="ft-roll-name" style="color:${color}">🎯 Tactical Resolution — Round ${roundIdx + 1}</span></div>
      <p style="margin:.2rem 0;font-size:0.82rem">${attacker?.name || "Attacker"} vs ${defender?.name || "Defender/Hex"} — GM-resolved from tactical combat: <b>${label}</b></p>
      <p style="margin:.2rem 0;font-size:0.74rem;opacity:0.75">Strategic dice bypassed. Post-round effects applied normally.</p>
    </div>`
  });
}

// Render hook — injects Tactical Resolution buttons into each open round's
// commit row on the raid console. Inert for non-GM clients.
Hooks.on("renderApplicationV2", (app) => {
  try {
    if (!game.user?.isGM) return;
    if (!app?.constructor?.name?.toLowerCase?.().includes("raid")) return;
    if (!app?.vm?.rounds) return;
    const root = app.element instanceof HTMLElement ? app.element : (app.element?.[0]);
    if (!root) return;

    // For each round row, find the Commit button area and inject our buttons
    // before it. Skip if already injected.
    const rows = root.querySelectorAll('tr[data-idx]');
    rows.forEach(tr => {
      const idx = Number(tr.dataset.idx);
      if (!Number.isFinite(idx) || idx < 0) return;
      const r = app.vm.rounds[idx];
      if (!r || r.committed) return; // already committed
      // Find the row with the Commit (Roll) button
      const commitBtn = tr.querySelector('[data-manage-act="commit"]');
      if (!commitBtn) return;
      // Skip if we already injected for this row
      if (tr.querySelector('.ft-tactical-resolution')) return;

      const wrap = document.createElement("div");
      wrap.className = "ft-tactical-resolution";
      wrap.style.cssText = "display:flex;align-items:center;gap:.3rem;margin-right:.5rem;padding:.2rem .35rem;border-radius:4px;background:rgba(20,20,28,0.4);border:1px dashed rgba(212,163,95,0.4);";
      wrap.innerHTML = `
        <span style="font-size:0.7rem;letter-spacing:.04em;color:#d4a35f;text-transform:uppercase;">🎯 Tactical:</span>
        <button type="button" class="btn" data-ft-tactical="win"       title="GM: Attacker won the tactical engagement" style="padding:.15rem .4rem;font-size:0.75rem;background:rgba(166,226,46,0.15);border:1px solid #a6e22e;color:#a6e22e;border-radius:3px;cursor:pointer;font-weight:600;">⚔ Att</button>
        <button type="button" class="btn" data-ft-tactical="loss"      title="GM: Defender won the tactical engagement" style="padding:.15rem .4rem;font-size:0.75rem;background:rgba(235,87,87,0.15);border:1px solid #eb5757;color:#eb5757;border-radius:3px;cursor:pointer;font-weight:600;">🛡 Def</button>
        <button type="button" class="btn" data-ft-tactical="stalemate" title="GM: Stalemate / no decisive winner" style="padding:.15rem .4rem;font-size:0.75rem;background:rgba(232,200,74,0.15);border:1px solid #e8c84a;color:#e8c84a;border-radius:3px;cursor:pointer;font-weight:600;">= Stale</button>
      `;
      // Insert before the row's flexrow that contains the Commit button.
      const commitRow = commitBtn.closest(".flexrow") || commitBtn.parentElement;
      commitRow?.parentElement?.insertBefore(wrap, commitRow);

      // Bind click handlers.
      wrap.querySelectorAll("[data-ft-tactical]").forEach(btn => {
        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const kind = btn.dataset.ftTactical;
          await _ftCommitRoundTactical(app, idx, kind);
        });
      });
    });
  } catch (e) {
    console.warn("[fourththing] tactical-resolution injection failed", e);
  }
});

// Expose for macros / external callers.
Hooks.once("ready", () => {
  game.bbttcc ??= { api: {} };
  game.bbttcc.api.raid ??= {};
  game.bbttcc.api.raid.commitRoundTactical = _ftCommitRoundTactical;
});
