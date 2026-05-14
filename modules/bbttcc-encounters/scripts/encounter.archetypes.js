// bbttcc-encounters/scripts/encounter.archetypes.js
// Registry for Encounter Categories & Archetypes (design-level taxonomy).
// These are not all wired to scenes yet; some are abstract "archetypes"
// that future scenarios and AAE logic can reference.

(() => {
  const TAG = "[bbttcc-encounters/archetypes]";
  const log  = (...a)=>console.log(TAG, ...a);

  // ---------------------------------------------------------------------------
  // Archetype shape
  // ---------------------------------------------------------------------------
  // {
  //   key: "travel_bandit_ambush_t2",
  //   category: "travel" | "urban" | "raid" | "tikkun" | "anomaly",
  //   tier: 1-4,
  //   scale: "macro" | "hybrid" | "micro",
  //   label: "Bandit Ambush",
  //   summary: "Short human description",
  //   tikkunTie: "Gevurah",
  //   darknessHint: 0 | +1 | -1,
  //   exampleScenarioKey: "travel_bandit_ambush_t2" // optional
  // }

  const ARCHETYPES = {
    // --- Travel / Terrain ----------------------------------------------------
    travel_bandit_ambush_t2: {
      key: "travel_bandit_ambush_t2",
      category: "travel",
      subcategory: "hostile",
      tier: 2,
      scale: "hybrid",
      label: "Bandit Ambush on the Road",
      summary: "A raiding band strikes from cover; PCs (or scouts) are forced into a quick engagement.",
      tikkunTie: "Gevurah",
      darknessHint: +1,
      exampleScenarioKey: "travel_bandit_ambush_t2"
    },

    travel_broken_bridge_t1: {
      key: "travel_broken_bridge_t1",
      category: "travel",
      subcategory: "hazard",
      tier: 1,
      scale: "hybrid",
      label: "Broken Bridge / Crossing Hazard",
      summary: "The way forward is broken, forcing a risky crossing, detour, or clever workaround.",
      tikkunTie: "Netzach",
      darknessHint: 0,
      exampleScenarioKey: "travel_broken_bridge_t1"
    },

    travel_minor_radiation_t2: {
      key: "travel_minor_radiation_t2",
      category: "travel",
      subcategory: "hazard",
      tier: 2,
      scale: "macro",
      label: "Minor Radiation Pocket",
      summary: "Stray fallout or zone contamination presses on the travelers, ticking RP and darkness.",
      tikkunTie: "Hod",
      darknessHint: +1,
      exampleScenarioKey: "travel_minor_radiation_t2"
    },

    travel_hidden_ruins_t2: {
      key: "travel_hidden_ruins_t2",
      category: "travel",
      subcategory: "exploration",
      tier: 2,
      scale: "hybrid",
      label: "Hidden Ruins / Vault",
      summary: "An unexpected structure or ruin invites exploration, treasure, or trouble.",
      tikkunTie: "Yesod",
      darknessHint: 0,
      exampleScenarioKey: "travel_hidden_ruins_t2"
    },

    travel_rockslide_t3: {
      key: "travel_rockslide_t3",
      category: "travel",
      subcategory: "hazard",
      tier: 3,
      scale: "macro",
      label: "Rockslide / Canyon Collapse",
      summary: "A catastrophic slide reshapes the terrain, blocking paths and burying anything caught beneath.",
      tikkunTie: "Gevurah",
      darknessHint: +2,
      exampleScenarioKey: "travel_rockslide_t3"
    },

    // --- Stubs for future categories (examples, no scenes yet) --------------
    urban_faction_tension_t2: {
      key: "urban_faction_tension_t2",
      category: "urban",
      subcategory: "social",
      tier: 2,
      scale: "hybrid",
      label: "Faction Tension in the Streets",
      summary: "Two blocs collide in a market or plaza; PCs can defuse, inflame, or exploit it.",
      tikkunTie: "Tiferet",
      darknessHint: +1,
      exampleScenarioKey: null
    },

    raid_counterstrike_t3: {
      key: "raid_counterstrike_t3",
      category: "raid",
      subcategory: "response",
      tier: 3,
      scale: "macro",
      label: "Enemy Counter-Strike",
      summary: "After a successful raid, the enemy regroup and hit back at a vulnerable asset.",
      tikkunTie: "Gevurah",
      darknessHint: +2,
      exampleScenarioKey: null
    },

    tikkun_spark_echo_t2: {
      key: "tikkun_spark_echo_t2",
      category: "tikkun",
      subcategory: "vision",
      tier: 2,
      scale: "micro",
      label: "Spark Echo / Vision",
      summary: "A character brushes against a deeper pattern, granting sparks or insight at a cost.",
      tikkunTie: "Yesod",
      darknessHint: -1,
      exampleScenarioKey: null
    },

    anomaly_ego_dragon_t4: {
      key: "anomaly_ego_dragon_t4",
      category: "anomaly",
      subcategory: "psyche",
      tier: 4,
      scale: "micro",
      label: "Ego-Dragon Manifestation",
      summary: "An internalized or collective trauma takes form, demanding confrontation or sacrifice.",
      tikkunTie: "Da'at",
      darknessHint: +3,
      exampleScenarioKey: null
    }
  };

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------

  function getArchetype(key) {
    if (!key) return null;
    return ARCHETYPES[key] ?? null;
  }

  function listArchetypes(filter = {}) {
    const { category, tier, scale } = filter;
    return Object.values(ARCHETYPES).filter(a => {
      if (category && a.category !== category) return false;
      if (tier != null && Number(a.tier) !== Number(tier)) return false;
      if (scale && a.scale !== scale) return false;
      return true;
    }).map(a => ({ ...a }));
  }

  function publishArchetypeAPI() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.encounters ??= game.bbttcc.api.encounters || {};

    Object.assign(game.bbttcc.api.encounters, {
      getArchetype,
      listArchetypes
    });

    log("Archetype registry published on game.bbttcc.api.encounters");
  }

  Hooks.once("ready", publishArchetypeAPI);
})();
