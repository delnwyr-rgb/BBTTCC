// bbttcc-raid/scripts/boss/boss-creature-doctrine.ui.enhancer.js
// Adds boss maneuver doctrine selection UI to creature-target raid rounds.
// This feeds the existing defender-side maneuver arrays so B2/B3 execution paths can use boss doctrines.

(() => {
  const TAG = "[bbttcc-raid/bossCreatureDoctrineUI]";
  const log = function(){ console.log.apply(console, [TAG].concat([].slice.call(arguments))); };
  const warn = function(){ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); };

  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function getConsoleClass(){
    try {
      return game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid && game.bbttcc.api.raid.ConsoleClass
        ? game.bbttcc.api.raid.ConsoleClass : null;
    } catch (_e) { return null; }
  }

  function getBoss(round){
    try {
      const api = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid && game.bbttcc.api.raid.boss
        ? game.bbttcc.api.raid.boss : null;
      if (!api || typeof api.get !== 'function') return null;
      const key = round && round.creatureId ? round.creatureId : "";
      if (!key) return null;
      return api.get(key) || null;
    } catch (_e) { return null; }
  }

  function getManeuverMap(keys){
    const out = {};
    const src = uniq(keys || []);
    let effects = {};
    let throughput = {};
    try {
      effects = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid && game.bbttcc.api.raid.EFFECTS
        ? game.bbttcc.api.raid.EFFECTS : {};
    } catch (_e) {}
    try {
      throughput = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.agent && game.bbttcc.api.agent.__THROUGHPUT
        ? game.bbttcc.api.agent.__THROUGHPUT : {};
    } catch (_e2) {}

    for (let i=0; i<src.length; i++) {
      const key = String(src[i] || "");
      if (!key) continue;
      const eff = effects[key] || {};
      const label = String(eff.label || key.replace(/_/g, ' ').replace(/\b\w/g, function(m){ return m.toUpperCase(); }));
      const cost = eff.opCosts || eff.cost || {};
      out[key] = { key: key, label: label, cost: cost, wired: !!(effects[key] || throughput[key]) };
    }
    return out;
  }

  function costText(cost){
    if (!cost || typeof cost !== 'object') return '';
    const parts = [];
    for (const k in cost) {
      if (!Object.prototype.hasOwnProperty.call(cost, k)) continue;
      const v = Number(cost[k] || 0);
      if (!v) continue;
      parts.push(String(k) + ':' + String(v));
    }
    return parts.length ? (' <small style="opacity:.8;">(OP ' + esc(parts.join(', ')) + ')</small>') : '';
  }

  function renderBossDoctrine(host, round){
    if (!host || !round || String(round.targetType || '') !== 'creature') return;
    host.querySelectorAll('[data-role="bbttcc-boss-doctrine-fieldset"]').forEach(function(n){ n.remove(); });

    const boss = getBoss(round);
    const keys = boss && Array.isArray(boss.maneuverKeys) ? boss.maneuverKeys.slice() : [];
    if (!keys.length) return;

    round.mansSelectedDef = Array.isArray(round.mansSelectedDef) ? round.mansSelectedDef : [];
    const active = {};
    for (let i=0; i<round.mansSelectedDef.length; i++) active[String(round.mansSelectedDef[i] || '')] = true;

    const map = getManeuverMap(keys);

    const fs = document.createElement('fieldset');
    fs.className = 'bbttcc-mans';
    fs.setAttribute('data-role', 'bbttcc-boss-doctrine-fieldset');

    const lg = document.createElement('legend');
    lg.textContent = (boss && boss.label ? boss.label : 'Boss') + ' Maneuvers';
    fs.appendChild(lg);

    const hint = document.createElement('div');
    hint.style.fontSize = '11px';
    hint.style.opacity = '.8';
    hint.style.marginBottom = '.35rem';
    hint.textContent = 'Creature-target doctrine now uses the defender-side maneuver lane.';
    fs.appendChild(hint);

    const grid = document.createElement('div');
    grid.className = 'mans-wrap';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '.25rem .5rem';

    for (let i=0; i<keys.length; i++) {
      const key = String(keys[i] || '');
      const row = map[key] || { key: key, label: key, cost: {} };
      const id = 'm-def-' + String(round.roundId || 'boss') + '-' + key;
      const checked = !!active[key];
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.gap = '.25rem';
      label.innerHTML = "<input type='checkbox' " + (checked ? 'checked' : '') + " data-maneuver='" + esc(key) + "' data-side='def' id='" + esc(id) + "'><span>" + esc(row.label || key) + "</span><span class='bbttcc-tip-icon' data-tip-kind='maneuver' data-tip-key='" + esc(key) + "'>ⓘ</span>" + costText(row.cost);
      grid.appendChild(label);
    }

    fs.appendChild(grid);
    host.appendChild(fs);
  }

  function patchOnce(){
    const App = getConsoleClass();
    if (!App || !App.prototype) return false;
    if (App.prototype.__bbttccBossCreatureDoctrineUIPatched) return true;

    const orig = App.prototype._renderManeuversInto;
    if (typeof orig !== 'function') return false;

    App.prototype._renderManeuversInto = function patchedRenderManeuversInto(tr, round){
      const res = orig.call(this, tr, round);
      try {
        const host = tr && tr.querySelector ? tr.querySelector('.bbttcc-mans-cell') : null;
        renderBossDoctrine(host, round);
      } catch (e) { warn('boss doctrine render failed', e); }
      return res;
    };

    App.prototype.__bbttccBossCreatureDoctrineUIPatched = true;
    log('Boss creature doctrine UI enhancer installed.');
    return true;
  }

  async function retry(){
    const waits = [0, 50, 250, 1000, 2000];
    for (let i=0; i<waits.length; i++) {
      const ms = waits[i];
      if (ms) await new Promise(function(resolve){ setTimeout(resolve, ms); });
      try { if (patchOnce()) return; }
      catch (e) { warn('patch attempt failed', e); }
    }
    warn('Boss creature doctrine UI enhancer could not install.');
  }

  retry();
  Hooks.once('ready', function(){ retry(); });
})();
