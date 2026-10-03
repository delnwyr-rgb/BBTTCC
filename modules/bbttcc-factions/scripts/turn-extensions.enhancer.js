/* REVIEW NOTE: Turn extensions are retained as engine logic; patched here only to correct victory flag read-path during the sheet cleanup review pass. */
// bbttcc-factions/scripts/turn-extensions.enhancer.js
// Post-turn enhancer for Morale/Loyalty trend, Darkness nudge and the per-turn Victory Unity reset.
// (Its old Mercy-gated Unity OP payout is retired — territory-unitybonus is the one Unity authority.)

(() => {
  const TAG = "[bbttcc/turn-extensions]";
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";
  let WRAPPED = false;

  const get = (o,p,d)=>{ try{return foundry.utils.getProperty(o,p) ?? d;}catch{return d;} };
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));

  /* ---------- Unity: RETIRED here (2026-10-02 housekeeping) ----------
   * This file used to carry a SECOND per-turn Unity payout (Mercy-spark gated,
   * aligned-hex count → OP into the pillar's channel + Enlightened +10%). It read
   * tf.sephirahKey / tf.sephirah, which nothing writes (alignment is stored as
   * sephirotKey/Name/Uuid), so it never paid. Retired rather than switched on:
   * the ONE Unity authority is bbttcc-territory/scripts/territory-unitybonus.enhancer.js
   * (Phase 3B rule, advanceOPRegen, game.bbttcc.api.territory.getUnityBonusReport).
   * Removed: countAlignedHexes, unityReport, SEPH_OP/MAG, the opBank write.
   */

  function trendNext(cur,home=50,step=1){
    cur=Number(cur||0);home=Number(home||50);step=Math.max(0,Number(step||1));
    if (cur===home||step===0) return cur;
    return cur<home?Math.min(home,cur+step):Math.max(home,cur-step);
  }

  async function applyPostTurnAdjustments({res,args}){
    if(!args?.apply)return res;

    const factions=(game.actors?.contents??[]).filter(a=>a.getFlag?.(MODF,"isFaction"));
    for(const A of factions){
      const updates={};const war=get(A,`flags.${MODF}.warLogs`,[])||[];let any=false;

      // Unity is NOT touched here (owner ruling 2026-10-02): the leftover reset to 0 from the
      // retired Mercy path is gone. victory.unity is owned by advance-turn.tracks.js
      // doUnityRecompute (10% per aligned hex, gated on the Spark of Mercy), which feeds
      // VP gain (vp-engine) and Great Work readiness (Unity ≥ 30).

      // TREND
      // Morale buoyancy is PASSIVE recovery for the absence of pressure — it must not
      // push morale UPWARD against active Darkness (or Darkness loses its teeth and the
      // homeostasis permanently indemnifies a faction from darkness/radiation danger).
      // So while Darkness.global >= 1 we suppress only the *upward* lift; downward drift
      // (morale above home) and all Loyalty behavior are unchanged. When clean (Darkness 0)
      // buoyancy works normally. Radiation's morale danger flows through Darkness (Radiated
      // hexes raise Darkness), so gating on Darkness covers both.
      const darkG=Number((get(A,`flags.${MODF}.darkness`,{})||{}).global ?? 0);
      const mHome=Number(get(A,`flags.${MODF}.moraleHome`,50));
      const mStep=Number(get(A,`flags.${MODF}.moraleStep`,1));
      const lHome=Number(get(A,`flags.${MODF}.loyaltyHome`,50));
      const lStep=Number(get(A,`flags.${MODF}.loyaltyStep`,1));
      const mCur=Number(get(A,`flags.${MODF}.morale`,0))||0;
      const lCur=Number(get(A,`flags.${MODF}.loyalty`,0))||0;
      let mNext=clamp(trendNext(mCur,mHome,mStep),0,100);
      if(darkG>=1) mNext=Math.min(mNext,mCur);   // no upward buoyancy under Darkness pressure
      const lNext=clamp(trendNext(lCur,lHome,lStep),0,100);
      if(mNext!==mCur){updates["morale"]=mNext;any=true;}
      if(lNext!==lCur){updates["loyalty"]=lNext;any=true;}
      if(mNext!==mCur||lNext!==lCur)
        war.push({type:"turn",date:(new Date()).toLocaleString(),
          summary:`Trend: Morale→${mNext}% • Loyalty→${lNext}%`});

      // DARKNESS (top ascension level — canonical "enlightened", legacy "transcendent"/"5")
      const lvl=String(get(A,`flags.${MODF}.enlightenmentLevel`,"")).toLowerCase();
      if(lvl==="enlightened"||lvl==="transcendent"||lvl==="5"){
        const box=get(A,`flags.${MODF}.darkness`,{})||{};
        const next=foundry.utils.deepClone(box);const changed=[];
        for(const[k,v]of Object.entries(box)){
          if(k==="global")continue;
          const after=clamp(Number(v||0)-1,0,10);
          if(after!==v){next[k]=after;changed.push(`${k}:${after}`);}
        }
        if(changed.length){
          updates["darkness"]=next;any=true;
          war.push({type:"turn",date:(new Date()).toLocaleString(),
            summary:`Darkness −1 each region (Transcendent): ${changed.join(", ")}`});
        }
      }

      // QLIPHOTHIC DARKNESS SPIKES — corrupted members suffer per-turn in deep darkness.
      const DARK_SPIKE_THRESHOLD = 7;        // owner-tunable
      const DARK_SPIKE_DIE       = "1d4";    // owner-tunable
      const globalDark = Number(get(A,`flags.${MODF}.darkness.global`,0))||0;
      if(globalDark >= DARK_SPIKE_THRESHOLD){
        // Damage via the system-agnostic combat adapter (live seam since the
        // adapter Phase 1). Was a direct fourththing-fulcrum call pre-seam;
        // routing through game.bbttcc.combat is behavior-identical on RFI
        // (the RFI impl forwards to the fulcrum) and keeps the chokepoint.
        const applyDmg = game.bbttcc?.combat?.applyDamage;
        for(const m of (game.actors?.contents ?? [])){
          if(m.type!=="character") continue;
          if(m.getFlag(MODF,"factionId")!==A.id) continue;
          if(m.getFlag("bbttcc-character-options","enlightenment")?.level!=="qliphothic") continue;
          let dmg=2;
          try{ const r=await (new Roll(DARK_SPIKE_DIE)).evaluate(); dmg=r.total; }catch(_e){}
          if(applyDmg){ try{ await applyDmg(m,dmg,{op:"damage",track:"integrity",damageType:"necrotic"}); }
            catch(e){ console.warn(TAG,"darkness spike failed",e); } }
          war.push({type:"turn",date:(new Date()).toLocaleString(),
            summary:`Darkness Spike — ${m.name} suffers ${dmg} necrotic (corruption · darkness ${globalDark})`});
          any=true;
        }
      }

      if(any){
        await A.update({[`flags.${MODF}`]:{
          ...(A.flags?.[MODF]||{}),
          ...updates,
          warLogs:war
        }},{diff:true,recursive:true});
      }
    }
    return res;
  }

  function installOnce(){
    if(WRAPPED)return;WRAPPED=true;
    const terr=game.bbttcc?.api?.territory;
    if(!terr||typeof terr.advanceTurn!=="function"){
      console.warn(TAG,"advanceTurn not found");return;
    }
    const base=terr.advanceTurn;
    terr.advanceTurn=async function(args={}){
      const res=await base(args).catch(e=>{
        console.warn(TAG,"base advanceTurn error",e);
        return{changed:false,rows:[],error:true};
      });
      try{await applyPostTurnAdjustments({res,args});}
      catch(e){console.warn(TAG,"post-turn adjustments failed",e);}
      return res;
    };
    terr.advanceTurn.__bbttccTurnExtensions=true;
    console.log(TAG,"installed");
  }

  Hooks.once("ready",installOnce);
  if(game?.ready)installOnce();
})();
