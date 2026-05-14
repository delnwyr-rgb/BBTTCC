// BBTTCC master-content / tools / stamp-loose-source-levels.mjs
//
// Stamps `system.prerequisites.level` on every loose JSON feature source under
// packs/classes/<class>/{class-features,path-of-*,route-of-*}/*.json based on
// the canonical filename pattern:
//
//   tier_1_*.json → level 1     (tier band start)
//   tier_2_*.json → level 6
//   tier_3_*.json → level 11
//   tier_4_*.json → level 16
//   l01_*.json    → level 1
//   l05_*.json    → level 5     (etc.)
//
// Run from repo root:  node modules/bbttcc-master-content/tools/stamp-loose-source-levels.mjs
// Add --dry to preview without writing.

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "packs", "classes");
const DRY = process.argv.includes("--dry");
const TIER_TO_LEVEL = { 1: 1, 2: 6, 3: 11, 4: 16 };

function levelFromFilename(name) {
  const tier = name.match(/^tier[_-]?([1-4])(?:[_-]|$|\.)/i);
  if (tier) return TIER_TO_LEVEL[parseInt(tier[1], 10)];
  const lvl = name.match(/^l[_-]?0*(\d{1,2})(?:[_-]|$|\.)/i);
  if (lvl) return parseInt(lvl[1], 10);
  return null;
}

async function* walkJson(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkJson(full);
    else if (entry.isFile() && entry.name.endsWith(".json")) yield full;
  }
}

const report = { scanned: 0, stamped: 0, alreadyStamped: 0, noSignal: 0, samples: [] };

try { await stat(ROOT); }
catch { console.error(`No loose-source root at ${ROOT}`); process.exit(1); }

for await (const file of walkJson(ROOT)) {
  let json;
  try { json = JSON.parse(await readFile(file, "utf8")); }
  catch (e) { console.warn(`skip ${file}: ${e.message}`); continue; }
  if (json.type !== "feat") continue;
  report.scanned++;

  const existing = Number(json.system?.prerequisites?.level);
  if (Number.isFinite(existing) && existing > 0) { report.alreadyStamped++; continue; }

  const level = levelFromFilename(basename(file));
  if (!level) {
    report.noSignal++;
    if (report.samples.length < 5) report.samples.push({ file: basename(file), decision: "no filename signal" });
    continue;
  }

  json.system = json.system ?? {};
  json.system.prerequisites = json.system.prerequisites ?? {};
  json.system.prerequisites.level = level;
  report.stamped++;
  if (report.samples.length < 5) report.samples.push({ file: basename(file), decision: `level ${level}` });

  if (!DRY) await writeFile(file, JSON.stringify(json, null, 2) + "\n", "utf8");
}

console.log(`[stamp-loose-source-levels] DRY=${DRY}`);
console.table(report.samples);
console.log({ scanned: report.scanned, stamped: report.stamped, alreadyStamped: report.alreadyStamped, noSignal: report.noSignal });
