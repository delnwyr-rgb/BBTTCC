// Retype legacy weapon `system.skill` keys on every weapon item the world can
// reach. Pre-2026-05 weapons were authored with `ranged`, `unarmed`, etc., but
// actor skills use `firearms`, `brawl`, etc. — the engage dialog now resolves
// via alias map at read time, but this macro fixes the source data so the live
// dropdown stays clean even without the resolver.
//
// Idempotent. Safe to re-run. Walks: world Items, every actor's owned items,
// and every Item compendium pack with type === "Item".

(async () => {
  const ALIASES = {
    ranged: "firearms", gun: "firearms", guns: "firearms",
    gunnery: "firearms", archery: "firearms", bow: "firearms", marksmanship: "firearms",
    unarmed: "brawl", fists: "brawl", fist: "brawl", martialarts: "brawl", brawling: "brawl",
    blade: "melee", blades: "melee", sword: "melee", swords: "melee"
  };

  const fixOne = async (item) => {
    if (item?.type !== "weapon") return null;
    const cur = String(item.system?.skill ?? "").toLowerCase().trim();
    if (!cur) return null;
    const next = ALIASES[cur];
    if (!next || next === cur) return null;
    try {
      await item.update({ "system.skill": next });
      return { name: item.name, from: cur, to: next };
    } catch (err) {
      return { name: item.name, from: cur, to: next, error: String(err?.message ?? err) };
    }
  };

  const changes = [];

  // World Items
  for (const item of game.items) {
    const r = await fixOne(item);
    if (r) changes.push({ scope: "world.items", ...r });
  }

  // Owned items on every actor (world)
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
    catch (err) { console.warn(`[retype-skill] could not load pack ${pack.collection}:`, err); continue; }
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    for (const item of docs) {
      const r = await fixOne(item);
      if (r) changes.push({ scope: `pack:${pack.collection}`, ...r });
    }
    if (wasLocked) await pack.configure({ locked: true });
  }

  console.log("[retype-skill] changes:", changes);
  const summary = changes.length
    ? `Retyped ${changes.length} weapon skill keys. See console for details.`
    : "No legacy skill keys found. All weapons are clean.";
  ui.notifications.info(summary);
})();
