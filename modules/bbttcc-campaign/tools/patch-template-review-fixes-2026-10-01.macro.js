/* patch-template-review-fixes-2026-10-01.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * Repairs the ALREADY-SEEDED live campaign for the HIGH findings in GAME_REVIEW_2026_09_30 against the quest-template seeders — the
 * same edits the five seeders now make on a fresh world (their headers carry "REVIEW FIXES 2026-10-01"). One run, one backup.
 *
 *  AG (seed-allesh-gilliam-retrofit)
 *   • ag_market_caravan_fail / ag_tamsin_pactkeeper / ag_pipeline_route_only: gated (PIPE_ACTIVE / GATE_PACT / GATE_ROUTE_ONLY) + dialogueOffer:false
 *   • ag_confessor_dead_drop + ag_pipeline_backward: inject.evergreen (the chapters outlive Pike's closure)
 *   • campaign.story.scripts.allesh_gilliam: the eight Debt/Pipeline rows leave `steps` (a step beat is spine; Pike's closure sealed the
 *     whole spy arc) and become the two chapter-scoped DOORS `debt` / `pipeline` (no `line`; beats listed; the LIVE rows kept verbatim
 *     under `rungs`, so any wordsmithing survives)
 *  KT (seed-khezek-tor-retrofit)
 *   • campaign.story.scripts.khezek_tor: the Official Word climax step `oword` (the live script lacks it — its old id `word` clashed with
 *     "Word from the Mountain") inserted before `squares`; a step that already plays kt_official_word under a clashing id is renamed
 *   • kt_official_word_given / _thin gated (GATE_GIVEN / GATE_THIN); the two endings + four fail landings dialogueOffer:false (NO_OFFER)
 *  WIDENING TRAIL (seed-widening-trail-retrofit)
 *   • every voiced Trail ending (chapel ×3, Anchor Reach ×3, Port Kudzu testimony/partial, the cult camp, Legansus verified/flagged) gated on
 *     its route + chapter bucket not completed, dialogueOffer:false (ROUTE_ONLY)
 *   • map_port_kudzu_intro's start gate also opens on map_anchor_reach_marked; map_legansus_waystation_intro's on wt_cult_camp
 *  CADENCE (seed-cadence-retrofit) • cadence_parade gated on the viewing mound + the parade permit; dialogueOffer:false
 *  FINALE (seed-finale-retrofit)   • crates / arithmetic / turn / unmoved gated on the beats that route to them; turn + unmoved dialogueOffer:false
 *
 * Every gate constant below is copied VERBATIM from its seeder — change one, change both. Gates are ADDITIVE (missing conditions /
 * anyOf alternatives are appended; nothing is removed). A route never consults inject.requires, so every authored choice still lands; the
 * gates only stop the Director and the conversation surface from playing these cold. Scripts are edited IN PLACE on the live data (never
 * rebuilt from code), so `after` lists, door lines and every other live edit are kept. Idempotent: a second APPLY reports 0 changes.
 *
 * HOW TO RUN: 1) hard-reload; 2) run as-is (DRY_RUN = true) → read the console (F12) report; 3) set DRY_RUN = false, run again
 *   (a backup-campaigns-before-review-fixes-<ts>.json downloads first); 4) F5.
 * THEN: • re-run modules/bbttcc-travel/tools/town-hubs/setup-town-hub.macro.js for CROWN MALL (towns.json crownmall now has
 *         `evergreen: true`; the runner SYNCs inject.evergreen onto the frontage / food-court door cinematics so the Act 4 seal stops
 *         shutting them) — dry run first, as always;
 *       • export a fresh save/bundle and run `bin/ft-replay-story <export>` (and `bin/ft-lint-campaign <bundle>`) on it.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));

  // ── helpers (same as the seeders) ─────────────────────────────────────────
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  const ensureAlt = (b, among, add) => { const rs = Array.isArray(b.inject?.requires) ? b.inject.requires : []; const grp = rs.find(x => Array.isArray(x?.anyOf) && x.anyOf.some(y => among.includes(y?.beatMark))); if (!grp) return false; for (const m of add) if (!grp.anyOf.some(y => y?.beatMark === m)) grp.anyOf.push({ beatMark: m }); return true; };
  const noOffer = (b) => { if (b.dialogueOffer !== false) b.dialogueOffer = false; };
  const routeOnly = (id, gate, what) => edit(id, b => { ensureReq(b, gate); noOffer(b); }, what);

  // ── gate constants — VERBATIM from the seeders ───────────────────────────
  const P2 = { flag: "storyPhase", gte: 2 }, P3 = { flag: "storyPhase", gte: 3 }, P5 = { flag: "storyPhase", gte: 5 };
  // AG (seed-allesh-gilliam-retrofit)
  const Q_PIPE = "quest_ag_pipeline";
  const PIPE_ACTIVE = [P2, { questBucket: Q_PIPE, is: "active" }];
  const GATE_PACT = [...PIPE_ACTIVE, { beatMark: "ag_caravan_route" }, { anyOf: [{ beatMark: "ag_confessor_redeemed" }, { beatMark: "ag_confessor_pike" }] }];
  const GATE_ROUTE_ONLY = [...PIPE_ACTIVE, { beatMark: "ag_caravan_route" }, { beatMark: "ag_confessor_counterfeit" }];
  // KT (seed-khezek-tor-retrofit)
  const Q_WORD = "quest_kt_official_word";
  const ACTIVE = [P2, { questBucket: Q_WORD, is: "active" }];
  const GATE_THIN = [...ACTIVE, { beatMark: "kt_official_word" }];
  const GATE_GIVEN = [...GATE_THIN, { beatMark: "kt_dropped_manifest" }, { beatMark: "kt_back_room_roster" }];
  const NO_OFFER = ["kt_official_word_open_fail", "kt_brennig_desk_fail", "kt_cage_shaft_fail", "kt_good_room_fail", "kt_official_word_given", "kt_official_word_thin"];
  // WIDENING TRAIL (seed-widening-trail-retrofit)
  const Q_CHAPEL = "quest_pI4LaZTvh9QmuRaE", Q_REACH = "quest_OpvVkGwzBTM2Px13", Q_KUDZU = "quest_J4NXb6xZ9M15EesB", Q_LEG = "quest_xBw8cGSC88wX2UeT";
  const NOT_DONE = (q) => ({ questBucket: q, isNot: "completed" });
  const GATE_CHAPEL_END = [P3, { beatMark: "map_rotating_chapel_approach" }, NOT_DONE(Q_CHAPEL)];
  const GATE_REACH_END = [P3, { beatMark: "map_anchor_reach_intro" }, NOT_DONE(Q_REACH)];
  const GATE_KUDZU_TESTIMONY = [P3, { beatMark: "map_port_kudzu_intro" }, NOT_DONE(Q_KUDZU)];
  const GATE_KUDZU_PARTIAL = [P3, { anyOf: [{ beatMark: "map_port_kudzu_intro" }, { beatMark: "wt_kudzu_rebuff" }] }, NOT_DONE(Q_KUDZU)];
  const GATE_CAMP = [P3, { anyOf: [{ beatMark: "wt_caravan_ride" }, { beatMark: "ag_caravan_route" }] }, NOT_DONE(Q_KUDZU)];
  const GATE_LEG_VERIFIED = [P3, { anyOf: [{ beatMark: "map_legansus_waystation_intro" }, { beatMark: "wt_legansus_sequence" }] }, NOT_DONE(Q_LEG)];
  const GATE_LEG_FLAGGED = [P3, { beatMark: "map_legansus_waystation_intro" }, NOT_DONE(Q_LEG)];
  const ROUTE_ONLY = {
    map_rotating_chapel_map: GATE_CHAPEL_END, map_rotating_chapel_force: GATE_CHAPEL_END, map_rotating_chapel_harmonize: GATE_CHAPEL_END,
    map_anchor_reach_stabilize: GATE_REACH_END, map_anchor_reach_break: GATE_REACH_END, map_anchor_reach_marked: GATE_REACH_END,
    map_port_kudzu_testimony: GATE_KUDZU_TESTIMONY, map_port_kudzu_partial: GATE_KUDZU_PARTIAL, wt_cult_camp: GATE_CAMP,
    map_legansus_waystation_verified: GATE_LEG_VERIFIED, map_legansus_waystation_flagged: GATE_LEG_FLAGGED
  };
  const NEXT_START_ALTS = [
    { id: "map_port_kudzu_intro", among: ["map_anchor_reach_stabilize", "map_anchor_reach_break"], add: ["map_anchor_reach_marked"] },
    { id: "map_legansus_waystation_intro", among: ["map_port_kudzu_testimony", "map_port_kudzu_partial"], add: ["wt_cult_camp"] }
  ];
  // CADENCE (seed-cadence-retrofit)
  const GATE_PARADE = [P2, { beatMark: "cadence_viewing_mound" }, { beatMark: "stillwater_parade_permit" }];
  // FINALE (seed-finale-retrofit)
  const GATE_CRATES = [P5, { anyOf: ["raid_thatwards_infiltration_success", "raid_thatwards_courtly_honest", "raid_thatwards_courtly_playful", "raid_thatwards_assault_success", "raid_thatwards_siege_success", "finale_leygate_arrival"].map(beatMark => ({ beatMark })) }];
  const GATE_ARITH = [P5, { anyOf: ["finale_the_crates", "raid_thatwards_courtly_honest", "raid_thatwards_courtly_playful"].map(beatMark => ({ beatMark })) }];
  const GATE_TURN = [P5, { beatMark: "finale_sklars_arithmetic" }];
  const FINALE_GATES = { finale_the_crates: GATE_CRATES, finale_sklars_arithmetic: GATE_ARITH, finale_sklar_turns: GATE_TURN, finale_sklar_unmoved: GATE_TURN };
  const FINALE_NO_OFFER = ["finale_sklar_turns", "finale_sklar_unmoved"];

  // ── 1. beats ──────────────────────────────────────────────────────────────
  say("— Allesh-Gilliam —");
  routeOnly("ag_market_caravan_fail", PIPE_ACTIVE, "gated on the chapter; routing-only");
  routeOnly("ag_tamsin_pactkeeper", GATE_PACT, "gated on the caravan route + mercy/Pike; routing-only");
  routeOnly("ag_pipeline_route_only", GATE_ROUTE_ONLY, "gated on the caravan route + the counterfeit; routing-only");
  for (const id of ["ag_confessor_dead_drop", "ag_pipeline_backward"]) edit(id, b => { b.inject = b.inject || {}; if (b.inject.evergreen !== true) b.inject.evergreen = true; }, "chapter start outlives Pike's closure (inject.evergreen)");
  say("— Khezek-Tor —");
  edit("kt_official_word_given", b => ensureReq(b, GATE_GIVEN), "gated on the cookline scene + both receipts");
  edit("kt_official_word_thin", b => ensureReq(b, GATE_THIN), "gated on the cookline scene");
  for (const id of NO_OFFER) edit(id, noOffer, "dialogueOffer:false (routing-only)");
  say("— the Widening Trail —");
  for (const [id, gate] of Object.entries(ROUTE_ONLY)) routeOnly(id, gate, "routing-only ending: gated on its route + chapter open; dialogueOffer:false");
  for (const a of NEXT_START_ALTS) edit(a.id, b => { if (!ensureAlt(b, a.among, a.add)) say(`✗ ${a.id}: no anyOf over ${a.among.join("/")} — gate NOT widened (check by hand)`); }, `start gate also opens on ${a.add.join(", ")}`);
  say("— the Cadence —");
  routeOnly("cadence_parade", GATE_PARADE, "gated on the mound + the permit; routing-only");
  say("— the Finale —");
  for (const [id, gate] of Object.entries(FINALE_GATES)) edit(id, b => { ensureReq(b, gate); if (FINALE_NO_OFFER.includes(id)) noOffer(b); }, `gated on the beats that route here${FINALE_NO_OFFER.includes(id) ? "; routing-only" : ""}`);

  // ── 2. story scripts (campaign.story, edited in place) ────────────────────
  camp.story = camp.story && typeof camp.story === "object" ? camp.story : { quests: {}, scripts: {} };
  camp.story.scripts = camp.story.scripts || {};
  const scriptKeysChanged = [];
  const editScript = (key, fn, what) => {
    const sc = camp.story.scripts[key];
    if (!sc || !Array.isArray(sc.steps)) return say(`✗ campaign.story.scripts.${key} missing — its seeder never wrote the story data here; re-run that seeder instead`);
    const before = JSON.stringify(sc); const afterBefore = JSON.stringify(sc.after || []);
    fn(sc);
    if (JSON.stringify(sc.after || []) !== afterBefore) { say(`✗ ${key}: \`after\` changed unexpectedly — NOT writing this script`); camp.story.scripts[key] = JSON.parse(before); return; }
    if (JSON.stringify(sc) !== before) { changes++; scriptKeysChanged.push(key); say(`✦ story script ${key}: ${what}`); } else say(`· ok story script ${key}`);
  };

  // AG: the Debt + Pipeline rows → chapter-scoped doors (exactly the shape seed-allesh-gilliam-retrofit now builds)
  const DEBT = "the_confessor_s_debt", PIPE_CH = "the_pipeline";
  const AUTHORED_RUNGS = [   // fallback only (verbatim from the seeder) — the LIVE rows are preferred so wordsmithing survives
    { id: "candle", label: "The Third Candle", group: "debt", chapter: DEBT, line: "The third candle from the door has moved a finger-width. Check the drip tray. Try not to enjoy this.", beats: ["ag_confessor_dead_drop"] },
    { id: "drop", label: "The Drip Tray", group: "debt", chapter: DEBT, line: "Unfold it. It's a maintenance schedule and one metaphor that doesn't work. Somebody in this town is bad at this.", beats: ["ag_confessor_drip_tray"] },
    { id: "pilgrim", label: "The Guest Who Pays Exact", group: "debt", chapter: DEBT, line: "Verna's ledger has a guest who pays exact and never sleeps in the bed. Ask her what the little star means.", beats: ["ag_confessor_pilgrim"] },
    { id: "tea", label: "The Tea Is Already Poured", group: "debt", chapter: DEBT, line: "The tea is already poured. That's how you know. Sit.", beats: ["ag_tamsin_confrontation"] },
    { id: "relief", label: "\"I Am Relieved\"", group: "debt", chapter: DEBT, line: "He is bad at metaphor and worse at spying and he has never been so relieved in his life. Decide what justice looks like.", beats: ["ag_confessor_relief"], done: { anyOf: ["ag_confessor_redeemed", "ag_confessor_exposed", "ag_confessor_pike", "ag_confessor_counterfeit"] } },
    { id: "backward", label: "Run the Channel Backward", group: "pipeline", chapter: PIPE_CH, line: "Run the channel backward. Three headings come down the mountain: a caravan, a camcorder, a sequence.", beats: ["ag_pipeline_backward"] },
    { id: "market", label: "Etta Sells You Preserves First", group: "pipeline", chapter: PIPE_CH, line: "Etta already knows which stall stocks a camp that isn't on any map. She will sell you preserves first.", beats: ["ag_market_caravan_route"], done: { mark: "ag_caravan_route" } },
    { id: "pactkeeper", label: "The Man Who Reads the Terms", group: "pipeline", chapter: PIPE_CH, line: "Tamsin wants to read the terms. Show him what you've found. Then let him sit down.", beats: ["ag_tamsin_pactkeeper", "ag_pipeline_route_only"], done: { anyOf: ["ag_tamsin_pactkeeper", "ag_pipeline_route_only"] } }
  ];
  const RUNG_IDS = new Set(AUTHORED_RUNGS.map(r => r.id));
  editScript("allesh_gilliam", sc => {
    const isRung = (st) => RUNG_IDS.has(st.id) && (st.chapter === DEBT || st.chapter === PIPE_CH);
    const live = sc.steps.filter(isRung).map(st => JSON.parse(JSON.stringify(st)));
    sc.steps = sc.steps.filter(st => !isRung(st));
    const rungsFor = (ch) => { const l = live.filter(r => r.chapter === ch); return l.length ? l : AUTHORED_RUNGS.filter(r => r.chapter === ch); };
    const CHAPTER_DOORS = [
      { id: "debt", label: "The Confessor's Debt", chapter: DEBT, beats: ["ag_confessor_dead_drop", "ag_confessor_drip_tray", "ag_confessor_pilgrim", "ag_tamsin_confrontation", "ag_confessor_relief"], rungs: rungsFor(DEBT) },
      { id: "pipeline", label: "The Pipeline", chapter: PIPE_CH, beats: ["ag_pipeline_backward", "ag_market_caravan_route", "ag_tamsin_pactkeeper", "ag_pipeline_route_only"], rungs: rungsFor(PIPE_CH) }
    ];
    for (const d of CHAPTER_DOORS) if (!(sc.doors || []).some(x => x.id === d.id)) sc.doors = [...(sc.doors || []), d];
  }, "Debt + Pipeline rows out of `steps` → chapter doors `debt` / `pipeline` (rows kept under `rungs`)");

  // KT: the Official Word climax step, as `oword`, before `squares`
  const OWORD = { id: "oword", label: "The Official Word", group: "word", chapter: "the_official_word", line: "Say it out loud at the cookline, with the receipts in your hands. The mountain gets to hear it too.", beats: ["kt_official_word"], done: { anyOf: ["kt_official_word_given", "kt_official_word_thin"] } };
  editScript("khezek_tor", sc => {
    const holder = sc.steps.find(s => (s.beats || []).includes("kt_official_word"));
    if (holder) { if (holder.id !== "oword" && sc.steps.some(s => s !== holder && s.id === holder.id)) holder.id = "oword"; return; }
    const at = sc.steps.findIndex(s => s.id === "squares");
    if (at >= 0) sc.steps.splice(at, 0, JSON.parse(JSON.stringify(OWORD))); else sc.steps.push(JSON.parse(JSON.stringify(OWORD)));
  }, "the Official Word climax step `oword` (inserted before `squares`, or a clashing id renamed)");

  // ── 3. report / write ─────────────────────────────────────────────────────
  console.log(`[patch-template-review-fixes-2026-10-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Review fixes DRY RUN: ${changes} change(s) — see console (F12). Set DRY_RUN = false to apply.`);
  if (!changes) return ui.notifications.info("Review fixes: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-review-fixes-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  // re-save each changed script through the story API so the engine re-applies campaign.story now (and storyUpdated fires)
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  for (const key of scriptKeysChanged) { try { if (storyApi?.saveQuest) await storyApi.saveQuest(campaignId, key, { script: camp.story.scripts[key] }); } catch (e) { console.warn(`[patch-template-review-fixes] saveQuest ${key} failed (data is written; F5 applies it)`, e); } }
  ui.notifications.info(`Review fixes APPLIED: ${changes} change(s). F5 — then re-run setup-town-hub for Crown Mall, and ft-replay-story on a fresh export.`);
})();
