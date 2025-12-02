/* ----------------------------------------- */
/* BBTTCC Travel Arc Engine v1.0            */
/* modules/bbttcc-travel/scripts            */
/* ----------------------------------------- */

(() => {
  const MOD_ID = "bbttcc-travel";
  const TAG    = "[bbttcc-travel-arc-engine v1.0]";

  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const err  = (...a) => console.error(TAG, ...a);

  // ----------------------------------------- //
  // RNG (seeded, deterministic)               //
  // ----------------------------------------- //

  // Simple mulberry32 PRNG
  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStringToSeed(str) {
    if (!str) return 0xDEADBEEF;
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return h >>> 0;
  }

  // ----------------------------------------- //
  // Core Arc Engine                           //
  // ----------------------------------------- //

  class TravelArcEngine {
    constructor() {
      this._seed = hashStringToSeed("bbttcc-travel-default-seed");
      this._rng  = mulberry32(this._seed);
    }

    /** Set deterministic seed (number or string). */
    setSeed(seed) {
      if (typeof seed === "string") {
        this._seed = hashStringToSeed(seed);
      } else if (typeof seed === "number") {
        this._seed = seed >>> 0;
      } else {
        warn("setSeed called with non-string/non-number seed:", seed);
        this._seed = hashStringToSeed("bbttcc-travel-default-seed");
      }
      this._rng = mulberry32(this._seed);
      log("Seed set:", this._seed);
      return this._seed;
    }

    /** Get current seed (for logging / replay). */
    getSeed() {
      return this._seed;
    }

    /** Internal uniform [0,1). */
    _random() {
      return this._rng();
    }

    /**
     * Roll a weighted key from an array of { key, weight } entries.
     * Returns null if no valid entries.
     */
    _weightedPick(entries) {
      const valid = (entries || []).filter(e => e && e.weight > 0);
      if (!valid.length) return null;

      const total = valid.reduce((s, e) => s + e.weight, 0);
      let roll = this._random() * total;
      for (const e of valid) {
        if (roll < e.weight) return e.key;
        roll -= e.weight;
      }
      return valid[valid.length - 1].key;
    }

    // --------------------------------------- //
    // Weighting Helpers                       //
    // --------------------------------------- //

    /**
     * Compute baseline weights for a hex / step.
     *
     * stepCtx is intentionally loose so the Travel Planner can
     * give us whatever it knows without tight coupling:
     *
     * {
     *   terrain: "plains" | "swamp" | "forest" | "highlands" | "faultline" | "ruins" | ...
     *   hasRoad: boolean
     *   regionHeat: number   // 0–3 suggested
     *   darkness: number     // world darkness level
     *   stepsOnRoute: number // how many hexes moved so far on this route
     * }
     */
    computeWeights(stepCtx = {}) {
      const terrain    = (stepCtx.terrain || "plains").toLowerCase();
      const hasRoad    = !!stepCtx.hasRoad;
      const regionHeat = Number(stepCtx.regionHeat ?? 0);
      const darkness   = Number(stepCtx.darkness ?? 0);
      const steps      = Number(stepCtx.stepsOnRoute ?? 0);

      // Base weights
      let hazard_weight  = 1;
      let monster_weight = 1;
      let rare_weight    = 0.05; // 5% baseline "world oddities"

      // Terrain-specific shaping
      switch (terrain) {
        case "swamp":
        case "marsh":
          hazard_weight  += 1.5;
          monster_weight += 0.5;
          break;
        case "forest":
          hazard_weight  += 0.5;
          monster_weight += 1;
          break;
        case "faultline":
        case "slippage":
          hazard_weight  += 2;
          monster_weight += 0.5;
          rare_weight    += 0.05;
          break;
        case "highlands":
        case "mountains":
          hazard_weight  += 1;
          monster_weight += 1;
          break;
        case "ruins":
          monster_weight += 1;
          rare_weight    += 0.05;
          break;
        default: // plains, roads, etc.
          break;
      }

      // Roads: fewer random monsters, more trade / convoy
      if (hasRoad) {
        monster_weight *= 0.6;
        hazard_weight  *= 0.8;
        rare_weight    += 0.02;
      }

      // Region "heat" (hostility)
      hazard_weight  += 0.3 * regionHeat;
      monster_weight += 0.4 * regionHeat;

      // Darkness: more scary stuff, more chance for rare weird
      hazard_weight  += 0.2 * darkness;
      monster_weight += 0.3 * darkness;
      rare_weight    += 0.01 * darkness;

      // Long stretches of road: rare boss ramp-up
      let worldboss_weight = 0;
      if (hasRoad && steps >= 5 && darkness >= 2) {
        // roughly 1–3% chance per hex as in sprint doc
        worldboss_weight = 0.01 + 0.01 * Math.min(steps - 4, 2); // 1–3%
      }

      return {
        hazard_weight: Math.max(0, hazard_weight),
        monster_weight: Math.max(0, monster_weight),
        rare_weight: Math.max(0, rare_weight),
        worldboss_weight: Math.max(0, worldboss_weight)
      };
    }

    // --------------------------------------- //
    // Encounter Tables                        //
    // --------------------------------------- //

    /**
     * P0 / existing hazards you already have wired:
     * bandit_ambush, rockslide, acid_bog, hidden_ruins, spark_echo,
     * minor_radiation_pocket, etc.
     *
     * P1 hazards go here too.
     */
    _buildHazardTable(stepCtx, weights) {
      const { terrain = "plains", hasRoad = false } = stepCtx;

      const entries = [];

      // P0s (already implemented)
      entries.push(
        { key: "bandit_ambush",          weight: hasRoad ? 2 : 0.5 },
        { key: "rockslide",              weight: ["highlands", "mountains", "faultline"].includes(terrain) ? 2 : 0.1 },
        { key: "acid_bog",               weight: terrain === "swamp" ? 1.5 : 0.1 },
        { key: "hidden_ruins",           weight: terrain === "ruins" ? 1.5 : 0.8 },
        { key: "spark_echo",             weight: 0.7 },
        { key: "minor_radiation_pocket", weight: 0.8 }
      );

      // P1s (Option A+ sprint doc)
      entries.push(
        { key: "weather_front",    weight: 1.0 },
        { key: "supply_shortage",  weight: hasRoad ? 0.5 : 1.2 },
        { key: "wilderness_push",  weight: terrain === "forest" || terrain === "wilderness" ? 1.2 : 0.6 },
        { key: "trade_convoy",     weight: hasRoad ? 1.8 : 0.1 },
        { key: "mutant_wildlife_t2", weight: 0.8 },
        { key: "mutant_wildlife_t3", weight: 0.4 }
      );

      // Scale all by hazard_weight
      const scale = weights.hazard_weight ?? 1;
      return entries.map(e => ({ key: e.key, weight: e.weight * scale }));
    }

    /** Away-team monster fights (allies of Encounter Engine). */
    _buildMonsterTable(stepCtx, weights) {
      const terrain = (stepCtx.terrain || "plains").toLowerCase();

      const entries = [
        { key: "qlipothic_shambler", weight: ["swamp", "marsh", "forest"].includes(terrain) ? 1.5 : 0.5 },
        { key: "geometry_serpent",   weight: ["faultline", "slippage", "highlands", "mountains"].includes(terrain) ? 1.8 : 0.3 },
        { key: "slippage_wraith",    weight: ["forest", "faultline"].includes(terrain) ? 1.3 : 0.4 }
      ];

      const scale = weights.monster_weight ?? 1;
      return entries.map(e => ({ key: e.key, weight: e.weight * scale }));
    }

    /** Rare events excluding the trail dragon. */
    _buildRareTable(stepCtx, weights) {
      const entries = [
        { key: "spark_echo_rare",        weight: 1.0 },
        { key: "faction_parley_roaming", weight: 0.7 },
        { key: "border_incident_remote", weight: 0.5 }
      ];
      const scale = weights.rare_weight ?? 0.05;
      return entries.map(e => ({ key: e.key, weight: e.weight * scale }));
    }

    // --------------------------------------- //
    // Step Resolution API                     //
    // --------------------------------------- //

    /**
     * Roll for a single travel step.
     *
     * Returns an object describing what *should* happen on this hex:
     *
     * {
     *   seed,                 // RNG seed used
     *   weights: {...},       // resolved weights
     *   rolls: {...},         // raw probabilities rolled
     *   worldboss: { key } | null,
     *   hazard:   { key } | null,
     *   monster:  { key } | null,
     *   rare:     { key } | null
     * }
     *
     * The Travel Planner or calling code is responsible for taking
     * these keys and handing them to the Encounter Engine.
     */
    rollStep(stepCtx = {}) {
      const weights = this.computeWeights(stepCtx);

      // 1) World boss (Desenitarius Maarg) check
      let worldboss = null;
      if ((weights.worldboss_weight ?? 0) > 0) {
        const roll = this._random();
        if (roll < weights.worldboss_weight) {
          worldboss = { key: "desenitarius_maarg" }; // “Died of Dysentery”
        }
      }

      // 2) Hazard & monster & rare picks
      const hazardTable  = this._buildHazardTable(stepCtx, weights);
      const monsterTable = this._buildMonsterTable(stepCtx, weights);
      const rareTable    = this._buildRareTable(stepCtx, weights);

      const hazardKey  = this._weightedPick(hazardTable);
      const monsterKey = this._weightedPick(monsterTable);
      const rareKey    = this._weightedPick(rareTable);

      const result = {
        seed: this._seed,
        weights,
        rolls: {
          worldbossChance: weights.worldboss_weight ?? 0
        },
        worldboss: worldboss,
        hazard:   hazardKey  ? { key: hazardKey }  : null,
        monster:  monsterKey ? { key: monsterKey } : null,
        rare:     rareKey    ? { key: rareKey }    : null
      };

      log("rollStep:", { stepCtx, result });
      return result;
    }

    // --------------------------------------- //
    // Route Simulation & Audit Tools          //
    // --------------------------------------- //

    /**
     * Simulate N steps of a route for a given context template.
     *
     * ctxTemplate is the same shape as stepCtx used by rollStep.
     * You can optionally override seed for reproducibility.
     */
    simulateRoute(steps = 10, ctxTemplate = {}, seed) {
      if (seed !== undefined) this.setSeed(seed);

      const history = [];
      for (let i = 0; i < steps; i++) {
        const stepCtx = {
          ...ctxTemplate,
          stepsOnRoute: (ctxTemplate.stepsOnRoute ?? 0) + i + 1
        };
        history.push(this.rollStep(stepCtx));
      }

      log("simulateRoute complete:", history);
      return history;
    }

    /**
     * Audit encounter frequencies over many simulated steps.
     * Useful for console testing & tuning.
     */
    auditFrequencies(opts = {}) {
      const {
        steps = 100,
        iterations = 1,
        ctxTemplate = {},
        seed
      } = opts;

      if (seed !== undefined) this.setSeed(seed);

      const counts = {
        worldboss: 0,
        hazard: {},
        monster: {},
        rare: {}
      };

      const bump = (bucket, key) => {
        if (!key) return;
        if (!bucket[key]) bucket[key] = 0;
        bucket[key] += 1;
      };

      for (let j = 0; j < iterations; j++) {
        for (let i = 0; i < steps; i++) {
          const stepCtx = {
            ...ctxTemplate,
            stepsOnRoute: (ctxTemplate.stepsOnRoute ?? 0) + i + 1
          };
          const r = this.rollStep(stepCtx);
          if (r.worldboss) counts.worldboss += 1;
          bump(counts.hazard,  r.hazard  && r.hazard.key);
          bump(counts.monster, r.monster && r.monster.key);
          bump(counts.rare,    r.rare    && r.rare.key);
        }
      }

      log("auditFrequencies:", { opts, counts });
      return counts;
    }
  }

  // ----------------------------------------- //
  // Hook into game.bbttcc.api.travel          //
  // ----------------------------------------- //

  function registerArcEngine() {
    const g = globalThis;

    g.game = g.game || {};
    g.game.bbttcc = g.game.bbttcc || {};
    g.game.bbttcc.api = g.game.bbttcc.api || {};
    g.game.bbttcc.api.travel = g.game.bbttcc.api.travel || {};

    const engine = new TravelArcEngine();

    g.game.bbttcc.api.travel.arcEngine = engine;
    g.game.bbttcc.api.travel.arc = {
      /** Low-level engine instance (for advanced usage). */
      engine,

      /** Convenience wrappers. */
      rollStep:    (stepCtx)          => engine.rollStep(stepCtx),
      simulate:    (steps, ctx, seed) => engine.simulateRoute(steps, ctx, seed),
      audit:       (opts)             => engine.auditFrequencies(opts),
      setSeed:     (seed)             => engine.setSeed(seed),
      getSeed:     ()                 => engine.getSeed()
    };

    log("Travel Arc Engine registered at game.bbttcc.api.travel.arc");
  }

  Hooks.once("ready", () => {
    try {
      registerArcEngine();
    } catch (e) {
      err("Failed to register Travel Arc Engine:", e);
    }
  });

})();
