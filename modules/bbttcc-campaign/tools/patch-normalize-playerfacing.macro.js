/* patch-normalize-playerfacing.macro.js — ONE AUTHORITY for beat visibility
 * (Phase 3 of the engine roadmap, 2026-08-29).
 *
 * Beat player-visibility has FIVE aliases in live use (playerFacing,
 * playerFacingDialog, dialogPlayerFacing, playerFacingContent, showToPlayers)
 * — OR-ed at read, written inconsistently by different eras of authoring.
 * Checking only one alias under-reports ~80% (the 2026-08-19 audit). The
 * editor normalizes on save, but only for beats it touches.
 *
 * This sweep OR-s the five aliases per beat and writes the result back to ALL
 * FIVE — after it, any single alias is authoritative, and future code can
 * eventually read just `playerFacing`.
 *
 * DRY_RUN default true; idempotent; backup before write. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const ALIASES = ["playerFacing", "playerFacingDialog", "dialogPlayerFacing", "playerFacingContent", "showToPlayers"];

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const report = []; let changes = 0; let visibleCount = 0;

  for (const b of (camp.beats || [])) {
    if (!b) continue;
    const truth = ALIASES.some(k => b[k] === true);
    if (truth) visibleCount++;
    const inconsistent = ALIASES.some(k => (b[k] === true) !== truth);
    if (!inconsistent) continue;
    for (const k of ALIASES) b[k] = truth;
    changes++;
    report.push(`✎ ${b.id}: aliases normalized → ${truth ? "PLAYER-FACING" : "GM-only"}`);
  }

  console.log(`[normalize-playerfacing] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} beat(s) normalized ` +
    `(${visibleCount} player-facing of ${(camp.beats || []).length} total)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`playerFacing normalize DRY RUN: ${changes} beat(s) (see console).`);
  if (!changes) return ui.notifications.info("playerFacing normalize: already consistent.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-pf-normalize-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`playerFacing normalized: ${changes} beat(s). One fact, five witnesses, finally agreeing.`);
})();
