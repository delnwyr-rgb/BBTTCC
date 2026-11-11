/*
 * patch-fixit-mara-to-arc-bay-and-hi-text-2026-11-10.macro.js — Dave at Arc Bay (2026-11-10):
 *   • "if we ask about the Leyline Stabilizer here with YG, Mara is supposed to be fetched and added to the scene. And then we
 *     negotiate." — fixit_leyline_stabilizer (reached by "Anything for sale?" → "Get Mara. Talk.") gains
 *     worldEffects.placeActors { actors: [Mara Quickhands], beside: Young Gearbox } on its own scene (arc_bay_interior_pov).
 *     Needs world-mutation-engine placeActors (2026-11-10).
 *   • Garren's hi, Dave's text: "Young Gearbox stops. He looks at the Tetrarch Spanner for a long moment. Then he sets his mug
 *     down, sighs, steels himself, and says "Hi." / Garren is going to be insufferable."
 * Actors resolved BY NAME (Mara Quickhands, Young Gearbox). Ember Bad Eden. globalThis.__maraArcDry = false applies. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__maraArcDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const mara = game.actors.getName("Mara Quickhands"), yg = game.actors.getName("Young Gearbox");
  if (!mara || !yg) throw new Error("Mara Quickhands / Young Gearbox actor not found");
  const sb = beats.find(b => b.id === "fixit_leyline_stabilizer"); if (!sb) throw new Error("fixit_leyline_stabilizer not found");
  sb.worldEffects = sb.worldEffects || {};
  const want = { actors: [mara.id], beside: yg.id };
  if (JSON.stringify(sb.worldEffects.placeActors) !== JSON.stringify(want)) { sb.worldEffects.placeActors = want; report.changed.push("stabilizer: Mara walks in beside Young Gearbox"); }
  const hi = beats.find(b => b.id === "ans_fixit_arc_bay_garren_says_hi");
  const HI = "Young Gearbox stops. He looks at the Tetrarch Spanner for a long moment. Then he sets his mug down, sighs, steels himself, and says “Hi.”\n\nGarren is going to be insufferable.";
  if (hi && hi.description !== HI) { hi.description = HI; report.changed.push("Garren says hi: Dave's text"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("MARAARC " + JSON.stringify(report));
  return report;
})();
