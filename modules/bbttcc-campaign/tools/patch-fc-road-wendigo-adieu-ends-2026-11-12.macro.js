/*
 * patch-fc-road-wendigo-adieu-ends-2026-11-12.macro.js — Dave (2026-11-12): "I think the fight them and adieu also ends the
 * encounter, just like leave." The "Why is there no 'fight them' button?" choice (on fc_road_wendigo and on the canteen /
 * directions answers) now leads nowhere and carries “Adieu!” as its choice.result — posted to every seat as the pick's result
 * card, and the meeting ends. ans_fc_road_wendigo_fight is unreachable now and kept.
 * Ember Bad Eden. globalThis.__adieuDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__adieuDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  for (const id of ["fc_road_wendigo", "ans_fc_road_wendigo_canteen", "ans_fc_road_wendigo_directions"]) {
    const b = beats.find(x => x.id === id); if (!b) throw new Error(id + " missing");
    const ch = (b.choices || []).find(x => x.next === "ans_fc_road_wendigo_fight" || /fight them/.test(x.label));
    if (!ch) throw new Error(id + ": fight choice missing");
    if (ch.next === "" && ch.result === "“Adieu!”") continue;
    ch.next = ""; ch.result = "“Adieu!”"; report.changed.push(id);
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("ADIEU " + JSON.stringify(report));
  return report;
})();
