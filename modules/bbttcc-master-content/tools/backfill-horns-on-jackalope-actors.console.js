// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Backfill Horns of Bad Luck onto Jackalope actors (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
// Targeted fallback if the seed-jackalope-horns macro's Job 3 didn't fire.
// Walks every actor with the Jackalope heritage. If they don't have an item
// with identifier `horns_of_bad_luck`, imports a copy from the items pack.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const HORNS_UUID    = "Compendium.bbttcc-master-content.items.Item.HORNSBADLUCK0001";
  const HORNS_IDENT   = "horns_of_bad_luck";
  const HERITAGE_IDENT = "cryptidkin_jackalope_heritage";

  const tmpl = (await fromUuid(HORNS_UUID))?.toObject();
  if (!tmpl) {
    ui.notifications.error(`Could not resolve Horns at ${HORNS_UUID}.`);
    return;
  }

  let touched = 0;
  for (const actor of game.actors) {
    const hasJackalope = actor.items.find(i => i.system?.identifier === HERITAGE_IDENT);
    if (!hasJackalope) continue;
    if (actor.items.find(i => i.system?.identifier === HORNS_IDENT)) {
      console.log(`  · [${actor.name}] already has Horns — skip`);
      continue;
    }
    const obj = foundry.utils.deepClone(tmpl);
    delete obj._id;
    foundry.utils.setProperty(obj, "flags.fourththing.grantedByHeritage", HERITAGE_IDENT);
    try {
      await actor.createEmbeddedDocuments("Item", [obj]);
      touched++;
      console.log(`  ✓ [${actor.name}] backfilled Horns of Bad Luck`);
    } catch (e) {
      console.warn(`  ✗ [${actor.name}] backfill failed: ${e.message}`);
    }
  }

  ui.notifications.info(`Horns backfill: ${touched} Jackalope actor(s) updated.`);
  console.log("DONE");
})();
