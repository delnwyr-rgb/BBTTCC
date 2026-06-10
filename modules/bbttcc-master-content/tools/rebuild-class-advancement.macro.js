// Bad Eden master-content / tools / rebuild-class-advancement.macro.js
//
// Rebuilds every class doc's `system.advancement` ItemGrant entries from the
// stamped `system.prerequisites.level` on each feat in the class's
// `Class Features` folder. Mirrors the canonical Dreamwalker shape:
//
//   - One ItemGrant per laddered level
//   - Single-feat grant → title = feat name (e.g. "Dream-Thread Tuning")
//   - Multi-feat grant  → title = "<Class>: Level N Features"
//                        (or "<Class> Core Features" for level 1)
//
// PRESERVES (does NOT touch) existing non-ItemGrant entries:
//   - HitPoints, AbilityScoreImprovement, Subclass, Trait, etc.
// REPLACES (overwrites) all existing ItemGrant entries on the class doc.
//
// PREREQUISITES:
//   - Run stamp-from-advancement.macro.js (DRY_RUN=false) first so every feat
//     has its system.prerequisites.level set.
//
// USAGE:
//   1. Open a Script macro as GM, paste this entire file.
//   2. Run with DRY_RUN = true. Read the console summary.
//   3. Flip DRY_RUN = false, re-run.
//
// SCOPE:
//   By default, processes every class doc. To restrict, set CLASSES_TO_REBUILD
//   to a list of class names (e.g. ["Aurablade", "Cosmic Linguist"]).

const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.classes";
const CLASSES_TO_REBUILD = []; // empty = all classes

// If a class feat has no level signal anywhere (no prereq.level stamp, no
// name/identifier marker, no description cue), default it to L1. This matches
// the canonical reading: anything filed as a "Class Feature" without explicit
// laddering is granted at character creation. Affects Cosmic Linguist /
// Pactkeeper / similar doctrine-heavy paths whose class-level features are
// all base-kit. Untiered feats get stamped to prereq.level=1 in the same pass.
const DEFAULT_UNTIERED_CLASS_FEATS_TO_L1 = true;

const derive = game.fourththing?._progression?.deriveItemUnlockLevel ?? (() => ({ tier: null, level: null }));

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }

const allDocs = await pack.getDocuments();

const featLevel = (feat) => {
  const stamped = Number(feat.system?.prerequisites?.level);
  if (Number.isFinite(stamped) && stamped > 0) return stamped;
  const d = derive(feat);
  return Number.isFinite(d.level) && d.level > 0 ? d.level : null;
};

// Find every feat that belongs to a class via identifier prefix OR name prefix
// (avoids depending on a brittle "Class Features" folder name). Class-name
// matching uses several common cadences seen in the live pack:
//   "Aurablade: …", "Aurablade — …", "Aurablade - …", "Aurablade …",
//   "Aurablade Action", "Aurablade Tier N — …".
function feathsForClass(classDoc, allFeats) {
  const className = classDoc.name;
  const classIdent = String(classDoc.system?.identifier ?? "").toLowerCase();
  const identPrefix = classIdent ? classIdent.replace(/[^a-z0-9_]/g, "_") + "_" : "";
  const namePrefixes = [
    `${className}:`,
    `${className} —`,
    `${className} -`,
    `${className} `,
    `${className}—`,
    `${className}-`
  ];
  return allFeats.filter(f => {
    const fid = String(f.system?.identifier ?? "").toLowerCase();
    if (identPrefix && fid.startsWith(identPrefix)) return true;
    if (identPrefix && fid === classIdent) return true;
    const n = f.name ?? "";
    return namePrefixes.some(p => n.startsWith(p));
  });
}

const wasLocked = pack.locked;
if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });

const classDocs = allDocs.filter(d => d.type === "class")
  .filter(d => CLASSES_TO_REBUILD.length === 0 || CLASSES_TO_REBUILD.includes(d.name));

const allFeats = allDocs.filter(d => d.type === "feat");
const summary = [];
const updates = [];

// Pre-compute which feats are claimed by ItemGrant entries on existing class
// docs, so we can also pull feats granted by classes whose name doesn't appear
// as a prefix on the feat itself (e.g. "Extra Attack (Harmony Marshal)").
const grantedByClass = new Map(); // className → Set<feat doc>
for (const c of allDocs.filter(d => d.type === "class")) {
  const adv = c.system?.advancement;
  const list = Array.isArray(adv) ? adv : (adv && typeof adv === "object" ? Object.values(adv) : []);
  const set = new Set();
  for (const a of list) {
    if (a?.type !== "ItemGrant") continue;
    const items = a.configuration?.items ?? [];
    for (const it of items) {
      const feat = allFeats.find(f => f.uuid === it?.uuid);
      if (feat) set.add(feat);
    }
  }
  grantedByClass.set(c.name, set);
}

for (const classDoc of classDocs) {
  // Discovery: identifier-prefix + name-prefix + currently-granted union.
  const featsByDiscovery = feathsForClass(classDoc, allFeats);
  const featsByGrants = grantedByClass.get(classDoc.name) ?? new Set();
  const featSet = new Set(featsByDiscovery);
  for (const f of featsByGrants) featSet.add(f);
  // Exclude doctrine features (those typically have a doctrine-name prefix
  // that does not start with the class name; identifier match for those would
  // be e.g. "bulwark_avalanche_l1_*" — still matched by identPrefix. Filter
  // those out by checking for a doctrine-folder-name segment in identifier.)
  const DOCTRINE_FRAGMENTS = [
    "_avalanche_", "_cataclyst_", "_mountain_",
    "_black_stair_", "_last_mile_", "_wayfarer_",
    "_annotator_", "_metaphor_", "_redactor_",
    "_archivist_", "_auditor_", "_steward_"
  ];
  const feats = [...featSet].filter(f => {
    const id = String(f.system?.identifier ?? "").toLowerCase();
    return !DOCTRINE_FRAGMENTS.some(frag => id.includes(frag));
  });

  // Group by level
  const byLevel = new Map();
  let untiered = 0;
  const untieredToStamp = []; // feats we'll write prereq.level=1 to
  for (const f of feats) {
    let lvl = featLevel(f);
    if (lvl === null) {
      if (DEFAULT_UNTIERED_CLASS_FEATS_TO_L1) {
        lvl = 1;
        untieredToStamp.push(f);
      } else {
        untiered++;
        continue;
      }
    }
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl).push(f);
  }

  // Build new ItemGrant entries (sorted by level)
  const sortedLevels = [...byLevel.keys()].sort((a, b) => a - b);
  const newGrants = [];
  for (const lvl of sortedLevels) {
    const group = byLevel.get(lvl).sort((a, b) => a.name.localeCompare(b.name));
    const items = group.map(f => ({ uuid: f.uuid, optional: false }));
    let title;
    if (group.length === 1) title = group[0].name;
    else if (lvl === 1) title = `${classDoc.name} Core Features`;
    else title = `${classDoc.name}: Level ${lvl} Features`;
    newGrants.push({
      _id: foundry.utils.randomID(16),
      type: "ItemGrant",
      configuration: { items, optional: false, spell: null },
      value: {},
      level: lvl,
      title
    });
  }

  // Existing advancement → drop ItemGrant, keep the rest
  const existingAdv = classDoc.system?.advancement;
  const existingList = Array.isArray(existingAdv)
    ? existingAdv
    : (existingAdv && typeof existingAdv === "object" ? Object.values(existingAdv) : []);
  const preserved = existingList.filter(a => a?.type !== "ItemGrant");
  const existingItemGrants = existingList.filter(a => a?.type === "ItemGrant");

  // To preserve _id stability when shape matches, reuse existing IDs by level.
  const existingByLevel = new Map();
  for (const e of existingItemGrants) {
    const l = Number(e.level);
    if (!existingByLevel.has(l)) existingByLevel.set(l, []);
    existingByLevel.get(l).push(e);
  }
  for (const g of newGrants) {
    const pool = existingByLevel.get(g.level);
    if (pool && pool.length) {
      g._id = pool.shift()._id;
    }
  }

  const newAdvancement = [...preserved, ...newGrants];

  // Diff: did anything actually change?
  const beforeJson = JSON.stringify(existingItemGrants.map(e => ({
    level: e.level, items: (e.configuration?.items ?? []).map(i => i.uuid).sort()
  })).sort((a,b) => a.level - b.level));
  const afterJson = JSON.stringify(newGrants.map(e => ({
    level: e.level, items: (e.configuration?.items ?? []).map(i => i.uuid).sort()
  })).sort((a,b) => a.level - b.level));
  const changed = beforeJson !== afterJson;

  summary.push({
    class: classDoc.name,
    feats: feats.length,
    untiered,
    "→L1default": untieredToStamp.length,
    levels: sortedLevels.length,
    grantsBefore: existingItemGrants.length,
    grantsAfter: newGrants.length,
    preserved: preserved.length,
    changed: changed ? "YES" : "no"
  });

  if (changed) {
    updates.push({ _id: classDoc.id, "system.advancement": newAdvancement });
  }
  // Stamp the defaulted feats so future runs don't re-default them and the
  // runtime filter sees the canonical value.
  if (DEFAULT_UNTIERED_CLASS_FEATS_TO_L1 && !DRY_RUN && untieredToStamp.length) {
    const featUpdates = untieredToStamp.map(f => ({ _id: f.id, "system.prerequisites.level": 1 }));
    try {
      await pack.documentClass.updateDocuments(featUpdates, { pack: PACK_ID });
    } catch (e) {
      console.error(`[rebuild-class-advancement] L1-default stamp failed for ${classDoc.name}`, e);
    }
  }
}

console.group("[rebuild-class-advancement]");
console.log("DRY_RUN:", DRY_RUN);
console.table(summary);
console.log("classes with pending changes:", updates.length);
console.groupEnd();

if (!DRY_RUN && updates.length) {
  await pack.documentClass.updateDocuments(updates, { pack: PACK_ID });
}
if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });

ui.notifications.info(`Rebuild advancement: ${DRY_RUN ? "would update" : "updated"} ${updates.length} class(es) — see console.`);
