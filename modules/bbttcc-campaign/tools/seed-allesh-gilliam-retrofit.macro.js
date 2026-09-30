/* seed-allesh-gilliam-retrofit.macro.js — ALLESH-GILLIAM to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/ALLESH_GILLIAM_RETROFIT_2026_09_27.md (Dave 2026-09-25: "apply the template to the rest — richer conversations,
 * hand-off beats"), bible §9 ("Tamsin's chapter becomes the spy arc: catch → relief → double → pipeline → Pactkeeper. Etta's
 * Long Market becomes where the caravan route surfaces").
 *
 *  1. ARMED SECRETS for the existing cast (Pike, Tamsin, Wick, Greeley, Plumb, Garren, Verna, Etta, Brakk) — from their own
 *     PRIVATE TRUTH notes, in the talk-to-it format. Actors are found by name and never created; Tamsin's notes gain a voice block.
 *  2. THE CONFESSOR'S DEBT → the spy arc: 3 new beats (drip tray, the pilgrim, "I am relieved") + 2 fail landings; the confrontation's
 *     four verdicts move to the relief beat; the three channel-preserving verdicts gain "Run it backward."
 *  3. THE PIPELINE — new chapter (registry quest_ag_pipeline): backward → Etta's market (receipt THE CARAVAN ROUTE) → Pactkeeper /
 *     route-only. 6 new beats.
 *  4. The FULL Allesh-Gilliam script (arrival + errands + both chapters' steps + polished doors) written to campaign.story, and the
 *     data quest def with the new chapter.
 *
 * Nothing in the Debt has been played live (checked against save 0k2fikz9ehvr). Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "allesh_gilliam", Q_MAIN = "quest_Cq1v3hJpXarX5rXJ", Q_DEBT = "quest_ag_confessors_debt", Q_PIPE = "quest_ag_pipeline", Q_MILITIA = "quest_ag_town_militia";
  const MARKER = "[AG-RETROFIT-2026-09-27]";
  const SCENES = { church: "SNenbFtoUm9jv5uE", vacancy: "5hxWnWm1sawwC3Ch", market: "q9zMsGlxPRjewuhw" };
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. armed secrets (existing actors only) ────────────────────────────────
  const SECRETS = {
    "Marshal Yarrow Pike": [
      "The Signature :: oppRollMinus2 :: a Steward puts the name on the flicker report in front of him, or asks whether he has ever READ the signature :: He has not. He could in five minutes. He has chosen, for years, not to, because the day he reads it he has to do something about it and he does not trust what. He goes very quiet, and then he goes to the Leygate alone.",
      "The Plumb Math :: rollPlus2 :: a Steward asks the DATE on Plumb's survey instead of whether it is right :: Three days before the Cough. 'Cosmetic' has been standing on a survey older than the lean. He has known all along; the town can afford exactly one crisis of authority at a time, and he has been waiting for someone else to force the re-survey."
    ],
    "Father Tamsin": [
      "The Kettle :: stirThePot :: a Steward asks what Wick CALLS the Seal, or asks Tamsin to explain one of his own metaphors :: \"He calls it the kettle. I don't know why. I never asked. I should have asked.\" Every code word in the channel is a household object, because the man who chose them is bad at metaphor and knows it. Say 'the kettle' to Wick and he answers as if to Tamsin.",
      "The Gate Had a Name :: rollPlus2 :: a Steward asks whether the gate at Khezek Tor had his name on it :: \"Mountains remember how they're treated.\" He changes the kettle. In another life the healer of the family that ran the mine turned a stranger away when there was plenty; the debt is older than this body, and the dark under the mountain knew it by name."
    ],
    "Pilgrim Wick": [
      "The Kettle Answers :: oppRollMinus2 :: a Steward says 'the kettle' to him, as a greeting or a question :: He answers as if to Tamsin: the schedule, the heading, the next collection. Tradecraft — the candle talks, not the men; he does not know Tamsin's name for certain and has never spoken to him. Then he recites pilgrimage scripture and asks to be allowed to continue on foot.",
      "Never Late :: rollPlus2 :: a Steward asks what he is proud of :: Nothing except this: he has never once been late. Not to St Gilliam's at dusk, not to the switchbacks by the second morning, not to the camp coastward on the third. Ask him what the camp is proud of and he does not understand the question."
    ],
    "\"Doc\"Vess Greeley": [
      "The Good Room :: oppRollMinus2 :: a Steward asks what the back room is FOR now, not what happened in it :: A rematch. She keeps it surgical-clean because she expects the bad night to come back. The roster from that night is in the drawer under the suture kit; it lists who was hurt, and one man who was not on the shift.",
      "Who She'd Have Let Go :: rollPlus2 :: a Steward asks whether there was ever a night with two patients and one pair of hands :: She finished a stitch in the dark and the patient lived, and she had already chosen, in the dark, who she'd have let go if it came to two. The patient was Father Tamsin's brother. She changes the drink."
    ],
    "Aldous Plumb": [
      "The Levee :: rollPlus2 :: a Steward proves a fault in one of his drawings WITHOUT humiliating him :: Every drawing on his walls is the same upriver levee-gate wearing a different building's face. It held thirty years and failed in one night, and the failure was a line he drew where he WANTED the ground to be. He has been redrawing it from memory ever since, hunting the lie.",
      "Three Days Before :: oppRollMinus2 :: a Steward asks him to date the East Wall survey out loud :: He dates it. Then he hears it. The survey predates the lean, and the Cough, by three days, and 'cosmetic' has been standing on it since. He will not say the word 'wrong'; he will re-survey at 3am and leave the new survey on Pike's desk with no note."
    ],
    "Garren, Leygate Engineer": [
      "Unit Is Serviceable :: oppRollMinus2 :: a Steward helps him carry something heavy, then asks what the previous report said :: He quotes it verbatim, flat: 'unit is serviceable and may be expected to perform within tolerances for the coming season.' He signed it eleven days before the Cough because the parts weren't coming and somebody had to write something. Pike has never read the signature.",
      "Not For This Gate :: rollPlus2 :: a Steward shows him a seven-position sequence from the channel :: \"That's an activation order.\" He reads it twice. \"Not for this gate.\" He can say what a gate that takes it looks like and roughly which way it faces: coastward, sideways, the way a Valhaulan ship lands."
    ],
    "Verna Tulliver": [
      "The Little Star :: rollPlus2 :: a Steward asks what the little stars in the ledger MEAN, not who they are for :: A star is a fake name. She'll say who used one, never why; that's the guest's business and business is sacred. The pilgrim who pays exact and never sleeps in the bed has a star. So does one other guest, and that one's name cannot be read by anyone.",
      "The Ninth Guest :: stirThePot :: a Steward is kind and genuinely curious about the ledger, and asks about the page nobody can read :: Nine guests the night the world ended, eight when it came back, and nobody, including the eight, remembers the ninth. The name slides off the mind. She has copied it forty-one times. Connect it to standing stones and she goes very still: \"room's on the house tonight.\""
    ],
    "Etta Bloom": [
      "The Camp That Isn't on Any Map :: oppRollMinus2 :: a Steward asks WHICH stall buys forty pounds of salt and no meat, or candle wax in tallow country :: She has known for a season. Third stall from the east end, the rope stall that never sells rope; every third market a Jackalope wagon loads there for a camp two days coastward that is on no map. She has already adjusted inventory for it. She sells you preserves first; the question is answered when the jar is paid for.",
      "Which Two Doors :: rollPlus2 :: a Steward asks which two of the three doors (restore, redirect, break) she has already adjusted inventory for :: She smiles and sells you preserves. Behind the smile: she is Menhirkin, the 'old mistakes buried nearby' are KIN, and she has stocked for the two doors where somebody pays. Nobody has stocked for 'no one owes anyone anything', because nobody knows what that costs."
    ],
    "Ondine Brakk": [
      "The Real Number :: rollPlus2 :: a Steward who has PERSONALLY stood a wall shift asks how many hours the town can actually hold :: She tells them the number. It frightens her, which is why she drills farmers. The truck that doesn't run she could fix in an afternoon; the militia needs a shared enemy that can't fight back, and the truck volunteers."
    ]
  };
  const TAMSIN_VOICE = `${MARKER} VOICE (bible §5/§8) — Father Tamsin is a spy who is bad at metaphor and worse at spying, and knows both. He reaches for a metaphor, hears it fail, and says so ("I am bad at metaphor, by the way. As bad as … something that is very bad at something"). Every code word in Wick's channel is a household object ("the kettle" = the Seal) because Tamsin chose them. He is RELIEVED to be caught: when the confrontation lands he says "I am relieved" and means it; the half-second pause goes out of his voice from that moment. If the Stewards run his channel backward he translates faithfully and apologises for the code. If he is shown the grief towns' receipts (the rental slip, the birthday card, the parade permit) he reads each twice, sits down on the floor of his own church, and says he will walk to the coast and count the Garden. A man who finally reads the terms is a PACTKEEPER, not a confessor.`;
  const actorIds = {};
  for (const [name, lines] of Object.entries(SECRETS)) {
    const actor = (game.actors?.contents || []).find(a => a.name === name);
    if (!actor) { say(`✗ actor "${name}" not found — secrets skipped`); continue; }
    actorIds[name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    const raw = String(cur.secretsRaw || "");
    const fresh = lines.filter(l => !raw.includes(l.split("::")[0].trim()));
    const next = { ...cur };
    let touched = false;
    if (fresh.length) { next.secretsRaw = [raw.trim(), ...fresh].filter(Boolean).join("\n"); touched = true; }
    if (name === "Father Tamsin" && !String(cur.notes || "").includes(MARKER)) { next.notes = [String(cur.notes || "").trim(), TAMSIN_VOICE].filter(Boolean).join("\n\n"); touched = true; }
    if (!touched) { say(`· ok persona ${name}`); continue; }
    changes++; say(`✚ persona ${name} +${fresh.length} secret(s)${name === "Father Tamsin" ? " + voice" : ""}`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", next);
  }
  const sp = (n) => actorIds[n] || null;

  // ── 2. registry: the new chapter quest ─────────────────────────────────────
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw || {});
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  let questsChanged = false;
  if (!quests[Q_PIPE]) {
    quests[Q_PIPE] = { id: Q_PIPE, v: 1, name: "Allesh-Gilliam — The Pipeline", status: "active", campaignId,
      description: "Father Tamsin's channel runs the other way now. Three things come down the mountain: a supply run for a camp on no map, a rumor about lights over the coast, and a fold that is an activation sequence. Etta already knows which stall loads the wagon. She will sell you preserves first.",
      tags: [], createdTs: Date.now(), updatedTs: Date.now() };
    questsChanged = true; changes++; say("✚ quest registered: Allesh-Gilliam — The Pipeline");
  } else say("· ok quest (already) The Pipeline");

  // ── 3. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["ag_confessor_dead_drop", "ag_tamsin_confrontation", "ag_confessor_redeemed", "ag_confessor_pike", "ag_confessor_counterfeit", "allesh_gilliam_etta_bloom_convo_exit"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Confessor's Debt was never seeded here.`);

  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, story = null, requires = null, timePoints = 0, priority = "background", memoryText = null, questEffects = null, factionEffects = null, questId = Q_DEBT, tags = "allesh_gilliam confessors_debt story", scene = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority,
    ...(scene ? { sceneId: scene } : {}),
    ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY, chapter: "the_confessor_s_debt" },
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(questEffects ? { questEffects } : {}), ...(factionEffects ? { factionEffects } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const P2 = { flag: "storyPhase", gte: 2 };
  const DEBT_ACTIVE = [P2, { questBucket: Q_DEBT, is: "active" }];
  const PIPE = { quest: KEY, chapter: "the_pipeline" };
  const PIPE_TAGS = "allesh_gilliam pipeline story";
  const COALITION = ["6H5Grt3HybAs1rSq", "eIXghZ73hKSXmP3x"];   // the Errata Society, Sweet Release — as the existing verdict beats address them
  const fx = (loyalty = 0, unity = 0) => COALITION.map(factionId => ({ factionId, moraleDelta: 0, loyaltyDelta: loyalty, unityDelta: unity, darknessDelta: 0, opDeltas: {}, allowOvercap: false }));

  const NEW = [
    // ── the Debt, spy-arc steps 2–3 + the turn ──
    beat("ag_confessor_drip_tray", "Allesh-Gilliam — The Drip Tray",
      "Waxed fiber, folded small, half-drowned. You know the fold: it's the fold Etta's sigil came in. Inside, in a neat hand you have seen on a bed-and-breakfast chalkboard, a schedule — which days the kettle is checked, which nights the pilgrim collects. And under the schedule, a note for the courier's masters, which begins <i>the mountain is tired, the way a lamp is tired, a very tired lamp,</i> and stops, and starts again with <i>forgive the metaphor</i>.",
      { type: "exploration", requires: DEBT_ACTIVE, scene: SCENES.church, choices: [
        ch("Unfold it without tearing it.", "", { checkStat: "mind", checkDC: 12, failNext: "ag_confessor_drip_tray_fail", description: "The schedule names a 'kettle' checked every third day. No kettle in this town needs a schedule." }),
        ch("Read the metaphor.", "", { checkStat: "intrigue", checkDC: 12, failNext: "ag_confessor_drip_tray_fail", description: "You know exactly one man in town this bad at metaphor. He poured your tea." }),
        ch("Put it back exactly as it was.", "ag_confessor_pilgrim", { description: "The courier collects on schedule. Now you can watch who." })
      ] }),
    beat("ag_confessor_drip_tray_fail", "Allesh-Gilliam — A Neat Fold, Formerly",
      "The fold tears. It was a very neat fold, the kind somebody practises, and it isn't neat any more, and somebody is going to notice. You put it back the way it was, more or less. Less.",
      { type: "narration", requires: DEBT_ACTIVE, scene: SCENES.church, choices: [ch("Watch the candle from across the room.", "ag_confessor_pilgrim")] }),
    beat("ag_confessor_pilgrim", "Allesh-Gilliam — The Guest Who Pays Exact",
      "He's in the corner with his boots off and lined up square, and he stands when you come in the way people stand in church. He smells faintly of candle wax in a town that burns tallow. Verna, behind the desk, is counting something aloud, and the something is stars: there is a little star beside his name in the ledger. \"Pays exact,\" she says. \"Never sleeps in the bed. I put a little star.\" She counts the stars. One. Then, quieter, two.",
      { speaker: sp("Pilgrim Wick"), requires: DEBT_ACTIVE, scene: SCENES.vacancy, choices: [
        ch("\"Where are you headed after St Gilliam's?\"", "", { description: "An itinerary, delivered like scripture. His boots know the Khezek switchbacks better than any shrine schedule justifies." }),
        ch("Ask Verna what the star means.", "", { description: "A fake name. She'll say who. Never why; that's the guest's business, and business is sacred." }),
        ch("Follow him at dusk.", "", { checkStat: "intrigue", checkDC: 14, failNext: "ag_confessor_pilgrim_fail", description: "The third candle moves while you watch. He collects. He never once looks at the man who moved it." })
      ] }),
    beat("ag_confessor_pilgrim_fail", "Allesh-Gilliam — A Person With a Stitch",
      "He's a walker. You're not. By the second switchback he is an itinerary and you are a person with a stitch, and when you get back to the Vacancy Verna has a cup of something waiting and does not ask. She puts a very small star next to your name.",
      { type: "narration", requires: DEBT_ACTIVE, scene: SCENES.vacancy, choices: [ch("Drink the something.", "")] }),
    beat("ag_confessor_relief", "Allesh-Gilliam — \"I Am Relieved\"",
      "He does not deny it. He was never good at performances, which is why the dark had to work through something true. He folds his hands, and he says the thing he has been rehearsing for a year and a half, and it comes out exactly as badly as he feared: \"The sudden corruption of local resources is a thread to pull. We don't have a very big jacket as it is. I am bad at metaphor, by the way. As bad as … something that is very bad at something.\" A pause. The kettle ticks. \"I am relieved,\" he says. \"I have been waiting to be caught since the first candle, and you took your time about it, and I am so relieved I could sit on the floor.\"",
      { speaker: sp("Father Tamsin"), requires: DEBT_ACTIVE, scene: SCENES.church, priority: "high", timePoints: 1, choices: [
        ch("Mercy — reach the man inside the deception", "ag_confessor_redeemed"),
        ch("Expose him before the town", "ag_confessor_exposed"),
        ch("Bring it to Marshal Pike", "ag_confessor_pike"),
        ch("Say nothing. Feed him careful truths.", "ag_confessor_counterfeit")
      ] }),
    // ── THE PIPELINE (new chapter) ──
    beat("ag_pipeline_backward", "Allesh-Gilliam — Run the Channel Backward",
      "For a fortnight the candle moves and the drip tray fills, and everything that comes down the mountain comes to you first. Tamsin translates, apologising for the code. \"He calls the Seal the kettle. I don't know why. I never asked. I should have asked.\" Three things come down. A supply run: every third Long Market a wagon loads for a camp that is on no map, two days coastward and two back. A rumor Wick was told to squash: lights over the coast, and a mall where somebody filmed them. And a fold that isn't words at all — seven positions, the kind a Leygate takes.",
      { speaker: sp("Father Tamsin"), questId: Q_PIPE, tags: PIPE_TAGS, story: { ...PIPE, role: "start" }, scene: SCENES.church, priority: "high",
        requires: [P2, { anyOf: [{ beatMark: "ag_confessor_redeemed" }, { beatMark: "ag_confessor_pike" }, { beatMark: "ag_confessor_counterfeit" }] }, { questBucket: Q_PIPE, isNot: "completed" }],
        questEffects: [{ action: "accept", questId: Q_PIPE, beatId: "", state: "active", text: "The confessor's channel runs backward. Three headings: a caravan, a camcorder, a sequence." }],
        choices: [
          ch("Start with the caravan. Etta's market.", "ag_market_caravan_route"),
          ch("The lights. Note the Mall.", "", { description: "A heading, not a road: Crown Mall's archive has the clip. Kickflip will know what you came for." }),
          ch("The sequence. Garren should see it.", "", { description: "\"That's an activation order.\" He reads it twice. \"Not for this gate.\" Coastward, sideways, the way a Valhaulan ship lands." })
        ] }),
    beat("ag_market_caravan_route", "Allesh-Gilliam — Etta Sells You Preserves First",
      "She sees you coming and has a jar in your hand before you've opened your mouth, which is how Etta says <i>I know why you're here.</i> You pay for the preserves. They are very good. Then, and only then, she lets you ask.",
      { speaker: sp("Etta Bloom"), questId: Q_PIPE, tags: PIPE_TAGS, story: PIPE, scene: SCENES.market, requires: [P2, { questBucket: Q_PIPE, is: "active" }], choices: [
        ch("\"Which stall buys forty pounds of salt and no meat?\"", "ag_caravan_route", { checkStat: "presence", checkDC: 12, failNext: "ag_market_caravan_fail", description: "Third from the east end. The rope stall that never sells any rope." }),
        ch("\"Who buys candle wax in tallow country?\"", "ag_caravan_route", { checkStat: "mind", checkDC: 12, failNext: "ag_market_caravan_fail", description: "The same stall. Every third market. She has been adjusting inventory for it for a season." }),
        ch("Just ask her.", "ag_caravan_route", { description: "She answers, and writes something in the ledger that isn't a price. A question answered is a question owed." })
      ] }),
    beat("ag_market_caravan_fail", "Allesh-Gilliam — More Preserves",
      "Etta sells you preserves. They are very good. The question goes back on the shelf, and she pats it, and says \"come back when you're done pretending,\" and means it kindly, and means it.",
      { type: "narration", speaker: sp("Etta Bloom"), questId: Q_PIPE, tags: PIPE_TAGS, story: PIPE, scene: SCENES.market, choices: [ch("Eat the preserves.", "")] }),
    beat("ag_caravan_route", "Allesh-Gilliam — The Caravan Route",
      "Third stall from the east end, the one that sells rope and never seems to sell any rope. Every third market a Jackalope wagon loads there: salt, wax, flour, no meat, no questions. Two days coastward, two days back. Etta has been adjusting inventory for it for a season. Now so can you.",
      { type: "narration", questId: Q_PIPE, tags: PIPE_TAGS, story: PIPE, scene: SCENES.market, priority: "high",
        receipts: [{ label: "The Caravan Route", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Etta Bloom, after the preserves" },
          truth: "The cult's camp is two days coastward of the Long Market, by a Jackalope wagon that loads at the rope stall every third market day: salt, wax, flour, no meat. Produce it to the Circuit Riders as corroboration; to Kickflip at Crown Mall to match the heading on the camcorder clip; on the Widening Trail to arrive where the caravan arrives instead of walking in the front." }],
        choices: [
          ch("Bring the route to Tamsin. He wants to read the terms.", "ag_tamsin_pactkeeper", { requires: { beatMark: "ag_confessor_redeemed" } }),
          ch("Bring the route to Pike, and then to Tamsin.", "ag_tamsin_pactkeeper", { requires: { beatMark: "ag_confessor_pike" } }),
          ch("Keep the route. Keep the lie.", "ag_pipeline_route_only", { requires: { beatMark: "ag_confessor_counterfeit" } })
        ] }),
    beat("ag_tamsin_pactkeeper", "Allesh-Gilliam — The Man Who Reads the Terms",
      "\"I have been serving something for a year and a half,\" he says, \"and I never once read the terms. I would like to read the terms.\" He means it literally. He has paper. He asks what you have found, out there, that would tell him what his family's echo has actually been buying, and he waits, and for once he does not reach for a metaphor.",
      { speaker: sp("Father Tamsin"), questId: Q_PIPE, tags: PIPE_TAGS, story: { ...PIPE, role: "ending", ending: "pactkeeper" }, scene: SCENES.church, priority: "high", timePoints: 1,
        memoryText: "Father Tamsin read the terms. He sat down on the floor of his own church, and then said he would walk to the coast and count the Garden. He is a Pactkeeper now, not a confessor.",
        questEffects: [{ action: "complete", questId: Q_PIPE, beatId: "", state: "completed", text: "Pactkeeper — Tamsin read the terms and stopped being an echo." }],
        factionEffects: fx(1, 0),
        choices: [
          ch("Show him the rental slip.", "", { requires: { beatMark: "chuckle_rental_slip" }, description: "DUE NOVEMBER 1. He reads it twice. \"One kind lie,\" he says, \"for two hundred years,\" and sits down on the floor." }),
          ch("Show him the birthday card.", "", { requires: { beatMark: "soft_landing_birthday_card" }, description: "Forty-one names. He reads the nine twice. \"That is what it costs the people holding it up,\" he says, and sits down on the floor." }),
          ch("Show him the parade permit.", "", { requires: { beatMark: "stillwater_parade_permit" }, description: "ONE DAY ONLY. \"A permit for one day of grief,\" he says, \"uncashed,\" and sits down on the floor." }),
          ch("Tell him what you've found so far.", "", { description: "He listens. He asks for the terms in writing. It ends the same way, a little slower: a man who reads the terms has a name for what he is now, and it is not confessor." })
        ] }),
    beat("ag_pipeline_route_only", "Allesh-Gilliam — The Route Is Yours. The Man Is Not.",
      "You have the caravan, the heading, and the sequence, and Tamsin has a kettle and a lie he doesn't know he's telling. He asks, once, whether the Stewards have found anything out there that would help him understand what the mountain wants. You tell him you're still looking. He thanks you. He means it. Somewhere under Khezek Tor the dark is looking at paintings, and so, in a way, is he.",
      { type: "narration", speaker: sp("Father Tamsin"), questId: Q_PIPE, tags: PIPE_TAGS, story: { ...PIPE, role: "ending", ending: "route_only" }, scene: SCENES.church, priority: "high", timePoints: 1,
        memoryText: "The coalition kept Tamsin's channel and Tamsin's lie. The caravan route is theirs; the man never read the terms.",
        questEffects: [{ action: "complete", questId: Q_PIPE, beatId: "", state: "completed", text: "Route only — the pipeline harvested; the confessor left deceived." }],
        factionEffects: fx(0, -1),
        choices: [ch("Leave him the kettle.", "")] })
  ];
  for (const nb of NEW) {
    if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`);
  }

  // existing-beat edits
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  edit("ag_confessor_dead_drop", b => {
    if (!(b.choices || []).some(c => c.next === "ag_confessor_drip_tray")) b.choices = [ch("Fish the fold out of the wax.", "ag_confessor_drip_tray"), ch("Leave it for the courier. Watch who comes.", "ag_confessor_pilgrim")];
  }, "routes to the drip tray / the pilgrim");
  edit("ag_tamsin_confrontation", b => {
    b.speakerActorId = sp("Father Tamsin") || b.speakerActorId || null;
    if (!(b.choices || []).some(c => c.next === "ag_confessor_relief")) b.choices = [ch("Let him talk.", "ag_confessor_relief")];
  }, "verdicts move to the relief beat");
  for (const id of ["ag_confessor_redeemed", "ag_confessor_pike", "ag_confessor_counterfeit"]) {
    edit(id, b => { if (!(b.choices || []).some(c => c.next === "ag_pipeline_backward")) b.choices = [...(b.choices || []), ch("Run it backward.", "ag_pipeline_backward", { description: "The channel is still open. Everything that comes down the mountain can come to you first." })]; }, "opens The Pipeline");
  }

  // voices on the conversation leaves that never had one
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice(["allesh_gilliam_marshall_yarrow_convo", "allesh_gilliam_marshall_yarrow_convo_1", "allesh_gilliam_marshall_yarrow_convo_2", "allesh_gilliam_marshall_yarrow_convo_3", "allesh_gilliam_marshall_yarrow_convo_4", "allesh_gilliam_marshall_yarrow_echo"], "Marshal Yarrow Pike");
  voice(["allesh_gilliam_father_tamsin_conversation_1", "allesh_gilliam_father_tamsin_conversation_2", "allesh_gilliam_father_tamsin_conversation_3", "allesh_gilliam_father_tamsin_conversation_4"], "Father Tamsin");
  voice(["allesh_gilliam_etta_bloom_conversation_what_doing", "allesh_gilliam_etta_bloom_conversation_protecting", "allesh_gilliam_etta_bloom_conversation_hesitate", "allesh_gilliam_etta_bloom_conversation_echo", "allesh_gilliam_etta_brushoff"], "Etta Bloom");
  voice(["ag_leygate_visit"], "Garren, Leygate Engineer");
  voice(["allesh_gilliam_muster_intro"], "Ondine Brakk");

  // ── 4. the story script (Layer 2 data) — the FULL AG script, code + retrofit ──
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY]; const codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) { say("✗ code story for allesh_gilliam not readable — story script NOT written (hard-reload and re-run)"); }
  const QUEST = codeQuest ? { ...codeQuest, chapters: { ...(codeQuest.chapters || {}), the_pipeline: { name: "The Pipeline", registryId: Q_PIPE } } } : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const has = (id) => SCRIPT.steps.some(s => s.id === id);
    const DEBT = "the_confessor_s_debt";
    const add = [
      { id: "candle", label: "The Third Candle", group: "debt", chapter: DEBT, line: "The third candle from the door has moved a finger-width. Check the drip tray. Try not to enjoy this.", beats: ["ag_confessor_dead_drop"] },
      { id: "drop", label: "The Drip Tray", group: "debt", chapter: DEBT, line: "Unfold it. It's a maintenance schedule and one metaphor that doesn't work. Somebody in this town is bad at this.", beats: ["ag_confessor_drip_tray"] },
      { id: "pilgrim", label: "The Guest Who Pays Exact", group: "debt", chapter: DEBT, line: "Verna's ledger has a guest who pays exact and never sleeps in the bed. Ask her what the little star means.", beats: ["ag_confessor_pilgrim"] },
      { id: "tea", label: "The Tea Is Already Poured", group: "debt", chapter: DEBT, line: "The tea is already poured. That's how you know. Sit.", beats: ["ag_tamsin_confrontation"] },
      { id: "relief", label: "\"I Am Relieved\"", group: "debt", chapter: DEBT, line: "He is bad at metaphor and worse at spying and he has never been so relieved in his life. Decide what justice looks like.", beats: ["ag_confessor_relief"], done: { anyOf: ["ag_confessor_redeemed", "ag_confessor_exposed", "ag_confessor_pike", "ag_confessor_counterfeit"] } },
      { id: "backward", label: "Run the Channel Backward", group: "pipeline", chapter: "the_pipeline", line: "Run the channel backward. Three headings come down the mountain: a caravan, a camcorder, a sequence.", beats: ["ag_pipeline_backward"] },
      { id: "market", label: "Etta Sells You Preserves First", group: "pipeline", chapter: "the_pipeline", line: "Etta already knows which stall stocks a camp that isn't on any map. She will sell you preserves first.", beats: ["ag_market_caravan_route"], done: { mark: "ag_caravan_route" } },
      { id: "pactkeeper", label: "The Man Who Reads the Terms", group: "pipeline", chapter: "the_pipeline", line: "Tamsin wants to read the terms. Show him what you've found. Then let him sit down.", beats: ["ag_tamsin_pactkeeper", "ag_pipeline_route_only"], done: { anyOf: ["ag_tamsin_pactkeeper", "ag_pipeline_route_only"] } }
    ];
    // the chapter groups sit BEFORE Pike's closure so the main closer stays the last step (lint SC06); they are gated, any-order groups
    const closeAt = SCRIPT.steps.findIndex(s => s.id === "close"); const fresh = add.filter(st => !has(st.id));
    if (closeAt >= 0) SCRIPT.steps.splice(closeAt, 0, ...fresh); else SCRIPT.steps.push(...fresh);
    SCRIPT.chapters = { ...(SCRIPT.chapters || {}),
      [DEBT]: { giver: "the third candle", line: "The tea is already poured. That's how you know. Go and see Father Tamsin, and decide what justice looks like." },
      the_pipeline: { giver: "Father Tamsin, running his channel the other way", line: "Three headings came down the mountain: a caravan, a camcorder, a sequence. Start with the one Etta already knows about." } };
    const doorLine = { tamsin: "Father Tamsin has a night story and a kettle. Ask about the dream. Don't ask him for a metaphor.", etta: "Etta said questions keep. They've kept. Bring money for preserves; the answer comes after the jar.", muster: "Captain Brakk is drilling farmers by the North Gate. Compliments will be issued as citations." };
    for (const d of (SCRIPT.doors || [])) if (doorLine[d.id]) d.line = doorLine[d.id];
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script allesh_gilliam → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, chapters: ${Object.keys(QUEST.chapters).join("/")})`); } else if (SCRIPT) say("· ok story script (already)");

  // ── report / write ─────────────────────────────────────────────────────────
  console.log(`[seed-allesh-gilliam-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Allesh-Gilliam retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Allesh-Gilliam retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-ag-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (questsChanged) await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Allesh-Gilliam retrofit APPLIED: ${changes} change(s). He calls it the kettle. F5.`);
})();
