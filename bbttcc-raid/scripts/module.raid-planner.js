// modules/bbttcc-raid/scripts/module.raid-planner.js
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
const factionList = ()=> (game.actors?.contents??[])
  .filter(isFaction)
  .sort((a,b)=>a.name.localeCompare(b.name));

function detectHexLike(doc){
  const f = doc?.getFlag?.(TERR_ID) || doc?.flags?.[TERR_ID] || {};
  if (f.isHex === true || String(f.kind||"").toLowerCase()==="territory-hex") return true;
  const shape = doc?.shape ?? doc?.object?.shape;
  if (shape?.type === "p" && Array.isArray(shape.points) && shape.points.length >= 10) return true;
  return false;
}

function listSceneHexes(){
  const out=[]; const sc=canvas?.scene; if(!sc) return out;
  for(const d of sc.drawings?.contents??[]){
    if(!detectHexLike(d)) continue;
    const f=d.getFlag?.(TERR_ID)||{};
    out.push({
      uuid: d.uuid,
      id: d.id,
      name: f?.name || d.text || `Hex ${d.id}`,
      ownerId: f?.factionId || f?.ownerId || "",
      source: "drawing"
    });
  }
  for(const t of sc.tiles?.contents??[]){
    if(!detectHexLike(t)) continue;
    const f=t.getFlag?.(TERR_ID)||{};
    out.push({
      uuid: t.uuid,
      id: t.id,
      name: f?.name || t.id,
      ownerId: f?.factionId || f?.ownerId || "",
      source: "tile"
    });
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}

/* ---------------- Activity Planner (Strategic Turn only) ---------------- */
Hooks.once("init",()=>{
  const App2 = foundry.applications.api.ApplicationV2; if (!App2) return;

  // Human-friendly labels for primary OP categories
  const CATEGORY_LABELS = {
    violence:   "Violence / Military",
    nonLethal:  "Non-Lethal / Security",
    intrigue:   "Intrigue / Espionage",
    economy:    "Economy / Infrastructure",
    softPower:  "Soft Power / Culture",
    diplomacy:  "Diplomacy",
    faith:      "Faith / Spiritual",
    logistics:  "Logistics / Supply",
    culture:    "Culture",
    misc:       "Unsorted"
  };

  // OP display order + icons + nice labels
  const OP_ORDER = ["violence","nonLethal","intrigue","economy","softPower","diplomacy","faith","logistics","culture"];
  const OP_ICONS = {
    violence:   "⚔",
    nonLethal:  "🛡",
    intrigue:   "🕵",
    economy:    "💰",
    softPower:  "🎭",
    diplomacy:  "🕊",
    faith:      "🌞",
    logistics:  "📦",
    culture:    "🎨"
  };
  const OP_LABELS = {
    violence:   "Violence",
    nonLethal:  "Non-Lethal",
    intrigue:   "Intrigue",
    economy:    "Economy",
    softPower:  "Soft Power",
    diplomacy:  "Diplomacy",
    faith:      "Faith",
    logistics:  "Logistics",
    culture:    "Culture"
  };

  function prettifyKey(k){
    return String(k||"")
      .replace(/[_-]/g," ")
      .replace(/\b\w/g,m=>m.toUpperCase());
  }

  function costToString(opCosts) {
    if (!opCosts || typeof opCosts !== "object") return "";
    const parts = [];
    for (const key of OP_ORDER) {
      const v = Number(opCosts[key] || 0);
      if (!v) continue;
      const icon  = OP_ICONS[key]  || "";
      const label = OP_LABELS[key] || prettifyKey(key);
      parts.push(`${icon} ${label} ${v}`);
    }
    return parts.join("   "); // some spacing between costs
  }

  class ActivityPlanner extends App2 {
    static get defaultOptions(){
      return {
        id: "bbttcc-activity-planner",
        title: "Activity Planner",
        width: 640,
        height: 520,
        resizable: true,
        minimizable: true,
        positionable: true,
        classes: ["bbttcc","bbttcc-activity-planner-window"]
      };
    }

    static PARTS = { body:{ template:false } };

    constructor(options={}) {
      super(options);
      this._plannerState = {
        category: "all",
        search: "",
        selectedKey: ""
      };
      this._dragInstalled = false;
    }

    /* ---------- Drag helpers (attach to outer app container) ---------- */
    _installDrag() {
      if (this._dragInstalled) return;
      const outer = this.element?.[0] ?? this.element;
      if (!outer) return;

      let dragging = false;
      let offsetX  = 0;
      let offsetY  = 0;

      const isInteractive = (target) => {
        return !!target.closest("button, input, select, textarea, .bbttcc-activity-row");
      };

      const onDown = (ev) => {
        if (ev.button !== 0) return;
        if (isInteractive(ev.target)) return;   // don't start drag from controls
        dragging = true;
        const rect = outer.getBoundingClientRect();
        offsetX = ev.clientX - rect.left;
        offsetY = ev.clientY - rect.top;
        outer.style.position = "absolute";
        ev.preventDefault();
      };

      const onMove = (ev) => {
        if (!dragging) return;
        const left = ev.clientX - offsetX;
        const top  = ev.clientY - offsetY;
        outer.style.left = `${left}px`;
        outer.style.top  = `${top}px`;
      };

      const onUp = () => { dragging = false; };

      outer.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);

      this._dragInstalled = true;
      log("Activity Planner drag installed (outer container).");
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      this._installDrag();
    }

    /** Build Strategic list from EFFECTS, grouped by primary OP key (Option A) */
    _buildStrategicList(){
      try {
        const raid = game.bbttcc?.api?.raid || {};
        const EFFECTS = raid?.EFFECTS || {};
        const TYPES   = raid?.TYPES || raid?.getTypes?.() || {};
        const raidKeys = new Set(Object.keys(TYPES).map(k=>String(k).toLowerCase()));
        const arr = [];

        for (const [key, v] of Object.entries(EFFECTS)) {
          if (!v || v.kind !== "strategic") continue;
          if (raidKeys.has(String(key).toLowerCase())) continue;

          let label = v.label || prettifyKey(key);
          let primary = v.primaryKey || v.primaryOp || null;
          const opCosts = v.opCosts || {};

          if (!primary && opCosts && typeof opCosts === "object") {
            // pick the largest OP key
            let bestKey = null;
            let bestVal = -Infinity;
            for (const k of Object.keys(opCosts)) {
              const val = Number(opCosts[k] || 0);
              if (val > bestVal) { bestVal = val; bestKey = k; }
            }
            primary = bestKey || "misc";
          }

          if (!primary) primary = "misc";

          arr.push({
            key,
            label,
            primaryKey: primary,
            tier: v.tier ?? null,
            rarity: v.rarity ?? null,
            opCosts,
            text: v.text || ""
          });
        }

        if (arr.length) {
          log(`Loaded ${arr.length} strategic activities from EFFECTS for planner.`);
          return arr;
        }
      } catch (e) {
        warn("Strategic build failed; using fallback.", e);
      }

      // Fallback: TYPES only (no costs)
      try {
        const raid = game.bbttcc?.api?.raid || {};
        const types = raid.getTypes?.() || raid.TYPES || {};
        const list = Object.values(types||{}).map(t=>({
          key: t.key,
          label: t.label || prettifyKey(t.key),
          primaryKey: t.primaryKey || "violence",
          tier: t.tier ?? null,
          rarity: t.rarity ?? null,
          opCosts: {},
          text: ""
        }));
        if (list.length) {
          log(`Loaded ${list.length} activities from TYPES fallback.`);
          return list;
        }
      } catch (e) {
        warn("TYPES fallback build failed", e);
      }

      // Minimal fallback list
      return [
        { key:"develop_infrastructure", label:"Develop Infrastructure", primaryKey:"economy", opCosts:{}, tier:null, rarity:null, text:"" },
        { key:"expand_territory",      label:"Expand Territory",      primaryKey:"violence", opCosts:{}, tier:null, rarity:null, text:"" },
        { key:"cultural_festival",     label:"Cultural Festival",     primaryKey:"softPower", opCosts:{}, tier:null, rarity:null, text:"" },
        { key:"diplomatic_mission",    label:"Diplomatic Mission",    primaryKey:"diplomacy", opCosts:{}, tier:null, rarity:null, text:"" },
        { key:"faith_campaign",        label:"Faith Campaign",        primaryKey:"faith", opCosts:{}, tier:null, rarity:null, text:"" },
        { key:"rearm_forces",          label:"Rearm Forces",          primaryKey:"violence", opCosts:{}, tier:null, rarity:null, text:"" },
        { key:"economic_boom",         label:"Economic Boom",         primaryKey:"economy", opCosts:{}, tier:null, rarity:null, text:"" }
      ];
    }

    _buildCategories(activities) {
      const cats = new Set();
      for (const a of activities) {
        if (!a.primaryKey) continue;
        cats.add(String(a.primaryKey));
      }
      return ["all", ...Array.from(cats).sort()];
    }

    async _renderInner(){
      const wrap = document.createElement("section");
      wrap.className = "bbttcc-activity-planner";
      wrap.style.padding = "10px 12px";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.height = "100%";
      wrap.style.boxSizing = "border-box";

      const facs  = factionList();
      const hexes = listSceneHexes();
      const acts  = this._buildStrategicList();

      const categories = this._buildCategories(acts);
      const currentCat = this._plannerState.category || "all";
      const searchTerm = (this._plannerState.search || "").toLowerCase();

      const filtered = acts.filter(a => {
        if (currentCat !== "all" && String(a.primaryKey) !== currentCat) return false;
        if (searchTerm) {
          const hay = `${a.label} ${a.key}`.toLowerCase();
          if (!hay.includes(searchTerm)) return false;
        }
        return true;
      });

      // --- Top: Faction + Hex ---
      const top = document.createElement("div");
      top.style.display = "grid";
      top.style.gridTemplateColumns = "1fr 1fr";
      top.style.gap = "6px 10px";
      top.style.marginBottom = "8px";

      const mkLabel = (txt) => {
        const l = document.createElement("label");
        l.textContent = txt;
        l.style.fontSize = "0.8rem";
        l.style.fontWeight = "600";
        return l;
      };

      const facSel = document.createElement("select");
      facSel.style.width = "100%";
      facSel.style.padding = "2px 4px";
      for (const f of facs) {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = f.name;
        facSel.appendChild(opt);
      }

      const hexRow = document.createElement("div");
      hexRow.style.display = "flex";
      hexRow.style.gap = "4px";

      const hexSel = document.createElement("select");
      hexSel.style.flex = "1 1 auto";
      hexSel.style.padding = "2px 4px";
      for (const h of hexes) {
        const opt = document.createElement("option");
        opt.value = h.uuid;
        opt.textContent = h.name;
        hexSel.appendChild(opt);
      }

      const pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.textContent = "Pick Hex";
      pickBtn.dataset.act = "pick";
      pickBtn.style.flex = "0 0 auto";
      pickBtn.style.padding = "2px 8px";
      pickBtn.style.fontSize = "0.75rem";

      top.appendChild(mkLabel("Faction"));
      top.appendChild(mkLabel("Target Hex"));
      top.appendChild(facSel);
      hexRow.appendChild(hexSel);
      hexRow.appendChild(pickBtn);
      top.appendChild(hexRow);

      wrap.appendChild(top);

      // --- Middle: Categories + Activities ---
      const mid = document.createElement("div");
      mid.style.display = "grid";
      mid.style.gridTemplateRows = "auto auto 1fr auto";
      mid.style.gap = "4px";
      mid.style.flex = "1 1 auto";
      mid.style.minHeight = "0";

      // Category chips
      const catRow = document.createElement("div");
      catRow.style.display = "flex";
      catRow.style.flexWrap = "wrap";
      catRow.style.gap = "4px";

      for (const cat of categories) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.cat = cat;
        btn.dataset.act = "filter-cat";
        btn.textContent = cat === "all" ? "All" : (CATEGORY_LABELS[cat] || prettifyKey(cat));
        btn.style.fontSize = "0.7rem";
        btn.style.padding = "2px 6px";
        btn.style.borderRadius = "999px";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
        btn.style.background = (cat === currentCat) ? "#1f2937" : "#111827";
        btn.style.color = "#e5e7eb";
        catRow.appendChild(btn);
      }

      // Search
      const searchRow = document.createElement("div");
      searchRow.style.display = "flex";
      searchRow.style.gap = "4px";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.value = this._plannerState.search || "";
      searchInput.placeholder = "Search activities…";
      searchInput.dataset.role = "search";
      searchInput.style.flex = "1 1 auto";
      searchInput.style.padding = "2px 6px";
      searchInput.style.fontSize = "0.8rem";
      searchRow.appendChild(searchInput);

      // Activity list
      const listBox = document.createElement("div");
      listBox.style.flex = "1 1 auto";
      listBox.style.minHeight = "0";
      listBox.style.maxHeight = "320px";     // ensure internal scroll
      listBox.style.overflowY = "auto";      // scrolling
      listBox.style.border = "1px solid #374151";
      listBox.style.borderRadius = "6px";
      listBox.style.padding = "4px 4px";
      listBox.style.background = "rgba(15,23,42,0.95)";

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.textContent = "No activities match this filter.";
        empty.style.fontSize = "0.8rem";
        empty.style.opacity = "0.8";
        listBox.appendChild(empty);
      } else {
        for (const a of filtered) {
          const row = document.createElement("div");
          row.className = "bbttcc-activity-row";
          row.dataset.key = a.key;
          row.dataset.act = "select-activity";
          row.style.display = "flex";
          row.style.flexDirection = "column";
          row.style.padding = "3px 4px";
          row.style.marginBottom = "2px";
          row.style.borderRadius = "4px";
          row.style.cursor = "pointer";
          row.style.fontSize = "0.8rem";
          row.title = a.text || ""; // tooltip

          const isSelected = (this._plannerState.selectedKey === a.key);
          row.style.background = isSelected ? "#1d4ed8" : "transparent";
          row.style.color      = isSelected ? "#f9fafb" : "#e5e7eb";

          const topLine = document.createElement("div");
          topLine.style.display = "flex";
          topLine.style.justifyContent = "space-between";
          topLine.style.alignItems = "center";

          const labelSpan = document.createElement("span");
          labelSpan.textContent = a.label;
          labelSpan.style.fontWeight = "600";

          const metaSpan = document.createElement("span");
          metaSpan.style.fontSize = "0.7rem";
          metaSpan.style.opacity = "0.85";
          const catLabel = a.primaryKey ? (CATEGORY_LABELS[a.primaryKey] || prettifyKey(a.primaryKey)) : null;
          const pieces = [];
          if (catLabel) pieces.push(catLabel);
          if (a.tier != null) pieces.push(`T${a.tier}`);
          if (a.rarity)      pieces.push(String(a.rarity));
          metaSpan.textContent = pieces.join(" • ") || "Unsorted";

          topLine.appendChild(labelSpan);
          topLine.appendChild(metaSpan);
          row.appendChild(topLine);

          const costLineStr = costToString(a.opCosts);
          if (costLineStr) {
            const costLine = document.createElement("div");
            costLine.textContent = costLineStr;
            costLine.style.fontSize = "0.7rem";
            costLine.style.opacity = "0.9";
            costLine.style.marginTop = "1px";
            row.appendChild(costLine);
          }

          listBox.appendChild(row);
        }
      }

      // Note field
      const noteWrap = document.createElement("div");
      noteWrap.style.marginTop = "4px";

      const noteLabel = mkLabel("Note (optional)");
      const noteInput = document.createElement("input");
      noteInput.type = "text";
      noteInput.placeholder = "GM note or context for this planned activity.";
      noteInput.dataset.role = "note";
      noteInput.style.width = "100%";
      noteInput.style.padding = "2px 6px";
      noteInput.style.fontSize = "0.8rem";

      noteWrap.appendChild(noteLabel);
      noteWrap.appendChild(noteInput);

      mid.appendChild(catRow);
      mid.appendChild(searchRow);
      mid.appendChild(listBox);
      mid.appendChild(noteWrap);

      wrap.appendChild(mid);

      // --- Bottom buttons ---
      const bottom = document.createElement("div");
      bottom.style.display = "flex";
      bottom.style.justifyContent = "flex-end";
      bottom.style.gap = "6px";
      bottom.style.marginTop = "8px";

      const planBtn = document.createElement("button");
      planBtn.type = "button";
      planBtn.dataset.act = "plan";
      planBtn.textContent = "Plan Activity";
      planBtn.style.padding = "4px 10px";
      planBtn.style.fontSize = "0.8rem";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.dataset.act = "cancel";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.padding = "4px 10px";
      cancelBtn.style.fontSize = "0.8rem";

      bottom.appendChild(cancelBtn);
      bottom.appendChild(planBtn);
      wrap.appendChild(bottom);

      // --- Event wiring ---
      let picking = false;
      const endPick = () => {
        picking = false;
        canvas?.stage?.off?.("pointerdown", onPick);
        pickBtn.classList.remove("active");
      };

      const onPick = async (ev) => {
        if (!picking) return;
        const pt = ev.data?.global;
        if (!pt) return;
        const cand = listSceneHexes();
        let chosen = null;
        for (const h of cand) {
          const doc = await fromUuid(h.uuid).catch(()=>null);
          const obj = doc?.object;
          if (obj?.hitArea?.contains?.(pt.x, pt.y) || obj?.bounds?.contains?.(pt.x, pt.y)) {
            chosen = h;
            break;
          }
        }
        if (chosen) {
          hexSel.value = chosen.uuid;
          ui.notifications?.info?.(`Target: ${chosen.name}`);
          endPick();
        } else {
          ui.notifications?.warn?.("No hex at that point.");
        }
      };

      wrap.addEventListener("click", async (ev) => {
        const act = ev.target?.dataset?.act;
        if (!act) return;

        if (act === "cancel") {
          this.close();
          return;
        }

        if (act === "pick") {
          if (!canvas?.ready) {
            ui.notifications?.warn?.("Canvas not ready.");
            return;
          }
          picking = !picking;
          if (picking) {
            ui.notifications?.info?.("Click a hex on the canvas…");
            pickBtn.classList.add("active");
            canvas.stage.on("pointerdown", onPick);
          } else {
            endPick();
          }
          return;
        }

        if (act === "filter-cat") {
          const cat = ev.target.dataset.cat || "all";
          this._plannerState.category = cat;
          this.render(false);
          return;
        }

        if (act === "select-activity") {
          const key = ev.target.closest(".bbttcc-activity-row")?.dataset?.key;
          if (!key) return;
          this._plannerState.selectedKey = key;
          this.render(false);
          return;
        }

        if (act === "plan") {
          const attackerId = facSel.value;
          const targetUuid = hexSel.value;
          const activityKey = this._plannerState.selectedKey || filtered[0]?.key;
          const note = noteInput.value || "";

          if (!attackerId || !targetUuid || !activityKey) {
            ui.notifications?.warn?.("Select faction, target, and an activity first.");
            return;
          }

          try {
            await game.bbttcc.api.raid.planActivity({ attackerId, targetUuid, activityKey, note });
          } catch (e) {
            console.error(e);
            ui.notifications?.error?.("Failed to plan activity (see console).");
            return;
          }

          ui.notifications?.info?.("Planned activity recorded.");
          this.close();
          return;
        }
      });

      searchInput.addEventListener("input", (ev) => {
        this._plannerState.search = ev.target.value || "";
        this.render(false);
      });

      this.onClose = () => {
        canvas?.stage?.off?.("pointerdown", onPick);
      };

      return wrap;
    }

    async _renderHTML(){
      const html = await this._renderInner();
      return { html, parts:{ body: html } };
    }

    async _replaceHTML(result){
      const node = result?.html ?? result;
      if (node) this.element.replaceChildren(node);
      return this.element;
    }
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
    const entry = {
      ts: Date.now(),
      date: (new Date()).toLocaleString(),
      type: "planned",
      attackerId,
      targetUuid,
      activityKey: act.key,
      summary: `${attacker.name} planned ${act.label} on ${targetName}`,
      note: String(note||"")
    };
    const prev = deepClone(attacker.getFlag(FCT_ID,"warLogs") || []);
    prev.push(entry);
    await attacker.setFlag(FCT_ID,"warLogs", prev);
    log("Planned entry written", entry);
    return entry;
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

    const mk=(act,label,icon,fn)=>{
      if(el.querySelector(`a.bbttcc-btn[data-act="${act}"]`)) return;
      const a=document.createElement("a"); a.className="bbttcc-btn btn"; a.dataset.act=act;
      a.innerHTML=`<i class="fas fa-${icon}"></i><span>${label}</span>`;
      a.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        fn();
      },{capture:true});
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
    globalThis.__bbttccRaidToolbarObserver = obs;
    obs.observe(document.body,{childList:true,subtree:true});
  }

  Hooks.on("canvasReady", () => attach());
});

