/* seed-soft-landing.macro.js — SOFT LANDING: the Bouncy Castle Nation
 * 2026-08-18. Spec: new-content/bouncy-castle-nation-soft-landing.md
 * Family: the GRIEF-REFUSALS quartet — forget it (Wendigo) · don't-let-it-count
 * (Chuckle Creek) · freeze-before-it (Stillwater) · PAD AGAINST IT (here).
 *
 * Door-B drop-in wilderness hex for the River Heart spine. Works in Act 1–2 as
 * "even the easy flips have a wound", or in Act 4 as a hex that resists
 * alignment. Unlike Chuckle Creek there is NO Showrunner: this is
 * self-inflicted and load-bearing. The people are doing it, all of them, all
 * the time, because the day the padding thins is the day they have to feel
 * everything they have been bouncing off of.
 *
 * 🔑 THE UNUSUAL MECHANIC — READ BEFORE RUNNING:
 * Resolution is a VULNERABILITY CLOCK, not a skill check. Nothing here can be
 * forced: the hex physically absorbs force, so every heroic instinct the party
 * has is the wrong tool. The clock advances ONLY on player acts of genuine
 * grief or openness, GM-judged — somebody being willing to land first, in
 * front of them, and let it hurt. Do not set a DC. Do not let a good roll
 * substitute. The whole lesson is that going first and getting hurt is the
 * heroism, and making them get hurt is the villainy; the line between Restore
 * and Break is consent.
 *
 * ⚠ ENGINE WORK THIS SEEDER DOES NOT DO (story surface only):
 *  · the `cushioned` condition — nullifies impact/lethal damage and prevents
 *    consequence from landing, so it BLOCKS ALIGNMENT until resolved. Third
 *    flavour of the same substrate as `noncanon` (Chuckle Creek) and `stasis`
 *    (Stillwater).
 *  · the burnout timer: left alone the nation does NOT gently decline — too
 *    few people are left holding the armour up and it collapses all at once,
 *    which is precisely the uncushioned mass-landing they built everything to
 *    avoid. Delay = the Break ending, by accident and worse.
 *  Until then the GM drives:  flags.fourththing.softlanding.give  (0–4)
 *
 * DRY_RUN default true. Idempotent. Backs up campaigns before writing. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const Q  = "quest_soft_landing";
  const FLAG = "softlandingGive";
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
      id: Q, v: 1, name: "Soft Landing", status: "active", campaignId,
      description: "A whole nation lives in glorious, permanent bounce — inflatable ramparts, foam streets, a law that nothing may ever land hard. It is joyful and silly and you will laugh. It is soft because these are people so broken by loss that one more hard impact would shatter them, so they built a world that physically cannot let anything land. Nothing can hurt you here, and nothing can heal either, because healing requires landing. The only tool that works is being willing to go first.",
      tags: [], createdTs: Date.now(), updatedTs: Date.now()
    };
    changes++; report.push("✚ quest registered: Soft Landing");
  } else report.push("· ok quest (already) Soft Landing");

  const bridge = (id, label, description, { requires = null, priority = "background", timePoints = 0, questEffects = null, choices = null, type = "dialog" } = {}) => ({
    id, label, type, timeScale: "scene", timePoints,
    questId: Q, tags: "soft_landing grief_refusals story discovery", politicalTags: "",
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
    storyChain: "soft_landing", priority,
    ...(questEffects ? { worldEffects: { questEffects } } : {})
  });

  const plain = (id, label, description, { timePoints = 0, choices = null, questEffects = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    questId: Q, tags: "soft_landing grief_refusals story discovery",
    description,
    ...(questEffects ? { worldEffects: { questEffects } } : {}),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  const BEATS = [
    bridge("soft_landing_arrival", "Soft Landing — Challenged by Pool Noodles",
      "The gate is an inflatable arch, sagging slightly in the middle, and the guards challenge you with pool noodles and immense seriousness. The streets give underfoot — you BOING faintly with every step, and by the third street you have stopped trying not to. Children ricochet between buildings. So do several adults, one of whom appears to be a minister of something. A formal state function is being conducted, with full ceremony, on a moon-bounce.\n\nSomebody misunderstands somebody and a swing gets thrown, and the world simply absorbs it — the fist lands in foam, the foam apologises, everyone laughs. Nobody can be hurt here. The first time your party clocks that, it reads as paradise.\n\n⚙ GM: let them play. Let them LOVE it. Rung 0 is sitting in plain sight for anyone who looks twice — even the cutlery is foam. The softness isn't whimsy. It is total, and someone is afraid of every edge in the world.",
      { priority: "high", type: "skill_scene",
        questEffects: [{ action: "accept", questId: Q, text: "A nation where nothing is allowed to land hard. It is a delight. It is also armour, and somebody is very tired of holding it up." }] }),

    bridge("soft_landing_give_1", "The Conversation Bounces",
      "You ask about someone's past. Not intrusively — just the ordinary question you'd ask anyone: where are you from, who did you come here with, what did you do before.\n\nAnd the question BOUNCES. Not rudely. It is deflected with real warmth, redirected into a joke, absorbed and returned as something lighter, every single time, by every single person, with a fluency that no group of people arrives at by accident. They are not avoiding grief carelessly. They have engineered the deflection, and they have practised it for years.",
      { requires: { flag: FLAG, gte: 1 } }),

    bridge("soft_landing_give_2", "No Graves, No Photographs",
      "You go looking, once you start wondering, and the absence is total.\n\nThere are no graves. No memorial stones, no plaques, no cairns, not so much as a name scratched into a wall. There are no old photographs in any house you are invited into, and you are invited into several, warmly. There is no monument to anything. There is no ARCHIVE.\n\nThis is not a people who moved on. Moving on leaves traces. These people made remembering structurally impossible, on purpose, as civic policy — and then padded the policy so it wouldn't hurt to touch.",
      { requires: { flag: FLAG, gte: 2 } }),

    bridge("soft_landing_give_3", "The Elder Who Isn't Bouncing",
      "You find her sitting apart, and it takes you a moment to work out what is wrong with the picture, because it is nothing loud: she is STILL. Not bouncing. Sitting on a foam bench that has gone flat under her and not springing back, hands loose, looking at the middle distance with the particular exhaustion of someone who has been carrying something heavy for a very long time in a place where nobody is allowed to notice weight.\n\nThe padding near her is thin. You can feel it when you walk over — the give is gone, the ground has an edge to it again, in a radius of about four feet around one tired woman.\n\nThe armour takes constant effort. All of them, all the time. Some are simply too exhausted to keep it up any more.",
      { requires: { flag: FLAG, gte: 3 }, priority: "high" }),

    bridge("soft_landing_give_4", "One Held Breath",
      "You learn what happened. Somebody finally tells you, in a small room, quietly, badly, because they have never once said it out loud and the words come out in the wrong order.\n\nA plague, or a flood, or a Shattering-grief that took nearly everyone's nearly-everyone inside a single stretch of days. And the survivors did the only thing that kept them upright: they refused to let the impact land.\n\nNot by forgetting it. Not by deciding it doesn't count. Not by freezing before it. They padded every surface of their lives so that no feeling could ever hit bottom — and it WORKED, and they survived, and they have been falling ever since, cushioned, for years, never healing, because healing requires landing.\n\nThey are not happy. They are bracing, forever, and calling it joy.\n\n**Mal:** *\"They didn't build this to be happy. They built it so they'd never have to hit the ground. Somebody has to go first. It's going to hurt. That's the point.\"*",
      { requires: { flag: FLAG, gte: 4 }, priority: "high",
        choices: [{ label: "Decide what to do", next: "soft_landing_choice", description: "", checkStat: "", checkDC: 0, failNext: "" }] }),

    plain("soft_landing_choice", "The Only Weapon Left",
      "Every heroic instinct your party has is the wrong tool here. You cannot toughen them up. You cannot make them face it — the hex literally absorbs force, and always will. There is no enemy to defeat, no Showrunner to switch off, no seal to break. The people ARE the mechanism.\n\nThe only thing that thins the padding is somebody being willing to land first. To grieve openly, in front of them, and let a real hard feeling hit the foam floor where everyone can see it — and by doing it, give them permission to do the same. Vulnerability is the only weapon that functions in a city which disarmed every other one.\n\n⚙ GM — THE UNUSUAL PART: this resolves on a VULNERABILITY CLOCK, not a check. Do not set a DC and do not let a good roll stand in for it. The clock moves only when a player chooses openness over competence — a real named loss, a real admission, a real goodbye offered by a character who could have deflected and didn't. If the table reaches for a mechanic, that IS the hex working as designed; let the foam absorb it and wait.",
      { type: "dialog", timePoints: 1, choices: [
        { label: "Go first — grieve with them, openly", next: "soft_landing_go_first" },
        { label: "Build them a landing ground to practise on", next: "soft_landing_practice" },
        { label: "Strip the padding — harden the hex", next: "soft_landing_harden" }
      ]}),

    plain("soft_landing_go_first", "Somebody Goes First",
      "One of you lands.\n\nA real name, a real loss, said out loud in the middle of a foam street to a nation of people who have not permitted themselves that in years — and it hits the ground in front of them, and it is awful, and nobody bounces.\n\nThen the tired elder stands up and lands hers. Then, slowly, with terrible reluctance and enormous courage, so does a town. They hold one true funeral for everyone at once, by consent, together: names read, weight allowed, the padding thinning wherever people are ready and staying thick where they are not. It is the worst day they have had in years and the first real one.\n\nSome finally heal. A few, too far gone to survive the landing, shatter — and that is on the coalition's hands, and should stay there. The rest become real again: mortal, present, ALIVE rather than merely intact.\n\n⚙ GM: clear `cushioned` where consent was given; the hex can align now, and it aligns as a place that grieved properly.",
      { timePoints: 1, memoryText: "Someone in the coalition went first at Soft Landing — a real loss, landed out loud — and the nation held its first funeral. The padding thinned by consent. A few did not survive it.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Go First — vulnerability offered, grief landed by consent; the nation became real again, at a cost." }] }),

    plain("soft_landing_practice", "The Landing Ground",
      "You don't pop it. You build them a place to practise.\n\nA graduated yard at the edge of town where the padding is deliberately, gradually thinner: somewhere a person can go and feel one small hard thing on purpose, at their own pace, and then leave. Rules they wrote themselves. A rota. Someone always on hand. The elder who was too tired to bounce becomes, without anybody appointing her, the one who sits with people while they do it.\n\nIt is kind and sustainable and slow, and it is a little paternalistic — you have installed a device for administering feeling to a nation that did not ask for one, and you have gone away pleased with yourselves. (Note the family rhyme: Chuckle Creek's New Episode, Stillwater's Covenant, this. The middle path is always MANAGED survival.)\n\n⚙ GM: `cushioned` persists but decays over Turns as the ground gets used; alignment unlocks gradually rather than at once.",
      { timePoints: 1, memoryText: "The coalition built Soft Landing a landing ground — a place to feel small hard things on purpose, at their own pace. Kind, slow, and a little paternalistic.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Practice Ground — graduated grief installed; the nation heals on its own schedule under a device it didn't ask for." }] }),

    plain("soft_landing_harden", "Harden the Hex",
      "You strip the padding, all of it, all at once.\n\nEvery deferred loss lands in the same instant on people who built an entire civilisation specifically so that it wouldn't. The air stops humming as the blowers die. The streets go hard mid-step and a nation of people who have not fallen properly in years all fall properly at the same time, which is exactly the uncushioned mass-landing they organised their whole existence to avoid.\n\nIt is fast. It is the cruellest available reading of 'they need to face reality', and it is indistinguishable, from the inside, from the disaster that made them this way — a second one, delivered by the people who arrived saying they wanted to help.\n\nThey will face it now. Some of them will not get up. ⚙ GM: `cushioned` cleared hard; apply the morale and relationship cost, and note that the collapse-by-neglect ending is mechanically identical — delay does this too, just without anyone to blame.",
      { timePoints: 0, memoryText: "The coalition stripped Soft Landing's padding without consent. Every deferred grief landed at once, on people who had built a nation to prevent exactly that.",
        questEffects: [{ action: "complete", questId: Q, state: "completed", text: "Harden — the padding torn away; mass landing without consent; the cruellest door." }] })
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id}${nb.inject?.requires ? ` (gated ${FLAG} ≥ ${nb.inject.requires.gte})` : ""}`);
  }

  console.log(`[seed-soft-landing] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Soft Landing DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Soft Landing: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-soft-landing-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Soft Landing APPLIED: ${changes} change(s). Somebody has to go first.`);
})();
