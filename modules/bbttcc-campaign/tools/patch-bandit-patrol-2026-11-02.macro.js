/**
 * patch-bandit-patrol-2026-11-02.macro.js — after the Accord (any ending) a bandit ambush is diverted at executeBeat entry
 * (module.js BANDIT_PATROL_BEAT_ID) to this beat: the Drowned South's crews, now on the right side of the water-road, wave the party
 * through. Live-caught 11-02: an "Arms Down" surrender rolled in water the Evil Good Faction now patrols. Code-fired (lint CODE_FIRED).
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const PATROL_PATCH = (() => {
  const BEAT = {
    id: "bandit_patrol_waves", label: "The Water-Road — A Friendly Patrol", type: "dialog", timeScale: "scene", timePoints: 0, questId: "quest_bandit_accord",
    tags: "bandit_accord,road,patrol", politicalTags: "",
    description: "A punt slides out of the reeds where an ambush used to wait, {{#played bandit_summit_accord}}flying the Evil Good Faction's banner{{else}}in Muster colours that are still a size too big{{/played}}. The crew raise empty hands first, out of habit, then remember they don't have to and turn it into a wave. \"Road's clear to the next channel,\" their point man calls. \"We checked. Twice. You want eel jerky?\"",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [], evergreen: true },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, storyChain: "", priority: "background",
    story: { quest: "bandit_accord" }, worldEffects: {}, sceneId: "", where: "anywhere",
    choices: [{ label: "Wave back and ride on.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }]
  };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    if (beats.some(b => b && b.id === BEAT.id)) return { changes: 0, report: ["· ok bandit_patrol_waves"], conflicts: [] };
    beats.push(BEAT); return { changes: 1, report: ["✚ bandit_patrol_waves"], conflicts: [] };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = PATROL_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = PATROL_PATCH.apply(camp);
  console.log(`[bandit patrol 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__patrol = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-bandit-patrol-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info("Applied — the water-roads are friendly now.");
})();
