// bbttcc-raid/scripts/boss/applyBehaviors.js
// FULL REPLACEMENT — Boss behavior runner v2 (World-Effects native, GM-authorable)
//
// Goals:
//  - Preserve existing behavior keys (back-compat)
//  - Add schema v1 support: behavior.when + behavior.effects.worldEffects (+ optional opDrain, bumpDarkness)
//  - Allow behaviors to call World Mutation Engine (same schema as Campaign Builder worldEffects)
//  - Keep syntax launcher-safe: no object spread, no optional chaining, no nullish operators, no ||=
//  - Remain resilient to game.bbttcc.api overwrites: attach immediately + on ready
//
// Exposes:
//  - game.bbttcc.api.raid.PHASES
//  - game.bbttcc.api.raid.applyBossBehaviors

(() => {
  const TAG = "[bbttcc-raid/bossBehaviors]";
  const log  = function(){ console.log.apply(console, [TAG].concat([].slice.call(arguments))); };
  const warn = function(){ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); };

  const STORE_KEY = "__bbttccRaidBossBehaviors";
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const store = g[STORE_KEY] ? g[STORE_KEY] : (g[STORE_KEY] = {});

  const PHASES = store.PHASES ? store.PHASES : (store.PHASES = {
    ROUND_START: "round_start",
    AFTER_ROLL:  "after_roll",
    ROUND_END:   "round_end",
    ON_RETREAT:  "on_retreat",
    ON_END:      "on_end"
  });

  const FCT_ID = "bbttcc-factions";
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  function lc(s){ return String((s===undefined||s===null) ? "" : s).toLowerCase().trim(); }
  function num(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : (d===undefined?0:d);
  }

  function _get(obj, path, fb){
    try {
      const parts = String(path||"").split(".");
      let cur = obj;
      for (let i=0;i<parts.length;i++){
        if (!cur) return fb;
        cur = cur[parts[i]];
      }
      return (cur===undefined) ? fb : cur;
    } catch { return fb; }
  }

  function _getFactionActor(idOrUuid){
    if (!idOrUuid) return null;
    try {
      const s = String(idOrUuid);
      if (s.indexOf("Actor.") === 0 && typeof fromUuidSync === "function") return fromUuidSync(s) || null;
      return (game && game.actors) ? (game.actors.get(s) || null) : null;
    } catch { return null; }
  }

  async function _safeBumpDarkness(args){
    args = args || {};
    try {
      const worldApi = _get(game, "bbttcc.api.world", null);
      const fn = worldApi ? worldApi.bumpDarkness : null;
      if (typeof fn === "function") return await fn({
        amount: num(args.amount, 1),
        scope: String(args.scope || "regional")
      });
    } catch (e) {
      warn("world.bumpDarkness failed", e);
    }
  }

  async function _safeDrainOP(args){
    args = args || {};
    const k = lc(args.type);
    const amt = Math.max(0, Math.floor(num(args.amount, 0)));
    if (!args.factionId || !k || OP_KEYS.indexOf(k) === -1 || amt <= 0) return;

    // Preferred API
    try {
      const fn = _get(game, "bbttcc.api.factions.drainOP", null);
      if (typeof fn === "function") return await fn({ factionId: args.factionId, type: k, amount: amt });
    } catch (e) {
      warn("factions.drainOP threw; attempting fallback", e);
    }

    // Fallback: direct flag drain
    try {
      const actor = _getFactionActor(args.factionId);
      if (!actor) return;

      const curBank  = foundry.utils.duplicate(actor.getFlag ? (actor.getFlag(FCT_ID, "opBank") || {}) : (_get(actor, "flags."+FCT_ID+".opBank", {}) || {}));
      const curPools = foundry.utils.duplicate(actor.getFlag ? (actor.getFlag(FCT_ID, "pools")  || {}) : (_get(actor, "flags."+FCT_ID+".pools",  {}) || {}));

      curBank[k]  = Math.max(0, Math.round(num(curBank[k], 0) - amt));
      curPools[k] = Math.max(0, Math.round(num(curPools[k], 0) - amt));

      await actor.update({
        ["flags."+FCT_ID+".opBank"]: curBank,
        ["flags."+FCT_ID+".pools"]:  curPools
      }, { diff:true, recursive:true });

      log("Fallback OP drain applied", { faction: actor.name, type: k, amount: amt });
    } catch (e) {
      warn("Fallback OP drain failed", e);
    }
  }

  async function _safeApplyWorldEffects(worldEffects, ctx){
    if (!worldEffects) return;
    try {
      const fn = _get(game, "bbttcc.api.worldMutation.applyWorldEffects", null);
      if (typeof fn !== "function") return;

      // Provide a minimal ctx payload that matches what WM typically expects.
      const wmCtx = {
        source: "bossBehavior",
        bossKey: ctx && ctx.bossKey ? ctx.bossKey : null,
        factionId: ctx && ctx.attackerFactionId ? ctx.attackerFactionId : null,
        hexUuid: ctx && ctx.hexUuid ? ctx.hexUuid : null,
        contestedType: ctx && ctx.contestedType ? ctx.contestedType : null
      };

      // Convenience: if factionEffects entries omit factionId, default to wmCtx.factionId
      try {
        if (worldEffects && Array.isArray(worldEffects.factionEffects) && wmCtx.factionId) {
          for (let i=0;i<worldEffects.factionEffects.length;i++){
            const fe = worldEffects.factionEffects[i];
            if (fe && (fe.factionId === undefined || fe.factionId === null || fe.factionId === "")) {
              fe.factionId = wmCtx.factionId;
            }
          }
        }
      } catch(e) { /* ignore */ }

      return await fn(worldEffects, wmCtx);
    } catch (e) {
      warn("worldMutation.applyWorldEffects failed", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Behavior matching (schema v1)
  // ---------------------------------------------------------------------------
  function _matchesWhen(when, ctx){
    if (!when) return true;

    // Outcome predicates
    if (when.attackerWon !== undefined && !!when.attackerWon !== !!ctx.attackerWon) return false;
    if (when.bossWon !== undefined && !!when.bossWon !== !!ctx.defenderWon) return false;
    if (when.greatSuccess !== undefined && !!when.greatSuccess !== !!ctx.greatSuccess) return false;

    // Natural roll predicates
    const nat = num(_get(ctx, "roll.natural", 0), 0);
    if (when.natGE !== undefined && !(nat >= num(when.natGE, 0))) return false;
    if (when.natEQ !== undefined && !(nat === num(when.natEQ, 0))) return false;

    // Damage predicates
    const step = num(ctx.bossDamageStep, num(_get(ctx, "boss.damageStep", 0), 0));
    const state = String(ctx.bossDamageState || _get(ctx, "boss.damageState", "") || "");
    if (when.damageStepGE !== undefined && !(step >= num(when.damageStepGE, 0))) return false;
    if (when.damageStepLE !== undefined && !(step <= num(when.damageStepLE, 0))) return false;

    if (when.stateIn && Array.isArray(when.stateIn) && when.stateIn.length) {
      if (when.stateIn.indexOf(state) === -1) return false;
    }

    // Contested / activity filters
    if (when.contestedTypeIn && Array.isArray(when.contestedTypeIn) && when.contestedTypeIn.length) {
      if (when.contestedTypeIn.indexOf(String(ctx.contestedType||"")) === -1) return false;
    }
    if (when.activityKeyIn && Array.isArray(when.activityKeyIn) && when.activityKeyIn.length) {
      if (when.activityKeyIn.indexOf(String(ctx.activityKey||"")) === -1) return false;
    }

    return true;
  }

  function _behaviorState(ctx){
    if (!ctx) return null;
    if (!ctx.__bossBehaviorState) ctx.__bossBehaviorState = {};
    return ctx.__bossBehaviorState;
  }

  function _passesGates(behavior, ctx){
    // Minimal gating v1: oncePerRound / oncePerRaid / oncePerStep
    const st = _behaviorState(ctx);
    if (!st) return true;

    const id = String(behavior.id || behavior.key || behavior.label || "").trim() || "behavior";
    const phase = String(behavior.phase || "");
    const key = id + "::" + phase;

    if (behavior.oncePerRaid === true) {
      if (st[key]) return false;
      st[key] = true;
    }

    if (behavior.oncePerRound === true) {
      const rid = String(ctx.roundId || _get(ctx, "round.roundId", "") || "");
      const rk = key + "::round:" + rid;
      if (st[rk]) return false;
      st[rk] = true;
    }

    if (behavior.oncePerStep === true) {
      const step = num(ctx.bossDamageStep, num(_get(ctx, "boss.damageStep", 0), 0));
      const sk = key + "::step:" + step;
      if (st[sk]) return false;
      st[sk] = true;
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Back-compat behavior keys (existing)
  // ---------------------------------------------------------------------------
  async function _runLegacyBehavior(behavior, ctx){
    const key = String(behavior.key || "").trim();
    if (!key) return false;

    switch (key) {
      case "darkness_pulse_on_round_win": {
        if (ctx.defenderWon) {
          await _safeBumpDarkness({
            amount: num(behavior.amount, 1),
            scope: String(behavior.scope || "regional")
          });
        }
        return true;
      }

      case "op_drain_on_nat_19_20": {
        const nat = num(_get(ctx, "roll.natural", 0), 0);
        if (nat >= 19) {
          await _safeDrainOP({
            factionId: ctx.attackerFactionId,
            type: ctx.contestedType,
            amount: num(behavior.amount, 1)
          });
        }
        return true;
      }

      case "retreat_at_morale_hits": {
        // Legacy: morale hits model. Keep supported, but v2 prefers damageStep.
        const thr = Math.max(0, Math.floor(num(behavior.threshold, 1)));
        const hits = num(ctx.defenderMoraleHits, 0);
        if (hits <= thr) {
          ctx.raidEnded = true;
          ctx.outcome = String(behavior.outcome || "retreat");
        }
        return true;
      }

      default:
        return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Schema v1 behavior runner (when + effects)
  // ---------------------------------------------------------------------------
  async function _runSchemaBehavior(behavior, ctx){
    // Phase already filtered by caller
    if (!_matchesWhen(behavior.when, ctx)) return;
    if (!_passesGates(behavior, ctx)) return;

    const effects = behavior.effects || {};

    // Convenience: bumpDarkness
    if (effects.bumpDarkness) {
      await _safeBumpDarkness(effects.bumpDarkness);
    }

    // Convenience: opDrain
    if (effects.opDrain) {
      let t = effects.opDrain.type;
      if (t === "contested") t = ctx.contestedType;
      await _safeDrainOP({
        factionId: effects.opDrain.factionId || ctx.attackerFactionId,
        type: t,
        amount: num(effects.opDrain.amount, 1)
      });
    }

    // Primary: world effects (Campaign Builder schema)
    if (effects.worldEffects) {
      await _safeApplyWorldEffects(effects.worldEffects, Object.assign({}, ctx, { bossKey: ctx.bossKey }));
    }

    // Optional: GM whisper / narrative
    if (behavior.log && behavior.log.whisperGM) {
      try {
        const gmIds = (game.users || []).filter(function(u){ return u && u.isGM; }).map(function(u){ return u.id; });
        await ChatMessage.create({
          content: "<p><b>Boss Behavior</b></p>" + foundry.utils.escapeHTML(String(behavior.log.whisperGM)),
          whisper: gmIds,
          speaker: { alias: "BBTTCC Boss" }
        }).catch(function(){});
      } catch (e) { /* ignore */ }
    }

    // Optional: end raid
    if (behavior.endRaid) {
      ctx.raidEnded = true;
      ctx.outcome = String(behavior.endRaid.outcome || "ended");
    }
  }

  async function applyBossBehaviors(args){
    args = args || {};
    try {
      if (!args.bossKey || !args.phase || !args.ctx) return;

      const ctx = args.ctx;
      ctx.bossKey = String(args.bossKey);
      ctx.phase = String(args.phase);

      const bossApi = _get(game, "bbttcc.api.raid.boss", null);
      const getFn = bossApi ? bossApi.get : null;
      const boss = (typeof getFn === "function") ? getFn(String(args.bossKey)) : null;
      if (!boss) return;

      const behaviors = Array.isArray(boss.behaviors) ? boss.behaviors : [];
      for (let i=0;i<behaviors.length;i++){
        const behavior = behaviors[i];
        if (!behavior) continue;

        // Phase filter
        if (behavior.phase && String(behavior.phase) !== String(args.phase)) continue;

        // If it's a legacy keyed behavior, run it; otherwise schema behavior.
        const ranLegacy = await _runLegacyBehavior(behavior, ctx);
        if (!ranLegacy) await _runSchemaBehavior(behavior, ctx);

        if (ctx.raidEnded) break;
      }
    } catch (e) {
      warn("applyBossBehaviors failed", e);
    }
  }

  function _attach(){
    try {
      if (!game.bbttcc) game.bbttcc = {};
      if (!game.bbttcc.api) game.bbttcc.api = {};
      if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};
      if (!game.bbttcc.api.raid.PHASES) game.bbttcc.api.raid.PHASES = PHASES;
      game.bbttcc.api.raid.applyBossBehaviors = applyBossBehaviors;
      return true;
    } catch (e) {
      warn("attach failed", e);
      return false;
    }
  }

  // Attach immediately and again on ready (in case raid api is overwritten).
  _attach();
  Hooks.once("ready", () => {
    _attach();
    log("Boss behavior runner v2 ready (attached).");
  });

})();