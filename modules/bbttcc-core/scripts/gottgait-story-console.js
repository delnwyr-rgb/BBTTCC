// modules/bbttcc-core/scripts/gottgait-story-console.js
// FULL REPLACEMENT (compat): removes left column, adds Quest/Turn filters, removes 60-beat cap,
// and avoids newer JS syntax that can break older parsers (no class fields, no optional chaining,
// no replaceAll, no arrow funcs).

(function () {
  var TAG = "[GOTTGAIT StoryConsole]";
  var api = (foundry && foundry.applications && foundry.applications.api) ? foundry.applications.api : null;
  var ApplicationV2 = api ? api.ApplicationV2 : null;
  var HandlebarsApplicationMixin = api ? api.HandlebarsApplicationMixin : null;

  function _warn() {
    try { console.warn.apply(console, arguments); } catch (e) {}
  }

  function safeGetCampaignStore() {
    try {
      var raw = game.settings && game.settings.get ? game.settings.get("bbttcc-campaign", "campaigns") : null;
      if (!raw) return { kind: "none", map: {}, list: [] };

      if (Array.isArray(raw)) {
        var listA = raw.filter(function (x) { return !!x; });
        var mapA = {};
        listA.forEach(function (c) { if (c && c.id) mapA[c.id] = c; });
        return { kind: "array", map: mapA, list: listA };
      }

      if (typeof raw === "object") {
        var mapM = raw;
        var listM = [];
        Object.keys(mapM).forEach(function (k) { if (mapM[k]) listM.push(mapM[k]); });
        return { kind: "map", map: mapM, list: listM };
      }

      return { kind: (typeof raw), map: {}, list: [] };
    } catch (e) {
      _warn(TAG, "safeGetCampaignStore failed:", e);
      return { kind: "error", map: {}, list: [] };
    }
  }

  function safeGetTableStore() {
    try {
      var raw = game.settings && game.settings.get ? game.settings.get("bbttcc-campaign", "encounterTables") : null;
      if (!raw) return { kind: "none", map: {}, list: [] };

      if (Array.isArray(raw)) {
        var listA = raw.filter(function (x) { return !!x; });
        var mapA = {};
        listA.forEach(function (t) { if (t && t.id) mapA[t.id] = t; });
        return { kind: "array", map: mapA, list: listA };
      }

      if (typeof raw === "object") {
        var mapM = raw;
        var listM = [];
        Object.keys(mapM).forEach(function (k) { if (mapM[k]) listM.push(mapM[k]); });
        return { kind: "map", map: mapM, list: listM };
      }

      return { kind: (typeof raw), map: {}, list: [] };
    } catch (e) {
      _warn(TAG, "safeGetTableStore failed:", e);
      return { kind: "error", map: {}, list: [] };
    }
  }

  function _getStoryApi() {
    return game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.story && game.bbttcc.api.story.gottgait
      ? game.bbttcc.api.story.gottgait
      : null;
  }

  function _getStoryState() {
    var story = _getStoryApi();
    if (!story || !story.getState) return {};
    try { return story.getState() || {}; } catch (e) { return {}; }
  }

  function _patchStoryState(patch) {
    var story = _getStoryApi();
    if (!story || !story.updateState) return Promise.resolve(false);
    try {
      return Promise.resolve(story.updateState(patch || {})).then(function () { return true; }, function () { return false; });
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function getActiveCampaignId() {
    var s = _getStoryState();
    return (s && s.activeCampaignId) ? s.activeCampaignId : null;
  }

  function setActiveCampaignId(campaignId) {
    if (!campaignId) return Promise.resolve(false);
    return _patchStoryState({ activeCampaignId: campaignId }).then(function (ok) {
      if (!ok && ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Could not persist active campaign (story state not ready).");
      return ok;
    });
  }

  function _splitTags(tagStr) {
    return String(tagStr || "").split(/\s+/g).map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
  }

  function _hasTag(beat, tag) {
    if (!tag) return false;
    var tags = _splitTags(beat && beat.tags ? beat.tags : "");
    for (var i = 0; i < tags.length; i++) if (tags[i] === tag) return true;
    return false;
  }

  function _fmtBeatLabel(b) {
    var name = String((b && (b.label || b.title || b.id || b.beatId)) || "Beat").trim();
    var type = String((b && b.type) || "beat").trim();
    var ts = String((b && b.timeScale) || "").trim();
    var meta = ts ? (type + "/" + ts) : type;
    return name + " (" + meta + ")";
  }

  var TAG_GROUPS = [
    { id:"tag-inject-travel-threshold", tag:"inject.travel_threshold", label:"Campaign Beats — Inject / Travel Threshold", description:"Beats eligible for travel-threshold style injection." },
    { id:"tag-inject-enforcement",      tag:"inject.enforcement",      label:"Campaign Beats — Inject / Enforcement", description:"Advisor-facing escalation beats." },
    { id:"tag-inject-debt",             tag:"inject.debt_pressure",    label:"Campaign Beats — Inject / Debt Pressure", description:"Pressure and scarcity beats the advisor can lean on." },
    { id:"tag-theme-discovery",         tag:"theme.discovery",         label:"Campaign Beats — Theme / Discovery", description:"Exploration and follow-up beats useful for softer cadence." }
  ];

  function _getConsoleFilters(state) {
    state = state || {};
    var f = state.consoleFilters || {};
    return {
      turn: (f.turn != null ? String(f.turn) : "all"),
      questId: (f.questId != null ? String(f.questId) : "all")
    };
  }

  function _beatPassesConsoleFilters(beat, filters) {
    filters = filters || { turn: "all", questId: "all" };

    // Turn
    var fTurn = String(filters.turn || "all");
    var bTurn = (beat && beat.turnNumber != null) ? String(beat.turnNumber) : "";
    if (fTurn !== "all") {
      if (fTurn === "unassigned") {
        if (bTurn && String(bTurn).trim() !== "") return false;
      } else if (bTurn !== fTurn) return false;
    }

    // Quest
    var fQuest = String(filters.questId || "all");
    var bQuest = (beat && beat.questId != null) ? String(beat.questId) : "";
    if (fQuest !== "all") {
      if (fQuest === "none") {
        if (bQuest && String(bQuest).trim() !== "") return false;
      } else if (bQuest !== fQuest) return false;
    }

    return true;
  }

  function _escapeHtml(s) {
    s = String(s == null ? "" : s);
    return s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function promptInjectorFire(opts) {
    opts = opts || {};
    var campaignId = opts.campaignId || "";
    var defaultHexUuid = opts.defaultHexUuid || "";
    var defaultTags = opts.defaultTags || "";

    var story = _getStoryApi();
    var state = (story && story.getState) ? (story.getState() || {}) : {};
    var last = state.injectorLast || {};
    var hexUuid = defaultHexUuid || last.hexUuid || "";
    var tags = defaultTags || last.tags || "inject.travel_threshold";
    var allowMulti = !!(last.allowMulti != null ? last.allowMulti : false);
    var fallbackOnDecline = !!(last.fallbackOnDecline != null ? last.fallbackOnDecline : true);

    var content =
      '<form class="bbttcc-form">' +
        '<div class="form-group"><label>Hex UUID</label>' +
        '<input type="text" name="hexUuid" value="' + _escapeHtml(hexUuid) + '" placeholder="e.g. test-hex-17" />' +
        '</div>' +
        '<div class="form-group"><label>Tags</label>' +
        '<input type="text" name="tags" value="' + _escapeHtml(tags) + '" placeholder="space separated tags" />' +
        '</div>' +
        '<div class="form-group"><label class="checkbox">' +
        '<input type="checkbox" name="allowMulti" ' + (allowMulti ? "checked" : "") + '/> Allow Multi</label></div>' +
        '<div class="form-group"><label class="checkbox">' +
        '<input type="checkbox" name="fallbackOnDecline" ' + (fallbackOnDecline ? "checked" : "") + '/> Fallback on Decline</label></div>' +
      '</form>';

    return new Promise(function (resolve) {
      new Dialog({
        title: "Injector Fire — " + (campaignId || "No Active Campaign"),
        content: content,
        buttons: {
          fire: {
            icon: '<i class="fas fa-bolt"></i>',
            label: "FIRE",
            callback: function (html) {
              var form = html && html[0] ? html[0].querySelector("form") : null;
              var data = form ? new FormData(form) : null;
              resolve({
                campaignId: campaignId,
                hexUuid: String(data ? (data.get("hexUuid") || "") : "").trim(),
                tags: String(data ? (data.get("tags") || "") : "").trim(),
                allowMulti: !!(data && data.get("allowMulti")),
                fallbackOnDecline: !!(data && data.get("fallbackOnDecline"))
              });
            }
          },
          cancel: { icon:'<i class="fas fa-times"></i>', label:"Cancel", callback:function(){ resolve(null); } }
        },
        default: "fire"
      }).render(true);
    });
  }

  function promptRandomTableFire(opts) {
    opts = opts || {};
    var defaultTableId = opts.defaultTableId || "";
    var defaultHexUuid = opts.defaultHexUuid || "";
    var defaultTags = opts.defaultTags || "";

    var story = _getStoryApi();
    var state = (story && story.getState) ? (story.getState() || {}) : {};
    var last = state.tableLast || {};

    var tables = safeGetTableStore();
    var tableList = tables.list || [];
    var tableId = defaultTableId || last.tableId || (tableList[0] ? tableList[0].id : "") || "";
    var hexUuid = defaultHexUuid || last.hexUuid || "";
    var tags = defaultTags || last.tags || "";

    var optionsHtml = "";
    if (tableList.length) {
      tableList.forEach(function (t) {
        var id = _escapeHtml(t.id);
        var lbl = _escapeHtml(t.label || t.id);
        var sel = (t.id === tableId) ? "selected" : "";
        optionsHtml += '<option value="' + id + '" ' + sel + '>' + lbl + " (" + id + ")</option>";
      });
    } else {
      optionsHtml = '<option value="">(No tables found)</option>';
    }

    var content =
      '<form class="bbttcc-form">' +
        '<div class="form-group"><label>Encounter Table</label>' +
        '<select name="tableId">' + optionsHtml + '</select>' +
        '<p class="notes" style="opacity:0.85">Tables are stored in bbttcc-campaign settings and select beats to run.</p>' +
        '</div>' +
        '<div class="form-group"><label>Hex UUID (optional)</label>' +
        '<input type="text" name="hexUuid" value="' + _escapeHtml(hexUuid) + '" placeholder="e.g. test-hex-17" />' +
        '</div>' +
        '<div class="form-group"><label>Tags (optional)</label>' +
        '<input type="text" name="tags" value="' + _escapeHtml(tags) + '" placeholder="space separated tags" />' +
        '</div>' +
      '</form>';

    return new Promise(function (resolve) {
      new Dialog({
        title: "Random Table Fire — Mal’s Dice Have Opinions",
        content: content,
        buttons: {
          fire: {
            icon: '<i class="fas fa-dice"></i>',
            label: "FIRE",
            callback: function (html) {
              var form = html && html[0] ? html[0].querySelector("form") : null;
              var data = form ? new FormData(form) : null;
              resolve({
                tableId: String(data ? (data.get("tableId") || "") : "").trim(),
                hexUuid: String(data ? (data.get("hexUuid") || "") : "").trim(),
                tags: String(data ? (data.get("tags") || "") : "").trim()
              });
            }
          },
          cancel: { icon:'<i class="fas fa-times"></i>', label:"Cancel", callback:function(){ resolve(null); } }
        },
        default: "fire"
      }).render(true);
    });
  }

  if (!ApplicationV2 || !HandlebarsApplicationMixin) {
    _warn(TAG, "ApplicationV2 API not found; story console not installed.");
    return;
  }

  class GOTTGAITStoryConsole extends HandlebarsApplicationMixin(ApplicationV2) {

    static get DEFAULT_OPTIONS() {
      var base = super.DEFAULT_OPTIONS || {};
      var merged = foundry.utils.mergeObject(base, {
        id: "gottgait-story-console",
        title: "GOTTGAIT Story Console",
        popOut: true,
        resizable: true,
        window: { resizable: true },
        position: { top: 80, left: 80, width: 960, height: 780 },
        classes: ["bbttcc", "bbttcc-hexchrome", "gottgait-console"]
      }, { inplace: false });
      return merged;
    }

    static get PARTS() {
      return {
        main: { id: "main", template: "modules/bbttcc-core/templates/gottgait-story-console.hbs" }
      };
    }

    async _prepareContext() {
      var story = _getStoryApi();
      var stage = story && story.getStage ? story.getStage() : "none";
      var state = story && story.getState ? (story.getState() || {}) : {};

      var baseGroups = [];

      var camps = safeGetCampaignStore();
      var campMap = camps.map || {};
      var campList = camps.list || [];

      var storedActiveId = getActiveCampaignId();
      var defaultActiveId = campList[0] ? campList[0].id : null;
      var activeCampaignId = storedActiveId || defaultActiveId;
      var activeCampaign = activeCampaignId ? campMap[activeCampaignId] : null;
      var activeBeats = (activeCampaign && Array.isArray(activeCampaign.beats)) ? activeCampaign.beats : [];

      // Filters
      var filters = _getConsoleFilters(state);

      // Turn options
      var turnNums = [];
      activeBeats.forEach(function (b) {
        if (b && b.turnNumber != null && String(b.turnNumber).trim() !== "") {
          var n = Number(b.turnNumber);
          if (isFinite(n)) turnNums.push(n);
        }
      });
      var maxTurn = turnNums.length ? Math.max.apply(null, turnNums) : 0;
      var turnOptions = [{ value: "all", label: "All Turns" }, { value: "unassigned", label: "Unassigned" }];
      for (var t = 1; t <= maxTurn; t++) turnOptions.push({ value: String(t), label: "Turn " + t });

      // Quest options
      var questOptions = [{ value: "all", label: "All Quests" }, { value: "none", label: "No Quest" }];
      try {
        var campApi = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign ? game.bbttcc.api.campaign : null;
        var questsApi = campApi && campApi.quests ? campApi.quests : null;

        var qList = [];
        if (questsApi && typeof questsApi.listQuests === "function") {
          qList = questsApi.listQuests({ campaignId: activeCampaignId, status: "all", search: "" }) || [];
        } else if (activeCampaign) {
          // Fallback to embedded campaign fields (legacy / older worlds)
          if (Array.isArray(activeCampaign.quests)) qList = activeCampaign.quests;
          else if (Array.isArray(activeCampaign.questList)) qList = activeCampaign.questList;
        }

        if (Array.isArray(qList)) {
          for (var qi = 0; qi < qList.length; qi++) {
            var q = qList[qi];
            if (!q) continue;
            var qid = String(q.id || q.questId || q.key || q.slug || "").trim();
            if (!qid) continue;
            var qname = String(q.name || q.label || q.title || qid).trim();
            questOptions.push({ value: qid, label: qname });
          }
        }
      } catch (_qe) {}

      var filtersActive = (filters.turn && filters.turn !== "all") || (filters.questId && filters.questId !== "all");

      var campaignGroups = [];

      if (campList.length) {
        // Activate buttons (keep short)
        campaignGroups.push({
          id: "campaign-activate",
          label: "Campaign Engine — Activate",
          description: activeCampaign
            ? ("Active: " + (activeCampaign.label || activeCampaign.title || activeCampaign.id))
            : "No active campaign selected.",
          beats: campList.filter(function (c) { return c && c.id; }).slice(0, 12).map(function (c) {
            return { key: "campaign.activate:" + c.id, label: "Activate: " + (c.label || c.title || c.id) };
          })
        });

        if (activeCampaign && activeCampaign.id) {
          campaignGroups.push({
            id: "campaign-open-builder",
            label: "Campaign Engine — Authoring",
            description: "Jump straight to the Campaign Builder for the active campaign.",
            beats: [{ key: "campaign.openBuilder:" + activeCampaign.id, label: "Open Campaign Builder: " + (activeCampaign.label || activeCampaign.id) }]
          });

          campaignGroups.push({
            id: "campaign-injector-fire",
            label: "Campaign Engine — Injector",
            description: "Manually fire the injector for a hex + tag bundle.",
            beats: [{ key: "campaign.injectorFire:" + activeCampaign.id, label: "Injector Fire…" }]
          });

          campaignGroups.push({
            id: "campaign-random-table",
            label: "Campaign Engine — Random Encounters",
            description: "Fire a Random Encounter Table (tables select beats; beats run normally).",
            beats: [{ key: "campaign.tableFire", label: "Random Table Fire…" }]
          });

          // All beats (UN-CAPPED, scroll handled by CSS)
          var all = [];
          for (var i = 0; i < activeBeats.length; i++) {
            var b = activeBeats[i];
            var bid = b ? (b.id || b.beatId) : null;
            if (!bid) continue;
            if (!_beatPassesConsoleFilters(b, filters)) continue;
            all.push({
              key: "campaign.run:" + activeCampaign.id + ":" + bid,
              label: (String(i + 1).padStart ? String(i + 1).padStart(2, "0") : (i + 1)) + " — " + _fmtBeatLabel(b)
            });
          }

          if (all.length) {
            var turnLbl = (filters.turn === "all") ? "All Turns" : (filters.turn === "unassigned" ? "Unassigned" : ("Turn " + filters.turn));
            var questLbl = (filters.questId === "all") ? "All Quests" : (filters.questId === "none" ? "No Quest" : ("Quest " + filters.questId));
            campaignGroups.push({
              id: "campaign-all",
              label: filtersActive ? "Campaign Beats — Filtered (Ordered)" : "Campaign Beats — All (Ordered)",
              description: filtersActive
                ? ("Filtered by: " + turnLbl + " • " + questLbl + " (Active campaign, authoring order)")
                : "All beats from the ★ Active campaign, in authoring order.",
              beats: all
            });
          }

          // Tag groups (keep reasonable)
          for (var gi = 0; gi < TAG_GROUPS.length; gi++) {
            var g = TAG_GROUPS[gi];
            var picks = [];
            for (var j = 0; j < activeBeats.length; j++) {
              var bb = activeBeats[j];
              var bbid = bb ? (bb.id || bb.beatId) : null;
              if (!bbid) continue;
              if (!_hasTag(bb, g.tag)) continue;
              if (!_beatPassesConsoleFilters(bb, filters)) continue;
              picks.push({ key: "campaign.run:" + activeCampaign.id + ":" + bbid, label: _fmtBeatLabel(bb) });
              if (picks.length >= 24) break;
            }
            if (picks.length) campaignGroups.push({ id: "campaign-" + g.id, label: g.label, description: g.description, beats: picks });
          }
        }
      }

      var gmFactionId = null;
      try {
        gmFactionId = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.agent && game.bbttcc.api.agent.gm && typeof game.bbttcc.api.agent.gm.inferFactionId === "function")
          ? game.bbttcc.api.agent.gm.inferFactionId({ activeCampaignId: activeCampaignId })
          : null;
      } catch (_gme) {}

      var gmGroups = [{
        id: "gm-advisor",
        label: "GM Advisor — World Signals + Escalation",
        description: gmFactionId
          ? ("Run world-pressure analysis for the inferred faction context (" + gmFactionId + ").")
          : "Run world-pressure analysis for the inferred faction context.",
        beats: [{ key: "gm.advisor.refresh", label: "Run GM Advisor" }]
      }];

      var groups = gmGroups.concat(campaignGroups).concat(baseGroups);
      // We removed left column; keep beatLog only if template wants it (it won't).
      var beatLog = Array.isArray(state.beats) ? state.beats.slice(-10).reverse() : [];
      return { stage: stage, groups: groups, beatLog: beatLog, filters: filters, turnOptions: turnOptions, questOptions: questOptions };
    }

    _onRender(context, options) {
      var self = this;
      var p = super._onRender(context, options);

      function after() {
        // Filters
        try {
          var root = self.element;
          var turnSel = root ? root.querySelector("select[name='filterTurn']") : null;
          var questSel = root ? root.querySelector("select[name='filterQuest']") : null;

          var apply = function () {
            var next = {
              turn: turnSel ? String(turnSel.value || "all") : "all",
              questId: questSel ? String(questSel.value || "all") : "all"
            };
            _patchStoryState({ consoleFilters: next }).then(function () { self.render(false); });
          };

          if (turnSel) turnSel.addEventListener("change", apply);
          if (questSel) questSel.addEventListener("change", apply);
        } catch (e) {}

        // Buttons
        try {
          var story = _getStoryApi();
          var campaignRunBeat = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign ? game.bbttcc.api.campaign.runBeat : null;
          var campaignOpenBuilder = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign ? game.bbttcc.api.campaign.openBuilder : null;
          var injector = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign ? game.bbttcc.api.campaign.injector : null;
          var tableApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign ? game.bbttcc.api.campaign.tables : null;

          var btns = self.element ? self.element.querySelectorAll("[data-action='beat']") : [];
          for (var i = 0; i < btns.length; i++) {
            (function (btn) {
              btn.addEventListener("click", function (event) {
                event.preventDefault();
                var beat = btn.dataset ? btn.dataset.beat : null;
                if (!beat) return;

                // Activate
                if (beat.indexOf("campaign.activate:") === 0) {
                  var campaignId = beat.substring("campaign.activate:".length);
                  setActiveCampaignId(campaignId).then(function (ok) {
                    if (ok && ui && ui.notifications && ui.notifications.info) ui.notifications.info("Campaign activated: " + campaignId);
                    self.render(false);
                  });
                  return;
                }

                // Open Builder
                if (beat.indexOf("campaign.openBuilder:") === 0) {
                  var cid = beat.substring("campaign.openBuilder:".length);
                  if (typeof campaignOpenBuilder !== "function") {
                    if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Campaign Builder UI not available.");
                    return;
                  }
                  campaignOpenBuilder(cid);
                  return;
                }

                // Injector
                if (beat.indexOf("campaign.injectorFire:") === 0) {
                  var cid2 = beat.substring("campaign.injectorFire:".length);
                  if (!injector || typeof injector.fire !== "function") {
                    if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Campaign injector not available.");
                    return;
                  }

                  promptInjectorFire({ campaignId: cid2 }).then(function (payload) {
                    if (!payload) return;

                    _patchStoryState({ injectorLast: { hexUuid: payload.hexUuid || "", tags: payload.tags || "", allowMulti: !!payload.allowMulti, fallbackOnDecline: !!payload.fallbackOnDecline } })
                      .then(function () {
                        if (!payload.hexUuid) {
                          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Injector Fire cancelled: hexUuid is required.");
                          return;
                        }
                        return injector.fire(payload);
                      });
                  });
                  return;
                }

                // Random Table Fire
                if (beat === "campaign.tableFire") {
                  if (!tableApi || typeof tableApi.runRandomTable !== "function") {
                    if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Campaign tables API not available (update bbttcc-campaign module.js).");
                    return;
                  }
                  promptRandomTableFire({}).then(function (payload) {
                    if (!payload) return;
                    _patchStoryState({ tableLast: { tableId: payload.tableId || "", hexUuid: payload.hexUuid || "", tags: payload.tags || "" } })
                      .then(function () {
                        if (!payload.tableId) {
                          if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Random Table Fire cancelled: tableId is required.");
                          return;
                        }
                        return tableApi.runRandomTable({ tableId: payload.tableId, hexUuid: payload.hexUuid || null, tags: payload.tags || "" });
                      });
                  });
                  return;
                }

                // Run Beat
                if (beat.indexOf("campaign.run:") === 0) {
                  var parts = beat.split(":");
                  var campaignId3 = parts[1] || null;
                  var beatId = parts.slice(2).join(":") || "";
                  if (!campaignId3 || !beatId) {
                    if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Campaign run: missing campaignId/beatId.");
                    return;
                  }
                  if (typeof campaignRunBeat !== "function") {
                    if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Campaign runBeat API not found.");
                    return;
                  }
                  Promise.resolve(campaignRunBeat(campaignId3, beatId));
                  return;
                }

                if (beat === "gm.advisor.refresh") {
                  var gmApi = game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.agent && game.bbttcc.api.agent.gm ? game.bbttcc.api.agent.gm : null;
                  if (!gmApi || typeof gmApi.recommendWorldSignals !== "function") {
                    if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("GM Advisor API not available.");
                    return;
                  }
                  Promise.resolve(gmApi.recommendWorldSignals()).then(function (res) {
                    if (!res || !res.ok) {
                      if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("GM Advisor could not produce a recommendation.");
                      return;
                    }

                    var tableSuggestions = Array.isArray(res.suggestedTableEvents) ? res.suggestedTableEvents.slice(0, 3) : [];
                    var beatSuggestions = Array.isArray(res.suggestedEvents) ? res.suggestedEvents.slice(0, 3) : [];

                    var tableItems = tableSuggestions.map(function (s, idx) {
                      var meta = [];
                      if (s.terrain) meta.push("Terrain: " + s.terrain);
                      if (s.tier != null) meta.push("Tier: " + s.tier);
                      if (s.desiredTier != null && s.desiredTier !== s.tier) meta.push("Wanted: " + s.desiredTier);
                      if (s.campaignId) meta.push("Campaign: " + s.campaignId);
                      return ''
                        + '<li style="margin:0 0 10px 0;">'
                        + '<strong>' + _escapeHtml(s.label || s.tableId || ("Table " + (idx + 1))) + '</strong>'
                        + '<div style="opacity:.85; margin:4px 0 0 0;">' + _escapeHtml(s.reason || "") + '</div>'
                        + (meta.length ? ('<div style="opacity:.7; font-size:12px; margin-top:4px;">' + _escapeHtml(meta.join(' • ')) + '</div>') : '')
                        + '</li>';
                    }).join("");

                    var beatItems = beatSuggestions.map(function (s, idx) {
                      var meta = [];
                      if (s.campaignId) meta.push("Campaign: " + s.campaignId);
                      if (s.beatType) meta.push("Type: " + s.beatType);
                      if (Array.isArray(s.matchedTags) && s.matchedTags.length) meta.push("Tags: " + s.matchedTags.join(", "));
                      return ''
                        + '<li style="margin:0 0 10px 0;">'
                        + '<strong>' + _escapeHtml(s.label || s.key || ("Signal " + (idx + 1))) + '</strong>'
                        + '<div style="opacity:.85; margin:4px 0 0 0;">' + _escapeHtml(s.reason || "") + '</div>'
                        + (meta.length ? ('<div style="opacity:.7; font-size:12px; margin-top:4px;">' + _escapeHtml(meta.join(' • ')) + '</div>') : '')
                        + '</li>';
                    }).join("");

                    var content = ''
                      + '<div class="bbttcc-gm-advisor-dialog">'
                      + '<p><strong>Faction:</strong> ' + _escapeHtml(res.factionName || res.factionId || "Unknown") + '</p>'
                      + '<p><strong>Stability:</strong> ' + _escapeHtml(res.stability && res.stability.band ? res.stability.band : "unknown") + ' &nbsp; '
                      + '<strong>Overextension:</strong> ' + _escapeHtml(res.overextension && res.overextension.band ? res.overextension.band : "unknown") + ' &nbsp; '
                      + '<strong>Narrative:</strong> ' + _escapeHtml(res.narrative && res.narrative.band ? res.narrative.band : "unknown") + '</p>'
                      + '<p><strong>Difficulty:</strong> ' + _escapeHtml(res.difficulty && res.difficulty.band ? res.difficulty.band : "hold") + '</p>'
                      + '<p style="margin-top:8px"><strong>Mal says:</strong> ' + _escapeHtml(res.mal && res.mal.summary ? res.mal.summary : "") + '</p>'
                      + '<hr/>'
                      + '<p><strong>Suggested Tables</strong></p>'
                      + '<ul>' + (tableItems || '<li>No immediate table suggestion available.</li>') + '</ul>'
                      + '<p><strong>Suggested Escalation Beats</strong></p>'
                      + '<ul>' + (beatItems || '<li>No immediate authored escalation beat is available from the active campaign.</li>') + '</ul>'
                      + '</div>';

                    var buttons = { ok: { label: "Close" } };
                    for (var ti = 0; ti < tableSuggestions.length; ti++) {
                      (function (sugg, idx) {
                        if (!sugg || !sugg.tableId || !tableApi || typeof tableApi.runRandomTable !== "function") return;
                        buttons['table' + idx] = {
                          label: 'Roll Table: ' + String(sugg.label || sugg.tableId || ('Table ' + (idx + 1))),
                          callback: function () {
                            return Promise.resolve(tableApi.runRandomTable({ tableId: sugg.tableId }));
                          }
                        };
                      })(tableSuggestions[ti], ti);
                    }
                    for (var bi = 0; bi < beatSuggestions.length; bi++) {
                      (function (sugg, idx) {
                        if (!sugg || !sugg.campaignId || !sugg.beatId || typeof campaignRunBeat !== "function") return;
                        buttons['run' + idx] = {
                          label: 'Run Beat: ' + String(sugg.label || sugg.beatId || ('Beat ' + (idx + 1))),
                          callback: function () {
                            return Promise.resolve(campaignRunBeat(sugg.campaignId, sugg.beatId));
                          }
                        };
                      })(beatSuggestions[bi], bi);
                    }

                    new Dialog({
                      title: "GM Advisor — World Signals + Escalation",
                      content: content,
                      buttons: buttons,
                      default: tableSuggestions.length ? "table0" : (beatSuggestions.length ? "run0" : "ok")
                    }).render(true);
                  });
                  return;
                }


                // Fallback: story beats
                if (!story || !story.runBeat) {
                  if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Story API not ready (gottgait).");
                  return;
                }
                Promise.resolve(story.runBeat(beat, undefined));
              });
            })(btns[i]);
          }
        } catch (e) {}
      }

      if (p && typeof p.then === "function") {
        return p.then(function () { after(); return p; });
      }
      after();
      return p;
    }

    static open(options) {
      options = options || {};
      if (!this._instance) this._instance = new this();
      this._instance.render(true, options);
      return this._instance;
    }
  }

  Hooks.once("ready", function () {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.story = game.bbttcc.api.story || {};
    game.bbttcc.api.story.openGOTTGAITConsole = function (options) { return GOTTGAITStoryConsole.open(options || {}); };
    console.log(TAG, "GOTTGAIT Story Console ready. (GM Advisor table UI patch)");
  });

})();