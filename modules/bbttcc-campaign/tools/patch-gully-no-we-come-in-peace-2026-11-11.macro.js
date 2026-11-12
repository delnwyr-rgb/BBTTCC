/*
 * patch-gully-no-we-come-in-peace-2026-11-11.macro.js — Dave (2026-11-11): "We Come In Peace … is basically asking the same question
 * [as 'aren't you at war?']. I'd like to just axe that line entirely." The choice leaves Gully's welcome menu. Its two beats
 * (fixit_gullywasher_choice_2 / _fail) are kept but nothing reaches them now (nothing else referenced them).
 * Ember Bad Eden. globalThis.__peaceDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__peaceDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const w = beats.find(b => b.id === "fixit_gullywasher_welcome");
  const n = (w.choices || []).length;
  w.choices = (w.choices || []).filter(x => !(x.label === "We come in peace" && x.next === "fixit_gullywasher_choice_2"));
  if (w.choices.length !== n) report.changed.push("We come in peace removed");
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("PEACE " + JSON.stringify(report));
  return report;
})();
