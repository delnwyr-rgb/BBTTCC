/* ---------- bbttcc-territory / scripts/main.js (Auto-calc restored + Manual Override) ---------- */
const MOD = "bbttcc-territory";
const TOOLBAR_ID = "bbttcc-toolbar";
const renderTpl = foundry.applications?.handlebars?.renderTemplate || renderTemplate;
const TPL_HEX_CONFIG = `modules/${MOD}/templates/hex-config.hbs`;

/* ---------------- Handlebars helpers ---------------- */
Hooks.once("init", () => {
  if (!Handlebars.helpers.bbttcc_eq)
    Handlebars.registerHelper("bbttcc_eq", (a,b)=>String(a)===String(b));
  if (!Handlebars.helpers.bbttcc_contains)
    Handlebars.registerHelper("bbttcc_contains", (arr,v)=>{
      if (!arr) return false;
      if (Array.isArray(arr)) return arr.includes(v);
      return String(arr).split(",").map(s=>s.trim()).includes(v);
    });
});

/* ---------------- Visuals ---------------- */
function styleForStatus(status="unclaimed",{capital=false}={}) {
  if (status==="scorched") status="occupied"; // legacy rename
  const table = {
    unclaimed:{ fillColor:"#999999", strokeColor:"#333333", fillAlpha:0.20, strokeAlpha:0.90, strokeWidth:3 },
    claimed:  { fillColor:"#00B894", strokeColor:"#00695C", fillAlpha:0.22, strokeAlpha:0.95, strokeWidth:3 },
    contested:{ fillColor:"#F39C12", strokeColor:"#AF601A", fillAlpha:0.24, strokeAlpha:0.95, strokeWidth:3 },
    occupied: { fillColor:"#E74C3C", strokeColor:"#922B21", fillAlpha:0.26, strokeAlpha:0.95, strokeWidth:3 }
  };
  const base = table[status] ?? table.unclaimed;
  return { ...base, strokeWidth: base.strokeWidth + (capital ? 2 : 0) };
}
async function applyStyle(dr) {
  if (!dr) return;
  const f = dr.flags?.[MOD] ?? {};
  const st = styleForStatus(f.status, { capital: !!f.capital });
  await dr.update({
    fillColor: st.fillColor,
    fillAlpha: st.fillAlpha,
    strokeColor: st.strokeColor,
    strokeAlpha: st.strokeAlpha,
    strokeWidth: st.strokeWidth
  }).catch(()=>{});
}

/* ---------------- Grid helpers ---------------- */
function detectStartAngle(){ const isHex=!!canvas?.grid?.isHexagonal; const flatTop=isHex ? !!canvas.grid.columns : true; return flatTop?0:-Math.PI/6; }
function hexVerts(cx,cy,r,start){ const pts=[]; for(let i=0;i<6;i++){ const a=start+i*Math.PI/3; pts.push(cx+r*Math.cos(a), cy+r*Math.sin(a)); } return pts; }
function toRelativePoints(abs){ const xs=[],ys=[]; for(let i=0;i<abs.length;i+=2){ xs.push(abs[i]); ys.push(abs[i+1]); } const minX=Math.min(...xs),minY=Math.min(...ys); const rel=[]; for(let i=0;i<abs.length;i+=2) rel.push(abs[i]-minX, abs[i+1]-minY); return {rel, origin:{x:minX,y:minY}}; }
function snapCenter(x,y){ try{ if (canvas?.grid?.getCenterPoint) return canvas.grid.getCenterPoint({x,y}); if (canvas?.grid?.getSnappedPoint) return canvas.grid.getSnappedPoint({x,y},1); }catch{} const g=canvas.scene?.grid?.size??100; return {x:Math.round(x/g)*g, y:Math.round(y/g)*g}; }
function worldFromEvent(ev){ try{ if (ev?.data?.getLocalPosition) return ev.data.getLocalPosition(canvas.app.stage); if (ev?.global) return canvas.stage.worldTransform.applyInverse(ev.global);}catch{} const cx=(canvas.scene?.width??0)/2, cy=(canvas.scene?.height??0)/2; return {x:cx,y:cy}; }

/* ---------------- Owners / Sephirot ---------------- */
function buildOwnerList(){
  const list=[];
  for (const a of game.actors?.contents ?? []) {
    const isFaction = a.getFlag?.("bbttcc-factions","isFaction")===true ||
      String(a.system?.details?.type?.value ?? "").toLowerCase()==="faction";
    if (isFaction) list.push({id:a.id, name:a.name});
  }
  return list.sort((A,B)=>A.name.localeCompare(B.name));
}
const keyFromName = (n)=> String(n||"").toLowerCase().trim().replace(/[^\p{L}]+/gu,"");
async function buildSephirotList(){
  const foundByName = new Map();
  for (const it of game.items?.contents ?? []) {
    const name = it?.name ?? "";
    if (/^(Keter|Chokhmah|Binah|Chesed|Gevurah|Tiferet|Netzach|Hod|Yesod|Malkuth)$/i.test(name))
      foundByName.set(name, { uuid: it.uuid, name });
  }
  for (const nm of ["Keter","Chokhmah","Binah","Chesed","Gevurah","Tiferet","Netzach","Hod","Yesod","Malkuth"])
    if (!foundByName.has(nm)) foundByName.set(nm, { uuid: keyFromName(nm), name: nm });
  return Array.from(foundByName.values()).sort((A,B)=>A.name.localeCompare(B.name));
}
async function nameFromUuid(uuid){
  if (!uuid) return "";
  if (!uuid.includes(".")) return uuid; // stored canonical key
  try { const doc = await fromUuid(uuid); return doc?.name || ""; } catch { return ""; }
}

/* ---------------- Old (working) math restored ---------------- */
/** Sephirot flat resource adds (before multipliers) */
function sephirotResourceBonus(name){
  const k = String(name||"").toLowerCase();
  switch (k) {
    case "keter":   return { food:1, materials:1, trade:1, military:1, knowledge:1 };
    case "chokhmah":return { food:0, materials:0, trade:0, military:0, knowledge:3 };
    case "binah":   return { food:0, materials:1, trade:0, military:0, knowledge:2 };
    case "chesed":  return { food:1, materials:0, trade:2, military:0, knowledge:0 };
    case "gevurah": return { food:0, materials:0, trade:0, military:3, knowledge:0 };
    case "tiferet": return { food:0, materials:0, trade:1, military:1, knowledge:1 };
    case "netzach": return { food:0, materials:0, trade:1, military:2, knowledge:0 };
    case "hod":     return { food:0, materials:2, trade:1, military:0, knowledge:0 };
    case "yesod":   return { food:0, materials:0, trade:1, military:0, knowledge:1 };
    case "malkuth": return { food:0, materials:3, trade:0, military:0, knowledge:0 };
    default:        return { food:0, materials:0, trade:0, military:0, knowledge:0 };
  }
}
/** Modifiers → global/trade multipliers (unchanged from working build) */
function getModifierEffects(modifiers=[]){
  const set = new Set((modifiers||[]).map(m=>String(m).trim().toLowerCase()));
  let mAll=1.0, mTrade=1.0;
  const bump=(pct)=>{ mAll *= (1+pct); };
  const bumpTrade=(pct)=>{ mTrade *= (1+pct); };

  if (set.has("well-maintained"))        bump(+0.25);
  if (set.has("fortified"))              { /* 0% prod */ }
  if (set.has("strategic position"))     bump(+0.10);
  if (set.has("loyal population"))       bump(+0.15);
  if (set.has("trade hub"))              bumpTrade(+0.50);
  if (set.has("contaminated"))           bump(-0.50);
  if (set.has("damaged infrastructure")) bump(-0.25);
  if (set.has("hostile population"))     bump(-0.25);
  if (set.has("difficult terrain"))      bump(-0.10);
  if (set.has("radiation zone"))         bump(-0.75);
  if (set.has("supply line vulnerable")) bump(-0.15); // keep the original value
  return { mAll, mTrade };
}
/** Type→base pips */
const TYPE_BASE = {
  settlement:{food:2, materials:1, trade:3, military:0, knowledge:0},
  fortress:  {food:0, materials:3, trade:1, military:4, knowledge:0},
  mine:      {food:0, materials:5, trade:2, military:0, knowledge:0},
  farm:      {food:5, materials:1, trade:2, military:0, knowledge:0},
  port:      {food:2, materials:2, trade:4, military:0, knowledge:0},
  factory:   {food:0, materials:4, trade:3, military:0, knowledge:0},
  research:  {food:0, materials:1, trade:1, military:0, knowledge:4},
  temple:    {food:1, materials:1, trade:1, military:0, knowledge:2},
  wasteland: {food:0, materials:1, trade:0, military:0, knowledge:0},
  ruins:     {food:0, materials:2, trade:0, military:0, knowledge:1}
};
/** Size multipliers */
const SIZE_MULT = { outpost:.5, village:.75, town:1, city:1.5, metropolis:2, megalopolis:3 };

/** Compute EFFECTIVE resources: base → +sephirot → ×modifiers */
function computeEffectiveResources(base, sephirotName, modifiers){
  const add = sephirotResourceBonus(sephirotName);
  const { mAll, mTrade } = getModifierEffects(modifiers);

  const afterAdd = {
    food:      Number(base.food||0)      + add.food,
    materials: Number(base.materials||0) + add.materials,
    trade:     Number(base.trade||0)     + add.trade,
    military:  Number(base.military||0)  + add.military,
    knowledge: Number(base.knowledge||0) + add.knowledge
  };

  const mul = (v,m)=> Math.max(0, Math.round(v*m));
  const effective = {
    food:      mul(afterAdd.food,      mAll),
    materials: mul(afterAdd.materials, mAll),
    trade:     mul(afterAdd.trade,     mAll * mTrade),
    military:  mul(afterAdd.military,  mAll),
    knowledge: mul(afterAdd.knowledge, mAll)
  };

  return { effective, added:add, multipliers:{mAll,mTrade} };
}

/* Optional: OP cache from resources (unchanged; harmless for UI) */
const RES_TO_OP = {
  economy:{food:0.5, materials:0.8, trade:1.0, military:0.1, knowledge:0.25},
  violence:{food:0.1, materials:0.2, trade:0.2, military:0.8, knowledge:0.0},
  nonLethal:{food:0.2, materials:0.1, trade:0.2, military:0.5, knowledge:0.3},
  intrigue:{food:0.0, materials:0.1, trade:0.5, military:0.1, knowledge:1.0},
  diplomacy:{food:0.2, materials:0.0, trade:0.6, military:0.0, knowledge:0.4},
  softPower:{food:0.2, materials:0.0, trade:0.5, military:0.0, knowledge:0.3}
};
function resourcesToOP(res){
  const out = { economy:0, violence:0, nonLethal:0, intrigue:0, diplomacy:0, softPower:0 };
  for (const [op,weights] of Object.entries(RES_TO_OP)) {
    let v=0; for (const [rk,w] of Object.entries(weights)) v += (res[rk]||0)*w; out[op]=Math.max(0, Math.round(v));
  }
  return out;
}

/* ---------------- Hex Editor ---------------- */
const OPEN = new Map();

async function openHexEditorByUuid(uuid){
  if (!uuid) return ui.notifications?.warn?.("Hex not found.");
  const dr = await fromUuid(uuid);
  if (!dr)  return ui.notifications?.warn?.("Hex not found.");

  const existing = OPEN.get(dr.id);
  if (existing) { try { existing.bringToTop(); } catch{} return; }

  const f = foundry.utils.getProperty(dr, `flags.${MOD}`) ?? {};

  // Integration track (0–6) with derived stage
  const integ = f.integration ?? {};
  const rawProgress = Number.isFinite(integ.progress) ? integ.progress : 0;
  const integrationProgress = Math.max(0, Math.min(6, Math.round(rawProgress)));

  let integrationStageKey = "wild";
  if (integrationProgress >= 6) integrationStageKey = "integrated";
  else if (integrationProgress === 5) integrationStageKey = "settled";
  else if (integrationProgress >= 3) integrationStageKey = "developing";
  else if (integrationProgress >= 1) integrationStageKey = "outpost";

  const integrationStageLabels = {
    wild: "Untouched Wilderness",
    outpost: "Foothold / Outpost",
    developing: "Developing Territory",
    settled: "Settled Province",
    integrated: "Integrated Heartland"
  };
  const integrationStageLabel = integrationStageLabels[integrationStageKey] || "—";

  const context = {
    name: f.name ?? dr.text ?? "",
    ownerId: f.factionId ?? "",
    ownerList: buildOwnerList(),
    status: f.status ?? "unclaimed",
    type: f.type ?? "settlement",
    size: f.size ?? "town",
    population: f.population ?? "medium",
    capital: !!f.capital,
    resources: {
      food:      Number(f.resources?.food ?? 0),
      materials: Number(f.resources?.materials ?? 0),
      trade:     Number(f.resources?.trade ?? 0),
      military:  Number(f.resources?.military ?? 0),
      knowledge: Number(f.resources?.knowledge ?? 0)
    },
    // Integration display
    integrationProgress,
    integrationMax: 6,
    integrationStageKey,
    integrationStageLabel,

    sephirotUuid: f.sephirotUuid || "",
    sephirotList: await buildSephirotList(),
    modifiers: Array.isArray(f.modifiers) ? f.modifiers : [],
    notes: f.notes ?? "",
    createdAt: f.createdAt ? new Date(f.createdAt).toLocaleString() : ""
  };

  const html = await renderTpl(TPL_HEX_CONFIG, context);

  // Manual override toggle (injected, non-invasive)
  const overrideBlock = `
    <fieldset style="margin-top:.5rem; border:1px solid #666; border-radius:6px; padding:.5rem;">
      <legend style="padding:0 .25rem; opacity:.9;">Save Behavior</legend>
      <label class="checkbox">
        <input type="checkbox" name="manualOverride" ${f.manualOverride ? "checked" : ""}>
        <span>Manual resource override</span>
      </label>
      <p class="hint">Unchecked → save <em>auto-calculated</em> resources from Type × Size × Alignment + Modifiers (recommended).</p>
    </fieldset>
  `;

  const dlg = new Dialog({
    title: "BBTTCC: Hex Configuration",
    content: `<form class="bbttcc-hex-config">${html}${overrideBlock}</form>`,
    buttons: {
      save: {
        icon:`<i class="far fa-save"></i>`,
        label:"Save",
        callback: async (jq) => {
          try {
            const form = jq[0].querySelector("form");
            const fd = new FormData(form);
            const data = {};
            for (const [k,v] of fd.entries()) {
              if (k==="modifiers") (data.modifiers ??= []).push(v);
              else if (k.startsWith("resources.")) {
                const key = k.split(".")[1];
                (data.resources ??= {})[key] = Number(v||0);
              } else data[k]=v;
            }
            if (!fd.has("capital")) data.capital = false;
            const manualOverride = fd.get("manualOverride")==="on";

            // Resolve Sephirot name + canonical key
            const selUuid = data.sephirotUuid || "";
            const selName = await nameFromUuid(selUuid);
            const selKey  = keyFromName(selName);

            // BASE (what user typed; may be all 0)
            const base = {
              food:      Number(data.resources?.food || 0),
              materials: Number(data.resources?.materials || 0),
              trade:     Number(data.resources?.trade || 0),
              military:  Number(data.resources?.military || 0),
              knowledge: Number(data.resources?.knowledge || 0)
            };

            // Build the auto base from Type×Size ladder, then apply +sephirot & ×modifiers
            const typeKey = String(data.type||"settlement").toLowerCase();
            const sizeKey = String(data.size||"town").toLowerCase();
            const typedBase = TYPE_BASE[typeKey] || TYPE_BASE.settlement;
            const sizeMult = SIZE_MULT[sizeKey] ?? 1;
            const sizedBase = {
              food:      Math.round((typedBase.food||0)     * sizeMult),
              materials: Math.round((typedBase.materials||0)* sizeMult),
              trade:     Math.round((typedBase.trade||0)    * sizeMult),
              military:  Math.round((typedBase.military||0) * sizeMult),
              knowledge: Math.round((typedBase.knowledge||0)* sizeMult)
            };

            // Compute effective from whichever vector will be used for UI
            const mods = Array.isArray(data.modifiers) ? data.modifiers : [];
            const vectorForDisplay =
              (manualOverride && Object.values(base).some(n=>n>0))
                ? base
                : sizedBase;

            const calc = computeEffectiveResources(vectorForDisplay, selName, mods);

            // Visible resources on hex:
            //  - Manual override: save the typed base unchanged
            //  - Auto mode:       save the EFFECTIVE totals (old working behavior)
            const resourcesToPersist =
              (manualOverride && Object.values(base).some(n=>n>0))
                ? base
                : calc.effective;

            // Optional OP cache derived from the same visible vector
            const effectiveOPs = resourcesToOP(resourcesToPersist);

            const name = (data.name ?? "").trim() || dr.text || "Hex";
            const now = Date.now();

            // Flags patch — we’ll set per-key for robustness
            const flagsPatch = {
              isHex:true, kind:"territory-hex", name,
              factionId:data.factionId || "",
              status:data.status || "unclaimed",
              type:data.type || "settlement",
              size:data.size || "town",
              population:data.population || "medium",
              capital: !!data.capital,

              // Visible numbers (either manual base, or auto effective)
              resources: resourcesToPersist,

              // Transparency / preview
              sephirotBonus: calc.added,
              calc: {
                base: vectorForDisplay,
                sephirotName: selName,
                multipliers: calc.multipliers,
                modifiers: mods,
                effective: calc.effective
              },

              // Alignment (all forms for fast lookups)
              sephirotUuid: selUuid,
              sephirotName: selName,
              sephirotKey:  selKey,

              // Manual switch (for readers who care)
              manualOverride: !!(manualOverride && Object.values(base).some(n=>n>0)),

              // Optional: OP cache for sheets/turn math
              effectiveCached: effectiveOPs,
              effectiveAt: now,

              // Notes / mods
              modifiers: mods,
              notes: data.notes ?? ""
            };

            // Write per-key to avoid any scene/permission quirk
            for (const [k,v] of Object.entries(flagsPatch)) {
              // eslint-disable-next-line no-await-in-loop
              await dr.setFlag(MOD, k, v);
            }
            await dr.update({ text:name }).catch(()=>{});

            // Verify; compact log
            const fresh = await fromUuid(dr.uuid);
            const gf = (k)=> fresh.getFlag(MOD, k);
            console.log("[bbttcc-territory] Save verify:", {
              name: gf("name"),
              type: gf("type"),
              size: gf("size"),
              resources: gf("resources"),
              manualOverride: gf("manualOverride"),
              effectiveCached: gf("effectiveCached"),
              effectiveAt: gf("effectiveAt")
            });

            await applyStyle(fresh);
            ui.notifications?.info?.("Hex saved.");
          } catch (err) {
            console.error("[bbttcc-territory] Save failed:", err);
            ui.notifications?.error?.("Hex save failed — see console.");
          }
        }
      },
      cancel:{ label:"Cancel" }
    },
    default:"save",
    close:()=>OPEN.delete(dr.id)
  });

  OPEN.set(dr.id, dlg);
  dlg.render(true);
}

/* ---------------- Create Hex ---------------- */
function buildHexData({ x,y }){
  const g=canvas.scene?.grid?.size ?? 100;
  const r=Math.max(12, Math.round(g*0.5));
  const abs=hexVerts(x,y,r,detectStartAngle());
  const {rel,origin}=toRelativePoints(abs);
  const v=styleForStatus("unclaimed");
  return {
    shape:{type:"p", points:rel},
    x:origin.x, y:origin.y,
    fillAlpha:v.fillAlpha, fillColor:v.fillColor, strokeColor:v.strokeColor, strokeAlpha:v.strokeAlpha, strokeWidth:v.strokeWidth,
    text:"Hex",
    flags:{ [MOD]:{
      isHex:true, kind:"territory-hex", name:"Hex",
      status:"unclaimed", type:"settlement", size:"town",
      population:"medium", capital:false,
      resources:{ food:0, materials:0, trade:0, military:0, knowledge:0 },
      createdAt: Date.now()
    }}
  };
}
async function _createHexAt(x,y){
  const c=snapCenter(x,y);
  const data=buildHexData(c);
  const [doc] = await canvas.scene.createEmbeddedDocuments("Drawing",[data]);
  await applyStyle(doc);
  return doc;
}

/* ---------------- Toolbar ---------------- */
function toolbarHTML(){
  return `
  <div id="${TOOLBAR_ID}" style="position:fixed; left:60px; top:60px; z-index:1000;">
    <div class="bbttcc-toolbar" style="min-width:220px; padding:.4rem .5rem; background:#1118; border:1px solid #444; border-radius:10px;">
      <div class="bbttcc-toolbar-handle" style="cursor:move; user-select:none; display:flex; align-items:center; gap:.5rem;">
        <i class="fas fa-grip-lines"></i><strong>BBTTCC</strong>
        <span style="flex:1;"></span>
        <button type="button" data-action="reset-pos" title="Reset toolbar"><i class="fas fa-undo"></i></button>
      </div>
      <div style="display:flex; gap:.35rem; margin-top:.35rem; flex-wrap:wrap;">
        <button type="button" data-action="territory-dashboard"><i class="fas fa-th-large"></i> Dashboard</button>
        <button type="button" data-action="create-hex"><i class="fas fa-draw-polygon"></i> Create Hex</button>
        <button type="button" data-action="campaign-overview"><i class="fas fa-list"></i> Overview</button>
      </div>
    </div>
  </div>`;
}
function ensureToolbar(){
  let el=document.getElementById(TOOLBAR_ID);
  if (!el) {
    document.body.insertAdjacentHTML("beforeend", toolbarHTML());
    el=document.getElementById(TOOLBAR_ID);
    const handle=el.querySelector(".bbttcc-toolbar-handle");
    let drag=false,sx=0,sy=0,pid;
    handle.addEventListener("pointerdown", e=>{
      drag=true; const r=el.getBoundingClientRect();
      sx=(e.clientX??0)-r.left; sy=(e.clientY??0)-r.top; pid=e.pointerId; el.setPointerCapture?.(pid);
    });
    window.addEventListener("pointermove", e=>{
      if (!drag) return; el.style.left=`${Math.max(0,(e.clientX??0)-sx)}px`; el.style.top=`${Math.max(0,(e.clientY??0)-sy)}px`;
    });
    window.addEventListener("pointerup", ()=>{ drag=false; if (pid) el.releasePointerCapture?.(pid); });
    el.addEventListener("click", e=>{
      const btn = e.target.closest("button[data-action]"); if (!btn) return;
      onAction(btn.dataset.action);
    });
  }
}

/* ---------------- Placement flow ---------------- */
let placing=false;
function endPlacement(){ placing=false; try{ canvas.stage.off?.("pointerdown", onDown);}catch{} window.removeEventListener("keydown", onEsc, {capture:true}); ui.notifications?.info?.("Hex placement ended."); }
function onEsc(e){ if (e.key==="Escape") endPlacement(); }
async function onDown(ev){
  if (!placing) return; endPlacement();
  try {
    const w=worldFromEvent(ev);
    const doc=await game.bbttcc.api.territory._createHexInternal(w.x,w.y);
    if (doc?.uuid) await openHexEditorByUuid(doc.uuid);
    ui.notifications?.info?.("Hex created.");
  } catch(err){
    console.error(`[${MOD}] hex create failed`, err);
    ui.notifications?.error?.("Failed to create hex.");
  }
}
function beginPlaceHex(){ if (placing) return; placing=true; ui.notifications?.info?.("Click anywhere to place a hex (Esc to cancel)."); window.addEventListener("keydown", onEsc, {capture:true}); canvas.stage.on?.("pointerdown", onDown, {once:true}); }

/* ---------------- Toolbar actions ---------------- */
async function onAction(action){
  const api = game?.bbttcc?.api?.territory ?? {};
  if (action==="reset-pos") {
    const el=document.getElementById(TOOLBAR_ID); if (el){ el.style.left="60px"; el.style.top="60px"; }
    return ui.notifications?.info?.("Toolbar reset.");
  }
  if (action==="territory-dashboard") {
    const ctor = globalThis.BBTTCC_TerritoryDashboardCtor || api._dashboardCtor;
    if (typeof ctor !== "function") return ui.notifications?.warn?.("Dashboard unavailable.");
    (globalThis.__bbttcc_dashboard ??= new ctor()).render(true, { focus:true });
  }
  if (action==="campaign-overview") {
    if (typeof api.openCampaignOverview==="function") return api.openCampaignOverview();
    return ui.notifications?.warn?.("Campaign Overview unavailable.");
  }
  if (action==="create-hex") {
    if (typeof api.createHexAt!=="function") return ui.notifications?.warn?.("createHexAt API unavailable.");
    beginPlaceHex();
  }
}

/* ---------------- Ready ---------------- */
Hooks.once("ready", ()=>{
  ensureToolbar();
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.territory ??= {};

  game.bbttcc.api.territory._createHexInternal = _createHexAt;
  game.bbttcc.api.territory.createHexAt = async (a,b)=>{
    let x,y; if (typeof a==="object") ({x,y}=a); else { x=a; y=b; }
    const doc=await _createHexAt(x,y); if (doc?.uuid) await openHexEditorByUuid(doc.uuid); return doc;
  };
  game.bbttcc.api.territory.openHexConfig = (uuid)=> openHexEditorByUuid(uuid);
  game.bbttcc.api.territory.claim        = (uuid)=> openHexEditorByUuid(uuid);
});
