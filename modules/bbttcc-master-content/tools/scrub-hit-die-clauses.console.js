// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Targeted Hit Die clause scrub
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent. Removes the two remaining "Hit Die" clauses that the Phase 5
// bulk scrub left untouched (they don't have a generic find/replace map —
// Hit Die mechanic doesn't exist in RFI). Replaces them with the
// banked-reroll-lowest boon designed 2026-04-29.
//
// Items affected:
//   - human-cro-magnon-first-fire  (Coalition Fire bullet)
//   - oldenborn-embertouched-hearth_dominion  (Hearth Dominion clause)
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const REPLACEMENTS = {
    "human-cro-magnon-first-fire": [
      // Replace the Hit Die bullet with the banked-reroll-lowest boon.
      [/Friendly creatures regain 1 extra Integrity per Hit Die spent during a Soma Break taken at the fire\./gi,
       "After a Soma Break taken at the fire, each friendly creature present gains a single banked reroll-lowest they may spend on any check before the next Soma Break."]
    ],
    "oldenborn-embertouched-hearth_dominion": [
      // Replace "regain an extra Hit Die" with the same boon.
      [/Allies who rest within 30 feet regain an extra Hit Die, and they have reroll the lowest die on saves against fear until their next a? ?Soma Break\.?/gi,
       "Allies who take a Soma Break within 30 feet of the sanctified fire each gain a single banked reroll-lowest they may spend on any check, and they reroll the lowest die on defense checks against fear until their next Soma Break."],
      // Catch the variant that Phase 5 may have left if "long rest"→"Soma Break" already ran:
      [/Allies who rest within 30 feet regain an extra Hit Die, and they have reroll the lowest die on saves against fear until their next Soma Break\.?/gi,
       "Allies who take a Soma Break within 30 feet of the sanctified fire each gain a single banked reroll-lowest they may spend on any check, and they reroll the lowest die on defense checks against fear until their next Soma Break."]
    ],
  };

  const patchDoc = async (doc) => {
    const id = doc.system?.identifier ?? "";
    const rules = REPLACEMENTS[id];
    if (!rules) return { status: "skip" };
    const orig = doc.system?.description?.value ?? "";
    if (!/Hit Di(e|ce)\b/i.test(orig)) return { status: "noop" };  // Already clean
    let next = orig;
    for (const [pat, repl] of rules) next = next.replace(pat, repl);
    if (next === orig) return { status: "noop" };
    await doc.update({ "system.description.value": next });
    return { status: "ok" };
  };

  let packOK = 0, packNoop = 0;
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (!REPLACEMENTS[doc.system?.identifier ?? ""]) continue;
        const r = await patchDoc(doc);
        if (r.status === "ok") {
          packOK++;
          console.log(`  ✓ [${pack.metadata.id}] ${doc.name}`);
        } else if (r.status === "noop") {
          packNoop++;
          console.log(`  · [${pack.metadata.id}] ${doc.name} — already clean`);
        }
      }
    } catch (e) { console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`); }
    if (wasLocked) await pack.configure({ locked: true });
  }

  let actorOK = 0, actorNoop = 0;
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if (!REPLACEMENTS[item.system?.identifier ?? ""]) continue;
      const r = await patchDoc(item);
      if (r.status === "ok") {
        actorOK++;
        console.log(`  ✓ [actor:${actor.name}] ${item.name}`);
      } else if (r.status === "noop") {
        actorNoop++;
      }
    }
  }

  ui.notifications.info(`Hit Die scrub: pack ${packOK} fixed (${packNoop} already clean), actors ${actorOK} fixed (${actorNoop} already clean).`);
  console.log("DONE");
})();
