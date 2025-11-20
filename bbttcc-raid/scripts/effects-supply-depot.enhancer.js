// v1.0.0 — Supply Depot (mechanical):
// Adds "Logistics Hub" to the target hex drawing and queues +1 Defense, +5 Trade Yield.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.supply_depot.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/supply-depot]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueSupplyDepot({ targetUuid, defenseDelta = 1, tradeYieldDelta = 5 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(f, "turn.pending") || {};

    // Tag
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers)
      ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Logistics Hub")) {
      pend.repairs.addModifiers.push("Logistics Hub");
    }

    // Small bumps
    pend.defenseDelta    = Number(pend.defenseDelta || 0) + Number(defenseDelta || 0);
    pend.tradeYieldDelta = Number(pend.tradeYieldDelta || 0) + Number(tradeYieldDelta || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Logistics Hub" • +${defenseDelta} Defense • +${tradeYieldDelta} Trade Yield`;
  }

  whenRaidReady((api) => {
    const E = api.EFFECTS;
    const base = E.supply_depot?.apply;

    E.supply_depot = Object.assign({}, E.supply_depot, {
      kind:  "strategic",
      band:  "standard",
      label: E.supply_depot?.label || "Supply Depot",
      cost:  E.supply_depot?.cost  || { logistics: 3, economy: 2 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queueSupplyDepot({ targetUuid: entry?.targetUuid, defenseDelta: 1, tradeYieldDelta: 5 });
        return [msg, m2].filter(Boolean).join(" • ") || "Supply Depot queued.";
      }
    });

    console.log(TAG, "installed (Logistics Hub tag, +1 Def, +5 Trade).");
  });
})();
