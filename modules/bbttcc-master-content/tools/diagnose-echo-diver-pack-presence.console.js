// Echo-Diver pack presence diagnostic. Read-only. Paste into F12 as GM.
(async () => {
  const EXPECTED = [
    "echo_diver",                    // species container
    "echo_diver_abyssal_tier1",      // Tide Recall
    "echo_diver_empyrean_tier1",     // Stormread
    "echo_diver_tellurian_tier1",    // Stone Patience
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
  console.log("=== Echo-Diver Phase 3 batch — pack presence ===");
  for (const id of EXPECTED) {
    const here = present.has(id);
    const where = matchedPacks.get(id) ?? "—";
    console.log(`  ${here ? "✓ PRESENT" : "✗ MISSING"}  ${id}  ${here ? "[" + where + "]" : ""}`);
  }
  const missing = EXPECTED.filter((i) => !present.has(i));
  ui.notifications[missing.length ? "warn" : "info"](
    missing.length
      ? `Echo-Diver: ${present.size}/${EXPECTED.length} present, ${missing.length} MISSING.`
      : `Echo-Diver: all ${EXPECTED.length} present.`
  );
  console.log("DONE");
})();
