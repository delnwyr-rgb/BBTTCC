// v1.0.0 — Supply Cache (mechanical)
// Adds "Supply Cache" tag to the target hex drawing and queues +1 Logistics, +1 Defense.
// Safe to load after compat-bridge.js.  Extends/creates EFFECTS.supply_cache.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/supply-cache]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1),250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueSupplyCache({ targetUuid, defenseDelta=1, logisticsDelta=1 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(f,"turn.pending") || {};

    // Tag
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers)
      ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Supply Cache")) {
      pend.repairs.addModifiers.push("Supply Cache");
    }

    // Small bumps
    pend.defenseDelta   = Number(pend.defenseDelta   || 0) + Number(defenseDelta   || 0);
    pend.logisticsDelta = Number(pend.logisticsDelta || 0) + Number(logisticsDelta || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Supply Cache" • +${defenseDelta} Defense • +${logisticsDelta} Logistics`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.supply_cache?.apply;

    E.supply_cache = Object.assign({}, E.supply_cache, {
      kind:"strategic",
      band:"standard",
      label:E.supply_cache?.label || "Supply Cache",
      cost:E.supply_cache?.cost  || { logistics:2, economy:1 },
      async apply({ entry }) {
        let msg="";
        if (typeof base==="function") {
          try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        }
        const m2 = await queueSupplyCache({ targetUuid: entry?.targetUuid, defenseDelta:1, logisticsDelta:1 });
        return [msg,m2].filter(Boolean).join(" • ") || "Supply Cache queued.";
      }
    });

    console.log(TAG,"installed (Supply Cache tag, +1 Def/+1 Logistics).");
  });
})();
