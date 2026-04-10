// bbttcc-raid/scripts/boss/boss-behaviors.console-hook.enhancer.js
// NEW FILE — Boss behaviors hook for Raid Console commit path.
// Why: Some builds do not expose raid.resolveRoundWithManeuvers. The Raid Console still works via its
// local fallback, so we hook BBTTCC_RaidConsole.prototype._commitRound instead.
// - No template changes
// - No behavior changes for non-creature targets
// - For creature targets only: invokes raid.applyBossBehaviors on phases using the committed round data.

(() => {
  const TAG = "[bbttcc-raid/bossConsoleHook]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const lc  = (s)=>String(s??"").toLowerCase().trim();
  const num = (v,d=0)=>{ const n=Number(v); return Number.isFinite(n)?n:d; };

  function naturalD20(roll){
    try {
      const d = roll?.dice?.[0];
      const r0 = d?.results?.[0]?.result;
      return num(r0, num(d?.total, 0));
    } catch { return 0; }
  }

  function contestedTypeFromRound(r){
    // In your raid-console, r.key is usually the OP category ("violence"/"intrigue"...)
    const k = lc(r?.key || r?.contestedType || r?.primaryKey || "");
    if (OP_KEYS.includes(k)) return k;
    const v = lc(r?.view?.cat || "");
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

  function findConsoleClass(){
    // Common placements across your builds
    return (
      globalThis.BBTTCC_RaidConsole ||
      game.modules?.get?.("bbttcc-raid")?.api?.raid?.ConsoleClass ||
      game.modules?.get?.("bbttcc-raid")?.api?.ConsoleClass ||
      null
    );
  }

  async function installOnce(){
    const raid = getRaidApi();
    if (!raid) return false;

    const apply = raid.applyBossBehaviors;
    if (typeof apply !== "function") return false;

    const C = findConsoleClass();
    if (!C || !C.prototype || typeof C.prototype._commitRound !== "function") return false;

    if (C.prototype._commitRound.__bbttccBossHooked) return true;

    const orig = C.prototype._commitRound;

    C.prototype._commitRound = async function wrappedCommit(idx){
      // Let the console do everything it normally does, then apply behaviors based on committed data.
      const r = this?.vm?.rounds?.[idx];
      const isCreature = (r?.targetType === "creature");
      const bossKey = r?.creatureId || r?.bossKey || null;

      // Pre-phase: round_start (before commit)
      if (isCreature && bossKey) {
        try {
          r.meta ||= {};
          r.meta.boss ||= {};
          if (r.meta.boss.hitsRemaining == null) {
            const def = raid.boss?.get?.(bossKey);
            r.meta.boss.hitsRemaining = num(def?.moraleHits, 1);
          }

          const ctx0 = {
            bossKey,
            attackerFactionId: r.attackerId || null,
            defenderFactionId: null,
            contestedType: contestedTypeFromRound(r),
            defenderMoraleHits: num(r.meta.boss.hitsRemaining, 1)
          };

          await apply({ bossKey, phase: raid.PHASES?.ROUND_START || "round_start", ctx: ctx0 });
        } catch (e) {
          warn("round_start behaviors failed", e);
        }
      }

      const res = await orig.call(this, idx);

      // Post phases: after_roll + round_end
      if (isCreature && bossKey) {
        try {
          r.meta ||= {};
          r.meta.boss ||= {};
          const bossMeta = r.meta.boss;

          const totalFinal = num(r.total, num(res?.totalFinal, 0));
          const dcFinal    = num(r.dcFinal, num(res?.dcFinal, num(r.DC, 0)));

          const attackerWon = totalFinal >= dcFinal;
          const defenderWon = !attackerWon;

          // 1 hit per attacker win (alpha-safe)
          if (attackerWon) bossMeta.hitsRemaining = Math.max(0, num(bossMeta.hitsRemaining, 1) - 1);

          const rollObj = r.roll || res?.roll || null;

          const ctx = {
            bossKey,
            attackerFactionId: r.attackerId || null,
            defenderFactionId: null,
            contestedType: contestedTypeFromRound(r),
            defenderMoraleHits: num(bossMeta.hitsRemaining, 0),
            roll: { natural: naturalD20(rollObj), obj: rollObj },
            attackerWon,
            defenderWon,
            totalFinal,
            dcFinal
          };

          await apply({ bossKey, phase: raid.PHASES?.AFTER_ROLL || "after_roll", ctx });
          await apply({ bossKey, phase: raid.PHASES?.ROUND_END  || "round_end",  ctx });

          // Persist for UI/debugging
          bossMeta.last = {
            ts: Date.now(),
            totalFinal,
            dcFinal,
            attackerWon,
            defenderWon,
            natural: ctx.roll.natural
          };
          if (ctx.raidEnded) {
            bossMeta.ended = true;
            bossMeta.outcome = ctx.outcome || "ended";
          }
        } catch (e) {
          warn("post-commit behaviors failed", e);
        }
      }

      return res;
    };

    C.prototype._commitRound.__bbttccBossHooked = true;
    C.prototype._commitRound.__bbttccBossHookOrig = orig;

    log("Boss behaviors console hook installed.");
    return true;
  }

  async function retryInstall(){
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
    warn("Boss console hook not installed (missing Raid Console class or behaviors API).");
  }

  retryInstall();
  Hooks.once("ready", () => { retryInstall(); });

})();