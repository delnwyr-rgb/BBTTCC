// Bad Eden — Load Sparks Pack from JSON sources (Phase A of B3, 2026-05-09)
// ─────────────────────────────────────────────────────────────────────────────
// Reads the 30 JSON sources at modules/bbttcc-tikkun/packs-source/sparks/ and
// creates the corresponding Item documents in the `bbttcc-tikkun.sparks`
// compendium pack. Idempotent: items keyed by stable _id; existing items are
// updated, missing items are created.
//
// Run once after first install or after editing _generate.mjs + re-running it.
//
// Schema reference: spark item type in fourththing/template.json `Item.spark`.
// Plan: project_tikkun_revisit_plan_2026_05_09.md
//
// DRY_RUN = true to preview without writing.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID    = "bbttcc-tikkun.sparks";
const SOURCE_DIR = "modules/bbttcc-tikkun/packs-source/sparks";
const DRY_RUN    = false;

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(
    `Pack ${PACK_ID} not declared. Reload Foundry after the bbttcc-tikkun module.json adds the pack entry.`
  );
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error(`Cannot unlock ${PACK_ID}: ${e.message}`); }
  }

  // Read source dir via Foundry's FilePicker.browse — works for module-relative
  // paths and is already permissioned for GMs.
  let listing;
  try {
    listing = await foundry.applications.apps.FilePicker.implementation.browse("data", SOURCE_DIR);
  } catch (e) {
    return ui.notifications?.error(
      `Cannot list ${SOURCE_DIR}: ${e.message}. Check the path / regenerate sources.`
    );
  }
  const jsonFiles = (listing?.files ?? []).filter(p => p.endsWith(".json") && !p.endsWith("_generate.mjs"));
  if (!jsonFiles.length) return ui.notifications?.warn(`No spark JSON sources at ${SOURCE_DIR}.`);

  const docs = await pack.getDocuments();
  const existingById = new Map(docs.map(d => [d.id, d]));

  const report = [];
  let created = 0, updated = 0, skipped = 0, failed = 0;

  for (const filePath of jsonFiles) {
    let data;
    try {
      const res = await fetch(filePath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      report.push(`✗ READ FAIL ${filePath}: ${e.message}`);
      failed++;
      continue;
    }
    if (data?.type !== "spark" || !data?._id) {
      report.push(`✗ MALFORMED ${filePath}: missing type=spark or _id`);
      failed++;
      continue;
    }

    // Foundry's _stats.lastModifiedBy must be a real 16-char user id (it
    // references a User document). The generator stamped a free-form string
    // ("spark-generator-2026-05-09") which fails schema validation. Replace
    // it with the running GM's id — always valid, also gives a real audit
    // trail on the items.
    if (data._stats) {
      data._stats.lastModifiedBy = game.user?.id ?? null;
    }

    if (DRY_RUN) {
      const verb = existingById.has(data._id) ? "would UPDATE" : "would CREATE";
      report.push(`= ${verb.padEnd(13)} ${data.name.padEnd(34)} (${data._id})`);
      if (existingById.has(data._id)) updated++; else created++;
      continue;
    }

    try {
      const existing = existingById.get(data._id);
      if (existing) {
        // Strip _id + _stats.createdTime so update doesn't reject; preserve
        // image + name + system fields from source.
        const updateData = foundry.utils.deepClone(data);
        delete updateData._id;
        delete updateData._key;
        if (updateData._stats) delete updateData._stats.createdTime;
        await existing.update(updateData);
        report.push(`✓ UPDATED ${data.name.padEnd(34)} (${data._id})`);
        updated++;
      } else {
        const cls = getDocumentClass("Item");
        const created_doc = await cls.create(data, { pack: PACK_ID, keepId: true });
        if (!created_doc) throw new Error("create returned null");
        report.push(`✓ CREATED ${data.name.padEnd(34)} (${data._id})`);
        created++;
      }
    } catch (e) {
      report.push(`✗ ${data.name.padEnd(34)} ERROR: ${e.message}`);
      failed++;
    }
  }

  console.group("[load-sparks-pack]");
  report.forEach(r => console.log(r));
  console.groupEnd();

  ui.notifications.info(
    `Sparks pack load${DRY_RUN ? " (DRY RUN)" : ""}: created ${created}, updated ${updated}, skipped ${skipped}, failed ${failed}.`
  );
})();
