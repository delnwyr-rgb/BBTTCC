/**
 * patch-ag-leygate-scene-2026-10-30.macro.js — Dave, 10-30: "have the Allesh Gilliam Leygate scene link to
 * Scene.dR3w3H2YOWQuCwrH, rather than the Battlemap." The Leygate story beats move off the battlemap onto the scene
 * the Leygate exterior already uses:
 *   ag_leygate_visit · ag_leygate_delivery · ag_leygate_installed   sceneId → dR3w3H2YOWQuCwrH
 * And (Dave, same night: "didn't get the option to talk to Garren and get the part"): the visit IS Garren handing over the
 * Tetrarch Spanner, but its only button was Leave. It now leads with "Take the spanner — ride for Fixit" → ag_ride_fixit
 * (the Saddle-up road beat), Leave kept.
 * Prints both scene names in the dry run. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const TO = "dR3w3H2YOWQuCwrH";
  const IDS = ["ag_leygate_visit", "ag_leygate_delivery", "ag_leygate_installed"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  if (!game.scenes.get(TO)) return ui.notifications.error(`Scene ${TO} not found in this world.`);
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; const conflicts = []; let changes = 0;
  const nm = (id) => game.scenes.get(id)?.name || `(missing ${id})`;
  for (const id of IDS) {
    const b = beats.find(x => x && String(x.id) === id);
    if (!b) { conflicts.push(`${id}: beat not found`); continue; }
    const cur = String(b.sceneId || "").replace(/^Scene\./, "");
    if (cur !== TO) { b.sceneId = TO; changes++; report.push(`✎ ${id}: scene "${nm(cur)}" → "${nm(TO)}"`); }
  }
  const visit = beats.find(x => x && String(x.id) === "ag_leygate_visit");
  if (!beats.some(x => x && String(x.id) === "ag_ride_fixit")) conflicts.push("ag_ride_fixit: beat not found");
  else if (visit) {
    visit.choices = Array.isArray(visit.choices) ? visit.choices : [];
    if (!visit.choices.some(c => String(c?.next) === "ag_ride_fixit")) {
      visit.choices.unshift({ label: "Take the spanner — ride for Fixit", next: "ag_ride_fixit", description: "Garren's spanner in the oilcloth. Whatever they sell you at Fixit, it has to fit this.", checkStat: "", checkDC: 0, failNext: "" });
      changes++; report.push("✚ ag_leygate_visit: \"Take the spanner — ride for Fixit\" → ag_ride_fixit");
    }
  }
  console.log(`[ag leygate scene 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__agLeygateScene = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-ag-leygate-scene-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Leygate beats play on ${nm(TO)}.`);
})();
