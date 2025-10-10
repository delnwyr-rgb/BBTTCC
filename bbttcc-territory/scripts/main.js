/* modules/bbttcc-territory/scripts/main.js */
const MOD = "bbttcc-territory";
const TPL_HEX_CONFIG = `modules/${MOD}/templates/hex-config.hbs`;

/* ===== Handlebars helpers ===== */
Hooks.once("init", () => {
  if (!Handlebars.helpers.bbttcc_eq)       Handlebars.registerHelper("bbttcc_eq", (a,b)=>a===b);
  if (!Handlebars.helpers.bbttcc_contains) Handlebars.registerHelper("bbttcc_contains",(arr,v)=>Array.isArray(arr)&&arr.includes(v));
});

/* ===== Click-through suppression (global) ===== */
let suppressUntil = 0;
let recentlySavedHex = { id: null, until: 0 };
const now = () => Date.now();
const isSuppressed = () => now() < suppressUntil;
function suppressClicks(ms=500, hexId=null) {
  const t = now() + ms;
  suppressUntil = Math.max(suppressUntil, t);
  if (hexId) recentlySavedHex = { id: hexId, until: t };
}
globalThis.bbttcc_territory_isSuppressed = isSuppressed;
globalThis.bbttcc_territory_suppress     = suppressClicks;

/* ===== Boot: API + toolbar + click-to-edit ===== */
Hooks.once("ready", () => {
  game.bbttcc ??= { api: {} };
  game.bbttcc.api.territory ??= {};
  Object.assign(game.bbttcc.api.territory, {
    openHexConfig, createHexAt: createHexAtModern, focusHex, openDashboard
  });
  ensureToolbar(); mountToolbarButtons(); bindClickHandlers();
});
Hooks.on("canvasReady", () => { ensureToolbar(); mountToolbarButtons(); bindClickHandlers(); });
Hooks.on("canvasTearDown", unbindClickHandlers);

/* ===== Toolbar ===== */
function ensureToolbar(){
  let bar=document.getElementById("bbttcc-toolbar"); if(bar) return bar;
  bar=document.createElement("div"); bar.id="bbttcc-toolbar";
  Object.assign(bar.style,{position:"fixed",top:"60px",left:"60px",zIndex:1000,display:"flex",gap:".5rem",background:"rgba(34,34,34,.95)",padding:".25rem .5rem",border:"1px solid #555",borderRadius:"8px",userSelect:"none",boxShadow:"0 2px 8px rgba(0,0,0,.4)"});
  const handle=document.createElement("div"); handle.textContent="BBTTCC";
  Object.assign(handle.style,{fontSize:"12px",color:"#ddd",padding:".1rem .35rem",cursor:"grab",alignSelf:"center",background:"rgba(255,255,255,.06)",borderRadius:"4px"});
  bar.appendChild(handle);

  // drag with correct pointer capture release
  let dragging=false, dx=0, dy=0, activePointerId=null;
  handle.addEventListener("pointerdown", e => {
    dragging = true;
    activePointerId = e.pointerId;
    try { handle.setPointerCapture?.(activePointerId); } catch {}
    dx=e.clientX-bar.offsetLeft; dy=e.clientY-bar.offsetTop;
    handle.style.cursor="grabbing";
  });
  handle.addEventListener("pointermove", e => {
    if (!dragging) return;
    bar.style.left = (e.clientX - dx) + "px";
    bar.style.top  = (e.clientY - dy) + "px";
  });
  function releasePointer(e){
    dragging=false;
    try {
      const pid = e?.pointerId ?? activePointerId;
      if (pid != null) handle.releasePointerCapture?.(pid);
    } catch {}
    activePointerId = null;
    handle.style.cursor="grab";
  }
  handle.addEventListener("pointerup", releasePointer);
  handle.addEventListener("pointercancel", releasePointer);
  handle.addEventListener("pointerleave", releasePointer);

  document.body.appendChild(bar);
  return bar;
}

function addBtn(id, icon, label, onClick){
  const bar=ensureToolbar();
  let b=bar.querySelector(`[data-bbttcc="${id}"]`); if (b) return b;
  b=document.createElement("button");
  b.type="button"; b.setAttribute("data-bbttcc", id);
  b.innerHTML=`<i class="${icon}"></i> ${label}`;
  b.style.cursor="pointer";
  b.addEventListener("mousedown", () => { if (isSuppressed()) return; }); // absorb early
  b.addEventListener("click", (ev) => { if (!isSuppressed()) onClick(ev); });
  bar.appendChild(b);
  return b;
}
function mountToolbarButtons(){ addBtn("dashboard","fas fa-th","Dashboard", openDashboard); addBtn("create-hex","fas fa-draw-polygon","Create Hex", beginPlaceHex); }
let _dash=null; async function openDashboard(){ const C=globalThis.BBTTCC_TerritoryDashboardCtor; if(!_dash||_dash._state<=0){ if(typeof C==="function") _dash=new C(); else return ui.notifications.warn("Territory Dashboard is not available."); } _dash.render(true,{focus:true}); }

/* ===== Click-to-edit & hover affordance ===== */
let _clickBound=false;
function bindClickHandlers(){ if(_clickBound) return; _clickBound=true; Hooks.on("clickDrawing", onClickDrawing); }
function unbindClickHandlers(){ if(!_clickBound) return; _clickBound=false; Hooks.off("clickDrawing", onClickDrawing); }
Hooks.on("drawDrawing", d => { const f=getFlags(d.document); if(!(f.isHex||f.kind==="territory-hex")) return; try{ d.eventMode="static"; d.cursor="pointer"; }catch{}; });

async function onClickDrawing(d, inter){
  if (isSuppressed()) return;
  const doc=d?.document??d; const f=getFlags(doc); if(!(f.isHex||f.kind==="territory-hex")) return;
  if (recentlySavedHex.id === doc.id && now() < recentlySavedHex.until) return;
  const ev=inter?.event??inter?.originalEvent??inter; const ctrl=!!(ev?.ctrlKey||ev?.metaKey);
  if (ctrl) return void focusHex(d);
  if (d?._dragging) return;
  await openHexConfig(doc.uuid);
}

async function focusHex(arg){ const dr=typeof arg==="string"?canvas?.drawings?.get(arg):arg; if(!dr) return; const {x,y,width,height}=dr; await canvas.animatePan({x:x+Math.max(width,1)/2,y:y+Math.max(height,1)/2,scale:1.25}); }

/* ===== Flags ===== */
function getFlags(doc){ return foundry.utils.getProperty(doc, `flags.${MOD}`) ?? {}; }

/* ===== Sephirot list (safe) ===== */
async function getSephirotList(){
  const out=[]; for(const it of game.items?.contents??[]) if(isSephirotItem(it)) out.push({uuid:it.uuid,name:it.name});
  for(const p of game.packs??[]){ if(p.documentName!=="Item") continue; if(!/bbttcc|option|character/i.test(p.collection)) continue;
    try{ const docs=await p.getDocuments({}); for(const it of docs) if(isSephirotItem(it)) out.push({uuid:it.uuid,name:it.name}); }catch{} }
  const seen=new Set(), list=[]; for(const o of out) if(!seen.has(o.uuid)){ seen.add(o.uuid); list.push(o); }
  list.sort((A,B)=>A.name.localeCompare(B.name)); return list;
}
function isSephirotItem(it){ const keys=Object.keys(it?.flags??{}).join("|").toLowerCase(); if(keys.includes("sephirot")) return true;
  const n=(it?.name??"").toLowerCase(); return ["keter","chokmah","binah","chesed","gevurah","tiferet","netzach","hod","yesod","malkuth","sephirot"].some(s=>n.includes(s)); }

/* ===== Editor state: singleton + close-in-flight guards ===== */
const openEditors = new Map();          // drawing id -> Dialog
const closingEditors = new Set();       // drawing ids currently closing
const savingEditors  = new Set();       // drawing ids currently saving (re-entrancy guard)

/* ===== Hex Editor ===== */
function buildOwnerList(){ const list=(game.actors?.contents??[]).filter(a=>a.getFlag?.("bbttcc-factions","isFaction")===true || String(a.system?.details?.type?.value??"").toLowerCase()==="faction")
  .map(a=>({id:a.id,name:a.name})).sort((A,B)=>A.name.localeCompare(B.name)); return [{id:"",name:"Unclaimed"},...list]; }

async function openHexConfig(uuidOrId){
  const dr=await fromUuid(uuidOrId).catch(()=>null) || canvas?.drawings?.get(uuidOrId);
  if(!dr) return ui.notifications.warn("Hex drawing not found.");
  const id = dr.id;

  if (closingEditors.has(id)) return;                                  // ignore while closing
  if (recentlySavedHex.id === id && now() < recentlySavedHex.until) return; // ignore right after save

  const existing = openEditors.get(id);
  if (existing && existing.rendered) { try { existing.bringToTop?.(); } catch {} return existing; }

  const f=getFlags(dr);
  const context={
    name:f.name ?? dr.text ?? "Hex",
    ownerId:f.factionId ?? "",
    ownerList:buildOwnerList(),
    status:f.status ?? "unclaimed",
    type:f.type ?? "settlement",
    size:f.size ?? "standard",
    population:f.population ?? "medium",
    capital:!!f.capital,
    sephirotUuid:f.sephirotUuid ?? "",
    sephirotList:await getSephirotList(),
    resources:{ food:f.resources?.food??0, materials:f.resources?.materials??0, trade:f.resources?.trade??0, military:f.resources?.military??0, knowledge:f.resources?.knowledge??0 },
    modifiers:Array.isArray(f.modifiers)?f.modifiers:[],
    notes:f.notes ?? "",
    createdAt:f.createdAt ? new Date(f.createdAt).toLocaleString() : ""
  };
  const rt=foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  const html=await rt(TPL_HEX_CONFIG, context);

  const dlg = new Dialog({
    title:"BBTTCC Hex Configuration",
    content:html,
    buttons:{
      save:{ icon:'<i class="fas fa-save"></i>', label:"Save", callback:(dlgRef)=>_saveHexForm(id, dlgRef) },
      cancel:{ label:"Cancel", callback: () => { suppressClicks(300, id); } }
    },
    default:"save",
    close: () => { openEditors.delete(id); closingEditors.delete(id); }
  },{ jQuery:false });

  openEditors.set(id, dlg);
  return dlg.render(true);
}

/* Find the form reliably */
function getDialogForm(dlg){
  if (dlg?.element instanceof HTMLElement) return dlg.element.querySelector("form.bbttcc-hex-config");
  if (Array.isArray(dlg?.element) && dlg.element[0] instanceof HTMLElement) return dlg.element[0].querySelector("form.bbttcc-hex-config");
  if (typeof dlg?.appId === "number") return document.querySelector(`#app-${dlg.appId} form.bbttcc-hex-config`);
  return document.querySelector(".window-app.dialog form.bbttcc-hex-config");
}

async function _saveHexForm(id, dlg){
  if (savingEditors.has(id)) return;            // re-entrancy guard
  savingEditors.add(id);

  const form=getDialogForm(dlg); if(!form){ savingEditors.delete(id); return ui.notifications.error("Hex Config form not found."); }

  // disable Save button to avoid double-fire
  try {
    const btn = form.closest(".window-app")?.querySelector('button[data-button="save"]') || form.querySelector('button[type="submit"], button');
    btn && (btn.disabled = true);
  } catch {}

  const fd=new FormData(form);

  const name       = String(fd.get("name") ?? "").trim();
  const factionId  = String(fd.get("factionId") ?? "");
  const status     = String(fd.get("status") ?? "unclaimed");
  const type       = String(fd.get("type") ?? "settlement");
  const size       = String(fd.get("size") ?? "standard");
  const population = String(fd.get("population") ?? "medium");
  const capital    = fd.get("capital") !== null;
  const notes      = String(fd.get("notes") ?? "");
  const sephirotUuid = String(fd.get("sephirotUuid") ?? "");
  let sephirotName = "";
  if (sephirotUuid) { try { const it=await fromUuid(sephirotUuid); sephirotName = it?.name ?? ""; } catch {} }

  const resources  = {
    food: nOrNull(fd.get("resources.food")),
    materials: nOrNull(fd.get("resources.materials")),
    trade: nOrNull(fd.get("resources.trade")),
    military: nOrNull(fd.get("resources.military")),
    knowledge: nOrNull(fd.get("resources.knowledge"))
  };
  const modifiers = Array.from(form.querySelectorAll('input[name="modifiers"]:checked')).map(i=>String(i.value));

  const patch = {
    _id: id,
    text: name || "Hex",
    [`flags.${MOD}.name`]: name,
    [`flags.${MOD}.factionId`]: factionId,
    [`flags.${MOD}.status`]: status,
    [`flags.${MOD}.type`]: type,
    [`flags.${MOD}.size`]: size,
    [`flags.${MOD}.population`]: population,
    [`flags.${MOD}.capital`]: capital,
    [`flags.${MOD}.resources`]: resources,
    [`flags.${MOD}.modifiers`]: modifiers,
    [`flags.${MOD}.notes`]: notes,
    [`flags.${MOD}.sephirotUuid`]: sephirotUuid,
    [`flags.${MOD}.sephirotName`]: sephirotName
  };

  try{
    await canvas.scene.updateEmbeddedDocuments("Drawing", [patch]);
    const owner = game.actors?.get(factionId);
    await canvas.scene.updateEmbeddedDocuments("Drawing", [{ _id:id, [`flags.${MOD}.faction`]: owner?.name ?? "" }]);
    await canvas.scene.updateEmbeddedDocuments("Drawing", [{ _id:id, ...styleForStatus(status) }]);

    // mark closing, suppress clicks BEFORE closing
    closingEditors.add(id);
    suppressClicks(650, id);
    try { dlg.close?.(); } catch {}
    openEditors.delete(id);

    ui.notifications.info("Saved.");
  }catch(e){
    console.warn(`[${MOD}] Hex save failed`, e);
    ui.notifications.error("Could not save that change (see console).");
  }finally{
    // let the close settle before permitting new opens
    setTimeout(() => { savingEditors.delete(id); }, 50);
    setTimeout(() => { closingEditors.delete(id); }, 400);
  }
}

const nOrNull = (v) => (v===""||v==null) ? null : (Number.isFinite(Number(v)) ? Number(v) : null);

/* ===== Visual style ===== */
function styleForStatus(st){
  switch (st) {
    case "claimed":   return { fillType: 1, fillColor: "#33aa33", fillAlpha: 0.20, strokeWidth: 4 };
    case "scorched":  return { fillType: 1, fillColor: "#aa3333", fillAlpha: 0.25, strokeWidth: 4 };
    case "contested": return { fillType: 1, fillColor: "#ffaa00", fillAlpha: 0.25, strokeWidth: 4 };
    default:          return { fillType: 1, fillColor: "#007700", fillAlpha: 0.08, strokeWidth: 4 };
  }
}

/* ===== Create Hex (orientation) ===== */
function detectStartAngle(){ const g=canvas.grid; return !!g?.columns ? 0 : -Math.PI/6; }
function snapCenter(x,y){ const g=canvas.grid; if(g?.getCenterPoint){ const p=g.getCenterPoint({x,y}); return {x:p.x,y:p.y}; } if(g?.getSnappedPoint){ const p=g.getSnappedPoint({x,y}); return {x:p.x,y:p.y}; } return {x,y}; }
function hexVerts(cx,cy,r,start){ const pts=[]; for(let i=0;i<6;i++){ const a=start+i*(Math.PI/3); pts.push(cx+r*Math.cos(a), cy+r*Math.sin(a)); } return pts; }

async function createHexAtModern(x,y){
  if (isSuppressed()) return;
  const g=canvas.grid; if(!g) throw new Error("No grid.");
  const {x:cx,y:cy}=snapCenter(x,y);
  const r=Math.min(g.sizeX ?? g.size ?? 100, g.sizeY ?? g.size ?? 100)*0.5;
  const start=detectStartAngle();

  const verts=hexVerts(cx,cy,r,start);
  let minX=Infinity,minY=Infinity; for(let i=0;i<verts.length;i+=2){ minX=Math.min(minX,verts[i]); minY=Math.min(minY,verts[i+1]); }
  const rel=[]; for(let i=0;i<verts.length;i+=2) rel.push(verts[i]-minX, verts[i+1]-minY);

  const flags={ isHex:true, kind:"territory-hex", name:"Hex", status:"unclaimed", type:"settlement", size:"standard", population:"medium",
                capital:false, resources:{food:0,materials:0,trade:0,military:0,knowledge:0}, modifiers:[], createdAt:Date.now(), sephirotUuid:"", sephirotName:"" };

  await canvas.scene.createEmbeddedDocuments("Drawing", [{
    x:minX, y:minY, shape:{ type:"p", points: rel }, text:"Hex",
    strokeColor:"#007700", strokeAlpha:0.9, strokeWidth:4,
    ...styleForStatus("unclaimed"), flags:{ [MOD]: flags }
  }]);

  ui.notifications.info("Hex created.");
}

/* ===== One-shot placement ===== */
let _placing=false;
function beginPlaceHex(){
  if (_placing || isSuppressed()) return;
  _placing=true; ui.notifications.info("Click the map to place a hex. (Esc to cancel)");
  const cancel=e=>{ if(e.key==="Escape"){ _placing=false; window.removeEventListener("keydown",cancel,true); canvas.stage.off("pointerdown",onDown); ui.notifications.info("Create Hex cancelled."); } };
  window.addEventListener("keydown",cancel,true);
  const onDown=async ev=>{ if(!_placing) return; _placing=false; window.removeEventListener("keydown",cancel,true); canvas.stage.off("pointerdown",onDown);
    try{ const pos=ev.data?.getLocalPosition(canvas.app.stage) ?? {x:ev.clientX,y:ev.clientY}; await createHexAtModern(pos.x,pos.y); }
    catch(e){ console.warn(`[${MOD}] Create Hex failed`, e); ui.notifications.error("Could not create hex (see console)."); } };
  canvas.stage.on("pointerdown", onDown);
}
