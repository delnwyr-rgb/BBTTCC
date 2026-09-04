/* patch-title-card-turn-gate.macro.js — the Title Card waits for the turn
 * (2026-09-04, live-caught: quest order offered "THATWARDS HO! — Title Card"
 * mid-Turn-1, and firing it raised the story to Act 2 and opened every
 * quest line early).
 *
 * ag_title_card is the END-OF-TURN-1 closer — the Turn Driver runs it
 * automatically after the first world turn ticks (runBeat ignores requires,
 * so the auto-fire is unaffected). Gate it { flag:"turn", gte:2 } so no
 * offer surface (hero quest-order, director, browse) can front-run it.
 *
 * Idempotent; DRY_RUN default true; backs up campaigns. Run as GM.
 * Marker: [TITLE-CARD-GATE-2026-09-04]
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
  const b = (camp.beats || []).find(x => x.id === "ag_title_card");
  if (!b) return ui.notifications.error("ag_title_card not found — wrong campaign?");

  b.inject = b.inject || {};
  let reqs = b.inject.requires;
  reqs = Array.isArray(reqs) ? reqs : (reqs ? [reqs] : []);
  b.inject.requires = reqs;
  const tr = reqs.find(r => r && String(r.flag) === "turn");
  if (tr && Number(tr.gte) >= 2) {
    console.log("[patch-title-card-turn-gate] already gated:", JSON.stringify(reqs));
    return ui.notifications.info("Title Card already turn-gated — nothing to do.");
  }
  if (tr) tr.gte = 2; else reqs.push({ flag: "turn", gte: 2 });
  console.log(`[patch-title-card-turn-gate] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ag_title_card requires now:`, JSON.stringify(reqs));
  if (DRY_RUN) return ui.notifications.info("Title Card gate DRY RUN: would add { turn >= 2 } (see console).");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-title-card-gate-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info("Title Card gate APPLIED: the roll credits wait for the turn to actually end.");
})();
