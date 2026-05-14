// Phase D of the Manifestation Editor Overhaul (2026-05-05). Walks every power
// item the world can reach (world Items + every actor's owned items + every
// Item compendium pack) and backfills `system.damageRoll` from the legacy
// free-text `system.damage` string when the structured shape is still inert.
//
// Idempotent. Safe to re-run. Items that already have damageRoll.op != "none"
// are skipped. Free-text `damage` is left in place for narrative reference.
//
// Best-effort parser for the legacy text:
//   "2d6"       → { number: 2, die: "d6" }
//   "1d8 + 3"   → { number: 1, die: "d8" }   (the +3 is dropped — author
//                                              should pick a faculty instead)
//   "2d10x10"   → { number: 2, die: "d10x10" }
//   anything unparseable → leaves damageRoll.op = "none" (author manually)

(async () => {
  const VALID_DICE = ["d4", "d6", "d8", "d10", "d12", "d10x10"];
  const RX = /^\s*(\d+)\s*(d4|d6|d8|d10x10|d10|d12)\b/i;

  const parseLegacy = (text) => {
    if (!text || typeof text !== "string") return null;
    const m = text.match(RX);
    if (!m) return null;
    const number = Math.max(1, Math.min(20, parseInt(m[1], 10)));
    const die = m[2].toLowerCase().replace("d10x10", "d10x10");
    if (!VALID_DICE.includes(die)) return null;
    return { number, die };
  };

  const fixOne = async (item) => {
    if (item?.type !== "power") return null;
    const sys = item.system ?? {};
    const cur = sys.damageRoll;
    // Skip if already structured (op !== "none" and number > 0)
    if (cur && cur.op && cur.op !== "none" && Number(cur.number) > 0) return null;
    const parsed = parseLegacy(sys.damage);
    if (!parsed) return null;
    const next = {
      op:        "damage",
      number:    parsed.number,
      die:       parsed.die,
      attribute: "",
      type:      String(sys.damageType ?? "kinetic"),
      flavor:    String(sys.damageFlavor ?? ""),
      track:     "integrity"
    };
    try {
      await item.update({ "system.damageRoll": next });
      return { name: item.name, parsed: parsed, type: next.type };
    } catch (err) {
      return { name: item.name, error: String(err?.message ?? err) };
    }
  };

  const changes = [];

  // World Items
  for (const item of game.items) {
    const r = await fixOne(item);
    if (r) changes.push({ scope: "world.items", ...r });
  }

  // Owned items on every actor
  for (const actor of game.actors) {
    for (const item of actor.items) {
      const r = await fixOne(item);
      if (r) changes.push({ scope: `actor:${actor.name}`, ...r });
    }
  }

  // Compendium packs
  for (const pack of game.packs) {
    if (pack.metadata.type !== "Item") continue;
    let docs;
    try { docs = await pack.getDocuments(); }
    catch (err) { console.warn(`[migrate-damageroll] could not load pack ${pack.collection}:`, err); continue; }
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    for (const item of docs) {
      const r = await fixOne(item);
      if (r) changes.push({ scope: `pack:${pack.collection}`, ...r });
    }
    if (wasLocked) await pack.configure({ locked: true });
  }

  console.log("[migrate-damageroll] changes:", changes);
  const summary = changes.length
    ? `Migrated ${changes.length} power items. See console for details. NOTE: legacy "+N" modifiers were dropped — open each item and pick a faculty for the +mod, then re-test cast.`
    : "No legacy damage text to migrate. All power items already structured (or have no parseable dice).";
  ui.notifications.info(summary);
})();
