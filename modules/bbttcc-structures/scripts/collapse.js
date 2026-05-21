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
 * Tokens whose center sits inside the rect defined by `structToken.bounds`.
 * Excludes the structure itself.
 */
function findTokensInsideFootprint(structToken) {
  if (!structToken || !canvas?.tokens?.placeables) return [];
  const r = structToken.bounds;
  if (!r) return [];
  const result = [];
  for (const t of canvas.tokens.placeables) {
    if (!t.actor) continue;
    if (t.id === structToken.id) continue;
    const cx = t.center?.x;
    const cy = t.center?.y;
    if (cx == null || cy == null) continue;
    if (cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height) {
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
  const isStruct = ["rig", "boss"].includes(actor.type);
  const raw = actor.system?.system ?? actor.system;
  if (isStruct) {
    return Number(raw?.integrity?.value) || 0;
  }
  return Number(raw?.derived?.integrity?.value) || 0;
}

function clampNonlethal(damage, currentHP) {
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
 * Toggle prone status on an actor. Idempotent.
 */
async function applyProne(actor) {
  if (!actor) return;
  try {
    if (typeof actor.toggleStatusEffect === "function") {
      // V13/V14 path — accepts ("prone", { active: true })
      await actor.toggleStatusEffect("prone", { active: true });
      return;
    }
    // Fallback: create an AE manually
    const existing = actor.effects?.find?.(e => e.statuses?.has?.("prone"));
    if (existing) return;
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Prone (Collapse)",
      icon: "icons/svg/falling.svg",
      statuses: ["prone"],
      duration: { rounds: 1 }
    }]);
  } catch (e) {
    console.warn(TAG, "applyProne failed", e);
  }
}

/**
 * Main collapse handler. Called from the state-transition hook subscriber.
 */
export async function triggerCollapse(actor, { fromState, toState }) {
  if (!actor) return;

  // Only GM-side, to avoid double-applying via multiple clients
  if (!game.user?.isGM) return;

  const profile = actor.getFlag(FLAG_SCOPE, "collapseProfile") ?? {};
  const triggerState = profile.triggerState ?? "breached";

  // Trigger condition: newState matches triggerState. We DON'T re-fire if
  // the actor already collapsed in this scene (per the collapseFired flag).
  if (toState !== triggerState) return;
  const alreadyFired = !!actor.getFlag(FLAG_SCOPE, "collapseFired");
  if (alreadyFired) return;

  const structToken = findStructureToken(actor);
  if (!structToken) {
    console.log(TAG, `${actor.name} entered ${toState} but has no token on canvas — skipping collapse footprint resolution`);
    await actor.setFlag(FLAG_SCOPE, "collapseFired", true);
    await postCollapseHeaderCard(actor, profile, /*tokensCount=*/0);
    return;
  }

  const tokensOnTop = findTokensInsideFootprint(structToken);

  await postCollapseHeaderCard(actor, profile, tokensOnTop.length);

  // Roll damage ONCE per token (each gets independent roll)
  const damageDice = profile.damageDice ?? "2d10";
  const knockbackFt = Math.max(0, Number(profile.knockbackFt) || 0);
  const nonlethal = profile.nonlethal !== false;  // default true
  const center = { x: structToken.center.x, y: structToken.center.y };

  const results = [];
  for (const tok of tokensOnTop) {
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

    // Prone + knockback
    await applyProne(tokActor);
    if (knockbackFt > 0) await knockbackToken(tok, center, knockbackFt);

    results.push({ actor: tokActor, rolled, applied, nonlethalCapped: applied < rolled, desc });

    await postCollapseTargetCard(actor, tokActor, { rolled, applied, nonlethal, formula: damageDice });
  }

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

async function postCollapseTargetCard(structure, target, { rolled, applied, nonlethal, formula }) {
  const cappedNote = applied < rolled
    ? `<span style="color:#e8c84a; font-size:0.7rem"> (nonlethal cap: ${rolled} → ${applied})</span>`
    : "";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: target }),
    content: `
      <div style="border:1px solid #e08a3a; padding:0.4rem 0.6rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
        <div style="font-size:0.74rem; color:#e08a3a; margin-bottom:3px;">
          ◈ ${_esc(target.name)} caught in collapse of ${_esc(structure.name)}
        </div>
        <div style="font-size:0.74rem;">
          <b>${formula}</b> = ${rolled} damage${cappedNote}
          · <i style="opacity:0.7">prone</i>
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
