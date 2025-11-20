/* bbttcc-raid/scripts/raid-roundflags.enhancer.js (v1.1.0 TURN-first)
 * Purpose: Apply one-shot flags for the *next raid round* (initiativeAdv, freeManeuver)
 * - Prefers flags.bbttcc-factions.turn.pending.nextTurn
 * - Falls back to legacy post.pending.nextRound once, then clears it
 * - Never writes to post.pending
 */
(() => {
  const FCT_ID = "bbttcc-factions";
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const clamp0 = v => Math.max(0, Number(v||0));
  const addInto = (dst, src)=>{ for (const [k,v] of Object.entries(src||{})) {
      const kk = String(k).toLowerCase(); if (!OP_KEYS.includes(kk)) continue;
      dst[kk] = clamp0((dst[kk]||0) + Number(v||0));
    } return dst; };

  async function refundManeuverCosts(actor, maneuvers){
    const raid = game.bbttcc?.api?.raid || {};
    const EFFECTS = raid.EFFECTS || {};
    const give = {}; for (const k of maneuvers||[]) addInto(give, EFFECTS[k]?.cost||{});
    const flags = foundry.utils.duplicate(actor.flags?.[FCT_ID]||{});
    const bank  = foundry.utils.duplicate(flags.opBank||{});
    const pools = foundry.utils.duplicate(flags.pools ||{});
    for (const k of OP_KEYS){ bank[k]=clamp0((bank[k]||0)+(give[k]||0)); pools[k]=clamp0((pools[k]||0)+(give[k]||0)); }
    flags.opBank = bank; flags.pools = pools;
    await actor.update({ [`flags.${FCT_ID}`]: flags });
  }

  function installWrapper(){
    const raid = game.bbttcc?.api?.raid;
    if (!raid || typeof raid.resolveRoundWithManeuvers !== "function") return false;
    if (raid.__roundFlagsWrapped) return true;

    const original = raid.resolveRoundWithManeuvers.bind(raid);
    raid.resolveRoundWithManeuvers = async function(args){
      const A = args?.attackerId ? game.actors.get(args.attackerId) : null;
      const flags = A ? foundry.utils.duplicate(A.flags?.[FCT_ID]||{}) : {};
      const turnNext = (((flags.turn||{}).pending)||{}).nextTurn || {};
      const postNext = (((flags.post||{}).pending)||{}).nextRound || {};
      const use = Object.keys(turnNext).length ? turnNext : postNext;
      const wantAdv  = !!use.initiativeAdv;
      const wantFree = !!use.freeManeuver;

      const res = await original(args);

      if (A && wantAdv) {
        try {
          const round = args?.round || {};
          const stagedA = Number(res?.meta?.stagedA || 0);
          const sBonus  = Math.ceil(stagedA/2);
          const bonusAtt= Number(res?.meta?.bonusAtt || 0);
          const baseAtt = Number(round?.attBonus || 0);
          const r1 = res?.roll;
          const r2 = await (new Roll("1d20 + @b", { b: baseAtt + sBonus + bonusAtt })).evaluate();
          const keep = (r1?.total||0) >= (r2?.total||0) ? r1 : r2;
          res.roll = keep; res.totalFinal = keep.total; res.meta.adv = true;
        } catch(e) { console.warn("[bbttcc-raid/roundflags] adv fail", e); }
      }

      if (A && wantFree && Array.isArray(args?.maneuversAtt) && args.maneuversAtt.length){
        try { await refundManeuverCosts(A, args.maneuversAtt); } catch(e){ console.warn("[bbttcc-raid/roundflags] refund fail", e); }
      }

      // Clear legacy POST once used
      if (A && Object.keys(postNext).length){
        try {
          const f = foundry.utils.duplicate(A.flags?.[FCT_ID]||{});
          if (((f.post||{}).pending||{}).nextRound){
            delete f.post.pending.nextRound;
            await A.update({ [`flags.${FCT_ID}.post.pending`]: f.post.pending });
          }
        } catch {}
      }
      return res;
    };

    raid.__roundFlagsWrapped = true;
    let last = Number(raid.__compatStamp || 0);
    const tick = () => {
      const cur = Number(raid.__compatStamp || 0);
      if (cur && cur !== last) { last = cur; delete raid.__roundFlagsWrapped; installWrapper(); }
    };
    setInterval(tick, 400);
  }

  if (game?.ready) installWrapper();
  Hooks.once("ready", installWrapper);
})();
