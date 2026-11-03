/**
 * patch-soft-landing-exit-2026-11-02.macro.js — Soft Landing's arrival hub ("Challenged by Pool Noodles") had seven doors and NO way out
 * (failure pass 2026-11-02: every door done, the table had to close the window with the X). A town exit closes to the map (Dave's
 * town-hub ruling), so the hub gets "Leave." Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const SOFT_LANDING_EXIT = (() => {
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    // 2026-11-03: the East Wall's Tor-Wrath win card ("What Leaned on It") offered only "Tell Pike — tally the swings", which is
    // once-locked when the Tally was already played (the NOW skip fixed in a0f09803) → no button at all. It gets a way out too.
    // 2026-11-03: the Crown Mall food court ("That 90s Coalition") — six doors, no exit; once all were asked the table was stuck.
    const targets = [beats.find(b => b?.label === "Soft Landing — Challenged by Pool Noodles"), beats.find(b => b?.id === "ag_east_wall_tor_wrath_won"), beats.find(b => b?.id === "enc_forgotten_yesterdays_tanneritos")];
    for (const hub of targets) {
      if (!hub) { conflicts.push("target beat not found"); continue; }
      const hasExit = (hub.choices || []).some(c => /^\W*(leave|back|ready to move on|not now)/i.test(String(c?.label || "")) && !c.next);
      if (!hasExit) { (hub.choices = hub.choices || []).push({ label: "Leave.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }); changes++; report.push(`✚ ${hub.id}: Leave.`); }
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = SOFT_LANDING_EXIT;
} else (async () => {
  const DRY_RUN = (globalThis.__slExitDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = SOFT_LANDING_EXIT.apply(camp);
  console.log(`[soft landing exit 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__slExit = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-soft-landing-exit-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — Soft Landing has a way out (${changes}).`);
})();
