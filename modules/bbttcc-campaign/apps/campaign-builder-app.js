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

// ─── Canonical beat address (2026-08-24, owner overhaul) ────────────────────
// "Beat 532" is a shelf position; the story address is ACT · QUEST · BEAT —
// act read from the beat's storyPhase gate (an explicit numeric `beat.act`
// overrides; ambient pool beats show 🎲), beat № = questStep rank within the
// quest. Beat IDS remain the only routing identity; the address is display
// truth that follows the data.
function beatActOf(b) {
  try {
    if (b && b.act != null && Number.isFinite(Number(b.act))) return String(Math.floor(Number(b.act)));
    if (b?.pacing?.ambient) return "🎲";
    const req = b?.inject?.requires;
    const arr = Array.isArray(req) ? req : (req ? [req] : []);
    for (const c of arr) {
      if (c && c.flag === "storyPhase") return String(Math.floor(Number(c.gte ?? c.eq) || 0));
    }
    return null;
  } catch (_e) { return null; }
}
function buildBeatAddressIndex(beats) {
  const byQuest = new Map();
  (beats || []).forEach((b, i) => {
    const q = String(b?.questId || "").trim() || "~unquested";
    if (!byQuest.has(q)) byQuest.set(q, []);
    const s = Number(b?.questStep);
    byQuest.get(q).push({ id: String(b?.id), seq: (b?.questStep != null && Number.isFinite(s)) ? s : 1e6 + i });
  });
  const idx = new Map();
  for (const rows of byQuest.values()) {
    rows.sort((a, b) => a.seq - b.seq);
    rows.forEach((r, i) => idx.set(r.id, { ord: i + 1, total: rows.length }));
  }
  return idx;
}
function beatAddress(b, idx) {
  const act = beatActOf(b);
  const a = idx?.get?.(String(b?.id)) || null;
  const actTxt = act === null ? "—" : (act === "🎲" ? "🎲" : `A${act}`);
  return {
    short: `${actTxt}·B${a?.ord ?? "?"}`,
    long: `Act ${act === null ? "— (ungated)" : act} · Beat ${a?.ord ?? "?"} of ${a?.total ?? "?"} in its quest`
  };
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
  // Canonical order of operations (2026-08-24 overhaul): Act → Quest →
  // questStep, always. The Beats tab reads as the campaign's intended flow,
  // not its authoring history; positional numbering is retired from display
  // in favor of the address (authoring pos survives in the tooltip).
  {
    const actRank = b => {
      const a = beatActOf(b);
      if (a === null) return 98;
      if (a === "🎲") return 99;
      return Number(a);
    };
    const seqOf = r => {
      const s = Number(r.beat?.questStep);
      return (r.beat?.questStep != null && Number.isFinite(s)) ? s : 1e6 + r.n;
    };
    const qn = b => String((questMap && questMap[String(b.questId || "").trim()]?.name) || b.questId || "~");
    out.sort((a, b) => actRank(a.beat) - actRank(b.beat)
      || qn(a.beat).localeCompare(qn(b.beat), undefined, { numeric: true })
      || seqOf(a) - seqOf(b)
      || String(a.beat.label || a.beat.id).localeCompare(String(b.beat.label || b.beat.id), undefined, { numeric: true }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Flow Visualizer — ONE QUEST AT A TIME, TOP-DOWN (2026-09-07 owner ruling).
// - The chart renders the quest the story is standing in (or the quest the GM
//   picked) as a top-down branching tree: root = the quest's opening beat,
//   branches = Next / Success / Failure / Choices.
// - Routes that leave the quest are drawn as EXIT STUBS ("→ Other Quest");
//   clicking one switches the chart to that quest.
// - Travel-leg beats (timeScale "leg") stay off unless the Travel toggle is on.
// - The old Quests-overview / Lanes modes and the Turn / Act / Scope filters
//   were retired the same day — a full-corpus display was the wrong tool for
//   the play surface. Authoring still lives on the Beats tab.
// ---------------------------------------------------------------------------

const FLOW_UNASSIGNED = "__unassigned__";

function _isTravelBeat(beat) {
  return String((beat && beat.timeScale) || "").trim().toLowerCase() === "leg";
}

function _flowQuestIdOf(b) {
  return String((b && b.questId) || "").trim() || FLOW_UNASSIGNED;
}

// Every outgoing route of a beat, in authoring order of the fields.
function _flowBeatEdges(b) {
  const out = [];
  const push = (to, kind, label) => {
    const t = String(to || "").trim();
    if (t) out.push({ to: t, kind, label: String(label || "") });
  };
  if (b?.next) push(b.next, "next", "Next");
  const o = b?.outcomes || null;
  if (o) {
    if (o.success) push(o.success, "success", "Success");
    if (o.failure) push(o.failure, "failure", "Failure");
  }
  const ch = Array.isArray(b?.choices) ? b.choices : [];
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (!c) continue;
    const lbl = c.label || ("Choice " + String(i + 1));
    if (c.next) push(c.next, "choice", lbl);
    if (c.failNext) push(c.failNext, "choice_fail", lbl + " (Fail)");
  }
  return out;
}

// Canonical quest order: questStep when authored, authoring index otherwise.
function _flowSeqOf(b, authIdx) {
  const s = Number(b?.questStep);
  if (b?.questStep != null && Number.isFinite(s)) return s;
  return 1e6 + (authIdx.get(String(b?.id)) ?? 0);
}

function _buildFlowGraph(campaign, opts) {
  opts = opts || {};
  const beatsAll = Array.isArray(campaign && campaign.beats) ? campaign.beats : [];
  const questId = String(opts.questId || "").trim() || FLOW_UNASSIGNED;
  const showTravel = !!opts.showTravel;
  const questNames = opts.questNames || {};
  const runtime = opts.runtime || null;

  const isTag = (b, key) => {
    try {
      let tags = b && b.tags;
      if (!tags) return false;
      if (typeof tags === "string") tags = tags.split(/\s*,\s*/g);
      if (!Array.isArray(tags)) return false;
      const k = String(key || "").trim().toLowerCase();
      return tags.some(t => { const s = String(t || "").trim().toLowerCase(); return s === k || s.indexOf(k + ":") === 0; });
    } catch (_e) { return false; }
  };
  const isTravel = b => _isTravelBeat(b) || isTag(b, "travel");
  const isCinematic = b => String((b && b.type) || "").trim().toLowerCase() === "cinematic";

  const authIdx = new Map(beatsAll.map((b, i) => [String(b?.id), i]));
  const allById = {};
  for (const b of beatsAll) if (b?.id) allById[String(b.id)] = b;

  // The quest's own beats (travel lane optional).
  const beats = beatsAll.filter(b => b && b.id && _flowQuestIdOf(b) === questId && (showTravel || !isTravel(b)));
  const byId = {};
  for (const b of beats) byId[String(b.id)] = b;
  const seqOf = b => _flowSeqOf(b, authIdx);

  // Edges inside the quest + exit stubs for routes that leave it.
  const edges = [];
  const adj = {};
  const inDeg = {};
  const stubs = {};   // targetBeatId -> stub node
  for (const b of beats) inDeg[String(b.id)] = 0;
  for (const b of beats) {
    const from = String(b.id);
    for (const e of _flowBeatEdges(b)) {
      const target = allById[e.to];
      if (!target) continue;                      // dangling route — the Census reports it
      if (byId[e.to]) {
        if (e.to === from) continue;              // self-loop: a hub returning to itself
        edges.push({ from, to: e.to, kind: e.kind, label: e.label });
        (adj[from] = adj[from] || []).push(e.to);
        inDeg[e.to] = (inDeg[e.to] || 0) + 1;
      } else {
        if (!showTravel && isTravel(target)) continue;
        const sid = "exit:" + e.to;
        if (!stubs[sid]) {
          const tq = _flowQuestIdOf(target);
          stubs[sid] = {
            id: sid,
            kind: "exit",
            label: String(target.label || target.id),
            targetBeatId: e.to,
            targetQuestId: tq,
            questName: (tq === FLOW_UNASSIGNED) ? "(no quest)" : String(questNames[tq] || tq),
            _order: authIdx.get(e.to) ?? 1e9
          };
        }
        edges.push({ from, to: sid, kind: e.kind, label: e.label });
        (adj[from] = adj[from] || []).push(sid);
      }
    }
  }

  // Root: the campaign's opening beat if it belongs here; else the earliest
  // beat (quest order) nothing inside the quest routes INTO; else the earliest.
  let rootId = null;
  const openId = String(campaign?.openingBeatId || "").trim();
  if (openId && byId[openId]) rootId = openId;
  if (!rootId && beats.length) {
    const sorted = beats.slice().sort((a, b) => seqOf(a) - seqOf(b));
    const orphanRoot = sorted.find(b => !inDeg[String(b.id)]);
    rootId = String((orphanRoot || sorted[0]).id);
  }

  // Tidy tree: x = in-order leaf slot, y = depth. Children in quest order.
  const orderOf = id => {
    if (stubs[id]) return stubs[id]._order;
    const b = byId[id];
    return b ? seqOf(b) : 1e9;
  };
  const kidsOf = id => (adj[id] || []).slice().sort((a, b) => (orderOf(a) - orderOf(b)) || String(a).localeCompare(String(b)));

  const assigned = {};
  const xPos = {};
  const yPos = {};
  let cursor = 0;
  const assign = (id, depth) => {
    if (assigned[id]) return;
    assigned[id] = true;
    const kids = kidsOf(id).filter(k => !assigned[k]);
    if (!kids.length) { xPos[id] = cursor++; yPos[id] = depth; return; }
    for (const k of kids) assign(k, depth + 1);
    let minx = Infinity, maxx = -Infinity;
    for (const k of kids) { const cx = xPos[k]; if (cx < minx) minx = cx; if (cx > maxx) maxx = cx; }
    xPos[id] = (isFinite(minx) && isFinite(maxx)) ? (minx + maxx) / 2 : cursor++;
    yPos[id] = depth;
  };
  if (rootId) assign(rootId, 0);
  // Forest pass: beats nothing routes into (side entrances, dialogue-only
  // beats) root their own trees to the right, in quest order.
  for (const b of beats.slice().sort((a, b) => seqOf(a) - seqOf(b))) {
    const id = String(b.id);
    if (!assigned[id]) assign(id, 0);
  }

  const NODE_W = 300, NODE_H = 92, STUB_W = 232, STUB_H = 46;
  const PAD_X = 60, PAD_Y = 70, GAP_X = 340, GAP_Y = 160;

  let minLeaf = Infinity;
  for (const k in xPos) if (xPos[k] < minLeaf) minLeaf = xPos[k];
  if (!isFinite(minLeaf)) minLeaf = 0;

  const nodes = [];
  const pos = {};
  let maxX = 0, maxY = 0;
  const place = (n, w, h) => {
    const x = PAD_X + Math.floor(((xPos[n.id] ?? 0) - minLeaf) * GAP_X) + Math.floor((NODE_W - w) / 2);
    const y = PAD_Y + Math.floor((yPos[n.id] ?? 0) * GAP_Y);
    pos[n.id] = { x, y };
    n.width = w; n.height = h;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
    nodes.push(n);
  };
  for (const b of beats) {
    const id = String(b.id);
    if (!assigned[id]) continue;
    place({
      id,
      kind: "beat",
      label: String(b.label || b.id || id),
      type: String(b.type || "custom"),
      timeScale: String(b.timeScale || "scene"),
      isTravel: isTravel(b),
      isCinematic: isCinematic(b),
      hasChoices: Array.isArray(b.choices) && b.choices.some(c => String(c?.label || "").trim()),
      rt: (runtime && runtime.byId && runtime.byId[id]) || null
    }, NODE_W, NODE_H);
  }
  for (const sid of Object.keys(stubs)) if (assigned[sid]) place(stubs[sid], STUB_W, STUB_H);

  return {
    v: 5,
    mode: "questTree",
    questId,
    nodes,
    edges,
    pos,
    size: { w: Math.max(900, maxX + PAD_X), h: Math.max(500, maxY + PAD_Y) },
    constants: { NODE_W, NODE_H, STUB_W, STUB_H },
    rootId,
    beatCount: beats.length,
    firedCount: beats.filter(b => runtime?.byId?.[String(b.id)]?.fired).length
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

    // Flow Visualizer UI state (2026-09-07: one quest at a time)
    this.flowShowTravel = !!options.flowShowTravel;
    this.flowZoom = Number(options.flowZoom ?? 1) || 1;
    this.flowPan = { x: Number(options.flowPanX ?? 0) || 0, y: Number(options.flowPanY ?? 0) || 0 };
    this.flowQuestId = options.flowQuestId ?? null;   // charted quest (null = decide on mount)
    this.flowFollow = null;                            // null = read the per-user flag on mount
    this.flowSelectedBeatId = null;                    // selected card (Run / Edit)

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
    // Live truth layer (2026-08-24): re-render when ANY beat resolves, so the
    // hero/fired rail never go stale on beats that complete asynchronously
    // (a run whose dialog parks kept the panel frozen on the pre-run state).
    this._boundOnBeatResolved = foundry.utils.debounce(() => { if (this.rendered) this.render(false); }, 400);
    Hooks.on("bbttcc:beat:resolved", this._boundOnBeatResolved);
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
    if (this._boundOnBeatResolved) Hooks.off("bbttcc:beat:resolved", this._boundOnBeatResolved);
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
    const questsAll = (Array.isArray(quests) ? quests.slice() : [])
      .sort((a, b) => String(a?.name || a?.id || "").localeCompare(String(b?.name || b?.id || ""), undefined, { numeric: true }));
    this._questsAllCache = questsAll;
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
      const addrIdx = buildBeatAddressIndex(selectedCampaign?.beats || []);
      for (const row of beatsFiltered) {
        const addr = beatAddress(row.beat, addrIdx);
        row.addrShort = addr.short;
        row.addrLong = addr.long;
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
      questFilterName: (this.questFilter && this.questFilter !== "all")
        ? String((questsAll.find(q => String(q?.id) === String(this.questFilter)) || {}).name || "")
        : "",
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
  // -----------------------------------------------------------------------
  // Truth Layer (situation-console Stage 1, 2026-07-14): per-beat runtime
  // state for the visualizer — fired? ready? blocked on which condition?
  // autofire class? audio? Reads the same ledgers the engine fires from.
  // -----------------------------------------------------------------------
  async _computeFlowRuntime(campaign) {
    const NS = "bbttcc-campaign";
    const api = game.bbttcc?.api?.campaign;
    const beats = Array.isArray(campaign?.beats) ? campaign.beats : [];

    let dstate = {};
    try { dstate = api?.director?.state?.() || {}; } catch (_e) {}
    let inject = {};
    try {
      inject = game.settings.get(NS, "injectState") || {};
      if (typeof inject === "string") inject = JSON.parse(inject);
    } catch (_e) { inject = {}; }
    let turn = 0;
    try { turn = Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch (_e) {}
    let ledger = null;
    try { ledger = api?.ledger?.get?.() || null; } catch (_e) {}

    // Beats that fire on hex entry: drawing flags + campaign overrides.
    const hexEntry = new Set();
    try {
      for (const scene of game.scenes) {
        for (const dr of scene.drawings.contents) {
          const be = dr.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId;
          if (be) hexEntry.add(String(be));
        }
      }
      const ov = Object.assign({}, campaign?.hexOverrides || {}, campaign?.overrides?.hex || {});
      for (const v of Object.values(ov)) {
        const b = v?.onEnterBeatId || v?.beatId;
        if (b) hexEntry.add(String(b));
      }
    } catch (_e) {}

    const cid = String(campaign?.id || "");
    const fired = dstate.firedStoryBeats || {};
    const dlgFired = dstate.dialogueFired || {};
    const invited = dstate.invited || {};

    const byId = {};
    for (const b of beats) {
      if (!b?.id) continue;
      const id = String(b.id);
      const f = fired[id] || dlgFired[id] || null;
      const rec = {
        fired: !!f,
        firedTurn: (f && typeof f === "object" && Number.isFinite(Number(f.turn))) ? Number(f.turn) : null,
        invited: !!invited[id],
        repeatable: !!b.inject?.repeatable,
        ambient: !!b.pacing?.ambient,   // self-firing — no GM trigger on the play surface
        auto: [],
        hasAudio: !!(b.audio?.enabled && (b.audio.src || b.audio.playlistSoundUuid)),
        gated: false, ready: false, blocked: false, reasons: [], cooldownUntil: null
      };
      if (b.storyChain || b.inject?.storyChain) rec.auto.push("director");
      if (String(b.tags || "").toLowerCase().includes("inject.")) rec.auto.push("inject");
      if (hexEntry.has(id)) rec.auto.push("hex");
      if (String(b.speakerActorId || "").trim()
        && Array.isArray(b.choices) && b.choices.some(c => String(c?.label || "").trim())
        && b.dialogueOffer !== false) rec.auto.push("dialogue");

      try {
        const rep = await api?.gates?.report?.(b, campaign, {});
        if (rep?.gated) {
          rec.gated = true;
          rec.reasons = rep.conditions || [];
          if (rep.met) rec.ready = true; else rec.blocked = true;
        }
      } catch (_e) {}

      try {
        const cd = Number(b.inject?.cooldownTurns || 0);
        if (cd > 0) {
          const last = inject[`${cid}:${id}:cooldown`];
          const lastTurn = (typeof last === "number") ? last : Number(last?.turn);
          if (Number.isFinite(lastTurn) && (turn - lastTurn) < cd) {
            rec.cooldownUntil = lastTurn + cd;
            rec.ready = false;
          }
        }
      } catch (_e) {}

      rec.state = (rec.fired && !rec.repeatable) ? "fired"
        : rec.blocked ? "blocked"
        : (rec.cooldownUntil != null) ? "cooling"
        : (rec.gated || rec.auto.length) ? "ready"
        : "idle";
      byId[id] = rec;
    }
    return { byId, turn, ledger };
  }

  // -----------------------------------------------------------------------
  // Command Deck (situation-console Stage 3, 2026-07-14): execute from the
  // console — run a beat with the soft-lock confirm, launch the Reset
  // Console / Campaign Census tools.
  // -----------------------------------------------------------------------
  async _runBeatFromConsole(beatId) {
    try {
      const api = this._requireApi();
      if (!api?.runBeat) return ui.notifications?.warn?.("Campaign API missing runBeat.");
      const campaignId = this.campaignId;
      const id = String(beatId || "").trim();
      if (!campaignId || !id) return;

      let firedAlready = false;
      try {
        const ds = game.bbttcc?.api?.campaign?.director?.state?.() || {};
        firedAlready = !!(ds.firedStoryBeats?.[id] || ds.dialogueFired?.[id]);
        // Repeatable beats (hubs, rounds, crossroads) are DESIGNED to re-run —
        // re-entering one is normal play, not a re-fire worth interrupting.
        const beat = (api.getCampaign?.(campaignId)?.beats || []).find(b => String(b?.id) === id);
        if (beat?.inject?.repeatable) firedAlready = false;
      } catch (_e) {}
      if (firedAlready) {
        const content = `<p><code>${id}</code> is marked as already fired. Run it again?</p>`;
        let ok = false;
        try {
          ok = foundry.applications?.api?.DialogV2?.confirm
            ? await foundry.applications.api.DialogV2.confirm({ window: { title: "Beat already fired" }, content })
            : await Dialog.confirm({ title: "Beat already fired", content });
        } catch (_e) { ok = false; }
        if (!ok) return;
      }

      await api.runBeat(campaignId, id);
      ui.notifications?.info?.(`▶ Beat fired: ${id}`);
      this.render(false); // refresh the truth layer + Now Panel
    } catch (e) {
      console.warn(TAG, "console run-beat failed", e);
      ui.notifications?.error?.("Run failed — see console (F12).");
    }
  }

  async _execToolMacro(fileBase, label) {
    try {
      if (!game.user?.isGM) return;
      // Prefer a world Macro document if the owner has one; fall back to
      // executing the module tool file directly.
      const pat = new RegExp(String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const mac = game.macros?.find?.(m => pat.test(String(m?.name || "")));
      if (mac) { await mac.execute(); return; }
      const resp = await fetch(`modules/bbttcc-campaign/tools/${fileBase}`);
      if (!resp.ok) throw new Error(`fetch ${fileBase}: HTTP ${resp.status}`);
      const src = await resp.text();
      new Function(src)();
    } catch (e) {
      console.warn(TAG, `${label} launch failed`, e);
      ui.notifications?.error?.(`${label} failed to launch — see console (F12).`);
    }
  }

  // -----------------------------------------------------------------------
  // Situation (2026-09-07): ONE computation of where the story stands, read
  // by both the chart (which quest to follow, which beat to light as NEXT)
  // and the rail. Returns data, not HTML.
  //   anchor        — the freshest fired SPINE beat (ambient/travel/discovery
  //                   beats never steer the story)
  //   anchorQuestId — the quest the story is standing in
  //   hero          — { kicker, title, beat, quest, runs:[{id,text}], note }
  //   nextIds       — beats the hero is pointing at (chart highlight)
  //   recent        — last fired, newest first
  //   choices       — the choice ledger, newest first
  //   completed     — quests with status completed, newest first
  // The hero's decision ladder carries a year of live-caught lessons (dated
  // inline) — port them, don't "simplify" them.
  // -----------------------------------------------------------------------
  _computeSituation(campaign, runtime) {
    const NS = "bbttcc-campaign";
    const api = game.bbttcc?.api?.campaign;
    const beats = Array.isArray(campaign?.beats) ? campaign.beats : [];
    const beatById = {};
    for (const b of beats) if (b?.id) beatById[String(b.id)] = b;

    const questDefs = {};
    try {
      for (const q of (api?.quests?.listQuests?.({ status: "all" }) || [])) if (q?.id) questDefs[String(q.id)] = q;
    } catch (_e) {}
    const questNames = {};
    for (const [id, q] of Object.entries(questDefs)) questNames[id] = q.name || id;
    const questOf = b => b?.questId ? (questNames[String(b.questId)] || String(b.questId)) : "";

    let curPhase = 0;
    try { curPhase = Number(game.settings.get(NS, "storyPhase")) || 0; } catch (_e) {}

    const isAmbientBeat = b => !!b?.pacing?.ambient;
    const isDiscoveryBeat = b => !!b?.targetHexUuid || /\bdiscovery\b/i.test(String(b?.tags || ""));
    const isTravelBeat = b => String(b?.timeScale) === "leg";
    // hero.note is rendered as HTML (it carries <b>) — every authored string
    // that lands in it goes through esc here.
    const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    let ds = {};
    try { ds = api?.director?.state?.() || {}; } catch (_e) { ds = {}; }
    const firedSet = new Set([...Object.keys(ds.firedStoryBeats || {}), ...Object.keys(ds.dialogueFired || {})]);

    // Fired history: a speaker beat fired through the menu lands in BOTH
    // ledgers — merge by id, keep the record that knows its turn, freshest ts.
    const byBeat = new Map();
    for (const src of [ds.firedStoryBeats || {}, ds.dialogueFired || {}]) {
      for (const [id, m] of Object.entries(src)) {
        const row = { id, turn: m?.turn, ts: Number(m?.ts) || 0 };
        const prev = byBeat.get(id);
        if (!prev) { byBeat.set(id, row); continue; }
        byBeat.set(id, { id, turn: prev.turn != null ? prev.turn : row.turn, ts: Math.max(prev.ts, row.ts) });
      }
    }
    const hist = [...byBeat.values()].filter(h => beatById[h.id]).sort((a, b) => b.ts - a.ts);
    const histCount = hist.length;
    const anchorId = hist.find(h => {
      const b = beatById[h.id];
      return b && !isAmbientBeat(b) && !isDiscoveryBeat(b) && !isTravelBeat(b);
    })?.id ?? null;
    const anchor = anchorId ? beatById[anchorId] : null;

    const _authIdx = new Map(beats.map((b, i) => [String(b.id), i]));
    const seqOf = b => _flowSeqOf(b, _authIdx);
    const stripPrefix = (label, qn) => {
      const l = String(label || ""), q = String(qn || "");
      if (q && l.toLowerCase().startsWith(q.toLowerCase())) {
        const rest = l.slice(q.length).replace(/^[\s,;:·—–-]+/, "");
        if (rest.length >= 3) return rest;
      }
      return l;
    };
    const readyStory = beats.filter(b => runtime.byId[String(b.id)]?.state === "ready"
      && (!firedSet.has(String(b.id)) || b?.inject?.repeatable)
      && !isAmbientBeat(b) && !isDiscoveryBeat(b) && !isTravelBeat(b));

    // ── the hero: the DRIVING verb (2026-08-23 owner spec) ─────────────────
    let hero = null;
    const card = (kicker, title, beat, runs, note) => ({
      kicker, title: title || "", beat: beat || null, quest: beat ? questOf(beat) : "",
      runs: runs || [], note: note || ""
    });
    const run = (b, txt) => ({ id: String(b.id), text: txt || stripPrefix(b.label || b.id, questOf(b)) });
    const whyOf = (b, n = 2) => {
      const unmet = (runtime.byId[String(b.id)]?.reasons || []).filter(r => !r.met);
      return esc(unmet.length
        ? unmet.slice(0, n).map(r => r.text + (r.current !== undefined ? ` (now ${r.current})` : "")).join(" · ")
        : "its own conditions");
    };

    // State zero (2026-08-24): an OPEN beat dialog IS what's next.
    const openDlg = (() => { try { return api?.openBeatDialog?.() || null; } catch (_e) { return null; } })();
    if (openDlg) {
      hero = card("🎭 PLAYER CHOICE IN PROGRESS", openDlg.label, null, [],
        `the table is deciding${openDlg.choices?.length ? ` — ${openDlg.choices.slice(0, 6).map(c => esc(c)).join(" · ")}${openDlg.choices.length > 6 ? " · …" : ""}` : ""}. The story continues from their pick.`);
    } else if (histCount === 0 && readyStory.length) {
      const openId = String(campaign?.openingBeatId || "").trim();
      const opening = openId ? beats.find(b => String(b.id) === openId && runtime.byId[openId]?.state === "ready") : null;
      const first = opening || readyStory[0];
      if (first) hero = card("🎬 BEGIN", first.label || first.id, first, [run(first, "Run the opening beat")], "");
    } else if (histCount > 0) {
      const lastName = esc(anchor ? stripPrefix(anchor.label || anchor.id, questOf(anchor)) : "");
      const nextIds = anchor
        ? [...new Set((anchor.choices || []).flatMap(c => [c?.next, c?.failNext]).filter(Boolean).map(String))]
        : [];
      // dialogueOffer:false = reached only by routing, never OFFERED (2026-09-04).
      const routedAll = nextIds.map(id => beatById[id])
        .filter(b => b && (!firedSet.has(String(b.id)) || b?.inject?.repeatable))
        .filter(b => b.dialogueOffer !== false);
      // Fresh routes outrank revisits (2026-09-04).
      const routed = routedAll.filter(b => !firedSet.has(String(b.id)));
      const revisits = routedAll.filter(b => firedSet.has(String(b.id)) && runtime.byId[String(b.id)]?.state === "ready");
      const candidates = routed.filter(b => runtime.byId[String(b.id)]?.state === "ready");
      // Gated routes are still THE ROAD (2026-08-24): show, name the gate.
      const gated = candidates.length ? [] : routed.filter(b => runtime.byId[String(b.id)]?.state !== "ready");
      if (candidates.length === 1) {
        hero = card("⏭ NEXT", candidates[0].label || candidates[0].id, candidates[0],
          [run(candidates[0], "Run the next beat")], lastName ? `after “${lastName}”` : "");
      } else if (candidates.length > 1) {
        hero = card("⏭ NEXT — the story branches", "", null, candidates.slice(0, 3).map(b => run(b)),
          (candidates.length > 3 ? `+ ${candidates.length - 3} more route${candidates.length === 4 ? "" : "s"} on the chart · ` : "") +
          (lastName ? `out of “${lastName}”` : ""));
        hero.quest = questOf(candidates[0]);
      } else if (gated.length) {
        const g = gated[0];
        hero = card("⏳ NEXT — waiting at its gate", g.label || g.id, g, [run(g, "Run it anyway (override the gate)")],
          `the authored route${lastName ? ` out of “${lastName}”` : ""} waits for: <b>${whyOf(g)}</b> — usually the gate is the design doing its job; override only on purpose`);
      } else {
        // No authored route — CANONICAL QUEST ORDER fallback.
        let qNext = null, qGated = null;
        const lq = anchor ? String(anchor.questId || "").trim() : "";
        if (lq) {
          const ls = seqOf(anchor);
          const questById = new Map(beats.map(b => [String(b.id), String(b.questId || "").trim()]));
          // Same-quest FORWARD routes mark authored arrivals (2026-09-04 v2) —
          // those are player destinations, never proposed out of context.
          const choiceTargets = new Set();
          for (const b of beats) for (const c of (b.choices || [])) {
            for (const t of [c?.next, c?.failNext]) {
              const id = String(t || "").trim();
              if (!id) continue;
              const bq = String(b.questId || "").trim();
              const sameQuest = !!bq && bq === questById.get(id);
              const tgt = beatById[id];
              const forward = tgt ? seqOf(tgt) > seqOf(b) : false;
              if (sameQuest && forward) choiceTargets.add(id);
            }
          }
          // Future-act steps are invisible to the quest-order hero (2026-09-04).
          const futureAct = (b) => {
            const reqs = Array.isArray(b?.inject?.requires) ? b.inject.requires : [];
            const own = Number(b?.worldEffects?.phaseAdvance?.set) || 0;
            return reqs.some(r => r && String(r.flag) === "storyPhase" && Number(r.gte) > Math.max(curPhase, own));
          };
          const qRouted = beats
            .filter(b => String(b.questId || "").trim() === lq
              && !futureAct(b)
              && b.dialogueOffer !== false
              // Fired is fired (2026-08-24 / 2026-08-30): firedSet alone
              // carries the lesson — an UNFIRED repeatable next-in-order is
              // a legitimate step.
              && !firedSet.has(String(b.id))
              && !isAmbientBeat(b) && !isDiscoveryBeat(b)
              && !choiceTargets.has(String(b.id))
              && seqOf(b) > ls)
            .sort((a, b) => seqOf(a) - seqOf(b));
          qNext = qRouted.find(b => runtime.byId[String(b.id)]?.state === "ready") || null;
          qGated = qNext ? null : (qRouted[0] || null);
        }
        if (qNext) {
          hero = card("⏭ NEXT — quest order", qNext.label || qNext.id, qNext, [run(qNext, "Run the next beat")],
            `no authored route after “${lastName}” — following the quest's canonical order`);
        } else if (qGated) {
          const unmetQ = (runtime.byId[String(qGated.id)]?.reasons || []).filter(r => !r.met);
          // Turn-gated NEXT is the world turn asking to be run (2026-09-04).
          const turnOnly = unmetQ.length && unmetQ.every(r => /^turn\s*[≥≤=]/.test(String(r.text || "")));
          if (turnOnly) {
            hero = card("🔒 NEXT — on the other side of the turn", qGated.label || qGated.id, qGated, [],
              `the story resumes once the world moves: set every faction's plans, then run the <b>Turn Driver</b> (toolbar). Waits for: <b>${whyOf(qGated)}</b>`);
          } else {
            hero = card("⏳ NEXT — waiting at its gate (quest order)", qGated.label || qGated.id, qGated,
              [run(qGated, "Run it anyway (override the gate)")],
              `next in the quest's canonical order after “${lastName}” waits for: <b>${whyOf(qGated)}</b> — usually that's the design doing its job`);
          }
        } else if (revisits.length) {
          const r0 = revisits[0];
          hero = card("↺ THE DOOR'S STILL OPEN", r0.label || r0.id, r0, [run(r0, "Return there")],
            `nothing new is routed${lastName ? ` after “${lastName}”` : ""} — but the table can always go back.`);
        } else {
          hero = card("🧭 IN THE TABLE'S HANDS", "", null, [],
            `No single next beat${lastName ? ` after “${lastName}”` : ""} — the story is waiting on the players: a choice, a conversation invite, travel, or something they have to walk into. Watch chat.`);
        }
      }
    } else {
      hero = card("🎬 NOTHING TO BEGIN", "", null, [], "no beat is ready to open the campaign — check the opening beat's gates on the Beats tab.");
    }

    const nextIds = hero ? hero.runs.map(r => r.id) : [];
    if (hero && hero.beat && !nextIds.length && /NEXT/.test(hero.kicker)) nextIds.push(String(hero.beat.id));

    // The quest the story stands in: anchor's quest, else the opening beat's.
    let anchorQuestId = anchor ? _flowQuestIdOf(anchor) : null;
    if (!anchorQuestId) {
      const openId = String(campaign?.openingBeatId || "").trim();
      const ob = openId ? beatById[openId] : null;
      anchorQuestId = ob ? _flowQuestIdOf(ob) : (beats[0] ? _flowQuestIdOf(beats[0]) : null);
    }

    const recent = hist.slice(0, 5).map(h => {
      const b = beatById[h.id];
      return { id: h.id, label: b?.label || h.id, quest: questOf(b), turn: h.turn, ts: h.ts };
    });
    const cid = String(campaign?.id || "");
    const choices = (Array.isArray(ds.choices) ? ds.choices : [])
      .filter(c => c && (!c.campaignId || !cid || String(c.campaignId) === cid))
      .slice(-8).reverse();
    const completed = Object.values(questDefs)
      .filter(q => String(q.status || "").toLowerCase() === "completed"
        && (!q.campaignId || !cid || String(q.campaignId) === cid))
      .sort((a, b) => (Number(b.completedTs) || 0) - (Number(a.completedTs) || 0))
      .slice(0, 6);

    return { beatById, questDefs, questNames, questOf, curPhase, anchor, anchorId, anchorQuestId, hero, nextIds, recent, choices, completed, firedSet, histCount };
  }

  // -----------------------------------------------------------------------
  // The rail (2026-09-07 owner ruling): three blocks and nothing else —
  // NOW (act · turn · quest · here · next), RECENT (last five fired), LOCKED
  // (choices taken · quests completed). Chains / pressures / relations /
  // browse / coming-up left this surface; a World-view home is owed.
  // -----------------------------------------------------------------------
  async _buildNowPanel(campaign, runtime, sit) {
    if (!runtime || !campaign || !sit) return null;
    const NS = "bbttcc-campaign";
    const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const { beatById, questOf } = sit;
    const _addrIdx = buildBeatAddressIndex(Array.isArray(campaign.beats) ? campaign.beats : []);
    const addrOf = b => { try { return beatAddress(b, _addrIdx).short; } catch (_e) { return ""; } };

    const flyBtn = (id, label, extra = "", runnable = false) =>
      `<div class="bbttcc-now-row">` +
      `<button type="button" class="bbttcc-now-item" data-fly="${esc(id)}" data-tooltip="Fly the chart to this beat"><span class="t">${esc(label)}</span>${extra ? `<span class="x">${extra}</span>` : ""}</button>` +
      `<button type="button" class="bbttcc-now-info" data-info="${esc(id)}" data-tooltip="Show the full beat description">ⓘ</button>` +
      (runnable ? `<button type="button" class="bbttcc-now-run" data-run="${esc(id)}" data-tooltip="Run this beat now">▶</button>` : "") +
      `</div>`;

    // ── NOW ──────────────────────────────────────────────────────────────
    const qid = sit.anchorQuestId;
    const qDef = qid ? sit.questDefs[qid] : null;
    const qName = qid ? (qid === FLOW_UNASSIGNED ? "(no quest)" : (sit.questNames[qid] || qid)) : "—";
    const qStatus = String(qDef?.status || "").toLowerCase();
    const hereHtml = sit.anchor
      ? flyBtn(sit.anchorId, sit.anchor.label || sit.anchorId, `<code>${esc(addrOf(sit.anchor))}</code>`)
      : `<div class="bbttcc-now-empty">nothing fired yet — the world is young</div>`;
    const h = sit.hero;
    const heroHtml = h ? (
      `<div class="bbttcc-now-hero">` +
      `<div class="k">${esc(h.kicker)}</div>` +
      (h.title ? `<div class="t">${esc(h.title)}</div>` : "") +
      (h.quest ? `<div class="q">${esc(h.quest)}</div>` : "") +
      h.runs.map(r => `<button type="button" class="bbttcc-now-hero-run" data-run="${esc(r.id)}">▶ ${esc(r.text)}</button>`).join("") +
      (h.note ? `<div class="alt">${h.note}</div>` : "") +
      `</div>`) : "";
    // Story chains ARE quest chains (2026-09-07 owner ruling): the old
    // campaign-wide chains section folds into the charted quest — each
    // Director chain with beats in this quest shows its progress and the
    // next chain beat (⚡ eligible now / ⛩ gated). Computed locally from
    // THIS campaign (api.director.chains() reads the ACTIVE campaign, which
    // need not be the one the Builder has open).
    let chainsHtml = "";
    try {
      const chartQ = String(sit.chartQuestId || "");
      const chainMap = {};
      for (const b of (Array.isArray(campaign.beats) ? campaign.beats : [])) {
        const ch = String(b?.storyChain || b?.inject?.storyChain || "").trim();
        if (!ch || !b?.id) continue;
        (chainMap[ch] = chainMap[ch] || []).push(b);
      }
      const rows = [];
      for (const [name, list] of Object.entries(chainMap)) {
        if (!list.some(b => _flowQuestIdOf(b) === chartQ)) continue;
        const fired = list.filter(b => sit.firedSet.has(String(b.id))).length;
        const next = list.find(b => !sit.firedSet.has(String(b.id)));
        const pct = Math.round((fired / list.length) * 100);
        const eligible = next ? runtime.byId[String(next.id)]?.state === "ready" : false;
        const pretty = name.replace(/_/g, " ");
        rows.push(
          `<div class="bbttcc-now-chain" data-tooltip="Director chain “${esc(name)}” — the Story Director fires these in order as pressure and gates allow">` +
          `<div class="hd"><span class="nm">⚙ ${esc(pretty)}</span><span class="ct">${fired}/${list.length}</span></div>` +
          `<div class="bar"><i style="width:${pct}%"></i></div>` +
          (next ? flyBtn(next.id, "→ " + (next.label || next.id), eligible ? "⚡" : "⛩", eligible) : `<div class="done">chain complete</div>`) +
          `</div>`);
      }
      if (rows.length) chainsHtml = `<div class="bbttcc-now-kv"><span class="k">CHAIN${rows.length === 1 ? "" : "S"}</span></div>` + rows.join("");
    } catch (_eCh) {}

    const nowHtml =
      `<div class="bbttcc-now-kv"><span class="k">QUEST</span><span class="v">${esc(qName)}${qStatus && qStatus !== "active" ? ` <i class="st ${esc(qStatus)}">${esc(qStatus)}</i>` : ""}</span></div>` +
      `<div class="bbttcc-now-kv"><span class="k">HERE</span></div>` + hereHtml +
      heroHtml +
      chainsHtml;

    // ── RECENT ───────────────────────────────────────────────────────────
    const recentHtml = sit.recent.map(r =>
      flyBtn(r.id, r.label, `${r.quest ? `<em>${esc(r.quest)}</em> ` : ""}${r.turn != null ? `T${esc(String(r.turn))}` : ""}`)
    ).join("") || `<div class="bbttcc-now-empty">nothing fired yet</div>`;

    // ── LOCKED ───────────────────────────────────────────────────────────
    const choiceRows = sit.choices.map(c => {
      const b = beatById[String(c.beatId)];
      const at = b ? (b.label || c.beatId) : (c.beatLabel || c.beatId);
      const chk = (c.checkOk === true) ? " ✓" : (c.checkOk === false) ? " ✗" : "";
      return `<div class="bbttcc-now-lock">` +
        `<button type="button" class="bbttcc-now-item" data-fly="${esc(c.beatId)}" data-tooltip="Fly the chart to the beat where this was decided">` +
        `<span class="t">「${esc(c.label)}」${chk}</span><span class="x">T${esc(String(c.turn ?? "?"))}</span></button>` +
        `<div class="at">at ${esc(at)}</div></div>`;
    }).join("");
    const questRows = sit.completed.map(q =>
      `<div class="bbttcc-now-lock done"><span class="t">✓ ${esc(q.name || q.id)}</span><span class="x">${q.completedTurn != null ? `T${esc(String(q.completedTurn))}` : "—"}</span></div>`
    ).join("");
    const lockedHtml =
      (choiceRows || `<div class="bbttcc-now-empty">no choices recorded yet</div>`) +
      `<div class="bbttcc-now-kv"><span class="k">QUESTS COMPLETED</span></div>` +
      (questRows || `<div class="bbttcc-now-empty">none yet</div>`);

    // ── assemble ─────────────────────────────────────────────────────────
    const rail = document.createElement("div");
    rail.className = "bbttcc-now-panel";
    rail.dataset.tour = "campaign.now-panel";
    const block = (title, body) => `<section class="bbttcc-now-block"><h5>${title}</h5><div class="bd">${body}</div></section>`;
    rail.innerHTML =
      `<div class="bbttcc-now-grip" data-tooltip="Drag to resize the panel"></div>` +
      `<div class="bbttcc-now-head"><button type="button" class="bbttcc-now-expand" data-expand data-tooltip="Toggle wide panel">⟷</button>ACT ${sit.curPhase} · TURN ${esc(String(runtime.turn))}` +
      (runtime.ledger ? `<span>${esc(String(runtime.ledger.spent))}/${esc(String(runtime.ledger.budget))} days${Number(runtime.ledger.debt) ? ` · debt ${esc(String(runtime.ledger.debt))}` : ""}</span>` : "") +
      `</div>` +
      block("▶ NOW", nowHtml) +
      block("✓ RECENT", recentHtml) +
      block("🔒 LOCKED", lockedHtml);

    // Width: persisted per user; drag the left-edge grip or toggle ⟷ wide.
    const NOW_W_DEFAULT = 300, NOW_W_WIDE = 540, NOW_W_MIN = 240, NOW_W_MAX = 720;
    let nowW = NOW_W_DEFAULT;
    try { nowW = Number(game.user?.getFlag?.(NS, "nowPanelWidth")) || NOW_W_DEFAULT; } catch (_e) {}
    const setW = (w, persist = false) => {
      nowW = Math.max(NOW_W_MIN, Math.min(NOW_W_MAX, Math.round(w)));
      rail.style.flexBasis = nowW + "px";
      rail.style.maxWidth = nowW + "px";
      if (persist) { try { game.user?.setFlag?.(NS, "nowPanelWidth", nowW); } catch (_e) {} }
    };
    setW(nowW);
    const grip = rail.querySelector(".bbttcc-now-grip");
    if (grip) {
      grip.addEventListener("mousedown", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const startX = ev.clientX, startW = nowW;
        const onMove = e => setW(startW + (startX - e.clientX));
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          setW(nowW, true);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    }

    rail.addEventListener("click", ev => {
      const exp = ev.target?.closest?.("[data-expand]");
      if (exp) { ev.preventDefault(); setW(nowW >= NOW_W_WIDE ? NOW_W_DEFAULT : NOW_W_WIDE, true); return; }
      const info = ev.target?.closest?.("[data-info]");
      if (info) {
        ev.preventDefault();
        ev.stopPropagation();
        const id = String(info.dataset.info || "");
        const row = info.closest(".bbttcc-now-row");
        const next = row?.nextElementSibling;
        if (next && next.classList?.contains("bbttcc-now-detail")) { next.remove(); return; }
        const b = beatById[id];
        const desc = String(b?.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const det = document.createElement("div");
        det.className = "bbttcc-now-detail";
        det.innerHTML =
          `<div class="ttl">${esc(b?.label || id)}</div>` +
          `<div class="idl">${esc(id)}${b?.questId ? ` · ${esc(questOf(b))}` : ""}</div>` +
          `<div class="ds${desc ? "" : " none"}">${desc ? esc(desc) : "(no description authored)"}</div>`;
        row?.after(det);
        return;
      }
      const run = ev.target?.closest?.("[data-run]");
      if (run) { ev.preventDefault(); ev.stopPropagation(); this._runBeatFromConsole(run.dataset.run); return; }
      const btn = ev.target?.closest?.("[data-fly]");
      if (!btn) return;
      ev.preventDefault();
      this.__flowFlyTo?.(btn.dataset.fly);
    });
    return rail;
  }

  async _mountFlowVisualizer(rootEl) {
    try {
      if (!rootEl) return;
      const host = rootEl.querySelector("[data-role='flowviz']");
      if (!host) return;

      const api = game.bbttcc && game.bbttcc.api ? game.bbttcc.api.campaign : null;
      const cid = String(this.campaignId || "").trim();
      const campaign = (api && cid && typeof api.getCampaign === "function") ? api.getCampaign(cid) : null;
      if (!campaign) {
        host.innerHTML = "<p class='bbttcc-muted'>No campaign selected.</p>";
        return;
      }
      const beatsAll = Array.isArray(campaign.beats) ? campaign.beats : [];

      // Truth Layer: live runtime state (fired/ready/blocked/audio) per beat.
      let runtime = null;
      try { runtime = await this._computeFlowRuntime(campaign); } catch (eRt) { console.warn(TAG, "flow runtime failed", eRt); }
      if (!runtime) runtime = { byId: {}, turn: 0, ledger: null };
      const sit = this._computeSituation(campaign, runtime);

      // Which quest? FOLLOW (default) = the quest the story stands in; a manual
      // pick from the dropdown turns follow off until the GM snaps it back.
      if (this.flowFollow == null) {
        let f = null;
        try { f = game.user?.getFlag?.("bbttcc-campaign", "flowFollow"); } catch (_e) {}
        this.flowFollow = (f == null) ? true : !!f;
      }
      const questsWithBeats = new Map();   // questId -> count
      const questFired = new Map();        // questId -> fired count
      for (const b of beatsAll) {
        if (!b?.id) continue;
        const q = _flowQuestIdOf(b);
        questsWithBeats.set(q, (questsWithBeats.get(q) || 0) + 1);
        if (runtime.byId[String(b.id)]?.fired) questFired.set(q, (questFired.get(q) || 0) + 1);
      }
      if (this.flowFollow || !this.flowQuestId || !questsWithBeats.has(String(this.flowQuestId))) {
        this.flowQuestId = (sit.anchorQuestId && questsWithBeats.has(sit.anchorQuestId))
          ? sit.anchorQuestId
          : (questsWithBeats.keys().next().value || null);
      }
      const questId = this.flowQuestId;

      const graph = _buildFlowGraph(campaign, {
        questId,
        showTravel: this.flowShowTravel,
        runtime,
        questNames: sit.questNames
      });
      const flowEmpty = !graph || !graph.nodes || !graph.nodes.length;

      host.innerHTML = "";
      try { if (!host.style.minHeight) host.style.minHeight = "720px"; } catch (e) {}

      const _tip = (key) => { try { return game.bbttcc?.help?.tip?.("campaign", key) || ""; } catch (_e) { return ""; } };
      const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

      // ── the bar: Quest · Follow ──────────────────────────────────────────
      try {
        const bar = document.createElement("div");
        bar.className = "bbttcc-flowviz-bar";
        bar.dataset.tour = "campaign.flow-bar";

        const left = document.createElement("div");
        left.className = "l";

        const qLbl = document.createElement("div");
        qLbl.className = "lbl";
        qLbl.textContent = "Quest";
        const _questTip = _tip("flow-quest");
        if (_questTip) qLbl.dataset.tooltip = _questTip;
        const qSel = document.createElement("select");
        qSel.className = "sel";
        qSel.dataset.tour = "campaign.flow-quest";
        if (_questTip) qSel.dataset.tooltip = _questTip;
        // Quest order: the one the story stands in first, then quest.order,
        // completed ones after active, (no quest) last.
        const qRows = [...questsWithBeats.entries()].map(([id, n]) => {
          const d = sit.questDefs[id];
          return {
            id, n,
            name: id === FLOW_UNASSIGNED ? "(no quest)" : String(d?.name || id),
            status: String(d?.status || "active").toLowerCase(),
            order: (d && d.order != null) ? Number(d.order) : 9e15
          };
        });
        const rank = r => (r.id === sit.anchorQuestId) ? 0 : (r.id === FLOW_UNASSIGNED) ? 3 : (r.status === "completed") ? 2 : (r.status === "archived") ? 2.5 : 1;
        qRows.sort((a, b) => (rank(a) - rank(b)) || (a.order - b.order) || a.name.localeCompare(b.name));
        for (const r of qRows) {
          const o = document.createElement("option");
          o.value = r.id;
          const mark = (r.id === sit.anchorQuestId) ? "▶ " : (r.status === "completed") ? "✓ " : (r.status === "archived") ? "▫ " : "";
          o.textContent = `${mark}${r.name} (${questFired.get(r.id) || 0}/${r.n})`;
          if (r.id === questId) o.selected = true;
          qSel.appendChild(o);
        }
        qSel.addEventListener("change", (ev) => {
          this.flowQuestId = String(ev.target.value || "");
          this.flowFollow = false;
          try { game.user?.setFlag?.("bbttcc-campaign", "flowFollow", false); } catch (_e) {}
          this.flowSelectedBeatId = null;
          this._flowResetView();
          this.render(false);
        });

        const follow = document.createElement("button");
        follow.type = "button";
        follow.className = "bbttcc-btn bbttcc-btn-xs bbttcc-flow-follow" + (this.flowFollow ? " on" : "");
        follow.dataset.tour = "campaign.flow-follow";
        follow.textContent = this.flowFollow ? "⟲ Following the story" : "⟲ Follow the story";
        follow.dataset.tooltip = _tip("flow-follow") || "Follow: the chart tracks the quest the story is standing in (the last fired spine beat). Picking a quest above turns this off; click to snap back.";
        follow.addEventListener("click", (ev) => {
          ev.preventDefault();
          this.flowFollow = !this.flowFollow;
          try { game.user?.setFlag?.("bbttcc-campaign", "flowFollow", this.flowFollow); } catch (_e) {}
          this.flowSelectedBeatId = null;
          this._flowResetView();
          this.render(false);
        });

        left.appendChild(qLbl);
        left.appendChild(qSel);
        left.appendChild(follow);
        bar.appendChild(left);

        const right = document.createElement("div");
        right.className = "r";
        right.dataset.tour = "campaign.flow-meta";
        const PHN = ["THE OFFICES", "SETTLING", "SPARKS", "THE WIDENING TRAIL", "THE VAULT & THE SKY", "THATWARDS HO!", "GLOOMGILL"];
        let tik = 0;
        try { tik = Number(game.bbttcc?.api?.campaign?.tikkun?.get?.() ?? 0) || 0; } catch (_e) {}
        // Director pressure (2026-09-08 owner ruling): the ONE meter a GM acts
        // on — TIMING, not eligibility. Accrues 30/turn · 8/travel leg ·
        // 10/raid round · 3/resolved beat; at the threshold the Director
        // looks at the next seam and offers the next chain beat (GM veto).
        // Fire → 0, decline → halved. Arc flags (wendigo/bandit/cadence…)
        // deliberately NOT shown — the beat card names them in context.
        let pressure = 0, pThresh = 60;
        try { pressure = Number(api?.director?.state?.()?.pressure) || 0; } catch (_e) {}
        try { pThresh = Number(game.settings.get("bbttcc-campaign", "director.pressureThreshold")) || 60; } catch (_e) {}
        const pHot = pressure >= pThresh;
        const pTip = `Director pressure ${pressure} / ${pThresh} — story TIMING. Accrues 30 per world turn, 8 per travel leg, 10 per raid round, 3 per resolved beat. ${pHot
          ? "AT THRESHOLD: the Story Director will look at the next seam (travel leg, raid round, resolved beat) and offer the next eligible chain beat — you get a veto."
          : `At ${pThresh} the Story Director looks at the next seam and offers the next eligible chain beat (GM veto).`} Firing resets it to 0; declining halves it and benches that chain until next turn. Threshold: Configure Settings → Bad Eden Campaign.`;
        right.innerHTML =
          `<span class="act">ACT ${sit.curPhase} — ${esc(PHN[sit.curPhase] || "?")}</span>` +
          `<span class="sep">·</span><span>Turn <b>${esc(String(runtime.turn))}</b></span>` +
          (runtime.ledger && Number.isFinite(Number(runtime.ledger.spent)) ? `<span class="sep">·</span><span>${esc(String(runtime.ledger.spent))}/${esc(String(runtime.ledger.budget))} days</span>` : "") +
          (tik > 0 ? `<span class="sep">·</span><span class="tik" data-tooltip="Tikkun Dividend — earned redemption ease">✨ TIKKUN ×${tik}</span>` : "") +
          `<span class="sep">·</span><span class="press${pHot ? " hot" : ""}" data-tooltip="${esc(pTip)}">⚡ ${pressure}/${pThresh}</span>` +
          (!flowEmpty ? `<span class="sep">·</span><span data-tooltip="Beats fired in this quest / beats in this quest">${graph.firedCount}/${graph.beatCount} fired</span>` : "");
        bar.appendChild(right);
        host.appendChild(bar);
      } catch (eBar) { console.warn(TAG, "flow bar failed", eBar); }

      // ── map + rail ──────────────────────────────────────────────────────
      const flowRow = document.createElement("div");
      flowRow.className = "bbttcc-flow-row";
      host.appendChild(flowRow);
      const svgWrap = document.createElement("div");
      svgWrap.className = "bbttcc-flow-svgwrap";
      flowRow.appendChild(svgWrap);
      sit.chartQuestId = questId;
      let nowPanel = null;
      try { nowPanel = await this._buildNowPanel(campaign, runtime, sit); } catch (eNP) { console.warn(TAG, "now-panel failed", eNP); }
      if (nowPanel) flowRow.appendChild(nowPanel);

      if (flowEmpty) {
        const empty = document.createElement("div");
        empty.className = "bbttcc-muted bbttcc-flow-empty";
        empty.innerHTML = questId
          ? `<p>This quest has no beats to chart${this.flowShowTravel ? "" : " (travel-leg beats are hidden — 🧭 Travel in the header shows them)"}.</p>`
          : `<p>No beats to visualize.</p>`;
        svgWrap.appendChild(empty);
        this.__flowFlyTo = (beatId) => this._flowFlyElsewhere(beatId, sit);
        return;
      }

      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("width", "100%");
      let hostRect = null;
      try { hostRect = host.getBoundingClientRect(); } catch (_eH) { hostRect = null; }
      const panelH = hostRect && hostRect.height ? Math.floor(hostRect.height) : 720;
      const svgH = Math.max(640, Math.min(1400, panelH));
      svg.setAttribute("height", String(svgH));
      svg.setAttribute("viewBox", `0 0 ${graph.size.w} ${graph.size.h}`);
      svg.classList.add("bbttcc-flow-svg");

      const bg = document.createElementNS(svgNS, "rect");
      bg.setAttribute("x", "0"); bg.setAttribute("y", "0");
      bg.setAttribute("width", String(graph.size.w)); bg.setAttribute("height", String(graph.size.h));
      bg.setAttribute("fill", "transparent");
      svg.appendChild(bg);
      const g = document.createElementNS(svgNS, "g");
      svg.appendChild(g);

      const applyTransform = () => {
        const z = Number(this.flowZoom || 1) || 1;
        const px = (this.flowPan && Number.isFinite(this.flowPan.x)) ? this.flowPan.x : 0;
        const py = (this.flowPan && Number.isFinite(this.flowPan.y)) ? this.flowPan.y : 0;
        g.setAttribute("transform", `translate(${px} ${py}) scale(${z})`);
      };

      // viewBox user units vs screen px — every mouse→graph conversion goes
      // through `s` (xMidYMid letterbox offsets included).
      const viewMap = () => {
        let r = null;
        try { r = svg.getBoundingClientRect(); } catch (_e) { r = null; }
        const rw = r && r.width ? r.width : 980;
        const rh = r && r.height ? r.height : 720;
        const s = Math.min(rw / graph.size.w, rh / graph.size.h) || 1;
        return { r, rw, rh, s, ox: (rw - graph.size.w * s) / 2, oy: (rh - graph.size.h * s) / 2 };
      };

      applyTransform();

      // Markers + node gradient.
      const defs = document.createElementNS(svgNS, "defs");
      const mkMarker = (id, color) => {
        const m = document.createElementNS(svgNS, "marker");
        m.setAttribute("id", id);
        m.setAttribute("markerWidth", "10"); m.setAttribute("markerHeight", "10");
        m.setAttribute("refX", "9"); m.setAttribute("refY", "3");
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
      const nodeGrad = document.createElementNS(svgNS, "linearGradient");
      nodeGrad.setAttribute("id", "bbttcc-node-grad");
      nodeGrad.setAttribute("x1", "0"); nodeGrad.setAttribute("y1", "0");
      nodeGrad.setAttribute("x2", "0"); nodeGrad.setAttribute("y2", "1");
      for (const [off, col] of [["0%", "rgba(38,48,72,0.95)"], ["55%", "rgba(21,28,46,0.95)"], ["100%", "rgba(12,17,32,0.97)"]]) {
        const st = document.createElementNS(svgNS, "stop");
        st.setAttribute("offset", off); st.setAttribute("stop-color", col);
        nodeGrad.appendChild(st);
      }
      defs.appendChild(nodeGrad);
      svg.appendChild(defs);

      const NODE_W = graph.constants.NODE_W;
      const NODE_H = graph.constants.NODE_H;
      const graphNodeById = {};
      for (const gn of graph.nodes) graphNodeById[String(gn.id)] = gn;
      const nextSet = new Set(sit.nextIds.map(String));
      const hereId = sit.anchorId ? String(sit.anchorId) : null;

      // ── edges (under nodes), top-down S-curves ──────────────────────────
      for (const e of graph.edges) {
        const a = graph.pos[e.from], b = graph.pos[e.to];
        if (!a || !b) continue;
        const src = graphNodeById[e.from], dst = graphNodeById[e.to];
        const x1 = a.x + (src.width / 2), y1 = a.y + src.height;
        const x2 = b.x + (dst.width / 2), y2 = b.y;
        const up = y2 <= y1;   // back-link (hub returns): bow around the side
        let d;
        if (!up) {
          const dy = Math.max(40, (y2 - y1) * 0.5);
          d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
        } else {
          const bow = 90 + Math.min(160, Math.abs(x1 - x2) * 0.1);
          const sx = (x2 >= x1) ? 1 : -1;
          d = `M ${x1} ${y1} C ${x1 + sx * bow} ${y1 + 60}, ${x2 + sx * bow} ${y2 - 60}, ${x2} ${y2}`;
        }
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        let stroke = "rgba(148,163,184,0.35)", marker = "url(#bbttcc-arrow)", dash = "";
        if (e.kind === "success") { stroke = "rgba(34,197,94,0.45)"; marker = "url(#bbttcc-arrow-success)"; }
        else if (e.kind === "failure") { stroke = "rgba(239,68,68,0.45)"; marker = "url(#bbttcc-arrow-failure)"; }
        else if (e.kind === "choice_fail") { dash = "6 5"; stroke = "rgba(239,68,68,0.30)"; }
        else if (e.kind === "choice") { dash = "6 5"; stroke = "rgba(148,163,184,0.30)"; }
        // Light the road actually travelled / offered.
        const litFrom = graphNodeById[e.from]?.rt?.fired;
        const litTo = graphNodeById[e.to]?.rt?.fired || nextSet.has(e.to);
        if (litFrom && litTo) { stroke = "rgba(251,191,36,0.75)"; }
        path.setAttribute("stroke", stroke);
        path.setAttribute("stroke-width", (litFrom && litTo) ? "3" : "2");
        if (dash) path.setAttribute("stroke-dasharray", dash);
        path.setAttribute("marker-end", marker);
        const t = document.createElementNS(svgNS, "title");
        t.textContent = `${e.label || e.kind}: ${e.from} → ${e.to.replace(/^exit:/, "")}`;
        path.appendChild(t);
        // Choice label on the wire (short).
        if ((e.kind === "choice" || e.kind === "choice_fail") && e.label && !up) {
          const lt = document.createElementNS(svgNS, "text");
          lt.setAttribute("x", String((x1 + x2) / 2));
          lt.setAttribute("y", String((y1 + y2) / 2 - 4));
          lt.setAttribute("text-anchor", "middle");
          lt.setAttribute("font-size", "10");
          lt.setAttribute("fill", "rgba(203,213,225,0.75)");
          lt.setAttribute("paint-order", "stroke");
          lt.setAttribute("stroke", "rgba(2,6,23,0.85)");
          lt.setAttribute("stroke-width", "3");
          const s = String(e.label);
          lt.textContent = s.length > 26 ? s.slice(0, 26) + "…" : s;
          g.appendChild(lt);
        }
        g.appendChild(path);
      }

      // ── nodes ───────────────────────────────────────────────────────────
      const nodeEls = {};
      const badge = (parent, text, bx, by, w, line) => {
        const r = document.createElementNS(svgNS, "rect");
        r.setAttribute("x", String(bx)); r.setAttribute("y", String(by));
        r.setAttribute("rx", "8"); r.setAttribute("ry", "8");
        r.setAttribute("width", String(w)); r.setAttribute("height", "16");
        r.setAttribute("fill", "rgba(2,6,23,0.35)");
        r.setAttribute("stroke", line); r.setAttribute("stroke-width", "1");
        const t = document.createElementNS(svgNS, "text");
        t.setAttribute("x", String(bx + w / 2)); t.setAttribute("y", String(by + 11.5));
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("fill", "rgba(226,232,240,0.92)");
        t.setAttribute("font-size", "9"); t.setAttribute("font-weight", "700"); t.setAttribute("letter-spacing", "0.6");
        t.textContent = text;
        parent.appendChild(r); parent.appendChild(t);
      };

      for (const n of graph.nodes) {
        const p = graph.pos[n.id];
        if (!p) continue;
        const node = document.createElementNS(svgNS, "g");
        node.style.cursor = "pointer";

        if (n.kind === "exit") {
          node.setAttribute("data-exit-quest", n.targetQuestId);
          node.setAttribute("data-beat-id", n.targetBeatId);
          const rect = document.createElementNS(svgNS, "rect");
          rect.setAttribute("x", String(p.x)); rect.setAttribute("y", String(p.y));
          rect.setAttribute("rx", "22"); rect.setAttribute("ry", "22");
          rect.setAttribute("width", String(n.width)); rect.setAttribute("height", String(n.height));
          rect.setAttribute("fill", "rgba(15,23,42,0.55)");
          rect.setAttribute("stroke", "rgba(56,189,248,0.45)");
          rect.setAttribute("stroke-width", "1.4");
          rect.setAttribute("stroke-dasharray", "5 4");
          node.appendChild(rect);
          const t1 = document.createElementNS(svgNS, "text");
          t1.setAttribute("x", String(p.x + n.width / 2)); t1.setAttribute("y", String(p.y + 19));
          t1.setAttribute("text-anchor", "middle");
          t1.setAttribute("fill", "rgba(125,211,252,0.95)"); t1.setAttribute("font-size", "12"); t1.setAttribute("font-weight", "800");
          const qn = String(n.questName);
          t1.textContent = "→ " + (qn.length > 26 ? qn.slice(0, 26) + "…" : qn);
          node.appendChild(t1);
          const t2 = document.createElementNS(svgNS, "text");
          t2.setAttribute("x", String(p.x + n.width / 2)); t2.setAttribute("y", String(p.y + 35));
          t2.setAttribute("text-anchor", "middle");
          t2.setAttribute("fill", "rgba(148,163,184,0.8)"); t2.setAttribute("font-size", "10");
          const ln = String(n.label);
          t2.textContent = ln.length > 34 ? ln.slice(0, 34) + "…" : ln;
          node.appendChild(t2);
          const tt = document.createElementNS(svgNS, "title");
          tt.textContent = `Leaves this quest → ${n.questName}\n${n.label}\nclick to open that quest's chart`;
          node.appendChild(tt);
          node.addEventListener("click", (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            this.flowQuestId = n.targetQuestId;
            this.flowFollow = false;
            try { game.user?.setFlag?.("bbttcc-campaign", "flowFollow", false); } catch (_e) {}
            this.flowSelectedBeatId = n.targetBeatId;
            this._flowResetView();
            this.render(false);
          });
          g.appendChild(node);
          continue;
        }

        node.setAttribute("data-beat-id", n.id);
        const rt = n.rt || null;
        const state = rt?.state || null;
        const isHere = hereId === n.id;
        const isNext = nextSet.has(n.id);

        let accent = "rgba(148,163,184,0.55)";
        if (n.isTravel) accent = "rgba(56,189,248,0.70)";
        if (String(n.type) === "encounter") accent = "rgba(245,158,11,0.60)";
        if (n.isCinematic) accent = "rgba(168,85,247,0.70)";

        let stateStroke = "rgba(148,163,184,0.22)", stateStrokeW = "1.2";
        if (state === "ready")   { stateStroke = "rgba(74,222,128,0.70)"; stateStrokeW = "2"; }
        if (state === "blocked") { stateStroke = "rgba(245,158,11,0.60)"; stateStrokeW = "1.6"; }
        if (state === "cooling") { stateStroke = "rgba(56,189,248,0.55)"; stateStrokeW = "1.6"; }
        if (isNext)              { stateStroke = "rgba(251,191,36,0.95)"; stateStrokeW = "3"; }
        if (isHere)              { stateStroke = "rgba(251,191,36,0.75)"; stateStrokeW = "2.4"; }

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", String(p.x)); rect.setAttribute("y", String(p.y));
        rect.setAttribute("rx", "10"); rect.setAttribute("ry", "10");
        rect.setAttribute("width", String(NODE_W)); rect.setAttribute("height", String(NODE_H));
        rect.setAttribute("fill", "url(#bbttcc-node-grad)");
        rect.setAttribute("stroke", stateStroke);
        rect.setAttribute("stroke-width", stateStrokeW);
        rect.setAttribute("data-base-stroke", stateStroke);
        rect.setAttribute("data-base-stroke-width", stateStrokeW);
        node.appendChild(rect);
        if (state === "fired" && !isHere) node.setAttribute("opacity", "0.5");

        const bar = document.createElementNS(svgNS, "rect");
        bar.setAttribute("x", String(p.x + 2)); bar.setAttribute("y", String(p.y + 8));
        bar.setAttribute("rx", "2"); bar.setAttribute("ry", "2");
        bar.setAttribute("width", "4"); bar.setAttribute("height", String(NODE_H - 16));
        bar.setAttribute("fill", accent);
        node.appendChild(bar);

        // Ribbon above the card: ● HERE / ⏭ NEXT
        if (isHere || isNext) {
          const rb = document.createElementNS(svgNS, "text");
          rb.setAttribute("x", String(p.x + 4)); rb.setAttribute("y", String(p.y - 6));
          rb.setAttribute("fill", "rgba(251,191,36,0.95)");
          rb.setAttribute("font-size", "10"); rb.setAttribute("font-weight", "800"); rb.setAttribute("letter-spacing", "1.6");
          rb.textContent = isNext ? (isHere ? "● HERE · ⏭ NEXT" : "⏭ NEXT") : "● HERE";
          node.appendChild(rb);
        }

        const label = document.createElementNS(svgNS, "text");
        label.setAttribute("x", String(p.x + 16)); label.setAttribute("y", String(p.y + 27));
        label.setAttribute("fill", "rgba(240,244,252,0.96)");
        label.setAttribute("font-size", "13.5"); label.setAttribute("font-weight", "700");
        label.textContent = n.label.length > 30 ? (n.label.slice(0, 30) + "…") : n.label;
        node.appendChild(label);

        const sub = document.createElementNS(svgNS, "text");
        sub.setAttribute("x", String(p.x + 16)); sub.setAttribute("y", String(p.y + 44));
        sub.setAttribute("fill", "rgba(148,163,184,0.80)");
        sub.setAttribute("font-size", "9.5");
        sub.setAttribute("font-family", "ui-monospace, Menlo, Consolas, monospace");
        sub.textContent = n.id;
        node.appendChild(sub);

        // Top-right: TYPE · ⛩n   Bottom-right: state · 🔊
        let bx = p.x + NODE_W - 10;
        const addTop = (text, line) => { const w = Math.max(28, Math.round(12 + text.length * 5.8)); bx -= w; badge(node, text, bx, p.y + 8, w, line); bx -= 5; };
        addTop(String(n.type || "custom").toUpperCase(), "rgba(148,163,184,0.40)");
        if (rt?.gated) addTop("⛩ " + String(rt.reasons?.length ?? 0), rt.blocked ? "rgba(245,158,11,0.75)" : "rgba(74,222,128,0.5)");
        let bx2 = p.x + NODE_W - 10;
        const addBot = (text, line) => { const w = Math.max(28, Math.round(12 + text.length * 5.8)); bx2 -= w; badge(node, text, bx2, p.y + NODE_H - 24, w, line); bx2 -= 5; };
        if (rt) {
          if (rt.state === "fired") addBot("✓ FIRED" + (rt.firedTurn != null ? " T" + rt.firedTurn : ""), "rgba(34,197,94,0.55)");
          else if (rt.state === "ready") addBot("⚡ READY", "rgba(74,222,128,0.80)");
          else if (rt.state === "blocked") addBot("⛩ BLOCKED", "rgba(245,158,11,0.75)");
          else if (rt.state === "cooling") addBot("⏳ T" + String(rt.cooldownUntil), "rgba(56,189,248,0.60)");
          if (rt.invited && rt.state !== "fired") addBot("✉ INVITED", "rgba(168,85,247,0.55)");
          if (rt.hasAudio) addBot("🔊", "rgba(34,211,238,0.55)");
          // ▶ affordance on ready beats (ambient beats fire themselves).
          if (rt.state === "ready" && !rt.ambient) {
            const runG = document.createElementNS(svgNS, "g");
            runG.style.cursor = "pointer";
            const rcx = p.x + 24, rcy = p.y + NODE_H - 18;
            const rc = document.createElementNS(svgNS, "circle");
            rc.setAttribute("cx", String(rcx)); rc.setAttribute("cy", String(rcy)); rc.setAttribute("r", "10");
            rc.setAttribute("fill", "rgba(34,197,94,0.18)"); rc.setAttribute("stroke", "rgba(74,222,128,0.80)"); rc.setAttribute("stroke-width", "1.5");
            const tri = document.createElementNS(svgNS, "path");
            tri.setAttribute("d", `M ${rcx - 3} ${rcy - 4.5} L ${rcx + 5} ${rcy} L ${rcx - 3} ${rcy + 4.5} Z`);
            tri.setAttribute("fill", "rgba(74,222,128,0.95)");
            const rtT = document.createElementNS(svgNS, "title"); rtT.textContent = "Run this beat now";
            runG.appendChild(rc); runG.appendChild(tri); runG.appendChild(rtT);
            runG.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); this._runBeatFromConsole(n.id); });
            node.appendChild(runG);
          }
        }

        const title = document.createElementNS(svgNS, "title");
        let tip = `${n.label}\nid: ${n.id}\ntype: ${n.type} · timeScale: ${n.timeScale}${n.isTravel ? " · travel" : ""}\n`;
        if (rt) {
          tip += `state: ${String(rt.state || "idle").toUpperCase()}` +
            (rt.firedTurn != null ? ` (fired T${rt.firedTurn})` : "") +
            (rt.cooldownUntil != null ? ` (cooling until T${rt.cooldownUntil})` : "") +
            (rt.invited ? " · invited" : "") + "\n";
          if (rt.reasons?.length) tip += "gates:\n" + rt.reasons.map(r => `  ${r.met ? "✓" : "✗"} ${r.text}${r.current !== undefined ? `  (now: ${r.current})` : ""}`).join("\n") + "\n";
          if (rt.auto?.length) tip += `autofire: ${rt.auto.join(", ")}\n`;
          if (rt.ambient) tip += "ambient: fires itself\n";
        }
        tip += "click to select — Run / Edit";
        title.textContent = tip;
        node.appendChild(title);

        node.addEventListener("click", (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          selectNode(n.id);
        });
        nodeEls[n.id] = node;
        g.appendChild(node);
      }

      // ── selection card (click a beat → Run / Edit) ──────────────────────
      const card = document.createElement("div");
      card.className = "bbttcc-flow-card";
      card.hidden = true;
      svgWrap.appendChild(card);
      const beatOf = id => beatsAll.find(b => String(b?.id) === String(id)) || null;
      const selectNode = (id, force = false) => {
        const prev = this.flowSelectedBeatId;
        if (prev && nodeEls[prev]) {
          const r = nodeEls[prev].querySelector("rect");
          if (r) { r.setAttribute("stroke", r.getAttribute("data-base-stroke")); r.setAttribute("stroke-width", r.getAttribute("data-base-stroke-width")); }
        }
        if (!id || (!force && prev === id && !card.hidden)) { this.flowSelectedBeatId = null; card.hidden = true; return; }
        this.flowSelectedBeatId = id;
        const el = nodeEls[id];
        if (el) { const r = el.querySelector("rect"); if (r) { r.setAttribute("stroke", "rgba(34,211,238,0.95)"); r.setAttribute("stroke-width", "3.5"); } }
        const b = beatOf(id);
        if (!b) { card.hidden = true; return; }
        const rt = runtime.byId[id] || null;
        const desc = String(b.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const unmet = (rt?.reasons || []).filter(r => !r.met);
        const runLabel = !rt ? "▶ Run" : rt.state === "ready" ? "▶ Run" : rt.state === "blocked" ? "▶ Run anyway (override gate)" : rt.state === "fired" ? "▶ Run again" : "▶ Run";
        card.innerHTML =
          `<div class="hd"><div class="ttl">${esc(b.label || id)}</div><button type="button" class="x" data-close data-tooltip="Close">✕</button></div>` +
          `<div class="idl">${esc(id)}${b.questId ? ` · ${esc(sit.questOf(b))}` : ""}${rt ? ` · <b class="st ${esc(rt.state)}">${esc(String(rt.state || "idle").toUpperCase())}${rt.firedTurn != null ? ` T${rt.firedTurn}` : ""}</b>` : ""}</div>` +
          (unmet.length ? `<div class="gate">⛩ waits for: ${esc(unmet.slice(0, 3).map(r => r.text + (r.current !== undefined ? ` (now ${r.current})` : "")).join(" · "))}</div>` : "") +
          `<div class="ds${desc ? "" : " none"}">${desc ? esc(desc.length > 420 ? desc.slice(0, 420) + "…" : desc) : "(no description authored)"}</div>` +
          `<div class="btns">` +
          (rt?.ambient ? `<span class="bbttcc-muted">fires itself via travel/hexes</span>` : `<button type="button" class="run" data-run="${esc(id)}">${esc(runLabel)}</button>`) +
          `<button type="button" class="edit" data-edit="${esc(id)}">✎ Edit</button>` +
          `</div>`;
        card.hidden = false;
      };
      card.addEventListener("click", (ev) => {
        const close = ev.target?.closest?.("[data-close]");
        if (close) { ev.preventDefault(); selectNode(null); return; }
        const run = ev.target?.closest?.("[data-run]");
        if (run) { ev.preventDefault(); this._runBeatFromConsole(run.dataset.run); return; }
        const ed = ev.target?.closest?.("[data-edit]");
        if (ed) {
          ev.preventDefault();
          const b = beatOf(ed.dataset.edit);
          if (b) this._openBeatEditor(campaign.id, this._ensureBeatShape(b), "core");
        }
      });

      // ── camera: drag to pan (a real drag suppresses the click), wheel zooms
      //    to the cursor ─────────────────────────────────────────────────────
      const panXY = () => ({
        x: (this.flowPan && Number.isFinite(this.flowPan.x)) ? this.flowPan.x : 0,
        y: (this.flowPan && Number.isFinite(this.flowPan.y)) ? this.flowPan.y : 0
      });
      let dragging = false, movedFar = false;
      let start = { x: 0, y: 0, px: 0, py: 0, s: 1 };
      svg.addEventListener("mousedown", (ev) => {
        if (ev.button !== 0 && ev.button !== 1) return;
        dragging = true; movedFar = false;
        svg.style.cursor = "grabbing";
        const p = panXY(), vm = viewMap();
        start = { x: ev.clientX, y: ev.clientY, px: p.x, py: p.y, s: vm.s || 1 };
        ev.preventDefault();
      });
      svg.addEventListener("mousemove", (ev) => {
        if (!dragging) return;
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        if (!movedFar && (Math.abs(dx) + Math.abs(dy)) > 5) movedFar = true;
        this.flowPan = { x: start.px + dx / start.s, y: start.py + dy / start.s };
        applyTransform();
      });
      const onUp = () => { if (!dragging) return; dragging = false; svg.style.cursor = "grab"; };
      svg.addEventListener("mouseup", onUp);
      svg.addEventListener("mouseleave", onUp);
      svg.addEventListener("click", (ev) => {
        if (!movedFar) return;
        movedFar = false;
        ev.preventDefault(); ev.stopPropagation();
      }, true);
      bg.addEventListener("click", () => { if (!movedFar) selectNode(null); });
      const ZMIN = BBTTCCCampaignBuilderApp._FLOW_ZOOM_MIN, ZMAX = BBTTCCCampaignBuilderApp._FLOW_ZOOM_MAX;
      svg.addEventListener("wheel", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const oldZ = Number(this.flowZoom || 1) || 1;
        const newZ = Math.max(ZMIN, Math.min(ZMAX, oldZ * Math.exp(-ev.deltaY * 0.0016)));
        if (newZ === oldZ) return;
        const vm = viewMap();
        const mx = vm.r ? (ev.clientX - vm.r.left) : vm.rw / 2;
        const my = vm.r ? (ev.clientY - vm.r.top) : vm.rh / 2;
        const ux = (mx - vm.ox) / vm.s, uy = (my - vm.oy) / vm.s;
        const p = panXY(), k = newZ / oldZ;
        this.flowPan = { x: ux - (ux - p.x) * k, y: uy - (uy - p.y) * k };
        this.flowZoom = Math.round(newZ * 1000) / 1000;
        applyTransform();
      }, { passive: false });

      svgWrap.appendChild(svg);

      // Auto-frame on a fresh view (needs the mounted rect): whole tree when
      // its cards still read, otherwise a readable zoom with the root
      // top-centre — the chart is read top-down, so the root is the way in.
      try {
        const z0 = Number(this.flowZoom || 1) || 1;
        const p0 = panXY();
        if ((Math.abs(z0 - 1) < 0.001) && p0.x === 0 && p0.y === 0) {
          const vm = viewMap();
          const screenNodeW = NODE_W * vm.s;
          if (screenNodeW < 210) {
            const z = Math.max(0.6, Math.min(2.5, 230 / (NODE_W * vm.s)));
            const rootP = graph.pos[graph.rootId] || { x: 0, y: 0 };
            this.flowZoom = Math.round(z * 100) / 100;
            this.flowPan = {
              x: graph.size.w / 2 - (rootP.x + NODE_W / 2) * z,
              y: (-vm.oy / vm.s) + 36 - rootP.y * z
            };
            applyTransform();
          }
        }
      } catch (_eAuto) {}

      // Fly-to for the rail: in this quest → pan there; elsewhere → switch.
      this.__flowFlyTo = (beatId) => {
        try {
          const id = String(beatId || "");
          const p = graph.pos[id];
          if (!p) { this._flowFlyElsewhere(id, sit); return; }
          const gn = graphNodeById[id] || {};
          const w = gn.width || NODE_W, h = gn.height || NODE_H;
          const vm = viewMap();
          let z = (0.4 * vm.rw / vm.s) / w;
          z = Math.max(ZMIN, Math.min(ZMAX, z));
          const ucx = (vm.rw / 2 - vm.ox) / vm.s, ucy = (vm.rh / 2 - vm.oy) / vm.s;
          this.flowZoom = Math.round(z * 1000) / 1000;
          this.flowPan = { x: ucx - (p.x + w / 2) * z, y: ucy - (p.y + h / 2) * z };
          applyTransform();
          selectNode(id, true);
        } catch (eF) { console.warn(TAG, "flyTo failed", eF); }
      };
      // A pending selection from a quest switch (exit stub / fly elsewhere).
      if (this.flowSelectedBeatId && graph.pos[this.flowSelectedBeatId]) {
        const pending = this.flowSelectedBeatId;
        this.flowSelectedBeatId = null;
        setTimeout(() => { try { this.__flowFlyTo(pending); } catch (_e) {} }, 0);
      } else {
        this.flowSelectedBeatId = null;
      }
    } catch (e) {
      console.warn(TAG, "Flow visualizer render failed:", e);
      try {
        const host = rootEl.querySelector("[data-role='flowviz']");
        if (host) host.innerHTML = "<p class='bbttcc-muted'>Visualizer error — see console.</p>";
      } catch (_e2) {}
    }
  }

  // A beat outside the charted quest: switch the chart to its quest (follow
  // off) and select it after the re-render.
  _flowFlyElsewhere(beatId, sit) {
    const b = sit?.beatById?.[String(beatId)];
    if (!b) { ui.notifications?.info?.("That beat isn't in this campaign."); return; }
    this.flowQuestId = _flowQuestIdOf(b);
    this.flowFollow = false;
    try { game.user?.setFlag?.("bbttcc-campaign", "flowFollow", false); } catch (_e) {}
    this.flowSelectedBeatId = String(beatId);
    this._flowResetView();
    this.render(false);
  }

  _flowZoomBy(delta) {
    // Multiplicative steps (±30%) with a wide clamp — lane graphs are huge in
    // user units, so deep zoom-in must be reachable. Wheel zoom uses the same
    // clamp via _FLOW_ZOOM_MIN/MAX.
    const z = Number(this.flowZoom || 1) || 1;
    const factor = delta >= 0 ? 1.3 : (1 / 1.3);
    const next = Math.max(BBTTCCCampaignBuilderApp._FLOW_ZOOM_MIN, Math.min(BBTTCCCampaignBuilderApp._FLOW_ZOOM_MAX, z * factor));
    this.flowZoom = Math.round(next * 1000) / 1000;
  }

  static _FLOW_ZOOM_MIN = 0.04;
  static _FLOW_ZOOM_MAX = 40;

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

    // Command Deck launchers (Stage 3)
    html.find("[data-action='flow-run-reset']").on("click", ev => {
      ev.preventDefault();
      this._execToolMacro("reset-console.macro.js", "Reset Console");
    });
    html.find("[data-action='flow-census']").on("click", ev => {
      ev.preventDefault();
      this._execToolMacro("campaign-census.macro.js", "Campaign Census");
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


    // Beats quest filters — a searchable datalist input: the value is the
    // quest NAME typed/picked; resolve to id (exact match, then unique
    // prefix), empty = all.
    html.find("[data-action='beats-quest']").on("change", ev => {
      const typed = String(ev.currentTarget?.value ?? "").trim();
      const all = Array.isArray(this._questsAllCache) ? this._questsAllCache : [];
      let next = "all";
      if (typed) {
        const lc = typed.toLowerCase();
        const exact = all.find(q => String(q?.name || "").toLowerCase() === lc);
        const prefix = exact ? null : all.filter(q => String(q?.name || "").toLowerCase().startsWith(lc));
        const hit = exact || (prefix && prefix.length === 1 ? prefix[0] : null);
        if (hit) next = String(hit.id);
        else { ui.notifications?.warn?.(`No quest matches "${typed}".`); ev.currentTarget.value = ""; }
      }
      this.questFilter = next;
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
        // Repeatable beats (hubs) re-run as normal play — no interruption.
        const beat = (api.getCampaign?.(campaignId)?.beats || []).find(b => String(b?.id) === String(beatId));
        if (f && !beat?.inject?.repeatable) {
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

    // Copy the stable beat id (the ordinal "Pos" column is display-only)
    html.find("[data-action='copy-beat-id']").on("click", async ev => {
      ev.preventDefault();
      const beatId = ev.currentTarget?.dataset?.beatId;
      if (!beatId) return;
      try {
        if (game.clipboard?.copyPlainText) await game.clipboard.copyPlainText(String(beatId));
        else await navigator.clipboard.writeText(String(beatId));
        ui.notifications?.info?.(`Copied beat id: ${beatId}`);
      } catch (e) {
        console.warn(TAG, "copy-beat-id failed", e);
        ui.notifications?.warn?.(`Could not copy — beat id is: ${beatId}`);
      }
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