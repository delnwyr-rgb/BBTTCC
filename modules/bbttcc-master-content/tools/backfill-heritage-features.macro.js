// Bad Eden — BACKFILL HERITAGE TIER FEATURES on every steward (2026-10-26, ruling AN1b)
// Tier II / III / IV ancestry features (Initiation 5 / 11 / 17) used to be GM drag-only. ft-progression now grants them
// (`applyHeritageFeatures`: walks the steward's heritage folder in bbttcc-master-content.ancestries, imports every feat
// whose stamped `system.prerequisites.level` the steward has reached). This runs it once on every steward already past
// those levels. Idempotent — features already on a sheet are skipped (dedupe by name); nothing is removed; rerun → 0.
// Needs the deployed system (hard reload after `bin/ft-deploy systems/fourththing/ft-progression.js module.js` + restart)
// and the AN_ancestries manifest applied first (the walker reads the stamped levels from the live pack).
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const apply = game.fourththing?._progression?.applyHeritageFeatures;
  if (!apply) return ui.notifications?.error("applyHeritageFeatures not exposed — deploy + restart the system and hard reload.");
  const isHeritage = i => i.type === "feat" && (String(i.flags?.bbttcc?.kind ?? "").toLowerCase() === "heritage" || String(i.system?.identifier ?? "").toLowerCase().endsWith("_heritage"));
  const stewards = game.actors.contents.filter(a => (a.type === "character" || a.type === "npc") && a.items.some(isHeritage));
  const yes = await Dialog.confirm({ title: "Backfill heritage tier features", content: `<p>Run Apply Heritage Features on <b>${stewards.length}</b> actor(s) with a heritage? Features already on a sheet are skipped; nothing is removed.</p><ul style="font-size:.85em;max-height:40vh;overflow:auto">${stewards.map(a => `<li>${a.name} (L${a.system?.details?.level ?? "?"})</li>`).join("")}</ul>` });
  if (!yes) return;
  const rows = [];
  for (const a of stewards) {
    try { const r = await apply(a); rows.push({ steward: a.name, level: a.system?.details?.level, heritage: r.heritage || "", imported: (r.imported || []).join(", ") || "—", skipped: (r.skipped || []).length, error: r.error || "" }); }
    catch (e) { rows.push({ steward: a.name, imported: "", skipped: 0, error: e?.message || String(e) }); }
  }
  console.table(rows);
  const gained = rows.filter(r => r.imported !== "—" && !r.error);
  ui.notifications?.info(`Heritage features backfilled — ${gained.length} actor(s) gained features (table in the console).`);
  ChatMessage.create({ whisper: [game.user.id], content: `<p style="font-size:0.8rem"><b>Heritage tier features</b> — ${gained.length} of ${rows.length} gained:</p><ul style="font-size:0.78rem">${gained.map(r => `<li><b>${r.steward}</b> (L${r.level}): ${r.imported}</li>`).join("")}</ul>` });
})();
