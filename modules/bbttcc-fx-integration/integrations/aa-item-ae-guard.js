/**
 * aa-item-ae-guard.js — compat shim for Automated Animations (7.0.x).
 * ---------------------------------------------------------------------------
 * AA's createActiveEffects / deleteActiveEffects / toggle handlers resolve
 *     actor = effect.parent instanceof Item ? effect.parent.actor : effect.parent
 * then read `actor.token` WITHOUT a null check. For an Active Effect attached to an
 * ITEM that is not embedded in an Actor (world / compendium item — exactly our
 * Bucket-A passive-grant AEs and Bucket-B applyOnUse template AEs), `parent.actor`
 * is null, so the AE create/delete hook throws:
 *     TypeError: Cannot read properties of null (reading 'token')   (handleActiveEffects.js)
 * Non-fatal (the AE still saves), but it spams the console on every item-AE op.
 *
 * Fix: wrap ONLY AA's AE-hook callbacks so they bail when the effect resolves to no
 * actor (there is no token to animate on anyway). Every other AA behaviour —
 * including item-effect animations that fire on actor-owned effects — is preserved
 * untouched. The callbacks are identified by the `disableAEAnimations` setting check
 * they all share. Idempotent + defensive: if the Hooks registry shape or AA's
 * callbacks aren't found, it logs and no-ops.
 *
 * NOTE: AA's *config dialog* opened from a parentless item is a separate code path
 * (not a hook) and is not addressed here — open the AA config from a token/actor.
 */
const TAG = "BBTTCC | aa-item-ae-guard |";
const AE_HOOKS = ["createActiveEffect", "deleteActiveEffect", "updateActiveEffect"];

function resolveActor(effect) {
  const parent = effect?.parent;
  if (!parent) return null;
  if (parent instanceof Item)  return parent.actor ?? null;   // embedded item → its actor; world/compendium → null
  if (parent instanceof Actor) return parent;
  return null;
}

let installed = false;
function installGuard() {
  if (installed) return true;
  const aa = game.modules.get("autoanimations");
  if (!aa?.active) { installed = true; return true; }   // AA absent — nothing to guard

  let seen = 0, wrapped = 0;
  for (const hook of AE_HOOKS) {
    const entries = Hooks.events?.[hook];
    if (!Array.isArray(entries)) continue;
    for (const entry of [...entries]) {                  // snapshot — we mutate the registry
      let src = "";
      try { src = String(entry.fn); } catch (_e) { /* ignore */ }
      if (!src.includes("disableAEAnimations")) continue; // AA's AE callbacks all gate on this setting
      seen++;
      const original = entry.fn;
      const wrapper = function (effect, ...rest) {
        try { if (!resolveActor(effect)) return; }        // no token to animate — skip AA cleanly
        catch (_e) { /* fall through to original on any doubt */ }
        return original.call(this, effect, ...rest);
      };
      Hooks.off(hook, entry.id);
      Hooks.on(hook, wrapper);
      wrapped++;
    }
  }
  if (seen > 0) {
    installed = true;
    console.log(`${TAG} guarded ${wrapped} Automated Animations AE hook(s) against null-actor (item) effects.`);
    return true;
  }
  return false;   // AA hooks not registered yet — caller will retry
}

Hooks.once("ready", () => {
  try {
    if (installGuard()) return;
    let tries = 0;
    const iv = setInterval(() => {
      if (installGuard() || ++tries > 20) clearInterval(iv);   // ~8s of retries for late AA registration
    }, 400);
  } catch (e) {
    console.warn(`${TAG} guard install failed (non-fatal)`, e);
  }
});
