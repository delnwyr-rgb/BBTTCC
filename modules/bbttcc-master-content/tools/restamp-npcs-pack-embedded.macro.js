/* restamp-npcs-pack-embedded.macro.js — Appendix A #36 (2026-10-07): the actors INSIDE bbttcc-master-content.npcs keep their own
 * embedded copies of npc-abilities items, and those copies predate regimen pass 7 (the pass macro only reached game.actors).
 * This GM macro walks every pack actor and re-syncs each embedded item whose NAME matches an npc-abilities pack item, copying
 * flags.fourththing.{rerolls, triggers, passives, npcAuto} when they differ. Writes through Foundry's API (no file-level pack sync).
 * DRY_RUN = true prints the plan. Re-run safe: an already-matching copy is skipped. Also syncs game.actors (idempotent with pass 7).
 */
const DRY_RUN = true;
const NPCS = "bbttcc-master-content.npcs", ABIL = "bbttcc-master-content.npc-abilities";
const KEYS = ["rerolls", "triggers", "passives", "npcAuto"];
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const npcs = game.packs.get(NPCS), abil = game.packs.get(ABIL); if (!npcs || !abil) return ui.notifications.error("packs missing");
  const src = new Map(); for (const d of await abil.getDocuments()) src.set(d.name, d.flags?.fourththing ?? {});
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const log = []; let items = 0, actorsTouched = 0, worldItems = 0;
  const syncActor = async (a, where) => {
    const upd = [];
    for (const it of a.items) {
      const ff = src.get(it.name); if (!ff) continue;
      const u = { _id: it.id };
      for (const k of KEYS) if (ff[k] !== undefined && !eq(ff[k], it.flags?.fourththing?.[k])) u[`flags.fourththing.${k}`] = ff[k];
      if (Object.keys(u).length > 1) upd.push(u);
    }
    if (!upd.length) return 0;
    log.push(`${DRY_RUN ? "·" : "✔"} ${where} ${a.name}: ${upd.map(u => `${a.items.get(u._id).name} [${Object.keys(u).filter(k => k !== "_id").map(k => k.split(".").pop()).join(",")}]`).join("; ")}`);
    if (!DRY_RUN) await a.updateEmbeddedDocuments("Item", upd);
    return upd.length;
  };
  const wasLocked = npcs.locked;
  try {
    if (!DRY_RUN && wasLocked) await npcs.configure({ locked: false });
    for (const a of await npcs.getDocuments()) { const n = await syncActor(a, "[pack]"); if (n) { items += n; actorsTouched++; } }
    for (const a of game.actors) { const n = await syncActor(a, `[world]`); worldItems += n; }
  } finally { if (!DRY_RUN && wasLocked) await npcs.configure({ locked: true }); }
  console.log(`[restamp-npcs-pack-embedded] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${items} embedded item(s) on ${actorsTouched} pack actor(s), ${worldItems} world item(s)\n` + log.join("\n"));
  ui.notifications.info(`npcs-pack restamp ${DRY_RUN ? "dry run" : "applied"}: ${items} pack items / ${actorsTouched} actors, ${worldItems} world — see console (F12).`);
})();
