// Bad Eden — BACKFILL PATH FEATURES on every steward (2026-09-21)
// The subclass-folder bug (a compendium document fetched by uuid came back with folder = null, so subclass features
// were never offered) is fixed in ft-progression; this runs Apply Path Features on every steward so anyone who
// leveled while it was broken gets what their level earns. Idempotent — features already on a sheet are skipped.
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const apply = game.fourththing?._progression?.applyPathFeatures || game.fourththing?.progression?.applyPathFeatures;
  if (!apply) return ui.notifications?.error("applyPathFeatures not exposed — hard reload after deploying the system.");
  const stewards = game.actors.contents.filter(a => a.type === "character" && a.items.some(i => i.type === "class") && (a.hasPlayerOwner || a.flags?.fourththing?.kind === "steward"));
  const yes = await Dialog.confirm({ title: "Backfill path features", content: `<p>Run Apply Path Features on <b>${stewards.length}</b> steward(s)? Features already on a sheet are skipped; nothing is removed.</p><ul style="font-size:.85em">${stewards.map(a => `<li>${a.name}</li>`).join("")}</ul>` });
  if (!yes) return;
  const rows = [];
  for (const a of stewards) { try { const r = await apply(a); rows.push({ steward: a.name, imported: (r.imported || []).map(x => x?.name || x).join(", ") || "—", skipped: (r.skipped || []).length, error: r.error || "" }); } catch (e) { rows.push({ steward: a.name, imported: "", skipped: 0, error: e?.message || String(e) }); } }
  console.table(rows);
  ui.notifications?.info(`Path features backfilled — ${rows.filter(r => r.imported !== "—" && !r.error).length} steward(s) gained features (table in the console).`);
})();
