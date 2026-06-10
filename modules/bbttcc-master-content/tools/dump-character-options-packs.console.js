// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Dump bbttcc-character-options packs for buried per-use survey
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM) and hit Enter.
// Walks 4 packs and prints each item's name + identifier + description tail
// (last ~700 chars), so we can identify buried per-use abilities ("once per
// scene", "1/long rest", etc.) without needing access to the raw LevelDB.
//
// Output: a single console.log of an array of objects. Copy the resulting JSON
// blob (right-click in console → "Save as..." or "Copy object") and paste back
// to Claude.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACKS = [
    "bbttcc-character-options.character-archetypes",
    "bbttcc-character-options.crew-types",
    "bbttcc-character-options.occult-associations",
    "bbttcc-character-options.sephirothic-alignments",
  ];

  const results = [];
  for (const packId of PACKS) {
    const pack = game.packs.get(packId);
    if (!pack) {
      console.warn(`Pack ${packId} not found.`);
      results.push({ pack: packId, error: "not found" });
      continue;
    }
    const idx = await pack.getIndex({ fields: ["name", "type"] });
    const items = [];
    for (const e of idx) {
      const doc = await pack.getDocument(e._id);
      const desc = doc.system?.description?.value ?? "";
      // Strip HTML tags for readability; cap at 700 chars so output stays
      // manageable. Keeping the full HTML would blow up the console buffer.
      const textOnly = desc.replace(/<[^>]+>/g, " ")
                            .replace(/\s+/g, " ")
                            .trim();
      // Heuristic: does this look per-use? Highlight matching items.
      const perUseMarkers = [];
      const checks = [
        ["1/scene", /\b1\s*\/\s*scene|once per scene/i],
        ["1/SB",    /\b1\s*\/\s*(soma\s*break|sb)|once per (soma break|long rest)|per long rest/i],
        ["1/short", /\b1\s*\/\s*(short rest|sr)|once per short rest/i],
        ["1/turn",  /\b1\s*\/\s*(strategic\s*turn|turn)|per (strategic\s*)?turn|per round/i],
        ["1/scenario", /1\s*\/\s*scenario|once per scenario/i],
        ["expend", /\bexpend|spend a|spend [0-9]/i],
        ["trigger", /\bwhen you (crit|succeed|fail|are hit|drop to)|as a reaction\b/i],
        ["bank",    /\bbank|recharge|regain when/i],
      ];
      for (const [tag, re] of checks) {
        if (re.test(textOnly)) perUseMarkers.push(tag);
      }
      items.push({
        name: doc.name,
        identifier: doc.system?.identifier ?? "",
        type: doc.type,
        markers: perUseMarkers,
        descTail: textOnly.slice(-700)
      });
    }
    results.push({ pack: packId, count: items.length, items });
    console.log(`  ${packId}: ${items.length} items, ${items.filter(i => i.markers.length).length} with per-use markers`);
  }

  // Summary table for quick visual scan
  console.log("\n%c=== ITEMS WITH PER-USE MARKERS ===", "color:#ffaa00;font-weight:bold");
  for (const pack of results) {
    if (pack.error) continue;
    const flagged = pack.items.filter(i => i.markers.length);
    if (!flagged.length) {
      console.log(`  ${pack.pack}: (none flagged)`);
      continue;
    }
    console.groupCollapsed(`${pack.pack} (${flagged.length} flagged)`);
    for (const item of flagged) {
      console.log(`  ${item.name} [${item.markers.join(",")}]`);
      console.log(`    id=${item.identifier} type=${item.type}`);
      console.log(`    ...${item.descTail}`);
    }
    console.groupEnd();
  }

  // Big payload at end — copy this object back to Claude
  console.log("\n%c=== FULL DUMP (copy this object) ===", "color:#00aaff;font-weight:bold");
  console.log(results);
  // Also stash on window for easy copying
  window.__bbttccDumpCharOptions = results;
  console.log("Stashed at window.__bbttccDumpCharOptions — right-click in console → Copy object.");
  console.log("DONE");
})();
