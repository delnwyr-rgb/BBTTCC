/*
 * patch-rowan-rhythm-text-2026-11-07.macro.js — Dave 2026-11-07: new text for "Lyrenn — Growing Is a Sound"
 * (lyrenn_rowan_answer_rhythm). The seed line goes (it granted nothing). Straight quotes to match the card.
 * Ember Bad Eden. globalThis.__rowanRhythmDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__rowanRhythmDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "lyrenn_rowan_answer_rhythm"); if (!b) throw new Error("beat not found");
  const TEXT = [
    "Rowan doesn't answer right away, because answering right away would interrupt it.",
    "\"It's the sound of growing. One of the benefits of the Shattering is that things move in more obvious ways. If you pay attention, you can hear the world changing around you.\"",
    "You listen, and you understand.",
    "\"Most people don't though,\" Rowan says. \"Then they wonder why the fields don't answer to them.\"",
    "Rowan seems genuinely baffled."
  ].join("\n\n");
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("description"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("ROWANRHYTHM " + JSON.stringify(report));
  return report;
})();
