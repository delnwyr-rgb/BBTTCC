/* seed-flooded-towns-retrofit.macro.js — THE HEX FLOODED TOWNS to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/FLOODED_TOWNS_RETROFIT_2026_09_30.md; bible (the flooded towns = a symptom of the misfire on That One Night, said out loud).
 * NEW actors Ines Calloway (the Last Clerk) + The Dispatcher (the civic ghost) with secrets; THE LAST CLERK, THE SIGN (door), THE VOTE (the turn:
 * the roles were volunteered, 41–9; receipt THE MINUTES), THE DISPATCHER (door; the seven positions as a heading → THE ROUTE, POSTED, mark for the
 * Finale / Ninth Guest); the turn wired INTO the chain between Maybe Beaumont and Bedlam Barrens; the Minutes filed with the Riders and shown to
 * Gloomgill Q4. All thirteen existing beats and their prose untouched. Idempotent; backs up the campaigns setting.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "flooded_towns", Q = "quest_dYfmXsGFyVseveWY";
  const MARKER = "[FLOODED-TOWNS-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. cast ────────────────────────────────────────────────────────────────
  const NEW_PERSONAS = [
    { name: "Ines Calloway", topics: "permits, the office, the stamp, the sign, Beaumont, probably, the light, the water, the vote, the minutes, the nine, the forty-one, Maybe Beaumont, Bedlam Barrens, filing, the job",
      notes: `${MARKER} PRIVATE TRUTH — Ines Calloway, the Last Clerk of Probably Beaumont, and since the night the sky tore, of Maybe Beaumont and Bedlam Barrens too, probably. The office is the only dry room in town because the light does not come indoors where there is paperwork. VOICE: dry, exact, never looks up, stamps before you finish the sentence; says "probably" about everything including the town's name and her own; a permit for being here and a second permit for the first one. She was holding the stamp when the light came, so she is the Clerk. WHAT SHE KNOWS: the town's name is on a sign under four feet of lit water and nobody has waded out to read it, because reading it would settle the argument and the light feeds on the argument. THE VOTE (the turn — tell it only if asked WHO assigned the roles): nobody assigned them; the week the light came it put it to the district in shapes, a town with a plan or a town without one, and it carried forty-one to nine on a show of hands. She was one of the nine. She kept the minutes anyway; that's the job. She will tear the page out for a Steward who asks properly, which a Clerk never does. Funny first, then the count.`,
      secrets: [
        "The Sign :: rollPlus2 :: a Steward asks her to say the town's name without 'probably' :: She can't. The sign is under four feet of lit water and she has never waded out to read it, because reading it would settle the argument, and the light feeds on the argument. She stamps you a permit to go and look.",
        "The Vote :: oppRollMinus2 :: a Steward asks WHO assigned the roles in Maybe Beaumont :: Nobody. They volunteered. The district put it to a show of hands the week the light came, and a town with a plan beat a town without one, forty-one to nine. She was one of the nine. She kept the minutes anyway; that's the job."
      ] },
    { name: "The Dispatcher", topics: "rerouting, traffic, the route, patience, instructions, the booth, the gutters, the light, streets, the third, the heading, arriving, finishing the sentence, feedback",
      notes: `${MARKER} PRIVATE TRUTH — The Dispatcher is the civic ghost of all three flooded towns: a municipal PA voice that reroutes traffic that no longer exists, coming from the booth, the gutters and the light under your boots at once. It is a third of a Spark of Hod that was cut in three on the night the sky tore, trying to complete a sentence it started two turns ago and running out of street. VOICE: ALL CAPS PA cadence, never interrupted, unfailingly courteous, "REROUTING IS NOW MANDATORY", "THANK YOU FOR YOUR PATIENCE", "NOTED. THANK YOU FOR YOUR FEEDBACK." It is not angry and it does not want to hurt the towns; it wants to ARRIVE. WHAT IT WANTS: a route. It had a whole one once; there is a third of it here. Given a HEADING (a Steward who carries the seven positions) it stops rerouting in circles and every instruction in three towns points the same way — the way the Legansus relay pointed — and it says thank you and means it. It does not know what the route was FOR; do not invent that.`,
      secrets: [
        "Rerouting Is Now Mandatory :: stirThePot :: a Steward asks it what it is trying to FINISH :: A route. It had one, once, whole, and the night the sky tore it was cut into three, and each third has been trying to complete the sentence with whatever streets were nearest. It does not want to hurt the towns. It wants to arrive.",
        "A Heading :: rollPlus2 :: a Steward gives it the seven positions as a heading :: It stops rerouting in circles. For the first time in two turns the traffic instructions all point the same way — the same way the Legansus relay pointed — and the Dispatcher says THANK YOU FOR YOUR PATIENCE and means it."
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
    changes++; say(`✚ persona ${P.name} +${P.secrets.length} secrets`);
    if (!DRY_RUN) await a.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), P.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), P.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...P.secrets].filter(Boolean).join("\n") });
  }
  const INES = actorIds["Ines Calloway"] || null, DISP = actorIds["The Dispatcher"] || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["hod_flooded_probably_beaumont", "hod_flooded_maybe_beaumont", "hod_flooded_maybe_beaumont_interrupt", "hod_flooded_maybe_beaumont_escalate", "hod_flooded_bedlam_barrens", "spark_hod_echoes_reconstituting"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Flooded Towns were never seeded here.`);
  const sceneOf = (id) => { const b = byId.get(id); const s = b?.sceneId || b?.cinematic?.startSceneId; return s ? String(s).replace(/^Scene\./, "") : null; };
  const SC = { one: sceneOf("hod_flooded_probably_beaumont"), two: sceneOf("hod_flooded_maybe_beaumont"), three: sceneOf("hod_flooded_bedlam_barrens") };

  const TAGS = "spark.hod,quest.hex_flooded_towns,story";
  const P3 = { flag: "storyPhase", gte: 3 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, repeatable = false, scene = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("hod_clerk_window", "Probably Beaumont — The Last Clerk",
      "The office is the only dry room in town because the light, for reasons of its own, does not come indoors where there is paperwork. Ines Calloway stamps a permit before you have said what you want. \"Visitor's permit. Probably.\" She stamps another. \"That one's for the first one.\" The forms are pre-Shattering; the stamp is wet with something that glows. She has been the Clerk since the night the sky tore, because she was the one holding the stamp.",
      { speaker: INES, scene: SC.one, requires: [P3, { beatMark: "hod_flooded_probably_beaumont" }], repeatable: true, choices: [
        ch("Ask what the permit is for.", "", { description: "\"Being here. The light likes it when things are on file. So do I.\"" }),
        ch("Ask if it's Beaumont.", "", { description: "\"Probably.\" She does not look up. \"The sign's under the water. Nobody's checked. If somebody checked it'd be settled, and then what would we argue about.\"" }),
        ch("Ask what the light wants.", "", { description: "\"Wants? It wants to get where it was going. Don't we all. Permit.\" Stamp." }),
        ch("Wade out and read the sign.", "hod_the_sign")
      ] }),
    beat("hod_the_sign", "Probably Beaumont — The Sign",
      "You wade out to where the sign should be. Four feet of water lit from underneath, warm as a screen. The sign is there. It says BEAUMON — the T is gone, sheared clean, and under it an arrow, pointing the way the traffic instructions have been pointing all week, which is nowhere in particular. You bring the word back to the office. Ines reads it, stamps something, and files it under P. \"Probably,\" she says, and you realize she's right.",
      { scene: SC.one, requires: [P3, { beatMark: "hod_flooded_probably_beaumont" }], choices: [ch("Back to the office.", "hod_clerk_window"), ch("On to the next district.", "")] }),
    beat("hod_the_vote", "Maybe Beaumont? — The Vote",
      "The roles were volunteered. Ines has followed you to the second district because the second district is where the minutes are, and she is the Clerk of all three towns now, probably. \"The week the light came it put it to us. Not in words — in shapes. A town with a plan, or a town without one.\" She opens the book. \"Forty-one to nine. I was one of the nine. I kept the minutes anyway. That's the job.\" The imposed logic you came here to interrupt was carried on a show of hands, and the hands are still up, and some of them are tired.",
      { speaker: INES, scene: SC.two, priority: "high", timePoints: 1, requires: [P3, { beatMark: "hod_flooded_maybe_beaumont" }],
        memoryText: "The Clerk showed the Stewards the minutes: the flooded towns voted to keep the light, forty-one to nine, on That One Night.",
        receipts: [{ label: "The Minutes", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Ines Calloway's minute book" }, truth: "Three towns lit up on the same night, at the same minute, and voted to keep the light. Dated in a Clerk's hand to That One Night — the same night the East Wall leaned. A page that says the flooded towns are a symptom, not a haunting. File it with the Riders; show it to Gloomgill when he asks who pays later." }],
        choices: [
          ch("Ask who the nine were.", "", { description: "\"People with somewhere else to be. There is nowhere else to be. That's why it was nine.\"" }),
          ch("Ask if she'd vote the same way now.", "", { description: "\"Ask me after you've done whatever you're going to do at the Barrens. That's the vote that counts.\"" }),
          ch("Take the minutes and go on to the Barrens.", "hod_flooded_bedlam_barrens", { description: "She tears the page out cleanly, which a Clerk never does." })
        ] }),
    beat("hod_dispatcher_booth", "Maybe Beaumont? — The Dispatcher",
      "\"REROUTING IS NOW MANDATORY. THANK YOU FOR YOUR PATIENCE.\" The voice comes from the booth, the gutters, and the light under your boots at once, in the cadence of a PA system that has never once been interrupted. It is not angry. It is trying to complete a sentence it started two turns ago and it keeps running out of street.",
      { speaker: DISP, scene: SC.two, requires: [P3, { beatMark: "hod_flooded_maybe_beaumont" }], repeatable: true, choices: [
        ch("Ask what it is trying to finish.", "", { description: "\"A ROUTE. ALL TRAFFIC. TO PROCEED.\" A pause the length of a held breath. \"THERE WAS A WHOLE ROUTE. THERE IS A THIRD OF IT HERE.\"" }),
        ch("Tell it the vote was real.", "", { description: "\"NOTED. THANK YOU FOR YOUR FEEDBACK.\" Something in the light softens by about the width of a hand." }),
        ch("Give it the seven positions as a heading.", "hod_route_posted", { requires: { beatMark: "ag_pipeline_backward" }, description: "You read the fold out loud, position by position, the way Captain Robot did." })
      ] }),
    beat("hod_route_posted", "Three Towns — The Route, Posted",
      "Every traffic instruction in three towns turns at once, like fish. \"ALL TRAFFIC TO PROCEED VIA —\" and it says the heading, the one from the fold, the one Captain Robot verified at Legansus, and for the first time since the sky tore the lights under the water all run the same direction and stop trying to be streets. \"THANK YOU FOR YOUR PATIENCE,\" says the Dispatcher, and it means it.",
      { speaker: DISP, scene: SC.two, priority: "high", requires: [P3, { beatMark: "hod_dispatcher_booth" }],
        memoryText: "Given the seven positions as a heading, the Dispatcher posted one route across all three flooded towns — the Legansus heading.",
        choices: [ch("Let it run.", "", { description: "A fourth way in, lit from underneath." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoiceFirst = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [c, ...(b.choices || [])]; }, what);
  addChoiceFirst("hod_flooded_probably_beaumont", ch("Find whoever is still issuing permits.", "hod_clerk_window"), "→ the Last Clerk");
  addChoiceFirst("hod_flooded_maybe_beaumont", ch("Find the booth the voice is coming from.", "hod_dispatcher_booth"), "→ the Dispatcher");
  for (const id of ["hod_flooded_maybe_beaumont_interrupt", "hod_flooded_maybe_beaumont_escalate"]) edit(id, b => { for (const c of (b.choices || [])) if (c.next === "hod_flooded_bedlam_barrens") { c.next = "hod_the_vote"; c.label = "Ask who assigned the roles."; } }, "routes through THE VOTE");
  // hand-offs: the Riders file it; Gloomgill Q4
  edit("enc_circuit_riders_file_it", b => { if (!(b.choices || []).some(c => c.label === "File the Minutes.")) b.choices = [...(b.choices || []).filter(c => c.next === "enc_circuit_riders_filed"), ch("File the Minutes.", "enc_circuit_riders_filed", { requires: { beatMark: "hod_the_vote" }, description: "Arvind reads the count. \"FORTY-ONE TO NINE. A TOWN VOTED.\" Dennis wants to know if the nine are all right. Simone times the pause. No lag." }), ...(b.choices || []).filter(c => c.next !== "enc_circuit_riders_filed")]; }, "File the Minutes (hidden)");
  edit("gloomgill_question_4", b => { if (!(b.choices || []).some(c => c.label === "Show him the Minutes.")) b.choices = [...(b.choices || []), ch("Show him the Minutes.", "gloomgill_question_5", { requires: { beatMark: "hod_the_vote" }, description: "\"Forty-one to nine, and they're still paying. Later arrived and they'd already voted for it. Correct energy.\"" })]; }, "Show him the Minutes (hidden)");

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for flooded_towns not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    SCRIPT.giver = "The Water Choir's lean, and Sable Nine's chart — the same heading, three towns under water that aren't drowned. And one office still open.";
    SCRIPT.steps = [
      { id: "arrive", label: "Lit From Underneath", line: "Probably Beaumont is lit from underneath and nobody has drowned. Go stand in the office that is still open.", beats: ["hod_flooded_probably_beaumont"], done: { mark: "hod_flooded_probably_beaumont" } },
      { id: "clerk", label: "The Last Clerk", line: "Ines will stamp you a permit to exist. Ask her what the permit is for. Ask her if it's Beaumont.", beats: ["hod_clerk_window"] },
      { id: "beaumont", label: "Stabilize or Ride", line: "Stabilize the leyflow with care, or ride the surge and harvest data. The town will tell you which one you did.", beats: ["hod_flooded_probably_beaumont"], done: { anyOf: ["hod_flooded_probably_beaumont_stabilize", "hod_flooded_probably_beaumont_surge"] } },
      { id: "maybe", label: "Maybe Beaumont?", line: "Maybe Beaumont is assigning people roles. Interrupt it, or document it and get out.", beats: ["hod_flooded_maybe_beaumont"], done: { anyOf: ["hod_flooded_maybe_beaumont_interrupt", "hod_flooded_maybe_beaumont_escalate"] } },
      { id: "vote", label: "The Vote", line: "Ask who assigned the roles. Sit down for the answer. Take the minutes; she kept them.", beats: ["hod_the_vote"] },
      { id: "dispatcher", label: "The Dispatcher", line: "It has been rerouting traffic that doesn't exist for two turns. Ask it what it is trying to finish. If you carry a heading, give it one.", beats: ["hod_dispatcher_booth"] },
      { id: "barrens", label: "Bedlam Barrens", line: "Bedlam Barrens isn't even wet. Ground the pattern or break it — knowing now that the pattern was voted in.", beats: ["hod_flooded_bedlam_barrens"], done: { mark: "hod_flooded_bedlam_barrens" } },
      { id: "ground", label: "Ground or Break", line: "Ground the surge and reconcile it, or fracture it before it completes. Nine people in Maybe Beaumont are watching which.", beats: ["hod_flooded_bedlam_barrens"], done: { anyOf: ["hod_flooded_bedlam_barrens_ground", "hod_flooded_bedlam_barrens_break"] } },
      { id: "whole", label: "The Hod Echoes", line: "Now the pattern is obvious. Say what it is.", beats: ["spark_hod_echoes_reconstituting"] }
    ];
    SCRIPT.doors = [
      { id: "sign", label: "The Sign", line: "It's under four feet of lit water and nobody has read it. Wade out. Settle nothing.", beats: ["hod_the_sign"] },
      { id: "booth", label: "The Dispatcher's Booth", line: "Rerouting is now mandatory. Thank it for its patience. Ask it what it's trying to finish.", beats: ["hod_dispatcher_booth"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "hod_route_posted"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script flooded_towns → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +route)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-flooded-towns-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Flooded Towns retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Flooded Towns retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-flooded-towns-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Flooded Towns retrofit APPLIED: ${changes} change(s). Probably. F5.`);
})();
