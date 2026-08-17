// modules/bbttcc-travel/scripts/travel.weather.engine.js
// Bad Eden Weather Engine (Alpha v1.0)
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

// Expose archetype lookup on the travel API so non-module scripts (the
// Travel Console IIFE, hex-sheet enhancers, etc.) can read mechanical
// metadata without re-importing the registry.
Hooks.once("ready", () => {
  try {
    globalThis.game ??= {};
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.travel ??= {};
    game.bbttcc.api.travel.weather ??= {};
    game.bbttcc.api.travel.weather.archetypes = WEATHER_ARCHETYPES;
    game.bbttcc.api.travel.weather.get = (key) => WEATHER_ARCHETYPES[key] || null;
  } catch (e) {
    console.warn("[bbttcc-travel.weather] api expose failed", e);
  }
});

export async function writeWeatherToHex(hexDoc, weatherKey) {
  const weather = WEATHER_ARCHETYPES[weatherKey];
  if (!weather || !hexDoc || typeof hexDoc.update !== "function") return;

  const dur = rollBetween(weather.duration?.min ?? 1, weather.duration?.max ?? 1);

  // 2026-08-17 — Hexes are Drawings, and players can't update Drawing flags: a
  // player-driven travel step rolled weather here and hit "User X lacks
  // permission to update Drawing […]" (owner playtest). Weather is real, shared
  // state — not informational metadata — so relay the write to the GM rather
  // than dropping it, and let it persist for everyone.
  if (!game.user?.isGM) {
    try {
      if (!game.users?.some?.(u => u.isGM && u.active)) return;  // nobody to write it
      game.socket?.emit?.("module.bbttcc-travel", {
        action: "weather-write-request",
        hexUuid: hexDoc.uuid,
        weatherKey,
        duration: dur
      });
    } catch (e) { console.warn("[bbttcc-travel.weather] relay emit failed", e); }
    return;
  }

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

/* GM side of the weather relay: apply a player's rolled weather to the hex.
 * Single-GM guard mirrors the encounter-arbitration relay (lowest-id active GM). */
Hooks.once("ready", () => {
  if (!game.socket || globalThis.__bbttccTravelWeatherRelayBound) return;
  globalThis.__bbttccTravelWeatherRelayBound = true;

  game.socket.on("module.bbttcc-travel", async (payload) => {
    try {
      if (payload?.action !== "weather-write-request") return;
      if (!game.user?.isGM) return;
      const activeGMs = Array.from(game.users || []).filter(u => u.active && u.isGM);
      const primaryGM = activeGMs.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
      if (primaryGM && primaryGM.id !== game.user.id) return;

      const weather = WEATHER_ARCHETYPES[payload.weatherKey];
      if (!weather) return;
      const hexDoc = await fromUuid(String(payload.hexUuid || ""));
      if (!hexDoc?.update) return;

      await hexDoc.update({
        "flags.bbttcc-territory.weather": {
          key: payload.weatherKey,
          label: weather.label || payload.weatherKey,
          remainingTurns: Number(payload.duration) || 1,
          ts: Date.now()
        }
      });
    } catch (e) {
      console.warn("[bbttcc-travel.weather] relayed write failed", e);
    }
  });
});
