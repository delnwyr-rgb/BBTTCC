/* patch-fights-cost-marks-2026-10-26.macro.js — RULING 5 RETIRED: every Battle, Heist and Parley costs marks, even when the
 *  story offers it (Dave, content-audit rulings 2026-10-26, DC5). The two Act-1 teaching offers still told the table that
 *  nothing is spent / Sweeten the deal is the only time marks move. This splices the new truth into the live campaign beats:
 *
 *   EDIT  ag_wick_room_heist_offer   description: "Nothing changes hands but what you learn." → the round costs Intrigue marks
 *                                    choice after-text: "brings what it owns" → spends what the round costs
 *   EDIT  reliable_lease_parley      description: Sweeten is no longer "the only time marks change hands in a fight" —
 *                                    every exchange costs marks from the pool you lean on; Sweeten is on top
 *                                    + both offers' worldEffects.raid.stake lines say the exchanges cost marks
 *
 *  Idempotent (string guards; rerun → 0 changes); DRY_RUN default true; backs up `campaigns`; copies settings with
 *  JSON.parse(JSON.stringify()) (never deepClone — feedback_settings_patch_true_copy). GM only. World: the active campaign
 *  (run on Bad Eden; the show world carries the same beats if it was seeded from live).
 *  Marker: [FIGHTS-COST-MARKS-2026-10-26]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const swap = (obj, field, from, to, label) => {
    const cur = String(obj?.[field] ?? "");
    if (cur.includes(to)) { report.push(`· ok ${label}: already says it`); return; }
    if (!cur.includes(from)) { report.push(`⚠ ${label}: expected text not found (hand-check)`); return; }
    obj[field] = cur.split(from).join(to); changes++; report.push(`✚ ${label}`);
  };

  // ── 1. the Heist offer at the Vacancy ──
  const heist = byId.get("ag_wick_room_heist_offer");
  if (!heist) report.push("⚠ ag_wick_room_heist_offer: NOT FOUND");
  else {
    swap(heist, "description",
      "Nothing changes hands but what you learn.",
      "Every Heist costs marks: each round draws on your Domain's Intrigue while the house answers in its own, and what you learn is the only thing you take.",
      "ag_wick_room_heist_offer: description — the round costs marks");
    const c = (heist.choices || []).find(x => /Slip in while he keeps vigil/i.test(String(x.label || "")));
    if (c) swap(c, "description",
      "Your Domain brings what it owns; the GM counts the creaks.",
      "Your Domain brings what it owns and spends what the round costs; the GM counts the creaks.",
      "ag_wick_room_heist_offer: choice after-text");
    else report.push("⚠ ag_wick_room_heist_offer: 'Slip in' choice not found");
  }

  // ── 2. the Parley across the tarp ──
  const parley = byId.get("reliable_lease_parley");
  if (!parley) report.push("⚠ reliable_lease_parley: NOT FOUND");
  else {
    swap(parley, "description",
      "If marks will help, put them on the table where he can see them: that is <b>Sweeten the deal</b>, the only time marks change hands in a fight, and the Farm keeps them whatever happens.",
      "Every exchange costs marks from the pool you lean on — Diplomacy to persuade, Soft Power to impress; every Parley costs marks, story-offered or not. If more will help, put them on the table where he can see them: that is <b>Sweeten the deal</b>, on top of the price, and the Farm keeps those whatever happens.",
      "reliable_lease_parley: description — exchanges cost marks, Sweeten on top");
    const STAKE_FROM = "Marks on the table are Sweeten the deal — the Farm keeps them whatever happens.";
    const STAKE_TO   = "Every exchange costs marks; marks put on the table besides are Sweeten the deal — the Farm keeps those whatever happens.";
    for (const ch of (parley.choices || [])) {
      const raid = ch?.worldEffects?.raid;
      if (raid && typeof raid.stake === "string") swap(raid, "stake", STAKE_FROM, STAKE_TO, `reliable_lease_parley: stake on "${ch.label}"`);
    }
  }

  console.log(`[patch-fights-cost-marks] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Fights cost marks DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Fights cost marks: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-fights-cost-marks-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Fights cost marks APPLIED: ${changes} change(s). The Vacancy Heist and the tarp Parley now say what they cost.`);
})();
