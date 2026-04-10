// modules/bbttcc-raid/scripts/boss/boss-powers.js
// Canonical Boss Powers (behavior snippets) + Power Packs
// v3: Promotes Gloomgill bespoke behaviors into the canonical list so they can be reused everywhere.
//
// ESModule-safe. Exposed at game.bbttcc.api.raid.{bossPowers,bossPowerPacks} for convenience.
//
// NOTE: Behaviors align to the Boss Behavior schema currently supported by your boss engine:
//  - phase: "round_start" | "after_roll" | "round_end"
//  - when: object (engine-resolved booleans/thresholds)
//  - effects.worldEffects: object consumed by World Mutation Engine
//  - endRaid: { outcome } optional
//
// IMPORTANT: Several legacy Gloomgill behaviors in existing bosses use identifiers like:
//  - id: "bossWinPressure" / "bossWinPressureGreat"
//  - key: "darkness_pulse_on_round_win" / "op_drain_on_nat_19_20" / "retreatWhenBroken"
// We intentionally set power.key to those legacy identifiers so Normalize can map them safely.

export const BOSS_POWERS = [
  // -------------------------------------------------------------------------
  // Core “new canon” powers (from v2)
  // -------------------------------------------------------------------------
  {
    key: "audit_pressure",
    label: "Audit Pressure",
    description: "When the boss wins a round, the ledger bites. Morale drops. Darkness rises.",
    behavior: {
      id: "auditPressure",
      label: "Audit Pressure (Boss Win)",
      phase: "round_end",
      when: { bossWon: true },
      log: { whisperGM: "The books close like a jaw." },
      effects: {
        worldEffects: {
          factionEffects: [{ moraleDelta: -1, darknessDelta: 1 }],
          warLog: "The boss wins the exchange. Morale -1. Darkness +1."
        }
      }
    }
  },

  {
    key: "catastrophic_audit",
    label: "Catastrophic Audit",
    description: "On a boss great success, the pressure spikes. This is the ‘no appeal’ clause.",
    behavior: {
      id: "catastrophicAudit",
      label: "Catastrophic Audit (Boss Great Success)",
      phase: "round_end",
      when: { bossWon: true, greatSuccess: true },
      log: { whisperGM: "Catastrophic audit: the ink runs like blood." },
      effects: {
        worldEffects: {
          factionEffects: [{ moraleDelta: -2, darknessDelta: 2 }],
          warLog: "A catastrophic audit. Morale -2. Darkness +2."
        }
      }
    }
  },

  {
    key: "unity_crack",
    label: "Unity Crack",
    description: "Failures strain the coalition. Allies stop looking each other in the eye.",
    behavior: {
      id: "unityCrack",
      label: "Unity Crack (On Fail)",
      phase: "round_end",
      when: { attackerWon: false },
      effects: {
        worldEffects: {
          factionEffects: [{ unityDelta: -1 }],
          warLog: "Unity cracks under the strain. Unity -1."
        }
      }
    }
  },

  {
    key: "victory_stolen",
    label: "Victory Stolen",
    description: "When the boss wins, it steals momentum. Your victory meter slips backward.",
    behavior: {
      id: "victoryStolen",
      label: "Victory Stolen (Boss Win)",
      phase: "round_end",
      when: { bossWon: true },
      effects: {
        worldEffects: {
          factionEffects: [{ victoryDelta: -1 }],
          warLog: "Momentum stolen. Victory -1."
        }
      }
    }
  },

  {
    key: "faith_doubt",
    label: "Faith Doubt",
    description: "When you lose, something sacred feels cheap. Faith is harder to stand on.",
    behavior: {
      id: "faithDoubt",
      label: "Faith Doubt (On Fail)",
      phase: "round_end",
      when: { attackerWon: false },
      effects: {
        worldEffects: {
          factionEffects: [{ faithDelta: -1 }],
          warLog: "Doubt spreads through the faithful. Faith -1."
        }
      }
    }
  },

  {
    key: "last_stand_escalation",
    label: "Last Stand Escalation",
    description: "When the boss is near defeat, it thrashes the world. Darkness surges.",
    behavior: {
      id: "lastStandEscalation",
      label: "Last Stand Escalation (Near Defeat)",
      phase: "round_end",
      when: { damageStepGE: 3 },
      log: { whisperGM: "Cornered things don’t negotiate. They *erupt*." },
      effects: {
        worldEffects: {
          factionEffects: [{ darknessDelta: 2 }],
          warLog: "The boss lashes out at the edge of defeat. Darkness +2."
        }
      }
    }
  },

  {
    key: "retreat_clause",
    label: "Retreat Clause",
    description: "When the boss hits a threshold, it retreats instead of dying. It will be back.",
    behavior: {
      id: "retreatClause",
      label: "Retreat Clause (Threshold Retreat)",
      phase: "round_end",
      when: { damageStepGE: 3 },
      endRaid: { outcome: "retreated" },
      effects: { worldEffects: { warLog: "The boss retreats, debt unpaid and interest accruing." } }
    }
  },

  {
    key: "banishment_clause",
    label: "Banishment Clause",
    description: "On final defeat, the story locks in. The world registers the win.",
    behavior: {
      id: "banishmentClause",
      label: "Banishment Clause (Defeat Lock-In)",
      phase: "round_end",
      when: { defeated: true },
      endRaid: { outcome: "defeated" },
      effects: {
        worldEffects: {
          factionEffects: [{ victoryDelta: 2 }],
          warLog: "The boss is banished. Victory +2."
        }
      }
    }
  },

  // -------------------------------------------------------------------------
  // Gloomgill promoted powers (legacy identifiers preserved)
  // These keys are chosen to match existing Gloomgill behavior ids/keys so
  // Normalize can map them with zero guessing.
  // -------------------------------------------------------------------------

  {
    key: "bossWinPressure",
    label: "Boss Win Pressure",
    description: "On boss victory: the coast goes quiet, and the numbers start crawling up the walls.",
    behavior: {
      id: "bossWinPressure",
      label: "Boss Win Pressure (Boss Win)",
      phase: "round_end",
      when: { bossWon: true },
      effects: {
        worldEffects: {
          factionEffects: [{ moraleDelta: -1, darknessDelta: 1 }],
          warLog: "Pressure hits the faction. Morale -1. Darkness +1."
        }
      }
    }
  },

  {
    key: "bossWinPressureGreat",
    label: "Boss Win Pressure (Great)",
    description: "On boss great success: catastrophic pressure. The sea itself keeps receipts.",
    behavior: {
      id: "bossWinPressureGreat",
      label: "Boss Win Pressure Great (Boss Great Success)",
      phase: "round_end",
      when: { bossWon: true, greatSuccess: true },
      log: { whisperGM: "Catastrophic audit: the books close, and something screams underwater." },
      effects: {
        worldEffects: {
          factionEffects: [{ moraleDelta: -2, darknessDelta: 2 }],
          warLog: "Catastrophic pressure. Morale -2. Darkness +2."
        }
      }
    }
  },

  {
    key: "darkness_pulse_on_round_win",
    label: "Darkness Pulse",
    description: "When the boss wins a round, darkness ripples outward — like ink in seawater.",
    behavior: {
      // preserve legacy identifier for mapping
      key: "darkness_pulse_on_round_win",
      id: "darkness_pulse_on_round_win",
      label: "Darkness Pulse (Boss Win)",
      phase: "round_end",
      when: { bossWon: true },
      effects: {
        worldEffects: {
          factionEffects: [{ darknessDelta: 1 }],
          warLog: "Darkness pulses outward. Darkness +1."
        }
      }
    }
  },

  {
    key: "op_drain_on_nat_19_20",
    label: "Lucky Drain",
    description: "On a 19–20, the boss takes its cut anyway. Lucky is just a different kind of debt.",
    behavior: {
      key: "op_drain_on_nat_19_20",
      id: "op_drain_on_nat_19_20",
      label: "Lucky Drain (Nat 19–20)",
      phase: "after_roll",
      when: { natGE: 19 }, // engine-resolved; leave as-is if supported
      effects: {
        worldEffects: {
          // Keep generic — your mutation engine can interpret these, or you can swap to an OP-specific handler later.
          warLog: "Even luck has fees. The boss takes its cut."
        }
      }
    }
  },

  {
    key: "retreatWhenBroken",
    label: "Retreat When Broken",
    description: "When the boss is cracked, it doesn’t die — it withdraws. You’ve bought time, not peace.",
    behavior: {
      key: "retreatWhenBroken",
      id: "retreatWhenBroken",
      label: "Retreat When Broken",
      phase: "round_end",
      when: { damageStepGE: 3 },
      endRaid: { outcome: "retreated" },
      effects: { worldEffects: { warLog: "The boss retreats at the edge of defeat." } }
    }
  }
];

export const BOSS_POWER_PACKS = [
  // Existing packs (v2)
  {
    key: "audit_pack",
    label: "Audit Pack",
    description: "Ledger pressure + momentum theft. Great for auditors and paper monsters.",
    powers: ["audit_pressure","catastrophic_audit","victory_stolen"]
  },
  {
    key: "despair_pack",
    label: "Despair Pack",
    description: "Undermines morale and cohesion. Players feel the screws tighten fast.",
    powers: ["audit_pressure","unity_crack","faith_doubt"]
  },
  {
    key: "finale_pack",
    label: "Finale Pack",
    description: "Near-defeat escalation plus a clean narrative lock at the end.",
    powers: ["last_stand_escalation","banishment_clause"]
  },
  {
    key: "recurring_boss_pack",
    label: "Recurring Boss Pack",
    description: "Boss retreats when cracked instead of dying — perfect for campaign-long antagonists.",
    powers: ["audit_pressure","retreat_clause","last_stand_escalation"]
  },
  {
    key: "courtly_spiral_pack",
    label: "Courtly Spiral Pack",
    description: "Social horror: pressure, unity fracture, and stolen momentum.",
    powers: ["victory_stolen","unity_crack","audit_pressure"]
  },

  // New: Gloomgill Pack (promoted legacy set)
  {
    key: "gloomgill_pack",
    label: "Gloomgill Pack",
    description: "The Accountable’s signature move set: pressure, pulses, and a tactical retreat.",
    powers: ["bossWinPressure","bossWinPressureGreat","darkness_pulse_on_round_win","op_drain_on_nat_19_20","retreatWhenBroken"]
  }
];

function ensureApi() {
  try {
    if (!game.bbttcc) game.bbttcc = {};
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};
    game.bbttcc.api.raid.bossPowers = BOSS_POWERS;
    game.bbttcc.api.raid.bossPowerPacks = BOSS_POWER_PACKS;
  } catch (e) {}
}

Hooks.once("init", () => ensureApi());
Hooks.once("ready", () => ensureApi());
