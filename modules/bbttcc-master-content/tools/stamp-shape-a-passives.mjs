#!/usr/bin/env node
// Chunk 2 — bulk-stamp Shape A pure passives as Active Effects
// ─────────────────────────────────────────────────────────────────────────────
// Reads a curated batch (the first sweep — only items with unambiguous flat
// skill/attribute bonuses authored in their description). Skips:
//   - items in packs/subclasses/ (orphan layout — subclasses live in classes pack)
//   - OP cap deltas (already wired via flags.bbttcc.opEffects.capDelta)
//   - hybrid items where the Shape-A part needs human disambiguation
//
// Run: node stamp-shape-a-passives.mjs           (dry-run, prints diff)
//      node stamp-shape-a-passives.mjs --apply   (writes effects[] to JSONs)
//
// After --apply you still need to run the in-Foundry compile macro for the
// affected pack to push the JSON sources into the live LevelDB.

import fs from "node:fs";
import crypto from "node:crypto";

const APPLY = process.argv.includes("--apply");

const ROOT = "/Users/gamingaccount/bbttcc-master-content/packs";

// 16-char alphanumeric _id (Foundry doc id format)
function newId() {
  return crypto.randomBytes(8).toString("hex");
}

// Build a canonical V14 transferred Active Effect with one change.
function buildAE({ name, key, value, img }) {
  return {
    _id: newId(),
    name,
    img: img ?? "icons/skills/melee/shield-block-bash-yellow.webp",
    type: "base",
    system: {},
    changes: [
      { key, value, type: "add", priority: 10 }
    ],
    disabled: false,
    duration: { startTime: 0, seconds: null, combat: null, rounds: null, turns: null, startRound: 0, startTurn: 0 },
    description: `Passive: ${name}`,
    origin: null,
    tint: "#ffffff",
    transfer: true,
    statuses: [],
    sort: 0,
    flags: { fourththing: { passiveAuthored: true, sprint: "passive-ae-2026-04-28" } },
    _stats: {
      compendiumSource: null, duplicateSource: null, exportSource: null,
      coreVersion: "14.360", systemId: "fourththing", systemVersion: "0.6.0",
      lastModifiedBy: null
    }
  };
}

// Curated batch. Each entry: file → array of AEs to stamp.
const BATCH = [
  {
    file: `${ROOT}/classes/bulwark/class-features/tier_1_founding_stance.json`,
    aes: [
      buildAE({ name: "Founding Stance: Athletics +1", key: "system.skills.athletics.value", value: 1 })
    ]
  },
  {
    file: `${ROOT}/classes/shadow_courier/class-features/tier_1_liminal_operator.json`,
    aes: [
      buildAE({ name: "Liminal Operator: Stealth +1",   key: "system.skills.stealth.value",   value: 1, img: "icons/skills/movement/feet-winged-boots.webp" }),
      buildAE({ name: "Liminal Operator: Tinkering +1", key: "system.skills.tinkering.value", value: 1, img: "icons/tools/smithing/anvil.webp" })
    ]
  },
  {
    file: `${ROOT}/ancestries/cryptidkin_furrykin_tier1.json`,
    aes: [
      buildAE({ name: "Wildframe & Instinct: Athletics +1", key: "system.skills.athletics.value", value: 1, img: "icons/creatures/abilities/paw-print-orange.webp" })
    ]
  }
];

console.log(`\n=== Chunk 2 dry-run (${BATCH.length} items, ${BATCH.reduce((a,b)=>a+b.aes.length,0)} AEs) ===`);
console.log(`Mode: ${APPLY ? "APPLY (will write to disk)" : "DRY-RUN (no changes)"}\n`);

let totalAEs = 0;
for (const entry of BATCH) {
  if (!fs.existsSync(entry.file)) {
    console.log(`✗ MISSING: ${entry.file}`);
    continue;
  }
  const doc = JSON.parse(fs.readFileSync(entry.file, "utf8"));
  const existingEffects = Array.isArray(doc.effects) ? doc.effects : [];

  console.log(`• ${doc.name}`);
  console.log(`  file:   ${entry.file.replace(ROOT,"<packs>")}`);
  console.log(`  before: ${existingEffects.length} effect(s)`);

  // Don't double-stamp — skip if any of our authored AEs already exist by name.
  const existingNames = new Set(existingEffects.map(e => e.name));
  const toAdd = entry.aes.filter(a => !existingNames.has(a.name));
  if (toAdd.length === 0) {
    console.log(`  → already stamped, skipping\n`);
    continue;
  }

  for (const ae of toAdd) {
    const ch = ae.changes[0];
    console.log(`  + ${ae.name}  →  ${ch.key} type=${ch.type} value=${ch.value}`);
  }

  if (APPLY) {
    doc.effects = [...existingEffects, ...toAdd];
    fs.writeFileSync(entry.file, JSON.stringify(doc, null, 2) + "\n", "utf8");
    console.log(`  ✓ wrote ${toAdd.length} AE(s) to JSON\n`);
  } else {
    console.log(`  (dry-run — would write ${toAdd.length} AE(s))\n`);
  }
  totalAEs += toAdd.length;
}

console.log(`=== ${APPLY ? "APPLIED" : "DRY-RUN COMPLETE"} — ${totalAEs} AEs ${APPLY ? "written" : "would be written"} ===\n`);
if (APPLY) {
  console.log("NEXT STEPS:");
  console.log("1. Inside Foundry, run a compile macro that re-imports the affected pack JSONs.");
  console.log("   Affected packs:");
  console.log("     - bbttcc-master-content.classes  (Bulwark + Shadow Courier features)");
  console.log("     - bbttcc-master-content.ancestries  (Cryptidkin Furrykin tier1)");
  console.log("2. Verify on a test character — sheet AE column should show the +1 entry.");
} else {
  console.log("To apply:  node stamp-shape-a-passives.mjs --apply");
}
