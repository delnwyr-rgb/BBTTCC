// v1.0.0 — Policy Reforms (Admin)
// Narrative-first, but queues a small one-turn faction bonus (dcPolicyBonus, opGainPct).
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.policy_reforms.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const TAG   = "[bbttcc/policy-reforms]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueFactionPolicyBonus(actor, { dcBonus = -1, opPct = 5 } = {}) {
    const A = actor;
    if (!A) return "No faction actor";
    // 2026-09-12 (pending-key registry): faction turn.pending.nextTurn fed only dead code — the live
    // slot the tick / regen / raid console read is bonuses.nextTurn.
    const bonuses = foundry.utils.duplicate(A.flags?.[MOD_F]?.bonuses || {});
    bonuses.nextTurn = Object.assign({}, bonuses.nextTurn, {
      attackDC:  Number(bonuses?.nextTurn?.attackDC || 0) + Number(dcBonus),   // attacker-side DC shift (2026-09-12); the policyReform flag is gone
      opGainPct: Number(bonuses?.nextTurn?.opGainPct || 0) + Number(opPct)
    });
    await A.update({ [`flags.${MOD_F}.bonuses`]: bonuses }, { diff:true, recursive:true });
    return `Queued: next-turn policy reform (DC ${dcBonus}, OP +${opPct}%)`;
  }

  whenRaidReady(api => {
    const E = api.EFFECTS;
    const base = E.policy_reforms?.apply;

    E.policy_reforms = Object.assign({}, E.policy_reforms, {
      kind:  "strategic",
      band:  "standard",
      label: E.policy_reforms?.label || "Policy Reforms (Admin)",
      cost:  E.policy_reforms?.cost  || { economy: 20, softpower: 20, diplomacy: 10, logistics: 10 },
      storyOnly: false, // has a light mechanical tailwind
      async apply({ actor, entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ actor, entry })) || ""; }
          catch(e){ console.warn(TAG, "base apply error", e); }
        }
        const m2 = await queueFactionPolicyBonus(actor, { dcBonus: -1, opPct: 5 });
        return [msg, m2].filter(Boolean).join(" • ") || "Policy Reforms queued.";
      }
    });

    console.log(TAG, "installed (faction next-turn DC -1, OP +5%).");
  });
})();
