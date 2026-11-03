/**
 * patch-shipment-fail-line-2026-11-03.macro.js — THE SHIPMENT'S FAIL CARD FITS BOTH ATTEMPTS (Dave 2026-11-03, failure pass: a failed
 * Rite read "The Utter Darkness does not stay standardized." — Standardize and Rite share khezek_tor_shipment_fail). Dave's line:
 * "The darkness does not abate." replaces that opening sentence; the rest of the card is unchanged.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const SHIPMENT_FAIL_LINE = (() => {
  const ID = "khezek_tor_shipment_fail", OLD = "The Utter Darkness does not stay standardized.", NEW = "The darkness does not abate.";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const b = beats.find(x => x?.id === ID); if (!b) { conflicts.push(`${ID} not found`); return { changes, report, conflicts }; }
    const d = String(b.description || "");
    if (d.includes(OLD)) { b.description = d.replace(OLD, NEW); changes++; report.push(`✚ ${ID}: "${NEW}"`); }
    else if (!d.includes(NEW)) conflicts.push(`${ID}: opening line not found (text changed?)`);
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = SHIPMENT_FAIL_LINE;
} else (async () => {
  const DRY_RUN = (globalThis.__shipFailDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = SHIPMENT_FAIL_LINE.apply(camp);
  console.log(`[shipment fail line 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__shipFail = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-shipment-fail-line-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — the shipment's fail card (${changes}).`);
})();
