/*
 * patch-word-comes-in-here-or-away-2026-11-07.macro.js — Dave 2026-11-07: The Word Comes In knows where the party stands.
 * Each door has an "away" button (a ride) and an "already here" button (straight in), gated by the new choice condition
 * { partyAt: "<hex>", not? } (module.js, same day).
 *   Allesh-Gilliam: Go to the HQ — Pike's waiting (here) · Ride for Allesh-Gilliam — Pike's waiting (away → ag_ride_home)
 *   Khezek-Tor:     Find Sable Nine and Drax Calder (here → khezek_tor_quest_scene) · Ride for Khezek-Tor (away)
 *   Lyrenn:         Find Elsin and Rowan (here → lyrenn_quest_scene) · Ride for Lyrenn (away)
 * Ember Bad Eden. globalThis.__hereAwayDry = false applies; anything else is a dry run. Idempotent (rewrites the six choices).
 */
(async () => {
  const DRY_RUN = globalThis.__hereAwayDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "a2_the_word_comes_in"); if (!b) throw new Error("a2_the_word_comes_in not found");
  const here = (hex) => [{ partyAt: hex }], away = (hex) => [{ partyAt: hex, not: true }];
  const ch = (label, next, requires) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", requires });
  const WANT = [
    ch("Go to the HQ — Pike's waiting", "allesh_gilliam_introduction_to_hq", here("Allesh-Gilliam")),
    ch("Ride for Allesh-Gilliam — Pike's waiting", "ag_ride_home", away("Allesh-Gilliam")),
    ch("Find Sable Nine and Drax Calder", "khezek_tor_quest_scene", here("Khezek-Tor")),
    ch("Ride for Khezek-Tor", "khezek_word_ride", away("Khezek-Tor")),
    ch("Find Elsin and Rowan", "lyrenn_quest_scene", here("Lyrenn")),
    ch("Ride for Lyrenn", "lyrenn_word_ride", away("Lyrenn"))
  ];
  for (const w of WANT) if (!beats.some(x => x.id === w.next)) throw new Error(`${w.next} not found`);
  if (JSON.stringify(b.choices) !== JSON.stringify(WANT)) { b.choices = WANT; report.changed.push("six here/away choices"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("HEREAWAY " + JSON.stringify(report));
  return report;
})();
