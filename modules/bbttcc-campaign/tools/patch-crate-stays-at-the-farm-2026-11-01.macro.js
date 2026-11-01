/**
 * patch-crate-stays-at-the-farm-2026-11-01.macro.js — Dave, 11-01 (playing the Leyline Stabilizer, Shared Oversight won):
 *   "now it wants me to ride right back to Garren with it. That's in another town. we should allow the players to go back
 *    to visiting people in FFF, and make dropping off something that happens when the players get back to AG. Their quest
 *    log can show that's the next step. They just shouldn't be forced to go right now."
 *
 * Load the Crate (and its "three doorstops" answer beat) had ONE exit: "Ride home to Garren." → ride_back_home (the road beat,
 * which opens travel to Allesh-Gilliam). Now both beats lead with "Back to the yard." → fixit_intro_scene (the Farm hub, every
 * door still open); the ride stays as a second, optional exit. The hand-off itself was already waiting at Allesh-Gilliam:
 *   • Pike's hub carries "Bring the crate to the Leygate — Garren's waiting" (after any stabilizer deal, until installed)
 *   • the allesh_gilliam script's `install` step is the quest-log NEXT once the Fixit chapter is done
 * The install step's line now says it keeps: "When you're next in Allesh-Gilliam, bring the stabilizer crate to Garren at the
 * Leygate. It keeps." (written only when the live line is still the known one — a later wordsmith is left alone).
 *
 * Pure `apply(camp)` (mutates in place, returns { changes, report, conflicts }) — runs in node for the offline lint proof
 * (build a bundle from a `campaigns` backup, run bin/ft-lint-campaign) and in Foundry below. Idempotent (rerun = 0).
 * DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const CRATE_YARD_PATCH = (() => {
  const HUB = "fixit_intro_scene";
  const CRATE_BEATS = ["fixit_load_the_crate", "ans_fixit_load_the_crate_ask_about_the_three_doorstops"];
  const YARD = { label: "Back to the yard.", next: HUB,
    description: "The crate's roped and it isn't going anywhere without you. Garren has waited since the Cough; he'll keep until you're next in Allesh-Gilliam. The Farm is still open.",
    checkStat: "", checkDC: 0, failNext: "" };
  const INSTALL_OLD = "Bring the stabilizer crate to Garren at the Leygate.";
  const INSTALL_NEW = "When you're next in Allesh-Gilliam, bring the stabilizer crate to Garren at the Leygate. It keeps.";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    if (!byId.has(HUB)) conflicts.push(`${HUB}: hub beat not found`);
    for (const id of CRATE_BEATS) {
      const b = byId.get(id);
      if (!b) { conflicts.push(`${id}: beat not found`); continue; }
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      const have = b.choices.find(c => c && (String(c.label) === YARD.label || String(c.next) === HUB));
      if (have) {
        // idempotent: present → ensure it leads (the ride stays, second)
        if (b.choices.indexOf(have) !== 0) { b.choices.splice(b.choices.indexOf(have), 1); b.choices.unshift(have); changes++; report.push(`✎ ${id}: "${YARD.label}" leads`); }
        else report.push(`· ok ${id}: "${YARD.label}"`);
        continue;
      }
      if (!b.choices.some(c => String(c?.next) === "ride_back_home")) conflicts.push(`${id}: no "Ride home" exit found — shape changed, look first`);
      b.choices.unshift({ ...YARD });
      changes++; report.push(`✚ ${id}: "${YARD.label}" → ${HUB} (leads; "Ride home to Garren." kept as the optional exit)`);
    }
    const step = camp.story?.scripts?.allesh_gilliam?.steps?.find?.(s => s && s.id === "install");
    if (!step) conflicts.push("allesh_gilliam script: install step not found");
    else if (step.line === INSTALL_NEW) report.push("· ok allesh_gilliam.install line");
    else if (step.line === INSTALL_OLD) { step.line = INSTALL_NEW; changes++; report.push(`✎ allesh_gilliam.install line → "${INSTALL_NEW}"`); }
    else report.push(`⚠ allesh_gilliam.install line was wordsmithed after seeding — left alone: "${step.line}"`);
    return { changes, report, conflicts };
  }
  return { apply, YARD, HUB, CRATE_BEATS, INSTALL_OLD, INSTALL_NEW };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = CRATE_YARD_PATCH;                                   // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = CRATE_YARD_PATCH.apply(camp);
  console.log(`[crate stays at the farm 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__crateStaysAtTheFarm = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-crate-stays-at-the-farm-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the crate waits at the Farm; Garren takes it when you're next in Allesh-Gilliam.`);
})();
