// bbttcc-character-options/data/refined-options.js
// Slice 1 — Character Options → Unlock Mapping (Design-Locked)
// NOTE: This file is pure data. No Foundry imports. No side effects.

export const REFINED_OPTIONS = {
  archetype: {
    warlord: {
      l1: "shock_command",
      l2: "doctrine_force_projection",
      stacking: "discount_then_bonus"
    },
    hierophant: {
      l1: "liturgical_rally",
      l2: "consecrated_alignment",
      stacking: "reroll_then_effective"
    },
    mayor_administrator: {
      l1: "bureaucratic_override",
      l2: "administrative_optimization",
      stacking: "extra_uses"
    },
    wizard_scholar: {
      l1: "prepared_insight",
      l2: "arcane_attribution",
      stacking: "share_benefit"
    },
    ancient_blood: {
      l1: "inherited_deference",
      l2: "dynastic_resonance",
      stacking: "negation"
    },
    squad_leader: {
      l1: "coordinated_advance",
      l2: "operational_cohesion",
      stacking: "npc_synergy"
    }
  },

  crew: {
    mercenary_band: {
      l1: "hardened_advance",
      l2: "contract_warfare_doctrine",
      stacking: "attrition_reduction"
    },
    peacekeeper_corps: {
      l1: "containment_protocol",
      l2: "stability_enforcement",
      stacking: "escalation_control"
    },
    covert_ops_cell: {
      l1: "silent_entry",
      l2: "deep_cover_network",
      stacking: "alarm_extension"
    },
    cultural_ambassadors: {
      l1: "psychological_pressure",
      l2: "cultural_diffusion",
      stacking: "reroll"
    },
    diplomatic_envoys: {
      l1: "formal_parley",
      l2: "integration_framework",
      stacking: "duration_or_bonus"
    },
    survivors_militia: {
      l1: "make_do_and_hold",
      l2: "never_scattered",
      stacking: "ally_sharing"
    }
  },

  occult: {
    kabbalist: {
      l1: "sight_of_the_tree",
      l2: "guided_ascent",
      stacking: "alignment_reroll"
    },
    alchemist: {
      l1: "rapid_transmutation",
      l2: "philosophic_exchange",
      stacking: "scope_plus_risk"
    },
    tarot_mage: {
      l1: "turn_the_card",
      l2: "thread_the_spread",
      stacking: "ally_targeting"
    },
    gnostic: {
      l1: "pierce_the_veil",
      l2: "doctrine_of_clarity",
      stacking: "shared_advantage"
    },
    goetic_summoner: {
      l1: "infernal_bargain",
      l2: "ritual_binding",
      stacking: "amplify_and_cost"
    },
    rosicrucian: {
      l1: "veiled_access",
      l2: "silent_brotherhood",
      stacking: "party_scope"
    }
  },

  enlightenment: {
    awakened: {},
    adept: {},
    illuminated: {},
    transcendent: {
      strategicFlag: "bbttcc.enlightenment.opRegenBonus"
    }
  }
};
