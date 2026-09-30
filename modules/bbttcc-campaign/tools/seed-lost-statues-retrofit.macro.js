/* seed-lost-statues-retrofit.macro.js — THE LOST STONE STATUES to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/LOST_STATUES_RETROFIT_2026_09_30.md; bible ("the statues bleeding Spark is the Garden weakening, said out loud by Sable"); Garden canon
 * (100 consented / count 99 — owner slots untouched: what they hold, who the Missing One is; the three pickets are "kin, still at their post").
 * NEW actor Dunmore Kell, the Basin Sexton (Menhirkin) with secrets; Sable 9 +1 secret; THE SEXTON, THE TRUTH OF THE FIRST ONE (the exchange:
 * your true account for THE SEXTON'S TALLY), WHAT THE BLEEDING IS (the turn — Sable seeks you out), THE SEVENTH POINT (the Vault Label spent),
 * THE REPORT GOES WEST (after; mark for the Garden count / Ninth Guest / Finale). The statues still never speak. Idempotent; backs up the setting.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "lost_statues", Q = "quest_jivVj3iGErW53Wxl";
  const MARKER = "[LOST-STATUES-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. cast ────────────────────────────────────────────────────────────────
  const SEXTON = { name: "Dunmore Kell", topics: "the basin, the broom, the pickets, the book, the column, answerable, stood, took, and said so, the post, kin, stone, sweeping, the Garden, the third one, the water",
    notes: `${MARKER} PRIVATE TRUTH — Dunmore Kell, the Basin Sexton. An old Menhirkin (the faint grain of stone in the skin, if you know to look) who sweeps the plains basin around the first statue with a broom older than the road, and does it properly. He keeps THE BOOK: everyone who ever tried the pickets and how. VOICE: does not stop sweeping when you arrive; short, dry, kind underneath; "sign the book after, not before — before is bragging." Calls the statues "the pickets" and never "statues". THE COLUMN (his whole test): the book has one column and it is titled ANSWERABLE; STOOD and TOOK are both in it; the grade is whether the person told him THEMSELVES, before he asked. "TOOK, AND SAID SO" is on a line by itself. For a Steward who tells the truth of the first fragment unprompted he tears out their line — which a Sexton never does — and tells them to set it down in the water at the third one, without a speech. KIN (only if shown stone-sign or asked what he is): the pickets are kin — not his, everybody's; they walked out to stand at a post and are still standing at it two hundred years on, which earns somebody to sweep. He says the word "Garden" once, as a place, and refuses everything else: not what post, not what they hold, not who is missing. Owner slots — never improvise them.`,
    secrets: [
      "The Book :: forceReroll :: a Steward tells him truthfully how they took the first fragment, before he asks :: He writes it down without looking at you. The book goes back further than the road. Restraint and force are in the same column; the column is titled ANSWERABLE, and the entries are graded by whether the person told him themselves.",
      "Kin :: rollPlus2 :: a Steward shows him stone-sign, or asks him what he is :: Menhirkin. The pickets are kin — not his, everybody's. They walked out here to stand at a post, and they are still standing at it, and a thing still standing at its post two hundred years on has earned somebody to sweep. He will not say what post. He will not say what they hold. He says the word 'Garden' once, as a place, not an answer."
    ] };
  const SABLE_SECRET = "What the Bleeding Is :: oppRollMinus2 :: after two fragments, a Steward asks Sable why the statues are giving up Spark at all :: Because they are BLEEDING it. Fixed points don't bleed. Fixed points that bleed are fixed points losing hold. 'Your statues and my chart agree. The Garden is weakening. I have said it out loud now; that makes it a claim; I am prepared to be wrong and I am not.'";
  const actorIds = {};
  let sx = (game.actors?.contents || []).find(a => a.name === SEXTON.name);
  if (!sx) { say(`✚ CREATE actor "${SEXTON.name}"`); changes++; if (!DRY_RUN) sx = await Actor.create({ name: SEXTON.name, type: "npc" }); }
  if (sx) { actorIds.sexton = sx.id; const cur = sx.getFlag(MAL, "persona") || {}; if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona Dunmore Kell +2 secrets"); if (!DRY_RUN) await sx.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), SEXTON.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), SEXTON.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...SEXTON.secrets].filter(Boolean).join("\n") }); } else say("· ok persona Dunmore Kell"); }
  const sable = (game.actors?.contents || []).find(a => a.name === "Sable 9" || a.name === "Sable Nine");
  if (!sable) say("✗ actor Sable 9 not found — Sable's secret + speaker skipped");
  else { actorIds.sable = sable.id; const cur = sable.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || ""); if (!raw.includes("What the Bleeding Is")) { changes++; say("✚ persona Sable 9 +1 secret (What the Bleeding Is)"); if (!DRY_RUN) await sable.setFlag(MAL, "persona", { ...cur, secretsRaw: [raw.trim(), SABLE_SECRET].filter(Boolean).join("\n") }); } else say("· ok persona Sable 9"); }
  const SX = actorIds.sexton || null, SB = actorIds.sable || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["spark_geburah_northreach_b", "spark_geburah_northreach_b_worthy", "spark_geburah_northreach_b_force", "spark_geburah_mountains_q", "spark_geburah_mountains_o", "spark_geburah_mountains_o_worthy", "spark_geburah_reconstituted"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Lost Statues were never seeded here.`);

  const TAGS = "spark.geburah,quest.lost_stone_statues,story";
  const P3 = { flag: "storyPhase", gte: 3 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, repeatable = false, hex = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(hex ? { hexName: hex } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("statues_sexton", "Northreach Expanse — The Sexton",
      "An old man is sweeping a basin in the middle of nowhere, and doing it properly. The broom is worn to the shape of his hands and the hands are worn to the shape of the broom. He does not stop when you arrive. \"You'll be wanting the picket,\" he says. \"Everybody does. Sign the book after, not before. Before is bragging.\" His skin has the faint grain of stone in it, if you know to look, and he has a book, and the book is thick.",
      { speaker: SX, requires: [P3, { beatMark: "spark_geburah_northreach_b" }], repeatable: true, choices: [
        ch("Ask what the pickets are grading.", "", { description: "\"Not you. Whether you're the sort that can be answered to. Different thing.\"" }),
        ch("Ask who else has been.", "", { description: "He opens the book at random and reads a line. A name, a year, a single word: STOOD. Another: TOOK. Another: TOOK, AND SAID SO, which is on a line by itself." }),
        ch("Tell him the truth: you stood still.", "statues_tally_given", { requires: { beatMark: "spark_geburah_northreach_b_worthy" }, description: "Before he asks." }),
        ch("Tell him the truth: you took it.", "statues_tally_given", { requires: { beatMark: "spark_geburah_northreach_b_force" }, description: "Before he asks." })
      ] }),
    beat("statues_tally_given", "Northreach Expanse — The Truth of the First One",
      "He writes it down without looking at you, and you realize the book has only one column, and the column is not STOOD or TOOK. It is titled ANSWERABLE, and the grade is whether you told him yourself. \"That's the whole test,\" he says. \"The pickets know how you did it. They talk. I'm the one who finds out whether you'll say.\" He tears out your line and hands it to you, which a Sexton never does. \"Take it to the third one. She'll know what it means. Set it down in the water. Don't make a speech.\"",
      { speaker: SX, priority: "high", requires: [P3, { beatMark: "statues_sexton" }],
        memoryText: "The Stewards told the Basin Sexton the truth of the first fragment before he asked, and he tore their line out of the book for them.",
        receipts: [{ label: "The Sexton's Tally", effectKey: "forceReroll", acquisition: "earned", source: { name: "Dunmore Kell's book, the ANSWERABLE column" }, truth: "Your own line from a book older than the road, in the one column that matters, in a Menhirkin's hand. The third statue accepts it as an offering without reward; the Garden, later, reads it as a reference. Whatever you did, you said so." }],
        choices: [ch("Take it and go.", "", { description: "He is already sweeping again." })] }),
    beat("statues_sable_bleeding", "The Mountain Road — What the Bleeding Is",
      "Sable Nine does not leave the deep chart. Sable Nine has left the deep chart, and is standing on a mountain road with it rolled under one arm and an expression of someone who has been rehearsing a sentence for two days. \"Two of my six points are giving off Spark,\" they say. \"Fixed points do not give off anything. That is what fixed means. I have re-pinned the chart eleven times.\" They unroll it on a rock. Six points. Two of them circled, in a hand that shook. \"Your statues and my chart agree. Fixed points that bleed are fixed points losing hold. The Garden is weakening. I have said it out loud now. That makes it a claim. I am prepared to be wrong, and I am not.\"",
      { speaker: SB, priority: "high", timePoints: 1, requires: [P3, { beatMark: "spark_geburah_mountains_q" }], repeatable: true,
        memoryText: "Sable Nine came down the mountain to say it out loud: the statues are bleeding Spark, and the Garden is weakening.",
        choices: [
          ch("Ask what the Garden is holding.", "", { description: "\"I chart where. I do not chart what. Ask the Sexton; he won't tell you either; that's how you'll know it's real.\"" }),
          ch("Ask what they want you to do at the third.", "", { description: "\"Whatever you did at the first two. Consistency is a data point. I will take a data point.\"" }),
          ch("Show them the Vault Label.", "statues_seventh_point", { requires: { beatMark: "lyrenn_vault_label" }, description: "GATHERED WHERE THE STANDING STONES WENT QUIET. A direction. A date." })
        ] }),
    beat("statues_seventh_point", "The Mountain Road — The Seventh Point",
      "Sable reads the label twice, which is once more than Sable reads anything. GATHERED WHERE THE STANDING STONES WENT QUIET, a direction, a date. They put a seventh pin in the chart, coastward of all the others, and stand looking at it for a long time. \"That is not a fixed point,\" they say finally. \"That is where one stopped being fixed. Thank you. I dislike this very much.\"",
      { speaker: SB, priority: "high", requires: [P3, { beatMark: "statues_sable_bleeding" }],
        memoryText: "Shown the Vault Label, Sable Nine put a seventh pin in the deep chart: coastward, where a fixed point stopped being fixed.",
        choices: [ch("Leave them with the chart.", "", { description: "They are re-pinning it. It will be re-pinned again by morning." })] }),
    beat("statues_report_west", "Three Basins — The Report Goes West",
      "It happens the moment the fragments align and before the verdict finishes: a long slow pulse out of all three sites at once, westward, past the coast, toward a hundred more of their kind standing very still. It is not information. It is a reference, filed. Whatever you were graded, the grade has already arrived. When you reach the Garden, if you reach the Garden, it will have had your number for some time.",
      { priority: "high", requires: [P3, { beatMark: "spark_geburah_reconstituted" }],
        memoryText: "When Geburah was made whole, the three statues sent the Stewards' grade west, toward the Garden.",
        choices: [ch("Let it go.", "")] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoiceFirst = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [c, ...(b.choices || [])]; }, what);
  addChoiceFirst("spark_geburah_northreach_b", ch("Follow the broom marks.", "statues_sexton"), "→ the Sexton");
  addChoiceFirst("spark_geburah_mountains_o", ch("Set the Sexton's tally down in the water.", "spark_geburah_mountains_o_worthy", { requires: { beatMark: "statues_tally_given" }, description: "No speech. An offering without reward, by definition." }), "the tally as an offering (hidden, no roll)");
  edit("spark_geburah_reconstituted", b => { if (!(b.choices || []).some(c => c.next === "statues_report_west")) b.choices = [ch("Listen to where it goes.", "statues_report_west"), ...(b.choices || [])]; }, "→ the Report Goes West");

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for lost_statues not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    SCRIPT.steps = [
      { id: "first", label: "Northreach Expanse", line: "The first statue faces a horizon it no longer trusts. Someone has swept a path to it. Follow the broom marks.", beats: ["spark_geburah_northreach_b"], done: { mark: "spark_geburah_northreach_b" } },
      { id: "sexton", label: "The Sexton", line: "Dunmore Kell has a book with your name not yet in it. Ask him what the pickets are grading. Then decide how you'll be graded.", beats: ["statues_sexton"] },
      { id: "stand", label: "Stand or Take", line: "Stand in front of it and don't move, or challenge it and take what you came for. The book has a column for each.", beats: ["spark_geburah_northreach_b"], done: { anyOf: ["spark_geburah_northreach_b_worthy", "spark_geburah_northreach_b_force"] } },
      { id: "truth", label: "The Truth of the First One", line: "Go back to the Sexton and tell him how you did it, before he asks. Whichever way it was. He'll give you the book.", beats: ["statues_tally_given"] },
      { id: "second", label: "The Kneeling Statue", line: "The second kneels in a pool above the road; it has already heard about you. Climb, bleed, and don't complain — or break the basin. Either way it's going in the book.", beats: ["spark_geburah_mountains_q"], done: { anyOf: ["spark_geburah_mountains_q_worthy", "spark_geburah_mountains_q_force"] } },
      { id: "bleeding", label: "What the Bleeding Is", line: "Sable Nine has come down the mountain to find you, which Sable does not do. Let them unfold the chart.", beats: ["statues_sable_bleeding"] },
      { id: "third", label: "The Guardian", line: "The third is chest-deep in dark water, guarding. Offer something or take something. If you carry the book, set it down in the water.", beats: ["spark_geburah_mountains_o"], done: { anyOf: ["spark_geburah_mountains_o_worthy", "spark_geburah_mountains_o_force"] } },
      { id: "whole", label: "Geburah Made Whole", line: "Three fragments. Make it whole and hear the verdict.", beats: ["spark_geburah_reconstituted"] }
    ];
    SCRIPT.doors = [
      { id: "book", label: "The Sexton's Book", line: "Sign the book after, not before. Before is bragging.", beats: ["statues_sexton"] },
      { id: "chart", label: "Sable's Chart", line: "Six points that never moved. Two of them circled in a hand that shook.", beats: ["statues_sable_bleeding"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "statues_report_west"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script lost_statues → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +report)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-lost-statues-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Lost Statues retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Lost Statues retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-lost-statues-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Lost Statues retrofit APPLIED: ${changes} change(s). Sign the book after. F5.`);
})();
