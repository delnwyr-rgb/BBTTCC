// bbttcc-raid/scripts/boss/boss-doctrine.registry.enhancer.js
// Boss registry enhancer:
//  - preserves + decorates boss maneuver doctrine
//  - normalizes boss stats to full canonical OP list
//  - backfills canonical doctrine + stat defaults for shipped bosses

(() => {
  const TAG = "[bbttcc-raid/bossDoctrineRegistry]";
  const log = function(){ console.log.apply(console, [TAG].concat([].slice.call(arguments))); };
  const warn = function(){ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); };

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  const CANONICAL = {
    gloomgill: {
      maneuverKeys: ["void_signal_collapse", "suppressive_fire", "qliphothic_gambit", "psychic_disruption"],
      stats: { violence: 10, intrigue: 4, faith: 2, softpower: 0, nonlethal: 0, economy: 0, diplomacy: 0, logistics: 0, culture: 0 }
    }
  };

  function clone(x){
    try { return foundry && foundry.utils ? foundry.utils.duplicate(x) : JSON.parse(JSON.stringify(x)); }
    catch (_e) { return x; }
  }

  function uniq(arr){
    const out = [];
    const seen = {};
    const src = Array.isArray(arr) ? arr : [];
    for (let i=0; i<src.length; i++) {
      const k = String(src[i] || "").trim();
      if (!k || seen[k]) continue;
      seen[k] = true;
      out.push(k);
    }
    return out;
  }

  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function getBossApi(){
    try {
      return game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid && game.bbttcc.api.raid.boss
        ? game.bbttcc.api.raid.boss : null;
    } catch (_e) { return null; }
  }

  function normalizeStats(stats, bossKey){
    const src = (stats && typeof stats === "object") ? clone(stats) : {};
    const canon = CANONICAL[String(bossKey || "").toLowerCase()] || {};
    const canonStats = (canon && canon.stats && typeof canon.stats === "object") ? canon.stats : {};
    const out = {};

    for (let i=0; i<OP_KEYS.length; i++) {
      const k = OP_KEYS[i];
      if (k === "softpower") out[k] = num(src.softpower != null ? src.softpower : (src.softPower != null ? src.softPower : canonStats[k]));
      else out[k] = num(src[k] != null ? src[k] : canonStats[k]);
    }

    return out;
  }

  function decorateBoss(key, boss, sourceDef){
    if (!boss || typeof boss !== "object") return boss;

    const lk = String(key || boss.key || "").toLowerCase();
    const canon = CANONICAL[lk] || {};
    const fromDef = sourceDef && Array.isArray(sourceDef.maneuverKeys) ? sourceDef.maneuverKeys : [];
    const canonDoc = Array.isArray(canon.maneuverKeys) ? canon.maneuverKeys : [];

    boss.maneuverKeys = uniq((Array.isArray(boss.maneuverKeys) ? boss.maneuverKeys : []).concat(fromDef).concat(canonDoc));
    boss.stats = normalizeStats(boss.stats || (sourceDef ? sourceDef.stats : null), lk);
    return boss;
  }

  function installOnce(){
    const api = getBossApi();
    if (!api || typeof api.registerBoss !== "function" || typeof api.get !== "function") return false;
    if (api.__bbttccBossDoctrineInstalled) return true;

    const origRegister = api.registerBoss;
    const origGet = api.get;
    const origList = typeof api.list === "function" ? api.list : null;

    api.registerBoss = function wrappedRegisterBoss(key, def){
      const safeDef = clone(def || {});
      safeDef.stats = normalizeStats(safeDef.stats || {}, key);
      safeDef.maneuverKeys = uniq((safeDef.maneuverKeys || []).concat((CANONICAL[String(key || "").toLowerCase()] || {}).maneuverKeys || []));
      const out = origRegister.call(this, key, safeDef);
      try { decorateBoss(key, out, safeDef); } catch (e) { warn("decorate on register failed", e); }
      return out;
    };

    api.get = function wrappedGet(key){
      const out = origGet.call(this, key);
      try { decorateBoss(key, out, null); } catch (e) { warn("decorate on get failed", e); }
      return out;
    };

    if (origList) {
      api.list = function wrappedList(){
        const rows = origList.call(this) || [];
        const out = [];
        for (let i=0; i<rows.length; i++) {
          const row = clone(rows[i] || {});
          const boss = api.get(row.key);
          const count = boss && Array.isArray(boss.maneuverKeys) ? boss.maneuverKeys.length : 0;
          if (count > 0) row.label = String(row.label || row.key || "") + " • " + count + " doctrine" + (count === 1 ? "" : "s");
          out.push(row);
        }
        return out;
      };
    }

    api.__bbttccBossDoctrineInstalled = true;

    try {
      const listed = origList ? origList.call(api) : [];
      for (let i=0; i<listed.length; i++) {
        const key = String((listed[i] && listed[i].key) || "");
        if (!key) continue;
        const boss = origGet.call(api, key);
        decorateBoss(key, boss, null);
      }
    } catch (e) { warn("backfill failed", e); }

    log("Boss doctrine registry enhancer installed.");
    return true;
  }

  async function retry(){
    const waits = [0, 50, 250, 1000, 2000];
    for (let i=0; i<waits.length; i++) {
      const ms = waits[i];
      if (ms) await new Promise((r)=>setTimeout(r, ms));
      try { if (installOnce()) return; }
      catch (e) { warn("install attempt failed", e); }
    }
    warn("Boss doctrine registry enhancer could not install.");
  }

  retry();
  Hooks.once("ready", () => { retry(); });
})();
