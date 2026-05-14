// BBTTCC — Stamp Shape A passives, batch 2 (proficiency/skilled phrasing)
// ─────────────────────────────────────────────────────────────────────────────
// Adds AEs for ancestry/heritage passives whose RFI text uses
// "you have proficiency in X" or "you are skilled in X" — RFI canon = rank 1
// = Trained (per SKILL_RANK_DATA in ft-progression.js).
//
// Run: Macro Directory → Create Macro → Type: Script → paste → execute (GM).
// Idempotent: skips effects already present on the live item by name.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;

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
    flags: { fourththing: { passiveAuthored: true, sprint: "passive-ae-2026-04-28", batch: 2 } }
  };
}

const BATCH = [
  {
    packId: "bbttcc-master-content.ancestries",
    itemId: "kLmFqDPpLUBzqgR2",
    label:  "Menhirkin (Living Rampart)",
    effects: [
      buildAE({ name: "Living Rampart: Athletics +1", key: "system.skills.athletics.value", value: 1, img: "icons/magic/earth/strike-shock-stone.webp" })
    ]
  },
  {
    packId: "bbttcc-master-content.ancestries",
    itemId: "nKHhfdL3U98tJj6r",
    label:  "Oldenborn Stormborn Nomad (Weatherwise)",
    effects: [
      buildAE({ name: "Weatherwise: Athletics +1", key: "system.skills.athletics.value", value: 1, img: "icons/magic/lightning/bolt-strike-yellow.webp" })
    ]
  },
  {
    packId: "bbttcc-master-content.ancestries",
    itemId: "bILvIQnnHx5eVzYb",
    label:  "Oldenborn Rustland Scavenger (Urban Scrounger)",
    effects: [
      buildAE({ name: "Urban Scrounger: Investigation +1", key: "system.skills.investigation.value", value: 1, img: "icons/tools/scribal/magnifying-glass.webp" })
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
      catch (e) { console.warn("[batch-2] could not unlock", job.packId, e); }
    }
    const liveItem = await pack.getDocument(job.itemId);
    if (!liveItem) { summary.errors.push(`item ${job.itemId} not in pack ${job.packId} (${job.label})`); continue; }
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
    console.error("[batch-2]", job, err);
  }
}

const lines = [
  `=== Stamp Shape A Passives — Batch 2 (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
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
