/* bbttcc-raid — V2 Raid Console + Activity Planner (Strategic-only list)
 * Planner builds from raid.EFFECTS (kind:"strategic"), excludes raid TYPES.
 * Writes type:"planned" entries; NEVER defines consumePlanned (compat-bridge owns it).
 * Keeps V2 UI, Pick-on-Canvas, toolbar “Raid” + “Plan” buttons.
 */

const RAID_ID = "bbttcc-raid";
const FCT_ID  = "bbttcc-factions";
const TERR_ID = "bbttcc-territory";
const log  = (...a)=>console.log(`[${RAID_ID}]`,...a);
const warn = (...a)=>console.warn(`[${RAID_ID}]`,...a);

/* ---------------- Handlebars helpers ---------------- */
Hooks.once("init",()=>{
  const H=globalThis.Handlebars; if(!H) return;
  if(!H.helpers.add)     H.registerHelper("add",(a,b)=>Number(a||0)+Number(b||0));
  if(!H.helpers.eq)      H.registerHelper("eq",(a,b)=>String(a)===String(b));
  if(!H.helpers.lookup)  H.registerHelper("lookup",(o,k)=>o?o[k]:undefined);
  if(!H.helpers.upper)   H.registerHelper("upper",(s)=>String(s||"").toUpperCase());
  if(!H.helpers.default) H.registerHelper("default",(v,fb)=>(v===undefined||v===null||v==="")?fb:v);
});

/* ---------------- Utilities ---------------- */
const deepClone = (x)=>foundry.utils.duplicate(x);
const isFaction = (a)=>!!a && (a.getFlag?.(FCT_ID,"isFaction")===true ||
  String(foundry.utils.getProperty(a,"system.details.type.value")||"").toLowerCase()==="faction");
const factionList = ()=> (game.actors?.contents??[]).filter(isFaction).sort((a,b)=>a.name.localeCompare(b.name));

function detectHexLike(doc){
  const f = doc?.getFlag?.(TERR_ID) || doc?.flags?.[TERR_ID] || {};
  if (f.isHex === true || String(f.kind||"").toLowerCase()==="territory-hex") return true;
  const shape = doc?.shape ?? doc?.object?.shape;
  if (shape?.type === "p" && Array.isArray(shape.points) && shape.points.length >= 10) return true;
  return false;
}
function listSceneHexes(){
  const out=[]; const sc=canvas?.scene; if(!sc) return out;
  for(const d of sc.drawings?.contents??[]){ if(!detectHexLike(d)) continue;
    const f=d.getFlag?.(TERR_ID)||{}; out.push({uuid:d.uuid, id:d.id, name:f?.name||d.text||`Hex ${d.id}`, ownerId:f?.factionId||f?.ownerId||"", source:"drawing"});}
  for(const t of sc.tiles?.contents??[]){ if(!detectHexLike(t)) continue;
    const f=t.getFlag?.(TERR_ID)||{}; out.push({uuid:t.uuid, id:t.id, name:f?.name||t.id, ownerId:f?.factionId||f?.ownerId||"", source:"tile"});}
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}

/* ---------------- Activity Planner (Strategic Turn only) ---------------- */
Hooks.once("init",()=>{
  const App2 = foundry.applications.api.ApplicationV2; if(!App2) return;

  class ActivityPlanner extends App2{
    static get defaultOptions(){ 
      return { id:"bbttcc-activity-planner", title:"Activity Planner", width:560, height:"auto",
        resizable:true, minimizable:true }; 
    }
    static PARTS = { body:{ template:false } };

    /** Build Strategic list from EFFECTS or fallback */
    _buildStrategicList(){
      try{
        const raid = game.bbttcc?.api?.raid || {};
        const EFFECTS = raid?.EFFECTS || {};
        const TYPES   = raid?.TYPES || raid?.getTypes?.() || {};
        const raidKeys = new Set(Object.keys(TYPES).map(k=>String(k).toLowerCase()));
        const arr = Object.entries(EFFECTS)
          .filter(([k,v]) => v?.kind==="strategic" && !raidKeys.has(String(k).toLowerCase()))
          .map(([k,v]) => ({
            key:k,
            label:v?.label || String(k).replace(/[_-]/g," ").replace(/\b\w/g,m=>m.toUpperCase())
          }));
        if(arr.length){ log(`Loaded ${arr.length} strategic activities from EFFECTS.`); return arr; }
      }catch(e){ warn("Strategic build failed; using fallback.",e); }
      return [
        { key:"develop_infrastructure", label:"Develop Infrastructure" },
        { key:"expand_territory",      label:"Expand Territory" },
        { key:"cultural_festival",     label:"Cultural Festival" },
        { key:"diplomatic_mission",    label:"Diplomatic Mission" },
        { key:"faith_campaign",        label:"Faith Campaign" },
        { key:"rearm_forces",          label:"Rearm Forces" },
        { key:"economic_boom",         label:"Economic Boom" }
      ];
    }

    async _renderInner(){
      const wrap=document.createElement("section"); wrap.className="bbttcc-activity-planner"; wrap.style.padding="12px";
      const facs=factionList(); const hexes=listSceneHexes(); const acts=this._buildStrategicList();

      const mkLbl=t=>{const l=document.createElement("label"); l.textContent=t; return l;};
      const mkSel=(opts,val,label)=>{const s=document.createElement("select"); s.style.width="100%";
        opts.forEach(o=>{const op=document.createElement("option"); op.value=o[val]; op.textContent=o[label]; s.appendChild(op);});
        return s;};
      const mkBtn=(txt,ds={})=>{const b=document.createElement("button"); b.type="button"; b.className="btn"; b.textContent=txt; Object.assign(b.dataset,ds); return b;};

      const sFac=mkSel(facs.map(f=>({id:f.id,name:f.name})),"id","name");
      const sHex=mkSel(hexes.map(h=>({uuid:h.uuid,name:h.name})),"uuid","name");
      const sAct=mkSel(acts,"key","label"); sAct.title="Strategic Turn Actions";
      const nInp=document.createElement("input"); nInp.type="text"; nInp.placeholder="Note (optional)"; nInp.style.width="100%";
      const pick=mkBtn("Pick on Canvas",{act:"pick"}); pick.title="Click, then click a hex on the canvas";

      const grid=document.createElement("div"); grid.style.display="grid"; grid.style.gridTemplateColumns="1fr auto"; grid.style.gap="8px";
      grid.append(mkLbl("Faction"), sFac,
                  mkLbl("Target Hex"), (()=>{const row=document.createElement("div"); row.style.display="flex"; row.style.gap="6px"; row.append(sHex,pick); return row;})(),
                  mkLbl("Activity"), sAct,
                  mkLbl("Note"), nInp);
      wrap.appendChild(grid);

      const row=document.createElement("div"); row.style.display="flex"; row.style.gap="8px"; row.style.marginTop="10px";
      const bPlan=mkBtn("Plan",{act:"plan"}); const bCancel=mkBtn("Cancel",{act:"cancel"}); row.append(bPlan,bCancel); wrap.appendChild(row);

      // Canvas picker
      let _pick=false; const endPick=()=>{_pick=false; canvas?.stage?.off?.("pointerdown",onPick); ui.notifications?.info?.("Hex pick ended."); pick.classList.remove("active");};
      const onPick=async(ev)=>{ if(!_pick) return; const pt=ev.data?.global; if(!pt) return;
        const cand=listSceneHexes(); let chosen=null;
        for(const h of cand){ const doc=await fromUuid(h.uuid).catch(()=>null); const obj=doc?.object;
          if(obj?.hitArea?.contains?.(pt.x,pt.y)||obj?.bounds?.contains?.(pt.x,pt.y)){ chosen=h; break; } }
        if(chosen){ sHex.value=chosen.uuid; ui.notifications?.info?.(`Target: ${chosen.name}`); endPick(); } else ui.notifications?.warn?.("No hex at that point."); };

      wrap.addEventListener("click",async(ev)=>{
        const act=ev.target?.dataset?.act; if(!act) return;
        if(act==="cancel"){ this.close(); return; }
        if(act==="pick"){ if(!canvas?.ready){ ui.notifications?.warn?.("Canvas not ready."); return; }
          _pick=!_pick; if(_pick){ ui.notifications?.info?.("Click a hex on the canvas…"); pick.classList.add("active"); canvas.stage.on("pointerdown",onPick); } else endPick(); return; }
        if(act==="plan"){
          const attackerId=sFac.value, targetUuid=sHex.value, activityKey=sAct.value, note=nInp.value||"";
          if(!attackerId||!targetUuid||!activityKey) return ui.notifications?.warn?.("Select faction, target, and activity first.");
          try{
            await game.bbttcc.api.raid.planActivity({ attackerId, targetUuid, activityKey, note });
            ui.notifications?.info?.("Planned activity recorded."); this.close();
          }catch(e){ console.error(e); ui.notifications?.error?.("Failed to plan activity (see console)."); }
        }
      });

      this.onClose=()=>{ canvas?.stage?.off?.("pointerdown",onPick); };
      return wrap;
    }

    async _renderHTML(){ const html=await this._renderInner(); return { html, parts:{ body: html } }; }
    async _replaceHTML(result){ const node=result?.html ?? result; if(node) this.element.replaceChildren(node); return this.element; }
  }
  globalThis.BBTTCC_ActivityPlanner = ActivityPlanner;
});

/* ---------------- Raid Console + API + Toolbar ---------------- */
Hooks.once("init",()=>{
  game.bbttcc ??= { api:{} }; game.bbttcc.api ??= {}; game.bbttcc.api.raid ??= {};
  const raidAPI = game.bbttcc.api.raid;

  raidAPI.getTypes = function(){
    try{ const mod=game.modules.get(RAID_ID); return mod?.api?.TYPES || raidAPI.TYPES || {}; }catch{return{};}
  };

  raidAPI.getActivities = function(){
    try{
      const EFFECTS = raidAPI.EFFECTS || {};
      const TYPES   = raidAPI.getTypes?.() || raidAPI.TYPES || {};
      const raidKeys = new Set(Object.keys(TYPES).map(k=>String(k).toLowerCase()));
      const arr = Object.entries(EFFECTS)
        .filter(([k,v])=>v?.kind==="strategic" && !raidKeys.has(String(k).toLowerCase()))
        .map(([k,v])=>({ key:k, label:v?.label||k }));
      if(arr.length) return arr;
    }catch(e){ warn("getActivities build failed",e); }
    const types = raidAPI.getTypes();
    const list = Object.values(types||{}).map(t=>({ key:t.key, label:t.label||t.key, primaryKey:t.primaryKey||"violence" }));
    return list.length ? list : [
      { key:"assault", label:"Assault", primaryKey:"violence" },
      { key:"infiltration", label:"Infiltration", primaryKey:"intrigue" }
    ];
  };

  raidAPI.planActivity = async function({ attackerId, targetUuid, activityKey, note="" }){
    if(!attackerId||!targetUuid||!activityKey) throw new Error("Missing required params.");
    const attacker = game.actors.get(attackerId); if(!attacker) throw new Error("Attacker not found.");
    const target = await fromUuid(targetUuid); const tdoc = target?.document ?? target;
    const tf = tdoc?.getFlag?.(TERR_ID) || tdoc?.flags?.[TERR_ID] || {};
    const targetName = tf?.name || tdoc?.text || tdoc?.id || "Unknown Hex";
    const act = { key:activityKey, label:activityKey };
    const entry = { ts:Date.now(), date: (new Date()).toLocaleString(), type:"planned", attackerId, targetUuid,
                    activityKey:act.key, summary:`${attacker.name} planned ${act.label} on ${targetName}`, note:String(note||"") };
    const prev = deepClone(attacker.getFlag(FCT_ID,"warLogs") || []); prev.push(entry); await attacker.setFlag(FCT_ID,"warLogs", prev);
    log("Planned entry written", entry); return entry;
  };

  raidAPI.openActivityPlanner = ()=>{ const C=globalThis.BBTTCC_ActivityPlanner; if(!C) return ui.notifications?.warn?.("Activity Planner not available."); new C().render(true,{focus:true}); };
  raidAPI.openRaidConsole     = ()=>{ const C=globalThis.BBTTCC_RaidConsole;     if(!C) return ui.notifications?.warn?.("Raid Console not available.");     new C().render(true,{focus:true}); };
  raidAPI.openConsole = raidAPI.openRaidConsole;

  log("Raid API registered (V2 console + planner; consumePlanned is compat-bridge).");
});

/* ---------------- Toolbar Attachment ---------------- */
Hooks.once("ready",()=>{
  const openPlanner = ()=> game.bbttcc.api.raid.openActivityPlanner();
  const openRaid    = ()=> game.bbttcc.api.raid.openRaidConsole();

  try{ const obs=globalThis.__bbttccRaidToolbarObserver; if(obs?.disconnect) obs.disconnect(); }catch{}

  const attach=()=>{
    const el=document.getElementById("bbttcc-toolbar"); if(!el) return false;
    if (el.__bbttccRaidClickBound) { el.replaceWith(el.cloneNode(true)); return false; }

    const mk=(act,label,icon,fn)=>{
      if(el.querySelector(`a.bbttcc-btn[data-act="${act}"]`)) return;
      const a=document.createElement("a"); a.className="bbttcc-btn btn"; a.dataset.act=act;
      a.innerHTML=`<i class="fas fa-${icon}"></i><span>${label}</span>`;
      a.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); fn(); },{capture:true});
      (el.querySelector(".row") || el).appendChild(a);
    };
    mk("raid","Raid","crosshairs",openRaid);
    mk("plan-activity","Plan","clipboard-list",openPlanner);
    el.__bbttccRaidClickBound = true;
    log("Toolbar buttons attached (V2).");
    return true;
  };

  if(!attach()){
    const obs=new MutationObserver(()=>{ if(attach()) obs.disconnect(); });
    obs.observe(document.body,{childList:true,subtree:true});
  }
});
