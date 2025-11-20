// v1.0.0 — Infrastructure Expansion (mechanical)
// Adds "Expanded Infrastructure" to the target hex drawing and queues +2 Defense, +10 Trade Yield.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.infrastructure_expansion.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/infrastructure-expansion]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueInfrastructureExpansion({ targetUuid, def=2, trade=10 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pending = foundry.utils.getProperty(f, "turn.pending") || {};

    // Tag: Expanded Infrastructure
    pending.repairs = pending.repairs || {};
    pending.repairs.addModifiers = Array.isArray(pending.repairs.addModifiers)
      ? pending.repairs.addModifiers.slice() : [];
    if (!pending.repairs.addModifiers.includes("Expanded Infrastructure")) {
      pending.repairs.addModifiers.push("Expanded Infrastructure");
    }

    // Bumps
    pending.defenseDelta    = Number(pending.defenseDelta    || 0) + Number(def || 0);
    pending.tradeYieldDelta = Number(pending.tradeYieldDelta || 0) + Number(trade || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pending });
    return `Queued: add "Expanded Infrastructure" • +${def} Defense • +${trade} Trade Yield`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.infrastructure_expansion?.apply;

    E.infrastructure_expansion = Object.assign({}, E.infrastructure_expansion, {
      kind:  "strategic",
      band:  "standard",
      label: E.infrastructure_expansion?.label || "Infrastructure Expansion",
      cost:  E.infrastructure_expansion?.cost  || { economy: 4, logistics: 2 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queueInfrastructureExpansion({ targetUuid: entry?.targetUuid, def: 2, trade: 10 });
        return [msg, m2].filter(Boolean).join(" • ") || "Infrastructure Expansion queued.";
      }
    });

    console.log(TAG, "installed (Expanded Infrastructure tag, +2 Def/+10 Trade).");
  });
})();
