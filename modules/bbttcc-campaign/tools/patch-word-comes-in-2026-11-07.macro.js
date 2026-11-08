/*
 * patch-word-comes-in-2026-11-07.macro.js — Dave 2026-11-07: after That One Night the party has three quests calling (Pike,
 * Khezek-Tor, Lyrenn) and should choose which to answer. New beat a2_the_word_comes_in (draft text, Dave polishes) between
 * "Let's start the plot" and the three doors:
 *   Go to the HQ — Pike's waiting → allesh_gilliam_introduction_to_hq
 *   Ride for Khezek-Tor            → khezek_word_ride (Saddle up; vs_overture is gated off once the KT quest is active)
 *   Ride for Lyrenn                → lyrenn_word_ride (Saddle up)
 * Ember Bad Eden. globalThis.__wordInDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__wordInDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const NEW = "a2_the_word_comes_in", src = beats.find(x => x.id === "a2_that_one_night");
  if (!src) throw new Error("a2_that_one_night not found");
  for (const t of ["allesh_gilliam_introduction_to_hq", "khezek_word_ride", "lyrenn_word_ride"]) if (!beats.some(x => x.id === t)) throw new Error(`${t} not found`);
  const ch = (label, next) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" });
  if (!beats.some(x => x.id === NEW)) {
    const b = foundry.utils.deepClone(src);
    Object.assign(b, {
      id: NEW, label: "The Word Comes In",
      description: "Pike has sent a runner. Sable Nine and Drax Calder have written from Khezek-Tor. Elsin and Rowan have written from Lyrenn.\n\nEveryone wants you first. Somebody has to wait.",
      choices: [ch("Go to the HQ — Pike's waiting", "allesh_gilliam_introduction_to_hq"), ch("Ride for Khezek-Tor", "khezek_word_ride"), ch("Ride for Lyrenn", "lyrenn_word_ride")],
      worldEffects: {}, cinematic: { enabled: false }, refs: {}
    });
    b.inject = { ...(src.inject || {}), repeatable: false, requires: [{ flag: "storyPhase", gte: 2 }] };
    delete b.unmet; delete b.journal;
    beats.splice(beats.indexOf(src) + 1, 0, b); report.changed.push(`+ ${NEW}`);
  }
  // a step on the spine, never its start (the copy carried That One Night's story role and tags)
  const nb = beats.find(x => x.id === NEW);
  if (nb.story?.role) { nb.story = { quest: nb.story.quest }; report.changed.push(`${NEW}: story role dropped`); }
  if (nb.tags !== "act2") { nb.tags = "act2"; report.changed.push(`${NEW}: tags`); }
  const btn = (src.choices || []).find(x => x.label === "Let's start the plot");
  if (btn && btn.next !== NEW) { btn.next = NEW; report.changed.push(`"Let's start the plot" → ${NEW}`); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("WORDIN " + JSON.stringify(report));
  return report;
})();
