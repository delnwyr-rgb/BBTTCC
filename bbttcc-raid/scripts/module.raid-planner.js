// modules/bbttcc-raid/scripts/module.raid-planner.js
/* bbttcc-raid " V2 Raid Console + Activity Planner (Strategic-only list)
 * Planner builds from raid.EFFECTS (kind:"strategic"), excludes raid TYPES.
 * Writes type:"planned" entries; NEVER defines consumePlanned (compat-bridge owns it).
 * Keeps V2 UI, Pick-on-Canvas, toolbar Raid + Plan buttons.
 *
 * PATCH (Rigs Sprint Option 4C):
 * - If selected activityKey === "repair_rig", planner targets a Rig (Faction -> Rig) instead of a Hex.
 * - planActivity now supports targetType:"rig" with defenderId + rigId (no hex UUID required).
 */

const RAID_ID = "bbttcc-raid";
const FCT_ID  = "bbttcc-factions";
const TERR_ID = "bbttcc-territory";
const log  = (...a)=>console.log(`[${RAID_ID}]`,...a);
const warn = (...a)=>console.warn(`[${RAID_ID}]`,...a);


/* ===================================================================
 * BBTTCC Tooltip System (shared, syntax-safe)
 * - Lightweight hover/click tooltip for strategic activities + maneuvers.
 * - Source of truth: game.bbttcc.api.raid.EFFECTS
 * - IMPORTANT: binds globally (document-level) so multiple apps work together.
 * =================================================================== */
(function(){
  if (globalThis.BBTTCC_TooltipManager) {
    // Ensure we are globally bound even if an older manager was created earlier.
    try { globalThis.BBTTCC_TooltipManager.bind(document); } catch(e){}
    return;
  }

  const TAG = "[bbttcc-tooltips]";
  const logT = function(){ try { console.log.apply(console, [TAG].concat([].slice.call(arguments))); } catch(e){} };

  function _escapeHtml(s){
    s = String(s == null ? "" : s);
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function _prettyKey(k){
    return String(k||"").replace(/[_-]/g," ").replace(/\b\w/g,function(m){return m.toUpperCase();});
  }

  function _lc(s){ return String(s||"").toLowerCase(); }

  // Normalize cost map (supports {op:{...}} and flat objects)
  function _normCost(cost){
    const out = {};
    if (!cost || typeof cost !== "object") return out;
    if (cost.op && typeof cost.op === "object") cost = cost.op;
    for (const k in cost){
      if (!Object.prototype.hasOwnProperty.call(cost,k)) continue;
      const v = Number(cost[k] || 0);
      if (!v) continue;
      out[String(k).toLowerCase()] = v;
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

  // Canonical fallback text (seeded from "Maneuvers & Strategic Activities Expansion (v1.0)")
  // Used only when EFFECTS lacks a useful text/description field.
  const FALLBACK_TEXT = {
    // Maneuvers
    suppressive_fire: "Force enemy reroll lowest d20 this round.",
    smoke_and_mirrors: "Reduce Alarm Level by 1.",
    rally_the_line: "+1 to next attack/defense for allies.",
    patch_the_breach: "Restore 1 Structure Point.",
    flash_bargain: "Borrow +1 enemy OP for this round.",
    saboteurs_edge: "Ignore one Fortified modifier this turn.",
    bless_the_fallen: "Negate first casualty this round.",
    logistical_surge: "Repeat last round's maneuver at no cost.",
    command_overdrive: "Gain initiative for next round.",
    psychic_disruption: "Opponents roll at Disadvantage this round.",
    echo_strike_protocol: "Apply attack effect twice vs different targets.",
    moral_high_ground: "+2 to Empathy Meter after victory.",
    quantum_shield: "Reduce incoming damage by half for one round.",
    overclock_the_golems: "+3 attack for one construct unit; loses 1 HP.",
    counter_propaganda_wave: "Cancel enemy Soft Power effect this round.",
    sephirotic_intervention: "Auto-win one opposed roll; Darkness −1.",
    ego_breaker: "Reduce enemy leader’s OP cap by 3 permanently.",
    reality_hack: "Re-run last round as if it never occurred.",
    unity_surge: "All allies gain +2 to every OP next round.",
    qliphothic_gambit: "+6 to Violence roll; Darkness +2.",

    // Strategic Activities
    harvest_season: "+1 Economy regen next turn.",
    recon_sweep: "Reveal alignment of 1 adjacent Hex.",
    ration_distribution: "+1 Loyalty to one controlled Hex.",
    minor_repair: "Remove 'Damaged Infrastructure.'",
    local_festival: "+1 Empathy Meter.",
    smuggling_network: "Establish 1 Trade Route (+1 Diplomacy regen).",
    training_drills: "Increase Violence cap +1 for 2 turns.",
    reconstruction_drive: "Upgrade Hex status to 'Claimed'.",
    cultural_exchange: "Share Alignment bonus between Hexes.",
    spy_insertion: "Reveal enemy OP pools next turn.",
    terraforming_project: "Cleanse 1 Corrupted Hex.",
    alliance_summit: "Merge resources for 1 Strategic Turn.",
    industrial_revolution: "Double Economy output for 2 turns.",
    psych_ops_broadcast: "-2 Loyalty to enemy Hex.",
    purification_rite: "Reduce Darkness Track −2.",
    great_work_ritual: "Trigger Tikkun Phase C for one Spark.",
    mass_mobilization: "+25% OP generation next turn, then −25%.",
    enlightenment_congress: "Raise Enlightenment for all PCs by 1.",
    project_eden: "Create 'Garden City' Hex aligned to Tiferet.",
    apocalyptic_weapon_test: "Destroy enemy Hex; Darkness +3."
  };

  function _resolve(kind, key){
    const EFFECTS = _getEffects();
    const eff = (EFFECTS && EFFECTS[key]) ? EFFECTS[key] : null;

    const label = (eff && eff.label) ? String(eff.label) : _prettyKey(key);
    const tier = (eff && (eff.tier != null)) ? eff.tier : (eff && eff.meta && eff.meta.tier != null ? eff.meta.tier : null);
    const rarity = (eff && eff.rarity) ? String(eff.rarity) : null;
    const minFactionTier = (eff && eff.minFactionTier != null) ? eff.minFactionTier : (eff && eff.meta && eff.meta.minFactionTier != null ? eff.meta.minFactionTier : null);
    const storyOnly = !!(eff && eff.storyOnly);

    // Text fields (support common shapes)
    let text = "";
    if (eff) {
      if (typeof eff.text === "string" && eff.text.trim()) text = eff.text.trim();
      else if (eff.effects && typeof eff.effects.text === "string" && eff.effects.text.trim()) text = eff.effects.text.trim();
      else if (eff.effects && typeof eff.effects.description === "string" && eff.effects.description.trim()) text = eff.effects.description.trim();
      else if (eff.effectText && String(eff.effectText||"").trim()) text = String(eff.effectText).trim();
      else if (eff.desc && String(eff.desc||"").trim()) text = String(eff.desc).trim();
      else if (eff.description && String(eff.description||"").trim()) text = String(eff.description).trim();
    }
    if (!text) text = FALLBACK_TEXT[_lc(key)] || "";

    // Costs
    const cost = (eff && (eff.opCosts || eff.cost)) ? (eff.opCosts || eff.cost) : {};
    const costStr = _costLine(cost);

    // Maneuver metadata
    const raidTypes = (eff && eff.raidTypes) ? eff.raidTypes : null;
    const defenderAccess = (eff && eff.defenderAccess != null) ? String(eff.defenderAccess) : null;

    return {
      kind: String(kind||""),
      key: String(key||""),
      label,
      text,
      costStr,
      tier,
      rarity,
      minFactionTier,
      storyOnly,
      raidTypes,
      defenderAccess
    };
  }

  function _buildHtml(model){
    const lines = [];

    if (model.text) lines.push('<div class="bbttcc-tip-text">' + _escapeHtml(model.text) + '</div>');
    if (model.costStr) lines.push('<div class="bbttcc-tip-line"><b>Cost:</b> ' + _escapeHtml(model.costStr) + '</div>');

    const metaParts = [];
    if (model.minFactionTier != null) metaParts.push("Faction Tier T" + String(model.minFactionTier));
    if (model.tier != null) metaParts.push("T" + String(model.tier));
    if (model.rarity) metaParts.push(model.rarity);
    if (model.storyOnly) metaParts.push("Story");
    if (metaParts.length) lines.push('<div class="bbttcc-tip-line"><b>Meta:</b> ' + _escapeHtml(metaParts.join(" • ")) + '</div>');

    if (model.kind === "maneuver") {
      if (model.raidTypes) {
        const rt = Array.isArray(model.raidTypes) ? model.raidTypes.join(", ") : String(model.raidTypes);
        if (rt) lines.push('<div class="bbttcc-tip-line"><b>Raid Types:</b> ' + _escapeHtml(rt) + '</div>');
      }
      if (model.defenderAccess) lines.push('<div class="bbttcc-tip-line"><b>Defender:</b> ' + _escapeHtml(model.defenderAccess) + '</div>');
    }

    return (
      '<div class="bbttcc-tip-title">' + _escapeHtml(model.label) + '</div>' +
      lines.join("")
    );
  }

  function _ensureCss(){
    try {
      if (document.getElementById("bbttcc-tooltip-style")) return;
      const style = document.createElement("style");
      style.id = "bbttcc-tooltip-style";
      style.textContent = `
        .bbttcc-tip-icon{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width:16px;
          height:16px;
          margin-left:6px;
          border-radius:999px;
          border:1px solid rgba(148,163,184,0.35);
          background: rgba(15,23,42,0.55);
          color: rgba(226,232,240,0.9);
          font-size:11px;
          line-height:1;
          cursor: help;
          user-select:none;
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
          text-transform: none;
        }
        .bbttcc-tooltip .bbttcc-tip-text{
          opacity: 0.95;
          margin-bottom: 6px;
        }
        .bbttcc-tooltip .bbttcc-tip-line{
          opacity: 0.9;
          margin-top: 4px;
        }
      `;
      document.head.appendChild(style);
    } catch(e){}
  }

  function TooltipManager(){
    this._tipEl = null;
    this._bound = false;
    this._lastModelKey = "";
    this._lastIcon = null;
  }

  TooltipManager.prototype._hide = function(){
    try { if (this._tipEl && this._tipEl.parentNode) this._tipEl.parentNode.removeChild(this._tipEl); } catch(e){}
    this._tipEl = null;
    this._lastModelKey = "";
    this._lastIcon = null;
  };

  TooltipManager.prototype._show = function(model, x, y){
    _ensureCss();
    const key = model.kind + ":" + model.key;
    if (!this._tipEl || this._lastModelKey !== key){
      this._hide();
      const el = document.createElement("div");
      el.className = "bbttcc-tooltip";
      el.innerHTML = _buildHtml(model);
      document.body.appendChild(el);
      this._tipEl = el;
      this._lastModelKey = key;
    }

    const pad = 14;
    const rect = this._tipEl.getBoundingClientRect();
    let left = (Number(x||0) + pad);
    let top  = (Number(y||0) + pad);

    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;

    if (left + rect.width + 10 > vw) left = Math.max(10, Number(x||0) - rect.width - pad);
    if (top + rect.height + 10 > vh) top = Math.max(10, Number(y||0) - rect.height - pad);

    this._tipEl.style.left = left + "px";
    this._tipEl.style.top  = top  + "px";
  };

  TooltipManager.prototype.bind = function(_root){
    // Always bind globally exactly once.
    if (this._bound) return;
    this._bound = true;

    const self = this;

    const findIcon = function(ev){
      const t = ev && ev.target ? ev.target : null;
      if (!t) return null;
      return (t.closest && t.closest(".bbttcc-tip-icon")) ? t.closest(".bbttcc-tip-icon") : null;
    };

    const onOver = function(ev){
      const icon = findIcon(ev);
      if (!icon) return;
      const kind = icon.getAttribute("data-tip-kind") || "";
      const key  = icon.getAttribute("data-tip-key") || "";
      if (!kind || !key) return;
      self._lastIcon = icon;
      const model = _resolve(kind, key);
      self._show(model, ev.clientX || 0, ev.clientY || 0);
    };

    const onMove = function(ev){
      // Only track while we're over an icon (avoid doing work on all mousemove)
      const icon = findIcon(ev);
      if (!icon) return;
      const kind = icon.getAttribute("data-tip-kind") || "";
      const key  = icon.getAttribute("data-tip-key") || "";
      if (!kind || !key) return;
      const model = _resolve(kind, key);
      self._show(model, ev.clientX || 0, ev.clientY || 0);
    };

    const onOut = function(ev){
      const icon = findIcon(ev);
      if (!icon) return;
      // If pointer leaves the icon, hide.
      self._hide();
    };

    const onClick = function(ev){
      const icon = findIcon(ev);
      if (!icon) return;
      ev.preventDefault();
      ev.stopPropagation();
      const kind = icon.getAttribute("data-tip-kind") || "";
      const key  = icon.getAttribute("data-tip-key") || "";
      if (!kind || !key) return;
      const model = _resolve(kind, key);
      const k = kind + ":" + key;
      if (self._tipEl && self._lastModelKey === k) { self._hide(); return; }
      self._show(model, ev.clientX || 0, ev.clientY || 0);
      setTimeout(function(){ self._hide(); }, 4500);
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerout",  onOut,  true);
    document.addEventListener("click", onClick, true);

    // Hide on ESC
    window.addEventListener("keydown", function(ev){
      if (ev && ev.key === "Escape") self._hide();
    }, true);

    // Hide on any scroll/wheel (prevents stuck tooltips in scroll panes)
    window.addEventListener("wheel", function(){ self._hide(); }, { capture:true, passive:true });

    logT("TooltipManager bound (global)");
  };

  globalThis.BBTTCC_TooltipManager = new TooltipManager();
  try { globalThis.BBTTCC_TooltipManager.bind(document); } catch(e){}
})();
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

function bbttccGetFactionActor(factionIdOrName){
  if (!factionIdOrName) return null;
  // prefer ID lookup
  let a = game.actors?.get(factionIdOrName) ?? null;
  if (a) return a;
  // fallback name lookup
  a = game.actors?.getName?.(factionIdOrName) ?? null;
  return a;
}

function bbttccGetFactionTier(factionActor){
  // Canonical: flags.bbttcc-factions.tier (integer >= 1). Anything else is ignored for determinism.
  const t = factionActor?.getFlag?.("bbttcc-factions", "tier");
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function bbttccGetUnlockedActivitiesSet(factionActor){
  // Where we'll store learned/purchased activities (future-proof)
  const raw =
    factionActor?.getFlag?.("bbttcc-factions", "unlockedActivities") ??
    factionActor?.getFlag?.("bbttcc-factions", "learnedActivities") ??
    factionActor?.getFlag?.("bbttcc-raid", "unlockedActivities") ??
    [];
  const list = Array.isArray(raw) ? raw : [];
  return new Set(list.map(x => String(x).toLowerCase()));
}

function bbttccGetFactionUnlocks(factionActor){
  try {
    const raw = factionActor?.getFlag?.("bbttcc-factions", "unlocks") ?? factionActor?.flags?.["bbttcc-factions"]?.unlocks ?? null;
    return (raw && typeof raw === "object") ? raw : { maneuvers:{}, strategics:{} };
  } catch (e) {
    return { maneuvers:{}, strategics:{} };
  }
}

function bbttccFactionHasStrategicUnlock(factionActor, unlockKey){
  const k = String(unlockKey || "").toLowerCase().trim();
  if (!k) return false;
  try {
    const u = bbttccGetFactionUnlocks(factionActor);
    const row = (u && u.strategics) ? (u.strategics[k] || u.strategics[String(unlockKey||"")]) : null;
    if (row && typeof row === "object" && row.unlocked === true) return true;
  } catch (e) {}

  // Fallback: some builds used a flat list
  try {
    const raw =
      factionActor?.getFlag?.("bbttcc-factions", "unlockedStrategics") ??
      factionActor?.getFlag?.("bbttcc-factions", "unlockedActivities") ??
      [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map(x => String(x).toLowerCase()).includes(k);
  } catch (e) {
    return false;
  }
}


function bbttccNormalizeOptionKey(key){
  // Unify legacy dash-case, snake_case, and spaced keys into canonical snake_case.
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_");
}

  // Treat option-driven strategics as "not standard" and never show them unless entitled by roster.
  function bbttccIsOptionStrategic(a){
    const key = String(a?.key || "").toLowerCase();
    const label = String(a?.label || "");
    return (
      key.startsWith("optact_") ||
      a?.source === "character-option" ||
      a?.band === "option" ||
      !!a?.optionKey ||
      /\[option\]/i.test(label)
    );
  }


function bbttccGetFactionRosterCharacters(factionActor){
  const factionId = factionActor?.id || "";
  if (!factionId) return [];
  const actors = game.actors?.contents ?? [];
  return actors.filter(a =>
    a?.type === "character" &&
    a?.flags?.["bbttcc-factions"]?.factionId === factionId
  );
}

function bbttccGetFactionOptionCountsFromRoster(factionActor){
  const roster = bbttccGetFactionRosterCharacters(factionActor);
  const counts = {};
  for (const c of roster) {
    const ident = c?.flags?.["bbttcc-character-options"]?.identity || {};
    for (const node of Object.values(ident)) {
      const ok = node?.optionKey;
      if (!ok) continue;
      const norm = bbttccNormalizeOptionKey(ok);
      if (!norm) continue;
      counts[norm] = (counts[norm] || 0) + 1;
    }
  }
  return counts;
}



function bbttccGetActivityRequiredTier(a){
  // Canonical (new): minFactionTier
  // Legacy: tier
  // Legacy fallback: groupOrder (Step N) ONLY when explicitly enabled.
  // Missing/invalid => 1.

  // Treat option-driven strategics as *not tier-gated* by default.
  // Their entitlement comes from roster composition.
  if (bbttccIsOptionStrategic(a)) return 1;

  const rawMin = a?.minFactionTier;
  const nMin = Number(rawMin);
  if (Number.isFinite(nMin) && nMin > 0) return Math.floor(nMin);

  const rawTier = a?.tier;
  const n = Number(rawTier);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);

  // Only use groupOrder as a tier if we *explicitly* opted into that legacy behavior.
  if (a?.legacyTierFromGroupOrder === true) {
    const fallback = Number(a?.groupOrder);
    if (Number.isFinite(fallback) && fallback > 0) return Math.floor(fallback);
  }

  // Accept common string forms like "T2" or "Tier 2" only as a last-resort.
  const s = rawTier == null ? "" : String(rawTier).trim();
  const m = s.match(/(\d+)/);
  const n2 = Number(m ? m[1] : NaN);
  return Number.isFinite(n2) && n2 > 0 ? Math.floor(n2) : 1;
}

function bbttccIsStandardActivity(a, factionTier){
  // Alpha rule-of-thumb (Round 2 / EASY MODE):
  // - Activities are available if their tier <= factionTier.
  // - Unlocked/learned activities still bypass this elsewhere.
  const tier = bbttccGetActivityRequiredTier(a);
  return tier <= factionTier;
}



function bbttccIsLockedActivity(a, factionTier, unlockedSet) {
  const keyLower = String(a?.key || "").toLowerCase();
  const isUnlocked = unlockedSet?.has?.(keyLower);
  // Option strategics are roster-entitled; we don't tier-lock them here.
  if (bbttccIsOptionStrategic(a)) return false;
  const tierReq = bbttccGetActivityRequiredTier(a);
  if (isUnlocked) return false;
  return tierReq > Number(factionTier || 1);
}


function listSceneHexes(){
  const out=[]; const sc=canvas?.scene; if(!sc) return out;

  // Helper to compute a center point + size for adjacency heuristics
  const pushDoc = (doc, f, source) => {
    const x = Number(doc?.x ?? 0);
    const y = Number(doc?.y ?? 0);
    const w = Number(doc?.width  ?? doc?.w ?? 0);
    const h = Number(doc?.height ?? doc?.h ?? 0);
    const cx = x + (w ? w/2 : 0);
    const cy = y + (h ? h/2 : 0);
    out.push({
      uuid: doc.uuid,
      id: doc.id,
      name: f?.name || doc.text || doc.id || "Hex",
      ownerId: f?.factionId || f?.ownerId || "",
      source,
      x,y,w,h,cx,cy
    });
  };

  for(const d of sc.drawings?.contents??[]){
    if(!detectHexLike(d)) continue;
    const f = {
      factionId: d.getFlag?.(TERR_ID, "factionId") || d.getFlag?.(TERR_ID, "ownerId") || "",
      name: d.getFlag?.(TERR_ID, "label") || d.getFlag?.(TERR_ID, "name") || ""
    };
    pushDoc(d, f, "drawing");
  }
  for(const t of sc.tiles?.contents??[]){
    if(!detectHexLike(t)) continue;
    const f = {
      factionId: t.getFlag?.(TERR_ID, "factionId") || t.getFlag?.(TERR_ID, "ownerId") || "",
      name: t.getFlag?.(TERR_ID, "label") || t.getFlag?.(TERR_ID, "name") || ""
    };
    pushDoc(t, f, "tile");
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}

// Target filtering (Issue 2):
// - Default: show only hexes controlled by faction + adjacent neighbors.
// - If leylines remote adjacency resolver exists, include those too.
// - GM can bypass via "Show Locked" toggle (debug / authoring).
function bbttccFilterHexTargets(allHexes, factionId){
  const fid = String(factionId||"").trim();
  if (!fid) return [];

  const byUuid = new Map(allHexes.map(h => [h.uuid, h]));

  // Owner matching must be resilient: older worlds sometimes store owner as actor name,
  // actor UUID ("Actor.<id>"), or legacy id strings. We normalize and compare against
  // the opener faction id + resolved actor fields.
  const fac = bbttccGetFactionActor(fid);
  const ownerMatchers = new Set(
    [fid, fac?.id, fac?.uuid, fac?.name].filter(Boolean).map(x => String(x).trim())
  );

  const normOwner = (v) => {
    const s = String(v || "").trim();
    if (!s) return "";
    // UUID-like: Actor.<id>
    if (s.startsWith("Actor.")) return s.slice(6);
    // UUID-like: Compendium/Scene/etc shouldn't happen, but keep stable
    return s;
  };

  const owned = allHexes.filter(h => {
    const raw = String(h.ownerId || "").trim();
    if (!raw) return false;
    const n = normOwner(raw);
    // direct matches (id / uuid / name)
    if (ownerMatchers.has(raw) || ownerMatchers.has(n)) return true;
    // if raw is an id but we matched against Actor.<id> style
    if (ownerMatchers.has("Actor." + raw)) return true;
    return false;
  });

  const ownedUuids = new Set(owned.map(h => h.uuid));

  // -----------------------------------------------------------------------
  // Canonical-ish adjacency for BBTTCC hex drawings/tiles:
  // We derive neighbor edges from the scene itself by measuring center-to-center
  // distances and treating the "nearest ring" as adjacent.
  //
  // This matches how your map is laid out (drawn hexes), without relying on
  // any GM-entered axial coords or perfect pixel sizes.
  // -----------------------------------------------------------------------
  const allowed = new Set(ownedUuids);

  // Compute an adjacency threshold:
  // - Find the minimum non-zero center distance across the whole scene (dMin).
  // - Neighbors are any hex within dMin * 1.25 of the source hex.
  //   (tolerates minor drift / imperfect placement)
  const centers = allHexes
    .map(h => ({ uuid: h.uuid, cx: Number(h.cx||0), cy: Number(h.cy||0) }))
    .filter(c => Number.isFinite(c.cx) && Number.isFinite(c.cy));

  let dMin = Infinity;
  for (let i = 0; i < centers.length; i++) {
    const a = centers[i];
    for (let j = i+1; j < centers.length; j++) {
      const b = centers[j];
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < dMin) dMin = d;
    }
  }
  if (!Number.isFinite(dMin) || dMin <= 0) dMin = 0;

  const threshold = dMin ? (dMin * 1.25) : 0;

  function neighborsOf(hex) {
    if (!threshold) return [];
    const out = [];
    const cx = Number(hex.cx||0), cy = Number(hex.cy||0);
    for (const other of allHexes) {
      if (other.uuid === hex.uuid) continue;
      const dx = (Number(other.cx||0) - cx);
      const dy = (Number(other.cy||0) - cy);
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= threshold) out.push(other);
    }
    return out;
  }

  // Include adjacent neighbors of ALL owned hexes
  if (threshold && owned.length) {
    for (const h of owned) {
      for (const n of neighborsOf(h)) {
        allowed.add(n.uuid);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Leylines remote adjacency (Ley Gates) — canonical resolver
  // Shape matches Travel Console + hex-travel core:
  //   resolveRemoteAdjacency({ hexUuid, factionId }) -> { ok, links:[{toUuid,...}] }
  // -----------------------------------------------------------------------
  try {
    const remote = game?.bbttcc?.api?.territory?.leylines?.resolveRemoteAdjacency;
    if (typeof remote === "function") {
      for (const u of ownedUuids) {
        const res = remote({ hexUuid: u, factionId: fid });
        // Support both sync and async resolvers (some worlds attach sync wrappers)
        // by awaiting only if it looks like a Promise.
        const handle = (r) => {
          if (!r?.ok || !Array.isArray(r.links)) return;
          for (const l of r.links) {
            const to = String(l?.toUuid || "").trim();
            if (to) allowed.add(to);
          }
        };
        if (res && typeof res.then === "function") {
          res.then(handle).catch(()=>{});
        } else {
          handle(res);
        }
      }
    }
  } catch(e){}

  const filtered = [];
  for (const u of allowed) {
    const h = byUuid.get(u);
    if (h) filtered.push(h);
  }
  return filtered.sort((a,b)=>a.name.localeCompare(b.name));
}



// RIG helpers (planner-side)
function listFactionRigs(factionActor){
  if (!factionActor) return [];
  const rigs = factionActor.getFlag?.(FCT_ID,"rigs") ?? factionActor?.flags?.[FCT_ID]?.rigs;
  return Array.isArray(rigs) ? rigs : [];
}
function rigLabel(r){
  const name = r?.name || r?.label || r?.rigId || "Rig";
  const st   = r?.damageState || (Number(r?.damageStep||0) ? `step ${r.damageStep}` : "intact");
  const hp   = r?.hitTrack ? `${r.hitTrack.current ?? "?"}/${r.hitTrack.max ?? "?"}` : "";
  return `${name} (${st}${hp?`, ${hp}`:""})`;
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
    violence:   "\u2694",          // 
    nonLethal:  "\uD83D\uDEE1",    // 
    intrigue:   "\uD83D\uDD75",    // 
    economy:    "\uD83D\uDCB0",    // 
    softPower:  "\uD83C\uDFAD",    // 
    diplomacy:  "\uD83E\uDD1D",    // 
    faith:      "\u2600",          // 
    logistics:  "\uD83D\uDCE6",    // 
    culture:    "\uD83C\uDFA8"     // 
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
    return parts.join("   ");
  }

  const isRigActivity = (activityKey) => String(activityKey||"").toLowerCase() === "repair_rig";


function inferPackageGroup(activityOrKey){
  // 1) If activity carries explicit group metadata, honor it.
  const a = (activityOrKey && typeof activityOrKey === "object") ? activityOrKey : null;
  const key = a ? (a.key ?? "") : (activityOrKey ?? "");
  const k = String(key).toLowerCase();

  if (a && a.groupKey) {
    return {
      groupKey: String(a.groupKey),
      groupLabel: a.groupLabel ? String(a.groupLabel) : prettifyKey(String(a.groupKey)),
      groupOrder: (a.groupOrder ?? null)
    };
  }

  // 2) Deterministic overrides by activity key (B.1)
  // Add keys here as we formalize packages; this avoids "string contains" drift.
  const OVERRIDE = {
    // Hold & Defend
    "fortify_hex": { groupKey:"hold_defend", groupLabel:"Hold & Defend", groupOrder: 1 },
    "border_patrol": { groupKey:"hold_defend", groupLabel:"Hold & Defend", groupOrder: 2 },
    "patrol_routes": { groupKey:"hold_defend", groupLabel:"Hold & Defend", groupOrder: 3 },

    // Wilderness Development
    "claim_hex": { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: 1 },
    "establish_outpost": { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: 2 },
    "develop_outpost": { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: 3 },
    "develop_outpost_stability": { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: 3 },
    "upgrade_outpost_settlement": { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: 4 },
    "upgrade_outpost": { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: 4 },
    "found_farm": { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: 5 }
  };

  const hit = OVERRIDE[k];
  if (hit) return { ...hit };

  // 3) Fallback inference (keeps legacy behavior; can be trimmed over time)
  // Wilderness Development package
  if (k.includes("claim") || k.includes("outpost") || k.includes("settlement") || k.includes("integrat")) {
    let order = 99;
    if (k.includes("claim")) order = 1;
    else if (k.includes("establish_outpost")) order = 2;
    else if (k.includes("develop_outpost") || k.includes("stability")) order = 3;
    else if (k.includes("upgrade_outpost") || (k.includes("upgrade") && k.includes("outpost"))) order = 4;
    else if (k.includes("found_farm") || k.includes("farm")) order = 5;
    else if (k.includes("integrat")) order = 6;
    return { groupKey:"wilderness_dev", groupLabel:"Wilderness Development", groupOrder: order };
  }

  // Hold & Defend package
  if (k.includes("fortify") || k.includes("garrison") || k.includes("patrol")) {
    let order = 99;
    if (k.includes("fortify")) order = 1;
    else if (k.includes("patrol")) order = 2;
    else if (k.includes("garrison")) order = 3;
    return { groupKey:"hold_defend", groupLabel:"Hold & Defend", groupOrder: order };
  }

  return { groupKey:null, groupLabel:null, groupOrder:null };
}



  class ActivityPlanner extends App2 {
    static get defaultOptions(){
      return {
        id: "bbttcc-activity-planner",
        title: "Activity Planner",
        // AppV2 window config (Foundry v13+)
        window: { resizable: true, minimizable: true },
        position: { width: 640, height: 560 },
        width: 640,
        height: 560,
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
        selectedKey: "",
        // NEW: rig targeting
        rigFactionId: "",
        rigId: "",
        // Collapse state for nested packages
        groupCollapsed: {},
        // STEP 4: GM-only toggle to reveal locked-by-tier activities
        showLocked: false
      };

// If opened from a Faction sheet, we can preselect + lock the faction context.
// Preferred shape: new ActivityPlannerApp({ bbttcc: { factionId, lockFaction } })
const bbttcc = options?.bbttcc ?? {};
this._lockedFactionId = (bbttcc.lockFaction && bbttcc.factionId)
  ? String(bbttcc.factionId).trim()
  : null;

// Backwards compat: accept top-level factionId/lockFaction too.
this._lockFaction = !!(bbttcc.lockFaction || options.lockFaction);

const _fid = (this._lockedFactionId || String(options.factionId || options.attackerId || "")).trim();
if (_fid) {
  // Prefer factionId; keep attackerId for backwards compat.
  this._plannerState.factionId = _fid;
  this._plannerState.attackerId = _fid;
}
      // If the planner is opened in locked-faction mode, keep player-safe behavior,
      // but allow GMs to re-enable full visibility with the Show Locked toggle.
      if (this._lockedFactionId && !game.user.isGM) {
        this._plannerState.showLocked = false;
      }
      this._dragInstalled = false;
    }

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
        if (isInteractive(ev.target)) return;
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
          const opCosts = v.opCosts || v.cost || {};

          if (!primary && opCosts && typeof opCosts === "object") {
            let bestKey = null;
            let bestVal = -Infinity;
            for (const k of Object.keys(opCosts)) {
              const val = Number(opCosts[k] || 0);
              if (val > bestVal) { bestVal = val; bestKey = k; }
            }
            primary = bestKey || "misc";
          }

          if (!primary) primary = "misc";

          // Preserve legacy behavior: if a non-option activity lacks an explicit tier,
          // we may allow using groupOrder as a legacy stand-in *only when opted in*.
          const inferredIsOption = (v.source === "character-option") || (v.band === "option") || String(key).toLowerCase().startsWith("optact_");
          const legacyTierFromGroupOrder = !inferredIsOption && (v.tier == null) && (v.groupOrder != null);

          arr.push({
            key,
            label,
            primaryKey: primary,
            tier: v.tier ?? null,
            // NEW: explicit faction-tier gate (preferred over tier)
            minFactionTier: v.minFactionTier ?? v.minTier ?? null,
            rarity: v.rarity ?? null,
            source: v.source ?? null,
            band: v.band ?? null,
            optionKey: v.optionKey ?? null,
            unlockKey: v.unlockKey ?? (v.meta ? v.meta.unlockKey : null) ?? null,
            groupKey: v.groupKey ?? v.packageKey ?? null,
            groupLabel: v.groupLabel ?? v.packageLabel ?? null,
            groupOrder: v.groupOrder ?? v.packageOrder ?? null,
            legacyTierFromGroupOrder,
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

      return [
        { key:"develop_infrastructure", label:"Develop Infrastructure", primaryKey:"economy", opCosts:{}, tier:null, rarity:null, text:"" },
        { key:"expand_territory",      label:"Expand Territory",      primaryKey:"violence", opCosts:{}, tier:null, rarity:null, text:"" }
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

      // --- HexChrome skin (planner) ---
      (() => {
        wrap.classList.add("bbttcc-hexchrome-planner");

        // Prevent duplicate injection on re-render
        if (wrap.querySelector("style[data-bbttcc-hexchrome='planner']")) return;

        const style = document.createElement("style");
        style.dataset.bbttccHexchrome = "planner";
        style.textContent = `
          .bbttcc-hexchrome-planner {
            font-family: Helvetica, Arial, sans-serif;
            color: #e5e7eb;
          }

          .bbttcc-hexchrome-planner input,
          .bbttcc-hexchrome-planner select,
          .bbttcc-hexchrome-planner textarea {
            background: rgba(15,23,42,0.92);
            color: #e5e7eb;
            border: 1px solid rgba(55,65,81,0.95);
            border-radius: 10px;
          }

          .bbttcc-hexchrome-planner input:focus,
          .bbttcc-hexchrome-planner select:focus,
          .bbttcc-hexchrome-planner textarea:focus {
            border-color: rgba(59,130,246,0.9);
            box-shadow: 0 0 0 1px rgba(59,130,246,0.7);
            outline: none;
          }

          .bbttcc-hexchrome-planner .bbttcc-activity-group {
            background: linear-gradient(90deg, rgba(15,23,42,0.96), rgba(30,64,175,0.45));
            border: 1px solid rgba(59,130,246,0.35);
            border-radius: 10px;
            padding: 6px 10px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .bbttcc-hexchrome-planner .bbttcc-activity-row {
            background: rgba(0,0,0,0.15);
            border-radius: 10px;
            padding: 6px 8px;
          }

          .bbttcc-hexchrome-planner .bbttcc-activity-row[data-selected="true"] {
            background: rgba(29,78,216,0.35);
            border: 1px solid rgba(59,130,246,0.9);
          }
        `;

        wrap.prepend(style);
      })();

      wrap.classList.add("bbttcc-activity-planner");
      wrap.style.padding = "10px 12px";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.height = "100%";
      wrap.style.boxSizing = "border-box";

      const facs  = factionList();
      const hexesAll = listSceneHexes();

      // Ensure we always have a factionId in state for deterministic target filtering.
      if (this._lockedFactionId) this._plannerState.factionId = this._lockedFactionId;
      else if (!this._plannerState.factionId && facs[0]?.id) this._plannerState.factionId = facs[0].id;

      // Issue 2: filter targets by faction control + adjacency (GM can bypass via Show Locked).
      const bypassTargets = (game?.user?.isGM && this._plannerState.showLocked);
      const hexes = bypassTargets
        ? hexesAll
        : bbttccFilterHexTargets(hexesAll, this._plannerState.factionId);


      // Determine faction + access
      // IMPORTANT: gating must follow the currently-selected faction.
      // This app historically used _plannerState.factionId, but the <select>
      // value was not being synced back into state on change, causing the
      // activity list to be filtered using a stale faction (often the first
      // faction in the world) even while the UI showed a different selection.
      // Keep attackerId for backwards compat, but prefer factionId.
      const factionId = this._plannerState.factionId || this._plannerState.attackerId || "";
      const factionActor = bbttccGetFactionActor(factionId);
      const factionTier = bbttccGetFactionTier(factionActor);
      const unlocked = bbttccGetUnlockedActivitiesSet(factionActor);
      const optionCounts = bbttccGetFactionOptionCountsFromRoster(factionActor);
      const actsAll = this._buildStrategicList();

// ------------------------------------------------------------
// DOCTRINE GATING (Faction-owned strategics only)
// ------------------------------------------------------------
const doctrineApi = game.bbttcc?.api?.factions?.doctrine;
const ownedStrategicKeys = doctrineApi
  ? doctrineApi.ownedKeys(factionActor, "strategic")
  : new Set();

// Baseline: if a faction has NO doctrine items yet,
// treat everything as available (backward compatibility safety)
const hasDoctrineItems = doctrineApi
  ? doctrineApi.list(factionActor, "strategic").length > 0
  : false;


      // Ensure we always have a factionId in state for deterministic filtering.
      if (!this._plannerState.factionId && facs[0]?.id) {
        this._plannerState.factionId = facs[0].id;
      }

      // Apply gating
const acts = actsAll.filter(a => {
  const key = String(a.key || "").toLowerCase();
  if (!key) return false;

  // If doctrine system is active and faction has doctrine items,
  // only allow activities the faction actually owns.
  const gmShowAll = !!(game?.user?.isGM && this._plannerState.showLocked);

  if (hasDoctrineItems && !gmShowAll) {
    if (!ownedStrategicKeys.has(key)) return false;
  }
        // Always show unlocked/learned activities
        if (unlocked.has(key)) return true;



        // Narrative unlock gate (Echo Archive / quest rewards)
        // If an activity declares unlockKey, it is hidden until the faction unlocks it.
        const unlockKey = a?.unlockKey ?? (a?.meta ? a.meta.unlockKey : null) ?? null;
        if (unlockKey) {
          if (bbttccFactionHasStrategicUnlock(factionActor, unlockKey)) return true;
          // Do not leak locked narrative unlocks.
          return false;
        }
        // Option-driven strategics: roster entitlement (auto-available)
        if (a?.source === "character-option" || a?.band === "option" || key.startsWith("optact_")) {
          const ok = bbttccNormalizeOptionKey(a?.optionKey);
          if (ok && optionCounts[ok] > 0) return true;
        }

        // Show standard activities for this tier (option strategics are NEVER standard)
        if (!bbttccIsOptionStrategic(a) && bbttccIsStandardActivity(a, factionTier)) return true;

        // STEP 4: GM-only reveal of locked activities (but not unentitled option strategics)
        if (!bbttccIsOptionStrategic(a) && game?.user?.isGM && this._plannerState.showLocked) return true;

        return false;
      });
const categories = this._buildCategories(acts);
      const currentCat = this._plannerState.category || "all";
      const searchTerm = (this._plannerState.search || "").toLowerCase().trim();
      const filtered = acts.filter(a => {
        if (currentCat !== "all" && String(a.primaryKey) !== currentCat) return false;
        if (searchTerm) {
          const hay = `${a.label} ${a.key}`.toLowerCase();
          if (!hay.includes(searchTerm)) return false;
        }
        return true;
      });




      
      // STEP 5.1: telemetry counts for transparency (global totals + filtered view)
      const counts = (() => {
        let total = 0, unlockedCount = 0, standardCount = 0, lockedCount = 0;

        // Global totals: actsAll is already the strategic list, so do NOT require a.kind to exist.
        for (const a of actsAll) {
          const key = String(a?.key || "").toLowerCase();
          if (!key) continue;

          total++;
          const isUnlocked = unlocked.has(key);
          const isStandard = bbttccIsStandardActivity(a, factionTier);
          const isLocked = bbttccIsLockedActivity(a, factionTier, unlocked);

          if (isUnlocked) unlockedCount++;
          else if (isStandard) standardCount++;
          else if (isLocked) lockedCount++;
        }

        const available = standardCount + unlockedCount;
        const showLocked = !!(game?.user?.isGM && this._plannerState.showLocked);
        const visible = showLocked ? (available + lockedCount) : available;

        // Filtered view count (current UI scope after category/search)
        const filteredVisible = (filtered?.length ?? 0);

        return { total, available, visible, locked: lockedCount, unlocked: unlockedCount, standard: standardCount, filteredVisible };
      })();
      const selectedKey = this._plannerState.selectedKey || filtered[0]?.key || "";
      const wantsRigTarget = isRigActivity(selectedKey);

      // --- Top: Faction + Target (Hex OR Rig) ---
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

      // Sync selection to state so gating uses the same faction the user sees.
      // Default: if no state value, pick the first faction.
      if (!this._plannerState.factionId && facs[0]?.id) this._plannerState.factionId = facs[0].id;
      facSel.value = this._plannerState.factionId || facSel.value;
      facSel.addEventListener("change", () => {
        // Hard safety: ignore faction changes if locked (belt + suspenders).
        if (this._lockedFactionId && !game.user.isGM) return;
        if (this._lockFaction && !game.user.isGM) return;

        this._plannerState.factionId = facSel.value;
        // Reset selectedKey when switching factions to avoid hidden selections.
        this._plannerState.selectedKey = "";
        this.render(false);
      });


// If a factionId was provided on open, freeze the selector to that faction (player-safe).
if ((this._lockedFactionId || this._lockFaction) && !game.user.isGM) {
  facSel.disabled = true;
  facSel.title = "Faction context is locked for this window.";
}

      // Target UI container
      const targetWrap = document.createElement("div");
      targetWrap.style.display = "flex";
      targetWrap.style.flexDirection = "column";
      targetWrap.style.gap = "4px";

      // Hex chooser row (existing)
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

      hexRow.appendChild(hexSel);
      hexRow.appendChild(pickBtn);

      // Rig chooser rows (NEW)
      const rigRow1 = document.createElement("div");
      rigRow1.style.display = "flex";
      rigRow1.style.gap = "4px";

      const rigFactionSel = document.createElement("select");
      rigFactionSel.style.flex = "1 1 auto";
      rigFactionSel.style.padding = "2px 4px";

      const rigRow2 = document.createElement("div");
      rigRow2.style.display = "flex";
      rigRow2.style.gap = "4px";

      const rigSel = document.createElement("select");
      rigSel.style.flex = "1 1 auto";
      rigSel.style.padding = "2px 4px";

      // Populate rig faction list
      for (const f of facs) {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = f.name;
        rigFactionSel.appendChild(opt);
      }

      const ensureRigStateDefaults = () => {
        if (!this._plannerState.rigFactionId) this._plannerState.rigFactionId = rigFactionSel.value || "";
        rigFactionSel.value = this._plannerState.rigFactionId || rigFactionSel.value || "";
      };

      const repopulateRigs = () => {
        const facId = rigFactionSel.value || "";
        this._plannerState.rigFactionId = facId;

        while (rigSel.firstChild) rigSel.removeChild(rigSel.firstChild);

        const fac = game.actors.get(facId);
        const rigs = listFactionRigs(fac);

        if (!rigs.length) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "(no rigs)";
          rigSel.appendChild(opt);
          this._plannerState.rigId = "";
          return;
        }

        for (const r of rigs) {
          const opt = document.createElement("option");
          opt.value = r.rigId;
          opt.textContent = rigLabel(r);
          rigSel.appendChild(opt);
        }

        // Keep prior selection if possible
        const desired = this._plannerState.rigId;
        if (desired && rigs.some(r => String(r.rigId) === String(desired))) {
          rigSel.value = desired;
        } else {
          rigSel.value = rigs[0].rigId;
          this._plannerState.rigId = rigs[0].rigId;
        }
      };

      rigFactionSel.addEventListener("change", () => {
        repopulateRigs();
      });

      rigSel.addEventListener("change", () => {
        this._plannerState.rigId = rigSel.value || "";
      });

      rigRow1.appendChild(rigFactionSel);
      rigRow2.appendChild(rigSel);

      const lockedForUser = !!((this._lockedFactionId || this._lockFaction) && !game.user.isGM);

if (!lockedForUser) {
  top.appendChild(mkLabel("Faction"));
  top.appendChild(mkLabel(wantsRigTarget ? "Target Rig" : "Target Hex"));
  top.appendChild(facSel);
} else {
  // Clean UX: hide the faction selector entirely when locked for players.
  top.style.gridTemplateColumns = "1fr";
  top.appendChild(mkLabel(wantsRigTarget ? "Target Rig" : "Target Hex"));
}

// Target area switches based on activity
if (wantsRigTarget) {
  targetWrap.appendChild(rigRow1);
  targetWrap.appendChild(rigRow2);
} else {
  targetWrap.appendChild(hexRow);
}
top.appendChild(targetWrap);

wrap.appendChild(top);

      // --- Middle: Categories + Activities ---
      const mid = document.createElement("div");
      mid.style.display = "grid";
      mid.style.gridTemplateRows = "auto auto 1fr auto";
      mid.style.gap = "4px";
      mid.style.flex = "1 1 auto";
      mid.style.minHeight = "0";

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

      const searchRow = document.createElement("div");
      searchRow.style.display = "flex";
      searchRow.style.gap = "4px";

      const searchInput = document.createElement("input");
      searchInput.type = "text";
      searchInput.value = this._plannerState.search || "";
      searchInput.placeholder = "Search activities";
      searchInput.dataset.role = "search";
      searchInput.style.flex = "1 1 auto";
      searchInput.style.padding = "2px 6px";
      searchInput.style.fontSize = "0.8rem";
      searchRow.appendChild(searchInput);

      // STEP 4: GM-only "Show Locked" toggle (reveals locked-by-tier activities)
      if (game?.user?.isGM) {
        const showLockedWrap = document.createElement("div");
        showLockedWrap.style.display = "flex";
        showLockedWrap.style.alignItems = "center";
        showLockedWrap.style.gap = "8px";
        showLockedWrap.style.margin = "6px 0 0";

        const showLocked = document.createElement("input");
        showLocked.type = "checkbox";
        showLocked.checked = !!this._plannerState.showLocked;

        const showLockedLabel = document.createElement("span");
        showLockedLabel.textContent = "Show Locked (GM)";
        showLockedLabel.style.fontSize = "11px";
        showLockedLabel.style.textTransform = "uppercase";
        showLockedLabel.style.letterSpacing = "0.12em";
        showLockedLabel.style.opacity = "0.9";

        showLocked.addEventListener("change", () => {
          this._plannerState.showLocked = !!showLocked.checked;
          this.render(false);
        });

        showLockedWrap.appendChild(showLocked);
        showLockedWrap.appendChild(showLockedLabel);
        mid.appendChild(showLockedWrap);
      }

      const listBox = document.createElement("div");
      listBox.style.flex = "1 1 auto";
      listBox.style.minHeight = "0";
      listBox.style.maxHeight = "320px";
      listBox.style.overflowY = "auto";
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
        const withPkg = filtered.map(a => ({ a, pkg: inferPackageGroup(a) }));

        withPkg.sort((A, B) => {
          const aPkg = A.pkg.groupKey ? 0 : 1;
          const bPkg = B.pkg.groupKey ? 0 : 1;
          if (aPkg !== bPkg) return aPkg - bPkg;

          if (A.pkg.groupKey && B.pkg.groupKey) {
            if ((A.pkg.groupLabel || "") !== (B.pkg.groupLabel || "")) return (A.pkg.groupLabel || "").localeCompare(B.pkg.groupLabel || "");
            const ao = Number(A.pkg.groupOrder ?? 99);
            const bo = Number(B.pkg.groupOrder ?? 99);
            if (ao !== bo) return ao - bo;
          }

          return (A.a.label || "").localeCompare(B.a.label || "");
        });

        let lastGroupKey = null;

        for (const { a, pkg } of withPkg) {

          if (pkg.groupKey && pkg.groupKey !== lastGroupKey) {
            lastGroupKey = pkg.groupKey;

            const groupKey = pkg.groupKey;
            const collapsed = !!(this._plannerState.groupCollapsed?.[groupKey]);

            const hdr = document.createElement("div");
            hdr.className = "bbttcc-activity-group";
            hdr.dataset.group = groupKey;
            hdr.style.display = "flex";
            hdr.style.alignItems = "center";
            hdr.style.justifyContent = "space-between";
            hdr.style.margin = "6px 0 4px";
            hdr.style.padding = "4px 8px";
            hdr.style.borderRadius = "6px";
            hdr.style.background = "rgba(0,0,0,0.25)";
            hdr.style.fontSize = "0.75rem";
            hdr.style.fontWeight = "700";
            hdr.style.opacity = "0.95";
            hdr.style.cursor = "pointer";
            hdr.title = "Click to collapse/expand";

            const left = document.createElement("span");
            left.textContent = pkg.groupLabel || "Package";

            const right = document.createElement("span");
            right.textContent = collapsed ? ">" : "v";
            right.style.opacity = "0.85";

            hdr.appendChild(left);
            hdr.appendChild(right);

            hdr.addEventListener("click", () => {
              this._plannerState.groupCollapsed ??= {};
              const cur = !!(this._plannerState.groupCollapsed[groupKey]);
              this._plannerState.groupCollapsed[groupKey] = !cur;
              this.render(false);
            });

            listBox.appendChild(hdr);
          }

          const row = document.createElement("div");
          row.className = "bbttcc-activity-row";
          row.dataset.key = a.key;
          row.dataset.act = "select-activity";
          if (pkg.groupKey) row.dataset.group = pkg.groupKey;
          row.style.display = "flex";
          row.style.flexDirection = "column";
          row.style.padding = "3px 4px";
          row.style.marginBottom = "2px";
          row.style.borderRadius = "4px";
          row.style.cursor = "pointer";
          row.style.fontSize = "0.8rem";
          row.title = a.text || "";

          const isSelected = (this._plannerState.selectedKey === a.key) || (!this._plannerState.selectedKey && a.key === selectedKey);
          row.style.background = isSelected ? "#1d4ed8" : "transparent";
          row.style.color      = isSelected ? "#f9fafb" : "#e5e7eb";

          if (pkg.groupKey && this._plannerState.groupCollapsed?.[pkg.groupKey]) {
            row.style.display = "none";
          }

          const topLine = document.createElement("div");
          topLine.style.display = "flex";
          topLine.style.justifyContent = "space-between";
          topLine.style.alignItems = "center";

          const labelSpan = document.createElement("span");
          labelSpan.textContent = a.label;
          labelSpan.style.fontWeight = "600";

          // Tooltip icon (hover/click for details)
          const tipIcon = document.createElement("span");
          tipIcon.className = "bbttcc-tip-icon";
          tipIcon.textContent = "ⓘ";
          tipIcon.setAttribute("data-tip-kind", "strategic");
          tipIcon.setAttribute("data-tip-key", String(a.key || ""));
          tipIcon.title = "Details";


          // STEP 3: learned/bought activities bypass tier gating via flags.bbttcc-factions.unlockedActivities
          // Mark them in the UI when they are above the current faction tier.
          const keyLower = String(a.key || "").toLowerCase();
          const isUnlocked = unlocked?.has?.(keyLower);
          const isStandard = bbttccIsStandardActivity(a, factionTier);
          const isLocked = bbttccIsLockedActivity(a, factionTier, unlocked);
          const tierReq = bbttccGetActivityRequiredTier(a);
          if (isUnlocked && !isStandard) {
            const badge = document.createElement("span");
            badge.textContent = "UNLOCKED";
            badge.style.marginLeft = "8px";
            badge.style.padding = "1px 6px";
            badge.style.borderRadius = "999px";
            badge.style.fontSize = "0.65rem";
            badge.style.fontWeight = "700";
            badge.style.letterSpacing = "0.06em";
            badge.style.background = "rgba(16,185,129,0.22)";
            badge.style.border = "1px solid rgba(16,185,129,0.65)";
            badge.style.color = "#d1fae5";
            labelSpan.appendChild(badge);
          }

          // STEP 4: locked badge when GM toggle reveals locked activities
          if (isLocked && game?.user?.isGM && this._plannerState.showLocked) {
            const badgeL = document.createElement("span");
            badgeL.textContent = `LOCKED T${tierReq}`;
            badgeL.style.marginLeft = "8px";
            badgeL.style.padding = "1px 6px";
            badgeL.style.borderRadius = "999px";
            badgeL.style.fontSize = "0.65rem";
            badgeL.style.fontWeight = "700";
            badgeL.style.letterSpacing = "0.06em";
            badgeL.style.background = "rgba(239,68,68,0.18)";
            badgeL.style.border = "1px solid rgba(239,68,68,0.55)";
            badgeL.style.color = "#fee2e2";
            labelSpan.appendChild(badgeL);
          }

          const metaSpan = document.createElement("span");
          metaSpan.style.fontSize = "0.7rem";
          metaSpan.style.opacity = "0.85";
          const catLabel = a.primaryKey ? (CATEGORY_LABELS[a.primaryKey] || prettifyKey(a.primaryKey)) : null;
          const pieces = [];
          if (catLabel) pieces.push(catLabel);
          if (pkg.groupKey && pkg.groupOrder) pieces.push(`Step ${pkg.groupOrder}`);
          // Display required tier in the UI. Prefer explicit minFactionTier when present,
          // otherwise fall back to legacy tier.
          const displayTier = (a?.minFactionTier != null) ? a.minFactionTier : a.tier;
          if (displayTier != null) pieces.push(`T${displayTier}`);
          if (a.rarity)      pieces.push(String(a.rarity));
          if (isUnlocked && !isStandard) pieces.push("UNLOCKED");
          if (isLocked && game?.user?.isGM && this._plannerState.showLocked) pieces.push(`LOCKED T${tierReq}`);
          metaSpan.textContent = pieces.join(" \u2022 ") || "Unsorted";

          topLine.appendChild(labelSpan);
          topLine.appendChild(tipIcon);
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

      // STEP 5: telemetry footer UI
      const telemetry = document.createElement("div");
      telemetry.className = "bbttcc-planner-telemetry";
      telemetry.style.marginTop = "6px";
      telemetry.style.padding = "6px 8px";
      telemetry.style.borderRadius = "10px";
      telemetry.style.border = "1px solid rgba(148,163,184,0.35)";
      telemetry.style.background = "rgba(15,23,42,0.55)";
      telemetry.style.fontSize = "11px";
      telemetry.style.textTransform = "uppercase";
      telemetry.style.letterSpacing = "0.12em";
      telemetry.style.opacity = "0.92";
      telemetry.textContent = (() => {
        const base = `Tier ${Number(factionTier || 1)} — Available ${counts.available} · Locked ${counts.locked} · Total ${counts.total}`;
        // If current filter is narrower than what's visible globally, append filtered hint
        if (Number.isFinite(counts.filteredVisible) && counts.filteredVisible !== counts.visible) {
          return `${base} (filtered ${counts.filteredVisible})`;
        }
        return base;
      })();
      mid.appendChild(telemetry);
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

      // Ensure rig selects are initialized if needed
      if (wantsRigTarget) {
        ensureRigStateDefaults();
        repopulateRigs();
      }

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
        const btn = ev.target?.closest?.("[data-act]");
        const act = btn?.dataset?.act;
        if (!act) return;

        if (act === "cancel") {
          this.close();
          return;
        }

        if (act === "pick") {
          if (wantsRigTarget) return; // rig targeting doesn't use canvas pick
          if (!canvas?.ready) {
            ui.notifications?.warn?.("Canvas not ready.");
            return;
          }
          picking = !picking;
          if (picking) {
            ui.notifications?.info?.("Click a hex on the canvas");
            pickBtn.classList.add("active");
            canvas.stage.on("pointerdown", onPick);
          } else {
            endPick();
          }
          return;
        }

        if (act === "filter-cat") {
          const cat = btn?.dataset?.cat || "all";
          this._plannerState.category = cat;
          this.render(false);
          return;
        }

        if (act === "select-activity") {
          const rowEl = ev.target.closest(".bbttcc-activity-row");
          const key = rowEl?.dataset?.key;
          if (!key) return;

          // STEP 4: don't allow selecting locked items when revealed
          if (game?.user?.isGM && this._plannerState.showLocked) {
            const actObj = actsAll.find(x => String(x.key) === String(key));
            const locked = bbttccIsLockedActivity(actObj, factionTier, unlocked);
            const tierReq = bbttccGetActivityRequiredTier(actObj);
            if (locked) {
              ui?.notifications?.warn?.(`Locked: requires Tier ${tierReq}.`);
              return;
            }
          }

          this._plannerState.selectedKey = key;

          // If switching into repair_rig, ensure defaults exist next render
          if (isRigActivity(key) && !this._plannerState.rigFactionId) {
            this._plannerState.rigFactionId = facs[0]?.id || "";
            this._plannerState.rigId = "";
          }

          this.render(false);
          return;
        }

        if (act === "plan") {
          const attackerId = facSel.value;
          const activityKey = this._plannerState.selectedKey || filtered[0]?.key;
          const note = noteInput.value || "";

          if (!attackerId || !activityKey) {
            ui.notifications?.warn?.("Select a faction and an activity first.");
            return;
          }

          try {
            if (isRigActivity(activityKey)) {
              const defenderId = this._plannerState.rigFactionId || rigFactionSel.value || "";
              const rigId = this._plannerState.rigId || rigSel.value || "";
              if (!defenderId || !rigId) {
                ui.notifications?.warn?.("Select a rig faction and rig first.");
                return;
              }
              const def = game.actors.get(defenderId);
              const rig = listFactionRigs(def).find(r => String(r.rigId) === String(rigId));
              const targetName = `${def?.name || "Faction"}: ${rig?.name || rigId}`;

              await game.bbttcc.api.raid.planActivity({
                attackerId,
                activityKey,
                note,
                targetType: "rig",
                defenderId,
                rigId,
                targetName
              });
            } else {
              const targetUuid = hexSel.value;
              if (!targetUuid) {
                ui.notifications?.warn?.("Select a target hex first.");
                return;
              }
              await game.bbttcc.api.raid.planActivity({ attackerId, targetUuid, activityKey, note });
            }
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
        // Debounce render so typing does not drop focus/cursor.
        this.__bbttccSearchDebounce = this.__bbttccSearchDebounce || null;
        if (this.__bbttccSearchDebounce) clearTimeout(this.__bbttccSearchDebounce);

        const el = ev.target;
        const start = (typeof el.selectionStart === "number") ? el.selectionStart : null;
        const end   = (typeof el.selectionEnd === "number") ? el.selectionEnd : null;

        this.__bbttccSearchDebounce = setTimeout(() => {
          this.__bbttccSearchDebounce = null;
          this.render(false);

          // Best-effort: restore focus and caret
          try {
            const root = this.element?.[0] ?? this.element;
            const field = root?.querySelector?.("input[data-role='search']") || null;
            if (field) {
              field.focus();
              if (start != null && end != null && field.setSelectionRange) field.setSelectionRange(start, end);
            }
          } catch (_e) {}
        }, 140);
      });

      this.onClose = () => {
        canvas?.stage?.off?.("pointerdown", onPick);
      };
      try { if (globalThis.BBTTCC_TooltipManager) globalThis.BBTTCC_TooltipManager.bind(wrap); } catch(e) {}

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

  // UPDATED: supports both hex targets and rig targets
  raidAPI.planActivity = async function({ attackerId, targetUuid=null, activityKey, note="", targetType="hex", defenderId=null, rigId=null, targetName=null }){
    if(!attackerId || !activityKey) throw new Error("Missing required params.");
    const attacker = game.actors.get(attackerId); if(!attacker) throw new Error("Attacker not found.");

    let resolvedTargetName = "";
    let entry = null;

    if (String(targetType).toLowerCase() === "rig") {
      if (!defenderId || !rigId) throw new Error("Missing defenderId or rigId for rig target.");
      resolvedTargetName = targetName || `Rig ${rigId}`;

      entry = {
        ts: Date.now(),
        date: (new Date()).toLocaleString(),
        type: "planned",
        attackerId,
        targetType: "rig",
        defenderId,
        rigId,
        targetName: resolvedTargetName,
        activityKey: String(activityKey),
        summary: `${attacker.name} planned ${activityKey} on ${resolvedTargetName}`,
        note: String(note||"")
      };
    } else {
      if (!targetUuid) throw new Error("Missing targetUuid for hex target.");
      const target = await fromUuid(targetUuid);
      const tdoc = target?.document ?? target;
      const tf = tdoc?.getFlag?.(TERR_ID) || tdoc?.flags?.[TERR_ID] || {};
      resolvedTargetName = tf?.name || tdoc?.text || tdoc?.id || "Unknown Hex";

      entry = {
        ts: Date.now(),
        date: (new Date()).toLocaleString(),
        type: "planned",
        attackerId,
        targetType: "hex",
        targetUuid,
        targetName: resolvedTargetName,
        activityKey: String(activityKey),
        summary: `${attacker.name} planned ${activityKey} on ${resolvedTargetName}`,
        note: String(note||"")
      };
    }

    const prev = deepClone(attacker.getFlag(FCT_ID,"warLogs") || []);
    prev.push(entry);
    await attacker.setFlag(FCT_ID,"warLogs", prev);
    log("Planned entry written", entry);
    return entry;
  };

  raidAPI.openActivityPlanner = (opts = {})=>{
    const C=globalThis.BBTTCC_ActivityPlanner;
    if(!C) return ui.notifications?.warn?.("Activity Planner not available.");

    const { factionId = null, lockFaction = false } = (opts && typeof opts === "object") ? opts : {};

    // Close any existing planner instance so lock context + state is deterministic.
    try {
      const existing = Object.values(ui?.windows || {}).find(w => w?.id === "bbttcc-activity-planner");
      if (existing) existing.close?.();
    } catch (_e) {}

    const app = new C({ bbttcc: { factionId, lockFaction } });
    app.render(true,{focus:true, window:{resizable:true, minimizable:true}});
    return app;
  };
  raidAPI.openRaidConsole     = ()=>{ const C=globalThis.BBTTCC_RaidConsole;     if(!C) return ui.notifications?.warn?.("Raid Console not available.");     new C().render(true,{focus:true, window:{resizable:true, minimizable:true}}); };
  raidAPI.openConsole = raidAPI.openRaidConsole;

  log("Raid API registered (V2 console + planner; consumePlanned is compat-bridge).");
});

/* ---------------- Toolbar Attachment ---------------- */
Hooks.once("ready",()=>{
  const openPlanner = ()=> game.bbttcc.api.raid.openActivityPlanner();
  const openRaid    = ()=> game.bbttcc.api.raid.openRaidConsole();

  try{ const obs=globalThis.__bbttccRaidToolbarObserver; if(obs?.disconnect) obs.disconnect(); }catch{}

  const attach=()=>{
    const el = document.getElementById("bbttcc-toolbar")
      || document.querySelector(".bbttcc-toolbar")
      || document.querySelector("[data-bbttcc-toolbar]");
    if(!el) return false;

    const targetRow =
      el.querySelector(".bbttcc-toolbar-main") ||
      el.querySelector(".row") ||
      el;

    const mk=(act,label,icon,fn)=>{
      if(el.querySelector(`.bbttcc-btn[data-act="${act}"]`)) return;
      const a = document.createElement("button");
      a.type = "button";
      a.className = "bbttcc-btn";
      a.dataset.act = act;
      a.innerHTML = `<i class="fas fa-${icon}"></i><span>${label}</span>`;
      a.addEventListener("click",(e)=>{
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        fn();
      },{capture:true});
      targetRow.appendChild(a);
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
  Hooks.on("renderApplication", () => attach());
});
