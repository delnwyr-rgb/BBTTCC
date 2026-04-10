// modules/bbttcc-travel/scripts/travel.weather.registry.js
// BBTTCC Weather Registry (Alpha v1.0)
// Data-only. Safe to tweak and rebalance.

export const WEATHER_ARCHETYPES = {
  harmony_rain: {
    label: "Harmony Rain",
    duration: { min: 1, max: 3 },
    travel: { opDelta: -1 },
    radiation: { rpDelta: -1 },
    weights: { hazard: -1, monster: -1, spark: +2, faction: +1 },
    tags: ["sephirotic", "healing"]
  },

  dustfront: {
    label: "Dustfront / Toxic Storm",
    duration: { min: 1, max: 2 },
    travel: { opDelta: +2 },
    radiation: { rpDelta: +1 },
    weights: { hazard: +2, monster: +1, qliphoth: +1 },
    skillMods: { perception: -2 },
    tags: ["toxic", "low-visibility"]
  },

  qliphoth_storm: {
    label: "Qliphothic Thunderstorm",
    duration: { min: 1, max: 2 },
    radiation: { rpDelta: +2 },
    darkness: { check: true, dc: 12, onFail: +1 },
    weights: { hazard: +2, monster: +2, rare: +1, qliphoth: +2 },
    tags: ["qliphothic", "storm"]
  },

  memory_fog: {
    label: "Memory Fog",
    duration: { min: 1, max: 2 },
    travel: { opDelta: +1 },
    radiation: { rpDelta: 0 },
    weights: { hazard: +1, spark: +2 },
    skillMods: { navigation: -2 },
    tags: ["fog", "echo"]
  },

  ley_updraft: {
    label: "Ley-Heat Updraft",
    duration: { min: 1, max: 2 },
    travel: { opDelta: -1 },
    radiation: { rpDelta: +1, onlyIfRadiated: true },
    weights: { hazard: +1, monster: +1, spark: +1 },
    tags: ["ley", "slippage"]
  }
};
