/* bbttcc-raid/scripts/raid-optransfer.enhancer.js (v1.1.0 TURN-first)
 * Process queued OP transfers when consumeQueuedTurnEffects runs.
 * - Prefers flags.bbttcc-factions.turn.pending.opTransfers
 * - If legacy post.pending.opTransfers exists, migrates & clears it
 */
(() => {
  const FCT = "bbttcc-factions";
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const clamp0 = v => Math.max(0, Number(v||0));
  const dup = x => foundry.utils.duplicate(x||{});

  async function moveOP(fromActor,toActor,cat,amount){
    const k = String(cat).toLowerCase();
    if (!fromActor || !toActor || !OP_KEYS.includes(k)) return false;
    const ff = dup(fromActor.flags?.[FCT]||{});
    const tf = dup(toActor.flags?.[FCT]||{});
    const bankF = dup(ff.opBank||{}), poolsF = dup(ff.pools||{});
    const bankT = dup(tf.opBank||{}), poolsT = dup(tf.pools||{});
    // Never credit more than the sender actually holds (a short sender used to mint the difference).
    const delta = Math.min(clamp0(amount||0), clamp0(bankF[k]||0));
    if (!delta) return false;
    bankF[k] = clamp0((bankF[k]||0) - delta);
    poolsF[k]= clamp0((poolsF[k]||0) - delta);
    bankT[k] = clamp0((bankT[k]||0) + delta);
    poolsT[k]= clamp0((poolsT[k]||0) + delta);
    await fromActor.update({[`flags.${FCT}.opBank`]:bankF,[`flags.${FCT}.pools`]:poolsF});
    await toActor.update({[`flags.${FCT}.opBank`]:bankT,[`flags.${FCT}.pools`]:poolsT});
    try { await ChatMessage.create({ speaker:{alias:"Bad Eden Raid"}, content:`<p>OP Transfer — ${delta} marks ${k.toUpperCase()} from ${foundry.utils.escapeHTML(String(fromActor.name))} to ${foundry.utils.escapeHTML(String(toActor.name))}</p>` }); } catch {}
    return true;
  }

  function install(){
    const raid = game.bbttcc?.api?.raid;
    if (!raid || typeof raid.consumeQueuedTurnEffects!=="function") return;
    if (raid.__opTransferWrapped) return;
    const base = raid.consumeQueuedTurnEffects.bind(raid);

    raid.consumeQueuedTurnEffects = async function(args){
      const result = await base(args).catch(e=>{ console.warn("[bbttcc-raid/optransfer] base failed",e); return null; });
      try {
        const A = args?.factionId ? game.actors.get(String(args.factionId).replace(/^Actor\./,"")) : null;
        if (!A) return result;
        const flags = dup(A.flags?.[FCT]||{});
        const turn = dup(flags.turn?.pending||{});
        const post = dup(flags.post?.pending||{});

        const list = Array.isArray(turn.opTransfers) && turn.opTransfers.length ? turn.opTransfers
                   : (Array.isArray(post.opTransfers) ? post.opTransfers : []);

        if (Array.isArray(post.opTransfers) && post.opTransfers.length){
          turn.opTransfers = (turn.opTransfers||[]).concat(post.opTransfers);
          post.opTransfers = [];
          await A.update({ [`flags.${FCT}.turn.pending`]: turn, [`flags.${FCT}.post.pending`]: post });
        }

        // Clear the queue BEFORE moving (unsetFlag — a merge-write never removes it), so a
        // re-run of consumeQueuedTurnEffects can't execute the same transfers again.
        if (Array.isArray(list) && list.length) {
          try { await A.unsetFlag(FCT, "turn.pending.opTransfers"); } catch (_e) {}
          if (Array.isArray(post.opTransfers)) { try { await A.unsetFlag(FCT, "post.pending.opTransfers"); } catch (_e) {} }
        }
        for (const t of (list||[])) {
          const from = game.actors.get(t.from);
          const to   = game.actors.get(t.to);
          await moveOP(from,to,t.cat,t.amount);
        }
      } catch(e){ console.warn("[bbttcc-raid/optransfer] transfer enhancer failed",e); }
      return result;
    };

    raid.__opTransferWrapped = true;
  }

  if (game?.ready) install();
  Hooks.once("ready", install);
})();
