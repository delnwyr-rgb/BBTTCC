/* =========================================================================
 * Bad Eden — Seed "Classification Review" (Circuit Riders chase chain)
 * =========================================================================
 * Fills the canonical socket specified in west-side.md ("Flagged consequence:
 * a later beat 'Classification Review' — Riders shadow the party — gated
 * @after beat:enc_circuit_riders_parley_flagged").
 *
 * Authors 5 beats on quest_circuit_riders_parley:
 *   circuit_riders_classification_review  — hook: the verification pack
 *       arrives; choice = stand the audit OR ride. Gated on the flagged
 *       beat-mark + storyPhase>=2 (armed-not-open: shows in Coming Up,
 *       spends no Phase-2 ready budget).
 *   circuit_riders_review_stood           — stood still: Simone notes zero lag.
 *   circuit_riders_chase_run              — launch beat carrying beat.chase
 *       (plains → forest → forest → river; the Odaroloc crossing breaks a
 *       land-locked pursuit via the domain gate). onCaught/onEscaped route
 *       automatically when the chase resolves.
 *   circuit_riders_chase_caught           — roadside review, engines idling.
 *   circuit_riders_chase_escaped          — "the network is faster than your
 *       apology, and now it has your top speed."
 *
 * ALSO stamps enc_circuit_riders_parley_flagged with a questEffects row
 * (action:complete + beatId mark) so the gate can ever arm — the parley
 * terminals currently complete nothing (known defect, west-side.md). NOTE
 * this closes the quest on the FLAGGED lane only; alliance/neutral terminals
 * stay unwired (separate owner decision).
 *
 * Tone guardrails honored: bloodless (classification, not combat), aftermath
 * voice on cards, sincere — never wink. Requires chase.js >= onCaught/
 * onEscaped + fromCtx support (deployed 2026-07-26).
 *
 * DRY_RUN=true by default — prints the full report, writes NOTHING.
 * ========================================================================= */
(async () => {
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const DRY_RUN = false; // <-- set false to apply
  const NS = "bbttcc-campaign";
  const QID = "quest_circuit_riders_parley";
  const FLAGGED_ID = "enc_circuit_riders_parley_flagged";

  const report = [];
  let changes = 0;

  /* ---------------------------------------------------------- load store */
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error("No active campaign found.");
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];

  if (!camp.beats.some(b => String(b?.questId) === QID))
    report.push(`⚠ sanity: no existing beats on ${QID} in this campaign — wrong world?`);

  /* ----------------------------------------------------------- templates */
  const GATE = [
    { beatMark: FLAGGED_ID, quest: QID, state: "seen" },
    { flag: "storyPhase", gte: 2 }
  ];
  const mkBeat = (o) => foundry.utils.mergeObject({
    id: "", label: "", type: "custom", description: "",
    tags: "quest:circuit-riders-parley,theme.faction,theme.mecha,theme.chase",
    choices: [], timeScale: "scene", timePoints: 0, politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: false, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires: foundry.utils.deepClone(GATE)
    },
    actors: [], encounter: { key: null, tier: null, actorName: null },
    worldEffects: {
      territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null,
      turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: []
    },
    questId: QID, questStep: null, questRole: null, targetHexUuid: null,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] },
    audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: false, broadcastPlayers: false },
    playerFacing: true, sceneId: null,
    playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
  }, o, { inplace: false });

  /* -------------------------------------------------------------- beats */
  const BEATS = [

    mkBeat({
      id: "circuit_riders_classification_review",
      label: "Classification Review",
      priority: "high",
      description:
        "The flag traveled faster than you did. Days after the parley, a verification " +
        "pack crested the ridge line behind you — modular bikes in a spread formation, " +
        "one crawler-rig running with its panel open. They were not hiding. They never " +
        "are. A speaker crackled across the distance: “CITIZENS. YOUR CLASSIFICATION " +
        "IS UNDER REVIEW. PLEASE MAINTAIN CURRENT VELOCITY.” Maintaining current " +
        "velocity has never once been the plan.",
      choices: [
        {
          label: "Hold position and stand the audit",
          description: "Zero lag between recognizing the situation and acting like you recognized it.",
          next: "circuit_riders_review_stood", failNext: "", checkStat: "", checkDC: 0
        },
        {
          label: "Ride",
          description: "Their network is fast. Are you faster?",
          next: "circuit_riders_chase_run", failNext: "", checkStat: "", checkDC: 0
        }
      ]
    }),

    mkBeat({
      id: "circuit_riders_review_stood",
      label: "Eleven Minutes of Dignity",
      description:
        "You held position while the pack circled and scanned. It took eleven minutes " +
        "and cost nothing but composure. Simone rode past last, slow, and looked at you " +
        "the way an auditor looks at a ledger that unexpectedly balances: no lag. The " +
        "classification did not change. The tone of it did.",
      worldEffects: { warLog: "Stood a Circuit Rider classification review without running. Simone logged zero lag." }
    }),

    mkBeat({
      id: "circuit_riders_chase_run",
      label: "The Riders Do Not Stop Twice",
      timeScale: "scene", timePoints: 1,
      description:
        "You did not maintain current velocity. The pack folded off the ridge in eerie " +
        "coordination, route-prediction overlays already guessing at your next three " +
        "turns. From the crawler-rig's open panel, someone sounded genuinely delighted.",
      chase: {
        label: "Classification Review",
        quarry: { fromCtx: true },
        pursuer: {
          name: "Rider Verification Pack — Dennis's Lane",
          speed: 3, tier: 2, bonus: 2, hazardResist: 1, domains: ["land"]
        },
        route: ["plains", "forest", "forest", "river"],
        lead: 3, escapeAt: 6,
        onCaught: "circuit_riders_chase_caught",
        onEscaped: "circuit_riders_chase_escaped"
      }
    }),

    mkBeat({
      id: "circuit_riders_chase_caught",
      label: "Arrived Where You Were Always Going To Be",
      description:
        "The crawler-rig did not overtake you so much as arrive where you were always " +
        "going to be. The pack boxed politely — no weapons, just angles. Captain Robot's " +
        "voice came through the speaker, unhurried: verification first. The review " +
        "happened on the roadside, engines idling. They logged your evasion pattern, " +
        "thanked you for the data, and left the classification standing. Somewhere " +
        "behind the formation, something enormous shifted its weight and settled.",
      worldEffects: { warLog: "Ran from a Circuit Rider classification review; caught. Evasion pattern logged." }
    }),

    mkBeat({
      id: "circuit_riders_chase_escaped",
      label: "Faster Than the Apology",
      description:
        "You beat the prediction — through geometry their models refuse to route through, " +
        "across water their wheels cannot hold. The pack broke off without drama; " +
        "theatrical pursuit is not doctrine. That night, a relay tower you had passed " +
        "clicked once, twice, and went quiet. The classification stands. The network is " +
        "faster than your apology, and now it has your top speed.",
      worldEffects: { warLog: "Outran a Circuit Rider verification pack. Classification stands; top speed logged." }
    })
  ];

  for (const b of BEATS) {
    if (camp.beats.some(x => String(x?.id) === b.id)) { report.push(`· ok beat (already) ${b.id}`); continue; }
    camp.beats.push(b);
    changes++;
    report.push(`✚ beat created: ${b.id} ("${b.label}")`);
  }

  /* ------------------- stamp the flagged terminal so the gate can arm --- */
  const flagged = camp.beats.find(b => String(b?.id) === FLAGGED_ID);
  if (!flagged) {
    report.push(`⚠ ${FLAGGED_ID} not found — beat-mark gate will never arm. Stamp skipped.`);
  } else {
    flagged.worldEffects = flagged.worldEffects || {};
    const qe = Array.isArray(flagged.worldEffects.questEffects) ? flagged.worldEffects.questEffects : [];
    if (qe.some(r => String(r?.beatId) === FLAGGED_ID)) {
      report.push(`· ok flagged terminal already stamps a beat-mark`);
    } else {
      qe.push({
        action: "complete", questId: QID, beatId: FLAGGED_ID, state: "completed",
        text: "Flagged by the Circuit Riders. Their network is faster than your apology."
      });
      flagged.worldEffects.questEffects = qe;
      changes++;
      report.push(`⚡ ${FLAGGED_ID}: questEffects stamped (completes quest on flagged lane + writes beat-mark). ` +
        `NOTE: alliance/neutral terminals remain unwired — separate decision.`);
    }
  }

  /* -------------------------------------------------------------- report */
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const header = `${DRY_RUN ? "🧪 DRY RUN — nothing written" : "✅ APPLIED"} — Classification Review seeder (${changes} change${changes === 1 ? "" : "s"})`;
  console.log(`[seed-circuit-rider-chase] ${header}`);
  report.forEach(l => console.log("  " + l));
  ChatMessage.create({
    speaker: { alias: "Bad Eden Campaign" },
    whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flavor: `<section class="bbttcc-campaign-seed"><h3>${esc(header)}</h3>` +
      report.map(l => `<p style="margin:2px 0">${esc(l)}</p>`).join("") + `</section>`
  });

  if (DRY_RUN) return;
  if (!changes) return ui.notifications.info("Nothing to write — already seeded.");

  /* ------------------------------------------------- backup, then write */
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-circuit-chase-${Date.now()}.json`);
  } catch (e) {
    console.error("[seed-circuit-rider-chase] backup failed — ABORTING write", e);
    return ui.notifications.error("Backup failed — nothing written.");
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Classification Review seeded (${changes} changes).`);
})();
