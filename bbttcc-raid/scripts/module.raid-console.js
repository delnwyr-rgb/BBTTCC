/* BBTTCC Raid — v1.3.24 + RIG TARGETING (Option A, no-template-change)
 * Adds Rig targeting without imports and without touching HBS:
 *  - "Pick Target" now prompts: Hex or Rig
 *  - Rig target uses dropdown dialog (Defender Faction -> Rig)
 *  - Rounds can commit vs Rig (damage ladder, war logs)
 *
 * NOTE: This file stays self-contained (no ES module imports) to preserve bindAPI() behavior.
 */

const RAID_ID = "bbttcc-raid";
const TERR_ID = "bbttcc-territory";
const FCT_ID  = "bbttcc-factions";

// ---------------------------------------------------------------------------
// GM detection — do NOT rely solely on game.user.isGM (can be false in some runtimes).
// Use role >= GAMEMASTER as the source of truth.
// ---------------------------------------------------------------------------
function _rcIsGMUser(){
  try {
    // Prefer Foundry's explicit GM bit when available.
    if (game && game.user && game.user.isGM) return true;

    const u = game.user;
    const role = Number((u && u.role != null) ? u.role : 0);
    const gmRole = Number((CONST && CONST.USER_ROLES && CONST.USER_ROLES.GAMEMASTER != null) ? CONST.USER_ROLES.GAMEMASTER : 4);
    return role >= gmRole;
  } catch(_e){ return false; }
}

const TAG = "[bbttcc-raid v1.3.24 rigs-targeting]";

const log  = (...a)=>console.log(TAG, ...a);
const warn = (...a)=>console.warn(TAG, ...a);


function _bbttccFxApi(){ try { return game?.bbttcc?.api?.fx || null; } catch(_e){ return null; } }
async function _bbttccFxPlay(key, ctx={}, opts={}){
  try {
    const fx = _bbttccFxApi();
    if (!fx || typeof fx.playKey !== "function") return { ok:false, skipped:true };
    return await fx.playKey(String(key||""), ctx || {}, opts || {});
  } catch(_e){ return { ok:false, error:_e }; }
}
function _bbttccFxPanelForRound(app, idx){
  try {
    const root = app?.element && app.element.querySelector ? app.element : (app?.element?.[0] || null);
    const row = root?.querySelector?.('tbody tr[data-idx="'+String(idx)+'"]');
    const manageRow = row ? row.nextElementSibling : null;
    return manageRow?.querySelector?.(".bbttcc-mans-cell") || manageRow || root || null;
  } catch(_e){ return null; }
}



/* ===================================================================
 * BBTTCC Tooltip System (Unified)
 * - Single tooltip manager for Planner + Raid Console
 * - Binds at document level once (no "opened-first" issues)
 * - Targets: .bbttcc-tip-icon[data-tip-kind][data-tip-key]
 * - Content: globalThis.BBTTCC_GetTooltip({kind,key}) if present, else EFFECTS fallback
 * =================================================================== */
(function(){
  const TAG = "[bbttcc-tooltips]";
  if (globalThis.BBTTCC_TooltipManager && typeof globalThis.BBTTCC_TooltipManager.bind === "function") {
    try { globalThis.BBTTCC_TooltipManager.bind(document); } catch(e){}
    return;
  }

  function _escapeHtml(s){
    s = String(s == null ? "" : s);
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function _prettyKey(k){
    return String(k||"").replace(/[_-]/g," ").replace(/\b\w/g,function(m){return m.toUpperCase();});
  }

  function _lc(s){ return String(s||"").toLowerCase(); }

  function _normCost(cost){
    const out = {};
    if (!cost || typeof cost !== "object") return out;
    if (cost.op && typeof cost.op === "object") cost = cost.op;
    for (const k in cost){
      if (!Object.prototype.hasOwnProperty.call(cost,k)) continue;
      const v = Number(cost[k] || 0);
      if (!v) continue;
      out[_lc(k)] = v;
    }
    return out;
  }

  function _costLine(cost){
    const c = _normCost(cost);
    const parts = [];
    for (const k of Object.keys(c)){
      parts.push(_prettyKey(k) + " " + String(c[k]));
    }
    return parts.length ? parts.join(" • ") : "";
  }

  function _getEffects(){
    try {
      const raid = (game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid) ? game.bbttcc.api.raid : null;
      return (raid && raid.EFFECTS) ? raid.EFFECTS : {};
    } catch(e){ return {}; }
  }

  function _fallbackModel(kind, key){
    const EFFECTS = _getEffects();
    const eff = (EFFECTS && EFFECTS[key]) ? EFFECTS[key] : null;

    const label = eff?.label ? String(eff.label) : _prettyKey(key);
    const cost = (eff && (eff.opCosts || eff.cost)) ? (eff.opCosts || eff.cost) : {};
    const costStr = _costLine(cost);

    // Try common text fields
    let text = "";
    if (eff) {
      if (typeof eff.text === "string" && eff.text.trim()) text = eff.text.trim();
      else if (typeof eff.description === "string" && eff.description.trim()) text = eff.description.trim();
      else if (eff.effects && typeof eff.effects.text === "string" && eff.effects.text.trim()) text = eff.effects.text.trim();
    }

    const tier = (eff && eff.tier != null) ? eff.tier : null;
    const rarity = (eff && eff.rarity) ? String(eff.rarity) : null;
    const minFactionTier = (eff && eff.minFactionTier != null) ? eff.minFactionTier : null;
    const storyOnly = (eff && eff.storyOnly === true) ? true : false;
    const availability = (eff && (eff.availability || eff.meta?.availability)) ? String(eff.availability || eff.meta?.availability) : null;
    const unlockKey = (eff && (eff.unlockKey || eff.meta?.unlockKey)) ? String(eff.unlockKey || eff.meta?.unlockKey) : null;
    const raidTypes = (eff && eff.raidTypes) ? eff.raidTypes : null;
    const defenderAccess = (eff && (eff.defenderAccessMode != null || eff.defenderAccess != null)) ? String((eff.defenderAccessMode != null) ? eff.defenderAccessMode : eff.defenderAccess) : null;

    return { kind, key, label, text, costStr, tier, rarity, minFactionTier, storyOnly, availability, unlockKey, raidTypes, defenderAccess };
  }

  function _resolveModel(kind, key){
    // Prefer shared resolver if present (canonical text map etc.)
    try {
      const fn = globalThis.BBTTCC_GetTooltip;
      if (typeof fn === "function") {
        const res = fn({ kind: kind, key: key }) || {};
        // If resolver returns html, just wrap as model-html special case
        if (res && res.html) return { __html: String(res.html) };
        // else fall through
      }
    } catch(e){}
    return _fallbackModel(kind, key);
  }

  function _ensureCss(){
    try {
      if (document.getElementById("bbttcc-tooltip-style")) return;
      const style = document.createElement("style");
      style.id = "bbttcc-tooltip-style";
      style.textContent = `
        .bbttcc-tip-icon{
          display:inline-flex; align-items:center; justify-content:center;
          width:16px; height:16px; margin-left:6px;
          border-radius:999px; border:1px solid rgba(148,163,184,0.35);
          background: rgba(15,23,42,0.55);
          color: rgba(226,232,240,0.9);
          font-size:11px; line-height:1;
          cursor: help; user-select:none;
        }
        .bbttcc-tip-icon:hover{
          border-color: rgba(59,130,246,0.75);
          background: rgba(30,64,175,0.28);
        }
        .bbttcc-tooltip{
          position: fixed;
          z-index: 100000;
          max-width: 380px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,0.28);
          background: rgba(2,6,23,0.92);
          color: rgba(226,232,240,0.95);
          box-shadow: 0 12px 30px rgba(0,0,0,0.45);
          font-family: Helvetica, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.25;
          pointer-events: none;
        }
        .bbttcc-tooltip .bbttcc-tip-title{
          font-weight: 800;
          letter-spacing: 0.02em;
          margin-bottom: 6px;
          color: rgba(191,219,254,0.95);
        }
        .bbttcc-tooltip .bbttcc-tip-text{ opacity: 0.95; margin-bottom: 6px; }
        .bbttcc-tooltip .bbttcc-tip-line{ opacity: 0.92; margin-top: 4px; }
      `;
      document.head.appendChild(style);
    } catch(e){}
  }

  function TooltipManager(){
    this._bound = false;
    this._tooltipEl = null;
    this._root = null;
    this._pinned = false;
    this._hideTimer = null;
  }

  TooltipManager.prototype._getEl = function(){
    _ensureCss();
    if (this._tooltipEl && this._tooltipEl.isConnected) return this._tooltipEl;
    const el = document.createElement("div");
    el.className = "bbttcc-tooltip";
    el.style.display = "none";
    document.body.appendChild(el);
    this._tooltipEl = el;
    return el;
  };

  TooltipManager.prototype._hide = function(){
    const el = this._tooltipEl;
    if (!el) return;
    el.style.display = "none";
    el.innerHTML = "";
  };

  TooltipManager.prototype._position = function(x, y){
    const el = this._getEl();
    const pad = 14;
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;

    el.style.display = "block";
    const rect = el.getBoundingClientRect();

    let left = (Number(x||0) + pad);
    let top  = (Number(y||0) + pad);

    if (left + rect.width + 10 > vw) left = Math.max(10, Number(x||0) - rect.width - pad);
    if (top + rect.height + 10 > vh) top = Math.max(10, Number(y||0) - rect.height - pad);

    el.style.left = left + "px";
    el.style.top  = top  + "px";
  };

  TooltipManager.prototype._set = function(html){
    const el = this._getEl();
    el.innerHTML = html || "";
    el.style.display = html ? "block" : "none";
  };

  TooltipManager.prototype._buildHtmlFromModel = function(m){
    if (!m) return "";
    if (m.__html) return m.__html;

    const lines = [];
    lines.push('<div class="bbttcc-tip-title">' + _escapeHtml(m.label || m.key || "—") + '</div>');
    if (m.text) lines.push('<div class="bbttcc-tip-text">' + _escapeHtml(m.text) + '</div>');
    if (m.costStr) lines.push('<div class="bbttcc-tip-line"><b>Cost:</b> ' + _escapeHtml(m.costStr) + '</div>');

    const meta = [];
    if (m.minFactionTier != null) meta.push("Faction Tier T" + String(m.minFactionTier));
    if (m.tier != null) meta.push("T" + String(m.tier));
    if (m.rarity) meta.push(String(m.rarity));
    if (m.storyOnly) meta.push("Story");
    if (m.availability) meta.push(String(m.availability).toUpperCase());
    if (meta.length) lines.push('<div class="bbttcc-tip-line"><b>Meta:</b> ' + _escapeHtml(meta.join(" • ")) + '</div>');

    if (String(m.kind) === "maneuver") {
      if (m.raidTypes) {
        const rt = Array.isArray(m.raidTypes) ? m.raidTypes.join(", ") : String(m.raidTypes);
        if (rt) lines.push('<div class="bbttcc-tip-line"><b>Raid Types:</b> ' + _escapeHtml(rt) + '</div>');
      }
      if (m.defenderAccess) lines.push('<div class="bbttcc-tip-line"><b>Defender:</b> ' + _escapeHtml(m.defenderAccess) + '</div>');
    }

    return lines.join("");
  };

  TooltipManager.prototype._findTarget = function(ev){
    const t = ev && ev.target ? ev.target : null;
    if (!t || !t.closest) return null;
    return t.closest(".bbttcc-tip-icon[data-tip-kind][data-tip-key]");
  };

  TooltipManager.prototype.bind = function(root){
    if (this._bound) return;
    this._bound = true;

    this._root = root || document;

    const self = this;

    const onOver = function(ev){
      const target = self._findTarget(ev);
      if (!target) return;
      if (self._hideTimer) { clearTimeout(self._hideTimer); self._hideTimer = null; }

      // Prevent browser native tooltip from the title attribute
      try { target.removeAttribute("title"); } catch(e){}

      const kind = target.getAttribute("data-tip-kind") || "";
      const key  = target.getAttribute("data-tip-key")  || "";
      if (!kind || !key) return;

      const model = _resolveModel(kind, key);
      const html = self._buildHtmlFromModel(model);
      self._pinned = false;
      self._set(html);
      self._position(ev.clientX, ev.clientY);
    };

    const onMove = function(ev){
      if (self._pinned) return;
      const target = self._findTarget(ev);
      if (!target) return;
      if (!self._tooltipEl || self._tooltipEl.style.display === "none") return;
      self._position(ev.clientX, ev.clientY);
    };

    const onLeave = function(ev){
      if (self._pinned) return;
      const target = self._findTarget(ev);
      if (target) return;
      if (self._hideTimer) clearTimeout(self._hideTimer);
      self._hideTimer = setTimeout(function(){ self._hide(); }, 80);
    };

    const onClick = function(ev){
      const target = self._findTarget(ev);
      if (!target) return;
      ev.preventDefault();
      ev.stopPropagation();
      self._pinned = true;
      setTimeout(function(){ self._pinned = false; self._hide(); }, 4500);
    };

    (this._root || document).addEventListener("pointerover", onOver, true);
    (this._root || document).addEventListener("mousemove", onMove, true);
    (this._root || document).addEventListener("mouseleave", onLeave, true);
    (this._root || document).addEventListener("click", onClick, true);

    window.addEventListener("keydown", function(ev){
      if (ev && ev.key === "Escape") self._hide();
    }, true);

    window.addEventListener("wheel", function(){ self._hide(); }, { capture:true, passive:true });

    try { console.log(TAG, "TooltipManager bound (document)"); } catch(e){}
  };

  globalThis.BBTTCC_TooltipManager = new TooltipManager();
  try { globalThis.BBTTCC_TooltipManager.bind(document); } catch(e){}
})();



// --- Handlebars Helperslpers -----------------------------------------------------
Hooks.once("init", () => {
  // Boss state persistence setting (world-scoped, hidden)
  try {
    if (game && game.settings && !game.settings.settings.has(RAID_ID + ".bossState")) {
      game.settings.register(RAID_ID, "bossState", {
        name: "BBTTCC Raid Boss State (internal)",
        hint: "Internal persistent boss damage state map.",
        scope: "world",
        config: false,
        type: Object,
        default: {}
      });
    }
  } catch (e) {}

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

// --- Boss State Persistence (world setting) -------------------------------
// Stores per-boss stepped damage so creature bosses persist across sessions.
// Shape: { [bossKey]: { damageStep:number, damageState:string, hitTrack:string[], updatedTs:number } }
function _getBossStateMap(){
  try {
    const raw = game.settings.get(RAID_ID, "bossState") || {};
    return foundry.utils.duplicate(raw);
  } catch (e) { return {}; }
}
function _setBossStateMap(map){
  try { return game.settings.set(RAID_ID, "bossState", map || {}); }
  catch (e) { return null; }
}
function _getBossState(bossKey){
  const map = _getBossStateMap();
  const k = String(bossKey || "");
  return (map && map[k]) ? map[k] : null;
}
async function _setBossState(bossKey, state){
  const map = _getBossStateMap();
  const k = String(bossKey || "");
  if (!k) return;
  map[k] = state;
  await _setBossStateMap(map);
}
function _bossStateLabel(def, state){
  const base = String((def && def.label) || (def && def.key) || "");
  const name = base || "";
  const ds = state && state.damageState ? String(state.damageState) : "";
  if (!ds || ds === "intact") return name;
  return name + " — " + ds.toUpperCase();
}
function _ensureRoundBossMeta(r, bossKey){
  r.meta = r.meta || {};
  r.meta.boss = r.meta.boss || {};

  const raid = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid) ? game.bbttcc.api.raid : {};
  const def = (raid.boss && typeof raid.boss.get === "function") ? (raid.boss.get(bossKey) || {}) : {};

  const stored = _getBossState(bossKey) || {};
  const track = (Array.isArray(def.hitTrack) && def.hitTrack.length) ? def.hitTrack.slice()
    : (Array.isArray(stored.hitTrack) && stored.hitTrack.length) ? stored.hitTrack.slice()
    : ["shaken","wounded","broken","banished"];

  const maxStep = track.length;
  const step0 = (stored.damageStep != null) ? Number(stored.damageStep) : 0;
  const step = clamp(step0, 0, maxStep);
  const stateName = (step === 0) ? "intact" : String(track[step-1] || "damaged");

  if (r.meta.boss.damageStep == null) r.meta.boss.damageStep = step;
  r.meta.boss.hitTrack = Array.isArray(r.meta.boss.hitTrack) && r.meta.boss.hitTrack.length ? r.meta.boss.hitTrack : track;
  r.meta.boss.damageState = r.meta.boss.damageState || stateName;

  return { def: def, stored: stored, track: track, step: step, stateName: stateName };
}

// Defender maneuver DC bonuses (mirrors compat PRE_ROLL)
const DEFENDER_DC_MAP = {
  defensive_entrenchment: 3,
  quantum_shield: 3,
  counter_propaganda_wave: 2
};
// Defender maneuver visibility overrides (alpha-safe)
// Some maneuvers are intentionally useful for defenders even if the EFFECTS registry
// does not explicitly mark defenderAccess. Keep this list small and intentional.
const DEFENDER_ALWAYS_MANS = {
  void_signal_collapse: true
};


const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));
const randid=()=> (globalThis.crypto?.randomUUID?.() || (typeof randomID==="function"?randomID():Math.random().toString(36).slice(2)));
function lcKeys(obj){ const o={}; for (const [k,v] of Object.entries(obj||{})) o[String(k).toLowerCase()]=Number(v||0); return o; }

// ---------------------------------------------------------------------------
// Maneuver selection sync (DOM -> round.mansSelected)
// Some Foundry v13+ roll objects do not preserve .result strings, and some UI
// states can desync arrays vs checked boxes. Before commit, re-scan the manage
// row DOM to ensure r.mansSelected / r.mansSelectedDef reflect the UI.
// ---------------------------------------------------------------------------
function _rcSyncManeuverSelectionsFromDOM(app, idx, round){
  try {
    if (!app || !round) return false;
    const root = app.element && app.element.querySelector ? app.element : (app.element?.[0] || null);
    if (!root) return false;

    const headerRow = root.querySelector('tbody tr[data-idx="'+String(idx)+'"]');
    const manageRow = headerRow ? headerRow.nextElementSibling : null;
    if (!manageRow) return false;

    const host = manageRow.querySelector(".bbttcc-mans-cell");
    if (!host) return false;

    const att = [];
    const def = [];
    host.querySelectorAll('.mans-wrap input[type="checkbox"][data-maneuver][data-side]:checked').forEach((cb)=>{
      const k = String(cb.getAttribute("data-maneuver") || "").trim();
      const side = String(cb.getAttribute("data-side") || "").trim().toLowerCase();
      if (!k) return;
      if (side === "def") def.push(k);
      else att.push(k);
    });

    // Only apply if we found any checkboxes (avoid wiping in scenario modes).
    if (att.length || def.length) {
      round.mansSelected = att;
      round.mansSelectedDef = def;
      return true;
    }
  } catch(_e) {}
  return false;
}

function textForSpend(sum){ return Object.keys(sum).length ? Object.entries(sum).map(([k,v])=>`${k}:${v}`).join(", ") : "—"; }

// ------------------------------------------------------------
// Scenario HUD helpers (Compact Hex Chrome)
// ------------------------------------------------------------
function _scenarioRoundLabel(state){
  if (!state) return "R?";
  if (Number.isFinite(state.round) && state.round > 0) return `R${state.round}`;
  if (Array.isArray(state.history)) return `R${state.history.length}`;
  return "R1";
}

function _alarmBand(alarm){
  if (alarm <= 1) return { label:"QUIET", cls:"bbttcc-alarm-quiet" };
  if (alarm <= 3) return { label:"SUSPICIOUS", cls:"bbttcc-alarm-suspicious" };
  if (alarm === 4) return { label:"ALERTED", cls:"bbttcc-alarm-alerted" };
  return { label:"LOCKDOWN", cls:"bbttcc-alarm-lockdown" };
}

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

function categoryValue(faction, key) {
  key = String(key || "").toLowerCase();
  const opsFlags = foundry.utils.duplicate(faction?.getFlag?.(FCT_ID,"ops") || {});
  return Number(opsFlags?.[key]?.value ?? 0) || 0;
}

/** Roster contribution parity:
 *  - Prefer flags.bbttcc-factions.opContribution on character actors (per-key numbers)
 *  - Fall back to flags.bbttcc-character-options.calculatedOPs (legacy)
 *  - Roster membership: reuse _characterBelongsToFaction if available; else best-effort by id/name flags.
 */
function rosterContribution(faction, key) {
  key = String(key || "").toLowerCase();
  if (!faction || !key) return 0;

  const isChar = (a) => {
    const t = String(a?.type || "").toLowerCase();
    return t === "character" || t === "pc" || t === "npc";
  };

  const belongs = (char) => {
    try {
      if (typeof _characterBelongsToFaction === "function") return _characterBelongsToFaction(char, faction);
    } catch {}
    // fallback: id/name flags commonly used in BBTTCC
    const fid = faction.id;
    const fname = String(faction.name || "").trim();
    const byId = [
      char?.getFlag?.(FCT_ID, "factionId"),
      char?.getFlag?.(FCT_ID, "ownerFactionId"),
      char?.flags?.[FCT_ID]?.factionId,
      char?.flags?.[FCT_ID]?.ownerFactionId,
      char?.flags?.["bbttcc-core"]?.factionId,
      char?.flags?.["bbttcc-identity"]?.factionId,
      char?.flags?.["bbttcc-character-options"]?.factionId
    ].filter(Boolean).map(String);
    if (byId.includes(fid)) return true;

    const byName = [
      char?.getFlag?.(FCT_ID, "factionName"),
      char?.getFlag?.(FCT_ID, "faction"),
      char?.flags?.[FCT_ID]?.factionName,
      char?.flags?.[FCT_ID]?.faction,
      char?.flags?.["bbttcc-core"]?.factionName,
      char?.flags?.["bbttcc-identity"]?.factionName
    ].filter(Boolean).map(v => String(v).trim());
    if (fname && byName.includes(fname)) return true;

    return false;
  };

  let sum = 0;
  const actors = game.actors?.contents || [];
  for (const a of actors) {
    if (!a || !isChar(a)) continue;
    if (!belongs(a)) continue;

    // preferred: explicit per-character contribution
    let contrib = {};
    try {
      contrib = foundry.utils.duplicate(a.getFlag?.(FCT_ID, "opContribution") || {});
    } catch { contrib = {}; }

    // fallback: calculated OPs from character options
    if (!contrib || typeof contrib !== "object" || Array.isArray(contrib) || Object.values(contrib).every(v => Number(v || 0) === 0)) {
      contrib = foundry.utils.duplicate(a?.flags?.["bbttcc-character-options"]?.calculatedOPs || {});
    }

    const v = Number(contrib?.[key] ?? contrib?.[key.replace("nonlethal","nonLethal")] ?? 0);
    if (Number.isFinite(v) && v) sum += v;
  }
  return sum;
}

function categoryTotalWithRoster(faction, key) {
  return categoryValue(faction, key) + rosterContribution(faction, key);
}

function _rcNormFactionIds(ids){
  const out = [];
  for (const v of (Array.isArray(ids) ? ids : [])) {
    const id = String(v || "").trim();
    if (!id) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function _rcCoalitionSupportActors(ids, leadId){
  const out = [];
  const seen = new Set();
  const lid = String(leadId || "").trim();
  for (const id of _rcNormFactionIds(ids)) {
    if (!id || id === lid || seen.has(id)) continue;
    const a = game.actors?.get?.(id) || null;
    if (!a || !isFaction(a)) continue;
    seen.add(id);
    out.push(a);
  }
  return out;
}

function _rcCoalitionBonus(leadFaction, supportFactionIds, key){
  const lead = leadFaction || null;
  const supports = _rcCoalitionSupportActors(supportFactionIds, lead?.id || "");
  const leadTotal = lead ? categoryTotalWithRoster(lead, key) : 0;
  const supportBreakdown = supports.map(a => ({ id: a.id, name: a.name, total: categoryTotalWithRoster(a, key) }));
  const supportTotal = supportBreakdown.reduce((n, row) => n + Number(row.total || 0), 0);
  const coordinationPenalty = Math.max(0, supports.length - 1);
  const total = Math.max(0, Number(leadTotal || 0) + Number(supportTotal || 0) - coordinationPenalty);
  return {
    leadTotal,
    supportTotal,
    coordinationPenalty,
    total,
    supportActors: supports,
    supportBreakdown
  };
}

// Back-compat: existing callers used categoryTotal() as "value-only".
function categoryTotal(faction, key) {
  return categoryValue(faction, key);
}

function _zeroOps(){ const b={}; for (const k of OP_KEYS) b[k]=0; return b; }

function _rcGetBossDefByKey(bossKey){
  try {
    const api = game?.bbttcc?.api?.raid?.boss || null;
    if (!api || typeof api.get !== "function") return null;
    const k = String(bossKey || "").trim();
    return k ? (api.get(k) || null) : null;
  } catch(_e){ return null; }
}

function _rcBossStats(def){
  const out = _zeroOps();
  const src = (def && typeof def === "object" && def.stats && typeof def.stats === "object") ? def.stats : {};
  for (const k of OP_KEYS) out[k] = Number(src[k] || 0);
  return out;
}

function _rcBossDoctrineMap(def){
  const out = {};
  const keys = Array.isArray(def?.maneuverKeys) ? def.maneuverKeys : [];
  const effects = game?.bbttcc?.api?.raid?.EFFECTS || {};
  const throughput = game?.bbttcc?.api?.agent?.__THROUGHPUT || {};
  for (const raw of keys){
    const key = String(raw || "").trim();
    if (!key) continue;
    const eff = effects[key] || {};
    if (!effects[key] && !throughput[key]) continue;
    out[key] = Object.assign({}, eff, {
      key,
      label: String(eff.label || key.replace(/[_-]/g, " ").replace(/\b\w/g, m => m.toUpperCase()))
    });
  }
  return out;
}

async function computeContestedVsBoss(attacker, bossDef, {
  activityKey="assault",
  difficulty="normal",
  contestedKey=null,
  baseDefense=0,
  stagedA=0,
  stagedD=0,
  diffOffset=0,
  defenderMans=[],
  rollModeAtt="normal",
  rollModeDef="normal",
  extraBonusAtt=0,
  extraBonusDef=0,
  attackerBaseOverride=null
} = {}) {
  const key = String(contestedKey || primaryKeyFor(activityKey) || "violence").toLowerCase();
  const stats = _rcBossStats(bossDef);
  const attBase = Number.isFinite(Number(attackerBaseOverride)) ? Number(attackerBaseOverride) : categoryTotalWithRoster(attacker, key);
  const defBase = Number(stats[key] || 0);
  const attStage = Math.ceil(Number(stagedA||0) / 2);
  const defStage = Math.ceil(Number(stagedD||0) / 2);
  const diffAdj  = Number(RAID_DIFFICULTIES[difficulty]?.modifier ?? 0);

  let defManBonus = 0;
  try {
    const list = Array.isArray(defenderMans) ? defenderMans : [];
    for (const mk of list) defManBonus += Number(DEFENDER_DC_MAP[String(mk||"").toLowerCase()] || 0);
  } catch {}

  const defFort = Number(baseDefense || 0);
  const attTotalBonus = Number(attBase||0) + Number(attStage||0) + Number(extraBonusAtt||0);
  const defTotalBonus = Number(defBase||0) + Number(defStage||0) + diffAdj + Number(diffOffset||0) + defFort + defManBonus + Number(extraBonusDef||0);

  const mAtt = String(rollModeAtt||"normal").toLowerCase();
  const mDef = String(rollModeDef||"normal").toLowerCase();
  const d20A = (mAtt === "adv") ? "2d20kh1" : (mAtt === "dis") ? "2d20kl1" : "1d20";
  const d20D = (mDef === "adv") ? "2d20kh1" : (mDef === "dis") ? "2d20kl1" : "1d20";

  const attRoll = new Roll(`${d20A} + @b`, { b: attTotalBonus });
  const defRoll = new Roll(`${d20D} + @b`, { b: defTotalBonus });
  await attRoll.evaluate();
  await defRoll.evaluate();

  const attTotal = attRoll.total;
  const defTotal = defRoll.total;
  const margin = Number(attTotal || 0) - Number(defTotal || 0);
  const attackerWon = margin >= 0;
  const tier = attackerWon ? (margin >= 5 ? "Great Success" : "Success") : "Fail";

  return {
    key,
    attBase, defBase,
    attStage, defStage,
    diffAdj,
    defFort,
    defManBonus,
    attBonus: attTotalBonus,
    defBonus: defTotalBonus,
    rollModeAtt: mAtt,
    rollModeDef: mDef,
    extraBonusAtt: Number(extraBonusAtt||0),
    extraBonusDef: Number(extraBonusDef||0),
    attRoll, defRoll,
    attTotal, defTotal,
    margin,
    outcome: tier,
    bossStats: stats
  };
}

function getOPBank(actor){
  const flags = foundry.utils.duplicate(actor?.flags?.[FCT_ID] ?? {});
  const b = flags.opBank || {};
  for (const k of OP_KEYS) b[k] = Number(b[k]||0);
  return b;
}

// ---------------------------------------------------------------------------
// OP Gating (Raid Console) — attempt requires 1 OP of primaryKey
// - Blocks adding/committing rounds when attacker lacks 1 OP in activity primary key.
// - Adds tooltip + button disabled state (no template changes).
// - Optional desperation is not enabled here yet (Raid has multi-round spend math).
// ---------------------------------------------------------------------------
function _rcOpLabel(key){
  key = String(key||"").toLowerCase().trim();
  if (!key) return "OP";
  return key.charAt(0).toUpperCase() + key.slice(1);
}
function _rcGetAttackerBank(attacker){
  try { return attacker ? getOPBank(attacker) : _zeroOps(); } catch(_e){ return _zeroOps(); }
}
function _rcHasOpForActivity(attacker, activityKey){
  const k = primaryKeyFor(activityKey);
  const bank = _rcGetAttackerBank(attacker);
  const v = Number(bank[k]||0);
  return { ok: (v>=1), key: k, pool: v };
}
function _rcApplyGateToAddRoundButton(app){
  try {
    if (!app || !app.element) return;

    // AppV2 may provide element as a raw HTMLElement; normalize to jQuery for .find/.prop/.attr.
    const $el = (app.element && typeof app.element.find === "function") ? app.element : $(app.element);
    const btn = $el.find('[data-id="add-round"]');
    if (!btn.length) return;

    const attacker = app.vm && app.vm.attackerId ? game.actors.get(app.vm.attackerId) : null;
    const g = _rcHasOpForActivity(attacker, (app.vm && app.vm.activityKey) ? app.vm.activityKey : "assault");

    if (!attacker || !app.vm.attackerId) {
      btn.prop("disabled", true);
      btn.attr("title", "Pick an attacker faction first.");
      return;
    }

    if (!g.ok) {
      btn.prop("disabled", true);
      btn.addClass("bbttcc-roll-blocked");
      btn.attr("title", "Action Unavailable\nRequires 1 " + _rcOpLabel(g.key) + " OP.\nThe attacker has 0 in this pool.");
      return;
    }

    btn.prop("disabled", false);
    btn.removeClass("bbttcc-roll-blocked");
    btn.attr("title", "Add Round\nRequires 1 " + _rcOpLabel(g.key) + " OP to authorize the attempt.");
  } catch (e) { warn("raid add-round gate UI failed", e); }
} 


// --- Facilities → Raid helpers ---------------------------------------------
function _safeParseJSON(raw, fallback){
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function _num(v, d=0){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function _getPrimaryFacilityFromTarget(target){
  const doc = target?.document ?? target;
  const facRoot = doc?.flags?.[TERR_ID]?.facilities?.primary;
  if (!facRoot) return null;
  if (Array.isArray(facRoot)) return facRoot[0] ?? null;
  if (typeof facRoot === "object") return facRoot;
  return null;
}

async function _updatePrimaryFacilityOnTarget(target, updater){
  const doc = target?.document ?? target;
  if (!doc) return { ok:false, error:"no-doc" };

  const tf = foundry.utils.duplicate(doc.flags?.[TERR_ID] || {});
  tf.facilities = tf.facilities || {};
  const cur = tf.facilities.primary;
  if (!cur) return { ok:false, error:"no-facility" };

  let next = null;
  if (Array.isArray(cur)) {
    const arr = cur.slice();
    arr[0] = updater(arr[0] ?? {});
    next = arr;
  } else if (typeof cur === "object") {
    next = updater(foundry.utils.duplicate(cur));
  } else {
    return { ok:false, error:"bad-shape" };
  }

  tf.facilities.primary = next;
  await doc.update({ [`flags.${TERR_ID}`]: tf }, { parent: doc.parent ?? null });
  return { ok:true };
}

async function getFacilityRaidProfile(target){
  try {
    const fac = _getPrimaryFacilityFromTarget(target);
    if (!fac) return null;

    const rb = fac.raidBonuses || {};
    const hooks = _safeParseJSON(fac.integration?.resolutionHooksRaw, {}) || {};

    const hitTrack = Array.isArray(fac.hitTrack) && fac.hitTrack.length
      ? fac.hitTrack.slice()
      : ["light","heavy","breached","destroyed"];

    const maxStep = hitTrack.length;
    const damageStep = clamp(_num(fac.damageStep ?? fac.damageIndex ?? fac.damageState ?? 0, 0), 0, maxStep);

    const stateName = (damageStep === 0) ? "intact" : String(hitTrack[damageStep-1] || "damaged");

    const baseDcBonus = _num(rb.defenderDcBonus, 0);
    const baseMaxDef  = _num(rb.maxDefenderUnits, 0);

    const stepPenalty = (damageStep === 0) ? 0
      : (damageStep === 1) ? 1
      : (damageStep === 2) ? 2
      : (damageStep >= 3) ? 999 : 0;

    const defenderDcBonus = (damageStep >= 3) ? 0 : Math.max(0, baseDcBonus - stepPenalty);
    const maxDefenderUnits = (damageStep >= maxStep) ? 0 : Math.max(0, baseMaxDef - (damageStep === 0 ? 0 : damageStep));

    const extraRaw = rb.attackerExtraOpCost || {};
    const attackerExtraOpCost = {};
    for (const [k,v] of Object.entries(extraRaw)) {
      const key = String(k).toLowerCase();
      const base = _num(v, 0);
      const cost = (damageStep >= 3) ? 0 : Math.max(0, base - stepPenalty);
      attackerExtraOpCost[key] = cost;
    }

    return {
      facilityType: fac.facilityType || fac.type || "facility",
      tier: fac.tier,
      size: fac.size,
      damageStep,
      damageState: stateName,
      hitTrack,
      defenderDcBonus,
      maxDefenderUnits,
      attackerExtraOpCost,
      resolutionHooks: hooks,
      notes: rb.notes || ""
    };
  } catch (e) {
    warn("getFacilityRaidProfile failed", e);
    return null;
  }
}

// --- Rigs → Raid helpers ----------------------------------------------------
function _getRigList(defender){
  const rigs = defender?.getFlag?.(FCT_ID,"rigs") ?? defender?.flags?.[FCT_ID]?.rigs;
  return Array.isArray(rigs) ? rigs : [];
}

function _getRigById(defender, rigId){
  if (!defender || !rigId) return null;
  const rigs = _getRigList(defender);
  return rigs.find(r => String(r?.rigId||"") === String(rigId)) || null;
}

async function _updateRigOnFaction(defender, rigId, updater){
  if (!defender || !rigId) return { ok:false, error:"missing" };
  const rigs = _getRigList(defender).map(r => foundry.utils.duplicate(r));
  const idx = rigs.findIndex(r => String(r?.rigId||"") === String(rigId));
  if (idx < 0) return { ok:false, error:"not-found" };
  rigs[idx] = updater(rigs[idx] || {});
  await defender.update({ [`flags.${FCT_ID}.rigs`]: rigs }, { diff:true, recursive:true });
  return { ok:true };
}

// Normalized rig raid profile mirrors facility profile enough to reuse math/UI
async function getRigRaidProfile(defender, rigId){
  try {
    const rig = _getRigById(defender, rigId);
    if (!rig) return null;

    const rb = rig.raidBonuses || {};

    const hitTrack = Array.isArray(rig.hitTrack) && rig.hitTrack.length
      ? rig.hitTrack.slice()
      : ["light","heavy","breached","destroyed"];

    const maxStep = hitTrack.length;
    const damageStep = clamp(_num(rig.damageStep ?? rig.damageIndex ?? 0, 0), 0, maxStep);
    const stateName = (damageStep === 0) ? "intact" : String(hitTrack[damageStep-1] || "damaged");

    const baseDcBonus = _num(rb.defenderDcBonus ?? rb.defense ?? 0, 0);
    const baseMaxDef  = _num(rb.maxDefenderUnits ?? 0, 0);

    const stepPenalty = (damageStep === 0) ? 0
      : (damageStep === 1) ? 1
      : (damageStep === 2) ? 2
      : (damageStep >= 3) ? 999 : 0;

    const defenderDcBonus = (damageStep >= 3) ? 0 : Math.max(0, baseDcBonus - stepPenalty);
    const maxDefenderUnits = (damageStep >= maxStep) ? 0 : Math.max(0, baseMaxDef - (damageStep === 0 ? 0 : damageStep));

    const extraRaw = rb.attackerExtraOpCost || {};
    const attackerExtraOpCost = {};
    for (const [k,v] of Object.entries(extraRaw)) {
      const key = String(k).toLowerCase();
      const base = _num(v, 0);
      const cost = (damageStep >= 3) ? 0 : Math.max(0, base - stepPenalty);
      attackerExtraOpCost[key] = cost;
    }

    return {
      rigId: rig.rigId,
      rigName: rig.name || rig.label || "Rig",
      rigType: rig.type || "rig",
      damageStep,
      damageState: stateName,
      hitTrack,
      defenderDcBonus,
      maxDefenderUnits,
      attackerExtraOpCost,
      notes: rb.notes || ""
    };
  } catch (e) {
    warn("getRigRaidProfile failed", e);
    return null;
  }
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

// --- Target picker (Hex OR Rig) --------------------------------------------
async function pickTargetHexOrRig(vm){
  const choice = await new Promise((resolve) => {
    new Dialog({
      title: "Pick Raid Target",
      content: `<p>Choose your target type:</p>`,
      buttons: {
        hex: { label: "Hex", callback: () => resolve("hex") },
        facility: { label: "Facility", callback: () => resolve("facility") },
        rig: { label: "Rig", callback: () => resolve("rig") },
        creature: { label: "Creature", callback: () => resolve("creature") }
      },
      default: "hex",
      close: () => resolve(null)
    }, { width: 360 }).render(true);
  });
  if (!choice) return null;

  if (choice === "hex" || choice === "facility") {
    const sel = await pickTargetHex({ prompt:"Click a BBTTCC hex to raid…" });
    if (!sel) return null;
    const hexName = (sel.flags?.name || (sel.uuid ? sel.uuid.split(".").pop() : "—"));

    // Facility targeting: only valid if this hex has a primary facility configured.
    if (choice === "facility") {
      const doc = sel.uuid ? await fromUuid(sel.uuid).catch(()=>null) : null;
      const fac = doc ? _getPrimaryFacilityFromTarget(doc) : null;
      if (!fac) {
        ui.notifications?.warn?.("No facility configured on that hex. Targeting the hex instead.");
        return { type:"hex", uuid: sel.uuid, name: hexName };
      }
      const facName = fac.facilityType || fac.type || "facility";
      return { type:"facility", uuid: sel.uuid, name: `${facName} @ ${hexName}` };
    }

    return { type:"hex", uuid: sel.uuid, name: hexName };
  }

  // Creature path: pick from boss registry (bbttcc.api.raid.boss)
  if (choice === "creature") {
    const raid = game.bbttcc?.api?.raid || {};
    const bossApi = raid.boss;
    const list = (typeof bossApi?.list === "function") ? bossApi.list() : [];
    const opts = Array.isArray(list) ? list : [];
    if (!opts.length) {
      ui.notifications?.warn?.("No raid bosses registered. (bossRegistry is empty)");
      return null;
    }

    const bossKey = await new Promise((resolve) => {
      const options = opts.map(b => `<option value="${foundry.utils.escapeHTML(String(b.key||""))}">${foundry.utils.escapeHTML(String(b.label||b.key||""))}</option>`).join("");
      new Dialog({
        title: "Pick Creature (Raid Boss)",
        content: `
          <form>
            <div class="form-group">
              <label>Creature</label>
              <select name="boss">${options}</select>
            </div>
            <p class="hint">Bosses come from game.bbttcc.api.raid.boss.registerBoss().</p>
          </form>`,
        buttons: {
          ok: {
            label: "Select",
            callback: (html) => resolve(html[0].querySelector("select[name='boss']")?.value || null)
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }, { width: 620 }).render(true);
    });

    if (!bossKey) return null;
    const def = bossApi.get ? (bossApi.get(bossKey) || {}) : {};
    const st = _getBossState(bossKey) || {};
    const nm = _bossStateLabel(def, st) || String(def.label || bossKey);
    return { type:"creature", creatureId: String(bossKey), name: String(nm) };
  }


  // Rig path: select defender faction then rig
  const facs = (game.actors?.contents ?? []).filter(isFaction).sort((a,b)=>a.name.localeCompare(b.name));
  if (!facs.length) {
    ui.notifications?.warn?.("No faction actors found to target rigs.");
    return null;
  }

  const defenderId = await new Promise((resolve) => {
    const options = facs.map(f => `<option value="${f.id}">${foundry.utils.escapeHTML(f.name)}</option>`).join("");
    new Dialog({
      title: "Pick Defender Faction",
      content: `
        <form>
          <div class="form-group">
            <label>Defender</label>
            <select name="def">${options}</select>
          </div>
          <p class="hint">Rigs are stored on the defender faction.</p>
        </form>`,
      buttons: {
        ok: {
          label: "Next",
          callback: (html) => {
            const sel = html[0].querySelector("select[name='def']")?.value || "";
            resolve(sel || null);
          }
        },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }, { width: 520 }).render(true);
  });

  if (!defenderId) return null;
  const defender = game.actors.get(defenderId);
  const rigs = _getRigList(defender);
  if (!rigs.length) {
    ui.notifications?.warn?.(`"${defender?.name || "Defender"}" has no rigs.`);
    return null;
  }

  const rigId = await new Promise((resolve) => {
    const options = rigs.map(r => {
      const st = r.damageState || (r.damageStep ? `step ${r.damageStep}` : "intact");
      const hp = r.hitTrack ? `${r.hitTrack.current ?? "?"}/${r.hitTrack.max ?? "?"}` : "";
      return `<option value="${r.rigId}">${foundry.utils.escapeHTML(r.name || r.label || r.rigId)} (${st}${hp?`, ${hp}`:""})</option>`;
    }).join("");
    new Dialog({
      title: "Pick Target Rig",
      content: `
        <form>
          <div class="form-group">
            <label>Rig</label>
            <select name="rig">${options}</select>
          </div>
          <p class="hint">This will target a rig on the defender faction.</p>
        </form>`,
      buttons: {
        ok: {
          label: "Select",
          callback: (html) => {
            const sel = html[0].querySelector("select[name='rig']")?.value || "";
            resolve(sel || null);
          }
        },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok",
      close: () => resolve(null)
    }, { width: 620 }).render(true);
  });

  if (!rigId) return null;
  const rig = _getRigById(defender, rigId);
  return { type:"rig", defenderId, rigId, name: `${defender.name} — ${rig?.name || rigId}` };
}

// --- Raid activity + EFFECTS helpers ----------------------------------------
function getRaidTypes(){
  try {
    const api = game.bbttcc?.api?.raid;
    const TYPES = (typeof api?.getTypes === "function") ? (api.getTypes() || {}) : (api?.TYPES || {});
    const base = Object.values(TYPES || {});
    if (Array.isArray(base) && base.length) {
      const map = {};
      for (const t of base) {
        if (!t || !t.key) continue;
        map[String(t.key)] = t;
      }

      // Inject scenario raid modes if missing (authoritative + registry-friendly)
      if (!map.courtly) map.courtly = {
        key: "courtly",
        label: "Courtly Intrigue",
        primaryKey: "diplomacy",
        kind: "scenario"
      };
      if (!map.infiltration_alarm) map.infiltration_alarm = {
        key: "infiltration_alarm",
        label: "Infiltration (Alarm)",
        primaryKey: "intrigue",
        kind: "scenario"
      };

      return Object.values(map);
    }
  } catch {}
  return [
    { key:"assault",              label:"Assault",              primaryKey:"violence"   },
    { key:"infiltration",         label:"Infiltration",         primaryKey:"intrigue"   },

    // Scenario modes (Raid-side engines; no GM builders yet)
    { key:"courtly",              label:"Courtly Intrigue",     primaryKey:"diplomacy", kind:"scenario" },
    { key:"infiltration_alarm",   label:"Infiltration (Alarm)", primaryKey:"intrigue",  kind:"scenario" }
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

function _dominantOp(cost){
  if (!cost || typeof cost!=="object") return null;
  let best=null, bestV=-Infinity;
  for (const k of OP_KEYS){
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


// Cost resolver: EFFECTS sometimes store costs as opCosts (canonical) instead of cost.
function _rcCostOf(eff){
  try {
    if (!eff) return {};
    return eff.opCosts || eff.cost || eff.opCost || eff.costs || {};
  } catch(_e){ return {}; }
}

// curated + dynamic maneuver lists
const _MAN_KEYS_BY_TYPE = {
  assault: ["rally_the_line", "supply_overrun", "suppressive_fire", "bless_the_fallen", "command_overdrive", "logistical_surge", "tactical_overwatch", "echo_strike_protocol", "overclock_the_golems", "siege_breaker_volley", "ego_breaker", "qliphothic_gambit"],
  infiltration: ["smoke_and_mirrors", "psychic_disruption", "saboteurs_edge", "signal_hijack", "chrono_loop_command", "reality_hack", "flash_bargain", "overclock_the_golems", "supply_surge", "divine_favor", "battlefield_harmony"],
  infiltration_alarm: ["smoke_and_mirrors", "psychic_disruption", "saboteurs_edge", "signal_hijack", "chrono_loop_command", "reality_hack", "flash_bargain", "overclock_the_golems", "supply_surge", "divine_favor", "battlefield_harmony"],
  espionage: ["flash_bargain", "smoke_and_mirrors", "flash_interdict", "psychic_disruption", "saboteurs_edge", "signal_hijack", "chrono_loop_command", "reality_hack", "void_signal_collapse", "overclock_the_golems"],
  blockade: ["industrial_sabotage", "logistical_surge", "overclock_the_golems"],
  occupation: ["rally_the_line", "suppressive_fire", "last_stand_banner", "command_overdrive", "industrial_sabotage", "logistical_surge", "counter_propaganda_wave", "quantum_shield", "ego_breaker"],
  liberation: ["flash_bargain", "prayer_in_the_smoke", "radiant_rally", "rally_the_line", "bless_the_fallen", "command_overdrive", "empathic_surge", "faithful_intervention", "counter_propaganda_wave", "echo_strike_protocol", "harmonic_chant", "moral_high_ground", "radiant_retaliation", "engine_of_absolution", "sephirotic_intervention", "unity_surge", "flash_interdict"],
  propaganda: ["flash_bargain", "smoke_and_mirrors", "flash_interdict", "empathic_surge", "counter_propaganda_wave", "moral_high_ground", "unity_surge"],
  ritual: ["prayer_in_the_smoke", "bless_the_fallen", "faithful_intervention", "psychic_disruption", "harmonic_chant", "moral_high_ground", "quantum_shield", "radiant_retaliation", "crown_of_mercy", "ego_dragon_echo", "reality_hack", "sephirotic_intervention", "temporal_armistice", "unity_surge", "qliphothic_gambit", "flash_interdict"],
  siege: ["radiant_rally", "supply_overrun", "tactical_overwatch", "defender_s_reversal", "siege_breaker_volley", "void_signal_collapse"],
  assault_defense: ["patch_the_breach", "quantum_shield", "defensive_entrenchment", "last_stand_banner", "defender_s_reversal"],
  occupation_defense: ["patch_the_breach", "defender_s_reversal", "last_stand_banner"],
  siege_defense: ["last_stand_banner", "patch_the_breach", "defender_s_reversal"],
  any: ["supply_surge", "divine_favor", "battlefield_harmony"],
};

function _mansForType(type){
  const eff = _effectsMans();
  let ext = {};
  try { ext = (game.bbttcc?.api?.raid?.getManeuvers?.(type)) || {}; } catch {}

  // GM-only: allow "agent-only" maneuvers (present in agent throughput but not in EFFECTS/registry)
  // so we can test execution wiring without needing full item/registry entries.
  if (_rcIsGMUser()) {
    try {
      const agent = game.bbttcc?.api?.agent;
      const T = agent?.__THROUGHPUT || null;
      if (T && typeof T === "object") {
        const pretty = function(k){
          return String(k||"").replace(/[_-]/g," ").replace(/\b\w/g,function(m){return m.toUpperCase();});
        };
        // Build minimal stubs for any throughput keys missing from EFFECTS/ext.
        for (const k of Object.keys(T)) {
          if (ext[k] || (game.bbttcc?.api?.raid?.EFFECTS && game.bbttcc.api.raid.EFFECTS[k])) continue;
          ext[k] = { key:k, label: pretty(k), cost: {}, benefit: {} };
        }
      }
    } catch(_eAgent) {}
  }


  const keys = (_MAN_KEYS_BY_TYPE[type] || _MAN_KEYS_BY_TYPE.any || []).slice();

  // GM-only: also include "any" maneuvers even when a raid-type-specific list exists,
  // so narrative unlock/test maneuvers (e.g., battlefield_harmony) can be selected during wiring tests.
  if (_rcIsGMUser()) {
    try {
      const anyKeys = (_MAN_KEYS_BY_TYPE.any || []).slice();
      for (let i=0;i<anyKeys.length;i++){
        const k = String(anyKeys[i]||"");
        if (!k) continue;
        if (!keys.includes(k)) keys.push(k);
      }
    } catch(_eAny) {}
  }
  const res = {};
  const add = (k)=>{
    if (!k || res[k]) return;
    const e = eff[k], x = ext[k];
    if (!e && !x) return;
    res[k] = { key:k, label:(e?.label||x?.label||k), cost:(e?.cost||x?.cost||{}), benefit:(e?.benefit||x?.benefit||{}) };
  };
  keys.forEach(add); Object.keys(ext).forEach(add);

  const pKey = primaryKeyFor(type);
  for (const [k,e] of Object.entries(eff)){
    if (res[k]) continue;
    const rtypes = Array.isArray(e.raidTypes) ? e.raidTypes : (e.raidTypes ? [e.raidTypes] : []);
    const applies = rtypes.includes(type) || rtypes.includes("any") || (_dominantOp(e.cost) === pKey);
    if (applies) add(k);
  }

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
    if (e?.defenderAccess === true || DEFENDER_ALWAYS_MANS[String(k||"").toLowerCase()]){ defenseAdds[k]=true; }
  }

  const out = Object.assign({}, def, base);
  for (const k of Object.keys(defenseAdds)){ if (!out[k]) out[k] = eff[k]; }
  return out;
}

// --- Core math helpers ------------------------------------------------------
async function computeDryRun(attacker, { activityKey="assault", difficulty="normal", rollMode="normal", extraBonus=0, attackerBaseOverride=null } = {}, baseDC) {
  // Legacy single-roll vs DC (used for creature targets where no defender faction exists)
  const key = primaryKeyFor(activityKey);
  const attBonus = Number.isFinite(Number(attackerBaseOverride)) ? Number(attackerBaseOverride) : categoryTotal(attacker, key);
  const diffAdj  = Number(RAID_DIFFICULTIES[difficulty]?.modifier ?? 0);
  const DC       = Math.max(0, Number(baseDC||0) + diffAdj);

  const mode = String(rollMode || "normal").toLowerCase();
  const d20 = (mode === "adv") ? "2d20kh1" : (mode === "dis") ? "2d20kl1" : "1d20";

  const roll = new Roll(`${d20} + @b + @x`, { b: attBonus, x: Number(extraBonus||0) });
  await roll.evaluate();
  const total  = roll.total;
  const outcome = (total >= DC + 5) ? "Great Success" : (total >= DC) ? "Success" : "Fail";
  return { key, attBonus, extraBonus:Number(extraBonus||0), rollMode:mode, baseDC:Number(baseDC||0), diffAdj, DC, roll, total, outcome };
}

/** Contested parity
/** Contested parity (A2): attacker and defender both roll.
 * Attacker wins on tie (attTotal >= defTotal).
 * Great Success if margin >= 5.
 *
 * Bonuses:
 *  - Base: Value + Roster (symmetric)
 *  - Staging: ceil(staged/2) (symmetric)
 *  - Difficulty: defender gets RAID_DIFFICULTIES[difficulty].modifier
 *  - Fortification: baseDefense (hex defense or baseline 10 for rigs/facilities) + facility/rig defenderDcBonus
 *  - Defender mods: flags.bbttcc-factions.mods.defense + nextRaid.defenseBonus
 *  - Defender maneuver "DC" bonuses become defender roll bonuses (DEFENDER_DC_MAP)
 *  - Manual diffOffset becomes defender roll bonus (positive favors defender)
 */
async function computeContested(attacker, defender, {
  activityKey="assault",
  difficulty="normal",
  contestedKey=null,
  baseDefense=0,
  facDefBonus=0,
  stagedA=0,
  stagedD=0,
  diffOffset=0,
  nextRaidBonus=0,
  defenderModsDefense=0,
  defenderMans=[],

  // B3: roll modifiers (one-shot, consumed at commit)
  rollModeAtt="normal",
  rollModeDef="normal",
  extraBonusAtt=0,
  extraBonusDef=0,
  attackerBaseOverride=null
} = {}) {
  const key = String(contestedKey || primaryKeyFor(activityKey) || "violence").toLowerCase();

  const attBase = Number.isFinite(Number(attackerBaseOverride)) ? Number(attackerBaseOverride) : categoryTotalWithRoster(attacker, key);
  const defBase = categoryTotalWithRoster(defender, key);

  const attStage = Math.ceil(Number(stagedA||0) / 2);
  const defStage = Math.ceil(Number(stagedD||0) / 2);

  const diffAdj  = Number(RAID_DIFFICULTIES[difficulty]?.modifier ?? 0);

  // Defender maneuver bonuses (formerly DC bonuses)
  let defManBonus = 0;
  try {
    const list = Array.isArray(defenderMans) ? defenderMans : [];
    for (const mk of list) defManBonus += Number(DEFENDER_DC_MAP[String(mk||"").toLowerCase()] || 0);
  } catch {}

  const defFort = Number(baseDefense || 0) + Number(facDefBonus || 0);
  const defExtra = Number(defenderModsDefense || 0) + Number(nextRaidBonus || 0);

  const attTotalBonus = Number(attBase||0) + Number(attStage||0) + Number(extraBonusAtt||0);
  const defTotalBonus = Number(defBase||0) + Number(defStage||0) + diffAdj + Number(diffOffset||0) + defFort + defExtra + defManBonus + Number(extraBonusDef||0);

  const mAtt = String(rollModeAtt||"normal").toLowerCase();
  const mDef = String(rollModeDef||"normal").toLowerCase();
  const d20A = (mAtt === "adv") ? "2d20kh1" : (mAtt === "dis") ? "2d20kl1" : "1d20";
  const d20D = (mDef === "adv") ? "2d20kh1" : (mDef === "dis") ? "2d20kl1" : "1d20";

  const attRoll = new Roll(`${d20A} + @b`, { b: attTotalBonus });
  const defRoll = new Roll(`${d20D} + @b`, { b: defTotalBonus });
  await attRoll.evaluate();
  await defRoll.evaluate();

  const attTotal = attRoll.total;
  const defTotal = defRoll.total;

  const margin = Number(attTotal || 0) - Number(defTotal || 0);
  const attackerWon = margin >= 0;

  const tier = attackerWon
    ? (margin >= 5 ? "Great Success" : "Success")
    : "Fail";

  return {
    key,
    attBase, defBase,
    attStage, defStage,
    diffAdj,
    defFort, defExtra, defManBonus,
    attBonus: attTotalBonus,
    defBonus: defTotalBonus,
    rollModeAtt: mAtt,
    rollModeDef: mDef,
    extraBonusAtt: Number(extraBonusAtt||0),
    extraBonusDef: Number(extraBonusDef||0),
    attRoll, defRoll,
    attTotal, defTotal,
    margin,
    outcome: tier
  };
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
  const supportNames = Array.isArray(round.supportFactionNames) ? round.supportFactionNames.filter(Boolean) : [];
  const coalitionLine = supportNames.length ? `; Support: ${supportNames.join(", ")}` : "";

  const attackerTotal = Number(totalFinal || 0);
  const defenderTotal = Number(dcFinal || 0);
  const margin = attackerTotal - defenderTotal;

  const contested = (round && round.contested === true) || (round.defRoll != null) || (round.dcLabel === "DEF");
  const summary = contested
    ? `${povAction} vs ${vs} — ${diffName}; ${round.roll?.result ?? "—"} → A ${attackerTotal} vs D ${defenderTotal} (Δ ${margin>=0?"+":""}${margin})${spentLine}${mansLine}${coalitionLine}`
    : `${povAction} vs ${vs} — ${diffName}; roll ${round.roll?.result ?? "—"} → ${attackerTotal} vs DC ${defenderTotal}${spentLine}${mansLine}${coalitionLine}`;

  const base = {
    ts, date: dateStr, type: "raid", side,
    opponent: oppName || (side==="att" ? round.targetName : round.attackerName) || "",
    outcome: contested ? (margin >= 0 ? "win" : "loss") : (attackerTotal >= defenderTotal ? "win" : "loss"),
    summary, activityKey: round.activityKey, difficulty: round.difficulty,
    attackerTotal, defenderTotal, margin,
    contested: !!contested,
    contestedKey: round.key || round.contestedKey || round.primaryKey || "",
    attackerBonus: Number(round.attBonus || 0),
    defenderBonus: Number(round.defBonus || 0),
    supportFactionIds: Array.isArray(round.supportFactionIds) ? round.supportFactionIds.slice() : [],
    supportFactionNames: supportNames.slice()
  };

  // Attach target details
  if (round.targetType === "rig") {
    base.targetType = "rig";
    base.rigId = round.rigId || "";
    base.targetName = round.targetName;
  } else if (round.targetType === "creature") {
    base.targetType = "creature";
    base.creatureId = round.creatureId || round.bossKey || "";
    base.targetName = round.targetName;
  } else {
    base.targetType = "hex";
    base.targetUuid = round.targetUuid;
    base.targetName = round.targetName;
  }
  return base;
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
    width: 980, height: 720, minWidth: 760, minHeight: 520, resizable: true, minimizable: true, positionOrtho: true
  };
  static PARTS = { body: { template: "modules/bbttcc-raid/templates/raid-console.hbs" } };

  vm = {
    attackerId:"",
    supportFactionIds:[], // NEW: coalition support factions (GM-controlled)
    activityKey:"assault",
    difficulty:"normal",

    // target
    targetType:"hex", // "hex" | "facility" | "rig" | "creature"
    targetName:"—",
    targetUuid:"",
    defenderId:"",    // for rig targeting
    rigId:"",

    // creature target
    creatureId:"",
    actorUuid:"",
    sceneUuid:"",
    tokenUuid:"",

    // rounds
    rounds:[],

    // logging
    logWar:false,
    includeDefender:true
  };

  _renderCoalitionBar(){
    try {
      const root = (this.element instanceof HTMLElement)
        ? this.element
        : (this.element?.[0] || this.element);

      if (!root) return;

      // Remove prior render copy
      try {
        root.querySelectorAll(".bbttcc-coalition-bar").forEach(el => el.remove());
      } catch(_e){}

      const mount =
        root.querySelector(".window-content") ||
        root.querySelector("section") ||
        root;

      if (!mount) return;

      const wrap = document.createElement("div");
      wrap.className = "bbttcc-coalition-bar";
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.flexWrap = "wrap";
      wrap.style.gap = "8px";
      wrap.style.padding = "6px 8px";
      wrap.style.margin = "0 0 8px 0";
      wrap.style.border = "1px solid rgba(148,163,184,0.25)";
      wrap.style.borderRadius = "10px";
      wrap.style.background = "rgba(15,23,42,0.35)";

      const label = document.createElement("strong");
      label.textContent = "Coalition Support:";
      wrap.appendChild(label);

      const ids = Array.isArray(this.vm.supportFactionIds) ? this.vm.supportFactionIds : [];
      const names = ids
        .map(id => game.actors.get(id))
        .filter(Boolean);

      if (!names.length) {
        const none = document.createElement("span");
        none.textContent = "None";
        none.style.opacity = "0.8";
        none.style.flex = "1 1 auto";
        wrap.appendChild(none);
      } else {
        const list = document.createElement("div");
        list.style.display = "flex";
        list.style.flexWrap = "wrap";
        list.style.gap = "6px";
        list.style.flex = "1 1 auto";

        for (const a of names) {
          const pill = document.createElement("span");
          pill.style.display = "inline-flex";
          pill.style.alignItems = "center";
          pill.style.gap = "6px";
          pill.style.padding = "2px 8px";
          pill.style.borderRadius = "999px";
          pill.style.background = "rgba(30,41,59,0.7)";
          pill.style.border = "1px solid rgba(148,163,184,0.25)";

          const txt = document.createElement("span");
          txt.textContent = a.name;

          const rem = document.createElement("button");
          rem.type = "button";
          rem.textContent = "×";
          rem.setAttribute("data-id", "coalition-remove");
          rem.setAttribute("data-faction-id", a.id);
          rem.style.padding = "0 4px";
          rem.style.lineHeight = "1";
          rem.style.minHeight = "20px";

          pill.appendChild(txt);
          pill.appendChild(rem);
          list.appendChild(pill);
        }

        wrap.appendChild(list);
      }

      const lead = this.vm.attackerId ? (game.actors?.get?.(this.vm.attackerId) || null) : null;
      const pKey = primaryKeyFor(this.vm.activityKey || "assault");
      const coalition = _rcCoalitionBonus(lead, this.vm.supportFactionIds || [], pKey);

      const detail = document.createElement("span");
      detail.style.opacity = "0.82";
      detail.style.fontSize = "11px";
      detail.style.marginLeft = "8px";
      detail.style.flex = "1 1 auto";
      detail.textContent = lead
        ? `(${pKey}) Lead ${Number(coalition.leadTotal || 0)} + Support ${Number(coalition.supportTotal || 0)}${coalition.coordinationPenalty ? ` - Coord ${Number(coalition.coordinationPenalty || 0)}` : ""} = ${Number(coalition.total || 0)}`
        : "";

      wrap.appendChild(detail);

      if (_rcIsGMUser()) {
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "Add Support";
        addBtn.setAttribute("data-id", "coalition-add");
        addBtn.style.marginLeft = "auto";
        wrap.appendChild(addBtn);
      }

      mount.insertBefore(wrap, mount.firstChild);
    } catch(e) {
      console.warn("Coalition render failed", e);
    }
  }

// -----------------------------------------------------------------------
  // Shared Raid Session Sync (Player <-> GM)
  // Stores current raid draft on the attacker faction actor:
  //   flags.bbttcc-raid.raidSession
  // If a player cannot write flags, we fall back to socket->GM write.
  // -----------------------------------------------------------------------

  _sessionPayload(){
    return {
      rev: Number(this.__sessionRev || 0),
      ts: Date.now(),
      attackerId: String(this.vm.attackerId || ""),
      supportFactionIds: Array.isArray(this.vm.supportFactionIds) ? this.vm.supportFactionIds.slice() : [],
      activityKey: String(this.vm.activityKey || "assault"),
      difficulty: String(this.vm.difficulty || "normal"),
      targetType: String(this.vm.targetType || "hex"),
      targetName: String(this.vm.targetName || "—"),
      targetUuid: String(this.vm.targetUuid || ""),
      defenderId: String(this.vm.defenderId || ""),
      rigId: String(this.vm.rigId || ""),
      creatureId: String(this.vm.creatureId || ""),
      actorUuid: String(this.vm.actorUuid || ""),
      sceneUuid: String(this.vm.sceneUuid || ""),
      tokenUuid: String(this.vm.tokenUuid || ""),
      rounds: foundry.utils.duplicate(this.vm.rounds || []),
      logWar: !!this.vm.logWar,
      includeDefender: !!this.vm.includeDefender,
      by: String(game.user?.id || "")
    };
  }

  async _loadSessionFromActor(attackerId){
    try {
      const a = await getActorByIdOrUuid(attackerId);
      if (!a) return null;
      const s = a.getFlag(RAID_ID, "raidSession");
      return (s && typeof s === "object") ? s : null;
    } catch(_e){ return null; }
  }

  async _applySessionIfNewer(attackerId){
    if (!attackerId) return false;
    if (this.__sessionApplying) return false;
    const s = await this._loadSessionFromActor(attackerId);
    if (!s) return false;
    const rev = Number(s.rev || 0);
    if (rev <= Number(this.__sessionRev || 0)) return false;

    this.__sessionApplying = true;
    try {
      // Preserve player lock (attackerId lock) and only apply if same attacker.
      if (String(s.attackerId || "") !== String(this.vm.attackerId || "")) return false;

      // Apply shared session fields
      this.__sessionRev = rev;
      this.vm.supportFactionIds = _rcNormFactionIds(s.supportFactionIds || this.vm.supportFactionIds || []);
      this.vm.activityKey = String(s.activityKey || this.vm.activityKey || "assault");
      this.vm.difficulty  = String(s.difficulty  || this.vm.difficulty  || "normal");
      this.vm.targetType  = String(s.targetType  || this.vm.targetType  || "hex");
      this.vm.targetName  = String(s.targetName  || this.vm.targetName  || "—");
      this.vm.targetUuid  = String(s.targetUuid  || this.vm.targetUuid  || "");
      this.vm.defenderId  = String(s.defenderId  || this.vm.defenderId  || "");
      this.vm.rigId       = String(s.rigId       || this.vm.rigId       || "");
      this.vm.creatureId  = String(s.creatureId  || this.vm.creatureId  || "");
      this.vm.actorUuid   = String(s.actorUuid   || this.vm.actorUuid   || "");
      this.vm.sceneUuid   = String(s.sceneUuid   || this.vm.sceneUuid   || "");
      this.vm.tokenUuid   = String(s.tokenUuid   || this.vm.tokenUuid   || "");
      this.vm.logWar      = !!s.logWar;
      this.vm.includeDefender = (s.includeDefender !== undefined) ? !!s.includeDefender : this.vm.includeDefender;

      this.vm.rounds = Array.isArray(s.rounds) ? foundry.utils.duplicate(s.rounds) : (this.vm.rounds || []);
      return true;
    } finally {
      this.__sessionApplying = false;
    }
  }

  _queueSaveSession(){
    // Debounce rapid UI changes (maneuver checkbox spam, etc.)
    clearTimeout(this.__sessionSaveT);
    this.__sessionSaveT = setTimeout(()=>{ this._saveSessionNow(); }, 120);
  }

  async _saveSessionNow(){
    if (this.__sessionApplying) return;
    const attackerId = String(this.vm.attackerId || "");
    if (!attackerId) return;

    // Increment revision for every local-authoritative change
    this.__sessionRev = Number(this.__sessionRev || 0) + 1;

    const payload = this._sessionPayload();
    payload.rev = Number(this.__sessionRev || 0);

    try {
      const a = await getActorByIdOrUuid(attackerId);
      if (!a) return;

      // Prefer direct write if permitted
      await a.setFlag(RAID_ID, "raidSession", payload);
    } catch(e){
      // Fallback: ask GM to persist via socket
      try {
        game.socket?.emit?.(`module.${RAID_ID}`, { t:"raidSession", attackerId: attackerId, payload: payload });
      } catch(_e2) {}
    }
  }


  _activities(){ return getRaidTypes(); }
  _activityFor(key){ return this._activities().find(a=>a.key===key) || { key, label:key, primaryKey:"violence" }; }

  _mansForActivity(key){ return _mansForType(key); }
  _mansForDefense(key){ return _mansForTypeDefense(key); }

  _supportActors(){
    return _rcCoalitionSupportActors(this.vm.supportFactionIds || [], this.vm.attackerId || "");
  }

  async _openSupportFactionPicker(){
    if (!_rcIsGMUser()) return;
    if (!this.vm.attackerId) return ui.notifications?.warn?.("Pick the lead attacker faction first.");

    const leadId = String(this.vm.attackerId || "");
    const selected = new Set(_rcNormFactionIds(this.vm.supportFactionIds || []));
    const facs = (game.actors?.contents || []).filter(a => isFaction(a) && String(a.id||"") !== leadId).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
    const rows = facs.map(a => {
      const ck = selected.has(a.id) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:.4rem;margin:.2rem 0;"><input type="checkbox" name="supportFaction" value="${a.id}" ${ck}/> <span>${foundry.utils.escapeHTML(String(a.name||a.id))}</span></label>`;
    }).join("") || `<p class="hint">No other faction actors found.</p>`;

    const picked = await new Promise((resolve) => {
      new Dialog({
        title: "Coalition Support Factions",
        content: `<form><p class="hint">Lead attacker: <b>${foundry.utils.escapeHTML(String(game.actors?.get?.(leadId)?.name || "Lead"))}</b></p><div style="max-height:320px;overflow:auto;padding-right:.25rem;">${rows}</div></form>`,
        buttons: {
          ok: { label: "Apply", callback: (html) => {
            const vals = Array.from(html[0].querySelectorAll('input[name="supportFaction"]:checked')).map(el => String(el.value||"").trim()).filter(Boolean);
            resolve(vals);
          }},
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }, { width: 420 }).render(true);
    });

    if (!picked) return;
    this.vm.supportFactionIds = _rcNormFactionIds(picked);
    this._queueSaveSession();
    this.render();
  }

  _renderCoalitionControls(){
    try {
      if (!this.element) return;
      const root = (this.element && typeof this.element.find === "function") ? this.element[0] : this.element;
      if (!root || !root.querySelector) return;

      const attackerSel = root.querySelector('[data-id="attacker"]');
      if (!attackerSel) return;
      const existing = root.querySelector('.bbttcc-coalition-controls');
      if (existing) existing.remove();

      const wrap = document.createElement('div');
      wrap.className = 'bbttcc-coalition-controls';
      wrap.style.marginTop = '.35rem';
      wrap.style.padding = '.45rem .55rem';
      wrap.style.borderRadius = '10px';
      wrap.style.border = '1px solid rgba(148,163,184,0.22)';
      wrap.style.background = 'rgba(2,6,23,0.22)';

      const supports = this._supportActors();
      const pills = supports.length
        ? supports.map(a => `<span class="bbttcc-coalition-pill" style="display:inline-flex;align-items:center;gap:.35rem;padding:.12rem .5rem;border-radius:999px;background:rgba(30,64,175,0.22);border:1px solid rgba(59,130,246,0.35);margin:.15rem .25rem .15rem 0;"><span>${foundry.utils.escapeHTML(String(a.name||a.id))}</span>${_rcIsGMUser() ? `<button type="button" data-id="coalition-remove" data-faction-id="${a.id}" style="border:0;background:transparent;color:inherit;cursor:pointer;font-weight:700;">×</button>` : ``}</span>`).join('')
        : `<span style="opacity:.72;">No support factions selected.</span>`;

      const coalition = this.vm.attackerId ? _rcCoalitionBonus(game.actors?.get?.(this.vm.attackerId) || null, this.vm.supportFactionIds || [], primaryKeyFor(this.vm.activityKey || 'assault')) : null;
      const detail = coalition && coalition.supportActors.length
        ? `<div style="margin-top:.3rem;font-size:11px;opacity:.82;">Coalition bonus (${foundry.utils.escapeHTML(primaryKeyFor(this.vm.activityKey || 'assault'))}): Lead ${Number(coalition.leadTotal||0)} + Support ${Number(coalition.supportTotal||0)}${coalition.coordinationPenalty?` − Coord ${coalition.coordinationPenalty}`:''} = <b>${Number(coalition.total||0)}</b></div>`
        : ``;

      wrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
          <div><b>Coalition Support</b></div>
          ${_rcIsGMUser() ? `<button type="button" data-id="coalition-add" style="padding:.2rem .55rem;border-radius:8px;border:1px solid rgba(59,130,246,0.35);background:rgba(30,64,175,0.18);color:inherit;cursor:pointer;">Add / Edit Support</button>` : ``}
        </div>
        <div style="margin-top:.3rem;">${pills}</div>
        ${detail}`;

      const anchor = attackerSel.closest('.form-group, .form-fields, label, div') || attackerSel;
      anchor.insertAdjacentElement('afterend', wrap);
    } catch(_e) {}
  }
// --- Scenario HUD Strip (Hex Chrome, compact) ----------------------------

  async close(options){
    try { globalThis.__bbttccRaidOpenConsoles?.delete?.(this); } catch(_e) {}
    return super.close(options);
  }

_isScenarioRound(r){
  if (!r) return false;
  const k = String(r.activityKey || "").toLowerCase();
  return (k === "courtly" || k === "infiltration_alarm");
}

_bandLabel(band){
  const b = String(band || "").toLowerCase();
  if (b === "quiet") return "QUIET";
  if (b === "suspicious") return "SUSPICIOUS";
  if (b === "alerted") return "ALERTED";
  if (b === "lockdown") return "LOCKDOWN";
  return b ? b.toUpperCase() : "—";
}

_mkChip(text, { tone="default", title="" } = {}){
  const el = document.createElement("span");
  el.textContent = String(text || "—");
  if (title) el.title = title;

  // Compact Hex Chrome chip
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.gap = ".25rem";
  el.style.padding = "2px 8px";
  el.style.borderRadius = "999px";
  el.style.fontSize = "11px";
  el.style.lineHeight = "1";
  el.style.letterSpacing = ".02em";
  el.style.border = "1px solid rgba(148, 163, 184, 0.25)";

  // tones
  if (tone === "mode") {
    el.style.background = "rgba(59, 130, 246, 0.18)";
    el.style.borderColor = "rgba(59, 130, 246, 0.35)";
    el.style.color = "rgba(226, 232, 240, 0.95)";
    el.style.fontWeight = "700";
    el.style.textTransform = "uppercase";
  } else if (tone === "warn") {
    el.style.background = "rgba(245, 158, 11, 0.16)";
    el.style.borderColor = "rgba(245, 158, 11, 0.35)";
    el.style.color = "rgba(253, 230, 138, 0.95)";
    el.style.fontWeight = "700";
    el.style.textTransform = "uppercase";
  } else if (tone === "bad") {
    el.style.background = "rgba(248, 113, 113, 0.14)";
    el.style.borderColor = "rgba(248, 113, 113, 0.35)";
    el.style.color = "rgba(254, 226, 226, 0.95)";
    el.style.fontWeight = "700";
    el.style.textTransform = "uppercase";
  } else if (tone === "good") {
    el.style.background = "rgba(34, 197, 94, 0.14)";
    el.style.borderColor = "rgba(34, 197, 94, 0.35)";
    el.style.color = "rgba(220, 252, 231, 0.95)";
    el.style.fontWeight = "700";
    el.style.textTransform = "uppercase";
  } else {
    el.style.background = "rgba(15, 23, 42, 0.35)";
    el.style.color = "rgba(226, 232, 240, 0.9)";
  }
  return el;
}

_mkBar(value, max, { w=110 } = {}){
  const v = Math.max(0, Number(value || 0));
  const m = Math.max(1, Number(max || 1));
  const pct = Math.max(0, Math.min(100, Math.round((v / m) * 100)));

  const wrap = document.createElement("span");
  wrap.style.display = "inline-block";
  wrap.style.width = w + "px";
  wrap.style.height = "8px";
  wrap.style.borderRadius = "999px";
  wrap.style.background = "rgba(148, 163, 184, 0.15)";
  wrap.style.border = "1px solid rgba(148, 163, 184, 0.18)";
  wrap.style.overflow = "hidden";
  wrap.style.verticalAlign = "middle";

  const fill = document.createElement("span");
  fill.style.display = "block";
  fill.style.height = "100%";
  fill.style.width = pct + "%";
  fill.style.background = "rgba(59, 130, 246, 0.65)";
  wrap.appendChild(fill);

  return { wrap, pct };
}

_renderScenarioHUD(host, round){
  try {
    if (!host || !round) return;

    const k = String(round.activityKey || "").toLowerCase();
    const sc = round.meta && round.meta.scenario ? round.meta.scenario : null;
    let st = sc && sc.state ? sc.state : null;

    // If this is an OPEN round (draft) OR meta state is missing,
    // pull live state from the active scenario instance so the HUD shows the real round counter.
    if (!st) {
      try {
        if (k === "infiltration_alarm" && this.__infilScenario && typeof this.__infilScenario.getState === "function") {
          const live = this.__infilScenario.getState();
          // Only adopt if it matches the attacker (safety)
          if (!round.attackerId || String(live?.attackerId || "") === String(round.attackerId || "")) {
            st = live;
          }
        }
        if (k === "courtly" && this.__courtlyScenario && typeof this.__courtlyScenario.getState === "function") {
          const live = this.__courtlyScenario.getState();
          if (!round.attackerId || String(live?.attackerId || "") === String(round.attackerId || "")) {
            st = live;
          }
        }
      } catch (e) {}
    }


    // If we don't have state yet (pre-init), keep it minimal but still present.
    const row = document.createElement("div");
    row.className = "bbttcc-scenario-hud";
    row.style.display = "flex";
    row.style.flexWrap = "wrap";
    row.style.alignItems = "center";
    row.style.gap = ".35rem";
    row.style.padding = "6px 8px";
    row.style.marginBottom = "6px";
    row.style.borderRadius = "12px";
    row.style.border = "1px solid rgba(148, 163, 184, 0.20)";
    row.style.background = "linear-gradient(90deg, rgba(2, 6, 23, 0.35), rgba(30, 64, 175, 0.08))";

    if (k === "courtly") {
      row.appendChild(this._mkChip("COURTLY", { tone:"mode" }));

      const rNum = (st && st.round != null)
        ? Number(st.round)
        : (Array.isArray(st?.history) ? st.history.length : 0);

      row.appendChild(this._mkChip("R" + String(rNum), { tone:"default", title:"Scenario round" }));


      const a = st ? Number(st.influenceA || 0) : 0;
      const d = st ? Number(st.influenceD || 0) : 0;
      const maxA = (sc && sc.maxA != null) ? Number(sc.maxA) : Math.max(1, a || 1);
      const maxD = (sc && sc.maxD != null) ? Number(sc.maxD) : Math.max(1, d || 1);

      // A bar
      const aLabel = document.createElement("span");
      aLabel.textContent = "A";
      aLabel.style.fontSize = "11px";
      aLabel.style.opacity = ".85";
      aLabel.style.fontWeight = "700";
      row.appendChild(aLabel);

      const aBar = this._mkBar(a, maxA, { w: 110 });
      row.appendChild(aBar.wrap);

      const aTxt = document.createElement("span");
      aTxt.textContent = `${a}/${maxA}`;
      aTxt.style.fontSize = "11px";
      aTxt.style.opacity = ".9";
      row.appendChild(aTxt);

      // D bar
      const dLabel = document.createElement("span");
      dLabel.textContent = "D";
      dLabel.style.fontSize = "11px";
      dLabel.style.opacity = ".85";
      dLabel.style.fontWeight = "700";
      dLabel.style.marginLeft = "6px";
      row.appendChild(dLabel);

      const dBar = this._mkBar(d, maxD, { w: 110 });
      row.appendChild(dBar.wrap);

      const dTxt = document.createElement("span");
      dTxt.textContent = `${d}/${maxD}`;
      dTxt.style.fontSize = "11px";
      dTxt.style.opacity = ".9";
      row.appendChild(dTxt);

      // Scandal chip (if any)
      const sA = st ? !!st.scandalOnA : false;
      const sD = st ? !!st.scandalOnD : false;
      if (sA || sD) {
        row.appendChild(this._mkChip("⚠ SCANDAL:" + (sA ? "A" : "D"), { tone:"warn", title:"Scandal penalty applies next exchange" }));
      }

      // Outcome chip when resolved
      const oc = st ? String(st.outcome || "") : "";
      if (oc && oc !== "ongoing") {
        const tone = (oc === "attackerWin") ? "good" : (oc === "defenderWin") ? "bad" : "warn";
        const label = (oc === "attackerWin") ? "ATTACKER WIN" : (oc === "defenderWin") ? "DEFENDER WIN" : (oc === "mutualRuin") ? "MUTUAL RUIN" : oc.toUpperCase();
        row.appendChild(this._mkChip(label, { tone }));
      }
    }

    if (k === "infiltration_alarm") {
      row.appendChild(this._mkChip("INFILTRATION", { tone:"mode" }));

      const rNum = (st && st.round != null) ? Number(st.round) : (Array.isArray(st?.history) ? st.history.length : 0);
      row.appendChild(this._mkChip("R" + String(rNum), { tone:"default", title:"Scenario round" }));

      const alarm = st ? Number(st.alarm || 0) : 0;
      const alarmMax = st ? Number(st.alarmMax || (sc && sc.alarmMax) || 5) : (sc && sc.alarmMax ? Number(sc.alarmMax) : 5);
      const band = st?.band ?? (alarm >= alarmMax ? "lockdown" : "quiet");
      const bandLabel = this._bandLabel(band || "");

      const aLabel = document.createElement("span");
      aLabel.textContent = "ALARM";
      aLabel.style.fontSize = "11px";
      aLabel.style.opacity = ".85";
      aLabel.style.fontWeight = "700";
      row.appendChild(aLabel);

      const bar = this._mkBar(alarm, alarmMax, { w: 140 });
      // use red-ish when near lockdown
      if (alarmMax && alarm >= alarmMax) bar.wrap.firstChild.style.background = "rgba(248, 113, 113, 0.7)";
      else if (alarmMax && alarm >= alarmMax - 1) bar.wrap.firstChild.style.background = "rgba(245, 158, 11, 0.75)";

      row.appendChild(bar.wrap);

      const tTxt = document.createElement("span");
      tTxt.textContent = `${alarm}/${alarmMax}`;
      tTxt.style.fontSize = "11px";
      tTxt.style.opacity = ".9";
      row.appendChild(tTxt);

      const tone = (bandLabel === "LOCKDOWN") ? "bad" : (bandLabel === "ALERTED") ? "warn" : "default";
      row.appendChild(this._mkChip(bandLabel, { tone, title:"Alarm band" }));

      // Outcome chip when resolved
      const oc = st ? String(st.outcome || "") : "";
      if (oc && oc !== "ongoing") {
        const label = (oc === "lockdown") ? "LOCKDOWN" : oc.toUpperCase();
        row.appendChild(this._mkChip(label, { tone: (oc === "lockdown") ? "bad" : "default" }));
      }
    }

    if (row.childNodes.length) host.appendChild(row);
  } catch (e) { /* silent */ }
}


  /** Render Manage panel and wire live behavior (attacker + defender preview) */
  _renderManeuversInto(tr, round){
    try {
      const self = this;
      const host = tr.querySelector(".bbttcc-mans-cell"); if (!host) return;
      host.innerHTML = "";

      // Courtly is scenario-only; Infiltration (Alarm) is scenario + maneuvers.
      const ak = String(round?.activityKey || "").toLowerCase();

      if (ak === "courtly") {
        this._renderScenarioHUD(host, round);
        host.insertAdjacentHTML("beforeend", `<em>This mode uses scenario actions (no maneuvers).</em>`);

        tr.querySelectorAll('[data-manage-act="diff"]').forEach(b => b.style.display = "none");
        tr.querySelectorAll('[data-manage-act="stage"]').forEach(b => b.disabled = true);
        return;
      }

      // Alarm mode keeps the scenario HUD, but ALSO allows maneuvers.
      if (ak === "infiltration_alarm") {
        this._renderScenarioHUD(host, round);
      }

      const mapAttRaw = this._mansForActivity(round.activityKey);
      const mapDefRaw = this._mansForDefense(round.activityKey);
      const bossDef = (round.targetType === "creature") ? _rcGetBossDefByKey(round.creatureId || round.bossKey || "") : null;
      const bossDoctrineRaw = (round.targetType === "creature") ? _rcBossDoctrineMap(bossDef) : {};
      // Entitlement filtering (roster-gated Option maneuvers + rig role hooks)
      const attackerActor = game.actors.get(round.attackerId) || null;
      let defenderActor = null;
      try {
        if (round.targetType === "rig") {
          const did = round.defenderId || round.view?.defenderId || "";
          defenderActor = did ? (game.actors.get(did) || null) : null;
        } else if (round.targetType !== "creature") {
          const did = round.view?.defenderId || "";
          defenderActor = did ? (game.actors.get(did) || null) : null;
        }
      } catch {}

      const rigCombatCtxAtt = { rigRole: _lc(this.vm?.attackerRigRole || "") };
      const rigCombatCtxDef = { rigRole: _lc(this.vm?.defenderRigRole || "") };

      const mapAtt = {};
      const mapDef = {};

      for (const [k,v] of Object.entries(mapAttRaw || {})) {
        const gate = _canFactionUseManeuver(attackerActor, k, { side:"att", activityKey: round.activityKey, targetType: round.targetType, rigCombatCtx: rigCombatCtxAtt });
        if (gate.ok) mapAtt[k] = v;
      }
      if (round.targetType === "creature") {
        for (const [k,v] of Object.entries(bossDoctrineRaw || {})) mapDef[k] = v;
      } else {
        for (const [k,v] of Object.entries(mapDefRaw || {})) {
          if (!defenderActor) continue;
          const gate = _canFactionUseManeuver(defenderActor, k, { side:"def", activityKey: round.activityKey, targetType: round.targetType, rigCombatCtx: rigCombatCtxDef });
          if (gate.ok) mapDef[k] = v;
        }
      }

      const isGMView = !!_rcIsGMUser();

      // Players should never see defender maneuver choices.
      if (!_rcIsGMUser()) {
        for (const k of Object.keys(mapDef)) delete mapDef[k];
        round.mansSelectedDef = [];
      }

      const keysA = Object.keys(mapAtt), keysD = Object.keys(mapDef);
      if (!keysA.length && !keysD.length) { host.innerHTML = `<em>No maneuvers for this activity.</em>`; return; }

      round.mansSelected    = Array.isArray(round.mansSelected)    ? round.mansSelected    : [];
      round.mansSelectedDef = Array.isArray(round.mansSelectedDef) ? round.mansSelectedDef : [];

      const wrap = document.createElement("div");
      wrap.style.display="grid"; wrap.style.gridTemplateColumns = (isGMView && keysD.length) ? "1fr 1fr" : "1fr"; wrap.style.gap=".5rem";

      const mkFS = (label, keys, map, side) => {
        const fs = document.createElement("fieldset"); fs.className="bbttcc-mans";
        const lg = document.createElement("legend");
        if (side === "def" && round.targetType === "creature" && bossDef?.label) lg.textContent = `${bossDef.label} Maneuvers`;
        else lg.textContent = `${label} Maneuvers`;
        fs.appendChild(lg);
        if (side === "def" && round.targetType === "creature") {
          const hint = document.createElement("div");
          hint.style.fontSize = "11px";
          hint.style.opacity = ".8";
          hint.style.marginBottom = ".35rem";
          hint.textContent = "Boss doctrine rides the defender-side maneuver lane.";
          fs.appendChild(hint);
        }

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
          lbl.innerHTML = `<input type="checkbox" ${checked?"checked":""} data-maneuver="${k}" data-side="${side}" id="${id}"><span>${m?.label||k}</span><span class="bbttcc-tip-icon" data-tip-kind="maneuver" data-tip-key="${k}" >ⓘ</span>${mkCost(m?.cost)}`;
          grid.appendChild(lbl);
        }

        fs.appendChild(grid);
        return fs;
      };

      const fsA = mkFS("Attacker", keysA, mapAtt, "att");
      wrap.appendChild(fsA);
      if (isGMView && keysD.length) {
        const fsD = mkFS("Defender", keysD, mapDef, "def");
        wrap.appendChild(fsD);
      }

      const projBox = document.createElement("div");
      projBox.className = "bbttcc-proj-spend";
      projBox.style.marginTop=".35rem";
      projBox.style.gridColumn="1 / span 2";
      projBox.innerHTML = isGMView ? `
        <small><i>Projected OP Spend (Att):</i> <b><span data-proj-att></span></b></small>
        <br/><small style="opacity:.85;"><i>Defender OP Spend:</i> <b><span data-proj-def></span></b></small>
        <br/><small style="opacity:.85;"><i>Attacker Bank After (Preview):</i> <b><span data-op-after-att></span></b></small>
        <br/><small style="opacity:.85;"><i>Defender Bank After (Preview):</i> <b><span data-op-after-def></span></b></small>
        <br/><small style="opacity:.85; color:#f97373;" data-op-error-att></small>
        <br/><small style="opacity:.85; color:#f97373;" data-op-error-def></small>` : `
        <small><i>Projected OP Spend (Att):</i> <b><span data-proj-att></span></b></small>
        <br/><small style="opacity:.85;"><i>Attacker Bank After (Preview):</i> <b><span data-op-after-att></span></b></small>
        <br/><small style="opacity:.85; color:#f97373;" data-op-error-att></small>`;
      host.appendChild(wrap);
      host.appendChild(projBox);

      // Coalition OP Contributions (GM-only)
      try {
        if (_rcIsGMUser() && Array.isArray(round.supportFactionIds) && round.supportFactionIds.length) {
          const supportWrap = document.createElement("div");
          supportWrap.className = "bbttcc-support-stage";
          supportWrap.style.marginTop = ".5rem";
          supportWrap.style.padding = ".45rem .55rem";
          supportWrap.style.borderRadius = "10px";
          supportWrap.style.border = "1px solid rgba(148,163,184,0.22)";
          supportWrap.style.background = "rgba(2,6,23,0.18)";

          const title = document.createElement("div");
          title.style.fontWeight = "700";
          title.style.marginBottom = ".35rem";
          title.textContent = "Coalition OP Contributions";
          supportWrap.appendChild(title);

          const supportActors = (round.supportFactionIds || [])
            .map(id => game.actors?.get?.(id))
            .filter(Boolean);

          for (const sf of supportActors) {
            const row = document.createElement("div");
            row.style.marginBottom = ".35rem";

            const hdr = document.createElement("div");
            hdr.style.fontSize = "12px";
            hdr.style.marginBottom = ".2rem";
            hdr.innerHTML = `<b>${foundry.utils.escapeHTML(String(sf.name || sf.id))}</b>`;
            row.appendChild(hdr);

            const keys = OP_KEYS.slice();
            const grid = document.createElement("div");
            grid.style.display = "flex";
            grid.style.flexWrap = "wrap";
            grid.style.gap = ".25rem";

            for (const k of keys) {
              const staged = Number(round?.localStaged?.support?.[sf.id]?.[k] || 0);
              const bank = Number(getOPBank(sf)?.[k] || 0);

              const chip = document.createElement("div");
              chip.style.display = "inline-flex";
              chip.style.alignItems = "center";
              chip.style.gap = ".2rem";
              chip.style.padding = ".15rem .35rem";
              chip.style.border = "1px solid rgba(148,163,184,0.18)";
              chip.style.borderRadius = "999px";
              chip.style.background = "rgba(15,23,42,0.28)";

              chip.innerHTML = `
                <button type="button" data-manage-act="stage" data-who="support" data-faction-id="${sf.id}" data-key="${k}" data-delta="-1">−</button>
                <span><b>${k}</b>: ${staged} / ${bank}</span>
                <button type="button" data-manage-act="stage" data-who="support" data-faction-id="${sf.id}" data-key="${k}" data-delta="1">+</button>
              `;

              grid.appendChild(chip);
            }

            row.appendChild(grid);
            supportWrap.appendChild(row);
          }

          host.appendChild(supportWrap);
        }
      } catch(_eSupportStage) {}      // --- GM: Pending World Effects (MVP Apply Button) --------------------
      // World-level maneuver effects are stored under round.meta.intents.pending.worldEffects.
      // This UI is GM-only and allows manual application via World Mutation Engine for playtesting.
      try {
        if (_rcIsGMUser && _rcIsGMUser()) {
          const pendingWE = (round && round.meta && round.meta.intents && round.meta.intents.pending && Array.isArray(round.meta.intents.pending.worldEffects))
            ? round.meta.intents.pending.worldEffects.slice()
            : [];
          if (pendingWE.length) {
            const types = [];
            for (let i=0;i<pendingWE.length;i++){
              const t = String((pendingWE[i] && pendingWE[i].type) || "").trim();
              if (t && !types.includes(t)) types.push(t);
            }

            const box = document.createElement("div");
            box.className = "bbttcc-worldfx-box";
            box.style.marginTop = "8px";
            box.style.padding = "8px 10px";
            box.style.borderRadius = "12px";
            box.style.border = "1px solid rgba(148,163,184,0.22)";
            box.style.background = "rgba(2,6,23,0.35)";
            box.style.display = "flex";
            box.style.alignItems = "center";
            box.style.justifyContent = "space-between";
            box.style.gap = "8px";

            const left = document.createElement("div");
            left.innerHTML = `<small style="opacity:.9;"><b>Pending World Effects:</b> ${pendingWE.length}${types.length ? ` • <span style="opacity:.85;">${types.slice(0,3).join(", ")}${types.length>3?"…":""}</span>` : ""}</small>`;
            box.appendChild(left);

            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = "Apply (GM)";
            btn.setAttribute("data-act", "apply-worldfx");
            btn.style.padding = "6px 10px";
            btn.style.borderRadius = "10px";
            btn.style.border = "1px solid rgba(59,130,246,0.45)";
            btn.style.background = "rgba(59,130,246,0.18)";
            btn.style.color = "rgba(226,232,240,0.95)";
            btn.style.fontWeight = "700";
            btn.style.cursor = "pointer";
            btn.title = "Apply pending world-level effects via World Mutation Engine (GM-only).";
            box.appendChild(btn);

            // Prevent duplicate boxes if re-rendered in-place
            try { host.querySelectorAll(".bbttcc-worldfx-box").forEach(n=>n.remove()); } catch(_eRm) {}
            host.appendChild(box);

            if (!host.__bbttccWorldFxBound) {
              host.addEventListener("click", async (ev2)=>{
                try {
                  const b = ev2 && ev2.target && ev2.target.closest ? ev2.target.closest('button[data-act="apply-worldfx"]') : null;
                  if (!b) return;
                  ev2.preventDefault(); ev2.stopPropagation();

                  const r2 = round; // current closure round
                  const pend = (r2 && r2.meta && r2.meta.intents && r2.meta.intents.pending && Array.isArray(r2.meta.intents.pending.worldEffects))
                    ? r2.meta.intents.pending.worldEffects.slice()
                    : [];
                  if (!pend.length) {
                    ui.notifications?.info?.("No pending world effects on this round.");
                    return;
                  }

                  const t2 = [];
                  for (let i=0;i<pend.length;i++){
                    const tt = String((pend[i] && pend[i].type) || "").trim();
                    if (tt && !t2.includes(tt)) t2.push(tt);
                  }

                  const ok = confirm(`Apply ${pend.length} pending world effect(s)?\n\n` + (t2.length ? `Types: ${t2.join(", ")}\n\n` : "") + `This will mutate world state via WME.`);
                  if (!ok) return;

                  const wm = game.bbttcc?.api?.worldMutation;
                  if (!wm || typeof wm.applyWorldEffects !== "function") {
                    ui.notifications?.error?.("World Mutation Engine API missing: game.bbttcc.api.worldMutation.applyWorldEffects");
                    return;
                  }

                  const ctx = {
                    factionId: (r2 && r2.attackerId) ? r2.attackerId : null,
                    beatId: (r2 && r2.roundId) ? r2.roundId : "raid_round",
                    beatType: "raid_worldfx_apply",
                    beatLabel: `Raid WorldFX Apply (${String(r2 && r2.activityKey || "raid")})`,
                    source: "raid_console_worldfx_button"
                  };

                  await wm.applyWorldEffects({ worldEffects: pend }, ctx);

                  // Mark applied + clear pending
                  r2.meta ||= {};
                  r2.meta.intents ||= {};
                  r2.meta.intents.pending ||= {};
                  r2.meta.intents.pending.worldEffectsAppliedAt = Date.now();
                  r2.meta.intents.pending.worldEffectsAppliedCount = pend.length;
                  r2.meta.intents.pending.worldEffects = [];

                  try { await self._saveSessionNow(); } catch(_eSS) {}
                  try { ui.notifications?.info?.(`Applied ${pend.length} world effect(s).`); } catch(_eN) {}
                  self.render();
                } catch (e3) {
                  console.error(TAG, "apply worldEffects failed", e3);
                  ui.notifications?.error?.("Failed to apply world effects (see console).");
                }
              }, true);
              host.__bbttccWorldFxBound = true;
            }
          } else {
            // Remove box if no longer pending
            try { host.querySelectorAll(".bbttcc-worldfx-box").forEach(n=>n.remove()); } catch(_eRm2) {}
          }
        }
      } catch(_eWFX) {}

      // Wire tooltip icons (new system)
      try { if (globalThis.BBTTCC_WireTipIcons) globalThis.BBTTCC_WireTipIcons(host); } catch(e) {}


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

      const firePreviewAtt = async (_sumA) => {};
      const firePreviewDef = async (_sumD) => {};

      // NOTE: preview functions were large; keeping your originals is recommended.
      // We keep the recalc + DC projection logic intact, but omit preview bodies here
      // to avoid accidentally breaking your existing preview wiring.

      const recalc = ()=>{
        const sumA = {}, sumD = {};
        const cat = round.view?.cat || primaryKeyFor(round.activityKey);

        host.querySelectorAll('.mans-wrap input[type="checkbox"][data-maneuver]:checked')
          .forEach(cb=>{
            const eff = EFFECTS[cb.dataset.maneuver]; if (!eff) return;
            const {op} = lcKeysCost(_rcCostOf(eff));
            const dst = cb.dataset.side==="def" ? sumD : sumA;
            for (const [k,v] of Object.entries(op||{})){
              const kk = String(k).toLowerCase();
              dst[kk] = (dst[kk]||0) + Number(v||0);
            }
          });

        const stagedA = Number(round?.localStaged?.att?.[cat]||0);
        const stagedD = Number(round?.localStaged?.def?.[cat]||0);

        let stagedSupport = 0;
        const supportStage = round?.localStaged?.support || {};
        for (const bucket of Object.values(supportStage)) {
          stagedSupport += Number(bucket?.[cat] || 0);
        }

        if (stagedA > 0) sumA[cat] = (sumA[cat]||0) + stagedA;
        if (stagedSupport > 0) sumA[cat] = (sumA[cat]||0) + stagedSupport;
        if (stagedD > 0) sumD[cat] = (sumD[cat]||0) + stagedD;

        const tgtA1 = host.querySelector("[data-proj-att]");       if (tgtA1) tgtA1.textContent = textForSpend(sumA);
        const tgtD1 = host.querySelector("[data-proj-def]");       if (tgtD1) tgtD1.textContent = textForSpend(sumD);
        const tgtA2 = tr.parentElement?.querySelector("[data-proj-inline]");     if (tgtA2) tgtA2.textContent = textForSpend(sumA);
        const tgtD2 = tr.parentElement?.querySelector("[data-proj-inline-def]"); if (tgtD2) tgtD2.textContent = textForSpend(sumD);

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

        // previews (kept no-op in this trimmed block)
        firePreviewAtt(sumA);
        firePreviewDef(sumD);
      };
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
          try { self._queueSaveSession(); } catch(_eS) {}
          try {
            const labelMap = (side === "def") ? mapDef : mapAtt;
            if (el.checked) _bbttccFxPlay(key, {
              checkbox: el,
              root: host,
              label: (labelMap?.[key]?.label || key)
            }, { phase: "invoke" });
          } catch(_eFx) {}       });
        host.__bbttccDelegated = true;
      }

      recalc();
    } catch(e){ warn("renderMans", e); }
  }

  _collectMans(idx){
    const r = this.vm.rounds[idx] || {};
    if (Array.isArray(r.mansSelected) || Array.isArray(r.mansSelectedDef)) {
      return { att: (r.mansSelected||[]).slice(), def: (r.mansSelectedDef||[]).slice() };
    }
    return { att: [], def: [] };
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

    // Shared session sync (initial pull during render)
    try {
      if (this.vm.attackerId) await this._applySessionIfNewer(this.vm.attackerId);
    } catch(_eSP) {}

    context.hasRounds = Array.isArray(this.vm.rounds) && this.vm.rounds.length>0;

    // Perspective
    context.isGM = !!_rcIsGMUser();


    const attacker = await getActorByIdOrUuid(this.vm.attackerId);
    context.supportFactionNames = this._supportActors().map(a => a.name);

    // Ensure targetHex is always defined for downstream projection logic
    let targetHex = null;

    // TARGET RESOLUTION: hex OR rig (top preview)
    let defender = null;
    let facilityStatus = null;
    let rigStatus = null;

    if (this.vm.targetType === "rig") {
      defender = this.vm.defenderId ? game.actors.get(this.vm.defenderId) : null;
      const rigProf = defender ? await getRigRaidProfile(defender, this.vm.rigId) : null;
      if (rigProf) {
        rigStatus = {
          name: rigProf.rigName,
          type: rigProf.rigType,
          damageStep: rigProf.damageStep,
          maxStep: Array.isArray(rigProf.hitTrack) ? rigProf.hitTrack.length : 4,
          damageState: rigProf.damageState,
          defenderDcBonus: rigProf.defenderDcBonus,
          maxDefenderUnits: rigProf.maxDefenderUnits,
          attackerExtraOpCost: rigProf.attackerExtraOpCost
        };
      }
    } else if (this.vm.targetType === "creature") {
      targetHex = null;
      defender = null;
      facilityStatus = null;
      rigStatus = null;
    } else {
      targetHex = this.vm.targetUuid ? await fromUuid(this.vm.targetUuid) : null;
      const target = targetHex;
      const defId  = target?.flags?.[TERR_ID]?.factionId || "";
      defender = defId ? game.actors.get(defId) : null;

      if (target && this.vm.targetType === "facility") {
        const facUI = await getFacilityRaidProfile(target);
        if (facUI) {
          facilityStatus = {
            name: facUI.facilityType,
            tier: facUI.tier,
            size: facUI.size,
            damageStep: facUI.damageStep,
            maxStep: Array.isArray(facUI.hitTrack) ? facUI.hitTrack.length : 4,
            damageState: facUI.damageState,
            defenderDcBonus: facUI.defenderDcBonus,
            maxDefenderUnits: facUI.maxDefenderUnits,
            attackerExtraOpCost: facUI.attackerExtraOpCost
          };
        }
      }
    }

    context.facilityStatus = facilityStatus;
    context.rigStatus = rigStatus;

    const catTop = primaryKeyFor(this.vm.activityKey);

    const openRound = (this.vm.rounds || []).find(r => r.open) || null;
    let stagedDTop = 0, diffOffsetTop = 0;
    if (openRound && openRound.localStaged) {
      const k = openRound.view?.cat || primaryKeyFor(openRound.activityKey);
      stagedDTop    = Number(openRound.localStaged?.def?.[k] || 0);
      diffOffsetTop = Number(openRound.diffOffset || 0);
    }

    // Top projected DC
    let baseTop = null, projTop = null, bonusTop = 0, diffTop = 0, facDefTop = 0, nextBTop = 0;
    diffTop = Number(diffOffsetTop || 0);

    if (defender) {
      bonusTop = Math.ceil(stagedDTop / 2);
      const dflags = defender?.flags?.[FCT_ID] || {};
      facDefTop = Number(dflags?.mods?.defense || 0);
      nextBTop  = Number(dflags?.bonuses?.nextRaid?.defenseBonus || 0);

      // Base DC:
      // - Hex/Facility: from hex flags.defense (default 10)
      // - Facility: add facility defenderDcBonus into facDefTop
      // - Rig: use 10 baseline (acts like a "mobile facility"), plus rig defenderDcBonus via facDefTop
      if (this.vm.targetType === "hex" || this.vm.targetType === "facility") {
        const target = this.vm.targetUuid ? await fromUuid(this.vm.targetUuid) : null;
        const flags = target?.getFlag?.(TERR_ID) || target?.flags?.[TERR_ID] || {};
        const baseDC = Number(flags?.defense ?? 10);
        baseTop = baseDC;

        if (this.vm.targetType === "facility") {
          const facTop = target ? await getFacilityRaidProfile(target) : null;
          const facDefBonusTop = Number(facTop?.defenderDcBonus || 0);
          facDefTop += facDefBonusTop;
        }
      } else {
        // Rig target baseline
        baseTop = 10;
        const rigProf = await getRigRaidProfile(defender, this.vm.rigId);
        const rigDefBonus = Number(rigProf?.defenderDcBonus || 0);
        facDefTop += rigDefBonus;
      }

      projTop = baseTop + bonusTop + diffTop + facDefTop + nextBTop;
    }

    const coalitionTop = _rcCoalitionBonus(attacker, this.vm.supportFactionIds || [], catTop);
    context.currentBank = {
      cat: catTop,
      attacker: attacker ? getOPBank(attacker) : null,
      attackerName: attacker?.name || "(none)",
      defender: defender ? getOPBank(defender) : null,
      defenderName: defender?.name || "(none)",
      hasDef: !!defender,
      coalition: coalitionTop,
      topDC: defender ? {
        base: baseTop,
        defProjBonus: bonusTop,
        diff: diffTop,
        facDef: facDefTop,
        nextB: nextBTop,
        projected: projTop,
        breakdown: `Base ${baseTop} + Staged/2 ${bonusTop}${diffTop?` + Diff ${diffTop}`:""}${facDefTop?` + Defense ${facDefTop}`:""}${nextBTop?` + Next-Raid ${nextBTop}`:""} = ${projTop}`
      } : null
    };

    // Per-round view blocks
    for (const r of this.vm.rounds) {
      delete r.view;
      if (!r.open) continue;

      const att = await getActorByIdOrUuid(r.attackerId);

      let def = null;
      let facDefBonus = 0;
      let maxDef = null;
      let extraOp = {};

      if (r.targetType === "rig") {
        def = r.defenderId ? game.actors.get(r.defenderId) : null;
        const rp = def ? await getRigRaidProfile(def, r.rigId) : null;
        facDefBonus = Number(rp?.defenderDcBonus || 0);
        maxDef = (rp?.maxDefenderUnits ? Number(rp.maxDefenderUnits) : null);
        extraOp = rp?.attackerExtraOpCost || {};
      } else {
        const tgt = r.targetUuid ? await fromUuid(r.targetUuid) : null;
        const dId = tgt?.flags?.[TERR_ID]?.factionId || "";
        def = dId ? game.actors.get(dId) : null;
        if (r.targetType === "facility") {
        const fac = await getFacilityRaidProfile(tgt);
        facDefBonus = Number(fac?.defenderDcBonus || 0);
        maxDef = (fac?.maxDefenderUnits ? Number(fac.maxDefenderUnits) : null);
        extraOp = fac?.attackerExtraOpCost || {};
      } else {
        facDefBonus = 0;
        maxDef = null;
        extraOp = {};
      }
      }

      const cat = primaryKeyFor(r.activityKey);
      const staged = r.localStaged || { att:{}, def:{} };
      const bankAtt = att ? getOPBank(att) : _zeroOps();
      const bankDef = def ? getOPBank(def) : _zeroOps();

      const stagedA = Number(staged?.att?.[cat]||0);
      const stagedD = Number(staged?.def?.[cat]||0);

      let stagedSupport = 0;
      const supportStage = staged?.support || {};
      for (const bucket of Object.values(supportStage)) {
        stagedSupport += Number(bucket?.[cat] || 0);
      }

      const remainA = Math.max(0, Number(bankAtt[cat]||0) - stagedA);
      const remainD = Math.max(0, Number(bankDef[cat]||0) - stagedD);

      const defProjBonus = Math.ceil(stagedD / 2);
      const dflagsR = def?.flags?.[FCT_ID] || {};
      const facDefR = Number(dflagsR?.mods?.defense || 0);
      const nextBR  = Number(dflagsR?.bonuses?.nextRaid?.defenseBonus || 0);
      const diffR   = Number(r.diffOffset || 0);

      const facDefTotal = facDefR + facDefBonus;

// Contested preview projection:
// - attackerProjected = (Value+Roster) + ceil((stagedA + stagedSupport)/2)
// - defenderProjected = (Value+Roster) + baseDefense + facDefTotal + nextB + diff + ceil(stagedD/2)
const baseDefense = Number(r.DC || 10);

const coalitionRound = _rcCoalitionBonus(att, r.supportFactionIds || [], cat);
const attBaseRoll = Number(coalitionRound.total || 0);
const defBaseRoll = def ? categoryTotalWithRoster(def, cat) : 0;

const attProj = Number(attBaseRoll || 0) + Math.ceil((stagedA + stagedSupport) / 2);
const defProj = Number(defBaseRoll || 0) + baseDefense + facDefTotal + nextBR + diffR + defProjBonus;
const dcProjected = defProj; // keep legacy name for templates

r.view = {
  cat, hasDef: !!def,
  staged, bankAtt, bankDef,
  remainA, remainD,
  defProjBonus, dcProjected,
  attProj,
  defProj,
  projMargin: attProj - defProj,
  facDef: facDefTotal, facilityDef: facDefBonus,
  baseDefense,
  maxDefenderUnits: maxDef,
  attackerExtraOpCost: extraOp,
  nextB: nextBR, diff: diffR,
  attackerName: att?.name || "(unknown)",
  defenderName: def?.name || "(none)",
  defenderId: def?.id || "",
  coalition: coalitionRound,
  breakdown: `Att ${(attBaseRoll||0)} + ceil((StageA + Support)/2) ${Math.ceil((stagedA + stagedSupport)/2)} = ${attProj}  •  Def ${(defBaseRoll||0)} + Base ${baseDefense} + Staged/2 ${defProjBonus}${diffR?` + Diff ${diffR}`:""}${facDefTotal?` + Defense ${facDefTotal}`:""}${nextBR?` + Next-Raid ${nextBR}`:""} = ${defProj}`};
    }

    return context;
  }

  async _onRender() {
    // enforce locked attacker for player-opened console
    try {
      if (!_rcIsGMUser() && this.vm.__lockAttackerId) {
        this.vm.attackerId = String(this.vm.__lockAttackerId);
      }
    } catch(_e) {}


    // Shared session sync: if another client (player/GM) updated the session, pull it in.
    try {
      if (this.vm.attackerId) {
        const changed = await this._applySessionIfNewer(this.vm.attackerId);
        if (changed) {
          // Re-render to reflect remote edits cleanly.
          return this.render(false);
        }
      }
    } catch(_eSync) {}


    try { _rcApplyGateToAddRoundButton(this); } catch (_eGate) {}

    try {
      if (!this.__centered){
        const curW = Number(this.position?.width || this.options?.width || 980) || 980;
        if (typeof this.setPosition === "function") {
          this.setPosition({
            left: Math.max(24, Math.round((window.innerWidth - curW) / 2)),
            top: 72
          });
        } else {
          const el = this.element;
          if (el && el.style) {
            el.style.left = `calc(50% - ${Math.round(curW/2)}px)`;
            el.style.top  = "72px";
          }
        }
        this.__centered = true;
      }
    } catch {}
    this._bindUI();

    try {
      this._renderCoalitionBar();
    } catch (e) {
      console.warn("Coalition UI failed", e);
    }

    for (let i=0;i<(this.vm.rounds||[]).length;i++){
      const r = this.vm.rounds[i]; if (!r.open) continue;
      const manageRow = this.element?.querySelector(`tbody tr[data-idx="${i}"]`)?.nextElementSibling;
      if (manageRow) this._renderManeuversInto(manageRow, r);
    }
  }

  _bindUI() {
    const $root = $(this.element);
    $root.off(".bbttccRaid");

    // Tooltips (maneuvers) — wire any icons present
    try { if (globalThis.BBTTCC_WireTipIcons) globalThis.BBTTCC_WireTipIcons(this.element?.[0] || this.element); } catch(e) {}


    $root.on("change.bbttccRaid","[data-id='attacker']", (ev)=>{ this.vm.attackerId = ev.currentTarget.value || ""; this.vm.supportFactionIds = _rcNormFactionIds((this.vm.supportFactionIds || []).filter(id => String(id||"") !== String(this.vm.attackerId||""))); this._queueSaveSession(); this.render(); });
    // op gate
    try { _rcApplyGateToAddRoundButton(this); } catch (_eG) {}

    $root.on("change.bbttccRaid","[data-id='activity']",  (ev)=>{ this.vm.activityKey = ev.currentTarget.value || "assault"; this._queueSaveSession(); this.render(); });
    // op gate
    try { _rcApplyGateToAddRoundButton(this); } catch (_eG2) {}

    $root.on("change.bbttccRaid","[data-id='difficulty']",  (ev)=>{ this.vm.difficulty = ev.currentTarget.value || "normal"; this._queueSaveSession(); });
    $root.on("change.bbttccRaid","[data-id='logWar']",      (ev)=>{ this.vm.logWar = ev.currentTarget.checked; this._queueSaveSession(); });
    $root.on("change.bbttccRaid","[data-id='logDef']",      (ev)=>{ this.vm.includeDefender = ev.currentTarget.checked; this._queueSaveSession(); });
    $root.on("click.bbttccRaid","[data-id='coalition-add']", async (ev)=>{ ev.preventDefault(); return this._openSupportFactionPicker(); });
    $root.on("click.bbttccRaid","[data-id='coalition-remove']", (ev)=>{ ev.preventDefault(); const id = String(ev.currentTarget.getAttribute('data-faction-id') || '').trim(); this.vm.supportFactionIds = _rcNormFactionIds((this.vm.supportFactionIds || []).filter(v => String(v||'').trim() !== id)); this._queueSaveSession(); this.render(); });

    // UPDATED: Pick target -> choose Hex or Rig (Option A, dialog)
    $root.on("click.bbttccRaid","[data-id='pick-hex']", async (ev)=>{
      ev.preventDefault();

      const sel = await pickTargetHexOrRig(this.vm);
      if (!sel) return;

      // Scenario modes require a faction defender; disallow creature targets up front.
      if ((this.vm.activityKey === "courtly" || this.vm.activityKey === "infiltration_alarm") && sel.type === "creature") {
        ui.notifications?.warn?.("Scenario modes cannot target creatures. Pick a hex/facility/rig defender target.");
        return;
      }

      if (sel.type === "hex") {
        this.vm.targetType = "hex";
        this.vm.targetUuid = sel.uuid || "";
        this.vm.targetName = sel.name || "—";
        this.vm.defenderId = "";
        this.vm.rigId = "";
        ui.notifications?.info?.(`Target Hex: ${this.vm.targetName}`);
      } else if (sel.type === "facility") {
        this.vm.targetType = "facility";
        this.vm.targetUuid = sel.uuid || "";
        this.vm.targetName = sel.name || "—";
        this.vm.defenderId = "";
        this.vm.rigId = "";
        ui.notifications?.info?.(`Target Facility: ${this.vm.targetName}`);
      } else if (sel.type === "creature") {
        this.vm.targetType = "creature";
        this.vm.targetUuid = "";
        this.vm.defenderId = "";
        this.vm.rigId = "";
        this.vm.creatureId = sel.creatureId || "";
        this.vm.actorUuid = sel.actorUuid || "";
        this.vm.sceneUuid = sel.sceneUuid || "";
        this.vm.tokenUuid = sel.tokenUuid || "";
        this.vm.targetName = sel.name || this.vm.creatureId || "—";
        ui.notifications?.info?.(`Target Creature: ${this.vm.targetName}`);
      } else {
        this.vm.targetType = "rig";
        this.vm.targetUuid = "";
        this.vm.defenderId = sel.defenderId || "";
        this.vm.rigId = sel.rigId || "";
        this.vm.targetName = sel.name || "—";
        ui.notifications?.info?.(`Target Rig: ${this.vm.targetName}`);
      }

      this._queueSaveSession();
      this.render();
    });

    // Add Round: supports hex OR rig
    $root.on("click.bbttccRaid","[data-id='add-round']", async (ev)=>{
      ev.preventDefault();
      if (!this.vm.attackerId) return ui.notifications?.warn?.("Pick an attacker faction first.");

      if (this.vm.targetType === "creature") {
        if (!this.vm.creatureId) return ui.notifications?.warn?.("Pick a creature first.");
      } else if (this.vm.targetType === "rig") {
        if (!this.vm.defenderId) return ui.notifications?.warn?.("Pick a defender faction rig first.");
        if (!this.vm.rigId) return ui.notifications?.warn?.("Pick a rig first.");
      } else if (this.vm.targetType === "rig") {
        // handled above
      } else {
        if (!this.vm.targetUuid) return ui.notifications?.warn?.("Pick a target hex first.");
      }

      const attacker = await getActorByIdOrUuid(this.vm.attackerId);
      if (!attacker) return ui.notifications?.warn?.("Attacker not found.");

      // Raid OP gate: require 1 OP of the activity primary key to DECLARE a round.
      const gate = _rcHasOpForActivity(attacker, this.vm.activityKey);
      if (!gate.ok) {
        ui.notifications?.warn?.("This raid round requires 1 " + _rcOpLabel(gate.key) + " OP. Attacker has 0.");
        try { _rcApplyGateToAddRoundButton(this); } catch (_eG3) {}
        return;
      }

    
      let baseDC = 10;
      let targetName = "—";
      let defender = null;

      if (this.vm.targetType === "creature") {
        const raid = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid) ? game.bbttcc.api.raid : {};
        const bossApi = raid.boss || {};
        const def = (typeof bossApi.get === "function") ? (bossApi.get(this.vm.creatureId) || {}) : {};
        const st = _getBossState(this.vm.creatureId) || {};
        baseDC = 10;
        targetName = _bossStateLabel(def, st) || String(def.label || this.vm.creatureId || "Creature");
        defender = null;
      } else if (this.vm.targetType === "hex") {
        const target = await fromUuid(this.vm.targetUuid);
        if (!target) return;
        const flags = target?.getFlag?.(TERR_ID) || target?.flags?.[TERR_ID] || {};
        baseDC = Number(flags?.defense ?? 10);
        targetName = (flags?.name || target.text || "Hex");
        const defId = target?.flags?.[TERR_ID]?.factionId || "";
        defender = defId ? game.actors.get(defId) : null;
      } else if (this.vm.targetType === "facility") {
        const target = await fromUuid(this.vm.targetUuid);
        if (!target) return;
        const flags = target?.getFlag?.(TERR_ID) || target?.flags?.[TERR_ID] || {};
        baseDC = Number(flags?.defense ?? 10);
        const fac = await getFacilityRaidProfile(target);
        const hexName = (flags?.name || target.text || "Hex");
        const facName = String(fac?.facilityType || fac?.type || "Facility");
        targetName = facName + " @ " + hexName;
        const defId = target?.flags?.[TERR_ID]?.factionId || "";
        defender = defId ? game.actors.get(defId) : null;
      } else if (this.vm.targetType === "rig") {
        defender = game.actors.get(this.vm.defenderId);
        const rp = defender ? await getRigRaidProfile(defender, this.vm.rigId) : null;
        baseDC = 10;
        targetName = `${defender?.name || "Defender"} — ${rp?.rigName || "Rig"}`;
      } else {
        // Fallback: treat as hex
        const target = await fromUuid(this.vm.targetUuid);
        if (!target) return;
        const flags = target?.getFlag?.(TERR_ID) || target?.flags?.[TERR_ID] || {};
        baseDC = Number(flags?.defense ?? 10);
        targetName = (flags?.name || target.text || "Hex");
        const defId = target?.flags?.[TERR_ID]?.factionId || "";
        defender = defId ? game.actors.get(defId) : null;
      }

      const act    = this._activityFor(this.vm.activityKey);
      const supportFactionIds = _rcNormFactionIds(this.vm.supportFactionIds || []);
      const coalition = _rcCoalitionBonus(attacker, supportFactionIds, act.primaryKey || primaryKeyFor(this.vm.activityKey));

      // Scenario modes (Courtly / Alarm Infiltration) don't use the standard DC math preview.
      let comp = null;
      if (act.key === "courtly" || act.key === "infiltration_alarm") {
        comp = {
          key: act.primaryKey || primaryKeyFor(act.key),
          attBonus: Number(coalition.total || 0),
          baseDC: 0,
          diffAdj: 0,
          DC: 0,
          roll: { result: "—" },
          total: 0,
          outcome: "—"
        };
      
} else {
  // If we have a defender faction (hex/facility/rig), use contested preview; otherwise fall back to DC.
  if (defender) {
    let facDefBonus = 0;
    if (this.vm.targetType === "facility" && this.vm.targetUuid) {
      const tgt = await fromUuid(this.vm.targetUuid).catch(()=>null);
      const prof = tgt ? await getFacilityRaidProfile(tgt) : null;
      facDefBonus = Number(prof?.defenderDcBonus || 0);
    }
    if (this.vm.targetType === "rig") {
      const prof = await getRigRaidProfile(defender, this.vm.rigId);
      facDefBonus = Number(prof?.defenderDcBonus || 0);
    }

    const dflags = defender?.flags?.[FCT_ID] || {};
    const defenderModsDefense = Number(dflags?.mods?.defense || 0);
    const nextRaidBonus = Number(dflags?.bonuses?.nextRaid?.defenseBonus || 0);

    const cont = await computeContested(attacker, defender, {
      activityKey: this.vm.activityKey,
      difficulty: this.vm.difficulty,
      contestedKey: act.primaryKey || primaryKeyFor(this.vm.activityKey),
      baseDefense: Number(baseDC || 0),
      facDefBonus,
      stagedA: 0,
      stagedD: 0,
      diffOffset: 0,
      nextRaidBonus,
      defenderModsDefense,
      defenderMans: []
    });

    comp = {
      key: cont.key,
      attBonus: cont.attBonus,
      defBonus: cont.defBonus,
      baseDC: Number(baseDC||0),
      diffAdj: cont.diffAdj,
      DC: cont.defTotal,          // for legacy UI column label; actual contested uses defTotal
      roll: { result: `A ${cont.attRoll.result} vs D ${cont.defRoll.result}` },
      attRoll: cont.attRoll,
      defRoll: cont.defRoll,
      total: cont.attTotal,
      defTotal: cont.defTotal,
      margin: cont.margin,
      outcome: cont.outcome
    };
  } else {
    comp = await computeDryRun(attacker, { activityKey:this.vm.activityKey, difficulty:this.vm.difficulty, attackerBaseOverride: Number(coalition.total || 0) }, baseDC);
  }
}

      const roundSupportStage = {};
      for (const sf of (coalition.supportActors || [])) {
        if (!sf || !sf.id) continue;
        roundSupportStage[String(sf.id)] = {};
      }

      const round = {
        ts: Date.now(),
        attackerId: attacker.id,
        attackerName: attacker.name,
        supportFactionIds: supportFactionIds.slice(),
        supportFactionNames: coalition.supportActors.map(a => a.name),
        coalition: {
          leadFactionId: attacker.id,
          supportFactionIds: supportFactionIds.slice(),
          coordinationPenalty: Number(coalition.coordinationPenalty || 0),
          attackerBase: Number(coalition.total || 0)
        },

        targetType: this.vm.targetType || "hex",
        targetUuid: ((this.vm.targetType==="hex" || this.vm.targetType==="facility") ? (this.vm.targetUuid || "") : ""),
        defenderId: (this.vm.targetType==="rig") ? (this.vm.defenderId || "") : "",
        rigId: (this.vm.targetType==="rig") ? (this.vm.rigId || "") : "",

        creatureId: (this.vm.targetType==="creature") ? (this.vm.creatureId || "") : "",
        actorUuid: (this.vm.targetType==="creature") ? (this.vm.actorUuid || "") : "",
        sceneUuid: (this.vm.targetType==="creature") ? (this.vm.sceneUuid || "") : "",
        tokenUuid: (this.vm.targetType==="creature") ? (this.vm.tokenUuid || "") : "",

        targetName,
        activityKey: act.key,
        activityLabel: act.label,
        difficulty: this.vm.difficulty,

        // (syntax-safe) inline comp fields (no object spread)
        key: comp.key,
        attBonus: comp.attBonus,
        defBonus: Number(comp.defBonus || 0),
        baseDC: comp.baseDC,
        diffAdj: comp.diffAdj,
        DC: comp.DC,
        roll: comp.roll,
        attRoll: comp.attRoll || null,
        defRoll: comp.defRoll || null,
        total: comp.total,
        defTotal: (comp.defTotal != null ? comp.defTotal : null),
        margin: (comp.margin != null ? comp.margin : null),
        contested: !!comp.defRoll,
        dcLabel: (!!comp.defRoll ? "DEF" : ""),
        outcome: comp.outcome,

        open: true,
        roundId: randid(),
        local: true,
        localStaged: {
          att: {},
          def: {},
          support: roundSupportStage
        },

        diffOffset: 0,
        mansSelected: [],
        mansSelectedDef: []
      };

      // Seed creature boss meta from persistent boss state (damageStep/hitTrack)
      if (round.targetType === "creature") {
        try {
          const bm = _ensureRoundBossMeta(round, round.creatureId);
          const nm2 = _bossStateLabel(bm.def, { damageState: bm.stateName }) || round.targetName;
          round.targetName = String(nm2 || round.targetName || "Creature");
        } catch (e) {}
      }


      // Auto-queue from last existing round (if present)
      const last = (this.vm.rounds||[]).slice(-1)[0];
      if (last) {
        if (Array.isArray(last.mansSelected))    round.mansSelected    = last.mansSelected.slice();
        if (Array.isArray(last.mansSelectedDef)) round.mansSelectedDef = last.mansSelectedDef.slice();
      }

      // B3: Logistical Surge — if attacker has a pending "repeat last maneuver for free" token, pre-seed it on this new round.
      try {
        const pending = _b3GetNextRoundRepeat(attacker);
        if (pending && pending.key) {
          // Pre-check the maneuver so the player can simply uncheck if they don't want it.
          const k = pending.key;
          round.mansSelected = Array.isArray(round.mansSelected) ? round.mansSelected : [];
          if (!round.mansSelected.map(v=>String(v||"").toLowerCase()).includes(k)) round.mansSelected.push(k);
          // Mark as free so OP cost is not charged when selected.
          _b3MarkManeuverFreeOnRound(round, k);
          round.meta ||= {};
          round.meta.b3 ||= {};
          round.meta.b3.repeatOffer = { key: k, free: true, srcRoundId: pending.srcRoundId || null, ts: pending.ts || Date.now() };
        }
      } catch(_eLSB) {}

      // Seed staged attacker OP from plan (unchanged)
      const cat = act.primaryKey;
      const plan = foundry.utils.getProperty(attacker, `flags.${FCT_ID}.raidPlan`) || {};
      const want = Number(plan?.[cat]?.value ?? plan?.[cat] ?? 0) || 0;
      const avail = getOPBank(attacker)?.[cat] || 0;
      const staged = Math.min(Math.max(0, want), avail);
      if (staged > 0) round.localStaged.att[cat] = staged;

      ui.notifications?.info?.(`Imported Raid Plan (${cat}): requested ${want} → staged ${staged} (bank ${avail}).`);
      this.vm.rounds.push(round);
      this._queueSaveSession();
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

    // Sync maneuver selections from DOM before any commit logic (covers scenario modes too)
    try { _rcSyncManeuverSelectionsFromDOM(this, idx, r); } catch(_eSyncM2) {}

    // Sync maneuver selections from DOM (prevents UI/array desync).
    try { _rcSyncManeuverSelectionsFromDOM(this, idx, r); } catch(_eSyncM) {}

      const act = btn.dataset.manageAct;
      if (act === "close")  { r.open = false; return this.render(); }
      if (act === "cancel") { r.cancelled = true; r.open = false; r.mansSelected=[]; r.mansSelectedDef=[]; return this.render(); }
      if (act === "diff")   { const d=Number(btn.dataset.delta||0); r.diffOffset = clamp(Number(r.diffOffset||0)+d,-50,50); return this.render(); }
      if (act === "stage")  { return this._stageOP(idx, btn.dataset); }
      if (act === "commit") { return this._commitRound(idx); }

    });
  }

  async _stageOP(idx, { who, key, delta, factionId }){
    const side = String(who || "").toLowerCase();

    // Players may stage attacker OP only; defender/support staging is GM-only.
    if (!_rcIsGMUser() && (side === "def" || side === "support")) {
      try { ui.notifications?.warn?.("Only the GM can stage defender or support OP."); } catch(_e) {}
      return;
    }

    const r = this.vm.rounds[idx];
    if (!r) return;

    const opKey = String(key || "").toLowerCase().trim();
    const d = Number(delta || 0);
    if (!opKey || !Number.isFinite(d) || !d) return;

    r.localStaged ||= { att:{}, def:{}, support:{} };

    let actorId = "";
    let bucket = null;
    let label = "Faction";

    if (side === "att") {
      actorId = r.attackerId || "";
      bucket = (r.localStaged.att ||= {});
      label = "Attacker";
    } else if (side === "def") {
      if (r.targetType === "rig") actorId = r.defenderId || "";
      else {
        const t = r.targetUuid ? await fromUuid(r.targetUuid) : null;
        actorId = t?.flags?.[TERR_ID]?.factionId || "";
      }
      bucket = (r.localStaged.def ||= {});
      label = "Defender";
    } else if (side === "support") {
      const sfid = String(factionId || "").trim();
      if (!sfid) {
        ui.notifications?.warn?.("No support faction specified.");
        return;
      }
      actorId = sfid;
      r.localStaged.support ||= {};
      bucket = (r.localStaged.support[sfid] ||= {});
      const a0 = game.actors?.get?.(sfid);
      label = a0?.name || "Support";
    } else {
      return;
    }

    const actor = await getActorByIdOrUuid(actorId);
    const bank  = actor ? getOPBank(actor) : _zeroOps();

    const stagedAlready = Number(bucket[opKey] || 0);
    const remain = Number(bank[opKey] || 0) - stagedAlready;

    if (d > 0 && remain <= 0) {
      ui.notifications?.warn?.(`${label} has no ${opKey} left in OP Turn Bank.`);
      return;
    }

    const max = Number(bank[opKey] || 0);
    const next = Math.max(0, stagedAlready + d);
    bucket[opKey] = Math.min(max, next);

    // cleanup empty support buckets
    if (side === "support" && actorId) {
      const b = r.localStaged?.support?.[actorId] || {};
      const hasAny = Object.values(b).some(v => Number(v || 0) > 0);
      if (!hasAny) delete r.localStaged.support[actorId];
    }

    this._queueSaveSession();
    return this.render();
  }
  
async _postRoundCard(idx){
  const r = this.vm.rounds[idx]; if (!r) return;
  const diffName = RAID_DIFFICULTIES[r.difficulty]?.name ?? r.difficulty;

  const contested = !!r.contested || (r.defTotal != null) || (r.defRoll != null) || (r.dcLabel === "DEF");
  const tgtLabel = (r.targetType === "rig") ? "Target Rig" : (r.targetType === "creature" ? "Target Creature" : "Target Hex");
  const mansA = (r.mansSelected?.length) ? `<br/><i>Maneuvers (Att):</i> ${r.mansSelected.join(", ")}` : "";
  const mansD = (r.mansSelectedDef?.length) ? `<br/><i>Maneuvers (Def):</i> ${r.mansSelectedDef.join(", ")}` : "";
  const supportNames = Array.isArray(r.supportFactionNames) ? r.supportFactionNames.filter(Boolean) : [];
  const coalitionLine = supportNames.length ? `<br/><i>Support:</i> ${supportNames.join(", ")}` : "";

  const aTotal = Number(r.total ?? 0) || 0;
  const dTotal = Number((contested ? (r.defTotal ?? r.dcFinal) : (r.dcFinal ?? r.DC)) ?? 0) || 0;
  const margin = aTotal - dTotal;

  const attLine = contested
    ? `<code>${foundry.utils.escapeHTML(String(r.attRoll?.result || r.roll?.result || "—"))}</code> = <strong>${aTotal}</strong>`
    : `<code>${foundry.utils.escapeHTML(String(r.roll?.result || "—"))}</code> ${aTotal?`= <strong>${aTotal}</strong>`:""}`;

  const defLine = contested
    ? `<code>${foundry.utils.escapeHTML(String(r.defRoll?.result || "—"))}</code> = <strong>${dTotal}</strong>`
    : `<span class="center">${dTotal}</span>`;

  const outcome = String(r.outcome ?? "—");
  const marginTxt = contested ? `<strong>${margin>=0?"+":""}${margin}</strong>` : "—";

  const card = `
    <section class="bbttcc-raid">
      <h3 style="margin:0 0 .25rem 0;">BBTTCC — Raid (Round ${idx+1})</h3>
      <p style="margin:.25rem 0;"><strong>Activity:</strong> ${foundry.utils.escapeHTML(r.activityLabel)} • <strong>Difficulty:</strong> ${diffName}${r.diffOffset?` • <strong>Adj:</strong> ${r.diffOffset>0?'+':''}${r.diffOffset}`:''}${mansA}${mansD}${coalitionLine}</p>
      <table class="bbttcc-table" style="width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;">Attacker</th>
            <th>${tgtLabel}</th>
            <th>${contested ? "Att Roll" : "Roll"}</th>
            <th>${contested ? "Def Roll" : "DC"}</th>
            <th>${contested ? "Margin" : "—"}</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody><tr>
          <td>${foundry.utils.escapeHTML(r.attackerName)} <small>(+${Number(r.attBonus||0)} ${foundry.utils.escapeHTML(String(r.key||""))})</small></td>
          <td>${foundry.utils.escapeHTML(r.targetName)}</td>
          <td class="center">${attLine}</td>
          <td class="center">${defLine}</td>
          <td class="center">${marginTxt}</td>
          <td class="center"><strong>${foundry.utils.escapeHTML(outcome)}</strong></td>
        </tr></tbody>
      </table>
    </section>`;
  ChatMessage.create({ speaker:{alias:"BBTTCC Raid"}, flavor:card, whisper: game.users.filter(u=>u.isGM).map(u=>u.id) });
}

  async _commitRound(idx){
    // Player safety: only GMs can resolve (commit roll).
    if (!_rcIsGMUser()) {
      ui.notifications?.warn?.("Waiting for GM to resolve the round.");
      return;
    }

    const r = this.vm.rounds[idx]; if (!r) return;

    const attacker = await getActorByIdOrUuid(r.attackerId);
    if (!attacker) return ui.notifications?.warn?.("Attacker not found.");
    const __coalition = _rcCoalitionBonus(attacker, r.supportFactionIds || [], r.view?.cat || primaryKeyFor(r.activityKey));
    r.supportFactionIds = _rcNormFactionIds(r.supportFactionIds || []);
    r.supportFactionNames = __coalition.supportActors.map(a => a.name);
    r.coalition = Object.assign({}, (r.coalition || {}), { leadFactionId: attacker.id, supportFactionIds: r.supportFactionIds.slice(), coordinationPenalty: Number(__coalition.coordinationPenalty || 0), attackerBase: Number(__coalition.total || 0) });

    // Snapshot OP banks before any spending so we can avoid double-spend if another resolver already debited.
    const __bankAttBefore = getOPBank(attacker);
    let __bankDefBefore = null;

// B3: consume one-shot roll modifiers that were granted by prior roundEffects (nextRoll).
const __b3Pending = await _b3ConsumePendingRollMods(attacker);
const __b3AttExtra = Number(__b3Pending?.nextRoll?.att?.bonus || 0) || 0;
const __b3DefExtra = Number(__b3Pending?.nextRoll?.def?.bonus || 0) || 0;
const __b3AttMode  = String(__b3Pending?.nextRoll?.att?.mode || "normal");
const __b3DefMode  = String(__b3Pending?.nextRoll?.def?.mode || "normal");

    // Commit gate (safety): If op.commit was unavailable at Add Round time, we still enforce 1 OP here.
    // We DO NOT spend again here; Add Round already spent when possible.
    try {
      const gate = _rcHasOpForActivity(attacker, r.activityKey);
      if (!gate.ok) {
        ui.notifications?.warn?.("Cannot commit: requires 1 " + _rcOpLabel(gate.key) + " OP to attempt this action.");
        return;
      }
    } catch (_eCG) {}


    // ---------------------------------------------------------------------
    // Scenario Modes (Courtly Intrigue / Infiltration Alarm)
    // These bypass standard raid resolution and use the dedicated engines.
    // ---------------------------------------------------------------------
    if (r && (r.activityKey === "courtly" || r.activityKey === "infiltration_alarm")) {
      // Scenario modes require a defender faction (no creature targets).
      if (r.targetType === "creature") {
        ui.notifications?.warn?.("Scenario modes require a defender faction. Creature targets are not valid here.");
        return;
      }

      let defender = null;
      try {
        if (r.targetType === "rig") defender = r.defenderId ? game.actors.get(r.defenderId) : null;
        else if (r.targetType === "hex" || r.targetType === "facility") {
          const tgt = r.targetUuid ? await fromUuid(r.targetUuid).catch(()=>null) : null;
          const did = tgt?.flags?.[TERR_ID]?.factionId || "";
          defender = did ? game.actors.get(did) : null;
        }
      } catch {}
      if (!defender) return ui.notifications?.warn?.("Scenario modes require a defender faction (hex/facility/rig target).");

      const raidApi = game.bbttcc?.api?.raid || {};

      // ----------------------------------------------------------
      // Courtly Intrigue
      // ----------------------------------------------------------
      if (r.activityKey === "courtly") {
        if (typeof raidApi.courtly !== "function") {
          ui.notifications?.error?.("Courtly engine not loaded. (raid-courtly.influence.enhancer.js)");
          return;
        }

        // Create once per console session (or when attacker/defender changes)
        if (!this.__courtlyScenario || this.__courtlyScenarioAtt !== attacker.id || this.__courtlyScenarioDef !== defender.id) {
          const init = await new Promise((resolve) => {
            new Dialog({
              title: "Courtly Intrigue — Initialize",
              content: `
                <form>
                  <p class="hint">Initial commitment sets starting Influence HP. You can leave these at 0 for a quick test.</p>
                  <div class="form-group"><label>Attacker: Diplomacy OP commit</label><input type="number" name="atkDip" value="0" min="0" step="1"/></div>
                  <div class="form-group"><label>Attacker: Soft Power OP commit</label><input type="number" name="atkSoft" value="0" min="0" step="1"/></div>
                  <hr/>
                  <div class="form-group"><label>Defender: Diplomacy OP commit</label><input type="number" name="defDip" value="0" min="0" step="1"/></div>
                  <div class="form-group"><label>Defender: Soft Power OP commit</label><input type="number" name="defSoft" value="0" min="0" step="1"/></div>
                  <div class="form-group"><label>Label</label><input type="text" name="label" value="Courtly Intrigue"/></div>
                </form>`,
              buttons: {
                ok: { label:"Start", callback:(html)=> {
                  const f = html[0].querySelector("form");
                  resolve({
                    atkDip: Number(f.atkDip.value||0),
                    atkSoft: Number(f.atkSoft.value||0),
                    defDip: Number(f.defDip.value||0),
                    defSoft: Number(f.defSoft.value||0),
                    label: String(f.label.value||"Courtly Intrigue")
                  });
                }},
                cancel: { label:"Cancel", callback:()=>resolve(null) }
              },
              default: "ok",
              close: ()=>resolve(null)
            }, { width: 520 }).render(true);
          });
          if (!init) return;

          try {
            this.__courtlyScenario = await raidApi.courtly({
              attackerId: attacker.id,
              defenderId: defender.id,
              atkInitDip: init.atkDip,
              atkInitSoft: init.atkSoft,
              defInitDip: init.defDip,
              defInitSoft: init.defSoft,
              label: init.label
            });
            this.__courtlyScenarioAtt = attacker.id;
            this.__courtlyScenarioDef = defender.id;

            // Capture initial max Influence for HUD (compact strip)
            try {
              r.meta ||= {};
              r.meta.scenario ||= {};
              const st0 = (this.__courtlyScenario && typeof this.__courtlyScenario.getState === "function") ? this.__courtlyScenario.getState() : null;
              if (st0) {
                if (r.meta.scenario.maxA == null) r.meta.scenario.maxA = Number(st0.influenceA || 0);
                if (r.meta.scenario.maxD == null) r.meta.scenario.maxD = Number(st0.influenceD || 0);
              }
            } catch (e2) {}
          } catch (e) {
            warn("courtly init failed", e);
            ui.notifications?.error?.("Courtly init failed — see console.");
            return;
          }
        }

        const stepArgs = await new Promise((resolve) => {
          const actions = [
            ["persuade","Persuade (Diplomacy)"],
            ["inspire","Inspire (Soft Power)"],
            ["expose","Expose (Intrigue)"],
            ["intimidate","Intimidate (Violence Aura)"]
          ].map(([k,l])=>`<option value="${k}">${l}</option>`).join("");
          new Dialog({
            title: "Courtly Intrigue — Exchange",
            content: `
              <form>
                <div class="form-group"><label>Attacker Action</label><select name="atkAction">${actions}</select></div>
                <div class="form-group"><label>Attacker Spend (OP)</label><input type="number" name="atkSpend" value="2" min="0" step="1"/></div>
                <div class="form-group"><label>Attacker Skill Bonus</label><input type="number" name="atkSkill" value="0" step="1"/></div>
                <hr/>
                <div class="form-group"><label>Defender Action</label><select name="defAction">${actions}</select></div>
                <div class="form-group"><label>Defender Spend (OP)</label><input type="number" name="defSpend" value="2" min="0" step="1"/></div>
                <div class="form-group"><label>Defender Skill Bonus</label><input type="number" name="defSkill" value="0" step="1"/></div>
                <div class="form-group"><label>Note (optional)</label><input type="text" name="note" value=""/></div>
              </form>`,
            buttons: {
              ok: { label:"Resolve", callback:(html)=>{
                const f = html[0].querySelector("form");
                resolve({
                  atkAction: f.atkAction.value,
                  defAction: f.defAction.value,
                  atkSpend: Number(f.atkSpend.value||0),
                  defSpend: Number(f.defSpend.value||0),
                  atkSkillBonus: Number(f.atkSkill.value||0),
                  defSkillBonus: Number(f.defSkill.value||0),
                  note: String(f.note.value||"")
                });
              }},
              cancel: { label:"Cancel", callback:()=>resolve(null) }
            },
            default: "ok",
            close: ()=>resolve(null)
          }, { width: 520 }).render(true);
        });
        if (!stepArgs) return;

        let st = null;
        try { st = await this.__courtlyScenario.step(stepArgs); }
        catch (e) { warn("courtly step failed", e); ui.notifications?.error?.("Courtly step failed — see console."); return; }

        const last = (st?.history && st.history.length) ? st.history[st.history.length-1] : null;
        r.roll = { result: String((last?.atkTotal ?? 0)) + " vs " + String((last?.defTotal ?? 0)) };
        r.total = Number(last?.atkTotal ?? 0);
        r.dcFinal = Number(last?.defTotal ?? 0);
        r.outcome = String(st?.outcome || "ongoing").toUpperCase();
        r.open = false; r.committed = true; r.committedAt = Date.now();
        r.meta ||= {};
        r.meta.scenario = {
          kind:"courtly",
          maxA: (r.meta && r.meta.scenario && r.meta.scenario.maxA != null) ? r.meta.scenario.maxA : (st?.maxA != null ? st.maxA : st?.influenceA),
          maxD: (r.meta && r.meta.scenario && r.meta.scenario.maxD != null) ? r.meta.scenario.maxD : (st?.maxD != null ? st.maxD : st?.influenceD),
          state: {
            influenceA: st?.influenceA,
            influenceD: st?.influenceD,
            scandalOnA: st?.scandalOnA,
            scandalOnD: st?.scandalOnD,
            outcome: st?.outcome,
            round: st?.round
          }
        };

        const ts = Date.now(), dateStr = new Date(ts).toLocaleString();
        const summary = `Courtly: ${attacker.name} vs ${defender.name} — ${r.roll.result} • Influence ${st?.influenceA}/${st?.influenceD} • ${r.outcome}`;
        await appendWarLog(attacker, { ts, date:dateStr, type:"scenario", scenario:"courtly", side:"att", opponent:defender.name, summary });
        if (this.vm.includeDefender) await appendWarLog(defender, { ts, date:dateStr, type:"scenario", scenario:"courtly", side:"def", opponent:attacker.name, summary });

        return this.render();
      }

      // ----------------------------------------------------------
      // Infiltration (Alarm)
      // ----------------------------------------------------------
      if (r.activityKey === "infiltration_alarm") {
        if (typeof raidApi.infiltration !== "function") {
          ui.notifications?.error?.("Infiltration engine not loaded. (raid-infiltration.alarm.enhancer.js)");
          return;
        }

        if (!this.__infilScenario || this.__infilScenarioAtt !== attacker.id || this.__infilScenarioDef !== defender.id) {
          const init = await new Promise((resolve) => {
            new Dialog({
              title: "Infiltration (Alarm) — Initialize",
              content: `
                <form>
                  <p class="hint">Difficulty adds to defender rolls. Alarm Max is the lockdown threshold.</p>
                  <div class="form-group"><label>Difficulty</label><input type="number" name="difficulty" value="0" step="1"/></div>
                  <div class="form-group"><label>Alarm Max</label><input type="number" name="alarmMax" value="5" min="1" step="1"/></div>
                  <div class="form-group"><label>Label</label><input type="text" name="label" value="Infiltration"/></div>
                </form>`,
              buttons: {
                ok: { label:"Start", callback:(html)=>{
                  const f = html[0].querySelector("form");
                  resolve({
                    difficulty: Number(f.difficulty.value||0),
                    alarmMax: Number(f.alarmMax.value||5),
                    label: String(f.label.value||"Infiltration")
                  });
                }},
                cancel: { label:"Cancel", callback:()=>resolve(null) }
              },
              default: "ok",
              close: ()=>resolve(null)
            }, { width: 520 }).render(true);
          });
          if (!init) return;

          try {
            this.__infilScenario = await raidApi.infiltration({
              attackerId: attacker.id,
              defenderId: defender.id,
              difficulty: init.difficulty,
              alarmMax: init.alarmMax,
              label: init.label
            });
            this.__infilScenarioAtt = attacker.id;
            this.__infilScenarioDef = defender.id;

            // Capture scenario max for HUD (compact strip)
            try {
              r.meta ||= {};
              r.meta.scenario ||= {};
              const st0 = (this.__infilScenario && typeof this.__infilScenario.getState === "function") ? this.__infilScenario.getState() : null;
              if (st0 && r.meta.scenario.alarmMax == null) r.meta.scenario.alarmMax = Number(st0.alarmMax || 0);
            } catch (e2) {}
          } catch (e) {
            warn("infiltration init failed", e);
            ui.notifications?.error?.("Infiltration init failed — see console.");
            return;
          }
        }

        const stepArgs = await new Promise((resolve) => {
          new Dialog({
            title: "Infiltration (Alarm) — Round",
            content: `
              <form>
                <div class="form-group"><label>Attacker Spend (Intrigue OP)</label><input type="number" name="atk" value="2" min="0" step="1"/></div>
                <div class="form-group"><label>Defender Spend (Nonlethal OP)</label><input type="number" name="def" value="2" min="0" step="1"/></div>
                <div class="form-group"><label>Flashback (optional)</label>
                  <div class="form-fields">
                    <input type="checkbox" name="flash" style="margin-right:.5rem;"/>
                    <span class="hint">Spend Intrigue OP to reduce Alarm by 1 (once per round).</span>
                  </div>
                </div>
                <div class="form-group"><label>Flashback Cost (Intrigue OP)</label><input type="number" name="flashCost" value="2" min="0" step="1"/></div>
                <div class="form-group"><label>Note (optional)</label><input type="text" name="note" value=""/></div>
              </form>`,
            buttons: {
              ok: { label:"Resolve", callback:(html)=>{
                const f = html[0].querySelector("form");
                resolve({
                  spendIntrigue: Number(f.atk.value||0),
                  spendNonlethal: Number(f.def.value||0),
                  flash: !!f.flash.checked,
                  flashCost: Number(f.flashCost.value||0),
                  note: String(f.note.value||"")
                });
              }},
              cancel: { label:"Cancel", callback:()=>resolve(null) }
            },
            default: "ok",
            close: ()=>resolve(null)
          }, { width: 520 }).render(true);
        });
        if (!stepArgs) return;

        try {
          if (stepArgs.flash) {
            await this.__infilScenario.flashback({ costIntrigue: stepArgs.flashCost, note: "Flashback" });
          }
        } catch (e) { /* ignore flashback errors */ }

        let st = null;
        try { st = await this.__infilScenario.step({ spendIntrigue: stepArgs.spendIntrigue, spendNonlethal: stepArgs.spendNonlethal, note: stepArgs.note }); }
        catch (e) { warn("infiltration step failed", e); ui.notifications?.error?.("Infiltration step failed — see console."); return; }

        const last = (st?.history && st.history.length) ? st.history[st.history.length-1] : null;
        r.roll = { result: String((last?.atkTotal ?? 0)) + " vs " + String((last?.defTotal ?? 0)) };
        r.total = Number(last?.atkTotal ?? 0);
        r.dcFinal = Number(last?.defTotal ?? 0);
        r.outcome = (st?.outcome === "lockdown") ? "LOCKDOWN" : String(last?.band || "ongoing").toUpperCase();
        r.open = false; r.committed = true;
        r.meta ||= {};
        r.meta.scenario = {
          kind:"infiltration_alarm",
          alarmMax: (st?.alarmMax != null) ? st.alarmMax : (r.meta && r.meta.scenario ? r.meta.scenario.alarmMax : null),
          state: {
            alarm: st?.alarm,
            alarmMax: st?.alarmMax,
            outcome: st?.outcome,
            band: (last?.band || (st?.alarm >= st?.alarmMax ? "lockdown" : "")),
            round: st?.round
          }
        };

        const ts = Date.now(), dateStr = new Date(ts).toLocaleString();
        const summary = `Infiltration: ${attacker.name} vs ${defender.name} — ${r.roll.result} • Alarm ${st?.alarm}/${st?.alarmMax} (${last?.band}) • ${r.outcome}`;
        await appendWarLog(attacker, { ts, date:dateStr, type:"scenario", scenario:"infiltration", side:"att", opponent:defender.name, summary });
        if (this.vm.includeDefender) await appendWarLog(defender, { ts, date:dateStr, type:"scenario", scenario:"infiltration", side:"def", opponent:attacker.name, summary });

        // --- Scenario Maneuvers: apply OP spend + B2 intents (scenarioEffects like Smoke & Mirrors) ---
        try {
          // Derive success tier for maneuver intents from scenario totals.
          const atkWon = (Number(r.total || 0) >= Number(r.dcFinal || 0));
          r.meta ||= {};
          r.meta.scenarioOutcomeTier = atkWon ? "success" : "fail";

          // Spend OP for selected maneuvers + staged OP (same model as standard raids)
          const EFFECTS = (game.bbttcc?.api?.raid?.EFFECTS) || {};
          const cat = primaryKeyFor(r.activityKey);
          const listA = Array.isArray(r.mansSelected) ? r.mansSelected.slice() : [];
          const listD = Array.isArray(r.mansSelectedDef) ? r.mansSelectedDef.slice() : [];

          const manOpA = {};
          const manOpD = {};
          const addInto = (dst, src)=>{ for (const [k,v] of Object.entries(src||{})){ const kk=String(k).toLowerCase(); dst[kk]=(dst[kk]||0)+Number(v||0); } };

          for (const key of listA){
            try { if (_b3IsManeuverFreeOnRound(r, key)) continue; } catch(_eF) {}
            const eff = EFFECTS[key]; if (!eff) continue;
            const {op} = lcKeysCost(_rcCostOf(eff));
            addInto(manOpA, op);
          }
          // Defender maneuver selection is GM-only; still costed if present.
          for (const key of listD){
            const eff = EFFECTS[key]; if (!eff) continue;
            const {op} = lcKeysCost(_rcCostOf(eff));
            addInto(manOpD, op);
          }

          const stagedA = Number(r?.localStaged?.att?.[cat]||0);
          const stagedD = Number(r?.localStaged?.def?.[cat]||0);
          if (stagedA>0) manOpA[cat] = (manOpA[cat]||0)+stagedA;
          if (stagedD>0) manOpD[cat] = (manOpD[cat]||0)+stagedD;

          // Snapshot defender bank once resolved (for double-spend safety)
          try { if (__bankDefBefore == null && defender) __bankDefBefore = getOPBank(defender); } catch(_eB) {}

          const expectA = foundry.utils.duplicate(manOpA || {});
          const expectD = foundry.utils.duplicate(manOpD || {});
          const curA = getOPBank(attacker);

          for (const k of Object.keys(expectA)) {
            const need = Number(expectA[k] || 0);
            if (!need) continue;
            const before = Number((__bankAttBefore && __bankAttBefore[k]) || 0);
            const now = Number(curA[k] || 0);
            const already = Math.max(0, before - now);
            expectA[k] = Math.max(0, need - already);
          }
          if (defender) {
            const curD = getOPBank(defender);
            for (const k of Object.keys(expectD)) {
              const need = Number(expectD[k] || 0);
              if (!need) continue;
              const before = Number((__bankDefBefore && __bankDefBefore[k]) || 0);
              const now = Number(curD[k] || 0);
              const already = Math.max(0, before - now);
              expectD[k] = Math.max(0, need - already);
            }
          }

          await _applyOPDeltaDual(attacker, _negate(expectA));
          if (defender) await _applyOPDeltaDual(defender, _negate(expectD));
        } catch (eSpend) {
          warn("scenario maneuver OP spend failed (non-fatal)", eSpend);
        }

        // Compute and apply maneuver intents (scenarioEffects apply via __infilScenario.applyEffects)
        try {
          const b2 = await _b2ComputeAndApplyManeuverIntents({
            app: this,
            round: r,
            attacker: attacker,
            defender: defender,
            targetHex: null,
            targetType: r.targetType
          });
          if (b2 && b2.persisted) {
            r.meta ||= {};
            r.meta.b2 ||= {};
            r.meta.b2.intentsAppliedAt = b2.appliedAt || Date.now();
            r.meta.b2.intentSummary = b2.summary || null;
          }
        } catch (eB2S) {
          warn("B2 intents (scenario) failed (non-fatal)", eB2S);
        }

        // Persist committed results to shared session so Commit Console reflects them.
        try { await this._saveSessionNow(); } catch(_eSS) {}

        return this.render();
      }
    }



    // --- Boss behaviors (creature targets) -------------------------------
    const raid = game.bbttcc?.api?.raid || {};
    const bossKey = (r.targetType === "creature") ? (r.creatureId || r.bossKey || null) : null;
    const isBoss = !!bossKey && typeof raid.applyBossBehaviors === "function";

    const ensureBossMeta = () => {
      r.meta ||= {};
      r.meta.boss ||= {};
      if (r.meta.boss.damageStep == null) {
        const def = raid.boss?.get?.(bossKey) || {};
        r.meta.boss.damageStep = 0;
        r.meta.boss.hitTrack = Array.isArray(def.hitTrack) && def.hitTrack.length ? def.hitTrack.slice() : ["shaken","wounded","broken","banished"];
        r.meta.boss.damageState = "intact";
      }
    };

    const naturalD20 = (roll) => {
      try { return Number(roll?.dice?.[0]?.results?.[0]?.result ?? 0) || 0; } catch { return 0; }
    };

    const contestedType = (() => {
      const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
      const k = String(r?.key || r?.contestedType || r?.primaryKey || r?.view?.cat || "").toLowerCase();
      return OP_KEYS.includes(k) ? k : "violence";
    })();

    if (isBoss) {
      ensureBossMeta();
      const ctx0 = {
        bossKey,
        attackerFactionId: attacker?.id || null,
        contestedType,
        roll: { natural: 0 },
        attackerWon: false,
        defenderWon: false,
        bossDamageStep: Number(r.meta.boss.damageStep||0),
        bossDamageState: String(r.meta.boss.damageState||"intact")
      };
      try { await raid.applyBossBehaviors({ bossKey, phase: raid.PHASES?.ROUND_START || "round_start", ctx: ctx0 }); } catch(e){ warn("boss round_start failed", e); }
    }
    // Resolve defender/target based on targetType
    let targetHex = null;
    let defender = null;
    let facilityOrRigProfile = null;

    // Creature targets have no hex or defender faction; skip hex resolution entirely.
    if (r.targetType === "creature") {
      targetHex = null;
      defender = null;
      facilityOrRigProfile = null;
    } else if (r.targetType === "rig") {
      defender = r.defenderId ? game.actors.get(r.defenderId) : null;
      if (!defender) return ui.notifications?.warn?.("Defender faction not found (rig target).");
      facilityOrRigProfile = await getRigRaidProfile(defender, r.rigId);
      if (!facilityOrRigProfile) return ui.notifications?.warn?.("Rig not found on defender.");
    } else {
      targetHex = r.targetUuid ? await fromUuid(r.targetUuid) : null;
      if (!targetHex) return ui.notifications?.warn?.("Target hex not found.");
      const defId    = targetHex?.flags?.[TERR_ID]?.factionId || "";
      defender = defId ? game.actors.get(defId) : null;
      facilityOrRigProfile = (r.targetType === "facility") ? await getFacilityRaidProfile(targetHex) : null;
    }


    // Snapshot defender bank once the defender is resolved.
    if (defender) __bankDefBefore = getOPBank(defender);

    const baseBonus = Number(__coalition.total || 0);

    const listA = Array.isArray(r.mansSelected)    ? r.mansSelected.slice()    : [];
    const listD = Array.isArray(r.mansSelectedDef) ? r.mansSelectedDef.slice() : [];

    
// B3.2: compute "thisRound" modifiers from selected maneuvers (A then B).
const __b3ThisRound = _b3ComputeThisRoundMods(r, listA, listD);
// Defensive Entrenchment: defender gets +3 (contested) / +3 DC (non-contested).
const __b3DefExtra2 = Number(__b3ThisRound?.defenderBonusDelta || 0) || 0;
// Flash Bargain (and similar): add this-round roll bonus deltas onto the pending nextRoll bonuses.
const __b3AttExtraFinal = Number(__b3AttExtra || 0) + Number(__b3ThisRound?.attackerRollBonusDelta || 0);
const __b3DefExtraFinal = Number(__b3DefExtra || 0) + Number(__b3ThisRound?.defenderRollBonusDelta || 0);

// B3.4: this-round roll modes (Psychic Disruption etc) override/stack with pending nextRoll modes.
function __b3MergeMode(baseMode, addMode){
  const b = String(baseMode||"normal").toLowerCase();
  const a = String(addMode||"normal").toLowerCase();
  // precedence: disadvantage > advantage > normal
  if (a === "dis" || a === "disadvantage") return "dis";
  if (a === "adv" || a === "advantage") return "adv";
  if (b === "dis" || b === "disadvantage") return "dis";
  if (b === "adv" || b === "advantage") return "adv";
  return "normal";
}
const __b3AttModeFinal = __b3MergeMode(__b3AttMode, __b3ThisRound?.rollModeAtt);
const __b3DefModeFinal = __b3MergeMode(__b3DefMode, __b3ThisRound?.rollModeDef);

// Existing resolver (if present) remains compatible; it just won't get targetHexId for rigs
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
        if (res && res.meta) r.meta = Object.assign({}, (r.meta||{}), res.meta);
        await attacker?.update({}); if (defender) await defender.update({});
      } catch (e) { warn("resolver failed; local fallback", e); res=null; }
    }

    // ---------------------------------------------------------------------
    // B2 NOTE: Maneuver intents are now computed + applied on GM Commit (see B2 helpers below).
    // Legacy resolveRaidRound call removed to avoid double-application.
    // ---------------------------------------------------------------------

    // Spend from maneuvers + staged OP
    const EFFECTS = (game.bbttcc?.api?.raid?.EFFECTS) || {};
    const cat = r.view?.cat || primaryKeyFor(r.activityKey);
    const manOpA = {};
    const manOpD = {};
    const manOpSupport = {};
    const addInto = (dst, src)=>{ for (const [k,v] of Object.entries(src||{})){ const kk=String(k).toLowerCase(); dst[kk]=(dst[kk]||0)+Number(v||0); } };

    for (const key of listA){
      try {
        if (_b3IsManeuverFreeOnRound(r, key)) continue;
      } catch(_eF) {}
      const eff = EFFECTS[key];
      if (!eff) continue;
      const {op} = lcKeysCost(_rcCostOf(eff));
      addInto(manOpA, op);
    }

    for (const key of listD){
      const eff = EFFECTS[key];
      if (!eff) continue;
      const {op} = lcKeysCost(_rcCostOf(eff));
      addInto(manOpD, op);
    }

    const stagedA = Number(r?.localStaged?.att?.[cat]||0);
    const stagedD = Number(r?.localStaged?.def?.[cat]||0);

    let stagedSupport = 0;
    if (stagedA>0) manOpA[cat] = (manOpA[cat]||0)+stagedA;
    if (stagedD>0) manOpD[cat] = (manOpD[cat]||0)+stagedD;

    // Support faction staged OP
    const supportStage = r?.localStaged?.support || {};
    for (const [sfid, bucket] of Object.entries(supportStage)) {
      const clean = {};
      for (const [k, v] of Object.entries(bucket || {})) {
        const n = Number(v || 0);
        if (n > 0) {
          const kk = String(k).toLowerCase();
          clean[kk] = n;
          if (kk === cat) stagedSupport += n;
        }
      }
      if (Object.keys(clean).length) manOpSupport[String(sfid)] = clean;
    }
    // Apply OP spend (maneuvers + staged).
    // We compare current banks to the snapshot taken at commit start to avoid double-spend
    // in case another resolver already debited OP.
    try {
      const expectA = foundry.utils.duplicate(manOpA || {});
      const expectD = foundry.utils.duplicate(manOpD || {});
      const curA = getOPBank(attacker);

      for (const k of Object.keys(expectA)) {
        const need = Number(expectA[k] || 0);
        if (!need) continue;
        const before = Number((__bankAttBefore && __bankAttBefore[k]) || 0);
        const now = Number(curA[k] || 0);
        const already = Math.max(0, before - now);
        expectA[k] = Math.max(0, need - already);
      }

      if (defender) {
        const curD = getOPBank(defender);
        for (const k of Object.keys(expectD)) {
          const need = Number(expectD[k] || 0);
          if (!need) continue;
          const before = Number((__bankDefBefore && __bankDefBefore[k]) || 0);
          const now = Number(curD[k] || 0);
          const already = Math.max(0, before - now);
          expectD[k] = Math.max(0, need - already);
        }
      }

      await _applyOPDeltaDual(attacker, _negate(expectA));
      if (defender) await _applyOPDeltaDual(defender, _negate(expectD));

      // Support factions spend their own staged OP
      for (const [sfid, spend] of Object.entries(manOpSupport)) {
        const sf = await getActorByIdOrUuid(sfid);
        if (!sf) continue;

        const curS = getOPBank(sf);
        const expectS = foundry.utils.duplicate(spend || {});

        for (const k of Object.keys(expectS)) {
          const need = Number(expectS[k] || 0);
          if (!need) continue;
          const now = Number(curS[k] || 0);
          expectS[k] = Math.max(0, Math.min(need, now));
        }

        await _applyOPDeltaDual(sf, _negate(expectS));
      }
    } catch (e) {
      warn("apply OP spend failed", e);
    }
    // Final roll / contested roll parity (A2)
let totalFinal, dcFinal, rollUsed;

// If a resolver produced final numbers, honor it (back-compat).
if (res && res.totalFinal!=null && res.dcFinal!=null) {
  totalFinal = res.totalFinal; dcFinal = res.dcFinal; rollUsed = res.roll;
} else {
  // Creature targets can now run a boss-opposed contested roll when the boss has canonical OP stats.
  if (!defender || r.targetType === "creature") {
    const bossDefContested = (r.targetType === "creature") ? _rcGetBossDefByKey(r.creatureId || r.bossKey || "") : null;
    const bossStats = _rcBossStats(bossDefContested);
    const bossHasStats = OP_KEYS.some(k => Number(bossStats[k] || 0) > 0);

    if (r.targetType === "creature" && bossHasStats) {
      const cont = await computeContestedVsBoss(attacker, bossDefContested, {
        activityKey: r.activityKey,
        difficulty: r.difficulty,
        contestedKey: cat,
        baseDefense: Number(r.DC || 0),
        stagedA: Number(stagedA || 0) + Number(stagedSupport || 0),
        stagedD,
        diffOffset: Number(r.diffOffset || 0),
        defenderMans: listD,
        rollModeAtt: __b3AttModeFinal,
        rollModeDef: __b3DefModeFinal,
        extraBonusAtt: __b3AttExtraFinal,
        extraBonusDef: (Number(__b3DefExtraFinal||0) + Number(__b3DefExtra2||0)),
        attackerBaseOverride: Number(__coalition.total || 0)
      });

      r.contested = true;
      r.dcLabel = "BOSS";
      r.attBonus = cont.attBonus;
      r.defBonus = cont.defBonus;
      r.attRoll = cont.attRoll;
      r.defRoll = cont.defRoll;
      r.roll = { result: `A ${cont.attRoll.result} vs B ${cont.defRoll.result}` };
      totalFinal = cont.attTotal;
      dcFinal = cont.defTotal;
      rollUsed = cont.attRoll;
    } else {
      const sBonus = Math.ceil((Number(stagedA || 0) + Number(stagedSupport || 0)) / 2);
	const dBonus = Math.ceil((Number(stagedD)||0)/2);
      const __d20 = (String(__b3AttModeFinal||"normal").toLowerCase()==="adv") ? "2d20kh1" : (String(__b3AttModeFinal||"normal").toLowerCase()==="dis") ? "2d20kl1" : "1d20";
      const r1 = new Roll(`${__d20} + @b + @s + @x`, { b: Number(__coalition.total || 0), s: sBonus, x: __b3AttExtraFinal }); await r1.evaluate();
      rollUsed = r1;
      totalFinal = r1.total;
      dcFinal = Number(r.DC||10) + dBonus + Number(r.diffOffset||0) + __b3DefExtra2;

// B3.3: Suppressive Fire — in non-contested mode, defender may force attacker reroll.
try {
  const sup = __b3ThisRound && __b3ThisRound.suppressive ? __b3ThisRound.suppressive : null;
  if (sup && sup.def) {
    r.meta ||= {};
    r.meta.b3 ||= {};
    r.meta.b3.thisRound ||= {};
    const b3 = r.meta.b3.thisRound;
    b3.rerolls ||= [];
    if (!b3.__suppressiveApplied) {
      const before = rollUsed;
      const r2 = new Roll(`${__d20} + @b + @s + @x`, { b: Number(__coalition.total || 0), s: sBonus, x: __b3AttExtraFinal });
      await r2.evaluate();
      rollUsed = r2;
      totalFinal = r2.total;
      r.roll = r2;
      b3.rerolls.push({ by:"defender", target:"attacker", before: before?.result, after: r2.result });
      b3.notes ||= [];
      b3.notes.push("suppressive_fire: attacker reroll");
      b3.__suppressiveApplied = true;
    }
  }

// B3.5: Chrono-Loop Command — on attacker FAIL, reroll attacker once and use the new result.
try {
  const aMans2 = Array.isArray(listA) ? listA.map(k=>String(k||"").toLowerCase()) : [];
  const usedChrono = aMans2.includes("chrono_loop_command");
  if (usedChrono) {
    const failed = Number(totalFinal||0) < Number(dcFinal||0);
    if (failed) {
      r.meta ||= {};
      r.meta.b3 ||= {};
      r.meta.b3.thisRound ||= {};
      const b3 = r.meta.b3.thisRound;
      b3.rerolls ||= [];
      if (!b3.__chronoApplied) {
        const before = rollUsed;
        const r2 = new Roll(`${__d20} + @b + @s + @x`, { b: Number(__coalition.total || 0), s: sBonus, x: __b3AttExtraFinal });
        await r2.evaluate();
        rollUsed = r2;
        totalFinal = r2.total;
        // Preserve for later UI fields (non-contested keeps Roll object)
        r.roll = r2;
        b3.rerolls.push({ by:"chrono_loop_command", target:"attacker", before: before?.result, after: r2.result });
        b3.notes ||= [];
        b3.notes.push("chrono_loop_command: attacker reroll");
        b3.__chronoApplied = true;
      }
    }
  }
} catch(e) { /* non-fatal */ }
} catch(e) { /* non-fatal */ }
    }

  } else {
    // Contested: attacker and defender both roll.
    const facDefBonus = Number(facilityOrRigProfile?.defenderDcBonus || 0);
    const dflags = defender?.flags?.[FCT_ID] || {};
    const defenderModsDefense = Number(dflags?.mods?.defense || 0);
    const nextRaidBonus = Number(dflags?.bonuses?.nextRaid?.defenseBonus || 0);

    const cont = await computeContested(attacker, defender, {
      activityKey: r.activityKey,
      difficulty: r.difficulty,
      contestedKey: cat,
      baseDefense: Number(r.DC || 0),
      facDefBonus,
      stagedA: Number(stagedA || 0) + Number(stagedSupport || 0),
      stagedD,
	  diffOffset: Number(r.diffOffset || 0),
      nextRaidBonus,
      defenderModsDefense,
      defenderMans: listD,
      attackerBaseOverride: Number(__coalition.total || 0),

      rollModeAtt: __b3AttModeFinal,
      rollModeDef: __b3DefModeFinal,
      extraBonusAtt: __b3AttExtraFinal,
      extraBonusDef: (Number(__b3DefExtraFinal||0) + Number(__b3DefExtra2||0))
    });

    r.contested = true;
    r.dcLabel = "DEF";

    r.attBonus = cont.attBonus; // total bonus used on attacker roll (value+roster+stage)
    r.defBonus = cont.defBonus; // total bonus used on defender roll

    r.attRoll = cont.attRoll;
    r.defRoll = cont.defRoll;

    // Keep the legacy roll field populated for templates that expect it.
    r.roll = { result: `A ${cont.attRoll.result} vs D ${cont.defRoll.result}` };

    totalFinal = cont.attTotal;
    dcFinal = cont.defTotal;
    rollUsed = cont.attRoll;


// B3.3: Suppressive Fire — force enemy reroll (lowest d20). In contested mode, this means reroll the opponent's roll.
try {
  const sup = __b3ThisRound && __b3ThisRound.suppressive ? __b3ThisRound.suppressive : null;
  if (sup && (sup.att || sup.def)) {
    r.meta ||= {};
    r.meta.b3 ||= {};
    r.meta.b3.thisRound ||= {};
    const b3 = r.meta.b3.thisRound;
    b3.rerolls ||= [];
    // Prevent double-application
    if (!b3.__suppressiveApplied) {
      if (sup.att) {
        const before = cont.defRoll;
        const after = await _b3RerollSide({ side:"def", bonus: cont.defBonus, mode: __b3DefModeFinal });
        r.defRoll = after;
        dcFinal = after.total;
        b3.rerolls.push({ by:"attacker", target:"defender", before: before?.result, after: after.result });
        b3.notes ||= [];
        b3.notes.push("suppressive_fire: defender reroll");
      }
      if (sup.def) {
        const before = cont.attRoll;
        const after = await _b3RerollSide({ side:"att", bonus: cont.attBonus, mode: __b3AttModeFinal });
        r.attRoll = after;
        totalFinal = after.total;
        rollUsed = after;
        b3.rerolls.push({ by:"defender", target:"attacker", before: before?.result, after: after.result });
        b3.notes ||= [];
        b3.notes.push("suppressive_fire: attacker reroll");
      }
      // Refresh the legacy summary
      { const defTag = (r.targetType === "creature") ? "B" : "D"; r.roll = { result: `A ${r.attRoll?.result || "—"} vs ${defTag} ${r.defRoll?.result || "—"}` }; }
      b3.__suppressiveApplied = true;
    }
  }
} catch(e) { /* non-fatal */ }


// B3.5: Chrono-Loop Command — on attacker FAIL, reroll attacker once and use the new result.
try {
  const aMans2 = Array.isArray(listA) ? listA.map(k=>String(k||"").toLowerCase()) : [];
  const usedChrono = aMans2.includes("chrono_loop_command");
  if (usedChrono) {
    const failed = Number(totalFinal||0) < Number(dcFinal||0);
    if (failed) {
      r.meta ||= {};
      r.meta.b3 ||= {};
      r.meta.b3.thisRound ||= {};
      const b3 = r.meta.b3.thisRound;
      b3.rerolls ||= [];
      if (!b3.__chronoApplied) {
        const before = r.attRoll;
        const after = await _b3RerollSide({ side:"att", bonus: r.attBonus, mode: __b3AttModeFinal });
        r.attRoll = after;
        rollUsed = after;
        totalFinal = after.total;

        // Refresh contested summary + margin/outcome
        r.roll = { result: `A ${r.attRoll?.result || "—"} vs D ${r.defRoll?.result || "—"}` };
        r.margin = Number(totalFinal||0) - Number(dcFinal||0);
        const m = r.margin;
        const mTxt = `${m>=0?"+":""}${m}`;
        r.outcome = (m >= 5) ? `Great Success (${mTxt})` : (m >= 0) ? `Success (${mTxt})` : `Fail (${mTxt})`;

        b3.rerolls.push({ by:"chrono_loop_command", target:"attacker", before: before?.result, after: after.result });
        b3.notes ||= [];
        b3.notes.push("chrono_loop_command: attacker reroll");
        b3.__chronoApplied = true;
      }
    }
  }
} catch(e) { /* non-fatal */ }

// B3.6: Sephirotic Intervention — auto-win one opposed roll (contested only).
// Interpretation (alpha-safe):
// - If attacker selected sephirotic_intervention AND the attacker is currently losing,
//   force the attacker to win this opposed roll by setting attacker total = defender total.
// - Applies once per round (idempotent) and is audited.
try {
  const aMansSI = Array.isArray(listA) ? listA.map(k=>String(k||"").toLowerCase()) : [];
  const usedSI = aMansSI.includes("sephirotic_intervention");
  if (usedSI && r && r.contested) {
    const failed = Number(totalFinal||0) < Number(dcFinal||0);
    if (failed) {
      r.meta ||= {};
      r.meta.b3 ||= {};
      r.meta.b3.thisRound ||= {};
      const b3 = r.meta.b3.thisRound;
      if (!b3.__sephiroticApplied) {
        b3.rerolls ||= [];
        const beforeTotal = Number(totalFinal||0);
        // Force win: attacker wins ties in this system, so matching defender total is sufficient.
        totalFinal = Number(dcFinal||0);
        // Keep the contested object in sync; later code overwrites r.margin/outcome from cont.*
        try {
          if (typeof cont === "object" && cont) {
            cont.attTotal = Number(totalFinal||0);
            cont.margin = 0;
            cont.outcome = "Success";
          }
        } catch(_eSync) {}

        // Refresh attacker roll display (keep roll object; annotate override)
        try {
          b3.overrides ||= [];
          b3.overrides.push({ by:"sephirotic_intervention", kind:"autoWinOpposedRoll", beforeTotal: beforeTotal, afterTotal: Number(totalFinal||0), ts: Date.now() });
        } catch(_eO) {}

        // Recompute contested summary + margin/outcome
        r.margin = Number(totalFinal||0) - Number(dcFinal||0);
        const m = r.margin;
        const mTxt = `${m>=0?"+":""}${m}`;
        r.outcome = (m >= 5) ? `Great Success (${mTxt})` : (m >= 0) ? `Success (${mTxt})` : `Fail (${mTxt})`;

        b3.notes ||= [];
        b3.notes.push("sephirotic_intervention: auto-win opposed roll");
        b3.__sephiroticApplied = true;
      }
    }
  }
} catch(e) { /* non-fatal */ }

    r.defTotal = cont.defTotal;
    r.margin = cont.margin;

    // Outcome string includes margin for UI readability.
    const m = cont.margin;
    const mTxt = `${m>=0?"+":""}${m}`;
    r.outcome = (m >= 5) ? `Great Success (${mTxt})` : (m >= 0) ? `Success (${mTxt})` : `Fail (${mTxt})`;
  }
}

// Post effects
// (hex id only when hex target)
    try {
      const post = game.bbttcc?.api?.raid?.applyPostRoundEffects;
      if (typeof post === "function") {
        await post({
          attackerId: attacker?.id || null,
          defenderId: defender?.id || null,
          success: (Number(totalFinal||0) >= Number(dcFinal||0)),
          maneuversAtt: listA,
          maneuversDef: listD,
          targetHexId: (r.targetType==="hex") ? (targetHex?.id || null) : null
        });
      }
    } catch (e) { warn("post-round effects failed", e); }

    const ts = Date.now(), dateStr = new Date(ts).toLocaleString();

    // Persist final numbers for display + war logs.
    r.total = totalFinal;
    r.dcFinal = dcFinal;

    
// B3.2: Apply Flank Attack margin delta (and other future margin-based effects) to outcome tiering.
try {
  const md = Number(__b3ThisRound?.attackerMarginDelta || 0) || 0;
  if (md) {
    r.meta ||= {};
    r.meta.b3 ||= {};
    const rawMargin = Number((r.total||0) - (r.dcFinal||0));
    const adjMargin = rawMargin + md;
    r.meta.b3.thisRound = Object.assign({}, (r.meta.b3.thisRound||{}), {
      attackerMarginDelta: md,
      defenderBonusDelta: __b3DefExtra2,
      attackerRollBonusDelta: Number(__b3ThisRound?.attackerRollBonusDelta || 0) || 0,
      defenderRollBonusDelta: Number(__b3ThisRound?.defenderRollBonusDelta || 0) || 0,
      rollModeAtt: __b3AttModeFinal,
      rollModeDef: __b3DefModeFinal,
      rawMargin: rawMargin,
      adjustedMargin: adjMargin,
      notes: __b3ThisRound?.notes || []
    });
    // For contested raids, margin controls win/loss and tiering.
    if (r.contested) {
      r.margin = adjMargin;
      const mTxt = `${adjMargin>=0?"+":""}${adjMargin}`;
      r.outcome = (adjMargin >= 5) ? `Great Success (${mTxt})` : (adjMargin >= 0) ? `Success (${mTxt})` : `Fail (${mTxt})`;
    } else {
      // For single-roll raids, treat margin delta as an effective +md to the attacker total for tiering only.
      const effTotal = Number(r.total||0) + md;
      r.meta.b3.thisRound.effectiveTotal = effTotal;
      r.outcome = (effTotal >= r.dcFinal + 5) ? "Great Success" : (effTotal >= r.dcFinal ? "Success" : "Fail");
    }
  } else {
    // Still persist defender bonus delta if present
    if (__b3DefExtra2) {
      r.meta ||= {};
      r.meta.b3 ||= {};
      r.meta.b3.thisRound = Object.assign({}, (r.meta.b3.thisRound||{}), {
        attackerMarginDelta: 0,
        defenderBonusDelta: __b3DefExtra2,
        attackerRollBonusDelta: Number(__b3ThisRound?.attackerRollBonusDelta || 0) || 0,
        defenderRollBonusDelta: Number(__b3ThisRound?.defenderRollBonusDelta || 0) || 0,
        rollModeAtt: __b3AttModeFinal,
        rollModeDef: __b3DefModeFinal,
        notes: __b3ThisRound?.notes || []
      });
    }
    else {
      // Persist roll-mode-only effects (e.g., Psychic Disruption) even when margin/dc deltas are zero.
      const rmA = String(__b3AttModeFinal||"normal");
      const rmD = String(__b3DefModeFinal||"normal");
      const rbA = Number(__b3ThisRound?.attackerRollBonusDelta || 0) || 0;
      const rbD = Number(__b3ThisRound?.defenderRollBonusDelta || 0) || 0;
      const hasNotes = Array.isArray(__b3ThisRound?.notes) && __b3ThisRound.notes.length;
      if ((rmA !== "normal") || (rmD !== "normal") || rbA || rbD || hasNotes) {
        r.meta ||= {};
        r.meta.b3 ||= {};
        r.meta.b3.thisRound = Object.assign({}, (r.meta.b3.thisRound||{}), {
          attackerMarginDelta: 0,
          defenderBonusDelta: 0,
          attackerRollBonusDelta: Number(__b3ThisRound?.attackerRollBonusDelta || 0) || 0,
          defenderRollBonusDelta: Number(__b3ThisRound?.defenderRollBonusDelta || 0) || 0,
          rollModeAtt: rmA,
          rollModeDef: rmD,
          notes: __b3ThisRound?.notes || []
        });
      }
    }
  }
} catch (_eB3TR) {}

// Legacy fields: keep a Roll object for non-contested raids; contested raids store a friendly string in r.roll.result.
    if (!r.contested) {
      r.roll = rollUsed;
      r.outcome = (totalFinal >= dcFinal + 5) ? "Great Success" : (totalFinal >= dcFinal ? "Success" : "Fail");
    } else {
      // Ensure the roll summary exists even if some upstream path didn't set it.
      if (!r.roll || !r.roll.result) {
        try {
          const defTag = (r.targetType === "creature") ? "B" : "D";
          r.roll = { result: `A ${r.attRoll?.result || "—"} vs ${defTag} ${r.defRoll?.result || "—"}` };
        } catch (e) { r.roll = { result: "—" }; }
      }
      // If contested outcome wasn't set above, derive it here.
      if (!r.outcome) {
        const margin = Number(r.total||0) - Number(r.dcFinal||0);
        const mTxt = `${margin>=0?"+":""}${margin}`;
        r.outcome = (margin >= 5) ? `Great Success (${mTxt})` : (margin >= 0) ? `Success (${mTxt})` : `Fail (${mTxt})`;
      }
    }

// ---------------------------------------------------------------------
// B2 — Apply Maneuver Intents on GM Commit
// - Compute intents from selected maneuvers (att/def)
// - Persist on resolved round (r.meta.intents)
// - Apply factionEffects + scenarioEffects now (commit only)
// - Store worldEffects as pending (do not apply yet)
// ---------------------------------------------------------------------
try {
  const b2 = await _b2ComputeAndApplyManeuverIntents({
    app: this,
    round: r,
    attacker: attacker,
    defender: defender,
    targetHex: targetHex,
    targetType: r.targetType
  });
  if (b2 && b2.persisted) {
    // Keep a short breadcrumb for debugging / war logs
    r.meta ||= {};
    r.meta.b2 ||= {};
    r.meta.b2.intentsAppliedAt = b2.appliedAt || Date.now();
    r.meta.b2.intentSummary = b2.summary || null;
  }
} catch (e) {
  warn("B2 intent compute/apply failed (non-fatal)", e);
}

// ---------------------------------------------------------------------
// B3 — Execute Round Effects (subset)
// - Consumes round.meta.intents.applied.roundEffects AFTER B2 computed intents.
// - Stores supported "nextRoll" modifiers on attacker as a one-shot.
// ---------------------------------------------------------------------
try {
  await _b3ExecuteRoundEffectsPostCommit({ round: r, attackerActor: attacker, defenderActor: defender });
} catch (e) { warn("B3 post-commit roundEffects failed (non-fatal)", e); }

// ---------------------------------------------------------------------
// B3 — Logistical Surge (as written, narrative timing)
// - If attacker selected logistical_surge AND succeeded, issue a one-shot token:
//     attacker may repeat the PRIOR round's maneuver next round at no OP cost.
// - No automated role switching is enforced here; this is purely a cost/availability allowance.
// ---------------------------------------------------------------------
try {
  const aMans = Array.isArray(listA) ? listA.map(k=>String(k||"").toLowerCase()) : [];
  const usedLS = aMans.includes("logistical_surge");
  if (usedLS && _b3IsSuccessOutcome(r)) {
    const priorKey = _b3PickPriorManeuverForRepeat(this.vm?.rounds || [], idx, attacker?.id || "");
    if (priorKey) {
      await _b3SetNextRoundRepeat(attacker, { key: priorKey, free: true, srcRoundId: String(r.roundId||""), ts: Date.now() });
      // Breadcrumb for debugging / war logs
      r.meta ||= {};
      r.meta.b3 ||= {};
      r.meta.b3.logisticalSurge = { granted: true, key: priorKey, free: true };
    }
  }
} catch (e) { warn("logistical_surge next-round token failed (non-fatal)", e); }

// --- Boss progression + behaviors (creature targets)
    if (isBoss) {
      try {
        ensureBossMeta();
        const bossMeta = r.meta.boss;

        const attackerWon = Number(totalFinal||0) >= Number(dcFinal||0);
        const greatSuccess = attackerWon && (Number(totalFinal||0) >= Number(dcFinal||0) + 5);

        const bossDef = raid.boss?.get?.(bossKey) || {};
        const hitTrack = Array.isArray(bossDef.hitTrack) && bossDef.hitTrack.length
          ? bossDef.hitTrack.slice()
          : (Array.isArray(bossMeta.hitTrack) && bossMeta.hitTrack.length ? bossMeta.hitTrack.slice() : ["shaken","wounded","broken","banished"]);

        const maxStep = hitTrack.length;
        const oldStep = clamp(Number(bossMeta.damageStep||0), 0, maxStep);

        // Great Success -> +2, Success -> +1, Fail -> 0
        let dmg = greatSuccess ? 2 : (attackerWon ? 1 : 0);

        // Mirror siege mitigations
        const mansD = Array.isArray(listD) ? listD.map(k=>String(k).toLowerCase()) : [];
        if (dmg > 0 && mansD.includes("quantum_shield")) dmg = Math.ceil(dmg / 2);
        if (mansD.includes("patch_the_breach")) dmg = Math.max(0, dmg - 1);

        const newStep = clamp(oldStep + dmg, 0, maxStep);

        bossMeta.damageStep = newStep;
        bossMeta.hitTrack = hitTrack;
        bossMeta.damageState = (newStep === 0) ? "intact" : String(hitTrack[newStep-1] || "damaged");


        // Update display names to include current boss damageState badge
        try {
          const nm3 = _bossStateLabel(bossDef, { damageState: bossMeta.damageState }) || (bossDef.label || bossKey);
          r.targetName = String(nm3 || r.targetName || bossKey);
          if (this && this.vm && this.vm.targetType === "creature" && String(this.vm.creatureId || "") === String(bossKey || "")) {
            this.vm.targetName = String(nm3 || this.vm.targetName || bossKey);
          }
        } catch (e) {}
        bossMeta.last = {
          ts: Date.now(),
          totalFinal: Number(totalFinal||0),
          dcFinal: Number(dcFinal||0),
          attackerWon,
          greatSuccess,
          dmg,
          from: oldStep,
          to: newStep
        };
        if (newStep !== oldStep) {
          try {
            _bbttccFxPlay("boss_phase_change", {
              root: __fxPanel,
              outcome: `${round?.targetName || bossDef?.label || bossKey}: ${String(bossMeta.damageState || "changed").toUpperCase()}`
            }, { phase: "resolve" });
          } catch(_eFxBoss) {}
        }

        // Persist boss state across sessions (world setting)
        try {
          await _setBossState(bossKey, {
            damageStep: newStep,
            damageState: bossMeta.damageState,
            hitTrack: hitTrack,
            updatedTs: Date.now()
          });
        } catch (e) {}


        const ctx = {
          bossKey,
          attackerFactionId: attacker?.id || null,
          contestedType,
          roll: { natural: naturalD20(rollUsed), obj: rollUsed },
          attackerWon,
          defenderWon: !attackerWon,
          bossDamageStep: newStep,
          bossDamageState: bossMeta.damageState,
          totalFinal: Number(totalFinal||0),
          dcFinal: Number(dcFinal||0)
        };

        await raid.applyBossBehaviors({ bossKey, phase: raid.PHASES?.AFTER_ROLL || "after_roll", ctx });
        await raid.applyBossBehaviors({ bossKey, phase: raid.PHASES?.ROUND_END  || "round_end",  ctx });

        // Auto-end when final step reached unless behavior ended it first
        if (!ctx.raidEnded && newStep >= maxStep) {
          ctx.raidEnded = true;
          ctx.outcome = "defeated";
        }
        if (ctx.raidEnded) {
          bossMeta.ended = true;
          bossMeta.outcome = ctx.outcome || "ended";
        }
      } catch (e) { warn("boss after_roll/round_end failed", e); }
    }

// Facility siege damage (only when explicitly targeting a facility)
try {
  if (r.targetType === "facility" && targetHex) {
    const prof = await getFacilityRaidProfile(targetHex);
    if (prof) {
      const hitTrack = Array.isArray(prof.hitTrack) ? prof.hitTrack : ["light","heavy","breached","destroyed"];
      const maxStep = hitTrack.length;
      const oldStep = Number(prof.damageStep || 0);

      const tier = (totalFinal >= dcFinal + 5) ? "complete" : (totalFinal >= dcFinal ? "partial" : "fail");
      let dmg = (tier === "complete") ? 2 : (tier === "partial" ? 1 : 0);

      const mansD = Array.isArray(listD) ? listD.map(k=>String(k).toLowerCase()) : [];
      if (dmg > 0 && mansD.includes("quantum_shield")) dmg = Math.ceil(dmg / 2);
      let repair = 0;
      if (mansD.includes("patch_the_breach")) {
        if (dmg > 0) dmg = Math.max(0, dmg - 1);
        else repair = 1;
      }

      // B3: Last-Stand Banner — ignore first structure loss (reduce damage by 1, once per round).
      dmg = _b3ApplyStructureGuard(r, mansD, dmg);

      const newStep = clamp(oldStep + dmg - repair, 0, maxStep);

      if (newStep !== oldStep) {
        await _updatePrimaryFacilityOnTarget(targetHex, (fac0) => {
          const fac = foundry.utils.duplicate(fac0 || {});
          fac.damageStep = newStep;
          fac.damageState = (newStep===0) ? "intact" : String(hitTrack[newStep-1] || "damaged");
          fac.lastSiegeAt = Date.now();
          return fac;
        });

        try {
          const gmIds = game.users?.filter(u=>u.isGM).map(u=>u.id) || [];
          const fromS = (oldStep===0) ? "intact" : String(hitTrack[oldStep-1] || "damaged");
          const toS   = (newStep===0) ? "intact" : String(hitTrack[newStep-1] || "damaged");
          await ChatMessage.create({
            content: `<p><b>Facility Siege Damage</b></p><b>${foundry.utils.escapeHTML(defender?.name || "Defender")}</b> — <b>${foundry.utils.escapeHTML(r.targetName || "Facility")}</b>: ${fromS} → <b>${toS}</b> (Δ ${newStep-oldStep>=0?"+":""}${newStep-oldStep})`,
            whisper: gmIds,
            speaker: { alias: "BBTTCC Siege" }
          }).catch(()=>{});
        } catch {}
      }
    }
  }
} catch (e) {
  warn("facility siege damage failed", e);
}


    // Apply siege damage:
    // - Hex target uses your existing facility block (unchanged) via getFacilityRaidProfile + _updatePrimaryFacilityOnTarget
    // - Rig target applies to defender.flags.bbttcc-factions.rigs[]
    // - Creature targets do not use the siege pipeline.
    if (r.targetType !== "creature") try {
      const tier = (totalFinal >= dcFinal + 5) ? "complete" : (totalFinal >= dcFinal ? "partial" : "fail");
      let dmg = (tier === "complete") ? 2 : (tier === "partial" ? 1 : 0);

      const mansA = Array.isArray(listA) ? listA.map(k=>String(k).toLowerCase()) : [];
      const mansD = Array.isArray(listD) ? listD.map(k=>String(k).toLowerCase()) : [];

      if (dmg > 0 && mansD.includes("quantum_shield")) dmg = Math.ceil(dmg / 2);

      let repair = 0;
      if (mansD.includes("patch_the_breach")) {
        if (dmg > 0) dmg = Math.max(0, dmg - 1);
        else repair = 1;
      }

      // B3: Last-Stand Banner — ignore first structure loss (reduce damage by 1, once per round).
      dmg = _b3ApplyStructureGuard(r, mansD, dmg);

      if (r.targetType === "rig") {
        const prof = await getRigRaidProfile(defender, r.rigId);
        const maxStep = Array.isArray(prof?.hitTrack) ? prof.hitTrack.length : 4;
        const oldStep = Number(prof?.damageStep || 0);
        let newStep = clamp(oldStep + dmg - repair, 0, maxStep);

        if (newStep !== oldStep) {
          await _updateRigOnFaction(defender, r.rigId, (rig0) => {
            const rig = foundry.utils.duplicate(rig0 || {});
            rig.damageStep = newStep;
            rig.damageState = (newStep===0) ? "intact" : String((prof.hitTrack||[])[newStep-1] || "damaged");
            rig.lastSiegeAt = Date.now();
            return rig;
          });

          // GM whisper
          try {
            const gmIds = game.users?.filter(u=>u.isGM).map(u=>u.id) || [];
            const fromS = (oldStep===0) ? "intact" : String((prof.hitTrack||[])[oldStep-1] || "damaged");
            const toS   = (newStep===0) ? "intact" : String((prof.hitTrack||[])[newStep-1] || "damaged");
            await ChatMessage.create({
              content: `<p><b>Rig Siege Damage</b></p><b>${foundry.utils.escapeHTML(defender.name)}</b> — <b>${foundry.utils.escapeHTML(prof.rigName)}</b>: ${fromS} → <b>${toS}</b> (Δ ${newStep-oldStep>=0?"+":""}${newStep-oldStep})`,
              whisper: gmIds,
              speaker: { alias: "BBTTCC Siege" }
            }).catch(()=>{});
          } catch {}
          try {
            _bbttccFxPlay("rig_damage", {
              root: __fxPanel,
              outcome: `${defender?.name || "Defender"} — ${prof?.rigName || "Rig"}: ${fromS} → ${toS}`
            }, { phase: "resolve" });
          } catch(_eFxRig) {}
        }

        r.meta = Object.assign({}, (r.meta||{}), { rig: { rigId:r.rigId, damageStep:newStep } });
      } else {
        // Existing facility siege/damage + dialogs + applyOutcome block stays in your original file.
        // We keep it intact by calling your existing implementation as-is:
        // (The original block is already present in this file version above; no extra work needed here.)
      }
    } catch (e) {
      warn("siege damage apply failed", e);
    }

    r.open = false; r.committed = true;

    const spentPartsA = Object.entries(manOpA).filter(([_,v])=>v>0).map(([k,v])=>`${k}:${v}`);
    const spentPartsD = Object.entries(manOpD).filter(([_,v])=>v>0).map(([k,v])=>`${k}:${v}`);
    const spentPartsS = Object.entries(manOpSupport || {})
      .map(([sfid, bucket]) => {
        const name = game.actors?.get?.(sfid)?.name || sfid;
        const parts = Object.entries(bucket || {}).filter(([_,v])=>Number(v||0)>0).map(([k,v])=>`${k}:${v}`);
        return parts.length ? `${name} [${parts.join(", ")}]` : "";
      })
      .filter(Boolean);

    const spentLine =
      (spentPartsA.length ? ` • OP−(Att) ${spentPartsA.join(", ")}` : "") +
      (spentPartsD.length ? ` • OP−(Def) ${spentPartsD.join(", ")}` : "") +
      (spentPartsS.length ? ` • OP−(Support) ${spentPartsS.join(" ; ")}` : "");
    try {
      _bbttccFxPlay("raid_outcome", {
        root: __fxPanel,
        outcome: r.outcome,
        outcomeLabel: `${r.activityLabel || "Raid"} — ${r.outcome}`,
        margin: (typeof r.margin === "number") ? r.margin : (Number(totalFinal||0) - Number(dcFinal||0)),
        attackerName: attacker?.name || r.attackerName || "Attacker",
        defenderName: defender?.name || r.targetName || "Defender"
      }, { phase: "resolve" });
    } catch(_eFxOutcome) {}

    const entry = buildRaidWarLog("att", r, { ts, dateStr, oppName: (defender ? defender.name : null), totalFinal, dcFinal, spentLine });
    await appendWarLog(attacker, entry);
    if (defender && this.vm.includeDefender) {
      const dEntry = Object.assign({}, entry, { side:"def", opponent: (r.attackerName || (attacker ? attacker.name : "")), outcome: (totalFinal >= dcFinal ? "loss" : "win") });
      await appendWarLog(defender, dEntry);
    }
    // B3: Clear one-shot next-round repeat token (Logistical Surge) after a round is resolved.
    // This keeps the allowance strictly "next round" and prevents bleed-through.
    try {
      const pend = _b3GetNextRoundRepeat(attacker);
      if (pend && pend.key) {
        // Do NOT clear the token on the same round that created it (it is for the NEXT round).
        const srcRid = String(pend.srcRoundId || "");
        const curRid = String(r.roundId || "");
        if (!srcRid || (srcRid && srcRid !== curRid)) {
          await _b3ClearNextRoundRepeat(attacker);
        }
      }
    } catch(_eClr) {}




// ---------------------------------------------------------------------
// B3 — Reality Hack (MVP)
// - On attacker success, clone the PRIOR committed round into a new OPEN round.
// - This does NOT refund OP or undo siege/boss steps. It simply replays the round.
// - Idempotent per round via r.meta.b3.thisRound.__realityHackApplied.
// ---------------------------------------------------------------------
try {
  const aMansRH = Array.isArray(listA) ? listA.map(k=>String(k||"").toLowerCase()) : [];
  const usedRH = aMansRH.includes("reality_hack");
  if (usedRH && _b3IsSuccessOutcome(r)) {
    r.meta ||= {};
    r.meta.b3 ||= {};
    r.meta.b3.thisRound ||= {};
    const b3 = r.meta.b3.thisRound;
    b3.overrides ||= [];

    if (!b3.__realityHackApplied) {
      const rounds = (this && this.vm && Array.isArray(this.vm.rounds)) ? this.vm.rounds : [];
      let prior = null;
      let priorIdx = -1;
      for (let j = Number(idx||0) - 1; j >= 0; j--) {
        const pr = rounds[j];
        if (!pr) continue;
        if (pr.committed) { prior = pr; priorIdx = j; break; }
      }

      if (prior && priorIdx >= 0) {
        const newId = randid();

        // Mark the prior round as "rewound" (audit only)
        prior.meta ||= {};
        prior.meta.b3 ||= {};
        prior.meta.b3.realityHack ||= {};
        prior.meta.b3.realityHack.rewound = true;
        prior.meta.b3.realityHack.rewoundByRoundId = String(r.roundId || "");
        prior.meta.b3.realityHack.rewoundAt = Date.now();
        prior.meta.b3.realityHack.cloneRoundId = String(newId);

        // Create a fresh OPEN round cloned from the prior round's parameters + maneuvers.
        const cloned = {
          ts: Date.now(),
          attackerId: prior.attackerId,
          attackerName: prior.attackerName,

          targetType: prior.targetType || "hex",
          targetUuid: prior.targetUuid || "",
          defenderId: prior.defenderId || "",
          rigId: prior.rigId || "",
          creatureId: prior.creatureId || "",
          actorUuid: prior.actorUuid || "",
          sceneUuid: prior.sceneUuid || "",
          tokenUuid: prior.tokenUuid || "",
          targetName: prior.targetName || "—",

          activityKey: prior.activityKey,
          activityLabel: prior.activityLabel,
          difficulty: prior.difficulty,

          key: prior.key,
          attBonus: prior.attBonus,
          defBonus: prior.defBonus,
          baseDC: prior.baseDC,
          diffAdj: prior.diffAdj,
          DC: prior.DC,

          // Reset roll fields; commit will compute fresh.
          roll: { result: "—" },
          attRoll: null,
          defRoll: null,
          total: 0,
          defTotal: null,
          dcFinal: null,
          margin: null,
          contested: !!prior.contested,
          dcLabel: prior.dcLabel || (prior.contested ? "DEF" : ""),
          outcome: "—",

          open: true,
          committed: false,
          committedAt: null,
          roundId: newId,
          local: true,
          localStaged: { att: {}, def: {} },
          diffOffset: 0,

          mansSelected: Array.isArray(prior.mansSelected) ? prior.mansSelected.slice() : [],
          mansSelectedDef: Array.isArray(prior.mansSelectedDef) ? prior.mansSelectedDef.slice() : [],

          meta: {
            b3: {
              realityHack: {
                clonedFromRoundId: String(prior.roundId || ""),
                clonedFromIdx: Number(priorIdx || 0),
                triggeredByRoundId: String(r.roundId || ""),
                ts: Date.now()
              }
            }
          }
        };

        // Insert immediately after the current round so it appears as the "next" round.
        rounds.splice(Number(idx||0) + 1, 0, cloned);

        b3.overrides.push({
          type: "reality_hack",
          action: "clone_last_round",
          fromRoundId: String(prior.roundId || ""),
          newRoundId: String(newId),
          fromIdx: Number(priorIdx || 0)
        });
      } else {
        b3.overrides.push({ type:"reality_hack", action:"no_prior_round" });
      }

      b3.__realityHackApplied = true;
    }
  }
} catch (e) { warn("reality_hack clone failed (non-fatal)", e); }
    // Ensure committed results propagate to the shared session (Commit Console reads this).
    try { await this._saveSessionNow(); } catch(_e) {}
    return this.render();
  }
}

// --- Toolbar + API binding --------------------------------------------------
function bindAPI() {
  const mod = game.modules.get(RAID_ID); if (!mod) return;
  let _console = null;
  async function openConsole(options) {
    options = options || {};
    if (!_console) _console = new BBTTCC_RaidConsole();
    try { globalThis.__bbttccRaidOpenConsoles?.add?.(_console); } catch(_e) {}
    try {
      if (options.factionId) _console.vm.attackerId = String(options.factionId);
      // Player perspective: lock attacker selection to the opener faction.
      try {
        if (!_rcIsGMUser() && options.factionId) {
          _console.vm.__lockAttackerId = String(options.factionId);
        }
      } catch(_e) {}

    } catch (_e) {}
    await _console.render(true, { focus: true });
    return _console;
  }
  let _boss = null;
  async function openBossBuilder() {
    try {
      // Boss Builder is optional; it registers itself under globalThis.BBTTCC_BossConfigApp.
      const C = globalThis.BBTTCC_BossConfigApp || game.modules?.get?.(RAID_ID)?.api?.BossConfigApp || null;
      if (!C) {
        ui.notifications?.warn?.("Boss Builder UI not available (BBTTCC_BossConfigApp missing).");
        return null;
      }
      if (!_boss) _boss = new C();
      await _boss.render(true, { focus: true });
      return _boss;
    } catch (e) {
      console.error(TAG, "openBossBuilder failed", e);
      ui.notifications?.error?.("Could not open Boss Builder — see console.");
      return null;
    }
  }


  const api = { pickTargetHex, openRaidConsole:openConsole, openConsole, openBossBuilder:openBossBuilder };
  mod.api = Object.assign(mod.api || {}, api);
  try {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.raid ??= {};
    Object.assign(game.bbttcc.api.raid, api);
  }
  catch(e){ warn("bind game.bbttcc.api.raid", e); }
  
  // -----------------------------------------------------------------------
  // Live Sync wiring:
  // - updateActor -> re-render any open raid console for that attacker
  // - socket fallback -> GM persists player session writes
  // -----------------------------------------------------------------------
  try {
    globalThis.__bbttccRaidOpenConsoles ??= new Set();
  } catch(_e) {}

  // GM persistence endpoint for players who cannot write actor flags
  try {
    if (!globalThis.__bbttccRaidSocketBound) {
      globalThis.__bbttccRaidSocketBound = true;
      game.socket?.on?.(`module.${RAID_ID}`, async (msg)=>{
        try {
          if (!msg || msg.t !== "raidSession") return;
          if (!_rcIsGMUser()) return; // only GM persists
          const attackerId = String(msg.attackerId || "");
          const payload = msg.payload;
          if (!attackerId || !payload) return;
          const a = await getActorByIdOrUuid(attackerId);
          if (!a) return;
          await a.setFlag(RAID_ID, "raidSession", payload);
        } catch(_eS) {}
      });
    }
  } catch(_eSock) {}

  // Actor update -> refresh consoles
  try {
    if (!globalThis.__bbttccRaidActorHookBound) {
      globalThis.__bbttccRaidActorHookBound = true;
      Hooks.on("updateActor", (actor, changed, opts, userId)=>{
        try {
          const has = changed?.flags && changed.flags[RAID_ID] && Object.prototype.hasOwnProperty.call(changed.flags[RAID_ID], "raidSession");
          if (!has) return;
          const attackerId = String(actor?.id || "");
          const set = globalThis.__bbttccRaidOpenConsoles;
          if (!set) return;
          for (const app of Array.from(set)) {
            try {
              if (!app || !app.rendered) continue;
              if (String(app.vm?.attackerId||"") !== attackerId) continue;
              // Avoid immediate self-loop; still safe because rev check exists.
              app.render(false);
            } catch(_eA) {}
          }
        } catch(_eU) {}
      });
    }
  } catch(_eHook) {}

  log("API ready.");
}

function attachRaidButtonToToolbar() {
  try {
    const el = document.getElementById("bbttcc-toolbar");
    if (!el) return false;
    if (el.querySelector('[data-act="raid"]')) return true;

    const targetRow =
      el.querySelector(".bbttcc-toolbar-main") ||
      el.querySelector(".row") ||
      el;

    const btn = document.createElement("button");
    btn.className = "bbttcc-btn";
    btn.type = "button";
    btn.setAttribute("data-act","raid");
    btn.innerHTML = `<i class="fas fa-crosshairs"></i><span>Raid</span>`;
    targetRow.appendChild(btn);

    const btnBoss = document.createElement("button");
    btnBoss.className = "bbttcc-btn";
    btnBoss.type = "button";
    btnBoss.setAttribute("data-act","bosses");
    btnBoss.innerHTML = `<i class="fas fa-dragon"></i><span>Bosses</span>`;
    targetRow.appendChild(btnBoss);

    if (!el.__bbttccRaidClickBound) {
      el.addEventListener("click", async (ev) => {
        const a = ev.target.closest?.('[data-act]');
        if (!a) return;
        const act = a.getAttribute("data-act");
        if (act !== "raid" && act !== "bosses") return;

        ev.preventDefault();
        try {
          if (act === "raid") {
            const open = game?.bbttcc?.api?.raid?.openConsole || game.modules.get(RAID_ID)?.api?.openRaidConsole || globalThis.BBTTCC_OpenRaidConsole;
            if (typeof open !== "function") return ui.notifications?.warn?.("BBTTCC Raid Console is not available.");
            await open();
          } else {
            const openB = game?.bbttcc?.api?.raid?.openBossBuilder || game.modules.get(RAID_ID)?.api?.openBossBuilder;
            if (typeof openB !== "function") return ui.notifications?.warn?.("Boss Builder is not available.");
            await openB();
          }
        } catch (e) {
          console.error(TAG, "Toolbar button failed", e);
          ui.notifications?.error?.("Could not open BBTTCC tool — see console.");
        }
      });
      el.__bbttccRaidClickBound = true;
    }
    return true;
  } catch (e) {
    warn("attachRaidButtonToToolbar error", e);
    return false;
  }
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


/* ===================================================================
 * Entitlement Filtering (Faction → Raid Console)
 * - Primary goal: Option-derived maneuvers only appear if the faction's
 *   roster actually contains the required Character Option(s).
 * - Secondary: rig-role gating for rig_combat (lightweight, alpha-safe).
 * =================================================================== */

function _isPlainObject(x){ return x && typeof x==="object" && !Array.isArray(x); }

function _lc(s){ return String(s??"").toLowerCase().trim(); }

/** Best-effort: detect whether an actor is a "character" (PC/NPC) */
function _isCharacterActor(a){
  if (!a) return false;
  const t = _lc(a.type);
  if (t && t !== "character" && t !== "pc" && t !== "npc") {
    // Foundry systems differ; be permissive but exclude obvious non-characters
    // (factions, items, etc.)
    if (t.includes("faction")) return false;
  }
  // D&D5e typically uses "character" for PCs; allow if it has a system + name.
  return true;
}

/** Best-effort: determine whether a character belongs to a faction actor. */
function _characterBelongsToFaction(charActor, factionActor){
  if (!charActor || !factionActor) return false;
  const fid = factionActor.id;
  const fname = String(factionActor.name||"").trim();

  // Common flag shapes we've used across BBTTCC iterations
  const candidates = [
    charActor.getFlag?.(FCT_ID, "factionId"),
    charActor.getFlag?.(FCT_ID, "ownerFactionId"),
    charActor.flags?.[FCT_ID]?.factionId,
    charActor.flags?.[FCT_ID]?.ownerFactionId,
    charActor.flags?.["bbttcc-core"]?.factionId,
    charActor.flags?.["bbttcc-identity"]?.factionId,
    charActor.flags?.["bbttcc-identity"]?.faction?.id,
    charActor.flags?.["bbttcc-identity"]?.faction,
    charActor.flags?.["bbttcc-character-options"]?.factionId
  ].filter(Boolean).map(String);

  if (candidates.some(v => v === fid)) return true;

  const nameCandidates = [
    charActor.getFlag?.(FCT_ID, "faction"),
    charActor.flags?.[FCT_ID]?.faction,
    charActor.flags?.[FCT_ID]?.factionName,
    charActor.flags?.["bbttcc-core"]?.factionName,
    charActor.flags?.["bbttcc-identity"]?.factionName,
    charActor.flags?.["bbttcc-identity"]?.faction?.name
  ].filter(Boolean).map(v => String(v).trim());

  if (fname && nameCandidates.some(v => v === fname)) return true;

  return false;
}

function _collectFactionRosterActors(factionActor){
  const out = [];
  for (const a of game.actors?.contents || []) {
    if (!a) continue;
    if (!_isCharacterActor(a)) continue;
    if (_characterBelongsToFaction(a, factionActor)) out.push(a);
  }
  return out;
}

/** Try the canonical Character Options API first; fall back to flags. */
function _getOwnedOptionCountsSafe(actor){
  try {
    const api =
      game.bbttcc?.api?.characterOptions ||
      game.bbttcc?.api?.charOptions ||
      game.bbttcc?.api?.options ||
      game.bbttcc?.api?.character_options ||
      null;

    const fn = api?.getOwnedOptionCounts;
    if (typeof fn === "function") return fn(actor) || {};
  } catch (e) { /* ignore */ }

  // Fallback: some builds store normalized outputs here
  const f = actor?.flags?.["bbttcc-character-options"] || {};
  if (_isPlainObject(f.ownedOptionCounts)) return f.ownedOptionCounts;
  if (_isPlainObject(f.optionCounts)) return f.optionCounts;
  if (_isPlainObject(f.counts)) return f.counts;

  return {};
}

function _aggregateFactionOptionCounts(factionActor){
  const roster = _collectFactionRosterActors(factionActor);
  const out = {};
  for (const a of roster) {
    const counts = _getOwnedOptionCountsSafe(a);
    if (!_isPlainObject(counts)) continue;
    for (const [k,v] of Object.entries(counts)) {
      const key = _lc(k);
      const n = Number(v||0);
      if (!key || !Number.isFinite(n) || n<=0) continue;
      out[key] = (Number(out[key]||0) + n);
    }
  }
  return out;
}

function _effectForManeuverKey(mKey){
  const EFFECTS = (game.bbttcc?.api?.raid?.EFFECTS) || {};
  return EFFECTS?.[mKey] || null;
}

/** Narrative unlocks (Encounter/Beat gated)
 * Stored on faction actor:
 *   flags.bbttcc-factions.unlocks.maneuvers[unlockKey].unlocked === true
 * Fallback accepted shapes (for older worlds):
 *   flags.bbttcc-factions.unlockedManeuvers: string[]
 */
function _factionHasManeuverUnlock(factionActor, unlockKey){
  try {
    const k = _lc(unlockKey);
    if (!k) return false;

    const u = factionActor?.getFlag?.(FCT_ID, "unlocks") || factionActor?.flags?.[FCT_ID]?.unlocks || null;
    if (u && typeof u === "object" && u.maneuvers && typeof u.maneuvers === "object") {
      const row = u.maneuvers[k] || u.maneuvers[unlockKey] || null;
      if (row && row.unlocked === true) return true;
    }

    const list =
      factionActor?.getFlag?.(FCT_ID, "unlockedManeuvers") ||
      factionActor?.getFlag?.(FCT_ID, "learnedManeuvers") ||
      factionActor?.flags?.[FCT_ID]?.unlockedManeuvers ||
      [];
    if (Array.isArray(list) && list.map(_lc).includes(k)) return true;
  } catch (e) {}
  return false;
}


/** Attempt to infer "required option key(s)" for an option-derived maneuver. */
function _requiredOptionsForManeuver(mKey){
  const e = _effectForManeuverKey(mKey) || {};
  const opts = new Set();

  const push = (x)=>{
    if (!x) return;
    if (Array.isArray(x)) { x.forEach(push); return; }
    const s = _lc(x);
    if (s) opts.add(s);
  };

  // Common fields (present in Character Options sprint wiring)
  push(e.optionKey);
  push(e.requiresOption);
  push(e.requiresOptions);
  push(e.optionKeys);
  push(e.meta?.optionKey);
  push(e.meta?.requiresOption);
  push(e.benefit?.requiresOption);
  push(e.benefit?.requiresOptions);

  // Heuristic from maneuver key naming conventions
  const k = _lc(mKey);
  if (k.startsWith("opt_")) push(k.replace(/^opt_/, "").split("__")[0].split(":")[0]);
  if (k.startsWith("option_")) push(k.replace(/^option_/, "").split("__")[0].split(":")[0]);

  return Array.from(opts);
}

function _isOptionDerivedManeuver(mKey){
  const e = _effectForManeuverKey(mKey) || {};
  const k = _lc(mKey);
  if (e?.source === "option" || e?.source === "character_option") return true;
  if (e?.tags && Array.isArray(e.tags) && e.tags.map(_lc).includes("option")) return true;
  if (k.startsWith("opt_") || k.startsWith("option_")) return true;

  const ro = _requiredOptionsForManeuver(mKey);
  return ro.length > 0;
}

/** Determine maneuver tier (1-4). Falls back to 1 for safety. */
function _tierForManeuver(mKey){
  const e = _effectForManeuverKey(mKey) || {};
  let t = Number(e?.tier ?? e?.rarityTier ?? e?.meta?.tier ?? e?.meta?.rarityTier);
  if (Number.isFinite(t) && t>0) return clamp(t, 1, 4);

  const label = String(e?.label || mKey || "");
  const m = label.match(/\bT([1-4])\b/i);
  if (m) return Number(m[1]);

  const r = _lc(e?.rarity || e?.meta?.rarity || e?.tierLabel || e?.rarityLabel || "");
  const map = { common:1, uncommon:1, rare:2, very_rare:3, legendary:4, mythic:4, t1:1, t2:2, t3:3, t4:4 };
  if (r && map[r]) return map[r];
  if (r.includes("very") && r.includes("rare")) return 3;
  if (r.includes("legend")) return 4;
  if (r.includes("rare")) return 2;

  // Heuristic from key patterns
  const k = _lc(mKey);
  const km = k.match(/(?:^|_)t([1-4])(?:_|$)/i);
  if (km) return Number(km[1]);

  return 1;
}

/** Determine faction max maneuver tier (1-4) from progression/power level. */
function _factionTierForActor(factionActor){
  try {
    const t = Number(
      factionActor?.getFlag?.(FCT_ID, "tier") ??
      factionActor?.flags?.[FCT_ID]?.tier ??
      1
    );
    // Alpha tiers are A/B/C => 1/2/3
    return clamp(t || 1, 1, 3);
  } catch { return 1; }
}

// Determine required FACTION tier (1–3) for a maneuver.
// - Prefer explicit minFactionTier on the maneuver definition.
// - Fallback mapping: T1→1, T2→2, T3/T4→3.
function _requiredFactionTierForManeuver(mKey){
  const e = _effectForManeuverKey(mKey) || {};

  // Narrative unlock gating (Beat / Encounter rewards)
  const unlockKey = _lc(e?.unlockKey || e?.meta?.unlockKey || "");
  if (unlockKey) {
    // NOTE: actual enforcement happens in _canFactionUseManeuver;
    // here we only determine tier, not visibility.
  }

  const explicit = Number(e?.minFactionTier ?? e?.meta?.minFactionTier);
  if (Number.isFinite(explicit) && explicit > 0) return clamp(explicit, 1, 3);

  const mt = _tierForManeuver(mKey);
  if (mt <= 1) return 1;
  if (mt === 2) return 2;
  return 3;
}





/** Alpha-safe: determine if a faction may SEE/SELECT a maneuver in the Raid Console. */
// ---------------------------------------------------------------------------
// Doctrine ownership gating (Faction → Raid Console)
// - When doctrine items exist on a faction, only owned maneuver keys are selectable.
// - GM view bypasses this gate for testing.
// - Back-compat safety: if a faction has zero doctrine maneuver items, fail-open.
// ---------------------------------------------------------------------------
const __bbttccDoctrineGateCache = {
  // actorId -> { hasAny:boolean, owned:Set<string>, ts:number }
  byActor: {}
};

function _bbttccDoctrineOwnedManeuversForFaction(factionActor){
  try {
    const a = factionActor;
    if (!a || !a.id) return { hasAny:false, owned:new Set() };

    const cached = __bbttccDoctrineGateCache.byActor[a.id];
    const now = Date.now();
    if (cached && (now - (cached.ts || 0) < 1500)) return cached;

    const api = game.bbttcc?.api?.factions?.doctrine;
    if (!api || typeof api.list !== "function" || typeof api.ownedKeys !== "function") {
      const row = { hasAny:false, owned:new Set(), ts: now };
      __bbttccDoctrineGateCache.byActor[a.id] = row;
      return row;
    }

    const list = api.list(a, "maneuver") || [];
    const hasAny = Array.isArray(list) && list.length > 0;
    const owned0 = api.ownedKeys(a, "maneuver") || new Set();
    const owned = (owned0 instanceof Set) ? owned0 : new Set(Array.from(owned0 || []));

    const row = { hasAny: !!hasAny, owned: owned, ts: now };
    __bbttccDoctrineGateCache.byActor[a.id] = row;
    return row;
  } catch(_e){
    return { hasAny:false, owned:new Set() };
  }
}

function _bbttccDoctrineAllowsManeuver(factionActor, mKey){
  try {
    const k = String(mKey || "").toLowerCase().trim();
    if (!k) return true;

    const g = _bbttccDoctrineOwnedManeuversForFaction(factionActor);
    // Fail-open if faction has no doctrine items yet (legacy / bootstrap)
    if (!g.hasAny) return true;

    return g.owned.has(k);
  } catch(_e){ return true; }
}


function _canFactionUseManeuver(factionActor, mKey, { side="att", activityKey="", targetType="", rigCombatCtx=null } = {}){
  if (!factionActor || !mKey) return { ok:true, reason:"" }; // fail-open to avoid breakage
  const e = _effectForManeuverKey(mKey);
  const isGMView = !!_rcIsGMUser();

  // 0) Doctrine ownership gate (only when doctrine items exist on the faction)
  // GM bypass: allow testing and adjudication.
  if (!_rcIsGMUser()) {
    if (!_bbttccDoctrineAllowsManeuver(factionActor, mKey)) {
      return { ok:false, reason:"Not in faction doctrine." };
    }
  }



  // 0) Tier gating (Faction Tier A/B/C)
  // GM view: allow selecting locked maneuvers for testing / adjudication.
  if (!_rcIsGMUser()) {
    const factionTier = _factionTierForActor(factionActor);
    const reqTier = _requiredFactionTierForManeuver(mKey);
    if (reqTier > factionTier) return { ok:false, reason:`Requires Faction Tier ${reqTier} (current ${factionTier})` };
  }

  
  // 0.5) Availability gating (Standard vs Learned)
  // - Standard: always available if tier gate passes.
  // - Learned: requires an unlock unless the viewer is GM.
  const avail = _lc(e?.availability || e?.meta?.availability || "");
  const unlockKey = _lc(e?.unlockKey || e?.meta?.unlockKey || "");
  if (!_rcIsGMUser()) {
    if (avail === "learned" || unlockKey) {
      const k = unlockKey || _lc(mKey);
      if (!_factionHasManeuverUnlock(factionActor, k)) {
        return { ok:false, reason:`Requires unlock: ${k}` };
      }
    }
  }

// 1) Option-derived maneuvers are roster-gated
  if (_isOptionDerivedManeuver(mKey)) {
    const need = _requiredOptionsForManeuver(mKey);
    if (need.length) {
      const have = _aggregateFactionOptionCounts(factionActor);
      const ok = need.some(k => Number(have[_lc(k)]||0) > 0);
      return ok
        ? { ok:true, reason:"" }
        : { ok:false, reason:`Requires roster option: ${need.join(", ")}` };
    }
    // If we can't infer required option keys, do not block (alpha-safe)
    return { ok:true, reason:"" };
  }

  // 2) Light rig-combat gating (only when activity is rig_combat)
  if (_lc(activityKey) === "rig_combat") {
    // If a maneuver explicitly declares rigRole gating, enforce it.
    const roleNeed = _lc(e?.requiresRigRole || e?.rigRole || e?.meta?.rigRole || "");
    if (roleNeed) {
      const roleHave = _lc(rigCombatCtx?.rigRole || "");
      if (roleNeed !== roleHave) return { ok:false, reason:`Requires rig role: ${roleNeed}` };
    }
  }

  return { ok:true, reason:"" };
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





// ---------------------------------------------------------------------------
// Batch B — Cancel / Interdict / Purge helpers
// We treat certain maneuvers as "tagged" so cancel effects can prune their intents.
// This is an execution-layer interpretation for deterministic testing.
// ---------------------------------------------------------------------------
function _b2InferManeuverTags(mKey){
  mKey = String(mKey||"").toLowerCase().trim();
  const tags = [];

  // Heuristics by key
  if (mKey.includes("rally")) tags.push("rally");
  if (mKey.includes("propaganda")) tags.push("propaganda");
  if (mKey.includes("qliphothic")) tags.push("qliphothic");

  // Soft Power heuristics: check EFFECTS cost/primaryKey if available.
  try {
    const eff = (game.bbttcc?.api?.raid?.EFFECTS || {})[mKey];
    const pk = String(eff?.primaryKey || eff?.meta?.primaryKey || "").toLowerCase();
    if (pk === "softpower") tags.push("softpower");
    const c = eff?.opCosts || eff?.cost || {};
    const sp = Number(c?.softpower || c?.softPower || 0) || 0;
    if (sp > 0) tags.push("softpower");
  } catch(_e){}

  // De-dupe
  const out = [];
  for (const t of tags){
    const k = String(t||"").toLowerCase().trim();
    if (!k) continue;
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

function _b2NormalizeTagList(x){
  const out = [];
  if (!x) return out;
  const push = (v)=>{
    const s = String(v||"").toLowerCase().trim();
    if (s && !out.includes(s)) out.push(s);
  };
  if (Array.isArray(x)) x.forEach(push);
  else push(x);
  return out;
}

function _b2ApplyCancelRules(byManeuver){
  // byManeuver entries may include:
  // { side:"att"|"def", maneuverKey, bundle:{ factionEffects, roundEffects, scenarioEffects, worldEffects } }
  const cancels = [];
  const list = Array.isArray(byManeuver) ? byManeuver : [];

  // Collect cancel directives from any maneuver bundles
  for (const row of list){
    const effs = row?.bundle?.roundEffects || [];
    for (const e of effs){
      const type = String(e?.type||"");
      if (type === "cancelEnemyManeuver") {
        cancels.push({
          kind: "cancelEnemyManeuver",
          fromSide: String(row.side||"att"),
          tags: _b2NormalizeTagList(e?.tags || []),
          scope: String(e?.scope || "enemy").toLowerCase()
        });
      }
      if (type === "cancelEffectTags") {
        cancels.push({
          kind: "cancelEffectTags",
          fromSide: String(row.side||"att"),
          tags: _b2NormalizeTagList(e?.tags || []),
          scope: String(e?.scope || "enemy").toLowerCase()
        });
      }
    }
  }

  if (!cancels.length) return { byManeuver:list, canceled: [] };

  const canceled = [];
  const out = [];

  // Decide if a maneuver row is canceled by any directive
  function isOpponentSide(fromSide, side){
    fromSide = String(fromSide||"att").toLowerCase();
    side = String(side||"att").toLowerCase();
    return (fromSide === "att" && side === "def") || (fromSide === "def" && side === "att");
  }

  for (const row of list){
    const side = String(row?.side||"att").toLowerCase();
    const key = String(row?.maneuverKey||"").toLowerCase();
    const tags = _b2InferManeuverTags(key);

    let blocked = false;
    let reason = "";

    for (const c of cancels){
      // Only "enemy/opponent" scope supported in Batch B
      if (!(c.scope.includes("enemy") || c.scope.includes("opponent"))) continue;
      if (!isOpponentSide(c.fromSide, side)) continue;

      // cancelEnemyManeuver: blocks the whole maneuver's bundle if tags match
      if (c.kind === "cancelEnemyManeuver") {
        if (c.tags.some(t => tags.includes(t))) {
          blocked = true;
          reason = `cancelEnemyManeuver:${c.tags.join(",")}`;
          break;
        }
      }

      // cancelEffectTags: blocks the whole maneuver's bundle if tags match
      // (We keep this deterministic for now; later we can prune only sub-effects.)
      if (c.kind === "cancelEffectTags") {
        if (c.tags.some(t => tags.includes(t))) {
          blocked = true;
          reason = `cancelEffectTags:${c.tags.join(",")}`;
          break;
        }
      }
    }

    if (blocked) {
      canceled.push({ side: side, maneuverKey: key, reason: reason });
      // Keep the row, but strip its bundle effects (so we still have an audit trail)
      const clean = foundry.utils.duplicate(row || {});
      clean.bundle = { factionEffects: [], scenarioEffects: [], roundEffects: [], worldEffects: [] };
      clean.canceled = true;
      clean.cancelReason = reason;
      out.push(clean);
    } else {
      out.push(row);
    }
  }

  return { byManeuver: out, canceled: canceled };
}



// ---------------------------------------------------------------------------
// Batch C — Nullify helper (Void-Signal Collapse)
// - If the attacker succeeds AND a nullifyAllManeuvers directive is present,
//   strip all other maneuver bundles (both sides), leaving only the nullifier(s).
// - Deterministic + audited: round.meta.b2.nullified = [{side,maneuverKey,reason}]
//
// NOTE: Agent throughput uses roundEffects.type = "nullifyAllManeuvers" for void_signal_collapse.
// ---------------------------------------------------------------------------
function _b2RowHasNullifyAll(row){
  try {
    const effs = row?.bundle?.roundEffects || [];
    for (let i=0;i<effs.length;i++){
      const e = effs[i] || {};
      if (String(e.type||"") === "nullifyAllManeuvers") return true;
    }
  } catch(_e) {}
  return false;
}

function _b2ApplyNullifyAllManeuvers(byManeuver, { attackerSuccess=false } = {}){
  const list = Array.isArray(byManeuver) ? byManeuver : [];
  if (!attackerSuccess) return { byManeuver: list, applied:false, nullifiers: [], nullified: [] };

  // Find any attacker-side nullifier rows
  const nullifierIdx = [];
  for (let i=0;i<list.length;i++){
    const row = list[i] || {};
    const side = String(row.side||"").toLowerCase().trim();
    if (side !== "att") continue;
    if (_b2RowHasNullifyAll(row)) nullifierIdx.push(i);
  }
  if (!nullifierIdx.length) return { byManeuver: list, applied:false, nullifiers: [], nullified: [] };

  const nullifiers = nullifierIdx.map(i => {
    const r = list[i] || {};
    return { side: String(r.side||"att"), maneuverKey: String(r.maneuverKey||"").toLowerCase().trim() || "(unknown)" };
  });

  const out = list.map(r => r);
  const nullified = [];

  for (let i=0;i<out.length;i++){
    if (nullifierIdx.includes(i)) continue; // keep nullifiers intact
    const row0 = out[i] || {};
    const key = String(row0.maneuverKey||"").toLowerCase().trim();
    const side = String(row0.side||"").toLowerCase().trim();
    // Strip bundles but preserve audit trail
    const clean = foundry.utils.duplicate(row0 || {});
    clean.bundle = { factionEffects: [], scenarioEffects: [], roundEffects: [], worldEffects: [] };
    clean.nullified = true;
    clean.nullifyReason = "nullifyAllManeuvers";
    out[i] = clean;
    nullified.push({ side: side || "att", maneuverKey: key || "(unknown)", reason: "nullifyAllManeuvers" });
  }

  return { byManeuver: out, applied:true, nullifiers, nullified };
}



// ---------------------------------------------------------------------------
// Batch C — Reflect helper (Defender’s Reversal)
// - Reflects the first attacker maneuver bundle onto the defender reversal bundle.
// - Runs only when defender wins (attacker outcome tier == fail).
// ---------------------------------------------------------------------------
function _b2SwapFactionIdsInEffects(list, attackerId, defenderId){
  const out = [];
  const A = String(attackerId||"").trim();
  const D = String(defenderId||"").trim();
  for (const e0 of (list || [])) {
    const e = foundry.utils.duplicate(e0 || {});
    const fid = String(e.factionId || "").trim();
    if (!fid) {
      e.factionId = D || null;
    } else if (fid === "ATTACKER" || fid === A) {
      e.factionId = D || null;
    } else if (fid === "DEFENDER" || fid === D) {
      e.factionId = A || null;
    }
    out.push(e);
  }
  return out;
}

function _b2ApplyReflectFirst(byManeuver, { attackerId=null, defenderId=null, defenderSuccess=false } = {}){
  if (!defenderSuccess) return { byManeuver: byManeuver, applied:false, reflectedKey:null };
  const list = Array.isArray(byManeuver) ? byManeuver : [];

  // Find defender reversal row
  let reversalIdx = -1;
  for (let i=0;i<list.length;i++){
    const row = list[i];
    const k = String(row?.maneuverKey||"").toLowerCase().trim();
    const side = String(row?.side||"").toLowerCase().trim();
    if (k === "defender_s_reversal" && side === "def") { reversalIdx = i; break; }
  }
  if (reversalIdx < 0) return { byManeuver:list, applied:false, reflectedKey:null };

  // Find first attacker maneuver with any effects in its bundle
  let targetIdx = -1;
  for (let i=0;i<list.length;i++){
    const row = list[i];
    const side = String(row?.side||"").toLowerCase().trim();
    if (side !== "att") continue;
    const k = String(row?.maneuverKey||"").toLowerCase().trim();
    if (!k) continue;
    const b = row?.bundle || {};
    const has = (b.factionEffects && b.factionEffects.length) || (b.roundEffects && b.roundEffects.length) || (b.scenarioEffects && b.scenarioEffects.length) || (b.worldEffects && b.worldEffects.length);
    if (has) { targetIdx = i; break; }
  }
  if (targetIdx < 0) return { byManeuver:list, applied:false, reflectedKey:null };

  const out = list.map(r=>r);
  const source = list[targetIdx];
  const srcKey = String(source?.maneuverKey||"").toLowerCase().trim();
  const srcBundle = source?.bundle || {};

  const rev = foundry.utils.duplicate(out[reversalIdx] || {});
  const revBundle = rev.bundle || { factionEffects: [], scenarioEffects: [], roundEffects: [], worldEffects: [] };

  // Append reflected effects (swap faction ids for factionEffects)
  const addFX = _b2SwapFactionIdsInEffects(srcBundle.factionEffects || [], attackerId, defenderId);
  revBundle.factionEffects = (revBundle.factionEffects || []).concat(addFX);
  revBundle.scenarioEffects = (revBundle.scenarioEffects || []).concat(foundry.utils.duplicate(srcBundle.scenarioEffects || []));
  revBundle.roundEffects = (revBundle.roundEffects || []).concat(foundry.utils.duplicate(srcBundle.roundEffects || []));
  revBundle.worldEffects = (revBundle.worldEffects || []).concat(foundry.utils.duplicate(srcBundle.worldEffects || []));

  rev.bundle = revBundle;
  rev.reflected = { from: srcKey, ts: Date.now() };
  out[reversalIdx] = rev;

  return { byManeuver: out, applied:true, reflectedKey: srcKey };
}


/* ===================================================================
 * B2 — Maneuver Intents on GM Commit
 * Uses bbttcc-agent-api.js (preview intents) as the single source of truth.
 *
 * Contract:
 * - Compute intents from selected maneuvers at GM Commit only.
 * - Persist intents on the resolved round: round.meta.intents
 * - Apply NOW:
 *     - factionEffects (via World Mutation Engine)
 *     - scenarioEffects (via scenario engines when present)
 * - Do NOT apply worldEffects yet; store as pending.
 * =================================================================== */

function _b2NormOutcomeTier(outcomeStr){
  const s = String(outcomeStr || "").toLowerCase();
  if (s.includes("great") && s.includes("success")) return "great_success";
  if (s.includes("success")) return "success";
  if (s.includes("win")) return "success";
  if (s.includes("loss")) return "fail";
  if (s.includes("fail")) return "fail";
  // If outcome is empty/unknown, default to unknown (agent handlers will usually no-op)
  return "unknown";
}

function _b2SafeArr(x){ return Array.isArray(x) ? x : []; }

function _b2DedupByJSON(list){
  const out = [];
  const seen = new Set();
  for (const it of (list || [])) {
    const key = (() => { try { return JSON.stringify(it || {}); } catch(_e){ return String(it); } })();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function _b2FixFactionIds(fx, { attackerId=null, defenderId=null } = {}){
  const out = [];
  for (const e0 of (fx || [])) {
    const e = foundry.utils.duplicate(e0 || {});
    const fid = String(e.factionId || "").trim();
    if (!fid) {
      // If a handler didn't specify factionId, assume attacker (safe default).
      e.factionId = attackerId;
    } else if (fid === "DEFENDER") {
      e.factionId = defenderId || null;
    } else if (fid === "ATTACKER") {
      e.factionId = attackerId || null;
    }
    out.push(e);
  }
  return out;
}

async function _b2ComputeAndApplyManeuverIntents({ app, round, attacker, defender, targetHex, targetType }){
  if (!round) return { ok:false, persisted:false, note:"no-round" };

  // Idempotency: if we already applied intents for this committed round, do nothing.
  try {
    const already = round?.meta?.intents?.appliedAt;
    if (already) return { ok:true, persisted:false, note:"already-applied", appliedAt: already };
  } catch(_e) {}

  const agent = game.bbttcc?.api?.agent;
  const simFn = agent?.simulate?.maneuver;
  if (typeof simFn !== "function") {
    return { ok:false, persisted:false, note:"no-agent-api" };
  }

  const attackerId = attacker?.id || null;
  const defenderId = defender?.id || null;

  const ctxBase = {
    raidType: String(round.activityKey || ""),
    outcomeTier: (() => {
      const t0 = _b2NormOutcomeTier(round.outcome || "");
      if (t0 !== "unknown") return t0;
      const st = (round && round.meta && round.meta.scenarioOutcomeTier) ? String(round.meta.scenarioOutcomeTier).toLowerCase() : "";
      if (st === "success" || st === "fail" || st === "great_success") return st;
      const a = Number(round.total || 0);
      const d = Number(round.dcFinal != null ? round.dcFinal : 0);
      if (Number.isFinite(a) && Number.isFinite(d) && (a || d)) return (a >= d) ? "success" : "fail";
      return t0;
    })(),
    attackerFactionId: attackerId,
    defenderFactionId: defenderId,
    target: {
      type: String(targetType || round.targetType || ""),
      uuid: round.targetUuid || null,
      rigId: round.rigId || null,
      creatureId: round.creatureId || null,
      name: round.targetName || null
    },
    meta: {
      roundId: round.roundId || null,
      attackerId: attackerId,
      defenderId: defenderId
    }
  };

  const __tier0 = _b2NormOutcomeTier(round.outcome || "");
const __tier = (__tier0 !== "unknown") ? __tier0
  : ((round && round.meta && round.meta.scenarioOutcomeTier) ? String(round.meta.scenarioOutcomeTier).toLowerCase() : __tier0);

  function ctxForSide(side){
    return Object.assign({}, ctxBase, {
      outcomeTier: (side === "def")
        ? (__tier === "fail" ? "success" : "fail")
        : __tier
    });
  }


  const mansAtt = _b2SafeArr(round.mansSelected).map(k => String(k||"").trim()).filter(Boolean);
  const mansDef = _b2SafeArr(round.mansSelectedDef).map(k => String(k||"").trim()).filter(Boolean);
  const __hasDefReversal = mansDef.map(k=>String(k||"").toLowerCase()).includes("defender_s_reversal");

  const merged = {
    roundEffects: [],
    scenarioEffects: [],
    worldEffects: [],
    factionEffects: [],
    byManeuver: [],
    meta: { spec:"intent-v1", preview:false, computedAt: Date.now() }
  };

  async function addOne(maneuverKey, side){
    try {
      const res = await simFn(Object.assign({}, ctxForSide(side), { maneuverKey })) || {};
      let bundle = res.previewWorldEffects || null;

      // Batch C: Defender’s Reversal reflects the *attempt* even when the attacker failed.
      // Some agent handlers no-op on attacker failure; if defender_s_reversal is present and the attacker lost,
      // retry attacker maneuver simulation using a "success" tier so we can obtain a reflectable bundle.
      if (!bundle) {
        try {
          if (side === "att" && String(__tier||"") === "fail" && __hasDefReversal) {
            const res2 = await simFn(Object.assign({}, Object.assign({}, ctxForSide(side), { outcomeTier: "success" }), { maneuverKey })) || {};
            bundle = res2.previewWorldEffects || null;
          }
        } catch(_eReSim) {}
      }

      if (!bundle) return;

      const fx = _b2FixFactionIds(bundle.factionEffects || [], { attackerId, defenderId });
      merged.factionEffects.push(...fx);

      merged.scenarioEffects.push(...(bundle.scenarioEffects || []));
      merged.roundEffects.push(...(bundle.roundEffects || []));

      // worldEffects are pending only
      merged.worldEffects.push(...(bundle.worldEffects || []));

      merged.byManeuver.push({
        side: side,
        maneuverKey: maneuverKey,
        meta: bundle.meta || null,
        bundle: {
          factionEffects: foundry.utils.duplicate(bundle.factionEffects || []),
          scenarioEffects: foundry.utils.duplicate(bundle.scenarioEffects || []),
          roundEffects: foundry.utils.duplicate(bundle.roundEffects || []),
          worldEffects: foundry.utils.duplicate(bundle.worldEffects || [])
        },
        has: {
          faction: !!(bundle.factionEffects && bundle.factionEffects.length),
          scenario: !!(bundle.scenarioEffects && bundle.scenarioEffects.length),
          round: !!(bundle.roundEffects && bundle.roundEffects.length),
          world: !!(bundle.worldEffects && bundle.worldEffects.length)
        }
      });
    } catch (e) {
      merged.byManeuver.push({ side, maneuverKey, error: String(e) });
    }
  }

  for (const k of mansAtt) await addOne(k, "att");
  for (const k of mansDef) await addOne(k, "def");


  // Batch B: apply cancel/interdict directives BEFORE applying faction/scenario effects.
  // This prunes maneuver bundles deterministically based on tags (rally/propaganda/softpower/qliphothic).
  try {
    const cr = _b2ApplyCancelRules(merged.byManeuver || []);
    merged.byManeuver = cr.byManeuver || merged.byManeuver;

    // Rebuild merged arrays from (possibly stripped) bundles so canceled maneuvers contribute no effects.
    merged.factionEffects = [];
    merged.scenarioEffects = [];
    merged.roundEffects = [];
    merged.worldEffects = [];

    for (const row of (merged.byManeuver || [])) {
      const b = row?.bundle || null;
      if (!b) continue;
      merged.factionEffects.push(...(b.factionEffects || []));
      merged.scenarioEffects.push(...(b.scenarioEffects || []));
      merged.roundEffects.push(...(b.roundEffects || []));
      merged.worldEffects.push(...(b.worldEffects || []));
    }

    // Breadcrumb for debugging
    round.meta ||= {};
    round.meta.b2 ||= {};
    if (cr.canceled && cr.canceled.length) {
      round.meta.b2.canceled = cr.canceled;
    }
  } catch(_eCancel) {}


  
  // Batch C: Void-Signal Collapse — if attacker succeeded and the nullify directive exists,
  // strip all other maneuver bundles deterministically.
  try {
    const attackerSuccess = (String(__tier||"") === "success" || String(__tier||"") === "great_success");
    const nr = _b2ApplyNullifyAllManeuvers(merged.byManeuver, { attackerSuccess: attackerSuccess });
    if (nr && nr.applied) {
      merged.byManeuver = nr.byManeuver || merged.byManeuver;

      // Rebuild merged arrays from updated bundles (nullified maneuvers contribute no effects)
      merged.factionEffects = [];
      merged.scenarioEffects = [];
      merged.roundEffects = [];
      merged.worldEffects = [];
      for (const row of (merged.byManeuver || [])) {
        const b = row?.bundle || null;
        if (!b) continue;
        merged.factionEffects.push(...(b.factionEffects || []));
        merged.scenarioEffects.push(...(b.scenarioEffects || []));
        merged.roundEffects.push(...(b.roundEffects || []));
        merged.worldEffects.push(...(b.worldEffects || []));
      }

      round.meta ||= {};
      round.meta.b2 ||= {};
      round.meta.b2.nullified = { nullifiers: nr.nullifiers || [], nullified: nr.nullified || [] };
    }
  } catch(_eNullify) {}


// Batch C: Defender’s Reversal — reflect first attacker bundle onto defender when attacker failed (defender won).
  try {
    const defenderSuccess = (String(__tier||"") === "fail");
    const rr = _b2ApplyReflectFirst(merged.byManeuver, { attackerId: attackerId, defenderId: defenderId, defenderSuccess: defenderSuccess });
    if (rr && rr.applied) {
      merged.byManeuver = rr.byManeuver || merged.byManeuver;

      // Rebuild merged arrays from updated bundles
      merged.factionEffects = [];
      merged.scenarioEffects = [];
      merged.roundEffects = [];
      merged.worldEffects = [];
      for (const row of (merged.byManeuver || [])) {
        const b = row?.bundle || null;
        if (!b) continue;
        merged.factionEffects.push(...(b.factionEffects || []));
        merged.scenarioEffects.push(...(b.scenarioEffects || []));
        merged.roundEffects.push(...(b.roundEffects || []));
        merged.worldEffects.push(...(b.worldEffects || []));
      }

      round.meta ||= {};
      round.meta.b2 ||= {};
      round.meta.b2.reflected = rr.reflectedKey || true;
    }
  } catch(_eReflect) {}


  // Dedupe (helps when a maneuver is auto-carried and also explicitly selected, etc.)
  merged.factionEffects = _b2DedupByJSON(merged.factionEffects);
  merged.scenarioEffects = _b2DedupByJSON(merged.scenarioEffects);
  merged.roundEffects = _b2DedupByJSON(merged.roundEffects);
  merged.worldEffects = _b2DedupByJSON(merged.worldEffects);

  // Persist to round meta (resolved round data)
  round.meta ||= {};
  round.meta.intents = {
    spec: "intent-v1",
    computedAt: merged.meta.computedAt,
    appliedAt: null,
    applied: {
      factionEffects: merged.factionEffects,
      scenarioEffects: merged.scenarioEffects,
      // We intentionally do NOT "apply" roundEffects yet; store for future tactical execution.
      roundEffects: merged.roundEffects
    },
    pending: {
      worldEffects: merged.worldEffects
    },
    byManeuver: merged.byManeuver
  };

  // Apply factionEffects now via WME
  let appliedFaction = false;
  try {
    const wm = game.bbttcc?.api?.worldMutation;
    if (wm && typeof wm.applyWorldEffects === "function" && merged.factionEffects.length) {
      const we = { factionEffects: merged.factionEffects };
      const ctx = {
        factionId: attackerId,
        beatId: round.roundId || "raid_round",
        beatType: "raid_commit",
        beatLabel: `Raid Commit (${String(round.activityKey||"raid")})`,
        source: "b2_intents"
      };
      await wm.applyWorldEffects(we, ctx);
      appliedFaction = true;
    }
  } catch (e) {
    warn("B2 apply factionEffects failed", e);
  }

  // Apply scenarioEffects now (only where an engine exists)
  let appliedScenario = false;
  try {
    if (merged.scenarioEffects.length) {
      const mode = String(round.activityKey || "").toLowerCase();
      // Infiltration (Alarm)
      if (mode === "infiltration_alarm" && app && app.__infilScenario && typeof app.__infilScenario.applyEffects === "function") {
        await app.__infilScenario.applyEffects(merged.scenarioEffects);
        appliedScenario = true;
      }
      // Courtly Intrigue (if you later expose applyEffects)
      if (mode === "courtly" && app && app.__courtlyScenario && typeof app.__courtlyScenario.applyEffects === "function") {
        await app.__courtlyScenario.applyEffects(merged.scenarioEffects);
        appliedScenario = true;
      }
      // Otherwise: no engine; effects remain recorded on round meta for future implementation.
    }
  } catch (e) {
    warn("B2 apply scenarioEffects failed", e);
  }

  // Mark appliedAt (even if no-op); we want idempotency.
  const appliedAt = Date.now();
  round.meta.intents.appliedAt = appliedAt;
  round.meta.intents.appliedSummary = {
    appliedFaction: appliedFaction,
    appliedScenario: appliedScenario,
    factionEffectsCount: merged.factionEffects.length,
    scenarioEffectsCount: merged.scenarioEffects.length,
    roundEffectsCount: merged.roundEffects.length,
    pendingWorldEffectsCount: merged.worldEffects.length
  };

  const summary = round.meta.intents.appliedSummary;

  return {
    ok: true,
    persisted: true,
    appliedAt,
    summary
  };
}


/* ===================================================================
 * B3 — Execute Round Effects
 *
 * Philosophy:
 * - Round effects are raid-local (NOT world effects).
 * - We apply ONLY the subset that can be expressed as roll modifiers safely.
 * - Execution model:
 *    1) "nextRoll" effects are stored on the attacker faction under:
 *         flags.bbttcc-raid.raidRollMods
 *       and consumed (one-shot) at the start of the next GM commit.
 *    2) We do NOT mutate world state for these.
 *
 * Supported (initial):
 * - rollBonus (when: nextRoll) → bonus applied to next attacker/defender roll
 * - advantage / disadvantage (window/when: nextRoll) → 2d20 keep high/low next roll
 *
 * Everything else remains recorded under round.meta.intents for later phases.
 * =================================================================== */

function _b3EmptyMods(){
  return {
    v: 1,
    ts: Date.now(),
    nextRoll: {
      att: { bonus: 0, mode: "normal" }, // mode: normal | adv | dis
      def: { bonus: 0, mode: "normal" }
    },
    src: null
  };
}

function _b3NormMode(mode){
  const s = String(mode||"").toLowerCase();
  if (s === "advantage" || s === "adv") return "adv";
  if (s === "disadvantage" || s === "dis") return "dis";
  return "normal";
}

function _b3PickSideFromScope(scope, fallbackSide){
  const s = String(scope||"").toLowerCase();
  if (s.includes("attacker") || s.includes("ally")) return "att";
  if (s.includes("defender") || s.includes("enemy") || s.includes("opponent")) return "def";
  return fallbackSide || "att";
}

async function _b3ConsumePendingRollMods(attackerActor){
  try {
    if (!attackerActor || typeof attackerActor.getFlag !== "function") return _b3EmptyMods();
    const cur = attackerActor.getFlag(RAID_ID, "raidRollMods") || null;
    // Clear no matter what (one-shot).
    await attackerActor.unsetFlag(RAID_ID, "raidRollMods").catch(()=>{});
    if (!cur || typeof cur !== "object") return _b3EmptyMods();
    // Normalize shape
    const out = _b3EmptyMods();
    out.ts = Number(cur.ts || out.ts);
    out.src = cur.src || null;

    // Preferred shape (B3): { nextRoll: { att:{mode,bonus}, def:{mode,bonus} } }
    const nr = cur.nextRoll || {};

    // Legacy/console-friendly shape: { mode, bonus } means "attacker next roll".
    // This lets us simulate advantage/disadvantage without knowing the internal structure.
    const legacyMode = (cur.mode != null) ? _b3NormMode(cur.mode) : null;
    const legacyBonus = (cur.bonus != null) ? Number(cur.bonus || 0) : null;

    out.nextRoll.att.bonus = Number(nr?.att?.bonus || 0) || 0;
    out.nextRoll.def.bonus = Number(nr?.def?.bonus || 0) || 0;
    out.nextRoll.att.mode  = _b3NormMode(nr?.att?.mode || "normal");
    out.nextRoll.def.mode  = _b3NormMode(nr?.def?.mode || "normal");

    if (legacyMode && legacyMode !== "normal") out.nextRoll.att.mode = legacyMode;
    if (legacyBonus != null && Number.isFinite(legacyBonus) && legacyBonus) out.nextRoll.att.bonus += legacyBonus;

    return out;
  } catch (_e) {
    return _b3EmptyMods();
  }
}

async function _b3StoreNextRollMods(attackerActor, mods){
  try {
    if (!attackerActor || typeof attackerActor.setFlag !== "function") return false;
    const safe = _b3EmptyMods();
    const nr = mods?.nextRoll || {};
    safe.nextRoll.att.bonus = Number(nr?.att?.bonus || 0) || 0;
    safe.nextRoll.def.bonus = Number(nr?.def?.bonus || 0) || 0;
    safe.nextRoll.att.mode  = _b3NormMode(nr?.att?.mode || "normal");
    safe.nextRoll.def.mode  = _b3NormMode(nr?.def?.mode || "normal");
    safe.src = mods?.src || null;

    // If empty, don't write anything.
    const empty = (!safe.nextRoll.att.bonus && !safe.nextRoll.def.bonus && safe.nextRoll.att.mode==="normal" && safe.nextRoll.def.mode==="normal");
    if (empty) return false;

    await attackerActor.setFlag(RAID_ID, "raidRollMods", safe);
    return true;
  } catch (_e) { return false; }
}

function _b3ApplyEffectToMods(effect, mods, fallbackSide){
  if (!effect || typeof effect !== "object") return;
  const t = String(effect.type||"").trim();
  const when = String(effect.when || effect.window || "").toLowerCase();
  if (when !== "nextroll") return;

  if (t === "rollBonus") {
    const amt = Number(effect.amount || 0) || 0;
    if (!amt) return;
    const side = _b3PickSideFromScope(effect.scope, fallbackSide);
    if (side === "def") mods.nextRoll.def.bonus += amt;
    else mods.nextRoll.att.bonus += amt;
    return;
  }

  if (t === "advantage") {
    const side = _b3PickSideFromScope(effect.scope, fallbackSide);
    if (side === "def") mods.nextRoll.def.mode = "adv";
    else mods.nextRoll.att.mode = "adv";
    return;
  }

  if (t === "disadvantage") {
    const side = _b3PickSideFromScope(effect.scope, fallbackSide);
    if (side === "def") mods.nextRoll.def.mode = "dis";
    else mods.nextRoll.att.mode = "dis";
    return;
  }
}


function _b3ComputeThisRoundMods(round, mansAtt, mansDef){
  function lc(s){ return String(s||"").toLowerCase().trim(); }


  const attHasSuppressive = (Array.isArray(mansAtt)?mansAtt:[]).map(lc).includes("suppressive_fire");
  const defHasSuppressive = (Array.isArray(mansDef)?mansDef:[]).map(lc).includes("suppressive_fire");

  // B3.2: minimal "thisRound" execution for two maneuvers (A then B):
  // - Flank Attack: attacker margin +1 (may flip win/loss and tiering)
  // - Defensive Entrenchment: defender bonus +3 (contested) / DC +3 (non-contested)
  // NOTE: We intentionally compute from selected maneuvers directly (not from Agent intents),
  // because Agent throughput handlers currently gate these on outcomeTier and would no-op.
  const out = {
    attackerMarginDelta: 0,
    defenderBonusDelta: 0,
    // Flash Bargain: temporary "borrow" swing expressed as roll bonus deltas (this round only)
    attackerRollBonusDelta: 0,
    defenderRollBonusDelta: 0,
    // roll modes for THIS round only (normal | adv | dis)
    rollModeAtt: "normal",
    rollModeDef: "normal",
    // Patch the Breach: defender-only structure interaction (damage -1, or repair 1 if no damage)
    patchTheBreach: false,
    notes: []
  };
  try {
    const a = Array.isArray(mansAtt) ? mansAtt.map(k=>String(k||"").toLowerCase()) : [];
    const d = Array.isArray(mansDef) ? mansDef.map(k=>String(k||"").toLowerCase()) : [];

    if (a.includes("flank_attack")) {
      out.attackerMarginDelta += 1;
      out.notes.push("flank_attack: margin +1");
    }
    if (d.includes("defensive_entrenchment")) {
      out.defenderBonusDelta += 3;
      out.notes.push("defensive_entrenchment: defender +3");
    }
    // Batch A: additional "thisRound" executions (deterministic, no new subsystems)
    // Battlefield Harmony: attacker margin +2 this round (tiering/margin only)
    if (a.includes("battlefield_harmony")) {
      out.attackerMarginDelta += 2;
      out.notes.push("battlefield_harmony: margin +2");
    }
    if (d.includes("battlefield_harmony")) {
      out.attackerMarginDelta -= 2;
      out.notes.push("battlefield_harmony: margin -2 (def)");
    }

    // Qliphothic Gambit: attacker roll bonus +6 this round
    if (a.includes("qliphothic_gambit")) {
      out.attackerRollBonusDelta += 6;
      out.notes.push("qliphothic_gambit: roll +6");
    }
    if (d.includes("qliphothic_gambit")) {
      out.defenderRollBonusDelta += 6;
      out.notes.push("qliphothic_gambit: roll +6 (def)");
    }

    // Harmonic Chant: allies gain Advantage this round (represented as advantage for the acting side)
    if (a.includes("harmonic_chant")) {
      out.rollModeAtt = "adv";
      out.notes.push("harmonic_chant: attacker advantage");
    }
    if (d.includes("harmonic_chant")) {
      out.rollModeDef = "adv";
      out.notes.push("harmonic_chant: defender advantage");
    }

    // Tactical Overwatch: attacker gains Advantage this round.
    if (a.includes("tactical_overwatch")) {
      out.rollModeAtt = "adv";
      out.notes.push("tactical_overwatch: attacker advantage");
    }

    // Flash Bargain: temporary swing (this round only).
    // Interpretation (Alpha-safe): attacker gains +1 to their roll bonus and defender takes -1 to theirs for this round.
    // If defender is not present (single-roll raids), only the attacker bonus matters.
    if (a.includes("flash_bargain")) {
      out.attackerRollBonusDelta += 1;
      out.defenderRollBonusDelta -= 1;
      out.notes.push("flash_bargain: borrow +1");
    }
    if (d.includes("flash_bargain")) {
      out.defenderRollBonusDelta += 1;
      out.attackerRollBonusDelta -= 1;
      out.notes.push("flash_bargain: borrow +1 (def)");
    }

    // Patch the Breach: defender structure stabilization.
    if (d.includes("patch_the_breach")) {
      out.patchTheBreach = true;
      out.notes.push("patch_the_breach: structure stabilize");
    }
    // Psychic Disruption: impose disadvantage on the opponent THIS round.
    // - If attacker uses it: defender rolls at disadvantage.
    // - If defender uses it: attacker rolls at disadvantage.
    if (a.includes("psychic_disruption")) {
      out.rollModeDef = "dis";
      out.notes.push("psychic_disruption: defender disadvantage");
    }
    if (d.includes("psychic_disruption")) {
      out.rollModeAtt = "dis";
      out.notes.push("psychic_disruption: attacker disadvantage");
    }
  } catch(_e) {}
  out.suppressive = { att: attHasSuppressive, def: defHasSuppressive };
  return out;
}
// ------------------------------------------------------------
// B3 — Structure Guard Effects (this round)
// - Last-Stand Banner: defenders ignore the first Structure loss this round.
//   Implementation: reduce final computed structure damage by 1 (min 0), once per round.
//   Source: either selected maneuver key (last_stand_banner) OR B2 intent roundEffect (ignoreStructureLoss).
// ------------------------------------------------------------
function _b3HasLastStandBanner(round, mansDef){
  try {
    // If defender explicitly selected the maneuver, honor it.
    const d = Array.isArray(mansDef) ? mansDef.map(k=>String(k||"").toLowerCase()) : [];
    if (d.includes("last_stand_banner")) return true;

    // Otherwise, if B2 intents produced the guard effect, honor it.
    const effs = round?.meta?.intents?.applied?.roundEffects;
    if (Array.isArray(effs)) {
      for (let i=0;i<effs.length;i++){
        const e = effs[i] || {};
        if (String(e.type||"") === "ignoreStructureLoss") return true;
      }
    }
  } catch(_e) {}
  return false;
}

function _b3ConsumeStructureGuardOnce(round, { source="last_stand_banner" } = {}){
  // Idempotent per round: only consume once, even if multiple structure pipelines run.
  try {
    round.meta ||= {};
    round.meta.b3 ||= {};
    round.meta.b3.structureGuard ||= {};
    if (round.meta.b3.structureGuard.consumed === true) return false;
    round.meta.b3.structureGuard = { consumed:true, source:String(source||"") || "last_stand_banner", ts: Date.now() };
    return true;
  } catch(_e) { return true; }
}

function _b3ApplyStructureGuard(round, mansDef, dmg){
  dmg = Number(dmg||0) || 0;
  if (dmg <= 0) return dmg;
  if (!_b3HasLastStandBanner(round, mansDef)) return dmg;
  if (!_b3ConsumeStructureGuardOnce(round, { source:"last_stand_banner" })) return dmg;
  // Ignore the first structure loss
  return Math.max(0, dmg - 1);
}

// ------------------------------------------------------------
// B3 — Next-Round Allowances (Logistical Surge / Command Overdrive future)
// - Logistical Surge: on success, attacker may repeat the prior round's maneuver next round at no cost.
//   Storage: flags.bbttcc-raid.nextRoundRepeatManeuver (on attacker faction actor)
//   Shape: { key:string, free:true, srcRoundId:string, ts:number }
// ------------------------------------------------------------
function _b3GetNextRoundRepeat(attackerActor){
  try {
    if (!attackerActor || typeof attackerActor.getFlag !== "function") return null;
    const row = attackerActor.getFlag(RAID_ID, "nextRoundRepeatManeuver") || null;
    if (!row || typeof row !== "object") return null;
    const key = String(row.key || "").toLowerCase().trim();
    if (!key) return null;
    return { key:key, free: (row.free !== false), srcRoundId: String(row.srcRoundId||""), ts: Number(row.ts||0)||0 };
  } catch(_e){ return null; }
}
async function _b3SetNextRoundRepeat(attackerActor, row){
  try {
    if (!attackerActor || typeof attackerActor.setFlag !== "function") return false;
    if (!row) return false;
    const key = String(row.key || "").toLowerCase().trim();
    if (!key) return false;
    const safe = { key:key, free: (row.free !== false), srcRoundId: String(row.srcRoundId||""), ts: Number(row.ts||Date.now())||Date.now() };
    await attackerActor.setFlag(RAID_ID, "nextRoundRepeatManeuver", safe);
    return true;
  } catch(_e){ return false; }
}
async function _b3ClearNextRoundRepeat(attackerActor){
  try {
    if (!attackerActor || typeof attackerActor.unsetFlag !== "function") return false;
    await attackerActor.unsetFlag(RAID_ID, "nextRoundRepeatManeuver").catch(()=>{});
    return true;
  } catch(_e){ return false; }
}
function _b3IsSuccessOutcome(round){
  try {
    // Prefer explicit contested margin when present (covers margin-delta effects like Flank/Battlefield Harmony)
    if (round && round.contested && round.margin != null) {
      const m = Number(round.margin || 0);
      if (Number.isFinite(m)) return m >= 0;
    }

    // Prefer outcome string when available (covers UI-tiered overrides)
    const out = String(round?.outcome || "").toLowerCase();
    if (out.includes("great success") || out.includes("success") || out.includes("win")) return true;
    if (out.includes("fail") || out.includes("loss")) return false;

    // Fallback: raw totals
    const a = Number(round?.total || 0);
    const d = Number(round?.dcFinal != null ? round.dcFinal : (round?.DC || 0));
    if (!Number.isFinite(a) || !Number.isFinite(d)) return false;
    return a >= d;
  } catch(_e){ return false; }
}

function _b3PickPriorManeuverForRepeat(rounds, curIdx, attackerId){
  // "Repeat last round’s maneuver" means: look BACK for the prior committed round with maneuvers,
  // and repeat the first attacker maneuver (excluding logistical_surge itself when possible).
  try {
    const rid = String(attackerId||"");
    for (let i = Number(curIdx||0) - 1; i >= 0; i--) {
      const r = rounds && rounds[i] ? rounds[i] : null;
      if (!r) continue;
      if (rid && String(r.attackerId||"") !== rid) continue;
      const mans = Array.isArray(r.mansSelected) ? r.mansSelected.map(k=>String(k||"").toLowerCase()) : [];
      if (!mans.length) continue;
      for (const k of mans){
        if (!k) continue;
        if (k === "logistical_surge") continue;
        return k;
      }
      // if we only had logistical_surge, allow it (edge case)
      return mans[0] || null;
    }
  } catch(_e) {}
  return null;
}
function _b3MarkManeuverFreeOnRound(round, key){
  try {
    if (!round || !key) return;
    const k = String(key||"").toLowerCase().trim();
    if (!k) return;
    round.meta ||= {};
    round.meta.b3 ||= {};
    round.meta.b3.freeManeuvers ||= {};
    round.meta.b3.freeManeuvers[k] = true;
  } catch(_e) {}
}
function _b3IsManeuverFreeOnRound(round, key){
  try {
    const k = String(key||"").toLowerCase().trim();
    if (!k) return false;
    return !!round?.meta?.b3?.freeManeuvers?.[k];
  } catch(_e){ return false; }
}

function _b3RollModeFromKey(k){
  k = String(k||"").toLowerCase();
  if (k === "advantage" || k === "adv") return "advantage";
  if (k === "disadvantage" || k === "disadv") return "disadvantage";
  return "normal";
}

async function _b3RerollSide({ side, bonus, mode }){
  mode = _b3RollModeFromKey(mode);
  let formula = "1d20 + @b";
  if (mode === "advantage") formula = "2d20kh1 + @b";
  if (mode === "disadvantage") formula = "2d20kl1 + @b";
  const rr = new Roll(formula, { b: Number(bonus||0) });
  await rr.evaluate();
  return rr;
}
async function _b3ExecuteRoundEffectsPostCommit({ round, attackerActor, defenderActor }){
  try {
    const effs = round?.meta?.intents?.applied?.roundEffects;
    if (!Array.isArray(effs) || !effs.length) return { ok:true, stored:false, count:0 };

    const mods = _b3EmptyMods();
    mods.src = round?.roundId || round?.ts || null;

    // Default: effects generated by attacker maneuvers are "att" unless scope says otherwise.
    for (const e of effs) _b3ApplyEffectToMods(e, mods, "att");

    const stored = await _b3StoreNextRollMods(attackerActor, mods);
    return { ok:true, stored, count: effs.length, mods: mods };
  } catch (e) {
    warn("B3 executeRoundEffects failed", e);
    return { ok:false, stored:false, error: String(e) };
  }
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

    console.log("[bbttcc-raid] API shim ready. openConsole available:", typeof raid.openConsole);
  } catch (err) {
    console.error("[bbttcc-raid] API export shim failed:", err);
  }
});

// ------------------------------------------------------------
// Scenario HUD styles (inline, Hex Chrome)
// ------------------------------------------------------------
Hooks.once("ready", () => {
  const css = `
  .bbttcc-scenario-hud{
    display:flex; align-items:center; gap:.5rem;
    padding:.35rem .5rem; margin-bottom:.35rem;
    background:linear-gradient(90deg,#0b1a33,#122a55);
    border-radius:6px; font-size:12px;
  }
  .bbttcc-scenario-hud .chip{
    padding:.1rem .45rem; border-radius:999px;
    background:#1f3b70; color:#fff; font-weight:600;
  }
  .bbttcc-scenario-hud .chip.warn{ background:#924040; }
  .bbttcc-scenario-hud .bar{
    position:relative; min-width:90px;
    background:#0a1833; border-radius:4px;
    padding:0 .25rem; font-size:11px;
  }
  .bbttcc-scenario-hud .bar i{
    position:absolute; left:0; top:0; bottom:0;
    background:#3b82f6; opacity:.55;
  }
  .bbttcc-scenario-hud .bar.alarm i{ background:#f59e0b; }
  .bbttcc-alarm-quiet{ background:#2563eb; }
  .bbttcc-alarm-suspicious{ background:#f59e0b; }
  .bbttcc-alarm-alerted{ background:#fb923c; }
  .bbttcc-alarm-lockdown{ background:#dc2626; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
});