/**
 * patch-town-places-evergreen-2026-11-02.macro.js — click-through (2026-11-02): the table rode back to Furrier's Fixit-Farm to buy the
 * Absolutely Reliable and the Arc Bay would not open: "its quest "Furrier's Fixit Farm" is complete (settles)". The 11-01 pass
 * (patch-town-hubs-evergreen) made the town HUBS evergreen, but the rooms behind their doors are script STEP beats too, so the quest's
 * closer sealed them (THE SPINE SEALS) — the door was on the map and led nowhere. A room is a PLACE: these six get inject.evergreen.
 * Once-only events behind doors (KT Official Word, the Leygate delivery …) stay sealed on purpose; the Act 1 first-night beats are events.
 * Sweep used live: every evergreen hub choice whose target C.sealed() reports quest-complete, kept to repeatable rooms behind an exterior.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const TOWN_PLACES_PATCH = (() => {
  const IDS = ["allesh_gilliam_the_east_wall_intro", "fixit_gullywasher_welcome", "fixit_general_store_coversation", "fixit_arc_bay_conversation", "lyrenn_water_choir", "lyrenn_seed_vault"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const id of IDS) {
      const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; }
      b.inject = b.inject || {};
      if (b.inject.evergreen === true) { report.push(`· ok ${id}`); continue; }
      b.inject.evergreen = true; changes++; report.push(`✚ ${id}: a room is a place — evergreen (the quest closer no longer seals it)`);
    }
    return { changes, report, conflicts };
  }
  return { apply, IDS };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = TOWN_PLACES_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = TOWN_PLACES_PATCH.apply(camp);
  console.log(`[town places evergreen 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__townPlaces = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-town-places-evergreen-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — town rooms stay open after their quest.`);
})();
