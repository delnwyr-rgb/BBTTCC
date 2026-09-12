#!/usr/bin/env node
/**
 * sim-op-economy.mjs — offline OP-economy simulator (owner ruling 2026-09-11).
 *
 * Plays N turns of the faction economy for several player POLICIES against the
 * REAL engine numbers, so prices / upkeep / spend order / sprawl can be tuned
 * against the seven targets below before anything touches the live modules.
 *
 * Can't-drift rule: every constant table is PARSED OUT OF THE ENGINE SOURCE at
 * run time (RES_TO_OP, TYPE_BASE, SIZE_MULT, LOGI, upkeep tables, cap band,
 * gear pricing). A parse miss prints "DRIFT?" and falls back to the value
 * recorded here — so a silent engine change shows up in the header, not in a
 * wrong answer. Formulas are mirrored by hand with a source line reference
 * each; `--parity <save.json>` recomputes a real faction's regen + upkeep +
 * logistics from a world save and prints engine-recorded vs simulated.
 *
 * TARGETS (owner, 2026-09-11):
 *  T1 one meaningful activity per turn from income; a second from a 2–3 turn bank
 *  T2 every expansion/development row has ≥2 fuel recipes across channels
 *  T3 the choice each turn is between 2–3 things, never one-or-nothing
 *  T4 aggressive expansion strains in ~3 turns, not 1, with a non-loan relief lever
 *  T5 story rewards occasionally worth a full turn of income, sometimes in the scarce channel
 *  T6 gear/rig spend affordable ~once an act per Steward, visibly competing with hex dev
 *  T7 sharing is rare early, common under pressure, leaves a trace
 *
 * Usage:
 *   bin/ft-sim-economy                       # all policies, engine-as-is knobs, 30 turns
 *   bin/ft-sim-economy --turns 40 --recipes --occupation-mult 0.5 --price-mult 0.75
 *   bin/ft-sim-economy --spend-order after   # regen lands before plans are paid
 *   bin/ft-sim-economy --parity /path/to/save.json --faction "The Errata Society"
 *   bin/ft-sim-economy --json out.json       # machine-readable per-turn rows
 *   bin/ft-sim-economy --policy expand --verbose
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const SRC = {
  territoryMain: path.join(REPO, "modules/bbttcc-territory/scripts/main.js"),
  turnDriver:    path.join(REPO, "modules/bbttcc-territory/scripts/turn-driver.js"),
  upkeep:        path.join(REPO, "modules/bbttcc-territory/scripts/territory-garrison-upkeep.enhancer.js"),
  tracks:        path.join(REPO, "modules/bbttcc-territory/scripts/advance-turn.tracks.js"),
  opEngine:      path.join(REPO, "modules/bbttcc-factions/scripts/op-engine.js"),
  compat:        path.join(REPO, "modules/bbttcc-raid/scripts/compat-bridge.js"),
  wilderness:    path.join(REPO, "modules/bbttcc-raid/scripts/effects-wilderness.enhancer.js"),
  tradeRoute:    path.join(REPO, "modules/bbttcc-raid/scripts/effects-establish-trade-route.enhancer.js"),
  throughput:    path.join(REPO, "modules/bbttcc-raid/scripts/strategic-throughput.js"),
  travel:        path.join(REPO, "modules/bbttcc-travel/scripts/hex-travel.js"),
  pricing:       path.join(REPO, "systems/fourththing/rfi-pricing.js")
};

/* ───────────────────────── CLI ───────────────────────── */
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(`--${name}`); if (i < 0) return dflt; const v = argv[i + 1]; return (v === undefined || v.startsWith("--")) ? true : v; };
const num = (name, dflt) => { const v = flag(name, null); return v === null || v === true ? dflt : Number(v); };
const KNOBS = {
  turns:            num("turns", 30),
  priceMult:        num("price-mult", null),         // every activity price × this (default = the engine's PRICE_MULT)
  econPriceMult:    num("econ-price-mult", 1.0),     // the ECONOMY part of every price × this (on top)
  occupationMult:   num("occupation-mult", 1.0),     // occupation-phase upkeep × this (engine 1.5 phase mult stays)
  spendOrder:       String(flag("spend-order", "after")),   // after = engine since 2026-09-12 (regen lands, THEN plans are paid); before = the old order
  sprawlExp:        num("sprawl-exp", null),         // override LOGI.SPRAWL_EXP
  sprawlThreshold:  num("sprawl-threshold", null),
  recipes:          !flag("no-recipes", false),      // alternate fuel recipes (engine RECIPES table; --no-recipes for the single-price world)
  rewardMarks:      num("reward-marks", 0),          // story policy: marks/turn of quest+bounty reward
  rewardEvery:      num("reward-every", 2),
  gearEvery:        num("gear-every", 3),            // gear policy: buy every N turns
  gearMarks:        num("gear-marks", null),         // default = tier-1 weapon + fee from rfi-pricing
  tierFloorTurn:    num("tier-floor-turn", 2),       // Director lifts coalition to T1 at this turn (Act 2)
  maxHexes:         num("max-hexes", 8),
  travelLegs:       num("travel-legs", 0),           // legs/turn into hexes that are NOT free passage (own/allied dev-6 hexes are free)
  travelTerrain:    String(flag("travel-terrain", "plains")),   // TERRAIN_TABLE key (hex-travel.js) — plains 10e · forest 10e+10i · mountains 20e+10l · sea 30e+20l
  raidRounds:       num("raid-rounds", 0),           // raid rounds/turn: needs 10 marks in the primary pool to authorise each (GATE, not a charge)
  raidPool:         String(flag("raid-pool", "violence")),
  raidStaged:       num("raid-staged", 0),           // marks staged per round (the real raid spend; +1 bonus per 20 × price-mult marks)
  courtlyRounds:    num("courtly-rounds", 0),        // courtly intrigue rounds/turn: 20 diplomacy each (war-log "Courtly Intrigue: diplomacy -20")             // map reality: the River Heart has ~8 reachable claims per faction; expand stops here
  loyaltyPenalty:   !flag("no-loyalty-penalty", false),
  policy:           flag("policy", null),
  verbose:          !!flag("verbose", false),
  json:             flag("json", null),
  parity:           flag("parity", null),
  parityFaction:    String(flag("faction", "The Errata Society")),
  seed:             num("seed", 7)
};
if (flag("help", false)) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(0); }

/* ───────────────────── engine constant loader ───────────────────── */
const DRIFT = [];
function readSrc(p) { try { return fs.readFileSync(p, "utf8"); } catch { DRIFT.push(`missing source ${path.relative(REPO, p)}`); return ""; } }
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/[^\n]*/g, "$1"); }
/** Find `const NAME = {…}` (or `Object.freeze({…})`) and evaluate the literal. */
function parseConst(src, name, fallback, label) {
  try {
    const re = new RegExp(`const\\s+${name}\\s*=\\s*(?:Object\\.freeze\\()?\\{`);
    const m = re.exec(src); if (!m) throw new Error("not found");
    let i = m.index + m[0].length - 1, depth = 0, j = i;
    for (; j < src.length; j++) { const c = src[j]; if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) break; } }
    const lit = stripComments(src.slice(i, j + 1));
    const val = Function(`"use strict"; return (${lit});`)();
    if (!val || typeof val !== "object") throw new Error("not an object");
    return val;
  } catch (e) { DRIFT.push(`${label || name}: ${e.message} — using recorded fallback`); return fallback; }
}
function parseCost(src, key, fallback) {
  // Two shapes in the engine: `cost: EFFECTS.<key>?.cost || {…}` (wilderness/trade-route enhancers, default
  // price when the base table has none) and `<key>: { …, cost:{…} }` (compat-bridge table rows).
  try {
    const shapes = [
      new RegExp(`${key}\\?\\.cost\\s*\\|\\|\\s*(\\{[^}]*\\})`),
      new RegExp(`\\b${key}\\s*:\\s*\\{[^}]*?cost\\s*:\\s*(\\{[^}]*\\})`)
    ];
    for (const re of shapes) { const m = re.exec(src); if (m) return Function(`"use strict"; return (${stripComments(m[1])});`)(); }
    throw new Error("not found");
  } catch (e) { DRIFT.push(`price ${key}: ${e.message} — using recorded fallback`); return fallback; }
}

const S = Object.fromEntries(Object.entries(SRC).map(([k, p]) => [k, readSrc(p)]));
// Engine price policy + recipes (ruling B, 2026-09-11) — the engine scales prices at run time, so the
// literals in the source are BASE prices; the sim applies the same multiplier by default.
const ENGINE_PRICE_MULT = (() => { const m = /const\s+PRICE_MULT\s*=\s*([\d.]+)/.exec(S.throughput || ""); if (!m) { DRIFT.push("PRICE_MULT: not found in strategic-throughput — using 1.0"); return 1.0; } return Number(m[1]); })();
const ENGINE_OCCUPATION_MULT = (() => { const m = /if \(phase === "occupation"\)\s*phaseMult = ([\d.]+)/.exec(S.upkeep || ""); if (!m) { DRIFT.push("occupation phaseMult: not found in upkeep enhancer — using 1.5"); return 1.5; } return Number(m[1]); })();
const E = {
  RES_TO_OP: parseConst(S.territoryMain, "RES_TO_OP", {
    economy:{food:0.5, materials:0.8, trade:1.0, military:0.1, knowledge:0.25},
    violence:{food:0.1, materials:0.2, trade:0.2, military:0.8, knowledge:0.0},
    nonLethal:{food:0.2, materials:0.1, trade:0.2, military:0.5, knowledge:0.3},
    intrigue:{food:0.0, materials:0.1, trade:0.5, military:0.1, knowledge:1.0},
    diplomacy:{food:0.2, materials:0.0, trade:0.6, military:0.0, knowledge:0.4},
    softPower:{food:0.2, materials:0.0, trade:0.5, military:0.0, knowledge:0.3} }),
  LEY_FLOW_MULT: parseConst(S.territoryMain, "LEY_FLOW_MULT", { normal:1.0, turbulence:0.9, surge:1.3, stagnation:0.6, inversion:1.0 }),
  TYPE_BASE: parseConst(S.territoryMain, "TYPE_BASE", {
    settlement:{food:2, materials:1, trade:3, military:0, knowledge:0}, fortress:{food:0, materials:3, trade:1, military:4, knowledge:0},
    mine:{food:0, materials:5, trade:2, military:0, knowledge:0}, farm:{food:5, materials:1, trade:2, military:0, knowledge:0},
    port:{food:2, materials:2, trade:4, military:0, knowledge:0}, factory:{food:0, materials:4, trade:3, military:0, knowledge:0},
    research:{food:0, materials:1, trade:1, military:0, knowledge:4}, temple:{food:1, materials:1, trade:1, military:0, knowledge:2},
    wasteland:{food:0, materials:1, trade:0, military:0, knowledge:0}, ruins:{food:0, materials:2, trade:0, military:0, knowledge:1} }),
  SIZE_MULT: parseConst(S.territoryMain, "SIZE_MULT", { none:0, outpost:0.5, village:0.75, town:1, city:1.5, metropolis:2, megalopolis:3 }, "territory SIZE_MULT"),
  LOGI: parseConst(S.turnDriver, "LOGI", { DEMAND_TERRITORY_PER_HEX:1, DEMAND_SHORT_PER_HEX:1, DEMAND_OCCUPATION_PER_HEX:2, DEMAND_DISTANCE_PER_STEP:0.5, DEMAND_CITY_PER_HEX:1, DEMAND_SPECIAL_PER_HEX:0.5, DEMAND_RIG_PER_ACTIVE:0.5, SPRAWL_THRESHOLD:4, SPRAWL_EXP:2, SPRAWL_MULT:0.25, CAPACITY_PER_LOGISTICS_OP:1, CAPACITY_PER_TRADEPAIR:1, CAPACITY_PER_TRADEROUTE:0.5, CAPACITY_FULL_INTEG_PER_HEX:0.5, CAPACITY_INFRA_DEPOT:1, CAPACITY_INFRA_MAJORPORT:1, CAPACITY_INFRA_ROADNET:0.5, CAPACITY_INFRA_SUPPLYLINE:0.5, CAPACITY_LOGI_RIG:0.5 }),
  UP_BASE: parseConst(S.upkeep, "BASE_BY_TYPE", { fortress:{military:10, logistics:10}, port:{logistics:10, diplomacy:5}, temple:{faith:10, diplomacy:5}, farm:{logistics:5, economy:5}, mine:{economy:10}, research:{economy:5, intrigue:5}, settlement:{logistics:5, diplomacy:5, economy:5}, city:{logistics:10, diplomacy:10, economy:10}, ruins:{intrigue:10, nonlethal:5, economy:5}, default:{economy:5, diplomacy:3, nonlethal:2} }, "upkeep BASE_BY_TYPE"),
  UP_SIZE: parseConst(S.upkeep, "SIZE_MULT", { outpost:0.5, village:0.75, town:1, city:1.5, metropolis:2, megalopolis:3 }, "upkeep SIZE_MULT"),
  UP_STATUS: parseConst(S.upkeep, "STATUS_MULT", { unclaimed:0, contested:0.75, occupied:1, claimed:1, scorched:1, triumphant:1.1 }),
  UP_OUTCOME: parseConst(S.upkeep, "OUTCOME_MULT", { justice_reformation:0.7, liberation:0.8, best_friends_integration:0.5, retribution_subjugation:1.3, salt_the_earth:0 }),
  UP_EASE: parseConst(S.upkeep, "EASE_MULT", { very_easy:0.7, easy:0.85, normal:1, hard:1.2 }),
  UP_MOD: parseConst(S.upkeep, "MOD_MULT", { "Well-Maintained":0.9, "Fortified":1.1, "Trade Hub":1.05, "Damaged Infrastructure":1.2, "Radiation Zone":1.3, "Cultural Festival":0.9, "Supply Line":0.95, "Logistics Hub":1.05, "Diplomatic Ties":0.95 }),
  TIER_BASE_MARKS: parseConst(S.pricing, "TIER_BASE_MARKS", { 1:50, 2:150, 3:450, 4:1350 }),
  TIER_FEE_MARKS: parseConst(S.pricing, "TIER_FEE_MARKS", { I:10, II:30, III:90, IV:270 }),
  CATEGORY_MULT: parseConst(S.pricing, "CATEGORY_MULT_BY_FRAME", { weapon:1, armor:1.5, tool:0.6, sigil:1.2, vehicle:5, consumable:0.2 }),
  CREATURE_TIER_BASE: parseConst(S.pricing, "CREATURE_TIER_BASE", { 1:5, 2:10, 3:20, 4:40 }),
  TERRAIN_TABLE: parseConst(S.travel, "TERRAIN_TABLE", { plains:{ cost:{ economy:10 } }, forest:{ cost:{ economy:10, intrigue:10 } }, mountains:{ cost:{ economy:20, logistics:10 } }, sea:{ cost:{ economy:30, logistics:20 } } }),
  LEDGER_DAY_COST: parseConst(S.turnDriver, "LEDGER_DAY_COST", { develop_infrastructure_std:3, infrastructure_expansion:3, establish_outpost:3, upgrade_outpost_settlement:3, develop_outpost_stability:2, establish_supply_line:2, establish_trade_route:2 })
};
// Hand-mirrored scalars (turn-driver / upkeep / tracks / op-engine) — line refs in comments.
const M = {
  CAP_BAND: [50, 70, 90, 110, 130],                      // op-engine _readCaps; faction-tier-advance-button CAP_BAND
  OVEREXT_LOGI_MULT: { overextended:0.90, strained:0.80, critical:0.65 },   // turn-driver advanceOPRegen 4.1
  PHASE_MULT: { occupation:1.5, short_integration:1.0, full_integration:0.3 }, // upkeep computeHexUpkeep 2)
  HOSTILITY_MULT: 1.25, LOYALTY_MULT: 0.85,             // upkeep 7)
  UPKEEP_INTEG_BONUS: { short:1, full:2 },              // upkeep: integration morale/loyalty bonus per paid hex (2026-09-10 applied directly)
  LOYALTY_PCT: [[15,-20],[30,-10],[70,0],[85,5],[101,10]], // tracks doLoyaltyPhase1 (bands by loyalty)
  DAYS_PER_TURN: 30,                                    // bbttcc-world time.turnLength (Turn Ledger T=30)
  MOD_PROD: { "well-maintained":0.25, "strategic position":0.10, "loyal population":0.15, "contaminated":-0.5, "damaged infrastructure":-0.25, "hostile population":-0.25, "difficult terrain":-0.10, "radiation zone":-0.75 }, // territory getModifierEffects (mAll)
  MOD_TRADE: { "trade hub":0.5 }                        // territory getModifierEffects (mTrade)
};
if (KNOBS.priceMult == null) KNOBS.priceMult = ENGINE_PRICE_MULT;
const LOGI_CAP_FLOOR = (() => { const m = /const\s+_LOGI_CAP_FLOOR\s*=\s*\[([^\]]*)\]/.exec(S.turnDriver || ""); if (!m) { DRIFT.push("_LOGI_CAP_FLOOR: not found in turn-driver — using [0,0,0,0,0]"); return [0,0,0,0,0]; } return m[1].split(",").map(x => Number(x.trim()) || 0); })();
M.PHASE_MULT.occupation = ENGINE_OCCUPATION_MULT;   // parsed from the upkeep enhancer (ruling B halved it)
if (KNOBS.sprawlExp != null) E.LOGI.SPRAWL_EXP = KNOBS.sprawlExp;
if (KNOBS.sprawlThreshold != null) E.LOGI.SPRAWL_THRESHOLD = KNOBS.sprawlThreshold;

/* ───────────────────── activities (engine prices + PROPOSED recipes) ───────────────────── */
const OPK = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
const enginePrice = {
  establish_outpost:          parseCost(S.wilderness, "establish_outpost", { economy:20, logistics:10 }),
  develop_outpost_stability:  parseCost(S.wilderness, "develop_outpost_stability", { diplomacy:20, economy:10 }),
  upgrade_outpost_settlement: parseCost(S.wilderness, "upgrade_outpost_settlement", { economy:30, softpower:20, logistics:20 }),
  establish_trade_route:      parseCost(S.tradeRoute, "establish_trade_route", { economy:30, diplomacy:10, logistics:10 }),
  integration_framework:      parseCost(S.compat, "integration_framework", { diplomacy:10, softpower:10 })
};
// Alternate fuel recipes (T2): parsed from strategic-throughput RECIPES (ruling B shipped 2026-09-11); this literal is the fallback.
const RECIPES = parseConst(S.throughput, "RECIPES", null, "RECIPES (strategic-throughput)") || {
  establish_outpost: [
    { label:"hired labour",     cost:{ economy:20, logistics:10 } },
    { label:"work gang",        cost:{ violence:20, logistics:10 }, note:"loyalty knock on the hex" },
    { label:"pilgrim settlers", cost:{ faith:15, softpower:10 }, days:+1 }
  ],
  establish_trade_route: [
    { label:"bought caravan",   cost:{ economy:30, diplomacy:10, logistics:10 } },
    { label:"treaty road",      cost:{ diplomacy:30, culture:10, logistics:10 } },
    { label:"smugglers' run",   cost:{ intrigue:25, economy:10, logistics:10 }, note:"darkness +1 risk" }
  ],
  integration_framework: [
    { label:"diplomatic envoys", cost:{ diplomacy:10, softpower:10 } },
    { label:"mission houses",    cost:{ faith:10, culture:10 } },
    { label:"paid administrators", cost:{ economy:15, nonlethal:5 } }
  ],
  develop_outpost_stability: [
    { label:"garrison & grants", cost:{ diplomacy:20, economy:10 } },
    { label:"show of force",     cost:{ violence:20, nonlethal:10 } }
  ],
  upgrade_outpost_settlement: [
    { label:"charter & works",   cost:{ economy:30, softpower:20, logistics:20 } },
    { label:"festival founding", cost:{ culture:30, faith:20, logistics:20 } }
  ]
};
const ACT = {
  establish_outpost:          { days: E.LEDGER_DAY_COST.establish_outpost ?? 3, progress:+1, kind:"expand" },
  establish_trade_route:      { days: E.LEDGER_DAY_COST.establish_trade_route ?? 2, kind:"connect" },
  integration_framework:      { days: 2, progress:+1, kind:"develop" },
  develop_outpost_stability:  { days: E.LEDGER_DAY_COST.develop_outpost_stability ?? 2, progress:+1, kind:"develop" },
  upgrade_outpost_settlement: { days: E.LEDGER_DAY_COST.upgrade_outpost_settlement ?? 3, progress:+1, kind:"develop", sizeUp:true }
};
function scaledCost(cost) {
  const out = {};
  for (const [k, v] of Object.entries(cost)) { let n = v * KNOBS.priceMult; if (k === "economy") n *= KNOBS.econPriceMult; out[k] = Math.round(n); }
  return out;
}
function recipesFor(key) {
  const base = [{ label:"engine", cost: enginePrice[key] }];
  return (KNOBS.recipes ? RECIPES[key] : base).map(r => ({ ...r, cost: scaledCost(r.cost) }));
}
const GEAR_MARKS = KNOBS.gearMarks ?? Math.round(E.TIER_BASE_MARKS[1] * (E.CATEGORY_MULT.weapon ?? 1) + (E.TIER_FEE_MARKS.I ?? 10));  // T1 weapon + tier fee

/* ───────────────────── engine formula mirrors ───────────────────── */
const round = Math.round;
function hexBaseVector(h) { const tb = E.TYPE_BASE[h.type] || E.TYPE_BASE.settlement; const sm = E.SIZE_MULT[h.size] ?? 0; return Object.fromEntries(["food","materials","trade","military","knowledge"].map(k => [k, round((tb[k] || 0) * sm)])); }
function modifierEffects(mods) { let mAll = 1, mTrade = 1; for (const m of mods) { const k = String(m).toLowerCase(); if (M.MOD_PROD[k] != null) mAll *= 1 + M.MOD_PROD[k]; if (M.MOD_TRADE[k] != null) mTrade *= 1 + M.MOD_TRADE[k]; } return { mAll, mTrade }; }
function hexResources(h) {   // territory computeEffectiveResources (no sephirah adds in the sim)
  const base = hexBaseVector(h); const { mAll, mTrade } = modifierEffects(h.modifiers);
  const mul = (v, m) => Math.max(0, round(v * m));
  return { food:mul(base.food, mAll), materials:mul(base.materials, mAll), trade:mul(base.trade, mAll * mTrade), military:mul(base.military, mAll), knowledge:mul(base.knowledge, mAll) };
}
function resourcesToOP(res, flow = "normal") {   // territory resourcesToOP
  const out = {}; for (const [op, w] of Object.entries(E.RES_TO_OP)) { let v = 0; for (const [rk, x] of Object.entries(w)) v += (res[rk] || 0) * x; out[op] = Math.max(0, round(v)); }
  const mult = E.LEY_FLOW_MULT[flow] ?? 1; for (const k of Object.keys(out)) out[k] = Math.max(0, round(out[k] * mult));
  return out;
}
function factionIncome(F) {   // turn-driver computeTerritoryMatrixIncome
  const KEYMAP = { economy:"economy", violence:"violence", nonLethal:"nonlethal", intrigue:"intrigue", diplomacy:"diplomacy", softPower:"softpower" };
  const out = Object.fromEntries(OPK.map(k => [k, 0]));
  for (const h of F.hexes) { const res = hexResources(h); const v = resourcesToOP(res, h.flow || "normal"); for (const [mk, ck] of Object.entries(KEYMAP)) out[ck] += v[mk] || 0; out.logistics += res.food || 0; }
  for (const k of OPK) out[k] = Math.max(0, round(out[k]));
  return out;
}
function phaseOf(h) { return h.progress >= 6 ? "full_integration" : h.progress >= 3 ? "short_integration" : "occupation"; }   // upkeep inferPhaseFromIntegration
function hexUpkeep(h) {   // upkeep computeHexUpkeep (no tikkun/conditions in the sim)
  const base = E.UP_BASE[h.type] || E.UP_BASE.default; const phase = phaseOf(h);
  let mult = M.PHASE_MULT[phase] * (phase === "occupation" ? KNOBS.occupationMult : 1);
  mult *= E.UP_OUTCOME[h.outcomeKey] ?? 1; mult *= E.UP_EASE[h.garrisonEase] ?? 1; mult *= h.integrationCostMult ?? 1;
  mult *= E.UP_SIZE[h.size] ?? 1; mult *= E.UP_STATUS[h.status] ?? 1;
  for (const m of h.modifiers) { if (E.UP_MOD[m]) mult *= E.UP_MOD[m]; }
  if (h.modifiers.includes("Hostile Population")) mult *= M.HOSTILITY_MULT;
  if (h.modifiers.includes("Loyal Population")) mult *= M.LOYALTY_MULT;
  const out = {}; for (const [k, v] of Object.entries(base)) { const n = v * mult; if (Math.abs(n) >= 0.25) out[k] = round(n); }
  return { vec: out, phase };
}
function classifyOverextension(r) { if (!Number.isFinite(r)) return "critical"; if (r <= 0.8) return "stable"; if (r <= 1.0) return "stretched"; if (r <= 1.2) return "overextended"; if (r <= 1.5) return "strained"; return "critical"; }
function logistics(F) {   // turn-driver computeLogisticsPressureForFaction (distance = F.distSteps knob, default 0)
  const L = E.LOGI; const n = F.hexes.length;
  let short = 0, occ = 0, full = 0, special = 0;
  for (const h of F.hexes) { const p = h.progress; if (p <= 0) occ++; else if (p <= 3) short++; else full++; if (h.modifiers.some(m => /trade hub|ruins|outpost|port|vault|megastructure|rail yard/i.test(m))) special++; }
  const sprawlExcess = Math.max(0, n - L.SPRAWL_THRESHOLD);
  const demand = n * L.DEMAND_TERRITORY_PER_HEX + short * L.DEMAND_SHORT_PER_HEX + occ * L.DEMAND_OCCUPATION_PER_HEX + (F.distSteps || 0) * L.DEMAND_DISTANCE_PER_STEP + special * L.DEMAND_SPECIAL_PER_HEX + (sprawlExcess > 0 ? Math.pow(sprawlExcess, L.SPRAWL_EXP) * L.SPRAWL_MULT : 0);
  const capMarks = Math.max(M.CAP_BAND[F.tier], LOGI_CAP_FLOOR[F.tier] ?? 0); const opCapacity = Math.floor(capMarks / 10) * L.CAPACITY_PER_LOGISTICS_OP;   // turn-driver _LOGI_CAP_FLOOR (2026-09-12)
  const tradeCapacity = L.CAPACITY_PER_TRADEROUTE != null ? F.routes * L.CAPACITY_PER_TRADEROUTE : Math.floor(F.routes / 2) * L.CAPACITY_PER_TRADEPAIR;
  const capacity = opCapacity + tradeCapacity + full * L.CAPACITY_FULL_INTEG_PER_HEX + (F.supplyLines || 0) * L.CAPACITY_INFRA_SUPPLYLINE;
  const ratio = capacity > 0 ? demand / capacity : Infinity;
  return { demand, capacity, ratio: round(ratio * 1000) / 1000, band: classifyOverextension(ratio) };
}
function loyaltyPct(L) { for (const [lt, pct] of M.LOYALTY_PCT) if (L < lt) return pct; return 10; }
function loyaltyDrift(L) { return L < 50 ? 1 : L > 50 ? -1 : 0; }

/* ───────────────────── faction model ───────────────────── */
function mkHex(type, size, progress, mods = [], extra = {}) { return { type, size, progress, modifiers: mods.slice(), status:"occupied", outcomeKey: extra.outcomeKey ?? null, garrisonEase: extra.garrisonEase ?? "normal", integrationCostMult: extra.integrationCostMult ?? 1, flow:"normal" }; }
function foundedHex(type = "wilderness") { return mkHex(type, "outpost", 1, [], { outcomeKey:"wilderness_foundation", garrisonEase:"easy", integrationCostMult:0.8 }); }
function mkFaction(name) {   // Errata-shaped start (Beginning of Act 2 Mark 5): 3 towns, 50 marks everywhere, T0, morale/loyalty 25
  return { name, tier:0, bank: Object.fromEntries(OPK.map(k => [k, 50])), morale:25, loyalty:25, routes:0, supplyLines:0, distSteps:0,
    hexes: [ mkHex("port","town",6,["Loyal Population"]), mkHex("mine","town",6,["Loyal Population"]), mkHex("farm","town",6,["Loyal Population"]) ],
    pendingPct:0, unpaidTurns:0, spentChannels:new Set(), log:[] };
}
const caps = F => M.CAP_BAND[Math.max(0, Math.min(4, F.tier))];
function canPay(F, cost) { return Object.entries(cost).every(([k, v]) => (F.bank[k] || 0) >= v); }
function pay(F, cost, label) { for (const [k, v] of Object.entries(cost)) { F.bank[k] -= v; if (v > 0) F.spentChannels.add(k); } F.log.push(label); }
function affordableRecipe(F, key) {   // prefer the recipe that leaves the most headroom in its scarcest channel
  const rs = recipesFor(key).filter(r => canPay(F, r.cost));
  if (!rs.length) return null;
  rs.sort((a, b) => headroom(F, b.cost) - headroom(F, a.cost)); return rs[0];
}
function headroom(F, cost) { return Math.min(...Object.entries(cost).map(([k, v]) => (F.bank[k] || 0) - v)); }
function optionsCount(F, days) { return Object.keys(ACT).filter(k => ACT[k].days <= days && recipesFor(k).some(r => canPay(F, r.cost))).length; }

/* ───────────────────── policies ───────────────────── */
// Each returns a list of {key, hexIndex?} plans for the turn, given the faction state and days budget.
const POLICIES = {
  expand:   { desc:"found an outpost every turn (to --max-hexes); else integrate; else trade routes", plan: (F, d) => pickFirst(F, d, ["establish_outpost", "integration_framework", "establish_trade_route"]) },
  alternate:{ desc:"outpost, then integrate/stabilise it, then outpost…", plan: (F, d) => { const young = F.hexes.find(h => h.progress < 6); return pickFirst(F, d, young && (F.turnIndex % 2 === 1) ? ["integration_framework", "establish_outpost"] : ["establish_outpost", "integration_framework"]); } },
  turtle:   { desc:"develop everything to 6, one trade route per 2 hexes, expand only when stable", plan: (F, d) => { const young = F.hexes.some(h => h.progress < 6); if (young) return pickFirst(F, d, ["integration_framework"]); if (F.routes < Math.floor(F.hexes.length / 2)) return pickFirst(F, d, ["establish_trade_route"]); return F.lastBand === "stable" ? pickFirst(F, d, ["establish_outpost", "establish_trade_route"]) : pickFirst(F, d, ["establish_trade_route"]); } },
  story:    { desc:"alternate + quest/bounty rewards (--reward-marks, T5)", plan: (F, d) => POLICIES.alternate.plan(F, d), reward:true },
  gear:     { desc:"alternate + a Steward buys gear every --gear-every turns (T6)", plan: (F, d) => POLICIES.alternate.plan(F, d), gear:true }
};
function pickFirst(F, days, keys) {
  const plans = []; let left = days; const B = { ...F.bank };
  for (const key of keys) {
    const act = ACT[key]; if (!act || act.days > left) continue;
    const r = recipesFor(key).filter(x => Object.entries(x.cost).every(([k, v]) => (B[k] || 0) >= v)).sort((a, b) => headroomB(B, b.cost) - headroomB(B, a.cost))[0];
    if (!r) continue;
    if (key === "integration_framework" && !F.hexes.some(h => h.progress < 6)) continue;
    if (key === "establish_outpost" && F.hexes.length + plans.filter(p => p.key === "establish_outpost").length >= KNOBS.maxHexes) continue;
    if (key === "establish_trade_route" && F.routes + plans.filter(p => p.key === "establish_trade_route").length >= Math.max(0, F.hexes.length - 1)) continue;   // one route per adjacent pair, tops
    plans.push({ key, recipe: r }); left -= act.days + (r.days || 0); for (const [k, v] of Object.entries(r.cost)) B[k] -= v;
    if (plans.length >= 2) break;   // ≤2 plans a turn (T1/T3 measure "could I do one more?")
  }
  return plans;
}
function headroomB(B, cost) { return Math.min(...Object.entries(cost).map(([k, v]) => (B[k] || 0) - v)); }

/* ───────────────────── one turn (engine order) ───────────────────── */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function runTurn(F, policy, t, rand) {
  F.turnIndex = t; const row = { turn:t, notes:[] };
  const plans = policy.plan(F, M.DAYS_PER_TURN);
  const applyPlans = () => {
    for (const p of plans) {
      if (!canPay(F, p.recipe.cost)) { row.notes.push(`${p.key} HELD (cannot afford at resolution)`); continue; }
      pay(F, p.recipe.cost, `${p.key} via ${p.recipe.label}`);
      const fxH = p.recipe.fx?.hex || {}, fxF = p.recipe.fx?.faction || {};
      if (fxF.loyaltyDelta) F.loyalty = Math.max(0, Math.min(100, F.loyalty + Number(fxF.loyaltyDelta)));
      if (fxF.moraleDelta) F.morale = Math.max(0, Math.min(100, F.morale + Number(fxF.moraleDelta)));
      const fxTarget = () => (p.key === "establish_outpost") ? null : (F.hexes.filter(h => h.progress < 6).sort((a, b) => b.progress - a.progress)[0] || F.hexes[F.hexes.length - 1]);
      if (fxH.loyaltyDelta) { const h = fxTarget(); if (h) h.loyaltyMods = (h.loyaltyMods || 0) + Number(fxH.loyaltyDelta); else F.pendingHexLoyalty = (F.pendingHexLoyalty || 0) + Number(fxH.loyaltyDelta); }
      const act = ACT[p.key];
      if (p.key === "establish_outpost") { const h = foundedHex(); if (F.pendingHexLoyalty) { h.loyaltyMods = F.pendingHexLoyalty; F.pendingHexLoyalty = 0; } F.hexes.push(h); }
      else if (p.key === "establish_trade_route") { F.routes++; const hub = F.hexes.find(h => !h.modifiers.includes("Trade Hub")); if (hub) hub.modifiers.push("Trade Hub"); }
      else if (act.progress) { const h = F.hexes.filter(h => h.progress < 6).sort((a, b) => b.progress - a.progress)[0]; if (h) { h.progress = Math.min(6, h.progress + act.progress); if (act.sizeUp && h.size === "outpost") h.size = "village"; if (h.progress >= 6 && !h.modifiers.includes("Loyal Population")) h.modifiers.push("Loyal Population"); } }
      row.notes.push(`${p.key}${p.recipe.label !== "engine" ? ` (${p.recipe.label})` : ""}`);
    }
  };
  row.optionsAtPlan = optionsCount(F, M.DAYS_PER_TURN);
  if (KNOBS.spendOrder === "before") applyPlans();
  // regen (turn-driver advanceOPRegen): matrix income × loyalty pct (2026-09-10) × overextension logistics mult, clamp to caps
  const inc = factionIncome(F); const pct = KNOBS.loyaltyPenalty ? F.pendingPct : 0;
  const lg = logistics(F); F.lastBand = lg.band; const lm = M.OVEREXT_LOGI_MULT[lg.band] ?? 1;
  for (const k of OPK) { let v = inc[k]; if (pct) v = Math.max(0, Math.floor(v * (1 + pct / 100))); if (k === "logistics" && lm !== 1) v = Math.floor(v * lm); F.bank[k] = Math.min(caps(F), F.bank[k] + v); }
  if (policy.reward && KNOBS.rewardMarks > 0 && t % KNOBS.rewardEvery === 0) { const scarce = OPK.slice().sort((a, b) => F.bank[a] - F.bank[b])[0]; F.bank[scarce] = Math.min(caps(F), F.bank[scarce] + KNOBS.rewardMarks); row.notes.push(`reward +${KNOBS.rewardMarks} ${scarce}`); }
  F.pendingPct = 0;
  if (KNOBS.spendOrder === "after") applyPlans();
  if (t >= KNOBS.tierFloorTurn && F.tier < 1) F.tier = 1;   // Director tier floor (Act 2)
  // tracks: hex loyalty pull (2026-09-12) → drift → stability penalty for NEXT turn
  { const HEX_MOD_LOYALTY = { "loyal population":2, "hostile population":-2, "well-maintained":1, "damaged infrastructure":-1 };
    const score = h => (h.loyaltyMods || 0) + h.modifiers.reduce((a, m) => a + (HEX_MOD_LOYALTY[String(m).toLowerCase()] || 0), 0);
    const mean = F.hexes.length ? F.hexes.reduce((a, h) => a + score(h), 0) / F.hexes.length : 0; const pull = Math.max(-3, Math.min(3, Math.round(mean)));
    if (pull) { F.loyalty = Math.max(0, Math.min(100, F.loyalty + pull)); row.notes.push(`territory pull ${pull > 0 ? "+" : ""}${pull}`); } }
  F.loyalty = Math.max(0, Math.min(100, F.loyalty + loyaltyDrift(F.loyalty))); F.pendingPct = loyaltyPct(F.loyalty);
  // garrison upkeep: pay per hex; integration morale/loyalty bonus applied directly
  let bonusM = 0, bonusL = 0, unpaid = false;
  for (const h of F.hexes) {
    const { vec, phase } = hexUpkeep(h);
    if (canPay(F, vec)) { for (const [k, v] of Object.entries(vec)) F.bank[k] -= v; if (phase === "short_integration") { bonusM += 1; bonusL += 1; } else if (phase === "full_integration") { bonusM += 2; bonusL += 2; } }
    else { unpaid = true; for (const [k, v] of Object.entries(vec)) F.bank[k] = Math.max(0, F.bank[k] - v); F.morale -= 1; }
  }
  if (unpaid) F.unpaidTurns++;
  F.morale = Math.max(0, Math.min(100, F.morale + bonusM)); F.loyalty = Math.max(0, Math.min(100, F.loyalty + bonusL));
  // travel / raid / courtly drains (2026-09-12): player actions during the turn, paid as they happen
  if (KNOBS.travelLegs > 0) {
    const tc0 = E.TERRAIN_TABLE[KNOBS.travelTerrain]?.cost || E.TERRAIN_TABLE.plains?.cost || { economy:10 };
    const tc = Object.fromEntries(Object.entries(tc0).map(([k, v]) => [k, Math.max(1, Math.round(Number(v) * KNOBS.priceMult))]));   // hex-travel _applyPricePolicy (2026-09-12)
    for (let i = 0; i < KNOBS.travelLegs; i++) { for (const [k0, v] of Object.entries(tc)) { const k = k0 === "nonLethal" ? "nonlethal" : k0; if ((F.bank[k] || 0) >= v) { F.bank[k] -= v; F.spentChannels.add(k); } else { row.notes.push(`travel leg ${i + 1} SHORT (${k})`); } } }
    row.notes.push(`travel ×${KNOBS.travelLegs} ${KNOBS.travelTerrain}`);
  }
  if (KNOBS.raidRounds > 0) {
    // Engine truth (2026-09-12): a raid round needs 10 marks in the primary pool as a GATE (not a charge);
    // what a round actually spends is the STAGED marks (+1 bonus per 2 OP × PRICE_MULT = 15 marks).
    const pool = KNOBS.raidPool; let done = 0; const perBonus = Math.max(1, Math.round(20 * KNOBS.priceMult));
    for (let i = 0; i < KNOBS.raidRounds; i++) { const stake = Math.max(0, KNOBS.raidStaged); if ((F.bank[pool] || 0) >= Math.max(10, stake)) { F.bank[pool] -= stake; if (stake) F.spentChannels.add(pool); done++; } }
    row.notes.push(`raid rounds ${done}/${KNOBS.raidRounds} (${pool}${KNOBS.raidStaged ? `, staged ${KNOBS.raidStaged} → +${Math.ceil(KNOBS.raidStaged / perBonus)}` : ""})`); if (done < KNOBS.raidRounds) row.notes.push(`raid SHORT (${pool})`);
  }
  if (KNOBS.courtlyRounds > 0) {
    let done = 0; for (let i = 0; i < KNOBS.courtlyRounds; i++) { if ((F.bank.diplomacy || 0) >= 20) { F.bank.diplomacy -= 20; F.spentChannels.add("diplomacy"); done++; } }
    row.notes.push(`courtly ${done}/${KNOBS.courtlyRounds}`); if (done < KNOBS.courtlyRounds) row.notes.push("courtly SHORT (diplomacy)");
  }
  // gear policy: a Steward buys from the faction bank (economy first, then any pool at cross-pool friction)
  if (policy.gear && t % KNOBS.gearEvery === 0) {
    if (F.bank.economy >= GEAR_MARKS) { F.bank.economy -= GEAR_MARKS; F.spentChannels.add("economy"); row.notes.push(`gear −${GEAR_MARKS} economy`); F.gearBought = (F.gearBought || 0) + 1; }
    else row.notes.push(`gear UNAFFORDABLE (${GEAR_MARKS})`);
  }
  Object.assign(row, { acted: plans.length > 0 && !row.notes.some(n => /HELD/.test(n)), held: row.notes.filter(n => /HELD/.test(n)).length, plans: plans.length, hexes: F.hexes.length, routes: F.routes, band: lg.band, ratio: lg.ratio, morale: F.morale, loyalty: F.loyalty, unpaid, bank: { ...F.bank }, income: inc });
  return row;
}

/* ───────────────────── parity check against a world save ───────────────────── */
function parity(savePath, factionName) {
  const s = JSON.parse(fs.readFileSync(savePath, "utf8"));
  const A = s.actors.find(a => a.name === factionName); if (!A) { console.error(`faction "${factionName}" not in save`); process.exit(2); }
  const F = A.flags["bbttcc-factions"]; const hexes = [];
  for (const sc of s.scenes) for (const d of sc.drawings || []) { const tf = d.flags?.["bbttcc-territory"]; if (!tf || String(tf.factionId || tf.ownerId) !== A._id) continue;
    hexes.push({ name: String(tf.name || "").replace(/\s+/g, " "), type: String(tf.type || "settlement").toLowerCase(), size: String(tf.size || "town").toLowerCase(), progress: Number(tf.integration?.progress ?? 0), modifiers: Array.isArray(tf.modifiers) ? tf.modifiers : [], status: String(tf.status || "claimed").toLowerCase(), outcomeKey: tf.integration?.outcomeKey ?? null, garrisonEase: tf.integration?.spec?.garrisonEase ?? "normal", integrationCostMult: tf.integration?.spec?.integrationCostMult ?? 1, flow: tf.leylines?.flowState || "normal", resources: tf.resources || {} }); }
  const wl = F.warLogs || []; const regen = [...wl].reverse().find(e => /OP Regen/.test(String(e.summary))); const up = [...wl].reverse().find(e => e.activity === "garrison_upkeep");
  console.log(`\nPARITY — ${A.name} — ${hexes.length} hexes — save "${s.label}" turn ${s.turn}`);
  console.log("hex                | type/size      | prog | sim income (from stored resources)            | sim upkeep");
  const tot = Object.fromEntries(OPK.map(k => [k, 0]));
  for (const h of hexes) { const v = resourcesToOP(h.resources, h.flow); const inc = { economy:v.economy, violence:v.violence, nonlethal:v.nonLethal, intrigue:v.intrigue, diplomacy:v.diplomacy, softpower:v.softPower, logistics: h.resources.food || 0 }; for (const k of Object.keys(inc)) tot[k] += inc[k]; const u = hexUpkeep(h);
    console.log(`${h.name.padEnd(18)} | ${(h.type + "/" + h.size).padEnd(14)} | ${String(h.progress).padEnd(4)} | ${JSON.stringify(inc).padEnd(45)} | ${u.phase} ${JSON.stringify(u.vec)}`); }
  console.log("\nsim regen (pre-penalty):", JSON.stringify(tot));
  console.log("engine regen line     :", String(regen?.summary || "(none)").replace(/<[^>]+>/g, ""));
  console.log("engine upkeep line    :", String(up?.summary || "(none)").split(" | ").slice(0, hexes.length).join(" | "));
  const Fm = { hexes, tier: Number(F.tier ?? 0), routes: hexes.reduce((a, h) => a + 0, 0), supplyLines: 0, distSteps: F.logistics?.breakdown?.counts?.distSteps || 0 };
  Fm.routes = (() => { let n = 0; for (const sc of s.scenes) for (const d of sc.drawings || []) { const tf = d.flags?.["bbttcc-territory"]; if (tf && String(tf.factionId) === A._id && Array.isArray(tf.routes)) n += tf.routes.filter(r => r.kind === "trade").length; } return Math.ceil(n / 2); })();
  console.log("\nsim logistics (current rules):", JSON.stringify(logistics(Fm)));
  console.log("engine logistics (recorded)  :", JSON.stringify({ demand: F.logistics?.demand, capacity: F.logistics?.capacity, ratio: F.logistics?.ratio, band: F.logistics?.band }), "(recorded under the rules in force at that Advance)");
}

/* ───────────────────── run ───────────────────── */
function header() {
  console.log(`sim-op-economy — ${KNOBS.turns} turns · max hexes ${KNOBS.maxHexes} · price×${KNOBS.priceMult} (engine ${ENGINE_PRICE_MULT}) (economy×${KNOBS.econPriceMult}) · occupation×${KNOBS.occupationMult} (engine phase ${ENGINE_OCCUPATION_MULT}) · spend ${KNOBS.spendOrder} regen · sprawl ^${E.LOGI.SPRAWL_EXP} over ${E.LOGI.SPRAWL_THRESHOLD} · recipes ${KNOBS.recipes ? "ON" : "off"} · tier floor T1 @ turn ${KNOBS.tierFloorTurn} · gear ${GEAR_MARKS} marks${KNOBS.travelLegs ? ` · travel ${KNOBS.travelLegs}×${KNOBS.travelTerrain}/turn` : ""}${KNOBS.raidRounds ? ` · raid ${KNOBS.raidRounds} rounds/turn` : ""}${KNOBS.courtlyRounds ? ` · courtly ${KNOBS.courtlyRounds}/turn` : ""}`);
  if (DRIFT.length) { console.log("DRIFT? engine constants not parsed (fallbacks in use):"); for (const d of DRIFT) console.log("  · " + d); }
  else console.log("engine constants: all parsed from source ✓");
}
function summarize(name, rows, F) {
  const T = KNOBS.turns; const acted = rows.filter(r => r.acted).length; const idle = rows.filter(r => r.plans === 0).length; const held = rows.reduce((a, r) => a + r.held, 0);
  const avgOpt = rows.reduce((a, r) => a + r.optionsAtPlan, 0) / T; const oneOrNone = rows.filter(r => r.optionsAtPlan <= 1).length;
  const firstStrain = rows.find(r => /strained|critical|overextended/.test(r.band))?.turn ?? null; const firstExpand = rows.find(r => r.notes.some(n => /establish_outpost/.test(n)))?.turn ?? null;
  const idleChannels = OPK.filter(k => !F.spentChannels.has(k)); const loanTurns = rows.filter(r => Math.min(...Object.values(r.bank)) < 0 || r.unpaid).length;
  const shortTurns = rows.filter(r => r.notes.some(n => /SHORT/.test(n))).length;
  return { policy: name, turnsActed: acted, turnsIdle: idle, plansHeld: held, avgOptions: round(avgOpt * 10) / 10, turnsOneOrNone: oneOrNone, firstStrainTurn: firstStrain, firstExpandTurn: firstExpand, hexes: F.hexes.length, routes: F.routes, unpaidTurns: F.unpaidTurns, loanTurns, gearBought: F.gearBought || 0, shortTurns, idleChannels: idleChannels.join(",") || "none", endBank: F.bank, endBand: rows[rows.length - 1].band };
}
function main() {
  if (KNOBS.parity) { header(); parity(String(KNOBS.parity), KNOBS.parityFaction); return; }
  header();
  const names = KNOBS.policy ? [String(KNOBS.policy)] : Object.keys(POLICIES); const out = {};
  for (const name of names) {
    const policy = POLICIES[name]; if (!policy) { console.error(`unknown policy ${name}; have ${Object.keys(POLICIES).join(", ")}`); process.exit(2); }
    const F = mkFaction(name); const rand = rng(KNOBS.seed); const rows = [];
    for (let t = 1; t <= KNOBS.turns; t++) rows.push(runTurn(F, policy, t, rand));
    out[name] = { rows, summary: summarize(name, rows, F) };
    console.log(`\n═══ ${name} — ${policy.desc}`);
    console.log("turn | econ viol  dipl  logi  soft  faith | band         | opts | did");
    for (const r of rows) if (KNOBS.verbose || r.turn <= 12 || r.turn % 5 === 0 || r.held || r.unpaid) console.log(`${String(r.turn).padStart(4)} | ${String(r.bank.economy).padStart(4)} ${String(r.bank.violence).padStart(4)} ${String(r.bank.diplomacy).padStart(5)} ${String(r.bank.logistics).padStart(5)} ${String(r.bank.softpower).padStart(5)} ${String(r.bank.faith).padStart(5)} | ${r.band.padEnd(12)} | ${String(r.optionsAtPlan).padStart(4)} | ${r.notes.join("; ") || "—"}${r.unpaid ? "  ⚠ unpaid upkeep" : ""}`);
    const s = out[name].summary;
    console.log(`── acted ${s.turnsActed}/${KNOBS.turns} · idle ${s.turnsIdle} · held ${s.plansHeld} · avg options at plan ${s.avgOptions} · one-or-nothing turns ${s.turnsOneOrNone} · first strain T${s.firstStrainTurn ?? "—"} · hexes ${s.hexes} · routes ${s.routes} · unpaid ${s.unpaidTurns} · gear ${s.gearBought} · idle channels: ${s.idleChannels}`);
  }
  console.log("\n═══ TARGET SCORECARD");
  console.log("policy     | T1 acted/turns | T3 one-or-nothing | T4 first strain | T2 idle channels                      | T6 gear | unpaid | short");
  for (const [n, o] of Object.entries(out)) { const s = o.summary; console.log(`${n.padEnd(10)} | ${String(s.turnsActed + "/" + KNOBS.turns).padEnd(14)} | ${String(s.turnsOneOrNone).padEnd(17)} | ${String("T" + (s.firstStrainTurn ?? "—")).padEnd(15)} | ${s.idleChannels.padEnd(37)} | ${String(s.gearBought).padEnd(7)} | ${String(s.unpaidTurns).padEnd(6)} | ${s.shortTurns}`); }
  if (KNOBS.json) { fs.writeFileSync(String(KNOBS.json), JSON.stringify({ knobs: KNOBS, engine: E, drift: DRIFT, results: out }, null, 1)); console.log(`\nwrote ${KNOBS.json}`); }
}
main();
