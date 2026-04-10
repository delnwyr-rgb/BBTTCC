// bbttcc-raid/scripts/boss/boss-behaviors.hook.enhancer.js
// FULL REPLACEMENT — resilient boss-behaviors hook.
// Fixes: hook sometimes never installs because applyBehaviors loads after this file's ready callback,
// or because other scripts overwrite game.bbttcc.api.raid after init.
//
// Behavior:
// - Tries to install immediately, on ready, and via short retry timers.
// - Installs ONLY if raid.resolveRoundWithManeuvers is a function.
// - For creature targets only, calls raid.applyBossBehaviors on phases.
// - Never throws if dependencies are missing.

(() => {
  const TAG = "[bbttcc-raid/bossBehaviorsHook]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  const num = (n,d=0)=>{ n=Number(n); return Number.isFinite(n)?n:d; };
  const lc  = (s)=>String(s??"").toLowerCase().trim();

  function naturalD20(roll){
    try {
      const d = roll?.dice?.[0];
      const r0 = d?.results?.[0]?.result;
      return num(r0, num(d?.total, 0));
    } catch { return 0; }
  }

  function contestedTypeFromRound(round){
    const k = lc(round?.key || round?.contestedType || round?.primaryKey || "");
    if (OP_KEYS.includes(k)) return k;
    const v = lc(round?.view?.cat || "");
    if (OP_KEYS.includes(v)) return v;
    return "violence";
  }

  function getRaidApi(){
    try {
      game.bbttcc ??= {};
      game.bbttcc.api ??= {};
      game.bbttcc.api.raid ??= {};
      return game.bbttcc.api.raid;
    } catch { return null; }
  }

  function isHooked(fn){
    return !!fn?.__bbttccBossHooked;
  }

  async function installOnce(){
    const raid = getRaidApi();
    if (!raid) return false;

    const orig = raid.resolveRoundWithManeuvers;
    if (typeof orig !== "function") return false;
    if (isHooked(orig)) return true;

    const apply = raid.applyBossBehaviors;
    if (typeof apply !== "function") return false;

    raid.resolveRoundWithManeuvers = async function wrappedResolve(args = {}) {
      const { attackerId, defenderId=null, round=null, target=null } = args;

      const isCreature = (target?.type === "creature") || (round?.targetType === "creature");
      if (!isCreature) return await orig(args);

      const bossKey = target?.creatureId || target?.bossKey || round?.creatureId || round?.bossKey || null;
      if (!bossKey) return await orig(args);

      round.meta ||= {};
      round.meta.boss ||= {};
      const bossMeta = round.meta.boss;

      // Initialize hitsRemaining on first use
      if (bossMeta.hitsRemaining == null) {
        const def = raid.boss?.get?.(bossKey);
        bossMeta.hitsRemaining = num(def?.moraleHits, 1);
      }

      const ctxBase = {
        bossKey,
        attackerFactionId: attackerId || null,
        defenderFactionId: defenderId || null,
        contestedType: contestedTypeFromRound(round),
        defenderMoraleHits: num(bossMeta.hitsRemaining, 1)
      };

      // round_start
      await apply({ bossKey, phase: raid.PHASES?.ROUND_START || "round_start", ctx: ctxBase });

      const res = await orig(args);

      const rollObj = res?.roll || round?.roll || null;
      const nat = naturalD20(rollObj);

      const totalFinal = num(res?.totalFinal, num(round?.total, 0));
      const dcFinal    = num(res?.dcFinal,   num(round?.dcFinal, num(round?.DC, 0)));

      const attackerWon = totalFinal >= dcFinal;
      const defenderWon = !attackerWon;

      // 1 hit per attacker win (alpha-safe)
      if (attackerWon) bossMeta.hitsRemaining = Math.max(0, num(bossMeta.hitsRemaining, 1) - 1);

      const ctx = {
        ...ctxBase,
        roll: { natural: nat, obj: rollObj },
        attackerWon,
        defenderWon,
        defenderMoraleHits: num(bossMeta.hitsRemaining, 0),
        totalFinal,
        dcFinal
      };

      // after_roll
      await apply({ bossKey, phase: raid.PHASES?.AFTER_ROLL || "after_roll", ctx });
      // round_end
      await apply({ bossKey, phase: raid.PHASES?.ROUND_END || "round_end", ctx });

      if (res && typeof res === "object") {
        res.meta ||= {};
        res.meta.boss ||= {};
        res.meta.boss.hitsRemaining = bossMeta.hitsRemaining;
        if (ctx.raidEnded) {
          res.meta.boss.ended = true;
          res.meta.boss.outcome = ctx.outcome || "ended";
        }
      }

      return res;
    };

    // Mark the NEW wrapped function as hooked and keep original around.
    raid.resolveRoundWithManeuvers.__bbttccBossHooked = true;
    raid.resolveRoundWithManeuvers.__bbttccBossHookOrig = orig;

    log("Boss behaviors hook installed (creature targets only).");
    return true;
  }

  async function retryInstall(){
    // Try a few times, because other scripts may overwrite raid api during init.
    const delays = [0, 50, 250, 1000, 2000];
    for (const ms of delays) {
      if (ms) await new Promise(r=>setTimeout(r, ms));
      try {
        const ok = await installOnce();
        if (ok) return;
      } catch (e) {
        warn("install attempt failed", e);
      }
    }
    warn("Boss behaviors hook not installed (missing resolver or behaviors API).");
  }

  // Try ASAP and again on ready.
  retryInstall();
  Hooks.once("ready", () => { retryInstall(); });

})();
