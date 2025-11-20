// v1.0.1 — Establish Supply Line: tag + trade yield, safe boot guard

(() => {
  const MOD_R="bbttcc-raid", MOD_T="bbttcc-territory";
  const TAG="[bbttcc/supply-line]";

  function whenRaidReady(cb, tries=0){
    const go=()=>{ const api=game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries>60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb,tries+1),250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  async function queueSupplyLine({ targetUuid, tradeYieldDelta=10 }){
    const hex=await fromUuid(targetUuid); const doc=hex?.document ?? hex;
    if (!doc) return "Bad target UUID";
    const f=foundry.utils.duplicate(doc.flags?.[MOD_T]||{}); const pend=foundry.utils.getProperty(f,"turn.pending")||{};
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Supply Line")) pend.repairs.addModifiers.push("Supply Line");
    pend.tradeYieldDelta = Number(pend.tradeYieldDelta||0) + Number(tradeYieldDelta||0);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Supply Line" • +${tradeYieldDelta} Trade Yield`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS, base = E.establish_supply_line?.apply;
    E.establish_supply_line = Object.assign({}, E.establish_supply_line, {
      kind:"strategic", band:"standard", label:E.establish_supply_line?.label||"Establish Supply Line", cost:E.establish_supply_line?.cost||{ logistics:3, economy:1 },
      async apply({ entry }) {
        let msg=""; if (typeof base==="function") try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        const extra = await queueSupplyLine({ targetUuid: entry?.targetUuid, tradeYieldDelta:10 });
        return [msg, extra].filter(Boolean).join(" • ") || "Supply Line queued.";
      }
    });
    console.log(TAG,"installed");
  });
})();
