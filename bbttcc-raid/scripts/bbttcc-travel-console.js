/* BBTTCC — Travel Console (v1.4.1-TokenMove)
 * Adds automatic token movement after route execution.
 * Compatible with Foundry v13.348 and BBTTCC v1.3.16-Travel.
 */
(() => {
  const TAG = "[bbttcc-travel-console v1.4.1]";

  function enc(s) { return foundry.utils.escapeHTML(String(s ?? "")); }
  function opLabel(k) {
    return {
      economy: "Economy", logistics: "Logistics", intrigue: "Intrigue",
      violence: "Violence", nonLethal: "Non-Lethal", faith: "Faith",
      diplomacy: "Diplomacy", softPower: "Soft Power"
    }[k] || k;
  }
  function opToStr(cost) {
    return Object.entries(cost || {})
      .filter(([_, v]) => Number(v) > 0)
      .map(([k, v]) => `${v} ${opLabel(k)}`)
      .join(", ");
  }

  function terrainDict() {
    const ext = game.bbttcc?.api?.travel?.__terrain || {};
    const fb = {
      plains:{label:"Plains"}, forest:{label:"Forest"}, mountains:{label:"Mountains"},
      canyon:{label:"Canyons"}, swamp:{label:"Swamp"}, desert:{label:"Desert"},
      ruins:{label:"Ruins"}, wasteland:{label:"Wasteland"}
    };
    const dict={};
    for (const k of new Set([...Object.keys(fb),...Object.keys(ext)]))
      dict[k]={label:ext[k]?.label||fb[k]?.label||k,cost:ext[k]?.cost||{}};
    return dict;
  }

  function getHexesOnScene() {
    const MOD_T = "bbttcc-territory";
    return (canvas?.drawings?.placeables||[])
      .map(p=>{
        const t=p.document.getFlag?.(MOD_T,"terrain")??p.document.flags?.[MOD_T]?.terrain;
        return t?.key?{id:p.id,uuid:p.document.uuid,label:p.document.text||"(unnamed)",
          terrainKey:String(t.key).toLowerCase()}:null;
      }).filter(Boolean);
  }

  class BBTTCC_TravelConsole extends Application {
    static get defaultOptions(){
      return foundry.utils.mergeObject(super.defaultOptions,{
        id:"bbttcc-travel-console",title:"BBTTCC: Travel Console",popOut:true,
        width:780,height:540,resizable:true,
        classes:["bbttcc","bbttcc-travel-console"],template:"templates/app-window.html"
      });
    }

    async getData(){return{appId:this.appId,classes:this.options.classes?.join(" ")??"",window:{title:this.title}};}

    activateListeners(html){
      super.activateListeners(html);
      const root=html?.[0];
      const content=root?.querySelector?.(".window-content");
      if(!content) return;

      // ---------------- UI Scaffold ----------------
      content.innerHTML=`<div class='bbttcc-tc' style='padding:.75rem;color:#2b2b2b;'>
        <div style='font-weight:700;margin-bottom:.5rem;'>BBTTCC: Travel Console</div>
        <div style='font-size:12px;opacity:.9;'>UUID-based travel via api.travel.travelHex.</div>
        <hr style='opacity:.2;margin:.5rem 0;'>
        <div class='row' style='display:flex;gap:.5rem;align-items:center;margin-top:.5rem;flex-wrap:wrap;'>
          <select data-role='faction' style='padding:.25rem .5rem;min-width:240px;'></select>
        </div>
        <div style='margin-top:.75rem;padding-top:.75rem;border-top:1px dashed rgba(0,0,0,.2);'>
          <div style='font-weight:700;margin-bottom:.5rem;'>Route Planner</div>
          <div class='rp-row' style='display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;'>
            <select data-role='rp-from' style='padding:.25rem .5rem;min-width:240px;'></select>
            <span>→</span>
            <select data-role='rp-to' style='padding:.25rem .5rem;min-width:240px;'></select>
            <button data-action='rp-add' class='bbttcc-btn' style='padding:.25rem .5rem;'>Add Leg</button>
            <button data-action='rp-clear' class='bbttcc-btn' style='padding:.25rem .5rem;'>Clear</button>
          </div>
          <div class='rp-legs' style='margin-top:.5rem;max-height:180px;overflow:auto;
               border:1px solid rgba(0,0,0,.15);border-radius:6px;background:rgba(255,255,255,.65);'></div>
          <div class='rp-footer' style='display:flex;gap:.5rem;align-items:center;margin-top:.5rem;flex-wrap:wrap;'>
            <span class='rp-est' style='font-size:12px;background:rgba(255,255,255,.85);
                   color:#111;padding:2px 6px;border:1px solid rgba(0,0,0,.3);border-radius:6px;'>No legs</span>
            <button data-action='rp-exec' class='bbttcc-btn' style='padding:.25rem .5rem;'>Execute Route</button>
            <span class='rp-out' style='font-size:12px;background:rgba(255,255,255,.85);
                   color:#111;padding:2px 6px;border:1px solid rgba(0,0,0,.3);border-radius:6px;'></span>
          </div>
        </div></div>`;

      const factions=Array.from(game.actors??[])
        .filter(a=>a?.getFlag?.("bbttcc-factions","isFaction")||a?.flags?.["bbttcc-factions"]?.isFaction)
        .map(a=>({id:a.id,name:a.name}));
      const dict=terrainDict();
      const hexes=getHexesOnScene();

      const $fac=content.querySelector('select[data-role="faction"]');
      const $rf=content.querySelector('select[data-role="rp-from"]');
      const $rt=content.querySelector('select[data-role="rp-to"]');
      const $legs=content.querySelector(".rp-legs");
      const $est=content.querySelector(".rp-est");
      const $rout=content.querySelector(".rp-out");

      const makeOpt=(v,l)=>{const o=document.createElement("option");o.value=v;o.textContent=l;return o;};
      (factions.length?factions:[{id:"",name:"(no faction actors)"}]).forEach(f=>$fac.appendChild(makeOpt(f.id,f.name)));
      hexes.forEach(h=>{const txt=`${h.label} [${dict[h.terrainKey]?.label||h.terrainKey}]`;[$rf,$rt].forEach(sel=>sel.appendChild(makeOpt(h.uuid,txt)));});
      if(hexes.length>1)$rt.selectedIndex=1;

      const legs=[];
      function render(){
        const rows=legs.map((L,i)=>{
          const f=hexes.find(h=>h.uuid===L.fromUuid),t=hexes.find(h=>h.uuid===L.toUuid);
          const terr=t?.terrainKey||"",costStr=opToStr(dict[terr]?.cost||{})||"—";
          return `<div style='display:flex;gap:.5rem;align-items:center;padding:.25rem .5rem;
            border-bottom:1px solid rgba(0,0,0,.08);'>
            <span style='font-size:12px;opacity:.8;'>${i+1}.</span>
            <span style='flex:1;'>${enc(f?.label)} → ${enc(t?.label)} <i style='opacity:.7;'>[${enc(dict[terr]?.label||terr)}]</i></span>
            <span style='font-size:12px;opacity:.9;'>${enc(costStr)}</span>
            <button data-i='${i}' class='rp-del' style='padding:.1rem .4rem;'>✕</button></div>`;
        }).join("");
        $legs.innerHTML=rows||`<div style='padding:.5rem;font-size:12px;opacity:.75;'>No legs added.</div>`;
        const total={};for(const L of legs){const terr=hexes.find(h=>h.uuid===L.toUuid)?.terrainKey||"";const c=dict[terr]?.cost||{};for(const[k,v]of Object.entries(c))total[k]=(total[k]||0)+Number(v||0);}
        $est.textContent=legs.length?`Legs: ${legs.length} • Est. OP: ${opToStr(total)||"—"}`:"No legs";
        $legs.querySelectorAll(".rp-del")?.forEach(btn=>btn.onclick=()=>{legs.splice(Number(btn.dataset.i),1);render();});
      }

      content.querySelector('[data-action="rp-add"]').onclick=()=>{const f=$rf.value,t=$rt.value;if(f===t)return($rout.textContent="From/To must differ.");legs.push({fromUuid:f,toUuid:t});render();};
      content.querySelector('[data-action="rp-clear"]').onclick=()=>{legs.length=0;render();$rout.textContent="";};

      // -------- EXECUTE ROUTE with token move ----------
      content.querySelector('[data-action="rp-exec"]').onclick=async()=>{
        try{
          const factionId=$fac.value;
          if(!factionId)return($rout.textContent="Pick a faction first.");
          if(!legs.length)return($rout.textContent="Add at least one leg.");
          const out=[];
          for(let i=0;i<legs.length;i++){
            const L=legs[i];
            const r=await game.bbttcc.api.travel.travelHex({factionId,hexFrom:L.fromUuid,hexTo:L.toUuid});
            out.push(`${i+1}) ${r?.summary||(r?.ok?"Travel OK":"Travel failed")}`);
            try{
              const destObj=await fromUuid(L.toUuid);const dest=destObj?.object;
              if(dest){
                const tokens=canvas.tokens.placeables.filter(t=>t.actor?.id===factionId);
                let token=tokens.find(t=>t.controlled)||tokens.find(t=>!t.hidden)||tokens[0];
                if(token){
                  await token.document.update({x:dest.center.x-token.w/2,y:dest.center.y-token.h/2},{animate:true});
                  ui.notifications.info(`Moved faction token to ${dest.document.text||dest.document.name||dest.id}`);
                  await new Promise(r=>setTimeout(r,800));
                }else console.warn(TAG,"No token found for faction",factionId);
              }
            }catch(moveErr){console.warn(TAG,"Move error",moveErr);}
            if(!r?.ok)break;
          }
          console.log(TAG,"Route results →\\n"+out.join("\\n"));
          if(game.bbttcc?.runVisuals){
            console.log(TAG,"Launching travel visuals automatically…");
            await new Promise(r=>setTimeout(r,800));
            await game.bbttcc.runVisuals(game.bbttcc.ui.travelConsole);
          }
          $rout.textContent=out[out.length-1]||"Done.";
        }catch(e){console.error(TAG,e);$rout.textContent=e?.message||"Error";}
      };
      render();
    }
  }

  globalThis.BBTTCC_TravelConsole=BBTTCC_TravelConsole;
  Hooks.once("ready",()=>{game.bbttcc.ui??={};game.bbttcc.ui.travelConsole??=new BBTTCC_TravelConsole();console.log(TAG,"ready.");});
  Hooks.on("canvasReady",()=>{
    const id="bbttcc-travel-console-btn";document.getElementById(id)?.remove();
    const btn=document.createElement("div");
    Object.assign(btn.style,{position:"absolute",top:"6px",right:"340px",zIndex:200,
      background:"rgba(20,20,20,.9)",color:"#fff",padding:"6px 10px",borderRadius:"8px",
      cursor:"pointer",font:"12px Helvetica",boxShadow:"0 0 6px rgba(0,0,0,.35)"});
    btn.id=id;btn.textContent="Open Travel Console";
    btn.onclick=()=>game.bbttcc.ui.travelConsole.render(true);
    document.body.appendChild(btn);
  });
})();
