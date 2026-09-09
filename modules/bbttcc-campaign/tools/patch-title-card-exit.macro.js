/* patch-title-card-exit.macro.js — THATWARDS HO! Title Card exits into Act 2 (2026-09-08)
 *
 * The Title Card's phaseAdvance opens Act 2 AT ENTRY, but its only choice
 * ("The trouble starts") routed to the Act-1 Welcome Round hub — the loop the
 * owner flagged 09-07, and under the act seal a dead end. Re-route it to the
 * Act-2 Allesh-Gilliam arrival hub `allesh_gilliam_introduction_to_hq`
 * ("Visit Your New HQ", storyPhase ≥ 2, repeatable), which is also the hex's
 * on-enter beat. Backs up the campaigns setting to a download first.
 * DRY_RUN default true; idempotent. Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign", FROM = "allesh_gilliam_town_walk", TO = "allesh_gilliam_introduction_to_hq";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const tc = beats.find(b => b?.id === "ag_title_card"); if (!tc) return ui.notifications.error("ag_title_card not found.");
  if (!beats.some(b => b?.id === TO)) return ui.notifications.error(`${TO} not found.`);
  const rows = (tc.choices || []).filter(c => String(c?.next) === FROM || String(c?.failNext) === FROM);
  if (!rows.length) return ui.notifications.info(`Title Card already exits elsewhere: ${JSON.stringify((tc.choices || []).map(c => c.next))}`);
  for (const c of rows) { if (String(c.next) === FROM) c.next = TO; if (String(c.failNext) === FROM) c.failNext = TO; }
  console.log(`[title-card-exit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${rows.length} choice(s) ${FROM} → ${TO}`, rows);
  if (DRY_RUN) return ui.notifications.info(`Title Card exit DRY RUN: ${rows.length} choice(s) would re-route. Set DRY_RUN=false to apply.`);
  (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-title-card-exit-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Title Card now exits to ${TO}. Backup downloaded.`);
})();
