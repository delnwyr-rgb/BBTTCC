// bbttcc-core/scripts/api.gm.js
// NEW FILE — Phase 1: GM Write Layer + Audit
//
// Provides: game.bbttcc.api.gm
//   - setWorld({ patch, note, silent })
//   - setFaction({ factionId, patch, note, silent, allowOvercap })  (routes to the live stores — see setFaction)
//   - setActor({ actorId, patch, note, silent })  (refuses: no actor path maps to a live store)
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
          name: "Bad Eden World State",
          hint: "Internal: authoritative world state for Bad Eden (turn number, global darkness, etc.)",
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
      // 2026-08-28 (atlas #14 ruling): bbttcc-world.worldState is CANONICAL.
      // Mirror turn/darkness writes into api.world so the two spines can never
      // disagree; this store stays for audit continuity + legacy readers.
      try {
        var w = game.bbttcc && game.bbttcc.api && game.bbttcc.api.world;
        if (w && typeof w.applyGMEdit === "function" && changed.length) {
          var mirror = {};
          changed.forEach(function (c) {
            if (c.path === "turn.number") mirror.turn = c.next;
            if (c.path === "world.darkness") mirror.darkness = c.next;
          });
          if (Object.keys(mirror).length) {
            w.applyGMEdit(mirror, { note: "mirror: api.gm.setWorld" + (note ? " — " + note : "") });
          }
        }
      } catch (eMirror) {
        console.warn(TAG, "canonical world-state mirror failed:", eMirror);
      }
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

  // 2026-10-02 housekeeping: setFaction/setActor used to write a private
  // `gmState` flag that NOTHING in the game reads — a GM "adjustment" changed
  // no bank, meter or track. Patches now land in the real stores:
  //   op.bank.<channel>  → api.op.commit (MARKS; delta = value − current bank;
  //                        refused over cap unless args.allowOvercap === true)
  //   tracks.morale/loyalty → api.factions.setMorale / setLoyalty (0–100)
  //   tracks.unity   → flags.bbttcc-factions.victory.unity  (reset to 0 by
  //                    turn-extensions each applied turn — a set is transient)
  //   tracks.victory → flags.bbttcc-factions.victory.vp
  //   tracks.darkness → flags.bbttcc-factions.darkness.global
  // `sparks.*` is refused: sparks are phased records owned by api.tikkun
  // (markSparkPhase / depositSpark), never a free-form patch. Values are
  // ABSOLUTE (set-to), never deltas; null (clear) is refused for real stores.
  var MODF = "bbttcc-factions";
  var FACTION_TRACK_FLAG = {
    "tracks.unity": "victory.unity",
    "tracks.victory": "victory.vp",
    "tracks.darkness": "darkness.global"
  };

  function getPath(obj, path) {
    var cur = obj;
    var parts = path.split(".");
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || typeof cur !== "object") return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function finiteOrDeny(it) {
    if (it.value === null || typeof it.value === "undefined" || it.value === "") deny(TAG + " " + it.path + ": a value is required (clearing a live store is not supported)");
    var n = Number(it.value);
    if (!isFinite(n)) deny(TAG + " " + it.path + ": not a number: " + fmtVal(it.value));
    return n;
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

    var api = (game.bbttcc && game.bbttcc.api) || {};
    var opApi = api.op || null;
    var fApi = api.factions || {};
    var flat = flattenPatch(patch);

    // Validate everything BEFORE any write, so a bad row never half-applies.
    var opDeltas = {}, opChanged = [], meterOps = [], flagUpd = {}, changed = [];
    var bank = actor.getFlag(MODF, "opBank") || {};
    var keys = (opApi && Array.isArray(opApi.KEYS)) ? opApi.KEYS : [];
    flat.forEach(function (it) {
      var path = it.path;
      if (!isAllowed("faction", path)) deny(TAG + " blocked write: faction " + path);
      if (path.indexOf("sparks") === 0) deny(TAG + " faction " + path + ": sparks are owned by api.tikkun (markSparkPhase / depositSpark) — not patchable here");

      if (path.indexOf("op.bank.") === 0) {
        var ch = path.slice("op.bank.".length);
        if (!opApi || typeof opApi.commit !== "function") deny(TAG + " api.op.commit unavailable — cannot set " + path);
        if (keys.indexOf(ch) < 0) deny(TAG + " unknown OP channel: " + ch);
        var next = Math.round(finiteOrDeny(it));
        if (next < 0) deny(TAG + " " + path + " cannot go below 0 marks");
        var old = Math.round(Number(bank[ch] || 0)) || 0;
        if (next !== old) {
          opDeltas[ch] = next - old;
          opChanged.push({ path: path, old: old, next: next });
        }
        return;
      }

      if (path === "tracks.morale" || path === "tracks.loyalty") {
        var mkey = path.slice("tracks.".length);
        var mv = Math.min(100, Math.max(0, finiteOrDeny(it)));
        var mold = actor.getFlag(MODF, mkey);
        if (mold !== mv) meterOps.push({ key: mkey, value: mv, old: mold, path: path });
        return;
      }

      if (FACTION_TRACK_FLAG[path]) {
        var fpath = FACTION_TRACK_FLAG[path];
        var tv = Math.max(0, finiteOrDeny(it));
        var told = getPath(actor.flags && actor.flags[MODF], fpath);
        // Legacy flat-number darkness: the sheet tolerates it; the write lands canonical.
        if (fpath === "darkness.global" && typeof actor.getFlag(MODF, "darkness") === "number") told = actor.getFlag(MODF, "darkness");
        if (told !== tv) {
          flagUpd["flags." + MODF + "." + fpath] = tv;
          changed.push({ path: path, old: told, next: tv });
        }
        return;
      }

      deny(TAG + " faction " + path + ": no live store mapped for this path");
    });

    // OP first: if the engine refuses (underflow / over cap) nothing else is written.
    var opStep = Object.keys(opDeltas).length
      ? Promise.resolve(opApi.commit(actor.id, opDeltas, {
          source: "gm.setFaction",
          note: note,
          allowOvercap: args.allowOvercap === true
        })).then(function (res) {
          if (!res || !res.ok || res.committed === false) {
            var why = (res && (res.error || (res.overcapIncrease ? "over cap (pass allowOvercap:true to override)" : (res.underflow && Object.keys(res.underflow).length ? "underflow" : "")))) || "refused";
            deny(TAG + " OP commit refused for " + actor.name + ": " + why);
          }
          changed = opChanged.concat(changed);
        })
      : Promise.resolve();

    return opStep.then(function () {
      var chain = Promise.resolve();
      meterOps.forEach(function (m) {
        chain = chain.then(function () {
          var fn = (m.key === "morale") ? fApi.setMorale : fApi.setLoyalty;
          var p = (typeof fn === "function")
            ? fn({ factionId: actor.id, value: m.value })
            : actor.setFlag(MODF, m.key, m.value);   // meter enhancer not loaded: same flag, same clamp
          return Promise.resolve(p).then(function () { changed.push({ path: m.path, old: m.old, next: m.value }); });
        });
      });
      return chain;
    }).then(function () {
      return Object.keys(flagUpd).length ? actor.update(flagUpd) : null;
    }).then(function () {
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
        return { ok: true, changed: changed };
      });
    });
  }

  // The only actor-scope path was `sparks.*`, which belongs to api.tikkun
  // (phased spark records + Enlightenment sync). setActor stays for API
  // compatibility but refuses rather than writing a flag nobody reads.
  function setActor(args) {
    args = args || {};
    if (!isGM()) deny("GM-only: setActor");

    var actorId = args.actorId;
    if (!actorId) deny("setActor requires actorId");
    var actor = game.actors.get(actorId);
    if (!actor) deny("Actor not found: " + actorId);

    var flat = flattenPatch(args.patch || {});
    flat.forEach(function (it) {
      if (!isAllowed("actor", it.path)) deny(TAG + " blocked write: actor " + it.path);
    });
    deny(TAG + " setActor: no live store mapped — actor sparks are owned by api.tikkun (markSparkPhase / depositSpark)");
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
