/* seed-cadence.macro.js — THE CADENCE: dance battle raid
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §1 + owner decision #5:
 *  RECURRING soft-power antagonist; support-faction cameo reward)
 *
 * A crew that raids hexes CULTURALLY — speakers, sequins, a formal declaration
 * of rhythm. Losing costs face, not walls. They have never thrown a punch.
 * They have never needed to.
 *
 * Pairs with the Cadence state flags in campaign module.js (cadenceRespect /
 * cadenceTribute / cadenceUncontested — written by the outcome beats, read by
 * the standing offers' inject.requires gates). This seeder authors:
 *
 *  · quest registry: quest_cadence "The Cadence" (accepted at declaration;
 *    completed by a WIN either way; lose/refuse keep it standing — recurring).
 *  · cadence_declaration — director bridge, GM-timed (no gate): the challenge
 *    card arrives. Accept → battle. Refuse → the border show begins.
 *  · cadence_battle — the set-piece (1 day): run it as a RAID whose eligible
 *    maneuver pool is culture/softpower-flavored (anchor: maneuver gating +
 *    support-faction machinery already exist). Three exits.
 *  · outcomes: win_with_style (cameo ladder opens) / win_ugly ("they shot the
 *    dancers") / lose_gracefully (tribute + standing rematch).
 *  · standing offers (repeatable, once per turn tick, flag-gated):
 *      cadence_rematch     — while tribute stands (you lost)
 *      cadence_border_show — while the refusal stands ("Out-Danced
 *                            (Uncontested)" until answered)
 *      cadence_cameo       — while respect stands: THE CADENCE FIRES AS A
 *                            SUPPORT FACTION in ONE raid of your choosing
 *                            (⚠ GM: mint "The Cadence" faction actor — owner
 *                            action — and pick them in the raid console's
 *                            support selection; resolving this spends it).
 *
 * All beats carry explicit timePoints (Turn Ledger). DRY_RUN default true;
 * idempotent (skips existing ids); backs up the campaigns setting. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const Q_CADENCE = "quest_cadence";
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

  // ── quest registry ────────────────────────────────────────────────────────
  if (!quests[Q_CADENCE]) {
    quests[Q_CADENCE] = {
      id: Q_CADENCE, v: 1, name: "The Cadence",
      description: "A crew that raids culturally: speakers, sequins, and a formal declaration of rhythm, delivered on cardstock. Losing to them costs face, not walls — and the story spreads to every neighboring hex. They have never thrown a punch. They have never needed to. Answer the declaration on the floor, or live with what the silence says about you.",
      tags: [], createdTs: 0, updatedTs: 0
    };
    changes++; report.push("✚ quest registered: The Cadence");
  } else report.push("· ok quest (already) The Cadence");

  // ── director bridge shape (spine pattern, + standing-offer knobs) ─────────
  const bridge = (id, label, description, { requires = null, priority = "background", timePoints = 0, questEffects = null, choices = null, repeatable = false, cooldownTurns = 0 } = {}) => ({
    id, label,
    type: "dialog",
    timeScale: "scene",
    timePoints,
    tags: "cadence story",
    politicalTags: "",
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
    storyChain: "cadence",
    priority,
    ...(questEffects ? { worldEffects: { questEffects } } : {})
  });

  // Plain (non-director) beat — fired by choices, never offered.
  const plain = (id, label, description, { timePoints = 0, choices = null, questEffects = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    description,
    ...(questEffects ? { worldEffects: { questEffects } } : {}),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  const BEATS = [
    // ── the declaration (GM-timed; the challenge card arrives) ───────────────
    bridge("cadence_declaration", "A Formal Declaration of Rhythm",
      "It arrives at the gate at golden hour, because of course it does: a courier in sequins that catch the light like a threat, bearing a card of genuinely excellent stock. The calligraphy is flawless. The message is a DECLARATION OF RHYTHM — time, place, terms — from a crew calling themselves THE CADENCE, who your scouts describe, with visible difficulty, as 'heavily armed with speakers.' The terms are simple: meet them on the floor, or the floor comes to you. No weapon has ever appeared in any account of them, anywhere, ever. This is somehow the most unnerving thing your scouts have ever reported. The card is scented. The scent is confidence.",
      { priority: "background", timePoints: 0,
        questEffects: [{ action: "accept", questId: Q_CADENCE, text: "The Cadence has issued a formal declaration of rhythm. The floor awaits an answer." }],
        choices: [
          { label: "Accept the challenge — meet them on the floor", next: "cadence_battle", description: "", checkStat: "", checkDC: 0, failNext: "" },
          { label: "Refuse", next: "cadence_refuse", description: "", checkStat: "", checkDC: 0, failNext: "" }
        ] }),

    // ── the battle (set-piece: a culture/softpower raid) ─────────────────────
    plain("cadence_battle", "The Cadence — The Floor",
      "They arrive EXACTLY on time, which no armed force in history has ever done, and build the floor in an hour: speakers in a ring, lanterns strung in figures, a strip of polished decking laid over the mud like a dare. The Maestra walks the perimeter once, nods at your defenses the way a rival chef nods at a clean kitchen, and takes position. Then the count comes in — four bars of it, loud enough to feel in the teeth — and the raid begins. Nobody draws steel. That's the terrifying part: it never occurs to anyone to draw steel. ⚙ GM: run this as a raid whose eligible maneuvers are CULTURE and SOFTPOWER — face is the territory; style is the ordnance. Three ways off the floor:",
      { type: "dialog", timePoints: 1, choices: [
        { label: "Out-dance them — win with STYLE", next: "cadence_win_style" },
        { label: "Win ugly — someone escalated mid-routine", next: "cadence_win_ugly" },
        { label: "Lose gracefully", next: "cadence_lose" }
      ]}),

    // ── outcomes ─────────────────────────────────────────────────────────────
    plain("cadence_win_style", "Out-Danced — With Style",
      "It happens somewhere in the fourth figure: your side finds the pocket of the beat and DOES NOT LEAVE IT, and the Cadence — who have out-danced garrisons, courts, and one entire religious procession — start watching your feet instead of their own. When the music ends, the Maestra calls the floor herself, which her crew will tell you has happened four times in living memory. She presents the crew's respect the way other forces present terms of surrender: formally, on cardstock. (⚙ GM: award a Culture bump — the story reaches every neighboring hex by week's end.) The respect is not a metaphor. It is a STANDING OBLIGATION: one raid, of your choosing, with the Cadence on your side of the floor.",
      { timePoints: 0, memoryText: "The Cadence was out-danced, with style, and called the floor themselves. One allied raid is owed — the respect of the sequined is a standing instrument.",
        questEffects: [{ action: "complete", questId: Q_CADENCE, state: "completed", text: "Out-danced with style — the Cadence's respect (and one owed cameo) is yours." }] }),
    plain("cadence_win_ugly", "You Won the Hex and Lost the Region",
      "Somebody — history will argue about whose side started it — escalated mid-routine. It ended fast, the way real violence against unarmed performers always ends, and you 'won,' in the sense that the floor is yours and the music has stopped. The Cadence withdrew in perfect order, wounded carried in formation, without a word — and the SILENCE they left is already talking. By morning the story is on every road: they came with speakers, and were answered with steel. (⚙ GM: 'they shot the dancers' circulates to every ADJACENT hex — diplomacy checks there face stiffer DCs until the stain fades; the dossier page does the social bookkeeping.)",
      { timePoints: 0, memoryText: "The dance battle turned violent, and the region heard about it before the bruises rose. The hex was won; the neighborhood's regard was the price.",
        questEffects: [{ action: "complete", questId: Q_CADENCE, state: "completed", text: "Won ugly — the floor taken by force; the story travels against you." }] }),
    plain("cadence_lose", "Lost — Gracefully",
      "You were good. They were the CADENCE. Somewhere in the fifth figure the outcome stopped being in question and started being a lesson, and to your people's lasting credit, they took it like one — finished the set, held the line of the routine, and bowed when the music ended. The Maestra bowed BACK, deeper than she had to, which witnesses say is its own kind of trophy. Terms follow on cardstock: tribute in Culture marks (⚙ GM: collect it — modest, ceremonial, and somehow still stinging) and a STANDING REMATCH, renewed each turn, because the Cadence considers a graceful loser unfinished business of the best kind.",
      { timePoints: 0, memoryText: "Lost to the Cadence, gracefully — tribute paid in culture marks, and a standing rematch invitation arrives with the turn." }),
    plain("cadence_refuse", "Out-Danced (Uncontested)",
      "You declined the floor. The Cadence received the refusal with perfect courtesy, withdrew to a point PRECISELY one pace outside your border — surveyed, measured, argued over with instruments — and began to perform. They perform at shift change. They perform at dusk. They perform, devastatingly, at breakfast. The sign over the Muster says GOOD VIBES ONLY, and the Cadence agrees, aggressively, from exactly the distance the law of hospitality requires. (⚙ GM: the hex carries 'Out-Danced (Uncontested)' — a face-tax on its dealings — until the challenge is answered on the floor.) Your sentries have started tapping their feet. It is a siege, and the ammunition is EMBARRASSMENT.",
      { timePoints: 0, memoryText: "The declaration was refused; the Cadence performs at the border on schedule. The hex is Out-Danced (Uncontested) until somebody answers." }),

    // ── standing offers (repeatable, once per turn tick, flag-gated) ─────────
    bridge("cadence_rematch", "The Rematch Invitation (Renewed)",
      "It arrives with the turn like weather: cardstock, calligraphy, the scent of confidence. The Cadence presents its compliments, notes with approval that your people have been PRACTICING (they know; nobody knows how they know), and renews the invitation to the floor. The tribute stands until the rematch is danced. The card is, as always, genuinely beautiful. Your quartermaster has started collecting them, which everyone has agreed not to discuss.",
      { requires: { flag: "cadenceTribute", eq: 1 }, repeatable: true, cooldownTurns: 1, timePoints: 0, choices: [
        { label: "Take the floor again", next: "cadence_battle", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Not this turn (the tribute stands)", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }
      ] }),
    bridge("cadence_border_show", "The Border Performance (Ongoing)",
      "They're still out there. This turn's program, per the card courteously delivered to your gate: two new figures, a percussion suite your sentries have been HUMMING, and a finale described only as 'for the neighbors.' Attendance from surrounding hexes is growing; someone is selling refreshments; a viewing mound has developed INFRASTRUCTURE. The hex remains, in the eyes of every road in the region, Out-Danced (Uncontested). The floor remains open. The Cadence remains patient. The embarrassment compounds at a rate your bookkeepers decline to calculate.",
      { requires: { flag: "cadenceUncontested", eq: 1 }, repeatable: true, cooldownTurns: 1, timePoints: 0, choices: [
        { label: "Answer at last — take the floor", next: "cadence_battle", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Endure another turn of it", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }
      ] }),
    bridge("cadence_cameo", "The Cadence Honors the Floor",
      "The owed raid can be called in: name the target, and the Cadence arrives ON YOUR SIDE — speakers, sequins, morale like a weather system — fighting (their word: PERFORMING) as a support faction for one engagement. ⚙ GM: mint 'The Cadence' as a faction actor if not yet minted (owner action, like all minting), align them for the engagement, and select them in the raid console's support-faction picker — their maneuver flavor is culture/softpower. Resolving this beat SPENDS the owed cameo; the respect, once spent, must be re-earned on the floor. They would genuinely love that.",
      { requires: { flag: "cadenceRespect", eq: 1 }, priority: "high", repeatable: true, cooldownTurns: 1, timePoints: 0, choices: [
        { label: "Call it in — the Cadence dances with you", next: "cadence_cameo_spent", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Hold the favor a while longer", next: "", description: "(The respect stands; the offer returns with the turn.)", checkStat: "", checkDC: 0, failNext: "" }
      ] }),
    plain("cadence_cameo_spent", "One Raid, With Sequins",
      "The favor is called. Word goes out on cardstock — THEIR cardstock, which is how you know it's binding — and when the engagement opens, the Cadence is there on your flank in formation, speakers already warm. What follows is the single strangest thing your veterans will ever describe: an assault conducted at 124 beats per minute, morale arriving like weather, an enemy line that cannot decide whether it is being attacked or invited. (⚙ GM: this beat marks the cameo SPENT — the respect flag clears; fire it when the chosen raid concludes. To earn another, someone has to out-dance them again, and the Maestra dearly hopes someone tries.)",
      { timePoints: 0, memoryText: "The Cadence honored the floor: one raid danced on the coalition's side, the owed respect spent in full sequin." })
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id} (${nb.timePoints}d${nb.inject?.requires ? ", gated" : ""}${nb.inject?.repeatable ? ", repeatable" : ""})`);
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[seed-cadence] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Cadence DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Cadence: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-cadence-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Cadence APPLIED: ${changes} change(s). Four bars. Count it in.`);
})();
