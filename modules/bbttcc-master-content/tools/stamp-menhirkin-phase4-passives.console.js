// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Stamp Menhirkin Phase 4 passive flags (species root only)
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent. Stamps three reroll grants on the menhirkin species item:
//   - Heartstone:  Body check reroll-lowest, note "while in a hex your faction controls or has claimed"
//   - Stonebound:  Body check reroll-lowest, note "to resist being pushed, knocked Prone, or otherwise forcibly moved"
//   - Stonebound:  Body check reroll-lowest, note "to build, repair, or fortify structures, siegeworks, defensive emplacements"
// Walks bbttcc-* Item packs + every actor instance.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const NOTE_HEARTSTONE = "while in a hex your faction controls or has claimed (Heartstone)";
  const NOTE_FORCED_MV  = "to resist being pushed, knocked Prone, or otherwise forcibly moved (Stonebound)";
  const NOTE_BUILD      = "to build, repair, or fortify structures, siegeworks, or defensive emplacements (Stonebound)";

  const stampMenhirkin = async (doc) => {
    const flags = foundry.utils.deepClone(doc.flags ?? {});
    flags.fourththing ??= {};
    flags.fourththing.rerolls ??= [];
    let changed = false;

    const existingNotes = new Set(flags.fourththing.rerolls.map(g => g.note ?? ""));
    const grants = [
      { context: "check", attribute: "body", mode: "reroll-lowest", note: NOTE_HEARTSTONE },
      { context: "check", attribute: "body", mode: "reroll-lowest", note: NOTE_FORCED_MV },
      { context: "check", attribute: "body", mode: "reroll-lowest", note: NOTE_BUILD }
    ];
    for (const g of grants) {
      if (!existingNotes.has(g.note)) {
        flags.fourththing.rerolls.push(g);
        changed = true;
      }
    }

    if (!changed) return { status: "skip" };
    await doc.update({ flags });
    return { status: "ok" };
  };

  const ROUTES = { "menhirkin": stampMenhirkin };

  let packOK = 0, packSkip = 0;
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        const id = doc.system?.identifier ?? "";
        const fn = ROUTES[id];
        if (!fn) continue;
        const r = await fn(doc);
        if (r.status === "ok") { packOK++; console.log(`  [${pack.metadata.id}] OK ${doc.name}`); }
        else packSkip++;
      }
    } catch (e) { console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`); }
    if (wasLocked) await pack.configure({ locked: true });
  }

  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const id = item.system?.identifier ?? "";
      const fn = ROUTES[id];
      if (!fn) continue;
      const r = await fn(item);
      if (r.status === "ok") { actorOK++; touched = true; console.log(`  [${actor.name}] OK ${item.name}`); }
    }
    if (touched) actorTouched++;
  }

  for (const actor of game.actors) actor.prepareData();

  ui.notifications.info(`Menhirkin Phase 4 passives: pack ${packOK} updated (${packSkip} already canon), ${actorOK} actor items updated across ${actorTouched} actors.`);
  console.log("DONE");
})();
