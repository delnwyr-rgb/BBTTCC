/*
 * patch-plain-ambush-2026-11-06.macro.js — Dave 2026-11-06: the first road ambush is JUST a combat. The Battle structure is being rebuilt as Super Mode and doesn't belong in a
 * players' first fight. The raid block moves to beat._deferred.raid (2026-10-21 parking schema), which stops the Conflict offer; the card stops calling it a Battle.
 * Ember Bad Eden. globalThis.__plainAmbushDry = false applies; anything else is a dry run. globalThis.__plainAmbushMode = "restore" puts it back. Idempotent both ways.
 */
(async () => {
  const DRY_RUN = globalThis.__plainAmbushDry !== false, MODE = globalThis.__plainAmbushMode === "restore" ? "restore" : "plain";
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const report = { DRY_RUN, MODE, text: [] };
  const beats = foundry.utils.deepClone(c.beats);
  const ambush = beats.find(b => b.id === "first_road_ambush");
  if (!ambush) throw new Error("first_road_ambush not found");
  const OLD = "This is a Battle.", NEW = "This is a fight.";
  const swap = (from, to) => { for (const [k, v] of Object.entries(ambush)) if (typeof v === "string" && v.includes(from)) { ambush[k] = v.split(from).join(to); report.text.push(`text: ${k}`); } };
  if (MODE === "plain") {
    if (ambush.worldEffects?.raid) { ambush._deferred = { ...(ambush._deferred || {}), raid: ambush.worldEffects.raid, at: "2026-11-06" }; delete ambush.worldEffects.raid; report.text.push("raid parked"); }
    swap(OLD, NEW);
  } else {
    if (ambush._deferred?.raid) { ambush.worldEffects.raid = ambush._deferred.raid; delete ambush._deferred; report.text.push("raid restored"); }
    swap(NEW, OLD);
  }
  if (!DRY_RUN && report.text.length) await C.saveCampaign(id, { ...c, beats });
  console.log("PLAINAMBUSH " + JSON.stringify(report));
  ui.notifications.info(`Plain ambush ${MODE}: ${DRY_RUN ? "dry run" : "applied"}, ${report.text.length} change(s).`);
})();
