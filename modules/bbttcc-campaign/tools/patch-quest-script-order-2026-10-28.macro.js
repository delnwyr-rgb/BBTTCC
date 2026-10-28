/**
 * patch-quest-script-order-2026-10-28.macro.js
 * Script-order pass (Dave 2026-10-28, from the Quest Log writer sheet): side steps the table can pass by are marked
 * `optional` (story-model skips them once a later step is done, so they stop pinning the Log's Next); done-lists are
 * narrowed so a So far line never claims a scene that did not play; two-scenes-either-order become any-order `group`s.
 *   · The Hidden Vault — The Manager's Office: optional, done = its own two outcomes (was: also the Council)
 *   · The Maneuver Vault — The Sealed Records: optional, done = the pulled files (was: also Slippage / Loop)
 *   · The Forgotten Cause — Seated / The Guest List / The Night Itself: optional, done = their own scenes
 *   · The Hex Flooded Towns — The Last Clerk + Stabilize or Ride (any order), The Vote + The Dispatcher (any order)
 *   · The Lost Stone Statues — The Sexton + Stand or Take (any order); Sexton and The Truth optional
 * Data: quest-script-order-2026-10-28.json. A field is written only when its live value still equals the recorded
 * old one (JSON compare). Idempotent; MODE "restore" puts every old value back. Backup of `campaigns` goes to
 * Data/bbttcc-exports/ before any write. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MODE = "apply";                 // "apply" | "restore"
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const data = await fetch("modules/bbttcc-campaign/tools/quest-script-order-2026-10-28.json", { cache: "no-store" }).then(r => r.json());
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // a TRUE copy (deepClone made a write silently no-op, 2026-10-22)
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const report = { changed: [], already: 0, conflicts: [] };
  const [FROM, TO] = MODE === "restore" ? ["new", "old"] : ["old", "new"];
  const J = (v) => JSON.stringify(v ?? null);
  for (const [key, steps] of Object.entries(data.scripts || {})) {
    const sc = camp.story?.scripts?.[key];
    if (!sc) { report.conflicts.push(`${key}: no such script`); continue; }
    for (const [sid, fields] of Object.entries(steps)) {
      const st = (Array.isArray(sc.steps) ? sc.steps : []).find(x => x && x.id === sid);
      if (!st) { report.conflicts.push(`${key}·${sid}: step not found`); continue; }
      for (const [f, row] of Object.entries(fields)) {
        if (J(st[f]) === J(row[TO])) { report.already++; continue; }
        if (J(st[f]) !== J(row[FROM])) { report.conflicts.push(`${key}·${sid}.${f}: live value differs from the expected — skipped`); continue; }
        if (row[TO] == null) delete st[f]; else st[f] = row[TO];
        report.changed.push(`${key}·${sid}.${f}`);
      }
    }
  }
  console.log(`[quest script order · ${MODE}] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${report.changed.length} change(s), ${report.already} already, ${report.conflicts.length} conflict(s)`, report);
  window.__questScriptOrderReport = { dry: DRY_RUN, mode: MODE, changed: report.changed.length, already: report.already, conflicts: report.conflicts };
  if (DRY_RUN) return ui.notifications.info(`Script order (dry run): ${report.changed.length} change(s), ${report.conflicts.length} conflict(s) — see console.`);
  if (!report.changed.length) return ui.notifications.info("Script order: nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-script-order-${MODE}-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  try { await game.bbttcc?.api?.campaign?.story?.data?.reapply?.(); } catch (_e) {}
  ui.notifications.info(`Script order ${MODE === "restore" ? "restored" : "applied"}: ${report.changed.length} change(s).`);
})();
