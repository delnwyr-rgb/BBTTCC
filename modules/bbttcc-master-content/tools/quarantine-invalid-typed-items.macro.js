/**
 * quarantine-invalid-typed-items.macro.js
 *
 * Stops the persistent "type X is not a valid type for the Item Document class"
 * spam coming from bbttcc-master-content.items by removing the dnd5e-leftover
 * items + stripping enchantment ActiveEffects from items that are otherwise OK.
 *
 * Two-phase, dry-run by default. Set APPLY=true to actually delete.
 *
 * Phase 1: scan pack indexes, list every Item whose type is NOT in fourththing's
 *          valid Item types — these are unloadable and the source of the spam.
 * Phase 2: load valid items, look for embedded ActiveEffects whose type isn't
 *          fourththing-valid (e.g. dnd5e "enchantment"), strip them.
 *
 * Always writes a full backup JSON to /Data/backups/ before any delete.
 */

(async () => {
  const APPLY      = true;            // FLIP TO true after reviewing the dry-run report
  const TARGET_RE  = /^bbttcc-master-content\./;   // only the master-content packs
  const BACKUP_DIR = "backups";

  // fourththing system valid types (from systems/fourththing/template.json)
  const VALID_ITEM_TYPES = new Set([
    "weapon","armor","power","gear","feature","feat","class","subclass","race","species","base",
  ]);
  // ActiveEffect types Foundry core ships with; anything else (e.g. dnd5e
  // "enchantment") is a system extension fourththing doesn't define.
  const VALID_EFFECT_TYPES = new Set(["base"]);

  // Suppress the validation noise during this run (resets on restart anyway).
  const _origWarn = console.warn, _origError = console.error;
  const _filter = (orig) => (...args) => {
    const s = String(args[0] ?? "");
    if (/validation errors|is not a valid type for the (Item|ActiveEffect) Document class/.test(s)) return;
    return orig.apply(console, args);
  };
  console.warn = _filter(_origWarn);
  console.error = _filter(_origError);

  const report = {
    apply: APPLY,
    invalidItems: [],     // { pack, id, name, type }
    invalidEffects: [],   // { pack, itemId, itemName, effectId, effectName, type }
    deletedItems: 0,
    strippedEffects: 0,
    errors: 0,
  };

  try {
    const packs = game.packs.filter(p => TARGET_RE.test(p.collection) && p.documentName === "Item");
    ui.notifications.info(`Quarantine scan over ${packs.length} item packs (apply=${APPLY})…`);

    // ---------- Phase 1: invalid-type items ----------
    for (const pack of packs) {
      const wasLocked = pack.locked;
      if (wasLocked) try { await pack.configure({ locked: false }); } catch {}

      let index;
      try { index = await pack.getIndex({ fields: ["type"] }); }
      catch (e) { _origWarn(`could not index ${pack.collection}`, e); report.errors++; continue; }

      const badIds = [];
      for (const entry of index) {
        if (entry.type && !VALID_ITEM_TYPES.has(entry.type)) {
          report.invalidItems.push({
            pack: pack.collection, id: entry._id, name: entry.name, type: entry.type,
          });
          badIds.push(entry._id);
        }
      }

      if (APPLY && badIds.length) {
        try {
          await Item.deleteDocuments(badIds, { pack: pack.collection });
          report.deletedItems += badIds.length;
          _origWarn(`[quarantine] deleted ${badIds.length} from ${pack.collection}`);
        } catch (e) {
          _origWarn(`[quarantine] bulk delete failed for ${pack.collection}, falling back per-id`, e);
          for (const id of badIds) {
            try { await Item.deleteDocuments([id], { pack: pack.collection }); report.deletedItems++; }
            catch (e2) { report.errors++; _origWarn(`  · id ${id} failed`, e2); }
          }
        }
      }

      // ---------- Phase 2: enchantment / invalid-typed effects on valid items ----------
      // Only iterate valid-typed entries so we don't re-trigger item validation spam.
      for (const entry of index) {
        if (entry.type && !VALID_ITEM_TYPES.has(entry.type)) continue;
        let doc;
        try { doc = await pack.getDocument(entry._id); } catch { continue; }
        if (!doc?.effects?.size) continue;
        const badEffectIds = [];
        for (const eff of doc.effects) {
          if (eff.type && !VALID_EFFECT_TYPES.has(eff.type)) {
            report.invalidEffects.push({
              pack: pack.collection, itemId: doc.id, itemName: doc.name,
              effectId: eff.id, effectName: eff.name, type: eff.type,
            });
            badEffectIds.push(eff.id);
          }
        }
        if (APPLY && badEffectIds.length) {
          try {
            await doc.deleteEmbeddedDocuments("ActiveEffect", badEffectIds);
            report.strippedEffects += badEffectIds.length;
          } catch (e) { report.errors++; _origWarn(`effect strip failed on ${doc.uuid}`, e); }
        }
      }

      if (wasLocked) try { await pack.configure({ locked: true }); } catch {}
    }

    // ---------- Backup + report ----------
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const fname = `quarantine-${APPLY ? "applied" : "dryrun"}-${ts}.json`;
    try {
      try { await FilePicker.browse("data", BACKUP_DIR); }
      catch { await FilePicker.createDirectory("data", BACKUP_DIR); }
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const file = new File([blob], fname, { type: "application/json" });
      await FilePicker.upload("data", BACKUP_DIR, file, {}, { notify: false });
    } catch (e) { _origError("backup write failed", e); console.log(report); }

    _origWarn("[quarantine] full report", report);

    const itemCount = report.invalidItems.length;
    const effCount  = report.invalidEffects.length;
    const top10 = report.invalidItems.slice(0, 10).map(x => `<li>${x.name} <code>(${x.type})</code></li>`).join("");

    ChatMessage.create({ whisper: [game.user.id], content: `
      <h3>Quarantine ${APPLY ? "Applied" : "Dry Run"}</h3>
      <ul>
        <li>Invalid-typed items found: <b>${itemCount}</b></li>
        <li>Invalid-typed effects found: <b>${effCount}</b></li>
        <li>Items deleted: <b>${report.deletedItems}</b></li>
        <li>Effects stripped: <b>${report.strippedEffects}</b></li>
        <li>Errors: <b>${report.errors}</b></li>
      </ul>
      <p>Backup: <code>${BACKUP_DIR}/${fname}</code></p>
      ${itemCount ? `<p><b>Sample (first 10 items):</b></p><ul>${top10}</ul>` : ""}
      ${!APPLY && (itemCount || effCount) ? `<p><b>To apply:</b> change <code>APPLY=false</code> → <code>true</code> at the top of the macro and re-run.</p>` : ""}
    ` });
    ui.notifications.info(`Quarantine ${APPLY ? "applied" : "dry-run"} — items:${itemCount}, effects:${effCount}.`);
  } finally {
    console.warn = _origWarn;
    console.error = _origError;
  }
})();
