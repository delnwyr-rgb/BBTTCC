// Fourth Thing — ft-class-automation.js  v0.1.0
// Sprint D: Class Automation — resource pools, dialogs, feature click router
//
// Covers all 9 classes:
//   Active pools:  Titanbound (Frame Dice + Stress), Aurablade (Burn + Aura), Shadowjack (Access Dice)

import {
  setMode,
  toggleMode,
  isModeActive,
  summarizeDiscipline
} from "./manifestation-discipline.js";
//   State tracks:  Breaker (Ruin), Dreamwalker (Resonance), Soul-Smith (Forge)
//   Passive:       Harmony Marshal, Phantom Courier, Wyrdlens Adept

// ─── Constants ────────────────────────────────────────────────────────────────

export const AURA_STATES = {
  none:    { label: "None",    color: "#78909c", desc: "No active aura" },
  fury:    { label: "Fury",    color: "#c03030", desc: "Aggressive — strike first, strike hard" },
  resolve: { label: "Resolve", color: "#4a90d9", desc: "Defensive — absorb, protect, endure" },
  mercy:   { label: "Mercy",   color: "#27ae60", desc: "Restorative — heal, cleanse, sustain" },
  dread:   { label: "Dread",   color: "#9b59b6", desc: "Psychic — fear, shadow, displacement" }
};

export const BURN_BANDS = [
  { min: 0, max: 1, label: "Controlled", color: "#27ae60", desc: "Stable. Full options available." },
  { min: 2, max: 3, label: "Engaged",    color: "#f2c94c", desc: "+1 damage. Stabilize costs are higher." },
  { min: 4, max: 99, label: "Overheated", color: "#eb5757", desc: "+2 damage. Risk backlash at end of turn." }
];

export function getBurnBand(burn, bands = BURN_BANDS) {
  return bands.find(b => burn >= b.min && burn <= b.max) ?? bands[bands.length - 1];
}

// ─── Burn archetype registry ─────────────────────────────────────────────────
// Burn is a shared "escalation track" substrate: a 0→max heat clock that is at
// once fuel (good) and risk (bad). The TRACK, BANDS, VENT options, and HUD
// presentation are generic and declared per class here; the PAYLOADS (what each
// band/action actually DOES, and what raises Burn) stay in each class's own
// handlers. Phase 1 (2026-05-26): extracted from Aurablade with IDENTICAL values
// so Aurablade behavior is unchanged. New burn classes (e.g. soul-smith) register
// here with their own track shape, vent flavor, and HUD tag.
export const BURN_CLASSES = {
  aurablade: {
    tag:   "Aurablade",
    icon:  "🔥",
    max:   8,
    bands: BURN_BANDS,
    // Vent options for the Stabilize dialog. reduce:"all" clears the track to 0;
    // req:"overheated" only offers the option in the Overheated band; a
    // backlashStress formula is rolled and subtracted from Stress when chosen.
    vent: [
      { id: "meditate", label: "Meditate (action)",  reduce: 2,     req: "any",        desc: "Spend your action to reduce Burn by 2" },
      { id: "rest",     label: "Brief rest (5 min)", reduce: "all", req: "any",        desc: "Clear all Burn on a brief rest" },
      { id: "accept",   label: "Accept backlash",    reduce: 3,     req: "overheated", backlashStress: "1d6", desc: "Take 1d6 Stress to reduce Burn by 3" },
    ],
  },
  // Soul-Smith — constructive-register Burn (Phase 2, 2026-05-26). Same 0→8 track +
  // vent substrate as Aurablade, its OWN bands/flavor. Stoked amplifies repairs;
  // Overheated bites back. Generation = "damage stokes the forge" (see module.js).
  "soul-smith": {
    tag:   "Soul-Smith",
    icon:  "⚒",
    max:   8,
    bands: [
      { min: 0, max: 1,  label: "Cool",       color: "#5dade2", desc: "Forge banked. Steady — no bonus." },
      { min: 2, max: 3,  label: "Stoked",     color: "#f2994a", desc: "Forge roaring. Repairs ×1.5." },
      { min: 4, max: 99, label: "Overheated", color: "#eb5757", desc: "Furnace bites. Repairs ×2, but drawing on it costs you Stress." },
    ],
    vent: [
      { id: "quench",   label: "Quench (action)",       reduce: 2,     req: "any",        desc: "Spend your action to cool the forge by 2" },
      { id: "bank",     label: "Bank the coals (rest)", reduce: "all", req: "any",        desc: "Let the forge go cold on a brief rest" },
      { id: "overdraw", label: "Overdraw",              reduce: 3,     req: "overheated", backlashStress: "1d6", desc: "Take 1d6 Stress to cool the furnace by 3" },
    ],
  },
};

// Identifier match shared with detectActivePools' hasClass(): a class/feat item
// whose system.identifier equals the slug or is `<slug>_*` prefixed (normalized).
function _ftBurnClassIdMatch(actor, slug) {
  const norm = String(slug).toLowerCase().replace(/[\s-]/g, "_");
  return Array.from(actor?.items ?? []).some(i => {
    if (i.type !== "class" && i.type !== "feat") return false;
    const id = String(i.system?.identifier ?? "").toLowerCase().replace(/-/g, "_");
    if (!id) return false;
    return id === norm || id.startsWith(norm + "_");
  });
}

// Burn descriptor for the actor's burn class ({ slug, ...config }), or null when
// the actor is not a burn-archetype class.
export function ftBurnClassFor(actor) {
  for (const [slug, cfg] of Object.entries(BURN_CLASSES)) {
    if (_ftBurnClassIdMatch(actor, slug)) return { slug, ...cfg };
  }
  return null;
}

export function ftIsBurnClass(actor) {
  return ftBurnClassFor(actor) !== null;
}

export function ftBurnMax(actor) {
  return ftBurnClassFor(actor)?.max ?? 8;
}

export function ftGetBurn(actor) {
  return Number(getResources(actor)?.burn?.current ?? 0) || 0;
}

// Band for the actor computed against its own class bands (defaults to BURN_BANDS).
export function ftBurnBandFor(actor) {
  const desc = ftBurnClassFor(actor);
  return getBurnBand(ftGetBurn(actor), desc?.bands ?? BURN_BANDS);
}

// Add (or subtract) Burn, clamped to [0, class max]. Returns the new value.
export async function ftAddBurn(actor, delta) {
  const max  = ftBurnMax(actor);
  const cur  = ftGetBurn(actor);
  const next = Math.max(0, Math.min(max, cur + (Number(delta) || 0)));
  if (next !== cur) await actor.update({ "system.resources.burn.current": next });
  return next;
}

// ─── Feature identifier → handler map ────────────────────────────────────────
// Maps BBTTCC feature identifier strings to automation handler keys.
// Checked against item.system.identifier (lowercase, underscored).

export const FEATURE_ROUTER = {
  // Titanbound (LEGACY — retired in Sprint F; dispatches to Bulwark Frame Dice)
  "titanbound_spend_frame_die":    "bulwark_spend_frame",
  "titanbound_titan_frame":        "bulwark_frame_pool",
  "titanbound_structural_stress":  "bulwark_frame_pool",
  // Aurablade
  "aurablade_action":              "aurablade_action",
  "aurablade_burn_state":          "aurablade_burn",
  "aurablade_change_aura":         "aurablade_change_aura",
  "aurablade_stabilize_burn":      "aurablade_stabilize",
  // Shadowjack (LEGACY — retired in Sprint F; dispatches to Shadow Courier Access)
  "shadowjack_spend_access_die":   "shadow_courier_spend_access",
  "shadowjack_access_pool":        "shadow_courier_access_pool",
  // Breaker (LEGACY — retired in Sprint F; dispatches to Bulwark Ruin)
  "breaker_ruin_charge":           "bulwark_ruin",
  "breaker_catastrophic_entry":    "bulwark_ruin",
  "breaker_certified_structural":  "bulwark_ruin",
  "breaker_siege_cost":            "bulwark_ruin",
  "breaker_shockwave":             "bulwark_ruin",
  "breaker_ruin_to_renewal":       "bulwark_ruin",
  // Dreamwalker
  "dreamwalker_resonance":         "dreamwalker_resonance",
  "dreamwalker_spark_detection":   "dreamwalker_resonance",
  "dreamwalker_commune":           "dreamwalker_resonance",
  // Dream Echo Reservoir (L13) — pool display + spend-1d6 dialog
  "dream-echo-reservoir":          "dream_echo_reservoir",
  "dream_echo_reservoir":          "dream_echo_reservoir",
  "dream_echo_reservoir_spend":    "dream_echo_reservoir_spend",
  // Dreamwalker per-Soma-Break feats — generic activator (clones AE to actor)
  "dream-thread-tuning":           "dw_feat_activate",
  "dream-rite":                    "dw_feat_activate",
  "omen-thread-weaving":           "dw_feat_activate",
  "mnemonic-spillway":             "dw_feat_activate",
  "waking-dreamfield":             "dw_feat_activate",
  "ascension-layer":               "dw_feat_activate",
  "fractal-self":                  "dw_feat_activate",
  "apotheosis-of-the-oneiric":     "dw_feat_activate",
  // Soul-Smith
  // Soul-Smith — canon (Phase 1.5): T1 Sanctified Forge Initiate, T2 Atonement
  // Crucible, T3 Furnace of Renewal, T4 Relic of Rebirth. Typo aliases
  // soulsmith_relic + soul_smith_relic retired 2026-05-23.
  "soul_smith_forge_initiate":        "soul_smith_forge_initiate",
  "soul_smith_atonement_crucible":    "soul_smith_atonement_crucible",
  "soul_smith_furnace_of_renewal":    "soul_smith_furnace_of_renewal",
  "soul_smith_relic_of_rebirth":      "soul_smith_relic_of_rebirth",
  // Legacy aliases — keep the combined entry pointing at the tier-routing shim.
  "soul_smith_forge":              "soul_smith_forge",
  "soul_smith_repair":             "soul_smith_forge",
  // Passive classes — show info dialog
  "harmony_marshal_core":          "passive_info",
  "harmony_marshal_tier":          "passive_info",
  // Harmony Marshal — canon (Phase 1.5): T1 Initiate · T2 Attrition Easer · T3 Loyalty Steward · T4 Unity Conductor + Rallying Words tactical surface.
  "harmony_marshal_initiate":         "harmony_marshal_initiate",
  "harmony_marshal_attrition_easer":  "harmony_marshal_attrition_easer",
  "harmony_marshal_loyalty_steward":  "harmony_marshal_loyalty_steward",
  "harmony_marshal_unity_conductor":  "harmony_marshal_unity_conductor",
  "harmony_marshal_rallying_words":   "harmony_marshal_rallying_words",
  "phantom_courier_core":          "shadow_courier_passive",  // Legacy fallback
  "phantom_courier_tier":          "shadow_courier_passive",  // Legacy fallback
  "wyrdlens_adept_core":           "passive_info",
  "wyrdlens_adept_tier":           "passive_info",

  // === SPRINT F NEW CLASSES ===
  // Bulwark — merged Titanbound + Breaker with L1 subclass polarity
  "bulwark_spend_frame":           "bulwark_spend_frame",
  "bulwark_frame_pool":            "bulwark_frame_pool",
  "bulwark_ruin":                  "bulwark_ruin",
  "bulwark_stance_dance":          "bulwark_stance",       // Cataclyst L5
  "bulwark_core":                  "passive_info",
  "bulwark_tier":                  "passive_info",
  // Shadow Courier — merged Shadowjack + Phantom Courier with Package mechanic
  "shadow_courier_spend_access":   "shadow_courier_spend_access",
  "shadow_courier_access_pool":    "shadow_courier_access_pool",
  "shadow_courier_package":        "shadow_courier_package",
  "shadow_courier_crossing":       "shadow_courier_crossing",
  "shadow_courier_core":           "shadow_courier_passive",
  "shadow_courier_tier":           "shadow_courier_passive",
  // Cosmic Linguist — Editorial Authority + Annotation
  "cosmic_linguist_authority":     "cosmic_linguist_authority",
  "cosmic_linguist_annotation":    "cosmic_linguist_annotation",
  "cosmic_linguist_core":          "passive_info",
  "cosmic_linguist_tier":          "passive_info",
  // Pactkeeper — canon surfaces: Pact Subject (The Bargain), Renegotiate
  // (misfire conversion), Sealed Pact (Signature Mode — see pk_mode_*),
  // Ledger Day (manifestation transfer), L1 skill pick (Initiation 1).
  // Older Leverage/Binding-Clause/Precedent/Civic-Charge/Admin-Pressure
  // handlers were retired 2026-05-22 as game-development residue.
  "pactkeeper_bind_subject":       "pactkeeper_bind_subject",
  "pactkeeper_renegotiate":        "pactkeeper_renegotiate",
  "pactkeeper_pick_l1_skills":     "pactkeeper_pick_l1_skills",
  // Generic counter/dispel — any actor's feat with this identifier routes here.
  "counter_manifestation":         "counter_manifestation",
  "dispel_manifestation":          "counter_manifestation",
  "pactkeeper_core":               "passive_info",
  "pactkeeper_core_features":      "passive_info",
  "pactkeeper_tier":                "passive_info",
  // Caster Discipline pilot 2026-04-27
  "cl_mode_sentence":              "cl_mode_sentence",
  "wl_mode_refraction":            "wl_mode_refraction",
  "dw_mode_walking_lane":          "dw_mode_walking_lane",
  "pk_mode_sealed_pact":           "pk_mode_sealed_pact",
  "cl_word_that_was":              "cl_word_that_was",
  "wl_tikkun_sight":               "wl_tikkun_sight",
  "dw_shared_dream":               "dw_shared_dream",
  "pk_ledger_day":                 "pk_ledger_day",
  "cl_discipline_passive":         "passive_info",
  "wl_discipline_passive":         "passive_info",
  "dw_discipline_passive":         "passive_info",
  "pk_discipline_passive":         "passive_info",

  // === Buried per-use abilities — Phase 1: Ancestry cores (2026-04-27) ===
  "menhirkin_core":                 "menhirkin_hex_recognition",
  "echo_diver_core":                "echo_diver_temporal_flinch",
  "sephirotic_scion_core":          "scion_sefirot_attunement",
  "qliph_scarred_core":             "qliph_qliphothic_saturation",

  // === Buried per-use — Phase 2: Heritage-unique + ancestry feats (2026-04-27) ===
  // Igneous overrides the menhirkin_hex_recognition route with a picker that
  // exposes BOTH Hex Recognition (from core) AND Heat Memory (heritage).
  "menhirkin_igneous_heritage":          "menhirkin_igneous_picker",
  "oldenborn_rustland_scavenger_heritage": "oldenborn_rustland_patch",
  "furrykin-felid-predator_patience":      "furrykin_predator_patience",
  "oldenborn-embertouched-phoenix_oath":   "oldenborn_phoenix_oath",
  "oldenborn-embertouched-hearth_dominion": "oldenborn_hearth_dominion",
  "oldenborn-embertouched-sun_scar":        "oldenborn_sun_scar",

  // === Buried per-use — Phase 3: Species multi-ability pickers (2026-04-27) ===
  "circuitborn":                            "circuitborn_abilities_picker",
  "human":                                  "human_abilities_picker",
  "stormborn_nomad":                        "stormborn_ward_of_the_gale",
};

// Also match by name fragment (fallback for identifier mismatches)
export const NAME_ROUTER = [
  // === LEGACY (pre-Sprint-F) entries remain for backward compat ===
  // Titanbound → dispatches to Bulwark handlers
  ["Spend Frame Die",            "bulwark_spend_frame"],
  ["Titan Frame",                "bulwark_frame_pool"],
  ["Structural Stress",          "bulwark_frame_pool"],
  // Aurablade
  ["Aurablade Action",           "aurablade_action"],
  ["Burn State",                 "aurablade_burn"],
  ["Change Aura",                "aurablade_change_aura"],
  ["Stabilize Burn",             "aurablade_stabilize"],
  // Shadowjack → dispatches to Shadow Courier handlers
  // 2026-05-20: legacy aliases for any actor whose item still has the old
  // name; new content authoring should use "Spend Pace" / "Pace Pool".
  ["Spend Access Die",           "shadow_courier_spend_access"],
  ["Access Pool",                "shadow_courier_access_pool"],
  ["Spend Pace",                 "shadow_courier_spend_access"],
  ["Pace Pool",                  "shadow_courier_access_pool"],
  // Breaker → dispatches to Bulwark handlers
  ["Catastrophic Entry",         "bulwark_ruin"],
  ["Certified Structural",       "bulwark_ruin"],
  ["Siege Cost",                 "bulwark_ruin"],
  ["Shockwave Footing",          "bulwark_ruin"],
  ["Ruin to Renewal",            "bulwark_ruin"],
  ["Breaker's Eye",              "bulwark_ruin"],
  ["Breaker: Living",            "bulwark_ruin"],
  ["Breaker: Reinforced",        "bulwark_ruin"],
  // Dreamwalker
  ["Dream Relay",                "dreamwalker_resonance"],
  ["Spark Detection",            "dreamwalker_resonance"],
  ["Dreamwalker: Commune",       "dreamwalker_resonance"],
  ["Oneiric",                    "dreamwalker_resonance"],
  // Soul-Smith
  // Soul-Smith — canon-aligned (Phase 1.5).
  ["Sanctified Forge Initiate",  "soul_smith_forge_initiate"],
  ["Atonement Crucible",         "soul_smith_atonement_crucible"],
  ["Furnace of Renewal",         "soul_smith_furnace_of_renewal"],
  ["Relic of Rebirth",           "soul_smith_relic_of_rebirth"],
  ["Soul-Smith: Tier",           "soul_smith_forge"],   // legacy passive-info row
  ["Atonement",                  "soul_smith_atonement_crucible"],
  // Passive — core class items
  ["Harmony Marshal: Tier",      "passive_info"],
  ["Harmony Marshal: Core",      "passive_info"],
  ["Phantom Courier: Tier",      "shadow_courier_passive"],  // legacy
  ["Phantom Courier: Core",      "shadow_courier_passive"],  // legacy
  ["Wyrdlens Adept: Tier",       "passive_info"],
  ["Wyrdlens Adept: Core",       "passive_info"],
  ["Phantom Network",            "shadow_courier_passive"],  // legacy
  ["Silver Tongue Protocol",     "passive_info"],
  ["Peacekeeper",                "passive_info"],

  // === SPRINT F NEW CLASSES ===
  // Bulwark
  ["Bulwark: Core",              "passive_info"],
  ["Bulwark: Tier",              "passive_info"],
  ["Kinetic Inversion",          "bulwark_frame_pool"],     // Avalanche L1
  ["Inverted Foundation",        "bulwark_frame_pool"],     // Mountain L1
  ["The Exchange",               "bulwark_stance"],         // Cataclyst L1
  ["Stance Dance",               "bulwark_stance"],         // Cataclyst L5
  ["Shockwave Arrival",          "bulwark_ruin"],           // Avalanche L5
  ["Denial",                     "bulwark_frame_pool"],     // Mountain L5
  // Shadow Courier
  ["Shadow Courier: Core",       "shadow_courier_passive"],
  ["Shadow Courier: Tier",       "shadow_courier_passive"],
  ["The Crossing",               "shadow_courier_crossing"],
  ["The Tongue That Does Not Lie", "shadow_courier_package"],  // Wayfarer L1
  ["The Crossing, Weaponized",   "shadow_courier_package"],    // Black Stair L1
  ["The Weight You Carry",       "shadow_courier_package"],    // Last Mile L1
  ["Preceding Rumor",            "shadow_courier_passive"],
  ["The Threshold Is A Lie",     "shadow_courier_crossing"],
  ["The Arms That Carry",        "shadow_courier_passive"],
  // Cosmic Linguist
  ["Cosmic Linguist: Core",      "passive_info"],
  ["Cosmic Linguist: Tier",      "passive_info"],
  ["Editorial Authority",        "cosmic_linguist_authority"],
  ["The Margin",                 "cosmic_linguist_annotation"],  // Annotator L1
  ["Declared Likeness",          "cosmic_linguist_annotation"],  // Metaphor Apostle L1
  ["The First Strike",           "cosmic_linguist_annotation"],  // Redactor L1
  ["Annotation",                 "cosmic_linguist_annotation"],
  // Pactkeeper — canon-only (Bargain / Renegotiate / Sealed Pact / Ledger Day).
  // Subclass feats (Read The Ledger, The Examination, The Protected Clause)
  // need their own canon-aligned handlers when those subclasses are refactored;
  // routing them to the retired Leverage handler was wrong.
  ["Pactkeeper: Core",           "passive_info"],
  ["Pactkeeper: Tier",           "passive_info"],
  ["The Bargain",                "pactkeeper_bind_subject"],      // Initiation 1
  ["Renegotiate",                "pactkeeper_renegotiate"],       // Initiation 6
  ["Ledger Day",                 "pk_ledger_day"],                // Initiation 16

  // === Buried per-use — Ancestry cores (name fallback for FEATURE_ROUTER) ===
  ["Menhirkin Core",                  "menhirkin_hex_recognition"],
  ["Echo-Diver Core",                 "echo_diver_temporal_flinch"],
  ["Sephirotic Scion Core",           "scion_sefirot_attunement"],
  ["Qliph-Scarred Core",              "qliph_qliphothic_saturation"],

  // === Phase 2 specific routes — MUST come before the prefix matches below
  // because routeFeature walks top-to-bottom and stops on first .includes().
  ["Menhirkin Heritage: Igneous",            "menhirkin_igneous_picker"],
  ["Oldenborn Heritage: Rustland Scavenger", "oldenborn_rustland_patch"],
  ["Furrykin (Felid): Predator Patience",    "furrykin_predator_patience"],
  ["Oldenborn (Ember-Touched): Phoenix Oath", "oldenborn_phoenix_oath"],
  ["Oldenborn (Ember-Touched): Hearth Dominion", "oldenborn_hearth_dominion"],
  ["Oldenborn (Ember-Touched): Sun-Scar",    "oldenborn_sun_scar"],

  // === Phase 3 species pickers (FEATURE_ROUTER takes precedence; these are
  // belt-and-suspenders fallbacks for items missing system.identifier). ===
  ["Stormborn Nomad",                        "stormborn_ward_of_the_gale"],

  // === Buried per-use — Heritage prefix fallbacks (share core ability) ===
  ["Menhirkin Heritage:",             "menhirkin_hex_recognition"],
  ["Echo-Diver Heritage:",            "echo_diver_temporal_flinch"],
  ["Sephirotic Scion Heritage:",      "scion_sefirot_attunement"],
  ["Qliph-Scarred Heritage:",         "qliph_qliphothic_saturation"],
];

// Handlers that were RETIRED when their pools folded into Surge (2026-05-28).
// They now only post a "use the ◆ Surge menu" nudge, so the feats that route to
// them (e.g. Avalanche L1 "Kinetic Inversion", Editorial Authority) are vestigial:
// their real mechanics live in the Surge spend table. Treat them as non-actionable
// so they drop out of the Player HUD's Steward Abilities list instead of cluttering
// it with dead buttons.
const RETIRED_FEATURE_HANDLERS = new Set([
  "bulwark_frame_pool",       // Bulwark Frame Dice → Surge (Absorb/Push/Anchor/Brace Wall)
  "bulwark_ruin",             // Bulwark Ruin Charges → Surge (Cat. Entry/Shockwave/Siege/Renewal)
  "bulwark_stance",           // Bulwark Cataclyst stances → Surge path kit
  "cosmic_linguist_authority" // Editorial Authority → Surge (the 3 Edits)
]);

// Raw route — resolves a feature's handler WITHOUT the retired-handler filter.
// routeFeature() applies the filter on top; the prune helper needs the unfiltered
// answer to recognize folded feats (whose filtered route is null).
function _rawRouteFeature(item) {
  const identifier = item.system?.identifier ?? "";
  const name       = item.name ?? "";
  if (FEATURE_ROUTER[identifier]) return FEATURE_ROUTER[identifier];
  for (const [fragment, h] of NAME_ROUTER) {
    if (name.includes(fragment)) return h;
  }
  return null;
}

export function routeFeature(item) {
  const handler = _rawRouteFeature(item);
  // Folded-into-Surge handlers are no longer real actions — report no route.
  if (handler && RETIRED_FEATURE_HANDLERS.has(handler)) return null;
  return handler;
}

// True when a feat's ONLY mechanic was folded into Surge (its handler is retired).
// Such granted feat items are vestigial — their abilities now live in the ◆ Surge
// spend table — so they're safe to prune from actors. Restricted to feat/feature
// items so class/subclass anchors are never matched. Used by the prune macro
// (prune-surge-folded-feats) and matches the same set the HUD hides.
export function isRetiredFoldedFeature(item) {
  if (item?.type !== "feat" && item?.type !== "feature") return false;
  const h = _rawRouteFeature(item);
  return !!(h && RETIRED_FEATURE_HANDLERS.has(h));
}

// Every routed handler opens a player-facing dialog (per-use picker, info
// summary, or active ability) — clicking ▶ always does something useful for
// any item with a route. Treat "actionable" as "has any route at all".
export function isActionableFeature(item) {
  return routeFeature(item) !== null;
}

// ─── Resource helpers ─────────────────────────────────────────────────────────

export function getResources(actor) {
  const rawSys = actor.system?.system ?? actor.system;
  return rawSys?.resources ?? {};
}

export async function setResource(actor, path, value) {
  await actor.update({ [`system.resources.${path}`]: value });
}

// Phase B 2026-05-07 — read a system.resources.{name} pool with one-shot
// migration from a legacy actor.flags.fourththing.{flagName} pool. Returns
// { current, max }. Side effect on first call after migration: writes the
// system path and unsets the legacy flag — subsequent calls see the system
// value directly. Used by clAuthority + pactLeverage dialogs to honor
// existing world state instead of resetting players to zero.
async function _ftReadPoolWithLegacyMigration(actor, { resourceName, legacyFlag, defaultMax = 5 }) {
  const rawSys = actor.system?.system ?? actor.system;
  const sysVal = rawSys?.resources?.[resourceName] ?? null;
  const cur = Number(sysVal?.current ?? 0);
  const max = Number(sysVal?.max ?? 0);
  if (max > 0) return { current: cur, max };

  const legacy = actor.getFlag("fourththing", legacyFlag);
  if (legacy && (Number(legacy.current ?? 0) > 0 || Number(legacy.max ?? 0) > 0)) {
    const lc = Number(legacy.current ?? 0);
    const lm = Number(legacy.max ?? defaultMax);
    try {
      await actor.update({
        [`system.resources.${resourceName}.current`]: lc,
        [`system.resources.${resourceName}.max`]:     lm
      });
      await actor.unsetFlag("fourththing", legacyFlag);
    } catch (e) { console.warn(`[ft] legacy ${legacyFlag} migration failed`, e); }
    return { current: lc, max: lm };
  }
  return { current: cur, max: max || defaultMax };
}

// Detect which class resource pools are active by checking for class items
export function detectActivePools(actor) {
  const items = Array.from(actor.items ?? []);
  // Match by identifier, not display name. Substring-on-name was activating the
  // wrong pools on innocent overlap (e.g. "Siegebreaker Frame" ancestry feat
  // would flip the Breaker pool on for a non-Breaker actor). Class items use
  // exact identifier; discipline feats use `<slug>_*` prefixed identifiers.
  const hasClass = (slug) => {
    const norm = String(slug).toLowerCase().replace(/[\s-]/g, "_");
    return items.some(i => {
      if (i.type !== "class" && i.type !== "feat") return false;
      const id = String(i.system?.identifier ?? "").toLowerCase().replace(/-/g, "_");
      if (!id) return false;
      return id === norm || id.startsWith(norm + "_");
    });
  };
  return {
    // Active pools (show resource UI in Combat tab)
    titanbound:  hasClass("titanbound"),
    aurablade:   hasClass("aurablade"),
    shadowjack:  hasClass("shadowjack"),
    // breaker retired — Bulwark replaced it. Ruin Charges live on the Bulwark
    // resource panel; the standalone Breaker panel was deleted from the sheet.
    dreamwalker: hasClass("dreamwalker"),
    soulSmith:   hasClass("soul-smith") || hasClass("soul smith"),
    // Sprint F active pools
    bulwark:         hasClass("bulwark"),
    shadowCourier:   hasClass("shadow courier"),
    cosmicLinguist:  hasClass("cosmic linguist"),
    pactkeeper:      hasClass("pactkeeper"),
    // Passive (feature ▶ Use shows info dialog only)
    harmonyMarshal:  hasClass("harmony marshal"),
    phantomCourier:  hasClass("phantom courier"),
    wyrdlensAdept:   hasClass("wyrdlens adept"),
  };
}

// ─── Titanbound dialogs ───────────────────────────────────────────────────────

export async function openFrameDiePool(actor) {
  const res = getResources(actor);
  const cur = res.frameDice?.current ?? 0;
  const max = res.frameDice?.max ?? 3;
  const stress = res.stress?.current ?? 0;
  const stressMax = res.stress?.max ?? 5;

  new Dialog({
    title: "Titan Frame — Frame Dice",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats">
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Frame Dice</span>
          <span class="ft-prev-val" style="color:#4a90d9">${cur} / ${max}</span>
        </span>
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Stress</span>
          <span class="ft-prev-val" style="color:${stress >= 4 ? '#eb5757' : stress >= 3 ? '#f2994a' : '#f0f4ff'}">${stress} / ${stressMax}</span>
        </span>
      </div>
      <div class="ft-cast-grid" style="margin-top:0.5rem">
        <div class="ft-cast-field"><label>Set Frame Dice</label>
          <input type="number" name="frameDice" value="${cur}" min="0" max="${max}"/></div>
        <div class="ft-cast-field"><label>Set Structural Stress</label>
          <input type="number" name="stress" value="${stress}" min="0" max="${stressMax}"/></div>
        <div class="ft-cast-field"><label>Max Frame Dice</label>
          <input type="number" name="maxFrameDice" value="${max}" min="1" max="10"/></div>
      </div>
    </div>`,
    buttons: {
      save: { label: "Save", callback: async (html) => {
        const newCur = parseInt(html.find("[name='frameDice']").val())    || 0;
        const newStr = parseInt(html.find("[name='stress']").val())        || 0;
        const newMax = parseInt(html.find("[name='maxFrameDice']").val())  || max;
        await actor.update({
          "system.resources.frameDice.current": Math.min(newCur, newMax),
          "system.resources.frameDice.max": newMax,
          "system.resources.stress.current": Math.min(newStr, stressMax),
        });
      }},
      close: { label: "Close" }
    },
    default: "save"
  }).render(true);
}

export async function openSpendFrameDie(actor) {
  const res = getResources(actor);
  const cur = res.frameDice?.current ?? 0;

  if (cur <= 0) {
    return ui.notifications.warn(`${actor.name}: No Frame Dice remaining.`);
  }

  const stress = res.stress?.current ?? 0;
  const stressMax = res.stress?.max ?? 5;

  new Dialog({
    title: "Spend Frame Die",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Frame Dice</span>
          <span class="ft-prev-val ft-clarity">${cur} remaining</span>
        </span>
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Stress</span>
          <span class="ft-prev-val">${stress}/${stressMax}</span>
        </span>
      </div>
      <div class="ft-cast-field" style="margin-bottom:0.6rem">
        <label>Choose action</label>
        <select name="action">
          <option value="reduce_damage">Reduce damage taken (roll 1d6, subtract from hit)</option>
          <option value="knockback">Add knockback (push target up to 10 ft)</option>
          <option value="topple">Add topple (Topple DC: 10 + Violence mod)</option>
          <option value="brace">Brace / resist forced movement (immune until your next turn)</option>
          <option value="terrain">Ignore difficult terrain (until end of turn)</option>
        </select>
      </div>
      <div class="ft-cast-field">
        <label>Add Structural Stress? (optional)</label>
        <select name="addStress">
          <option value="0">No</option>
          <option value="1">+1 Stress (store the impact)</option>
        </select>
      </div>
    </div>`,
    buttons: {
      spend: {
        icon: "<i class='fas fa-dice'></i>",
        label: "Spend Die",
        callback: async (html) => {
          const action = html.find("[name='action']").val();
          const addStr = parseInt(html.find("[name='addStress']").val()) || 0;
          const newCur = Math.max(0, cur - 1);
          const newStr = Math.min(stressMax, stress + addStr);
          await actor.update({
            "system.resources.frameDice.current": newCur,
            "system.resources.stress.current": newStr,
          });
          const labels = {
            reduce_damage: "Reduce Damage — rolling 1d6 to subtract from the hit",
            knockback: "Knockback — push target up to 10 ft",
            topple: "Topple — target must beat your Topple DC",
            brace: "Brace — immune to forced movement until your next turn",
            terrain: "Terrain Ignore — difficult terrain has no effect this turn"
          };
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll ft-attack-roll">
              <div class="ft-roll-header">
                <span class="ft-roll-name">⬡ Frame Die Spent</span>
                <span class="ft-defense-pill">${newCur}/${res.frameDice?.max ?? 3} remaining</span>
              </div>
              <p style="margin:0.3rem 0;font-size:0.82rem;opacity:0.8">${labels[action]}</p>
              ${addStr ? `<p style="margin:0;font-size:0.75rem;color:#f2994a">+1 Structural Stress (now ${newStr}/${stressMax})</p>` : ""}
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "spend"
  }).render(true);
}

// ─── Aurablade dialogs ────────────────────────────────────────────────────────

export async function openBurnState(actor) {
  const res  = getResources(actor);
  const burn = res.burn?.current ?? 0;
  const aura = res.aura?.state   ?? "none";
  const band = getBurnBand(burn);

  new Dialog({
    title: "Aurablade — Burn & Aura",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.75rem">
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Burn</span>
          <span class="ft-prev-val" style="color:${band.color}">${burn}/8</span>
        </span>
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Band</span>
          <span class="ft-prev-val" style="color:${band.color}">${band.label}</span>
        </span>
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Aura</span>
          <span class="ft-prev-val" style="color:${AURA_STATES[aura]?.color ?? '#888'}">${AURA_STATES[aura]?.label ?? aura}</span>
        </span>
      </div>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Burn (0–8)</label>
          <input type="number" name="burn" value="${burn}" min="0" max="8"/></div>
        <div class="ft-cast-field"><label>Aura State</label>
          <select name="aura">
            ${Object.entries(AURA_STATES).map(([k,v]) =>
              `<option value="${k}" ${k === aura ? "selected" : ""}>${v.label}</option>`
            ).join("")}
          </select>
        </div>
      </div>
      <p style="font-size:0.75rem;opacity:0.55;margin:0.5rem 0 0">${band.desc}</p>
    </div>`,
    buttons: {
      save: { label: "Save", callback: async (html) => {
        const newBurn = parseInt(html.find("[name='burn']").val()) || 0;
        const newAura = html.find("[name='aura']").val();
        await actor.update({
          "system.resources.burn.current": Math.min(8, Math.max(0, newBurn)),
          "system.resources.aura.state":   newAura,
        });
      }},
      close: { label: "Close" }
    },
    default: "save"
  }).render(true);
}

export async function openChangeAura(actor) {
  const res  = getResources(actor);
  const aura = res.aura?.state   ?? "none";
  const burn = res.burn?.current ?? 0;

  new Dialog({
    title: "Change Aura",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.8rem;opacity:0.7;margin:0 0 0.6rem">
        Changing aura costs <b>+1 Burn</b> (current: ${burn}/8).
      </p>
      <div class="ft-conditions-grid" style="grid-template-columns:1fr 1fr">
        ${Object.entries(AURA_STATES).filter(([k]) => k !== "none").map(([k,v]) => `
          <label style="display:flex;align-items:center;gap:0.4rem;padding:0.35rem 0.5rem;
            border:1.5px solid ${k === aura ? v.color : 'rgba(255,255,255,0.12)'};
            border-radius:5px;cursor:pointer;background:${k === aura ? v.color + '18' : 'rgba(255,255,255,0.03)'}">
            <input type="radio" name="aura" value="${k}" ${k === aura ? "checked" : ""}
              style="accent-color:${v.color}"/>
            <span style="color:${v.color};font-weight:600;font-size:0.8rem">${v.label}</span>
            <span style="font-size:0.7rem;opacity:0.55">${v.desc}</span>
          </label>`).join("")}
      </div>
    </div>`,
    buttons: {
      change: {
        label: "Switch Aura (+1 Burn)",
        callback: async (html) => {
          const newAura = html.find("[name='aura']:checked").val() ?? aura;
          const newBurn = Math.min(8, burn + (newAura !== aura ? 1 : 0));
          await actor.update({
            "system.resources.aura.state":   newAura,
            "system.resources.burn.current": newBurn,
          });
          // Committing to the aura sheds spendable Surge (flavor gen, capped/round).
          if (newBurn > burn) { try { await game.fourththing?.aurabladeFlavorSurge?.(actor); } catch (e) { /* silent */ } }
          // AE sync runs automatically via the updateActor hook in module.js
          // (aurablade burn-band auto-sync). No explicit call needed; keeping
          // one would race the hook and double-create the AE pack.
          const av = AURA_STATES[newAura];
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header">
                <span class="ft-roll-name">Aura: ${av?.label}</span>
                <span class="ft-seph-pill" style="background:${av?.color}22;border-color:${av?.color}88;color:${av?.color}">Burn ${newBurn}/8</span>
              </div>
              <p style="margin:0.2rem 0;font-size:0.8rem;opacity:0.7">${av?.desc}</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "change"
  }).render(true);
}

// Helper — apply a condition AE (Foundry status) to a target token's actor.
// Uses the canonical applyManifestationStates path so duration / dedupe /
// condition-immunity gates all behave correctly.
async function _ftAurabladeApplyCondition(caster, targetActor, condKey, { duration = "1-round", castDc = 15, item = null } = {}) {
  if (!game?.fourththing?.applyManifestationStates) return false;
  const synthMf = { appliedStates: { states: [condKey], duration } };
  // applyManifestationStates expects an `item` for context; synth a minimal stub.
  const stub = item ?? { name: "Aurablade Aura", id: caster?.id, system: {} };
  try {
    await game.fourththing.applyManifestationStates(caster, targetActor, stub, synthMf, { castDc });
    return true;
  } catch (e) {
    console.warn("[fourththing] Aurablade condition apply failed", condKey, e);
    return false;
  }
}

// Helper — set a one-shot flag on the actor that downstream rolls/movement
// can read. Cleared on next round, or consumed by the relevant rule path.
async function _ftAurabladeStampOneShot(actor, key, value = true) {
  if (!actor?.setFlag) return;
  await actor.setFlag("fourththing", `aurablade.oneShot.${key}`, value);
}

// Canon-driven action matrix per AURABLADE class doc:
//   Burn 0–1 Controlled · Burn 2–3 Engaged · Burn 4+ Overheated
// Each action carries: band gate, burn cost (how much Burn entering the
// action accrues — canon says you gain Burn from committing, not from
// "spending" a pool), mechanical apply (where automatable), narrative
// description (fallback for GM-adjudicated effects). target=true means we
// require game.user.targets.first().
const AURABLADE_ACTIONS = {
  fury: [
    { id: "fury_strike",       label: "Strike",                     band: "any",         burnCost: 1, target: false,
      desc: "Aura-enhanced melee strike. +1 damage (passive). Pair with a weapon attack roll." },
    { id: "fury_press_push",   label: "Press & Push 5 ft",          band: "engaged",     burnCost: 1, target: true,
      desc: "On a melee hit: +tier damage; shove target 5 ft. Once per turn." },
    { id: "fury_cleave",       label: "Cleave (second target)",     band: "engaged",     burnCost: 1, target: false,
      desc: "On hit: extend the strike to a second creature within reach (deal the same damage). Once per turn." },
    { id: "fury_dis_attack",   label: "Impose Disadvantage (one attack)", band: "engaged", burnCost: 1, target: true,
      desc: "Force one enemy attack this turn to be rolled 3d10kl2 against you or an ally." },
    { id: "fury_knockdown",    label: "Pressing Knockdown — knock prone", band: "overheated", burnCost: 1, target: true,
      desc: "On hit: target must succeed on a Violence save or fall Prone." },
    { id: "fury_deny_reacts",  label: "Deny Reactions (target)",    band: "overheated",  burnCost: 1, target: true,
      desc: "Your attacks against the target deny their reactions until the start of your next turn." }
  ],
  resolve: [
    { id: "resolve_brace",     label: "Brace — halve next hit",     band: "any",         burnCost: 1, target: false,
      desc: "The next incoming hit this round is halved." },
    { id: "resolve_resist",    label: "Resist one damage type",     band: "engaged",     burnCost: 1, target: false,
      desc: "Gain resistance to one damage type until the start of your next turn." },
    { id: "resolve_ignore_push", label: "Ignore Forced Movement (10 ft)", band: "engaged", burnCost: 1, target: false,
      desc: "Ignore forced movement up to 10 ft until end of round." },
    { id: "resolve_auto_save", label: "Auto-Succeed One Save",      band: "overheated",  burnCost: 1, target: false,
      desc: "Automatically succeed on one Violence, Body, or Intrigue save this round." },
    { id: "resolve_lock_pos",  label: "Lock Position",              band: "overheated",  burnCost: 1, target: false,
      desc: "Enemies cannot move you at all until the start of your next turn." }
  ],
  mercy: [
    { id: "mercy_nonlethal",   label: "Deal Nonlethal Damage",      band: "any",         burnCost: 1, target: false,
      desc: "Toggle nonlethal on your next damaging hit. No penalty (passive)." },
    { id: "mercy_redirect",    label: "Reduce / Redirect Damage to Ally", band: "engaged", burnCost: 1, target: true,
      desc: "When an ally within 10 ft takes damage: reduce by your tier OR redirect to yourself. Once per round." },
    { id: "mercy_stabilize",   label: "Stabilize on Touch",         band: "engaged",     burnCost: 1, target: true,
      desc: "Automatically stabilize a dying creature you touch (clears Dying / sets Integrity to 1)." },
    { id: "mercy_prevent_drop",label: "Prevent Ally Dropping below 1 Integrity", band: "overheated", burnCost: 1, target: true,
      desc: "Once per round: ally cannot drop below 1 Integrity from the next hit." },
    { id: "mercy_lastsave",    label: "Auto-Pass Last Stand",       band: "overheated",  burnCost: 1, target: true,
      desc: "Convert one failed Last Stand check into a success." }
  ],
  dread: [
    { id: "dread_shake",       label: "Inflict Shaken",             band: "any",         burnCost: 1, target: true,
      desc: "On hit: target saves vs Resolve or becomes Shaken until end of its next turn (canon: Engaged+; usable at low Burn as the entry-level effect)." },
    { id: "dread_suppress",    label: "Suppress One Buff / Inspiration", band: "engaged", burnCost: 1, target: true,
      desc: "Suppress one beneficial morale, inspiration, or buff effect on the target (GM adjudicated)." },
    { id: "dread_dis_saves",   label: "Disadvantage on All Saves",  band: "overheated",  burnCost: 1, target: true,
      desc: "Target rolls 3d10kl2 on all saves until the start of your next turn." },
    { id: "dread_hesitate",    label: "Hesitation — nearby enemies", band: "overheated", burnCost: 1, target: false,
      desc: "Enemies near the target save or hesitate (lose movement or reactions). GM picks." }
  ]
};

export async function openAurabladeAction(actor) {
  const res  = getResources(actor);
  const burn = res.burn?.current ?? 0;
  const aura = res.aura?.state   ?? "fury";
  const band = getBurnBand(burn);
  const av   = AURA_STATES[aura] ?? AURA_STATES.fury;

  // Band gate: "any" always; "engaged" = Engaged or Overheated; "overheated" = Overheated only.
  const bandMatches = (gate) => {
    if (gate === "any") return true;
    if (gate === "engaged")    return band.label === "Engaged" || band.label === "Overheated";
    if (gate === "overheated") return band.label === "Overheated";
    return false;
  };
  const available = (AURABLADE_ACTIONS[aura] ?? []).filter(a => bandMatches(a.band));

  // Build option list, grouped by band for clarity.
  const renderGroup = (label, gate) => {
    const subset = available.filter(a => a.band === gate);
    if (!subset.length) return "";
    return `<optgroup label="${label}">` +
      subset.map(a => `<option value="${a.id}" data-cost="${a.burnCost}">${a.label} — ${a.desc}</option>`).join("") +
      `</optgroup>`;
  };
  const opts = renderGroup("Any band", "any") + renderGroup("Engaged / Overheated", "engaged") + renderGroup("Overheated only", "overheated");

  const passiveByAura = {
    fury:    "+1 melee weapon damage.",
    resolve: "+1 Guard while you haven't moved this turn.",
    mercy:   "Deal nonlethal damage at no penalty.",
    dread:   "Enemies within 5 ft roll 3d10kl2 on morale checks."
  };

  new Dialog({
    title: `Aurablade Action — ${av.label}`,
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Aura</span>
          <span class="ft-prev-val" style="color:${av.color}">${av.label}</span>
        </span>
        <span class="ft-prev-stat">
          <span class="ft-prev-label">Burn</span>
          <span class="ft-prev-val" style="color:${band.color}">${burn} (${band.label})</span>
        </span>
      </div>
      <p style="font-size:0.74rem;opacity:0.75;margin:0 0 0.4rem;border-left:2px solid ${av.color}55;padding-left:0.4rem">
        <b>Passive:</b> ${passiveByAura[aura] ?? "(none)"}
      </p>
      <div class="ft-cast-field">
        <label>Available actions (band-gated)</label>
        <select name="action">${opts}</select>
      </div>
      <p style="font-size:0.7rem;opacity:0.55;margin:0.4rem 0 0">Using an action raises your Burn by its listed cost (canon: Burn is gained from commitment, not spent from a pool).</p>
    </div>`,
    buttons: {
      act: {
        icon: "<i class='fas fa-bolt'></i>",
        label: "Use Action",
        callback: async (html) => {
          const sel       = html.find("[name='action'] option:selected");
          const actionId  = html.find("[name='action']").val();
          const burnCost  = parseInt(sel.data("cost")) || 1;
          const newBurn   = Math.min(8, burn + burnCost);
          const newBand   = getBurnBand(newBurn);
          const action    = available.find(a => a.id === actionId);
          if (!action) return;

          // Resolve target if required.
          let targetActor = null;
          if (action.target) {
            const tk = Array.from(game.user?.targets ?? [])[0];
            targetActor = tk?.actor ?? null;
            if (!targetActor) {
              return ui.notifications?.warn(`Aurablade ${action.label}: target a token first, then re-use the action.`);
            }
          }

          // Mechanical apply — match by action id.
          let appliedNote = "";
          const rawSys   = actor.system?.system ?? actor.system;
          const tier     = Number(rawSys?.tier ?? rawSys?.details?.tier ?? 1) || 1;

          switch (action.id) {
            // ─── FURY ───────────────────────────────────────────────────────
            case "fury_knockdown": {
              const ok = await _ftAurabladeApplyCondition(actor, targetActor, "prone");
              appliedNote = ok ? `🪓 <b>${targetActor.name}</b> is knocked Prone.` : "";
              break;
            }
            case "fury_deny_reacts": {
              // Deny the target's reactions for the round — a 1-round AE the
              // reaction gates (AoO prompt + strike, reaction-type features,
              // crew hold-on) all respect via `_ftReactionsDenied`. Canon is
              // "vs your attacks"; FT's reaction model has no per-attacker
              // chokepoint, so we lock out ALL their reactions until the start
              // of your next turn (broader, but fine at Overheated). Owner-or-
              // relay so it lands on unowned foes too.
              const combat = game.combat;
              const dur = combat
                ? { rounds: 1, startRound: combat.round, startTurn: combat.turn, combat: combat.id }
                : { rounds: 1 };
              const denyAE = {
                name: "Reactions Denied", img: "icons/svg/net.svg", origin: actor.uuid,
                duration: dur, changes: [],
                flags: { fourththing: { reactionsDenied: true, source: actor.uuid } }
              };
              try { await game.fourththing?.applyEffectsToTarget?.(targetActor, [denyAE], []); } catch (_e) {}
              appliedNote = `🚫 ${targetActor.name}'s reactions are denied until the start of your next turn.`;
              break;
            }
            case "fury_press_push": {
              // Token nudge — 5 ft directly away from caster.
              // Forced-movement gate: Bulwark Anchor / Stance, or Aurablade
              // Lock Position / Ignore Forced Movement on the target refuses it.
              if (await game.fourththing?.resistsForcedMove?.(targetActor, { reason: "forced movement" })) {
                appliedNote = `⛰ ${targetActor.name} holds fast — the shove is refused.`;
                break;
              }
              try {
                const srcTk = actor.getActiveTokens?.()[0];
                const tgtTk = Array.from(game.user.targets ?? [])[0];
                if (srcTk && tgtTk) {
                  const dx = tgtTk.x - srcTk.x, dy = tgtTk.y - srcTk.y;
                  const mag = Math.hypot(dx, dy) || 1;
                  const grid = canvas.dimensions?.size || 100;
                  const pushPx = grid; // 5 ft = 1 square in default grid; canon push is 5 ft
                  await tgtTk.document.update({
                    x: Math.round(tgtTk.x + (dx / mag) * pushPx),
                    y: Math.round(tgtTk.y + (dy / mag) * pushPx)
                  });
                  appliedNote = `↗ ${targetActor.name} shoved 5 ft.`;
                }
              } catch (e) { console.warn("Fury push failed", e); }
              break;
            }
            case "fury_dis_attack": {
              // Stamp the ENEMY so their next attack rolls 3d10kl2 — attackTest
              // consumes it (no actor-scan needed), mirroring dread_dis_saves.
              await targetActor.setFlag?.("fourththing", "aurablade.disAttackOnce", true);
              appliedNote = `🎯 ${targetActor.name}'s next attack this turn is rolled 3d10kl2.`;
              break;
            }
            // ─── RESOLVE ────────────────────────────────────────────────────
            case "resolve_brace": {
              await _ftAurabladeStampOneShot(actor, "halveNextHit", true);
              appliedNote = "🛡 Next incoming hit this round is halved.";
              break;
            }
            case "resolve_resist": {
              await _ftAurabladeStampOneShot(actor, "resistTypePending", true);
              appliedNote = "🛡 Choose a damage type — gain resistance until start of your next turn (GM applies on next damage).";
              break;
            }
            case "resolve_ignore_push": {
              await _ftAurabladeStampOneShot(actor, "ignoreForcedMovement", 10);
              appliedNote = "⚓ Ignore forced movement up to 10 ft until end of round.";
              break;
            }
            case "resolve_auto_save": {
              await _ftAurabladeStampOneShot(actor, "autoSucceedSave", { attrs: ["violence","body","intrigue"], uses: 1 });
              appliedNote = "✦ Auto-succeed on one Violence/Body/Intrigue save this round.";
              break;
            }
            case "resolve_lock_pos": {
              await _ftAurabladeStampOneShot(actor, "lockPosition", true);
              appliedNote = "⚓ Position locked — cannot be moved until start of your next turn.";
              break;
            }
            // ─── MERCY ──────────────────────────────────────────────────────
            case "mercy_nonlethal": {
              await _ftAurabladeStampOneShot(actor, "nonlethalNextHit", true);
              appliedNote = "🤍 Next hit is nonlethal.";
              break;
            }
            case "mercy_redirect": {
              // Stamp the reduction on the ALLY so _applyDamageToActor consumes
              // it when they're next hit. Redirect-to-self stays GM-adjudicated.
              await targetActor.setFlag?.("fourththing", "aurablade.reduceNextDamageByTier", tier);
              appliedNote = `🤍 Next damage to ${targetActor.name} is reduced by ${tier} (your tier). (Redirect-to-self stays GM-adjudicated.)`;
              break;
            }
            case "mercy_stabilize": {
              // Touch-stabilize — clear Dying AE + set Integrity to 1 if 0.
              try {
                const dyingAE = targetActor.effects?.find?.(e => e.flags?.fourththing?.condition === "dying");
                if (dyingAE) await dyingAE.delete();
                const tSys = targetActor.system?.system ?? targetActor.system;
                if ((tSys?.derived?.integrity?.value ?? 0) < 1) {
                  await targetActor.update({ "system.derived.integrity.value": 1 });
                }
                appliedNote = `❤ ${targetActor.name} stabilized.`;
              } catch (e) { console.warn("Mercy stabilize failed", e); }
              break;
            }
            case "mercy_prevent_drop": {
              await targetActor.setFlag?.("fourththing", "aurablade.preventDropOnce", true);
              appliedNote = `❤ ${targetActor.name} cannot drop below 1 Integrity on the next hit.`;
              break;
            }
            case "mercy_lastsave": {
              await targetActor.setFlag?.("fourththing", "aurablade.autoPassLastStand", true);
              appliedNote = `❤ ${targetActor.name}: next failed Last Stand check converts to a success.`;
              break;
            }
            // ─── DREAD ──────────────────────────────────────────────────────
            case "dread_shake": {
              const ok = await _ftAurabladeApplyCondition(actor, targetActor, "shaken");
              appliedNote = ok ? `🕳 ${targetActor.name} is Shaken.` : "";
              break;
            }
            case "dread_suppress": {
              appliedNote = `🕳 GM: suppress one buff / inspiration on ${targetActor.name}.`;
              break;
            }
            case "dread_dis_saves": {
              // Apply a 1-round AE that flags the target with disSaves so the
              // save roller picks up 3d10kl2. The state isn't in FT.CONDITIONS,
              // so create a bespoke AE here.
              try {
                await targetActor.createEmbeddedDocuments?.("ActiveEffect", [{
                  name: "Dread — Disadvantage on Saves",
                  icon: "icons/svg/skull.svg",
                  duration: { rounds: 1 },
                  changes: [],
                  flags: { fourththing: { aurablade: { disSavesAll: true } } }
                }]);
                appliedNote = `🕳 ${targetActor.name}: disadvantage on ALL saves until your next turn.`;
              } catch (e) { console.warn("Dread AE failed", e); }
              break;
            }
            case "dread_hesitate": {
              appliedNote = "🕳 GM: nearby enemies save or hesitate (lose movement / reactions).";
              break;
            }
            // Default = no automation, narration only.
            default: {
              appliedNote = "";
            }
          }

          await actor.update({ "system.resources.burn.current": newBurn });
          // Committing a Burn action sheds spendable Surge (flavor gen, capped/round).
          try { await game.fourththing?.aurabladeFlavorSurge?.(actor); } catch (e) { /* silent */ }

          let backlashNote = "";
          if (newBand.label === "Overheated" && band.label !== "Overheated") {
            backlashNote = `<p style="color:#eb5757;font-size:0.75rem;margin:0.2rem 0 0">⚠ Now Overheated — risk backlash at end of turn.</p>`;
          }

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll ft-attack-roll">
              <div class="ft-roll-header">
                <span class="ft-roll-name">Aurablade · ${action.label}</span>
                <span class="ft-seph-pill" style="background:${av.color}22;border-color:${av.color}88;color:${av.color}">${av.label}</span>
              </div>
              <p style="margin:0.2rem 0;font-size:0.8rem;opacity:0.85">${action.desc}</p>
              ${appliedNote ? `<p style="margin:0.2rem 0;font-size:0.78rem;color:${av.color}">${appliedNote}</p>` : ""}
              <p style="margin:0;font-size:0.74rem;color:${newBand.color}">Burn: ${burn} → ${newBurn} (${newBand.label})</p>
              ${backlashNote}
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "act"
  }).render(true);
}

export async function openStabilizeBurn(actor) {
  const desc = ftBurnClassFor(actor);
  const res  = getResources(actor);
  const burn = res.burn?.current ?? 0;
  const band = getBurnBand(burn, desc?.bands ?? BURN_BANDS);

  if (burn <= 0) {
    return ui.notifications.info(`${actor.name}: Burn is already at 0.`);
  }

  // Vent options come from the burn descriptor; fall back to the Aurablade set so
  // any non-registered caller keeps the original behavior.
  const ventDefs = desc?.vent ?? [
    { id: "meditate", label: "Meditate (action)",  reduce: 2,     req: "any",        desc: "Spend your action to reduce Burn by 2" },
    { id: "rest",     label: "Brief rest (5 min)", reduce: "all", req: "any",        desc: "Clear all Burn on a brief rest" },
    { id: "accept",   label: "Accept backlash",    reduce: 3,     req: "overheated", backlashStress: "1d6", desc: "Take 1d6 Stress to reduce Burn by 3" },
  ];
  const reduceOf = (o) => (o.reduce === "all" ? burn : (Number(o.reduce) || 1));
  const options  = ventDefs.filter(o => o.req === "any" || (o.req === "overheated" && band.label === "Overheated"));

  const opts = options.map(o =>
    `<option value="${o.id}" data-reduce="${reduceOf(o)}">${o.label} (−${Math.min(reduceOf(o), burn)} Burn) — ${o.desc}</option>`
  ).join("");

  new Dialog({
    title: "Stabilize Burn",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Current Burn</span>
          <span class="ft-prev-val" style="color:${band.color}">${burn} (${band.label})</span></span>
      </div>
      <div class="ft-cast-field">
        <label>Stabilization method</label>
        <select name="method">${opts}</select>
      </div>
    </div>`,
    buttons: {
      stabilize: {
        label: "Stabilize",
        callback: async (html) => {
          const sel    = html.find("[name='method'] option:selected");
          const reduce = parseInt(sel.data("reduce")) || 1;
          const method = html.find("[name='method']").val();
          const chosen = ventDefs.find(o => o.id === method);
          const newBurn = Math.max(0, burn - reduce);
          const updates = { "system.resources.burn.current": newBurn };
          // Backlash (if the chosen vent option carries one) costs Stress.
          if (chosen?.backlashStress) {
            const rawSys = actor.system?.system ?? actor.system;
            const curStr = rawSys?.derived?.stress?.value ?? 10;
            const roll = new Roll(String(chosen.backlashStress));
            await roll.evaluate();
            updates["system.derived.stress.value"] = Math.max(0, curStr - roll.total);
          }
          await actor.update(updates);
          ui.notifications.info(`${actor.name}: Burn reduced to ${newBurn}.`);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "stabilize"
  }).render(true);
}

// ─── Shadowjack dialogs ───────────────────────────────────────────────────────

export async function openAccessPool(actor) {
  const res = getResources(actor);
  const cur = res.accessDice?.current ?? 0;
  const max = res.accessDice?.max ?? 3;

  new Dialog({
    title: "Access Dice Pool",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.5rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Access Dice</span>
          <span class="ft-prev-val ft-clarity">${cur} / ${max}</span></span>
      </div>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Current dice</label>
          <input type="number" name="cur" value="${cur}" min="0" max="${max}"/></div>
        <div class="ft-cast-field"><label>Max dice</label>
          <input type="number" name="max" value="${max}" min="1" max="10"/></div>
      </div>
    </div>`,
    buttons: {
      save: { label: "Save", callback: async (html) => {
        const newCur = parseInt(html.find("[name='cur']").val()) || 0;
        const newMax = parseInt(html.find("[name='max']").val()) || max;
        await actor.update({
          "system.resources.accessDice.current": Math.min(newCur, newMax),
          "system.resources.accessDice.max": newMax,
        });
      }},
      close: { label: "Close" }
    },
    default: "save"
  }).render(true);
}

export async function openSpendAccessDie(actor) {
  const res = getResources(actor);
  const cur = res.accessDice?.current ?? 0;
  const max = res.accessDice?.max ?? 3;

  if (cur <= 0) {
    return ui.notifications.warn(`${actor.name}: No Access Dice remaining.`);
  }

  new Dialog({
    title: "Spend Access Die",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Access Dice</span>
          <span class="ft-prev-val ft-clarity">${cur}/${max}</span></span>
      </div>
      <div class="ft-cast-field">
        <label>Choose action</label>
        <select name="action">
          <option value="bypass">Bypass — ignore a simple lock, barrier, or alarm (no roll)</option>
          <option value="misdirect">Misdirect — force one enemy to lose track of you until next turn</option>
          <option value="breach">Time Breach — take an action out of initiative order (once per round)</option>
          <option value="vanish">Vanish — become unseen until you attack or are hit</option>
          <option value="plant">Plant Evidence — create a false trail; Intrigue vs Investigation DC 15</option>
        </select>
      </div>
    </div>`,
    buttons: {
      spend: {
        icon: "<i class='fas fa-key'></i>",
        label: "Spend Die",
        callback: async (html) => {
          const action = html.find("[name='action']").val();
          const newCur = Math.max(0, cur - 1);
          await actor.update({ "system.resources.accessDice.current": newCur });
          const labels = {
            bypass: "Bypass — ignoring lock, barrier, or alarm",
            misdirect: "Misdirect — target loses track of you",
            breach: "Time Breach — acting out of initiative order",
            vanish: "Vanish — unseen until you act aggressively",
            plant: "Plant Evidence — rolling Intrigue vs DC 15"
          };
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll ft-attack-roll">
              <div class="ft-roll-header">
                <span class="ft-roll-name">🗝 Access Die Spent</span>
                <span class="ft-defense-pill">${newCur}/${max} remaining</span>
              </div>
              <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.8">${labels[action]}</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "spend"
  }).render(true);
}

// ─── Breaker dialogs ─────────────────────────────────────────────────────────

export async function openBreakerRuin(actor) {
  // 2026-05-28 — Frame Dice / Ruin Charges retired; abilities folded into Surge.
  ui.notifications?.info(`${actor?.name ?? "Bulwark"}: Ruin Charges are retired — open the ◆ Surge menu (Catastrophic Entry / Shockwave Footing / Siege Works / Ruin to Renewal).`);
  return;
  const res      = getResources(actor);
  const ruin     = res.ruinCharges?.current ?? 0;
  const ruinMax  = res.ruinCharges?.max     ?? 3;
  const rawSys   = actor.system?.system ?? actor.system;
  const violence = rawSys?.attributes?.violence?.value ?? 2;

  new Dialog({
    title: "Breaker — Ruin Charges",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Ruin Charges</span>
          <span class="ft-prev-val" style="color:#c03030">${ruin} / ${ruinMax}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Violence OP Cap</span>
          <span class="ft-prev-val">+3 bonus</span></span>
      </div>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Ruin charges</label>
          <input type="number" name="ruin" value="${ruin}" min="0" max="${ruinMax}"/></div>
        <div class="ft-cast-field"><label>Max charges</label>
          <input type="number" name="ruinMax" value="${ruinMax}" min="1" max="10"/></div>
      </div>
      <div class="ft-cast-field" style="margin-top:0.5rem">
        <label>Spend ruin charge for</label>
        <select name="action">
          <option value="none">— Just update charges —</option>
          <option value="entry">Catastrophic Entry (ignore structure resistance / sunder foe armor)</option>
          <option value="siege">Siege Cost Reduction (−1 Violence OP this Siege)</option>
          <option value="shockwave">Shockwave Footing (resist knockback, push adjacent)</option>
          <option value="renewal">Ruin to Renewal (purify fortification, Faith/Economy DC 15)</option>
        </select>
      </div>
      <div class="ft-cast-field" style="margin-top:0.4rem">
        <label>Charges to spend</label>
        <input type="number" name="cost" value="1" min="0" max="${ruinMax}"/>
      </div>
      <p style="margin:0.3rem 0 0;font-size:0.72rem;opacity:0.6">Spends exactly this many charges from your current pool (the field above is only for manually re-setting the count). <b>Catastrophic Entry:</b> target a foe to <b>sunder their armor</b> — every attacker ignores it for 1 round; with no target it arms a structure breach that stays charged until you land a hit.</p>
    </div>`,
    buttons: {
      save: {
        label: "Apply",
        callback: async (html) => {
          const manualRuin = parseInt(html.find("[name='ruin']").val())    || 0;
          const newMax     = parseInt(html.find("[name='ruinMax']").val()) || ruinMax;
          const action     = html.find("[name='action']").val();
          const isSpend    = action !== "none";
          // Bulwark Stance · Advance reduces the Ruin cost by 1 (min 0).
          const _advance   = actor.getFlag("fourththing", "bulwarkStance") === "advance";
          // 2026-05-25 fix — spend EXACTLY the chosen number of charges from the
          // ACTUAL current pool. Previously the spend was layered on top of the
          // manual "Ruin charges" field, so setting it to 1 with 2 in the pool
          // ended at 0 ("consumed 2"). The manual field now only applies when
          // just updating (action = none).
          const wantCost   = Math.max(0, parseInt(html.find("[name='cost']").val()) || 1);
          const ruinCost   = isSpend ? Math.max(0, _advance ? wantCost - 1 : wantCost) : 0;

          // Catastrophic Entry vs a TARGETED foe — sunder their armor now
          // (immediate; costs Ruin now). With NO target it arms a structure
          // breach whose Ruin cost is DEFERRED to the hit (a miss wastes nothing).
          let sunderNote = "";
          const foes = (action === "entry")
            ? Array.from(game.user?.targets ?? []).map(t => t.actor).filter(Boolean) : [];
          const deferRuin = action === "entry" && foes.length === 0;
          if (foes.length) {
            const combat = game.combat;
            const dur = combat
              ? { rounds: 1, startRound: combat.round, startTurn: combat.turn, combat: combat.id }
              : { rounds: 1 };
            const sunderAE = {
              name: "Armor Sundered", img: "icons/svg/sword.svg", origin: actor.uuid,
              duration: dur, changes: [],
              flags: { fourththing: { armorSundered: true, source: actor.uuid } }
            };
            for (const foe of foes) {
              try { await game.fourththing?.applyEffectsToTarget?.(foe, [sunderAE], []); } catch (_e) {}
            }
            sunderNote = ` <span style="color:#ffb060">⚔ Armor sundered on ${foes.map(f => f.name).join(", ")} — all attackers ignore their armor for 1 round.</span>`;
          }

          const spentNow  = deferRuin ? 0 : ruinCost;
          const baseRuin  = isSpend ? ruin : manualRuin;
          const finalRuin = Math.min(Math.max(0, baseRuin - spentNow), newMax);
          const update = {
            "system.resources.ruinCharges.current": finalRuin,
            "system.resources.ruinCharges.max":     newMax,
          };
          if (deferRuin) update["flags.bbttcc-structures.bulwarkEntryRuinCost"] = ruinCost;
          await actor.update(update);

          if (isSpend) {
            const labels = {
              entry:     "Catastrophic Entry — structure resistance ignored",
              siege:     "Siege Cost Reduced — −1 Violence OP this Siege",
              shockwave: "Shockwave Footing — knockback resisted; adjacent pushed",
              renewal:   "Ruin to Renewal — attempting purification (Faith/Economy DC 15)"
            };
            const costNote = deferRuin ? `armed — ${ruinCost} Ruin spent on hit` : `spent ${ruinCost}`;
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll">
                <div class="ft-roll-header"><span class="ft-roll-name">⚒ Breaker: ${labels[action]?.split(' — ')[0]}</span></div>
                <p style="margin:0.2rem 0;font-size:0.8rem;opacity:0.75">${labels[action]}${sunderNote}</p>
                <p style="margin:0;font-size:0.72rem;opacity:0.5">Ruin Charges: ${finalRuin}/${newMax} · ${costNote}${_advance ? " · ⛰ Advance −1" : ""}</p>
              </div>`
            });
          }
        }
      },
      close: { label: "Close" }
    },
    default: "save"
  }).render(true);
}

// ─── Dreamwalker dialogs ──────────────────────────────────────────────────────

export async function openDreamwalkerResonance(actor) {
  const res         = getResources(actor);
  const resonant    = res.dreamResonance?.active  ?? false;
  const insightUsed = res.dreamResonance?.insightUsed ?? false;
  const hexSeph     = res.dreamResonance?.hexSephirah ?? "";
  const rawSys      = actor.system?.system ?? actor.system;
  const actorSeph   = rawSys?.magic?.sephirah ?? "tiferet";

  new Dialog({
    title: "Dreamwalker — Resonance",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Resonance</span>
          <span class="ft-prev-val" style="color:${resonant ? '#a0b4ff' : '#888'}">${resonant ? "Active" : "None"}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Insight</span>
          <span class="ft-prev-val" style="color:${insightUsed ? '#888' : '#e8c84a'}">${insightUsed ? "Used" : "Available"}</span></span>
      </div>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Hex Sephirah resonance</label>
          <input type="text" name="hexSeph" value="${hexSeph}" placeholder="e.g. tiferet"/></div>
      </div>
      <div class="ft-cast-field" style="margin-top:0.5rem">
        <label>Action</label>
        <select name="action">
          <option value="none">— Update state only —</option>
          <option value="detect">Detect Spark resonance (passive — note hex sephirah above)</option>
          <option value="insight" ${insightUsed ? 'disabled' : ''}>Commune with Great Work (1/rest — GM insight)</option>
          <option value="reset_insight">Reset insight use (after rest)</option>
        </select>
      </div>
      <div class="ft-cast-field" style="margin-top:0.3rem">
        <label><input type="checkbox" name="resonant" ${resonant ? 'checked' : ''}/> Resonance active this hex</label>
      </div>
    </div>`,
    buttons: {
      apply: {
        label: "Apply",
        callback: async (html) => {
          const action       = html.find("[name='action']").val();
          const newResonant  = html.find("[name='resonant']").is(":checked");
          const newHexSeph   = html.find("[name='hexSeph']").val().trim();
          const newInsight   = action === "reset_insight" ? false
                             : action === "insight"       ? true
                             : insightUsed;
          await actor.update({
            "system.resources.dreamResonance.active":      newResonant,
            "system.resources.dreamResonance.insightUsed": newInsight,
            "system.resources.dreamResonance.hexSephirah": newHexSeph,
          });
          if (action === "insight") {
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll">
                <div class="ft-roll-header"><span class="ft-roll-name">◎ Dreamwalker: Commune</span></div>
                <p style="margin:0.2rem 0;font-size:0.8rem;opacity:0.75">Communing with the Great Work for insight. GM — provide a hint relating to active Spark quests.</p>
              </div>`
            });
          }
          if (action === "detect" && newHexSeph) {
            const matches = newHexSeph === actorSeph;
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll">
                <div class="ft-roll-header"><span class="ft-roll-name">◎ Spark Detection: ${newHexSeph}</span></div>
                <p style="margin:0.2rem 0;font-size:0.8rem;opacity:0.75">${matches ? "✦ Resonance detected — your Sephirah matches this hex." : "No resonance — hex Sephirah differs from yours."}</p>
              </div>`
            });
          }
        }
      },
      close: { label: "Close" }
    },
    default: "apply"
  }).render(true);
}

// Phase C 2026-05-07 — Dreamwalker Dream-Cache deploy.
// Reads system.resources.dreamCache; if a manifestation is banked, empties
// the cache and casts the item via castManifestation with freeClarity:true.
// Wired into FEATURE_ROUTER as `dreamwalker_deploy_cache`; the Deploy button
// on the sheet's Cache chip routes here.
export async function openDreamwalkerDeployCache(actor) {
  const rawSys = actor.system?.system ?? actor.system;
  const cache  = rawSys?.resources?.dreamCache ?? {};
  if (!cache.banked) {
    return ui.notifications?.warn(`${actor.name}: Dream-Cache is empty.`);
  }
  const item = actor.items?.get?.(cache.itemId);
  if (!item) {
    await actor.update({
      "system.resources.dreamCache.banked": false,
      "system.resources.dreamCache.name":   "",
      "system.resources.dreamCache.tier":   0,
      "system.resources.dreamCache.itemId": ""
    });
    return ui.notifications?.warn(`${actor.name}: Dream-Cache item missing (deleted since banking). Cache emptied.`);
  }
  const sys = item.system ?? {};
  const intent  = sys.intent   ?? "presence";
  const channel = sys.channel  ?? "soul";
  const seph    = sys.sephirah ?? rawSys?.magic?.sephirah ?? "tiferet";

  // Empty the cache atomically before the cast so a failed re-cast doesn't
  // leave a phantom "deployed but still banked" state.
  await actor.update({
    "system.resources.dreamCache.banked": false,
    "system.resources.dreamCache.name":   "",
    "system.resources.dreamCache.tier":   0,
    "system.resources.dreamCache.itemId": ""
  });

  // Re-fire the cast. castManifestation lives on game.fourththing — the
  // Dreamwalker class always carries the function via the system load.
  const cast = game.fourththing?.castManifestation;
  if (typeof cast === "function") {
    return cast(actor, item, { intent, channel, sephirah: seph, label: item.name, freeClarity: true });
  }
  ui.notifications?.warn(`${actor.name}: cast pipeline unavailable — manifestation deploy aborted.`);
}

// Dreamwalker — Generic per-Soma-Break feat activator. Each of the 8
// toggleable Dreamwalker feats (Dream-Thread Tuning, Dream Rite, Omen-Thread
// Weaving, Mnemonic Spillway, Waking Dreamfield, Ascension Layer, Fractal
// Self, Apotheosis of the Oneiric) ships with one or more `disabled:true,
// transfer:false` AEs sitting on the item. This handler:
//   1. Surveys the item's effects.
//   2. Single-effect → activates immediately. Multi-effect → mode picker.
//   3. Removes any prior active clones of this feat from the actor.
//   4. Clones the chosen effect to the actor as a live AE (disabled:false,
//      transfer:false, start.time = now so duration counts down naturally).
//   5. Decrements the item's per-Soma-Break uses (already reset by somaBreak).
//   6. Posts a chat card.
// Re-clicking the feat re-toggles (deletes prior clone, creates a new one
// IF uses still available). To end early, delete the AE off the actor.
export async function openDreamwalkerFeatActivate(actor, item) {
  if (!actor || !item) return;
  const max   = Number(item.system?.uses?.max)   || 1;
  const spent = Number(item.system?.uses?.spent) || 0;
  const remaining = Math.max(0, max - spent);

  // Effects on the item — only the disabled-on-item ones are togglable
  // (transfer:true effects are passive and already applied on grant).
  const effects = (item.effects ?? []).filter(e => e.transfer === false || e.disabled === true);
  if (!effects.length) {
    return ui.notifications?.warn(`${item.name}: no togglable effect found on this feat.`);
  }

  // Existing actor-side clones of this feat → for status display.
  const priorClones = (actor.effects ?? []).filter(e => e.flags?.fourththing?.dwFeatItemId === item.id);

  // Single-effect: skip the picker, prompt confirm.
  if (effects.length === 1) {
    if (priorClones.length) {
      const ok = await Dialog.confirm({
        title:   item.name,
        content: `<p style="font-size:0.85rem">${_ftEscape(item.name)} is currently active. Re-toggle (deactivates the current effect)?</p>`
      });
      if (!ok) return;
      await actor.deleteEmbeddedDocuments("ActiveEffect", priorClones.map(e => e.id));
      return ui.notifications?.info(`${item.name} deactivated.`);
    }
    if (remaining < 1) return ui.notifications?.warn(`${actor.name}: ${item.name} already used this Soma Break (${spent}/${max}).`);
    return _ftDwApplyFeatEffect(actor, item, effects[0]);
  }

  // Multi-effect: radio picker.
  const opts = effects.map((e, i) => `<label style="display:block;margin:0.3rem 0;cursor:pointer;padding:0.3rem;border:1px solid #3a8a8a44;border-radius:3px">
    <input type="radio" name="effIdx" value="${i}" ${i===0?"checked":""} style="margin-right:0.4rem"/>
    <strong style="color:#a0d8d4">${_ftEscape(e.name)}</strong>
  </label>`).join("");
  const status = remaining < 1
    ? `<p style="color:#ff8a8a;font-size:0.78rem;margin:0.3rem 0">Already used this Soma Break (${spent}/${max}). Pick to re-toggle current.</p>`
    : `<p style="font-size:0.78rem;opacity:0.7;margin:0.3rem 0">Uses left: ${remaining}/${max}</p>`;
  const priorNote = priorClones.length
    ? `<p style="font-size:0.74rem;color:#a0d4ff;margin:0.2rem 0">Currently active: <em>${priorClones.map(c => _ftEscape(c.name)).join(", ")}</em>. Activating a new mode replaces it.</p>`
    : "";
  new Dialog({
    title: `${item.name} — pick mode`,
    content: `<div class="ft-cast-dialog">${status}${priorNote}${opts}</div>`,
    buttons: {
      apply: {
        label: "Activate",
        callback: async (html) => {
          if (remaining < 1 && !priorClones.length) {
            return ui.notifications?.warn(`${actor.name}: ${item.name} already used this Soma Break.`);
          }
          const idx = parseInt(html.find("[name='effIdx']:checked").val()) || 0;
          await _ftDwApplyFeatEffect(actor, item, effects[idx]);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
}

async function _ftDwApplyFeatEffect(actor, item, effect) {
  // Sweep prior clones of this feat — re-toggle replaces, doesn't stack.
  const prior = (actor.effects ?? []).filter(e => e.flags?.fourththing?.dwFeatItemId === item.id);
  if (prior.length) {
    try { await actor.deleteEmbeddedDocuments("ActiveEffect", prior.map(e => e.id)); }
    catch (_) { /* permission edge — fall through */ }
  }

  // Clone the effect to the actor with disabled:false + start.time so
  // Foundry's duration tracker counts down from now.
  const effObj = effect.toObject ? effect.toObject() : foundry.utils.deepClone(effect);
  delete effObj._id;
  delete effObj._key;
  effObj.disabled = false;
  effObj.transfer = false;
  effObj.origin   = item.uuid;
  effObj.start    = { time: game.time?.worldTime ?? 0 };
  effObj.flags = effObj.flags ?? {};
  effObj.flags.fourththing = effObj.flags.fourththing ?? {};
  effObj.flags.fourththing.dwFeatItemId = item.id;
  effObj.flags.fourththing.dwFeatMode   = effect.name;

  try { await actor.createEmbeddedDocuments("ActiveEffect", [effObj]); }
  catch (e) { console.warn("Roll for Initiation | DW feat activate failed", e); return; }

  // Decrement per-Soma-Break uses (existing somaBreak action resets all
  // item uses to 0, so the cap refreshes naturally on rest).
  const max   = Number(item.system?.uses?.max)   || 1;
  const spent = Number(item.system?.uses?.spent) || 0;
  if (max > 0) {
    try { await item.update({ "system.uses.spent": Math.min(max, spent + 1) }); }
    catch (_) { /* permission edge — silent */ }
  }

  // Compose chat card. Duration handling: Foundry counts down by world time
  // from start.time + duration.value (seconds); when expired the AE auto-
  // disables on the next tick. For most DW feats this is 600s = 10 minutes.
  const durSecs = Number(effect.duration?.value) || 0;
  const durNote = durSecs > 0 ? `Duration: ${Math.round(durSecs / 60)} min (auto-expires).` : "Active until Soma Break or manual deactivation.";
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fourththing-roll" style="border-color:#3a8a8a">
      <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0d8d4">◐ ${_ftEscape(item.name)} — ${_ftEscape(effect.name)}</span></div>
      <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.85">${durNote}</p>
    </div>`
  });
}

// Dreamwalker — Dream Echo Reservoir (L13 feature, compendium tAsGXgZrgFdpNyVi).
// Display + manual edit dialog. Echo Dice are d6, max 2, gained 1/Soma Break.
export async function openDreamwalkerEchoReservoir(actor) {
  const rawSys = actor.system?.system ?? actor.system;
  const ed = rawSys?.resources?.echoDice ?? { dice: 0, maxDice: 2 };
  new Dialog({
    title: "Dreamwalker — Dream Echo Reservoir",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Echo Dice</span>
          <span class="ft-prev-val" style="color:#a0d8d4">${ed.dice} / ${ed.maxDice} d6</span></span>
      </div>
      <p style="font-size:0.72rem;opacity:0.6;margin:0.4rem 0">
        Bottled fragments of unrealized possibility. Gain 1 die per Soma Break (auto, capped at ${ed.maxDice}). Spend modes: Self-Resonance · Shared Echo · World-Tuning.
      </p>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Current dice</label>
          <input type="number" name="dice" value="${ed.dice}" min="0" max="${ed.maxDice}"/></div>
      </div>
    </div>`,
    buttons: {
      save: {
        label: "Apply Manual Edit",
        callback: async (html) => {
          const dice = Math.max(0, Math.min(ed.maxDice, parseInt(html.find("[name='dice']").val()) || 0));
          await actor.update({ "system.resources.echoDice.dice": dice });
        }
      },
      close: { label: "Close" }
    },
    default: "save"
  }).render(true);
}

// Dreamwalker — Spend Echo Die: rolls 1d6, prompts for one of three spend
// modes (Self-Resonance / Shared Echo / World-Tuning), debits one die on
// confirm. Per canonical L13 Dream Echo Reservoir feature.
export async function openDreamwalkerSpendEchoDie(actor) {
  const rawSys = actor.system?.system ?? actor.system;
  const ed = rawSys?.resources?.echoDice ?? { dice: 0, maxDice: 2 };
  if (ed.dice < 1) {
    return ui.notifications?.warn(`${actor.name}: no Echo Dice to spend (${ed.dice}/${ed.maxDice} d6).`);
  }
  const roll = new Roll("1d6");
  await roll.evaluate();
  const rolled = roll.total;
  new Dialog({
    title: `Dreamwalker — Spend Echo Die (rolled ${rolled} on d6)`,
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Roll</span>
          <span class="ft-prev-val" style="color:#a0d8d4;font-weight:700">${rolled}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Pool after spend</span>
          <span class="ft-prev-val">${ed.dice - 1} / ${ed.maxDice} d6</span></span>
      </div>
      <div class="ft-cast-field">
        <label>Spend mode</label>
        <select name="mode">
          <option value="self">Self-Resonance — +${rolled} to your failed attribute check / attack roll / defense check (after seeing the roll)</option>
          <option value="shared">Shared Echo — +${rolled} to an ally's failed attribute / defense check (within 30 ft)</option>
          <option value="world">World-Tuning — -${rolled} to an environmental DC against you (Travel hazard, Slippage shift, Qliphothic anomaly, etc.)</option>
        </select>
      </div>
      <div class="ft-cast-field">
        <label>Target / context (narrative)</label>
        <input type="text" name="ctx" placeholder="e.g., 'failed Stealth roll vs Hex 7 hazard'"/>
      </div>
    </div>`,
    buttons: {
      apply: {
        label: "Spend",
        callback: async (html) => {
          const mode = html.find("[name='mode']").val();
          const ctx  = html.find("[name='ctx']").val()?.trim() || "(unspecified)";
          await actor.update({ "system.resources.echoDice.dice": Math.max(0, ed.dice - 1) });
          const labels = {
            self:   { icon: "◐", title: "Self-Resonance", body: `+<b>${rolled}</b> to your failed check (after seeing the roll).` },
            shared: { icon: "◑", title: "Shared Echo",    body: `+<b>${rolled}</b> to an ally's failed check (within 30 ft).` },
            world:  { icon: "◒", title: "World-Tuning",   body: `-<b>${rolled}</b> to an environmental DC against you (hazard / shift / anomaly).` }
          };
          const lbl = labels[mode] ?? labels.self;
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#3a8a8a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0d8d4">${lbl.icon} Echo Die — ${lbl.title}</span></div>
              <p style="margin:0.3rem 0;font-size:0.82rem">${lbl.body}</p>
              <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85"><b>Context:</b> ${_ftEscape(ctx)}</p>
              <p style="margin:0;font-size:0.72rem;opacity:0.55">Pool now ${Math.max(0, ed.dice - 1)}/${ed.maxDice} d6.</p>
            </div>`,
            rolls: [roll]
          });
        }
      },
      cancel: { label: "Cancel (refund die)" }
    },
    default: "apply"
  }).render(true);
}

// ─── Soul-Smith dialogs ───────────────────────────────────────────────────────
// Canon (Phase 1.5):
//   T1 Sanctified Forge Initiate — Faith +1, Plating apt, Economy OP hex repair
//   T2 Atonement Crucible        — 1/arc, purify a Corrupted Spark
//   T3 Furnace of Renewal        — passive poison+necrotic resist, rest-bonus narrative
//   T4 Relic of Rebirth          — 1-per-use artifact, restores a corrupted region
//
// One handler per canon feature (was a single combined Forge dialog; refactored
// 2026-05-23 because conflating four features behind one dropdown made the
// 1/arc and 1/Soma Break gates ambiguous in play).

function _ssCharTier(actor) {
  const sys = actor?.system?.system ?? actor?.system ?? {};
  return Math.max(1, Math.min(4, Number(sys?.details?.tier) || 1));
}

// ── Tier 1 — Sanctified Forge Initiate ──────────────────────────────────────
export async function openSoulSmithForgeInitiate(actor) {
  const granted = !!actor.flags?.fourththing?.soulSmith?.l1GrantsApplied;
  const sys = actor.system?.system ?? actor.system ?? {};
  const faithRank   = Number(sys?.skills?.faith?.value)   || 0;
  const platingRank = Number(sys?.skills?.plating?.value) || 0;

  new Dialog({
    title: "Soul-Smith · Sanctified Forge Initiate (T1)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">You can spend Economy OP to repair or stabilize damaged hexes more effectively — focal point for infrastructure recovery. (GM adjudicates spend at the table.)</p>
      <div class="ft-preview-stats" style="margin-bottom:0.5rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Faith rank</span>
          <span class="ft-prev-val">${faithRank}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Plating rank</span>
          <span class="ft-prev-val">${platingRank}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">L1 grants</span>
          <span class="ft-prev-val" style="color:${granted ? '#a0d8b8' : '#e8c84a'}">${granted ? "Applied" : "Pending"}</span></span>
      </div>
      ${granted ? "" : `<p style="font-size:0.72rem;opacity:0.7;margin:0.2rem 0">Click <b>Apply L1 grants</b> to add +1 Faith and +1 Plating (one-time, idempotent).</p>`}
    </div>`,
    buttons: {
      ...(granted ? {} : {
        grant: {
          label: "Apply L1 grants",
          callback: async () => {
            const updates = {
              "system.skills.faith.value":   Math.max(faithRank, faithRank + 1, 1),
              "system.skills.plating.value": Math.max(platingRank, platingRank + 1, 1),
              "flags.fourththing.soulSmith.l1GrantsApplied": true
            };
            await actor.update(updates);
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll" style="border-color:#8a6a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#e8c8a0">⚒ Sanctified Forge Initiate — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem">+1 Faith and +1 Plating applied.</p></div>`
            });
          }
        }
      }),
      hex: {
        label: "Announce hex repair",
        callback: async () => {
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#8a6a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#e8c8a0">⚒ Forge Initiate — Hex Repair</span></div><p style="margin:0.3rem 0;font-size:0.82rem">${_ftEscape(actor.name)} channels Economy OP into repairing / stabilizing a damaged hex. GM tracks the repair budget at the strategic layer.</p></div>`
          });
        }
      },
      close: { label: "Close" }
    },
    default: granted ? "hex" : "grant"
  }).render(true);
}

// ── Tier 2 — Atonement Crucible ─────────────────────────────────────────────
export async function openSoulSmithAtonementCrucible(actor) {
  const used = !!actor.flags?.fourththing?.soulSmith?.atonementUsedThisArc;

  new Dialog({
    title: "Soul-Smith · Atonement Crucible (T2)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Once per campaign arc, lead an atonement crafting project to attempt to <b>purify a single Corrupted Spark</b> instead of destroying it — transforming it into a redeemed or stabilized form.</p>
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${used ? "USED THIS ARC — reset at next arc" : "AVAILABLE"}</b></p>
      <div class="ft-cast-field"><label>Spark being purified (narrative)</label>
        <input type="text" name="spark" placeholder="e.g., the Spark of Calliope's Tomb"/></div>
      <p style="font-size:0.7rem;opacity:0.55;margin:0.4rem 0 0">Mechanics: GM applies the Tikkun/Spark-engine outcome at the table; the canon swap is destruction → redemption.</p>
    </div>`,
    buttons: {
      ...(used ? {} : {
        lead: {
          label: "Lead the Crucible",
          callback: async (html) => {
            const spark = String(html.find("[name='spark']").val() || "").trim() || "(unnamed Spark)";
            await actor.update({ "flags.fourththing.soulSmith.atonementUsedThisArc": true });
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll" style="border-color:#5a3a8a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#d4b8e8">⚒ Atonement Crucible — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem">${_ftEscape(actor.name)} leads an atonement project to purify <b>${_ftEscape(spark)}</b>. GM resolves via Tikkun/Spark rules.</p><p style="margin:0.2rem 0 0;font-size:0.72rem;opacity:0.55">Used this arc — refresh at next arc.</p></div>`
            });
          }
        }
      }),
      reset: {
        label: "Reset (new arc)",
        callback: async () => {
          await actor.update({ "flags.fourththing.soulSmith.atonementUsedThisArc": false });
          ui.notifications?.info(`${actor.name}: Atonement Crucible refreshed for new arc.`);
        }
      },
      close: { label: "Close" }
    },
    default: used ? "close" : "lead"
  }).render(true);
}

// ── Tier 3 — Furnace of Renewal ─────────────────────────────────────────────
export async function openSoulSmithFurnaceOfRenewal(actor) {
  const tier = _ssCharTier(actor);
  const active = tier >= 3;
  new Dialog({
    title: "Soul-Smith · Furnace of Renewal (T3)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Passive: resistance to <b>poison</b> and <b>necrotic</b> damage. (Auto-applied as an Active Effect when you reach Tier 3.)</p>
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Rest-bonus: during rests you oversee, allies regain extra Integrity when they spend Body dice — your fire burns away the worst of what's stuck to them.</p>
      <p style="font-size:0.74rem;opacity:0.7;margin:0.3rem 0">Status: <b style="color:${active ? "#a0d8b8" : "#e8c84a"}">${active ? "ACTIVE (Tier " + tier + ")" : "PENDING (current tier " + tier + " — reach Tier 3)"}</b></p>
    </div>`,
    buttons: {
      ...(active ? {
        announce: {
          label: "Announce rest-bonus to table",
          callback: async () => {
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll" style="border-color:#8a6a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#ffc878">🔥 Furnace of Renewal — ${_ftEscape(actor.name)} oversees this rest</span></div><p style="margin:0.3rem 0;font-size:0.82rem">Allies who spend Body dice during this rest regain <b>extra Integrity</b>. ${_ftEscape(actor.name)}'s fire burns away the worst of what's stuck to them. (GM applies the per-die bump.)</p></div>`
            });
          }
        }
      } : {}),
      close: { label: "Close" }
    },
    default: "close"
  }).render(true);
}

// ── Tier 4 — Relic of Rebirth ───────────────────────────────────────────────
export async function openSoulSmithRelicOfRebirth(actor) {
  const tier      = _ssCharTier(actor);
  const available = tier >= 4;
  const used      = !!actor.flags?.fourththing?.soulSmith?.relicUsed;

  new Dialog({
    title: "Soul-Smith · Relic of Rebirth (T4)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Forge a Relic of Rebirth — massive, one-per-use artifact capable of restoring a corrupted or ruined region/hex in a single, campaign-shaping stroke.</p>
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b style="color:${!available ? "#888" : used ? "#888" : "#e8c84a"}">${!available ? "LOCKED (Tier " + tier + " — reach Tier 4)" : used ? "USED — refresh on Soma Break" : "AVAILABLE"}</b></p>
      ${available ? `<div class="ft-cast-field"><label>Region / hex being restored (narrative)</label>
        <input type="text" name="region" placeholder="e.g., the Burned Vale of Yesod"/></div>` : ""}
    </div>`,
    buttons: {
      ...(available && !used ? {
        forge: {
          label: "Forge the Relic",
          callback: async (html) => {
            const region = String(html.find("[name='region']").val() || "").trim() || "(unspecified region)";
            await actor.update({ "flags.fourththing.soulSmith.relicUsed": true });
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll" style="border-color:#a07a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#ffd498">⚒ Relic of Rebirth — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem">A campaign-shaping artifact is forged. <b>${_ftEscape(region)}</b> is restored.</p><p style="margin:0.2rem 0 0;font-size:0.72rem;opacity:0.55">One-per-use — refresh on Soma Break.</p></div>`
            });
          }
        }
      } : {}),
      reset: {
        label: "Reset (Soma Break)",
        callback: async () => {
          await actor.update({ "flags.fourththing.soulSmith.relicUsed": false });
          ui.notifications?.info(`${actor.name}: Relic of Rebirth refreshed.`);
        }
      },
      close: { label: "Close" }
    },
    default: available && !used ? "forge" : "close"
  }).render(true);
}

// Back-compat shim — old dispatcher / compendium content keyed to
// "soul_smith_forge" routes here. Picks the right tier handler by current tier.
export async function openSoulSmithForge(actor) {
  const tier = _ssCharTier(actor);
  if (tier >= 4) return openSoulSmithRelicOfRebirth(actor);
  if (tier >= 3) return openSoulSmithFurnaceOfRenewal(actor);
  if (tier >= 2) return openSoulSmithAtonementCrucible(actor);
  return openSoulSmithForgeInitiate(actor);
}

// RETIRED placeholder so the original block's closing brace still has scope.
async function _RETIRED_OldSoulSmithForgeBlock(actor) {
  const res       = getResources(actor);
  const relicUsed = res.forgeCharge?.relicUsed ?? false;
  const sparks    = res.forgeCharge?.sparksRepaired ?? 0;
  new Dialog({
    title: "Soul-Smith — Forge Charge",
    content: `<div class="ft-cast-dialog">retired placeholder</div>`,
    buttons: {
      apply: { label: "Apply", callback: () => {} },
      close: { label: "Close" }
    },
    default: "apply"
  }).render(true);
}

// ─── Harmony Marshal dialogs ─────────────────────────────────────────────────
// Canon (Phase 1.5):
//   T1 Harmony Initiate   — Diplomacy +1, Insight +1, Soft Power +10% gen (narrative)
//   T2 Attrition Easer    — 1/strategic turn: spend 1 Soft Power OP → -1 Attrition faction-wide
//   T3 Loyalty Steward    — on resolved hex/faction conflict: chosen hex Loyalty +1
//   T4 Unity Conductor    — faction passive: +2 Soft Power OP per strategic turn
// (No personal resource pool by canon — strategic-layer specialist.)

function _hmCharTier(actor) {
  const sys = actor?.system?.system ?? actor?.system ?? {};
  return Math.max(1, Math.min(4, Number(sys?.details?.tier) || 1));
}

function _hmGetFaction(actor) {
  const fid = actor?.getFlag?.("bbttcc-factions", "factionId");
  const fname = actor?.getFlag?.("bbttcc-factions", "factionName");
  const sys = actor?.system?.system ?? actor?.system ?? {};
  const sysFid = sys?.faction?.id;
  const sysFname = sys?.faction?.name;
  const targetId = fid || sysFid;
  const targetName = fname || sysFname;
  if (targetId) return (game.actors?.contents ?? []).find(a => a.id === targetId || a.uuid === targetId);
  if (targetName) return (game.actors?.contents ?? []).find(a => a.type === "npc" && a.name === String(targetName).trim());
  return null;
}

// ── Tier 1 — Harmony Initiate ───────────────────────────────────────────────
export async function openHarmonyMarshalInitiate(actor) {
  const granted = !!actor.flags?.fourththing?.harmonyMarshal?.l1GrantsApplied;
  const sys = actor.system?.system ?? actor.system ?? {};
  const diplomacyRank = Number(sys?.skills?.diplomacy?.value) || 0;
  const insightRank   = Number(sys?.skills?.insight?.value)   || 0;
  const faction       = _hmGetFaction(actor);

  new Dialog({
    title: "Harmony Marshal · Harmony Initiate (T1)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Your faction's Soft Power generation increases by <b>10%</b> (rounding in your favor) as Command routes hearts-and-minds work through you.</p>
      <div class="ft-preview-stats" style="margin-bottom:0.5rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Diplomacy</span>
          <span class="ft-prev-val">${diplomacyRank}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Insight</span>
          <span class="ft-prev-val">${insightRank}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">L1 grants</span>
          <span class="ft-prev-val" style="color:${granted ? '#a0d8b8' : '#e8c84a'}">${granted ? "Applied" : "Pending"}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Faction</span>
          <span class="ft-prev-val">${_ftEscape(faction?.name ?? "(none)")}</span></span>
      </div>
      ${granted ? "" : `<p style="font-size:0.72rem;opacity:0.7;margin:0.2rem 0">Click <b>Apply L1 grants</b> to add +1 Diplomacy and +1 Insight (one-time, idempotent).</p>`}
      <p style="font-size:0.7rem;opacity:0.55;margin:0.4rem 0 0">SP +10% generation is a passive — GM applies at the strategic-turn rollover when computing faction OPs.</p>
    </div>`,
    buttons: {
      ...(granted ? {} : {
        grant: {
          label: "Apply L1 grants",
          callback: async () => {
            const updates = {
              "system.skills.diplomacy.value": Math.max(diplomacyRank, diplomacyRank + 1, 1),
              "system.skills.insight.value":   Math.max(insightRank, insightRank + 1, 1),
              "flags.fourththing.harmonyMarshal.l1GrantsApplied": true
            };
            await actor.update(updates);
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll" style="border-color:#5a8a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#b8d896">⚖ Harmony Initiate — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem">+1 Diplomacy and +1 Insight applied. Faction Soft Power generation +10% (narrative — GM applies at strategic turn).</p></div>`
            });
          }
        }
      }),
      close: { label: "Close" }
    },
    default: granted ? "close" : "grant"
  }).render(true);
}

// ── Tier 2 — Attrition Easer ────────────────────────────────────────────────
export async function openHarmonyMarshalAttritionEaser(actor) {
  const used = !!actor.flags?.fourththing?.harmonyMarshal?.attritionEaserUsedThisTurn;
  const faction = _hmGetFaction(actor);
  // Real faction OP lives at flags.bbttcc-factions.opBank.<bucket> in MARKS
  // (1 OP = OP_TO_MARKS marks). Spend via the canonical OP commit API so caps +
  // underflow are honored — NOT the phantom system.opPools.softpower field
  // (which nothing in bbttcc-factions ever read).
  const opApi = game.bbttcc?.api?.op;
  const marksPerOP = opApi?.OP_TO_MARKS || 10;
  const bank = faction?.getFlag?.("bbttcc-factions", "opBank") || {};
  const currentSP = Math.floor((Number(bank.softpower) || 0) / marksPerOP);
  const canAfford = currentSP >= 1 && !!opApi?.commit;

  new Dialog({
    title: "Harmony Marshal · Attrition Easer (T2)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Once per strategic turn, spend <b>1 Soft Power OP</b> to remove <b>1 Attrition point</b> faction-wide — reconciliation campaigns, rest cycles, "we actually talked about it" debriefs.</p>
      <div class="ft-preview-stats" style="margin-bottom:0.5rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Faction</span>
          <span class="ft-prev-val">${_ftEscape(faction?.name ?? "(unbound)")}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Soft Power OP</span>
          <span class="ft-prev-val" style="color:${canAfford ? '#a0d8b8' : '#eb5757'}">${currentSP}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">This turn</span>
          <span class="ft-prev-val" style="color:${used ? '#888' : '#e8c84a'}">${used ? "USED" : "AVAILABLE"}</span></span>
      </div>
      ${!faction ? `<p style="color:#eb5757;font-size:0.74rem">⚠ No faction bound — bind via the faction dropdown on the sheet first.</p>` : ""}
      ${!canAfford && faction ? `<p style="color:#eb5757;font-size:0.74rem">⚠ Faction has no Soft Power OP to spend.</p>` : ""}
    </div>`,
    buttons: {
      ...(faction && canAfford && !used ? {
        spend: {
          label: "Spend 1 SP OP · Ease 1 Attrition",
          callback: async () => {
            const res = await opApi.commit(faction.id, { softpower: -marksPerOP }, { context: "harmony-marshal-attrition-easer" });
            if (!res?.committed) {
              return ui.notifications?.warn(`${actor.name}: could not spend Soft Power OP (${res?.error || "insufficient / cap"}).`);
            }
            await actor.update({ "flags.fourththing.harmonyMarshal.attritionEaserUsedThisTurn": true });
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll" style="border-color:#5a8a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#b8d896">⚖ Attrition Easer — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem"><b>${_ftEscape(faction.name)}</b>: −1 Soft Power OP (now ${currentSP - 1}), <b>−1 Attrition</b> faction-wide. GM applies the Attrition reduction to the faction sheet.</p><p style="margin:0.2rem 0 0;font-size:0.72rem;opacity:0.55">Used this strategic turn — refresh at next turn.</p></div>`
            });
          }
        }
      } : {}),
      reset: {
        label: "Reset (new strategic turn)",
        callback: async () => {
          await actor.update({ "flags.fourththing.harmonyMarshal.attritionEaserUsedThisTurn": false });
          ui.notifications?.info(`${actor.name}: Attrition Easer refreshed.`);
        }
      },
      close: { label: "Close" }
    },
    default: faction && canAfford && !used ? "spend" : "close"
  }).render(true);
}

// ── Tier 3 — Loyalty Steward ────────────────────────────────────────────────
export async function openHarmonyMarshalLoyaltySteward(actor) {
  // List candidate hexes — for the simple version, just collect any hex tile
  // documents the user can see. Fall back to a free-text "hex name" input.
  const hexes = (game.scenes?.contents ?? [])
    .filter(s => /hex/i.test(s.name) || s.flags?.["bbttcc-territory"]?.hexId)
    .map(s => ({ id: s.id, name: s.name }));
  const hexOptions = hexes.length
    ? hexes.map(h => `<option value="${h.id}">${_ftEscape(h.name)}</option>`).join("")
    : `<option value="">(no hex scenes detected — describe in chat below)</option>`;

  new Dialog({
    title: "Harmony Marshal · Loyalty Steward (T3)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">On a successful major Diplomacy check (or Courtly Intrigue scene win) that resolves a hex- or faction-level conflict: choose one affected hex — <b>Loyalty in that hex increases by 1</b>.</p>
      <div class="ft-cast-field">
        <label>Affected hex</label>
        <select name="hex" ${hexes.length ? "" : "disabled"}>${hexOptions}</select>
      </div>
      <div class="ft-cast-field">
        <label>Or describe the hex (chat narrative)</label>
        <input type="text" name="hexNote" placeholder="e.g., Hex 12 — Allesh Gilliam Long Market"/>
      </div>
      <p style="font-size:0.7rem;opacity:0.55;margin:0.4rem 0 0">If a hex scene is selected, its Loyalty flag is incremented. Otherwise narrative only — GM applies on the faction/hex sheet.</p>
    </div>`,
    buttons: {
      apply: {
        label: "Apply Loyalty +1",
        callback: async (html) => {
          const hexId = html.find("[name='hex']").val();
          const note  = String(html.find("[name='hexNote']").val() || "").trim();
          let hexName = note || "(unspecified hex)";
          let bumped = false;
          if (hexId) {
            const scene = game.scenes.get(hexId);
            if (scene) {
              hexName = scene.name;
              // Hex loyalty lives under the bbttcc-territory namespace — the same
              // field adjustHexTrack (turn-driver.js) writes and the territory
              // upkeep/overview read. The old bbttcc-factions write was a dead
              // path nothing consumed. Floor at 0 to match adjustHexTrack.
              const cur = Number(scene.getFlag?.("bbttcc-territory", "loyalty")) || 0;
              await scene.setFlag("bbttcc-territory", "loyalty", Math.max(0, cur + 1));
              bumped = true;
            }
          }
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#5a8a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#b8d896">⚖ Loyalty Steward — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem">Loyalty +1 in <b>${_ftEscape(hexName)}</b>.${bumped ? "" : " <em>(narrative — GM applies)</em>"}</p></div>`
          });
        }
      },
      close: { label: "Close" }
    },
    default: "apply"
  }).render(true);
}

// ── Tier 4 — Unity Conductor ────────────────────────────────────────────────
export async function openHarmonyMarshalUnityConductor(actor) {
  const faction = _hmGetFaction(actor);

  new Dialog({
    title: "Harmony Marshal · Unity Conductor (T4)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Passive: your faction gains an additional <b>+2 Soft Power OP per strategic turn</b>, as long as you are alive, active, and in communication with Command.</p>
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Faction bound: <b>${_ftEscape(faction?.name ?? "(unbound)")}</b></p>
      <p style="font-size:0.7rem;opacity:0.55;margin:0.4rem 0 0">Reminder chat card fires automatically on <code>bbttcc:advanceTurn:end</code> so the GM doesn't forget the grant.</p>
    </div>`,
    buttons: {
      ...(faction ? {
        grant: {
          label: "Apply +2 SP OP now (manual)",
          callback: async () => {
            const opApi = game.bbttcc?.api?.op;
            if (!opApi?.commit) {
              return ui.notifications?.warn(`${actor.name}: OP engine not available — cannot grant Soft Power OP.`);
            }
            const marksPerOP = opApi.OP_TO_MARKS || 10;
            // allowOvercap: this is a bonus grant, not a normal earn — don't let
            // the cap refuse the canon +2.
            const res = await opApi.commit(faction.id, { softpower: +(2 * marksPerOP) }, { context: "harmony-marshal-unity-conductor", allowOvercap: true });
            if (!res?.committed) {
              return ui.notifications?.warn(`${actor.name}: could not grant Soft Power OP (${res?.error || "API error"}).`);
            }
            const bankNow = faction.getFlag?.("bbttcc-factions", "opBank") || {};
            const nowSP = Math.floor((Number(bankNow.softpower) || 0) / marksPerOP);
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll" style="border-color:#5a8a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#b8d896">⚖ Unity Conductor — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem"><b>${_ftEscape(faction.name)}</b>: +2 Soft Power OP applied (now ${nowSP}).</p></div>`
            });
          }
        }
      } : {}),
      close: { label: "Close" }
    },
    default: "close"
  }).render(true);
}

// ── Tactical surface — Rallying Words ───────────────────────────────────────
// Out-of-tier per canon (mentioned at L2). Bonus action; target an ally, bank
// reroll-lowest on their next roll this scene (matches `aid` action shape in
// module.js::FT.COMBAT_ACTIONS).
export async function openHarmonyMarshalRallyingWords(actor) {
  const targets = Array.from(game.user?.targets ?? []);
  const ally = targets[0]?.actor;
  if (!ally) {
    return ui.notifications?.warn(`${actor.name}: target an ally token first, then click Rallying Words.`);
  }
  const banked = ally.getFlag?.("fourththing", "aidBanked") ?? [];
  banked.push({ from: actor.name, kind: "reroll-lowest", set: Date.now(), source: "rallying-words" });
  await ally.setFlag("fourththing", "aidBanked", banked);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fourththing-roll" style="border-color:#5a8a3a"><div class="ft-roll-header"><span class="ft-roll-name" style="color:#b8d896">📣 Rallying Words — ${_ftEscape(actor.name)}</span></div><p style="margin:0.3rem 0;font-size:0.82rem"><b>${_ftEscape(ally.name)}</b>: reroll-lowest banked on next roll this scene.</p></div>`
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══ SPRINT F — NEW CLASS HANDLERS ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
//
// All new-class dialogs follow the same pattern as existing class dialogs:
// compute current resource state, render a Dialog with adjustable inputs
// and optional "spend for X" dropdown, update on Apply, post a ChatMessage.
//
// Balance numbers in each handler are [TBD:balance] — these are MVP stubs.
// Phase 3c balance pass will revisit.

// ─── Bulwark dialogs ──────────────────────────────────────────────────────────
// Bulwark uses existing resources.frameDice and resources.ruinCharges
// (already defined in template.json). Handlers are adaptations of the
// existing Titanbound + Breaker handlers, merged.

export async function openBulwarkFramePool(actor) {
  // 2026-05-28 — Frame Dice retired; abilities folded into Surge.
  ui.notifications?.info(`${actor?.name ?? "Bulwark"}: Frame Dice are retired — open the ◆ Surge menu (Absorb / Push / Anchor / Brace Wall).`);
  return;
  const res = getResources(actor);
  const frame    = res.frameDice?.current ?? 0;
  const frameMax = res.frameDice?.max ?? 3;
  const ruin     = res.ruinCharges?.current ?? 0;
  const ruinMax  = res.ruinCharges?.max ?? 3;

  new Dialog({
    title: "Bulwark — Frame Dice",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats" style="margin-bottom:0.6rem">
        <span class="ft-prev-stat"><span class="ft-prev-label">Frame Dice</span>
          <span class="ft-prev-val" style="color:#4a90d9">${frame} / ${frameMax}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Ruin Charges</span>
          <span class="ft-prev-val" style="color:#c03030">${ruin} / ${ruinMax}</span></span>
      </div>
      <p style="font-size:0.72rem;opacity:0.55;margin:0 0 0.5rem">
        Frame = persistence. Ruin = inevitability. Subclass determines which generates which.
      </p>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Frame dice</label>
          <input type="number" name="frame" value="${frame}" min="0" max="${frameMax}"/></div>
        <div class="ft-cast-field"><label>Max frame</label>
          <input type="number" name="frameMax" value="${frameMax}" min="1" max="10"/></div>
      </div>
    </div>`,
    buttons: {
      save: {
        label: "Apply",
        callback: async (html) => {
          const newFrame = parseInt(html.find("[name='frame']").val()) || 0;
          const newMax   = parseInt(html.find("[name='frameMax']").val()) || frameMax;
          await actor.update({
            "system.resources.frameDice.current": Math.min(newFrame, newMax),
            "system.resources.frameDice.max":     newMax,
          });
        }
      },
      close: { label: "Close" }
    },
    default: "save"
  }).render(true);
}

export async function openBulwarkSpendFrame(actor) {
  // 2026-05-28 — Frame Dice retired; Absorb / Push / Anchor are now Surge spends.
  ui.notifications?.info(`${actor?.name ?? "Bulwark"}: Frame Dice are retired — open the ◆ Surge menu (Absorb / Push / Anchor).`);
  return;
  const res = getResources(actor);
  const frame = res.frameDice?.current ?? 0;
  if (frame <= 0) return ui.notifications.warn(`${actor.name}: No Frame Dice available.`);

  new Dialog({
    title: "Bulwark — Spend Frame Die",
    content: `<div class="ft-cast-dialog">
      <p style="margin:0 0 0.5rem;font-size:0.8rem">Spending 1 of ${frame} Frame Dice.</p>
      <div class="ft-cast-field">
        <label>Purpose</label>
        <select name="purpose">
          <option value="absorb">Absorb — convert damage to Frame die roll</option>
          <option value="anchor">Anchor — refuse forced movement or condition</option>
          <option value="push">Push — add die to Strength check to move/break</option>
        </select>
      </div>
    </div>`,
    buttons: {
      spend: {
        label: "Spend",
        callback: async (html) => {
          const purpose = html.find("[name='purpose']").val();
          // Bulwark Stance · Anchor adds +1d4 to Frame Die spends.
          const _stance = actor.getFlag("fourththing", "bulwarkStance");
          const roll = new Roll(_stance === "anchor" ? "1d8 + 1d4" : "1d8");
          await roll.evaluate();
          const rolled = Number(roll.total) || 0;
          await actor.update({ "system.resources.frameDice.current": frame - 1 });

          // Arm a one-shot the relevant system chokepoint consumes:
          //   absorb → next incoming hit capped at `rolled`   (_applyDamageToActor)
          //   anchor → refuse next condition OR forced move    (applyManifestationStates
          //            + push chokepoints, via game.fourththing.consumeBulwarkAnchor)
          //   push   → +`rolled` to next Body check            (attributeTest)
          // Persists until consumed. Consume clears via
          //   update({ "flags.fourththing.bulwark.frameOneShot.-=<key>": null }).
          await actor.setFlag("fourththing", `bulwark.frameOneShot.${purpose}`, { roll: rolled, ts: Date.now() });

          const labels = { absorb: "Absorb armed", anchor: "Anchor armed", push: "Push armed" };
          const blurb = {
            absorb: `Your next incoming hit is <b>capped at ${rolled}</b> — you take the Frame die roll instead of the full hit. Consumed by the next hit that deals damage.`,
            anchor: `You <b>refuse the next condition or forced movement</b> that would affect you. Consumed on the next such effect.`,
            push:   `<b>+${rolled}</b> to your next <b>Body</b> check (move / break). Consumed on use.`
          };
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header">
                <span class="ft-roll-name">⛰ Bulwark: ${labels[purpose] ?? "Frame Die"}</span>
                <span class="ft-defense-pill">d8 = ${rolled}</span>
              </div>
              <p style="margin:0.25rem 0;font-size:0.78rem">${blurb[purpose] ?? ""}</p>
              <p style="margin:0;font-size:0.72rem;opacity:0.55">Frame remaining: ${frame - 1}</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "spend"
  }).render(true);
}

export async function openBulwarkRuin(actor) {
  // ALIAS / SUPERSET of existing openBreakerRuin.
  // Reuses the Breaker ruin dialog — mechanic is identical, just re-labeled.
  return openBreakerRuin(actor);
}

export async function openBulwarkStance(actor) {
  // 2026-05-28 — Bulwark Stance (Advance/Anchor) retired with the Frame/Ruin pools;
  // the Cataclyst identity is now its Surge doctrine kit (Erupt / Shatter / Cataclysm).
  ui.notifications?.info(`${actor?.name ?? "Bulwark"}: Stances retired with the Frame/Ruin pools — your Cataclyst spends live in the ◆ Surge menu.`);
  return;
  const currentStance = actor.getFlag("fourththing", "bulwarkStance") ?? "none";
  new Dialog({
    title: "Bulwark — Stance (Cataclyst)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.8rem;margin:0 0 0.4rem">Current stance: <b>${currentStance}</b></p>
      <div class="ft-cast-field">
        <label>Set stance</label>
        <select name="stance">
          <option value="advance">Advance — Ruin spends -1 cost, +10 movement</option>
          <option value="anchor">Anchor — Frame spends +1d4, cannot be moved</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>`,
    buttons: {
      set: {
        label: "Set",
        callback: async (html) => {
          const stance = html.find("[name='stance']").val();
          await actor.setFlag("fourththing", "bulwarkStance", stance);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">⛰ Bulwark Stance: ${stance}</span></div>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "set"
  }).render(true);
}

// ─── Shadow Courier dialogs ──────────────────────────────────────────────────

// openShadowCourierAccessPool / openShadowCourierSpendAccess removed 2026-05-05
// — Shadow Courier now runs on Pace, not Access Dice. Access Dice remains
// active only for the legacy Shadowjack class. Pace edits inline via the
// resource panel input; no dedicated spend/pool dialog needed.

export async function openShadowCourierPackage(actor) {
  // 2026-05-28 — legacy flag-based Package dialog retired; the Package lives on the
  // sheet header chip now (◯ Package / ✦ Deliver). Redirect so old feats don't open the
  // disconnected dialog.
  ui.notifications?.info(`${actor?.name ?? "Courier"}: use the ◯ Package chip on your sheet header to designate / deliver.`);
  return;
  const pkg = actor.getFlag("fourththing", "scPackage") ?? { type: "none", note: "" };

  new Dialog({
    title: "Shadow Courier — Package",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.72rem;opacity:0.55;margin:0 0 0.4rem">
        What you're carrying this scene. Subclass determines your default.
      </p>
      <div class="ft-cast-field">
        <label>Package type</label>
        <select name="pkgType">
          <option value="none" ${pkg.type==="none"?"selected":""}>None</option>
          <option value="message" ${pkg.type==="message"?"selected":""}>Message (Wayfarer default)</option>
          <option value="blade" ${pkg.type==="blade"?"selected":""}>Blade (Black Stair)</option>
          <option value="key" ${pkg.type==="key"?"selected":""}>Key (Black Stair)</option>
          <option value="soul" ${pkg.type==="soul"?"selected":""}>Soul (Last Mile default)</option>
        </select>
      </div>
      <div class="ft-cast-field">
        <label>Package notes</label>
        <input type="text" name="pkgNote" value="${pkg.note ?? ""}" placeholder="From / To / Contents"/>
      </div>
    </div>`,
    buttons: {
      set: {
        label: "Apply",
        callback: async (html) => {
          const type = html.find("[name='pkgType']").val();
          const note = html.find("[name='pkgNote']").val();
          await actor.setFlag("fourththing", "scPackage", { type, note });
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">⬛ Shadow Courier: ${type}</span></div>
              ${note ? `<p style="margin:0.2rem 0;font-size:0.75rem;opacity:0.7">${note}</p>` : ""}
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "set"
  }).render(true);
}

export async function openShadowCourierCrossing(actor) {
  // 2026-05-28 — Pace retired (folded into Surge). The Crossing's combat repositioning
  // lives in the courier Surge kit (Courier's Step / Ghoststep / Threshold Cross via
  // No Such Door); a pure threshold-bypass is now a free GM-adjudicated beat.
  ui.notifications?.info(`${actor?.name ?? "Courier"}: Pace is folded into Surge — your moves are in the ◆ Surge menu. A bare threshold-crossing is a free narrative beat (no pool).`);
  return;
  const rawSys = actor.system?.system ?? actor.system;
  const pace   = rawSys?.resources?.pace ?? { current: 0, max: 0 };
  const cur    = Number(pace.current) || 0;
  const max    = Number(pace.max) || 0;

  new Dialog({
    title: "Shadow Courier — The Crossing",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.8rem;margin:0 0 0.4rem">
        Declare a threshold: door, wall, ward, alarmed perimeter, hex boundary.
      </p>
      <p style="font-size:0.72rem;opacity:0.55">
        Pace available: <b style="color:#a0b8e8">${cur} / ${max}</b>
      </p>
      <div class="ft-cast-field">
        <label>Threshold description</label>
        <input type="text" name="threshold" placeholder="e.g., warded gate of the manor"/>
      </div>
    </div>`,
    buttons: {
      cross: {
        label: "Cross",
        callback: async (html) => {
          const threshold = html.find("[name='threshold']").val() || "threshold";
          if (cur > 0) {
            await actor.update({ "system.resources.pace.current": Math.max(0, cur - 1) });
          }
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">⬛ Shadow Courier: The Crossing</span></div>
              <p style="margin:0.2rem 0;font-size:0.8rem">Crossed: ${threshold}</p>
              <p style="margin:0;font-size:0.72rem;opacity:0.5">Pace remaining: ${Math.max(0, cur - 1)} / ${max}</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "cross"
  }).render(true);
}

// 2026-05-20 — Pace spend dialog. Replaces the legacy Access-Dice
// openShadowCourierAccessPool / openShadowCourierSpendAccess (removed
// 2026-05-05 with a "no dialog needed" comment that was wrong — the
// pool needs a spend surface for the mechanical effects to fire).
//
// Three universal modes (move / reroll / dodge) plus a route-specific
// fourth read from the actor's bbttcc-shadow-courier-* subclass identifier.
// Pattern mirrors openPactkeeperSpendCivicCharge but without the die roll
// (Pace is a flat counter, not a die pool).
export async function openShadowCourierSpendPace(actor) {
  // 2026-05-28 — Pace folded into Surge. Its spends (move / reroll / dodge / route)
  // are now the courier Surge kit (Courier's Step / Ghoststep / Flank & Strike /
  // No Such Door + the 3 route kits). Redirect old "Spend Pace / Pace Pool" feats.
  ui.notifications?.info(`${actor?.name ?? "Courier"}: Pace is retired — your courier moves are Surge spends now. Open the ◆ Surge menu.`);
  return;
  const rawSys = actor.system?.system ?? actor.system;
  const pace   = rawSys?.resources?.pace ?? { current: 0, max: 0 };
  const cur    = Number(pace.current) || 0;
  const max    = Number(pace.max) || 0;
  if (cur < 1) {
    return ui.notifications?.warn(`${actor.name}: no Pace to spend (${cur}/${max}).`);
  }

  // Detect picked route from the actor's subclass item identifier.
  const subclassItem = actor.items?.find?.(i =>
    i.type === "subclass" && /^bbttcc-shadow-courier/.test(i.system?.identifier ?? "")
  );
  const subId = String(subclassItem?.system?.identifier ?? "");
  let routeLabel = "";
  let routeBody  = "";
  if (/wayfarer-tongue/.test(subId)) {
    routeLabel = "Wayfarer Tongue";
    routeBody  = "+1 Intrigue OP added to a faction you're carrying for this scene.";
  } else if (/black-stair/.test(subId)) {
    routeLabel = "Black Stair";
    routeBody  = "Take a shortcut — skip one hex of intervening terrain on a delivery this scene.";
  } else if (/last-mile/.test(subId)) {
    routeLabel = "Last Mile";
    routeBody  = "−1 Darkness in the recipient's hex on a delivery this scene.";
  }

  const content = `<div class="ft-cast-dialog">
    <div class="ft-preview-stats" style="margin-bottom:0.6rem">
      <span class="ft-prev-stat"><span class="ft-prev-label">Pace before / after</span>
        <span class="ft-prev-val" style="color:#a0b8e8;font-weight:700">${cur} → ${cur - 1} / ${max}</span></span>
      ${routeLabel ? `<span class="ft-prev-stat"><span class="ft-prev-label">Route</span>
        <span class="ft-prev-val">${_ftEscape(routeLabel)}</span></span>` : ""}
    </div>
    <div class="ft-cast-field">
      <label>Spend mode</label>
      <select name="mode">
        <option value="move">+5 ft movement this turn</option>
        <option value="reroll">Reroll a skill check (Stealth / Acrobatics / Streetwise / Intrigue)</option>
        <option value="dodge">Ignore one reaction strike against you this turn</option>
        ${routeLabel ? `<option value="route">${_ftEscape(routeLabel)} route — ${_ftEscape(routeBody)}</option>` : ""}
      </select>
    </div>
    <div class="ft-cast-field">
      <label>Context (narrative)</label>
      <input type="text" name="ctx" placeholder="e.g., 'sprint over the gap' or 'reroll the lockpick'"/>
    </div>
  </div>`;

  new Dialog({
    title: `Shadow Courier — Spend Pace (${cur}/${max})`,
    content,
    buttons: {
      apply: {
        label: "Spend",
        callback: async (html) => {
          const mode = html.find("[name='mode']").val();
          const ctx  = html.find("[name='ctx']").val()?.trim() || "";
          await actor.update({ "system.resources.pace.current": Math.max(0, cur - 1) });

          // ── Mechanical apply (2026-05-23 Tier-2 spend-menu wiring) ───────────
          // move → real movement budget bump (Dash precedent); reroll → arm a
          // one-shot reroll-lowest read by collectRerolls; Wayfarer route →
          // commit +1 Intrigue OP to the Courier's faction. dodge + Black Stair /
          // Last Mile routes stay narrative-by-design (no reaction-strike engine /
          // strategic-hex action surface).
          let mechNote = "";
          if (mode === "move") {
            const mcur = Number(rawSys?.actions?.movementBudgetFt) || 0;
            await actor.update({ "system.actions.movementBudgetFt": mcur + 5 });
            mechNote = `Movement budget +5 ft (now ${mcur + 5} ft this turn).`;
          } else if (mode === "reroll") {
            const cf = actor.flags?.fourththing?.combat ?? {};
            await actor.setFlag("fourththing", "combat", { ...cf, paceReroll: true });
            mechNote = "Armed — your next skill check rerolls its lowest die.";
          } else if (mode === "route" && /wayfarer-tongue/.test(subId)) {
            const faction = _hmGetFaction(actor);
            const opApi   = game.bbttcc?.api?.op;
            const marksPerOP = opApi?.OP_TO_MARKS || 10;
            if (faction && opApi?.commit) {
              const res = await opApi.commit(faction.id, { intrigue: marksPerOP }, { context: "shadow-courier-wayfarer-tongue" });
              mechNote = res?.committed
                ? `+1 Intrigue OP committed to <b>${_ftEscape(faction.name)}</b>.`
                : `+1 Intrigue OP — commit failed (${res?.error || "cap / API"}); GM applies manually.`;
            } else {
              mechNote = "+1 Intrigue OP — no bound faction; GM applies to the carried faction.";
            }
          }

          const labels = {
            move:   { icon: "🏃", title: "+5 ft Movement",  body: "Add <b>+5 ft</b> to your movement this turn." },
            reroll: { icon: "🎲", title: "Skill Reroll",     body: "Reroll a Stealth / Acrobatics / Streetwise / Intrigue check — take the new result." },
            dodge:  { icon: "🛡", title: "Slip the Strike",  body: "Treat one triggered reaction strike against you this turn as if it didn't happen." },
            route:  { icon: "✦", title: `${routeLabel} Route`, body: routeBody }
          };
          const lbl = labels[mode] ?? labels.move;
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#7a8fc8">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0b8e8">${lbl.icon} Pace Spent — ${lbl.title}</span></div>
              <p style="margin:0.3rem 0;font-size:0.82rem">${lbl.body}</p>
              ${mechNote ? `<p style="margin:0.2rem 0;font-size:0.8rem;color:#a0d8b0">${mechNote}</p>` : ""}
              ${ctx ? `<p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85"><b>Context:</b> ${_ftEscape(ctx)}</p>` : ""}
              <p style="margin:0;font-size:0.72rem;opacity:0.55">Pace now ${Math.max(0, cur - 1)} / ${max}.</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
}

export async function openShadowCourierPassive(actor, item) {
  const pkg = actor.getFlag("fourththing", "scPackage") ?? { type: "none", note: "" };
  const name = item?.name ?? "Shadow Courier";
  const desc = item?.system?.description?.value ?? "";

  new Dialog({
    title: name,
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats">
        <span class="ft-prev-stat"><span class="ft-prev-label">Current Package</span>
          <span class="ft-prev-val" style="color:#9b59b6">${pkg.type}</span></span>
      </div>
      ${pkg.note ? `<p style="font-size:0.75rem;opacity:0.65;margin:0.4rem 0">${pkg.note}</p>` : ""}
      ${desc ? `<div class="ft-item-desc" style="margin-top:0.5rem;max-height:300px;overflow-y:auto">${desc}</div>` : ""}
    </div>`,
    buttons: { close: { label: "Close" } },
    default: "close"
  }).render(true);
}

// ─── Cosmic Linguist dialogs ─────────────────────────────────────────────────

export async function openCosmicLinguistAuthority(actor) {
  // 2026-05-28 — Editorial Authority retired (folded into Surge). The 3 Edits cost Surge now.
  ui.notifications?.info(`${actor?.name ?? "Linguist"}: Authority is folded into Surge — your edits live in the ◆ Surge menu (Footnote / Marginalia / Declared Likeness / Redact …).`);
  return;
  const auth = await _ftReadPoolWithLegacyMigration(actor, { resourceName: "clAuthority", legacyFlag: "clAuthority", defaultMax: 5 });

  new Dialog({
    title: "Cosmic Linguist — Editorial Authority",
    content: `<div class="ft-cast-dialog">
      <div class="ft-preview-stats">
        <span class="ft-prev-stat"><span class="ft-prev-label">Authority</span>
          <span class="ft-prev-val" style="color:#e8c84a">${auth.current} / ${auth.max}</span></span>
      </div>
      <p style="font-size:0.72rem;opacity:0.55;margin:0.4rem 0">
        Gained by listening, correcting error, being cited. Spent on Annotations.
        Max scales with Steward tier (5/6/7/8) — sheet chip auto-recomputes.
      </p>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Current</label>
          <input type="number" name="current" value="${auth.current}" min="0" max="${auth.max}"/></div>
      </div>
    </div>`,
    buttons: {
      save: {
        label: "Apply",
        callback: async (html) => {
          const current = parseInt(html.find("[name='current']").val()) || 0;
          await actor.update({ "system.resources.clAuthority.current": Math.min(current, auth.max) });
        }
      },
      close: { label: "Close" }
    },
    default: "save"
  }).render(true);
}

// Cosmic Linguist — Compose Edit. Subclass-gated router (Phase D 2026-05-08).
// Each CL subclass owns ONE Edit type via its L1 feature:
//   • Annotator (The Margin) → Annotation — grant reroll-lowest to a target's next check
//   • Metaphor Apostle (Declared Likeness) → Metaphor — swap target's defense for one round
//   • Redactor (The First Strike) → Redaction — strip a condition AE from a target
// Multi-subclass / no subclass → fall back to the legacy buffet picker.
export async function openCosmicLinguistAnnotation(actor) {
  // 2026-05-28 — the Edits (Annotation/Metaphor/Redaction) are Surge spends now (full
  // fold). Redirect the old Authority-cost dialog so L1 feats don't open it.
  ui.notifications?.info(`${actor?.name ?? "Linguist"}: your edits are Surge spends now — open the ◆ Surge menu (Annotator: Footnote/Marginalia/Revision · Metaphor: Declared Likeness/Frailty/Apotheosis · Redactor: Redact/Silence/Erasure).`);
  return;
  const subclassIds = (actor.items ?? [])
    .filter(it => it.type === "subclass")
    .map(it => String(it.system?.identifier ?? "").toLowerCase());
  const isAnnotator = subclassIds.some(id => id.includes("annotator"));
  const isMetaphor  = subclassIds.some(id => id.includes("metaphor-apostle") || id.includes("metaphor_apostle"));
  const isRedactor  = subclassIds.some(id => id.includes("redactor"));
  const subclassCount = (isAnnotator ? 1 : 0) + (isMetaphor ? 1 : 0) + (isRedactor ? 1 : 0);

  // Single CL subclass → route directly to that Edit.
  if (subclassCount === 1) {
    if (isAnnotator) return _openCLAnnotation(actor);
    if (isMetaphor)  return _openCLMetaphor(actor);
    if (isRedactor)  return _openCLRedaction(actor);
  }
  // Zero or multi → buffet (legacy behavior, narrative-only chat card).
  return _openCLEditBuffet(actor);
}

async function _openCLAnnotation(actor) {
  const auth = await _ftReadPoolWithLegacyMigration(actor, { resourceName: "clAuthority", legacyFlag: "clAuthority", defaultMax: 5 });
  const targetTokens = Array.from(game.user?.targets ?? []);
  const target = targetTokens[0]?.actor ?? null;
  const targetName = target?.name ?? "(no target — select a token first)";
  const cost = 2;

  new Dialog({
    title: "Annotator — Annotation",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.72rem;opacity:0.6;margin:0 0 0.3rem">
        Footnote a target's situation — they may <b>reroll the lowest die</b> on their next attribute / save / attack check (auto-applies via the reroll engine).
      </p>
      <div class="ft-preview-stats" style="margin:0.3rem 0">
        <span class="ft-prev-stat"><span class="ft-prev-label">Authority</span><span class="ft-prev-val" style="color:#e8c84a">${auth.current}/${auth.max}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Cost</span><span class="ft-prev-val">${cost}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Target</span><span class="ft-prev-val" style="color:${target ? "#a0d4ff" : "#ff8a8a"}">${_ftEscape(targetName)}</span></span>
      </div>
      <div class="ft-cast-field">
        <label>Footnote text (narrative)</label>
        <input type="text" name="note" placeholder="e.g., 'Wait — the wind is wrong.'"/>
      </div>
    </div>`,
    buttons: {
      apply: {
        label: "Annotate",
        callback: async (html) => {
          if (!target) return ui.notifications?.warn("Annotation requires a target — select a token first.");
          if (auth.current < cost) return ui.notifications?.warn(`${actor.name}: Not enough Editorial Authority (need ${cost}).`);
          const note = html.find("[name='note']").val()?.trim() || "";
          await actor.update({ "system.resources.clAuthority.current": auth.current - cost });

          // Increment target's pending-reroll counter. The reroll engine
          // (collectRerolls) reads this flag in addition to item-based grants.
          const cur = Number(target.flags?.fourththing?.annotationPending) || 0;
          await target.update({ "flags.fourththing.annotationPending": cur + 1 });

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#5a3a8a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#c8c8ff">📎 Annotation — ${_ftEscape(actor.name)} → ${_ftEscape(target.name)}</span></div>
              ${note ? `<p style="margin:0.3rem 0;font-size:0.82rem"><em>"${_ftEscape(note)}"</em></p>` : ""}
              <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85"><b>${_ftEscape(target.name)}</b> may reroll the lowest die on their next attribute / save / attack check (auto-applies via reroll engine; pending count: ${cur + 1}).</p>
              <p style="margin:0;font-size:0.72rem;opacity:0.55">Authority spent: ${cost} (${auth.current - cost}/${auth.max} remaining)</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
}

async function _openCLMetaphor(actor) {
  const auth = await _ftReadPoolWithLegacyMigration(actor, { resourceName: "clAuthority", legacyFlag: "clAuthority", defaultMax: 5 });
  const targetTokens = Array.from(game.user?.targets ?? []);
  const target = targetTokens[0]?.actor ?? null;
  const targetName = target?.name ?? "(no target — select a token first)";
  const cost = 3;

  new Dialog({
    title: "Metaphor Apostle — Metaphor",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.72rem;opacity:0.6;margin:0 0 0.3rem">
        Declare "X is Y" — swap a target's defense for one round. The chosen "from" defense is overridden by the chosen "to" defense's value.
      </p>
      <div class="ft-preview-stats" style="margin:0.3rem 0">
        <span class="ft-prev-stat"><span class="ft-prev-label">Authority</span><span class="ft-prev-val" style="color:#e8c84a">${auth.current}/${auth.max}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Cost</span><span class="ft-prev-val">${cost}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Target</span><span class="ft-prev-val" style="color:${target ? "#a0d4ff" : "#ff8a8a"}">${_ftEscape(targetName)}</span></span>
      </div>
      <div class="ft-cast-grid">
        <div class="ft-cast-field"><label>Replace defense</label>
          <select name="from">
            <option value="guard">Guard</option>
            <option value="evasion">Evasion</option>
            <option value="resolve">Resolve</option>
          </select></div>
        <div class="ft-cast-field"><label>...with this defense's value</label>
          <select name="to">
            <option value="guard">Guard</option>
            <option value="evasion">Evasion</option>
            <option value="resolve" selected>Resolve</option>
          </select></div>
      </div>
      <div class="ft-cast-field">
        <label>Metaphor declared (narrative)</label>
        <input type="text" name="note" placeholder="e.g., 'The wall is a curtain.'"/>
      </div>
    </div>`,
    buttons: {
      apply: {
        label: "Declare",
        callback: async (html) => {
          if (!target) return ui.notifications?.warn("Metaphor requires a target — select a token first.");
          if (auth.current < cost) return ui.notifications?.warn(`${actor.name}: Not enough Editorial Authority (need ${cost}).`);
          const from = html.find("[name='from']").val();
          const to   = html.find("[name='to']").val();
          const note = html.find("[name='note']").val()?.trim() || "";
          if (from === to) return ui.notifications?.warn("Metaphor must replace one defense with a DIFFERENT one.");

          const tSys = target.system?.system ?? target.system ?? {};
          const toValue = Number(tSys?.derived?.defenses?.[to]?.value ?? tSys?.defenses?.[to]?.value) || 0;
          if (toValue <= 0) return ui.notifications?.warn(`Could not read target's ${to} defense value.`);

          await actor.update({ "system.resources.clAuthority.current": auth.current - cost });

          // Push an AE to the target that overrides the "from" defense with the
          // "to" value. Mode 5 (OVERRIDE) replaces the value entirely.
          // Duration: 1 round (Foundry's combat tracker auto-expires).
          const aeData = {
            name: `Metaphor: ${_ftCap(from)} is ${_ftCap(to)}`,
            img:  "icons/svg/upgrade.svg",
            origin: actor.uuid,
            duration: { rounds: 1 },
            disabled: false,
            transfer: false,
            changes: [
              { key: `system.derived.defenses.${from}.value`, value: String(toValue), mode: 5, priority: 100 }
            ],
            flags: { fourththing: { metaphorFromUuid: actor.uuid, metaphorSwap: { from, to, value: toValue } } }
          };
          try { await target.createEmbeddedDocuments("ActiveEffect", [aeData]); }
          catch (e) { console.warn("CL Metaphor AE apply failed", e); }

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#5a3a8a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#c8c8ff">🔁 Metaphor — ${_ftEscape(actor.name)} → ${_ftEscape(target.name)}</span></div>
              ${note ? `<p style="margin:0.3rem 0;font-size:0.82rem"><em>"${_ftEscape(note)}"</em></p>` : ""}
              <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85"><b>${_ftEscape(target.name)}</b>'s ${_ftCap(from)} becomes ${toValue} (matching ${_ftCap(to)}) for one round.</p>
              <p style="margin:0;font-size:0.72rem;opacity:0.55">Authority spent: ${cost} (${auth.current - cost}/${auth.max} remaining)</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
}

async function _openCLRedaction(actor) {
  const auth = await _ftReadPoolWithLegacyMigration(actor, { resourceName: "clAuthority", legacyFlag: "clAuthority", defaultMax: 5 });
  const targetTokens = Array.from(game.user?.targets ?? []);
  const target = targetTokens[0]?.actor ?? null;
  if (!target) {
    return ui.notifications?.warn("Redaction requires a target — select a token first.");
  }
  const cost = 4;

  // List target's active condition / effect AEs that aren't the actor's own
  // permanent grants (filter by `disabled === false` and prefer those with
  // a clear duration or condition flag).
  const eligibleEffects = (target.effects ?? []).filter(e => !e.disabled);
  if (!eligibleEffects.length) {
    return ui.notifications?.warn(`${target.name}: no active conditions / effects to redact.`);
  }
  const opts = eligibleEffects.map((e, i) => `<label style="display:block;margin:0.25rem 0;padding:0.25rem;border:1px solid #5a3a8a44;border-radius:3px;cursor:pointer">
    <input type="radio" name="effIdx" value="${i}" ${i===0?"checked":""}/>
    <strong>${_ftEscape(e.name)}</strong>
    ${e.duration?.rounds ? `<span style="opacity:0.6">(${e.duration.rounds}r left)</span>` : ""}
  </label>`).join("");

  new Dialog({
    title: "Redactor — Redaction",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.72rem;opacity:0.6;margin:0 0 0.3rem">
        Strip an active condition or effect from a target. The chosen effect is removed permanently.
      </p>
      <div class="ft-preview-stats" style="margin:0.3rem 0">
        <span class="ft-prev-stat"><span class="ft-prev-label">Authority</span><span class="ft-prev-val" style="color:#e8c84a">${auth.current}/${auth.max}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Cost</span><span class="ft-prev-val">${cost}</span></span>
        <span class="ft-prev-stat"><span class="ft-prev-label">Target</span><span class="ft-prev-val" style="color:#a0d4ff">${_ftEscape(target.name)}</span></span>
      </div>
      <div class="ft-cast-field">
        <label>Pick effect to redact</label>
        <div style="margin-top:0.3rem">${opts}</div>
      </div>
      <div class="ft-cast-field">
        <label>Redaction declared (narrative)</label>
        <input type="text" name="note" placeholder="e.g., 'That fire was never lit.'"/>
      </div>
    </div>`,
    buttons: {
      apply: {
        label: "Redact",
        callback: async (html) => {
          if (auth.current < cost) return ui.notifications?.warn(`${actor.name}: Not enough Editorial Authority (need ${cost}).`);
          const idx = parseInt(html.find("[name='effIdx']:checked").val()) || 0;
          const eff = eligibleEffects[idx];
          if (!eff) return ui.notifications?.warn("No effect selected.");
          const note = html.find("[name='note']").val()?.trim() || "";
          const removedName = eff.name;

          await actor.update({ "system.resources.clAuthority.current": auth.current - cost });
          try { await target.deleteEmbeddedDocuments("ActiveEffect", [eff.id]); }
          catch (e) { console.warn("CL Redaction delete failed", e); }

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#5a3a8a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#c8c8ff">▬ Redaction — ${_ftEscape(actor.name)} → ${_ftEscape(target.name)}</span></div>
              ${note ? `<p style="margin:0.3rem 0;font-size:0.82rem"><em>"${_ftEscape(note)}"</em></p>` : ""}
              <p style="margin:0.2rem 0;font-size:0.78rem;opacity:0.85"><strong>${_ftEscape(removedName)}</strong> stripped from ${_ftEscape(target.name)}.</p>
              <p style="margin:0;font-size:0.72rem;opacity:0.55">Authority spent: ${cost} (${auth.current - cost}/${auth.max} remaining)</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
}

// Buffet fallback — used when the actor has no CL subclass yet, or holds
// multiple via cross-classing. Narrative-only chat card; no engine effect.
async function _openCLEditBuffet(actor) {
  const auth = await _ftReadPoolWithLegacyMigration(actor, { resourceName: "clAuthority", legacyFlag: "clAuthority", defaultMax: 5 });
  new Dialog({
    title: "Cosmic Linguist — Compose Edit (no subclass)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.72rem;opacity:0.6;margin:0 0 0.4rem">
        No CL subclass detected (or cross-classed). Pick an Edit type narratively — engine hooks fire only when a single CL subclass is present.
      </p>
      <p style="font-size:0.72rem;opacity:0.55">Authority: <b>${auth.current}</b> / ${auth.max}</p>
      <div class="ft-cast-field">
        <label>Edit type</label>
        <select name="editType">
          <option value="annotation">📎 Annotation — footnote (narrative)</option>
          <option value="metaphor">🔁 Metaphor — declare X is Y (narrative)</option>
          <option value="redaction">▬ Redaction — strip a tag (narrative)</option>
        </select>
      </div>
      <div class="ft-cast-field">
        <label>Edit text</label>
        <input type="text" name="text" placeholder="e.g., 'the king is just'"/>
      </div>
      <div class="ft-cast-field">
        <label>Cost (Authority)</label>
        <input type="number" name="cost" value="2" min="1" max="10"/>
      </div>
    </div>`,
    buttons: {
      apply: {
        label: "Apply Edit",
        callback: async (html) => {
          const editType = html.find("[name='editType']").val();
          const text     = html.find("[name='text']").val() || "(unspecified)";
          const cost     = parseInt(html.find("[name='cost']").val()) || 2;
          if (auth.current < cost) return ui.notifications?.warn(`${actor.name}: Not enough Editorial Authority (need ${cost}).`);
          await actor.update({ "system.resources.clAuthority.current": auth.current - cost });
          const typeLabels = { annotation: "📎 Annotation", metaphor: "🔁 Metaphor", redaction: "▬ Redaction" };
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">${typeLabels[editType]}: ${_ftEscape(text)}</span></div>
              <p style="margin:0;font-size:0.72rem;opacity:0.5">Authority spent: ${cost} (${auth.current - cost}/${auth.max} remaining)</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
}

function _ftCap(s) { return String(s ?? "").charAt(0).toUpperCase() + String(s ?? "").slice(1); }

// ─── Pactkeeper dialogs ──────────────────────────────────────────────────────

// Tiny HTML escape — local to avoid a cross-module import of module.js's
// ftEscapeHtml. Safe for single-line user-supplied strings (titles, contexts).
function _ftEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Counter / dispel a target's active manifestation (Phase D 2026-05-08, v1).
// Roll: 2d10x10 + max(intent, mind) attribute vs DC = (entry.tier × 2 + 10)
// + entry.stabilizeBonus. Tier baseline matches cast DC: T1 12 / T2 14 / T3 16
// / T4 18, plus any CL Resonance "Stabilize" channel allocation from cast time.
// On success the entry is removed from the target's activeManifestations.
// Action cost: action. Generic — not class-gated for v1; any actor with a
// feat carrying identifier "counter_manifestation" routes here.
export async function openCounterManifestation(actor) {
  const targetTokens = Array.from(game.user?.targets ?? []);
  const target = targetTokens[0]?.actor ?? null;
  if (!target) return ui.notifications?.warn("Counter requires a target — select an enemy token first.");
  const entries = target.getFlag?.("fourththing", "activeManifestations") ?? [];
  const eligible = entries.filter(e => ["sustained", "bound", "enduring"].includes(e.stability));
  if (!eligible.length) return ui.notifications?.warn(`${target.name}: no active manifestations to counter.`);

  const opts = eligible.map((e, i) => {
    const dc = (Number(e.tier) || 1) * 2 + 10 + (Number(e.stabilizeBonus) || 0);
    const stabNote = e.stabilizeBonus > 0 ? ` <span style="color:#c8c8ff">(+${e.stabilizeBonus} stabilize)</span>` : "";
    return `<label style="display:block;margin:0.25rem 0;padding:0.3rem;border:1px solid #5a3a8a44;border-radius:3px;cursor:pointer">
      <input type="radio" name="entryIdx" value="${i}" ${i===0?"checked":""}/>
      <strong>${_ftEscape(e.itemName)}</strong> (T${e.tier}, ${_ftEscape(e.stability)}) — DC ${dc}${stabNote}
    </label>`;
  }).join("");

  const rawSys = actor.system?.system ?? actor.system ?? {};
  const intentVal = Number(rawSys?.attributes?.intent?.value ?? rawSys?.attributes?.mind?.value) || 0;
  const mindVal   = Number(rawSys?.attributes?.mind?.value)   || 0;
  const bestAttr  = mindVal >= intentVal ? "mind" : "intrigue";
  const bestVal   = Math.max(intentVal, mindVal);

  new Dialog({
    title: "Counter / Dispel — pick target manifestation",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;opacity:0.8;margin:0 0 0.3rem">
        Roll <b>2d10x10 + ${bestVal}</b> (${_ftCap(bestAttr)}) vs the chosen entry's DC. Success drops the entry from <b>${_ftEscape(target.name)}</b>'s active manifestations.
      </p>
      <div class="ft-cast-field">${opts}</div>
    </div>`,
    buttons: {
      roll: {
        label: "Roll Counter",
        callback: async (html) => {
          const idx = parseInt(html.find("[name='entryIdx']:checked").val()) || 0;
          const entry = eligible[idx];
          if (!entry) return ui.notifications?.warn("No entry selected.");
          const dc = (Number(entry.tier) || 1) * 2 + 10 + (Number(entry.stabilizeBonus) || 0);
          const formula = `2d10x10 + ${bestVal}`;
          const roll = new Roll(formula);
          await roll.evaluate();
          const success = roll.total >= dc;

          // Surge banking on explosions (caster is the active roller).
          const dieResults = roll.dice?.[0]?.results ?? [];
          const explosions = Math.max(0, dieResults.length - 2);
          if (explosions > 0) {
            try {
              const cur = Number(rawSys?.resources?.surge?.value) || 0;
              await actor.update({ "system.resources.surge.value": cur + explosions });
            } catch (_) {}
          }

          // On success — remove the entry from target's flag.
          if (success) {
            const survivors = entries.filter(e => e.instanceId !== entry.instanceId);
            try { await target.setFlag("fourththing", "activeManifestations", survivors); }
            catch (e) { console.warn("Counter: target update failed", e); }
          }

          const surgeNote = explosions > 0 ? ` <span style="color:#e8c84a;font-weight:600">+${explosions} Surge banked</span>` : "";
          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `<div class="fourththing-roll" style="border-color:${success ? "#5fb35f" : "#c45f5f"}">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:${success ? "#5fb35f" : "#c45f5f"}">${success ? "✦ Counter SUCCESS" : "✗ Counter FAILED"} — ${_ftEscape(actor.name)} → ${_ftEscape(target.name)}</span></div>
              <p style="margin:0.3rem 0;font-size:0.82rem">Targeting <b>${_ftEscape(entry.itemName)}</b> (T${entry.tier}, DC ${dc}).${surgeNote}</p>
              <p style="margin:0;font-size:0.78rem;opacity:0.85">${success ? `Manifestation dropped from ${_ftEscape(target.name)}'s active list.` : `Manifestation holds. ${_ftEscape(target.name)}'s working still binding.`}</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "roll"
  }).render(true);
}

// Pactkeeper — Bind / unbind / show pact subject. The pact subject is the
// creature, object, or place "bargained-with" per The Bargain canon. New
// sustained manifestations cast targeting the bound subject get free upkeep
// (up to concurrencyBonus from passive + Sealed Pact stance).
export async function openPactkeeperBindSubject(actor) {
  const cur = actor.flags?.fourththing?.pactSubject ?? null;
  const targeted = Array.from(game.user?.targets ?? [])[0]?.actor ?? null;

  const lines = [];
  if (cur?.uuid) {
    lines.push(`<p style="margin:0.3rem 0;font-size:0.82rem"><b>Currently bound:</b> ${_ftEscape(cur.name ?? "(unnamed)")}</p>`);
  } else {
    lines.push(`<p style="margin:0.3rem 0;font-size:0.82rem;opacity:0.7">No pact subject bound.</p>`);
  }
  if (targeted) {
    lines.push(`<p style="margin:0.3rem 0;font-size:0.82rem;color:#a0d4ff"><b>Targeted:</b> ${_ftEscape(targeted.name)} — ready to bind.</p>`);
  } else {
    lines.push(`<p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.6">Tip: select a token first, then re-open this to bind it.</p>`);
  }

  const buttons = {};
  if (targeted) {
    buttons.bind = {
      label: cur?.uuid ? "Replace bound subject" : "Bind targeted",
      callback: async () => {
        await actor.setFlag("fourththing", "pactSubject", { uuid: targeted.uuid, name: targeted.name, ts: Date.now() });
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="fourththing-roll" style="border-color:#3a8a5a">
            <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0d8b8">🔗 Pact bound — ${_ftEscape(actor.name)} ↔ ${_ftEscape(targeted.name)}</span></div>
            <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.85">Sustained manifestations cast on this subject will draw free upkeep (capped by concurrencyBonus).</p>
          </div>`
        });
      }
    };
  }
  if (cur?.uuid) {
    buttons.unbind = {
      label: "Unbind",
      callback: async () => {
        await actor.unsetFlag("fourththing", "pactSubject");
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="fourththing-roll" style="border-color:#5a5a5a">
            <div class="ft-roll-header"><span class="ft-roll-name" style="color:#888">🔓 Pact released — ${_ftEscape(actor.name)}</span></div>
            <p style="margin:0.3rem 0;font-size:0.78rem;opacity:0.85">Subject ${_ftEscape(cur.name ?? "(unknown)")} no longer bound. Existing pact-bound manifestations keep their flag until upkeep drops them.</p>
          </div>`
        });
      }
    };
  }
  buttons.close = { label: "Close" };

  new Dialog({
    title: "Pactkeeper — Pact Subject",
    content: `<div class="ft-cast-dialog">${lines.join("")}</div>`,
    buttons,
    default: targeted ? "bind" : "close"
  }).render(true);
}

// Pactkeeper — Renegotiate (Initiation 6). When a manifestation would misfire,
// accept a GM-set narrative debt and treat the cast as having succeeded at
// base tier. Stub: surfaces the offer, records intent on a ledger flag.
// Real misfire interception (so the chat-card auto-prompts on misfire) wires
// up in a follow-on pass — see task #14.
// Pactkeeper — Renegotiate ledger surface (Initiation 6).
// AUTO-FLOW: when a manifestation misfires, the misfire chat card surfaces
// a "§ Renegotiate — accept narrative debt" button automatically (see
// _ftPostMisfireConversionCard + _ftHandleMisfireConvertClick in module.js).
// THIS DIALOG: manual entry point to view + add to the debt ledger outside a
// misfire (e.g. GM logging an after-the-fact debt agreed at the table).
// Ledger lives at flags.fourththing.pkNarrativeDebts — same field the
// misfire path writes to, so both surfaces stay in sync.
export async function openPactkeeperRenegotiate(actor) {
  const ledger = Array.isArray(actor.flags?.fourththing?.pkNarrativeDebts)
    ? actor.flags.fourththing.pkNarrativeDebts : [];
  const recent = ledger.slice(-5).map(d => {
    const ts = d.ts ? new Date(d.ts).toLocaleDateString() : "";
    const src = d.source ? ` <span style="opacity:0.55">(${_ftEscape(d.source)})</span>` : "";
    return `<li>${_ftEscape(d.debt || d.note || "(unspecified)")}${src} <span style="opacity:0.5">— ${ts}</span></li>`;
  }).join("");
  const lines = ledger.length
    ? `<p style="font-size:0.74rem;opacity:0.7;margin:0.3rem 0">Last ${Math.min(5, ledger.length)} of ${ledger.length} debt(s):</p><ul style="margin:0;padding-left:1.2rem;font-size:0.74rem">${recent}</ul>`
    : `<p style="font-size:0.74rem;opacity:0.7;margin:0.3rem 0">No outstanding debts yet.</p>`;

  new Dialog({
    title: "Pactkeeper — Renegotiate Ledger (Initiation 6)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Misfire-conversion debts are added automatically when you click "§ Renegotiate" on a misfire card. Use this surface to <b>log a debt agreed at the table</b> independent of a misfire, or to review existing debts.</p>
      <div class="ft-cast-field">
        <label>Describe the debt being logged</label>
        <input type="text" name="note" placeholder="e.g., owe the Verdict Court a favor next session"/>
      </div>
      ${lines}
    </div>`,
    buttons: {
      accept: {
        label: "Log Debt",
        callback: async (html) => {
          const note = String(html.find("[name='note']").val() || "").trim() || "(unspecified debt)";
          const next = [...ledger, { ts: Date.now(), debt: note, source: "manual" }];
          await actor.setFlag("fourththing", "pkNarrativeDebts", next);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#3a6a5a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0c8b8">§ Debt Logged — ${_ftEscape(actor.name)}</span></div>
              <p style="margin:0.3rem 0;font-size:0.8rem"><b>Debt:</b> ${_ftEscape(note)}</p>
              <p style="margin:0.2rem 0 0;font-size:0.72rem;opacity:0.55">Ledger now holds ${next.length} debt(s).</p>
            </div>`
          });
        }
      },
      close: { label: "Close" }
    },
    default: "accept"
  }).render(true);
}

// Pactkeeper — Initiation 1 skill pick. Canon: "Skill rank +1 in two of:
// Diplomacy, Insight, Intimidation, Lore." Player picks at character creation.
// Idempotent: once locked, attempting to re-open shows the prior pick and
// requires GM to clear the flag for a redo. Grants are direct skill-rank
// writes; the wizard auto-grant path is bypassed here because canon is a
// constrained choice, not a blanket grant.
export async function openPactkeeperPickL1Skills(actor) {
  const CHOICES = [
    { key: "diplomacy",    label: "Diplomacy"    },
    { key: "insight",      label: "Insight"      },
    { key: "intimidation", label: "Intimidation" },
    { key: "lore",         label: "Lore"         }
  ];
  const prior = actor.flags?.fourththing?.pactkeeperL1Picks;
  if (Array.isArray(prior) && prior.length === 2) {
    return new Dialog({
      title: "Pactkeeper — L1 Skill Pick (already chosen)",
      content: `<div class="ft-cast-dialog">
        <p style="font-size:0.78rem">You already picked your Initiation 1 skill grants:</p>
        <ul style="margin:0.3rem 0;padding-left:1.2rem;font-size:0.82rem"><li><b>${_ftEscape(CHOICES.find(c => c.key === prior[0])?.label || prior[0])}</b></li><li><b>${_ftEscape(CHOICES.find(c => c.key === prior[1])?.label || prior[1])}</b></li></ul>
        <p style="font-size:0.72rem;opacity:0.6;margin:0.4rem 0 0">To redo: GM clears <code>flags.fourththing.pactkeeperL1Picks</code> on this actor.</p>
      </div>`,
      buttons: { close: { label: "Close" } }
    }).render(true);
  }

  const rawSys = actor.system?.system ?? actor.system ?? {};
  const skills = rawSys?.skills ?? {};
  const rows = CHOICES.map(c => {
    const curVal = Number(skills[c.key]?.value ?? 0);
    return `<label style="display:flex;gap:0.4rem;align-items:center;font-size:0.82rem;padding:0.2rem 0">
      <input type="checkbox" name="skill" value="${c.key}"/>
      <span>${c.label} <span style="opacity:0.55;font-size:0.74rem">(current rank ${curVal})</span></span>
    </label>`;
  }).join("");

  new Dialog({
    title: "Pactkeeper — Initiation 1 Skill Pick",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem"><b>The Bargain</b> grants +1 skill rank in <b>two of</b>:</p>
      <div style="margin:0 0 0.5rem">${rows}</div>
      <p style="font-size:0.72rem;opacity:0.6;margin:0">Tick exactly two boxes. Choice is locked once applied.</p>
    </div>`,
    buttons: {
      apply: {
        label: "Apply (lock pick)",
        callback: async (html) => {
          const picked = Array.from(html.find("[name='skill']:checked")).map(el => el.value);
          if (picked.length !== 2) {
            return ui.notifications?.warn("Pick exactly two skills.");
          }
          const updates = {};
          for (const sk of picked) {
            const cur = Number(skills[sk]?.value ?? 0);
            updates[`system.skills.${sk}.value`] = Math.max(cur, cur + 1, 1);
          }
          updates["flags.fourththing.pactkeeperL1Picks"] = picked;
          await actor.update(updates);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#3a6a5a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0c8b8">§ The Bargain — ${_ftEscape(actor.name)}</span></div>
              <p style="margin:0.3rem 0;font-size:0.82rem">+1 skill rank in <b>${_ftEscape(CHOICES.find(c => c.key === picked[0])?.label)}</b> and <b>${_ftEscape(CHOICES.find(c => c.key === picked[1])?.label)}</b>.</p>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
}

// ═══════════════════════════════════════════════════════════════════════════
// End Sprint F new handlers
// ═══════════════════════════════════════════════════════════════════════════

// ─── Passive class info dialogs ───────────────────────────────────────────────
// Harmony Marshal, Phantom Courier, Wyrdlens Adept: no resource pools,
// but clicking their core features shows a summary of their active passive bonuses.

export async function openPassiveClassInfo(actor, item) {
  const name = item?.name ?? "Path Principle";
  const desc = item?.system?.description?.value ?? "";
  const rawSys   = actor.system?.system ?? actor.system;
  const attrs    = rawSys?.attributes   ?? {};

  // Build context-specific bonus summary
  const lowerName = name.toLowerCase();
  let bonusSummary = "";

  if (lowerName.includes("harmony") || lowerName.includes("marshal")) {
    const presence = attrs.presence?.value ?? 2;
    bonusSummary = `<div class="ft-preview-stats">
      <span class="ft-prev-stat"><span class="ft-prev-label">Soft Power</span><span class="ft-prev-val">+10% generation</span></span>
      <span class="ft-prev-stat"><span class="ft-prev-label">Presence</span><span class="ft-prev-val">${presence}</span></span>
    </div>
    <p style="font-size:0.75rem;opacity:0.6;margin:0.4rem 0">Tier 2: Spend 1 Soft Power → remove 1 Attrition point faction-wide.</p>`;
  } else if (lowerName.includes("phantom") || lowerName.includes("courier")) {
    const intrigue = attrs.intrigue?.value ?? 2;
    bonusSummary = `<div class="ft-preview-stats">
      <span class="ft-prev-stat"><span class="ft-prev-label">Intrigue</span><span class="ft-prev-val">${intrigue}</span></span>
      <span class="ft-prev-stat"><span class="ft-prev-label">Terrain</span><span class="ft-prev-val">Ignore 1st hazard/turn</span></span>
    </div>
    <p style="font-size:0.75rem;opacity:0.6;margin:0.4rem 0">Tier 2: Complete Infiltration scenario → refund 1 Intrigue OP.</p>`;
  } else if (lowerName.includes("wyrdlens") || lowerName.includes("adept")) {
    const mind = attrs.mind?.value ?? 2;
    bonusSummary = `<div class="ft-preview-stats">
      <span class="ft-prev-stat"><span class="ft-prev-label">Mind</span><span class="ft-prev-val">${mind}</span></span>
      <span class="ft-prev-stat"><span class="ft-prev-label">Tikkun ID</span><span class="ft-prev-val">½ Intrigue OP cost</span></span>
    </div>
    <p style="font-size:0.75rem;opacity:0.6;margin:0.4rem 0">Tier 3: 1/Soma Break — auto-succeed one Spark-related lore check.</p>`;
  }

  new Dialog({
    title: name,
    content: `<div class="ft-cast-dialog">
      ${bonusSummary}
      ${desc ? `<div class="ft-item-desc" style="margin-top:0.5rem;max-height:300px;overflow-y:auto">${desc}</div>` : ""}
    </div>`,
    buttons: { close: { label: "Close" } },
    default: "close"
  }).render(true);
}

// ─── Caster Discipline Pilot — Signature Mode toggles + T4 abilities ────────
// (2026-04-27 — pilot. Each Mode is a stance flag the engine consults at cast/
// upkeep/misfire time via manifestation-discipline.js. Tier-4 abilities are
// 1/Soma Break dialogs gated by an actor flag the player resets manually on
// Soma Break.)

// Generic Signature Mode dialog factory. `opts.clarityUpkeep` (int) charges that
// many Clarity once, at stance-take, modelling the per-scene upkeep these stances
// pay (user canon 2026-05-23: 1 Clarity/scene). Pactkeeper's Sealed Pact opts out
// — its cost is the concurrency lock, not Clarity.
async function _openSignatureMode(actor, key, label, summaryHtml, opts = {}) {
  const on   = isModeActive(actor, key);
  const disc = summarizeDiscipline(actor);
  const upkeep = Math.max(0, Number(opts.clarityUpkeep) || 0);
  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Stance: <b>${on ? "ON" : "OFF"}</b></p>
      ${summaryHtml ? `<div class="ft-prev-align-note" style="font-size:0.78rem;margin-bottom:0.4rem">${summaryHtml}</div>` : ""}
      ${upkeep && !on ? `<p style="font-size:0.72rem;color:#a0c8d8;margin:0 0 0.3rem">Taking this stance costs <b>${upkeep} Clarity</b> (per scene).</p>` : ""}
      <p style="font-size:0.7rem;opacity:0.65;margin:0">Active discipline: <i>${disc || "(no shifts)"}</i></p>
    </div>`,
    buttons: {
      toggle: {
        label: on ? "Drop stance" : "Take stance",
        callback: async () => {
          if (!on && upkeep) {
            const sys = actor.system?.system ?? actor.system ?? {};
            const cur = Number(sys?.magic?.clarity?.value) || 0;
            if (cur < upkeep) {
              return ui.notifications?.warn(`${actor.name}: not enough Clarity to hold ${label} (needs ${upkeep}/scene, have ${cur}).`);
            }
            await actor.update({ "system.magic.clarity.value": cur - upkeep });
          }
          await toggleMode(actor, key, { label });
        }
      },
      close: { label: "Cancel" }
    },
    default: "toggle"
  }).render(true);
}

export async function openCosmicLinguistMode(actor) {
  return _openSignatureMode(actor, "clSentence", "Cosmic Linguist — The Sentence",
    "While held: every sustained manifestation treats its primary target as bound by name — your manifestation saves are rolled at disadvantage against them. Costs 1 Clarity per scene to hold.",
    { clarityUpkeep: 1 });
}

export async function openWyrdlensMode(actor) {
  return _openSignatureMode(actor, "wlRefraction", "Wyrdlens Adept — Refraction",
    "While held: declare your manifestation last in the round, after seeing what allies and enemies commit to. (Declaration order is a table procedure — honor it at the table.) Costs 1 Clarity per scene to hold.",
    { clarityUpkeep: 1 });
}

export async function openDreamwalkerMode(actor) {
  return _openSignatureMode(actor, "dwWalkingLane", "Dreamwalker — The Walking Lane",
    "While held: sustained manifestations reach into adjacent realms — ignore one band of cover or distance for one effect per round (range auto-allowed once per round; cover is GM-adjudicated). Costs 1 Clarity per scene to hold.",
    { clarityUpkeep: 1 });
}

export async function openPactkeeperMode(actor) {
  return _openSignatureMode(actor, "pkSealedPact", "Pactkeeper — Sealed Pact",
    "While the Seal holds: concurrent-manifestation cap +2; cannot voluntarily drop a manifestation sustained on a pact-bound subject. Pays ongoing upkeep (pilot: GM-set).");
}

// Factory for the Clarity-spend onUse callback used by the cadence helpers.
// Reads `ab.clarityCost` (number). Returns null when there's no cost so helpers
// short-circuit cleanly. The returned callback validates Clarity, deducts, and
// returns either `false` (insufficient — helper should abort) or a string
// (HTML fragment to append to the chat card showing the deduction).
function _makeClaritySpendCallback(ab) {
  const cost = Number(ab?.clarityCost ?? 0);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const label = ab?.label ?? "Ability";
  return async (actor) => {
    const have = Number(actor.system?.magic?.clarity?.value ?? 0);
    if (have < cost) {
      ui.notifications.warn(`${label}: insufficient Clarity (need ${cost}, have ${have}).`);
      return false;
    }
    const next = have - cost;
    await actor.update({ "system.magic.clarity.value": next });
    return `<div style="font-size:0.78rem;opacity:0.85;margin-top:0.3rem">⟁ <strong>Clarity:</strong> ${have} → ${next} (−${cost})</div>`;
  };
}

// Generic 1/Soma Break ability dialog. Tracks 'used' state on actor flag;
// player clears it manually on Soma Break (or via the Reset button). Flag
// namespace stays as `disciplineUsed` for backward compatibility with
// existing actor data from before the Soma Break canon unification.
//
// `onUse` may return `false` to abort (no flag burn) or a string of HTML to
// append to the chat card (used for Clarity-spend display).
async function _openSomaBreakAbility(actor, key, label, body, onUse) {
  const used = Boolean(actor.getFlag("fourththing", `disciplineUsed.${key}`));
  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${used ? "SPENT — refresh on Soma Break" : "AVAILABLE"}</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      use: {
        label: "Use",
        callback: async () => {
          if (used) {
            ui.notifications.warn(`${label}: already spent — reset on Soma Break.`);
            return;
          }
          let extra = "";
          if (typeof onUse === "function") {
            const result = await onUse(actor);
            if (result === false) return;
            if (typeof result === "string") extra = result;
          }
          await actor.setFlag("fourththing", `disciplineUsed.${key}`, true);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✶ ${label}</span></div>
              <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
              ${extra}
            </div>`
          });
        }
      },
      reset: {
        label: "Reset (Soma Break)",
        callback: () => actor.setFlag("fourththing", `disciplineUsed.${key}`, false)
      },
      close: { label: "Close" }
    },
    default: "use"
  }).render(true);
}

export async function openCosmicLinguistWordThatWas(actor) {
  return _openSomaBreakAbility(actor, "clWordThatWas", "Word That Was",
    "Retroactively re-narrate one of your misfires as if the manifestation had succeeded at one tier lower than the one you spent for. Pay the lower tier's base upkeep instead.");
}

// Generic tier-uses-per-Soma-Break dialog. Tracks `spent` count on
// `flags.fourththing.disciplineSpent.<key>` (number); resets to 0 on Soma
// Break (auto-reset wired in module.js somaBreak action) or via the in-dialog
// Reset button. Max uses = actor.system.details.tier (1–4). Authored to
// support PB/Long Rest abilities like Noosphere Hook (2026-04-29).
async function _openTierUsesPerSomaBreak(actor, key, label, body, onUse) {
  const tier      = Math.max(1, Number(actor.system?.details?.tier ?? 1));
  const maxUses   = tier;
  const spent     = Number(actor.getFlag("fourththing", `disciplineSpent.${key}`) || 0);
  const remaining = Math.max(0, maxUses - spent);

  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${remaining} / ${maxUses} uses remaining</b> (refresh on Soma Break)</p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      use: {
        label: "Use (-1)",
        callback: async () => {
          if (remaining <= 0) {
            ui.notifications.warn(`${label}: out of uses — refresh on Soma Break.`);
            return;
          }
          await actor.setFlag("fourththing", `disciplineSpent.${key}`, spent + 1);
          if (typeof onUse === "function") await onUse(actor);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✶ ${label}</span></div>
              <p style="font-size:0.78rem;opacity:0.85">Use ${spent + 1} / ${maxUses}</p>
              <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
            </div>`
          });
        }
      },
      reset: {
        label: "Reset (Soma Break)",
        callback: () => actor.setFlag("fourththing", `disciplineSpent.${key}`, 0)
      },
      close: { label: "Close" }
    },
    default: "use"
  }).render(true);
}

// 2026-05-20 — Exo-Knight Shield Projector custom handler. The generic
// `soma-break-tier` dialog (above) only debits a use counter; Shield
// Projector ALSO has to roll 1d6+tier and heal the targeted ally's
// Integrity. Uses the same `disciplineSpent.${key}` flag namespace as
// the generic helper so SP shares the tier-uses-per-Soma-Break tracking,
// just with an actual mechanical effect bolted on top.
//
// Target = the user's currently-targeted token (the ally being struck).
// If the targeted actor isn't owned by this client (typical — Shield
// Projector saves allies that the player doesn't own), the heal is
// relayed to an active GM via the same `system.fourththing` socket
// that applyDamageFromButton uses.
async function _openShieldProjector(actor, key, label, body) {
  const tier = Math.max(1, Number(actor.system?.details?.tier ?? 1));
  const maxUses = tier;
  const spent = Number(actor.getFlag("fourththing", `disciplineSpent.${key}`) || 0);
  const remaining = Math.max(0, maxUses - spent);

  if (remaining <= 0) {
    return ui.notifications.warn(`${label}: out of uses (${spent}/${maxUses}) — refresh on Soma Break.`);
  }

  const targets = Array.from(game.user?.targets ?? []);
  const targetToken = targets[0] ?? null;
  const targetActor = targetToken?.actor ?? null;
  const targetInfo = targetActor
    ? `<p style="font-size:0.78rem;margin:0 0 0.4rem">Target: <b>${_ftEscape(targetActor.name)}</b></p>`
    : `<p style="font-size:0.78rem;color:#f5a04a;margin:0 0 0.4rem">⚠ No target selected — target the ally being struck before clicking Use.</p>`;

  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${remaining} / ${maxUses} uses remaining</b> (refresh on Soma Break)</p>
      ${targetInfo}
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Will roll <b>1d6 + ${tier}</b> and restore that many Integrity on the target (offsets the damage they just took).</p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      use: {
        label: targetActor ? `Use → Shield ${_ftEscape(targetActor.name)}` : "Use (no target)",
        callback: async () => {
          if (!targetActor) {
            ui.notifications.warn(`${label}: target an ally first, then click Use.`);
            return;
          }
          const roll = new Roll(`1d6 + ${tier}`);
          await roll.evaluate();
          const heal = Math.max(0, Number(roll.total) || 0);

          let desc = "";
          try {
            if (game.user.isGM || targetActor.isOwner) {
              desc = await game.fourththing.rolls._applyDamageToActor(targetActor, heal, {
                op: "heal", track: "integrity"
              });
            } else if (game.users?.some?.(u => u.isGM && u.active)) {
              game.socket?.emit?.("system.fourththing", {
                t: "ft-applyDamage",
                actorId: targetActor.id,
                baseDmg: heal, op: "heal", track: "integrity",
                damageType: "", damageFlavor: ""
              });
              desc = `${targetActor.name}: heal relayed to GM (+${heal}).`;
            } else {
              ui.notifications.warn(`Shield Projector: no GM online to apply heal to ${targetActor.name}.`);
            }
          } catch (e) { console.warn("[shield-projector] heal apply failed", e); }

          await actor.setFlag("fourththing", `disciplineSpent.${key}`, spent + 1);

          await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor }),
            flavor: `<div class="fourththing-roll" style="border-color:#7ec0ff">
              <div class="ft-roll-header">
                <span class="ft-roll-name" style="color:#a0d4ff">🛡 Shield Projector — ${_ftEscape(actor.name)}</span>
                <span class="ft-defense-pill">${remaining - 1} / ${maxUses} left</span>
              </div>
              <p style="margin:0.3rem 0;font-size:0.82rem">Projected barrier on <b>${_ftEscape(targetActor.name)}</b> — <b style="color:#a0d4ff">+${heal} Integrity</b> <span style="opacity:0.75">(1d6 + ${tier} tier)</span>.</p>
              ${desc ? `<p style="margin:0;font-size:0.72rem;opacity:0.6">${_ftEscape(desc)}</p>` : ""}
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "use"
  }).render(true);
}

// Generic 1/scene ability dialog. Tracks 'used' state on actor flag under
// `fourththing.scenePerUse.<key>`; player clears it on scene change (or via the
// Reset button). Same shape as _openSomaBreakAbility but a separate flag
// namespace so a Soma Break doesn't reset scene abilities and vice versa.
async function _openPerSceneAbility(actor, key, label, body, onUse) {
  const used = Boolean(actor.getFlag("fourththing", `scenePerUse.${key}`));
  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${used ? "SPENT — refresh on new scene" : "AVAILABLE"}</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      use: {
        label: "Use",
        callback: async () => {
          if (used) {
            ui.notifications.warn(`${label}: already spent — reset on new scene.`);
            return;
          }
          let extra = "";
          if (typeof onUse === "function") {
            const result = await onUse(actor);
            if (result === false) return;
            if (typeof result === "string") extra = result;
          }
          await actor.setFlag("fourththing", `scenePerUse.${key}`, true);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✶ ${label}</span></div>
              <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
              ${extra}
            </div>`
          });
        }
      },
      reset: {
        label: "Reset (New Scene)",
        callback: () => actor.setFlag("fourththing", `scenePerUse.${key}`, false)
      },
      close: { label: "Close" }
    },
    default: "use"
  }).render(true);
}

// Clarity-gated ability dialog. No per-rest/per-scene cap — the gate is the
// actor's Clarity pool. `onUse` is normally a `_makeClaritySpendCallback`
// result; returning `false` aborts the chat card, a string is appended.
async function _openClarityOnlyAbility(actor, key, label, body, onUse) {
  const cur = Number(actor.system?.magic?.clarity?.value ?? 0);
  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>Clarity-gated — no per-rest cap. Current Clarity: ${cur}.</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      use: {
        label: "Use",
        callback: async () => {
          let extra = "";
          if (typeof onUse === "function") {
            const result = await onUse(actor);
            if (result === false) return;
            if (typeof result === "string") extra = result;
          }
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✶ ${label}</span></div>
              <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
              ${extra}
            </div>`
          });
        }
      },
      close: { label: "Close" }
    },
    default: "use"
  }).render(true);
}

// ─── Buried per-use abilities — Phase 1: Ancestry cores (2026-04-27) ──────────

export async function openMenhirkinHexRecognition(actor) {
  return _openPerSceneAbility(actor, "menhirkinHexRecognition",
    "Hex Recognition (Menhirkin Core)",
    "While on a natural surface you are directly touching, whisper a single question about the place. The GM answers with one true thing the land knows.");
}

export async function openEchoDiverTemporalFlinch(actor) {
  return _openPerSceneAbility(actor, "echoDiverTemporalFlinch",
    "Temporal Flinch (Echo-Diver Core)",
    "Reaction. When you or an ally within 10 ft would be hit by an attack you can see, shift them 5 ft. If that moves them out of range or line of sight, the attack misses.",
    // Shift the flinch target (a targeted ally token, else self) 5 ft directly
    // away from the nearest hostile token (the likely attacker). The miss itself
    // stays GM-adjudicated per canon ("if that moves them out of range or LoS").
    // Distance math is inline — ft-class-automation has no shared helper.
    async (a) => {
      const selfTok   = a.getActiveTokens?.()[0] ?? null;
      const targetTok = Array.from(game.user?.targets ?? [])[0] ?? null;
      const flinchTok = targetTok ?? selfTok;
      if (!flinchTok) {
        ui.notifications?.warn("Temporal Flinch: place your token or target an ally first.");
        return false;
      }
      const grid    = canvas?.dimensions?.size     || 100;
      const ftPerSq = canvas?.dimensions?.distance || 5;
      const ctr = (t) => ({ x: t.x + (t.w ?? t.width ?? grid) / 2, y: t.y + (t.h ?? t.height ?? grid) / 2 });
      const ftBetween = (t1, t2) => {
        const c1 = ctr(t1), c2 = ctr(t2);
        return Math.hypot(c1.x - c2.x, c1.y - c2.y) * (ftPerSq / grid);
      };
      // Reject an ally target that isn't within 10 ft of the Echo-Diver.
      if (targetTok && selfTok && targetTok.id !== selfTok.id && ftBetween(selfTok, targetTok) > 10) {
        ui.notifications?.warn("Temporal Flinch: the ally must be within 10 ft.");
        return false;
      }
      // Find the nearest hostile (opposite disposition sign) to set the dodge vector.
      const myDisp = flinchTok.document?.disposition ?? 1;
      let nearest = null, nd = Infinity;
      for (const t of (canvas?.tokens?.placeables ?? [])) {
        if (!t?.actor || t.id === flinchTok.id) continue;
        const d = t.document?.disposition ?? 0;
        const isEnemy = (myDisp >= 0 && d < 0) || (myDisp < 0 && d > 0);
        if (!isEnemy) continue;
        const dist = ftBetween(flinchTok, t);
        if (dist < nd) { nd = dist; nearest = t; }
      }
      let dx = 0, dy = -1; // default nudge = north when no threat is on the board
      if (nearest) {
        const f = ctr(flinchTok), e = ctr(nearest);
        const vx = f.x - e.x, vy = f.y - e.y, mag = Math.hypot(vx, vy) || 1;
        dx = vx / mag; dy = vy / mag;
      }
      const px5 = grid * (5 / ftPerSq);
      try {
        await flinchTok.document.update({
          x: Math.round(flinchTok.x + dx * px5),
          y: Math.round(flinchTok.y + dy * px5)
        });
      } catch (e) {
        console.warn("Temporal Flinch shift failed", e);
        return `<p style="font-size:0.75rem;color:#e0a060;margin:0.2rem 0 0">Couldn't move the token automatically — shift it 5 ft by hand.</p>`;
      }
      const who = (selfTok && flinchTok.id === selfTok.id) ? a.name : (flinchTok.actor?.name ?? "ally");
      return `<p style="font-size:0.75rem;color:#a0d8b0;margin:0.2rem 0 0">${_ftEscape(who)} flinches 5 ft${nearest ? " (away from the nearest threat)" : ""}. <span style="opacity:0.7">GM: if now out of the attack's range or LoS, it misses — reposition if needed.</span></p>`;
    });
}

export async function openSephirotScionAttunement(actor) {
  return _openPerSceneAbility(actor, "scionSefirotAttunement",
    "Sefirot Attunement (Sephirotic Scion Core)",
    "Invoke your chosen sephirah's register for +1 rank bonus on a check clearly in its domain. (Pick the sephirah at character creation; the bonus is on top of normal rank.)",
    // Canon: "+1 rank" expressed as reroll-lowest on the next check (user call
    // 2026-05-23). Single-slot ancestry reroll read by collectRerolls.
    async (a) => {
      await a.setFlag("fourththing", "ancestry.oneShotReroll", { mode: "reroll-lowest", source: "Sefirot Attunement" });
      return `<p style="font-size:0.75rem;color:#a0d8b0;margin:0.2rem 0 0">Armed — your next domain check rerolls its lowest die.</p>`;
    });
}

export async function openQliphScarredSaturation(actor) {
  return _openPerSceneAbility(actor, "qliphScarredSaturation",
    "Qliphothic Saturation (Qliph-Scarred Core)",
    "Reroll a failed Soul check — but the scene's Darkness-gain count goes up by 1. The scar pays for what the scar saves. (GM: tick scene Darkness on use.)",
    // Reroll wired; Darkness tick stays GM-adjudicated per the canon text.
    async (a) => {
      await a.setFlag("fourththing", "ancestry.oneShotReroll", { mode: "reroll-lowest", attribute: "soul", source: "Qliphothic Saturation" });
      return `<p style="font-size:0.75rem;color:#a0d8b0;margin:0.2rem 0 0">Armed — your next Soul check rerolls its lowest die. <span style="opacity:0.7">(GM: tick scene Darkness +1.)</span></p>`;
    });
}

// ─── Buried per-use abilities — Phase 2 helpers (2026-04-27) ──────────────

// Pure information dialog for trigger-based abilities with no daily cap.
// Used for things like Sun-Scar (fires whenever you succeed a save) where
// there's nothing to track — players just need to remember the ability exists.
async function _openInfoOnlyAbility(actor, label, body) {
  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>PASSIVE TRIGGER — fires on the trigger condition, no daily cap</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      announce: {
        label: "Announce in Chat",
        callback: () => {
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✶ ${label}</span></div>
              <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
            </div>`
          });
        }
      },
      close: { label: "Close" }
    },
    default: "close"
  }).render(true);
}

// Two-stage bank/spend ability dialog (for Heat Memory: bank fire damage you
// take, then later spend it as a bonus action for +1d10 fire on next attack).
// State stored as a number under `fourththing.bankSpend.<key>`.
async function _openBankSpendAbility(actor, key, label, body, opts = {}) {
  const banked = Number(actor.getFlag("fourththing", `bankSpend.${key}`) ?? 0);
  const bankLabel  = opts.bankLabel  ?? "Bank +1";
  const spendLabel = opts.spendLabel ?? "Spend";
  const max        = opts.max        ?? 99;
  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Banked: <b>${banked}</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      bank: {
        label: bankLabel,
        callback: async () => {
          const next = Math.min(max, banked + 1);
          await actor.setFlag("fourththing", `bankSpend.${key}`, next);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">✶ ${label} — Banked (${next} stored)</span></div></div>`
          });
        }
      },
      spend: {
        label: spendLabel,
        callback: async () => {
          if (banked <= 0) {
            ui.notifications.warn(`${label}: nothing banked to spend.`);
            return;
          }
          await actor.setFlag("fourththing", `bankSpend.${key}`, banked - 1);
          let spendExtra = "";
          if (typeof opts.onSpend === "function") {
            const r = await opts.onSpend(actor);
            if (typeof r === "string") spendExtra = r;
          }
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✶ ${label} — Spent (${banked - 1} remaining)</span></div>
              <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
              ${spendExtra}
            </div>`
          });
        }
      },
      reset: {
        label: "Reset (Soma Break)",
        callback: () => actor.setFlag("fourththing", `bankSpend.${key}`, 0)
      },
      close: { label: "Close" }
    },
    default: "spend"
  }).render(true);
}

// ─── Phase 2 handlers ─────────────────────────────────────────────────────────

// Menhirkin Igneous: picker exposing both Hex Recognition (from core) and
// Heat Memory (heritage-unique). Each row links to its own dialog.
export async function openMenhirkinIgneousPicker(actor) {
  const hexUsed = Boolean(actor.getFlag("fourththing", "scenePerUse.menhirkinHexRecognition"));
  const heatBanked = Number(actor.getFlag("fourththing", "bankSpend.menhirkinIgneousHeat") ?? 0);
  new Dialog({
    title: "Menhirkin (Igneous) — Per-Use Abilities",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.5rem;opacity:0.85">Pick which per-use ability to invoke. Each tracks its own state.</p>
      <div style="display:flex;flex-direction:column;gap:0.4rem">
        <div style="border:1px solid #6a8caa;border-radius:0.3rem;padding:0.45rem 0.6rem">
          <div style="font-size:0.85rem"><strong>Hex Recognition</strong> <span style="opacity:0.7;font-size:0.75rem">(Menhirkin Core, 1/scene, Action)</span></div>
          <div style="font-size:0.78rem;opacity:0.85">Status: <b>${hexUsed ? "SPENT — refresh on new scene" : "AVAILABLE"}</b></div>
        </div>
        <div style="border:1px solid #c08e6a;border-radius:0.3rem;padding:0.45rem 0.6rem">
          <div style="font-size:0.85rem"><strong>Heat Memory</strong> <span style="opacity:0.7;font-size:0.75rem">(Igneous heritage, bank/spend, 1/SB)</span></div>
          <div style="font-size:0.78rem;opacity:0.85">Banked heat: <b>${heatBanked}</b></div>
        </div>
      </div>
    </div>`,
    buttons: {
      hex:  { label: "Hex Recognition…", callback: () => openMenhirkinHexRecognition(actor) },
      heat: { label: "Heat Memory…",     callback: () => openMenhirkinIgneousHeatMemory(actor) },
      close: { label: "Close" }
    },
    default: "close"
  }).render(true);
}

export async function openMenhirkinIgneousHeatMemory(actor) {
  return _openBankSpendAbility(actor, "menhirkinIgneousHeat",
    "Heat Memory (Menhirkin Igneous)",
    "Bank fire damage you take, then spend banked heat as a bonus action to add +1d10 exploding energy damage (fire) to your next weapon attack, unarmed strike, or grapple that connects. All banked heat clears on Soma Break.",
    { bankLabel: "Bank Fire Damage (+1)", spendLabel: "Spend (Bonus Action, +1d10 fire)",
      // Spending arms a +1d10x10 bonus-damage rider; attackTest appends it to the
      // next hit's damage formula and clears it (mirrors the Surge Doomstrike rider).
      // Each spend stacks +1 die. The bonus inherits the attack's damage type for
      // resist purposes — same simplification Doomstrike accepts.
      onSpend: async (a) => {
        const cur = Number(a.getFlag("fourththing", "ancestry.oneShot.heatRider") ?? 0);
        await a.setFlag("fourththing", "ancestry.oneShot.heatRider", cur + 1);
      } });
}

export async function openOldenbornRustlandPatch(actor) {
  return _openSomaBreakAbility(actor, "oldenbornRustlandPatch",
    "Patch & Repurpose (Oldenborn Rustland Scavenger)",
    "1/Soma Break: while taking a Soma Break in a ruin or wreckage hex, recover one expended consumable (bandage, filter, torch, ration) by scavenging.");
}

export async function openFurrykinPredatorPatience(actor) {
  return _openSomaBreakAbility(actor, "furrykinPredatorPatience",
    "Predator Patience (Furrykin: Felid)",
    "1/Soma Break: treat a failed attack roll as a hit. Describe the perfect timing.",
    async (a) => {
      await a.setFlag("fourththing", "ancestry.oneShot.predatorAutoHit", true);
      return `<p style="font-size:0.75rem;color:#a0d8b0;margin:0.2rem 0 0">Armed — your next attack roll hits regardless of the total.</p>`;
    });
}

export async function openOldenbornPhoenixOath(actor) {
  return _openSomaBreakAbility(actor, "oldenbornPhoenixOath",
    "Phoenix Oath (Oldenborn: Ember-Touched)",
    "1/Soma Break, when you would drop to 0 HP: instead drop to 1 HP and erupt in a controlled blaze. Each hostile creature within 10 ft takes 2d6 + PB fire damage, and you immediately end one condition affecting you (charmed, frightened, or restrained).",
    // Full wire (user call 2026-05-23): arms a prevent-drop one-shot that
    // _applyDamageToActor honors at the integrity floor, then fires the eruption
    // (AOE 2d6+tier fire within 10 ft + end one condition). PB→tier (this system
    // has no D&D proficiency bonus; ft-translation maps it to rank/tier).
    async (a) => {
      await a.setFlag("fourththing", "ancestry.oneShot.phoenixOath", true);
      return `<p style="font-size:0.75rem;color:#e0a060;margin:0.2rem 0 0">Armed — the next hit that would drop you to 0 instead holds you at 1 and erupts (2d6 + tier fire, 10 ft; ends one condition).</p>`;
    });
}

export async function openOldenbornHearthDominion(actor) {
  return _openSomaBreakAbility(actor, "oldenbornHearthDominion",
    "Hearth Dominion (Oldenborn: Ember-Touched)",
    "1/Soma Break, over 1 minute, sanctify a fire or heat-source. Allies who rest within 30 ft regain an extra Hit Die and have advantage on saves vs. fear until their next Soma Break.");
}

export async function openOldenbornSunScar(actor) {
  return _openInfoOnlyAbility(actor,
    "Sun-Scar (Oldenborn: Ember-Touched)",
    "Passive trigger — when you succeed on a saving throw, you may deal psychic damage equal to your proficiency bonus to a creature within 10 ft (your aura flares). No daily cap; player choice on each save success.");
}

// ─── Phase 3 — Species multi-ability pickers (2026-04-27) ─────────────────────

export async function openCircuitbornAbilities(actor) {
  const arUsed = Boolean(actor.getFlag("fourththing", "disciplineUsed.circuitbornAttentionResonance"));
  new Dialog({
    title: "Circuitborn — Per-Use Abilities",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.5rem;opacity:0.85">Circuitborn carry two per-use powers. Each tracks its own state.</p>
      <div style="display:flex;flex-direction:column;gap:0.4rem">
        <div style="border:1px solid #6a8caa;border-radius:0.3rem;padding:0.45rem 0.6rem">
          <div style="font-size:0.85rem"><strong>Attention Resonance</strong> <span style="opacity:0.7;font-size:0.75rem">(1/Soma Break, GM-triggered)</span></div>
          <div style="font-size:0.78rem;opacity:0.85">Status: <b>${arUsed ? "SPENT — refresh on Soma Break" : "AVAILABLE"}</b></div>
        </div>
        <div style="border:1px solid #c08e6a;border-radius:0.3rem;padding:0.45rem 0.6rem">
          <div style="font-size:0.85rem"><strong>Glitch-Surge</strong> <span style="opacity:0.7;font-size:0.75rem">(passive — fires when you drop to 0 HP)</span></div>
          <div style="font-size:0.78rem;opacity:0.85">Status: <b>passive trigger, no tracking</b></div>
        </div>
      </div>
    </div>`,
    buttons: {
      ar: { label: "Attention Resonance…", callback: () => openCircuitbornAttentionResonance(actor) },
      gs: { label: "Glitch-Surge…",        callback: () => openCircuitbornGlitchSurge(actor) },
      close: { label: "Close" }
    },
    default: "close"
  }).render(true);
}

// Full choice dialog (user call 2026-05-23): HP-regain heals tier to integrity;
// OP-regain commits +1 OP to a chosen category on the bound faction. PB→tier
// (this system has no D&D proficiency bonus). 1/Soma Break via disciplineUsed flag.
export async function openCircuitbornAttentionResonance(actor) {
  const used    = Boolean(actor.getFlag("fourththing", "disciplineUsed.circuitbornAttentionResonance"));
  const sys     = actor.system?.system ?? actor.system ?? {};
  const tier    = Math.max(1, Math.min(4, Number(sys?.details?.tier) || 1));
  const faction = _hmGetFaction(actor);
  const opApi   = game.bbttcc?.api?.op;
  const buckets = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const bucketOpts = buckets.map(b => `<option value="${b}">${b.charAt(0).toUpperCase() + b.slice(1)}</option>`).join("");
  const body = "1/Soma Break: when a creature you can see is intensely focused on you (ally or enemy; GM adjudicates), regain HP equal to your tier, OR regain one spent OP in a category you used this scene.";
  new Dialog({
    title: "Attention Resonance (Circuitborn)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${used ? "SPENT — refresh on Soma Break" : "AVAILABLE"}</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem;margin-bottom:0.5rem">${body}</div>
      <div class="ft-cast-field" style="margin-bottom:0.4rem">
        <label>Choice</label>
        <select name="mode">
          <option value="hp">Regain HP equal to your tier (+${tier})</option>
          <option value="op">Regain 1 spent OP (pick category)</option>
        </select>
      </div>
      <div class="ft-cast-field">
        <label>OP category (if regaining OP)</label>
        <select name="bucket">${bucketOpts}</select>
      </div>
      <p style="font-size:0.7rem;opacity:0.6;margin:0.4rem 0 0">Faction: <b>${_ftEscape(faction?.name ?? "(unbound)")}</b>. OP regain commits +1 OP to the chosen category on your faction.</p>
    </div>`,
    buttons: {
      use: {
        label: "Use",
        callback: async (html) => {
          if (used) return ui.notifications?.warn("Attention Resonance: already spent — reset on Soma Break.");
          const mode = html.find("[name='mode']").val();
          let note = "";
          if (mode === "hp") {
            const desc = await game.fourththing.rolls._applyDamageToActor(actor, tier, { op: "heal", track: "integrity" });
            note = `Regained <b>${tier}</b> HP (tier).`;
          } else {
            const bucket = html.find("[name='bucket']").val();
            const marksPerOP = opApi?.OP_TO_MARKS || 10;
            if (faction && opApi?.commit) {
              const res = await opApi.commit(faction.id, { [bucket]: marksPerOP }, { context: "circuitborn-attention-resonance" });
              note = res?.committed
                ? `+1 ${_ftEscape(bucket)} OP regained for <b>${_ftEscape(faction.name)}</b>.`
                : `+1 ${_ftEscape(bucket)} OP — commit failed (${res?.error || "cap / API"}); GM applies.`;
            } else {
              note = `+1 ${_ftEscape(bucket)} OP — no bound faction; GM applies.`;
            }
          }
          await actor.setFlag("fourththing", "disciplineUsed.circuitbornAttentionResonance", true);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">✶ Attention Resonance</span></div><p style="margin:0.3rem 0;font-size:0.82rem">${note}</p></div>`
          });
        }
      },
      reset: {
        label: "Reset (Soma Break)",
        callback: () => actor.setFlag("fourththing", "disciplineUsed.circuitbornAttentionResonance", false)
      },
      close: { label: "Close" }
    },
    default: "use"
  }).render(true);
}

export async function openCircuitbornGlitchSurge(actor) {
  return _openInfoOnlyAbility(actor,
    "Glitch-Surge (Circuitborn)",
    "Passive trigger — when you drop to 0 HP, you may emit a controlled burst of static (no damage, but loud and disorienting) before you fall. In BBTTCC play, this is a perfect excuse for weird narrative consequences. (GM-adjudicated; no daily cap.)");
}

export async function openHumanAbilities(actor) {
  const adaptiveUsed = Boolean(actor.getFlag("fourththing", "disciplineUsed.humanAdaptive"));
  new Dialog({
    title: "Human — Per-Use Abilities",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.5rem;opacity:0.85">Humans carry two per-use powers. Each tracks its own cadence.</p>
      <div style="display:flex;flex-direction:column;gap:0.4rem">
        <div style="border:1px solid #6a8caa;border-radius:0.3rem;padding:0.45rem 0.6rem">
          <div style="font-size:0.85rem"><strong>Adaptive</strong> <span style="opacity:0.7;font-size:0.75rem">(1/Soma Break, on failed save)</span></div>
          <div style="font-size:0.78rem;opacity:0.85">Status: <b>${adaptiveUsed ? "SPENT — refresh on Soma Break" : "AVAILABLE"}</b></div>
        </div>
        <div style="border:1px solid #c08e6a;border-radius:0.3rem;padding:0.45rem 0.6rem">
          <div style="font-size:0.85rem"><strong>Tenacious</strong> <span style="opacity:0.7;font-size:0.75rem">(1/round while at 1 HP, declare before roll)</span></div>
          <div style="font-size:0.78rem;opacity:0.85">Status: <b>conditional — only available at 1 HP</b></div>
        </div>
      </div>
    </div>`,
    buttons: {
      adaptive:  { label: "Adaptive…",  callback: () => openHumanAdaptive(actor) },
      tenacious: { label: "Tenacious…", callback: () => openHumanTenacious(actor) },
      close: { label: "Close" }
    },
    default: "close"
  }).render(true);
}

export async function openHumanAdaptive(actor) {
  return _openSomaBreakAbility(actor, "humanAdaptive",
    "Adaptive (Human)",
    "1/Soma Break: when you fail a saving throw, choose to succeed instead.",
    async (a) => {
      await a.setFlag("fourththing", "ancestry.oneShot.adaptiveAutoSave", true);
      return `<p style="font-size:0.75rem;color:#a0d8b0;margin:0.2rem 0 0">Armed — your next failed saving throw automatically succeeds.</p>`;
    });
}

// Advantage at exactly 1 HP, expressed as a reroll-lowest one-shot (same as
// Sefirot/Qliph — the system's advantage idiom). Gated on integrity === 1; the
// "1/round" cap is self-regulated (single-use, re-armed each round while at 1 HP).
export async function openHumanTenacious(actor) {
  const sys   = actor.system?.system ?? actor.system ?? {};
  const hp    = Number(sys?.derived?.integrity?.value ?? sys?.integrity?.value ?? 0);
  const atOne = hp === 1;
  new Dialog({
    title: "Tenacious (Human)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${atOne ? "AT 1 HP — AVAILABLE" : `HP ${hp} — only usable at exactly 1 HP`}</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">While at exactly 1 HP, gain advantage on one check of your choice each round (expressed as reroll-lowest). Declare the check before rolling.</div>
    </div>`,
    buttons: {
      ...(atOne ? {
        use: {
          label: "Arm Advantage (next check)",
          callback: async () => {
            await actor.setFlag("fourththing", "ancestry.oneShotReroll", { mode: "reroll-lowest", source: "Tenacious" });
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">✶ Tenacious — Advantage</span></div><p style="margin:0.3rem 0;font-size:0.82rem">At 1 HP: your next check rerolls its lowest die. <span style="opacity:0.7">(1/round while at 1 HP.)</span></p></div>`
            });
          }
        }
      } : {}),
      close: { label: "Close" }
    },
    default: atOne ? "use" : "close"
  }).render(true);
}

export async function openStormbornWardOfTheGale(actor) {
  return _openSomaBreakAbility(actor, "stormbornWardOfTheGale",
    "Ward of the Gale (Stormborn Nomad)",
    "1/Soma Break: when you would take environmental damage (storm, heat, hazard, etc.), use your reaction to reduce that damage to half until the start of your next turn.",
    // _applyDamageToActor halves the next incoming hit (type-agnostic — same
    // simplification as Aurablade Resolve·Resist; the "environmental" gate is
    // honor-system, since the damage path doesn't carry a hazard flavor).
    async (a) => {
      await a.setFlag("fourththing", "ancestry.oneShot.galeHalveNext", true);
      return `<p style="font-size:0.75rem;color:#a0d8b0;margin:0.2rem 0 0">Armed — your next incoming (environmental) damage is halved.</p>`;
    });
}

// ─── Phase 4 — Character Options (Archetypes / Crews / Occult) (2026-04-27) ───

// Generic per-cadence dialog. Same shape as _openSomaBreakAbility but the
// reset label is parameterized so we can reuse for 1/scenario, 1/strategic
// turn, 1/Soma Break, etc. Flag namespace is also configurable so different
// cadences don't stomp on each other.
async function _openPerCadenceAbility(actor, key, label, body, opts = {}) {
  const ns          = opts.flagNamespace ?? "perCadence";
  const cadenceText = opts.cadenceText   ?? "this cadence";
  const resetLabel  = opts.resetLabel    ?? "Reset";
  const used = Boolean(actor.getFlag("fourththing", `${ns}.${key}`));
  new Dialog({
    title: label,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${used ? `SPENT — refresh ${cadenceText}` : "AVAILABLE"}</b></p>
      <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
    </div>`,
    buttons: {
      use: {
        label: "Use",
        callback: async () => {
          if (used) {
            ui.notifications.warn(`${label}: already spent — reset ${cadenceText}.`);
            return;
          }
          await actor.setFlag("fourththing", `${ns}.${key}`, true);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll">
              <div class="ft-roll-header"><span class="ft-roll-name">✶ ${label}</span></div>
              <div class="ft-prev-align-note" style="font-size:0.78rem">${body}</div>
            </div>`
          });
        }
      },
      reset: {
        label: resetLabel,
        callback: () => actor.setFlag("fourththing", `${ns}.${key}`, false)
      },
      close: { label: "Close" }
    },
    default: "use"
  }).render(true);
}

// Data-driven dispatch table for character-options items. Each entry maps
// item.system.identifier → { type, label, body }. The route name
// "char_opt_lookup" funnels to a single handler that does the lookup.
//
// `type` values:
//   - "scene"          → _openPerSceneAbility (player resets on scene change)
//   - "soma-break"     → _openSomaBreakAbility (player resets on Soma Break)
//   - "strategic-turn" → _openPerCadenceAbility (faction-cadence)
//   - "scenario"       → _openPerCadenceAbility (campaign-cadence)
//   - "info"           → _openInfoOnlyAbility (passive trigger, no tracking)
//
// Travel Engine v2 metadata (Phase B+C+E3, 2026-05-10/11):
//   - `travel: true`           → surfaces in the Travel Console's Vanguard
//                                 Abilities panel.
//   - `mitigates: [...tags]`   → the ability negates / reduces the listed
//                                 hazard tags. Cross-referenced against weather
//                                 archetype `tags` and (future) terrain tags.
//   - `vanguardMasks: [...tags]` → the ability obscures the stack from the
//                                 listed detection aspects. Narrative today
//                                 (GM arbitrates); future Phase E3+ may wire
//                                 per-aspect detection mechanics.
// Canonical mitigation tags:
//   "weather"     — any weather (catch-all, matches every WEATHER_ARCHETYPES tag)
//   "fog"         — memory_fog and similar
//   "storm"       — qliphoth_storm and other storm archetypes
//   "toxic"       — dustfront, contaminated weather
//   "ley"         — ley_updraft / leyline disturbance
//   "qliphothic"  — qliphothic-tagged weather, corrupted-terrain effects
//   "terrain"     — terrain hazards / difficult-terrain penalties
//   "radiation"   — RP-delta hazards
//   "encounter"   — meta: reroll/manipulate the encounter roll itself
// Canonical vanguardMasks tags:
//   "identity"    — names, faces, factional affiliation, magical signatures
//   "scry"        — remote viewing / clairvoyance / crystal-ball lookups
//   "divination"  — wards, alarms, future-sight, oracular sweeps
//   "tracks"      — physical trail / footprints / scent
//   "sound"       — silent passage
//   "sight"       — visual concealment / camouflage / shadow
//   "thermal"     — heat / aura / energetic-signature detection
//
export const CHAR_OPT_ABILITIES = {
  // ── Archetypes (9) ────────────────────────────────────────────────────────
  "archetype-wheel-of-fortune-t2": {
    type: "strategic-turn",
    label: "Wheel of Fortune — Tilt the Table (Tier 2)",
    body: "Strategic: Once per strategic turn, after any random table roll, encounter roll, or variable-outcome result is revealed, your faction may shift the result one step up or down the table, if a legal adjacent result exists."
  },
  "archetype-wheel-of-fortune-t3": {
    type: "soma-break",
    label: "Wheel of Fortune — Treat as 10 (Tier 3)",
    body: "Tactical: Once per Soma Break, when you miss with an attack or fail an ability check, treat the roll as a 10 before modifiers."
  },
  "archetype-wheel-of-fortune-t4": {
    type: "strategic-turn", travel: true, mitigates: ["encounter"],
    label: "Wheel of Fortune — Force the Reroll (Tier 4)",
    body: "Strategic: Once per strategic turn, after an outcome is revealed on a raid, campaign beat, travel encounter, or crisis table, your faction may force a reroll OR choose between the rolled outcome and the rerolled one."
  },
  "archetype-moon-t3": {
    type: "soma-break",
    label: "The Moon — Detect Thoughts (Tier 3)",
    body: "Tactical: Once per Soma Break, cast Detect Thoughts without expending Clarity. (You also have permanent advantage on saves vs. being charmed — no cap.)"
  },
  "archetype-hanged-man-t3": {
    type: "soma-break",
    label: "The Hanged Man — Reroll Failed Save (Tier 3)",
    body: "Tactical: Once per Soma Break, when you fail a saving throw against being charmed, frightened, or restrained, immediately reroll it."
  },
  "archetype-hanged-man-t4": {
    type: "strategic-turn",
    label: "The Hanged Man — Sacrifice Refund (Tier 4)",
    body: "Strategic: Once per strategic turn, after a failed raid, intrigue action, or diplomatic action, your faction may immediately regain 1 spent OP of the type used and apply +1 to its next related strategic roll."
  },
  "archetype-temperance-t2": {
    type: "info",
    label: "Temperance — Overflow Retention (Tier 2)",
    body: "Strategic (passive, fires each turn): Retain 1 overflow OP per turn that would otherwise be lost. No daily cap; auto-applies — this card is a reminder of the rule."
  },
  "archetype-star-t3": {
    type: "soma-break",
    label: "The Star — Hopebringer Aura (Tier 3)",
    body: "Tactical: Once per Soma Break during a major scene or encounter, allies within earshot who can see or hear you have advantage on saving throws against being frightened."
  },
  "archetype-sun-t3": {
    type: "soma-break",
    label: "The Sun — Beacon Aura (Tier 3)",
    body: "Tactical: Once per Soma Break during a major scene or encounter, allies within earshot who can see or hear you have advantage on saving throws against being frightened or charmed."
  },

  // ── Crews (3) ─────────────────────────────────────────────────────────────
  "crew-storm-wardens-t2": {
    type: "strategic-turn", travel: true, mitigates: ["weather"],
    label: "Storm Wardens — Weather Veto (Tier 2)",
    body: "Strategic: Once per strategic turn, your faction can suppress, blunt, or redirect a weather-based hazard affecting a local route, hex, or operation."
  },
  "crew-gridbreakers-t3": {
    type: "strategic-turn",
    label: "Gridbreakers — Reactivate Dormant Asset (Tier 3)",
    body: "Strategic: Once per strategic turn, temporarily reactivate a dormant urban asset, granting a short-lived but meaningful local benefit."
  },
  "crew-cultural-ambassadors-t4": {
    type: "strategic-turn",
    label: "Cultural Ambassadors — Soft Annex (Tier 4)",
    body: "Strategic: Once per strategic turn, attempt to shift the alignment of an adjacent neutral Hex toward your faction's political affiliation without spending OPs."
  },

  // ── Occult Associations (27) ──────────────────────────────────────────────
  "occult-association-kabbalist-t1": {
    type: "soma-break",
    label: "Kabbalist — Sense the Leak (Tier 1)",
    body: "Tactical: Once per Soma Break, cast Detect Evil and Good (flavored as sephirothic flow / qliphothic pressure). Hex Read on entry is passive; +3 Soft Power OP rolls is passive."
  },
  "occult-association-kabbalist-t3": {
    type: "scenario",
    label: "Kabbalist — Read the Rot (Tier 3)",
    body: "Strategic: Once per Scenario involving Qliphothic forces or corrupted Hex conditions, gain Advantage on one relevant Strategic Roll, chosen when you roll."
  },
  "occult-association-shaman-t1": {
    type: "strategic-turn", travel: true,
    label: "Shaman — Hex Attunement (Tier 1)",
    body: "Strategic: Once per Strategic Turn, gain +1 to one relevant travel, terrain, or wilderness-facing OP roll. (Hex Attunement on entry is passive.)"
  },
  "occult-association-shaman-t2": {
    type: "strategic-turn", travel: true, mitigates: ["weather", "terrain"],
    label: "Shaman — Read the Path (Tier 2)",
    body: "Strategic: Once per Strategic Turn when your faction faces travel hazard, severe weather, or terrain difficulty: reduce one weather/terrain complication by one step OR gain Advantage on one travel/wilderness Strategic Roll."
  },
  "occult-association-shaman-t3": {
    type: "scenario", travel: true, mitigates: ["terrain", "qliphothic", "ley"],
    label: "Shaman — Spirit-Walk (Tier 3)",
    body: "Strategic: Once per Scenario involving corrupted terrain, distressed leyline flow, unnatural weather, or spirit unrest: gain Advantage on one relevant Strategic Roll, OR negate one terrain- / corruption-based penalty for that Scene or operation."
  },
  "occult-association-shaman-t4": {
    type: "strategic-turn", travel: true, mitigates: ["weather", "terrain", "ley", "qliphothic"],
    label: "Shaman — Stabilize the Hex (Tier 4)",
    body: "Strategic: Once per Strategic Turn, target one Hex your faction occupies/traverses/affects: temporarily stabilize a distressed leyline or hostile environmental state for one Scenario or operation, OR reduce a corruption/weather/terrain pressure by one significant step."
  },
  "occult-association-tarot-mage-t1": {
    type: "soma-break",
    label: "Tarot Mage — Draw the Line (Tier 1, Tactical)",
    body: "Tactical: Once per Soma Break, before making an ability check, draw the line of fate early and gain Advantage on that check. (Strategic +2 Intrigue/turn is a separate Strategic Turn cadence — see the Strategic side.)"
  },
  "occult-association-tarot-mage-t2": {
    type: "scenario",
    label: "Tarot Mage — Tilt the Draw (Tier 2)",
    body: "Strategic: Once per Scenario, after a key faction check is rolled but before consequences fully resolve, tilt the draw and add +2 to the result, OR reduce the severity of one failed narrative consequence by one step (GM adjudicated)."
  },
  "occult-association-tarot-mage-t3": {
    type: "soma-break",
    label: "Tarot Mage — Foretelling Roll (Tier 3, Tactical)",
    body: "Tactical: When you finish a Soma Break, roll a d20 and record the number. Once per Soma Break, replace any attack roll, save, or ability check (yours or a creature you can see) with this foretelling roll, declared before the roll."
  },
  "occult-association-tarot-mage-t4": {
    type: "scenario",
    label: "Tarot Mage — Force the Reroll (Tier 4)",
    body: "Strategic: During Enemy Faction Turns (Phase 3), spend 5 Intrigue OP to force the GM to reroll one NPC faction's strategic action outcome and take the new result. Use sparingly — backlash, omen debt, hostile synchronicity guaranteed."
  },
  "occult-association-alchemist-t1": {
    type: "strategic-turn",
    label: "Alchemist — Production Reliability (Tier 1)",
    body: "Strategic: Once per Strategic Turn, when your faction spends Economy OP on production, infrastructure, or supply stabilization, reduce that spend by 1 (minimum 1)."
  },
  "occult-association-alchemist-t2": {
    type: "strategic-turn",
    label: "Alchemist — Propaganda Distillate (Tier 2)",
    body: "Strategic: Once per Strategic Turn, convert 3 Economy OP → 3 Soft Power OP, OR 3 Soft Power OP → 3 Economy OP. Does not count as OP generation. Leaves narrative residue."
  },
  "occult-association-alchemist-t4": {
    type: "strategic-turn",
    label: "Alchemist — Elixir of Fortitude (Tier 4)",
    body: "Strategic: Once per Strategic Turn, spend 5 Economy OP. Choose one OP category (Violence/Non-Lethal/Intrigue/Soft Power/Diplomacy): that category gains +3 OP for the duration of one Scenario. Unspent bonus OP is lost when scenario ends."
  },
  "occult-association-goetic-summoner-t3": {
    type: "strategic-turn",
    label: "Goetic Summoner — Binding Posture (Tier 3)",
    body: "Strategic: Once per Strategic Turn before a Scenario begins, declare a Binding Posture: gain +3 to a single Intrigue OP roll made during that Scenario. (If you fail a key check, GM may introduce a binding-tied complication.)"
  },
  "occult-association-goetic-summoner-t4": {
    type: "scenario",
    label: "Goetic Summoner — Major Binding (Tier 4)",
    body: "Strategic: After your faction defeats a major Qliphothic entity in a Scenario, attempt to bind it: spend 10 Intrigue OP and make a GM-adjudicated Strategic Roll. Success: bound asset granting +5 to Violence or Intrigue OP rolls while bound. Failure: entity escapes with a grudge."
  },
  "occult-association-prophet-oracle-t1": {
    type: "soma-break",
    label: "Prophet/Oracle — Omen Question (Tier 1, Tactical)",
    body: "Tactical: Once per Soma Break, ask the GM one focused omen-question about an immediate situation, route, or known danger. Answer is truthful but limited / symbolic / pressure-based."
  },
  "occult-association-prophet-oracle-t2": {
    type: "scenario",
    label: "Prophet/Oracle — Bias the Arrival (Tier 2)",
    body: "Strategic: Once per Scenario, when an encounter, complication, or emerging situation is about to be introduced, ask the GM to bias it toward one broad category: warning / negotiation / hazard / omen / hostile contact / opportunity."
  },
  "occult-association-prophet-oracle-t3": {
    type: "soma-break",
    label: "Prophet/Oracle — Foreseen Failure (Tier 3, Tactical)",
    body: "Tactical: Once per Soma Break, before a roll is made, declare a creature/ally/visible event-thread and grant Advantage on one attack, save, or check tied to avoiding a meaningful failure."
  },
  "occult-association-prophet-oracle-t4": {
    type: "strategic-turn",
    label: "Prophet/Oracle — Major Foresight (Tier 4)",
    body: "Strategic: Once per Strategic Turn, ask the GM one major foresight question about an impending threat, faction move, complication, or fracture point. Answer is truthful, possibly symbolic / partial / framed as pressure. (Tier 4 also unlocks 1/Scenario unusually-accurate prep — track separately.)"
  },
  "occult-association-exorcist-t2": {
    type: "strategic-turn",
    label: "Exorcist — Reduce Darkness (Tier 2)",
    body: "Strategic: Once per Strategic Turn, reduce Darkness or corruption pressure in a Hex by one step, OR remove one minor corruption effect from a scenario."
  },
  "occult-association-exorcist-t3": {
    type: "scenario",
    label: "Exorcist — Negate Corruption (Tier 3)",
    body: "Strategic: Once per Scenario, negate one corruption-based penalty or hostile effect. (Permanent advantage on rolls involving purification / stabilization / resisting Darkness is passive.)"
  },
  "occult-association-exorcist-t4": {
    type: "strategic-turn",
    label: "Exorcist — Major Purge (Tier 4)",
    body: "Strategic: Once per Strategic Turn, fully purge a major corruption event, Qliphothic effect, or Darkness spike, OR negate a major hostile environmental / metaphysical threat."
  },
  "occult-association-biomancer-t1": {
    type: "strategic-turn",
    label: "Biomancer — Reduce Survival Penalty (Tier 1)",
    body: "Strategic: Once per Strategic Turn, reduce one survival, hazard, or casualty-related penalty by one step. (Permanent advantage vs. poison/disease/environmental hazards is passive.)"
  },
  "occult-association-biomancer-t2": {
    type: "scenario",
    label: "Biomancer — Casualty Conversion (Tier 2)",
    body: "Strategic: Once per Scenario, reduce casualty severity for your faction by one step, OR convert a catastrophic loss into a contained loss with consequences."
  },
  "occult-association-biomancer-t4": {
    type: "strategic-turn",
    label: "Biomancer — Negate Crisis (Tier 4)",
    body: "Strategic: Once per Strategic Turn, negate a major environmental, casualty, or biological crisis affecting your faction, OR convert a lethal condition into a survivable but transformed state."
  },
  "occult-association-gnostic-t3": {
    type: "scenario",
    label: "Gnostic — Ignore Deception (Tier 3)",
    body: "Strategic: Once per Scenario, your faction may automatically ignore a single deception-based complication without spending OPs. (Permanent immunity to magical charm + advantage on Insight to detect deception is passive.)"
  },
  "occult-association-rosicrucian-t3": {
    type: "strategic-turn",
    label: "Rosicrucian — Bypass Bureaucracy (Tier 3)",
    body: "Strategic: Once per Strategic Turn, negate a single 'lost time' complication caused by bureaucracy, checkpoints, or local authorities during a Diplomacy-forward operation. (Securing safe shelter/cover/passage in GenPop hexes is passive — no OP spend.)"
  },

  // ── Phase 6: Ancestry core trait abilities (2026-04-27) ───────────────────
  // Items whose description text already references 1/Soma Break powers but
  // had no per-use picker wired. Adds the ▶ button + consumption tracking.
  "cryptidkin-folklore-frame": {
    label: "Cryptidkin: Folklore & Frame",
    abilities: [
      { key: "folklorePresence", type: "soma-break", level: 1,
        label: "Folklore Presence",
        body: "1/Soma Break, when you first meet a community, decide whether the rumors about you arrived first. If yes, reroll the lowest die on your first Diplomacy (Presence) or Intimidation (Presence) check with anyone in that community (your choice which skill, declared when you roll). The rumor is not always flattering — the GM gets to colour it." },
      { key: "survivorsInstinct", type: "soma-break", level: 1,
        label: "Survivor's Instinct",
        body: "1/Soma Break, when you would drop to 0 Integrity, you may instead drop to 1 Integrity and gain one level of Stress." }
    ]
  },

  // ── Action-economy surfacing pass 2026-05-04 ──────────────────────────────
  // Heritage card with [TODO(adv-call)] marker — Bulwark Frame is the reaction
  // surfaced on the Circuitborn Exo-Knight heritage trait. Inferrer auto-tags
  // actionCost from the "use your reaction" body text. Shield Projector is a
  // separate Tier I item granted via this heritage's ItemGrant (UUID
  // 25sAhPJM2icg1WWH); add its identifier here once verified live.
  "circuitborn_exo_knight_heritage": {
    type: "soma-break", level: 1,
    label: "Exo-Knight: Bulwark Frame (1/Soma Break)",
    body: "Reaction — when an ally within 5 ft of you is hit by an attack, impose roll 3d10 keep lowest 2 on the attack roll."
  },

  // ── D&D-vocab scrub Phase 3 — Circuitborn ancestry feats (2026-04-29) ─────
  // Pilot batch from the buried-per-use survey. Identifiers verified in
  // bbttcc-master-content.ancestry-feats. All `1/Soma Break` except Noosphere
  // Hook which uses the new `soma-break-tier` mechanic (tier-many uses).
  "circuitborn-exo-bulwark_protocol": {
    type: "soma-break", level: 11,
    label: "Bulwark Protocol (1/Soma Break)",
    body: "For 1 minute, allies within 10 feet gain +1 Guard and reroll the lowest die on defense checks against being moved or knocked prone. You must remain conscious."
  },
  "circuitborn-exo-siegebreaker_frame": {
    type: "soma-break", level: 17,
    label: "Siegebreaker Frame (1/Soma Break)",
    body: "For 1 minute, your attacks ignore resistance to kinetic damage, and you deal double damage to objects and structures. Strategic: your faction treats one Facility target as if its defense tier were 1 lower for a single Raid round (GM / system)."
  },
  "circuitborn-parallax-ghost_in_wires": {
    type: "soma-break", level: 11,
    label: "Ghost-In-The-Wires (1/Soma Break)",
    body: "For 10 minutes, you can interface with nearby mechanisms and simple electronics at 30 feet (doors, lights, locks, speakers). Not mind control — remote sabotage and mischief."
  },
  "circuitborn-parallax-perfect_misdirection": {
    type: "soma-break", level: 17,
    label: "Perfect Misdirection (1/Soma Break)",
    body: "For 1 minute, hostile creatures must roll 3d10 keep lowest 2 on attacks against you unless they succeed a Soul check at the start of their turn (DC 8 + tier + Intrigue). Once per minute you may force a ranged attack to miss by 'editing the frame.'"
  },
  "circuitborn-salvage-mobile_facility": {
    type: "soma-break", level: 17,
    label: "Mobile Facility Node (1/Soma Break)",
    body: "Over 1 minute, deploy a temporary station (a glowing fold-out altar of tools) that lasts 10 minutes. While active, you and allies within 10 feet reroll the lowest die on crafting, repairing, and disabling devices. Strategic: your faction may treat one Repair Rig or Repair Facility activity as costing 1 less OP once per Turn (GM / system)."
  },
  "circuitborn-salvage-patch_logic": {
    type: "soma-break", level: 11,
    label: "Patch-Logic Field (1/Soma Break)",
    body: "For 1 minute, allies within 10 feet reduce damage from hazards (fire, acid, falling debris, radiation bursts) by your tier (minimum 1)."
  },
  "circuitborn-salvage-scrap_alchemy": {
    type: "soma-break", level: 5,
    label: "Scrap Alchemy (1/Soma Break)",
    body: "Over 10 minutes, convert junk into a useful component. Choose one: ammunition, a simple tool, a small explosive charge (nonlethal), or a single-use OP chit worth +1 Economy or +1 Logistics for this scene."
  },
  "circuitborn-synapse-cognition_crown": {
    type: "soma-break", level: 17,
    label: "Cognition Crown (1/Soma Break)",
    body: "For 1 minute, you gain resistance to psychic damage and reroll the lowest die on all Mind and Soul checks. Once during the minute you may convert a failed check into a success by 'recompiling' (describe the glitch)."
  },
  "circuitborn-synapse-noosphere_hook": {
    type: "soma-break-tier", level: 11,
    label: "Noosphere Hook (tier uses / Soma Break)",
    body: "As an action, lock onto a creature, location, or faction you have observed. For 10 minutes, you know the general direction to it and reroll the lowest die on checks to track it (including digital/social tracking)."
  },

  // ── D&D-vocab scrub Phase 3 — Cryptidkin ancestry feats (2026-04-29) ──────
  // Batch 2 from the buried-per-use survey. Identifiers verified in
  // bbttcc-master-content.ancestries. All `1/Soma Break`. Tier→Level: T1=L5,
  // T2=L5, T4=L17 (per pilot canon). Crossroads Hare carries TWO independent
  // 1/Soma Break uses, surfaced via the multi-ability picker.
  "cryptidkin-chupacabra-blood-drinker": {
    label: "Cryptidkin (Chupacabra): Blood-Drinker",
    abilities: [
      { key: "bloodDrinker", type: "soma-break", level: 5,
        label: "Blood-Drinker (1/Soma Break)",
        body: "When you hit a creature with a melee attack, you may bite. Deal 1d6 + Body modifier qliphothic damage on top of the attack's normal damage, and gain temporary Integrity equal to the qliphothic damage dealt." },
      { key: "hexSense", type: "scene", level: 5,
        label: "Hex-Sense (1/Scene)",
        body: "GM-narrative. You can smell magical residue the way most people smell rain. When something supernatural has happened in a place within the last 24 hours, the GM tells you so — and roughly what colour it was." }
    ]
  },
  "cryptidkin-chupacabra-skittering-night-feeder": {
    label: "Cryptidkin (Chupacabra): Skittering Night-Feeder",
    abilities: [
      { key: "firstStrike", type: "soma-break", level: 17,
        label: "First Strike (1/Soma Break)",
        body: "When you hit a creature that is surprised, unconscious, restrained, or isolated from its allies, the strike deals an additional 1d6 damage of the weapon's type." },
      { key: "skitteringHorror", type: "info", level: 17,
        label: "Skittering Horror (passive)",
        body: "Climb speed equals walk speed (auto-applied via system.derived.movement). Reroll the lowest die on Stealth (Intrigue) checks made in darkness, ruins, or confined environments — auto-fires; honor-system gate on environment. (Engine note surfaces in chat.)" },
      { key: "nightFeeder", type: "info", level: 17,
        label: "Night-Feeder (passive)",
        body: "Reroll the lowest die on the first attack roll you make against a creature that is surprised, unconscious, restrained, or isolated from its allies — auto-fires on attack rolls; honor-system gate on target state. (Engine note surfaces in chat.)" }
    ]
  },
  "cryptidkin-furrykin-folklore-echo": {
    type: "soma-break", level: 17,
    label: "Folklore Echo (1/Soma Break)",
    body: "Bonus action — for 1 minute or until ended, you become a story. Reroll the lowest die on Stealth (Intrigue) and Intimidation (Presence). Creatures that haven't seen you act before roll 3d10 keep lowest 2 on attacks against you. You can move through any space larger than Tiny without provoking opportunity attacks. Witness descriptions of you stay vague — the rumor takes priority over the witness."
  },
  "cryptidkin-furrykin-pack-tongue": {
    label: "Cryptidkin (Furrykin): Pack Tongue",
    abilities: [
      { key: "packTongue", type: "soma-break", level: 5,
        label: "Pack Tongue (1/Soma Break)",
        body: "Bonus action — choose one ally within 30 feet who can see or hear you. They reroll the lowest die on the next Diplomacy, Intimidation, Stealth, or Empathy check they make before the start of your next turn." },
      { key: "denSign", type: "info", level: 5,
        label: "Den-Sign (passive)",
        body: "GM-narrative. You can leave a small mark — scent, claw notch, fur knot — that other Furrykin and most beasts will recognize. When you spend 10 minutes searching an area, the GM tells you what kind of marks have already been left there." }
    ]
  },
  "cryptidkin-jackalope-cant-catch-me": {
    label: "Cryptidkin (Jackalope): Can't Catch Me",
    abilities: [
      { key: "cantCatchMe", type: "soma-break", level: 5,
        label: "Can't Catch Me (1/Soma Break)",
        body: "Bonus action — take the Dash or Disengage action." },
      { key: "lightFooted", type: "info", level: 5,
        label: "Light-Footed (passive)",
        body: "Difficult terrain caused by undergrowth, brush, snow drifts, or scrap-strewn ground does not slow you. You can move along narrow ledges, fences, branches, or rooftops at full speed without making a check unless they are actively crumbling." }
    ]
  },
  "cryptidkin-jackalope-crossroads-hare": {
    label: "Cryptidkin (Jackalope): Crossroads Hare",
    abilities: [
      { key: "vanish", type: "soma-break", level: 17,
        label: "Crossroads Hare (Vanish)",
        body: "1/Soma Break, when you would be reduced to 0 Integrity, you may instead vanish into the place between places. At the start of your next turn, you reappear in any unoccupied space within 1 mile that you have personally visited and clearly remember, with 1 Integrity and one level of Stress. You leave behind a single recognizable token at the spot you vanished from — a horn, a tuft of fur, a footprint that wasn't there before." },
      { key: "rumorRunsFaster", type: "soma-break", level: 17,
        label: "The Rumor Runs Faster",
        body: "1/Soma Break, spend 1 minute of focused Clarity hold to ask the GM what one nearby community is currently afraid of. The answer is at least one truth." }
    ]
  },
  "cryptidkin-jackalope-startle-reflex": {
    type: "soma-break", level: 5,
    label: "Startle Reflex (1/Soma Break)",
    body: "Reaction when you are targeted by an attack roll or fail an Intrigue check — move up to 10 feet without provoking opportunity attacks. (Horns of Bad Luck — your natural unarmed strike — is granted as a manifestation when you take the Jackalope heritage.)"
  },

  // ── D&D-vocab scrub Phase 3 — Echo-Diver ancestry (2026-04-29) ────────────
  // Batch 3. T1 → L5 per Cryptidkin canon. The species root is a 4-slot
  // picker (1 active per-use + 3 info passives — matched by passive flags +
  // condition-immunity grant + initiative bonus on Empyrean tier1).
  "echo_diver": {
    label: "Echo-Diver: Time-Sense",
    abilities: [
      { key: "temporalFlinch", type: "soma-break", level: 5,
        label: "Temporal Flinch (1/Soma Break)",
        body: "Reaction when you or a creature within 10 feet of you would be hit by an attack you can see — move yourself or that creature 5 feet. If this moves the target out of the attack's range or line, the attack misses." },
      { key: "nicheSurvivor", type: "info", level: 5,
        label: "Niche Survivor (passive)",
        body: "You need roughly half the food, water, and air a comparable Medium creature needs. Reroll the lowest die on Body checks against suffocation, starvation, dehydration, or extreme temperature (auto-fires). You can squeeze through gaps and hold stillness that shouldn't work, and you know it." },
      { key: "vaultSight", type: "info", level: 5,
        label: "Vault Sight (passive)",
        body: "Darkvision 60 feet. Reroll the lowest die on Perception checks to notice unstable structure, active traps, trigger plates, load-bearing failures, or Spark / chronoflux residue (auto-fires; honor-system gate on the qualifying targets)." },
      { key: "cannotBeSurprised", type: "info", level: 5,
        label: "Cannot Be Surprised (passive)",
        body: "While conscious, you are immune to the Surprised condition. (Surfaces as an Immunity pill on your defenses block.)" }
    ]
  },
  "echo_diver_abyssal_tier1": {
    type: "soma-break", level: 5,
    label: "Tide Recall (1/Soma Break)",
    body: "Touch a surface, creature, or object. The GM tells you one true thing from its recent past. The lookback window scales with your tier — Tier 1: last 24 hours · Tier 2: last week · Tier 3: last year · Tier 4: anything that ever happened to it. The GM may colour the answer; they may not lie."
  },
  "echo_diver_empyrean_tier1": {
    label: "Echo-Diver (Empyrean): Stormread",
    abilities: [
      { key: "stormread", type: "soma-break", level: 5,
        label: "Stormread (1/Soma Break)",
        body: "Bonus action — deliver a warning to one willing ally within 30 feet who can hear and understand you. That ally may immediately use their reaction to move up to half their speed without provoking reaction strikes." },
      { key: "stormreadInitiative", type: "info", level: 5,
        label: "Stormread Initiative (passive +2)",
        body: "Flat +2 bonus to initiative — auto-applied via system.derived.initiative.bonus (Phase 4 passive engine)." }
    ]
  },
  "echo_diver_tellurian_tier1": {
    label: "Echo-Diver (Tellurian): Stone Patience",
    abilities: [
      { key: "stonePatience", type: "soma-break", level: 5,
        label: "Stone Patience (1/Soma Break)",
        body: "Bonus action — anchor yourself until the start of your next turn. You cannot be moved against your will, knocked Prone, or made Shaken. Forced-movement effects targeting you fail cleanly; the aggressor knows it." },
      { key: "objectSense", type: "info", level: 5,
        label: "Object Sense (passive)",
        body: "You passively know, without rolling, the approximate age and structural integrity of any object you touch." }
    ]
  },

  // ── D&D-vocab scrub Phase 3 — Sephirotic Scion ancestry (2026-04-29) ──────
  // Batch 4. T1 → L5 per Cryptidkin canon. 3 Tier-I feats; species root is
  // narrative-only (no mechanical per-use slots, skipped).
  "sephirotic_scion_cherubic_tier1": {
    type: "soma-break", level: 5,
    label: "The Gate Knows You (1/Soma Break)",
    body: "Reaction — when a creature you can see within 30 feet attempts to open, close, lock, unlock, cross, or pass through a door, gate, threshold, ley-line gate, or named boundary, the target rolls 3d10 keep lowest 2 on any check or defense check related to that crossing. The boundary listens to you."
  },
  "sephirotic_scion_ophanic_tier1": {
    type: "soma-break", level: 5,
    label: "The Wheel Never Stops (1/Soma Break)",
    body: "When you move at least 10 feet on your turn, as a bonus action take either one weapon attack OR the Dash action. Additional uses per Soma Break cost 1 Surge each (player-managed via Surge controls)."
  },
  "sephirotic_scion_seraphic_tier1": {
    type: "soma-break", level: 5,
    label: "Cleansing Breath (1/Soma Break)",
    body: "Action — exhale a 15-foot cone of radiant fire. Each creature in the cone makes an Intrigue check vs. your Resolve. On a failure, take 2d10 exploding sephirotic damage (flavor: holy fire); half on a success. Tier scaling: 3d10 at Tier 2, 4d10 at Tier 3, 5d10 at Tier 4."
  },

  // ── D&D-vocab scrub Phase 3 — Qliph-Scarred ancestry (2026-04-29) ─────────
  // Batch 5. T1 → L5 per Cryptidkin canon. 3 Tier-I feats; species root is
  // narrative-only (skipped). All three are single-slot soma-break per-uses.
  "qliph_scarred_chthonic_tier1": {
    type: "soma-break", level: 5,
    label: "What the Deep Dark Taught You (1/Soma Break)",
    body: "Bonus action — sink partially into shadow, earth, or stone. For up to 1 minute, while sunken you gain: reroll lowest on Stealth (Intrigue) checks · difficult terrain costs no extra movement · you can move through spaces 1 ft wide · resistance to qliphothic damage. The effect ends early if you are fully submerged in running water or take sephirotic damage."
  },
  "qliph_scarred_diabolic_tier1": {
    type: "soma-break", level: 5,
    label: "What's Inside You (1/Soma Break)",
    body: "Action — let the splinter speak. Choose one humanoid you can see within 30 feet who can hear and understand a language you know. They make a Soul check vs. your Resolve. On a failure, they are Calmed by you for 1 minute, or until they take damage or witness you attack them or someone they consider an ally. On a success, they know someone else briefly spoke through your mouth and can describe it to others — they are probably going to tell their friends."
  },
  "qliph_scarred_husk_tier1": {
    type: "soma-break", level: 5,
    label: "The Quiet Inside (1/Soma Break)",
    body: "Reaction — when you are targeted by a divination, mind-reading, or truth-detection effect, force the caster to roll their effect against your Resolve instead of its normal save DC. On a failure, the effect returns nothing — no partial information, no awareness that a target was present. On a success, you take 1 point of Stress from the pressure of the probe."
  },

  // ── D&D-vocab scrub Phase 3 — Menhirkin ancestry (2026-04-29) ─────────────
  // Batch 6. T1 → L5. 3 Tier-I feats + species root (4-slot picker).
  // Phase 4 reroll grants stamped on the species root for Stonebound.
  "menhirkin_igneous_tier1": {
    type: "soma-break", level: 5,
    label: "Magma Memory (1/Soma Break)",
    body: "Reaction when you take energy damage (any flavor) from a single source — bank a portion of the heat. Until your next Soma Break, spend the banked heat as a bonus action to add +2d10 exploding energy damage (flavor: fire) to your next weapon attack or unarmed strike that hits. While the heat is held, reroll the lowest die on Body checks against environmental cold."
  },
  "menhirkin_metamorphic_tier1": {
    label: "Menhirkin (Metamorphic): The Thing You Were",
    abilities: [
      { key: "softer", type: "scene", level: 5,
        label: "Softer (1/Scene)",
        body: "Bonus action — until the end of your next turn, your movement increases by 10 ft and you reroll the lowest die on Intrigue checks to squeeze or slip past. (Each option of The Thing You Were refreshes on Soma Break — you cannot pick the same option twice before a Soma Break.)" },
      { key: "older", type: "scene", level: 5,
        label: "Older (1/Scene)",
        body: "Bonus action — until the end of your next turn, gain low-light vision 60 ft if you don't already have it, or +30 ft if you do. (Each option refreshes on Soma Break.)" },
      { key: "wetter", type: "scene", level: 5,
        label: "Wetter (1/Scene)",
        body: "Bonus action — until the end of your next turn, you become immune to the Burning and Prone conditions, and difficult terrain does not slow you. (Each option refreshes on Soma Break.)" }
    ]
  },
  "menhirkin_sedimentary_tier1": {
    type: "soma-break", level: 5,
    label: "Read the Strata (1/Soma Break)",
    body: "Spend 10 minutes with a structure, ruin, battlefield, or natural formation older than a century. The GM answers two true questions about it — one about how it was built or formed, and one about the last decade of its occupation or use. Separate from the ancestry's Hex Recognition; they do not share a pool."
  },
  "menhirkin": {
    label: "Menhirkin: Hex-Giant",
    abilities: [
      { key: "landMemory", type: "soma-break", level: 5,
        label: "Land Memory (1/Soma Break)",
        body: "Lay a hand on any surface older than you and ask it what has happened there. The GM answers with one true thing the land remembers." },
      { key: "livingRampart", type: "soma-break", level: 5,
        label: "Living Rampart (1/Soma Break)",
        body: "Reaction — when a creature you can see targets an ally adjacent to you with an attack, you interpose bulk and bad life choices: the attacker rolls 3d10 keep lowest 2 on that attack roll." },
      { key: "sentientLand", type: "strategic-turn", level: 5,
        label: "Sentient Land (1/Strategic Turn)",
        body: "While standing on a hex your faction controls, consult the hex itself about a pending decision. The GM provides a one-sentence answer from the land's perspective (not the faction's). It is always honest. It is rarely comforting." },
      { key: "heartstone", type: "info", level: 5,
        label: "Heartstone (passive)",
        body: "A fragment of your home hex is literally inside you. While in any hex your faction controls or has claimed: reroll the lowest die on Body checks (auto-fires via reroll grant), and you cannot be forcibly removed from the hex against your will (teleportation, banishment, forced march) without first being reduced to 0 Integrity." }
    ]
  },

  // ── D&D-vocab scrub Phase 3 — Human ancestry (2026-04-29) ─────────────────
  // Batch 7. Levels taken from "Formerly granted at level X" prose where present;
  // tier→L5/L11/L17 otherwise. Trail-Sovereign carries a 2-slot picker (passive
  // Athletics reroll + 1/Soma Break group reroll). Other items single-slot.
  "human_cro_magnon_tier1": {
    label: "Human (Cro-Magnon): Coalition Tongue",
    abilities: [
      { key: "coalitionTongue", type: "soma-break", level: 5,
        label: "Coalition Tongue (1/Soma Break)",
        body: "Bonus action — choose one ally within 30 ft who can hear and understand you. Their next attack roll, skill check, or defense check before the start of your next turn is made at +1 rank (max rank 5). Name the thing you said, even if it was wordless." },
      { key: "symbolicMemory", type: "info", level: 5,
        label: "Symbolic Memory (passive)",
        body: "After spending 10 minutes in any inhabited or formerly-inhabited space, you may ask the GM one of: Who lived here? What did they fear? What did they leave? The answer is at least one truth, even if the GM colours it." }
    ]
  },
  "human-cro-magnon-pattern-mind": {
    type: "soma-break", level: 11,
    label: "Pattern-Mind (1/Soma Break)",
    body: "Spend 1 minute observing a situation — a battle line, a marketplace, a council, a storm system, a faction's public posture — then ask the GM one of: 'What is the actual goal here?' · 'What is being deliberately hidden?' · 'Who is about to break first?' The GM gives at least one true answer. They may colour it; they may not lie about it."
  },
  "human-cro-magnon-first-fire": {
    type: "soma-break", level: 17,
    label: "First Fire (1/Soma Break)",
    body: "Spend 10 minutes building a coalition fire — a real one, not a metaphor. While it burns and creatures shelter within 30 ft (up to 1 hour, longer if tended): friendly creatures reroll the lowest die on defense checks against being Shaken or Stressed; after a Soma Break taken at the fire, each friendly creature present gains a single banked reroll-lowest they may spend on any check before the next Soma Break. The first time a hostile creature crosses within 30 ft, every friend there knows it. Counts as a defensible camp narratively."
  },
  "human-denisovan-peak_anchor": {
    type: "soma-break", level: 17,
    label: "Peak-Anchor (1/Soma Break)",
    body: "Reaction — when you or an ally within 30 ft would be moved or teleported against your will, negate it. The effect fails, and the aggressor takes psychic backlash equal to your tier."
  },
  "human-erectus-first_fire": {
    label: "Human (Erectus): First Fire",
    abilities: [
      { key: "firstFire", type: "soma-break", level: 17,
        label: "First Fire — You Were Never Supposed to Stop (1/Soma Break)",
        body: "When you would drop to 0 Integrity, instead drop to 1 Integrity and gain temporary Integrity equal to twice your tier. Allies who can see you reroll the lowest die on their next defense check (because you refuse to quit and it's fucking inspiring)." }
    ]
  },
  "human-erectus-trail_sovereign": {
    label: "Human (Erectus): Trail-Sovereign",
    abilities: [
      { key: "trailSovereign", type: "soma-break", level: 11,
        label: "Trail-Sovereign — Call the Pace (1/Soma Break)",
        body: "Grant your party a reroll-lowest on a travel-related group check by calling the pace." },
      { key: "trailSovereignPassive", type: "info", level: 11,
        label: "Trail-Sovereign (passive)",
        body: "Reroll the lowest die on Athletics (Body and Violence) checks during chases, escapes, or travel hazards (auto-fires via reroll grant)." }
    ]
  },
  "human-florensis-living_folklore": {
    type: "soma-break", level: 17,
    label: "Living Folklore (1/Soma Break)",
    body: "For 1 minute, you cannot be targeted by opportunity attacks; once per turn you can force an enemy's attack to miss you (reaction) by 'being somewhere else in the story.'"
  },
  "human-neanderthal-old_hunt": {
    type: "soma-break", level: 17,
    label: "Old Hunt (1/Soma Break)",
    body: "Choose a target you can see and mark them for 1 hour. You always know the direction to them, and once per turn you deal +tier damage to them when you hit."
  },
  "human-neanderthal-protective_instinct": {
    type: "soma-break-tier", level: 5,
    label: "Protective Instinct (tier uses / Soma Break)",
    body: "Reaction — when an ally within 10 ft is hit, reduce the damage by 1d6 + your tier."
  },

  // ── D&D-vocab scrub Phase 3 — Oldenborn ancestry (2026-04-29) ─────────────
  // Batch 8 — 14 items. Levels: tier1→L5, tier2→L5, tier3→L11, tier4→L17 per
  // the "Formerly granted at level X" prose where present. Reroll passives
  // are stamped via the Phase 4 flag macro; dispatcher carries primary actives.
  "oldenborn-earthbound-mountain_stance": {
    type: "soma-break-tier", level: 11,
    label: "Mountain Stance (tier uses / Soma Break)",
    body: "Bonus action — enter a stance for 1 minute. While in the stance: reroll the lowest die on Violence checks; creatures provoke opportunity attacks from you even when they Disengage."
  },
  "oldenborn-earthbound-world_anchor": {
    type: "soma-break", level: 17,
    label: "World-Anchor (1/Soma Break)",
    body: "Reaction — when you or an ally within 30 ft would be teleported, displaced, banished, or forcibly moved by magical/metaphysical effect, anchor them. Effect fails; attacker takes psychic backlash = your tier."
  },
  "oldenborn-lumenwrought-moonlit_ward": {
    type: "soma-break-tier", level: 5,
    label: "Moonlit Ward (tier uses / Soma Break)",
    body: "Reaction — when you or an ally within 30 ft would be Charmed or Shaken, grant them reroll-lowest on the defense check. On a success, the aggressor rolls 3d10 keep lowest 2 on their next attack."
  },
  "oldenborn-lumenwrought-sovereign_mask": {
    type: "soma-break", level: 11, travel: true, vanguardMasks: ["identity", "scry"],
    label: "Sovereign Mask (1/Soma Break)",
    body: "Over 1 minute, assume a mythic persona (King, Trickster, Saint, Monster, etc.). For 10 minutes, gain a skill rank in Diplomacy (Presence), Stealth (Intrigue), and Intimidation (Presence) — or mastery if already proficient. You cannot be magically identified or scryed while masked."
  },
  "oldenborn-lumenwrought-mythic_recollection": {
    type: "soma-break", level: 17,
    label: "Mythic Recollection (1/Soma Break)",
    body: "For 1 minute, you become painfully real. Gain resistance to all damage except force; hostile creatures within 10 ft roll 3d10 keep lowest 2 on defense checks against your manifestations and abilities (caught in your gravity of meaning)."
  },
  "oldenborn-rustland-patch-repurpose": {
    type: "soma-break", level: 5,
    label: "Patch & Repurpose (1/Soma Break)",
    body: "During a Soma Break, spend 10 min on a single broken/low-charge item (weapon, tool, power cell, vehicle component, armour). Restore it to one more use, scene, or day. The GM rules how it dies for real after."
  },
  "oldenborn-rustland-salvage-king": {
    type: "scene", level: 17,
    label: "Salvage King (1/Scene)",
    body: "When the party is in any ruin, junkyard, scrap field, abandoned facility, or wrecked vehicle, declare that one specific reasonable object exists somewhere within sight or one room over. GM may set a brief search time, require a minor cost, or rule the object is in worse condition."
  },
  "oldenborn_rustland_scavenger_tier1": {
    type: "soma-break", level: 5,
    label: "Scavenger's Eye (1/Soma Break)",
    body: "Spend 10 min in a ruin, junkyard, or wreckage site. Find one specific reasonable item. GM may gate exotic items behind a Mind check. Passive Toxic Lung Filters: reroll-lowest on defense vs inhaled toxins/smoke/industrial residue (auto-fires); function up to 1 hour in atmospheres that would hospitalize a normal Medium creature."
  },
  "oldenborn-skythreaded-jetstream_traverse": {
    type: "soma-break", level: 11,
    label: "Jetstream Traverse (1/Soma Break)",
    body: "For 10 minutes, gain a flying speed equal to your walking speed; you must end your turn on solid ground (or fall normally). When this ends, you are not harmed by the fall from the last 10 ft."
  },
  "oldenborn-skythreaded-weather_crown": {
    type: "soma-break", level: 17, travel: true, mitigates: ["weather"],
    label: "Weather Crown (1/Soma Break)",
    body: "Over 1 minute, call a localized weather effect in a 60-ft radius for 10 minutes (fog, wind, rain, or clear). The effect is real and interacts with fire, ranged attacks, and travel checks. BBTTCC: 1/Turn your faction may re-roll a Weather event affecting your hex."
  },
  "oldenborn-stormborn-ward-of-the-gale": {
    type: "soma-break", level: 5,
    label: "Ward of the Gale (1/Soma Break)",
    body: "Reaction — when you take damage from a visible attack, hazard, or effect, wrap yourself in whirling air and reduce that damage by half until the start of your next turn (apply resistance first, then halve the remainder)."
  },
  "oldenborn-stormborn-skywalker": {
    type: "soma-break", level: 17,
    label: "Skywalker (1/Soma Break)",
    body: "Action — call the wind to hold you up. For 1 minute, walk on air, ash, falling rain, or any equivalent surface as if it were solid ground. Move at your normal walking speed in any direction including straight up. Falling damage negated for the duration. Ends early if you fall unconscious or dismiss it."
  },
  "oldenborn_stormborn_nomad_tier1": {
    type: "soma-break", level: 5,
    label: "Wind-Read (1/Soma Break)",
    body: "Reaction — when you would take energy damage (lightning or cold flavor) or kinetic damage (thunder flavor), halve it. The wind shifts as you do. Passive Weatherwise: always know upcoming weather for the next 12 hours within 1 mile (even underground); reroll-lowest on defense checks vs weather effects."
  },
  "oldenborn_stormborn_nomad_heritage": {
    type: "soma-break", level: 5,
    label: "Stormborn Nomad Heritage (1/Soma Break)",
    body: "Heritage-level signature: see Wind-Read on the Stormborn Nomad Tier-I feat for the active reaction. The heritage container surfaces here so the per-use is reachable from the heritage card directly."
  },

  // ── D&D-vocab scrub Phase 3 — Furrykin ancestry (2026-04-29) ──────────────
  // Batch 9 (final). 11 items across Felid / Leporid / Mustelid / Ursid /
  // Vulpin lines. Levels per "Formerly granted at level X" prose.
  "furrykin-felid-king_of_alleys": {
    type: "soma-break", level: 17,
    label: "King of Alleys (1/Soma Break)",
    body: "For 10 minutes, gain a climbing speed equal to your walking speed and ignore difficult terrain in urban ruins. BBTTCC: 1/Turn, reduce an Intrigue travel cost by 1 if your route passes through ruins."
  },
  "furrykin-felid-nine_lives": {
    type: "soma-break", level: 5,
    label: "Nine Lives Logic (1/Soma Break)",
    body: "When you would drop to 0 Integrity, instead drop to 1 Integrity and immediately Disengage as a reaction."
  },
  "furrykin-leporid-impossible_escape": {
    type: "soma-break", level: 17,
    label: "Impossible Escape (1/Soma Break)",
    body: "When you fail an Intrigue check, you may choose to succeed instead. Also, once per minute you may phase through a nonmagical barrier you could plausibly squeeze through."
  },
  "furrykin-leporid-panic_geometry": {
    type: "soma-break-tier", level: 5,
    label: "Panic Geometry (tier uses / Soma Break)",
    body: "Reaction — when a creature moves adjacent to you, move up to half your speed without provoking opportunity attacks."
  },
  "furrykin-mustelid-dig_in": {
    type: "soma-break-tier", level: 5,
    label: "Dig-In (tier uses / Soma Break)",
    body: "Bonus action — gain temporary Integrity equal to your tier + Body modifier; you cannot be knocked Prone until the start of your next turn."
  },
  "furrykin-mustelid-relentless_bite": {
    type: "soma-break", level: 17,
    label: "Relentless Bite (1/Soma Break)",
    body: "For 1 minute, once per turn when you hit a creature, reduce their speed to 0 until the start of their next turn (Violence check vs DC 8 + tier + Body resists)."
  },
  "furrykin-ursid-apex_shelter": {
    type: "soma-break", level: 17,
    label: "Apex Shelter (1/Soma Break)",
    body: "For 1 minute, allies within 10 ft gain +1 Guard and reroll the lowest die on defense checks against being moved or knocked Prone. You must remain conscious."
  },
  "furrykin-ursid-hibernate_pain": {
    type: "soma-break", level: 5,
    label: "Hibernate the Pain (1/Soma Break)",
    body: "Bonus action — gain resistance to kinetic damage for 1 minute. When this ends, gain one level of Stress."
  },
  "furrykin-ursid-roar_old_woods": {
    type: "soma-break-tier", level: 11,
    label: "Roar of the Old Woods (tier uses / Soma Break)",
    body: "Action — force hostile creatures within 10 ft to make a Soul check or become Shaken for 1 round. On a success, they still roll 3d10 keep lowest 2 on their next attack."
  },
  "furrykin-vulpin-fable_shadow": {
    type: "soma-break", level: 17,
    label: "Fable-Shadow (1/Soma Break)",
    body: "For 1 minute, hostile creatures roll 3d10 keep lowest 2 on attacks against you unless they succeed a Soul check at the start of their turn (DC 8 + tier + Intrigue). Once per turn, force one attack to miss you (reaction) by 'changing the story.'"
  },
  "furrykin-vulpin-scent_secrets": {
    type: "soma-break", level: 11,
    label: "Scent of Secrets (1/Soma Break)",
    body: "For 10 minutes, reroll the lowest die on Insight (Soul), Investigation (Mind), and Perception (Mind) checks to detect deception, hidden compartments, secret doors, or concealed items."
  },

  // ── Phase 5: RFI-class subclasses (2026-04-27) ────────────────────────────
  // Identifiers verified live in bbttcc-master-content.classes pack 2026-04-27.
  // Soul Smith forges (3)
  "bbttcc-soul-smith-smith-bound-light": {
    type: "soma-break", level: 14,
    label: "Forge of Bound Light — Pattern of Mercy (L14)",
    body: "1/Soma Break after a successful Parley: convert 1 Economy → 1 Soft Power OP."
  },
  "bbttcc-soul-smith-smith-spark-reclaimer": {
    type: "soma-break", level: 14,
    label: "Forge of the Spark Reclaimer — Clean Extraction (L14)",
    body: "1/Soma Break, negate a Darkness tick caused by a salvage or demolition you orchestrated."
  },
  "bbttcc-soul-smith-smith-victory": {
    label: "Forge of Victory",
    abilities: [
      { key: "standardOfWill", type: "scene",     level: 3,  label: "Standard of Will (L3)",
        body: "Action: raise a standard. Allies within 15 ft gain +1 vs. fear. At scene end → +1 Unity/VP. (1/scene.)" },
      { key: "victoryForge",   type: "soma-break", level: 14, label: "Victory Forge (L14)",
        body: "1/Soma Break after a peaceful objective: convert 1 Intrigue → 1 Diplomacy OR 1 Soft Power OP." }
    ]
  },

  // Dreamwalker trances (3)
  "bbttcc-dreamwalker-quiet-sun": {
    label: "Trance of the Quiet Sun",
    abilities: [
      { key: "somnolentPeace", type: "scene",     level: 3,  label: "Somnolent Peace (L3)",
        body: "1/scene, turn a lethal blow into unconsciousness at 1 HP." },
      { key: "daybreak",       type: "soma-break", level: 14, label: "Daybreak (L14)",
        body: "1/Soma Break, after a no-fatalities victory you led: Darkness −1 and +1 Diplomacy OP." }
    ]
  },
  "bbttcc-dreamwalker-sapphire-gate": {
    label: "Trance of the Sapphire Gate",
    abilities: [
      { key: "lucidStep",          type: "info",      level: 3,  label: "Lucid Step (L3) — Spend 1 Soft Power OP",
        body: "Spend 1 Soft Power OP to learn if the next Spark lead is Conceptual, Vestigial, or Animate. No daily cap; OP-cost only." },
      { key: "sapphireConduction", type: "soma-break", level: 14, label: "Sapphire Conduction (L14)",
        body: "1/Soma Break, after a Spark step succeeds: Darkness −1." }
    ]
  },
  "bbttcc-dreamwalker-thousand-faces": {
    label: "Trance of the Thousand Faces",
    abilities: [
      { key: "personaCache",  type: "info",        level: 3,  label: "Persona Cache (L3) — Spend 1 Soft Power OP",
        body: "Maintain PB personas. In Courtly Intrigue, spend 1 Soft Power OP to switch personas and gain Advantage on your next Deception or Persuasion check. No daily cap; OP-cost only." },
      { key: "borrowedVoice", type: "soma-break",  level: 10, label: "Borrowed Voice (L10)",
        body: "1/Soma Break, mimic a voice you've heard for up to 1 minute." }
    ]
  },

  // Wyrdlens refractions (3) — Lens Charge ladder consolidated onto Clarity
  // 2026-05-18. Each ladder ability now carries a `clarityCost` field that
  // the dispatcher deducts via _makeClaritySpendCallback.
  "bbttcc-wyrdlens-adept-foresight": {
    label: "Refraction of Foresight",
    abilities: [
      { key: "anticipationL1",      type: "soma-break",   level: 1,  label: "The Anticipation (L1)",         clarityCost: 1,
        body: "1/Soma Break — at the start of each combat or significant scene, spend 1 Clarity to gain a Foreseen Action: narrate a specific event about to occur. Advantage / +5 [TBD:balance] on your first reaction to it. May grant the Foreseen Action to an ally instead." },
      { key: "forceEnemyReroll",    type: "strategic-turn", level: 3, label: "Force Enemy Reroll (L3)",
        body: "Strategic: Once per Strategic Turn, spend 1 Intrigue OP to force an enemy strategic reroll." },
      { key: "slowedInstantL5",     type: "clarity-only", level: 5,  label: "The Slowed Instant (L5)",       clarityCost: 1,
        body: "Reaction (intent: 1/round) — when an ally within 30 ft is targeted by an attack, effect, or hostile action, spend 1 Clarity to briefly slow the moment: the ally may take a bonus reaction (dodge, parry, counter, reposition) before the action resolves." },
      { key: "readTheFieldL9",      type: "clarity-only", level: 9,  label: "Read The Field (L9)",           clarityCost: 2,
        body: "Start of a round — spend 2 Clarity to have the GM reveal, in broad terms, the intended actions of all hostile creatures in the scene this round. Accurate at moment of reading; can be changed by intervening actions." },
      { key: "stoppedStrikeL13",    type: "scene",        level: 13, label: "The Stopped Strike (L13)",      clarityCost: 3,
        body: "1/scene — reaction when a creature within range takes an action. Spend 3 Clarity to undo the action before it resolves; turn consumed but no effect. Target may attempt a Soul save [TBD:balance DC] to retain; success acts at keep-lowest." }
    ]
  },
  "bbttcc-wyrdlens-adept-mercy": {
    label: "Refraction of Mercy",
    abilities: [
      { key: "softReadingL1",     type: "clarity-only", level: 1,  label: "The Soft Reading (L1)",         clarityCost: 1,
        body: "Trigger — when you perceive hostile intent in a creature, spend 1 Clarity to learn what they want (motivation) instead of just what they will do. GM reveals the underlying motive. You may use this knowledge to attempt diplomatic / de-escalation actions with advantage and a Presence-check bonus [TBD:balance]." },
      { key: "mercyRefraction",   type: "scene",        level: 3,  label: "Mercy Refraction (L3)",
        body: "1/scene, convert a lethal hit you witness into non-lethal. If it forces surrender, +1 Diplomacy OP." },
      { key: "preventedBlowL5",   type: "clarity-only", level: 5,  label: "The Prevented Blow (L5)",       clarityCost: 2,
        body: "Reaction — when an ally would take damage from a deliberate attack, spend 2 Clarity to insert a preemptive action (shove, distraction, prevention). The attack's damage is halved / reduced [TBD:balance]; the attacker suffers no retaliation penalty." },
      { key: "redirectedHarmL9",  type: "clarity-only", level: 9,  label: "The Redirected Harm (L9)",      clarityCost: 3,
        body: "Reaction — when you perceive a harmful effect about to befall a living creature (trap, curse, ongoing manifestation), spend 3 Clarity to redirect the harm to a non-living target (wall, window, object you carry). Works on enemies too." },
      { key: "openHandL13",       type: "scene",        level: 13, label: "The Open Hand (L13)",           clarityCost: 5,
        body: "1/scene — when you are present at the moment a conflict might turn lethal, spend 5 Clarity to declare The Open Hand: all creatures in the scene are offered a genuine chance to disengage without penalty. Acceptors lose no resources, face, or progress. Refusers proceed normally." },
      { key: "sephiroticBloom",   type: "soma-break",   level: 14, label: "Sephirothic Bloom (L14)",
        body: "1/Soma Break, after a non-lethal victory you led: Darkness −1 and shift Hex one step toward a beneficial Sephirah." }
    ]
  },
  "bbttcc-wyrdlens-adept-truth": {
    label: "Refraction of Truth",
    abilities: [
      { key: "readingEyeL1",      type: "clarity-only", level: 1,  label: "The Reading Eye (L1)",                          clarityCost: 1,
        body: "After focusing on a creature, object, location, or ongoing situation for 1 minute, spend 1 Clarity to perceive one concealed truth: a recent lie, hidden motive, secret identity, disguise, false document, or active Stealth. GM picks one if multiple apply." },
      { key: "truthRefraction",   type: "info",         level: 3,  label: "Truth Refraction (L3) — Spend 1 Intrigue OP",
        body: "Spend 1 Intrigue OP to treat one Spark Identification roll ≤9 as a 10 this Turn. No daily cap; OP-cost only." },
      { key: "unconcealedWordL5", type: "clarity-only", level: 5,  label: "The Unconcealed Word (L5)",                     clarityCost: 1,
        body: "Reaction — when a creature in your presence lies aloud, spend 1 Clarity to perceive the truth they are lying about. You know it; you do not automatically speak it. Other creatures do not perceive your use of this ability." },
      { key: "forcedClarityL9",   type: "scene",        level: 9,  label: "The Forced Clarity (L9)",                       clarityCost: 3,
        body: "1/scene — spend 3 Clarity to create a Zone of Clarity: a 30-ft radius around you for 1 minute. No creature in the zone may successfully lie, conceal, or obscure intentions through speech. Mental concealment (occluded thoughts, non-verbal Stealth) unaffected." },
      { key: "exposureL13",       type: "scene",        level: 13, label: "The Exposure (L13)",                            clarityCost: 5,
        body: "1/scene — spend 5 Clarity to publicly reveal one concealed truth about a creature, faction, or institution present in the scene. Revelation cannot be unspoken; mechanical consequences (Morale penalty, Political Drift shift, social cascade) appropriate to severity." },
      { key: "unshatter",         type: "soma-break",   level: 14, label: "Unshatter (L14)",
        body: "1/Soma Break, purify a Corrupted Spark step via short penance: Darkness −1." }
    ]
  },

  // Harmony Marshal mandates (3)
  "bbttcc-harmony-marshal-marshal-accord": {
    label: "Mandate of Accord",
    abilities: [
      { key: "accordEngine",  type: "info",      level: 3,  label: "Accord Engine (L3) — Spend 1 Diplomacy OP",
        body: "During Parley, spend 1 Diplomacy OP to treat an opposing roll of 9 or lower as a 10 if the outcome moves toward peace. No daily cap; OP-cost only." },
      { key: "unityCadence",  type: "scene",     level: 6,  label: "Unity Cadence (L6)",
        body: "1/scene, end a scene you lead with zero fatalities → +1 Unity/VP." },
      { key: "resonantTruce", type: "soma-break", level: 10, label: "Resonant Truce (L10)",
        body: "1/Soma Break, for 1 minute: enemies in 15 ft have disadvantage to attack non-hostiles; advantage on saves to end fear/charm." }
    ]
  },
  "bbttcc-harmony-marshal-marshal-overwatch": {
    type: "soma-break", level: 6,
    label: "Mandate of Overwatch — Counter-Discord (L6)",
    body: "1/Soma Break, reaction to cancel a deceit-based reroll/disadvantage within 60 ft."
  },
  "bbttcc-harmony-marshal-marshal-resolve": {
    type: "scene", level: 14,
    label: "Mandate of Resolve — Steel & Velvet (L14)",
    body: "1/scene, after averting a rout into stalemate: gain +1 Soft Power OP and +1 Diplomacy OP."
  },

  // (Phantom Courier and Breaker subclass items don't exist in the live
  // bbttcc-master-content.classes pack 2026-04-27 — Sprint F retirement
  // removed them. Skipping those 5 entries.)

  // ── Surfacing pass 2026-05-04 (action-economy v1) ─────────────────────────
  // 51 unique identifiers from the audit-action-economy-gaps macro run.
  // Body-text inferrer classifies action cost; cadence/level set per item.
  // Heritage / class / subclass parent cards are tagged `info` (narrative —
  // active mechanics live on linked Tier I / feat items).

  // Heritage parent cards (narrative — no per-use)
  "echo_diver_abyssal_heritage":    { type: "info", label: "Echo-Diver Heritage: Abyssal", body: "Your time-sense tilts backward. You don't predict; you remember. (Heritage card — active per-uses live on the Abyssal Tier-I feat: Tide Recall.)" },
  "echo_diver_empyrean_heritage":   { type: "info", label: "Echo-Diver Heritage: Empyrean", body: "Your time-sense tilts forward. You feel weather before it arrives. (Heritage card — active per-uses live on the Empyrean Tier-I feat: Stormread.)" },
  "echo_diver_tellurian_heritage":  { type: "info", label: "Echo-Diver Heritage: Tellurian", body: "Your time-sense tilts toward the unchanging. (Heritage card — active per-uses live on the Tellurian Tier-I feat: Stone Patience.)" },
  "cosmic_linguist":                { type: "info", label: "Cosmic Linguist (Class)", body: "Trad Caster Class. Manifestation as accurate sentence. (Class card — active mechanics live on Initiation feats and Mode/Authority/Annotation/Word-That-Was per-uses.)" },
  "bbttcc-aurablade-blood-hymn":    { type: "info", label: "Aurablade — Blood Hymn", body: "Subclass card. Wound = prayer. Active mechanics live on Blood Hymn feature feats (Final Crescendo etc.)." },
  "bbttcc-aurablade-stillheart":    { type: "info", label: "Aurablade — Stillheart", body: "Subclass card. Calm = discipline. Active mechanics live on Stillheart feature feats (Emotional Lock etc.)." },
  "bbttcc-pactkeeper-archivist-of-precedent": { type: "info", label: "Pactkeeper — Archivist of Precedent", body: "Subclass card. Historical enforcement. Active mechanics live on Archivist Initiation feats." },
  "bbttcc-shadow-courier-courier-last-mile":  { type: "info", label: "Shadow Courier — Route of the Last Mile", body: "Subclass card. Psychopomp drift. Active mechanics live on Last Mile feats (Quiet Voyage etc.)." },

  // Active per-uses (cadence + level as inferred from body cues)
  "human-cro-magnon-coalition-tongue": {
    type: "soma-break", level: 5,
    label: "Human (Cro-Magnon): Coalition Tongue (1/Soma Break)",
    body: "Bonus action — choose one ally within 30 ft who can hear and understand you. Their next attack roll, attribute check, or defense check before the start of your next turn is made at +1 rank (max rank 5)."
  },
  "human-florensis-little_mighty": {
    type: "info",
    label: "Human (Florensis): Little But Mighty (passive)",
    body: "You may choose to be Small. No penalties for using Medium-sized weapons. Hide In Plain Sight is a conditional reaction — auto-fires when you take the Hide action behind a creature larger than yourself."
  },
  "circuitborn-exo-shield_projector": {
    type: "soma-break-tier", level: 1,
    label: "Circuitborn (Exo-Knight Line): Shield Projector (tier/Soma Break)",
    body: "Reaction — when a creature you can see within 30 feet is hit, project a barrier. Reduce the damage by 1d6 + your tier."
  },
  "archetype-chariot-t3": {
    type: "info", level: 11,
    label: "Archetype: The Chariot (Squad Leader) — Tier 3",
    body: "Tactical: you can use the Help action as a bonus action during combat (target = allied NPC or squadmate). Strategic: 1/Siege or Bunker operation, may pre-position one ally squad. (Auto-passive per-turn use; no debit.)"
  },
  "oldenborn-tideborne-floodgate_self": {
    type: "soma-break", level: 5,
    label: "Oldenborn (Tideborne): Floodgate of Self (1/Soma Break)",
    body: "Bonus action — enter a state for 1 minute. Resistance to psychic damage; when you deal damage you may push the target 5 ft."
  },
  "menhirkin-living-rampart": {
    type: "soma-break", level: 5,
    label: "Menhirkin: Living Rampart (1/Soma Break)",
    body: "Reaction — when a creature you can see targets an ally adjacent to you with an attack, interpose bulk and bad life choices: the attacker rolls 3d10 keep lowest 2 on the attack."
  },
  "oldenborn-stormborn-weatherwise": {
    type: "info",
    label: "Oldenborn (Stormborn Nomad): Weatherwise (passive)",
    body: "Always know the upcoming weather for the next 12 hours within 1 mile, even underground. Reroll the lowest die on saving throws against weather effects (auto-fires)."
  },
  "circuitborn-synapse-memory_print": {
    type: "soma-break", level: 5,
    label: "Circuitborn (Synapse Line): Memory-Print (1/Soma Break)",
    body: "Bonus action — replay a scene fragment to an ally, granting reroll-lowest on one Investigation, History, or Insight check."
  },
  "oldenborn-tideborne-undertow_grip": {
    type: "soma-break-tier", level: 1,
    label: "Oldenborn (Tideborne): Undertow Grip (tier/Soma Break)",
    body: "Reaction — when a creature within 10 feet moves willingly, use your reaction to slow them; their speed becomes 0 until the end of the turn."
  },
  "circuitborn-parallax-light_bend": {
    type: "soma-break-tier", level: 1,
    label: "Circuitborn (Parallax Line): Light-Bend Cloak (tier/Soma Break)",
    body: "Bonus action — become lightly obscured until the start of your next turn. Your first attack from this state has advantage."
  },
  "apotheosis-of-the-oneiric": {
    type: "info", level: 20,
    label: "Apotheosis of the Oneiric (Capstone, passive)",
    body: "You shed the last barrier between waking and dreaming. Limitless Tuning: use Dream-Thread Tuning any number of times. Sovereign-of-narrative passive."
  },
  "cl_init6_translation": {
    type: "scene", level: 6,
    label: "Cosmic Linguist: Initiation 6 — Translation (1/scene)",
    body: "Reaction — when an ally completes a manifestation within Reach, transcribe it into your idiom. Until end of next round, you carry their effect at your tier cap."
  },
  "emissary-of-the-great-accord": {
    type: "soma-break",
    label: "Emissary of the Great Accord (1/Soma Break)",
    body: "Once per Soma Break, when a scene involving multiple factions or hostile forces reaches its tipping point, declare an Accord pause. All hostilities pause for 1 minute or until violated."
  },
  "negotiated-advantage": {
    type: "soma-break",
    label: "Negotiated Advantage (1/Soma Break)",
    body: "Reaction — when a creature you can see within 30 feet makes an attack roll or attribute check against you or an ally, you may force them to roll 3d10 keep lowest 2."
  },
  "bulwark_cataclyst_l9_decide_the_weather": {
    type: "scene", level: 9,
    label: "Cataclyst L9: Decide The Weather (1/scene)",
    body: "Action — spend 2 Frame Dice and 2 Ruin Charges. Choose Wall (raise a wall of force, 30×10 ft) or Storm (15-ft radius lightning strike, exploding 2d10)."
  },
  "bulwark_mountain_l5_denial": {
    type: "soma-break-tier", level: 5,
    label: "Mountain L5: Denial (tier/Soma Break)",
    body: "Reaction — when a creature within 5 feet attempts to move past you, spend 1 Frame Die to stop them; they must make a Body check vs your Resolve or their movement is wasted."
  },
  "rallying-words": {
    type: "soma-break",
    label: "Rallying Words (1/Soma Break)",
    body: "Bonus action — choose one creature other than yourself within 30 feet who can see or hear you. That creature gains temporary Integrity equal to your tier and rerolls the lowest die on its next attack."
  },
  "bloodhymn_final_crescendo": {
    type: "soma-break", level: 18,
    label: "Blood Hymn: Final Crescendo (1/Soma Break, L18)",
    body: "Bonus action — immediately enter Burn 4. For the rest of the turn: all attacks deal maximum damage; you may cleave through every creature in reach."
  },
  "waking-dreamfield": {
    type: "soma-break",
    label: "Waking Dreamfield (1/Soma Break)",
    body: "Bonus action — enter a waking dreamstate for 1 minute. +1 bonus to Soul and Presence checks; you reroll the lowest die on attacks against dream-affected creatures."
  },
  "pulse-of-the-forge": {
    type: "soma-break",
    label: "Pulse of the Forge (1/Soma Break)",
    body: "Action — release a wave of stabilizing heat in a 15-foot radius. Allies in the radius gain temporary Integrity equal to your tier and reroll the lowest die on the next defense check."
  },
  "unbroken-line": {
    type: "soma-break",
    label: "Unbroken Line (1/Soma Break)",
    body: "Reaction — when an ally you can see within 30 feet is reduced to 0 Integrity but not killed outright, shout them back into formation. That ally instead drops to 1 Integrity."
  },
  "ascension-layer": {
    type: "info",
    label: "Ascension Layer (passive)",
    body: "Ascension Aura: while pursuing an active Spark quest or working a Great Work objective, you and allies within 30 ft reroll the lowest die on Spark-related checks (auto-fires)."
  },
  "probability-threading": {
    type: "soma-break",
    label: "Probability Threading (1/Soma Break)",
    body: "Reaction — when you or a creature you can see within 30 feet makes an attack roll, attribute check, or defense check, force a reroll of the lowest die."
  },
  "shadow_courier_blackstair_l17_stair_that_does_not_end": {
    type: "scenario", level: 17,
    label: "Black Stair L17: The Stair That Does Not End (1/session)",
    body: "Action — step through any door, arch, gate, or marked threshold and arrive at any other threshold you have personally crossed in this campaign."
  },
  "shadow_courier_tier2_the_crossing": {
    type: "scene", travel: true, vanguardMasks: ["divination"], mitigates: ["terrain"],
    label: "Shadow Courier — Tier 2: The Crossing (1/scene)",
    body: "Action — declare a single threshold within reach (door, wall, ward, alarm, divination). The membrane chooses you instead: pass through or bypass it cleanly."
  },
  "shadow_courier_tier4_unfound_route": {
    type: "scenario", level: 17, travel: true,
    label: "Shadow Courier — Tier 4: Unfound Route (1/session)",
    body: "Action — name two thresholds you have personally crossed earlier in this campaign and link them. For 1 minute, the route exists and may be travelled by anyone in your party."
  },
  "shadow_courier_lastmile_l13_quiet_voyage": {
    type: "scene", level: 13,
    label: "Last Mile L13: The Quiet Voyage (1/scene)",
    body: "Action — while carrying a Soul, become temporarily insubstantial for up to your Initiation tier rounds. You can move through creatures and solid objects and cannot be targeted by attacks."
  },
  "wyrdlens-refraction-foresight-convergence-horizon": {
    type: "soma-break",
    label: "Convergence Horizon (1/Soma Break)",
    body: "Action — unfold a Convergence Horizon for 1 minute. Whenever a creature within 30 feet of you makes an attack roll, attribute check, or defense check, you may force it to be rerolled at advantage or disadvantage (your choice)."
  },
  "shared-dreamwork": {
    type: "soma-break",
    label: "Shared Dreamwork (1/Soma Break)",
    body: "Action — choose one willing creature within 30 feet. For 10 minutes you share a dreamspace: each may use the other's Insight or Empathy ranks for one check."
  },
  "shared-burden-harness": {
    type: "soma-break",
    label: "Shared Burden Harness (1/Soma Break)",
    body: "Reaction — when a creature you can see within 30 feet takes damage, take some of that damage onto yourself. Reduce their damage by your tier + Body modifier; you take that amount."
  },
  "stillheart_emotional_lock": {
    type: "soma-break", level: 14,
    label: "Stillheart: Emotional Lock (1/Soma Break, L14)",
    body: "Bonus action — freeze your current Burn level. It cannot increase or decrease until the end of your next turn. Your Aura cannot be forcibly changed during this period."
  },
  "coordinated-advance": {
    type: "soma-break",
    label: "Coordinated Advance (1/Soma Break)",
    body: "When you hit a creature with a weapon attack OR succeed on a key social check, choose one ally who can see or hear you within 30 feet. That ally may use their reaction to move up to half their speed without provoking opportunity attacks."
  },
  "auditor_forensic_audit": {
    type: "soma-break", level: 3,
    label: "Auditor: Forensic Audit (1/Soma Break)",
    body: "Action — mark a target Out of Compliance for this scene. While Out of Compliance, the target rolls 3d10 keep lowest 2 on attribute checks against you and your allies."
  },
  "dreamwalker-sapphire-blue-meridian": {
    type: "soma-break",
    label: "Blue Meridian (1/Soma Break)",
    body: "Action — open the Blue Meridian for 1 minute. You may teleport up to 30 feet as part of any movement or bonus action; you may pass through walls less than 5 feet thick."
  },

  // bbttcc-master-content.items feats (combat-pack)
  "bbttcc_feat_pressure_transference": {
    type: "soma-break",
    label: "Pressure Transference (1/Soma Break)",
    body: "Reaction — when you would take damage, give an ally within 10 ft reroll-lowest on their next roll before the end of their next turn (you still take the damage; the trade is the boon, not avoidance)."
  },
  "bbttcc_feat_threatening_silence": {
    type: "soma-break",
    label: "Threatening Silence (1/Soma Break)",
    body: "Bonus action — choose one creature that can see you within 30 ft. That creature rolls 3d10 keep lowest 2 on its next attack roll before the end of its next turn."
  },
  "bbttcc_feat_combat_intuition": {
    type: "info",
    label: "Combat Intuition (per-turn auto)",
    body: "Reaction — once per turn, when a creature within 5 feet of you misses an attack, make a melee weapon attack against it. (Auto per-turn — no debit; reaction slot still consumed.)"
  },
  "bbttcc_feat_last_ritual": {
    type: "soma-break",
    label: "Penultimate Rites — Last Ritual (1/Soma Break)",
    body: "Reaction — when a creature you can reach drops to 0 Integrity, stabilize it. It also gains temporary Integrity equal to your tier."
  },
  "bbttcc_feat_environmental_opportunist": {
    type: "info",
    label: "Environmental Opportunist (per-turn auto)",
    body: "Reaction — once per turn, when an enemy enters or leaves difficult terrain within your reach, make a melee attack against it. (Auto per-turn — no Soma Break debit; reaction slot still consumed.)"
  },
  "bbttcc_feat_backline_commander": {
    type: "soma-break",
    label: "Backline Commander (1/Soma Break)",
    body: "Bonus action — choose one ally who can see or hear you within 30 feet. That ally may immediately move up to 10 feet without provoking opportunity attacks."
  },
  "bbttcc_feat_spark_sense": {
    type: "soma-break",
    label: "Spark Sense (1/Soma Break)",
    body: "Action — focus on the unseen and learn one of: location of nearest active Spark / type and tier of nearest manifested form / surface emotional state of one creature you can see."
  },
  "bbttcc_feat_adaptive_defense": {
    type: "soma-break",
    label: "Adaptive Defense (1/Soma Break)",
    body: "Reaction — when you are hit by an attack you can see, reduce the damage by an amount equal to your skill rank bonus + your Violence modifier."
  },
  "bbttcc_feat_unbroken_guard": {
    type: "soma-break",
    label: "Unbroken Guard (1/Soma Break)",
    body: "Reaction — when a creature within 5 feet of you targets an ally with an attack, the attacker rolls 3d10 keep lowest 2 on that attack and you reduce the damage by your tier."
  },
};

// Compute character level from actor data, tolerating both fourththing and
// dnd5e shapes. Returns at least 1 even on missing data.
//   • fourththing: system.details.level is a plain number (e.g. 3)
//   • dnd5e:       system.details.level.value is the level
//   • last resort: sum of class-item system.levels
function _getActorLevel(actor) {
  const detRaw = actor?.system?.details?.level;
  if (typeof detRaw === "number" && detRaw > 0) return detRaw;
  const detVal = Number(detRaw?.value);
  if (Number.isFinite(detVal) && detVal > 0) return detVal;
  let sum = 0;
  for (const item of actor?.items ?? []) {
    if (item.type === "class") sum += Number(item.system?.levels ?? 0);
  }
  return sum > 0 ? sum : 1;
}

// Resolve the level requirement for an ability:
//   1. ab.level (explicit on sub-ability)
//   2. spec.level (explicit on top-level spec)
//   3. -t1/-t2/-t3/-t4 identifier suffix → 1 / 5 / 11 / 17
//   4. fallback: 1 (always available)
function _levelForAbility(id, spec, ab) {
  if (Number.isFinite(ab?.level)) return ab.level;
  if (Number.isFinite(spec?.level)) return spec.level;
  const m = (id ?? "").match(/-t([1-4])$/);
  if (m) return ({ "1": 1, "2": 5, "3": 11, "4": 17 })[m[1]];
  return 1;
}

// Body-text classifier — infers actionCost from the first words of `ab.body`
// when no explicit override is set. Designed for the CHAR_OPT_ABILITIES corpus
// where bodies usually open with "Reaction —", "Bonus action —", "Action —",
// or include "as a reaction" / "use your reaction" mid-sentence.
function _inferActionCostFromBody(body) {
  if (!body) return undefined;
  const s = String(body).trim();
  // Lead-token forms first — most reliable.
  if (/^reaction\s*[—\-:]/i.test(s))     return "reaction";
  if (/^bonus action\s*[—\-:]/i.test(s)) return "bonus";
  if (/^action\s*[—\-:]/i.test(s))       return "action";
  // Reaction-when prefixes.
  if (/^reaction\s+when\b/i.test(s))     return "reaction";
  // Mid-sentence forms.
  if (/\b(as a reaction|use your reaction|use a reaction)\b/i.test(s))         return "reaction";
  if (/\b(as a bonus action|use a bonus action|use your bonus action)\b/i.test(s)) return "bonus";
  if (/\b(as an action|use an action|use your action)\b/i.test(s))             return "action";
  return undefined;
}

// Per-turn action-economy gate. Returns true if the ability may fire (and
// debits the pool); false if it should abort. `cost` is one of:
//   "action" | "bonus" | "reaction" | "movement" | "free" | undefined
// Strategic-cadence abilities (strategic-turn, scenario, info) are out-of-combat
// and never gated. Movement is soft-warn only — it still fires.
async function _checkAndDebitActionEconomy(actor, ab) {
  let cost = ab?.actionCost;
  // Body-text inference (only when no explicit override).
  if (cost === undefined) cost = _inferActionCostFromBody(ab?.body);
  if (!cost || cost === "free" || cost === "none") return true;

  // Out-of-combat abilities don't touch the per-turn pool.
  const cadence = ab?.type;
  if (cadence === "strategic-turn" || cadence === "scenario" || cadence === "info") return true;

  // No active combat → don't gate. (Free play / narrative use.)
  if (!game.combat?.combatants?.find(c => c.actor?.id === actor.id)) return true;

  const sys = actor.system?.system ?? actor.system;
  const a   = sys?.actions ?? {};

  if (cost === "action") {
    if (a.actionUsed) {
      ui.notifications?.warn(`${ab.label}: action already used this turn.`);
      return false;
    }
    await actor.update({ "system.actions.actionUsed": true });
    return true;
  }
  if (cost === "bonus") {
    if (a.bonusUsed) {
      ui.notifications?.warn(`${ab.label}: bonus action already used this turn.`);
      return false;
    }
    await actor.update({ "system.actions.bonusUsed": true });
    return true;
  }
  if (cost === "reaction") {
    if (a.reactionUsed) {
      ui.notifications?.warn(`${ab.label}: reaction already used (refreshes at start of your turn).`);
      return false;
    }
    await actor.update({ "system.actions.reactionUsed": true });
    return true;
  }
  if (cost === "movement") {
    // Movement is tracked in feet on the token-update path. Firing a "movement"
    // ability is a flavor tag — no debit here, but log a small toast for clarity.
    ui.notifications?.info(`${ab.label}: counts as movement (track feet on the token side).`);
    return true;
  }
  return true;
}

// Internal: dispatch a single ability spec to the right helper.
// `key` is the flag-tracking key (composed of identifier[.subkey] for multi-ability).
// `requiredLevel` is enforced — if actor is below, a warning fires and the
// dialog does not open.
async function _dispatchSingleAbility(actor, ab, key, requiredLevel) {
  if (Number.isFinite(requiredLevel) && requiredLevel > 1) {
    const charLevel = _getActorLevel(actor);
    if (charLevel < requiredLevel) {
      ui.notifications.warn(`${ab.label}: locked — requires character level ${requiredLevel} (currently ${charLevel}).`);
      return null;
    }
  }
  // Per-turn action-economy gate. Aborts with a toast if the appropriate slot
  // is already spent. Strategic-cadence and out-of-combat use bypass the gate.
  const allowed = await _checkAndDebitActionEconomy(actor, ab);
  if (!allowed) return null;
  // Clarity-spend callback (null when ab has no `clarityCost`). Threaded
  // through the cadence helpers so the deduction happens atomically with the
  // use-flag burn and shows up on the chat card.
  const onUse = _makeClaritySpendCallback(ab);

  // 2026-05-20 — Per-key custom handlers. Most abilities flow through the
  // generic cadence dialogs below; abilities with mechanical effects that
  // exceed "track a use counter" branch here. Currently: Exo-Knight Shield
  // Projector (rolls 1d6+tier + heals targeted ally's Integrity).
  if (key === "circuitborn-exo-shield_projector") {
    return _openShieldProjector(actor, key, ab.label, ab.body);
  }

  switch (ab.type) {
    case "scene":
      return _openPerSceneAbility(actor, key, ab.label, ab.body, onUse);
    case "soma-break":
      return _openSomaBreakAbility(actor, key, ab.label, ab.body, onUse);
    case "soma-break-tier":
      return _openTierUsesPerSomaBreak(actor, key, ab.label, ab.body);
    case "strategic-turn":
      return _openPerCadenceAbility(actor, key, ab.label, ab.body, {
        flagNamespace: "strategicTurn",
        cadenceText: "on new Strategic Turn",
        resetLabel: "Reset (New Strategic Turn)"
      });
    case "scenario":
      return _openPerCadenceAbility(actor, key, ab.label, ab.body, {
        flagNamespace: "scenario",
        cadenceText: "at scenario end",
        resetLabel: "Reset (New Scenario)"
      });
    case "clarity-only":
      return _openClarityOnlyAbility(actor, key, ab.label, ab.body, onUse);
    case "info":
      return _openInfoOnlyAbility(actor, ab.label, ab.body);
    default:
      ui.notifications.error(`Unknown per-use type: ${ab.type}`);
      return null;
  }
}

// Generic multi-ability picker for subclass-style items that carry several
// per-use abilities at different levels. Locked rows are shown but greyed.
async function _openSubclassPicker(actor, title, abilities, idPrefix) {
  const charLevel = _getActorLevel(actor);

  const statusFor = (ab, i) => {
    const key = `${idPrefix}.${ab.key ?? i}`;
    let used = false;
    if (ab.type === "scene")          used = Boolean(actor.getFlag("fourththing", `scenePerUse.${key}`));
    else if (ab.type === "soma-break") used = Boolean(actor.getFlag("fourththing", `disciplineUsed.${key}`));
    else if (ab.type === "strategic-turn") used = Boolean(actor.getFlag("fourththing", `strategicTurn.${key}`));
    else if (ab.type === "scenario")  used = Boolean(actor.getFlag("fourththing", `scenario.${key}`));
    const cost = Number(ab.clarityCost ?? 0);
    const costTag = cost > 0 ? ` <span style="opacity:0.85">· <strong>${cost} Clarity</strong></span>` : "";
    if (ab.type === "clarity-only") {
      return `<b>${cost > 0 ? `${cost} Clarity per use` : "no cost"} — no per-rest cap</b>`;
    }
    if (ab.type === "info") return `<b>passive trigger / OP-cost — no tracking</b>`;
    return `<b>${used ? "SPENT" : "AVAILABLE"}</b>${costTag}`;
  };

  const cadenceLabel = (ab) => ({
    "scene": "1/scene",
    "soma-break": "1/Soma Break",
    "strategic-turn": "1/Strategic Turn",
    "scenario": "1/Scenario",
    "clarity-only": "Clarity-gated",
    "info": "passive / OP-cost"
  })[ab.type] ?? "";

  const rows = abilities.map((ab, i) => {
    const reqLevel = _levelForAbility(idPrefix, null, ab);
    const locked = charLevel < reqLevel;
    const lockBadge = locked
      ? `<span style="margin-left:0.35rem;padding:0.05rem 0.35rem;border-radius:0.2rem;background:rgba(120,40,40,0.55);color:#fbcaca;font-size:0.7rem;letter-spacing:0.04em;text-transform:uppercase">🔒 Lvl ${reqLevel}</span>`
      : "";
    const rowOpacity = locked ? "opacity:0.45" : "";
    return `
    <div style="margin-top:0.35rem;padding:0.45rem 0.6rem;background:rgba(60,40,75,0.32);border-radius:0.25rem;${rowOpacity}">
      <div style="font-size:0.85rem"><strong>${ab.label}</strong> <span style="opacity:0.7;font-size:0.74rem">(${cadenceLabel(ab)})</span>${lockBadge}</div>
      <div style="font-size:0.78rem;opacity:0.86;margin-top:0.15rem">${ab.body}</div>
      <div style="font-size:0.78rem;opacity:0.85;margin-top:0.2rem">Status: ${locked ? `<b>LOCKED — unlocks at level ${reqLevel}</b>` : statusFor(ab, i)}</div>
    </div>`;
  }).join("");

  const buttons = {};
  abilities.forEach((ab, i) => {
    const reqLevel = _levelForAbility(idPrefix, null, ab);
    if (charLevel < reqLevel) return; // omit locked rows from buttons
    const key = `${idPrefix}.${ab.key ?? i}`;
    buttons[`use_${i}`] = {
      label: `${ab.label}…`,
      callback: () => _dispatchSingleAbility(actor, ab, key, reqLevel)
    };
  });
  buttons.close = { label: "Close" };

  new Dialog({
    title,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.5rem;opacity:0.85">${title} — pick which per-use ability to invoke. Each tracks its own state. Locked rows unlock at the listed level.</p>
      ${rows}
    </div>`,
    buttons,
    default: "close"
  }).render(true);
}

export async function openCharOptAbility(actor, item) {
  const id = item?.system?.identifier ?? "";
  const spec = CHAR_OPT_ABILITIES[id];
  if (!spec) {
    ui.notifications.warn(`No per-use spec found for identifier: ${id}`);
    return null;
  }
  // Multi-ability subclass: show picker (handles locking internally)
  if (Array.isArray(spec.abilities) && spec.abilities.length) {
    return _openSubclassPicker(actor, spec.label ?? item.name, spec.abilities, id);
  }
  // Single ability: enforce level requirement before opening dialog
  const requiredLevel = _levelForAbility(id, spec, spec);
  return _dispatchSingleAbility(actor, spec, id, requiredLevel);
}

// Identifier → "char_opt_lookup" sentinel (one entry per item, populated below).
// Kept separate so it's clear which pack/category each id belongs to.
const CHAR_OPT_ROUTE = "char_opt_lookup";
for (const id of Object.keys(CHAR_OPT_ABILITIES)) {
  FEATURE_ROUTER[id] = CHAR_OPT_ROUTE;
}

export async function openWyrdlensTikkunSight(actor) {
  return _openSomaBreakAbility(actor, "wlTikkunSight", "Tikkun Sight",
    "Treat one of your misfires as if it had landed at base tier, and convert the Surge it would have spent into Clarity instead. (Nonviolent-scene rider: also wipes the Corruption tick the gather would have caused.)");
}

export async function openDreamwalkerSharedDream(actor) {
  return _openSomaBreakAbility(actor, "dwSharedDream", "Shared Dream",
    "Allies who Soma Break in your presence regain Clarity equal to half your tier (round up). 1/Soma Break you may explicitly invoke this to grant the bonus retroactively to the just-completed Soma Break.",
    // Grant ⌈tier/2⌉ Clarity to allied tokens (same disposition) within 30 ft.
    // Owner writes directly; non-owned allies go via GM relay (ft-grantClarity),
    // mirroring _ftCreateAllyAE. Caps at each ally's clarity max (non-casters
    // with no clarity track get nothing).
    async (a) => {
      const sys    = a.system?.system ?? a.system ?? {};
      const tier   = Math.max(1, Math.min(4, Number(sys?.details?.tier) || 1));
      const amount = Math.ceil(tier / 2);
      const selfTok = a.getActiveTokens?.()[0] ?? null;
      if (!selfTok) {
        ui.notifications?.warn("Shared Dream: place your token so presence (30 ft) can be measured.");
        return false;
      }
      const grid    = canvas?.dimensions?.size     || 100;
      const ftPerSq = canvas?.dimensions?.distance || 5;
      const ctr = (t) => ({ x: t.x + (t.w ?? grid) / 2, y: t.y + (t.h ?? grid) / 2 });
      const ftBetween = (t1, t2) => {
        const c1 = ctr(t1), c2 = ctr(t2);
        return Math.hypot(c1.x - c2.x, c1.y - c2.y) * (ftPerSq / grid);
      };
      const myDisp = selfTok.document?.disposition ?? 1;
      const granted = [];
      const hasGM = game.users?.some?.(u => u.isGM && u.active);
      for (const t of (canvas?.tokens?.placeables ?? [])) {
        if (!t?.actor || t.id === selfTok.id) continue;
        if ((t.document?.disposition ?? 0) !== myDisp) continue; // allies only (same side)
        if (ftBetween(selfTok, t) > 30) continue;
        const ally = t.actor;
        if (ally.isOwner) {
          const asys = ally.system?.system ?? ally.system ?? {};
          const cur  = Number(asys?.magic?.clarity?.value) || 0;
          const max  = Number(asys?.magic?.clarity?.max) || cur; // no track → no grant
          if (max > cur) { await ally.update({ "system.magic.clarity.value": Math.min(max, cur + amount) }); granted.push(ally.name); }
        } else if (hasGM) {
          game.socket?.emit?.("system.fourththing", { t: "ft-grantClarity", actorId: ally.id, amount });
          granted.push(`${ally.name} (relayed)`);
        }
      }
      return `<p style="font-size:0.75rem;color:#c8a0ff;margin:0.2rem 0 0">${granted.length ? `+${amount} Clarity to: ${_ftEscape(granted.join(", "))}.` : "No allies within 30 ft to share the dream with."}</p>`;
    });
}

// Pactkeeper — Ledger Day (Initiation 16). 1/Soma Break: transfer ONE of your
// sustained manifestations to a willing ally; the ally's `activeManifestations`
// flag grows the entry, yours shrinks. Upkeep ticks bill from whoever holds
// the entry, so the move is real and immediate. Tier-16 gate enforced by GM at
// the table (we don't read tier on Pactkeeper directly — Init 16 = char level 16+).
export async function openPactkeeperLedgerDay(actor) {
  const used = Boolean(actor.getFlag("fourththing", "disciplineUsed.pkLedgerDay"));
  const active = actor.getFlag("fourththing", "activeManifestations") ?? [];
  // Eligible recipients: PC actors other than self that the current user can see.
  const allies = (game.actors?.contents ?? []).filter(a =>
    a.id !== actor.id && a.type === "character" && a.testUserPermission?.(game.user, "OBSERVER")
  );

  if (!active.length) {
    return ui.notifications?.warn(`${actor.name}: no sustained manifestations to transfer.`);
  }

  const manifOptions = active.map(e =>
    `<option value="${e.instanceId}">${_ftEscape(e.itemName)} (T${e.tier}, ${_ftEscape(e.stability || "sustained")}${e.pactBound ? ", pact-bound" : ""})</option>`
  ).join("");
  const allyOptions = allies.length
    ? allies.map(a => `<option value="${a.id}">${_ftEscape(a.name)}</option>`).join("")
    : `<option value="">(no eligible allies found)</option>`;

  new Dialog({
    title: "Pactkeeper — Ledger Day (Initiation 16)",
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;margin:0 0 0.4rem">Status: <b>${used ? "SPENT — refresh on Soma Break" : "AVAILABLE (1/Soma Break)"}</b></p>
      <p style="font-size:0.76rem;opacity:0.8;margin:0 0 0.5rem">Transfer one of your sustained manifestations to a willing ally. They pick up upkeep from their Clarity from that point on. The pact moves with the paper, not the person who originally signed.</p>
      <div class="ft-cast-field">
        <label>Manifestation to transfer</label>
        <select name="manif">${manifOptions}</select>
      </div>
      <div class="ft-cast-field">
        <label>Recipient (willing ally)</label>
        <select name="ally" ${allies.length ? "" : "disabled"}>${allyOptions}</select>
      </div>
    </div>`,
    buttons: {
      transfer: {
        label: used ? "(already spent)" : "Transfer",
        callback: async (html) => {
          if (used) {
            return ui.notifications?.warn("Ledger Day already spent — reset on Soma Break.");
          }
          const instanceId = html.find("[name='manif']").val();
          const allyId     = html.find("[name='ally']").val();
          if (!allyId) return ui.notifications?.warn("Pick a recipient.");
          const ally = game.actors.get(allyId);
          if (!ally) return ui.notifications?.warn("Recipient not found.");
          const entry = active.find(e => e.instanceId === instanceId);
          if (!entry) return ui.notifications?.warn("Manifestation not found.");

          // Move the entry: append to ally's list, remove from self.
          const allyActive = ally.getFlag("fourththing", "activeManifestations") ?? [];
          const transferred = { ...entry, transferredFrom: actor.uuid, transferredAt: Date.now() };
          await ally.setFlag("fourththing", "activeManifestations", [...allyActive, transferred]);
          await actor.setFlag("fourththing", "activeManifestations", active.filter(e => e.instanceId !== instanceId));
          await actor.setFlag("fourththing", "disciplineUsed.pkLedgerDay", true);

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="fourththing-roll" style="border-color:#5a5a8a">
              <div class="ft-roll-header"><span class="ft-roll-name" style="color:#a0a8e0">📜 Ledger Day — ${_ftEscape(actor.name)}</span></div>
              <p style="margin:0.3rem 0;font-size:0.82rem"><b>${_ftEscape(entry.itemName)}</b> (T${entry.tier}) transferred to <b>${_ftEscape(ally.name)}</b>.</p>
              <p style="margin:0.2rem 0;font-size:0.76rem;opacity:0.8">From this point on, upkeep ticks bill from ${_ftEscape(ally.name)}'s Clarity. The pact moves with the paper.</p>
              <p style="margin:0.2rem 0 0;font-size:0.7rem;opacity:0.55">1/Soma Break — resets when ${_ftEscape(actor.name)} takes their next Soma Break.</p>
            </div>`
          });
        }
      },
      reset: {
        label: "Reset (Soma Break)",
        callback: async () => {
          await actor.setFlag("fourththing", "disciplineUsed.pkLedgerDay", false);
          ui.notifications?.info(`${actor.name}: Ledger Day reset.`);
        }
      },
      close: { label: "Close" }
    },
    default: used ? "close" : "transfer"
  }).render(true);
}

// ─── Legacy handler → actionCost map ──────────────────────────────────────────
// Action costs for the pre-CHAR_OPT_ABILITIES handlers below. CHAR_OPT entries
// declare `actionCost` directly on the spec; legacy ones resolve through this
// table. Omit any handler that's a passive/info card or out-of-combat use.
const LEGACY_ACTION_COST = {
  // Aurablade
  "aurablade_action":           "action",      // melee strike
  "aurablade_burn":             "bonus",       // ignite/extinguish
  "aurablade_change_aura":      "bonus",
  "aurablade_stabilize":        "bonus",
  // Titanbound / Bulwark / Shadowjack — frame/access spends are bonus by canon
  "titanbound_spend":           "bonus",
  "bulwark_spend_frame":        "bonus",
  "bulwark_stance":             "bonus",
  "shadowjack_spend":           "bonus",
  "shadow_courier_spend_access":"bonus",
  // Cosmic Linguist / Wyrdlens / Dreamwalker / Pactkeeper
  "cosmic_linguist_authority":  "action",
  "cosmic_linguist_annotation": "bonus",
  "pactkeeper_renegotiate":     "free",
  "pactkeeper_pick_l1_skills":  "free",
  "dreamwalker_resonance":      "bonus",
  // Mode toggles — bonus action stance switch
  "cl_mode_sentence":           "bonus",
  "wl_mode_refraction":         "bonus",
  "dw_mode_walking_lane":       "bonus",
  "pk_mode_sealed_pact":        "bonus",
  // Soul Smith / Shadow Courier package use
  "soul_smith_forge":               "action",   // legacy combined router
  "soul_smith_forge_initiate":      "free",     // T1 — narrative + grant button
  "soul_smith_atonement_crucible":  "action",   // T2 — once per arc, deliberate work
  "soul_smith_furnace_of_renewal":  "free",     // T3 — passive info + rest narration
  "soul_smith_relic_of_rebirth":    "action",   // T4 — one-per-use artifact creation
  // Harmony Marshal — canon-aligned (Phase 1.5)
  "harmony_marshal_initiate":           "free",       // T1 — narrative + grant button
  "harmony_marshal_attrition_easer":    "free",       // T2 — strategic-layer (no tactical action)
  "harmony_marshal_loyalty_steward":    "free",       // T3 — manual application after Diplomacy success
  "harmony_marshal_unity_conductor":    "free",       // T4 — passive surface
  "harmony_marshal_rallying_words":     "bonus",      // tactical surface — bonus action
  "shadow_courier_package":     "action",
  "shadow_courier_crossing":    "action",
  // Phase 1 ancestry cores — single-fire reactions / soma-break
  "scion_sefirot_attunement":   "reaction",
  "echo_diver_temporal_flinch": "reaction",
  // Phase 2 — heritage uniques (most are "as a bonus" / "as a reaction" by body)
  "menhirkin_igneous_picker":   "reaction",
  "oldenborn_phoenix_oath":     "reaction",
  "oldenborn_sun_scar":         "action",
  "furrykin_predator_patience": "bonus",
  // Phase 3 — multi-pickers and stormborn ward
  "stormborn_ward_of_the_gale": "reaction",
  // Pools / passives / info → no gate (return free)
  "titanbound_pool":            "free",
  "bulwark_frame_pool":         "free",
  "shadowjack_pool":            "free",
  "shadow_courier_access_pool": "free",
  "breaker_ruin":               "free",
  "bulwark_ruin":               "free",
  "passive_info":               "free",
  "dreamwalker_deploy_cache":   "free",
  "pactkeeper_bind_subject":            "free",
  "counter_manifestation":              "action",
  "dream_echo_reservoir":               "free",
  "dream_echo_reservoir_spend":         "reaction",
  "dw_feat_activate":                   "free",
  "shadow_courier_passive":     "free",
  "menhirkin_hex_recognition":  "free",
  "qliph_qliphothic_saturation":"free",
  "oldenborn_rustland_patch":   "free",
  "oldenborn_hearth_dominion":  "free",
  "circuitborn_abilities_picker":"free", // multi-picker — gates fire on inner pick
  "human_abilities_picker":     "free",
  "cl_word_that_was":           "action",
  "wl_tikkun_sight":            "free",     // narrative refund
  "dw_shared_dream":            "free",     // post-Soma-Break
  "pk_ledger_day":              "free",     // narrative transfer
};

// ─── Main dispatch function ───────────────────────────────────────────────────

export async function dispatchFeatureAction(actor, item) {
  const handler = routeFeature(item);
  if (!handler) return null; // not an automated feature

  // Per-turn action-economy gate for legacy (non-CHAR_OPT) handlers. CHAR_OPT
  // entries gate inside _dispatchSingleAbility; this catches everything else.
  if (handler !== "char_opt_lookup") {
    const cost = item?.flags?.fourththing?.actionCost ?? LEGACY_ACTION_COST[handler];
    if (cost) {
      const allowed = await _checkAndDebitActionEconomy(actor, {
        label: item?.name ?? handler,
        actionCost: cost
      });
      if (!allowed) return null;
    }
  }

  switch (handler) {
    // === Legacy Titanbound/Shadowjack/Breaker handlers (kept) ===
    case "titanbound_spend":       return openSpendFrameDie(actor);
    case "titanbound_pool":        return openFrameDiePool(actor);
    case "titanbound_stress":      return openFrameDiePool(actor);
    case "shadowjack_spend":       return openSpendAccessDie(actor);
    case "shadowjack_pool":        return openAccessPool(actor);
    case "breaker_ruin":           return openBreakerRuin(actor);
    // === Existing classes ===
    case "aurablade_action":       return openAurabladeAction(actor);
    case "aurablade_burn":         return openBurnState(actor);
    case "aurablade_change_aura":  return openChangeAura(actor);
    case "aurablade_stabilize":    return openStabilizeBurn(actor);
    case "dreamwalker_resonance":  return openDreamwalkerResonance(actor);
    case "dreamwalker_deploy_cache": return openDreamwalkerDeployCache(actor);
    case "dream_echo_reservoir":       return openDreamwalkerEchoReservoir(actor);
    case "dream_echo_reservoir_spend": return openDreamwalkerSpendEchoDie(actor);
    case "dw_feat_activate":           return openDreamwalkerFeatActivate(actor, item);
    // Soul-Smith — canon-aligned (Phase 1.5): one handler per tier feature
    case "soul_smith_forge_initiate":      return openSoulSmithForgeInitiate(actor);
    case "soul_smith_atonement_crucible":  return openSoulSmithAtonementCrucible(actor);
    case "soul_smith_furnace_of_renewal":  return openSoulSmithFurnaceOfRenewal(actor);
    case "soul_smith_relic_of_rebirth":    return openSoulSmithRelicOfRebirth(actor);
    // Legacy combined router — dispatches to the right tier handler.
    case "soul_smith_forge":               return openSoulSmithForge(actor);
    // Harmony Marshal — canon-aligned (Phase 1.5): one handler per tier feature
    case "harmony_marshal_initiate":          return openHarmonyMarshalInitiate(actor);
    case "harmony_marshal_attrition_easer":   return openHarmonyMarshalAttritionEaser(actor);
    case "harmony_marshal_loyalty_steward":   return openHarmonyMarshalLoyaltySteward(actor);
    case "harmony_marshal_unity_conductor":   return openHarmonyMarshalUnityConductor(actor);
    case "harmony_marshal_rallying_words":    return openHarmonyMarshalRallyingWords(actor);
    // === Passive / info dialogs ===
    case "passive_info":           return openPassiveClassInfo(actor, item);
    case "shadow_courier_passive": return openShadowCourierPassive(actor, item);
    // === SPRINT F: NEW CLASSES ===
    // Bulwark
    case "bulwark_spend_frame":    return openBulwarkSpendFrame(actor);
    case "bulwark_frame_pool":     return openBulwarkFramePool(actor);
    case "bulwark_ruin":           return openBulwarkRuin(actor);
    case "bulwark_stance":         return openBulwarkStance(actor);
    // Shadow Courier (Pace pool replaces legacy Access Dice — no spend/pool dialogs)
    case "shadow_courier_package":      return openShadowCourierPackage(actor);
    case "shadow_courier_crossing":     return openShadowCourierCrossing(actor);
    case "shadow_courier_spend_access": return openShadowCourierSpendPace(actor);  // 2026-05-20: Pace spend (replaces legacy Access Dice)
    case "shadow_courier_access_pool":  return openShadowCourierSpendPace(actor);  // legacy alias — same Pace dialog
    // Cosmic Linguist
    case "cosmic_linguist_authority":   return openCosmicLinguistAuthority(actor);
    case "cosmic_linguist_annotation":  return openCosmicLinguistAnnotation(actor);
    // Pactkeeper — canon-aligned: Bargain / Renegotiate / Sealed Pact / Ledger Day / L1 skill pick
    case "pactkeeper_bind_subject":     return openPactkeeperBindSubject(actor);
    case "pactkeeper_renegotiate":      return openPactkeeperRenegotiate(actor);
    case "pactkeeper_pick_l1_skills":   return openPactkeeperPickL1Skills(actor);
    case "counter_manifestation":       return openCounterManifestation(actor);
    // === Caster Discipline pilot 2026-04-27 ===
    case "cl_mode_sentence":            return openCosmicLinguistMode(actor);
    case "wl_mode_refraction":          return openWyrdlensMode(actor);
    case "dw_mode_walking_lane":        return openDreamwalkerMode(actor);
    case "pk_mode_sealed_pact":         return openPactkeeperMode(actor);
    case "cl_word_that_was":            return openCosmicLinguistWordThatWas(actor);
    case "wl_tikkun_sight":             return openWyrdlensTikkunSight(actor);
    case "dw_shared_dream":             return openDreamwalkerSharedDream(actor);
    case "pk_ledger_day":               return openPactkeeperLedgerDay(actor);
    // === End Sprint F ===

    // === Buried per-use abilities — Phase 1: Ancestry cores (2026-04-27) ===
    case "menhirkin_hex_recognition":   return openMenhirkinHexRecognition(actor);
    case "echo_diver_temporal_flinch":  return openEchoDiverTemporalFlinch(actor);
    case "scion_sefirot_attunement":    return openSephirotScionAttunement(actor);
    case "qliph_qliphothic_saturation": return openQliphScarredSaturation(actor);

    // === Phase 2: Heritage-unique + ancestry feats (2026-04-27) ===
    case "menhirkin_igneous_picker":    return openMenhirkinIgneousPicker(actor);
    case "oldenborn_rustland_patch":    return openOldenbornRustlandPatch(actor);
    case "furrykin_predator_patience":  return openFurrykinPredatorPatience(actor);
    case "oldenborn_phoenix_oath":      return openOldenbornPhoenixOath(actor);
    case "oldenborn_hearth_dominion":   return openOldenbornHearthDominion(actor);
    case "oldenborn_sun_scar":          return openOldenbornSunScar(actor);

    // === Phase 3: Species multi-ability pickers (2026-04-27) ===
    case "circuitborn_abilities_picker": return openCircuitbornAbilities(actor);
    case "human_abilities_picker":       return openHumanAbilities(actor);
    case "stormborn_ward_of_the_gale":   return openStormbornWardOfTheGale(actor);

    // === Phase 4: Character options (data-driven via CHAR_OPT_ABILITIES) ===
    case "char_opt_lookup":              return openCharOptAbility(actor, item);

    default:                       return null;
  }
}
