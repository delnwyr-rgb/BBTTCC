/**
 * patch-peaceful-bounties-2026-11-02.macro.js — Dave (2026-11-02): "You should technically be collecting bounties from all those
 * monsters you've scared away." Road-encounter bounties ride `beat.award = { method, creature }` (bestiary METHODS: kill / talkdown /
 * parley / capture / cleanse / rite); only the _win (kill) and _run (talkdown) outcomes carried one, so the peaceful check outcomes —
 * "Apex — The Oldest Treaty", "Wildlife — Read and Released" — paid nothing. Every enc_* family's `_parley_success` outcome without an
 * award gets the family's creature with method "talkdown" (Non-Lethal pool). People (the bandit ambush) are not bounties.
 * After applying, run `game.bbttcc.api.campaign.awards.settle()` (or this macro does it) to pay what was already played.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign"; const PEOPLE = /bandit|raider|cult|valhaul/i;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.(); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = camp.beats || []; const report = []; let changes = 0;
  for (const b of beats) {
    if (!/^enc_.+_parley_success$/.test(String(b?.id || "")) || b.award) continue;
    const root = String(b.id).replace(/_parley_success$/, "");
    const aw = beats.filter(x => String(x?.id || "").startsWith(root + "_") || x?.id === root).map(x => x.award).find(a => a?.creature);
    if (!aw || PEOPLE.test(aw.creature)) continue;
    b.award = { method: "talkdown", creature: aw.creature, creatureId: aw.creatureId ?? null }; changes++;
    report.push(`✚ ${b.id} «${b.label}»: bounty — ${aw.creature} talked down`);
  }
  if (!changes) report.push("· nothing to change");
  console.log(`[peaceful bounties 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__peacefulBounties = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (changes) {
    try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-peaceful-bounties-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  let settled = null; try { settled = await game.bbttcc.api.campaign.awards?.settle?.(cid); } catch (e) { console.warn("[peaceful bounties] settle failed", e); }
  globalThis.__peacefulBounties.settled = settled;
  ui.notifications.info(`Applied ${changes} change(s); back-paid ${settled?.creatures ?? 0} bounty(ies).`);
})();
