/*
 * patch-kt-intro-bench-2026-11-06.macro.js — Dave 2026-11-06: Khezek-Tor's Intro Scene plays once on the first arrival (phaseEntry.afterFirst), then Act 1 visits go to the
 * cookline as before. The Bench's second paragraph is Dave's rewrite.
 * Ember Bad Eden. globalThis.__ktIntroDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__ktIntroDry !== false;
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const report = { DRY_RUN, text: [] };
  const beats = foundry.utils.deepClone(c.beats);
  const intro = beats.find(b => b.id === "khezek_tor_main_scene");
  if (intro?.phaseEntry && !intro.phaseEntry.afterFirst) { intro.phaseEntry.afterFirst = true; report.text.push("KT intro plays first"); }
  const bench = beats.find(b => b.id === "rc_bez_bench");
  const OLDS = ["Bez nods once. The full Khezek Tor citizenship ceremony. The miner beside you shoves down the bench another inch, which is the second ceremony, and nobody tells you that one exists.",
    "Bez nods once, there is suddenly a little more room on the bench somehow, and you feel suddenly … not accepted, but maybe less UN-accepted."];
  const NEW = "Bez nods once, there is suddenly a little more room on the bench somehow, and you feel … accepted isn't the word. Maybe less UN-accepted ...";
  for (const OLD of OLDS) if (bench?.description?.includes(OLD)) { bench.description = bench.description.replace(OLD, NEW); report.text.push("Bench paragraph"); }
  if (!DRY_RUN && report.text.length) await C.saveCampaign(id, { ...c, beats });
  console.log("KTINTRO " + JSON.stringify(report));
  ui.notifications.info(`KT intro + Bench: ${DRY_RUN ? "dry run" : "applied"}, ${report.text.length} change(s).`);
})();
