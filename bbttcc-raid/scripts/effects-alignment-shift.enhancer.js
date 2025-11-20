// v1.0.0 — Alignment Shift (Sephirot) — light mechanical, mostly narrative
// Adds "Sanctified" + "Pilgrimage Site" to the hex, queues +1 Morale, +1 Loyalty,
// and flags the faction with a one-turn faith boon.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const TAG   = "[bbttcc/alignment-shift]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueAlignmentShift({ actor, targetUuid, moraleDelta=1, loyaltyDelta=1 }) {
    if (!targetUuid) return "No target";
    const ref = await fromUuid(targetUuid);
    const doc = ref?.document ?? ref;
    if (!doc) return "Bad target UUID";

    // 1) Hex: tags + small deltas
    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(f, "turn.pending") || {};
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers)
      ? pend.repairs.addModifiers.slice() : [];
    for (const tag of ["Sanctified","Pilgrimage Site"]) {
      if (!pend.repairs.addModifiers.includes(tag)) pend.repairs.addModifiers.push(tag);
    }
    pend.moraleDelta  = Number(pend.moraleDelta  || 0) + Number(moraleDelta  || 0);
    pend.loyaltyDelta = Number(pend.loyaltyDelta || 0) + Number(loyaltyDelta || 0);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });

    // 2) Faction: one-turn faith boon
    const A = actor;
    if (A) {
      const F = foundry.utils.duplicate(A.flags?.[MOD_F] || {});
      const p = F.turn?.pending || {};
      p.nextTurn = Object.assign({}, p.nextTurn, { faithBoon: true });
      await A.update({ [`flags.${MOD_F}.turn.pending`]: p }, { diff:true, recursive:true });
    }

    return `Queued: Sanctified & Pilgrimage Site • +${moraleDelta} Morale • +${loyaltyDelta} Loyalty • (faction faith boon next turn)`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.alignment_shift?.apply;

    E.alignment_shift = Object.assign({}, E.alignment_shift, {
      kind:  "strategic",
      band:  "standard",
      label: E.alignment_shift?.label || "Alignment Shift (Sephirot)",
      cost:  E.alignment_shift?.cost  || { faith: 3, culture: 2, softpower: 2 },
      async apply({ actor, entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ actor, entry })) || ""; }
          catch(e){ console.warn(TAG, "base apply error", e); }
        }
        const m2 = await queueAlignmentShift({ actor, targetUuid: entry?.targetUuid, moraleDelta: 1, loyaltyDelta: 1 });
        return [msg, m2].filter(Boolean).join(" • ") || "Alignment Shift queued.";
      }
    });

    console.log(TAG, "installed (Sanctified + Pilgrimage Site, +1 Morale/+1 Loyalty, faithBoon next turn).");
  });
})();
