// audit-action-economy-gaps.console.js
//
// Sprint 2026-05-04 — Surface the Hidden Powers (action economy pass).
// Walks every Item in every world Actor + every compendium Item pack and
// flags items whose description says "use your reaction / bonus action /
// action" but which are NOT registered in CHAR_OPT_ABILITIES — meaning the
// ▶ button on the item sheet won't fire any handler and the per-turn pool
// won't be debited.
//
// Usage: paste into the F12 console (GM client). Output is a printed
// table + a copy-paste-friendly stub block for new CHAR_OPT entries.
//
// Wrapped in IIFE per V14 macro scope rules.

(async () => {
  const SUITE = (game.fourththing?._classAutomation ?? {});
  // Snapshot the registered identifier set. Falls back to walking FEATURE_ROUTER
  // since CHAR_OPT_ABILITIES is internal — every CHAR_OPT identifier ends up
  // in FEATURE_ROUTER as "char_opt_lookup" per the ft-class-automation export.
  const registered = new Set();
  if (SUITE.CHAR_OPT_ABILITIES) {
    for (const k of Object.keys(SUITE.CHAR_OPT_ABILITIES)) registered.add(k);
  }
  // Add the legacy identifier set too — features routed via FEATURE_ROUTER
  // map to non-char_opt handlers but are still surfaced.
  if (SUITE.FEATURE_ROUTER) {
    for (const k of Object.keys(SUITE.FEATURE_ROUTER)) registered.add(k);
  }

  const RX = /\b(use your reaction|use your bonus action|use your action|as a reaction|as a bonus action|as an action|use a reaction|use a bonus action|use an action)\b/i;
  const PREFIX_RX = /^(reaction|bonus action|action)\s*[—\-:]/i;

  function describe(it) {
    const text = String(it?.system?.description?.value ?? "").replace(/<[^>]+>/g, " ");
    const id = String(it?.system?.identifier ?? "");
    const hits = [];
    if (PREFIX_RX.test(text.trim())) hits.push("prefix");
    if (RX.test(text)) hits.push("phrase");
    return { text: text.trim().slice(0, 220), id, hits };
  }

  const gaps = [];
  const seen = new Set();

  // ── World actors ────────────────────────────────────────────────────────
  for (const a of game.actors ?? []) {
    for (const it of a.items ?? []) {
      const k = `${it.id}|${a.id}`;
      if (seen.has(k)) continue; seen.add(k);
      const d = describe(it);
      if (!d.hits.length) continue;
      if (d.id && registered.has(d.id)) continue;
      gaps.push({ where: `actor:${a.name}`, name: it.name, type: it.type, identifier: d.id || "(missing)", excerpt: d.text });
    }
  }

  // ── Compendium item packs ───────────────────────────────────────────────
  for (const p of game.packs ?? []) {
    if (p.documentName !== "Item") continue;
    let docs;
    try { docs = await p.getDocuments(); } catch { continue; }
    for (const it of docs) {
      const k = `${p.collection}|${it.id}`;
      if (seen.has(k)) continue; seen.add(k);
      const d = describe(it);
      if (!d.hits.length) continue;
      if (d.id && registered.has(d.id)) continue;
      gaps.push({ where: `pack:${p.collection}`, name: it.name, type: it.type, identifier: d.id || "(missing)", excerpt: d.text });
    }
  }

  console.log(`[ae-audit] ${gaps.length} items with action-cost text but no CHAR_OPT entry:`);
  console.table(gaps);

  console.log(`[ae-audit] ─── copy-paste stub block for new CHAR_OPT_ABILITIES entries ───`);
  for (const g of gaps) {
    if (!g.identifier || g.identifier === "(missing)") continue;
    console.log(`  "${g.identifier}": {\n    type: "soma-break", level: 1,\n    label: ${JSON.stringify(g.name)},\n    body: ${JSON.stringify(g.excerpt)}\n  },`);
  }

  ui.notifications?.info(`AE audit: ${gaps.length} gaps logged to console.`);
})();
