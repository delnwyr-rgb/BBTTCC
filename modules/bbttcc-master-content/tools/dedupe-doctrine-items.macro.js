// Bad Eden — DEDUPE doctrine items on every faction (2026-09-21)
// The baseline package stamped some factions more than once (the Errata held 4× every strategic). One item per
// kind+key survives (the oldest); the rest are deleted. Dry list, then a confirm dialog.
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const isFaction = a => !!a.flags?.["bbttcc-factions"]?.isFaction;
  const plan = [];
  for (const F of game.actors.contents.filter(isFaction)) {
    const seen = new Map(); const dupes = [];
    for (const it of F.items.contents.filter(i => i.flags?.bbttcc?.kind && i.flags?.bbttcc?.key).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
      const k = `${it.flags.bbttcc.kind}:${it.flags.bbttcc.key}`; if (seen.has(k)) dupes.push(it); else seen.set(k, it);
    }
    if (dupes.length) plan.push({ faction: F, dupes });
  }
  console.table(plan.map(p => ({ faction: p.faction.name, duplicates: p.dupes.length, keys: [...new Set(p.dupes.map(d => d.flags.bbttcc.key))].join(", ") })));
  if (!plan.length) return ui.notifications?.info("Doctrine items: no duplicates.");
  const total = plan.reduce((n, p) => n + p.dupes.length, 0);
  const yes = await Dialog.confirm({ title: "Dedupe doctrine items", content: `<p>Delete <b>${total}</b> duplicate doctrine item(s) across <b>${plan.length}</b> faction(s)? One of each survives (table in the console).</p>` });
  if (!yes) return;
  for (const p of plan) await p.faction.deleteEmbeddedDocuments("Item", p.dupes.map(d => d.id));
  ui.notifications?.info(`Removed ${total} duplicate doctrine item(s).`);
})();
