// scripts/raid-infiltration.canvas-vfx.enhancer.js
// ─────────────────────────────────────────────────────────────────────────────
// S3a.4 — Subscribes to bbttcc:infiltration:{alarmChanged,progressChanged,
// outcomeResolved} hooks and plays canvas VFX using fourththing's PIXI bridge.
//
// Targeting rule: prefer the attacker/defender actor's first active token on
// the current canvas; fall back to the viewport center. Bails silently if
// no canvas, no scene, or no VFX API.
// ─────────────────────────────────────────────────────────────────────────────

(() => {
  const TAG = "[bbttcc-raid:infil-vfx]";

  function _vfx() {
    return globalThis.ftPlayCombatVfx || game?.fourththing?.vfx?.playCombat || null;
  }

  function _actorToken(actorId) {
    if (!actorId) return null;
    const actor = game.actors?.get(String(actorId).replace(/^Actor\./, ""));
    if (!actor) return null;
    const tok = actor.getActiveTokens?.()?.[0];
    return tok?.object ?? tok ?? null;
  }

  function _viewportCenter() {
    if (!canvas?.stage) return null;
    const cx = canvas.stage.pivot?.x ?? (canvas.dimensions?.width  ?? 0) / 2;
    const cy = canvas.stage.pivot?.y ?? (canvas.dimensions?.height ?? 0) / 2;
    return { center: { x: cx, y: cy }, w: 200 };
  }

  function _target(actorId) {
    return _actorToken(actorId) || _viewportCenter();
  }

  Hooks.on("bbttcc:infiltration:alarmChanged", ({ delta, attackerId }) => {
    try {
      const vfx = _vfx(); if (!vfx) return;
      const tgt = _target(attackerId); if (!tgt) return;
      if (delta > 0) {
        // Rising alarm — escalating amber/red rings
        const kind = (delta >= 3) ? "alarmWave" : "detectionPing";
        const opts = (delta === 2) ? { maxRadius: 220 } : {};
        vfx(tgt, kind, opts);
      } else if (delta < 0) {
        // Calming — gentle teal stealth ping
        vfx(tgt, "stealthPing");
      }
    } catch (e) { console.warn(TAG, "alarmChanged vfx", e); }
  });

  Hooks.on("bbttcc:infiltration:progressChanged", ({ delta, attackerId }) => {
    try {
      if (delta <= 0) return;
      const vfx = _vfx(); if (!vfx) return;
      const tgt = _target(attackerId); if (!tgt) return;
      vfx(tgt, "progressPulse");
    } catch (e) { console.warn(TAG, "progressChanged vfx", e); }
  });

  Hooks.on("bbttcc:infiltration:outcomeResolved", ({ outcome, attackerId, defenderId }) => {
    try {
      const vfx = _vfx(); if (!vfx) return;
      if (outcome === "clean") {
        const tgt = _target(attackerId);
        if (tgt) vfx(tgt, "stealthPing", { maxRadius: 280, durationMs: 900 });
      } else if (outcome === "messy") {
        const tgt = _target(attackerId);
        if (tgt) {
          vfx(tgt, "stealthPing", { maxRadius: 240, durationMs: 800 });
          setTimeout(() => { try { vfx(tgt, "detectionPing", { maxRadius: 180 }); } catch (_) {} }, 250);
        }
      } else if (outcome === "detected") {
        // Big red wave centered on the defender (or fall back to attacker / viewport)
        const tgt = _actorToken(defenderId) || _target(attackerId);
        if (tgt) vfx(tgt, "alarmWave");
      }
    } catch (e) { console.warn(TAG, "outcomeResolved vfx", e); }
  });

  console.log(TAG, "Infiltration canvas VFX hooks subscribed.");
})();
