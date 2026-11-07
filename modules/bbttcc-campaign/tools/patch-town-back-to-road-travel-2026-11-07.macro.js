/*
 * patch-town-back-to-road-travel-2026-11-07.macro.js — Dave 2026-11-06 ruling: a town's "Back to the road" lets you travel
 * on. The three town walks (Lyrenn, Khezek-Tor, Fixit) shipped the label with no route, so the card just closed (found at
 * Lyrenn 11-07). Each now opens travel with no fixed destination (openTravel: {}), like The Road Home's Saddle up.
 * Ember Bad Eden. globalThis.__backToRoadDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__backToRoadDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  for (const bid of ["lyrenn_town_walk", "khezek_tor_town_walk", "fixit_town_walk"]) {
    const ch = beats.find(x => x.id === bid)?.choices?.find(x => x.label === "Back to the road");
    if (!ch) { report.changed.push(`MISSING ${bid}`); continue; }
    if (!ch.openTravel || typeof ch.openTravel !== "object") { ch.openTravel = {}; report.changed.push(bid); }
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("BACKTOROAD " + JSON.stringify(report));
  return report;
})();
