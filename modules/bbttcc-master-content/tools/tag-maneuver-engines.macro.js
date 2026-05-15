// BBTTCC — Tag Maneuver Engines on Post-Refresh Pack (2026-05-15)
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 2.5 follow-up to MANEUVER_CATALOG_SPEC.md §6.B. The S1 refresh pass
// populated canonical `meta.raidTypes` but did NOT set `meta.engine` — that's
// a semantic decision per maneuver. This macro applies engine tags:
//
//   1. Skips entries with `flags.bbttcc.meta.engine` already set (don't clobber).
//   2. **Runtime-EFFECTS path** — for any maneuver registered by a content
//      enhancer (S2/S2.5/future), mirror `EFFECTS[key].meta.engine` +
//      `.raidTypes` onto the pack doc. Catches orphan-rescue entries like
//      opt_coordinated_advance / opt_infernal_bargain without manual upkeep.
//   3. OVERRIDES path — for the 14 originally-unresolved entries (raidTypes
//      empty after refresh because legacy keys mapped to null), applies a
//      hand-curated mapping.
//   4. Derive path — for everything else, derives engine from existing
//      `meta.raidTypes` (first canonical entry).
//
// Output: `flags.bbttcc.meta.engine` ∈ "universal" | "violence" | "intrigue" | "presence"
// Also normalizes `meta.raidTypes` to align with engine for EFFECTS/OVERRIDES paths.
//
// Knobs:
const DRY_RUN = true;          // false: write to pack
const VERBOSE_CONSOLE = false; // log per-entry details
//
// Idempotent. Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  // §6.B unresolved-entry mapping (2026-05-15 hand-curated).
  const OVERRIDES = {
    // Universal (3) — divine/blessing/any-faction tools
    supply_surge:            { engine: "universal", raidTypes: ["any"] },
    divine_favor:            { engine: "universal", raidTypes: ["any"] },
    sephirotic_intervention: { engine: "universal", raidTypes: ["any"] },

    // Violence (6) — defense + counterattack + attack-engines
    last_stand_banner:       { engine: "violence",  raidTypes: ["violence"] },
    patch_the_breach:        { engine: "violence",  raidTypes: ["violence"] },
    quantum_shield:          { engine: "violence",  raidTypes: ["violence"] },
    radiant_retaliation:     { engine: "violence",  raidTypes: ["violence"] },
    ego_dragon_echo:         { engine: "violence",  raidTypes: ["violence"] },
    engine_of_absolution:    { engine: "violence",  raidTypes: ["violence"] },

    // Presence (5) — faith narrative + social/mercy/courtly
    prayer_in_the_smoke:     { engine: "presence",  raidTypes: ["presence"] },
    faithful_intervention:   { engine: "presence",  raidTypes: ["presence"] },
    harmonic_chant:          { engine: "presence",  raidTypes: ["presence"] },
    crown_of_mercy:          { engine: "presence",  raidTypes: ["presence"] },
    temporal_armistice:      { engine: "presence",  raidTypes: ["presence"] }
  };

  // For entries WITHOUT overrides, derive engine from canonical raidTypes.
  // Multi-engine entries (e.g. ["violence","presence"]) → use the first as primary.
  function deriveEngine(raidTypes) {
    const rt = Array.isArray(raidTypes) ? raidTypes : [];
    if (!rt.length) return null;
    const lc = rt.map((t) => String(t).toLowerCase());
    if (lc.includes("any")) return "universal";
    if (lc.includes("violence")) return "violence";
    if (lc.includes("intrigue")) return "intrigue";
    if (lc.includes("presence")) return "presence";
    return null;
  }

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

  const updates = [];     // { _id, name, key, payload, deltas }
  const skipped = [];     // { key, name, reason }
  const unmappable = [];  // { key, name, reason }

  for (const doc of maneuvers) {
    const bb = doc.flags?.bbttcc || {};
    const meta = bb.meta || {};
    const key = bb.key || deriveKey(doc.name);

    // (1) Skip if already engine-tagged.
    if (meta.engine) {
      skipped.push({ key, name: doc.name, reason: `already tagged: ${meta.engine}` });
      continue;
    }

    // (2) Runtime EFFECTS path — for any maneuver registered by a content
    // enhancer (S2/S2.5/future). The runtime entry carries the canonical
    // engine + raidTypes; mirror them onto the pack doc. This catches
    // orphan-rescue entries like opt_coordinated_advance / opt_infernal_bargain
    // without needing manual OVERRIDES bookkeeping.
    const eff = game.bbttcc?.api?.raid?.EFFECTS?.[key];
    const effEngine = eff?.meta?.engine || null;
    const effRaidTypes = Array.isArray(eff?.raidTypes) ? eff.raidTypes : null;
    if (effEngine) {
      const deltas = [`engine: (unset) → "${effEngine}" (from EFFECTS)`];
      const payload = { _id: doc.id, "flags.bbttcc.meta.engine": effEngine };
      const currentRT = Array.isArray(meta.raidTypes) ? meta.raidTypes : [];
      if (effRaidTypes && JSON.stringify(currentRT) !== JSON.stringify(effRaidTypes)) {
        payload["flags.bbttcc.meta.raidTypes"] = effRaidTypes.slice();
        deltas.push(`raidTypes: ${JSON.stringify(currentRT)} → ${JSON.stringify(effRaidTypes)}`);
      }
      updates.push({ _id: doc.id, name: doc.name, key, payload, deltas, via: "effects" });
      if (VERBOSE_CONSOLE) console.log("[engine-tag effects]", key, deltas);
      continue;
    }

    // (3) Override path for the 14 originally-unresolved entries.
    if (OVERRIDES[key]) {
      const ov = OVERRIDES[key];
      const deltas = [`engine: (unset) → "${ov.engine}"`];
      const payload = {
        _id: doc.id,
        "flags.bbttcc.meta.engine": ov.engine
      };
      const currentRT = Array.isArray(meta.raidTypes) ? meta.raidTypes : [];
      if (JSON.stringify(currentRT) !== JSON.stringify(ov.raidTypes)) {
        payload["flags.bbttcc.meta.raidTypes"] = ov.raidTypes;
        deltas.push(`raidTypes: ${JSON.stringify(currentRT)} → ${JSON.stringify(ov.raidTypes)}`);
      }
      updates.push({ _id: doc.id, name: doc.name, key, payload, deltas, via: "override" });
      if (VERBOSE_CONSOLE) console.log("[engine-tag override]", key, deltas);
      continue;
    }

    // (4) Derive from existing meta.raidTypes (legacy entries already tagged).
    const derived = deriveEngine(meta.raidTypes);
    if (!derived) {
      unmappable.push({ key, name: doc.name, reason: `cannot derive: raidTypes=${JSON.stringify(meta.raidTypes || [])} · no EFFECTS entry · no OVERRIDES match` });
      continue;
    }
    updates.push({
      _id: doc.id,
      name: doc.name,
      key,
      payload: { _id: doc.id, "flags.bbttcc.meta.engine": derived },
      deltas: [`engine: (unset) → "${derived}" (derived from raidTypes)`],
      via: "derived"
    });
    if (VERBOSE_CONSOLE) console.log("[engine-tag derived]", key, derived);
  }

  // ── apply ──────────────────────────────────────────────────────────────────
  let applied = 0;
  if (!DRY_RUN && updates.length) {
    try {
      const payloads = updates.map((u) => u.payload);
      const res = await pack.documentClass.updateDocuments(payloads, { pack: PACK_ID });
      applied = Array.isArray(res) ? res.length : payloads.length;
      ui.notifications?.info(`Tagged ${applied} maneuvers with canonical engine`);
    } catch (e) {
      console.error("[engine-tag] updateDocuments failed", e);
      ui.notifications?.error("Engine tagging failed — see console");
    }
  }

  // ── tally by engine ────────────────────────────────────────────────────────
  const tally = { universal: 0, violence: 0, intrigue: 0, presence: 0 };
  for (const u of updates) {
    const eng = u.payload["flags.bbttcc.meta.engine"];
    if (tally[eng] != null) tally[eng]++;
  }
  for (const s of skipped) {
    // Skipped entries already have an engine; tally those too for accurate post-state.
    const doc = maneuvers.find((d) => (d.flags?.bbttcc?.key || deriveKey(d.name)) === s.key);
    const eng = doc?.flags?.bbttcc?.meta?.engine;
    if (eng && tally[eng] != null) tally[eng]++;
  }

  // ── report ─────────────────────────────────────────────────────────────────
  console.groupCollapsed(`[engine-tag] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — updates=${updates.length} · skipped=${skipped.length} · unmappable=${unmappable.length}`);
  console.log("updates:", updates.map((u) => ({ name: u.name, key: u.key, via: u.via, deltas: u.deltas })));
  console.log("skipped:", skipped);
  console.log("unmappable:", unmappable);
  console.log("tally (post-application):", tally);
  console.groupEnd();

  const updateRows = updates.map((u) => {
    const eng = u.payload["flags.bbttcc.meta.engine"];
    const badge = u.via === "override" ? '<span style="color:#a05">override</span>' : '<span style="color:#080">derived</span>';
    return `<tr><td>${u.name}</td><td><code>${u.key}</code></td><td><b>${eng}</b></td><td>${badge}</td></tr>`;
  }).join("");

  const unmappableRows = unmappable.map((u) =>
    `<tr><td>${u.name}</td><td><code>${u.key}</code></td><td colspan="2"><i>${u.reason}</i></td></tr>`
  ).join("");

  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">🏷️ Engine Tagging — ${mode}</h3>
<div style="font-size:11px;line-height:1.4">
<b>${updates.length}</b> entries to tag · <b>${skipped.length}</b> already-tagged · <b>${unmappable.length}</b> unmappable<br>
<b>Post-application tally:</b> universal=${tally.universal} · violence=${tally.violence} · intrigue=${tally.intrigue} · presence=${tally.presence}
</div>
${updateRows ? `<details ${DRY_RUN ? "open" : ""} style="margin-top:6px"><summary><b>Per-entry changes</b></summary>
<table style="font-size:10px;border-collapse:collapse;width:100%">
<thead><tr style="background:#eee"><th>Name</th><th>Key</th><th>Engine</th><th>Via</th></tr></thead>
<tbody>${updateRows}</tbody></table></details>` : ""}
${unmappableRows ? `<details style="margin-top:6px"><summary><b style="color:#a05">⚠ Unmappable</b></summary>
<table style="font-size:10px;border-collapse:collapse;width:100%">
<tbody>${unmappableRows}</tbody></table></details>` : ""}
${DRY_RUN ? '<p style="margin-top:8px;font-size:11px"><b>To apply:</b> set <code>DRY_RUN = false</code>, re-run.</p>' : ""}
</div>`;

  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
