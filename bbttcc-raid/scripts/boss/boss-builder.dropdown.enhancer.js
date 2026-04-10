// bbttcc-raid/scripts/boss/boss-builder.dropdown.enhancer.js
// Replaces raw JSON authoring in Boss Builder with structured editors backed by system registries.
// Updated to support full canonical OP stat list + maneuver doctrine persistence.

(() => {
  const TAG = "[bbttcc-raid/bossBuilderDropdowns]";
  const log = function(){ console.log.apply(console, [TAG].concat([].slice.call(arguments))); };
  const warn = function(){ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); };

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const OP_LABELS = {
    violence: "Violence",
    nonlethal: "Nonlethal",
    intrigue: "Intrigue",
    economy: "Economy",
    softpower: "Soft Power",
    diplomacy: "Diplomacy",
    logistics: "Logistics",
    culture: "Culture",
    faith: "Faith"
  };

  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clone(x){
    try { return foundry && foundry.utils ? foundry.utils.duplicate(x) : JSON.parse(JSON.stringify(x)); }
    catch (_e) { return x; }
  }

  function num(v, d){
    const n = Number(v);
    return Number.isFinite(n) ? n : (d === undefined ? 0 : d);
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

  function parseJson(text, fb){
    try {
      if (text == null || String(text).trim() === "") return fb;
      return JSON.parse(String(text));
    } catch (_e) { return fb; }
  }

  function normalizeStats(stats){
    const src = (stats && typeof stats === "object") ? stats : {};
    const out = {};
    for (let i=0; i<OP_KEYS.length; i++) {
      const k = OP_KEYS[i];
      if (k === "softpower") out[k] = num(src.softpower != null ? src.softpower : src.softPower, 0);
      else out[k] = num(src[k], 0);
    }
    return out;
  }

  function encodeStats(stats){
    return JSON.stringify(normalizeStats(stats || {}), null, 2);
  }

  function getPowers(){
    try {
      const raid = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid ? game.bbttcc.api.raid : null;
      return Array.isArray(raid && raid.bossPowers ? raid.bossPowers : []) ? raid.bossPowers : [];
    } catch (_e) { return []; }
  }

  function getPowerByKey(key){
    const arr = getPowers();
    for (let i=0; i<arr.length; i++) if (String(arr[i] && arr[i].key || "") === String(key || "")) return arr[i];
    return null;
  }

  function behaviorIdent(b){
    if (!b) return "";
    if (b.powerKey) return String(b.powerKey);
    if (b.key) return String(b.key);
    if (b.id) return String(b.id);
    return "";
  }

  function inferPowerKey(behavior){
    const b = behavior || {};
    if (b.powerKey && getPowerByKey(b.powerKey)) return String(b.powerKey);
    const ident = behaviorIdent(b);
    if (ident && getPowerByKey(ident)) return ident;

    const arr = getPowers();
    for (let i=0; i<arr.length; i++) {
      const p = arr[i] || {};
      const pb = p.behavior || {};
      if (pb.id && b.id && String(pb.id) === String(b.id)) return String(p.key || "");
      if (pb.key && b.key && String(pb.key) === String(b.key)) return String(p.key || "");
      if (pb.label && b.label && String(pb.label) === String(b.label)) return String(p.key || "");
    }
    return "";
  }

  function cloneBehaviorFromPower(key){
    const hit = getPowerByKey(key);
    if (!hit) return null;
    const row = clone(hit.behavior || {});
    row.powerKey = String(hit.key || key || "");
    return row;
  }

  function collectManeuvers(){
    const out = [];
    const seen = {};

    function push(row){
      if (!row) return;
      const key = String(row.key || row.unlockKey || "").trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({
        key: key,
        label: String(row.label || row.name || key),
        tier: num(row.tier, 0),
        availability: String(row.availability || "").toLowerCase(),
        live: !!row.live,
        wired: !!row.wired
      });
    }

    try {
      const raid = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid ? game.bbttcc.api.raid : null;
      const effects = raid && raid.EFFECTS ? raid.EFFECTS : {};
      for (const key in effects) {
        if (!Object.prototype.hasOwnProperty.call(effects, key)) continue;
        const eff = effects[key] || {};
        if (String(eff.kind || "") !== "maneuver") continue;
        push({
          key: key,
          label: eff.label || key,
          tier: eff.tier || (eff.meta ? eff.meta.tier : 0),
          availability: eff.availability || (eff.meta ? eff.meta.availability : ""),
          live: true,
          wired: true
        });
      }
    } catch (_e) {}

    try {
      const agent = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.agent ? game.bbttcc.api.agent : null;
      const throughput = agent && agent.__THROUGHPUT ? agent.__THROUGHPUT : {};
      for (const key in throughput) {
        if (!Object.prototype.hasOwnProperty.call(throughput, key)) continue;
        push({ key: key, label: key.replace(/_/g, " ").replace(/\b\w/g, function(m){ return m.toUpperCase(); }), wired: true, live: false });
      }
      const fn = agent && agent.registry && typeof agent.registry.maneuvers === "function" ? agent.registry.maneuvers : null;
      if (fn) {
        const rows = fn({ source: "merged" }) || [];
        if (Array.isArray(rows)) {
          for (let i=0; i<rows.length; i++) push(rows[i]);
        }
      }
    } catch (_e) {}

    out.sort(function(a, b){
      if ((a.live ? 1 : 0) !== (b.live ? 1 : 0)) return (b.live ? 1 : 0) - (a.live ? 1 : 0);
      if ((a.wired ? 1 : 0) !== (b.wired ? 1 : 0)) return (b.wired ? 1 : 0) - (a.wired ? 1 : 0);
      if (num(a.tier, 0) !== num(b.tier, 0)) return num(a.tier, 0) - num(b.tier, 0);
      return String(a.label || a.key).localeCompare(String(b.label || b.key));
    });

    return out;
  }

  function getRoot(app){
    const el = app && app.element ? app.element : null;
    if (!el) return null;
    return (el.querySelector ? el : (el[0] || null));
  }

  function stateFor(app){
    if (!app.__bbttccBossBuilderState) app.__bbttccBossBuilderState = {};
    return app.__bbttccBossBuilderState;
  }

  function syncStateFromDom(app){
    const root = getRoot(app);
    if (!root) return stateFor(app);
    const st = stateFor(app);
    const statsTxt = root.querySelector('textarea[name="boss.statsRaw"]');
    const behTxt = root.querySelector('textarea[name="boss.behaviorsRaw"]');
    const docInput = root.querySelector('input[name="boss.maneuverKeysCsv"]');
    if (!st.stats) st.stats = normalizeStats(parseJson(statsTxt ? statsTxt.value : "{}", {}));
    if (!st.behaviors) st.behaviors = parseJson(behTxt ? behTxt.value : "[]", []);
    if (!st.maneuverKeys) st.maneuverKeys = uniq(String(docInput && docInput.value || "").split(","));
    return st;
  }

  function renderEditors(app){
    const root = getRoot(app);
    if (!root) return;
    const st = syncStateFromDom(app);

    const statsTxt = root.querySelector('textarea[name="boss.statsRaw"]');
    const behTxt = root.querySelector('textarea[name="boss.behaviorsRaw"]');
    if (!statsTxt || !behTxt) return;

    statsTxt.style.display = 'none';
    behTxt.style.display = 'none';

    let docInput = root.querySelector('input[name="boss.maneuverKeysCsv"]');
    if (!docInput) {
      docInput = document.createElement('input');
      docInput.type = 'hidden';
      docInput.name = 'boss.maneuverKeysCsv';
      const form = root.querySelector('form.bbttcc-boss-config-form') || root.querySelector('form') || root;
      form.appendChild(docInput);
    }
    docInput.value = uniq(st.maneuverKeys || []).join(', ');
    statsTxt.value = encodeStats(st.stats || {});
    behTxt.value = JSON.stringify(Array.isArray(st.behaviors) ? st.behaviors : [], null, 2);

    let statsBox = root.querySelector('[data-role="bbttcc-boss-stats-box"]');
    if (!statsBox) {
      statsBox = document.createElement('div');
      statsBox.setAttribute('data-role', 'bbttcc-boss-stats-box');
      statsBox.style.display = 'grid';
      statsBox.style.gridTemplateColumns = 'repeat(3, minmax(120px, 1fr))';
      statsBox.style.gap = '.5rem';
      statsBox.style.marginTop = '.4rem';
      statsTxt.parentNode.insertBefore(statsBox, statsTxt.nextSibling);
    }
    const ns = normalizeStats(st.stats || {});
    let statsHtml = '';
    for (let i=0; i<OP_KEYS.length; i++) {
      const k = OP_KEYS[i];
      statsHtml += "<label><div>" + esc(OP_LABELS[k] || k) + "</div><input type='number' data-boss-stat='" + esc(k) + "' value='" + esc(String(ns[k])) + "'/></label>";
    }
    statsBox.innerHTML = statsHtml;

    let powerBox = root.querySelector('[data-role="bbttcc-boss-power-box"]');
    if (!powerBox) {
      powerBox = document.createElement('div');
      powerBox.setAttribute('data-role', 'bbttcc-boss-power-box');
      powerBox.style.display = 'flex';
      powerBox.style.flexDirection = 'column';
      powerBox.style.gap = '.45rem';
      powerBox.style.marginTop = '.6rem';
      behTxt.parentNode.insertBefore(powerBox, behTxt.nextSibling);
    }
    const powers = getPowers();
    const rows = Array.isArray(st.behaviors) ? st.behaviors : [];
    let powerHtml = "<div style='display:flex; align-items:center; justify-content:space-between; gap:.5rem;'><b>Boss Powers</b><button type='button' data-boss-act='add-power'>Add Power</button></div>";
    if (!rows.length) powerHtml += "<div style='opacity:.75;'>No boss powers selected yet.</div>";
    for (let i=0; i<rows.length; i++) {
      const pk = inferPowerKey(rows[i]);
      powerHtml += "<div style='display:grid; grid-template-columns:minmax(220px,1fr) auto auto auto; gap:.35rem; align-items:center;'>";
      powerHtml += "<select data-boss-power-idx='" + i + "'><option value=''>Select Canonical Power…</option>";
      for (let j=0; j<powers.length; j++) {
        const p = powers[j] || {};
        const sel = (String(pk || "") === String(p.key || "")) ? " selected" : "";
        powerHtml += "<option value='" + esc(String(p.key || "")) + "'" + sel + ">" + esc(String(p.label || p.key || "")) + "</option>";
      }
      powerHtml += "</select>";
      powerHtml += "<button type='button' data-boss-act='move-up' data-boss-idx='" + i + "'>↑</button>";
      powerHtml += "<button type='button' data-boss-act='move-down' data-boss-idx='" + i + "'>↓</button>";
      powerHtml += "<button type='button' data-boss-act='remove-power' data-boss-idx='" + i + "'>Remove</button>";
      powerHtml += "</div>";
      if (!pk) powerHtml += "<div style='font-size:11px; color:#fca5a5;'>Custom/unmapped behavior retained. Reassign it to a canonical power to make it fully structured.</div>";
      else {
        const hit = getPowerByKey(pk);
        if (hit && hit.description) powerHtml += "<div style='font-size:11px; color:#94a3b8;'>" + esc(String(hit.description || "")) + "</div>";
      }
    }
    powerBox.innerHTML = powerHtml;

    let doctrineBox = root.querySelector('[data-role="bbttcc-boss-doctrine-box"]');
    const anchor = root.querySelector('[data-role="powers-preview-note"]') || root.querySelector('[data-role="powers-preview"]') || powerBox;
    if (!doctrineBox) {
      doctrineBox = document.createElement('div');
      doctrineBox.setAttribute('data-role', 'bbttcc-boss-doctrine-box');
      doctrineBox.style.marginTop = '.8rem';
      anchor.parentNode.appendChild(doctrineBox);
    }
    const mans = collectManeuvers();
    const active = {};
    const picked = uniq(st.maneuverKeys || []);
    for (let i=0; i<picked.length; i++) active[picked[i]] = true;
    let docHtml = "<div style='display:flex; align-items:center; justify-content:space-between; gap:.5rem;'><b>Boss Maneuver Doctrine</b><small style='opacity:.72;'>Currently wired maneuvers</small></div>";
    docHtml += "<div style='display:grid; grid-template-columns:repeat(2, minmax(240px, 1fr)); gap:.3rem .75rem; margin-top:.35rem; max-height:240px; overflow:auto;'>";
    for (let i=0; i<mans.length; i++) {
      const m = mans[i] || {};
      const tags = [];
      if (m.tier) tags.push('T' + m.tier);
      if (m.live) tags.push('live'); else if (m.wired) tags.push('wired');
      if (m.availability) tags.push(m.availability);
      docHtml += "<label style='display:flex; align-items:center; gap:.35rem;'><input type='checkbox' data-boss-doctrine='" + esc(String(m.key || "")) + "'" + (active[String(m.key || "")] ? " checked" : "") + "/><span>" + esc(String(m.label || m.key || "")) + "</span><small style='opacity:.72;'>" + esc(tags.join(' • ')) + "</small></label>";
    }
    docHtml += "</div>";
    if (picked.length) {
      docHtml += "<div style='display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.4rem;'>";
      for (let i=0; i<picked.length; i++) {
        const key = picked[i];
        let hit = null;
        for (let j=0; j<mans.length; j++) if (String(mans[j].key || "") === String(key || "")) { hit = mans[j]; break; }
        docHtml += "<span style='display:inline-flex; align-items:center; gap:.25rem; padding:.15rem .45rem; border-radius:999px; border:1px solid rgba(148,163,184,.35); background:" + (hit && hit.live ? 'rgba(34,197,94,.12)' : 'rgba(59,130,246,.10)') + ";'>" + esc(String(hit ? (hit.label || key) : key)) + "</span>";
      }
      docHtml += "</div>";
    } else {
      docHtml += "<div style='margin-top:.35rem; opacity:.72;'>No doctrine maneuvers selected yet.</div>";
    }
    doctrineBox.innerHTML = docHtml;
  }

  function bindEditorEvents(app){
    const root = getRoot(app);
    if (!root || root.__bbttccBossDropdownBound) return;
    root.__bbttccBossDropdownBound = true;

    root.addEventListener('input', function(ev){
      const t = ev && ev.target ? ev.target : null;
      if (!t || !t.getAttribute) return;
      const stat = t.getAttribute('data-boss-stat');
      if (!stat) return;
      const st = syncStateFromDom(app);
      st.stats = normalizeStats(st.stats || {});
      st.stats[stat] = num(t.value, 0);
      renderEditors(app);
      app._dirty = true;
    }, true);

    root.addEventListener('change', function(ev){
      const t = ev && ev.target ? ev.target : null;
      if (!t || !t.getAttribute) return;

      const idxAttr = t.getAttribute('data-boss-power-idx');
      if (idxAttr != null) {
        const idx = num(idxAttr, -1);
        if (idx < 0) return;
        const st = syncStateFromDom(app);
        const rows = Array.isArray(st.behaviors) ? st.behaviors.slice() : [];
        const key = String(t.value || '');
        if (key) rows[idx] = cloneBehaviorFromPower(key) || rows[idx] || {};
        st.behaviors = rows;
        app._dirty = true;
        renderEditors(app);
        return;
      }

      const docKey = t.getAttribute('data-boss-doctrine');
      if (docKey != null) {
        const st = syncStateFromDom(app);
        const active = {};
        const checks = root.querySelectorAll('input[data-boss-doctrine]:checked');
        for (let i=0; i<checks.length; i++) active[String(checks[i].getAttribute('data-boss-doctrine') || '')] = true;
        st.maneuverKeys = Object.keys(active).sort();
        app._dirty = true;
        renderEditors(app);
      }
    }, true);

    root.addEventListener('click', function(ev){
      const t = ev && ev.target ? ev.target : null;
      if (!t || !t.getAttribute) return;
      const act = t.getAttribute('data-boss-act');
      if (!act) return;
      ev.preventDefault();
      const st = syncStateFromDom(app);
      const rows = Array.isArray(st.behaviors) ? st.behaviors.slice() : [];
      const idx = num(t.getAttribute('data-boss-idx'), -1);

      if (act === 'add-power') rows.push(cloneBehaviorFromPower(getPowers()[0] && getPowers()[0].key || '') || {});
      if (act === 'remove-power' && idx >= 0) rows.splice(idx, 1);
      if (act === 'move-up' && idx > 0) {
        const tmp = rows[idx - 1]; rows[idx - 1] = rows[idx]; rows[idx] = tmp;
      }
      if (act === 'move-down' && idx >= 0 && idx < rows.length - 1) {
        const tmp2 = rows[idx + 1]; rows[idx + 1] = rows[idx]; rows[idx] = tmp2;
      }

      st.behaviors = rows;
      app._dirty = true;
      renderEditors(app);
    }, true);
  }

  function patchOnce(){
    const App = globalThis.BBTTCC_BossConfigApp || (game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid ? game.bbttcc.api.raid.BBTTCC_BossConfigApp : null);
    if (!App || !App.prototype) return false;
    if (App.prototype.__bbttccDropdownPatchInstalled) return true;

    const origRender = App.prototype._onRender;
    const origRead = App.prototype._readBossFromForm;
    const origSave = App.prototype._onSave;

    App.prototype._onRender = function patchedOnRender(context, options){
      const self = this;
      const p = origRender.call(this, context, options);
      return Promise.resolve(p).then(function(res){
        try {
          bindEditorEvents(self);
          renderEditors(self);
        } catch (e) { warn('structured render failed', e); }
        return res;
      });
    };

    App.prototype._readBossFromForm = function patchedRead(root){
      const out = origRead.call(this, root);
      try {
        const st = syncStateFromDom(this);
        out.stats = normalizeStats(st.stats || out.stats || {});
        out.behaviors = clone(st.behaviors || out.behaviors || []);
        out.maneuverKeys = uniq(st.maneuverKeys || []);
      } catch (e) { warn('read patch failed', e); }
      return out;
    };

    App.prototype._onSave = function patchedSave(){
      const self = this;
      const res = origSave.call(this);
      setTimeout(function(){
        try {
          const root = getRoot(self);
          if (!root) return;
          const st = syncStateFromDom(self);
          const key = String(self._selectedKey || '');
          if (!key) return;
          const defs = game.settings.get('bbttcc-raid', 'bossDefsCustom') || {};
          if (!defs[key]) return;
          defs[key].maneuverKeys = uniq(st.maneuverKeys || []);
          defs[key].stats = normalizeStats(st.stats || defs[key].stats || {});
          game.settings.set('bbttcc-raid', 'bossDefsCustom', defs).then(function(){
            try {
              const raid = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid ? game.bbttcc.api.raid : null;
              const bossApi = raid && raid.boss ? raid.boss : null;
              if (bossApi && typeof bossApi.registerBoss === 'function') bossApi.registerBoss(key, defs[key]);
            } catch (_e) {}
          });
        } catch (e) { warn('post-save doctrine persistence failed', e); }
      }, 80);
      return res;
    };

    App.prototype.__bbttccDropdownPatchInstalled = true;
    log('Boss Builder dropdown enhancer installed.');
    return true;
  }

  async function retry(){
    const waits = [0, 50, 250, 1000, 2000];
    for (let i=0; i<waits.length; i++) {
      const ms = waits[i];
      if (ms) await new Promise((r)=>setTimeout(r, ms));
      try { if (patchOnce()) return; }
      catch (e) { warn('patch attempt failed', e); }
    }
    warn('Boss Builder dropdown enhancer could not install.');
  }

  retry();
  Hooks.once('ready', () => { retry(); });
})();
