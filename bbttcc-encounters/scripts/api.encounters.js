// bbttcc-encounters/scripts/api.encounters.js

(() => {
  const TAG = "[bbttcc-encounters/api]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // ---------------------------------------------------------------------------
  // Encounter → Scenario → Scene registry
  // ---------------------------------------------------------------------------

  const ENCOUNTER_SCENARIOS = {
    bandit_ambush:       "travel_bandit_ambush_t2",
    broken_bridge:       "travel_broken_bridge_t1",
    minor_radiation:     "travel_minor_radiation_t2",
    hidden_ruins:        "travel_hidden_ruins_t2",
    vault_depths:        "travel_vault_depths_t3",
    rail_yard_takeover:  "travel_rail_yard_takeover_t3",
    rockslide:           "travel_rockslide_t3",
    acid_bog:            "travel_acid_bog_t2",
    spark_echo:          "travel_spark_echo_t2",
    faction_parley:      "travel_faction_parley_t2",
    border_incident:     "travel_border_incident_t2"
  };

  const SCENARIOS = {
    // -----------------------------------------------------------------------
    // Travel / Hostile / Hybrid — Bandit Ambush
    // -----------------------------------------------------------------------
    travel_bandit_ambush_t2: {
      key: "travel_bandit_ambush_t2",
      label: "Bandit Ambush (Tier 2)",
      type: "travel",
      category: "travel",
      subcategory: "hostile",
      scale: "hybrid",
      tableTier: 2,
      tikkunTie: "Gevurah",
      spawnerKey: "bandit_ambush_standard",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.7cjvoeJmEVLcAXFz",
          name: "Bandit Ambush",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Hazard / Hybrid — Broken Bridge
    // -----------------------------------------------------------------------
    travel_broken_bridge_t1: {
      key: "travel_broken_bridge_t1",
      label: "Broken Bridge (Tier 1)",
      type: "travel",
      category: "travel",
      subcategory: "hazard",
      scale: "hybrid",
      tableTier: 1,
      tikkunTie: "Netzach",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.UHi9NAZHOr4x4es3",
          name: "Broken Bridge",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Hazard / Macro — Minor Radiation Pocket
    // -----------------------------------------------------------------------
    travel_minor_radiation_t2: {
      key: "travel_minor_radiation_t2",
      label: "Minor Radiation Pocket (Tier 2)",
      type: "travel",
      category: "travel",
      subcategory: "hazard",
      scale: "macro",
      tableTier: 2,
      tikkunTie: "Hod",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.xYT1kma16MZFeYUj",
          name: "Minor Radiation Pocket",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Exploration / Hybrid — Hidden Ruins / Vault
    // -----------------------------------------------------------------------
    travel_hidden_ruins_t2: {
      key: "travel_hidden_ruins_t2",
      label: "Hidden Ruins / Vault (Tier 2)",
      type: "travel",
      category: "travel",
      subcategory: "exploration",
      scale: "hybrid",
      tableTier: 2,
      tikkunTie: "Yesod",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.oh87Klqtd7Dazg4Z",
          name: "Hidden Vault",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Exploration / Hybrid — Vault Depths (Deeper Ruins, Tier 3)
    // -----------------------------------------------------------------------
    travel_vault_depths_t3: {
      key: "travel_vault_depths_t3",
      label: "Vault Depths (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "exploration",
      scale: "hybrid",
      tableTier: 3,
      tikkunTie: "Yesod",

      // Always return to the main campaign map after Vault Depths.
      returnSceneUuid: "Scene.H1OYnNI7COeUaLQ9",

      steps: [
        {
          kind: "scene",
          uuid: "Scene.oh87Klqtd7Dazg4Z",
          name: "Hidden Vault Approach",
          role: "approach"
        },
        {
          kind: "scene",
          uuid: "Scene.OYAdJLNrjY0sJU1s",
          name: "Hidden Vault - Lower Level",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Hazard / Macro — Rockslide multi-step
    // -----------------------------------------------------------------------
    travel_rockslide_t3: {
      key: "travel_rockslide_t3",
      label: "Rockslide (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "hazard",
      scale: "macro",
      tableTier: 3,
      tikkunTie: "Gevurah",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.2jKJt5eGiUv3Lc7o", // pre
          name: "Rockslide pre",
          role: "pre",
          autoAdvanceMs: 8000
        },
        {
          kind: "scene",
          uuid: "Scene.Bbh7NqF5aQQpRTa9", // transition
          name: "Rockslide Transition",
          role: "cutscene",
          autoAdvanceMs: 8000
        },
        {
          kind: "scene",
          uuid: "Scene.DCRs7HM0AhS1pIZn", // post
          name: "Rockslide post",
          role: "post"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Hazard / Hybrid — Acid Bog Crossing
    // -----------------------------------------------------------------------
    travel_acid_bog_t2: {
      key: "travel_acid_bog_t2",
      label: "Acid Bog (Tier 2)",
      type: "travel",
      category: "travel",
      subcategory: "hazard",
      scale: "hybrid",
      tableTier: 2,
      tikkunTie: "Hod",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.fagDdBPDriWOXZDa",
          name: "Acid Bog",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Weird / Hybrid — Spark Echo
    // -----------------------------------------------------------------------
    travel_spark_echo_t2: {
      key: "travel_spark_echo_t2",
      label: "Spark Echo (Tier 2)",
      type: "travel",
      category: "weird",
      subcategory: "tikkun",
      scale: "hybrid",
      tableTier: 2,
      tikkunTie: "Hod",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.rt3LfedhKVWhUIzi",
          name: "Spark Echo Zone",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Social / Hybrid — Faction Parley
    // -----------------------------------------------------------------------
    travel_faction_parley_t2: {
      key: "travel_faction_parley_t2",
      label: "Faction Parley (Tier 2)",
      type: "travel",
      category: "social",
      subcategory: "diplomacy",
      scale: "hybrid",
      tableTier: 2,
      tikkunTie: "Tiferet",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.shtKzIf0S0hE9IHH",
          name: "Faction Parley",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Social / Hybrid — Border Incident
    // -----------------------------------------------------------------------
    travel_border_incident_t2: {
      key: "travel_border_incident_t2",
      label: "Border Incident (Tier 2)",
      type: "travel",
      category: "social",
      subcategory: "conflict",
      scale: "hybrid",
      tableTier: 2,
      tikkunTie: "Gevurah",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.cjwVS4f2P2ldSink",
          name: "Border Incident",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Urban / Hybrid — Rail Yard Takeover (Tier 3)
    // -----------------------------------------------------------------------
    travel_rail_yard_takeover_t3: {
      key: "travel_rail_yard_takeover_t3",
      label: "Rail Yard Takeover (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "urban",
      scale: "hybrid",
      tableTier: 3,
      tikkunTie: "Hod",

      // Return to Campaign Map after this scenario.
      returnSceneUuid: "Scene.H1OYnNI7COeUaLQ9",

      steps: [
        {
          kind: "scene",
          uuid: "Scene.Rnq0zQIGegDjLScF",
          name: "Rail Yard Takeover",
          role: "main"
        }
      ]
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getScenario(scenarioKey) {
    if (!scenarioKey) return null;
    return SCENARIOS[scenarioKey] ?? null;
  }

  function listScenarios() {
    return Object.values(SCENARIOS).map(s => ({ ...s }));
  }

  function getScenarioKeyForEncounter(encKey) {
    return encKey ? ENCOUNTER_SCENARIOS[encKey] ?? null : null;
  }

  function resolveSceneFromStep(step) {
    if (!step) return null;
    const uuid = step.uuid;
    let id = step.id;

    if (!id && typeof uuid === "string" && uuid.startsWith("Scene.")) {
      id = uuid.slice("Scene.".length);
    }

    let sc = id ? game.scenes?.get(id) ?? null : null;
    if (!sc && uuid && typeof uuid === "string") {
      sc = (game.scenes ?? []).find(s => s.uuid === uuid) ?? null;
    }
    if (!sc && step.name) {
      sc = (game.scenes ?? []).find(s => s.name === step.name) ?? null;
    }
    return sc ?? null;
  }

  function getSceneConfig(encKey) {
    if (!encKey) return null;

    const scenarioKey = getScenarioKeyForEncounter(encKey);
    if (!scenarioKey) return null;

    const scenario = getScenario(scenarioKey);
    if (!scenario) {
      return {
        encKey,
        scenarioKey,
        label: scenarioKey,
        type: "travel",
        tier: null,
        sceneName: null,
        sceneUuid: null,
        sceneId: null,
        scene: null
      };
    }

    const firstStep = scenario.steps?.[0] ?? null;
    const scene = firstStep ? resolveSceneFromStep(firstStep) : null;

    const sceneName = scene?.name ?? firstStep?.name ?? scenario.label ?? null;
    const sceneUuid = scene?.uuid ?? firstStep?.uuid ?? null;
    const sceneId   = scene?.id ?? null;

    return {
      encKey,
      scenarioKey,
      label: scenario.label ?? scenarioKey,
      type: scenario.type ?? "travel",
      tier: scenario.tableTier ?? null,
      sceneName,
      sceneUuid,
      sceneId,
      scene
    };
  }

  function listMappings() {
    return Object.keys(ENCOUNTER_SCENARIOS).map(encKey => {
      const cfg = getSceneConfig(encKey);
      if (cfg) return cfg;
      return {
        encKey,
        scenarioKey: getScenarioKeyForEncounter(encKey),
        label: encKey,
        type: "travel",
        tier: null,
        sceneName: null,
        sceneUuid: null,
        sceneId: null,
        scene: null
      };
    });
  }

  function getLauncher() {
    return game.bbttcc?.api?.encounters?._launcher || null;
  }

  async function launchScenario(scenarioKey, ctx = {}) {
    const scenario = getScenario(scenarioKey);
    if (!scenario) {
      warn("launchScenario: no scenario for key", scenarioKey);
      return;
    }
    const launcher = getLauncher();
    if (!launcher || typeof launcher.playScenario !== "function") {
      warn("launchScenario: scene launcher not ready");
      return;
    }

    // Allow scenarios to define a default return-to scene,
    // with ctx able to override it if desired.
    const enrichedCtx = {
      ...ctx,
      returnSceneUuid:
        ctx.returnSceneUuid ??
        ctx.returnToSceneUuid ??
        scenario.returnSceneUuid ??
        scenario.returnToSceneUuid ??
        null
    };

    await launcher.playScenario(scenario, enrichedCtx);
  }

  async function launchForEncounterKey(encKey, ctx = {}) {
    const scenarioKey = getScenarioKeyForEncounter(encKey);
    if (!scenarioKey) {
      warn("launchForEncounterKey: no scenario mapping for encounter key", encKey);
      return;
    }
    await launchScenario(scenarioKey, ctx);
  }

  async function launchFromEncounterCtx(ctx = {}) {
    const enc = ctx.encounter || {};
    const encKey = enc.result?.key || enc.key;
    if (!enc.triggered || !encKey) return;
    await launchForEncounterKey(encKey, ctx);
  }

  async function testFire(key, opts = {}) {
    if (!key) {
      ui.notifications?.warn?.("encounters.testFire: key required (scenario or encounter)");
      return;
    }

    let scenario = getScenario(key);
    let scenarioKey = key;
    let encKey = null;

    if (!scenario) {
      const scenKeyFromEnc = getScenarioKeyForEncounter(key);
      if (!scenKeyFromEnc) {
        ui.notifications?.warn?.(`encounters.testFire: no scenario or encounter mapping for "${key}"`);
        return;
      }
      scenarioKey = scenKeyFromEnc;
      encKey = key;
      scenario = getScenario(scenarioKey);
    }

    if (!scenario) {
      ui.notifications?.warn?.(`encounters.testFire: scenario "${scenarioKey}" not defined`);
      return;
    }

    const ctx = {
      ...opts,
      source: opts.source || "manual-testFire",
      encounter: {
        triggered: true,
        key: encKey,
        tier: scenario.tableTier,
        result: {
          key: encKey,
          label: scenario.label,
          tier: scenario.tableTier
        }
      }
    };

    log("testFire: launching scenario", scenarioKey, ctx);
    await launchScenario(scenarioKey, ctx);
  }

  function publishAPI() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};

    const existing = game.bbttcc.api.encounters || {};

    game.bbttcc.api.encounters = {
      ...existing,
      getScenario,
      listScenarios,
      getSceneConfig,
      listMappings,
      launchFromEncounterCtx,
      launchForEncounterKey,
      launchScenario,
      testFire,
      _launcher: existing._launcher || null,
      _spawner: existing._spawner || null
    };

    log("Encounter API published on game.bbttcc.api.encounters");
  }

  Hooks.once("ready", publishAPI);
  try {
    if (game?.ready) publishAPI();
  } catch (e) {
    warn("publishAPI immediate failed:", e);
  }
})();
