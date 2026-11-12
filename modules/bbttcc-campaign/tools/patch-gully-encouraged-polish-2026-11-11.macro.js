/*
 * patch-gully-encouraged-polish-2026-11-11.macro.js — Dave (2026-11-11) polish: fixit_gullywasher_choice_1 ("aren't you at war?",
 * success) takes Dave's text (typos fixed: "then says." → "then says:", closing quote matched). The player's line before it is the
 * welcome choice's result and is unchanged. Ember Bad Eden. globalThis.__encDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__encDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "fixit_gullywasher_choice_1");
  if (!b) throw new Error("beat missing");
  const NEW = "He pauses mid-polish, almost imperceptibly, then says: “It’s not like it used to be. If I serve very good drinks people take the time to get to know me, and that makes all the difference. Also, I can dance and am a snappy dresser. I can overcome suppositions. Strange though. The state of relations seems stuck at a baseline. Ah well. Wiser heads!”";
  if (b.description !== NEW) { b.description = NEW; report.changed.push("Encouraged: Dave's text"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("ENC " + JSON.stringify(report));
  return report;
})();
