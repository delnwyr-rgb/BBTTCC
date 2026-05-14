// Monte Carlo distribution sim for the BBTTCC Sorting Engine v2.
//
// Usage:
//   node tools/sim-distribution.mjs              (default: 10000 trials, uniform-random answers)
//   node tools/sim-distribution.mjs 50000        (50k trials)
//   node tools/sim-distribution.mjs 10000 weighted   (answer-pick weighted by sefirah pillar bias — currently == uniform; placeholder for future modes)
//
// Output:
//   - Winner % per category (archetype, ancestry, crew, path, doctrine, philosophy, occult, alignment, classification)
//   - Trait coverage histogram (how often each trait gets pumped across the 20-question pool)
//   - Top-3 ancestry margin gap (how dominant the leader is on average)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_ROOT = resolve(__dirname, "..");
const SPEC_PATH = resolve(MODULE_ROOT, "data/bbttcc_sorting_engine_v2_full_spec.json");
const RESOLVER_PATH = resolve(MODULE_ROOT, "scripts/bbttcc-sorting-engine-v2.js");

// Stub Foundry globals the resolver touches at import time.
globalThis.Hooks = { once: () => {}, on: () => {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });

const resolver = await import(RESOLVER_PATH);
const SPEC = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

const trials = Number(process.argv[2]) || 10000;
const mode = process.argv[3] || "uniform";

const ANSWER_KEYS = ["A", "B", "C", "D"];

function randomAnswers(spec) {
  const out = {};
  for (const station of spec.stations) {
    for (const q of station.questions) {
      const valid = q.answers.map(a => a.key);
      out[q.id] = valid[Math.floor(Math.random() * valid.length)];
    }
  }
  return out;
}

function bumpTally(tallies, category, name) {
  if (!name) return;
  tallies[category] ??= {};
  tallies[category][name] = (tallies[category][name] || 0) + 1;
}

function countTraitCoverage(spec) {
  const coverage = {};
  for (const station of spec.stations) {
    for (const q of station.questions) {
      for (const a of q.answers) {
        for (const [trait, weight] of Object.entries(a.tags || {})) {
          coverage[trait] ??= { hits: 0, totalWeight: 0 };
          coverage[trait].hits += 1;
          coverage[trait].totalWeight += weight;
        }
      }
    }
  }
  return coverage;
}

function expectedTraitFromUniform(spec) {
  const expected = {};
  for (const station of spec.stations) {
    for (const q of station.questions) {
      const n = q.answers.length;
      for (const a of q.answers) {
        for (const [trait, weight] of Object.entries(a.tags || {})) {
          expected[trait] = (expected[trait] || 0) + weight / n;
        }
      }
    }
  }
  return expected;
}

const tallies = {};
let totalAncestryGap = 0;
let totalAncestryRunnerUp = 0;
let totalAncestryLeader = 0;

const startedAt = Date.now();
for (let i = 0; i < trials; i++) {
  const answers = randomAnswers(SPEC);
  const result = resolver.runFullDescent(answers, SPEC);

  bumpTally(tallies, "archetype",      result.build.archetype?.name);
  bumpTally(tallies, "ancestry",       result.build.ancestry?.name);
  bumpTally(tallies, "crew",           result.build.crew?.name);
  bumpTally(tallies, "path",           result.build.path?.name);
  bumpTally(tallies, "doctrine",       result.build.doctrine?.name);
  bumpTally(tallies, "philosophy",     result.build.philosophy?.name);
  bumpTally(tallies, "occult",         result.build.occult?.name);
  bumpTally(tallies, "alignment",      result.build.alignment?.name);
  bumpTally(tallies, "classification", result.classification);

  const ar = result.rankings.ancestry || [];
  if (ar[0] && ar[1]) {
    totalAncestryLeader   += ar[0].score;
    totalAncestryRunnerUp += ar[1].score;
    totalAncestryGap      += ar[0].score - ar[1].score;
  }
}
const elapsedMs = Date.now() - startedAt;

function printTally(label, dict) {
  const total = Object.values(dict).reduce((s, v) => s + v, 0) || 1;
  const rows = Object.entries(dict).sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ${label} (${total} trials) ===`);
  for (const [name, count] of rows) {
    const pct = (count / total) * 100;
    const bar = "█".repeat(Math.round(pct / 2));
    console.log(`  ${name.padEnd(28)} ${pct.toFixed(2).padStart(6)}%  ${bar}`);
  }
}

console.log(`\nBBTTCC Sorting Engine v2 — Monte Carlo Distribution Sim`);
console.log(`spec: ${SPEC.version} (schemaVersion ${SPEC.schemaVersion})`);
console.log(`trials: ${trials}    mode: ${mode}    elapsed: ${elapsedMs} ms`);

printTally("Ancestry winners",      tallies.ancestry      || {});
printTally("Path winners",          tallies.path          || {});
printTally("Archetype winners",     tallies.archetype     || {});
printTally("Crew winners",          tallies.crew          || {});
printTally("Alignment winners",     tallies.alignment     || {});
printTally("Occult winners",        tallies.occult        || {});
printTally("Philosophy winners",    tallies.philosophy    || {});
printTally("Doctrine winners",      tallies.doctrine      || {});
printTally("Classification labels", tallies.classification || {});

console.log(`\n=== Ancestry-leader dominance ===`);
console.log(`  avg leader score:    ${(totalAncestryLeader   / trials).toFixed(2)}`);
console.log(`  avg runner-up score: ${(totalAncestryRunnerUp / trials).toFixed(2)}`);
console.log(`  avg gap:             ${(totalAncestryGap      / trials).toFixed(2)}  (large gap = leader is structurally favored)`);

const coverage = countTraitCoverage(SPEC);
const expected = expectedTraitFromUniform(SPEC);
console.log(`\n=== Trait coverage across the 20-question pool ===`);
console.log(`(hits = how many answer options tag this trait; expected = mean trait value under uniform random play)`);
const traitRows = Object.entries(coverage)
  .map(([t, c]) => ({ trait: t, hits: c.hits, totalWeight: c.totalWeight, expected: expected[t] || 0 }))
  .sort((a, b) => b.expected - a.expected);
const maxExpected = Math.max(...traitRows.map(r => r.expected));
for (const r of traitRows) {
  const bar = "█".repeat(Math.round((r.expected / maxExpected) * 30));
  console.log(`  ${r.trait.padEnd(22)} hits=${String(r.hits).padStart(3)}  total=${String(r.totalWeight).padStart(3)}  expected=${r.expected.toFixed(2).padStart(5)}  ${bar}`);
}

console.log(`\nDone.\n`);
