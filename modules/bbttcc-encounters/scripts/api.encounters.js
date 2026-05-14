// bbttcc-encounters/scripts/api.encounters.js

(() => {
  const TAG = "[bbttcc-encounters/api]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // ---------------------------------------------------------------------------
  // Encounter → Scenario → Scene registry
  // ---------------------------------------------------------------------------

  const ENCOUNTER_SCENARIOS = {
    // Original P0 travel encounters
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
    border_incident:     "travel_border_incident_t2",

    // NEW: Travel Arc / Fiat Engine encounters
    weather_front:               "travel_weather_front_t3",
    supply_shortage:             "travel_supply_shortage_t2",
    wilderness_push:             "travel_wilderness_push_t3",
    trade_convoy:                "travel_trade_convoy_t2",
    mutant_wildlife_t2:          "travel_mutant_wildlife_t2",
    mutant_wildlife_t3:          "travel_mutant_wildlife_t3",
    qlipothic_shambler_t2:       "travel_qlipothic_shambler_t2",
    geometry_serpent_t3:         "travel_geometry_serpent_t3",
    slippage_wraith_t3:          "travel_slippage_wraith_t3",
    qliphotic_whorl_t4:          "travel_qliphotic_whorl_t4",
    apex_predator_t4:            "travel_apex_predator_t4",
    border_incident_remote:      "travel_border_incident_remote_t2",
    faction_parley_roaming:      "travel_faction_parley_roaming_t2",
    spark_echo_rare:             "travel_spark_echo_rare_t3",
    scout_signs:                 "travel_scout_signs_t1",
    scout_signs_valuable:        "travel_scout_signs_valuable_t1",
    desenitarius_maarg:          "travel_desenitarius_maarg_t4",
    raider_raze_team:            "travel_raider_raze_team_t3",
  
    apex_predator:         "travel_apex_predator_t4",
    qliphotic_whorl:       "travel_qliphotic_whorl_t4",
    geometry_serpent:      "travel_geometry_serpent_t3",
    slippage_wraith:       "travel_slippage_wraith_t3",
    qlipothic_shambler:    "travel_qlipothic_shambler_t2",
};

  
  // ---------------------------------------------------------------------------
  // External Scenario Registry (Campaign Builder / other modules)
  // ---------------------------------------------------------------------------

  // External scenarios registered at runtime (e.g., from Campaign Builder)
  const EXTERNAL_SCENARIOS = Object.create(null);
  const EXTERNAL_META = Object.create(null);

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
          uuid: "Scene.QCx22OiX6AM0bodJ",
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
          uuid: "Scene.GTs0K70hOOHD3cFt",
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
          uuid: "Scene.J1hcE6SjQiHox1UM",
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
          uuid: "Scene.Z29kqXWCjTjS6boB",
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
      returnSceneUuid: "Scene.ToOORAjL0BYljIth",

      steps: [
        {
          kind: "scene",
          uuid: "Scene.txTee8er5R1FBFbL",
          name: "Hidden Vault Approach",
          role: "approach"
        },
        {
          kind: "scene",
          uuid: "Scene.OoUCH9pK6KrKbwbl",
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
          uuid: "Scene.ftPsLtpmnuk8gTE2", // transition
          name: "Rock Slide Cinematics",
          role: "cutscene",
          autoAdvanceMs: 16000
        },
        {
          kind: "scene",
          uuid: "Scene.FW4US9vyQHvZd6Zq", // post
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
          uuid: "Scene.FW4US9vyQHvZd6Zq",
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
          uuid: "Scene.Rgddw2DDDlXpXmkY",
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
          uuid: "Scene.dXbunN4zoSjndUhv",
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
          uuid: "Scene.y7VWxjXQ0eSk1c1r",
          name: "Border Incident",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Recon / Narrative — Scout Signs
    // -----------------------------------------------------------------------
    travel_scout_signs_t1: {
      key: "travel_scout_signs_t1",
      label: "Scout Signs",
      type: "travel",
      category: "travel",
      subcategory: "recon",
      scale: "macro",
      tableTier: 1,
      tikkunTie: "Netzach",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.xXw00PVDKGt5TwHm",
          name: "Scout Signs",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // Travel / Recon / Narrative — Scout Signs (Valuable)
    // -----------------------------------------------------------------------
    travel_scout_signs_valuable_t1: {
      key: "travel_scout_signs_valuable_t1",
      label: "Scout Signs (Valuable)",
      type: "travel",
      category: "travel",
      subcategory: "recon",
      scale: "macro",
      tableTier: 1,
      tikkunTie: "Netzach",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.iS8n46hr33HPc1Nu",
          name: "Scout Signs (Valuable)",
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
      returnSceneUuid: "Scene.ToOORAjL0BYljIth",

      steps: [
        {
          kind: "scene",
          uuid: "Scene.EfQaQcxetUSQbjZY",
          name: "Rail Yard Takeover",
          role: "main"
        }
      ]
    },

    // -----------------------------------------------------------------------
    // NEW TRAVEL ARC / FIAT SCENARIOS
    // -----------------------------------------------------------------------

    // Travel / Hazard — Weather Front (Tier 3)
    travel_weather_front_t3: {
      key: "travel_weather_front_t3",
      label: "Weather Front (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "hazard",
      scale: "macro",
      tableTier: 3,
      tikkunTie: "Yesod",
      steps: [
        {
          kind: "scene",
          uuid: "Scene.Efn18gJZoeXqS0KD",
          name: "Weather Front",
          role: "main"
        }
      ]
    },

    // Supply Shortage (narrative)
    travel_supply_shortage_t2: {
      key: "travel_supply_shortage_t2",
      label: "Supply Shortage (Tier 2)",
      type: "travel",
      category: "travel",
      subcategory: "narrative",
      scale: "macro",
      tableTier: 2,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.5EN2EA3nKK0Cmsoe",
          name: "Supply Shortage",
          role: "main"
        }
      ]
    },

    // Wilderness Push (hazard)
    travel_wilderness_push_t3: {
      key: "travel_wilderness_push_t3",
      label: "Wilderness Push (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "hazard",
      scale: "macro",
      tableTier: 3,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.5EN2EA3nKK0Cmsoe",
          name: "Wilderness Push",
          role: "main"
        }
      ]
    },

    // Trade Convoy (social/factional)
    travel_trade_convoy_t2: {
      key: "travel_trade_convoy_t2",
      label: "Trade Convoy (Tier 2)",
      type: "travel",
      category: "social",
      subcategory: "factional",
      scale: "hybrid",
      tableTier: 2,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.chfy7Tg8UgyxNXMs",
          name: "Trade Convoy",
          role: "main"
        }
      ]
    },

    // Mutant Wildlife T2
    travel_mutant_wildlife_t2: {
      key: "travel_mutant_wildlife_t2",
      label: "Mutant Wildlife (Tier 2)",
      type: "travel",
      category: "travel",
      subcategory: "combat",
      scale: "hybrid",
      tableTier: 2,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.FsmAszf4kPTkDGia",
          name: "Mutant Wildlife (T2)",
          role: "main"
        }
      ]
    },

    // Mutant Wildlife T3
    travel_mutant_wildlife_t3: {
      key: "travel_mutant_wildlife_t3",
      label: "Mutant Apex Wildlife (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "combat",
      scale: "hybrid",
      tableTier: 3,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.1d8vlsPgGTFPDgj1",
          name: "Mutant Wildlife (T3)",
          role: "main"
        }
      ]
    },

    // Qlipothic Shambler
    travel_qlipothic_shambler_t2: {
      key: "travel_qlipothic_shambler_t2",
      label: "Qlipothic Shambler (Tier 2)",
      type: "travel",
      category: "travel",
      subcategory: "combat",
      scale: "hybrid",
      tableTier: 2,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.pTb1WmtpBXjs8uE2",
          name: "Qlipothic Shambler",
          role: "main"
        }
      ]
    },

    // Geometry Serpent
    travel_geometry_serpent_t3: {
      key: "travel_geometry_serpent_t3",
      label: "Geometry Serpent (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "hazard",
      scale: "macro",
      tableTier: 3,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.taGuNFFKD4vjRnvV",
          name: "Geometry Serpent",
          role: "main"
        }
      ]
    },

    // Slippage Wraith
    travel_slippage_wraith_t3: {
      key: "travel_slippage_wraith_t3",
      label: "Slippage Wraith (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "combat",
      scale: "hybrid",
      tableTier: 3,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.vGQONVRmHylobYQG",
          name: "Slippage Wraith",
          role: "main"
        }
      ]
    },

    // Qliphotic Whorl
    travel_qliphotic_whorl_t4: {
      key: "travel_qliphotic_whorl_t4",
      label: "Qliphotic Whorl (Tier 4)",
      type: "travel",
      category: "travel",
      subcategory: "mystic",
      scale: "macro",
      tableTier: 4,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.hvlDRo88BeUvm0C2",
          name: "Qliphotic Whorl",
          role: "main"
        }
      ]
    },

    // Apex Predator
    travel_apex_predator_t4: {
      key: "travel_apex_predator_t4",
      label: "Apex Predator (Tier 4)",
      type: "travel",
      category: "travel",
      subcategory: "combat",
      scale: "hybrid",
      tableTier: 4,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.vQpd0FRyazX3HmOq",
          name: "Apex Predator",
          role: "main"
        }
      ]
    },

    // Border Incident (Remote variant)
    travel_border_incident_remote_t2: {
      key: "travel_border_incident_remote_t2",
      label: "Border Incident (Remote, Tier 2)",
      type: "travel",
      category: "social",
      subcategory: "conflict",
      scale: "macro",
      tableTier: 2,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.MwZ4c42W6dZHoKVz",
          name: "Border Incident Remote",
          role: "main"
        }
      ]
    },

    // Roaming Faction Parley
    travel_faction_parley_roaming_t2: {
      key: "travel_faction_parley_roaming_t2",
      label: "Roaming Faction Parley (Tier 2)",
      type: "travel",
      category: "social",
      subcategory: "diplomacy",
      scale: "macro",
      tableTier: 2,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.pAEUaUAorUlsUdDQ",
          name: "Roaming Parley",
          role: "main"
        }
      ]
    },

    // Spark Echo Rare
    travel_spark_echo_rare_t3: {
      key: "travel_spark_echo_rare_t3",
      label: "Spark Echo (Rare, Tier 3)",
      type: "travel",
      category: "weird",
      subcategory: "tikkun",
      scale: "hybrid",
      tableTier: 3,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.jcLvxMfj26vD5K1T",
          name: "Spark Echo (Rare)",
          role: "main"
        }
      ]
    },

    // Desenitarius Maarg — Worldboss
    travel_desenitarius_maarg_t4: {
      key: "travel_desenitarius_maarg_t4",
      label: "Desenitarius Maarg (Worldboss, Tier 4)",
      type: "travel",
      category: "travel",
      subcategory: "worldboss",
      scale: "macro",
      tableTier: 4,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.J3Nn4iz8vuYkog70",
          name: "Desenitarius Maarg Cinematics",
          role: "cutscene",
          autoAdvanceMs: 8000
        },
        {
          kind: "scene",
          uuid: "Scene.54g6NWPQyfAXLB3B",
          name: "Desenitarius Maarg",
          role: "post"
        }
      ]
    },

    // Raider Raze Team
    travel_raider_raze_team_t3: {
      key: "travel_raider_raze_team_t3",
      label: "Raider Raze Team (Tier 3)",
      type: "travel",
      category: "travel",
      subcategory: "combat",
      scale: "hybrid",
      tableTier: 3,
      steps: [
        {
          kind: "scene",
          uuid: "Scene.3mVDGYDZIwHe8CR1",
          name: "Raider Raze Team",
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
    return SCENARIOS[scenarioKey] ?? EXTERNAL_SCENARIOS[scenarioKey] ?? null;
  }

  function listScenarios() {
    const core = Object.values(SCENARIOS).map(s => ({ ...s, _source: "core" }));
    const ext  = Object.values(EXTERNAL_SCENARIOS).map(s => ({ ...s, _source: EXTERNAL_META[s.key]?.source || "external" }));
    return [...core, ...ext];
  }


  function getScenarioKeyForEncounter(k) {
    return k ? ENCOUNTER_SCENARIOS[k] ?? null : null;
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
    // Prefer explicit mapping, but tolerate encounter keys that are *already* scenario keys
    // (e.g. campaign-authored encounters registered into the external scenario registry).
    let scenarioKey = getScenarioKeyForEncounter(encKey);
    if (!scenarioKey) {
      // If a scenario exists under the same key, use it directly.
      const s = getScenario(encKey);
      if (s) scenarioKey = encKey;
      else {
        warn("launchForEncounterKey: no scenario mapping for encounter key", encKey);
        return;
      }
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

    let scenarioKey = String(key).trim();
    let scenario = getScenario(scenarioKey);

    // If not a scenario, treat as an encounter key and map it
    if (!scenario) {
      const scenKeyFromEnc = getScenarioKeyForEncounter(scenarioKey);
      if (!scenKeyFromEnc) {
        ui.notifications?.warn?.(`encounters.testFire: no scenario or encounter mapping for "${scenarioKey}"`);
        return;
      }
      scenarioKey = scenKeyFromEnc;
      scenario = getScenario(scenarioKey);
      if (!scenario) {
        ui.notifications?.warn?.(`encounters.testFire: mapped scenario "${scenarioKey}" not found`);
        return;
      }
    }

    const ctx = {
      ...opts.ctx,
      source: opts.source || "encounters.testFire",
      encounter: opts.encounter || null,
      scenario: {
        key: scenarioKey,
        label: scenario.label,
        tier: scenario.tableTier
      }
    };

    log("testFire: launching scenario", scenarioKey, ctx);
    await launchScenario(scenarioKey, ctx);
  }

  // ---------------------------------------------------------------------------
  // External registry API
  // ---------------------------------------------------------------------------

  function hasScenario(key) {
    return !!getScenario(key);
  }

  function registerScenario(scenario, opts = {}) {
    const key = String(scenario?.key || "").trim();
    if (!key) {
      warn("registerScenario: scenario.key required");
      return false;
    }

    const source = String(opts.source || "external").trim();
    const force = !!opts.force;

    // Don't overwrite core scenarios unless force is true
    if (!force && SCENARIOS[key]) {
      warn("registerScenario: refusing to overwrite core scenario", key);
      return false;
    }

    EXTERNAL_SCENARIOS[key] = { ...scenario, key };
    EXTERNAL_META[key] = { source, ts: Date.now() };
    return true;
  }

  function unregisterScenario(key, opts = {}) {
    key = String(key || "").trim();
    if (!key) return false;

    if (!EXTERNAL_SCENARIOS[key]) return false;

    const wantSource = opts.source ? String(opts.source).trim() : null;
    const metaSource = EXTERNAL_META[key]?.source ?? null;

    if (wantSource && metaSource && wantSource !== metaSource) {
      warn("unregisterScenario: source mismatch; refusing", { key, wantSource, metaSource });
      return false;
    }

    delete EXTERNAL_SCENARIOS[key];
    delete EXTERNAL_META[key];
    return true;
  }

  function clearExternalScenarios(opts = {}) {
    const wantSource = opts.source ? String(opts.source).trim() : null;

    for (const key of Object.keys(EXTERNAL_SCENARIOS)) {
      const metaSource = EXTERNAL_META[key]?.source ?? null;
      if (!wantSource || wantSource === metaSource) {
        delete EXTERNAL_SCENARIOS[key];
        delete EXTERNAL_META[key];
      }
    }
  }

  function normalizeSceneUuid(u) {
  u = String(u || "").trim();
  if (!u) return null;
  return u.startsWith("Scene.") ? u : `Scene.${u}`;
}


function registerCampaignBeatScenario(campaignId, beat) {
  if (!campaignId || !beat) return false;

  const beatId = String(beat.id || "").trim();
  const key =
    String(beat?.encounter?.key || beat?.encounterKey || beat?.scenarioKey || beatId || "").trim();

  if (!key) {
    warn("registerCampaignBeatScenario: missing key (beat.encounter.key or beat.id)", beat);
    return false;
  }

  const source = `campaign:${campaignId}`;

  // Scene reference helpers
  const _pickSceneUuid = (raw) => {
    const u = normalizeSceneUuid(raw);
    return u || null;
  };

  // Cinematic support ---------------------------------------------------------
  // A cinematic beat is a two-scene chain:
  //  - activate "start" scene
  //  - wait autoAdvanceMs
  //  - activate "next" scene
  //
  // Authoring can be either:
  //  - beat.type === "cinematic"
  //  - OR beat.cinematic.enabled === true
  //
  // Stored fields (Beat Editor):
  //  beat.cinematic = { enabled, startSceneId, durationMs, nextSceneId }
  const isCinematic =
    String(beat.type || "").trim() === "cinematic" ||
    !!(beat.cinematic && beat.cinematic.enabled);

  const cinematic = beat.cinematic || {};
  const durationMsRaw =
    (cinematic.durationMs != null ? cinematic.durationMs : beat.autoAdvanceMs);
  const durationMs =
    Math.max(0, Math.floor(Number(durationMsRaw || 0))) || 0;

  // For backwards-compat, tolerate existing "scene_transition" shape where:
  //  beat.sceneId is the start scene, and beat.outcomes.success is used as nextSceneId (scene uuid/id)
  const legacyStartRaw = beat.sceneUuid || beat.sceneId || beat.scene || beat.sceneID || null;
  const legacyNextRaw =
    (beat.outcomes && (beat.outcomes.success || beat.outcomes.next)) ||
    beat.nextSceneId || beat.nextSceneUuid || null;

  const startSceneUuid = isCinematic
    ? _pickSceneUuid(cinematic.startSceneId || legacyStartRaw)
    : _pickSceneUuid(legacyStartRaw);

  const nextSceneUuid = isCinematic
    ? _pickSceneUuid(cinematic.nextSceneId || legacyNextRaw)
    : null;

  // Steps: show beat description first (if any), then activate the scene(s).
  const steps = [];
  const descHtml = String(beat.description || beat.desc || beat.text || "").trim();
  if (descHtml) {
    steps.push({
      kind: "text",
      title: beat.label || beat.name || key,
      html: descHtml,
      role: "briefing"
    });
  }

  if (isCinematic) {
    if (startSceneUuid) {
      const step = {
        kind: "scene",
        uuid: startSceneUuid,
        name: beat.label || beat.name || key,
        role: "cutscene"
      };
      if (durationMs > 0) step.autoAdvanceMs = durationMs;
      steps.push(step);
    }
    if (nextSceneUuid) {
      steps.push({
        kind: "scene",
        uuid: nextSceneUuid,
        name: beat.label || beat.name || key,
        role: "post"
      });
    }
  } else {
    if (startSceneUuid) {
      steps.push({
        kind: "scene",
        uuid: startSceneUuid,
        name: beat.label || beat.name || key,
        role: "main"
      });
    }
  }

  const scenario = {
    key,
    label: beat.label || beat.name || key,
    type: isCinematic ? "cinematic" : "campaign",
    tableTier: beat?.encounter?.tier ?? beat?.tier ?? null,
    steps,
    campaignId,
    beatId,
    // return scene (if beat sets it, it wins; else scenario runner may use map return)
    returnSceneUuid:
      beat.returnSceneUuid ??
      beat.returnToSceneUuid ??
      beat.returnScene ??
      null,
    spawn: {
      mode: "center",
      actors: Array.isArray(beat.actors) ? beat.actors.slice() : [],
      spawnedBy: source
    }
  };

  return registerScenario(scenario, { source, force: true });
}


function publishAPI(
) {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};

    const existing = game.bbttcc.api.encounters || {};

    // Merge into existing API, DO NOT touch _launcher/_spawner here.
    game.bbttcc.api.encounters = {
      ...existing,
      getScenario,
      listScenarios,
      getSceneConfig,
      listMappings,
      getScenarioKeyForEncounter,
      launchFromEncounterCtx,
      launchForEncounterKey,
      launchScenario,
      testFire,
      hasScenario,
      registerScenario,
      unregisterScenario,
      clearExternalScenarios,
      registerCampaignBeatScenario
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
