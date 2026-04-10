// BBTTCC Campaign Builder - Module Entry
//
// v1.3.5 - AutoDebt Threshold + GM Decline + FallbackOnDecline
//
// RESTORE PASS (Dialog / Choices):
// - Beats can display a prompt+choices dialog even when beat.type === "scene_transition"
// - If beat.description and/or beat.choices exist, we present a dialog and route to next beats.
import "../apps/campaign-tag-picker.js";
import "../scripts/casualties-engine.js";
import "../apps/player-beat-mirror-app.js";
import "./bbttcc-rolls-api.js";

const MOD_ID  = "bbttcc-campaign";
const TAG     = "[bbttcc-campaign]";
const SETTING_CAMPAIGNS = "campaigns";
const SETTING_INJECT_STATE = "injectState";
const SETTING_TABLES = "encounterTables";
const SETTING_QUESTS = "quests";
const SETTING_ACTIVE_CAMPAIGN = "activeCampaignId";
const SETTING_LAST_TURN_ANNOUNCED = "lastTurnAnnounced"; // Campaign Turn Flow announcements

const DEFAULT_FACTION_UUID = "Actor.LjUgo0DxmSuEXMbs";
const DEBT_PREFIX = "[HV_DEBT:";

const log  = (...args) => console.log(TAG, ...args);
const warn = (...args) => console.warn(TAG, ...args);
const err  = (...args) => console.error(TAG, ...args);

// ---------------------------------------------------------------------------
// Dialog autosize helper (V1 Dialog / toast popouts)
// Fixes clipped bottom buttons by resizing to content after render.
// Safe, no modern syntax.
// ---------------------------------------------------------------------------
function __bbttccAutosizeDialog(app, opts) {
  try {
    opts = opts || {};
    var pad = (opts.pad == null) ? 26 : opts.pad;
    var minH = (opts.minH == null) ? 220 : opts.minH;
    var maxH = (opts.maxH == null) ? Math.floor(window.innerHeight * 0.92) : opts.maxH;

    var el =
      (app && app.element && app.element[0] instanceof HTMLElement) ? app.element[0] :
      (app && app.element instanceof HTMLElement) ? app.element :
      null;
    if (!el) return;

    var header = el.querySelector("header.window-header");
    var content = el.querySelector(".window-content") || el;

    if (content && content.style) content.style.overflowY = "auto";

    var hHeader = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    var hContent = content ? Math.ceil(content.scrollHeight) : 0;

    var target = hHeader + hContent + pad;
    if (target < minH) target = minH;
    if (target > maxH) target = maxH;

    if (typeof app.setPosition === "function") app.setPosition({ height: target });
  } catch (_e) {}
}


function __bbttccAutosizeDialogDeferred(app, opts) {
  try {
    setTimeout(function(){ try { __bbttccAutosizeDialog(app, opts); } catch (_e1) {} }, 0);
    setTimeout(function(){ try { __bbttccAutosizeDialog(app, opts); } catch (_e2) {} }, 75);
    setTimeout(function(){ try { __bbttccAutosizeDialog(app, opts); } catch (_e3) {} }, 200);
  } catch (_e) {}
}

// ---------------------------------------------------------------------------
// HexChrome Dialog hook (V1 Dialog)
// Ensures any Dialog (including first render after reload) gets HexChrome classes.
// ---------------------------------------------------------------------------
try {
  if (!globalThis.__bbttccHexChromeDialogHookInstalled) {
    globalThis.__bbttccHexChromeDialogHookInstalled = true;
    Hooks.on("renderDialog", function (app, html) {
      try { html?.addClass?.("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog"); } catch (_e) {}
      try { __bbttccAutosizeDialogDeferred(app, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_e2) {}
    });
    log("HexChrome Dialog hook installed (renderDialog).");
  }
} catch (_e) {}


// ---------------------------------------------------------------------------
// Campaign Encounter -> Encounter Engine registry bridge (A/B/C)
// - Rebuilds a runtime scenario index from campaign beats of type "encounter".
// - Prefers Encounter Engine external registry APIs (registerCampaignBeatScenario / registerScenario).
// - Falls back to legacy scenario-map injection when needed.
// ---------------------------------------------------------------------------

let _campaignEncounterKeys = new Set();
let _rebuildEncountersTimer = null;

function _getEncountersAPI() {
  return game?.bbttcc?.api?.encounters ?? null;
}

function _getScenarioMap(enc) {
  // Legacy / internal shapes (fallback only)
  return enc?.SCENARIOS ?? enc?.scenarios ?? enc?.__scenarios ?? null;
}

function _scheduleEncounterRebuild() {
  if (_rebuildEncountersTimer) clearTimeout(_rebuildEncountersTimer);
  _rebuildEncountersTimer = setTimeout(() => {
    _rebuildEncountersTimer = null;
    try { _rebuildCampaignEncounterIndex(); }
    catch (e) { warn("Encounter index rebuild failed:", e); }
  }, 250);
}

function _scenarioKeyForBeat(beat) {
  const k =
    beat?.encounter?.key ??
    beat?.encounterKey ??
    beat?.scenarioKey ??
    beat?.mechanics?.encounterKey ??
    beat?.mechanics?.scenarioKey ??
    "";
  return String(k || beat?.id || "").trim();
}

function _makeCampaignScenario({ campaignId, beat }) {
  const key = _scenarioKeyForBeat(beat);
  const label = beat?.label ?? key;
  const tier = Number.isFinite(Number(beat?.encounter?.tier)) ? Number(beat.encounter.tier) : null;

  // Provide multiple handler names to match whichever encounters API expects.
  const runner = async (ctx = {}) => {
    return game.bbttcc.api.campaign.runBeat(campaignId, beat.id, ctx);
  };

  return {
    key,
    label,
    type: "campaign",
    category: "campaign",
    tier,
    campaignId,
    beatId: beat.id,
    _source: `campaign:${campaignId}`, // Encounter Engine external registry uses this for cleanup
    // handlers
    run: runner,
    exec: runner,
    execute: runner,
    handler: runner,
    launch: runner,
    fn: runner
  };
}

function _unregisterScenario(enc, key) {
  if (!enc || !key) return false;

  if (typeof enc.unregisterScenario === "function") { enc.unregisterScenario(key); return true; }
  if (typeof enc.removeScenario === "function") { enc.removeScenario(key); return true; }

  const map = _getScenarioMap(enc);
  if (map && typeof map === "object" && key in map) {
    delete map[key];
    return true;
  }

  return false;
}

function _registerScenario(enc, scenario) {
  if (!enc || !scenario?.key) return false;

  // Prefer explicit API methods if available.
  if (typeof enc.registerScenario === "function") { enc.registerScenario(scenario, { source: scenario._source || "campaign", force: true }); return true; }
  if (typeof enc.addScenario === "function") { enc.addScenario(scenario); return true; }
  if (typeof enc.upsertScenario === "function") { enc.upsertScenario(scenario); return true; }

  // Fallback: write into scenario map if it exists.
  const map = _getScenarioMap(enc);
  if (map && typeof map === "object") {
    map[scenario.key] = scenario;
    return true;
  }

  return false;
}

function _clearPreviouslyRegisteredCampaignScenarios(enc) {
  // Best: Encounter Engine external registry supports listScenarios + unregisterScenario
  if (typeof enc?.listScenarios === "function" && typeof enc?.unregisterScenario === "function") {
    const list = enc.listScenarios();
    const mine = list.filter(s => String(s?._source || "").startsWith("campaign:"));
    for (const s of mine) enc.unregisterScenario(s.key);
    _campaignEncounterKeys = new Set();
    return;
  }

  // Fallback: remove the ones we registered last pass
  for (const k of _campaignEncounterKeys) _unregisterScenario(enc, k);
  _campaignEncounterKeys = new Set();
}

function _rebuildCampaignEncounterIndex() {
  const enc = _getEncountersAPI();
  if (!enc) return;

  _clearPreviouslyRegisteredCampaignScenarios(enc);

  const all = getAllCampaigns();
  for (const [campaignId, raw] of Object.entries(all)) {
    const c = _normalizeCampaign(campaignId, raw);
    for (const beat of (c.beats || [])) {
      if (!beat) continue;
      if (beat.type !== "encounter" && beat.type !== "cinematic" && !(beat.cinematic && beat.cinematic.enabled)) continue;

      // Preferred: Encounter Engine helper to turn a campaign beat into a scenario.
      if (typeof enc.registerCampaignBeatScenario === "function") {
        try {
          enc.registerCampaignBeatScenario(campaignId, beat, { source: `campaign:${campaignId}`, force: true });
          const key = _scenarioKeyForBeat(beat);
          if (key) _campaignEncounterKeys.add(key);
          continue;
        } catch (e) {
          warn("registerCampaignBeatScenario failed; falling back to manual scenario build", e);
        }
      }

      const key = _scenarioKeyForBeat(beat);
      if (!key) continue;

      const scenario = _makeCampaignScenario({ campaignId, beat });
      const ok = _registerScenario(enc, scenario);
      if (ok) _campaignEncounterKeys.add(key);
    }
  }

  log("Campaign encounters registered into Encounter Engine:", _campaignEncounterKeys.size);
}


// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function _normBeatId(v) {
  return String(v || "").trim();
}

function _dedupeBeats(beatsIn = []) {
  const beats = [];
  const seen = new Map();
  for (const b of beatsIn) {
    if (!b) continue;
    const id = _normBeatId(b.id);
    if (!id) continue;
    const beat = b;
    beat.id = id;
    if (seen.has(id)) {
      // last-write wins, preserve original slot
      beats[seen.get(id)] = beat;
    } else {
      seen.set(id, beats.length);
      beats.push(beat);
    }
  }
  return beats;
}


function _normalizeCampaign(id, data = {}) {
  const label = data?.label ?? data?.title ?? id;

  // Defensive: de-dupe beats by ID on write.
  // This prevents UI bugs or multi-hook races from persisting duplicate beats.
  const beatsIn = Array.isArray(data?.beats) ? data.beats : [];
  const beatsOut = [];
  const seen = new Map(); // beatId -> index in beatsOut
  for (const b of beatsIn) {
    const bid = String(b?.id || "").trim();
    if (!bid) {
      beatsOut.push(b);
      continue;
    }
    if (seen.has(bid)) {
      beatsOut[seen.get(bid)] = b;
      continue;
    }
    seen.set(bid, beatsOut.length);
    beatsOut.push(b);
  }

  return {
    id,
    label,
    title: label,
    description: data?.description ?? "",
    // NEW: Campaign-level default faction (used by Builder + worldEffects inheritance)
    factionId: String(data?.factionId || "").trim() || null,
    beats: beatsOut
  };
}

// ---------------------------------------------------------------------------
// Campaign Turn Flow (Phase 1)
// - Beats can be assigned to a Strategic Turn number (beat.turnNumber).
// - We sync a compact per-turn availability map into bbttcc-world setting "turnBeats"
//   so the world engine (and other UIs) can see what's now available when the turn advances.
// - The Campaign Builder uses beat.turnNumber locally for filtering/grouping; the world map is a convenience.
// ---------------------------------------------------------------------------

function _getWorldAPI() {
  try { return game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.world : null; } catch (_e) { return null; }
}

function _safeInt(v, fallback) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) n = parseInt(fallback, 10);
  if (!isFinite(n)) n = 0;
  return n;
}

function _extractTurnNumber(beat) {
  var n = _safeInt(beat && (beat.turnNumber != null ? beat.turnNumber : (beat.turn != null ? beat.turn : beat.availableTurn)), 0);
  return n >= 1 ? n : 0;
}

function _syncWorldTurnBeatsForCampaign(campaignId) {
  try {
    var w = _getWorldAPI();
    if (!w) return false;

    // Prefer API helper if present; otherwise write the setting directly.
    var campaign = getCampaign(campaignId);
    if (!campaign) return false;

    var map = {};
    var beats = Array.isArray(campaign.beats) ? campaign.beats : [];
    for (var i = 0; i < beats.length; i++) {
      var b = beats[i];
      if (!b) continue;
      var tn = _extractTurnNumber(b);
      if (!tn) continue;
      var key = String(tn);
      if (!Array.isArray(map[key])) map[key] = [];
      map[key].push({
        v: 1,
        campaignId: campaign.id,
        beatId: String(b.id || ""),
        label: String(b.label || b.id || ""),
        type: String(b.type || "custom")
      });
    }

    // Keep entries deterministic (helps diffing and keeps UI stable)
    Object.keys(map).forEach(function (k) {
      map[k].sort(function (a, b) {
        return String(a.label || "").localeCompare(String(b.label || "")) || String(a.beatId).localeCompare(String(b.beatId));
      });
    });

    if (typeof w.setTurnBeatsMap === "function") {
      w.setTurnBeatsMap(map);
      return true;
    }

    // Fallback: write hidden setting directly (api.world.js ensures it's registered).
    try {
      if (game && game.settings && typeof game.settings.set === "function") {
        game.settings.set("bbttcc-world", "turnBeats", map);
        return true;
      }
    } catch (_e2) {}

    return false;
  } catch (e) {
    warn("syncWorldTurnBeatsForCampaign failed:", e);
    return false;
  }
}

function _gmIds() {
  try { return (game.users || []).filter(function (u) { return u && u.isGM; }).map(function (u) { return u.id; }); } catch (_e) { return []; }
}

function _announceTurnAvailabilityIfNeeded() {
  try {
    var w = _getWorldAPI();
    if (!w || typeof w.getState !== "function" || typeof w.getTurnBeats !== "function") return;

    var state = w.getState();
    var turn = _safeInt(state && state.turn, 0);
    if (!turn || turn < 1) return;

    var last = 0;
    try { last = _safeInt(game.settings.get(MOD_ID, SETTING_LAST_TURN_ANNOUNCED), 0); } catch (_e0) { last = 0; }
    if (turn <= last) return;

    var entries = w.getTurnBeats(turn) || [];
    if (!Array.isArray(entries)) entries = [];

    // Persist last announced turn (so we don't repeat on re-load)
    try { game.settings.set(MOD_ID, SETTING_LAST_TURN_ANNOUNCED, String(turn)); } catch (_e1) {}

    if (!entries.length) return;

    var lines = [];
    lines.push('<p><b>Strategic Turn ' + String(turn) + '  -  Now Available</b></p>');
    lines.push('<ul>');
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i] || {};
      var lbl = String(e.label || e.beatId || "Beat");
      var bid = String(e.beatId || "");
      var typ = String(e.type || "");
      lines.push('<li><b>' + foundry.utils.escapeHTML(lbl) + '</b> <span style="opacity:.75">(' + foundry.utils.escapeHTML(typ) + ')  - </span> <code>' + foundry.utils.escapeHTML(bid) + '</code></li>');
    }
    lines.push('</ul>');

    var gm = _gmIds();
    if (!gm.length) return;

    ChatMessage.create({
      content: lines.join(""),
      whisper: gm,
      speaker: { alias: "BBTTCC Campaign" }
    });
  } catch (e) {
    warn("announceTurnAvailabilityIfNeeded failed:", e);
  }
}

function getAllCampaigns() {
  try {
    const stored = game.settings.get(MOD_ID, SETTING_CAMPAIGNS);
    if (!stored || typeof stored !== "object") return {};
    return foundry.utils.deepClone(stored);
  } catch (e) {
    warn("getAllCampaigns failed:", e);
    return {};
  }
}

async function setAllCampaigns(campaigns) {
  await game.settings.set(MOD_ID, SETTING_CAMPAIGNS, campaigns ?? {});
  return campaigns ?? {};
}

function getCampaign(id) {
  const all = getAllCampaigns();
  const c = all[id] ?? null;
  return c ? _normalizeCampaign(id, c) : null;
}

async function saveCampaign(id, data) {
  if (!id) throw new Error("saveCampaign: id required");
  const all = getAllCampaigns();
  all[id] = _normalizeCampaign(id, data);
  await setAllCampaigns(all);
  log("Saved campaign", id);
  _scheduleEncounterRebuild();
  // Campaign Turn Flow: sync per-turn availability for the active campaign.
  try {
    var active = getActiveCampaignId();
    if (String(active || "") === String(id)) _syncWorldTurnBeatsForCampaign(id);
  } catch (_e) {}
  return all[id];
}

async function createCampaign(id, data = {}) {
  if (!id) throw new Error("createCampaign: id required");
  const all = getAllCampaigns();
  if (all[id]) return _normalizeCampaign(id, all[id]);
  all[id] = _normalizeCampaign(id, data);
  await setAllCampaigns(all);
  log("Created campaign", id);
  _scheduleEncounterRebuild();
  try {
    var active = getActiveCampaignId();
    if (String(active || "") === String(id)) _syncWorldTurnBeatsForCampaign(id);
  } catch (_e) {}
  return all[id];
}

async function deleteCampaign(id) {
  const all = getAllCampaigns();
  if (!(id in all)) return false;
  delete all[id];
  await setAllCampaigns(all);
  log("Deleted campaign", id);
  _scheduleEncounterRebuild();
  // If we deleted the active campaign, clear the world turn-beats map.
  try {
    var active = getActiveCampaignId();
    if (String(active || "") === String(id)) {
      var w = _getWorldAPI();
      if (w && typeof w.setTurnBeatsMap === "function") w.setTurnBeatsMap({});
      else if (game && game.settings && typeof game.settings.set === "function") game.settings.set("bbttcc-world", "turnBeats", {});
    }
  } catch (_e) {}
  return true;
}

function listCampaigns() {
  const all = getAllCampaigns();
  return Object.entries(all).map(([id, c]) => _normalizeCampaign(id, c));
}

// ---------------------------------------------------------------------------
// Encounter Tables (NEW)
// ---------------------------------------------------------------------------

function _normalizeTable(id, data = {}) {
  return {
    id,
    label: data?.label ?? id,
    scope: data?.scope ?? "global",
    tags: Array.isArray(data?.tags) ? data.tags : [],
    entries: Array.isArray(data?.entries) ? data.entries : []
  };
}

function getAllTables() {
  try {
    const stored = game.settings.get(MOD_ID, SETTING_TABLES);
    if (!stored || typeof stored !== "object") return {};
    return foundry.utils.deepClone(stored);
  } catch (e) {
    warn("getAllTables failed:", e);
    return {};
  }
}

async function setAllTables(tables) {
  await game.settings.set(MOD_ID, SETTING_TABLES, tables ?? {});
  return tables ?? {};
}

// ---------------------------------------------------------------------------
// Quests (Definitions Registry)
// Stored in world settings (bbttcc-campaign.quests)
// ---------------------------------------------------------------------------

function _normalizeQuest(id, data = {}) {
  const q = data || {};
  return {
    id,
    v: q?.v ?? 1,
    // Display / authoring
    name: String(q?.name ?? q?.label ?? id),
    description: String(q?.description ?? ""),
    tags: Array.isArray(q?.tags) ? q.tags : [],

    // NEW: status + order (registry workflow)
    status: String(q?.status ?? "active"),
    order: (q?.order != null) ? Number(q.order) : (q?.createdTs ?? Date.now()),

    // Optional: campaign association (future-proof; safe to ignore)
    campaignId: String(q?.campaignId ?? "") || null,

    createdTs: q?.createdTs ?? Date.now(),
    updatedTs: q?.updatedTs ?? Date.now()
  };
}

function getAllQuests() {
  try {
    const stored = game.settings.get(MOD_ID, SETTING_QUESTS);
    if (!stored || typeof stored !== "object") return {};
    return foundry.utils.deepClone(stored);
  } catch (e) {
    warn("getAllQuests failed:", e);
    return {};
  }
}

async function setAllQuests(quests) {
  await game.settings.set(MOD_ID, SETTING_QUESTS, quests ?? {});
  return quests ?? {};
}

function listQuests(opts = {}) {
  // opts: { campaignId, status: "all"|"active"|"completed"|"archived", search }
  const all = getAllQuests();
  const campaignId = String(opts?.campaignId || "").trim() || null;
  const status = String(opts?.status || "all").trim().toLowerCase();
  const search = String(opts?.search || "").trim().toLowerCase();

  let out = Object.entries(all).map(([id, q]) => _normalizeQuest(id, q));

  if (campaignId) {
    out = out.filter(q => !q.campaignId || String(q.campaignId) === String(campaignId));
  }

  if (status && status !== "all") {
    out = out.filter(q => String(q.status || "active").trim().toLowerCase() === status);
  }

  if (search) {
    out = out.filter(q => {
      const id = String(q.id || "").toLowerCase();
      const nm = String(q.name || "").toLowerCase();
      return id.includes(search) || nm.includes(search);
    });
  }

  // Stable sort: order asc, then name, then id
  out.sort((a, b) => {
    const ao = Number(a.order ?? a.createdTs ?? 0) || 0;
    const bo = Number(b.order ?? b.createdTs ?? 0) || 0;
    if (ao !== bo) return ao - bo;
    const an = String(a.name || a.id || "");
    const bn = String(b.name || b.id || "");
    return an.localeCompare(bn) || String(a.id || "").localeCompare(String(b.id || ""));
  });

  return out;
}

function getQuest(id) {
  const all = getAllQuests();
  const q = all[id] ?? null;
  return q ? _normalizeQuest(id, q) : null;
}

async function saveQuest(id, data = {}) {
  if (!id) throw new Error("saveQuest: id required");
  const all = getAllQuests();
  const prev = all[id] ?? {};
  const merged = Object.assign({}, prev, data, { updatedTs: Date.now() });
  all[id] = _normalizeQuest(id, merged);
  await setAllQuests(all);
  return getQuest(id);
}

async function createQuest(id, data = {}) {
  if (!id) throw new Error("createQuest: id required");
  const all = getAllQuests();
  if (all[id]) return getQuest(id);
  const q = Object.assign({}, data, { createdTs: Date.now(), updatedTs: Date.now() });
  all[id] = _normalizeQuest(id, q);
  await setAllQuests(all);
  return getQuest(id);
}

async function setQuestStatus(id, status) {
  status = String(status || "active").trim().toLowerCase();
  if (!status) status = "active";
  if (status !== "active" && status !== "completed" && status !== "archived") status = "active";
  const cur = getQuest(id);
  if (!cur) throw new Error("setQuestStatus: quest not found: " + String(id || ""));
  return await saveQuest(id, Object.assign({}, cur, { status: status }));
}

async function deleteQuest(id) {
  const all = getAllQuests();
  if (!(id in all)) return false;
  delete all[id];
  await setAllQuests(all);
  return true;
}


function getTable(id) {
  const all = getAllTables();
  const t = all[id] ?? null;
  return t ? _normalizeTable(id, t) : null;
}

async function saveTable(id, data) {
  if (!id) throw new Error("saveTable: id required");
  const all = getAllTables();
  all[id] = _normalizeTable(id, data);
  await setAllTables(all);
  log("Saved encounter table", id);
  return all[id];
}

async function createTable(id, data = {}) {
  if (!id) throw new Error("createTable: id required");
  const all = getAllTables();
  if (all[id]) return _normalizeTable(id, all[id]);
  all[id] = _normalizeTable(id, data);
  await setAllTables(all);
  log("Created encounter table", id);
  return all[id];
}

async function deleteTable(id) {
  const all = getAllTables();
  if (!(id in all)) return false;
  delete all[id];
  await setAllTables(all);
  log("Deleted encounter table", id);
  return true;
}

function listTables() {
  const all = getAllTables();
  return Object.entries(all).map(([id, t]) => _normalizeTable(id, t));
}

// ---------------------------------------------------------------------------
// Random Table Execution
// ---------------------------------------------------------------------------

function _canonicalizeCampaignTag(tag) {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  const map = {
    "trigger.travel_threshold": "inject.travel_threshold",
    "travel_threshold": "inject.travel_threshold",
    "enforcement": "inject.enforcement",
    "debt": "inject.debt_pressure",
    "hv.hidden_vault": "theme.discovery",
    "gilbert": "theme.auditor",
    "locals": "theme.locals",
    "denizens": "theme.denizens",
    "order": "politics.order",
    "security": "politics.security",
    "surveillance": "politics.surveillance",
    "repression": "politics.repression",
    "redistribution": "politics.redistribution",
    "privatization": "politics.privatization",
    "deregulation": "politics.deregulation",
    "welfare": "politics.welfare",
    "union_power": "politics.union_power",
    "collectivize": "politics.collectivize",
    "civil_liberties": "politics.civil_liberties",
    "property_rights": "politics.property_rights",
    "faith_law": "politics.faith_law",
    "clerical_rule": "politics.clerical_rule",
    "ethnonationalism": "politics.ethnonationalism",
    "purge": "politics.purge",
    "mutual_aid": "politics.mutual_aid",
    "decentralize": "politics.decentralize"
  };
  return map[raw] || raw;
}

function _tagArray(tagStr) {
  return String(tagStr || "").split(/[\s,]+/g).map(s => _canonicalizeCampaignTag(s.trim())).filter(Boolean);
}

function _passesEntryConditions(entry, { hexUuid = null, tags = "" } = {}) {
  const c = entry?.conditions || {};
  const tagList = _tagArray(tags);

  // hex allow/deny
  if (Array.isArray(c.hexWhitelist) && c.hexWhitelist.length && hexUuid) {
    if (!c.hexWhitelist.includes(hexUuid)) return false;
  }
  if (Array.isArray(c.hexBlacklist) && c.hexBlacklist.length && hexUuid) {
    if (c.hexBlacklist.includes(hexUuid)) return false;
  }

  // tag matching
  if (Array.isArray(c.tagsAll) && c.tagsAll.length) {
    const want = new Set(c.tagsAll);
    for (const t of want) if (!tagList.includes(t)) return false;
  }
  if (Array.isArray(c.tagsAny) && c.tagsAny.length) {
    const want = new Set(c.tagsAny);
    let ok = false;
    for (const t of tagList) if (want.has(t)) { ok = true; break; }
    if (!ok) return false;
  }

  return true;
}

function _weightedPick(entries) {
  const pool = entries
    .map(e => ({ e, w: Number(e?.weight ?? 0) }))
    .filter(x => x.w > 0);

  const total = pool.reduce((s, x) => s + x.w, 0);
  if (!total) return null;

  let r = Math.random() * total;
  for (const x of pool) {
    r -= x.w;
    if (r <= 0) return x.e;
  }
  return pool[pool.length - 1]?.e ?? null;
}

/**
 * Run a random encounter table by selecting an entry and delegating to runBeat().
 * Tables select beats. Beats execute exactly as-is (dialogs, encounters, world effects).
 */
async function runRandomTable({ tableId, hexUuid = null, tags = "", ctx = {} } = {}) {
  if (!tableId) throw new Error("runRandomTable: tableId required");

  const table = getTable(tableId);
  if (!table) {
    ui.notifications?.warn?.(`Random Table '${tableId}' not found.`);
    return { ok: false, reason: "table_not_found" };
  }

  const entries = Array.isArray(table.entries) ? table.entries : [];
  const filtered = entries.filter(ent => _passesEntryConditions(ent, { hexUuid, tags }));

  if (!filtered.length) {
    warn("runRandomTable: no eligible entries after filtering", { tableId, hexUuid, tags });
    ui.notifications?.warn?.(`Random Table '${table.label || tableId}': no eligible entries.`);
    return { ok: false, reason: "no_entries" };
  }

  const pick = _weightedPick(filtered);
  if (!pick) {
    warn("runRandomTable: weightedPick returned null", { tableId });
    ui.notifications?.warn?.(`Random Table '${table.label || tableId}': roll failed.`);
    return { ok: false, reason: "roll_failed" };
  }

  const campaignId = String(pick.campaignId || "").trim();
  const beatId = String(pick.beatId || "").trim();
  if (!campaignId || !beatId) {
    warn("runRandomTable: pick missing campaignId/beatId", pick);
    ui.notifications?.warn?.(`Random Table '${table.label || tableId}': entry missing campaignId/beatId.`);
    return { ok: false, reason: "bad_entry" };
  }

  log("Random Table fired", { tableId, campaignId, beatId, hexUuid, tags });

  // Delegate to beat execution (keeps all existing mechanics intact)
  // Pass table context through so encounter beats can launch with hexUuid/tags awareness.
  await runBeat(campaignId, beatId, { ...ctx, tableId, hexUuid, tags });

  return { ok: true, tableId, campaignId, beatId };
}

// ---------------------------------------------------------------------------
// Gottgait
// ---------------------------------------------------------------------------

async function logBeatToGottgait(campaign, beat) {
  const story = game.bbttcc?.api?.story?.gottgait;
  if (!story?.logBeat) return;
  try {
    await story.logBeat(
      `Campaign '${campaign.label}' beat '${beat.label || beat.id}' (${beat.type})`,
      { source: "bbttcc-campaign", campaignId: campaign.id, beatId: beat.id, beatType: beat.type }
    );
  } catch (e) {
    warn("logBeatToGottgait failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Dialog / Choices (RESTORED)
// ---------------------------------------------------------------------------

function _escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Journal auto-open (Beat.journal)  -  GM-only
// - beat.journal: { enabled:boolean, entryId:"JournalEntry.<id>"|"<id>", force:boolean }
// - When enabled, executeBeat will open the Journal Entry for the GM only
//   (mirrors clicking it in the Journal sidebar).
// ---------------------------------------------------------------------------

function _normalizeJournalId(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.indexOf("JournalEntry.") === 0) return s.slice("JournalEntry.".length);
  return s;
}

function _openJournalForGM(doc) {
  try {
    if (!doc) return;

    // Mirrors sidebar open: render the sheet for the local GM.
    if (doc.sheet && typeof doc.sheet.render === "function") {
      doc.sheet.render(true);
      return;
    }

    // Fallback (rare): some documents expose show(); keep GM-only intent.
    if (typeof doc.show === "function") doc.show(false);
  } catch (e) {
    warn("openJournalForGM failed:", e);
  }
}

function _maybeShowBeatJournal(beat) {
  try {
    const j = beat?.journal;
    if (!j || !j.enabled) return;

    const id = _normalizeJournalId(j.entryId);
    if (!id) return;

    const je = game?.journal?.get?.(id) || null;
    if (!je) return;

    _openJournalForGM(je);
  } catch (e) {
    warn("Beat journal auto-open failed:", e);
  }
}



// ---------------------------------------------------------------------------
// Beat Audio (Narration)  -  local playback helper (GM-side)
// - beat.audio: { enabled, src, volume (0..1), loop, autoplay }
// - Default behavior: only the local client plays audio (no broadcast).
// - We stop any prior beat audio before playing a new one (prevents stacking).
// ---------------------------------------------------------------------------

let __bbttccBeatAudioNow = null;
let __bbttccBeatAudioActive = new Set();
let __bbttccBeatAudioPlayToken = 0;

function _rememberBeatAudio(sound) {
  try {
    if (!sound) return;
    __bbttccBeatAudioActive.add(sound);
  } catch (_e) {}
}

function _forgetBeatAudio(sound) {
  try {
    if (!sound) return;
    __bbttccBeatAudioActive.delete(sound);
  } catch (_e) {}
}

function _stopOneBeatAudio(sound) {
  try {
    if (!sound) return;
    if (typeof sound.stop === "function") sound.stop();
    else if (typeof sound.fade === "function") sound.fade(0, { duration: 250 });
  } catch (_e) {}
}

function _stopBeatAudio() {
  try {
    __bbttccBeatAudioPlayToken += 1;

    const current = __bbttccBeatAudioNow;
    if (current) _stopOneBeatAudio(current);

    try {
      const active = Array.from(__bbttccBeatAudioActive || []);
      for (let i = 0; i < active.length; i++) _stopOneBeatAudio(active[i]);
    } catch (_e2) {}
  } catch (_e) {}

  __bbttccBeatAudioNow = null;
  try { __bbttccBeatAudioActive.clear(); } catch (_e3) { __bbttccBeatAudioActive = new Set(); }
}



// ---------------------------------------------------------------------------
// Beat Audio socket broadcast (GM -> players)
// - When beat.audio.broadcastPlayers is true, GM will broadcast playback to all
//   connected non-GM clients so narration becomes audible to the table.
// - Clients receive {type:'bbttccBeatAudio'} messages and play/stop locally.
// ---------------------------------------------------------------------------

const __BBTTCC_BEAT_AUDIO_SOCKET = `module.${MOD_ID}`;

const __BBTTCC_PLAYER_CHAT_FLAG = "playerFacingCourier";

function _extractPlayerFacingChatPayload(message) {
  try {
    const f = message && message.flags && message.flags[MOD_ID] ? message.flags[MOD_ID] : null;
    const row = f && f[__BBTTCC_PLAYER_CHAT_FLAG] ? f[__BBTTCC_PLAYER_CHAT_FLAG] : null;
    return row && typeof row === "object" ? row : null;
  } catch (_e) { return null; }
}

function _playerFacingRecipientIds() {
  try {
    return (game.users || [])
      .filter(function (u) { return u && !u.isGM; })
      .map(function (u) { return u.id; });
  } catch (_e) { return []; }
}

async function _broadcastPlayerFacingDialogViaChat(action, payload) {
  try {
    if (!game || !game.user || !game.user.isGM) return false;
    const recipients = _playerFacingRecipientIds();
    if (!recipients.length) return false;

    const row = {
      action: String(action || ""),
      payload: payload || {},
      ts: Date.now()
    };

    await ChatMessage.create({
      content: '<span style="display:none">BBTTCC Courier</span>',
      whisper: recipients,
      speaker: { alias: "BBTTCC Campaign" },
      flags: {
        [MOD_ID]: {
          [__BBTTCC_PLAYER_CHAT_FLAG]: row
        }
      }
    });

    return true;
  } catch (e) {
    warn("Player-facing chat bridge failed:", e);
    return false;
  }
}

function _installPlayerFacingChatBridge() {
  try {
    if (globalThis.__bbttccPlayerFacingChatBridgeInstalled) return;
    globalThis.__bbttccPlayerFacingChatBridgeInstalled = true;

    Hooks.on("createChatMessage", function (message) {
      try {
        const row = _extractPlayerFacingChatPayload(message);
        if (!row) return;
        if (game && game.user && game.user.isGM) return;

        const action = String(row.action || "");
        const payload = row.payload || {};

        if (action === "show") {
          _showPlayerFacingDialogLocal(payload);
          return;
        }
        if (action === "close") {
          _closePlayerFacingDialogLocal();
          return;
        }
        if (action === "audioStop") {
          try { _stopBeatAudio(); } catch (_eA0) {}
          try {
            const playing = game?.audio?.playing;
            if (playing && typeof playing.values === "function") {
              for (const snd of playing.values()) {
                try { snd?.stop?.(); } catch (_eA1) {}
                try { snd?.fade?.(0, { duration: 100 }); } catch (_eA2) {}
              }
            }
          } catch (_eA3) {}
          try {
            if (globalThis.Howler && typeof globalThis.Howler.stop === "function") globalThis.Howler.stop();
          } catch (_eA4) {}
          return;
        }
        if (action === "audioPlay") {
          try {
            const a = payload && payload.audio ? payload.audio : payload || {};
            const beat = { audio: {
              enabled: true,
              src: String(a.src || "").trim(),
              volume: a.volume,
              loop: !!a.loop,
              autoplay: false
            } };
            Promise.resolve(_playBeatAudio(beat, { forceForNonGM: true })).catch(function (_eAP) {});
          } catch (_eA5) {}
          return;
        }
      } catch (e) {
        warn("Player-facing createChatMessage bridge failed:", e);
      }
    });

    Hooks.on("renderChatMessageHTML", function (message, html) {
      try {
        const row = _extractPlayerFacingChatPayload(message);
        if (!row) return;
        try {
          if (html && html.style) html.style.display = "none";
        } catch (_e1) {}
        try {
          if (html && html.classList) html.classList.add("bbttcc-hidden-courier");
        } catch (_e2) {}
      } catch (_e) {}
    });

    log("Player-facing chat bridge installed.");
  } catch (_e) {}
}


function _installBeatAudioSocket() {
  try {
    if (globalThis.__bbttccBeatAudioSocketInstalled) return;
    globalThis.__bbttccBeatAudioSocketInstalled = true;

    const sock = game?.socket;
    if (!sock || typeof sock.on !== "function") return;

    sock.on(__BBTTCC_BEAT_AUDIO_SOCKET, (msg) => {
      try {
        if (!msg) return;

        // Scope routing (default: players). We still receive locally, so ignore if GM.
        const scope = String(msg.scope || "players");
        if (scope === "players" && game?.user?.isGM) return;

        if (msg.type === "bbttccBeatPlayerDialog") {
          const pAction = String(msg.action || "");
          if (pAction === "show") {
            _showPlayerFacingDialogLocal(msg.payload || msg || {});
            return;
          }
          if (pAction === "close") {
            _closePlayerFacingDialogLocal();
            return;
          }
          return;
        }

        if (msg.type !== "bbttccBeatAudio") return;

        const action = String(msg.action || "");
        if (action === "stop") {
          _stopBeatAudio();
          return;
        }

        if (action === "play") {
          const src = String(msg.src || "").trim();
          if (!src) return;
          const volume = Number.isFinite(Number(msg.volume)) ? Math.max(0, Math.min(1, Number(msg.volume))) : 0.85;
          const loop = !!msg.loop;

          // Reuse our local player, but force non-GM playback
          const beat = { audio: { enabled: true, src, volume, loop, autoplay: false } };
          Promise.resolve(_playBeatAudio(beat, { forceForNonGM: true })).catch(function (_ePlay) {});
        }
      } catch (e) {
        // Never let socket handler crash the client
        warn("Beat audio socket handler failed:", e);
      }
    });

    log("Beat audio socket listener installed.");
  } catch (_e) {}
}

async function _broadcastBeatAudio(action, payload) {
  try {
    if (!game?.user?.isGM) return false;

    payload = payload || {};
    const recipients = _playerFacingRecipientIds();
    if (!recipients.length) return false;

    const row = {
      action: (String(action || "").toLowerCase() === "play") ? "audioPlay" : "audioStop",
      payload: payload || {},
      ts: Date.now()
    };

    await ChatMessage.create({
      content: '<span style="display:none">BBTTCC Audio Courier</span>',
      whisper: recipients,
      speaker: { alias: "BBTTCC Campaign" },
      flags: {
        [MOD_ID]: {
          [__BBTTCC_PLAYER_CHAT_FLAG]: row
        }
      }
    });

    return true;
  } catch (e) {
    warn("Beat audio broadcast failed:", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Player-Facing Beat Dialog mirror (GM -> players)
// - When beat.playerFacing is true, GM broadcasts a read-only mirror dialog
//   to connected non-GM clients.
// - Players can read the beat description + visible choices, but cannot choose.
// - Mirror closes automatically when the GM resolves/closes the controlling dialog.
// ---------------------------------------------------------------------------

let __bbttccPlayerFacingDialog = null;

function _closePlayerFacingDialogLocal() {
  try {
    const pm = game?.bbttcc?.api?.campaign?.playerMirror || globalThis.BBTTCCPlayerBeatMirrorApp || null;
    if (pm && typeof pm.close === "function") pm.close();
  } catch (_ePM) {}
  try {
    const d = __bbttccPlayerFacingDialog;
    if (d && typeof d.close === "function") d.close();
  } catch (_e) {}
  __bbttccPlayerFacingDialog = null;
}

function _buildPlayerFacingDialogHtml(payload) {
  try {
    const title = _escapeHtml(payload && payload.title ? payload.title : "Beat");
    const desc = String(payload && payload.desc ? payload.desc : "").trim();
    const choices = Array.isArray(payload && payload.choices ? payload.choices : []) ? payload.choices : [];

    var parts = [];
    parts.push('<div class="bbttcc-campaign-dialog bbttcc-player-facing-dialog">');
    parts.push('<div style="font-weight:800; margin-bottom:8px;">' + title + '</div>');

    if (desc) {
      parts.push('<div class="bbttcc-campaign-dialog-desc" style="margin-bottom:10px;">' + _escapeHtml(desc).replace(/\n/g, "<br/>") + '</div>');
    }

    if (choices.length) {
      parts.push('<div class="bbttcc-campaign-dialog-choices">');
      for (var i = 0; i < choices.length; i++) {
        var ch = choices[i] || {};
        var label = _escapeHtml(ch.label || ("Choice " + (i + 1)));
        var cdesc = String(ch.description || "").trim();
        var checkLabel = String(ch.checkLabel || "").trim();
        var checkDC = _num(ch.checkDC, 0);

        parts.push('<div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:10px; margin:8px 0;">');
        parts.push('<div style="font-weight:700;">' + label + '</div>');
        if (cdesc) parts.push('<div style="opacity:0.85; margin-top:6px;">' + _escapeHtml(cdesc).replace(/\n/g, "<br/>") + '</div>');
        if (checkLabel) {
          parts.push('<div style="opacity:0.85; font-size:12px; margin-top:6px;"><b>Check:</b> ' + _escapeHtml(checkLabel) + '  -  <b>Difficulty:</b> ' + _escapeHtml(String(checkDC)) + '</div>');
        }
        parts.push('</div>');
      }
      parts.push('</div>');
    } else {
      parts.push('<div style="opacity:.8; margin-top:8px;">No choices are available for players on this beat.</div>');
    }

    parts.push('<div style="opacity:.72; font-size:12px; margin-top:10px;">Player-facing view. The GM resolves the outcome.</div>');
    parts.push('</div>');
    return parts.join("");
  } catch (_e) {
    return '<div class="bbttcc-campaign-dialog"><p>Player-facing beat dialog.</p></div>';
  }
}

function _showPlayerFacingDialogLocal(payload) {
  try {
    _closePlayerFacingDialogLocal();

    var title = String(payload && payload.title ? payload.title : "Beat");
    var content = _buildPlayerFacingDialogHtml(payload);

    // Player-facing mirror is intentionally read-only.
    // We rely on the window close control / GM close broadcast rather than footer buttons.
    var dlg = new Dialog({
      title: title,
      content: content,
      buttons: {},
      close: function () { __bbttccPlayerFacingDialog = null; }
    });

    __bbttccPlayerFacingDialog = dlg;
    dlg.render(true);

    try {
      setTimeout(function(){
        try { __bbttccAutosizeDialogDeferred(dlg, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_eA) {}
        try {
          if (dlg && dlg.element && dlg.element.addClass) dlg.element.addClass("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog");
        } catch (_eB) {}
        try {
          var btnWrap = dlg && dlg.element && dlg.element.find ? dlg.element.find(".dialog-buttons") : [];
          if (btnWrap && btnWrap.length) {
            try { btnWrap[0].style.display = "none"; } catch (_eC0) {}
          }
        } catch (_eD) {}
      }, 0);
    } catch (_e1) {}
  } catch (e) {
    warn("showPlayerFacingDialogLocal failed:", e);
    try {
      ui.notifications && ui.notifications.info && ui.notifications.info(String(payload && payload.title ? payload.title : "Beat"));
    } catch (_eN) {}
  }
}

function _broadcastPlayerFacingDialog(action, payload) {
  try {
    return _broadcastPlayerFacingDialogViaChat(action, payload);
  } catch (e) {
    warn("Player-facing dialog broadcast failed:", e);
    return false;
  }
}


async function _playBeatAudio(beat, opts) {
  opts = opts || {};
  try {
    const a = beat && beat.audio ? beat.audio : null;
    if (!a || !a.enabled) return null;
    const src = String(a.src || "").trim();
    if (!src) return null;

    // GM-only by default (narration helper)
    if (opts.forceForNonGM !== true) {
      if (!game.user || !game.user.isGM) return null;
    }

    const vol0 = Number(a.volume);
    const volume = (Number.isFinite(vol0) ? Math.max(0, Math.min(1, vol0)) : 0.85);
    const loop = !!a.loop;

    // Stop any prior beat audio to prevent overlap
    _stopBeatAudio();
    const playToken = __bbttccBeatAudioPlayToken;

    const s = await AudioHelper.play({ src, volume, loop }, true);

    // If a stop request landed while this sound was starting, kill it immediately.
    if (playToken !== __bbttccBeatAudioPlayToken) {
      _stopOneBeatAudio(s);
      return null;
    }

    __bbttccBeatAudioNow = s || null;
    _rememberBeatAudio(s);
    return __bbttccBeatAudioNow;
  } catch (e) {
    warn("Beat audio playback failed:", e);
    return null;
  }
}

async function _maybePlayBeatAudio(beat) {
  try {
    const a = beat && beat.audio ? beat.audio : null;
    if (!a || !a.enabled) return false;
    if (!a.autoplay) return false;
    // If table-wide playback is enabled, broadcast stop+play to players.
    try {
      if (game?.user?.isGM && a.broadcastPlayers) {
        _broadcastBeatAudio("stop", {});
      }
    } catch (_eB0) {}

    await _playBeatAudio(beat);

    try {
      if (game?.user?.isGM && a.broadcastPlayers) {
        _broadcastBeatAudio("play", { src: String(a.src || "").trim(), volume: a.volume, loop: !!a.loop });
      }
    } catch (_eB1) {}

    return true;
  } catch (_e) {
    return false;
  }
}

function _choiceHasCheck(ch) {
  return !!(ch?.checkStat && String(ch.checkStat).trim());
}

function _choiceCheckLabel(key) {
  const k = String(key || "").trim().toLowerCase();
  const map = {
    gm: "GM Adjudication",

    str: "Strength",
    dex: "Dexterity",
    con: "Constitution",
    int: "Intelligence",
    wis: "Wisdom",
    cha: "Charisma",

    "save.str": "Strength Save",
    "save.dex": "Dexterity Save",
    "save.con": "Constitution Save",
    "save.int": "Intelligence Save",
    "save.wis": "Wisdom Save",
    "save.cha": "Charisma Save",

    acr: "Acrobatics",
    ani: "Animal Handling",
    arc: "Arcana",
    ath: "Athletics",
    dec: "Deception",
    his: "History",
    ins: "Insight",
    itm: "Intimidation",
    inv: "Investigation",
    med: "Medicine",
    nat: "Nature",
    prc: "Perception",
    prf: "Performance",
    per: "Persuasion",
    rel: "Religion",
    slt: "Sleight of Hand",
    ste: "Stealth",
    sur: "Survival",

    "op.violence": "Violence",
    "op.nonlethal": "Nonlethal",
    "op.intrigue": "Intrigue",
    "op.economy": "Economy",
    "op.softpower": "Soft Power",
    "op.diplomacy": "Diplomacy",
    "op.logistics": "Logistics",
    "op.cult": "Culture",
    "op.faith": "Faith"
  };
  return map[k] || key;
}


function _isGMAdjudicatedChoice(ch) {
  try {
    if (!ch) return false;
    if (String(ch.checkMode || "").trim().toLowerCase() === "gm") return true;
    if (String(ch.checkStat || "").trim().toLowerCase() === "gm") return true;
  } catch (_e) {}
  return false;
}

function _gmAdjudicate(title, promptHtml) {
  return new Promise(function (resolve) {
    try {
      var content =
        '<div class="bbttcc-campaign-dialog" style="min-width:360px;">' +
        (promptHtml || "") +
        '<hr/>' +
        '<div style="opacity:.85; font-size:12px;">Players resolve the fiction. GM adjudicates the outcome here.</div>' +
        '</div>';

      var dlg = new Dialog({
        title: title || "Adjudicate Outcome",
        content: content,
        buttons: {
          success: { icon: '<i class="fas fa-check"></i>', label: "SUCCESS", callback: function () { resolve(true); } },
          fail:    { icon: '<i class="fas fa-times"></i>', label: "FAIL",    callback: function () { resolve(false); } }
        },
        default: "success",
        close: function () { resolve(false); }
      });

      dlg.render(true);
      try { __bbttccAutosizeDialogDeferred(dlg, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_e1) {}
      try { setTimeout(function(){ try { if (dlg && dlg.element && dlg.element.addClass) dlg.element.addClass("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog"); } catch (_eX) {} }, 0); } catch (_e2) {}
    } catch (e) {
      console.warn(TAG, "gmAdjudicate failed:", e);
      resolve(false);
    }
  });
}


function _num(v, d=0) {
  const s = String(v ?? "").replace(/\u2212/g, "-").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : d;
}


async function _evalRoll(roll) {
  // Foundry v13: Roll#evaluate is async by default; the {async:true} option is deprecated.
  try { return await roll.evaluate(); } catch (_e1) {}
  try { return await roll.evaluate({ async: true }); } catch (_e2) {}
  try { return roll.evaluateSync(); } catch (_e3) {}
  return roll;
}

async function _resolveFaction(id) {
  if (!id) return null;
  if (String(id).includes(".")) {
    try { return await fromUuid(id); } catch {}
  }
  return game.actors?.get?.(id) || null;
}

function _characterBelongsToFactionForCampaign(char, faction) {
  try {
    if (!char || !faction) return false;
    const byId = char.getFlag?.("bbttcc-factions", "factionId");
    if (byId) return String(byId) === String(faction.id);
    const byName = char.getFlag?.("bbttcc-factions", "factionName");
    if (byName) return String(byName).trim() === String(faction.name).trim();
    return false;
  } catch (_e) {
    return false;
  }
}

async function _getFactionRoster(faction) {
  try {
    const out = [];
    const seen = new Set();
    const raw = (faction && faction.getFlag) ? (faction.getFlag("bbttcc-factions", "roster") || []) : [];

    for (let i=0; i<raw.length; i++) {
      const entry = raw[i];

      // Support roster entries as:
      // - actor id: "abcd1234..."
      // - uuid-ish: "Actor.<id>"
      // - object: { id, uuid }
      const s = (typeof entry === "string") ? entry : (entry && (entry.uuid || entry.id)) ? String(entry.uuid || entry.id) : "";
      if (!s) continue;

      // Direct id
      const id = String(s).replace(/^Actor\./, "").trim();

      // Prefer local world actors
      let a = game.actors.get(id) || null;

      // If not found and looks like a UUID, try fromUuid
      if (!a && (String(s).indexOf(".") !== -1) && typeof fromUuid === "function") {
        try { a = await fromUuid(String(s)); } catch (_eU) { a = null; }
      }

      if (a && !seen.has(String(a.id))) {
        seen.add(String(a.id));
        out.push(a);
      }
    }

    // Fallback: if no explicit roster flag exists, mirror the faction-sheet roster logic
    // by scanning all character actors linked by bbttcc-factions.factionId / factionName.
    if (!out.length) {
      const actors = Array.from(game.actors?.contents || []);
      for (let i=0; i<actors.length; i++) {
        const a = actors[i];
        if (!a) continue;
        if (String(a.type || "") !== "character") continue;
        if (!_characterBelongsToFactionForCampaign(a, faction)) continue;
        if (seen.has(String(a.id))) continue;
        seen.add(String(a.id));
        out.push(a);
      }
    }

    return out;
  } catch (_e) {
    return [];
  }
}

function _readOpBank(faction, key) {
  const bank = faction?.getFlag("bbttcc-factions", "opBank") || {};
  return _num(bank[key], 0);
}

function _readActorOp(actor, key) {
  try {
    const k = String(key || "").trim().toLowerCase();
    const v =
      foundry.utils.getProperty(actor, `flags.bbttcc-character-options.calculatedOPs.${k}`) ??
      foundry.utils.getProperty(actor, `flags.bbttcc-character-options.opBonuses.${k}`) ??
      foundry.utils.getProperty(actor, `flags.bbttcc.opBonuses.${k}`) ??
      foundry.utils.getProperty(actor, `flags.bbttcc-factions.opContrib.${k}`) ??
      0;
    return _num(v, 0);
  } catch (_e) {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// OP Gating (Campaign Dialog)  -  attempt requires 1 OP of type
// - Adds tooltips + disables OP-check choice buttons when OP is empty.
// - Optional Desperation (UI + confirm) when ctx.allowDesperation === true.
// - Adds OP hover chips to beat dialogs.
// NOTE: This is UI gating + (optional) 1-OP spend on attempt for OP checks.
// ---------------------------------------------------------------------------

function _opKeyLabel(key) {
  key = String(key || "").trim().toLowerCase();
  if (!key) return "OP";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function _readOpBankAll(faction) {
  try {
    const bank = (faction && faction.getFlag) ? (faction.getFlag("bbttcc-factions", "opBank") || {}) : ((faction && faction.flags && faction.flags["bbttcc-factions"] && faction.flags["bbttcc-factions"].opBank) || {});
    const out = {};
    for (const k of Object.keys(bank || {})) out[String(k)] = _num(bank[k], 0);
    return out;
  } catch (_e) { return {}; }
}

async function _computeFactionOpRollBonusMap(faction) {
  try {
    const bank = _readOpBankAll(faction);
    const roster = await _getFactionRoster(faction);
    const keys = new Set(Object.keys(bank || {}));
    ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"].forEach(k => keys.add(k));
    const out = {};
    for (const k of keys) {
      const key = String(k || "").trim().toLowerCase();
      if (!key) continue;
      const base = _num(bank[key], 0);
      const rosterSum = Array.isArray(roster) ? roster.reduce((s, a) => s + _readActorOp(a, key), 0) : 0;
      out[key] = base + rosterSum;
    }
    return out;
  } catch (_e) { return {}; }
}

function _buildOpChipsHtml(bank, focusKey) {
  try {
    const keys = Object.keys(bank || {});
    keys.sort((a,b)=>String(a).localeCompare(String(b)));
    const chips = [];

    for (let i=0; i<keys.length; i++) {
      const k = String(keys[i] || "").trim();
      const v = _num(bank[k], 0);
      const label = _opKeyLabel(k);
      const state = (v >= 1) ? "ok" : "empty";
      const focus = (focusKey && String(focusKey) === String(k)) ? " focus" : "";
      const tt = (v >= 1)
        ? ("Faction " + label + " OP available: " + v)
        : ("No " + label + " OP available");

      chips.push(
        `<span class="bbttcc-op-chip ${state}${focus}" data-op="${_escapeHtml(k)}" title="${_escapeHtml(tt)}">${_escapeHtml(label)}: ${v}</span>`
      );
    }

    if (focusKey && !Object.prototype.hasOwnProperty.call(bank || {}, focusKey)) {
      const label2 = _opKeyLabel(focusKey);
      const tt2 = "No " + label2 + " OP available";
      chips.unshift(
        `<span class="bbttcc-op-chip empty focus" data-op="${_escapeHtml(focusKey)}" title="${_escapeHtml(tt2)}">${_escapeHtml(label2)}: 0</span>`
      );
    }

    return `<div class="bbttcc-op-chips">${chips.join("")}</div>`;
  } catch (_e) {
    return "";
  }
}

function _buildOpRollBonusChipsHtml(bonuses, focusKey) {
  try {
    const keys = Object.keys(bonuses || {});
    keys.sort((a,b)=>String(a).localeCompare(String(b)));
    const chips = [];

    for (let i=0; i<keys.length; i++) {
      const k = String(keys[i] || "").trim();
      const v = _num(bonuses[k], 0);
      const label = _opKeyLabel(k);
      const focus = (focusKey && String(focusKey) === String(k)) ? " focus" : "";
      const tt = "Faction " + label + " OP roll bonus: +" + v;

      chips.push(
        `<span class="bbttcc-op-chip roll${focus}" data-op-roll="${_escapeHtml(k)}" title="${_escapeHtml(tt)}">${_escapeHtml(label)}: +${v}</span>`
      );
    }

    if (focusKey && !Object.prototype.hasOwnProperty.call(bonuses || {}, focusKey)) {
      const label2 = _opKeyLabel(focusKey);
      const tt2 = "Faction " + label2 + " OP roll bonus: +0";
      chips.unshift(
        `<span class="bbttcc-op-chip roll focus" data-op-roll="${_escapeHtml(focusKey)}" title="${_escapeHtml(tt2)}">${_escapeHtml(label2)}: +0</span>`
      );
    }

    return `<div class="bbttcc-op-chips bbttcc-op-roll-bonuses">${chips.join("")}</div>`;
  } catch (_e) {
    return "";
  }
}

function _evalOpGateForKey(faction, opKey, allowDesperation) {
  const v = _readOpBank(faction, opKey);
  if (v >= 1) return { ok: true, mode: "normal", pool: v };
  if (allowDesperation) return { ok: true, mode: "desperation", pool: v };
  return { ok: false, mode: "blocked", pool: v };
}

function _applyOpGatesToDialogButtons(dlg, faction, choices, allowDesperation) {
  try {
    if (!dlg || !dlg.element) return;
    const el = dlg.element;

    const byButtonId = {};
    for (let i=0; i<choices.length; i++) byButtonId["c" + i] = i;

    const btns = el.find(".dialog-buttons button");
    btns.each(function () {
      const $b = $(this);
      const bid = $b.attr("data-button") || "";
      const idx = (bid in byButtonId) ? byButtonId[bid] : null;
      if (idx == null) return;

      const ch = choices[idx] || {};
      const stat = String(ch.checkStat || "").trim().toLowerCase();
      if (stat.indexOf("op.") !== 0) return;

      const opKey = String(stat.split(".")[1] || "").trim().toLowerCase();
      if (!opKey) return;

      const gate = _evalOpGateForKey(faction, opKey, allowDesperation);

      if (!gate.ok) {
        $b.prop("disabled", true);
        $b.addClass("bbttcc-roll-blocked");
        $b.attr("title", "Action Unavailable\nRequires 1 " + _opKeyLabel(opKey) + " OP.\nThe faction cannot support this action.");
        return;
      }

      if (gate.mode === "desperation") {
        $b.prop("disabled", false);
        $b.addClass("bbttcc-roll-desperate");
        $b.attr("title", "Desperation Attempt\nNo " + _opKeyLabel(opKey) + " OP remains.\nRoll proceeds, but consequences are guaranteed.");
        try { el.find('.bbttcc-op-chip[data-op="' + opKey + '"]').addClass("desperate"); } catch (_e2) {}
        return;
      }

      $b.prop("disabled", false);
      $b.removeClass("bbttcc-roll-blocked bbttcc-roll-desperate");
      $b.attr("title", "Faction Support Available\nSpending 1 " + _opKeyLabel(opKey) + " OP authorizes this roll.");
    });
  } catch (e) {
    warn("applyOpGatesToDialogButtons failed:", e);
  }
}

async function _confirmDesperation(opKey) {
  return new Promise(function (resolve) {
    const label = _opKeyLabel(opKey);
    new Dialog({
      title: "Proceed in Desperation?",
      content:
        "<p>You are attempting an action without faction support.</p>" +
        "<p><b>This roll is a Desperation Attempt.</b></p>" +
        "<p style='opacity:.85'>No <b>" + label + " OP</b> remains. Consequences are guaranteed.</p>",
      buttons: {
        yes: { icon: '<i class="fas fa-exclamation-triangle"></i>', label: "Proceed Anyway", callback: function () { resolve(true); } },
        no:  { icon: '<i class="fas fa-ban"></i>', label: "Stand Down",     callback: function () { resolve(false); } }
      },
      default: "no",
      close: function () { resolve(false); }
    }).render(true);
  });
}

async function _spendOneOpForAttempt(faction, opKey, reason) {
  try {
    const api = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
    const op = api && api.op ? api.op : null;
    if (!op || typeof op.commit !== "function") return false;

    const factionId = faction && faction.id ? faction.id : null;
    if (!factionId) return false;

    const deltas = {};
    deltas[String(opKey)] = -1;

    await op.commit(factionId, deltas, reason || ("Campaign OP check: " + String(opKey)));
    return true;
  } catch (e) {
    warn("OP spend failed (attempt spendOneOpForAttempt).", e);
    try { ui.notifications && ui.notifications.warn && ui.notifications.warn("Could not spend 1 " + _opKeyLabel(opKey) + " OP (see console)."); } catch (_e2) {}
    return false;
  }
}

async function _spendFactionOpSupport(faction, opKey, amount, reason) {
  try {
    amount = _num(amount, 0);
    if (!faction || !opKey || amount <= 0) return false;

    const api = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
    const op = api && api.op ? api.op : null;

    if (op && typeof op.commit === "function") {
      const deltas = {};
      deltas[String(opKey)] = -Math.abs(amount);
      await op.commit(faction.id, deltas, reason || ("Faction backing: " + String(opKey)));
      return true;
    }

    const bank = _readOpBankAll(faction);
    const cur = _num(bank[String(opKey)], 0);
    if (cur < amount) return false;
    bank[String(opKey)] = Math.max(0, cur - amount);
    await faction.setFlag("bbttcc-factions", "opBank", bank);
    return true;
  } catch (e) {
    warn("spendFactionOpSupport failed", e);
    return false;
  }
}
function _supportBonusForSpend(spend) {
  spend = _num(spend, 0);
  return Math.max(0, spend) * 2; // +2 per OP
}

async function _sacrificeHpToFactionOp(actor, faction, opKey, hpCost, reason) {
  try {
    hpCost = _num(hpCost, 5);
    if (!actor || !faction || !opKey) return false;

    const hp = actor.system && actor.system.attributes && actor.system.attributes.hp ? actor.system.attributes.hp : null;
    const cur = hp ? _num(hp.value, 0) : 0;
    if (cur < hpCost) {
      ui.notifications?.warn?.("Not enough HP to sacrifice (" + hpCost + " required).");
      return false;
    }

    await actor.update({ "system.attributes.hp.value": Math.max(0, cur - hpCost) });

    const api = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
    const op = api && api.op ? api.op : null;
    if (op && typeof op.commit === "function") {
      const deltas = {}; deltas[String(opKey)] = +1;
      await op.commit(faction.id, deltas, reason || ("HP sacrifice -> " + String(opKey)));
    } else {
      const bank = _readOpBankAll(faction);
      bank[String(opKey)] = _num(bank[String(opKey)], 0) + 1;
      await faction.setFlag("bbttcc-factions", "opBank", bank);
    }

    ui.notifications?.info?.("Sacrifice accepted: -" + hpCost + " HP  ->  +1 " + _opKeyLabel(opKey) + " OP (Faction).");
    return true;
  } catch (e) {
    warn("sacrificeHpToFactionOp failed", e);
    try { ui.notifications?.warn?.("Sacrifice failed (see console)."); } catch(_e2){}
    return false;
  }
}




async function _rollChoiceCheck(choice, ctx={}) {
  const stat = String(choice.checkStat || "").trim().toLowerCase();
  const dc = _num(choice.checkDC, 0);
  const supportKey = String((ctx.supportOpKey || (ctx.support || {}).opKey) || "").trim().toLowerCase();
  const supportSpend = _num((ctx.supportSpend != null ? ctx.supportSpend : (ctx.support || {}).spend), 0);
  const supportBonus = _supportBonusForSpend(supportSpend);

  if (stat.startsWith("op.")) {
    const key = stat.split(".")[1];
    const factionId = ctx.factionId || ctx.factionUuid || ctx.actorId || null;
    const faction = await _resolveFaction(factionId);
    if (!faction) {
      const roll = await _evalRoll(new Roll("1d20"));
      return { kind:"op", stat, dc, total:roll.total, ok:roll.total>=dc, roll };
    }
    const base = _readOpBank(faction, key);
    const roster = await _getFactionRoster(faction);
    const rosterSum = roster.reduce((s,a)=>s+_readActorOp(a,key),0);
    const bonus = base + rosterSum;
    const roll = await _evalRoll(new Roll("1d20 + @b", { b: bonus }));
    const total = roll.total ?? 0;
    return { kind:"op", stat, opKey:key, dc, bonus, breakdown:{ base, roster:rosterSum }, total, ok:total>=dc, roll };
  }

  let actor = null;
  if (ctx.rosterActorId) actor = game.actors.get(ctx.rosterActorId) || null;
  if (actor) {
    try {

      // Saving throw support: checkStat "save.str" / "save.dex" / etc.
      if (stat.indexOf("save.") === 0) {
        const abil = String(stat.slice(5) || "").trim().toLowerCase();
        if (typeof actor.rollAbilitySave === "function") {
          const r = await actor.rollAbilitySave(abil, { chatMessage:false });
          return { kind:"actor", subkind:"save", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
        }
        if (typeof actor.rollAbilityTest === "function") {
          const r = await actor.rollAbilityTest(abil, { chatMessage:false });
          return { kind:"actor", subkind:"save_fallback", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
        }
      }

      if (actor.system?.skills?.[stat]) {
        const r = await actor.rollSkill(stat, { chatMessage:false });
        return { kind:"actor", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
      }
      if (actor.system?.abilities?.[stat]) {
        const r = await actor.rollAbilityTest(stat, { chatMessage:false });
        return { kind:"actor", stat, dc, actorName:actor.name, total:(r.total + supportBonus), ok:(r.total + supportBonus)>=dc, roll:r, support:{ opKey:supportKey, spend:supportSpend, bonus:supportBonus } };
      }
    } catch {}
  }

  const roll = await _evalRoll(new Roll("1d20"));
  return { kind:"basic", stat, dc, total:roll.total, ok:roll.total>=dc, roll };
}

async function _runBeatDialog(campaign, beat, ctx={}) {
  try { if (ctx && ctx.allowDesperation == null) ctx.allowDesperation = true; } catch (_eAD) {}

  const title = `${beat.label || beat.id || "Beat"}`;
  const desc = String(beat.description || "").trim();
  const choices = Array.isArray(beat.choices) ? beat.choices : [];
  const isPlayerFacing = !!(beat && (beat.playerFacing || beat.playerFacingDialog || beat.dialogPlayerFacing || beat.playerFacingContent || beat.showToPlayers));

  if (isPlayerFacing) {
    try {
      _broadcastPlayerFacingDialog("show", {
        title: title,
        desc: desc,
        choices: choices.map(function (ch, i) {
          return {
            label: ch && ch.label ? ch.label : ('Choice ' + (i + 1)),
            description: String(ch && ch.description ? ch.description : '').trim(),
            checkLabel: _choiceHasCheck(ch) ? _choiceCheckLabel(ch.checkStat) : '',
            checkDC: _choiceHasCheck(ch) ? _num(ch.checkDC, 0) : 0
          };
        })
      });
    } catch (_ePF) {}
  }

  // If no prompt text and no choices, nothing to show
  if (!desc && !choices.length) return { acted: false };

  const factionId =
    ctx.factionId || beat.factionId || campaign.factionId || null;

  let roster = [];
  if (factionId) {
    try {
      const fac = await _resolveFaction(factionId);
      const actors = await _getFactionRoster(fac);
      roster = actors.map(a => ({ id: a.id, name: a.name }));
    } catch (_eR) {}
  }

  const rosterHtml = roster.length ? `
    <div class="bbttcc-field" style="margin:8px 0;">
      <label><b>Roster Member (for individual checks)</b></label>
      <select name="bbttccRosterActor" data-id="rosterActorId" style="width:100%;">
        ${roster.map(r=>`<option value="${_escapeHtml(r.id)}" ${ctx && ctx.rosterActorId && String(ctx.rosterActorId)===String(r.id) ? "selected" : ""}>${_escapeHtml(r.name)}</option>`).join("")}
      </select>
      <div style="opacity:.75;font-size:12px;">Ignored for OP checks</div>
    </div>
  ` : "";

  // OP bank chips (faction visibility)
  let faction = null;
  let opBankAll = {};
  let opRollBonusAll = {};
  let opChipsHtml = "";
  let opRollBonusHtml = "";
  if (factionId) {
    try {
      faction = await _resolveFaction(factionId);
      if (faction) {
        opBankAll = _readOpBankAll(faction);
        opRollBonusAll = await _computeFactionOpRollBonusMap(faction);
        opChipsHtml = _buildOpChipsHtml(opBankAll, null);
        opRollBonusHtml = _buildOpRollBonusChipsHtml(opRollBonusAll, null);
      }
    } catch (_eB) {}
  }


  const bodyHtml = `
    <div class="bbttcc-campaign-dialog">

${
  (beat && beat.audio && beat.audio.enabled && String(beat.audio.src || "").trim())
    ? `<div class="bbttcc-beat-audio-controls" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 10px 0;">
         <button type="button" class="bbttcc-button bbttcc-beat-audio-play" data-src="${_escapeHtml(String(beat.audio.src || "").trim())}">
           <i class="fas fa-volume-up"></i> Play Narration
         </button>
         <button type="button" class="bbttcc-button bbttcc-beat-audio-stop">
           <i class="fas fa-stop"></i> Stop
         </button>
         <span class="bbttcc-muted" style="opacity:.7; font-size:12px;">(local)</span>
       </div>`
    : ""
}
      ${desc ? `<div class="bbttcc-campaign-dialog-desc">${_escapeHtml(desc).replaceAll("\n", "<br/>")}</div>` : ""}
      ${rosterHtml}
      ${opChipsHtml ? `<div class="bbttcc-muted" style="margin-top:6px;">Faction OP Pools</div>${opChipsHtml}` : ""}
      ${opRollBonusHtml ? `<div class="bbttcc-muted" style="margin-top:6px;">Faction Roll Bonuses</div>${opRollBonusHtml}` : ""}
      ${
        choices.length
          ? `<div class="bbttcc-campaign-dialog-choices">
               ${choices.map((ch, i) => {
                 const label = _escapeHtml(ch.label || `Choice ${i + 1}`);
                 const cdesc = String(ch.description || "").trim();
                 const meta = _choiceHasCheck(ch)
                   ? (() => {
                       const statRaw = String((ch && ch.checkStat) || "").trim().toLowerCase();
                       const statLabel = _choiceCheckLabel(statRaw);
                       const isOp = statRaw.indexOf("op.") === 0;
                       const opKey = isOp ? String(statRaw.split(".")[1] || "").trim().toLowerCase() : "";
                       const dc = _num((ch && ch.checkDC) != null ? ch.checkDC : 0, 0);
                 
                       const line =
                         '<div class="bbttcc-choice-checkmeta" style="margin-top:8px;">' +
                           '<div class="bbttcc-choice-checkmeta__row" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">' +
                             '<span class="bbttcc-choice-checkmeta__label" style="min-width:78px; opacity:.72; font-size:12px; text-transform:uppercase; letter-spacing:.08em;">Check</span>' +
                             '<span class="bbttcc-choice-checkmeta__value" style="font-weight:700;">' + _escapeHtml(statLabel) + '</span>' +
                           '</div>' +
                           '<div class="bbttcc-choice-checkmeta__row" style="display:flex; gap:8px; align-items:center;">' +
                             '<span class="bbttcc-choice-checkmeta__label" style="min-width:78px; opacity:.72; font-size:12px; text-transform:uppercase; letter-spacing:.08em;">Difficulty</span>' +
                             '<span class="bbttcc-choice-checkmeta__value" style="font-weight:700;">' + dc + '</span>' +
                           '</div>' +
                         '</div>';

                       const chips = (isOp && opChipsHtml) ? _buildOpChipsHtml(opBankAll, opKey) : "";
                       const rollChips = (isOp && opRollBonusHtml) ? _buildOpRollBonusChipsHtml(opRollBonusAll, opKey) : "";
                       const pool = (isOp && opKey) ? _num(opBankAll[opKey], 0) : 0;
                       let sac = "";
                       if (isOp && opKey && pool <= 0 && ctx && ctx.rosterActorId) {
                         sac = '<div style="margin-top:6px;">' +
                                 '<button type="button" class="bbttcc-sacrifice-btn" data-op="' + _escapeHtml(opKey) + '" data-hp="5" title="Convert 5 HP into +1 ' + _escapeHtml(_opKeyLabel(opKey)) + ' OP for the faction.">' +
                                   ' Bleed (5 HP) ? +1 ' + _escapeHtml(_opKeyLabel(opKey)) + ' OP' +
                                 '</button>' +
                               '</div>';
                       }
                       return line + (chips ? chips : "") + (rollChips ? rollChips : "") + sac;
                     })()
                   : "";
                 return `
                   <div style="padding:8px 10px; border:1px solid rgba(255,255,255,0.10); border-radius:10px; margin:8px 0;">
                     <div style="font-weight:700;">${label}</div>
                     ${cdesc ? '<div style="opacity:0.85; margin-top:6px;">' + _escapeHtml(cdesc).replace(/\n/g, "<br/>") + '</div>' : ""}
                     ${meta}
                   </div>
                 `;
               }).join("")}
             </div>`
          : ""
      }
    </div>
  `;

  return await new Promise(resolve => {
    let done = false;
    const finish = (payload) => {
      if (done) return;
      done = true;
      try {
        if (isPlayerFacing) _broadcastPlayerFacingDialog("close", {});
      } catch (_ePFClose) {}
      try {
        const a = beat && beat.audio ? beat.audio : null;
        if (a && a.enabled) {
          if (game?.user?.isGM && a.broadcastPlayers) {
            try { _broadcastBeatAudio("stop", {}); } catch (_eStopB) {}
          }
          try { _stopBeatAudio(); } catch (_eStopL) {}
        }
      } catch (_eStopAny) {}
      resolve(payload);
    };

    const buttons = {};

    // Build one button per choice
    if (choices.length) {
      for (let i = 0; i < choices.length; i++) {
        const ch = choices[i];
        const label = ch.label || `Choice ${i + 1}`;

        buttons[`c${i}`] = {
          label,
          callback: async (html) => {
            try {
              const sel = html && html[0] ? html[0].querySelector('select[name="bbttccRosterActor"]') : null;
              const rosterActorId = sel ? (sel.value || null) : null;

              // Support/backing (Faction OP spend -> +2 per OP bonus)  -  optional
              // NOTE: Support UI may be absent; fall back to ctx/choice fields.
              var supportOpKey = String(
                (ch && (ch.supportOpKey || (ch.support && ch.support.opKey))) ||
                (ctx && (ctx.supportOpKey || (ctx.support && ctx.support.opKey))) ||
                ""
              ).trim().toLowerCase();
              var supportSpend = _num(
                (ch && (ch.supportSpend != null ? ch.supportSpend : (ch.support && ch.support.spend))) != null
                  ? (ch.supportSpend != null ? ch.supportSpend : (ch.support && ch.support.spend))
                  : (ctx && (ctx.supportSpend != null ? ctx.supportSpend : (ctx.support && ctx.support.spend))),
                0
              );


              // If choice has a check, resolve now
              if (_choiceHasCheck(ch)) {

                // GM adjudication mode (no automation)
                if (_isGMAdjudicatedChoice(ch)) {
                  const dcTxt = (ch.checkDC != null && String(ch.checkDC).trim() !== "") ? String(_num(ch.checkDC != null ? ch.checkDC : 0, 0)) : "";
                  const statTxt = String((ch && ch.checkStat) || "").trim() || "gm";
                  const prompt = String((ch && (ch.checkPrompt || ch.prompt)) || "").trim();

                  const prettyStat = _choiceCheckLabel(statTxt);
                  const metaLine = (prettyStat || dcTxt)
                    ? '<div style="opacity:0.9;font-size:12px;margin-top:6px;">' +
                        (prettyStat ? '<b>Check:</b> ' + _escapeHtml(prettyStat) : '') +
                        (dcTxt ? ((prettyStat ? '  -  ' : '') + '<b>Difficulty:</b> ' + _escapeHtml(dcTxt)) : '') +
                      '</div>'
                    : "";

                  const promptLine = prompt
                    ? '<div style="opacity:0.92; margin-top:6px;">' + _escapeHtml(prompt).replace(/\n/g, "<br/>") + '</div>'
                    : '<div style="opacity:0.92; margin-top:6px;">Players resolve the fiction. Choose the outcome.</div>';

                  const ok = await _gmAdjudicate(label, '<div style="font-weight:700;">' + _escapeHtml(label) + '</div>' + promptLine + metaLine);

                  const nextId = ok ? (ch.next || "") : (ch.failNext || beat.outcomes?.failure || "");
                  if (nextId) await runBeat(campaign.id, nextId);

                  finish({
                    acted: true,
                    routed: !!nextId,
                    choiceIndex: i,
                    choice: ch,
                    check: { stat: statTxt, dc: _num(ch.checkDC, 0), ok: !!ok, kind: "gm" }
                  });
                  return;
                }

                
                // Default behavior for non-OP checks: GM adjudication (player resolves rolls via MidiQOL/manual/etc).
                // To force auto-rolling, author choice.checkMode = "auto".
                const mode = String(ch.checkMode || "").trim().toLowerCase();
                const statTxt0 = String(ch.checkStat || "").trim().toLowerCase();
                const isOp = statTxt0.indexOf("op.") === 0;

                if (!isOp && mode !== "auto") {
                  const dcTxt = (ch.checkDC != null && String(ch.checkDC).trim() !== "") ? String(_num(ch.checkDC != null ? ch.checkDC : 0, 0)) : "";
                  const statTxt = String((ch && ch.checkStat) || "").trim() || "check";
                  const prompt = String((ch && (ch.checkPrompt || ch.prompt)) || "").trim();

                  const prettyStat = _choiceCheckLabel(statTxt);
                  const metaLine = (prettyStat || dcTxt)
                    ? '<div style="opacity:0.9;font-size:12px;margin-top:6px;">' +
                        (prettyStat ? '<b>Check:</b> ' + _escapeHtml(prettyStat) : '') +
                        (dcTxt ? ((prettyStat ? '  -  ' : '') + '<b>Difficulty:</b> ' + _escapeHtml(dcTxt)) : '') +
                      '</div>'
                    : "";

                  const promptLine = prompt
                    ? '<div style="opacity:0.92; margin-top:6px;">' + _escapeHtml(prompt).replace(/\n/g, "<br/>") + '</div>'
                    : '<div style="opacity:0.92; margin-top:6px;">Players resolve the fiction (rolls/powers/etc). GM chooses the outcome.</div>';

                  const ok = await _gmAdjudicate(label, '<div style="font-weight:700;">' + _escapeHtml(label) + '</div>' + promptLine + metaLine);

                  const nextId = ok ? (ch.next || "") : (ch.failNext || beat.outcomes?.failure || "");
                  if (nextId) await runBeat(campaign.id, nextId);

                  finish({
                    acted: true,
                    routed: !!nextId,
                    choiceIndex: i,
                    choice: ch,
                    check: { stat: statTxt, dc: _num(ch.checkDC, 0), ok: !!ok, kind: "gm" }
                  });
                  return;
                }

// Auto-resolved roll (OP / actor if roster selected)
                
                // OP gating (requires 1 OP to attempt)
                if (isOp) {
                  try {
                    const allowDesperation = !!(ctx && ctx.allowDesperation);
                    const opKey = String(statTxt0.split(".")[1] || "").trim().toLowerCase();
                    if (faction && opKey) {
                      const gate = _evalOpGateForKey(faction, opKey, allowDesperation);
                      if (!gate.ok) {
                        try { ui.notifications?.warn?.("This action requires 1 " + _opKeyLabel(opKey) + " OP."); } catch (_eN) {}
                        return false; // keep dialog open
                      }
                      if (gate.mode === "desperation") {
                        const ok = await _confirmDesperation(opKey);
                        if (!ok) return false; // keep dialog open
                      }
                      // Spend 1 OP on attempt (optional; safe if op.commit exists)
                      await _spendOneOpForAttempt(faction, opKey, "Campaign OP check: " + (beat.label || beat.id || ""));
                    }
                  } catch (_eG) {}
                }

// Spend faction OP backing (if any) before rolling
                if (supportOpKey && supportSpend > 0) {
                  const pool2 = _readOpBank(faction, supportOpKey);
                  if (pool2 < supportSpend) {
                    ui.notifications?.warn?.("Not enough " + _opKeyLabel(supportOpKey) + " OP for backing.");
                    return false;
                  }
                  const okSpend2 = await _spendFactionOpSupport(faction, supportOpKey, supportSpend, "Faction backing: " + (beat.label || beat.id || ""));
                  if (!okSpend2) {
                    ui.notifications?.warn?.("Could not spend faction OP for backing (see console).");
                    return false;
                  }
                }

                const res = await _rollChoiceCheck(ch, { factionId, rosterActorId, supportOpKey, supportSpend });

                if (res.kind === "op") {
                  ui.notifications?.info?.(
                    `${label}: ${res.total} (1d20 + ${res.bonus}) vs DC ${res.dc}  ->  ${res.ok ? "SUCCESS" : "FAIL"}`
                  );
                } else {
                  ui.notifications?.info?.(
                    `${label}: ${res.total} vs DC ${res.dc}  ->  ${res.ok ? "SUCCESS" : "FAIL"}`
                  );
                }

                const nextId = res.ok
                  ? (ch.next || "")
                  : (ch.failNext || beat.outcomes?.failure || "");

                if (nextId) await runBeat(campaign.id, nextId);

                finish({
                  acted: true,
                  routed: !!nextId,
                  choiceIndex: i,
                  choice: ch,
                  check: { stat: res.stat, dc: res.dc, total: res.total, ok: res.ok, kind: res.kind, bonus: (res.bonus != null ? res.bonus : null) }
                });
                return;
              }

// No check: route to next
              const nextId = ch.next || "";
              if (nextId) await runBeat(campaign.id, nextId);

              finish({
                acted: true,
                routed: !!nextId,
                choiceIndex: i,
                choice: ch,
                check: null
              });
            } catch (e) {
              warn("Choice handling failed:", e);
              ui.notifications?.error?.("Error running choice; see console.");
              finish({ acted: true, routed: false, error: true, choiceIndex: i, choice: ch, check: null });
            }
          }
        };
      }
    } else {
      // No choices: just an OK button
      buttons.ok = {
        label: "OK",
        callback: () => finish({ acted: true, routed: false, choiceIndex: null, choice: null, check: null })
      };
    }

    const dlg = new Dialog({
      title,
      content: bodyHtml,
      buttons,
      default: Object.keys(buttons)[0] || "ok",
      close: () => finish({ acted: false, closed: true })
    });

    dlg.render(true);
    try { __bbttccAutosizeDialogDeferred(dlg, { pad: 40, maxH: Math.floor(window.innerHeight * 0.94) }); } catch (_eAuto) {}

    // HexChrome styling hook (works for V1 Dialog)
    setTimeout(() => {
      try { dlg.element?.addClass("bbttcc-choice-roll-dialog bbttcc-hexchrome-dialog"); } catch (_eC) {}
    }, 0);


// Beat audio controls (if present in this dialog)
try {
  setTimeout(() => {
    try {
      const $el = dlg.element;
      if (!$el) return;
      const playBtn = $el.find?.(".bbttcc-beat-audio-play")?.[0] || null;
      const stopBtn = $el.find?.(".bbttcc-beat-audio-stop")?.[0] || null;

      if (playBtn && !playBtn.__bbttccBound) {
        playBtn.__bbttccBound = true;
        playBtn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          try {
            const a = beat && beat.audio ? beat.audio : null;
            if (game?.user?.isGM && a && a.broadcastPlayers) {
              try { _broadcastBeatAudio("stop", {}); } catch (_eB0) {}
            }
            await _playBeatAudio(beat, { forceForNonGM: false });
            if (game?.user?.isGM && a && a.broadcastPlayers) {
              try {
                _broadcastBeatAudio("play", { src: String(a.src || "").trim(), volume: a.volume, loop: !!a.loop });
              } catch (_eB1) {}
            }
          } catch (_eP) {}
        });
      }
      if (stopBtn && !stopBtn.__bbttccBound) {
        stopBtn.__bbttccBound = true;
        stopBtn.addEventListener("click", (ev) => {
          ev.preventDefault();
          try {
            const a = beat && beat.audio ? beat.audio : null;
            if (game?.user?.isGM && a && a.broadcastPlayers) {
              try { _broadcastBeatAudio("stop", {}); } catch (_eB2) {}
            }
            _stopBeatAudio();
          } catch (_eS) {}
        });
      }
    } catch (_e) {}
  }, 0);
} catch (_e2) {}
  });
}


// Quest Acceptance (Option A): quest is tracked only after GM accepts on the start beat.

async function _resolveActorRef(ref) {
  try {
    if (!ref) return null;
    // If already an Actor document
    if (ref && ref.documentName === "Actor") return ref;
    const s = String(ref);

    // Raw ID
    if (game && game.actors && typeof game.actors.get === "function") {
      const direct = game.actors.get(s);
      if (direct) return direct;
    }

    // "Actor.<id>" form
    if (s.indexOf("Actor.") === 0) {
      const id = s.slice("Actor.".length);
      if (game && game.actors && typeof game.actors.get === "function") {
        const byId = game.actors.get(id);
        if (byId) return byId;
      }
    }

    // UUID via fromUuid
    try {
      if (typeof fromUuid === "function") {
        const doc = await fromUuid(s);
        if (doc && doc.documentName === "Actor") return doc;
      }
    } catch (_e) {}

    return null;
  } catch (_e2) {
    return null;
  }
}

async function _maybePromptQuestAcceptance(campaign, beat, ctx) {
  try {
    const questId = beat && (beat.questId || beat.questID || beat.quest);
    const role = String(beat && beat.questRole || "").trim();
    if (!questId || role !== "start") return;

    // Resolve target faction
    const factionId = (ctx && ctx.factionId) || (campaign && campaign.factionId) || null;
    if (!factionId) {
      if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Quest acceptance: No faction configured for this campaign.");
      return;
    }
        const faction = await _resolveActorRef(factionId);
    if (!faction) {
      if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Quest acceptance: Faction not found.");
      return;
    }

    // Already accepted?
    const MOD = "bbttcc-factions";
    const cur = (faction.getFlag ? (faction.getFlag(MOD, "quests") || {}) : {});
    const active = (cur && cur.active) ? cur.active : {};
    const completed = (cur && cur.completed) ? cur.completed : {};
    if (active[questId] || completed[questId]) return;

    // Resolve quest name (best effort)
    let questName = questId;
    try {
      const reg = (game.settings && game.settings.get) ? (game.settings.get("bbttcc-campaign", "quests") || {}) : {};
      const q = reg[questId];
      if (q && q.name) questName = q.name;
    } catch (e) {}

    const title = "Accept Quest?";
    const content =
      "<p><b>" + questName + "</b></p>" +
      "<p>Add this quest to <b>" + faction.name + "</b>'s Quest Log?</p>";

    let accepted = false;
    try {
      if (Dialog && typeof Dialog.confirm === "function") {
        accepted = await Dialog.confirm({
          title: title,
          content: content,
          yes: function(){ return true; },
          no: function(){ return false; },
          defaultYes: true
        });
      } else {
        accepted = true;
      }
    } catch (e2) {
      // If dialog was closed without choice, treat as "not yet"
      accepted = false;
    }

    if (!accepted) return;

    // Write tracking
    let next;
    try {
      next = foundry.utils && foundry.utils.deepClone ? foundry.utils.deepClone(cur) : JSON.parse(JSON.stringify(cur || {}));
    } catch (e3) {
      next = {};
    }
    next.schemaVersion = next.schemaVersion || 1;
    next.active = next.active || {};
    next.completed = next.completed || {};
    next.archived = next.archived || {};
    next.active[questId] = {
      v: 1,
      questId: questId,
      status: "active",
      acceptedTs: Date.now(),
      lastTouchedTs: Date.now(),
      notes: "",
      progress: { beats: {} },
      history: [{ ts: Date.now(), type: "accept", by: (game.user ? game.user.id : null) }]
    };

    if (faction.setFlag) {
      await faction.setFlag(MOD, "quests", next);
    }

    // Notify (toast + GM whisper)
    try { if (ui && ui.notifications && ui.notifications.info) ui.notifications.info("Quest accepted: " + questName); } catch (e4) {}
    try {
      const gmIds = (game.users || []).filter(function(u){ return u && u.isGM; }).map(function(u){ return u.id; });
      if (ChatMessage && ChatMessage.create) {
        ChatMessage.create({ whisper: gmIds, content: "<p><b>BBTTCC Quest:</b> accepted <i>" + questName + "</i> for <b>" + faction.name + "</b>.</p>" });
      }
    } catch (e5) {}

    // Force-refresh open faction sheets
    try { if (faction.sheet && faction.sheet.render) faction.sheet.render(true); } catch (e6) {}
  } catch (e) {
    console.warn("[bbttcc-campaign] Quest acceptance failed", e);
  }
}

async function _applyQuestEffects(campaign, beat, ctx) {
  try {
    const we = beat && beat.worldEffects ? beat.worldEffects : null;
    const rows = Array.isArray(we && we.questEffects) ? we.questEffects : [];
    if (!rows.length) return { applied: false, count: 0 };

    const factionId = (ctx && ctx.factionId) || (campaign && campaign.factionId) || null;
    if (!factionId) {
      ui.notifications?.warn?.("Quest effects: No faction configured for this campaign.");
      return { applied: false, count: 0 };
    }

    const faction = await _resolveActorRef(factionId);
    if (!faction) {
      ui.notifications?.warn?.("Quest effects: Faction not found.");
      return { applied: false, count: 0 };
    }

    const MOD = "bbttcc-factions";

    const cur = (faction.getFlag ? (faction.getFlag(MOD, "quests") || {}) : {}) || {};
    let next;
    try {
      next = foundry.utils?.deepClone
        ? foundry.utils.deepClone(cur)
        : JSON.parse(JSON.stringify(cur || {}));
    } catch (_eClone) {
      next = {};
    }

    next.schemaVersion = next.schemaVersion || 1;
    next.active = next.active || {};
    next.completed = next.completed || {};
    next.archived = next.archived || {};

    const reg = game.bbttcc?.api?.campaign?.quests || null;

    function nowTs() {
      return Date.now();
    }

    function ensureEntry(bucketName, questId) {
      const bucket = next[bucketName] || {};
      let entry = bucket[questId];
      if (!entry) {
        const q = reg?.getQuest ? reg.getQuest(questId) : null;
        entry = {
          v: 1,
          questId: questId,
          questName: String(q?.name || questId),
          status: bucketName,
          acceptedTs: nowTs(),
          lastTouchedTs: nowTs(),
          state: "",
          notes: "",
          progress: { beats: {} },
          history: []
        };
        bucket[questId] = entry;
        next[bucketName] = bucket;
      }
      entry.progress = entry.progress || { beats: {} };
      entry.history = Array.isArray(entry.history) ? entry.history : [];
      return entry;
    }

    function getBucketNameForQuest(questId) {
      if (next.active[questId]) return "active";
      if (next.completed[questId]) return "completed";
      if (next.archived[questId]) return "archived";
      return null;
    }

    function removeFromAllBuckets(questId) {
      delete next.active[questId];
      delete next.completed[questId];
      delete next.archived[questId];
    }

    function moveQuest(questId, destBucket) {
      const srcBucket = getBucketNameForQuest(questId);
      const srcEntry =
        (srcBucket === "active" ? next.active[questId] :
        srcBucket === "completed" ? next.completed[questId] :
        srcBucket === "archived" ? next.archived[questId] : null);

      const entry = srcEntry || ensureEntry(destBucket, questId);
      removeFromAllBuckets(questId);
      entry.status = destBucket;
      entry.lastTouchedTs = nowTs();
      next[destBucket][questId] = entry;
      return entry;
    }

    let applied = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      const action = String(row.action || "accept").trim().toLowerCase();
      const questId = String(row.questId || "").trim();
      const beatId = String(row.beatId || beat?.id || "").trim();
      const state = String(row.state || "").trim();
      const text = String(row.text || "").trim();

      if (!questId) continue;

      let entry = null;

      if (action === "accept") {
        if (!getBucketNameForQuest(questId)) {
          entry = ensureEntry("active", questId);
          entry.status = "active";
          entry.acceptedTs = entry.acceptedTs || nowTs();
        } else {
          entry = moveQuest(questId, "active");
        }
      }
      else if (action === "complete" || action === "completed") {
        entry = moveQuest(questId, "completed");
      }
      else if (action === "archive" || action === "archived") {
        entry = moveQuest(questId, "archived");
      }
      else if (action === "activate" || action === "reopen") {
        entry = moveQuest(questId, "active");
      }
      else {
        const bucketName = getBucketNameForQuest(questId) || "active";
        entry = ensureEntry(bucketName, questId);
      }

      if (!entry) continue;

      if (state) entry.state = state;
      if (text) entry.notes = text;
      if (beatId) {
        entry.progress = entry.progress || { beats: {} };
        entry.progress.beats[beatId] = {
          ts: nowTs(),
          state: state || "",
          text: text || ""
        };
      }

      entry.lastTouchedTs = nowTs();
      entry.history = Array.isArray(entry.history) ? entry.history : [];
      entry.history.push({
        ts: nowTs(),
        type: action,
        beatId: beat?.id || null,
        effectBeatId: beatId || null,
        state: state || "",
        text: text || "",
        by: game.user ? game.user.id : null
      });

      applied++;
    }

    if (!applied) return { applied: false, count: 0 };

    if (faction.setFlag) {
      await faction.setFlag(MOD, "quests", next);
    }

    try {
      if (faction.sheet && faction.sheet.render) faction.sheet.render(true);
    } catch (_eSheet) {}

    try {
      ui.notifications?.info?.("Quest effects applied.");
    } catch (_eToast) {}

    return { applied: true, count: applied };
  } catch (e) {
    console.warn("[bbttcc-campaign] Quest effects failed", e);
    return { applied: false, count: 0, error: e };
  }
}

const AAE_MOD_ID = "bbttcc-aae";

function _polTagList(raw) {
  if (Array.isArray(raw)) return raw.map(s => String(s || "").trim()).filter(Boolean);
  return String(raw || "").split(/\s+/g).map(s => s.trim()).filter(Boolean);
}
function _uniqTags(arr) {
  const out = [];
  const seen = new Set();
  for (const t of (arr || [])) {
    const k = String(t || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
function _choicePoliticalTags(choice) {
  if (!choice) return [];
  const raw =
    choice?.political?.tags ??
    choice?.politicalTags ??
    choice?.politics?.tags ??
    choice?.tags ??
    "";
  return _polTagList(raw);
}
function _prettySeverity(sev) {
  switch (String(sev || "")) {
    case "affirmation_minor":   return "Minor affirmation";
    case "neutral":             return "Neutral";
    case "dissonance_minor":    return "Minor dissonance";
    case "dissonance_major":    return "Major dissonance";
    case "dissonance_critical": return "Critical dissonance";
    default:                    return String(sev || "Unknown");
  }
}
function _consequenceRowForSeverity(sev) {
  switch (String(sev || "")) {
    case "affirmation_minor":   return { unityDelta: +1, darknessDelta: 0, loyaltyDelta: 0, moraleDelta: 0 };
    case "dissonance_minor":    return { unityDelta: -1, darknessDelta: +1, loyaltyDelta: 0, moraleDelta: 0 };
    case "dissonance_major":    return { unityDelta: -2, darknessDelta: +2, loyaltyDelta: 0, moraleDelta: 0 };
    case "dissonance_critical": return { unityDelta: -4, darknessDelta: +4, loyaltyDelta: -1, moraleDelta: 0 };
    default:                    return null; // neutral or unknown => no auto consequence
  }
}
async function _resolveFactionActorByIdOrUuid(idOrUuid) {
  const v = String(idOrUuid || "").trim();
  if (!v) return null;
  if (v.includes(".")) {
    try { return await fromUuid(v); } catch { return null; }
  }
  return game.actors?.get?.(v) || null;
}
async function _appendAAEDecisionHistory(factionId, record, cap = 50) {
  try {
    const actor = await _resolveFactionActorByIdOrUuid(factionId);
    if (!actor?.getFlag || !actor?.setFlag) return false;

    const cur = actor.getFlag(AAE_MOD_ID, "decisionHistory");
    const arr = Array.isArray(cur) ? cur.slice(0) : [];
    arr.push(record);
    while (arr.length > cap) arr.shift();

    await actor.setFlag(AAE_MOD_ID, "decisionHistory", arr);
    return true;
  } catch (e) {
    warn("AAE decisionHistory write failed:", e);
    return false;
  }
}


// ---------------------------------------------------------------------------
// Runtime execution
// ---------------------------------------------------------------------------

async function executeBeat(campaign, beat, ctx = {}) {
  if (!beat) return;

  await logBeatToGottgait(campaign, beat);

  const type  = beat.type || "unknown";
  const label = beat.label || beat.id || "(unnamed)";

  const resolution = game.bbttcc?.api?.resolution;
  const territory  = game.bbttcc?.api?.territory;
  const encounters = game.bbttcc?.api?.encounters;

  log("Executing beat", { campaignId: campaign.id, beatId: beat.id, type });

  const isCinematic =
    (String(type || "").trim() === "cinematic") ||
    !!(beat && beat.cinematic && beat.cinematic.enabled);

  // Journal auto-open (optional)
  _maybeShowBeatJournal(beat);

  // Beat audio (optional)
  await _maybePlayBeatAudio(beat);

  // Cinematic beats run through Encounter Engine step runner (auto-advance supported).
  // IMPORTANT: do NOT also activate beat.sceneId here, or you'll "eat" the chain.
  if (isCinematic) {

    // Prefer a local cinematic chain when author provided explicit start/next scenes.
    // This restores the intended UX: scene + description/dialog launch together (no blocking),
    // and narration auto-play / controls work for cinematic beats.
    const cin = beat && beat.cinematic ? beat.cinematic : null;
    const hasLocalChain = !!(cin && cin.enabled && (cin.startSceneId || cin.nextSceneId));

    if (hasLocalChain) {
      try {
        const hasDialogContentLocal =
          (String(beat.description || "").trim().length > 0) ||
          (Array.isArray(beat.choices) && beat.choices.length > 0);

        // Kick the dialog without blocking the cinematic scene activation.
        let dlgPromise = null;
        if (hasDialogContentLocal) {
          try { dlgPromise = _runBeatDialog(campaign, beat, ctx); } catch (_eDlg) {}
        }

        // Narration (auto-play)  -  do this immediately so it starts alongside the scene.
        try { await _maybePlayBeatAudio(beat); } catch (_eAud) {}

        // Activate Start Scene
        const raw1 = String(cin.startSceneId || "").trim();
        let sc1 = null;
        if (raw1) {
          try { sc1 = raw1.includes(".") ? await fromUuid(raw1) : (game.scenes?.get?.(raw1) || null); } catch (_eS1) {}
          if (!sc1 && raw1 && !raw1.includes(".")) {
            try { sc1 = await fromUuid(`Scene.${raw1}`); } catch (_eS1b) {}
          }
        }
        if (sc1?.activate) await sc1.activate();

        // Schedule Next Scene (if configured)
        const raw2 = String(cin.nextSceneId || "").trim();
        const dur0 = Number(cin.durationMs != null ? cin.durationMs : (cin.duration != null ? cin.duration : cin.ms));
        const dur = Number.isFinite(dur0) ? Math.max(0, dur0) : 0;

        if (raw2 && dur > 0) {
          setTimeout(async () => {
            try {
              let sc2 = null;
              try { sc2 = raw2.includes(".") ? await fromUuid(raw2) : (game.scenes?.get?.(raw2) || null); } catch (_eS2) {}
              if (!sc2 && raw2 && !raw2.includes(".")) {
                try { sc2 = await fromUuid(`Scene.${raw2}`); } catch (_eS2b) {}
              }
              if (sc2?.activate) await sc2.activate();
            } catch (_eN) {
              warn("Local cinematic next-scene activation failed:", _eN);
            }
          }, dur);
        }

        // If choices exist, wait for dialog result so routing can occur,
        // but DO NOT block the cinematic start scene.
        if (dlgPromise && Array.isArray(beat.choices) && beat.choices.length) {
          try { await dlgPromise; } catch (_eWait) {}
        }
      } catch (e) {
        err("Local cinematic chain failed:", e);
        ui.notifications?.error?.("Cinematic launch failed; see console.");
      }
    } else {
    if (!encounters) {
      ui.notifications?.warn?.(`Campaign: Encounter API not available for cinematic beat '${label}'.`);
    } else {
      const launchKey = _scenarioKeyForBeat(beat);
      const launchCtx = {
        ...ctx,
        source: "bbttcc-campaign",
        campaignId: campaign.id,
        campaignTitle: campaign.label,
        beatId: beat.id,
        beatLabel: label,
        beatType: type,
        launchKey
      };

      try {
        // Ensure the scenario exists (newer Encounter Engine supports this helper).
        if (typeof encounters.registerCampaignBeatScenario === "function") {
          try {
            encounters.registerCampaignBeatScenario(campaign.id, beat, { source: `campaign:${campaign.id}`, force: true });
          } catch (e) {
            warn("Cinematic: registerCampaignBeatScenario failed (continuing to launch)", e);
          }
        }

        // Launch using whichever method the encounters API exposes.
        if (typeof encounters.runScenario === "function") {
          await encounters.runScenario(launchKey, launchCtx);
        } else if (typeof encounters.run === "function") {
          await encounters.run(launchKey, launchCtx);
        } else if (typeof encounters.launchScenario === "function") {
          try {
            await encounters.launchScenario(launchKey, launchCtx);
          } catch (e1) {
            try {
              await encounters.launchScenario({ key: launchKey, scenarioKey: launchKey, ctx: launchCtx, ...launchCtx });
            } catch (e2) {
              throw e2;
            }
          }
        } else if (typeof encounters.startScenario === "function") {
          await encounters.startScenario(launchKey, launchCtx);
        } else if (typeof encounters.fireScenario === "function") {
          await encounters.fireScenario(launchKey, launchCtx);
        } else if (typeof encounters.testFire === "function") {
          await encounters.testFire(launchKey, launchCtx);
        } else {
          ui.notifications?.warn?.(`Campaign: Encounter API found, but no known launcher method for cinematic beat '${label}'.`);
          warn("Encounter API has no known launcher method (cinematic)", { keys: Object.keys(encounters || {}), launchKey });
        }
      } catch (e) {
        err("Cinematic scenario launch failed:", e);
        ui.notifications?.error?.("Cinematic launch failed; see console.");
      }
    }
    }
  } else {
    // Scene activation for non-cinematic beats
    const rawSceneRef = String(beat.sceneId || "").trim();
    if (rawSceneRef) {
      try {
        let scene = null;
        if (rawSceneRef.includes(".")) scene = await fromUuid(rawSceneRef);
        else scene = game.scenes?.get?.(rawSceneRef) || null;

        if (!scene && !rawSceneRef.includes(".")) {
          const maybe = `Scene.${rawSceneRef}`;
          try { scene = await fromUuid(maybe); } catch (e2) {}
        }

        if (scene?.activate) await scene.activate();
      } catch (e) {
        err("Scene activation failed:", e);
        ui.notifications?.error?.("Error activating scene for campaign beat; see console.");
      }
    }
  }

  // [OK] RESTORED: prompt/choices can appear for ANY non-encounter beat.
  const hasDialogContent =
    (String(beat.description || "").trim().length > 0) ||
    (Array.isArray(beat.choices) && beat.choices.length > 0);


  // Quest/Encounter helpers
  const hasEncounterKey = !!(
    (beat && beat.encounter && beat.encounter.key && String(beat.encounter.key).trim()) ||
    (beat && beat.encounterKey && String(beat.encounterKey).trim()) ||
    (beat && beat.mechanics && beat.mechanics.encounterKey && String(beat.mechanics.encounterKey).trim())
  );

  // CHANGE: allow dialogs for outcome_trigger and other non-encounter beats.
  let dialogRes = null;

  // CHANGE: allow dialogs for outcome_trigger and other non-encounter beats.
  if (hasDialogContent && (type !== "encounter" || !hasEncounterKey) && !isCinematic) {
    dialogRes = await _runBeatDialog(campaign, beat, ctx);
    // After dialog resolves, we still apply world effects below (keeps pipeline).
  }

  // Quest acceptance prompt (only on questRole=start beats)
  await _maybePromptQuestAcceptance(campaign, beat, ctx);

  switch (type) {

    case "cinematic": {
      // Already handled above via Encounter Engine scenario runner.
      break;
    }

    case "scene_transition": {

      // Scene transitions can author actor spawns (Beat Editor: actors[]).
      // Only the GM should spawn tokens (permissions + authoritative scene mutation).
      if (!game.user?.isGM) break;

      try {
        const actors = Array.isArray(beat.actors) ? beat.actors.filter(Boolean) : [];
        log("scene_transition: spawn check", { beatId: beat.id, sceneId: beat.sceneId, actors });

        if (actors.length) {
          const sp = game.bbttcc?.api?.encounters?._spawner;
          if (!sp || typeof sp.spawnAtCenter !== "function") {
            warn("scene_transition: spawner not available (encounters._spawner.spawnAtCenter missing).");
            break;
          }

          const rawSceneRef = String(beat.sceneId || "").trim();
          let scene = null;

          if (rawSceneRef.includes(".")) {
            scene = await fromUuid(rawSceneRef);
          } else {
            scene = game.scenes?.get?.(rawSceneRef) || null;
            if (!scene && rawSceneRef) {
              try { scene = await fromUuid(`Scene.${rawSceneRef}`); } catch (_e) {}
            }
          }

          if (!scene) {
            warn("scene_transition: could not resolve scene for spawn", { rawSceneRef });
            break;
          }

          const spawnedBy = `campaign:${campaign.id}:${beat.id}`;

          await sp.spawnAtCenter(scene, actors, {
            spawnedBy,
            hidden: false,
            role: "npc"
          });

          // Post-check: how many tokens carry our spawnedBy flag?
          try {
            const toks = (scene.tokens?.contents || []).filter(t => t?.flags?.["bbttcc-encounters"]?.spawnedBy === spawnedBy);
            log("scene_transition: spawn complete", { spawnedBy, count: toks.length });
          } catch (_e2) {}
        }
      } catch (e) {
        warn("scene_transition spawn failed:", e);
      }

      break;
    }

    case "outcome_trigger": {
      const key = beat.outcomes?.success || beat.outcomes?.failure;
      if (!key) break;

      const ctx2 = { source: "bbttcc-campaign", campaignId: campaign.id, beatId: beat.id, beatType: type };

      let applied = false;
      if (resolution?.runResolution) {
        try { await resolution.runResolution(key, ctx2); applied = true; } catch (e) { warn("Resolution failed", key, e); }
      }
      if (!applied && territory?.applyOutcome) {
        try { await territory.applyOutcome({ outcomeKey: key, ctx: ctx2 }); applied = true; } catch (e) { warn("Territory.applyOutcome failed", key, e); }
      }
      if (!applied) ui.notifications?.warn?.(`No Resolution/Territory engine available for outcome '${key}'.`);
      break;
    }

    case "encounter": {
      const inferredFromId = (String(beat.id || "").startsWith("enc_")) ? String(beat.id).slice(4) : null;
      const encounterKey = beat.encounter?.key || beat.encounterKey || beat.mechanics?.encounterKey || inferredFromId || null;
      const scenarioKey  = beat.mechanics?.scenarioKey || beat.scenarioKey || null;

      if (!encounters) {
        ui.notifications?.warn?.(`Campaign: Encounter API not available for '${label}'.`);
        break;
      }

      let launchKey = scenarioKey || null;
      try {
        if (!launchKey && encounterKey && typeof encounters.getScenarioKeyForEncounter === "function") {
          launchKey = encounters.getScenarioKeyForEncounter(encounterKey);
        }
        if (!launchKey) launchKey = encounterKey || scenarioKey;
      } catch {
        launchKey = encounterKey || scenarioKey;
      }

      if (!launchKey) {
        ui.notifications?.warn?.(`Campaign: encounter beat '${label}' has no encounter key yet (campaign-local encounter).`);
        break;
      }

      const launchCtx = {
        ...ctx,
        source: "bbttcc-campaign",
        campaignId: campaign.id,
        campaignTitle: campaign.label,
        beatId: beat.id,
        beatLabel: label,
        beatType: type,
        encounterKey,
        scenarioKey,
        launchKey
      };

      try {
        if (typeof encounters.runScenario === "function") {
          await encounters.runScenario(launchKey, launchCtx);
        } else if (typeof encounters.run === "function") {
          await encounters.run(launchKey, launchCtx);
        } else if (typeof encounters.launchScenario === "function") {
          try {
            await encounters.launchScenario(launchKey, launchCtx);
          } catch (e1) {
            try {
              await encounters.launchScenario({ key: launchKey, scenarioKey: launchKey, ctx: launchCtx, ...launchCtx });
            } catch (e2) {
              throw e2;
            }
          }
        } else if (typeof encounters.startScenario === "function") {
          await encounters.startScenario(launchKey, launchCtx);
        } else if (typeof encounters.fireScenario === "function") {
          await encounters.fireScenario(launchKey, launchCtx);
        } else {
          ui.notifications?.warn?.(`Campaign: Encounter API found, but no known launcher method for '${label}'.`);
          warn("Encounter API has no known launcher method", { keys: Object.keys(encounters || {}), launchKey });
        }
      } catch (e) {
        err("Encounter launch failed:", e);
        ui.notifications?.error?.("Encounter launch failed; see console.");
      }

      break;
    }

    default: {
      ui.notifications?.info?.(`(Stub) Campaign '${campaign.label}': ran beat '${label}' of type '${type}'.`);
      break;
    }
  }

  // World mutation (unchanged)
  try {
    const wm = game.bbttcc?.api?.worldMutation;
    if (wm?.applyWorldEffects) {
      await wm.applyWorldEffects(beat, {
        source: "bbttcc-campaign",
        campaignId: campaign.id,
        campaignTitle: campaign.label,
        beatId: beat.id
      });
    }

    // Quest effects (Beat Editor -> World Effects -> Quest Effects)
    try {
      await _applyQuestEffects(campaign, beat, ctx);
    } catch (eQuestFx) {
      warn("Quest effects failed:", eQuestFx);
    }

    // -------------------------------------------------------------------
    // Casualty Engine (Beat tags)  -  applies hex/faction casualty effects + war logs
    // Runs after worldEffects apply so it can append receipts and use ctx/hex resolution.
    // -------------------------------------------------------------------
    try {
      const cas = game.bbttcc?.api?.casualties;
      if (cas && typeof cas.applyFromBeat === "function") {
        await cas.applyFromBeat(beat, ctx, {
          source: "bbttcc-campaign",
          campaignId: campaign.id,
          campaignTitle: campaign.label,
          beatId: beat.id,
          beatLabel: label,
          beatType: type
        });
      }
    } catch (eCas) {
      warn("Casualty engine failed:", eCas);
    }

    // -------------------------------------------------------------------
    // AAE Political Pressure (optional)
    // Fires AFTER worldEffects apply, so it reflects the final beat outcome.
    // NOW: choice-aware + decision memory + consequences.
    // -------------------------------------------------------------------
    try {
      const aae = game.bbttcc?.api?.aae;
      if (aae?.applyPoliticalImpact) {

        const rawBeatTags =
          beat?.politicalTags ??
          beat?.politics?.tags ??
          beat?.worldEffects?.politicalTags ??
          beat?.worldEffects?.politics?.tags ??
          beat?.inject?.politicalTags ??
          "";

        const beatTags = _polTagList(rawBeatTags);
        const choiceTags = _choicePoliticalTags(dialogRes?.choice);

        // Choice tags refine the beat tag intent; we merge (unique) so beat-level can provide "context"
        const tags = _uniqTags([ ...choiceTags, ...beatTags ]);

        const factionId =
          String(ctx?.factionId || "").trim() ||
          String(beat?.factionId || "").trim() ||
          String(campaign?.factionId || "").trim() ||
          null;

        if (factionId && tags.length) {

          const res = await aae.applyPoliticalImpact({
            factionId,
            actorIds: ctx?.actorIds || ctx?.actors || [],
            tags,
            source: {
              kind: "campaignBeat",
              campaignId: campaign.id,
              beatId: beat.id,
              beatType: type,
              choiceIndex: (dialogRes && dialogRes.choiceIndex != null) ? dialogRes.choiceIndex : null,
              choiceLabel: dialogRes?.choice?.label || null
            }
          });

          // ---- Decision Memory (append-only, capped)
          try {
            const driftDelta = Number(res?.driftDelta ?? 0) || 0;
            const record = {
              v: 1,
              ts: Date.now(),
              turn: (typeof _getTurnNumberSafe === "function") ? _getTurnNumberSafe() : 0,

              factionId,
              campaignId: campaign.id,
              beatId: beat.id,
              beatType: type,
              beatLabel: label,

              choiceIndex: (dialogRes && dialogRes.choiceIndex != null) ? dialogRes.choiceIndex : null,
              choiceLabel: dialogRes?.choice?.label || null,
              check: dialogRes?.check || null,

              tags,

              aae: {
                severity: res?.severity || null,
                severityState: res?.severityState || null,
                driftDelta,
                driftScoreBefore: res?.driftScoreBefore ?? null,
                driftScoreAfter:  res?.driftScoreAfter ?? null,
                centerKey: res?.centerKey || null,
                minorityPressure: res?.minorityPressure ?? null
              }
            };

            await _appendAAEDecisionHistory(factionId, record, 50);
          } catch (e) {
            warn("AAE decision record failed:", e);
          }

          // ---- Consequences (alpha-safe, uses World Mutation Engine)
          try {
            const severity = String(res?.severity || "neutral");
            const row = _consequenceRowForSeverity(severity);

            if (row) {
              const wm2 = game.bbttcc?.api?.worldMutation;

              // only write warlog if there's an actual consequence row
              const driftDelta = Number(res?.driftDelta ?? 0) || 0;
              const driftStr = `${driftDelta >= 0 ? "+" : ""}${driftDelta}`;
              const sevLabel = _prettySeverity(severity);
              const choiceLabel = dialogRes?.choice?.label ? `  -  Choice: ${dialogRes.choice.label}` : "";
              const tagStr = tags.length ? `  -  tags: ${tags.join(", ")}` : "";

              const warLog = `AAE: Political pressure  -  ${sevLabel} (drift ${driftStr})${choiceLabel}${tagStr}`;

              if (wm2?.applyWorldEffects) {
                await wm2.applyWorldEffects(
                  {
                    factionEffects: [
                      { factionId, ...row }
                    ],
                    warLog
                  },
                  {
                    source: "bbttcc-campaign",
                    campaignId: campaign.id,
                    beatId: beat.id,
                    factionId,
                    logType: "aaepolitics"
                  }
                );
              }
            }
          } catch (e) {
            warn("AAE consequence apply failed:", e);
          }
        }
      }
    } catch (e) {
      warn("AAE political impact failed:", e);
    }

  } catch (e) {
    warn("World mutation failed:", e);
  }

  // Time Points (optional): accumulate beat-time into world clock
  await _applyBeatTimePoints(campaign, beat, ctx);
}

async function runCampaign(id, ctx = {}) {
  const c = getCampaign(id);
  if (!c) return ui.notifications?.warn?.(`Campaign '${id}' not found.`);
  const first = (c.beats || [])[0];
  if (!first) return ui.notifications?.warn?.(`Campaign '${c.label}' has no beats.`);
  await executeBeat(c, first, ctx);
}

async function runBeat(id, beatId, ctx = {}) {
  const c = getCampaign(id);
  if (!c) return ui.notifications?.warn?.(`Campaign '${id}' not found.`);
  const b = (c.beats || []).find(x => x.id === beatId);
  if (!b) return ui.notifications?.warn?.(`Beat '${beatId}' not found in '${id}'.`);
  await executeBeat(c, b, ctx);
}

// ---------------------------------------------------------------------------
// Injector helpers
// ---------------------------------------------------------------------------


function _getWorldTurnLengthSafe() {
  try {
    const w = game.bbttcc?.api?.world;
    const s = w?.getState ? w.getState() : null;
    const tl = Number(s?.time?.turnLength ?? 0);
    return Number.isFinite(tl) && tl > 0 ? tl : 12;
  } catch (e) {}
  return 12;
}

function _timePointsForBeat(beat, ctx = {}) {
  // Explicit override wins
  const raw = Number(beat?.timePoints ?? beat?.time?.points ?? ctx?.timePoints ?? 0);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);

  // Map timeScale to default points
  const scale = String(beat?.timeScale ?? beat?.time?.scale ?? "").trim().toLowerCase();
  const tl = _getWorldTurnLengthSafe();

  if (scale === "moment") return 0;
  if (scale === "scene")  return 1;
  if (scale === "leg")    return 1;
  if (scale === "turn")   return tl;
  if (scale === "arc")    return tl * 3;
  if (scale === "campaign") return 0;

  // Default: no time unless explicitly authored
  return 0;
}

async function _applyBeatTimePoints(campaign, beat, ctx = {}) {
  try {
    const w = game.bbttcc?.api?.world;
    if (!w?.addTime) return false;

    const tp = _timePointsForBeat(beat, ctx);
    if (!tp) return false;

    const label = beat?.label || beat?.id || "(beat)";
    const note = `Beat time +${tp}: ${campaign?.label || campaign?.id || "campaign"}  -  ${label}`;

    await w.addTime(tp, { source: "beat", note, autoAdvance: true, campaignId: campaign?.id || null });
    return true;
  } catch (e) {
    warn("applyBeatTimePoints failed:", e);
    return false;
  }
}


function _getTurnNumberSafe() {
  try {
    const t = game.bbttcc?.api?.turn;
    if (t?.getTurnNumber) return Number(t.getTurnNumber()) || 0;
    if (t?.turnNumber != null) return Number(t.turnNumber) || 0;
  } catch (e) {}
  return 0;
}

function _readInjectState() {
  try {
    const s = game.settings.get(MOD_ID, SETTING_INJECT_STATE);
    return (s && typeof s === "object") ? foundry.utils.deepClone(s) : {};
  } catch {
    return {};
  }
}

async function _writeInjectState(state) {
  await game.settings.set(MOD_ID, SETTING_INJECT_STATE, state || {});
  return state || {};
}

function _splitTags(tagStr) {
  return String(tagStr || "").split(/[\s,]+/g).map(s => _canonicalizeCampaignTag(s.trim())).filter(Boolean);
}

function _matchesTravelThreshold(beat) {
  const tags = _splitTags(beat?.tags);
  return tags.includes("inject.travel_threshold");
}

function _matchesInjectorTags(beat, ctxTags) {
  const tags = _splitTags(beat?.tags);
  if (!tags.length) return false;
  const wanted = Array.isArray(ctxTags) ? ctxTags.filter(Boolean) : [];
  const injectWanted = wanted.filter(function (t) { return String(t || "").indexOf("inject.") === 0; });
  if (!injectWanted.length) return _matchesTravelThreshold(beat);
  for (const t of injectWanted) {
    if (tags.includes(String(t))) return true;
  }
  return false;
}

function _scoreBeat(beat, ctxTags = []) {
  const tags = _splitTags(beat?.tags);
  if (!tags.length) return 0;
  if (!_matchesInjectorTags(beat, ctxTags)) return 0;

  let score = 100;
  const set = new Set(tags);
  for (const t of ctxTags) {
    if (!t) continue;
    if (set.has(t)) score += (String(t).indexOf("inject.") === 0 ? 12 : 10);
  }
  if (set.has("inject.travel_threshold")) score += 1;
  return score;
}

function _injectKeyFor(beat, ctx) {
  const campaignId = ctx?.campaignId || "any";
  const hexUuid = ctx?.hexUuid || ctx?.hexId || "nohex";
  return `${campaignId}:${beat.id}:${hexUuid}`;
}

function _cooldownKeyFor(beat, ctx) {
  const campaignId = ctx?.campaignId || "any";
  return `${campaignId}:${beat.id}:cooldown`;
}

function _globalHexGateKey(campaignId, hexUuid) {
  return `${campaignId || "any"}:HEX:${hexUuid || "nohex"}:GLOBAL`;
}

function _declineHexGateKey(campaignId, hexUuid) {
  return `${campaignId || "any"}:HEX:${hexUuid || "nohex"}:DECLINED`;
}

function _isDebtishBeat(beat) {
  const tags = _splitTags(beat?.tags);
  const set = new Set(tags);
  return set.has("inject.debt_pressure") || set.has("theme.auditor") || set.has("thread.E") || set.has("auditor");
}

function _countDebtMarkersInWarLogs(actor, windowSize = 50) {
  try {
    const wl = actor?.flags?.["bbttcc-factions"]?.warLogs || [];
    const slice = wl.slice(-Math.max(1, Number(windowSize) || 50));
    let count = 0;
    for (const entry of slice) {
      const s = String(entry?.summary || "");
      if (s.includes(DEBT_PREFIX)) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

function _resolveDebtAnchorActor(ctx = {}) {
  const uuid = ctx.factionUuid || ctx.actorUuid || ctx.factionActorUuid || DEFAULT_FACTION_UUID;
  try { return fromUuidSync(uuid); } catch { return null; }
}

async function _gmPromptDebtBeat({ campaignId, beatId, beatLabel, hexUuid }) {
  return new Promise((resolve) => {
    const content = `
      <p><strong>${beatLabel || beatId}</strong></p>
      <p>This beat is debt-driven (the vault is calling in favors / consequences).</p>
      <p><em>Run it now?</em></p>
      <hr/>
      <p style="opacity:0.8">Campaign: <code>${campaignId}</code><br/>Hex: <code>${hexUuid || "(none)"}</code></p>
    `;

    new Dialog({
      title: "BBTTCC: Debt Pressure Beat",
      content,
      buttons: {
        run:     { icon: '<i class="fas fa-play"></i>', label: "Run",     callback: () => resolve(true) },
        decline: { icon: '<i class="fas fa-ban"></i>',  label: "Decline", callback: () => resolve(false) }
      },
      default: "run",
      close: () => resolve(false)
    }).render(true);
  });
}

// ---------------------------------------------------------------------------
// Injector
// ---------------------------------------------------------------------------

async function injectorFire(ctx = {}) {
  const {
    campaignId = null,
    tags = "",
    hexUuid = null,
    allowMulti = false,
    maxFire = 2,
    oncePerHexGlobal = false,

    // Auto-debt
    autoDebt = true,
    autoDebtWindow = 50,
    autoDebtThreshold = 2,

    // GM prompt
    promptDebt = true,

    // NEW: fallback behavior
    fallbackOnDecline = false
  } = ctx;

  const ctxTags = _splitTags(tags);
  const all = listCampaigns();
  const campaigns = campaignId ? all.filter(c => c.id === campaignId) : all;

  const turn = _getTurnNumberSafe();
  const state = _readInjectState();

  if (oncePerHexGlobal && hexUuid) {
    const gk = _globalHexGateKey(campaignId, hexUuid);
    if (state[gk]) {
      log("Injector: global once-per-hex gate tripped", { campaignId, hexUuid });
      return { fired: [], reason: "global_once_per_hex" };
    }
  }

  // AutoDebt (threshold gating for "debt")
  if (autoDebt) {
    const actor = _resolveDebtAnchorActor(ctx);
    const debtCount = _countDebtMarkersInWarLogs(actor, autoDebtWindow);

    if (debtCount > 0) {
      const dtag = `debt:${debtCount}`;
      if (!ctxTags.includes(dtag)) ctxTags.push(dtag);

      const threshold = Math.max(1, Number(autoDebtThreshold) || 2);
      const enabled = debtCount >= threshold;

      if (enabled && !ctxTags.includes("debt")) ctxTags.push("debt");

      log("Injector: autoDebt detected", {
        actor: actor?.name,
        debtCount,
        threshold,
        enabledDebtTag: enabled,
        addedTags: enabled ? ["debt", dtag] : [dtag]
      });
    }
  }

  // Build candidates
  const candidates = [];
  for (const c of campaigns) {
    const beats = Array.isArray(c.beats) ? c.beats : [];
    for (const b of beats) {
      const inject = b.inject || {};
      if (!_matchesTravelThreshold(b)) continue;

      if (inject.oncePerHex && hexUuid) {
        const k = _injectKeyFor(b, { campaignId: c.id, hexUuid });
        if (state[k]) continue;
      }

      const cd = Number(inject.cooldownTurns || 0) || 0;
      if (cd > 0) {
        const ck = _cooldownKeyFor(b, { campaignId: c.id });
        const lastTurn = Number(state[ck] || 0) || 0;
        if (turn > 0 && (turn - lastTurn) < cd) continue;
      }

      const score = _scoreBeat(b, ctxTags);
      if (score <= 0) continue;

      candidates.push({ campaignId: c.id, beatId: b.id, score, beat: b });
    }
  }

  if (!candidates.length) {
    log("Injector: no eligible beats", { campaignId, hexUuid, tags, ctxTags });
    return { fired: [], reason: "no_candidates" };
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return `${a.campaignId}:${a.beatId}`.localeCompare(`${b.campaignId}:${b.beatId}`);
  });

  const want = allowMulti ? Math.max(1, Number(maxFire || 2)) : 1;

  const finalPicks = [];
  const declinedBeatIds = new Set();

  for (const cand of candidates) {
    if (finalPicks.length >= want) break;
    if (declinedBeatIds.has(cand.beatId)) continue;

    if (promptDebt && hexUuid && _isDebtishBeat(cand.beat)) {
      const dk = _declineHexGateKey(campaignId, hexUuid);
      const alreadyDeclinedHere = !!state[dk];

      if (alreadyDeclinedHere) {
        if (fallbackOnDecline) continue;
        return { fired: [], reason: "gm_declined_or_skipped" };
      }

      const ok = await _gmPromptDebtBeat({
        campaignId: cand.campaignId,
        beatId: cand.beatId,
        beatLabel: cand.beat?.label,
        hexUuid
      });

      if (!ok) {
        state[dk] = { turn, ts: Date.now(), beatId: cand.beatId };
        declinedBeatIds.add(cand.beatId);
        log("Injector: GM declined debt beat", { campaignId: cand.campaignId, beatId: cand.beatId, hexUuid });

        if (fallbackOnDecline) continue;
        return { fired: [], reason: "gm_declined_or_skipped" };
      }
    }

    finalPicks.push(cand);
  }

  if (!finalPicks.length) {
    await _writeInjectState(state);
    return { fired: [], reason: "gm_declined_or_skipped" };
  }

  for (const pick of finalPicks) {
    const inject = pick.beat.inject || {};
    if (inject.oncePerHex && hexUuid) {
      const k = _injectKeyFor(pick.beat, { campaignId: pick.campaignId, hexUuid });
      state[k] = { turn, ts: Date.now() };
    }
    const cd = Number(inject.cooldownTurns || 0) || 0;
    if (cd > 0) {
      const ck = _cooldownKeyFor(pick.beat, { campaignId: pick.campaignId });
      state[ck] = turn || 0;
    }
  }

  if (oncePerHexGlobal && hexUuid) {
    const gk = _globalHexGateKey(campaignId, hexUuid);
    state[gk] = { turn, ts: Date.now() };
  }

  await _writeInjectState(state);

  log("Injector: firing beats", {
    allowMulti,
    picks: finalPicks.map(s => ({ campaignId: s.campaignId, beatId: s.beatId, score: s.score })),
    oncePerHexGlobal: !!oncePerHexGlobal,
    fallbackOnDecline: !!fallbackOnDecline
  });

  for (const pick of finalPicks) {
    await runBeat(pick.campaignId, pick.beatId);
  }

  return { fired: finalPicks.map(s => ({ campaignId: s.campaignId, beatId: s.beatId, score: s.score })) };
}

// Hook listeners
function installInjectorHooks() {
  const handler = async (ctx = {}) => {
    try {
      const tags = Array.isArray(ctx?.tags) ? ctx.tags.join(" ") : (ctx?.tags || "");
      await injectorFire({ ...ctx, tags });
    } catch (e) {
      warn("Injector hook handler failed:", e);
    }
  };

  Hooks.on("trigger.travel_threshold", handler);
  Hooks.on("bbttcc:travel_threshold", handler);
  Hooks.on("bbttcc.travel_threshold", handler);

  log("Injector hooks installed (trigger.travel_threshold / bbttcc:travel_threshold / bbttcc.travel_threshold).");
}

function getActiveCampaignId() {
  try { return String(game.settings.get(MOD_ID, SETTING_ACTIVE_CAMPAIGN) || "").trim() || null; }
  catch { return null; }
}
async function setActiveCampaignId(id) {
  await game.settings.set(MOD_ID, SETTING_ACTIVE_CAMPAIGN, String(id || ""));
  // Campaign Turn Flow: update the world turn-beats map to reflect the new active campaign.
  try {
    var cid = String(id || "").trim();
    if (cid) _syncWorldTurnBeatsForCampaign(cid);
  } catch (_e) {}
  return getActiveCampaignId();
}

// UI
async function openBuilder(campaignId = null) {
  try {
    const mod = await import("../apps/campaign-builder-app.js");
    const App = mod?.BBTTCCCampaignBuilderApp || mod?.default || null;
    if (!App) {
      ui.notifications?.warn?.("Campaign Builder loaded, but BBTTCCCampaignBuilderApp export missing.");
      return null;
    }
    // Prefer the App's own open() helper if present, otherwise instantiate.
    if (typeof App.open === "function") return App.open({ campaignId });
    const inst = new App({ campaignId });
    inst.render(true);
    return inst;
  } catch (e) {
    warn("openBuilder failed:", e);
    ui.notifications?.error?.("Could not open Campaign Builder. See console.");
    return null;
  }
}


// ---------------------------------------------------------------------------
// Campaign I/O (Interim): Export/Import campaign bundles via JournalEntry compendium
// - Stores campaign + optional tables/quests into a JournalEntry flag payload.
// - Adds stable reference keys (flags.bbttcc.key) to enable cross-world remap.
// - Remap pass attempts to restore Scene/Actor/Journal references after import.
//
// NOTE: This is the interim transport layer. It is designed to be Adventure-compatible:
//       When we later ship a Foundry Adventure/module pack, the same JournalEntry bundle
//       can be included as content and imported in exactly the same way.
// ---------------------------------------------------------------------------

function _bbttccGetFlag(obj, mod, key) {
  try {
    if (!obj) return null;
    if (typeof obj.getFlag === "function") return obj.getFlag(mod, key);
    if (obj.flags && obj.flags[mod] && (key in obj.flags[mod])) return obj.flags[mod][key];
  } catch (_e) {}
  return null;
}

function _bbttccSetFlagPath(doc, mod, key, value) {
  try {
    if (!doc || typeof doc.setFlag !== "function") return false;
    doc.setFlag(mod, key, value);
    return true;
  } catch (_e) { return false; }
}

function _bbttccStableKeyOf(doc) {
  try {
    var k =
      _bbttccGetFlag(doc, "bbttcc", "key") ||
      _bbttccGetFlag(doc, "bbttcc", "stableKey") ||
      _bbttccGetFlag(doc, "bbttcc-campaign", "key") ||
      null;
    k = String(k || "").trim();
    return k || null;
  } catch (_e) { return null; }
}

function _bbttccFindByStableKey(collection, key) {
  try {
    key = String(key || "").trim();
    if (!key) return null;
    var list = (collection && collection.contents) ? collection.contents : (collection || []);
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      var k = _bbttccStableKeyOf(d);
      if (k && String(k) === key) return d;
    }
  } catch (_e) {}
  return null;
}

async function _bbttccResolveDoc(ref, docName) {
  try {
    var s = String(ref || "").trim();
    if (!s) return null;

    // UUID path
    if (s.indexOf(".") !== -1 && typeof fromUuid === "function") {
      try {
        var doc = await fromUuid(s);
        if (!docName) return doc;
        if (doc && String(doc.documentName || doc.documentName) === String(docName)) return doc;
      } catch (_eU) {}
    }

    // "Type.id" path
    var parts = s.split(".");
    if (parts.length === 2) {
      var type = parts[0];
      var id = parts[1];
      if (type === "Scene" && game.scenes) return game.scenes.get(id) || null;
      if (type === "Actor" && game.actors) return game.actors.get(id) || null;
      if (type === "JournalEntry" && game.journal) return game.journal.get(id) || null;
      if (type === "Playlist" && game.playlists) return game.playlists.get(id) || null;
      if (type === "RollTable" && game.tables) return game.tables.get(id) || null;
    }

    // raw id fallback by docName
    if (docName === "Scene" && game.scenes) return game.scenes.get(s) || null;
    if (docName === "Actor" && game.actors) return game.actors.get(s) || null;
    if (docName === "JournalEntry" && game.journal) return game.journal.get(s) || null;
    if (docName === "Playlist" && game.playlists) return game.playlists.get(s) || null;
    if (docName === "RollTable" && game.tables) return game.tables.get(s) || null;

    return null;
  } catch (_e) { return null; }
}

function _bbttccListJournalPacks() {
  try {
    var out = [];
    var packs = game && game.packs ? Array.from(game.packs) : [];
    for (var i = 0; i < packs.length; i++) {
      var p = packs[i];
      if (!p) continue;
      // CompendiumCollection shape
      var dn = String(p.documentName || p.metadata && p.metadata.type || "");
      if (dn !== "JournalEntry") continue;
      out.push({
        id: String(p.collection || p.metadata && p.metadata.id || ""),
        label: String(p.title || (p.metadata && p.metadata.label) || p.collection || "Journal Pack"),
        locked: !!p.locked
      });
    }
    out.sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); });
    return out;
  } catch (_e) { return []; }
}

function _bbttccGetPack(packId) {
  try {
    if (!packId) return null;
    return game && game.packs ? game.packs.get(String(packId)) : null;
  } catch (_e) { return null; }
}

function _bbttccClone(obj) {
  try { return foundry.utils.deepClone(obj); } catch (_e) {
    try { return JSON.parse(JSON.stringify(obj || {})); } catch (_e2) { return obj; }
  }
}

function _bbttccHasAnyRef(beat) {
  try {
    if (!beat) return false;
    if (beat.sceneId) return true;
    if (beat.cinematic && (beat.cinematic.startSceneId || beat.cinematic.nextSceneId)) return true;
    if (beat.actors && beat.actors.length) return true;
    if (beat.journal && beat.journal.entryId) return true;
    return false;
  } catch (_e) { return false; }
}

// Attach stable keys to beats.refs for later remap
async function _bbttccStampRefsIntoCampaign(campaign) {
  var c = _bbttccClone(campaign || {});
  var beats = Array.isArray(c.beats) ? c.beats : [];
  for (var i = 0; i < beats.length; i++) {
    var b = beats[i];
    if (!b || typeof b !== "object") continue;
    if (!_bbttccHasAnyRef(b)) continue;

    b.refs = b.refs && typeof b.refs === "object" ? b.refs : {};

    // Scene (primary)
    if (b.sceneId) {
      var sc = await _bbttccResolveDoc(b.sceneId, "Scene");
      var k = sc ? _bbttccStableKeyOf(sc) : null;
      if (k) b.refs.sceneKey = k;
    }

    // Cinematic scenes
    try {
      if (b.cinematic && b.cinematic.startSceneId) {
        var sc1 = await _bbttccResolveDoc(b.cinematic.startSceneId, "Scene");
        var k1 = sc1 ? _bbttccStableKeyOf(sc1) : null;
        if (k1) b.refs.cinematicStartKey = k1;
      }
      if (b.cinematic && b.cinematic.nextSceneId) {
        var sc2 = await _bbttccResolveDoc(b.cinematic.nextSceneId, "Scene");
        var k2 = sc2 ? _bbttccStableKeyOf(sc2) : null;
        if (k2) b.refs.cinematicNextKey = k2;
      }
    } catch (_eC) {}

    // Actors
    try {
      var akeys = [];
      var au = Array.isArray(b.actors) ? b.actors : [];
      for (var j = 0; j < au.length; j++) {
        var ad = await _bbttccResolveDoc(au[j], "Actor");
        var ak = ad ? _bbttccStableKeyOf(ad) : null;
        if (ak) akeys.push(ak);
      }
      if (akeys.length) b.refs.actorKeys = akeys;
    } catch (_eA) {}

    // Journal
    try {
      var je = (b.journal && b.journal.entryId) ? await _bbttccResolveDoc(b.journal.entryId, "JournalEntry") : null;
      var jk = je ? _bbttccStableKeyOf(je) : null;
      if (jk) b.refs.journalKey = jk;
    } catch (_eJ) {}
  }
  return c;
}

function _bbttccScrubExternalRefs(campaign) {
  var c = _bbttccClone(campaign || {});
  var beats = Array.isArray(c.beats) ? c.beats : [];
  for (var i = 0; i < beats.length; i++) {
    var b = beats[i];
    if (!b || typeof b !== "object") continue;
    // Keep refs (keys) but clear IDs so import doesn't wedge on missing docs
    b.sceneId = null;
    if (b.cinematic) {
      b.cinematic.startSceneId = null;
      b.cinematic.nextSceneId = null;
    }
    b.actors = [];
    if (b.journal) b.journal.entryId = null;
  }
  return c;
}

async function exportCampaignBundleToCompendium(opts) {
  opts = opts || {};
  var campaignId = String(opts.campaignId || "").trim();
  var packId = String(opts.packId || "").trim();
  if (!campaignId) throw new Error("exportCampaignBundleToCompendium: campaignId required");
  if (!packId) throw new Error("exportCampaignBundleToCompendium: packId required");

  var pack = _bbttccGetPack(packId);
  if (!pack) throw new Error("exportCampaignBundleToCompendium: pack not found: " + packId);
  if (pack.locked) throw new Error("exportCampaignBundleToCompendium: pack is locked: " + packId);

  var campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("exportCampaignBundleToCompendium: campaign not found: " + campaignId);

  // Build payload
  var c1 = await _bbttccStampRefsIntoCampaign(campaign);
  if (opts.scrubExternalRefs) c1 = _bbttccScrubExternalRefs(c1);

  var payload = {
    v: 1,
    kind: "bbttcc-campaign-bundle",
    exportedAt: Date.now(),
    campaignId: campaignId,
    campaignLabel: String(campaign.label || campaignId),
    includeTables: !!opts.includeTables,
    includeQuests: !!opts.includeQuests,
    campaign: c1,
    tables: null,
    quests: null
  };

  if (opts.includeTables) payload.tables = getAllTables();
  if (opts.includeQuests) payload.quests = getAllQuests();

  // Find existing entry for this campaignId (by flag)
  var entryDoc = null;
  try {
    var index = await pack.getIndex();
    for (var i = 0; i < index.length; i++) {
      var row = index[i];
      var doc = await pack.getDocument(row._id || row.id);
      if (!doc) continue;
      var ex = _bbttccGetFlag(doc, "bbttcc-campaign", "export");
      if (ex && String(ex.campaignId || "") === campaignId) { entryDoc = doc; break; }
    }
  } catch (_eFind) {}

  var name = String(opts.entryName || "").trim();
  if (!name) name = "Campaign Bundle  -  " + (campaign.label || campaign.id || campaignId);

  if (!entryDoc) {
    entryDoc = await pack.documentClass.create({
      name: name,
      content: "<p><b>BBTTCC Campaign Bundle</b></p><p>Use the BBTTCC Campaign Builder to import this bundle.</p>",
      flags: {
        "bbttcc-campaign": {
          export: payload
        }
      }
    }, { pack: pack.collection });
  } else {
    await entryDoc.update({
      name: name,
      flags: { "bbttcc-campaign": { export: payload } }
    });
  }

  return {
    ok: true,
    packId: packId,
    entryId: entryDoc.id,
    entryName: entryDoc.name,
    campaignId: campaignId,
    campaignLabel: payload.campaignLabel
  };
}

async function importCampaignBundleFromCompendium(opts) {
  opts = opts || {};
  var packId = String(opts.packId || "").trim();
  var entryId = String(opts.entryId || "").trim();
  if (!packId) throw new Error("importCampaignBundleFromCompendium: packId required");
  if (!entryId) throw new Error("importCampaignBundleFromCompendium: entryId required");

  var pack = _bbttccGetPack(packId);
  if (!pack) throw new Error("importCampaignBundleFromCompendium: pack not found: " + packId);

  var entryDoc = await pack.getDocument(entryId);
  if (!entryDoc) throw new Error("importCampaignBundleFromCompendium: entry not found: " + entryId);

  var payload = _bbttccGetFlag(entryDoc, "bbttcc-campaign", "export");
  if (!payload || String(payload.kind || "") !== "bbttcc-campaign-bundle") {
    throw new Error("importCampaignBundleFromCompendium: entry is not a BBTTCC campaign bundle");
  }

  var mode = String(opts.mode || "merge").trim().toLowerCase(); // merge | duplicate
  var idPrefix = String(opts.idPrefix || "").trim();
  var setActive = !!opts.setActive;

  var c = payload.campaign || null;
  if (!c) throw new Error("importCampaignBundleFromCompendium: payload missing campaign");

  var targetCampaignId = String(payload.campaignId || c.id || "").trim();
  if (!targetCampaignId) targetCampaignId = "campaign_" + randomID();

  if (mode === "duplicate") {
    var prefix = idPrefix || ("import_" + randomID().slice(0, 4) + "_");
    targetCampaignId = prefix + targetCampaignId;
    c = _bbttccClone(c);
    c.id = targetCampaignId;
  }

  // Merge tables/quests into this world (optional)
  if (payload.tables && typeof payload.tables === "object") {
    var curT = getAllTables();
    curT = curT && typeof curT === "object" ? curT : {};
    var incT = payload.tables;
    for (var k in incT) if (Object.prototype.hasOwnProperty.call(incT, k)) curT[k] = incT[k];
    await setAllTables(curT);
  }

  if (payload.quests && typeof payload.quests === "object") {
    var curQ = getAllQuests();
    curQ = curQ && typeof curQ === "object" ? curQ : {};
    var incQ = payload.quests;
    for (var qk in incQ) if (Object.prototype.hasOwnProperty.call(incQ, qk)) curQ[qk] = incQ[qk];
    await setAllQuests(curQ);
  }

  await saveCampaign(targetCampaignId, c);

  // Remap references based on refs.* keys
  var remapRes = await remapCampaignReferences(targetCampaignId, { dryRun: false });

  if (setActive) {
    try { await setActiveCampaignId(targetCampaignId); } catch (_eA) {}
  }

  return {
    ok: true,
    campaignId: targetCampaignId,
    label: String(c.label || c.title || targetCampaignId),
    remap: remapRes
  };
}

async function remapCampaignReferences(campaignId, opts) {
  opts = opts || {};
  campaignId = String(campaignId || "").trim();
  if (!campaignId) throw new Error("remapCampaignReferences: campaignId required");

  var dryRun = !!opts.dryRun;

  var campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("remapCampaignReferences: campaign not found: " + campaignId);

  var c = _bbttccClone(campaign);
  var beats = Array.isArray(c.beats) ? c.beats : [];
  var changes = [];

  var resolveSceneIdByKey = function (key) {
    var sc = _bbttccFindByStableKey(game.scenes, key);
    if (!sc) return null;
    return "Scene." + String(sc.id);
  };
  var resolveActorUuidByKey = function (key) {
    var a = _bbttccFindByStableKey(game.actors, key);
    if (!a) return null;
    return "Actor." + String(a.id);
  };
  var resolveJournalUuidByKey = function (key) {
    var j = _bbttccFindByStableKey(game.journal, key);
    if (!j) return null;
    return "JournalEntry." + String(j.id);
  };

  for (var i = 0; i < beats.length; i++) {
    var b = beats[i];
    if (!b || typeof b !== "object") continue;
    var refs = b.refs && typeof b.refs === "object" ? b.refs : null;
    if (!refs) continue;

    // Scene (primary)
    if (refs.sceneKey) {
      var exists = await _bbttccResolveDoc(b.sceneId, "Scene");
      if (!exists) {
        var next = resolveSceneIdByKey(refs.sceneKey);
        if (next && next !== b.sceneId) {
          changes.push({ beatId: b.id, field: "sceneId", from: b.sceneId || null, to: next, key: refs.sceneKey });
          b.sceneId = next;
        }
      }
    }

    // Cinematic
    if (b.cinematic && refs.cinematicStartKey) {
      var ex1 = await _bbttccResolveDoc(b.cinematic.startSceneId, "Scene");
      if (!ex1) {
        var nx1 = resolveSceneIdByKey(refs.cinematicStartKey);
        if (nx1 && nx1 !== b.cinematic.startSceneId) {
          changes.push({ beatId: b.id, field: "cinematic.startSceneId", from: b.cinematic.startSceneId || null, to: nx1, key: refs.cinematicStartKey });
          b.cinematic.startSceneId = nx1;
        }
      }
    }
    if (b.cinematic && refs.cinematicNextKey) {
      var ex2 = await _bbttccResolveDoc(b.cinematic.nextSceneId, "Scene");
      if (!ex2) {
        var nx2 = resolveSceneIdByKey(refs.cinematicNextKey);
        if (nx2 && nx2 !== b.cinematic.nextSceneId) {
          changes.push({ beatId: b.id, field: "cinematic.nextSceneId", from: b.cinematic.nextSceneId || null, to: nx2, key: refs.cinematicNextKey });
          b.cinematic.nextSceneId = nx2;
        }
      }
    }

    // Actors
    if (Array.isArray(refs.actorKeys) && refs.actorKeys.length) {
      // If any actor uuids fail to resolve, we rebuild the list from keys.
      var okAll = true;
      var au = Array.isArray(b.actors) ? b.actors : [];
      for (var j = 0; j < au.length; j++) {
        var exA = await _bbttccResolveDoc(au[j], "Actor");
        if (!exA) { okAll = false; break; }
      }
      if (!okAll) {
        var nextActors = [];
        for (var k = 0; k < refs.actorKeys.length; k++) {
          var ax = resolveActorUuidByKey(refs.actorKeys[k]);
          if (ax) nextActors.push(ax);
        }
        if (nextActors.length) {
          changes.push({ beatId: b.id, field: "actors", from: au, to: nextActors, key: refs.actorKeys.slice(0) });
          b.actors = nextActors;
        }
      }
    }

    // Journal
    if (b.journal && refs.journalKey) {
      var exJ = await _bbttccResolveDoc(b.journal.entryId, "JournalEntry");
      if (!exJ) {
        var nj = resolveJournalUuidByKey(refs.journalKey);
        if (nj && nj !== b.journal.entryId) {
          changes.push({ beatId: b.id, field: "journal.entryId", from: b.journal.entryId || null, to: nj, key: refs.journalKey });
          b.journal.entryId = nj;
        }
      }
    }
  }

  if (!dryRun && changes.length) {
    await saveCampaign(campaignId, c);
  }

  // Build unresolved report (keys that couldn't be mapped)
  var unresolved = [];
  for (var ci = 0; ci < beats.length; ci++) {
    var bb = beats[ci];
    var rr = bb && bb.refs ? bb.refs : null;
    if (!rr) continue;

    if (rr.sceneKey && !resolveSceneIdByKey(rr.sceneKey)) unresolved.push({ beatId: bb.id, kind: "Scene", key: rr.sceneKey, field: "sceneId" });
    if (rr.cinematicStartKey && !resolveSceneIdByKey(rr.cinematicStartKey)) unresolved.push({ beatId: bb.id, kind: "Scene", key: rr.cinematicStartKey, field: "cinematic.startSceneId" });
    if (rr.cinematicNextKey && !resolveSceneIdByKey(rr.cinematicNextKey)) unresolved.push({ beatId: bb.id, kind: "Scene", key: rr.cinematicNextKey, field: "cinematic.nextSceneId" });

    if (Array.isArray(rr.actorKeys)) {
      for (var kk = 0; kk < rr.actorKeys.length; kk++) {
        if (!resolveActorUuidByKey(rr.actorKeys[kk])) unresolved.push({ beatId: bb.id, kind: "Actor", key: rr.actorKeys[kk], field: "actors" });
      }
    }
    if (rr.journalKey && !resolveJournalUuidByKey(rr.journalKey)) unresolved.push({ beatId: bb.id, kind: "JournalEntry", key: rr.journalKey, field: "journal.entryId" });
  }

  return { ok: true, campaignId: campaignId, dryRun: dryRun, changes: changes, unresolved: unresolved };
}

// Tooling helpers for authors (stable keys)
async function setStableKeyOnDoc(ref, key) {
  key = String(key || "").trim();
  if (!key) throw new Error("setStableKeyOnDoc: key required");
  var doc = await _bbttccResolveDoc(ref, null);
  if (!doc || !doc.setFlag) throw new Error("setStableKeyOnDoc: doc not found: " + String(ref || ""));
  await doc.setFlag("bbttcc", "key", key);
  return { ok: true, docName: doc.documentName, id: doc.id, name: doc.name, key: key };
}

function scanStableKeysReport() {
  var rep = { scenes: { missing: [], present: [] }, actors: { missing: [], present: [] }, journals: { missing: [], present: [] } };
  try {
    var s = (game.scenes && game.scenes.contents) ? game.scenes.contents : [];
    for (var i = 0; i < s.length; i++) {
      var k = _bbttccStableKeyOf(s[i]);
      (k ? rep.scenes.present : rep.scenes.missing).push({ id: s[i].id, name: s[i].name, key: k || "" });
    }
  } catch (_eS) {}
  try {
    var a = (game.actors && game.actors.contents) ? game.actors.contents : [];
    for (var j = 0; j < a.length; j++) {
      var ak = _bbttccStableKeyOf(a[j]);
      (ak ? rep.actors.present : rep.actors.missing).push({ id: a[j].id, name: a[j].name, key: ak || "" });
    }
  } catch (_eA) {}
  try {
    var jn = (game.journal && game.journal.contents) ? game.journal.contents : [];
    for (var k2 = 0; k2 < jn.length; k2++) {
      var jk = _bbttccStableKeyOf(jn[k2]);
      (jk ? rep.journals.present : rep.journals.missing).push({ id: jn[k2].id, name: jn[k2].name, key: jk || "" });
    }
  } catch (_eJ) {}
  return rep;
}

// API
function buildCampaignAPI() {
  return {
    listCampaigns,
    getCampaign,
    saveCampaign,
    createCampaign,
    deleteCampaign,
    getAllCampaigns,
    setAllCampaigns,
    runCampaign,
    runBeat,
    injector: { fire: injectorFire },
    tables: { listTables, getTable, saveTable, createTable, deleteTable, getAllTables, setAllTables, runRandomTable },
    quests: { listQuests, getQuest, saveQuest, createQuest, deleteQuest, setQuestStatus, getAllQuests, setAllQuests },
    io: {
      listJournalPacks: _bbttccListJournalPacks,
      exportBundleToCompendium: exportCampaignBundleToCompendium,
      importBundleFromCompendium: importCampaignBundleFromCompendium,
      remapCampaignReferences: remapCampaignReferences,
      setStableKeyOnDoc: setStableKeyOnDoc,
      scanStableKeysReport: scanStableKeysReport
    },
    openBuilder,
    getActiveCampaignId,
    setActiveCampaignId,
    builderClass: null
  };
}

// INIT
Hooks.once("init", () => {
  game.settings.register(MOD_ID, SETTING_CAMPAIGNS, {
    name: "BBTTCC Campaign Definitions",
    hint: "Internal storage for BBTTCC Campaign Builder. Do not edit manually.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MOD_ID, SETTING_INJECT_STATE, {
    name: "BBTTCC Campaign Injector State",
    hint: "Internal gating state for campaign beat injection (cooldowns / oncePerHex).",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MOD_ID, SETTING_TABLES, {
    name: "BBTTCC Encounter Tables",
    hint: "Internal storage for BBTTCC Random Encounter Tables. Do not edit manually.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  game.settings.register(MOD_ID, SETTING_QUESTS, {
    name: "BBTTCC Quest Registry",
    hint: "Internal storage for BBTTCC Quests (definitions). Do not edit manually.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // NEW: UI preference  -  which campaign is "active" (auto-selected in Builder)
  game.settings.register(MOD_ID, SETTING_ACTIVE_CAMPAIGN, {
    name: "BBTTCC Active Campaign",
    hint: "Internal UI preference: the campaign which should be selected by default in the Campaign Builder.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  // NEW: Campaign Turn Flow  -  remembers the last Strategic Turn we announced
  // so we don't spam messages on reload. Stored as an integer.
  game.settings.register(MOD_ID, SETTING_LAST_TURN_ANNOUNCED, {
    name: "BBTTCC Campaign Turn Announcements (Last Turn)",
    hint: "Internal: last Strategic Turn number for which Campaign Turn Flow was announced.",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  try {
    const H = globalThis.Handlebars;
    if (H) {
      if (!H.helpers.add) H.registerHelper("add", (a, b) => Number(a || 0) + Number(b || 0));
      if (!H.helpers.eq)  H.registerHelper("eq", (a, b) => a === b);
    }
  } catch (e) {
    warn("Handlebars helpers failed:", e);
  }

  log("Initialized, settings registered, helpers ready.");
});

// READY
Hooks.once("ready", () => {
  game.bbttcc ??= { api: {} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.campaign = buildCampaignAPI();
  installInjectorHooks();
  _installBeatAudioSocket();
  _installPlayerFacingChatBridge();
  // Beat Narration controls (GM can stop table-wide narration)
  try {
    game.bbttcc.api.campaign.stopBeatNarration = () => {
      try { _stopBeatAudio(); } catch (_eS) {}
      try { _broadcastBeatAudio("stop"); } catch (_eB) {}
    };
    game.bbttcc.api.campaign.closePlayerFacingBeatDialog = () => {
      try { _closePlayerFacingDialogLocal(); } catch (_eS2) {}
      try { _broadcastPlayerFacingDialog("close", {}); } catch (_eB2) {}
      try { _stopBeatAudio(); } catch (_eS2b) {}
      try { _broadcastBeatAudio("stop", {}); } catch (_eB2b) {}
    };
    game.bbttcc.api.campaign.showPlayerFacingBeatDialog = (payload) => {
      try { _showPlayerFacingDialogLocal(payload || {}); } catch (_eS3) {}
      try { _broadcastPlayerFacingDialog("show", payload || {}); } catch (_eB3) {}
    };
  } catch (_eAPI) {}

  log("Campaign API installed on game.bbttcc.api.campaign.", game.bbttcc.api.campaign);
  // Build Encounter Engine scenario index from campaign encounter beats.
  _scheduleEncounterRebuild();

  // Campaign Turn Flow: keep bbttcc-world's per-turn availability map in sync for the active campaign.
  try {
    var active = getActiveCampaignId();
    if (active) _syncWorldTurnBeatsForCampaign(active);
  } catch (_e0) {}

  // Campaign Turn Flow: announce "now available" beats when Strategic Turns advance.
  // Turn Driver fires bbttcc:advanceTurn:end after it completes.
  try {
    if (!globalThis.__bbttccCampaignTurnFlowHookInstalled) {
      globalThis.__bbttccCampaignTurnFlowHookInstalled = true;
      Hooks.on("bbttcc:advanceTurn:end", function(){ _announceTurnAvailabilityIfNeeded(); });
    }
  } catch (_e1) {}
});
