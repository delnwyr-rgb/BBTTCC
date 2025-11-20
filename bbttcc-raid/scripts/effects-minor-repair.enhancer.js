// v1.1.1 — Minor Repair: modern removeModifiers, safe boot guard

(() => {
  const MOD_R="bbttcc-raid", MOD_T="bbttcc-territory";
  const TAG="[bbttcc/minor-repair]";

  function whenRaidReady(cb, tries=0){
    const go=()=>{ const api=game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries>60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb,tries+1),250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  async function queueModernRemoval({ targetUuid, removeList }){
    const hex = await fromUuid(targetUuid); const doc = hex?.document ?? hex;
    if (!doc) return "Bad target UUID";
    const f=foundry.utils.duplicate(doc.flags?.[MOD_T]||{}); const pend=foundry.utils.getProperty(f,"turn.pending")||{};
    pend.repairs = pend.repairs || {};
    pend.repairs.removeModifiers = Array.isArray(pend.repairs.removeModifiers) ? pend.repairs.removeModifiers.slice() : [];
    for (const m of removeList||[]) if (!pend.repairs.removeModifiers.includes(m)) pend.repairs.removeModifiers.push(m);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: remove ${removeList.join(", ")}`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS, base = E.minor_repair?.apply;
    E.minor_repair = Object.assign({}, E.minor_repair, {
      kind:"strategic", band:E.minor_repair?.band||"standard", label:E.minor_repair?.label||"Minor Repair", cost:E.minor_repair?.cost||{ economy:1 },
      async apply({ entry }) {
        let msg=""; if (typeof base==="function") try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        const extra = await queueModernRemoval({ targetUuid: entry?.targetUuid, removeList:["Damaged Infrastructure"] });
        return [msg, extra].filter(Boolean).join(" • ") || "Minor Repair queued.";
      }
    });
    console.log(TAG,"installed");
  });
})();
