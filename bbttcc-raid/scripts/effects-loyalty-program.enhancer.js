// v1.0.0 — Loyalty Program (mechanical)
// Adds "Loyal Population" to the target hex drawing and queues +2 Loyalty, +1 Morale.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.loyalty_program.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/loyalty-program]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueLoyaltyProgram({ targetUuid, loyaltyDelta=2, moraleDelta=1 }) {
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
    if (!pend.repairs.addModifiers.includes("Loyal Population")) {
      pend.repairs.addModifiers.push("Loyal Population");
    }

    // Goodwill bumps
    pend.loyaltyDelta = Number(pend.loyaltyDelta || 0) + Number(loyaltyDelta || 0);
    pend.moraleDelta  = Number(pend.moraleDelta  || 0) + Number(moraleDelta  || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Loyal Population" • +${loyaltyDelta} Loyalty • +${moraleDelta} Morale`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.loyalty_program?.apply;

    E.loyalty_program = Object.assign({}, E.loyalty_program, {
      kind:  "strategic",
      band:  "standard",
      label: E.loyalty_program?.label || "Loyalty Program",
      cost:  E.loyalty_program?.cost  || { softpower: 3, culture: 1, faith: 1 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queueLoyaltyProgram({ targetUuid: entry?.targetUuid, loyaltyDelta: 2, moraleDelta: 1 });
        return [msg, m2].filter(Boolean).join(" • ") || "Loyalty Program queued.";
      }
    });

    console.log(TAG, "installed (Loyal Population tag, +2 Loyalty, +1 Morale).");
  });
})();
