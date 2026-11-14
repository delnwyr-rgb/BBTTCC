/*
 * patch-cr-encounter-scenes-2026-11-13.macro.js — Dave (2026-11-13), mid Circuit Riders encounter: "Also we are still on the
 * Lyrenn screen :)" Only the approach card named a scene (circuit_rider_approach_hexchrome_pov); the 40+ cards after it named none,
 * so a card opened after the ride had landed stayed on the arrival town. Every enc_circuit_riders_* beat with no sceneId gets one:
 *   • the witness cards (witness_request / _success / _fail / _good / _mixed / _bad) → circuit_rider_witness_hexchrome_pov
 *   • everything else → circuit_rider_approach_hexchrome_pov
 * Beats that already name a scene (the camp battlemap, the witness POV, the approach) are left as they are.
 * Ember Bad Eden. globalThis.__crSceneDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__crSceneDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const APPROACH = "Scene.fZB6KRmOcxepxEO4", WITNESS = "Scene.MNOomCfU3i6W6IZ3";
  if (!game.scenes.get("fZB6KRmOcxepxEO4") || !game.scenes.get("MNOomCfU3i6W6IZ3")) throw new Error("Circuit Rider POV scenes missing");
  for (const b of beats) {
    if (!/^(ans_)?enc_circuit_riders_/.test(b.id) || b.sceneId) continue;
    b.sceneId = /^enc_circuit_riders_witness_/.test(b.id) ? WITNESS : APPROACH;
    report.changed.push(b.id + " → " + (b.sceneId === WITNESS ? "witness POV" : "approach POV"));
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("CRSCENE " + JSON.stringify({ DRY_RUN, n: report.changed.length }));
  return report;
})();
