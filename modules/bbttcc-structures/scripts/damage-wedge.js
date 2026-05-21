/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · damage-wedge.js · Phase B.3
 * ─────────────────────────────────────────────────────────────────────────────
 * Wedges game.fourththing.rolls._applyDamageToActor so any incoming damage on
 * an actor with hasStructure:true is routed through the Structure damage path
 * (Plates first, then BOM chipping, state transitions). Any integrity overflow
 * is then passed back to the original function with damageType cleared, so
 * the existing destruction cascade + on-damage triggers still fire.
 *
 * Wedge point: _applyDamageToActor (module.js:8083) is the universal
 * per-actor damage entry point. Both:
 *   • applyDamageFromButton (chat-card path)
 *   • ft-applyDamage GM-relay socket handler
 *   • AoE / save-based cast paths
 * funnel through this function. One wedge catches them all.
 *
 * Pattern: save the original, replace with a wrapper. Wrapper checks the
 * hasStructure flag, calls applyStructureDamage if set, then routes any
 * overflow through the saved original.
 *
 * Per [[chat-apply-damage-canonical]] memory — never side-channel write to
 * derived/integrity. Use the canonical path. We wedge, we don't bypass.
 *
 * Per [[crew-rig-combat-arc-2026-05-19-20]] — GM-relay is already handled
 * upstream in applyDamageFromButton; by the time _applyDamageToActor fires,
 * we're on the GM client with write perms. No additional relay needed here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { applyStructureDamage } from "./damage-path.js";
import { getActiveDamageSource, consumeCatastrophicEntry } from "./bulwark-hookups.js";

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}/wedge]`;
const FLAG_SCOPE = MOD_ID;

let _wedged = false;
let _originalApplyDamage = null;

function installWedge() {
  if (_wedged) return;
  const target = game?.fourththing?.rolls;
  if (!target?._applyDamageToActor) {
    console.warn(TAG, "_applyDamageToActor not found; wedge cannot install yet");
    return;
  }
  _originalApplyDamage = target._applyDamageToActor;

  target._applyDamageToActor = async function wedgedApplyDamageToActor(actor, baseDmg, opts = {}) {
    try {
      // Only intercept damage ops on actors with hasStructure flag.
      const op = String(opts?.op ?? "damage").toLowerCase();
      const hasStructure = !!actor?.flags?.[FLAG_SCOPE]?.hasStructure;

      if (!hasStructure || op !== "damage") {
        return await _originalApplyDamage.call(this, actor, baseDmg, opts);
      }

      // Apply per-target multiplier here so the Structure path sees the
      // already-scaled damage (avoids double-scaling if we route overflow back).
      const safeMult = (Number.isFinite(opts.perTargetMultiplier) && opts.perTargetMultiplier >= 0)
        ? opts.perTargetMultiplier : 1;
      const scaledDmg = Math.max(0, Math.floor((Number(baseDmg) || 0) * safeMult));

      if (scaledDmg <= 0) return `${actor.name}: no damage (perTargetMultiplier=${safeMult})`;

      // Phase C — check source actor for a Catastrophic Entry charge. If
      // armed, consume it and route the damage through with bypassThreshold +
      // noSalvage opts so even chip-only damage punches through to Plates and
      // salvage is suppressed.
      const sourceActor = getActiveDamageSource();
      const ce = await consumeCatastrophicEntry(sourceActor);
      const bypassThreshold = !!ce?.bypassThreshold;
      const noSalvage       = !!ce?.noSalvage;

      // Route through structure
      const structResult = await applyStructureDamage(actor, scaledDmg, {
        damageType: opts.damageType ?? "",
        damageFlavor: opts.damageFlavor ?? "",
        track: opts.track ?? "integrity",
        bypassThreshold,
        noSalvage
      });

      // If integrity overflow, route to the saved original with cleared
      // damageType so its defense-mult shortcut bypasses (we already applied
      // structure resists). perTargetMultiplier set to 1 because we've
      // already scaled.
      if (structResult.integrityOverflow > 0) {
        const originalDesc = await _originalApplyDamage.call(this, actor, structResult.integrityOverflow, {
          ...opts,
          damageType: "",
          damageFlavor: "",
          perTargetMultiplier: 1
        });
        // Combine descriptions for chat compactness; both cards already posted.
        return originalDesc
          ? `${structResult.description} · ${originalDesc}`
          : structResult.description;
      }

      return structResult.description;
    } catch (e) {
      console.warn(TAG, "wedge failure; falling back to original", e);
      return await _originalApplyDamage.call(this, actor, baseDmg, opts);
    }
  };

  _wedged = true;
  console.log(TAG, "damage wedge installed on _applyDamageToActor");
}

function uninstallWedge() {
  if (!_wedged) return;
  const target = game?.fourththing?.rolls;
  if (target && _originalApplyDamage) {
    target._applyDamageToActor = _originalApplyDamage;
  }
  _wedged = false;
  _originalApplyDamage = null;
}

// Defer to ready so fourththing's system code has run + game.fourththing
// is populated. _applyDamageToActor is assigned during system init.
Hooks.once("ready", () => {
  // Small delay — some systems assign the function lazily on first call.
  // Try immediately, then retry on a microtask if not yet present.
  installWedge();
  if (!_wedged) {
    queueMicrotask(installWedge);
  }
});

// Expose installer/uninstaller on the API for diagnostic use.
Hooks.once("ready", () => {
  try {
    if (game.bbttcc?.api?.structures) {
      game.bbttcc.api.structures._wedge = { install: installWedge, uninstall: uninstallWedge, isInstalled: () => _wedged };
    }
  } catch (_e) {}
});
