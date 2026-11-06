/*
 * patch-park-tent-2026-11-06.macro.js — Dave 2026-11-06: the white tent joins the rest of the Sarmoung Hum on the expansion pile.
 * Uses the 2026-10-21 parking schema: Act-9 gate on the two beats (original on beat._deferred), the Crossroads choice hidden (original on choice._deferred),
 * and the Arrival step moved to arrival._deferredSteps.
 * Ember Bad Eden. globalThis.__parkTentDry = false applies; anything else is a dry run. globalThis.__parkTentMode = "restore" puts it all back. Idempotent both ways.
 */
(async () => {
  const DRY_RUN = globalThis.__parkTentDry !== false, MODE = globalThis.__parkTentMode === "restore" ? "restore" : "park";
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const report = { DRY_RUN, MODE, text: [] };
  const beats = foundry.utils.deepClone(c.beats), story = foundry.utils.deepClone(c.story);
  const IDS = ["hum_quiet_tent", "hum_quiet_tent_ask"], GATE = { flag: "storyPhase", gte: 9 }, AT = "2026-11-06";
  const find = (x) => beats.find(b => b.id === x);
  const choice = find("ag_crossroads_first_rides").choices.find(x => x.next === "hum_quiet_tent");
  const arrival = story.scripts.allesh_gilliam.arrival;
  if (MODE === "park") {
    for (const x of IDS) {
      const b = find(x); if (b._deferred) continue;
      const orig = b.inject?.requires ?? null;
      b._deferred = { requires: orig == null ? null : foundry.utils.deepClone(orig), hadInject: b.inject != null, at: AT };
      b.inject = b.inject || {};
      b.inject.requires = [...(orig == null ? [] : [].concat(foundry.utils.deepClone(orig))), { ...GATE }];
      report.text.push(`${x}: parked`);
    }
    if (choice && !choice._deferred) { choice._deferred = { requires: choice.requires == null ? null : foundry.utils.deepClone(choice.requires), at: AT }; choice.requires = { ...GATE }; report.text.push("Crossroads: tent choice hidden"); }
    const at = arrival.steps.findIndex(s => s.id === "tent");
    if (at >= 0) { const [step] = arrival.steps.splice(at, 1); (arrival._deferredSteps = arrival._deferredSteps || []).push({ index: at, step }); report.text.push("quest log: tent step parked"); }
  } else {
    for (const x of IDS) {
      const b = find(x); if (!b._deferred) continue;
      if (b._deferred.requires == null) delete b.inject.requires; else b.inject.requires = b._deferred.requires;
      delete b._deferred; report.text.push(`${x}: restored`);
    }
    if (choice?._deferred) { if (choice._deferred.requires == null) delete choice.requires; else choice.requires = choice._deferred.requires; delete choice._deferred; report.text.push("Crossroads: tent choice back"); }
    const parked = (arrival._deferredSteps || []).find(p => p.step?.id === "tent");
    if (parked) { arrival.steps.splice(Math.min(parked.index, arrival.steps.length), 0, parked.step); arrival._deferredSteps = arrival._deferredSteps.filter(p => p !== parked); if (!arrival._deferredSteps.length) delete arrival._deferredSteps; report.text.push("quest log: tent step back"); }
  }
  report.marks = MODE === "park" ? IDS.filter(x => C.story.state(id)?.played?.[x]) : [];
  if (!DRY_RUN && report.text.length) {
    await C.saveCampaign(id, { ...c, beats, story });
    if (report.marks.length) await C.story.forget(report.marks, id);
  }
  console.log("PARKTENT " + JSON.stringify(report));
  ui.notifications.info(`Tent ${MODE}: ${DRY_RUN ? "dry run" : "applied"}, ${report.text.length} change(s).`);
})();
