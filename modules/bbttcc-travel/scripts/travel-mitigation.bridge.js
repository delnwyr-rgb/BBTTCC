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

  // ── Use-ledger (Phase 2B cadence): N uses per ability per strategic turn, lazy-reset on turn change ──
  const MOD_TRV = "bbttcc-travel";
  const USES_PER_TURN = 1;
  const _worldTurn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.().turn ?? 0); } catch { return 0; } };
  function _readLedger(faction) {
    const raw = faction?.flags?.[MOD_TRV]?.mitigationUses || {};
    const turn = _worldTurn();
    return (Number(raw.turn) === turn) ? { turn, used: { ...(raw.used || {}) } } : { turn, used: {} }; // lazy turn reset
  }
  const _hasUse = (led, key) => Number(led.used[key] || 0) < USES_PER_TURN;
  async function _consumeUses(faction, keys) {
    if (!keys?.length || !game.user?.isGM) return;   // GM owns the ledger write (travelHex executes GM-side)
    const led = _readLedger(faction);                // logically fresh (lazy turn-reset)
    for (const k of keys) led.used[k] = Number(led.used[k] || 0) + 1;
    try {
      // Delete-then-set: Foundry update() MERGES objects, so a turn-reset `used:{}` (or fewer keys)
      // would merge-resurrect stale keys from a previous turn. Delete the flag first for a clean write.
      await faction.update({ [`flags.${MOD_TRV}.-=mitigationUses`]: null });
      await faction.update({ [`flags.${MOD_TRV}.mitigationUses`]: led });
    } catch (e) { console.warn(TAG, "use-consume write failed", e); }
  }
  function usesFor(factionId) {
    const f = game.actors?.get(String(factionId)); if (!f) return null;
    const led = _readLedger(f);
    return { turn: led.turn, used: led.used, perTurn: USES_PER_TURN };
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
      // Cadence: only abilities with a remaining use THIS strategic turn actually apply.
      // Read-only here — uses are consumed in afterTravel so the forecast never burns them.
      const led = _readLedger(faction);
      const availWeather   = cover.weather.filter(a => _hasUse(led, a.key));
      const availTerrain   = cover.terrain.filter(a => _hasUse(led, a.key));
      const availEncounter = cover.encounter.filter(a => _hasUse(led, a.key));

      // 1) Weather complication → DC. opDelta>0 = penalty (blunted one step per AVAILABLE coverer); <0 = boon.
      let weatherDc = 0, weatherEffected = false;
      if (arch) {
        const opDelta = Number(arch?.travel?.opDelta ?? 0);
        if (opDelta > 0) { weatherDc = Math.max(0, opDelta - availWeather.length); weatherEffected = availWeather.length > 0; }
        else weatherDc = opDelta;
      }

      // 2) Terrain mitigation → −2 DC per available coverer (one effective tier), capped above tier-1.
      const tier = Number(ctx.terrainTier || 1);
      const terrainStep = Math.min(availTerrain.length, Math.max(0, tier - 1));
      const terrainDc = -2 * terrainStep;

      ctx.dcMod = Number(ctx.dcMod || 0) + weatherDc + terrainDc;

      // 3) Encounter mitigation — only abilities with a use left arm the reroll.
      ctx.encounterMitigation = { covered: availEncounter.length > 0, abilities: availEncounter.map(a => a.label) };

      // Consume-lists drained in afterTravel (real travel only): weather/terrain consumed when they
      // actually reduced something; encounter consumed only if the reroll fires (set in travelHex).
      const wt = new Set();
      if (weatherEffected) availWeather.forEach(a => wt.add(a.key));
      if (terrainStep > 0)  availTerrain.forEach(a => wt.add(a.key));
      ctx.__mitConsumeWT = [...wt];
      ctx.__mitConsumeEncounter = availEncounter.map(a => a.key);

      ctx.weatherMitigationReport = {
        weatherKey, archetypeTags: arch?.tags || [],
        weatherPenaltyBase: arch ? Math.max(0, Number(arch?.travel?.opDelta ?? 0)) : 0,
        weatherDcApplied: weatherDc,
        weatherCovered: availWeather.map(a => a.label),
        weatherExhausted: cover.weather.length - availWeather.length,   // covered but out of uses this turn
        terrainStep, terrainCovered: availTerrain.map(a => a.label),
        dcDelta: weatherDc + terrainDc,
        masks: rosterAbilities(faction.id).flatMap(a => a.vanguardMasks)
      };
    } catch (e) { console.warn(TAG, "weather/terrain mitigation bridge failed", e); }
  });

  // Consume the uses the leg actually spent — fires on REAL travel only (travelHex emits afterTravel;
  // the forecast's simulateBeforeTravelHooks does NOT), so the planner never drains the ledger.
  Hooks.on("bbttcc:afterTravel", async (ctx) => {
    try {
      const faction = _factionFromCtx(ctx);
      if (!faction) return;
      const keys = new Set(ctx.__mitConsumeWT || []);
      if (ctx.encounterReroll) (ctx.__mitConsumeEncounter || []).forEach(k => keys.add(k)); // reroll actually fired
      if (keys.size) await _consumeUses(faction, [...keys]);
    } catch (e) { console.warn(TAG, "mitigation use-consume failed", e); }
  });

  function _install() {
    game.bbttcc ??= {}; game.bbttcc.api ??= {}; game.bbttcc.api.travel ??= {};
    game.bbttcc.api.travel.mitigation = { rosterAbilities, coverageFor, coversWeather, filterByWeather, usesFor };
    console.log(TAG, "weather/terrain mitigation bridge ready (passive coverage v1)");
  }
  Hooks.once("ready", _install);
  try { if (game?.ready) _install(); } catch (_e) {}
})();
