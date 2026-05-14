// BBTTCC master-content / tools / stamp-from-advancement.macro.js
//
// Authoritative back-stamp: for every class/subclass doc in the BBTTCC packs,
// walk its `system.advancement` array, follow each ItemGrant's UUIDs, and
// stamp `system.prerequisites.level` on each granted feat using the grant's
// level. The class doc IS the canonical source — it's what dnd5e level-up
// pipelines have always read.
//
// Three-pass stamping (each pass only writes if prereq.level is missing/zero):
//
//   Pass A — Advancement (authoritative)
//     class doc → advancement → ItemGrant[level] → feat UUIDs → stamp level
//
//   Pass B — Name map (desktop-source fallback)
//     load data/feature-level-map.json (built by build-feature-level-map.mjs)
//     for each unstamped feat, look up its name → level
//
//   Pass C — Derived helper (last resort)
//     game.fourththing._progression.deriveItemUnlockLevel — regex name/identifier/desc
//
// USAGE:
//   1. Open a Script macro in Foundry as GM.
//   2. Paste this entire file.
//   3. Run with DRY_RUN = true. Read the console report.
//   4. Flip to DRY_RUN = false and re-run.
//
// Idempotent: re-running after stamping is a no-op.

const DRY_RUN = true;
const PACKS_TO_SCAN_FOR_PARENTS = [
  "bbttcc-master-content.classes",
  "bbttcc-master-content.subclasses"
];
const NAME_MAP_PATH = "modules/bbttcc-master-content/data/feature-level-map.json";

const derive = game.fourththing?._progression?.deriveItemUnlockLevel ?? (() => ({ tier: null, level: null }));

// --- Load name-map (Pass B fallback) ----------------------------------------
let NAME_MAP = {};
try {
  const r = await fetch(`${NAME_MAP_PATH}?_=${Date.now()}`);
  if (r.ok) {
    const j = await r.json();
    NAME_MAP = j?.globalLevels ?? {};
    console.log(`[stamp-advancement] loaded name-map with ${Object.keys(NAME_MAP).length} entries`);
  } else {
    console.warn(`[stamp-advancement] name-map fetch failed (${r.status}) — Pass B disabled`);
  }
} catch (e) {
  console.warn("[stamp-advancement] name-map fetch error — Pass B disabled", e);
}

// --- Pass A: Advancement-driven stamping ------------------------------------
// Build a UUID → level map by walking every class/subclass doc in the named packs.
const uuidToLevel = new Map();
const advReport = [];

for (const packId of PACKS_TO_SCAN_FOR_PARENTS) {
  const pack = game.packs.get(packId);
  if (!pack) { console.warn(`[stamp-advancement] pack not found: ${packId}`); continue; }
  const docs = await pack.getDocuments();
  for (const doc of docs) {
    if (doc.type !== "class" && doc.type !== "subclass") continue;
    const adv = doc.system?.advancement;
    const advList = Array.isArray(adv) ? adv : (adv && typeof adv === "object" ? Object.values(adv) : []);
    let count = 0;
    for (const a of advList) {
      if (a?.type !== "ItemGrant") continue;
      const lvl = Number(a.level);
      if (!Number.isFinite(lvl) || lvl <= 0) continue;
      const items = a.configuration?.items ?? a.config?.items ?? [];
      for (const it of items) {
        const uuid = String(it?.uuid ?? "");
        if (!uuid) continue;
        // Take the lowest level if a feat is granted by multiple paths.
        const prev = uuidToLevel.get(uuid);
        if (prev === undefined || lvl < prev) uuidToLevel.set(uuid, lvl);
        count++;
      }
    }
    if (count) advReport.push({ pack: packId, parent: doc.name, type: doc.type, grantedItems: count });
  }
}
console.group("[stamp-advancement] Pass A: parent docs scanned");
console.table(advReport);
console.groupEnd();

// --- Resolve UUIDs and apply Pass A -----------------------------------------
const stampPlan = []; // { uuid, name, packId, docId, currentLevel, newLevel, source }
for (const [uuid, lvl] of uuidToLevel) {
  let doc;
  try { doc = await fromUuid(uuid); } catch (_e) { /* skip */ }
  if (!doc || doc.type !== "feat") continue;
  const cur = Number(doc.system?.prerequisites?.level);
  if (Number.isFinite(cur) && cur > 0 && cur === lvl) continue; // already correct
  stampPlan.push({
    uuid,
    name: doc.name,
    packId: doc.pack,
    docId: doc.id,
    currentLevel: Number.isFinite(cur) && cur > 0 ? cur : null,
    newLevel: lvl,
    source: "advancement"
  });
}

// --- Pass B + C: walk every feat that wasn't covered by Pass A --------------
for (const packId of PACKS_TO_SCAN_FOR_PARENTS) {
  const pack = game.packs.get(packId);
  if (!pack) continue;
  const docs = await pack.getDocuments();
  for (const doc of docs) {
    if (doc.type !== "feat") continue;
    const cur = Number(doc.system?.prerequisites?.level);
    if (Number.isFinite(cur) && cur > 0) continue;       // already stamped by some prior process
    if (stampPlan.some(p => p.docId === doc.id && p.packId === doc.pack)) continue; // queued by Pass A

    // Pass B
    const fromMap = Number(NAME_MAP[doc.name]);
    if (Number.isFinite(fromMap) && fromMap > 0) {
      stampPlan.push({ uuid: doc.uuid, name: doc.name, packId: doc.pack, docId: doc.id, currentLevel: null, newLevel: fromMap, source: "name-map" });
      continue;
    }
    // Pass C
    const { level: derivedLvl } = derive(doc);
    if (Number.isFinite(derivedLvl) && derivedLvl > 0) {
      stampPlan.push({ uuid: doc.uuid, name: doc.name, packId: doc.pack, docId: doc.id, currentLevel: null, newLevel: derivedLvl, source: "derived-regex" });
      continue;
    }
    // Untiered — skip (passive/identity item)
  }
}

console.group("[stamp-advancement] stamp plan");
console.log("DRY_RUN:", DRY_RUN, "  total stamps:", stampPlan.length);
console.table(stampPlan.slice(0, 60));
const counts = stampPlan.reduce((acc, p) => { acc[p.source] = (acc[p.source]||0)+1; return acc; }, {});
console.log("by source:", counts);
console.groupEnd();

// --- Apply ------------------------------------------------------------------
if (!DRY_RUN && stampPlan.length) {
  // Group updates per pack to use bulk updateDocuments
  const byPack = new Map();
  for (const p of stampPlan) {
    if (!byPack.has(p.packId)) byPack.set(p.packId, []);
    byPack.get(p.packId).push({ _id: p.docId, "system.prerequisites.level": p.newLevel });
  }
  for (const [packId, updates] of byPack) {
    const pack = game.packs.get(packId);
    if (!pack) continue;
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try {
      await pack.documentClass.updateDocuments(updates, { pack: packId });
    } catch (e) {
      console.error(`[stamp-advancement] update failed for ${packId}`, e);
    }
    if (wasLocked) await pack.configure({ locked: true });
  }
}

ui.notifications.info(`[stamp-from-advancement] ${DRY_RUN ? "would stamp" : "stamped"} ${stampPlan.length} feats — open F12 console for details.`);
