/**
 * Backfill flags.fourththing.creatureType on existing RFI monsters.
 *
 * Monsters created via the Create Monster builder before the creatureType wiring
 * (2026-06-20) carry flags["bbttcc-auto-link"].templateCategory (e.g. "beast")
 * but no flags.fourththing.creatureType — so the Manifestation Engine's
 * "+Xd6 vs <type>" conditional damage can't match them. This copies the
 * category into creatureType wherever it's missing.
 *
 * Idempotent: skips actors that already have a creatureType. DRY_RUN by default —
 * flip to false to write. Scans world actors + all unlocked actor compendia.
 */
const DRY_RUN = true;

const VALID = new Set(["beast","humanoid","undead","construct","aberration","fiend","elemental","swarm"]);

function planFor(actor) {
  // Already set? leave it.
  const cur = actor.flags?.fourththing?.creatureType ?? actor.flags?.fourththing?.creatureTypes;
  if (cur) return null;
  const cat = String(actor.flags?.["bbttcc-auto-link"]?.templateCategory ?? "").toLowerCase();
  if (!VALID.has(cat)) return null;
  return cat;
}

async function run() {
  const rows = [];

  // World actors
  for (const a of game.actors) {
    const cat = planFor(a);
    if (cat) rows.push({ scope: "world", actor: a, cat });
  }

  // Actor compendia (unlocked only)
  for (const pack of game.packs) {
    if (pack.documentName !== "Actor") continue;
    if (pack.locked) continue;
    const docs = await pack.getDocuments();
    for (const a of docs) {
      const cat = planFor(a);
      if (cat) rows.push({ scope: `pack:${pack.collection}`, actor: a, cat });
    }
  }

  if (!rows.length) {
    ui.notifications.info("Backfill creatureType: nothing to do — all monsters already tagged.");
    return;
  }

  const list = rows.map(r => `  • [${r.scope}] ${r.actor.name} → ${r.cat}`).join("\n");
  console.log(`[backfill-creatureType] ${DRY_RUN ? "DRY RUN — would update" : "UPDATING"} ${rows.length} actor(s):\n${list}`);

  if (DRY_RUN) {
    ui.notifications.warn(`Backfill creatureType: DRY RUN — ${rows.length} actor(s) would be tagged. See console (F12). Set DRY_RUN=false to apply.`);
    return;
  }

  let ok = 0;
  for (const r of rows) {
    try { await r.actor.update({ "flags.fourththing.creatureType": r.cat }); ok++; }
    catch (e) { console.warn("[backfill-creatureType] failed", r.actor.name, e); }
  }
  ui.notifications.info(`Backfill creatureType: tagged ${ok}/${rows.length} actor(s).`);
}

run();
