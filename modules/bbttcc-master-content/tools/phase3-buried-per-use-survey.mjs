// Phase 3 buried-per-use survey
// Walks all JSON files in bbttcc-master-content/packs/, classifies items as
// surfaced/unsurfaced/passive/non-per-use, and reports the un-surfaced per-use ones.
//
// Run: node /tmp/phase3-survey.mjs

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const PACKS_ROOT = "/Users/gamingaccount/Library/Application Support/FoundryVTT/Data/modules/bbttcc-master-content/packs";
const SYSTEM_AUTOMATION = "/Users/gamingaccount/Library/Application Support/FoundryVTT/Data/systems/fourththing/ft-class-automation.js";

// Read CHAR_OPT_ABILITIES table to identify already-wired identifiers
const automationSrc = fs.readFileSync(SYSTEM_AUTOMATION, "utf8");
// Cheap heuristic: find every quoted identifier that appears as a property key
// inside an object literal in the file. Captures both single-line keys and
// multi-line. Conservative — false positives are OK (means we skip Phase 3
// work for an item already touched).
const charOptIds = new Set();
const idRe = /"([a-z][a-z0-9_-]+)"\s*:/g;
let m;
while ((m = idRe.exec(automationSrc)) !== null) charOptIds.add(m[1]);

// Per-use detector. Multiple variants — the RFI sweep already converted some
// to "Soma Break"; older content still uses "long rest"/"short rest".
const PER_USE_PATTERNS = [
  /\b\d+\s*\/\s*(?:a\s+)?(?:short|long)\s+rest\b/i,
  /\b\d+\s*\/\s*(?:a\s+)?Soma\s+Break\b/i,
  /\bPB\s*\/\s*(?:a\s+)?(?:long|short)\s+rest\b/i,
  /\btier\s*\/\s*(?:a\s+)?Soma\s+Break\b/i,
  /\btier\s*\/\s*(?:a\s+)?(?:long|short)\s+rest\b/i,
  /\bonce per (?:short|long) rest\b/i,
  /\bonce per Soma Break\b/i,
  /\bonce per scene\b/i,
  /\b\d+\s*\/\s*scene\b/i,
  /\b\d+\s+times\s+per\s+(?:long|short)\s+rest\b/i,
  /\b\d+\s+times\s+per\s+Soma\s+Break\b/i,
];

// "once per minute"/"once per turn"/"once per round" are durations, not recovery
// windows. Explicitly exclude.
const DURATION_FALSE_POSITIVES = /\bonce per (minute|turn|round|day|hour|action)\b/i;

const results = [];
const skipReasons = { surfaced: 0, alreadyWired: 0, badType: 0, noPerUse: 0 };

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/items\.bak|backup|\.backup|documentation|\.archive/i.test(entry.name)) continue;
      walk(full);
      continue;
    }
    if (!entry.name.endsWith(".json")) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(full, "utf8")); } catch { continue; }
    if (!doc?.system) continue;
    const desc = doc.system.description?.value ?? "";
    const id = doc.system.identifier ?? "(unset)";
    const type = doc.type;
    const name = doc.name ?? "(unnamed)";

    // Type filter: skip dnd5e zombies (Phase 6 work)
    if (["equipment", "consumable", "loot", "spell"].includes(type)) {
      skipReasons.badType++;
      continue;
    }

    // Per-use detection
    const matched = PER_USE_PATTERNS.find((p) => p.test(desc));
    if (!matched) { skipReasons.noPerUse++; continue; }

    // Already surfaced via marker?
    if (desc.includes('data-ft-per-use')) { skipReasons.surfaced++; continue; }

    // Already wired in CHAR_OPT_ABILITIES?
    if (charOptIds.has(id)) { skipReasons.alreadyWired++; continue; }

    // Extract the matched per-use phrase for reporting
    const m2 = desc.match(matched);
    const window = m2 ? m2[0] : "(detected)";

    results.push({
      relPath: path.relative(PACKS_ROOT, full),
      name,
      identifier: id,
      type,
      window,
      descPreview: desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
    });
  }
};

walk(PACKS_ROOT);

// Deduplicate: identifier first, then collapse same-name (since some items
// have e.g. "sephirotic_scion_seraphic_tier1" + "sephirotic_scion-seraphic-cleansing_breath"
// for the same feat).
const seen = new Map();
const sameNameWinner = (a, b) => {
  // Prefer paths under ancestry_feats/ (post-04-19 normalized location); then
  // prefer ancestries/ tier1; then root.
  const score = (r) =>
    r.relPath.includes("ancestry_feats/") ? 3 :
    r.relPath.includes("ancestries/") ? 2 : 1;
  return score(b) > score(a) ? b : a;
};
for (const r of results) {
  const idKey = r.identifier !== "(unset)" ? r.identifier : null;
  if (idKey && !seen.has(idKey)) seen.set(idKey, r);
  else if (idKey) seen.set(idKey, sameNameWinner(seen.get(idKey), r));
}
// Second pass: collapse by name (different identifier shapes for same item)
const byName = new Map();
for (const r of seen.values()) {
  if (!byName.has(r.name)) byName.set(r.name, r);
  else byName.set(r.name, sameNameWinner(byName.get(r.name), r));
}

const unique = [...byName.values()].sort((a,b) => a.name.localeCompare(b.name));

console.log(`\n=== Phase 3 buried per-use survey ===`);
console.log(`Total JSONs scanned: scope = ${PACKS_ROOT}`);
console.log(`Skip reasons: surfaced=${skipReasons.surfaced}, already-wired=${skipReasons.alreadyWired}, bad-type=${skipReasons.badType}, no-per-use=${skipReasons.noPerUse}`);
console.log(`Raw matches: ${results.length}, unique by identifier: ${unique.length}\n`);

console.log(`| # | name | identifier | type | window | path |`);
console.log(`|---|---|---|---|---|---|`);
unique.forEach((r, i) => {
  console.log(`| ${i+1} | ${r.name} | ${r.identifier} | ${r.type} | ${r.window} | ${r.relPath} |`);
});

console.log(`\n=== Description previews ===\n`);
unique.forEach((r, i) => {
  console.log(`[${i+1}] ${r.name}`);
  console.log(`    ${r.descPreview}\n`);
});
