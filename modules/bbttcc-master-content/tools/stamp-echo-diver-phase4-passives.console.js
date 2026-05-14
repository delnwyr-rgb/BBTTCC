// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Stamp Echo-Diver Phase 4 passive flags
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent. Wires the passive engine for Echo-Diver:
//   - echo_diver:
//       flags.fourththing.rerolls += Body-check  reroll-lowest (note: env)
//       flags.fourththing.rerolls += Perception  reroll-lowest (note: traps)
//       flags.fourththing.grants.conditionImmunities += "surprise"
//   - echo_diver_empyrean_tier1:
//       flags.fourththing.passives.initiative.bonus = 2
// Walks bbttcc-* Item packs + every actor instance.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const NOTE_BODY      = "vs suffocation, starvation, dehydration, or extreme temperature";
  const NOTE_PERCEPTION = "to notice unstable structure, active traps, trigger plates, load-bearing failures, or Spark / chronoflux residue";

  const stampEchoDiver = async (doc) => {
    const flags = foundry.utils.deepClone(doc.flags ?? {});
    flags.fourththing ??= {};
    flags.fourththing.rerolls ??= [];
    flags.fourththing.grants ??= {};
    flags.fourththing.grants.conditionImmunities ??= [];

    let changed = false;

    const existingNotes = new Set(flags.fourththing.rerolls.map(g => g.note ?? ""));
    const grants = [
      { context: "check", skill: "body",       mode: "reroll-lowest", note: NOTE_BODY },
      { context: "check", skill: "perception", mode: "reroll-lowest", note: NOTE_PERCEPTION }
    ];
    for (const g of grants) {
      if (!existingNotes.has(g.note)) {
        flags.fourththing.rerolls.push(g);
        changed = true;
      }
    }

    const condList = flags.fourththing.grants.conditionImmunities;
    if (!condList.includes("surprise")) {
      condList.push("surprise");
      changed = true;
    }

    if (!changed) return { status: "skip" };
    await doc.update({ flags });
    return { status: "ok" };
  };

  const stampEmpyrean = async (doc) => {
    const flags = foundry.utils.deepClone(doc.flags ?? {});
    flags.fourththing ??= {};
    flags.fourththing.passives ??= {};
    flags.fourththing.passives.initiative ??= {};
    if (flags.fourththing.passives.initiative.bonus === 2) return { status: "skip" };
    flags.fourththing.passives.initiative.bonus = 2;
    await doc.update({ flags });
    return { status: "ok" };
  };

  const ROUTES = {
    "echo_diver":                stampEchoDiver,
    "echo_diver_empyrean_tier1": stampEmpyrean,
  };

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
        if (r.status === "ok") {
          packOK++;
          console.log(`  [${pack.metadata.id}] OK  ${doc.name}`);
        } else {
          packSkip++;
        }
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
      if (r.status === "ok") { actorOK++; touched = true; console.log(`  [${actor.name}] OK  ${item.name}`); }
    }
    if (touched) actorTouched++;
  }

  for (const actor of game.actors) actor.prepareData();

  ui.notifications.info(`Echo-Diver Phase 4 passives: pack ${packOK} updated (${packSkip} already canon), ${actorOK} actor items updated across ${actorTouched} actors.`);
  console.log("DONE");
})();
