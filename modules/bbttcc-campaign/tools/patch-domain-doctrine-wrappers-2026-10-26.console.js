/* patch-domain-doctrine-wrappers-2026-10-26.console.js — the ENTITLEMENT WRAPPER feats on every Domain actor follow the
 *  doctrines-pack rulings of 2026-10-26 (DC6 / DC7 / DC8). Wrappers are created by bbttcc-factions
 *  `_bbttccGrantDoctrineEmbeddedItem` from the registry label + `_bbttccBuildDoctrineDescription`; the builder is fixed
 *  (Cost in marks, no Tier/Rarity/Raid Types/Defender Access, plain option names) but existing wrappers keep the old text.
 *
 *   NAME   "⭐ X [Option]" → "X"; "Courtly Intrigue Council" → "Parley Council"; "Unity Surge" → "Accord Surge";
 *          "Policy Reforms (Admin)" → "Policy Reforms"; "Alignment Shift (Sephirot)" → "Alignment Shift";
 *          "Upgrade Outpost → Settlement" → "Upgrade Outpost to Settlement"; "Develop Outpost (Stability)" → "Develop Outpost"
 *   BODY   strip the `BBTTCC Doctrine • kind • key` footer (all three forms) and the Tier / Rarity / Raid Types / Defender
 *          Access lines; "OP Cost:" → "Cost: … marks" with player-facing channel names
 *
 *  Scope: every actor with flags.bbttcc-factions (a Domain) — embedded items carrying flags.bbttcc.kind maneuver|strategic.
 *  Idempotent (rerun → 0 changes); DRY_RUN default true; GM only. Run in whichever world you are in (Bad Eden, then the show world).
 *  Marker: [DOCTRINE-WRAPPERS-2026-10-26]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const CH = { violence:"Violence", nonlethal:"Nonlethal", intrigue:"Intrigue", economy:"Economy", softpower:"Soft Power", diplomacy:"Diplomacy", logistics:"Logistics", culture:"Culture", faith:"Faith" };
  const RENAME = { "Courtly Intrigue Council":"Parley Council", "Unity Surge":"Accord Surge", "Policy Reforms (Admin)":"Policy Reforms", "Alignment Shift (Sephirot)":"Alignment Shift", "Upgrade Outpost → Settlement":"Upgrade Outpost to Settlement", "Develop Outpost (Stability)":"Develop Outpost" };
  const fixName = (n) => { let s = String(n || "").replace(/^⭐\s*/, "").replace(/\s*\[Option\]\s*$/, ""); return RENAME[s] || s; };
  const fixBody = (v) => {
    let s = String(v || "");
    s = s.replace(/\s*<hr ?\/?>\s*<p class="hint">(<i>|<em>)BBTTCC Doctrine(<\/i>|<\/em>)[\s\S]*?<\/p>/g, "");
    s = s.replace(/\s*<p style="opacity:\.6;font-size:\.85em">BBTTCC Doctrine[\s\S]*?<\/p>/g, "");
    s = s.replace(/<p><strong>(Tier|Rarity|Raid Types|Defender Access):<\/strong>[^<]*<\/p>/g, "");
    s = s.replace(/<p><strong>OP Cost:<\/strong>\s*([^<]*)<\/p>/g, (m, body) => {
      const parts = body.split(/,\s*/).map(p => p.trim()).filter(Boolean).map(p => { const mm = p.match(/^([A-Za-z\- ]+?)\s+(\d+)$/); if (!mm) return null; const k = mm[1].trim().toLowerCase().replace(/[\s-]/g, ""); return `${CH[k] || mm[1].trim()} ${mm[2]}`; });
      return parts.every(Boolean) ? `<p><strong>Cost:</strong> ${parts.join(" · ")} marks</p>` : m;
    });
    s = s.replace(/<h3>⭐\s*([^<]*?)\s*\[Option\]<\/h3>/g, "<h3>$1</h3>");
    return s;
  };
  const report = []; let changes = 0, actors = 0;
  for (const a of game.actors.contents) {
    if (!a.flags?.["bbttcc-factions"]) continue;
    const rows = [];
    for (const it of a.items) {
      const kind = it.flags?.bbttcc?.kind; if (kind !== "maneuver" && kind !== "strategic") continue;
      const n2 = fixName(it.name); const v = it.system?.description?.value || ""; const v2 = fixBody(v);
      const row = { _id: it.id };
      if (n2 !== it.name) row.name = n2;
      if (v2 !== v) row["system.description.value"] = v2;
      if (Object.keys(row).length > 1) rows.push(row);
    }
    if (!rows.length) continue;
    actors++; changes += rows.length; report.push(`✚ ${a.name}: ${rows.length} wrapper(s) — ${rows.filter(r => r.name).map(r => r.name).join(", ") || "bodies only"}`);
    if (!DRY_RUN) await a.updateEmbeddedDocuments("Item", rows);
  }
  console.log(`[doctrine-wrappers] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} wrapper(s) on ${actors} Domain(s)\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Doctrine wrappers ${DRY_RUN ? "DRY RUN" : "APPLIED"}: ${changes} wrapper(s) on ${actors} Domain(s) (see console).`);
})();
