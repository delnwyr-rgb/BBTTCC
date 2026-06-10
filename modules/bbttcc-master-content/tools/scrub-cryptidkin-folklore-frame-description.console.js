// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Description scrub: cryptidkin-folklore-frame
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent.
// Rewrites the description of the Cryptidkin Core Traits item ("Folklore &
// Frame") to clean RFI canon: removes [TODO(adv-call)] markers, collapses
// duplicated parentheticals, replaces any lingering D&D vocab, preserves the
// per-use callouts and the Phase-6 dispatcher hookups.
//
// Walks ALL bbttcc-* Item packs + all actors. Only re-writes when the existing
// description does NOT already match the canonical text — so safe to re-run.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const TARGET_IDENT = "cryptidkin-folklore-frame";
  const SENTINEL = "data-ft-canon-cryptidkin-folklore-frame=\"v1\"";

  const CANON = `<div ${SENTINEL} style="display:none"></div>
<p><em>"You are not an animal that learned to talk. You are a story the world made into a person because it needed you in the room."</em></p>
<p><strong>Folklore Presence.</strong> 1/Soma Break, when you first meet a community, decide whether the rumors about you arrived first. If yes, reroll the lowest die on your first Diplomacy (Presence) or Intimidation (Presence) check with anyone in that community (your choice which skill, declared when you roll). The rumor is not always flattering — the GM gets to colour it.</p>
<p><strong>Wasteland Adapted.</strong> Reroll the lowest die on defense checks against disease and environmental poison. You can subsist on rations that would sicken most humans (spoiled meat, swamp water, mushroom flesh).</p>
<p><strong>Survivor's Instinct.</strong> 1/Soma Break, when you would drop to 0 Integrity, you may instead drop to 1 Integrity and gain one level of Stress.</p>`;

  const patchDoc = async (doc) => {
    const val = doc.system?.description?.value ?? "";
    if (val.includes(SENTINEL)) return { status: "skip" };
    await doc.update({ "system.description.value": CANON });
    return { status: "ok" };
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
        if (doc.system?.identifier !== TARGET_IDENT) continue;
        const r = await patchDoc(doc);
        if (r.status === "ok") {
          packOK++;
          console.log(`  [${pack.metadata.id}] OK  ${doc.name}`);
        } else {
          packSkip++;
        }
      }
    } catch (e) {
      console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`);
    }
    if (wasLocked) await pack.configure({ locked: true });
  }

  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      if (item.system?.identifier !== TARGET_IDENT) continue;
      const r = await patchDoc(item);
      if (r.status === "ok") {
        actorOK++; touched = true;
        console.log(`  [${actor.name}] OK  ${item.name}`);
      }
    }
    if (touched) actorTouched++;
  }

  ui.notifications.info(
    `cryptidkin-folklore-frame description scrub: pack ${packOK} updated (${packSkip} already canon), ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
