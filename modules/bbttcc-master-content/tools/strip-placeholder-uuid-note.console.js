// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Strip placeholder-UUID notes from heritage / ancestry items
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM) and hit Enter. Idempotent — safe to re-run.
//
// Removes any <p>...</p> paragraph that mentions both "placeholder" and "UUID"
// (singular or plural), with any words / tags between them. Catches all known
// shapes:
//   • "<strong>Note.</strong> ... placeholder UUID ..."
//   • "<strong>Note:</strong> ... placeholder ItemGrant UUIDs ..."
//   • "<strong>Important:</strong> ... <em>placeholder UUIDs</em> ..."
//
// Operates on (1) every feat/species in bbttcc-master-content.ancestries AND
// (2) every actor's items.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID = "bbttcc-master-content.ancestries";

  // <p>...</p> paragraph containing both "placeholder" and "UUID(s)" with any
  // intervening content. Anchored on <p> so we don't span paragraphs.
  const NOTE_RE = /<p[^>]*>(?:(?!<\/p>).)*?placeholder(?:(?!<\/p>).)*?UUIDs?(?:(?!<\/p>).)*?<\/p>\s*/gis;

  const stripDoc = async (doc) => {
    const val = doc.system?.description?.value ?? "";
    if (!val) return { status: "skip" };
    const newVal = val.replace(NOTE_RE, "");
    if (newVal === val) return { status: "skip" };
    await doc.update({ "system.description.value": newVal });
    return { status: "ok" };
  };

  // ── Pass 1: compendium pack ──────────────────────────────────────────────
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  const index = await pack.getIndex({ fields: ["name", "type"] });
  let packOK = 0;
  for (const entry of index) {
    // Items in this pack are mostly type=feat or type=species. Don't filter —
    // any item with the note is a candidate.
    const doc = await pack.getDocument(entry._id);
    const r = await stripDoc(doc);
    if (r.status === "ok") {
      packOK++;
      console.log(`  [pack] STRIPPED  ${entry.name}`);
    }
  }
  if (wasLocked) await pack.configure({ locked: true });

  // ── Pass 2: every actor's items ──────────────────────────────────────────
  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const r = await stripDoc(item);
      if (r.status === "ok") {
        actorOK++;
        touched = true;
        console.log(`  [${actor.name}] STRIPPED  ${item.name}`);
      }
    }
    if (touched) actorTouched++;
  }

  ui.notifications.info(
    `Placeholder-UUID note: stripped from ${packOK} pack items, ` +
    `${actorOK} actor items across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
