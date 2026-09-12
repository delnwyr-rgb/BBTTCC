// v1.0.0 — Mass Mobilization (mechanical, faction-level)
// Queues a one-turn initiative edge and a free maneuver for the faction.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.mass_mobilization_std.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const TAG   = "[bbttcc/mass-mobilization]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueMassMobilization(actor, { initiativeAdv=true, freeManeuver=true } = {}) {
    const A = actor;
    if (!A) return "No faction actor";
    // 2026-09-12 (pending-key registry): faction turn.pending.nextTurn fed only dead code — the live
    // slot the tick / regen / raid console read is bonuses.nextTurn.
    const bonuses = foundry.utils.duplicate(A.flags?.[MOD_F]?.bonuses || {});
    bonuses.nextTurn = Object.assign({}, bonuses.nextTurn, {
      initiativeAdv: !!initiativeAdv,
      freeManeuver:  !!freeManeuver
    });
    await A.update({ [`flags.${MOD_F}.bonuses`]: bonuses }, { diff:true, recursive:true });
    return `Queued: next-turn initiative advantage and a free maneuver`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS;
    const base = E.mass_mobilization_std?.apply;

    E.mass_mobilization_std = Object.assign({}, E.mass_mobilization_std, {
      kind:  "strategic",
      band:  "standard",
      label: E.mass_mobilization_std?.label || "Mass Mobilization",
      cost:  E.mass_mobilization_std?.cost  || { violence: 40, logistics: 20, economy: 10 },
      async apply({ actor, entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ actor, entry })) || ""; }
          catch(e){ console.warn(TAG, "base apply error", e); }
        }
        const m2 = await queueMassMobilization(actor, { initiativeAdv:true, freeManeuver:true });
        return [msg, m2].filter(Boolean).join(" • ") || "Mass Mobilization queued.";
      }
    });

    console.log(TAG, "installed (faction next-turn: initiativeAdv, freeManeuver).");
  });
})();
