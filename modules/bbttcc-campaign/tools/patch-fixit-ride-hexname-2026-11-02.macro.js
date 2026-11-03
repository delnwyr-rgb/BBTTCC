/**
 * patch-fixit-ride-hexname-2026-11-02.macro.js — "Take the spanner — ride for Fixit" opened an EMPTY Travel Console (failure pass
 * 2026-11-02): ag_ride_fixit's "🐎 Saddle up — ride out" asked openTravel for "Furrier's Fixit Farm", but the hex is
 * "Furrier's Fixit-Farm". The only miss among the campaign's 42 openTravel targets. (The console also gained a punctuation-blind
 * fallback in bbttcc-travel-console.js.) Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const FIXIT_RIDE_PATCH = (() => {
  const FROM = "Furrier's Fixit Farm", TO = "Furrier's Fixit-Farm";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = []; let changes = 0;
    const walk = (o, p) => { if (!o || typeof o !== "object") return;
      if (o.openTravel && o.openTravel.hexName === FROM) { o.openTravel.hexName = TO; changes++; report.push(`✚ ${p}: openTravel → ${TO}`); }
      for (const [k, v] of Object.entries(o)) if (v && typeof v === "object" && k !== "openTravel") walk(v, `${p}.${k}`); };
    for (const b of beats) walk(b, b.id);
    return { changes, report, conflicts: [] };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = FIXIT_RIDE_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__fixitRideDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = FIXIT_RIDE_PATCH.apply(camp);
  console.log(`[fixit ride hexname 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__fixitRide = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-fixit-ride-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — the Fixit ride finds its hex (${changes}).`);
})();
