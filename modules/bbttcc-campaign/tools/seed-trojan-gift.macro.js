/* seed-trojan-gift.macro.js — TROJAN WHATEVER: "A GIFT. (NOT A TROJAN.)"
 * (2026-07-13, spec: HEX-VIGNETTES-2026-07-08.md §4 + owner decisions:
 *  #4 Layer 3 = THE NINTH GUEST · #6 the gift-debt paperwork genuinely
 *  connects to the Fifteen-Year Siege's year zero)
 *
 * An enormous gift arrives at a player hex, conspicuously trojan-shaped.
 * The label reads "A GIFT. (NOT A TROJAN.)" — everyone knows the story; the
 * sender knows everyone knows. The actual game is nested: whatever you
 * expect inside, that's the decoy.
 *   Layer 1 (expected): soldiers. They expect to be found. Card game, snacks.
 *   Layer 2 (real): paperwork — an ancient GIFT-DEBT clause, the old kind
 *     (the same instrument the siege's year-zero basket carried).
 *   Layer 3 (payload): one passenger who needed into the hex unseen and paid
 *     the sender for the noise. THE NINTH GUEST — rendered EVIDENCE-ONLY
 *     (empty berth, exact payment, unreadable note, feet-worn floor). The
 *     Garden's owner slots (what the hundred hold / who left / can the rite
 *     repeat) are NOT touched, per do-not-improvise doctrine. Likewise the
 *     SENDER stays unattributed — owner canon slot, do not improvise.
 *
 * No engine edits — existing machinery:
 *  · quests: quest_trojan_gift (container) + quest_touring_gift (standing;
 *    accepted ONLY by the Re-Gift door → gates the touring chain beat via
 *    questBucket:active, repeatable each turn tick).
 *  · trojan_arrival — director bridge, GM-timed (no gate; stage it at any
 *    player hex): four doors — Accept / Inspect publicly / Refuse / RE-GIFT.
 *  · accept + inspect converge on the paperwork → the compartment (Layer 3).
 *    Refuse keeps the box at the border (and the berth opens from INSIDE).
 *    Re-gift starts the hot potato: one new layer of contents per stop.
 *  · quest_ninth_guest is deliberately NOT auto-touched (running this before
 *    the Founders' Garden count must not leak the Garden mystery) — the
 *    compartment beat + dossier page carry the evidence; connect by hand.
 *
 * All beats carry explicit timePoints (Turn Ledger). DRY_RUN default true;
 * idempotent (skips existing ids); backs up the campaigns setting. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const Q_TROJAN = "quest_trojan_gift";
  const Q_TOUR   = "quest_touring_gift";
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

  // ── quests ────────────────────────────────────────────────────────────────
  if (!quests[Q_TROJAN]) {
    quests[Q_TROJAN] = {
      id: Q_TROJAN, v: 1, name: "A Gift. (Not a Trojan.)",
      description: "An enormous gift has arrived at the gate, conspicuously, insultingly trojan-shaped. The label says it is NOT a trojan. Everyone knows the story; the sender clearly knows everyone knows; the town has started a betting pool (the Vacancy runs the book, of course). The actual game is nested: whatever you expect inside is the decoy. Accept it, inspect it, refuse it — or, in the great tradition of this coast, RE-GIFT it and let it be somebody else's parable.",
      tags: [], createdTs: 0, updatedTs: 0
    };
    changes++; report.push("✚ quest registered: A Gift. (Not a Trojan.)");
  } else report.push("· ok quest (already) A Gift. (Not a Trojan.)");
  if (!quests[Q_TOUR]) {
    quests[Q_TOUR] = {
      id: Q_TOUR, v: 1, name: "The Touring Gift",
      description: "The gift was re-gifted — forwarded to another faction with a new card attached — and the coast's strangest object is now IN CIRCULATION. It tours the map on the turn ticks, a diplomatic hot potato of growing legend, and at every stop its inventory gains exactly one more layer than the manifest admits. This quest stands open as long as the gift keeps moving. Nobody is sure what happens if it stops.",
      tags: [], createdTs: 0, updatedTs: 0
    };
    changes++; report.push("✚ quest registered: The Touring Gift");
  } else report.push("· ok quest (already) The Touring Gift");

  // ── beat shapes (house patterns) ──────────────────────────────────────────
  const bridge = (id, label, description, { requires = null, priority = "background", timePoints = 0, questEffects = null, choices = null, repeatable = false, cooldownTurns = 0 } = {}) => ({
    id, label,
    type: "dialog", timeScale: "scene", timePoints,
    tags: "trojan_gift story", politicalTags: "",
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
    storyChain: "trojan_gift",
    priority,
    ...(questEffects ? { worldEffects: { questEffects } } : {})
  });
  const plain = (id, label, description, { timePoints = 0, choices = null, questEffects = null, memoryText = null, type = "narration" } = {}) => ({
    id, label, type, timePoints, dialogueOffer: false,
    description,
    ...(questEffects ? { worldEffects: { questEffects } } : {}),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "" }]
  });

  const BEATS = [
    // ── arrival (GM-timed; stage it at any player hex) ───────────────────────
    bridge("trojan_arrival", "A Gift. (Not a Trojan.)",
      "It takes six oxen and a specialized wagon, and it stops exactly at the gate, where the drovers unhitch, tip their hats, and leave at a pace best described as REHEARSED. The thing is enormous. It is magnificent. It is, in shape, in joinery, in sheer wooden hubris, unmistakably a trojan — and stenciled across the front in letters a foot high: A GIFT. (NOT A TROJAN.) A card is tucked under the ribbon, immaculate hand, no signature you can resolve: WITH REGARDS. By nightfall the town has organized viewing shifts, three schools of thought, and a betting pool — the Vacancy runs the book, because of course it does. Everyone knows the story. The sender KNOWS everyone knows. That's the game. Whatever you expect inside, remember: that's the decoy.",
      { priority: "background", timePoints: 0,
        questEffects: [{ action: "accept", questId: Q_TROJAN, text: "An enormous gift, conspicuously trojan-shaped, labeled NOT A TROJAN. The betting pool is live. The sender is unattributed. The game is nested." }],
        choices: [
          { label: "Accept it — bring it inside", next: "trojan_accept", description: "", checkStat: "", checkDC: 0, failNext: "" },
          { label: "Inspect it publicly — embarrass the sender", next: "trojan_inspect", description: "", checkStat: "", checkDC: 0, failNext: "" },
          { label: "Refuse it — turn it back at the border", next: "trojan_refuse", description: "", checkStat: "", checkDC: 0, failNext: "" },
          { label: "RE-GIFT it — forward it with your own card", next: "trojan_regift", description: "", checkStat: "", checkDC: 0, failNext: "" }
        ] }),

    // ── accept: layer 1 at dinner ────────────────────────────────────────────
    plain("trojan_accept", "The Gift, Accepted — Layer One",
      "You bring it inside, because the alternative is admitting an inanimate object has out-positioned you. The panel opens on the second night — from the INSIDE, politely, with a knock first — and out file eleven soldiers in immaculate uniform, blinking in the lamplight, one of them still holding a hand of cards. They expected to be found. Being found is their JOB — they had snacks, a card game seventeen hands deep, and a laminated instruction sheet, step one of which reads 'BE DISCOVERED GRACIOUSLY.' Their sergeant presents arms, then presents something worse: the gift's MANIFEST, with paperwork folded under the ribbon copy. 'We're the decoy, you understand,' the sergeant says, apologetically. 'We're always the decoy. You'll be wanting to read that.' (⚙ GM: the soldiers integrate into hex society awkwardly and permanently — they are excellent at cards and terrible at leaving.)",
      { timePoints: 0.5, memoryText: "The gift was accepted. Layer one: eleven ceremonial soldiers who expected to be found, mid-card-game. They pointed, apologetically, at the paperwork.",
        choices: [
          { label: "Read the paperwork", next: "trojan_paperwork" },
          { label: "Deal with the soldiers first", next: "trojan_paperwork" }
        ] }),

    // ── inspect: layer 1 in front of everyone ────────────────────────────────
    plain("trojan_inspect", "The Public Inspection",
      "You open it at noon, in front of everyone, with bleachers — if the sender wanted theater, they can have AUDITED theater. The panel comes away to reveal eleven soldiers at a folding table, mid-card-game, who freeze, sigh, and then WAVE, to scattered applause; the betting pool pays out the 2:1 favorites before the cheering stops. It is a genuine soft-power triumph — the sender's pantomime dismantled in daylight, the whole coast laughing WITH you (⚙ GM: award the softpower win; the sender's embarrassment travels). It is only later — days later, when someone finally reads the manifest's ribbon-copy properly — that the timing resolves: while every eye in the hex was on the bleachers, the crowd, the wave, the payout… something else finished happening quietly. The distraction was never the soldiers. The distraction was YOU, inspecting.",
      { timePoints: 0.5, memoryText: "The gift was inspected publicly — the sender embarrassed, the soldiers applauded, the softpower win banked. The real cargo used the show as cover, which was the design.",
        choices: [
          { label: "Read the paperwork properly", next: "trojan_paperwork" }
        ] }),

    // ── layer 2: the clause ──────────────────────────────────────────────────
    plain("trojan_paperwork", "Layer Two — The Clause",
      "Under the ribbon: paperwork. Old paper, older language, and a clause that your clerk reads twice, sets down, and pushes away from herself with one finger. It is a GIFT-DEBT instrument — the OLD kind, the kind that binds acceptance to obligation down generations, 'the undersigned, their heirs, their houses, and their harvests.' The old kind. The kind you don't climb out of. Your clerk, who once catalogued coastal archives, says there is exactly one other documented instance of paper like this in the region's living memory: year zero of a certain siege, under the ribbon of a certain fruit basket, refused at a certain gate by a warden who — the record is suddenly, deafeningly interesting on this point — READ it first. (⚙ GM: the diplomacy hook is live — what the debt binds you to, and to WHOM, arrives at the pace of your choosing; the sender's identity is an owner canon slot.)",
      { timePoints: 0, memoryText: "Layer two: gift-debt paperwork, the old generational kind — the same instrument the Fifteen-Year Siege's year-zero basket carried. The soldiers were never the cargo.",
        choices: [
          { label: "Search the rest of the crate", next: "trojan_compartment" }
        ] }),

    // ── layer 3: the berth (evidence only — owner slots untouched) ───────────
    plain("trojan_compartment", "Layer Three — The Berth Was Already Empty",
      "Behind the soldiers' quarters, behind a panel behind a panel, there is a berth. Small, windowless, fitted like a ship's cabin — and EMPTY, in the way a room is empty when someone has just finished being in it carefully. The bed is made, hospital-cornered. On the pillow: payment, counted out EXACT, in coin so old your quartermaster has to look two of them up. Beneath the coin, a note in a hand that your eyes keep sliding off — you can see that it is writing; you cannot make it be words; the signature in particular refuses. And the floor. The floor of the berth is stone — who fits a wooden crate with a stone floor? — and it is worn, deeply, impossibly, in the shape of two feet, the way a doorstep wears. The way a plinth might. Whoever rode in the quiet of all that noise walked out unseen, paid exactly, and thanked you in a name that will not be read. (⚙ GM: evidence only — who they are and why they walk stays in the owner's drawer. If the Vacancy's ledger ever meets this note, side by side… that's a scene, not a sentence.)",
      { timePoints: 0, memoryText: "Layer three, found too late: a hidden berth, already empty — bed made, payment exact in old coin, an unreadable thank-you note, and a stone floor worn in the shape of two feet.",
        questEffects: [{ action: "complete", questId: Q_TROJAN, state: "completed", text: "The gift is solved and not solved: soldiers (decoy), gift-debt clause (real), and an empty berth (the payload walked out unseen, paying exact)." }] }),

    // ── refuse ───────────────────────────────────────────────────────────────
    plain("trojan_refuse", "Refused at the Border",
      "You turn it back at the border, formally, with witnesses — and the drovers do not return for it. Of course they don't. The gift SITS there, at the exact legal edge of your hex, gathering weather, legend, and — within a month — an economy: two competing tour guides, a woman selling commemorative sketches, a food cart. Refusing a gift of this order is a formal insult, and the paperwork (which you never opened, which everyone now knows you never opened) means the insult is on RECORD somewhere, accruing whatever insults of the old kind accrue. Your archivist notes, quietly, that the last documented refusal of paper like this is currently fifteen years old and has flowerbeds. And one morning, the tour guides report — thrilled, and then less thrilled — that a panel low on the gift's flank is hanging open. From the INSIDE. Whatever the manifest never admitted to has not waited for your decision. (⚙ GM: the insult chain is live at the pace of your choosing; the berth's evidence is out there now, walking.)",
      { timePoints: 0, memoryText: "The gift was refused at the border, where it sits gathering legend and a small economy. The insult is on record — the old kind. A panel was later found open from the inside.",
        questEffects: [{ action: "complete", questId: Q_TROJAN, state: "completed", text: "Refused — the insult chain is live, the gift is a landmark, and something left it from the inside anyway." }] }),

    // ── re-gift: the hot potato begins ───────────────────────────────────────
    plain("trojan_regift", "Re-Gifted (The Great Bad Eden Move)",
      "You do the thing the whole coast will be telling stories about for a generation: you do not open it, you do not refuse it — you ATTACH YOUR OWN CARD and forward the entire object, with courier honors, to another faction. ('WITH REGARDS,' your card says, because you are not above plagiarizing excellence, 'AND ONWARD.') The oxen are re-hired. The drovers, when they arrive, betray for one-tenth of a second what your gate watch swears was PROFESSIONAL RESPECT. The gift moves on. The problem is now diplomatic, mobile, and — per every account that filters back — GROWING: inventory at each stop lists one more layer than the manifest admits. (⚙ GM: pick the recipient; the touring chain arrives on the turn ticks from here. Note for the drawer: whatever rode the quiet compartment may have already stepped off — or may still be riding. The berth is sometimes reported warm.)",
      { timePoints: 0.5, memoryText: "The gift was RE-GIFTED — forwarded whole with a new card attached. It tours the map now, gaining one new layer of contents per stop, and the coast has a new parable.",
        questEffects: [
          { action: "complete", questId: Q_TROJAN, state: "completed", text: "Re-gifted — the hot potato is loose. The coast approves enormously and is very glad it isn't holding it." },
          { action: "accept", questId: Q_TOUR, text: "The gift is in circulation, one new layer per stop. Track it, or be tracked by it." }
        ] }),

    // ── the touring chain (turn ticks; one new layer per stop) ───────────────
    bridge("trojan_tour", "The Touring Gift (It Moves Again)",
      "Word arrives with the turn: the gift has moved on, and the reports have acquired the ritual cadence of weather news. At its latest stop the receiving faction found everything the manifest promised, PLUS one layer nobody shipped — the accounts vary by stop: a choir of clockwork birds already wound; a smaller, perfect replica of the gift itself; a pantry stocked with somebody's favorites, specifically; a ledger of every hand that has touched the crate, one line longer than it should be; a door inside that opens onto more inside. The hidden berth, when anyone thinks to check it, is always empty, always made up, and — in the versions people lower their voices for — sometimes warm. (⚙ GM: fire this as the gift reaching its next stop; improvise or roll the new layer; route the fallout — gratitude, panic, re-re-gifting — at your pleasure. The tour ends only if someone finally KEEPS it, which no one has yet been brave enough to try.)",
      { requires: { questBucket: Q_TOUR, is: "active" }, repeatable: true, cooldownTurns: 1, timePoints: 0,
        choices: [
          { label: "Follow the reports", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" },
          { label: "Let it tour (it will anyway)", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }
        ] })
  ];

  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id} (${nb.timePoints}d${nb.inject?.requires ? ", gated" : ""}${nb.inject?.repeatable ? ", repeatable" : ""})`);
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[seed-trojan-gift] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Trojan Gift DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Trojan Gift: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-trojan-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Trojan Gift APPLIED: ${changes} change(s). It is NOT a trojan. It says so right on the front.`);
})();
