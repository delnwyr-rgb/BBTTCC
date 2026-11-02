/**
 * reveal-visited-hexes-2026-11-02.macro.js — HEX VISIBILITY backfill (Dave 2026-11-02). From now on arrival reveals the hex and its
 * neighbours and the quest log reveals where it points (bbttcc-campaign). A world that was played before that still has its visited
 * hexes fogged (the Rotating Chapel stayed hidden after the party stood in it). This reveals every hex the visited ledger
 * (flags.bbttcc-territory.visited) says someone has stood in, plus its neighbours, then lets the quest-log rule run.
 * Idempotent (rerun = 0). DRY_RUN first. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const isHex = (d) => { const f = d?.flags?.["bbttcc-territory"]; return !!(f && (f.isHex || f.kind === "territory-hex" || f.name)); };
  const centre = (d) => { const p = d?.shape?.points || []; if (p.length >= 4) { let x = 0, y = 0; const n = p.length / 2; for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; } return { x: d.x + x / n, y: d.y + y / n }; } return { x: d.x, y: d.y }; };
  const report = []; let changes = 0; const plan = new Map();
  for (const sc of game.scenes) {
    const hexes = sc.drawings.contents.filter(isHex); if (!hexes.length) continue;
    const ups = new Set();
    for (const d of hexes) {
      const v = d.flags["bbttcc-territory"].visited; if (!(v?.any?.n > 0)) continue;
      const c = centre(d); const ds = hexes.filter(x => x.id !== d.id).map(x => [x, Math.hypot(centre(x).x - c.x, centre(x).y - c.y)]);
      const near = Math.min(...ds.map(([, v2]) => v2).filter(v2 => v2 > 0));
      for (const x of [d, ...ds.filter(([, v2]) => v2 > 0 && v2 <= near * 1.2).map(([x]) => x)]) if (x.hidden) ups.add(x.id);
    }
    if (ups.size) { plan.set(sc, [...ups]); changes += ups.size; report.push(`✚ ${sc.name}: ${ups.size} hex(es) revealed (visited + neighbours)`); }
  }
  if (!changes) report.push("· nothing fogged that the party has stood in or beside");
  console.log(`[reveal visited hexes 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__revealVisited = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} hex(es); see console.`);
  for (const [sc, ids] of plan) await sc.updateEmbeddedDocuments("Drawing", ids.map(_id => ({ _id, hidden: false })));
  ui.notifications.info(`Revealed ${changes} hex(es).`);
})();
