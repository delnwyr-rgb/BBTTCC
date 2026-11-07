/*
 * patch-elsin-supper-grace-2026-11-07.macro.js — Dave 2026-11-07: new "Supper, Said Right" text (grace passed at Elsin's);
 * Rowan is no longer in the scene. The bonus line stays (the granting card names its bonus).
 * Ember Bad Eden. globalThis.__supperGraceDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__supperGraceDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "rc_elsin_supper"); if (!b) throw new Error("beat not found");
  const TEXT = "You say grace. You're not sure to who — god temp agencies are a thing in Coraliindra — but here it seems appropriate to just be thankful in GENERAL.\n\nThe atmosphere here has to be .2% Indica, STG.\n\nElsin, who is still uptight AF even with the dope air, unclenches a bit.\n\n“Good! You pick up on vibes.”\n\nThe food is amazing. It's probably artisanal.\n\nBad Eden Isn't All Bad. And now it's home.\n\n<i>Supper at Elsin's: +1 on Body checks until the turn ends.</i>";
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("description"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("SUPPERGRACE " + JSON.stringify(report));
  return report;
})();
