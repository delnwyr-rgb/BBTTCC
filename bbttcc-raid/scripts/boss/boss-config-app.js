// modules/bbttcc-raid/scripts/boss/boss-config-app.js
// Boss Builder UI v6 — Chip Remove + Normalize (SYNTAX-SAFE)
// Full replacement, hardened for older parsers:
//  - NO async/await
//  - NO optional chaining / nullish / object spread
//  - NO template literals (backticks)
//
// Requires:
//  - scripts/boss/boss-templates.js exporting BOSS_TEMPLATES
//  - scripts/boss/boss-powers.js exporting BOSS_POWERS and BOSS_POWER_PACKS

import { BOSS_TEMPLATES } from "./boss-templates.js";
import { BOSS_POWERS, BOSS_POWER_PACKS } from "./boss-powers.js";

(() => {
  const TAG = "[bbttcc-raid/boss-builder]";
  const log  = function(){ console.log.apply(console, [TAG].concat([].slice.call(arguments))); };
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

  function num(v, d) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (d === undefined ? 0 : d);
  }

  function uniq(arr) {
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

  function normalizeStats(stats) {
    const src = (stats && typeof stats === "object") ? clone(stats) : {};
    const out = {};
    for (let i=0; i<OP_KEYS.length; i++) {
      const k = OP_KEYS[i];
      if (k === "softpower") out[k] = num(src.softpower !== undefined ? src.softpower : src.softPower, 0);
      else out[k] = num(src[k], 0);
    }
    return out;
  }

  function esc(s){
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const SETTING_DEFS  = "bossDefsCustom";
  const SETTING_STATE = "bossState";

  const BaseApp = (foundry && foundry.applications && foundry.applications.api && foundry.applications.api.ApplicationV2)
    ? foundry.applications.api.ApplicationV2
    : Application;

  const HbsMixin = (foundry && foundry.applications && foundry.applications.api && foundry.applications.api.HandlebarsApplicationMixin)
    ? foundry.applications.api.HandlebarsApplicationMixin
    : null;

  const RenderableBase = HbsMixin ? HbsMixin(BaseApp) : BaseApp;

  // ------------------------------- utilities --------------------------------

  function safeGetSetting(key, fallback) {
    try { return game.settings.get("bbttcc-raid", key); }
    catch (e) { return fallback; }
  }

  function safeSetSetting(key, value) {
    try { return game.settings.set("bbttcc-raid", key, value); }
    catch (e) { return Promise.resolve(null); }
  }

  function clone(obj) {
    try { return JSON.parse(JSON.stringify(obj || {})); }
    catch (e) { return {}; }
  }

  function normKey(s) {
    s = String(s || "").trim().toLowerCase();
    s = s.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    return s;
  }

  function nowStamp() {
    try { return new Date().toLocaleString(); }
    catch (e) { return String(Date.now()); }
  }

  function tryParseJson(text, fallback) {
    try {
      if (text == null || String(text).trim() === "") return fallback;
      return JSON.parse(String(text));
    } catch (e) {
      return fallback;
    }
  }

  function bossApi() {
    try { return game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid && game.bbttcc.api.raid.boss; }
    catch (e) { return null; }
  }

  function ensureRaidApiLists() {
    try {
      if (!game.bbttcc) game.bbttcc = {};
      if (!game.bbttcc.api) game.bbttcc.api = {};
      if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};
      game.bbttcc.api.raid.bossTemplates = BOSS_TEMPLATES;
      game.bbttcc.api.raid.bossPowers = BOSS_POWERS;
      game.bbttcc.api.raid.bossPowerPacks = BOSS_POWER_PACKS;
    } catch (e) {}
  }

  function defaultBossDraft(key) {
    return {
      key: key || "new_boss",
      label: "New Boss",
      mode: "hybrid",
      moraleHits: 0,
      tags: "",
      hitTrack: "shaken, wounded, broken, banished",
      stats: normalizeStats({}),
      maneuverKeys: [],
      behaviors: []
    };
  }

  function encodeStats(statsObj) { return JSON.stringify(normalizeStats(statsObj || {}), null, 2); }
  function encodeBehaviors(arr) { return JSON.stringify(Array.isArray(arr) ? arr : [], null, 2); }

  function findTemplate(key) {
    for (let i=0; i<BOSS_TEMPLATES.length; i++) if (BOSS_TEMPLATES[i].key === key) return BOSS_TEMPLATES[i];
    return null;
  }
  function findPower(key) {
    for (let i=0; i<BOSS_POWERS.length; i++) if (BOSS_POWERS[i].key === key) return BOSS_POWERS[i];
    return null;
  }
  function findPack(key) {
    for (let i=0; i<BOSS_POWER_PACKS.length; i++) if (BOSS_POWER_PACKS[i].key === key) return BOSS_POWER_PACKS[i];
    return null;
  }

  function behaviorIdent(b) {
    if (!b) return "";
    if (b.powerKey) return String(b.powerKey);
    if (b.key) return String(b.key);
    if (b.id) return String(b.id);
    return "";
  }

  function stripBehaviorsByIdent(arr, ident) {
    ident = String(ident || "");
    const out = [];
    const a = Array.isArray(arr) ? arr : [];
    for (let i=0; i<a.length; i++) {
      const b = a[i];
      const k = behaviorIdent(b);
      if (k && k === ident) continue;
      out.push(b);
    }
    return out;
  }

  function mapLegacyToPowerKey(arr) {
    const out = Array.isArray(arr) ? arr : [];
    let mapped = 0;

    const byId = {};
    const byKey = {};
    for (let i=0; i<BOSS_POWERS.length; i++) {
      const p = BOSS_POWERS[i];
      const pid = (p && p.behavior && p.behavior.id) ? String(p.behavior.id) : "";
      const pkey = (p && p.key) ? String(p.key) : "";
      const bkey = (p && p.behavior && p.behavior.key) ? String(p.behavior.key) : "";
      if (pid) byId[pid] = pkey;
      if (bkey) byKey[bkey] = pkey;
    }

    for (let i=0; i<out.length; i++) {
      const b = out[i];
      if (!b || b.powerKey) continue;

      const legacy = b.key ? String(b.key) : (b.id ? String(b.id) : "");
      if (!legacy) continue;

      if (findPower(legacy)) { b.powerKey = legacy; mapped++; continue; }
      if (byId[legacy])      { b.powerKey = byId[legacy]; mapped++; continue; }
      if (byKey[legacy])     { b.powerKey = byKey[legacy]; mapped++; continue; }
    }

    return { arr: out, mapped: mapped };
  }


  function collectManeuvers() {
    const out = [];
    const seen = {};

    function push(row) {
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
    } catch (e) {}

    try {
      const agent = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.agent ? game.bbttcc.api.agent : null;
      const throughput = agent && agent.__THROUGHPUT ? agent.__THROUGHPUT : {};
      for (const key in throughput) {
        if (!Object.prototype.hasOwnProperty.call(throughput, key)) continue;
        push({ key: key, label: key.replace(/_/g, " ").replace(/\\b\\w/g, function(m){ return m.toUpperCase(); }), wired: true, live: false });
      }
      const fn = agent && agent.registry && typeof agent.registry.maneuvers === "function" ? agent.registry.maneuvers : null;
      if (fn) {
        const rows = fn({ source: "merged" }) || [];
        if (Array.isArray(rows)) for (let i=0; i<rows.length; i++) push(rows[i]);
      }
    } catch (e2) {}

    out.sort(function(a, b) {
      if ((a.live ? 1 : 0) !== (b.live ? 1 : 0)) return (b.live ? 1 : 0) - (a.live ? 1 : 0);
      if ((a.wired ? 1 : 0) !== (b.wired ? 1 : 0)) return (b.wired ? 1 : 0) - (a.wired ? 1 : 0);
      if (num(a.tier, 0) !== num(b.tier, 0)) return num(a.tier, 0) - num(b.tier, 0);
      return String(a.label || a.key).localeCompare(String(b.label || b.key));
    });

    return out;
  }

  function inferPowerKey(behavior) {
    const b = behavior || {};
    if (b.powerKey && findPower(b.powerKey)) return String(b.powerKey);
    const legacy = behaviorIdent(b);
    if (legacy && findPower(legacy)) return String(legacy);

    for (let i=0; i<BOSS_POWERS.length; i++) {
      const p = BOSS_POWERS[i] || {};
      const pb = p.behavior || {};
      if (pb.id && b.id && String(pb.id) === String(b.id)) return String(p.key || "");
      if (pb.key && b.key && String(pb.key) === String(b.key)) return String(p.key || "");
      if (pb.label && b.label && String(pb.label) === String(b.label)) return String(p.key || "");
    }
    return "";
  }

  function cloneBehaviorFromPower(key) {
    const p = findPower(key);
    if (!p) return null;
    const row = clone(p.behavior || {});
    row.powerKey = String(p.key || key || "");
    return row;
  }

  function buildPowerPreview(behaviors) {
    const chips = [];
    const note = { total: 0, recognized: 0, custom: 0 };

    const arr = Array.isArray(behaviors) ? behaviors : [];
    note.total = arr.length;

    const counts = {};
    for (let i=0; i<arr.length; i++) {
      const b = arr[i] || {};
      const k = behaviorIdent(b);
      if (!k) continue;
      counts[k] = (counts[k] || 0) + 1;
    }

    const keys = Object.keys(counts).sort();
    for (let i=0; i<keys.length; i++) {
      const k = keys[i];
      const p = findPower(k);
      const label = p ? (p.label || k) : k;
      const known = !!p;
      chips.push({ key: k, label: label, count: counts[k], known: known });
      if (known) note.recognized += 1;
    }

    let custom = 0;
    for (let i=0; i<arr.length; i++) {
      const b = arr[i] || {};
      const k = behaviorIdent(b);
      if (!k) { custom++; continue; }
      if (!findPower(k)) custom++;
    }
    note.custom = custom;

    return { chips: chips, note: note };
  }

  // ------------------------------ registry I/O -------------------------------

  function listRegistryBosses() {
    const out = [];
    try {
      const api = bossApi();
      if (api && typeof api.list === "function") {
        const items = api.list();
        if (Array.isArray(items)) for (let i=0; i<items.length; i++) out.push(items[i]);
      }
    } catch (e) {}
    return out;
  }

  function getRegistryBoss(key) {
    try {
      const api = bossApi();
      if (!api) return null;
      if (typeof api.get === "function") return api.get(key);
      if (typeof api.getBoss === "function") return api.getBoss(key);
    } catch (e) {}
    return null;
  }

  function registerBoss(def) {
    try {
      const api = bossApi();
      if (!api) return false;
      if (typeof api.registerBoss === "function") { api.registerBoss(def.key, def); return true; }
      if (api.bosses && typeof api.bosses === "object") { api.bosses[def.key] = def; return true; }
    } catch (e) { warn("registerBoss failed", e); }
    return false;
  }

  function unregisterBoss(key) {
    try {
      const api = bossApi();
      if (!api) return false;
      if (typeof api.unregisterBoss === "function") { api.unregisterBoss(key); return true; }
    } catch (e) {}
    return false;
  }

  function registerCustomIntoRegistry(customMap) {
    const keys = Object.keys(customMap || {});
    for (let i=0; i<keys.length; i++) {
      const k = keys[i];
      const def = customMap[k];
      if (!def || !def.key) continue;
      registerBoss(def);
    }
  }

  // ------------------------------ file import --------------------------------

  function readFileAsText(file, cb) {
    try {
      const reader = new FileReader();
      reader.onload = function() { cb(null, String(reader.result || "")); };
      reader.onerror = function(err) { cb(err || new Error("read failed"), null); };
      reader.readAsText(file);
    } catch (e) {
      cb(e, null);
    }
  }

  // ------------------------------ Application --------------------------------

  class BossConfigApp extends RenderableBase {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(
      foundry.utils.deepClone(super.DEFAULT_OPTIONS || {}),
      {
      id: "bbttcc-boss-builder",
      classes: ["bbttcc", "bbttcc-boss-builder"],
      tag: "form",
      window: { title: "Boss Builder", resizable: true },
      position: { width: 1100, height: 860 },
      actions: {},
      form: { handler: undefined, submitOnChange: false, closeOnSubmit: false }
    },
      { inplace: false }
    );

    static get PARTS() {
      return [{ id: "main", template: "modules/bbttcc-raid/templates/boss-config-app.hbs" }];
    }

    constructor(opts) {
      super(opts || {});
      this._selectedKey = null;
      this._draft = null;
      this._dirty = false;

      this._templateKey = "";
      this._powerKey = "";
      this._packKey = "";
    }

    _getCustomMap() {
      const defs = safeGetSetting(SETTING_DEFS, {});
      return (defs && typeof defs === "object") ? defs : {};
    }

    _setCustomMap(map) {
      map = (map && typeof map === "object") ? map : {};
      return safeSetSetting(SETTING_DEFS, map);
    }

    _pickDefaultKey() {
      const reg = listRegistryBosses();
      for (let i=0; i<reg.length; i++) if (reg[i] && reg[i].key === "gloomgill") return "gloomgill";
      if (reg.length) return reg[0].key;
      const custom = this._getCustomMap();
      const keys = Object.keys(custom);
      if (keys.length) return keys[0];
      return null;
    }

    _ensureSelection() {
      if (!this._selectedKey) this._selectedKey = this._pickDefaultKey();
      if (!this._selectedKey) {
        const k = this._uniqueKey("new_boss");
        this._draft = defaultBossDraft(k);
        this._selectedKey = k;
        this._dirty = true;
      }
    }

    _uniqueKey(base) {
      base = normKey(base || "new_boss") || "new_boss";
      const custom = this._getCustomMap();

      const exists = function(k) {
        if (custom && custom[k]) return true;
        const reg = listRegistryBosses();
        for (let i=0; i<reg.length; i++) if (reg[i] && reg[i].key === k) return true;
        return false;
      };

      if (!exists(base)) return base;

      let n = 2;
      while (n < 1000) {
        const k = base + "_" + n;
        if (!exists(k)) return k;
        n++;
      }
      return base + "_" + Date.now();
    }

    _isCustomKey(key) {
      const custom = this._getCustomMap();
      return !!(custom && custom[key]);
    }

    _loadBossDef(key) {
      if (this._draft && this._draft.key === key) return clone(this._draft);
      const custom = this._getCustomMap();
      let out = null;
      if (custom && custom[key]) out = clone(custom[key]);
      else {
        const def = getRegistryBoss(key);
        if (def) out = clone(def);
      }
      if (!out) out = defaultBossDraft(key);
      out.stats = normalizeStats(out.stats || {});
      out.maneuverKeys = uniq(out.maneuverKeys || []);
      return out;
    }

    _getBossState(key, hitTrackCsv) {
      const map = safeGetSetting(SETTING_STATE, {});
      const st = (map && typeof map === "object" && map[key]) ? map[key] : {};
      return {
        damageStep: Number(st.damageStep || 0),
        damageState: String(st.damageState || ""),
        hitTrack: String(st.hitTrack || hitTrackCsv || ""),
        updated: st.updated ? String(st.updated) : ""
      };
    }

    _resetBossState(key, hitTrackCsv) {
      const map = safeGetSetting(SETTING_STATE, {});
      const next = (map && typeof map === "object") ? clone(map) : {};
      next[key] = {
        damageStep: 0,
        damageState: (String(hitTrackCsv || "").split(",")[0] || "").trim(),
        hitTrack: String(hitTrackCsv || ""),
        updated: nowStamp()
      };
      return safeSetSetting(SETTING_STATE, next);
    }

    _clearBossState(key) {
      const map = safeGetSetting(SETTING_STATE, {});
      if (!map || typeof map !== "object" || !map[key]) return Promise.resolve(null);
      const next = clone(map);
      delete next[key];
      return safeSetSetting(SETTING_STATE, next);
    }

    _collectBossOptions() {
      const options = [];

      const reg = listRegistryBosses();
      for (let i=0; i<reg.length; i++) {
        const it = reg[i];
        if (!it || !it.key) continue;
        options.push({ key: it.key, label: it.label || it.key, selected: (it.key === this._selectedKey) });
      }

      const custom = this._getCustomMap();
      const keys = Object.keys(custom || {}).sort();
      for (let i=0; i<keys.length; i++) {
        const k = keys[i];
        const it = custom[k];
        if (!it || !it.key) continue;

        let dup = false;
        for (let j=0; j<options.length; j++) if (options[j].key === k) { dup = true; break; }
        if (dup) continue;

        options.push({ key: it.key, label: (it.label || it.key) + " (custom)", selected: (it.key === this._selectedKey) });
      }

      if (this._draft && this._draft.key) {
        let has = false;
        for (let j=0; j<options.length; j++) if (options[j].key === this._draft.key) { has = true; break; }
        if (!has) options.unshift({ key: this._draft.key, label: (this._draft.label || this._draft.key) + " (draft)", selected: (this._draft.key === this._selectedKey) });
      }

      for (let i=0; i<options.length; i++) options[i].selected = (options[i].key === this._selectedKey);
      return options;
    }

    _collectTemplateOptions() {
      const out = [];
      for (let i=0; i<BOSS_TEMPLATES.length; i++) out.push({ key: BOSS_TEMPLATES[i].key, label: BOSS_TEMPLATES[i].label });
      return out;
    }

    _collectPowerOptions() {
      const out = [];
      for (let i=0; i<BOSS_POWERS.length; i++) out.push({ key: BOSS_POWERS[i].key, label: BOSS_POWERS[i].label });
      return out;
    }

    _collectPackOptions() {
      const out = [];
      for (let i=0; i<BOSS_POWER_PACKS.length; i++) out.push({ key: BOSS_POWER_PACKS[i].key, label: BOSS_POWER_PACKS[i].label });
      return out;
    }

    _prepareContext(_opts) {
      this._ensureSelection();
      ensureRaidApiLists();

      const boss = this._loadBossDef(this._selectedKey);
      const state = this._getBossState(boss.key, boss.hitTrack);
      const preview = buildPowerPreview(boss.behaviors);

      return {
        bossOptions: this._collectBossOptions(),
        templateOptions: this._collectTemplateOptions(),
        powerOptions: this._collectPowerOptions(),
        packOptions: this._collectPackOptions(),
        boss: {
          key: boss.key || "",
          label: boss.label || "",
          mode: boss.mode || "hybrid",
          moraleHits: Number(boss.moraleHits || 0),
          tags: (Array.isArray(boss.tags) ? boss.tags.join(", ") : String(boss.tags || "")),
          hitTrack: (Array.isArray(boss.hitTrack) ? boss.hitTrack.join(", ") : String(boss.hitTrack || "")),
          statsRaw: encodeStats(boss.stats),
          behaviorsRaw: encodeBehaviors(boss.behaviors),
          maneuverKeysCsv: uniq(boss.maneuverKeys || []).join(", ")
        },
        state: {
          damageStep: state.damageStep,
          damageState: state.damageState,
          hitTrack: state.hitTrack,
          updated: state.updated
        },
        previewPowers: preview.chips,
        previewNote: preview.note
      };
    }

    _readBossFromForm(root) {
      const q = function(sel){ return (root && root.querySelector) ? root.querySelector(sel) : null; };

      const keyRaw = q('input[name="boss.key"]') ? q('input[name="boss.key"]').value : "";
      const label = q('input[name="boss.label"]') ? q('input[name="boss.label"]').value : "Boss";
      const mode = q('select[name="boss.mode"]') ? q('select[name="boss.mode"]').value : "hybrid";
      const moraleHits = q('input[name="boss.moraleHits"]') ? Number(q('input[name="boss.moraleHits"]').value || 0) : 0;
      const tags = q('input[name="boss.tags"]') ? q('input[name="boss.tags"]').value : "";
      const hitTrack = q('input[name="boss.hitTrack"]') ? q('input[name="boss.hitTrack"]').value : "";

      const statsRaw = q('textarea[name="boss.statsRaw"]') ? q('textarea[name="boss.statsRaw"]').value : "{}";
      const behRaw = q('textarea[name="boss.behaviorsRaw"]') ? q('textarea[name="boss.behaviorsRaw"]').value : "[]";
      const mansCsv = q('input[name="boss.maneuverKeysCsv"]') ? q('input[name="boss.maneuverKeysCsv"]').value : "";

      const stats = normalizeStats(tryParseJson(statsRaw, {}));
      const behaviors = tryParseJson(behRaw, []);
      const maneuverKeys = uniq(String(mansCsv || "").split(","));

      return {
        keyRaw: keyRaw,
        key: normKey(keyRaw),
        label: String(label || ""),
        mode: String(mode || "hybrid"),
        moraleHits: Number(moraleHits || 0),
        tags: String(tags || ""),
        hitTrack: String(hitTrack || ""),
        stats: (stats && typeof stats === "object") ? normalizeStats(stats) : normalizeStats({}),
        maneuverKeys: maneuverKeys,
        behaviors: Array.isArray(behaviors) ? behaviors : []
      };
    }

    _ensureEditableDraftFromSelection() {
      if (this._draft && this._draft.key === this._selectedKey) return;

      if (this._isCustomKey(this._selectedKey)) {
        this._draft = this._loadBossDef(this._selectedKey);
        return;
      }

      const base = String(this._selectedKey || "boss") + "_custom";
      const k = this._uniqueKey(base);
      const def = this._loadBossDef(this._selectedKey);
      def.key = k;
      if (def.label && def.label.indexOf("(Custom)") === -1) def.label = def.label + " (Custom)";
      this._draft = def;
      this._selectedKey = k;
      this._dirty = true;
    }

    // ----------------------------- actions ----------------------------------

    _onNew() {
      const self = this;
      if (this._dirty) {
        Dialog.confirm({
          title: "Discard unsaved changes?",
          content: "<p>You have unsaved edits. Creating a new boss will discard the current draft unless you save first.</p>"
        }).then(function(ok) {
          if (!ok) return;
          self._doNew();
        });
        return;
      }
      this._doNew();
    }

    _doNew() {
      const key = this._uniqueKey("new_boss");
      const draft = defaultBossDraft(key);
      draft.label = "New Boss";
      this._draft = draft;
      this._selectedKey = key;
      this._dirty = true;
      this.render(true);
    }

    _onDelete() {
      const self = this;
      const key = String(this._selectedKey || "");
      if (!key) return;

      const custom = this._getCustomMap();
      const isCustom = !!(custom && custom[key]);
      if (!isCustom) {
        ui.notifications.warn("You can only delete custom bosses created in this world.");
        return;
      }

      Dialog.confirm({
        title: "Delete Boss",
        content: "<p>Delete <b>" + key + "</b> from this world? This will also remove it from the Raid Boss list.</p>"
      }).then(function(ok) {
        if (!ok) return;

        delete custom[key];
        self._setCustomMap(custom).then(function() {
          unregisterBoss(key);
          self._clearBossState(key).then(function() {
            self._draft = null;
            self._dirty = false;
            self._selectedKey = self._pickDefaultKey();
            self.render(true);
            ui.notifications.info("Boss deleted.");
          });
        });
      });
    }

    _onExport() {
      const key = this._selectedKey;
      if (!key) return;
      const def = this._loadBossDef(key);
      const blob = new Blob([JSON.stringify(def, null, 2)], { type: "application/json" });
      try { saveDataToFile(blob, "application/json", "bbttcc-boss-" + (def.key || "boss") + ".json"); }
      catch (e) { warn("export failed", e); ui.notifications.error("Export failed (see console)."); }
    }

    _onImport() {
      const self = this;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.onchange = function(ev) {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;

        readFileAsText(file, function(err, text) {
          if (err) {
            warn("import failed", err);
            ui.notifications.error("Import failed (read error).");
            return;
          }

          try {
            const obj = JSON.parse(text);
            const key = normKey(obj.key || obj.id || obj.name || "imported_boss");
            const uniq = self._uniqueKey(key);
            const def = defaultBossDraft(uniq);

            def.key = uniq;
            def.label = String(obj.label || obj.name || def.label);
            def.mode = String(obj.mode || def.mode);
            def.moraleHits = Number(obj.moraleHits || obj.morale_hits || def.moraleHits);
            def.tags = Array.isArray(obj.tags) ? obj.tags.join(", ") : String(obj.tags || def.tags);
            def.hitTrack = Array.isArray(obj.hitTrack) ? obj.hitTrack.join(", ") : String(obj.hitTrack || def.hitTrack);
            def.stats = normalizeStats((obj.stats && typeof obj.stats === "object") ? obj.stats : def.stats);
            def.maneuverKeys = uniq(Array.isArray(obj.maneuverKeys) ? obj.maneuverKeys : (typeof obj.maneuverKeysCsv === "string" ? obj.maneuverKeysCsv.split(",") : def.maneuverKeys));
            def.behaviors = Array.isArray(obj.behaviors) ? obj.behaviors : (Array.isArray(obj.behavior) ? obj.behavior : def.behaviors);

            self._draft = def;
            self._selectedKey = def.key;
            self._dirty = true;

            self.render(true);
            ui.notifications.info("Imported boss '" + def.label + "' as " + def.key + ".");
          } catch (e2) {
            warn("import failed", e2);
            ui.notifications.error("Import failed (invalid JSON).");
          }
        });
      };
      input.click();
    }

    _onSave() {
      const self = this;
      const host = this.element;
      const formEl = (host && host.querySelector) ? (host.querySelector("form.bbttcc-boss-config-form") || host) : host;

      const curKey = String(this._selectedKey || "");
      const custom = this._getCustomMap();
      const wasCustom = !!(custom && custom[curKey]);

      const formBoss = this._readBossFromForm(formEl);
      let desired = formBoss.key || normKey(curKey || "boss");
      if (!desired) desired = normKey(curKey || "boss");

      let finalKey = desired;
      const unchanged = (normKey(curKey) === normKey(desired));
      const isRename = wasCustom && !unchanged;

      // collision check if changed
      if (!unchanged) {
        const collidesCustom = !!(custom && custom[finalKey]);
        const reg = listRegistryBosses();
        let collidesReg = false;
        for (let i=0; i<reg.length; i++) if (String(reg[i] && reg[i].key || "") === String(finalKey)) { collidesReg = true; break; }
        if (collidesCustom || collidesReg) finalKey = this._uniqueKey(finalKey);
      }

      // saving a registry boss => force custom key
      if (!wasCustom && curKey && String(curKey) === String(desired) && getRegistryBoss(curKey)) {
        finalKey = this._uniqueKey(String(desired) + "_custom");
      }

      const def = {
        key: finalKey,
        label: String(formBoss.label || finalKey),
        mode: String(formBoss.mode || "hybrid"),
        moraleHits: Number(formBoss.moraleHits || 0),
        tags: String(formBoss.tags || ""),
        hitTrack: String(formBoss.hitTrack || ""),
        stats: (formBoss.stats && typeof formBoss.stats === "object") ? normalizeStats(formBoss.stats) : normalizeStats({}),
        maneuverKeys: uniq(formBoss.maneuverKeys || []),
        behaviors: Array.isArray(formBoss.behaviors) ? formBoss.behaviors : []
      };

      // rename semantics
      if (isRename) {
        delete custom[curKey];
        unregisterBoss(curKey);
        this._clearBossState(curKey).then(function(){ /* noop */ });
      }

      custom[finalKey] = def;

      this._setCustomMap(custom).then(function() {
        registerCustomIntoRegistry(custom);
        self._draft = null;
        self._dirty = false;
        self._selectedKey = finalKey;
        self.render(true);

        if (isRename && finalKey !== desired) ui.notifications.info("Renamed and de-conflicted -> " + finalKey);
        else if (isRename) ui.notifications.info("Renamed -> " + finalKey);
        else ui.notifications.info("Saved boss '" + def.label + "' (" + def.key + ").");
      });
    }

    _onApplyTemplate() {
      const self = this;
      const tkey = String(this._templateKey || "");
      if (!tkey) { ui.notifications.warn("Pick a template first."); return; }

      const tpl = findTemplate(tkey);
      if (!tpl) { ui.notifications.error("Template not found."); return; }

      Dialog.confirm({
        title: "Apply Template",
        content: "<p>Apply <b>" + tpl.label + "</b> to the current boss draft? This overwrites mode, hit track, tags, stats, and behaviors.</p>"
      }).then(function(ok) {
        if (!ok) return;

        self._ensureEditableDraftFromSelection();

        const d = self._draft || defaultBossDraft(self._selectedKey);
        const defs = tpl.defaults || {};

        d.mode = String(defs.mode || d.mode || "hybrid");
        d.hitTrack = String(defs.hitTrack || d.hitTrack || "");
        d.tags = String(defs.tags || d.tags || "");
        d.stats = normalizeStats(defs.stats || d.stats || {});
        d.maneuverKeys = uniq(Array.isArray(defs.maneuverKeys) ? defs.maneuverKeys : (d.maneuverKeys || []));
        d.behaviors = clone(defs.behaviors || []);

        if (!d.label || d.label === "New Boss") d.label = tpl.label;

        self._draft = d;
        self._dirty = true;
        self.render(true);
        ui.notifications.info("Template applied: " + tpl.label);
      });
    }

    _onAddPower(root) {
      const self = this;
      const pkey = String(this._powerKey || "");
      if (!pkey) { ui.notifications.warn("Pick a boss power first."); return; }

      const p = findPower(pkey);
      if (!p) { ui.notifications.error("Boss power not found."); return; }

      this._ensureEditableDraftFromSelection();

      const host = this.element;
      const formEl = (host && host.querySelector) ? (host.querySelector("form.bbttcc-boss-config-form") || host) : host;
      const current = this._readBossFromForm(formEl);

      const behaviors = Array.isArray(current.behaviors) ? current.behaviors : [];
      const entry = clone(p.behavior || {});
      entry.powerKey = p.key;
      behaviors.push(entry);

      current.key = this._draft.key;
      current.behaviors = behaviors;

      this._draft = current;
      this._dirty = true;
      this.render(true);
      ui.notifications.info("Added power: " + p.label);
    }

    _onApplyPack(root) {
      const self = this;
      const pkey = String(this._packKey || "");
      if (!pkey) { ui.notifications.warn("Pick a power pack first."); return; }

      const pack = findPack(pkey);
      if (!pack) { ui.notifications.error("Power pack not found."); return; }

      Dialog.confirm({
        title: "Apply Power Pack",
        content: "<p>Apply <b>" + pack.label + "</b>? This appends powers to the behaviors list and skips duplicates by powerKey.</p>"
      }).then(function(ok) {
        if (!ok) return;

        self._ensureEditableDraftFromSelection();

        const host = self.element;
        const formEl = (host && host.querySelector) ? (host.querySelector("form.bbttcc-boss-config-form") || host) : host;
        const current = self._readBossFromForm(formEl);
        const behaviors = Array.isArray(current.behaviors) ? current.behaviors : [];

        const existing = {};
        for (let i=0; i<behaviors.length; i++) {
          const k = behaviors[i] && behaviors[i].powerKey ? String(behaviors[i].powerKey) : "";
          if (k) existing[k] = true;
        }

        let added = 0;
        const keys = Array.isArray(pack.powers) ? pack.powers : [];
        for (let i=0; i<keys.length; i++) {
          const k = String(keys[i] || "");
          if (!k || existing[k]) continue;
          const p = findPower(k);
          if (!p) continue;
          const entry = clone(p.behavior || {});
          entry.powerKey = p.key;
          behaviors.push(entry);
          existing[k] = true;
          added++;
        }

        current.key = self._draft.key;
        current.behaviors = behaviors;

        self._draft = current;
        self._dirty = true;
        self.render(true);
        ui.notifications.info("Applied pack: " + pack.label + " (+" + added + ").");
      });
    }

    _setDesc(el, text) {
      try { if (el) el.textContent = String(text || ""); } catch (e) {}
    }


    _nativeBossBuilderState() {
      if (!this.__bbttccBossBuilderState) this.__bbttccBossBuilderState = {};
      return this.__bbttccBossBuilderState;
    }

    _syncNativeStateFromDom(root) {
      const st = this._nativeBossBuilderState();
      const q = function(sel){ return (root && root.querySelector) ? root.querySelector(sel) : null; };
      const statsTxt = q('textarea[name="boss.statsRaw"]');
      const behTxt = q('textarea[name="boss.behaviorsRaw"]');
      const docInput = q('input[name="boss.maneuverKeysCsv"]');
      if (!st.stats) st.stats = normalizeStats(tryParseJson(statsTxt ? statsTxt.value : "{}", {}));
      if (!st.behaviors) st.behaviors = tryParseJson(behTxt ? behTxt.value : "[]", []);
      if (!st.maneuverKeys) st.maneuverKeys = uniq(String(docInput ? docInput.value : "").split(","));
      return st;
    }

    _renderNativeEditors(root) {
      const self = this;
      const st = this._syncNativeStateFromDom(root);
      const q = function(sel){ return (root && root.querySelector) ? root.querySelector(sel) : null; };
      const statsTxt = q('textarea[name="boss.statsRaw"]');
      const behTxt = q('textarea[name="boss.behaviorsRaw"]');
      if (!statsTxt || !behTxt) return;

      statsTxt.style.display = "none";
      behTxt.style.display = "none";

      let docInput = q('input[name="boss.maneuverKeysCsv"]');
      if (!docInput) {
        docInput = document.createElement("input");
        docInput.type = "hidden";
        docInput.name = "boss.maneuverKeysCsv";
        const form = q("form.bbttcc-boss-config-form") || q("form") || root;
        form.appendChild(docInput);
      }

      st.stats = normalizeStats(st.stats || {});
      st.behaviors = Array.isArray(st.behaviors) ? st.behaviors : [];
      st.maneuverKeys = uniq(st.maneuverKeys || []);
      statsTxt.value = encodeStats(st.stats);
      behTxt.value = JSON.stringify(st.behaviors, null, 2);
      docInput.value = st.maneuverKeys.join(", ");

      let statsBox = q('[data-role="bbttcc-boss-stats-box"]');
      if (!statsBox) {
        statsBox = document.createElement("div");
        statsBox.setAttribute("data-role", "bbttcc-boss-stats-box");
        statsBox.style.display = "grid";
        statsBox.style.gridTemplateColumns = "repeat(3, minmax(120px, 1fr))";
        statsBox.style.gap = ".5rem";
        statsBox.style.marginTop = ".4rem";
        statsTxt.parentNode.insertBefore(statsBox, statsTxt.nextSibling);
      }
      let statsHtml = "";
      for (let i=0; i<OP_KEYS.length; i++) {
        const k = OP_KEYS[i];
        statsHtml += "<label><div>" + esc(OP_LABELS[k] || k) + "</div><input type='number' data-boss-stat='" + esc(k) + "' value='" + esc(String(st.stats[k] || 0)) + "'/></label>";
      }
      statsBox.innerHTML = statsHtml;

      let doctrineBox = q('[data-role="bbttcc-boss-doctrine-box"]');
      if (!doctrineBox) {
        doctrineBox = document.createElement("div");
        doctrineBox.setAttribute("data-role", "bbttcc-boss-doctrine-box");
        doctrineBox.style.marginTop = ".8rem";
        const anchor = q("[data-role='powers-preview-note']") || q("[data-role='powers-preview']") || behTxt.parentNode;
        if (anchor && anchor.parentNode) anchor.parentNode.appendChild(doctrineBox);
      }
      const mans = collectManeuvers();
      const active = {};
      for (let i=0; i<st.maneuverKeys.length; i++) active[st.maneuverKeys[i]] = true;
      let docHtml = "<div style='display:flex; align-items:center; justify-content:space-between; gap:.5rem;'><b>Boss Maneuver Doctrine</b><small style='opacity:.72;'>Currently wired maneuvers</small></div>";
      docHtml += "<div style='display:grid; grid-template-columns:repeat(2, minmax(240px, 1fr)); gap:.3rem .75rem; margin-top:.35rem; max-height:240px; overflow:auto;'>";
      for (let i=0; i<mans.length; i++) {
        const m = mans[i] || {};
        const tags = [];
        if (m.tier) tags.push("T" + m.tier);
        if (m.live) tags.push("live"); else if (m.wired) tags.push("wired");
        if (m.availability) tags.push(m.availability);
        docHtml += "<label style='display:flex; align-items:center; gap:.35rem;'><input type='checkbox' data-boss-doctrine='" + esc(String(m.key || "")) + "'" + (active[String(m.key || "")] ? " checked" : "") + "/><span>" + esc(String(m.label || m.key || "")) + "</span><small style='opacity:.72;'>" + esc(tags.join(" • ")) + "</small></label>";
      }
      docHtml += "</div>";
      if (st.maneuverKeys.length) {
        docHtml += "<div style='display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.4rem;'>";
        for (let i=0; i<st.maneuverKeys.length; i++) {
          const key = st.maneuverKeys[i];
          let hit = null;
          for (let j=0; j<mans.length; j++) if (String(mans[j].key || "") === String(key || "")) { hit = mans[j]; break; }
          docHtml += "<span style='display:inline-flex; align-items:center; gap:.25rem; padding:.15rem .45rem; border-radius:999px; border:1px solid rgba(148,163,184,.35); background:" + (hit && hit.live ? "rgba(34,197,94,.12)" : "rgba(59,130,246,.10)") + ";'>" + esc(String(hit ? (hit.label || key) : key)) + "</span>";
        }
        docHtml += "</div>";
      } else {
        docHtml += "<div style='margin-top:.35rem; opacity:.72;'>No doctrine maneuvers selected yet.</div>";
      }
      doctrineBox.innerHTML = docHtml;

      let powerBox = q('[data-role="bbttcc-boss-power-box"]');
      if (!powerBox) {
        powerBox = document.createElement("div");
        powerBox.setAttribute("data-role", "bbttcc-boss-power-box");
        powerBox.style.display = "flex";
        powerBox.style.flexDirection = "column";
        powerBox.style.gap = ".45rem";
        powerBox.style.marginTop = ".6rem";
        behTxt.parentNode.insertBefore(powerBox, behTxt.nextSibling);
      }
      let powerHtml = "<div style='display:flex; align-items:center; justify-content:space-between; gap:.5rem;'><b>Boss Powers</b><button type='button' data-boss-act='add-power'>Add Power</button></div>";
      if (!st.behaviors.length) powerHtml += "<div style='opacity:.75;'>No boss powers selected yet.</div>";
      for (let i=0; i<st.behaviors.length; i++) {
        const pk = inferPowerKey(st.behaviors[i]);
        powerHtml += "<div style='display:grid; grid-template-columns:minmax(220px,1fr) auto auto auto; gap:.35rem; align-items:center;'>";
        powerHtml += "<select data-boss-power-idx='" + i + "'><option value=''>Select Canonical Power…</option>";
        for (let j=0; j<BOSS_POWERS.length; j++) {
          const p = BOSS_POWERS[j] || {};
          const sel = (String(pk || "") === String(p.key || "")) ? " selected" : "";
          powerHtml += "<option value='" + esc(String(p.key || "")) + "'" + sel + ">" + esc(String(p.label || p.key || "")) + "</option>";
        }
        powerHtml += "</select>";
        powerHtml += "<button type='button' data-boss-act='move-up' data-boss-idx='" + i + "'>↑</button>";
        powerHtml += "<button type='button' data-boss-act='move-down' data-boss-idx='" + i + "'>↓</button>";
        powerHtml += "<button type='button' data-boss-act='remove-power' data-boss-idx='" + i + "'>Remove</button>";
        powerHtml += "</div>";
        if (!pk) {
          powerHtml += "<div style='font-size:11px; color:#fca5a5;'>Custom/unmapped behavior retained. Reassign it to a canonical power to make it fully structured.</div>";
        } else {
          const p = findPower(pk);
          if (p && p.description) powerHtml += "<div style='font-size:11px; color:#94a3b8;'>" + esc(String(p.description || "")) + "</div>";
        }
      }
      powerBox.innerHTML = powerHtml;

      const statInputs = root.querySelectorAll("[data-boss-stat]");
      for (let i=0; i<statInputs.length; i++) {
        statInputs[i].addEventListener("input", function(ev) {
          const k = String(ev.target.getAttribute("data-boss-stat") || "");
          st.stats[k] = num(ev.target.value, 0);
          statsTxt.value = encodeStats(st.stats);
          self._dirty = true;
        });
        statInputs[i].addEventListener("change", function(ev) {
          const k = String(ev.target.getAttribute("data-boss-stat") || "");
          st.stats[k] = num(ev.target.value, 0);
          statsTxt.value = encodeStats(st.stats);
          self._dirty = true;
        });
      }

      const doctrineChecks = root.querySelectorAll("[data-boss-doctrine]");
      for (let i=0; i<doctrineChecks.length; i++) {
        doctrineChecks[i].addEventListener("change", function(ev) {
          const k = String(ev.target.getAttribute("data-boss-doctrine") || "");
          const next = [];
          const had = {};
          for (let j=0; j<st.maneuverKeys.length; j++) {
            const x = String(st.maneuverKeys[j] || "");
            if (!x || x === k || had[x]) continue;
            had[x] = true;
            next.push(x);
          }
          if (ev.target.checked) next.push(k);
          st.maneuverKeys = uniq(next);
          docInput.value = st.maneuverKeys.join(", ");
          self._dirty = true;
          self._renderNativeEditors(root);
        });
      }

      const powerActs = root.querySelectorAll("[data-boss-act]");
      for (let i=0; i<powerActs.length; i++) {
        powerActs[i].addEventListener("click", function(ev) {
          ev.preventDefault();
          const act = String(ev.currentTarget.getAttribute("data-boss-act") || "");
          const idx = Number(ev.currentTarget.getAttribute("data-boss-idx") || -1);

          if (act === "add-power") {
            st.behaviors.push({ powerKey: "" });
          } else if (act === "remove-power" && idx >= 0 && idx < st.behaviors.length) {
            st.behaviors.splice(idx, 1);
          } else if (act === "move-up" && idx > 0 && idx < st.behaviors.length) {
            const row = st.behaviors[idx];
            st.behaviors[idx] = st.behaviors[idx - 1];
            st.behaviors[idx - 1] = row;
          } else if (act === "move-down" && idx >= 0 && idx < st.behaviors.length - 1) {
            const row2 = st.behaviors[idx];
            st.behaviors[idx] = st.behaviors[idx + 1];
            st.behaviors[idx + 1] = row2;
          }
          behTxt.value = JSON.stringify(st.behaviors, null, 2);
          self._dirty = true;
          self._renderNativeEditors(root);
        });
      }

      const powerSelects = root.querySelectorAll("[data-boss-power-idx]");
      for (let i=0; i<powerSelects.length; i++) {
        powerSelects[i].addEventListener("change", function(ev) {
          const idx = Number(ev.target.getAttribute("data-boss-power-idx") || -1);
          const key = String(ev.target.value || "");
          if (idx < 0 || idx >= st.behaviors.length) return;
          if (!key) st.behaviors[idx] = st.behaviors[idx] || { powerKey: "" };
          else st.behaviors[idx] = cloneBehaviorFromPower(key) || { powerKey: key };
          behTxt.value = JSON.stringify(st.behaviors, null, 2);
          self._dirty = true;
          self._renderNativeEditors(root);
        });
      }
    }

    _bindEvents(root) {
      const self = this;
      try { self._renderNativeEditors(root); } catch (e0) { warn("native editor render failed", e0); }

      function renderPreviewFromForm() {
        try {
          const txtEl = root.querySelector('textarea[name="boss.behaviorsRaw"]');
          const txt = txtEl ? txtEl.value : "[]";
          const arr = tryParseJson(txt, []);
          const prev = buildPowerPreview(arr);

          const host = root.querySelector("[data-role='powers-preview']");
          const noteEl = root.querySelector("[data-role='powers-preview-note']");
          if (!host) return;

          host.innerHTML = "";

          for (let i=0; i<prev.chips.length; i++) {
            const c = prev.chips[i];

            const chip = document.createElement("span");
            chip.className = "bbttcc-chip";
            chip.style.display = "inline-flex";
            chip.style.alignItems = "center";
            chip.style.gap = ".35rem";
            chip.style.padding = ".15rem .45rem";
            chip.style.borderRadius = "999px";
            chip.style.fontSize = "11px";
            chip.style.letterSpacing = ".02em";
            chip.style.border = "1px solid rgba(148,163,184,.35)";
            chip.style.background = c.known ? "rgba(59,130,246,.10)" : "rgba(148,163,184,.08)";
            chip.style.cursor = "pointer";

            const label = document.createElement("span");
            label.textContent = c.label + (c.count > 1 ? (" ×" + c.count) : "");
            chip.appendChild(label);

            const rm = document.createElement("button");
            rm.type = "button";
            rm.textContent = "✕";
            rm.title = "Remove this power from behaviors";
            rm.style.border = "0";
            rm.style.background = "transparent";
            rm.style.color = "rgba(226,232,240,.9)";
            rm.style.cursor = "pointer";
            rm.style.padding = "0";
            rm.style.margin = "0";
            rm.style.lineHeight = "1";
            rm.style.fontSize = "12px";

            rm.addEventListener("click", function(ev) {
              ev.preventDefault();
              ev.stopPropagation();

              Dialog.confirm({
                title: "Remove Power",
                content: "<p>Remove <b>" + String(c.label) + "</b> from this boss? This deletes matching behavior entries from the JSON list.</p>"
              }).then(function(ok) {
                if (!ok) return;

                const current = tryParseJson(txtEl ? txtEl.value : "[]", []);
                const next = stripBehaviorsByIdent(current, c.key);
                if (txtEl) txtEl.value = JSON.stringify(next, null, 2);

                self._dirty = true;
                renderPreviewFromForm();
              });
            });

            chip.appendChild(rm);

            chip.addEventListener("click", function() {
              try {
                const current = tryParseJson(txtEl ? txtEl.value : "[]", []);
                const matches = [];
                for (let j=0; j<current.length; j++) {
                  const b = current[j];
                  if (behaviorIdent(b) === c.key) matches.push(b);
                }

                const p = findPower(c.key);
                const desc = p ? (p.description || "") : "";
                const jsonText = JSON.stringify(matches, null, 2).replace(/</g,"&lt;");
                const body = "<div style='display:flex; flex-direction:column; gap:.5rem;'>" +
                  "<div><b>" + String(c.label) + "</b></div>" +
                  (desc ? ("<div style='color:#94a3b8;'>" + String(desc) + "</div>") : "") +
                  "<textarea style='width:100%; height:220px;' spellcheck='false' readonly>" + jsonText + "</textarea>" +
                  "</div>";

                new Dialog({
                  title: "Power Inspector",
                  content: body,
                  buttons: { ok: { label: "Close" } }
                }).render(true);
              } catch (e) {}
            });

            host.appendChild(chip);
          }

          if (noteEl) {
            const parts = [];
            parts.push(prev.note.total + " behavior" + (prev.note.total === 1 ? "" : "s"));
            parts.push(prev.note.recognized + " recognized power" + (prev.note.recognized === 1 ? "" : "s"));
            if (prev.note.custom) parts.push(prev.note.custom + " custom/unmapped");
            noteEl.textContent = parts.join(" • ");
          }
        } catch (e) {}
      }

      const bossPicker = root.querySelector('[data-role="boss-picker"]');
      if (bossPicker) {
        bossPicker.addEventListener("change", function(ev) {
          const v = ev.target.value;
          if (!v) return;

          if (self._dirty) {
            Dialog.confirm({
              title: "Discard unsaved changes?",
              content: "<p>You have unsaved edits. Switching bosses will discard the current draft unless you save first.</p>"
            }).then(function(ok) {
              if (!ok) { self.render(true); return; }
              self._selectedKey = v;
              self._dirty = false;
              self._draft = null;
              self.render(true);
            });
            return;
          }

          self._selectedKey = v;
          self._dirty = false;
          self._draft = null;
          self.render(true);
        });
      }

      const tplDescEl = root.querySelector("[data-role='template-desc']");
      const powDescEl = root.querySelector("[data-role='power-desc']");
      const packDescEl = root.querySelector("[data-role='pack-desc']");

      const templatePicker = root.querySelector('[data-role="template-picker"]');
      if (templatePicker) {
        templatePicker.addEventListener("change", function(ev) {
          self._templateKey = String(ev.target.value || "");
          const tpl = self._templateKey ? findTemplate(self._templateKey) : null;
          self._setDesc(tplDescEl, tpl ? (tpl.description || "") : "");
        });
        const tpl0 = self._templateKey ? findTemplate(self._templateKey) : null;
        self._setDesc(tplDescEl, tpl0 ? (tpl0.description || "") : "");
      }

      const powerPicker = root.querySelector('[data-role="power-picker"]');
      if (powerPicker) {
        powerPicker.addEventListener("change", function(ev) {
          self._powerKey = String(ev.target.value || "");
          const p = self._powerKey ? findPower(self._powerKey) : null;
          self._setDesc(powDescEl, p ? (p.description || "") : "");
        });
        const p0 = self._powerKey ? findPower(self._powerKey) : null;
        self._setDesc(powDescEl, p0 ? (p0.description || "") : "");
      }

      const packPicker = root.querySelector('[data-role="pack-picker"]');
      if (packPicker) {
        packPicker.addEventListener("change", function(ev) {
          self._packKey = String(ev.target.value || "");
          const p = self._packKey ? findPack(self._packKey) : null;
          self._setDesc(packDescEl, p ? (p.description || "") : "");
        });
        const pk0 = self._packKey ? findPack(self._packKey) : null;
        self._setDesc(packDescEl, pk0 ? (pk0.description || "") : "");
      }

      // initial preview render
      renderPreviewFromForm();

      const buttons = root.querySelectorAll("[data-action]");
      for (let i=0; i<buttons.length; i++) {
        const btn = buttons[i];
        btn.addEventListener("click", function(ev) {
          ev.preventDefault();
          const action = btn.getAttribute("data-action");
          if (!action) return;

          if (action === "new") return self._onNew();
          if (action === "delete") return self._onDelete();
          if (action === "export") return self._onExport();
          if (action === "import") return self._onImport();
          if (action === "save") return self._onSave();
          if (action === "template-apply") return self._onApplyTemplate();
          if (action === "power-add") return self._onAddPower(root);
          if (action === "pack-apply") return self._onApplyPack(root);

          if (action === "normalize") {
            try {
              const txtEl = root.querySelector('textarea[name="boss.behaviorsRaw"]');
              const txt = txtEl ? txtEl.value : "[]";
              const arr = tryParseJson(txt, []);
              const res = mapLegacyToPowerKey(arr);
              if (txtEl) txtEl.value = JSON.stringify(res.arr, null, 2);
              self._dirty = true;
              renderPreviewFromForm();
              try { self._nativeBossBuilderState().behaviors = res.arr; self._renderNativeEditors(root); } catch (e3) {}
              ui.notifications.info("Normalize complete: mapped " + res.mapped + ".");
            } catch (e) {
              ui.notifications.error("Normalize failed (see console).");
              warn("normalize failed", e);
            }
            return;
          }

          if (action === "state-reset") {
            const key = self._selectedKey;
            const ht = root.querySelector('input[name="boss.hitTrack"]') ? root.querySelector('input[name="boss.hitTrack"]').value : "";
            self._resetBossState(key, ht).then(function() {
              ui.notifications.info("Boss state reset.");
              self.render(true);
            });
            return;
          }
        });
      }

      const behTxt = root.querySelector('textarea[name="boss.behaviorsRaw"]');
      if (behTxt) {
        behTxt.addEventListener("input", function(){ renderPreviewFromForm(); });
        behTxt.addEventListener("change", function(){ renderPreviewFromForm(); });
      }

      const dirtyFields = root.querySelectorAll('input[name^="boss."], select[name^="boss."], textarea[name^="boss."]');
      for (let i=0; i<dirtyFields.length; i++) {
        dirtyFields[i].addEventListener("change", function(){ self._dirty = true; });
        dirtyFields[i].addEventListener("input", function(){ self._dirty = true; });
      }
    }
    _onRender(context, options) {
      const self = this;
      return super._onRender(context, options).then(function(res) {
        try { self._bindEvents(self.element); }
        catch (e) { warn("bind events failed", e); }
        // Ensure the window is focused / raised when opened
        try { if (typeof self.bringToTop === "function") self.bringToTop(); } catch (e2) {}
        return res;
      });
    }
  }

  // ------------------------------ boot hooks ---------------------------------

  try { globalThis.BBTTCC_BossConfigApp = BossConfigApp; } catch (e) {}

  function attachApiOpeners() {
    try {
      if (!game.bbttcc) game.bbttcc = {};
      if (!game.bbttcc.api) game.bbttcc.api = {};
      if (!game.bbttcc.api.raid) game.bbttcc.api.raid = {};

      game.bbttcc.api.raid.BBTTCC_BossConfigApp = BossConfigApp;
      game.bbttcc.api.raid.openBossBuilder = function() {
        try {
          var app = game.bbttcc.api.raid._bossBuilderApp;
          if (!app) { app = new BossConfigApp(); game.bbttcc.api.raid._bossBuilderApp = app; }
          // Render focused; if already open, this will bring it forward
          app.render(true, { focus: true });
          try { if (typeof app.bringToTop === "function") app.bringToTop(); } catch (e2) {}
          return app;
        } catch (e) {
          return new BossConfigApp().render(true);
        }
      };
      game.bbttcc.api.raid.openBossConfig = game.bbttcc.api.raid.openBossBuilder;

      ensureRaidApiLists();
    } catch (e) {
      warn("failed to attach boss builder API", e);
    }
  }

  function ensureSettings() {
    try {
      if (!game.settings.settings.has("bbttcc-raid." + SETTING_DEFS)) {
        game.settings.register("bbttcc-raid", SETTING_DEFS, {
          name: "Boss Builder: Custom Boss Definitions",
          scope: "world",
          config: false,
          type: Object,
          default: {}
        });
      }
      if (!game.settings.settings.has("bbttcc-raid." + SETTING_STATE)) {
        game.settings.register("bbttcc-raid", SETTING_STATE, {
          name: "Boss Builder: Boss Persistent State",
          scope: "world",
          config: false,
          type: Object,
          default: {}
        });
      }
    } catch (e) {}
    return Promise.resolve(true);
  }

  Hooks.once("init", function() {
    ensureRaidApiLists();
    attachApiOpeners();
  });

  Hooks.once("ready", function() {
    ensureSettings().then(function() {
      try {
        const custom = safeGetSetting(SETTING_DEFS, {});
        registerCustomIntoRegistry(custom);
      } catch (e) {}
      ensureRaidApiLists();
      attachApiOpeners();
      log("Boss Builder ready (v6 syntax-safe)");
    });
  });

})();