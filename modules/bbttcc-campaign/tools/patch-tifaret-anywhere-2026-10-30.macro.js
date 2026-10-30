/**
 * patch-tifaret-anywhere-2026-10-30.macro.js — Dave, 10-30: "I clicked Walk The Ring first on Early Forest of Tifaret, and
 * it continued the journey and sent me to AG! I wanted to fight the demon." The Forest of Early Tifaret is a ROAD encounter
 * (the approach is `where: "anywhere"`), but the Ring / Tree Person / Road Open and the beats under them had no `where`,
 * so placeOf put them at PolygonForest.d and the location guard refused them mid-ride ("The Ring is at PolygonForest.d —
 * the party is at Allesh-Gilliam") → the chain ended and the ride went on. Fix = the engine's own rule (_chainCtxFrom):
 * road encounters declare where:"anywhere" on every beat of the encounter.
 *   every beat of the tifaret quest (story.quest === "tifaret" or id tifaret_* / ans_tifaret_* / forest_of_tifaret_*) → where "anywhere"
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
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; const conflicts = []; let changes = 0;
  const isTif = (b) => String(b?.story?.quest || "") === "tifaret" || /^(ans_)?tifaret_|^forest_of_tifaret_/.test(String(b?.id || ""));
  for (const b of beats) {
    if (!b || !isTif(b)) continue;
    if (String(b.where || "") !== "anywhere") { report.push(`✎ ${b.id} (${b.label}): where "${b.where ?? ""}" → "anywhere"`); b.where = "anywhere"; changes++; }
  }
  if (!report.length && !beats.some(isTif)) conflicts.push("no Tifaret beats found");
  console.log(`[tifaret anywhere 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__tifAnywhere = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-tifaret-anywhere-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the whole Forest of Early Tifaret plays wherever the road meets it.`);
})();
