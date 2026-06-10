// modules/bbttcc-factions/scripts/relations-api.js
// Bad Eden — Faction Relations API v0.1
//
// Public API for reading + mutating directional faction-to-faction relationships.
// Storage canon (unchanged): flags.bbttcc-factions.relations[targetActorId] = "tierKey"
//
// Tier ladder (low → high):
//   at_war (0) · hostile (1) · unfriendly (2) · neutral (3) · friendly (4) · allied (5)
//
// API on game.bbttcc.api.factions.relations:
//   get(fromActor, toActor)          → "tierKey" (defaults to "neutral")
//   set(fromActor, toActor, tier, opts?) → { ok, before, after, hookFired }
//   tier(fromActor, toActor)         → numeric 0..5
//   list(fromActor)                  → [{ id, name, tier, tierIdx }]
//   canTrade(actorA, actorB)         → { ok, mutualTier, mutualTierIdx, friction, blockedBy?, sides }
//   TIER_KEYS, TIER_LABELS, TIER_ORDER, FRICTION_BY_TIER (constants)
//
// Hook: bbttcc:relationship:changed { fromId, toId, before, after, reason }
//
// canTrade rule (mutual): both sides must rate the other ≥ neutral (tier idx ≥ 3).
// Friction is determined by the WORSE of the two tiers (worst-of-two).

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-relations]";

const TIER_KEYS  = ["at_war", "hostile", "unfriendly", "neutral", "friendly", "allied"];
const TIER_LABELS = {
  at_war:     "At War",
  hostile:    "Hostile",
  unfriendly: "Unfriendly",
  neutral:    "Neutral",
  friendly:   "Friendly",
  allied:     "Allied"
};

// Friction = fraction of marks lost in transit on each side of a settlement.
// Materials transfer at face value (discrete units; cannot fractionally lose).
const FRICTION_BY_TIER = {
  at_war:     null,   // blocked
  hostile:    null,   // blocked
  unfriendly: 0.30,   // 30% loss on marks
  neutral:    0.10,   // 10% loss
  friendly:   0.00,
  allied:     0.00
};

function _norm(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "neutral";
  if (s === "at war" || s === "atwar" || s === "war") return "at_war";
  if (s === "ally") return "allied";
  const k = s.replace(/\s+/g, "_");
  return TIER_KEYS.includes(k) ? k : "neutral";
}

function _idxOf(tierKey) {
  const i = TIER_KEYS.indexOf(_norm(tierKey));
  return i < 0 ? TIER_KEYS.indexOf("neutral") : i;
}

function _resolveActor(aOrId) {
  if (!aOrId) return null;
  if (aOrId instanceof Actor) return aOrId;
  const id = String(aOrId).replace(/^Actor\./, "");
  return game.actors?.get(id) ?? null;
}

// Mirror of overview-button.js's isFactionActor — accepts the isFaction flag,
// OR system.details.type.value === "faction", OR the Bad Eden faction sheet class.
// list() must use this broader check; the strict flag-only filter excludes
// factions authored via dnd5e-ish type or sheet-class detection.
function _isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(MOD_ID, "isFaction") === true) return true;
    const t = (foundry.utils.getProperty(a, "system.details.type.value") || "").toString().toLowerCase();
    if (t === "faction") return true;
    const cls = a.getFlag?.("core", "sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls || "").includes("BBTTCCFactionSheet");
  } catch {
    return false;
  }
}

function _readRelMap(actor) {
  return foundry.utils.deepClone(actor?.getFlag?.(MOD_ID, "relations") ?? {});
}

function get(fromActor, toActor) {
  const A = _resolveActor(fromActor);
  const B = _resolveActor(toActor);
  if (!A || !B) return "neutral";
  const map = _readRelMap(A);
  return _norm(map[B.id] ?? "neutral");
}

function tier(fromActor, toActor) {
  return _idxOf(get(fromActor, toActor));
}

async function set(fromActor, toActor, tierKey, opts = {}) {
  const A = _resolveActor(fromActor);
  const B = _resolveActor(toActor);
  if (!A || !B) return { ok: false, error: "actor not found" };
  if (A.id === B.id) return { ok: false, error: "cannot set self-relationship" };

  const before = _norm(get(A, B));
  const after  = _norm(tierKey);
  if (before === after) return { ok: true, before, after, hookFired: false, unchanged: true };

  const map = _readRelMap(A);
  map[B.id] = after;
  await A.setFlag(MOD_ID, "relations", map);

  try {
    Hooks.callAll("bbttcc:relationship:changed", {
      fromId: A.id,
      fromName: A.name,
      toId: B.id,
      toName: B.name,
      before, after,
      reason: opts?.reason || ""
    });
  } catch (e) {
    console.warn(TAG, "hook dispatch failed", e);
  }

  return { ok: true, before, after, hookFired: true };
}

function list(fromActor) {
  const A = _resolveActor(fromActor);
  if (!A) return [];
  const map = _readRelMap(A);
  const out = [];
  for (const f of (game.actors?.contents ?? [])) {
    if (!f || f.id === A.id) continue;
    if (!_isFactionActor(f)) continue;
    const t = _norm(map[f.id] ?? "neutral");
    out.push({ id: f.id, name: f.name, tier: t, tierIdx: _idxOf(t) });
  }
  out.sort((a, b) => b.tierIdx - a.tierIdx || a.name.localeCompare(b.name));
  return out;
}

function canTrade(actorA, actorB) {
  const A = _resolveActor(actorA);
  const B = _resolveActor(actorB);
  if (!A || !B) return { ok: false, blockedBy: "actor-not-found" };
  if (A.id === B.id) return { ok: false, blockedBy: "self-trade" };

  const aToB = get(A, B);
  const bToA = get(B, A);
  const aIdx = _idxOf(aToB);
  const bIdx = _idxOf(bToA);
  const minIdx = Math.min(aIdx, bIdx);
  const minTier = TIER_KEYS[minIdx];
  const NEUTRAL_IDX = TIER_KEYS.indexOf("neutral");

  const sides = {
    aToB: { tier: aToB, idx: aIdx, label: TIER_LABELS[aToB] },
    bToA: { tier: bToA, idx: bIdx, label: TIER_LABELS[bToA] }
  };

  if (minIdx < NEUTRAL_IDX) {
    return {
      ok: false,
      blockedBy: minTier === "at_war" ? "at_war" : "hostile",
      mutualTier: minTier,
      mutualTierIdx: minIdx,
      friction: null,
      sides
    };
  }

  const friction = FRICTION_BY_TIER[minTier];
  return {
    ok: true,
    mutualTier: minTier,
    mutualTierIdx: minIdx,
    friction,
    sides
  };
}

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.factions ??= {};
    const root = (game.bbttcc.api.factions.relations ??= {});

    root.get = get;
    root.set = set;
    root.tier = tier;
    root.list = list;
    root.canTrade = canTrade;
    root.TIER_KEYS = TIER_KEYS.slice();
    root.TIER_LABELS = { ...TIER_LABELS };
    root.TIER_ORDER = TIER_KEYS.slice();
    root.FRICTION_BY_TIER = { ...FRICTION_BY_TIER };

    console.log(TAG, "Relations API ready → game.bbttcc.api.factions.relations.{get,set,tier,list,canTrade}");
  } catch (e) {
    console.warn(TAG, "Relations API wiring failed", e);
  }
}

Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}
