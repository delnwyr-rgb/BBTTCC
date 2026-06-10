// Bad Eden master-content / tools / audit-path-advancement.macro.js
//
// Inspection-only macro. For each of (Aurablade, Dreamwalker, Cosmic Linguist,
// Pactkeeper, Bulwark, Shadow Courier, Soul-Smith, Harmony Marshal, Wyrdlens
// Adept), prints:
//
//   1. The class doc (if found): name, identifier, advancement entry count,
//      and the first 5 ItemGrant entries with their level requirements.
//   2. Every feat in the class's "Class Features" folder (if found), with:
//      name, identifier, system.prerequisites.level, derived unlock level
//      (per game.fourththing._progression.deriveItemUnlockLevel).
//   3. Every doctrine subclass for that class, plus its features (folder-walk).
//
// Output goes to the F12 console as grouped tables. Read-only — never writes.

const PATHS = [
  { className: "Aurablade",        classIdent: "aurablade" },
  { className: "Bulwark",          classIdent: "bulwark" },
  { className: "Cosmic Linguist",  classIdent: "cosmic_linguist" },
  { className: "Dreamwalker",      classIdent: "dreamwalker" },
  { className: "Harmony Marshal",  classIdent: "harmony_marshal" },
  { className: "Pactkeeper",       classIdent: "pactkeeper" },
  { className: "Shadow Courier",   classIdent: "shadow_courier" },
  { className: "Soul-Smith",       classIdent: "soul_smith" },
  { className: "Wyrdlens Adept",   classIdent: "wyrdlens_adept" }
];

const PACK_ID = "bbttcc-master-content.classes";
const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }

const derive = game.fourththing?._progression?.deriveItemUnlockLevel
            ?? (() => ({ tier: null, level: null }));

const allDocs = await pack.getDocuments();
const allFolders = pack.folders?.contents ?? [];

function findFolderByName(name, parent = null) {
  return allFolders.find(f =>
    f.name === name &&
    (!parent || (f.folder?.id ?? f.folder) === parent.id)
  ) ?? null;
}

function descendantFolderIds(rootFolderId) {
  const set = new Set([rootFolderId]);
  let added = true;
  while (added) {
    added = false;
    for (const f of allFolders) {
      const parentId = f.folder?.id ?? f.folder;
      if (parentId && set.has(parentId) && !set.has(f.id)) { set.add(f.id); added = true; }
    }
  }
  return set;
}

for (const p of PATHS) {
  const classDoc = allDocs.find(d =>
    d.type === "class" &&
    (d.system?.identifier === p.classIdent || d.name === p.className)
  );

  console.group(`${p.className} (${p.classIdent})`);

  if (!classDoc) {
    console.log("CLASS DOC: NOT FOUND");
    console.groupEnd();
    continue;
  }

  // 1. Class advancement summary
  const adv = classDoc.system?.advancement ?? {};
  const advRows = Array.isArray(adv) ? adv : Object.values(adv);
  const itemGrants = advRows.filter(a => a?.type === "ItemGrant");
  console.log("class identifier:", classDoc.system?.identifier);
  console.log("advancement entries:", advRows.length, "ItemGrant:", itemGrants.length);
  if (itemGrants.length) {
    console.table(itemGrants.slice(0, 10).map(g => ({
      type: g.type,
      level: g.level,
      title: g.title ?? "",
      itemCount: ((g.configuration ?? g.config ?? {}).items ?? []).length
    })));
  }

  // 2. Class-features folder walk
  const classRootFolder = classDoc.folder ? allFolders.find(f => f.id === (classDoc.folder?.id ?? classDoc.folder)) : null;
  const cfFolder = classRootFolder ? findFolderByName("Class Features", classRootFolder) : null;
  if (!cfFolder) {
    console.log("Class Features folder: NOT FOUND");
  } else {
    const featIds = descendantFolderIds(cfFolder.id);
    const feats = allDocs.filter(d => d.type === "feat" && featIds.has(d.folder?.id ?? d.folder));
    console.log(`class features (${feats.length}):`);
    console.table(feats.map(f => ({
      name: f.name,
      identifier: f.system?.identifier ?? "",
      "prereq.level": f.system?.prerequisites?.level ?? null,
      derivedLevel: derive(f).level,
      derivedTier: derive(f).tier
    })));
  }

  // 3. Doctrines (subclass docs whose classIdentifier matches) + their features
  const subclasses = allDocs.filter(d => d.type === "subclass" && d.system?.classIdentifier === p.classIdent);
  console.log(`doctrines (${subclasses.length}):`, subclasses.map(s => s.name));
  for (const sc of subclasses) {
    const scFolder = sc.folder ? allFolders.find(f => f.id === (sc.folder?.id ?? sc.folder)) : null;
    if (!scFolder) {
      console.log(`  ${sc.name}: no folder, skipping feature walk`);
      continue;
    }
    const scFeatIds = descendantFolderIds(scFolder.id);
    const scFeats = allDocs.filter(d => d.type === "feat" && scFeatIds.has(d.folder?.id ?? d.folder));
    console.group(`  ${sc.name} features (${scFeats.length})`);
    console.table(scFeats.map(f => ({
      name: f.name,
      identifier: f.system?.identifier ?? "",
      "prereq.level": f.system?.prerequisites?.level ?? null,
      derivedLevel: derive(f).level,
      derivedTier: derive(f).tier
    })));
    console.groupEnd();
  }

  console.groupEnd();
}

ui.notifications.info("Path advancement audit printed to console — open F12 to inspect.");
