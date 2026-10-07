#!/usr/bin/env node
/* sim-encounter.mjs — offline tactical-combat Monte Carlo for the NPC pack vs kitted Stewards.  `bin/ft-sim-encounter` symlinks here.
 * Usage: ft-sim-encounter <npcs.jsonl> <items.jsonl> [--n 2000] [--tier 2] [--name "Ash Wolf"] [--chassis system|file.json] [--normalize] [--json out.json]
 *   --chassis system = the live threat chassis (threat-chassis.js) · --normalize = clamp weapon dice to the tier budget
 *   (dumps come from `bin/ft-dump-pack npcs …` / `bin/ft-dump-pack items …` — ember live is canonical)
 *
 * Mirrors the system as of 2026-10-06 (systems/fourththing/module.js):
 *   derive        prepareDerivedData :18440  Int = 10+3B+(L−1)(bracket+⌊B/2⌋) · Stress = 10+2M+S+(L−1)(sBase+⌊M/2⌋)
 *                 Guard 10+V+B · Evasion 10+I+B · Resolve 10+P+S · + armor (ftComputeArmorBonus :11967, rank scale :11048; monsters rank≥2)
 *   attack        rolls.attackTest :15636  [2|3 at rank≥4]d10 keep 2, rank 2 reroll lowest, rank 3 floor 4; x10 chain only for PCs
 *                 (foes need flags.fourththing.surgeEnabled); mod = attr[intent] + skill rank + (foe ? tier : 0); hit on total ≥ defense
 *                 defense: category "ranged" → Evasion, else Guard
 *   damage        formula + attr[intent]; damageParts rolled separately, no faculty; resist ×½, vuln ×2, immune ×0; armor is NOT DR
 *                 track: psychic/qliphothic → Stress, else Integrity; 0 on either → out (Steward = "dropped")
 *   economy       striker paths (Aurablade/Bulwark/Harmony Marshal/Shadow Courier) strike `tier` times; others once.
 *                 Foes: one Strike; bosses + legendary Strikes (T3 1, T4 2 — ACTION_ECONOMY_CANON §6.3)
 * NOT modelled (prose-only abilities, Surge spends, techniques, manifestations, movement/cover, Last Stand recovery) — the
 * point is to show what the pack does AS AUTOMATED today; text-only riders are reported separately by the lint.
 */
import fs from "node:fs";
import { normalizeDamage } from "./threat-budget.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [NPCS, ITEMS] = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
if (!NPCS || !ITEMS) { console.error("usage: ft-sim-encounter <npcs.jsonl> <items.jsonl> [--n N] [--tier T] [--name substr] [--json out]"); process.exit(2); }
const N = Number(opt("--n", 2000)), ONLY_TIER = opt("--tier"), ONLY_NAME = opt("--name"), JSON_OUT = opt("--json");

const readJsonl = f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const npcRecs = readJsonl(NPCS), itemRecs = readJsonl(ITEMS);
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
const STRESS_TYPES = new Set(["psychic", "qliphothic"]);
const STRIKER = ["aurablade", "bulwark", "harmony marshal", "shadow courier"];
const BRACKET = { vanguard: [4, 2], mid: [3, 3], caster: [2, 4] };
const RANK_SCALE = [[0, 0], [0.5, 0], [1, 0], [1, 1], [1, 2], [1, 3]];
const WEIGHT_SKILL = { light: "fitting", medium: "bracing", heavy: "plating" };
const ALIAS = { weave: "fitting", warding: "bracing", weaver: "fitting" };

// ── dice ─────────────────────────────────────────────────────────────────────────────────────────────
const d = n => 1 + Math.floor(Math.random() * n);
function rollFormula(f) {                                    // "3d6 + 3", "1d12+2", "2d8" — @refs ignored (0)
  let tot = 0;
  for (const m of String(f || "0").replace(/\s+/g, "").replace(/@[\w.]+/g, "0").matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g)) {
    if (m[3]) { const s = m[1] === "-" ? -1 : 1, n = Number(m[2] || 1); for (let k = 0; k < n; k++) tot += s * d(Number(m[3])); }
    else if (m[5]) tot += (m[4] === "-" ? -1 : 1) * Number(m[5]);
  }
  return tot;
}
function attackDice(rank, explodes) {
  let dice = Array.from({ length: rank >= 4 ? 3 : 2 }, () => d(10));
  if (rank === 2 || rank === 3) { const lo = dice.indexOf(Math.min(...dice)); if (rank === 2) dice[lo] = d(10); }
  if (rank >= 3) dice = dice.map(x => Math.max(4, x));
  dice.sort((a, b) => b - a); dice = dice.slice(0, 2);
  let tot = 0;
  for (let x of dice) { tot += x; if (explodes) while (x === 10) { x = d(10); tot += x; } }
  return tot;
}

// ── combatant derive ─────────────────────────────────────────────────────────────────────────────────
function armorSkillOf(item) {
  for (const t of item.system?.tags || []) { const k = WEIGHT_SKILL[String(t).toLowerCase()]; if (k) return k; }
  const dec = ALIAS[item.system?.armorSkill] || item.system?.armorSkill;
  return ["fitting", "bracing", "plating"].includes(dec) ? dec : "fitting";
}
function derive(c) {
  const a = c.attrs, L = Math.max(1, c.level || 1), [ib, sb] = BRACKET[c.bracket || "mid"];
  c.intMax = 10 + 3 * a.body + (L - 1) * (ib + Math.floor(a.body / 2));
  c.strMax = 10 + 2 * a.mind + a.soul + (L - 1) * (sb + Math.floor(a.mind / 2));
  c.def = { guard: 10 + a.violence + a.body, evasion: 10 + a.intrigue + a.body, resolve: 10 + a.presence + a.soul };
  c.resist = new Set(c.resist || []); c.vuln = new Set(c.vuln || []); c.immune = new Set(c.immune || []);
  for (const it of c.armor || []) {
    const rank = c.monster ? Math.max(2, c.skills[armorSkillOf(it)] || 0) : (c.skills[armorSkillOf(it)] || 0);
    const [mult, flat] = RANK_SCALE[rank] || RANK_SCALE[0];
    for (const [k, f] of [["guard", "guardBonus"], ["evasion", "evasionBonus"], ["resolve", "resolveBonus"]]) {
      const raw = Number(it.system?.[f]) || 0; c.def[k] += Math.round(raw * mult) + (raw > 0 ? flat : 0);
    }
    for (const r of it.system?.resistances || []) c.resist.add(r);
  }
  for (const s of ["resist", "vuln", "immune"]) if (c[s].has("energy")) for (const t of ["electrical", "thermal", "chemical"]) c[s].add(t);
  return c;
}
const weaponOf = it => ({
  name: it.name, f: it.system?.damage?.formula || (it.system?.damageRoll?.number ? `${it.system.damageRoll.number}${it.system.damageRoll.die}` : "0"),
  type: aliasType(it.system?.damage?.type || it.system?.damageRoll?.type || "kinetic", it.system?.damage?.damageFlavor),
  intent: it.system?.intent || "violence", skill: it.system?.skill || "melee", ranged: it.system?.category === "ranged",
  parts: (it.system?.damageParts || []).filter(p => p?.formula).map(p => ({ f: p.formula, type: aliasType(p.type || "kinetic", p.flavor) })),
  limited: /recharge|1\/day|1\/scene|once per/i.test(it.name),
});
function aliasType(t, fl) {
  t = String(t).toLowerCase().split(":")[0]; if (t !== "energy") return t;
  fl = String(fl || "").toLowerCase();
  return /cold|ice|frost|fire|hot|flame|heat|burn/.test(fl) ? "thermal" : /acid|base|alkal|caust/.test(fl) ? "chemical" : "electrical";
}

// ── monsters from the pack ───────────────────────────────────────────────────────────────────────────
const actors = npcRecs.filter(r => r.k.startsWith("!actors!")).map(r => r.v);
const itemsByActor = {};
for (const r of npcRecs.filter(r => r.k.startsWith("!actors.items!"))) (itemsByActor[r.k.split("!")[2].split(".")[0]] ??= []).push(r.v);
function monsterFrom(a) {
  const r = a.flags?.fourththing?.rfi?.actor || {}, s = a.system, its = itemsByActor[a._id] || [];
  const tier = ROMAN[r.tier] || Number(s.details?.tier) || 1;
  const grants = its.flatMap(i => i.flags?.fourththing?.grants?.resists || []);
  return derive({
    name: a.name, monster: true, foe: true, tier, bracket: "mid", level: Number(s.details?.level) || 1, lineage: r.lineage, role: r.bracket,
    attrs: Object.fromEntries(["violence", "intrigue", "presence", "body", "mind", "soul"].map(k => [k, Number(s.attributes?.[k]?.value) || 0])),
    skills: Object.fromEntries(Object.entries(s.skills || {}).map(([k, v]) => [k, Number(v?.value ?? v) || 0])),
    weapons: its.filter(i => i.type === "weapon").map(weaponOf), armor: its.filter(i => i.type === "armor" && i.system?.equipped !== false),
    resist: [...(s.defenses?.resistances || []), ...grants], vuln: s.defenses?.vulnerabilities || [], immune: s.defenses?.immunities || [],
    strikes: 1, legendary: r.bracket === "boss" ? ({ 3: 1, 4: 2 })[tier] || 0 : 0,
  });
}

// ── Stewards: four paths × four tiers, real live gear, chargen array + 1 faculty/level (cap 10) ───────
const gear = Object.fromEntries(itemRecs.filter(r => r.k.startsWith("!items!")).map(r => [r.v.name, r.v]));
const need = n => { if (!gear[n]) throw new Error(`live items pack has no "${n}"`); return gear[n]; };
const LEVEL = { 1: 1, 2: 8, 3: 13, 4: 18 };                 // same levels the monster builder writes
const BUILDS = {
  Bulwark:         { bracket: "vanguard", striker: true, base: { violence: 4, intrigue: 2, presence: 3, body: 5, mind: 3, soul: 2 }, grow: ["violence", "body", "presence"],
    kit: { 1: ["Maul", "Bulwark Hauberk"], 2: ["Maul", "Steelweave Hauberk"], 3: ["Soulbound Hex-Reaver", "Hex-Carved Plate"], 4: ["Soulbound Hex-Reaver", "Yesodic Plating"] } },
  Aurablade:       { bracket: "vanguard", striker: true, base: { violence: 5, intrigue: 2, presence: 3, body: 3, mind: 2, soul: 4 }, grow: ["violence", "body", "soul"],
    kit: { 1: ["Hand Axe", "Patrolman's Plate", "Pressed Buckler"], 2: ["Hand Axe", "Steelweave Hauberk", "Wardiron Targe"], 3: ["Frikkin' Laser Blade Saber", "Hex-Carved Plate", "Null-Field Tower Shield"], 4: ["Yesodic Edge", "Yesodic Plating", "Oathkeeper's Bulwark"] } },
  "Shadow Courier": { bracket: "mid", striker: true, base: { violence: 4, intrigue: 5, presence: 2, body: 3, mind: 2, soul: 3 }, grow: ["violence", "intrigue", "body"],
    kit: { 1: ["Slug Pistol", "Drifter's Weave"], 2: ["Hex-Script Pistol", "Septhide Vestments"], 3: ["Hex-Script Pistol", "Septhide Vestments"], 4: ["Hex-Script Pistol", "Septhide Vestments"] } },
  Dreamwalker:     { bracket: "caster", striker: false, base: { violence: 2, intrigue: 2, presence: 3, body: 3, mind: 5, soul: 4 }, grow: ["mind", "body", "soul"],
    kit: { 1: ["Quantum Staff", "Drifter's Weave"], 2: ["Quantum Staff", "Septhide Vestments"], 3: ["Quantum Staff", "Septhide Vestments"], 4: ["Quantum Staff", "Mantle of the Unbroken Circle"] } },
};
const APT_POINTS = L => [3, 6, 9, 12, 15, 18, 20].filter(x => x <= L).length * 2;
function steward(name, tier) {
  const b = BUILDS[name], L = LEVEL[tier], attrs = { ...b.base };
  let pts = L - 1;                                            // levelUp: +1 faculty per level, cap 10
  for (const k of b.grow) { const add = Math.min(pts, 10 - attrs[k]); attrs[k] += add; pts -= add; }
  const items = b.kit[tier].map(need), weapons = items.filter(i => i.type === "weapon").map(weaponOf), armor = items.filter(i => i.type === "armor");
  const wSkill = weapons[0].skill, aSkills = [...new Set(armor.map(armorSkillOf))];
  const skills = { [wSkill]: 1 }; for (const s of aSkills) skills[s] = 1;          // L1 path grants (rank 1)
  let free = 3 + APT_POINTS(L);                                                     // 3 chargen picks + 2 per aptitude level
  const order = [wSkill, ...aSkills];
  for (let guard = 0; free > 0 && guard < 50; guard++) for (const s of order) if (free > 0 && skills[s] < 5) { skills[s]++; free--; }
  return derive({ name, tier, level: L, bracket: b.bracket, attrs, skills, weapons, armor, strikes: b.striker ? tier : 1, legendary: 0, foe: false });
}

// ── one fight ────────────────────────────────────────────────────────────────────────────────────────
function fresh(c) { return { ...c, int: c.intMax, str: c.strMax, used: new Set() }; }
const alive = c => c.int > 0 && c.str > 0;
function expected(att, w, tgt) {
  const mod = (att.attrs[w.intent] || 0) + Math.max(att.skills[w.skill] || 0, att.threat?.rank || 0) + (att.foe ? att.tier : 0) + (att.threat?.attack || 0);
  const need = tgt.def[w.ranged ? "evasion" : "guard"] - mod;
  const p = Math.max(0.01, Math.min(1, 1 - Math.max(0, need - 2) / 19 * (need > 11 ? 1.6 : 1)));  // rough ranking only
  return p * (avgFormula(w.f) + (att.attrs[w.intent] || 0)) * mult(tgt, w.type);
}
const avgCache = {}; function avgFormula(f) { return avgCache[f] ??= Array.from({ length: 400 }, () => rollFormula(f)).reduce((a, b) => a + b, 0) / 400; }
const mult = (t, type) => t.immune.has(type) ? 0 : (t.vuln.has(type) ? 2 : 1) * (t.resist.has(type) ? 0.5 : 1);
function strike(att, tgt) {
  const pool = att.weapons.filter(w => !(w.limited && att.used.has(w.name)));
  if (!pool.length) return;
  const w = pool.reduce((best, x) => expected(att, x, tgt) > expected(att, best, tgt) ? x : best);
  if (w.limited) att.used.add(w.name);
  const rank = Math.max(att.skills[w.skill] || 0, att.threat?.rank || 0);
  const total = attackDice(rank, !att.foe) + (att.attrs[w.intent] || 0) + rank + (att.foe ? att.tier : 0) + (att.threat?.attack || 0);
  if (total < tgt.def[w.ranged ? "evasion" : "guard"]) return;
  for (const [f, type, fac] of [[w.f, w.type, att.attrs[w.intent] || 0], ...w.parts.map(p => [p.f, p.type, 0])]) {
    const dmg = Math.floor(Math.max(0, rollFormula(f) + fac + (fac ? att.threat?.damage || 0 : 0)) * mult(tgt, type));
    if (STRESS_TYPES.has(type)) tgt.str -= dmg; else tgt.int -= dmg;
  }
}
function fight(party, foes, maxRounds = 20) {
  const P = party.map(fresh), F = foes.map(fresh);
  const order = [...P, ...F].map(c => ({ c, init: attackDice(0, !c.foe) + c.attrs.intrigue })).sort((a, b) => b.init - a.init).map(x => x.c);
  let round = 0;
  while (round < maxRounds && P.some(alive) && F.some(alive)) {
    round++;
    for (const c of order) {
      if (!alive(c)) continue;
      const enemies = (c.foe ? P : F).filter(alive); if (!enemies.length) break;
      for (let s = 0; s < c.strikes; s++) {
        const live = enemies.filter(alive); if (!live.length) break;
        const tgt = c.foe ? live[Math.floor(Math.random() * live.length)] : live.reduce((a, b) => (a.int < b.int ? a : b));
        strike(c, tgt);
      }
      if (c.legendary) for (let s = 0; s < c.legendary; s++) {          // legendary Strikes fire between turns; approximated here
        const live = P.filter(alive); if (live.length) strike(c, live[Math.floor(Math.random() * live.length)]);
      }
    }
  }
  return { win: !F.some(alive) && P.some(alive), rounds: round, dropped: P.filter(c => !alive(c)).length, timeout: round >= maxRounds && P.some(alive) && F.some(alive) };
}
function series(partyFn, foe, count = 1) {
  let win = 0, rounds = 0, anyDrop = 0, drops = 0, timeouts = 0;
  for (let k = 0; k < N; k++) { const r = fight(partyFn(), Array(count).fill(foe)); win += r.win; rounds += r.rounds; anyDrop += r.dropped > 0; drops += r.dropped; timeouts += r.timeout; }
  return { win: win / N, rounds: rounds / N, anyDrop: anyDrop / N, drops: drops / N, timeouts: timeouts / N };
}

// ── run ──────────────────────────────────────────────────────────────────────────────────────────────
// ── --chassis: the threat chassis (systems/fourththing/threat-chassis.js shape) ─────────────────────────
// Monsters keep their AUTHORED faculties (their shape); the chassis adds tier-scaled flat bonuses the way a
// Steward's levels do, and the bracket multiplies the pools + sets Strikes. File shape:
//   { attack[t], damage[t], defense[t], rank[t], bracket: { light|medium|heavy|boss: { pool[t], strikes[t], legendary[t] } }, mobSize }
// `--chassis system` reads the SHIPPED table (systems/fourththing/threat-chassis.js) — the default for balance checks
const CHASSIS = opt("--chassis") === "system"
  ? (await import(new URL("../../../systems/fourththing/threat-chassis.js", import.meta.url))).THREAT_CHASSIS
  : opt("--chassis") ? JSON.parse(fs.readFileSync(opt("--chassis"), "utf8")) : null;
const NORMALIZE = argv.includes("--normalize");
function applyChassis(m) {
  if (NORMALIZE) m.weapons = m.weapons.map(w => ({ ...w, f: normalizeDamage(w.f, m.tier, w.limited) }));
  if (!CHASSIS) return m;
  const C = CHASSIS, t = m.tier - 1, B = C.bracket[m.role] || C.bracket.medium;
  const out = { ...m, def: { ...m.def } };
  out.intMax = Math.round(m.intMax * B.pool[t]); out.strMax = Math.round(m.strMax * B.pool[t]);
  for (const k of ["guard", "evasion", "resolve"]) out.def[k] += C.defense[t];
  out.threat = { attack: C.attack[t], damage: C.damage[t], rank: C.rank[t] };
  out.strikes = B.strikes[t]; out.legendary = B.legendary?.[t] ?? 0;
  return out;
}
const monsters = actors.filter(a => a.flags?.fourththing?.rfi?.actor?.lineage).map(monsterFrom).map(applyChassis)
  .filter(m => (!ONLY_TIER || m.tier === Number(ONLY_TIER)) && (!ONLY_NAME || m.name.toLowerCase().includes(ONLY_NAME.toLowerCase())))
  .sort((a, b) => a.tier - b.tier || ["light", "medium", "heavy", "boss"].indexOf(a.role) - ["light", "medium", "heavy", "boss"].indexOf(b.role) || a.name.localeCompare(b.name));
const names = Object.keys(BUILDS), stewards = {};
for (const t of [1, 2, 3, 4]) stewards[t] = Object.fromEntries(names.map(n => [n, steward(n, t)]));

console.log(`sim-encounter — ${monsters.length} monsters × ${N} fights per scenario (solo = mean of 4 paths; duo = Bulwark+Shadow Courier; party = all 4)\n`);
console.log("STEWARDS (as derived):");
for (const t of [1, 2, 3, 4]) for (const n of names) { const s = stewards[t][n]; console.log(`  T${t} L${s.level} ${n.padEnd(15)} Int ${String(s.intMax).padStart(3)} Str ${String(s.strMax).padStart(3)} G${s.def.guard} E${s.def.evasion} R${s.def.resolve}  ${s.weapons[0].name} (${s.weapons[0].f}) skill ${s.skills[s.weapons[0].skill]}  strikes ${s.strikes}  resist [${[...s.resist].join(",")}]`); }
console.log("");
const TARGET = { light: "mob", medium: "solo", heavy: "duo", boss: "party" };
const MOB = CHASSIS?.mobSize ?? 3;   // lights are mob units: MOB of them vs one Steward is the fair fight
const out = [];
const pct = x => `${Math.round(x * 100)}%`.padStart(4);
const fmt = r => `${pct(r.win)} ${r.rounds.toFixed(1).padStart(4)}r ↓${pct(r.anyDrop)}`;
console.log(`(light rows: solo column = ${MOB} of them vs one Steward)`);
console.log("tier role   monster                          Int Str  G  E  R | solo (win rnds ↓any) | duo              | party            | verdict");
for (const m of monsters) {
  const S = stewards[m.tier];
  const solos = names.map(n => series(() => [S[n]], m, m.role === "light" ? MOB : 1));
  const solo = Object.fromEntries(["win", "rounds", "anyDrop", "drops", "timeouts"].map(k => [k, solos.reduce((a, r) => a + r[k], 0) / solos.length]));
  const duo = series(() => [S.Bulwark, S["Shadow Courier"]], m), party = series(() => names.map(n => S[n]), m);
  const want = TARGET[m.role] || "solo", got = { solo, mob: solo, duo, party }[want];
  let verdict = "OK";
  if (want === "solo" || want === "mob") verdict = got.win > 0.85 ? "TOO EASY" : got.win < 0.45 ? "TOO HARD" : got.rounds < 2.5 ? "too short" : "OK";
  if (want === "duo") verdict = solo.win > 0.6 ? "TOO EASY (solo wins)" : got.win < 0.55 ? "TOO HARD" : got.win > 0.95 && got.anyDrop < 0.1 ? "soft" : "OK";
  if (want === "party") verdict = duo.win > 0.6 ? "TOO EASY (duo wins)" : got.win < 0.6 ? "TOO HARD" : got.anyDrop < 0.25 ? "no teeth" : "OK";
  out.push({ name: m.name, tier: m.tier, role: m.role, lineage: m.lineage, intMax: m.intMax, strMax: m.strMax, def: m.def, solo, duo, party, verdict });
  console.log(`T${m.tier}  ${String(m.role).padEnd(6)} ${m.name.slice(0, 32).padEnd(32)} ${String(m.intMax).padStart(3)} ${String(m.strMax).padStart(3)} ${m.def.guard} ${m.def.evasion} ${m.def.resolve} | ${fmt(solo)} | ${fmt(duo)} | ${fmt(party)} | ${verdict}`);
}
// per tier×bracket roll-up — the tuning view
console.log("\nROLL-UP (mean over monsters)              solo/mob            duo                party              OK");
const groups = {}; for (const r of out) (groups[`T${r.tier} ${r.role}`] ??= []).push(r);
const mean = (rs, sc, k) => rs.reduce((a, r) => a + r[sc][k], 0) / rs.length;
for (const [g, rs] of Object.entries(groups)) {
  const f = sc => `${pct(mean(rs, sc, "win"))} ${mean(rs, sc, "rounds").toFixed(1).padStart(4)}r ↓${pct(mean(rs, sc, "anyDrop"))}`;
  console.log(`  ${g.padEnd(10)} n=${String(rs.length).padStart(2)}                     ${f("solo")} | ${f("duo")} | ${f("party")} | ${rs.filter(r => r.verdict === "OK").length}/${rs.length}`);
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ n: N, stewards, results: out }, (k, v) => v instanceof Set ? [...v] : v, 1));
