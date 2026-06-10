// Bad Eden — Patch Base Ancestries to Use New Consolidated Cores (v1.1)
// ─────────────────────────────────────────────────────────────────────────────
// Run this AFTER compile-loose-packs.macro.js has populated the Cores into the
// Bad Eden Ancestries compendium. This macro:
//
//   1. Looks up each of the 4 base ancestry items in the LDB by identifier
//      (menhirkin, echo_diver, qliph_scarred, sephirotic_scion).
//   2. Looks up the matching new Core item by its slug identifier
//      (menhirkin_core, echo_diver_core, ...).
//   3. Drops the old per-trait Core ItemGrant advancements by title.
//   4. Inserts one new ItemGrant pointing at the consolidated Core.
//   5. Leaves Size, Strategic Hooks, and non-Core extras (Stonebound) in place.
//
// Idempotent: if the Core advancement is already present (title match), no
// changes are written. Safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────

const DRY_RUN = false;   // flip true to preview
const PACK_ID = "bbttcc-master-content.ancestries";

// Each entry: ancestry root identifier → { core slug, list of advancement
// TITLES to drop (these were the legacy per-trait Cores). Strategic Hooks
// and Menhirkin's "Stonebound" are intentionally NOT in the drop list.
const PLAN = {
  menhirkin:        { coreIdentifier: "menhirkin_core",        coreTitle: "Menhirkin Core: The Land Stood Up",        drop: ["Heartstone", "Stone Memory", "Gravity Well", "Living Rampart"] },
  echo_diver:       { coreIdentifier: "echo_diver_core",       coreTitle: "Echo-Diver Core: Half-Second Inheritance", drop: ["Amphibious Physiology", "Echo Sense", "Spark Conductor", "Temporal Afterimage", "Vault Sight"] },
  qliph_scarred:    { coreIdentifier: "qliph_scarred_core",    coreTitle: "Qliph-Scarred Core: What Walked Out",       drop: ["Shadow Resilience", "Qliphothic Saturation", "Hunger Mask", "Shadow-Wake"] },
  sephirotic_scion: { coreIdentifier: "sephirotic_scion_core", coreTitle: "Sephirotic Scion Core: The Higher Register", drop: ["Sephirotic Physiology", "Sefirot Attunement", "Holy Conduit", "Light of Harmony"] }
};

if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack not found: ${PACK_ID}`); return; }

// Unlock pack for writes.
if (pack.locked) {
  try { await pack.configure({ locked: false }); } catch (e) { console.warn("pack unlock failed", e); }
}

// Build full document index so we can look up by identifier.
const allDocs = await pack.getDocuments();
const byIdentifier = new Map();
for (const d of allDocs) {
  const id = String(d.system?.identifier ?? "").toLowerCase();
  if (id) byIdentifier.set(id, d);
}

const rid = (n = 16) => {
  const a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = ""; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};

const results = [];
for (const [ancestryIdent, plan] of Object.entries(PLAN)) {
  const base = byIdentifier.get(ancestryIdent);
  const core = byIdentifier.get(plan.coreIdentifier);
  const row = { ancestry: ancestryIdent, baseFound: !!base, coreFound: !!core, dropped: [], added: false, skipped: false, error: null };
  if (!base) { row.error = `base ancestry not found (identifier="${ancestryIdent}")`; results.push(row); continue; }
  if (!core) { row.error = `core item not found (identifier="${plan.coreIdentifier}") — run compile-loose-packs first`; results.push(row); continue; }

  const advs = foundry.utils.deepClone(base.system?.advancement ?? []);
  const dropTitles = new Set(plan.drop);
  const kept = [];
  for (const a of advs) {
    if (a?.type === "ItemGrant" && dropTitles.has(a.title)) { row.dropped.push(a.title); continue; }
    kept.push(a);
  }

  // Already has the new Core advancement? Skip.
  const alreadyHasCore = kept.some(a => a?.type === "ItemGrant" && a.title === plan.coreTitle);
  if (alreadyHasCore && row.dropped.length === 0) {
    row.skipped = true; results.push(row); continue;
  }

  if (!alreadyHasCore) {
    const coreUuid = `Compendium.${PACK_ID}.Item.${core.id}`;
    const coreAdv = {
      _id: rid(16),
      type: "ItemGrant",
      configuration: {
        items: [{ uuid: coreUuid, optional: false }],
        optional: false,
        spell: null
      },
      value: {},
      level: 0,
      title: plan.coreTitle,
      hint: `Gain the ${core.name.split(":")[0]} Core traits at character creation.`
    };
    // Insert after Size (if present) or at the front.
    let insertAt = 0;
    for (let i = 0; i < kept.length; i++) { if (kept[i]?.type === "Size") { insertAt = i + 1; break; } }
    kept.splice(insertAt, 0, coreAdv);
    row.added = true;
  }

  if (DRY_RUN) { results.push(row); continue; }
  try {
    await base.update({ "system.advancement": kept }, { diff: false, recursive: false });
  } catch (e) {
    row.error = `update failed: ${e.message}`;
  }
  results.push(row);
}

// Chat summary card.
const rowsHtml = results.map(r => {
  const status =
    r.error ? `<span style="color:#f87171">ERROR: ${foundry.utils.escapeHTML(r.error)}</span>` :
    r.skipped ? `<span style="opacity:0.65">up-to-date (skipped)</span>` :
    `added core${r.dropped.length ? `, dropped [${r.dropped.join(", ")}]` : ""}`;
  return `<tr>
    <td><code>${r.ancestry}</code></td>
    <td>${r.baseFound ? "✓" : "—"}</td>
    <td>${r.coreFound ? "✓" : "—"}</td>
    <td>${status}</td>
  </tr>`;
}).join("");

ChatMessage.create({
  speaker: { alias: "Bad Eden v1.1 Patch" },
  content: `
<h3>Base-Ancestry Core Patch ${DRY_RUN ? "— DRY RUN" : ""}</h3>
<table style="border-collapse:collapse;width:100%;font-size:0.85em;">
  <thead><tr><th align="left">Ancestry</th><th>Base?</th><th>Core?</th><th align="left">Action</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<p style="opacity:0.7;font-size:0.8em;margin-top:0.5rem;">If any row errors with "core item not found", run <code>compile-loose-packs.macro.js</code> first to create the Cores, then re-run this macro.</p>
  `
});

console.log("[bbttcc v1.1 patch]", results);
return results;
