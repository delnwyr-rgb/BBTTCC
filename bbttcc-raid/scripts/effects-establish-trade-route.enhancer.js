// v1.0.1 — Establish Trade Route: "Trade Hub" tag + bigger trade yield, safe boot guard

(() => {
  const MOD_R="bbttcc-raid", MOD_T="bbttcc-territory";
  const TAG="[bbttcc/trade-route]";

  function whenRaidReady(cb, tries=0){
    const go=()=>{ const api=game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries>60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb,tries+1),250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  async function queueTradeRoute({ targetUuid, tradeYieldDelta=20 }){
    const hex=await fromUuid(targetUuid); const doc=hex?.document ?? hex;
    if (!doc) return "Bad target UUID";
    const f=foundry.utils.duplicate(doc.flags?.[MOD_T]||{}); const pend=foundry.utils.getProperty(f,"turn.pending")||{};
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Trade Hub")) pend.repairs.addModifiers.push("Trade Hub");
    pend.tradeYieldDelta = Number(pend.tradeYieldDelta||0) + Number(tradeYieldDelta||0);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Trade Hub" • +${tradeYieldDelta} Trade Yield`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS, base = E.establish_trade_route?.apply;
    E.establish_trade_route = Object.assign({}, E.establish_trade_route, {
      kind:"strategic", band:"standard", label:E.establish_trade_route?.label||"Establish Trade Route", cost:E.establish_trade_route?.cost||{ economy:3, diplomacy:1, logistics:1 },
      async apply({ entry }) {
        let msg=""; if (typeof base==="function") try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        const extra = await queueTradeRoute({ targetUuid: entry?.targetUuid, tradeYieldDelta:20 });
        return [msg, extra].filter(Boolean).join(" • ") || "Trade Route queued.";
      }
    });
    console.log(TAG,"installed");
  });
})();
