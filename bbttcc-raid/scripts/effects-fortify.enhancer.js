// effects-fortify.enhancer.js — v1.0.2 (late-install, idempotent)
// Installs EFFECTS.fortify_hex reliably even if other scripts republish the raid API after ready.

(() => {
  const EFFECT_KEY = "fortify_hex";
  const MOD_T = "bbttcc-territory";

  function resolveEffects() {
    const raidNs = game?.bbttcc?.api?.raid;
    if (raidNs?.EFFECTS) return raidNs.EFFECTS;
    const globalFX = game?.bbttcc?.api?.EFFECTS;
    if (globalFX) return globalFX;
    const mod = game?.modules?.get?.("bbttcc-raid");
    return mod?.api?.raid?.EFFECTS ?? null;
  }

  async function queueFortify({ targetUuid, defenseDelta = 2 }) {
    if (!targetUuid) return "No target.";
    const hx = await fromUuid(targetUuid);
    const doc = hx?.document ?? hx;
    if (!doc) return "Bad target UUID.";
    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pending = foundry.utils.getProperty(f, "turn.pending") || {};
    pending.repairs = pending.repairs || {};
    pending.repairs.addModifiers = Array.isArray(pending.repairs.addModifiers)
      ? pending.repairs.addModifiers.slice() : [];
    if (!pending.repairs.addModifiers.includes("Fortified")) {
      pending.repairs.addModifiers.push("Fortified");
    }
    pending.defenseDelta = Number(pending.defenseDelta || 0) + Number(defenseDelta || 0);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pending });
    return `Queued: +"Fortified" • +${defenseDelta} Defense`;
  }

  function install() {
    try {
      const E = resolveEffects();
      if (!E) return false;
      const original = E[EFFECT_KEY]?.apply;
      E[EFFECT_KEY] = Object.assign({}, E[EFFECT_KEY], {
        kind:  E[EFFECT_KEY]?.kind  || "strategic",
        band:  E[EFFECT_KEY]?.band  || "standard",
        label: E[EFFECT_KEY]?.label || "Fortify Hex",
        cost:  E[EFFECT_KEY]?.cost  || { economy: 2, logistics: 2, violence: 1 },
        async apply({ actor, entry }) {
          const targetUuid = entry?.targetUuid ?? null;
          let baseMsg = "";
          if (typeof original === "function") {
            try { baseMsg = String(await original({ actor, entry })) || ""; } catch {}
          }
          const msg = await queueFortify({ targetUuid, defenseDelta: 2 });
          return [baseMsg, msg].filter(Boolean).join(" • ") || "Fortify queued.";
        }
      });
      console.log("[bbttcc] EFFECTS.fortify_hex installed (v1.0.2).");
      return true;
    } catch (e) {
      console.error("[bbttcc] Fortify enhancer install error:", e);
      return false;
    }
  }

  // 1) Try on ready (normal case)
  Hooks.once("ready", () => {
    // slight defer lets any ready-time republish happen first
    setTimeout(() => { install(); }, 0);
  });

  // 2) Try again on canvasReady (later than ready)
  Hooks.once("canvasReady", () => { install(); });

  // 3) If compat bridge ever emits a custom republish event, hook it too
  Hooks.on("bbttcc:raid:published", () => { install(); });
})();
