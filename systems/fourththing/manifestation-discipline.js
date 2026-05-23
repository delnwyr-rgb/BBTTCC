// BBTTCC — Manifestation Discipline aggregator (caster-pilot 2026-04-27)
// ─────────────────────────────────────────────────────────────────────────────
// Reads per-actor "discipline" knobs off feature items + per-actor Mode flag,
// returns a single bundle the cast/upkeep/misfire pipeline consults. Designed
// to be additive: an actor with no discipline items and no active Mode gets
// all-zero shifts and the engine behaves exactly as before.
//
// Item flag schema (set on feat items granted via class advancement):
//   flags.fourththing.discipline.passive = {
//     reachDiscount,        // int  — subtracts from Blood-Debt cost on reach
//     misfireBandShift,     // int  — added to d10 misfire bias (negative=better)
//     clarityMaxBonus,      // int  — added to clarity max in data prep
//     upkeepScale,          // float — multiplier on per-tick upkeep cost
//     concurrencyBonus      // int  — informational, surfaced in upkeep card
//   }
//   flags.fourththing.discipline.mode = {
//     key,                  // string — actor's mode flag this item is gated on
//     grants: { …same shape as passive… }   // applies only when mode is ON
//   }
//
// Active mode toggle:
//   actor.flags.fourththing.modes[key] = true | false
//   (e.g. "clSentence", "wlRefraction", "dwWalkingLane", "pkSealedPact")
// ─────────────────────────────────────────────────────────────────────────────

const FIELDS = ["reachDiscount", "misfireBandShift", "clarityMaxBonus", "upkeepScale", "concurrencyBonus"];

function _zero() {
  return { reachDiscount: 0, misfireBandShift: 0, clarityMaxBonus: 0, upkeepScale: 1, concurrencyBonus: 0 };
}

function _add(into, src) {
  if (!src) return into;
  for (const k of FIELDS) {
    const v = Number(src[k]);
    if (!Number.isFinite(v)) continue;
    if (k === "upkeepScale") into[k] *= v;        // multiplicative
    else into[k] += v;                             // additive
  }
  return into;
}

export function getActiveModes(actor) {
  return actor?.flags?.fourththing?.modes ?? {};
}

export function isModeActive(actor, key) {
  if (!key) return false;
  return Boolean(getActiveModes(actor)?.[key]);
}

// Aggregate every item on the actor into one shifts bundle. Cheap — runs once
// per cast / misfire / upkeep tick. Items without discipline flags are skipped.
//
// Class-identity baseline (added 2026-05-22): canonical class-level discipline
// budgets are encoded here directly rather than requiring every compendium
// class item to carry the right flags. This keeps canon transparent in code
// and survives compendium edits.
//   - Pactkeeper: passive concurrencyBonus +1 (Initiation 1 — The Bargain)
//   - Pactkeeper: mode `pkSealedPact` grants concurrencyBonus +2 (Initiation 11)
export function getDisciplineShifts(actor) {
  const out = _zero();
  if (!actor?.items) return out;

  // Class-identity baseline (canon class budgets).
  const hasPactkeeper = (actor.items ?? []).some(
    it => it?.type === "class" && it?.system?.identifier === "pactkeeper"
  );
  if (hasPactkeeper) {
    out.concurrencyBonus += 1; // The Bargain (Initiation 1)
    if (isModeActive(actor, "pkSealedPact")) {
      out.concurrencyBonus += 2; // Sealed Pact (Initiation 11) while stance ON
    }
  }

  for (const it of actor.items) {
    const disc = it?.flags?.fourththing?.discipline;
    if (!disc) continue;
    if (disc.passive) _add(out, disc.passive);
    if (disc.mode && isModeActive(actor, disc.mode.key) && disc.mode.grants) {
      _add(out, disc.mode.grants);
    }
  }
  return out;
}

// Convenience accessors used by individual call sites.
export function getReachDiscount(actor)      { return getDisciplineShifts(actor).reachDiscount; }
export function getMisfireBandShift(actor)   { return getDisciplineShifts(actor).misfireBandShift; }
export function getClarityMaxBonus(actor)    { return getDisciplineShifts(actor).clarityMaxBonus; }
export function getUpkeepScale(actor)        { return getDisciplineShifts(actor).upkeepScale; }
export function getConcurrencyBonus(actor)   { return getDisciplineShifts(actor).concurrencyBonus; }

// Toggle a mode flag and announce in chat. Used by the four Signature Mode
// dialogs in ft-class-automation.js.
export async function setMode(actor, key, on, { label } = {}) {
  if (!actor || !key) return false;
  const cur = foundry.utils.deepClone(getActiveModes(actor));
  cur[key] = !!on;
  await actor.setFlag("fourththing", "modes", cur);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">⟁ ${label ?? key}</span></div><div class="ft-prev-align-note">${on ? "Stance taken" : "Stance dropped"}.</div></div>`
  });
  return true;
}

export async function toggleMode(actor, key, opts = {}) {
  return setMode(actor, key, !isModeActive(actor, key), opts);
}

// Brief one-line summary for cast/upkeep chat cards. Empty string when nothing
// to surface (so we don't pollute every roll with zero-shift noise).
export function summarizeDiscipline(actor) {
  const s = getDisciplineShifts(actor);
  const bits = [];
  if (s.reachDiscount)       bits.push(`Reach −${s.reachDiscount}`);
  if (s.misfireBandShift)    bits.push(`Misfire ${s.misfireBandShift > 0 ? "+" : ""}${s.misfireBandShift}`);
  if (s.clarityMaxBonus)     bits.push(`Clarity max +${s.clarityMaxBonus}`);
  if (s.upkeepScale !== 1)   bits.push(`Upkeep ×${s.upkeepScale.toFixed(2)}`);
  if (s.concurrencyBonus)    bits.push(`Concurrency +${s.concurrencyBonus}`);
  return bits.join(" · ");
}
