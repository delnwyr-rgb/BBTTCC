/*
 * patch-gearbox-coffee-aboard-only-2026-11-12.macro.js — Dave (2026-11-12): "The Brew YG's coffee beat should be moved inside the AR
 * please my friend, where they all of a sudden discover it." Lock the Turn offered "Brew Young Gearbox's forgotten coffee"
 * (ag_days_end, days_end_thatwards). The coffee is already found aboard — the Galley (reliable_galley) and the Lease
 * (reliable_the_lease) carry the same choice with the same gate — so it leaves the two Lock the Turn beats. rc_gearbox_coffee unchanged.
 * Ember Bad Eden. globalThis.__coffeeDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__coffeeDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  if (!beats.find(b => b.id === "reliable_galley")?.choices?.some(x => x.next === "rc_gearbox_coffee")) throw new Error("the Galley no longer offers the coffee — not removing it from Lock the Turn");
  for (const id of ["ag_days_end", "days_end_thatwards"]) {
    const b = beats.find(x => x.id === id); if (!b) throw new Error(id + " missing");
    const n = (b.choices || []).length;
    b.choices = (b.choices || []).filter(x => x.next !== "rc_gearbox_coffee");
    if (b.choices.length !== n) report.changed.push(id + ": coffee removed");
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("COFFEE " + JSON.stringify(report));
  return report;
})();
