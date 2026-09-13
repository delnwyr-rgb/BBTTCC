// v1.1.0 — Establish Trade Route: "Trade Hub" tag (+50% trade output via the hex recompute) + stored route edge, safe boot guard
// 2026-09-10 (owner ruling): the "+20 Trade Yield" line retired — mods.tradeYield had no reader anywhere; the tag IS the bonus.

(() => {
  const MOD_R="bbttcc-raid", MOD_T="bbttcc-territory";
  const TAG="[bbttcc/trade-route]";

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
  async function queueTradeRoute({ targetUuid, toHexUuid = null }){
    const hex=await fromUuid(targetUuid); const doc=hex?.document ?? hex;
    if (!doc) return "Bad target UUID";
    let edgeMsg = "";
    if (toHexUuid) { try { await _queueEdge(String(targetUuid), String(toHexUuid), "trade"); const t2 = await fromUuid(toHexUuid); const n2 = (t2?.document ?? t2)?.flags?.[MOD_T]?.name || "the far hex"; edgeMsg = ` • route → ${n2}`; } catch (e) { console.warn(TAG, "route edge queue failed", e); } }
    const f=foundry.utils.duplicate(doc.flags?.[MOD_T]||{}); const pend=foundry.utils.getProperty(f,"turn.pending")||{};
    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Trade Hub")) pend.repairs.addModifiers.push("Trade Hub");
    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Trade Hub" (+50% trade output)${edgeMsg}`;
  }

  // Idempotent install (2026-09-12). A load-order race left this wrap missing at resolution on the
  // first Advance under the new turn order — the activity was billed and "skipped" because the
  // def in api.raid.EFFECTS had no apply(). Now: stamp the def, and re-run on the same retry
  // schedule strategic-throughput uses (ready + 0.6/2/5/9 s) and on bbttcc:raid:maneuversLoaded,
  // reinstalling whenever the live def lost the wrap.
  const WRAP = "__bbttcc_trade_route_wrap";
  function install(api){
    const E0 = api?.EFFECTS; if (!E0) return false;
    if (E0.establish_trade_route && E0.establish_trade_route[WRAP] === true && typeof E0.establish_trade_route.apply === "function") return true;
    const E = api.EFFECTS, base = E.establish_trade_route?.apply;
    E.establish_trade_route = Object.assign({}, E.establish_trade_route, {
      kind:"strategic", band:"standard", label:E.establish_trade_route?.label||"Establish Trade Route", cost:E.establish_trade_route?.cost||{ economy:30, diplomacy:10, logistics:10 },
      async apply({ entry }) {
        let msg=""; if (typeof base==="function") try{ msg=String(await base({ entry }))||""; }catch(e){ console.warn(TAG,"base apply error",e); }
        const extra = await queueTradeRoute({ targetUuid: entry?.targetUuid, toHexUuid: entry?.toHexUuid || null });
        return [msg, extra].filter(Boolean).join(" • ") || "Trade Route queued.";
      }
    });
    try { Object.defineProperty(E.establish_trade_route, WRAP, { value: true, enumerable: false }); } catch (_e) {}
    console.log(TAG,"installed");
    return true;
  }
  // Lifecycle contract (2026-09-12): install once when the registry is final, re-install after every
  // rebuild. The lifecycle object is looked up at READY (module esmodules evaluate in fetch order, so
  // bbttcc-core may not have run yet at script load); if ready has already fired we run at once.
  console.log(TAG, "loaded");
  const _arm = () => {
    const lc = game?.bbttcc?.lifecycle;
    if (lc?.need) { lc.need("raid.EFFECTS").then(() => install(game.bbttcc.api.raid)).catch(e => console.warn(TAG, "install failed", e)); lc.onRebuild("raid.EFFECTS", () => { try { install(game.bbttcc.api.raid); } catch (e) { console.warn(TAG, "reinstall failed", e); } }); }
    else whenRaidReady((api)=>{ install(api); });
  };
  if (globalThis.game?.ready) _arm(); else Hooks.once("ready", _arm);
})();
