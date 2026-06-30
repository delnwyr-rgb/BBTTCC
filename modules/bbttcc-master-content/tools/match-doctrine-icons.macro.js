/* Bad Eden — Match Doctrine-pack icons to GOTTGAIT button icons (2026-06-28)
 * ===================================================================
 * Gives every "Bad Eden: Doctrines" pack item that has NO custom art yet
 * (core icons/svg, item-bag, or blank) a thematically-matched BBTTCC button
 * icon from art/bbttcc/GOTTGAIT/BBTTCC Button Icons. Items that already point
 * at art/bbttcc/... are left untouched.
 *
 * Matched by flags.bbttcc.key (snake_case), with a name fallback. Every target
 * filename is validated against the live icon folder before it's applied, so a
 * typo can never set a broken path — it's reported instead.
 *
 * DRY_RUN by default — run once to read the full match report (which icon each
 * item would get + anything unmatched), then flip DRY_RUN=false to write.
 * Pack is per-instance: run in the world whose pack you want updated (icons
 * confirmed present on the Ember instance). Idempotent.
 * ===================================================================*/
(async () => {
  const PACK_ID  = "bbttcc-master-content.doctrines";
  const ICON_DIR = "art/bbttcc/GOTTGAIT/BBTTCC Button Icons";
  const DRY_RUN  = true;   // ← set false to write img changes to the pack
  const TAG = "[doctrine-icons]";

  // ── key (flags.bbttcc.key) → icon filename ───────────────────────────────
  const MAP = {
    // — Combat / assault maneuvers —
    suppressive_fire: "BBTTCC_button_icon_energy_cone.png",
    suppressive_volley: "BBTTCC_button_icon_energy_cone.png",
    flank_attack: "BBTTCC_button_icon_sword_2.png",
    rally_the_line: "bbttcc_icons_flag_1.png",
    command_overdrive: "BBTTCC_button_icon_military.png",
    coordinated_strike: "BBTTCC_button_icon_military.png",
    coordinated_advance: "BBTTCC_button_icon_military_2.png",
    opt_coordinated_advance: "BBTTCC_button_icon_military_2.png",
    echo_strike_protocol: "BBTTCC_button_icon_shockwave.png",
    ego_breaker: "BBTTCC_button_icon_skull_1.png",
    artillery_salvo: "BBTTCC_button_icon_explosion_1.png",
    industrial_sabotage: "BBTTCC_button_icon_explosion_4.png",
    saboteur_s_edge: "BBTTCC_button_icon_bomb_1.png",
    overclock_the_golems: "bbttcc_icons_mech_1.png",
    qliphothic_gambit: "BBTTCC_button_icon_void_edge_1.png",
    ego_dragon_echo: "BBTTCC_button_icon_dragon.png",
    // — Defense maneuvers —
    patch_the_breach: "BBTTCC_button_icon_rampart_1.png",
    defensive_entrenchment: "BBTTCC_button_icon_bunker_2.png",
    last_stand_banner: "bbttcc_icons_flag_2.png",
    quantum_shield: "BBTTCC_button_icon_force_field_1.png",
    defender_s_reversal: "BBTTCC_button_icon_shield_2.png",
    tactical_overwatch: "BBTTCC_button_icon_surveillance.png",
    // — Siege maneuvers —
    sap_the_walls: "BBTTCC_button_icon_cracked_stone.png",
    shore_the_gate: "BBTTCC_button_icon_rampart_1.png",
    sortie_en_masse: "BBTTCC_button_icon_castle_1.png",
    crack_the_keep: "BBTTCC_button_icon_smash_wall_1.png",
    siege_breaker_volley: "BBTTCC_button_icon_breaker_wall_1.png",
    supply_overrun: "BBTTCC_button_icon_box_1.png",
    // — Logistics / economy maneuvers —
    logistical_surge: "BBTTCC_button_icon_box_2.png",
    logistics_surge_s2: "BBTTCC_button_icon_box_1.png",
    supply_surge: "bbttcc_icons_safe.png",
    forward_resupply: "BBTTCC_button_icon_box_1.png",
    war_chest: "bbttcc_icons_safe.png",
    gradient_surge: "BBTTCC_button_icon_spark_1.png",
    total_mobilization: "bbttcc_icons_flag_1.png",
    // — Intrigue / infiltration maneuvers —
    smoke_and_mirrors: "bbttcc_icons_mirror_1.png",
    flash_interdict: "bbttcc_icons_net_1.png",
    ghost_slip_infiltration: "bbttcc_icons_ghostly_runner_invisible.png",
    psychic_disruption: "BBTTCC_button_icon_psychic_2.png",
    signal_hijack: "BBTTCC_button_icon_circuit_1.png",
    chrono_loop_command: "BBTTCC_button_icon_hourglass_1.png",
    reality_hack: "BBTTCC_button_icon_quantum_1.png",
    void_signal_collapse: "BBTTCC_button_icon_void_edge_2.png",
    temporal_armistice: "BBTTCC_button_icon_hourglass_2.png",
    hide_in_shadow: "BBTTCC_button_icon_stealth_1.png",
    take_cover: "BBTTCC_button_icon_bunker_2.png",
    distract: "BBTTCC_button_icon_single_eye.png",
    disable_alarm: "BBTTCC_button_icon_circuit_1.png",
    pick_lock: "bbttcc_icons_key_2.png",
    bypass_obstacle: "bbttcc_icons_key_2.png",
    subdue_nonlethal: "BBTTCC_button_icon_sleep.png",
    conceal_body: "bbttcc_icons_cloak_1.png",
    tailgate: "bbttcc_icons_ghostly_runner_1.png",
    impersonate: "bbttcc_icons_multiple_personas_1.png",
    // — Faith / ritual maneuvers —
    prayer_in_the_smoke: "bbttcc_icons_holy_symbol_1.png",
    bless_the_fallen: "bbttcc_icons_holy_symbol_2.png",
    divine_favor: "bbttcc_icons_holy_symbol_4.png",
    faithful_intervention: "bbttcc_icons_holy_ray_1.png",
    field_chaplaincy: "bbttcc_icons_holy_symbol_2.png",
    prayer_pulse: "bbttcc_icons_holy_symbol_1.png",
    sympathetic_stabilization: "bbttcc_icons_hand_5.png",
    harmonic_chant: "BBTTCC_button_icon_music.png",
    radiant_retaliation: "BBTTCC_button_icon_sun_1.png",
    sephirotic_intervention: "bbttcc_icons_tree_of_life_3.png",
    crown_of_mercy: "BBTTCC_button_icon_crown-1.png",
    engine_of_absolution: "bbttcc_icons_forge_sun_1.png",
    // — Social / presence / propaganda maneuvers —
    empathic_surge: "BBTTCC_button_icon_heart_1.png",
    moral_high_ground: "BBTTCC_button_icon_sunrise_1.png",
    counter_propaganda_wave: "bbttcc_icons_shout_5.png",
    unity_surge: "BBTTCC_button_icon_connected_1.png",
    cultural_offensive: "BBTTCC_button_icon_music.png",
    faction_wide_rally: "bbttcc_icons_shout_1.png",
    diplomatic_channel: "BBTTCC_button_icon_scroll_1.png",
    flash_bargain: "BBTTCC_button_icon_scroll_1.png",
    infernal_bargain: "BBTTCC_button_icon_sigil_1.png",
    opt_infernal_bargain: "BBTTCC_button_icon_sigil_1.png",
    // — Courtly maneuvers —
    courtly_whispered_aside: "BBTTCC_button_icon_speech_2.png",
    courtly_public_toast: "bbttcc_icons_chalice_2.png",
    courtly_plant_a_doubt: "BBTTCC_button_icon_compulsion_1.png",
    courtly_the_last_word: "BBTTCC_button_icon_speech_1.png",
    courtly_quote_old_law: "bbttcc_icons_scroll_edited_2.png",
    courtly_read_the_room: "BBTTCC_button_icon_eyes_1.png",
    courtly_stage_distraction: "bbttcc_icons_shout_5.png",
    courtly_forged_letter: "BBTTCC_button_icon_quill_design.png",
    courtly_sidle_closer: "BBTTCC_button_icon_step_2.png",
    courtly_eavesdrop: "bbttcc_icons_magnifying_glass_1.png",
    courtly_call_question: "BBTTCC_button_icon_scissors.png",
    courtly_patrons_word: "BBTTCC_button_icon_crown-1.png",
    courtly_mask_off: "bbttcc_icons_mask_1.png",

    // — Build / develop strategics —
    harvest_season: "BBTTCC_button_icon_tree_1.png",
    minor_repair: "BBTTCC_button_icon_tools_1.png",
    develop_outpost_stability: "BBTTCC_button_icon_city.png",
    establish_outpost: "BBTTCC_button_icon_camp.png",
    establish_supply_line: "bbttcc_icons_road_1.png",
    establish_trade_route: "bbttcc_button_icon_anchor.png",
    found_site_farm: "BBTTCC_button_icon_tree_1.png",
    found_site_fortress: "BBTTCC_button_icon_castle_2.png",
    found_site_mine: "BBTTCC_button_icon_mountain.png",
    found_site_port: "BBTTCC_button_icon_ocean_1.png",
    found_site_research: "BBTTCC_button_icon_book_1.png",
    upgrade_outpost_settlement: "BBTTCC_button_icon_city.png",
    develop_infrastructure_std: "BBTTCC_button_icon_plans_1.png",
    infrastructure_expansion: "BBTTCC_button_icon_city_hex.png",
    // — Siege strategics —
    begin_siege: "bbttcc_icons_siege_2.png",
    establish_siege_camp: "BBTTCC_button_icon_camp.png",
    interdict_supply_line: "bbttcc_icons_net_1.png",
    escort_supply_line: "BBTTCC_button_icon_vehicle_1.png",
    counter_interdict: "bbttcc_icons_net_1.png",
    demand_surrender: "bbttcc_icons_human_surrender_1.png",
    champion_withdraws: "BBTTCC_button_icon_run.png",
    champion_returns: "BBTTCC_button_icon_helmet_1.png",
    bombard: "BBTTCC_button_icon_bomb_1.png",
    storm_final_assault: "BBTTCC_button_icon_war_tower_1.png",
    sortie: "BBTTCC_button_icon_castle_1.png",
    reinforce_garrison: "BBTTCC_button_icon_rampart_2.png",
    call_relief: "bbttcc_icons_flag_4.png",
    sue_for_terms: "BBTTCC_button_icon_peace_1.png",
    champion_defends_wall: "bbttcc_icons_fist_wall.png",
    pray_for_omen: "bbttcc_icons_holy_symbol_3.png",
    // — Diplomacy / culture / governance strategics —
    alignment_shift: "BBTTCC_button_icon_sigil_2.png",
    diplomatic_mission: "BBTTCC_button_icon_scroll_2.png",
    cultural_festival: "BBTTCC_button_icon_music_2.png",
    defuse_tensions: "bbttcc_icons_peace_hand_1.png",
    loyalty_program: "bbttcc_icons_people_1.png",
    gather_intel: "BBTTCC_button_icon_eyes_2.png",
    policy_reforms: "BBTTCC_button_icon_plans_2.png",
    mass_mobilization: "bbttcc_icons_people_2.png",
    mass_mobilization_std: "bbttcc_icons_people_2.png",
    reconstruction_drive_std: "BBTTCC_button_icon_hammer_1.png",
    patrol_routes: "BBTTCC_button_icon_map.png",

    // — More siege maneuvers —
    boiling_oil: "bbttcc_icons_cauldron_2.png",
    escalade: "bbttcc_icons_climb.png",
    flaming_pitch: "bbttcc_icons_flame_1.png",
    ram_gate: "BBTTCC_button_icon_war_engine.png",
    sapper_undermine: "bbttcc_icons_tunnel_1.png",
    trojan_horse: "bbttcc_icons_mystic_thief_2.png",
    siege_champion_duel: "BBTTCC_button_icon_sword_3.png",

    // — Class-signature maneuvers (cls_*) —
    cls_bulwark: "BBTTCC_button_icon_shield_4.png",        // Brace the Breach
    cls_pact: "BBTTCC_button_icon_sigil_3.png",            // Call the Debt
    cls_linguist: "bbttcc_icons_scroll_edited_3.png",      // Cite the Clause
    cls_soulsmith: "BBTTCC_button_icon_forge.png",         // Field Refit
    cls_aurablade: "BBTTCC_button_icon_aurablade_1.png",   // Mercy's Edge
    cls_courier: "BBTTCC_button_icon_stealth_3.png",       // Open the Postern
    cls_dreamwalker: "BBTTCC_button_icon_dream_monster.png", // Phantom Host
    cls_marshal: "bbttcc_icons_marshall_1.png",            // Rally the Standard
    cls_wyrdlens: "bbttcc_icons_wyrdlens_adept_3.png",     // Read the Weak Point

    // — Option-derived activities (opt_* / optact_*) —
    optact_administrative_optimization: "BBTTCC_button_icon_btools_2.png",
    optact_arcane_attribution: "BBTTCC_button_icon_sigil_4.png",
    opt_bureaucratic_override: "BBTTCC_button_icon_scroll_2.png",
    optact_deep_cover_network: "BBTTCC_button_icon_web_1.png",
    optact_doctrine_force_projection: "BBTTCC_button_icon_military_3.png",
    optact_doctrine_of_clarity: "BBTTCC_button_icon_spark_2.png",
    optact_dynastic_resonance: "BBTTCC_button_icon_crown-2.png",
    opt_formal_parley: "BBTTCC_button_icon_connected_2.png",
    optact_guided_ascent: "BBTTCC_button_icon_sunrise_2.png",
    opt_inherited_deference: "bbttcc_icons_throne_1.png",
    optact_integration_framework: "BBTTCC_button_icon_circuit_2.png",
    opt_make_do_and_hold: "BBTTCC_button_icon_bunker_3.png",
    optact_never_scattered: "bbttcc_icons_crowd_control_1.png",
    optact_philosophic_exchange: "BBTTCC_button_icon_book_2.png",
    opt_pierce_the_veil: "BBTTCC_button_icon_dimensional_1.png",
    opt_prepared_insight: "BBTTCC_button_icon_book_4.png",
    opt_rapid_transmutation: "BBTTCC_button_icon_atom_1.png",
    opt_shock_command: "BBTTCC_button_icon_lightning_2.png",
    opt_sight_of_the_tree: "bbttcc_icons_tree_of_life_5.png",
    optact_silent_brotherhood: "bbttcc_icons_cloak_hooded_2.png",
    opt_silent_entry: "BBTTCC_button_icon_stealth_6.png",
    optact_thread_the_spread: "BBTTCC_button_icon_web_2.png",
    opt_turn_the_card: "BBTTCC_button_icon_tarot_1.png",
    opt_veiled_access: "bbttcc_icons_cloak_2.png",
  };
  // Name fallback for items lacking a clean flags.bbttcc.key.
  const NAME_MAP = {
    "Pick Lock": "bbttcc_icons_key_2.png",
    "Subdue (Non-Lethal)": "BBTTCC_button_icon_sleep.png",
    "Develop Outpost (Stability)": "BBTTCC_button_icon_city.png",
    "Upgrade Outpost → Settlement": "BBTTCC_button_icon_city.png",
  };

  const enc = (fn) => `${ICON_DIR}/${fn}`.replaceAll(" ", "%20");
  const isArtless = (img) => !img || /^icons\//i.test(img) || /item-bag|mystery-man/i.test(img);

  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error?.(`${TAG} Pack ${PACK_ID} not found.`);

  // Validate target filenames against the live icon folder (backstop vs typos).
  let available = null;
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation || FilePicker;
    const b = await FP.browse("data", ICON_DIR);
    available = new Set((b.files || []).map(f => decodeURIComponent(String(f).split("/").pop())));
    console.log(`${TAG} icon folder has ${available.size} files.`);
  } catch (e) { console.warn(`${TAG} could not browse icon folder — skipping availability check.`, e); }

  const docs = await pack.getDocuments();
  const updates = [], skipped = [], unmatched = [], missingIcon = [];
  for (const it of docs) {
    if (!isArtless(it.img)) { skipped.push(it.name); continue; }
    const key = String(it.flags?.bbttcc?.key || "").toLowerCase().trim();
    const fn = MAP[key] || NAME_MAP[it.name] || null;
    if (!fn) { unmatched.push(`${it.name} [${key || "no-key"}]`); continue; }
    if (available && !available.has(fn)) { missingIcon.push(`${it.name} → ${fn} (FILE NOT FOUND)`); continue; }
    updates.push({ _id: it.id, img: enc(fn), _name: it.name, _fn: fn });
  }

  console.log(`${TAG} ===== MATCH REPORT =====`);
  console.log(`${TAG} would set ${updates.length} icons:`);
  for (const u of updates.sort((a,b)=>a._name.localeCompare(b._name))) console.log(`   ${u._name}  →  ${u._fn}`);
  console.log(`${TAG} art-less but UNMATCHED (${unmatched.length}) — tell me these + I'll add mappings:`, unmatched.sort());
  if (missingIcon.length) console.log(`${TAG} MAPPED ICON FILE MISSING (${missingIcon.length}):`, missingIcon);
  console.log(`${TAG} already had custom art, left untouched: ${skipped.length}`);

  if (DRY_RUN) {
    ui.notifications?.info?.(`${TAG} DRY RUN — ${updates.length} icons matched, ${unmatched.length} art-less unmatched. Review console, then set DRY_RUN=false to apply.`);
    return;
  }
  if (!updates.length) return ui.notifications?.info?.(`${TAG} Nothing to do — no art-less items matched.`);
  if (pack.locked) { try { await pack.configure({ locked: false }); } catch (e) { return ui.notifications?.error?.(`${TAG} Pack locked; unlock + re-run.`); } }

  await Item.updateDocuments(updates.map(u => ({ _id: u._id, img: u.img })), { pack: PACK_ID });
  ui.notifications?.info?.(`${TAG} Set ${updates.length} doctrine icons. ${unmatched.length} art-less still unmatched (console).`);
  console.log(`${TAG} done — updated ${updates.length}.`);
})();
