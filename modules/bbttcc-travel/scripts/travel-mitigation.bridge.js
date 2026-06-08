// travel-mitigation.bridge.js — Weather/terrain complication + roster mitigation bridge.
// ─────────────────────────────────────────────────────────────────────────────
// Closes the forecast↔engine gap (2026-06-07): travel-advantage abilities tagged
// `mitigates` (Shaman "Read the Path", Storm Wardens "Weather Veto", "Weather Crown",
// etc., in game.fourththing._classAutomation.CHAR_OPT_ABILITIES) were MATCHED + shown
// in the Travel Console forecast but NEVER applied by the engine. travelHex also never
// applied weather at all.
//
// This bridge runs on `bbttcc:beforeTravel` — which the forecast (simulateBeforeTravelHooks)
// AND the executor (travelHex) both fire — so forecast and actual are identical by
// construction. v1 = PASSIVE coverage (a roster member HAVING the ability covers the leg;
// matches the forecast's "🛡 Covers leg N" semantics). Use-tracking + the "reduce-or-
// advantage" choice are a Phase-2 follow-on.
//
// Semantics (owner-confirmed defaults, 2026-06-07):
//   • Active dest-hex weather → DC complication = max(0, archetype.travel.opDelta) (penalty);
//     beneficial weather (opDelta<0) passes through as a DC boon. Each WEATHER-covering
//     ability blunts the penalty ONE step toward 0.
//   • Each TERRAIN-covering ability eases the leg by one effective tier (−2 DC), capped so
//     it can't drop below tier-1 difficulty.
//   • ALL mitigation is routed through ctx.dcMod (the field the forecast actually reads) so
//     forecast numbers reflect it. Easing encounter-tier itself is Phase 2.
//
// Exposes the SINGLE source of truth both the console (display) and this bridge (apply)
// should use: game.bbttcc.api.travel.mitigation.{rosterAbilities, coverageFor}.
(() => {
  const TAG = "[bbttcc-travel/mitigation]";
  const MOD_FCT = "bbttcc-factions";
  const MOD_TERR = "bbttcc-territory";
  const low = (s) => String(s ?? "").toLowerCase();

  // ── Roster (faction's character members) ──
  function _roster(factionIds) {
    const ids = new Set((Array.isArray(factionIds) ? factionIds : [factionIds]).filter(Boolean).map(String));
    if (!ids.size) return [];
    return Array.from(game.actors ?? []).filter(a => {
      if (!a || a.getFlag?.(MOD_FCT, "isFaction")) return false;
      if (low(foundry.utils.getProperty(a, "system.details.type.value")) === "faction") return false;
      const fid = a.flags?.[MOD_FCT]?.factionId;
      return fid && ids.has(String(fid));
    });
  }

  // ── Collect travel:true abilities off the roster (mirrors the console's scanTravelBonuses) ──
  function rosterAbilities(factionIds) {
    const reg = game?.fourththing?._classAutomation?.CHAR_OPT_ABILITIES;
    const out = [];
    if (!reg) return out;
    for (const actor of _roster(factionIds)) {
      for (const item of (actor.items?.contents ?? [])) {
        const id = item?.system?.identifier;
        if (!id) continue;
        const spec = reg[id];
        if (!spec) continue;
        const push = (s, key, label) => {
          if (s?.travel !== true) return;
          out.push({
            actorId: actor.id, actorName: actor.name, key, label: label || s.label || item.name,
            mitigates: Array.isArray(s.mitigates) ? s.mitigates.map(low) : [],
            vanguardMasks: Array.isArray(s.vanguardMasks) ? s.vanguardMasks.map(low) : []
          });
        };
        if (!Array.isArray(spec.abilities)) push(spec, id);
        else for (const ab of spec.abilities) push({ travel: ab.travel, mitigates: ab.mitigates ?? spec.mitigates, vanguardMasks: ab.vanguardMasks ?? spec.vanguardMasks, label: ab.label }, ab.key || id, ab.label);
      }
    }
    return out;
  }

  // ── Tag-match predicates (THE single source of truth — console delegates here too) ──
  function coversWeather(mitigates, weatherKey) {
    const mit = (mitigates || []).map(low);
    if (!mit.length || !weatherKey) return false;
    if (mit.includes("weather")) return true;                 // catch-all
    const arch = game.bbttcc?.api?.travel?.weather?.archetypes?.[weatherKey];
    const wTags = arch && Array.isArray(arch.tags) ? arch.tags.map(low) : [];
    return wTags.some(t => mit.includes(t));
  }
  // Filter arbitrary {mitigates} bonus objects by weather — used by the Travel Console's
  // findMitigationsForWeather so forecast display + engine never drift on the match logic.
  function filterByWeather(bonuses, weatherKey) {
    return (Array.isArray(bonuses) ? bonuses : []).filter(b => coversWeather(b?.mitigates || [], weatherKey));
  }

  // ── Which mitigation tags the roster covers for a given weather/terrain ──
  function coverageFor(factionIds, { weatherKey = null, terrainTags = [] } = {}) {
    const abilities = rosterAbilities(factionIds);
    const tTags = (terrainTags || []).map(low);
    const covered = { weather: [], terrain: [], encounter: [], all: [] };
    for (const ab of abilities) {
      if (!ab.mitigates.length) continue;
      const coversWx = coversWeather(ab.mitigates, weatherKey);
      const coversTerrain = ab.mitigates.includes("terrain") || tTags.some(t => ab.mitigates.includes(t));
      const coversEncounter = ab.mitigates.includes("encounter");   // meta: reroll the travel-encounter outcome
      if (coversWx) covered.weather.push(ab);
      if (coversTerrain) covered.terrain.push(ab);
      if (coversEncounter) covered.encounter.push(ab);
      if (coversWx || coversTerrain || coversEncounter) covered.all.push(ab);
    }
    return covered;
  }

  // ── beforeTravel bridge ──
  function _factionFromCtx(ctx) {
    const a = ctx?.actor;
    if (a) return a;
    const fid = ctx?.factionId;
    return fid ? game.actors?.get(fid) : null;
  }
  function _destFlags(ctx) {
    const to = ctx?.to;
    return to?.document?.flags?.[MOD_TERR] || to?.flags?.[MOD_TERR] || {};
  }
  function _activeWeatherKey(tf) {
    const w = tf?.weather;
    const key = w?.key, turns = Number(w?.remainingTurns ?? 0);
    return (key && turns > 0) ? String(key) : null;   // only ACTIVE weather
  }

  Hooks.on("bbttcc:beforeTravel", (ctx) => {
    try {
      const faction = _factionFromCtx(ctx);
      if (!faction) return;
      const tf = _destFlags(ctx);
      const weatherKey = _activeWeatherKey(tf);
      const arch = weatherKey ? game.bbttcc?.api?.travel?.weather?.archetypes?.[weatherKey] : null;
      const terrainTags = [low(tf?.terrain?.key)].filter(Boolean);

      const cover = coverageFor(faction.id, { weatherKey, terrainTags });

      // 1) Weather complication → DC. opDelta>0 = penalty (blunted one step per weather coverer); <0 = boon.
      let weatherDc = 0;
      if (arch) {
        const opDelta = Number(arch?.travel?.opDelta ?? 0);
        weatherDc = opDelta > 0 ? Math.max(0, opDelta - cover.weather.length) : opDelta;
      }

      // 2) Terrain mitigation → −2 DC per coverer (one effective tier), capped above tier-1.
      const tier = Number(ctx.terrainTier || 1);
      const terrainStep = Math.min(cover.terrain.length, Math.max(0, tier - 1));
      const terrainDc = -2 * terrainStep;

      const dcDelta = weatherDc + terrainDc;
      ctx.dcMod = Number(ctx.dcMod || 0) + dcDelta;

      // 3) Encounter mitigation (Wheel of Fortune T4 etc.) — flag for travelHex to reroll a
      //    missed travel check once and keep the better result. Weather/terrain-independent.
      ctx.encounterMitigation = { covered: cover.encounter.length > 0, abilities: cover.encounter.map(a => a.label) };

      ctx.weatherMitigationReport = {
        weatherKey,
        archetypeTags: arch?.tags || [],
        weatherPenaltyBase: arch ? Math.max(0, Number(arch?.travel?.opDelta ?? 0)) : 0,
        weatherDcApplied: weatherDc,
        weatherCovered: cover.weather.map(a => a.label),
        terrainStep,
        terrainCovered: cover.terrain.map(a => a.label),
        dcDelta,
        masks: rosterAbilities(faction.id).flatMap(a => a.vanguardMasks)
      };
    } catch (e) { console.warn(TAG, "weather/terrain mitigation bridge failed", e); }
  });

  function _install() {
    game.bbttcc ??= {}; game.bbttcc.api ??= {}; game.bbttcc.api.travel ??= {};
    game.bbttcc.api.travel.mitigation = { rosterAbilities, coverageFor, coversWeather, filterByWeather };
    console.log(TAG, "weather/terrain mitigation bridge ready (passive coverage v1)");
  }
  Hooks.once("ready", _install);
  try { if (game?.ready) _install(); } catch (_e) {}
})();
