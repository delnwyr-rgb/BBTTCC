/* BBTTCC Raid — v1.3.16
 * Features:
 *  - Auto-queue: carry forward last round's Att/Def maneuvers into the new round.
 *  - Stateful maneuvers: Manage panel checkboxes read/write round.mansSelected / mansSelectedDef.
 *  - Live DC projection: defender maneuver +DC is reflected inline immediately.
 *  - OP preview wiring (parity):
 *      • Attacker Manage panel calls game.bbttcc.api.op.preview for staged spend.
 *      • Defender Manage panel calls the same preview for defender spend.
 *
 * Other behavior (commit path, war logs, OP spend) unchanged.
 */

const RAID_ID = "bbttcc-raid";
const TERR_ID = "bbttcc-territory";
const FCT_ID  = "bbttcc-factions";
const TAG = "[bbttcc-raid v1.3.16 hexchrome-op-preview]";

const log  = (...a)=>console.log(TAG, ...a);
const warn = (...a)=>console.warn(TAG, ...a);

// --- Handlebars Helpers -----------------------------------------------------
Hooks.once("init", () => {
  try {
    const H = globalThis.Handlebars; if (!H) return;
    if (!H.helpers.add)      H.registerHelper("add", (a,b)=>Number(a||0)+Number(b||0));
    if (!H.helpers.eq)       H.registerHelper("eq",  (a,b)=>String(a)===String(b));
    if (!H.helpers.default)  H.registerHelper("default",(v,fb)=> (v===undefined||v===null)?fb:v);
    if (!H.helpers.upper)    H.registerHelper("upper",(s)=>String(s||"").toUpperCase());
    if (!H.helpers.lookup)   H.registerHelper("lookup",(o,k)=>o?o[k]:undefined);
  } catch {}
});

// --- Constants & small helpers ---------------------------------------------
const RAID_DIFFICULTIES = {
  easy:    { name:"Easy",    modifier:-2 },
  normal:  { name:"Normal",  modifier: 0 },
  hard:    { name:"Hard",    modifier: 2 },
  extreme: { name:"Extreme", modifier: 5 }
};

const OP_KEYS  = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

// Defender maneuver DC bonuses (mirrors compat PRE_ROLL)
const DEFENDER_DC_MAP = {
  defensive_entrenchment: 3,
  quantum_shield: 3,
  counter_propaganda_wave: 2
};

const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));
const randid=()=> (globalThis.crypto?.randomUUID?.() || (typeof randomID==="function"?randomID():Math.random().toString(36).slice(2)));
function lcKeys(obj){ const o={}; for (const [k,v] of Object.entries(obj||{})) o[String(k).toLowerCase()]=Number(v||0); return o; }
function textForSpend(sum){ return Object.keys(sum).length ? Object.entries(sum).map(([k,v])=>`${k}:${v}`).join(", ") : "—"; }

function isFaction(a){
  if (!a) return false;
  try {
    if (a.getFlag?.(FCT_ID,"isFaction") === true) return true;
    const t = (foundry.utils.getProperty(a,"system.details.type.value") ?? "").toString().toLowerCase();
    if (t === "faction") return true;
    const cls = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls||"").includes("BBTTCCFactionSheet");
  } catch { return false; }
}

function categoryTotal(faction, key) {
  key = key.toLowerCase();
  const opsFlags = foundry.utils.duplicate(faction.getFlag(FCT_ID,"ops") || {});
  const base = Number(opsFlags?.[key]?.value ?? 0);
  return base;
}

function _zeroOps(){ const b={}; for (const k of OP_KEYS) b[k]=0; return b; }

function getOPBank(actor){
  const flags = foundry.utils.duplicate(actor?.flags?.[FCT_ID] ?? {});
  const b = flags.opBank || {};
  for (const k of OP_KEYS) b[k] = Number(b[k]||0);
  return b;
}

// --- Hex helpers ------------------------------------------------------------
function isHexDrawing(d) {
  const doc = d?.document ?? d;
  const f = doc?.flags?.[TERR_ID] ?? {};
  if (f.isHex === true) return true;
  if (String(f.kind||"").toLowerCase() === "territory-hex") return true;
  const sh = doc?.shape ?? d?.shape;
  const n = Array.isArray(sh?.points) ? sh.points.length : 0;
  return sh?.type === "p" && n >= 10;
}

async function pickTargetHex({ prompt="Click a BBTTCC hex…" } = {}) {
  if (!canvas?.ready) { ui.notifications?.error?.("Canvas not ready."); return null; }
  const note = ui.notifications?.info?.(prompt, {permanent:true});
  const res = await new Promise((resolve) => {
    const once = (ev) => {
      try {
        canvas.stage.off("pointerdown", once);
        const fed = ev?.data ?? ev;
        const pt = fed?.global ? { x: fed.global.x, y: fed.global.y } : (canvas.mousePosition ?? {x:0,y:0});
        const list = canvas?.drawings?.placeables ?? [];
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i]; if (!isHexDrawing(p)) continue;
          const local = p.toLocal(new PIXI.Point(pt.x, pt.y));
          if (p.hitArea?.contains?.(local.x, local.y))
            return resolve({ drawing: p.document, uuid: p.document.uuid, flags: foundry.utils.duplicate(p.document.flags?.[TERR_ID] ?? {}) });
          const sh = p.document.shape;
          if (sh?.type === "p" && Array.isArray(sh.points) && new PIXI.Polygon(sh.points).contains(local.x, local.y))
            return resolve({ drawing: p.document, uuid: p.document.uuid, flags: foundry.utils.duplicate(p.document.flags?.[TERR_ID] ?? {}) });
        }
        ui.notifications?.warn?.("No BBTTCC hex under cursor."); resolve(null);
      } catch (e) { resolve(null); }
      finally { try { note?.remove?.(); } catch {} }
    };
    canvas.stage.on("pointerdown", once);
  });
  return res;
}

// --- Raid activity + EFFECTS helpers ----------------------------------------
function getRaidTypes(){
  try {
    const api = game.bbttcc?.api?.raid;
    const TYPES = typeof api?.getTypes === "function" ? api.getTypes() : (api?.TYPES || {});
    const list = Object.values(TYPES || {});
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  return [
    { key:"assault",      label:"Assault",      primaryKey:"violence"  },
    { key:"infiltration", label:"Infiltration", primaryKey:"intrigue"  }
  ];
}

function primaryKeyFor(activityKey){
  const act = getRaidTypes().find(a=>a.key===activityKey);
  return act?.primaryKey || "violence";
}

function _effectsMans() {
  const EFFECTS = (game.bbttcc?.api?.raid?.EFFECTS) || {};
  const out = {};
  for (const [k,v] of Object.entries(EFFECTS)) {
    if (v?.kind !== "maneuver") continue;
    out[k] = { key:k, label:String(v?.label||k).trim(), cost:v?.cost||{}, benefit:v?.benefit||{} };
  }
  return out;
}

/** Heuristic: derive a dominant OP key from a cost object (used to auto-slot new maneuvers) */
function _dominantOp(cost){
  if (!cost || typeof cost!=="object") return null;
  const OPK = OP_KEYS;
  let best=null, bestV=-Infinity;
  for (const k of OPK){
    const v = Number(cost?.[k]||0);
    if (v>bestV){ bestV=v; best=k; }
  }
  return (bestV>0)?best:null;
}

function lcKeysCost(cost){
  const op={}, stock={};
  if (!cost) return {op, stock};
  if (cost.op || cost.stockpile){
    const opA = lcKeys(cost.op||{});
    const stA = lcKeys(cost.stockpile||{});
    for (const [k,v] of Object.entries(opA)) if (OP_KEYS.includes(k)) op[k]=(op[k]||0)+v; else stock[k]=(stock[k]||0)+v;
    for (const [k,v] of Object.entries(stA)) stock[k]=(stock[k]||0)+v;
    return {op, stock};
  }
  const flat = lcKeys(cost);
  for (const [k,v] of Object.entries(flat)){ if (OP_KEYS.includes(k)) op[k]=(op[k]||0)+v; else stock[k]=(stock[k]||0)+v; }
  return {op, stock};
}

// curated + dynamic maneuver lists
const _MAN_KEYS_BY_TYPE = {
  assault: ["suppressive_fire","rally_the_line","patch_the_breach","saboteurs_edge","command_overdrive","echo_strike_protocol","quantum_shield","overclock_the_golems","ego_breaker","qliphothic_gambit","moral_high_ground","counter_propaganda_wave","logistical_surge","sephirotic_intervention"],
  infiltration: ["smoke_and_mirrors","saboteurs_edge","psychic_disruption","reality_hack","overclock_the_golems","flash_bargain","spy_network"],
  occupation: ["suppressive_fire","patch_the_breach","logistical_surge","command_overdrive","counter_propaganda_wave","quantum_shield","ego_breaker","rally_the_line"],
  liberation: ["rally_the_line","echo_strike_protocol","moral_high_ground","unity_surge","sephirotic_intervention","command_overdrive","flash_bargain","counter_propaganda_wave"],
  propaganda: ["smoke_and_mirrors","flash_bargain","moral_high_ground","counter_propaganda_wave","unity_surge"],
  blockade: ["logistical_surge","overclock_the_golems"],
  espionage: ["smoke_and_mirrors","saboteurs_edge","psychic_disruption","overclock_the_golems","reality_hack","flash_bargain","spy_network"],
  ritual: ["bless_the_fallen","psychic_disruption","quantum_shield","moral_high_ground","sephirotic_intervention","unity_surge","qliphothic_gambit","reality_hack"],
  assault_defense: ["patch_the_breach","quantum_shield","rally_the_line","defensive_entrenchment"],
  any: ["supply_surge","divine_favor"]
};

function _mansForType(type){
  const eff = _effectsMans();
  let ext = {};
  try { ext = (game.bbttcc?.api?.raid?.getManeuvers?.(type)) || {}; } catch {}

  const keys = (_MAN_KEYS_BY_TYPE[type] || _MAN_KEYS_BY_TYPE.any || []).slice();
  const res = {};
  const add = (k)=>{
    if (!k || res[k]) return;
    const e = eff[k], x = ext[k];
    if (!e && !x) return;
    res[k] = { key:k, label:(e?.label||x?.label||k), cost:(e?.cost||x?.cost||{}), benefit:(e?.benefit||x?.benefit||{}) };
  };
  keys.forEach(add); Object.keys(ext).forEach(add);

  // pull in EFFECTS-based matches by raidTypes or dominant OP
  const pKey = primaryKeyFor(type);
  for (const [k,e] of Object.entries(eff)){
    if (res[k]) continue;
    const rtypes = Array.isArray(e.raidTypes) ? e.raidTypes : (e.raidTypes ? [e.raidTypes] : []);
    const applies = rtypes.includes(type) || rtypes.includes("any") || (_dominantOp(e.cost) === pKey);
    if (applies) add(k);
  }

  // if still empty, just expose all maneuvers
  if (!Object.keys(res).length){
    for (const k of Object.keys(eff)) add(k);
  }
  return res;
}

function _mansForTypeDefense(typeKey){
  const defKey = `${typeKey}_defense`;
  const def = _mansForType(defKey);
  const base = _mansForType(typeKey);

  const eff = _effectsMans();
  const defenseAdds = {};
  for (const [k,e] of Object.entries(eff)){
    if (e?.defenderAccess === true){ defenseAdds[k]=true; }
  }

  const out = { ...def, ...base };
  for (const k of Object.keys(defenseAdds)){ if (!out[k]) out[k] = eff[k]; }
  return out;
}

// --- Core math helpers ------------------------------------------------------
async function computeDryRun(attacker, { activityKey="assault", difficulty="normal" } = {}, baseDC) {
  const key = primaryKeyFor(activityKey);
  const attBonus = categoryTotal(attacker, key);
  const diffAdj  = Number(RAID_DIFFICULTIES[difficulty]?.modifier ?? 0);
  const DC       = Math.max(0, Number(baseDC||0) + diffAdj);
  const roll = new Roll("1d20 + @b", { b: attBonus });
  await roll.evaluate();
  const total  = roll.total;
  const outcome = (total >= DC + 5) ? "Great Success" : (total >= DC) ? "Success" : "Fail";
  return { key, attBonus, baseDC:Number(baseDC||0), diffAdj, DC, roll, total, outcome };
}

function buildRaidWarLog(side, round, { ts, dateStr, oppName, totalFinal=0, dcFinal=0, spentLine="" }) {
  const diffName  = RAID_DIFFICULTIES[round.difficulty]?.name ?? round.difficulty;
  const povAction = round.activityLabel || round.activityKey || "Activity";
  const vs        = (side === "att") ? (round.targetName || oppName || "—") : (round.attackerName || oppName || "—");
  const mansAtt   = Array.isArray(round.mansSelected) ? round.mansSelected : [];
  const mansDef   = Array.isArray(round.mansSelectedDef) ? round.mansSelectedDef : [];
  const mansLine  = (mansAtt.length || mansDef.length)
    ? `; Mans(Att): ${mansAtt.join(", ") || "—"}; Mans(Def): ${mansDef.join(", ") || "—"}`
    : "";
  const summary   = `${povAction} vs ${vs} — ${diffName}; roll ${round.roll?.result ?? "—"} → ${totalFinal} vs DC ${dcFinal}${spentLine}${mansLine}`;
  return {
    ts, date: dateStr, type: "raid", side,
    opponent: oppName || (side==="att" ? round.targetName : round.attackerName) || "",
    outcome: (totalFinal >= dcFinal) ? "win" : "loss",
    summary, activityKey: round.activityKey, difficulty: round.difficulty,
    targetUuid: round.targetUuid, targetName: round.targetName,
    total: Number(totalFinal || 0), dc: Number(dcFinal || 0),
    attackerBonus: Number(round.attBonus || 0)
  };
}

// --- AppV2 wiring -----------------------------------------------------------
const _appApi = foundry?.applications?.api || {};
const AppV2   = _appApi.ApplicationV2 || Application;
const HBM     = _appApi.HandlebarsApplicationMixin || ((Base)=>class extends Base{});

class BBTTCC_RaidConsole extends HBM(AppV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-raid-console",
    title: "BBTTCC — Raid Console",
    classes: ["bbttcc","bbttcc-raid-console","bbttcc-raid-planner"],
    width: 980, height: 720, resizable: true, minimizable: true, positionOrtho: true
  };
  static PARTS = { body: { template: "modules/bbttcc-raid/templates/raid-console.hbs" } };

  vm = { attackerId:"", activityKey:"assault", difficulty:"normal", targetName:"—", targetUuid:"", rounds:[], logWar:false, includeDefender:true };

  _activities(){ return getRaidTypes(); }
  _activityFor(key){ return this._activities().find(a=>a.key===key) || { key, label:key, primaryKey:"violence" }; }

  _mansForActivity(key){ return _mansForType(key); }
  _mansForDefense(key){ return _mansForTypeDefense(key); }

  /** Render Manage panel and wire live behavior (attacker + defender preview) */
  _renderManeuversInto(tr, round){
    try {
      const host = tr.querySelector(".bbttcc-mans-cell"); if (!host) return;
      host.innerHTML = "";

      const mapAtt = this._mansForActivity(round.activityKey);
      const mapDef = this._mansForDefense(round.activityKey);
      const keysA = Object.keys(mapAtt), keysD = Object.keys(mapDef);
      if (!keysA.length && !keysD.length) { host.innerHTML = `<em>No maneuvers for this activity.</em>`; return; }

      // ensure arrays exist on the round model (so re-renders never lose picks)
      round.mansSelected    = Array.isArray(round.mansSelected)    ? round.mansSelected    : [];
      round.mansSelectedDef = Array.isArray(round.mansSelectedDef) ? round.mansSelectedDef : [];

      const wrap = document.createElement("div");
      wrap.style.display="grid"; wrap.style.gridTemplateColumns="1fr 1fr"; wrap.style.gap=".5rem";

      const mkFS = (label, keys, map, side) => {
        const fs = document.createElement("fieldset"); fs.className="bbttcc-mans";
        const lg = document.createElement("legend"); lg.textContent = `${label} Maneuvers`; fs.appendChild(lg);

        const grid = document.createElement("div");
        grid.className = "mans-wrap";
        grid.style.display="grid"; grid.style.gridTemplateColumns="1fr 1fr"; grid.style.gap=".25rem .5rem";

        const mkCost = (cost)=>{
          const {op} = lcKeysCost(cost);
          const parts=[]; for (const [ck,cv] of Object.entries(op||{})){ if(!cv) continue; parts.push(`${ck}:${cv}`); }
          return parts.length? ` <small style="opacity:.8;">(OP ${parts.join(", ")})</small>` : "";
        };

        for (const k of keys){
          const m = map[k];
          const id = `m-${side}-${round.roundId}-${k}`;
          const checked = (side==="def" ? round.mansSelectedDef : round.mansSelected).includes(k);
          const lbl = document.createElement("label");
          lbl.style.display="flex"; lbl.style.alignItems="center"; lbl.style.gap=".25rem";
          lbl.innerHTML = `<input type="checkbox" ${checked?"checked":""} data-maneuver="${k}" data-side="${side}" id="${id}"><span title="${m?.label||k}">${m?.label||k}</span>${mkCost(m?.cost)}`;
          grid.appendChild(lbl);
        }

        fs.appendChild(grid);
        return fs;
      };

      const fsA = mkFS("Attacker", keysA, mapAtt, "att");
      const fsD = mkFS("Defender", keysD, mapDef, "def");
      wrap.appendChild(fsA);
      wrap.appendChild(fsD);

      const projBox = document.createElement("div");
      projBox.className = "bbttcc-proj-spend";
      projBox.style.marginTop=".35rem";
      projBox.style.gridColumn="1 / span 2";
      projBox.innerHTML = `
        <small><i>Projected OP Spend (Att):</i> <b><span data-proj-att></span></b></small>
        <br/><small style="opacity:.85;"><i>Defender OP Spend:</i> <b><span data-proj-def></span></b></small>
        <br/><small style="opacity:.85;"><i>Attacker Bank After (Preview):</i> <b><span data-op-after-att></span></b></small>
        <br/><small style="opacity:.85;"><i>Defender Bank After (Preview):</i> <b><span data-op-after-def></span></b></small>
        <br/><small style="opacity:.85; color:#f97373;" data-op-error-att></small>
        <br/><small style="opacity:.85; color:#f97373;" data-op-error-def></small>`;
      host.appendChild(wrap);
      host.appendChild(projBox);

      const dcHost = tr.parentElement?.querySelector("small")?.parentElement;
      if (dcHost && !dcHost.querySelector("[data-proj-inline]")) {
        const inline = document.createElement("div");
        inline.style.marginTop=".25rem";
        inline.innerHTML = `
          <small><i>Projected OP Spend (Att):</i> <b><span data-proj-inline></span></b></small>
          <br/><small style="opacity:.85;"><i>Defender OP Spend:</i> <b><span data-proj-inline-def></span></b></small>
          <br/><small style="opacity:.75;"><i>Attacker Bank After (Preview):</i> <b><span data-op-after-inline></span></b></small>
          <br/><small style="opacity:.75;"><i>Defender Bank After (Preview):</i> <b><span data-op-after-inline-def></span></b></small>
          <br/><small style="opacity:.78; color:#f97373;" data-op-error-inline></small>
          <br/><small style="opacity:.78; color:#f97373;" data-op-error-inline-def></small>`;
        dcHost.appendChild(inline);
      }

      const EFFECTS = (game.bbttcc?.api?.raid?.EFFECTS) || {};

      const findDcCell = () => {
        const row = tr.previousElementSibling; if (!row) return null;
        const headCells = [...tr.closest("table")?.querySelectorAll?.("thead tr:first-child > *") || []];
        let dcIdx = headCells.findIndex(h => /\bdc\b/i.test((h.textContent||"").trim()));
        if (dcIdx < 0) return null;
        let pos = 0;
        for (const td of row.children) {
          const span = Math.max(1, Number(td.colSpan||1));
          const end = pos + span - 1;
          if (dcIdx >= pos && dcIdx <= end) return td;
          pos = end + 1;
        }
        return null;
      };

      // --- Preview helpers ---------------------------------------------------
      const firePreviewAtt = async (sumA) => {
        const previewApi = game.bbttcc?.api?.op?.preview;
        const tgtAfterMain   = host.querySelector("[data-op-after-att]");
        const tgtErrMain     = host.querySelector("[data-op-error-att]");
        const tgtAfterInline = tr.parentElement?.querySelector("[data-op-after-inline]");
        const tgtErrInline   = tr.parentElement?.querySelector("[data-op-error-inline]");

        const clear = () => {
          if (tgtAfterMain)   tgtAfterMain.textContent   = "";
          if (tgtAfterInline) tgtAfterInline.textContent = "";
          if (tgtErrMain)     tgtErrMain.textContent     = "";
          if (tgtErrInline)   tgtErrInline.textContent   = "";
        };

        try {
          if (typeof previewApi !== "function") {
            clear();
            return;
          }

          const entries = Object.entries(sumA || {}).filter(([_,v]) => Number(v||0) > 0);
          if (!entries.length) {
            clear();
            return;
          }

          const attacker = await getActorByIdOrUuid(round.attackerId);
          if (!attacker) {
            clear();
            return;
          }

          const deltas = {};
          for (const [k,v] of entries) {
            const n = Number(v||0); if (!n) continue;
            deltas[String(k).toLowerCase()] = -Math.abs(n);
          }
          if (!Object.keys(deltas).length) {
            clear();
            return;
          }

          const res = await previewApi(attacker.id, deltas, "raid-manage");
          const before = res?.before || {};
          const after  = res?.after  || {};

          const parts = [];
          for (const k of OP_KEYS) {
            const bRaw = before[k];
            const aRaw = after[k];
            if (bRaw === undefined && aRaw === undefined) continue;
            const b = Number(bRaw ?? NaN);
            const a = Number(aRaw ?? NaN);
            if (!Number.isFinite(b) || !Number.isFinite(a)) continue;
            if (b === a) continue;
            const diff = a - b;
            parts.push(`${k}:${a} (${diff>=0?"+":""}${diff})`);
          }

          const afterStr = parts.length ? parts.join(", ") : "—";
          if (tgtAfterMain)   tgtAfterMain.textContent   = afterStr;
          if (tgtAfterInline) tgtAfterInline.textContent = afterStr;

          let errStr = "";
          const shortageParts = [];
          for (const k of OP_KEYS) {
            const aRaw = after[k];
            if (aRaw === undefined) continue;
            const a = Number(aRaw||0);
            if (a < 0) shortageParts.push(`${k} short ${Math.abs(a)}`);
          }
          if (shortageParts.length) {
            errStr = `Not enough OP (Attacker): ${shortageParts.join(", ")}`;
          } else if (res && res.ok === false) {
            errStr = "Not enough OP (Attacker) for this spend.";
          }

          if (tgtErrMain)   tgtErrMain.textContent   = errStr;
          if (tgtErrInline) tgtErrInline.textContent = errStr;
        } catch (e) {
          warn("OP preview (attacker) failed in Raid Console", e);
          clear();
        }
      };

      const firePreviewDef = async (sumD) => {
        const previewApi = game.bbttcc?.api?.op?.preview;
        const tgtAfterMain   = host.querySelector("[data-op-after-def]");
        const tgtErrMain     = host.querySelector("[data-op-error-def]");
        const tgtAfterInline = tr.parentElement?.querySelector("[data-op-after-inline-def]");
        const tgtErrInline   = tr.parentElement?.querySelector("[data-op-error-inline-def]");

        const clear = () => {
          if (tgtAfterMain)   tgtAfterMain.textContent   = "";
          if (tgtAfterInline) tgtAfterInline.textContent = "";
          if (tgtErrMain)     tgtErrMain.textContent     = "";
          if (tgtErrInline)   tgtErrInline.textContent   = "";
        };

        try {
          if (typeof previewApi !== "function") {
            clear();
            return;
          }

          const entries = Object.entries(sumD || {}).filter(([_,v]) => Number(v||0) > 0);
          if (!entries.length) {
            clear();
            return;
          }

          const defender = await getDefenderActorFromRound(round);
          if (!defender) {
            clear();
            return;
          }

          const deltas = {};
          for (const [k,v] of entries) {
            const n = Number(v||0); if (!n) continue;
            deltas[String(k).toLowerCase()] = -Math.abs(n);
          }
          if (!Object.keys(deltas).length) {
            clear();
            return;
          }

          const res = await previewApi(defender.id, deltas, "raid-manage");
          const before = res?.before || {};
          const after  = res?.after  || {};

          const parts = [];
          for (const k of OP_KEYS) {
            const bRaw = before[k];
            const aRaw = after[k];
            if (bRaw === undefined && aRaw === undefined) continue;
            const b = Number(bRaw ?? NaN);
            const a = Number(aRaw ?? NaN);
            if (!Number.isFinite(b) || !Number.isFinite(a)) continue;
            if (b === a) continue;
            const diff = a - b;
            parts.push(`${k}:${a} (${diff>=0?"+":""}${diff})`);
          }

          const afterStr = parts.length ? parts.join(", ") : "—";
          if (tgtAfterMain)   tgtAfterMain.textContent   = afterStr;
          if (tgtAfterInline) tgtAfterInline.textContent = afterStr;

          let errStr = "";
          const shortageParts = [];
          for (const k of OP_KEYS) {
            const aRaw = after[k];
            if (aRaw === undefined) continue;
            const a = Number(aRaw||0);
            if (a < 0) shortageParts.push(`${k} short ${Math.abs(a)}`);
          }
          if (shortageParts.length) {
            errStr = `Not enough OP (Defender): ${shortageParts.join(", ")}`;
          } else if (res && res.ok === false) {
            errStr = "Not enough OP (Defender) for this spend.";
          }

          if (tgtErrMain)   tgtErrMain.textContent   = errStr;
          if (tgtErrInline) tgtErrInline.textContent = errStr;
        } catch (e) {
          warn("OP preview (defender) failed in Raid Console", e);
          clear();
        }
      };

      const recalc = ()=>{
        // 1) OP projections
        const sumA = {}, sumD = {};
        const cat = round.view?.cat || primaryKeyFor(round.activityKey);

        host.querySelectorAll('.mans-wrap input[type="checkbox"][data-maneuver]:checked')
          .forEach(cb=>{
            const eff = EFFECTS[cb.dataset.maneuver]; if (!eff) return;
            const {op} = lcKeysCost(eff.cost);
            const dst = cb.dataset.side==="def" ? sumD : sumA;
            for (const [k,v] of Object.entries(op||{})){
              const kk=String(k).toLowerCase(); dst[kk]=(dst[kk]||0)+Number(v||0);
            }
          });

        const stagedA = Number(round?.localStaged?.att?.[cat]||0);
        const stagedD = Number(round?.localStaged?.def?.[cat]||0);
        if (stagedA>0) sumA[cat]=(sumA[cat]||0)+stagedA;
        if (stagedD>0) sumD[cat]=(sumD[cat]||0)+stagedD;

        const tgtA1 = host.querySelector("[data-proj-att]");       if (tgtA1) tgtA1.textContent = textForSpend(sumA);
        const tgtD1 = host.querySelector("[data-proj-def]");       if (tgtD1) tgtD1.textContent = textForSpend(sumD);
        const tgtA2 = tr.parentElement?.querySelector("[data-proj-inline]");     if (tgtA2) tgtA2.textContent = textForSpend(sumA);
        const tgtD2 = tr.parentElement?.querySelector("[data-proj-inline-def]"); if (tgtD2) tgtD2.textContent = textForSpend(sumD);

        // 2) live defender +DC projection
        let defBonusDC = 0;
        host.querySelectorAll('.mans-wrap input[type="checkbox"][data-side="def"]:checked')
          .forEach(cb => { const k = String(cb.dataset.maneuver||"").toLowerCase(); defBonusDC += Number(DEFENDER_DC_MAP[k]||0); });

        const baseDC = Number(round.DC || 0);
        const stagedBonus = Math.ceil(stagedD / 2);
        const diffAdj = Number(round.diffOffset || 0);
        const facDef = Number(round.view?.facDef || 0);
        const nextB  = Number(round.view?.nextB  || 0);

        const projDC = baseDC + stagedBonus + diffAdj + facDef + nextB + defBonusDC;
        if (typeof round.view === "object") round.view.dcProjected = projDC;

        const dcCell = findDcCell();
        if (dcCell) {
          let holder = dcCell.querySelector("#bbttcc-proj-dc-inline");
          if (!holder) {
            holder = document.createElement("div");
            holder.id = "bbttcc-proj-dc-inline";
            holder.style.cssText = "margin-top:.15rem; font-size:.9em; opacity:.9;";
            dcCell.appendChild(holder);
          }
          holder.textContent = `Projected: ${projDC}`;
        }

        // 3) OP preview for both sides
        firePreviewAtt(sumA);
        firePreviewDef(sumD);
      };

      // Delegate: changes update round.mansSelected / mansSelectedDef + recalc
      if (!host.__bbttccDelegated){
        host.addEventListener("change",(ev)=>{
          const el = ev.target;
          if (!el?.matches?.('.mans-wrap input[type="checkbox"][data-maneuver]')) return;
          const key  = el.dataset.maneuver;
          const side = el.dataset.side==="def" ? "def" : "att";
          const arr  = (side==="def" ? round.mansSelectedDef : round.mansSelected);
          const i = arr.indexOf(key);
          if (el.checked && i<0) arr.push(key);
          if (!el.checked && i>=0) arr.splice(i,1);
          recalc();
        });
        host.__bbttccDelegated = true;
      }

      // initial compute
      recalc();
    } catch(e){ warn("renderMans", e); }
  }

  _collectMans(idx){
    const r = this.vm.rounds[idx] || {};
    if (Array.isArray(r.mansSelected) || Array.isArray(r.mansSelectedDef)) {
      return { att: (r.mansSelected||[]).slice(), def: (r.mansSelectedDef||[]).slice() };
    }

    const row = this.element?.querySelector(`tbody tr[data-idx="${idx}"]`);
    const manage = row?.nextElementSibling;
    const boxes = manage?.querySelectorAll?.('input[type="checkbox"][data-maneuver]');
    const listA = [], listD = [];
    if (boxes) {
      for (const b of boxes) {
        if (!b.checked) continue;
        const side = b.dataset.side === "def" ? "def" : "att";
        (side==="def" ? listD : listA).push(b.dataset.maneuver);
      }
    }
    return { att: listA, def: listD };
  }

  async _preparePartContext(part, context) {
    const facs = (game.actors?.contents ?? []).filter(isFaction).sort((a,b)=>a.name.localeCompare(b.name));
    const attackerOptions = [{ id:"", name:"(select)" }].concat(facs.map(f => ({ id:f.id, name:f.name })));
    const difficulties = Object.entries(RAID_DIFFICULTIES).map(([k,v]) => ({ key:k, label:`${v.name} (${v.modifier>=0?"+":""}${v.modifier})` }));

    const activityOptions = this._activities().map(a => ({ key:a.key, label:a.label }));

    context.vm = this.vm;
    context.attackerOptions = attackerOptions;
    context.difficulties = difficulties;
    context.activityOptions = activityOptions;
    context.hasRounds = Array.isArray(this.vm.rounds) && this.vm.rounds.length>0;

    const attacker = await getActorByIdOrUuid(this.vm.attackerId);
    const target   = this.vm.targetUuid ? await fromUuid(this.vm.targetUuid) : null;
    const defId    = target?.flags?.[TERR_ID]?.factionId || "";
    const defender = defId ? game.actors.get(defId) : null;

    const catTop   = primaryKeyFor(this.vm.activityKey);

    const openRound = (this.vm.rounds || []).find(r => r.open) || null;
    let stagedDTop = 0, diffOffsetTop = 0;
    if (openRound && openRound.localStaged) {
      const k = openRound.view?.cat || primaryKeyFor(openRound.activityKey);
      stagedDTop    = Number(openRound.localStaged?.def?.[k] || 0);
      diffOffsetTop = Number(openRound.diffOffset || 0);
    }
    let baseTop = null, projTop = null, bonusTop = 0, diffTop = 0, facDefTop = 0, nextBTop = 0;
    diffTop = Number(diffOffsetTop || 0);
    if (target && defender) {
      const flags = target?.getFlag?.(TERR_ID) || target?.flags?.[TERR_ID] || {};
      const baseDC = Number(flags?.defense ?? 10);
      bonusTop = Math.ceil(stagedDTop / 2);
      const dflags = defender?.flags?.[FCT_ID] || {};
      facDefTop = Number(dflags?.mods?.defense || 0);
      nextBTop  = Number(dflags?.bonuses?.nextRaid?.defenseBonus || 0);
      baseTop = baseDC;
      projTop = baseDC + bonusTop + diffTop + facDefTop + nextBTop;
    }
    context.currentBank = {
      cat: catTop,
      attacker: attacker ? getOPBank(attacker) : null,
      attackerName: attacker?.name || "(none)",
      defender: defender ? getOPBank(defender) : null,
      defenderName: defender?.name || "(none)",
      hasDef: !!defender,
      topDC: target && defender ? {
        base: baseTop,
        defProjBonus: bonusTop,
        diff: diffTop,
        facDef: facDefTop,
        nextB: nextBTop,
        projected: projTop,
        breakdown: `Base ${baseTop} + Staged/2 ${bonusTop}${diffTop?` + Diff ${diffTop}`:""}${facDefTop?` + Faction ${facDefTop}`:""}${nextBTop?` + Next-Raid ${nextBTop}`:""} = ${projTop}`
      } : null
    };

    for (const r of this.vm.rounds) {
      delete r.view;
      if (!r.open) continue;

      const att = await getActorByIdOrUuid(r.attackerId);
      const tgt = r.targetUuid ? await fromUuid(r.targetUuid) : null;
      const dId = tgt?.flags?.[TERR_ID]?.factionId || "";
      const def = dId ? game.actors.get(dId) : null;

      const cat = primaryKeyFor(r.activityKey);
      const staged = r.localStaged || { att:{}, def:{} };

      const bankAtt = att ? getOPBank(att) : _zeroOps();
      const bankDef = def ? getOPBank(def) : _zeroOps();

      const stagedA = Number(staged?.att?.[cat]||0);
      const stagedD = Number(staged?.def?.[cat]||0);
      const remainA = Math.max(0, Number(bankAtt[cat]||0) - stagedA);
      const remainD = Math.max(0, Number(bankDef[cat]||0) - stagedD);

      const defProjBonus = Math.ceil(stagedD / 2);
      const dflagsR = def?.flags?.[FCT_ID] || {};
      const facDefR = Number(dflagsR?.mods?.defense || 0);
      const nextBR  = Number(dflagsR?.bonuses?.nextRaid?.defenseBonus || 0);
      const diffR   = Number(r.diffOffset || 0);
      const dcProjected = Number(r.DC || 0) + defProjBonus + diffR + facDefR + nextBR;

      r.view = {
        cat, hasDef: !!def,
        staged, bankAtt, bankDef,
        remainA, remainD,
        defProjBonus, dcProjected,
        facDef: facDefR, nextB: nextBR, diff: diffR,
        attackerName: att?.name || "(unknown)",
        defenderName: def?.name || "(none)",
        breakdown: `Base ${Number(r.DC||0)} + Staged/2 ${defProjBonus}${diffR?` + Diff ${diffR}`:""}${facDefR?` + Faction ${facDefR}`:""}${nextBR?` + Next-Raid ${nextBR}`:""} = ${dcProjected}`
      };
    }
    return context;
  }

  _onRender() {
    try {
      const el = this.element;
      if (!this.__centered){
        el.style.left="calc(50% - 490px)";
        el.style.top="72px";
        this.__centered=true;
      }
    } catch {}
    this._bindUI();
    for (let i=0;i<(this.vm.rounds||[]).length;i++){
      const r = this.vm.rounds[i]; if (!r.open) continue;
      const manageRow = this.element?.querySelector(`tbody tr[data-idx="${i}"]`)?.nextElementSibling;
      if (manageRow) this._renderManeuversInto(manageRow, r);
    }
  }

  _bindUI() {
    const $root = $(this.element);
    $root.off(".bbttccRaid");

    $root.on("change.bbttccRaid","[data-id='attacker']", (ev)=>{ this.vm.attackerId = ev.currentTarget.value || ""; this.render(); });
    $root.on("change.bbttccRaid","[data-id='activity']",  (ev)=>{ this.vm.activityKey = ev.currentTarget.value || "assault"; this.render(); });
    $root.on("change.bbttccRaid","[data-id='difficulty']",  (ev)=>{ this.vm.difficulty = ev.currentTarget.value || "normal"; });
    $root.on("change.bbttccRaid","[data-id='logWar']",      (ev)=>{ this.vm.logWar = ev.currentTarget.checked; });
    $root.on("change.bbttccRaid","[data-id='logDef']",      (ev)=>{ this.vm.includeDefender = ev.currentTarget.checked; });

    $root.on("click.bbttccRaid","[data-id='pick-hex']", async (ev)=>{
      ev.preventDefault();
      const sel = await pickTargetHex({ prompt:"Click a BBTTCC hex to raid…" });
      if (!sel) return;
      this.vm.targetUuid = sel.uuid || "";
      this.vm.targetName = (sel.flags?.name || (sel.uuid ? sel.uuid.split(".").pop() : "—"));
      ui.notifications?.info?.(`Target: ${this.vm.targetName}`);
      this.render();
    });

    // Add Round: seed with last round's maneuvers (if any)
    $root.on("click.bbttccRaid","[data-id='add-round']", async (ev)=>{
      ev.preventDefault();
      if (!this.vm.attackerId) return ui.notifications?.warn?.("Pick an attacker faction first.");
      if (!this.vm.targetUuid) return ui.notifications?.warn?.("Pick a target hex first.");

      const attacker = await getActorByIdOrUuid(this.vm.attackerId);
      const target = this.vm.targetUuid ? await fromUuid(this.vm.targetUuid) : null;
      if (!attacker || !target) return;

      const flags = target?.getFlag?.(TERR_ID) || target?.flags?.[TERR_ID] || {};
      const baseDC = Number(flags?.defense ?? 10);
      const comp   = await computeDryRun(attacker, { activityKey:this.vm.activityKey, difficulty:this.vm.difficulty }, baseDC);
      const act    = this._activityFor(this.vm.activityKey);

      const round = {
        ts: Date.now(),
        attackerId: attacker.id, attackerName: attacker.name,
        targetUuid: target.uuid, targetName: (flags?.name || target.text || "Hex"),
        activityKey: act.key, activityLabel: act.label,
        difficulty:this.vm.difficulty, ...comp,
        open:true, roundId:randid(), local:true, localStaged:{ att:{}, def:{} },
        diffOffset: 0,
        mansSelected: [],
        mansSelectedDef: []
      };

      // Auto-queue from last existing round (if present)
      const last = (this.vm.rounds||[]).slice(-1)[0];
      if (last) {
        if (Array.isArray(last.mansSelected))    round.mansSelected    = last.mansSelected.slice();
        if (Array.isArray(last.mansSelectedDef)) round.mansSelectedDef = last.mansSelectedDef.slice();
      }

      // Seed staged attacker OP from plan (unchanged)
      const cat = act.primaryKey;
      const plan = foundry.utils.getProperty(attacker, `flags.${FCT_ID}.raidPlan`) || {};
      const want = Number(plan?.[cat]?.value ?? plan?.[cat] ?? 0) || 0;
      const avail = getOPBank(attacker)?.[cat] || 0;
      const staged = Math.min(Math.max(0, want), avail);
      if (staged > 0) round.localStaged.att[cat] = staged;

      ui.notifications?.info?.(`Imported Raid Plan (${cat}): requested ${want} → staged ${staged} (bank ${avail}).`);
      this.vm.rounds.push(round);
      this.render();
    });

    $root.on("click.bbttccRaid","[data-id='reset']", (ev)=>{
      ev.preventDefault();
      if (!confirm("Clear all rounds in this console?")) return;
      this.vm.rounds = [];
      this.render();
    });

    // Header/table actions
    $root.on("click.bbttccRaid","[data-act]", async (ev)=>{
      ev.preventDefault();
      const btn = ev.currentTarget;
      const idx = Number(btn.closest("tr")?.dataset?.idx ?? -1);
      if (idx < 0) return;
      const act = btn.dataset.act;

      if (act === "manage") { const r=this.vm.rounds[idx]; r.open=!r.open; this.render(); return; }
      if (act === "post")   { return this._postRoundCard(idx); }
      if (act === "del")    { this.vm.rounds.splice(idx,1); this.render(); return; }
      if (act === "commit") { return this._commitRound(idx); }
    });

    // Manage row actions
    $root.on("click.bbttccRaid","[data-manage-act]", async (ev)=>{
      ev.preventDefault();
      const btn = ev.currentTarget;
      const idx = Number(btn.closest("tr")?.dataset?.idx ?? -1);
      if (idx < 0) return;
      const r = this.vm.rounds[idx]; if (!r) return;

      const act = btn.dataset.manageAct;
      if (act === "close")  { r.open = false; return this.render(); }
      if (act === "cancel") { r.cancelled = true; r.open = false; r.mansSelected=[]; r.mansSelectedDef=[]; return this.render(); }
      if (act === "diff")   { const d=Number(btn.dataset.delta||0); r.diffOffset = clamp(Number(r.diffOffset||0)+d,-50,50); return this.render(); }
      if (act === "stage")  { return this._stageOP(idx, btn.dataset); }
      if (act === "commit") { return this._commitRound(idx); }
    });
  }

  async _stageOP(idx, { who, key, delta }){
    const r = this.vm.rounds[idx]; if (!r) return;
    const d = Number(delta||0);
    r.localStaged ||= { att:{}, def:{} };
    const bucket = r.localStaged[who] ||= {};
    const actor = await getActorByIdOrUuid(
      who==="att"
        ? r.attackerId
        : (async ()=>{
            const t = r.targetUuid ? await fromUuid(r.targetUuid) : null;
            return t?.flags?.[TERR_ID]?.factionId || "";
          })()
    );
    const bank  = actor ? getOPBank(actor) : _zeroOps();
    const stagedAlready = Number(bucket[key]||0);
    const remain = Number(bank[key]||0) - stagedAlready;
    if (d>0 && remain<=0) {
      ui.notifications?.warn?.(`${who==="att"?"Attacker":"Defender"} has no ${key} left in OP Turn Bank.`);
      return;
    }
    bucket[key] = Math.max(0, stagedAlready + d);
    return this.render();
  }

  async _postRoundCard(idx){
    const r = this.vm.rounds[idx]; if (!r) return;
    const diffName = RAID_DIFFICULTIES[r.difficulty]?.name ?? r.difficulty;
    const dcShown = (r.dcFinal ?? r.DC) + Number(r.dcFinal ? 0 : (r.diffOffset||0));
    const mansA = (r.mansSelected?.length) ? `<br/><i>Maneuvers (Att):</i> ${r.mansSelected.join(", ")}` : "";
    const mansD = (r.mansSelectedDef?.length) ? `<br/><i>Maneuvers (Def):</i> ${r.mansSelectedDef.join(", ")}` : "";
    const card = `
      <section class="bbttcc-raid">
        <h3 style="margin:0 0 .25rem 0;">BBTTCC — Raid (Round ${idx+1})</h3>
        <p style="margin:.25rem 0;"><strong>Activity:</strong> ${foundry.utils.escapeHTML(r.activityLabel)} • <strong>Difficulty:</strong> ${diffName}${r.diffOffset?` • <strong>Adj:</strong> ${r.diffOffset>0?'+':''}${r.diffOffset}`:''}${mansA}${mansD}</p>
        <table class="bbttcc-table" style="width:100%;">
          <thead><tr><th style="text-align:left;">Attacker</th><th>Target Hex</th><th>Roll</th><th>DC</th><th>Outcome</th></tr></thead>
          <tbody><tr>
            <td>${foundry.utils.escapeHTML(r.attackerName)} <small>(+${r.attBonus} ${r.key})</small></td>
            <td>${foundry.utils.escapeHTML(r.targetName)}</td>
            <td class="center"><code>${r.roll?.result ?? "—"}</code> ${r.total?`= <strong>${r.total}</strong>`:""}</td>
            <td class="center">${dcShown}</td>
            <td class="center"><strong>${r.outcome ?? "—"}</strong></td>
          </tr></tbody>
        </table>
      </section>`;
    ChatMessage.create({ speaker:{alias:"BBTTCC Raid"}, flavor:card, whisper: game.users.filter(u=>u.isGM).map(u=>u.id) });
  }

  async _commitRound(idx){
    const r = this.vm.rounds[idx]; if (!r) return;
    const attacker = await getActorByIdOrUuid(r.attackerId);
    const target   = r.targetUuid ? await fromUuid(r.targetUuid) : null;
    const defId    = target?.flags?.[TERR_ID]?.factionId || "";
    const defender = defId ? game.actors.get(defId) : null;

    const baseBonus = categoryTotal(attacker, r.view?.cat || primaryKeyFor(r.activityKey));

    const listA = Array.isArray(r.mansSelected)    ? r.mansSelected.slice()    : [];
    const listD = Array.isArray(r.mansSelectedDef) ? r.mansSelectedDef.slice() : [];

    const resolver = game.bbttcc?.api?.raid?.resolveRoundWithManeuvers;
    let res = null;
    if (resolver) {
      try {
        res = await resolver({
          attackerId: attacker?.id,
          defenderId: defender?.id || null,
          round: r,
          maneuversAtt: listA,
          maneuversDef: listD
        });
        if (res && res.meta) r.meta = { ...(r.meta||{}), ...res.meta };
        await attacker?.update({}); if (defender) await defender.update({});
      } catch (e) { warn("resolver failed; local fallback", e); res=null; }
    }

    const EFFECTS = (game.bbttcc?.api?.raid?.EFFECTS) || {};
    const cat = r.view?.cat || primaryKeyFor(r.activityKey);
    const manOpA = {}; const manOpD = {};
    const addInto = (dst, src)=>{ for (const [k,v] of Object.entries(src||{})){ const kk=String(k).toLowerCase(); dst[kk]=(dst[kk]||0)+Number(v||0); } };
    for (const key of listA){ const eff = EFFECTS[key]; if (!eff) continue; const {op} = lcKeysCost(eff.cost); addInto(manOpA, op); }
    for (const key of listD){ const eff = EFFECTS[key]; if (!eff) continue; const {op} = lcKeysCost(eff.cost); addInto(manOpD, op); }
    const stagedA = Number(r?.localStaged?.att?.[cat]||0);
    const stagedD = Number(r?.localStaged?.def?.[cat]||0);
    if (stagedA>0) manOpA[cat] = (manOpA[cat]||0)+stagedA;
    if (stagedD>0) manOpD[cat] = (manOpD[cat]||0)+stagedD;

    if (!res || res.spentApplied !== true) {
      await _applyOPDeltaDual(attacker, _negate(manOpA));
      if (defender) await _applyOPDeltaDual(defender, _negate(manOpD));
    }

    let totalFinal, dcFinal, rollUsed;
    if (res && res.totalFinal!=null && res.dcFinal!=null) {
      totalFinal = res.totalFinal; dcFinal = res.dcFinal; rollUsed = res.roll;
    } else {
      const sBonus = Math.ceil((Number(stagedA)||0)/2);
      const dBonus = Math.ceil((Number(stagedD)||0)/2);
      const r1 = new Roll("1d20 + @b + @s", { b: baseBonus, s: sBonus }); await r1.evaluate();
      rollUsed = r1;
      totalFinal = r1.total;
      dcFinal = Number(r.DC||10) + dBonus + Number(r.diffOffset||0);
    }

    try {
      const post = game.bbttcc?.api?.raid?.applyPostRoundEffects;
      if (typeof post === "function") {
        await post({
          attackerId: attacker?.id || null,
          defenderId: defender?.id || null,
          success: (Number(totalFinal||0) >= Number(dcFinal||0)),
          maneuversAtt: listA,
          maneuversDef: listD,
          targetHexId: target?.id || null
        });
      }
    } catch (e) { warn("post-round effects failed", e); }

    const ts = Date.now(), dateStr = new Date(ts).toLocaleString();
    r.roll = rollUsed; r.total = totalFinal; r.dcFinal = dcFinal;
    r.outcome = (totalFinal >= dcFinal + 5) ? "Great Success" : (totalFinal >= dcFinal ? "Success" : "Fail");
    r.open = false; r.committed = true;

    const spentPartsA = Object.entries(manOpA).filter(([_,v])=>v>0).map(([k,v])=>`${k}:${v}`);
    const spentPartsD = Object.entries(manOpD).filter(([_,v])=>v>0).map(([k,v])=>`${k}:${v}`);
    const spentLine =
      (spentPartsA.length ? ` • OP−(Att) ${spentPartsA.join(", ")}` : "") +
      (spentPartsD.length ? ` • OP−(Def) ${spentPartsD.join(", ")}` : "");

    const entry = buildRaidWarLog("att", r, { ts, dateStr, oppName: defender?.name, totalFinal, dcFinal, spentLine });
    await appendWarLog(attacker, entry);
    if (defender && this.vm.includeDefender) {
      const dEntry = { ...entry, side:"def", opponent: r.attackerName || attacker?.name || "", outcome: (totalFinal >= dcFinal ? "loss" : "win") };
      await appendWarLog(defender, dEntry);
    }
    return this.render();
  }
}

// --- Toolbar + API binding --------------------------------------------------
function bindAPI() {
  const mod = game.modules.get(RAID_ID); if (!mod) return;
  let _console = null;
  async function openConsole() { if (!_console) _console = new BBTTCC_RaidConsole(); await _console.render(true, { focus: true }); return _console; }
  const api = { pickTargetHex, openRaidConsole:openConsole, openConsole };
  mod.api = Object.assign(mod.api || {}, api);
  try {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.raid ??= {};
    Object.assign(game.bbttcc.api.raid, api);
  }
  catch(e){ warn("bind game.bbttcc.api.raid", e); }
  log("API ready (v1.3.16).");
}

function attachRaidButtonToToolbar() {
  try {
    const el = document.getElementById("bbttcc-toolbar");
    if (!el) return false;
    if (el.querySelector('a.btn[data-act="raid"]')) return true;
    const rows = el.querySelectorAll(".row");
    const targetRow = rows[1] || rows[0] || el;
    const btn = document.createElement("a");
    btn.className = "btn"; btn.setAttribute("data-act","raid");
    btn.innerHTML = `<i class="fas fa-crosshairs"></i><span>Raid</span>`;
    targetRow.appendChild(btn);
    if (!el.__bbttccRaidClickBound) {
      el.addEventListener("click", async (ev) => {
        const a = ev.target.closest?.('a.btn[data-act="raid"]'); if (!a) return;
        ev.preventDefault();
        try {
          const open = game?.bbttcc?.api?.raid?.openConsole || game.modules.get(RAID_ID)?.api?.openRaidConsole || globalThis.BBTTCC_OpenRaidConsole;
          if (typeof open !== "function") return ui.notifications?.warn?.("BBTTCC Raid Console is not available.");
          await open();
        } catch (e) {
          console.error(TAG, "Toolbar Raid button failed", e);
          ui.notifications?.error?.("Could not open Raid Console — see console.");
        }
      });
      el.__bbttccRaidClickBound = true;
    }
    return true;
  } catch (e) { warn("attachRaidButtonToToolbar error", e); return false; }
}

function watchToolbar() {
  if (attachRaidButtonToToolbar()) return;
  const obs = new MutationObserver(() => {
    if (attachRaidButtonToToolbar()) obs.disconnect();
  });
  obs.observe(document.body, { childList: true, subtree: true });
  globalThis.__bbttccRaidToolbarObserver = obs;
}

function bindWithRetries() {
  bindAPI();
  setTimeout(bindAPI,0);
  setTimeout(bindAPI,50);
  setTimeout(bindAPI,250);
  setTimeout(bindAPI,1000);
}

Hooks.once("ready", () => { bindWithRetries(); watchToolbar(); });

// --- Shared helpers ---------------------------------------------------------
async function getActorByIdOrUuid(maybeIdOrUuid) {
  const s = String(maybeIdOrUuid ?? ""); if (!s) return null;
  try {
    if (s.startsWith("Actor.")) return await fromUuid(s);
    return game.actors.get(s) ?? null;
  } catch (e) { warn("getActorByIdOrUuid error", e); return null; }
}

async function getDefenderActorFromRound(round){
  try {
    const tUuid = round?.targetUuid;
    if (!tUuid) return null;
    const target = await fromUuid(tUuid);
    const defId  = target?.flags?.[TERR_ID]?.factionId || "";
    return defId ? (game.actors.get(defId) ?? null) : null;
  } catch (e) {
    warn("getDefenderActorFromRound error", e);
    return null;
  }
}

async function appendWarLog(actor, entry){
  try {
    if (!actor) return;
    const flags = foundry.utils.duplicate(actor.flags?.[FCT_ID] || {});
    const cur   = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
    cur.push(entry);
    await actor.update({ [`flags.${FCT_ID}.warLogs`]: cur }, { diff: true, recursive: true });
  } catch (e) {
    warn("appendWarLog failed", e);
    ui.notifications?.error?.("Failed to append War Log (see console).");
  }
}

function _negate(obj){ const out={}; for (const [k,v] of Object.entries(obj||{})) out[k]= -Math.abs(Number(v||0)); return out; }

async function _applyOPDeltaDual(actor, lowerSigned){
  if (!lowerSigned || !Object.keys(lowerSigned).length) return;
  const curBank  = foundry.utils.duplicate(actor.getFlag(FCT_ID,"opBank") || {});
  const curPools = foundry.utils.duplicate(actor.getFlag(FCT_ID,"pools")  || {});
  const nextBank  = foundry.utils.mergeObject(curBank,  {}, {inplace:false});
  const nextPools = foundry.utils.mergeObject(curPools, {}, {inplace:false});

  for (const [rawK,v] of Object.entries(lowerSigned)){
    const key = String(rawK).toLowerCase();
    if (!OP_KEYS.includes(key)) continue;
    const nb = (Number(nextBank[key] || 0)  + Number(v||0));
    const np = (Number(nextPools[key]|| 0)  + Number(v||0));
    nextBank[key]  = Math.max(0, Math.round(nb));
    nextPools[key] = Math.max(0, Math.round(np));
  }
  await actor.update({
    [`flags.${FCT_ID}.opBank`]: nextBank,
    [`flags.${FCT_ID}.pools`]:  nextPools
  }, { diff: true, recursive: true });
  log("OP updated for", actor.name, { opBank: nextBank, pools: nextPools });
}

// --- API export shim (unchanged external surface) ---------------------------
Hooks.once("ready", () => {
  try {
    const mod = game.modules.get(RAID_ID);
    if (!mod) return;
    mod.api = mod.api || {};
    mod.api.raid = mod.api.raid || {};
    const raid = mod.api.raid;

    if (!raid.ConsoleClass && typeof BBTTCC_RaidConsole === "function") {
      raid.ConsoleClass = BBTTCC_RaidConsole;
    }
    if (typeof raid.openConsole !== "function" && typeof raid.ConsoleClass === "function") {
      raid.openConsole = function(options = {}) {
        const inst = new raid.ConsoleClass(options);
        inst.render(true, { focus: true });
        return inst;
      };
    }
    if (typeof raid.openRaidConsole !== "function" && typeof raid.openConsole === "function") {
      raid.openRaidConsole = raid.openConsole;
    }

    console.log("[bbttcc-raid] API shim ready (v1.3.16). openConsole available:", typeof raid.openConsole);
  } catch (err) {
    console.error("[bbttcc-raid] API export shim failed:", err);
  }
});
