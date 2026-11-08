/*
 * patch-retire-ag-first-pay-2026-11-07.macro.js — Dave 2026-11-07: "Pike's Ledger Pays Out" (ag_first_pay) is a teaching beat
 * about marks (a once-only +20 economy per Domain) and redundant by Turn 2 — players have already bought at the market. The One
 * Night button ("Let's start the plot") now leads straight to the HQ intro; ag_first_pay stays in the data, unreachable.
 * Ember Bad Eden. globalThis.__firstPayDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__firstPayDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "a2_that_one_night"); if (!b) throw new Error("beat not found");
  for (const ch of b.choices || []) if (ch.next === "ag_first_pay") { ch.next = "allesh_gilliam_introduction_to_hq"; report.changed.push(`"${ch.label}" → allesh_gilliam_introduction_to_hq`); }
  const left = beats.flatMap(x => (x.choices || []).filter(ch => ch.next === "ag_first_pay" || ch.failNext === "ag_first_pay").map(ch => `${x.id}: ${ch.label}`));
  if (left.length) report.stillLeadsHere = left;
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("FIRSTPAY " + JSON.stringify(report));
  return report;
})();
