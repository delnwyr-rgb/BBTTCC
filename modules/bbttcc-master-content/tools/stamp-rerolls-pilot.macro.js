// BBTTCC — Pilot batch: stamp Shape B reroll grants on 4 ancestry feats
// ─────────────────────────────────────────────────────────────────────────────
// Authors `flags.fourththing.rerolls` on a small pilot set so we can verify
// the reroll engine end-to-end before bulk-authoring the remaining ~125 items.
//
// Looks items up BY NAME across all Item packs (the JSON-source _ids don't
// always match live pack _ids — Foundry mints fresh ones at compile).
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;

const BATCH = [
  {
    name: "Human (Neanderthal): Hearth-Reader",
    rerolls: [
      { context: "check", skill: "insight", mode: "reroll-lowest" }
    ]
  },
  {
    name: "Human (Florensis): Burrow Memory",
    rerolls: [
      { context: "check", skill: "athletics", mode: "reroll-lowest" }
    ]
  },
  {
    name: "Oldenborn (Earthbound): Deep-Blooded",
    rerolls: [
      { context: "defense", mode: "reroll-lowest", vs: "poison" },
      { context: "defense", mode: "reroll-lowest", vs: "environmental Stress" }
    ]
  },
  {
    name: "Furrykin (Leporid): Moon-Nerve",
    rerolls: [
      { context: "check", attribute: "intrigue", mode: "reroll-lowest" }
    ]
  }
];

// Find an Item by name across all registered Item packs.
async function findItemByName(name) {
  for (const pack of game.packs.values()) {
    if (pack.documentName !== "Item") continue;
    try {
      const idx = await pack.getIndex({ fields: ["name"] });
      const hit = idx.find(e => e.name === name);
      if (hit) {
        if (pack.locked) {
          try { await pack.configure({ locked: false }); }
          catch (e) { console.warn("[rerolls] could not unlock", pack.collection, e); }
        }
        const doc = await pack.getDocument(hit._id);
        if (doc) return { doc, pack: pack.collection };
      }
    } catch (e) {
      console.warn("[rerolls] index lookup failed for", pack.collection, e);
    }
  }
  return null;
}

const summary = { synced: [], skipped: [], errors: [] };

for (const job of BATCH) {
  try {
    const found = await findItemByName(job.name);
    if (!found) { summary.errors.push(`item not found in any pack: ${job.name}`); continue; }
    const { doc: liveItem, pack } = found;

    const existing = liveItem.flags?.fourththing?.rerolls;
    if (Array.isArray(existing) && existing.length > 0) {
      summary.skipped.push(`${job.name} (${pack}): already has ${existing.length} reroll grant(s)`);
      continue;
    }

    if (DRY_RUN) {
      summary.synced.push(`[dry] ${job.name} (${pack}): would add ${job.rerolls.length} grant(s)`);
      continue;
    }

    await liveItem.setFlag("fourththing", "rerolls", job.rerolls);
    summary.synced.push(`${job.name} (${pack}): +${job.rerolls.length} — ${job.rerolls.map(g => `${g.mode} ${g.context}${g.skill?`/${g.skill}`:""}${g.attribute?`/${g.attribute}`:""}${g.vs?` vs ${g.vs}`:""}`).join("; ")}`);
  } catch (err) {
    summary.errors.push(`${job.name}: ${err.message}`);
    console.error("[rerolls]", job, err);
  }
}

const lines = [
  `=== Stamp Reroll Grants — Pilot (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
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
