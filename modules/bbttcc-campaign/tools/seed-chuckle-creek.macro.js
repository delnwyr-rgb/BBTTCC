/* seed-chuckle-creek.macro.js — CHUCKLE CREEK: the hex where nothing counts
 * 2026-08-18. Spec: new-content/cartoon-hex-chuckle-creek.md
 * Family: the GRIEF-REFUSALS quartet (Wendigo · Chuckle Creek · Stillwater ·
 * Soft Landing) — four communities, four ways to not grieve, one ache.
 *
 * Door B: you walk in delighted and the delight indicts. The structural
 * inverse of the Wendigo — they eat the painful memory; Chuckle Creek just
 * makes the pain not COUNT.
 *
 * ⚠ ENGINE WORK THIS SEEDER DOES NOT DO (story surface only):
 *  · the `noncanon` condition — suppresses lethal damage, blocks worldEffects
 *    from persisting, and BLOCKS ALIGNMENT until the bubble is resolved. It is
 *    the load-bearing new mechanic and belongs in the territory/turn engine
 *    alongside `stasis` (Stillwater) and `cushioned` (Soft Landing) — design
 *    the three as one "hex refuses consequence" substrate with flavour flags.
 *  · the no-mattering CASCADE (radiation-cascade pattern: +1/Turn toward an
 *    adjacent hex; claimed hexes go `noncanon` and stop persisting).
 *  Until those exist the GM drives the rung meter by hand:
 *      flags.fourththing.chucklecreek.seen  (0–4)
 *  Every rung beat below is gated on it, so raising the flag reveals the next
 *  rung exactly as an engine eventually would.
 *
 * DRY_RUN default true. Idempotent (skips existing ids). Backs up the
 * campaigns setting before writing. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const Q  = "quest_chuckle_creek";
  const FLAG = "chucklecreekSeen";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

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

  if (!quests[Q]) {
    quests[Q] = {
      id: Q, v: 1, name: "Chuckle Creek", status: "active", campaignId,
      description: "A town living in glorious cartoon physics: anvils, no death, everybody bounces back by the next scene. It is genuinely delightful, and you should let yourself enjoy it, because the delight is the evidence. Every person here fled a grief so large that the only bearable world was one where nothing can matter — and something agreed to give them that, forever. The creek really does chuckle. The locals find this normal.",
      tags: [], createdTs: Date.now(), updatedTs: Date.now()
    };
    changes++; report.push("✚ quest registered: Chuckle Creek");
  } else report.push("· ok quest (already) Chuckle Creek");

  const bridge = (id, label, description, { requires = null, priority = "background", timePoints = 0, questEffects = null, choices = null, type = "dialog" } = {}) => ({
    id, label, type, timeScale: "scene", timePoints,
    questId: Q, tags: "chuckle_creek grief_refusals story", politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: false, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      ...(requires ? { requires } : {})
    },
    actors: [],
    choices: choices || [{ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {}, playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    storyChain: "chuckle_creek", priority,
    ...(questEffects ? { worldEffects: { questEffects } } : {})
  });

  const plain = (id, label, description, { timePoints = 0, choices = null, questEffects = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    questId: Q, tags: "chuckle_creek grief_refusals story",
    description,
    ...(questEffects ? { worldEffects: { questEffects } } : {}),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  const BEATS = [
    // ── the delight open. DO NOT RUSH THIS. ─────────────────────────────────
    bridge("chuckle_arrival", "Chuckle Creek — Everything Is a Bit",
      "The sky is a painted backdrop and the sun has a face. A man takes an anvil to the skull, flattens to the thickness of a playing card, springs back, and tips his hat to you. Gravity here is a suggestion that most people politely decline. The diner serves a pie that is mostly steam and enthusiasm, and it is somehow the best thing you have eaten in months. The creek chuckles. Actually chuckles — a low delighted burble, exactly like someone enjoying a joke two rooms away — and when you mention it, the locals look at you the way you'd look at a man remarking that water is wet.\n\nAnd nothing here can hurt anyone. The first time one of you swings in earnest, the world simply declines: the blade becomes a rubber chicken, the target sees a halo of tweeting birds and sits down hard, and everybody laughs, including the target. It is genuinely, uncomplicatedly fun.\n\n⚙ GM: LET THE TABLE ENJOY THIS. The bait is the joy itself, and the longer they laugh, the harder the turn lands. Rung 0 is already visible if anyone looks: the kid who gets flattened by a piano springs up laughing — and he is tired in a way children should not be. He has done this before. Many times.",
      { priority: "high", type: "skill_scene",
        questEffects: [{ action: "accept", questId: Q, text: "A town where nothing can hurt anyone. Everyone is delighted. Something is very wrong and it is going to take a while to see it." }] }),

    // ── the indict ladder — each rung gated on the hidden meter ─────────────
    bridge("chuckle_rung_1", "There Is No Last Winter",
      "You ask the diner owner what last winter was like. She thinks about it with genuine effort, the way you'd think about a word on the tip of your tongue, and then she brightens and offers you more coffee. You try again with a different frame — the harvest, the year the river ran low, anything — and each time the question goes in and something else comes out, cheerful and adjacent and utterly empty. It isn't evasion. She isn't hiding a thing. There is no PAST TENSE here. There is only the current episode, and the current episode is going nicely.",
      { requires: { flag: FLAG, gte: 1 } }),

    bridge("chuckle_rung_2", "The Chair at the Table",
      "The woman at the corner table sets two places. She pours a second coffee, adds the sugar without asking, and talks across the empty chair in the easy rhythm of someone mid-conversation. Her daughter, she explains, is just off-screen at the moment. She says it exactly like that — off-screen — as if it were a location, like the porch, or the shop. She is not sad. She is not deluded, either, in any way you can put a finger on. She is simply waiting for the shot to come back around, and she has waited long enough that the waiting has stopped being a thing she notices.",
      { requires: { flag: FLAG, gte: 2 } }),

    bridge("chuckle_rung_3", "You Try to Leave With Someone",
      "He wants to come. He is delighted to come — he packs a comically small suitcase, waves to the whole street, walks with you to the edge of town telling a joke with a very long setup. And at the boundary he simply RESETS. Mid-sentence, mid-stride: he is back at the diner, hat tipped, suitcase gone, joke un-begun, greeting you with unfeigned pleasure as if you had just arrived. He does it again if you try again. He will do it as many times as you like, and he will never once be frightened, because nothing is happening to him. Nobody leaves Chuckle Creek. Leaving would require the episode to END, and the episode does not end.",
      { requires: { flag: FLAG, gte: 3 } }),

    bridge("chuckle_rung_4", "The Title Card",
      "You catch it between one moment and the next — the seam where a scene changes, which you had been reading as a trick of the light. It is a title card. It hangs in the air for less than a breath, hand-lettered, warm, the same every single time.\n\nIt is a memorial plaque. The names are on it. All of them. It has been on screen between every scene since you arrived, and probably for years before that, and not one person in this town has ever been able to see it, because seeing it would mean the episode acknowledged that something ended.\n\nThe whole town is a funeral that refuses to be one.",
      { requires: { flag: FLAG, gte: 4 }, priority: "high",
        choices: [{ label: "Find whoever is running this", next: "chuckle_showrunner", description: "", checkStat: "", checkDC: 0, failNext: "" }] }),

    // ── the reveal + the three doors ────────────────────────────────────────
    plain("chuckle_showrunner", "The Showrunner",
      "It is not hiding, and it is not hostile. It has been the pleasant background hum of this place the whole time — an Echo, or a half-formed godling spun out of pre-Shattering broadcast nostalgia, wearing the shape of somebody's favourite thing. (If the Tanneritos are already here, and they may well be, you'll find some of them half-inside it and not entirely sure when they last left.)\n\nIt found a town drowning. A plague, a raid, a Shattering-grief too large to hold — the details have been edited out, kindly. And it did the only mercy it understood: it CANCELLED THE CONSEQUENCES. It put them in a show where the dead are merely off-screen, the anvil never really lands, and nobody ever has to feel the end of anything, because the episode always continues.\n\nIt worked. That is the horror. These people are safe. They are also unable to grieve, unable to heal, unable to change, and unable to die — including the ones who ALREADY DID, and are only still standing because the show will not write them out. The mother's daughter is not off-screen. The tired boy with the piano is not tired by accident.\n\n**Mal:** *\"Nothing can hurt you here. Sit with how badly someone had to want that.\"*",
      { type: "dialog", timePoints: 1, choices: [
        { label: "Series Finale — let consequence back in", next: "chuckle_finale" },
        { label: "New Episode — keep the broadcast, kill the rerun", next: "chuckle_new_episode" },
        { label: "Cancelled — pull the plug now", next: "chuckle_cancelled" }
      ]}),

    plain("chuckle_finale", "Series Finale",
      "The credits roll, and the world comes back in all at once.\n\nEvery year of grief the show has been holding off arrives on the same afternoon. It is catastrophic catharsis: the town screams, and collapses, and holds each other in the street, and some of them will not come back from this in any way that matters — the ones who were only upright because the padding was there. The genuinely dead die properly at last, in the right order, and can finally be MOURNED, which is the thing none of them have been allowed to do. The mother sits down in front of an empty chair and understands it, and the sound she makes is the truest thing that has happened here in years.\n\nThe Showrunner watches its work finish, and finishes with it. No struggle. It was only ever trying to help.\n\nHealing, bought at the price of a town's single worst day. ⚙ GM: clear `noncanon`; the hex can be aligned now, and should carry the memory of what it cost.",
      { timePoints: 1, memoryText: "The coalition ended the broadcast at Chuckle Creek. The town felt every year of it at once, buried its dead properly, and can grieve again — at the price of its worst single day.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Series Finale — consequence restored; the dead mourned; the town devastated and free." }] }),

    plain("chuckle_new_episode", "New Episode",
      "You keep the broadcast and kill the rerun.\n\nSomeone has to write it, and the Tanneritos are exactly, almost embarrassingly, the right people — a faction that takes fun seriously as a load-bearing sacred thing rather than an anaesthetic. The town keeps its soft physics. But time starts moving in it: one real feeling per arc, dosed at a survivable rate, grief administered like medicine by people who genuinely mean well. The woman with the empty chair is told about her daughter across a season, gently, in instalments, and she survives it.\n\nIt is kind. It is sustainable. It works. And Chuckle Creek remains, forever, a managed fiction that never quite gets to be real — a town whose feelings are now on somebody else's schedule.\n\n⚙ GM: `noncanon` persists in a reduced form; alignment is possible but capped while the town is written rather than lived.",
      { timePoints: 1, memoryText: "The coalition became the new writers of Chuckle Creek — grief dosed at a survivable rate, forever. Kind, sustainable, and never quite real.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "New Episode — the broadcast continues under new authorship; the town heals slowly and stays a fiction." }] }),

    plain("chuckle_cancelled", "Cancelled",
      "You pull the plug, and the cartoon physics stop between one frame and the next.\n\nThe ones who were only still standing BECAUSE of them drop where they are, mid-gag, mid-laugh, without a word or a warning or a chance to be told. The living wake into a normal, lethal world in the middle of a joke none of them will ever finish. Somebody's anvil lands. The creek stops chuckling, which is somehow the worst part — the sudden ordinary sound of moving water where a friendly noise used to be.\n\nIt is the fastest peace available and the cruellest, and it is the one that asked the town's consent least. They will heal, eventually, the way anyone heals from an ambush. ⚙ GM: `noncanon` cleared hard; expect a morale/relationship cost with any faction that valued this place — and the Tanneritos will hear about it.",
      { timePoints: 0, memoryText: "The coalition cancelled Chuckle Creek without warning. The dead dropped where they stood. The creek stopped chuckling.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Cancelled — the bubble broken cold; fastest, cruellest, least consented." }] })
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id}${nb.inject?.requires ? ` (gated ${FLAG} ≥ ${nb.inject.requires.gte})` : ""}`);
  }

  console.log(`[seed-chuckle-creek] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Chuckle Creek DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Chuckle Creek: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-chuckle-creek-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Chuckle Creek APPLIED: ${changes} change(s). Nothing counts here.`);
})();
