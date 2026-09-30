/* seed-bandit-accord-retrofit.macro.js — THE BANDIT ACCORD to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/BANDIT_ACCORD_RETROFIT_2026_09_30.md; worksheet rulings 09-16 (Lady Ralph Maccio, she/her; refuse does not close; the ladder on
 * banditMercy stays). Voices: Maccio on the summit + every ending, Perch on the envoy. Armed secrets on both. NEW actor Sal Tench (keeper of
 * the stilt-hall, the tally post). THE BOOKS = the turn (receipt THE EXIT COLUMN; spends THE CARAVAN ROUTE and THE BACK-ROOM ROSTER; an audit
 * with a fail beat). THE FIRST PATROL after. Pronoun sweep on the five summit beats (the worksheet's ✏). Idempotent; backs up the campaigns setting.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "bandit_accord", Q = "quest_bandit_accord";
  const MARKER = "[BANDIT-ACCORD-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const actors = game.actors?.contents || [];

  // ── 1. cast ────────────────────────────────────────────────────────────────
  const lord = game.actors?.get?.("3EWTXjRqh06dmD0x") || actors.find(a => a.name === "Lady Ralph Maccio") || actors.find(a => a.name === "Bandit Lord Osmund Cree");
  if (!lord) say("✗ the Bandit Lord actor not found (3EWTXjRqh06dmD0x / Lady Ralph Maccio) — run patch-bandit-lord-lady-ralph-maccio first; voices skipped");
  const perch = actors.find(a => a.name === "Lieutenant Perch");
  const SAL = { name: "Sal Tench", topics: "the stilt-hall, neutral ground, the three channels, the tally post, moorings, the all-clear, who drowned here, the summit",
    notes: `${MARKER} PRIVATE TRUTH — Sal Tench keeps the stilt-hall where three channels argue, and it is neutral ground because every channel has drowned somebody off its steps and the hall keeps the tally on a post by the door, cut in with a knife, one notch a name, no names. VOICE: slow, few words, most of them about moorings; will not be hurried by anyone who arrived by punt. Sal is not a bandit and is not not a bandit; Sal is the hall. WHAT SAL KNOWS: who moors where tells you who is allied with whom this month; the reed-whistle all-clear has three dialects and the hall knows all three; Ralph Maccio has sat at the head of the long table exactly four times in fifteen years, and never with her books open until tonight. TELLS: counts moorings before answering anything; touches the tally post going in and out, like a doorframe.`,
    secrets: [
      "Neutral Ground :: coverTracks :: a Steward asks why the hall is neutral :: Because every channel has drowned somebody off these steps, and the post by the door keeps the count. No names. Nobody wants their notch read. That is what neutral means, out here.",
      "Four Times :: rollPlus2 :: a Steward asks how often the Lord comes here :: Four times in fifteen years. Never with the books. Tonight the books are open on the table, which means she has already decided, and is waiting to find out what."
    ] };
  const actorIds = {};
  let sal = actors.find(a => a.name === SAL.name);
  if (!sal) { say(`✚ CREATE actor "${SAL.name}"`); changes++; if (!DRY_RUN) sal = await Actor.create({ name: SAL.name, type: "npc" }); }
  if (sal) { actorIds.sal = sal.id; const cur = sal.getFlag(MAL, "persona") || {}; if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona Sal Tench +2 secrets"); if (!DRY_RUN) await sal.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), SAL.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), SAL.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...SAL.secrets].filter(Boolean).join("\n") }); } else say("· ok persona Sal Tench"); }
  const ARM = [
    [lord, [
      "The Exit Column :: stirThePot :: a Steward asks what the books are FOR :: Every spared crew, every bowl of soup, every reformed hire is a line in her ledger too, in a column she titled, privately, THE EXIT. She has been keeping the Stewards' books more accurately than the Stewards. She shows the page. It is longer than the bad column.",
      "The Payroll Night :: favorPlus1 :: asked plainly, once, when she knew the profession was finished :: Not a battle. A payroll. She sat in the stilt-hall with the pension ledger and understood that the Drowned South's future was a program some out-of-towners were running out of a fire station, and what she felt was RELIEF, and the relief frightened her more than any raid.",
      "The Name :: rollPlus2 :: someone says her name wrong, or asks about it :: She named herself after the greatest warrior of the pre-Shattering era and will explain the film, at length, and be wrong about most of it, and exactly right about the part that matters: the whole point was that he waited."
    ]],
    [perch, [
      "The Soup Was Real :: favorPlus1 :: a Steward refuses the eel jerky politely :: He yielded once, hands up in the reeds, spear in the mud, and what he remembers is not the fear. It is that the soup was real, and going back to camp unable to explain why that undid him.",
      "Four to Go :: rollPlus2 :: a Steward asks about his pension :: Nineteen years in the profession, four from pension, and his retirement now depends on a summit going well between people who ambushed each other for a living. He recites the years like a rosary."
    ]]
  ];
  for (const [a, secrets] of ARM) {
    if (!a) continue; const cur = a.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || "");
    if (raw.includes(MARKER)) { say(`· ok secrets ${a.name}`); continue; }
    changes++; say(`✚ secrets ${a.name} +${secrets.length}`);
    if (!DRY_RUN) await a.setFlag(MAL, "persona", { ...cur, secretsRaw: [raw.trim(), MARKER, ...secrets].filter(Boolean).join("\n") });
  }
  const RM = lord?.id || null, PER = perch?.id || null, SL = actorIds.sal || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["bandit_accord_opening", "bandit_envoy", "bandit_summit", "bandit_summit_accord", "bandit_summit_absorption", "bandit_summit_humiliation", "bandit_summit_refuse"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Bandit Accord was never seeded here.`);

  const TAGS = "bandit_accord story";
  const P2 = { flag: "storyPhase", gte: 2 };
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
  const ENDINGS = () => [
    ch("Sign the Accord — a banner, allied", "bandit_summit_accord"),
    ch("Absorb them — one Muster, no banner", "bandit_summit_absorption"),
    ch("Take the surrender — no seat at the table", "bandit_summit_humiliation"),
    ch("Refuse — no deal today", "bandit_summit_refuse")
  ];

  const NEW = [
    beat("bandit_books", "The Summit — The Books",
      "She turns the ledger around so it faces you, which no bookkeeper does, and taps a column with one finger. It is not the bad column. The heading, in her own hand, private until this second, is THE EXIT, and every line in it is a thing you did: a spared crew, a bowl of soup, a reformed hire with a number and a date. It is longer than the bad column. It has been longer for two months. \"I have been keeping your books,\" says Lady Ralph Maccio, \"more accurately than you have. Four hundred souls. I need to know what you are going to do with them before I sign anything, and I would like, for once in this profession, to be shown the arithmetic.\"",
      { speaker: RM, priority: "high", timePoints: 1, requires: [P2, { beatMark: "bandit_summit" }],
        memoryText: "Ralph Maccio opened her books at the stilt-hall: a column titled THE EXIT, every act of the Stewards' mercy as a line item, longer than the bad column.",
        receipts: [{ label: "The Exit Column", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Lady Ralph Maccio's ledger" }, truth: "A page of the Bandit Lord's own books: THE EXIT, every spared crew and bowl of soup and reformed hire, numbered and dated, in a bookkeeper's hand. Proof, to anyone who reads ledgers, that mercy is a program and the program is winning." }],
        choices: [
          ch("Audit the books out loud.", "bandit_books_audit", { checkStat: "mind", checkDC: 14, failNext: "bandit_books_audit_fail", description: "Nobody has audited her in fifteen years. She hands you the pen." }),
          ch("Lay the Caravan Route on the table.", "", { requires: { beatMark: "ag_caravan_route" }, description: "She reads it once. \"Those are my toll stations,\" she says. \"You've been paying my tolls in preserves.\" The pen moves, and a toll line becomes a trade line, and she does not look up while she does it." }),
          ch("Show her the Back-Room Roster.", "", { requires: { beatMark: "kt_back_room_roster" }, description: "Names. Her people, in a mine's good room, on a list nobody was meant to read. The bad column gets shorter and worse at the same time. \"Every ledger has a bad column,\" she says, very quietly. \"You don't read it aloud.\" She reads it aloud." }),
          ...ENDINGS()
        ] }),
    beat("bandit_books_audit", "The Audit — The Arithmetic Works",
      "It takes an hour and the whole hall watches, and at the end of it the arithmetic works, which nobody at the table expected, including the woman who wrote it. The pensions are fundable. They are fundable the moment the Muster carries the causeway tolls instead of collecting them, and the bad column stops growing, and the exit column does the rest. \"That,\" says Ralph Maccio, looking at you the way she looks at the end of the film, \"is a clerk's answer.\" It is the highest thing she says about anyone.",
      { speaker: RM, requires: [P2, { beatMark: "bandit_books" }], memoryText: "The Stewards audited the Bandit Lord's books at the stilt-hall and the pensions turned out to be fundable.",
        choices: [ch("Sign the Accord — a banner, allied", "bandit_summit_accord", { description: "She signs first. Bookkeepers do." }), ...ENDINGS().slice(1)] }),
    beat("bandit_books_audit_fail", "The Audit — The Bad Column",
      "You read the wrong line aloud. It is in the bad column, and it is a name, and half the hall knew him, and the reed-whistles outside stop for exactly the length of a breath. Ralph Maccio closes the book with two fingers. \"Every ledger has a bad column,\" she says, not unkindly. \"You don't read it aloud.\" The summit continues. It continues the long way, with the books shut, which is the only way most summits ever go.",
      { speaker: RM, requires: [P2, { beatMark: "bandit_books" }],
        choices: [ch("Apologize to the hall, and decide.", "", { description: "Sal Tench touches the post by the door. One more notch was not cut. That was the apology accepted." }), ...ENDINGS()] }),
    beat("bandit_stilt_hall", "The Stilt-Hall — Neutral Ground",
      "The hall stands where three channels argue, and Sal Tench keeps it, and it is neutral because every channel has drowned somebody off its steps and the post by the door keeps the count, cut in with a knife, one notch a name, no names. Sal counts the moorings before answering anything you ask, and the moorings tonight are three deep, and that is the answer.",
      { speaker: SL, requires: [P2, { beatMark: "bandit_envoy" }], repeatable: true, choices: [
        ch("Ask why the hall is neutral.", "", { description: "\"Every channel's drowned somebody here.\" A thumb on the post. \"Nobody wants their notch read.\"" }),
        ch("Ask how often the Lord comes here.", "", { description: "\"Four times. Fifteen years.\" A pause the length of a mooring. \"Never with the books.\"" }),
        ch("Read the moorings.", "", { description: "Who ties up next to whom tells you who is allied this month. Tonight everyone is tied up next to everyone. That has never happened." })
      ] }),
    beat("bandit_first_patrol", "The First Patrol",
      "The next turn the causeways have punts on them under a banner nobody has seen before, or under the Muster's, or under none, and the tolls are trade, and the reed-whistles are calling an all-clear in a dialect the hall says is new. Ralph Maccio is pouring at the Good Vibes Club with a bookkeeper's precision, or at the head of a column, or in her stilt-hall with the books shut, depending on what you signed. The pension math works. She checks it every night anyway. Old habits are the profession.",
      { speaker: RM, requires: [P2, { questBucket: Q, is: "completed" }],
        memoryText: "The Drowned South's punts patrol the causeways now; Ralph Maccio's pension math works and she checks it every night anyway.",
        choices: [ch("Continue", "", { description: "Somewhere out past the stilt-camps, a lieutenant four years from pension salutes a goat, out of habit, and means it." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  // pronoun sweep (worksheet ✏ 09-16) on the summit beats — the Lord is she; the lieutenant stays he
  const SWEEP = [[/Bandit Lord himself/g, "Bandit Lord herself"], [/closes his books/g, "closes her books"], [/like a man setting down/g, "like a woman setting down"], [/his pension/g, "her pension"], [/for his people/g, "for her people"], [/on his way out/g, "on her way out"], [/The Bandit Lord signs the/g, "Ralph Maccio signs the"], [/the Bandit Lord signs like/g, "Ralph Maccio signs like"], [/The Bandit Lord nods slowly/g, "Ralph Maccio nods slowly"]];
  for (const id of ["bandit_summit", "bandit_summit_accord", "bandit_summit_absorption", "bandit_summit_humiliation", "bandit_summit_refuse"]) edit(id, b => {
    for (const [re, to] of SWEEP) b.description = String(b.description || "").replace(re, to);
    if (!b.speakerActorId && RM) b.speakerActorId = RM;
  }, "she/her sweep + Maccio speaks");
  edit("bandit_summit", b => { if (!(b.choices || []).some(c => c.next === "bandit_books")) b.choices = [ch("Ask to see the books first.", "bandit_books", { description: "She was hoping you would." }), ...(b.choices || [])]; }, "the books before the decision");
  edit("bandit_envoy", b => {
    if (!b.speakerActorId && PER) b.speakerActorId = PER;
    if (!(b.choices || []).some(c => /jerky/i.test(c.label))) b.choices = [...(b.choices || []),
      ch("Take the eel jerky.", "", { description: "It is genuinely terrible. He beams. You have made a friend for exactly as long as it takes to chew." }),
      ch("Refuse it, politely.", "", { description: "He salutes. He did not mean to. You have his eternal respect and he would like the letter answered before his pension is." }),
      ch("Ask about the stilt-hall.", "bandit_stilt_hall")];
  }, "Perch speaks; the jerky; the hall");
  edit("bandit_arms_down_accept", b => { if (!b.speakerActorId && PER) b.speakerActorId = PER; }, "speaker");

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for bandit_accord not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const old = Object.fromEntries(SCRIPT.steps.map(s => [s.id, s]));
    SCRIPT.steps = [
      old.count, old.alive, old.queue, old.arms,
      { ...old.envoy, line: "A punt under a white rag. Lady Ralph Maccio requests a summit. Answer the lieutenant. Refuse the jerky politely; it earns more than eating it." },
      { id: "summit", label: "The Summit at the Stilt-Hall", line: "The stilt-hall where three channels argue. She has BOOKS. Ask to see them before you decide anything.", beats: ["bandit_summit"], done: { mark: "bandit_summit" } },
      { id: "books", label: "The Books", line: "A column titled THE EXIT, every bowl of soup a line item. Audit it out loud if you dare. Then sign, absorb, humiliate, or refuse.", beats: ["bandit_books", "bandit_books_audit", "bandit_books_audit_fail"], done: { anyOf: ["bandit_summit_accord", "bandit_summit_absorption", "bandit_summit_humiliation"] } }
    ].filter(Boolean);
    SCRIPT.doors = [
      { id: "hall", label: "The Stilt-Hall", line: "Sal Tench counts the moorings before answering anything. Count them yourself: who ties up next to whom is this month's map.", beats: ["bandit_stilt_hall"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "bandit_first_patrol"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script bandit_accord → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-bandit-accord-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Bandit Accord retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Bandit Accord retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-bandit-accord-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Bandit Accord retrofit APPLIED: ${changes} change(s). Four hundred souls. F5.`);
})();
