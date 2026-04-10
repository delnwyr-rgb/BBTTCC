// bbttcc-raid/scripts/boss/bossRegistry.js
// FULL REPLACEMENT — Boss Registry v3
// Native doctrine + full canonical OP normalization.
//
// Key features:
//  - Preserves arbitrary behavior objects (including when/effects/endRaid/etc.)
//  - Preserves hitTrack (top-level) OR track.hitTrack (author-friendly)
//  - Normalizes boss stats to the full canonical OP schema
//  - Preserves maneuver doctrine via maneuverKeys
//  - Backfills shipped canonical doctrine/stat defaults (currently Gloomgill)
//  - Decorates list() labels with doctrine counts
//  - Remains resilient to bbttcc.api overwrites: attaches immediately + on ready
//  - Syntax-safe for older parsers: no optional chaining, no object spread, no ?? / ||=
//
// Exposes:
//  game.bbttcc.api.raid.boss = { registerBoss, get, list, unregisterBoss, clearBosses }

(() => {
  const TAG = "[bbttcc-raid/bossRegistry]";
  const log  = function(){ console.log.apply(console, [TAG].concat([].slice.call(arguments))); };
  const warn = function(){ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); };

  const STORE_KEY = "__bbttccRaidBossRegistry";
  const g = (typeof globalThis !== "undefined") ? globalThis : window;
  const store = g[STORE_KEY] ? g[STORE_KEY] : (g[STORE_KEY] = { bosses: {} });

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  const CANONICAL = {
    gloomgill: {
      maneuverKeys: ["void_signal_collapse", "suppressive_fire", "qliphothic_gambit", "psychic_disruption"],
      stats: {
        violence: 10,
        nonlethal: 0,
        intrigue: 4,
        economy: 0,
        softpower: 0,
        diplomacy: 0,
        logistics: 0,
        culture: 0,
        faith: 2
      }
    }
  };

  function lc(s){ return String((s===undefined||s===null) ? "" : s).toLowerCase().trim(); }

  function _clone(x){
    try { return foundry && foundry.utils ? foundry.utils.duplicate(x) : JSON.parse(JSON.stringify(x)); }
    catch (e) { return x; }
  }

  function _uniq(arr){
    const out = [];
    const seen = {};
    const src = Array.isArray(arr) ? arr : [];
    for (let i=0;i<src.length;i++){
      const k = String(src[i] == null ? "" : src[i]).trim();
      if (!k || seen[k]) continue;
      seen[k] = true;
      out.push(k);
    }
    return out;
  }

  function _num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function _normalizeStats(stats, bossKey){
    const src = (stats && typeof stats === "object") ? _clone(stats) : {};
    const canon = CANONICAL[lc(bossKey)] || {};
    const canonStats = (canon && canon.stats && typeof canon.stats === "object") ? canon.stats : {};
    const out = {};
    for (let i=0;i<OP_KEYS.length;i++){
      const k = OP_KEYS[i];
      if (k === "softpower") out[k] = _num(src.softpower !== undefined ? src.softpower : (src.softPower !== undefined ? src.softPower : canonStats[k]));
      else out[k] = _num(src[k] !== undefined ? src[k] : canonStats[k]);
    }
    return out;
  }

  function _normTrack(def){
    // Accept either top-level hitTrack or nested track.hitTrack
    const out = {};
    let ht = def ? def.hitTrack : null;
    if (!ht && def && def.track && def.track.hitTrack) ht = def.track.hitTrack;

    if (Array.isArray(ht) && ht.length) out.hitTrack = ht.slice();
    else if (typeof ht === "string" && ht.trim()) out.hitTrack = ht.split(",").map(function(x){ return String(x || "").trim(); }).filter(function(x){ return !!x; });
    else out.hitTrack = ["shaken","wounded","broken","banished"];

    // Optional start step
    let ss = (def && def.track && def.track.startStep !== undefined) ? Number(def.track.startStep) : undefined;
    if (ss === undefined && def && def.damageStep !== undefined) ss = Number(def.damageStep);
    if (!Number.isFinite(ss)) ss = 0;
    out.startStep = Math.max(0, Math.floor(ss));

    return out;
  }

  function _normBoss(key, def){
    key = lc(key);
    def = def || {};

    const track = _normTrack(def);

    // Preserve behaviors as-is (do NOT strip fields)
    const behaviors = Array.isArray(def.behaviors) ? _clone(def.behaviors) : [];

    // Preserve optional author fields
    const tags = Array.isArray(def.tags) ? def.tags.slice() : (typeof def.tags === "string" ? def.tags.split(",").map(function(x){ return String(x || "").trim(); }).filter(function(x){ return !!x; }) : []);

    const canon = CANONICAL[key] || {};
    const maneuverKeys = _uniq((Array.isArray(def.maneuverKeys) ? def.maneuverKeys : []).concat(Array.isArray(canon.maneuverKeys) ? canon.maneuverKeys : []));

    const boss = {
      key: key,
      label: String(def.label || key),
      mode: String(def.mode || "abstract"),
      tags: tags,

      // Back-compat fields (some existing code may look at these)
      stats: _normalizeStats(def.stats && typeof def.stats === "object" ? def.stats : {}, key),
      moraleHits: (def.moraleHits !== undefined) ? Number(def.moraleHits) : 1,

      // New canonical track fields
      hitTrack: track.hitTrack,
      track: { hitTrack: track.hitTrack, startStep: track.startStep },

      // Presentation / outcomes buckets (kept for future author UI)
      presentation: (def.presentation && typeof def.presentation === "object") ? _clone(def.presentation) : {},
      outcomes: (def.outcomes && typeof def.outcomes === "object") ? _clone(def.outcomes) : {},
      ai: (def.ai && typeof def.ai === "object") ? _clone(def.ai) : {},

      maneuverKeys: maneuverKeys,
      behaviors: behaviors
    };

    // Preserve any top-level custom fields under meta (optional)
    if (def.meta && typeof def.meta === "object") boss.meta = _clone(def.meta);

    return boss;
  }

  function registerBoss(key, def){
    try {
      const k = lc(key);
      if (!k) throw new Error("missing boss key");
      const boss = _normBoss(k, def || {});
      store.bosses[k] = boss;
      return boss;
    } catch (e) {
      warn("registerBoss failed", e);
      return null;
    }
  }

  function get(key){
    const k = lc(key);
    return store.bosses[k] || null;
  }

  function list(){
    const out = [];
    const keys = Object.keys(store.bosses || {}).sort();
    for (let i=0;i<keys.length;i++){
      const b = store.bosses[keys[i]];
      if (!b) continue;
      const count = Array.isArray(b.maneuverKeys) ? b.maneuverKeys.length : 0;
      out.push({
        key: b.key,
        label: String(b.label || b.key || "") + (count > 0 ? (" • " + count + " doctrine" + (count === 1 ? "" : "s")) : "")
      });
    }
    return out;
  }

  function unregisterBoss(key){
    const k = lc(key);
    if (store.bosses && store.bosses[k]) delete store.bosses[k];
  }

  function clearBosses(){
    store.bosses = {};
  }

  function _attach(){
    try {
      if (!game.bbttcc) game.bbttcc = {};
      if (!game.bbttcc.api) game.bbttcc.api = {};
      if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};
      if (!game.bbttcc.api.raid.boss) game.bbttcc.api.raid.boss = {};

      const api = game.bbttcc.api.raid.boss;
      api.registerBoss = registerBoss;
      api.get = get;
      api.list = list;
      api.unregisterBoss = unregisterBoss;
      api.clearBosses = clearBosses;

      return true;
    } catch (e) {
      warn("attach failed", e);
      return false;
    }
  }

  _attach();
  Hooks.once("ready", function() {
    _attach();
    log("Boss registry v3 ready (attached). bosses:", Object.keys(store.bosses||{}).length);
  });

})();
