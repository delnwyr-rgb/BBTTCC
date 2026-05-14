// bbttcc-raid/scripts/targets/resolveTarget.js
// BBTTCC — Raid Target Resolver (v1.0)
//
// Purpose:
//   Provide a single, normalized resolver for Raid targets:
//     - hex / facility / rig (pass-through compatible)
//     - creature (boss registry / actor-backed)
//   This file is intentionally defensive: it must never throw ReferenceErrors
//   if legacy per-target resolvers are not present.
//
// Exports:
//   game.bbttcc.api.raid.resolveTarget(target) -> resolvedTargetProfile
//
// Notes:
//   - "resolvedTargetProfile" for creature targets is the canonical boss profile
//     consumed by downstream raid logic / behaviors.
//   - For hex/rig/facility targets, this resolver will attempt to delegate to any
//     existing specialized resolvers if present; otherwise it returns a minimal
//     shape that preserves the original target reference.

(() => {
  const TAG = "[bbttcc-raid/resolveTarget]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  const dup = (x) => {
    try {
      if (globalThis.foundry?.utils?.duplicate) return foundry.utils.duplicate(x);
    } catch {}
    try { return structuredClone(x); } catch {}
    return x;
  };

  const lc = (s)=>String(s??"").toLowerCase().trim();

  function normalizeStats(stats){
    const out = {};
    const src = (stats && typeof stats === "object") ? stats : {};
    for (const k of OP_KEYS) out[k] = 0;

    for (const [k,v] of Object.entries(src)){
      const kk = lc(k);
      if (!kk) continue;
      if (!OP_KEYS.includes(kk)) continue;
      const n = Number(v ?? 0);
      out[kk] = Number.isFinite(n) ? n : 0;
    }
    return out;
  }

  function normalizeBossDef(raw, fallbackKey){
    const def = (raw && typeof raw === "object") ? raw : {};
    const key = String(def.key || fallbackKey || "").trim() || fallbackKey || "";
    const label = String(def.label || def.name || key || "Creature").trim();

    const moraleHits = (() => {
      const n = Number(def.moraleHits ?? def.morale ?? def.hits ?? 1);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
    })();

    const mode = lc(def.mode || def.presentation?.mode || "abstract") || "abstract";

    return {
      targetType: "creature",
      key,
      label,
      mode,

      stats: normalizeStats(def.stats),
      moraleHits,

      behaviors: Array.isArray(def.behaviors) ? def.behaviors.slice() : [],
      ai: (def.ai && typeof def.ai === "object") ? dup(def.ai) : {},

      presentation: (def.presentation && typeof def.presentation === "object") ? dup(def.presentation) : {},
      outcomes: (def.outcomes && typeof def.outcomes === "object") ? dup(def.outcomes) : {}
    };
  }

  async function resolveCreatureTarget(target){
    const raid = game.bbttcc?.api?.raid;
    const registry = raid?.boss;

    let bossDef = null;

    // Primary: creatureId / bossKey
    const key = target?.creatureId || target?.bossKey || target?.key || null;
    if (registry?.get && key) {
      try { bossDef = registry.get(key); } catch (e) { warn("boss.get failed", e); }
    }

    // Secondary: actorUuid (actor-backed boss)
    if (!bossDef && target?.actorUuid) {
      try {
        const actor = await fromUuid(target.actorUuid);
        if (!actor) throw new Error("actor not found");
        if (registry?.fromActor) bossDef = registry.fromActor(actor);
        else {
          // minimal actor-backed fallback
          bossDef = {
            key: actor.id,
            label: actor.name,
            stats: actor.getFlag?.("bbttcc", "raidStats") ?? {},
            moraleHits: actor.getFlag?.("bbttcc", "moraleHits") ?? 1,
            behaviors: actor.getFlag?.("bbttcc", "behaviors") ?? []
          };
        }
      } catch (e) {
        warn("actorUuid boss fallback failed", e);
      }
    }

    if (!bossDef) {
      throw new Error(`${TAG} Could not resolve creature target (missing boss definition).`);
    }

    const normalized = normalizeBossDef(bossDef, key || bossDef?.key);

    // Carry through any scene hints supplied at targeting time
    if (target?.sceneUuid) normalized.presentation.sceneUuid = target.sceneUuid;
    if (target?.tokenUuid) normalized.presentation.tokenUuid = target.tokenUuid;

    // Attach raw reference for downstream debugging (non-authoritative)
    normalized.sourceTarget = dup(target || {});
    return normalized;
  }

  // Delegating resolvers for non-creature targets --------------------------------

  async function resolveHexTarget(target){
    // Prefer an existing specialized resolver if one exists anywhere in raid API
    const raid = game.bbttcc?.api?.raid || {};
    const fn =
      raid.resolveHexTarget ||
      raid.targets?.resolveHexTarget ||
      globalThis.resolveHexTarget; // legacy
    if (typeof fn === "function") return await fn(target);

    // Minimal, deterministic fallback: just echo the reference
    return {
      targetType: "hex",
      targetUuid: target?.targetUuid || target?.uuid || null,
      label: target?.label || "Hex",
      sourceTarget: dup(target || {})
    };
  }

  async function resolveRigTarget(target){
    const raid = game.bbttcc?.api?.raid || {};
    const fn =
      raid.resolveRigTarget ||
      raid.targets?.resolveRigTarget ||
      globalThis.resolveRigTarget;
    if (typeof fn === "function") return await fn(target);

    return {
      targetType: "rig",
      rigId: target?.rigId || null,
      defenderId: target?.defenderId || null,
      label: target?.label || "Rig",
      sourceTarget: dup(target || {})
    };
  }

  async function resolveFacilityTarget(target){
    const raid = game.bbttcc?.api?.raid || {};
    const fn =
      raid.resolveFacilityTarget ||
      raid.targets?.resolveFacilityTarget ||
      globalThis.resolveFacilityTarget;
    if (typeof fn === "function") return await fn(target);

    return {
      targetType: "facility",
      targetUuid: target?.targetUuid || target?.uuid || null,
      label: target?.label || "Facility",
      sourceTarget: dup(target || {})
    };
  }

  // Public entrypoint ------------------------------------------------------------

  async function resolveTarget(target){
    const t = (target && typeof target === "object") ? target : {};
    const type = lc(t.type || t.targetType || "hex");

    switch (type) {
      case "hex":      return await resolveHexTarget(t);
      case "rig":      return await resolveRigTarget(t);
      case "facility": return await resolveFacilityTarget(t);
      case "creature": return await resolveCreatureTarget(t);
      default:
        warn("Unknown target type; treating as hex:", type, t);
        return await resolveHexTarget(t);
    }
  }

  // Export
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.api = game.bbttcc.api || {};
  game.bbttcc.api.raid = game.bbttcc.api.raid || {};
  game.bbttcc.api.raid.resolveTarget = resolveTarget;

  log("Raid target resolver ready (hex/rig/facility/creature).");
})();
