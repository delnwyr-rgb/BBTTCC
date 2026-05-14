// bbttcc-raid/scripts/boss/bosses.gloomgill.js
// FULL REPLACEMENT — Gloomgill the Accountable (Boss v1.1)
//
// Purpose:
//  - Registers Gloomgill on world load (no console injection).
//  - Uses rig/facility-style damage ladder (hitTrack + persisted bossState).
//  - Adds schema-v1 behavior examples that drive World Effects (Faction deltas + war logs).
//
// Requirements:
//  - bossRegistry.js v2+ (preserves hitTrack + schema behaviors)
//  - applyBehaviors.js v2+ (supports when/effects/endRaid)
//  - worldMutation engine v2.1+ (accepts raw worldEffects OR beat wrapper; applies factionEffects + warLog)

Hooks.once("ready", () => {
  try {
    const raid = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid) ? game.bbttcc.api.raid : null;
    const bossApi = raid && raid.boss ? raid.boss : null;
    if (!bossApi || typeof bossApi.registerBoss !== "function") return;

    bossApi.registerBoss("gloomgill", {
      label: "Gloomgill the Accountable",
      mode: "hybrid",
      tags: ["qliphothic","megafauna","audit","coast"],

      // Canonical rig/facility-style ladder
      hitTrack: ["shaken","wounded","broken","banished"],

      // Flavor statline (optional; can be used by opDrain and future AI)
      stats: { violence: 10, intrigue: 4, softpower: 0 },

      behaviors: [
        // -------------------------------------------------------------------
        // Legacy behavior keys (back-compat)
        // -------------------------------------------------------------------
        { key: "darkness_pulse_on_round_win", phase: "round_end", amount: 1, scope: "regional" },
        { key: "op_drain_on_nat_19_20", phase: "after_roll", amount: 1 },

        // -------------------------------------------------------------------
        // NEW: Boss Win Pressure (schema v1) — proves "boss maneuvers = world effects"
        // Runs only when Gloomgill wins a round (bossWon = defenderWon).
        // Applies morale -1 and darkness +1 to the attacker faction (factionId auto-filled).
        // -------------------------------------------------------------------
        {
          id: "bossWinPressure",
          label: "Audit Pressure (Boss Win)",
          phase: "round_end",
          when: { bossWon: true },
          log: { whisperGM: "Gloomgill wins the exchange. The ledger closes like a jaw." },
          effects: {
            worldEffects: {
              factionEffects: [
                { moraleDelta: -1, darknessDelta: 1 }
              ],
              warLog: "Gloomgill’s audit pulse tightens. Morale -1. Darkness +1."
            }
          }
        },

        // Optional variant: Great Success escalation (boss wins by 5+)
        {
          id: "bossWinPressureGreat",
          label: "Catastrophic Audit (Boss Great Success)",
          phase: "round_end",
          when: { bossWon: true, greatSuccess: true },
          log: { whisperGM: "Catastrophic audit: the books close, and something screams underwater." },
          effects: {
            worldEffects: {
              factionEffects: [
                { moraleDelta: -2, darknessDelta: 2 }
              ],
              warLog: "A catastrophic audit. Morale -2. Darkness +2."
            }
          }
        },

        // -------------------------------------------------------------------
        // Existing schema v1 example: retreat when BROKEN (damageStep >= 3)
        // -------------------------------------------------------------------
        {
          id: "retreatWhenBroken",
          phase: "round_end",
          when: { damageStepGE: 3 },
          endRaid: { outcome: "retreated" },
          effects: {
            worldEffects: {
              warLog: "Gloomgill submerges, filing your debt for later."
            }
          }
        }
      ]
    });

    console.log("[bbttcc-raid/bosses] Gloomgill registered (v1.1).");
  } catch (e) {
    console.warn("[bbttcc-raid/bosses] Gloomgill registration failed", e);
  }
});
