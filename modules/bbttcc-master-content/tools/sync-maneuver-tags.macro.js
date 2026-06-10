// Bad Eden — Sync Maneuver Tags Audit (2026-05-14)
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 1 Tool #3 of MANEUVER_CATALOG_SPEC.md. Read-only audit. For each
// maneuver in the live bbttcc-master-content.doctrines pack, reports:
//
//   - has THROUGHPUT handler?        (game.bbttcc.api.agent.__THROUGHPUT[key])
//   - has EFFECTS registry entry?    (game.bbttcc.api.raid.EFFECTS[key])
//   - has fire-mode tag?             (EFFECTS[key].fireMode)
//
// Also runs the REVERSE direction:
//
//   - THROUGHPUT keys NOT in pack    (dead-code candidates)
//   - EFFECTS maneuver keys NOT in pack
//   - fire-mode-tagged keys NOT in pack
//
// Output: console.table + whispered chat card.
//
// Read-only. Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  const raidApi = game.bbttcc?.api?.raid;
  const EFFECTS = raidApi?.EFFECTS || {};
  const THROUGHPUT = game.bbttcc?.api?.agent?.__THROUGHPUT || {};

  const stripLeadingStar = (s) => String(s || "").replace(/^\s*[⭐★⭐]\s*/u, "");
  function deriveKey(name) {
    let s = stripLeadingStar(String(name || ""));
    s = s.toLowerCase().replace(/\[[^\]]+\]/g, "");
    s = s.replace(/[‘’']/g, "");
    s = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return s;
  }

  // ── enumerate pack ─────────────────────────────────────────────────────────
  const docs = await pack.getDocuments();
  const maneuvers = docs.filter((d) => (d.flags?.bbttcc?.kind || "") === "maneuver");

  const packRows = [];
  const packKeys = new Set();
  for (const doc of maneuvers) {
    const bb = doc.flags?.bbttcc || {};
    const key = bb.key || deriveKey(doc.name);
    packKeys.add(key);
    const eff = EFFECTS[key] || null;
    packRows.push({
      key,
      name: stripLeadingStar(doc.name).replace(/\s*\[Option\]\s*$/i, "").trim(),
      tier: bb.meta?.tier ?? null,
      effects: eff ? "✓" : "✗",
      fireMode: eff?.fireMode || "—",
      throughput: THROUGHPUT[key] ? "✓" : "✗",
      gap: [
        !eff && "effects",
        eff && !eff.fireMode && "fireMode",
        !THROUGHPUT[key] && "throughput"
      ].filter(Boolean).join(",") || "—"
    });
  }

  packRows.sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name));

  // ── reverse direction: code-side keys not in pack ──────────────────────────
  const effectsManeuverKeys = new Set(
    Object.entries(EFFECTS)
      .filter(([_, v]) => String(v?.kind || "") === "maneuver")
      .map(([k]) => k)
  );
  const throughputKeys = new Set(Object.keys(THROUGHPUT));
  const fireModeKeys = new Set(
    Object.entries(EFFECTS)
      .filter(([_, v]) => !!v?.fireMode)
      .map(([k]) => k)
  );

  const orphans = {
    effectsNotInPack: [...effectsManeuverKeys].filter((k) => !packKeys.has(k)),
    throughputNotInPack: [...throughputKeys].filter((k) => !packKeys.has(k)),
    fireModeNotInPack: [...fireModeKeys].filter((k) => !packKeys.has(k))
  };

  // ── tally gaps ─────────────────────────────────────────────────────────────
  const gapCounts = { effects: 0, fireMode: 0, throughput: 0 };
  for (const row of packRows) {
    if (row.effects === "✗") gapCounts.effects++;
    if (row.fireMode === "—" && row.effects === "✓") gapCounts.fireMode++;
    if (row.throughput === "✗") gapCounts.throughput++;
  }

  // ── console output ─────────────────────────────────────────────────────────
  console.groupCollapsed(`[sync-tags] pack=${packRows.length} · effectsManeuvers=${effectsManeuverKeys.size} · throughput=${throughputKeys.size} · fireMode=${fireModeKeys.size}`);
  console.table(packRows);
  console.log("gap counts (pack-side):", gapCounts);
  console.log("orphans (code-side keys not in pack):", orphans);
  console.groupEnd();

  // ── chat report ────────────────────────────────────────────────────────────
  const gapRows = packRows.filter((r) => r.gap !== "—").map((r) =>
    `<tr><td>T${r.tier ?? "?"}</td><td>${r.name}</td><td><code>${r.key}</code></td><td>${r.effects}</td><td>${r.fireMode}</td><td>${r.throughput}</td><td style="color:#a05">${r.gap}</td></tr>`
  ).join("");

  const orphanList = (label, arr) => arr.length
    ? `<details style="margin:4px 0"><summary><b>${label}</b> (${arr.length})</summary><div style="font-family:var(--font-monospace);font-size:10px">${arr.map((k) => `<code>${k}</code>`).join(" · ")}</div></details>`
    : `<div style="font-size:10px;color:#080;margin:2px 0">${label}: <b>0</b> ✓</div>`;

  const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">🔍 Maneuver Tag Sync Audit</h3>
<div style="font-size:11px;line-height:1.5">
<b>Pack maneuvers:</b> ${packRows.length}<br>
<b>Gaps (pack → code):</b>
  EFFECTS missing: <b style="color:${gapCounts.effects?'#a05':'#080'}">${gapCounts.effects}</b> ·
  fireMode missing: <b style="color:${gapCounts.fireMode?'#a05':'#080'}">${gapCounts.fireMode}</b> ·
  THROUGHPUT missing: <b style="color:${gapCounts.throughput?'#a05':'#080'}">${gapCounts.throughput}</b>
</div>
${gapRows ? `<details open style="margin-top:8px"><summary><b>Pack entries with gaps</b></summary>
<table style="font-size:10px;border-collapse:collapse;width:100%">
<thead><tr style="background:#eee"><th>Tier</th><th>Name</th><th>Key</th><th>EFF</th><th>FireMode</th><th>TP</th><th>Gap</th></tr></thead>
<tbody>${gapRows}</tbody></table>
</details>` : '<div style="margin-top:6px;color:#080"><b>✓ No pack-side gaps</b></div>'}
<div style="margin-top:8px">
<b>Reverse direction — code-side keys not in pack (dead-code candidates):</b>
${orphanList("EFFECTS maneuvers not in pack", orphans.effectsNotInPack)}
${orphanList("THROUGHPUT handlers not in pack", orphans.throughputNotInPack)}
${orphanList("fireMode tags not in pack", orphans.fireModeNotInPack)}
</div>
</div>`;

  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
