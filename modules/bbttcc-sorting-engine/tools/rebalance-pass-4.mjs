// Rebalance Pass 4 — fine-tuning after Pass 3 over-correction.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-pass-4";

if (!existsSync(BACKUP_PATH)) {
  copyFileSync(SPEC_PATH, BACKUP_PATH);
  console.log(`Backed up Pass-3 spec → ${BACKUP_PATH}`);
}

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

const ALIGNMENT_OVERRIDES = {
  "Chokhmah":  { chokhmah_signal: 1, study: 1 },                     // was signal:2 — too dominant
  "Gevurah":   { gevurah_signal: 1,  dread: 1 },                     // was severity:1 — runaway leader
  "Netzach":   { netzach_signal: 1,  kinship: 1, ambition: 1 },      // boost from 5.16%
  "Hod":       { hod_signal: 1,      study: 1 },                     // was ambition:1, didn't help
  "Yesod":     { yesod_signal: 1,    ritual: 1 },                    // add secondary so it doesn't crater
};

const OCCULT_OVERRIDES = {
  "Shaman":           { ritual: 2, kinship: 1, sorrow: 1, malkuth_signal: 1, faith: 1 }, // was over-nerfed at 2.19%
  "Exorcist/Purifier": { faith: 2, ritual: 2, gevurah_signal: 1, sacrifice: 1 },         // dropped severity:1 (was 38.81%)
};

const PHILOSOPHY_OVERRIDES = {
  "Libertarian": { independence: 2, risk: 2, ambition: 1 },                              // dropped study:1 (was 28%)
  "Liberal":     { speech: 2, mercy: 1, study: 1, compassion: 1, ambition: 1 },          // dropped independence:1 (overlap), added ambition
  "Anarchist":   { independence: 2, risk: 1, ambition: 1, speech: 1, sacrifice: 1 },     // small boost from 0.41%
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
console.log(`\n=== Pass 4 applied (${changes.length} overrides) ===`);
for (const [cat, name, before, after] of changes) {
  console.log(`  [${cat.padEnd(10)}] ${name}`);
  console.log(`              ${fmt(before || {})}`);
  console.log(`           →  ${fmt(after)}`);
}
console.log(`\nNext: node tools/sim-distribution.mjs 10000`);
