// BBTTCC — Patch Steelweave Hauberk (live)
// ─────────────────────────────────────────────────────────────────────────────
// The 2026-05-03 T1 Baseline Armor sprint stamped Steelweave Hauberk's
// kinetic resistance under `flags.fourththing.rfi.item.grants` — which the
// defense engine ignores. The engine reads `flags.fourththing.grants`
// (systems/fourththing/module.js:1985), and expects structured entries
// `[{type:"kinetic"}]` like the Rad Suits use.
//
// This patch:
//   1. Stamps `flags.fourththing.grants.resistances = [{type:"kinetic"}]` on
//      the live Steelweave so the engine actually fires the resist on hit.
//   2. Adds `system.uses = { max: 1, spent: 0 }` so the Reactive Lacing
//      "once per Soma Break" rider has a real tracker that resets at SB.
//   3. Updates the lore prose to match RFI canon (Soma Break, not "scene"),
//      and notes the GM-adjudicated tap-to-spend interaction since auto
//      damage-type-shifting infra doesn't exist yet.
//
// Idempotent — safe to re-run. DRY_RUN = true to preview.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const ITEM_NAME = "Steelweave Hauberk";
const DRY_RUN = false;

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error(`Cannot unlock ${PACK_ID}: ${e.message}`); }
  }

  const docs = await pack.getDocuments();
  const item = docs.find(d => d.name === ITEM_NAME);
  if (!item) return ui.notifications?.error(`Item not found in pack: ${ITEM_NAME}`);

  // Pull existing rfi flag, scrub the misplaced grants block off it.
  const rfiFlag = foundry.utils.deepClone(item.flags?.fourththing?.rfi?.item ?? {});
  if (rfiFlag.grants) delete rfiFlag.grants;

  // Updated lore: Soma Break canon match + GM-adjudication note.
  rfiFlag.lore =
    "<p>A heavy hauberk woven through with a fine tension-thread of reactive yesodium-doped wire, cut and rivetted by a journeyman armorer in one of the older Bad Eden plate-houses. The weave snags incoming force a half-beat before it lands, redistributing it into the wearer's stance instead of their ribs. Heavy. Expensive. Worth it.</p>"
    + "<p><b>Reactive Lacing.</b> While worn, once per Soma Break the wearer may shift one die of incoming kinetic damage into Stress instead of Integrity. GM-adjudicated; tap the item's use tracker when spent. No upkeep, no harmonization — the thread does the thinking.</p>";

  // System block — preserve everything, fix the uses tracker.
  const newSystem = foundry.utils.deepClone(item.system ?? {});
  newSystem.uses = { max: 1, spent: 0 };
  // Mirror stays for sheet display — engine ignores it.
  newSystem.resistances = ["kinetic"];

  const update = {
    _id: item.id,
    "system": newSystem,
    "flags.fourththing.rfi.item": rfiFlag,
    "flags.fourththing.grants": { resistances: [{ type: "kinetic" }] }
  };

  if (DRY_RUN) {
    console.group("Steelweave patch — DRY RUN");
    console.log("Would update:", item.name, item.id);
    console.log("flags.fourththing.grants.resistances →", update["flags.fourththing.grants"].resistances);
    console.log("system.uses →", newSystem.uses);
    console.log("rfi.item.grants stripped:", !rfiFlag.grants);
    console.groupEnd();
    return ui.notifications?.info("DRY RUN — no changes written.");
  }

  await Item.updateDocuments([update], { pack: PACK_ID });
  ui.notifications?.info(`Patched ${ITEM_NAME}: grants path fixed, uses tracker added, lore canon-matched.`);
  console.log(`[steelweave-patch] ${ITEM_NAME} updated.`);
})();
