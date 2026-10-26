/* strip-mal-voiced-tag-2026-10-25.macro.js — Dave (2026-10-25): "remove 'Mal voiced' descriptor tags from
 * player facing content like items." The `mal-voiced` entry in `system.tags` is an authoring provenance mark
 * from the create-mal-voiced-* seeders — it means nothing to the rules and reads as a spoiler on a player's
 * sheet. This removes it from every Item that carries it: compendium items in bbttcc-master-content packs
 * (unlocked for the write, re-locked after), world items, items embedded on world actors (stewards' copies)
 * and on compendium NPCs, plus the one NPC role string "… (Mal-Voiced)". Idempotent; DRY_RUN default true; GM only.
 * Marker: [STRIP-MAL-VOICED-2026-10-25] */
(async () => {
  const DRY_RUN = true;   // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const TAG = /^mal[- ]voiced$/i;
  const ROLE_RX = /\s*\((?:Mal[- ]Voiced)\)\s*/gi;
  const tagsOf = (it) => Array.isArray(it?.system?.tags) ? it.system.tags : (typeof it?.system?.tags === "string" ? it.system.tags.split(",").map(s => s.trim()).filter(Boolean) : null);
  const patchItem = (it) => {
    const t = tagsOf(it); if (!t || !t.some(x => TAG.test(String(x)))) return null;
    const nt = t.filter(x => !TAG.test(String(x)));
    return { _id: it.id, "system.tags": Array.isArray(it.system.tags) ? nt : nt.join(", ") };
  };
  const patchActor = (a) => { const r = a?.system?.role; if (typeof r !== "string" || !ROLE_RX.test(r)) return null; ROLE_RX.lastIndex = 0; return { _id: a.id, "system.role": r.replace(ROLE_RX, "").trim() }; };
  const report = []; let changes = 0; const backup = [];
  const mine = (p) => p.metadata.packageName === "bbttcc-master-content";
  const unlockedWrite = async (pack, fn) => { const was = pack.locked; if (was) await pack.configure({ locked: false }); try { await fn(); } finally { if (was) await pack.configure({ locked: true }); } };

  // 1. compendium items
  for (const pack of game.packs.filter(p => mine(p) && p.documentName === "Item")) {
    const docs = await pack.getDocuments();
    const ups = docs.map(patchItem).filter(Boolean);
    if (!ups.length) continue;
    report.push(`${pack.collection}: ${ups.length} item(s)`); changes += ups.length;
    for (const u of ups) backup.push({ pack: pack.collection, id: u._id, tags: tagsOf(docs.find(d => d.id === u._id)) });
    if (!DRY_RUN) await unlockedWrite(pack, () => Item.updateDocuments(ups, { pack: pack.collection }));
  }
  // 2. compendium actors: embedded items + role
  for (const pack of game.packs.filter(p => mine(p) && p.documentName === "Actor")) {
    const docs = await pack.getDocuments();
    let n = 0;
    for (const a of docs) {
      const ups = a.items.contents.map(patchItem).filter(Boolean);
      const ra = patchActor(a);
      if (!ups.length && !ra) continue;
      n += ups.length + (ra ? 1 : 0);
      for (const u of ups) backup.push({ pack: pack.collection, actor: a.id, id: u._id, tags: tagsOf(a.items.get(u._id)) });
      if (ra) backup.push({ pack: pack.collection, actor: a.id, role: a.system.role });
      if (!DRY_RUN) await unlockedWrite(pack, async () => {
        if (ups.length) await a.updateEmbeddedDocuments("Item", ups);
        if (ra) await a.update({ "system.role": ra["system.role"] });
      });
    }
    if (n) { report.push(`${pack.collection}: ${n} change(s)`); changes += n; }
  }
  // 3. world items
  { const ups = game.items.contents.map(patchItem).filter(Boolean);
    if (ups.length) { report.push(`world items: ${ups.length}`); changes += ups.length; for (const u of ups) backup.push({ world: true, id: u._id, tags: tagsOf(game.items.get(u._id)) }); if (!DRY_RUN) await Item.updateDocuments(ups); } }
  // 4. world actors: embedded items + role
  for (const a of game.actors.contents) {
    const ups = a.items.contents.map(patchItem).filter(Boolean);
    const ra = patchActor(a);
    if (!ups.length && !ra) continue;
    report.push(`${a.name}: ${ups.length} embedded item(s)${ra ? " + role" : ""}`); changes += ups.length + (ra ? 1 : 0);
    for (const u of ups) backup.push({ actor: a.id, id: u._id, tags: tagsOf(a.items.get(u._id)) });
    if (ra) backup.push({ actor: a.id, role: a.system.role });
    if (!DRY_RUN) { if (ups.length) await a.updateEmbeddedDocuments("Item", ups); if (ra) await a.update({ "system.role": ra["system.role"] }); }
  }
  console.log(`[strip-mal-voiced] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Strip mal-voiced DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Strip mal-voiced: nothing to do.");
  try { (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(backup, null, 1), "text/json", `backup-mal-voiced-${Date.now()}.json`); } catch (_) {}
  ui.notifications.info(`Strip mal-voiced APPLIED: ${changes} change(s). Rerun = 0 confirms.`);
})();
