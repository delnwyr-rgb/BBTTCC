// v1.0.1 — Reconstruction Drive: remove "Damaged Infrastructure", add "Well-Maintained", +def/+trade, safe boot guard

(() => {
  const MOD_R="bbttcc-raid", MOD_T="bbttcc-territory";
  const TAG="[bbttcc/reconstruction]";

  function whenRaidReady(cb, tries=0){
    const go=()=>{ const api=game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries>60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb,tries+1),250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  async function queueReconstruction({ targetUuid, defenseDelta=2, tradeYieldDelta=5 }){
    const hex=await fromUuid(targetUuid); const doc=hex?.document ?? hex;
    if (!doc) return "Bad target UUID";
    const f=foundry.utils.duplicate(doc.flags?.[MOD_T]||{}); const pend=foundry.utils.getProperty(f,"turn.pending")||{};
    pend.repairs = pend.repairs || {};
    pend.repairs.removeModifiers = Array.isArray(pend.repairs.removeModifiers) ? pend.repairs.removeModifiers.slice() : [];
    if (!pend.repairs.removeModifiers.includes("Damaged Infrastructure")) pend.repairs.removeModifiers.push("Damaged Infrastructure");
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Well-Maintained")) pend.repairs.addModifiers.push("Well-Maintained");
    pend.defenseDelta    = Number(pend.defenseDelta||0) + Number(defenseDelta||0);
    pend.tradeYieldDelta = Number(pend.tradeYieldDelta||0) + Number(tradeYieldDelta||0);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: -Damaged Infrastructure, +Well-Maintained • +${defenseDelta} Defense, +${tradeYieldDelta} Trade Yield`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS, base = E.reconstruction_drive_std?.apply;
    E.reconstruction_drive_std = Object.assign({}, E.reconstruction_drive_std, {
      kind:"strategic", band:"standard", label:E.reconstruction_drive_std?.label||"Reconstruction Drive", cost:E.reconstruction_drive_std?.cost||{ economy:2, logistics:2 },
      async apply({ entry }) {
        let msg=""; if (typeof base==="function") try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        const extra = await queueReconstruction({ targetUuid: entry?.targetUuid, defenseDelta:2, tradeYieldDelta:5 });
        return [msg, extra].filter(Boolean).join(" • ") || "Reconstruction queued.";
      }
    });
    console.log(TAG,"installed");
  });
})();
