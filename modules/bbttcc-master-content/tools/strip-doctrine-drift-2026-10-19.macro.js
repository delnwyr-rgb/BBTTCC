/* strip-doctrine-drift-2026-10-19.macro.js — Dave (2026-10-19): "Drift is an old concept… let's strip away the Drift text."
 * The "(Bad Eden)" doctrine bodies carry a header `<strong>Mode:</strong> X · <strong>Drift:</strong> Toward|Sideways|Away`
 * (regimen-era body rewrites). Nothing reads Drift. This removes ` · Drift: …` from every item description that has it:
 * compendium items in bbttcc-master-content packs (unlocked for the write, re-locked after), world items, and
 * items embedded on world actors (a steward's doctrine is a copy). Idempotent; DRY_RUN default true; GM only.
 * Marker: [STRIP-DOCTRINE-DRIFT-2026-10-19] */
(async () => {
  const DRY_RUN = true;   // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const RX = /\s*·\s*<strong>Drift:<\/strong>\s*(?:Toward|Sideways|Away)/g;
  const hit = (v) => typeof v === "string" && /Drift:<\/strong>/.test(v);
  const descOf = (it) => it?.system?.description?.value ?? (typeof it?.system?.description === "string" ? it.system.description : null);
  const patch = (it) => { const v = descOf(it); if (!hit(v)) return null; const nv = v.replace(RX, ""); if (nv === v) return null;
    return (typeof it.system.description === "string") ? { _id: it.id, "system.description": nv } : { _id: it.id, "system.description.value": nv }; };
  const report = []; let changes = 0; const backup = [];

  // 1. compendium items (this module's packs)
  for (const pack of game.packs.filter(p => p.metadata.packageName === "bbttcc-master-content" && p.documentName === "Item")) {
    const docs = await pack.getDocuments();
    const ups = docs.map(patch).filter(Boolean);
    if (!ups.length) continue;
    report.push(`${pack.collection}: ${ups.length} item(s)`); changes += ups.length;
    for (const u of ups) backup.push({ pack: pack.collection, id: u._id, desc: descOf(docs.find(d => d.id === u._id)) });
    if (!DRY_RUN) {
      const wasLocked = pack.locked; if (wasLocked) await pack.configure({ locked: false });
      try { await Item.updateDocuments(ups, { pack: pack.collection }); } finally { if (wasLocked) await pack.configure({ locked: true }); }
    }
  }
  // 2. world items
  { const ups = game.items.contents.map(patch).filter(Boolean);
    if (ups.length) { report.push(`world items: ${ups.length}`); changes += ups.length; for (const u of ups) backup.push({ world: true, id: u._id, desc: descOf(game.items.get(u._id)) }); if (!DRY_RUN) await Item.updateDocuments(ups); } }
  // 3. items embedded on world actors
  for (const a of game.actors.contents) {
    const ups = a.items.contents.map(patch).filter(Boolean);
    if (!ups.length) continue;
    report.push(`${a.name}: ${ups.length} embedded item(s)`); changes += ups.length;
    for (const u of ups) backup.push({ actor: a.id, id: u._id, desc: descOf(a.items.get(u._id)) });
    if (!DRY_RUN) await a.updateEmbeddedDocuments("Item", ups);
  }
  console.log(`[strip-doctrine-drift] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Strip Drift DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Strip Drift: nothing to do.");
  try { (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(backup, null, 1), "text/json", `backup-doctrine-drift-${Date.now()}.json`); } catch (_) {}
  ui.notifications.info(`Strip Drift APPLIED: ${changes} description(s) cleaned.`);
})();
