// bbttcc-world/scripts/api.world.js
// World State API (v1) — parse-safe (no async/await, no optional chaining, no object spread).
// Canonical storage: game.settings "bbttcc-world" / "worldState"

(function(){
  "use strict";

  var TAG = "[bbttcc-world/api]";
  function log(){ try{ console.log.apply(console, [TAG].concat([].slice.call(arguments))); }catch(_e){} }
  function warn(){ try{ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); }catch(_e){} }

  var MODULE_ID = "bbttcc-world";
  var SETTING_STATE = "worldState";
  var SETTING_LOGS  = "worldLogs";
  var SETTING_SNAPS = "worldSnapshots";
  var SETTING_TURN_BEATS = "turnBeats"; // Phase 1: per-turn beat availability registry

  function _settingFullKey(key){ return MODULE_ID + "." + key; }
  function _isSettingRegistered(key){
    try {
      return !!(game && game.settings && game.settings.settings && game.settings.settings.get(_settingFullKey(key)));
    } catch(_e) { return false; }
  }

  function ensureSettingsRegistered(){
    // Self-heal: the module boot file may forget to register these hidden settings.
    // Safe to call multiple times; never breaks boot.
    try {
      if (!game || !game.settings || typeof game.settings.register !== "function") return;

      if (!_isSettingRegistered(SETTING_SNAPS)) {
        game.settings.register(MODULE_ID, SETTING_SNAPS, {
          name: "BBTTCC World Snapshots",
          hint: "Internal storage for GM world-state snapshots.",
          scope: "world",
          config: false,
          type: Array,
          default: []
        });
      }

      if (!_isSettingRegistered(SETTING_TURN_BEATS)) {
        game.settings.register(MODULE_ID, SETTING_TURN_BEATS, {
          name: "BBTTCC Turn Beats",
          hint: "Internal storage for beats assigned to strategic turns.",
          scope: "world",
          config: false,
          type: Object,
          default: {}
        });
      }
    } catch(e){
      warn("ensureSettingsRegistered failed", e);
    }
  }

  function nowMs(){ return Date.now ? Date.now() : (new Date()).getTime(); }

  function deepClone(obj){
    try { return foundry.utils.duplicate(obj); } catch(_e){}
    try { return JSON.parse(JSON.stringify(obj)); } catch(_e2){}
    return obj;
  }

  function clampNumber(n, min, max, fallback){
    var x = Number(n);
    if (!isFinite(x)) x = Number(fallback);
    if (!isFinite(x)) x = 0;
    if (min != null && x < min) x = min;
    if (max != null && x > max) x = max;
    return x;
  }

  function toInt(n, fallback){
    var x = parseInt(n, 10);
    if (!isFinite(x)) x = parseInt(fallback, 10);
    if (!isFinite(x)) x = 0;
    return x;
  }

  function ensureSchemaV1(state){
    var s = state && typeof state === "object" ? deepClone(state) : {};
    if (typeof s.schema !== "number") s.schema = 1;

    // Core
    s.turn = toInt(s.turn, 1);
    if (s.turn < 1) s.turn = 1;

    s.darkness = clampNumber(s.darkness, 0, 100, 0);
    s.pressureMod = clampNumber(s.pressureMod, 0, 5, 1.0);

    // Time
    if (!s.time || typeof s.time !== "object") s.time = {};
    s.time.epoch = toInt(s.time.epoch, 0);
    s.time.turnLength = toInt(s.time.turnLength, 1);
    if (s.time.turnLength < 1) s.time.turnLength = 1;
    // Progress is "time points" toward the next Strategic Turn.
    s.time.progress = toInt(s.time.progress, 0);
    if (s.time.progress < 0) s.time.progress = 0;
    // Keep progress bounded to avoid runaway values; turnLength is the natural ceiling.
    if (s.time.turnLength > 0 && s.time.progress > s.time.turnLength) s.time.progress = s.time.turnLength;

    // Locks
    if (!s.locks || typeof s.locks !== "object") s.locks = {};
    s.locks.turnAdvance = !!s.locks.turnAdvance;
    s.locks.mutation    = !!s.locks.mutation;
    s.locks.politics    = !!s.locks.politics;
    s.locks.logistics   = !!s.locks.logistics;

    // Meta
    if (!s.meta || typeof s.meta !== "object") s.meta = {};
    if (typeof s.meta.updatedAt !== "number") s.meta.updatedAt = 0;
    if (typeof s.meta.updatedBy !== "string") s.meta.updatedBy = "";

    return s;
  }

  function getRawState(){
    try {
      return game.settings.get(MODULE_ID, SETTING_STATE);
    } catch(e){
      warn("getRawState failed", e);
      return null;
    }
  }

  function setRawState(nextState){
    try {
      return game.settings.set(MODULE_ID, SETTING_STATE, nextState);
    } catch(e){
      warn("setRawState failed", e);
      throw e;
    }
  }

  function getWorldLogs(){
    try {
      var logs = game.settings.get(MODULE_ID, SETTING_LOGS);
      if (!Array.isArray(logs)) logs = [];
      return logs;
    } catch(e){
      warn("getWorldLogs failed", e);
      return [];
    }
  }

  function pushWorldLog(entry){
    var logs = getWorldLogs();
    logs.push(entry);
    // Keep logs bounded (alpha-safe). 250 entries is plenty; older entries drop.
    if (logs.length > 250) logs = logs.slice(logs.length - 250);
    try {
      return game.settings.set(MODULE_ID, SETTING_LOGS, logs);
    } catch(e){
      warn("pushWorldLog failed", e);
      return Promise.resolve(null);
    }
  }

  // -----------------------------
  // Snapshots (v1)
  // -----------------------------

  function getSnapshots(){
    ensureSettingsRegistered();
    try {
      var snaps = game.settings.get(MODULE_ID, SETTING_SNAPS);
      if (!Array.isArray(snaps)) snaps = [];
      return snaps;
    } catch(e){
      warn("getSnapshots failed", e);
      return [];
    }
  }

  function setSnapshots(snaps){
    ensureSettingsRegistered();
    try {
      if (!Array.isArray(snaps)) snaps = [];
      // Bound to 20 snapshots max (alpha-safe)
      if (snaps.length > 20) snaps = snaps.slice(snaps.length - 20);
      return game.settings.set(MODULE_ID, SETTING_SNAPS, snaps);
    } catch(e){
      warn("setSnapshots failed", e);
      return Promise.reject(e);
    }
  }

  function _randId(){
    // short, stable-ish ID for selects
    var r = Math.random ? Math.random() : 0.5;
    var a = String(nowMs());
    var b = String(Math.floor(r * 1e9));
    return "snap_" + a + "_" + b;
  }

  function _captureFactionFlags(){
    // Best-effort: capture only bbttcc-factions flags for any actor that has them.
    var out = [];
    try {
      if (!game || !game.actors) return out;
      game.actors.forEach(function(actor){
        try {
          var flags = actor && actor.flags ? actor.flags : null;
          if (!flags) return;
          var bf = flags["bbttcc-factions"];
          if (!bf) return;
          out.push({ id: actor.id, name: actor.name, flags: { "bbttcc-factions": deepClone(bf) } });
        } catch(_e2){}
      });
    } catch(e){ warn("_captureFactionFlags failed", e); }
    return out;
  }

  function _captureHexFlagsCurrentScene(){
    // Best-effort: capture only bbttcc-territory flags for drawings in the current scene.
    var out = [];
    try {
      var scene = (game && game.scenes) ? game.scenes.current : null;
      if (!scene) return out;
      var drawings = scene.drawings;
      if (!drawings) return out;
      drawings.forEach(function(d){
        try {
          var flags = d && d.flags ? d.flags : null;
          if (!flags) return;
          var bt = flags["bbttcc-territory"];
          if (!bt) return;
          out.push({
            sceneId: scene.id,
            drawingId: d.id,
            flags: { "bbttcc-territory": deepClone(bt) }
          });
        } catch(_e2){}
      });
    } catch(e){ warn("_captureHexFlagsCurrentScene failed", e); }
    return out;
  }

  function createSnapshot(opts){
    opts = opts || {};
    var userName = (game && game.user && game.user.name) ? String(game.user.name) : "Unknown";
    var note = (opts.note != null) ? String(opts.note) : "";
    var label = (opts.label != null && String(opts.label).trim()) ? String(opts.label).trim() : ("Snapshot " + new Date().toLocaleString());

    var snap = {
      id: _randId(),
      at: nowMs(),
      by: userName,
      label: label,
      note: note,
      state: deepClone(getState()),
      factions: _captureFactionFlags(),
      hexes: _captureHexFlagsCurrentScene()
    };

    var snaps = getSnapshots();
    snaps.push(snap);
    // Bound
    if (snaps.length > 20) snaps = snaps.slice(snaps.length - 20);

    var entry = { type: "gm_world_snapshot", at: snap.at, by: userName, note: note, snapshotId: snap.id, label: snap.label };

    return Promise.resolve(setSnapshots(snaps))
      .then(function(){ return pushWorldLog(entry); })
      .then(function(){ return { ok: true, snapshot: snap, count: getSnapshots().length }; });
  }

  function _restoreFactionFlags(payload){
    var restored = 0;
    try {
      if (!payload || !Array.isArray(payload)) return restored;
      payload.forEach(function(row){
        try {
          if (!row || !row.id || !row.flags) return;
          var actor = game && game.actors ? game.actors.get(row.id) : null;
          if (!actor) return;
          var bf = row.flags["bbttcc-factions"];
          if (!bf) return;
          actor.update({ flags: { "bbttcc-factions": deepClone(bf) } });
          restored++;
        } catch(_e2){}
      });
    } catch(e){ warn("_restoreFactionFlags failed", e); }
    return restored;
  }

  function _restoreHexFlags(payload){
    var restored = 0;
    try {
      if (!payload || !Array.isArray(payload)) return restored;
      payload.forEach(function(row){
        try {
          if (!row || !row.sceneId || !row.drawingId || !row.flags) return;
          var scene = game && game.scenes ? game.scenes.get(row.sceneId) : null;
          if (!scene) return;
          var d = scene.drawings ? scene.drawings.get(row.drawingId) : null;
          if (!d) return;
          var bt = row.flags["bbttcc-territory"];
          if (!bt) return;
          d.update({ flags: { "bbttcc-territory": deepClone(bt) } });
          restored++;
        } catch(_e2){}
      });
    } catch(e){ warn("_restoreHexFlags failed", e); }
    return restored;
  }

  function rollbackSnapshot(snapshotId, opts){
    opts = opts || {};
    var userName = (game && game.user && game.user.name) ? String(game.user.name) : "Unknown";
    var note = (opts.note != null) ? String(opts.note) : "";
    var snaps = getSnapshots();
    var snap = null;
    for (var i=0; i<snaps.length; i++) {
      if (snaps[i] && snaps[i].id === snapshotId) { snap = snaps[i]; break; }
    }
    if (!snap) return Promise.resolve({ ok:false, reason:"not_found" });

    var p = Promise.resolve(setRawState(ensureSchemaV1(snap.state)));
    var factionRestored = _restoreFactionFlags(snap.factions);
    var hexRestored = _restoreHexFlags(snap.hexes);

    var entry = {
      type: "gm_world_rollback",
      at: nowMs(),
      by: userName,
      note: note,
      snapshotId: snap.id,
      label: snap.label,
      restored: { factions: factionRestored, hexes: hexRestored }
    };

    return p
      .then(function(){ return pushWorldLog(entry); })
      .then(function(){
        log("rollbackSnapshot", { snapshotId: snap.id, label: snap.label, restored: entry.restored });
        return { ok:true, snapshot: snap, restored: entry.restored, state: getState() };
      });
  }

  function deleteSnapshot(snapshotId){
    var snaps = getSnapshots();
    var next = [];
    var deleted = null;
    for (var i=0; i<snaps.length; i++) {
      if (snaps[i] && snaps[i].id === snapshotId) { deleted = snaps[i]; continue; }
      next.push(snaps[i]);
    }
    return Promise.resolve(setSnapshots(next)).then(function(){ return { ok:true, deleted: deleted, count: next.length }; });
  }

  function clearAllSnapshots(){
    return Promise.resolve(setSnapshots([])).then(function(){ return { ok:true, count: 0 }; });
  }

  function exportSnapshot(snapshotId){
    var snaps = getSnapshots();
    var snap = null;
    for (var i=0; i<snaps.length; i++) {
      if (snaps[i] && snaps[i].id === snapshotId) { snap = snaps[i]; break; }
    }
    if (!snap) return { ok:false, reason:"not_found" };
    var data = JSON.stringify(snap, null, 2);

    // Foundry helper exists in many builds.
    try {
      if (typeof saveDataToFile === "function") {
        saveDataToFile(data, "application/json", "bbttcc-world-snapshot-" + snapshotId + ".json");
        return { ok:true, snapshot: snap };
      }
    } catch(_e){}

    // Browser fallback.
    try {
      var blob = new Blob([data], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "bbttcc-world-snapshot-" + snapshotId + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){
        try{ document.body.removeChild(a); }catch(_e2){}
        try{ URL.revokeObjectURL(url); }catch(_e3){}
      }, 250);
      return { ok:true, snapshot: snap };
    } catch(e){
      warn("exportSnapshot failed", e);
      return { ok:false, reason:"export_failed" };
    }
  }

  function listSnapshots(){
    var snaps = getSnapshots();
    return snaps.map(function(s){
      return { id: s.id, at: s.at, by: s.by, label: s.label, note: s.note };
    });
  }

  // -----------------------------
  // Turn Beat Availability (Phase 1)
  // -----------------------------

  function getTurnBeatsMap(){
    ensureSettingsRegistered();
    try {
      var m = game.settings.get(MODULE_ID, SETTING_TURN_BEATS);
      if (!m || typeof m !== "object") m = {};
      return m;
    } catch(e){
      warn("getTurnBeatsMap failed", e);
      return {};
    }
  }

  function setTurnBeatsMap(m){
    ensureSettingsRegistered();
    try {
      if (!m || typeof m !== "object") m = {};
      return game.settings.set(MODULE_ID, SETTING_TURN_BEATS, m);
    } catch(e){
      warn("setTurnBeatsMap failed", e);
      return Promise.reject(e);
    }
  }

  function getTurnBeats(turn){
    turn = toInt(turn, 1);
    var m = getTurnBeatsMap();
    var key = String(turn);
    var arr = m[key];
    if (!Array.isArray(arr)) arr = [];
    return deepClone(arr);
  }

  function setTurnBeats(turn, entries){
    turn = toInt(turn, 1);
    var m = getTurnBeatsMap();
    var key = String(turn);
    if (!Array.isArray(entries)) entries = [];
    m[key] = deepClone(entries);
    return setTurnBeatsMap(m);
  }

  function summarizeDelta(prev, next){
    function pickCore(s){
      return {
        schema: s.schema,
        turn: s.turn,
        darkness: s.darkness,
        pressureMod: s.pressureMod,
        time: { epoch: s.time && s.time.epoch, turnLength: s.time && s.time.turnLength, progress: s.time && s.time.progress },
        locks: {
          turnAdvance: s.locks && s.locks.turnAdvance,
          mutation: s.locks && s.locks.mutation,
          politics: s.locks && s.locks.politics,
          logistics: s.locks && s.locks.logistics
        }
      };
    }
    return { before: pickCore(prev), after: pickCore(next) };
  }

  function tryAddFactionWarLog(entry, factionId){
    // Optional: if caller provides factionId, also write into faction war logs for visibility.
    // Best-effort; never blocks world edits.
    try {
      if (!factionId) return false;
      if (!game || !game.bbttcc || !game.bbttcc.api || !game.bbttcc.api.factions) return false;
      var fapi = game.bbttcc.api.factions;
      if (typeof fapi.addWarLog !== "function") return false;
      // If addWarLog is async in your build, calling it without await is fine (best-effort).
      fapi.addWarLog(factionId, entry);
      return true;
    } catch(e){
      warn("tryAddFactionWarLog failed", e);
      return false;
    }
  }

  function applyPatch(base, patch){
    var next = ensureSchemaV1(base);
    patch = patch && typeof patch === "object" ? patch : {};

    if (patch.turn != null) next.turn = toInt(patch.turn, next.turn);
    if (patch.darkness != null) next.darkness = clampNumber(patch.darkness, 0, 100, next.darkness);
    if (patch.pressureMod != null) next.pressureMod = clampNumber(patch.pressureMod, 0, 5, next.pressureMod);

    if (patch.time && typeof patch.time === "object") {
      if (patch.time.epoch != null) next.time.epoch = toInt(patch.time.epoch, next.time.epoch);
      if (patch.time.turnLength != null) next.time.turnLength = toInt(patch.time.turnLength, next.time.turnLength);
      if (patch.time.progress != null) next.time.progress = toInt(patch.time.progress, next.time.progress);
      if (next.time.turnLength < 1) next.time.turnLength = 1;
      if (next.time.progress < 0) next.time.progress = 0;
    }

    if (patch.locks && typeof patch.locks === "object") {
      if (patch.locks.turnAdvance != null) next.locks.turnAdvance = !!patch.locks.turnAdvance;
      if (patch.locks.mutation    != null) next.locks.mutation    = !!patch.locks.mutation;
      if (patch.locks.politics    != null) next.locks.politics    = !!patch.locks.politics;
      if (patch.locks.logistics   != null) next.locks.logistics   = !!patch.locks.logistics;
    }

    return ensureSchemaV1(next);
  }

  function getState(){
    return ensureSchemaV1(getRawState());
  }

  function setState(nextState, opts){
    opts = opts || {};
    var userName = (game && game.user && game.user.name) ? String(game.user.name) : "Unknown";
    var next = ensureSchemaV1(nextState);
    next.meta.updatedAt = nowMs();
    next.meta.updatedBy = userName;
    return setRawState(next);
  }

  function applyGMEdit(patch, opts){
    opts = opts || {};

    var prev = getState();
    var next = applyPatch(prev, patch);

    var userName = (game && game.user && game.user.name) ? String(game.user.name) : "Unknown";
    var note = (opts.note != null) ? String(opts.note) : "";
    var factionId = opts.factionId || null;

    next.meta.updatedAt = nowMs();
    next.meta.updatedBy = userName;

    var delta = summarizeDelta(prev, next);
    var entry = {
      type: "gm_world_adjustment",
      at: nowMs(),
      by: userName,
      note: note,
      delta: delta
    };

    // IMPORTANT: chain the log write so callers who `await applyGMEdit(...)` can immediately read logs.
    var p;
    try {
      p = setRawState(next);
    } catch(e) {
      return Promise.reject(e);
    }

    return Promise.resolve(p)
      .then(function(){
        return pushWorldLog(entry);
      })
      .then(function(){
        tryAddFactionWarLog(entry, factionId);
        log("applyGMEdit", { by: userName, note: note, factionId: factionId, delta: delta });
        return { ok: true, entry: entry, state: ensureSchemaV1(next) };
      });
  }

  function bumpTurn(delta, opts){
    delta = toInt(delta, 1);
    var s = getState();
    return applyGMEdit({ turn: s.turn + delta }, opts);
  }

  function setDarkness(value, opts){
    return applyGMEdit({ darkness: value }, opts);
  }

  function setPressureMod(value, opts){
    return applyGMEdit({ pressureMod: value }, opts);
  }

  function attach(){
    ensureSettingsRegistered();
    if (!game || !game.bbttcc) game.bbttcc = {};
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.world) game.bbttcc.api.world = {};
    var api = game.bbttcc.api.world;

    api.getState = getState;
    api.setState = setState;
    api.applyGMEdit = applyGMEdit;

    api.bumpTurn = bumpTurn;
    api.setDarkness = setDarkness;
    api.setPressureMod = setPressureMod;

    api.getWorldLogs = getWorldLogs;

    // Snapshots
    api.listSnapshots = listSnapshots;
    api.createSnapshot = createSnapshot;
    api.rollbackSnapshot = rollbackSnapshot;
    api.deleteSnapshot = deleteSnapshot;
    api.exportSnapshot = exportSnapshot;
    api.clearAllSnapshots = clearAllSnapshots;

    // Turn beats (Phase 1 storage)
    api.getTurnBeatsMap = getTurnBeatsMap;
    api.setTurnBeatsMap = setTurnBeatsMap;
    api.getTurnBeats = getTurnBeats;
    api.setTurnBeats = setTurnBeats;

    api.__schema = 1;
    api.__module = MODULE_ID;

    log("World API attached", api);
  }

  if (!globalThis.BBTTCCWorldAPI) globalThis.BBTTCCWorldAPI = {};
  globalThis.BBTTCCWorldAPI.attach = attach;
  // Late-load safe attach: call immediately if possible, and again on ready.
  function _safeAttach(){
    try { attach(); } catch(e) { warn("World API attach failed", e); }
  }

  try {
    if (typeof Hooks !== "undefined" && Hooks && typeof Hooks.once === "function") {
      Hooks.once("ready", function(){ _safeAttach(); });
    }
  } catch(_e3){}

  try {
    if (typeof game !== "undefined" && game && game.ready) _safeAttach();
  } catch(_e4){}

  // Also attempt immediate attach during module eval (non-fatal if game not ready yet).
  _safeAttach();


})();
