/* seed-forgotten-cause-retrofit.macro.js — THE FORGOTTEN CAUSE to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/FORGOTTEN_CAUSE_RETROFIT_2026_09_27.md; bible §9 (guest list step; the feud tied to Night One; the Ledger closed by a Steward reading it)
 * + §7 (THE GUEST LIST, THE PETTING-ZOO RECEIPT) + §8 (turn = "your name on a card"). NEW actor The Maître-D' (Wendigo) with secrets; the road
 * Wendigo as a beat; SEATED (the turn, moved out of the table's opening prose); THE NIGHT ITSELF; receipts on the cards and on Restore; the
 * Ledger read aloud (hidden, no roll); BREAK completes the parent quest. Dougan untouched. Idempotent; backs up the campaigns setting.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "forgotten_cause", Q_MAIN = "fc_wendigo_confluence", Q_TABLE = "fc_long_table";
  const MARKER = "[FORGOTTEN-CAUSE-RETROFIT-2026-09-27]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const MAITRE = { name: "The Maître-D'", topics: "the table, the cards, seating, the guests, the region's forgotten, the knot, the network, courtesy, directions, canteens, the night, the other night, the bunker, the line, what we were sold, the goat, the reason, the Ledger",
    notes: `${MARKER} PRIVATE TRUTH — The Maître-D' speaks for the Wendigo: the politest monsters in the world. They set a long table where the leylines knot with a hand-lettered card for everyone the region forgot, and one for you, because you will be; they hold the forgotten, and holding too much, they smooth what they hold, and the first thing they smoothed off was the reason for the feud. VOICE: a host's exactly, and nothing a person would say — no small talk, ever; every sentence is a seating, a thanks, a direction, or a course. They hand back things you never dropped and thank you for directions you never gave. They are not threatening. They are thorough. WHAT THEY ARE: the bunker's people, fed the wrong blood by the Tamsins' private line and sealed in with the mountain on Halloween 2077; a century below on the Dark Stillness; up on the Night of Oh Holy Fucking Shit My Christ (~2177). They do not know what they were sold. They say the name of their night flatly, like a date, and if asked properly they say the first one too. THE TURN: they read your card to you and get your name right, which almost nobody manages. They remember FILING the reason for the feud; they do not remember the goat. Shown the Service Manifest or the Guest List they go very still, all of them, and for the first time there is small talk, and it is "oh."`,
    secrets: [
      "Your Name on a Card :: stirThePot :: a Steward asks who SET the table, not who sits at it :: They did. A card for everyone the region forgot, in a hand that never hurries, and one for you, because you will be. They are not threatening you. They are being thorough.",
      "What We Were Sold :: oppRollMinus2 :: a Steward shows them the Service Manifest or the Guest List :: They were the bunker's people, fed the wrong blood by a private line from a mine, and sealed in with it when the mountain went. They did not know. They say the name of their night flatly, like a date, and then they say the other one."
    ] };
  const actorIds = {};
  let mt = (game.actors?.contents || []).find(a => a.name === MAITRE.name);
  if (!mt) { say(`✚ CREATE actor "${MAITRE.name}"`); changes++; if (!DRY_RUN) mt = await Actor.create({ name: MAITRE.name, type: "npc" }); }
  if (mt) { actorIds.maitre = mt.id; const cur = mt.getFlag(MAL, "persona") || {}; if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona The Maître-D' +2 secrets"); if (!DRY_RUN) await mt.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), MAITRE.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), MAITRE.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...MAITRE.secrets].filter(Boolean).join("\n") }); } else say("· ok persona The Maître-D'"); }
  const dougan = (game.actors?.contents || []).find(a => a.name === "Dougan Marsh"); if (dougan) actorIds.dougan = dougan.id;
  const MT = actorIds.maitre || null;

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["wendigo_confluence_the_long_table", "wendigo_confluence_name_cards", "wendigo_confluence_repair", "wendigo_confluence_break", "gullywasher_cultural_summit", "fc_bridge_off"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Forgotten Cause was never seeded here.`);

  const TAGS = "forgotten_cause story";
  const P2 = { flag: "storyPhase", gte: 2 };
  const TABLE = { quest: KEY, chapter: "the_long_table" };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, questId = Q_TABLE, repeatable = false } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || TABLE, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("fc_road_wendigo", "The Road — The Politest Monsters in the World",
      "One of them hands you back a canteen with a small, courteous bow. You are fairly sure you never dropped your canteen. Another thanks you, warmly and at some length, for the excellent directions. You did not give it any. They are the most polite monsters in the world and there is no small talk whatsoever; they say exactly what a host says and nothing a person would, and then they go on down the road, in step, toward wherever the table is.",
      { speaker: MT, story: { quest: KEY }, questId: Q_MAIN, requires: [P2, { flag: "wendigoRung", gte: 1 }], repeatable: true, choices: [
        ch("Give one of them something.", "", { description: "It takes it, thanks you, and files it somewhere you cannot see, and you find you cannot quite picture what it was." }),
        ch("Ask for directions.", "", { description: "Very good ones. To somewhere you were already going." }),
        ch("Ask where they're going.", "", { description: "\"To set the table.\" They say it the way you'd say \"to work.\"" })
      ] }),
    beat("fc_seated", "The Confluence — Seated",
      "The host pulls out a chair. It is your chair; it has been your chair for some time. The card at your place is hand-lettered in a script that never hurries, and the host reads it to you, because that is what a host does, and it is your name, spelled right, which almost nobody manages. Three seats down there is a card with a name you buried. The host does not read that one. The host knows you can.",
      { speaker: MT, questId: Q_MAIN, priority: "high", timePoints: 1, requires: [P2, { questBucket: Q_MAIN, is: "active" }],
        memoryText: "The Wendigo seated the Stewards at the Long Table and read them their own names off the cards.",
        choices: [
          ch("Ask who set the table.", "", { description: "\"We did. For everyone the region forgot. You are not forgotten yet. We are being thorough.\"" }),
          ch("Ask why your name.", "", { description: "\"Everyone's name. Eventually. It is not a threat. It is a place setting.\"" }),
          ch("Sit.", "wendigo_confluence_name_cards", { description: "Dinner is finally served. It is very good, and you cannot afterwards say what it was. Now read the cards." })
        ] }),
    beat("fc_night_one", "The Confluence — The Night Itself",
      "You ask the name of their night, and they say it flatly, like a date: the Night of Oh Holy Fucking Shit My Christ. Then, because you asked properly, they say the other one, the first one — Halloween 2077 — the night the mountain went and the line went with it and the bunker was sealed with everyone in it. Up above, they say, the Drowned South ran toward it, and the towns did not hear the news, and the bunker's people were under all of it, being fed. The last thing they filed, before they started smoothing, was the reason for a feud about a goat. They do not remember the goat. They remember filing it.",
      { speaker: MT, questId: Q_MAIN, priority: "high", requires: [P2, { beatMark: "wendigo_confluence_name_cards" }],
        memoryText: "The Wendigo named both their nights to the Stewards: the Night of OHFSMC, and Halloween 2077 before it.",
        choices: [
          ch("Show them the Service Manifest.", "", { requires: { beatMark: "hv_service_manifest" }, description: "They go very still, all of them, and for the first time there is small talk, and it is \"oh.\"" }),
          ch("Show them the Guest List.", "", { requires: { beatMark: "wendigo_confluence_name_cards" }, description: "Their own names, read back to them. They thank you. They mean it. Nobody has ever read them the list." }),
          ch("Back to the table. Decide.", "wendigo_confluence_the_long_table")
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  // the turn moves out of the table's opening prose
  edit("wendigo_confluence_the_long_table", b => {
    b.speakerActorId = b.speakerActorId || MT || null;
    if (/There is a card with your name on it/.test(b.description)) b.description = b.description.replace(/There is a card with your name on it\.\s*There is a card, three seats down, with a name you buried\./, "The host is waiting to seat you.");
    if (!(b.choices || []).some(c => c.next === "fc_seated")) b.choices = [ch("Let the host seat you.", "fc_seated"), ...(b.choices || [])];
  }, "the name-card lines → Seated; the host seats you");
  // the cards are a client list
  edit("wendigo_confluence_name_cards", b => {
    b.speakerActorId = b.speakerActorId || MT || null;
    if (!/TAMSIN MINE POWER/.test(b.description)) b.description += "\n\nRead again, they are not a memorial. They are a list, in one hand, and at the head of the table is a card that isn't a name: TAMSIN MINE POWER — PRIVATE LINE — ONE CLIENT. Everyone at this table was what the bunker bought.";
    b.worldEffects = b.worldEffects || {};
    if (!(b.worldEffects.receipts || []).some(r => r.label === "The Guest List")) b.worldEffects.receipts = [...(b.worldEffects.receipts || []), { label: "The Guest List", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the Long Table's place cards" }, truth: "The bunker's people, by name, in the Wendigo's own hand, and the one client above them: TAMSIN MINE POWER, PRIVATE LINE. Convinces the Wendigo of what they were sold; corroborates the Service Manifest from the Hidden Vault." }];
    if (!(b.choices || []).some(c => c.next === "fc_night_one")) b.choices = [ch("Ask them the name of their night.", "fc_night_one"), ...(b.choices || [])];
  }, "THE GUEST LIST + the night");
  // Restore comes back with a receipt, and the receipt has a goat on it
  edit("wendigo_confluence_repair", b => {
    b.speakerActorId = b.speakerActorId || MT || null;
    if (!/goat/i.test(b.description)) b.description += "\n\nAnd the cause comes back the way filed things come back: as a receipt. Thermal paper, faded, one line legible: PETTING ZOO — TEAM BUILDING (1) — GOAT ENCOUNTER, TEAM RATE — 10/31/2077. The Long Table goes very quiet. Then someone laughs.";
    b.worldEffects = b.worldEffects || {};
    if (!(b.worldEffects.receipts || []).some(r => r.label === "The Petting-Zoo Receipt")) b.worldEffects.receipts = [...(b.worldEffects.receipts || []), { label: "The Petting-Zoo Receipt", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the Wendigo's smoothed archive, restored" }, truth: "The erased cause of the Chupacabra–Jackalope feud: one team-building outing, one reluctant goat, an argument about how to approach it, in progress at the exact moment of the Shattering. Read it aloud into the Ledger's reason-column and the feud laughs closed." }];
  }, "THE PETTING-ZOO RECEIPT");
  edit("wendigo_confluence_redirect", b => { b.speakerActorId = b.speakerActorId || MT || null; }, "speaker");
  edit("wendigo_confluence_break", b => {
    b.speakerActorId = b.speakerActorId || MT || null;
    b.worldEffects = b.worldEffects || {}; const qe = b.worldEffects.questEffects || [];
    if (!qe.some(q => q.questId === Q_MAIN && q.action === "complete")) b.worldEffects.questEffects = [...qe, { action: "complete", questId: Q_MAIN, beatId: "", state: "completed", text: "Peace by deletion — the names left, and so did the reason." }];
  }, "BREAK completes the parent quest");
  // REVIEW 2026-10-01 (MEDIUM ×2): (1) for a DECLARED beat the engine ignores questEffects bucket moves — Break closes the quest by its story
  // declaration (alsoEnds, the map_legansus_waystation_verified pattern), so forgotten_cause can close on Break. (2) the Maître-D' voices the three
  // Long Table endings, so a talk with ANY Maître-D' (the road Wendigo too) could enact Restore/Redirect/Break cold: they are routing-only now —
  // gated on the table + the chapter still open, dialogueOffer:false (the table's choices still route; a route never consults inject.requires).
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  const GATE_TABLE_END = [P2, { beatMark: "wendigo_confluence_the_long_table" }, { questBucket: Q_TABLE, isNot: "completed" }];
  for (const id of ["wendigo_confluence_repair", "wendigo_confluence_redirect", "wendigo_confluence_break"]) edit(id, b => { ensureReq(b, GATE_TABLE_END); if (b.dialogueOffer !== false) b.dialogueOffer = false; }, "routing-only ending: gated on the table + chapter open; dialogueOffer:false");
  edit("wendigo_confluence_break", b => { b.story = b.story && typeof b.story === "object" ? b.story : { ...TABLE, role: "ending", ending: "break" }; const ae = Array.isArray(b.story.alsoEnds) ? b.story.alsoEnds : []; if (!ae.some(x => x && x.quest === KEY && !x.chapter)) b.story.alsoEnds = [...ae, { quest: KEY, ending: "break" }]; }, "BREAK closes the Forgotten Cause (story.alsoEnds)");
  // the Ledger, read aloud
  edit("gullywasher_cultural_summit", b => { if (!(b.choices || []).some(c => /Petting-Zoo/i.test(c.label))) b.choices = [ch("Read the Petting-Zoo Receipt into the reason-column, by name.", "gullywasher_cultural_summit_success", { requires: { beatMark: "wendigo_confluence_repair" }, description: "No roll. A Steward's voice, a goat, a team rate, a date. The Chupacabra at one end and the Jackalope at the other hear the same sentence for the first time in two hundred years, and one of them laughs first, and it doesn't matter which." }), ...(b.choices || [])]; }, "the Ledger read aloud");

  // story script
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for forgotten_cause not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  // REVIEW 2026-10-01: the table's direct choices (read the cards, Restore/Redirect/Break) skip Seated and the Night — those count as done too,
  // or NOW falls back to "the host is waiting to seat you" after the table is decided
  const FC_DECIDED = ["wendigo_confluence_repair", "wendigo_confluence_redirect", "wendigo_confluence_break"];
  const FC_SEATED_DONE = ["fc_seated", "wendigo_confluence_name_cards", ...FC_DECIDED], FC_NIGHT_DONE = ["fc_night_one", ...FC_DECIDED];
  if (SCRIPT) {
    const old = Object.fromEntries(SCRIPT.steps.map(s => [s.id, s]));
    SCRIPT.steps = [
      { ...old.off, line: "The Wendigo on the roads are kind, and something is off. They hand back a canteen you never dropped. Meet them twice and say the shape out loud at the Gullywasher." },
      { id: "road", label: "The Politest Monsters in the World", line: "Thank them for the directions you didn't ask for. Try to give one of them something. Watch what happens to it.", beats: ["fc_road_wendigo"] },
      { ...old.dougan, line: "Dougan has stopped polishing the glass. Go to the bar. Ask who kept staging the feud." },
      { ...old.table, label: "The Long Table Is Set", line: "Where the leylines knot, a table is set. Do not sit yet. Read the room first; the room has been reading you.", beats: ["fc_bridge_confluence", "wendigo_confluence_the_long_table"], done: { mark: "wendigo_confluence_the_long_table" } },
      { id: "seated", label: "Seated", chapter: "the_long_table", line: "The host is waiting to seat you. There is a card at your place. Let them read it to you.", beats: ["fc_seated"], done: { anyOf: FC_SEATED_DONE } },
      { id: "guests", label: "The Guest List", chapter: "the_long_table", line: "Read the cards. They are not a memorial. They are a client list, and the client is one mine.", beats: ["wendigo_confluence_name_cards"], done: { mark: "wendigo_confluence_name_cards" } },
      { id: "night", label: "The Night Itself", chapter: "the_long_table", line: "Ask them the name of their night. They say it flatly, like a date. Then they say the other one.", beats: ["fc_night_one"], done: { anyOf: FC_NIGHT_DONE } },
      { id: "decide", label: "Restore, Redirect, Break", chapter: "the_long_table", line: "Restore the node, take the trust onto yourselves, or sever the network. Restore comes back with a receipt, and the receipt has a goat on it.", beats: ["wendigo_confluence_the_long_table"], done: { chapter: ["forgotten_cause", "the_long_table"] } },
      { ...old.reason },
      { ...old.ledger, line: "A Chupacabra at one end, a Jackalope at the other, the Ledger open between them. Read the receipt into the reason-column, out loud, by name. No roll." }
    ].filter(Boolean);
    SCRIPT.doors = [
      { id: "gully", label: "The Gullywasher", line: "Dougan pours before he answers. Order something. Ask who kept staging it.", beats: ["gullywasher_dougan_points_to_confluence"] },
      { id: "road", label: "The Road Wendigo", line: "They will hand you back something you never dropped. Say thank you. They're being thorough.", beats: ["fc_road_wendigo"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "grief_quartet_capstone"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script forgotten_cause → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-forgotten-cause-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Forgotten Cause retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Forgotten Cause retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-forgotten-cause-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Forgotten Cause retrofit APPLIED: ${changes} change(s). To revision. F5.`);
})();
