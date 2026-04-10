// bbttcc-world/apps/world-gm-panel.js
// GM God Panel — ApplicationV2 UI for BBTTCC World State.
// Foundry v13 PARTS-compatible. Robust against HandlebarsApplicationMixin being non-callable.
// parse-safe: avoid optional chaining, object spread; avoid arrow funcs.

(function(){
  "use strict";

  var TAG = "[bbttcc-world/gm-panel]";
  function log(){ try{ console.log.apply(console, [TAG].concat([].slice.call(arguments))); }catch(_e){} }
  function warn(){ try{ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); }catch(_e){} }

  function getWorldAPI(){
    try{
      return (game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.world) ? game.bbttcc.api.world : null;
    }catch(_e){ return null; }
  }

  function deepClone(obj){
    try { return foundry.utils.duplicate(obj); } catch(_e){}
    try { return JSON.parse(JSON.stringify(obj)); } catch(_e2){}
    return obj;
  }

  function toInt(n, fallback){
    var x = parseInt(n, 10);
    if (!isFinite(x)) x = parseInt(fallback, 10);
    if (!isFinite(x)) x = 0;
    return x;
  }

  function clampNumber(n, min, max, fallback){
    var x = Number(n);
    if (!isFinite(x)) x = Number(fallback);
    if (!isFinite(x)) x = 0;
    if (min != null && x < min) x = min;
    if (max != null && x > max) x = max;
    return x;
  }

  function isUserGM(){
    try{
      if (game && game.user && game.user.isGM) return true;
      var role = (game && game.user) ? Number(game.user.role) : NaN;
      if (isFinite(role) && role >= 4) return true;
    }catch(_e){}
    return false;
  }

  function readForm(rootEl){
    var fd = new FormData(rootEl);
    function get(name){ return fd.get(name); }
    function has(name){ return fd.has(name); }

    var patch = {};
    patch.turn = toInt(get("turn"), null);
    patch.darkness = clampNumber(get("darkness"), 0, 100, null);
    patch.pressureMod = clampNumber(get("pressureMod"), 0, 5, null);

    patch.time = {
      epoch: toInt(get("time.epoch"), 0),
      turnLength: toInt(get("time.turnLength"), 1),
      progress: toInt(get("time.progress"), 0)
    };

    patch.locks = {
      turnAdvance: has("locks.turnAdvance"),
      mutation: has("locks.mutation"),
      politics: has("locks.politics"),
      logistics: has("locks.logistics")
    };

    var note = get("note");
    var snapshotId = get("snapshotId");
    return {
      patch: patch,
      note: note != null ? String(note) : "",
      snapshotId: snapshotId != null ? String(snapshotId) : ""
    };
  }

  function stripUnchanged(patch, prev){
    var out = {};
    if (!prev) return patch;

    if (patch.turn !== prev.turn) out.turn = patch.turn;
    if (patch.darkness !== prev.darkness) out.darkness = patch.darkness;
    if (patch.pressureMod !== prev.pressureMod) out.pressureMod = patch.pressureMod;

    if (patch.time && prev.time) {
      var t = {};
      if (patch.time.epoch !== prev.time.epoch) t.epoch = patch.time.epoch;
      if (patch.time.turnLength !== prev.time.turnLength) t.turnLength = patch.time.turnLength;
      if (patch.time.progress !== prev.time.progress) t.progress = patch.time.progress;
      if (Object.keys(t).length) out.time = t;
    }

    if (patch.locks && prev.locks) {
      var l = {};
      if (!!patch.locks.turnAdvance !== !!prev.locks.turnAdvance) l.turnAdvance = !!patch.locks.turnAdvance;
      if (!!patch.locks.mutation    !== !!prev.locks.mutation)    l.mutation    = !!patch.locks.mutation;
      if (!!patch.locks.politics    !== !!prev.locks.politics)    l.politics    = !!patch.locks.politics;
      if (!!patch.locks.logistics   !== !!prev.locks.logistics)   l.logistics   = !!patch.locks.logistics;
      if (Object.keys(l).length) out.locks = l;
    }

    return out;
  }

  // Foundry application API
  var API = null;
  try { API = foundry.applications.api; } catch(_e) {}
  if (!API) { warn("foundry.applications.api missing"); return; }

  var ApplicationV2 = API.ApplicationV2;
  var HandlebarsApplicationMixin = API.HandlebarsApplicationMixin;
  var HandlebarsApplication = API.HandlebarsApplication;

  if (!ApplicationV2) { warn("ApplicationV2 unavailable"); return; }

  // Robust base class selection:
  // - If HandlebarsApplicationMixin is callable, use it (the v13-expected pattern).
  // - If it is NOT callable (some builds expose a class here), fall back to HandlebarsApplication if present.
  // - Else, fall back to ApplicationV2 (template render will not work, but at least app won't crash module init).
  var Base = ApplicationV2;
  try{
    if (HandlebarsApplicationMixin && typeof HandlebarsApplicationMixin === "function") {
      Base = HandlebarsApplicationMixin(ApplicationV2);
    } else if (HandlebarsApplication && typeof HandlebarsApplication === "function") {
      Base = HandlebarsApplication;
    }
  }catch(e){
    warn("Base selection failed; falling back to ApplicationV2", e);
    Base = ApplicationV2;
  }

  class BBTTCCWorldGMPanelApp extends Base {
    constructor(options){
      super(options || {});
      this._state = null;
      this._draft = null;
      this._lastNote = "";
    }

    static get PARTS(){
      return {
        content: { template: "modules/bbttcc-world/templates/world-gm-panel.hbs" }
      };
    }

    static get DEFAULT_OPTIONS(){
      var base = super.DEFAULT_OPTIONS || {};
      try{
        var merged = foundry.utils.mergeObject(base, {
          id: "bbttcc-world-gm-panel",
          classes: ["bbttcc-world-gm-panel-app"],
          title: "BBTTCC — GM God Panel",
          tag: "form",
          window: { icon: "fas fa-hand-sparkles", resizable: true }
        }, { inplace: false });
        return merged;
      }catch(_e){
        return base;
      }
    }

    _load(){
      var api = getWorldAPI();
      if (!api || typeof api.getState !== "function") return null;
      var st = api.getState();
      this._state = deepClone(st);
      if (!this._draft) this._draft = deepClone(st);
      return this._state;
    }

    _prepareContext(options){
      var ctx = (super._prepareContext) ? super._prepareContext(options) : {};
      this._load();
      ctx.state = this._state || {};
      ctx.draft = this._draft || ctx.state;
      ctx.userName = (game && game.user && game.user.name) ? String(game.user.name) : "Unknown";
      ctx.lastNote = this._lastNote || "";
      return ctx;
    }

    _onRender(context, options){
      if (super._onRender) super._onRender(context, options);
      var root = this.element;
      if (!root) return;

      // Cache instance for convenience
      try{
        game.bbttcc = game.bbttcc || {};
        game.bbttcc.worldGMPanel = this;
      }catch(_e){}

      this._populateFromState(root);
      this._populateEsoteric(root);

      var self = this;

      var btnApply = root.querySelector('[data-action="apply"]');
      if (btnApply) btnApply.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._applyFromForm();
      });

      var btnClear = root.querySelector('[data-action="clear"]');
      if (btnClear) btnClear.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._clearDraft();
      });

      var btnClose = root.querySelector('[data-action="close"]');
      if (btnClose) btnClose.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self.close();
      });

      var btnRefresh = root.querySelector('[data-action="refresh"]');
      if (btnRefresh) btnRefresh.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._refreshFromWorld();
      });

      var btnSnapCreate = root.querySelector('[data-action="snapshot-create"]');
      if (btnSnapCreate) btnSnapCreate.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._snapshotCreate();
      });

      var btnSnapRollback = root.querySelector('[data-action="snapshot-rollback"]');
      if (btnSnapRollback) btnSnapRollback.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._snapshotRollback();
      });

      var btnSnapDelete = root.querySelector('[data-action="snapshot-delete"]');
      if (btnSnapDelete) btnSnapDelete.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._snapshotDelete();
      });

      var btnSnapExport = root.querySelector('[data-action="snapshot-export"]');
      if (btnSnapExport) btnSnapExport.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._snapshotExport();
      });

      var btnSnapClearAll = root.querySelector('[data-action="snapshot-clear-all"]');
      if (btnSnapClearAll) btnSnapClearAll.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._snapshotClearAll();
      });

      var btnEsOpen = root.querySelector('[data-action="esoteric-open"]');
      if (btnEsOpen) btnEsOpen.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._esotericOpen();
      });

      var btnEsWhisper = root.querySelector('[data-action="esoteric-whisper"]');
      if (btnEsWhisper) btnEsWhisper.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        self._esotericWhisper();
      });
    }

    _getEsotericApi(){
      try {
        var mod = game && game.modules ? game.modules.get("esoteric-magic") : null;
        if (!mod || !mod.active) return null;
        return mod.api || null;
      } catch(_e){
        return null;
      }
    }

    _mapWatchToKey(slot){
      var s = slot != null ? String(slot) : "";
      if (s === "watch_0") return "dawn";
      if (s === "watch_1") return "noon";
      if (s === "watch_2") return "dusk";
      if (s === "watch_3") return "midnight";
      return "dawn";
    }

    _populateEsoteric(root){
      var statusEl = root.querySelector('[data-bind="esotericStatus"]');
      var tableEl = root.querySelector('[data-bind="esotericTable"]');
      if (!statusEl && !tableEl) return;

      function setStatus(txt){
        try { if (statusEl) statusEl.textContent = String(txt); } catch(_e) {}
      }
      function setHTML(html){
        try { if (tableEl) tableEl.innerHTML = String(html || ""); } catch(_e) {}
      }

      var api = this._getEsotericApi();
      if (!api || typeof api.getTimeContext !== "function") {
        setStatus("Esoteric Magic module is not active.");
        setHTML("");
        return;
      }

      var tc = null;
      try { tc = api.getTimeContext(); } catch(e) { tc = null; }
      if (!tc) {
        setStatus("Esoteric Magic is active, but time context is unavailable.");
        setHTML("");
        return;
      }

      var slot = tc.slot != null ? String(tc.slot) : "";
      var key = this._mapWatchToKey(slot);
      setStatus("Module: " + (game.modules.get("esoteric-magic").title || "Esoteric Magic") + " · Slot: " + slot + " · Key: " + key);

      var url = "modules/esoteric-magic/data/schools.json";
      var self = this;
      fetch(url, { cache: "no-store" })
        .then(function(r){
          if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "?"));
          return r.json();
        })
        .then(function(schools){
          var rows = [];
          try {
            Object.keys(schools || {}).forEach(function(name){
              var d = schools[name] || {};
              var b = d.bonuses && d.bonuses[key] ? d.bonuses[key] : null;
              if (!b) return;
              rows.push({
                school: name,
                sephirah: d.sephirah || "",
                tarot: d.tarot || "",
                astro: d.astro || "",
                day: d.day || "",
                bonus: b.label || ""
              });
            });
          } catch(_e) {}

          if (!rows.length) {
            setHTML('<div class="bbttcc-muted" style="opacity:.8;">No favored schools for this watch.</div>');
            return;
          }

          // Sort for stable display
          rows.sort(function(a,b){
            return String(a.school).localeCompare(String(b.school));
          });

          var html = '';
          html += '<div style="display:flex; flex-wrap:wrap; gap:.25rem; margin:.25rem 0 .35rem;">';
          rows.forEach(function(r){
            html += '<span class="bbttcc-pill bbttcc-pill-primary">' + foundry.utils.escapeHTML(String(r.school)) + '</span>';
          });
          html += '</div>';

          html += '<table style="width:100%; border-collapse:collapse;">';
          html += '<thead><tr style="opacity:.9; text-align:left;">'
            + '<th style="padding:.25rem .35rem;">School</th>'
            + '<th style="padding:.25rem .35rem;">Sephirah</th>'
            + '<th style="padding:.25rem .35rem;">Tarot</th>'
            + '<th style="padding:.25rem .35rem;">Astro</th>'
            + '<th style="padding:.25rem .35rem;">Day</th>'
            + '<th style="padding:.25rem .35rem;">Influence</th>'
            + '</tr></thead><tbody>';

          rows.forEach(function(r, idx){
            var bg = (idx % 2 === 0) ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.06)';
            html += '<tr style="background:' + bg + ';">'
              + '<td style="padding:.25rem .35rem;">' + foundry.utils.escapeHTML(String(r.school)) + '</td>'
              + '<td style="padding:.25rem .35rem;">' + foundry.utils.escapeHTML(String(r.sephirah)) + '</td>'
              + '<td style="padding:.25rem .35rem;">' + foundry.utils.escapeHTML(String(r.tarot)) + '</td>'
              + '<td style="padding:.25rem .35rem;">' + foundry.utils.escapeHTML(String(r.astro)) + '</td>'
              + '<td style="padding:.25rem .35rem;">' + foundry.utils.escapeHTML(String(r.day)) + '</td>'
              + '<td style="padding:.25rem .35rem;">' + foundry.utils.escapeHTML(String(r.bonus)) + '</td>'
              + '</tr>';
          });

          html += '</tbody></table>';
          setHTML(html);

          // Cache last computed payload for whisper.
          self._esotericLast = { tc: tc, key: key, rows: rows };
        })
        .catch(function(e){
          setHTML('<div class="bbttcc-muted" style="opacity:.8;">Failed to load schools.json (' + foundry.utils.escapeHTML(String(e && e.message ? e.message : e)) + ')</div>');
        });
    }

    _esotericOpen(){
      var api = this._getEsotericApi();
      if (api && typeof api.openCorrespondences === "function") {
        api.openCorrespondences();
      } else {
        ui.notifications.warn("Esoteric Magic API not available.");
      }
    }

    _esotericWhisper(){
      if (!isUserGM()) { ui.notifications.warn("GM only."); return; }

      var api = this._getEsotericApi();
      if (!api || typeof api.getTimeContext !== "function") {
        ui.notifications.warn("Esoteric Magic not available.");
        return;
      }

      var payload = this._esotericLast;
      if (!payload || !payload.tc) {
        // Best-effort refresh
        this._populateEsoteric(this.element);
        ui.notifications.info("Esoteric influences refreshed. Try again.");
        return;
      }

      var tc = payload.tc;
      var key = payload.key;
      var rows = payload.rows || [];
      var list = rows.map(function(r){ return r.school + ": " + r.bonus; }).join("\n");

      var header = "**Esoteric Influences**";
      var line1 = "Slot: **" + String(tc.slot || "?") + "** (segment " + String(tc.segment != null ? tc.segment : "?") + ", turn " + String(tc.turn != null ? tc.turn : "?") + ")";
      var line2 = "Key: **" + String(key) + "**";
      var body = rows.length ? list : "(No favored schools.)";
      var mal = "Reality leans in. The hour has teeth.";

      var content = header + "\n" + line1 + "\n" + line2 + "\n\n" + body + "\n\n*" + mal + "*";
      try {
        ChatMessage.create({
          content: content,
          whisper: [game.user.id]
        });
        ui.notifications.info("Whispered influences.");
      } catch(e) {
        warn("whisper failed", e);
        ui.notifications.error("Whisper failed.");
      }
    }

    _refreshFromWorld(){
      var api = getWorldAPI();
      var st = (api && api.getState) ? api.getState() : null;
      if (!st) return;
      this._state = deepClone(st);
      this._draft = deepClone(st);
      this.render({ force: true });
    }

    _clearDraft(){
      var api = getWorldAPI();
      var st = (api && api.getState) ? api.getState() : {};
      this._state = this._state || deepClone(st);
      this._draft = deepClone(this._state);
      this._lastNote = "";
      ui.notifications.info("Draft cleared.");
      this.render({ force: true });
    }

    _applyFromForm(){
      if (!isUserGM()) {
        ui.notifications.warn("GM only.");
        return;
      }

      var api = getWorldAPI();
      if (!api || typeof api.applyGMEdit !== "function") {
        ui.notifications.error("World API missing (applyGMEdit).");
        return;
      }

      var formEl = this.element;
      if (!formEl) return;

      var rf = readForm(formEl);
      this._lastNote = rf.note;

      var prev = this._state || api.getState();
      var patch = stripUnchanged(rf.patch, prev);

      if (!patch || !Object.keys(patch).length) {
        ui.notifications.info("No changes to apply.");
        return;
      }

      var self = this;
      api.applyGMEdit(patch, { note: rf.note })
        .then(function(res){
          self._state = api.getState();
          self._draft = deepClone(self._state);
          ui.notifications.info("World state updated.");
          self.render({ force: true });
          return res;
        })
        .catch(function(e){
          warn("apply failed", e);
          ui.notifications.error("Apply failed (see console).");
        });
    }

    _getSelectedSnapshotId(){
      try {
        var formEl = this.element;
        if (!formEl) return "";
        var sel = formEl.querySelector('select[name="snapshotId"]');
        return sel && sel.value ? String(sel.value) : "";
      } catch(_e){
        return "";
      }
    }

    _snapshotCreate(){
      if (!isUserGM()) { ui.notifications.warn("GM only."); return; }
      var api = getWorldAPI();
      if (!api || typeof api.createSnapshot !== "function") {
        ui.notifications.error("World API missing (createSnapshot).");
        return;
      }

      var formEl = this.element;
      var rf = formEl ? readForm(formEl) : { note: "" };
      this._lastNote = rf.note || this._lastNote || "";
      var self = this;

      api.createSnapshot({ note: rf.note })
        .then(function(res){
          ui.notifications.info("Snapshot saved.");
          self.render({ force: true });
          return res;
        })
        .catch(function(e){
          warn("snapshot-create failed", e);
          ui.notifications.error("Snapshot save failed (see console).");
        });
    }

    _snapshotRollback(){
      if (!isUserGM()) { ui.notifications.warn("GM only."); return; }
      var api = getWorldAPI();
      if (!api || typeof api.rollbackSnapshot !== "function") {
        ui.notifications.error("World API missing (rollbackSnapshot).");
        return;
      }
      var id = this._getSelectedSnapshotId();
      if (!id) { ui.notifications.warn("Pick a snapshot."); return; }

      var formEl = this.element;
      var rf = formEl ? readForm(formEl) : { note: "" };
      this._lastNote = rf.note || this._lastNote || "";
      var self = this;
      api.rollbackSnapshot(id, { note: rf.note })
        .then(function(res){
          if (!res || !res.ok) {
            ui.notifications.error("Rollback failed.");
            return res;
          }
          self._state = api.getState();
          self._draft = deepClone(self._state);
          ui.notifications.info("Rolled back to snapshot.");
          self.render({ force: true });
          return res;
        })
        .catch(function(e){
          warn("snapshot-rollback failed", e);
          ui.notifications.error("Rollback failed (see console).");
        });
    }

    _snapshotDelete(){
      if (!isUserGM()) { ui.notifications.warn("GM only."); return; }
      var api = getWorldAPI();
      if (!api || typeof api.deleteSnapshot !== "function") {
        ui.notifications.error("World API missing (deleteSnapshot).");
        return;
      }
      var id = this._getSelectedSnapshotId();
      if (!id) { ui.notifications.warn("Pick a snapshot."); return; }
      var self = this;
      api.deleteSnapshot(id)
        .then(function(_res){
          ui.notifications.info("Snapshot deleted.");
          self.render({ force: true });
        })
        .catch(function(e){
          warn("snapshot-delete failed", e);
          ui.notifications.error("Delete failed (see console).");
        });
    }

    _snapshotExport(){
      if (!isUserGM()) { ui.notifications.warn("GM only."); return; }
      var api = getWorldAPI();
      if (!api || typeof api.exportSnapshot !== "function") {
        ui.notifications.error("World API missing (exportSnapshot).");
        return;
      }
      var id = this._getSelectedSnapshotId();
      if (!id) { ui.notifications.warn("Pick a snapshot."); return; }
      var res = api.exportSnapshot(id);
      if (res && res.ok) ui.notifications.info("Export started.");
      else ui.notifications.error("Export failed.");
    }

    _snapshotClearAll(){
      if (!isUserGM()) { ui.notifications.warn("GM only."); return; }
      var api = getWorldAPI();
      if (!api || typeof api.clearAllSnapshots !== "function") {
        ui.notifications.error("World API missing (clearAllSnapshots).");
        return;
      }
      var self = this;
      api.clearAllSnapshots()
        .then(function(){
          ui.notifications.info("Snapshots cleared.");
          self.render({ force: true });
        })
        .catch(function(e){
          warn("snapshot-clear-all failed", e);
          ui.notifications.error("Clear all failed (see console).");
        });
    }

    _populateFromState(root){
      var api = getWorldAPI();
      var st = this._state || (api && api.getState ? api.getState() : null) || {};
      var t = st.time || {};
      var locks = st.locks || {};

      function setVal(sel, val){
        var el = root.querySelector(sel);
        if (el) el.value = (val != null ? String(val) : "");
      }
      function setChk(sel, on){
        var el = root.querySelector(sel);
        if (el) el.checked = !!on;
      }
      function setText(sel, txt){
        var el = root.querySelector(sel);
        if (el) el.textContent = String(txt);
      }

      setVal('input[name="turn"]', st.turn);
      setVal('input[name="darkness"]', st.darkness);
      setVal('input[name="pressureMod"]', st.pressureMod);

      setVal('input[name="time.epoch"]', t.epoch);
      setVal('input[name="time.turnLength"]', t.turnLength);
      setVal('input[name="time.progress"]', t.progress);

      setChk('input[name="locks.turnAdvance"]', locks.turnAdvance);
      setChk('input[name="locks.mutation"]', locks.mutation);
      setChk('input[name="locks.politics"]', locks.politics);
      setChk('input[name="locks.logistics"]', locks.logistics);

      setText('[data-bind="userName"]', (game && game.user && game.user.name) ? game.user.name : "Unknown");
      setText('[data-bind="turn"]', st.turn != null ? st.turn : 0);
      setText('[data-bind="timeProgress"]', t.progress != null ? t.progress : 0);
      setText('[data-bind="timeTurnLength"]', t.turnLength != null ? t.turnLength : 1);

      // Snapshots select + count
      try {
        var snaps = (api && typeof api.listSnapshots === "function") ? api.listSnapshots() : [];
        if (!Array.isArray(snaps)) snaps = [];

        var sel = root.querySelector('select[name="snapshotId"]');
        if (sel) {
          var cur = sel.value ? String(sel.value) : "";
          // rebuild options
          while (sel.firstChild) sel.removeChild(sel.firstChild);
          var opt0 = document.createElement("option");
          opt0.value = "";
          opt0.textContent = "(none)";
          sel.appendChild(opt0);

          snaps.forEach(function(s){
            try {
              var o = document.createElement("option");
              o.value = s.id;
              var when = "";
              try { when = s.at ? (new Date(s.at)).toLocaleString() : ""; } catch(_e2) {}
              o.textContent = (s.label || s.id) + (when ? (" — " + when) : "");
              sel.appendChild(o);
            } catch(_e3){}
          });
          if (cur) sel.value = cur;
        }

        var cnt = root.querySelector('[data-bind="snapshotCount"]');
        if (cnt) cnt.textContent = String(snaps.length);
      } catch(e){ warn("snapshot list render failed", e); }
    }
  }

  // Attach globally for menu registration.
  try{ globalThis.BBTTCCWorldGMPanelApp = BBTTCCWorldGMPanelApp; }catch(_e){}
  log("GM Panel attached (globalThis.BBTTCCWorldGMPanelApp).");

})();
