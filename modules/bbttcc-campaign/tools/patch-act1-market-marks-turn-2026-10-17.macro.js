/* patch-act1-market-marks-turn-2026-10-17.macro.js — TEACHING BEATS 5 · 6 · 7 (Alpha Cut, Dave 2026-10-17:
 *  "Yes to all six teaching beats" + "integrate strategic activities into the plot as well").
 *
 *  Finding (why/when survey): no Act 0–1 beat opens the Market (Etta says "don't buy yet"; the Trade Convoy's
 *  "Buy something" opens nothing), no beat pays or charges a mark before Act 2, and Day's End says "run it"
 *  without saying what to plan or why.
 *
 *  5 · MARKET
 *   WIRED allesh_gilliam_etta_welcome   + "Buy something anyway." → ag_etta_wrong_prices (Etta's text untouched)
 *   NEW   ag_etta_wrong_prices           Etta relents; the card says what the Market IS; worldEffects.openMarket → The Long Market
 *   WIRED enc_trade_convoy               "Buy something" → enc_trade_convoy_stall (was a dead end)
 *   NEW   enc_trade_convoy_stall         the Nomads' stall; openMarket → Trade Caravan with activate + closeOnTurnEnd (the
 *                                        Caravan is a travelling vendor: the beat switches it on, turn end switches it off;
 *                                        no GM tick needed)
 *   needs: worldEffects.openMarket in world-mutation-engine.js (same day) — every seat must reload once after deploy.
 *
 *  6 · MARKS
 *   NEW   ag_first_pay                   between the Act-2 Title Card and the HQ intro: Pike's ledger pays the coalition
 *                                        for the first ride (+20 economy marks EACH faction — Mags' default, Dave to bless),
 *                                        and the card says what marks are for
 *   WIRED ag_title_card                  "The trouble starts" → ag_first_pay (→ allesh_gilliam_introduction_to_hq)
 *
 *  7 · THE TURN
 *   NEW   ag_first_turn_why              the first turn's reason: the road to Khezek-Tor showed its teeth — Secure Perimeter
 *                                        (15 logistics · 8 violence) or Establish Supply Line (23 logistics · 8 economy)
 *   WIRED ag_days_end                    "The turn is locked. Run it." → ag_first_turn_why (was a dead end)
 *
 *  Idempotent (id / label / choice guards); DRY_RUN default true; backs up `campaigns`. GM only.
 *  Marker: [ACT1-MARKET-MARKS-TURN-2026-10-17]
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

  const ETTA = "allesh_gilliam_etta_welcome", ETTA_BUY = "ag_etta_wrong_prices", CONVOY = "enc_trade_convoy", STALL = "enc_trade_convoy_stall";
  const TITLE = "ag_title_card", PAY = "ag_first_pay", HQ = "allesh_gilliam_introduction_to_hq", DAYS_END = "ag_days_end", TURN_WHY = "ag_first_turn_why";
  const LONG_MARKET = "vendor-sybh3z-mop85ufr", TRADE_CARAVAN = "vendor-rruc62-mvbqx86a";
  const PAY_MARKS = 20;   // economy marks, EACH coalition faction (@coalition) — Mags' default, Dave to bless

  const etta = byId.get(ETTA), convoy = byId.get(CONVOY), title = byId.get(TITLE), daysEnd = byId.get(DAYS_END);
  for (const [id, b] of [[ETTA, etta], [CONVOY, convoy], [TITLE, title], [DAYS_END, daysEnd]]) if (!b) return ui.notifications.error(`${id} not found — wrong world?`);
  if (!byId.get(HQ)) report.push(`⚠ ${HQ}: NOT FOUND — the pay card will dead-end`);

  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const lbl = (c) => String(c?.label || "").trim().toLowerCase();
  const upsert = (id, build, label) => {
    const have = byId.get(id); const want = build();
    if (!have) { camp.beats.push(want); byId.set(id, want); changes++; report.push(`✚ beat ${id} — ${label}`); return; }
    let touched = 0;
    for (const k of ["description", "memoryText", "choices", "inject", "worldEffects", "label", "questStep", "type"]) if (JSON.stringify(have[k]) !== JSON.stringify(want[k])) { have[k] = want[k]; touched++; }
    if (touched) { changes++; report.push(`✚ beat ${id}: ${touched} field(s) refreshed`); } else report.push(`· ok beat ${id}`);
  };
  const cloneOf = (tmpl, id, fields, inject) => {
    const nb = foundry.utils.deepClone(tmpl);
    Object.assign(nb, { id, timePoints: 0, worldEffects: WE(), memoryText: null, encounter: undefined, scene: { uuid: "" } }, fields);
    delete nb.pinLeg; delete nb.award;
    nb.inject = { ...(nb.inject || {}), ...inject };
    return nb;
  };
  const wireRow = (beat, label, next, description, where, requires) => {
    beat.choices = Array.isArray(beat.choices) ? beat.choices : [];
    const row = ch(label, description, { next, ...(requires ? { requires } : {}) });
    const have = beat.choices.find(c => lbl(c) === lbl(row));
    if (!have) {
      const ix = typeof where === "function" ? beat.choices.findIndex(where) : -1;
      beat.choices.splice(ix >= 0 ? ix : beat.choices.length, 0, row);
      changes++; report.push(`✚ ${beat.id}: + '${label}' → ${next}`);
    } else if (have.next !== next || (description && have.description !== description)) { have.next = next; if (description) have.description = description; changes++; report.push(`✚ ${beat.id}: '${label}' → ${next}`); }
    else report.push(`· ok ${beat.id}: '${label}'`);
  };

  /* ── 5. the market ───────────────────────────────────────────────────────── */
  const MARKET_WHY =
    "<b>This is the Market.</b> Standard Issue is the kit any steward can carry for nothing. Everything else costs marks from your faction's treasury, and what a seller charges depends on who you are to them. Buy what the road needs — the road will ask.";
  upsert(ETTA_BUY, () => cloneOf(etta, ETTA_BUY, {
    label: "Allesh-Gilliam — The Prices Are Wrong (In Your Favour)", type: "dialog", questStep: (Number(etta.questStep) || 0) + 1,
    description:
      "\"You weren't listening,\" Etta says, with the patience of a woman who has watched a great many people not listen. \"Fine. The prices are wrong today. Wrong in your favour — because I like the look of you, and the stalls don't know that yet.\"\n\n" +
      "She lifts one hand without looking, and down the row three awnings adjust themselves.\n\n" + MARKET_WHY,
    memoryText: "Bought at the Long Market on day one. Etta set the prices wrong in your favour.",
    worldEffects: WE({ openMarket: { vendorId: LONG_MARKET, note: "🛒 The Long Market — Etta's stalls. Standard Issue costs nothing; the rest costs marks." } }),
    choices: [ch("Thank her and move on", "", { next: "allesh_gilliam_town_walk" })]
  }, { repeatable: true }), "Etta relents; the Market opens");
  wireRow(etta, "Buy something anyway.", ETTA_BUY, "The prices are wrong. You have marks. These facts can coexist.", c => /thank her/i.test(String(c.label || "")));

  upsert(STALL, () => cloneOf(convoy, STALL, {
    label: "Trade Convoy — The Stall", type: "dialog", questStep: (Number(convoy.questStep) || 0) + 1,
    description:
      "The Nomads' stall-keeper looks you over like weather. \"Buy or move,\" she says, which is the whole of Stormborn hospitality and, honestly, more than most.\n\n" + MARKET_WHY,
    memoryText: "Traded with the Stormborn convoy on the road.",
    // Dave 2026-10-17: "the market activates when the players are in the scene with it" — the beat flips the
    // Caravan active and the turn-end sweep flips it back off (world-mutation-engine marketStaging).
    worldEffects: WE({ openMarket: { vendorId: TRADE_CARAVAN, note: "🛒 The Trade Caravan — buy or move.", activate: true, closeOnTurnEnd: true } }),
    choices: [ch("Back on the road", "", { next: "" })]
  }, { repeatable: true }), "the Nomads' stall; the Market opens");
  wireRow(convoy, "Buy something", STALL, "Otherwise get outta line!");
  try {
    const vendors = game.settings.get("bbttcc-market", "vendors") || [];
    const tc = (Array.isArray(vendors) ? vendors : Object.values(vendors)).find(v => v && v.id === TRADE_CARAVAN);
    if (tc) report.push(`· market: the Trade Caravan vendor is ${tc.active === false ? "inactive" : "active"} today — the stall beat activates it for the scene and the turn-end sweep closes it again`);
  } catch (_e) {}

  /* ── 6. marks: the first job pays ────────────────────────────────────────── */
  upsert(PAY, () => cloneOf(title, PAY, {
    label: "Allesh-Gilliam — Pike's Ledger Pays Out", type: "dialog", questStep: (Number(title.questStep) || 0) + 1,
    description:
      "Pike's ledger has a line for you before it has a name for you. <i>Met three towns. Rode the roads. Didn't die.</i> A sum beside it, in marks, paid into the coalition treasury — " + PAY_MARKS + " to each banner, because that is what the first ride is worth to a town that wants a second one.\n\n" +
      "<b>Marks are what a faction spends.</b> They buy at the market, pay for the turn's activities, keep the lease on the Reliable, and cover the upkeep on anything you hold. Jobs pay them. Roads you hold earn them. Spend them where the story asks — the ledger will keep asking.",
    memoryText: "Pike's ledger paid the coalition " + PAY_MARKS + " marks a banner for the first ride.",
    worldEffects: WE({
      factionEffects: [{ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: { economy: PAY_MARKS }, allowOvercap: false }],
      warLog: "Pike's ledger paid the coalition " + PAY_MARKS + " economy marks a banner for the first ride."
    }),
    choices: [ch("On to HQ — the trouble starts", "", { next: HQ })]
  }, { repeatable: false, requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: PAY, not: true }] }), "the first job pays, and says what marks are for");
  {
    title.choices = Array.isArray(title.choices) ? title.choices : [];
    const row = title.choices.find(c => /trouble starts/i.test(String(c.label || "")));
    if (!row) report.push("⚠ title card: 'The trouble starts' row not found — pay card unreachable");
    else if (row.next !== PAY) { row.next = PAY; changes++; report.push(`✚ title card: 'The trouble starts' → ${PAY} (→ ${HQ})`); }
    else report.push("· ok title card: routes through the pay card");
  }

  /* ── 7. the first turn has a reason ──────────────────────────────────────── */
  upsert(TURN_WHY, () => cloneOf(daysEnd, TURN_WHY, {
    label: "Allesh-Gilliam — The First Turn", type: "dialog", questStep: (Number(daysEnd.questStep) || 0) + 1,
    description:
      "Before the world moves, the ledger wants to know your plans.\n\n" +
      "<b>This turn has a reason.</b> The road to Khezek-Tor showed its teeth today, and the smelter trade runs along it. Two activities answer that. <b>Secure Perimeter</b> (15 logistics, 8 violence) keeps the bandits off your door. <b>Establish Supply Line</b> (23 logistics, 8 economy) turns the road into income. Pick the one you can afford; the other waits for next turn.\n\n" +
      "Every faction sets its work on the Plan console. When every plan is locked, the GM runs the Turn Driver and the world takes its turn.",
    memoryText: "The first turn: secure the road or make it pay.",
    choices: [ch("Lock it in. Run the turn.", "Plans set on the Plan console; the GM runs the Turn Driver.", { next: "" })]
  }, { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }, { flag: "storyPhase", lte: 1 }] }), "why this turn, and which two activities answer it");
  {
    daysEnd.choices = Array.isArray(daysEnd.choices) ? daysEnd.choices : [];
    const row = daysEnd.choices.find(c => /turn is locked/i.test(String(c.label || "")));
    if (!row) report.push("⚠ day's end: 'The turn is locked. Run it.' row not found");
    else if (row.next !== TURN_WHY) { row.next = TURN_WHY; changes++; report.push(`✚ day's end: 'The turn is locked. Run it.' → ${TURN_WHY}`); }
    else report.push("· ok day's end: routes through the first-turn card");
  }

  console.log(`[patch-act1-market-marks-turn] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Market/marks/turn DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Market/marks/turn: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-market-marks-turn-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Market/marks/turn APPLIED: ${changes} change(s). Etta sells, Pike pays, the first turn has a reason.`);
})();
