// v1.0.6 — BBTTCC TURN consumer extender for hex DRAWINGS
// Applies queued effects on hex DRAWINGS and clears pending reliably.
// Handles numeric deltas, repairs (new + legacy), and request/status keys.
// Safe boot (runs if ready already fired). Idempotent wrapper (unwraps older).

(() => {
  const MOD_R = "bbttcc-raid";
  const MODF  = "bbttcc-factions";
  const MODT  = "bbttcc-territory";
  const TAG   = "[bbttcc-raid/queue-drawings v1.0.6]";

  const get = foundry.utils.getProperty;
  const set = foundry.utils.setProperty;
  const dup = (x)=>foundry.utils.duplicate(x || {});

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.consumeQueuedTurnEffects) return cb(api);
      if (tries > 60) return console.warn(TAG, "raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  whenRaidReady((api)=>{
    // unwrap any prior wrappers
    let orig = api.consumeQueuedTurnEffects;
    while (orig && orig._bbttccWrapped && typeof orig._orig === "function") orig = orig._orig;

    const isHex = (dr) => { const f=dr?.flags?.[MODT] ?? {}; return f.isHex===true || f.kind==="territory-hex"; };
    const inc = (o,k,d=1)=>{ o[k] = Number(o[k]||0) + Number(d||0); };

    function normalizeApplied(f){
      let ap = get(f, "turn.applied");
      if (Array.isArray(ap)) return ap;
      ap = ap && typeof ap === "object" ? [dup(ap)] : [];
      set(f, "turn.applied", ap);
      return ap;
    }

    function buildPatchFor(drw){
      const flags = drw.flags?.[MODT]; if (!flags) return null;
      const f   = dup(flags);
      const pend= dup(get(f, "turn.pending") || {});
      if (!Object.keys(pend).length) return null;

      // Track if anything actionable exists (repairs-only must still apply)
      const hasRepairs =
        (pend.repairs && (
          Array.isArray(pend.repairs.addModifiers) ||
          Array.isArray(pend.repairs.removeModifiers) ||
          Array.isArray(pend.repairs.requests)
        ));

      const hasNumeric =
        pend.defenseDelta || pend.tradeYieldDelta || pend.loyaltyDelta ||
        pend.enemyLoyaltyDelta || pend.moraleDelta || pend.radiationRisk;

      const hasRequests = pend.statusSet || pend.cleanseCorruption || pend.destroyHex;

      // Apply numeric deltas -> mods
      const mods = get(f, "mods") ?? set(f, "mods", {});
      if (pend.defenseDelta)      inc(mods, "defense",      pend.defenseDelta);
      if (pend.tradeYieldDelta)   inc(mods, "tradeYield",   pend.tradeYieldDelta);
      if (pend.loyaltyDelta)      inc(mods, "loyalty",      pend.loyaltyDelta);
      if (pend.enemyLoyaltyDelta) inc(mods, "enemyLoyalty", pend.enemyLoyaltyDelta);
      if (pend.moraleDelta)       inc(mods, "morale",       pend.moraleDelta);
      if (pend.radiationRisk)     inc(mods, "radiation",    pend.radiationRisk);

      // Requests/status
      const req = get(f, "requests") ?? set(f, "requests", {});
      if (pend.statusSet)         req.statusSet = pend.statusSet;
      if (pend.cleanseCorruption) req.cleanseCorruption = true;
      if (pend.destroyHex)        req.destroyHex = true;

      // Repairs (new + legacy)
      f.modifiers = Array.isArray(f.modifiers) ? f.modifiers : [];
      if (Array.isArray(pend.repairs?.removeModifiers)) {
        const rm = new Set(pend.repairs.removeModifiers);
        f.modifiers = f.modifiers.filter(m => !rm.has(m));
      }
      if (Array.isArray(pend.repairs?.addModifiers)) {
        for (const m of pend.repairs.addModifiers) if (!f.modifiers.includes(m)) f.modifiers.push(m);
      }
      if (Array.isArray(pend.repairs?.requests)) {
        // legacy: [{tag:"Damaged Infrastructure"}, ...]
        const rmLegacy = new Set(pend.repairs.requests
          .map(x => typeof x === "string" ? x : x?.tag)
          .filter(Boolean));
        if (rmLegacy.size) f.modifiers = f.modifiers.filter(m => !rmLegacy.has(m));
      }

      const actionable = hasRepairs || hasNumeric || hasRequests;
      if (!actionable) return null;

      const prevApplied = normalizeApplied(f);
      const newApplied  = prevApplied.concat([{ ts: Date.now(), data: pend }]);

      // Build patch with UNSET to hard-clear pending
      return {
        _id: drw.id,
        [`flags.${MODT}.mods`]: mods,
        [`flags.${MODT}.requests`]: req,
        [`flags.${MODT}.modifiers`]: f.modifiers,
        [`flags.${MODT}.turn.applied`]: newApplied,
        [`flags.${MODT}.turn.-=pending`]: null
      };
    }

    async function wrappedConsume({ factionId } = {}){
      // 1) original pipeline (factions + any hex-actors)
      const base = await orig({ factionId });

      // 2) sweep drawings
      const batches = [];
      for (const scene of game.scenes ?? []) {
        const patches = [];
        for (const dr of scene.drawings ?? []) {
          if (!isHex(dr)) continue;

          // one-time sanitize: force applied to array
          const f = dr.flags?.[MODT];
          if (f?.turn?.applied && !Array.isArray(f.turn.applied)) {
            const nf = dup(f); set(nf, "turn.applied", [dup(f.turn.applied)]);
            patches.push({ _id: dr.id, [`flags.${MODT}`]: nf });
            continue;
          }

          const patch = buildPatchFor(dr);
          if (patch) patches.push(patch);
        }
        if (patches.length) batches.push({ scene, patches });
      }

      // 3) apply patches scene-by-scene
      let changed = !!(base && base.changed);
      for (const { scene, patches } of batches) {
        await scene.updateEmbeddedDocuments("Drawing", patches);
        changed = true;
      }

      // 4) lightweight war log
      if (changed && factionId) {
        const A = game.actors.get(String(factionId).replace(/^Actor\./,""));
        if (A) {
          const F = dup(A.flags?.[MODF] || {});
          const logs = Array.isArray(F.warLogs) ? F.warLogs.slice() : [];
          logs.push({
            ts: Date.now(),
            date: new Date().toLocaleString(),
            type: "turn",
            activity: "applyHexQueues",
            summary: `Applied queued Strategic effects to ${batches.reduce((n,s)=>n+s.patches.length,0)} hex drawing(s).`
          });
          await A.update({ [`flags.${MODF}.warLogs`]: logs }, { diff:true, recursive:true });
        }
      }

      console.log(TAG, "complete.");
      return Object.assign({}, base, { changed });
    }

    wrappedConsume._bbttccWrapped = true;
    wrappedConsume._orig = orig;
    api.consumeQueuedTurnEffects = wrappedConsume;

    console.log(TAG, "installed (safe boot, repairs-only & morale/radiation supported).");
  });
})();
