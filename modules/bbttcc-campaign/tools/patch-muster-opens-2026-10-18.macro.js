/* patch-muster-opens-2026-10-18.macro.js — THE MUSTER OPENS AFTER THE BANDIT ROAD (ruling 15, Dave 2026-10-17:
 *  "We can have recruitment stations after we unlock the bandit ambush beat, so the Muster becomes a place in AG to
 *  recruit crews.")
 *
 *  `enc_bandit_ambush_win_free` (the win where the freed bandits found the Allesh-Gilliam militia) gains
 *  `worldEffects.openMarket { vendorName: "The Muster", activate: true }` — the vendor switches ON for good (no
 *  closeOnTurnEnd: a recruiting station, not a passing caravan) and the Market opens on every seat on the Hire tab's
 *  stall. One sentence is appended to the card so the players know why a market just opened.
 *
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only. Marker: [MUSTER-OPENS-2026-10-18]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const ID = "enc_bandit_ambush_win_free";
  const b = byId.get(ID);
  if (!b) return ui.notifications.error(`${ID} not found.`);
  const WANT = { vendorName: "The Muster", note: "🪖 The Muster has a banner up — crews and associations for hire, by the turn.", activate: true };
  const TAIL = "\n\nWord travels faster than you do. By the time the road is yours, the Muster in Allesh-Gilliam has a banner up: crews and associations for hire, by the turn.";

  b.worldEffects = b.worldEffects && typeof b.worldEffects === "object" ? b.worldEffects : {};
  const have = b.worldEffects.openMarket;
  if (JSON.stringify(have) !== JSON.stringify(WANT)) { b.worldEffects.openMarket = WANT; changes++; report.push(`✚ ${ID}: worldEffects.openMarket → The Muster (activate, standing)`); }
  else report.push(`· ok ${ID}: openMarket`);
  const desc = String(b.description || "");
  if (!desc.includes("the Muster in Allesh-Gilliam has a banner up")) { b.description = desc.replace(/\s+$/, "") + TAIL; changes++; report.push(`✚ ${ID}: description tail (why a market just opened)`); }
  else report.push(`· ok ${ID}: description`);

  console.log(`[patch-muster-opens] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Muster opens DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Muster opens: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-muster-opens-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Muster opens APPLIED: ${changes} change(s). The bandit road now opens the Muster.`);
})();
