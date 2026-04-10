/* REVIEW NOTE: OP Engine is core bank/cap logic and intentionally retained during faction-sheet layout cleanup. */
// modules/bbttcc-factions/scripts/op-engine.js
// BBTTCC — OP Engine v0.2
// Central preview/commit API for faction OP banks.
//
// Exposes:
//   game.bbttcc.api.op.preview(factionId, deltas, context?)
//   game.bbttcc.api.op.commit(factionId, deltas, context?)
//
// Notes:
// - Negative deltas spend OP; positive deltas grant OP.
// - Underflow is refused.
// - Optional global cap enforcement is supported when a faction max OP budget is present.
//   (We try common flag names; if none found, cap is ignored.)

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

function _safeNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function _sumBank(bank) {
  let t = 0;
  for (const k of OP_KEYS) t += _safeNum(bank?.[k], 0);
  return t;
}

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

function _readCaps(faction) {
  // Preferred: per-bucket caps at flags.bbttcc-factions.opCaps
  // Fallback: single cap-per-bucket at flags.bbttcc-factions.opCapPer
  // Final fallback: derive from factionLevel/level/buildUnits (alpha-safe)
  try {
    const f = faction?.flags?.[MOD_ID] || {};
    const rawCaps = f.opCaps;
    const out = {};

    if (rawCaps && typeof rawCaps === "object") {
      for (const k of OP_KEYS) out[k] = Math.max(0, Math.floor(_safeNum(rawCaps[k], 0)));
      return out;
    }

    const per = _safeNum(f.opCapPer, 0);
    if (per > 0) {
      for (const k of OP_KEYS) out[k] = Math.max(0, Math.floor(per));
      return out;
    }

    // Derive from faction tier (authoritative) if present.
    // Tier is stored at flags.bbttcc-factions.tier; fallback to progression.victory.tierFromBadge.
    let tier = _safeNum(f.tier, -1);
    if (!Number.isFinite(tier) || tier < 0) {
      const snap = f.progression && f.progression.victory ? f.progression.victory : null;
      const tfb = snap ? _safeNum(snap.tierFromBadge, -1) : -1;
      tier = (tfb >= 0) ? tfb : 0;
    }
    tier = Math.max(0, Math.min(4, Math.floor(tier)));

    // Cap bands (per bucket). Adjust later if you formalize a different economy curve.
    // T0=5, T1=7, T2=9, T3=11, T4=13
    const band = [5, 7, 9, 11, 13];
    const derivedPer = band[tier] || 5;

    for (const k of OP_KEYS) out[k] = Math.max(0, Math.floor(derivedPer));
    return out;
  } catch (_e) {
    const out = {};
    for (const k of OP_KEYS) out[k] = 0;
    return out;
  }
}

function _sumCaps(caps) {
  let t = 0;
  for (const k of OP_KEYS) t += _safeNum(caps?.[k], 0);
  return t;
}

function _readMaxOPs(faction) {
  // Legacy: returns a total cap. Prefer per-bucket caps; otherwise 0 (ignored).
  try {
    const caps = _readCaps(faction);
    const total = _sumCaps(caps);
    return (total > 0) ? Math.floor(total) : 0;
  } catch (_e) {
    return 0;
  }
}

function _computePreview(before, deltas /* raw deltas, negative = spend */, context, caps /* per-bucket caps */) {
  const finalCost = _normalizeDeltas(deltas);
  const after = {};
  const underflow = {};
  const overcapBuckets = {};
  const overcapIncrease = {};

  for (const k of OP_KEYS) {
    const b = Number(before[k] || 0);
    const c = Number(finalCost[k] || 0);
    const a = b + c; // c positive = gain, negative = spend
    after[k] = a;

    if (a < 0) underflow[k] = { before: b, delta: c, after: a };

    const capK = _safeNum(caps?.[k], 0);
    if (capK > 0 && a > capK) {
      const row = { cap: capK, before: b, delta: c, after: a, overflow: (a - capK) };
      overcapBuckets[k] = row;

      // Important: if the faction is already over cap in this bucket,
      // we still allow commits that REDUCE the bucket (even if still over).
      // We only block commits that INCREASE an over-cap bucket, or push a bucket newly over cap.
      if (a > b) overcapIncrease[k] = row;
    }
  }

  const totalBefore = _sumBank(before);
  const totalAfter  = _sumBank(after);
  const totalCap = _sumCaps(caps);

  const overcapTotal = (totalCap > 0 && totalAfter > totalCap)
    ? { cap: totalCap, before: totalBefore, after: totalAfter, overflow: (totalAfter - totalCap) }
    : null;

  const overcapTotalIncrease = (overcapTotal && totalAfter > totalBefore) ? overcapTotal : null;

  const hasUnderflow = Object.keys(underflow).length > 0;
  const hasOvercapIncrease = Object.keys(overcapIncrease).length > 0;

  const ok = !hasUnderflow && !hasOvercapIncrease && !overcapTotalIncrease;

  return {
    ok,
    before,
    deltas: finalCost,
    finalCost,
    after,
    underflow,
    overcap: (Object.keys(overcapBuckets).length || overcapTotal) ? {
      buckets: (Object.keys(overcapBuckets).length ? overcapBuckets : null),
      total: overcapTotal
    } : null,
    overcapIncrease: (hasOvercapIncrease || overcapTotalIncrease) ? {
      buckets: (hasOvercapIncrease ? overcapIncrease : null),
      total: overcapTotalIncrease
    } : null,
    totals: { before: totalBefore, after: totalAfter, cap: totalCap || null },
    caps: caps || null,
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
 *   - Optional: context.maxOPs can be supplied to override cap discovery.
 *   - Optional: context.allowOvercap=true to allow preview/commit above cap.
 */
async function preview(factionId, deltas, context) {
  const faction = await _getFactionActor(factionId);
  if (!faction) {
    return { ok: false, error: "Faction not found", factionId, context };
  }

  const rawBank = faction.getFlag(MOD_ID, "opBank") || {};
  const before = _normalizeBank(rawBank);

  const ctx = context || null;
  const caps = (ctx?.opCaps && typeof ctx.opCaps === "object") ? ctx.opCaps : _readCaps(faction);

  const result = _computePreview(before, deltas, ctx, caps);
  result.factionId = faction.id;
  result.factionName = faction.name;

  // Preview can be forced to "ok" for UI uses (e.g., display), but we still report overcap.
  if (result.overcap && ctx?.allowOvercap) result.ok = (Object.keys(result.underflow).length === 0);

  return result;
}

/**
 * Commit OP change for a faction.
 * Applies the same rules as preview(), and will refuse to commit if it would:
 *  - drive any OP category below zero
 *  - (optionally) exceed the faction max OP cap (if found)
 *
 * Set context.allowOvercap=true to bypass the cap refusal (GM tooling).
 */
async function commit(factionId, deltas, context) {
  const faction = await _getFactionActor(factionId);
  if (!faction) {
    return { ok: false, error: "Faction not found", factionId, context, committed: false };
  }

  const rawBank = faction.getFlag(MOD_ID, "opBank") || {};
  const before = _normalizeBank(rawBank);

  const ctx = context || null;
  const caps = (ctx?.opCaps && typeof ctx.opCaps === "object") ? ctx.opCaps : _readCaps(faction);

  const result = _computePreview(before, deltas, ctx, caps);
  result.factionId = faction.id;
  result.factionName = faction.name;

  // Underflow is always refused.
  if (Object.keys(result.underflow || {}).length) {
    warn("OP commit refused (underflow)", { faction: faction.name, underflow: result.underflow, context: ctx });
    ui.notifications?.warn?.(`Not enough OP in bank for ${faction.name} (see console).`);
    result.committed = false;
    result.ok = false;
    return result;
  }

  // Cap is refused unless explicitly allowed.
  if (result.overcapIncrease && !ctx?.allowOvercap) {
    warn("OP commit refused (over cap)", { faction: faction.name, overcap: (result.overcapIncrease || result.overcap), context: ctx });

    let msg = `OP cap exceeded for ${faction.name}.`;
    try {
      const b = (result.overcapIncrease?.buckets || result.overcap?.buckets);
      if (b && typeof b === "object") {
        const firstKey = Object.keys(b)[0];
        if (firstKey) msg = `OP cap exceeded for ${faction.name} (${firstKey} +${b[firstKey].overflow} over).`;
      } else if (result.overcapIncrease?.total || result.overcap?.total) {
        const t = (result.overcapIncrease?.total || result.overcap?.total);
        msg = `OP cap exceeded for ${faction.name} (+${t.overflow} over total cap).`;
      }
    } catch (_e) {}

    ui.notifications?.warn?.(msg);
    result.committed = false;
    result.ok = false;
    return result;
  }

  try {
    await faction.update({ [`flags.${MOD_ID}.opBank`]: result.after }, { diff: true, recursive: true });
    log("OP commit applied", { faction: faction.name, deltas: result.finalCost, context: ctx });
    result.committed = true;
    // If we allowed overcap, treat ok as true.
    result.ok = true;
    return result;
  } catch (e) {
    warn("OP commit failed", e);
    ui.notifications?.error?.("Failed to apply OP changes (see console).");
    result.committed = false;
    result.ok = false;
    result.error = e?.message || "Update failed";
    return result;
  }
}

/* ---------- API wiring (late-load safe) ---------- */

function _attach() {
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
}

Hooks.once("ready", _attach);
try { if (game && game.ready) _attach(); } catch (_e) {}
