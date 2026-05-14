// bbttcc-encounters/scripts/encounter.outcomes.js
// Outcome registry for Encounter Engine.

(() => {
  const TAG = "[bbttcc-encounters/outcomes]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const OUTCOME_SETS = {
    // ✅ Scout Signs — Band I / baseline
    travel_scout_signs_t1: {
      key: "travel_scout_signs_t1",
      label: "Scout Signs (Band I)",
      description:
        "“You catch it before it becomes a problem. That’s the difference between a professional and a corpse.”\n\n" +
        "A thin trail of recent passage: scuffed dirt, snapped brush, a little too orderly to be animal.\n\n" +
        "This does not start a fight. It starts a decision.",
      options: [
        {
          key: "slow_read",
          label: "Slow down and read it properly",
          summary: "Trade speed for certainty. You’ll be harder to surprise on the next leg.",
          default: true,
          effects: {
            encounterChanceDelta: -1
          }
        },
        {
          key: "keep_wide",
          label: "Keep moving, but wide",
          summary: "You don’t stop. You just stop being predictable. Safer line, longer story.",
          effects: {
            allowReroute: true
          }
        },
        {
          key: "mark_later",
          label: "Mark it for later",
          summary: "You don’t lose the information — you cache it. Someone will thank you later.",
          effects: {
            scoutInsight: true
          }
        }
      ]
    },

    // ✅ Scout Signs — Band II tone (Valuable)
    travel_scout_signs_valuable_t1: {
      key: "travel_scout_signs_valuable_t1",
      label: "Scout Signs (Band II)",
      description:
        "“Good news: you’re early. Bad news: so are they.”\n\n" +
        "The road here isn’t quiet. It’s careful. Like the land has learned to stop giving away free information.\n\n" +
        "You still have room to choose what kind of problem this becomes.",
      options: [
        {
          key: "safe_line",
          label: "Pay the Logistics and take the safe line",
          summary: "Spend resources now so you don’t spend blood later. The route gets longer; your odds improve.",
          default: true,
          effects: {
            logisticsDelta: -1,
            encounterChanceDelta: -1
          }
        },
        {
          key: "push_loud",
          label: "Push through fast and loud",
          summary: "Dare the world to blink first. If trouble comes, it’ll come harder.",
          effects: {
            encounterTierDelta: 1
          }
        },
        {
          key: "send_scouts",
          label: "Send scouts ahead",
          summary: "You don’t guess. You sample. You might lose time — but you’ll learn what lives in the dark.",
          effects: {
            scoutInsight: true,
            timeCost: 1
          }
        }
      ]
    },

    // ✅ Scout Signs — Band III tone (Deep Wild)
    travel_scout_signs_deep_wild_t1: {
      key: "travel_scout_signs_deep_wild_t1",
      label: "Scout Signs (Band III)",
      description:
        "“This is not a place that kills you. It’s a place that forgets you existed.”\n\n" +
        "No birds. No insects. No wind. The silence isn’t absence — it’s a boundary.\n\n" +
        "The world is offering you a last clear choice. Take it seriously.",
      options: [
        {
          key: "turn_back",
          label: "Turn back. No shame.",
          summary: "Smart is not the same as brave. You live to make a better plan.",
          default: true,
          effects: {
            abortTravel: true
          }
        },
        {
          key: "proceed_prepared",
          label: "Proceed, but prepare for impact",
          summary: "If you go, you go armored — physically or spiritually. Expect consequences.",
          effects: {
            encounterTierDelta: 1,
            partyPrepared: true
          }
        },
        {
          key: "ritual_crossing",
          label: "Ritualize the crossing",
          summary: "If the land is listening, you speak first. You may gain protection… or attention.",
          effects: {
            encounterChanceDelta: -1,
            faithDelta: -1
          }
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
    warn("Immediate publish failed:", e);
  }
})();
