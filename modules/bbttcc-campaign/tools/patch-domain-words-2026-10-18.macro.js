/* patch-domain-words-2026-10-18.macro.js — RULING 16 WORD PASS, story side (Alpha Cut, Dave 2026-10-17/18:
 *  the steward and the faction are ONE being; "faction" is retired as a player-facing term → "Domain";
 *  several Domains together = the coalition).
 *
 *  What it touches: player-visible beat text (description / memoryText / choice descriptions) on the Act 0–1 spine,
 *  the teaching beats and the travel-table beats players meet in Act 1, plus a handful of Act-2 spine lines.
 *  What it leaves alone: ⚙ GM notes (the faction ACTOR still exists under the hood), NPC groups described as
 *  factions (Tanneritos, "every faction that hears about it" — Dave's call), jokes ("Cocky Ass Factions"),
 *  beat ids, labels and tags.
 *
 *  Idempotent: each swap is skipped when the old text is gone. DRY_RUN default true; backs up `campaigns`. GM only.
 *  Marker: [DOMAIN-WORDS-2026-10-18]
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

  // [beatId, field, old, new] — field = "description" | "memoryText" | "choice:<index>.description"
  const SWAPS = [
    // Act 0–1 spine + teaching beats
    ["ag_days_end", "choice:3.description", "Each faction sets its work for the turn; the Plan console is open.", "Each Domain sets its work for the turn; the Plan console is open."],
    ["ag_days_end", "choice:3.description", "When every faction's plans are set", "When every Domain's plans are set"],
    ["ag_first_turn_why", "description", "Every faction sets its work on the Plan console.", "Every Domain sets its work on the Plan console."],
    ["ag_first_pay", "description", "<b>Marks are what a faction spends.", "<b>Marks are what a Domain spends."],
    ["ag_etta_wrong_prices", "description", "Everything else costs marks from your faction's treasury", "Everything else costs marks from your Domain's treasury"],
    ["enc_trade_convoy_stall", "description", "Everything else costs marks from your faction's treasury", "Everything else costs marks from your Domain's treasury"],
    ["first_road_ambush", "description", "and your faction pays for it.", "and your Domain pays for it."],
    ["days_end_thatwards", "choice:1.description", "which hexes belong to which faction.", "which hexes belong to which Domain."],
    ["days_end_thatwards", "choice:1.description", "each faction sets its work for the turn.", "each Domain sets its work for the turn."],
    // travel-table beats players meet in Act 1
    ["enc_bandit_ambush", "choice:0.description", "(The faction's reputation does the heavy lifting here.", "(The Domain's reputation does the heavy lifting here."],
    ["enc_hexknight", "choice:0.description", "(The faction's purse does the talking.", "(The Domain's purse does the talking."],
    ["enc_desenitarius_maarg", "choice:0.description", "a whole faction's faith, spent in one held breath", "a whole Domain's faith, spent in one held breath"],
    ["enc_desenitarius_maarg_parley_success", "description", "the whole faction's reverence spent in one held breath", "the whole Domain's reverence spent in one held breath"],
    ["enc_desenitarius_maarg_parley_success", "memoryText", "The faction offered Desenitarius Maarg", "The Domain offered Desenitarius Maarg"],
    // the party acting together = the coalition
    ["tikkun_atonement_whole", "memoryText", "The faction confessed the failed Final Ritual", "The coalition confessed the failed Final Ritual"],
    ["tikkun_atonement_amends", "memoryText", "The faction atoned for the failed Final Ritual", "The coalition atoned for the failed Final Ritual"],
    ["tikkun_atonement_refused", "memoryText", "The faction swept the failed Final Ritual", "The coalition swept the failed Final Ritual"],
    // Act-2 lines players read early in Act 2
    ["enc_circuit_riders_simone_2", "description", "Your faction feels capable.", "Your Domain feels capable."],
    ["forest_of_tifaret_session_carry_ok", "description", "Something in your faction's shoulders does the same.", "Something in your people's shoulders does the same."],
    ["lyrenn_rowan_of_the_loam_convo_2", "description", "They feel faction drift in real time.", "They feel a Domain's drift in real time."],
    ["fixit_leyline_stabilizer_negotiation", "choice:2.description", "compliance and cooperation with your faction are not optional", "compliance and cooperation with your Domain are not optional"],
  ];

  const getField = (b, field) => {
    const m = /^choice:(\d+)\.(\w+)$/.exec(field);
    if (m) return [b.choices?.[Number(m[1])], m[2]];
    return [b, field];
  };
  for (const [id, field, oldText, newText] of SWAPS) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND`); continue; }
    const [obj, key] = getField(b, field);
    if (!obj || typeof obj[key] !== "string") { report.push(`⚠ ${id} ${field}: no text`); continue; }
    if (obj[key].includes(oldText)) { obj[key] = obj[key].split(oldText).join(newText); changes++; report.push(`✚ ${id} ${field}: "${oldText.slice(0, 48)}…" → Domain wording`); }
    else if (obj[key].includes(newText)) report.push(`· ok ${id} ${field}`);
    else report.push(`⚠ ${id} ${field}: neither old nor new text present (hand-edited?)`);
  }

  console.log(`[patch-domain-words] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Domain words DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Domain words: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-domain-words-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Domain words APPLIED: ${changes} change(s). The story now says Domain.`);
})();
