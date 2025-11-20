// v1.0.0 — Propaganda Campaign (mechanical)
// Adds "Propaganda" tag to the target hex and queues +2 Morale, +1 Loyalty.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.propaganda_campaign.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/propaganda-campaign]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queuePropaganda({ targetUuid, moraleDelta=2, loyaltyDelta=1 }) {
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
    if (!pend.repairs.addModifiers.includes("Propaganda")) {
      pend.repairs.addModifiers.push("Propaganda");
    }

    // Goodwill bumps
    pend.moraleDelta  = Number(pend.moraleDelta  || 0) + Number(moraleDelta  || 0);
    pend.loyaltyDelta = Number(pend.loyaltyDelta || 0) + Number(loyaltyDelta || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Propaganda" • +${moraleDelta} Morale • +${loyaltyDelta} Loyalty`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.propaganda_campaign?.apply;

    E.propaganda_campaign = Object.assign({}, E.propaganda_campaign, {
      kind:  "strategic",
      band:  "standard",
      label: E.propaganda_campaign?.label || "Propaganda Campaign",
      cost:  E.propaganda_campaign?.cost  || { softpower: 3, diplomacy: 1 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queuePropaganda({ targetUuid: entry?.targetUuid, moraleDelta: 2, loyaltyDelta: 1 });
        return [msg, m2].filter(Boolean).join(" • ") || "Propaganda Campaign queued.";
      }
    });

    console.log(TAG, "installed (Propaganda tag, +2 Morale, +1 Loyalty).");
  });
})();
