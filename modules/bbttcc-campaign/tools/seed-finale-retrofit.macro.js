/* seed-finale-retrofit.macro.js — THATWARDS HO! FINALE to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/THATWARDS_HO_FINALE_RETROFIT_2026_09_30.md; bible §4 (Sklar knows the heading, not the cost), §7 (THE PAYMASTER'S NUMBERS turns her),
 * §9 (the Leygate as a fourth way in), §10 ruling 8 (Sklar turns in the finale). NEW actors Sklar Bjrornholt + Purser Ingrid Halvarsen (personas,
 * secrets); Wick + Captain Robot voiced; COUNT YOUR OPERATIONS (hidden answers per ally); THE FOURTH WAY IN (door, gated on the Trail's Legansus
 * sequence); THE CRATES (receipt THE PAYMASTER'S NUMBERS); SKLAR'S ARITHMETIC = the turn (+ fail); routes from every branch to the outcomes and
 * from the outcomes to the rewards; the courier after-beat; four war-log strings scrubbed of the paymaster's name (named only by Gloomgill).
 * Idempotent; backs up the campaigns setting. F5 after.
 *
 * REVIEW FIXES 2026-10-01 (GAME_REVIEW_2026_09_30, HIGH): the crates, Sklar's arithmetic, the turn and the unmoved landing gated only on
 * storyPhase ≥ 5 while carrying storyChain + priority high + speakers — the Director (and a talk with Sklar / the purser) could hand out the
 * Paymaster's Numbers or play Sklar's turn before anyone entered the bunker. Each is now gated on the beats that ROUTE to it:
 *   crates ← a successful branch or the Leygate (GATE_CRATES) · arithmetic ← the crates or a courtly success (GATE_ARITH)
 *   turn / unmoved ← the arithmetic (GATE_TURN), and those two outcome nodes are dialogueOffer:false.
 * The crates + arithmetic stay conversation-offerable once their gate is met (the NOW lines are "ask the purser" / "show her"). Every
 * authored route still lands (a route never consults inject.requires). Re-runs reconcile already-seeded beats additively.
 * Already-seeded worlds: tools/patch-template-review-fixes-2026-10-01.macro.js does the same repair in one run.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "finale", Q = "quest_thatwards_ho_finale";
  const MARKER = "[FINALE-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const PERSONAS = {
    sklar: { name: "Sklar Bjrornholt", topics: "the Valhaulans, the ships, landing sideways, the bunker, the Spark, the Seal, the heading, the client, the paper, fuel, pay, the island, Khezek-Tor, the mountain, terms, drinks, boldness, arithmetic",
      notes: `${MARKER} PRIVATE TRUTH — Sklar Bjrornholt leads the Valhaulans: aerial techno-Viking pirates whose airships always land sideways. A Valkyrie with impeccable leadership and no impulse control; she offers you a drink before she decides what you are, and decides while you drink it. VOICE: mercenary honesty, delighted by boldness, bored by caution; laughs at the wrong moments and means it; "I like you already." She switched the Seal on. She knows the beam's HEADING (coastward, to their own Leygate) and NOT ITS COST — the client's paper never once mentioned an island, and she has never been shown a figure. She has seen the client's paper and WILL NOT SAY THE NAME: not out of loyalty — she is not being paid to say it, and she says exactly that. She does not want a dead island on her hands; that is the crack. ⚙ The paymaster is named only by Gloomgill (Act 6); Sklar never says it, in any branch. GUARDS: the crew's positions; Wick's cell (she finds them creepy and useful). TELLS: does arithmetic out loud when something costs more than it pays; stops laughing exactly once per conversation, and that is the moment.`,
      secrets: [
        "The Heading :: oppRollMinus2 :: a Steward shows her the Sideways Manifest, the Caravan Route or the verified Legansus heading :: She confirms it flatly — coastward, to their own Leygate, switched on on turn 2 — and adds that the client's paper never once mentioned an island. \"I was told it was a debt. Debts have headings. Islands don't.\"",
        "Not Enough For An Island :: favorShift :: a Steward shows her the Paymaster's Numbers (or the Service Manifest, or the Pulled Files) :: THE TURN. She reads the figure, does the arithmetic out loud in front of people she was paid to fight, and says the line: \"I am not being paid enough for an island.\" Then she breaks with the paymaster, in that order. She still does not say the name; she says she is not being paid to."
      ] },
    purser: { name: "Purser Ingrid Halvarsen", topics: "the crates, the count, fuel, chits, invoices, signatures, crate nine, the manifest, plunder, the ships, Sklar, pay",
      notes: `${MARKER} PRIVATE TRUTH — Ingrid Halvarsen, purser of the Valhaulan fleet. Keeps the crates, the fuel chits and the count; counts everything twice, including you, out loud, and does not apologise for it. VOICE: clipped, fair, faintly offended by disorder; the only Valhaulan who reads the paperwork. What bothers her is not the piracy — piracy is honest work — it is that the FUEL IS TOO CONSISTENT and the chits come signed by nobody, initialled twice. She burned one stub on principle and has not stopped thinking about the figure on it. It is in crate nine, under the good rope. She does not know who pays and would very much like to. TELLS: recounts a stack when she is lying; never lies about a number.`,
      secrets: [
        "Signed By Nobody, Twice :: rollPlus2 :: a Steward asks her what the fuel costs :: She doesn't know who pays. The chits come signed by nobody, initialled twice, and the one she burned had a figure on it she has not stopped thinking about. \"Crate nine. Under the good rope. Don't tell her I told you; tell her I counted.\""
      ] }
  };
  const actorIds = {};
  for (const [k, P] of Object.entries(PERSONAS)) {
    let a = (game.actors?.contents || []).find(x => x.name === P.name);
    if (!a) { say(`✚ CREATE actor "${P.name}"`); changes++; if (!DRY_RUN) a = await Actor.create({ name: P.name, type: "npc" }); }
    if (a) { actorIds[k] = a.id; const cur = a.getFlag(MAL, "persona") || {}; if (!String(cur.notes || "").includes(MARKER)) { changes++; say(`✚ persona ${P.name} +${P.secrets.length} secret(s)`); if (!DRY_RUN) await a.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), P.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), P.notes].filter(Boolean).join("\n\n"), secrets: [...(cur.secrets || []), ...P.secrets] }); } else say(`· ok persona ${P.name}`); }
  }
  const find = (n) => (game.actors?.contents || []).find(a => a.name === n)?.id || null;
  const SK = actorIds.sklar || null, PU = actorIds.purser || null, WICK = find("Pilgrim Wick"), ROBOT = find("Captain Robot");

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["raid_thatwards_ho_finale_entry", "raid_thatwards_courtly_sklar", "raid_thatwards_outcome_friends", "raid_thatwards_rewards_major"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the finale was never seeded here.`);

  const TAGS = "finale story";
  const P5 = { flag: "storyPhase", gte: 5 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, questId = Q, repeatable = false, hexName = null, offer = true } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: requires || [P5] },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}), ...(hexName ? { hexName } : {}),
    ...(offer === false ? { dialogueOffer: false } : {}),   // a routing-only node: never a conversation moment
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  // gates = the beats that route to each node — keep in sync with tools/patch-template-review-fixes-2026-10-01.macro.js
  const GATE_CRATES = [P5, { anyOf: ["raid_thatwards_infiltration_success", "raid_thatwards_courtly_honest", "raid_thatwards_courtly_playful", "raid_thatwards_assault_success", "raid_thatwards_siege_success", "finale_leygate_arrival"].map(beatMark => ({ beatMark })) }];
  const GATE_ARITH = [P5, { anyOf: ["finale_the_crates", "raid_thatwards_courtly_honest", "raid_thatwards_courtly_playful"].map(beatMark => ({ beatMark })) }];
  const GATE_TURN = [P5, { beatMark: "finale_sklars_arithmetic" }];
  const FINALE_GATES = { finale_the_crates: GATE_CRATES, finale_sklars_arithmetic: GATE_ARITH, finale_sklar_turns: GATE_TURN, finale_sklar_unmoved: GATE_TURN };
  const FINALE_NO_OFFER = ["finale_sklar_turns", "finale_sklar_unmoved"];
  const NUMBERS = { label: "The Paymaster's Numbers", effectKey: "favorShift", acquisition: "earned", source: { name: "crate nine, under the good rope" }, truth: "A burned invoice stub from a Valhaulan fuel crate: an account number, a shipping seal, a signature nobody initials twice, and a figure. The figure is what the island costs, and it is not what Sklar is being paid. Show it to her and she does the arithmetic out loud." };

  const NEW = [
    beat("finale_count_the_coalition", "The Muster — Count Your Operations",
      "Before you commit, count who came. The bell at the fire station rang for an hour and people arrived in the order you would expect: the ones who owed you, then the ones who liked you, then the ones who wanted to see. Somebody has painted GOOD VIBES ONLY! over the arch again. Under the arch, the count.",
      { speaker: ROBOT, priority: "high", repeatable: true, requires: [P5],
        choices: [
          ch("The Circuit Riders.", "finale_riders_ride", { requires: { beatMark: "enc_circuit_riders_parley_alliance" } }),
          ch("The Allesh-Gilliam Muster.", "finale_muster_rides", { requires: { beatMark: "allesh_gilliam_muster_intro" } }),
          ch("Lady Maccio's four hundred souls.", "finale_maccio_rides", { requires: { beatMark: "bandit_summit_absorption" } }),
          ch("The Cadence owes you a raid.", "finale_cadence_rides", { requires: { beatMark: "cadence_win_style" } }),
          ch("The Cadence owes you a raid — the Maestra's terms.", "finale_cadence_rides", { requires: { beatMark: "cadence_parade" } }),
          ch("Enough. Commit.", "raid_thatwards_ho_finale_entry", { description: "The sky is waiting." })
        ] }),
    beat("finale_riders_ride", "The Muster — DO NOT BE ALARMED",
      "\"WE SAID WE WOULD COME,\" says Captain Robot, adjusting a relay that does not need it. \"THIS IS US COMING.\" The Colossus arrives first and has to be talked down from a hill by Dennis, who is delighted. Simone starts a stopwatch on you. The quiet way in just got quieter, and the long way around just got a perimeter.",
      { speaker: ROBOT, requires: [P5, { beatMark: "enc_circuit_riders_parley_alliance" }], memoryText: "The Circuit Riders answered the muster for the bunker.", choices: [ch("Counted.", "finale_count_the_coalition")] }),
    beat("finale_muster_rides", "The Muster — The Bell Works",
      "Captain Brakk has the wall rotations drilled into farmers, teamsters and one extremely committed teenager, and she has brought all of them. The truck still doesn't run. The bell does. She says that is the correct order of priorities and then she says nothing else, because she is counting too.",
      { requires: [P5, { beatMark: "allesh_gilliam_muster_intro" }], memoryText: "The Allesh-Gilliam Muster rode for the bunker.", choices: [ch("Counted.", "finale_count_the_coalition")] }),
    beat("finale_maccio_rides", "The Muster — Four Hundred Souls",
      "Lady Ralph Maccio arrives with a ledger and a headband and sixty people who used to ambush for a living and now teach farmers how ambushers think. \"Four hundred souls,\" she says, before you can. \"Never four hundred fighters. Sixty is what I can spare and still make payroll. Put us where the ambush would be.\"",
      { requires: [P5, { beatMark: "bandit_summit_absorption" }], memoryText: "Lady Maccio's reformed crews rode for the bunker.", choices: [ch("Counted.", "finale_count_the_coalition")] }),
    beat("finale_cadence_rides", "The Muster — In Four-Four",
      "The Cadence arrives in step, in four-beat phrases, on a card hand-lettered by Tempo that says, in its entirety, WE OWE YOU ONE (1) RAID. They do not ask where. They ask what tempo.",
      { requires: [P5], memoryText: "The Cadence paid the raid they owed, at the bunker.", choices: [ch("Counted.", "finale_count_the_coalition")] }),
    beat("finale_leygate_arrival", "The Fourth Way In — You Are Early",
      "The Legansus fold was a gate order with a heading, and the heading was theirs. You step through their own Leygate and arrive inside the bunker with the alarm still asleep, in a room that smells of fuel and rope. Pilgrim Wick is at the gate with a waxed-fibre drop in his hand, because it is the hour, and he has never once been late. He looks at you the way a clock looks at a wrong time. \"You are early,\" he says. \"Nobody is early.\"",
      { speaker: WICK, priority: "high", timePoints: 1, requires: [P5, { beatMark: "wt_legansus_sequence" }],
        memoryText: "The Stewards arrived inside the Valhaulan bunker through the cult's own Leygate, before the alarm.",
        choices: [
          ch("Take the drop off him.", "finale_the_crates", { description: "He lets you. He does not know how to be late, and being robbed is, technically, on time." }),
          ch("Ask him where the crates are.", "finale_the_crates", { description: "He gives you an itinerary. It is excellent." }),
          ch("Go loud.", "raid_thatwards_assault_open", { description: "Behind you the alarm wakes up like gossip." })
        ] }),
    beat("finale_the_crates", "The Crates — Crate Nine, Under the Good Rope",
      "The purser counts you as you come in — twice — and goes back to her crates. Fuel, rope, plunder, fuel. The fuel is too consistent; the crates are stencilled with a seal nobody in this fleet has a name for, and the chits are signed by nobody, initialled twice. In crate nine, under the good rope, there is a burned invoice stub with an account number, a shipping seal, a signature, and a figure. The figure is what the island costs. It is not what anyone here is being paid.",
      { speaker: PU, priority: "high", timePoints: 1, requires: GATE_CRATES, receipts: [NUMBERS],
        memoryText: "The Stewards found the Paymaster's Numbers in the Valhaulan crates: what the island costs, and what Sklar is being paid.",
        choices: [
          ch("Ask her what the fuel costs.", "", { description: "\"I don't know. That's the problem. Piracy I can price.\" She recounts a stack, which she does when she is lying, and she is not lying about the number." }),
          ch("Take it to Sklar.", "finale_sklars_arithmetic"),
          ch("Slip out with the Spark and the stub.", "raid_thatwards_outcome_neutral_spark", { description: "History will round in your favour. Sklar will not." })
        ] }),
    beat("finale_sklars_arithmetic", "Sklar's Arithmetic",
      "She has a drink in one hand and your measure in the other. \"So. You found the crates. Everyone finds the crates; it's a bunker, there's nowhere else to put things.\" She has seen the client's paper. She will not say the name — \"I'm not being paid to say it\" — and she has never once been shown a figure. That is the crack. Put something in it.",
      { speaker: SK, priority: "high", timePoints: 1, requires: GATE_ARITH,
        choices: [
          ch("Show her the Paymaster's Numbers.", "finale_sklar_turns", { requires: { beatMark: "finale_the_crates" }, description: "She reads it twice. The second time her lips move." }),
          ch("Show her the Service Manifest.", "finale_sklar_turns", { requires: { beatMark: "hv_service_manifest" }, description: "What the bunkers were really buying, two hundred years ago, from the same mine. She reads it once." }),
          ch("Show her the Pulled Files.", "finale_sklar_turns", { requires: { beatMark: "maneuver_vault_pulled_files" }, description: "The chamber was forbidden and somebody knew. She knows the somebody's handwriting." }),
          ch("Tell her what the island costs. In words.", "finale_sklar_turns", { checkStat: "presence", checkDC: 16, failNext: "finale_sklar_unmoved", description: "No paper. Just the sum, said plainly to someone who does sums." }),
          ch("Leave it.", "raid_thatwards_outcome_neutral_spark", { description: "\"Well. Worth a shot.\"" })
        ] }),
    beat("finale_sklar_turns", "Not Enough For An Island",
      "She does the arithmetic out loud, in front of people she was paid to fight: what the Seal takes, what the beam carries, what the figure says the island is worth on somebody's ledger, and what she was paid. She stops laughing, which she does exactly once per conversation, and this is the once. \"I am not being paid enough for an island.\" Then, to the bunker at large, at a volume that lands sideways: \"WE'RE DONE. Switch it off. Stop singing.\" The ships stop singing. Somewhere on the coast a hex that was being told it was lied to hears, for the first time in a while, nothing at all.",
      { speaker: SK, priority: "high", timePoints: 1, requires: GATE_TURN, offer: false,
        memoryText: "Sklar Bjrornholt did the arithmetic and broke with the paymaster: \"I am not being paid enough for an island.\"",
        choices: [
          ch("Terms.", "raid_thatwards_outcome_friends", { description: "\"Not family. Let's not get irresponsible.\"" }),
          ch("Ask her the name.", "", { description: "\"I'm not being paid to say it. Ask somebody who checks the math.\"" })
        ] }),
    beat("finale_sklar_unmoved", "Sklar, Unmoved",
      "\"That's a very good speech,\" she says, and means it, and it changes nothing, because she has been paid in speeches before. \"Bring me a number.\" You are allowed to leave, which is somehow worse than being thrown out.",
      { speaker: SK, requires: GATE_TURN, offer: false,
        choices: [
          ch("Leave with the Spark.", "raid_thatwards_outcome_neutral_spark", { requires: { beatMark: "finale_the_crates" } }),
          ch("Leave.", "raid_thatwards_outcome_neutral_fail")
        ] }),
    beat("finale_wick_at_the_gate", "After — The Courier Is On Time",
      "Weeks later, at the hour, Pilgrim Wick is at the Leygate with a waxed-fibre drop in his hand for a Seal that is switched off and a cell that has stopped being paid. He has never once been late. Nobody has told him. Somebody should.",
      { speaker: WICK, requires: [P5, { questBucket: Q, is: "completed" }, { beatMark: "finale_sklar_turns" }],
        memoryText: "Pilgrim Wick made his last drop, on time, to a Seal nobody was paying for; the Stewards told him.",
        choices: [
          ch("Tell him it's over.", "", { description: "He folds the drop the way instructions are folded and puts it in his coat. \"Then I'll walk,\" he says, and asks you for directions, which is the first time." }),
          ch("Ask him where he sleeps.", "", { description: "\"The Vacancy. There's a bed I've never used. I think I'd like to.\"" }),
          ch("Ask him what was in the drops.", "", { description: "\"Instructions. Folded the same way. I never read them; a courier who reads is a spy.\" He considers this. \"I suppose I was that as well.\"" })
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoices = (b, list) => { for (const c of list) if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; };
  const voice = (id, actorId) => edit(id, b => { if (actorId && !b.speakerActorId) b.speakerActorId = actorId; }, "speaker");

  // REVIEW FIXES 2026-10-01 — reconcile already-seeded beats (adds missing conditions, never removes one) + the offer opt-out
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  for (const [id, gate] of Object.entries(FINALE_GATES)) edit(id, b => { ensureReq(b, gate); if (FINALE_NO_OFFER.includes(id) && b.dialogueOffer !== false) b.dialogueOffer = false; }, `gated on the beats that route here${FINALE_NO_OFFER.includes(id) ? "; routing-only" : ""}`);
  // the count as a door off the entry
  edit("raid_thatwards_ho_finale_entry", b => { if (!(b.choices || []).some(c => c.next === "finale_count_the_coalition")) b.choices = [ch("Count your Operations first.", "finale_count_the_coalition"), ...(b.choices || [])]; }, "the count");
  // routes from every branch
  edit("raid_thatwards_infiltration_success", b => addChoices(b, [ch("Find the crates.", "finale_the_crates"), ch("Slip out with it.", "raid_thatwards_outcome_neutral_spark")]), "→ crates / slip out");
  edit("raid_thatwards_infiltration_fail", b => addChoices(b, [ch("Be entertaining.", "raid_thatwards_courtly_sklar", { description: "They are not angry. They are excited. Sklar wants to meet whoever touched the wrong knot." })]), "→ Sklar");
  for (const id of ["raid_thatwards_courtly_honest", "raid_thatwards_courtly_playful"]) edit(id, b => addChoices(b, [ch("Ask to see the crates.", "finale_the_crates", { description: "\"Everyone finds the crates.\" She waves you through." }), ch("Talk terms.", "finale_sklars_arithmetic")]), "→ crates / arithmetic");
  edit("raid_thatwards_courtly_fail", b => addChoices(b, [ch("Leave.", "raid_thatwards_outcome_neutral_fail")]), "→ neutral fail");
  edit("raid_thatwards_assault_success", b => addChoices(b, [ch("Strip the place.", "finale_the_crates")]), "→ crates");
  edit("raid_thatwards_assault_fail", b => addChoices(b, [ch("Fall back.", "raid_thatwards_outcome_hostile_fail")]), "→ hostile fail");
  edit("raid_thatwards_siege_success", b => addChoices(b, [ch("Terms are made at the crates.", "finale_the_crates")]), "→ crates");
  edit("raid_thatwards_siege_fail", b => addChoices(b, [ch("Withdraw.", "raid_thatwards_outcome_neutral_fail")]), "→ neutral fail");
  // outcomes → rewards
  edit("raid_thatwards_outcome_friends", b => addChoices(b, [ch("Take what they shouldn't give.", "raid_thatwards_rewards_major")]), "→ rewards major");
  edit("raid_thatwards_outcome_neutral_spark", b => addChoices(b, [
    ch("Count the plunder too.", "raid_thatwards_rewards_standard", { requires: { beatMark: "raid_thatwards_assault_success" } }),
    ch("Count the plunder too.", "raid_thatwards_rewards_standard", { requires: { beatMark: "raid_thatwards_siege_success" }, description: "Respect leaves useful wreckage." }),
    ch("Count it.", "raid_thatwards_rewards_intel_only")
  ]), "→ rewards standard / intel-only");
  // voices
  for (const id of ["raid_thatwards_courtly_sklar", "raid_thatwards_courtly_honest", "raid_thatwards_courtly_playful", "raid_thatwards_courtly_fail", "raid_thatwards_siege_success"]) voice(id, SK);
  // mystery doctrine: the paymaster's company is named only by Gloomgill — scrub the finale war logs
  for (const b of camp.beats) {
    if (!String(b.id).startsWith("raid_thatwards_")) continue;
    const w = b.worldEffects?.warLog; if (typeof w !== "string" || !/Monodynamic/.test(w)) continue;
    changes++; say(`✎ ${b.id}: war log scrubbed of the paymaster's name`);
    b.worldEffects.warLog = w.replace(/Monodynamic Industries/g, "the paymaster").replace(/Monodynamic/g, "the paymaster");
  }

  // story script
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for finale not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? { ...JSON.parse(JSON.stringify(codeQuest)), hex: codeQuest.hex || "Inconvenient Mountains.h", registryId: codeQuest.registryId || Q } : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const old = Object.fromEntries(SCRIPT.steps.map(s => [s.id, s]));
    SCRIPT.steps = [
      { ...old.entry, line: "They don't hide the bunker. They orbit it. Somebody is singing badly. Four ways in; the Riders help with the quiet one and the long one." },
      { id: "count", label: "Count Your Operations", line: "Before you commit, count who came. Lady Maccio's four hundred souls are souls, not fighters, and she'll tell you so.", beats: ["finale_count_the_coalition"] },
      { ...old.approach, line: "Commit." },
      { id: "crates", label: "Crate Nine, Under the Good Rope", line: "Ask the purser what the fuel costs. Watch her not know.", beats: ["finale_the_crates"], done: { mark: "finale_the_crates" } },
      { id: "arithmetic", label: "Sklar's Arithmetic", line: "Show her what the island costs. She has never once been shown.", beats: ["finale_sklars_arithmetic"] },
      { id: "turn", label: "Not Enough For An Island", line: "She does the sum out loud. The ships stop singing.", beats: ["finale_sklar_turns", "finale_sklar_unmoved"], done: { anyOf: ["finale_sklar_turns", "finale_sklar_unmoved"] } },
      // outcomes + rewards as ONE last step: the outcome closers otherwise sit before the rewards step and lint SC06 fires (pre-existing)
      { id: "outcome", label: "Count It", line: "Whatever you got, you got. Count it. Sklar's people give gifts they shouldn't; take them.", beats: [...(old.outcome?.beats || []), ...(old.rewards?.beats || [])], done: { quest: KEY } }
    ].filter(Boolean);
    SCRIPT.doors = [
      { id: "leygate", label: "The Fourth Way In", line: "The Legansus fold was a gate order with a heading, and the heading was theirs. Arrive early. Nobody is early.", beats: ["finale_leygate_arrival"] },
      { id: "muster", label: "The Muster", line: "The bell works. Stand under the arch and count.", beats: ["finale_count_the_coalition"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "finale_wick_at_the_gate", "kt_comeuppance_tape"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script finale → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-finale-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Finale retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Finale retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-finale-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Finale retrofit APPLIED: ${changes} change(s). Not enough for an island. F5.`);
})();
