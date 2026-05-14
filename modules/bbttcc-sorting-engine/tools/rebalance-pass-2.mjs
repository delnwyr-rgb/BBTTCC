// Rebalance Pass 2 — fix structural weight outliers in resolverWeights.
//
// After Pass 1 trait-coverage flattening, Menhirkin still leads ~61% because its
// ancestry weight dict has two weight-2 entries on heavily-tagged traits. Human
// has only 4 weight points total on mid-coverage traits. Bulwark dominates paths
// for the same reason. This pass adjusts those weight dictionaries directly.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-pass-2";

if (!existsSync(BACKUP_PATH)) {
  copyFileSync(SPEC_PATH, BACKUP_PATH);
  console.log(`Backed up Pass-1 spec → ${BACKUP_PATH}`);
}

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

const ANCESTRY_OVERRIDES = {
  "Menhirkin": { faith: 1, kinship: 1, discipline: 1, yesod_signal: 1, sacrifice: 1 },
  "Human":     { speech: 1, compassion: 1, kinship: 1, ambition: 1, independence: 1, study: 1 },
};

const PATH_OVERRIDES = {
  "Bulwark":         { discipline: 1, severity: 1, sacrifice: 2, gevurah_signal: 1, malkuth_signal: 1, hierarchy: 1 },
  "Harmony Marshal": { speech: 2, hierarchy: 1, mercy: 1, tiphareth_signal: 2, kinship: 1, ritual: 1 },
};

const changes = [];
for (const [name, weights] of Object.entries(ANCESTRY_OVERRIDES)) {
  const before = spec.resolverWeights.ancestry[name];
  spec.resolverWeights.ancestry[name] = weights;
  changes.push(["ancestry", name, before, weights]);
}
for (const [name, weights] of Object.entries(PATH_OVERRIDES)) {
  const before = spec.resolverWeights.class[name];
  spec.resolverWeights.class[name] = weights;
  changes.push(["path", name, before, weights]);
}

writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");

const fmt = (w) => Object.entries(w).map(([t, v]) => `${t}:${v}`).join(", ");
console.log(`\n=== Pass 2 applied (${changes.length} weight-dict overrides) ===`);
for (const [cat, name, before, after] of changes) {
  console.log(`  [${cat}] ${name}`);
  console.log(`         before: ${fmt(before)}`);
  console.log(`         after:  ${fmt(after)}`);
}
console.log(`\nNext: node tools/sim-distribution.mjs 10000`);
