// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Phase 6 survey: caster discipline class-features
// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 per-use callouts touched 12 RFI subclass items in the classes pack
// but did NOT separately sweep the four caster-discipline class-feature ladders
// shipped by `update-caster-discipline-pilot.macro.js`:
//
//   • Cosmic Linguist  — Initiation 1 / 6 / 11 / 16 features (Reach economy)
//   • Wyrdlens Adept   — Tier 1 / 2 / 3 / 4 features (Misfire band)
//   • Dreamwalker      — Tier 1 / 2 / 3 / 4 features (Clarity pool)
//   • Pactkeeper       — Initiation 1 / 6 / 11 / 16 features (Upkeep / concurrency)
//
// Each path's class doc includes a 5-point Discipline budget pill plus 4
// class-feature entries; the per-use abilities buried inside ("1/scene",
// "1/long rest (Soma Break)", "as a reaction", etc.) need callout treatment so
// they surface on the sheet.
//
// USAGE
//   1. Open F12 console as GM.
//   2. Paste this whole file. Hit Enter.
//   3. Copy the printed JSON blob (`globalThis.__phase6Survey`) back to Claude.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // Pack to walk
  const PACK_ID = "bbttcc-master-content.classes";

  // Discipline class identifiers / names — match generously by both
  const DISCIPLINE_NAMES = [
    "Cosmic Linguist",
    "Wyrdlens Adept",
    "Dreamwalker",
    "Pactkeeper",
  ];
  const DISCIPLINE_IDENT_PREFIXES = [
    "cosmic_linguist",
    "cosmic-linguist",
    "wyrdlens",
    "dreamwalker",
    "pactkeeper",
  ];

  const PER_USE_CHECKS = [
    ["1/scene",     /\b1\s*\/\s*scene|once per scene/i],
    ["1/SB",        /\b1\s*\/\s*(soma\s*break|sb)|once per (soma break|long rest)|per long rest/i],
    ["1/short",     /\b1\s*\/\s*(short rest|sr)|once per short rest/i],
    ["1/turn",      /\b1\s*\/\s*(strategic\s*turn|turn)|per (strategic\s*)?turn|per round/i],
    ["1/scenario",  /1\s*\/\s*scenario|once per scenario/i],
    ["1/round",     /\b1\s*\/\s*round|once per round/i],
    ["expend",      /\bexpend|spend a|spend [0-9]/i],
    ["reaction",    /\bas a reaction\b/i],
    ["trigger",     /\bwhen you (crit|succeed|fail|are hit|drop to)/i],
    ["stance",      /\bstance|while.*held|signature mode/i],
    ["passive",     /\bproficiency in|skill rank \+|max(imum)?\s+is\s+\+|\+\d+ to/i],
  ];

  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    console.error(`Pack ${PACK_ID} not found.`);
    return;
  }
  const idx = await pack.getIndex({ fields: ["name", "type"] });

  const matches = [];
  for (const e of idx) {
    const doc = await pack.getDocument(e._id);
    const ident = (doc.system?.identifier ?? "").toLowerCase();
    const nameMatch = DISCIPLINE_NAMES.some(d =>
      doc.name === d || doc.name.startsWith(`${d}:`) || doc.name.startsWith(`${d} —`)
    );
    const identMatch = DISCIPLINE_IDENT_PREFIXES.some(p => ident.startsWith(p));
    // Walk all docs whose ident starts with a discipline prefix (catches
    // class-feature children) plus the class docs themselves by name.
    if (!nameMatch && !identMatch) continue;

    const desc = doc.system?.description?.value ?? "";
    const textOnly = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const markers = [];
    for (const [tag, re] of PER_USE_CHECKS) {
      if (re.test(textOnly)) markers.push(tag);
    }
    const alreadySurfaced = /data-ft-per-use=/.test(desc);

    matches.push({
      name: doc.name,
      identifier: doc.system?.identifier ?? "",
      type: doc.type,
      markers,
      alreadySurfaced,
      descTail: textOnly.slice(-1100),
    });
  }

  // Group by discipline for readability
  const grouped = {};
  for (const m of matches) {
    const key = DISCIPLINE_IDENT_PREFIXES.find(p => m.identifier.toLowerCase().startsWith(p))
             ?? DISCIPLINE_NAMES.find(d => m.name === d || m.name.startsWith(`${d}:`) || m.name.startsWith(`${d} —`))
             ?? "_other";
    (grouped[key] ??= []).push(m);
  }

  console.log(`\n%c=== ${PACK_ID}: caster-discipline matches ===`, "color:#88ccff;font-weight:bold");
  for (const [key, items] of Object.entries(grouped)) {
    const flagged = items.filter(i => i.markers.length && !i.alreadySurfaced);
    console.groupCollapsed(`${key} — ${items.length} matched, ${flagged.length} flagged`);
    for (const item of items) {
      const tag = item.alreadySurfaced ? "[surfaced]" : (item.markers.length ? `[${item.markers.join(",")}]` : "[—]");
      console.log(`  ${item.name} ${tag}`);
      console.log(`    id=${item.identifier} type=${item.type}`);
      console.log(`    ...${item.descTail}`);
    }
    console.groupEnd();
  }

  console.log("\n%c=== FULL JSON BLOB (copy this) ===", "color:#88ff88;font-weight:bold");
  console.log(grouped);
  globalThis.__phase6Survey = { pack: PACK_ID, grouped };
  console.log("\nAlso stored at globalThis.__phase6Survey for easy copy.");
})();
