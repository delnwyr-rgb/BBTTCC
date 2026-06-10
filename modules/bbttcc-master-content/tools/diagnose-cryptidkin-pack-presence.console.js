// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Diagnose: which Cryptidkin items are in the live pack?
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Read-only.
// Reports presence/absence of each Phase-3 Cryptidkin tier feat in the live
// LevelDB pack. The /packs/ancestries/ directory has stray JSON source files
// alongside the .ldb store; Foundry only loads what's in LevelDB.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const EXPECTED = [
    "cryptidkin-chupacabra-blood-drinker",          // tier1
    "cryptidkin-chupacabra-skittering-night-feeder",// tier4
    "cryptidkin-furrykin-folklore-echo",            // tier4
    "cryptidkin-furrykin-pack-tongue",              // tier2
    "cryptidkin-jackalope-cant-catch-me",           // tier2
    "cryptidkin-jackalope-crossroads-hare",         // tier4
    "cryptidkin-jackalope-startle-reflex",          // tier1
  ];

  const present = new Set();
  const matchedPacks = new Map(); // ident -> pack id

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
    } catch (e) {
      console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`);
    }
  }

  console.log("=== Cryptidkin Phase 3 batch — pack presence ===");
  for (const id of EXPECTED) {
    const here = present.has(id);
    const where = matchedPacks.get(id) ?? "—";
    console.log(`  ${here ? "✓ PRESENT" : "✗ MISSING"}  ${id}  ${here ? "[" + where + "]" : ""}`);
  }
  const missing = EXPECTED.filter((i) => !present.has(i));
  ui.notifications[missing.length ? "warn" : "info"](
    missing.length
      ? `Cryptidkin diagnosis: ${present.size}/${EXPECTED.length} present, ${missing.length} MISSING from live packs.`
      : `Cryptidkin diagnosis: all ${EXPECTED.length} present.`
  );
  console.log("DONE");
})();
