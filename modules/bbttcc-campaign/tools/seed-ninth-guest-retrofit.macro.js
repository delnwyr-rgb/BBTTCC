/* seed-ninth-guest-retrofit.macro.js — THE NINTH GUEST to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/NINTH_GUEST_RETROFIT_2026_09_30.md; bible §2 (the Committed Watch: 100 consented, count 99, WHO the ninth is stays UNWRITTEN — owner
 * slot, never resolved here) + §10 ("the pact's terms, what the hundred hold, whether the rite can be done again: write them as DISCOVERABLE
 * items; at the end the hundred are relieved"); Verna's persona canon (two unreadable names; the room she leaves made up; she counts to
 * ninety-nine now). ADDS: the sign at the mouth (the Mall's route board spent), the hand half-raised (no roll), THE TERMS OF THE WATCH (the
 * one receipt: the pact's terms, cut into the low hill), THE GAP AT DUSK (the turn: a Steward stands in the gap and the count comes out right
 * for one night), the heading (the Forest's receipt spent against the footprints → mark `ninth_guest_heading` for the Lost Statues), THE
 * MADE ROOM at the Vacancy (Verna), and NOT IN THIS AGE (the closer; the quest closes, the question does not). The plinth stops being the
 * closer. No new actor: the Garden does not speak; Verna gets a third secret. Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "ninth_guest", Q = "quest_ninth_guest";
  const MARKER = "[NINTH-GUEST-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. Verna ───────────────────────────────────────────────────────────────
  const verna = (game.actors?.contents || []).find(a => a.name === "Verna Tulliver") || null;
  if (verna) { const cur = verna.getFlag(MAL, "persona") || {};
    if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona Verna +1 secret (the made room)");
      if (!DRY_RUN) await verna.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), "the made room, the curtain, 'occupied', ninety-nine"].filter(Boolean).join(", "),
        notes: [String(cur.notes || "").trim(), `${MARKER} ADDENDUM — Once the Garden count has reached her (a Steward has counted, or says the number), Verna will talk about the room: THE ONE WE DON'T ASK ABOUT is made up every night now, clean sheets, water on the stand, curtains at the angle a person facing the sea would want, and she writes 'occupied' in the ledger in her own hand. She will not show the unreadable page to anyone who asks to SEE it; she will show it to anyone who asks what it FEELS like. Say 'statues' or 'standing stones' in her hearing and she goes very still and says "room's on the house tonight," and that is the end of the conversation, kindly. She counts to ninety-nine when she stress-counts now, and stops.`].join("\n\n"),
        secretsRaw: [String(cur.secretsRaw || "").trim(), "The Made Room :: favorPlus1 :: a Steward asks WHY she makes the room up, not for whom :: Because the sign is never wrong, and because whoever walks that long deserves a room that expected them. She'll tell you the angle of the curtain. She will not tell you who."].filter(Boolean).join("\n") }); }
    else say("· ok persona Verna"); }
  else say("✗ Verna Tulliver not found — persona skipped");
  const VERNA = verna?.id || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["founders_garden_approach", "founders_garden_wonder", "founders_garden_the_count", "founders_garden_the_plinth"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Founders' Garden was never seeded here.`);
  const HEX = byId.get("founders_garden_approach").hexName || "Founder's Garden";

  const TAGS = "ninth_guest story";
  const P4 = { flag: "storyPhase", gte: 4 };
  const beat = (id, label, description, { type = "narration", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, questId = Q, repeatable = false, extraFx = null, hexName = HEX } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}), ...(hexName ? { hexName } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(extraFx || {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("founders_garden_the_sign", "The Founders' Garden — The Sign at the Mouth",
      "VISIT THE FOUNDERS' GARDEN. ONE HUNDRED FIGURES IN LIVING STONE. FAMILY PRICING. It fell, once; the post is snapped at the base and the break is old. Somebody stood it up again, carefully, and packed the base with stones, and the screws holding the panel to the post are new. Not new this year. New this century. Nobody has updated the number. Nobody has updated the price. The only thing in this garden that has ever been updated is the count.",
      { requires: [P4], repeatable: true, choices: [
        ch("You came by the mall's route board.", "", { requires: { beatMark: "mall_route_board" }, description: "The YOU ARE HERE was right. The exit still exists. Kickflip filed it under weather, and the weather held." }),
        ch("Look for who re-set it.", "", { description: "Hands unknown. The stones packed around the base are from the beach, carried up. Somebody comes here. Somebody who wanted the sign to be right." }),
        ch("Ask about family pricing.", "", { description: "There is nobody to ask. You ask anyway. The garden's occupied silence does not find it funny, and does not find it not funny." }),
        ch("Go in.", "founders_garden_wonder")
      ] }),
    beat("founders_garden_the_hand", "The Founders' Garden — The Hand Half-Raised",
      "One near the centre has a hand half-raised, and everyone who sees it completes the gesture differently. Say what it is. No roll; there is no right answer, and the garden has been waiting two hundred years to hear the wrong ones.",
      { requires: [P4], repeatable: true, choices: [
        ch("A wave.", "", { description: "Goodbye, then. Or hello. From here it is the same hand." }),
        ch("A vote.", "", { description: "Aye. One of a hundred. Carried." }),
        ch("Hold on.", "", { description: "Wait. Just wait. We have this. Go and do the thing we are holding this for." }),
        ch("Reaching for someone who left.", "", { description: "The silence around the hand changes, very slightly, and you decide not to say that one out loud again." }),
        ch("The low hill.", "founders_garden_the_terms")
      ] }),
    beat("founders_garden_the_terms", "The Founders' Garden — The Terms of the Watch",
      "The ranks fold around a low hill, and the hill has a face of cut stone on the seaward side, and the face has words in it, cut deep, in a hand that was in a hurry and did not care who knew it. ONE HUNDRED, CONSENTING. WE HOLD THE WORST OF IT. UNTIL RELIEVED. RELIEF IS SOMEONE COMING BACK FOR US AND SAYING SO. THE RITE MAY BE DONE AGAIN ONLY THIS WAY. Below that, a line, rubbed smooth by a thumb, over and over, until whatever it said is gone. The stone is warm. The day is not.",
      { requires: [P4, { beatMark: "founders_garden_the_count" }], priority: "high",
        memoryText: "The Stewards read the Terms of the Watch cut into the hill at the Founders' Garden: a hundred consenting, holding the worst of it until relieved.",
        receipts: [{ label: "The Terms of the Watch", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the hill at the Founders' Garden" }, truth: "One hundred, consenting. They hold the worst of it until relieved, and relief is someone coming back for them and saying so. The rite may be done again only that way. Produced to anyone who claims to own the Garden, the Watch, or the worst of it, it is the deed; produced at the end, it is the way to let them go." }],
        choices: [
          ch("Ask what 'relieved' means.", "", { description: "It means someone comes back. It does not say who. It does not say you." }),
          ch("Hold the Vault Label against the smooth line.", "", { requires: { beatMark: "lyrenn_vault_label" }, description: "Lyrenn's hand and the hill's hand are not the same hand. Good. That would have been too easy, and this garden does not do easy." }),
          ch("Copy the terms.", "founders_garden_the_gap", { description: "You copy them exactly, smooth line and all, and then it is getting dark, and the gap in the second rank is still there." })
        ] }),
    beat("founders_garden_the_gap", "The Founders' Garden — The Gap at Dusk",
      "You stand in it. The stone on the plinth is worn in the shape of two feet and the feet fit anyone, which is the first thing you learn. The second is that the hand half-raised, near the centre, is raised toward here. Toward whoever stands here. The sun goes down into the sea the way it has a hundred thousand times for these faces and for one night, with you in the gap, the count comes out right. The occupied silence empties. It is the most restful thing you have ever stood inside. \"You are relieved,\" somebody in your party says, to no one and to ninety-nine, and does not know why they said it, and a shoulder set for two hundred years comes down a finger's width. In the morning the count is wrong again, because you left. That is the terms.",
      { requires: [P4, { beatMark: "founders_garden_the_plinth" }], priority: "high", timePoints: 1,
        memoryText: "A Steward stood in the gap at the Founders' Garden at dusk. For one night the count came out right.",
        choices: [
          ch("Read the Terms of the Watch aloud, to them.", "", { requires: { beatMark: "founders_garden_the_terms" }, description: "Ninety-nine faces do not move. Something in the ranks does: a second shoulder, and a third, a finger's width each. They heard. They are holding it anyway. They said they would." }),
          ch("Hold the forest's heading against the footprints.", "ninth_guest_heading", { requires: { beatMark: "forest_of_tifaret_session_do_ok" }, description: "The stone figure in Early Tifaret faces the others. The footprints here walk toward the same line." }),
          ch("Keep the vigil till dawn.", "ninth_guest_not_in_this_age")
        ] }),
    beat("ninth_guest_heading", "The Founders' Garden — The Heading",
      "The forest's figure and the footprints from the plinth agree. Whoever stepped down walked inland, toward the others, toward wherever the standing stones went quiet, and did not walk back. Who they were is not written on anything you have found, and the line on the hill that might have said so has been rubbed smooth by a thumb that did not want it read. Where they went is written in the grass. Whoever is counting stone figures has a direction now.",
      { requires: [P4], priority: "high",
        memoryText: "The Stewards matched the Founders' Garden footprints to the Forest of Early Tifaret's heading: the missing one walked inland, toward the others.",
        choices: [ch("Keep the vigil till dawn.", "ninth_guest_not_in_this_age"), ch("Back to the gap.", "founders_garden_the_gap")] }),
    beat("ninth_guest_the_made_room", "The Vacancy — The Made Room",
      "THE ONE WE DON'T ASK ABOUT is made up. Clean sheets, water on the stand, the curtains at an angle that makes no sense until you work out that it is the angle a person facing the sea would want them. Verna writes 'occupied' in the ledger in her own hand, every night, and shows you the entry without being asked, because you have the Garden's dust on your boots and she counted it when you came in. She counts to ninety-nine when she is thinking now. She stops there.",
      { speaker: VERNA, type: "dialog", hexName: "Allesh-Gilliam", requires: [P4, { beatMark: "founders_garden_the_count" }], repeatable: true,
        memoryText: "Verna Tulliver keeps the Vacancy's last room made up for a guest who faces the sea, and writes 'occupied' in her own hand.",
        choices: [
          ch("Ask why she makes the room up.", "", { description: "\"Because the sign is never wrong. And because whoever walks that long deserves a room that expected them.\" She'll tell you the angle of the curtain. She will not tell you who." }),
          ch("Ask what the page feels like.", "", { description: "She shows you. She would not have if you'd asked to see it. The name slides off the mind the way a wet stone slides off a wall. She has copied it forty-one times. You can't read the copies either." }),
          ch("Say the word 'statues'.", "", { description: "She goes very still. \"Room's on the house tonight.\" That is the end of the conversation, kindly." }),
          ch("Leave it made up.", "", { description: "She was going to." })
        ] }),
    beat("ninth_guest_not_in_this_age", "The Founders' Garden — Not in This Age",
      "Dawn. Ninety-nine faces, one plinth, footprints walking away, a line rubbed smooth, a room made up in a town three days inland with the curtains at the right angle. You know what the hundred hold and on what terms and how they can be let go, and you know which way the one who left was walking. You do not know who they were. Nothing you have found says, and the one thing that might have has been thumbed blank by somebody who wanted it that way. This question does not close quickly. It may not close in this age. The Garden's silence, as you go, is the silence of ninety-nine people who have decided that is all right.",
      { requires: [P4, { beatMark: "founders_garden_the_gap" }], priority: "high", story: { quest: KEY, role: "closer", ending: "vigil" },
        memoryText: "The Stewards kept a night's vigil at the Founders' Garden and left the Ninth Guest unnamed: not in this age.",
        extraFx: { questEffects: [{ action: "complete", questId: Q, beatId: "", state: "completed", text: "The count is ninety-nine, the terms are read, the heading is known, and the name is not. Not in this age." }] },
        choices: [ch("Leave them to their watch.", "")] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (b, c, first = false) => { if ((b.choices || []).some(x => x.label === c.label)) return; b.choices = first ? [c, ...(b.choices || [])] : [...(b.choices || []), c]; };
  edit("founders_garden_approach", b => { addChoice(b, ch("Read the sign at the mouth.", "founders_garden_the_sign"), true); }, "the sign");
  edit("founders_garden_wonder", b => { addChoice(b, ch("The hand half-raised.", "founders_garden_the_hand"), true); }, "the hand");
  edit("founders_garden_the_count", b => { addChoice(b, ch("The low hill the ranks fold around.", "founders_garden_the_terms")); }, "the terms");
  edit("founders_garden_the_plinth", b => {
    if (b.story?.role === "closer") b.story = { quest: KEY };
    addChoice(b, ch("Stand in the gap at dusk.", "founders_garden_the_gap"), true);
    addChoice(b, ch("The low hill.", "founders_garden_the_terms"));
  }, "closer moves to Not in This Age; the gap; the hill");

  // REVIEW 2026-10-01 (MEDIUM): receipt-exchange / roll-outcome beats carry speakers (or a high priority) and were gated only on the beat
  // before them, so a conversation or the Director could play them without the receipt or the roll. Routing-only now: the choice's own gate
  // mirrored into inject.requires (added, never removed) + dialogueOffer:false. A route never consults inject.requires, so every authored
  // choice still lands. Keep in sync with tools/patch-template-review-fixes-b-2026-10-01.macro.js.
  const routingOnly = (id, conds, what) => edit(id, b => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; if (b.dialogueOffer !== false) b.dialogueOffer = false; }, what);
  routingOnly("ninth_guest_heading", [P4, { beatMark: "founders_garden_the_gap" }, { beatMark: "forest_of_tifaret_session_do_ok" }], "the heading needs the gap + the forest's heading; routing-only");
  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for ninth_guest not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    SCRIPT.steps = [
      { id: "approach", label: "The Founders' Garden", line: "Where the land stops pretending, figures stand facing the sea. Read the sign at the mouth; somebody stood it back up. Then go and stand with them.", beats: ["founders_garden_approach"] },
      { id: "among", label: "Among the Hundred", line: "The postures are a grammar. One hand is half-raised, and everyone who sees it finishes it differently.", beats: ["founders_garden_wonder"], done: { anyOf: ["founders_garden_wonder", "founders_garden_the_count"] } },
      { id: "count", label: "The Count", line: "Count them honestly. It takes a day. Do it three times, with witnesses, in daylight. The garden already knows.", beats: ["founders_garden_the_count"], done: { mark: "founders_garden_the_count" } },
      { id: "plinth", label: "The Empty Plinth", line: "One plinth is bare and worn in the shape of two feet. Look where the footprints go. Do not stand in it yet.", beats: ["founders_garden_the_plinth"], done: { mark: "founders_garden_the_plinth" } },
      { id: "terms", label: "The Terms of the Watch", line: "The ranks fold around a low hill with words cut into the seaward face. Read them. Copy them. One line has been thumbed blank; leave it blank.", beats: ["founders_garden_the_terms"], done: { mark: "founders_garden_the_terms" } },
      { id: "gap", label: "The Gap at Dusk", line: "Stand in it as the sun goes into the sea. The feet fit anyone. For one night the count will come out right, and you will find out what the hundred are holding.", beats: ["founders_garden_the_gap", "ninth_guest_heading"], done: { mark: "founders_garden_the_gap" } },
      { id: "age", label: "Not in This Age", line: "Keep the vigil till dawn. You will know what they hold, on what terms, and which way the one who left was walking. You will not know who. That is allowed.", beats: ["ninth_guest_not_in_this_age"], done: { anyOf: ["ninth_guest_not_in_this_age"] } }
    ];
    SCRIPT.doors = [
      { id: "sign", label: "The Sign at the Mouth", line: "FAMILY PRICING. The screws are new this century. Somebody comes here.", beats: ["founders_garden_the_sign"] },
      { id: "hand", label: "The Hand Half-Raised", line: "Say what the gesture is. There is no right answer and the garden has waited two hundred years for the wrong ones.", beats: ["founders_garden_the_hand"] },
      { id: "room", label: "The Made Room", line: "At the Vacancy, THE ONE WE DON'T ASK ABOUT is made up every night now. Ask Verna why, not for whom.", beats: ["ninth_guest_the_made_room"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "ninth_guest_the_made_room"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script ninth_guest → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +room)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-ninth-guest-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Ninth Guest retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Ninth Guest retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-ninth-guest-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Ninth Guest retrofit APPLIED: ${changes} change(s). Not in this age. F5.`);
})();
