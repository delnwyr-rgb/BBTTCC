// bbttcc-raid/enhancers/raid-victory.enhancer.js
// Adds Victory/Unity mechanics (read-only friendly):
// 1) Strategic Activities: if EFFECTS spec includes victory.unity (or unityDelta), apply that delta on consume.
// 2) Post-Round: award Unity by outcome (+2 win, +1 stalemate, -2 loss; configurable via flags).
// Safe: no rule changes elsewhere; all calls are wrapped and guarded.

(() => {
  const TAG = "[bbttcc-raid/victory-enhancer]";
  const MOD_FACTIONS = "bbttcc-factions";

  const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v||0)));
  const readFlag = (actor, path, dflt) => {
    try { return foundry.utils.getProperty(actor.flags || {}, path) ?? dflt; } catch { return dflt; }
  };
  const setFlag = async (actor, path, value) => {
    try { await actor.update({ [`flags.${path}`]: value }); } catch (e) { console.warn(TAG, "setFlag fail", path, e); }
  };

  async function adjustUnity(actorId, delta, { reason="", who="system" } = {}) {
    const A = game.actors.get(String(actorId));
    if (!A) return;
    const vPath = `${MOD_FACTIONS}.victory`;
    const cur = readFlag(A, vPath, {});
    const unity = clamp((cur?.unity ?? readFlag(A, `${MOD_FACTIONS}.unity`, 0)) + (Number(delta)||0), 0, 100);
    const next = { ...(cur||{}), unity };
    await setFlag(A, vPath, next);

    try {
      const logs = Array.isArray(readFlag(A, `${MOD_FACTIONS}.warLogs`, [])) ? readFlag(A, `${MOD_FACTIONS}.warLogs`, []) : [];
      logs.push({ type:"commit", date:(new Date()).toLocaleString(), summary:`Unity ${delta>=0?"+":""}${delta} — ${reason||"adjustment"}` });
      await setFlag(A, `${MOD_FACTIONS}.warLogs`, logs);
    } catch (e) {
      /* non-fatal */
    }
  }

  // derive per-faction outcome rules from flags or use defaults
  function getOutcomeRules(actor) {
    const def = { win:+2, stalemate:+1, loss:-2 };
    const vRules = readFlag(actor, `${MOD_FACTIONS}.victory.unityRules`, null);
    if (!vRules) return def;
    return { ...def, ...vRules };
  }

  function installOnce() {
    const raid = game.bbttcc?.api?.raid || game.modules.get("bbttcc-raid")?.api?.raid;
    if (!raid) return void console.warn(TAG, "raid API not ready");

    // ---------- 1) Wrap EFFECTS.apply for strategic activities ----------
    try {
      const E = raid.EFFECTS || {};
      Object.entries(E).forEach(([key, spec]) => {
        if (!spec || typeof spec !== "object") return;
        const v = spec.victory || {};
        const unityDelta = (typeof v.unity === "number") ? v.unity
                         : (typeof spec.unityDelta === "number") ? spec.unityDelta
                         : null;
        if (unityDelta === null) return;

        const origApply = (typeof spec.apply === "function") ? spec.apply : null;
        spec.apply = async function wrappedApply({ actor, entry, key: k, spec: s, cost }) {
          let note = "";
          if (origApply) {
            try { note = await origApply({ actor, entry, key: k, spec: s, cost }) || ""; }
            catch (e) { console.warn(TAG, "spec.apply failed", k, e); }
          }
          try {
            await adjustUnity(actor.id, unityDelta, { reason: `Strategic: ${s?.label || k}` });
          } catch (e) { console.warn(TAG, "adjustUnity(Strategic) failed", k, e); }
          return note;
        };
      });
      console.log(TAG, "Wrapped EFFECTS.apply for Victory/Unity where declared.");
    } catch (e) {
      console.warn(TAG, "EFFECTS wrap failed", e);
    }

    // ---------- 2) Wrap applyPostRoundEffects to award by outcome ----------
    if (typeof raid.applyPostRoundEffects === "function") {
      const origPost = raid.applyPostRoundEffects;
      raid.applyPostRoundEffects = async function wrappedPost(args = {}) {
        const res = await origPost(args);
        try {
          const attackerId = args?.attackerId ?? args?.attacker ?? args?.attId;
          const defenderId = args?.defenderId ?? args?.defender ?? args?.defId;
          const attacker = attackerId ? game.actors.get(String(attackerId)) : null;
          const defender = defenderId ? game.actors.get(String(defenderId)) : null;

          // Normalize an outcome shape
          // Prefer explicit `outcome` string if present; else fall back to boolean `success`.
          let outcome = (args?.outcome || "").toString().toLowerCase();
          if (!outcome) outcome = (args?.success === true) ? "win" : (args?.success === false) ? "loss" : "";

          // If still blank, try to infer from res if it returned an outcome
          if (!outcome && res && typeof res === "object" && typeof res.outcome === "string") {
            outcome = res.outcome.toLowerCase();
          }

          // No inference available; bail quietly
          if (!outcome) return res;

          // Map non-standard keys
          if (outcome === "tie") outcome = "stalemate";

          // Apply deltas using per-faction rules
          if (attacker) {
            const r = getOutcomeRules(attacker);
            const delta = r[outcome];
            if (typeof delta === "number" && delta) await adjustUnity(attacker.id, delta, { reason:`Raid ${outcome}` });
          }
          if (defender) {
            // Mirror, but inverted for defender for win/loss; stalemate = +1 for both.
            const r = getOutcomeRules(defender);
            let o2 = outcome;
            if (outcome === "win") o2 = "loss";
            else if (outcome === "loss") o2 = "win";
            const delta2 = r[o2];
            if (typeof delta2 === "number" && delta2) await adjustUnity(defender.id, delta2, { reason:`Raid ${o2}` });
          }

        } catch (e) {
          console.warn(TAG, "post-round unity award failed", e);
        }
        return res;
      };
      console.log(TAG, "Wrapped applyPostRoundEffects with Victory/Unity awards.");
    } else {
      console.warn(TAG, "applyPostRoundEffects not found; skipping outcome awards.");
    }
  }

  Hooks.once("ready", installOnce);
  if (game?.ready) installOnce();
  Hooks.on("canvasReady", installOnce);
})();