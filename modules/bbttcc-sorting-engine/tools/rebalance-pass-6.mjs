// Rebalance Pass 6 — small convergence after Pass 5 oscillations.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-pass-6";

if (!existsSync(BACKUP_PATH)) copyFileSync(SPEC_PATH, BACKUP_PATH);

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

const ALIGNMENT_OVERRIDES = {
  "Gevurah":  { gevurah_signal: 1, dread: 1, severity: 1 },             // 29.33% → drop signal:2 back to 1
  "Yesod":    { yesod_signal: 1, ritual: 1 },                           // 0.19% → restore ritual:1
  "Malkuth":  { malkuth_signal: 1, ambition: 1 },                       // 1.89% → add ambition booster
  "Chokhmah": { chokhmah_signal: 2, study: 1, ambition: 1, mercy: 1 },  // 5.18% → slight more boost
};

const PHILOSOPHY_OVERRIDES = {
  // 32.56% → ~14%; revert compassion to 1 (was 2)
  "Liberal":           { independence: 1, speech: 2, mercy: 1, study: 1, compassion: 1 },
  // 3.25% → ~14%; add sacrifice:1
  "Social Democratic": { mercy: 2, compassion: 2, kinship: 1, speech: 1, sacrifice: 1 },
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
apply("philosophy", spec.resolverWeights.philosophy, PHILOSOPHY_OVERRIDES);

writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");

const fmt = (w) => Object.entries(w).filter(([t]) => !t.startsWith("_")).map(([t, v]) => `${t}:${v}`).join(", ");
console.log(`Pass 6 (${changes.length} changes):`);
for (const [cat, name, before, after] of changes) {
  console.log(`  [${cat}] ${name}`);
  console.log(`    ${fmt(before || {})}`);
  console.log(`  → ${fmt(after)}`);
}
