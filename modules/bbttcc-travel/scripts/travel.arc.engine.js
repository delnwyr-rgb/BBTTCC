// modules/bbttcc-travel/scripts/travel.arc.engine.js
// BBTTCC Travel Arc Engine
// PURPOSE:
//  - Resolve per-leg travel outcomes (hazards, encounters, events)
//  - RETURN SHAPE CONTRACT (CRITICAL):
//      { ok: boolean, stepCtx, result, arcEvents, summary }
//
// PATCH 2026-01-05:
//  - Thread ACTIVE CAMPAIGN ID into stepCtx:
//      stepCtx.campaignId
//    Source of truth is bbttcc-campaign’s star/active selection via:
//      game.bbttcc.api.campaign.getActiveCampaignId()
//
// PATCH 2026-01-05 (Weather Alpha v1.0 + No-reroll):
//  - Weather is hex-local, temporary.
//  - If a hex already has weather with remainingTurns > 0, reuse it (no reroll).
//  - Otherwise roll new weather and persist it.
//  - Never throws; never blocks travel resolution.
//
// PATCH 2026-01-05 (Arc API attach):
//  - Attach rollStep to game.bbttcc.api.travel.arc.rollStep
//  - Late-load-safe: attach(); Hooks.once("ready", attach); if (game.ready) attach();

import {
  rollWeather,
  applyWeatherToContext,
  writeWeatherToHex
} from "./travel.weather.engine.js";

const TAG = "[bbttcc-travel-arc-engine]";

function _safeActiveCampaignId() {
  try {
    const api = game?.bbttcc?.api?.campaign;
    if (api && typeof api.getActiveCampaignId === "function") {
      const id = String(api.getActiveCampaignId() || "").trim();
      return id || null;
    }
  } catch (_e) {}

  try {
    const id = String(game?.settings?.get?.("bbttcc-campaign", "activeCampaignId") || "").trim();
    return id || null;
  } catch (_e) {}

  return null;
}

async function _resolveHexDocFromStepCtx(stepCtx) {
  try {
    if (!stepCtx || typeof stepCtx !== "object") return null;

    if (stepCtx.hexDoc && typeof stepCtx.hexDoc.update === "function") return stepCtx.hexDoc;

    const uuid = stepCtx.hexUuid || stepCtx.toHexUuid || stepCtx.targetUuid || stepCtx.uuid || null;
    if (uuid && globalThis.fromUuid) {
      const doc = await globalThis.fromUuid(uuid).catch(() => null);
      if (doc && typeof doc.update === "function") return doc;
    }

    const drawingId = stepCtx.hexId || stepCtx.drawingId || stepCtx.toId || null;
    if (drawingId && canvas?.scene?.drawings?.get) {
      const dr = canvas.scene.drawings.get(drawingId);
      if (dr && typeof dr.update === "function") return dr;
    }
  } catch (_e) {}

  return null;
}

function _inferWorldState(stepCtx) {
  if (stepCtx && stepCtx.worldState && typeof stepCtx.worldState === "object") return stepCtx.worldState;
  const out = {};
  const dark = Number(stepCtx?.darkness || 0);
  if (Number.isFinite(dark)) out.darkness = dark;
  return out;
}

function _readExistingWeatherKeyFromHexDoc(hexDoc) {
  try {
    const getFlag = hexDoc?.getFlag;
    if (!getFlag) return null;
    const w = getFlag.call(hexDoc, "bbttcc-territory", "weather");
    if (!w || typeof w !== "object") return null;
    const key = String(w.key || "").trim();
    const turns = Number(w.remainingTurns ?? 0);
    if (!key) return null;
    if (!Number.isFinite(turns) || turns <= 0) return null;
    return key;
  } catch (_e) {
    return null;
  }
}

export async function rollStep(stepCtx = {}) {
  console.log(TAG, "rollStep:", stepCtx);

  // -------------------------------------------------------------------------
  // Campaign threading (non-destructive)
  // -------------------------------------------------------------------------
  try {
    if (!stepCtx || typeof stepCtx !== "object") stepCtx = {};
    if (!stepCtx.campaignId) {
      const cid = _safeActiveCampaignId();
      if (cid) {
        stepCtx.campaignId = cid;
        stepCtx.campaignSource = "bbttcc-campaign.activeCampaignId";
      } else {
        stepCtx.campaignId = null;
        stepCtx.campaignSource = "none";
      }
    } else {
      stepCtx.campaignSource = stepCtx.campaignSource || "caller";
    }
  } catch (_e) {}

  // -------------------------------------------------------------------------
  // Weather (Alpha + No-reroll): reuse existing if present; else roll + persist
  // -------------------------------------------------------------------------
  try {
    if (!stepCtx.travel) stepCtx.travel = { opCost: 0 };
    if (!stepCtx.encounterWeights) stepCtx.encounterWeights = {};
    if (stepCtx.radiationDelta == null) stepCtx.radiationDelta = 0;

    const world = _inferWorldState(stepCtx);

    const hexDoc = await _resolveHexDocFromStepCtx(stepCtx);
    if (hexDoc) stepCtx.hexDoc = stepCtx.hexDoc || hexDoc;

    // ✅ Reuse existing weather if still active
    let weatherKey = null;
    if (hexDoc) {
      weatherKey = _readExistingWeatherKeyFromHexDoc(hexDoc);
    }

    // ✅ If none exists, roll new
    if (!weatherKey) {
      weatherKey = rollWeather({
        hex: { terrain: stepCtx.terrain || stepCtx.terrainKey || "plains" },
        world
      });
      if (hexDoc) await writeWeatherToHex(hexDoc, weatherKey);
    }

    // Always apply the effects into ctx
    if (weatherKey) applyWeatherToContext(stepCtx, weatherKey);
  } catch (e) {
    console.warn(TAG, "Weather apply failed (non-fatal):", e);
  }

  // --- Existing resolution logic (unchanged) ---
  const result = {
    seed: Math.floor(Math.random() * 1e9),
    weights: {},
    rolls: {},
    worldboss: null,
    hazard: null,
    encounter: null
  };

  const arcEvents = [];

  if (stepCtx.darkness > 0 || stepCtx.regionHeat > 0) {
    result.hazard = {
      type: "environmental",
      severity: Math.max(stepCtx.darkness, stepCtx.regionHeat)
    };
    arcEvents.push({ type: "hazard", data: result.hazard });
  }

  let summary = "Travel proceeds without incident.";
  if (result.hazard) summary = "Travel encounters environmental hazards.";

  return { ok: true, stepCtx, result, arcEvents, summary };
}

export default { rollStep };

// ---------------------------------------------------------------------------
// Attach into game.bbttcc.api.travel.arc (late-load safe)
// ---------------------------------------------------------------------------
function attachArcApi() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.travel ??= {};
    game.bbttcc.api.travel.arc ??= {};
    game.bbttcc.api.travel.arc.rollStep = rollStep;
    game.bbttcc.api.travel.arc.__tag = TAG;
    console.log(TAG, "Attached: game.bbttcc.api.travel.arc.rollStep");
  } catch (e) {
    console.warn(TAG, "Failed to attach arc api (non-fatal)", e);
  }
}

attachArcApi();
Hooks.once("ready", attachArcApi);
if (game?.ready) attachArcApi();
