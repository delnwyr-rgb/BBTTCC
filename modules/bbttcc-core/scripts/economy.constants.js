/* modules/bbttcc-core/scripts/economy.constants.js — THE OP-ECONOMY CONSTANTS TABLE
 * (fix-the-boat item 5, owner 2026-09-12). Every number the economy engines tune lives HERE and
 * nowhere else; owners ES-import it (`import { … } from "/modules/bbttcc-core/scripts/economy.constants.js"`),
 * bin/ft-sim-economy parses it, CAPABILITIES.md points at it, and bin/ft-lint-facts (F6) fails any
 * other file that defines one of these tables. Accessors (facts) live with their owners:
 * facts.faction in bbttcc-factions/op-engine.js, facts.hex in bbttcc-territory/main.js.
 * Units: marks everywhere (1 OP = 10 marks — the ratio itself is the SYSTEM's: rfi-pricing.js).
 * Gear / creature / rig pricing also stays in the system's rfi-pricing.js.
 */

// ── faction tiers ──────────────────────────────────────────────────────────────────────────────
export const TIER_CAP_BAND_MARKS = [50, 70, 90, 110, 130];            // T0..T4, per bucket
export const LOGISTICS_CAPACITY_FLOOR_MARKS = [70, 70, 90, 110, 130];  // owner ruling 2026-09-12: capacity never reads below the T1 band

// ── strategic activity price policy (ruling B, 2026-09-11) ─────────────────────────────────────
export const PRICE_MULT = 0.75;   // every strategic row, travel leg, siege muster and the raid staged bonus × this
export const RECIPES = {          // alternate fuels — "how the faction got it done" (fx land via turn-driver applyRecipeSideEffects)
  establish_outpost: [
    { label:"hired labour",       cost:{ economy:20, logistics:10 } },
    { label:"work gang",          cost:{ violence:20, logistics:10 },   note:"pressed labour under guard",     fx:{ hex:{ loyaltyDelta:-2 }, faction:{ darknessDelta:1 } } },
    { label:"pilgrim settlers",   cost:{ faith:15, softpower:10 },      note:"slower, but they came to stay", days:1, fx:{ hex:{ loyaltyDelta:1 }, faction:{ moraleDelta:1 } } },
    { label:"surveyor's gambit",  cost:{ intrigue:15, logistics:10 },   note:"a claim nobody saw filed",       fx:{ hex:{ loyaltyDelta:-1, darknessDelta:1 } } }
  ],
  establish_trade_route: [
    { label:"bought caravan",     cost:{ economy:30, diplomacy:10, logistics:10 } },
    { label:"treaty road",        cost:{ diplomacy:30, culture:10, logistics:10 }, fx:{ hex:{ loyaltyDelta:1 } } },
    { label:"smugglers' run",     cost:{ intrigue:25, economy:10, logistics:10 }, note:"quiet, and it knows it",     fx:{ hex:{ darknessDelta:1 }, faction:{ darknessDelta:1 } } },
    { label:"festival circuit",   cost:{ culture:25, diplomacy:10, logistics:10 }, note:"the road follows the music", fx:{ hex:{ moraleDelta:1 }, faction:{ moraleDelta:1 } } }
  ],
  integration_framework: [
    { label:"diplomatic envoys",  cost:{ diplomacy:10, softpower:10 } },
    { label:"mission houses",     cost:{ faith:10, culture:10 },         fx:{ hex:{ loyaltyDelta:1 } } },
    { label:"paid administrators",cost:{ economy:15, nonlethal:5 },      note:"bought loyalty is thin",         fx:{ hex:{ loyaltyDelta:-1 } } },
    { label:"whisper network",    cost:{ intrigue:15, nonlethal:5 },    note:"everyone belongs, or else",      fx:{ hex:{ loyaltyDelta:1 }, faction:{ darknessDelta:1 } } }
  ],
  optact_integration_framework: [
    { label:"diplomatic envoys",  cost:{ diplomacy:10, softpower:10 } },
    { label:"mission houses",     cost:{ faith:10, culture:10 },         fx:{ hex:{ loyaltyDelta:1 } } },
    { label:"paid administrators",cost:{ economy:15, nonlethal:5 },      note:"bought loyalty is thin",         fx:{ hex:{ loyaltyDelta:-1 } } },
    { label:"whisper network",    cost:{ intrigue:15, nonlethal:5 },    note:"everyone belongs, or else",      fx:{ hex:{ loyaltyDelta:1 }, faction:{ darknessDelta:1 } } }
  ],
  develop_outpost_stability: [
    { label:"garrison & grants",  cost:{ diplomacy:20, economy:10 } },
    { label:"show of force",      cost:{ violence:20, nonlethal:10 },    note:"quiet, not calm",               fx:{ hex:{ loyaltyDelta:-2 }, faction:{ darknessDelta:1 } } },
    { label:"festival of belonging", cost:{ culture:20, softpower:10 }, fx:{ hex:{ moraleDelta:2, loyaltyDelta:1 } } }
  ],
  upgrade_outpost_settlement: [
    { label:"charter & works",    cost:{ economy:30, softpower:20, logistics:20 } },
    { label:"festival founding",  cost:{ culture:30, faith:20, logistics:20 }, fx:{ hex:{ loyaltyDelta:1 }, faction:{ moraleDelta:2 } } }
  ]
};
export const LEDGER_DAY_COST = {   // world-clock days a planned activity funds from the month's unspent days
  develop_infrastructure_std: 3, infrastructure_expansion: 3, establish_outpost: 3, upgrade_outpost_settlement: 3,
  develop_outpost_stability: 2, establish_supply_line: 2, establish_trade_route: 2
};

// ── hex identity → yield ladder ────────────────────────────────────────────────────────────────
export const TYPE_BASE = {
  settlement:{food:2, materials:1, trade:3, military:0, knowledge:0},
  fortress:  {food:0, materials:3, trade:1, military:4, knowledge:0},
  mine:      {food:0, materials:5, trade:2, military:0, knowledge:0},
  farm:      {food:5, materials:1, trade:2, military:0, knowledge:0},
  port:      {food:2, materials:2, trade:4, military:0, knowledge:0},
  factory:   {food:0, materials:4, trade:3, military:0, knowledge:0},
  research:  {food:0, materials:1, trade:1, military:0, knowledge:4},
  temple:    {food:1, materials:1, trade:1, military:0, knowledge:2},
  // wilderness (owner ruling 2026-09-12): a wild claim yields LESS than a settlement — before this
  // row the lookup fell through to `settlement`, so a wild outpost paid 1/1/2 like a planned one.
  // At outpost ×0.5 → 1 food / 1 materials / 1 trade (Math.round); upgrade_outpost_settlement is the
  // road to the settlement ladder.
  wilderness:{food:1, materials:1, trade:1, military:0, knowledge:0},
  wasteland: {food:0, materials:1, trade:0, military:0, knowledge:0},
  ruins:     {food:0, materials:2, trade:0, military:0, knowledge:1}
};
export const SIZE_MULT = { none: 0, outpost: 0.5, village: 0.75, town: 1, city: 1.5, metropolis: 2, megalopolis: 3 };
/** production modifiers: mAll (all resources) and mTrade (trade only) — fractions, applied as ×(1+v) */
export const MOD_PRODUCTION = {
  "well-maintained": 0.25, "strategic position": 0.10, "loyal population": 0.15, "contaminated": -0.50,
  "damaged infrastructure": -0.25, "hostile population": -0.25, "difficult terrain": -0.10, "radiation zone": -0.75,
  "supply line vulnerable": -0.15,
  "red thread field": 0.10,              // Lyrenn Act 2 reframe (owner ruling 2026-09-13): specialty crop, a holding
  "harmonized grove": 0.05               // The Forest of Early Tiphareth accepts you (owner ruling 2026-09-13)
};
export const MOD_TRADE = { "trade hub": 0.50 };
/** per-RESOURCE production modifiers (fractions, ×(1+v) on that resource only) — 2026-09-13 */
export const MOD_RESOURCE = {
  "fallout bloom": { food: -0.50 }        // "That One Night": the rows went wild — wild isn't yield. Lifts at Red Thread planting.
};
/** lane bonus by hex MODIFIER (LANE_HEX_BONUS.<lane>.byModifier) is DOUBLED on a hex whose leyline flow is `surge` */
export const LANE_BY_MODIFIER_SURGE_MULT = 2;
/** hex loyalty score contributions by modifier (facts.hex.loyaltyScore) */
export const HEX_MOD_LOYALTY = { "loyal population": 2, "hostile population": -2, "well-maintained": 1, "well maintained": 1, "damaged infrastructure": -1, "harmonized grove": 1 };

// ── hex STATES (2026-09-13, owner ask: "a place in the beat to apply generic states, and unique states") ──
/** Generic states — THE list the Hex Config grid and the Beat Editor render (was twelve hand-typed labels in the template). */
export const HEX_MODIFIER_CATALOG = [
  { name:"Well-Maintained",        effect:"+25% production, +1 loyalty" },
  { name:"Fortified",              effect:"+3 defense" },
  { name:"Strategic Position",     effect:"+10% production; adjacency anchor" },
  { name:"Hidden Resources",       effect:"stable bonus to one resource" },
  { name:"Loyal Population",       effect:"+15% production, +2 loyalty" },
  { name:"Trade Hub",              effect:"+50% trade" },
  { name:"Contaminated",           effect:"−50% production" },
  { name:"Damaged Infrastructure", effect:"−25% production, −1 loyalty" },
  { name:"Hostile Population",     effect:"−25% production, −2 loyalty" },
  { name:"Supply Line Vulnerable", effect:"−15% production" },
  { name:"Difficult Terrain",      effect:"−10% production" },
  { name:"Radiation Zone",         effect:"−75% production" }
];
/** Unique states — a World Modifier row (the chip on the hex sheet) carries these named modifiers into the yield engine's list. */
export const WORLD_MODIFIERS = {
  harmonized_grove: { label:"Harmonized Grove",  description:"The Forest of Early Tiphareth accepts you: +5% production, +1 loyalty on this hex. Adjacency bonus reserved for the adjacency engine.", modifiers:["Harmonized Grove"], adjacency:true },
  fallout_bloom:    { label:"Fallout Bloom",     description:"The rows went wild after that one night: food ×0.5, nothing else touched. Lifts when the Red Thread is planted.", modifiers:["Fallout Bloom"] },
  red_thread_field: { label:"Red Thread Field",  description:"A stand of red-thread crop, awake: +10% production, +1 faith/turn (×2 on a leyline surge).", modifiers:["Red Thread Field"] }
};

// ── resources → OP income (per hex per turn; culture + faith lanes ruled 2026-09-12) ──────────
export const RES_TO_OP = {
  economy:  {food:0.5, materials:0.8, trade:1.0, military:0.1, knowledge:0.25},
  violence: {food:0.1, materials:0.2, trade:0.2, military:0.8, knowledge:0.0},
  nonLethal:{food:0.2, materials:0.1, trade:0.2, military:0.5, knowledge:0.3},
  intrigue: {food:0.0, materials:0.1, trade:0.5, military:0.1, knowledge:1.0},
  diplomacy:{food:0.2, materials:0.0, trade:0.6, military:0.0, knowledge:0.4},
  softPower:{food:0.2, materials:0.0, trade:0.5, military:0.0, knowledge:0.3},
  culture:  {food:0.1, materials:0.0, trade:0.3, military:0.0, knowledge:0.5},
  faith:    {food:0.1, materials:0.0, trade:0.0, military:0.0, knowledge:0.5}
};
export const LEY_FLOW_MULT = { normal: 1.0, turbulence: 0.9, surge: 1.3, stagnation: 0.6, inversion: 1.0 };
export const LANE_HEX_BONUS = {   // per-type / per-size / per-stationed-facility (name-keyed) bonuses for the two lanes
  culture: { byType: { research:1, city:2, port:1, settlement:1, temple:1 }, bySize: { outpost:0, village:0.5, town:1, city:2, metropolis:3, megalopolis:4 }, byFacility: { theatre:2, theater:2, library:2, hall:1, festival:1 }, byModifier: {} },
  faith:   { byType: { temple:3, ruins:1 },                                    bySize: { outpost:0, village:0.5, town:1, city:1.5, metropolis:2, megalopolis:3 }, byFacility: { temple:3, shrine:2, chapel:2, church:2 }, byModifier: { "red thread field": 1 } }
};

// ── logistics pressure (turn-driver computeLogisticsPressureForFaction) ─────────────────────────
export const LOGI = Object.freeze({
  DEMAND_TERRITORY_PER_HEX: 1.0, DEMAND_SHORT_PER_HEX: 1.0, DEMAND_OCCUPATION_PER_HEX: 2.0,
  DEMAND_DISTANCE_PER_STEP: 0.5, DEMAND_CITY_PER_HEX: 1.0, DEMAND_SPECIAL_PER_HEX: 0.5, DEMAND_RIG_PER_ACTIVE: 0.5,
  SPRAWL_THRESHOLD: 4, SPRAWL_EXP: 2, SPRAWL_MULT: 0.25,
  CAPACITY_PER_LOGISTICS_OP: 1.0, CAPACITY_PER_TRADEPAIR: 1.0, CAPACITY_PER_TRADEROUTE: 0.5,
  CAPACITY_FULL_INTEG_PER_HEX: 0.5, CAPACITY_INFRA_DEPOT: 1.0, CAPACITY_INFRA_MAJORPORT: 1.0, CAPACITY_INFRA_ROADNET: 0.5,
  CAPACITY_INFRA_SUPPLYLINE: 0.5, CAPACITY_LOGI_RIG: 0.5
});

// ── garrison upkeep (territory-garrison-upkeep.enhancer) ───────────────────────────────────────
export const UPKEEP = {
  BASE_BY_TYPE: {
    fortress:   { military: 10, logistics: 10 }, port: { logistics: 10, diplomacy: 5 }, temple: { faith: 10, diplomacy: 5 },
    farm:       { logistics: 5, economy: 5 },   mine: { economy: 10 },                research: { economy: 5, intrigue: 5 },
    settlement: { logistics: 5, diplomacy: 5, economy: 5 }, city: { logistics: 10, diplomacy: 10, economy: 10 },
    ruins:      { intrigue: 10, nonlethal: 5, economy: 5 },
    default:    { economy: 5, diplomacy: 3, nonlethal: 2 }
  },
  PHASE_MULT: { occupation: 0.75, short_integration: 1.0, full_integration: 0.3 },   // occupation was 1.5 — ruling B 2026-09-11
  SIZE_MULT: { outpost: 0.5, village: 0.75, town: 1.0, city: 1.5, metropolis: 2.0, megalopolis: 3.0 },
  STATUS_MULT: { unclaimed: 0, contested: 0.75, occupied: 1.0, claimed: 1.0, scorched: 1.0, triumphant: 1.1 },
  OUTCOME_MULT: { justice_reformation: 0.7, liberation: 0.8, best_friends_integration: 0.5, retribution_subjugation: 1.3, salt_the_earth: 0.0 },
  EASE_MULT: { very_easy: 0.7, easy: 0.85, normal: 1.0, hard: 1.2 },
  MOD_MULT: { "Well-Maintained": 0.9, "Well Maintained": 0.9, "Fortified": 1.1, "Trade Hub": 1.05, "Damaged Infrastructure": 1.2, "Radiation Zone": 1.3, "Cultural Festival": 0.9, "Supply Line": 0.95, "Logistics Hub": 1.05, "Diplomatic Ties": 0.95 },
  COND_MULT: { "Radiated": 1.3, "Purified": 0.9, "Unstable": 1.1, "Sanctified": 0.9 },
  HOSTILITY_MULT: 1.25, LOYALTY_MULT: 0.85,
  INTEGRATION_BONUS: { short: 1, full: 2 }   // morale + loyalty per paid hex
};

// ── travel (hex-travel TERRAIN_TABLE; PRICE_MULT applies at leg creation) ──────────────────────
export const TERRAIN_TABLE = {
  "plains":        { cost: { economy:10 }, tier:1, bias:"balanced" },
  "grasslands":    { cost: { economy:10 }, tier:1, bias:"balanced" },
  "forest":        { cost: { economy:10, intrigue:10 }, tier:2, bias:"hazard" },
  "jungle":        { cost: { economy:10, intrigue:10 }, tier:2, bias:"hazard" },
  "mountains":     { cost: { economy:20, logistics:10 }, tier:3, bias:"hazard" },
  "highlands":     { cost: { economy:20, logistics:10 }, tier:3, bias:"hazard" },
  "canyons":       { cost: { economy:10, violence:10 }, tier:2, bias:"combat" },
  "badlands":      { cost: { economy:10, violence:10 }, tier:2, bias:"combat" },
  "swamp":         { cost: { economy:20, nonLethal:10 }, tier:3, bias:"hazard" },
  "mire":          { cost: { economy:20, nonLethal:10 }, tier:3, bias:"hazard" },
  "desert":        { cost: { economy:20 }, tier:2, bias:"discovery" },
  "ashWastes":     { cost: { economy:20 }, tier:2, bias:"discovery" },
  "river":         { cost: { economy:10, logistics:10 }, tier:1, bias:"discovery", medium:"water", depthBand:"surface" },
  "lake":          { cost: { economy:10, logistics:10 }, tier:1, bias:"discovery", medium:"water", depthBand:"surface" },
  "sea":           { cost: { economy:30, logistics:20 }, tier:4, bias:"discovery", medium:"water", depthBand:"surface" },
  "ocean":         { cost: { economy:30, logistics:20 }, tier:4, bias:"discovery", medium:"water", depthBand:"surface" },
  "reef":          { cost: { economy:20, logistics:10 }, tier:2, bias:"discovery", medium:"water", depthBand:"reef" },
  "depths":        { cost: { economy:30, logistics:20 }, tier:3, bias:"hazard",    medium:"water", depthBand:"deep" },
  "abyss":         { cost: { economy:40, logistics:20 }, tier:4, bias:"extreme",   medium:"water", depthBand:"abyss" },
  "sky":           { cost: { economy:10, logistics:10 }, tier:2, bias:"discovery", medium:"air",   altBand:"sky" },
  "stratosphere":  { cost: { economy:20, logistics:20 }, tier:3, bias:"hazard",    medium:"air",   altBand:"stratosphere" },
  "orbit":         { cost: { economy:40, logistics:30 }, tier:4, bias:"extreme",   medium:"space", altBand:"orbit" },
  "ruins":         { cost: { economy:10, intrigue:10 }, tier:2, bias:"mix" },
  "urbanWreckage": { cost: { economy:10, intrigue:10 }, tier:2, bias:"mix" },
  "wasteland":     { cost: { economy:10, faith:10 }, tier:4, bias:"extreme" },
  "radiation":     { cost: { economy:10, faith:10 }, tier:4, bias:"extreme" }
};
