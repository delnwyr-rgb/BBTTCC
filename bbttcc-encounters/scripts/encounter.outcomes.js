// bbttcc-encounters/scripts/encounter.outcomes.js
// Outcome registry for Encounter Engine.
// Implements outcomes for:
//   - travel_bandit_ambush_t2
//   - travel_hidden_ruins_t2
//   - travel_minor_radiation_t2
//   - travel_vault_depths_t3
//   - travel_rockslide_t3
//   - travel_acid_bog_t2
//   - travel_spark_echo_t2
//   - travel_faction_parley_t2
//   - travel_border_incident_t2
//   - travel_rail_yard_takeover_t3

(() => {
  const TAG = "[bbttcc-encounters/outcomes]";
  const log  = (...a)=>console.log(TAG, ...a);

  const OUTCOME_SETS = {
    // -----------------------------------------------------------------------
    // Bandit Ambush
    // -----------------------------------------------------------------------
    travel_bandit_ambush_t2: {
      key: "travel_bandit_ambush_t2",
      label: "Bandit Ambush Outcome",
      description: "How did the ambush resolve in the fiction?",
      options: [
        {
          key: "bandits_routed",
          label: "PCs rout the bandits",
          summary: "The ambush fails; the raiders are scattered or captured and the road is cleared.",
          default: true,
          resolutionChoices: [
            {
              resolutionKey: "justice_reformation",
              defaultTier: "partial",
              question: "Did this victory meaningfully reform order and justice along this stretch of road?"
            }
          ]
        },
        {
          key: "costly_victory",
          label: "PCs win, but at a cost",
          summary: "The bandits are driven off, but allies are hurt, assets damaged, or morale shaken.",
          resolutionChoices: [
            {
              resolutionKey: "retribution_subjugation",
              defaultTier: "partial",
              question: "Did the faction pacify the locals through fear, reprisals, or harsh control?"
            }
          ]
        },
        {
          key: "forced_retreat",
          label: "PCs forced to retreat",
          summary: "The ambush overwhelms the forward party; the faction withdraws and the bandits claim the ground."
        },
        {
          key: "negotiated_passage",
          label: "Parley / negotiated passage",
          summary: "The faction cuts a deal—toll, favor, threat, or truce—to move on without a full battle.",
          resolutionChoices: [
            {
              resolutionKey: "liberation",
              defaultTier: "partial",
              question: "Did this negotiation spark a genuine local liberation from the bandit regime?"
            }
          ]
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Hidden Ruins / Vault
    // -----------------------------------------------------------------------
    travel_hidden_ruins_t2: {
      key: "travel_hidden_ruins_t2",
      label: "Hidden Ruins Outcome",
      description: "What did the faction ultimately take away from the vault beneath this hex?",
      options: [
        {
          key: "shallow_survey",
          label: "Shallow survey & salvage",
          summary: "The faction maps the upper levels, pulls useful salvage, and flags the vault for future expeditions.",
          default: true
        },
        {
          key: "deep_alliance",
          label: "Deep alliance with vault denizens",
          summary: "The explorers broker a pact with whatever still lives or echoes down there. The vault and the surface become true partners.",
          resolutionChoices: [
            {
              resolutionKey: "best_friends_integration",
              defaultTier: "complete",
              question: "Did the faction forge a lasting, mutually beneficial integration pact with the vault below?"
            }
          ]
        },
        {
          key: "disturbed_things",
          label: "You disturbed things best left sleeping",
          summary: "Something down there woke up, noticed you, and left a signature in the stone and in your dreams."
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Minor Radiation Pocket
    // -----------------------------------------------------------------------
    travel_minor_radiation_t2: {
      key: "travel_minor_radiation_t2",
      label: "Minor Radiation Pocket Outcome",
      description: "How did the faction handle the small but dangerous radiation pocket they encountered?",
      options: [
        {
          key: "skirt_the_edge",
          label: "Skirt the edge",
          summary: "The expedition skirts the boundaries of the pocket, burning time and resources but keeping direct exposure low.",
          default: true
        },
        {
          key: "push_through_heat",
          label: "Push through the heat",
          summary: "The faction pushes through the hot zone to stay on schedule, accepting mild but lasting contamination."
        },
        {
          key: "mutagenic_flare",
          label: "Mutagenic flare",
          summary: "A surge in the pocket catches the expedition mid-crossing. Some emerge changed, and not all for the better."
        },
        {
          key: "resonant_pulse",
          label: "Resonant pulse",
          summary: "The faction leans into the radiation's rhythm, stirring small anomalies and bringing a shard of that resonance home."
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Vault Depths (Deeper Ruins, Tier 3)
    // -----------------------------------------------------------------------
    travel_vault_depths_t3: {
      key: "travel_vault_depths_t3",
      label: "Vault Depths Outcome",
      description: "When the faction pushes deeper into the vault, what story crystallizes in the depths?",
      options: [
        {
          key: "careful_mapping",
          label: "Careful mapping & secured routes",
          summary: "Scouts and engineers methodically chart the depths, stabilize passages, and establish safe waypoints.",
          default: true
        },
        {
          key: "depths_bite_back",
          label: "The depths bite back",
          summary: "Traps, collapses, or hostile vault denizens take their toll on the expedition."
        },
        {
          key: "qliphotic_echoes",
          label: "Qliphotic echoes awaken",
          summary: "Something on the far side of the Tree brushes against the vault. The geometry turns wrong, and the faction carries that stain home."
        },
        {
          key: "awakening_in_the_dark",
          label: "An awakening in the dark",
          summary: "A singular presence in the depths notices the faction. What happens next will shape the hex for a long time.",
          resolutionChoices: [
            {
              resolutionKey: "salt_the_earth",
              defaultTier: "complete",
              question: "Did the faction choose to seal, sacrifice, or otherwise permanently alter the vault depths to contain what woke?"
            }
          ]
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Rockslide
    // -----------------------------------------------------------------------
    travel_rockslide_t3: {
      key: "travel_rockslide_t3",
      label: "Rockslide Outcome",
      description: "After the dust settles, what is the state of the pass?",
      options: [
        {
          key: "pass_blocked_total",
          label: "Pass completely blocked",
          summary: "The slide forms an impassable wall. This route is effectively closed until major work is done.",
          default: true
        },
        {
          key: "pass_blocked_clearable",
          label: "Blocked, but clearable with effort",
          summary: "The way is choked with debris, but an organized effort (OP, BU, or time) could reopen the pass."
        },
        {
          key: "narrow_passage_remains",
          label: "A narrow, risky passage remains",
          summary: "The slide is severe, but there are tight paths and ledges. Travel is slower and more dangerous, not impossible."
        },
        {
          key: "catastrophic_collapse",
          label: "Catastrophic collapse",
          summary: "The entire canyon changes. Landmarks are gone, routes shift, and something valuable or terrible may have been buried or revealed.",
          resolutionChoices: [
            {
              resolutionKey: "salt_the_earth",
              defaultTier: "complete",
              question: "Did this collapse and its aftermath permanently ruin this route as a living corridor?"
            }
          ]
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Acid Bog
    // -----------------------------------------------------------------------
    travel_acid_bog_t2: {
      key: "travel_acid_bog_t2",
      label: "Acid Bog Outcome",
      description: "How did the passage through the acid bog really go?",
      options: [
        {
          key: "careful_crossing",
          label: "Careful crossing, light damage",
          summary: "The faction slows down, burns resources, and uses caution to cross safely, with only minor damage to gear.",
          default: true
        },
        {
          key: "bog_claims_tithe",
          label: "The bog claims a tithe",
          summary: "Equipment, cargo, or even a unit is lost to the sucking acids. The faction gets through, but something precious is gone."
        },
        {
          key: "mutagenic_awakening",
          label: "Mutagenic awakening",
          summary: "The bog reacts strangely to your passage. Chemistry, memory, and radiation tangle together and something in the zone wakes up."
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Spark Echo
    // -----------------------------------------------------------------------
    travel_spark_echo_t2: {
      key: "travel_spark_echo_t2",
      label: "Spark Echo Outcome",
      description: "When the Echo rings through this hex, how does it land?",
      options: [
        {
          key: "harmonic_resonance",
          label: "Harmonic resonance",
          summary: "The echo aligns with your people. For a brief moment, the world hums in a chord they recognize.",
          default: true
        },
        {
          key: "disruptive_feedback",
          label: "Disruptive feedback",
          summary: "The echo catches on rough edges in your story. Lights flicker, radios howl, and some of your sparks feel… offended."
        },
        {
          key: "splintered_reflection",
          label: "Splintered reflection",
          summary: "The echo fractures, seeding incomplete patterns into the local story. Something started here, but did not finish."
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Faction Parley
    // -----------------------------------------------------------------------
    travel_faction_parley_t2: {
      key: "travel_faction_parley_t2",
      label: "Faction Parley Outcome",
      description: "Did the negotiators walk away with hope, tension, or new enemies?",
      options: [
        {
          key: "diplomatic_breakthrough",
          label: "Diplomatic breakthrough",
          summary: "Common ground is found. A tentative but real understanding is reached.",
          default: true
        },
        {
          key: "tense_standoff",
          label: "Tense standoff",
          summary: "No one blinks. Everyone goes home with more talking points and less patience."
        },
        {
          key: "hostile_escalation",
          label: "Hostile escalation",
          summary: "Words tip over into threats. Lines are drawn a little darker than before."
        },
        {
          key: "backchannel_deal",
          label: "Back-channel deal",
          summary: "An unofficial understanding is reached. Not everyone in the faction will like what was promised."
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Border Incident
    // -----------------------------------------------------------------------
    travel_border_incident_t2: {
      key: "travel_border_incident_t2",
      label: "Border Incident Outcome",
      description: "Did this standoff cool, simmer, or boil over?",
      options: [
        {
          key: "controlled_deescalation",
          label: "Controlled de-escalation",
          summary: "Tension is diffused with effort. No one is happy, but no one is dead.",
          default: true
        },
        {
          key: "shots_over_line",
          label: "Shots over the line",
          summary: "Warning shots and \"strays\" are exchanged. Officially, nobody started a war."
        },
        {
          key: "escalation_to_skirmish",
          label: "Escalation to skirmish",
          summary: "The whole frontier erupts into a brief, brutal firefight before cooler heads drag people apart."
        },
        {
          key: "strategic_withdrawal",
          label: "Strategic withdrawal",
          summary: "The faction pulls back intentionally, giving ground to win time—or to fight somewhere else."
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Rail Yard Takeover
    // -----------------------------------------------------------------------
    travel_rail_yard_takeover_t3: {
      key: "travel_rail_yard_takeover_t3",
      label: "Rail Yard Takeover Outcome",
      description: "How does the faction’s push into the yard land in the fiction?",
      options: [
        {
          key: "seized_yard",
          label: "Seize the yard",
          summary: "The faction secures control of the rail yard and its switching infrastructure, turning it into a friendly logistics hub.",
          default: true
        },
        {
          key: "sabotaged_lines",
          label: "Sabotage the lines",
          summary: "The yard remains contested or hostile, but the faction cripples the throughput and disrupts enemy supply."
        },
        {
          key: "botched_operation",
          label: "Botched operation",
          summary: "The plan unravels. Assets are lost, the yard’s politics sour, and the faction’s image takes a hit."
        },
        {
          key: "workers_uprising",
          label: "Workers’ uprising",
          summary: "The rail workers and locals rise up with the faction’s help, reshaping the yard into a more just commons node.",
          resolutionChoices: [
            {
              resolutionKey: "justice_reformation",
              defaultTier: "complete",
              question: "Did the faction help the yard’s workers seize and reform the yard into a fairer, self-governed hub?"
            }
          ]
        }
      ]
    }
  };

  function clone(obj) {
    return (obj && typeof obj === "object") ? foundry.utils.deepClone(obj) : obj;
  }

  function getOutcomeSetForScenario(scenarioKey) {
    if (!scenarioKey) return null;
    const set = OUTCOME_SETS[scenarioKey];
    return set ? clone(set) : null;
  }

  function listOutcomeSets() {
    return Object.values(OUTCOME_SETS).map(clone);
  }

  function publishOutcomeAPI() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.encounters ??= game.bbttcc.api.encounters || {};

    Object.assign(game.bbttcc.api.encounters, {
      getOutcomeSetForScenario,
      listOutcomeSets
    });

    log("Outcome registry published on game.bbttcc.api.encounters");
  }

  Hooks.once("ready", publishOutcomeAPI);
  try {
    if (game?.ready) publishOutcomeAPI();
  } catch (e) {
    console.warn(TAG, "Immediate publish failed:", e);
  }
})();
