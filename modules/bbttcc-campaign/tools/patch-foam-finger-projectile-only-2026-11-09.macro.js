/*
 * patch-foam-finger-projectile-only-2026-11-09.macro.js — Dave's Fixit stalker fight (2026-11-09): JESSIE's Foam Finger
 * ("once per scene, when you would take damage from a non-magical projectile, the foam absorbs the hit") was offered on
 * every melee claw — its on-incoming-damage trigger matched tag "kinetic". The system now tags incoming damage with its
 * delivery (ftDeliveryTags: melee / ranged / projectile / manifestation); this narrows the trigger to "projectile"
 * on every Foam Finger item (character + NPC actors, world items, the bbttcc-master-content.items pack).
 * Repo source JSON changed in the same commit. Ember Bad Eden. globalThis.__foamDry = false applies. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__foamDry !== false;
  const report = { DRY_RUN, fixed: [], skipped: [] };
  async function fix(it, where) {
    if (!/Foam Finger/.test(it.name)) return;
    const trig = foundry.utils.deepClone(it.flags?.fourththing?.triggers ?? []);
    let changed = false;
    for (const t of trig) if (t?.event === "on-incoming-damage" && JSON.stringify(t.predicate?.tag) !== JSON.stringify(["projectile"])) { t.predicate = { ...(t.predicate || {}), tag: ["projectile"] }; changed = true; }
    if (!changed) return;
    report.fixed.push(`${where}: ${it.name}`);
    if (!DRY_RUN) await it.update({ "flags.fourththing.triggers": trig });
  }
  for (const a of game.actors.contents) for (const it of a.items.contents) { try { await fix(it, a.name); } catch (e) { report.skipped.push(`${a.name}: ${e.message}`); } }
  for (const it of game.items.contents) { try { await fix(it, "world"); } catch (e) { report.skipped.push(`world: ${e.message}`); } }
  const pack = game.packs.get("bbttcc-master-content.items");
  if (pack) {
    const wasLocked = pack.locked;
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    try { for (const e of (await pack.getIndex()).filter(e => /Foam Finger/.test(e.name))) await fix(await pack.getDocument(e._id), "pack"); }
    finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  }
  console.log("FOAM " + JSON.stringify(report));
  return report;
})();
