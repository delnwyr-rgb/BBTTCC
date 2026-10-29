/**
 * patch-kt-brace-lit-desk-warehouse-2026-10-28.macro.js — Dave, 10-28:
 *   "Let's keep [Brennig] at the Warehouse. It adds another place on the map to go to." · "The Brace should be lit up if the
 *   Stewards haven't talked to Calder yet on their Act 2 visit."
 * 1) The Lift Hall's description put Brennig's two-pallets-and-a-door desk IN the Lift Hall; it now sits in the Warehouse
 *    (his beat, door and token moved there in patch-kt-official-word-places).
 * 2) A hub door lights when an active quest's NEXT beat is set on its scene (location-doors.js nowDoorsHere). In Act 2,
 *    Khezek-Tor's next is the Mine That Answered Back's opener — Calder's "You agreed to go below…", set on the MAW scene,
 *    so the Maw lit. Calder offers it at the Brace now ("Go below with you"), so the opener's sceneId → the Brace scene:
 *    the Brace lights until the table takes Calder's job. The Mine itself (going below) stays at the Maw.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const report = []; const conflicts = []; let changes = 0;
  const BRACE = "iYxQhjbMDGjDy6W0";

  const lift = byId("khezek_tor_the_lift_hall");
  const FROM = "runs the crates, the counts, and the cage schedule from a desk built out of two pallets and a door.";
  const TO = "runs the crates, the counts, and the cage schedule from a desk built out of two pallets and a door, over in the Warehouse.";
  if (!lift) conflicts.push("khezek_tor_the_lift_hall: not found");
  else if (!String(lift.description || "").includes(TO)) {
    if (!String(lift.description || "").includes(FROM)) conflicts.push("Lift Hall: desk sentence not found");
    else { lift.description = lift.description.replace(FROM, TO); changes++; report.push("✎ khezek_tor_the_lift_hall: Brennig's desk is in the Warehouse"); }
  }

  const acc = byId("khezek_tor_mine_that_answered_back_quest_acceptance");
  if (!acc) conflicts.push("Mine opener: not found");
  else if (acc.sceneId !== BRACE) { report.push(`✎ Mine opener sceneId ${acc.sceneId} → ${BRACE} (the Brace lights until the job is taken)`); acc.sceneId = BRACE; changes++; }

  console.log(`[kt brace lit / desk warehouse 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktBraceLit = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-brace-lit-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Brace lights for Calder; Brennig's desk is in the Warehouse.`);
})();
