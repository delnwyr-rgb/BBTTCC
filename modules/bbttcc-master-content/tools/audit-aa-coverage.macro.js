// audit-aa-coverage.macro.js — RUN IN-WORLD (GM). READ-ONLY (changes nothing).
// Ground-truth report of Automated-Animations coverage per compendium in the LIVE world,
// so we can see what is already animated vs. what is still bare — independent of the
// (often stale) repo packs. Lists the names LACKING an AA flag so you can eyeball candidates.
//
// By default audits the Bad Eden content packs we've been working through. Set PACK_IDS to
// a custom list, or leave null to auto-scan EVERY Item-type compendium in the world.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const PACK_IDS = [
    "bbttcc-character-options.character-archetypes",
    "bbttcc-character-options.crew-types",
    "bbttcc-character-options.occult-associations",
    "bbttcc-character-options.political-affiliations",
    "bbttcc-character-options.enlightenment-levels",
    "bbttcc-character-options.sephirothic-alignments",
    "bbttcc-master-content.classes",
    "bbttcc-master-content.ancestries",
    "bbttcc-master-content.items",
    "bbttcc-master-content.doctrines",
    "bbttcc-master-content.courtly-secrets",
    "bbttcc-master-content.npc-abilities",
    "bbttcc-master-content.vehicles",
    "fourththing.starter-manifestations",
    "fourththing.surge-abilities",
  ];
  // null → auto-scan every Item compendium instead of the curated list above
  const AUTO_SCAN_ALL = false;
  const SHOW_LACKING = true;   // print the names of items WITHOUT an AA flag
  const MAX_LIST = 60;         // cap per-pack name list in console

  const packs = (AUTO_SCAN_ALL
      ? game.packs.filter(p => p.metadata?.type === "Item")
      : PACK_IDS.map(id => game.packs.get(id)).filter(Boolean));

  const rows = [];
  const detail = {};
  for (const pack of packs) {
    let docs;
    try { docs = await pack.getDocuments(); } catch (e) { rows.push({ pack: pack.collection, total: "ERR", aa: "-", pct: "-" }); continue; }
    const items = docs.filter(d => !d.folder || true);
    const withAA = items.filter(d => d.flags?.autoanimations);
    const lacking = items.filter(d => !d.flags?.autoanimations);
    // "activatable-ish" heuristic among the bare ones (has activities / manifestation / per-use)
    const activatable = lacking.filter(d => {
      const s = d.system || {};
      const acts = s.activities && typeof s.activities === "object" ? Object.values(s.activities).filter(a => a && a.type && a.type !== "passive").length : 0;
      return acts > 0 || s.manifestation || (s.activation?.type && s.activation.type !== "none") || (s.damage && (s.damage.formula || s.damage.parts?.length));
    });
    rows.push({
      pack: pack.collection.replace(/^.*\./, ""),
      total: items.length,
      aa: withAA.length,
      pct: items.length ? Math.round(100 * withAA.length / items.length) + "%" : "-",
      bare: lacking.length,
      bareActive: activatable.length,
    });
    detail[pack.collection] = { lacking: lacking.map(d => d.name), bareActive: activatable.map(d => d.name) };
  }

  console.log("=== AA COVERAGE AUDIT (live world, read-only) ===");
  console.table(rows);
  if (SHOW_LACKING) {
    for (const [id, d] of Object.entries(detail)) {
      if (!d.lacking.length) { console.log(`\n${id}: ✅ fully covered`); continue; }
      console.log(`\n${id} — ${d.bareActive.length} bare-but-activatable (of ${d.lacking.length} bare):`);
      console.log("  " + (d.bareActive.slice(0, MAX_LIST).join(", ") || "(none)") + (d.bareActive.length > MAX_LIST ? ` …+${d.bareActive.length - MAX_LIST} more` : ""));
    }
  }
  const tot = rows.reduce((a, r) => a + (Number(r.total) || 0), 0);
  const aa = rows.reduce((a, r) => a + (Number(r.aa) || 0), 0);
  ui.notifications.info(`AA audit: ${aa}/${tot} items animated across ${rows.length} packs. Full table + bare-item names in console (F12).`);
})();
