// BBTTCC — Backfill engine-coverage maneuvers onto EXISTING factions — 2026-05-24
// ─────────────────────────────────────────────────────────────────────────────
// MANEUVER_BALANCE_PASS.md faction-kit fix. New factions now start with one
// usable T1 per engine (bbttcc-factions/scripts/module.js _BBTTCC_STANDARD_START_
// MANEUVERS). Factions created BEFORE this change have doctrineSeedMeta.applied
// = true, so the baseline-seed won't re-run. This macro grants the new
// engine-coverage maneuvers to existing factions that are missing them, so old
// and new factions reach parity.
//
// Grants (only if the faction doesn't already own them):
//   logistics_surge_s2      (Universal, anytime — usable in every raid type)
//   opt_infernal_bargain    (Presence, anytime)
//   courtly_whispered_aside (Courtly, anytime)
//
// Uses the canonical grant API so embedded items are built from EFFECTS exactly
// like a fresh faction. Idempotent (grant skips owned keys). DRY_RUN-gated.
//
// Knobs:
const DRY_RUN = true;          // false: actually grant
const NEW_KEYS = ["logistics_surge_s2", "opt_infernal_bargain", "courtly_whispered_aside"];
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const factionsApi = game.bbttcc?.api?.factions;
  const grant = factionsApi?.doctrine?.grant;
  // Fallback: detect factions directly if api helper unavailable.
  const isFaction = (a) =>
    a.flags?.["bbttcc-factions"]?.isFaction === true ||
    a.system?.details?.type?.value === "faction";

  const factions = game.actors.filter(isFaction);
  if (!factions.length) { ui.notifications?.warn("No faction actors found."); return; }

  const ownedKeys = (a) => new Set(
    a.items
      .filter((i) => String(i.flags?.bbttcc?.kind || "") === "maneuver")
      .map((i) => String(i.flags?.bbttcc?.key || "").toLowerCase())
  );

  const report = [];
  for (const f of factions) {
    const owned = ownedKeys(f);
    const toGrant = NEW_KEYS.filter((k) => !owned.has(k));
    if (!toGrant.length) { report.push({ faction: f.name, granted: [], note: "already has all" }); continue; }
    if (!DRY_RUN) {
      for (const key of toGrant) {
        try {
          if (typeof grant === "function") await grant(f, { kind: "maneuver", key, silent: true });
          else {
            // Minimal inline grant if API helper missing.
            const spec = game.bbttcc?.api?.raid?.EFFECTS?.[key] || null;
            await f.createEmbeddedDocuments("Item", [{
              name: spec?.label || key,
              type: "feat",
              flags: { bbttcc: { kind: "maneuver", key } },
              system: { category: "maneuver", source: "BBTTCC Doctrine",
                        description: { value: spec?.description || `<p>${spec?.text || key}</p>`, chat: "" } }
            }]);
          }
        } catch (e) { console.warn("[backfill] grant failed", f.name, key, e?.message); }
      }
    }
    report.push({ faction: f.name, granted: toGrant, note: "" });
  }

  const totalGrants = report.reduce((n, r) => n + r.granted.length, 0);
  console.groupCollapsed(`[backfill-faction-maneuvers] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — factions=${factions.length} grants=${totalGrants}`);
  console.table(report.map((r) => ({ faction: r.faction, granted: r.granted.join(", ") || "—", note: r.note })));
  console.groupEnd();

  const rows = report.map((r) =>
    `<tr><td style="padding:1px 6px">${r.faction}</td><td style="padding:1px 6px">${r.granted.join(", ") || "<i>—</i>"}</td><td style="padding:1px 6px"><i>${r.note}</i></td></tr>`
  ).join("");
  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  await ChatMessage.create({
    whisper: [game.user.id],
    content:
`<div style="font-family:var(--font-primary);font-size:11px">
<h3 style="margin:0 0 6px">🏳️ Faction Engine-Coverage Backfill — ${mode}</h3>
<b>${factions.length}</b> factions · <b>${totalGrants}</b> maneuvers to grant
<table style="border-collapse:collapse;width:100%;margin-top:6px"><thead><tr style="background:#eee"><th>Faction</th><th>Granted</th><th></th></tr></thead><tbody>${rows}</tbody></table>
${DRY_RUN ? '<p style="margin-top:6px"><b>To apply:</b> set <code>DRY_RUN = false</code>, re-run. (Run AFTER reloading Foundry so EFFECTS has the keys.)</p>' : ""}
</div>`
  });
})();
