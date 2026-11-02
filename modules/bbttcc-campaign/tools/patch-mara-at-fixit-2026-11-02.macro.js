/**
 * patch-mara-at-fixit-2026-11-02.macro.js — Dave (2026-11-02): "We learn about the Maneuver Vault from Mara in FFF" … then: "Mara can't
 * come to the table out in the middle of nowhere, LOL. SO, she video phones or radios up the table and asks them to go to the hex …
 * Getting quests from a quest giver doesn't mean they have to be in person." Mara's beats (the summons, the acceptance, the missing
 * runner) carried no place, so they inherited the Vault quest's hex (Hexen Myre.c) and the quest log sent the table to the Vault to
 * hear about the Vault. They are a RADIO CALL from the Fixit band: where = "anywhere", and the summons opens on the radio instead of
 * "Mara finds you herself". "Go to the Vault." is already the ride onward (patch-trail-rides). Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign"; const IDS = ["fc_mara_pip_summons", "maneuver_vault_acceptance", "maneuver_vault_missing_runner"], HEX = "anywhere";
  const OLD_OPEN = "Mara finds you herself, which is how you know it's bad.", NEW_OPEN = "The radio crackles on the Fixit band, and it's Mara herself, which is how you know it's bad.";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; let changes = 0;
  for (const id of IDS) { const b = (camp.beats || []).find(x => x?.id === id); if (!b) { report.push(`⚠ ${id} not found`); continue; } if (b.where === HEX) { report.push(`· ok ${id}`); continue; } b.where = HEX; changes++; report.push(`✚ ${id}: where ${HEX} (a radio call)`); }
  { const b = (camp.beats || []).find(x => x?.id === "fc_mara_pip_summons"); if (b && String(b.description || "").includes(OLD_OPEN)) { b.description = b.description.replace(OLD_OPEN, NEW_OPEN); changes++; report.push("✚ fc_mara_pip_summons: opens on the radio"); } }
  console.log(`[mara at fixit 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__maraFixit = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-mara-at-fixit-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Mara calls it in on the radio.`);
})();
