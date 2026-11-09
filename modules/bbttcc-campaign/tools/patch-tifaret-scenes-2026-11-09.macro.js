/**
 * patch-tifaret-scenes-2026-11-09.macro.js — Dave, 11-09: "Let's wire these scenes please — Scene.oZlnsoc1QebTs7Nw approach
 * pov; Qlipothic battlemap - Scene.cbnZz1ZmjGwwWT0O; Merge and learn - Scene.uCftk2kcgJ1FbW5E" (the battlemap baked the
 * same night from "Forest of Early Tipahret Qlipothic Battle hexchrome battlemap", 3100×2500 @100).
 *   forest_of_tifaret_approach   → Forest of Early Tipharet - Approach POV           (was the old hexhchrome battlemap)
 *   forest_of_tifaret_obstructor → Forest of Early Tipahret Qlipothic Battle battlemap (the Obstructor Demon fight; had none)
 *   forest_of_tifaret_merge      → Forest of Early Tipharet - Merge and Learn          (was the Approach POV)
 * Every other Tifaret beat keeps its scene. Idempotent (rerun = 0). globalThis.__tifScenesDry = false applies; anything
 * else is a dry run. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__tifScenesDry !== false;
  const NS = "bbttcc-campaign";
  const WANT = {
    forest_of_tifaret_approach: "oZlnsoc1QebTs7Nw",
    forest_of_tifaret_obstructor: "cbnZz1ZmjGwwWT0O",
    forest_of_tifaret_merge: "uCftk2kcgJ1FbW5E"
  };
  if (!game.user?.isGM) throw new Error("GM only.");
  for (const sc of Object.values(WANT)) if (!game.scenes.get(sc)) throw new Error(`Scene ${sc} not in this world — nothing written.`);
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) throw new Error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = { DRY_RUN, changed: [] };
  for (const [BEAT, SCENE] of Object.entries(WANT)) {
    const b = beats.find(x => x && String(x.id) === BEAT);
    if (!b) throw new Error(`${BEAT} not found.`);
    if (String(b.sceneId || "").replace(/^Scene\./, "") === SCENE) continue;
    report.changed.push(`${BEAT}: ${game.scenes.get(b.sceneId)?.name ?? (b.sceneId || "none")} → ${game.scenes.get(SCENE).name}`);
    b.sceneId = SCENE;
  }
  if (!DRY_RUN && report.changed.length) {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-tifaret-scenes-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  console.log("TIFSCENES " + JSON.stringify(report));
  return report;
})();
