// Human pack presence diagnostic. Read-only.
(async () => {
  const EXPECTED = [
    "human_cro_magnon_tier1",                  // Coalition Tongue
    "human-cro-magnon-pattern-mind",           // Pattern-Mind
    "human-cro-magnon-first-fire",             // Cro-Magnon First Fire
    "human-denisovan-peak_anchor",             // Peak-Anchor
    "human-erectus-first_fire",                // Erectus First Fire
    "human-erectus-trail_sovereign",           // Trail-Sovereign
    "human-florensis-living_folklore",         // Living Folklore
    "human-neanderthal-old_hunt",              // Old Hunt
    "human-neanderthal-protective_instinct",   // Protective Instinct
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
  console.log("=== Human Phase 3 batch — pack presence ===");
  for (const id of EXPECTED) {
    const here = present.has(id);
    console.log(`  ${here ? "✓ PRESENT" : "✗ MISSING"}  ${id}  ${here ? "[" + matchedPacks.get(id) + "]" : ""}`);
  }
  const missing = EXPECTED.filter((i) => !present.has(i));
  ui.notifications[missing.length ? "warn" : "info"](
    missing.length
      ? `Human: ${present.size}/${EXPECTED.length} present, ${missing.length} MISSING.`
      : `Human: all ${EXPECTED.length} present.`
  );
  console.log("DONE");
})();
