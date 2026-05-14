// BBTTCC — Apply per-campaign-start resource grants to all character actors
// ─────────────────────────────────────────────────────────────────────────────
// For each character actor in the world, walk their items for
// flags.fourththing.resourceGrants entries with cadence "per-campaign-start"
// and fire them. Stamps actor.flags.fourththing.startingGrantsFiredItems
// with item ids so re-running won't double-fire.
//
// Use this:
//   - After bulk-stamping items via stamp-resource-grants-bulk.macro.js
//   - For existing characters who joined the campaign before grants were authored
//   - Whenever a character drags a new heritage item that grants starting OPs
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;

// Use the engine helper exported by ft-progression. Imported into
// game.fourththing.* in module.js — we'll reuse the namespace.
const fire = game.fourththing?.fireResourceGrants
  ?? globalThis.fireResourceGrants;

if (typeof fire !== "function") {
  ui.notifications.error("fireResourceGrants helper not found — system may need a refresh.");
  return;
}

const summary = [];
let totalFired = 0;
let totalActors = 0;

for (const actor of game.actors ?? []) {
  // Only character actors (skip factions, npcs, vehicles)
  if (actor.type !== "character") continue;
  totalActors++;

  const fired = actor.getFlag("fourththing", "startingGrantsFiredItems") ?? {};
  // Find items with per-campaign-start grants we haven't fired for
  const itemsToFire = (actor.items ?? []).filter(i => {
    const grants = i.flags?.fourththing?.resourceGrants;
    if (!Array.isArray(grants)) return false;
    if (!grants.some(g => g.cadence === "per-campaign-start")) return false;
    return !fired[i.id];
  });

  if (itemsToFire.length === 0) {
    summary.push(`· ${actor.name}: nothing pending`);
    continue;
  }

  if (DRY_RUN) {
    summary.push(`[dry] ${actor.name}: would fire ${itemsToFire.length} item(s) — ${itemsToFire.map(i => i.name).join(", ")}`);
    continue;
  }

  // Fire per-campaign-start cadence (the engine helper picks all matching grants)
  const result = await fire(actor, "per-campaign-start");

  // Mark the items as fired (so a second run skips them)
  const newFired = { ...fired };
  for (const i of itemsToFire) newFired[i.id] = { firedAt: Date.now(), itemName: i.name };
  await actor.setFlag("fourththing", "startingGrantsFiredItems", newFired);

  totalFired += result.fired.length;
  const summary_per_actor = result.fired.map(g =>
    `+${g.amount} ${g.resource} → ${g.target} (${g.source})`
  ).join(", ");
  summary.push(`✓ ${actor.name}: fired ${result.fired.length} grant(s) — ${summary_per_actor || "(no matches)"}`);
  if (result.skipped.length) {
    for (const s of result.skipped) {
      summary.push(`  · skipped: ${s.tag} — ${s.reason}`);
    }
  }
}

const lines = [
  `=== Apply Starting Grants (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
  `Characters scanned: ${totalActors}`,
  `Total grants fired: ${totalFired}`,
  "",
  ...summary
];
console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.78rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();
