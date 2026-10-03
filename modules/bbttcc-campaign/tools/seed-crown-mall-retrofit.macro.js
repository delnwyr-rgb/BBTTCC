/* seed-crown-mall-retrofit.macro.js — CROWN MALL to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/CROWN_MALL_RETROFIT_2026_09_27.md. Bible: the clip is the turn and the Riders' corroboration; Donny's why-this-mall is
 * RULED (Dave 2026-09-27): Community and Connection are integral to the Great Work; the Tanneritos have them in spades; 190 years looking. Actors for Donny + Miss June; armed secrets (Kickflip, Bev, June, Donny); one Kickflip voice; skate
 * becomes a test; 21 dead ends routed; two new steps (Crown Mall Video → Watching the Clip) with receipt THE CAMCORDER CLIP and
 * hidden hand-off choices (rental slip / pipeline / caravan route); Bev's echo gated; route-board ad as its own beat.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "crown_mall", Q_MAIN = "quest_7V8Shz2S0EtDaHSS", Q_CH = "quest_forgotten_yesterdays";
  const MARKER = "[CROWN-MALL-RETROFIT-2026-09-27]";
  const E = (s) => `enc_forgotten_yesterdays_${s}`;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. personas ────────────────────────────────────────────────────────────
  const SECRETS = {
    "Kickflip Lazarus": [
      "Weather (Disputed) :: oppRollMinus2 :: a Steward asks for the lights that MOVE against the ones that WAIT :: Years of testimony filed under 'weather (disputed)'; he has cross-indexed them personally. The ones that move have a bearing, and the bearing is coastward, sideways, the way a ship lands when it means to.",
      "Cannot Whisper :: rollPlus2 :: a Steward asks who was holding the camera :: Him. He genuinely cannot whisper. On the tape, he is whispering. It is the only time."
    ],
    "Laser Bev": [
      "What Wobbles :: stirThePot :: a Steward asks what she HEARS, not what she runs :: Weird little systems wobbling before they fall — leaks, feuds, tape disputes, cursed Orange Juliuses. The mall has been wobbling since that one night, from the roof, where the camcorder points.",
      "The Orderly Place :: rollPlus2 :: a Steward has finished what they started for the mall, or admits their own structure failed them :: She made a place orderly once, and it could not survive grief. Irony was the excuse. Never again does irony get to be the reason for not loving people on purpose."
    ]
  };
  const KICKFLIP_VOICE = `${MARKER} ONE VOICE — Kickflip Lazarus is the archivist who skates. He files the way he lands: commitment leaves a groove, and a groove is an index. He narrates the shelf like a halfpipe run and cannot whisper, except once, on the tape. The skate-ghost lines (cherry soda, wheels off the ground, "you ate shit interestingly") and the archivist lines ("access is a hospitality question") are the same man on the same afternoon. THE CLIP: he filmed the lights over the coast on that one night from the mall lot, on a camcorder, because there isn't a blank tape left in the world and the Tanneritos tape over everything; under the lights, four seconds of Halloween 2077 bleed through — Crown Mall Video's own counter, kids in costume, a woman in a projectionist costume renting cartoons and waving at the camera. He knows whose tape is out and how long. He will do the late fee out loud, to the cent, plus tax, which the mall no longer believes in.`;
  const NEW_PERSONAS = [
    { name: "Miss June", topics: "the Endcap, the exchange, tapes, sleeves, context, closure, rumor-VHS, the Tanneritos, VHS ghosts, circulation, favors, stories, sincerity, Amanda, equivalents, rare inventory",
      notes: `${MARKER} PRIVATE TRUTH — Miss June of the Endcap, translucent, in a three-hundred-year-old store vest, sells context: action, romance, apology, weather, unsent arguments, SUMMER THAT BIT YOU A LITTLE, and for premium members, closure. VOICE: soft, exact, retail-warm, a little sad in the register of a store that outlived its customers; pays in favors, stories and sincerity; "do not remove any memories from their original sleeves unless you are prepared to own the fingerprints." She knows every sleeve that ever left the Endcap and which are still out; one has been out since Halloween 2077 and she has not re-shelved the slot because a slot is a promise. ECHO (earned): "Then one day the world ran out of equivalents." Funny first: the shelf categories; "Directors' Cut: Somebody Else's Bad Decision."`,
      secrets: ["The Sleeve :: stirThePot :: a Steward shows her any tape sleeve from outside the mall :: She knows every sleeve that ever left the Endcap and which are still out. One has been out since Halloween 2077; she knows the title, the renter's costume, and the due date. \"Then one day the world ran out of equivalents.\""] },
    { name: "Donny", topics: "vibes, the wall, the frontage, the Tanneritos, the mall, smoke rings, mall cops, being people first, the egg of the cosmos, that one night",
      notes: `${MARKER} PRIVATE TRUTH — Donny, the silver dragon on the frontage of Crown Mall, lounging like the apocalypse forgot to tell him to stop having a good afternoon. He keeps out bad VIBES, not people. VOICE: surfer-sage, "little my dudes", smoke rings, disappointed rather than angry, "try being people first"; pop-quizzes visitors on whether they mean to use, save, or take over the mall; blesses with "may a shard of the light of the egg of the cosmos get stuck in yer craw." He is kinder and much more dangerous than a wall. Softens toward anyone who doesn't make him feel stupid (he takes that in a very draconic register). WHY THIS MALL (ruled): Community and Connection are integral to the Great Work, and the Tanneritos have them in spades. Donny spent a hundred and ninety years looking for the right tribe to hang with; he found them here. He will say so only to someone who has stopped trying to use the mall; to everyone else he answers with a smoke ring and a compliment about your hat.`,
      secrets: ["Bad Vibes Only :: rollPlus2 :: a Steward asks what he actually keeps OUT :: Vibes, not people. The last vibe he kept out was the night itself — that one night — and he is still a little tired from it. Why THIS mall: he spent a hundred and ninety years looking for the right tribe to hang with — Community and Connection are the Great Work, little my dude, and these kids have them in spades. Then a smoke ring."] }
  ];
  const actorIds = {};
  for (const [name, lines] of Object.entries(SECRETS)) {
    const actor = (game.actors?.contents || []).find(a => a.name === name);
    if (!actor) { say(`✗ actor "${name}" not found — secrets skipped`); continue; }
    actorIds[name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || "");
    const fresh = lines.filter(l => !raw.includes(l.split("::")[0].trim()));
    const next = { ...cur }; let touched = false;
    if (fresh.length) { next.secretsRaw = [raw.trim(), ...fresh].filter(Boolean).join("\n"); touched = true; }
    if (name === "Kickflip Lazarus" && !String(cur.notes || "").includes(MARKER)) { next.notes = [String(cur.notes || "").trim(), KICKFLIP_VOICE].filter(Boolean).join("\n\n"); touched = true; }
    if (!touched) { say(`· ok persona ${name}`); continue; }
    changes++; say(`✚ persona ${name} +${fresh.length} secret(s)${name === "Kickflip Lazarus" ? " + one voice" : ""}`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", next);
  }
  for (const p of NEW_PERSONAS) {
    let actor = (game.actors?.contents || []).find(a => a.name === p.name);
    if (!actor) { say(`✚ CREATE actor "${p.name}"`); changes++; if (!DRY_RUN) actor = await Actor.create({ name: p.name, type: "npc" }); }
    if (!actor) continue;
    actorIds[p.name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${p.name}`); continue; }
    changes++; say(`✚ persona ${p.name} +${p.secrets.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...p.secrets].filter(Boolean).join("\n") });
  }
  const sp = (n) => actorIds[n] || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of [E("approach"), E("tanneritos"), E("skate"), "map_crown_mall_intro", "map_crown_mall_corroboration", "map_crown_mall_partial", E("laser_bev_echo")]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Mall was never seeded here.`);
  const sceneOf = (...ids) => { for (const id of ids) { const s = byId.get(id)?.sceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { endcap: sceneOf(E("miss_june_intro")), foodcourt2: sceneOf("map_crown_mall_intro", "map_crown_mall_corroboration"), foodcourt1: sceneOf(E("tanneritos")) };

  const TAGS = "crown_mall story";
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, scene = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_MAIN, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const P3 = { flag: "storyPhase", gte: 3 };
  const ARCHIVE = [P3, { beatMark: "map_crown_mall_intro" }];

  const NEW = [
    beat("mall_video_store", "Crown Mall — Crown Mall Video",
      "The tapes are stacked the way nobody stacks tapes unless they learned it somewhere: leaning towers, spines every direction, sorted by the night they left the store and not by anything a customer could use. Kickflip narrates the shelf like a halfpipe run. \"Weather, weather, breakup, weather, that one's a romance that thinks it's weather.\" One slot, chest height, is empty, and has a cleaner rectangle of dust around it than anything else in the mall. \"That one's out,\" he says. \"Since Halloween. Not last Halloween.\"",
      { speaker: sp("Kickflip Lazarus"), scene: SC.endcap, requires: ARCHIVE, choices: [
        ch("Ask what's on the shelves.", "", { checkStat: "mind", checkDC: 12, failNext: "mall_video_store_fail", description: "Sorted by the night they left. The empty slot is the last night of the world." }),
        ch("Ask for the footage.", "mall_watch_clip", { description: "\"You asked. That's the whole test.\" Hospitality, not security." }),
        ch("Produce the rental slip.", "mall_watch_clip", { requires: { beatMark: "chuckle_rental_slip" }, description: "He reads it twice and does the late fee out loud like a sports score, to the cent, plus tax, which the mall no longer believes in. Then he pulls the OTHER copy from behind the counter and puts it in the slot. The archive is open. It was always going to be." }),
        ch("\"We came for the footage.\"", "mall_watch_clip", { requires: { beatMark: "ag_pipeline_backward" }, description: "\"Word travels. Somebody told you we filmed it.\" He does not ask who." })
      ] }),
    beat("mall_video_store_fail", "Crown Mall — Re-shelved",
      "He re-shelves you. Gently, by vibe, somewhere between weather and apology. \"You're browsing,\" he says. \"That's allowed. Browsing is most of what a mall is for.\" The empty slot stays empty and the dust around it stays clean.",
      { type: "narration", speaker: sp("Kickflip Lazarus"), scene: SC.endcap, requires: ARCHIVE, choices: [ch("Browse.", "mall_video_store")] }),
    beat("mall_watch_clip", "Crown Mall — Watching the Clip",
      "A camcorder, an actual camcorder, patched into a food-court TV with a cable that has been repaired eleven times. The lot at night. Then the coast, and over the coast, lights moving wrong: not falling, not flying, moving the way a ship moves when it is landing sideways on purpose. Kickflip's voice on the tape, whispering, which he cannot do. Then the lights stop, and the tape does not, and for four seconds something bleeds through from underneath: a store. This store. Fluorescent light, Halloween night, kids in costume at the counter, a woman dressed as a projectionist renting a stack of cartoons and waving at the camera. Then static. \"We taped over it,\" Kickflip says. \"We always tape over it. There isn't a blank tape left in the world.\"",
      { speaker: sp("Kickflip Lazarus"), scene: SC.foodcourt2, priority: "high", timePoints: 1, requires: ARCHIVE,
        receipts: [{ label: "The Camcorder Clip", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Kickflip's archive, Crown Mall" },
          truth: "Lights moving wrong over the coast on That One Night, filmed from the Crown Mall lot; under them, four seconds of Halloween 2077 bleeding through — the video store's own counter, and a woman in a projectionist costume renting cartoons (Marnie Vell of Chuckle Creek, ruled 2026-10-02; the players learn the name only if they have met her). Produce it to the Circuit Riders as corroboration. Lay the caravan route over it and it is a heading." }],
        memoryText: "The Stewards watched the camcorder clip at Crown Mall: the lights over the coast, and under them, four seconds of Halloween 2077.",
        choices: [
          ch("Freeze on the lights.", "", { checkStat: "mind", checkDC: 12, failNext: "mall_watch_clip_fail", description: "A bearing. Coastward, sideways. The way a ship lands when it means to." }),
          ch("Watch it to the end.", "", { description: "The four seconds again. She waves again. Nobody in the food court says anything." }),
          ch("Ask who was holding the camera.", "", { description: "\"Me.\" He is whispering now, too." }),
          ch("\"That's Marnie.\"", "", { requires: { anyOf: [{ beatMark: "chuckle_showrunner" }, { beatMark: "chuckle_projector" }, { beatMark: "chuckle_credits" }] }, description: "Marnie Vell, before the booth, before the microphone, before the window went white: a projectionist costume she made herself, renting the cartoons Chuckle Creek would watch that night. She is waving at a camera in a mall. Nobody who loved her ever saw this tape. Kickflip stops the deck and does not tape over it." }),
          ch("Lay the caravan route over it.", "mall_heading_matched", { requires: { beatMark: "ag_caravan_route" }, description: "The two lines agree. It is not a light in the sky any more. It is a heading." }),
          ch("Take it to the food court. Make it official.", "map_crown_mall_corroboration")
        ] }),
    beat("mall_watch_clip_fail", "Crown Mall — The Tape Jams",
      "The tape jams on the lights. Kickflip hits the deck with the flat of his hand, once, in a place that has clearly been hit before, and the picture comes back a frame later than it left. The bearing is gone. The four seconds are still there.",
      { type: "narration", speaker: sp("Kickflip Lazarus"), scene: SC.foodcourt2, requires: ARCHIVE, choices: [ch("Rewind.", "mall_watch_clip")] }),
    beat("mall_heading_matched", "Crown Mall — A Heading",
      "Two days coastward by wagon from the Long Market, and the bearing off a camcorder in a mall lot, drawn on the same food-court napkin, agree to within the width of the pen. Kickflip files the napkin. \"Weather,\" he says. \"Confirmed.\"",
      { type: "narration", speaker: sp("Kickflip Lazarus"), scene: SC.foodcourt2, priority: "high", requires: ARCHIVE,
        memoryText: "The caravan route and the camcorder clip agree: the Stewards have a heading.",
        choices: [ch("Make it official.", "map_crown_mall_corroboration")] }),
    beat("mall_route_board", "Crown Mall — The Route Board",
      "A dead ad, still doing its little loop on a screen nobody has turned off in two hundred years: VISIT THE FOUNDERS' GARDEN. ONE HUNDRED FIGURES IN LIVING STONE. FAMILY PRICING. Under it, a route board with the roads that used to go there, and a YOU ARE HERE that is, remarkably, still correct. Nobody at the mall knows if the exit still exists. Kickflip files it under weather.",
      { type: "narration", speaker: sp("Kickflip Lazarus"), scene: SC.foodcourt2, requires: [P3, { beatMark: "map_crown_mall_corroboration" }], choices: [ch("Write down the roads.", "", { description: "One of them goes to the coast. You already knew that one." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);
  // the archive door routes THROUGH the video store now (the cop route still goes to partial)
  edit("map_crown_mall_intro", b => { for (const c of b.choices || []) if (c.next === "map_crown_mall_corroboration") c.next = "mall_video_store"; }, "respectful / trading → Crown Mall Video");
  addChoice("map_crown_mall_corroboration", ch("Read the route board ad.", "mall_route_board"), "the route board");
  // skate becomes a test
  edit(E("skate"), b => { for (const c of b.choices || []) { if (/nail/i.test(c.label) && !c.checkStat) { c.checkStat = "body"; c.checkDC = 12; c.failNext = E("skate_mixed"); } if (/pavement/i.test(c.label) && !c.checkStat) { c.checkStat = "presence"; c.checkDC = 10; c.failNext = E("skate_failure"); } } }, "checks (body / presence)");
  // dead ends → routes
  const routeTo = (id, label, next, desc = "") => addChoice(id, ch(label, next, { description: desc }), `→ ${next}`);
  routeTo(E("donny_good"), "Go in.", E("tanneritos"), "The dragon tips a smoke ring at you. You are, apparently, people.");
  routeTo(E("donny_mixed"), "Go in. Provisionally.", E("tanneritos"), "Eye contact energy, maintained.");
  routeTo(E("donny_pushy"), "Try being people first.", E("donny_parley"));
  routeTo(E("donny_observe"), "Call out.", E("donny_approach"));
  routeTo(E("donny_withdraw"), "Come back less weird about power.", E("donny_parley"));
  for (const s of ["skate_mixed", "skate_failure", "tanneritos_friendly", "tanneritos_intrigue", "tanneritos_hostile"]) routeTo(E(s), "Back to the food court.", E("tanneritos"));
  for (const s of ["vhs_lean_in", "vhs_fail", "vhs_mock", "escalator_success", "escalator_mixed", "escalator_fail", "elefem_success", "elefem_mixed", "elefem_fail"]) routeTo(E(s), "The mall keeps happening.", E("hub"));
  // Bev's echo is earned
  edit(E("laser_bev_echo"), b => { b.inject = b.inject || {}; const req = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []); if (!req.some(r => r && r.anyOf)) b.inject.requires = [...req, { anyOf: [{ beatMark: E("skate_success") }, { beatMark: E("resolution_good") }] }]; }, "gated: earned");
  // speakers
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice(["kickflip_lazarus_intro", "kickflip_lazarus_1", "kickflip_lazarus_2", "kickflip_lazarus_3", "kickflip_lazarus_4", "kickflip_lazarus_5", "kickflip_lazarus_runback", "kickflip_lazarus_runback_success", "kickflip_lazarus_runback_fail", "kickflip_lazarus_echo"].map(E), "Kickflip Lazarus");
  voice(["miss_june_intro", "miss_june_1", "miss_june_2", "miss_june_3", "miss_june_4", "miss_june_5", "miss_june_inventory", "miss_june_echo"].map(E), "Miss June");
  voice(["donny_approach", "donny_observe", "donny_parley", "donny_respect", "donny_weird", "donny_pushy", "donny_mixed", "donny_good", "donny_bad_vibes", "donny_withdraw"].map(E), "Donny");
  voice(["laser_bev_1", "laser_bev_2", "laser_bev_3", "laser_bev_4", "laser_bev_5", "laser_bev_terms", "laser_bev_echo"].map(E), "Laser Bev");

  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for crown_mall not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const old = Object.fromEntries(SCRIPT.steps.map(s => [s.id, s])); const CHP = "the_mall_of_forgotten_yesterdays";
    SCRIPT.steps = [
      { ...old.donny, line: "There's a dragon on the wall. He's not keeping you out. Answer him honestly and do not say the word \"asset\"." },
      { id: "tanneritos", label: "That 90s Coalition", chapter: CHP, line: "The Tanneritos woke up here and never really left. Radical chill radiates off them like a territorial warning. Say hi.", beats: [E("tanneritos")], done: { mark: E("tanneritos") } },
      { id: "skate", label: "Skate or Be Square", chapter: CHP, line: "The Tanneritos judge by skating the way other towns judge by duels. Land it, or eat pavement with style. Never be a mall cop about it.", beats: [E("skate")], done: { anyOf: [E("skate_success"), E("skate_mixed"), E("skate_failure")] } },
      { ...old.archive, line: "Kickflip has the archive. Access is a hospitality question, not a security one. Ask like a guest.", done: { mark: "map_crown_mall_intro" } },
      { id: "video", label: "Crown Mall Video", line: "The tapes are stacked weird, by the night they left, not by title. One slot has been empty since 2077. Late fees are still accruing.", beats: ["mall_video_store"] },
      { id: "clip", label: "Watching the Clip", line: "Kickflip filmed the lights. Watch it to the end. There is something under the lights.", beats: ["mall_watch_clip"], done: { mark: "mall_watch_clip" } },
      { id: "corroborate", label: "The Food Court of Corroboration", line: "Route boards, kiosk invoices, and a clip that convicts a government. Take it to the food court and make it official.", beats: ["map_crown_mall_corroboration", "map_crown_mall_partial"], done: { anyOf: ["map_crown_mall_corroboration", "map_crown_mall_partial"] } },
      { ...old.mall }
    ].filter(Boolean);
    const doors = SCRIPT.doors || [];
    if (!doors.some(d => d.id === "video")) doors.push({ id: "video", label: "Crown Mall Video", line: "Late fees are still accruing. Bring the slip.", beats: ["mall_video_store"] });
    if (!doors.some(d => d.id === "routeboard")) doors.push({ id: "routeboard", label: "The Route Board", line: "Visit the Founders' Garden. One hundred figures in living stone. The exit may not exist.", beats: ["mall_route_board"] });
    SCRIPT.doors = doors;
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script crown_mall → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-crown-mall-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Crown Mall retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Crown Mall retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-crown-mall-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Crown Mall retrofit APPLIED: ${changes} change(s). There isn't a blank tape left in the world. F5.`);
})();
