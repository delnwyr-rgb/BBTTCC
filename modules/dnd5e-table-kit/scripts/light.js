// D&D 5e Table Kit — effect-driven token light, no ATL / DAE item macros (Dave 11-12: ship self-contained).
//
// An Active Effect with the change key `flags.dnd5e-table-kit.light` (type custom) lights its bearer's tokens
// while it lasts. Value = comma list of k=v:
//   bright=20, dim=40, color=#ff9b4a, alpha=0.4, animation=torch, speed=3, intensity=3
// Several light effects at once: the biggest radius wins (bright and dim maxed separately; the strongest one's
// colour/animation). When the last one ends, the token's own light comes back (saved on the token as
// flags.dnd5e-table-kit.lightBase the first time an effect takes it over).
// Runs on the active GM only (writes are idempotent, so two GM windows on one login are harmless).

import { ID } from "./riders.js";

export const LIGHT_KEY = `flags.${ID}.light`;

export function parseLight(value) {
  const out = {};
  for ( const part of String(value ?? "").split(",") ) {
    const i = part.indexOf("=");
    if ( i < 1 ) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  const n = (v) => (v === undefined || v === "") ? undefined : Number(v);
  return {
    bright: n(out.bright) ?? 0, dim: n(out.dim) ?? 0, color: out.color || null, alpha: n(out.alpha),
    animation: out.animation || null, speed: n(out.speed), intensity: n(out.intensity),
  };
}

function wantedLight(actor) {
  let best = null;
  for ( const e of actor?.appliedEffects ?? [] ) {
    if ( e.disabled || e.isSuppressed ) continue;
    for ( const c of (e.changes ?? e.system?.changes ?? []) ) {
      if ( c.key !== LIGHT_KEY ) continue;
      const l = parseLight(c.value);
      if ( !best ) { best = { ...l }; continue; }
      const stronger = Math.max(l.bright, l.dim) > Math.max(best.bright, best.dim);
      best.bright = Math.max(best.bright, l.bright);
      best.dim = Math.max(best.dim, l.dim);
      if ( stronger ) Object.assign(best, { color: l.color ?? best.color, alpha: l.alpha ?? best.alpha, animation: l.animation ?? best.animation, speed: l.speed ?? best.speed, intensity: l.intensity ?? best.intensity });
    }
  }
  return best;
}

export async function syncLight(actor) {
  if ( !actor || !game.user.isGM || (game.users.activeGM?.id !== game.user.id) ) return;
  const want = wantedLight(actor);
  for ( const token of actor.getActiveTokens?.(false, true) ?? [] ) {
    const base = token.getFlag?.(ID, "lightBase");
    if ( want ) {
      const update = {};
      if ( !base ) update[`flags.${ID}.lightBase`] = token.light?.toObject?.() ?? foundry.utils.deepClone(token.light ?? {});
      update.light = {
        bright: want.bright, dim: Math.max(want.dim, want.bright),
        ...(want.color ? { color: want.color } : {}), ...(Number.isFinite(want.alpha) ? { alpha: want.alpha } : {}),
        animation: want.animation ? { type: want.animation, ...(Number.isFinite(want.speed) ? { speed: want.speed } : {}), ...(Number.isFinite(want.intensity) ? { intensity: want.intensity } : {}) } : { type: null },
      };
      const cur = token.light ?? {};
      if ( !base || cur.bright !== update.light.bright || cur.dim !== update.light.dim || (want.color && cur.color?.toString?.() !== want.color) || (cur.animation?.type ?? null) !== (update.light.animation.type ?? null) )
        await token.update(update);
    } else if ( base ) {
      await token.update({ light: base, [`flags.${ID}.-=lightBase`]: null });
    }
  }
}

function onEffectChange(effect) {
  const parent = effect?.parent;
  const actor = parent?.documentName === "Actor" ? parent : (parent?.documentName === "Item" ? parent.actor : null);
  if ( !actor ) return;
  // Only bother when a light effect is involved (or a light is currently held by the token).
  const touches = (effect.changes ?? effect.system?.changes ?? []).some(c => c.key === LIGHT_KEY)
    || actor.getActiveTokens?.(false, true)?.some(t => t.getFlag?.(ID, "lightBase"));
  if ( touches ) syncLight(actor).catch(err => console.warn(`${ID} | light sync failed`, err));
}

export function activateLight() {
  Hooks.on("createActiveEffect", onEffectChange);
  Hooks.on("updateActiveEffect", onEffectChange);
  Hooks.on("deleteActiveEffect", onEffectChange);
  // A token dropped onto a scene while its actor already carries a light effect.
  Hooks.on("createToken", (token) => { if ( token.actor ) syncLight(token.actor).catch(() => {}); });
}
