/**
 * patch-round-three-2026-11-03.macro.js — story fixes from round three of the GM click-through (a real four-Steward party).
 *   • Verification Begins (Circuit Riders): after all three questions the hub had no way out, only greyed repeats. "Terms of contact" now
 *     appears there once all three have been asked.
 *   • The Fifteen-Year Siege is PARKED (Dave 2026-11-03: "Let's skip it"): its hex lives only on an unlinked scene, so NOW's Ride-to button stranded the GM. Its one entry,
 *     siege_market_day, now also requires beatMark "siege_unparked", which nothing sets. Unpark: remove that row once the Siege has a door on the main map.
 *   • The Act Three card closes once Act Three has passed (2026-11-04), as Acts Four and Five do: with no upper limit, a table that settled
 *     Khezek-Tor late would get "Act Three" in the middle of a later act.
 *   • Gloomgill's questions run in order (2026-11-04): only Question 1 carried the lamp gate, so Resume skipped to Question 2, sent the table back
 *     to a lake that refused them, and its Run next would have stepped past the gate. Each question now requires the one before it.
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
    const a3 = beats.find(b => b?.id === "a3_title_card");
    if (!a3) conflicts.push("beat not found: a3_title_card");
    else {
      a3.inject = a3.inject || {};
      const req = Array.isArray(a3.inject.requires) ? a3.inject.requires : [];
      if (!req.some(r => r?.flag === "storyPhase" && r?.lte === 3)) { a3.inject.requires = [...req, { flag: "storyPhase", lte: 3 }]; changes++; report.push("✚ a3_title_card: closes after Act Three"); }
    }
    for (let n = 2; n <= 10; n++) {
      const q = beats.find(b => b?.id === `gloomgill_question_${n}`);
      if (!q) { conflicts.push(`beat not found: gloomgill_question_${n}`); continue; }
      q.inject = q.inject || {};
      const req = Array.isArray(q.inject.requires) ? q.inject.requires : [];
      const prev = `gloomgill_question_${n - 1}`;
      if (!req.some(r => r?.beatMark === prev)) { q.inject.requires = [...req, { beatMark: prev }]; changes++; report.push(`✚ ${q.id}: requires ${prev}`); }
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
