/*
 * patch-cr-parley-approach-text-2026-11-13.macro.js — Dave (2026-11-13), beat polish on enc_circuit_riders_parley_approach
 * (The Circuit Riders, the road encounter on the ride to Lyrenn). Text only; choices unchanged.
 * Typos fixed: "stemming" → "stimming"; "Your guess is that it is a really big robot is quickly confirmed" → "Your guess that it is
 * a really big robot is quickly confirmed"; "remarkable hidden" → "remarkably hidden".
 * Ember Bad Eden. globalThis.__crApproachDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__crApproachDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "enc_circuit_riders_parley_approach"); if (!b) throw new Error("enc_circuit_riders_parley_approach missing");
  const TEXT = [
    "Your first clue that you have arrived at a new encounter is the electricity that begins crawling over any exposed metal in your possession.",
    "Then you feel the ground shake. Rhythmically. Like someone stimming. A really BIG someone. A really BIG, ANXIOUS, someone.",
    "Your guess that it is a really big robot is quickly confirmed. Your guess was helped by the fact that you have apparently stumbled onto a camp of Circuitborn, in the shadow of a giant fighting robot remarkably hidden amongst the trees.",
    "They are ALL wearing superhero costumes."
  ].join("\n\n");
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("text"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("CRAPPROACH " + JSON.stringify(report));
  return report;
})();
