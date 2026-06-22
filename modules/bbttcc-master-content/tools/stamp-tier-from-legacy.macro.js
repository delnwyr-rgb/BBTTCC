// Bad Eden — Consolidate stray flags.rfi.item → flags.fourththing.rfi.item (pack + world)
// ─────────────────────────────────────────────────────────────────────────────
// Ported items carry a SPLIT identity: tier/frame/origin/bound live in a stray
// `flags.rfi.item` namespace, while the system reads `flags.fourththing.rfi.item`
// (which often lacks them → items show as "gear" with no tier marking). This copies
// the missing fields from the stray namespace into the canonical one, so tier
// markings appear (and surface-mechanics can print "Tier: IV").
//
// FILL-ONLY: never overwrites a value already set in fourththing.rfi.item — it only
// fills blanks from flags.rfi.item. Covers pack + world. Idempotent. DRY_RUN toggle.
// Run, then re-run surface-mechanics so the ⚙️ blocks pick up the new Tier lines.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const DRY_RUN = false;            // <-- true to preview only
const INCLUDE_WORLD_ITEMS = true;
const FIELDS = ["tier", "frame", "origin", "bound", "reach", "footprint"];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);

  const present = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  async function handle(label, docs, applyFn) {
    const updates = [];
    for (const item of docs) {
      const stray = item.flags?.rfi?.item ?? {};
      const canon = item.flags?.fourththing?.rfi?.item ?? {};
      const upd = { _id: item.id };
      const got = [];
      for (const f of FIELDS) {
        if (!present(canon[f]) && present(stray[f])) {
          upd[`flags.fourththing.rfi.item.${f}`] = stray[f];
          got.push(`${f}=${stray[f]}`);
        }
      }
      if (got.length > 1) { // _id + at least one field
        updates.push(upd);
        console.log(`• ${item.name}: ${got.join(", ")}`);
      }
    }
    console.log(`%c[${label}] ${updates.length} item(s) stamped`, "color:#ffb000;font-weight:bold");
    if (!DRY_RUN && updates.length) await applyFn(updates);
    return updates.length;
  }

  let total = 0;
  console.group("%cstamp-tier-from-legacy", "color:#ffb000;font-weight:bold");
  total += await handle(`pack:${PACK_ID}`, await pack.getDocuments(), async (u) => {
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try { await Item.updateDocuments(u, { pack: PACK_ID }); }
    finally { if (wasLocked) await pack.configure({ locked: true }); }
  });
  if (INCLUDE_WORLD_ITEMS) total += await handle("world-items", Array.from(game.items), async (u) => { await Item.updateDocuments(u); });
  console.groupEnd();

  ui.notifications.info(`Tier stamp: ${total} item(s) ${DRY_RUN ? "WOULD be" : "were"} stamped from legacy flags (pack + world)` + (DRY_RUN ? " (DRY RUN)." : "."));
})();
