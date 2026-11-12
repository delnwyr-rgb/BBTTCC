#!/usr/bin/env node
/* sim-combat.mjs — offline Monte Carlo of the fourththing (Bad Eden / RFI) combat rules AS THE CODE RUNS. `bin/ft-sim-combat` symlinks here.
 * Installed 2026-11-12 from the combat balance review (supersedes sim-encounter.mjs). CONFIG defaults = the LIVE rules after that
 * review's fix package (A–J below); the threat chassis rows are IMPORTED from systems/fourththing/threat-chassis.js, so retune there.
 *
 * Usage (repo root):
 *   bin/ft-sim-combat [dumpsDir] [--npcs npcs.jsonl] [--world world-actors.jsonl] [--n 2000] [--seed 20261112] [--quick]
 *                     [--config overrides.json] [--out DIR] [--tag name] [--findings notes.txt]
 *   dumpsDir   folder holding npcs.jsonl (NPC pack: `bin/ft-dump-pack npcs …`) and world-actors.jsonl (the world's actors —
 *              Tor-Wrath, the real L3 party, the named NPCs). Defaults to ./dumps. --npcs / --world override either file.
 *   --config   deep-merges a JSON object into CONFIG (objects merge, arrays replace). Every balance knob is in CONFIG.
 *   --out      output folder (default ./sim-combat-out): results[.tag].json, RESULTS[.tag].md, TABLES[.tag].md.
 *   Prints a one-block SCORE to stdout (also R.score in the results JSON and the top of RESULTS.md): misses vs the chassis targets
 *   (3 lights vs 1 Steward fair · 1 medium vs 1 fair in 3–4 rounds · heavy = a pair · boss = party of 4, someone likely drops),
 *   tier-entry swings, and the Tor-Wrath calibration (model L3 party vs 5 ≈ 70–90% win, vs 9 ≤ 10%).
 *
 * Mirrors (2026-11-12): prepareDerivedData (Integrity / Stress / Guard / Resolve, Evasion retired → Guard), rolls.attackTest
 * (rank dice: 2 reroll-lowest · 3 reroll-lowest then floor 4 · 4+ 3d10 keep 2 · 5 Legendary rescue; Master/Legendary die never
 * joins a disadvantage roll), threat chassis (attack / damage / defense / rank / pool / strikes), _ftTargetResistRoll (+ foe save
 * proficiency tier + rank), magicTest (Stewards: no current Clarity in the roll, DC ladder 15/19/22/25; overshoot without Clarity),
 * Surge (Bonus Die, class doom spends, Stitch / Field Patch (Tier+1)d6 + Tier, Bulwark eat-the-blow on either track), overshoot
 * bands, Last Stand / Getting It Together, graded arms (body armour with base Resolve 0 gains ⌈rank/2⌉ Resolve).
 * NOT modelled: movement / cover, prose-only abilities, most technique riders, foe casters, legendary actions (unwired).
 *
 * To replay the pre-2026-11-12 live rules: --config modules/bbttcc-master-content/tools/sim-combat.pre-2026-11-12.json.
 * Full write-up of the review that tuned these numbers: the 2026-11-12 combat balance package (CAPABILITIES.md §1).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load, derive, actorKind } from "./sim-combat-derive.mjs";
import { THREAT_CHASSIS } from "../../../systems/fourththing/threat-chassis.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = k => argv.includes(k);
const POS = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--") );
const TC = THREAT_CHASSIS, byBracket = key => Object.fromEntries(Object.entries(TC.bracket).map(([b, row]) => [b, [...row[key]]]));

// ═════════════════════════════════════════ CONFIG (every rule constant) ═════════════════════════════════════════
const CONFIG = {
  N: 2000, seed: 20261112, maxRounds: 20, dprRounds: 5,
  dumps: path.resolve(POS[0] || "dumps"),
  // ── tiers ──
  tierForLevel: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4], // index = level
  // ── threat chassis — the LIVE table, read from systems/fourththing/threat-chassis.js (2026-11-12: attack [0,0,2,3] damage [0,2,3,5]
  //    defense [0,1,2,3] rank [2,4,4,4]; medium pool [1.5,1.25,1.25,1.25] strikes [1,1,1,2]; heavy pool [3,2.5,2.5,2.5] strikes [2,2,2,3]) ──
  chassis: {
    attack: [...TC.attack], damage: [...TC.damage], defense: [...TC.defense], rank: [...TC.rank],
    pool: byBracket("pool"), strikes: byBracket("strikes"),
  },
  monsterLevelByTier: null,          // null = use each monster's stored level (builder writes 1/8/13/18); e.g. [1,6,11,16]
  monsterStressPoolMult: null,       // null = same as pool; else per-bracket override object like pool
  foeTierToHit: true,                // foeTierBonus = tier (module.js:18661)
  foeExplode: false,                 // surgeEnabled is false on every foe in the dumps
  // ── dice / ranks (SKILL_RANK_DATA; attackTest 18693-18800) ──
  rankMechanic: ["plain", "plain", "rerollLow", "rerollLowFloor4", "kh3", "kh3"],   // D (2026-11-12): Expert = reroll lowest, then floor 4 (was "floor4")
  rankFlat: [0, 1, 2, 3, 4, 5],
  legendaryRescue: true,             // rank 5: 1/fight on a miss: auto-hit if DC<=20 else +10 (Stewards AND T3/T4 monsters)
  actAgainOnDouble10: true,
  // ── defenses & pools (prepareDerivedData) ──
  guardBase: 10, resolveBase: 10,
  guardFac: ["violence", "body"], resolveFac: ["presence", "soul"],
  armorRankScale: [[0, 0], [0.5, 0], [1, 0], [1, 1], [1, 2], [1, 3]],
  armorFlatPerItem: true,            // false = Expert+ flat applied once per actor per stat
  intBase: { vanguard: 4, mid: 3, caster: 2 }, stressBase: { vanguard: 2, mid: 3, caster: 4 },
  // ── Steward progression model ──
  startArrayCap: 10,
  rankByLevel: [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5], // weapon + armor aptitude (2 pts at 3/6/9/12)
  gradeByTier: [0, 0, 1, 2, 3],      // index = tier: T1 base, T2 Inlaid, T3 Circuited, T4 Crowned (+N hit/+N dmg/+N each nonzero armor stat)
  strikerStrikesByTier: [0, 1, 2, 3, 4],
  helmBoots: false,                  // add Scrap Helm 1/0 + Boots 1/0 (graded) to every model Steward
  // ── Surge ──
  surgeCap: [0, 4, 6, 8, 10],
  overheatStrain: 1,
  strainRollPenalty: [0, 1, 1, 2, 2, 2, 2],
  strainHalvePoolsAt: 4, strainFallsAt: 6,
  startSurge: 0,
  surgePolicy: "smart",              // "none" | "smart"
  bonusDieCost: 1, bonusDieMinP: 0.10, bonusDieMaxP: 0.85,
  classDoomCost: 1, doomMinP: 0.55, doomMinTier: 2, // class "+Tier d6" spends (av-roll, bs-ambush …) prime the doomstrike flag
  stitchCost: 2, stitchAt: 0.4, fieldPatchCost: 4, fieldPatchAt: 0.4, braceCost: 1,
  genPerRoundCap: 2,
  // ── Manifestations (caster) ──
  clarityByTier: [0, 5, 7, 10, 14], tccClarityBonus: 5, tccDiscount: 1,
  tierClarity: [0, 1, 2, 3, 4],
  castDC: [0, 15, 19, 22, 25],       // I (2026-11-12): FT.CAST_DC_BY_TIER_STEWARD (was the foe ladder 12/14/16/18 + Clarity in the roll)
  castClarityInRoll: false,          // I (2026-11-12): a Steward's CURRENT Clarity no longer rides the cast roll (foes keep it — not modelled)
  workingDice: [null, "1d6", "2d6", "3d6", "3d10"], // median AUTO-shape damaging Working per derived tier (manifest-scores.json)
  workingShape: "auto",
  workingTypes: ["thermal", "psychic"], // the model caster carries one Integrity and one Stress Working per tier and picks per target
  workingState: null,                // e.g. "staggered": state landed on a hit (foe hitSave vs 11+2T+channel negates)              // "auto" (no roll; most common live shape) | "attack" (2d10x+intent+channel vs G/R)
  casterChaoticBonusCast: false,     // Shamanic (Action) + Chaotic (Bonus) double cast, +1 Clarity, +2 Noise, +1 die
  // ── Damage ──
  shakenStressMult: 2, shakenResolvePen: 2,
  // ── Overshoot ──
  overshootBands: [20, 30, 40, 50], overshootTierGate: "ge", // fire when attackerTier >= targetTier ("gt" = punch-down only)
  // ── Zero states ──
  // Last Stand / Getting It Together use real 2d10 dice: double-10 vision, any 1 = fail, else success. 3S → 1, 3F → out.
  // ── Foes ──
  flanking: true, flankMax: 3,       // melee: + floor(other standing melee allies / standing enemies), the code counts same-side tokens within 5 ft of the target
  foeTargeting: "random",
  foeWeaponPolicy: "best",           // "best" = GM picks the weapon with the best expected damage vs this target (exploits the weaker of Guard/Resolve) | "random"            // "random" | "lowest"
  aoeTargets: 2,                     // max Stewards caught by a foe area save-weapon (party fights)
  // ── calibration / parties ──
  party4: ["vanguard", "ranged", "caster", "support"],
  pair: ["vanguard", "ranged"],

  // ═══ FIX-PACKAGE SWITCHES (combat balance 2026-11-12, letters A–J). Every default = the LIVE rules after that package;
  //     "pre" = the value before it (replay them all with sim-combat.pre-2026-11-12.json). ═══
  // A. threat chassis — the numbers live in `chassis` above; this is the only extra switch:
  legendaryFoes: true,               // A-diag: a rank-5 monster gets the Legendary rescue. Live chassis rank is [2,4,4,4] (2026-11-12), so none do; pre = rank [2,4,5,5].
  // B. Steward / named-character Resolve growth: + resolveByTier[tier] (index = tier). k*(tier-1) ⇒ [0,0,k,2k,3k]. Monsters never.
  stewardResolveByTier: null,        // e.g. [0,0,2,4,6] (k=2); null = live (no term — package B shipped at k=0)
  // C. graded BODY armour with base resolveBonus 0 also gets the grade on Resolve
  gradeResolveR0: "halfRank",        // live = "halfRank" (+ceil(grade/2), build-item-ladder.mjs) | "rank" (+grade) | null = pre
  gradeResolveR0Slots: ["body"],     // which slots the C rule touches (analyst p4 = ["body","shield"])
  gradeResolveR0Flat: true,          // true = the new Resolve also unlocks the Expert+ armour-rank flat (+1/+2/+3) like any R>0 piece
  resolveArmorFlatOnce: false,       // C-alt (verifier, code-only): R0 pieces stay 0, but the Expert+ flat of the armour skill lands on Resolve once per actor
  // D. rank 3 dice: rankMechanic[3] = "rerollLowFloor4" (reroll lowest, THEN floor 4) is live; pre = "floor4"
  // E. Master/Legendary die vs disadvantage
  masterDisFix: true,                // live = true (no Master die at disadvantage: 3 dice keep WORST 2) | false = pre (Master+dis = 4 dice keep best 2) | "cancel" = verifier alt (plain 2d10)
  // F. Bulwark 'eat the blow' on either track
  eatBlowAnyTrack: true,             // live = true (fires on Stress damage too, _applyDamageToActor); false = pre; +2/round cap unchanged
  forgeAnyTrack: false,              // Soul-Smith forge on ally Stress damage too (NOT in package F — verifier said keep it Integrity-only; analyst dmgGenAnyTrack = both true)
  // G. Stitch / Field Patch
  stitchDice: [null, "2d6", "3d6", "4d6", "5d6"],  // index = tier; (Tier+1)d6 since 2026-11-12 (was 2d6 flat)  (+tier is always added)
  patchDice: [null, "2d6", "3d6", "4d6", "5d6"],
  fieldPatchMode: "lower",           // live = "lower" (heal the target's lower-% track, lift Incapacitated like Dying) | "integrity" = pre
  // H. foe save proficiency on resist/save rolls (_ftTargetResistRoll) — chassis monsters only
  foeSaveProf: "tierRank",           // live = "tierRank" (+tier + chassis.rank) | "rank" (+chassis.rank) | null = pre
  foeSaveBonus: null,                // explicit per-tier override array (index = tier), analyst form e.g. [0,3,6,8,9]; wins over foeSaveProf
  // I. casting (castClarityInRoll + castDC above are the cast-success half; castDC is Steward-only in this sim — no foe casters are modelled)
  castOvExcludeClarity: true,        // live = true (overshoot measured on total − current Clarity, magicTest → applyOvershoot); false = pre
  misfireScarred: "max",             // I-companion (live; reachable only once casts can fail): misfire 7-8 Scarred = max Clarity −1 → clamp current to max−1. "current" = −1 current. null = ignore
  // J. Blood Debt via game.fourththing.bloodDebt.add — correctness only, no combat effect; the sim always counts it (bloodDebtPerFight)
  // ── sim hygiene (not live rules) ──
  dedupeParen: true,                 // monster dedupe key strips /\s+\(?\d+\)?$/ (pack ∪ world "Ash Wolf (2)" copies); false = the old /\s+\d+$/
  lowConfidenceN: 2,                 // tier×bracket cells with n ≤ this are lowConfidence (excluded from SCORE misses)
};

function deepMerge(a, b) { for (const [k, v] of Object.entries(b)) { if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) deepMerge(a[k], v); else a[k] = v; } return a; }
const DEFAULTS = JSON.parse(JSON.stringify(CONFIG));
const cfgPath = opt("--config");
if (cfgPath) deepMerge(CONFIG, Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(cfgPath, "utf8"))).filter(([k]) => !k.startsWith("_"))));   // "_note"-style keys are comments
if (opt("--n")) CONFIG.N = Number(opt("--n"));
if (flag("--quick")) CONFIG.N = 300;
if (opt("--seed")) CONFIG.seed = Number(opt("--seed"));
const NPCS_FILE = path.resolve(opt("--npcs", path.join(CONFIG.dumps, "npcs.jsonl")));
const WORLD_FILE = path.resolve(opt("--world", path.join(CONFIG.dumps, "world-actors.jsonl")));
for (const f of [NPCS_FILE, WORLD_FILE]) if (!fs.existsSync(f)) { console.error(`ft-sim-combat: no dump at ${f} — pass a dumps folder (npcs.jsonl + world-actors.jsonl) or --npcs / --world`); process.exit(2); }
const OUT = path.resolve(opt("--out", "sim-combat-out"));
const TAG = opt("--tag", cfgPath ? path.basename(cfgPath, ".json") : "baseline");
const C = CONFIG;

// ═════════════════════════════════════════ RNG + dice ═════════════════════════════════════════
let _s = C.seed >>> 0;
const rnd = () => { _s = (_s + 0x6D2B79F5) >>> 0; let t = _s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const d = n => 1 + Math.floor(rnd() * n);
const pick = a => a[Math.floor(rnd() * a.length)];
const FCACHE = new Map();
function parseFormula(f) {
  let p = FCACHE.get(f); if (p) return p;
  p = { dice: [], flat: 0 };
  for (const m of String(f || "0").replace(/\s+/g, "").replace(/@[\w.]+/g, "0").matchAll(/([+-]?)(\d*)d(\d+)(?:x\d+)?|([+-]?)(\d+)/g)) {
    if (m[3]) p.dice.push({ s: m[1] === "-" ? -1 : 1, n: Number(m[2] || 1), x: Number(m[3]) });
    else if (m[5]) p.flat += (m[4] === "-" ? -1 : 1) * Number(m[5]);
  }
  FCACHE.set(f, p); return p;
}
function rollFormula(f, extraDice = 0, maxFaces = false) {
  const p = parseFormula(f); let t = p.flat;
  p.dice.forEach((g, i) => { const n = g.n + (i === 0 ? extraDice : 0); for (let k = 0; k < n; k++) t += g.s * (maxFaces ? g.x : d(g.x)); });
  return t;
}
const meanFormula = f => { const p = parseFormula(f); return p.flat + p.dice.reduce((s, g) => s + g.s * g.n * (g.x + 1) / 2, 0); };
function chain(explode) { const face = d(10); let extra = 0, n = 0, v = face; while (explode && v === 10) { v = d(10); extra += v; n++; } return { face, extra, n }; }
function xd10(explode) { const a = chain(explode), b = chain(explode); return { total: a.face + b.face + a.extra + b.extra, n: a.n + b.n, d10: a.face === 10 && b.face === 10 }; }

/** Strike / check dice per SKILL rank mechanic. mode: "normal" | "dis". Returns {dice, expl, double10}. */
function rankRoll(rank, mode, explode) {
  const r = Math.max(0, Math.min(5, rank)), mech = C.rankMechanic[r], master = mech === "kh3";
  const ex = explode && mode === "normal";
  // E. live (module.js 18822/18826): Master + dis = 4 dice keep BEST 2. masterDisFix true (manifest-01): no Master die under dis,
  //    3 dice keep WORST 2. "cancel" (verifier alt): the Master die and the dis die cancel → plain 2d10.
  const mdf = C.masterDisFix, dis = mode === "dis";
  const n = mdf && master && dis ? (mdf === "cancel" ? 2 : 3) : 2 + (mode !== "normal" ? 1 : 0) + (master ? 1 : 0);
  const ds = []; for (let i = 0; i < n; i++) ds.push(chain(ex));
  if (mech === "rerollLow" || mech === "rerollLowFloor4") { const i = ds[0].face <= ds[1].face ? 0 : 1; const x = d(10); if (x > ds[i].face) ds[i] = { face: x, extra: 0, n: 0 }; }
  if (mech === "floor4" || mech === "rerollLowFloor4") for (const q of ds) q.face = Math.max(4, q.face);
  const keepBest = mdf ? !dis : !(dis && !master);
  const faces = ds.map(q => q.face).sort((a, b) => keepBest ? b - a : a - b);
  const kept = faces.slice(0, 2);
  let expl = 0, extra = 0; for (const q of ds) { expl += q.n; extra += q.extra; }
  return { dice: kept[0] + kept[1] + extra, expl, double10: kept[0] === 10 && kept[1] === 10 };
}
// P(dice >= need) tables for policy decisions (rank × explode × bonusDie)
const PT = {};
function buildPT() {
  for (let r = 0; r <= 5; r++) for (const ex of [true, false]) for (const bd of [false, true]) {
    const cnt = new Float64Array(160); const M = 60000;
    for (let i = 0; i < M; i++) { let v = rankRoll(r, "normal", ex).dice; if (bd) { const b = chain(true); v += b.face + b.extra; } v = Math.min(159, v); cnt[v]++; }
    const ge = new Float64Array(161); for (let v = 159; v >= 0; v--) ge[v] = ge[v + 1] + cnt[v] / M;
    PT[`${r}|${ex}|${bd}`] = ge;
  }
}
const pGE = (rank, ex, bd, need) => { const t = PT[`${Math.max(0, Math.min(5, rank))}|${ex}|${bd}`]; need = Math.ceil(need); return need <= 0 ? 1 : need >= 160 ? 0 : t[need]; };

// ═════════════════════════════════════════ damage types ═════════════════════════════════════════
const TRACK = { kinetic: "integrity", electrical: "integrity", thermal: "integrity", chemical: "integrity", poison: "integrity", sephirotic: "integrity", psychic: "stress", qliphothic: "stress", radiation: "radiation" };
const trackOf = t => TRACK[t] || "integrity";
const defFor = t => trackOf(t) === "stress" ? "resolve" : "guard";
function typeMult(tgt, type) {
  const base = String(type).split(":")[0];
  if (tgt.imm.has(base) || tgt.imm.has(type)) return 0;
  let m = (tgt.vul.has(base) || tgt.vul.has(type)) ? 2 : 1;
  if (tgt.res.has(base) || tgt.res.has(type)) m *= 0.5;
  return m;
}

// ═════════════════════════════════════════ Steward builds ═════════════════════════════════════════
const FAC = ["violence", "intrigue", "presence", "body", "mind", "soul"];
const BUILDS = {
  vanguard: { label: "Bulwark — vanguard striker (Maul, heavy+shield)", cls: "bulwark", array: [4, 2, 3, 5, 3, 2], order: ["violence", "body", "soul"], bracket: "vanguard", striker: true, tcc: false,
    weapon: { name: "Maul", die: "1d12", skill: "melee", type: "kinetic", intent: "violence", ranged: false },
    armorSkill: "plating", armor: [{ n: "Riot Armor", g: 3, r: 0, gate: "plating", slot: "body" }, { n: "Riot Shield", g: 2, r: 0, gate: "bracing", slot: "shield" }], res: [], gen: "eatBlow", doom: true },
  ranged: { label: "Shadow Courier — mid striker (Hunting Rifle, light)", cls: "shadow courier", array: [4, 5, 3, 3, 2, 2], order: ["intrigue", "violence", "body"], bracket: "mid", striker: true, tcc: false,
    weapon: { name: "Hunting Rifle", die: "1d10", skill: "firearms", type: "kinetic", intent: "violence", ranged: true },
    armorSkill: "fitting", armor: [{ n: "Ballistic Vest", g: 2, r: 0, gate: "fitting", slot: "body" }], res: [], gen: "move", doom: true },
  caster: { label: "Wyrdlens Adept — TCC caster (Workings; Knuckle Dusters fallback)", cls: "wyrdlens adept", array: [2, 3, 3, 2, 5, 4], order: ["mind", "soul", "presence"], bracket: "caster", striker: false, tcc: true,
    weapon: { name: "Knuckle Dusters", die: "1d6", skill: "brawl", type: "kinetic", intent: "violence", ranged: false },
    armorSkill: "fitting", armor: [{ n: "Initiate's Robe", g: 1, r: 1, gate: "fitting", slot: "body" }], res: [], gen: "castHit", doom: false,
    caster: { intent: "mind", channel: "soul" } },
  support: { label: "Harmony Marshal — support striker (Longsword, medium + Foam Finger)", cls: "harmony marshal", array: [2, 2, 5, 3, 3, 4], order: ["presence", "soul", "violence"], bracket: "vanguard", striker: true, tcc: false,
    weapon: { name: "Longsword", die: "1d8", skill: "melee", type: "kinetic", intent: "violence", ranged: false },
    armorSkill: "bracing", armor: [{ n: "Flak Jacket", g: 2, r: 0, gate: "bracing", slot: "body" }, { n: "Foam Finger", g: 1, r: 1, gate: "bracing", slot: "shield", res: ["kinetic"] }], res: [], gen: "harvest", doom: false, healer: true },
  defender: { label: "Soul-Smith — mid non-striker defender (Maul, heavy+shield)", cls: "soul-smith", array: [3, 2, 2, 4, 3, 5], order: ["soul", "body", "violence"], bracket: "mid", striker: false, tcc: false,
    weapon: { name: "Maul", die: "1d12", skill: "melee", type: "kinetic", intent: "violence", ranged: false },
    armorSkill: "plating", armor: [{ n: "Riot Armor", g: 3, r: 0, gate: "plating", slot: "body" }, { n: "Riot Shield", g: 2, r: 0, gate: "bracing", slot: "shield" }], res: [], gen: "forge", doom: false },
};
const BUILD_KEYS = Object.keys(BUILDS);

function facultiesAt(b, L) {
  const f = Object.fromEntries(FAC.map((k, i) => [k, b.array[i]]));
  for (let lv = 2; lv <= L; lv++) {
    let placed = false;
    for (let k = 0; k < 3 && !placed; k++) { const key = b.order[(lv - 2 + k) % 3]; if (f[key] < C.startArrayCap) { f[key]++; placed = true; } }
    if (!placed) { const key = FAC.filter(k => f[k] < C.startArrayCap).sort((a, c) => f[a] - f[c])[0]; if (key) f[key]++; }
  }
  return f;
}
/** B. Steward / named-character Resolve tier term (never chassis monsters). */
const resolveTierTerm = T => (C.stewardResolveByTier ? (C.stewardResolveByTier[T] || 0) : 0);
function armorValue(raw, rank, flatAllowed = true) { const [mu, fl] = C.armorRankScale[Math.max(0, Math.min(5, rank))] || [0, 0]; return raw > 0 ? Math.round(raw * mu) + (flatAllowed ? fl : 0) : 0; }

function makeModelSteward(key, L, idx = 0) {
  const b = BUILDS[key], T = C.tierForLevel[Math.min(20, L)] || 4, grade = C.gradeByTier[T];
  const A = facultiesAt(b, L), rank = C.rankByLevel[Math.min(20, L)];
  const skills = { [b.weapon.skill]: rank, plating: 0, bracing: 0, fitting: 0 }; skills[b.armorSkill] = rank;
  // cascade Plating ⇒ Bracing ⇒ Fitting
  skills.bracing = Math.max(skills.bracing, skills.plating); skills.fitting = Math.max(skills.fitting, skills.bracing);
  const armor = b.armor.map(x => ({ ...x })); if (C.helmBoots) armor.push({ n: "Scrap Helm", g: 1, r: 0, gate: "fitting", slot: "head" }, { n: "Boots", g: 1, r: 0, gate: "fitting", slot: "feet" });
  let ag = 0, ar = 0, flatUsedG = false, flatUsedR = false; const res = new Set(b.res);
  for (const it of armor) {
    const rk = skills[it.gate] || 0, rg = it.g > 0 ? it.g + grade : 0;
    let rr = it.r > 0 ? it.r + grade : 0, flatR = true;
    // C. graded body armour with base Resolve 0 also gets the grade on Resolve
    if (it.r <= 0 && grade > 0 && C.gradeResolveR0 && (C.gradeResolveR0Slots || ["body"]).includes(it.slot)) {
      rr = C.gradeResolveR0 === "halfRank" ? Math.ceil(grade / 2) : grade; flatR = !!C.gradeResolveR0Flat;
    }
    ag += armorValue(rg, rk, C.armorFlatPerItem || !flatUsedG); if (rg > 0) flatUsedG = true;
    ar += armorValue(rr, rk, flatR && (C.armorFlatPerItem || !flatUsedR)); if (rr > 0 && flatR) flatUsedR = true;
    if (rk >= 1) for (const r of it.res || []) res.add(r);
  }
  // C-alt: the armour skill's Expert+ flat lands on Resolve once per actor (only if no piece already granted it)
  if (C.resolveArmorFlatOnce && !flatUsedR) ar += (C.armorRankScale[Math.max(0, Math.min(5, skills[b.armorSkill] || 0))] || [0, 0])[1];
  const guard = C.guardBase + C.guardFac.reduce((s, k) => s + A[k], 0) + ag;
  const resolve = C.resolveBase + C.resolveFac.reduce((s, k) => s + A[k], 0) + ar + resolveTierTerm(T);
  const intMax = 10 + 3 * A.body + (L - 1) * (C.intBase[b.bracket] + Math.floor(A.body / 2));
  const strMax = 10 + 2 * A.mind + A.soul + (L - 1) * (C.stressBase[b.bracket] + Math.floor(A.mind / 2));
  const w = b.weapon;
  const weapon = { name: w.name + (grade ? ` +${grade}` : ""), formula: w.die + (grade ? `+${grade}` : ""), type: w.type, intent: w.intent, rankRaw: skills[w.skill] || 0,
    atkMod: A[w.intent] + (skills[w.skill] || 0) + grade, dmgFlat: A[w.intent], ranged: w.ranged, parts: [], states: [] };
  const clarityMax = C.clarityByTier[T] + (b.tcc ? C.tccClarityBonus : 0);
  return { id: `${key}${idx}`, key, label: b.label, side: "S", isSteward: true, isFoe: false, monster: false, stewardDrop: true, level: L, tier: T, A, skills,
    guard, resolve, intMax, strMax, res, vul: new Set(), imm: new Set(), weapons: [weapon], strikes: b.striker ? C.strikerStrikesByTier[T] : 1,
    surgeCap: C.surgeCap[T], clarityMax, tcc: b.tcc, gen: b.gen, doom: b.doom, healer: !!b.healer, caster: b.caster || null, armorG: ag, armorR: ar };
}

// Real Steward from a derived actor record (world-actors.jsonl) — used for the L3 calibration party
const GEN_BY_CLASS = { bulwark: "eatBlow", "shadow_courier": "move", "shadow courier": "move", "wyrdlens-adept": "castHit", wyrdlens_adept: "castHit", dreamwalker: "castHit", cosmic_linguist: "clTurn", pactkeeper: "none", aurablade: "hitNoBite", "soul-smith": "forge", harmonymarshal: "harvest" };
// The real casters' actual damaging T1 Workings (manifest-scores.json): Marmalade The Real Shape 1d6 psychic auto + Blinded (hitSave);
// Marginalia Strikethrough 1d6 psychic + Staggered; JESSIE Penalty Clause 1d6 qliphothic auto + Staggered (hitSave)
const REAL_CASTER = { Marmalade: { types: ["psychic", "electrical"], state: "blinded", intent: "mind" }, Marginalia: { types: ["psychic"], state: "staggered", intent: "mind" }, JESSIE: { types: ["qliphothic"], state: "staggered", intent: "presence" } };
const TCC_IDS = new Set(["cosmic_linguist", "wyrdlens-adept", "wyrdlens_adept", "dreamwalker", "pactkeeper"]);
function makeRealSteward(m) {
  const T = C.tierForLevel[Math.min(20, m.level)] || 4, cls = (m.cls || "").toLowerCase();
  const tcc = TCC_IDS.has(cls);
  const weapons = m.weapons.filter(w => w.formula && w.formula !== "0" && !w.saveFirst).map(w => ({ name: w.name, formula: w.formula, type: w.type, intent: w.intent,
    rankRaw: m.skills[w.skill] || 0, atkMod: m.attrs[w.intent] + (m.skills[w.skill] || 0) + (w.grade || 0), dmgFlat: m.attrs[w.intent], ranged: w.ranged,
    parts: w.parts || [], states: [], isForm: w.isForm, formTier: w.formTier }));
  const intent = m.attrs.mind >= m.attrs.presence ? "mind" : "presence";
  return { id: m.name, key: m.name, label: `${m.name} (L${m.level} ${m.clsName})`, side: "S", isSteward: true, isFoe: false, monster: false, stewardDrop: true, level: m.level, tier: T, A: m.attrs, skills: m.skills,
    guard: m.guard, resolve: m.resolve + resolveTierTerm(T), intMax: m.intMax, strMax: m.strMax, res: new Set(m.res), vul: new Set(m.vul), imm: new Set(m.imm), weapons, strikes: m.strikes,
    surgeCap: C.surgeCap[T], clarityMax: C.clarityByTier[T] + (tcc ? C.tccClarityBonus : 0), tcc, gen: GEN_BY_CLASS[cls] || "none", doom: false, healer: cls === "harmonymarshal",
    caster: tcc ? { intent, channel: "soul", ...(REAL_CASTER[m.name.split(" ")[0]] || {}) } : null, formClarity: true };
}

// ═════════════════════════════════════════ Foes ═════════════════════════════════════════
function prepMonster(m) {
  const t = m.th.tier - 1, br = m.th.bracket, A = m.attrs, ch = C.chassis;
  const L = C.monsterLevelByTier ? C.monsterLevelByTier[t] : m.level;
  const intPre = 10 + 3 * A.body + (L - 1) * (3 + Math.floor(A.body / 2));
  const strPre = 10 + 2 * A.mind + A.soul + (L - 1) * (3 + Math.floor(A.mind / 2));
  const pool = ch.pool[br][t], spool = C.monsterStressPoolMult ? C.monsterStressPoolMult[br][t] : pool;
  const tier = m.th.tier;
  const weapons = m.weapons.filter(w => w.formula && w.formula !== "0").map(w => {
    const rankRaw = Math.max(m.skills[w.skill] || 0, ch.rank[t]);
    return { name: w.name, formula: w.formula, type: w.type, intent: w.intent, rankRaw, atkMod: A[w.intent] + rankRaw + (C.foeTierToHit ? tier : 0) + ch.attack[t] + (w.grade || 0),
      dmgFlat: A[w.intent] + ch.damage[t], ranged: w.ranged, parts: w.parts || [], states: w.states || [], stateDur: w.stateDur, saveEachRound: w.saveEachRound, stateSaveAttr: w.stateSaveAttr,
      saveFirst: w.saveFirst, saveAttr: w.saveAttr, saveDc: w.saveDc, onSave: w.onSave, area: w.area, recharge: w.recharge, ultimate: w.ultimate, nonlethal: w.nonlethal,
      simpleSave: /^(\d+)(d\d+)([+-]\d+)?$/.test(String(w.formula).replace(/\s+/g, "")) };
  });
  return { id: m.id, key: m.name, label: `${m.name} (T${tier} ${br})`, name: m.name, side: "F", isSteward: false, isFoe: true, monster: true, stewardDrop: false, level: L, tier, bracket: br, A, skills: m.skills,
    guard: m.guard - m.th.defense + ch.defense[t], resolve: m.resolve - m.th.defense + ch.defense[t],
    intMax: Math.max(1, Math.round(intPre * pool)), strMax: Math.max(1, Math.round(strPre * spool)),
    res: new Set(m.res), vul: new Set(m.vul), imm: new Set(m.imm), weapons, strikes: ch.strikes[br][t], surgeCap: 0, clarityMax: 0 };
}
function prepNamed(m) {
  const T = Math.max(1, Math.min(4, m.detailsTier));
  const weapons = m.weapons.filter(w => w.formula && w.formula !== "0").map(w => ({ name: w.name, formula: w.formula, type: w.type, intent: w.intent, rankRaw: m.skills[w.skill] || 0,
    atkMod: m.attrs[w.intent] + (m.skills[w.skill] || 0) + (C.foeTierToHit ? T : 0) + (w.grade || 0), dmgFlat: m.attrs[w.intent], ranged: w.ranged, parts: w.parts || [], states: w.states || [], stateDur: w.stateDur,
    saveFirst: w.saveFirst, saveAttr: w.saveAttr, saveDc: w.saveDc, onSave: w.onSave, area: w.area, recharge: w.recharge, ultimate: w.ultimate, simpleSave: /^(\d+)(d\d+)([+-]\d+)?$/.test(String(w.formula).replace(/\s+/g, "")) }));
  return { id: m.id, key: m.name, label: `${m.name} (named L${m.level} T${T})`, name: m.name, side: "F", isSteward: false, isFoe: true, monster: false, stewardDrop: m.type === "character", level: m.level, tier: T, bracket: "named", A: m.attrs, skills: m.skills,
    guard: m.guard, resolve: m.resolve + (m.type === "character" ? resolveTierTerm(C.tierForLevel[Math.max(1, Math.min(20, m.level))] || 4) : 0), intMax: m.intMax, strMax: m.strMax, res: new Set(m.res), vul: new Set(m.vul), imm: new Set(m.imm), weapons, strikes: m.strikes, surgeCap: 0, clarityMax: 0 };
}

// ═════════════════════════════════════════ combat state ═════════════════════════════════════════
function spawn(t) {
  return { ...t, int: t.intMax, str: t.strMax, intMaxNow: t.intMax, strMaxNow: t.strMax, surge: t.isSteward ? C.startSurge : 0, strain: 0, clarity: t.clarityMax, noise: 0,
    down: false, dead: false, dying: false, incap: false, ls: null, out: false, cond: {}, brace: 0, legendaryUsed: false, recharge: {}, gen: t.gen, genCount: 0, harvestCount: 0, allyGen: 0,
    actAgainUsed: false, bonusDie: false, doomArmed: false, everDropped: false, dropTrack: null, dropRound: null, bd: 0, bloodiedFired: false };
}
const standing = c => !c.down && !c.dying && !c.incap && !c.dead && !c.out;
const strainPen = c => C.strainRollPenalty[Math.min(6, c.strain)] || 0;

function newStats() { return { sAtk: 0, sHit: 0, sDmgInt: 0, sDmgStr: 0, fAtk: 0, fHit: 0, fDmgInt: 0, fDmgStr: 0, surgeGained: 0, surgeSpent: 0, overheat: 0, ovRipple: 0, ovTear: 0, ovRupture: 0, ovSunder: 0, ovStrikes: 0,
  casts: 0, castFail: 0, castDmg: 0, clarityPaid: 0, castOvTear: 0, castOvRupture: 0, castOvRipple: 0, castsCounted: 0, bonusDice: 0, dooms: 0, stitches: 0, patches: 0, braces: 0, fOvRipple: 0, legS: 0, legF: 0, bloodDebt: 0, lifts: 0 }; }

function bankSurge(c, n, ctx, { bite = true, harvestSrc = null } = {}) {
  if (!c.isSteward || n <= 0) return;
  for (let i = 0; i < n; i++) {
    if (c.surge < c.surgeCap) { c.surge++; ctx.st.surgeGained++; }
    else if (bite) { gainStrain(c, C.overheatStrain, ctx); ctx.st.overheat++; }
  }
  // Harmony Marshal harvest: +1 per ally explosion within 30 ft, ≤2/round, never bites
  if (harvestSrc !== false) for (const a of ctx.S) if (a !== c && a.gen === "harvest" && standing(a) && a.harvestCount < C.genPerRoundCap) {
    const k = Math.min(n, C.genPerRoundCap - a.harvestCount); a.harvestCount += k; for (let i = 0; i < k; i++) if (a.surge < a.surgeCap) { a.surge++; ctx.st.surgeGained++; }
  }
}
function gainStrain(c, n, ctx) {
  c.strain = Math.min(6, c.strain + n);
  if (c.strain >= C.strainHalvePoolsAt) { c.intMaxNow = Math.floor(c.intMax / 2); c.strMaxNow = Math.floor(c.strMax / 2); c.int = Math.min(c.int, c.intMaxNow); c.str = Math.min(c.str, c.strMaxNow); }
  if (c.strain >= C.strainFallsAt && !c.dying) { c.int = 0; enterZero(c, "integrity", ctx); }
}
function enterZero(c, track, ctx) {
  if (!c.everDropped) { c.everDropped = true; c.dropTrack = track; c.dropRound = ctx.round; }
  if (!c.stewardDrop) { c.down = true; return; }
  if (track === "integrity") { if (!c.dying) { c.dying = true; c.ls = { s: 0, f: 0 }; } }
  else if (!c.incap) { c.incap = true; c.gs = { s: 0, f: 0 }; }
}

/** Apply damage. Returns damage actually removed. */
function applyDamage(tgt, amount, type, ctx, src) {
  const track = trackOf(type); if (track === "radiation") return 0;
  if (amount <= 0) return 0;
  let m = typeMult(tgt, type);
  if (track === "stress" && tgt.cond.shaken && m > 0 && !(tgt.vul.has(type))) m *= C.shakenStressMult;
  const dmg = Math.floor(amount * m); if (dmg <= 0) return 0;
  if (track === "integrity") {
    if (tgt.dying) { tgt.ls.f += dmg >= 5 * tgt.tier ? 2 : 1; if (tgt.ls.f >= 3) { tgt.dead = true; tgt.dying = false; } return dmg; }
    const before = tgt.int; tgt.int = Math.max(0, tgt.int - dmg);
    if (src?.nonlethal && tgt.int === 0) tgt.int = 1;
    const removed = before - tgt.int, zeroed = tgt.int === 0 && before > 0;
    if (zeroed) enterZero(tgt, "integrity", ctx);
    // generators on taking damage
    if (tgt.gen === "eatBlow" && tgt.genCount < C.genPerRoundCap) { tgt.genCount++; bankSurge(tgt, 1, ctx, { harvestSrc: false }); }
    if (tgt.isSteward) for (const a of ctx.S) if (a !== tgt && a.gen === "forge" && standing(a) && a.allyGen < C.genPerRoundCap) { a.allyGen++; bankSurge(a, 1, ctx, { harvestSrc: false }); }
    return removed;
  } else {
    if (tgt.incap) return dmg;
    const before = tgt.str; tgt.str = Math.max(0, tgt.str - dmg);
    if (tgt.str === 0 && before > 0) enterZero(tgt, "stress", ctx);
    // F. eat-the-blow on either track (module.js ~19828); forge stays Integrity-only unless forgeAnyTrack
    if (C.eatBlowAnyTrack && tgt.gen === "eatBlow" && tgt.genCount < C.genPerRoundCap) { tgt.genCount++; bankSurge(tgt, 1, ctx, { harvestSrc: false }); }
    if (C.forgeAnyTrack && tgt.isSteward) for (const a of ctx.S) if (a !== tgt && a.gen === "forge" && standing(a) && a.allyGen < C.genPerRoundCap) { a.allyGen++; bankSurge(a, 1, ctx, { harvestSrc: false }); }
    return before - tgt.str;
  }
}

function overshoot(att, tgt, over, ctx, kind) {
  const gate = C.overshootTierGate === "gt" ? att.tier > tgt.tier : att.tier >= tgt.tier;
  if (tgt && !gate) return;
  const [r1, r2, r3, r4] = C.overshootBands; const st = ctx.st;
  if (over < r1) return;
  if (!att.isSteward) { st.fOvRipple++; return; }
  if (kind === "cast") { if (over >= r3) st.castOvRupture++; else if (over >= r2) st.castOvTear++; else st.castOvRipple++; }
  else { if (over >= r4) st.ovSunder++; else if (over >= r3) st.ovRupture++; else if (over >= r2) st.ovTear++; else st.ovRipple++; }
  if (over >= r2 && over < r3) { if (att.surge > 0) att.surge--; else att.noise = Math.min(10, att.noise + 1); }
  if (over >= r3) { att.bd++; st.bloodDebt++; } // J: live writes system.bloodDebt.value raw; the fix routes it via bloodDebt.add — same +1, ledger-visible
  if (over >= r4) att.clarity = Math.max(0, att.clarity - 1);
}

function applyStates(tgt, w, ctx, att) {
  if (!w.states?.length || !tgt.isSteward) return;
  // on-hit rider save if the weapon carries a saveAttribute (and isn't save-first)
  if (!w.saveFirst && w.saveAttr && w.saveDc) { const s = saveRoll(tgt, w.saveAttr, ctx); if (s >= w.saveDc) return; }
  for (const s of w.states) {
    const dur = w.stateDur === "until-saved" ? { save: true, attr: w.stateSaveAttr || w.saveAttr || "soul", dc: w.saveDc || 13 } : w.stateDur === "scene" ? { scene: true } : { turns: 1 };
    tgt.cond[s] = dur;
  }
}
/** H. chassis-monster save proficiency (module.js _ftTargetResistRoll ~18353). Live = 0. */
function foeSaveProf(c) {
  if (c.isSteward || !c.monster) return 0;
  if (C.foeSaveBonus) return C.foeSaveBonus[c.tier] || 0;
  const rk = C.chassis.rank[c.tier - 1] || 0;
  return C.foeSaveProf === "rank" ? rk : C.foeSaveProf === "tierRank" ? c.tier + rk : 0;
}
function saveRoll(c, attr, ctx) { const r = xd10(c.isSteward); if (c.isSteward) bankSurge(c, r.n, ctx); return r.total + (c.A[attr] || 0) - strainPen(c) + foeSaveProf(c); }

// ── Strike ──
function strike(att, tgt, w, ctx, opts = {}) {
  const st = ctx.st, defKey = defFor(w.type);
  let flank = 0;
  if (C.flanking && !w.ranged && ctx.S && !opts.noFlank) { const mine = att.side === "S" ? ctx.S : ctx.F, theirs = att.side === "S" ? ctx.F : ctx.S;
    const others = mine.filter(x => x !== att && standing(x) && !(x.weapons[0]?.ranged) && !x.caster).length, n = Math.max(1, theirs.filter(standing).length); flank = Math.min(C.flankMax, Math.floor(others / n)); }
  let mod = w.atkMod + flank - strainPen(att) - (att.cond.staggered ? 2 : 0) + (tgt.cond.prone ? (w.ranged ? -2 : 2) : 0) + (tgt.cond.restrained ? 2 : 0) + (opts.penalty || 0);
  const def = tgt[defKey] + tgt.brace - (defKey === "resolve" && tgt.cond.shaken ? C.shakenResolvePen : 0);
  let mode = "normal"; if (att.cond.blinded || att.cond.imposed) mode = "dis"; if (att.cond.imposed) delete att.cond.imposed;
  const explode = att.isSteward || C.foeExplode;
  const r = Math.max(0, Math.min(5, w.rankRaw));
  // Surge spends (smart policy) — one-shots burn even on a miss
  let bonus = 0, doom = false;
  if (att.isSteward && C.surgePolicy === "smart" && !opts.noSpend) {
    const p = pGE(r, explode && mode === "normal", false, def - mod);
    if (att.surge >= C.bonusDieCost && p >= C.bonusDieMinP && p < C.bonusDieMaxP && mode === "normal") { att.surge -= C.bonusDieCost; st.surgeSpent += C.bonusDieCost; st.bonusDice++; const b = chain(true); bonus = b.face + b.extra; }
    else if (att.doom && att.tier >= C.doomMinTier && att.surge >= C.classDoomCost && p >= C.doomMinP) { att.surge -= C.classDoomCost; st.surgeSpent += C.classDoomCost; st.dooms++; doom = true; }
  }
  const roll = rankRoll(r, mode, explode);
  const total = roll.dice + mod + bonus;
  if (att.isSteward) { st.sAtk++; bankSurge(att, roll.expl, ctx); } else st.fAtk++;
  if (roll.double10 && C.actAgainOnDouble10) att._actAgain = true;
  let hit = total >= def;
  if (!hit && C.legendaryRescue && r === 5 && C.rankMechanic[5] === "kh3" && !att.legendaryUsed && (att.isSteward || C.legendaryFoes) && (def <= 20 || total + 10 >= def)) { att.legendaryUsed = true; hit = true; att.isSteward ? st.legS++ : st.legF++; }
  if (!hit) return { hit: false, dmg: 0 };
  if (att.isSteward) st.sHit++; else st.fHit++;
  let dmg = rollFormula(w.formula) + w.dmgFlat;
  if (doom) dmg += rollFormula(`${att.tier}d6`);
  const done = applyDamage(tgt, dmg, w.type, ctx, w);
  let dInt = 0, dStr = 0; (trackOf(w.type) === "stress" ? (dStr += done) : (dInt += done));
  for (const p of w.parts || []) { const x = applyDamage(tgt, rollFormula(p.formula), p.type, ctx, w); trackOf(p.type) === "stress" ? dStr += x : dInt += x; }
  if (att.isSteward) { st.sDmgInt += dInt; st.sDmgStr += dStr; st.ovStrikes++; } else { st.fDmgInt += dInt; st.fDmgStr += dStr; }
  overshoot(att, tgt, total - def, ctx, "strike");
  applyStates(tgt, w, ctx, att);
  if (att.gen === "hitNoBite" || att.gen === "forge") { if (att.genCount < C.genPerRoundCap) { att.genCount++; bankSurge(att, 1, ctx, { bite: false, harvestSrc: false }); } }
  return { hit: true, dmg: dInt + dStr };
}

// ── Save-first foe weapon (no attack roll; area) ──
function saveWeapon(att, targets, w, ctx) {
  const st = ctx.st;
  for (const tgt of targets) {
    st.fAtk++;
    const pass = saveRoll(tgt, w.saveAttr || "soul", ctx) >= w.saveDc;
    const mult = pass ? (w.onSave === "negate" ? 0 : 0.5) : 1;
    if (!pass) st.fHit++;
    if (w.simpleSave && mult > 0) {
      const base = Math.floor((rollFormula(w.formula) + w.dmgFlat) * mult);
      const x = applyDamage(tgt, base, w.type, ctx, w); trackOf(w.type) === "stress" ? st.fDmgStr += x : st.fDmgInt += x;
    }
    if (!pass && w.states?.length) { for (const s of w.states) tgt.cond[s] = w.stateDur === "until-saved" ? { save: true, attr: w.stateSaveAttr || w.saveAttr || "soul", dc: w.saveDc } : w.stateDur === "scene" ? { scene: true } : { turns: 1 }; }
  }
}

// ── Manifestation cast (Steward caster) ──
function castWorking(att, tgt, ctx, chaotic = false) {
  const st = ctx.st, T = att.tier, cv = att.caster;
  const cost = Math.max(1, C.tierClarity[T] + (chaotic ? 1 : 0) - (att.tcc ? C.tccDiscount : 0));
  if (att.clarity < cost) return null;
  const dc = C.castDC[T];
  const r = xd10(true);
  const clIn = C.castClarityInRoll ? att.clarity : 0; // I: magicTest posTotal adds CURRENT Clarity (module.js ~18057)
  const total = r.total + att.A[cv.intent] + att.A[cv.channel] + clIn - att.noise - strainPen(att);
  bankSurge(att, r.n, ctx);
  att.clarity -= cost; st.clarityPaid += cost; st.casts++;
  if (chaotic) att.noise = Math.min(10, att.noise + 2);
  if (total < dc) { // misfire
    st.castFail++;
    const m = Math.min(10, Math.max(1, d(10) + (chaotic ? 2 : 0) + (att.noise >= 8 ? 2 : att.noise >= 5 ? 1 : 0)));
    if (m === 3 || m === 4) applyDamage(att, rollFormula(["", "1d4", "1d6", "2d6", "2d6"][T]), "psychic", ctx);
    else if (m === 5 || m === 6) att.noise = Math.min(10, att.noise + 1);
    else if (m === 7 || m === 8) { if (C.misfireScarred === "current") att.clarity = Math.max(0, att.clarity - 1); else if (C.misfireScarred === "max") att.clarity = Math.min(att.clarity, Math.max(1, att.clarityMax - 1)); } /* Scarred: max Clarity −1 (FT.MISFIRE 7-8; module.js 13097) */
    else if (m === 9) att.cond.staggered = { turns: 1 };
    return { hit: false, dmg: 0 };
  }
  st.castsCounted++;
  overshoot(att, tgt, total - dc - (C.castOvExcludeClarity ? clIn : 0), ctx, "cast"); // I: applyOvershoot total (module.js ~18192)
  if (att.gen === "castHit" && att.genCount < C.genPerRoundCap) { att.genCount++; bankSurge(att, 1, ctx, { harvestSrc: false }); }
  if (att.gen === "clCast" && att.genCount < C.genPerRoundCap) { att.genCount++; bankSurge(att, 1, ctx, { harvestSrc: false }); }
  // choose type: thermal (Integrity/Guard) or psychic (Stress/Resolve)
  const opt = (cv.types || C.workingTypes).map(type => {
    const m = typeMult(tgt, type), track = trackOf(type), pool = track === "stress" ? tgt.str : tgt.int;
    let ph = 1; if (C.workingShape === "attack") ph = pGE(0, true, false, tgt[defFor(type)] - att.A[cv.intent] - att.A[cv.channel]);
    return { type, score: (m * ph) / Math.max(1, pool) };
  }).sort((a, b) => b.score - a.score)[0];
  if (C.workingShape === "attack") {
    const ar = xd10(true); bankSurge(att, ar.n, ctx);
    if (ar.total + att.A[cv.intent] + att.A[cv.channel] < tgt[defFor(opt.type)]) return { hit: false, dmg: 0 };
  }
  const dmg = rollFormula(C.workingDice[T], chaotic ? 1 : 0) + att.A[cv.intent];
  const done = applyDamage(tgt, dmg, opt.type, ctx);
  st.castDmg += done; trackOf(opt.type) === "stress" ? st.sDmgStr += done : st.sDmgInt += done;
  const state = cv.state !== undefined ? cv.state : C.workingState;
  if (state && !tgt.down) { const dc = 11 + 2 * T + att.A[cv.channel]; if (saveRoll(tgt, "soul", ctx) < dc) tgt.cond[state] = { turns: 1 }; }
  return { hit: true, dmg: done };
}

// ── target / weapon selection ──
function expHit(att, tgt, w) {
  const def = tgt[defFor(w.type)] + tgt.brace - (defFor(w.type) === "resolve" && tgt.cond.shaken ? C.shakenResolvePen : 0);
  const mod = w.atkMod - strainPen(att) + (tgt.cond.restrained ? 2 : 0);
  return pGE(w.rankRaw, att.isSteward || C.foeExplode, false, def - mod);
}
function expDmg(att, tgt, w) {
  const m = typeMult(tgt, w.type) * (trackOf(w.type) === "stress" && tgt.cond.shaken ? C.shakenStressMult : 1);
  return (meanFormula(w.formula) + w.dmgFlat) * m + (w.parts || []).reduce((s, p) => s + meanFormula(p.formula) * typeMult(tgt, p.type), 0);
}
function weaponReady(att, w) {
  if (w.ultimate && att.int > att.intMax / 2) return false;
  if (!w.recharge) return true;
  return att.recharge[w.name] !== false;
}
function chooseFoeWeapon(att, tgt, ctx) {
  let best = null, bv = -1;
  if (C.foeWeaponPolicy === "random") { const ready = att.weapons.filter(w => weaponReady(att, w)); return ready.length ? pick(ready) : null; }
  for (const w of att.weapons) {
    if (!weaponReady(att, w)) continue;
    let v;
    if (w.saveFirst) {
      const pass = pGE(0, true, false, w.saveDc - (tgt.A[w.saveAttr || "soul"] || 0));
      const mult = (1 - pass) + pass * (w.onSave === "negate" ? 0 : 0.5);
      const n = w.area ? Math.min(C.aoeTargets, ctx.S.filter(standing).length) : 1;
      v = (w.simpleSave ? (meanFormula(w.formula) + w.dmgFlat) * typeMult(tgt, w.type) * mult : 0) * n + (w.states?.length ? 2 * (1 - pass) * n : 0);
    } else v = expHit(att, tgt, w) * expDmg(att, tgt, w) + (w.states?.length ? 1 : 0);
    if (w.recharge) v *= 1.0001; // prefer spending a ready limited weapon on ties
    if (v > bv) { bv = v; best = w; }
  }
  return best;
}
function stewardEHP(att, tgt, w) {
  const m = typeMult(tgt, w.type); const pool = trackOf(w.type) === "stress" ? tgt.str : tgt.int;
  const p = expHit(att, tgt, w); const per = Math.max(0.1, p * (meanFormula(w.formula) + w.dmgFlat) * m);
  return pool / per;
}
function bestStewardWeapon(att, tgt) {
  let best = null, bv = -1;
  for (const w of att.weapons) { if (w.isForm && att.formClarity && att.clarity < 1) continue; const v = expHit(att, tgt, w) * expDmg(att, tgt, w); if (v > bv) { bv = v; best = w; } }
  return best || att.weapons[0];
}

// ═════════════════════════════════════════ turns ═════════════════════════════════════════
function zeroStateRoll(c) { const a = d(10), b = d(10); if (a === 10 && b === 10) return "vision"; if (a === 1 || b === 1) return "fail"; return "success"; }

function endTurnConditions(c, ctx) {
  for (const [k, v] of Object.entries(c.cond)) {
    if (v.turns != null) { v.turns--; if (v.turns <= 0) delete c.cond[k]; }
    else if (v.save) { if (saveRoll(c, v.attr, ctx) >= v.dc) delete c.cond[k]; }
  }
}

function stewardTurn(c, ctx) {
  const st = ctx.st;
  if (c.dead || c.out) return;
  c.brace = 0;
  if (c.dying) {
    const r = zeroStateRoll(c);
    if (r === "vision") { c.dying = false; c.int = 1; } else if (r === "fail") { c.ls.f++; if (c.ls.f >= 3) { c.dead = true; c.dying = false; } } else { c.ls.s++; if (c.ls.s >= 3) { c.dying = false; c.int = 1; } }
    return;
  }
  if (c.incap) {
    const r = zeroStateRoll(c);
    if (r === "vision") { c.incap = false; c.str = 1; } else if (r === "fail") { c.gs.f++; if (c.gs.f >= 3) { c.out = true; c.incap = false; } } else { c.gs.s++; if (c.gs.s >= 3) { c.incap = false; c.str = 1; } }
    return;
  }
  if (c.cond.prone) delete c.cond.prone; // stand up (movement)
  // generators at turn start
  if (c.gen === "move" && c.genCount < C.genPerRoundCap) { c.genCount++; bankSurge(c, 1, ctx, { harvestSrc: false }); }
  if (c.gen === "clTurn") { bankSurge(c, 1, ctx, { harvestSrc: false }); }
  // compelled / charmed: one strike at a random standing ally instead of acting
  if (c.cond.compelled || c.cond.charmed) {
    const allies = ctx.S.filter(a => a !== c && standing(a));
    if (allies.length) strike(c, pick(allies), c.weapons[0], ctx, { noSpend: true });
    endTurnConditions(c, ctx); return;
  }
  // smart Surge at turn start
  if (C.surgePolicy === "smart") {
    if (c.healer && c.surge >= C.fieldPatchCost) {
      // G. fieldPatchMode "lower": target's lower-% track, and Incapacitated is lifted like Dying (module.js ~7124-7130)
      const low = C.fieldPatchMode === "lower";
      const need = a => a.dying || (low && a.incap) || a.int < C.fieldPatchAt * a.intMaxNow || (low && a.str < C.fieldPatchAt * a.strMaxNow);
      const frac = a => low ? Math.min(a.int / a.intMaxNow, a.str / a.strMaxNow) : a.int / a.intMaxNow;
      const zero = a => low ? (a.dying || a.incap) : a.dying;
      const hurt = ctx.S.filter(a => a !== c && !a.dead && !a.out && need(a)).sort((a, b) => (zero(b) - zero(a)) || (frac(a) - frac(b)))[0];
      if (hurt) { c.surge -= C.fieldPatchCost; st.surgeSpent += C.fieldPatchCost; st.patches++; const h = rollFormula(C.patchDice[c.tier]) + c.tier;
        if (hurt.dying) { hurt.dying = false; hurt.int = Math.min(hurt.intMaxNow, h); st.lifts++; }
        else if (low && hurt.incap) { hurt.incap = false; hurt.str = Math.min(hurt.strMaxNow, h); st.lifts++; }
        else if (low && hurt.str / hurt.strMaxNow < hurt.int / hurt.intMaxNow) hurt.str = Math.min(hurt.strMaxNow, hurt.str + h);
        else hurt.int = Math.min(hurt.intMaxNow, hurt.int + h); }
    }
    if (c.surge >= C.stitchCost && (c.int < C.stitchAt * c.intMaxNow || c.str < C.stitchAt * c.strMaxNow)) {
      c.surge -= C.stitchCost; st.surgeSpent += C.stitchCost; st.stitches++; const h1 = rollFormula(C.stitchDice[c.tier]) + c.tier, h2 = rollFormula(C.stitchDice[c.tier]) + c.tier; /* G: module.js ~7120 */ c.int = Math.min(c.intMaxNow, c.int + h1); c.str = Math.min(c.strMaxNow, c.str + h2);
    }
  }
  let passes = 0;
  do {
    c._actAgain = false; passes++;
    const foes = ctx.F.filter(standing); if (!foes.length) return;
    if (c.caster) {
      // cast at own tier; fallback to weapon when Clarity runs out
      const tgt = chooseCasterTarget(c, foes);
      let res = castWorking(c, tgt, ctx, false);
      if (res && C.casterChaoticBonusCast) { const f2 = ctx.F.filter(standing); if (f2.length) castWorking(c, chooseCasterTarget(c, f2), ctx, true); }
      if (!res) { const t2 = foes.slice().sort((a, b) => stewardEHP(c, a, c.weapons[0]) - stewardEHP(c, b, c.weapons[0]))[0]; strike(c, t2, bestStewardWeapon(c, t2), ctx); }
    } else {
      for (let s = 0; s < c.strikes; s++) {
        const fs2 = ctx.F.filter(standing); if (!fs2.length) break;
        let best = null, bv = Infinity, bw = null;
        for (const f of fs2) { const w = bestStewardWeapon(c, f); const e = stewardEHP(c, f, w); if (e < bv) { bv = e; best = f; bw = w; } }
        if (bw.isForm && c.formClarity) c.clarity -= 1;
        strike(c, best, bw, ctx);
      }
    }
    // overheat avoidance: Brace when near cap
    if (C.surgePolicy === "smart" && c.surge >= c.surgeCap - 1 && c.surge >= C.braceCost) { c.surge -= C.braceCost; st.surgeSpent += C.braceCost; st.braces++; c.brace = 1; }
  } while (c._actAgain && passes < 2 && C.actAgainOnDouble10);
  endTurnConditions(c, ctx);
}
function chooseCasterTarget(c, foes) {
  return foes.slice().sort((a, b) => Math.min(a.int / Math.max(0.01, typeMult(a, "thermal")), a.str / Math.max(0.01, typeMult(a, "psychic"))) - Math.min(b.int / Math.max(0.01, typeMult(b, "thermal")), b.str / Math.max(0.01, typeMult(b, "psychic"))))[0];
}

function foeTurn(c, ctx) {
  if (!standing(c)) {
    if (c.stewardDrop && (c.dying || c.incap)) { // named NPC (character) follows the Steward path
      const r = zeroStateRoll(c), o = c.dying ? c.ls : c.gs;
      if (r === "vision" || (r === "success" && ++o.s >= 3)) { if (c.dying) { c.dying = false; c.int = 1; } else { c.incap = false; c.str = 1; } }
      else if (r === "fail" && ++o.f >= 3) { c.dead = true; c.dying = false; c.incap = false; }
    }
    return;
  }
  // recharge rolls at turn start
  for (const w of c.weapons) if (w.recharge && c.recharge[w.name] === false) {
    if (w.recharge.mode === "d6" && d(6) >= (w.recharge.min || 5)) c.recharge[w.name] = true;
    else if (w.recharge.mode === "nextTurn") c.recharge[w.name] = true;
  }
  let extra = 0;
  for (let s = 0; s < c.strikes + extra; s++) {
    const tg = ctx.S.filter(standing); if (!tg.length) return;
    const tgt = C.foeTargeting === "lowest" ? tg.sort((a, b) => (a.int + a.str) - (b.int + b.str))[0] : pick(tg);
    const w = chooseFoeWeapon(c, tgt, ctx); if (!w) return;
    if (w.recharge) c.recharge[w.name] = false;
    c._actAgain = false;
    if (w.saveFirst) {
      const others = tg.filter(x => x !== tgt).sort(() => rnd() - 0.5);
      const n = w.area ? Math.min(C.aoeTargets, tg.length) : 1;
      saveWeapon(c, [tgt, ...others].slice(0, n), w, ctx);
    } else strike(c, tgt, w, ctx);
    if (c._actAgain && extra === 0) extra = 1;
  }
  endTurnConditions(c, ctx);
}

function initiative(c) { const r = xd10(c.isSteward); return r.total + (c.A.intrigue || 0) + rnd(); }

function fight(Sproto, Fproto, opts = {}) {
  const S = Sproto.map(spawn), F = Fproto.map(spawn);
  const ctx = { S, F, round: 0, st: newStats() };
  const order = [...S, ...F].map(c => ({ c, i: initiative(c) })).sort((a, b) => b.i - a.i).map(x => x.c);
  let result = "timeout", rounds = C.maxRounds;
  outer: for (let rd = 1; rd <= C.maxRounds; rd++) {
    ctx.round = rd;
    for (const c of [...S, ...F]) { c.genCount = 0; c.harvestCount = 0; c.allyGen = 0; }
    for (const c of order) {
      if (c.side === "S") stewardTurn(c, ctx); else foeTurn(c, ctx);
      if (!F.some(standing)) { result = "win"; rounds = rd; break outer; }
      if (!S.some(standing) && !S.some(s => s.dying || s.incap)) { result = "loss"; rounds = rd; break outer; }
      if (!S.some(standing)) { result = "loss"; rounds = rd; break outer; } // every Steward down at once = the table loses the fight
    }
  }
  return { result, rounds, S, F, st: ctx.st };
}

// ═════════════════════════════════════════ cell runners ═════════════════════════════════════════
function runCell(makeS, makeF, N = C.N) {
  const agg = { n: N, win: 0, loss: 0, timeout: 0, roundsWin: 0, rounds: 0, anyDrop: 0, drops: 0, deaths: 0, sDropInt: 0, sDropStr: 0, fDropInt: 0, fDropStr: 0, firstDropRound: 0, firstDropN: 0,
    strainEnd: 0, stewards: 0, ...newStats() };
  for (let i = 0; i < N; i++) {
    const r = fight(makeS(), makeF());
    agg[r.result]++; agg.rounds += r.rounds; if (r.result === "win") agg.roundsWin += r.rounds;
    let any = false, first = Infinity;
    for (const s of r.S) { agg.stewards++; agg.strainEnd += s.strain; if (s.everDropped) { any = true; agg.drops++; s.dropTrack === "integrity" ? agg.sDropInt++ : agg.sDropStr++; first = Math.min(first, s.dropRound); } if (s.dead) agg.deaths++; }
    if (any) { agg.anyDrop++; agg.firstDropRound += first; agg.firstDropN++; }
    for (const f of r.F) if (f.everDropped) f.dropTrack === "integrity" ? agg.fDropInt++ : agg.fDropStr++;
    for (const k of Object.keys(r.st)) agg[k] += r.st[k];
  }
  const pct = x => +(100 * x / N).toFixed(1);
  return { win: pct(agg.win), loss: pct(agg.loss), timeout: pct(agg.timeout), meanRounds: +(agg.rounds / N).toFixed(2), meanRoundsWin: agg.win ? +(agg.roundsWin / agg.win).toFixed(2) : null,
    anyDrop: pct(agg.anyDrop), dropsPerFight: +(agg.drops / N).toFixed(2), deaths: +(agg.deaths / N).toFixed(3), firstDropRound: agg.firstDropN ? +(agg.firstDropRound / agg.firstDropN).toFixed(2) : null,
    stewardDropTrack: { integrity: agg.sDropInt, stress: agg.sDropStr }, foeDropTrack: { integrity: agg.fDropInt, stress: agg.fDropStr },
    sHitPct: agg.sAtk ? +(100 * agg.sHit / agg.sAtk).toFixed(1) : null, fHitPct: agg.fAtk ? +(100 * agg.fHit / agg.fAtk).toFixed(1) : null,
    sDmgPerFight: { integrity: +(agg.sDmgInt / N).toFixed(1), stress: +(agg.sDmgStr / N).toFixed(1) }, fDmgPerFight: { integrity: +(agg.fDmgInt / N).toFixed(1), stress: +(agg.fDmgStr / N).toFixed(1) },
    surgeSpentPerFight: +(agg.surgeSpent / N).toFixed(2), surgeGainedPerFight: +(agg.surgeGained / N).toFixed(2), overheatPerFight: +(agg.overheat / N).toFixed(3), strainEndPerSteward: +(agg.strainEnd / agg.stewards).toFixed(3),
    spendsPerFight: { bonusDie: +(agg.bonusDice / N).toFixed(2), doom: +(agg.dooms / N).toFixed(2), stitch: +(agg.stitches / N).toFixed(2), patch: +(agg.patches / N).toFixed(2), brace: +(agg.braces / N).toFixed(2), zeroLifts: +(agg.lifts / N).toFixed(3) },
    legendaryRescuesPerFight: { steward: +(agg.legS / N).toFixed(3), foe: +(agg.legF / N).toFixed(3) }, bloodDebtPerFight: +(agg.bloodDebt / N).toFixed(3),
    overshootPerStrike: agg.ovStrikes ? { ripple: +(agg.ovRipple / agg.sAtk * 100).toFixed(2), tear: +(agg.ovTear / agg.sAtk * 100).toFixed(2), rupturePlus: +((agg.ovRupture + agg.ovSunder) / agg.sAtk * 100).toFixed(3) } : null,
    castOvershoot: agg.castsCounted ? { ripple: +(agg.castOvRipple / agg.castsCounted * 100).toFixed(1), tear: +(agg.castOvTear / agg.castsCounted * 100).toFixed(1), rupturePlus: +(agg.castOvRupture / agg.castsCounted * 100).toFixed(2), castFailPct: +(agg.castFail / agg.casts * 100).toFixed(1) } : null };
}

// DPR dummy: Steward attacks random real monsters of tier Tf for R rounds (target pools infinite). Surge on/off.
function dprSteward(key, L, foesOfTier, policy, N = C.N) {
  const savePol = C.surgePolicy; C.surgePolicy = policy;
  const tot = { int: 0, str: 0, atk: 0, hit: 0, casts: 0, castDmg: 0, clarity: 0, ovR: 0, ovT: 0, ovRu: 0, cOvR: 0, cOvT: 0, cOvRu: 0, cc: 0, strikes: 0, strain: 0 };
  for (let i = 0; i < N; i++) {
    const s = spawn(makeModelSteward(key, L)); const proto = pick(foesOfTier); const f = spawn(proto); f.int = f.intMax = 1e9; f.str = f.strMax = 1e9;
    const ctx = { S: [s], F: [f], round: 0, st: newStats() };
    for (let rd = 1; rd <= C.dprRounds; rd++) { ctx.round = rd; s.genCount = 0; s.harvestCount = 0; if (s.gen === "eatBlow") { s.genCount++; bankSurge(s, 1, ctx, { harvestSrc: false }); } stewardTurn(s, ctx); }
    const st = ctx.st; tot.int += st.sDmgInt; tot.str += st.sDmgStr; tot.atk += st.sAtk; tot.hit += st.sHit; tot.casts += st.casts; tot.castDmg += st.castDmg; tot.clarity += st.clarityPaid;
    tot.ovR += st.ovRipple; tot.ovT += st.ovTear; tot.ovRu += st.ovRupture + st.ovSunder; tot.cOvR += st.castOvRipple; tot.cOvT += st.castOvTear; tot.cOvRu += st.castOvRupture; tot.cc += st.castsCounted; tot.strain += s.strain;
  }
  C.surgePolicy = savePol;
  const R = N * C.dprRounds;
  return { dpr: +((tot.int + tot.str) / R).toFixed(2), dprInt: +(tot.int / R).toFixed(2), dprStr: +(tot.str / R).toFixed(2), hitPct: tot.atk ? +(100 * tot.hit / tot.atk).toFixed(1) : null,
    castDmgPerCast: tot.casts ? +(tot.castDmg / tot.casts).toFixed(2) : null, castDmgPerClarity: tot.clarity ? +(tot.castDmg / tot.clarity).toFixed(2) : null, castsPerRound: +(tot.casts / R).toFixed(2),
    ovPerAtk: tot.atk ? { ripple: +(100 * tot.ovR / tot.atk).toFixed(2), tear: +(100 * tot.ovT / tot.atk).toFixed(2), rupturePlus: +(100 * tot.ovRu / tot.atk).toFixed(3) } : null,
    castOv: tot.cc ? { ripple: +(100 * tot.cOvR / tot.cc).toFixed(1), tear: +(100 * tot.cOvT / tot.cc).toFixed(1), rupturePlus: +(100 * tot.cOvRu / tot.cc).toFixed(2) } : null,
    strainAfter5: +(tot.strain / N).toFixed(2) };
}
// Foe DPR vs a build: foe attacks the Steward for R rounds, Steward pools infinite.
function dprFoe(foes, key, L, N = C.N) {
  let di = 0, ds = 0, atk = 0, hit = 0;
  for (let i = 0; i < N; i++) {
    const s = spawn(makeModelSteward(key, L)); s.int = s.intMax = s.intMaxNow = 1e9; s.str = s.strMax = s.strMaxNow = 1e9; s.surgeCap = 1e9; // dummy: no overheat
    const f = spawn(pick(foes)); const ctx = { S: [s], F: [f], round: 0, st: newStats() };
    for (let rd = 1; rd <= C.dprRounds; rd++) { ctx.round = rd; foeTurn(f, ctx); s.cond = {}; }
    di += ctx.st.fDmgInt; ds += ctx.st.fDmgStr; atk += ctx.st.fAtk; hit += ctx.st.fHit;
  }
  const R = N * C.dprRounds;
  return { dpr: +((di + ds) / R).toFixed(2), dprInt: +(di / R).toFixed(2), dprStr: +(ds / R).toFixed(2), hitPct: atk ? +(100 * hit / atk).toFixed(1) : null };
}
// Exact-ish hit% of an attack mod vs a defense
function pHit(rank, mod, def, explode) { return +(100 * pGE(rank, explode, false, def - mod)).toFixed(1); }
const median = a => { const s = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ═════════════════════════════════════════ MAIN ═════════════════════════════════════════
const t0 = Date.now();
buildPT();
const npcD = load(path.dirname(NPCS_FILE), path.basename(NPCS_FILE)), worldD = load(path.dirname(WORLD_FILE), path.basename(WORLD_FILE));
const npcDerived = npcD.actors.filter(a => !["faction", "rig", "facility"].includes(actorKind(a)) && a.type !== "rig").map(a => derive(a, npcD));
const worldDerived = worldD.actors.filter(a => !["faction", "rig", "facility"].includes(actorKind(a)) && a.type !== "rig").map(a => derive(a, worldD));
// monsters: pack ∪ world (dedupe by name, pack wins)
const seen = new Set(), monstersRaw = [];
for (const m of [...npcDerived, ...worldDerived]) if (m.kind === "monster" && m.th && m.weapons.some(w => w.formula && w.formula !== "0")) { const k = C.dedupeParen ? m.name.replace(/\s+\(?\d+\)?$/, "") : m.name.replace(/\s+\d+$/, ""); if (seen.has(k)) continue; seen.add(k); monstersRaw.push(m); }
const MON = monstersRaw.map(prepMonster);
const cell = (T, br) => MON.filter(m => m.tier === T && m.bracket === br);
const ofTier = T => MON.filter(m => m.tier === T);
const torWrath = prepMonster(worldDerived.find(m => /^Tor-Wrath/.test(m.name) && m.kind === "monster"));
const realL3 = ["Toran", "Marmalade", "Marginalia", "JESSIE"].map(n => worldDerived.find(m => m.name.startsWith(n) && m.type === "character")).filter(Boolean).map(makeRealSteward);
const namedNPCs = worldDerived.filter(m => m.type === "character" && m.kind === "npc" && m.weapons.some(w => w.formula && w.formula !== "0") && m.level >= 1).map(prepNamed);
const log = (...a) => console.error(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
log(`monsters ${MON.length}; named NPCs ${namedNPCs.length}; real L3 party ${realL3.map(s => s.id).join(",")}; N=${C.N}`);

// Bestiary census per tier × bracket (post-chassis)
const BR = ["light", "medium", "heavy", "boss"];
const census = {};
for (let T = 1; T <= 4; T++) for (const br of BR) {
  const c = cell(T, br); if (!c.length) continue;
  const gAtk = c.map(m => Math.max(...m.weapons.filter(w => !w.saveFirst && defFor(w.type) === "guard").map(w => w.atkMod), -99)).filter(x => x > -99);
  const rAtk = c.map(m => Math.max(...m.weapons.filter(w => !w.saveFirst && defFor(w.type) === "resolve").map(w => w.atkMod), -99)).filter(x => x > -99);
  census[`T${T}-${br}`] = { n: c.length, names: c.map(m => m.name), guard: median(c.map(m => m.guard)), resolve: median(c.map(m => m.resolve)), int: median(c.map(m => m.intMax)), stress: median(c.map(m => m.strMax)),
    strikes: median(c.map(m => m.strikes)), atkVsGuard: median(gAtk), atkVsResolve: median(rAtk), nWithResolveWeapon: rAtk.length, level: median(c.map(m => m.level)), lowConfidence: c.length <= C.lowConfidenceN };
}
const tierMed = {};
for (let T = 1; T <= 4; T++) { const c = ofTier(T); tierMed[T] = { guard: median(c.map(m => m.guard)), resolve: median(c.map(m => m.resolve)), rank: C.chassis.rank[T - 1],
  atkG: median(c.map(m => Math.max(...m.weapons.filter(w => !w.saveFirst && defFor(w.type) === "guard").map(w => w.atkMod), -99)).filter(x => x > -99)),
  atkR: median(c.map(m => Math.max(...m.weapons.filter(w => !w.saveFirst && defFor(w.type) === "resolve").map(w => w.atkMod), -99)).filter(x => x > -99)) }; }

const diffCfg = (a, b, pre = "") => Object.keys(b).flatMap(k => (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a?.[k] && typeof a[k] === "object" && !Array.isArray(a[k])) ? diffCfg(a[k], b[k], `${pre}${k}.`) : (JSON.stringify(a?.[k]) !== JSON.stringify(b[k]) ? [[`${pre}${k}`, b[k]]] : []));
const switchesChanged = Object.fromEntries(diffCfg(DEFAULTS, C).filter(([k]) => !["N", "seed"].includes(k)));
const R = { meta: { tag: TAG, N: C.N, seed: C.seed, generated: new Date().toISOString(), monsters: MON.length, config: C, switchesChanged }, census, tierMed, stewards: {}, hit: {}, dpr: {}, foeDpr: {}, enc: {}, calib: {}, named: [], curves: [], flags: [] };

// 0. Steward stat lines
for (const k of BUILD_KEYS) R.stewards[k] = [];
for (let L = 1; L <= 20; L++) for (const k of BUILD_KEYS) { const s = makeModelSteward(k, L); R.stewards[k].push({ L, T: s.tier, A: s.A, rank: s.weapons[0].rankRaw, atk: s.weapons[0].atkMod, dmg: +(meanFormula(s.weapons[0].formula) + s.weapons[0].dmgFlat).toFixed(1), strikes: s.strikes, guard: s.guard, resolve: s.resolve, int: s.intMax, stress: s.strMax, clarity: s.clarityMax, surgeCap: s.surgeCap, castAtk: s.caster ? s.A[s.caster.intent] + s.A[s.caster.channel] : null }); }

// 1. hit% tables
for (let L = 1; L <= 20; L++) {
  const T = C.tierForLevel[L]; R.hit[L] = {};
  for (const k of BUILD_KEYS) {
    const s = makeModelSteward(k, L), w = s.weapons[0], row = {};
    for (const dT of [-1, 0, 1]) { const Tf = T + dT; if (Tf < 1 || Tf > 4) continue; const m = tierMed[Tf];
      row[`T${Tf}`] = { vsGuard: pHit(w.rankRaw, w.atkMod, m.guard, true), vsResolve: pHit(w.rankRaw, w.atkMod, m.resolve, true),
        ...(s.caster ? { castAtkVsGuard: pHit(0, s.A[s.caster.intent] + s.A[s.caster.channel], m.guard, true), castAtkVsResolve: pHit(0, s.A[s.caster.intent] + s.A[s.caster.channel], m.resolve, true) } : {}),
        foeVsGuard: m.atkG != null ? pHit(m.rank, m.atkG, s.guard, C.foeExplode) : null, foeVsResolve: m.atkR != null ? pHit(m.rank, m.atkR, s.resolve, C.foeExplode) : null };
    }
    R.hit[L][k] = row;
  }
}
log("hit tables done");

// 2. DPR (Steward vs tier foes, surge smart/none) + foe DPR per bracket vs each build
for (let L = 1; L <= 20; L++) {
  const T = C.tierForLevel[L]; R.dpr[L] = {}; R.foeDpr[L] = {};
  for (const k of BUILD_KEYS) {
    R.dpr[L][k] = { smart: dprSteward(k, L, ofTier(T), "smart"), none: dprSteward(k, L, ofTier(T), "none") };
    if (T > 1) R.dpr[L][k].down = dprSteward(k, L, ofTier(T - 1), "smart", Math.round(C.N / 2));
    R.foeDpr[L][k] = {}; for (const br of BR) { const c = cell(T, br); if (c.length) R.foeDpr[L][k][br] = dprFoe(c, k, L); }
  }
}
log("DPR done");

// 3+4. Encounters
const mkS = (keys, L) => () => keys.map((k, i) => makeModelSteward(k, L, i));
const encBracket = key => /light/.test(key) ? "light" : /medium/.test(key) ? "medium" : /heavy/.test(key) ? "heavy" : "boss";
const mkF = (T, br, n) => () => { const c = cell(T, br); return Array.from({ length: n }, () => pick(c)); };
for (let L = 1; L <= 20; L++) {
  const T = C.tierForLevel[L]; const E = R.enc[L] = {};
  for (const k of BUILD_KEYS) {
    if (cell(T, "light").length) E[`${k} vs 3 light`] = runCell(mkS([k], L), mkF(T, "light", 3));
    if (cell(T, "medium").length) E[`${k} vs 1 medium`] = runCell(mkS([k], L), mkF(T, "medium", 1));
  }
  if (cell(T, "heavy").length) { E["vanguard vs 1 heavy (solo)"] = runCell(mkS(["vanguard"], L), mkF(T, "heavy", 1)); E["pair vs 1 heavy"] = runCell(mkS(C.pair, L), mkF(T, "heavy", 1)); }
  if (cell(T, "boss").length) { E["party4 vs 1 boss"] = runCell(mkS(C.party4, L), mkF(T, "boss", 1)); }
  if (cell(T, "medium").length) E["party4 vs 4 medium"] = runCell(mkS(C.party4, L), mkF(T, "medium", 4));
  // surge contribution (no spends) on two key cells
  const sv = C.surgePolicy; C.surgePolicy = "none";
  if (cell(T, "medium").length) E["vanguard vs 1 medium [no Surge spends]"] = runCell(mkS(["vanguard"], L), mkF(T, "medium", 1));
  if (cell(T, "boss").length) E["party4 vs 1 boss [no Surge spends]"] = runCell(mkS(C.party4, L), mkF(T, "boss", 1));
  C.surgePolicy = sv;
  for (const [key, e] of Object.entries(E)) { const br = encBracket(key); e.foeCell = `T${T}-${br}`; e.lowConfidence = !!census[e.foeCell]?.lowConfidence; }
  log(`encounters L${L}`);
}

// 5. Calibration L3 vs Tor-Wraths
for (const n of [3, 5, 7, 9]) {
  R.calib[`model party4 L3 vs ${n} Tor-Wrath`] = runCell(mkS(C.party4, 3), () => Array.from({ length: n }, () => torWrath));
  if (realL3.length === 4) R.calib[`REAL L3 party (${realL3.map(s => s.id).join("/")}) vs ${n} Tor-Wrath`] = runCell(() => realL3.map(s => ({ ...s })), () => Array.from({ length: n }, () => torWrath));
}
R.calib.torWrath = { guard: torWrath.guard, resolve: torWrath.resolve, int: torWrath.intMax, stress: torWrath.strMax, weapons: torWrath.weapons.map(w => `${w.name} ${w.formula} ${w.type} +${w.atkMod} dmg+${w.dmgFlat}`) };
R.calib.realParty = realL3.map(s => ({ id: s.id, guard: s.guard, resolve: s.resolve, int: s.intMax, stress: s.strMax, strikes: s.strikes, res: [...s.res], weapons: s.weapons.map(w => `${w.name} ${w.formula} ${w.type} +${w.atkMod}`) }));
log("calibration done");

// Named NPCs: party4 at NPC level vs the NPC alone; vanguard solo too
for (const npc of namedNPCs.filter(n => n.level >= 4 || n.tier >= 2).concat(namedNPCs.filter(n => n.level < 4 && n.tier < 2).slice(0, 4))) {
  const L = Math.max(1, Math.min(20, npc.level));
  R.named.push({ npc: npc.label, L, guard: npc.guard, resolve: npc.resolve, int: npc.intMax, stress: npc.strMax, strikes: npc.strikes, bestAtk: Math.max(...npc.weapons.map(w => w.atkMod)),
    party4: runCell(mkS(C.party4, L), () => [npc], Math.round(C.N / 2)), vanguardSolo: runCell(mkS(["vanguard"], L), () => [npc], Math.round(C.N / 2)) });
}
log("named done");

// 6. Curves + flags
const TARGETS = {
  "3 light": { winLo: 65, winHi: 92, label: "3 lights vs 1 Steward = fair" },
  "1 medium": { winLo: 65, winHi: 92, rLo: 2.5, rHi: 4.5, label: "medium vs 1 Steward = fair, 3–4 rounds" },
  "heavy solo": { winHi: 50, label: "heavy needs a partner (solo < 50%)" },
  "pair heavy": { winLo: 65, winHi: 95, label: "heavy vs 2 Stewards = fair" },
  "boss": { winLo: 65, winHi: 95, dropLo: 50, label: "boss vs full party: win, someone likely drops (P(drop) ≥ 50%)" },
};
for (let L = 1; L <= 20; L++) {
  const T = C.tierForLevel[L], v = R.stewards.vanguard[L - 1], c = R.stewards.caster[L - 1], m = census[`T${T}-medium`] || {};
  R.curves.push({ L, T, vanAtk: v.atk, vanDmg: v.dmg, vanStrikes: v.strikes, vanG: v.guard, vanR: v.resolve, vanInt: v.int, vanStr: v.stress, casG: c.guard, casR: c.resolve, casInt: c.int, casStr: c.stress, casAtk: c.castAtk,
    foeMedG: m.guard, foeMedR: m.resolve, foeMedInt: m.int, foeMedStr: m.stress, foeAtkG: tierMed[T].atkG, foeAtkR: tierMed[T].atkR, foeStrikes: m.strikes });
  const E = R.enc[L];
  for (const k of BUILD_KEYS) {
    const a = E[`${k} vs 3 light`]; if (a && (a.win < TARGETS["3 light"].winLo || a.win > TARGETS["3 light"].winHi)) R.flags.push({ L, T, kind: "target", cell: `${k} vs 3 light`, win: a.win, note: a.win < TARGETS["3 light"].winLo ? "too hard" : "too easy" });
    const b = E[`${k} vs 1 medium`]; if (b) { const t = TARGETS["1 medium"]; if (b.win < t.winLo || b.win > t.winHi) R.flags.push({ L, T, kind: "target", cell: `${k} vs 1 medium`, win: b.win, note: b.win < t.winLo ? "too hard" : "too easy" });
      if (b.meanRoundsWin != null && (b.meanRoundsWin < t.rLo || b.meanRoundsWin > t.rHi)) R.flags.push({ L, T, kind: "target", cell: `${k} vs 1 medium`, rounds: b.meanRoundsWin, note: "outside 3–4 rounds" }); }
  }
  const hs = E["vanguard vs 1 heavy (solo)"]; if (hs && hs.win > 50) R.flags.push({ L, T, kind: "target", cell: "vanguard vs 1 heavy (solo)", win: hs.win, note: "heavy beatable solo" });
  const hp = E["pair vs 1 heavy"]; if (hp && (hp.win < 65 || hp.win > 95)) R.flags.push({ L, T, kind: "target", cell: "pair vs 1 heavy", win: hp.win, note: hp.win < 65 ? "too hard" : "too easy" });
  const bo = E["party4 vs 1 boss"]; if (bo && (bo.win < 65 || bo.win > 95 || bo.anyDrop < 50)) R.flags.push({ L, T, kind: "target", cell: "party4 vs 1 boss", win: bo.win, anyDrop: bo.anyDrop, note: bo.win < 65 ? "too hard" : bo.win > 95 ? "too easy" : "nobody drops" });
  if (L > 1) {
    const P = R.enc[L - 1];
    for (const key of Object.keys(E)) if (P[key] && Math.abs(E[key].win - P[key].win) > 15) R.flags.push({ L, T, kind: "swing", cell: key, from: P[key].win, to: E[key].win, note: `win% ${P[key].win}→${E[key].win}` });
    for (const k of BUILD_KEYS) { const h0 = R.hit[L - 1][k][`T${C.tierForLevel[L - 1]}`], h1 = R.hit[L][k][`T${T}`];
      for (const f of ["vsGuard", "vsResolve", "foeVsGuard", "foeVsResolve"]) if (h0?.[f] != null && h1?.[f] != null && Math.abs(h1[f] - h0[f]) > 15) R.flags.push({ L, T, kind: "swing", cell: `${k} hit ${f} (same-tier)`, from: h0[f], to: h1[f], note: `${f} ${h0[f]}→${h1[f]}` }); }
  }
}
const cal = R.calib;
for (const [k, v] of Object.entries(cal)) if (/vs \d+ Tor-Wrath/.test(k)) {
  const n = Number(k.match(/vs (\d+)/)[1]);
  if (n === 5 && (v.win < 60 || v.win > 92)) R.flags.push({ L: 3, T: 1, kind: "calibration", cell: k, win: v.win, note: "playtest: 5 should be fair" });
  if (n === 9 && v.win > 40) R.flags.push({ L: 3, T: 1, kind: "calibration", cell: k, win: v.win, note: "playtest: 9 should be a loss" });
  if (n === 3 && v.win < 85) R.flags.push({ L: 3, T: 1, kind: "calibration", cell: k, win: v.win, note: "playtest: 3 = fair-not-hard" });
}
// lowConfidence on flags (a swing is low-confidence if either end's foe cell is)
for (const f of R.flags) if (f.kind === "target" || f.kind === "swing") {
  const a = R.enc[f.L]?.[f.cell], b = f.kind === "swing" ? R.enc[f.L - 1]?.[f.cell] : null;
  if (a) f.lowConfidence = !!(a.lowConfidence || b?.lowConfidence);
}
// ── SCORE ──
{
  const isDiag = k => /\[no Surge spends\]/.test(k);
  const misses = R.flags.filter(f => f.kind === "target" && !f.lowConfidence);
  const missesAll = R.flags.filter(f => f.kind === "target");
  const swings = R.flags.filter(f => f.kind === "swing" && R.enc[f.L]?.[f.cell] && !isDiag(f.cell));
  const hitSwings = R.flags.filter(f => f.kind === "swing" && / hit /.test(f.cell));
  const cm = n => { const e = R.calib[`model party4 L3 vs ${n} Tor-Wrath`]; return { win: e.win, drop: e.anyDrop, rounds: e.meanRoundsWin }; };
  const t5 = cm(5), t9 = cm(9);
  const entry = {};
  for (const L of [6, 11, 16]) { const E = R.enc[L], o = {}; for (const [k, e] of Object.entries(E)) if (!isDiag(k)) o[k] = { win: e.win, drop: e.anyDrop, rounds: e.meanRoundsWin, ...(e.lowConfidence ? { lowConfidence: true } : {}) }; entry[`L${L}`] = o; }
  R.score = {
    misses: misses.length, missesInclLowConfidence: missesAll.length,
    missesByCell: misses.reduce((m, f) => { const k = f.cell.replace(/^\w+ vs/, "* vs"); m[k] = (m[k] || 0) + 1; return m; }, {}),
    swings: swings.length, swingsExclLowConfidence: swings.filter(f => !f.lowConfidence).length, hitSwings: hitSwings.length,
    swingsByLevel: swings.reduce((m, f) => { m[`L${f.L}`] = (m[`L${f.L}`] || 0) + 1; return m; }, {}),
    torWrath: { vs5: t5, vs9: t9, ok: t5.win >= 70 && t5.win <= 90 && t9.win <= 10 },
    tierEntry: entry,
  };
}
R.meta.seconds = +((Date.now() - t0) / 1000).toFixed(1);
fs.mkdirSync(OUT, { recursive: true });
const sfx = TAG === "baseline" ? "" : `.${TAG}`;
fs.writeFileSync(path.join(OUT, `results${sfx}.json`), JSON.stringify(R, (k, v) => v instanceof Set ? [...v] : v, 1));
fs.writeFileSync(path.join(OUT, `TABLES${sfx}.md`), renderMD(R));
const findings = opt("--findings") && fs.existsSync(opt("--findings")) ? fs.readFileSync(opt("--findings"), "utf8") : "";
fs.writeFileSync(path.join(OUT, `RESULTS${sfx}.md`), renderSummary(R, findings));
log(`wrote ${path.join(OUT, `results${sfx}.json`)}, RESULTS${sfx}.md and TABLES${sfx}.md`);
console.log(scoreText(R));

// ═════════════════════════════════════════ report ═════════════════════════════════════════
function scoreText(R) {
  const S = R.score, out = [];
  const keyCells = ["party4 vs 1 boss", "party4 vs 4 medium", "pair vs 1 heavy", "vanguard vs 1 heavy (solo)", ...BUILD_KEYS.map(k => `${k} vs 1 medium`), ...BUILD_KEYS.map(k => `${k} vs 3 light`)];
  const ab = { "party4 vs 1 boss": "P4boss", "party4 vs 4 medium": "P4 4med", "pair vs 1 heavy": "pairHvy", "vanguard vs 1 heavy (solo)": "VanHvy" };
  const sh = k => ab[k] || k.replace(/^(\w)\w* vs (\d) (\w).*$/, (m, a, n, b) => `${a.toUpperCase()}${n}${b[0]}`);
  out.push(`SCORE [${R.meta.tag}] misses ${S.misses} (incl lowConf ${S.missesInclLowConfidence}) · swings>15 ${S.swings} (excl lowConf ${S.swingsExclLowConfidence}; hit-swings ${S.hitSwings}) · TorWrath L3 vs5 win ${S.torWrath.vs5.win}/drop ${S.torWrath.vs5.drop}, vs9 win ${S.torWrath.vs9.win}/drop ${S.torWrath.vs9.drop} ${S.torWrath.ok ? "OK" : "OFF-CALIBRATION"}`);
  for (const L of ["L6", "L11", "L16"]) { const E = S.tierEntry[L]; out.push(`  ${L}: ` + keyCells.filter(k => E[k]).map(k => `${sh(k)} ${E[k].win}${/party4|pair/.test(k) ? `/${E[k].drop}d` : ""}${E[k].lowConfidence ? "*" : ""}`).join(" · ")); }
  out.push("  (win%[/P(any drop)%d]; * = lowConfidence cell n≤" + C.lowConfidenceN + ")");
  return out.join("\n");
}

function renderSummary(R, findings) {
  const out = []; const p = s => out.push(s);
  const tb = (head, rows) => { p(`| ${head.join(" | ")} |`); p(`|${head.map(() => "---").join("|")}|`); for (const r of rows) p(`| ${r.map(x => x == null ? "–" : x).join(" | ")} |`); p(""); };
  const L20 = Array.from({ length: 20 }, (_, i) => i + 1), T = L => C.tierForLevel[L];
  const BK = BUILD_KEYS, ab = { vanguard: "Van", ranged: "Rng", caster: "Cas", support: "Sup", defender: "Def" };
  p(`# Combat balance sim — ${R.meta.tag}`); p("");
  p(`N = ${R.meta.N} fights per cell, seed ${R.meta.seed}, ${R.meta.monsters} real monsters (npcs.jsonl ∪ world monsters, live chassis), runtime ${R.meta.seconds}s. Script: \`bin/ft-sim-combat\` (sim-combat.mjs) (CONFIG at top; \`--config overrides.json\`). Full per-cell tables: \`TABLES${R.meta.tag === "baseline" ? "" : "." + R.meta.tag}.md\`; raw: \`results${R.meta.tag === "baseline" ? "" : "." + R.meta.tag}.json\`.`); p("");
  p(`Builds: ${BK.map(k => `**${ab[k]}** = ${BUILDS[k].label}`).join("; ")}. Party4 = ${C.party4.map(k => ab[k]).join("+")}; pair = ${C.pair.map(k => ab[k]).join("+")}.`); p("");
  p("## SCORE"); p(""); p("```"); p(scoreText(R)); p("```"); p("");
  p(`Misses by cell (excl. lowConfidence): ${Object.entries(R.score.missesByCell).map(([k, v]) => `${k} ${v}`).join("; ")}. Swings by level: ${Object.entries(R.score.swingsByLevel).map(([k, v]) => `${k} ${v}`).join(", ")}.`); p("");
  p(`Active switches vs live: ${JSON.stringify(R.meta.switchesChanged)}`); p("");
  if (findings) { p(findings.trim()); p(""); }
  p("## A. Curves — Stewards vs the tier-median foe"); p("");
  tb(["L", "T", "Van atk / dmg×strikes", "Van G / R", "Van Int / Str", "Cas G / R", "Cas Int / Str", "Cas cast-atk", "Foe(T) G / R", "Foe medium Int / Str", "Foe atk→G / →R", "Foe med strikes"], R.curves.map(c => [c.L, c.T, `+${c.vanAtk} / ${c.vanDmg}×${c.vanStrikes}`, `${c.vanG} / ${c.vanR}`, `${c.vanInt} / ${c.vanStr}`, `${c.casG} / ${c.casR}`, `${c.casInt} / ${c.casStr}`, `+${c.casAtk}`, `${R.tierMed[c.T].guard} / ${R.tierMed[c.T].resolve}`, `${c.foeMedInt} / ${c.foeMedStr}`, `+${c.foeAtkG} / +${c.foeAtkR}`, c.foeStrikes]));
  p("## B. Hit % at the same tier (Steward weapon → tier-median foe Guard / Resolve; foe tier-median best weapon → the build's Guard / Resolve)"); p("");
  p("Caster column adds the Invoke attack (intent+channel, no rank) → G. One-tier-up/down numbers are in TABLES.md §1."); p("");
  tb(["L", "T", ...BK.map(k => `${ab[k]} →G/R`), "Cas Invoke→G", ...BK.map(k => `foe→${ab[k]} G/R`)], L20.map(L => { const h = k => R.hit[L][k][`T${T(L)}`]; return [L, T(L), ...BK.map(k => `${h(k).vsGuard}/${h(k).vsResolve}`), h("caster").castAtkVsGuard, ...BK.map(k => `${h(k).foeVsGuard ?? "–"}/${h(k).foeVsResolve ?? "–"}`)]; }));
  p("## C. Damage per round (5-round dummy vs random same-tier real monsters; resist/vuln applied). Steward DPR with Surge spends (no-Surge) [Int/Str split]; foe = tier MEDIUM bracket vs that build (Int/Str)"); p("");
  tb(["L", "T", ...BK.map(k => `${ab[k]} DPR`), ...BK.map(k => `med→${ab[k]}`)], L20.map(L => [L, T(L), ...BK.map(k => { const x = R.dpr[L][k]; return `${x.smart.dpr} (${x.none.dpr}) [${x.smart.dprInt}/${x.smart.dprStr}]`; }), ...BK.map(k => { const x = R.foeDpr[L][k].medium; return x ? `${x.dpr} (${x.dprInt}/${x.dprStr})` : "–"; })]));
  p("Foe DPR by bracket vs the vanguard / caster (Int/Str):"); p("");
  tb(["L", "T", ...["light", "medium", "heavy", "boss"].flatMap(b => [`${b}→Van`, `${b}→Cas`])], L20.map(L => [L, T(L), ...["light", "medium", "heavy", "boss"].flatMap(b => ["vanguard", "caster"].map(k => { const x = R.foeDpr[L][k][b]; return x ? `${x.dpr} (${x.dprInt}/${x.dprStr})` : "–"; }))]));
  p("## D. Rounds-to-drop (analytic = pool ÷ DPR on each track, the faster track named) vs a tier-median MEDIUM"); p("");
  tb(["L", "T", ...BK.flatMap(k => [`${ab[k]} kills med`, `med kills ${ab[k]}`])], L20.map(L => { const m = R.census[`T${T(L)}-medium`]; return [L, T(L), ...BK.flatMap(k => {
    const s = R.dpr[L][k].smart, f = R.foeDpr[L][k].medium, st = R.stewards[k][L - 1];
    const kI = s.dprInt > 0 ? m.int / s.dprInt : Infinity, kS = s.dprStr > 0 ? m.stress / s.dprStr : Infinity, dI = f?.dprInt > 0 ? st.int / f.dprInt : Infinity, dS = f?.dprStr > 0 ? st.stress / f.dprStr : Infinity;
    const fmt = (a, b) => { const x = Math.min(a, b); return x === Infinity ? "∞" : `${x.toFixed(1)} ${a <= b ? "Int" : "Str"}`; }; return [fmt(kI, kS), fmt(dI, dS)]; })]; }));
  p("## E. Encounters vs the chassis targets (win %; P(any Steward drops) %; Steward drops on Int/Str)"); p("");
  p("Targets used: 3 lights vs 1 = fair → win 65–92%. 1 medium vs 1 = fair → win 65–92% in 2.5–4.5 rounds. Heavy: solo < 50%, pair 65–95%. Boss vs party4: win 65–95% **and** P(someone drops) ≥ 50%."); p("");
  const E = (L, k) => R.enc[L][k]; const w = (L, k) => E(L, k) ? E(L, k).win : "–";
  tb(["L", "T", ...BK.map(k => `${ab[k]} v 3 light`), ...BK.map(k => `${ab[k]} v 1 med`), "Van med rounds", "Van v heavy solo", "pair v heavy", "party4 v boss (P drop)", "party4 v 4 med (P drop)"],
    L20.map(L => [L, T(L), ...BK.map(k => w(L, `${k} vs 3 light`)), ...BK.map(k => w(L, `${k} vs 1 medium`)), E(L, "vanguard vs 1 medium")?.meanRoundsWin, w(L, "vanguard vs 1 heavy (solo)"), w(L, "pair vs 1 heavy"),
      E(L, "party4 vs 1 boss") ? `${E(L, "party4 vs 1 boss").win} (${E(L, "party4 vs 1 boss").anyDrop})` : "–", E(L, "party4 vs 4 medium") ? `${E(L, "party4 vs 4 medium").win} (${E(L, "party4 vs 4 medium").anyDrop})` : "–"]));
  p("Which track empties first (share of Steward drops on Stress; foe drops on Stress), and Surge's share of win%:"); p("");
  const sh = e => { if (!e) return "–"; const a = e.stewardDropTrack, b = e.foeDropTrack; const sa = a.integrity + a.stress, sb = b.integrity + b.stress; return `${sa ? Math.round(100 * a.stress / sa) : "–"}% / ${sb ? Math.round(100 * b.stress / sb) : "–"}%`; };
  tb(["L", "T", "Van v med: S-drop on Str / F-drop on Str", "Cas v med", "party4 v boss", "party4 v 4 med", "Van v med win: Surge / none", "party4 v boss win: Surge / none", "overheat Strain per fight (party4 v boss)"],
    L20.map(L => [L, T(L), sh(E(L, "vanguard vs 1 medium")), sh(E(L, "caster vs 1 medium")), sh(E(L, "party4 vs 1 boss")), sh(E(L, "party4 vs 4 medium")), `${w(L, "vanguard vs 1 medium")} / ${w(L, "vanguard vs 1 medium [no Surge spends]")}`, `${w(L, "party4 vs 1 boss")} / ${w(L, "party4 vs 1 boss [no Surge spends]")}`, E(L, "party4 vs 1 boss")?.overheatPerFight]));
  p("## F. Calibration — L3 party vs Tor-Wraths (playtest: 3 = fair-not-hard, 5 = chosen, 9 = loss)"); p("");
  p(`Tor-Wrath (world copy, L2 build): Guard ${R.calib.torWrath.guard}, Resolve ${R.calib.torWrath.resolve}, Int ${R.calib.torWrath.int}, Stress ${R.calib.torWrath.stress}, resists kinetic + qliphothic, vulnerable sephirotic; ${R.calib.torWrath.weapons.join("; ")}.`); p("");
  p(`Real party (world-actors, derived live): ${R.calib.realParty.map(s => `${s.id} G${s.guard}/R${s.resolve} Int${s.int}/Str${s.stress} res[${s.res.join(",")}]`).join(" · ")}.`); p("");
  tb(["cell", "win%", "rounds (win)", "P(any drop)%", "drops/fight", "1st drop round", "Steward drops Int/Str", "Steward hit%", "foe hit%"], Object.entries(R.calib).filter(([k]) => /Tor-Wrath$/.test(k)).map(([k, e]) => [k, e.win, e.meanRoundsWin, e.anyDrop, e.dropsPerFight, e.firstDropRound, `${e.stewardDropTrack.integrity}/${e.stewardDropTrack.stress}`, e.sHitPct, e.fHitPct]));
  p("## G. Manifestation vs weapon; Surge share; Overshoot"); p("");
  tb(["L", "T", "Working dmg/cast", "dmg per Clarity", "casts/fight budget", "Cas DPR", "Van DPR (no Surge)", "Rng DPR (no Surge)", "Surge share of Van/Rng DPR", "cast fail %", "cast overshoot Ripple/Tear/Rupture+ % per cast", "Van strike overshoot R/T/R+ % (peer)", "Van punch-down (T−1)"],
    L20.map(L => { const c = R.dpr[L].caster.smart, v = R.dpr[L].vanguard, r = R.dpr[L].ranged, st = R.stewards.caster[L - 1], cost = Math.max(1, C.tierClarity[T(L)] - C.tccDiscount), enc = R.enc[L]["caster vs 1 medium"]?.castOvershoot, o = v.smart.ovPerAtk, od = v.down?.ovPerAtk;
      return [L, T(L), c.castDmgPerCast, c.castDmgPerClarity, Math.floor(st.clarity / cost), c.dpr, `${v.smart.dpr} (${v.none.dpr})`, `${r.smart.dpr} (${r.none.dpr})`, `${Math.round(100 * (v.smart.dpr - v.none.dpr) / v.smart.dpr)}% / ${Math.round(100 * (r.smart.dpr - r.none.dpr) / r.smart.dpr)}%`, enc?.castFailPct, c.castOv ? `${c.castOv.ripple}/${c.castOv.tear}/${c.castOv.rupturePlus}` : "–", o ? `${o.ripple}/${o.tear}/${o.rupturePlus}` : "–", od ? `${od.ripple}/${od.tear}/${od.rupturePlus}` : "–"]; }));
  p("## H. Named NPCs (type character, no chassis, Steward drop path; foe tier bonus applies)"); p("");
  tb(["NPC", "L", "G/R", "Int/Str", "strikes", "best atk", "party4 win% (P drop)", "solo Van win%"], R.named.map(n => [n.npc, n.L, `${n.guard}/${n.resolve}`, `${n.int}/${n.stress}`, n.strikes, `+${n.bestAtk}`, `${n.party4.win} (${n.party4.anyDrop})`, n.vanguardSolo.win]));
  p("## I. Flags raised by the sim"); p("");
  const by = {}; for (const f of R.flags) (by[f.kind] ??= []).push(f);
  for (const [k, list] of Object.entries(by)) { p(`**${k}** — ${list.length}`); p("");
    if (k === "target") { const g = {}; for (const f of list) (g[f.cell.replace(/^\w+ vs/, "* vs")] ??= []).push(f); for (const [c, l] of Object.entries(g)) p(`- ${c}: ${l.length} misses (${l.slice(0, 12).map(f => `L${f.L} ${f.cell.split(" ")[0]} ${f.note}${f.win != null ? " " + f.win + "%" : ""}${f.rounds != null ? " " + f.rounds + "rd" : ""}`).join("; ")}${l.length > 12 ? "; …" : ""})`); }
    else if (k === "swing") { const g = {}; for (const f of list) (g[f.L] ??= []).push(f); for (const [L, l] of Object.entries(g)) p(`- L${L}: ${l.length} (${l.slice(0, 6).map(f => `${f.cell} ${f.from}→${f.to}`).join("; ")}${l.length > 6 ? "; …" : ""})`); }
    else for (const f of list) p(`- L${f.L} T${f.T} · ${f.cell} · ${f.note}`);
    p(""); }
  p("Full flag list: results.json → flags; full per-cell tables (incl. one-tier-up/down hit%, every encounter's rounds/drops/Surge/overheat/overshoot): TABLES.md.");
  return out.join("\n");
}
function renderMD(R) {
  const L20 = Array.from({ length: 20 }, (_, i) => i + 1);
  const out = [];
  const p = s => out.push(s);
  const tb = (head, rows) => { p(`| ${head.join(" | ")} |`); p(`|${head.map(() => "---").join("|")}|`); for (const r of rows) p(`| ${r.map(x => x == null ? "–" : x).join(" | ")} |`); p(""); };
  p(`# Combat sim results — ${R.meta.tag} (N=${R.meta.N}/cell, seed ${R.meta.seed}, ${R.meta.seconds}s)`); p("");
  p(`Generated ${R.meta.generated} by \`bin/ft-sim-combat\`. ${R.meta.monsters} monsters (npcs.jsonl ∪ world monsters, chassis applied). Builds: ${BUILD_KEYS.map(k => `**${k}** = ${BUILDS[k].label}`).join("; ")}.`); p("");
  p("## 0. Bestiary census after the chassis (medians per tier × bracket)");
  tb(["cell", "n", "lvl", "Guard", "Resolve", "Int", "Stress", "strikes", "best atk vs Guard", "best atk vs Resolve (n)"], Object.entries(R.census).map(([k, v]) => [k + (v.lowConfidence ? " (lowConf)" : ""), v.n, v.level, v.guard, v.resolve, v.int, v.stress, v.strikes, v.atkVsGuard != null ? `+${v.atkVsGuard}` : null, v.atkVsResolve != null ? `+${v.atkVsResolve} (${v.nWithResolveWeapon})` : null]));
  p("## 0b. Model Stewards (derived)");
  for (const k of BUILD_KEYS) { p(`**${k}** — ${BUILDS[k].label}`); p(""); tb(["L", "T", "V/I/P/B/M/S", "rank", "atk", "dmg/hit", "strikes", "Guard", "Resolve", "Int", "Stress", "Clarity", "cast atk"], R.stewards[k].map(s => [s.L, s.T, FAC.map(f => s.A[f]).join("/"), s.rank, `+${s.atk}`, s.dmg, s.strikes, s.guard, s.resolve, s.int, s.stress, s.clarity, s.castAtk])); }
  p("## 1. Hit % (same tier · one down · one up). Steward weapon vs tier-median Guard/Resolve; foe = tier-median best weapon vs the build's Guard/Resolve (foe dice don't explode)");
  for (const k of BUILD_KEYS) {
    p(`**${k}**`); p("");
    tb(["L", "T", "→G same", "→R same", "→G down", "→G up", ...(BUILDS[k].caster ? ["cast→G", "cast→R"] : []), "foe→G", "foe→R", "foe→G (up)", "foe→R (up)"], L20.map(L => { const T = C.tierForLevel[L], h = R.hit[L][k], s = h[`T${T}`], dn = h[`T${T - 1}`], up = h[`T${T + 1}`];
      return [L, T, s.vsGuard, s.vsResolve, dn?.vsGuard, up?.vsGuard, ...(BUILDS[k].caster ? [s.castAtkVsGuard, s.castAtkVsResolve] : []), s.foeVsGuard, s.foeVsResolve, up?.foeVsGuard, up?.foeVsResolve]; }));
  }
  p("## 2. DPR — Steward vs random real monsters of its own tier (5-round dummy, Integrity / Stress split), with and without Surge spends");
  tb(["L", "T", ...BUILD_KEYS.flatMap(k => [`${k} DPR (Surge)`, `${k} no-Surge`])], L20.map(L => [L, C.tierForLevel[L], ...BUILD_KEYS.flatMap(k => { const x = R.dpr[L][k]; return [`${x.smart.dpr} (${x.smart.dprInt}/${x.smart.dprStr})`, x.none.dpr]; })]));
  p("Foe DPR per bracket vs each build (same tier; 5 rounds; Integrity/Stress):"); p("");
  tb(["L", "T", ...BUILD_KEYS.flatMap(k => ["light", "medium", "heavy", "boss"].map(b => `${k[0].toUpperCase()}:${b[0]}`))], L20.map(L => [L, C.tierForLevel[L], ...BUILD_KEYS.flatMap(k => ["light", "medium", "heavy", "boss"].map(b => { const x = R.foeDpr[L][k][b]; return x ? `${x.dpr} (${x.dprInt}/${x.dprStr})` : null; }))]));
  p("## 3. Rounds-to-drop (analytic, from DPR and pools) — Steward kills a tier-median MEDIUM / medium kills Steward; track that empties first");
  tb(["L", "T", ...BUILD_KEYS.flatMap(k => [`${k} kills med`, `med kills ${k}`])], L20.map(L => { const T = C.tierForLevel[L], m = R.census[`T${T}-medium`]; return [L, T, ...BUILD_KEYS.flatMap(k => {
    const s = R.dpr[L][k].smart, f = R.foeDpr[L][k].medium, st = R.stewards[k][L - 1];
    const kI = s.dprInt > 0 ? m.int / s.dprInt : Infinity, kS = s.dprStr > 0 ? m.stress / s.dprStr : Infinity;
    const dI = f?.dprInt > 0 ? st.int / f.dprInt : Infinity, dS = f?.dprStr > 0 ? st.stress / f.dprStr : Infinity;
    const fmt = (a, b) => { const x = Math.min(a, b); return x === Infinity ? "∞" : `${x.toFixed(1)} ${a <= b ? "Int" : "Str"}`; };
    return [fmt(kI, kS), fmt(dI, dS)]; })]; }));
  p("Empirical drop tracks from the encounter sims are in §4 (S-drop Int/Str = which track the Steward hit 0 on; F-drop = foes).");
  p("## 4. Encounters vs the chassis targets");
  p("Targets used: 3 lights vs 1 = fair (win 65–92%); 1 medium vs 1 = fair (win 65–92%, 2.5–4.5 rounds); heavy solo < 50%, pair 65–95%; boss vs party4: win 65–95% AND P(someone drops) ≥ 50%.");
  p("");
  const ekeys = [...new Set(L20.flatMap(L => Object.keys(R.enc[L])))];
  for (const key of ekeys) {
    p(`**${key}**`); p("");
    tb(["L", "T", "win%", "loss%", "timeout%", "rounds (win)", "P(any drop)%", "drops/fight", "deaths/fight", "1st drop rd", "S-drop Int/Str", "F-drop Int/Str", "S hit%", "F hit%", "Surge spent", "overheat/fight", "strain/Steward"],
      L20.filter(L => R.enc[L][key]).map(L => { const e = R.enc[L][key]; return [L, C.tierForLevel[L], e.win, e.loss, e.timeout, e.meanRoundsWin, e.anyDrop, e.dropsPerFight, e.deaths, e.firstDropRound, `${e.stewardDropTrack.integrity}/${e.stewardDropTrack.stress}`, `${e.foeDropTrack.integrity}/${e.foeDropTrack.stress}`, e.sHitPct, e.fHitPct, e.surgeSpentPerFight, e.overheatPerFight, e.strainEndPerSteward]; }));
  }
  p("### Calibration — L3 vs Tor-Wraths (playtest: 3 = fair-not-hard, 5 = chosen/fair, 9 = loss)");
  p(`Tor-Wrath (world): Guard ${R.calib.torWrath.guard}, Resolve ${R.calib.torWrath.resolve}, Int ${R.calib.torWrath.int}, Stress ${R.calib.torWrath.stress}; ${R.calib.torWrath.weapons.join("; ")}.`); p("");
  p(`Real party: ${R.calib.realParty.map(s => `${s.id} G${s.guard}/R${s.resolve} Int${s.int}/Str${s.stress} res[${s.res.join(",")}]`).join(" · ")}`); p("");
  tb(["cell", "win%", "loss%", "rounds (win)", "P(any drop)%", "drops/fight", "1st drop rd", "S-drop Int/Str", "S hit%", "F hit%"], Object.entries(R.calib).filter(([k]) => /Tor-Wrath$/.test(k)).map(([k, e]) => [k, e.win, e.loss, e.meanRoundsWin, e.anyDrop, e.dropsPerFight, e.firstDropRound, `${e.stewardDropTrack.integrity}/${e.stewardDropTrack.stress}`, e.sHitPct, e.fHitPct]));
  p("### Named NPCs (no chassis; Steward drop path) — party4 at the NPC's level, and the vanguard solo");
  tb(["NPC", "L", "G/R", "Int/Str", "strikes", "best atk", "party4 win%", "party4 P(drop)", "solo vanguard win%"], R.named.map(n => [n.npc, n.L, `${n.guard}/${n.resolve}`, `${n.int}/${n.stress}`, n.strikes, `+${n.bestAtk}`, n.party4.win, n.party4.anyDrop, n.vanguardSolo.win]));
  p("## 5. Manifestation vs weapon, Surge share, Overshoot");
  tb(["L", "T", "caster cast dmg/cast", "dmg/Clarity", "casts/rd", "caster DPR", "caster DPR no-Surge", "vanguard DPR", "vanguard no-Surge", "Surge share vanguard %", "Surge share ranged %", "cast fail%", "cast Ripple/Tear/Rupture+ %"],
    L20.map(L => { const c = R.dpr[L].caster.smart, cn = R.dpr[L].caster.none, v = R.dpr[L].vanguard, r = R.dpr[L].ranged; const enc = R.enc[L]["caster vs 1 medium"]?.castOvershoot;
      return [L, C.tierForLevel[L], c.castDmgPerCast, c.castDmgPerClarity, c.castsPerRound, c.dpr, cn.dpr, v.smart.dpr, v.none.dpr, (100 * (v.smart.dpr - v.none.dpr) / Math.max(0.01, v.smart.dpr)).toFixed(0), (100 * (r.smart.dpr - r.none.dpr) / Math.max(0.01, r.smart.dpr)).toFixed(0), enc?.castFailPct, c.castOv ? `${c.castOv.ripple}/${c.castOv.tear}/${c.castOv.rupturePlus}` : null]; }));
  p("Overshoot per Steward weapon attack (%: Ripple / Tear / Rupture+), peer-tier dummy and one tier down:"); p("");
  tb(["L", "T", ...BUILD_KEYS.filter(k => k !== "caster").map(k => `${k} peer`), ...BUILD_KEYS.filter(k => k !== "caster").map(k => `${k} punch-down`)], L20.map(L => [L, C.tierForLevel[L], ...BUILD_KEYS.filter(k => k !== "caster").map(k => { const o = R.dpr[L][k].smart.ovPerAtk; return o ? `${o.ripple}/${o.tear}/${o.rupturePlus}` : null; }), ...BUILD_KEYS.filter(k => k !== "caster").map(k => { const o = R.dpr[L][k].down?.ovPerAtk; return o ? `${o.ripple}/${o.tear}/${o.rupturePlus}` : null; })]));
  p("## 6. Curves (vanguard, caster, tier-median foe)");
  tb(["L", "T", "van atk", "van dmg×strikes", "van G", "van R", "van Int/Str", "cas G", "cas R", "cas Int/Str", "cas cast atk", "foe med G", "foe med R", "foe med Int/Str", "foe atk→G", "foe atk→R", "med strikes"], R.curves.map(c => [c.L, c.T, `+${c.vanAtk}`, `${c.vanDmg}×${c.vanStrikes}`, c.vanG, c.vanR, `${c.vanInt}/${c.vanStr}`, c.casG, c.casR, `${c.casInt}/${c.casStr}`, `+${c.casAtk}`, c.foeMedG, c.foeMedR, `${c.foeMedInt}/${c.foeMedStr}`, `+${c.foeAtkG}`, `+${c.foeAtkR}`, c.foeStrikes]));
  p("### Flags (target misses, >15-pt swings level-to-level, calibration)");
  const fl = R.flags; const by = {}; for (const f of fl) (by[f.kind] ??= []).push(f);
  for (const [k, list] of Object.entries(by)) { p(`**${k}** (${list.length})`); p(""); for (const f of list) p(`- L${f.L} T${f.T} · ${f.cell} · ${f.note}${f.win != null ? ` (win ${f.win}%)` : ""}${f.anyDrop != null ? ` (P(drop) ${f.anyDrop}%)` : ""}`); p(""); }
  return out.join("\n");
}
