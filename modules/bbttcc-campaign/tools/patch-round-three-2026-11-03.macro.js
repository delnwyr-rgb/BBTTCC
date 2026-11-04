/**
 * patch-round-three-2026-11-03.macro.js — story fixes from round three of the GM click-through (a real four-Steward party).
 *   • Verification Begins (Circuit Riders): after all three questions the hub had no way out, only greyed repeats. "Terms of contact" now
 *     appears there once all three have been asked.
 *   • The Fifteen-Year Siege is PARKED (Dave 2026-11-03: "Let's skip it"): its hex lives only on an unlinked scene, so NOW's Ride-to button stranded the GM. Its one entry,
 *     siege_market_day, now also requires beatMark "siege_unparked", which nothing sets. Unpark: remove that row once the Siege has a door on the main map.
 * Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const ROUND_THREE_PATCH = (() => {
  const HUB = "enc_circuit_riders_parley_respect";
  const TERMS = "enc_circuit_riders_parley_resolution";
  const ASKED = ["enc_circuit_riders_pressure_doctrine", "enc_circuit_riders_pressure_darkness", "enc_circuit_riders_pressure_witness"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const hub = beats.find(b => b?.id === HUB);
    if (!hub) conflicts.push(`beat not found: ${HUB}`);
    else if (!beats.some(b => b?.id === TERMS)) conflicts.push(`beat not found: ${TERMS}`);
    else if (!(hub.choices || []).some(c => c?.next === TERMS)) {
      hub.choices = [...(hub.choices || []), { label: "Terms of contact", next: TERMS, description: "", checkStat: "", checkDC: 0, failNext: "", requires: ASKED.map(beatMark => ({ beatMark })) }];
      changes++; report.push(`✚ ${HUB}: "Terms of contact" once all three questions are asked`);
    }
    const siege = beats.find(b => b?.id === "siege_market_day");
    if (!siege) conflicts.push("beat not found: siege_market_day");
    else {
      siege.inject = siege.inject || {};
      const req = Array.isArray(siege.inject.requires) ? siege.inject.requires : [];
      if (!req.some(r => r?.beatMark === "siege_unparked")) { siege.inject.requires = [...req, { beatMark: "siege_unparked" }]; changes++; report.push("✚ siege_market_day: parked (requires siege_unparked)"); }
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = ROUND_THREE_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__roundThreeDry ?? true);   // <-- set false (or globalThis.__roundThreeDry = false) to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = ROUND_THREE_PATCH.apply(camp);
  console.log(`[round three 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__roundThree = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-round-three-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — round three story fixes (${changes} change(s)).`);
})();
