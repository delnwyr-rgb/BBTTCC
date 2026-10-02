/* patch-template-review-fixes-b-2026-10-01.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * Repairs the ALREADY-SEEDED live campaign for the MEDIUM + LOW findings in GAME_REVIEW_2026_09_30 against the quest-template seeders —
 * the same edits the seeders now make on a fresh world (their "REVIEW 2026-10-01" comments). Run it AFTER
 * patch-template-review-fixes-2026-10-01 (the HIGH repair); either order works, they touch different fields. One run, one backup.
 *
 *  BEATS (gates are ADDITIVE — missing conditions appended, nothing removed; a route never consults inject.requires, so every authored
 *  choice still lands — the gates only stop the Director and the conversation surface from playing these cold)
 *   • KT: kt_good_room / _fail / kt_back_room_roster → where: "Allesh-Gilliam" (Doc Greeley's Waiting Room; NOW + the location guard)
 *   • Forgotten Cause: Restore / Redirect / Break routing-only (gated on the table + chapter open, dialogueOffer:false); Break closes the
 *     quest by declaration (story.alsoEnds) — the questEffects row is ignored for a declared beat
 *   • Hidden Vault: Gilbert's resolution / parley-fail / fight routing-only; the Service Manifest gated on the theater; council outcomes →
 *     the replicator; replicator outcomes → the Last Stub
 *   • Circuit Riders: every filing SINGLE-USE (its own outcome beat carries the +1 crVerify; the shared Filed landing is retired)
 *   • Maneuver Vault: kt_pulled_files_filed fires once (repeatable:false)
 *   • Finale: outcomes + rewards gated on the beats that route to them; the siege route to rewards_standard (dropped by a label clash) added
 *   • receipt / roll outcomes routing-only: statues_tally_given, statues_seventh_point, hod_route_posted, tifaret_heading_confirmed,
 *     ninth_guest_heading, bandit_books_audit(+_fail), siege_culvert_sit(+_fail), cadence_tempo_applause / _hm
 *   • Lyrenn: "Plant the seeds" on the Label hides once planted ("Keep the label." takes over) — it re-ran the planting beat
 *   • Fixit: the six retrofit beats once-only (Load the Crate re-granted THE CERTIFICATION); the back stairs' plain "Go up" hides after the Vault
 *  PERSONAS
 *   • Sklar Bjrornholt + Purser Ingrid Halvarsen: their finale secrets → persona.secretsRaw (the seeder wrote an unread `secrets` array;
 *     the turn "Not Enough For An Island" never armed). Additive: lines already present by label are skipped; `secrets` is left as it was.
 *  STORY SCRIPTS (campaign.story, edited IN PLACE — never rebuilt from code; `after` lists, door lines and wordsmithed step lines are kept)
 *   • forgotten_cause: seated / night count as done once the table is decided · hidden_vault: `office` names the theater, done by the
 *     receipt / the failed door / the council · maneuver_vault: `records` done by moving on · finale: count / crates / arithmetic / turn done
 *     by every later branch beat; the merged "Count It" step split back into outcome + rewards (any-order group `spoils`)
 *   • bandit_accord `books` + cadence `courier`: only the entry beat (NOW no longer pre-picks a roll's outcome)
 *
 * Every constant below is copied VERBATIM from its seeder — change one, change both. Idempotent: a second APPLY reports 0 changes.
 *
 * HOW TO RUN: 1) hard-reload; 2) run as-is (DRY_RUN = true) → read the console (F12) report; 3) set DRY_RUN = false, run again
 *   (a backup-campaigns-before-review-fixes-b-<ts>.json downloads first); 4) F5.
 * THEN: re-run modules/bbttcc-travel/tools/town-hubs/setup-town-hub.macro.js (dry first, as always) for
 *   • crownmall    — the interior gates accept donny_mixed too (the runner relinks the Regions)
 *   • softlanding, stillwater, chuckle — door rectangles were top-left boxes read as centres; towns.json now holds centres and the runner
 *     moves the live Drawings
 *   then export a fresh save/bundle and run `bin/ft-lint-campaign <bundle>` and `bin/ft-replay-story <export> --act=6`.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
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
  const reqsOf = (x) => Array.isArray(x) ? x : (x && typeof x === "object" ? [x] : []);
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = reqsOf(b.inject.requires).slice(); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  const noOffer = (b) => { if (b.dialogueOffer !== false) b.dialogueOffer = false; };
  const routingOnly = (id, gate, what) => edit(id, b => { ensureReq(b, gate); noOffer(b); }, what);
  const once = (id, what) => edit(id, b => { b.inject = b.inject || {}; if (b.inject.repeatable !== false) b.inject.repeatable = false; }, what || "once-only (repeatable:false)");
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  // ── constants — VERBATIM from the seeders ────────────────────────────────
  const P2 = { flag: "storyPhase", gte: 2 }, P3 = { flag: "storyPhase", gte: 3 }, P4 = { flag: "storyPhase", gte: 4 }, P5 = { flag: "storyPhase", gte: 5 };
  // KT (seed-khezek-tor-retrofit)
  const AG_HEX = "Allesh-Gilliam", KT_GOOD_ROOM = ["kt_good_room", "kt_good_room_fail", "kt_back_room_roster"];
  // FORGOTTEN CAUSE (seed-forgotten-cause-retrofit)
  const FC_KEY = "forgotten_cause", Q_TABLE = "fc_long_table";
  const GATE_TABLE_END = [P2, { beatMark: "wendigo_confluence_the_long_table" }, { questBucket: Q_TABLE, isNot: "completed" }];
  const FC_DECIDED = ["wendigo_confluence_repair", "wendigo_confluence_redirect", "wendigo_confluence_break"];
  const FC_SEATED_DONE = ["fc_seated", "wendigo_confluence_name_cards", ...FC_DECIDED], FC_NIGHT_DONE = ["fc_night_one", ...FC_DECIDED];
  // HIDDEN VAULT (seed-hidden-vault-retrofit)
  const E = (s) => `enc_hidden_vault_${s}`, Q_HV = "quest_hidden_vault";
  const HV_GATES = {
    gilbert_theater_resolution: [P3, { anyOf: [{ beatMark: "gilbert_theater_parley" }, { beatMark: "gilbert_theater_fight" }] }, { questBucket: Q_HV, isNot: "completed" }],
    gilbert_theater_parley_fail: [P3, { beatMark: "gilbert_theater_parley" }],
    gilbert_theater_fight: [P3, { anyOf: [{ beatMark: E("gilbert") }, { beatMark: "gilbert_theater_intro" }, { beatMark: "gilbert_theater_parley" }] }]
  };
  // MANEUVER VAULT (seed-maneuver-vault-retrofit)
  const M = (s) => `maneuver_vault_${s}`;
  const MV_RECORDS_DONE = [M("pulled_files"), M("slippage_chamber"), M("the_containment_loop")];
  // FINALE (seed-finale-retrofit)
  const RT = (s) => `raid_thatwards_${s}`;
  const OUTCOME_GATES = {
    [RT("outcome_friends")]: [P5, { beatMark: "finale_sklar_turns" }],
    [RT("outcome_neutral_spark")]: [P5, { anyOf: [RT("infiltration_success"), "finale_the_crates", "finale_sklars_arithmetic", "finale_sklar_unmoved"].map(beatMark => ({ beatMark })) }],
    [RT("outcome_neutral_fail")]: [P5, { anyOf: [RT("courtly_fail"), RT("siege_fail"), "finale_sklar_unmoved"].map(beatMark => ({ beatMark })) }],
    [RT("outcome_hostile_fail")]: [P5, { beatMark: RT("assault_fail") }],
    [RT("rewards_major")]: [P5, { beatMark: RT("outcome_friends") }],
    [RT("rewards_standard")]: [P5, { beatMark: RT("outcome_neutral_spark") }, { anyOf: [{ beatMark: RT("assault_success") }, { beatMark: RT("siege_success") }] }],
    [RT("rewards_intel_only")]: [P5, { beatMark: RT("outcome_neutral_spark") }]
  };
  const OUTCOMES = [RT("outcome_friends"), RT("outcome_neutral_spark"), RT("outcome_neutral_fail"), RT("outcome_hostile_fail")];
  const REWARDS = [RT("rewards_major"), RT("rewards_standard"), RT("rewards_intel_only")];
  const FAILS = [RT("assault_fail"), RT("courtly_fail"), RT("siege_fail")];
  // (the two CLOSER outcomes are left out of the done-lists: every path to them passes a fail branch or Sklar unmoved first, and listing a
  //  closer in a middle step reads to lint SC06 as completing the quest mid-script)
  const AFTER_TURN = [...FAILS, RT("outcome_friends"), RT("outcome_neutral_spark")], AFTER_ARITH = ["finale_sklar_turns", "finale_sklar_unmoved", ...AFTER_TURN], AFTER_CRATES = ["finale_sklars_arithmetic", ...AFTER_ARITH];
  const SIEGE_PLUNDER = ch("Count the plunder too — respect leaves wreckage.", RT("rewards_standard"), { requires: { beatMark: RT("siege_success") }, description: "Respect leaves useful wreckage." });
  const MERGED_OUTCOME_LINE = "Whatever you got, you got. Count it. Sklar's people give gifts they shouldn't; take them.";
  const FINALE_PERSONAS = {
    "Sklar Bjrornholt": [
      "The Heading :: oppRollMinus2 :: a Steward shows her the Sideways Manifest, the Caravan Route or the verified Legansus heading :: She confirms it flatly — coastward, to their own Leygate, switched on on turn 2 — and adds that the client's paper never once mentioned an island. \"I was told it was a debt. Debts have headings. Islands don't.\"",
      "Not Enough For An Island :: favorShift :: a Steward shows her the Paymaster's Numbers (or the Service Manifest, or the Pulled Files) :: THE TURN. She reads the figure, does the arithmetic out loud in front of people she was paid to fight, and says the line: \"I am not being paid enough for an island.\" Then she breaks with the paymaster, in that order. She still does not say the name; she says she is not being paid to."
    ],
    "Purser Ingrid Halvarsen": [
      "Signed By Nobody, Twice :: rollPlus2 :: a Steward asks her what the fuel costs :: She doesn't know who pays. The chits come signed by nobody, initialled twice, and the one she burned had a figure on it she has not stopped thinking about. \"Crate nine. Under the good rope. Don't tell her I told you; tell her I counted.\""
    ]
  };
  // the routing-only receipt / roll outcomes (seed-lost-statues / -flooded-towns / -tifaret / -ninth-guest / -bandit-accord / -fifteen-year-siege / -cadence)
  const ROUTING_ONLY = [
    ["statues_tally_given", [P3, { beatMark: "statues_sexton" }, { anyOf: [{ beatMark: "spark_geburah_northreach_b_worthy" }, { beatMark: "spark_geburah_northreach_b_force" }] }]],
    ["statues_seventh_point", [P3, { beatMark: "statues_sable_bleeding" }, { beatMark: "lyrenn_vault_label" }]],
    ["hod_route_posted", [P3, { beatMark: "hod_dispatcher_booth" }, { beatMark: "ag_pipeline_backward" }]],
    ["tifaret_heading_confirmed", [P2, { beatMark: "tifaret_the_ring" }, { beatMark: "lyrenn_vault_label" }]],
    ["ninth_guest_heading", [P4, { beatMark: "founders_garden_the_gap" }, { beatMark: "forest_of_tifaret_session_do_ok" }]],
    ["bandit_books_audit", [P2, { beatMark: "bandit_books" }]], ["bandit_books_audit_fail", [P2, { beatMark: "bandit_books" }]],
    ["siege_culvert_sit", [P3, { beatMark: "siege_culvert_gate" }]], ["siege_culvert_fail", [P3, { beatMark: "siege_culvert_gate" }]],
    ["cadence_tempo_applause", [P2, { beatMark: "cadence_tempo_at_the_gate" }]], ["cadence_tempo_hm", [P2, { beatMark: "cadence_tempo_at_the_gate" }]]
  ];
  // LYRENN (seed-lyrenn-retrofit)
  const PLANTED = { beatMark: "lyrenn_red_thread_planting" };
  // FIXIT (seed-fixit-retrofit)
  const Q_VAULT = "quest_NwiADv8ZDoklqwEJ";
  const FIXIT_NEW = ["fixit_mystery_bin", "fixit_mystery_bin_fail", "fixit_route_board", "fixit_route_board_fail", "fixit_route_board_after", "fixit_load_the_crate"];

  // ── 1. beats ──────────────────────────────────────────────────────────────
  say("— Khezek-Tor —");
  for (const id of KT_GOOD_ROOM) edit(id, b => { if (!b.where) b.where = AG_HEX; }, `where: ${AG_HEX}`);
  say("— the Forgotten Cause —");
  for (const id of FC_DECIDED) routingOnly(id, GATE_TABLE_END, "routing-only ending: gated on the table + chapter open; dialogueOffer:false");
  edit("wendigo_confluence_break", b => { b.story = b.story && typeof b.story === "object" ? b.story : { quest: FC_KEY, chapter: "the_long_table", role: "ending", ending: "break" }; const ae = Array.isArray(b.story.alsoEnds) ? b.story.alsoEnds : []; if (!ae.some(x => x && x.quest === FC_KEY && !x.chapter)) b.story.alsoEnds = [...ae, { quest: FC_KEY, ending: "break" }]; }, "BREAK closes the Forgotten Cause (story.alsoEnds)");
  say("— the Hidden Vault —");
  for (const [id, gate] of Object.entries(HV_GATES)) routingOnly(id, gate, "routing-only outcome: gated on its route; dialogueOffer:false");
  edit("hv_service_manifest", b => ensureReq(b, [P3, { beatMark: E("inside") }]), "gated on the theater (the office is behind the concession stand)");
  for (const s of ["council_friendly", "council_neutral", "council_hostile"]) edit(E(s), b => { if (!(b.choices || []).some(x => x.label === "Follow the hum to the machine.")) b.choices = [...(b.choices || []), ch("Follow the hum to the machine.", E("replicator"), { description: "Something in the back is printing, and complaining about it." })]; }, "→ the replicator");
  for (const s of ["replicator_friendly", "replicator_neutral", "replicator_hostile"]) edit(E(s), b => { if (!(b.choices || []).some(c => c.next === "hv_last_stub")) b.choices = [...(b.choices || []), ch("Back to the lobby.", "hv_last_stub")]; }, "→ the last stub");
  say("— the Circuit Riders —");
  // VERBATIM the helper in seed-circuit-riders-retrofit (and -flooded-towns, -balcones)
  const singleUseFilings = () => {
    const TPL = "enc_circuit_riders_filed", tpl = byId.get(TPL), fi = byId.get("enc_circuit_riders_file_it"); if (!tpl || !fi) return say(`✗ MISSING ${TPL} / enc_circuit_riders_file_it (the Riders retrofit never ran here?)`);
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
    if (JSON.stringify(tpl) !== before) { changes++; say(`✎ ${TPL}: retired (no meter, routing-only)`); } else say(`· ok ${TPL}`);
  };
  singleUseFilings();
  say("— the Maneuver Vault —");
  once("kt_pulled_files_filed", "the KT epilogue fires once (repeatable:false)");
  say("— the Finale —");
  for (const [id, gate] of Object.entries(OUTCOME_GATES)) edit(id, b => ensureReq(b, gate), "outcome/reward gated on the beats that route here");
  edit(RT("outcome_neutral_spark"), b => { if (!(b.choices || []).some(c => c.next === RT("rewards_standard") && reqsOf(c.requires).some(r => r && r.beatMark === RT("siege_success")))) { const i = (b.choices || []).findIndex(c => c.next === RT("rewards_intel_only")); b.choices = [...(b.choices || [])]; b.choices.splice(i >= 0 ? i : b.choices.length, 0, JSON.parse(JSON.stringify(SIEGE_PLUNDER))); } }, "the siege route to rewards_standard (its label clashed and was dropped)");
  say("— receipt / roll outcomes —");
  for (const [id, gate] of ROUTING_ONLY) routingOnly(id, gate, "routing-only: the choice's gate mirrored; dialogueOffer:false");
  say("— Lyrenn —");
  edit("lyrenn_vault_label", b => {
    const plant = (b.choices || []).find(c => c.next === "lyrenn_red_thread_planting");
    if (plant && !reqsOf(plant.requires).some(r => r && r.beatMark === PLANTED.beatMark)) plant.requires = [...reqsOf(plant.requires), { ...PLANTED, not: true }];
    const leave = (b.choices || []).find(c => c.label === "Keep the label. Leave the seeds."); if (leave && !leave.requires) leave.requires = [{ ...PLANTED, not: true }];
    if (!(b.choices || []).some(c => c.label === "Keep the label.")) { const i = (b.choices || []).indexOf(plant); b.choices = [...(b.choices || [])]; b.choices.splice(i >= 0 ? i + 1 : b.choices.length, 0, ch("Keep the label.", "", { requires: [PLANTED] })); }
  }, "Plant the seeds only while unplanted; \"Keep the label.\" once planted");
  say("— Fixit —");
  for (const id of FIXIT_NEW) once(id);
  edit("fixit_backstairs_exterior", b => { const up = (b.choices || []).find(c => c.label === "Go up" && c.next === "fixit_route_board"); if (!up) return; const r = reqsOf(up.requires); if (!r.some(x => x && x.questBucket === Q_VAULT)) up.requires = [...r, { questBucket: Q_VAULT, isNot: "completed" }]; }, "\"Go up\" hides after the Vault");
  const beatChanges = changes;

  // ── 2. personas (actors, not the campaigns setting) ───────────────────────
  say("— finale personas —");
  const personaWrites = [];
  for (const [name, lines] of Object.entries(FINALE_PERSONAS)) {
    const a = (game.actors?.contents || []).find(x => x.name === name); if (!a) { say(`✗ actor "${name}" not found — run seed-finale-retrofit first`); continue; }
    const cur = a.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || "");
    const fresh = lines.filter(l => !raw.includes(l.split("::")[0].trim()));
    if (!fresh.length) { say(`· ok persona ${name}`); continue; }
    changes++; say(`✚ persona ${name}: ${fresh.length} secret(s) → secretsRaw`);
    personaWrites.push(() => a.setFlag(MAL, "persona", { ...cur, secretsRaw: [raw.trim(), ...fresh].filter(Boolean).join("\n") }));
  }

  // ── 3. story scripts (campaign.story, edited in place) ────────────────────
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
  const step = (sc, key, id) => { const st = sc.steps.find(s => s.id === id); if (!st) say(`✗ ${key}: no step '${id}' (renamed by hand?) — left alone`); return st; };
  // widen a step's done rule to anyOf ∪ add (a missing / default / mark rule becomes anyOf; a chapter/quest/allOf rule is left alone)
  const doneAnyOf = (key, st, add) => {
    if (!st) return; const d = st.done;
    if (!d || typeof d !== "object") { st.done = { anyOf: Array.from(new Set([...(st.beats || []), ...add])) }; return; }
    if (Array.isArray(d.anyOf)) { for (const x of add) if (!d.anyOf.includes(x)) d.anyOf.push(x); return; }
    if (d.mark) { st.done = { anyOf: Array.from(new Set([d.mark, ...add])) }; return; }
    say(`✗ ${key} · step '${st.id}': done rule ${JSON.stringify(d)} is not a list — left alone (check by hand)`);
  };
  editScript("forgotten_cause", sc => { doneAnyOf("forgotten_cause", step(sc, "forgotten_cause", "seated"), FC_SEATED_DONE); doneAnyOf("forgotten_cause", step(sc, "forgotten_cause", "night"), FC_NIGHT_DONE); }, "Seated / the Night count as done once the table is decided");
  editScript("hidden_vault", sc => {
    const st = step(sc, "hidden_vault", "office"); if (!st) return;
    if (JSON.stringify(st.beats || []) === JSON.stringify(["hv_service_manifest"])) st.beats = [E("inside")];
    if (st.done?.mark === "hv_service_manifest" || !st.done) st.done = { anyOf: ["hv_service_manifest", "hv_office_fail", E("council")] }; else doneAnyOf("hidden_vault", st, ["hv_service_manifest", "hv_office_fail", E("council")]);
  }, "`office` names the theater; done by the receipt, the failed door, or the council");
  editScript("maneuver_vault", sc => doneAnyOf("maneuver_vault", step(sc, "maneuver_vault", "records"), MV_RECORDS_DONE), "`records` (the drawer) is skippable");
  editScript("finale", sc => {
    const appr = sc.steps.find(s => s.id === "approach");
    doneAnyOf("finale", step(sc, "finale", "count"), ["finale_count_the_coalition", ...(appr?.beats || []), ...(appr?.done?.anyOf || []), "finale_leygate_arrival", "finale_the_crates", ...AFTER_CRATES]);
    doneAnyOf("finale", step(sc, "finale", "crates"), ["finale_the_crates", ...AFTER_CRATES]);
    doneAnyOf("finale", step(sc, "finale", "arithmetic"), ["finale_sklars_arithmetic", ...AFTER_ARITH]);
    doneAnyOf("finale", step(sc, "finale", "turn"), ["finale_sklar_turns", "finale_sklar_unmoved", ...AFTER_TURN]);
    const out = step(sc, "finale", "outcome"); if (!out) return;
    const rew = (out.beats || []).filter(b => REWARDS.includes(b));
    if (rew.length && !sc.steps.some(s => s.id === "rewards")) {
      out.beats = (out.beats || []).filter(b => !REWARDS.includes(b));
      if (!out.done || out.done.quest === "finale") out.done = { anyOf: OUTCOMES.filter(b => out.beats.includes(b)) };
      if (out.line === MERGED_OUTCOME_LINE) out.line = "Whatever you got, you got. Count it.";
      sc.steps.splice(sc.steps.indexOf(out) + 1, 0, { id: "rewards", label: "Spoils", line: "Sklar's people give gifts they shouldn't. Take them.", beats: rew, done: { quest: "finale" }, group: "spoils" });
    }
    if (out.group !== "spoils") out.group = "spoils";
    const r2 = sc.steps.find(s => s.id === "rewards"); if (r2 && r2.group !== "spoils") r2.group = "spoils";
  }, "count/crates/arithmetic/turn skippable by later branches; outcome + rewards split again (group `spoils`)");
  editScript("bandit_accord", sc => { const st = step(sc, "bandit_accord", "books"); if (st && (st.beats || []).includes("bandit_books")) st.beats = st.beats.filter(b => b !== "bandit_books_audit" && b !== "bandit_books_audit_fail"); }, "`books` lists only the entry beat");
  editScript("cadence", sc => { const st = step(sc, "cadence", "courier"); if (st && (st.beats || []).includes("cadence_tempo_at_the_gate")) st.beats = st.beats.filter(b => b !== "cadence_tempo_applause" && b !== "cadence_tempo_hm"); }, "`courier` lists only the entry beat");

  // ── 4. report / write ─────────────────────────────────────────────────────
  console.log(`[patch-template-review-fixes-b-2026-10-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Review fixes (b) DRY RUN: ${changes} change(s) — see console (F12). Set DRY_RUN = false to apply.`);
  if (!changes) return ui.notifications.info("Review fixes (b): nothing to do.");
  if (beatChanges || scriptKeysChanged.length) {
    try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-review-fixes-b-${Date.now()}.json`); }
    catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  for (const w of personaWrites) await w();
  // re-save each changed script through the story API so the engine re-applies campaign.story now (and storyUpdated fires)
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  for (const key of scriptKeysChanged) { try { if (storyApi?.saveQuest) await storyApi.saveQuest(campaignId, key, { script: camp.story.scripts[key] }); } catch (e) { console.warn(`[patch-template-review-fixes-b] saveQuest ${key} failed (data is written; F5 applies it)`, e); } }
  ui.notifications.info(`Review fixes (b) APPLIED: ${changes} change(s). F5 — then re-run setup-town-hub for crownmall / softlanding / stillwater / chuckle, and ft-replay-story on a fresh export.`);
})();
