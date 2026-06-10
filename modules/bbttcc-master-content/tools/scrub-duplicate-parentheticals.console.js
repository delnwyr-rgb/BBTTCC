// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Scrub duplicate parentheticals left by Phase 5 vocab scrub
// ─────────────────────────────────────────────────────────────────────────────
// Phase 5's bulk vocab scrub independently rewrote both halves of phrases like
// "1/long rest (Soma Break)" — leaving "1/Soma Break (Soma Break)". The
// existing `(Mind) (Mind)` 3-pass safety in Phase 5 catches `(X) (X)` doubled
// parens but not `X (X)` leading-token duplicates. This macro covers both
// shapes for the RFI vocab tokens most likely to be affected.
//
// Patterns scrubbed:
//   "Soma Break (Soma Break)"     → "Soma Break"
//   "Mind (Mind)" / "(Mind) Mind" → "Mind"  (and same for Body/Soul/Presence/Intellect)
//   "(X) (X)"                     → "(X)"   (safety re-run for the Phase 5 case)
//
// Walks all bbttcc-* Item packs + all actor items. Pure text replace, so
// re-running is naturally idempotent (no sentinel needed).
//
// USAGE
//   1. Set APPLY=true below to commit changes (default false = dry run).
//   2. F12 as GM → paste → Enter.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const APPLY = false;

  // RFI vocab tokens prone to "X (X)" duplication via Phase 5 paired rewrites
  const TOKENS = [
    "Soma Break",
    "Mind", "Body", "Soul", "Presence", "Intellect",
    "Integrity", "Stress", "Clarity", "Surge",
    "tier", "Tier",
  ];

  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Two passes per token (covers both orderings + the doubled-paren shape)
  const buildScrubs = () => {
    const out = [];
    for (const t of TOKENS) {
      const T = escapeRe(t);
      // "Word (Word)" → "Word"
      out.push({ re: new RegExp(`\\b${T}\\s*\\(${T}\\)`, "g"), repl: t, label: `${t} (${t})` });
      // "(Word) Word" → "Word"
      out.push({ re: new RegExp(`\\(${T}\\)\\s*${T}\\b`, "g"), repl: t, label: `(${t}) ${t}` });
      // "(Word) (Word)" → "(Word)"  (safety re-run for the Phase 5 shape)
      out.push({ re: new RegExp(`\\(${T}\\)\\s*\\(${T}\\)`, "g"), repl: `(${t})`, label: `(${t}) (${t})` });
    }
    return out;
  };
  const SCRUBS = buildScrubs();

  const scrubText = (val) => {
    let out = val, hits = {};
    for (const { re, repl, label } of SCRUBS) {
      let n = 0;
      out = out.replace(re, () => { n++; return repl; });
      if (n) hits[label] = (hits[label] ?? 0) + n;
    }
    return { out, hits, changed: Object.keys(hits).length > 0 };
  };

  let packTouched = 0, packReplacements = 0, actorTouched = 0, actorReplacements = 0;
  const summary = {};

  // ── Pack pass ──────────────────────────────────────────────────────────────
  for (const pack of game.packs.values()) {
    if (pack.documentName !== "Item") continue;
    if (!pack.collection.startsWith("bbttcc-")) continue;
    const wasLocked = pack.locked;
    if (wasLocked && APPLY) await pack.configure({ locked: false });
    const idx = await pack.getIndex({ fields: ["name"] });
    for (const e of idx) {
      const doc = await pack.getDocument(e._id);
      const val = doc.system?.description?.value ?? "";
      if (!val) continue;
      const r = scrubText(val);
      if (!r.changed) continue;
      packTouched++;
      for (const [k, n] of Object.entries(r.hits)) {
        packReplacements += n;
        summary[k] = (summary[k] ?? 0) + n;
      }
      console.log(`  [pack:${pack.collection}] ${doc.name} — ${Object.entries(r.hits).map(([k,n]) => `${k}×${n}`).join(", ")}`);
      if (APPLY) {
        await doc.update({ "system.description.value": r.out });
      }
    }
    if (wasLocked && APPLY) await pack.configure({ locked: true });
  }

  // ── Actor pass ─────────────────────────────────────────────────────────────
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const val = item.system?.description?.value ?? "";
      if (!val) continue;
      const r = scrubText(val);
      if (!r.changed) continue;
      touched = true;
      for (const [k, n] of Object.entries(r.hits)) {
        actorReplacements += n;
        summary[k] = (summary[k] ?? 0) + n;
      }
      console.log(`  [actor:${actor.name}] ${item.name} — ${Object.entries(r.hits).map(([k,n]) => `${k}×${n}`).join(", ")}`);
      if (APPLY) {
        await item.update({ "system.description.value": r.out });
      }
    }
    if (touched) actorTouched++;
  }

  console.log(`\n%c=== Scrub summary (APPLY=${APPLY}) ===`, "color:#88ff88;font-weight:bold");
  console.log(`  pack: ${packTouched} items, ${packReplacements} replacements`);
  console.log(`  actors: ${actorTouched} actors, ${actorReplacements} replacements`);
  console.log(`  by pattern:`, summary);
  if (!APPLY) {
    console.log(`%c→ DRY RUN. Set APPLY=true at top of macro to commit.`, "color:#ffaa00");
  }

  ui.notifications.info(
    `Duplicate-paren scrub (${APPLY ? "APPLIED" : "DRY RUN"}): ` +
    `${packTouched} pack items + ${actorTouched} actors, ` +
    `${packReplacements + actorReplacements} replacements.`
  );
})();
