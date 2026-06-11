/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · damage-wedge.js · Phase B.3 → adapter Phase 1
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes incoming damage on an actor with hasStructure:true through the
 * Structure damage path (Plates first, then BOM chipping, state transitions).
 * Any integrity overflow is passed back through the canonical damage path with
 * damageType cleared, so the existing destruction cascade + on-damage triggers
 * still fire.
 *
 * 2026-06-10 — Converted from a monkeypatch of game.fourththing.rolls.
 * _applyDamageToActor to a REGISTERED pre-damage interceptor on the system-
 * agnostic combat adapter (game.bbttcc.combat.registerDamageInterceptor). The
 * active system's applyDamage runs interceptors at the universal chokepoint, so
 * this still catches every damage path (chat-card, GM-relay socket, AoE/cast),
 * but bbttcc-structures no longer depends on the fourththing function existing —
 * the interceptor is system-agnostic (reads amount/damageType/flags only) and
 * works identically once a dnd5e combat impl lands. Overflow routes back through
 * game.bbttcc.combat.applyDamage with _skipInterceptors so it can't re-trigger
 * this interceptor.
 *
 * Per [[chat-apply-damage-canonical]] memory — never side-channel write to
 * derived/integrity. Use the canonical path. We intercept, we don't bypass.
 *
 * Per [[crew-rig-combat-arc-2026-05-19-20]] — GM-relay is already handled
 * upstream in applyDamageFromButton; by the time damage interceptors fire,
 * we're on the GM client with write perms. No additional relay needed here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { applyStructureDamage } from "./damage-path.js";
import { getActiveDamageSource, consumeCatastrophicEntry } from "./bulwark-hookups.js";

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}/wedge]`;
const FLAG_SCOPE = MOD_ID;

let _registered = false;

/**
 * Pre-damage interceptor. Returns { handled, description } when it CLAIMS the
 * target (a structure taking a damage op), or a falsy value to let the active
 * combat impl run its native path (normal actors, heals, non-structures).
 */
async function structureDamageInterceptor(actor, baseDmg, opts = {}) {
  try {
    const op = String(opts?.op ?? "damage").toLowerCase();
    const hasStructure = !!actor?.flags?.[FLAG_SCOPE]?.hasStructure;

    // Not ours — fall through to the impl's native damage/heal path.
    if (!hasStructure || op !== "damage") return null;

    // Apply per-target multiplier here so the Structure path sees the
    // already-scaled damage (avoids double-scaling when we route overflow back).
    const safeMult = (Number.isFinite(opts.perTargetMultiplier) && opts.perTargetMultiplier >= 0)
      ? opts.perTargetMultiplier : 1;
    const scaledDmg = Math.max(0, Math.floor((Number(baseDmg) || 0) * safeMult));

    if (scaledDmg <= 0) {
      return { handled: true, description: `${actor.name}: no damage (perTargetMultiplier=${safeMult})` };
    }

    // Phase C — check source actor for a Catastrophic Entry charge. If armed,
    // consume it and route the damage through with bypassThreshold + noSalvage
    // so even chip-only damage punches through to Plates and salvage is
    // suppressed. (RFI-only maneuver; absent on dnd5e → both flags stay false.)
    const sourceActor = getActiveDamageSource();
    const ce = await consumeCatastrophicEntry(sourceActor);
    const bypassThreshold = !!ce?.bypassThreshold;
    const noSalvage       = !!ce?.noSalvage;

    const structResult = await applyStructureDamage(actor, scaledDmg, {
      damageType: opts.damageType ?? "",
      damageFlavor: opts.damageFlavor ?? "",
      track: opts.track ?? "integrity",
      bypassThreshold,
      noSalvage
    });

    // Integrity overflow → route back through the canonical adapter path with
    // damageType cleared (structure resists already applied) and _skipInterceptors
    // so we don't re-enter this interceptor. perTargetMultiplier 1 (already scaled).
    if (structResult.integrityOverflow > 0) {
      const apply = game.bbttcc?.combat?.applyDamage;
      let originalDesc = "";
      if (typeof apply === "function") {
        originalDesc = await apply(actor, structResult.integrityOverflow, {
          ...opts,
          damageType: "",
          damageFlavor: "",
          perTargetMultiplier: 1,
          _skipInterceptors: true
        });
      }
      return {
        handled: true,
        description: originalDesc
          ? `${structResult.description} · ${originalDesc}`
          : structResult.description
      };
    }

    return { handled: true, description: structResult.description };
  } catch (e) {
    // Don't claim the target on failure — let the impl run its native path so a
    // structure still takes (plain integrity) damage rather than silently eating
    // the hit. Mirrors the old wedge's fall-back-to-original behavior.
    console.warn(TAG, "structure interceptor failed; falling through to native path", e);
    return null;
  }
}

function installWedge() {
  if (_registered) return;
  const reg = game?.bbttcc?.combat?.registerDamageInterceptor;
  if (typeof reg !== "function") {
    console.warn(TAG, "game.bbttcc.combat.registerDamageInterceptor not found; structure interceptor cannot register yet");
    return;
  }
  reg(structureDamageInterceptor);
  _registered = true;
  console.log(TAG, "structure damage interceptor registered on game.bbttcc.combat");
}

function uninstallWedge() {
  if (!_registered) return;
  game?.bbttcc?.combat?.unregisterDamageInterceptor?.(structureDamageInterceptor);
  _registered = false;
}

// Defer to ready so the combat adapter (bbttcc-core) + the active system impl
// have registered. registerDamageInterceptor exists from bbttcc-core init.
Hooks.once("ready", () => {
  installWedge();
  if (!_registered) {
    queueMicrotask(installWedge);
  }
});

// Expose installer/uninstaller on the API for diagnostic use.
Hooks.once("ready", () => {
  try {
    if (game.bbttcc?.api?.structures) {
      game.bbttcc.api.structures._wedge = { install: installWedge, uninstall: uninstallWedge, isInstalled: () => _registered };
    }
  } catch (_e) {}
});
