/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-core · combat.dnd5e.js · Adapter Phase 1 — dnd5e combat impl
 * ─────────────────────────────────────────────────────────────────────────────
 * dnd5e (5.x) implementation of the system-agnostic `game.bbttcc.combat`
 * contract. The fourththing (RFI) impl registers itself from the system; this
 * is its dnd5e counterpart so that, in a dnd5e world, the bbttcc cross-module
 * damage callers (raid/siege) AND the bbttcc-structures damage interceptor work
 * identically — structures route through the agnostic integrity/plates model,
 * normal dnd5e actors take native HP damage.
 *
 * DORMANT unless `game.system.id === "dnd5e"`. In a fourththing/Bad Eden world
 * this file loads but the ready gate returns immediately, so it is a strict
 * no-op there (the RFI impl owns the contract). Registration never clobbers an
 * impl another source already installed.
 *
 * Built + verified against the locally installed dnd5e v5.3.0 API (Foundry v14):
 *   - Actor5e#applyDamage(damages, options): `damages` is [{value,type}] or a
 *     plain number (number form sets options.ignore=true → bypasses DR/DI/DV).
 *     Positive value = damage, negative = healing. Returns the Actor (NOT a
 *     description string), and natively fires the `dnd5e.applyDamage` hook.
 *   - HP lives at actor.system.attributes.hp { value, max, temp, tempmax }.
 *   - CONFIG.DND5E.damageTypes validates damage-type ids.
 *   - Actor#toggleStatusEffect(id, {active}) toggles conditions ("prone", …).
 *
 * NOTE — UNVALIDATED IN-WORLD. The owner runs fourththing, so this dnd5e path
 * has not been exercised live. It is the reference impl a real dnd5e deployment
 * would use; validate it by spinning up a dnd5e world before relying on it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TAG = "[bbttcc-core/combat.dnd5e]";

// Best-effort map from RFI/raid damage-type strings → dnd5e damage types where
// there is a clean equivalent. Anything unmapped (or not a real dnd5e type) is
// applied UNTYPED (resistances bypassed) so the amount still lands rather than
// being silently dropped. Tune this once a real dnd5e campaign is in play.
const RFI_TO_DND5E_TYPE = {
  kinetic:    "bludgeoning",
  concussive: "thunder",
  ballistic:  "piercing",
  blade:      "slashing",
  thermal:    "fire",
  incendiary: "fire",
  cryo:       "cold",
  shock:      "lightning",
  electric:   "lightning",
  caustic:    "acid",
  toxic:      "poison",
  void:       "necrotic"
  // "radiation" has no clean dnd5e analog → untyped.
};

/** Resolve an RFI damage-type to a valid dnd5e type, or null for "apply untyped". */
function _dnd5eDamageType(rfiType) {
  const t = String(rfiType || "").toLowerCase();
  if (!t) return null;
  if (RFI_TO_DND5E_TYPE[t]) return RFI_TO_DND5E_TYPE[t];
  if (CONFIG?.DND5E?.damageTypes && (t in CONFIG.DND5E.damageTypes)) return t;
  return null;
}

/**
 * Run the registered pre-damage interceptors (e.g. bbttcc-structures' integrity
 * router). Mirrors the RFI fulcrum's loop so structures behave identically on
 * dnd5e. Returns the first interceptor result that CLAIMS the target, else null.
 */
async function _runDamageInterceptors(actor, baseDmg, ctx) {
  const icepts = game.bbttcc?.combat?._interceptors;
  if (!(icepts instanceof Array) || !icepts.length) return null;
  for (const icept of icepts) {
    try {
      const r = await icept(actor, baseDmg, ctx);
      if (r && r.handled) return r;
    } catch (e) {
      console.warn(TAG, "damage interceptor threw; falling through to native path", e);
    }
  }
  return null;
}

/**
 * applyDamage(actor, baseDmg, opts) → description string (callers display it).
 * Runs interceptors at the top (the chokepoint contract), then applies native
 * dnd5e HP damage/healing for un-claimed actors.
 */
async function applyDamage(actor, baseDmg, {
  op = "damage", track = "integrity", damageType = "", damageFlavor = "",
  perTargetMultiplier = 1, ignoreResists = false, nonlethal = false,
  _skipInterceptors = false
} = {}) {
  if (!actor) return null;

  // Interceptors first — a structure (or other registered handler) may CLAIM the
  // target and fully resolve it; we then short-circuit. _skipInterceptors guards
  // an interceptor's overflow re-entry so it cannot re-trigger itself.
  if (!_skipInterceptors) {
    const claimed = await _runDamageInterceptors(actor, baseDmg, {
      op, track, damageType, damageFlavor, perTargetMultiplier, ignoreResists, nonlethal
    });
    if (claimed) return claimed.description ?? null;
  }

  const hp = actor.system?.attributes?.hp;
  if (!hp) return `${actor.name}: no HP pool`; // group actors / non-creatures

  const safeMult = (Number.isFinite(perTargetMultiplier) && perTargetMultiplier >= 0) ? perTargetMultiplier : 1;
  const scaled = Math.max(0, Math.floor((Number(baseDmg) || 0) * safeMult));

  // Heal op → negative damage (number form; dnd5e restores HP, clamped to max).
  if (op === "heal") {
    if (scaled <= 0) return `${actor.name}: no healing`;
    const before = Number(hp.value) || 0;
    await actor.applyDamage(-scaled);
    const after = Number(actor.system?.attributes?.hp?.value);
    const a = Number.isFinite(after) ? after : before;
    return `${actor.name}: HP ${before} → ${a} (+${a - before})`;
  }

  if (scaled <= 0) return `${actor.name}: no damage`;

  const before = Number(hp.value) || 0;
  const dType = _dnd5eDamageType(damageType);
  if (ignoreResists || dType === null) {
    // Untyped / resist-bypass → numeric form (ignore=true bypasses DR/DI/DV).
    await actor.applyDamage(scaled);
  } else {
    await actor.applyDamage([{ value: scaled, type: dType }]);
  }
  const after = Number(actor.system?.attributes?.hp?.value);
  const a = Number.isFinite(after) ? after : before;
  const typeNote = dType ? ` ${dType}` : (damageType ? ` ${String(damageType).toLowerCase()}` : "");
  // nonlethal is left to upstream callers (e.g. collapse.js clamps before this);
  // dnd5e's 0-HP / death-save semantics are intentionally not overridden here.
  return `${actor.name}: HP ${before} → ${a} (−${before - a})${typeNote}`;
}

/** getHealth(actor) → {value, max} of the dnd5e HP pool; null when unreadable. */
function getHealth(actor) {
  const hp = actor?.system?.attributes?.hp;
  if (!hp) return { value: null, max: null };
  const value = Number(hp.value), max = Number(hp.max);
  return { value: Number.isFinite(value) ? value : null, max: Number.isFinite(max) ? max : null };
}

/** hasCondition(actor, condition) → bool via the Foundry-core status set. */
function hasCondition(actor, condition) {
  return !!actor?.statuses?.has?.(condition);
}

/**
 * applyCondition(actor, condition, opts) → {applied, skipped}. Toggles the dnd5e
 * status effect on. (dc/sourceName from the RFI contract are unused here — dnd5e
 * conditions carry no save-each-round payload at apply time.)
 */
async function applyCondition(actor, condition, _opts = {}) {
  if (!actor || !condition) return { applied: false, skipped: false };
  if (actor.statuses?.has?.(condition)) return { applied: true, skipped: false }; // idempotent
  try {
    await actor.toggleStatusEffect(condition, { active: true });
    return { applied: !!actor.statuses?.has?.(condition), skipped: false };
  } catch (e) {
    console.warn(TAG, `applyCondition(${condition}) failed`, e);
    return { applied: false, skipped: false };
  }
}

/**
 * resistsForcedMove(actor, opts) → bool. dnd5e has no built-in forced-movement
 * resistance gate, so nothing resists by default (knockback always lands). A
 * future homebrew-flag check would slot in here.
 */
async function resistsForcedMove(/* actor, opts */) {
  return false;
}

// Register at ready, after bbttcc-core init created the contract slots and the
// active system had a chance to register its own impl. Hard-gated to dnd5e.
Hooks.once("ready", () => {
  if (game.system?.id !== "dnd5e") return; // DORMANT on fourththing / other systems
  const combat = game.bbttcc?.combat;
  if (!combat) {
    console.warn(TAG, "game.bbttcc.combat not initialized; cannot register dnd5e impl");
    return;
  }
  // Fill only empty slots — never clobber an impl another source installed.
  if (typeof combat.applyDamage       !== "function") combat.applyDamage = applyDamage;
  if (typeof combat.getHealth         !== "function") combat.getHealth = getHealth;
  if (typeof combat.hasCondition      !== "function") combat.hasCondition = hasCondition;
  if (typeof combat.applyCondition    !== "function") combat.applyCondition = applyCondition;
  if (typeof combat.resistsForcedMove !== "function") combat.resistsForcedMove = resistsForcedMove;
  console.log(TAG, "dnd5e combat impl registered on game.bbttcc.combat (system=dnd5e, dnd5e v5.x)");
});
