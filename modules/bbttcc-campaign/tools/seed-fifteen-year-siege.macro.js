/* seed-fifteen-year-siege.macro.js — THE FIFTEEN-YEAR SIEGE
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §2 + owner decision #6:
 *  EXISTING COASTAL HEX; the trojan's "fruit basket, year zero" rumor
 *  GENUINELY CONNECTS — the paperwork lost in year three was gift-debt
 *  paperwork. The rumor is planted here; the Trojan vignette pays it off.)
 *
 * A hex that has been under siege for fifteen years. The siege has TENURE.
 * The besiegers' kids were born in the trench; the besieged run a farmers'
 * market ON the wall on alternating Thursdays; neither side remembers the
 * original demand. The one thing both commanders fear is it ENDING.
 *
 * No engine edits needed — pure existing machinery:
 *  · quests: quest_fifteen_year_siege (container) + quest_siege_festival
 *    (standing; accepted ONLY by the Charter door → gates the annual
 *    festival director beat via questBucket:active).
 *  · beats: siege_market_day (on-enter, 0.5d) → two commander conversations
 *    (0d; speakerActorId auto-stamped when the actors exist — re-run after
 *    minting Commander Ostrid Pell / Warden Bee Alderwick) → siege_doors →
 *    4 resolution set-pieces (1d each): Break / Mediate / Join / Charter.
 *    Join deliberately does NOT complete the quest — you inherited it.
 *  · siege_festival — repeatable director bridge, cooldownTurns 12 (one
 *    world-year at T=30), requires quest_siege_festival active.
 *  · stamps onEnterBeatId on SIEGE_HEX_NAME (Saltwake scene) — ⚠ OWNER:
 *    set the constant to your chosen coastal hex; warns+skips if not found.
 *  · GM bookkeeping: the hex carries a "Besieged (Stable)" modifier until
 *    resolved (apply via hex conditions by hand — beat text reminds you).
 *
 * All beats carry explicit timePoints (Turn Ledger). DRY_RUN default true;
 * idempotent (skips existing ids); backs up the campaigns setting. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  // Direct hex UUID (owner-set 2026-07-13) — takes PRECEDENCE over the name
  // search below. Leave "" to fall back to SIEGE_HEX_NAME on SALTWAKE_SCENE.
  const SIEGE_HEX_UUID = "Scene.X7XmEyebKXwjMlTW.Drawing.megakx5Ciw2Vqjjc";
  const SIEGE_HEX_NAME = "PolygonWood.a";                  // <-- fallback: hex name lookup
  const SALTWAKE_SCENE = "Bad Eden — The Saltwake Coast";  // fallback: scene to search
  const Q_SIEGE    = "quest_fifteen_year_siege";
  const Q_FESTIVAL = "quest_siege_festival";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const report = [];
  let changes = 0;

  // ── quests ────────────────────────────────────────────────────────────────
  if (!quests[Q_SIEGE]) {
    quests[Q_SIEGE] = {
      id: Q_SIEGE, v: 1, name: "The Fifteen-Year Siege",
      description: "A coastal hex has been under siege for fifteen years, and the siege has tenure: the besiegers' children were born in the trench and go to school in the counterweight tower; the besieged run a farmers' market ON the wall on alternating Thursdays, which the siege observes, because everyone observes market day. Neither side remembers the original demand — the paperwork was lost in year three, and both commanders have quietly agreed that checking would be worse. The one thing they both fear is it actually ENDING. End it anyway. Or don't. There are at least four ways through, and one of them is a festival.",
      tags: [], createdTs: 0, updatedTs: 0
    };
    changes++; report.push("✚ quest registered: The Fifteen-Year Siege");
  } else report.push("· ok quest (already) The Fifteen-Year Siege");
  if (!quests[Q_FESTIVAL]) {
    quests[Q_FESTIVAL] = {
      id: Q_FESTIVAL, v: 1, name: "Siege Week (Annual)",
      description: "The siege was chartered: a PROTECTED CULTURAL INSTITUTION, conducted ceremonially for one week a year, with rules, referees, historical costume, and a closing feast on the wall. Both sides got what they actually wanted, which was the routine. This quest stands open as long as the festival tradition lives — it is not a problem to solve; it is a calendar to keep.",
      tags: [], createdTs: 0, updatedTs: 0
    };
    changes++; report.push("✚ quest registered: Siege Week (Annual)");
  } else report.push("· ok quest (already) Siege Week (Annual)");

  // ── beat shapes (house patterns) ──────────────────────────────────────────
  const bridge = (id, label, description, { requires = null, priority = "background", timePoints = 0, questEffects = null, choices = null, repeatable = false, cooldownTurns = 0 } = {}) => ({
    id, label,
    type: "dialog", timeScale: "scene", timePoints,
    tags: "fifteen_year_siege story", politicalTags: "",
    description,
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns, repeatable, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      ...(requires ? { requires } : {})
    },
    actors: [],
    choices: choices || [{ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {},
    playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    storyChain: "fifteen_year_siege",
    priority,
    ...(questEffects ? { worldEffects: { questEffects } } : {})
  });
  const plain = (id, label, description, { timePoints = 0, choices = null, questEffects = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    description,
    ...(questEffects ? { worldEffects: { questEffects } } : {}),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  const BEATS = [
    // ── arrival: market day (on-enter, 0.5d) ─────────────────────────────────
    plain("siege_market_day", "The Siege — Market Day",
      "You arrive on a Thursday, which turns out to matter enormously. The siegeworks are the oldest you've ever seen still manned — trench lines with FLOWERBEDS, a counterweight tower with a school bell in it, laundry strung between mangonels — and the town wall above them is covered in market stalls. Actual stalls. Preserves, root vegetables, a poultry auction. Besiegers stand in an orderly queue at a rope ladder, unarmed, holding baskets. A sentry stamps their hands. Everyone — EVERYONE — observes market day. A trench-born teenager sells you an excellent meat pie and explains, patiently, as to a slow child: the siege is fifteen years old, the original demand was lost in year three, and no, nobody's going to CHECK, are you mad? (⚙ GM: the hex carries 'Besieged (Stable)' until this resolves — permanent, but stable is the load-bearing word. The Turn Ledger, if consulted, notes the siege has consumed roughly 5,400 days of somebody's time budget.)",
      { timePoints: 0.5,
        questEffects: [{ action: "accept", questId: Q_SIEGE, text: "Found: one siege, fifteen years old, with tenure, flowerbeds, and a market day both sides observe. Nobody remembers the demand. Nobody will check." }],
        choices: [
          { label: "Call on the Besieger Commander (the trench)", next: "siege_commander_camp" },
          { label: "Call on the Warden (the wall)", next: "siege_commander_town" },
          { label: "Buy another meat pie and take it all in", next: "" }
        ] }),

    // ── the commanders (conversations, 0d; speakers stamped when minted) ─────
    plain("siege_commander_camp", "Commander Ostrid Pell — The Trench",
      "Commander Ostrid Pell receives you in a command dugout that has, over fifteen years, become a rather nice sitting room — regimental maps on one wall, children's drawings on the other, a kettle that is clearly the most maintained piece of equipment in the camp. Pell is third-generation military and first-generation STUCK: too honorable to leave a siege unfinished, too honest to pretend he remembers what finishing means. He will discuss trench drainage, the school rota, and market-day protocol with real enthusiasm; on the ORIGINAL DEMAND, he goes quiet and rearranges items on his desk until the subject changes. (Speak with him properly via conversation — he has TRUTHS, and a locked drawer.)",
      { timePoints: 0, choices: [
        { label: "Talk of ending it (choose how)", next: "siege_doors" },
        { label: "Back to the market", next: "siege_market_day" }
      ] }),
    plain("siege_commander_town", "Warden Bee Alderwick — The Wall",
      "Warden Bee Alderwick runs the Held Town from a chair on the wall itself, positioned — you slowly realize — so that her morning shadow falls on the trench at the exact spot where Commander Pell takes his tea. She inherited the wardenship, the wall, and the siege from her grandmother, in that order of importance. She can recite the town's defensive readiness like scripture and does, unprompted, to anyone within range; she can also, without looking, tell you what the besiegers are having for supper by the smoke. On the original demand: 'Lost in year three. Best thing that ever happened to this siege.' She will not elaborate. Her office keeps one drawer locked, same as Pell's, which neither of them knows about the other. (Speak with her properly via conversation — she has TRUTHS.)",
      { timePoints: 0, choices: [
        { label: "Talk of ending it (choose how)", next: "siege_doors" },
        { label: "Back to the market", next: "siege_market_day" }
      ] }),

    // ── the doors ────────────────────────────────────────────────────────────
    plain("siege_doors", "Ending the Fifteen-Year Siege",
      "It could END, you realize, and the realization arrives with the specific vertigo of standing next to a very old, very balanced thing. Four ways through present themselves — and understand, before choosing: the one thing BOTH commanders fear, in the privacy of their locked drawers, is exactly this conversation.",
      { type: "dialog", timePoints: 0, choices: [
        { label: "Break it — someone finally wins", next: "siege_break" },
        { label: "Mediate it — a real treaty", next: "siege_mediate" },
        { label: "Join it — pick a side", next: "siege_join" },
        { label: "Charter it — a protected cultural institution", next: "siege_charter" }
      ] }),

    // ── resolutions (set-pieces, 1d each) ────────────────────────────────────
    plain("siege_break", "The Siege, Broken",
      "Violence solves it the way violence solves things: completely, quickly, and in the wrongest possible key. The trench falls — or the wall does; the difference stops mattering within the hour — and fifteen years of the most carefully balanced institution on the coast comes down in an afternoon. You won. Both sides are FURIOUS at you. The trench children won't look at the wall children, who used to trade them sweets on market day; Pell and Alderwick, victorious and defeated in whichever order, will never take tea within sight of each other again, a sentence that would mean nothing to you unless you'd read their drawers. The hex is yours, or somebody's. Market day does not survive the month. (⚙ GM: clear 'Besieged (Stable)'; if the breaking got ugly in front of witnesses, the region files it in the same drawer as 'they shot the dancers.')",
      { timePoints: 1, memoryText: "The Fifteen-Year Siege was broken by force. Somebody won; everybody lost the routine; market day did not survive.",
        questEffects: [{ action: "complete", questId: Q_SIEGE, state: "completed", text: "Broken — the siege ended in an afternoon; both sides are furious at the people who ended it." }] }),
    plain("siege_mediate", "The Treaty With a Market Clause",
      "It takes nine days, four drafts, and one walkout (Pell's, over seating; he came back with biscuits and no explanation), and at the end there is a TREATY — an actual, signed, witnessed peace. The negotiation's one non-negotiable, insisted on by both sides with identical vehemence before terms were even discussed: Clause One preserves market day, in perpetuity, exactly as practiced. When the instruments are exchanged both commanders weep, openly, in full view of both formations, and both formations pretend furiously not to notice, which is the most united the two sides have ever been. The trench is to be filled in stages — the flowerbeds transplanted, the school rehoused with honors. (⚙ GM: clear 'Besieged (Stable)'. Diplomacy of this order travels; the region takes note of who mediated it.)",
      { timePoints: 1, memoryText: "The Fifteen-Year Siege ended in a real treaty whose first clause preserves market day. Both commanders wept; both formations pretended not to notice.",
        questEffects: [{ action: "complete", questId: Q_SIEGE, state: "completed", text: "Mediated — peace with a market clause. The routine survived the treaty, which is what everyone actually wanted." }] }),
    plain("siege_join", "New Banners in an Old Trench",
      "You picked a side. Congratulations: you have inherited a fifteen-year position of principle that nobody, including your new comrades, can articulate. Your banner flies over (or against) the oldest flowerbeds in siegecraft; you are briefed on protocols of staggering antiquity — the market truce, the school bell precedence, the Thursday rotations — by people who no longer hear how strange the briefing is. The other side has already adjusted its supper schedule to account for you, which you know, because you can read the smoke now too. The siege continues. The siege ALWAYS continues; that's the institution. You're just IN it now, and the quest, pointedly, remains open. (⚙ GM: 'Besieged (Stable)' stands; the joined side gains your weight in future turns.)",
      { timePoints: 1, memoryText: "The coalition joined the Fifteen-Year Siege — a side was picked, banners raised over the old trench, and the institution absorbed them the way it absorbs everything: politely, on schedule." }),
    plain("siege_charter", "The Chartered Siege",
      "The masterstroke takes a week of softpower and one genuinely great pot of tea: the siege is registered — signed, sealed, witnessed by three neutral parties and one visibly moved notary — as a PROTECTED CULTURAL INSTITUTION. Henceforth it is conducted CEREMONIALLY, one week a year: historical costume, rules of engagement with referees, the trench manned by heritage volunteers, a closing feast held on the wall at which the two commanders preside jointly. The rest of the year, the trench is a garden and the counterweight tower is just a school. Nobody surrendered. Nobody won. Both sides got what they actually wanted, which was the ROUTINE — now with a budget and a gift shop. Pell and Alderwick take their tea together in public for the first time in fifteen years, and the whole coast pretends it's not the biggest news of the decade. (⚙ GM: clear 'Besieged (Stable)' — replace with something festive if the mood takes you. Siege Week arrives annually via the director.)",
      { timePoints: 1, memoryText: "The Fifteen-Year Siege was chartered as a protected cultural institution — one ceremonial week a year, referees and all. Both sides kept the routine; the commanders finally take tea in public.",
        questEffects: [
          { action: "complete", questId: Q_SIEGE, state: "completed", text: "Chartered — the siege is a festival now. Nobody surrendered; everybody kept the routine." },
          { action: "accept", questId: Q_FESTIVAL, text: "Siege Week is on the calendar. One week a year, ceremonially, with referees. Keep the tradition; it keeps the peace." }
        ] }),

    // ── the annual festival (turn-tick chain; one world-year = 12 turns) ─────
    bridge("siege_festival", "Siege Week (The Festival Returns)",
      "The banners go up on schedule: SIEGE WEEK is here again. Heritage volunteers man the trench in period costume (the flowerbeds are roped off); the mangonels throw pumpkins, competitively, with referees; the school bell calls the 'hostilities' to lunch. Pell and Alderwick preside jointly from a platform on the wall, bickering with the polish of a double act that has finally stopped pretending it isn't one. The closing feast is on Thursday. It is always on Thursday. (⚙ GM: fire it as a downtime set-piece, a trade opportunity, or a quiet character beat — the festival is a stage; the region attends.)",
      { requires: { questBucket: Q_FESTIVAL, is: "active" }, repeatable: true, cooldownTurns: 12, timePoints: 0.5,
        choices: [
          { label: "Attend Siege Week", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" },
          { label: "Skip this year (it'll be back)", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }
        ] })
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id} (${nb.timePoints}d${nb.inject?.requires ? ", gated" : ""}${nb.inject?.repeatable ? ", repeatable/12" : ""})`);
  }

  // ── speaker stamping (idempotent; re-run after minting the commanders) ────
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const SPEAKERS = [
    ["siege_commander_camp", ["Commander Ostrid Pell", "Ostrid Pell", "Commander Pell", "Pell"]],
    ["siege_commander_town", ["Warden Bee Alderwick", "Bee Alderwick", "Warden Alderwick", "Alderwick"]]
  ];
  for (const [beatId, cands] of SPEAKERS) {
    const b = byId.get(beatId);
    const actor = findActor(cands);
    if (!b) continue;
    if (b.speakerActorId) { report.push(`· ok speaker (already) @ ${beatId}`); continue; }
    if (!actor) { report.push(`⚠ speaker for ${beatId} not found (mint + re-run to stamp)`); continue; }
    b.speakerActorId = actor.id;
    changes++; report.push(`👤 speaker @ ${beatId} → ${actor.name}`);
  }

  // ── hex on-enter stamp (direct UUID preferred; name search fallback) ──────
  let hex = null, hexLabel = "";
  if (SIEGE_HEX_UUID) {
    const doc = await fromUuid(SIEGE_HEX_UUID).catch(() => null);
    if (!doc) report.push(`⚠ SIEGE_HEX_UUID "${SIEGE_HEX_UUID}" did not resolve — onEnter NOT stamped (check the UUID + re-run)`);
    else if (doc.documentName !== "Drawing") report.push(`⚠ SIEGE_HEX_UUID resolves to a ${doc.documentName}, not a Drawing — onEnter NOT stamped`);
    else {
      hex = doc;
      hexLabel = doc.text || doc.flags?.["bbttcc-territory"]?.name || SIEGE_HEX_UUID;
      if (!doc.flags?.["bbttcc-territory"]) report.push(`⚠ note: that Drawing has no bbttcc-territory flags — stamping anyway, but verify it is a hex`);
    }
  } else {
    const scene = game.scenes.getName(SALTWAKE_SCENE) || game.scenes.contents.find(s => s.name === SALTWAKE_SCENE);
    if (!scene) report.push(`⚠ scene "${SALTWAKE_SCENE}" not found — onEnter NOT stamped (re-run when present)`);
    else {
      hex = scene.drawings.contents.find(dr => {
        const f = dr.flags?.["bbttcc-territory"];
        if (!f) return false;
        return norm(dr.text || f.name) === norm(SIEGE_HEX_NAME);
      }) || null;
      hexLabel = SIEGE_HEX_NAME;
      if (!hex) report.push(`⚠ hex "${SIEGE_HEX_NAME}" not found on scene — onEnter NOT stamped (set SIEGE_HEX_UUID or adjust the name + re-run)`);
    }
  }
  if (hex) {
    const cur = hex.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId;
    if (cur === "siege_market_day") report.push(`· ok onEnter (already) @ ${hexLabel}`);
    else if (cur) report.push(`⚠ hex "${hexLabel}" already has onEnter '${cur}' — NOT overwritten (clear it first if the siege should live here)`);
    else {
      changes++; report.push(`⚡ onEnter: ${hexLabel} → siege_market_day`);
      if (!DRY_RUN) await hex.update({ "flags.bbttcc-territory.campaign.onEnterBeatId": "siege_market_day" });
    }
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[seed-fifteen-year-siege] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Fifteen-Year Siege DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Fifteen-Year Siege: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-siege-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Fifteen-Year Siege APPLIED: ${changes} change(s). Everyone observes market day.`);
})();
