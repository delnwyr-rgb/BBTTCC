// v1.0.1 — Fortify Hex (add "Fortified" + defense) with safe boot guard

(() => {
  const MOD_R="bbttcc-raid", MOD_T="bbttcc-territory";
  const TAG="[bbttcc/fortify]";

  function whenRaidReady(cb, tries=0){
    const go=()=>{ const api=game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries>60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb,tries+1),250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  async function queueFortify({ targetUuid, defenseDelta=2 }){
    const hex = await fromUuid(targetUuid); const doc = hex?.document ?? hex;
    if (!doc) return "Bad target UUID";
    const f = foundry.utils.duplicate(doc.flags?.[MOD_T]||{}); const pend = foundry.utils.getProperty(f,"turn.pending")||{};
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Fortified")) pend.repairs.addModifiers.push("Fortified");
    pend.defenseDelta = Number(pend.defenseDelta||0) + Number(defenseDelta||0);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Fortified" • +${defenseDelta} Defense`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS, base = E.fortify_hex?.apply;
    E.fortify_hex = Object.assign({}, E.fortify_hex, {
      kind:"strategic", band:"standard", label:E.fortify_hex?.label||"Fortify Hex", cost:E.fortify_hex?.cost||{ economy:2, logistics:2, violence:1 },
      async apply({ entry }) {
        let msg=""; if (typeof base==="function") try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        const extra = await queueFortify({ targetUuid: entry?.targetUuid, defenseDelta:2 });
        return [msg, extra].filter(Boolean).join(" • ") || "Fortify queued.";
      }
    });
    console.log(TAG,"installed");
  });
})();
