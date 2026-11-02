/**
 * patch-crown-mall-reveal-2026-11-02.macro.js — HEX VISIBILITY (Dave 2026-11-02: "Let's put Crown Mall on the map after Chuckle
 * Creek"). Each of Chuckle Creek's three endings (chuckle_finale, chuckle_new_episode, chuckle_cancelled) carries
 * worldEffects.revealHexes = ["Crown Mall"]. A world whose table already finished Chuckle Creek gets the reveal now.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign"; const IDS = ["chuckle_finale", "chuckle_new_episode", "chuckle_cancelled"], HEX = "Crown Mall";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const capi = game.bbttcc?.api?.campaign;
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[capi?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; let changes = 0;
  for (const id of IDS) { const b = (camp.beats || []).find(x => x?.id === id); if (!b) { report.push(`⚠ ${id} not found`); continue; }
    b.worldEffects = b.worldEffects || {}; const r = Array.isArray(b.worldEffects.revealHexes) ? b.worldEffects.revealHexes : (b.worldEffects.revealHexes = []);
    if (r.includes(HEX)) report.push(`· ok ${id}`); else { r.push(HEX); changes++; report.push(`✚ ${id}: reveals ${HEX}`); } }
  const already = IDS.some(id => { try { return !!capi.story.hasMark(id); } catch (_e) { return false; } });
  console.log(`[crown mall reveal 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)${already ? " · Chuckle Creek already ended here → reveal now" : ""}\n` + report.join("\n"));
  globalThis.__crownMallReveal = { dry: DRY_RUN, changes, report, already };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (changes) {
    try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-crown-mall-reveal-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  if (already) { const n = await capi.revealHexes?.([HEX], { why: "Chuckle Creek already ended" }); globalThis.__crownMallReveal.revealed = n; }
  ui.notifications.info(`Applied ${changes} change(s)${already ? " — Crown Mall is on the map" : ""}.`);
})();
