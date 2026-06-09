function baseSpec(api, key) {
  return { family: api.familyForKey(key) };
}

function defaultVisualsForFamily(family, key) {
  const f = String(family || "martial");
  const base = {
    cinematicPhase: "resolve",
    effectMs: 2400,
    canvasRadius: 132,
    canvasMs: 1000,
    resolveOverlayMs: 950,
    impactOverlayMs: 700,
    resolveShake: "",
    impactShake: ""
  };

  if (f === "faith") return { ...base, canvasColor: 0x67d4ff, resolveOverlay: "ritual-rays", impactOverlay: "ritual-rays", canvasRadius: 140 };
  if (f === "void") return { ...base, canvasColor: 0x7a5cff, resolveOverlay: "void-fracture", impactOverlay: "void-fracture", canvasRadius: 150, impactShake: "subtle", resolveShake: "subtle" };
  if (f === "temporal") return { ...base, canvasColor: 0x6fa8ff, resolveOverlay: "temporal-ripple", impactOverlay: "temporal-ripple", canvasRadius: 146 };
  if (f === "industrial") return { ...base, canvasColor: 0xff8c42, resolveOverlay: "tactical-sweep", impactOverlay: "tactical-sweep", canvasRadius: 145 };
  if (f === "political") return { ...base, canvasColor: 0xd4af37, resolveOverlay: "mirror-flash", impactOverlay: "mirror-flash", canvasRadius: 136 };
  if (f === "boss") return { ...base, canvasColor: 0x8b1e3f, resolveOverlay: "void-fracture", impactOverlay: "void-fracture", canvasRadius: 185, resolveShake: "heavy" };
  return { ...base, canvasColor: 0xff6b4a, resolveOverlay: "assault", impactOverlay: "assault", canvasRadius: 138 };
}

function cinematicSpecs(api) {
  return {
    chrono_loop_command: {
      ...baseSpec(api, "chrono_loop_command"),
      canvasColor: 0x6fa8ff,
      canvasRadius: 150,
      impactOverlay: "temporal-ripple",
      resolveOverlay: "temporal-ripple"
    },
    sephirotic_intervention: {
      ...baseSpec(api, "sephirotic_intervention"),
      canvasColor: 0x67d4ff,
      canvasRadius: 140,
      impactOverlay: "ritual-rays",
      resolveOverlay: "ritual-rays"
    },
    void_signal_collapse: {
      ...baseSpec(api, "void_signal_collapse"),
      canvasColor: 0x7a5cff,
      canvasRadius: 155,
      impactOverlay: "void-fracture",
      resolveOverlay: "void-fracture",
      impactShake: "subtle",
      resolveShake: "subtle"
    },
    defenders_reversal: {
      ...baseSpec(api, "defenders_reversal"),
      canvasColor: 0xffc857,
      canvasRadius: 145,
      resolveOverlay: "mirror-flash",
      impactOverlay: "mirror-flash"
    },
    reality_hack: {
      ...baseSpec(api, "reality_hack"),
      canvasColor: 0x67d4ff,
      canvasRadius: 140,
      resolveOverlay: "temporal-ripple",
      impactOverlay: "temporal-ripple"
    },
    raid_outcome: {
      ...baseSpec(api, "raid_outcome"),
      canvasColor: 0xff6b4a,
      canvasRadius: 150,
      canvasMs: 760,
      resolveOverlay: "assault"
    },
    facility_damage: {
      ...baseSpec(api, "facility_damage"),
      canvasColor: 0xff8c42,
      canvasRadius: 160,
      canvasMs: 780,
      resolveOverlay: "tactical-sweep"
    },
    rig_damage: {
      ...baseSpec(api, "rig_damage"),
      canvasColor: 0xff8c42,
      canvasRadius: 155,
      canvasMs: 760,
      resolveOverlay: "tactical-sweep"
    },
    boss_phase_change: {
      ...baseSpec(api, "boss_phase_change"),
      canvasColor: 0x8b1e3f,
      canvasRadius: 195,
      canvasMs: 960,
      resolveOverlay: "void-fracture",
      resolveShake: "heavy"
    },
    infiltration_alarm: {
      ...baseSpec(api, "infiltration_alarm"),
      canvasColor: 0x7a5cff,
      canvasRadius: 130,
      impactOverlay: "infiltration",
      resolveOverlay: "infiltration"
    },
    courtly_exchange: {
      ...baseSpec(api, "courtly_exchange"),
      canvasColor: 0xd4af37,
      canvasRadius: 125,
      impactOverlay: "mirror-flash",
      resolveOverlay: "mirror-flash"
    }
  };
}

function canonicalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function aliasKeyMap() {
  return {
    defender_s_reversal: "defenders_reversal"
  };
}

function buildGenericManeuverSpecs(api) {
  const out = {};
  const aliases = aliasKeyMap();

  const registerKey = (rawKey) => {
    const key = canonicalizeKey(rawKey);
    if (!key || out[key]) return;
    const family = api.familyForKey(key);
    const visuals = defaultVisualsForFamily(family, key);
    out[key] = {
      family,
      ...visuals
    };
    const alias = aliases[key];
    if (alias && !out[alias]) {
      out[alias] = {
        ...out[key],
        key: alias
      };
    }
  };

  try {
    const agent = game.bbttcc?.api?.agent;
    const throughput = agent?.__THROUGHPUT || {};
    for (const key of Object.keys(throughput || {})) registerKey(key);
  } catch {}

  try {
    const raid = game.bbttcc?.api?.raid;
    const effects = raid?.EFFECTS || {};
    for (const [key, eff] of Object.entries(effects)) {
      if (String(eff?.kind || "") !== "maneuver") continue;
      registerKey(key);
      registerKey(eff?.unlockKey);
      registerKey(eff?.label);
    }
  } catch {}

  return out;
}

// ─── Doctrine VFX taxonomy (2026-06-09 "variety pass") ──────────────────────
// Instead of every maneuver/activity falling back to one of 7 magic-circles +
// explosions, each doctrine key gets a THEMATIC effect+burst by category:
// agrarian→nature(Entangle/healing-bloom), martial→melee weapons, siege→ordnance,
// stealth→smoke, economy→lightning/spark, etc. Effect/burst are thematic-first,
// proven-last arrays — fx-api.resolveKey() plays the first key that resolves in
// this world's Sequencer DB and degrades to the proven final entry, so variety is
// additive and never breaks. `fam` = the existing family for overlay/tone/color base.
const DOC_CAT_OVERRIDE = {
  dark_harvest: "void", apocalyptic_weapon_test: "void", found_site_research: "temporal",
  found_site_temple: "faith", found_site_farm: "agrarian", found_site_mine: "economy",
  found_site_port: "economy", found_site_fortress: "fortify", local_festival: "agrarian",
  world_reformation_council: "faith", dragon_s_parley: "void", repair_rig: "fortify",
  reconstruction_drive: "agrarian", terrain_calibration: "agrarian", faultline_tuning: "agrarian",
  optact_ritual_binding: "faith", optact_cultural_diffusion: "political", optact_operational_cohesion: "martial",
  civic_audit: "stealth", crown_of_mercy: "faith", engine_of_absolution: "faith",
  psychic_disruption: "void", sympathetic_stabilization: "faith", opt_psychological_pressure: "political",
  upgrade_outpost_settlement: "economy"
};

function doctrineCategory(key, name = "") {
  const k = String(key || "");
  if (DOC_CAT_OVERRIDE[k]) return DOC_CAT_OVERRIDE[k];
  const s = (k + " " + name).toLowerCase();
  const has = (...w) => w.some((x) => s.includes(x));
  if (has("courtly","propaganda","diplomat","cultural","festival","loyalty","peace","toast","forged_letter","doubt","mask_off","patron","call_question","read_the_room","eavesdrop","sidle","stage_distract","whispered","tensions","policy_reform","psych_ops","moral_high","flash_bargain","flash_interdict","intrigue_council","alliance_summit","crisis_summit","exchange")) return "political";
  if (has("farm","harvest","eden","terraform","reconstruct","pilgrim","ration_distribut","charity","sanctum","outpost","garden")) return "agrarian";
  if (has("qliph","void","ego","infernal","oblivion","apocalyptic")) return "void";
  if (has("chrono","reality","temporal","quantum")) return "temporal";
  if (has("bless","mercy","divine","faithful","chaplain","harmonic","prayer","radiant","sephirot","absolution","empath","unity","alignment","purif","judgment","inquisi","great_work","final_weave","temple","enlighten","reformation","justice")) return "faith";
  if (has("shadow","ghost","conceal","disable_alarm","distract","impersonate","pick_lock","smoke","tailgate","signal_hijack","sabote","subdue","gather_intel","spy_insert","recon","bypass","infiltrat")) return "stealth";
  if (has("artillery","siege","suppressive","crack_the_keep","sap_the_walls","echo_strike")) return "siege";
  if (has("fortif","repair","entrench","take_cover","shore_the_gate","patch_the_breach","perimeter","patrol","border","training","secure")) return "fortify";
  if (has("industr","overclock","gradient","war_chest","supply","trade","smuggl","expropriat","mine","port","infrastructure","logistic","mobiliz","resupply")) return "economy";
  if (has("flank","coordinated","sortie","last_stand","rally","command","faction_wide","reversal","overwatch","advance","cohesion","strike")) return "martial";
  return "martial";
}

// category → { fam, color, [overlay], effect[], burst[] }. Arrays thematic-first, proven-last.
// Keys verified against the live install via probe-jb2a-keys.macro.js (2026-06-09).
// Arrays stay thematic-first, proven-last: resolveKey plays the first that exists.
const DOC_FX = {
  agrarian:  { fam: "faith",      color: 0x6fbf4b, effect: ["jb2a.entangle.02.complete.02.green", "jb2a.entangle.green", "jb2a.magic_signs.circle.02.transmutation.complete.blue"], burst: ["jb2a.cure_wounds.400px.green", "jb2a.healing_generic.400px.green", "jb2a.particle_burst.01.circle.bluepurple"] },
  martial:   { fam: "martial",    color: 0xff6b4a, effect: ["jb2a.greatsword.melee.standard.white", "jb2a.sword.melee.01.blue", "jb2a.mace.melee.01.orange", "jb2a.magic_signs.circle.02.abjuration.complete.red"], burst: ["jb2a.impact.001.orange", "jb2a.impact.001.red", "jb2a.explosion.01.orange"] },
  siege:     { fam: "industrial", color: 0xff8c42, effect: ["jb2a.boulder.siege.01", "jb2a.boulder.toss.01", "jb2a.magic_signs.circle.02.conjuration.complete.dark_red"], burst: ["jb2a.explosion.08.orange", "jb2a.impact.ground_crack.orange.01", "jb2a.explosion.02.orange"] },
  faith:     { fam: "faith",      color: 0x67d4ff, effect: ["jb2a.cure_wounds.400px.blue", "jb2a.healing_generic.400px.blue", "jb2a.magic_signs.circle.02.divination.complete.blue"], burst: ["jb2a.explosion.01.yellow", "jb2a.particle_burst.01.star.yellow"] },
  void:      { fam: "void",       color: 0x7a5cff, effect: ["jb2a.energy_strands.in.purple.01", "jb2a.toll_the_dead.grey.skull_smoke", "jb2a.magic_signs.circle.02.necromancy.complete.dark_purple"], burst: ["jb2a.explosion.01.purple", "jb2a.explosion.02.purple"] },
  temporal:  { fam: "temporal",   color: 0x6fa8ff, effect: ["jb2a.portals.horizontal.ring.blue", "jb2a.magic_signs.circle.02.evocation.complete.blue"], burst: ["jb2a.particle_burst.01.circle.bluepurple", "jb2a.explosion.01.blue"] },
  political: { fam: "political",  color: 0xd4af37, effect: ["jb2a.magic_signs.circle.02.enchantment.complete.yellow", "jb2a.magic_signs.circle.02.enchantment.complete.purple"], burst: ["jb2a.particle_burst.01.star.yellow", "jb2a.explosion.01.yellow"] },
  stealth:   { fam: "void",       color: 0x2dd4bf, overlay: "infiltration", effect: ["jb2a.smoke.puff.centered.dark_black", "jb2a.smoke.puff.centered.grey", "jb2a.magic_signs.circle.02.necromancy.complete.purple"], burst: ["jb2a.smoke.puff.side.02.dark_black", "jb2a.particle_burst.01.circle.bluepurple"] },
  economy:   { fam: "industrial", color: 0xffb347, effect: ["jb2a.lightning_strike.blue", "jb2a.chain_lightning.primary.blue", "jb2a.magic_signs.circle.02.conjuration.complete.dark_red"], burst: ["jb2a.static_electricity.01.blue", "jb2a.explosion.02.orange"] },
  fortify:   { fam: "martial",    color: 0x6fb3ff, effect: ["jb2a.shield.01.intro.blue", "jb2a.magic_signs.circle.02.abjuration.complete.blue"], burst: ["jb2a.explosion.01.blue", "jb2a.particle_burst.01.circle.bluepurple"] }
};

// Signature per-key flourishes — override the category effect/burst for iconic doctrines.
// Signatures — verified keys (probe 2026-06-09), each ending in a proven circle/explosion.
const DOC_SIG = {
  ego_dragon_echo:      { effect: ["jb2a.eruption.orange.01", "jb2a.magic_signs.circle.02.necromancy.complete.dark_red"], burst: ["jb2a.explosion.08.orange", "jb2a.explosion.02.purple"] },
  project_eden:         { effect: ["jb2a.entangle.02.complete.02.green", "jb2a.entangle.green", "jb2a.magic_signs.circle.02.transmutation.complete.blue"], burst: ["jb2a.cure_wounds.400px.green", "jb2a.particle_burst.01.circle.bluepurple"] },
  harvest_season:       { effect: ["jb2a.entangle.green02", "jb2a.entangle.02.complete.02.green", "jb2a.magic_signs.circle.02.transmutation.complete.blue"], burst: ["jb2a.particle_burst.01.star.yellow", "jb2a.explosion.01.yellow"] },
  artillery_salvo:      { effect: ["jb2a.boulder.toss.02.01.lava.orange", "jb2a.boulder.siege.01", "jb2a.magic_signs.circle.02.conjuration.complete.dark_red"], burst: ["jb2a.explosion.08.orange", "jb2a.explosion.02.orange"] },
  siege_breaker_volley: { effect: ["jb2a.boulder.siege.02", "jb2a.boulder.toss.01", "jb2a.magic_signs.circle.02.conjuration.complete.dark_red"], burst: ["jb2a.impact.ground_crack.orange.01", "jb2a.explosion.02.orange"] },
  flank_attack:         { effect: ["jb2a.dagger.melee.02.white", "jb2a.sword.melee.01.blue", "jb2a.magic_signs.circle.02.abjuration.complete.red"], burst: ["jb2a.impact.001.red", "jb2a.explosion.01.orange"] },
  overclock_the_golems: { effect: ["jb2a.chain_lightning.primary.blue", "jb2a.lightning_strike.blue", "jb2a.magic_signs.circle.02.conjuration.complete.dark_red"], burst: ["jb2a.static_electricity.01.blue", "jb2a.explosion.02.orange"] },
  smoke_and_mirrors:    { effect: ["jb2a.smoke.puff.centered.grey", "jb2a.smoke.puff.centered.dark_black", "jb2a.magic_signs.circle.02.necromancy.complete.purple"], burst: ["jb2a.smoke.puff.side.02.dark_black", "jb2a.particle_burst.01.circle.bluepurple"] },
  void_signal_collapse: { effect: ["jb2a.energy_strands.in.purple.01", "jb2a.magic_signs.circle.02.necromancy.complete.dark_purple"], burst: ["jb2a.explosion.02.purple"] },
  qliphothic_gambit:    { effect: ["jb2a.energy_strands.in.purple.01", "jb2a.toll_the_dead.grey.skull_smoke", "jb2a.magic_signs.circle.02.necromancy.complete.dark_purple"], burst: ["jb2a.explosion.02.purple", "jb2a.explosion.01.purple"] }
};

// All 87 maneuvers + 74 strategic activities (live Ember doctrines pack, 2026-06-09).
// Registered explicitly so every key gets a thematic spec regardless of runtime discovery.
const DOCTRINE_KEYS = [
  "alignment_shift", "alliance_summit", "apocalyptic_weapon_test", "artillery_salvo",
  "auto_recon_sweep", "bless_the_fallen", "border_patrol", "bypass_obstacle",
  "charity_drive", "chrono_loop_command", "civic_audit", "command_overdrive",
  "conceal_body", "coordinated_strike", "counter_propaganda_wave", "courtly_call_question",
  "courtly_eavesdrop", "courtly_forged_letter", "courtly_intrigue_council", "courtly_mask_off",
  "courtly_patrons_word", "courtly_plant_a_doubt", "courtly_public_toast", "courtly_quote_old_law",
  "courtly_read_the_room", "courtly_sidle_closer", "courtly_stage_distraction", "courtly_whispered_aside",
  "crack_the_keep", "crisis_summit", "crown_of_mercy", "cultural_exchange",
  "cultural_festival_std", "cultural_offensive", "dark_harvest", "defender_s_reversal",
  "defensive_entrenchment", "defuse_tensions", "develop_infrastructure_std", "develop_outpost_stability",
  "diplomatic_channel", "diplomatic_mission_std", "disable_alarm", "distract",
  "divine_favor", "dragon_s_parley", "echo_strike_protocol", "ego_breaker",
  "ego_dragon_echo", "empathic_surge", "engine_of_absolution", "enlightenment_congress",
  "establish_outpost", "establish_supply_line", "establish_trade_route", "faction_wide_rally",
  "faithful_intervention", "faultline_tuning", "field_chaplaincy", "flank_attack",
  "flash_bargain", "flash_interdict", "fortify_hex", "forward_resupply",
  "found_site_farm", "found_site_fortress", "found_site_mine", "found_site_port",
  "found_site_research", "found_site_temple", "gather_intel", "ghost_slip_infiltration",
  "gradient_surge", "great_work_ritual", "harmonic_chant", "harvest_season",
  "hide_in_shadow", "impersonate", "industrial_revolution", "industrial_sabotage",
  "infrastructure_expansion", "inquisition_mandate", "judgment_of_light", "justice_tribunal",
  "last_stand_banner", "local_festival", "logistical_surge", "logistics_surge_s2",
  "loyalty_program", "mass_mobilization", "minor_repair", "moral_high_ground",
  "oblivion_protocol", "opt_coordinated_advance", "opt_infernal_bargain", "opt_psychological_pressure",
  "optact_cultural_diffusion", "optact_operational_cohesion", "optact_ritual_binding", "overclock_the_golems",
  "patch_the_breach", "patrol_routes", "peace_accords", "pick_lock",
  "pilgrimage_route", "policy_reforms", "prayer_in_the_smoke", "prayer_pulse",
  "project_eden", "propaganda_campaign", "propaganda_tour", "psych_ops_broadcast",
  "psychic_disruption", "purification_rite", "qliphothic_gambit", "quantum_shield",
  "radiant_retaliation", "rally_the_line", "ration_distribution", "reality_hack",
  "recon_sweep", "reconstruction_drive", "repair_fortifications", "repair_rig",
  "resource_expropriation", "saboteur_s_edge", "sanctum_expansion", "sap_the_walls",
  "secure_perimeter", "sephirotic_intervention", "shore_the_gate", "siege_breaker_volley",
  "siege_logistics_overhaul", "signal_hijack", "smoke_and_mirrors", "smuggling_network",
  "sortie_en_masse", "spy_insertion", "subdue_nonlethal", "supply_cache",
  "supply_depot", "supply_overrun", "supply_surge", "suppressive_fire",
  "suppressive_volley", "sympathetic_stabilization", "tactical_overwatch", "tailgate",
  "take_cover", "temporal_armistice", "terraforming_project", "terrain_calibration",
  "the_final_weave", "total_mobilization", "training_drills", "training_parade",
  "unity_surge", "upgrade_outpost_settlement", "void_signal_collapse", "war_chest",
  "world_reformation_council"
];

function doctrineSpec(key, name = "") {
  const cat = doctrineCategory(key, name);
  const fx = DOC_FX[cat] || DOC_FX.martial;
  const sig = DOC_SIG[key] || {};
  return {
    family: fx.fam,
    ...defaultVisualsForFamily(fx.fam, key),
    canvasColor: fx.color,
    ...(fx.overlay ? { impactOverlay: fx.overlay, resolveOverlay: fx.overlay } : {}),
    effect: sig.effect || fx.effect,
    burst: sig.burst || fx.burst,
    category: cat
  };
}

// Courtly Secrets — played via the courtly HUD (api.playSecret → bbttcc:courtly:vfx
// "secret-play"); raid-courtly.vfx.js fires fx.playKey(effectKey) on the player's token.
// Political/gold base with a per-secret flourish; new effectKeys fall back to the generic
// "courtly_secret" (also registered) via the handler's default. Keys probe-verified.
const COURTLY_SECRET_FX = {
  clearScandal:   { family: "political", canvasColor: 0xffd54a, effect: ["jb2a.healing_generic.400px.yellow", "jb2a.magic_signs.circle.02.enchantment.complete.yellow"], burst: ["jb2a.particle_burst.01.star.yellow", "jb2a.explosion.01.yellow"] },          // Royal Pardon — a cleansing gold pardon
  influenceDmg2:  { family: "political", canvasColor: 0xc792ea, effect: ["jb2a.magic_signs.circle.02.enchantment.complete.purple", "jb2a.magic_signs.circle.02.enchantment.complete.yellow"], burst: ["jb2a.explosion.01.purple", "jb2a.particle_burst.01.star.yellow"] }, // Compromising Letter — a cutting exposure
  rollPlus2:      { family: "political", canvasColor: 0xd4af37, effect: ["jb2a.magic_signs.circle.02.enchantment.complete.yellow"], burst: ["jb2a.particle_burst.01.star.yellow"] },                                                                          // Cabinet Whisper — an intel edge
  courtly_secret: { family: "political", canvasColor: 0xd4af37, effect: ["jb2a.magic_signs.circle.02.enchantment.complete.yellow"], burst: ["jb2a.particle_burst.01.star.yellow"] }                                                                           // generic fallback for future secrets
};

// Exposed for the verify-doctrine-vfx macro (offline coverage report).
export const DOCTRINE_FX_API = { DOCTRINE_KEYS, doctrineCategory, doctrineSpec, DOC_FX, DOC_SIG, COURTLY_SECRET_FX };

export async function installRegistry(api) {
  const agent = game.bbttcc?.api?.agent;
  let throughput = {};
  try {
    throughput = agent?.__THROUGHPUT || {};
  } catch {}

  for (const key of Object.keys(throughput || {})) {
    api.register(key, baseSpec(api, key));
  }

  [
    "raid_outcome",
    "facility_damage",
    "rig_damage",
    "boss_phase_change",
    "turn_start",
    "turn_end",
    "turn_weather",
    "turn_loyalty",
    "turn_morale",
    "turn_darkness",
    "turn_build_units",
    "turn_trade_routes",
    "turn_logistics_pressure",
    "infiltration_alarm",
    "courtly_exchange"
  ].forEach((key) => api.register(key, baseSpec(api, key)));

  const generic = buildGenericManeuverSpecs(api);
  for (const [key, spec] of Object.entries(generic)) api.register(key, spec);

  const specs = cinematicSpecs(api);
  for (const [key, spec] of Object.entries(specs)) api.register(key, spec);

  // Doctrine VFX variety pass (2026-06-09) — register a thematic effect/burst spec
  // for every maneuver + strategic activity. Runs LAST so the per-key recipes win
  // over the family-only generic specs. Covers the static 161-key list plus any
  // maneuver discovered at runtime from raid.EFFECTS (handles future additions).
  for (const key of DOCTRINE_KEYS) {
    api.register(key, doctrineSpec(key));
    const canon = canonicalizeKey(key);
    if (canon && canon !== key) api.register(canon, doctrineSpec(key));
  }
  try {
    const raid = game.bbttcc?.api?.raid;
    const effects = raid?.EFFECTS || {};
    for (const [key, eff] of Object.entries(effects)) {
      if (!key) continue;
      const canon = canonicalizeKey(key);
      if (!api.get(canon) || !api.get(canon)?.effect) api.register(canon, doctrineSpec(canon, eff?.label || ""));
    }
  } catch {}

  // Courtly Secrets — register a thematic spec per known secret effectKey.
  for (const [key, spec] of Object.entries(COURTLY_SECRET_FX)) {
    api.register(key, { ...defaultVisualsForFamily(spec.family, key), ...spec, category: "courtly-secret" });
  }
}
