/*
 * patch-gully-amber-and-dougan-scene-2026-11-11.macro.js — Dave (2026-11-11):
 *  1. rc_gully_amber takes Dave's text (typo: "with tiny sun" → "with a tiny sun"); the GM line keeps its italics.
 *  2. "For right now, let's have all landing at the Dougan POV scene. The interior POV might end up being dropped anyway."
 *     Every beat on the Gullywasher interior (TQCbLenWaRPl4ykd) and every rc_gully_* beat (they had no scene, so the table fell
 *     back to the interior) → fixit_gulleywasher_dougan_pov (zhjt45xD9DJ99H46).
 * Ember Bad Eden. globalThis.__amberDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__amberDry !== false;
  const FROM = "TQCbLenWaRPl4ykd", TO = "zhjt45xD9DJ99H46";
  const report = { DRY_RUN, changed: [] };
  if (!game.scenes.get(TO)) throw new Error("Dougan scene missing");
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const amber = beats.find(b => b.id === "rc_gully_amber");
  if (!amber) throw new Error("rc_gully_amber missing");
  const TEXT = [
    "You drink the amber thing. Your eyebrows and sinuses have an intense few seconds with a tiny sun made from peaches, and then you lose all contact with them.",
    "He slides the second one down the bar without being asked.",
    "“Your turn. And you are all SCRUMPTIOUS when you’re that color. Hold please, ducks!”",
    "There is suddenly an old fashioned box camera, and a bright flash and puff of smoke, and only then do you notice the board full of pictures of people a very specific shade of teal. AJ is up on that board too.",
    "You have so many feelings.",
    "<i>The amber thing: +1 on Intrigue checks until the turn ends. You are now, at least in a limited sense, Part Of The Gang.</i>"
  ].join("\n\n");
  if (amber.description !== TEXT) { amber.description = TEXT; report.changed.push("amber: Dave's text"); }
  for (const b of beats) {
    const sid = String(b.sceneId || "").replace(/^Scene\./, "");
    if (sid === FROM || (/^rc_gully/.test(b.id) && sid !== TO)) { b.sceneId = TO; report.changed.push("scene: " + b.id); }
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("AMBER " + JSON.stringify(report));
  return report;
})();
