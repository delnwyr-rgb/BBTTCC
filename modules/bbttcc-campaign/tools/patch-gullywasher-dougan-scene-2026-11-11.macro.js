/*
 * patch-gullywasher-dougan-scene-2026-11-11.macro.js — Dave (2026-11-11): "the Dougan convo really needs to happen on scene
 * Scene.zhjt45xD9DJ99H46". The welcome card (fixit_gullywasher_welcome) stays on the interior (TQCbLenWaRPl4ykd) as the walk-in look
 * at the room; every interior beat Dougan Marsh speaks (14) moves to fixit_gulleywasher_dougan_pov.
 * Ember Bad Eden. globalThis.__douganDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__douganDry !== false;
  const FROM = "TQCbLenWaRPl4ykd", TO = "zhjt45xD9DJ99H46", KEEP = new Set(["fixit_gullywasher_welcome"]);
  const report = { DRY_RUN, moved: [] };
  if (!game.scenes.get(TO)) throw new Error("Dougan scene missing");
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  for (const b of beats) {
    if (KEEP.has(b.id)) continue;
    const sid = String(b.sceneId || "");
    if (sid.replace(/^Scene\./, "") !== FROM) continue;
    if (game.actors.get(String(b.speakerActorId || ""))?.name !== "Dougan Marsh") continue;   // Mara's late-run beats stay at the bar
    b.sceneId = sid.startsWith("Scene.") ? "Scene." + TO : TO;
    report.moved.push(b.id);
  }
  if (!DRY_RUN && report.moved.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("DOUGAN " + JSON.stringify(report));
  return report;
})();
