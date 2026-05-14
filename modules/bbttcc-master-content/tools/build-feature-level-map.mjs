// BBTTCC master-content / tools / build-feature-level-map.mjs
//
// Walks the canonical JSON sources on disk (Classes/* and Subclasses/*) and
// produces a flat NAME → LEVEL map covering every feat. Three signal sources,
// in order of authority:
//
//   1. Class doc's `system.advancement` array → ItemGrant entries map each
//      feature UUID to a level. We resolve UUIDs by scanning the same folder
//      for a feat JSON whose `_id` matches.
//   2. Filename patterns: "(Level N)", "Level N —", "(Tier N – Level M)".
//   3. Filename "(Tier N)" → first level of that tier band (1, 6, 11, 16).
//
// Output: data/feature-level-map.json — consumed by
// tools/stamp-from-feature-level-map.macro.js inside Foundry.
//
// Run from repo root or anywhere — pass --src=<path> to override the default
// source root (~/Desktop/Desktop - Mac mini/Shattered Lens Studios/BBTTCC4TAssets/
// BBTTCC Character Options JSONS).

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT  = join(HERE, "..", "data", "feature-level-map.json");

const argSrc = process.argv.find(a => a.startsWith("--src="));
const SRC = argSrc
  ? argSrc.slice("--src=".length)
  : join(homedir(), "Desktop", "Desktop - Mac mini", "Shattered Lens Studios",
         "BBTTCC4TAssets", "BBTTCC Character Options JSONS");

const TIER_TO_LEVEL = { 1: 1, 2: 6, 3: 11, 4: 16 };

function levelFromFilename(name) {
  // (Tier N – Level M)  or  (Tier N - Level M)
  let m = name.match(/\(\s*Tier\s*([1-4])\s*[–-]\s*Level\s*(\d{1,2})\s*\)/i);
  if (m) return parseInt(m[2], 10);
  // (Level N) or (Level N – something)
  m = name.match(/\(\s*Level\s*(\d{1,2})/i);
  if (m) return parseInt(m[1], 10);
  // "Level N —" or "Level N -" prefix
  m = name.match(/^Level\s*(\d{1,2})\s*[—\-]/i);
  if (m) return parseInt(m[1], 10);
  // "(Tier N)" → first level of band
  m = name.match(/\(\s*Tier\s*([1-4])\s*(?:Feature)?\s*\)/i);
  if (m) return TIER_TO_LEVEL[parseInt(m[1], 10)];
  // "Tier N —" prefix
  m = name.match(/^.*?\bTier\s*([1-4])\s*[—\-]/i);
  if (m) return TIER_TO_LEVEL[parseInt(m[1], 10)];
  return null;
}

async function readJsonSafe(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return null; }
}

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && e.name.endsWith(".json")) yield full;
  }
}

async function processFolder(folderPath, kind, label) {
  // First pass: index every JSON in this folder (and descendants) by _id so
  // we can resolve advancement UUIDs.
  const files = [];
  for await (const f of walk(folderPath)) files.push(f);

  const docsById = new Map();   // _id → { name, type, file }
  const docsByFile = new Map(); // file → doc json
  for (const f of files) {
    const j = await readJsonSafe(f);
    if (!j) continue;
    docsByFile.set(f, j);
    if (j._id) docsById.set(j._id, { name: j.name, type: j.type, file: f, doc: j });
  }

  // Find the class/subclass parent doc (type "class" or "subclass") for advancement
  const parents = [...docsByFile.entries()].filter(([_, j]) => j.type === "class" || j.type === "subclass");

  const nameToLevel = {};
  let stats = { fromAdvancement: 0, fromFilename: 0, unresolved: 0, samples: [] };

  // 1. Pull from each parent's advancement
  for (const [pFile, pDoc] of parents) {
    const adv = pDoc.system?.advancement;
    const advList = Array.isArray(adv) ? adv : (adv && typeof adv === "object" ? Object.values(adv) : []);
    for (const a of advList) {
      if (a?.type !== "ItemGrant") continue;
      const lvl = Number(a.level);
      if (!Number.isFinite(lvl)) continue;
      const items = a.configuration?.items ?? a.config?.items ?? [];
      for (const it of items) {
        const uuid = String(it?.uuid ?? "");
        const docId = uuid.split(".").pop(); // last segment is the doc _id
        const hit = docsById.get(docId);
        if (hit?.name) {
          if (!nameToLevel[hit.name]) {
            nameToLevel[hit.name] = lvl;
            stats.fromAdvancement++;
          }
        }
      }
    }
  }

  // 2. Pull from every feat file's filename if not already mapped
  for (const [file, j] of docsByFile) {
    if (j.type !== "feat") continue;
    if (nameToLevel[j.name]) continue;
    const lvl = levelFromFilename(basename(file));
    if (lvl !== null) {
      nameToLevel[j.name] = lvl;
      stats.fromFilename++;
    } else {
      stats.unresolved++;
      if (stats.samples.length < 5) stats.samples.push({ file: basename(file), name: j.name });
    }
  }

  return { kind, label, parents: parents.map(([_, p]) => p.name), levels: nameToLevel, stats };
}

const out = {
  generatedAt: new Date().toISOString(),
  source: SRC,
  paths: {},
  doctrines: {},
  globalLevels: {} // flat name→level for fast lookup at stamp time
};

const classesRoot = join(SRC, "Classes");
for (const entry of await readdir(classesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const r = await processFolder(join(classesRoot, entry.name), "class", entry.name);
  out.paths[entry.name] = r;
  for (const [n, l] of Object.entries(r.levels)) {
    if (!out.globalLevels[n]) out.globalLevels[n] = l;
  }
}

const subclassesRoot = join(SRC, "Subclasses");
try {
  await stat(subclassesRoot);
  for (const entry of await readdir(subclassesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Each "<Path> Subclasses" folder has per-doctrine subfolders.
    const pathSubDir = join(subclassesRoot, entry.name);
    for (const sub of await readdir(pathSubDir, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      const r = await processFolder(join(pathSubDir, sub.name), "doctrine", sub.name);
      out.doctrines[sub.name] = r;
      for (const [n, l] of Object.entries(r.levels)) {
        if (!out.globalLevels[n]) out.globalLevels[n] = l;
      }
    }
  }
} catch { /* no subclasses dir */ }

await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(`[build-feature-level-map] wrote ${OUT}`);
console.log(`paths=${Object.keys(out.paths).length}  doctrines=${Object.keys(out.doctrines).length}  globalNames=${Object.keys(out.globalLevels).length}`);
for (const [pName, p] of Object.entries(out.paths)) {
  console.log(`  ${pName.padEnd(30)} adv=${p.stats.fromAdvancement} filename=${p.stats.fromFilename} unresolved=${p.stats.unresolved}`);
}
for (const [dName, d] of Object.entries(out.doctrines)) {
  console.log(`  ${("(d) " + dName).padEnd(34)} adv=${d.stats.fromAdvancement} filename=${d.stats.fromFilename} unresolved=${d.stats.unresolved}`);
}
