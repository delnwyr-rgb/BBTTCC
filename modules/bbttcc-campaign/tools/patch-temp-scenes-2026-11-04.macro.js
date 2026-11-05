/**
 * patch-temp-scenes-2026-11-04.macro.js — Dave 2026-11-04: "wire up Good Temp Scenes" from the Bad Eden: Scenes compendium.
 * ⚠ THE COMPENDIUM ART IS AI. Fine for playtesting, NEVER for any media. Every import is named "TEMP AI — …", sits in the folder "TEMP AI (playtest only)"
 * and carries flags.bbttcc-campaign.tempAI, so it can be found and swapped out. Placed tokens are dropped on import when their actor doesn't exist here.
 * Dave 2026-11-04: Maarg "can totally wait" (encounter not built) and the Lost Statues don't need battlemaps, so neither is wired here; the statue cinematics' dead next-scene is cleared.
 * Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = (globalThis.__tempScenesDry ?? true);
  const NS = "bbttcc-campaign", PACK = "bbttcc-master-content.scenes", PFX = "TEMP AI — ", FOLDER = "TEMP AI (playtest only)";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const T = (n) => PFX + n;
  const roads = { houses: "bbttcc_travel_generic_wasteland_road_1", wreck: "bbttcc_travel_generic_wasteland_road_2", open: "bbttcc_travel_generic_wasteland_road_3", post: "bbttcc_travel_generic_wasteland_road_4" };
  // [beat, scene]. A scene name without the TEMP prefix is an already built, non-AI scene. Every entry overwrites what the beat had.
  const WIRE = [
    // exact matches
    ["fixit_backstairs_exterior", T("fixit_backstairs_exterior")],
    ...["fixit_route_board", "fixit_route_board_pegs", "fixit_route_board_fail", "fixit_route_board_after", "ans_fixit_route_board_pegs_ask_what_pip_and_patter", "ans_fixit_route_board_pegs_ask_who_pays_for_the", "ans_fixit_route_board_pegs_ask_about_the_wagon", "ans_fixit_route_board_after_ask_pip_what_the_loop", "ans_fixit_route_board_after_ask_what_ish_means"].map(b => [b, T("fixit_arc_bay_shed")]),
    ["thatwards_ho_opening_scene", T("thatwards_ho_opening_scene")],
    ...["adversary_reality_tear_watcher_notices", "ans_adversary_reality_tear_watcher_notices_meet_its_gaze_let_the", "ans_adversary_reality_tear_watcher_notices_cover_the_tear_spend_a", "ans_adversary_reality_tear_watcher_notices_hold_still_let_the_pressure"].map(b => [b, T("Adversary Beat")]),
    // the camp, and the same camp when it comes back in the Widening Trail (Mini Raid, Dave's pointer). Not Rig Fight: its rows are tokens, the map under them is an empty road
    ...["ft_camp_approach", "ft_camp_quiet", "ft_camp_surprise", "ft_camp_warned", "ft_camp_fight", "ft_camp_fight_warned", "ft_camp_taken_force", "ft_camp_taken_quiet", "ft_camp_turned", "wt_cult_camp"].map(b => [b, T("Warehouse Courtyard")]),
    // Sarmoung Hum
    ["hum_loud_revival", T("Ruined Village Road Scale")], ["hum_quiet_decline", T(roads.open)], ["hum_t2_forty_paces", T(roads.open)], ["hum_quiet_ledger", T(roads.post)],
    ["hum_t2_same_two", T(roads.houses)], ["hum_t2_roof", T(roads.houses)], ["hum_t2_fourth_roof", T(roads.houses)], ["hum_t2_bee_teller_meet", T(roads.houses)],
    ["hum_loud_handwriting", T("bbttcc_travel_generic_forest_3")], ["hum_t2_mask_stack", T("bbttcc_travel_generic_canyon_3")],
    // Bandit Accord
    ["bandit_stilt_hall", T("port_kudzu_wharf_pov")], ["bandit_summit", T("port_kudzu_wharf_pov")], ["bandit_ambush_arms_down", "Aslı bandit ambush battlemap"],
    ["bandit_first_patrol", T("bbttcc_travel_generic_river_road_2")], ["bandit_patrol_waves", T("bbttcc_travel_generic_river_road_2")],
    // the rest
    ["founders_garden_approach", T("bbttcc_travel_generic_river_road_2")],
    ["trojan_arrival", T("faction_parley_standoff")], ["trojan_tour", T("faction_parley_standoff")],
    ["wendigo_confluence_the_long_table", T("bbttcc_travel_generic_mountain_view")], ["fc_seated", T("bbttcc_travel_generic_mountain_view")],
    ["netzach_reach", T("radioactive swamp 2")],
    ["binah_surface", "Totally Shallow Water"],
    ["tikkun_atonement_rite", "st_gilliams_interior_pov"],
    ["circuit_riders_classification_review", "circuit_rider_approach_hexchrome_pov"], ["circuit_riders_chase_run", T(roads.wreck)],
    ["cadence_the_drum", "dance_battle_pov"], ["cadence_viewing_mound", "dance_battle_pov"], ["cadence_parade", "dance off"],
    ["enc_scout_signs", T(roads.open)], ["enc_scout_signs_valuable", T(roads.open)], ["enc_supply_shortage", T(roads.wreck)]
  ];
  const CINE = [
    ["enc_rockslide_cinematic", { startSceneId: T("Rockslide Cinematic") }]
  ];
  const CLEAR_NEXT = ["spark_geburah_northreach_b", "spark_geburah_mountains_q", "spark_geburah_mountains_o"];
  const wanted = new Set();
  for (const [, n] of WIRE) if (n.startsWith(PFX)) wanted.add(n);
  for (const [, c] of CINE) for (const v of Object.values(c)) if (typeof v === "string" && v.startsWith(PFX)) wanted.add(v);
  const pack = game.packs.get(PACK); if (!pack) return ui.notifications.error("Scenes compendium not found.");
  const index = await pack.getIndex();
  const toImport = [...wanted].filter(n => !game.scenes.getName(n));
  const conflicts = [];
  for (const n of toImport) if (!index.find(e => e.name === n.slice(PFX.length))) conflicts.push(`not in compendium: ${n.slice(PFX.length)}`);
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = JSON.parse(wasStr ? raw : JSON.stringify(raw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  for (const [b, n] of WIRE) { if (!beats.some(x => x?.id === b)) conflicts.push(`beat not found: ${b}`); if (!n.startsWith(PFX) && !game.scenes.getName(n)) conflicts.push(`scene not found: ${n}`); }
  for (const [b] of CINE) if (!beats.some(x => x?.id === b)) conflicts.push(`beat not found: ${b}`);
  const report = toImport.map(n => `✚ import ${n}`);
  if (DRY_RUN || conflicts.length) { globalThis.__tempScenes = { dry: true, imports: toImport.length, conflicts, report, changes: toImport.length };
    if (!conflicts.length) { let pending = 0; for (const [id, n] of WIRE) { const s = game.scenes.getName(n), b = beats.find(x => x?.id === id); if (!s || String(b.sceneId || "").replace(/^Scene\./, "") !== s.id) pending++; }
      for (const [id, c] of CINE) { const b = beats.find(x => x?.id === id); for (const [k, v] of Object.entries(c)) { if (typeof v !== "string" || !v.startsWith(PFX)) continue; const s = game.scenes.getName(v); if (!s || String(b.cinematic?.[k] || "").replace(/^Scene\./, "") !== s.id) pending++; } }
      globalThis.__tempScenes.changes = toImport.length + pending; globalThis.__tempScenes.pending = pending; }
    return ui.notifications.info(`DRY RUN — ${globalThis.__tempScenes.changes} change(s); see globalThis.__tempScenes.`); }
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    await FP.upload("data", "bbttcc-exports", new File([wasStr ? raw : JSON.stringify(raw)], `backup-campaigns-pre-temp-scenes-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  let folder = game.folders.find(f => f.type === "Scene" && f.name === FOLDER);
  if (!folder && toImport.length) folder = await Folder.create({ name: FOLDER, type: "Scene", color: "#8a2be2" });
  const dropped = [];
  for (const n of toImport) {
    const e = index.find(x => x.name === n.slice(PFX.length));
    const doc = await pack.getDocument(e._id); const data = game.scenes.fromCompendium(doc);
    const before = (data.tokens || []).length; data.tokens = (data.tokens || []).filter(t => t.actorId && game.actors.has(t.actorId));
    if (data.tokens.length !== before) dropped.push(`${n}: ${before - data.tokens.length}`);
    Object.assign(data, { name: n, folder: folder.id, navigation: false, active: false });
    data.flags = { ...(data.flags || {}), [NS]: { ...(data.flags?.[NS] || {}), tempAI: true } };
    await Scene.create(data);
  }
  let changes = toImport.length;
  for (const id of CLEAR_NEXT) { const b = beats.find(x => x?.id === id); if (b?.cinematic?.nextSceneId && !game.scenes.get(String(b.cinematic.nextSceneId).replace(/^Scene\./, ""))) { b.cinematic.nextSceneId = null; changes++; report.push(`✚ ${id}: dead next scene cleared`); } }
  for (const [id, n] of WIRE) { const s = game.scenes.getName(n), b = beats.find(x => x?.id === id);
    if (String(b.sceneId || "").replace(/^Scene\./, "") !== s.id) { b.sceneId = s.id; changes++; report.push(`✚ ${id} → ${n}`); } }
  for (const [id, c] of CINE) { const b = beats.find(x => x?.id === id); b.cinematic = b.cinematic || {};
    for (const [k, v] of Object.entries(c)) { const val = (typeof v === "string" && v.startsWith(PFX)) ? `Scene.${game.scenes.getName(v).id}` : v;
      if (k === "durationMs" && Number(b.cinematic[k]) > 0) continue;
      if (b.cinematic[k] !== val) { b.cinematic[k] = val; changes++; report.push(`✚ ${id} cinematic ${k}`); } } }
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  globalThis.__tempScenes = { dry: false, changes, report, conflicts, dropped };
  console.log(`[temp scenes] APPLY — ${changes} change(s)\n` + report.join("\n"));
  ui.notifications.info(`Temp scenes wired (${changes} change(s)).`);
})();
