// bbttcc-aae/module.js
// Adaptive Moral Profile Engine v1.0 (POC)

const MODULE_ID = "bbttcc-aae";

/**
 * Conceptual types (for reference):
 *
 * type ValueAxisVector = {
 *   orderFreedom: number;        // -1 = Order, +1 = Freedom
 *   hierarchyHorizontal: number; // -1 = Hierarchy, +1 = Horizontalism
 *   mercySeverity: number;       // -1 = Mercy, +1 = Severity
 *   materialSpiritual: number;   // -1 = Material Prosperity, +1 = Spiritual/Ideological
 *   collectiveIndividual: number;// -1 = Collective Good, +1 = Individual Autonomy
 *   stabilityFlux: number;       // -1 = Stability, +1 = Flux/Revolution
 * };
 *
 * type StrategyWeights = {
 *   violence: number;
 *   nonLethal: number;
 *   intrigue: number;
 *   economy: number;
 *   softPower: number;
 *   diplomacy: number;
 *   faith: number;
 *   occult: number;  // special channel
 * };
 *
 * type MoralProfile = {
 *   factionId: string;
 *   values: ValueAxisVector;
 *   strategy: StrategyWeights;
 *   happinessDefinition: string;
 *   sufferingDefinition: string;
 *   primaryVirtue: string;   // e.g., "Freedom", "Discipline/Severity"
 *   missingVirtue: string;   // e.g., "Mercy (Chesed)"
 *   temptationVectors: string[];
 * };
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clampAxis(v) {
  return clamp(v, -1, 1);
}

function clamp01(v) {
  return clamp(v, 0, 1);
}

function emptyAxes() {
  return {
    orderFreedom: 0,
    hierarchyHorizontal: 0,
    mercySeverity: 0,
    materialSpiritual: 0,
    collectiveIndividual: 0,
    stabilityFlux: 0
  };
}

function baselineStrategy() {
  return {
    violence: 0.5,
    nonLethal: 0.5,
    intrigue: 0.5,
    economy: 0.5,
    softPower: 0.5,
    diplomacy: 0.5,
    faith: 0.5,
    occult: 0.5
  };
}

// Merge helpers
function addAxes(target, delta) {
  for (const k of Object.keys(target)) {
    if (delta[k] != null) target[k] += delta[k];
  }
}

function addStrategy(target, delta) {
  for (const k of Object.keys(target)) {
    if (delta[k] != null) target[k] += delta[k];
  }
}

// ---------------------------------------------------------------------------
// Mapping data: deltas by option name
// (v1 — you can expand this as you add more options)
// ---------------------------------------------------------------------------

/**
 * For each category, a mapping from item name to axis deltas.
 * Use name.startsWith(...) to match.
 */
const AXIS_DELTAS = {
  archetype: {
    "Archetype: Warlord": {
      orderFreedom:    -0.3,
      hierarchyHorizontal: -0.3,
      mercySeverity:   +0.3,
      materialSpiritual: -0.1,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.2
    },
    "Archetype: Hierophant": {
      orderFreedom:    -0.1,
      hierarchyHorizontal: -0.2,
      mercySeverity:   -0.2,
      materialSpiritual: +0.4,
      collectiveIndividual: -0.2,
      stabilityFlux:   -0.1
    },
    "Archetype: Mayor/Administrator": {
      orderFreedom:    -0.3,
      hierarchyHorizontal: -0.2,
      mercySeverity:   0,
      materialSpiritual: -0.3,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.3
    },
    "Archetype: Wizard/Scholar": {
      orderFreedom:    +0.05,
      hierarchyHorizontal: 0,
      mercySeverity:   0,
      materialSpiritual: +0.1,
      collectiveIndividual: +0.1,
      stabilityFlux:   -0.05
    },
    "Archetype: Ancient Blood": {
      orderFreedom:    -0.1,
      hierarchyHorizontal: -0.1,
      mercySeverity:   -0.1,
      materialSpiritual: +0.2,
      collectiveIndividual: -0.2,
      stabilityFlux:   -0.2
    },
    "Archetype: Squad Leader": {
      orderFreedom:    -0.1,
      hierarchyHorizontal: -0.1,
      mercySeverity:   +0.1,
      materialSpiritual: -0.1,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.05
    }
  },

  crew: {
    "Crew Type: Mercenary Band": {
      orderFreedom:    -0.1,
      hierarchyHorizontal: -0.1,
      mercySeverity:   +0.2,
      materialSpiritual: -0.1,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.1
    },
    "Crew Type: Peacekeeper Corps": {
      orderFreedom:    -0.1,
      hierarchyHorizontal: -0.05,
      mercySeverity:   -0.3,
      materialSpiritual: 0,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.2
    },
    "Crew Type: Covert Ops Cell": {
      orderFreedom:    +0.1,
      hierarchyHorizontal: +0.1,
      mercySeverity:   0,
      materialSpiritual: 0,
      collectiveIndividual: +0.1,
      stabilityFlux:   +0.2
    },
    "Crew Type: Cultural Ambassadors": {
      orderFreedom:    +0.05,
      hierarchyHorizontal: +0.1,
      mercySeverity:   -0.1,
      materialSpiritual: 0,
      collectiveIndividual: -0.1,
      stabilityFlux:   0
    },
    "Crew Type: Diplomatic Envoys": {
      orderFreedom:    0,
      hierarchyHorizontal: 0,
      mercySeverity:   -0.1,
      materialSpiritual: 0,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.05
    },
    "Crew Type: Survivors/Militia": {
      orderFreedom:    0,
      hierarchyHorizontal: 0,
      mercySeverity:   0,
      materialSpiritual: 0,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.05
    }
  },

  occult: {
    "Occult Association: Kabbalist": {
      orderFreedom:    0,
      hierarchyHorizontal: 0,
      mercySeverity:   0,
      materialSpiritual: +0.4,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.1
    },
    "Occult Association: Alchemist": {
      orderFreedom:    0,
      hierarchyHorizontal: 0,
      mercySeverity:   0,
      materialSpiritual: -0.1,
      collectiveIndividual: 0,
      stabilityFlux:   +0.1
    },
    "Occult Association: Tarot Mage": {
      orderFreedom:    0,
      hierarchyHorizontal: 0,
      mercySeverity:   0,
      materialSpiritual: +0.2,
      collectiveIndividual: +0.05,
      stabilityFlux:   +0.05
    },
    "Occult Association: Gnostic": {
      orderFreedom:    +0.1,
      hierarchyHorizontal: +0.1,
      mercySeverity:   -0.1,
      materialSpiritual: +0.3,
      collectiveIndividual: +0.05,
      stabilityFlux:   0
    },
    "Occult Association: Goetic Summoner": {
      orderFreedom:    +0.1,
      hierarchyHorizontal: +0.1,
      mercySeverity:   +0.2,
      materialSpiritual: +0.3,
      collectiveIndividual: +0.1,
      stabilityFlux:   +0.3
    },
    "Occult Association: Rosicrucian": {
      orderFreedom:    0,
      hierarchyHorizontal: 0,
      mercySeverity:   -0.1,
      materialSpiritual: +0.2,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.05
    }
  },

  politics: {
    "Political Affiliation: Democrat": {
      orderFreedom:    0,
      hierarchyHorizontal: -0.05,
      mercySeverity:   -0.1,
      materialSpiritual: -0.05,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.1
    },
    "Political Affiliation: Communist": {
      orderFreedom:    -0.2,
      hierarchyHorizontal: -0.1,
      mercySeverity:   0,
      materialSpiritual: -0.1,
      collectiveIndividual: -0.4,
      stabilityFlux:   -0.1
    },
    "Political Affiliation: Capitalist": {
      orderFreedom:    +0.1,
      hierarchyHorizontal: -0.3,
      mercySeverity:   +0.1,
      materialSpiritual: -0.4,
      collectiveIndividual: +0.3,
      stabilityFlux:   -0.05
    },
    "Political Affiliation: Monarchist": {
      orderFreedom:    -0.4,
      hierarchyHorizontal: -0.5,
      mercySeverity:   0,
      materialSpiritual: 0,
      collectiveIndividual: -0.2,
      stabilityFlux:   -0.4
    },
    "Political Affiliation: Theocrat": {
      orderFreedom:    -0.3,
      hierarchyHorizontal: -0.3,
      mercySeverity:   0,
      materialSpiritual: +0.4,
      collectiveIndividual: -0.2,
      stabilityFlux:   -0.2
    },
    "Political Affiliation: Militarist/Junta": {
      orderFreedom:    -0.4,
      hierarchyHorizontal: -0.4,
      mercySeverity:   +0.4,
      materialSpiritual: -0.1,
      collectiveIndividual: -0.1,
      stabilityFlux:   -0.2
    },
    "Political Affiliation: Fascist/Ultranationalist": {
      orderFreedom:    -0.5,
      hierarchyHorizontal: -0.5,
      mercySeverity:   +0.5,
      materialSpiritual: -0.1,
      collectiveIndividual: -0.3,
      stabilityFlux:   -0.3
    },
    "Political Affiliation: Tribalist/Clan": {
      orderFreedom:    0,
      hierarchyHorizontal: -0.1,
      mercySeverity:   -0.1,
      materialSpiritual: 0,
      collectiveIndividual: -0.3,
      stabilityFlux:   -0.1
    },
    "Political Affiliation: Anarchist": {
      orderFreedom:    +0.5,
      hierarchyHorizontal: +0.5,
      mercySeverity:   -0.1,
      materialSpiritual: 0,
      collectiveIndividual: -0.2,
      stabilityFlux:   +0.3
    }
  },

  enlightenment: {
    "Enlightenment: Sleeper": {
      mercySeverity:       +0.1,
      materialSpiritual:   -0.1
    },
    "Enlightenment: Awakened": {
      mercySeverity:       -0.05,
      materialSpiritual:   +0.05
    },
    "Enlightenment: Adept": {
      mercySeverity:       -0.1,
      materialSpiritual:   +0.1,
      collectiveIndividual:-0.1
    },
    "Enlightenment: Illuminated": {
      mercySeverity:       -0.2,
      materialSpiritual:   +0.1,
      collectiveIndividual:-0.1
    },
    "Enlightenment: Transcendent": {
      mercySeverity:       -0.3,
      materialSpiritual:   +0.2,
      collectiveIndividual:-0.2
    },
    "Enlightenment: Qliphothic": {
      mercySeverity:       +0.5,
      materialSpiritual:   +0.2,
      collectiveIndividual:+0.2,
      stabilityFlux:       +0.3
    }
  }
};

/**
 * Strategy deltas.
 */
const STRATEGY_DELTAS = {
  archetype: {
    "Archetype: Warlord": {
      violence:  +0.25,
      nonLethal: +0.10,
      intrigue:  +0.05,
      economy:   +0.05,
      softPower: -0.10,
      diplomacy: -0.10
    },
    "Archetype: Hierophant": {
      violence:  -0.10,
      nonLethal: +0.15,
      softPower: +0.25,
      diplomacy: +0.10,
      faith:     +0.25,
      occult:    +0.05
    },
    "Archetype: Mayor/Administrator": {
      violence:  -0.10,
      nonLethal: +0.05,
      intrigue:  +0.05,
      economy:   +0.25,
      softPower: +0.10,
      diplomacy: +0.10
    },
    "Archetype: Wizard/Scholar": {
      violence:  -0.05,
      intrigue:  +0.25,
      economy:   +0.05,
      softPower: +0.05,
      faith:     +0.10,
      occult:    +0.15
    },
    "Archetype: Ancient Blood": {
      nonLethal: +0.05,
      softPower: +0.20,
      diplomacy: +0.10,
      faith:     +0.15,
      occult:    +0.05
    },
    "Archetype: Squad Leader": {
      violence:  +0.15,
      nonLethal: +0.10,
      intrigue:  +0.10
    }
  },

  crew: {
    "Crew Type: Mercenary Band": {
      violence:  +0.25,
      nonLethal: +0.05,
      economy:   +0.05,
      softPower: -0.10,
      diplomacy: -0.05
    },
    "Crew Type: Peacekeeper Corps": {
      violence:  -0.10,
      nonLethal: +0.25,
      softPower: +0.10,
      diplomacy: +0.05
    },
    "Crew Type: Covert Ops Cell": {
      violence:  -0.05,
      intrigue:  +0.25,
      softPower: +0.05,
      occult:    +0.05
    },
    "Crew Type: Cultural Ambassadors": {
      violence:  -0.10,
      nonLethal: +0.05,
      intrigue:  +0.05,
      softPower: +0.25,
      diplomacy: +0.15,
      faith:     +0.05
    },
    "Crew Type: Diplomatic Envoys": {
      violence:  -0.10,
      intrigue:  +0.05,
      softPower: +0.10,
      diplomacy: +0.25,
      faith:     +0.05
    },
    "Crew Type: Survivors/Militia": {
      violence:  +0.10,
      nonLethal: +0.10,
      intrigue:  +0.05,
      economy:   +0.05,
      softPower: +0.05
    }
  },

  occult: {
    "Occult Association: Kabbalist": {
      intrigue:  +0.10,
      softPower: +0.15,
      faith:     +0.25,
      occult:    +0.20
    },
    "Occult Association: Alchemist": {
      economy:   +0.20,
      intrigue:  +0.05,
      softPower: +0.05,
      faith:     +0.05,
      occult:    +0.15
    },
    "Occult Association: Tarot Mage": {
      intrigue:  +0.20,
      softPower: +0.10,
      faith:     +0.10,
      occult:    +0.20
    },
    "Occult Association: Gnostic": {
      softPower: +0.15,
      faith:     +0.20,
      intrigue:  +0.10,
      occult:    +0.15
    },
    "Occult Association: Goetic Summoner": {
      violence:  +0.20,
      intrigue:  +0.15,
      softPower: -0.10,
      faith:     +0.10,
      occult:    +0.30
    },
    "Occult Association: Rosicrucian": {
      diplomacy: +0.10,
      softPower: +0.10,
      faith:     +0.15,
      occult:    +0.15,
      economy:   +0.05
    }
  },

  politics: {
    "Political Affiliation: Democrat": {
      softPower: +0.15,
      diplomacy: +0.15
    },
    "Political Affiliation: Communist": {
      economy:   +0.20,
      nonLethal: +0.15,
      softPower: +0.05
    },
    "Political Affiliation: Capitalist": {
      economy:   +0.25,
      intrigue:  +0.10,
      diplomacy: +0.05,
      softPower: -0.05
    },
    "Political Affiliation: Monarchist": {
      diplomacy: +0.15,
      softPower: +0.10,
      violence:  +0.05
    },
    "Political Affiliation: Theocrat": {
      softPower: +0.20,
      faith:     +0.25,
      diplomacy: -0.05
    },
    "Political Affiliation: Militarist/Junta": {
      violence:  +0.25,
      nonLethal: +0.15,
      softPower: -0.15,
      diplomacy: -0.10
    },
    "Political Affiliation: Fascist/Ultranationalist": {
      violence:  +0.30,
      softPower: +0.15,
      diplomacy: -0.25,
      intrigue:  +0.10
    },
    "Political Affiliation: Tribalist/Clan": {
      nonLethal: +0.10,
      violence:  +0.10,
      softPower: +0.05,
      diplomacy: -0.05
    },
    "Political Affiliation: Anarchist": {
      intrigue:  +0.25,
      softPower: +0.10,
      diplomacy: +0.05,
      violence:  -0.10,
      nonLethal: -0.05
    }
  },

  enlightenment: {
    "Enlightenment: Illuminated": {
      softPower: +0.10,
      faith:     +0.10
    },
    "Enlightenment: Transcendent": {
      softPower: +0.15,
      faith:     +0.15
    },
    "Enlightenment: Qliphothic": {
      violence:  +0.25,
      intrigue:  +0.15,
      softPower: -0.15,
      faith:     +0.05,
      occult:    +0.30
    }
  }
};

// ---------------------------------------------------------------------------
// Profile derivation
// ---------------------------------------------------------------------------

/**
 * Inspect an item's name and return the applicable key(s) & categories.
 */
function getItemKeysForMappings(name) {
  const keys = [];

  for (const [cat, map] of Object.entries(AXIS_DELTAS)) {
    for (const itemName of Object.keys(map)) {
      if (name.startsWith(itemName)) {
        keys.push({ category: cat, itemName });
      }
    }
  }
  return keys;
}

/**
 * Determine primary & missing virtue in a simple, thematic way.
 * v1: Look at mercySeverity and orderFreedom mostly.
 */
function deriveVirtues(values) {
  // Primary
  let primary = "Balance";
  if (values.orderFreedom > 0.4) primary = "Freedom";
  else if (values.orderFreedom < -0.4) primary = "Order";
  if (values.mercySeverity > 0.4) primary = "Discipline/Severity";
  else if (values.mercySeverity < -0.4) primary = "Mercy";

  // Missing virtue = complementary
  let missing = "Integration";
  if (primary === "Freedom") missing = "Order / Structure (Binah/Chokmah blend)";
  else if (primary === "Order") missing = "Freedom / Autonomy (Netzach/Hod blend)";
  else if (primary === "Discipline/Severity") missing = "Mercy (Chesed)";
  else if (primary === "Mercy") missing = "Justice/Boundaries (Gevurah)";

  return { primaryVirtue: primary, missingVirtue: missing };
}

/**
 * Simple text synthesis for happiness / suffering definitions.
 */
function makeHappinessDefinition(values) {
  const bits = [];

  if (values.orderFreedom > 0.3) bits.push("people are free from imposed authority");
  else if (values.orderFreedom < -0.3) bits.push("society is orderly and predictable");

  if (values.mercySeverity > 0.3) bits.push("wrongdoing is met with decisive consequences");
  else if (values.mercySeverity < -0.3) bits.push("mistakes are met with compassion and reform");

  if (values.collectiveIndividual < -0.3) bits.push("the community thrives together");
  else if (values.collectiveIndividual > 0.3) bits.push("individual potential can flourish");

  if (values.materialSpiritual > 0.3) bits.push("the world reflects deeper spiritual truths");
  else if (values.materialSpiritual < -0.3) bits.push("everyone’s material needs are met");

  if (!bits.length) bits.push("people can live according to their nature without being broken by the world");

  return "Happiness, to this faction, is when " + bits.join(", and ") + ".";
}

function makeSufferingDefinition(values) {
  const bits = [];

  if (values.orderFreedom > 0.3) bits.push("people are trapped under rigid hierarchies");
  else if (values.orderFreedom < -0.3) bits.push("chaos undermines safety and duty");

  if (values.mercySeverity > 0.3) bits.push("weakness and betrayal go unpunished");
  else if (values.mercySeverity < -0.3) bits.push("cruelty and vengeance define justice");

  if (values.collectiveIndividual < -0.3) bits.push("the many devour the individual");
  else if (values.collectiveIndividual > 0.3) bits.push("everyone is isolated and alone");

  if (values.materialSpiritual > 0.3) bits.push("the sacred is profaned or ignored");
  else if (values.materialSpiritual < -0.3) bits.push("poverty and scarcity grind people down");

  if (!bits.length) bits.push("people are forced to live in ways that betray their core values");

  return "Suffering, to this faction, is when " + bits.join(", and ") + ".";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const AAE_API = {

  /**
   * Generate and persist a MoralProfile for the given faction actor.
   * Expects: faction actor has items for Archetype, Crew Type, Occult Association, Political Affiliation, Enlightenment.
   */
  async generateMoralProfile(factionActor) {
    if (!factionActor) throw new Error(`[${MODULE_ID}] generateMoralProfile requires an Actor`);

    const axes = emptyAxes();
    const strat = baselineStrategy();

    const items = Array.from(factionActor.items ?? []);
    for (const it of items) {
      const name = String(it.name || "");
      const matches = getItemKeysForMappings(name);

      for (const { category, itemName } of matches) {
        const axisDelta = AXIS_DELTAS[category]?.[itemName];
        const stratDelta = STRATEGY_DELTAS[category]?.[itemName];
        if (axisDelta) addAxes(axes, axisDelta);
        if (stratDelta) addStrategy(strat, stratDelta);
      }
    }

    // Clamp
    for (const k of Object.keys(axes)) axes[k] = clampAxis(axes[k]);
    for (const k of Object.keys(strat)) strat[k] = clamp01(strat[k]);

    const { primaryVirtue, missingVirtue } = deriveVirtues(axes);
    const happinessDefinition = makeHappinessDefinition(axes);
    const sufferingDefinition = makeSufferingDefinition(axes);

    const temptationVectors = [];
    if (primaryVirtue === "Freedom")
      temptationVectors.push("Frame any compromise or structure as a return to oppression.");
    if (primaryVirtue === "Discipline/Severity")
      temptationVectors.push("Offer fast, harsh solutions and call mercy 'weakness'.");
    if (primaryVirtue === "Mercy")
      temptationVectors.push("Exploit their compassion with bad-faith actors and martyr traps.");

    const profile = {
      factionId: factionActor.id,
      values: axes,
      strategy: strat,
      happinessDefinition,
      sufferingDefinition,
      primaryVirtue,
      missingVirtue,
      temptationVectors
    };

    await factionActor.setFlag(MODULE_ID, "moralProfile", profile);
    return profile;
  },

  /**
   * Retrieve cached profile, or null.
   */
  getMoralProfile(factionActor) {
    if (!factionActor) return null;
    return factionActor.getFlag(MODULE_ID, "moralProfile") || null;
  },

  /**
   * Simple suggestion hook (stub) – you can expand this to full RecommendedAction objects.
   * For now, it just tells you which OP types they *prefer* to lean on.
   */
  suggestPreferredOps(factionActor) {
    const profile = this.getMoralProfile(factionActor);
    if (!profile) return [];

    const strat = profile.strategy;
    const entries = Object.entries(strat);
    entries.sort((a, b) => b[1] - a[1]); // highest preference first
    return entries.slice(0, 3).map(([type, weight]) => ({ type, weight }));
  }
};

// ---------------------------------------------------------------------------
// Foundry wiring
// ---------------------------------------------------------------------------

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = AAE_API;
  console.log(`[${MODULE_ID}] init (Adaptive Moral Profile Engine ready)`);
});

Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc || { api: {} };
  game.bbttcc.api.aae = AAE_API;
  console.log(`[${MODULE_ID}] ready (exposed as game.bbttcc.api.aae)`);
});
