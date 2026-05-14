// Stamp Human Phase 4 passive flags. Idempotent.
//   - human-erectus-trail_sovereign: rerolls += athletics check w/ note (chase/escape/travel-hazard)
(async () => {
  const NOTE_TRAIL = "during chases, escapes, or travel hazards (Trail-Sovereign)";

  const stampTrailSovereign = async (doc) => {
    const flags = foundry.utils.deepClone(doc.flags ?? {});
    flags.fourththing ??= {};
    flags.fourththing.rerolls ??= [];
    const existingNotes = new Set(flags.fourththing.rerolls.map(g => g.note ?? ""));
    if (existingNotes.has(NOTE_TRAIL)) return { status: "skip" };
    flags.fourththing.rerolls.push({ context: "check", skill: "athletics", mode: "reroll-lowest", note: NOTE_TRAIL });
    await doc.update({ flags });
    return { status: "ok" };
  };

  const ROUTES = { "human-erectus-trail_sovereign": stampTrailSovereign };

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
  let actorOK = 0;
  for (const actor of game.actors) {
    for (const item of actor.items) {
      const fn = ROUTES[item.system?.identifier ?? ""];
      if (!fn) continue;
      const r = await fn(item);
      if (r.status === "ok") { actorOK++; console.log(`  [${actor.name}] OK ${item.name}`); }
    }
  }
  for (const actor of game.actors) actor.prepareData();
  ui.notifications.info(`Human Phase 4 passives: pack ${packOK} updated (${packSkip} already canon), ${actorOK} actor items updated.`);
  console.log("DONE");
})();
