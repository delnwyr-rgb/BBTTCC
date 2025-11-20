// modules/bbttcc-raid/scripts/raid-post2turn.enhancer.js
// Rollback-safe POST→TURN normalizer (resilient + reactive).
// - Defines MOD_* locally (works with older compat).
// - Wraps raid.applyPostRoundEffects if present; otherwise retries briefly.
// - Watches Actor/Drawing updates to migrate post.pending → turn.pending
//   and nextRound → nextTurn without touching any UI.

(() => {
  const MOD_FACTIONS  = "bbttcc-factions";
  const MOD_TERRITORY = "bbttcc-territory";
  const TAG  = "[bbttcc-raid/post2turn]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const dup = x => foundry.utils.duplicate(x || {});
  const mergeObj = (a={}, b={}) => {
    const o = dup(a);
    for (const [k,v] of Object.entries(b||{})) {
      if (Array.isArray(v)) o[k] = [ ...(o[k]||[]), ...v ];
      else if (v && typeof v === "object") o[k] = mergeObj(o[k]||{}, v);
      else o[k] = v;
    }
    return o;
  };

  // loop-guard for our own updates
  const SELF = new WeakSet();

  async function normalizeFaction(A){
    try {
      if (!A) return false;
      const f = dup(A.flags?.[MOD_FACTIONS] || {});
      let turn = dup(f.turn?.pending || {});
      let post = dup(f.post?.pending || {});
      // migrate nextRound → nextTurn on both shapes
      if (post.nextRound) { turn.nextTurn = mergeObj(turn.nextTurn||{}, post.nextRound); delete post.nextRound; }
      if (turn.nextRound) { turn.nextTurn = mergeObj(turn.nextTurn||{}, turn.nextRound); delete turn.nextRound; }
      // migrate whole POST payload → TURN, then clear POST
      if (Object.keys(post).length) turn = mergeObj(turn, post), post = {};
      // if nothing to write, bail quickly
      if (!Object.keys(turn).length && !Object.keys(post).length) return false;

      SELF.add(A);
      await A.update({
        [`flags.${MOD_FACTIONS}.turn.pending`]: turn,
        [`flags.${MOD_FACTIONS}.post.pending`]: post
      });
      return true;
    } catch (e) { warn("normalizeFaction failed", e); return false; }
  }

  async function normalizeHex(D){
    try {
      if (!D) return false;
      const tf = dup(D.flags?.[MOD_TERRITORY] || {});
      let turn = dup(tf.turn?.pending || {});
      let post = dup(tf.post?.pending || {});
      if (post.nextRound) { turn.nextTurn = mergeObj(turn.nextTurn||{}, post.nextRound); delete post.nextRound; }
      if (turn.nextRound) { turn.nextTurn = mergeObj(turn.nextTurn||{}, turn.nextRound); delete turn.nextRound; }
      if (Object.keys(post).length) turn = mergeObj(turn, post), post = {};
      if (!Object.keys(turn).length && !Object.keys(post).length) return false;

      SELF.add(D);
      await D.update({
        [`flags.${MOD_TERRITORY}.turn.pending`]: turn,
        [`flags.${MOD_TERRITORY}.post.pending`]: post
      }, { parent: D.parent ?? canvas?.scene });
      return true;
    } catch (e) { warn("normalizeHex failed", e); return false; }
  }

  // Try wrapping compat once it's ready (older compat may or may not exist)
  function tryWrapCompat(){
    const raid = game.bbttcc?.api?.raid;
    const base = raid?.applyPostRoundEffects;
    if (!raid || typeof base !== "function") return false;
    if (raid.__post2turnWrapped) return true;

    const __baseAP = base;
    async function __wrappedApplyPostRoundEffects(args={}) {
      const res = await base(args).catch(e=>{ warn("base applyPostRoundEffects", e); return null; });
      try {
        const attacker = args?.attackerId ? game.actors.get(String(args.attackerId).replace(/^Actor\./,"")) : null;
        const defender = args?.defenderId ? game.actors.get(String(args.defenderId).replace(/^Actor\./,"")) : null;
        const xd = args?.targetHexId ? await fromUuid(args.targetHexId).catch(()=>null) : null;
        const hex = xd?.document ?? xd;
        await Promise.allSettled([ normalizeFaction(attacker), normalizeFaction(defender), normalizeHex(hex) ]);
      } catch (e) { warn("post-commit normalize failed", e); }
      return res;
    }
    // expose the original for debugging & probes
    __wrappedApplyPostRoundEffects.base = __baseAP;
    try { __wrappedApplyPostRoundEffects.toString = __baseAP.toString.bind(__baseAP); } catch(e){}
    raid.applyPostRoundEffects = __wrappedApplyPostRoundEffects;
    raid.__post2turnWrapped = true;
    log("Wrapped raid.applyPostRoundEffects");
    return true;
  }

  function start(){
    // Try immediately; if compat not ready (older builds), retry briefly.
    if (!tryWrapCompat()) {
      let tries=0;
      const t = setInterval(()=>{ tries++; if (tryWrapCompat() || tries>60) clearInterval(t); }, 500);
    }

    // One-time sweep (in case anything was already queued)
    (async ()=>{
      let n=0;
      for (const A of (game.actors?.contents || [])) if (A.getFlag?.(MOD_FACTIONS,"isFaction")) n += (await normalizeFaction(A))?1:0;
      for (const sc of (game.scenes || [])) for (const D of (sc.drawings || [])) if (D.flags?.[MOD_TERRITORY]) n += (await normalizeHex(D))?1:0;
      if (n) log(`Initial POST→TURN sweep normalized ${n} payload(s).`);
    })();

    // Reactive watchers: if *any* code writes POST/nextRound later, fix it immediately.
    Hooks.on("updateActor", (actor, changed)=>{
      try {
        if (!actor?.getFlag?.(MOD_FACTIONS,"isFaction")) return;
        if (SELF.has(actor)) { SELF.delete(actor); return; }
        const wrotePost = foundry.utils.getProperty(changed, `flags.${MOD_FACTIONS}.post.pending`);
        const wroteNR   = foundry.utils.getProperty(changed, `flags.${MOD_FACTIONS}.turn.pending.nextRound`);
        if ((wrotePost && Object.keys(wrotePost).length) || wroteNR) normalizeFaction(actor);
      } catch (e) { warn("updateActor watcher", e); }
    });

    Hooks.on("updateDrawing", (drawing, changed)=>{
      try {
        if (!drawing?.flags?.[MOD_TERRITORY]) return;
        if (SELF.has(drawing)) { SELF.delete(drawing); return; }
        const wrotePost = foundry.utils.getProperty(changed, `flags.${MOD_TERRITORY}.post.pending`);
        const wroteNR   = foundry.utils.getProperty(changed, `flags.${MOD_TERRITORY}.turn.pending.nextRound`);
        if ((wrotePost && Object.keys(wrotePost).length) || wroteNR) normalizeHex(drawing);
      } catch (e) { warn("updateDrawing watcher", e); }
    });
  }

  if (game?.ready) start();
  Hooks.once("ready", start);
  Hooks.on("canvasReady", start);
})();
