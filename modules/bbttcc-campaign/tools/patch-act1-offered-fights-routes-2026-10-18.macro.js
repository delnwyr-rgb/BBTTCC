/* patch-act1-offered-fights-routes-2026-10-18.macro.js — THE WON PARLEY IS WIRED (Dave 2026-10-18: "Wire the won Parley to the
 *  lease renewal and the keys"). Follows patch-act1-offered-fights-2026-10-18 (run that first).
 *
 *  A story offer may now say where the fight goes: worldEffects.raid.routes = { win, stalemate, loss } — the raid console runs
 *  ONE of those beats once when the fight concludes (a Battle's call, a Heist's outcome, a Parley's outcome).
 *
 *   EDIT  reliable_lease_parley        Persuade → routes { win: reliable_parley_renewed, stalemate, loss }
 *                                      Impress  → routes { win: reliable_parley_keys,    stalemate, loss }
 *                                      + one-shot after a loss (requires not reliable_parley_lost), closed once the keys are yours
 *   NEW   reliable_parley_renewed      the old number on the back of the tag: charter renewed 3 turns (worldEffects.charter)
 *   NEW   reliable_parley_keys         the Farm is impressed: the keys come across (worldEffects.rigTransfer, same as Signed Over)
 *   NEW   reliable_parley_stalemate    "Ask me again." The offer keeps.
 *   NEW   reliable_parley_lost         the coffee goes cold; she goes home when the lease runs out
 *   EDIT  reliable_lease_last_turn / reliable_lease_lapsed / reliable_price   + requires not reliable_parley_keys (she is yours)
 *   EDIT  ag_wick_room_heist_offer     the Heist choice → routes { loss: ag_wick_room_caught }
 *   NEW   ag_wick_room_caught          Verna's lamp on the stairs — the house is awake
 *
 *  Idempotent (id / shape guards); DRY_RUN default true; backs up `campaigns`. GM only. Marker: [OFFERED-FIGHTS-ROUTES-2026-10-18]
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

  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const need = (id) => { const b = byId.get(id); if (!b) report.push(`⚠ ${id}: NOT FOUND`); return b; };
  const upsert = (id, build) => { if (byId.has(id)) { report.push(`· ok ${id}: exists`); return byId.get(id); } const nb = build(); camp.beats.push(nb); byId.set(id, nb); changes++; report.push(`✚ NEW ${id} — ${nb.label}`); return nb; };
  const addReq = (beat, cond) => { beat.inject ||= {}; const r = Array.isArray(beat.inject.requires) ? beat.inject.requires : (beat.inject.requires ? [beat.inject.requires] : []); if (r.some(c => JSON.stringify(c) === JSON.stringify(cond))) return false; r.push(cond); beat.inject.requires = r; changes++; report.push(`✚ ${beat.id}: + requires ${JSON.stringify(cond)}`); return true; };
  const NOT_LEASED = [{ beatMark: "reliable_bought", not: true }, { beatMark: "reliable_gearbox_signs", not: true }, { beatMark: "reliable_parley_keys", not: true }];

  // ── the four endings of the Parley ──
  upsert("reliable_parley_renewed", () => ({
    id: "reliable_parley_renewed", label: "The Absolutely Reliable — The Old Number", type: "narration", sceneId: "x4IJo7y7YyUkICxH", playerFacing: true,
    tags: "quest:absolutely-reliable,teaching.parley,alpha.teaching",
    description:
      "The parts tag turns face-up. Gearbox has written a new number on the back of it, and it is the old number. Under that: THREE TURNS. Under that, smaller: SHE RUNS BEST IF YOU TALK TO HER. Mara looks up from the air filters long enough to say, \"Don't argue,\" to nobody in particular.\n\n" +
      "The lease card goes back on the galley wall with a fresh date. The Absolutely Reliable is still not yours. She is still where you sleep.",
    memoryText: "Talked Young Gearbox into three more turns on the Absolutely Reliable. Your first Parley, won.",
    choices: [ch("Shake on it.", "")],
    worldEffects: WE({ charter: { fromFactionName: "Furrier's Fixit Farm", rigName: "The Absolutely Reliable", turns: 3, note: "Renewed across the tarp — a Parley, won." }, warLog: "The coalition talked Young Gearbox into renewing The Absolutely Reliable for three more turns." }),
    inject: { repeatable: true, cooldownTurns: 0, oncePerHex: false, requires: NOT_LEASED.slice() }
  }));
  upsert("reliable_parley_keys", () => ({
    id: "reliable_parley_keys", label: "The Absolutely Reliable — The Keys", type: "narration", sceneId: "x4IJo7y7YyUkICxH", playerFacing: true,
    tags: "quest:absolutely-reliable,teaching.parley,alpha.teaching",
    description:
      "Somewhere in the middle of it the Farm stopped negotiating and started watching. Mara has put the air filters down. Gearbox finds a clean card, which takes a while, and writes on it in his best block capitals: LEASE ENDED. SHE'S THEIRS. CERTIFIED BY ME. He blows on the ink, holds it out, and says the one word he has been saving all afternoon.\n\n" +
      "\"Good.\"\n\n" +
      "The keys are already in your hand. You do not remember him giving them to you.",
    memoryText: "Impressed the Fixit Farm across the tarp; Young Gearbox handed over the keys to the Absolutely Reliable.",
    choices: [ch("Take her home.", "")],
    worldEffects: WE({ rigTransfer: { rigName: "The Absolutely Reliable", to: "@coalition" }, warLog: "Young Gearbox handed the coalition the keys to The Absolutely Reliable — the Farm was impressed." }),
    inject: { repeatable: false, cooldownTurns: 0, oncePerHex: false, requires: [{ beatMark: "reliable_bought", not: true }, { beatMark: "reliable_gearbox_signs", not: true }] }
  }));
  upsert("reliable_parley_stalemate", () => ({
    id: "reliable_parley_stalemate", label: "The Absolutely Reliable — Ask Me Again", type: "narration", sceneId: "x4IJo7y7YyUkICxH", playerFacing: true,
    tags: "quest:absolutely-reliable,teaching.parley,alpha.teaching",
    description:
      "The tag goes back face-down. Gearbox pours the rest of the coffee into his own mug and drinks it looking at the hovercraft, not at you. \"Ask me again,\" he says, which from him is a paragraph.\n\n" +
      "Nothing is decided. The card on the galley wall keeps its date. The offer keeps.",
    memoryText: "Sat down with Young Gearbox over the Absolutely Reliable and left it undecided.",
    choices: [ch("Another day, then.", "")],
    worldEffects: WE(),
    inject: { repeatable: true, cooldownTurns: 0, oncePerHex: false, requires: NOT_LEASED.slice() }
  }));
  upsert("reliable_parley_lost", () => ({
    id: "reliable_parley_lost", label: "The Absolutely Reliable — Cold Coffee", type: "narration", sceneId: "x4IJo7y7YyUkICxH", playerFacing: true,
    tags: "quest:absolutely-reliable,teaching.parley,alpha.teaching",
    description:
      "The coffee goes cold between you. Gearbox does not write anything on the tag; he just turns it over so the thirty faces up, and leaves it there. Mara does not say don't argue. She does not need to.\n\n" +
      "She goes home when the lease runs out, same as the card said. The thirty is still a price, if you can find it. Mara keeps the filters.",
    memoryText: "Lost the Parley with Young Gearbox. The Absolutely Reliable goes home when the lease runs out.",
    choices: [ch("Leave the tag where it is.", "")],
    worldEffects: WE({ warLog: "The coalition sat down with Young Gearbox over The Absolutely Reliable and lost the table." }),
    inject: { repeatable: false, cooldownTurns: 0, oncePerHex: false, requires: NOT_LEASED.slice() }
  }));

  // ── the Parley offer carries its routes; one shot after a loss; closed once the keys are yours ──
  const parley = need("reliable_lease_parley");
  if (parley) {
    const R = (label, routes) => { const c = (parley.choices || []).find(x => x.label === label); if (!c?.worldEffects?.raid) { report.push(`⚠ reliable_lease_parley: choice "${label}" has no raid offer`); return; } if (JSON.stringify(c.worldEffects.raid.routes || null) === JSON.stringify(routes)) { report.push(`· ok reliable_lease_parley: "${label}" routes set`); return; } c.worldEffects.raid.routes = routes; changes++; report.push(`✚ reliable_lease_parley: "${label}" → routes ${JSON.stringify(routes)}`); };
    R("Persuade — renew at the old rate", { win: "reliable_parley_renewed", stalemate: "reliable_parley_stalemate", loss: "reliable_parley_lost" });
    R("Impress — show the Farm what she'd be part of", { win: "reliable_parley_keys", stalemate: "reliable_parley_stalemate", loss: "reliable_parley_lost" });
    addReq(parley, { beatMark: "reliable_parley_lost", not: true });
    addReq(parley, { beatMark: "reliable_parley_keys", not: true });
  }
  for (const id of ["reliable_lease_last_turn", "reliable_lease_lapsed", "reliable_price"]) { const b = need(id); if (b) addReq(b, { beatMark: "reliable_parley_keys", not: true }); }

  // ── the Heist: caught = the house is awake ──
  upsert("ag_wick_room_caught", () => ({
    id: "ag_wick_room_caught", label: "The Vacancy — The Lamp on the Stairs", type: "narration", sceneId: "tqOeMXwSxcCPM5Cw", playerFacing: true,
    tags: "quest:ag-vacancy,teaching.heist,alpha.teaching",
    description:
      "A lamp comes up the stairs the way Verna comes up the stairs: slowly, and already certain. Below, the candle in the corner has not moved, and neither has the man beside it. He does not look up. He does not need to.\n\n" +
      "The house is awake. Whatever you read, you read; whatever you did not put back square, Verna will. Breakfast is going to be very polite.",
    memoryText: "Caught upstairs at the Vacancy. Verna knows; Wick pretends not to.",
    choices: [ch("Come down with your hands where she can see them.", "", { next: "allesh_gilliam_vacancy_intro" })],
    worldEffects: WE({ warLog: "Caught in the pilgrim's room at the Vacancy — the house woke." }),
    inject: { repeatable: true, cooldownTurns: 0, oncePerHex: false, requires: [{ flag: "storyPhase", gte: 1 }] }
  }));
  const heist = need("ag_wick_room_heist_offer");
  if (heist) {
    const c = (heist.choices || []).find(x => x.worldEffects?.raid);
    if (!c) report.push("⚠ ag_wick_room_heist_offer: no raid choice");
    else if (c.worldEffects.raid.routes?.loss === "ag_wick_room_caught") report.push("· ok ag_wick_room_heist_offer: routes set");
    else { c.worldEffects.raid.routes = { win: "", stalemate: "", loss: "ag_wick_room_caught" }; changes++; report.push("✚ ag_wick_room_heist_offer: loss → ag_wick_room_caught"); }
  }

  console.log(`[patch-offered-fights-routes] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Offered-fight routes DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Offered-fight routes: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-offered-fight-routes-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Offered-fight routes APPLIED: ${changes} change(s). A won Parley now renews the lease or hands over the keys.`);
})();
