/*
 * patch-one-night-button-2026-11-07.macro.js — Dave 2026-11-07: a2_that_one_night's "Noted." button reads "Let's start the plot".
 * Ember Bad Eden. globalThis.__oneNightBtnDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__oneNightBtnDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "a2_that_one_night"); if (!b) throw new Error("beat not found");
  const ch = (b.choices || []).find(x => x.label === "Noted.");
  if (ch) { ch.label = "Let's start the plot"; report.changed.push("button"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("ONENIGHTBTN " + JSON.stringify(report));
  return report;
})();
