/*
 * add-super-draw-watcher-beat-2026-11-07.macro.js — SUPER MODE (Dave 2026-11-07, ruling 6: "I like being pulled out
 * mid-fight for the big overshoots"). Adds the beat Super Mode fires when a Draw takes the leader's monthly Notice to 5+
 * (bbttcc-territory/scripts/super-mode.js → runBeat(cid, "adversary_super_draw_watcher")). A dialog card, no scene, so
 * the fight stays on its battlemap; its one exit returns to the fight. Tags avoid "adversary" so the Overshoot draw
 * never picks it. Text is a first draft for Dave to rewrite in the beat editor.
 * Ember Bad Eden. globalThis.__superWatcherDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__superWatcherDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const ID = "adversary_super_draw_watcher";
  if (beats.some(b => b.id === ID)) { console.log("SUPERWATCHER " + JSON.stringify({ ...report, note: "already there" })); return report; }
  beats.push({
    id: ID,
    label: "The Watcher Notices — Too Much, Too Fast",
    type: "dialog",
    timeScale: "moment",
    tags: "super-draw watcher",
    politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [],
    choices: [{ label: "Back to the fight.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
    playerFacing: true, playerFacingContent: true, playerFacingDialog: true, dialogPlayerFacing: true, showToPlayers: true,
    sceneId: null, timePoints: 0, pacing: { ambient: false },
    audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: true },
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false }, refs: {}, unlocks: { maneuvers: [], strategics: [] }, turnNumber: null, questId: null,
    description: "The ground gave you more than it should have, and something on the Other Side felt it go.\n\nFor one long breath the fight stops mattering. The light goes thin. Every Steward on the field feels the same cold attention settle on the back of the neck, patient and interested, the way a collector looks at a find.\n\nThen it lets go. The noise of the fight comes back all at once.\n\nIt knows your names now."
  });
  report.changed.push(`added ${ID}`);
  if (!DRY_RUN) await C.saveCampaign(id, { ...c, beats });
  console.log("SUPERWATCHER " + JSON.stringify(report));
  return report;
})();
