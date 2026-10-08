#!/usr/bin/env node
// tune-bestiary.mjs — offline greedy auto-tuner for the bestiary (bin/ft-tune-bestiary). Each iteration tries ONE step of each lever (dice / body / primary
// faculty) on every open monster, runs sim-encounter per candidate, and keeps the lever that lands nearest the band centre.
// usage: ft-tune-bestiary <npcs.jsonl> <items.jsonl> <out-patch.json> [--n 500] [--max 8] [--gate with.json,without.json] [--no-resist]
//   --gate a.json,b.json = two `ft-sim-encounter --json` baselines (one WITH resistances, one --no-resist): only monsters flagged
//     the SAME way in both are touched — a verdict that exists in one view only is a damage-type match-up, not a stat problem.
//   --no-resist = judge candidates type-neutrally (recommended with --gate). Levers: dice = one ladder step inside the tier
//   budget (threat-budget.mjs; Stress-track weapons may run to ½ the floor) · body = Guard + Integrity · intent = the faculty behind
//   the weapon the sim favours. Faculties stay within 1–10. Output patch.json feeds build-bestiary-tuning.mjs → guarded GM macro.
//   Side files next to <out-patch.json>: .cur/.dice/.body/.intent/.final .jsonl + .sim.json (the last candidate dumps).
import fs from "node:fs"; import { execFileSync } from "node:child_process";
import { budgetFor, meanDice, trackOf } from "./threat-budget.mjs";
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [NPCS, ITEMS, OUT] = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
const N = opt("--n", "500"), MAX = Number(opt("--max", 8)), EXTRA = argv.includes("--no-resist") ? ["--no-resist"] : [];
const SIM = new URL("./sim-encounter.mjs", import.meta.url).pathname;
const LADDER = ["1d4", "1d6", "1d8", "1d10", "1d12", "2d6", "2d8", "2d10", "3d8", "2d12", "3d10", "4d8", "3d12", "4d10", "5d8", "4d12"];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
const DIR = v => /TOO HARD/.test(v) ? -1 : /TOO EASY|soft|no teeth|too short/.test(v) ? 1 : 0;
const rows = fs.readFileSync(NPCS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const actors = rows.filter(r => r.k.startsWith("!actors!")).map(r => r.v);
const itemsOf = id => rows.filter(r => r.k.startsWith(`!actors.items!${id}.`)).map(r => r.v);
let ONLY = null;
if (opt("--gate")) {
  const [A, B] = opt("--gate").split(",").map(f => JSON.parse(fs.readFileSync(f, "utf8")).results);
  ONLY = new Set(A.filter(a => { const b = B.find(x => x.name === a.name); return DIR(a.verdict) !== 0 && b && DIR(b.verdict) === DIR(a.verdict); }).map(a => a.name));
  console.log(`gate: ${ONLY.size} monsters flagged the same way with and without resistances`);
}
// score: distance from the band centre on the role's deciding column, + penalties for the secondary conditions
function score(r) {
  const role = r.role;
  if (role === "light" || role === "medium") return Math.abs(r.solo.win - 0.65) + (r.solo.rounds < 2.5 ? 0.3 : 0);
  if (role === "heavy") return Math.abs(r.duo.win - 0.78) + (r.solo.win > 0.6 ? r.solo.win - 0.6 : 0) + (r.duo.win > 0.95 && r.duo.anyDrop < 0.1 ? 0.2 : 0);
  return Math.abs(r.party.win - 0.82) + (r.duo.win > 0.6 ? r.duo.win - 0.6 : 0) + (r.party.anyDrop < 0.25 ? 0.25 - r.party.anyDrop : 0);
}
// state[name] = { attrs:{k:[old,new]}, weapons:{item:[old,new]}, steps:[], verdicts:[] }
const state = {}; const S = n => (state[n] ??= { attrs: {}, weapons: {}, steps: [], verdicts: [] });
const curAttr = (a, p, k) => p.attrs[k] ? p.attrs[k][1] : (Number(a.system.attributes[k]?.value) || 0);
const curF = (p, w) => p.weapons[w.name] ? p.weapons[w.name][1] : (w.system?.damage?.formula || "");
function stepDice(f, dir, tier, limited, track) {
  const base = String(f).replace(/\s+/g, ""); const m = base.match(/^(\d*d\d+)([+-]\d+)?$/); if (!m) return null;
  const i = LADDER.indexOf(m[1]); if (i < 0) return null; const j = i + dir; if (j < 0 || j >= LADDER.length) return null;
  const [lo, hi] = budgetFor(tier, limited, track); const mean = meanDice(LADDER[j]); if (mean < lo || mean > hi) return null;
  return LADDER[j] + (m[2] || "");
}
/** candidate = a deep copy of state[name] with one lever stepped, or null */
function candidate(a, p, lever, dir) {
  const r = a.flags.fourththing.rfi.actor, tier = ROMAN[r.tier] || 1, ws = itemsOf(a._id).filter(i => i.type === "weapon");
  const c = structuredClone(p);
  if (lever === "dice") {
    let n = 0; for (const w of ws) { const nf = stepDice(curF(p, w), dir, tier, /recharge|1\/day|1\/scene|once per/i.test(w.name), trackOf(w)); if (nf) { c.weapons[w.name] = [w.system.damage.formula, nf]; n++; } }
    if (!n) return null; c.steps.push(`dice${dir > 0 ? "+" : "-"}`); return c;
  }
  const k = lever === "body" ? "body" : (ws.map(w => w.system?.intent || "violence").sort((x, y) => curAttr(a, p, y) - curAttr(a, p, x))[0] || "violence");
  const v = curAttr(a, p, k) + dir; if (v < 1 || v > 10) return null;
  c.attrs[k] = [Number(a.system.attributes[k]?.value) || 0, v]; c.steps.push(`${k}${dir > 0 ? "+" : "-"}`); return c;
}
function writePatched(file, st) {
  const out = rows.map(r => {
    if (r.k.startsWith("!actors!")) { const p = st[r.v.name]; if (!p) return r; const v = structuredClone(r.v); for (const [k, [, nv]] of Object.entries(p.attrs)) v.system.attributes[k].value = nv; return { k: r.k, v }; }
    if (r.k.startsWith("!actors.items!")) { const a = actors.find(x => x._id === r.k.split("!")[2].split(".")[0]); const p = a && st[a.name]; if (!p || r.v.type !== "weapon" || !p.weapons[r.v.name]) return r; const v = structuredClone(r.v); v.system.damage.formula = p.weapons[r.v.name][1]; return { k: r.k, v }; }
    return r;
  });
  fs.writeFileSync(file, out.map(x => JSON.stringify(x)).join("\n"));
}
function run(st, tag) {
  const f = `${OUT}.${tag}.jsonl`, j = `${OUT}.${tag}.sim.json`; writePatched(f, st);
  execFileSync("node", [SIM, f, ITEMS, "--chassis", "system", "--n", N, "--json", j, ...EXTRA], { stdio: ["ignore", "ignore", "inherit"] });
  return Object.fromEntries(JSON.parse(fs.readFileSync(j, "utf8")).results.map(r => [r.name, r]));
}
let cur = run(state, "cur"); const done = new Set(), stuck = new Set();
const open = () => Object.keys(cur).filter(n => (!ONLY || ONLY.has(n)) && DIR(cur[n].verdict) !== 0 && !stuck.has(n));
for (let it = 0; it < MAX && open().length; it++) {
  const names = open(); const cands = {};                                   // lever → state with that lever applied to every open monster
  for (const lever of ["dice", "body", "intent"]) {
    const st = structuredClone(state); let any = 0;
    for (const n of names) { const a = actors.find(x => x.name === n); const c = candidate(a, S(n), lever, DIR(cur[n].verdict)); if (c) { st[n] = c; any++; } else delete st[n]; }
    for (const n of Object.keys(state)) if (!names.includes(n)) st[n] = state[n];
    cands[lever] = any ? { st, res: run(st, lever) } : null;
  }
  let moved = 0;
  for (const n of names) {
    let best = null;
    for (const lever of ["dice", "body", "intent"]) { const c = cands[lever]; if (!c || !c.st[n] || c.st[n].steps.length === S(n).steps.length) continue; const s = score(c.res[n]); if (!best || s < best.s - 1e-9) best = { lever, s, r: c.res[n], st: c.st[n] }; }
    if (!best || best.s >= score(cur[n]) - 0.005) { stuck.add(n); continue; }  // no lever improves → stop touching it
    state[n] = best.st; state[n].verdicts.push(best.r.verdict); cur[n] = best.r; moved++;
  }
  console.log(`iter ${it}: ${names.length} open → ${moved} stepped, ${stuck.size} stuck · now OK ${Object.values(cur).filter(r => r.verdict === "OK").length}/${Object.keys(cur).length}`);
  if (!moved) break;
}
cur = run(state, "final");
for (const n of Object.keys(state)) { const p = state[n]; if (!Object.keys(p.attrs).length && !Object.keys(p.weapons).length) delete state[n]; else p.verdicts.push(cur[n].verdict); }
fs.writeFileSync(OUT, JSON.stringify(state, null, 1));
console.log(`patch → ${OUT} (${Object.keys(state).length} monsters)`);
for (const [n, p] of Object.entries(state)) { const r = cur[n]; console.log(`  ${n.slice(0, 38).padEnd(38)} ${p.steps.join(" ").padEnd(30)} ${JSON.stringify(p.attrs)} ${JSON.stringify(p.weapons)} → ${r.verdict} (solo ${(r.solo.win * 100).toFixed(0)}% duo ${(r.duo.win * 100).toFixed(0)}% party ${(r.party.win * 100).toFixed(0)}%)`); }
for (const n of (ONLY ? [...ONLY] : [])) if (DIR(cur[n]?.verdict ?? "OK") !== 0) console.log(`  STILL OPEN: ${n} → ${cur[n].verdict}`);
