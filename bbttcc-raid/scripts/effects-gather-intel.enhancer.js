// v1.0.0 — Gather Intel (mechanical):
// Adds "Intel" tag to the target hex drawing and queues a small one-turn faction bonus.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.gather_intel.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const TAG   = "[bbttcc/gather-intel]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go();
    else Hooks.on("ready", go);
  }

  async function queueIntelOnHex({ targetUuid }) {
    const hex = await fromUuid(targetUuid);
    const doc = hex?.document ?? hex;
    if (!doc) return "Bad target UUID";

    const f   = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(f, "turn.pending") || {};
    pend.repairs = pend.repairs || {};
    // Tag the hex with a visible “Intel” marker for GM/UI logic
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers)
      ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Intel")) {
      pend.repairs.addModifiers.push("Intel");
    }

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Intel" tag on hex`;
  }

  async function queueOneTurnFactionBonus({ actor }) {
    // Write to faction pending so compat/Turn pipeline applies it on Advance Turn
    const A = actor;
    const F = foundry.utils.duplicate(A.flags?.[MOD_F] || {});
    const pend = F.turn?.pending || {};
    pend.nextTurn = Object.assign({}, pend.nextTurn, {
      intelAdvantage: true,  // visible semantic flag
      dcIntelBonus:   -2     // future DC logic can read this; harmless if ignored
    });
    await A.update({ [`flags.${MOD_F}.turn.pending`]: pend }, { diff:true, recursive:true });
    return `Queued: next-turn intel advantage (DC -2)`;
  }

  whenRaidReady((api) => {
    const E = api.EFFECTS;
    const base = E.gather_intel?.apply;

    E.gather_intel = Object.assign({}, E.gather_intel, {
      kind:  "strategic",
      band:  "standard",
      label: E.gather_intel?.label || "Gather Intel",
      cost:  E.gather_intel?.cost  || { intrigue: 2 },
      async apply({ actor, entry }) {
        const targetUuid = entry?.targetUuid ?? null;
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ actor, entry })) || ""; }
          catch (e) { console.warn(TAG,"base apply error", e); }
        }
        const m1 = targetUuid ? await queueIntelOnHex({ targetUuid }) : "No target hex";
        const m2 = await queueOneTurnFactionBonus({ actor });
        return [msg, m1, m2].filter(Boolean).join(" • ");
      }
    });

    console.log(TAG, "installed (Intel tag + one-turn bonus).");
  });
})();
