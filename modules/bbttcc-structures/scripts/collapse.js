/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · collapse.js · Phase B.5
 * ─────────────────────────────────────────────────────────────────────────────
 * Collapse trigger — fires when a Structure transitions into its
 * collapseProfile.triggerState (default "breached"). Finds tokens whose center
 * is inside the Structure token's footprint and applies:
 *
 *   • Fall damage (rolled from collapseProfile.damageDice)
 *   • Nonlethal cap — damage cannot reduce target below 1 HP/integrity
 *   • Prone status effect
 *   • Knockback (collapseProfile.knockbackFt away from structure center)
 *
 * Per-target chat card with apply-damage button + GM override. Hook
 * `bbttcc:structure:collapse` emitted with full result.
 *
 * One-shot: a `collapseFired` flag is set after the first collapse to prevent
 * re-firing on subsequent state changes within the same scene. Repair
 * (Phase D) clears the flag.
 *
 * Per [[crew-rig-combat-arc-2026-05-19-20]] GM-relay pattern — non-GM
 * clients route damage through the existing ft-applyDamage socket; this file
 * only runs the structural side. Effective application of the damage rides
 * the wedge (which catches all _applyDamageToActor calls).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getActiveDamageSource } from "./bulwark-hookups.js";

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}/collapse]`;
const FLAG_SCOPE = MOD_ID;

const _esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/**
 * Find the structure's token on the active canvas. Returns null if not placed
 * on the current scene.
 */
function findStructureToken(actor) {
  if (!canvas?.tokens?.placeables) return null;
  return canvas.tokens.placeables.find(t => t.actor?.id === actor.id) ?? null;
}

/**
 * Set of "i,j" grid-offset keys the structure token actually occupies, or null
 * if the grid has no discrete cells (gridless) so the caller falls back to the
 * bounding-rect test.
 *
 * Why not just the bounding rect: a large or HEX-grid structure token's AABB
 * includes corner space the structure doesn't really stand on, so a token
 * merely *adjacent* to the structure gets falsely caught in the collapse
 * (the "bad guy on top of the wall when he wasn't" bug). We instead enumerate
 * the grid cells whose CENTER lands inside the structure token's rect and treat
 * that as the true footprint — trimming the hex/diagonal corners.
 */
function _structureOccupiedCells(structToken, r, grid) {
  if (!grid?.getOffset || !grid?.getCenterPoint || !grid?.getOffsetRange) return null;
  const GRIDLESS = globalThis.CONST?.GRID_TYPES?.GRIDLESS ?? 0;
  if (grid.isGridless || grid.type === GRIDLESS) return null;
  try {
    const range = grid.getOffsetRange(r); // [i0, j0, i1, j1], end-exclusive
    if (!Array.isArray(range) || range.length !== 4) return null;
    const [i0, j0, i1, j1] = range;
    const cells = new Set();
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const c = grid.getCenterPoint({ i, j });
        if (c.x >= r.x && c.x <= r.x + r.width && c.y >= r.y && c.y <= r.y + r.height) {
          cells.add(`${i},${j}`);
        }
      }
    }
    return cells.size ? cells : null;
  } catch (e) {
    console.warn(TAG, "occupied-cell computation failed; falling back to bounding rect", e);
    return null;
  }
}

/**
 * Tokens standing on the structure's footprint. Excludes the structure itself.
 * Uses grid-cell occupancy: a candidate counts as "on top" only if its center
 * sits in a cell the structure actually occupies. Falls back to a bounding-rect
 * test on gridless scenes or if the grid offset API is unavailable.
 */
function findTokensInsideFootprint(structToken) {
  if (!structToken || !canvas?.tokens?.placeables) return [];
  const r = structToken.bounds;
  if (!r) return [];
  const grid = canvas?.grid;
  const occupied = _structureOccupiedCells(structToken, r, grid);

  const result = [];
  for (const t of canvas.tokens.placeables) {
    if (!t.actor) continue;
    if (t.id === structToken.id) continue;
    const cx = t.center?.x;
    const cy = t.center?.y;
    if (cx == null || cy == null) continue;

    if (occupied) {
      let off = null;
      try { off = grid.getOffset({ x: cx, y: cy }); } catch (_e) { off = null; }
      if (off && occupied.has(`${off.i},${off.j}`)) result.push(t);
    } else if (cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height) {
      // Gridless / no-offset-API fallback: original bounding-rect test.
      result.push(t);
    }
  }
  return result;
}

/**
 * Apply nonlethal cap to a damage amount: if the resulting current would drop
 * below 1, clamp damage to (currentValue - 1). Looks up the target's primary
 * HP/integrity value.
 */
function readTargetCurrentHP(actor) {
  // Rigs/Bosses: system.integrity.value
  // Everything else: system.derived.integrity.value (fourththing characters/npcs)
  // Returns null (NOT 0) when the track is unreadable, so the nonlethal clamp
  // can tell "genuinely at/below 1" apart from "couldn't read the field".
  const isStruct = ["rig", "boss"].includes(actor.type);
  const raw = actor.system?.system ?? actor.system;
  const v = isStruct ? raw?.integrity?.value : raw?.derived?.integrity?.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampNonlethal(damage, currentHP) {
  // null = HP unreadable. Apply in full rather than silently zeroing the hit —
  // the old `|| 0` read made collapses deal NO damage whenever the field came
  // back empty/NaN, which is exactly the "card says 12, nothing happened" bug.
  if (currentHP == null) return damage;
  if (currentHP <= 1) return 0;   // already at 1 or below; nonlethal does nothing
  const maxAllowed = currentHP - 1;
  return Math.max(0, Math.min(damage, maxAllowed));
}

/**
 * Knock a token away from a center point by `knockbackFt`. Uses the scene's
 * grid distance to convert ft → pixels. No-op if grid distance unavailable.
 */
async function knockbackToken(token, fromCenter, knockbackFt) {
  if (!token || knockbackFt <= 0) return;
  // Forced-movement gate (Bulwark Anchor/Stance, Aurablade Lock/Ignore-push).
  if (await game?.fourththing?.resistsForcedMove?.(token.actor, { reason: "collapse knockback" })) return;
  const grid = canvas?.scene?.grid;
  if (!grid?.distance || !grid?.size) return;
  const pxPerFt = grid.size / grid.distance;
  const dx = (token.center.x - fromCenter.x);
  const dy = (token.center.y - fromCenter.y);
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const moveX = ux * knockbackFt * pxPerFt;
  const moveY = uy * knockbackFt * pxPerFt;
  // Snap to grid for clean placement
  const snapped = canvas.grid.getSnappedPoint
    ? canvas.grid.getSnappedPoint({ x: token.x + moveX, y: token.y + moveY }, { mode: CONST.GRID_SNAPPING_MODES?.CENTER ?? 0x10 })
    : { x: token.x + moveX, y: token.y + moveY };
  await token.document.update({ x: snapped.x, y: snapped.y });
}

/**
 * Apply prone to an actor. Returns true if it landed, false otherwise.
 * Idempotent. Prefers the system's canonical condition applier so prone lands
 * through the same managed-AE path the rest of fourththing uses (sheet/HUD
 * reflection + system.conditions.prone). A bare toggleStatusEffect("prone")
 * doesn't register here — that's why collapse prone wasn't sticking.
 */
async function applyProne(actor) {
  if (!actor) return false;
  // Already prone? Treat as success, don't double-apply.
  const alreadyProne = actor.effects?.some?.(e =>
    e.flags?.fourththing?.condition === "prone" || e.statuses?.has?.("prone"));
  if (alreadyProne) return true;

  // Canonical path — applies the condition AE immediately (the dc is only
  // stored on the AE for any later save-each-round handler; there is no save
  // gate at apply time, so prone lands).
  try {
    const applyStates = game?.fourththing?.applyManifestationStates;
    if (typeof applyStates === "function") {
      const stub = { name: "Structure Collapse", id: actor.id, system: {} };
      const synthMf = { appliedStates: { states: ["prone"], duration: "1-round" } };
      const res = await applyStates(actor, actor, stub, synthMf, { castDc: 15 });
      // res.applied includes "prone" on success; null/empty means it no-op'd
      // (e.g. condition immunity) — fall through to the manual fallback only if
      // it truly failed to create anything.
      if (res && Array.isArray(res.applied) && res.applied.includes("prone")) return true;
      if (res && Array.isArray(res.skipped) && res.skipped.some(s => s.key === "prone")) return false; // immune/dedup — respect it
    }
  } catch (e) {
    console.warn(TAG, "canonical prone apply failed; trying fallback", e);
  }

  // Fallback for environments without the system applier.
  try {
    if (typeof actor.toggleStatusEffect === "function") {
      await actor.toggleStatusEffect("prone", { active: true });
      return true;
    }
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Prone (Collapse)",
      icon: "icons/svg/falling.svg",
      statuses: ["prone"],
      duration: { rounds: 1 }
    }]);
    return true;
  } catch (e) {
    console.warn(TAG, "applyProne failed", e);
    return false;
  }
}

/**
 * Main collapse handler. Called from the state-transition hook subscriber.
 */
export async function triggerCollapse(actor, { fromState, toState }) {
  if (!actor) return;

  // Capture the breaching actor (the Bulwark who just damaged this structure)
  // FIRST, before any await — getActiveDamageSource is only live inside the
  // synchronous damage-apply window. 2026-05-25: the one who breaches a wall is
  // never caught in the collapse of THEIR OWN breach (they were adjacent, not
  // standing on it). Excluded from the footprint below.
  const breacher = getActiveDamageSource();

  // Only GM-side, to avoid double-applying via multiple clients
  if (!game.user?.isGM) return;

  const profile = actor.getFlag(FLAG_SCOPE, "collapseProfile") ?? {};
  const triggerState = profile.triggerState ?? "breached";

  // Trigger condition: fire when the structure reaches the trigger state OR a MORE destroyed
  // one. A hit big enough to skip "breached" straight to "razed" (or any over-kill blow) must
  // STILL collapse — the garrison is ejected/hurt regardless. The collapseFired flag makes it
  // once-only, so the normal breached→razed progression won't double-fire.
  const _SEV = { intact: 0, damaged: 1, breached: 2, razed: 3 };
  if ((_SEV[toState] ?? -1) < (_SEV[triggerState] ?? 2)) return;
  const alreadyFired = !!actor.getFlag(FLAG_SCOPE, "collapseFired");
  if (alreadyFired) return;

  const structToken = findStructureToken(actor);
  if (!structToken) {
    console.log(TAG, `${actor.name} entered ${toState} but has no token on canvas — skipping collapse footprint resolution`);
    await actor.setFlag(FLAG_SCOPE, "collapseFired", true);
    await postCollapseHeaderCard(actor, profile, /*tokensCount=*/0);
    return;
  }

  const breacherId = breacher?.id ?? null;
  const tokensOnTop = findTokensInsideFootprint(structToken)
    .filter(t => !breacherId || t.actor?.id !== breacherId)
    // A collapsing structure does NOT catch OTHER structures in its rubble: they aren't
    // creatures standing on it, "Prone" is meaningless on a wall/keep, and falling damage
    // shouldn't transfer between structures. In a siege the fortification layers (Outer Wall /
    // Barbican / Inner Keep) are staged near each other on the tableau diorama, so their
    // footprints overlap — without this, breaching one wall proned + damaged all the others.
    .filter(t => t.actor?.getFlag?.(FLAG_SCOPE, "hasStructure") !== true);

  await postCollapseHeaderCard(actor, profile, tokensOnTop.length);

  // Roll damage ONCE per token (each gets independent roll)
  const damageDice = profile.damageDice ?? "2d10";
  const knockbackFt = Math.max(0, Number(profile.knockbackFt) || 0);
  const nonlethal = profile.nonlethal !== false;  // default true
  const center = { x: structToken.center.x, y: structToken.center.y };

  const results = [];
  for (const tok of tokensOnTop) {
    // Isolate each token. Previously an exception on one target (e.g. a
    // knockback move or the card post throwing) aborted the whole for-loop,
    // so only the FIRST token-on-top took damage/prone and the rest were
    // silently skipped. Each token is now independent.
    try {
      const tokActor = tok.actor;
      if (!tokActor) continue;

      let roll, rolled;
      try {
        roll = new Roll(damageDice);
        await roll.evaluate();
        rolled = Math.max(0, Math.floor(Number(roll.total) || 0));
      } catch (e) {
        console.warn(TAG, "damage roll failed", e);
        rolled = 0;
      }

      let applied = rolled;
      if (nonlethal) {
        const curHP = readTargetCurrentHP(tokActor);
        applied = clampNonlethal(rolled, curHP);
      }

      // Apply damage via the canonical path (which routes through our wedge
      // for hasStructure actors — and through the existing integrity path
      // otherwise). Use _applyDamageToActor directly so this collapse damage
      // doesn't accidentally re-fire structure damage on the COLLAPSING
      // structure (the wedge filters by op === "damage" + hasStructure on the
      // TARGET, which for a token-on-top is different from the structure).
      let desc = "";
      try {
        if (applied > 0 && game?.fourththing?.rolls?._applyDamageToActor) {
          desc = await game.fourththing.rolls._applyDamageToActor(tokActor, applied, {
            op: "damage",
            track: "integrity",
            damageType: "concussive",
            damageFlavor: "collapse",
            perTargetMultiplier: 1
          });
        }
      } catch (e) {
        console.warn(TAG, "collapse damage apply failed", e);
      }

      // Prone + knockback. Knockback is guarded on its own so a movement
      // failure can't skip this token's card or block the next token.
      const proneApplied = await applyProne(tokActor);
      // Tableau (forced-perspective) tokens sit in choreographed depth bands — a physical
      // knockback flings them out of formation and the Y→scale curve snaps them to the wrong
      // size, which reads as "the tableau effect turned off". Keep their damage + prone, but
      // leave them standing where they are. Non-tableau collapses knock back exactly as before.
      const isTableauTok = tok.document?.flags?.["bbttcc-raid"]?.tableauActor === true;
      if (knockbackFt > 0 && !isTableauTok) {
        try { await knockbackToken(tok, center, knockbackFt); }
        catch (e) { console.warn(TAG, "collapse knockback failed", e); }
      }

      results.push({ actor: tokActor, rolled, applied, nonlethalCapped: applied < rolled, prone: proneApplied, desc });

      await postCollapseTargetCard(actor, tokActor, { rolled, applied, nonlethal, formula: damageDice, prone: proneApplied });
    } catch (e) {
      console.warn(TAG, `collapse processing failed for token ${tok?.name ?? tok?.id}; continuing with the rest`, e);
    }
  }

  console.log(TAG, `collapse of ${actor.name}: ${tokensOnTop.length} on footprint, ${results.length} processed`);

  await actor.setFlag(FLAG_SCOPE, "collapseFired", true);

  Hooks.callAll("bbttcc:structure:collapse", { actor, results, tokensOnTop: tokensOnTop.length, profile });
}

// ── Chat cards ──────────────────────────────────────────────────────────────

async function postCollapseHeaderCard(actor, profile, tokensCount) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div style="border:2px solid #e08a3a; padding:0.5rem 0.7rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
        <div style="font-size:0.82rem; color:#e08a3a; letter-spacing:0.1em; margin-bottom:5px;">
          ◈ COLLAPSE — ${_esc(actor.name)}
        </div>
        <div style="font-size:0.76rem; opacity:0.85; line-height:1.45">
          The structure gives way.
          ${tokensCount > 0
            ? `<b>${tokensCount}</b> token${tokensCount === 1 ? "" : "s"} on top — falling damage <b>${_esc(profile.damageDice ?? "2d10")}</b>${profile.nonlethal !== false ? " <span style='opacity:0.7'>(nonlethal — cannot drop below 1 HP)</span>" : ""}.`
            : "Footprint is clear of tokens."}
        </div>
      </div>
    `
  });
}

async function postCollapseTargetCard(structure, target, { rolled, applied, nonlethal, formula, prone }) {
  // Show what was actually APPLIED, not just the raw roll — the card used to
  // always report `rolled` + "prone" even when the nonlethal clamp zeroed the
  // hit or prone didn't land, so it claimed effects that never happened.
  const dmgNote = applied !== rolled
    ? `<b>${formula}</b> = ${rolled} → <b>${applied}</b> applied <span style="color:#e8c84a; font-size:0.7rem">(nonlethal cap)</span>`
    : `<b>${formula}</b> = <b>${applied}</b> damage`;
  const proneNote = prone ? ` · <i style="opacity:0.7">prone</i>` : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: target }),
    content: `
      <div style="border:1px solid #e08a3a; padding:0.4rem 0.6rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
        <div style="font-size:0.74rem; color:#e08a3a; margin-bottom:3px;">
          ◈ ${_esc(target.name)} caught in collapse of ${_esc(structure.name)}
        </div>
        <div style="font-size:0.74rem;">
          ${dmgNote}${proneNote}
        </div>
      </div>
    `
  });
}

// ── Hook subscription ───────────────────────────────────────────────────────

Hooks.once("ready", () => {
  Hooks.on("bbttcc:structure:stateChanged", async (ctx) => {
    try {
      await triggerCollapse(ctx?.actor, { fromState: ctx?.fromState, toState: ctx?.toState });
    } catch (e) {
      console.warn(TAG, "collapse hook failure", e);
    }
  });
  console.log(TAG, "collapse trigger installed");
});

// Expose for diagnostic use
Hooks.once("ready", () => {
  try {
    if (game.bbttcc?.api?.structures) {
      game.bbttcc.api.structures.triggerCollapse = triggerCollapse;
      game.bbttcc.api.structures.findTokensInsideFootprint = findTokensInsideFootprint;
    }
  } catch (_e) {}
});
