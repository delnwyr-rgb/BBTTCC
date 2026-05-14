// bbttcc-raid/enhancers/raid-morale.enhancer.js
// Adjust Morale based on raid outcomes. Defaults attacker {win:+5, stalemate:+2, loss:-5}; defender mirrored.
// Per-faction overrides: flags['bbttcc-factions'].moraleRules = { win, stalemate, loss }.
(() => {
  const TAG = "[bbttcc-raid/raid-morale]";
  const MOD = "bbttcc-factions";
  const clamp = v => Math.max(0, Math.min(100, Number(v||0)));
  const get = (obj, path, dflt) => { try { return foundry.utils.getProperty(obj, path) ?? dflt; } catch { return dflt; } };
  const setFlag = async (A, path, value) => { try { await A.update({ [`flags.${path}`]: value }); } catch(e){ console.warn(TAG, "setFlag fail", path, e); } };
  const DEF = { win:+5, stalemate:+2, loss:-5 };

  async function adjustMorale(actorId, delta, reason){
    const A = game.actors.get(String(actorId)); if (!A) return;
    const cur = Number(get(A, `flags.${MOD}.morale`, 0)) || 0;
    const next = clamp(cur + Number(delta||0));
    await setFlag(A, `${MOD}.morale`, next);
    const war = get(A, `flags.${MOD}.warLogs`, []);
    war.push({ type:"turn", date:(new Date()).toLocaleString(), summary:`Morale ${delta>=0?"+":""}${delta} — ${reason}` });
    await setFlag(A, `${MOD}.warLogs`, war);
    A.sheet?.render(true);
  }
  function rulesFor(A){ const custom = get(A, `flags.${MOD}.moraleRules`, null); return custom ? { ...DEF, ...custom } : DEF; }

  function installOnce(){
    const raid = game.bbttcc?.api?.raid || game.modules.get("bbttcc-raid")?.api?.raid;
    if (!raid || typeof raid.applyPostRoundEffects !== "function") return console.warn(TAG, "raid.applyPostRoundEffects not found");
    const orig = raid.applyPostRoundEffects;
    raid.applyPostRoundEffects = async function wrapped(args={}){
      const res = await orig(args);
      try {
        const attackerId = args?.attackerId ?? args?.attacker ?? args?.attId;
        const defenderId = args?.defenderId ?? args?.defender ?? args?.defId;
        const attacker = attackerId ? game.actors.get(String(attackerId)) : null;
        const defender = defenderId ? game.actors.get(String(defenderId)) : null;
        let outcome = (args?.outcome || "").toString().toLowerCase();
        if (!outcome) outcome = (args?.success === true) ? "win" : (args?.success === false) ? "loss" : "";
        if (!outcome && res && typeof res === "object" && typeof res.outcome === "string") outcome = res.outcome.toLowerCase();
        if (!outcome) return res;
        if (outcome === "tie") outcome = "stalemate";
        if (attacker) { const R = rulesFor(attacker); const d = R[outcome]; if (typeof d === "number" && d) await adjustMorale(attacker.id, d, `Raid ${outcome}`); }
        if (defender) { const R = rulesFor(defender); let o2 = outcome; if (outcome === "win") o2="loss"; else if (outcome === "loss") o2="win"; const d2 = R[o2]; if (typeof d2 === "number" && d2) await adjustMorale(defender.id, d2, `Raid ${o2}`); }
      } catch(e){ console.warn(TAG, "morale adjust failed", e); }
      return res;
    };
    console.log(TAG, "installed");
  }
  Hooks.once("ready", installOnce);
  if (game?.ready) installOnce();
  Hooks.on("canvasReady", installOnce);
})();