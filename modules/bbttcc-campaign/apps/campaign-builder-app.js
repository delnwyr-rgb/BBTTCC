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

// Foundry v13 namespaced randomID (global `randomID` was removed in v13).
// Lazy lookup so it works even if this module evaluates before `foundry.utils`
// is fully populated.
function randomID(length) {
  const fn = (typeof globalThis.randomID === "function" && globalThis.randomID !== randomID)
    ? globalThis.randomID
    : foundry?.utils?.randomID;
  if (typeof fn !== "function") {
    // Last-resort fallback: 16-char alphanumeric (matches Foundry document id format).
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const n = Number.isFinite(length) ? Math.max(1, length | 0) : 16;
    let s = "";
    for (let i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
    return s;
  }
  return fn(length);
}

// Overlay layer id for portaled popovers (Campaign Builder)
const PORTAL_LAYER_ID = "bbttcc-campaign-popover-layer";

// Inline styles that portalOpen() stamps on a popover while it lives in the
// overlay layer. Cleared by _restorePortalPop() when the popover goes home.
const PORTAL_POP_STYLE_PROPS = [
  "position", "top", "left", "right", "bottom", "zIndex", "pointerEvents",
  "maxHeight", "overflow", "minWidth", "background", "border", "borderRadius",
  "boxShadow", "padding"
];

// Return a portaled popover to its owning <details> element (if still in the
// DOM) and strip every inline style portalOpen() applied. Single source of
// truth for the reset — called from the cleanup path, both document handlers,
// the layer handler, the scroll handler, and portalClose().
function _restorePortalPop(pop) {
  try {
    if (!pop) return;
    const ownerId = pop.getAttribute("data-bbttcc-owner") || "";
    const owner = ownerId
      ? document.querySelector(`details.bbttcc-actions-menu[data-bbttcc-portal-id="${ownerId}"]`)
      : null;
    if (owner) owner.appendChild(pop);
    pop.removeAttribute("data-bbttcc-portaled");
    pop.removeAttribute("data-bbttcc-owner");
    for (const prop of PORTAL_POP_STYLE_PROPS) pop.style[prop] = "";
  } catch (_e) {}
}

// --- Travel table id helpers (shared by New/Duplicate/Repair) ---------------
// Travel encounter tables MUST be named travel_<terrain>_t<tier> or the engine's
// resolveTravelTableId() can't find them. Keep terrain keys aligned with the
// engine's TERRAIN_TABLE (source of truth); fall back to the builder's list.
function _builderTravelTerrainKeys() {
  try {
    const tt = game.bbttcc?.api?._hexTravel?.TERRAIN_TABLE;
    if (tt && typeof tt === "object") {
      const keys = Object.keys(tt).map(k => String(k).trim()).filter(Boolean);
      if (keys.length) return keys;
    }
  } catch (_e) {}
  return ["plains","forest","mountains","canyons","swamp","desert","river","ocean","ruins","wasteland"];
}

// Slugify a free-text (non-travel) table id into a safe key: lowercase, [a-z0-9_].
function _slugifyTableId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Compose the canonical travel id, snapping terrain to a known engine key.
function _composeTravelTableId(terrain, tier) {
  const keys = _builderTravelTerrainKeys();
  let t = String(terrain || "").trim();
  const hit = keys.find(k => k.toLowerCase() === t.toLowerCase());
  if (hit) t = hit;
  const n = Math.max(1, Math.floor(Number(tier) || 1));
  return `travel_${t}_t${n}`;
}

// Parse terrain + tier out of an existing travel id (tolerant of junk like _EFyI).
function _parseTravelTableId(id) {
  const s = String(id || "").trim();
  if (!/^travel_/i.test(s)) return null;
  const rest = s.replace(/^travel_/i, "");
  const m = rest.match(/^(.+?)_t(?:ier)?(\d+)/i);
  if (!m) return null;
  return { terrain: m[1], tier: Number(m[2]) || 1 };
}

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
    // Faction-kind only. The old heuristic kept any actor that merely CARRIED a
    // bbttcc-factions flag — but faction-OWNED rigs/stewards store
    // flags.bbttcc-factions.factionId, so that leaked rigs/characters into the
    // picker. Route through the canonical resolver; fall back to a STRICT check
    // (isFaction===true / type==="faction"), never mere flag presence.
    const kindOf = (a) => game.bbttcc?.api?.actorKind?.(a)
      ?? ((a?.flags?.["bbttcc-factions"]?.isFaction === true
           || String(a?.type || "").toLowerCase() === "faction") ? "faction" : (a?.type || ""));
    const out = [];
    for (const a of (game.actors?.contents || [])) {
      if (kindOf(a) !== "faction") continue;
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

  // Cinematic detection (beat.type === "cinematic"). Cinematic beats are
  // FIRST-CLASS in the visualizer (flow glue) — detected but never excluded;
  // node/chip renderers use it for the purple accent styling.
  var isCinematic = function (b) {
    return String((b && b.type) || "").trim().toLowerCase() === "cinematic";
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

  // ---------------------------------------------------------------------------
  // Quest-mode branch (B9 trim): collapse beats to per-quest bubbles, keep
  // cross-quest edges; allow inline expand to show inner beat chips.
  // Returns early with the questTree graph if viewMode === "quests".
  // ---------------------------------------------------------------------------
  if (String(opts.viewMode || "beats") === "quests") {
    var UNASSIGNED_Q = "__unassigned__";

    // Group filtered beats by questId (filtered = already turn/quest/travel-aware).
    var beatToQId = {};
    var beatsByQId = {};
    for (var bi2 = 0; bi2 < beats.length; bi2++) {
      var bq = beats[bi2];
      if (!bq || !bq.id) continue;
      var qid = String(bq.questId || "").trim() || UNASSIGNED_Q;
      beatToQId[String(bq.id)] = qid;
      (beatsByQId[qid] = beatsByQId[qid] || []).push(bq);
    }

    // Resolve quest definitions (name + status + order) via the campaign API.
    var qDefs = {};
    try {
      var qapi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign ? game.bbttcc.api.campaign.quests : null;
      var qList = (qapi && typeof qapi.listQuests === "function")
        ? qapi.listQuests({ campaignId: campaign.id, status: "all" })
        : [];
      for (var qi2 = 0; qi2 < (qList || []).length; qi2++) {
        var qd = qList[qi2];
        if (qd && qd.id) qDefs[String(qd.id)] = qd;
      }
    } catch (_eQDefs) {}

    // Cross-quest edges (one per quest pair; aggregates link kinds for tooltip).
    var xEdgeByKey = {};
    for (var ei2 = 0; ei2 < edges.length; ei2++) {
      var xe = edges[ei2];
      var fromQ = beatToQId[xe.from];
      var toQ = beatToQId[xe.to];
      if (!fromQ || !toQ) continue;
      if (fromQ === toQ) continue;
      var keyX = fromQ + ">>" + toQ;
      if (!xEdgeByKey[keyX]) {
        xEdgeByKey[keyX] = {
          from: "quest:" + fromQ,
          to: "quest:" + toQ,
          kind: "cross-quest",
          label: "",
          count: 0,
          kinds: {}
        };
      }
      xEdgeByKey[keyX].count++;
      xEdgeByKey[keyX].kinds[xe.kind] = (xEdgeByKey[keyX].kinds[xe.kind] || 0) + 1;
    }
    var xEdges = Object.values(xEdgeByKey);

    // Sizing constants for quest bubbles + inner beat chips.
    var Q_NODE_W = 360;
    var Q_NODE_H_COLLAPSED = 110;
    var Q_BEAT_CHIP_H = 30;
    var Q_BEAT_CHIP_PAD = 6;
    var Q_EXPAND_HEADER = 78;   // header space above inner chips
    var Q_EXPAND_FOOTER = 14;

    var expandedSet = (opts.expandedQuests instanceof Set) ? opts.expandedQuests : new Set();

    // Build quest nodes (variable height).
    var qNodes = [];
    var qOrderCounter = 0;
    for (var qkey in beatsByQId) {
      if (!Object.prototype.hasOwnProperty.call(beatsByQId, qkey)) continue;
      var qbeats = beatsByQId[qkey];
      var isUnassigned = (qkey === UNASSIGNED_Q);
      var def = isUnassigned ? null : qDefs[qkey];
      var qName = isUnassigned ? "Unassigned" : ((def && def.name) ? def.name : qkey);
      var qStatus = isUnassigned ? "" : ((def && def.status) ? def.status : "active");
      var expanded = !isUnassigned && expandedSet.has(qkey);
      var innerH = expanded
        ? (Q_EXPAND_HEADER + qbeats.length * (Q_BEAT_CHIP_H + Q_BEAT_CHIP_PAD) + Q_EXPAND_FOOTER)
        : Q_NODE_H_COLLAPSED;

      qNodes.push({
        id: "quest:" + qkey,
        kind: "quest",
        questId: qkey,
        isUnassigned: isUnassigned,
        name: qName,
        status: qStatus,
        expanded: expanded,
        beats: qbeats.slice(),
        beatCount: qbeats.length,
        width: Q_NODE_W,
        height: innerH,
        _order: qOrderCounter++
      });
    }

    // Deterministic sort: unassigned last, otherwise quest.order asc, then name.
    qNodes.sort(function (a, b) {
      if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
      var ao = (qDefs[a.questId] && qDefs[a.questId].order != null) ? Number(qDefs[a.questId].order) : 999999;
      var bo = (qDefs[b.questId] && qDefs[b.questId].order != null) ? Number(qDefs[b.questId].order) : 999999;
      if (ao !== bo) return ao - bo;
      return String(a.name).localeCompare(String(b.name));
    });

    // ID -> node + adjacency.
    var qById = {};
    for (var qni = 0; qni < qNodes.length; qni++) qById[qNodes[qni].id] = qNodes[qni];

    var qAdj = {};
    for (var xei = 0; xei < xEdges.length; xei++) {
      var xeE = xEdges[xei];
      if (!qById[xeE.from] || !qById[xeE.to]) continue;
      (qAdj[xeE.from] = qAdj[xeE.from] || []).push(xeE.to);
    }

    // Roots = nodes with no incoming edge (fallback: all if cyclic).
    var inDeg = {};
    for (var idn = 0; idn < qNodes.length; idn++) inDeg[qNodes[idn].id] = 0;
    for (var sa in qAdj) {
      if (!Object.prototype.hasOwnProperty.call(qAdj, sa)) continue;
      var list = qAdj[sa];
      for (var li = 0; li < list.length; li++) {
        if (inDeg[list[li]] != null) inDeg[list[li]]++;
      }
    }
    var qRoots = qNodes.filter(function (n) { return inDeg[n.id] === 0; });
    if (!qRoots.length && qNodes.length) qRoots = [qNodes[0]];

    // Tidy-tree layout over the cross-quest DAG.
    var qLeaf = {};
    var qVisit = {};
    var countLeavesQ = function (id) {
      if (qLeaf[id] != null) return qLeaf[id];
      if (qVisit[id]) return 1;
      qVisit[id] = true;
      var ks = qAdj[id] || [];
      if (!ks.length) { qLeaf[id] = 1; qVisit[id] = false; return 1; }
      var sum = 0;
      for (var ki = 0; ki < ks.length; ki++) sum += countLeavesQ(ks[ki]);
      qLeaf[id] = Math.max(1, sum);
      qVisit[id] = false;
      return qLeaf[id];
    };
    for (var ri2 = 0; ri2 < qRoots.length; ri2++) countLeavesQ(qRoots[ri2].id);

    var qAssigned = {};
    var qXPos = {};
    var qDepthOf = {};
    var qCursor = 0;
    var assignQ = function (id, depth) {
      if (qAssigned[id]) return;
      qAssigned[id] = true;
      qDepthOf[id] = depth;
      var ks = (qAdj[id] || []).slice();
      ks.sort(function (a, b) {
        var ao = qById[a] ? qById[a]._order : 999999;
        var bo = qById[b] ? qById[b]._order : 999999;
        return ao - bo;
      });
      if (!ks.length) { qXPos[id] = qCursor++; return; }
      for (var ki = 0; ki < ks.length; ki++) assignQ(ks[ki], depth + 1);
      var minx = Infinity, maxx = -Infinity;
      for (var kj = 0; kj < ks.length; kj++) {
        var cx = qXPos[ks[kj]];
        if (cx < minx) minx = cx;
        if (cx > maxx) maxx = cx;
      }
      qXPos[id] = (isFinite(minx) && isFinite(maxx)) ? (minx + maxx) / 2 : qCursor++;
    };
    for (var ri3 = 0; ri3 < qRoots.length; ri3++) assignQ(qRoots[ri3].id, 0);
    // Catch orphan / cycle-only nodes.
    for (var on = 0; on < qNodes.length; on++) {
      if (!qAssigned[qNodes[on].id]) assignQ(qNodes[on].id, 0);
    }

    // Per-depth max height drives the vertical stacking.
    var maxHByDepth = {};
    for (var di2 = 0; di2 < qNodes.length; di2++) {
      var dnode = qNodes[di2];
      var d = qDepthOf[dnode.id] || 0;
      if (!maxHByDepth[d] || dnode.height > maxHByDepth[d]) maxHByDepth[d] = dnode.height;
    }
    var depthKeys = Object.keys(maxHByDepth).map(Number).sort(function (a, b) { return a - b; });
    var yOfDepth = {};
    var yAcc = 100;
    var QGAP_Y = 90;
    for (var dk = 0; dk < depthKeys.length; dk++) {
      yOfDepth[depthKeys[dk]] = yAcc;
      yAcc += maxHByDepth[depthKeys[dk]] + QGAP_Y;
    }

    // Normalize xPos to pixels.
    var minLeafQ = Infinity, maxLeafQ = -Infinity;
    for (var xk in qXPos) {
      if (!Object.prototype.hasOwnProperty.call(qXPos, xk)) continue;
      var vx = qXPos[xk];
      if (vx < minLeafQ) minLeafQ = vx;
      if (vx > maxLeafQ) maxLeafQ = vx;
    }
    if (!isFinite(minLeafQ)) minLeafQ = 0;
    if (!isFinite(maxLeafQ)) maxLeafQ = 0;

    var QGAP_X = 440;
    var QPAD_X = 120;
    var qPos = {};
    var qMaxX = 0, qMaxY = 0;
    for (var pi2 = 0; pi2 < qNodes.length; pi2++) {
      var pn = qNodes[pi2];
      var xL = (qXPos[pn.id] != null) ? qXPos[pn.id] : 0;
      var dP = qDepthOf[pn.id] || 0;
      var xPixQ = QPAD_X + Math.floor((xL - minLeafQ) * QGAP_X);
      var yPixQ = (yOfDepth[dP] != null) ? yOfDepth[dP] : 100;
      qPos[pn.id] = { x: xPixQ, y: yPixQ };
      if (xPixQ + pn.width > qMaxX) qMaxX = xPixQ + pn.width;
      if (yPixQ + pn.height > qMaxY) qMaxY = yPixQ + pn.height;
    }

    var qRootId = (qRoots[0] && qRoots[0].id) || (qNodes[0] && qNodes[0].id) || null;

    return {
      v: 4,
      mode: "questTree",
      viewMode: "quests",
      turnNumber: selectedTurn,
      turns: turns,
      nodes: qNodes,
      edges: xEdges,
      pos: qPos,
      size: { w: Math.max(1800, qMaxX + QPAD_X), h: Math.max(800, qMaxY + 100) },
      constants: {
        NODE_W: Q_NODE_W,
        NODE_H: Q_NODE_H_COLLAPSED,
        BEAT_CHIP_H: Q_BEAT_CHIP_H,
        BEAT_CHIP_PAD: Q_BEAT_CHIP_PAD,
        EXPAND_HEADER: Q_EXPAND_HEADER
      },
      rootId: qRootId
    };
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
      isCinematic: isCinematic(b2),
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
      title: "Bad Eden Campaign Builder",
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

    // Quest filters (beats list). beatQuestStatusFilter is the Beats tab's own
    // quest-status dropdown — deliberately independent from the Quests tab's
    // questStatusFilter so filtering one tab never filters the other.
    this.questFilter = options.questFilter ?? "all";     // "all" | questId
    this.beatQuestStatusFilter = options.beatQuestStatusFilter ?? "all"; // "all" | active | completed | archived

    // Quest filters (Quests tab)
    this.questStatusFilter = options.questStatusFilter ?? "all"; // "all" | active | completed | archived
    this.questSearch = options.questSearch ?? "";

    // Flow Visualizer UI state (non-persistent)
    this.flowShowTravel = !!options.flowShowTravel;
    this.flowZoom = Number(options.flowZoom ?? 1) || 1;
    this.flowPan = { x: Number(options.flowPanX ?? 0) || 0, y: Number(options.flowPanY ?? 0) || 0 };
    this.flowTurn = (options.flowTurn != null) ? options.flowTurn : null;


    // NEW: Quest filter for Visualizer
    this.flowQuestId = options.flowQuestId ?? "all";

    // NEW (B9 trim): View mode + expanded-quest set for quest-mode overview
    //   - "beats" = legacy per-beat decision tree
    //   - "quests" = per-quest bubbles; click bubble to expand inner beats
    // Pulled from user flag if present; default = "quests" (the overview is the more useful first impression).
    let _viewModeFlag = null;
    try { _viewModeFlag = game.user?.getFlag?.("bbttcc-campaign", "flowViewMode") ?? null; } catch (_e) {}
    this.flowViewMode = options.flowViewMode || _viewModeFlag || "quests";
    if (this.flowViewMode !== "beats" && this.flowViewMode !== "quests") this.flowViewMode = "quests";
    this.flowExpandedQuests = new Set(); // questIds expanded inline (session-scope)

    // Debounced renders for text inputs (prevents focus loss while typing)
    this._renderDebounceTimers = {};
    this._pendingFocusRestore = null;


    // Main UI tab (non-persistent)
    this.mainTab = options.mainTab ?? "campaign";

    // Scroll state (non-persistent)
    this._scrollState = { beatsTop: 0, mainTop: 0, lastBeatId: null };

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
        layer.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => _restorePortalPop(pop));

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

    // NOTE: the flow graph is built ONCE, inside _mountFlowVisualizer() (which
    // resolves the campaign fresh from the API). It is intentionally NOT built
    // here — the template never reads it.

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
      ? filterBeats(selectedCampaign, this.beatSearch, this.beatTypeFilter, this.beatTurnFilter, this.questFilter, this.beatQuestStatusFilter, questMap)
      : [];


    // Enrich beat rows with quest labels/status for UI chips
    try {
      // Story Director record: badge beats that already fired on ANY surface
      // (director tick, this Builder, Story Console, NPC dialogue). Soft-lock:
      // badge + confirm on re-run, never blocked.
      let dstate = null;
      try { dstate = game.bbttcc?.api?.campaign?.director?.state?.() || null; } catch (_eDS) { dstate = null; }
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
        const bid = String(row?.beat?.id || "");
        const f = dstate ? (dstate.firedStoryBeats?.[bid] || dstate.dialogueFired?.[bid]) : null;
        row.fired = !!f;
        row.firedTurn = (f && f.turn) || null;
      }
    } catch (_eQRows) {}


    // Quests (manager UI)
    const questsFiltered = (() => {
      const q = String(this.questSearch || "").trim();
      const st = String(this.questStatusFilter || "all");
      const list = listQuestsSafe({ campaignId: selectedCampaign?.id || null, status: st, search: q });
      // Enrich with linked-hex rows pulled via the territory.questLinks API.
      const ql = game?.bbttcc?.api?.territory?.questLinks;
      return list.map(qq => {
        const linkedHexes = ql?.listHexesForQuest ? ql.listHexesForQuest(qq.id) : [];
        return {
          ...qq,
          linkedHexes,
          hasLinkedHexes: linkedHexes.length > 0,
          linkedHexCount: linkedHexes.length,
          anyHinted: linkedHexes.some(h => h.hinted),
          allHinted: linkedHexes.length > 0 && linkedHexes.every(h => h.hinted)
        };
      });
    })();

    // Resolve active-faction UUIDs → display rows for the Selected Campaign panel.
    if (selectedCampaign) {
      const ids = Array.isArray(selectedCampaign.factionIds)
        ? selectedCampaign.factionIds
        : (selectedCampaign.factionId ? [selectedCampaign.factionId] : []);
      const primary = String(selectedCampaign.factionId || "");
      selectedCampaign.activeFactions = ids.map(uuid => {
        const a = fromUuidSync?.(uuid);
        return {
          uuid,
          name: a?.name || uuid,
          isPrimary: String(uuid) === primary
        };
      });
    }


    return {
      ...data,
      apiReady: true,
      activeCampaignId: _getActiveCampaignId(),
      campaigns: campaigns.map(c => ({ ...c, isActive: String(c.id) === String(_getActiveCampaignId() || "") })),
      tables,
      engineTables,
      selectedCampaign,
      flowShowTravel: !!this.flowShowTravel,
      flowZoom: this.flowZoom,
      flowPanX: (this.flowPan && this.flowPan.x) ? this.flowPan.x : 0,
      flowPanY: (this.flowPan && this.flowPan.y) ? this.flowPan.y : 0,
      beatSearch: this.beatSearch,
      beatTypeFilter: this.beatTypeFilter,
      beatTurnFilter: this.beatTurnFilter,
      questFilter: this.questFilter,
      beatQuestStatusFilter: this.beatQuestStatusFilter,
      questStatusFilter: this.questStatusFilter,
      questSearch: this.questSearch,
      questsFiltered,
      questsAll: questsAll,

      mainTab: this.mainTab,
      beatTypes,
      beatTurnOptions,
      beatsFiltered,

      // Travel Tables UI
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

      const beatsScroll = el.querySelector("[data-role='beats-scroll']");
      const main = el.querySelector(".bbttcc-campaign-main");

      this._scrollState ||= { beatsTop: 0, mainTop: 0, lastBeatId: null };
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

      const beatsScroll = el.querySelector("[data-role='beats-scroll']");
      const main = el.querySelector(".bbttcc-campaign-main");

      const st = this._scrollState || {};
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
      const graph = _buildFlowGraph(campaign, {
        turn: this.flowTurn,
        questId: this.flowQuestId,
        showTravel: this.flowShowTravel,
        viewMode: this.flowViewMode,
        expandedQuests: this.flowExpandedQuests
      });
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
        // Central hover-help for JS-built controls (dictionary registered by
        // scripts/module.js under the "campaign" namespace).
        const _tip = (key) => { try { return game.bbttcc?.help?.tip?.("campaign", key) || ""; } catch (_e) { return ""; } };

        // HexChrome styling: use the --cb-* design tokens (scoped on the app
        // root by campaign-builder.css) instead of hand-inlined colors.
        const styleBarSelect = (el) => {
          el.style.padding = "4px 8px";
          el.style.borderRadius = "var(--cb-radius)";
          el.style.border = "1px solid var(--cb-border)";
          el.style.background = "var(--cb-bg-soft)";
          el.style.color = "var(--cb-text-main)";
        };
        const styleBarLabel = (el) => {
          el.style.fontWeight = "800";
          el.style.color = "var(--cb-data)";
        };

        const bar = document.createElement("div");
        bar.className = "bbttcc-flowviz-bar";
        bar.dataset.tour = "campaign.flow-bar";
        bar.style.display = "flex";
        bar.style.alignItems = "center";
        bar.style.justifyContent = "space-between";
        bar.style.gap = "12px";
        bar.style.padding = "6px 8px";
        bar.style.margin = "0 0 8px 0";
        bar.style.border = "1px solid var(--cb-border)";
        bar.style.borderRadius = "var(--cb-radius)";
        bar.style.background = "var(--cb-bg-soft)";

        const left = document.createElement("div");
        left.style.display = "flex";
        left.style.alignItems = "center";
        left.style.gap = "10px";

        const lbl = document.createElement("div");
        styleBarLabel(lbl);
        lbl.textContent = "Turn";
        const _turnTip = _tip("flow-turn");
        if (_turnTip) lbl.dataset.tooltip = _turnTip;

        const sel = document.createElement("select");
        if (_turnTip) sel.dataset.tooltip = _turnTip;
        styleBarSelect(sel);

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
        styleBarLabel(qLbl);
        qLbl.textContent = "Quest";
        const _questTip = _tip("flow-quest");
        if (_questTip) qLbl.dataset.tooltip = _questTip;

        const qSel = document.createElement("select");
        if (_questTip) qSel.dataset.tooltip = _questTip;
        styleBarSelect(qSel);

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

        // View mode selector (Beats | Quests) — B9 trim
        const vLbl = document.createElement("div");
        styleBarLabel(vLbl);
        vLbl.textContent = "View";
        const _viewTip = _tip("flow-view");
        if (_viewTip) vLbl.dataset.tooltip = _viewTip;

        const vSel = document.createElement("select");
        if (_viewTip) vSel.dataset.tooltip = _viewTip;
        styleBarSelect(vSel);

        for (const [val, label] of [["quests", "Quests (overview)"], ["beats", "Beats (detail)"]]) {
          const o = document.createElement("option");
          o.value = val;
          o.textContent = label;
          if (String(this.flowViewMode) === val) o.selected = true;
          vSel.appendChild(o);
        }

        vSel.addEventListener("change", (ev) => {
          const v = String(ev.target.value || "quests");
          this.flowViewMode = (v === "beats") ? "beats" : "quests";
          // Persist user's preference across sessions.
          try { game.user?.setFlag?.("bbttcc-campaign", "flowViewMode", this.flowViewMode); } catch (_e) {}
          // Clear expansion when leaving quest mode so re-entry is clean.
          if (this.flowViewMode !== "quests") this.flowExpandedQuests = new Set();
          this._flowResetView();
          this.render(false);
        });

        left.appendChild(lbl);
        left.appendChild(sel);
        left.appendChild(qLbl);
        left.appendChild(qSel);
        left.appendChild(vLbl);
        left.appendChild(vSel);
        bar.appendChild(left);

        const right = document.createElement("div");
        right.style.display = "flex";
        right.style.alignItems = "center";
        right.style.gap = "8px";

        const hint = document.createElement("div");
        hint.style.color = "var(--cb-text-muted)";
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

      // Per-graph-node metadata (width/height) for variable-size nodes (quest mode).
      const graphNodeById = {};
      for (const gn of (graph.nodes || [])) graphNodeById[String(gn.id)] = gn;

      const isQuestMode = (graph.mode === "questTree");

      // Draw edges first (under nodes)
      for (const e of graph.edges) {
        const a = graph.pos[e.from];
        const b = graph.pos[e.to];
        if (!a || !b) continue;

        const srcNode = graphNodeById[e.from];
        const dstNode = graphNodeById[e.to];
        const srcW = (srcNode && srcNode.width) ? srcNode.width : NODE_W;
        const srcH = (srcNode && srcNode.height) ? srcNode.height : NODE_H;
        const dstW = (dstNode && dstNode.width) ? dstNode.width : NODE_W;

        const x1 = a.x + (srcW / 2);
        const y1 = a.y + srcH;
        const x2 = b.x + (dstW / 2);
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

        if (isQuestMode) {
          // Cross-quest edges: single neutral color (aggregates many beat-level edges).
          stroke = "rgba(148,163,184,0.55)";
          marker = "url(#bbttcc-arrow)";
        } else if (e.kind === "success") { stroke = "rgba(34,197,94,0.45)"; marker = "url(#bbttcc-arrow-success)"; }
        else if (e.kind === "failure") { stroke = "rgba(239,68,68,0.45)"; marker = "url(#bbttcc-arrow-failure)"; }
        else if (e.kind === "choice_fail") { dash = "6 5"; stroke = "rgba(239,68,68,0.30)"; marker = "url(#bbttcc-arrow)"; }
        else if (e.kind === "choice") { dash = "6 5"; stroke = "rgba(148,163,184,0.30)"; marker = "url(#bbttcc-arrow)"; }

        path.setAttribute("stroke", stroke);
        path.setAttribute("stroke-width", isQuestMode ? "2.5" : "2");
        if (dash) path.setAttribute("stroke-dasharray", dash);
        path.setAttribute("marker-end", marker);

        // Tooltip
        const t = document.createElementNS(svgNS, "title");
        if (isQuestMode) {
          const kindsStr = e.kinds
            ? Object.entries(e.kinds).map(([k, v]) => v > 1 ? `${k}×${v}` : k).join(", ")
            : (e.kind || "");
          t.textContent = `${e.from.replace(/^quest:/, "")} → ${e.to.replace(/^quest:/, "")}\n${e.count || 1} beat link${(e.count || 1) === 1 ? "" : "s"}${kindsStr ? " (" + kindsStr + ")" : ""}`;
        } else {
          t.textContent = `${e.label || e.kind}: ${e.from} → ${e.to}`;
        }
        path.appendChild(t);

        g.appendChild(path);
      }

      // ---------------------------------------------------------------------
      // Quest-mode node rendering (B9 trim): quest bubbles + inline beat chips.
      // ---------------------------------------------------------------------
      if (isQuestMode) {
        const Q_W = graph.constants.NODE_W;
        const Q_H_COLLAPSED = graph.constants.NODE_H;
        const Q_CHIP_H = graph.constants.BEAT_CHIP_H || 30;
        const Q_CHIP_PAD = graph.constants.BEAT_CHIP_PAD || 6;
        const Q_EXPAND_HEADER = graph.constants.EXPAND_HEADER || 78;

        const statusColor = (s) => {
          const k = String(s || "").toLowerCase();
          if (k === "completed") return "rgba(34,197,94,0.85)";   // green
          if (k === "archived") return "rgba(148,163,184,0.70)";   // gray
          if (k === "active") return "rgba(245,158,11,0.85)";      // amber
          return "rgba(148,163,184,0.45)";                          // unassigned / unknown
        };

        for (const n of graph.nodes) {
          const p = graph.pos[n.id];
          if (!p) continue;

          const node = document.createElementNS(svgNS, "g");
          node.setAttribute("data-quest-id", n.questId);
          node.style.cursor = "pointer";

          // Bubble
          const rect = document.createElementNS(svgNS, "rect");
          rect.setAttribute("x", String(p.x));
          rect.setAttribute("y", String(p.y));
          rect.setAttribute("rx", "16");
          rect.setAttribute("ry", "16");
          rect.setAttribute("width", String(Q_W));
          rect.setAttribute("height", String(n.height));

          const isUnassigned = !!n.isUnassigned;
          let fill = "rgba(15,23,42,0.65)";
          let stroke = n.expanded ? "rgba(56,189,248,0.55)" : "rgba(148,163,184,0.35)";
          if (isUnassigned) { fill = "rgba(30,41,59,0.50)"; stroke = "rgba(148,163,184,0.25)"; }
          rect.setAttribute("fill", fill);
          rect.setAttribute("stroke", stroke);
          rect.setAttribute("stroke-width", n.expanded ? "3" : "2");
          node.appendChild(rect);

          // Status pip (left of header text)
          if (!isUnassigned) {
            const pip = document.createElementNS(svgNS, "circle");
            pip.setAttribute("cx", String(p.x + 22));
            pip.setAttribute("cy", String(p.y + 30));
            pip.setAttribute("r", "7");
            pip.setAttribute("fill", statusColor(n.status));
            pip.setAttribute("stroke", "rgba(255,255,255,0.15)");
            pip.setAttribute("stroke-width", "1");
            node.appendChild(pip);
          }

          // Quest name (large)
          const nameEl = document.createElementNS(svgNS, "text");
          nameEl.setAttribute("x", String(p.x + (isUnassigned ? 18 : 40)));
          nameEl.setAttribute("y", String(p.y + 36));
          nameEl.setAttribute("fill", "rgba(255,255,255,0.95)");
          nameEl.setAttribute("font-size", "17");
          nameEl.setAttribute("font-weight", "800");
          const nm = String(n.name || "").length > 28 ? (String(n.name).slice(0, 28) + "…") : String(n.name || "");
          nameEl.textContent = nm;
          node.appendChild(nameEl);

          // Sub line: beat count + status text
          const subQ = document.createElementNS(svgNS, "text");
          subQ.setAttribute("x", String(p.x + 18));
          subQ.setAttribute("y", String(p.y + 58));
          subQ.setAttribute("fill", "rgba(255,255,255,0.65)");
          subQ.setAttribute("font-size", "12");
          const subParts = [];
          subParts.push(n.beatCount + " beat" + (n.beatCount === 1 ? "" : "s"));
          if (!isUnassigned && n.status) subParts.push(String(n.status));
          subQ.textContent = subParts.join("  ·  ");
          node.appendChild(subQ);

          // Expand/collapse chevron (top-right) — hidden for unassigned (no quest record)
          if (!isUnassigned) {
            const chev = document.createElementNS(svgNS, "text");
            chev.setAttribute("x", String(p.x + Q_W - 20));
            chev.setAttribute("y", String(p.y + 32));
            chev.setAttribute("fill", "rgba(255,255,255,0.75)");
            chev.setAttribute("font-size", "16");
            chev.setAttribute("font-weight", "700");
            chev.setAttribute("text-anchor", "end");
            chev.textContent = n.expanded ? "▾" : "▸";
            node.appendChild(chev);
          }

          // Hint text bottom-right for collapsed quests
          if (!n.expanded && !isUnassigned) {
            const hint = document.createElementNS(svgNS, "text");
            hint.setAttribute("x", String(p.x + Q_W - 14));
            hint.setAttribute("y", String(p.y + n.height - 14));
            hint.setAttribute("fill", "rgba(255,255,255,0.45)");
            hint.setAttribute("font-size", "10.5");
            hint.setAttribute("text-anchor", "end");
            hint.textContent = "click to expand";
            node.appendChild(hint);
          }

          // Tooltip
          const tq = document.createElementNS(svgNS, "title");
          tq.textContent =
            (n.name || "") + "\n" +
            n.beatCount + " beat" + (n.beatCount === 1 ? "" : "s") +
            (isUnassigned ? "" : ("\nstatus: " + (n.status || "active"))) +
            "\nclick to " + (n.expanded ? "collapse" : "expand");
          node.appendChild(tq);

          // Click handler -> toggle expansion. (Unassigned bucket: noop.)
          if (!isUnassigned) {
            node.addEventListener("click", (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              // Ignore clicks that originated from an inner beat chip (those have their own handler).
              if (ev.target && ev.target.closest && ev.target.closest("g[data-flow-beat-chip]")) return;
              if (this.flowExpandedQuests.has(n.questId)) this.flowExpandedQuests.delete(n.questId);
              else this.flowExpandedQuests.add(n.questId);
              this.render(false);
            });
          }

          // Inner beat chips when expanded.
          if (n.expanded && Array.isArray(n.beats) && n.beats.length) {
            const chipX = p.x + 14;
            let chipY = p.y + Q_EXPAND_HEADER;
            const chipW = Q_W - 28;

            for (const ib of n.beats) {
              const chip = document.createElementNS(svgNS, "g");
              chip.setAttribute("data-flow-beat-chip", "1");
              chip.setAttribute("data-beat-id", String(ib.id));
              chip.style.cursor = "pointer";

              const cr = document.createElementNS(svgNS, "rect");
              cr.setAttribute("x", String(chipX));
              cr.setAttribute("y", String(chipY));
              cr.setAttribute("rx", "8");
              cr.setAttribute("ry", "8");
              cr.setAttribute("width", String(chipW));
              cr.setAttribute("height", String(Q_CHIP_H));

              // Subtle type-aware stroke (mirrors flat-mode coloring).
              let cStroke = "rgba(148,163,184,0.28)";
              if (String(ib.type) === "encounter") cStroke = "rgba(245,158,11,0.40)";
              else if (String(ib.type) === "cinematic") cStroke = "rgba(168,85,247,0.45)";

              cr.setAttribute("fill", "rgba(2,6,23,0.50)");
              cr.setAttribute("stroke", cStroke);
              cr.setAttribute("stroke-width", "1.5");
              chip.appendChild(cr);

              // Chip label (truncate)
              const cl = document.createElementNS(svgNS, "text");
              cl.setAttribute("x", String(chipX + 10));
              cl.setAttribute("y", String(chipY + 14));
              cl.setAttribute("fill", "rgba(255,255,255,0.92)");
              cl.setAttribute("font-size", "12");
              cl.setAttribute("font-weight", "700");
              const cLabel = String(ib.label || ib.id || "");
              cl.textContent = cLabel.length > 36 ? (cLabel.slice(0, 36) + "…") : cLabel;
              chip.appendChild(cl);

              // Chip sub-line: id + type
              const cs = document.createElementNS(svgNS, "text");
              cs.setAttribute("x", String(chipX + 10));
              cs.setAttribute("y", String(chipY + 26));
              cs.setAttribute("fill", "rgba(255,255,255,0.55)");
              cs.setAttribute("font-size", "10");
              cs.textContent = String(ib.id || "") + (ib.type ? " · " + String(ib.type) : "");
              chip.appendChild(cs);

              const ct = document.createElementNS(svgNS, "title");
              ct.textContent = (ib.label || ib.id || "") + "\nid: " + (ib.id || "") + (ib.type ? "\ntype: " + ib.type : "");
              chip.appendChild(ct);

              chip.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const fullBeat = nodeById[String(ib.id)] || ib;
                if (!fullBeat) return;
                this._openBeatEditor(campaign.id, this._ensureBeatShape(fullBeat), "core");
              });

              node.appendChild(chip);
              chipY += Q_CHIP_H + Q_CHIP_PAD;
            }
          }

          g.appendChild(node);
        }
      } else {
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
        if (n.isCinematic) { stroke = "rgba(168,85,247,0.40)"; }

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
      } // end legacy beat-mode node renderer

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
          opt.textContent = "(No Bad Eden bundles in this pack)";
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

    new Dialog({ title: "Bad Eden Stable Keys", content: content, buttons: { ok: { label: "OK" } }, default: "ok" }).render(true);
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
      // Beats tab's OWN quest-status filter (independent from the Quests tab).
      this.beatQuestStatusFilter = String(ev.currentTarget?.value ?? "all");
      this.render(false);
    });


    // ---------------------------
    // Encounter Tables (Random Encounter Tables UI) — existing
    // ---------------------------

    html.find("[data-action='new-travel-table']").on("click", async ev => {
      ev.preventDefault();
      const api = this._requireApi(); if (!api) return;
      const tablesApi = api.tables;
      if (!tablesApi?.createTable) return ui.notifications?.warn?.("Encounter Tables API not ready.");

      // Default the dialog to the current filter selection, but ALWAYS let the
      // GM pick terrain/tier here — otherwise "All terrains" silently defaults to
      // plains t1 and the create is blocked as a duplicate.
      const filterTerrain = String(rootEl.querySelector(`[data-role="travel-terrain"]`)?.value || this.travelTerrain || "").trim().toLowerCase();
      const filterTier = Number(rootEl.querySelector(`[data-role="travel-tier"]`)?.value || this.travelTier || 0) || 0;

      const terrainKeys = _builderTravelTerrainKeys();
      const terrainOpts = terrainKeys.map(k =>
        `<option value="${_escapeHtml(k)}" ${k === filterTerrain ? "selected" : ""}>${_escapeHtml(k.charAt(0).toUpperCase() + k.slice(1))}</option>`
      ).join("");
      const tierOpts = [1,2,3,4].map(t => `<option value="${t}" ${t === filterTier ? "selected" : ""}>Tier ${t}</option>`).join("");

      const payload = await Dialog.prompt({
        title: "New Travel Table",
        content: `
          <p>Create a travel encounter table. The Table ID is composed automatically as <code>travel_&lt;terrain&gt;_t&lt;tier&gt;</code>.</p>
          <div class="form-group"><label>Terrain</label><select name="terrain">${terrainOpts}</select></div>
          <div class="form-group"><label>Tier</label><select name="tier">${tierOpts}</select></div>
          <div class="form-group"><label>Label (optional)</label><input type="text" name="label" placeholder="auto" /></div>
        `,
        label: "Create",
        callback: html => ({
          terrain: String(html.find("select[name='terrain']")[0]?.value || "").trim().toLowerCase(),
          tier: Number(html.find("select[name='tier']")[0]?.value || 1) || 1,
          label: String(html.find("input[name='label']")[0]?.value || "").trim()
        })
      });
      if (!payload) return;
      if (!payload.terrain) return ui.notifications?.warn?.("Pick a terrain for the travel table.");

      const terrain = payload.terrain;
      const tier = payload.tier;
      const id = `travel_${terrain}_t${tier}`;
      const labelDefault = `Travel ${terrain.charAt(0).toUpperCase() + terrain.slice(1)} Tier ${tier}`;

      if (tablesApi.getTable?.(id)) return ui.notifications?.warn?.(`A travel table for ${terrain} tier ${tier} already exists (${id}).`);

      const label = payload.label || labelDefault;
      await tablesApi.createTable(id, { id, label, scope: "travel", tags: ["travel", terrain, `tier${tier}`], entries: [] });
      await _openTableEditor(id);
      this.render(false);
    });

    // Repair: canonicalize travel table ids (travel_<terrain>_t<tier>) and merge
    // duplicates. Travel encounters resolve by exact id, so a stray suffix (e.g.
    // travel_swamp_t1_EFyI from old Duplicate) silently breaks the lookup.
    html.find("[data-action='fix-travel-ids']").on("click", async ev => {
      ev.preventDefault();
      const api = this._requireApi(); if (!api) return;
      const tablesApi = api.tables;
      if (!tablesApi?.getAllTables || !tablesApi?.setAllTables) return ui.notifications?.warn?.("Encounter Tables API not ready.");

      const all = tablesApi.getAllTables() || {};

      // Group travel tables by their canonical id.
      const groups = new Map(); // canonical -> [{id, table}]
      const unparseable = [];
      for (const [id, t] of Object.entries(all)) {
        if (String(t?.scope || "") !== "travel") continue;
        let parsed = _parseTravelTableId(id);
        if (!parsed) {
          // Fallback: recover terrain/tier from tags (e.g. ["travel","swamp","tier1"]).
          const tags = Array.isArray(t?.tags) ? t.tags.map(s => String(s).toLowerCase()) : [];
          const terr = _builderTravelTerrainKeys().find(k => tags.includes(k.toLowerCase()));
          const tierTag = tags.map(s => s.match(/^t(?:ier)?(\d+)$/)).find(Boolean);
          if (terr && tierTag) parsed = { terrain: terr, tier: Number(tierTag[1]) || 1 };
        }
        if (!parsed) { unparseable.push(id); continue; }
        const canon = _composeTravelTableId(parsed.terrain, parsed.tier);
        if (!groups.has(canon)) groups.set(canon, []);
        groups.get(canon).push({ id, table: t });
      }

      // Build the change plan.
      const ops = []; // { canon, keeperId, renameFrom, deletes:[], mergedFrom:[], addedEntries }
      const entryKey = e => `${e?.campaignId || ""}|${e?.beatId || ""}|${JSON.stringify(e?.conditions || {})}`;
      for (const [canon, members] of groups) {
        const needsWork = members.length > 1 || members.some(m => m.id !== canon);
        if (!needsWork) continue;

        // A non-travel table already squatting the canonical id blocks repair.
        const squatter = all[canon];
        if (squatter && String(squatter.scope || "") !== "travel") {
          unparseable.push(`${canon} (blocked: non-travel table owns this id)`);
          continue;
        }

        // Keeper: the already-canonical table if present, else the richest one.
        const keeper = members.find(m => m.id === canon)
          || members.slice().sort((a, b) => (b.table.entries?.length || 0) - (a.table.entries?.length || 0))[0];
        const others = members.filter(m => m !== keeper);

        // Merge entries from the others into the keeper (deduped).
        const merged = Array.isArray(keeper.table.entries) ? keeper.table.entries.slice() : [];
        const seen = new Set(merged.map(entryKey));
        let added = 0;
        for (const o of others) {
          for (const e of (Array.isArray(o.table.entries) ? o.table.entries : [])) {
            const k = entryKey(e);
            if (seen.has(k)) continue;
            seen.add(k); merged.push(e); added++;
          }
        }

        ops.push({
          canon,
          keeperId: keeper.id,
          renameFrom: keeper.id !== canon ? keeper.id : null,
          deletes: others.map(o => o.id),
          mergedFrom: others.filter(o => (o.table.entries?.length || 0) > 0).map(o => o.id),
          addedEntries: added,
          mergedEntries: merged,
          label: keeper.table.label || canon,
          scope: "travel",
          tags: Array.isArray(keeper.table.tags) ? keeper.table.tags : []
        });
      }

      // Project the id-canonicalization onto a working copy, THEN scan every
      // travel table for entry-condition mismatches (e.g. a swamp table whose
      // entries are conditioned to terrain:"plains" — those entries get filtered
      // out in-world, leaving only the (Any) entry, so you always roll the same one).
      const next = foundry.utils.deepClone(all);
      for (const op of ops) {
        for (const d of op.deletes) delete next[d];
        if (op.renameFrom) delete next[op.renameFrom];
        next[op.canon] = { id: op.canon, label: op.label, scope: "travel", tags: op.tags, entries: op.mergedEntries };
      }

      const norm = s => String(s || "").trim().toLowerCase();
      const entryFixes = []; // { id, terrain, tier, count }
      for (const [id, t] of Object.entries(next)) {
        if (String(t?.scope || "") !== "travel") continue;
        const parsed = _parseTravelTableId(id);
        if (!parsed) continue;
        const wantTerr = norm(parsed.terrain);
        const wantTier = String(parsed.tier);
        let count = 0;
        for (const e of (Array.isArray(t.entries) ? t.entries : [])) {
          const c = e.conditions || (e.conditions = {});
          // Only correct an entry that explicitly names a DIFFERENT terrain.
          // Leave (Any)/blank entries alone — those are intentionally wildcard.
          if (c.terrain && norm(c.terrain) !== wantTerr) { c.terrain = parsed.terrain; count++; }
          if (c.tier && String(c.tier) !== wantTier) { c.tier = wantTier; count++; }
        }
        if (count) entryFixes.push({ id, terrain: parsed.terrain, tier: parsed.tier, count });
      }

      if (!ops.length && !entryFixes.length) {
        ui.notifications?.info?.(unparseable.length
          ? `Travel tables look healthy. ${unparseable.length} could not be parsed (see console).`
          : "Travel tables look healthy — nothing to fix.");
        if (unparseable.length) console.warn(TAG, "Unparseable/blocked travel tables:", unparseable);
        return;
      }

      // Review dialog — nothing is written until the GM confirms.
      const idRows = ops.map(op => {
        const bits = [];
        if (op.renameFrom) bits.push(`rename <code>${_escapeHtml(op.renameFrom)}</code> → <code>${_escapeHtml(op.canon)}</code>`);
        else bits.push(`keep <code>${_escapeHtml(op.canon)}</code>`);
        if (op.deletes.length) bits.push(`merge + delete ${op.deletes.map(d => `<code>${_escapeHtml(d)}</code>`).join(", ")} (+${op.addedEntries} entries)`);
        return `<li>${bits.join("; ")}</li>`;
      }).join("");
      const entryRows = entryFixes.map(f =>
        `<li><code>${_escapeHtml(f.id)}</code>: re-point ${f.count} mismatched entry condition(s) → terrain <b>${_escapeHtml(f.terrain)}</b> / tier <b>${f.tier}</b></li>`
      ).join("");
      const warnHtml = unparseable.length
        ? `<p class="bbttcc-muted">⚠ ${unparseable.length} table(s) couldn't be parsed and will be left untouched (see console).</p>`
        : "";

      const confirmed = await Dialog.confirm({
        title: "Fix Travel Tables",
        content: `<div style="max-height:55vh;overflow:auto;">
            ${ops.length ? `<p><b>ID / merge changes (${ops.length}):</b></p><ul style="margin:.25rem 0 .5rem 1.1rem;">${idRows}</ul>` : ""}
            ${entryFixes.length ? `<p><b>Entry condition fixes (${entryFixes.length} table(s)):</b></p><ul style="margin:.25rem 0 .5rem 1.1rem;">${entryRows}</ul>` : ""}
            ${warnHtml}
          </div>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
      });
      if (!confirmed) return;
      if (unparseable.length) console.warn(TAG, "Unparseable/blocked travel tables (left untouched):", unparseable);

      // `next` already carries both the id ops and the entry-condition fixes.
      const renamed = ops.filter(o => o.renameFrom).length;
      const mergedCount = ops.reduce((s, o) => s + o.deletes.length, 0);
      const entryCount = entryFixes.reduce((s, f) => s + f.count, 0);
      await tablesApi.setAllTables(next);
      ui.notifications?.info?.(`Travel table repair complete: ${renamed} renamed, ${mergedCount} merged/removed, ${entryCount} entry condition(s) fixed.`);
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

      const isTravel = String(src.scope || "") === "travel";
      const suggestedLabel = `${String(src.label || src.id || "Table")} (Copy)`;

      let newId;
      let label;

      if (isTravel) {
        // Travel copies must land on a valid travel_<terrain>_t<tier> id, so pick
        // terrain/tier rather than typing a free-text id that breaks the lookup.
        const terrainKeys = _builderTravelTerrainKeys();
        const terrainOpts = terrainKeys.map(k =>
          `<option value="${_escapeHtml(k)}">${_escapeHtml(k.charAt(0).toUpperCase() + k.slice(1))}</option>`
        ).join("");
        const tierOpts = [1,2,3,4].map(t => `<option value="${t}">Tier ${t}</option>`).join("");

        const payload = await Dialog.prompt({
          title: "Duplicate Travel Table",
          content: `
            <p class="bbttcc-muted">Copy to a new terrain/tier. Table ID is composed automatically.</p>
            <div class="form-group"><label>Terrain</label><select name="terrain">${terrainOpts}</select></div>
            <div class="form-group"><label>Tier</label><select name="tier">${tierOpts}</select></div>
            <div class="form-group"><label>Label</label><input type="text" name="label" value="${_escapeHtml(suggestedLabel)}" /></div>
          `,
          label: "Duplicate",
          callback: html => ({
            terrain: String(html.find("select[name='terrain']")[0]?.value || "").trim(),
            tier: Number(html.find("select[name='tier']")[0]?.value || 1) || 1,
            label: String(html.find("input[name='label']")[0]?.value || suggestedLabel).trim()
          })
        });
        if (!payload) return;
        if (!payload.terrain) return ui.notifications?.warn?.("Pick a terrain for the travel table.");
        newId = `travel_${payload.terrain}_t${payload.tier}`;
        label = payload.label || `Travel ${payload.terrain} Tier ${payload.tier}`;
      } else {
        const suggestedId = `${String(src.id || "table")}_copy_${randomID().slice(0,4)}`;
        const payload = await Dialog.prompt({
          title: "Duplicate Table",
          content: `
            <div class="form-group"><label>New Table ID</label><input type="text" name="id" value="${_escapeHtml(suggestedId)}" /></div>
            <div class="form-group"><label>Label</label><input type="text" name="label" value="${_escapeHtml(suggestedLabel)}" /></div>
          `,
          label: "Duplicate",
          callback: html => ({
            id: String(html.find("input[name='id']")[0]?.value || suggestedId).trim(),
            label: String(html.find("input[name='label']")[0]?.value || suggestedLabel).trim()
          })
        });
        if (!payload) return;
        newId = _slugifyTableId(payload.id);
        label = payload.label || suggestedLabel;
      }

      if (!newId) return ui.notifications?.warn?.("New table id is required.");
      if (tablesApi.getTable?.(newId)) return ui.notifications?.warn?.(`A table with id '${newId}' already exists.`);

      src.id = newId;
      src.label = String(label).trim() || newId;
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
    // Travel table filters + preview
    // ---------------------------

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

    html.find("[data-action='travel-preview']").on("click", async (ev) => {
      ev.preventDefault();
      const campaignId = this.campaignId || _getActiveCampaignId();
      if (!campaignId) return ui.notifications?.warn?.("Select a campaign first.");

      // Soft Guard: don't preview unless travel tables actually exist. Check the
      // SAME source the list (and the engine) use — the global encounterTables
      // setting, scope:"travel" — not the old per-campaign embedded config.
      const tablesApi = game.bbttcc?.api?.campaign?.tables;
      if (!tablesApi?.runRandomTable) return ui.notifications?.warn?.("Encounter Tables API not ready (runRandomTable missing).");

      const hasAnyTravelTable = (tablesApi.listTables?.() || [])
        .some(t => String(t?.scope || "") === "travel");
      if (!hasAnyTravelTable) {
        this.travelPreview = null;
        ui.notifications?.info?.("No travel tables exist yet. Use “+ New Travel Table” to create one.");
        this.render(false);
        return;
      }

      // Raw selections: terrain "" = All terrains, tier "0" = All tiers.
      const rawTerrain = String(rootEl.querySelector(`[data-role="travel-terrain"]`)?.value || "").trim();
      const rawTier = Number(rootEl.querySelector(`[data-role="travel-tier"]`)?.value || 0) || 0;
      const tier = rawTier || 1;
      const terrain = rawTerrain || "plains";

      this.travelTier = tier;
      this.travelTerrain = terrain;

      // Roll off the LIVE travel tables (same path as the table-editor preview).
      // The old __encounters.rollEncounter engine is retired and always returns
      // null, which is why this button used to do nothing.
      let tableId = null;
      if (rawTerrain) {
        // Specific terrain: resolve the canonical id the way the engine does —
        // terrain-specific first, then the generic tier fallback.
        const candidates = [
          `travel_${terrain}_t${tier}`,
          `travel_${terrain}_tier${tier}`,
          `travel_generic_t${tier}`
        ];
        tableId = candidates.find(id => tablesApi.getTable?.(id)) || null;
        if (!tableId) {
          this.travelPreview = null;
          ui.notifications?.warn?.(`No travel table found for ${terrain} tier ${tier} (looked for ${candidates.join(", ")}).`);
          this.render(false);
          return;
        }
      } else {
        // "All terrains": pick any existing travel table, honoring the tier filter
        // if one is set, so a preview always rolls something real.
        const pool = (tablesApi.listTables?.() || [])
          .filter(t => String(t?.scope || "") === "travel")
          .filter(t => {
            if (!rawTier) return true;
            const p = _parseTravelTableId(t.id);
            return p && Number(p.tier) === rawTier;
          });
        if (!pool.length) {
          this.travelPreview = null;
          ui.notifications?.warn?.(rawTier ? `No travel tables for tier ${rawTier}.` : "No travel tables to preview.");
          this.render(false);
          return;
        }
        // Deterministic-ish: first by id, so repeated clicks are stable per filter.
        tableId = pool.map(t => t.id).sort()[0];
      }

      try {
        // TRUE DRY-RUN: runRandomTable({ dryRun: true }) rolls the table (same
        // conditions + weights as the live engine) but returns the pick WITHOUT
        // executing the beat — no scene activation, no dialogs, no world
        // effects, no time cost.
        const res = await tablesApi.runRandomTable({ tableId, tags: "preview", dryRun: true });
        const beatId = String(res?.beatId || "").trim();
        const resCampaignId = String(res?.campaignId || campaignId || "").trim();

        // Pretty beat label from the campaign, fall back to the raw id.
        let beatLabel = beatId || "(none)";
        let beatType = "";
        try {
          const cc = game.bbttcc?.api?.campaign?.getCampaign?.(resCampaignId);
          const beat = Array.isArray(cc?.beats) ? cc.beats.find(b => b?.id === beatId) : null;
          if (beat) {
            beatLabel = String(beat.label || beat.title || beatId).trim();
            beatType = String(beat.type || "").trim();
          }
        } catch (_e) {}

        this.travelPreview = beatId
          ? { tableId, beatId, label: beatLabel, campaignId: resCampaignId }
          : null;

        if (!beatId) {
          ui.notifications?.warn?.(`Table ${tableId} rolled no eligible beat (check entries/weights).`);
        } else if (res?.dryRun !== true) {
          // Engine older than the dry-run API: it executed the beat for real.
          ui.notifications?.warn?.(`Preview: ${tableId} → ${beatLabel} — but the tables engine has no dry-run support and RAN the beat.`);
        } else {
          // Show the result with a clearly-labeled escalation path.
          const runIt = await Dialog.wait({
            title: "Travel Preview — Dry Run",
            content: `
              <div class="bbttcc-travel-preview-result">
                <p><b>${_escapeHtml(beatLabel)}</b>${beatType ? ` <span class="bbttcc-muted">(${_escapeHtml(beatType)})</span>` : ""}</p>
                <p class="bbttcc-muted">
                  Table <code>${_escapeHtml(tableId)}</code>
                  → beat <code>${_escapeHtml(beatId)}</code>
                  ${resCampaignId ? ` · campaign <code>${_escapeHtml(resCampaignId)}</code>` : ""}
                </p>
                <p>This was a <b>dry run</b> — nothing has fired. Each preview re-rolls the weights.</p>
              </div>`,
            buttons: {
              run: {
                icon: '<i class="fas fa-play"></i>',
                label: "Run This Beat Now (for real)",
                callback: () => true
              },
              close: { label: "Close", callback: () => false }
            },
            default: "close",
            close: () => false
          });

          if (runIt && game.bbttcc?.api?.campaign?.runBeat) {
            await game.bbttcc.api.campaign.runBeat(resCampaignId, beatId, { tableId, tags: "preview" });
          }
        }
      } catch (err) {
        console.error(TAG, "Travel preview roll failed", err);
        ui.notifications?.error?.(`Travel preview failed: ${err?.message || err}`);
        this.travelPreview = null;
      }
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
      const factionRows = factions.length
        ? factions.map(f => `
            <label class="bbttcc-faction-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;">
              <input type="checkbox" name="factionIds" value="${_escapeHtml(f.uuid)}" />
              <input type="radio" name="factionPrimary" value="${_escapeHtml(f.uuid)}" title="Set primary" />
              <span>${_escapeHtml(f.name)}</span>
            </label>
          `).join("")
        : `<p class="bbttcc-muted">No faction actors found in this world.</p>`;

      const payload = await Dialog.prompt({
        title: "New Campaign",
        content: `
          <p>Create a new Bad Eden campaign.</p>
          <div class="form-group">
            <label>Label</label>
            <input type="text" name="label" value="New Campaign (${id.slice(0, 4)})" />
          </div>
          <div class="form-group">
            <label>Active Factions</label>
            <div class="bbttcc-faction-picker" style="max-height:220px;overflow:auto;border:1px solid var(--color-border-light-tertiary,#888);padding:6px 8px;border-radius:4px;">
              ${factionRows}
            </div>
            <p class="notes">Check every faction involved in this campaign. The radio marks the <strong>primary</strong> (used for inherited world-effects, war-log targeting, and casualty defaults). All checked factions receive credit/WME fan-out.</p>
          </div>
        `,
        label: "Create",
        callback: html => {
          const label = html.find("input[name='label']")[0]?.value || `New Campaign (${id.slice(0, 4)})`;
          const factionIds = html.find("input[name='factionIds']:checked").map((_, el) => el.value).get();
          const primaryPick = html.find("input[name='factionPrimary']:checked")[0]?.value || "";
          // Primary must be in the checked set; otherwise fall back to first checked.
          const factionId = (primaryPick && factionIds.includes(primaryPick))
            ? primaryPick
            : (factionIds[0] || "");
          return { label, factionIds, factionId };
        }
      });

      const label = payload?.label ?? `New Campaign (${id.slice(0, 4)})`;
      const factionId = String(payload?.factionId || "").trim() || null;
      const factionIds = Array.isArray(payload?.factionIds)
        ? payload.factionIds.map(x => String(x || "").trim()).filter(Boolean)
        : [];

      const campaign = await api.createCampaign(id, { id, label, description: "", beats: [], factionId, factionIds });
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

      // Cascade-or-warn: encounter/travel tables point at beats by
      // (campaignId, beatId). Deleting the campaign leaves those entries
      // dangling — list them so the GM knows what will silently stop firing.
      const tableRefs = [];
      try {
        const allTables = api.tables?.getAllTables?.() || {};
        for (const [tid, t] of Object.entries(allTables)) {
          const entries = Array.isArray(t?.entries) ? t.entries : [];
          const n = entries.filter(e => String(e?.campaignId || "").trim() === String(id)).length;
          if (n) tableRefs.push({ tableId: tid, label: String(t?.label || tid), count: n });
        }
      } catch (_eScan) {}

      const refsHtml = tableRefs.length
        ? `<p><b>⚠ ${tableRefs.length} encounter table(s) reference this campaign's beats:</b></p>
           <ul style="margin:.25rem 0 .5rem 1.1rem;max-height:30vh;overflow:auto;">
             ${tableRefs.map(r => `<li><code>${_escapeHtml(r.tableId)}</code> (${_escapeHtml(r.label)}) — ${r.count} entr${r.count === 1 ? "y" : "ies"}</li>`).join("")}
           </ul>
           <p class="bbttcc-muted">Those entries will go dead (roll → nothing). Clean them up in the Table Editor afterwards.</p>`
        : "";

      const yes = await Dialog.confirm({
        title: "Delete Campaign?",
        content: `<p>Delete campaign <strong>${_escapeHtml(id)}</strong> and all its beats? This cannot be undone.</p>${refsHtml}`
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
        ui.notifications?.warn?.("Campaign API missing runCampaign().");
        return;
      }
      await api.runCampaign(id);
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
      const currentIds = Array.isArray(campaign.factionIds) ? campaign.factionIds.map(String) : [];
      const currentPrimary = String(campaign.factionId || "");
      const factionRows = factions.length
        ? factions.map(f => {
            const uuid = String(f.uuid);
            const checked = currentIds.includes(uuid) ? "checked" : "";
            const isPrimary = uuid === currentPrimary ? "checked" : "";
            return `
              <label class="bbttcc-faction-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;">
                <input type="checkbox" name="factionIds" value="${_escapeHtml(uuid)}" ${checked} />
                <input type="radio" name="factionPrimary" value="${_escapeHtml(uuid)}" title="Set primary" ${isPrimary} />
                <span>${_escapeHtml(f.name)}</span>
              </label>
            `;
          }).join("")
        : `<p class="bbttcc-muted">No faction actors found in this world.</p>`;

      const activeId = _getActiveCampaignId();
      const isActive = String(activeId || "") === String(campaign.id || "");

      const payload = await Dialog.prompt({
        title: "Campaign Settings",
        content: `
          <p>Adjust campaign label/description, active factions, and set the Active campaign.</p>
          <div class="form-group">
            <label>Label</label>
            <input type="text" name="label" value="${_escapeHtml(campaign.label || campaign.id)}" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="4">${_escapeHtml(campaign.description || "")}</textarea>
          </div>
          <div class="form-group">
            <label>Active Factions</label>
            <div class="bbttcc-faction-picker" style="max-height:220px;overflow:auto;border:1px solid var(--color-border-light-tertiary,#888);padding:6px 8px;border-radius:4px;">
              ${factionRows}
            </div>
            <p class="notes">Check every faction involved. The radio marks the <strong>primary</strong> (used for beat inheritance, war-log targeting, casualty defaults). All checked factions receive credit/WME fan-out.</p>
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
          const factionIds = html.find("input[name='factionIds']:checked").map((_, el) => el.value).get();
          const primaryPick = html.find("input[name='factionPrimary']:checked")[0]?.value || "";
          const factionId = (primaryPick && factionIds.includes(primaryPick))
            ? primaryPick
            : (factionIds[0] || "");
          const active = !!html.find("input[name='active']")[0]?.checked;
          return { label, description, factionIds, factionId, active };
        }
      });

      const oldFaction = String(campaign.factionId || "").trim();
      const nextFaction = String(payload?.factionId || "").trim();
      const nextFactionIds = Array.isArray(payload?.factionIds)
        ? payload.factionIds.map(x => String(x || "").trim()).filter(Boolean)
        : [];

      campaign.label = String(payload?.label || campaign.label || campaign.id);
      campaign.description = String(payload?.description || "");
      campaign.factionIds = nextFactionIds;

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

      // Cascade: hex↔quest links are unlinked automatically (both sides) via
      // the territory quest-links API, so no orphaned hex flags are left behind.
      const ql = game?.bbttcc?.api?.territory?.questLinks || null;
      let linkedHexes = [];
      try { linkedHexes = ql?.listHexesForQuest ? (ql.listHexesForQuest(qid) || []) : []; } catch (_eLH) {}

      const hexHtml = linkedHexes.length
        ? `<p><b>${linkedHexes.length} linked hex${linkedHexes.length === 1 ? "" : "es"}</b> will be unlinked automatically:</p>
           <ul style="margin:.25rem 0 .5rem 1.1rem;max-height:30vh;overflow:auto;">
             ${linkedHexes.map(h => `<li>⬢ ${_escapeHtml(h.hexName || h.drawingId || "?")}${h.sceneName ? ` <span class="bbttcc-muted">/ ${_escapeHtml(h.sceneName)}</span>` : ""}</li>`).join("")}
           </ul>`
        : "";

      const yes = await Dialog.confirm({
        title: "Delete Quest?",
        content: `<p>Delete quest <strong>${_escapeHtml(qid)}</strong>? Beats will keep their questId, but the quest will vanish from the registry.</p>${hexHtml}`
      });
      if (!yes) return;

      // Unlink hexes first (both sides), then delete the registry record.
      let unlinked = 0;
      if (ql?.unlinkHexQuest) {
        for (const h of linkedHexes) {
          try { await ql.unlinkHexQuest(h.drawingId, qid); unlinked++; }
          catch (eU) { console.warn(TAG, "delete-quest: unlink failed for hex", h?.drawingId, eU); }
        }
      }

      await qapi.deleteQuest(qid);
      ui.notifications?.info?.(unlinked
        ? `Quest deleted (${unlinked} hex link${unlinked === 1 ? "" : "s"} removed).`
        : "Quest deleted.");
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

    // Quest reorder (registry order).
    // IMPORTANT: always swap against the FULL unfiltered quest order — never the
    // filtered/searched view. Otherwise ▲/▼ under an active filter would swap
    // order values across hidden quests and scramble the registry. With an
    // active filter the swap partner may be a hidden neighbor, so the visible
    // list can legitimately look unchanged.
    const _swapQuestOrder = async (qid, dir) => {
      const api = this._requireApi(); if (!api) return;
      const qapi = api.quests;
      if (!qapi || !qapi.listQuests || !qapi.saveQuest) return ui.notifications?.warn?.("Quest API not ready.");

      const list = qapi.listQuests({ campaignId: this.campaignId || null, status: "all", search: "" }) || [];
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

    // ───────── Quest ↔ Hex link handlers ─────────
    const _ql = () => game?.bbttcc?.api?.territory?.questLinks || null;
    const _findHexDoc = (drawingId, sceneId) => {
      const sc = sceneId ? game.scenes?.get(sceneId) : null;
      if (sc) return sc.drawings?.get(drawingId) || null;
      for (const s of (game.scenes ?? [])) {
        const d = s?.drawings?.get(drawingId);
        if (d) return d;
      }
      return null;
    };

    html.find("[data-action='quest-link-hex-pick']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      const ql = _ql();
      if (!qid || !ql) { ui.notifications?.warn?.("Quest links API not ready."); return; }
      // Two-pass: dialog asks the GM to click a hex on the active scene.
      ui.notifications?.info?.("Click a Bad Eden hex on the canvas to link it to this quest. (Esc to cancel)");
      const onClick = async (event) => {
        try {
          const t = event?.target;
          const dr = (t && t.parent) ? canvas.drawings?.placeables?.find(p => p?.children?.includes?.(t) || p === t || p?.controlIcon === t) : null;
          // Fallback: hit-test by world coordinates against drawing bounds.
          let pick = dr;
          if (!pick) {
            const local = event?.data?.getLocalPosition?.(canvas.app.stage);
            if (local) {
              for (const p of (canvas.drawings?.placeables || [])) {
                const d = p?.document; if (!d) continue;
                const f = d.flags?.["bbttcc-territory"]; if (!f) continue;
                const isHex = (f.isHex === true) || (f.kind === "territory-hex")
                  || (d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length === 12);
                if (!isHex) continue;
                const b = { minX: d.x, minY: d.y, maxX: d.x + (d.shape?.width || 0), maxY: d.y + (d.shape?.height || 0) };
                if (local.x >= b.minX && local.x <= b.maxX && local.y >= b.minY && local.y <= b.maxY) { pick = p; break; }
              }
            }
          }
          if (!pick?.document) { ui.notifications?.warn?.("Not a hex drawing — cancelled."); return; }
          await ql.linkHexQuest(pick.document.id, qid, { hinted: false });
          ui.notifications?.info?.("Hex linked to quest.");
          this.render(false);
        } catch (e) {
          console.warn("[bbttcc-campaign] quest-link click failed", e);
        } finally {
          canvas.stage?.off("pointerdown", onClick);
        }
      };
      canvas.stage?.once("pointerdown", onClick);
    });

    html.find("[data-action='quest-toggle-hex-hint']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      const did = ev.currentTarget?.dataset?.drawingId;
      const ql = _ql(); if (!qid || !did || !ql) return;
      const list = ql.listQuestsForHex(did);
      const cur = list.find(l => l.questId === qid);
      try {
        await ql.setHint(did, qid, { hinted: !cur?.hinted });
        this.render(false);
      } catch (e) { console.warn("setHint failed", e); }
    });

    html.find("[data-action='quest-pan-to-hex']").on("click", async (ev) => {
      ev.preventDefault();
      const did = ev.currentTarget?.dataset?.drawingId;
      const sid = ev.currentTarget?.dataset?.sceneId;
      const sc = sid ? game.scenes?.get(sid) : null;
      if (sc && canvas?.scene?.id !== sc.id) await sc.view();
      const doc = _findHexDoc(did, sid);
      if (!doc) { ui.notifications?.warn?.("Hex drawing not found."); return; }
      try {
        const cx = (doc.x || 0) + (doc.shape?.width || 0) / 2;
        const cy = (doc.y || 0) + (doc.shape?.height || 0) / 2;
        canvas.pan({ x: cx, y: cy, scale: Math.max(0.5, canvas.stage.scale?.x || 1) });
      } catch (e) { console.warn("pan failed", e); }
    });

    html.find("[data-action='quest-unlink-hex']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      const did = ev.currentTarget?.dataset?.drawingId;
      const ql = _ql(); if (!qid || !did || !ql) return;
      const yes = await Dialog.confirm({ title: "Unlink Hex?", content: `<p>Remove the link between this hex and the quest?</p>` });
      if (!yes) return;
      await ql.unlinkHexQuest(did, qid);
      this.render(false);
    });

    html.find("[data-action='quest-reveal-all-hints']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      const ql = _ql(); if (!qid || !ql) return;
      const n = await ql.revealAllForQuest(qid, true);
      ui.notifications?.info?.(`Revealed ${n ?? 0} quest hint${n === 1 ? "" : "s"}.`);
      this.render(false);
    });

    html.find("[data-action='quest-clear-all-hints']").on("click", async (ev) => {
      ev.preventDefault();
      const qid = ev.currentTarget?.dataset?.questId;
      const ql = _ql(); if (!qid || !ql) return;
      const n = await ql.clearAllHintsForQuest(qid);
      ui.notifications?.info?.(`Cleared ${n ?? 0} quest hint${n === 1 ? "" : "s"}.`);
      this.render(false);
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

      // Soft-lock: a beat the director record shows as already fired (any
      // surface) asks for one confirmation — never blocked, the GM menu
      // stays a full fallback.
      try {
        const dstate = game.bbttcc?.api?.campaign?.director?.state?.() || null;
        const f = dstate ? (dstate.firedStoryBeats?.[beatId] || dstate.dialogueFired?.[beatId]) : null;
        if (f) {
          const beat = (api.getCampaign?.(campaignId)?.beats || []).find(b => String(b?.id) === String(beatId));
          const ok = await Dialog.confirm({
            title: "Beat already fired",
            content: `<p><b>${foundry.utils.escapeHTML(beat?.label || beatId)}</b> has already fired${f.turn ? ` (turn ${f.turn})` : ""} according to the Story Director record.</p><p>Run it again anyway?</p>`
          });
          if (!ok) return;
        }
      } catch (_eSoft) { /* fail-open: the menu must never break */ }

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

      const norm = s => String(s || "").trim();
      const target = norm(beatId);

      // Cascade-or-warn: scan the campaign's OTHER beats for links that point
      // at this beat (next / outcomes.success / outcomes.failure /
      // choices[].next / choices[].failNext), plus encounter-table entries.
      const campaign = foundry.utils.deepClone(api.getCampaign(campaignId));
      const beats = Array.isArray(campaign?.beats) ? campaign.beats : [];

      const beatRefs = []; // { fromId, fromLabel, where }
      for (const b of beats) {
        if (!b || typeof b !== "object") continue;
        const fromId = norm(b.id);
        if (!fromId || fromId === target) continue;

        const where = [];
        if (norm(b.next) === target) where.push("next");
        if (norm(b.outcomes?.success) === target) where.push("outcomes.success");
        if (norm(b.outcomes?.failure) === target) where.push("outcomes.failure");
        const choices = Array.isArray(b.choices) ? b.choices : [];
        choices.forEach((ch, i) => {
          if (!ch) return;
          if (norm(ch.next) === target) where.push(`choice ${i + 1} → next`);
          if (norm(ch.failNext) === target) where.push(`choice ${i + 1} → failNext`);
        });

        if (where.length) beatRefs.push({ fromId, fromLabel: String(b.label || fromId), where });
      }

      const tableRefs = []; // { tableId, label, count }
      try {
        const allTables = api.tables?.getAllTables?.() || {};
        for (const [tid, t] of Object.entries(allTables)) {
          const entries = Array.isArray(t?.entries) ? t.entries : [];
          const n = entries.filter(e =>
            norm(e?.campaignId) === norm(campaignId) && norm(e?.beatId) === target
          ).length;
          if (n) tableRefs.push({ tableId: tid, label: String(t?.label || tid), count: n });
        }
      } catch (_eScan) {}

      const hasRefs = beatRefs.length || tableRefs.length;

      let refsHtml = "";
      if (hasRefs) {
        const beatRows = beatRefs.map(r =>
          `<li><b>${_escapeHtml(r.fromLabel)}</b> <code>${_escapeHtml(r.fromId)}</code> — ${_escapeHtml(r.where.join(", "))}</li>`
        ).join("");
        const tableRows = tableRefs.map(r =>
          `<li>Table <code>${_escapeHtml(r.tableId)}</code> (${_escapeHtml(r.label)}) — ${r.count} entr${r.count === 1 ? "y" : "ies"}</li>`
        ).join("");
        refsHtml = `
          <p><b>⚠ Other content links to this beat:</b></p>
          <ul style="margin:.25rem 0 .5rem 1.1rem;max-height:30vh;overflow:auto;">${beatRows}${tableRows}</ul>
          <p class="bbttcc-muted"><b>Delete + Clear Links</b> also nulls those routes and removes the table entries. <b>Delete Only</b> leaves them dangling (dead routes, silent no-op table rolls).</p>`;
      }

      let choice;
      if (hasRefs) {
        choice = await Dialog.wait({
          title: "Delete Beat?",
          content: `<p>Delete beat <strong>${_escapeHtml(beatId)}</strong>? This cannot be undone.</p>${refsHtml}`,
          buttons: {
            cascade: {
              icon: '<i class="fas fa-broom"></i>',
              label: "Delete + Clear Links",
              callback: () => "cascade"
            },
            del: {
              icon: '<i class="fas fa-trash"></i>',
              label: "Delete Only",
              callback: () => "delete"
            },
            cancel: { label: "Cancel", callback: () => null }
          },
          default: "cancel",
          close: () => null
        });
      } else {
        const yes = await Dialog.confirm({
          title: "Delete Beat?",
          content: `<p>Delete beat <strong>${_escapeHtml(beatId)}</strong>? Nothing else links to it. This cannot be undone.</p>`
        });
        choice = yes ? "delete" : null;
      }
      if (!choice) return;

      // Remove the beat; optionally clear every dangling link found above.
      campaign.beats = beats.filter(b => norm(b?.id) !== target);
      if (choice === "cascade") {
        for (const b of campaign.beats) {
          if (!b || typeof b !== "object") continue;
          if (norm(b.next) === target) b.next = null;
          if (b.outcomes) {
            if (norm(b.outcomes.success) === target) b.outcomes.success = null;
            if (norm(b.outcomes.failure) === target) b.outcomes.failure = null;
          }
          for (const ch of (Array.isArray(b.choices) ? b.choices : [])) {
            if (!ch) continue;
            if (norm(ch.next) === target) ch.next = null;
            if (norm(ch.failNext) === target) ch.failNext = null;
          }
        }
      }

      await api.saveCampaign(campaignId, campaign);

      // Table-entry cascade (global registry, separate save).
      if (choice === "cascade" && tableRefs.length && api.tables?.getAllTables && api.tables?.setAllTables) {
        try {
          const allTables = foundry.utils.deepClone(api.tables.getAllTables() || {});
          for (const r of tableRefs) {
            const t = allTables[r.tableId];
            if (!t || !Array.isArray(t.entries)) continue;
            t.entries = t.entries.filter(e =>
              !(norm(e?.campaignId) === norm(campaignId) && norm(e?.beatId) === target)
            );
          }
          await api.tables.setAllTables(allTables);
        } catch (eTab) {
          console.warn(TAG, "delete-beat: table-entry cascade failed", eTab);
          ui.notifications?.warn?.("Beat deleted, but clearing encounter-table entries failed (see console).");
        }
      }

      ui.notifications?.info?.(choice === "cascade"
        ? `Beat deleted; ${beatRefs.length} beat link(s) cleared${tableRefs.length ? ` and ${tableRefs.reduce((s, r) => s + r.count, 0)} table entr(ies) removed` : ""}.`
        : "Beat deleted.");
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

            layerNow.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => _restorePortalPop(pop));

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

            layerNow.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => _restorePortalPop(pop));

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
            .forEach(pop => _restorePortalPop(pop));
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
        _restorePortalPop(pop);
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
            layer.querySelectorAll(".bbttcc-actions-menu-pop[data-bbttcc-portaled=\"1\"]").forEach(pop => _restorePortalPop(pop));
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