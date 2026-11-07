/*
 * patch-lyrenn-green-ring-pov-2026-11-07.macro.js — Dave 2026-11-07: new Green Ring text, and the cinematic stays on the
 * POV shot until "Back to the rows" (no timed hop to green_ring_hexchrome_battlemap).
 * Ember Bad Eden. globalThis.__greenRingDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__greenRingDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "lyrenn_green_ring_cinematic"); if (!b) throw new Error("beat not found");
  const TEXT = "The old grain elevator is classic post-apocalyptic theater — rusted and blasted and still standing strong — and around it stretches a wide circular field, unnervingly symmetrical, everything leading toward the elevator at the center like spokes on a very suspect wheel. The soil here is darker than the surrounding land. A wooden platform stands at the edge of the circle, bearing an unnerving resemblance to a witness stand, and when wind moves across the Ring it sounds like the measured breath of someone in a deep, peaceful sleep.\n\nBeside the witness-stand platform: an empty plinth, footprint worn smooth.";
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("description"); }
  if (b.cinematic?.nextSceneId) { b.cinematic.nextSceneId = ""; report.changed.push("cinematic.nextSceneId cleared"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("GREENRING " + JSON.stringify(report));
})();
