/*
 * patch-reliable-steward-spots-2026-11-07.macro.js — Dave's hand placement of the Stewards around the Reliable's stairs on Living Quarters. Boarding and the Living Quarters button use these squares.
 * Ember Bad Eden. globalThis.__reliableSpotsDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__reliableSpotsDry !== false, MOD = "bbttcc-campaign", UP = "defaultLevel0000", report = { DRY_RUN, text: [] };
  const scene = game.scenes.get("hM1o5Wlfw5PrztCU"); if (!scene) throw new Error("scene not found");
  const spots = {
    lxbp9hv5aT4W1rwb: { x: 1350, y: 1050 },   // JESSIE, above
    h408YxDGZv9eDkKq: { x: 1500, y: 1200 },   // Toran Rol, right
    IgTzmf0detjLtZFc: { x: 1350, y: 1350 },   // Marginalia, below
    N6zoz0jT0fjXiobU: { x: 1200, y: 1200 }    // Marmalade, left
  };
  if (JSON.stringify(scene.getFlag(MOD, "stewardSpots")?.[UP] || null) !== JSON.stringify(spots)) {
    report.text.push("set Living Quarters spots");
    if (!DRY_RUN) await scene.setFlag(MOD, "stewardSpots", { [UP]: spots });
  }
  console.log("RELIABLESPOTS " + JSON.stringify(report));
})();
