// scripts/maneuvers-sprint3a-content.enhancer.js
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 3a.3 content for MANEUVER_CATALOG_SPEC.md §11: 10 new anytime
// maneuvers for the modernized Infiltration scenario. Each emits a
// scenarioEffects payload calling the S3a.1/S3a.2/S3a.3 engine verbs.
//
// Compact data-table form: shared defaults in D, per-maneuver overrides in
// RAW, build helper expands each into the same shape S2 maneuvers use.
//
// Coverage:
//   Alarm reducers: hide_in_shadow (T1) · take_cover (T2) · distract (T2) ·
//                   disable_alarm (T3)
//   Progress drivers: pick_lock (T1) · bypass_obstacle (T2)
//   Body chain: subdue_nonlethal (T2) · conceal_body (T1)
//   Risk/reward: tailgate (T2, progress+alarmRise) ·
//                impersonate (T3, progress+alarmDecay, cross-pool Presence)
//
// Per [[feedback_bbttcc_api_exposure_pattern]] all registration is installed
// twice: script-load + Hooks.once("ready") to survive cache/load-order races.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const TAG = "[bbttcc-raid:s3a-content]";

  // Shared defaults — all S3a.3 maneuvers are Infiltration anytime/tactical/intrigue.
  const D = {
    engine: "intrigue",
    raidTypes: ["infiltration_alarm"],
    layer: "tactical",
    fireMode: "anytime"
  };

  // Compact authoring: per-entry overrides only. `effects` becomes scenarioEffects.
  const RAW = [
    { key: "hide_in_shadow", label: "Hide in Shadow", tier: 1, costBand: "light",
      cost: { intrigue: 10 },
      effectsText: "Slip into cover: -1 alarm.",
      description: "<p>The infiltrators melt into shadow, breaking the patrol's line of sight. <b>-1 alarm.</b></p>",
      effects: [{ type: "alarmDecay", delta: 1, reason: "Hide in Shadow" }] },

    { key: "take_cover", label: "Take Cover", tier: 2, costBand: "medium",
      cost: { intrigue: 20 },
      effectsText: "Press against an obstacle: -2 alarm.",
      description: "<p>Hard cover breaks the patrol's silhouette read entirely. <b>-2 alarm.</b></p>",
      effects: [{ type: "alarmDecay", delta: 2, reason: "Take Cover" }] },

    { key: "distract", label: "Distract", tier: 2, costBand: "medium",
      cost: { intrigue: 20 },
      effectsText: "Pull attention away: -2 alarm.",
      description: "<p>A thrown bauble, a feigned cough — patrol eyes track the wrong direction for a beat. <b>-2 alarm.</b></p>",
      effects: [{ type: "alarmDecay", delta: 2, reason: "Distract" }] },

    { key: "disable_alarm", label: "Disable Alarm", tier: 3, costBand: "medium",
      cost: { intrigue: 30 },
      effectsText: "Sabotage the alert system: -3 alarm.",
      description: "<p>Tinkering hands silence a tripwire, a sensor, a bell. <b>-3 alarm.</b></p>",
      effects: [{ type: "alarmDecay", delta: 3, reason: "Disable Alarm" }] },

    { key: "pick_lock", label: "Pick Lock", tier: 1, costBand: "light",
      // Explicitly canonical intrigue (not only the infiltration_alarm scenario alias)
      // so it surfaces in any Intrigue raid, scenario or not. 2026-06-21.
      raidTypes: ["infiltration_alarm", "intrigue"],
      cost: { intrigue: 10 },
      effectsText: "Bypass a barrier: +1 progress.",
      description: "<p>A barrier yields to patient hands. <b>+1 progress toward the objective.</b></p>",
      effects: [{ type: "progressDelta", delta: 1 }] },

    { key: "bypass_obstacle", label: "Bypass Obstacle", tier: 2, costBand: "medium",
      cost: { intrigue: 20 },
      effectsText: "Open the way: +2 progress.",
      description: "<p>A clever route around the guards, the wall, the warded door. <b>+2 progress.</b></p>",
      effects: [{ type: "progressDelta", delta: 2 }] },

    { key: "subdue_nonlethal", label: "Subdue (Non-Lethal)", tier: 2, costBand: "light",
      cost: { intrigue: 10, violence: 10 },
      effectsText: "Knock out a guard; body is findable in 2 rounds.",
      description: "<p>A chokehold, a sandbag, a fast hand at the throat — a guard goes down silent. <b>If left for 2 rounds, alarm spikes +3.</b> Chain with <i>Conceal Body</i> to buy time.</p>",
      effects: [{ type: "bodyDiscovery", turns: 2, alarmGain: 3, note: "subdued guard" }] },

    { key: "conceal_body", label: "Conceal Body", tier: 1, costBand: "light",
      cost: { intrigue: 10 },
      effectsText: "Hide a downed guard: +2 turns, -2 alarm on discovery.",
      description: "<p>Drag the unconscious guard into a closet, a shadow, a crate. <b>Extends the discovery window by 2 rounds and reduces the eventual alarm spike by 2.</b> Use right after <i>Subdue (Non-Lethal)</i>.</p>",
      effects: [{ type: "extendDiscovery", extraTurns: 2, alarmReduction: 2 }] },

    { key: "tailgate", label: "Tailgate", tier: 2, costBand: "light",
      cost: { intrigue: 10 },
      effectsText: "Slip past behind a patrol: +2 progress, +1 alarm (risk).",
      description: "<p>Time the gait, match the cadence, breathe shallow. Cheap progress, but the risk is real. <b>+2 progress, +1 alarm.</b></p>",
      effects: [
        { type: "progressDelta", delta: 2 },
        { type: "alarmRise", delta: 1, reason: "Tailgate exposure" }
      ] },

    { key: "impersonate", label: "Impersonate", tier: 3, costBand: "medium",
      cost: { diplomacy: 20, intrigue: 10 },
      effectsText: "Bluff past a checkpoint: +2 progress, -1 alarm.",
      description: "<p>The right uniform, the right paperwork, the right confidence. <b>+2 progress, -1 alarm</b> — a Presence-driven infiltration win.</p>",
      effects: [
        { type: "progressDelta", delta: 2 },
        { type: "alarmDecay", delta: 1, reason: "Impersonation cover" }
      ] }
  ];

  // ── Build full entries from RAW + D ──────────────────────────────────────
  const SPRINT3A_MANEUVERS = RAW.map(m => ({
    ...D, ...m,
    throughput: function (ctx) {
      return {
        scenarioEffects: foundry.utils.deepClone(m.effects),
        meta: { source: "throughput", maneuverKey: m.key, preview: true }
      };
    }
  }));

  // ── Registration (mirrors S2 pattern) ────────────────────────────────────
  function _register() {
    const raid = game.bbttcc?.api?.raid;
    const agent = game.bbttcc?.api?.agent;
    if (!raid?.EFFECTS) return false;

    const EFFECTS = raid.EFFECTS;
    const THROUGHPUT = agent?.__THROUGHPUT || null;

    let added = 0;
    for (const m of SPRINT3A_MANEUVERS) {
      EFFECTS[m.key] = {
        kind: "maneuver",
        key: m.key,
        label: m.label,
        tier: m.tier,
        raidTypes: m.raidTypes.slice(),
        cost: foundry.utils.deepClone(m.cost),
        fireMode: m.fireMode,
        text: m.effectsText,
        meta: {
          tier: m.tier,
          engine: m.engine,
          layer: m.layer,
          costBand: m.costBand,
          authoredSprint: "3a",
          availability: "standard"
        }
      };
      if (THROUGHPUT && typeof m.throughput === "function") {
        THROUGHPUT[m.key] = m.throughput;
      }
      added++;
    }

    raid.sprint3aManeuvers = SPRINT3A_MANEUVERS;
    console.log(TAG, `registered ${added} maneuvers; tiers:`,
      SPRINT3A_MANEUVERS.reduce((a, m) => (a[`T${m.tier}`] = (a[`T${m.tier}`] || 0) + 1, a), {})
    );
    return true;
  }

  // Two-pass install (script-load + ready)
  if (!_register()) {
    Hooks.once("ready", () => Promise.resolve().then(_register));
  } else {
    Hooks.once("ready", () => Promise.resolve().then(_register));
  }
})();
