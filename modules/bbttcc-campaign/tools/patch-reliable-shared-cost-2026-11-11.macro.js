/*
 * patch-reliable-shared-cost-2026-11-11.macro.js — Dave (2026-11-11): "they should be able to buy her now, for 30 economy marks each
 * domain. I think that shared cost is important if we want it to be a real choice right now."
 *   reliable_bought: the Economy −30 row is charged to every Domain on the roster (@coalition), not one payer (@payer).
 *   reliable_price "Everybody chips in. Buy her.": the button text says so.
 * Ember Bad Eden. globalThis.__relCostDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__relCostDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const bought = beats.find(b => b.id === "reliable_bought"), price = beats.find(b => b.id === "reliable_price");
  if (!bought || !price) throw new Error("Reliable beats not found");
  for (const r of (bought.worldEffects?.factionEffects || [])) {
    if (r?.factionId === "@payer" && Number(r.opDeltas?.economy) === -30) { r.factionId = "@coalition"; report.changed.push("bought: 30 Economy from every Domain"); }
  }
  const ch = (price.choices || []).find(x => x.label === "Everybody chips in. Buy her.");
  const DESC = "Thirty marks of Economy from every Domain. She's yours: home, boat, and a hull you can finally bolt things onto.";
  if (ch && ch.description !== DESC) { ch.description = DESC; report.changed.push("price: button text"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("RELCOST " + JSON.stringify(report));
  return report;
})();
