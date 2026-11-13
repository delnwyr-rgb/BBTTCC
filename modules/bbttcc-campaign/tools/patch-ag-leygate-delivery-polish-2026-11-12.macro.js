/*
 * patch-ag-leygate-delivery-polish-2026-11-12.macro.js — Dave (2026-11-12), beat polish on ag_leygate_delivery (The Gate Remembers
 * Right): new text (typo: "he love this job" → "he loves this job"), and "Ask what really happened, the night it flickered" goes —
 * "His answer is not useful and promises a human story that doesn't happen." The one exit left: "Hand it over and let him work"
 * → ag_leygate_installed (unchanged).
 * Ember Bad Eden. globalThis.__agDelDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__agDelDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const d = beats.find(b => b.id === "ag_leygate_delivery"); if (!d) throw new Error("ag_leygate_delivery missing");
  const TEXT = [
    "Garren handles the stabilizer like a holy relic. You can tell he loves this job.",
    "You can tell that the Gate’s hurt was his hurt.",
    "Now they both can heal.",
    "OH! You also get a working Leygate!"
  ].join("\n\n");
  if (d.description !== TEXT) { d.description = TEXT; report.changed.push("text"); }
  const n = (d.choices || []).length;
  d.choices = (d.choices || []).filter(x => !/^Ask what really happened/.test(x.label));
  if (d.choices.length !== n) report.changed.push("Ask what really happened removed");
  if (!d.choices.some(x => x.next === "ag_leygate_installed")) throw new Error("hand-over exit missing");
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("AGDEL " + JSON.stringify(report));
  return report;
})();
