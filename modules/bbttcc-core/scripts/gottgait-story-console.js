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

  // -------------------------------------------------------------------------
  // Central help — "story" namespace (bbttcc-core/scripts/bbttcc-help.js).
  // One dictionary feeds template tooltips ({{bbttccTip 'story' key}}), the
  // JS-built Dialog fields below, and the Operator tours.
  // House style: "Name — what it is. What it does mechanically. When/why."
  // -------------------------------------------------------------------------
  var HELP = {
    console: "GOTTGAIT Story Console — Mal's manual mission control for the campaign engine. Every button calls the same bbttcc-campaign APIs the automatic Story Director uses (runBeat, injector, encounter tables), and every fire lands in the shared Story Director ledger. Use it to drive the story by hand between or during world turns.",
    filterQuest: "Quest filter — narrows every beat list below to beats assigned to this quest. 'No Quest' keeps only beats with no quest id. Stored in the world-scoped story state, so it persists across opens for all GMs.",
    filterTurn: "Turn filter — narrows every beat list below to beats authored for that world turn (beat.turnNumber). 'Unassigned' keeps beats with no turn number. Persists world-wide until changed.",
    "group.activate": "Activate — sets the ACTIVE campaign for the whole engine: Story Director tick, quests, doors, turn announcements AND this console all follow it (one setting, kept in sync as of 2026-07-08).",
    "beat.activate": "Make this the active campaign everywhere — the console's beat lists, the Story Director's autonomous firing, and the quest engine all switch to it together.",
    "group.builder": "Authoring — shortcut into the Campaign Builder for the active campaign, where beats, quests, doors, and encounter tables are authored. This console only fires what is authored there.",
    "beat.builder": "Open the Campaign Builder app focused on this campaign. Editing happens there; nothing fires from this button.",
    "group.injector": "Injector — the travel-threshold engine, fired by hand. It scores the campaign's injectable beats against a hex + tag bundle (once-per-hex gates, cooldowns, requires-conditions, and debt prompts all apply) and runs the winner.",
    "beat.injector": "Opens the Injector Fire dialog (hex + tags; remembers your last values). The engine picks the highest-scoring eligible beat and runs it — the exact code path travel thresholds trigger automatically.",
    "group.tables": "Random Encounters — roll a stored Encounter Table. The table weighted-picks one of its beat entries (filtered by optional hex/tags) and runs that beat through the normal engine.",
    "beat.tables": "Opens the Random Table Fire dialog. Pick a table; one weighted entry is selected and its beat runs normally (chat card, dialogue, effects, quest hooks).",
    "group.beats": "Every beat of the ★ active campaign in authoring order, obeying the Quest/Turn filters above. ✓ = already fired on ANY surface per the Story Director ledger (director tick, Builder, this console, NPC dialogue).",
    "beat.run": "Run this beat NOW through the campaign engine — chat card, dialogue, quest hooks, and effects fire exactly as if the Story Director had picked it. A ✓ beat asks for one confirmation first (soft lock — never blocked).",
    "group.tagBucket": "Tag bucket — beats from the active campaign carrying this inject/theme tag (first 24; filters apply). These tags are how the automatic injector finds beats; buttons here run them by hand, same as the main list.",
    "group.advisor": "GM Advisor — world-pressure analysis for the inferred faction context: stability, overextension, and narrative-heat bands plus a difficulty call, with suggested encounter tables and escalation beats.",
    "beat.advisor": "Run the analysis now. Nothing fires by itself — the report dialog offers explicit Roll Table / Run Beat buttons for each suggestion.",
    "injector.hex": "Hex UUID — the Bad Eden hex id this injection targets (raw string like 'test-hex-17', NOT a Foundry document UUID). Required: once-per-hex gates and GM-decline memory are keyed to it.",
    "injector.tags": "Tags — space-separated inject tags (e.g. 'inject.travel_threshold debt'). Beats score by tag matches; a beat matching none is ineligible.",
    "injector.allowMulti": "Allow Multi — fire up to 2 top-scoring eligible beats in one pull instead of exactly 1.",
    "injector.fallback": "Fallback on Decline — if you veto a debt-flavored beat at the GM prompt, keep walking down the candidate list instead of aborting the whole fire.",
    "table.table": "Encounter Table — authored in the Campaign Builder and stored in bbttcc-campaign settings. Each entry points at a campaign beat with a weight; one eligible entry is weighted-picked and run.",
    "table.hex": "Hex UUID (optional) — raw Bad Eden hex id. Filters out table entries not eligible for this hex and is passed as context to the beat that runs.",
    "table.tags": "Tags (optional) — space-separated. Used to filter eligible entries and passed as context to the beat that runs.",
    "advisor.stability": "Stability — faction-state band (stable / drifting / unstable) from the Advisor's world observation. Unstable pushes suggestions toward containment and can raise the suggested encounter tier.",
    "advisor.overextension": "Overextension — logistics band (contained / pressured / overextended). Overextended warrants supply-crisis / convoy-pressure style beats.",
    "advisor.narrative": "Narrative — table-momentum band (e.g. warm / hot). Hot = enough motion to escalate an active thread; warm = seed a follow-up beat instead.",
    "advisor.difficulty": "Difficulty — the Advisor's overall call (e.g. hold / raise) on whether to turn world pressure up or hold steady. The suggestions below follow it.",
    "advisor.mal": "Mal says — Mal's one-line editorial summary of the same analysis. Flavor over the numbers above."
  };

  Hooks.once("init", function () {
    try {
      if (game.bbttcc && game.bbttcc.help && game.bbttcc.help.register) game.bbttcc.help.register("story", HELP);
      else _warn(TAG, "central help registry unavailable; story tooltips will be blank.");
    } catch (e) { _warn(TAG, "help registration failed:", e); }
  });

  function _tip(key) {
    try {
      return (game.bbttcc && game.bbttcc.help && game.bbttcc.help.tip) ? game.bbttcc.help.tip("story", key) : "";
    } catch (e) { return ""; }
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
    // The Story Director / quests / doors / turn flow all read the CAMPAIGN
    // module's activeCampaignId setting — prefer it so the console and the
    // engine can never disagree (fixed 2026-07-08; they used to be two
    // separate keys and "Activate" only wrote the console-local one).
    try {
      var engineId = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign
        && game.bbttcc.api.campaign.getActiveCampaignId
        ? game.bbttcc.api.campaign.getActiveCampaignId()
        : null;
      if (engineId) return engineId;
    } catch (_e) {}
    var s = _getStoryState();
    return (s && s.activeCampaignId) ? s.activeCampaignId : null;
  }

  function setActiveCampaignId(campaignId) {
    if (!campaignId) return Promise.resolve(false);
    // Activate for the ENGINE first (Story Director, quests, doors, turn
    // announcements), then mirror into the console-local key for back-compat
    // (bbttcc-raid's GM Advisor faction inference still reads it).
    var enginePromise = Promise.resolve(false);
    try {
      var setter = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign
        && game.bbttcc.api.campaign.setActiveCampaignId;
      if (typeof setter === "function") enginePromise = Promise.resolve(setter(campaignId)).then(function () { return true; });
      else if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Campaign engine not loaded — activation is console-local only.");
    } catch (_e) {}
    return enginePromise.then(function (engineOk) {
      return _patchStoryState({ activeCampaignId: campaignId }).then(function (ok) {
        if (!ok && !engineOk && ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Could not persist active campaign.");
        return ok || engineOk;
      });
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
        '<div class="form-group" data-tooltip="' + _escapeHtml(_tip("injector.hex")) + '"><label>Hex UUID</label>' +
        '<input type="text" name="hexUuid" value="' + _escapeHtml(hexUuid) + '" placeholder="e.g. test-hex-17" />' +
        '</div>' +
        '<div class="form-group" data-tooltip="' + _escapeHtml(_tip("injector.tags")) + '"><label>Tags</label>' +
        '<input type="text" name="tags" value="' + _escapeHtml(tags) + '" placeholder="space separated tags" />' +
        '</div>' +
        '<div class="form-group" data-tooltip="' + _escapeHtml(_tip("injector.allowMulti")) + '"><label class="checkbox">' +
        '<input type="checkbox" name="allowMulti" ' + (allowMulti ? "checked" : "") + '/> Allow Multi</label></div>' +
        '<div class="form-group" data-tooltip="' + _escapeHtml(_tip("injector.fallback")) + '"><label class="checkbox">' +
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
        '<div class="form-group" data-tooltip="' + _escapeHtml(_tip("table.table")) + '"><label>Encounter Table</label>' +
        '<select name="tableId">' + optionsHtml + '</select>' +
        '<p class="notes" style="opacity:0.85">Tables are stored in bbttcc-campaign settings and select beats to run.</p>' +
        '</div>' +
        '<div class="form-group" data-tooltip="' + _escapeHtml(_tip("table.hex")) + '"><label>Hex UUID (optional)</label>' +
        '<input type="text" name="hexUuid" value="' + _escapeHtml(hexUuid) + '" placeholder="e.g. test-hex-17" />' +
        '</div>' +
        '<div class="form-group" data-tooltip="' + _escapeHtml(_tip("table.tags")) + '"><label>Tags (optional)</label>' +
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
        window: { title: "GOTTGAIT Story Console", resizable: true },
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
      // ("Current Stage" header + baseGroups + beatLog removed 2026-07-08 —
      // nothing ever wrote a stage, the template dropped the log column, and
      // baseGroups was always empty.)

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
          tip: _tip("group.activate"),
          tour: "story.activate",
          description: activeCampaign
            ? ("Active: " + (activeCampaign.label || activeCampaign.title || activeCampaign.id))
            : "No active campaign selected.",
          beats: campList.filter(function (c) { return c && c.id; }).slice(0, 12).map(function (c) {
            return { key: "campaign.activate:" + c.id, label: "Activate: " + (c.label || c.title || c.id), tip: _tip("beat.activate") };
          })
        });

        if (activeCampaign && activeCampaign.id) {
          campaignGroups.push({
            id: "campaign-open-builder",
            label: "Campaign Engine — Authoring",
            tip: _tip("group.builder"),
            tour: "story.builder",
            description: "Jump straight to the Campaign Builder for the active campaign.",
            beats: [{ key: "campaign.openBuilder:" + activeCampaign.id, label: "Open Campaign Builder: " + (activeCampaign.label || activeCampaign.id), tip: _tip("beat.builder") }]
          });

          campaignGroups.push({
            id: "campaign-injector-fire",
            label: "Campaign Engine — Injector",
            tip: _tip("group.injector"),
            tour: "story.injector",
            description: "Manually fire the injector for a hex + tag bundle.",
            beats: [{ key: "campaign.injectorFire:" + activeCampaign.id, label: "Injector Fire…", tip: _tip("beat.injector") }]
          });

          campaignGroups.push({
            id: "campaign-random-table",
            label: "Campaign Engine — Random Encounters",
            tip: _tip("group.tables"),
            tour: "story.tables",
            description: "Fire a Random Encounter Table (tables select beats; beats run normally).",
            beats: [{ key: "campaign.tableFire", label: "Random Table Fire…", tip: _tip("beat.tables") }]
          });

          // Story Director record: badge beats that already fired on ANY
          // surface (director tick, Builder, this console, NPC dialogue).
          var dstate = null;
          try {
            dstate = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.director && typeof game.bbttcc.api.campaign.director.state === "function")
              ? game.bbttcc.api.campaign.director.state()
              : null;
          } catch (_eDS) { dstate = null; }
          var _firedMark = function (beatId) {
            if (!dstate || !beatId) return "";
            var f = (dstate.firedStoryBeats && dstate.firedStoryBeats[beatId]) || (dstate.dialogueFired && dstate.dialogueFired[beatId]);
            return f ? " ✓" : "";
          };

          // All beats (UN-CAPPED, scroll handled by CSS)
          var all = [];
          for (var i = 0; i < activeBeats.length; i++) {
            var b = activeBeats[i];
            var bid = b ? (b.id || b.beatId) : null;
            if (!bid) continue;
            if (!_beatPassesConsoleFilters(b, filters)) continue;
            all.push({
              key: "campaign.run:" + activeCampaign.id + ":" + bid,
              label: (String(i + 1).padStart ? String(i + 1).padStart(2, "0") : (i + 1)) + " — " + _fmtBeatLabel(b) + _firedMark(bid),
              tip: _tip("beat.run"),
              tour: (all.length === 0 ? "story.beat-row" : null)
            });
          }

          if (all.length) {
            var turnLbl = (filters.turn === "all") ? "All Turns" : (filters.turn === "unassigned" ? "Unassigned" : ("Turn " + filters.turn));
            var questLbl = (filters.questId === "all") ? "All Quests" : (filters.questId === "none" ? "No Quest" : ("Quest " + filters.questId));
            campaignGroups.push({
              id: "campaign-all",
              label: filtersActive ? "Campaign Beats — Filtered (Ordered)" : "Campaign Beats — All (Ordered)",
              tip: _tip("group.beats"),
              tour: "story.beats",
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
              picks.push({ key: "campaign.run:" + activeCampaign.id + ":" + bbid, label: _fmtBeatLabel(bb) + _firedMark(bbid), tip: _tip("beat.run") });
              if (picks.length >= 24) break;
            }
            if (picks.length) campaignGroups.push({ id: "campaign-" + g.id, label: g.label, tip: _tip("group.tagBucket"), description: g.description, beats: picks });
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
        tip: _tip("group.advisor"),
        tour: "story.advisor",
        description: gmFactionId
          ? ("Run world-pressure analysis for the inferred faction context (" + gmFactionId + ").")
          : "Run world-pressure analysis for the inferred faction context.",
        beats: [{ key: "gm.advisor.refresh", label: "Run GM Advisor", tip: _tip("beat.advisor") }]
      }];

      var groups = gmGroups.concat(campaignGroups);
      return { groups: groups, filters: filters, turnOptions: turnOptions, questOptions: questOptions };
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
                  // Soft-lock: already-fired beats (Story Director record, any
                  // surface) get one confirm — never blocked.
                  var firedRec = null;
                  try {
                    var dst = (game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.director && typeof game.bbttcc.api.campaign.director.state === "function")
                      ? game.bbttcc.api.campaign.director.state()
                      : null;
                    firedRec = dst ? ((dst.firedStoryBeats && dst.firedStoryBeats[beatId]) || (dst.dialogueFired && dst.dialogueFired[beatId])) : null;
                  } catch (_eSoft) { firedRec = null; }
                  if (firedRec) {
                    Dialog.confirm({
                      title: "Beat already fired",
                      content: "<p>This beat has already fired" + (firedRec.turn ? " (turn " + firedRec.turn + ")" : "") + " according to the Story Director record.</p><p>Run it again anyway?</p>"
                    }).then(function (ok) {
                      if (ok) Promise.resolve(campaignRunBeat(campaignId3, beatId));
                    });
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
                      + '<p><strong data-tooltip="' + _escapeHtml(_tip("advisor.stability")) + '">Stability:</strong> ' + _escapeHtml(res.stability && res.stability.band ? res.stability.band : "unknown") + ' &nbsp; '
                      + '<strong data-tooltip="' + _escapeHtml(_tip("advisor.overextension")) + '">Overextension:</strong> ' + _escapeHtml(res.overextension && res.overextension.band ? res.overextension.band : "unknown") + ' &nbsp; '
                      + '<strong data-tooltip="' + _escapeHtml(_tip("advisor.narrative")) + '">Narrative:</strong> ' + _escapeHtml(res.narrative && res.narrative.band ? res.narrative.band : "unknown") + '</p>'
                      + '<p><strong data-tooltip="' + _escapeHtml(_tip("advisor.difficulty")) + '">Difficulty:</strong> ' + _escapeHtml(res.difficulty && res.difficulty.band ? res.difficulty.band : "hold") + '</p>'
                      + '<p style="margin-top:8px"><strong data-tooltip="' + _escapeHtml(_tip("advisor.mal")) + '">Mal says:</strong> ' + _escapeHtml(res.mal && res.mal.summary ? res.mal.summary : "") + '</p>'
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


                // Every live button key is handled above; the old fallback to
                // the legacy GOTTGAIT demo engine (story.runBeat) was dead
                // code — removed 2026-07-08.
                console.warn("[gottgait-console] unhandled button key:", beat);
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
      this._instance.render(Object.assign({ force: true }, options));
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