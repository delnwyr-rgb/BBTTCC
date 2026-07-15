/* groom-phase-charter.macro.js — install the Phase Charter funnel
 * (2026-07-15, PHASE-CHARTER-2026-07-15.md v1.2 LOCKED +
 *  GROOMING-WORKSHEET-2026-07-15.md owner-approved)
 *
 * WHAT IT DOES (idempotent; DRY_RUN default true; backs up campaigns+quests
 * to downloads before writing; hex matching is NBSP-safe):
 *  1. Creates quest "Thatward's Ho — Opening"; moves the cold-open + opening
 *     beats into it (out of the Finale quest).
 *  2. Re-points 5 circuit_riders_parley_* beats off the DELETED ghost quest
 *     quest_6EXzFP8uLTXHhzMz → quest_circuit_riders_parley.
 *  3. Default-closed pass: every beat gains { flag:"storyPhase", gte:N } per
 *     the worksheet's master table (existing gates preserved, AND-combined).
 *     P1 intro-face beats (17, listed below) get gte:1 instead of their
 *     hub's gte:2. AMBIENT quests get pacing.ambient instead of a gate.
 *  4. Cadence opener additionally gains { flag:"hexesClaimed", gte:2 }
 *     (home hex = 1; the first EXPANSION trips the wire).
 *  5. Stamps worldEffects.phaseAdvance on the landmark closers
 *     (incarnation→1 · Seal outcomes→3 · Crown Mall arrival→4 ·
 *      The Sky Is Waiting→5 · Finale outcomes→6). Turn-2/6/10/14 calendar
 *     doors live in the engine, not on beats.
 *  6. Creates the "wrong forest" breadcrumb beat at The Polygonal Grove and
 *     re-wires hex on-enters: Siege → Northreach Expanse f · PolygonWood.a →
 *     Hidden Vault approach · PolygonForest.d → Tifaret approach ·
 *     Inconvenient Mountains.a → Balcones opening.
 *  7. Fresh-start meters: wendigoRung → 0 · storyPhase → 0.
 *
 * Run as GM on EACH instance (settings + hex flags are per-world).
 * Acceptance after live run: console reads ⚡ 1 (Offices) · census lint 0.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── owner-tunable tables (mirror the approved worksheet) ─────────────────
  const PHASE_BY_QUEST = {
    "Offices of Fates and Destinies": 0,
    "Thatward's Ho — Opening": 0,
    "Allesh-Gilliam": 2, "Allesh-Gilliam — The Town Militia": 2, "Allesh-Gilliam — The Confessor's Debt": 2,
    "Lyrenn": 2, "Lyrenn - The Gentle Pest": 2, "Lyrenn - The Field That Remembers You": 2,
    "Lyrenn - The Forest Will Not Be Fought": 2, "Lyrenn — The Red Thread": 2, "Lyrenn — The Land Remembers": 2,
    "Khezek Tor": 2, "Khezek Tor - The Mine that Answered Back": 2,
    "Khezek Tor - The Shipment of UTTER DARKNESS Sometimes": 2, "Khezek Tor - The Valhaulan Seal": 2,
    "Khezek Tor — The Sink Watch": 2, "Khezek Tor — The Compound Cough": 2, "Khezek Tor — The Brace Strain": 2,
    "Furrier's Fixit Farm": 2, "Furrier's Fixit Farm - The Weeping Prisoner": 2, "Furrier's Fixit Farm - The Leyline Stabilizer": 2,
    "Circuit Rider Parley": 2, "The Forest of Early Tifaret": 2,
    "The Bandit Accord": 2, "The Cadence": 2, "Something a Little Off": 2, "Close the Ledger": 2,
    "The Rotating Chapel": 3, "The Burnt Flats": 3, "The Singing Mire": 3, "Anchor Reach": 3,
    "Port Kudzu": 3, "Legansus Waystation": 3, "The Hex Flooded Towns": 3, "The Lost Stone Statues": 3,
    "The Fifteen-Year Siege": 3, "Siege Week (Annual)": 3, "A Gift. (Not a Trojan.)": 3,
    "The Hidden Vault": 3, "The Balcones Faulting You Line": 3,
    "The Crown Mall": 4, "The Mall of Forgotten Yesterdays": 4, "The Maneuver Vault": 4, "The Touring Gift": 4,
    "Thatwards Ho! Finale": 5,
    "Gloomgill - He that was Oannes": 6,
  };
  const AMBIENT_QUESTS = new Set(["Travel & Wandering Encounters", "The Ninth Guest"]);
  const SKIP_QUESTS = new Set(["The Valhaulan Spine"]);   // director-driven, own gates
  const SYSTEM_BEATS = new Set(["adversary_reality_tear_watcher_notices"]); // lint-exempt

  // Phase-1 intro faces (worksheet §3 approved heuristics — edit freely)
  const P1_INTRO_BEATS = new Set([
    "allesh_gilliam_opening_scene", "avuncular_joans_speech",
    "allesh_gilliam_hq_cinematics", "allesh_gilliam_hq_interior",
    "allesh_gilliam_st_gilliams_cinematics", "allesh_gilliam_st_gilliams_intro",
    "allesh_gilliam_waiting_room_intro", "allesh_gilliam_vacancy_intro",
    "allesh_gilliam_plumb_office_intro", "allesh_gilliam_muster_intro",
    "lyrenn_opening_scene", "lyrenn_main_scene", "lyrenn_green_ring_cinematic",
    "khezek_tor_main_scene",
    "fixit_cinematic_intro", "fixit_intro_scene", "fixit_saloon_cinematic",
  ]);

  const CADENCE_OPENER = "cadence_declaration";
  const CLOSERS = {
    fates_and_destinies_incarnate: 1,
    khezek_tor_the_vaulhaulan_seal_restore: 3,
    khezek_tor_the_vaulhaulan_seal_redirect: 3,
    khezek_tor_the_vaulhaulan_seal_break: 3,
    map_crown_mall_intro: 4,
    vs_bridge_muster: 5,
    raid_thatwards_outcome_friends: 6,
    raid_thatwards_rewards_major: 6,
  };

  const OPENING = { qid: "quest_thatwards_opening", name: "Thatward's Ho — Opening", beatIds: ["thatwards_ho_cold_open", "thatwards_ho_opening_scene"] };
  const GHOST = { from: "quest_6EXzFP8uLTXHhzMz", to: "quest_circuit_riders_parley" };

  const BREADCRUMB = {
    id: "polygonal_grove_breadcrumb",
    label: "The Polygonal Grove — Decorative Geometry",
    description: "Ah yes, the Polygonal Grove. Lovely angles. TREMENDOUS commitment to the bit. But between you and me? This geometry is <em>decorative</em>. Someone practiced here — sketches, warm-ups, a forest doodling in the margins of itself. The real thing — the one where the angles are LOAD-BEARING — is north, in the Marches, in a wood that spells its name with a capital W. When you find it, do NOT touch the walls without asking first. This has been a public service announcement.",
  };

  // hexName → { beat, expect } — expect = the on-enter we intend to replace
  // (null = expect blank). Mismatch = skip + warn, never overwrite silently.
  const HEX_WIRING = [
    { hex: "Northreach Expanse f", beat: "siege_market_day", expect: null },
    { hex: "PolygonWood.a", beat: "enc_hidden_vault_approach", expect: "siege_market_day" },
    { hex: "The Polygonal Grove", beat: BREADCRUMB.id, expect: "enc_hidden_vault_approach" },
    { hex: "PolygonForest.d", beat: "forest_of_tifaret_approach", expect: null },
    { hex: "Inconvenient Mountains.a", beat: "balcones_faulting_you_line_opening", expect: null },
  ];

  const RESET_METERS = { wendigoRung: 0, storyPhase: 0 };

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const report = [];
  let changes = 0;

  const qidByName = {};
  for (const q of Object.values(quests)) if (q?.id) qidByName[String(q.name || "").trim()] = q.id;

  // ── 1. Opening container ──────────────────────────────────────────────────
  if (!quests[OPENING.qid]) {
    quests[OPENING.qid] = { id: OPENING.qid, v: 1, name: OPENING.name,
      description: "The bus, the sendoff, the town below: the campaign's cold open and opening scene, fired by the Offices' incarnation closer.",
      tags: [], status: "active", createdTs: 0, updatedTs: 0 };
    changes++; report.push(`✚ quest registered: ${OPENING.name}`);
  } else report.push(`· ok quest (already) ${OPENING.name}`);
  qidByName[OPENING.name] = OPENING.qid;
  for (const bid of OPENING.beatIds) {
    const b = camp.beats.find(x => String(x?.id) === bid);
    if (!b) { report.push(`⚠ opening beat "${bid}" not found`); continue; }
    if (String(b.questId) !== OPENING.qid) { b.questId = OPENING.qid; changes++; report.push(`⚡ re-home ${bid} → ${OPENING.name}`); }
  }

  // ── 2. Ghost-quest repair ─────────────────────────────────────────────────
  let ghostN = 0;
  for (const b of camp.beats) {
    if (String(b?.questId) === GHOST.from) { b.questId = GHOST.to; ghostN++; changes++; }
  }
  if (ghostN) report.push(`⚡ ${ghostN} beat(s) re-pointed off ghost quest → circuit_riders_parley`);

  // ── 3+4+5. Default-closed pass ────────────────────────────────────────────
  const questNameOf = b => {
    const qid = String(b?.questId || "").trim();
    return qid ? String(quests[qid]?.name || qid) : "";
  };
  const hasCond = (req, pred) => (Array.isArray(req) ? req : req ? [req] : []).some(pred);
  const tally = {}; const unmappedQuests = new Set();
  for (const b of camp.beats) {
    if (!b?.id) continue;
    const id = String(b.id);
    const qn = questNameOf(b);

    // Closer stamps apply to EVERY class of beat — including spine beats,
    // which the phase-gating below deliberately skips (vs_bridge_muster is
    // both a spine beat AND the Phase-4→5 closer).
    const closeTo = CLOSERS[id];
    if (closeTo != null && b.worldEffects?.phaseAdvance?.set !== closeTo) {
      b.worldEffects = b.worldEffects || {};
      b.worldEffects.phaseAdvance = { set: closeTo };
      changes++; report.push(`⚡ closer stamped: ${id} → phaseAdvance ${closeTo}`);
    }

    if (SYSTEM_BEATS.has(id)) {
      if (!b.pacing?.ambient) { b.pacing = Object.assign({}, b.pacing, { ambient: true }); changes++; tally["system-exempt"] = (tally["system-exempt"] || 0) + 1; }
      continue;
    }
    if (SKIP_QUESTS.has(qn)) { tally["spine (own gates)"] = (tally["spine (own gates)"] || 0) + 1; continue; }
    if (AMBIENT_QUESTS.has(qn)) {
      if (!b.pacing?.ambient) { b.pacing = Object.assign({}, b.pacing, { ambient: true }); changes++; tally["ambient"] = (tally["ambient"] || 0) + 1; }
      continue;
    }
    const phase = P1_INTRO_BEATS.has(id) ? 1 : PHASE_BY_QUEST[qn];
    if (phase == null) { if (qn) unmappedQuests.add(qn); continue; }

    b.inject = b.inject || {};
    let req = b.inject.requires;
    req = Array.isArray(req) ? req : req ? [req] : [];
    if (!hasCond(req, c => c && c.flag === "storyPhase")) {
      req.push({ flag: "storyPhase", gte: phase });
      b.inject.requires = req;
      changes++; tally[`gate P${phase}`] = (tally[`gate P${phase}`] || 0) + 1;
    }
    if (id === CADENCE_OPENER && !hasCond(b.inject.requires, c => c && c.flag === "hexesClaimed")) {
      b.inject.requires.push({ flag: "hexesClaimed", gte: 2 });
      changes++; report.push(`⚡ Cadence opener armed: hexesClaimed ≥ 2`);
    }
  }
  for (const [k, n] of Object.entries(tally)) report.push(`⚡ ${String(n).padStart(3)} beat(s): ${k}`);
  if (unmappedQuests.size) report.push(`⚠ UNMAPPED quests left ungated: ${[...unmappedQuests].join("; ")}`);

  // ── 6. Breadcrumb beat + hex wiring ───────────────────────────────────────
  if (!camp.beats.some(b => String(b?.id) === BREADCRUMB.id)) {
    camp.beats.push({
      id: BREADCRUMB.id, label: BREADCRUMB.label, type: "custom", timeScale: "moment", timePoints: 0,
      questId: qidByName["Travel & Wandering Encounters"] || null,
      pacing: { ambient: true }, playerFacing: true, playerFacingDialog: true, showToPlayers: true,
      description: BREADCRUMB.description, tags: "", choices: [], outcomes: {}, inject: {},
      audio: { enabled: false, src: "", volume: 0.85, loop: false, autoplay: true },
    });
    changes++; report.push(`✚ beat created: ${BREADCRUMB.id} ("wrong forest" breadcrumb)`);
  } else report.push(`· ok beat (already) ${BREADCRUMB.id}`);

  const beatIds = new Set(camp.beats.map(b => String(b?.id)));
  const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();  // NBSP-safe
  const hexByName = new Map();
  for (const scene of game.scenes) {
    for (const dr of scene.drawings.contents) {
      const f = dr.flags?.["bbttcc-territory"];
      if (!f || !(f.isHex === true || f.kind === "territory-hex" || f.hexId)) continue;
      const nm = norm(dr.text || f.name);
      if (nm && !hexByName.has(nm)) hexByName.set(nm, { dr, scene });
    }
  }
  for (const w of HEX_WIRING) {
    if (!beatIds.has(w.beat)) { report.push(`⚠ SKIP ${w.hex}: target beat "${w.beat}" missing`); continue; }
    const hit = hexByName.get(norm(w.hex));
    if (!hit) { report.push(`⚠ SKIP ${w.hex}: hex not found on any scene`); continue; }
    const cur = hit.dr.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId || null;
    if (cur === w.beat) { report.push(`· ok hex (already) ${w.hex} → ${w.beat}`); continue; }
    if (cur !== w.expect) { report.push(`⚠ SKIP ${w.hex}: on-enter is "${cur}", expected "${w.expect}" — verify by hand`); continue; }
    changes++; report.push(`⚡ hex on-enter: ${w.hex} → ${w.beat}${cur ? ` (was ${cur})` : ""}`);
    if (!DRY_RUN) await hit.dr.update({ "flags.bbttcc-territory.campaign.onEnterBeatId": w.beat });
  }

  // ── 7. fresh-start meters ─────────────────────────────────────────────────
  for (const [k, v] of Object.entries(RESET_METERS)) {
    let cur = null;
    try { cur = Number(game.settings.get(NS, k)) || 0; } catch (_e) {}
    if (cur !== v) { changes++; report.push(`⚡ meter ${k}: ${cur} → ${v}`); if (!DRY_RUN) await game.settings.set(NS, k, v); }
    else report.push(`· ok meter ${k} = ${v}`);
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[groom-phase-charter] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Phase Charter DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Phase Charter: nothing to do — already groomed.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-charter-${Date.now()}.json`);
    save(questsWasStr ? questsRaw : JSON.stringify(questsRaw), "text/json", `backup-quests-before-charter-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Phase Charter APPLIED: ${changes} change(s). The funnel is live — Phase 0 should read ⚡ 1.`);
})();
