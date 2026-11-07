/*
 * patch-elsin-wash-up-check-2026-11-07.macro.js — Dave 2026-11-07: "Offer to wash up" at Elsin's supper is an Intrigue check
 * ("to make sure they don't break anything"). DC 11, same as the grace. A miss has no failNext: the menu comes back.
 * Ember Bad Eden. globalThis.__washUpDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__washUpDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "rc_elsin_supper"); if (!b) throw new Error("beat not found");
  const ch = (b.choices || []).find(x => x.label === "Offer to wash up"); if (!ch) throw new Error("choice not found");
  if (ch.checkStat !== "intrigue") { ch.checkStat = "intrigue"; report.changed.push("checkStat"); }
  if (Number(ch.checkDC) !== 11) { ch.checkDC = 11; report.changed.push("checkDC"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("WASHUP " + JSON.stringify(report));
  return report;
})();
