// Rebalance Pass 1 — flatten the trait-coverage histogram.
//
// Problem: faith expected=9.00 (overweighted) → Menhirkin wins 85% of trials.
// Goal: faith→5.00, boost dread/mercy/violence/service so under-served ancestries compete.
//
// Approach: targeted tag swaps in answer.tags dictionaries. No answer text changes.
//
// Run:  node tools/rebalance-pass-1.mjs
// Restore:  cp data/bbttcc_sorting_engine_v2_full_spec.json.bak-pre-rebalance data/bbttcc_sorting_engine_v2_full_spec.json

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = resolve(__dirname, "../data/bbttcc_sorting_engine_v2_full_spec.json");
const BACKUP_PATH = SPEC_PATH + ".bak-pre-rebalance";

if (!existsSync(BACKUP_PATH)) {
  copyFileSync(SPEC_PATH, BACKUP_PATH);
  console.log(`Backed up original spec → ${BACKUP_PATH}`);
} else {
  console.log(`Backup already exists at ${BACKUP_PATH} — keeping it.`);
}

const spec = JSON.parse(readFileSync(SPEC_PATH, "utf8"));

// === Edit table: { questionId.answerKey: { remove: [...], add: { trait: weight } } } ===
// "remove" = traits whose weight to subtract by 1 (set to 0 → delete)
// "set"    = explicit overwrites (overrides existing)
const EDITS = {
  // Faith→other conversions (1-point swaps)
  "K2.A":  { remove: ["faith"], add: { violence: 1 } },
  "C1.B":  { remove: ["faith"], add: { service: 1 } },
  "C1.D":  { remove: ["faith"], add: { dread: 1 } },         // dread already 1 → becomes 2
  "Ch2.C": { remove: ["faith"], add: { severity: 1 } },
  "T2.A":  { remove: ["faith"], add: { compassion: 1 } },
  "T2.B":  { remove: ["faith"], add: { mercy: 1 } },
  "N1.C":  { remove: ["faith"], add: { service: 1 } },
  "N1.D":  { remove: ["faith"], add: { dread: 1 } },
  "N2.D":  { remove: ["faith"], add: { mercy: 1 } },
  "H1.A":  { remove: ["faith"], add: { ambition: 1 } },
  "H1.D":  { remove: ["faith"], add: { dread: 1 } },
  "H2.B":  { remove: ["faith"], add: { violence: 1 } },
  "H2.C":  { remove: ["faith"], add: { dread: 1 } },         // dread 1 → 2
  "H2.D":  { remove: ["faith"], add: { mercy: 1 } },
  "Y1.A":  { remove: ["faith"], add: { mercy: 1 } },
  "Y2.A":  { remove: ["faith"], add: { compassion: 1 } },

  // Standalone boosts to under-served traits (no removals)
  "C2.A":  { add: { dread: 1 } },                            // stealth/independence answer — adds dread flavor
  "B2.B":  { add: { dread: 1 } },                            // dread 1 → 2 (already dread-coded)
  "B1.D":  { add: { violence: 1 } },                         // already risk/dread — slight violence
  "M1.A":  { add: { violence: 1 } },                         // violence already 1 → 2
};

let totalRemoved = 0, totalAdded = 0;
const editsApplied = [];

for (const station of spec.stations) {
  for (const q of station.questions) {
    for (const a of q.answers) {
      const key = `${q.id}.${a.key}`;
      const edit = EDITS[key];
      if (!edit) continue;

      a.tags = a.tags || {};
      const before = { ...a.tags };

      if (edit.remove) {
        for (const t of edit.remove) {
          if (a.tags[t] > 0) {
            a.tags[t] -= 1;
            totalRemoved += 1;
            if (a.tags[t] <= 0) delete a.tags[t];
          }
        }
      }
      if (edit.add) {
        for (const [t, w] of Object.entries(edit.add)) {
          a.tags[t] = (a.tags[t] || 0) + w;
          totalAdded += w;
        }
      }
      editsApplied.push({ key, before, after: { ...a.tags } });
    }
  }
}

writeFileSync(SPEC_PATH, JSON.stringify(spec, null, 2) + "\n");

console.log(`\n=== Rebalance Pass 1 applied ===`);
console.log(`edits: ${editsApplied.length}    removed weight pts: ${totalRemoved}    added weight pts: ${totalAdded}`);
for (const e of editsApplied) {
  const beforeStr = Object.entries(e.before).map(([k, v]) => `${k}:${v}`).join(",");
  const afterStr = Object.entries(e.after).map(([k, v]) => `${k}:${v}`).join(",");
  console.log(`  ${e.key.padEnd(7)} ${beforeStr.padEnd(50)} → ${afterStr}`);
}
console.log(`\nSpec written. Run: node tools/sim-distribution.mjs 10000`);
