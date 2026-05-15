// BBTTCC — Refresh Maneuver Catalog (2026-05-14)
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 1 Tool #2 of MANEUVER_CATALOG_SPEC.md. Applies the §2 refresh pass
// to the live bbttcc-master-content.doctrines pack. DRY_RUN by default.
//
// Per-entry refresh (idempotent):
//   2.A NORMALIZE LEGACY GRANTS
//     - Strip "⭐ " prefix and " [Option]" suffix from doc.name
//     - Clear flags.bbttcc.meta.unlockKey
//     - Set flags.bbttcc.meta.availability = "standard" if missing
//     - Flip flags.bbttcc.meta.storyOnly = false (legacy story-grants fold in)
//
//   2.B TEXT FIXES
//     - empathic_surge / moral_high_ground: "Empathy Meter" → "Unity"
//       (system.description.value; case-insensitive global replace)
//
//   2.C DATA FIXES
//     - Suppressive Fire: meta.tier = 1 if currently null
//     - Set flags.bbttcc.key (canonical snake_case) if missing
//     - Populate flags.bbttcc.meta.raidTypes from EFFECTS[key].raidTypes
//       via game.bbttcc.api.raid.resolveCanonical()
//
//   2.D VERIFY-THEN-DECIDE (reports only; does not mutate)
//     - chrono_loop_command, crown_of_mercy, logistical_surge: hand-review list
//
// Knobs:
const DRY_RUN = true;          // false: write changes to the pack
const VERBOSE_PER_ENTRY = false; // true: console.log per-entry payload
//
// Idempotent. Safe to re-run. Reports payload + posts whisper chat card.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  const raidApi = game.bbttcc?.api?.raid;
  if (!raidApi) { ui.notifications?.error("game.bbttcc.api.raid unavailable"); return; }
  const EFFECTS = raidApi.EFFECTS || {};
  const resolveCanonical = raidApi.resolveCanonical || ((k) => null);

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

  // Resolve canonical raidTypes from an EFFECTS entry. Drops legacy keys that
  // map to null (occupation/liberation/ritual — out of raid scope).
  function canonicalRaidTypes(eff) {
    const arr = Array.isArray(eff?.raidTypes) ? eff.raidTypes : [];
    const mapped = [...new Set(
      arr.map((rt) => resolveCanonical(String(rt).toLowerCase())).filter(Boolean)
    )];
    return mapped;
  }

  // Text-fix targets (key → description rewrites). Case-insensitive global.
  const TEXT_FIXES = {
    empathic_surge:    [[/Empathy Meter/gi, "Unity"]],
    moral_high_ground: [[/Empathy Meter/gi, "Unity"]]
  };

  // Tier overrides for entries with missing/wrong tier metadata.
  const TIER_FIXES = {
    suppressive_fire: 1
  };

  // Verify-then-decide list (Section 2.D). Reported, not auto-fixed.
  const VERIFY_KEYS = new Set([
    "chrono_loop_command",
    "crown_of_mercy",
    "logistical_surge"
  ]);

  // ── enumerate pack ─────────────────────────────────────────────────────────
  const docs = await pack.getDocuments();
  const maneuvers = docs.filter((d) => (d.flags?.bbttcc?.kind || "") === "maneuver");

  const updates = [];   // {_id, _updatePayload, deltas: [string]}
  const skipped = [];   // unchanged entries
  const unresolvedRaidTypes = []; // keys we couldn't canonicalize
  const verifyHits = []; // entries flagged for hand review

  for (const doc of maneuvers) {
    const bb = doc.flags?.bbttcc || {};
    const meta = bb.meta || {};
    const currentName = doc.name;
    const normalizedNameVal = normalizeName(currentName);

    // Derive canonical key (preserves bb.key if already set).
    const key = bb.key || deriveKey(currentName);
    const eff = EFFECTS[key] || null;

    const deltas = [];
    const updatePayload = { _id: doc.id };

    // 2.A — Name normalization
    if (currentName !== normalizedNameVal) {
      updatePayload.name = normalizedNameVal;
      deltas.push(`name: "${currentName}" → "${normalizedNameVal}"`);
    }

    // 2.A — bb.key (set explicitly for canonicalization)
    if (!bb.key) {
      updatePayload["flags.bbttcc.key"] = key;
      deltas.push(`key: (unset) → "${key}"`);
    }

    // 2.A — Clear legacy unlockKey
    if (meta.unlockKey) {
      updatePayload["flags.bbttcc.meta.unlockKey"] = null;
      deltas.push(`unlockKey: "${meta.unlockKey}" → null`);
    }

    // 2.A — Set availability = "standard" if missing
    if (!meta.availability) {
      updatePayload["flags.bbttcc.meta.availability"] = "standard";
      deltas.push(`availability: (unset) → "standard"`);
    }

    // 2.A — Flip storyOnly false (story-grants fold in)
    if (meta.storyOnly === true) {
      updatePayload["flags.bbttcc.meta.storyOnly"] = false;
      deltas.push(`storyOnly: true → false`);
    }

    // 2.C — Tier fix (Suppressive Fire)
    if (TIER_FIXES[key] != null && meta.tier == null) {
      updatePayload["flags.bbttcc.meta.tier"] = TIER_FIXES[key];
      deltas.push(`tier: null → ${TIER_FIXES[key]}`);
    }

    // 2.C — Populate canonical raidTypes
    const currentRaidTypes = Array.isArray(meta.raidTypes) ? meta.raidTypes : [];
    const canonical = canonicalRaidTypes(eff);
    if (canonical.length && JSON.stringify(currentRaidTypes) !== JSON.stringify(canonical)) {
      updatePayload["flags.bbttcc.meta.raidTypes"] = canonical;
      deltas.push(`raidTypes: ${JSON.stringify(currentRaidTypes)} → ${JSON.stringify(canonical)}`);
    } else if (!canonical.length && !currentRaidTypes.length) {
      unresolvedRaidTypes.push({ key, name: normalizedNameVal, effects: eff?.raidTypes || null });
    }

    // 2.B — Text fixes
    const fixes = TEXT_FIXES[key];
    if (fixes) {
      const before = doc.system?.description?.value || "";
      let after = before;
      for (const [pat, rep] of fixes) after = after.replace(pat, rep);
      if (after !== before) {
        updatePayload["system.description.value"] = after;
        const sample = (before.match(fixes[0][0]) || [])[0];
        deltas.push(`description: replace "${sample}" → "${fixes[0][1]}"`);
      }
    }

    // 2.D — Verify hit
    if (VERIFY_KEYS.has(key)) {
      verifyHits.push({ key, name: normalizedNameVal, tier: meta.tier });
    }

    if (deltas.length > 0) {
      updates.push({ _id: doc.id, name: normalizedNameVal, key, payload: updatePayload, deltas });
      if (VERBOSE_PER_ENTRY) console.log("[refresh]", normalizedNameVal, deltas);
    } else {
      skipped.push({ key, name: normalizedNameVal });
    }
  }

  // ── apply if not DRY_RUN ───────────────────────────────────────────────────
  let applied = 0;
  if (!DRY_RUN && updates.length) {
    const payloads = updates.map((u) => u.payload);
    try {
      const result = await pack.documentClass.updateDocuments(payloads, { pack: PACK_ID });
      applied = Array.isArray(result) ? result.length : payloads.length;
      ui.notifications?.info(`Refreshed ${applied} maneuvers in ${PACK_ID}`);
    } catch (e) {
      console.error("[refresh] updateDocuments failed", e);
      ui.notifications?.error("Refresh failed — see console");
    }
  }

  // ── report ─────────────────────────────────────────────────────────────────
  console.groupCollapsed(`[doctrines-refresh] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — ${updates.length} updates, ${skipped.length} skipped`);
  console.log("updates:", updates);
  console.log("skipped:", skipped);
  console.log("unresolved raidTypes:", unresolvedRaidTypes);
  console.log("verify-then-decide hits:", verifyHits);
  console.groupEnd();

  const deltaRows = updates.map((u) => {
    const items = u.deltas.map((d) => `<li>${d.replace(/</g, "&lt;")}</li>`).join("");
    return `<details style="margin:2px 0"><summary><b>${u.name}</b> <code>${u.key}</code> · ${u.deltas.length} changes</summary><ul style="margin:4px 0 4px 18px;padding:0">${items}</ul></details>`;
  }).join("");

  const unresolvedRows = unresolvedRaidTypes.length
    ? `<details style="margin-top:8px"><summary><b style="color:#a05">⚠ ${unresolvedRaidTypes.length} entries with unresolved raidTypes</b> (hand-tag needed)</summary><ul style="margin:4px 0 4px 18px">${unresolvedRaidTypes.map((u) => `<li><code>${u.key}</code> — ${u.name} · effects.raidTypes=${JSON.stringify(u.effects)}</li>`).join("")}</ul></details>`
    : "";

  const verifyRows = verifyHits.length
    ? `<details style="margin-top:8px"><summary><b>🔎 ${verifyHits.length} verify-then-decide entries</b> (Spec §2.D — hand review)</summary><ul style="margin:4px 0 4px 18px">${verifyHits.map((v) => `<li><code>${v.key}</code> — ${v.name} (T${v.tier ?? "?"})</li>`).join("")}</ul></details>`
    : "";

  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  const summary =
`<div style="font-family:var(--font-primary)">
<h3 style="margin:0 0 6px">🔧 Maneuver Catalog Refresh — ${mode}</h3>
<div style="font-size:11px;line-height:1.4">
<b>${updates.length}</b> entries with changes · <b>${skipped.length}</b> unchanged · <b>${applied}</b> written
</div>
${verifyRows}
${unresolvedRows}
<details style="margin-top:8px"><summary><b>Per-entry deltas</b> (click to expand)</summary>${deltaRows || "<i>no changes</i>"}</details>
${DRY_RUN ? '<p style="margin-top:8px;font-size:11px"><b>To apply:</b> edit macro, set <code>DRY_RUN = false</code>, re-run.</p>' : ""}
</div>`;

  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
