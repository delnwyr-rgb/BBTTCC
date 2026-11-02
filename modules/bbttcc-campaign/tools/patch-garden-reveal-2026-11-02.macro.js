/**
 * patch-garden-reveal-2026-11-02.macro.js — HEX VISIBILITY (Dave 2026-11-02): when Father Tamsin tells the table about "a garden the
 * old world advertised as an attraction … Go and count" (ag_tamsin_the_dream_after_hundred, "Ask the coast."), the Founder's Garden
 * comes out of the fog — the quest location is pointed out once someone has told you where it is.
 * worldEffects.revealHexes = ["Founder's Garden"]. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign"; const ID = "ag_tamsin_the_dream_after_hundred", HEX = "Founder's Garden";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const b = (camp.beats || []).find(x => x?.id === ID); const report = []; let changes = 0;
  if (!b) report.push(`⚠ ${ID} not found`);
  else { b.worldEffects = b.worldEffects || {}; const r = Array.isArray(b.worldEffects.revealHexes) ? b.worldEffects.revealHexes : (b.worldEffects.revealHexes = []);
    if (r.includes(HEX)) report.push(`· ok ${ID} reveals ${HEX}`); else { r.push(HEX); changes++; report.push(`✚ ${ID}: reveals ${HEX} when Tamsin tells you`); } }
  console.log(`[garden reveal 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__gardenReveal = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-garden-reveal-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s).`);
})();
