/* patch-wick-cover-2026-10-04.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * PILGRIM WICK'S COVER + FATHER TAMSIN'S ANSWER (Dave, 2026-10-04). Wick (not his real name) is a Valhaulan courier dressed as a
 * devotee of a fire faith that keeps "the eternal flame of civilization": St Gilliam's has many fires, so he trims its candles (the
 * third candle is the drop); he "builds shrines to the flame in the mountains" (they are the drop network up the switchbacks); he
 * rents at the Vacancy to keep his things and sleeps on the road. The seam: a flame-keeper would bless any fire, but he only trims
 * WAX, his own ("my order won't feed the flame on fat"), in a tallow town. His real faith is the schedule: he has never been late.
 * Father Tamsin (the Confessor's Debt) repeats the cover almost word for word — a rehearsed sentence and one terrible metaphor — until
 * he is caught; after the catch his answer changes with the verdict.
 *   Tamsin: NEW ag_tamsin_on_wick (cover; Act 1 welcome + Act 2 conversation) · _redeemed (redeemed / counterfeit) · _pike · _exposed
 *   Wick:   NEW ag_wick_the_flame · ag_wick_the_shrines → ag_wick_shrine (the drop on the switchback) · ag_wick_the_bed
 *   The Vacancy upstairs: NEW ag_wick_room (the trunk) — played by the walk-in door on the Vacancy battlemap's stairs (towns.json
 *   `agvacancy`, run the hub runner after this patch).
 *   Personas: Wick + Tamsin get a voice note (Mal plays the cover the same way the beats do).
 * Idempotent; one backup. In run-golden-13 before the hubs.
 * HOW TO RUN: 1) hard-reload; 2) run (DRY_RUN = true) → console (F12); 3) DRY_RUN = false, run again; 4) setup-town-hub agvacancy; 5) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m); const actorEdits = [];
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id} (already)`); };
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const has = (b, re) => (b.choices || []).some(c => re.test(String(c.label || "")));

  const TAMSIN = "I0Gieq4FAol5mklQ", WICK = "Vv8mDrdsPJnCBLeA";
  const P1 = { flag: "storyPhase", gte: 1 }, P2 = { flag: "storyPhase", gte: 2 }, ACT1 = { flag: "storyPhase", lte: 1 };
  const UNCAUGHT = { beatMark: "ag_confessor_relief", not: true };
  const REDEEMED = { anyOf: [{ beatMark: "ag_confessor_redeemed" }, { beatMark: "ag_confessor_counterfeit" }] };
  const PIKE = { beatMark: "ag_confessor_pike" }, EXPOSED = { beatMark: "ag_confessor_exposed" };
  const BACK_TAMSIN = [ch("Back to the bread.", "allesh_gilliam_tamsin_welcome", { requires: ACT1 }), ch("Ask something else.", "allesh_gilliam_father_tamsin_conversation", { requires: P2 })];
  const BACK_WICK = [ch("Ask something else.", "ag_vacancy_pilgrim_wick"), ch("Leave him to his vigil.", "allesh_gilliam_vacancy_intro")];

  const tplOf = (id) => byId.get(id);
  const mk = (tplId, id, label, description, { type = "dialog", speaker = null, requires = [], choices = [], repeatable = true, memoryText = null } = {}) => {
    const t = tplOf(tplId); if (!t) return null;
    const b = foundry.utils.deepClone(t);
    Object.assign(b, { id, label, description, type, speakerActorId: speaker, choices, worldEffects: {}, tags: `${t.tags || ""},wick-cover`.replace(/^,/, ""), hexName: null, targetHexUuid: null });
    b.inject = { ...(t.inject || {}), repeatable, oncePerHex: false, requires };
    delete b.story; delete b.questStep; if (memoryText) b.memoryText = memoryText; else delete b.memoryText;
    if (b.cinematic) b.cinematic = { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null };
    return b;
  };

  const NEW = [
    // ── Father Tamsin ──
    mk("allesh_gilliam_tamsin_welcome", "ag_tamsin_on_wick", "Allesh-Gilliam — Father Tamsin on the Pilgrim",
      "\"Pilgrim Wick.\" He says it the way you read a name off a list. \"Devout man. Very devout. He keeps the flame. The eternal one, of civilization, they say. The one that has to be kept or it goes out.\" He pours, though nobody's cup is empty. \"St Gilliam's has a great many fires, so he comes at dusk and trims the candles. It's a devotion. He's building shrines up in the mountains. To the flame. He rents at the Vacancy to keep his things, and he sleeps on the road, mostly.\" A pause, while he looks for the right words and does not find them. \"He's like a… a very devout thing. Sorry. I'm bad at those.\"",
      { speaker: TAMSIN, requires: [P1, UNCAUGHT], choices: [
        ch("\"Why only the wax candles?\"", "", { description: "\"His order won't feed the flame on fat. It has to burn clean.\" He says it exactly the way you imagine the pilgrim would. It is a sentence somebody taught him." }),
        ch("\"You know a lot about him.\"", "", { description: "\"He talks while he trims. I listen. That's most of the job.\" He sets the kettle down a little harder than he means to." }),
        ch("\"That's what Wick said. Word for word.\"", "", { requires: { beatMark: "ag_wick_the_flame" }, description: "Tamsin looks at the kettle for a long moment. \"He says it well,\" he says. \"It's easy to remember.\" It is the first thing he has said that sounds rehearsed and true at the same time." }),
        ...BACK_TAMSIN.map(c => foundry.utils.deepClone(c))
      ] }),
    mk("allesh_gilliam_father_tamsin_conversation", "ag_tamsin_on_wick_redeemed", "Allesh-Gilliam — Father Tamsin on the Courier",
      "\"He's a courier,\" Tamsin says, and it costs him nothing to say it now, which is the point. \"The flame is a costume. A good one. I wore one too. He takes what the candle holds up the mountain, and he has never once been late, and I don't think anyone has ever asked him whether he wanted to be.\" He sets the kettle down gently this time.",
      { speaker: TAMSIN, requires: [P2, REDEEMED], choices: [
        ch("\"Is any of it real?\"", "", { description: "\"He trims well. I've watched him a hundred times. A person can be careful with a thing he doesn't believe in.\" A small, tired smile. \"I would know.\"" }),
        foundry.utils.deepClone(BACK_TAMSIN[1])
      ] }),
    mk("allesh_gilliam_father_tamsin_conversation", "ag_tamsin_on_wick_pike", "Allesh-Gilliam — Father Tamsin, Carefully",
      "Tamsin glances at the door before he answers, which he never used to do. \"The Marshal has his name. The Marshal has all the names now. Wick comes at dusk; I write it down; someone collects what I write down.\" He stops at the edge of the thought, the way a man who answers to a ledger learns to.",
      { speaker: TAMSIN, requires: [P2, PIKE], choices: [
        ch("\"Does Wick know?\"", "", { description: "\"He knows the candle moved on time. That's all he has ever needed to know.\"" }),
        foundry.utils.deepClone(BACK_TAMSIN[1])
      ] }),
    mk("allesh_gilliam_father_tamsin_conversation", "ag_tamsin_on_wick_exposed", "Allesh-Gilliam — Father Tamsin, Measured",
      "The candles at St Gilliam's are out. Tamsin answers from the chair where nobody used to be measured, and is measured now, by everyone. \"Gone up the road,\" he says. \"He'll be on time for whatever's next. He always is.\"",
      { speaker: TAMSIN, requires: [P2, EXPOSED], choices: [foundry.utils.deepClone(BACK_TAMSIN[1])] }),
    // ── Pilgrim Wick ──
    mk("ag_vacancy_pilgrim_wick_routes", "ag_wick_the_flame", "Allesh-Gilliam — The Flame",
      "\"The flame,\" he says, as if you'd asked the time. \"Civilization is a fire somebody has to keep. Most people think it keeps itself. It doesn't. St Gilliam's has many fires and few keepers, so I trim. A long wick smokes. A short one drowns.\" He turns a hand over: wax under the nails, none of it tallow. \"My order won't feed the flame on fat. It has to burn clean.\"",
      { speaker: WICK, requires: [P1], choices: [
        ch("\"Where is your order from?\"", "", { description: "\"The old routes,\" which is not a place. \"We go where the flame is thin.\"" }),
        ch("\"Can I watch you trim?\"", "", { description: "\"At dusk. The third candle from the door is the stubborn one.\" He says it lightly. It is a strange thing to tell a stranger, and he tells it anyway." }),
        ...BACK_WICK.map(c => foundry.utils.deepClone(c))
      ], memoryText: "Pilgrim Wick keeps 'the eternal flame of civilization' and trims only wax candles: 'my order won't feed the flame on fat.'" }),
    mk("ag_vacancy_pilgrim_wick_routes", "ag_wick_the_shrines", "Allesh-Gilliam — The High Shrines",
      "\"Up the switchbacks,\" he says. \"A shrine every hour of the climb, where the road bends and the wind can't reach. A stone, a niche, a candle. Somebody walking in the dark finds a flame and knows the road was kept.\" He seems to genuinely like the picture. \"You may visit them. Pilgrims do. Leave them as you find them.\"",
      { speaker: WICK, requires: [P1], choices: [
        ch("Climb to the first one.", "ag_wick_shrine"),
        ...BACK_WICK.map(c => foundry.utils.deepClone(c))
      ] }),
    mk("ag_vacancy_pilgrim_wick_routes", "ag_wick_shrine", "Khezek Switchbacks — The First Shrine",
      "An hour above the last farm the road bends hard, and there it is: a niche cut into the rock, a flat stone, a wax candle burned to a careful stub with the wick trimmed exactly. Under it sits a drip tray, the same make as the ones at St Gilliam's. The tray is empty. The wax in it has been scraped, recently, by something flat, the way you'd lift a folded thing out without tearing it. Further up, where the road bends again, you can see the next one. Somebody is keeping a road, all right. It isn't the flame's.",
      { type: "exploration", speaker: null, requires: [P1], repeatable: false, choices: [
        ch("Look closer at the drip tray.", "", { description: "Same make as St Gilliam's. Same scrape. Whatever was folded here was folded small." }),
        ch("Climb to the next one.", "", { description: "Another stub, another tray, another scrape. The road goes all the way up to Khezek Tor, and so do the shrines." }),
        ch("Go back down.", "")
      ], memoryText: "A wax shrine on the Khezek switchbacks has a drip tray like St Gilliam's, scraped clean. The shrines run all the way up to Khezek Tor." }),
    mk("ag_vacancy_pilgrim_wick_routes", "ag_wick_the_bed", "Allesh-Gilliam — The Bed He Doesn't Use",
      "\"The bed is for my things,\" he says, without embarrassment. \"Wax, wick, a change of clothes, a slate. A pilgrim who carries everything carries it badly. I sleep on the road, mostly. The road is honest about where it goes.\" From the desk, without looking up, Verna says: \"Pays exact.\"",
      { speaker: WICK, requires: [P1], choices: [
        ch("\"What's on the slate?\"", "", { description: "\"Times,\" he says. \"I like to know when things are.\"" }),
        ch("Ask Verna which room is his.", "ag_wick_room", { description: "\"Second door up. It isn't locked.\" She doesn't look up. \"Nothing up there is.\"" }),
        ...BACK_WICK.map(c => foundry.utils.deepClone(c))
      ] }),
    mk("ag_vacancy_pilgrim_wick_routes", "ag_wick_room", "The Vacancy — Upstairs, the Pilgrim's Room",
      "Up the stairs, the second door: the one with the star beside it in Verna's ledger. The bed has never been slept in, and the corners are still Verna's corners. Everything else is in a cedar trunk at the foot of it, unlocked, because a pilgrim has nothing to hide. Forty-one candles, beeswax, all the same make, more than a man could trim in a season. A roll of waxed fibre cut to drip-tray size. A change of clothes, folded military-square. And a slate, wiped clean, except for a column of times chalked on the frame where the wiping doesn't reach: dusk to dusk, and not one of them crossed out late.",
      { type: "exploration", speaker: null, requires: [P1], repeatable: false, choices: [
        ch("Count the candles again.", "", { description: "Forty-one. Nobody's devotion needs forty-one. A schedule might." }),
        ch("Hold the fibre up to the light.", "", { description: "Cut to fit a drip tray, waxed on one side so a fold arrives dry. Someone sends small things this way and wants them to arrive in one piece." }),
        ch("Read the times.", "", { description: "St Gilliam's at dusk. The first switchback by midnight. Then hours you'd have to climb all night to keep. He keeps them." }),
        ch("Put everything back square.", "", { description: "Military-square, the way he left it. He would notice anything else." })
      ], memoryText: "Wick's room at the Vacancy: forty-one identical beeswax candles, waxed fibre cut to drip-tray size, clothes folded military-square, a slate of times never late." })
  ].filter(Boolean);
  for (const nb of NEW) if (nb.id === "ag_tamsin_on_wick") nb.inject.evergreen = true;   // asked in Act 1 (the welcome) and Act 2+ (the conversation) — the act seal must not shut it
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  // ── hooks into the existing conversations ──
  edit("allesh_gilliam_tamsin_welcome", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (!has(b, /pilgrim who trims/i)) b.choices.splice(Math.max(0, b.choices.length - 1), 0, ch("Ask about the pilgrim who trims your candles.", "ag_tamsin_on_wick", { requires: UNCAUGHT }));
  }, "Act 1: ask Tamsin about the pilgrim (the cover, rehearsed)");
  edit("allesh_gilliam_father_tamsin_conversation", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (!has(b, /^Ask about Pilgrim Wick/)) {
      const add = [
        ch("Ask about Pilgrim Wick.", "ag_tamsin_on_wick", { requires: UNCAUGHT }),
        ch("Ask about Pilgrim Wick.", "ag_tamsin_on_wick_redeemed", { requires: REDEEMED }),
        ch("Ask about Pilgrim Wick.", "ag_tamsin_on_wick_pike", { requires: PIKE }),
        ch("Ask about Pilgrim Wick.", "ag_tamsin_on_wick_exposed", { requires: EXPOSED })
      ];
      const i = b.choices.findIndex(c => /^Leave/.test(String(c.label || "")));
      b.choices.splice(i >= 0 ? i : b.choices.length, 0, ...add);
    }
  }, "Act 2+: ask about Pilgrim Wick (one answer per verdict: cover · courier · carefully · measured)");
  edit("ag_vacancy_pilgrim_wick", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    const add = [];
    if (!has(b, /about the candles/)) add.push(ch("Ask about the candles.", "ag_wick_the_flame"));
    if (!has(b, /about the shrines/)) add.push(ch("Ask about the shrines.", "ag_wick_the_shrines"));
    if (!has(b, /never sleeps in the bed/)) add.push(ch("Ask why he never sleeps in the bed.", "ag_wick_the_bed"));
    if (add.length) { const i = b.choices.findIndex(c => /^Leave/.test(String(c.label || ""))); b.choices.splice(i >= 0 ? i : b.choices.length, 0, ...add); }
  }, "the candles · the shrines · the bed");

  // ── personas ──
  const NOTE_WICK = "THE COVER (owner ruling 2026-10-04): 'Pilgrim Wick' is not his real name. He plays a devotee of a fire faith that keeps the eternal flame of civilization: he trims St Gilliam's candles at dusk as a devotion, is 'building shrines to the flame' up the Khezek switchbacks (they are the drop network), rents at the Vacancy only to keep his things and sleeps on the road. He trims only wax, his own: 'my order won't feed the flame on fat; it has to burn clean.' He never claims a name for the faith. Underneath: he does not believe in the flame. He believes in the schedule. He has never once been late.";
  const NOTE_TAMSIN = "ON WICK (owner ruling 2026-10-04): before he is caught, Tamsin repeats Wick's cover almost word for word (devout, the eternal flame of civilization, trims the candles, shrines in the mountains, rents for his things, sleeps on the road) and reaches for a metaphor he cannot land. After the catch he answers with the verdict: plainly ('he's a courier; the flame is a costume'), carefully under Pike, or not at all once exposed.";
  for (const [id, note] of [[WICK, NOTE_WICK], [TAMSIN, NOTE_TAMSIN]]) {
    const A = game.actors?.get(id); if (!A) { say(`✗ MISSING actor ${id}`); continue; }
    const per = foundry.utils.deepClone(A.getFlag(MAL, "persona") || {});
    if (String(per.notes || "").includes("owner ruling 2026-10-04")) { say(`· ok persona ${A.name} (already)`); continue; }
    per.notes = [String(per.notes || "").trim(), note].filter(Boolean).join("\n\n");
    changes++; say(`✎ persona ${A.name}: the cover`); actorEdits.push(() => A.setFlag(MAL, "persona", per));
  }

  console.group(`[patch-wick-cover-2026-10-04] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s)`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Wick's cover DRY RUN: ${changes} change(s) — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Wick's cover: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-wick-cover-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  for (const fn of actorEdits) await fn();
  ui.notifications.info(`Wick's cover applied: ${changes} change(s). Now run setup-town-hub for agvacancy. F5.`);
})();
