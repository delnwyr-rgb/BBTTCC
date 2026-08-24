/**
 * patch-joans-bootstrap-gate.macro.js — GM macro/console. DRY_RUN default true.
 *
 * The Act-1 bootstrap paradox (2026-08-24): moving the phaseAdvance onto the
 * Avuncular Joans Sendoff (so invites open AFTER the speech) locked the key
 * inside the door — Joans itself carried a `storyPhase ≥ 1` gate, so the beat
 * that raises the act required the act. This strips the storyPhase condition
 * from the arrival pair (Welcome + Joans) so the sequence is runnable at
 * phase 0; everything DOWNSTREAM stays Act-1-gated and unlocks the moment
 * Joans fires the advance — exactly the intended timing.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  const TARGETS = ["allesh_gilliam_opening_scene", "avuncular_joans_speech"];
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const report = []; let changes = 0;

  const isPhaseCond = c => c && typeof c === "object" && String(c.flag || "") === "storyPhase";
  for (const id of TARGETS) {
    const b = (camp.beats || []).find(x => String(x?.id) === id);
    if (!b) { report.push(`✗ missing beat ${id}`); continue; }
    const req = b.inject?.requires;
    if (!req) { report.push(`· ok ${id} (no requires)`); continue; }
    if (Array.isArray(req)) {
      const kept = req.filter(c => !isPhaseCond(c));
      if (kept.length !== req.length) {
        b.inject.requires = kept.length ? kept : null;
        if (!kept.length) delete b.inject.requires;
        changes++; report.push(`· ${id}: storyPhase condition REMOVED (${req.length - kept.length} row(s); ${kept.length} other condition(s) kept)`);
      } else report.push(`· ok ${id} (no storyPhase row)`);
    } else if (isPhaseCond(req)) {
      delete b.inject.requires; changes++;
      report.push(`· ${id}: storyPhase requires REMOVED`);
    } else report.push(`· ok ${id} (requires is not a storyPhase gate)`);
  }

  console.log(`[patch-joans-bootstrap-gate] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Bootstrap-gate DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-joans-gate-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Bootstrap gate APPLIED: ${changes} change(s). Backup downloaded. Joans is now runnable at phase 0.`);
})();
