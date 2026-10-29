// bbttcc-master-content/tools/patch-class-swap-leftovers-and-package-mastery-2026-10-29.macro.js
// Two follow-ups to the 10-29 system core review (Dave, 10-29):
//   A. LEFTOVER PATH FEATURES — before 10-29, features imported on level-up carried no
//      lineage tag, so a class/subclass swap left the old path's features on the steward
//      (worst for Pactkeeper, whose subclass features live in "Subclasses/<Name>", and
//      Marginalia's Annotator / Redactor / Metaphor Apostle). For every actor with a class,
//      a feat is a leftover when its name belongs to a class or subclass feature folder in
//      bbttcc-master-content.classes that is NOT the actor's current class / subclass.
//      Heritage / ancestry grants are never touched.
//   B. PACKAGE MASTERY TEXT — Black Stair's reward is now "your next Surge spend costs 1
//      less" (was +1 Surge, which never landed after the fill-to-cap). Rewrites the old
//      sentence in the pack doc, world Items and every embedded copy; guarded by an exact
//      old-sentence match, so in-world edits are reported, never overwritten.
// Run as GM: DRY_RUN = true first, then false; a rerun reports 0. Actors are per world.
const DRY_RUN = true;
const PACK = "bbttcc-master-content.classes";
const PM_IDENT = "shadow_courier_tier3_package_mastery";
const PM_OLD = "Delivering banks <strong>+1 Surge</strong> for you in addition to the L1 effect.";
const PM_OLDER = "Delivering recovers <strong>1 Pace</strong> for you in addition to the L1 effect.";   // pre-Surge-fold copies
const PM_NEW = "The blade's already drawn: delivering makes your <strong>next Surge spend cost 1 less</strong> (minimum 1) in addition to the L1 effect.";
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  const pack = game.packs.get(PACK);
  if (!pack) return ui.notifications.error(`${PACK} not available in this world.`);
  const report = { leftovers: { actors: 0, feats: 0, list: [] }, packageMastery: { pack: 0, worldItems: 0, actorCopies: 0, current: 0, conflicts: [] } };

  // ── A. which class / subclass owns each feature name ──────────────────────
  const idx = [...await pack.getIndex({ fields: ["folder", "type", "name"] })];
  const folders = pack.folders?.contents ?? [...(pack.folders ?? [])];
  const parentOf = (fid) => { const f = folders.find(x => x.id === fid); return f?.folder?.id ?? f?.folder ?? null; };
  const inTree = (fid, root) => { for (let f = fid, n = 0; f && n < 12; n++) { if (f === root) return true; f = parentOf(f); } return false; };
  const norm = (n) => String(n ?? "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  // Same rule as ft-progression resolveSubclassFeatureFolderId: a shared subclass folder
  // (Pactkeeper "Subclasses") hands off to the child folder named after the subclass.
  const featureRoot = (e) => {
    if (idx.filter(x => x.type === "subclass" && x.folder === e.folder).length <= 1) return e.folder;
    return folders.find(f => (f.folder?.id ?? f.folder ?? null) === e.folder && norm(f.name) === norm(e.name))?.id ?? e.folder;
  };
  const owners = new Map();   // feat name -> { type, name }; subclass beats class (more specific)
  for (const type of ["class", "subclass"]) {
    for (const e of idx.filter(x => x.type === type && x.folder)) {
      const root = type === "subclass" ? featureRoot(e) : e.folder;
      if (idx.filter(x => x.type === type && x.folder === root).length > 1) continue;   // still shared — can't tell
      for (const f of idx) if (f.type === "feat" && inTree(f.folder, root)) owners.set(String(f.name).trim(), { type, name: norm(e.name), label: String(e.name).trim() });
    }
  }
  // Stewards only: NPC archetype classes (Savant, Broker, Keeper, Bravo, Operator …) borrow
  // path features on purpose — the 10-29 dry run flagged 13 of them.
  const stewardClasses = new Set(idx.filter(x => x.type === "class").map(x => norm(x.name)));
  for (const a of game.actors) {
    const cls = a.items.find(i => i.type === "class"); if (!cls || !stewardClasses.has(norm(cls.name))) continue;
    const sub = a.items.find(i => i.type === "subclass");
    const cur = { class: norm(cls.name), subclass: norm(sub?.name) };
    const ids = [], names = [];
    for (const it of a.items) {
      if (it.type !== "feat") continue;
      const ff = it.flags?.fourththing ?? {};
      if (ff.grantedByHeritage || ff.grantedByAncestry) continue;
      const o = owners.get(String(it.name).trim()); if (!o) continue;
      if (o.name !== cur[o.type]) { ids.push(it.id); names.push(`${it.name} (${o.label})`); }
    }
    if (!ids.length) continue;
    report.leftovers.actors++; report.leftovers.feats += ids.length;
    report.leftovers.list.push(`${a.name} [${cls.name}${sub ? " / " + sub.name : ""}]: ${names.join(", ")}`);
    if (!DRY_RUN) { try { await a.deleteEmbeddedDocuments("Item", ids); } catch (e) { report.leftovers.list.push(`${a.name}: delete failed — ${e.message}`); } }
  }

  // ── B. Package Mastery text ───────────────────────────────────────────────
  const pm = report.packageMastery;
  const fix = (it) => {
    const v = it.system?.description?.value ?? "";
    if (v.includes(PM_NEW)) { pm.current++; return null; }
    const old = v.includes(PM_OLD) ? PM_OLD : v.includes(PM_OLDER) ? PM_OLDER : null;
    if (!old) { pm.conflicts.push(`${it.parent?.name ? it.parent.name + " · " : ""}${it.name}: text edited in-world — skipped`); return null; }
    return { _id: it.id, "system.description.value": v.replace(old, PM_NEW) };
  };
  const isPM = (it) => String(it.system?.identifier ?? "") === PM_IDENT;
  const packDocs = (await pack.getDocuments()).filter(isPM);
  const pUps = packDocs.map(fix).filter(Boolean);
  if (!DRY_RUN && pUps.length) {
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try { await Item.updateDocuments(pUps, { pack: PACK }); } finally { if (wasLocked) await pack.configure({ locked: true }); }
  }
  pm.pack = pUps.length;
  const wUps = game.items.filter(isPM).map(fix).filter(Boolean);
  pm.worldItems = wUps.length;
  if (!DRY_RUN && wUps.length) await Item.updateDocuments(wUps);
  for (const a of game.actors) {
    const ups = a.items.filter(isPM).map(fix).filter(Boolean);
    if (!ups.length) continue;
    pm.actorCopies += ups.length;
    if (!DRY_RUN) { try { await a.updateEmbeddedDocuments("Item", ups); } catch (e) { pm.conflicts.push(`${a.name}: write failed — ${e.message}`); } }
  }

  console.log("[patch-class-swap-leftovers-and-package-mastery]", DRY_RUN ? "DRY RUN" : "APPLIED", report);
  ui.notifications.info(`Class-swap leftovers + Package Mastery ${DRY_RUN ? "(dry run)" : "applied"} — see console.`);
  return report;
})();
