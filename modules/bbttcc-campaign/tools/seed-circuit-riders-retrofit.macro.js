/* seed-circuit-riders-retrofit.macro.js — CIRCUIT RIDER PARLEY to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/CIRCUIT_RIDERS_RETROFIT_2026_09_27.md. Captain Robot speaks on his beats; crew personas gain voice (secrets untouched); the turn
 * ("will you look?") moves late (early asks bounce off doctrine); FILE IT LIKE A RIDER spends the campaign's receipts (+1 crVerify each via
 * worldEffects.meters); closers get ending names; THE RIDERS ANSWER after the alliance; the Colossus gets a door.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "circuit_riders", Q_MAIN = "quest_circuit_riders_parley";
  const MARKER = "[RIDERS-RETROFIT-2026-09-27]";
  const E = (s) => `enc_circuit_riders_${s}`;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const CREW = {
    "Simone": { topics: "lag, timing, casualties, interruptibility, the relay, verification, Captain Robot", notes: `${MARKER} VOICE — Simone checks whether you lag. Lag is where casualties breed. Clipped, exact, counts under her breath; asks whether you are capable and also interruptible, and means both as compliments. She once had enough warning to save everyone and used it to optimize the outcome; that sentence has blood in it and she does not flinch from it if asked plainly. Reads corroboration by TIMING it.` },
    "Arvind": { topics: "patterns, signal, distortion, the confidence interval, models, optimization, darkness, verification", notes: `${MARKER} VOICE — Arvind hears patterns, and knows the difference between the ones that are there and the ones he likes. Quiet, careful, a man who powers down a display when the questioner's need to understand is hungrier than honest. People died inside his confidence interval because the model was beautiful. Reads corroboration by asking whether the story is coherent OR true, and then which.` },
    "Howard": { topics: "recovery, rescue, alliance, the plan, follow-through, cost, Captain Robot", notes: `${MARKER} VOICE — Howard recovers things. Slow, large-handed, says what alliance costs before he says what it gives: "your emergency is allowed to become mine without first becoming a transaction." He left somebody once because he was following the plan, and he still died alone; Howard waits before he answers now, always, once. Reads corroboration by reading the NAMES and saying nothing.` },
    "Dennis": { topics: "hypotheses, drafts, probably fine, speed, verification, branding, the Colossus, delight", notes: `${MARKER} VOICE — Dennis is the regrettable but occasionally necessary hypothesis, and is delighted by everything, including being called that. Fast, bright, load-bearing phrases are his hobby ("probably fine" is not one). "Speed without verification is just panic with branding." He named the anxious robot the size of a skyscraper "the Colossus, provisionally," which is a hypothesis. Reads corroboration by asking whether someone did the work of becoming believable.` }
  };
  const actorIds = {};
  for (const [name, p] of Object.entries(CREW)) {
    const actor = (game.actors?.contents || []).find(a => a.name === name);
    if (!actor) { say(`✗ actor "${name}" not found`); continue; }
    actorIds[name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${name}`); continue; }
    changes++; say(`✚ persona ${name}: voice + topics (secret kept)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n") });
  }
  for (const n of ["Captain Robot"]) { const a = (game.actors?.contents || []).find(x => x.name === n); if (a) actorIds[n] = a.id; }
  const sp = (n) => actorIds[n] || null;

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of [E("parley_opening"), E("captain_robot_intro"), E("witness_request"), E("parley_resolution"), E("parley_alliance")]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Riders were never seeded here.`);
  const sceneOf = (...ids) => { for (const id of ids) { const s = byId.get(id)?.sceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { camp: sceneOf(E("captain_robot_intro")), approach: sceneOf(E("parley_approach")) };

  const TAGS = "circuit_riders story";
  const P2 = { flag: "storyPhase", gte: 2 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, requires = null, timePoints = 0, priority = "background", memoryText = null, scene = null, meters = null, repeatable = true } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_MAIN, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(meters ? { meters } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const filing = (label, mark, desc) => ch(label, E("filed"), { requires: { beatMark: mark }, description: desc });

  const NEW = [
    beat(E("not_yet"), "Circuit Riders — Not Yet",
      "\"VERIFICATION FIRST. FRIENDSHIP SECOND. RESCUE THIRD.\" Captain Robot does not move. \"YOU HAVE ASKED FOR STEP THREE. YOU ARE ON STEP ONE.\" He does not wink. The suit does not wink. \"YOU WILL BE TOLD WHEN YOU MAY LOOK.\" Behind him, something the size of a skyscraper shifts its weight and a post-it note falls off it.",
      { speaker: sp("Captain Robot"), scene: SC.camp, requires: [P2], choices: [ch("Back to step one.", E("parley_opening")), ch("Ask what step one is.", E("captain_robot_3"), { description: "\"DECIDING WHAT YOU ARE. IT MATTERS MORE THAN ANY FIGHT.\"" })] }),
    beat(E("file_it"), "Circuit Riders — File It Like a Rider",
      "\"VERIFIED COORDINATES. VERIFIED NEED. NO THEATRICS.\" Captain Robot holds out a hand the size of a hubcap. \"FILE IT THE WAY A RIDER WOULD.\" The crew arrange themselves the way a filing system arranges itself: Simone with a watch, Arvind with a slate, Howard with nothing, Dennis with a theory he is visibly restraining.",
      { speaker: sp("Captain Robot"), scene: SC.camp, requires: [P2], choices: [
        filing("File the parade permit.", "stillwater_parade_permit", "Dennis: \"THAT IS A DATE. A REAL DATE.\" Simone times how long it takes him to calm down. No lag."),
        filing("File the caravan route.", "ag_caravan_route", "Simone times it against the relay log. \"NO LAG,\" she says, which from Simone is a hug."),
        filing("File the dropped manifest.", "kt_dropped_manifest", "Howard reads the names. Howard says nothing. That is how you know they are verified."),
        filing("File the official word from Khezek-Tor.", "kt_official_word_given", "Arvind: \"SOMEONE DID THE WORK OF BECOMING BELIEVABLE.\" Dennis is delighted."),
        filing("File the camcorder clip.", "mall_watch_clip", "The relay watches the whole thing twice. The second time it watches the four seconds underneath, and the Colossus sits down."),
        filing("File the sideways manifest.", "map_port_kudzu_testimony", "\"A CAPTAIN KEEPS PAPER,\" says Captain Robot. \"WE RESPECT PAPER.\""),
        ch("Nothing to file yet.", E("captain_robot_intro"), { description: "\"THEN WE WAIT. WAITING IS A VERIFICATION STEP.\"" })
      ] }),
    beat(E("filed"), "Circuit Riders — Filed",
      "A Rider writes VERIFIED on a slate and does not underline it, because underlining is theatrics. The relay tower ticks once. Something on the tally that governs whether these people will ever come when you call moves by one, and Captain Robot, who has been running step one on you since the static started, adjusts nothing about his posture at all, which is how you know it moved.",
      { type: "narration", speaker: sp("Captain Robot"), scene: SC.camp, requires: [P2], meters: [{ key: "crVerify", delta: 1, max: 4 }], memoryText: "The Stewards filed corroboration with the Circuit Riders, the way a Rider would.",
        choices: [ch("File another.", E("file_it")), ch("Terms of contact.", E("parley_resolution"))] }),
    beat(E("colossus"), "Circuit Riders — The Colossus",
      "It is the size of a skyscraper and it is nervous. It paces. When it paces the camp shakes and the Riders adjust their post-it notes without looking up, the way you'd steady a glass. Dennis explains, with real enthusiasm, that it is a Rider in costume, that the costume is load-bearing, and that its name is \"the Colossus, provisionally,\" which is a hypothesis. It notices you noticing. It waves. It is so relieved when you wave back that it sits down, and three post-its fall off.",
      { scene: SC.approach, requires: [P2], choices: [ch("Wave back.", "", { description: "It waves again. It will do this as long as you do." }), ch("Ask Dennis what it's nervous about.", "", { description: "\"EVERYTHING. THAT'S WHAT MAKES IT A GOOD RIDER. PROBABLY.\" He hears himself. \"NOT PROBABLY.\"" }), ch("Ask its name.", "", { description: "\"PROVISIONALLY, THE COLOSSUS.\" The Colossus looks like it would like a vote." })] }),
    beat(E("the_riders_answer"), "Circuit Riders — The Riders Answer",
      "The call is clean: verified coordinates, verified need, no theatrics. They come hard. They come fast. They do not come theatrically, although the Colossus arrives first and has to be talked down from a hill by Dennis, who is delighted. \"WE SAID WE WOULD COME,\" says Captain Robot, to nobody in particular, adjusting a relay that does not need it. \"THIS IS US COMING.\"",
      { speaker: sp("Captain Robot"), scene: SC.approach, priority: "high", timePoints: 1, repeatable: false, requires: [P2, { beatMark: E("parley_alliance") }],
        memoryText: "The Circuit Riders answered a clean call. Hard, fast, without theatrical delay. The Colossus arrived first.",
        choices: [ch("Point them at it.", "", { description: "They are already pointed. That is what verification was for." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);
  // the turn moves late: early "show us" asks bounce off doctrine; the request itself waits for the witness pressure step
  for (const id of [E("parley_opening"), E("captain_robot_intro"), E("captain_robot_3")]) edit(id, b => { for (const c of b.choices || []) if (c.next === E("witness_request")) { c.next = E("not_yet"); } }, "show-us → not yet");
  edit(E("witness_request"), b => { b.inject = b.inject || {}; const req = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []); if (!req.some(r => r && r.beatMark === E("pressure_witness"))) b.inject.requires = [...req, { beatMark: E("pressure_witness") }]; b.speakerActorId = b.speakerActorId || sp("Captain Robot") || null; }, "gated on the witness pressure step");
  addChoice(E("pressure_witness"), ch("\"Show us what you see.\"", E("witness_request"), { description: "Now. Now you may look." }), "the turn, offered late");
  addChoice(E("parley_resolution"), ch("File something first.", E("file_it")), "→ file it");
  // ending names on the closers
  for (const [id, ending] of [[E("parley_alliance"), "alliance"], [E("parley_neutral"), "neutral"], [E("parley_flagged"), "flagged"]]) edit(id, b => { b.story = { quest: KEY, role: "closer", ending }; }, `closer · ending ${ending}`);
  // voices
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice(["parley_opening", "parley_respect", "parley_humor", "parley_skepticism", "pressure_doctrine", "pressure_darkness", "pressure_witness", "parley_resolution", "parley_alliance", "parley_neutral", "parley_flagged", "captain_robot_intro", "captain_robot_1", "captain_robot_2", "captain_robot_3", "captain_robot_4", "captain_robot_5", "captain_robot_echo"].map(E), "Captain Robot");
  voice(["circuit_riders_classification_review", "circuit_riders_review_stood"], "Captain Robot");

  // story script
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for circuit_riders not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const lines = { riders: "Static on the metal. Something the size of a skyscraper is pretending to be under control. Approach, or watch it pace first.", parley: "DO NOT BE ALARMED, CITIZENS. Pick how you meet a man in a robot suit. Do not ask him to wink.", witness: "They want someone to see what they see and survive it. You will be told when you may look.", terms: "Terms of contact. Alliance is earned, not picked. Everything you filed counts." };
    for (const s of SCRIPT.steps) if (lines[s.id]) s.line = lines[s.id];
    const doors = [
      { id: "file", label: "File It Like a Rider", line: "Verified coordinates, verified need, no theatrics. Every receipt you hold is a filing. File it.", beats: [E("file_it")] },
      { id: "colossus", label: "The Colossus", line: "It is the size of a skyscraper and it is nervous. Wave. It will be so relieved.", beats: [E("colossus")] }
    ];
    for (const d of doors) if (!(SCRIPT.doors || []).some(x => x.id === d.id)) SCRIPT.doors = [...(SCRIPT.doors || []), d];
    const see = (SCRIPT.doors || []).find(d => d.id === "see"); if (see) see.line = "You do not get to witness their burden casually. You will be told when you may look. Then stay for the whole pattern.";
    SCRIPT.after = Array.from(new Set([E("the_riders_answer"), ...(SCRIPT.after || [])]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script circuit_riders → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +the Riders answer)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-circuit-riders-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Circuit Riders retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Circuit Riders retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-riders-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Circuit Riders retrofit APPLIED: ${changes} change(s). DO NOT BE ALARMED. F5.`);
})();
