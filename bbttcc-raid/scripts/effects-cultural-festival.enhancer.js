// v1.0.0 — Cultural Festival (mechanical)
// Adds "Cultural Festival" to the target hex and queues +2 Morale, +5 Trade Yield.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.cultural_festival_std.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/cultural-festival]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueCulturalFestival({ targetUuid, morale=2, trade=5 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pending = foundry.utils.getProperty(f, "turn.pending") || {};

    // Tag
    pending.repairs = pending.repairs || {};
    pending.repairs.addModifiers = Array.isArray(pending.repairs.addModifiers)
      ? pending.repairs.addModifiers.slice() : [];
    if (!pending.repairs.addModifiers.includes("Cultural Festival")) {
      pending.repairs.addModifiers.push("Cultural Festival");
    }

    // Bumps
    pending.moraleDelta      = Number(pending.moraleDelta      || 0) + Number(morale || 0);
    pending.tradeYieldDelta  = Number(pending.tradeYieldDelta  || 0) + Number(trade  || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pending });
    return `Queued: add "Cultural Festival" • +${morale} Morale • +${trade} Trade`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.cultural_festival_std?.apply;

    E.cultural_festival_std = Object.assign({}, E.cultural_festival_std, {
      kind:  "strategic",
      band:  "standard",
      label: E.cultural_festival_std?.label || "Cultural Festival",
      cost:  E.cultural_festival_std?.cost  || { culture: 2, faith: 1, softpower: 1 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e){ console.warn(TAG,"base apply error", e); }
        }
        const m2 = await queueCulturalFestival({ targetUuid: entry?.targetUuid, morale: 2, trade: 5 });
        return [msg, m2].filter(Boolean).join(" • ") || "Cultural Festival queued.";
      }
    });

    console.log(TAG, "installed (Cultural Festival tag, +2 Morale, +5 Trade).");
  });
})();
