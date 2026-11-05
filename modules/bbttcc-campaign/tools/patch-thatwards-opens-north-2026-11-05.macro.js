/**
 * patch-thatwards-opens-north-2026-11-05.macro.js — Dave 2026-11-05: Thatwards Ho! stays the opening but plays on the Allesh Gilliam
 * North map, not its TEMP AI scene. It routes on to Allesh-Gilliam - Welcome! (same map), which accepts the Allesh-Gilliam quest; that
 * is what lights the North Gate door's quest pin.
 * Idempotent. DRY_RUN first (globalThis.__twDry = false applies). GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__twDry !== false;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id);
  const NORTH = "Scene.Tk6Yuz4ZLu4kj2eV", WELCOME = "allesh_gilliam_opening_scene";
  if (!game.scenes.get(NORTH.replace("Scene.", ""))) throw new Error("no Allesh Gilliam North scene");
  const beats = foundry.utils.deepClone(c.beats);
  const tw = beats.find(b => b.id === "thatwards_ho_opening_scene");
  if (!tw || !beats.some(b => b.id === WELCOME)) throw new Error("missing beat");
  const report = { DRY_RUN, scene: tw.sceneId === NORTH ? "ok" : `${tw.sceneId} -> ${NORTH}`, route: (tw.choices || []).some(x => x.next === WELCOME) ? "ok" : `add -> ${WELCOME}` };
  tw.sceneId = NORTH;
  if (!(tw.choices || []).some(x => x.next === WELCOME)) tw.choices = [...(tw.choices || []), { label: "Continue", next: WELCOME }];
  if (!DRY_RUN) await C.saveCampaign(id, { ...c, beats });
  console.log("TWNORTH " + JSON.stringify(report));
  ui.notifications.info(`Thatwards Ho!: ${DRY_RUN ? "dry run" : "applied"}.`);
})();
