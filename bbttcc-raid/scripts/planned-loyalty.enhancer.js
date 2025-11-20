// bbttcc-raid/enhancers/planned-loyalty.enhancer.js
// v1.2 — Canon Loyalty mapped to compat-bridge queue fields (turn.pending.*), no direct writes.
// Canon:
//   ration_distribution   → +1 Loyalty  (friendly hex)   → queue:   loyaltyDelta:+1
//   psych_ops_broadcast   → -2 Loyalty  (enemy hex)      → queue:   enemyLoyaltyDelta:-2
//
// If no target hex is present, fall back to faction turn.pending.loyaltyDelta.
// Per-faction overrides still supported via flags['bbttcc-factions'].loyaltyActivityMap = { key: delta }.

(() => {
  const TAG  = "[bbttcc-raid/planned-loyalty v1.2]";
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";

  const CANON = Object.freeze({
    "ration_distribution": +1,
    "psych_ops_broadcast": -2
  });

  const get = (o,p,d)=>{ try{ return foundry.utils.getProperty(o,p) ?? d; }catch{return d;} };
  const ensure = (o,p,init={})=>{
    const parts = String(p).split("."); let cur=o;
    for (let i=0;i<parts.length;i++){
      const k=parts[i]; if (cur[k]===undefined) cur[k]=(i===parts.length-1?init:{});
      cur=cur[k];
    } return cur;
  };

  // Queue a delta to faction.turn.pending.* (compat consumes these).  :contentReference[oaicite:3]{index=3}
  async function queueFactionDelta(A, key, delta){
    const flags = foundry.utils.duplicate(A.flags?.[MODF] || {});
    const pend  = ensure(flags, "turn.pending", {});
    if (delta>0) pend.loyaltyDelta = Number(pend.loyaltyDelta||0) + delta;
    else         pend.enemyLoyaltyDelta = Number(pend.enemyLoyaltyDelta||0) + delta; // negative; kept for symmetry
    await A.update({ [`flags.${MODF}`]: flags });
  }

  // Queue a delta to hex.turn.pending.* (drawing/tile or hex actor).  :contentReference[oaicite:4]{index=4}
  async function queueHexDelta(targetUuid, delta){
    if (!targetUuid) return false;
    const doc = await fromUuid(targetUuid).catch(()=>null);
    const obj = doc?.document ?? doc; if (!obj) return false;
    const parent = obj.parent ?? canvas?.scene;
    const T = foundry.utils.duplicate(obj.flags?.[MODT] || {});
    const pend = ensure(T, "turn.pending", {});
    if (delta>0) pend.loyaltyDelta = Number(pend.loyaltyDelta||0) + delta;
    else         pend.enemyLoyaltyDelta = Number(pend.enemyLoyaltyDelta||0) + delta;
    await obj.update({ [`flags.${MODT}`]: T }, parent?{ parent }:{});
    return true;
  }

  function deltaFor(A, actKey, spec){
    const k = String(actKey||"").toLowerCase();
    const overrides = get(A, `flags.${MODF}.loyaltyActivityMap`, {}) || {};
    if (Object.prototype.hasOwnProperty.call(overrides, k)) return Number(overrides[k]||0);
    if (Object.prototype.hasOwnProperty.call(CANON, k))      return Number(CANON[k]);

    // honor any EFFECTS-provided fields
    if (spec && typeof spec === "object") {
      if (typeof spec.loyaltyDelta === "number") return spec.loyaltyDelta;
      const l = get(spec, "loyalty.delta", null); if (typeof l === "number") return l;
      const v = get(spec, "victory.loyalty", null); if (typeof v === "number") return v;
    }
    return 0;
  }

  function installOnce(){
    const raid = game.bbttcc?.api?.raid || game.modules.get("bbttcc-raid")?.api?.raid;
    if (!raid){ console.warn(TAG, "raid API not ready"); return; }
    const EFFECTS = raid?.EFFECTS || {};

    // Wrap consumePlanned so we queue compat fields instead of writing immediately.  :contentReference[oaicite:5]{index=5}
    if (typeof raid.consumePlanned === "function"){
      const orig = raid.consumePlanned;
      raid.consumePlanned = async function wrapped(args={}){
        const out = await orig(args);
        try {
          const A = args?.factionId || args?.attackerId ? game.actors.get(String(args.factionId||args.attackerId)) : null;
          if (!A) return out;
          const rows = Array.isArray(out?.rows) ? out.rows : [];
          for (const r of rows){
            const key = String(r?.activity || r?.key || "").toLowerCase();
            const spec = EFFECTS[key];
            const delta = deltaFor(A, key, spec);
            if (!delta) continue;
            const tUuid = r?.targetUuid || r?.target || r?.hexUuid || args?.targetUuid || null;
            const didHex = tUuid ? await queueHexDelta(tUuid, delta) : false;
            if (!didHex) await queueFactionDelta(A, key, delta);
          }
        } catch(e){ console.warn(TAG, "planned-loyalty: consume wrapper failed", e); }
        return out;
      };
    }

    // Also wrap applyStrategicActivity direct path (if used anywhere).
    if (typeof raid.applyStrategicActivity === "function"){
      const orig2 = raid.applyStrategicActivity;
      raid.applyStrategicActivity = async function wrapped2(args={}){
        const res = await orig2(args);
        try {
          const A = args?.factionId || args?.attackerId ? game.actors.get(String(args.factionId||args.attackerId)) : null;
          if (!A) return res;
          const key   = String(args?.activityKey || "").toLowerCase();
          const spec  = EFFECTS[key];
          const delta = deltaFor(A, key, spec);
          if (!delta) return res;
          const tUuid = args?.targetUuid || null;
          const didHex = tUuid ? await queueHexDelta(tUuid, delta) : false;
          if (!didHex) await queueFactionDelta(A, key, delta);
        } catch(e){ console.warn(TAG, "planned-loyalty: apply wrapper failed", e); }
        return res;
      };
    }

    console.log(TAG, "installed (queues loyalty deltas to compat pending).");
  }

  Hooks.once("ready", installOnce);
  if (game?.ready) installOnce();
  Hooks.on("canvasReady", installOnce);
})();
