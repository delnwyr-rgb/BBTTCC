/* effects-fire-mode-tags.js
 *
 * Phase 4C — Maneuver Fire-Mode Tagging.
 *
 * Loads after compat-bridge.js publishes EFFECTS. Stamps each known
 * maneuver with an explicit `fireMode ∈ {"pre-roll","anytime","post-commit"}`.
 *
 * fireMode semantics:
 *   pre-roll    → fires BEFORE strategic dice commit (modifies the roll)
 *   anytime     → standalone state change, decoupled from dice
 *   post-commit → triggered by round outcome (on success / next round / etc.)
 *
 * Tags were derived from the audit-maneuvers-fire-mode.macro.js heuristic
 * classifier with 2 manual overrides (flank_attack, qliphothic_gambit).
 * Untagged entries fall through to runtime classifier:
 *   game.fourththing.api.maneuvers.inferFireMode(eff)
 */

const FIRE_MODE_TAGS = {
  // ── pre-roll (24): modify dice / DCs / re-roll / advantage / cancel-enemy
  defensive_entrenchment:   "pre-roll",
  flash_bargain:            "pre-roll",
  flash_interdict:          "pre-roll",
  flank_attack:             "pre-roll", // manual override (no keyword in text)
  ghost_slip_infiltration:  "pre-roll",
  gradient_surge:           "pre-roll",
  last_stand_banner:        "pre-roll",
  prayer_in_the_smoke:      "pre-roll",
  qliphothic_gambit:        "pre-roll", // manual override (insurance)
  rally_the_line:           "pre-roll",
  supply_surge:             "pre-roll",
  suppressive_fire:         "pre-roll",
  bless_the_fallen:         "pre-roll",
  psychic_disruption:       "pre-roll",
  saboteur_s_edge:          "pre-roll",
  tactical_overwatch:       "pre-roll",
  chrono_loop_command:      "pre-roll",
  counter_propaganda_wave:  "pre-roll",
  defender_s_reversal:      "pre-roll",
  echo_strike_protocol:     "pre-roll",
  harmonic_chant:           "pre-roll",
  overclock_the_golems:     "pre-roll",
  quantum_shield:           "pre-roll",
  ego_dragon_echo:          "pre-roll",
  sephirotic_intervention:  "pre-roll",
  void_signal_collapse:     "pre-roll",

  // ── anytime (11): pure state changes (alarm/darkness/structure/etc.)
  patch_the_breach:         "anytime",
  smoke_and_mirrors:        "anytime",
  faithful_intervention:    "anytime",
  industrial_sabotage:      "anytime",
  signal_hijack:            "anytime",
  radiant_retaliation:      "anytime",
  siege_breaker_volley:     "anytime",
  ego_breaker:              "anytime",
  engine_of_absolution:     "anytime",
  temporal_armistice:       "anytime",

  // ── courtly anytimes (12, Phase D) per COURTLY_INTRIGUE_SPEC.md §5
  courtly_whispered_aside:  "anytime",
  courtly_public_toast:     "anytime",
  courtly_plant_a_doubt:    "anytime",
  courtly_quote_old_law:    "anytime",
  courtly_read_the_room:    "anytime",
  courtly_stage_distraction:"anytime",
  courtly_forged_letter:    "anytime",
  courtly_sidle_closer:     "anytime",
  courtly_eavesdrop:        "anytime",
  courtly_call_question:    "anytime",
  courtly_patrons_word:     "anytime",
  courtly_mask_off:         "anytime",

  // ── post-commit (12): triggered by round outcome
  // battlefield_harmony + radiant_rally RETIRED 2026-05-24 (merged into rally_the_line, §3.C)
  divine_favor:             "post-commit",
  supply_overrun:           "post-commit",
  sympathetic_stabilization: "post-commit",
  command_overdrive:        "post-commit",
  empathic_surge:           "post-commit",
  logistical_surge:         "post-commit",
  moral_high_ground:        "post-commit",
  crown_of_mercy:           "post-commit",
  reality_hack:             "post-commit",
  unity_surge:              "post-commit",
};

function applyFireModeTags() {
  const raid = game.bbttcc?.api?.raid;
  const EFFECTS = raid?.EFFECTS;
  if (!EFFECTS) {
    console.warn("[bbttcc-raid:fire-mode-tags] EFFECTS unavailable — skipping tag pass");
    return;
  }

  let tagged = 0, alreadyTagged = 0, missing = 0;
  for (const [key, mode] of Object.entries(FIRE_MODE_TAGS)) {
    const eff = EFFECTS[key];
    if (!eff) { missing++; continue; }
    if (eff.fireMode) { alreadyTagged++; continue; }
    eff.fireMode = mode;
    tagged++;
  }

  const total = Object.keys(EFFECTS).filter(k => EFFECTS[k]?.kind === "maneuver").length;
  const untagged = Object.values(EFFECTS).filter(e => e?.kind === "maneuver" && !e.fireMode).length;
  console.log(
    `[bbttcc-raid:fire-mode-tags] tagged ${tagged} / pre-tagged ${alreadyTagged} / missing-from-EFFECTS ${missing} · ` +
    `${total} maneuvers in registry · ${untagged} still untagged (will runtime-classify)`
  );
}

Hooks.once("ready", () => {
  // Multi-pass deferred apply (2026-05-15 fix for load-order gap):
  //   - Pass 1 (microtask): tags keys in compat-bridge's static EFFECTS (~11 maneuvers).
  //   - Pass 2 (300ms): tags keys injected by bbttcc-raid-maneuvers-loader from
  //     data/bbttcc_maneuvers_v1_4.json (~40 more), whose setTimeout(..., 150) fires
  //     AFTER our microtask.
  //   - Pass 3 (1500ms): safety net for any late attachers.
  // applyFireModeTags is idempotent (`if (eff.fireMode) continue;`) so re-passes
  // only fill gaps — they don't clobber already-tagged entries.
  Promise.resolve().then(applyFireModeTags);
  setTimeout(applyFireModeTags, 300);
  setTimeout(applyFireModeTags, 1500);
});

export { FIRE_MODE_TAGS, applyFireModeTags };
