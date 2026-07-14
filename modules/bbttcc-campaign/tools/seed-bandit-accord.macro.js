/* seed-bandit-accord.macro.js — THE BANDIT ACCORD: mercy is a ledger
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §3 + owner decisions #1–#3:
 *  all four summit doors · bandit country = THE DROWNED SOUTH (swamp bandits) ·
 *  ledger arms only after the opening beat announces the theme)
 *
 * Pairs with the mercy-ledger engine in campaign module.js (banditMercy /
 * banditFear world meters, reed-telegraph cards, arms-down auto-offer at
 * rung ≥ 3). This seeder authors the STORY surface:
 *
 *  · quest registry: quest_bandit_accord "The Bandit Accord" (container).
 *  · director bridges (storyChain bandit_accord, GM veto on the turn tick):
 *      bandit_accord_opening  — announces the theme, ARMS the ledger (engine)
 *      bandit_word_spreads    — rung 1 (mercy ≥ 2)
 *      bandit_volunteers      — rung 2 (mercy ≥ 3 + militia quest active)
 *      bandit_envoy           — rung 4 (mercy ≥ 6) → routes to the summit
 *  · the arms-down variant (rung 3, fired BY THE ENGINE when an ambush hits):
 *      bandit_ambush_arms_down → accept (mercy ×2) / violence (reset, travels)
 *  · the summit set-piece + ALL FOUR doors (each completes the quest):
 *      bandit_summit → _accord / _absorption / _humiliation / _refuse
 *    ⚠ THE ACCORD DOOR: minting the Bandit Lord's faction actor is an OWNER
 *    action at signing (like all actor minting); support-faction alignment +
 *    camp waypoint hexes on the Drowned South scene wire by name AFTERWARD.
 *
 *  The DRY run also inventories every /^enc_bandit/ beat id in the live
 *  corpus so the engine's mercy/fear id-pattern coverage can be eyeballed.
 *
 * All beats carry explicit timePoints (Turn Ledger). DRY_RUN default true;
 * idempotent (skips existing ids); backs up the campaigns setting. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const Q_ACCORD  = "quest_bandit_accord";
  const Q_MILITIA = "quest_ag_town_militia";   // Allesh-Gilliam — The Town Militia
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

  // ── corpus inventory: what bandit encounter beats actually exist ──────────
  const encBandit = camp.beats.filter(b => /^enc_bandit/i.test(b?.id || "")).map(b => b.id);
  report.push(`🔎 live /^enc_bandit/ corpus (engine counts free|jail=mercy, kill=fear): ${encBandit.length ? encBandit.join(", ") : "(none found?!)"}`);

  // ── quest registry ────────────────────────────────────────────────────────
  if (!quests[Q_ACCORD]) {
    quests[Q_ACCORD] = {
      id: Q_ACCORD, v: 1, name: "The Bandit Accord",
      description: "The party keeps sparing bandits, and the Drowned South keeps count. Word travels through the reeds; the spared loiter near the Muster looking employable; ambushes start surrendering before the roll. Somewhere out past the stilt-camps, a Bandit Lord is bleeding personnel to your mercy — and arithmetic like that eventually writes a letter. How this ends (banner, muster, boot, or nothing) is up to the summit.",
      tags: [], createdTs: 0, updatedTs: 0
    };
    changes++; report.push("✚ quest registered: The Bandit Accord");
  } else report.push("· ok quest (already) The Bandit Accord");

  // ── director bridge shape (spine pattern) ─────────────────────────────────
  const bridge = (id, label, description, { requires = null, priority = "background", timePoints = 0, questEffects = null, choices = null } = {}) => ({
    id, label,
    type: "dialog",
    timeScale: "scene",
    timePoints,
    tags: "bandit_accord story",
    politicalTags: "",
    description,
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: false, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      ...(requires ? { requires } : {})
    },
    actors: [],
    choices: choices || [{ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {},
    playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    storyChain: "bandit_accord",
    priority,
    ...(questEffects ? { worldEffects: { questEffects } } : {})
  });

  // Plain (non-director) beat — fired by engine/choices, never offered.
  const plain = (id, label, description, { timePoints = 0, choices = null, questEffects = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    description,
    ...(questEffects ? { worldEffects: { questEffects } } : {}),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  const BEATS = [
    // ── the opening: announces the theme, arms the ledger (engine latch) ─────
    bridge("bandit_accord_opening", "The Drowned South Keeps Count",
      "It starts as road gossip and refuses to stay that way. The bandits of the Drowned South — punt-raiders, reed-whistlers, toll-takers of the sunken causeways — have started telling a story about you. Not the usual one, where the well-armed strangers do what well-armed strangers do. A WEIRD one: that you let people walk. That there were bandits who stood in front of you, wrong side of the argument, and are somehow still eating breakfast. In the swamp, where everyone is one bad season from a punt and a mask, that story has legs. The reeds are listening now. What you do next gets COUNTED.",
      { priority: "background", timePoints: 0,
        questEffects: [{ action: "accept", questId: Q_ACCORD, text: "The reeds have started counting acts of mercy. Something out there is doing arithmetic." }] }),

    // ── rung 1: word spreads (mercy ≥ 2) ─────────────────────────────────────
    bridge("bandit_word_spreads", "The Stewards Take Prisoners. Alive Ones.",
      "The story has a shape now, and the shape is a RUMOR OF POLICY. Down the drowned causeways they're saying it plain: surrender to the Stewards and you get a warning, maybe pointers, occasionally soup. Two spared bandits have been seen loitering within sight of the Muster in Allesh-Gilliam — not casing it, just… orbiting, the way you orbit a job you don't know how to ask for. One left a cleaned fish on a waypost. In the Drowned South, that's a formal document.",
      { requires: { flag: "banditMercy", gte: 2 }, timePoints: 0 }),

    // ── rung 2: volunteers (mercy ≥ 3, militia standing) ─────────────────────
    bridge("bandit_volunteers", "The Muster Gets a Queue",
      "They came at dawn, because dawn is when you show up for WORK: former bandits, hats in hands, boots scrubbed nearly to regulation, forming what can only be called a queue outside the Muster — orderly, because Captain Brakk saw it coming and made a SIGN. They want in. Wall shifts, drills, the bell, all of it. Brakk has opened a second column in her ledger and titled it in block capitals she'd deny were proud: REFORMED. The Good Vibes Club is becoming a fire station is becoming a recruitment station, exactly as the building always intended.",
      { requires: [{ flag: "banditMercy", gte: 3 }, { questBucket: Q_MILITIA, is: "active" }], timePoints: 0 }),

    // ── rung 3: the arms-down variant (FIRED BY THE ENGINE, never offered) ───
    plain("bandit_ambush_arms_down", "Ambush — Arms Down in the Reeds",
      "The reeds part, the punts slide out, the masks come up — and then the whole choreography falls apart. Their point man looks at you, looks at his spear, and makes a decision fifteen years of swamp-banditry did not prepare him for: he sets it down in the mud, deliberately, like it's someone else's. 'We yield.' A beat. Hands rise behind him, one pair at a time, reed-slow. 'Is the program still open?' They surrendered BEFORE the roll. The story got here first.",
      { type: "dialog", timePoints: 0, choices: [
        { label: "Take the surrender — the program is open", next: "bandit_arms_down_accept" },
        { label: "No quarter", next: "bandit_arms_down_violence" }
      ]}),
    plain("bandit_arms_down_accept", "Arms Down — The Program Is Open",
      "You point them toward Allesh-Gilliam and the Muster's intake desk, and they nod like men being handed directions to a rumor they'd stopped letting themselves believe in. One asks, shyly, if the soup part is true. The reeds carry the whole scene south by nightfall — the yield, the walk, the SOUP — and in the stilt-camps the arithmetic gets harder to argue with. Mercy, witnessed at spear-point, counts double.",
      { timePoints: 0, memoryText: "An ambush yielded before the roll and the Stewards honored the program. The reeds counted it twice." }),
    plain("bandit_arms_down_violence", "Arms Down — And You Struck Anyway",
      "They had their hands UP. The reeds go very quiet, and then very loud, and the story that travels south tonight is not about policy. In the stilt-camps they will tell it with names in it. The count doesn't go to zero — the spared are still spared, the fed still fed — but the program's credit is broken back to rumor, and somewhere a Bandit Lord who was drafting a letter sets the pen down and reaches for the older ledger. Fear keeps its own column now.",
      { timePoints: 0, memoryText: "A surrendered ambush was cut down with hands raised. The reeds will not forget who taught them the old arithmetic still runs." }),

    // ── rung 4: the envoy (mercy ≥ 6) → routes to the summit ─────────────────
    bridge("bandit_envoy", "The Envoy — A Letter Under a White Rag",
      "The punt comes up the channel at midday, dead slow, under a white rag on a fishing pole — maximum visibility, minimum sudden movements, a masterclass in please-don't. Aboard: one lieutenant of the Drowned South, middle-aged, courteous, terrified in the specific way of a man whose retirement plan has been dissolving for months. He salutes the Muster. He salutes a passing goat. He presents a letter in a waxed eel-skin pouch, sealed with candle-stub wax: the Bandit Lord of the Drowned South requests a summit, at a neutral stilt-hall of your choosing, to discuss — his phrasing — 'the future of the profession.' The lieutenant will wait for an answer. He has brought his own rations so as not to impose. They are eel jerky. He offers you some.",
      { requires: { flag: "banditMercy", gte: 6 }, priority: "high", timePoints: 0, choices: [
        { label: "Convene the summit", next: "bandit_summit", description: "", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Send him back (for now — the offer keeps)", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }
      ]}),

    // ── THE SUMMIT (set-piece, 1 day) + all four doors ───────────────────────
    plain("bandit_summit", "The Summit at the Stilt-Hall",
      "The stilt-hall stands where three channels argue, and tonight it holds more retired ambushes per square foot than anywhere in the world. Punts moored three deep. Reed-whistles calling the all-clear in a code everyone pretends the other side doesn't know. And at the head of the long table: the Bandit Lord of the Drowned South — not a warlord, you realize within a minute, but a MANAGER, over-extended in the way of a man who inherited three crews, married into two more, and has been paying out survivor pensions from a shrinking toll base for years. He has BOOKS. He shows you the books, unprompted, like a confession. 'You're hiring away my people,' he says, without rancor, 'with SOUP. I'd be angry if I weren't so relieved. So let's talk about what the Drowned South does next, because I have four hundred souls on punts, and you have a program, and one of us is the future. I'd like to negotiate which.'",
      { type: "dialog", timePoints: 1, choices: [
        { label: "Sign the Accord — a banner, allied", next: "bandit_summit_accord" },
        { label: "Absorb them — one Muster, no banner", next: "bandit_summit_absorption" },
        { label: "Take the surrender — no seat at the table", next: "bandit_summit_humiliation" },
        { label: "Refuse — no deal today", next: "bandit_summit_refuse" }
      ]}),
    plain("bandit_summit_accord", "The Accord — A New Banner in the Drowned South",
      "You sign it on the long table with the whole swamp watching, and the Bandit Lord signs like a man setting down something heavy. The terms are almost embarrassingly reasonable: amnesty for the program's graduates, safe-conduct on the causeways, the camps opened as waypoints, and the punts — all four hundred souls of them — flying one banner, ALLIED, patrolling the water-roads they used to tax. The reed-whistles change codes that night; the new one means 'friendly coming through.' ⚠ GM: mint the Bandit Lord's faction actor now (owner action, like all minting) — support-faction alignment, Allied Send, and camp waypoint hexes on the Drowned South scene wire by name afterward.",
      { timePoints: 0, memoryText: "The Bandit Accord is signed. The Drowned South flies a banner now, allied, and the causeways have safe-conduct whistles.",
        questEffects: [{ action: "complete", questId: Q_ACCORD, state: "completed", text: "The Accord signed — the bandits of the Drowned South are a faction, allied, patrolling on the players' behalf." }] }),
    plain("bandit_summit_absorption", "Absorption — One Muster, Bigger",
      "No banner, no treaty — an INTAKE SCHEDULE. The crews come in over a season, punt by punt, through Brakk's desk and Brakk's sign and Brakk's second ledger column, which now needs a second PAGE. The Muster doubles. The wall rotations finally have depth. And the Bandit Lord, pensioned off in the only currency that interests him — a settled retirement for his people — takes over the bar at the Good Vibes Club, where he pours measures with a bookkeeper's precision and tells anyone who asks that he is OUT of the profession, and then tells them the profession's stories until closing.",
      { timePoints: 0, memoryText: "The bandits folded into the Muster — one roster, no banner. The Bandit Lord runs the Good Vibes Club bar now, precisely.",
        questEffects: [{ action: "complete", questId: Q_ACCORD, state: "completed", text: "Absorption — the crews joined the militia; the Muster doubled; the Lord retired to the bar." }] }),
    plain("bandit_summit_humiliation", "Humiliation — No Seat at the Table",
      "You take the surrender and give nothing back: no seat, no terms, no banner, no bar. The Bandit Lord signs the instrument of it with a steady hand — he's a bookkeeper, he knows a bad quarter when he's IN one — and the ones who came in with him get the program's soup and the program's wall shifts. But the swamp keeps a remainder. The crews that never trusted the count melt back into the reeds with everything they own, and the whistle-code that used to mean 'toll ahead' means something colder now. The Drowned South's spare change just became splinter cells.",
      { timePoints: 0, memoryText: "The surrender was taken, no seat given. The remnant splintered into the reeds — fear inherits what mercy leaves on the table.",
        questEffects: [{ action: "complete", questId: Q_ACCORD, state: "completed", text: "Humiliation — the surrender taken, no seat at the table; the remnant went splinter." }] }),
    plain("bandit_summit_refuse", "Refusal — The Long Way Around",
      "No deal today. The Bandit Lord nods slowly, closes his books, and thanks you — actually thanks you — for the soup his people got and will presumably keep getting, one surrendered ambush at a time. Which is the thing: NOTHING STOPS. The volunteers keep coming. The queue at the Muster keeps forming. The toll base keeps shrinking, and the pension math keeps not working, and the whole Drowned South keeps solving itself in your direction, just slower now, and sadder, one punt at a time, without anyone ever having signed anything.",
      { timePoints: 0, memoryText: "The summit ended without a deal. The program keeps hiring the swamp away anyway — slower, sadder, one punt at a time.",
        questEffects: [{ action: "complete", questId: Q_ACCORD, state: "completed", text: "Refused — status quo, except the volunteers keep coming. The problem solves itself, slowly." }] })
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id} (${nb.timePoints}d${nb.inject?.requires ? ", gated" : ""})`);
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[seed-bandit-accord] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Bandit Accord DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Bandit Accord: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-bandit-accord-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Bandit Accord APPLIED: ${changes} change(s). The reeds are counting.`);
})();
