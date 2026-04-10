// modules/bbttcc-travel/scripts/travel.weather.engine.js
// BBTTCC Weather Engine (Alpha v1.0)
// - Rolls a weatherKey based on light biases
// - Applies effects to a ctx object (non-destructive)
// - Writes temporary weather flags to a hex doc

import { WEATHER_ARCHETYPES } from "./travel.weather.registry.js";
import { weightedPick, rollBetween } from "./travel.weather.helpers.js";

export function rollWeather({ hex, world } = {}) {
  const weights = {};
  const keys = Object.keys(WEATHER_ARCHETYPES);

  // baseline weights
  for (const k of keys) weights[k] = 1;

  // terrain bias
  const terr = String(hex?.terrain || "").toLowerCase();
  if (terr === "forest" || terr === "jungle") weights.harmony_rain += 1;
  if (terr === "swamp"  || terr === "mire")   weights.memory_fog  += 1;
  if (terr === "mountains" || terr === "highlands") weights.ley_updraft += 1;

  // world pressure bias
  const dark = Number(world?.darkness || 0);
  if (Number.isFinite(dark) && dark >= 2) weights.qliphoth_storm += 2;

  // if future callers provide lastRP etc, this hook is ready
  if (world && world.lastRP) weights.dustfront += 1;

  return weightedPick(weights) || keys[0];
}

export function applyWeatherToContext(ctx, weatherKey) {
  const weather = WEATHER_ARCHETYPES[weatherKey];
  if (!weather || !ctx || typeof ctx !== "object") return;

  // keep it lightweight: a single key on ctx
  ctx.weather = weatherKey;

  // Ensure expected containers exist (non-destructive)
  if (!ctx.travel) ctx.travel = { opCost: 0 };
  if (typeof ctx.travel.opCost !== "number") ctx.travel.opCost = Number(ctx.travel.opCost || 0);

  if (!ctx.encounterWeights) ctx.encounterWeights = {};
  if (ctx.radiationDelta == null) ctx.radiationDelta = 0;

  // Travel OP delta
  if (weather.travel && typeof weather.travel.opDelta === "number") {
    ctx.travel.opCost += weather.travel.opDelta;
  }

  // Radiation delta (optional gating)
  if (weather.radiation && typeof weather.radiation.rpDelta === "number") {
    const onlyIfRadiated = !!weather.radiation.onlyIfRadiated;
    const hexRad = Number(ctx.hex?.radiation || 0);
    if (!onlyIfRadiated || (Number.isFinite(hexRad) && hexRad > 0)) {
      ctx.radiationDelta = Number(ctx.radiationDelta || 0) + weather.radiation.rpDelta;
    }
  }

  // Encounter weighting bias (handed to whatever system consumes ctx.encounterWeights)
  if (weather.weights && typeof weather.weights === "object") {
    for (const [k, v] of Object.entries(weather.weights)) {
      ctx.encounterWeights[k] = Number(ctx.encounterWeights[k] || 0) + Number(v || 0);
    }
  }
}

export async function writeWeatherToHex(hexDoc, weatherKey) {
  const weather = WEATHER_ARCHETYPES[weatherKey];
  if (!weather || !hexDoc || typeof hexDoc.update !== "function") return;

  const dur = rollBetween(weather.duration?.min ?? 1, weather.duration?.max ?? 1);

  try {
    return await hexDoc.update({
      "flags.bbttcc-territory.weather": {
        key: weatherKey,
        label: weather.label || weatherKey,
        remainingTurns: dur,
        ts: Date.now()
      }
    });
  } catch (_e) {
    // Never block — weather is optional
    return null;
  }
}
