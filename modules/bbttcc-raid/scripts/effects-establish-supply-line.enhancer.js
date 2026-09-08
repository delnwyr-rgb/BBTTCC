// v1.0.1 — Establish Supply Line: tag + trade yield, safe boot guard

(() => {
  const MOD_R="bbttcc-raid", MOD_T="bbttcc-territory";
  const TAG="[bbttcc/supply-line]";

  function whenRaidReady(cb, tries=0){
    const go=()=>{ const api=game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries>60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb,tries+1),250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  // A route has two ends (2026-09-07): queue the edge on BOTH hexes' turn.pending.routes; the
  // turn sweep writes flags.bbttcc-territory.routes on each, and the turn driver counts stored
  // edges instead of guessing from geometry.
  async function _queueEdge(fromUuid_, toUuid_, kind_) {
    for (const [a, b] of [[fromUuid_, toUuid_], [toUuid_, fromUuid_]]) {
      const h = await fromUuid(a); const d = h?.document ?? h; if (!d) continue;
      const f0 = foundry.utils.duplicate(d.flags?.[MOD_T] || {}); const pend0 = foundry.utils.getProperty(f0, "turn.pending") || {};
      pend0.routes = Array.isArray(pend0.routes) ? pend0.routes.slice() : [];
      if (!pend0.routes.some(r => r?.hexUuid === b && r?.kind === kind_)) pend0.routes.push({ hexUuid: b, kind: kind_ });
      await d.update({ [`flags.${MOD_T}.turn.pending`]: pend0 });
    }
  }
  async function queueSupplyLine({ targetUuid, toHexUuid = null, tradeYieldDelta=10 }){
    const hex=await fromUuid(targetUuid); const doc=hex?.document ?? hex;
    if (!doc) return "Bad target UUID";
    let edgeMsg = "";
    if (toHexUuid) { try { await _queueEdge(String(targetUuid), String(toHexUuid), "supply"); const t2 = await fromUuid(toHexUuid); const n2 = (t2?.document ?? t2)?.flags?.[MOD_T]?.name || "the far hex"; edgeMsg = ` • route → ${n2}`; } catch (e) { console.warn(TAG, "route edge queue failed", e); } }
    const f=foundry.utils.duplicate(doc.flags?.[MOD_T]||{}); const pend=foundry.utils.getProperty(f,"turn.pending")||{};
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Supply Line")) pend.repairs.addModifiers.push("Supply Line");
    pend.tradeYieldDelta = Number(pend.tradeYieldDelta||0) + Number(tradeYieldDelta||0);
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Supply Line" • +${tradeYieldDelta} Trade Yield${edgeMsg}`;
  }

  whenRaidReady((api)=>{
    const E = api.EFFECTS, base = E.establish_supply_line?.apply;
    E.establish_supply_line = Object.assign({}, E.establish_supply_line, {
      kind:"strategic", band:"standard", label:E.establish_supply_line?.label||"Establish Supply Line", cost:E.establish_supply_line?.cost||{ logistics:30, economy:10 },
      async apply({ entry }) {
        let msg=""; if (typeof base==="function") try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        const extra = await queueSupplyLine({ targetUuid: entry?.targetUuid, toHexUuid: entry?.toHexUuid || null, tradeYieldDelta:10 });
        return [msg, extra].filter(Boolean).join(" • ") || "Supply Line queued.";
      }
    });
    console.log(TAG,"installed");
  });
})();
