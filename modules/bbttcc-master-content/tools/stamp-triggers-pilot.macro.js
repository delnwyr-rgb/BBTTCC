// Bad Eden — Pilot batch: stamp Phase C triggers on 5 high-visibility items
// ─────────────────────────────────────────────────────────────────────────────
// Verifies the trigger engine end-to-end before bulk-authoring.
//
// Schema per item entry:
//   flags.fourththing.triggers = [{
//     event:    "<closed enum>",
//     predicate?: { tag?:[...], dieMin?:N, scope?:... },
//     limit?:   { window:..., uses:N },
//     effect:   { kind, args }
//   }]
//
// Looks each item up by NAME (Foundry pack _ids may have drifted). Idempotent.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }
const DRY_RUN = false;

const BATCH = [
  // Bulwark Polarity Mastery — "+1 Frame Die when you score successful melee strike (any die ≥ 8)"
  // The canonical trigger — predicate uses dieMin AND tag match.
  {
    name: "Bulwark — Tier 3: Polarity Mastery",
    triggers: [
      {
        event: "on-attack-hit",
        predicate: { tag: ["melee"], dieMin: 8 },
        effect:    { kind: "grant-resource", args: { resource: "frame-die", amount: 1, target: "self" } }
      }
    ]
  },
  // Mountain L1 Inverted Foundation — "gain 1 Ruin Charge when you take damage ≥ Violence + Bulwark Initiation"
  // amountMin is dynamic per actor; we use a static threshold for v1 — GM adjudicates edge cases.
  {
    name: "Mountain L1: Inverted Foundation",
    triggers: [
      {
        event: "on-damage-taken",
        predicate: { amountMin: 5 },  // approx — refine after first session
        limit:     { window: "scene", uses: 3 },
        effect:    { kind: "grant-resource", args: { resource: "ruin-charge", amount: 1, target: "self" } }
      }
    ]
  },
  // Wayfarer Tongue L1 — "On delivery: faction gains +1 Intrigue OP, your Pace pool refills"
  {
    name: "Wayfarer Tongue L1: The Tongue That Does Not Lie",
    triggers: [
      { event: "on-delivery",
        effect: { kind: "grant-resource", args: { resource: "intrigue-op", amount: 1, target: "faction" } } },
      { event: "on-delivery",
        effect: { kind: "grant-resource", args: { resource: "pace", amount: 8, target: "self" } } }
    ]
  },
  // Shadow Courier Liminal Operator — "Gain 1 Pace when you move at least 30 feet on your turn"
  // on-move event isn't yet wired (deferred to Phase 2); this one stays dormant until then.
  {
    name: "Shadow Courier — Tier 1: Liminal Operator",
    triggers: [
      {
        event: "on-move",
        predicate: { amountMin: 30 },
        limit:     { window: "turn", uses: 1 },
        effect:    { kind: "grant-resource", args: { resource: "pace", amount: 1, target: "self" } }
      }
    ]
  },
  // Hearth-Reader — "you cannot be surprised by social patterns"
  // This is a passive-protection trigger. Use a chat-prompt for now since we
  // don't have a "surprise" event hook.
  {
    name: "Human (Neanderthal): Hearth-Reader",
    triggers: [
      {
        event: "on-skill-fail",
        predicate: { tag: ["insight"] },
        effect:    { kind: "chat-prompt", args: { body: "Hearth-Reader: GM, consider whether the social pattern was telegraphed and the failure should be re-narrated." } }
      }
    ]
  }
];

async function findItemByName(name) {
  for (const pack of game.packs.values()) {
    if (pack.documentName !== "Item") continue;
    try {
      const idx = await pack.getIndex({ fields: ["name"] });
      const hit = idx.find(e => e.name === name);
      if (hit) {
        if (pack.locked) {
          try { await pack.configure({ locked: false }); }
          catch (e) { console.warn("[triggers] could not unlock", pack.collection, e); }
        }
        const doc = await pack.getDocument(hit._id);
        if (doc) return { doc, pack: pack.collection };
      }
    } catch (e) { console.warn("[triggers] index lookup failed for", pack.collection, e); }
  }
  return null;
}

const summary = { synced: [], skipped: [], errors: [], notFound: [] };

for (const job of BATCH) {
  try {
    const found = await findItemByName(job.name);
    if (!found) { summary.notFound.push(job.name); continue; }
    const { doc: liveItem, pack } = found;
    const existing = liveItem.flags?.fourththing?.triggers;
    if (Array.isArray(existing) && existing.length > 0) {
      summary.skipped.push(`${job.name} (${pack}): already has ${existing.length} trigger(s)`);
      continue;
    }
    if (DRY_RUN) {
      summary.synced.push(`[dry] ${job.name}: would add ${job.triggers.length}`);
      continue;
    }
    await liveItem.setFlag("fourththing", "triggers", job.triggers);
    summary.synced.push(`${job.name}: +${job.triggers.length} trigger(s)`);
  } catch (err) {
    summary.errors.push(`${job.name}: ${err.message}`);
    console.error("[triggers]", job, err);
  }
}

const lines = [
  `=== Stamp Triggers — Pilot (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
  `Synced:    ${summary.synced.length}`,
  `Skipped:   ${summary.skipped.length}`,
  `Not found: ${summary.notFound.length}`,
  `Errors:    ${summary.errors.length}`,
  ...(summary.notFound.length ? ["", "Items not found:", ...summary.notFound.map(s => `  ✗ ${s}`)] : []),
  ...(summary.errors.length ? ["", "Errors:", ...summary.errors.map(s => `  ✗ ${s}`)] : []),
  "", "Synced:", ...summary.synced.map(s => `  ✓ ${s}`),
  ...(summary.skipped.length ? ["", "Skipped:", ...summary.skipped.map(s => `  · ${s}`)] : [])
];
console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.78rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();
