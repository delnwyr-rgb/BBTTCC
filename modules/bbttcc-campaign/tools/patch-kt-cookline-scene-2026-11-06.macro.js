/*
 * patch-kt-cookline-scene-2026-11-06.macro.js — Dave 2026-11-06: Calder and Sable are met at the cookline, so the cookline and their Act 1 cards share Dave's cook scene (zjvWawdpsN48jE3H)
 * instead of pulling the table to the Brace and Lift Hall views. The original scene ids are kept on beat._deferred.sceneId. Token names follow the actors: Calder, Nine.
 * Ember Bad Eden. globalThis.__ktCookDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__ktCookDry !== false;
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats); const report = { DRY_RUN, moved: [] };
  const COOKLINE = "zjvWawdpsN48jE3H";
  if (!game.scenes.get(COOKLINE)) throw new Error("cook scene not found");
  report.tokens = [];
  for (const sc of game.scenes) for (const t of sc.tokens) {
    const name = t.name === "Drax Caulder" ? "Drax Calder" : (t.name === "Sable 9" ? "Sable Nine" : null);
    if (!name) continue;
    report.tokens.push(`${sc.name}: ${t.name}`);
    if (!DRY_RUN) await t.update({ name });
  }
  for (const bid of ["khezek_tor_town_walk", "khezek_tor_drax_welcome", "kt_drax_answer_chalk", "khezek_tor_sable_welcome", "kt_sable_answer_maps"]) {
    const b = beats.find(x => x.id === bid);
    if (!b || b.sceneId === COOKLINE) continue;
    if (!b._deferred?.sceneId) b._deferred = { ...(b._deferred || {}), sceneId: b.sceneId, at: "2026-11-06" };
    b.sceneId = COOKLINE;
    report.moved.push(bid);
  }
  if (!DRY_RUN && report.moved.length) await C.saveCampaign(id, { ...c, beats });
  console.log("KTCOOK " + JSON.stringify(report));
})();
