// bbttcc-core/scripts/api.gm.js
// NEW FILE — Phase 1: GM Write Layer + Audit
//
// Provides: game.bbttcc.api.gm
//   - setWorld({ patch, note, silent })
//   - setFaction({ factionId, patch, note, silent })
//   - setActor({ actorId, patch, note, silent })
//   - setHex({ hexUuid, patch, note, silent })  (adapter stub; requires territory gm adapter)
//
// Design goals:
// - GM-only, allowlisted writes
// - structured patch objects (no arbitrary dot paths)
// - audit trail (world setting + GM whisper)
// - syntax-safe (no optional chaining/spread/async)
//
// This file exposes an installer on globalThis.BBTTCC_GM_API so core can install it robustly.

(function () {
  var CORE_ID = "bbttcc-core";
  var TAG = "[bbttcc-core/gm]";
  function log()  { console.log.apply(console, [TAG].concat([].slice.call(arguments))); }
  function warn() { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); }

  // -----------------------------
  // Utilities
  // -----------------------------
  function isGM() {
    try { return !!(game && game.user && game.user.isGM); } catch (e) { return false; }
  }

  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  function getSettingAudit() {
    try {
      var raw = game.settings.get(CORE_ID, "gmAuditLog");
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function setSettingAudit(arr) {
    try {
      return game.settings.set(CORE_ID, "gmAuditLog", JSON.stringify(arr || []));
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function nowISO() {
    try { return new Date().toISOString(); } catch (e) { return "" + Date.now(); }
  }

  function gmWhisper(lines) {
    try {
      var gmIds = game.users.filter(function (u) { return u && u.isGM; }).map(function (u) { return u.id; });
      if (!gmIds.length) return Promise.resolve(false);
      var content = Array.isArray(lines) ? lines.join("<br>") : String(lines || "");
      return ChatMessage.create({ content: content, whisper: gmIds });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function fmtVal(v) {
    if (v === null) return "null";
    if (typeof v === "undefined") return "undefined";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function flattenPatch(patch, prefix, out) {
    out = out || [];
    prefix = prefix || "";
    if (!patch || typeof patch !== "object") return out;

    Object.keys(patch).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) return;
      var v = patch[k];
      var path = prefix ? (prefix + "." + k) : k;

      // Treat Date, Array, null, primitive as leaf
      var isLeaf =
        v === null ||
        typeof v === "undefined" ||
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        Array.isArray(v);

      if (isLeaf) out.push({ path: path, value: v });
      else flattenPatch(v, path, out);
    });

    return out;
  }

  function deny(msg) {
    ui.notifications.error(msg);
    throw new Error(msg);
  }

  // -----------------------------
  // Allowlists (Phase 1 baseline)
  // -----------------------------
  var ALLOW = {
    world: {
      "turn.number": true,
      "world.darkness": true
    },
    faction: {
      // OP bank categories: op.bank.violence, op.bank.intrigue, etc.
      "op.bank": { wildcard: true },

      "tracks.morale": true,
      "tracks.loyalty": true,
      "tracks.unity": true,
      "tracks.victory": true,
      "tracks.darkness": true,

      "sparks": { wildcard: true }
    },
    actor: {
      "sparks": { wildcard: true }
    },
    hex: {
      "travel.unitsOverride": true,
      "development.stage": true,
      "development.locked": true,
      "alarm.value": true,
      "alarm.locked": true,
      "campaign.onEnterBeatId": true
    }
  };

  function isAllowed(scope, path) {
    var root = ALLOW[scope];
    if (!root) return false;

    if (root[path] === true) return true;

    // wildcard checks (prefix match)
    var parts = path.split(".");
    for (var i = parts.length; i >= 1; i--) {
      var pref = parts.slice(0, i).join(".");
      var rule = root[pref];
      if (rule && rule.wildcard) return true;
    }
    return false;
  }

  // -----------------------------
  // Storage adapters
  // -----------------------------
  // World storage: bbttcc-core world settings
  function getWorldState() {
    var out = { turn: { number: 0 }, world: { darkness: 0 } };
    try {
      var raw = game.settings.get(CORE_ID, "worldState");
      if (raw) out = Object.assign(out, JSON.parse(raw));
    } catch (e) {}
    return out;
  }

  function setWorldState(state) {
    try {
      return game.settings.set(CORE_ID, "worldState", JSON.stringify(state || {}));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  // Ensure worldState setting exists (silent if already registered elsewhere)
  function ensureWorldStateSetting() {
    try {
      if (!game.settings.settings.get(CORE_ID + ".worldState")) {
        game.settings.register(CORE_ID, "worldState", {
          name: "BBTTCC World State",
          hint: "Internal: authoritative world state for BBTTCC (turn number, global darkness, etc.)",
          scope: "world",
          config: false,
          type: String,
          default: JSON.stringify({ turn: { number: 0 }, world: { darkness: 0 } })
        });
      }
    } catch (e) {
      // ok
    }
  }

  // -----------------------------
  // Patch application helpers
  // -----------------------------
  function applyToObject(target, flat, scopeName) {
    var changed = [];
    flat.forEach(function (it) {
      var path = it.path;
      if (!isAllowed(scopeName, path)) deny(TAG + " blocked write: " + scopeName + " " + path);

      var parts = path.split(".");
      var cursor = target;
      for (var i = 0; i < parts.length - 1; i++) {
        var key = parts[i];
        if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
        cursor = cursor[key];
      }
      var leaf = parts[parts.length - 1];
      var oldVal = cursor[leaf];
      var newVal = it.value;

      // Null means clear override (delete) if it existed
      if (newVal === null) {
        if (typeof cursor[leaf] !== "undefined") {
          delete cursor[leaf];
          changed.push({ path: path, old: oldVal, next: null });
        }
        return;
      }

      // Basic number coercion for obvious numeric fields (Phase 1)
      if (typeof oldVal === "number" && typeof newVal === "string" && newVal.trim() !== "") {
        var num = Number(newVal);
        if (!isNaN(num)) newVal = num;
      }

      // Set if changed (deep compare for objects not needed in Phase 1 leafs)
      if (oldVal !== newVal) {
        cursor[leaf] = newVal;
        changed.push({ path: path, old: oldVal, next: newVal });
      }
    });
    return changed;
  }

  function auditRecord(rec) {
    var arr = getSettingAudit();
    arr.push(rec);
    // keep last 250 entries
    if (arr.length > 250) arr = arr.slice(arr.length - 250);
    return setSettingAudit(arr);
  }

  function auditAndWhisper(rec, changed, silent) {
    var lines = [];
    lines.push("<b>GM Adjustment</b> — " + String(rec.targetKind || "unknown"));
    if (rec.targetLabel) lines.push("<span class='bbttcc-muted'>" + rec.targetLabel + "</span>");
    changed.forEach(function (c) {
      lines.push("<code>" + c.path + "</code>: " + fmtVal(c.old) + " → <b>" + fmtVal(c.next) + "</b>");
    });
    if (rec.note) lines.push("<i>" + String(rec.note) + "</i>");
    if (!silent) gmWhisper(lines);
    return auditRecord(rec);
  }

  // -----------------------------
  // Public API implementations
  // -----------------------------
  function setWorld(args) {
    args = args || {};
    if (!isGM()) deny("GM-only: setWorld");
    ensureWorldStateSetting();

    var patch = args.patch || {};
    var note = args.note || "";
    var silent = !!args.silent;

    var state = getWorldState();
    var flat = flattenPatch(patch);
    var changed = applyToObject(state, flat, "world");

    return setWorldState(state).then(function () {
      var rec = {
        at: nowISO(),
        by: (game.user && game.user.id) || null,
        targetKind: "world",
        targetLabel: "World State",
        note: note,
        changed: changed
      };
      return auditAndWhisper(rec, changed, silent).then(function () {
        return { ok: true, changed: changed, state: state };
      });
    });
  }

  function setFaction(args) {
    args = args || {};
    if (!isGM()) deny("GM-only: setFaction");

    var factionId = args.factionId;
    if (!factionId) deny("setFaction requires factionId");
    var actor = game.actors.get(factionId);
    if (!actor) deny("Faction actor not found: " + factionId);

    var patch = args.patch || {};
    var note = args.note || "";
    var silent = !!args.silent;

    // Work on a clone then update flags in one go.
    var cur = deepClone(actor.getFlag("bbttcc-factions", "gmState") || {});
    var flat = flattenPatch(patch);
    var changed = applyToObject(cur, flat, "faction");

    return actor.setFlag("bbttcc-factions", "gmState", cur).then(function () {
      var rec = {
        at: nowISO(),
        by: (game.user && game.user.id) || null,
        targetKind: "faction",
        targetId: factionId,
        targetLabel: actor.name,
        note: note,
        changed: changed
      };
      return auditAndWhisper(rec, changed, silent).then(function () {
        return { ok: true, changed: changed, gmState: cur };
      });
    });
  }

  function setActor(args) {
    args = args || {};
    if (!isGM()) deny("GM-only: setActor");

    var actorId = args.actorId;
    if (!actorId) deny("setActor requires actorId");
    var actor = game.actors.get(actorId);
    if (!actor) deny("Actor not found: " + actorId);

    var patch = args.patch || {};
    var note = args.note || "";
    var silent = !!args.silent;

    var cur = deepClone(actor.getFlag("bbttcc-core", "gmState") || {});
    var flat = flattenPatch(patch);
    var changed = applyToObject(cur, flat, "actor");

    return actor.setFlag("bbttcc-core", "gmState", cur).then(function () {
      var rec = {
        at: nowISO(),
        by: (game.user && game.user.id) || null,
        targetKind: "actor",
        targetId: actorId,
        targetLabel: actor.name,
        note: note,
        changed: changed
      };
      return auditAndWhisper(rec, changed, silent).then(function () {
        return { ok: true, changed: changed, gmState: cur };
      });
    });
  }

  function setHex(args) {
    args = args || {};
    if (!isGM()) deny("GM-only: setHex");

    var hexUuid = args.hexUuid;
    if (!hexUuid) deny("setHex requires hexUuid");

    var patch = args.patch || {};
    var note = args.note || "";
    var silent = !!args.silent;

    // Adapter: territory module should provide a GM setter because hex storage is system-specific.
    var terr = game.bbttcc && game.bbttcc.api && game.bbttcc.api.territory;
    if (terr && typeof terr.gmSetHex === "function") {
      // Territory adapter is responsible for allowlist validation against "hex" scope if it writes raw.
      var flat = flattenPatch(patch);
      // Validate here too.
      flat.forEach(function (it) {
        if (!isAllowed("hex", it.path)) deny(TAG + " blocked write: hex " + it.path);
      });

      return Promise.resolve(terr.gmSetHex({ hexUuid: hexUuid, patch: patch, note: note, silent: true })).then(function (res) {
        var rec = {
          at: nowISO(),
          by: (game.user && game.user.id) || null,
          targetKind: "hex",
          targetId: hexUuid,
          targetLabel: hexUuid,
          note: note,
          changed: flat.map(function (it) { return { path: it.path, old: undefined, next: it.value }; })
        };
        return auditAndWhisper(rec, rec.changed, silent).then(function () {
          return Object.assign({ ok: true }, res || {});
        });
      });
    }

    deny("Hex GM write requires territory adapter: game.bbttcc.api.territory.gmSetHex({hexUuid, patch})");
  }

  // -----------------------------
  // Installer
  // -----------------------------
  function install(root) {
    try {
      root = root || (game.bbttcc = game.bbttcc || {});
      root.api = root.api || {};
      if (!root.api.gm) {
        root.api.gm = {
          setWorld: setWorld,
          setFaction: setFaction,
          setActor: setActor,
          setHex: setHex
        };
      } else {
        // Merge without overwriting existing functions unless missing.
        var gm = root.api.gm;
        if (!gm.setWorld) gm.setWorld = setWorld;
        if (!gm.setFaction) gm.setFaction = setFaction;
        if (!gm.setActor) gm.setActor = setActor;
        if (!gm.setHex) gm.setHex = setHex;
      }

      ensureWorldStateSetting();
      log("installed game.bbttcc.api.gm");
    } catch (e) {
      warn("install failed", e);
    }
  }

  globalThis.BBTTCC_GM_API = globalThis.BBTTCC_GM_API || {};
  globalThis.BBTTCC_GM_API.install = install;
})();
