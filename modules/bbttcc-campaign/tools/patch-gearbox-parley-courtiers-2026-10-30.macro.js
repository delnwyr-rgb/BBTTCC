/**
 * patch-gearbox-parley-courtiers-2026-10-30.macro.js — Dave, 10-30: the Gearbox lease Parley (a TRAINING Parley) ran as a
 * plain contested roll (A 2d10+8 vs D 2d10+33, DC 48 — unwinnable) because the court scene (arc_bay_interior_pov) had no
 * tokens → no courtiers → no courtly board, and the fallback counts all ten Fixit Farm NPCs' Soft Power + the hex's flat 11.
 * Both Parley offers now name their courtiers (engine: worldEffects.raid.courtiers places them on the court scene once):
 *   reliable_lease_parley "Persuade …" / "Impress …"  raid.courtiers = ["Young Gearbox", "Mara Quickhands"]
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const COURT = ["Young Gearbox", "Mara Quickhands"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; const conflicts = []; let changes = 0;
  for (const n of COURT) if (!game.actors.getName(n)) conflicts.push(`actor "${n}" not found`);
  const b = beats.find(x => x && x.id === "reliable_lease_parley");
  if (!b) conflicts.push("reliable_lease_parley: beat not found");
  else for (const c of b.choices || []) {
    const R = c?.worldEffects?.raid; if (!R || String(R.type) !== "parley") continue;
    if (JSON.stringify(R.courtiers || null) !== JSON.stringify(COURT)) { R.courtiers = COURT.slice(); changes++; report.push(`✎ reliable_lease_parley "${c.label}": courtiers → ${COURT.join(", ")}`); }
  }
  console.log(`[gearbox parley courtiers 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__parleyCourt = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-parley-courtiers-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Gearbox and Mara hold court at the Arc Bay.`);
})();
