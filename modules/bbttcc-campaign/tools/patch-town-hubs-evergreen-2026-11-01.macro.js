/**
 * patch-town-hubs-evergreen-2026-11-01.macro.js — Dave, 11-01: "I went to the Waiting Room to talk to Doc Greeley … it won't
 * let me in." Live-caught behind it: Pike's closure closed the Allesh-Gilliam quest, and THE SPINE SEALS (story-model
 * sealOfDecl, 2026-09-19) — a scripted quest's step beats seal with the quest. Pike's Act 2 hub is the "trouble" step and the
 * Welcome Round walk is an arrival step, so the whole town hub sealed ("its quest is complete (closure)"), the hex's arrival
 * (hexOverride onEnterBeatIds = hub + walk) had nothing left to open, and every door hanging off the hub went with it.
 * The Fixit Farm's yard hub and town walk sealed the same way when the Farm settled; Khezek-Tor and Lyrenn would follow.
 *
 * A TOWN IS A PLACE. `inject.evergreen = true` is the engine's own opt-out ("town services meant to outlive their act",
 * _beatSealed) — it exempts a beat from the quest-closed AND act seals. Set on every town hub + walk + opener:
 *   Allesh-Gilliam  allesh_gilliam_introduction_to_hq · allesh_gilliam_town_walk · allesh_gilliam_hq_cinematics
 *   Fixit Farm      fixit_intro_scene · fixit_town_walk · fixit_cinematic_intro
 *   Khezek-Tor      khezek_tor_quest_scene · khezek_tor_main_scene · khezek_tor_town_walk
 *   Lyrenn          lyrenn_quest_scene · lyrenn_main_scene · lyrenn_opening_scene · lyrenn_town_walk
 * (grief towns are evergreen at the QUEST level already, 2026-09-25). Hub CHOICES keep their own gates, so a closed errand
 * does not come back — only the room does. Missing ids are reported, not conflicts (worlds differ).
 * Pure `apply(camp)` (node lint proof) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const TOWN_HUBS_PATCH = (() => {
  const HUBS = ["allesh_gilliam_introduction_to_hq", "allesh_gilliam_town_walk", "allesh_gilliam_hq_cinematics",
    "fixit_intro_scene", "fixit_town_walk", "fixit_cinematic_intro",
    "khezek_tor_quest_scene", "khezek_tor_main_scene", "khezek_tor_town_walk",
    "lyrenn_quest_scene", "lyrenn_main_scene", "lyrenn_opening_scene", "lyrenn_town_walk"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    for (const id of HUBS) {
      const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not in this world — skipped`); continue; }
      b.inject = b.inject || {};
      if (b.inject.evergreen === true) { report.push(`· ok ${id} evergreen`); continue; }
      b.inject.evergreen = true; changes++; report.push(`✚ ${id}: evergreen — never sealed by its quest's close or its act`);
    }
    return { changes, report, conflicts };
  }
  return { apply, HUBS };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = TOWN_HUBS_PATCH;                                    // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = TOWN_HUBS_PATCH.apply(camp);
  console.log(`[town hubs evergreen 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__townHubsEvergreen = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-town-hubs-evergreen-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — a town is a place; its hubs outlive its quest.`);
})();
