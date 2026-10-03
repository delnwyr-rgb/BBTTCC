/* seed-balcones-retrofit.macro.js — THE BALCONES FAULTING YOU LINE to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/BALCONES_RETROFIT_2026_09_30.md. A one-scene bit kept as one: NEW actors Dr. Prosper Nkemelu (consulting geologist, lawn chair) and
 * The Balcones Fault (the landform, speaker on the choices beat) with secrets; THE LAWN CHAIR, THE CREEK (door), THE COMPLAINT (the turn: the
 * seismograph trace is an itemized complaint and item one is dated That One Night; receipt THE ITEMIZED COMPLAINT), read it back to the fault to
 * calm it without a roll; filed with the Riders. Every existing joke untouched; the closers' dangling scene ids cleared. Idempotent; backs up.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "balcones", Q = "quest_8II4GEGV7D3RgzPv";
  const MARKER = "[BALCONES-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. cast ────────────────────────────────────────────────────────────────
  const NEW_PERSONAS = [
    { name: "Dr. Prosper Nkemelu", topics: "the fault, the line, the mood, the chair, the seismograph, the bicycle, the trace, the creek, the survey, the licensing board, coffee, re-levelling, two turns, that one night, handwriting, the complaint",
      notes: `${MARKER} PRIVATE TRUTH — Dr. Prosper Nkemelu, Consulting Geologist, unlicensed since 2077 ("the licensing board slid into the sea"). Has followed the Balcones for two turns with a lawn chair, a clipboard, a thermos and a seismograph built from a bicycle wheel and a pen; the chair is level and the ground is not; he has re-levelled it forty times and keeps the count because it is the only thing out here that holds still. VOICE: unhurried, precise, offers coffee before you ask, says "it's not an earthquake, it's a mood" before you ask that too; earthquakes stop. THE TRACE (the turn — tell it if asked what the seismograph actually says): it is not a tremor, it is handwriting; the fault started sliding on That One Night, at the minute everyone felt weird, and it is filing an itemized complaint; item one is dated, item two is the creek, item three is YOU. THE CREEK: he surveyed it twice; it was not over there; it is now; he has decided to believe the creek because it is the only party to the dispute that isn't moving. He has forty more traces and will let a Steward keep one.`,
      secrets: [
        "The Trace :: oppRollMinus2 :: a Steward asks him what the seismograph actually says :: It says the fault started sliding on That One Night, at the minute everyone felt weird, and hasn't stopped. 'It isn't having a crisis. It's filing one. Look at the trace. That's not a tremor. That's handwriting.'",
        "The Creek :: rollPlus2 :: a Steward asks him about the creek that insists it was always over there :: He surveyed it. Twice. It was not. It is now. He has decided to believe the creek, because the creek is the only party to this dispute that is not moving."
      ] },
    { name: "The Balcones Fault", topics: "sliding, the line, the hex, your watch, that one night, the creek, acknowledgement, the complaint, items, faulting, the title, the pun, your holdings, moods",
      notes: `${MARKER} PRIVATE TRUTH — The Balcones Fault, a landform having feelings inside the Stewards' holdings. It does not speak; it slides, and Nkemelu's seismograph writes the slide down, and once a Steward has seen the trace read as handwriting they can hear it themselves. VOICE (when voiced at all): short, capitalised, itemised, underlines things it shouldn't; never explains; a fault line's idea of courtesy is listing. WHAT IT WANTS: acknowledgement — it is sliding TOWARD the Stewards' holdings on purpose; the night the sky tore happened on their watch and by the only law a fault line recognises that makes it their fault; the title of its own quest is a pun and it knows. Also the creek back. Read its own complaint back to it, itemised, and it calms without a roll. Incense makes it sneeze. It has not run out of feelings.`,
      secrets: [
        "Faulting You :: stirThePot :: a Steward asks it what it wants, once they can hear it :: You. It is sliding toward your holdings on purpose. It has an itemized complaint and item one is dated to the night the sky tore, which happened on your watch, which makes it, by the only law a fault line recognizes, your fault."
      ] }
  ];
  const actorIds = {};
  for (const P of NEW_PERSONAS) {
    let a = (game.actors?.contents || []).find(x => x.name === P.name);
    if (!a) { say(`✚ CREATE actor "${P.name}"`); changes++; if (!DRY_RUN) a = await Actor.create({ name: P.name, type: "npc" }); }
    if (!a) continue;
    actorIds[P.name] = a.id;
    const cur = a.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${P.name}`); continue; }
    changes++; say(`✚ persona ${P.name} +${P.secrets.length} secret(s)`);
    if (!DRY_RUN) await a.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), P.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), P.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...P.secrets].filter(Boolean).join("\n") });
  }
  const DOC = actorIds["Dr. Prosper Nkemelu"] || null, FAULT = actorIds["The Balcones Fault"] || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["balcones_faulting_you_line_opening", "balcones_faulting_you_line_choices", "balcones_faulting_you_persuasion"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Balcones was never seeded here.`);
  const liveScene = (id) => { const s = String(id || "").replace(/^Scene\./, ""); return !!s && !!(game.scenes?.get?.(s) || (game.scenes?.contents || []).some(x => x.id === s)); };

  const TAGS = "balcones,story";
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
    beat("balcones_lawn_chair", "The Balcones — The Lawn Chair",
      "There is a man in a lawn chair on the fault line, and the lawn chair is level, which the ground around it is not. He has a clipboard, a thermos, and a seismograph built from a bicycle wheel and a pen, and he does not get up. \"Consulting geologist. Unlicensed since 2077; the licensing board slid into the sea.\" He offers you coffee. \"It's not an earthquake,\" he says, before you ask. \"Earthquakes stop. This is a mood.\"",
      { speaker: DOC, requires: [P3, { beatMark: "balcones_faulting_you_line_opening" }], repeatable: true, choices: [
        ch("Ask what it wants.", "", { description: "\"Attention. Same as anything that slides toward you instead of away.\"" }),
        ch("Ask how long he's been here.", "", { description: "\"Two turns. Since the night everybody felt weird. The chair's been re-levelled forty times. I keep a count. It's the only thing out here that holds still.\"" }),
        ch("Ask about the creek.", "balcones_creek"),
        ch("Ask what the seismograph says.", "balcones_complaint")
      ] }),
    beat("balcones_creek", "The Balcones — The Creek",
      "The creek insists it was always over there. You check Nkemelu's survey, which is in his handwriting, dated, and shows the creek here. You check the creek, which is over there, and has the settled, slightly smug look of water that has always been over there. \"I surveyed it twice,\" he says. \"It wasn't. It is now. I've decided to believe the creek. It's the only party to this dispute that isn't moving.\" The creek says nothing, which is what winning sounds like.",
      { speaker: DOC, requires: [P3, { beatMark: "balcones_lawn_chair" }], choices: [ch("Back to the chair.", "balcones_lawn_chair"), ch("Back to the line.", "balcones_faulting_you_line_choices")] }),
    beat("balcones_complaint", "The Balcones — The Complaint",
      "He tears the trace off the bicycle wheel and holds it up to the light, and you see it: not a tremor. Lines. Itemized. \"It's not having a crisis,\" Nkemelu says. \"It's filing one.\" Once he's said it you can read it yourself, the way you can suddenly read a language you were only hearing. ITEM ONE: THAT ONE NIGHT — the sky tore, the ground under the ground moved, nobody asked the Balcones. ITEM TWO: THE CREEK. ITEM THREE: YOU. The line is sliding toward your holdings on purpose, and the reason is in the title, and the title is a pun, and the fault knows it. It happened on your watch. By the only law a fault line recognizes, that makes it your fault.",
      { speaker: FAULT, priority: "high", timePoints: 1, requires: [P3, { beatMark: "balcones_lawn_chair" }],
        memoryText: "The Stewards read the Balcones' trace as handwriting: an itemized complaint, item one dated That One Night, item three themselves.",
        receipts: [{ label: "The Itemized Complaint", effectKey: "oppRollMinus2", acquisition: "earned", source: { name: "Nkemelu's bicycle-wheel seismograph" }, truth: "A landform's own dated record of That One Night — the minute the sky tore, in the ground's own handwriting. Read it back to the fault and it calms without a roll; file it with the Riders and it corroborates the misfire from a witness that cannot be accused of theatrics." }],
        choices: [
          ch("Ask it what would settle the complaint.", "", { description: "The trace writes, slowly: ACKNOWLEDGEMENT. Then, after a moment: AND THE CREEK BACK." }),
          ch("Tell it the night wasn't yours.", "", { description: "The trace writes: YOUR HEX. YOUR WATCH. YOUR FAULT. It underlines FAULT, which even Nkemelu agrees is a bit much." }),
          ch("Take the trace and go back to the line.", "balcones_faulting_you_line_choices", { description: "Nkemelu lets you have it. He has forty more." })
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoiceFirst = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [c, ...(b.choices || [])]; }, what);
  addChoiceFirst("balcones_faulting_you_line_opening", ch("Find out who's been sitting on it with a clipboard.", "balcones_lawn_chair"), "→ the Lawn Chair");
  edit("balcones_faulting_you_line_choices", b => {
    if (!b.speakerActorId && FAULT) b.speakerActorId = FAULT;
    if (!(b.choices || []).some(c => c.next === "balcones_lawn_chair")) b.choices = [ch("Go back to the man in the lawn chair.", "balcones_lawn_chair"), ...(b.choices || [])];
    if (!(b.choices || []).some(c => /complaint back/i.test(c.label))) b.choices = [ch("Read its own complaint back to it, itemized.", "balcones_faulting_you_persuasion", { requires: { beatMark: "balcones_complaint" }, description: "No roll. Item one, item two, item three, in order, out loud. Acknowledgement was the whole demand. The creek is a separate matter." }), ...(b.choices || [])];
  }, "the Fault speaks; the complaint read back (hidden, no roll); back to the chair");
  for (const id of ["balcones_faulting_you_appease_spirit", "balcones_faulting_you_narrative", "balcones_faulting_you_persuasion", "balcones_faulting_you_impose_your_will", "balcones_faulting_you_build_a_bridge", "balcones_faulting_you_line_final_fail"]) edit(id, b => { if (b.sceneId && !liveScene(b.sceneId)) b.sceneId = null; }, "dangling sceneId cleared");
  // OWNER RULING 2026-10-02: "The fault is sliding towards KT. The sigil bridge makes it a real bridge, yes." (live worlds: patch-owner-canon-2026-10-02)
  edit("balcones_faulting_you_build_a_bridge", b => { b.worldEffects = b.worldEffects || {}; if (!b.worldEffects.crossing) b.worldEffects.crossing = { hexName: "Saltwake Reach j", name: "The Sigil Bridge" }; for (const q of (b.worldEffects.questEffects || [])) if (q && /sigil bridge/i.test(String(q.text || "")) && !/Khezek Tor/.test(q.text)) q.text = String(q.text).trim() + " Every sigil on it leans the same way the land has been sliding: toward Khezek Tor."; }, "the sigil bridge is a real bridge (worldEffects.crossing); it leans toward Khezek Tor");
  edit("enc_circuit_riders_file_it", b => { if (!(b.choices || []).some(c => c.label === "File the itemized complaint.")) b.choices = [...(b.choices || []).filter(c => /^enc_circuit_riders_filed/.test(String(c.next || ""))), ch("File the itemized complaint.", "enc_circuit_riders_filed", { requires: { beatMark: "balcones_complaint" }, description: "Howard holds the trace up to the light and says nothing for a long time. \"A WITNESS,\" says Captain Robot, \"THAT CANNOT BE ACCUSED OF THEATRICS.\"" }), ...(b.choices || []).filter(c => !/^enc_circuit_riders_filed/.test(String(c.next || "")))]; }, "File the itemized complaint (hidden)");
  // REVIEW 2026-10-01 (MEDIUM): every filing is SINGLE-USE. A filing choice routes to its OWN outcome beat (`enc_circuit_riders_filed_<receipt
  // mark>`: the Filed narration, repeatable:false, routing-only) which carries the +1 crVerify, and the choice hides once that beat has played.
  // The shared `enc_circuit_riders_filed` landing is retired (no meter, no conversation offer) — it was a repeatable Captain Robot beat any
  // talk could enact, and one receipt could be filed again and again. The same helper lives in seed-circuit-riders / seed-flooded-towns /
  // seed-balcones and tools/patch-template-review-fixes-b-2026-10-01 (whichever runs last converts every filing it finds).
  const singleUseFilings = () => {
    const TPL = "enc_circuit_riders_filed", tpl = byId.get(TPL), fi = byId.get("enc_circuit_riders_file_it"); if (!tpl || !fi) return;
    const meters = (Array.isArray(tpl.worldEffects?.meters) && tpl.worldEffects.meters.length) ? tpl.worldEffects.meters : [{ key: "crVerify", delta: 1, max: 4 }];
    for (const c of fi.choices || []) {
      const req = Array.isArray(c.requires) ? c.requires : (c.requires && typeof c.requires === "object" ? [c.requires] : []);
      const mark = req.find(x => x && x.beatMark && x.not !== true)?.beatMark; if (c.next !== TPL || !mark) continue;
      const id = `${TPL}_${mark}`;
      if (!byId.get(id)) { const nb = JSON.parse(JSON.stringify(tpl)); Object.assign(nb, { id, dialogueOffer: false }); nb.inject = { ...(nb.inject || {}), repeatable: false, requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: mark }] }; nb.worldEffects = { ...(nb.worldEffects || {}), meters: JSON.parse(JSON.stringify(meters)) }; camp.beats.push(nb); byId.set(id, nb); changes++; say(`✚ beat ${id} (single-use filing)`); }
      c.next = id; c.requires = [...req, { beatMark: id, not: true }]; changes++; say(`✎ enc_circuit_riders_file_it: "${c.label}" → ${id} (single-use)`);
    }
    const before = JSON.stringify(tpl);
    if (tpl.worldEffects?.meters) delete tpl.worldEffects.meters; if (tpl.dialogueOffer !== false) tpl.dialogueOffer = false; tpl.inject = { ...(tpl.inject || {}), repeatable: false };
    if (JSON.stringify(tpl) !== before) { changes++; say(`✎ ${TPL}: retired (no meter, routing-only)`); }
  };
  singleUseFilings();

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for balcones not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    SCRIPT.giver = "The land itself — a fault line having a personal crisis inside your holdings. And a man in a lawn chair who has been taking its statement.";
    SCRIPT.steps = [
      { id: "opening", label: "The Line Moves", line: "The Balcones is sliding sideways inside your borders. Go stand on it. There's a man in a lawn chair already standing on it.", beats: ["balcones_faulting_you_line_opening"], done: { mark: "balcones_faulting_you_line_opening" } },
      { id: "chair", label: "The Lawn Chair", line: "Dr. Nkemelu has a clipboard and a theory. It's not an earthquake, it's a mood. Ask him what the seismograph says.", beats: ["balcones_lawn_chair"] },
      { id: "first", label: "The First Try", line: "Five ways to calm a landform. Pick one. The land will tell you if it was the wrong one, and it will not be polite about it.", beats: ["balcones_faulting_you_line_opening"], done: { mark: "balcones_faulting_you_line_choices" } },
      { id: "complaint", label: "The Complaint", line: "The trace isn't a tremor. It's handwriting. Read the complaint. Item one is dated.", beats: ["balcones_complaint"] },
      { id: "choose", label: "Five Ways, Knowing", line: "Now try again, knowing what it's actually about. Or read its own complaint back to it, itemized, and skip the roll.", beats: ["balcones_faulting_you_line_choices"], done: { quest: "balcones" } }
    ];
    SCRIPT.doors = [
      { id: "chair", label: "The Lawn Chair", line: "Level chair, unlevel ground, forty re-levellings, one thermos. He'll offer you coffee.", beats: ["balcones_lawn_chair"] },
      { id: "creek", label: "The Creek", line: "It insists it was always over there. Check the survey. Believe the creek.", beats: ["balcones_creek"] }
    ];
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script balcones → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-balcones-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Balcones retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Balcones retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-balcones-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Balcones retrofit APPLIED: ${changes} change(s). It's a mood. F5.`);
})();
