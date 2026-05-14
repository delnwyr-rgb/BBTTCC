// BBTTCC — Cleanup zombie ancestry items (retired sub-heritages)
// ─────────────────────────────────────────────────────────────────────────────
// Searches every Item pack for items whose name matches a CONFIRMED-retired
// ancestry sub-heritage pattern, lists them (DRY_RUN), and on a second run
// with DRY_RUN=false, deletes them.
//
// Confirmed retired patterns (per Ancestry v2.0 canon and 2026-04-28 audits):
//   - "Furrykin (Leporid):*"     (user-confirmed retired)
//   - "Cryptidkin (Chupacabra):*"
//   - "Cryptidkin (Jackalope):*"
//   - "Hex-Giant *"              (Menhirkin replaced this top-level)
//
// NOT included (need separate human review before deletion):
//   - Furrykin (Vulpin/Felid/Ursid) — were "not found" in bulk-author so
//     don't exist in live packs anyway. Only stale JSON sources remain.
//   - Human (Erectus), Oldenborn (Ember-Touched) — same situation.
//   - Any other sub-heritage. Don't over-delete.
//
// SAFETY: DRY_RUN=true by default. Read the report carefully before flipping.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;     // ← flip to false ONLY after reviewing the dry-run output

// Each pattern is matched as a name-prefix or substring.
const ZOMBIE_PATTERNS = [
  { match: /^Furrykin \(Leporid\)/,    note: "retired Furrykin sub-heritage" },
  { match: /^Cryptidkin \(Chupacabra\)/, note: "retired Cryptidkin sub-heritage" },
  { match: /^Cryptidkin \(Jackalope\)/,  note: "retired Cryptidkin sub-heritage" },
  { match: /^Hex-Giant /,              note: "retired species (Menhirkin replaced)" },
  { match: /^Hex-Giant$/,              note: "retired species root" }
];

const matches = [];

for (const pack of game.packs.values()) {
  if (pack.documentName !== "Item") continue;
  let idx;
  try { idx = await pack.getIndex({ fields: ["name"] }); }
  catch (e) { console.warn("[zombie-cleanup] index failed for", pack.collection, e); continue; }

  for (const entry of idx) {
    for (const p of ZOMBIE_PATTERNS) {
      if (p.match.test(entry.name)) {
        matches.push({
          pack: pack.collection,
          packLocked: pack.locked,
          itemId: entry._id,
          name: entry.name,
          reason: p.note
        });
        break;
      }
    }
  }
}

const deleted = [];
const errors = [];

if (!DRY_RUN && matches.length) {
  // Group by pack so we can deleteEmbeddedDocuments in batches per pack
  const byPack = new Map();
  for (const m of matches) {
    if (!byPack.has(m.pack)) byPack.set(m.pack, []);
    byPack.get(m.pack).push(m);
  }
  for (const [packId, items] of byPack) {
    try {
      const pack = game.packs.get(packId);
      if (pack.locked) {
        try { await pack.configure({ locked: false }); }
        catch (e) { console.warn("[zombie-cleanup] could not unlock", packId, e); }
      }
      const ids = items.map(i => i.itemId);
      const cls = pack.documentClass ?? Item;
      await cls.deleteDocuments(ids, { pack: packId });
      for (const i of items) deleted.push(`${i.name} (${packId})`);
    } catch (err) {
      errors.push(`${packId}: ${err.message}`);
      console.error("[zombie-cleanup]", packId, err);
    }
  }
}

const lines = [
  `=== Zombie Ancestry Cleanup (${DRY_RUN ? "DRY-RUN — no deletions" : "APPLIED"}) ===`,
  `Patterns scanned: ${ZOMBIE_PATTERNS.length}`,
  `Matches found:    ${matches.length}`,
  ""
];
if (matches.length) {
  lines.push("Matches:");
  for (const m of matches) {
    const status = DRY_RUN ? "[would delete]" : (deleted.find(d => d.startsWith(m.name)) ? "✓ deleted" : "✗ ERROR");
    lines.push(`  ${status}  ${m.name}  (${m.pack}, ${m.reason})`);
  }
}
if (errors.length) {
  lines.push("", "Errors:");
  for (const e of errors) lines.push(`  ✗ ${e}`);
}
if (DRY_RUN) {
  lines.push("", "→ This was a DRY RUN. To delete, change DRY_RUN to false at the top of the macro and re-run.");
}

console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.78rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();
