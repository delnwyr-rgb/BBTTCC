/**
 * patch-npc-placements-repoint-2026-11-05.macro.js — Dave 2026-11-05: NPC placement rules pointed at scenes that no longer exist, so
 * they were ignored. Each default rule now points at the map where the NPC's token already stands, at that spot. NPCs with tokens on
 * several maps get alsoElsewhere, which the engine must support before they are applied, or viewing another map deletes the token:
 * run with globalThis.__npcMultiOk = true only after a reload on the new module.js.
 * Mara Quickhands, Miliard and Jeargan have no token to go by and are left for Dave. Idempotent.
 * DRY_RUN first (globalThis.__npcDry = false applies). GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__npcDry !== false, MULTI_OK = globalThis.__npcMultiOk === true;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const HOME = [
    ["Father Tamsin", "st_gilliams_interior_pov"], ["Verna Tulliver", "vacancy_interior_front_desk_hexchrome_pov"],
    ["Garren, Leygate Engineer", "allesh gilliam leygate battlemap hexchrome"], ["Elsin Quade", "lyrenn_day_1_pov"],
    ["Drax Calder", "khezek_tor_brace_pov"], ["Brennig Tamsin", "khezek_tor_tainted_shipment_pov"],
    ["Marshal Yarrow Pike", "allesh_gilliam_hq_pov", true], ["Etta Bloom", "long_market", true],
    ["Rowan of the Loam", "lyrenn_day_3_pov", true], ["Sable Nine", "khezek_tor_bad_lift_hall_pov", true]
  ];
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id);
  const placements = foundry.utils.deepClone(c.npcPlacements);
  const report = { DRY_RUN, MULTI_OK, changed: [], waiting: [], ok: [] };
  for (const [name, sceneName, multi] of HOME) {
    const actor = game.actors.getName(name), scene = game.scenes.getName(sceneName);
    const entry = placements.find(p => p.actorId === actor?.id);
    const rule = entry?.rules?.find(r => !r.when?.length);
    if (!rule || !scene) throw new Error(`missing rule or scene for ${name}`);
    if (rule.sceneId === scene.id) { report.ok.push(name); continue; }
    if (multi && !MULTI_OK) { report.waiting.push(name); continue; }
    const tok = scene.tokens.find(t => t.actorId === actor.id);
    if (!tok) throw new Error(`${name} has no token on ${sceneName}`);
    rule.sceneId = scene.id; delete rule.sceneName; rule.x = tok.x; rule.y = tok.y;
    if (multi) rule.alsoElsewhere = true;
    report.changed.push(name);
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, npcPlacements: placements });
  console.log("NPCPLACE " + JSON.stringify(report));
  ui.notifications.info(`NPC placements: ${DRY_RUN ? "dry run" : "applied"}, ${report.changed.length} changed, ${report.waiting.length} waiting.`);
})();
