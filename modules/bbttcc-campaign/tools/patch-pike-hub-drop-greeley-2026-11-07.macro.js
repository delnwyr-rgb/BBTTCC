/*
 * patch-pike-hub-drop-greeley-2026-11-07.macro.js — Dave 2026-11-07: "The Waiting Room — Doc Greeley" comes off Pike's hub
 * (allesh_gilliam_introduction_to_hq). It was the 11-01 Act 2 door to the Waiting Room; since the 11-02 ruling (the town map is
 * the hub, every location door works in every act) the map's own Waiting Room door covers it. Pike's card keeps Pike business.
 * Ember Bad Eden. globalThis.__dropGreeleyDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__dropGreeleyDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "allesh_gilliam_introduction_to_hq"); if (!b) throw new Error("beat not found");
  const before = b.choices.length;
  b.choices = b.choices.filter(x => x.label !== "The Waiting Room — Doc Greeley");
  if (b.choices.length !== before) report.changed.push(`removed ${before - b.choices.length} choice`);
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("DROPGREELEY " + JSON.stringify(report));
  return report;
})();
