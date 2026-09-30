/* seed-trojan-gift-retrofit.macro.js — A GIFT. (NOT A TROJAN.) to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/TROJAN_GIFT_RETROFIT_2026_09_30.md. NEW actors Pernelle Oday (Clerk of the Gate; catalogued the coastal archives) and Sergeant
 * Absalom Reyes (of the Eleven; they knock first). The Vacancy's book as a door (Pilgrim Wick). THE ELEVEN (a knock with a fail beat).
 * THE CLAUSE = the turn (receipt THE CLAUSE; spends THE YEAR-ZERO ENTRY from the Siege → THE SAME HAND). Script reordered so the last step
 * reaches the closers (lint SC06) and the Touring Gift chapter rides in `after`. The sender stays an owner slot. Idempotent; backs up.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "trojan_gift", Q = "quest_trojan_gift";
  const MARKER = "[TROJAN-GIFT-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const actors = game.actors?.contents || [];

  // ── 1. cast ────────────────────────────────────────────────────────────────
  const CAST = [
    { key: "oday", name: "Pernelle Oday", topics: "the gate, manifests, the ribbon, the clause, gift-debt, the old kind, the coastal archives, the one other instance, the siege, what she will not touch",
      notes: `${MARKER} PRIVATE TRUTH — Pernelle Oday, Clerk of the Gate, who once catalogued the coastal archives and has never quite come back. VOICE: precise, unhurried, reads everything twice; pushes paper she does not like away from herself with one finger and will not say why until asked directly. THE CLAUSE: she recognized it on the second read. A GIFT-DEBT instrument, the old kind, 'the undersigned, their heirs, their houses, and their harvests.' THE ONE OTHER INSTANCE: year zero of the Fifteen-Year Siege, under the ribbon of a fruit basket, refused at a gate by a warden who READ it first. She knows this because she catalogued the ledger it is written in, and she has never told the warden's granddaughter, because it was not hers to tell. THE SENDER: she does not know and will not guess; the signature will not be read and she has stopped trying, because the third time she tried she could not remember her own name for an hour. TELLS: keeps her hands flat on the table when the clause is on it; says 'the instrument' never 'the gift.'`,
      secrets: [
        "The Only Other Instance :: rollPlus2 :: a Steward asks what she catalogued :: Year zero of a certain siege: a basket, a ribbon, the same paper, refused at a gate by a warden who read it first and chose fifteen years of siege over one signature. The record is deafeningly interesting on that point.",
        "The Signature :: coverTracks :: a Steward asks her to read the signature :: She has tried three times. The third time she could not remember her own name for an hour. She will not try a fourth, and she will not let you."
      ] },
    { key: "reyes", name: "Sergeant Absalom Reyes", topics: "the Eleven, the knock, the card game, the uniforms, the pantry, the manifest, who hired them, the berth (guarded), being polite",
      notes: `${MARKER} PRIVATE TRUTH — Sergeant Absalom Reyes commands the Eleven: eleven soldiers in immaculate uniform who rode inside the gift and knocked before they came out, because they were told to, in writing. VOICE: parade courtesy with a card-player's patience; answers exactly the question asked and no other; salutes when unsure, which is often. WHAT THEY ARE: the decoy. They know they are the decoy. They were hired through a notary, paid in advance in coin so old they had to be told what it was, with a letter of instruction whose signature none of them could read, and the letter said: be polite, knock first, do not look in the berth. THE BERTH (guarded): they did not look. One of them heard it breathing, once, the way a plinth would if it breathed. Reyes does not repeat this. TELLS: shuffles a deck when the sender comes up; counts his men, eleven, every time a door opens.`,
      secrets: [
        "The Knock :: rollPlus2 :: a Steward asks why they knocked :: They were told to, in writing, by a hand none of them could read: be polite, knock first, do not look in the berth. They did not look. One of them heard it breathing, once.",
        "Who Hired Us :: favorPlus1 :: a Steward asks who paid :: A notary, in advance, in coin so old they had to be told its name. They never saw a face. They have stopped wondering, which the sergeant admits is the strangest part."
      ] }
  ];
  const actorIds = {};
  for (const c of CAST) {
    let a = actors.find(x => x.name === c.name);
    if (!a) { say(`✚ CREATE actor "${c.name}"`); changes++; if (!DRY_RUN) a = await Actor.create({ name: c.name, type: "npc" }); }
    if (!a) continue; actorIds[c.key] = a.id;
    const cur = a.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${c.name}`); continue; }
    changes++; say(`✚ persona ${c.name} +${c.secrets.length} secrets`);
    if (!DRY_RUN) await a.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), c.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), c.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...c.secrets].filter(Boolean).join("\n") });
  }
  const wick = actors.find(a => a.name === "Pilgrim Wick");
  const ODAY = actorIds.oday || null, REYES = actorIds.reyes || null, WICK = wick?.id || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["trojan_arrival", "trojan_accept", "trojan_inspect", "trojan_paperwork", "trojan_compartment", "trojan_refuse", "trojan_regift", "trojan_tour", "trojan_tour_kept"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Gift was never seeded here.`);

  const TAGS = "trojan_gift story";
  const P3 = { flag: "storyPhase", gte: 3 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, repeatable = false } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("trojan_betting_pool", "The Vacancy Runs the Book",
      "Of course the Vacancy runs the book. Pilgrim Wick has a slate, a stub of chalk, and odds on what is inside the gift that he updates every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in Wick's own hand, and when you ask he looks pleased in a way that makes you want to check your pockets.",
      { speaker: WICK, requires: [P3, { beatMark: "trojan_arrival" }], repeatable: true, choices: [
        ch("Bet SOLDIERS.", "", { description: "\"Everybody's bet soldiers,\" Wick says. \"That's how you know.\"" }),
        ch("Bet PAPERWORK.", "", { description: "He writes it down and underlines it, which he does not do for the others." }),
        ch("Ask what Wick bet.", "", { description: "\"Empty.\" He does not explain. He looks like a man who has already been paid." })
      ] }),
    beat("trojan_the_eleven", "Layer One — The Eleven",
      "Eleven soldiers in uniforms too clean for the inside of a crate, and a sergeant who salutes you because he is not sure of the protocol for being a decoy. They are the Eleven. They know they are the decoy; they were told so, in writing, by a hand none of them could read, along with three instructions: be polite, knock first, do not look in the berth. They did not look in the berth. \"We were paid in advance,\" says Sergeant Reyes, shuffling a deck he did not have a second ago, \"in coin so old they had to tell us its name. And a pantry, stocked. With our favourites. Specifically.\" He counts his men. Eleven. He does that every time a door opens.",
      { speaker: REYES, requires: [P3, { beatMark: "trojan_arrival" }], choices: [
        ch("Ask who sent them.", "", { description: "\"A notary. We never saw a face.\" He looks at the deck. \"We've stopped wondering. That's the strange part, isn't it. Sir.\"" }),
        ch("Ask about the berth.", "", { description: "The deck stops. \"We did not look.\" A pause. \"One of the lads heard it breathing. Once. The way a step would, if a step breathed.\" He does not repeat it." }),
        ch("Show them the Sideways Manifest.", "", { requires: { beatMark: "map_port_kudzu_testimony" }, description: "The sergeant reads the hull stencil twice. \"That's our crate's shipper,\" he says. \"Same yard. Same clerk's hand on the lading.\" Whoever sends gifts also sends things sideways, and has a shipping account." }),
        ch("Ask what's under the ribbon.", "trojan_paperwork", { description: "\"We were told not to read it either.\" He looks relieved to be handing it to somebody." })
      ] }),
    beat("trojan_knock_fail", "Layer One — Nobody Answered",
      "You did not answer the knock, and the panel stayed shut, politely, all night. At breakfast the Eleven let themselves out, file into the yard in order of height, and apologize, as a unit, for the imposition. You have lost whatever initiative there was to lose, and the sergeant, who knows it, offers you the deck to cut, which is the kindest thing anyone does all week.",
      { speaker: REYES, requires: [P3, { beatMark: "trojan_accept" }], choices: [
        ch("Talk to the sergeant anyway.", "trojan_the_eleven"),
        ch("Read the paperwork.", "trojan_paperwork")
      ] }),
    beat("trojan_same_hand", "Layer Two — The Same Hand",
      "Pernelle Oday lays the Year-Zero Entry beside the clause and keeps both hands flat on the table, which is what she does when she does not want to touch something. Same paper. Same language, to the word: the undersigned, their heirs, their houses, and their harvests. The signature on the clause will not be read; the entry beside it was written by a woman who read it anyway and chose fifteen years of siege over signing. \"It is not the same gift,\" the clerk says. \"It is the same sender. Fifteen years apart. And the last time, a warden read it first, and there is a war with flowerbeds in it.\"",
      { speaker: ODAY, priority: "high", requires: [P3, { beatMark: "trojan_paperwork" }, { beatMark: "siege_year_zero" }],
        memoryText: "The Gift's clause and the Siege's year-zero entry are the same paper in the same hand, fifteen years apart: one sender, two gates.",
        choices: [
          ch("Search the rest of the crate.", "trojan_compartment", { description: "Whatever rode with the paper has a berth. Find it." }),
          ch("Refuse it after all, and say why.", "trojan_refuse", { description: "\"Better besieged than beholden.\" You quote a dead warden at a gate. It has been done before." }),
          ch("Forward it. With regards.", "trojan_regift", { description: "The clerk signs the card for you. Her hand is very steady." })
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  edit("trojan_arrival", b => { if (!(b.choices || []).some(c => c.next === "trojan_betting_pool")) b.choices = [...(b.choices || []), ch("See what the Vacancy's book says first", "trojan_betting_pool")]; }, "the book as a door");
  edit("trojan_accept", b => {
    b.speakerActorId = b.speakerActorId || REYES || null;
    const knock = (b.choices || []).find(c => /soldiers first/i.test(c.label));
    if (knock && knock.next !== "trojan_the_eleven") { knock.label = "Answer the knock"; knock.next = "trojan_the_eleven"; knock.checkStat = "soul"; knock.checkDC = 12; knock.failNext = "trojan_knock_fail"; knock.description = "It knocked. You are being asked to be the kind of house that answers."; }
    if (!(b.choices || []).some(c => c.next === "trojan_the_eleven" && !c.checkStat)) b.choices = [...(b.choices || []), ch("Deal with the soldiers first", "trojan_the_eleven")];
  }, "the knock (soul 12) + the Eleven");
  edit("trojan_inspect", b => { b.speakerActorId = b.speakerActorId || REYES || null; if (!(b.choices || []).some(c => c.next === "trojan_the_eleven")) b.choices = [ch("Talk to the sergeant, in front of everyone", "trojan_the_eleven"), ...(b.choices || [])]; }, "the Eleven, publicly");
  // THE CLAUSE is the turn
  edit("trojan_paperwork", b => {
    b.speakerActorId = b.speakerActorId || ODAY || null; b.timePoints = b.timePoints || 1; b.priority = "high";
    b.worldEffects = b.worldEffects || {};
    if (!(b.worldEffects.receipts || []).some(r => r.label === "The Clause")) b.worldEffects.receipts = [...(b.worldEffects.receipts || []), { label: "The Clause", effectKey: "oppRollMinus2", acquisition: "earned", source: { name: "under the ribbon of the gift" }, truth: "A GIFT-DEBT instrument, the old kind: the undersigned, their heirs, their houses, and their harvests. The signature will not be read. The paper is the same as the one refused at a gate fifteen years ago, the day a siege began. Anyone who knows what it binds goes quiet when it is on the table." }];
    if (!(b.choices || []).some(c => c.next === "trojan_same_hand")) b.choices = [ch("Lay the Year-Zero Entry beside the clause.", "trojan_same_hand", { requires: { beatMark: "siege_year_zero" }, description: "The clerk puts both hands flat on the table." }), ...(b.choices || [])];
    if (!(b.choices || []).some(c => /clerk/i.test(c.label))) b.choices = [...(b.choices || []), ch("Ask the clerk what else she has seen like it.", "", { description: "\"One other. Year zero of a certain siege. The warden read it first.\" She does not look up. \"There are flowerbeds now.\"" })];
  }, "the turn: Pernelle speaks, THE CLAUSE, the same hand");
  edit("trojan_compartment", b => { b.speakerActorId = b.speakerActorId || ODAY || null; }, "speaker");

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for trojan_gift not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    SCRIPT.giver = "Six oxen and a rehearsed exit. Nobody signs for it. The Vacancy is already taking bets.";
    SCRIPT.steps = [
      { id: "gate", label: "At the Gate", line: "Something enormous is at your gate and the drovers have already left. Check the Vacancy's odds before you decide what it is.", beats: ["trojan_arrival"] },
      { id: "layer_one", label: "Layer One", line: "Bring it inside or open it with bleachers. Either way, something inside is going to knock first.", beats: ["trojan_accept", "trojan_inspect"], done: { anyOf: ["trojan_accept", "trojan_inspect"] } },
      { id: "eleven", label: "The Eleven", line: "Eleven soldiers who know they are the decoy. Ask why they knocked. Do not ask about the berth unless you mean it.", beats: ["trojan_the_eleven", "trojan_knock_fail"], done: { mark: "trojan_the_eleven" } },
      { id: "clause", label: "The Clause", line: "Under the ribbon: paperwork. The clerk reads it twice and pushes it away with one finger. Ask her what else she has seen like it.", beats: ["trojan_paperwork"], done: { mark: "trojan_paperwork" } },
      { id: "berth", label: "The Berth", line: "Behind a panel behind a panel. If you have the Siege's year-zero entry, lay it beside the clause first; the hand is the same.", beats: ["trojan_same_hand", "trojan_compartment"], done: { quest: KEY } }
    ];
    SCRIPT.doors = [
      { id: "book", label: "The Vacancy's Book", line: "Wick has a slate and odds. EMPTY is forty to one and has one bet on it. Ask whose.", beats: ["trojan_betting_pool"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "trojan_tour", "trojan_tour_kept"]));
    SCRIPT.chapters = { ...(SCRIPT.chapters || {}), the_touring_gift: { giver: "the turn's reports", line: "The gift moved on. Follow the reports, let it tour, or find out who finally keeps it." } };
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script trojan_gift → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, tour in after)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-trojan-gift-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Trojan Gift retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Trojan Gift retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-trojan-gift-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Trojan Gift retrofit APPLIED: ${changes} change(s). With regards, and onward. F5.`);
})();
