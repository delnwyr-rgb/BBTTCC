// BBTTCC — Compile Loose JSONs Into Compendium Packs (folder-aware, multi-pack)
// ─────────────────────────────────────────────────────────────────────────────
// Run this as a GM script macro. It walks loose JSON drafts under
// modules/bbttcc-master-content/packs/{heritages,ancestries,classes/...}/
// and imports each file into its target compendium, keyed by _id.
//
// Two pack targets are wired:
//   • bbttcc-master-content.ancestries  ← heritages + ancestry/tier feats + cores
//   • bbttcc-master-content.classes     ← class features + subclass features
//
// Folder placement matches the existing Cryptidkin layout for ancestries:
//   {Family}/{Lineage} (Heritage)/Ancestry Features/  ← tier feats
// and a parallel layout for classes:
//   {ClassName}/Class Features/                       ← per-tier class feats
//   {ClassName}/{SubclassName}/                       ← per-level doctrine feats
//
// Folders are auto-created if missing; matched case/space/dash-insensitively
// to avoid duplicating existing "Echo Diver" vs "Echo-Diver" type folders.
//
// Set UPDATE_EXISTING = true at the top to overwrite existing docs in-place.
// ─────────────────────────────────────────────────────────────────────────────

const UPDATE_EXISTING = false;            // flip to true to force overwrite
const DRY_RUN          = false;           // true = preview only, no writes

// ─── Family display names (ancestries job) ───────────────────────────────────
const FAMILY_DISPLAY = {
  menhirkin:        "Menhirkin",
  echo_diver:       "Echo-Diver",
  qliph_scarred:    "Qliph-Scarred",
  sephirotic_scion: "Sephirotic Scion",
  human:            "Human",
  oldenborn:        "Oldenborn",
  cryptidkin:       "Cryptidkin",
  circuitborn:      "Circuitborn"
};

// ─── Class display names (classes job) ───────────────────────────────────────
// Maps class identifier (system.identifier on the class item) to the folder
// label we want under bbttcc-master-content.classes.
const CLASS_DISPLAY = {
  bulwark:          "Bulwark",
  shadow_courier:   "Shadow Courier",
  aurablade:        "Aurablade",
  cosmic_linguist:  "Cosmic Linguist",
  dreamwalker:      "Dreamwalker",
  harmonymarshal:   "Harmony Marshal",
  pactkeeper:       "Pactkeeper",
  "soul-smith":     "Soul Smith",
  "wyrdlens-adept": "Wyrdlens Adept"
};

// Subclass identifier → folder label override. Anything not listed here gets
// title-cased from its identifier with hyphens turned into spaces.
const SUBCLASS_DISPLAY = {
  "bbttcc-bulwark-avalanche":               "Path of the Avalanche",
  "bbttcc-bulwark-mountain":                "Path of the Mountain",
  "bbttcc-bulwark-cataclyst":               "Path of the Cataclyst",
  "bbttcc-shadow-courier-courier-wayfarer-tongue": "Route of the Wayfarer Tongue",
  "bbttcc-shadow-courier-courier-black-stair":     "Route of the Black Stair",
  "bbttcc-shadow-courier-courier-last-mile":       "Route of the Last Mile"
};

// Files/folders to skip during the directory walk.
const SKIP_BASENAMES = new Set([
  ".DS_Store", "PHASE2_NOTES.md", "CHANGELOG_Heritages_v1.1.md"
]);

// ─── Job definitions ─────────────────────────────────────────────────────────
const JOBS = [
  { sourceDir:  "modules/bbttcc-master-content/packs/heritages",
    targetPack: "bbttcc-master-content.ancestries",
    recursive:  false,
    classify:   classifyAncestriesDoc,
    folderFor:  folderForAncestriesDoc },
  { sourceDir:  "modules/bbttcc-master-content/packs/ancestries",
    targetPack: "bbttcc-master-content.ancestries",
    recursive:  false,
    classify:   classifyAncestriesDoc,
    folderFor:  folderForAncestriesDoc },
  { sourceDir:  "modules/bbttcc-master-content/packs/classes",
    targetPack: "bbttcc-master-content.classes",
    recursive:  true,                         // walks subdirectories
    classify:   classifyClassesDoc,
    folderFor:  folderForClassesDoc }
];

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

// ─── Folder helpers (parameterised over pack) ────────────────────────────────
const _normalize = s => String(s ?? "").toLowerCase().replace(/[-_\s()]+/g, "");
const foldersCreated = [];

async function getOrCreateFolder(pack, name, parentId /* Foundry FolderID or null */) {
  const target = _normalize(name);
  const existing = pack.folders.find(f =>
    _normalize(f.name) === target &&
    (f.folder?.id ?? null) === (parentId ?? null)
  );
  if (existing) return existing.id;
  if (DRY_RUN) {
    foldersCreated.push(`[dry] (${pack.collection}) ${parentId ? "↳" : "•"} ${name}`);
    return "dry-run";
  }
  const created = await Folder.create({
    name,
    type: pack.documentName,  // "Item"
    folder: parentId ?? null
  }, { pack: pack.collection });
  foldersCreated.push(`(${pack.collection}) ${parentId ? "↳" : "•"} ${name}`);
  return created.id;
}

// ─── Ancestries classifier (unchanged from original macro) ───────────────────
function classifyAncestriesDoc(data) {
  const bb = data.flags?.bbttcc ?? {};
  const kind = String(bb.kind ?? "").toLowerCase();
  const fam = String(bb.family ?? "").toLowerCase();
  const lineage = bb.lineage ?? "";
  const identifier = String(data.system?.identifier ?? "").toLowerCase();
  const tierLevel = Number(bb.tierLevel ?? 0);

  if (kind === "heritage" || identifier.endsWith("_heritage")) {
    return { type: "heritage", family: fam, lineage };
  }
  if (kind === "ancestrycore") {
    return { type: "core", family: fam };
  }
  if (tierLevel >= 1 || /_tier\d+$/.test(identifier) || /_tier\d+_/.test(identifier)) {
    const derivedFam = fam || (kind in FAMILY_DISPLAY ? kind : "");
    return { type: "tier", family: derivedFam, lineage };
  }
  return { type: "other" };
}

async function folderForAncestriesDoc(pack, data) {
  const c = classifyAncestriesDoc(data);
  if (!c.family) return null;
  const familyName = FAMILY_DISPLAY[c.family] || c.family.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
  const ancestryId = await getOrCreateFolder(pack, familyName, null);
  if (c.type === "core")     return ancestryId;
  if (c.type === "heritage") return await getOrCreateFolder(pack, `${c.lineage} (Heritage)`, ancestryId);
  if (c.type === "tier") {
    const heritId = await getOrCreateFolder(pack, `${c.lineage} (Heritage)`, ancestryId);
    return await getOrCreateFolder(pack, "Ancestry Features", heritId);
  }
  return null;
}

// ─── Classes classifier ──────────────────────────────────────────────────────
function classifyClassesDoc(data) {
  const bb = data.flags?.bbttcc ?? {};
  const kind = String(bb.kind ?? "").toLowerCase();
  const classId = String(bb.classIdentifier ?? "").toLowerCase();
  const subId = String(bb.subclassIdentifier ?? "").toLowerCase();
  if (kind === "classfeat") return { type: "classfeat", classId };
  if (kind === "subclassfeat") return { type: "subclassfeat", classId, subId };
  return { type: "other" };
}

function _subclassDisplayName(subId) {
  if (SUBCLASS_DISPLAY[subId]) return SUBCLASS_DISPLAY[subId];
  // Fallback: title-case the identifier with separators turned into spaces.
  return subId
    .replace(/^bbttcc[-_]/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, m => m.toUpperCase())
    .trim();
}

async function folderForClassesDoc(pack, data) {
  const c = classifyClassesDoc(data);
  if (!c.classId) return null;
  const className = CLASS_DISPLAY[c.classId] || c.classId.replace(/[-_]/g, " ").replace(/\b\w/g, m => m.toUpperCase());
  const classRoot = await getOrCreateFolder(pack, className, null);
  if (c.type === "classfeat") {
    return await getOrCreateFolder(pack, "Class Features", classRoot);
  }
  if (c.type === "subclassfeat") {
    const subName = _subclassDisplayName(c.subId);
    return await getOrCreateFolder(pack, subName, classRoot);
  }
  return null;
}

// ─── File walk + per-source directory import ────────────────────────────────
async function listJsonFiles(dir, recursive = false) {
  let allFiles = [];
  try {
    const res = await FilePicker.browse("data", dir);
    const files = (res.files || []).filter(path => {
      const base = path.split("/").pop() || "";
      if (SKIP_BASENAMES.has(base)) return false;
      return base.toLowerCase().endsWith(".json");
    });
    allFiles.push(...files);
    if (recursive) {
      for (const subDir of (res.dirs || [])) {
        const subFiles = await listJsonFiles(subDir, true);
        allFiles.push(...subFiles);
      }
    }
  } catch (e) {
    console.error(`[bbttcc compile] browse failed for ${dir}`, e);
  }
  return allFiles;
}

async function readJson(path) {
  const resp = await fetch(`/${path}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${path}`);
  return JSON.parse(await resp.text());
}

async function runJob(job) {
  const pack = game.packs.get(job.targetPack);
  if (!pack) {
    return { sourceDir: job.sourceDir, targetPack: job.targetPack, fileCount: 0, created: 0, updated: 0, skipped: 0, errored: 1, log: [`Pack not found: ${job.targetPack}`] };
  }
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { console.warn(`[bbttcc compile] could not unlock ${job.targetPack}`, e); }
  }

  // Pack-wide index built once per job so _id collision checks are O(1).
  const index = await pack.getIndex({ fields: ["name"] });
  const liveIds = new Set(index.map(e => e._id));

  const files = await listJsonFiles(job.sourceDir, !!job.recursive);
  let created = 0, updated = 0, skipped = 0, errored = 0;
  const log = [];

  for (const path of files) {
    let data;
    try { data = await readJson(path); }
    catch (e) { errored++; log.push(`ERROR reading ${path}: ${e.message}`); continue; }

    if (!data || typeof data !== "object" || !data._id) {
      skipped++; log.push(`skip ${path} (no _id)`); continue;
    }
    if (pack.documentName === "Item" && data.type === undefined) {
      skipped++; log.push(`skip ${path} (not an Item)`); continue;
    }

    if (liveIds.has(data._id)) {
      if (!UPDATE_EXISTING) { skipped++; continue; }
      if (DRY_RUN) { updated++; log.push(`[dry] would update ${data.name} (${data._id})`); continue; }
      try {
        const existing = await pack.getDocument(data._id);
        if (existing) await existing.delete();
        const folderId = await job.folderFor(pack, data);
        const payload = foundry.utils.deepClone(data);
        if (folderId && folderId !== "dry-run") payload.folder = folderId;
        await Item.create(payload, { pack: pack.collection, keepId: true });
        updated++;
      } catch (e) {
        errored++; log.push(`ERROR updating ${data.name} (${data._id}): ${e.message}`);
      }
      continue;
    }

    if (DRY_RUN) {
      const fid = await job.folderFor(pack, data);
      created++; log.push(`[dry] would create ${data.name} (${data._id}) → folder=${fid}`);
      continue;
    }
    try {
      const folderId = await job.folderFor(pack, data);
      const payload = foundry.utils.deepClone(data);
      if (folderId) payload.folder = folderId;
      await Item.create(payload, { pack: pack.collection, keepId: true });
      created++;
    } catch (e) {
      errored++; log.push(`ERROR creating ${data.name} (${data._id}): ${e.message}`);
    }
  }

  return { sourceDir: job.sourceDir, targetPack: job.targetPack, created, updated, skipped, errored, log, fileCount: files.length };
}

// ─── Run ─────────────────────────────────────────────────────────────────────
const results = [];
for (const job of JOBS) {
  ui.notifications.info(`Compiling from ${job.sourceDir} → ${job.targetPack}…`);
  const r = await runJob(job);
  results.push(r);
  console.log(`[bbttcc compile] ${job.sourceDir}:`, r);
}

// ─── Chat summary ────────────────────────────────────────────────────────────
const rows = results.map(r => `<tr>
  <td><code>${foundry.utils.escapeHTML(r.sourceDir)}</code></td>
  <td><code>${foundry.utils.escapeHTML(r.targetPack)}</code></td>
  <td>${r.fileCount}</td>
  <td>${r.created}</td>
  <td>${r.updated}</td>
  <td>${r.skipped}</td>
  <td>${r.errored}</td>
</tr>`).join("");

const foldersHtml = foldersCreated.length
  ? `<details><summary>Folders touched (${foldersCreated.length})</summary><pre style="font-size:0.72em;white-space:pre-wrap;margin:0.3rem 0 0;">${foundry.utils.escapeHTML(foldersCreated.join("\n"))}</pre></details>`
  : `<p style="opacity:0.55;font-size:0.8em;margin:0.3rem 0 0;">No new folders created — matched against existing structure.</p>`;

ChatMessage.create({
  speaker: { alias: "BBTTCC Compile" },
  content: `
<h3>BBTTCC Compile Loose JSONs ${DRY_RUN ? "— DRY RUN" : ""}</h3>
<p>${UPDATE_EXISTING ? "<b>UPDATE_EXISTING = true</b> (overwriting existing docs)" : "Existing docs skipped."}</p>
<table style="border-collapse:collapse;width:100%;font-size:0.82em;">
  <thead><tr><th align="left">Source</th><th align="left">Target</th><th>Files</th><th>Created</th><th>Updated</th><th>Skipped</th><th>Errored</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
${foldersHtml}
<p style="opacity:0.7;font-size:0.8em;margin-top:0.5rem;">See the browser console for per-file log lines.</p>
  `
});

return results;
