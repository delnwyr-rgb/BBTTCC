/* seed-geburah-confer.macro.js — THE STATUES CONFER
 * 2026-08-18. Ref: LOST-STATUES-ART-REFERENCE-2026-08-17.md
 *
 * Canon already said they knew. The fragment beats say "somewhere in the
 * distance, something old and martial decides you may not be a joke after
 * all", and "the certainty that Geburah noticed how you solved this problem",
 * and "it merely judges it". Three graders who compare notes about you.
 * This makes the knowing mechanical.
 *
 * Their faces are weathered away — no mouths — so they never address the
 * party. They talk to EACH OTHER, in the channels canon already gives them:
 * heat off the stone, ember-light, water going red and then clear. You are
 * simply standing close enough to catch it.
 *
 * PAIRS WITH the engine's conduct ledger (module.js, 2026-08-18):
 *   geburahEarned / geburahForced — 0-3 each, incremented automatically when
 *   a fragment outcome beat resolves (the six *_worthy / *_force ids).
 *
 * WHAT THIS SEEDS (5 gated director beats — no existing beat is modified):
 *  · two arrival-conferences at the SECOND statue (clean vs bloodied)
 *  · two arrival-conferences at the THIRD (unanimous vs divided)
 *  · one verdict variant after the Spark is made whole, for the all-force
 *    run — the case the single existing "Geburah Made Whole" text serves
 *    least well, since it was written to cover everything.
 * The third-statue conferences carry THE GARDEN LINE: a hundred of their kind
 * standing very still, somewhere west. Offered, never explained. It touches
 * none of the Founders' Garden owner slots — the statues are witnesses of the
 * same kind who never went, so they can gesture without answering.
 *
 * DRY_RUN default true. Idempotent. Backs up campaigns before writing. GM only.
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const Q  = "quest_jivVj3iGErW53Wxl";  // The Lost Stone Statues
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const confer = (id, label, description, requires) => ({
    id, label,
    questId: Q,
    type: "dialog", timeScale: "scene", timePoints: 0,
    tags: "spark.geburah quest.lost_stone_statues confer story",
    politicalTags: "",
    description,
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: false, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires
    },
    actors: [],
    choices: [{ label: "Say nothing.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {},
    playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    storyChain: "geburah_confer", priority: "high"
  });

  const BEATS = [
    // ── arriving at the SECOND statue ──────────────────────────────────────
    confer("spark_geburah_confer_2_clean", "The Second Statue Has Heard",
      "You are still forty feet out when the pool at its feet goes warm. Not hot — warm, the way a room is warm when someone has been waiting in it.\n\nThe kneeling statue does not move, because it does not move. But the blade across its lap is no longer quite at the angle it was in the approach, and the heat coming off the stone arrives in a rhythm, and the rhythm is not weather.\n\nIt is being told something. About you. By something a long way east, in a shallow basin on the open plains, that watched you keep your hands still when it would have been easier and far more satisfying not to.\n\nWhatever is being said, the second statue receives it, and then the pool cools by exactly one degree, and the wind starts up again, and you are being permitted to climb.",
      [{ flag: "geburahEarned", gte: 1 }, { flag: "geburahForced", lte: 0 }]),

    confer("spark_geburah_confer_2_bloodied", "The Second Statue Has Also Heard",
      "The pool at its feet is warm before you reach it, and the warmth has an edge on it, like a held breath in a room where an argument just stopped.\n\nThe kneeling statue does not move. But the heat coming off the stone arrives in a rhythm that is not weather, and it is receiving a report — from a shallow basin a long way east, from something that erupted in violent red light and was cracked open and has opinions about the hand that did it.\n\nNothing here refuses you. The climb is exactly as available as it was going to be. It is simply that the second statue now knows precisely what you are willing to do when a thing does not open on the first ask, and it has arranged its blade accordingly.\n\nThe wind, when it starts again, is noticeably colder.",
      [{ flag: "geburahForced", gte: 1 }]),

    // ── arriving at the THIRD statue — carries THE GARDEN LINE ─────────────
    confer("spark_geburah_confer_3_unanimous", "Two Voices, Agreeing",
      "The dark water is already lit when you come over the ridge — a deep red glow under the surface, unhurried, coming from the chest of a statue you cannot yet see.\n\nTwo reports arrive while you descend. The plains and the mountain pool, east and above, both saying the same thing about you in whatever grammar this is, and the submerged one listening the way a third judge listens when the first two have agreed and it must now decide whether agreement is enough.\n\nAnd then something else, unasked for, and not about you at all — a long slow pulse westward, out past the coast, where (the impression arrives whole, the way weather does) **a hundred more of their kind are standing very still.** Have been. For a long time. The submerged statue holds that direction a moment longer than it holds you.\n\nThen the glow settles, and it is your turn.",
      [{ flag: "geburahEarned", gte: 2 }]),

    confer("spark_geburah_confer_3_divided", "Two Voices, Disagreeing",
      "The water is lit before you reach it, and the light is not steady. It pulses — irregular, arguing with itself, the deep red going briefly harder and then easing, twice, three times.\n\nTwo reports have arrived and they do not match. One of the fragments came to you open-handed and one came out of a cracked basin, and the submerged statue is being asked to reconcile an account of somebody who is apparently both of those people. It takes its time. You stand in cold water up to the shins while something without a face decides what you are.\n\nAnd then, mid-deliberation, its attention goes elsewhere entirely — westward, past the coast, a long slow pulse toward **a hundred more of their kind standing very still**, and the impression that arrives with it is not information. It is closer to *comparison.*\n\nThe light steadies. Whatever it concluded, it has concluded.",
      [{ flag: "geburahEarned", gte: 1 }, { flag: "geburahForced", gte: 1 }]),

    // ── the verdict the single existing text serves least well ─────────────
    confer("spark_geburah_verdict_taken", "Made Whole — and Answerable to Nobody",
      "Three fragments align, and the air tastes of iron, and the Spark of Geburah gathers itself out of three separate thefts.\n\nIt is whole. It works. It is, by every measure anyone could apply, a success — and it sits in your keeping the way a confession sits in a drawer. Not resentful. Not withholding. Simply *aware*, in the specific way of a thing that was taken three times by the same hand and noticed each one.\n\nSomewhere east, a basin cools. Above the road, a pool goes still. Down in the dark water, the last of them stops glowing, and none of the three will ever grade anybody again, because there is nothing left to grade with.\n\nStrength is only sacred when it is answerable. You have assembled a great deal of strength. ⚙ GM: this fires INSTEAD of the standard verdict when all three came by force — let it land quietly, and do not soften it. The Spark still works. That is the point.",
      [{ beatMark: "spark_geburah_reconstituted", quest: Q, state: "seen" }, { flag: "geburahForced", gte: 3 }])
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++;
    const req = nb.inject.requires.map(r => r.flag ? `${r.flag}${r.gte != null ? "≥" + r.gte : "≤" + r.lte}` : `${r.beatMark} seen`).join(" AND ");
    report.push(`✚ ${nb.id}  [${req}]`);
  }

  report.push("— ledger: geburahEarned / geburahForced, auto-incremented by the six *_worthy / *_force beats (engine, 2026-08-18)");
  console.log(`[seed-geburah-confer] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Geburah Confer DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Geburah Confer: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-geburah-confer-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Geburah Confer APPLIED: ${changes} change(s). They compare notes.`);
})();
