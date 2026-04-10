// modules/bbttcc-campaign/apps/campaign-builder-app.js
//
// FULL REPLACEMENT (RESTORE BEAT EDITING + ACTION HANDLERS)
// - Restores missing Beat action handlers (Edit Beat button, Add Beat, Run Beat, Delete, Duplicate, Move)
// - Preserves existing Campaign-Scoped Travel Encounter Tables UI + Engine Table clone behavior
// - Keeps beat update hook reconciliation (bbttcc-campaign:updateBeat)
// - Uses defensive guards so missing APIs do not hard-crash module boot
//
// NOTE: This file intentionally uses Application (V1) for parity with the current module.
//       Future migration to ApplicationV2 can be done as a separate sprint.
const TAG = "[bbttcc-campaign][BuilderApp]";

// Lazy loader: Beat Editor (avoids static ES import so this file can be loaded in more environments)
async function _loadBeatEditorApp() {
  try {
    const mod = await import("./campaign-beat-editor.js");
    return mod?.BBTTCCCampaignBeatEditorApp || mod?.default || null;
  } catch (e) {
    console.error(TAG, "Failed to load Beat Editor module:", e);
    return null;
  }
}


const MOD_ID = "bbttcc-campaign";
const SETTING_ACTIVE_CAMPAIGN = "activeCampaignId";

// Overlay layer id for portaled popovers (Campaign Builder)
const PORTAL_LAYER_ID = "bbttcc-campaign-popover-layer";

function _getActiveCampaignId() {
  try { return String(game.settings.get(MOD_ID, SETTING_ACTIVE_CAMPAIGN) || "").trim() || null; }
  catch { return null; }
}

async function _setActiveCampaignId(id) {
  try { await game.settings.set(MOD_ID, SETTING_ACTIVE_CAMPAIGN, id || ""); }
  catch (e) { console.warn(TAG, "Failed to set active campaign id:", e); }
}

function _listFactionActors() {
  try {
    const out = [];
    for (const a of (game.actors?.contents || [])) {
      const hasFlags = !!a?.flags?.["bbttcc-factions"];
      const isType = String(a?.type || "").toLowerCase() === "faction";
      if (!hasFlags && !isType) continue;
      out.push({ uuid: a.uuid, name: a.name });
    }
    out.sort((a, b) => String(a.name).localeCompare(String(b.name), game.i18n.lang));
    return out;
  } catch {
    return [];
  }
}

function _escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// When campaign.factionId changes, propagate to beats that are currently "inheriting"
function _propagateCampaignFactionToBeats(campaign, oldFactionUuid, newFactionUuid) {
  const oldId = String(oldFactionUuid || "").trim();
  const newId = String(newFactionUuid || "").trim();
  if (!campaign || !newId) return;

  const beats = Array.isArray(campaign.beats) ? campaign.beats : [];
  for (const beat of beats) {
    if (!beat || typeof beat !== "object") continue;

    if (beat.factionId != null) {
      const bfid = String(beat.factionId || "").trim();
      if (!bfid || bfid === "inherit" || (oldId && bfid === oldId)) beat.factionId = newId;
    }

    const we = beat.worldEffects;
    const fx = Array.isArray(we?.factionEffects) ? we.factionEffects : null;
    if (fx) {
      for (const row of fx) {
        if (!row || typeof row !== "object") continue;
        const fid = String(row.factionId || "").trim();
        if (!fid || fid === "inherit" || (oldId && fid === oldId)) row.factionId = newId;
      }
    }
  }
}

async function _openTableEditor(tableId) {
  try {
    const mod = await import("./campaign-table-editor.js");
    const App = mod?.BBTTCCCampaignTableEditorApp;
    if (!App) {
      ui.notifications?.warn?.("Table Editor module loaded, but BBTTCCCampaignTableEditorApp export missing.");
      return;
    }
    new App({ tableId }).render(true);
  } catch (e) {
    console.error(TAG, "Failed to load Table Editor:", e);
    ui.notifications?.error?.("Could not open Table Editor. See console (likely missing file path).");
  }
}

// ---------------------------------------------------------------------------
// Travel Encounter Tables UI helpers (Campaign-scoped)
// ---------------------------------------------------------------------------

const TRAVEL_CATS = [
  { key: "hazard",    label: "Hazard" },
  { key: "monster",   label: "Monster" },
  { key: "rare",      label: "Rare" },
  { key: "worldboss", label: "Worldboss" }
];

function _getTravelEncounterEngineCatalog() {
  // Source: game.bbttcc.api.travel.__encounters.tables + optional lookup()
  const enc = game.bbttcc?.api?.travel?.__encounters;
  const tables = enc?.tables || null;
  const lookup = (typeof enc?.lookup === "function") ? enc.lookup.bind(enc) : null;

  const out = {};
  for (const c of TRAVEL_CATS) out[c.key] = [];

  if (!tables || typeof tables !== "object") return out;

  for (const [cat, list] of Object.entries(tables)) {
    if (!out[cat]) continue;
    if (!Array.isArray(list)) continue;
    out[cat] = list
      .filter(e => e && e.key)
      .map(e => ({
        key: String(e.key),
        label: String(e.label || e.key),
        weight: Number(e.weight ?? 1) || 1,
        terrains: Array.isArray(e.terrains) ? e.terrains.slice() : [],
        minTier: (e.minTier != null) ? Number(e.minTier) : null,
        maxTier: (e.maxTier != null) ? Number(e.maxTier) : null
      }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
  }

  // If lookup exists, we can enrich labels for keys not present in category lists later.
  out.__lookup = lookup;
  return out;
}

function _readCampaignTravelTables(campaign) {
  // Stored as: campaign.encounterTables.travel[cat] = [keys...]
  const cfg = campaign?.encounterTables?.travel;
  if (!cfg || typeof cfg !== "object") return {};
  const out = {};
  for (const c of TRAVEL_CATS) {
    const arr = Array.isArray(cfg[c.key]) ? cfg[c.key] : [];
    out[c.key] = arr.map(String);
  }
  return out;
}

function _writeCampaignTravelTables(campaign, nextTables) {
  campaign.encounterTables ??= {};
  campaign.encounterTables.travel ??= {};
  for (const c of TRAVEL_CATS) {
    const arr = Array.isArray(nextTables?.[c.key]) ? nextTables[c.key] : [];
    // Normalize, dedupe, preserve order
    const seen = new Set();
    const out = [];
    for (const k of arr.map(String)) {
      const kk = String(k || "").trim();
      if (!kk) continue;
      if (seen.has(kk)) continue;
      seen.add(kk);
      out.push(kk);
    }
    campaign.encounterTables.travel[c.key] = out;
  }
}

function _labelForKey(engineCatalog, cat, key) {
  const list = engineCatalog?.[cat] || [];
  const hit = list.find(x => String(x.key) === String(key));
  if (hit) return hit.label;
  const lookup = engineCatalog?.__lookup;
  if (typeof lookup === "function") {
    try {
      const e = lookup(key);
      if (e && e.label) return String(e.label);
    } catch (_e) {}
  }
  return String(key);
}


function _isTravelTableRecord(table) {
  try {
    if (!table) return false;
    const id = String(table.id || "").trim().toLowerCase();
    const label = String(table.label || "").trim().toLowerCase();
    const scope = String(table.scope || "").trim().toLowerCase();
    const tags = Array.isArray(table.tags) ? table.tags.map(t => String(t || "").trim().toLowerCase()) : [];
    if (id.startsWith("travel_")) return true;
    if (scope === "travel") return true;
    if (tags.includes("travel")) return true;
    if (label.includes("travel")) return true;
  } catch (_e) {}
  return false;
}

function _parseTravelTableMeta(table) {
  const id = String(table?.id || "").trim().toLowerCase();
  const label = String(table?.label || "").trim();
  const tags = Array.isArray(table?.tags) ? table.tags.map(t => String(t || "").trim().toLowerCase()) : [];
  let terrain = "";
  let tier = null;

  const m = id.match(/^travel_([a-z0-9]+)_t(\d+)$/i) || id.match(/^travel_([a-z0-9]+)_tier(\d+)$/i);
  if (m) {
    terrain = String(m[1] || "").toLowerCase();
    tier = Number(m[2] || 0) || null;
  }

  if (!terrain) {
    const known = ["plains","forest","mountains","canyons","swamp","desert","river","ocean","ruins","wasteland"];
    for (const k of known) {
      if (id.includes(k) || tags.includes(k) || label.toLowerCase().includes(k)) {
        terrain = k;
        break;
      }
    }
  }

  if (!tier) {
    const tm = id.match(/(?:^|_)(?:t|tier)([1-4])(?:_|$)/i) || label.match(/tier\s*([1-4])/i);
    if (tm) tier = Number(tm[1] || 0) || null;
  }

  return { terrain, tier };
}

function _filterTravelTables(tables, terrain, tier) {
  const wantTerrain = String(terrain || "").trim().toLowerCase();
  const wantTier = Number(tier || 0) || 0;
  const all = Array.isArray(tables) ? tables.filter(_isTravelTableRecord) : [];
  const rows = all.map(t => ({ ...t, __travel: _parseTravelTableMeta(t) }));
  const filtered = rows.filter(t => {
    const terrOk = !wantTerrain || !t.__travel.terrain || t.__travel.terrain === wantTerrain;
    const tierOk = !wantTier || !t.__travel.tier || t.__travel.tier === wantTier;
    return terrOk && tierOk;
  });
  filtered.sort((a, b) => String(a.label || a.id || "").localeCompare(String(b.label || b.id || ""), game.i18n.lang));
  return { filtered, all: rows };
}

// ---------------------------------------------------------------------------
// Beats helpers (UI polish)
// ---------------------------------------------------------------------------

function collectBeatTypes(campaign) {
  const beats = Array.isArray((campaign && campaign.beats)) ? campaign.beats : [];
  const set = new Set();
  for (const b of beats) set.add(String(b?.type || "unknown"));
  return Array.from(set).sort((a, b) => a.localeCompare(b, game.i18n.lang));
}

function filterBeats(campaign, searchRaw = "", typeFilter = "all", turnFilter = "all", questFilter = "all", questStatusFilter = "all", questMap = null) {
  const beats = Array.isArray((campaign && campaign.beats)) ? campaign.beats : [];
  const q = String(searchRaw || "").trim().toLowerCase();
  const tf = String(typeFilter || "all");

  const tfTurn = String(turnFilter || "all");

  const getTurn = (beat) => {
    try {
      if (!beat || typeof beat !== "object") return null;

      let cand = null;
      if (beat.turnNumber != null) cand = beat.turnNumber;
      else if (beat.turn != null) cand = beat.turn;
      else if (beat.chapter != null) cand = beat.chapter;
      else if (beat.meta && beat.meta.turn != null) cand = beat.meta.turn;
      else if (beat.injection && beat.injection.turn != null) cand = beat.injection.turn;

      if (cand != null && cand !== "") {
        const n = Number(cand);
        if (isFinite(n) && n >= 1) return Math.floor(n);
      }

      // tags like "turn:1"
      let tags = beat.tags;
      if (typeof tags === "string") tags = tags.split(/\s*,\s*/g);
      if (Array.isArray(tags)) {
        for (let i = 0; i < tags.length; i++) {
          const t = String(tags[i] || "").trim().toLowerCase();
          const m = t.match(/^(turn|chapter)\s*:\s*(\d+)$/);
          if (m && m[2]) return Math.max(1, parseInt(m[2], 10));
        }
      }
      return null;
    } catch (_e) {
      return null;
    }
  };

  const out = [];
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    if (!beat) continue;

    const t = String(beat.type || "unknown");
    if (tf !== "all" && t !== tf) continue;

    // Turn filter
    if (tfTurn !== "all") {
      const tn = getTurn(beat);
      if (tfTurn === "unassigned") {
        if (tn != null) continue;
      } else {
        const want = Number(tfTurn);
        if (!isFinite(want) || want < 1) continue;
        if (tn == null || tn !== Math.floor(want)) continue;
      }
    }

    
    // Quest filter
    if (questFilter && String(questFilter) !== "all") {
      const qid = String(beat.questId || "").trim();
      if (!qid || String(qid) !== String(questFilter)) continue;
    }
    if (questStatusFilter && String(questStatusFilter) !== "all") {
      const qid = String(beat.questId || "").trim();
      if (!qid) continue;
      const qm = (questMap && questMap[qid]) ? questMap[qid] : null;
      const st = String(qm?.status || "").trim().toLowerCase();
      if (String(st) !== String(questStatusFilter).toLowerCase()) continue;
    }
if (q) {
      const id = String(beat.id || "").toLowerCase();
      const lbl = String(beat.label || "").toLowerCase();
      const tt = t.toLowerCase();
      if (!id.includes(q) && !lbl.includes(q) && !tt.includes(q)) continue;
    }

    out.push({ beat, n: i + 1 });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Flow helper
// ---------------------------------------------------------------------------

function buildFlowNodes(campaign) {
  const beats = Array.isArray(campaign.beats) ? campaign.beats : [];
  if (!beats.length) return [];
  const startId = beats[0]?.id;

  return beats.map(b => {
    const links = [];
    if (b.outcomes) {
      if (b.outcomes.success) links.push({ kind: "Success", label: "Success", toId: b.outcomes.success });
      if (b.outcomes.failure) links.push({ kind: "Failure", label: "Failure", toId: b.outcomes.failure });
    }
    if (Array.isArray(b.choices)) {
      b.choices.forEach((choice, idx) => {
        const lbl = choice.label || `Choice ${idx + 1}`;
        if (choice.next) links.push({ kind: "Choice", label: lbl, toId: choice.next });
      });
    }
    return { id: b.id, label: b.label || b.id, type: b.type || "unknown", isStart: b.id === startId, links };
  });
}


// ---------------------------------------------------------------------------
// Flow Visualizer (Org Chart)
// - Replaces the legacy Flow tab list with a pan/zoom SVG graph.
// - Canon rules:
//   * Travel/Random beats are designated by beat.timeScale === "leg" (optional lane toggle).
//   * Turn assignment badge uses beat.turnNumber.
// - Read-only: clicking a node opens the Beat Editor.
// ---------------------------------------------------------------------------

function _isTravelBeat(beat) {
  return String((beat && beat.timeScale) || "").trim().toLowerCase() === "leg";
}

function _extractEdges(beats) {
  const edges = [];
  const byId = {};
  for (const b of beats) if (b?.id) byId[String(b.id)] = b;

  const pushEdge = (fromId, toId, kind, label) => {
    const a = String(fromId || "").trim();
    const b = String(toId || "").trim();
    if (!a || !b) return;
    if (!byId[b]) return; // only link to existing beats
    edges.push({ from: a, to: b, kind: String(kind || "link"), label: String(label || "") });
  };

  for (const b of beats) {
    const fromId = String(b?.id || "").trim();
    if (!fromId) continue;

    const o = b?.outcomes || null;
    if (o) {
      if (o.success) pushEdge(fromId, o.success, "success", "Success");
      if (o.failure) pushEdge(fromId, o.failure, "failure", "Failure");
    }

    const choices = Array.isArray(b?.choices) ? b.choices : [];
    for (let i = 0; i < choices.length; i++) {
      const ch = choices[i];
      if (!ch) continue;
      if (ch.next) pushEdge(fromId, ch.next, "choice", ch.label || ("Choice " + String(i + 1)));
      if (ch.failNext) pushEdge(fromId, ch.failNext, "choice_fail", (ch.label || ("Choice " + String(i + 1))) + " (Fail)");
    }
  }

  return edges;
}

function _computeDepths(startId, nodes, edges) {
  const depth = {};
  for (const n of nodes) depth[n.id] = Infinity;
  if (startId && depth[startId] != null) depth[startId] = 0;

  const out = {};
  const q = [];
  if (startId && depth[startId] === 0) q.push(startId);

  const adj = {};
  for (const e of edges) {
    adj[e.from] ??= [];
    adj[e.from].push(e.to);
  }

  while (q.length) {
    const cur = q.shift();
    const d = depth[cur] ?? Infinity;
    const nexts = adj[cur] || [];
    for (const nx of nexts) {
      if ((depth[nx] ?? Infinity) > d + 1) {
        depth[nx] = d + 1;
        q.push(nx);
      }
    }
  }

  // Replace Infinity with a stable "far right" lane based on authoring order
  let max = 0;
  for (const k of Object.keys(depth)) if (isFinite(depth[k])) max = Math.max(max, depth[k]);

  for (const n of nodes) {
    const d = depth[n.id];
    out[n.id] = isFinite(d) ? d : (max + 1);
  }
  return out;
}

function _buildFlowGraph(campaign, opts) {
  // Choose-your-own-adventure decision tree visualizer
  // - One visualization per Turn/Chapter
  // - Nodes are meaningful scene beats only (exclude cinematic/travel)
  // - Branches are outgoing beat links (choices/success/failure)

  opts = opts || {};

  var beatsAll = Array.isArray(campaign && campaign.beats) ? campaign.beats : [];

  var isTag = function (b, key) {
    try {
      var tags = b && b.tags;
      if (!tags) return false;
      if (typeof tags === "string") tags = tags.split(/\s*,\s*/g);
      if (!Array.isArray(tags)) return false;
      var k = String(key || "").trim().toLowerCase();
      for (var i = 0; i < tags.length; i++) {
        var t = String(tags[i] || "").trim().toLowerCase();
        if (!t) continue;
        if (t === k) return true;
        if (t.indexOf(k + ":") === 0) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  var getTurn = function (b) {
    try {
      if (!b || typeof b !== "object") return null;
      var cand = null;
      // common fields
      if (b.turnNumber != null) cand = b.turnNumber;
      else if (b.turn != null) cand = b.turn;
      else if (b.chapter != null) cand = b.chapter;
      else if (b.meta && b.meta.turn != null) cand = b.meta.turn;
      else if (b.injection && b.injection.turn != null) cand = b.injection.turn;

      if (cand != null && cand !== "") {
        var n = Number(cand);
        if (isFinite(n) && n >= 1) return Math.floor(n);
      }

      // tags like turn:1, chapter:2
      var tags = b.tags;
      if (typeof tags === "string") tags = tags.split(/\s*,\s*/g);
      if (Array.isArray(tags)) {
        for (var i = 0; i < tags.length; i++) {
          var t = String(tags[i] || "").trim().toLowerCase();
          var m = t.match(/^(turn|chapter)\s*:\s*(\d+)$/);
          if (m && m[2]) return Math.max(1, parseInt(m[2], 10));
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  var showTravel = !!opts.showTravel;

  var isCinematic = function (b) {
    // Cinematic beats are FIRST-CLASS in the visualizer (they are flow glue).
    // We no longer exclude them.
    return false;
  };

  var isTravel = function (b) {
    try {
      if (_isTravelBeat(b)) return true;
    } catch (e) {}
    if (isTag(b, "travel")) return true;
    return false;
  };

  var isMeaningful = function (b) {
    if (!b || !b.id) return false;
    // Travel beats are optional lane.
    if (!showTravel && isTravel(b)) return false;
    return true;
  };

  // Determine selected turn: default = latest turn with content
  var selectedTurn = null;
  if (opts.turn != null && opts.turn !== "") {
    var tn = Number(opts.turn);
    if (isFinite(tn) && tn >= 1) selectedTurn = Math.floor(tn);
  }

  var turns = [];
  var seenTurns = {};
  for (var i = 0; i < beatsAll.length; i++) {
    var b0 = beatsAll[i];
    if (!isMeaningful(b0)) continue;
    var t0 = getTurn(b0);
    if (t0 == null) continue;
    if (!seenTurns[t0]) { seenTurns[t0] = true; turns.push(t0); }
  }
  turns.sort(function (a, b) { return a - b; });

  if (selectedTurn == null) {
    // If the caller didn't specify a turn, we treat it as "All".
    // (UI will show the All Turns option.)
    if (opts.turn != null && opts.turn !== "" && String(opts.turn) !== "all") {
      selectedTurn = turns.length ? turns[turns.length - 1] : 1;
    } else {
      selectedTurn = null;
    }
  }

  // Filter beats by Turn (optional). If selectedTurn is null, include all turns.
  var beats = [];
  for (i = 0; i < beatsAll.length; i++) {
    var b1 = beatsAll[i];
    if (!isMeaningful(b1)) continue;
    var t1 = getTurn(b1);
    if (t1 == null) t1 = 1;

    if (selectedTurn != null && t1 !== selectedTurn) continue;
    beats.push(b1);
  }

  // Quest filter (optional): when set, we keep the closure of beats reachable
  // from any beat with beat.questId === questId (includes cinematics/post glue).
  var questId = String(opts.questId || "all");
  if (questId && questId !== "all") {
    var byAll = {};
    for (i = 0; i < beatsAll.length; i++) {
      var bAll = beatsAll[i];
      if (bAll && bAll.id) byAll[String(bAll.id)] = bAll;
    }

    // Build global adjacency from all beats (respect travel lane toggle via isMeaningful)
    var edgesAll = _extractEdges(beatsAll.filter(isMeaningful));
    var adjAll = {};
    for (i = 0; i < edgesAll.length; i++) {
      var ee = edgesAll[i];
      if (!ee || !ee.from || !ee.to) continue;
      adjAll[ee.from] = adjAll[ee.from] || [];
      adjAll[ee.from].push(ee.to);
    }

    var seeds = [];
    for (i = 0; i < beatsAll.length; i++) {
      var qb = beatsAll[i];
      if (!qb || !qb.id) continue;
      if (String(qb.questId || "").trim() === questId) seeds.push(String(qb.id));
    }

    var keep = {};
    var q = seeds.slice();
    for (i = 0; i < q.length; i++) keep[q[i]] = true;

    // BFS forward closure (cycle-safe)
    var guard = 0;
    while (q.length && guard < 5000) {
      guard++;
      var cur = q.shift();
      var kids = adjAll[cur] || [];
      for (var k = 0; k < kids.length; k++) {
        var nx = kids[k];
        if (!nx) continue;
        if (keep[nx]) continue;
        keep[nx] = true;
        q.push(nx);
      }
    }

    // Apply closure to the currently turn-filtered beats list
    beats = beats.filter(function(bx){
      return bx && bx.id && keep[String(bx.id)];
    });
  }

  // Nodes by id
  var byId = {};
  for (i = 0; i < beats.length; i++) byId[String(beats[i].id)] = beats[i];

  // Extract outgoing edges (success/failure + choices + next)
  var edges = [];
  var adj = {};
  var pushEdge = function (fromId, toId, kind, label) {
    var a = String(fromId || "").trim();
    var c = String(toId || "").trim();
    if (!a || !c) return;
    if (!byId[c]) return; // only within selected turn
    edges.push({ from: a, to: c, kind: String(kind || "link"), label: String(label || "") });
    adj[a] = adj[a] || [];
    adj[a].push(c);
  };

  for (i = 0; i < beats.length; i++) {
    var bb = beats[i];
    if (!bb || !bb.id) continue;
    var from = String(bb.id);

    if (bb.next) pushEdge(from, bb.next, "next", "Next");

    var o = bb.outcomes || null;
    if (o) {
      if (o.success) pushEdge(from, o.success, "success", "Success");
      if (o.failure) pushEdge(from, o.failure, "failure", "Failure");
    }

    var ch = Array.isArray(bb.choices) ? bb.choices : [];
    for (var ci = 0; ci < ch.length; ci++) {
      var choice = ch[ci];
      if (!choice) continue;
      if (choice.next) pushEdge(from, choice.next, "choice", choice.label || ("Choice " + String(ci + 1)));
      if (choice.failNext) pushEdge(from, choice.failNext, "choice_fail", (choice.label || ("Choice " + String(ci + 1))) + " (Fail)");
    }
  }

  // Root = first meaningful beat in authoring order (selected turn)
  var rootId = (beats[0] && beats[0].id) ? String(beats[0].id) : null;

  // Layout: tidy tree using leaf counts, with cycle guards
  var leafCount = {};
  var visiting = {};

  var countLeaves = function (id) {
    id = String(id || "");
    if (!id) return 1;
    if (leafCount[id] != null) return leafCount[id];
    if (visiting[id]) return 1;
    visiting[id] = true;
    var kids = adj[id] || [];
    if (!kids.length) {
      leafCount[id] = 1;
      visiting[id] = false;
      return 1;
    }
    var sum = 0;
    for (var k = 0; k < kids.length; k++) sum += countLeaves(kids[k]);
    leafCount[id] = Math.max(1, sum);
    visiting[id] = false;
    return leafCount[id];
  };

  if (rootId) countLeaves(rootId);

  // assign x positions by in-order leaves
  var assigned = {};
  var xPos = {};
  var yPos = {};
  var cursor = 0;

  var assign = function (id, depth) {
    id = String(id || "");
    if (!id) return;
    if (assigned[id]) return;
    assigned[id] = true;

    var kids = adj[id] || [];
    if (!kids.length) {
      var x = cursor;
      cursor += 1;
      xPos[id] = x;
      yPos[id] = depth;
      return;
    }

    // Ensure deterministic order based on authoring order
    kids = kids.slice();
    kids.sort(function (a, b) {
      var oa = 999999, ob = 999999;
      var ba = byId[a], bb2 = byId[b];
      if (ba && ba._order != null) oa = Number(ba._order);
      if (bb2 && bb2._order != null) ob = Number(bb2._order);
      if (oa < ob) return -1;
      if (oa > ob) return 1;
      return String(a).localeCompare(String(b));
    });

    for (var i2 = 0; i2 < kids.length; i2++) assign(kids[i2], depth + 1);

    // x is average of children's x
    var minx = Infinity, maxx = -Infinity;
    for (i2 = 0; i2 < kids.length; i2++) {
      var cx = xPos[kids[i2]];
      if (cx < minx) minx = cx;
      if (cx > maxx) maxx = cx;
    }
    if (!isFinite(minx) || !isFinite(maxx)) {
      xPos[id] = cursor;
      cursor += 1;
    } else {
      xPos[id] = (minx + maxx) / 2;
    }
    yPos[id] = depth;
  };

  // Stamp authoring order onto beats for stable sort above
  for (i = 0; i < beats.length; i++) {
    try { beats[i]._order = i; } catch (e) {}
  }

  if (rootId) assign(rootId, 0);

  // Build nodes list reachable from root (and keep root even if isolated)
  var reachable = {};
  var q = [];
  if (rootId) { reachable[rootId] = true; q.push(rootId); }
  while (q.length) {
    var cur = q.shift();
    var kids2 = adj[cur] || [];
    for (i = 0; i < kids2.length; i++) {
      var nx = kids2[i];
      if (reachable[nx]) continue;
      reachable[nx] = true;
      q.push(nx);
    }
  }

  var nodes = [];
  for (i = 0; i < beats.length; i++) {
    var b2 = beats[i];
    var id2 = String(b2.id);
    if (!reachable[id2]) continue;
    var tn2 = getTurn(b2);
    if (tn2 == null) tn2 = 1;
    nodes.push({
      id: id2,
      label: String(b2.label || b2.id || id2),
      type: String(b2.type || "custom"),
      timeScale: String(b2.timeScale || "scene"),
      turnNumber: tn2,
      isTravel: false,
      _order: i
    });
  }

  // Build pos in pixels (SPACING + READABILITY PASS)
  var NODE_W = 420;      // wider chips = less wrapping
  var NODE_H = 130;      // taller chips to allow 2–3 lines
  var PAD_X  = 140;
  var PAD_Y  = 90;
  var GAP_X  = 420;      // more horizontal breathing room
  var GAP_Y  = 400;      // THIS fixes vertical overlap

  var pos = {};
  var maxX = 0, maxY = 0;

  // center root in view: normalize x positions
  var minLeaf = Infinity, maxLeaf = -Infinity;
  for (var nid in xPos) {
    if (!Object.prototype.hasOwnProperty.call(xPos, nid)) continue;
    var xv = xPos[nid];
    if (xv < minLeaf) minLeaf = xv;
    if (xv > maxLeaf) maxLeaf = xv;
  }
  if (!isFinite(minLeaf)) minLeaf = 0;
  if (!isFinite(maxLeaf)) maxLeaf = 0;

  for (i = 0; i < nodes.length; i++) {
    var nid2 = nodes[i].id;
    var px = xPos[nid2];
    var py = yPos[nid2];
    if (px == null) px = 0;
    if (py == null) py = 0;

    var xPix = PAD_X + Math.floor((px - minLeaf) * GAP_X);
    var yPix = PAD_Y + Math.floor(py * GAP_Y);
    pos[nid2] = { x: xPix, y: yPix };
    if (xPix + NODE_W > maxX) maxX = xPix + NODE_W;
    if (yPix + NODE_H > maxY) maxY = yPix + NODE_H;
  }

  // Filter edges to reachable set
  var edgesOut = [];
  for (i = 0; i < edges.length; i++) {
    var e2 = edges[i];
    if (!reachable[e2.from] || !reachable[e2.to]) continue;
    edgesOut.push(e2);
  }

  return {
    v: 4,
    mode: "turnTree",
    turnNumber: selectedTurn,
    turns: turns,
    nodes: nodes,
    edges: edgesOut,
    pos: pos,
    size: { w: Math.max(1800, maxX + PAD_X), h: Math.max(1100, maxY + PAD_Y) },
    constants: { NODE_W: NODE_W, NODE_H: NODE_H },
    rootId: rootId
  };
}



function _svgEscape(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ---------------------------------------------------------------------------
// Engine table discovery: Travel Fiat Encounter Engine
// ---------------------------------------------------------------------------

function discoverEngineTables() {
  try {
    const out = [];
    const tEnc = game.bbttcc?.api?.travel?.__encounters;
    const tables = tEnc?.tables || null;

    if (tables && typeof tables === "object") {
      for (const [cat, list] of Object.entries(tables)) {
        if (!Array.isArray(list) || !list.length) continue;

        const id = `travel.${cat}`;
        const label = `Travel Table — ${String(cat).toUpperCase()}`;
        const entries = list
          .filter(e => e && e.key)
          .map(e => ({
            encounterKey: e.key,
            label: e.label || e.key,
            weight: Number(e.weight ?? 1) || 1,
            minTier: (e.minTier != null) ? Number(e.minTier) : null,
            maxTier: (e.maxTier != null) ? Number(e.maxTier) : null,
            terrains: Array.isArray(e.terrains) ? e.terrains.slice() : []
          }));

        out.push({ id, label, scope: "travel", tags: ["engine", "travel", String(cat)], kind: "travel-fiat", entries });
      }
    }

    out.sort((a, b) => String(a.label).localeCompare(String(b.label), game.i18n.lang));
    return out;
  } catch (e) {
    console.warn(TAG, "discoverEngineTables failed:", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export class BBTTCCCampaignBuilderApp extends Application {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-builder",
      title: "BBTTCC Campaign Builder",
      template: "modules/bbttcc-campaign/templates/campaign-builder.hbs",
      width: 1240,
      height: 820,
      resizable: true,
      popOut: true,
      classes: ["bbttcc-campaign-builder", "bbttcc-hexchrome"]
    });
  }

  constructor(options = {}) {
    super(options);
    this.campaignId = options.campaignId ?? null;
    this.tableId = options.tableId ?? null;

    // UI polish state (non-persistent)
    this.beatSearch = options.beatSearch ?? "";
    this.beatTypeFilter = options.beatTypeFilter ?? "all";
    this.beatTurnFilter = options.beatTurnFilter ?? "all"; // "all" | "unassigned" | "1" | "2" | ...

    // Quest filter (beats list)
    this.questFilter = options.questFilter ?? "all";     // "all" | questId
    this.questStatusFilter = options.questStatusFilter ?? "all"; // "all" | active | completed | archived
    this.questSearch = options.questSearch ?? "";

    // Flow Visualizer UI state (non-persistent)
    this.flowShowTravel = !!options.flowShowTravel;
    this.flowZoom = Number(options.flowZoom ?? 1) || 1;
    this.flowPan = { x: Number(options.flowPanX ?? 0) || 0, y: Number(options.flowPanY ?? 0) || 0 };
    this.flowTurn = (options.flowTurn != null) ? options.flowTurn : null;


    // NEW: Quest filter for Visualizer
    this.flowQuestId = options.flowQuestId ?? "all";

    // Debounced renders for text inputs (prevents focus loss while typing)
    this._renderDebounceTimers = {};
    this._pendingFocusRestore = null;


    // Main UI tab (non-persistent)
    this.mainTab = options.mainTab ?? "campaign";

    // Scroll state (non-persistent)
    this._scrollState = { beatsTop: 0, sidebarTop: 0, mainTop: 0, lastBeatId: null };

    // Travel tables UI state (non-persistent)
    this.travelTerrain = options.travelTerrain ?? "plains";
    this.travelTier = Number(options.travelTier ?? 1) || 1;
    this.travelPreview = options.travelPreview ?? null; // { key, label, category, source }

    this._boundOnBeatUpdated = this._onBeatUpdated.bind(this);
    Hooks.on("bbttcc-campaign:updateBeat", this._boundOnBeatUpdated);
  }

  _cleanupPortalLayer() {
    try {
      const layer = document.getElementById(PORTAL_LAYER_ID);
      if (layer) {
        // Restore any portaled nodes back into their owner details elements (if still present)
        layer.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => {
          const ownerId = pop.getAttribute("data-bbttcc-owner") || "";
          const owner = ownerId ? document.querySelector(`details.bbttcc-actions-menu[data-bbttcc-portal-id=\"${ownerId}\"]`) : null;
          if (owner) owner.appendChild(pop);
          pop.removeAttribute("data-bbttcc-portaled");
          pop.removeAttribute("data-bbttcc-owner");
          pop.style.position = "";
          pop.style.top = "";
          pop.style.left = "";
          pop.style.right = "";
          pop.style.bottom = "";
          pop.style.zIndex = "";
          pop.style.pointerEvents = "";
          pop.style.maxHeight = "";
          pop.style.overflow = "";
          pop.style.minWidth = "";
          pop.style.background = "";
          pop.style.border = "";
          pop.style.borderRadius = "";
          pop.style.boxShadow = "";
          pop.style.padding = "";
        });

        // If empty, remove it
        if (!layer.querySelector(".bbttcc-actions-menu-pop")) layer.remove();
      }
    } catch (_e) {}
  }

  close(options = {}) {
    Hooks.off("bbttcc-campaign:updateBeat", this._boundOnBeatUpdated);
    this._cleanupPortalLayer();
    return super.close(options);
  }

  async getData(options = {}) {
    const data = await super.getData(options);

    const api = game.bbttcc?.api?.campaign;
    if (!api) {
      console.warn(TAG, "Campaign API not available.");
      return {
        ...data,
        apiReady: false,
        campaigns: [],
        tables: [],
        engineTables: [],
        selectedCampaign: null,
        flowNodes: [],
        travelCats: TRAVEL_CATS,
        travelEngine: {},
        travelTables: {},
        travelTerrain: this.travelTerrain,
        travelTier: this.travelTier,
        travelPreview: this.travelPreview
      };
    }

    const campaigns = api.listCampaigns?.() ?? [];
    const tablesApi = api.tables;
    const tables = tablesApi?.listTables?.() ?? [];
    const engineTables = discoverEngineTables();

    const travelTableView = _filterTravelTables(tables, this.travelTerrain, this.travelTier);
    const travelTablesFiltered = travelTableView.filtered;
    const allTravelTables = travelTableView.all;

    const questsApi = api.quests;
    const quests = questsApi?.listQuests ? (questsApi.listQuests({ campaignId: this.campaignId, status: "all", search: "" }) || []) : [];
    const questsAll = Array.isArray(quests) ? quests : [];
    const questMap = {};
    for (const q of questsAll) {
      if (!q) continue;
      const id = String(q.id || "").trim();
      if (!id) continue;
      questMap[id] = { id, name: String(q.name || q.id || "").trim(), status: String(q.status || "active").trim() };
    }


    
    const listQuestsSafe = (opts) => {
      try { return questsApi?.listQuests ? (questsApi.listQuests(opts || {}) || []) : []; }
      catch (_e) { return []; }
    };

const activeCampaignId = _getActiveCampaignId();

    let selectedCampaign = null;
    if (this.campaignId) {
      selectedCampaign = campaigns.find(c => c.id === this.campaignId) ?? null;
    } else if (activeCampaignId) {
      selectedCampaign = campaigns.find(c => c.id === activeCampaignId) ?? null;
      if (selectedCampaign) this.campaignId = selectedCampaign.id;
    }

    if (!selectedCampaign) {
      selectedCampaign = campaigns[0] ?? null;
      if (selectedCampaign) this.campaignId = selectedCampaign.id;
    }

    const flowNodes = selectedCampaign ? buildFlowNodes(selectedCampaign) : [];

    const flowGraph = selectedCampaign ? _buildFlowGraph(selectedCampaign, { turn: this.flowTurn, questId: this.flowQuestId, showTravel: this.flowShowTravel }) : null;


    const beatTypes = selectedCampaign ? collectBeatTypes(selectedCampaign) : [];

    const beatTurnOptions = (() => {
      try {
        const beats = Array.isArray(selectedCampaign?.beats) ? selectedCampaign.beats : [];
        const set = new Set();
        for (const b of beats) {
          const tn = (b && b.turnNumber != null) ? Number(b.turnNumber) : null;
          if (isFinite(tn) && tn >= 1) set.add(Math.floor(tn));
        }
        return Array.from(set).sort((a, b) => a - b);
      } catch (_e) {
        return [];
      }
    })();

    const beatsFiltered = selectedCampaign
      ? filterBeats(selectedCampaign, this.beatSearch, this.beatTypeFilter, this.beatTurnFilter, this.questFilter, this.questStatusFilter, questMap)
      : [];


    // Enrich beat rows with quest labels/status for UI chips
    try {
      for (const row of beatsFiltered) {
        const qid = String(row?.beat?.questId || "").trim();
        if (qid && questMap[qid]) {
          row.questId = qid;
          row.questName = questMap[qid].name;
          row.questStatus = questMap[qid].status;
        } else {
          row.questId = qid || null;
          row.questName = null;
          row.questStatus = null;
        }
      }
    } catch (_eQRows) {}


    // Travel encounter catalog + current campaign config (campaign-scoped)
    const travelEngine = _getTravelEncounterEngineCatalog();
    const travelTables = selectedCampaign ? _readCampaignTravelTables(selectedCampaign) : {};


    // Quests (manager UI)
    const questsFiltered = (() => {
      const q = String(this.questSearch || "").trim();
      const st = String(this.questStatusFilter || "all");
      return listQuestsSafe({ campaignId: selectedCampaign?.id || null, status: st, search: q });
    })();


    return {
      ...data,
      apiReady: true,
      activeCampaignId: _getActiveCampaignId(),
      campaigns: campaigns.map(c => ({ ...c, isActive: String(c.id) === String(_getActiveCampaignId() || "") })),
      tables,
      engineTables,
      selectedCampaign,
      flowNodes,
      flowGraph,
      flowShowTravel: !!this.flowShowTravel,
      flowZoom: this.flowZoom,
      flowPanX: (this.flowPan && this.flowPan.x) ? this.flowPan.x : 0,
      flowPanY: (this.flowPan && this.flowPan.y) ? this.flowPan.y : 0,
      beatSearch: this.beatSearch,
      beatTypeFilter: this.beatTypeFilter,
      beatTurnFilter: this.beatTurnFilter,
      questFilter: this.questFilter,
      questStatusFilter: this.questStatusFilter,
      questSearch: this.questSearch,
      questsFiltered,
      questsAll: questsAll,

      mainTab: this.mainTab,
      beatTypes,
      beatTurnOptions,
      beatsFiltered,

      // Travel Tables UI
      travelCats: TRAVEL_CATS,
      travelEngine,
      travelTables,
      travelTerrain: this.travelTerrain,
      travelTier: this.travelTier,
      travelPreview: this.travelPreview,
      travelTablesFiltered,
      allTravelTables
    };
  }

  async _onBeatUpdated(payload) {
    try {
      const { campaignId, beat, prevBeatId } = payload || {};
      if (!campaignId || !beat) return;

      const api = game.bbttcc?.api?.campaign;
      if (!api?.getCampaign || !api?.saveCampaign) return;

      const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
      if (!campaign) return;

      const norm = s => String(s || "").trim();
      const nextId = norm(beat.id);
      const prevId = norm(prevBeatId);

      const beats = Array.isArray(campaign.beats) ? foundry.utils.deepClone(campaign.beats) : [];

      const rewriteRefs = (b) => {
        if (!prevId || !nextId || prevId === nextId) return;
        if (!b || typeof b !== "object") return;

        if (b.outcomes) {
          if (norm(b.outcomes.success) === prevId) b.outcomes.success = nextId;
          if (norm(b.outcomes.failure) === prevId) b.outcomes.failure = nextId;
        }

        if (Array.isArray(b.choices)) {
          for (const ch of b.choices) {
            if (!ch) continue;
            if (norm(ch.next) === prevId) ch.next = nextId;
            if (norm(ch.failNext) === prevId) ch.failNext = nextId;
          }
        }
      };

      let applied = false;
      if (prevId && prevId !== nextId) {
        const prevIdx = beats.findIndex(b => norm(b?.id) === prevId);
        const nextIdx = beats.findIndex(b => norm(b?.id) === nextId);

        for (const b of beats) rewriteRefs(b);

        if (nextIdx >= 0 && prevIdx >= 0 && nextIdx !== prevIdx) {
          beats[nextIdx] = foundry.utils.deepClone(beat);
          beats.splice(prevIdx, 1);
          applied = true;
        } else if (prevIdx >= 0) {
          beats[prevIdx] = foundry.utils.deepClone(beat);
          applied = true;
        }
      }

      if (!applied) {
        const idx = beats.findIndex(b => norm(b?.id) === nextId);
        if (idx >= 0) beats[idx] = foundry.utils.deepClone(beat);
        else beats.push(foundry.utils.deepClone(beat));
      }

      // Dedupe by id (preserve order)
      const out = [];
      const seen = new Set();
      for (const b of beats) {
        const id = norm(b?.id);
        if (!id) { out.push(b); continue; }
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(b);
      }

      campaign.beats = out;
      await api.saveCampaign(campaignId, campaign);

      if (this.campaignId === campaignId) {
        try { this._scrollState ||= {}; this._scrollState.lastBeatId = String(beat.id || prevBeatId || ""); } catch (e) {}
        try { this._captureScrollStateFromDom(); } catch (e) {}
        this.render(false);
      }
    } catch (err) {
      console.error(TAG, "Error handling beat update:", err);
    }
  }

  _loadCurrentCampaignClone() {
    const api = game.bbttcc?.api?.campaign;
    if (!api?.getCampaign) return null;
    if (!this.campaignId) return null;
    const c = api.getCampaign(this.campaignId);
    if (!c) return null;
    return foundry.utils.deepClone(c);
  }

  _requireApi() {
    const api = game.bbttcc?.api?.campaign;
    if (!api) {
      ui.notifications?.warn?.("Campaign API not ready.");
      return null;
    }
    return api;
  }

  
  async _openBeatEditor(campaignId, beat, activeTab) {
    try {
      if (!campaignId || !beat) return;
      const App = await _loadBeatEditorApp();
      if (!App) {
        ui.notifications?.error?.("Could not open Beat Editor (module failed to load). See console.");
        return;
      }
      new App({ campaignId, beat, activeTab: activeTab || "core" }).render(true);
    } catch (e) {
      console.error(TAG, "Failed to open Beat Editor:", e);
      ui.notifications?.error?.("Could not open Beat Editor. See console.");
    }
  }

  _ensureBeatShape(beat) {
    // Minimal safe beat stub; Beat Editor will fill defaults too.
    const b = foundry.utils.deepClone(beat || {});
    b.id = String(b.id || "").trim();
    b.label = String(b.label || b.id || "New Beat").trim();
    b.type = String(b.type || "custom").trim();
    b.timeScale = String(b.timeScale || "scene").trim();
    b.tags = String(b.tags || "").trim();
    b.politicalTags = String(b.politicalTags || "").trim();
    b.outcomes ??= { success: null, failure: null };
    b.inject ??= {};
    b.actors ??= [];
    b.choices ??= [];
    b.encounter ??= { key: "", tier: null, actorName: "" };
    b.worldEffects ??= { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "" };
    b.description = String(b.description || "").trim();
    return b;
  }


  _captureScrollStateFromDom() {
    try {
      const root = this.element;
      if (!root) return;
      const el = (root[0] instanceof HTMLElement) ? root[0] : root[0];
      if (!el) return;

      const sidebar = el.querySelector(".bbttcc-campaign-sidebar");
      const beatsScroll = el.querySelector("[data-role='beats-scroll']");
      const main = el.querySelector(".bbttcc-campaign-main");

      this._scrollState ||= { beatsTop: 0, sidebarTop: 0, mainTop: 0, lastBeatId: null };
      this._scrollState.sidebarTop = sidebar ? (sidebar.scrollTop || 0) : (this._scrollState.sidebarTop || 0);
      this._scrollState.beatsTop = beatsScroll ? (beatsScroll.scrollTop || 0) : (this._scrollState.beatsTop || 0);
      this._scrollState.mainTop = main ? (main.scrollTop || 0) : (this._scrollState.mainTop || 0);
    } catch (e) {}
  }

  _restoreScrollStateToDom() {
    try {
      const root = this.element;
      if (!root) return;
      const el = (root[0] instanceof HTMLElement) ? root[0] : root[0];
      if (!el) return;

      const sidebar = el.querySelector(".bbttcc-campaign-sidebar");
      const beatsScroll = el.querySelector("[data-role='beats-scroll']");
      const main = el.querySelector(".bbttcc-campaign-main");

      const st = this._scrollState || {};
      if (sidebar && Number.isFinite(st.sidebarTop)) sidebar.scrollTop = st.sidebarTop;
      if (beatsScroll && Number.isFinite(st.beatsTop)) beatsScroll.scrollTop = st.beatsTop;
      if (main && Number.isFinite(st.mainTop)) main.scrollTop = st.mainTop;

      // Optional: if we have a beat to focus, scroll it into view.
      if (st.lastBeatId && beatsScroll) {
        const row = beatsScroll.querySelector(`[data-beat-row-id="${CSS.escape(String(st.lastBeatId))}"]`);
        if (row && row.scrollIntoView) {
          row.scrollIntoView({ block: "center" });
        }
      }
    } catch (e) {}
  }

  // -----------------------------------------------------------------------
  // Flow Visualizer (Org Chart) — replaces the legacy Flow tab list
  // -----------------------------------------------------------------------
  _mountFlowVisualizer(rootEl) {
    try {
      if (!rootEl) return;

      const host = rootEl.querySelector("[data-role='flowviz']");
      if (!host) return;

      // Resolve the selected campaign directly from the Campaign API.
      // Do NOT rely on prior render context; tab switches can run before _lastContext is updated.
      const api = game.bbttcc && game.bbttcc.api ? game.bbttcc.api.campaign : null;
      const cid = String(this.campaignId || "").trim();
      const campaign = (api && cid && typeof api.getCampaign === "function") ? api.getCampaign(cid) : null;
      if (!campaign) {
        host.innerHTML = "<p class='bbttcc-muted'>No campaign selected.</p>";
        return;
      }

      // Turn/Chapter decision-tree visualizer. Default = latest turn with content.
      const graph = _buildFlowGraph(campaign, { turn: this.flowTurn, questId: this.flowQuestId, showTravel: this.flowShowTravel });
      if (!graph || !graph.nodes || !graph.nodes.length) {
        host.innerHTML = "<p class='bbttcc-muted'>No beats to visualize.</p>";
        return;
      }

      // Keep local state in sync (graph decides the fallback).
      try { this.flowTurn = graph.turnNumber; } catch (e) {}

      // Clear previous render
      host.innerHTML = "";
      try { if (!host.style.minHeight) host.style.minHeight = "720px"; } catch (e) {}

      // Inject a compact Turn selector bar (no template changes required).
      try {
        const bar = document.createElement("div");
        bar.className = "bbttcc-flowviz-bar";
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.justifyContent = "space-between";
        bar.style.gap = "12px";
        bar.style.padding = "6px 8px";
        bar.style.margin = "0 0 8px 0";
        bar.style.border = "1px solid rgba(148,163,184,0.22)";
        bar.style.borderRadius = "10px";
        bar.style.background = "rgba(2,6,23,0.25)";

        const left = document.createElement("div");
        left.style.display = "flex";
        left.style.alignItems = "center";
        left.style.gap = "10px";

        const lbl = document.createElement("div");
        lbl.style.fontWeight = "800";
        lbl.style.opacity = "0.75";
        lbl.textContent = "Turn";

        const sel = document.createElement("select");
        sel.style.padding = "4px 8px";
        sel.style.borderRadius = "8px";
        sel.style.border = "1px solid rgba(148,163,184,0.25)";
        sel.style.background = "rgba(15,23,42,0.35)";
        sel.style.color = "rgba(255,255,255,0.92)";

        const turns = Array.isArray(graph.turns) && graph.turns.length ? graph.turns : [graph.turnNumber || 1];

        // "All" (no turn filter)
        const optAll = document.createElement("option");
        optAll.value = "all";
        optAll.textContent = "All Turns";
        if (this.flowTurn == null) optAll.selected = true;
        sel.appendChild(optAll);

        for (let ti = 0; ti < turns.length; ti++) {
          const opt = document.createElement("option");
          opt.value = String(turns[ti]);
          opt.textContent = "Turn " + String(turns[ti]);
          if (this.flowTurn != null && String(turns[ti]) === String(graph.turnNumber || 1)) opt.selected = true;
          sel.appendChild(opt);
        }

        sel.addEventListener("change", (ev) => {
          try {
            const raw = String(ev.target.value || "").trim();
            if (raw === "all") this.flowTurn = null;
            else {
              const v = Number(raw);
              if (isFinite(v) && v >= 1) this.flowTurn = Math.floor(v);
            }
          } catch (e2) { this.flowTurn = null; }
          this._flowResetView();
          this.render(false);
        });

        // Quest filter
        const qLbl = document.createElement("div");
        qLbl.style.fontWeight = "800";
        qLbl.style.opacity = "0.75";
        qLbl.textContent = "Quest";

        const qSel = document.createElement("select");
        qSel.style.padding = "4px 8px";
        qSel.style.borderRadius = "8px";
        qSel.style.border = "1px solid rgba(148,163,184,0.25)";
        qSel.style.background = "rgba(15,23,42,0.35)";
        qSel.style.color = "rgba(255,255,255,0.92)";

        const optQAll = document.createElement("option");
        optQAll.value = "all";
        optQAll.textContent = "All Quests";
        if (!this.flowQuestId || String(this.flowQuestId) === "all") optQAll.selected = true;
        qSel.appendChild(optQAll);

        try {
          const qapi = game.bbttcc?.api?.campaign?.quests;
          const qs = qapi?.listQuests ? (qapi.listQuests({ campaignId: campaign.id, status: "all", search: "" }) || []) : [];
          const arr = Array.isArray(qs) ? qs.slice() : [];
          arr.sort((a,b)=>String(a.name||a.id||"").localeCompare(String(b.name||b.id||""), game.i18n.lang));
          for (let qi=0; qi<arr.length; qi++) {
            const q = arr[qi];
            if (!q || !q.id) continue;
            const o = document.createElement("option");
            o.value = String(q.id);
            o.textContent = String(q.name || q.id);
            if (String(this.flowQuestId || "all") === String(q.id)) o.selected = true;
            qSel.appendChild(o);
          }
        } catch (_eQ) {}

        qSel.addEventListener("change", (ev) => {
          this.flowQuestId = String(ev.target.value || "all");
          this._flowResetView();
          this.render(false);
        });

        left.appendChild(lbl);
        left.appendChild(sel);
        left.appendChild(qLbl);
        left.appendChild(qSel);
        bar.appendChild(left);

        const right = document.createElement("div");
        right.style.display = "flex";
        right.style.alignItems = "center";
        right.style.gap = "8px";

        const hint = document.createElement("div");
        hint.style.opacity = "0.55";
        hint.style.fontSize = "12px";
        hint.textContent = "Flow map (includes cinematics; optional filters)";
        right.appendChild(hint);
        bar.appendChild(right);

        host.appendChild(bar);
      } catch (eBar) {}


      // Auto-center root beat when the view is in its default state.
      // Keeps zoom buttons useful and avoids inconsistent renders across resizes.
      try {
        const z0 = Number(this.flowZoom || 1) || 1;
        const p0x = (this.flowPan && Number.isFinite(this.flowPan.x)) ? this.flowPan.x : 0;
        const p0y = (this.flowPan && Number.isFinite(this.flowPan.y)) ? this.flowPan.y : 0;
        const isDefaultView = (Math.abs(z0 - 1) < 0.001) && (p0x === 0) && (p0y === 0);

        if (isDefaultView && graph && graph.rootId && graph.pos && graph.pos[graph.rootId]) {
          // Favor readable chips over full-fit. We center root slightly right of center (accounts for sidebar),
          // and near the top quarter.
          const rootPos = graph.pos[graph.rootId];
          const rw = graph.constants.NODE_W;
          const rh = graph.constants.NODE_H;

          // Default zoom: readable; can be adjusted by buttons.
          this.flowZoom = 1.20;

          // Pan will be refined after svg mounts (needs host rect), so store a "pending center" marker.
          this.__bbttccFlowPendingCenter = {
            x: rootPos.x + (rw / 2),
            y: rootPos.y + (rh / 2)
          };
        }
      } catch (_eAuto) {}
      // (SVG will mount below the bar)

      // Controls summary (small)
      const meta = document.createElement("div");
      meta.className = "bbttcc-muted";
      meta.style.margin = "0 0 6px 0";
      meta.style.fontSize = "12px";
      meta.innerHTML =
        "<span><b>" + String(graph.nodes.length) + "</b> nodes</span>" +
        " <span class='bbttcc-inline-separator'>·</span> " +
        "<span><b>" + String(graph.edges.length) + "</b> links</span>" +
        (this.flowShowTravel ? " <span class='bbttcc-inline-separator'>·</span> <span>Travel lane: <b>shown</b></span>" : "");
      host.appendChild(meta);

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", "100%");
      // Use available panel height (keeps the visualizer big and readable)
      let hostRect = null;
      try { hostRect = host.getBoundingClientRect(); } catch (_eH) { hostRect = null; }
      const panelH = hostRect && hostRect.height ? Math.floor(hostRect.height) : 720;
      const svgH = Math.max(640, Math.min(1400, panelH)); // clamp to sane bounds
      svg.setAttribute("height", String(svgH));
      svg.setAttribute("viewBox", `0 0 ${graph.size.w} ${graph.size.h}`);
      svg.style.border = "1px solid rgba(148,163,184,0.18)";
      svg.style.borderRadius = "14px";
      svg.style.background = "rgba(2,6,23,0.25)";
      svg.style.cursor = "grab";
      svg.style.userSelect = "none";

      // Background rect for panning
      const bg = document.createElementNS(svgNS, "rect");
      bg.setAttribute("x", "0");
      bg.setAttribute("y", "0");
      bg.setAttribute("width", String(graph.size.w));
      bg.setAttribute("height", String(graph.size.h));
      bg.setAttribute("fill", "transparent");
      svg.appendChild(bg);

      const g = document.createElementNS(svgNS, "g");
      svg.appendChild(g);

      // Apply pan/zoom
      const applyTransform = () => {
        const z = Number(this.flowZoom || 1) || 1;
        const px = (this.flowPan && Number.isFinite(this.flowPan.x)) ? this.flowPan.x : 0;
        const py = (this.flowPan && Number.isFinite(this.flowPan.y)) ? this.flowPan.y : 0;
        g.setAttribute("transform", `translate(${px} ${py}) scale(${z})`);
      };
      applyTransform();

      // Auto-fit on first open (only if user hasn't panned/zoomed yet)
      try {
        const z0 = Number(this.flowZoom || 1) || 1;
        const p0x = (this.flowPan && Number.isFinite(this.flowPan.x)) ? this.flowPan.x : 0;
        const p0y = (this.flowPan && Number.isFinite(this.flowPan.y)) ? this.flowPan.y : 0;
        const isDefaultView = (Math.abs(z0 - 1) < 0.001) && (p0x === 0) && (p0y === 0);

        if (isDefaultView) {
          let hostRect2 = null;
          try { hostRect2 = host.getBoundingClientRect(); } catch (_eFit) { hostRect2 = null; }
          const availW = hostRect2 && hostRect2.width ? Math.floor(hostRect2.width) : 980;
          const availH = hostRect2 && hostRect2.height ? Math.floor(hostRect2.height) : 720;

          const fitW = availW * 0.92;
          const fitH = availH * 0.86;

          const zFit = Math.max(0.6, Math.min(1.8, Math.min(fitW / graph.size.w, fitH / graph.size.h)));
          this.flowZoom = Math.round(zFit * 100) / 100;

          // Center graph in viewport
          const px = Math.floor((availW - (graph.size.w * this.flowZoom)) / 2);
          const py = Math.floor((availH - (graph.size.h * this.flowZoom)) / 2);
          this.flowPan = { x: px, y: py };
          applyTransform();
        }
      } catch (_eAutoFit) {}

      // Marker defs
      const defs = document.createElementNS(svgNS, "defs");
      const mkMarker = (id, color) => {
        const m = document.createElementNS(svgNS, "marker");
        m.setAttribute("id", id);
        m.setAttribute("markerWidth", "10");
        m.setAttribute("markerHeight", "10");
        m.setAttribute("refX", "9");
        m.setAttribute("refY", "3");
        m.setAttribute("orient", "auto");
        const p = document.createElementNS(svgNS, "path");
        p.setAttribute("d", "M0,0 L9,3 L0,6 Z");
        p.setAttribute("fill", color);
        m.appendChild(p);
        return m;
      };
      defs.appendChild(mkMarker("bbttcc-arrow", "rgba(148,163,184,0.55)"));
      defs.appendChild(mkMarker("bbttcc-arrow-success", "rgba(34,197,94,0.65)"));
      defs.appendChild(mkMarker("bbttcc-arrow-failure", "rgba(239,68,68,0.65)"));
      svg.appendChild(defs);

      const NODE_W = graph.constants.NODE_W;
      const NODE_H = graph.constants.NODE_H;

      const nodeById = {};
      for (const b of (campaign.beats || [])) nodeById[String(b.id)] = b;

      // Draw edges first (under nodes)
      for (const e of graph.edges) {
        const a = graph.pos[e.from];
        const b = graph.pos[e.to];
        if (!a || !b) continue;

        const x1 = a.x + (NODE_W / 2);
        const y1 = a.y + NODE_H;
        const x2 = b.x + (NODE_W / 2);
        const y2 = b.y;

        const dy = Math.max(60, (y2 - y1) * 0.55);
        const c1x = x1;
        const c1y = y1 + dy;
        const c2x = x2;
        const c2y = y2 - dy;

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
        path.setAttribute("fill", "none");

        let stroke = "rgba(148,163,184,0.35)";
        let marker = "url(#bbttcc-arrow)";
        let dash = "";

        if (e.kind === "success") { stroke = "rgba(34,197,94,0.45)"; marker = "url(#bbttcc-arrow-success)"; }
        else if (e.kind === "failure") { stroke = "rgba(239,68,68,0.45)"; marker = "url(#bbttcc-arrow-failure)"; }
        else if (e.kind === "choice_fail") { dash = "6 5"; stroke = "rgba(239,68,68,0.30)"; marker = "url(#bbttcc-arrow)"; }
        else if (e.kind === "choice") { dash = "6 5"; stroke = "rgba(148,163,184,0.30)"; marker = "url(#bbttcc-arrow)"; }

        path.setAttribute("stroke", stroke);
        path.setAttribute("stroke-width", "2");
        if (dash) path.setAttribute("stroke-dasharray", dash);
        path.setAttribute("marker-end", marker);

        // Tooltip
        const t = document.createElementNS(svgNS, "title");
        t.textContent = `${e.label || e.kind}: ${e.from} → ${e.to}`;
        path.appendChild(t);

        g.appendChild(path);
      }

      // Draw nodes
      for (const n of graph.nodes) {
        const p = graph.pos[n.id];
        if (!p) continue;

        const node = document.createElementNS(svgNS, "g");
        node.setAttribute("data-beat-id", n.id);
        node.style.cursor = "pointer";

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", String(p.x));
        rect.setAttribute("y", String(p.y));
        rect.setAttribute("rx", "14");
        rect.setAttribute("ry", "14");
        rect.setAttribute("width", String(NODE_W));
        rect.setAttribute("height", String(NODE_H));

        // Styling by type/timeScale
        let fill = "rgba(15,23,42,0.55)";
        let stroke = "rgba(148,163,184,0.28)";
        if (n.isTravel) { fill = "rgba(30,41,59,0.55)"; stroke = "rgba(56,189,248,0.30)"; }
        if (String(n.type) === "encounter") { stroke = "rgba(245,158,11,0.35)"; }
        if (String(n.type) === "cinematic") { stroke = "rgba(168,85,247,0.40)"; }

        rect.setAttribute("fill", fill);
        rect.setAttribute("stroke", stroke);
        rect.setAttribute("stroke-width", "2");

        node.appendChild(rect);

        // Top line: label (truncate)
        const label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", String(p.x + 12));
        label.setAttribute("y", String(p.y + 28));
        label.setAttribute("fill", "rgba(255,255,255,0.92)");
        label.setAttribute("font-size", "15");
        label.setAttribute("font-weight", "700");
        const lbl = n.label.length > 34 ? (n.label.slice(0, 34) + "…") : n.label;
        label.textContent = lbl;
        node.appendChild(label);

        // Second line: id
        const sub = document.createElementNS(svgNS, "text");
        sub.setAttribute("x", String(p.x + 12));
        sub.setAttribute("y", String(p.y + 50));
        sub.setAttribute("fill", "rgba(255,255,255,0.70)");
        sub.setAttribute("font-size", "11");
        sub.textContent = n.id;
        node.appendChild(sub);

        // Badges (type, turn, LEG)
        const badge = (text, bx, by, w, color) => {
          const r = document.createElementNS(svgNS, "rect");
          r.setAttribute("x", String(bx));
          r.setAttribute("y", String(by));
          r.setAttribute("rx", "10");
          r.setAttribute("ry", "10");
          r.setAttribute("width", String(w));
          r.setAttribute("height", "20");
          r.setAttribute("fill", color);
          r.setAttribute("stroke", "rgba(255,255,255,0.10)");
          const t = document.createElementNS(svgNS, "text");
          t.setAttribute("x", String(bx + 10));
          t.setAttribute("y", String(by + 14));
          t.setAttribute("fill", "rgba(255,255,255,0.92)");
          t.setAttribute("font-size", "11");
          t.setAttribute("font-weight", "700");
          t.textContent = text;
          node.appendChild(r);
          node.appendChild(t);
        };

        // Right-aligned badges (INSET for breathing room)
        const by = p.y + 10;
        const BADGE_INSET = 50; // tweak freely
        let bx = p.x + NODE_W - BADGE_INSET;

        // Type badge
        const tText = String(n.type || "custom").toUpperCase();
        const tw = Math.max(54, Math.min(96, 10 + (tText.length * 7)));
        bx -= tw;
        badge(tText, bx, by, tw, "rgba(148,163,184,0.18)");
        bx -= 8;

        // Turn badge (optional)
        if (n.turnNumber) {
          const tt = "T" + String(n.turnNumber);
          const w = 38;
          bx -= w;
          badge(tt, bx, by, w, "rgba(34,197,94,0.18)");
          bx -= 8;
        }

        // LEG badge for travel
        if (n.isTravel) {
          const w = 46;
          bx -= w;
          badge("LEG", bx, by, w, "rgba(56,189,248,0.18)");
        }

        // Tooltip
        const title = document.createElementNS(svgNS, "title");
        title.textContent =
          `${n.label}\n` +
          `id: ${n.id}\n` +
          `type: ${n.type}\n` +
          `timeScale: ${n.timeScale}\n` +
          (n.turnNumber ? `turn: ${n.turnNumber}\n` : "") +
          (n.isTravel ? "travel: yes\n" : "travel: no\n");
        node.appendChild(title);

        // Click handler -> open beat editor
        node.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const beat = nodeById[n.id];
          if (!beat) return;
          this._openBeatEditor(campaign.id, this._ensureBeatShape(beat), "core");
        });

        g.appendChild(node);
      }


      // ---------------------------
      // Thread Index Panel (right side, 4 columns)
      // ---------------------------
      try {
        if (graph && graph.threadBuckets && graph.panelWidth) {
          const PANEL_MARGIN = 60;
          const colGap = 24;
          const colW = 190;

          const panelX = (graph.size.w - graph.panelWidth) + PANEL_MARGIN;
          const panelY = 70;

          const drawText = (txt, x, y, size, weight, opacity) => {
            const t = document.createElementNS(svgNS, "text");
            t.setAttribute("x", String(x));
            t.setAttribute("y", String(y));
            t.setAttribute("fill", `rgba(255,255,255,${opacity})`);
            t.setAttribute("font-size", String(size));
            t.setAttribute("font-weight", String(weight));
            t.textContent = txt;
            return t;
          };

          const drawChip = (beat, x, y) => {
            const gg = document.createElementNS(svgNS, "g");
            gg.style.cursor = "pointer";

            const r = document.createElementNS(svgNS, "rect");
            r.setAttribute("x", String(x));
            r.setAttribute("y", String(y));
            r.setAttribute("rx", "10");
            r.setAttribute("ry", "10");
            r.setAttribute("width", String(colW));
            r.setAttribute("height", "34");
            r.setAttribute("fill", "rgba(15,23,42,0.35)");
            r.setAttribute("stroke", "rgba(148,163,184,0.18)");
            r.setAttribute("stroke-width", "1");
            gg.appendChild(r);

            const label = String(beat.label || beat.id || "").trim();
            const text = label.length > 18 ? (label.slice(0, 18) + "…") : label;

            const t = document.createElementNS(svgNS, "text");
            t.setAttribute("x", String(x + 8));
            t.setAttribute("y", String(y + 13));
            t.setAttribute("fill", "rgba(255,255,255,0.86)");
            t.setAttribute("font-size", "11");
            t.setAttribute("font-weight", "700");
            t.textContent = text;
            gg.appendChild(t);

            const idt = document.createElementNS(svgNS, "text");
            idt.setAttribute("x", String(x + 8));
            idt.setAttribute("y", String(y + 27));
            idt.setAttribute("fill", "rgba(255,255,255,0.62)");
            idt.setAttribute("font-size", "9.5");
            idt.textContent = String(beat.id || "");
            gg.appendChild(idt);

            const title = document.createElementNS(svgNS, "title");
            title.textContent = `${label}\n${beat.id}\n(${beat.type || "custom"})`;
            gg.appendChild(title);

            gg.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const full = nodeById[String(beat.id)] || null;
              if (!full) return;
              this._openBeatEditor(campaign.id, this._ensureBeatShape(full), "core");
            });

            return gg;
          };

          const buckets = [graph.threadBuckets.a, graph.threadBuckets.c, graph.threadBuckets.d, graph.threadBuckets.e];
          for (let bi = 0; bi < buckets.length; bi++) {
            const buck = buckets[bi];
            const x = panelX + bi * (colW + colGap);
            let y = panelY;

            g.appendChild(drawText(buck.label, x, y, 13, 800, 0.45));
            y += 22;

            const beats = Array.isArray(buck.beats) ? buck.beats : [];
            for (let ri = 0; ri < beats.length; ri++) {
              g.appendChild(drawChip(beats[ri], x, y));
              y += 40;
              if (ri > 30) break;
            }
          }

          const sep = document.createElementNS(svgNS, "rect");
          sep.setAttribute("x", String(panelX - 26));
          sep.setAttribute("y", "40");
          sep.setAttribute("width", "2");
          sep.setAttribute("height", String(graph.size.h - 80));
          sep.setAttribute("fill", "rgba(148,163,184,0.18)");
          g.appendChild(sep);
        }
      } catch (_ePanel) {}
      // Pan interaction
      let dragging = false;
      let start = { x: 0, y: 0, px: 0, py: 0 };

      const onDown = (ev) => {
        // Only pan when background is grabbed (not node clicks)
        if (ev && ev.target && ev.target.closest && ev.target.closest("g[data-beat-id]")) return;
        dragging = true;
        svg.style.cursor = "grabbing";
        const px = (this.flowPan && Number.isFinite(this.flowPan.x)) ? this.flowPan.x : 0;
        const py = (this.flowPan && Number.isFinite(this.flowPan.y)) ? this.flowPan.y : 0;
        start = { x: ev.clientX, y: ev.clientY, px, py };
      };

      const onMove = (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        this.flowPan = { x: start.px + dx, y: start.py + dy };
        applyTransform();
      };

      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        svg.style.cursor = "grab";
      };

      bg.addEventListener("mousedown", onDown);
      svg.addEventListener("mousemove", onMove);
      svg.addEventListener("mouseup", onUp);
      svg.addEventListener("mouseleave", onUp);


      // If we have a pending center target, compute pan based on host dimensions.
      try {
        const pend = this.__bbttccFlowPendingCenter;
        if (pend && pend.x != null && pend.y != null) {
          let hostRect2 = null;
          try { hostRect2 = host.getBoundingClientRect(); } catch (_eR) { hostRect2 = null; }

          const vw = hostRect2 && hostRect2.width ? hostRect2.width : 980;
          const vh = hostRect2 && hostRect2.height ? hostRect2.height : 720;

          const z = Number(this.flowZoom || 1) || 1;
          const targetCX = vw * 0.52;
          const targetCY = vh * 0.26;

          this.flowPan = {
            x: Math.floor(targetCX - (pend.x * z)),
            y: Math.floor(targetCY - (pend.y * z))
          };
          // clear and apply
          this.__bbttccFlowPendingCenter = null;
          applyTransform();
        }
      } catch (_eC) {}
      host.appendChild(svg);
    } catch (e) {
      console.warn(TAG, "Flow visualizer render failed:", e);
      try {
        const host = rootEl.querySelector("[data-role='flowviz']");
        if (host) host.innerHTML = "<p class='bbttcc-muted'>Visualizer error — see console.</p>";
      } catch (_e2) {}
    }
  }

  _flowZoomBy(delta) {
    const z = Number(this.flowZoom || 1) || 1;
    const next = Math.max(0.4, Math.min(2.5, z + delta));
    this.flowZoom = Math.round(next * 100) / 100;
  }

  _flowResetView() {
    this.flowZoom = 1;
    this.flowPan = { x: 0, y: 0 };
  }

  // -----------------------------------------------------------------------
  // Render debounce + focus preservation (prevents cursor drop while typing)
  // -----------------------------------------------------------------------
  _scheduleRerender(key, opts) {
    try {
      opts = opts || {};
      const delay = (opts.delay == null) ? 140 : Number(opts.delay) || 0;

      // Focus restore seed (optional)
      if (opts.focusEl) {
        try {
          const el = opts.focusEl;
          const act = el?.dataset?.action || el?.getAttribute?.("data-action") || null;
          this._pendingFocusRestore = {
            action: act,
            name: el?.getAttribute?.("name") || null,
            role: el?.getAttribute?.("data-role") || null,
            start: (typeof el.selectionStart === "number") ? el.selectionStart : null,
            end: (typeof el.selectionEnd === "number") ? el.selectionEnd : null
          };
        } catch (_eF) {}
      }

      this._renderDebounceTimers ||= {};
      if (this._renderDebounceTimers[key]) clearTimeout(this._renderDebounceTimers[key]);

      this._renderDebounceTimers[key] = setTimeout(() => {
        this._renderDebounceTimers[key] = null;
        this.render(false);
      }, Math.max(0, delay));
    } catch (_e) {
      this.render(false);
    }
  }

  _restorePendingFocus(rootEl) {
    try {
      const st = this._pendingFocusRestore;
      if (!st) return;
      const root = rootEl || (this.element && this.element[0]) || null;
      if (!root) return;

      let sel = null;
      if (st.action) sel = `[data-action="${CSS.escape(String(st.action))}"]`;
      else if (st.role) sel = `[data-role="${CSS.escape(String(st.role))}"]`;
      else if (st.name) sel = `[name="${CSS.escape(String(st.name))}"]`;
      if (!sel) return;

      const el = root.querySelector(sel);
      if (!el || typeof el.focus !== "function") return;

      el.focus();
      if (st.start != null && st.end != null && typeof el.setSelectionRange === "function") {
        el.setSelectionRange(st.start, st.end);
      }
      this._pendingFocusRestore = null;
    } catch (_e) {}
  }

  _applyStretchLayout(rootEl) {
    try {
      if (!rootEl) return;

      const wc = rootEl.querySelector(".window-content");
      if (wc) {
        wc.style.overflow = "hidden";
        wc.style.width = "100%";
        wc.style.height = "100%";
      }

      const appRoot = rootEl.querySelector(".bbttcc-campaign-builder-root");
      if (appRoot) {
        appRoot.style.width = "100%";
        appRoot.style.height = "100%";
        appRoot.style.maxWidth = "none";
      }

      const layout = rootEl.querySelector(".bbttcc-campaign-layout");
      const sidebar = rootEl.querySelector(".bbttcc-campaign-sidebar");
      const main = rootEl.querySelector(".bbttcc-campaign-main");
      if (layout && sidebar && main) {
        layout.style.display = "flex";
        layout.style.width = "100%";
        layout.style.height = "100%";
        layout.style.maxWidth = "none";
        layout.style.gap = "12px";

        sidebar.style.height = "100%";
        sidebar.style.overflow = "auto";

        main.style.flex = "1 1 auto";
        main.style.minWidth = "0";
        main.style.width = "100%";
        main.style.height = "100%";
        main.style.overflow = "hidden";
      }

      // Active panel should fill main
      const activePanel = rootEl.querySelector(".bbttcc-campaign-main > section[data-main-tab]:not(.is-hidden)");
      if (activePanel) {
        activePanel.style.width = "100%";
        activePanel.style.height = "100%";
        // do not force overflow; template handles it
      }

      // Visualizer host fills available panel space
      const flowHost = rootEl.querySelector("[data-role='flowviz']");
      if (flowHost) {
        flowHost.style.width = "100%";
        flowHost.style.maxWidth = "none";
      }
    } catch (_e) {}
  }

// -----------------------------------------------------------------------
// Campaign I/O Controls (Export/Import/Remap)
// - Injects a small "Bundles" card into the sidebar (no template edits).
// - Uses game.bbttcc.api.campaign.io (module.js) to do the heavy lifting.
// -----------------------------------------------------------------------
_ensureCampaignIOControls(rootEl) {
  try {
    if (!rootEl) return;
    if (rootEl.querySelector("[data-bbttcc-campaign-io='1']")) return;

    var sidebar = rootEl.querySelector(".bbttcc-campaign-sidebar") || rootEl.querySelector(".sidebar") || null;
    if (!sidebar) return;

    var card = document.createElement("section");
    card.className = "bbttcc-card bbttcc-campaign-io";
    card.setAttribute("data-bbttcc-campaign-io", "1");
    card.style.marginBottom = "12px";

    card.innerHTML = `
      <header class="bbttcc-card__head" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
        <div>
          <div class="bbttcc-card__title">Bundles</div>
          <div class="bbttcc-muted" style="opacity:.8; font-size:.85rem;">Export / import campaigns via compendium Journal Entries.</div>
        </div>
      </header>
      <div class="bbttcc-card__body" style="display:flex; flex-direction:column; gap:.5rem;">
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button type="button" class="bbttcc-button" data-action="io-export"><i class="fas fa-upload"></i> Export</button>
          <button type="button" class="bbttcc-button" data-action="io-import"><i class="fas fa-download"></i> Import</button>
          <button type="button" class="bbttcc-button" data-action="io-remap"><i class="fas fa-link"></i> Remap</button>
        </div>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button type="button" class="bbttcc-button" data-action="io-scan-keys"><i class="fas fa-tags"></i> Key Report</button>
        </div>
        <div class="bbttcc-muted" style="font-size:.8rem; opacity:.75;">
          Uses <code>flags.bbttcc.key</code> on Scenes/Actors/Journals to remap references after import.
        </div>
      </div>
    `;

    // Insert near the top of the sidebar, after the campaign list header if possible.
    var anchor =
      sidebar.querySelector(".bbttcc-card") ||
      sidebar.firstElementChild ||
      null;
    if (anchor && anchor.parentElement === sidebar) sidebar.insertBefore(card, anchor);
    else sidebar.prepend(card);
  } catch (_e) {}
}

async _ioExportDialog() {
  const api = this._requireApi(); if (!api) return;
  const io = api.io;
  if (!io || !io.listJournalPacks) return ui.notifications?.warn?.("Campaign I/O API not available (campaign.io).");

  const packs = io.listJournalPacks();
  if (!packs.length) {
    ui.notifications?.warn?.("No JournalEntry compendium packs found. Create a compendium (type JournalEntry) first.");
    return;
  }

  const campaigns = api.listCampaigns ? api.listCampaigns() : [];
  const cid = String(this.campaignId || (campaigns[0] && campaigns[0].id) || "").trim();
  if (!cid) return ui.notifications?.warn?.("No campaign selected.");

  const packOpts = packs.map(p => `<option value="${_escapeHtml(p.id)}">${_escapeHtml(p.label)}${p.locked ? " (locked)" : ""}</option>`).join("");
  const campOpts = campaigns.map(c => `<option value="${_escapeHtml(c.id)}" ${String(c.id)===cid ? "selected" : ""}>${_escapeHtml(c.label || c.id)}</option>`).join("");

  const content = `
    <form class="bbttcc-io-form">
      <div class="form-group">
        <label>Campaign</label>
        <select name="campaignId">${campOpts}</select>
      </div>
      <div class="form-group">
        <label>Target Compendium (JournalEntry)</label>
        <select name="packId">${packOpts}</select>
        <p class="notes">Pack must be unlocked.</p>
      </div>
      <div class="form-group">
        <label>Entry Name (optional)</label>
        <input type="text" name="entryName" placeholder="Campaign Bundle — …" />
      </div>
      <hr/>
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" name="includeTables" checked />
        <span>Include Random Encounter Tables (global)</span>
      </label>
      <label style="display:flex; align-items:center; gap:8px; margin-top:6px;">
        <input type="checkbox" name="includeQuests" checked />
        <span>Include Quest Registry (definitions)</span>
      </label>
      <label style="display:flex; align-items:center; gap:8px; margin-top:6px;">
        <input type="checkbox" name="scrubExternalRefs" />
        <span>Scrub world-specific references (scenes/actors/journals)</span>
      </label>
      <p class="notes">If you keep refs, import + Remap will try to fix them using <code>flags.bbttcc.key</code>.</p>
    </form>
  `;

  const payload = await Dialog.prompt({
    title: "Export Campaign Bundle",
    content: content,
    label: "Export",
    callback: (html) => {
      const f = html[0].querySelector("form.bbttcc-io-form");
      const fd = new FormData(f);
      return {
        campaignId: String(fd.get("campaignId") || "").trim(),
        packId: String(fd.get("packId") || "").trim(),
        entryName: String(fd.get("entryName") || "").trim(),
        includeTables: !!fd.get("includeTables"),
        includeQuests: !!fd.get("includeQuests"),
        scrubExternalRefs: !!fd.get("scrubExternalRefs")
      };
    }
  });

  if (!payload || !payload.campaignId || !payload.packId) return;

  try {
    const res = await io.exportBundleToCompendium(payload);
    ui.notifications?.info?.(`Exported bundle: ${res.campaignLabel} → ${res.entryName}`);
  } catch (e) {
    console.error(TAG, "Export failed:", e);
    ui.notifications?.error?.("Export failed (see console).");
  }
}

async _ioImportDialog() {
  const api = this._requireApi(); if (!api) return;
  const io = api.io;
  if (!io || !io.listJournalPacks) return ui.notifications?.warn?.("Campaign I/O API not available (campaign.io).");

  const packs = io.listJournalPacks();
  if (!packs.length) {
    ui.notifications?.warn?.("No JournalEntry compendium packs found. Create a compendium (type JournalEntry) first.");
    return;
  }

  const packOpts = packs.map(p => `<option value="${_escapeHtml(p.id)}">${_escapeHtml(p.label)}</option>`).join("");

  const content = `
    <form class="bbttcc-io-form">
      <div class="form-group">
        <label>Source Compendium (JournalEntry)</label>
        <select name="packId">${packOpts}</select>
      </div>
      <div class="form-group">
        <label>Entry</label>
        <select name="entryId"><option value="">(Loading…)</option></select>
        <button type="button" class="bbttcc-button" data-action="io-refresh-entries" style="margin-top:6px;">
          <i class="fas fa-rotate"></i> Refresh Entries
        </button>
        <p class="notes">Only entries with <code>flags["bbttcc-campaign"].export</code> are usable.</p>
      </div>
      <hr/>
      <div class="form-group">
        <label>Import Mode</label>
        <select name="mode">
          <option value="merge" selected>Merge (overwrite same campaign id)</option>
          <option value="duplicate">Duplicate (new campaign id)</option>
        </select>
      </div>
      <div class="form-group">
        <label>ID Prefix (for Duplicate)</label>
        <input type="text" name="idPrefix" placeholder="import_01_" />
      </div>
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" name="setActive" />
        <span>Set imported campaign as Active</span>
      </label>
    </form>
  `;

  // Helper: robustly read export payload from a JournalEntry document.
  const _getExportFlag = (doc) => {
    try {
      if (doc && typeof doc.getFlag === "function") {
        const v = doc.getFlag("bbttcc-campaign", "export");
        if (v) return v;
      }
    } catch (_e1) {}

    try {
      const f = doc && doc.flags ? doc.flags : null;
      const mod = f ? (f["bbttcc-campaign"] || null) : null;
      const ex = mod ? (mod.export || null) : null;
      if (ex) return ex;
    } catch (_e2) {}

    return null;
  };

  // Helper: scan a pack for usable bundle entries.
  const _scanPackForBundles = async (packId) => {
    const out = [];
    const pack = game.packs.get(String(packId || ""));
    if (!pack) return out;

    // This is the same path your console probe used successfully: getDocuments().
    const docs = await pack.getDocuments();
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const ex = _getExportFlag(doc);
      if (!ex) continue;

      const kind = String(ex.kind || "").trim();
      const looksLikeBundle =
        (kind === "bbttcc-campaign-bundle") ||
        (!!ex.campaign && !!String(ex.campaignId || ex.campaignLabel || "").trim());

      if (!looksLikeBundle) continue;

      out.push({
        id: doc.id,
        name: doc.name,
        campaignLabel: ex.campaignLabel || ex.campaignId || ""
      });
    }

    out.sort((a, b) => String(a.name).localeCompare(String(b.name), game.i18n.lang));
    return out;
  };

  const dlg = new Dialog({
    title: "Import Campaign Bundle",
    content: content,
    buttons: {
      import: {
        icon: '<i class="fas fa-download"></i>',
        label: "Import",
        callback: async (html) => {
          try {
            const f = html[0].querySelector("form.bbttcc-io-form");
            const fd = new FormData(f);
            const packId = String(fd.get("packId") || "").trim();
            const entryId = String(fd.get("entryId") || "").trim();
            const mode = String(fd.get("mode") || "merge").trim();
            const idPrefix = String(fd.get("idPrefix") || "").trim();
            const setActive = !!fd.get("setActive");

            if (!packId || !entryId) {
              ui.notifications?.warn?.("Pick a pack and entry first.");
              return;
            }

            const res = await io.importBundleFromCompendium({ packId, entryId, mode, idPrefix, setActive });

            ui.notifications?.info?.(`Imported campaign: ${res.label} (${res.campaignId})`);
            this.campaignId = res.campaignId;
            this.render(false);

            try {
              const u = res?.remap?.unresolved || [];
              if (u.length) {
                console.warn(TAG, "Remap unresolved refs:", u);
                ui.notifications?.warn?.(`Imported, but ${u.length} references could not be remapped. See console.`);
              }
            } catch (_eU) {}
          } catch (e) {
            console.error(TAG, "Import failed:", e);
            ui.notifications?.error?.("Import failed (see console).");
          }
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "import",
    render: (html) => {
      // Use raw DOM binding (more reliable than jQuery .on in some AppV1 Dialog contexts)
      const root = html && html[0] ? html[0] : null;
      if (!root) return;

      const packSel = root.querySelector("select[name='packId']");
      const entrySel = root.querySelector("select[name='entryId']");
      const refreshBtn = root.querySelector("[data-action='io-refresh-entries']");

      const setEntryOptions = (items) => {
        if (!entrySel) return;
        entrySel.innerHTML = "";
        if (!items || !items.length) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "(No BBTTCC bundles in this pack)";
          entrySel.appendChild(opt);
          return;
        }
        for (let i = 0; i < items.length; i++) {
          const u = items[i];
          const opt = document.createElement("option");
          opt.value = u.id;
          opt.textContent = `${u.name}${u.campaignLabel ? " — " + u.campaignLabel : ""}`;
          entrySel.appendChild(opt);
        }
      };

      const refresh = async () => {
        try {
          const packId = packSel ? String(packSel.value || "").trim() : "";
          if (!packId) { setEntryOptions([]); return; }

          const usable = await _scanPackForBundles(packId);
          setEntryOptions(usable);

          // Tiny debug breadcrumb (shows up in console so we can prove refresh ran)
          console.log(TAG, "I/O import refresh", { packId, found: usable.length });
        } catch (e) {
          console.warn(TAG, "Refresh entries failed:", e);
          ui.notifications?.warn?.("Could not load entries (see console).");
          setEntryOptions([]);
        }
      };

      if (refreshBtn && !refreshBtn.__bbttccBound) {
        refreshBtn.__bbttccBound = true;
        refreshBtn.addEventListener("click", (ev) => { ev.preventDefault(); refresh(); });
      }
      if (packSel && !packSel.__bbttccBound) {
        packSel.__bbttccBound = true;
        packSel.addEventListener("change", () => refresh());
      }

      // Initial populate (next tick to ensure DOM is ready)
      setTimeout(() => { refresh(); }, 0);
    }
  });

  dlg.render(true);
}

async _ioRemapDialog() {
  const api = this._requireApi(); if (!api) return;
  const io = api.io;
  if (!io || !io.remapCampaignReferences) return ui.notifications?.warn?.("Campaign I/O API not available (campaign.io).");

  const campaigns = api.listCampaigns ? api.listCampaigns() : [];
  const cid = String(this.campaignId || (campaigns[0] && campaigns[0].id) || "").trim();
  if (!cid) return ui.notifications?.warn?.("No campaign selected.");

  const campOpts = campaigns.map(c => `<option value="${_escapeHtml(c.id)}" ${String(c.id)===cid ? "selected" : ""}>${_escapeHtml(c.label || c.id)}</option>`).join("");

  const content = `
    <form class="bbttcc-io-form">
      <div class="form-group">
        <label>Campaign</label>
        <select name="campaignId">${campOpts}</select>
      </div>
      <p class="notes">Remap fixes missing Scene/Actor/Journal references using <code>flags.bbttcc.key</code> stored in <code>beat.refs</code>.</p>
    </form>
  `;

  const payload = await Dialog.prompt({
    title: "Remap Campaign References",
    content,
    label: "Remap",
    callback: (html) => {
      const f = html[0].querySelector("form.bbttcc-io-form");
      const fd = new FormData(f);
      return { campaignId: String(fd.get("campaignId") || "").trim() };
    }
  });

  if (!payload || !payload.campaignId) return;

  try {
    const res = await io.remapCampaignReferences(payload.campaignId, { dryRun: false });
    const n = (res && res.changes) ? res.changes.length : 0;
    ui.notifications?.info?.(`Remap complete: ${n} updates applied.`);
    if (res && res.unresolved && res.unresolved.length) {
      console.warn(TAG, "Remap unresolved refs:", res.unresolved);
      ui.notifications?.warn?.(`Remap could not resolve ${res.unresolved.length} refs. See console.`);
    }
    this.render(false);
  } catch (e) {
    console.error(TAG, "Remap failed:", e);
    ui.notifications?.error?.("Remap failed (see console).");
  }
}

async _ioScanKeysDialog() {
  const api = this._requireApi(); if (!api) return;
  const io = api.io;
  if (!io || !io.scanStableKeysReport) return ui.notifications?.warn?.("Campaign I/O API not available (campaign.io).");

  try {
    const rep = io.scanStableKeysReport();
    console.log(TAG, "Stable Key Report:", rep);

    const fmt = (arr) => {
      arr = Array.isArray(arr) ? arr : [];
      if (!arr.length) return "<div class='bbttcc-muted' style='opacity:.7;'>None</div>";
      return "<ul style='margin:.25rem 0 .5rem 1.1rem;'>" + arr.slice(0, 20).map(r => `<li><b>${_escapeHtml(r.name)}</b> <code>${_escapeHtml(r.id)}</code></li>`).join("") + (arr.length > 20 ? `<li class="bbttcc-muted">(+${arr.length - 20} more… see console)</li>` : "") + "</ul>";
    };

    const content = `
      <div>
        <p><b>Stable Key Report</b></p>
        <p class="bbttcc-muted" style="opacity:.8;">Set <code>flags.bbttcc.key</code> on any Scene/Actor/Journal you reference in beats to enable remap after import.</p>
        <hr/>
        <h4>Scenes missing keys (${(rep.scenes.missing || []).length})</h4>
        ${fmt(rep.scenes.missing)}
        <h4>Actors missing keys (${(rep.actors.missing || []).length})</h4>
        ${fmt(rep.actors.missing)}
        <h4>Journals missing keys (${(rep.journals.missing || []).length})</h4>
        ${fmt(rep.journals.missing)}
        <hr/>
        <div class="bbttcc-muted" style="opacity:.8;">Full report printed to console.</div>
      </div>
    `;

    new Dialog({ title: "BBTTCC Stable Keys", content: content, buttons: { ok: { label: "OK" } }, default: "ok" }).render(true);
  } catch (e) {
    console.error(TAG, "Key report failed:", e);
    ui.notifications?.warn?.("Key report failed (see console).");
  }
}

activateListeners(html) {
    super.activateListeners(html);

    // Main panel tabs (Campaign / Travel / Beats / Flow)
    html.find("[data-action='main-tab']").on("click", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget?.dataset?.tab;
      if (!tab) return;
      try { this._captureScrollStateFromDom(); } catch (e) {}
      this.mainTab = String(tab);
      // When switching away from Beats, don't force-scroll to a beat row.
      if (this.mainTab !== "beats") { try { if (this._scrollState) this._scrollState.lastBeatId = null; } catch (e) {} }
      this.render(false);
    });

    const rootEl = html[0];

    // Ensure the app stretches to use the full window width/height (Dashboard-style)
    try { this._applyStretchLayout(rootEl); } catch (_e) {}

    // Restore scroll + focus (prevents beats list jumping to top on refresh)
    try { setTimeout(() => { this._restoreScrollStateToDom(); this._restorePendingFocus(rootEl); }, 0); } catch (_eS) {}


// Campaign I/O controls (Bundles)
// Current template already renders these buttons directly.
// Bind against the live template buttons instead of the old injected sidebar card.
try {
  const bindDirect = (sel, fn) => {
    html.find(sel).off("click.bbttccio").on("click.bbttccio", (ev) => {
      ev.preventDefault();
      fn.call(this);
    });
  };

  bindDirect("[data-action='io-export']", this._ioExportDialog);
  bindDirect("[data-action='io-import']", this._ioImportDialog);
  bindDirect("[data-action='io-remap']", this._ioRemapDialog);
  bindDirect("[data-action='io-scan-keys']", this._ioScanKeysDialog);
} catch (_e2) {}


    // ---------------------------
    // Flow Visualizer controls
    // ---------------------------
    html.find("[data-action='flow-toggle-travel']").on("click", ev => {
      ev.preventDefault();
      this.flowShowTravel = !this.flowShowTravel;
      this.render(false);
    });

    html.find("[data-action='flow-zoom-in']").on("click", ev => {
      ev.preventDefault();
      this._flowZoomBy(+0.15);
      this.render(false);
    });

    html.find("[data-action='flow-zoom-out']").on("click", ev => {
      ev.preventDefault();
      this._flowZoomBy(-0.15);
      this.render(false);
    });

    html.find("[data-action='flow-reset']").on("click", ev => {
      ev.preventDefault();
      this._flowResetView();
      this.render(false);
    });



    // ---------------------------
    // Beats filter (UI polish)
    // ---------------------------

    html.find("[data-action='beats-search']").on("input", ev => {
      this.beatSearch = String(ev.currentTarget?.value ?? "");
      this._scheduleRerender("beats-search", { focusEl: ev.currentTarget, delay: 140 });
    });

    html.find("[data-action='beats-type']").on("change", ev => {
      this.beatTypeFilter = String(ev.currentTarget?.value ?? "all");
      this.render(false);
    });

    html.find("[data-action='beats-turn']").on("change", ev => {
      this.beatTurnFilter = String(ev.currentTarget?.value ?? "all");
      this.render(false);
    });


    // Beats quest filters
    html.find("[data-action='beats-quest']").on("change", ev => {
      this.questFilter = String(ev.currentTarget?.value ?? "all");
      this.render(false);
    });
    html.find("[data-action='beats-quest-status']").on("change", ev => {
      this.questStatusFilter = String(ev.currentTarget?.value ?? "all");
      this.render(false);
    });


    // ---------------------------
    // Encounter Tables (Random Encounter Tables UI) — existing
    // ---------------------------

    html.find("[data-action='new-table']").on("click", async ev => {
      ev.preventDefault();
      const api = this._requireApi(); if (!api) return;
      const tablesApi = api.tables;
      if (!tablesApi?.createTable) return ui.notifications?.warn?.("Encounter Tables API not ready.");

      const id = `table_${randomID()}`;
      const label = await Dialog.prompt({
        title: "New Encounter Table",
        content: `
          <p>Create a new Random Encounter Table. Tables select beats; beats run normally.</p>
          <div class="form-group">
            <label>Label</label>
            <input type="text" name="label" value="New Table (${id.slice(0, 8)})" />
          </div>
        `,
        label: "Create",
        callback: html => html.find("input[name='label']")[0]?.value || `New Table (${id.slice(0, 8)})`
      });

      await tablesApi.createTable(id, { id, label, scope: "global", tags: [], entries: [] });
      await _openTableEditor(id);
      this.render();
    });


    html.find("[data-action='new-travel-table']").on("click", async ev => {
      ev.preventDefault();
      const api = this._requireApi(); if (!api) return;
      const tablesApi = api.tables;
      if (!tablesApi?.createTable) return ui.notifications?.warn?.("Encounter Tables API not ready.");

      const terrain = String(rootEl.querySelector(`[data-role="travel-terrain"]`)?.value || this.travelTerrain || "plains").trim().toLowerCase();
      const tier = Number(rootEl.querySelector(`[data-role="travel-tier"]`)?.value || this.travelTier || 1) || 1;
      const baseId = `travel_${terrain}_t${tier}`;
      const labelDefault = `Travel ${terrain.charAt(0).toUpperCase() + terrain.slice(1)} Tier ${tier}`;

      const payload = await Dialog.prompt({
        title: "New Travel Table",
        content: `
          <p>Create a new travel encounter table for the current filter.</p>
          <div class="form-group">
            <label>Table ID</label>
            <input type="text" name="id" value="${baseId}" />
          </div>
          <div class="form-group">
            <label>Label</label>
            <input type="text" name="label" value="${labelDefault}" />
          </div>
        `,
        label: "Create",
        callback: html => ({
          id: String(html.find("input[name='id']")[0]?.value || baseId).trim(),
          label: String(html.find("input[name='label']")[0]?.value || labelDefault).trim()
        })
      });

      const id = String(payload?.id || "").trim();
      if (!id) return ui.notifications?.warn?.("Travel table id is required.");
      if (tablesApi.getTable?.(id)) return ui.notifications?.warn?.(`A table with id '${id}' already exists.`);

      const label = String(payload?.label || labelDefault).trim() || id;
      await tablesApi.createTable(id, { id, label, scope: "travel", tags: ["travel", terrain, `tier${tier}`], entries: [] });
      await _openTableEditor(id);
      this.render(false);
    });

    html.find("[data-action='duplicate-table']").on("click", async ev => {
      ev.preventDefault();
      const tableId = ev.currentTarget?.dataset?.tableId;
      if (!tableId) return;

      const api = this._requireApi(); if (!api) return;
      const tablesApi = api.tables;
      if (!tablesApi?.getTable || !tablesApi?.createTable) return ui.notifications?.warn?.("Encounter Tables API not ready.");

      const src = foundry.utils.deepClone(tablesApi.getTable(tableId));
      if (!src) return ui.notifications?.warn?.("Table not found.");

      const suggestedId = `${String(src.id || "table")}_copy_${randomID().slice(0,4)}`;
      const suggestedLabel = `${String(src.label || src.id || "Table")} (Copy)`;

      const payload = await Dialog.prompt({
        title: "Duplicate Table",
        content: `
          <div class="form-group">
            <label>New Table ID</label>
            <input type="text" name="id" value="${_escapeHtml(suggestedId)}" />
          </div>
          <div class="form-group">
            <label>Label</label>
            <input type="text" name="label" value="${_escapeHtml(suggestedLabel)}" />
          </div>
        `,
        label: "Duplicate",
        callback: html => ({
          id: String(html.find("input[name='id']")[0]?.value || suggestedId).trim(),
          label: String(html.find("input[name='label']")[0]?.value || suggestedLabel).trim()
        })
      });

      const newId = String(payload?.id || "").trim();
      if (!newId) return ui.notifications?.warn?.("New table id is required.");
      if (tablesApi.getTable?.(newId)) return ui.notifications?.warn?.(`A table with id '${newId}' already exists.`);

      src.id = newId;
      src.label = String(payload?.label || suggestedLabel).trim() || newId;
      await tablesApi.createTable(newId, src);
      ui.notifications?.info?.("Encounter Table duplicated.");
      this.render(false);
    });

    html.find("[data-action='edit-table']").on("click", async ev => {
      ev.preventDefault();
      const tableId = ev.currentTarget?.dataset?.tableId;
      if (!tableId) return;
      await _openTableEditor(tableId);
    });

    html.find("[data-action='delete-table']").on("click", async ev => {
      ev.preventDefault();
      const tableId = ev.currentTarget?.dataset?.tableId;
      if (!tableId) return;

      const api = this._requireApi(); if (!api) return;
      const tablesApi = api.tables;
      if (!tablesApi?.deleteTable) return;

      const yes = await Dialog.confirm({
        title: "Delete Encounter Table?",
        content: `<p>Delete table <strong>${_escapeHtml(tableId)}</strong>? This cannot be undone.</p>`
      });
      if (!yes) return;

      await tablesApi.deleteTable(tableId);
      ui.notifications?.info?.("Encounter Table deleted.");
      this.render();
    });

    // ---------------------------
    // NEW: Campaign-Scoped Travel Encounter Tables UI
    // ---------------------------

    const saveCampaign = async (campaign) => {
      const api = this._requireApi(); if (!api) return;
      if (!api.saveCampaign) throw new Error("Campaign API saveCampaign not available.");
      await api.saveCampaign(campaign.id, campaign);
    };

    html.find("[data-action='travel-add']").on("click", async (ev) => {
      ev.preventDefault();
      const cat = ev.currentTarget?.dataset?.cat;
      if (!cat) return;
      const campaign = this._loadCurrentCampaignClone();
      if (!campaign) return;

      const select = rootEl.querySelector(`select[data-role="travel-pick"][data-cat="${cat}"]`);
      const key = String(select?.value || "").trim();
      if (!key) return ui.notifications?.warn?.("Pick an encounter key first.");

      const current = _readCampaignTravelTables(campaign);
      current[cat] ??= [];
      if (!current[cat].includes(key)) current[cat].push(key);

      _writeCampaignTravelTables(campaign, current);
      await saveCampaign(campaign);

      ui.notifications?.info?.(`Added ${key} to Travel ${cat} table.`);
      this.render(false);
    });

    html.find("[data-action='travel-remove']").on("click", async (ev) => {
      ev.preventDefault();
      const cat = ev.currentTarget?.dataset?.cat;
      const key = ev.currentTarget?.dataset?.key;
      if (!cat || !key) return;

      const campaign = this._loadCurrentCampaignClone();
      if (!campaign) return;

      const current = _readCampaignTravelTables(campaign);
      current[cat] = (current[cat] || []).filter(k => String(k) !== String(key));

      _writeCampaignTravelTables(campaign, current);
      await saveCampaign(campaign);

      this.render(false);
    });

    html.find("[data-action='travel-clear-cat']").on("click", async (ev) => {
      ev.preventDefault();
      const cat = ev.currentTarget?.dataset?.cat;
      if (!cat) return;

      const yes = await Dialog.confirm({
        title: "Clear Travel Category?",
        content: `<p>Clear the <strong>${_escapeHtml(cat)}</strong> travel encounter list for this campaign?</p>`
      });
      if (!yes) return;

      const campaign = this._loadCurrentCampaignClone();
      if (!campaign) return;

      const current = _readCampaignTravelTables(campaign);
      current[cat] = [];

      _writeCampaignTravelTables(campaign, current);
      await saveCampaign(campaign);

      ui.notifications?.info?.(`Cleared Travel ${cat} list.`);
      this.render(false);
    });

    html.find("[data-role='travel-terrain']").on("change", ev => {
      this.travelTerrain = String(ev.currentTarget?.value || "").trim().toLowerCase();
      this.render(false);
    });

    html.find("[data-role='travel-tier']").on("change", ev => {
      this.travelTier = Number(ev.currentTarget?.value || 0) || 0;
      this.render(false);
    });

    html.find("[data-action='travel-show-all']").on("click", ev => {
      ev.preventDefault();
      this.travelTerrain = "";
      this.travelTier = 0;
      this.render(false);
    });

    html.find("[data-action='travel-clone-cat']").on("click", async (ev) => {
      ev.preventDefault();
      const cat = ev.currentTarget?.dataset?.cat;
      if (!cat) return;

      const engine = _getTravelEncounterEngineCatalog();
      const list = (engine[cat] || []).map(e => String(e.key)).filter(Boolean);
      if (!list.length) return ui.notifications?.warn?.(`No engine entries found for ${cat}.`);

      const campaign = this._loadCurrentCampaignClone();
      if (!campaign) return;

      const current = _readCampaignTravelTables(campaign);
      current[cat] = list;

      _writeCampaignTravelTables(campaign, current);
      await saveCampaign(campaign);

      ui.notifications?.info?.(`Cloned engine defaults into Travel ${cat}.`);
      this.render(false);
    });

    html.find("[data-action='travel-preview']").on("click", async (ev) => {
      ev.preventDefault();
      const campaignId = this.campaignId || _getActiveCampaignId();
      if (!campaignId) return ui.notifications?.warn?.("Select a campaign first.");

      // Soft Guard (Option A):
      // Campaign Builder "Preview" should NOT surface engine travel encounters unless the campaign
      // has explicitly configured Travel Tables for at least one category.
      const campaign = this._loadCurrentCampaignClone();
      if (!campaign) return ui.notifications?.warn?.("Campaign not found.");

      const cfg = _readCampaignTravelTables(campaign);
      const hasAny =
        (cfg && typeof cfg === "object") &&
        Object.values(cfg).some(arr => Array.isArray(arr) && arr.length > 0);

      if (!hasAny) {
        this.travelPreview = null;
        ui.notifications?.info?.("No Travel Tables are active for this campaign. Add entries (or Clone Engine Defaults) in the Travel tab.");
        this.render(false);
        return;
      }

      const tier = Number(rootEl.querySelector(`[data-role="travel-tier"]`)?.value || 1) || 1;
      const terrain = String(rootEl.querySelector(`[data-role="travel-terrain"]`)?.value || "plains");

      this.travelTier = tier;
      this.travelTerrain = terrain;

      const enc = game.bbttcc?.api?.travel?.__encounters;
      if (!enc?.rollEncounter) return ui.notifications?.warn?.("Fiat Encounter Engine not installed (travel.__encounters.rollEncounter missing).");

      const res = enc.rollEncounter(tier, { stepCtx: { terrain, campaignId } });
      this.travelPreview = res ? { key: res.key, label: res.label, category: res.category, source: res.source } : null;

      if (res?.label) ui.notifications?.info?.(`Preview: ${res.label}`);
      this.render(false);
    });

    // ---------------------------
    // Campaign list/actions (RESTORED)
    // ---------------------------

    html.find("[data-action='set-active-campaign']").on("click", async ev => {
      ev.preventDefault();
      const id = ev.currentTarget?.dataset?.campaignId;
      if (!id) return;
      await _setActiveCampaignId(id);
      this.campaignId = id;
      ui.notifications?.info?.("Active campaign set.");
      this.render();
    });

    html.find("[data-action='select-campaign']").on("click", ev => {
      const id = ev.currentTarget?.dataset?.campaignId;
      if (!id) return;
      this.campaignId = id;
      this.render();
    });

    html.find("[data-action='new-campaign']").on("click", async ev => {
      ev.preventDefault();
      const api = this._requireApi(); if (!api) return;
      if (!api.createCampaign) return ui.notifications?.warn?.("Campaign API missing createCampaign().");

      const id = randomID();

      const factions = _listFactionActors();
      const factionOptions = [
        `<option value="">(None)</option>`,
        ...factions.map(f => `<option value="${_escapeHtml(f.uuid)}">${_escapeHtml(f.name)}</option>`)
      ].join("");

      const payload = await Dialog.prompt({
        title: "New Campaign",
        content: `
          <p>Create a new BBTTCC campaign.</p>
          <div class="form-group">
            <label>Label</label>
            <input type="text" name="label" value="New Campaign (${id.slice(0, 4)})" />
          </div>
          <div class="form-group">
            <label>Default Faction (for inherited world effects)</label>
            <select name="factionId">
              ${factionOptions}
            </select>
          </div>
        `,
        label: "Create",
        callback: html => {
          const label = html.find("input[name='label']")[0]?.value || `New Campaign (${id.slice(0, 4)})`;
          const factionId = html.find("select[name='factionId']")[0]?.value || "";
          return { label, factionId };
        }
      });

      const label = payload?.label ?? `New Campaign (${id.slice(0, 4)})`;
      const factionId = String(payload?.factionId || "").trim() || null;

      const campaign = await api.createCampaign(id, { id, label, description: "", beats: [], factionId });
      this.campaignId = campaign.id;

      await _setActiveCampaignId(campaign.id);
      this.render();
    });

    html.find("[data-action='delete-campaign']").on("click", async ev => {
      ev.preventDefault();
      const id = ev.currentTarget?.dataset?.campaignId;
      if (!id) return;

      const api = this._requireApi(); if (!api) return;
      if (!api.deleteCampaign) return ui.notifications?.warn?.("Campaign API missing deleteCampaign().");

      const yes = await Dialog.confirm({
        title: "Delete Campaign?",
        content: `<p>Delete campaign <strong>${_escapeHtml(id)}</strong>? This cannot be undone.</p>`
      });
      if (!yes) return;

      await api.deleteCampaign(id);
      ui.notifications?.info?.("Campaign deleted.");
      if (this.campaignId === id) this.campaignId = null;
      this.render();
    });

    html.find("[data-action='run-campaign']").on("click", async ev => {
      ev.preventDefault();
      const id = ev.currentTarget?.dataset?.campaignId;
      if (!id) return;

      const api = this._requireApi(); if (!api) return;
      if (!api.runCampaign) {
        ui.notifications?.warn?.("Campaign API missing runCampaign(); use Run First Beat instead.");
        return;
      }
      await api.runCampaign(id);
    });

    html.find("[data-action='run-first-beat']").on("click", async ev => {
      ev.preventDefault();
      const campaignId = ev.currentTarget?.dataset?.campaignId;
      if (!campaignId) return;

      const api = this._requireApi(); if (!api) return;
      const c = api.getCampaign ? api.getCampaign(campaignId) : null;
      const first = c?.beats?.[0]?.id;
      if (!first) return ui.notifications?.warn?.("Campaign has no beats.");
      if (!api.runBeat) return ui.notifications?.warn?.("Campaign API missing runBeat().");

      await api.runBeat(campaignId, first);
    });

    html.find("[data-action='save-campaign-meta']").on("click", async ev => {
      ev.preventDefault();
      const id = ev.currentTarget?.dataset?.campaignId;
      if (!id) return;

      const api = this._requireApi(); if (!api) return;
      if (!api.getCampaign || !api.saveCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign/saveCampaign.");

      const campaign = foundry.utils.deepClone(api.getCampaign(id));
      if (!campaign) return;

      const factions = _listFactionActors();
      const factionOptions = [
        `<option value="">(None)</option>`,
        ...factions.map(f => `<option value="${_escapeHtml(f.uuid)}" ${String(campaign.factionId||"")===String(f.uuid) ? "selected" : ""}>${_escapeHtml(f.name)}</option>`)
      ].join("");

      const activeId = _getActiveCampaignId();
      const isActive = String(activeId || "") === String(campaign.id || "");

      const payload = await Dialog.prompt({
        title: "Campaign Settings",
        content: `
          <p>Adjust campaign label/description, default faction (used for inherited world effects), and set the Active campaign.</p>
          <div class="form-group">
            <label>Label</label>
            <input type="text" name="label" value="${_escapeHtml(campaign.label || campaign.id)}" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="4">${_escapeHtml(campaign.description || "")}</textarea>
          </div>
          <div class="form-group">
            <label>Default Faction</label>
            <select name="factionId">${factionOptions}</select>
            <p class="notes">Auto-fills World Effects faction targets when blank.</p>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" name="active" ${isActive ? "checked" : ""} />
              <span>Set as Active Campaign</span>
            </label>
          </div>
        `,
        label: "Save",
        callback: html => {
          const label = html.find("input[name='label']")[0]?.value || campaign.label || campaign.id;
          const description = html.find("textarea[name='description']")[0]?.value || "";
          const factionId = html.find("select[name='factionId']")[0]?.value || "";
          const active = !!html.find("input[name='active']")[0]?.checked;
        
  return { label, description, factionId, active };
        }
      });

      const oldFaction = String(campaign.factionId || "").trim();
      const nextFaction = String(payload?.factionId || "").trim();

      campaign.label = String(payload?.label || campaign.label || campaign.id);
      campaign.description = String(payload?.description || "");

      if (nextFaction !== oldFaction) {
        campaign.factionId = nextFaction || null;
        _propagateCampaignFactionToBeats(campaign, oldFaction, nextFaction);
      }

      await api.saveCampaign(id, campaign);
      if (payload?.active) await _setActiveCampaignId(id);

      ui.notifications?.info?.("Campaign settings saved.");
      this.campaignId = id;
      this.render();
    });


    // ---------------------------
    // Quests (Quest Manager)
    // ---------------------------

    const _questApi = () => {
      const api = this._requireApi(); if (!api) return null;
      return api.quests || null;
    };

    const _questEditDialog = async (quest) => {
      const q = quest || { id: "", name: "", description: "", status: "active" };
      const isNew = !q.id;

      const idDefault = isNew ? ("quest_" + randomID()) : String(q.id || "");
      const nameDefault = String(q.name || q.id || idDefault);
      const descDefault = String(q.description || "");
      const statusDefault = String(q.status || "active");

      const payload = await Dialog.prompt({
        title: isNew ? "New Quest" : "Edit Quest",
        content: `
          <div class="form-group">
            <label>Quest ID</label>
            <input type="text" name="qid" value="${_escapeHtml(idDefault)}" ${isNew ? "" : "disabled"} />
            <p class="notes">Stable key used by beats (<code>beat.questId</code>).</p>
          </div>
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${_escapeHtml(nameDefault)}" />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="status">
              <option value="active" ${statusDefault==="active"?"selected":""}>active</option>
              <option value="completed" ${statusDefault==="completed"?"selected":""}>completed</option>
              <option value="archived" ${statusDefault==="archived"?"selected":""}>archived</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="desc" rows="4">${_escapeHtml(descDefault)}</textarea>
          </div>
        `,
        label: "Save",
        callback: (html) => {
          const qid = html.find("input[name='qid']")[0]?.value || idDefault;
          const name = html.find("input[name='name']")[0]?.value || nameDefault;
          const status = html.find("select[name='status']")[0]?.value || statusDefault;
          const description = html.find("textarea[name='desc']")[0]?.value || "";
          return { id: String(qid||"").trim(), name: String(name||"").trim(), status: String(status||"active").trim(), description: String(description||"") };
        }
      });

      return payload || null;
    };

    html.find("[data-action='new-quest']").on("click", async (ev) => {
      ev.preventDefault();
      const qapi = _questApi(); if (!qapi) return ui.notifications?.warn?.("Quest API not ready.");
      const payload = await _questEditDialog(null);
      if (!payload || !payload.id) return;
      await qapi.createQuest(payload.id, { ...payload, campaignId: this.campaignId || null });
      ui.notifications?.info?.("Quest created.");
      this.render(false);
    });

    html.find("[data-action='edit-quest']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      if (!qid) return;
      const qapi = _questApi(); if (!qapi) return;
      const cur = qapi.getQuest ? qapi.getQuest(qid) : null;
      const payload = await _questEditDialog(cur);
      if (!payload || !payload.id) return;
      await qapi.saveQuest(payload.id, { ...(cur||{}), ...payload, campaignId: (cur && cur.campaignId) ? cur.campaignId : (this.campaignId || null) });
      ui.notifications?.info?.("Quest saved.");
      this.render(false);
    });

    html.find("[data-action='complete-quest']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      if (!qid) return;
      const qapi = _questApi(); if (!qapi) return;
      await qapi.setQuestStatus(qid, "completed");
      ui.notifications?.info?.("Quest marked completed.");
      this.render(false);
    });

    html.find("[data-action='reopen-quest']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      if (!qid) return;
      const qapi = _questApi(); if (!qapi) return;
      await qapi.setQuestStatus(qid, "active");
      ui.notifications?.info?.("Quest reopened.");
      this.render(false);
    });

    html.find("[data-action='archive-quest']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      if (!qid) return;
      const qapi = _questApi(); if (!qapi) return;
      await qapi.setQuestStatus(qid, "archived");
      ui.notifications?.info?.("Quest archived.");
      this.render(false);
    });

    html.find("[data-action='delete-quest']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      if (!qid) return;
      const qapi = _questApi(); if (!qapi) return;

      const yes = await Dialog.confirm({
        title: "Delete Quest?",
        content: `<p>Delete quest <strong>${_escapeHtml(qid)}</strong>? Beats will keep their questId, but the quest will vanish from the registry.</p>`
      });
      if (!yes) return;

      await qapi.deleteQuest(qid);
      ui.notifications?.info?.("Quest deleted.");
      this.render(false);
    });

    html.find("[data-action='quest-search']").on("input", (ev) => {
      this.questSearch = String(ev.currentTarget?.value ?? "");
      this._scheduleRerender("quest-search", { focusEl: ev.currentTarget, delay: 140 });
    });

    html.find("[data-action='quest-status']").on("change", (ev) => {
      this.questStatusFilter = String(ev.currentTarget?.value ?? "all");
      this.render(false);
    });

    // Quest reorder (registry order)
    const _swapQuestOrder = async (qid, dir) => {
      const api = this._requireApi(); if (!api) return;
      const qapi = api.quests;
      if (!qapi || !qapi.listQuests || !qapi.saveQuest) return ui.notifications?.warn?.("Quest API not ready.");

      const list = qapi.listQuests({ campaignId: this.campaignId || null, status: this.questStatusFilter || "all", search: this.questSearch || "" }) || [];
      const quests = Array.isArray(list) ? list.slice() : [];

      quests.sort((a,b) => {
        const ao = Number(a.order ?? a.sort ?? a.createdTs ?? 0) || 0;
        const bo = Number(b.order ?? b.sort ?? b.createdTs ?? 0) || 0;
        if (ao !== bo) return ao - bo;
        return String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""), game.i18n.lang);
      });

      const idx = quests.findIndex(q => String(q.id) === String(qid));
      if (idx < 0) return;

      const j = (dir === "up") ? (idx - 1) : (idx + 1);
      if (j < 0 || j >= quests.length) return;

      const a = quests[idx];
      const b = quests[j];

      const ao = Number(a.order ?? a.sort ?? a.createdTs ?? 0) || 0;
      const bo = Number(b.order ?? b.sort ?? b.createdTs ?? 0) || 0;

      await qapi.saveQuest(a.id, { ...a, order: bo });
      await qapi.saveQuest(b.id, { ...b, order: ao });

      this.render(false);
    };

    html.find("[data-action='quest-move-up']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      if (!qid) return;
      await _swapQuestOrder(qid, "up");
    });

    html.find("[data-action='quest-move-down']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      if (!qid) return;
      await _swapQuestOrder(qid, "down");
    });


    // ---------------------------
    // Beats actions (RESTORED) — this is the missing piece that broke "Edit"
    // ---------------------------

    html.find("[data-action='add-beat']").on("click", async ev => {
      ev.preventDefault();
      const api = this._requireApi(); if (!api) return;
      if (!api.getCampaign || !api.saveCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign/saveCampaign.");

      const campaignId = this.campaignId;
      if (!campaignId) return ui.notifications?.warn?.("Select a campaign first.");

      const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
      if (!campaign) return;

      const id = `beat_${randomID()}`;
      const beat = this._ensureBeatShape({ id, label: `New Beat (${id.slice(0, 6)})`, type: "custom", timeScale: "scene" });

      campaign.beats ??= [];
      campaign.beats.push(beat);

      await api.saveCampaign(campaignId, campaign);
      ui.notifications?.info?.("Beat created.");
      this.render(false);

      this._openBeatEditor(campaignId, beat, "core");
    });

    html.find("[data-action='edit-beat']").on("click", async ev => {
      ev.preventDefault();
      const beatId = ev.currentTarget?.dataset?.beatId;
      if (!beatId) return;

      const api = this._requireApi(); if (!api) return;
      if (!api.getCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign().");

      const campaignId = this.campaignId;
      if (!campaignId) return ui.notifications?.warn?.("Select a campaign first.");

      const campaign = api.getCampaign(campaignId);
      try { this._scrollState ||= {}; this._scrollState.lastBeatId = String(beatId); } catch (e) {}
      try { this._captureScrollStateFromDom(); } catch (e) {}
      const beat = ((campaign && campaign.beats) || []).find(b => String(b?.id) === String(beatId)) || null;
      if (!beat) return ui.notifications?.warn?.("Beat not found.");

      this._openBeatEditor(campaignId, this._ensureBeatShape(beat), "core");
    });

    html.find("[data-action='run-beat']").on("click", async ev => {
      ev.preventDefault();
      const beatId = ev.currentTarget?.dataset?.beatId;
      if (!beatId) return;

      const api = this._requireApi(); if (!api) return;
      if (!api.runBeat) return ui.notifications?.warn?.("Campaign API missing runBeat().");

      const campaignId = this.campaignId;
      if (!campaignId) return ui.notifications?.warn?.("Select a campaign first.");

      await api.runBeat(campaignId, beatId);
    });

    html.find("[data-action='delete-beat']").on("click", async ev => {
      ev.preventDefault();
      const beatId = ev.currentTarget?.dataset?.beatId;
      if (!beatId) return;

      const api = this._requireApi(); if (!api) return;
      if (!api.getCampaign || !api.saveCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign/saveCampaign.");

      const campaignId = this.campaignId;
      if (!campaignId) return;

      const yes = await Dialog.confirm({
        title: "Delete Beat?",
        content: `<p>Delete beat <strong>${_escapeHtml(beatId)}</strong>? This cannot be undone.</p>`
      });
      if (!yes) return;

      const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
      campaign.beats = (campaign.beats || []).filter(b => String(b?.id) !== String(beatId));

      await api.saveCampaign(campaignId, campaign);
      ui.notifications?.info?.("Beat deleted.");
      this.render(false);
    });

    // Duplicate beat (shallow clone, new id)
    html.find("[data-action='duplicate-beat']").on("click", async ev => {
      ev.preventDefault();
      const beatId = ev.currentTarget?.dataset?.beatId;
      if (!beatId) return;

      const api = this._requireApi(); if (!api) return;
      if (!api.getCampaign || !api.saveCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign/saveCampaign.");

      const campaignId = this.campaignId;
      if (!campaignId) return;

      const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
      const src = (campaign.beats || []).find(b => String(b?.id) === String(beatId)) || null;
      if (!src) return ui.notifications?.warn?.("Beat not found.");

      const newId = `${String(src.id)}_copy_${randomID().slice(0,4)}`;
      const dup = foundry.utils.deepClone(src);
      dup.id = newId;
      dup.label = String(dup.label || src.id || "Beat").trim() + " (Copy)";

      campaign.beats.push(dup);
      await api.saveCampaign(campaignId, campaign);

      ui.notifications?.info?.("Beat duplicated.");
      this.render(false);
      this._openBeatEditor(campaignId, this._ensureBeatShape(dup), "core");
    });

    // Move beat (up/down/top/bottom or to explicit index)
// NOTE: ordering is the canonical array order in campaign.beats.
const _moveBeatToIndex = async (beatId, newIdx0) => {
  const api = this._requireApi(); if (!api) return;
  if (!api.getCampaign || !api.saveCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign/saveCampaign.");

  const campaignId = this.campaignId;
  if (!campaignId) return;

  const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
  const beats = Array.isArray(campaign.beats) ? campaign.beats : [];
  const idx = beats.findIndex(b => String(b?.id) === String(beatId));
  if (idx < 0) return;

  // Clamp destination
  let j = Number(newIdx0);
  if (isNaN(j)) return;
  if (j < 0) j = 0;
  if (j >= beats.length) j = beats.length - 1;
  if (j === idx) return;

  const [it] = beats.splice(idx, 1);
  beats.splice(j, 0, it);
  campaign.beats = beats;

  await api.saveCampaign(campaignId, campaign);
  this.render(false);
};

const _moveBeat = async (beatId, dir) => {
  const api = this._requireApi(); if (!api) return;
  if (!api.getCampaign || !api.saveCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign/saveCampaign.");

  const campaignId = this.campaignId;
  if (!campaignId) return;

  const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
  const beats = Array.isArray(campaign.beats) ? campaign.beats : [];
  const idx = beats.findIndex(b => String(b?.id) === String(beatId));
  if (idx < 0) return;

  let j = idx;
  if (dir === "up") j = idx - 1;
  else if (dir === "down") j = idx + 1;
  else if (dir === "top") j = 0;
  else if (dir === "bottom") j = beats.length - 1;

  if (j < 0 || j >= beats.length) return;
  if (j === idx) return;

  // Swap for up/down, splice for top/bottom (stable)
  if (dir === "up" || dir === "down") {
    const tmp = beats[idx];
    beats[idx] = beats[j];
    beats[j] = tmp;
  } else {
    const [it] = beats.splice(idx, 1);
    beats.splice(j, 0, it);
  }

  campaign.beats = beats;
  await api.saveCampaign(campaignId, campaign);
  this.render(false);
};

html.find("[data-action='move-beat-up']").on("click", async ev => {
  ev.preventDefault();
  const beatId = ev.currentTarget?.dataset?.beatId;
  if (!beatId) return;
  await _moveBeat(beatId, "up");
});

html.find("[data-action='move-beat-down']").on("click", async ev => {
  ev.preventDefault();
  const beatId = ev.currentTarget?.dataset?.beatId;
  if (!beatId) return;
  await _moveBeat(beatId, "down");
});

// NEW: one-click top/bottom
html.find("[data-action='move-beat-top']").on("click", async ev => {
  ev.preventDefault();
  const beatId = ev.currentTarget?.dataset?.beatId;
  if (!beatId) return;
  await _moveBeat(beatId, "top");
});

html.find("[data-action='move-beat-bottom']").on("click", async ev => {
  ev.preventDefault();
  const beatId = ev.currentTarget?.dataset?.beatId;
  if (!beatId) return;
  await _moveBeat(beatId, "bottom");
});

// NEW: direct index set (1-based in UI)
html.find("[data-action='set-beat-index']").on("change", async ev => {
  const input = ev.currentTarget;
  const beatId = input?.dataset?.beatId;
  if (!beatId) return;

  const v = Number(input.value);
  if (!v || isNaN(v) || v < 1) {
    // restore display (best-effort)
    try { this.render(false); } catch (_e) {}
    return;
  }

  await _moveBeatToIndex(beatId, v - 1);
});

// NEW: reindex (normalize the array; also removes nulls/empties defensively)
html.find("[data-action='reindex-beats']").on("click", async ev => {
  ev.preventDefault();
  const api = this._requireApi(); if (!api) return;
  if (!api.getCampaign || !api.saveCampaign) return ui.notifications?.warn?.("Campaign API missing getCampaign/saveCampaign.");

  const campaignId = this.campaignId;
  if (!campaignId) return;

  const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
  const beats = Array.isArray(campaign.beats) ? campaign.beats.filter(Boolean) : [];
  campaign.beats = beats;

  await api.saveCampaign(campaignId, campaign);
  ui.notifications?.info?.("Beats reindexed.");
  this.render(false);
});


    // Outcome beats helper (optional)
    html.find("[data-action='generate-outcome-beats']").on("click", async ev => {
      ev.preventDefault();
      const beatId = ev.currentTarget?.dataset?.beatId;
      if (!beatId) return;
      ui.notifications?.info?.("Outcome beats generator not implemented in this build.");
    });
  

    // ---------------------------
    // Actions Menu Popover (⋯) — portal to overlay to avoid clipping
    // Preserves original buttons (functional) and styling; no cloning.
    // ---------------------------

    const LAYER_ID = PORTAL_LAYER_ID;

    const getLayer = () => {
      let layer = document.getElementById(LAYER_ID);
      if (layer) return layer;

      layer = document.createElement("div");
      layer.id = LAYER_ID;
      layer.style.position = "fixed";
      layer.style.inset = "0";
      layer.style.zIndex = "999999";
      layer.style.pointerEvents = "none"; // only popover accepts input
      document.body.appendChild(layer);

      // Global document handlers (capture) to close/restores portaled menus when clicking outside,
      // when pressing Escape, or when the builder window closes/unmounts.
      try {
        if (!window.__bbttccCampaignPortalDocBound) {
          window.__bbttccCampaignPortalDocBound = true;

          document.addEventListener("mousedown", (ev) => {
            const layerNow = document.getElementById(LAYER_ID);
            if (!layerNow) return;

            const hasPortaled = !!layerNow.querySelector(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]");
            if (!hasPortaled) return;

            const t = ev.target;
            // Clicking inside the popover? let it work.
            if (t && t.closest && t.closest(`#${LAYER_ID} .bbttcc-actions-menu-pop[data-bbttcc-portaled="1"]`)) return;

            // If the campaign builder is no longer present, just restore and remove layer.
            const builderAlive = !!document.querySelector(".bbttcc-campaign-builder");
            if (!builderAlive) {
              layerNow.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => {
                pop.remove();
              });
              layerNow.remove();
              return;
            }

            // Close open menus + restore
            document.querySelectorAll(".bbttcc-campaign-builder details.bbttcc-actions-menu[open]")
              .forEach(d => d.removeAttribute("open"));

            layerNow.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => {
              const ownerId = pop.getAttribute("data-bbttcc-owner") || "";
              const owner = ownerId ? document.querySelector(`details.bbttcc-actions-menu[data-bbttcc-portal-id=\"${ownerId}\"]`) : null;
              if (owner) owner.appendChild(pop);
              pop.removeAttribute("data-bbttcc-portaled");
              pop.removeAttribute("data-bbttcc-owner");
              pop.style.position = "";
              pop.style.top = "";
              pop.style.left = "";
              pop.style.right = "";
              pop.style.bottom = "";
              pop.style.zIndex = "";
              pop.style.pointerEvents = "";
              pop.style.maxHeight = "";
              pop.style.overflow = "";
              pop.style.minWidth = "";
              pop.style.background = "";
              pop.style.border = "";
              pop.style.borderRadius = "";
              pop.style.boxShadow = "";
              pop.style.padding = "";
            });

            if (!layerNow.querySelector(".bbttcc-actions-menu-pop")) layerNow.remove();
          }, { capture: true });

          document.addEventListener("keydown", (ev) => {
            if (ev.key !== "Escape") return;
            const layerNow = document.getElementById(LAYER_ID);
            if (!layerNow) return;

            const hasPortaled = !!layerNow.querySelector(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]");
            if (!hasPortaled) return;

            document.querySelectorAll(".bbttcc-campaign-builder details.bbttcc-actions-menu[open]")
              .forEach(d => d.removeAttribute("open"));

            layerNow.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => {
              const ownerId = pop.getAttribute("data-bbttcc-owner") || "";
              const owner = ownerId ? document.querySelector(`details.bbttcc-actions-menu[data-bbttcc-portal-id=\"${ownerId}\"]`) : null;
              if (owner) owner.appendChild(pop);
              pop.removeAttribute("data-bbttcc-portaled");
              pop.removeAttribute("data-bbttcc-owner");
              pop.style.position = "";
              pop.style.top = "";
              pop.style.left = "";
              pop.style.right = "";
              pop.style.bottom = "";
              pop.style.zIndex = "";
              pop.style.pointerEvents = "";
              pop.style.maxHeight = "";
              pop.style.overflow = "";
              pop.style.minWidth = "";
              pop.style.background = "";
              pop.style.border = "";
              pop.style.borderRadius = "";
              pop.style.boxShadow = "";
              pop.style.padding = "";
            });

            if (!layerNow.querySelector(".bbttcc-actions-menu-pop")) layerNow.remove();
          }, { capture: true });
        }
      } catch (_e) {}

      // Close on outside click (capture)
      layer.addEventListener("mousedown", (ev) => {
        const t = ev.target;

        // Clicking inside a portaled popover? ignore
        if (t && t.closest && t.closest(`#${LAYER_ID} .bbttcc-actions-menu-pop[data-bbttcc-portaled="1"]`)) return;

        // Close all open menus in the builder
        try {
          document.querySelectorAll(".bbttcc-campaign-builder details.bbttcc-actions-menu[open]")
            .forEach(d => d.removeAttribute("open"));
        } catch (_e) {}

        // Restore any portaled nodes back into their original details elements
        try {
          document.querySelectorAll(`#${LAYER_ID} .bbttcc-actions-menu-pop[data-bbttcc-portaled="1"]`)
            .forEach(pop => {
              const ownerId = pop.getAttribute("data-bbttcc-owner") || "";
              const owner = ownerId ? document.querySelector(`details.bbttcc-actions-menu[data-bbttcc-portal-id="${ownerId}"]`) : null;
              if (owner) owner.appendChild(pop);
              pop.removeAttribute("data-bbttcc-portaled");
              pop.removeAttribute("data-bbttcc-owner");
              pop.style.position = "";
              pop.style.top = "";
              pop.style.left = "";
              pop.style.right = "";
              pop.style.bottom = "";
              pop.style.zIndex = "";
              pop.style.pointerEvents = "";
              pop.style.maxHeight = "";
              pop.style.overflow = "";
              pop.style.minWidth = "";
        pop.style.background = "";
        pop.style.border = "";
        pop.style.borderRadius = "";
        pop.style.boxShadow = "";
        pop.style.padding = "";
            });
        } catch (_e) {}
      }, { capture: true });

      return layer;
    };

    const portalOpen = (detailsEl) => {
      try {
        if (!detailsEl) return;

        // Assign a stable id per details element (per render)
        if (!detailsEl.dataset.bbttccPortalId) detailsEl.dataset.bbttccPortalId = randomID();

        const pop = detailsEl.querySelector(".bbttcc-actions-menu-pop");
        if (!pop) return;

        const layer = getLayer();

        // Move original popover into overlay
        if (pop.getAttribute("data-bbttcc-portaled") !== "1") {
          pop.setAttribute("data-bbttcc-portaled", "1");
          pop.setAttribute("data-bbttcc-owner", detailsEl.dataset.bbttccPortalId);
          layer.appendChild(pop);
        }

        // Position relative to summary
        const sum = detailsEl.querySelector("summary") || detailsEl;
        const r = sum.getBoundingClientRect();

        const margin = 8;
        const estimatedH = 260;
        const canOpenDown = (window.innerHeight - r.bottom) > (estimatedH + margin);

        const top = canOpenDown ? Math.round(r.bottom + 6) : Math.max(margin, Math.round(r.top - estimatedH - 6));
        const desiredLeft = Math.round(r.right - 210);
        const left = Math.min(window.innerWidth - 220 - margin, Math.max(margin, desiredLeft));

        pop.style.pointerEvents = "auto";
        pop.style.position = "fixed";
        pop.style.top = `${top}px`;
        pop.style.left = `${left}px`;
        pop.style.right = "auto";
        pop.style.bottom = "auto";
        pop.style.zIndex = "999999";
        pop.style.maxHeight = "260px";
        pop.style.overflow = "auto";
        pop.style.minWidth = "190px";

        // Visuals: when portaled, ensure it looks like a proper Hex Chrome popover (no transparency bleed)
        pop.style.background = "rgba(3,10,30,0.97)";
        pop.style.border = "1px solid rgba(148,163,184,0.45)";
        pop.style.borderRadius = "10px";
        pop.style.boxShadow = "0 10px 24px rgba(2,6,23,0.85)";
        pop.style.padding = "6px";

        if (!pop.__bbttccStopBound) {
          pop.addEventListener("mousedown", (e) => e.stopPropagation(), { capture: true });
          pop.__bbttccStopBound = true;
        }

        // If a menu button is used, close the menu immediately (prevents "sticky" popover while scrolling)
        if (!pop.__bbttccCloseOnUseBound) {
          pop.addEventListener("click", (ev) => {
            const t = ev.target;
            const btn = (t && t.closest) ? t.closest("[data-action]") : null;
            if (!btn) return;
            // Let the click proceed; then close on next tick.
            setTimeout(() => {
              try { detailsEl.removeAttribute("open"); } catch (_e) {}
              try { portalClose(detailsEl); } catch (_e) {}
            }, 0);
          }, { capture: true });
          pop.__bbttccCloseOnUseBound = true;
        }
      } catch (e) {
        console.warn(TAG, "portalOpen failed:", e);
      }
    };

    const portalClose = (detailsEl) => {
      try {
        if (!detailsEl) return;
        const pop = document.querySelector(`#${LAYER_ID} .bbttcc-actions-menu-pop[data-bbttcc-owner="${detailsEl.dataset.bbttccPortalId || ""}"]`);
        if (!pop) return;

        detailsEl.appendChild(pop);

        pop.removeAttribute("data-bbttcc-portaled");
        pop.removeAttribute("data-bbttcc-owner");
        pop.style.position = "";
        pop.style.top = "";
        pop.style.left = "";
        pop.style.right = "";
        pop.style.bottom = "";
        pop.style.zIndex = "";
        pop.style.pointerEvents = "";
        pop.style.maxHeight = "";
        pop.style.overflow = "";
        pop.style.minWidth = "";
      } catch (e) {
        console.warn(TAG, "portalClose failed:", e);
      }
    };



    // Close any open portaled menus when the Campaign Builder scrolls (prevents stale floating popovers).
    // Attach once per client session.
    try {
      if (!window.__bbttccCampaignPortalScrollBound) {
        window.__bbttccCampaignPortalScrollBound = true;
        document.addEventListener("scroll", (ev) => {
          const t = ev.target;
          // Only react to scrolls originating within the campaign builder window.
          if (!t || !(t instanceof Element)) return;
          if (!t.closest(".bbttcc-campaign-builder")) return;

          document.querySelectorAll(".bbttcc-campaign-builder details.bbttcc-actions-menu[open]")
            .forEach(d => d.removeAttribute("open"));

          // Restore any portaled nodes immediately.
          const layer = document.getElementById(LAYER_ID);
          if (layer) {
            layer.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => {
              const ownerId = pop.getAttribute("data-bbttcc-owner") || "";
              const owner = ownerId ? document.querySelector(`details.bbttcc-actions-menu[data-bbttcc-portal-id=\"${ownerId}\"]`) : null;
              if (owner) owner.appendChild(pop);
              pop.removeAttribute("data-bbttcc-portaled");
              pop.removeAttribute("data-bbttcc-owner");
              pop.style.position = "";
              pop.style.top = "";
              pop.style.left = "";
              pop.style.right = "";
              pop.style.bottom = "";
              pop.style.zIndex = "";
              pop.style.pointerEvents = "";
              pop.style.maxHeight = "";
              pop.style.overflow = "";
              pop.style.minWidth = "";
              pop.style.background = "";
              pop.style.border = "";
              pop.style.borderRadius = "";
              pop.style.boxShadow = "";
              pop.style.padding = "";
            });
          }
        }, { capture: true, passive: true });
      }
    } catch (_e) {}

    // Bind portal behavior once per details element
    rootEl.querySelectorAll("details.bbttcc-actions-menu").forEach((d) => {
      if (d.dataset.bbttccPortalBound === "1") return;
      d.dataset.bbttccPortalBound = "1";

      d.addEventListener("toggle", () => {
        if (d.open) portalOpen(d);
        else portalClose(d);
      });

      const reposition = () => { if (d.open) portalOpen(d); };
      window.addEventListener("resize", reposition);
      // rootEl may not be scroll container, but harmless; helps some Foundry builds
      rootEl.addEventListener("scroll", reposition, { passive: true });
    });


    // Mount Flow Visualizer when Flow tab is active
    try {
      if (String(this.mainTab || "") === "flow") this._mountFlowVisualizer(rootEl);
    } catch (_e) {}

}

  static open(options = {}) {
    const app = new this(options);
    app.render(true);
    return app;
  }
}

export default BBTTCCCampaignBuilderApp;