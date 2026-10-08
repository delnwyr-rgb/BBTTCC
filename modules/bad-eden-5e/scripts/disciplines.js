/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · disciplines.js — stance-gated techniques
 * ─────────────────────────────────────────────────────────────────────────────
 * The RFI "mode" techniques (Drawing Deep, Refracted Attention, Lucid Footing, Bound and
 * Bargained) only apply while a Signature Mode stance is held. In 5E the converter gives each
 * a second Active Effect, DISABLED by default, flagged flags.bad-eden-5e.mode = <key>; the
 * player toggles it while the stance is active. Where the stance exists as a surge-powers buff
 * (the Pactkeeper's Sealed Pact), this module flips the effect automatically when the buff
 * lands or ends.
 * ───────────────────────────────────────────────────────────────────────────── */
import { MOD } from "./casting.js";

/** mode key → the name of the surge-powers Active Effect that IS the stance in 5E. */
export const MODE_STANCES = { pkSealedPact: "Sealed Pact" };

function modeOfEffect(effect) {
  if (!(effect?.parent instanceof Actor)) return null;
  return Object.entries(MODE_STANCES).find(([, name]) => effect.name === name)?.[0] ?? null;
}

/** Enable or disable every technique effect gated on `mode` across the actor's items. */
export async function setMode(actor, mode, on) {
  if (!actor?.isOwner) return;
  for (const item of actor.items) {
    for (const e of item.effects) {
      if (e.flags?.[MOD]?.mode !== mode || e.disabled === !on) continue;
      await e.update({ disabled: !on });
    }
  }
}

function onStanceCreated(effect, options, userId) {
  if (userId !== game.user.id) return;
  const mode = modeOfEffect(effect);
  if (mode) setMode(effect.parent, mode, true).catch(e => console.warn(`${MOD} | mode on failed`, e));
}
function onStanceDeleted(effect, options, userId) {
  if (userId !== game.user.id) return;
  const mode = modeOfEffect(effect);
  if (mode) setMode(effect.parent, mode, false).catch(e => console.warn(`${MOD} | mode off failed`, e));
}

export function activateDisciplines() {
  Hooks.on("createActiveEffect", onStanceCreated);
  Hooks.on("deleteActiveEffect", onStanceDeleted);
}
export const disciplines = { MODE_STANCES, setMode };
