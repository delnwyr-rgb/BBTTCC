// modules/bbttcc-territory/scripts/resolutions.js
// BBTTCC — Resolution Definitions (Canonical Outcome Matrix)
// Plain script version (no ES modules). Attaches to window.BBTTCC_RESOLUTIONS.

window.BBTTCC_RESOLUTIONS = {

  // -------------------------------------------------------------
  // JUSTICE / REFORMATION
  // -------------------------------------------------------------
  "justice_reformation": {
    label: "Justice / Reformation",

    // Who can use it / when
    allowedTiers: ["complete", "partial", "pyrrhic"],
    allowedTo: ["attacker"],   // attacker chooses after winning & owning the hex
    requiresOwnership: true,

    // Hex effects
    hex: {
      status: "claimed",
      productionMult: 1.0,
      addModifiers:    ["loyal_population"],
      removeModifiers: ["hostile_population"],
      removePopulation: false
    },

    // Faction track deltas (applied immediately)
    tracks: {
      violenceAttritionDelta: -1,
      empathyDelta: +1,
      darknessDelta: -1,
      moraleDelta: +2,
      loyaltyDelta: +1
    },

    // Integration difficulty
    integration: {
      garrisonEase: "easy",
      integrationCostMult: 0.75
    },

    // One-time victory/unity bonuses
    victory: {
      vpOnce: 1,
      unityOnce: 5
    }
  },

  // -------------------------------------------------------------
  // LIBERATION
  // -------------------------------------------------------------
  "liberation": {
    label: "Liberation",

    // Attacker liberates a hex from an oppressive regime; you
    // assume control but try to keep the population on your side.
    allowedTiers: ["complete", "partial", "pyrrhic"],
    allowedTo: ["attacker"],
    requiresOwnership: true,

    // Hex feels more like Justice than Best Friends: you free
    // them, but you haven’t merged cultures yet.
    hex: {
      status: "claimed",
      productionMult: 1.0,
      addModifiers:    ["loyal_population", "liberated"],
      removeModifiers: ["hostile_population"],
      removePopulation: false
    },

    // Tracks: slightly softer than Best Friends, slightly
    // stronger than Justice on Loyalty.
    tracks: {
      violenceAttritionDelta: 0,   // still a fight
      empathyDelta: +1,
      darknessDelta: 0,
      moraleDelta: +2,
      loyaltyDelta: +2
    },

    // Integration: easier than baseline, but not as easy as
    // full Best Friends Integration.
    integration: {
      garrisonEase: "normal",
      integrationCostMult: 0.8
    },

    // Victory: one-shot VP and small Unity nudge.
    victory: {
      vpOnce: 1,
      unityOnce: 3
    }
  },

  // -------------------------------------------------------------
  // BEST FRIENDS / INTEGRATION
  // -------------------------------------------------------------
  "best_friends_integration": {
    label: "Best Friends / Integration",

    // Full kumbaya outcome: you win and also become
    // deeply integrated allies. Usually Complete Victory only,
    // but we allow Partial with some narrative wiggle room.
    allowedTiers: ["complete", "partial"],
    allowedTo: ["attacker"],
    requiresOwnership: true,

    // Hex: fully claimed, full output, strongly loyal.
    hex: {
      status: "claimed",
      productionMult: 1.0,
      addModifiers:    ["loyal_population", "integration_pact", "best_friends"],
      removeModifiers: ["hostile_population"],
      removePopulation: false
    },

    // Tracks: biggest positive bump of the "good" outcomes.
    tracks: {
      violenceAttritionDelta: 0,   // still required a fight
      empathyDelta: +1,
      darknessDelta: 0,
      moraleDelta: +3,
      loyaltyDelta: +3
    },

    // Integration: easiest of all outcomes.
    integration: {
      garrisonEase: "very_easy",
      integrationCostMult: 0.4
    },

    // Victory: stronger one-shot boon and a solid Unity nudge.
    victory: {
      vpOnce: 2,
      unityOnce: 7
    }
  },

  // -------------------------------------------------------------
  // RETRIBUTION / SUBJUGATION
  // -------------------------------------------------------------
  "retribution_subjugation": {
    label: "Retribution / Subjugation",

    // Attacker wins and rules by fear.
    allowedTiers: ["complete", "partial", "pyrrhic"],
    allowedTo: ["attacker"],
    requiresOwnership: true,

    // Hex effects: occupied and producing at a penalty, with
    // hostile population baked in.
    hex: {
      status: "occupied",
      productionMult: 0.5,
      addModifiers:    ["hostile_population", "subjugated"],
      removeModifiers: ["loyal_population"],
      removePopulation: false
    },

    // Faction tracks: darker, harsher governance.
    tracks: {
      violenceAttritionDelta: +1,
      empathyDelta: -1,
      darknessDelta: +1,
      moraleDelta: -1,
      loyaltyDelta: -2
    },

    // Integration: harder and more expensive to stabilize.
    integration: {
      garrisonEase: "hard",
      integrationCostMult: 1.5
    },

    // Victory: no direct boon; long-term VP is indirectly hurt
    // via Morale/Loyalty/Darkness, which the VP engine already
    // accounts for.
    victory: {
      vpOnce: 0,
      unityOnce: 0
    }
  },

  // -------------------------------------------------------------
  // BEST FRIENDS / INTEGRATION
  // -------------------------------------------------------------
  "best_friends_integration": {
    label: "Best Friends / Integration",

    allowedTiers: ["complete", "partial"], // no pyrrhic by default
    allowedTo: ["attacker"],
    requiresOwnership: true,

    hex: {
      status: "claimed",
      productionMult: 1.0,
      addModifiers:    ["loyal_population", "integration_pact"],
      removeModifiers: ["hostile_population"],
      removePopulation: false
    },

    tracks: {
      violenceAttritionDelta: 0,
      empathyDelta: +1,
      darknessDelta: 0,
      moraleDelta: +3,
      loyaltyDelta: +2
    },

    integration: {
      garrisonEase: "easy",
      integrationCostMult: 0.5
    },

    victory: {
      vpOnce: 2,
      unityOnce: 5
    }
  },

  // -------------------------------------------------------------
  // RETRIBUTION / SUBJUGATION
  // -------------------------------------------------------------
  "retribution_subjugation": {
    label: "Retribution / Subjugation",

    allowedTiers: ["complete", "partial", "pyrrhic"],
    allowedTo: ["attacker"],
    requiresOwnership: true,

    hex: {
      status: "occupied",
      productionMult: 0.5,
      addModifiers:    ["hostile_population"],
      removeModifiers: [],
      removePopulation: false
    },

    tracks: {
      violenceAttritionDelta: +1,
      empathyDelta: -1,
      darknessDelta: +1,
      moraleDelta: -1,
      loyaltyDelta: -2
    },

    integration: {
      garrisonEase: "hard",
      integrationCostMult: 1.5
    },

    victory: {
      vpOnce: 0,
      unityOnce: 0
    }
  },

  // -------------------------------------------------------------
  // SALT THE EARTH — Owner Action (hex-owner only, any time)
  // -------------------------------------------------------------
  "salt_the_earth": {
    label: "Salt the Earth",

    // Can be invoked as an owner-action at any time, or as a resolution
    // if the invoker currently owns the hex.
    allowedTiers: ["complete", "partial", "pyrrhic", "owner_action"],
    allowedTo: ["hex_owner"],
    requiresOwnership: true,

    hex: {
      status: "scorched",
      productionMult: 0.0,
      addModifiers:    ["devastated", "scorched_earth"],
      removeModifiers: ["hostile_population", "loyal_population"],
      removePopulation: true
    },

    tracks: {
      violenceAttritionDelta: +1,
      empathyDelta: -1,
      darknessDelta: +2,
      moraleDelta: -1,
      loyaltyDelta: 0 // population wiped out, loyalty moot
    },

    integration: {
      blocked: true,
      rebuildRequired: true
    },

    victory: {
      vpOnce: 0,
      unityOnce: 0
    }
  }

};
