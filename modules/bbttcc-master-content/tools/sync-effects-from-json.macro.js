// BBTTCC — Stamp Shape A passive AEs onto live pack items (self-contained)
// ─────────────────────────────────────────────────────────────────────────────
// Run as a GM script macro (Macro Directory → "Script" type → paste → execute).
//
// What it does:
//   For each (packId, itemId, effects[]) entry below, finds the matching item
//   in the live compendium pack and adds any missing Active Effects (matched
//   by name to stay idempotent — re-running won't duplicate).
//
// Why self-contained:
//   The live module tree has LevelDB packs but doesn't mirror every JSON
//   source. Embedding the AE definitions directly avoids any fetch / file-tree
//   sync dependency. The macro IS the source of truth for this batch.
//
// To extend: append entries to BATCH below.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;     // flip to true to preview without writing

// Canonical V14 transferred Active Effect template
function buildAE({ name, key, value, img }) {
  return {
    name,
    img: img ?? "icons/skills/melee/shield-block-bash-yellow.webp",
    type: "base",
    system: {},
    changes: [{ key, value, type: "add", priority: 10 }],
    disabled: false,
    duration: { startTime: 0, seconds: null, combat: null, rounds: null, turns: null, startRound: 0, startTurn: 0 },
    description: `Passive: ${name}`,
    origin: null,
    tint: "#ffffff",
    transfer: true,
    statuses: [],
    sort: 0,
    flags: { fourththing: { passiveAuthored: true, sprint: "passive-ae-2026-04-28" } }
  };
}

const BATCH = [
  // Chunk 2 — Shape A pure-passive AEs (verified item _ids from dev JSONs)
  {
    packId: "bbttcc-master-content.classes",
    itemId: "BlwkClassFt01abc",
    label:  "Bulwark — Tier 1: Founding Stance",
    effects: [
      buildAE({ name: "Founding Stance: Athletics +1", key: "system.skills.athletics.value", value: 1 })
    ]
  },
  {
    packId: "bbttcc-master-content.classes",
    itemId: "ShdwClassFt01abc",
    label:  "Shadow Courier — Tier 1: Liminal Operator",
    effects: [
      buildAE({ name: "Liminal Operator: Stealth +1",   key: "system.skills.stealth.value",   value: 1, img: "icons/skills/movement/feet-winged-boots.webp" }),
      buildAE({ name: "Liminal Operator: Tinkering +1", key: "system.skills.tinkering.value", value: 1, img: "icons/tools/smithing/anvil.webp" })
    ]
  },
  {
    packId: "bbttcc-master-content.ancestries",
    itemId: "RWAuuqy8LInVCgvJ",
    label:  "Cryptidkin (Furrykin): Wildframe & Instinct",
    effects: [
      buildAE({ name: "Wildframe & Instinct: Athletics +1", key: "system.skills.athletics.value", value: 1, img: "icons/creatures/abilities/paw-print-orange.webp" })
    ]
  }
];

const summary = { synced: [], skipped: [], errors: [] };

for (const job of BATCH) {
  try {
    const pack = game.packs.get(job.packId);
    if (!pack) { summary.errors.push(`pack not found: ${job.packId}`); continue; }
    if (pack.locked) {
      try { await pack.configure({ locked: false }); }
      catch (e) { console.warn("[sync-effects] could not unlock", job.packId, e); }
    }

    const liveItem = await pack.getDocument(job.itemId);
    if (!liveItem) { summary.errors.push(`item ${job.itemId} not in pack ${job.packId} (${job.label})`); continue; }

    // Diff by name — only add effects not already present
    const liveEffectNames = new Set(liveItem.effects.map(e => e.name));
    const toAdd = job.effects.filter(e => !liveEffectNames.has(e.name));

    if (toAdd.length === 0) {
      summary.skipped.push(`${job.label}: all ${job.effects.length} effect(s) already present`);
      continue;
    }

    if (DRY_RUN) {
      summary.synced.push(`[dry] ${job.label}: would add ${toAdd.length} — ${toAdd.map(e => e.name).join(", ")}`);
      continue;
    }

    await liveItem.createEmbeddedDocuments("ActiveEffect", toAdd);
    summary.synced.push(`${job.label}: added ${toAdd.length} — ${toAdd.map(e => e.name).join(", ")}`);
  } catch (err) {
    summary.errors.push(`${job.label}: ${err.message}`);
    console.error("[sync-effects]", job, err);
  }
}

const lines = [
  `=== Stamp Shape A Passives (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
  `Synced:  ${summary.synced.length}`,
  ...summary.synced.map(s => `  ✓ ${s}`),
  `Skipped: ${summary.skipped.length}`,
  ...summary.skipped.map(s => `  · ${s}`),
  `Errors:  ${summary.errors.length}`,
  ...summary.errors.map(s => `  ✗ ${s}`),
];
console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.8rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();
