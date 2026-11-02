/**
 * patch-arms-down-repeatable-2026-11-02.macro.js — click-through (2026-11-02): the second "Arms Down in the Reeds" ambush offered
 * "Take the surrender" greyed done (its outcome beat is once-only and had played on the first surrender), leaving only "No quarter".
 * The surrender happens on EVERY ambush once the reeds have counted three (the bandit ledger's rung ≥ 3), so the beat and both of
 * its outcomes are repeatable.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign"; const IDS = ["bandit_ambush_arms_down", "bandit_arms_down_accept", "bandit_arms_down_violence"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; let changes = 0;
  for (const id of IDS) { const b = (camp.beats || []).find(x => x?.id === id); if (!b) { report.push(`⚠ ${id} not found`); continue; } b.inject = b.inject || {}; if (b.inject.repeatable === true) { report.push(`· ok ${id}`); continue; } b.inject.repeatable = true; changes++; report.push(`✚ ${id}: repeatable (every ambush past rung 3)`); }
  console.log(`[arms down repeatable 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__armsDown = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-arms-down-repeatable-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s).`);
})();
