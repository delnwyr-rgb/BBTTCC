// Rebalance Pass 5 — final calibration. Account for variance asymmetry:
// signals that only fire in their root station (keter, chokhmah) have very low
// variance, so they need higher expected scores to win sometimes.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-pass-5";

if (!existsSync(BACKUP_PATH)) {
  copyFileSync(SPEC_PATH, BACKUP_PATH);
  console.log(`Backed up Pass-4 spec → ${BACKUP_PATH}`);
}

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

// Variance-aware: low-variance signals need triple booster traits to compete.
const ALIGNMENT_OVERRIDES = {
  "Keter":     { keter_signal: 2,     ambition: 1, speech: 1, sacrifice: 1 }, // 0.88% → ~12%
  "Chokhmah":  { chokhmah_signal: 2,  study: 1, ambition: 1 },                // missing → ~10%
  "Binah":     { binah_signal: 1,     sorrow: 1, study: 1 },                  // boost from 6.69%
  "Chesed":    { chesed_signal: 1,    compassion: 1, mercy: 1 },              // boost slightly
  "Gevurah":   { gevurah_signal: 2,   dread: 1 },                             // signal:2 for variance, dread for thematic boost (was severity over-correcting)
  "Tiphareth": { tiphareth_signal: 1, ritual: 1, kinship: 1 },                // boost from 10.81%
  "Netzach":   { netzach_signal: 1,   kinship: 1 },                           // 25.94% → drop ambition
  "Hod":       { hod_signal: 1,       study: 1, ritual: 1 },                  // boost from 6.95%
  "Yesod":     { yesod_signal: 1 },                                           // 22.72% → drop ritual:1
  "Malkuth":   { malkuth_signal: 1 },                                         // unchanged
};

const OCCULT_OVERRIDES = {
  // 6.72% → ~15%; restore severity but at weight 1 instead of 1
  "Exorcist/Purifier": { faith: 2, ritual: 2, severity: 1, gevurah_signal: 1 },
};

const PHILOSOPHY_OVERRIDES = {
  // 2.66% → ~14%. Re-add independence:1 + boost compassion:2.
  "Liberal":     { independence: 1, speech: 2, mercy: 1, study: 1, compassion: 2 },
};

const changes = [];
const apply = (cat, dict, overrides) => {
  for (const [name, weights] of Object.entries(overrides)) {
    const before = dict[name];
    dict[name] = weights;
    changes.push([cat, name, before, weights]);
  }
};

apply("alignment",  spec.resolverWeights.alignment,  ALIGNMENT_OVERRIDES);
apply("occult",     spec.resolverWeights.occult,     OCCULT_OVERRIDES);
apply("philosophy", spec.resolverWeights.philosophy, PHILOSOPHY_OVERRIDES);

writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");

const fmt = (w) => Object.entries(w).filter(([t]) => !t.startsWith("_")).map(([t, v]) => `${t}:${v}`).join(", ");
console.log(`\n=== Pass 5 applied (${changes.length} overrides) ===`);
for (const [cat, name, before, after] of changes) {
  console.log(`  [${cat.padEnd(10)}] ${name}: ${fmt(before || {})}`);
  console.log(`              → ${fmt(after)}`);
}
console.log(`\nNext: node tools/sim-distribution.mjs 10000`);
