/* patch-final-polish.macro.js — Act 1 final polish pass
 * (2026-09-04, owner: "ready for a final polish pass").
 *
 * 1) DAY'S END BUTTON ORDER: the loop-bounce ("Back to the crossroads —
 *    daylight left") sat ABOVE the one-shot "The turn is locked. Run it." —
 *    the owner mis-clicked it and looped the town. The lock leads now; the
 *    bounce follows.
 *
 * 2) QUESTSTEP TIDY (cosmetic, chain hygiene): yarrow_welcome shared step
 *    430 with ag_first_night_soma_break. Re-step the welcome/answer pairs
 *    into the venue band (424-427), before the night at 430. All four are
 *    choice-targets/routing nodes so play order is unaffected — this is for
 *    clean reading in the Beats tab and quest views.
 *
 * (Also in this pass, deployed as CODE, not here: invite "Find them at" text
 * humanizes machine scene names for display; tier ladder T0 renamed
 * "Emergent" → "Emerging" to match the Overview's VP band wording.)
 *
 * Idempotent; DRY_RUN default true; backs up campaigns. Run as GM.
 * Marker: [FINAL-POLISH-2026-09-04]
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  // ── 1. Day's End: the lock leads ──────────────────────────────────────────
  {
    const b = byId.get("ag_days_end");
    if (!b) { report.push("⚠ ag_days_end: NOT FOUND — skipped"); }
    else {
      const chs = Array.isArray(b.choices) ? b.choices : [];
      const lockIdx = chs.findIndex(c => /turn is locked/i.test(String(c?.label || "")));
      if (lockIdx < 0) { report.push("⚠ ag_days_end: no 'turn is locked' choice found"); }
      else if (lockIdx === 0) { report.push("· ok ag_days_end: the lock already leads"); }
      else {
        const [lock] = chs.splice(lockIdx, 1);
        chs.unshift(lock);
        b.choices = chs;
        changes++;
        report.push(`✚ ag_days_end: "${lock.label}" moved to the top (bounce follows)`);
      }
    }
  }

  // ── 2. questStep tidy: welcomes + answers into the venue band ─────────────
  const RESTEP = {
    allesh_gilliam_yarrow_welcome: 424,   // was 430 — collided with First Night
    ag_yarrow_answer_boards: 425,
    allesh_gilliam_tamsin_welcome: 426,   // was 434 — after the night, untidy
    ag_tamsin_answer_building: 427
  };
  for (const [id, step] of Object.entries(RESTEP)) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND — skipped`); continue; }
    const cur = Number(b.questStep);
    if (cur === step) { report.push(`· ok ${id}: already step ${step}`); continue; }
    report.push(`✚ ${id}: questStep ${cur} → ${step}`);
    b.questStep = step;
    changes++;
  }

  console.log(`[patch-final-polish] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Final polish DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Final polish: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-final-polish-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Final polish APPLIED: ${changes} change(s). The lock leads; the steps read clean.`);
})();
