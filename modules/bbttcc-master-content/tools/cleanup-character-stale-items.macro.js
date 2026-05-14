// BBTTCC — Cleanup stale heritage items + duplicates on a character
// ─────────────────────────────────────────────────────────────────────────────
// Walks the SELECTED character actor (selected token, or the prompted actor)
// and identifies:
//   1. Items whose parenthetical sub-heritage doesn't match the actor's
//      current heritage flag (e.g. "Human (Neanderthal): Thick-Boned" on a
//      Denisovan character).
//   2. Heritage WRAPPER items ("<Family> Heritage: <X>") whose X doesn't match
//      the current heritage.
//   3. Exact-name duplicate items (same item dropped twice).
//   4. Orphaned `flags.fourththing.startingGrantsFiredItems` records pointing
//      to items that no longer exist on the character (so re-applying grants
//      works cleanly after a heritage swap).
//
// SAFETY: DRY_RUN=true by default. First run lists, doesn't delete.
// Re-paste with DRY_RUN=false to actually clean up.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
if (!game.user?.isGM) { ui.notifications.warn("GM-only macro."); return; }

const DRY_RUN = false;     // ← flip to false ONLY after reviewing the report

// Resolve target actor — prefer selected token, fallback to user.character.
const tokens = canvas.tokens?.controlled ?? [];
const actor  = tokens[0]?.actor ?? game.user.character;
if (!actor) {
  ui.notifications.warn("Select a character token first (or set User.character).");
  return;
}

// Pull current identity (same source the sheet uses).
const coTop  = actor.flags?.["bbttcc-character-options"] ?? {};
const heritageRaw = coTop.nativeLinks?.heritageName ?? "";
const heritageNow = String(heritageRaw).replace(/^[^:]+Heritage:\s*/i, "").trim();
const ancestryNow = coTop.nativeLinks?.ancestryName ?? "";

if (!heritageNow) {
  ui.notifications.warn(`No heritage flag found for ${actor.name}. Set heritage first via the wizard or sheet.`);
  return;
}

// ── Pass 1 + 2 ── stale heritage residue
//   "<Family> (<Sub>): <FeatName>"  → Sub must == heritageNow
//   "<Family> Heritage: <Sub>"      → Sub must == heritageNow
const stale = [];
for (const item of actor.items ?? []) {
  const name = item.name ?? "";
  // Heritage WRAPPER form: e.g. "Human Heritage: Neanderthal"
  const wrapperMatch = name.match(/^(.+?)\s+Heritage:\s+(.+)$/i);
  if (wrapperMatch) {
    const wrapHeritage = wrapperMatch[2].trim();
    if (wrapHeritage.toLowerCase() !== heritageNow.toLowerCase()) {
      stale.push({ id: item.id, name, reason: `wrapper for ${wrapHeritage} (current: ${heritageNow})` });
    }
    continue;
  }
  // Sub-heritage feat form: e.g. "Human (Neanderthal): Thick-Boned"
  const featMatch = name.match(/^([^(]+)\s+\(([^)]+)\)\s*:/);
  if (featMatch) {
    const sub = featMatch[2].trim();
    if (sub.toLowerCase() !== heritageNow.toLowerCase()) {
      stale.push({ id: item.id, name, reason: `feat from ${sub} (current: ${heritageNow})` });
    }
  }
}

// ── Pass 3 ── exact-name duplicates (keep first, mark rest)
const seen = new Map();
const dupes = [];
for (const item of actor.items ?? []) {
  const key = item.name;
  if (seen.has(key)) {
    dupes.push({ id: item.id, name: item.name, reason: `duplicate of existing item id=${seen.get(key)}` });
  } else {
    seen.set(key, item.id);
  }
}

// Combine deletion candidates (dedupe by id — a stale duplicate would otherwise list twice).
const allDeletionsMap = new Map();
for (const e of [...stale, ...dupes]) {
  if (!allDeletionsMap.has(e.id)) allDeletionsMap.set(e.id, e);
}
const allDeletions = [...allDeletionsMap.values()];

// ── Pass 4 ── stale startingGrantsFiredItems flag entries
const fired = actor.getFlag("fourththing", "startingGrantsFiredItems") ?? {};
const liveItemIds = new Set(actor.items.map(i => i.id));
const orphanFiredIds = Object.keys(fired).filter(id => !liveItemIds.has(id) || allDeletionsMap.has(id));

const lines = [
  `=== Character Cleanup (${DRY_RUN ? "DRY-RUN" : "APPLIED"}) ===`,
  `Target:   ${actor.name}`,
  `Ancestry: ${ancestryNow || "(unset)"}`,
  `Heritage: ${heritageNow}`,
  ""
];

if (stale.length) {
  lines.push(`Stale heritage items (${stale.length}):`);
  for (const e of stale) lines.push(`  ${DRY_RUN ? "[would delete]" : "✓ deleted"}  ${e.name} — ${e.reason}`);
  lines.push("");
}
if (dupes.length) {
  lines.push(`Duplicate items (${dupes.length}):`);
  for (const e of dupes) lines.push(`  ${DRY_RUN ? "[would delete]" : "✓ deleted"}  ${e.name} — ${e.reason}`);
  lines.push("");
}
if (orphanFiredIds.length) {
  lines.push(`Orphan grant-fired records (${orphanFiredIds.length}):`);
  for (const id of orphanFiredIds) lines.push(`  ${DRY_RUN ? "[would unset]" : "✓ unset"}  flag id=${id} (${fired[id]?.itemName ?? "?"})`);
  lines.push("");
}
if (!stale.length && !dupes.length && !orphanFiredIds.length) {
  lines.push("Nothing to clean up. ✓");
}

if (!DRY_RUN) {
  if (allDeletions.length) {
    try {
      await actor.deleteEmbeddedDocuments("Item", allDeletions.map(e => e.id));
    } catch (err) {
      lines.push(`✗ Delete failed: ${err.message}`);
      console.error("[cleanup]", err);
    }
  }
  if (orphanFiredIds.length) {
    const newFired = { ...fired };
    for (const id of orphanFiredIds) delete newFired[id];
    await actor.setFlag("fourththing", "startingGrantsFiredItems", newFired);
  }
}

if (DRY_RUN) {
  lines.push("→ DRY RUN. To apply: change DRY_RUN to false at the top of the macro and re-run.");
}

console.log(lines.join("\n"));
ChatMessage.create({
  user: game.user.id,
  content: `<pre style="font-size:0.78rem;white-space:pre-wrap">${lines.join("\n")}</pre>`,
  whisper: [game.user.id]
});
})();
