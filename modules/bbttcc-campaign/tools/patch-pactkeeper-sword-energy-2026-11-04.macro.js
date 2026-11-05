/**
 * patch-pactkeeper-sword-energy-2026-11-04.macro.js — Dave 2026-11-04: Pactkeepers start with Sword Energy (the melee skill).
 * Adds "Class L1: Sword Energy +1" to Pactkeeper: Core Features in the classes pack (baked at build by ft-progression), and sets Melee 1 on world Pactkeepers with no rank.
 * Idempotent. DRY_RUN first (globalThis.__pkDry = false applies). GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__pkDry !== false;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const NAME = "Class L1: Sword Energy +1", CORE = "Pactkeeper: Core Features";
  const report = [];
  // Cloned from the item's own Brawl effect, so it keeps the running Foundry version's effect shape.
  const effectData = (item) => {
    const o = item.effects.find(e => e.changes.some(c => c.key === "system.skills.brawl.value")).toObject();
    o._id = "PkSwordEnergy001"; o.name = NAME; o.origin = item.uuid;
    o.system.changes = o.system.changes.map(c => ({ ...c, key: "system.skills.melee.value" }));
    return o;
  };
  const has = (item) => item.effects.some(e => e.changes.some(c => c.key === "system.skills.melee.value"));
  const pack = game.packs.get("bbttcc-master-content.classes");
  const row = (await pack.getIndex()).find(x => x.name === CORE);
  const packDoc = row ? await pack.getDocument(row._id) : null;
  if (!packDoc) throw new Error("no Core Features in the pack");
  const packNeeds = !has(packDoc);
  report.push(`pack: ${packNeeds ? "add" : "ok"}`);
  const actors = [];
  for (const a of game.actors) {
    if (a.type !== "character" || !a.items.some(i => i.type === "class" && i.system?.identifier === "pactkeeper")) continue;
    const item = a.items.find(i => i.name === CORE); if (!item) continue;
    const base = Number(a._source?.system?.skills?.melee?.value) || 0;
    // ft-progression bakes a class effect into the sheet and disables it at build time, so a built Steward takes the rank directly.
    if (base > 0) { report.push(`${a.name}: already Melee ${base}`); continue; }
    actors.push({ a, item, addEffect: !has(item) }); report.push(`${a.name}: Melee → 1`);
  }
  console.log(`[pactkeeper sword energy] ${DRY_RUN ? "DRY RUN" : "APPLY"}\n` + report.join("\n"));
  globalThis.__pk = { dry: DRY_RUN, report };
  if (DRY_RUN) return;
  if (packNeeds) {
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try { await packDoc.createEmbeddedDocuments("ActiveEffect", [effectData(packDoc)], { keepId: true }); }
    finally { if (wasLocked) await pack.configure({ locked: true }); }
  }
  for (const { a, item, addEffect } of actors) {
    if (addEffect) { const o = effectData(item); o.disabled = true; await item.createEmbeddedDocuments("ActiveEffect", [o], { keepId: true }); }
    await a.update({ "system.skills.melee.value": 1 });
  }
  ui.notifications.info("Pactkeepers now start with Sword Energy.");
})();
