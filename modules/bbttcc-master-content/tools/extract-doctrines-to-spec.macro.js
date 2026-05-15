// BBTTCC — Extract Doctrines Pack → Maneuver Catalog Snapshot (2026-05-14)
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 1 Tool #1 of MANEUVER_CATALOG_SPEC.md.
//
// Reads the bbttcc-master-content.doctrines pack, filters to
// flags.bbttcc.kind === "maneuver", and emits a canonical snapshot
// combining pack data with runtime data from game.bbttcc.api.raid.EFFECTS
// and game.bbttcc.api.agent.__THROUGHPUT.
//
// Outputs:
//   1. Console.table summary
//   2. Chat card with counts + markdown table (paste into spec memo §6)
//   3. JSON download (saveDataToFile) — doctrines-snapshot-YYYYMMDD.json
//
// Per-entry snapshot shape:
//   {
//     id,            // pack doc _id
//     name,          // display name (⭐ and [Option] still present here)
//     normalizedName,// ⭐/[Option] stripped — what the entry SHOULD be called
//     key,           // flags.bbttcc.key (or derived from name)
//     tier,          // flags.bbttcc.meta.tier
//     rarity,        // flags.bbttcc.meta.rarity
//     availability,  // flags.bbttcc.meta.availability
//     unlockKey,     // flags.bbttcc.meta.unlockKey (null after refresh pass)
//     storyOnly,     // flags.bbttcc.meta.storyOnly
//     raidTypesPack, // flags.bbttcc.meta.raidTypes (currently empty for all)
//     raidTypesEffects, // EFFECTS[key].raidTypes (legacy)
//     raidTypesCanonical, // mapped via resolveCanonical()
//     opCosts,       // EFFECTS[key].cost ?? EFFECTS[key].opCosts
//     fireMode,      // EFFECTS[key].fireMode (Phase 4D tag)
//     hasThroughput, // !!__THROUGHPUT[key]
//     effectsText,   // EFFECTS[key].text or 1-line description
//     flags          // computed audit flags (legacyStar, untieredTier, missingRaidTypes, etc.)
//   }
//
// Knobs:
const SAVE_JSON_FILE = true;   // saveDataToFile() → user downloads JSON
const POST_CHAT_REPORT = true; // emit a chat card with counts + table
const VERBOSE_CONSOLE = false; // dump every entry to console
//
// Read-only. Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";

  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    ui.notifications?.error(`Pack not found: ${PACK_ID}`);
    return;
  }

  const raidApi = game.bbttcc?.api?.raid;
  const EFFECTS = raidApi?.EFFECTS || {};
  const THROUGHPUT = game.bbttcc?.api?.agent?.__THROUGHPUT || {};
  const resolveCanonical = raidApi?.resolveCanonical || ((k) => null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const stripLeadingStar = (s) => String(s || "").replace(/^\s*[⭐★⭐]\s*/u, "");
  const stripOptionSuffix = (s) => String(s || "").replace(/\s*\[Option\]\s*$/i, "").trim();
  const normalizeName = (s) => stripOptionSuffix(stripLeadingStar(s));

  function deriveKey(name) {
    let s = stripLeadingStar(String(name || ""));
    s = s.toLowerCase().replace(/\[[^\]]+\]/g, "");
    s = s.replace(/[‘’']/g, "");
    s = s.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    return s;
  }

  function shorten(text, n = 80) {
    const s = String(text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  // ── enumerate pack ─────────────────────────────────────────────────────────
  const docs = await pack.getDocuments();
  const maneuvers = docs.filter((d) => (d.flags?.bbttcc?.kind || "") === "maneuver");

  const snapshot = [];
  for (const doc of maneuvers) {
    const bb = doc.flags?.bbttcc || {};
    const meta = bb.meta || {};
    const key = bb.key || meta.unlockKey || deriveKey(doc.name);
    const eff = EFFECTS[key] || null;

    const raidTypesEffects = Array.isArray(eff?.raidTypes) ? eff.raidTypes.slice() : [];
    const raidTypesCanonical = [...new Set(
      raidTypesEffects
        .map((rt) => resolveCanonical(String(rt).toLowerCase()))
        .filter(Boolean)
    )];

    const opCosts = eff?.cost ?? eff?.opCosts ?? eff?.meta?.cost ?? eff?.meta?.opCosts ?? null;
    const effectsText = eff?.text || eff?.effects?.text || "";

    const auditFlags = [];
    if (/^\s*[⭐★⭐]/u.test(doc.name)) auditFlags.push("legacyStar");
    if (/\[Option\]\s*$/i.test(doc.name)) auditFlags.push("legacyOption");
    if (meta.unlockKey) auditFlags.push("hasUnlockKey");
    if (meta.tier == null) auditFlags.push("untieredTier");
    if (!Array.isArray(meta.raidTypes) || !meta.raidTypes.length) auditFlags.push("packMissingRaidTypes");
    if (!eff) auditFlags.push("noEffectsEntry");
    if (!THROUGHPUT[key]) auditFlags.push("noThroughputHandler");
    if (!eff?.fireMode) auditFlags.push("noFireModeTag");

    snapshot.push({
      id: doc.id,
      name: doc.name,
      normalizedName: normalizeName(doc.name),
      key,
      tier: meta.tier ?? null,
      rarity: meta.rarity ?? null,
      availability: meta.availability ?? null,
      unlockKey: meta.unlockKey ?? null,
      storyOnly: !!meta.storyOnly,
      raidTypesPack: Array.isArray(meta.raidTypes) ? meta.raidTypes.slice() : [],
      raidTypesEffects,
      raidTypesCanonical,
      opCosts,
      fireMode: eff?.fireMode ?? null,
      hasThroughput: !!THROUGHPUT[key],
      effectsText,
      flags: auditFlags
    });
  }

  snapshot.sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.normalizedName.localeCompare(b.normalizedName));

  // ── aggregate counts ───────────────────────────────────────────────────────
  const counts = {
    total: snapshot.length,
    byTier: {},
    byCanonicalEngine: {},
    byFireMode: {},
    throughputWired: 0,
    fireModeTagged: 0,
    legacyStar: 0,
    hasUnlockKey: 0,
    untieredTier: 0,
    packMissingRaidTypes: 0,
    noEffectsEntry: 0
  };
  for (const e of snapshot) {
    const t = e.tier ?? "untiered";
    counts.byTier[t] = (counts.byTier[t] || 0) + 1;
    const eng = e.raidTypesCanonical.length ? e.raidTypesCanonical.join("+") : "(none)";
    counts.byCanonicalEngine[eng] = (counts.byCanonicalEngine[eng] || 0) + 1;
    const fm = e.fireMode || "(untagged)";
    counts.byFireMode[fm] = (counts.byFireMode[fm] || 0) + 1;
    if (e.hasThroughput) counts.throughputWired++;
    if (e.fireMode) counts.fireModeTagged++;
    if (e.flags.includes("legacyStar") || e.flags.includes("legacyOption")) counts.legacyStar++;
    if (e.flags.includes("hasUnlockKey")) counts.hasUnlockKey++;
    if (e.flags.includes("untieredTier")) counts.untieredTier++;
    if (e.flags.includes("packMissingRaidTypes")) counts.packMissingRaidTypes++;
    if (e.flags.includes("noEffectsEntry")) counts.noEffectsEntry++;
  }

  // ── output: console ────────────────────────────────────────────────────────
  console.groupCollapsed(`[doctrines-extract] ${counts.total} maneuvers`);
  console.log("counts:", counts);
  if (VERBOSE_CONSOLE) console.table(snapshot.map((e) => ({
    tier: e.tier, name: e.normalizedName, key: e.key,
    engine: e.raidTypesCanonical.join("+") || "—",
    fireMode: e.fireMode || "—",
    tp: e.hasThroughput ? "✓" : "✗",
    flags: e.flags.join(",")
  })));
  console.groupEnd();

  // ── output: chat ───────────────────────────────────────────────────────────
  if (POST_CHAT_REPORT) {
    const rows = snapshot.map((e) => {
      const eng = e.raidTypesCanonical.join("+") || "—";
      const fm = e.fireMode ? e.fireMode.replace("post-commit", "post").replace("pre-roll", "pre") : "—";
      const tp = e.hasThroughput ? "✓" : "✗";
      const flagBadges = e.flags.length ? ` <span style="color:#a05">${e.flags.length}⚠</span>` : "";
      return `| T${e.tier ?? "?"} | ${e.normalizedName}${flagBadges} | \`${e.key}\` | ${eng} | ${fm} | ${tp} |`;
    }).join("\n");

    const table =
`| Tier | Name | Key | Engine | Fire | TP |
|---|---|---|---|---|---|
${rows}`;

    const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">📜 Doctrines Pack → Maneuver Catalog Snapshot</h3>
<div style="font-size:11px;line-height:1.4">
<b>${counts.total}</b> maneuvers · throughput wired: <b>${counts.throughputWired}</b> · fire-mode tagged: <b>${counts.fireModeTagged}</b><br>
<b>Tiers:</b> ${Object.entries(counts.byTier).map(([k,v])=>`T${k}=${v}`).join(" · ")}<br>
<b>Engines:</b> ${Object.entries(counts.byCanonicalEngine).map(([k,v])=>`${k}=${v}`).join(" · ")}<br>
<b>Fire mode:</b> ${Object.entries(counts.byFireMode).map(([k,v])=>`${k}=${v}`).join(" · ")}<br>
<b>Audit hits:</b>
legacyStar=${counts.legacyStar} · hasUnlockKey=${counts.hasUnlockKey} · untiered=${counts.untieredTier} ·
packMissingRaidTypes=${counts.packMissingRaidTypes} · noEffectsEntry=${counts.noEffectsEntry}
</div>
<details><summary style="cursor:pointer;margin-top:8px"><b>Full table</b> (click to expand)</summary>
<div style="font-family:var(--font-monospace);font-size:10px;white-space:pre-wrap;max-height:480px;overflow-y:auto">${table.replace(/</g, "&lt;").replace(/&lt;span/g, "<span").replace(/&lt;\/span/g, "</span")}</div>
</details>
</div>`;

    await ChatMessage.create({ content: summary, whisper: [game.user.id] });
  }

  // ── output: JSON download ─────────────────────────────────────────────────
  if (SAVE_JSON_FILE) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const payload = JSON.stringify({
      generatedAt: new Date().toISOString(),
      pack: PACK_ID,
      counts,
      maneuvers: snapshot
    }, null, 2);
    saveDataToFile(payload, "application/json", `doctrines-snapshot-${stamp}.json`);
    ui.notifications?.info(`Saved doctrines-snapshot-${stamp}.json (${snapshot.length} maneuvers)`);
  }

  // Expose the snapshot for follow-up tooling without re-extraction.
  globalThis.__bbttccDoctrinesSnapshot = { generatedAt: Date.now(), maneuvers: snapshot, counts };
  console.log("[doctrines-extract] snapshot at globalThis.__bbttccDoctrinesSnapshot");
})();
