// modules/bbttcc-factions/scripts/op-engine.js
// BBTTCC — OP Engine v0.1
// Central preview/commit API for faction OP banks.
//
// Exposes:
//   game.bbttcc.api.op.preview(factionId, deltas, context?)
//   game.bbttcc.api.op.commit(factionId, deltas, context?)
//
// OP-1: No global modifiers yet — those will be layered in a later sprint.
//       This is the foundation for Travel / Raid / Strategic OP pipelines.

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-op]";

// Canonical OP keys — must stay in sync with faction sheet & raid console.
const OP_KEYS = [
  "violence",
  "nonlethal",
  "intrigue",
  "economy",
  "softpower",
  "diplomacy",
  "logistics",
  "culture",
  "faith"
];

function log(...a)  { console.log(TAG, ...a); }
function warn(...a) { console.warn(TAG, ...a); }

function _normalizeBank(raw) {
  const out = {};
  const src = raw || {};
  for (const k of OP_KEYS) {
    const v = src[k];
    out[k] = Number.isFinite(Number(v)) ? Number(v) : 0;
  }
  return out;
}

function _normalizeDeltas(raw) {
  const out = {};
  const src = raw || {};
  for (const k of OP_KEYS) {
    const v = src[k];
    out[k] = Number.isFinite(Number(v)) ? Number(v) : 0;
  }
  return out;
}

function _computePreview(before, deltas /* raw deltas, negative = spend */, context) {
  const finalCost = _normalizeDeltas(deltas);
  const after = {};
  const underflow = {};

  for (const k of OP_KEYS) {
    const b = Number(before[k] || 0);
    const c = Number(finalCost[k] || 0);
    const a = b + c; // c will usually be negative on spend
    after[k] = a;
    if (a < 0) underflow[k] = { before: b, delta: c, after: a };
  }

  const ok = Object.keys(underflow).length === 0;

  return {
    ok,
    before,
    deltas: finalCost,
    finalCost,
    after,
    underflow,
    context: context || null
  };
}

async function _getFactionActor(idOrUuid) {
  const s = String(idOrUuid || "");
  if (!s) return null;
  try {
    if (s.startsWith("Actor.")) return await fromUuid(s);
    return game.actors.get(s) ?? null;
  } catch (e) {
    warn("getFactionActor failed", e);
    return null;
  }
}

/**
 * Preview OP change for a faction.
 * - factionId: Actor id or Actor.<id> uuid
 * - deltas: { violence: -3, intrigue: -1, ... } (negative = spend, positive = gain)
 * - context: string or object describing the source ("raid","travel","strategic", etc.)
 */
async function preview(factionId, deltas, context) {
  const faction = await _getFactionActor(factionId);
  if (!faction) {
    return { ok: false, error: "Faction not found", factionId, context };
  }

  const rawBank = faction.getFlag(MOD_ID, "opBank") || {};
  const before = _normalizeBank(rawBank);

  // OP-1: no global modifiers yet — they will be layered into finalCost here later.
  const result = _computePreview(before, deltas, context);
  result.factionId = faction.id;
  result.factionName = faction.name;

  return result;
}

/**
 * Commit OP change for a faction.
 * Applies the same rules as preview(), and will refuse to commit if it would
 * drive any OP category below zero (for now).
 *
 * Returns the same structure as preview(), plus committed: boolean.
 */
async function commit(factionId, deltas, context) {
  const faction = await _getFactionActor(factionId);
  if (!faction) {
    return { ok: false, error: "Faction not found", factionId, context, committed: false };
  }

  const rawBank = faction.getFlag(MOD_ID, "opBank") || {};
  const before = _normalizeBank(rawBank);

  const result = _computePreview(before, deltas, context);
  result.factionId = faction.id;
  result.factionName = faction.name;

  if (!result.ok) {
    warn("OP commit refused (underflow)", { faction: faction.name, underflow: result.underflow, context });
    ui.notifications?.warn?.(`Not enough OP in bank for ${faction.name} (see console).`);
    result.committed = false;
    return result;
  }

  try {
    await faction.update({ [`flags.${MOD_ID}.opBank`]: result.after }, { diff: true, recursive: true });
    log("OP commit applied", { faction: faction.name, deltas: result.finalCost, context });
    result.committed = true;
    return result;
  } catch (e) {
    warn("OP commit failed", e);
    ui.notifications?.error?.("Failed to apply OP changes (see console).");
    result.committed = false;
    result.error = e?.message || "Update failed";
    return result;
  }
}

/* ---------- API wiring ---------- */

Hooks.once("ready", () => {
  try {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    const apiRoot = (game.bbttcc.api.op ??= {});

    apiRoot.preview = preview;
    apiRoot.commit  = commit;
    apiRoot.KEYS    = OP_KEYS.slice();

    log("OP Engine API ready → game.bbttcc.api.op.{preview, commit, KEYS}");
  } catch (e) {
    warn("OP Engine wiring failed", e);
  }
});
