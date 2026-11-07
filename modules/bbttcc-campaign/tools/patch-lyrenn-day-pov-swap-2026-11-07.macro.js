/*
 * patch-lyrenn-day-pov-swap-2026-11-07.macro.js — Dave 2026-11-07: "Lyrenn Day 1 = Elsin; Lyrenn Day 3 = Rowan."
 * Elsin's beats move to lyrenn_day_1_pov, Rowan's to lyrenn_day_3_pov (they were the other way round).
 * lyrenn_coop_exterior (also on day 3) is left alone: not named for either.
 * Ember Bad Eden. globalThis.__daySwapDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__daySwapDry !== false, report = { DRY_RUN, changed: [] };
  const DAY1 = game.scenes.getName("lyrenn_day_1_pov")?.id, DAY3 = game.scenes.getName("lyrenn_day_3_pov")?.id;
  if (!DAY1 || !DAY3) throw new Error("day POV scenes not found");
  const ELSIN = ["lyrenn_elsin_welcome", "lyrenn_elsin_quade_convo", "lyrenn_elsin_quade_convo_1", "lyrenn_elsin_quade_convo_2", "lyrenn_elsin_quade_convo_3", "lyrenn_elsin_quade_convo_echo"];
  const ROWAN = ["lyrenn_rowan_welcome", "lyrenn_rowan_answer_rhythm", "lyrenn_rowan_of_the_loam_convo", "lyrenn_rowan_of_the_loam_convo_1", "lyrenn_rowan_of_the_loam_convo_2", "lyrenn_rowan_of_the_loam_convo_3", "lyrenn_rowan_of_the_loam_convo_echo", "ans_lyrenn_rowan_moving"];
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const set = (ids, sc) => { for (const bid of ids) { const b = beats.find(x => x.id === bid); if (!b) { report.changed.push(`MISSING ${bid}`); continue; } if (b.sceneId !== sc) { b.sceneId = sc; report.changed.push(bid); } } };
  set(ELSIN, DAY1); set(ROWAN, DAY3);
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("DAYSWAP " + JSON.stringify(report));
  return report;
})();
