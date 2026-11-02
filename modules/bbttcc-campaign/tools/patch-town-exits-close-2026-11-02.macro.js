/**
 * patch-town-exits-close-2026-11-02.macro.js — Dave, 11-02: "We don't actually need a town hub beat list on screen. The quest list +
 * town maps with quest markers over the buildings with activities should be fine pretty much everywhere." Allesh-Gilliam got this in
 * patch-ag-exits-close; the click-through caught Khezek-Tor next ("Back down the shaft" after the seal dropped the table into the
 * Quest Scene list). Same rule for the two towns whose hub dialogs are fully covered by town-map doors (checked live: every hub choice
 * is reachable from a door, or — the Upper Galleries — from the spine step that opens it):
 *   • an EXIT choice (Leave / Withdraw / Back to the yard / Back down the stairs / Back up to the switchback / Back down the shaft /
 *     Back to the mountain / Leave him to his counting) into khezek_tor_quest_scene or fixit_intro_scene closes the dialog (next "") —
 *     the table is on the town map. Story routes into a hub ("Head inside", "Bring it up.", the courier's face) are untouched.
 * Lyrenn is NOT patched: its town map has no doors for Elsin's east channels, the fence line, the Green Ring or Rowan — its Quest Scene
 * list is still the only way in (Dave's call).
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const TOWN_EXITS_PATCH = (() => {
  const HUBS = new Set(["khezek_tor_quest_scene", "fixit_intro_scene"]);
  const EXIT = /^\W*(leave|withdraw|back (to the yard|down the stairs|up to the switchback|down the shaft|to the mountain))/i;
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = []; let changes = 0;
    for (const b of beats) { if (!b || HUBS.has(String(b.id))) continue;
      for (const c of (b.choices || [])) { if (!c || !HUBS.has(String(c.next)) || !EXIT.test(String(c.label || ""))) continue;
        const was = c.next; c.next = ""; changes++; report.push(`✚ ${b.id} "${c.label}": closes to the town map (was → ${was})`); } }
    if (!changes) report.push("· nothing to change");
    return { changes, report, conflicts: [] };
  }
  return { apply };
})();
if (typeof game === "undefined" && typeof module !== "undefined") { module.exports = TOWN_EXITS_PATCH; }
else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report } = TOWN_EXITS_PATCH.apply(camp);
  console.log(`[town exits close 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__townExits = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-town-exits-close-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — exits close to the town map.`);
})();
