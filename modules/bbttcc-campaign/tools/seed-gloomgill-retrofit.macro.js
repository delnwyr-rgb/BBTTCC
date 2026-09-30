/* seed-gloomgill-retrofit.macro.js — GLOOMGILL to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/GLOOMGILL_RETROFIT_2026_09_27.md. The exam finally has an examiner: NEW actor Gloomgill (persona + 2 secrets), speaker on
 * every Gloomgill beat; the campaign's receipts become hidden answers on five questions; THE FINAL FACT epilogue (the paymaster = Mr Monocle / Monodynamic Industries, ruled 09-27
 * named — GM slot — then the turn); two doors (the Applause, the Scoreboard); lint SC06 fixed (closers out of step 3's done);
 * geography fixed (Lake Suspicious, not the Odaroloc). Full script → campaign.story.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "gloomgill", Q_MAIN = "quest_5obLcPkexYRVZqlg";
  const MARKER = "[GLOOMGILL-RETROFIT-2026-09-27]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const GLOOM = { name: "Gloomgill", topics: "the exam, the ten questions, energy, answers, receipts, the marsh, the lake, the microphone, the applause, the scoreboard, Oannes, the sea, instruction, cities, writing, counting, measuring, the math, the paymaster, the finale, the Stewards, Thatwards, next century",
    notes: `${MARKER} PRIVATE TRUTH — Gloomgill, He That Was Oannes. Came from the sea in instruction, not fire; taught the first cities writing, counting and measuring; people kept the convenient parts and forgot the rest; he checked the math, stopped teaching, and started quizzing. He appears where people are confident and wrong. Now: a game-show host who is also a marsh, in a sequined jacket, with a microphone that should not work under water and does. VOICE: bright, pedantic, delighted, twelve thousand years old; "No pressure!"; grades ENERGY, not answers; no eliminations today, just consequences; he asks all ten regardless. He knows the answers before he asks them (the GM holds the ledger: closed quests, endings, receipts held, meters). RECEIPTS: when a Steward produces one in answer he reads it aloud, all of it, and the marsh applauds each line. THE FINAL FACT (only after a pass): he names the paymaster behind the Valhaulans — the only place in the whole story it is said aloud; ⚙ GM (ruled 2026-09-27): the name is MR MONOCLE of MONODYNAMIC INDUSTRIES — said here and nowhere earlier; nothing before this beat hints at it. THE TURN (after the name, quieter): why he stopped teaching — "People kept the convenient parts. I checked the math. It was my math." Then bright again: "Same time next century?" Never break the bit for long.`,
    secrets: [
      "The Final Fact :: stirThePot :: a Steward who has PASSED the exam asks for the fact they didn't ask for :: He names the paymaster behind the Valhaulans — the only place in the story it is said aloud. ⚙ GM (ruled 2026-09-27): the name is MR MONOCLE of MONODYNAMIC INDUSTRIES — said here and nowhere earlier. Then, quieter: \"People kept the convenient parts. I checked the math. It was my math.\"",
      "Same Time Next Century :: rollPlus2 :: a Steward asks what the material WAS :: \"Your own lives. I only read the receipts. I have never once written a question.\""
    ] };
  let gl = (game.actors?.contents || []).find(a => a.name === GLOOM.name);
  if (!gl) { say(`✚ CREATE actor "${GLOOM.name}"`); changes++; if (!DRY_RUN) gl = await Actor.create({ name: GLOOM.name, type: "npc" }); }
  if (gl) { const cur = gl.getFlag(MAL, "persona") || {}; if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona Gloomgill +2 secrets"); if (!DRY_RUN) await gl.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), GLOOM.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), GLOOM.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...GLOOM.secrets].filter(Boolean).join("\n") }); } else say("· ok persona Gloomgill"); }
  const GID = gl?.id || null;

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["gloomgill_intro_scene", "gloomgill_question_1", "gloomgill_question_10", "gloomgill_passed", "a6_title_card"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — Gloomgill was never seeded here.`);

  const TAGS = "gloomgill story";
  const P6 = { flag: "storyPhase", gte: 6 };
  const beat = (id, label, description, { type = "dialog", choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, storeFacts = false } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_MAIN, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(GID ? { speakerActorId: GID } : {}), story: { quest: KEY }, ...(memoryText ? { memoryText } : {}), ...(storeFacts ? { storeFacts: true } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("gloomgill_applause", "Gloomgill — The Applause",
      "The marsh applauds. It is frogs, mostly, and something under the frogs that is not frogs, and it is unanimous and it does not stop. You bow. It gets louder. You bow again. Louder. You bow a third time, and the third round of applause comes back slower, from every reed at once, like a marsh that has just remembered how many shows it has sat through, and that is the only sad thing the applause will ever do.",
      { requires: [P6], choices: [ch("Bow once more.", "", { description: "Back to speed. Whatever it was, it's gone. They are so glad you came." })] }),
    beat("gloomgill_scoreboard", "Gloomgill — The Scoreboard",
      "There is a scoreboard. It is a reed screen with the lake behind it and it shows, in light that should not be possible under a marsh, everything you did Thatwards: what you settled, what you broke, what you skipped, what you padded, what you kept a receipt for. He does not look at it. He knows the answers before he asks them. \"For the audience,\" he says. \"You've seen it. You lived it.\"",
      { type: "narration", requires: [P6], storeFacts: true, choices: [ch("Read it anyway.", "", { description: "⚙ GM: the ledger panel is yours — closed quests, endings, receipts held, the meters. He's grading energy. You're holding the ledger." })] }),
    beat("gloomgill_final_fact", "Gloomgill — The Final Fact",
      "He closes the book. The applause, for once, waits. \"You didn't ask,\" he says, \"so here it is.\" And he names the paymaster behind the Valhaulans — the one name nobody in this story has said out loud, in the one place it can be said. The marsh does not applaud that. Then, quieter, the jacket a little less sequined: \"I stopped teaching because people kept the convenient parts. I checked the math. It was my math.\" A pause the length of twelve thousand years. Then, bright: \"Same time next century?\"\n\n⚙ GM (ruled 2026-09-27): the paymaster is MR MONOCLE of MONODYNAMIC INDUSTRIES — this beat is the only place in the story it is said; nothing earlier hints at it.",
      { type: "narration", priority: "high", timePoints: 1, requires: [P6, { beatMark: "gloomgill_passed" }],
        receipts: [{ label: "The Final Fact", effectKey: "stirThePot", acquisition: "earned", source: { name: "Gloomgill, He That Was Oannes" }, truth: "The name of the paymaster behind the Valhaulans, said aloud by the oldest teacher in the world, in the one place in the story it can be said. Produce it and a room that thought it knew who it worked for goes very quiet." }],
        memoryText: "Gloomgill named the paymaster, and then said why he stopped teaching: it was his math.",
        choices: [ch("Ask why he stopped teaching.", "", { description: "\"It was my math.\" He does not elaborate. The marsh, gently, applauds." }), ch("\"Same time next century.\"", "", { description: "\"I'll hold you to it. I hold everyone to it.\"" })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  // speakers
  for (const b of camp.beats) if (((b.story || {}).quest === KEY) && b.id !== "gloomgill_intro" && !b.speakerActorId && GID) edit(b.id, x => { x.speakerActorId = GID; }, "Gloomgill speaks");   // the intro is the hex-enter cinematic (the creed), not a line
  // receipts as hidden answers
  const hidden = (qid, label, mark, desc) => edit(qid, b => { if ((b.choices || []).some(c => c.label === label)) return; const correct = (b.choices || []).find(c => /^correct$/i.test(String(c.label || ""))); const next = correct?.next || ""; b.choices = [...(b.choices || []), ch(label, next, { requires: { beatMark: mark }, description: desc })]; }, `hidden answer: ${label}`);
  hidden("gloomgill_question_2", "Show him the birthday card.", "soft_landing_birthday_card", "\"Loss acknowledged. Rare.\" He reads all forty-one names aloud, and the marsh applauds each.");
  hidden("gloomgill_question_4", "Show him the parade permit.", "stillwater_parade_permit", "\"ONE DAY ONLY. Later arrived, and somebody paid. Correct energy.\"");
  hidden("gloomgill_question_5", "Show him the rental slip.", "chuckle_rental_slip", "\"You let the credits roll. Almost nobody does.\"");
  hidden("gloomgill_question_7", "Show him the comeuppance tape.", "kt_comeuppance_tape", "\"Evidence. Luxurious.\" He rewinds the part with the stairs.");
  hidden("gloomgill_question_9", "Show him the caravan route.", "ag_caravan_route", "\"You taught a town that a receipt moves faster than a fight.\"");
  // geography
  edit("a6_title_card", b => { b.description = String(b.description || "").replace(/waiting in the Odaroloc/, "waiting in Lake Suspicious"); }, "Lake Suspicious, not the Odaroloc");
  edit("gloomgill_passed", b => { for (const r of (b.worldEffects?.hexSpark || [])) if (r.hexName === "Odaroloc Depths") r.hexName = "Lake Suspicious"; }, "hexSpark → Lake Suspicious");

  // story script
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for gloomgill not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const st = Object.fromEntries(SCRIPT.steps.map(s => [s.id, s]));
    if (st.act6) st.act6.line = "The finale is counted. The epilogue is waiting in the lake.";
    if (st.intro) st.intro.line = "The lake goes silent a mile out. That's the invitation. He has a microphone.";
    if (st.questions) { st.questions.line = "Ten questions. He's grading energy, not answers. Everything you kept a receipt for is an answer."; st.questions.done = { mark: "gloomgill_question_10" }; }
    if (st.verdict) st.verdict.line = "The verdict. No eliminations today. Just consequences.";
    SCRIPT.doors = [
      { id: "applause", label: "The Applause", line: "The marsh applauds everything. Bow three times and see what the third bow does.", beats: ["gloomgill_applause"] },
      { id: "scoreboard", label: "The Scoreboard", line: "He knows the answers before he asks them. The GM is holding the ledger.", beats: ["gloomgill_scoreboard"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "gloomgill_final_fact"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script gloomgill → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +final fact)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-gloomgill-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Gloomgill retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Gloomgill retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-gloomgill-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Gloomgill retrofit APPLIED: ${changes} change(s). No pressure! F5.`);
})();
