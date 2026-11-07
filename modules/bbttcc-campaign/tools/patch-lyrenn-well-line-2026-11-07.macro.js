/*
 * patch-lyrenn-well-line-2026-11-07.macro.js — Dave 2026-11-07: the drink card names its bonus, like the Bench and the Fiddle.
 * Ember Bad Eden. globalThis.__wellLineDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__wellLineDry !== false, report = { DRY_RUN, text: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "rc_lyrenn_well_water"); if (!b) throw new Error("beat not found");
  const LINE = "<i>The well-water: +2 on Perception checks and +1 on Empathy checks for two turns, and one level of Strain comes off.</i>";
  if (!b.description.includes(LINE)) { b.description = `${b.description.trimEnd()}\n\n${LINE}`; report.text.push("well-water line"); }
  if (!DRY_RUN && report.text.length) await C.saveCampaign(id, { ...c, beats });
  console.log("WELLLINE " + JSON.stringify(report));
})();
