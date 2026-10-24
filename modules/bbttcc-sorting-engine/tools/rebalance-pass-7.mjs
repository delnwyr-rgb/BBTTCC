// Rebalance Pass 7 (2026-10-23) — z-scored resolution + trait lean.
//
// Audit (tools/analyze-reachability.mjs): raw scores let well-fed options win for everyone (The World 27%,
// Bulwark + Shadow Courier 26% each), left Wheel of Fortune and Rosicrucian unwinnable, Netzach at 0%,
// and the pillar readout said "Balanced" for 100% of players (station position alone → mercy 6 / severity 6).
//
// 1. scoring.normalize = "z": every option is scored against its own average and spread (engine, 2026-10-23).
//    Designed weights stay as authored.
// 2. pillarReadout.traitLean: answers lean by their tags; the readout tilts at ±tiltZ standard deviations.
// 3. Path touch-ups after z (PATH_OVERRIDES below).
//
// Crew + Occult are NOT tuned: the Alpha cut took both rows out of the player build (ruling 1, 2026-10-17).

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-pass-7";
if (!existsSync(BACKUP_PATH)) copyFileSync(SPEC_PATH, BACKUP_PATH);

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

spec.version = "2.1.0-zscore-2026-10-23";
spec.scoring = {
  _comment: "Pass 7 (2026-10-23). 'z' = each option scored as (raw − mean) / sd under uniform answering (engine _optionStats). Remove this block to restore raw scoring.",
  normalize: "z"
};
spec.pillarReadout.traitLean = {
  _comment: "Pass 7 (2026-10-23). Untagged answers lean by (mercyTraits − severityTraits); readout = that total vs an average descent, in sd. ±tiltZ ≈ a quarter of descents each way.",
  mercyTraits: ["compassion", "mercy", "kinship"],
  severityTraits: ["severity", "discipline", "dread"],
  tiltZ: 0.67
};

// After z, the study / faith / hod cluster (Cosmic Linguist ≈ Dreamwalker ≈ Wyrdlens) split its wins three ways
// while the distinct Bulwark + Shadow Courier took ~18% each. Each twin gets its own voice:
const PATH_OVERRIDES = {
  // 4.9% → ~8%: the Linguist edits reality like text — speech joins study (was faith:1 + hod:2)
  "Cosmic Linguist": { study: 2, speech: 2, ritual: 1, hod_signal: 1, binah_signal: 1 },
  // 7.7% → ~13%: dreams are memory — sorrow:2 in, study 2→1, hod 2→1 (was study:2, stealth:1, faith:1, hod:2)
  "Dreamwalker":     { study: 1, stealth: 1, faith: 1, sorrow: 2, hod_signal: 1 },
  // 17.8% → ~15%: drop malkuth_signal (two Malkuth questions hand it to everyone)
  "Bulwark":         { discipline: 1, severity: 1, sacrifice: 2, gevurah_signal: 1, hierarchy: 1 }
};

const changes = [];
for (const [name, weights] of Object.entries(PATH_OVERRIDES)) {
  changes.push([name, spec.resolverWeights.class[name], weights]);
  spec.resolverWeights.class[name] = weights;
}

writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");
const fmt = (w) => Object.entries(w || {}).filter(([t]) => !t.startsWith("_")).map(([t, v]) => `${t}:${v}`).join(", ");
console.log(`Pass 7: version ${spec.version}, scoring.normalize=z, traitLean tiltZ ${spec.pillarReadout.traitLean.tiltZ}, ${changes.length} path changes`);
for (const [name, before, after] of changes) console.log(`  [path] ${name}\n    ${fmt(before)}\n  → ${fmt(after)}`);
