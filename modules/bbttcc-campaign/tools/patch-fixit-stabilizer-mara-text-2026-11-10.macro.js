/*
 * patch-fixit-stabilizer-mara-text-2026-11-10.macro.js — Dave at Arc Bay (2026-11-10): "Please replace the entirety of that beat
 * with …" — fixit_leyline_stabilizer's description becomes Gearbox's ask + Mara's one-breath warning (she's in the scene now,
 * placeActors). Typo fixes: "Says" → "says" (×2); "MacGee" → "Magee" (Garren's spelling). Mara's run-on is left unpunctuated.
 * Ember Bad Eden. globalThis.__stabTextDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__stabTextDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "fixit_leyline_stabilizer"); if (!b) throw new Error("fixit_leyline_stabilizer not found");
  const TEXT = "“Spanner?” says Young Gearbox, and he holds out his hand palm up.\n\n“Garren probably told you but if you install the wrong sort of bit in pre-Shattering tech like this things can get a bit Handfoot Magee shaped better safe than the many many many things that can be unsafe about Leygate tech,” says Mara in one breath and without any obvious punctuation. “If it fits THEN we talk price.”\n\nShe bounces a little on her front pads.";
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("stabilizer: replaced with Dave's text"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("STABTEXT " + JSON.stringify(report));
  return report;
})();
