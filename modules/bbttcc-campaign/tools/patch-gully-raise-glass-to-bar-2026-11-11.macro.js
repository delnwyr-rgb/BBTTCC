/*
 * patch-gully-raise-glass-to-bar-2026-11-11.macro.js — Dave (2026-11-11): "have raise the glass go back to the bar menu".
 * rc_gully_third_round "Raise the glass. To Dougan Marsh." → fixit_gullywasher_welcome (was fixit_town_walk). The refusal penalty
 * stays ("don't be rude to Dougan!!"). Ember Bad Eden. globalThis.__glassDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__glassDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "rc_gully_third_round");
  const ch = (b?.choices || []).find(x => x.label === "Raise the glass. To Dougan Marsh.");
  if (!ch) throw new Error("Raise the glass choice missing");
  if (ch.next !== "fixit_gullywasher_welcome") { ch.next = "fixit_gullywasher_welcome"; report.changed.push("raise the glass → bar menu"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("GLASS " + JSON.stringify(report));
  return report;
})();
