// Rebalance Pass 3 — alignment, occult, Aurablade, philosophy spread.
//
// Targets (expected score under uniform-random play):
//   Alignment: every sefirot 10–12 (was Keter 4.00, Malkuth 11.50)
//   Occult Shaman: 33.00 → ~22 (cut from 52% empirical share)
//   Path Aurablade: 13.25 → ~21 (rare but possible)
//   Philosophy: boost Liberal/Libertarian/Social Democratic so every philosophy ≥ 19

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-pass-3";

if (!existsSync(BACKUP_PATH)) {
  copyFileSync(SPEC_PATH, BACKUP_PATH);
  console.log(`Backed up Pass-2 spec → ${BACKUP_PATH}`);
}

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

// Each alignment now has a thematic secondary trait (+ Keter/Chokhmah get signal weight 2).
// Spread compresses to ~10–12 expected.
const ALIGNMENT_OVERRIDES = {
  "Keter":     { keter_signal: 2,     ambition: 1 },
  "Chokhmah":  { chokhmah_signal: 2,  study: 1 },
  "Binah":     { binah_signal: 1,     sorrow: 1 },
  "Chesed":    { chesed_signal: 1,    compassion: 1 },
  "Gevurah":   { gevurah_signal: 1,   severity: 1 },
  "Tiphareth": { tiphareth_signal: 1, ritual: 1 },
  "Netzach":   { netzach_signal: 1,   kinship: 1 },
  "Hod":       { hod_signal: 1,       ambition: 1 },
  "Yesod":     { yesod_signal: 1 },
  "Malkuth":   { malkuth_signal: 1 },
};

const OCCULT_OVERRIDES = {
  // 33.00 → ~22.5; still ritual-coded but no longer dominates
  "Shaman": { ritual: 2, kinship: 1, sorrow: 1, malkuth_signal: 1 },
};

const PATH_OVERRIDES = {
  // 13.25 → ~21; rare but possible. Keeps _variableAuraBased metadata note (resolver ignores underscore-prefixed keys).
  "Aurablade": {
    violence: 2,
    ritual: 2,
    ambition: 1,
    kinship: 1,
    _variableAuraBased: "Aurablade trait weight is differentiated per doctrine (Blood Hymn = fury, Stillheart = resolve, Void Edge = dread). See doctrine map.",
  },
};

const PHILOSOPHY_OVERRIDES = {
  // 13.75 → ~22.25
  "Liberal":           { independence: 1, speech: 2, mercy: 1, study: 1, compassion: 1 },
  // 17.00 → ~24
  "Libertarian":       { independence: 2, risk: 2, ambition: 1, study: 1 },
  // 19.00 → ~21.75
  "Social Democratic": { mercy: 2, compassion: 2, kinship: 1, speech: 1 },
  // 18.75 → ~23.25 (small boost)
  "Marxist/Communist": { kinship: 2, ambition: 1, speech: 1, sacrifice: 1, compassion: 1 },
  // 17.25 → ~20
  "Anarchist":         { independence: 2, risk: 1, ambition: 1, speech: 1 },
};

const changes = [];
const apply = (catName, dict, overrides) => {
  for (const [name, weights] of Object.entries(overrides)) {
    const before = dict[name];
    dict[name] = weights;
    changes.push([catName, name, before, weights]);
  }
};

apply("alignment",  spec.resolverWeights.alignment,  ALIGNMENT_OVERRIDES);
apply("occult",     spec.resolverWeights.occult,     OCCULT_OVERRIDES);
apply("path",       spec.resolverWeights.class,      PATH_OVERRIDES);
apply("philosophy", spec.resolverWeights.philosophy, PHILOSOPHY_OVERRIDES);

writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");

const fmt = (w) => Object.entries(w).filter(([t]) => !t.startsWith("_")).map(([t, v]) => `${t}:${v}`).join(", ");
console.log(`\n=== Pass 3 applied (${changes.length} weight-dict overrides) ===`);
for (const [cat, name, before, after] of changes) {
  console.log(`  [${cat.padEnd(10)}] ${name}`);
  console.log(`              before: ${fmt(before || {})}`);
  console.log(`              after:  ${fmt(after)}`);
}
console.log(`\nNext: node tools/sim-distribution.mjs 10000`);
