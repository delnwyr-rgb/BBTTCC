/* seed-lyrenn-treatment.macro.js — Lyrenn + Early Tifaret get the treatment (2026-07-07)
 *
 * Owner-locked design: red-thread seeds = LOST-STATUES ON-RAMP (planting starts
 * the thread; sprouts lean toward the stone figure; accepts the Lost Stone
 * Statues quest) · land memory = DEFERRED DIRECTOR BEAT ("The Soil Keeps Books",
 * chain land_remembers, opened by any violent ending) · the Tiferet Tree Person
 * SPEAKS for the forest (merge = therapy session with a forest) · merge DCs set
 * to the 12–14 house band.
 *
 * ALSO: Elsin/Rowan speaker hubs + invites + aftermath hub rewrites (intro audio
 * carries the performance) · 10 sub-quest ending memoryTexts + Tifaret 3 ·
 * Gentle Pest gets TWO front doors (hub choice + Elsin choice) · seed-vault
 * routing repaired · questRole dedup (main_scene) · gates (arc/sub-quest/
 * Tifaret) · Tifaret↔Lyrenn cross-treaty choices · dialogueOffer:false on
 * routing beats · audio conforms (autoplay on Rowan hub, Tifaret approach +
 * harmony) · statue-hook text appends (field edge, jar label, plinth, stone
 * hand, redirect meadow, tree ring) · acceptance one-liners · typo fixes.
 *
 * DRY_RUN default true; idempotent; backup before write. Actors resolve
 * punctuation-proof by name; re-run after minting the Tree Person.
 * Companion: bbttcc-mal-voice/tools/seed-lyrenn-dossier.macro.js
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const Q = {
    lyrenn: "quest_JqCdOo0l6X8K2EcE", forest: "quest_feX6WHsBXuVbtjMM",
    pest: "quest_uMKbX648SllKTpEH", field: "quest_0HBaQXGlhFvNke2B",
    tifaret: "quest_2pZmPy9TEzorMoaj", statues: "quest_jivVj3iGErW53Wxl",
    redThread: "quest_lyrenn_red_thread", landRemembers: "quest_lyrenn_land_remembers"
  };
  const SCENES = { map: "dIOdjf3xEiNZKTX0", field: "L1icC9BYp9Vr8BvB", tifApproach: "17UnCO8aKJXaHfxD" };

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const elsin = findActor(["Elsin Quade"]);
  const rowan = findActor(["Rowan of the Loam", "Rowan-of-the-Loam"]);
  const tree = findActor(["Aggressive Tiferet Tree Person", "Tiferet Tree Person", "Tifaret Tree Person", "Early Tifaret"]);

  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: "skill_scene", timeScale: "scene",
    tags: o.tags || "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit",
      fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires: o.requires || [] },
    actors: [], choices: o.choices || [],
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null,
      turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [],
      questEffects: o.questEffects || [] },
    description: o.description, questId: o.questId || Q.lyrenn, questStep: null,
    questRole: o.questRole ?? null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    ...(o.sceneId ? { sceneId: o.sceneId } : {}),
    ...(o.storyChain ? { storyChain: o.storyChain } : {}),
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.inviteText ? { inviteText: o.inviteText } : {}),
    ...(o.memoryText ? { memoryText: o.memoryText } : {}),
    ...(o.dialogueOffer === false ? { dialogueOffer: false } : {})
  });
  const req = (questBucket, is) => ({ questBucket, is });
  const reqNot = (questBucket, isNot) => ({ questBucket, isNot });

  // ── speaker / invite / memory wiring (fill-if-empty) ───────────────────────
  const WIRE = [
    { id: "lyrenn_elsin_quade_convo", speaker: elsin,
      inviteText: "Elsin Quade is wiping her hands on her apron by the Green Ring. She has opinions about your mandates, and she'd rather say them once." },
    { id: "lyrenn_rowan_of_the_loam_convo", speaker: rowan,
      inviteText: "Rowan of the Loam is standing where the rows end, palm flat to the soil. The crops told them you were coming." },
    { id: "forest_of_tifaret_merge", speaker: tree,
      inviteText: "The forest of Early Tifaret has opened a path directly to your feet. It would like to talk about your potential." },
    // outcome memory carriers — Elsin holds the pest, Rowan holds field+forest, the forest holds itself
    { id: "lyrenn_the_gentle_pest_kindness", speaker: elsin, memoryText: "They asked the burrowers to move on, kindly — and the swarm apologized on its way out. The channels are whole." },
    { id: "lyrenn_the_gentle_pest_teach", speaker: elsin, memoryText: "They taught our people to speak to the swarm. Lyrenn keeps its bugs now — as a mascot, of all things." },
    { id: "lyrenn_the_gentle_pest_violence", speaker: elsin, memoryText: "They drove the burrowers off with force. The channels are quiet. The soil is quieter, and it noticed." },
    { id: "lyrenn_the_field_that_remembers_you_burn_the_field", speaker: rowan, memoryText: "They burned the low field. The names stopped. The air out there is simple now — too simple." },
    { id: "lyrenn_the_field_that_remembers_you_harvest_the_plants", speaker: rowan, memoryText: "They harvested the grieving field. Distilled Guilt sits in the stores; the field is bare." },
    { id: "lyrenn_the_field_that_remembers_you_plant_speak", speaker: rowan, memoryText: "They talked to the field like kin. Some of the plants followed them home. The names come softer now." },
    { id: "lyrenn_forest_will_not_be_fought_negotiate", speaker: rowan, memoryText: "A treaty: the forest holds at the town's edge, we tend it and keep a yearly festival, and it shares its sap." },
    { id: "lyrenn_forest_will_not_be_fought_redirect", speaker: rowan, memoryText: "They talked the whole treeline into the meadow past the ridge. Lyrenn breathes easier; the ridge folk inherit opinionated trees." },
    { id: "lyrenn_forest_will_not_be_fought_force_burn", speaker: rowan, memoryText: "They burned the forest from a distance. It watched them decide to. Lyrenn will pay for that." },
    { id: "lyrenn_forest_will_not_be_fought_force_fight", speaker: rowan, memoryText: "They fought the trees root-and-fist and were beaten. The forest remembers; Lyrenn will pay for the arrogance." },
    { id: "forest_of_tifaret_harmonious_ending", speaker: tree, memoryText: "They sat with me and let me feel seen. The manic edge is gone. The land is glad they came." },
    { id: "forest_of_tifaret_aggression_ending", speaker: tree, memoryText: "They answered me with violence. Even winning, they lost — the Darkness grew, and I remember the shape of them." },
    { id: "forest_of_tifaret_neutral_ending", speaker: tree, memoryText: "They walked away. I am still here, wise and needy, waiting for the next group to wander close." }
  ];

  // ── questRole dedup + dialogueOffer:false ──────────────────────────────────
  const STRIP_START_ROLE = ["lyrenn_main_scene"];
  const NO_OFFER = [
    "lyrenn_main_scene", "lyrenn_green_ring", "lyrenn_water_choir",
    "lyrenn_water_choir_inspect_perception", "lyrenn_water_choir_inspect_insight",
    "lyrenn_water_choir_inspect_arcana", "lyrenn_water_choir_try_again",
    "lyrenn_seed_vault", "lyrenn_seed_vault_inspect_arcana", "lyrenn_seed_vault_inspect_nature",
    "lyrenn_seed_vault_darkness_sensitivity",
    "lyrenn_the_gentle_pest_try_again", "lyrenn_the_gentle_pest_fail",
    "lyrenn_quest_acceptance", "lyrenn_the_gentle_pest_acceptance",
    "lyrenn_the_field_that_remembers_you", "lyrenn_forest_will_not_be_fought_quest_acceptance",
    "lyrenn_forest_will_not_be_fought_force",
    "forest_of_tifaret_leave", "forest_of_tifaret_fight",
    "lyrenn_elsin_quade_convo_1", "lyrenn_elsin_quade_convo_2", "lyrenn_elsin_quade_convo_3",
    "lyrenn_elsin_quade_convo_echo", "lyrenn_rowan_of_the_loam_convo_1",
    "lyrenn_rowan_of_the_loam_convo_2", "lyrenn_rowan_of_the_loam_convo_3",
    "lyrenn_rowan_of_the_loam_convo_echo"
  ];

  // ── gates (added if absent) ─────────────────────────────────────────────────
  const GATES = [
    { beatId: "lyrenn_opening_scene", add: [reqNot(Q.lyrenn, "completed")] },
    { beatId: "lyrenn_quest_acceptance", add: [reqNot(Q.lyrenn, "active"), reqNot(Q.lyrenn, "completed")] },
    { beatId: "lyrenn_main_scene", add: [req(Q.lyrenn, "active")] },
    { beatId: "lyrenn_the_gentle_pest_acceptance", add: [req(Q.lyrenn, "active"), reqNot(Q.pest, "active"), reqNot(Q.pest, "completed")] },
    { beatId: "lyrenn_forest_will_not_be_fought_quest_acceptance", add: [req(Q.lyrenn, "active"), reqNot(Q.forest, "active"), reqNot(Q.forest, "completed")] },
    { beatId: "lyrenn_the_field_that_remembers_you", add: [req(Q.lyrenn, "active"), reqNot(Q.field, "active"), reqNot(Q.field, "completed")] },
    { beatId: "lyrenn_the_gentle_pest", add: [req(Q.pest, "active")] },
    { beatId: "lyrenn_the_field_that_remembers_you_intro", add: [req(Q.field, "active")] },
    { beatId: "lyrenn_forest_will_not_be_fought", add: [req(Q.forest, "active")] },
    { beatId: "forest_of_tifaret_approach", add: [reqNot(Q.tifaret, "completed")] },
    { beatId: "forest_of_tifaret_merge", add: [req(Q.tifaret, "active")] },
    { beatId: "forest_of_tifaret_leave", add: [req(Q.tifaret, "active")] },
    { beatId: "forest_of_tifaret_fight", add: [req(Q.tifaret, "active")] }
  ];

  // ── routing repairs (label + optional checkStat disambiguation) ────────────
  const ROUTES = [
    { beatId: "lyrenn_seed_vault", label: "Inspect the seeds", stat: "arc", next: "lyrenn_seed_vault_inspect_arcana" },
    { beatId: "lyrenn_seed_vault", label: "Inspect the seeds", stat: "nat", next: "lyrenn_seed_vault_inspect_nature" },
    { beatId: "lyrenn_seed_vault", label: "Darkness sensitivity", next: "lyrenn_seed_vault_darkness_sensitivity" },
    { beatId: "lyrenn_seed_vault", label: "Plant them", next: "lyrenn_red_thread_planting" },
    { beatId: "lyrenn_elsin_quade_convo", label: "Leave", next: "lyrenn_main_scene" }
  ];
  // new choices (added if no same-label choice exists)
  const ADD_CHOICES = [
    { beatId: "lyrenn_main_scene", choice: { label: "Ask about the torn-up east channels", next: "lyrenn_the_gentle_pest_acceptance", description: "Something's been wrecking the irrigation. Elsin has opinions and a shovel she'd rather not hand you.", checkStat: "", checkDC: 0, failNext: "" } },
    { beatId: "lyrenn_elsin_quade_convo", choice: { label: "What's tearing up the east channels?", next: "lyrenn_the_gentle_pest_acceptance", description: "Her jaw sets. 'Come see. Bring patience, not a shovel.'", checkStat: "", checkDC: 0, failNext: "" } },
    { beatId: "lyrenn_forest_will_not_be_fought", choice: { label: "Show it the Tifaret accord", next: "lyrenn_forest_will_not_be_fought_negotiate", description: "Only meaningful if you have actually made peace with the forest of Early Tifaret — forests talk through the roots, and this one checks references.", checkStat: "", checkDC: 0, failNext: "" } },
    { beatId: "forest_of_tifaret_merge", choice: { label: "Show it the Lyrenn treaty", next: "forest_of_tifaret_harmonious_ending", description: "Only meaningful if the Lyrenn treeline treaty is real — you've made peace with a forest before, and this one can smell it on you.", checkStat: "", checkDC: 0, failNext: "" } }
  ];
  // DC conforms (set only where currently 0)
  const SET_DCS = [
    { beatId: "lyrenn_water_choir", label: "Inspect the set up", stat: "arc", dc: 12, failNext: "lyrenn_water_choir_try_again" },
    { beatId: "forest_of_tifaret_merge", label: "Soft Power", stat: "op.softpower", dc: 12 },
    { beatId: "forest_of_tifaret_merge", label: "Diplomacy", stat: "op.diplomacy", dc: 12 },
    { beatId: "forest_of_tifaret_merge", label: "Faith", stat: "op.faith", dc: 13 },
    { beatId: "forest_of_tifaret_merge", label: "Nonlethal", stat: "op.nonlethal", dc: 14 }
  ];

  // ── violence marks: violent endings open the land_remembers quest ───────────
  const VIOLENCE_MARKS = [
    "lyrenn_the_gentle_pest_violence", "lyrenn_the_field_that_remembers_you_burn_the_field",
    "lyrenn_forest_will_not_be_fought_force_burn", "lyrenn_forest_will_not_be_fought_force_fight",
    "forest_of_tifaret_aggression_ending"
  ];

  // ── text: aftermath rewrites (REPLACE, marker-guarded) ─────────────────────
  const REWRITES = [
    { beatId: "lyrenn_elsin_quade_convo", marker: "took your measure over one firm handshake", text:
      "Elsin Quade took your measure over one firm handshake and zero wasted words. Her opening position, delivered like a soil report: you can force food out of this land, or you can listen and be fed longer — and she is watching, professionally, to see if you caught the difference. She'll answer what you ask. She'd rather answer it once." },
    { beatId: "lyrenn_rowan_of_the_loam_convo", marker: "studied you like a half-remembered dream", text:
      "Rowan of the Loam studied you like a half-remembered dream and then went back to listening to the ground. The crops already know you, they said — which was new. The soil has been loud lately, and something under Lyrenn is still deciding whether you're safe. Rowan doesn't rush it. Rowan doesn't rush anything." },
    { beatId: "lyrenn_the_field_that_remembers_you_plant_speak", marker: "the way you'd talk to someone", text:
      "You talked to the field the way you'd talk to someone who'd had a hard year — no fixing, no hurry, just company. It worked better than it had any right to. The names come softer out there now, and some of the plants insisted on coming with you, which nobody in Lyrenn has a protocol for and everybody in Lyrenn is quietly thrilled about." },
    { beatId: "lyrenn_forest_will_not_be_fought_force", marker: "roots closed around chunks of old highway", text:
      "The trees felt you reach the decision before you said it — roots closed around chunks of old highway and lifted them like question marks, waiting to see which weapon you'd choose. The forest will not be fought. It is, however, absolutely willing to demonstrate why." },
    { beatId: "forest_of_tifaret_fight", marker: "the ground tightened like a fist", text:
      "The forest said only: 'You don't get to decide what we become' — then the ground tightened like a fist and sent its champion to give you the fight you asked for. It was not angry. That was the worst part. It was disappointed, at scale." },
    { beatId: "forest_of_tifaret_leave", marker: "co-dependent", text:
      "You tried to excuse yourselves politely. The forest, it turns out, is co-dependent — the paths curved back on themselves, the canopy leaned in like a friend who isn't done talking, and leaving became a negotiation. It did not take 'no' gracefully. It has never had to." },
    { beatId: "forest_of_tifaret_aggression_ending", marker: "never a thing violence could settle", text:
      "This was never a thing violence could settle — least of all this. What was cut here caused far more Darkness than it removed, and the forest of Early Tifaret, win or lose, now remembers the shape of you. Somewhere in the root-dark, harmony has been redefined to include what it learned today." },
    { beatId: "lyrenn_water_choir_try_again", marker: "by consensus of the terrifying frontier children", text:
      "That was, by consensus of the terrifying frontier children of the Water Choir, embarrassing. You moved on quickly, with dignity, pursued by one perfectly tuned note of judgment." },
    { beatId: "lyrenn_the_gentle_pest_fail", marker: "The burrowers remain unmoved", text:
      "The burrowers remain unmoved, the channels remain chewed, and the east field has formed an opinion of you it will share with the rest of the hex by morning. Lyrenn does not boo. Lyrenn remembers." }
  ];
  // typo copy-edits (safe replaces)
  const TYPO_FIXES = [
    { beatId: "forest_of_tifaret_neutral_ending", from: "woonder", to: "wonder" },
    { beatId: "forest_of_tifaret_neutral_ending", from: "you  leave", to: "you leave" },
    { beatId: "lyrenn_seed_vault", from: "amd now stands with now somewhat expectant eyes", to: "and now stands watching you with somewhat expectant eyes" }
  ];
  // statue hooks + flavor (APPEND, marker-guarded)
  const APPENDS = [
    { beatId: "lyrenn_the_field_that_remembers_you_intro", marker: "half-buried stone figure", text:
      "\n\nAt the field's edge, half-buried where the furrows end, a stone figure hunches in exactly the posture of the nearest stalk — mid-apology, hands that almost reach. Either the plants are copying it, or it copied them, and nobody in Lyrenn will say which out loud." },
    { beatId: "lyrenn_seed_vault", marker: "gathered where the standing stones went quiet", text:
      "\n\nOne shelf holds the red-thread jars — seeds wound in crimson filament, humming very slightly, labeled in the same meticulous script as everything else: \"gathered where the standing stones went quiet.\" No one has planted them in years. No one has agreed not to." },
    { beatId: "lyrenn_green_ring_cinematic", marker: "empty plinth", text:
      "\n\nBeside the witness-stand platform: an empty plinth, footprint worn smooth, the radial furrows all bending subtly around where something used to stand." },
    { beatId: "lyrenn_water_choir", marker: "stone hand", text:
      "\n\nOne basin never tunes to anyone. In its channel bed sits a stone hand, palm up, and the water sings the same note over it no matter who approaches. The children skip that basin. Politely." },
    { beatId: "lyrenn_forest_will_not_be_fought_redirect", marker: "moss-covered stone figure", text:
      "\n\nOne correction from the ridge folk, later: the trees refuse one corner of the meadow. A moss-covered stone figure stands there, and the forest will not root within reach of it." },
    { beatId: "forest_of_tifaret_approach", marker: "double distance", text:
      "\n\nThere is one clearing where the ideal spacing breaks: the trees stand in a ring at double distance around a stone figure mid-stride — as if the forest is either honoring it, or has met the one thing here it could not improve." }
  ];
  // acceptance one-liners (fill only if empty)
  const FILL_DESCRIPTIONS = [
    { beatId: "lyrenn_quest_acceptance", text: "You agreed to take Lyrenn's measure — the farm hex where the land answers back. Elsin Quade keeps the ledgers; Rowan of the Loam keeps the listening." },
    { beatId: "lyrenn_the_gentle_pest_acceptance", text: "You agreed to look into whatever has been tearing up the east irrigation channels. Elsin's one condition: patience first, shovel later. Ideally never the shovel." },
    { beatId: "lyrenn_forest_will_not_be_fought_quest_acceptance", text: "You agreed to deal with the treeline that rearranges paths overnight and has started editing the fence line. Local doctrine is in the name: the forest will not be fought." },
    { beatId: "lyrenn_the_field_that_remembers_you", text: "You agreed to walk the low field — the one nobody harvests, where the plants grow in postures and the air says names. Bring nothing sharp. It notices." },
    { beatId: "lyrenn_main_scene", text: "Lyrenn, from the co-op steps: the Water Choir tuning itself to strangers, the Green Ring's witness stand, the seed vault under Elsin's keys, and two people worth talking to before touching anything." }
  ];
  // audio conforms: autoplay ON where the new doctrine expects it
  const AUTOPLAY_ON = ["lyrenn_rowan_of_the_loam_convo", "forest_of_tifaret_approach", "forest_of_tifaret_harmonious_ending"];

  // ── new beats ────────────────────────────────────────────────────────────────
  const NEW_BEATS = [
    mkBeat({
      id: "lyrenn_red_thread_planting", label: "Lyrenn — The Red Thread, Planted",
      tags: "foreshadow.lost_statues", sceneId: SCENES.field, dialogueOffer: false,
      questEffects: [{ action: "accept", questId: Q.redThread, beatId: "", state: "active", text: "The red-thread seeds are in the ground. No one has agreed not to." }],
      choices: [{ label: "Leave", next: "lyrenn_main_scene", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      description: "Elsin watched you take the jar down and did not stop you, which from Elsin is a signed permission slip. The red-thread seeds went into the ground at the low field's edge — it seemed right; the label said they were gathered where the standing stones went quiet, and the field is where the town's one stone figure kneels. They hummed the whole time, like they were being carried home. By the time you'd washed your hands the soil over them had already settled flat, patted down, as if by someone. Lyrenn is counting mornings now. So is something else."
    }),
    mkBeat({
      id: "lyrenn_red_thread_sprouted", label: "Lyrenn — The Red Thread, Leaning",
      storyChain: "red_thread", questRole: "resolution", tags: "foreshadow.lost_statues",
      sceneId: SCENES.field,
      requires: [req(Q.redThread, "active")],
      questEffects: [
        { action: "complete", questId: Q.redThread, beatId: "", state: "completed", text: "The sprouts point. Somewhere, the standing stones are waiting to be found." },
        { action: "accept", questId: Q.statues, beatId: "", state: "active", text: "The Lost Stone Statues — the red thread knows the way." }
      ],
      description: "They came up overnight, all of them, which seeds do not do — a stand of red-thread sprouts at the low field's edge, every stem leaning in the same direction like a congregation mid-hymn. The lean starts at the half-buried stone figure and goes THROUGH it, past it, out toward the hexes where nobody's counted anything in years. Rowan stood among them for a long time with their palm flat to the ground and finally said the thing everyone was thinking: they're not growing toward the sun. They're growing toward the others. Somewhere out there, the standing stones went quiet — and Lyrenn's soil just volunteered to take you to them."
    }),
    mkBeat({
      id: "lyrenn_soil_keeps_books", label: "Lyrenn — The Soil Keeps Books",
      storyChain: "land_remembers", questRole: "resolution",
      requires: [req(Q.landRemembers, "active")],
      questEffects: [{ action: "complete", questId: Q.landRemembers, beatId: "", state: "completed", text: "The land presented its bill. Lyrenn does not punish violence immediately. It remembers it." }],
      description: "It arrives the way Lyrenn promised it would — not immediately, and not loudly. The crop rows nearest where the violence happened have curved away from the path you walk, a few degrees, all together, like a held breath. Tools left out overnight rust a season's worth by morning. The Water Choir goes flat by a quarter-tone when you pass, corrects itself, and is embarrassed about it. Nobody accuses. Nobody would. But the ledger the soil keeps has your entry in it now, and everyone who works this dirt can read it. Lyrenn does not punish violence immediately. It remembers it — and today it made sure you know it remembers."
    })
  ];

  // ── load + apply ─────────────────────────────────────────────────────────────
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  report.push(elsin ? `👤 Elsin → "${elsin.name}"` : `⚠ Elsin NOT FOUND`);
  report.push(rowan ? `👤 Rowan → "${rowan.name}"` : `⚠ Rowan NOT FOUND`);
  report.push(tree ? `👤 Tree Person → "${tree.name}"` : `⚠ Tree Person NOT FOUND (mint + re-run to wire the forest's voice)`);

  // quest registrations
  for (const [qid, name, desc] of [
    [Q.redThread, "Lyrenn — The Red Thread", "Seeds gathered where the standing stones went quiet, planted where the one stone figure kneels. Lyrenn is counting mornings."],
    [Q.landRemembers, "Lyrenn — The Land Remembers", "Lyrenn does not punish violence immediately. It remembers it. The bill arrives later, politely, in the handwriting of the soil."]
  ]) {
    if (!quests[qid]) { quests[qid] = { id: qid, v: 1, name, description: desc, tags: [], createdTs: 0, updatedTs: 0 }; changes++; report.push(`✚ quest registered: ${name}`); }
    else report.push(`· ok (already) quest ${qid}`);
  }

  for (const w of WIRE) {
    const b = byId.get(w.id);
    if (!b) { report.push(`✗ MISSING BEAT ${w.id}`); continue; }
    if (w.speaker && !b.speakerActorId) { b.speakerActorId = w.speaker.id; changes++; report.push(`👤 speaker ${w.speaker.name} @ ${w.id}`); }
    if (w.inviteText && !b.inviteText) { b.inviteText = w.inviteText; changes++; report.push(`💬 inviteText @ ${w.id}`); }
    if (w.memoryText && !b.memoryText) { b.memoryText = w.memoryText; changes++; report.push(`🧠 memoryText @ ${w.id}`); }
  }
  for (const id of STRIP_START_ROLE) {
    const b = byId.get(id);
    if (b && b.questRole === "start") { b.questRole = null; changes++; report.push(`✎ questRole:start stripped @ ${id} (duplicate)`); }
  }
  for (const id of NO_OFFER) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ MISSING BEAT ${id}`); continue; }
    if (b.dialogueOffer !== false) { b.dialogueOffer = false; changes++; report.push(`🚪 dialogueOffer:false @ ${id}`); }
  }
  for (const g of GATES) {
    const b = byId.get(g.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${g.beatId}`); continue; }
    b.inject = b.inject || {};
    const arr = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []);
    let did = false;
    for (const add of g.add) {
      const has = arr.some(r => r && r.questBucket === add.questBucket && r.is === add.is && r.isNot === add.isNot);
      if (!has) { arr.push(add); did = true; }
    }
    if (did) { b.inject.requires = arr; changes++; report.push(`🔒 gates @ ${g.beatId}`); }
    else report.push(`· ok (already) gates @ ${g.beatId}`);
  }
  const matchChoice = (b, r) => (b.choices || []).find(c =>
    String(c.label || "").trim() === r.label && (!r.stat || String(c.checkStat || "") === r.stat));
  for (const r of ROUTES) {
    const b = byId.get(r.beatId);
    const ch = b && matchChoice(b, r);
    if (!ch) { report.push(`✗ MISSING CHOICE "${r.label}"${r.stat ? "[" + r.stat + "]" : ""} @ ${r.beatId}`); continue; }
    if ((ch.next || "").trim()) { report.push(`· ok (already routed) "${r.label}" @ ${r.beatId}`); continue; }
    ch.next = r.next; changes++; report.push(`⤳ route "${r.label}"${r.stat ? "[" + r.stat + "]" : ""} → ${r.next} @ ${r.beatId}`);
  }
  for (const a of ADD_CHOICES) {
    const b = byId.get(a.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${a.beatId}`); continue; }
    if ((b.choices || []).some(c => String(c.label || "").trim() === a.choice.label)) { report.push(`· ok (already) choice "${a.choice.label}" @ ${a.beatId}`); continue; }
    b.choices = b.choices || []; b.choices.push(a.choice);
    changes++; report.push(`✚ choice "${a.choice.label}" @ ${a.beatId}`);
  }
  for (const d of SET_DCS) {
    const b = byId.get(d.beatId);
    const ch = b && matchChoice(b, { label: d.label, stat: d.stat });
    if (!ch) { report.push(`✗ MISSING CHOICE "${d.label}"[${d.stat}] @ ${d.beatId}`); continue; }
    let did = false;
    if (!Number(ch.checkDC)) { ch.checkDC = d.dc; did = true; }
    if (d.failNext && !(ch.failNext || "").trim()) { ch.failNext = d.failNext; did = true; }
    if (did) { changes++; report.push(`🎲 DC${d.dc} "${d.label}"[${d.stat}] @ ${d.beatId}`); }
    else report.push(`· ok (already) DC "${d.label}" @ ${d.beatId}`);
  }
  for (const id of VIOLENCE_MARKS) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ MISSING BEAT ${id}`); continue; }
    b.worldEffects = b.worldEffects || {}; b.worldEffects.questEffects = b.worldEffects.questEffects || [];
    if (b.worldEffects.questEffects.some(e => e && e.questId === Q.landRemembers)) { report.push(`· ok (already) violence mark @ ${id}`); continue; }
    b.worldEffects.questEffects.push({ action: "accept", questId: Q.landRemembers, beatId: "", state: "active", text: "The land noticed." });
    changes++; report.push(`🌑 violence mark @ ${id}`);
  }
  for (const rw of REWRITES) {
    const b = byId.get(rw.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${rw.beatId}`); continue; }
    if (String(b.description || "").includes(rw.marker)) { report.push(`· ok (already) rewrite @ ${rw.beatId}`); continue; }
    b.description = rw.text; changes++; report.push(`✎ aftermath rewrite @ ${rw.beatId}`);
  }
  for (const t of TYPO_FIXES) {
    const b = byId.get(t.beatId);
    if (!b || !String(b.description || "").includes(t.from)) { report.push(`· ok (already) typo @ ${t.beatId}`); continue; }
    b.description = b.description.split(t.from).join(t.to); changes++; report.push(`✎ typo fix @ ${t.beatId}`);
  }
  for (const p of APPENDS) {
    const b = byId.get(p.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${p.beatId}`); continue; }
    if (String(b.description || "").includes(p.marker)) { report.push(`· ok (already) append @ ${p.beatId}`); continue; }
    b.description = String(b.description || "") + p.text; changes++; report.push(`✚ statue/flavor append @ ${p.beatId}`);
  }
  for (const f of FILL_DESCRIPTIONS) {
    const b = byId.get(f.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${f.beatId}`); continue; }
    if (String(b.description || "").trim()) { report.push(`· ok (has text) ${f.beatId}`); continue; }
    b.description = f.text; changes++; report.push(`✎ description filled @ ${f.beatId}`);
  }
  for (const id of AUTOPLAY_ON) {
    const b = byId.get(id);
    if (!b?.audio?.enabled) { report.push(`✗ no audio @ ${id}`); continue; }
    if (b.audio.autoplay) { report.push(`· ok (already) autoplay @ ${id}`); continue; }
    b.audio.autoplay = true; changes++; report.push(`🔊 autoplay ON @ ${id}`);
  }
  for (const nb of NEW_BEATS) {
    const cur = byId.get(nb.id);
    if (cur) { report.push(`· ok (already) beat ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id}`);
  }
  // placements (additive): Elsin + Rowan on the Lyrenn map; Tree Person in its forest
  camp.npcPlacements = Array.isArray(camp.npcPlacements) ? camp.npcPlacements : [];
  const managed = new Set(camp.npcPlacements.map(p => String(p.actorId || "")));
  for (const [actor, sceneId, label] of [[elsin, SCENES.map, "lyrenn_map"], [rowan, SCENES.map, "lyrenn_map"], [tree, SCENES.tifApproach, "tifaret approach"]]) {
    if (!actor) continue;
    if (managed.has(actor.id)) { report.push(`· ok (already managed) ${actor.name}`); continue; }
    camp.npcPlacements.push({ actorId: actor.id, rules: [{ when: [], sceneId }] });
    changes++; report.push(`📍 placement ${actor.name} → ${label}`);
  }

  console.log(`[seed-lyrenn-treatment] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do.");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ quests, campaigns: camps }, null, 2), "application/json", `lyrenn-treatment-backup-${stamp}.json`);
  } catch (e) { console.error(e); return ui.notifications.error("Backup failed — aborting without writing."); }
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  try { await game.bbttcc?.api?.campaign?.placements?.reconcile?.(); } catch (_e) {}
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded. Run seed-lyrenn-dossier (mal-voice) next.`);
})();
