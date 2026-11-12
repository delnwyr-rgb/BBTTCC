/*
 * patch-ag-leygate-pov-and-delivery-door-2026-11-12.macro.js — Dave (2026-11-12), at the Allesh-Gilliam Leygate with the
 * stabilizer crate: "Let's Go In partner! And this should be taking place on the POV scene please."
 *  1. allesh_gilliam_leygate_exterior is a cinematic that opened on the Leygate POV and, 5 s later, cut to the Leygate battlemap
 *     (cinematic.nextSceneId). The cut goes: the Leygate stays on its POV (allesh_gilliam_leygate_pov). The battlemap stays
 *     linked on the door for fights.
 *  2. "Go in" always led to ag_leygate_visit (the spanner pickup), so with the crate in hand the door re-ran the old scene and the
 *     delivery (ag_leygate_delivery) was reachable only from HQ. Now two "Go in"s:
 *       • crate due (visit played + stabilizer won by trade / shared oversight / hard ask + not installed) → ag_leygate_delivery
 *       • otherwise → ag_leygate_visit (unchanged)
 * Ember Bad Eden. globalThis.__agGateDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__agGateDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const ext = beats.find(b => b.id === "allesh_gilliam_leygate_exterior");
  if (!ext || !beats.some(b => b.id === "ag_leygate_delivery") || !beats.some(b => b.id === "ag_leygate_visit")) throw new Error("Leygate beats missing");
  const POV = "Scene.dR3w3H2YOWQuCwrH";

  if (ext.cinematic?.nextSceneId && ext.cinematic.nextSceneId !== POV) {
    ext.cinematic = { ...ext.cinematic, nextSceneId: "" };
    report.changed.push("exterior: no cut to the battlemap — stays on the POV");
  }

  const STAB = ["fixit_leyline_stabilizer_trade_success", "fixit_leyline_stabilizer_shared_oversight_success", "fixit_leyline_stabilizer_hard_ask"];
  const DUE = [{ beatMark: "ag_leygate_visit" }, { anyOf: STAB.map(id => ({ beatMark: id })) }, { beatMark: "ag_leygate_installed", not: true }];
  const NOT_DUE = [{ anyOf: [{ beatMark: "ag_leygate_visit", not: true }, { allOf: STAB.map(id => ({ beatMark: id, not: true })) }, { beatMark: "ag_leygate_installed" }] }];
  const ch = (next, requires) => ({ label: "Go in", next, description: "", checkStat: "", checkDC: 0, failNext: "", requires });
  const WANT = [ch("ag_leygate_delivery", DUE), ch("ag_leygate_visit", NOT_DUE)];
  if (JSON.stringify((ext.choices || []).map(x => [x.label, x.next, x.requires || null])) !== JSON.stringify(WANT.map(x => [x.label, x.next, x.requires]))) {
    ext.choices = WANT; report.changed.push("exterior: Go in → the delivery when the crate is due, else the visit");
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("AGGATE " + JSON.stringify(report));
  return report;
})();
