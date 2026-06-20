// modules/bbttcc-radiation/scripts/radiation-effects.js
// Bad Eden — Radiation Sickness tier engine (R7)
//
// Radiation is the physical embodiment of Darkness at the Steward level. RP is no
// longer an inert number: as it climbs it locks an actor into a Radiation Sickness
// TIER, mirrored as a visible condition on the token HUD / States tab. This file
// owns the canonical tier ladder and keeps the condition in sync with RP. The
// numeric BITE (roll penalty, max-Integrity cap, action tax, per-turn tick) is
// read from game.bbttcc.api.radiation.tierFor() by the fourththing core at the
// roll / prepareDerivedData / turn-start sites (Phase 2).
//
// Scope: Stewards (characters) + NPCs on the fourththing system. Factions live on
// the Darkness mirror, so they are excluded here.

(() => {
  const MOD = "bbttcc-radiation";
  const TAG = "[bbttcc-radiation/effects]";

  // ── Canonical ladder — single source of truth ──────────────────────────────
  // min = inclusive lower RP bound. Tiers are ordered ascending; tierForRP picks
  // the highest tier whose min the actor has reached.
  const TIERS = [
    { key: null,                  label: "Clean",      min: 0,   rollPenalty: 0, integrityCap: 0,  loseReaction: false, loseAction: false, tick: null  },
    { key: "radiationIrradiated", label: "Irradiated", min: 25,  rollPenalty: 1, integrityCap: 0,  loseReaction: false, loseAction: false, tick: null  },
    { key: "radiationSickened",   label: "Sickened",   min: 50,  rollPenalty: 2, integrityCap: 5,  loseReaction: false, loseAction: false, tick: null  },
    { key: "radiationPoisoned",   label: "Poisoned",   min: 75,  rollPenalty: 3, integrityCap: 10, loseReaction: true,  loseAction: false, tick: "1d4" },
    { key: "radiationTerminal",   label: "Terminal",   min: 100, rollPenalty: 4, integrityCap: 20, loseReaction: true,  loseAction: true,  tick: "1d6" }
  ];
  const TIER_KEYS = TIERS.map(t => t.key).filter(Boolean);

  function _asActor(aOrId) {
    if (!aOrId) return null;
    if (aOrId instanceof Actor) return aOrId;
    return game.actors?.get(String(aOrId).replace(/^Actor\./, "")) ?? null;
  }

  function tierForRP(rp) {
    const v = Number(rp || 0);
    let out = TIERS[0];
    for (const t of TIERS) if (v >= t.min) out = t;
    return out;
  }

  // Who feels the bite: fourththing characters/NPCs that are not factions.
  function isBiteActor(A) {
    if (!A || game.system?.id !== "fourththing") return false;
    if (A.type !== "character" && A.type !== "npc") return false;
    if (A.getFlag?.("bbttcc-factions", "isFaction") === true) return false;
    return true;
  }

  function currentRP(A) {
    const api = game.bbttcc?.api?.radiation;
    if (api?.get) return Number(api.get(A.id) || 0);
    return Number(foundry.utils.getProperty(A, "system.radiation.rp") || 0);
  }

  // Public: resolve an actor's current radiation tier object (read-only).
  function tierFor(actorOrId) {
    const A = _asActor(actorOrId);
    if (!A || !isBiteActor(A)) return TIERS[0];
    return tierForRP(currentRP(A));
  }

  // Highest-RP-seen tracker (primary-GM client only) for mutation band-crossing.
  const _lastRP = new Map();

  // Mutation bands — escalating into one rolls a mutation (tier derived from RP).
  const MUT_BANDS = [100, 80, 60, 50];

  // ── Sync: keep exactly one radiation condition matching the current tier ─────
  // Driven off RP changes. Only the primary GM mutates condition state so that a
  // single client owns it (updateActor hooks fire on every client). toggleCondition
  // handles the boolean flag, the HUD AE, and the transition chat card; it only
  // flips when the state actually differs, so this is quiet between tier crossings.
  async function syncRadiationSickness(actorOrId) {
    const A = _asActor(actorOrId);
    if (!A || !isBiteActor(A)) return;
    if (!game.user?.isGM) return;
    if (game.users?.activeGM && game.users.activeGM !== game.user) return;
    if (typeof game.fourththing?.toggleCondition !== "function") return;

    const rp   = currentRP(A);
    const want = tierForRP(rp).key; // null (Clean) or a tier key
    const sys  = A.system?.system ?? A.system ?? {};
    const conds = sys.conditions ?? {};

    for (const k of TIER_KEYS) {
      const on = conds[k] === true;
      if (k === want) {
        if (!on) await game.fourththing.toggleCondition(A, k);
      } else if (on) {
        await game.fourththing.toggleCondition(A, k);
      }
    }

    // ── Mutation roll on escalation into a new band ──────────────────────────
    // Centralized here (NOT in radApi.set) so it fires for EVERY RP path — the
    // API, the sheet Radiation editor's direct update, the damage track, and
    // consumables. Primary-GM-only (above), so it fires exactly once. Seed-on-
    // first-sight: a newly seen actor (or a post-reload reconcile pass) records
    // its RP without firing, so only genuine upward crossings roll a mutation.
    const prevRP = _lastRP.has(A.id) ? _lastRP.get(A.id) : rp;
    _lastRP.set(A.id, rp);
    if (MUT_BANDS.some(t => prevRP < t && rp >= t)) {
      Hooks.callAll("bbttcc.mutationRoll", A, rp);
    }
  }

  async function reconcileAll() {
    if (game.system?.id !== "fourththing") return;
    if (!game.user?.isGM) return;
    if (game.users?.activeGM && game.users.activeGM !== game.user) return;
    for (const A of game.actors ?? []) {
      if (!isBiteActor(A)) continue;
      try { await syncRadiationSickness(A); } catch (e) { console.warn(TAG, "reconcile", A?.name, e); }
    }
  }

  // ── Hooks ───────────────────────────────────────────────────────────────────
  Hooks.on("updateActor", (actor, changes) => {
    const changedSys  = foundry.utils.hasProperty(changes, "system.radiation.rp");
    const changedFlag = foundry.utils.hasProperty(changes, `flags.${MOD}.rp`);
    if (!changedSys && !changedFlag) return;
    syncRadiationSickness(actor).catch(e => console.warn(TAG, "sync", e));
  });

  function publish() {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.radiation ??= {};
    game.bbttcc.api.radiation.tierFor = tierFor;
    game.bbttcc.api.radiation.tiers   = TIERS;
    game.bbttcc.api.radiation.sync    = syncRadiationSickness;
  }

  Hooks.once("ready", () => {
    publish();
    reconcileAll().catch(e => console.warn(TAG, "initial reconcile", e));
    console.log(TAG, "Radiation Sickness tier engine ready.");
  });
  Hooks.on("canvasReady", () => { reconcileAll().catch(() => {}); });
})();
