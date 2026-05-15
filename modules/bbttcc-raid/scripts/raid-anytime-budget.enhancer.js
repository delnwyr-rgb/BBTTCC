// scripts/raid-anytime-budget.enhancer.js
// ─────────────────────────────────────────────────────────────────────────────
// Sprint 2 mini-substrate for MANEUVER_CATALOG_SPEC.md §3 anytime-budget lock.
//
// Anytime maneuvers are tied to TACTICAL ROUND order (combat-tracker initiative),
// not strategic raid rounds. Budget by tier (per locked spec):
//
//   T1     — per-round  (1 per faction per tactical round; resets on updateCombat)
//   T2–T3  — per-scene  (1 per faction per battle scene; resets on Phase 5 transition)
//   T4     — per-raid   (1 per faction per raid session; resets on commit/abandon)
//
// API surface (game.bbttcc.api.raid.anytimeBudget):
//   canFire(key, ctx)   → { ok, scope?, anchor?, factionId?, note? }
//   consume(key, ctx)   → { ok, scope, anchor, factionId }
//   getState()          → snapshot of fired buckets (debug/UI)
//   scopeForTier(tier)  → "per-round" | "per-scene" | "per-raid"
//   reset({ factionId?, scope? }) → manual reset (raid console close, debug)
//
// Hard enforcement via a 3-line guard in module.raid-console.js's
// _rcFireOneManeuver (added in this sprint). Auto-consumes on
// "bbttcc:raid:maneuver:fired" so the budget tracks every fire even if the
// guard is missing on some code path. Re-entrant safe (consume is idempotent
// per-key per-anchor).
//
// Per [[feedback_bbttcc_api_exposure_pattern]] API installs at script-load
// AND Hooks.once("ready").
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  const TAG = "[bbttcc-raid:anytime-budget]";

  // factionId → { perRound: Map<roundKey, Set<key>>, perScene: ..., perRaid: ... }
  const _state = { fired: new Map() };

  function scopeForTier(tier) {
    const t = Number(tier || 1);
    if (t >= 4) return "per-raid";
    if (t >= 2) return "per-scene";
    return "per-round";
  }

  function _bucketFor(factionId, scope, anchor) {
    factionId = String(factionId || "anon");
    if (!_state.fired.has(factionId)) {
      _state.fired.set(factionId, { perRound: new Map(), perScene: new Map(), perRaid: new Map() });
    }
    const f = _state.fired.get(factionId);
    const map = scope === "per-round" ? f.perRound
              : scope === "per-scene" ? f.perScene
              : f.perRaid;
    const key = String(anchor || "default");
    if (!map.has(key)) map.set(key, new Set());
    return map.get(key);
  }

  function _anchorFor(scope, ctx) {
    if (scope === "per-round") return String(game.combat?.round ?? 0);
    if (scope === "per-scene") return String(ctx?.sceneId || canvas?.scene?.id || "no-scene");
    return String(ctx?.raidId || "default-raid");
  }

  function _resolveTier(maneuverKey) {
    const eff = game.bbttcc?.api?.raid?.EFFECTS?.[String(maneuverKey || "")];
    if (!eff) return null;
    return Number(eff.tier ?? eff.meta?.tier ?? 1) || 1;
  }

  function _resolveFireMode(maneuverKey) {
    const eff = game.bbttcc?.api?.raid?.EFFECTS?.[String(maneuverKey || "")];
    return eff?.fireMode || null;
  }

  function canFire(maneuverKey, ctx = {}) {
    const fireMode = _resolveFireMode(maneuverKey);
    if (!fireMode) return { ok: true, note: "no-effect-entry" };
    if (fireMode !== "anytime") return { ok: true, note: "not-anytime" };
    const tier = _resolveTier(maneuverKey) || 1;
    const scope = scopeForTier(tier);
    const anchor = _anchorFor(scope, ctx);
    const factionId = String(ctx?.factionId || ctx?.attackerFactionId || ctx?.defenderFactionId || "anon");
    const bucket = _bucketFor(factionId, scope, anchor);
    if (bucket.has(String(maneuverKey))) {
      return { ok: false, scope, anchor, factionId, note: `${scope} budget consumed for ${factionId}` };
    }
    return { ok: true, scope, anchor, factionId };
  }

  function consume(maneuverKey, ctx = {}) {
    const fireMode = _resolveFireMode(maneuverKey);
    if (fireMode !== "anytime") return { ok: true, note: "not-anytime" };
    const tier = _resolveTier(maneuverKey) || 1;
    const scope = scopeForTier(tier);
    const anchor = _anchorFor(scope, ctx);
    const factionId = String(ctx?.factionId || ctx?.attackerFactionId || ctx?.defenderFactionId || "anon");
    const bucket = _bucketFor(factionId, scope, anchor);
    bucket.add(String(maneuverKey));
    return { ok: true, scope, anchor, factionId };
  }

  function reset({ factionId = null, scope = null } = {}) {
    if (factionId && scope) {
      const f = _state.fired.get(String(factionId));
      if (!f) return;
      const map = scope === "per-round" ? f.perRound
                : scope === "per-scene" ? f.perScene
                : f.perRaid;
      map.clear();
      return;
    }
    if (factionId) {
      _state.fired.delete(String(factionId));
      return;
    }
    if (scope) {
      for (const f of _state.fired.values()) {
        const map = scope === "per-round" ? f.perRound
                  : scope === "per-scene" ? f.perScene
                  : f.perRaid;
        map.clear();
      }
      return;
    }
    _state.fired.clear();
  }

  function getState() {
    const out = {};
    for (const [fid, f] of _state.fired) {
      out[fid] = {
        perRound: Object.fromEntries([...f.perRound].map(([k, v]) => [k, [...v]])),
        perScene: Object.fromEntries([...f.perScene].map(([k, v]) => [k, [...v]])),
        perRaid:  Object.fromEntries([...f.perRaid].map(([k, v]) => [k, [...v]]))
      };
    }
    return out;
  }

  function _install() {
    try {
      game.bbttcc ??= { api: {} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.raid ??= {};
      game.bbttcc.api.raid.anytimeBudget = Object.freeze({
        canFire, consume, getState, reset, scopeForTier
      });
    } catch (e) { console.warn(TAG, "api install failed", e); }
  }

  _install();
  Hooks.once("ready", _install);

  // Memory trim — keep per-round buckets only for the last 5 rounds.
  Hooks.on("updateCombat", (combat, change) => {
    try {
      if (!("round" in change)) return;
      const cutoff = Number(combat?.round || 0) - 5;
      if (cutoff <= 0) return;
      for (const f of _state.fired.values()) {
        for (const roundKey of [...f.perRound.keys()]) {
          if (Number(roundKey) < cutoff) f.perRound.delete(roundKey);
        }
      }
    } catch (_e) {}
  });

  // Auto-consume on any fire (defensive — if the pre-fire guard is missing on
  // some path, we still record consumption for accurate getState() reporting).
  Hooks.on("bbttcc:raid:maneuver:fired", ({ round, side, key, fireMode, attacker, defender }) => {
    try {
      if (fireMode !== "anytime") return;
      const factionId = (String(side) === "att" ? attacker?.id : defender?.id) || null;
      consume(key, {
        factionId,
        attackerFactionId: attacker?.id,
        defenderFactionId: defender?.id,
        sceneId: round?.meta?.battleSceneId || canvas?.scene?.id,
        raidId: round?.raidId || "default-raid"
      });
    } catch (_e) {}
  });

  console.log(TAG, "loaded; tier→scope: T1=per-round · T2-3=per-scene · T4=per-raid");
})();
