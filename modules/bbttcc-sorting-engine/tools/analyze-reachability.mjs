// Reachability + "consistent player" analysis for the Sorting Engine v2 (2026-10-23).
//
// Uniform-random answers (sim-distribution.mjs) say what a coin-flipper gets. Two more questions matter:
//   1. REACHABILITY — can ANY set of 20 answers make each option win its category? Hill-climb with random
//      restarts maximising (option score − best rival score). Best margin < 0 ⇒ unreachable in practice.
//   2. PERSONA play — real people answer consistently. Each simulated player gets a hidden preference over the
//      29 traits and picks, per question, the answer whose tags best match it (softmax, some noise).
//
// Usage: node tools/analyze-reachability.mjs [personaTrials=20000] [restarts=60]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
globalThis.Hooks = { once: () => {}, on: () => {} };
const E = await import(resolve(__dirname, "../scripts/bbttcc-sorting-engine-v2.js"));
const SPEC = JSON.parse(readFileSync(resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json"), "utf8"));

const personaTrials = Number(process.argv[2]) || 20000;
const restarts = Number(process.argv[3]) || 60;
const QS = SPEC.stations.flatMap((s) => s.questions);
const TRAITS = SPEC.traits.map((t) => t.id || t.name || t);
const CATS = ["archetype", "ancestry", "path", "doctrine", "alignment", "crew", "occult", "philosophy"];

const rank = (answers, cat) => E.runFullDescent(answers, SPEC).rankings[cat];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomAnswers = () => Object.fromEntries(QS.map((q) => [q.id, pick(q.answers).key]));

function margin(answers, cat, name) {
  const r = rank(answers, cat);
  const me = r.find((x) => x.name === name);
  if (!me) return -Infinity;
  const rival = r.find((x) => x.name !== name);
  return me.score - (rival ? rival.score : 0);
}

function bestMargin(cat, name) {
  let best = -Infinity;
  for (let s = 0; s < restarts; s++) {
    let a = randomAnswers(), m = margin(a, cat, name), improved = true;
    while (improved) {
      improved = false;
      for (const q of QS) for (const ans of q.answers) {
        if (a[q.id] === ans.key) continue;
        const b = { ...a, [q.id]: ans.key }, mb = margin(b, cat, name);
        if (mb > m) { a = b; m = mb; improved = true; }
      }
    }
    if (m > best) best = m;
  }
  return best;
}

function personaAnswers() {
  const pref = Object.fromEntries(TRAITS.map((t) => [t, Math.random() * 2 - 1]));
  const temp = 0.6;
  const out = {};
  for (const q of QS) {
    const scores = q.answers.map((a) => Object.entries(a.tags || {}).reduce((s, [t, v]) => s + v * (pref[t] ?? 0), 0) / temp);
    const mx = Math.max(...scores), ws = scores.map((x) => Math.exp(x - mx)), tot = ws.reduce((x, y) => x + y, 0);
    let r = Math.random() * tot, i = 0; while ((r -= ws[i]) > 0) i++;
    out[q.id] = q.answers[Math.min(i, q.answers.length - 1)].key;
  }
  return out;
}

const tally = (gen, n) => {
  const t = Object.fromEntries(CATS.map((c) => [c, {}]));
  for (let i = 0; i < n; i++) {
    const r = E.runFullDescent(gen(), SPEC);
    for (const c of CATS) { const w = r.rankings[c]?.[0]?.name; if (w) t[c][w] = (t[c][w] || 0) + 1; }
  }
  return t;
};

const uni = tally(randomAnswers, personaTrials);
const per = tally(personaAnswers, personaTrials);
const pct = (t, c, n) => (((t[c][n] || 0) / personaTrials) * 100).toFixed(1).padStart(5) + "%";

const rows = [];
for (const c of CATS) {
  const names = c === "doctrine"
    ? Object.entries(SPEC.resolverWeights.doctrine).filter(([k]) => !k.startsWith("_")).flatMap(([cls, ds]) => Object.keys(ds).filter((n) => !n.startsWith("_")).map((n) => ({ n, cls })))
    : Object.keys(SPEC.resolverWeights[c === "path" ? "class" : c]).filter((n) => !n.startsWith("_")).map((n) => ({ n }));
  console.log(`\n=== ${c} — option · uniform · persona · best achievable margin (≤0 = can't win) ===`);
  for (const { n } of names) {
    if (c === "alignment" && E.isAlignmentLocked(n)) { console.log(`  ${n.padEnd(30)} (locked)`); continue; }
    const m = c === "doctrine" ? null : bestMargin(c, n);
    const flag = m !== null && m <= 0 ? "  ⛔ UNREACHABLE" : "";
    console.log(`  ${n.padEnd(30)} ${pct(uni, c, n)}  ${pct(per, c, n)}  ${m === null ? "  (within path)" : String(m.toFixed(1)).padStart(7)}${flag}`);
    rows.push({ cat: c, name: n, uniform: (uni[c][n] || 0) / personaTrials, persona: (per[c][n] || 0) / personaTrials, bestMargin: m });
  }
}
if (process.env.JSON_OUT) (await import("node:fs")).writeFileSync(process.env.JSON_OUT, JSON.stringify(rows, null, 1));
