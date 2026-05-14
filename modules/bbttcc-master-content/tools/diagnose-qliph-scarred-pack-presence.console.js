// Qliph-Scarred pack presence diagnostic. Read-only. Paste in F12 as GM.
(async () => {
  const EXPECTED = [
    "qliph_scarred_chthonic_tier1",
    "qliph_scarred_diabolic_tier1",
    "qliph_scarred_husk_tier1",
  ];
  const present = new Set();
  const matchedPacks = new Map();
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        const id = doc.system?.identifier ?? "";
        if (EXPECTED.includes(id)) {
          present.add(id);
          if (!matchedPacks.has(id)) matchedPacks.set(id, pack.metadata.id);
        }
      }
    } catch (e) { console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`); }
  }
  console.log("=== Qliph-Scarred Phase 3 batch — pack presence ===");
  for (const id of EXPECTED) {
    const here = present.has(id);
    console.log(`  ${here ? "✓ PRESENT" : "✗ MISSING"}  ${id}  ${here ? "[" + matchedPacks.get(id) + "]" : ""}`);
  }
  const missing = EXPECTED.filter((i) => !present.has(i));
  ui.notifications[missing.length ? "warn" : "info"](
    missing.length
      ? `Qliph-Scarred: ${present.size}/${EXPECTED.length} present, ${missing.length} MISSING.`
      : `Qliph-Scarred: all ${EXPECTED.length} present.`
  );
  console.log("DONE");
})();
