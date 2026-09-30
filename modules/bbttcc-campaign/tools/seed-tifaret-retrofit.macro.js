/* seed-tifaret-retrofit.macro.js — THE FOREST OF EARLY TIFARET to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/TIFARET_RETROFIT_2026_09_30.md; worksheet ruling 09-15 (fires on the way to the Fixit Farm, pinned to the ride, not a random draw);
 * story-flow C (the Tree's Session: carry / become / do; the Obstructor after the second success; the tally). ADDS: THE RING (walk it before
 * the session; the Vault Label held up to the stone figure confirms the heading → mark `tifaret_heading_confirmed` for the Lost Statues),
 * NEW actor The Tree Person of Early Tifaret (roots full of old highway; speaks only in road signs; fights beside you against the Obstructor),
 * THE ROAD STAYS OPEN (after: the Tree Person walks you to the edge and turns its sign over), a second secret for the Forest, and a repair:
 * four beats spoke through a deleted actor — they speak through the Forest again. No new receipt (the Forest already gives WHICH WAY THE
 * FIGURE FACES); the exchange here SPENDS Lyrenn's label. Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "tifaret", Q = "quest_2pZmPy9TEzorMoaj";
  const MARKER = "[TIFARET-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const byName = (n) => (game.actors?.contents || []).find(a => a.name === n) || null;

  // ── 1. actors + personas ───────────────────────────────────────────────────
  const forest = byName("The Forest of Early Tifaret");
  if (!forest) return ui.notifications.error("Actor 'The Forest of Early Tifaret' not found — run the story-flow C seeders first.");
  const FOREST = forest.id;
  { const cur = forest.getFlag(MAL, "persona") || {};
    if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona The Forest +1 secret (Lyrenn's cousin)");
      if (!DRY_RUN) await forest.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), "the ring, the label, the Tree Person, the highway, Lyrenn's treaty (word for word)"].filter(Boolean).join(", "),
        notes: [String(cur.notes || "").trim(), `${MARKER} ADDENDUM — On the ring: it will show anyone the clearing where the spacing breaks, and it will tell only someone who TENDED the ring which way the figure faces. Shown Lyrenn's vault label at the figure, it goes very quiet, the way a therapist goes quiet when a client says the true thing by accident. On its champion: the Tree Person has old highway in its roots and speaks only in road signs; the forest finds this restful. On Lyrenn: the two forests are one root system with different opinions; it knows the treaty word for word and will honour a treaty made with its cousin, grudgingly, correctly.`].join("\n\n"),
        secretsRaw: [String(cur.secretsRaw || "").trim(), "One Root, Two Opinions :: favorPlus1 :: a Steward mentions Rowan-of-the-Loam, the treeline treaty, or shows the Vault Label :: The forests of Lyrenn and Early Tifaret are one root system with different opinions. It knows the treaty word for word and will honour a treaty made with its cousin, grudgingly, correctly; and the label's direction is the direction its stone figure faces."].filter(Boolean).join("\n") }); }
    else say("· ok persona The Forest"); }
  const TP_NAME = "The Tree Person of Early Tifaret";
  let tp = byName(TP_NAME);
  if (!tp) { say(`✚ CREATE actor "${TP_NAME}"`); changes++; if (!DRY_RUN) tp = await Actor.create({ name: TP_NAME, type: "npc" }); }
  if (tp) { const cur = tp.getFlag(MAL, "persona") || {};
    if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona The Tree Person +1 secret");
      if (!DRY_RUN) await tp.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), "the highway, the ring, the static, the Obstructor, signs, yielding, merging, no outlet, the coast road"].filter(Boolean).join(", "),
        notes: [String(cur.notes || "").trim(), `${MARKER} PRIVATE TRUTH — The Tree Person of Early Tifaret, the forest's champion: an aggressive Tifaret tree person with old highway in its roots, asphalt and a mile-marker and, somewhere, a bus stop. VOICE: it speaks ONLY in road signs, one at a time, in capitals, and it means every one of them: YIELD. MERGE. NO OUTLET. ROAD WORK AHEAD. SLOW CHILDREN. It is not being funny. It is being clear. It fights BESIDE the Stewards against the Obstructor because a door was opened and it was standing nearest. STAGING: it holds up signs the way other people hold up hands; when it is pleased it turns a sign over, and the other side always says something kinder. WHAT IT KNOWS: the road under it went to the coast. The last thing that drove it was going to the coast, and it was full, and nobody on it was in a hurry. It does not say where the road ended. It says NO OUTLET, and then, if you have been kind, it turns the sign over.`].join("\n\n"),
        secretsRaw: [String(cur.secretsRaw || "").trim(), "No Outlet :: coverTracks :: a Steward asks what road is in its roots, after the Obstructor :: The old service road to the coast. The last thing that drove it was going to the coast, and it was full, and nobody on it was in a hurry. It will not say where the road ended; it says NO OUTLET, and turns the sign over, and the other side says WELCOME."].filter(Boolean).join("\n") }); }
    else say("· ok persona The Tree Person"); }
  const TP = tp?.id || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["forest_of_tifaret_approach", "forest_of_tifaret_merge", "forest_of_tifaret_obstructor", "forest_of_tifaret_session_tally", "forest_of_tifaret_harmonious_ending", "forest_of_tifaret_session_do_ok"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Tree's Session was never seeded here.`);

  const TAGS = "tifaret story";
  const P2 = { flag: "storyPhase", gte: 2 };
  const ACTIVE = { questBucket: Q, is: "active" };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, questId = Q, repeatable = false, extraFx = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(extraFx || {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("tifaret_the_ring", "The Forest of Early Tifaret — The Ring",
      "The clearing where the spacing breaks. The trees stand at exactly double distance around a stone figure mid-stride, and the doubled distance is not neglect; it is the forest keeping a respectful step back from the one thing here it could not improve. The figure is facing somewhere. Grass has grown up through where its shadow should move. The whole clearing leans a degree toward you, which is the forest asking whether you see it too.",
      { speaker: FOREST, requires: [P2, ACTIVE], repeatable: true, choices: [
        ch("Ask the forest what it could not improve.", "", { description: "It shows you the ring. It does not say the word. \"Tend it,\" the leaning says, \"and ask me again.\"" }),
        ch("Hold the Vault Label up to the figure.", "tifaret_heading_confirmed", { requires: { beatMark: "lyrenn_vault_label" }, description: "RED THREAD. GATHERED WHERE THE STANDING STONES WENT QUIET. A direction under it. You turn until the label's direction and the figure's stride are the same line, and they are." }),
        ch("Walk the ring once, saying nothing.", "", { description: "The forest approves of this so much that a branch, somewhere, lets go of a leaf it had been holding for some time." }),
        ch("Back to the forest.", "forest_of_tifaret_merge")
      ] }),
    beat("tifaret_heading_confirmed", "The Forest of Early Tifaret — Two Hands, One Line",
      "Lyrenn's hand on the label and the stone's stride agree. Whoever gathered the red thread was standing where the figure is walking to, and wrote down the direction, and dated it, and the forest, which has been keeping a respectful step back from this figure for two hundred years, goes very quiet — the way a therapist goes quiet when a client says the true thing by accident. You have a heading now that two witnesses share. Whoever is counting stone figures will want it.",
      { type: "narration", requires: [P2], priority: "high",
        memoryText: "At the ring in Early Tifaret the Vault Label's direction and the stone figure's stride were the same line: a heading two witnesses share.",
        choices: [ch("Back to the forest.", "forest_of_tifaret_merge"), ch("Leave the ring as it is.", "")] }),
    beat("tifaret_tree_person", "The Forest of Early Tifaret — The One With the Highway in Its Roots",
      "It is taller than the ring and it has asphalt in it, and a mile-marker, and something that might once have been a bus stop. It holds up a sign the way other people hold up a hand. YIELD. You yield. It considers you for the length of a road, and then holds up the next one. MERGE. It is not being funny. It is being clear.",
      { speaker: TP, requires: [P2, ACTIVE], repeatable: true, choices: [
        ch("Ask what road that is.", "", { description: "It thinks. It holds up ROAD WORK AHEAD, which is not an answer, and then NO OUTLET, which is." }),
        ch("Ask it to come with you.", "", { description: "NO OUTLET. It does not turn the sign over. Not yet." }),
        ch("Say thank you.", "", { description: "MERGE. Then, after a moment, SLOW CHILDREN, which you decide to take as affection." }),
        ch("Back to the forest.", "forest_of_tifaret_merge")
      ] }),
    beat("tifaret_road_open", "The Forest of Early Tifaret — The Road Stays Open",
      "The Fixit road does not bend on you this time, and will not again. At the edge of the trees the Tree Person is waiting, which it has never done for anyone, and it walks you to where the forest stops, and it holds up a sign: NO OUTLET. Then, because you tended the ring, or held, or said thank you, it turns the sign over. The other side says WELCOME. It has said WELCOME the whole time. Nobody had been kind enough to see the back of the sign.",
      { speaker: TP, priority: "high", requires: [P2, { anyOf: [{ beatMark: "forest_of_tifaret_session_do_ok" }, { beatMark: "forest_of_tifaret_harmonious_ending" }, { beatMark: "forest_of_tifaret_harmonious_lite" }] }],
        memoryText: "The Tree Person of Early Tifaret walked the Stewards to the edge of the forest and turned its sign over. The other side said WELCOME.",
        choices: [
          ch("Ask what road is in its roots.", "", { description: "The old service road to the coast. The last thing that drove it was going to the coast, and it was full, and nobody on it was in a hurry. It does not say where the road ended. It says NO OUTLET, and the sign is already turned over." }),
          ch("Go on to the Farm.", "")
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (b, c, first = false) => { if ((b.choices || []).some(x => x.label === c.label)) return; b.choices = first ? [c, ...(b.choices || [])] : [...(b.choices || []), c]; };
  const liveActor = (id) => !!(id && (game.actors?.get?.(id) || (game.actors?.contents || []).some(a => a.id === id)));

  // repair: four beats speak through a deleted actor
  for (const id of ["forest_of_tifaret_merge", "forest_of_tifaret_aggression_ending", "forest_of_tifaret_harmonious_ending", "forest_of_tifaret_neutral_ending"])
    edit(id, b => { if (b.speakerActorId && !liveActor(b.speakerActorId)) b.speakerActorId = FOREST; }, "speaker → the Forest (was a deleted actor)");
  edit("forest_of_tifaret_approach", b => { addChoice(b, ch("Walk the ring first.", "tifaret_the_ring"), true); addChoice(b, ch("The one with the highway in its roots.", "tifaret_tree_person")); }, "the ring; the Tree Person");
  edit("forest_of_tifaret_merge", b => { addChoice(b, ch("Not this one — the ring.", "tifaret_the_ring")); }, "the ring");
  edit("forest_of_tifaret_obstructor", b => { if (TP && !b.speakerActorId) b.speakerActorId = TP; addChoice(b, ch("Thank the Tree Person.", "tifaret_tree_person")); }, "the Tree Person speaks; thank it");
  edit("forest_of_tifaret_session_do_ok", b => { addChoice(b, ch("The road, then.", "tifaret_road_open")); }, "the road stays open");
  edit("forest_of_tifaret_harmonious_lite", b => { addChoice(b, ch("The road, then.", "tifaret_road_open"), true); }, "the road stays open");

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for tifaret not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const CLOSERS = ["forest_of_tifaret_harmonious_ending", "forest_of_tifaret_harmonious_lite", "forest_of_tifaret_neutral_ending", "forest_of_tifaret_aggression_ending"];
    SCRIPT.steps = [
      { id: "opens", label: "The Forest Opens", line: "The forest on the Fixit road has opened for you. It wants you better. Decide what that's worth. Walk the ring first; it will wait.", beats: ["forest_of_tifaret_approach"] },
      { id: "ring", label: "The Ring", line: "The trees stand at double distance around a stone figure mid-stride. It is facing somewhere. If you are carrying Lyrenn's label, hold it up.", beats: ["tifaret_the_ring", "tifaret_heading_confirmed"], done: { anyOf: ["tifaret_the_ring", "forest_of_tifaret_merge", "forest_of_tifaret_fight", "forest_of_tifaret_leave"] } },
      { id: "merge", label: "Share and Enjoy — The Tree's Session", group: "answer", line: "It wants to be seen. Three questions, any order. Show it something true, or show it the Lyrenn treaty.", beats: ["forest_of_tifaret_merge"], done: { anyOf: ["forest_of_tifaret_session_carry", "forest_of_tifaret_session_become", "forest_of_tifaret_session_do", ...CLOSERS] } },
      { id: "carry", label: "What Do You Carry?", group: "answer", line: "It wants the weight, not the story of the weight. Set it down.", beats: ["forest_of_tifaret_session_carry", "forest_of_tifaret_session_carry_ok", "forest_of_tifaret_session_carry_miss"], done: { anyOf: ["forest_of_tifaret_session_carry_ok", "forest_of_tifaret_session_carry_miss", ...CLOSERS] } },
      { id: "become", label: "What Do You Want to Become?", group: "answer", line: "Not what you are for. What you would be if nothing pulled.", beats: ["forest_of_tifaret_session_become", "forest_of_tifaret_session_become_ok", "forest_of_tifaret_session_become_miss"], done: { anyOf: ["forest_of_tifaret_session_become_ok", "forest_of_tifaret_session_become_miss", ...CLOSERS] } },
      { id: "do", label: "What Will You Do for Me?", group: "answer", line: "Tend the ring. Leave the figure exactly as it stands. It will tell you which way the figure faces, and that is a receipt.", beats: ["forest_of_tifaret_session_do", "forest_of_tifaret_session_do_ok", "forest_of_tifaret_session_do_miss"], done: { anyOf: ["forest_of_tifaret_session_do_ok", "forest_of_tifaret_session_do_miss", ...CLOSERS] } },
      { id: "obstructor", label: "The Channel Draws Something", group: "answer", line: "After the second success the light goes the colour of a bruise. A mind reaching for a mind is a door. The one with the highway in its roots is on your side of the static.", beats: ["forest_of_tifaret_obstructor"], done: { anyOf: ["forest_of_tifaret_obstructor", ...CLOSERS] } },
      { id: "tally", label: "The Tally", group: "answer", line: "Sessions end with a quiet, not a verdict. Count what was answered. The forest already has.", beats: ["forest_of_tifaret_session_tally"], done: { anyOf: CLOSERS } },
      { id: "fight", label: "Cleanse the Forest", group: "answer", line: "You asked for a fight. The forest is disappointed, at scale.", beats: ["forest_of_tifaret_fight"], done: { anyOf: ["forest_of_tifaret_aggression_ending"] } },
      { id: "leave", label: "Leave", group: "answer", line: "The forest is co-dependent. Talk your way out, point at Tree Elvis, or back out and lose the day.", beats: ["forest_of_tifaret_leave", "forest_of_tifaret_back_out"], done: { anyOf: [...CLOSERS, "forest_of_tifaret_back_out"] } }
    ];
    SCRIPT.doors = [
      { id: "tree_person", label: "The Tree Person", line: "It holds up signs the way other people hold up hands. Say thank you and see what it holds up next.", beats: ["tifaret_tree_person"] },
      { id: "ring", label: "The Ring", line: "Walk it once, saying nothing. A branch will let go of a leaf it has been holding for some time.", beats: ["tifaret_the_ring"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "tifaret_road_open"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script tifaret → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +road)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-tifaret-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Tifaret retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Tifaret retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-tifaret-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Tifaret retrofit APPLIED: ${changes} change(s). MERGE. F5.`);
})();
