/*
 * patch-mara-at-the-negotiation-2026-11-11.macro.js — Dave (2026-11-11): "Mara was supposed to be in the scene for that."
 * Mara Quickhands is placed by fixit_leyline_stabilizer (placeActors on open); a table that comes in on the negotiation
 * (a resume Pick up, a return visit) skipped it. The same placement goes on the negotiation and every beat after it.
 * placeActors never duplicates. Ember Bad Eden. globalThis.__maraDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__maraDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const src = beats.find(b => b.id === "fixit_leyline_stabilizer")?.worldEffects?.placeActors;
  if (!src) throw new Error("fixit_leyline_stabilizer has no placeActors to copy");
  const IDS = ["fixit_leyline_stabilizer_negotiation", "fixit_leyline_stabilizer_trade_success", "fixit_leyline_stabilizer_shared_oversight_success",
    "fixit_leyline_trade_fail", "fixit_leyline_stabilizer_hard_ask", "fixit_leyline_stabilizer_delay", "fixit_load_the_crate"];
  for (const id of IDS) {
    const b = beats.find(x => x.id === id);
    if (!b) { report.changed.push(id + " MISSING"); continue; }
    if (b.worldEffects?.placeActors) continue;
    b.worldEffects = { ...(b.worldEffects || {}), placeActors: foundry.utils.deepClone(src) };
    report.changed.push(id);
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("MARA " + JSON.stringify(report));
  return report;
})();
