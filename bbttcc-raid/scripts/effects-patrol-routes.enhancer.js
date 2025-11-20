// v1.0.0 — Patrol Routes (mechanical):
// Adds "Patrolled" tag; if already Fortified, may also add "Well-Maintained".
// Queues +1 Defense and +1 Morale on the target hex drawing.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/patrol-routes]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1),250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queuePatrolRoutes({ targetUuid, defenseDelta=1, moraleDelta=1 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(f,"turn.pending") || {};

    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers)
      ? pend.repairs.addModifiers.slice() : [];

    // Always add "Patrolled"
    if (!pend.repairs.addModifiers.includes("Patrolled"))
      pend.repairs.addModifiers.push("Patrolled");

    // If hex already Fortified → 40% chance add Well-Maintained
    const currentMods = doc.flags?.[MOD_T]?.modifiers || [];
    if (currentMods.includes("Fortified") && Math.random() < 0.4) {
      if (!pend.repairs.addModifiers.includes("Well-Maintained"))
        pend.repairs.addModifiers.push("Well-Maintained");
    }

    // Small bumps
    pend.defenseDelta = Number(pend.defenseDelta||0) + Number(defenseDelta||0);
    pend.moraleDelta  = Number(pend.moraleDelta ||0) + Number(moraleDelta ||0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Patrolled"${currentMods.includes("Fortified")?" (chance Well-Maintained)":""} • +${defenseDelta} Defense • +${moraleDelta} Morale`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.patrol_routes?.apply;

    E.patrol_routes = Object.assign({}, E.patrol_routes, {
      kind:"strategic",
      band:"standard",
      label:E.patrol_routes?.label || "Patrol Routes",
      cost:E.patrol_routes?.cost  || { logistics:2, violence:1 },
      async apply({ entry }) {
        let msg="";
        if (typeof base==="function") {
          try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        }
        const m2 = await queuePatrolRoutes({ targetUuid: entry?.targetUuid, defenseDelta:1, moraleDelta:1 });
        return [msg,m2].filter(Boolean).join(" • ") || "Patrol Routes queued.";
      }
    });

    console.log(TAG,"installed (Patrolled tag, +1 Def/+1 Morale, chance Well-Maintained).");
  });
})();
