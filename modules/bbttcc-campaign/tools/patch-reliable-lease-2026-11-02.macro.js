/**
 * patch-reliable-lease-2026-11-02.macro.js — Dave (2026-11-02): "The parley for the AR was supposed to be the 'teaching the parley
 * system' beat. And I assumed that anyone who didn't get the AR officially would eventually buy a submersible or boat."
 * Live-caught: the Persuade win ("renew at the old rate", reliable_parley_renewed) granted a 3-turn charter with source "beat", so when
 * it ran out the Absolutely Reliable went home without a word — the starter lease's last-turn / Gone Home beats only listened for
 * source "starter". The renewal's charter is now source "lease" (the WME passes it through; the charter clock tells the story for
 * "starter" and "lease"): a table that never had the starter lease wins a lease here, and hears when it is about to end and when it
 * has. Impress ("the keys", reliable_parley_keys) still wins her outright. Idempotent (rerun = 0). DRY_RUN first. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const report = []; let changes = 0;
  const b = (camp.beats || []).find(x => x?.id === "reliable_parley_renewed");
  if (!b?.worldEffects?.charter) report.push("⚠ reliable_parley_renewed has no charter");
  else if (b.worldEffects.charter.source === "lease") report.push("· ok renewal is a lease");
  else { b.worldEffects.charter.source = "lease"; changes++; report.push("✚ reliable_parley_renewed: its charter is a lease (last turn + Gone Home)"); }
  console.log(`[reliable lease 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__reliableLease = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-reliable-lease-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s).`);
})();
