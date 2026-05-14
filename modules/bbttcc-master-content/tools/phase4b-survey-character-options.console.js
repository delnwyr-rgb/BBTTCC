// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Phase 4b survey: missing character-options packs
// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 only swept 3 of the 4 narrative character-options packs
// (character-archetypes, crew-types, occult-associations). This survey covers
// the three that were missed:
//
//   • bbttcc-character-options.sephirothic-alignments
//   • bbttcc-character-options.enlightenment-levels
//   • bbttcc-character-options.political-affiliations
//
// Output mirrors `dump-character-options-packs.console.js` so the JSON blob
// can be pasted back to Claude to author per-use callout tables (idempotent
// stampers in the same shape as `append-per-use-callouts-phase4.console.js`).
//
// USAGE
//   1. Open F12 console as GM.
//   2. Paste this whole file. Hit Enter.
//   3. Right-click the printed array → "Copy object". Paste back to Claude.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACKS = [
    "bbttcc-character-options.sephirothic-alignments",
    "bbttcc-character-options.enlightenment-levels",
    "bbttcc-character-options.political-affiliations",
  ];

  const PER_USE_CHECKS = [
    ["1/scene",     /\b1\s*\/\s*scene|once per scene/i],
    ["1/SB",        /\b1\s*\/\s*(soma\s*break|sb)|once per (soma break|long rest)|per long rest/i],
    ["1/short",     /\b1\s*\/\s*(short rest|sr)|once per short rest/i],
    ["1/turn",      /\b1\s*\/\s*(strategic\s*turn|turn)|per (strategic\s*)?turn|per round/i],
    ["1/scenario",  /1\s*\/\s*scenario|once per scenario/i],
    ["expend",      /\bexpend|spend a|spend [0-9]/i],
    ["trigger",     /\bwhen you (crit|succeed|fail|are hit|drop to)|as a reaction\b/i],
    ["bank",        /\bbank|recharge|regain when/i],
    // Phase-4-style passive markers (so we can also surface buried passives)
    ["resist",      /\bresist(ance)?\s+(to\s+)?(fire|cold|lightning|thunder|sephir|qliph|kinetic|energy|necr|psychic|radiant)/i],
    ["reroll",      /\breroll|advantage on/i],
    ["surprise",    /\bsurprise|cannot be surprised|immune to surprise/i],
    ["vision",      /\bdarkvision|tremorsense|blindsight|low.?light/i],
    ["movement",    /\bdifficult terrain|walk speed|movement speed|\+\d+\s*ft/i],
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
      const textOnly = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

      const markers = [];
      for (const [tag, re] of PER_USE_CHECKS) {
        if (re.test(textOnly)) markers.push(tag);
      }

      // Already-surfaced sentinel — skip when authoring stamper
      const alreadySurfaced = /data-ft-per-use=/.test(desc);

      items.push({
        name: doc.name,
        identifier: doc.system?.identifier ?? "",
        type: doc.type,
        markers,
        alreadySurfaced,
        descTail: textOnly.slice(-900),
      });
    }
    results.push({ pack: packId, count: items.length, items });
    const flagged = items.filter(i => i.markers.length && !i.alreadySurfaced).length;
    console.log(`  ${packId}: ${items.length} items, ${flagged} flagged for surfacing`);
  }

  console.log("\n%c=== ITEMS WITH MARKERS (excl. already-surfaced) ===", "color:#ffaa00;font-weight:bold");
  for (const pack of results) {
    if (pack.error) continue;
    const flagged = pack.items.filter(i => i.markers.length && !i.alreadySurfaced);
    if (!flagged.length) {
      console.log(`  ${pack.pack}: (none flagged)`);
      continue;
    }
    console.groupCollapsed(`${pack.pack} (${flagged.length})`);
    for (const item of flagged) {
      console.log(`  ${item.name} [${item.markers.join(",")}]`);
      console.log(`    id=${item.identifier} type=${item.type}`);
      console.log(`    ...${item.descTail}`);
    }
    console.groupEnd();
  }

  console.log("\n%c=== FULL JSON BLOB (copy this) ===", "color:#88ff88;font-weight:bold");
  console.log(results);
  globalThis.__phase4bSurvey = results;
  console.log("\nAlso stored at globalThis.__phase4bSurvey for easy copy.");
})();
