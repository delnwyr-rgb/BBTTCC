/* patch-legansus-second-hearing-2026-10-03.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CIRCUIT RIDERS' THROUGH LINE (Dave, 2026-10-03: "build the Legansus second hearing fix!").
 * Before: the camp parley (Act 2) and Legansus Waystation (Act 3) never read each other; two filing desks; a flagged or neutral
 * party could never win the Riders back, so the Finale's count stayed shut; "Pursue alliance" at the camp was not gated at all
 * (a route ignores its target's gate), so the tally did not matter.
 * After — ONE story: the camp is the first hearing, Legansus is the second, the Finale counts whoever the Riders ride for.
 *   1. Legansus remembers the camp. Allied parties are greeted as Riders' friends and fast-tracked (Captain Robot: step two).
 *      Flagged parties can ask for a SECOND HEARING; neutral parties and parties who never found the camp can ask for a hearing.
 *   2. ONE filing desk. Legansus' filing choices now go through the camp's own Filed beats (same crVerify tally, same
 *      once-per-receipt rule); every Filed beat can return to the hearing, or close Legansus as verified.
 *   3. Reclassification. At the hearing, with the tally at 2+, "Request reclassification" → the Riders ally with the coalition
 *      (same relation the camp alliance sets) and mark `legansus_reclassified`.
 *   4. The Finale reads either: the count's Riders answer, the muster beat and "The Riders Answer" open on the camp alliance OR
 *      the reclassification.
 *   5. The camp's "Pursue alliance" is gated on the tally (crVerify ≥ 2), as the retrofit always said ("alliance is earned").
 *   6. The Widening Trail script gains the door THE SECOND HEARING.
 *   7. The desk outlives Act 2: File It Like a Rider + every Filed beat carry inject.evergreen (the act seal would refuse them at
 *      Legansus in Act 3 — lint S01); the desk's "Nothing to file yet" (→ the Act-2 camp conversation) hides at Legansus, where it
 *      offers "Back to the hearing." / "Back to the waystation." instead.
 * Idempotent; one backup; edits live data in place (wordsmithing survives). Golden: in run-golden-13 after the owner patches.
 * HOW TO RUN: 1) hard-reload; 2) run (DRY_RUN = true) → console (F12); 3) DRY_RUN = false, run again; 4) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id} (already)`); };
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const hasChoice = (b, re) => (b.choices || []).some(c => re.test(String(c.label || "")));

  // ── ids + gates ──
  const Q_LEG = "quest_xBw8cGSC88wX2UeT", Q_CR = "quest_circuit_riders_parley", RIDERS = "RgpV6bx2Olk9Z4qW";
  const ROBOT = byId.get("enc_circuit_riders_parley_opening")?.speakerActorId || byId.get("map_legansus_waystation_intro")?.speakerActorId || null;
  const P3 = { flag: "storyPhase", gte: 3 };
  const ALLIED = { beatMark: "enc_circuit_riders_parley_alliance" }, RECLASSED = { beatMark: "legansus_reclassified" };
  const NOT_ALLIED = [{ beatMark: "enc_circuit_riders_parley_alliance", not: true }, { beatMark: "legansus_reclassified", not: true }];
  const FLAGGED = { beatMark: "enc_circuit_riders_parley_flagged" }, NOT_FLAGGED = { beatMark: "enc_circuit_riders_parley_flagged", not: true };
  const RIDERS_WITH_YOU = { anyOf: [ALLIED, RECLASSED] };
  const AT_LEGANSUS = { beatMark: "map_legansus_waystation_intro" };
  const RECEIPTS = ["stillwater_parade_permit", "ag_caravan_route", "kt_dropped_manifest", "kt_official_word_given", "mall_watch_clip", "map_port_kudzu_testimony", "hod_the_vote", "balcones_complaint"];
  const FILED = (m) => `enc_circuit_riders_filed_${m}`;

  // ── new beats ──
  const tpl = byId.get("enc_circuit_riders_not_yet") || byId.get("map_legansus_waystation_intro");
  if (!tpl) return ui.notifications.error("No template beat (the Circuit Riders retrofit never ran here?).");
  const mk = (id, label, description, { type = "dialog", repeatable = false, requires = [], choices = [], worldEffects = {}, memoryText = null } = {}) => {
    const b = foundry.utils.deepClone(tpl);
    Object.assign(b, { id, label, description, type, questId: Q_LEG, hexName: null, sceneId: null, targetHexUuid: null, speakerActorId: ROBOT, choices, worldEffects: { ...worldEffects }, tags: "quest:widening-trail,theme.circuit-riders,legansus-second-hearing", priority: "high", timePoints: 0 });
    b.inject = { ...(tpl.inject || {}), repeatable, oncePerHex: false, requires: [P3, ...requires] };
    delete b.story; if (memoryText) b.memoryText = memoryText; else delete b.memoryText;
    if (b.cinematic) b.cinematic = { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null };
    return b;
  };
  const NEW = [
    mk("legansus_allied_welcome", "Legansus Waystation — Step Two",
      "The relay tower stops thinking about you before you reach the gate. Captain Robot is already standing there, which means somebody at the camp filed ahead. \"VERIFICATION FIRST. FRIENDSHIP SECOND. RESCUE THIRD,\" he says. \"YOU ARE ON STEP TWO.\" He does not wink. Simone checks whether you lag and writes down that you don't. Dennis has made a sign. It says WELCOME BACK, and under it, smaller, PROVISIONALLY.",
      { requires: [RIDERS_WITH_YOU], choices: [
        ch("Show them everything.", "map_legansus_waystation_verified", { description: "\"FRIENDS STILL FILE.\" They read it anyway, faster, and with less suspicion in the corners." }),
        ch("Show them the seven positions.", "wt_legansus_sequence", { requires: { beatMark: "ag_pipeline_backward" } }),
        ch("File something first.", "enc_circuit_riders_file_it")
      ], memoryText: "Legansus greeted the Stewards as the Riders' friends: step two." }),
    mk("legansus_second_hearing", "Legansus Waystation — The Second Hearing",
      "The Riders convene the way a committee convenes when the committee is also a relay tower: a chair for you, three chairs for them, and a whiteboard Howard keeps wiping clean before anyone writes on it. Your file is open on the table. \"FILES ARE NEVER CLOSED,\" says Captain Robot. \"THAT IS WHAT MAKES THEM FILES. WHAT YOU WERE IS WRITTEN DOWN. WHAT YOU ARE IS NOT, YET.\" Arvind would like to see a pattern. Simone would like it to arrive on time.",
      { repeatable: true, requires: NOT_ALLIED, choices: [
        ch("File it.", "enc_circuit_riders_file_it", { description: "Every receipt counts once, at either desk. The tally is the tally." }),
        ch("Request reclassification.", "legansus_reclassified", { requires: { flag: "crVerify", gte: 2 }, description: "The file is thick enough to argue with. Ask them to." }),
        ch("Not today.", "map_legansus_waystation_intro", { description: "\"THE FILE WILL BE HERE.\" It will." })
      ] }),
    mk("legansus_reclassified", "Legansus Waystation — Reclassified",
      "The relay tower thinks about your file for eleven seconds, which for the relay is a long time, and then the whiteboard says a new word in Howard's handwriting. Captain Robot reads it out because that is protocol. \"RECLASSIFIED: VERIFIED ACTORS. FRIENDS, PENDING. RESCUE ON CALL.\" He does not wink, but Dennis does, on his behalf, and is told off for it. \"WHEN THE CALL COMES CLEAN,\" Captain Robot says, \"WE COME.\"",
      { type: "narration", requires: [{ flag: "crVerify", gte: 2 }, ...NOT_ALLIED], choices: [ch("Back to the waystation.", "map_legansus_waystation_intro")],
        worldEffects: { warLog: "Reclassified at Legansus Waystation: the Circuit Riders now ride with the coalition.", relationshipEffects: [{ sourceFactionId: "@coalition", targetFactionId: RIDERS, setStatus: "allied" }] },
        memoryText: "The Circuit Riders reclassified the Stewards at Legansus: verified, friends pending, rescue on call." })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  // ── 1+2. Legansus remembers the camp; its filings go through the one desk ──
  edit("map_legansus_waystation_intro", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    for (const c of b.choices) {
      const m = /^File the (caravan route|sideways manifest|camcorder clip|dropped manifest|parade permit)\./.exec(String(c.label || ""));
      const mark = c.requires?.beatMark;
      if (m && mark && RECEIPTS.includes(mark) && c.next !== FILED(mark)) { c.next = FILED(mark); c.requires = [{ beatMark: mark }, { beatMark: FILED(mark), not: true }]; c.description = c.description || "One desk: it counts at the camp too."; }
    }
    const front = [];
    if (!hasChoice(b, /Captain Robot is already at the gate/)) front.push(ch("Captain Robot is already at the gate.", "legansus_allied_welcome", { requires: [RIDERS_WITH_YOU, { beatMark: "legansus_allied_welcome", not: true }], description: "Somebody at the camp filed ahead." }));
    if (!hasChoice(b, /^Ask for a second hearing/)) front.push(ch("Ask for a second hearing.", "legansus_second_hearing", { requires: [FLAGGED, ...NOT_ALLIED], description: "Your file says SHORT-TERM ACTORS. Files are never closed." }));
    if (!hasChoice(b, /^Ask for a hearing/)) front.push(ch("Ask for a hearing.", "legansus_second_hearing", { requires: [NOT_FLAGGED, ...NOT_ALLIED], description: "Verified actors get a name. Ask what it takes." }));
    if (front.length) b.choices = [...front, ...b.choices];
  }, "remembers the camp (allied welcome · second hearing · hearing); filings go through the camp's Filed beats");

  // every Filed beat: back to the hearing, or close Legansus as verified; camp terms hidden once you're at Legansus
  for (const m of RECEIPTS) edit(FILED(m), b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (!hasChoice(b, /^Back to the hearing/)) b.choices.push(ch("Back to the hearing.", "legansus_second_hearing", { requires: [{ beatMark: "legansus_second_hearing" }, ...NOT_ALLIED] }));
    if (!hasChoice(b, /^That's verified/)) b.choices.push(ch("That's verified.", "map_legansus_waystation_verified", { requires: [AT_LEGANSUS, { questBucket: Q_LEG, isNot: "completed" }], description: "The waystation stamps it: verified actors." }));
    const terms = b.choices.find(c => c.next === "enc_circuit_riders_parley_resolution");
    if (terms && !terms.requires) terms.requires = { beatMark: "map_legansus_waystation_intro", not: true };
  }, "one desk: back to the hearing / verified at Legansus; camp terms hidden after Legansus");

  // ── 7. the desk outlives Act 2 ──
  const AT_LEG_NOT = { beatMark: "map_legansus_waystation_intro", not: true };
  for (const id of ["enc_circuit_riders_file_it", ...RECEIPTS.map(FILED)]) edit(id, b => { b.inject = b.inject || {}; if (b.inject.evergreen !== true) b.inject.evergreen = true; }, "inject.evergreen (one desk, every act)");
  edit("enc_circuit_riders_file_it", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    for (const c of b.choices) if (c.next === "enc_circuit_riders_captain_robot_intro" && !c.requires) c.requires = AT_LEG_NOT;
    if (!hasChoice(b, /^Back to the hearing/)) b.choices.push(ch("Back to the hearing.", "legansus_second_hearing", { requires: [{ beatMark: "legansus_second_hearing" }, ...NOT_ALLIED] }));
    if (!hasChoice(b, /^Back to the waystation/)) b.choices.push(ch("Back to the waystation.", "map_legansus_waystation_intro", { requires: AT_LEGANSUS }));
  }, "at Legansus: back to the hearing / the waystation instead of the camp conversation");

  // ── 4. the Finale reads either alliance ──
  edit("finale_count_the_coalition", b => { for (const c of (b.choices || [])) if (c.next === "finale_riders_ride" && JSON.stringify(c.requires) !== JSON.stringify(RIDERS_WITH_YOU)) c.requires = RIDERS_WITH_YOU; }, "the Riders answer the count after the camp alliance OR the reclassification");
  for (const id of ["finale_riders_ride", "enc_circuit_riders_the_riders_answer"]) edit(id, b => {
    b.inject = b.inject || {}; const rs = Array.isArray(b.inject.requires) ? b.inject.requires : [];
    b.inject.requires = rs.map(r => (r && r.beatMark === "enc_circuit_riders_parley_alliance" && !r.not) ? RIDERS_WITH_YOU : r);
  }, "opens on the camp alliance OR the reclassification");

  // ── 5. "Pursue alliance" is earned ──
  edit("enc_circuit_riders_parley_resolution", b => {
    for (const c of (b.choices || [])) if (c.next === "enc_circuit_riders_parley_alliance" && !c.requires) { c.requires = { flag: "crVerify", gte: 2 }; c.description = c.description || "Alliance is earned, not picked: the tally says you filed enough."; }
  }, "\"Pursue alliance\" gated on the tally (crVerify ≥ 2)");

  // ── 6. the Trail's script gets the door ──
  const sc = camp.story?.scripts?.widening_trail;
  if (!sc) say("✗ no story script widening_trail");
  else if (!(sc.doors || []).some(d => d.id === "hearing")) {
    sc.doors = [...(sc.doors || []), { id: "hearing", label: "The Second Hearing", line: "Files are never closed. Bring receipts to Legansus and ask to be reclassified.", beats: ["legansus_second_hearing"] }];
    changes++; say("✎ story script widening_trail: door THE SECOND HEARING");
  } else say("· ok story script door (already)");

  console.group(`[patch-legansus-second-hearing-2026-10-03] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s)`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Legansus second hearing DRY RUN: ${changes} change(s) — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Legansus second hearing: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-legansus-hearing-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Legansus second hearing applied: ${changes} change(s). F5.`);
})();
