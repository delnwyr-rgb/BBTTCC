// v1.0.0 — Defuse Tensions (mechanical):
// Removes "Hostile Population", adds "Loyal Population", and queues +2 Loyalty, +2 Morale on the target hex drawing.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.defuse_tensions.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/defuse-tensions]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueDefuseTensions({ targetUuid, loyaltyDelta = 2, moraleDelta = 2, addLoyalTag = true }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pending = foundry.utils.getProperty(f, "turn.pending") || {};

    // Repairs: remove Hostile Population; optionally add Loyal Population
    pending.repairs = pending.repairs || {};
    // remove
    pending.repairs.removeModifiers = Array.isArray(pending.repairs.removeModifiers)
      ? pending.repairs.removeModifiers.slice() : [];
    if (!pending.repairs.removeModifiers.includes("Hostile Population")) {
      pending.repairs.removeModifiers.push("Hostile Population");
    }
    // add
    if (addLoyalTag) {
      pending.repairs.addModifiers = Array.isArray(pending.repairs.addModifiers)
        ? pending.repairs.addModifiers.slice() : [];
      if (!pending.repairs.addModifiers.includes("Loyal Population")) {
        pending.repairs.addModifiers.push("Loyal Population");
      }
    }

    // Goodwill bumps
    pending.loyaltyDelta = Number(pending.loyaltyDelta || 0) + Number(loyaltyDelta || 0);
    pending.moraleDelta  = Number(pending.moraleDelta  || 0) + Number(moraleDelta  || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pending });
    return `Queued: -Hostile Population, +Loyal Population • +${loyaltyDelta} Loyalty, +${moraleDelta} Morale`;
  }

  whenRaidReady((api) => {
    const E = api.EFFECTS;
    const base = E.defuse_tensions?.apply;

    E.defuse_tensions = Object.assign({}, E.defuse_tensions, {
      kind:  "strategic",
      band:  "standard",
      label: E.defuse_tensions?.label || "Defuse Tensions",
      cost:  E.defuse_tensions?.cost  || { diplomacy: 2, softpower: 2, culture: 1 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queueDefuseTensions({ targetUuid: entry?.targetUuid, loyaltyDelta: 2, moraleDelta: 2, addLoyalTag: true });
        return [msg, m2].filter(Boolean).join(" • ") || "Defuse Tensions queued.";
      }
    });

    console.log(TAG, "installed (-Hostile Population, +Loyal Population, +Loyalty/+Morale).");
  });
})();
