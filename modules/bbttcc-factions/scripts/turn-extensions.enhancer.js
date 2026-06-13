/* REVIEW NOTE: Turn extensions are retained as engine logic; patched here only to correct victory flag read-path during the sheet cleanup review pass. */
// bbttcc-factions/scripts/turn-extensions.enhancer.js
// Post-turn enhancer for Unity, Morale/Loyalty trend, and Darkness nudge.
// Spark-gated Victory/Unity sync added.

(() => {
  const TAG = "[bbttcc/turn-extensions]";
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";
  let WRAPPED = false;

  const get = (o,p,d)=>{ try{return foundry.utils.getProperty(o,p) ?? d;}catch{return d;} };
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));

  /* ---------- Unity helpers ---------- */
  const SEPH_OP = { chokmah:"economy", binah:"intrigue", chesed:null, gevurah:"violence",
                    tiferet:"culture", netzach:"all", hod:"faith", yesod:"diplomacy",
                    malkuth:null, keter:"caps" };
  // Sephirot Unity Bonus magnitudes, in MARKS (1 OP = 10 marks).
  const MAG     = { chokmah:30, binah:30, chesed:0, gevurah:30, tiferet:30, netzach:20, hod:30, yesod:20, malkuth:0, keter:10 };
  const normKey = s => String(s||"").toLowerCase();

  function countAlignedHexes(fid){
    const out = {};
    for (const sc of game.scenes ?? []) {
      for (const obj of [...(sc.drawings ?? []), ...(sc.tiles ?? [])]) {
        const tf = obj.flags?.[MODT]; if (!tf) continue;
        const owner = tf.factionId || tf.ownerId || "";
        if (String(owner)!==String(fid)) continue;
        const k = normKey(tf.sephirahKey||tf.sephirah||"");
        if (!k) continue; out[k]=(out[k]||0)+1;
      }
    }
    return out;
  }

  function unityReport(A){
    const cnt = countAlignedHexes(A.id);
    const cand = Object.entries(cnt).sort((a,b)=>b[1]-a[1]);
    if (!cand.length) return { any:false };
    const [k,n]=cand[0];
    const chan = SEPH_OP[k]||"";
    const mag = MAG[k]||0;
    const ops={violence:0,nonlethal:0,intrigue:0,economy:0,softpower:0,diplomacy:0,logistics:0,culture:0,faith:0};
    if (chan==="all"&&mag>0){for(const kk in ops)ops[kk]+=mag;}
    else if (ops.hasOwnProperty(chan)&&mag>0){ops[chan]+=mag;}
    return { any:true, sephirah:k, count:n, ops, note:`${k} +${mag} ${chan||"all"}` };
  }

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

      // UNITY + Spark gate (guarded against missing Tikkun API)
const UR = unityReport(A);
const tikkun = game.bbttcc?.api?.tikkun;
const hasMercy = (tikkun && typeof tikkun.hasSpark === "function")
  ? await tikkun.hasSpark(A, "sparkOfMercy_Chesed")
  : false;

if (UR?.any && hasMercy) {
  const bank = get(A, `flags.${MODF}.opBank`, {}) || {};
  const nb = foundry.utils.deepClone(bank);
  // Enlightenment opRegenBonus — an Enlightened faction regenerates +10% OP (the only
  // per-turn OP regen in the engine is this Unity/Mercy path, so the bonus rides it).
  const enlightened = String(get(A, `flags.${MODF}.enlightenmentLevel`, "")).toLowerCase();
  const opMult = (enlightened === "enlightened" || enlightened === "transcendent") ? 1.10 : 1;
  for (const [k, v] of Object.entries(UR.ops || {})) {
    if (v > 0) nb[k] = Number(nb[k] || 0) + Math.round(Number(v) * opMult);
  }
  updates["opBank"] = nb; any = true;
  war.push({
    type: "turn",
    date: (new Date()).toLocaleString(),
    summary: `Unity Bonus — ${UR.sephirah} (${UR.count} aligned): ${UR.note}${opMult > 1 ? " · +10% Enlightened OP regen" : ""}`
  });
}

// Victory + Unity sync (spark-gated)
try {
  const victory = foundry.utils.duplicate(get(A, `flags.${MODF}.victory`, {}) || {});
  victory.vp = Number(victory.vp || 0);
  victory.unity = (hasMercy && UR?.any)
    ? Math.min(100, Math.round((UR.count || 0) * 10))
    : 0;
  updates["victory"] = victory;
} catch (e) {
  console.warn(TAG, "Victory/Unity update failed:", e);
}

      // TREND
      const mHome=Number(get(A,`flags.${MODF}.moraleHome`,50));
      const mStep=Number(get(A,`flags.${MODF}.moraleStep`,1));
      const lHome=Number(get(A,`flags.${MODF}.loyaltyHome`,50));
      const lStep=Number(get(A,`flags.${MODF}.loyaltyStep`,1));
      const mCur=Number(get(A,`flags.${MODF}.morale`,0))||0;
      const lCur=Number(get(A,`flags.${MODF}.loyalty`,0))||0;
      const mNext=clamp(trendNext(mCur,mHome,mStep),0,100);
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
