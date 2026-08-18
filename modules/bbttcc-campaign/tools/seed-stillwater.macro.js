/* seed-stillwater.macro.js — STILLWATER: the town that doesn't know it ended
 * 2026-08-18. Spec: new-content/time-warp-hex-stillwater.md
 * Family: the GRIEF-REFUSALS quartet. Chuckle Creek's SIBLING — both refuse
 * time. Chuckle Creek loops after the wound and denies it counts; Stillwater
 * froze BEFORE the wound and never let it arrive. Present them as a pair.
 *
 * Act-4 hex, natural occupant of the YNNERMIRE band (River Heart wilderness).
 * A dramatic-irony engine: you enter charmed, and the charm becomes a question
 * you cannot un-ask. There is no monster in this hex. You are the monster,
 * because you are carrying the news.
 *
 * ⚠ ENGINE WORK THIS SEEDER DOES NOT DO (story surface only):
 *  · the `stasis` condition (unbroken-Yesod / anti-responsive) — suppresses
 *    responsive-reality effects inside the bubble and BLOCKS ALIGNMENT until
 *    resolved. Structural twin of `noncanon` (Chuckle Creek) and `cushioned`
 *    (Soft Landing); build the three as one substrate.
 *  · INTACT YESOD as a distinct, higher-grade resource. Khezek Tor's ore is
 *    "Yesodium before identity"; Stillwater is Yesodium that never LOST its
 *    identity. Ties to the Sink / Monodynamic threads and makes this hex a
 *    thing the Valhaulans and Monodynamic both covet.
 *  · the crack meter as an IF-IGNORED TIMER: it should rise every Turn on its
 *    own and blow the bubble at max — the worst possible Restore, uncontrolled.
 *  Until then the GM drives it:  flags.fourththing.stillwater.crack  (0–4)
 *
 * DRY_RUN default true. Idempotent. Backs up campaigns before writing. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const Q  = "quest_stillwater";
  const FLAG = "stillwaterCrack";
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
      id: Q, v: 1, name: "Stillwater", status: "active", campaignId,
      description: "A perfect little pre-Shattering town — porch lights, fresh coffee, a Sunday that never ends — where nobody knows the world died, because here it never did. They are living the last unbroken hour of the old reality, on a loop so gentle none of them feel the groove. Your problem is that you are the first piece of AFTER to walk through the door. The water really is unnervingly still. Nothing has dropped a stone in it for a very long time.",
      tags: [], createdTs: Date.now(), updatedTs: Date.now()
    };
    changes++; report.push("✚ quest registered: Stillwater");
  } else report.push("· ok quest (already) Stillwater");

  const bridge = (id, label, description, { requires = null, priority = "background", timePoints = 0, questEffects = null, choices = null, type = "dialog" } = {}) => ({
    id, label, type, timeScale: "scene", timePoints,
    questId: Q, tags: "stillwater grief_refusals story", politicalTags: "",
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
    storyChain: "stillwater", priority,
    ...(questEffects ? { worldEffects: { questEffects } } : {})
  });

  const plain = (id, label, description, { timePoints = 0, choices = null, questEffects = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    questId: Q, tags: "stillwater grief_refusals story",
    description,
    ...(questEffects ? { worldEffects: { questEffects } } : {}),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  const BEATS = [
    bridge("stillwater_arrival", "Stillwater — A Sunday That Doesn't End",
      "After a hundred miles of land that bites and remembers and holds opinions, Stillwater is SOFT. Cut grass. Percolator coffee. A kid selling lemonade at a card table with a hand-lettered sign. The diner has pie that is simply pie, made by a person, for money. People wave — not warily, not for advantage. Just waving.\n\nAnd it is the most unsettling thing you have felt in a very long time, precisely because nothing here is wounded or watching. The land is only land. A dropped glass just breaks, and means nothing, and someone sweeps it up.\n\nThe tell arrives gently, and you almost miss it. Somebody hands you today's paper. The ink is wet. The date is wrong by an impossible margin — years wrong, a whole world wrong — and it is TODAY'S paper, and tomorrow it will say the same.\n\n⚙ GM: let them exhale first. The horror is entirely in the arithmetic and it works better if the table has already relaxed. Rung 0 is the newspaper.",
      { priority: "high", type: "skill_scene",
        questEffects: [{ action: "accept", questId: Q, text: "A town living the last hour before the Shattering, on a loop. They don't know. You do." }] }),

    bridge("stillwater_crack_1", "The Topic Slides Off",
      "You mention the world outside. Not dramatically — you just refer to it, the way anyone would: the roads, the raids, the way things are now. And the faces across the table go politely, pleasantly blank, the way a face does when someone speaks a language it doesn't have, and then the conversation simply continues around the shape of what you said. Somebody asks if you want more coffee.\n\nYou try it four different ways. It slides off every time. They are not refusing the subject. They cannot PERCEIVE it. There is no after, here, for the words to land in.",
      { requires: { flag: FLAG, gte: 1 } }),

    bridge("stillwater_crack_2", "The Woman at the Station",
      "She is on the platform bench with her hands in her lap, coat buttoned, entirely content. She is waiting for the 4:10, and for her son, who is on it. She tells you about him with the specific unhurried warmth of someone who expects to be interrupted by an arrival at any moment.\n\nThere has not been a train on this line in decades. There has not been a line. You work out, doing arithmetic you wish you hadn't started, roughly how long she has been sitting on that bench being happy, and the number does something to you that the town cannot do to itself.\n\nThey are all waiting, in one way or another, for a tomorrow that already didn't come.",
      { requires: { flag: FLAG, gte: 2 } }),

    bridge("stillwater_crack_3", "One of Them Sees It",
      "You show them proof. A relic of the ruined world — something with the after all over it, unmistakable, undeniable.\n\nMost eyes slide off it like everything else. One does not. One man looks at the thing in your hand and actually SEES it, and you watch comprehension arrive in his face like weather.\n\nAnd he begins to age. In real time, in front of you: the decades the bubble has been holding off arrive in his body over the course of about a minute, and he sits down heavily on the kerb, and he is old, and he understands everything, and he is the only person in this town who does.\n\nKnowing breaks the spell. Truth here is a fatal gift, and you have just handed one out to see what would happen.",
      { requires: { flag: FLAG, gte: 3 }, priority: "high" }),

    bridge("stillwater_crack_4", "The Wall Is Thinning",
      "At the edge of town, where the road runs out into the Ynnermire, the air has a grain to it — like a held note going slightly sour. The Shattering is leaking in at the seams, slowly, on its own schedule, and it has been for some time.\n\nThe choice was never whether the spell ends. It ends. The bubble is failing and nothing you do will save it.\n\nThe only thing left to decide is HOW — and whether anybody in there gets told first.\n\n**Mal:** *\"They're not waiting for a train. They're waiting for permission to have lost it. You're the only one here who can give it.\"*",
      { requires: { flag: FLAG, gte: 4 }, priority: "high",
        choices: [{ label: "Decide what to do about Stillwater", next: "stillwater_choice", description: "", checkStat: "", checkDC: 0, failNext: "" }] }),

    plain("stillwater_choice", "What You Do With the News",
      "There is no enemy in this hex. There is no monster, no Showrunner, nobody who did this on purpose. When the Shattering hit, this one place flinched so hard it simply did not let the next second happen, and has been not-letting it happen ever since. They are not prisoners. They are survivors who never found out they survived.\n\nSo the wound is yours. YOU ARE CARRYING THE NEWS, and the news is the apocalypse. Tell them, and you hand a peaceful town the worst thing that ever happened, and age them into a present where they will grieve and break and die like everyone else. Don't tell them, and you leave conscious people inside a beautiful lie — and walk away with the one intact piece of the old world kept safe behind their ignorance.\n\nEither way you decide, on their behalf, whether truth is worth more than peace. It is the oldest question this world asks, and there is not a single monster in the room to distract you from it.",
      { type: "dialog", timePoints: 1, choices: [
        { label: "Ring the bell — let time back in, with their consent", next: "stillwater_ring_the_bell" },
        { label: "Covenant — keep the bubble, in honest relationship", next: "stillwater_covenant" },
        { label: "Harvest it — take the Yesod, let the seal collapse", next: "stillwater_harvest" }
      ]}),

    plain("stillwater_ring_the_bell", "Ring the Bell",
      "You tell them. Not all at once, and not carelessly — you find the man who already knows, and together you find the ones who can bear hearing it, and they find the rest. You get consent where consent can be got. And then the held hour is allowed, finally, to end.\n\nStillwater ages into now. It is terrible to watch. Decades arrive in an afternoon; the woman on the platform stands up, and understands, and does not get her son. Porch lights fail. The coffee goes cold and stays cold. They grieve — enormously, and out loud, and for the first time — and they become real: mortal, present, free, and here.\n\nThe unbroken Yesod collapses into the responsive world along with the bubble. You traded the artifact for the people, which is the whole point, and everyone who wanted the artifact is going to have opinions. ⚙ GM: clear `stasis`; the hex can align now, and it aligns as itself.",
      { timePoints: 1, memoryText: "Stillwater was told. The last unbroken hour ended with the town's consent, and they aged into the world to grieve as real people. The intact Yesod went with it.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Ring the Bell — the bubble ended kindly; the people freed; the resource spent." }] }),

    plain("stillwater_covenant", "The Covenant",
      "You keep the bubble, and you stop lying about what it is.\n\nA careful membrane. Honest trade. A slow trickle of intact Yesod drawn off without breaking the seal, and a standing duty — written down, argued over, signed — never to deceive Stillwater more than the bubble already does. The man who aged becomes the interpreter, the one person on the inside who knows, which is a lonely job and he takes it anyway.\n\nIt is sustainable and genuinely useful and morally slippery in a way that will not stop itching. You are now the curators of a town that does not know it is an exhibit. The woman still waits for the 4:10. You have decided she may go on waiting, and you have decided it FOR her, and you have written down why.\n\n⚙ GM: `stasis` persists under management; intact-Yesod yields at a reduced, sustainable rate. Expect Valhaulan and Monodynamic interest to sharpen, not fade.",
      { timePoints: 1, memoryText: "A covenant was made with Stillwater: the bubble kept, the Yesod trickled out honestly, the town curated without its knowledge. One man inside knows.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Covenant — bubble preserved under honest management; sustainable yield; the town remains an exhibit." }] }),

    plain("stillwater_harvest", "Harvest",
      "You take it.\n\nThe intact Yesod comes out in one extraction, and it is a great deal — more clean Foundation than the coalition has ever held, worth more than most hexes are worth, and every faction that hears about it will understand exactly what you did.\n\nThe seal collapses on the way out. Stillwater gets the apocalypse in a single instant, with no warning, no preparation, and nobody to explain: porch lights die mid-flicker, the paper's ink goes decades dry in somebody's hands, and a town that was having a nice Sunday discovers the entire end of the world at once, standing up, in the street.\n\nThe woman on the platform is still sitting there afterward. She is just not waiting any more.\n\nFast, rich, and the most Monodynamic thing a coalition can do. Someone always pays; you decided it would be all of them, at the same time, for fuel. ⚙ GM: `stasis` cleared violently; grant the higher-grade Yesod resource; apply the relationship cost, and let somebody in the world say the quiet part.",
      { timePoints: 0, memoryText: "Stillwater was harvested. The coalition took the intact Yesod and the seal collapsed on a town that never got told. The still water finally moved.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Harvest — intact Yesod seized; the bubble collapsed uncontrolled; a whole town paid at once." }] })
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id}${nb.inject?.requires ? ` (gated ${FLAG} ≥ ${nb.inject.requires.gte})` : ""}`);
  }

  console.log(`[seed-stillwater] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Stillwater DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Stillwater: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-stillwater-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Stillwater APPLIED: ${changes} change(s). The ink is still wet.`);
})();
