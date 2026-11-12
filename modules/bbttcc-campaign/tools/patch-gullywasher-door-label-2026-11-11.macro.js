/*
 * patch-gullywasher-door-label-2026-11-11.macro.js — Dave (2026-11-11): "'The First Round's Cultural' doesn't make sense. I think it
 * should read 'The Gullywasher'." The return door on the Fixit hubs ("The bar. First round's cultural.") and the welcome card's
 * title both become The Gullywasher. Ember Bad Eden. globalThis.__doorDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__doorDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  for (const b of beats) for (const ch of (b.choices || [])) {
    if (ch.label === "The bar. First round's cultural." && ch.next === "fixit_gullywasher_welcome") { ch.label = "The Gullywasher"; report.changed.push(b.id + ": door label"); }
  }
  const w = beats.find(b => b.id === "fixit_gullywasher_welcome");
  if (w && w.label !== "Furrier's Fixit Farm — The Gullywasher") { w.label = "Furrier's Fixit Farm — The Gullywasher"; report.changed.push("welcome: title"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("DOOR " + JSON.stringify(report));
  return report;
})();
