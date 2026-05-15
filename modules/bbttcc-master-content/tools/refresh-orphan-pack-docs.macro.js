// BBTTCC — Refresh Orphan Pack Docs from Runtime Catalog (2026-05-15)
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 2.5 cleanup. The 2 orphan maneuvers (opt_coordinated_advance,
// opt_infernal_bargain) have proper runtime EFFECTS+THROUGHPUT (from
// maneuvers-sprint2-content.enhancer.js) but their pack docs still carry
// pre-S2.5 descriptions and meta. The raid console picker reads from EFFECTS
// so player-facing tooltips are correct; only the compendium-browse view is
// stale. This macro syncs the pack docs to runtime catalog.
//
// Scope is intentionally narrow — only the 2 known orphans. If new orphans
// surface later, add their keys to KEYS_TO_REFRESH.
//
// Knobs:
const KEYS_TO_REFRESH = [
  "opt_coordinated_advance",
  "opt_infernal_bargain"
];
const DRY_RUN = true;
//
// Idempotent. Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  const catalog = game.bbttcc?.api?.raid?.sprint2Maneuvers;
  if (!Array.isArray(catalog)) {
    ui.notifications?.error("game.bbttcc.api.raid.sprint2Maneuvers unavailable — is maneuvers-sprint2-content.enhancer.js loaded?");
    return;
  }

  const docs = await pack.getDocuments();

  const updates = [];
  const skipped = [];

  for (const key of KEYS_TO_REFRESH) {
    const m = catalog.find((x) => x.key === key);
    const doc = docs.find((d) => (d.flags?.bbttcc?.key || "") === key);
    if (!m) { skipped.push({ key, reason: "not in runtime catalog" }); continue; }
    if (!doc) { skipped.push({ key, reason: "not in pack" }); continue; }

    const payload = {
      _id: doc.id,
      name: m.label,
      "system.description.value": m.description || `<p>${m.effectsText || m.label}</p>`,
      "flags.bbttcc.meta.tier": m.tier,
      "flags.bbttcc.meta.engine": m.engine,
      "flags.bbttcc.meta.layer": m.layer,
      "flags.bbttcc.meta.costBand": m.costBand,
      "flags.bbttcc.meta.fireMode": m.fireMode,
      "flags.bbttcc.meta.raidTypes": m.raidTypes.slice(),
      "flags.bbttcc.meta.opCosts": foundry.utils.deepClone(m.cost),
      "flags.bbttcc.meta.availability": "standard",
      "flags.bbttcc.meta.authoredSprint": 2.5,
      "flags.bbttcc.effects.text": m.effectsText
    };
    updates.push({ key, name: m.label, oldName: doc.name, payload });
  }

  let applied = 0;
  if (!DRY_RUN && updates.length) {
    try {
      const res = await pack.documentClass.updateDocuments(updates.map((u) => u.payload), { pack: PACK_ID });
      applied = Array.isArray(res) ? res.length : updates.length;
      ui.notifications?.info(`Refreshed ${applied} orphan pack docs.`);
    } catch (e) {
      console.error("[refresh-orphans] updateDocuments failed", e);
      ui.notifications?.error("Refresh failed — see console");
    }
  }

  console.groupCollapsed(`[refresh-orphans] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — ${updates.length} updates, ${skipped.length} skipped`);
  console.log("updates:", updates);
  console.log("skipped:", skipped);
  console.groupEnd();

  const rows = updates.map((u) =>
    `<tr><td>${u.oldName}${u.oldName !== u.name ? ` → <b>${u.name}</b>` : ""}</td><td><code>${u.key}</code></td><td>refresh description + meta.{engine,layer,costBand,fireMode,raidTypes,opCosts,tier}</td></tr>`
  ).join("");
  const skippedRows = skipped.map((s) =>
    `<tr><td colspan="2"><code>${s.key}</code></td><td><i>${s.reason}</i></td></tr>`
  ).join("");

  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">🔧 Refresh Orphan Pack Docs — ${mode}</h3>
<div style="font-size:11px;line-height:1.4">
<b>${updates.length}</b> entries to refresh · <b>${skipped.length}</b> skipped · <b>${applied}</b> written
</div>
${rows ? `<table style="font-size:10px;border-collapse:collapse;width:100%;margin-top:6px">
<thead><tr style="background:#eee"><th>Name</th><th>Key</th><th>Changes</th></tr></thead>
<tbody>${rows}</tbody></table>` : ""}
${skippedRows ? `<details style="margin-top:6px"><summary><b>Skipped</b></summary>
<table style="font-size:10px;border-collapse:collapse;width:100%"><tbody>${skippedRows}</tbody></table></details>` : ""}
${DRY_RUN ? '<p style="margin-top:8px;font-size:11px"><b>To apply:</b> set <code>DRY_RUN = false</code>, re-run.</p>' : ""}
</div>`;

  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
