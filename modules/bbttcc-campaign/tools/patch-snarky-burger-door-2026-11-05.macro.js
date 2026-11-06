/**
 * patch-snarky-burger-door-2026-11-05.macro.js — Round 4: the HQ door gave "scene not found". Its door, beat and cinematic pointed at
 * exterior scene Twk8eXQ1P21yOKwA, which no longer exists; the exterior is now bhPP40A9TJBPmXuO.
 * Idempotent. DRY_RUN first (globalThis.__snarkyDry = false applies). GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__snarkyDry !== false;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const OLD = "Twk8eXQ1P21yOKwA", NEW = "bhPP40A9TJBPmXuO", OLDU = `Scene.${OLD}`, NEWU = `Scene.${NEW}`;
  if (!game.scenes.get(NEW)) throw new Error("no exterior scene");
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "allesh_gilliam_hq_cinematics"); if (!b) throw new Error("no HQ beat");
  const report = { DRY_RUN, beat: 0, doors: 0 };
  if (b.sceneId === OLD) { b.sceneId = NEW; report.beat++; }
  if (b.cinematic?.startSceneId === OLDU) { b.cinematic.startSceneId = NEWU; report.beat++; }
  const fixed = (u) => (u === OLDU ? NEWU : u);
  for (const s of game.scenes) for (const d of s.drawings) {
    const l = d.flags?.["bbttcc-travel"]?.locationLink; if (!l) continue;
    if (l.targetSceneUuid !== OLDU && !(l.sceneUuids || []).includes(OLDU)) continue;
    report.doors++;
    if (!DRY_RUN) await d.update({ "flags.bbttcc-travel.locationLink.targetSceneUuid": fixed(l.targetSceneUuid), "flags.bbttcc-travel.locationLink.sceneUuids": [...new Set((l.sceneUuids || []).map(fixed))] });
  }
  if (!DRY_RUN && report.beat) await C.saveCampaign(id, { ...c, beats });
  console.log("SNARKY " + JSON.stringify(report));
  ui.notifications.info(`Snarky Burger door: ${DRY_RUN ? "dry run" : "applied"}, ${report.beat + report.doors} change(s).`);
})();
