/**
 * patch-ag-exits-close-2026-11-02.macro.js — Dave, 11-02: "We don't actually need a town hub beat list … the quest list + town maps with
 * quest markers over the buildings should be fine." Live-caught on the click-through: leaving Etta (and Tamsin, the Muster, the
 * Waiting Room, the East Wall, the Leygate …) dropped the table into Pike's office — 23 exits routed to allesh_gilliam_introduction_to_hq.
 * An EXIT choice (Leave / Something else / Back to the HQ / Thank her / Move on …) outside Pike's own beats now closes the dialog
 * (next "") — the table is on the town map. Story routes into the HQ ("Back to Pike", "On to HQ — the trouble starts", "Actually —
 * back to the HQ") are untouched. "Back to the HQ" exits are relabelled "Leave".
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const AG_EXITS_PATCH = (() => {
  const HQ = "allesh_gilliam_introduction_to_hq";
  const EXIT = /^\W*(leave|something else|back to the hq|back to town|thank (her|him)|move on|that.s enough|done here|walk on|let (him|her|them) (work|be)|leave (him|her|them))/i;
  const PIKE = /^(allesh_gilliam_marshall_yarrow|allesh_gilliam_hq_cinematics|allesh_gilliam_introduction_to_hq)/;
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = []; let changes = 0;
    for (const b of beats) { if (!b || PIKE.test(String(b.id))) continue;
      for (const c of (b.choices || [])) { if (!c || c.next !== HQ || !EXIT.test(String(c.label || ""))) continue;
        c.next = ""; if (/^back to the hq$/i.test(String(c.label).trim())) c.label = "Leave";
        changes++; report.push(`✚ ${b.id} "${c.label}": closes to the town map (was → Pike's office)`); } }
    if (!changes) report.push("· nothing to change");
    return { changes, report, conflicts: [] };
  }
  return { apply };
})();
if (typeof game === "undefined" && typeof module !== "undefined") { module.exports = AG_EXITS_PATCH; }
else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report } = AG_EXITS_PATCH.apply(camp);
  console.log(`[ag exits close 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__agExits = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-ag-exits-close-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — exits close to the town map.`);
})();
