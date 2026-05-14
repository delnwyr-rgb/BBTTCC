// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Ember Cryptidkin/Jackalope audit
// ─────────────────────────────────────────────────────────────────────────────
// Read-only. Paste into F12 (any world, but intended for ember).
// Reports: every Cryptidkin/Jackalope item by name + identifier + pack,
// duplicate detection (same identifier in multiple places, OR multiple items
// with similar names), Horns of Bad Luck presence in items pack, ItemGrant
// advancement on the Jackalope heritage, actor-side state for Jackalope
// characters (does Vince have Horns? Stamped flags?).
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const log = (...a) => console.log(...a);
  const NS = "============================================";

  // 1. Walk every bbttcc-* Item pack — gather all Cryptidkin/Jackalope items
  const cryptidByIdent = new Map();   // identifier → [{name, pack, _id}]
  const cryptidByName  = new Map();   // name → [{ident, pack, _id}]
  const jackalopeRelated = [];
  const hornsResults = [];
  let heritageDoc = null;
  let heritagePack = null;

  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    let docs;
    try { docs = await pack.getDocuments(); }
    catch (e) { console.warn(`pack walk failed: ${pack.metadata.id}: ${e.message}`); continue; }
    for (const doc of docs) {
      const id   = doc.system?.identifier ?? "";
      const name = doc.name ?? "";
      const looksCryptid = /cryptidkin/i.test(id) || /cryptidkin/i.test(name);
      const looksJackalope = /jackalope/i.test(id) || /jackalope/i.test(name);
      const looksHorns = /horns?[_-]of[_-]bad[_-]luck|horns_of_bad_luck/i.test(id) || /horns of bad luck/i.test(name);

      if (looksCryptid) {
        if (!cryptidByIdent.has(id)) cryptidByIdent.set(id, []);
        cryptidByIdent.get(id).push({ name, pack: pack.metadata.id, docId: doc.id });
        if (!cryptidByName.has(name)) cryptidByName.set(name, []);
        cryptidByName.get(name).push({ ident: id, pack: pack.metadata.id, docId: doc.id });
      }
      if (looksJackalope) {
        jackalopeRelated.push({ name, ident: id, type: doc.type, pack: pack.metadata.id, docId: doc.id });
      }
      if (looksHorns) {
        hornsResults.push({ name, ident: id, type: doc.type, pack: pack.metadata.id, docId: doc.id, uuid: doc.uuid });
      }
      if (id === "cryptidkin_jackalope_heritage") {
        heritageDoc = doc;
        heritagePack = pack;
      }
    }
  }

  log("\n" + NS + "\n  CRYPTIDKIN ITEMS BY IDENTIFIER\n" + NS);
  for (const [ident, list] of [...cryptidByIdent.entries()].sort()) {
    if (list.length > 1) {
      log(`  ⚠ DUPLICATE identifier "${ident}":`);
      for (const r of list) log(`      [${r.pack}] ${r.name}  (docId: ${r.docId})`);
    } else {
      log(`  ✓ ${ident}  →  [${list[0].pack}] ${list[0].name}`);
    }
  }

  // Items with no identifier or with similar names
  log("\n" + NS + "\n  CRYPTIDKIN ITEMS BY NAME (looking for name dupes)\n" + NS);
  let nameDupeCount = 0;
  for (const [name, list] of [...cryptidByName.entries()].sort()) {
    if (list.length > 1) {
      nameDupeCount++;
      log(`  ⚠ DUPLICATE name "${name}":`);
      for (const r of list) log(`      [${r.pack}] ident="${r.ident}"  (docId: ${r.docId})`);
    }
  }
  if (!nameDupeCount) log("  (no name duplicates)");

  // 2. Jackalope-related items (broader net)
  log("\n" + NS + "\n  JACKALOPE-RELATED ITEMS\n" + NS);
  for (const r of jackalopeRelated.sort((a,b) => a.ident.localeCompare(b.ident))) {
    log(`  · [${r.type}] "${r.name}"  ident="${r.ident}"  in [${r.pack}]`);
  }

  // 3. Horns of Bad Luck
  log("\n" + NS + "\n  HORNS OF BAD LUCK\n" + NS);
  if (hornsResults.length === 0) {
    log("  ✗ Not found in any bbttcc-* pack.");
  } else {
    for (const r of hornsResults) {
      log(`  ✓ [${r.type}] "${r.name}"  ident="${r.ident}"`);
      log(`     pack: ${r.pack}  docId: ${r.docId}`);
      log(`     uuid: ${r.uuid}`);
    }
  }

  // 4. Jackalope heritage advancement
  log("\n" + NS + "\n  JACKALOPE HERITAGE → ITEMGRANT ROWS\n" + NS);
  if (!heritageDoc) {
    log("  ✗ Heritage item not found (identifier 'cryptidkin_jackalope_heritage')");
  } else {
    log(`  Found heritage: "${heritageDoc.name}" in [${heritagePack.metadata.id}]`);
    const advRaw = heritageDoc.system?.advancement ?? {};
    const advRows = Array.isArray(advRaw) ? advRaw : Object.values(advRaw);
    log(`  Total advancement rows: ${advRows.length}`);
    for (const row of advRows) {
      if (!row || row.type !== "ItemGrant") continue;
      const items = row.configuration?.items ?? [];
      log(`    · ItemGrant "${row.title ?? "(untitled)"}" level=${row.level ?? 0}`);
      for (const it of items) log(`        - ${it.uuid}`);
    }
  }

  // 5. Actor-side audit — every actor with Jackalope heritage
  log("\n" + NS + "\n  ACTORS WITH JACKALOPE HERITAGE\n" + NS);
  let jackalopeActors = 0;
  for (const actor of game.actors) {
    const heritage = actor.items.find(i => i.system?.identifier === "cryptidkin_jackalope_heritage");
    if (!heritage) continue;
    jackalopeActors++;
    const horns = actor.items.find(i => i.system?.identifier === "horns_of_bad_luck");
    const startle = actor.items.find(i => i.system?.identifier === "cryptidkin-jackalope-startle-reflex");
    log(`  · Actor: "${actor.name}"`);
    log(`      heritage: ✓ "${heritage.name}"`);
    log(`      Horns of Bad Luck: ${horns ? `✓ "${horns.name}" (id: ${horns.id})` : "✗ MISSING"}`);
    log(`      Startle Reflex: ${startle ? `✓ "${startle.name}" (id: ${startle.id})` : "(not present)"}`);
    // Report any other Cryptidkin items the actor has, in case of dupes
    const allCryptid = actor.items.filter(i => /cryptidkin/i.test(i.system?.identifier ?? "") || /cryptidkin/i.test(i.name ?? ""));
    log(`      All Cryptidkin items on actor: ${allCryptid.length}`);
    for (const it of allCryptid) log(`         - "${it.name}" ident="${it.system?.identifier ?? "(unset)"}"`);
  }
  if (!jackalopeActors) log("  (no actors carry the Jackalope heritage)");

  ui.notifications.info("Cryptidkin/Jackalope audit complete — see F12 console.");
  log("\nDONE\n");
})();
