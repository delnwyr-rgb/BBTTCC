/* REVIEW NOTE: OP Engine is core bank/cap logic and intentionally retained during faction-sheet layout cleanup. */
// modules/bbttcc-factions/scripts/op-engine.js
// Bad Eden — OP Engine v0.3 (marks)
// Central preview/commit API for faction OP banks.
//
// Unit canon (2026-05-09): bank values are stored as MARKS. 1 OP = 10 marks.
// All deltas to preview/commit are marks. Display layer formats marks/10 as "X.Y OP".
// Migration flag: flags.bbttcc-factions.opBankMarksMigrated (set by one-shot migration).

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-op]";

// Marks per OP. 1 OP = 10 marks. Granular spends operate at mark resolution.
const OP_TO_MARKS = 10;

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

// --- Marks <-> OP display helpers ---
// marks → "X.Y OP" string. Trims trailing zero on whole values ("3 OP" not "3.0 OP").
function formatMarksAsOP(marks) {
  const m = _safeNum(marks, 0);
  const op = m / OP_TO_MARKS;
  if (Number.isInteger(op)) return `${op} OP`;
  return `${op.toFixed(1)} OP`;
}
// marks → "X.Y" (no unit suffix) for tight UI cells.
function formatMarksAsOPNumber(marks) {
  const m = _safeNum(marks, 0);
  const op = m / OP_TO_MARKS;
  if (Number.isInteger(op)) return String(op);
  return op.toFixed(1);
}
// Convenience: whole-OP integer → marks. For one-shot legacy callers that still
// want to express "spend 2 OP" without manually multiplying.
function opToMarks(op) {
  return Math.round(_safeNum(op, 0) * OP_TO_MARKS);
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

    // Cap bands (per bucket), in MARKS. 1 OP = 10 marks.
    // T0=50 (5 OP), T1=70 (7 OP), T2=90 (9 OP), T3=110 (11 OP), T4=130 (13 OP)
    const band = [50, 70, 90, 110, 130];
    const derivedPer = band[tier] || 50;

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

/* ---------- One-shot marks migration (idempotent) ---------- */
// Multiplies legacy integer-OP opBank/opCaps by OP_TO_MARKS on every actor that holds those flags.
// Idempotency: sets flags.bbttcc-factions.opBankMarksMigrated = true once done; bails on subsequent runs.
// Safe to call multiple times. GM-only.

const MIGRATION_FLAG = "opBankMarksMigrated";
// Epoch guard (2026-08-22): the migration shipped 2026-08-15. Any actor
// CREATED after that date was seeded marks-native — multiplying it again
// inflated fresh factions ×10 on the next GM reload (The Errata Society's
// "phantom 298-OP treasury", live-confirmed 2026-08-22). Post-epoch actors
// are stamped as migrated without touching their numbers.
const MARKS_MIGRATION_EPOCH_MS = Date.UTC(2026, 7, 15); // 2026-08-15T00:00Z

async function _migrateOneActor(actor) {
  try {
    const f = actor.flags?.[MOD_ID] || {};
    if (f[MIGRATION_FLAG] === true) return { skipped: true };

    const createdMs = Number(actor._stats?.createdTime) || 0;
    if (createdMs >= MARKS_MIGRATION_EPOCH_MS) {
      await actor.update({ [`flags.${MOD_ID}.${MIGRATION_FLAG}`]: true }, { diff: true, recursive: true });
      return { skipped: true, stamped: true };
    }

    const updates = {};
    let touched = false;

    if (f.opBank && typeof f.opBank === "object") {
      const newBank = {};
      for (const k of OP_KEYS) {
        newBank[k] = Math.round(_safeNum(f.opBank[k], 0) * OP_TO_MARKS);
      }
      updates[`flags.${MOD_ID}.opBank`] = newBank;
      touched = true;
    }
    if (f.opCaps && typeof f.opCaps === "object") {
      const newCaps = {};
      for (const k of OP_KEYS) {
        newCaps[k] = Math.round(_safeNum(f.opCaps[k], 0) * OP_TO_MARKS);
      }
      updates[`flags.${MOD_ID}.opCaps`] = newCaps;
      touched = true;
    }
    if (Number.isFinite(Number(f.opCapPer)) && Number(f.opCapPer) > 0) {
      updates[`flags.${MOD_ID}.opCapPer`] = Math.round(_safeNum(f.opCapPer, 0) * OP_TO_MARKS);
      touched = true;
    }

    updates[`flags.${MOD_ID}.${MIGRATION_FLAG}`] = true;

    await actor.update(updates, { diff: true, recursive: true });
    return { migrated: true, touched };
  } catch (e) {
    warn("OP marks migration failed for actor", actor?.name, e);
    return { error: e?.message || "update failed" };
  }
}

async function _runMarksMigration() {
  if (!game?.user?.isGM) return;
  try {
    const candidates = (game.actors?.contents || []).filter(a => {
      const f = a.flags?.[MOD_ID] || {};
      if (f[MIGRATION_FLAG] === true) return false;
      // Anything that has opBank/opCaps/opCapPer is a candidate.
      return !!(f.opBank || f.opCaps || (Number.isFinite(Number(f.opCapPer)) && Number(f.opCapPer) > 0));
    });

    if (!candidates.length) {
      log("OP marks migration: nothing to migrate.");
      return;
    }

    log(`OP marks migration: ${candidates.length} actor(s) pending. Multiplying opBank/opCaps × ${OP_TO_MARKS}...`);
    let ok = 0, fail = 0;
    for (const a of candidates) {
      const r = await _migrateOneActor(a);
      if (r?.migrated) ok++; else if (r?.error) fail++;
    }
    log(`OP marks migration: done. migrated=${ok}, failed=${fail}.`);
    if (ok > 0) {
      ui.notifications?.info?.(`Bad Eden: migrated ${ok} faction OP bank(s) to marks (1 OP = ${OP_TO_MARKS} marks).`);
    }
  } catch (e) {
    warn("OP marks migration sweep failed", e);
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
    apiRoot.OP_TO_MARKS = OP_TO_MARKS;
    apiRoot.formatMarksAsOP = formatMarksAsOP;
    apiRoot.formatMarksAsOPNumber = formatMarksAsOPNumber;
    apiRoot.opToMarks = opToMarks;
    apiRoot.runMarksMigration = _runMarksMigration;

    log("OP Engine API ready (marks unit, 1 OP = 10 marks) → game.bbttcc.api.op.{preview, commit, KEYS, OP_TO_MARKS, formatMarksAsOP, formatMarksAsOPNumber, opToMarks}");
  } catch (e) {
    warn("OP Engine wiring failed", e);
  }
}

Hooks.once("ready", async () => {
  _attach();
  // Run migration after API is wired so any side-effects of migration can use it.
  try { await _runMarksMigration(); } catch (_e) {}
});
try { if (game && game.ready) _attach(); } catch (_e) {}
