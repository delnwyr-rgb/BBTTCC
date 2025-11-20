// v1.0.0 — Develop Infrastructure (standard, light)
// Queues +1 Defense and +5 Trade Yield on the target hex drawing.
// No new tag; this is the lighter cousin of Infrastructure Expansion.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/develop-infrastructure-std]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueDevelopInfrastructure({ targetUuid, def=1, trade=5 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pending = foundry.utils.getProperty(f, "turn.pending") || {};

    pending.defenseDelta    = Number(pending.defenseDelta    || 0) + Number(def || 0);
    pending.tradeYieldDelta = Number(pending.tradeYieldDelta || 0) + Number(trade || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pending });
    return `Queued: +${def} Defense • +${trade} Trade Yield`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.develop_infrastructure_std?.apply;

    E.develop_infrastructure_std = Object.assign({}, E.develop_infrastructure_std, {
      kind:  "strategic",
      band:  "standard",
      label: E.develop_infrastructure_std?.label || "Develop Infrastructure",
      cost:  E.develop_infrastructure_std?.cost  || { economy: 2, logistics: 1 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queueDevelopInfrastructure({ targetUuid: entry?.targetUuid, def: 1, trade: 5 });
        return [msg, m2].filter(Boolean).join(" • ") || "Develop Infrastructure queued.";
      }
    });

    console.log(TAG, "installed (+1 Def, +5 Trade; no new tag).");
  });
})();
