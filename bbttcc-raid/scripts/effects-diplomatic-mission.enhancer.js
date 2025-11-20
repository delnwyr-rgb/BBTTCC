// v1.0.0 — Diplomatic Mission (mechanical)
// Adds "Diplomatic Ties" tag to the target hex and queues +10 Trade Yield, +1 Loyalty.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.diplomatic_mission_std.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/diplomatic-mission]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueDiplomaticMission({ targetUuid, trade=10, loyalty=1 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pending = foundry.utils.getProperty(f, "turn.pending") || {};

    // Tag the hex to show the relationship state
    pending.repairs = pending.repairs || {};
    pending.repairs.addModifiers = Array.isArray(pending.repairs.addModifiers)
      ? pending.repairs.addModifiers.slice() : [];
    if (!pending.repairs.addModifiers.includes("Diplomatic Ties")) {
      pending.repairs.addModifiers.push("Diplomatic Ties");
    }

    // Prosperity bumps
    pending.tradeYieldDelta = Number(pending.tradeYieldDelta || 0) + Number(trade || 0);
    pending.loyaltyDelta    = Number(pending.loyaltyDelta    || 0) + Number(loyalty || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pending });
    return `Queued: add "Diplomatic Ties" • +${trade} Trade • +${loyalty} Loyalty`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.diplomatic_mission_std?.apply;

    E.diplomatic_mission_std = Object.assign({}, E.diplomatic_mission_std, {
      kind:  "strategic",
      band:  "standard",
      label: E.diplomatic_mission_std?.label || "Diplomatic Mission",
      cost:  E.diplomatic_mission_std?.cost  || { diplomacy: 3, softpower: 1 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queueDiplomaticMission({ targetUuid: entry?.targetUuid, trade: 10, loyalty: 1 });
        return [msg, m2].filter(Boolean).join(" • ") || "Diplomatic Mission queued.";
      }
    });

    console.log(TAG, 'installed ("Diplomatic Ties" tag, +10 Trade, +1 Loyalty).');
  });
})();
