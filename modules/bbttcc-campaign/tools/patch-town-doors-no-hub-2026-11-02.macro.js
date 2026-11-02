/**
 * patch-town-doors-no-hub-2026-11-02.macro.js — Dave, 11-02: "We don't actually need a town hub beat list on screen. The quest list +
 * town maps with quest markers over the buildings with activities should be fine pretty much everywhere."
 * Follows patch-town-doors-all-acts-2026-11-02 (kept: every door beat evergreen; the Act-1-only door gates removed with their Act 1
 * routes kept Act 1; St Gilliam's Act 2 route to Father Tamsin). Reverted here:
 *   • the new allesh_gilliam_town_act2 hub beat is removed, and the AG hexOverride arrival no longer lists it or Pike's office —
 *     Act 1 still lands on the Welcome Round; from Act 2 arriving in Allesh-Gilliam opens no dialog: the town map's doors are the hub
 *   • the "Back to town / Back to the rows / Go in" Act 2 routes that pointed into a dialog hub (the removed AG hub, the KT quest scene,
 *     the Lyrenn rows) come off the door beats — leaving a door closes it and the table is on the town map
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const NO_HUB_PATCH = (() => {
  const HUB = "allesh_gilliam_town_act2";
  const HUBS = new Set([HUB, "khezek_tor_quest_scene", "lyrenn_quest_scene"]);
  const isAct2 = (c) => (Array.isArray(c?.requires) ? c.requires : []).some(r => r && r.flag === "storyPhase" && r.gte === 2);
  function apply(camp, { doorBeatIds = [] } = {}) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const i = beats.findIndex(b => b && b.id === HUB);
    if (i >= 0) { beats.splice(i, 1); changes++; report.push(`✚ beat ${HUB} removed`); } else report.push(`· ok no ${HUB}`);
    for (const [k, ov] of Object.entries(camp.hexOverrides || {})) {
      const ids = Array.isArray(ov?.onEnterBeatIds) ? ov.onEnterBeatIds : null; if (!ids || !ids.includes("allesh_gilliam_town_walk")) continue;
      const want = ids.filter(x => x !== HUB && x !== "allesh_gilliam_introduction_to_hq");
      if (JSON.stringify(ids) !== JSON.stringify(want)) { ov.onEnterBeatIds = want; changes++; report.push(`✚ hexOverride ${k}: arrival = ${want.join(", ")} (Act 2+ = the town map, no dialog)`); } else report.push(`· ok hexOverride ${k}`);
    }
    const doors = new Set(doorBeatIds);
    for (const b of beats) {
      if (!b || !Array.isArray(b.choices)) continue;
      const before = b.choices.length;
      // any choice into the removed hub goes (wherever it lives); Act-2 routes from a DOOR into a town dialog hub go too
      b.choices = b.choices.filter(c => !(c && (c.next === HUB || (doors.has(b.id) && HUBS.has(String(c.next)) && isAct2(c)))));
      if (b.choices.length !== before) { changes += before - b.choices.length; report.push(`✚ ${b.id}: ${before - b.choices.length} route(s) into a dialog hub removed`); }
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();
if (typeof game === "undefined" && typeof module !== "undefined") { module.exports = NO_HUB_PATCH; }
else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  let doorBeatIds = []; try { const arr = await game.bbttcc.api.travel.doors.list(); doorBeatIds = (Array.isArray(arr) ? arr : Object.values(arr || {})).map(d => d?.beatId).filter(Boolean); } catch (_e) {}
  const { changes, report, conflicts } = NO_HUB_PATCH.apply(camp, { doorBeatIds });
  console.log(`[town doors no hub 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__noHub = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-town-doors-no-hub-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the town map is the hub.`);
})();
