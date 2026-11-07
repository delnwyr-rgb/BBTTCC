/*
 * patch-kt-cookline-scene-2026-11-06.macro.js — Dave 2026-11-06: Calder and Sable are met at the cookline, so their Act 1 cards stay on the cookline's scene (Khezek Tor Map)
 * instead of pulling the table to the Brace and Lift Hall views. The old scene ids are kept on beat._deferred.sceneId.
 * Ember Bad Eden. globalThis.__ktCookDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__ktCookDry !== false;
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats); const report = { DRY_RUN, moved: [] };
  const COOKLINE = beats.find(b => b.id === "khezek_tor_town_walk")?.sceneId;
  if (!COOKLINE) throw new Error("cookline scene not found");
  for (const bid of ["khezek_tor_drax_welcome", "kt_drax_answer_chalk", "khezek_tor_sable_welcome", "kt_sable_answer_maps"]) {
    const b = beats.find(x => x.id === bid);
    if (!b || b.sceneId === COOKLINE) continue;
    b._deferred = { ...(b._deferred || {}), sceneId: b.sceneId, at: "2026-11-06" };
    b.sceneId = COOKLINE;
    report.moved.push(bid);
  }
  if (!DRY_RUN && report.moved.length) await C.saveCampaign(id, { ...c, beats });
  console.log("KTCOOK " + JSON.stringify(report));
})();
