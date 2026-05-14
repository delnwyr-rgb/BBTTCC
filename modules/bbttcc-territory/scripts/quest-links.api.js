/* modules/bbttcc-territory/scripts/quest-links.api.js
 *
 * Hex ↔ Quest bidirectional link layer.
 *
 * Hex flag (per Drawing): flags["bbttcc-territory"].quests = {
 *   [questId]: { hinted: false, hintTs: null, addedTs: <ms> }
 * }
 *
 * Quest record (campaign settings): quest.hexIds = [drawingId, ...]
 *
 * Visibility for players:
 *   - hexDoc.hidden === false  (fog already revealed)            — OR —
 *   - hex flag quests[questId].hinted === true                   (rumor preview)
 * GM always sees everything.
 *
 * Exposed on:  game.bbttcc.api.territory.questLinks
 */

const MOD = "bbttcc-territory";
const TAG = "[bbttcc-quest-links]";

function _now() { return Date.now(); }
function _log(...a) { try { console.log(TAG, ...a); } catch {} }
function _warn(...a) { try { console.warn(TAG, ...a); } catch {} }

function _campaignApi() {
  return game?.bbttcc?.api?.campaign?.quests || null;
}

function _findHexDrawing(drawingId) {
  const id = String(drawingId || "").trim();
  if (!id) return null;
  // Search the active scene first, then any scene.
  const fromActive = canvas?.scene?.drawings?.get?.(id) || null;
  if (fromActive) return fromActive;
  for (const sc of (game?.scenes ?? [])) {
    const d = sc?.drawings?.get?.(id);
    if (d) return d;
  }
  return null;
}

function _hexQuestsMap(doc) {
  const f = doc?.flags?.[MOD] || {};
  const m = (f.quests && typeof f.quests === "object") ? f.quests : {};
  return foundry.utils.deepClone(m);
}

async function _writeHexQuestsMap(doc, nextMap) {
  if (!doc) return;
  await doc.setFlag(MOD, "quests", nextMap || {});
}

function _normalizeLinkEntry(entry) {
  const e = entry || {};
  return {
    hinted: !!e.hinted,
    hintTs: e.hintTs ?? null,
    addedTs: e.addedTs ?? _now()
  };
}

async function _writeQuestHexIds(questId, hexIds) {
  const api = _campaignApi();
  if (!api?.saveQuest || !api?.getQuest) {
    _warn("campaign quest API not available; skipping quest-side write", { questId });
    return;
  }
  const cur = api.getQuest(questId);
  if (!cur) {
    _warn("quest not found", { questId });
    return;
  }
  const merged = Object.assign({}, cur, { hexIds: Array.from(new Set((hexIds || []).map(String))) });
  await api.saveQuest(questId, merged);
}

function _getQuestHexIds(questId) {
  const api = _campaignApi();
  if (!api?.getQuest) return [];
  const q = api.getQuest(questId);
  if (!q || !Array.isArray(q.hexIds)) return [];
  return q.hexIds.map(String);
}

/* ─────────────────────────────  Public API  ───────────────────────────── */

async function linkHexQuest(drawingId, questId, opts = {}) {
  const did = String(drawingId || "").trim();
  const qid = String(questId || "").trim();
  if (!did || !qid) throw new Error("linkHexQuest: drawingId and questId required");

  const doc = _findHexDrawing(did);
  if (!doc) throw new Error("linkHexQuest: drawing not found: " + did);

  const map = _hexQuestsMap(doc);
  if (!map[qid]) {
    map[qid] = _normalizeLinkEntry({ hinted: !!opts.hinted, hintTs: opts.hinted ? _now() : null, addedTs: _now() });
  } else {
    if (opts.hinted === true && !map[qid].hinted) {
      map[qid].hinted = true;
      map[qid].hintTs = _now();
    }
  }
  await _writeHexQuestsMap(doc, map);

  const cur = _getQuestHexIds(qid);
  if (!cur.includes(did)) {
    await _writeQuestHexIds(qid, cur.concat([did]));
  }
  _log("linked", { did, qid });
  return { drawingId: did, questId: qid, entry: map[qid] };
}

async function unlinkHexQuest(drawingId, questId) {
  const did = String(drawingId || "").trim();
  const qid = String(questId || "").trim();
  if (!did || !qid) throw new Error("unlinkHexQuest: drawingId and questId required");

  const doc = _findHexDrawing(did);
  if (doc) {
    const map = _hexQuestsMap(doc);
    if (map[qid]) {
      delete map[qid];
      await _writeHexQuestsMap(doc, map);
    }
  }

  const cur = _getQuestHexIds(qid);
  const nxt = cur.filter(x => String(x) !== did);
  if (nxt.length !== cur.length) await _writeQuestHexIds(qid, nxt);

  _log("unlinked", { did, qid });
  return true;
}

async function setHint(drawingId, questId, { hinted = true } = {}) {
  const did = String(drawingId || "").trim();
  const qid = String(questId || "").trim();
  const doc = _findHexDrawing(did);
  if (!doc) throw new Error("setHint: drawing not found: " + did);
  const map = _hexQuestsMap(doc);
  if (!map[qid]) throw new Error("setHint: quest not linked to this hex: " + qid);
  map[qid].hinted = !!hinted;
  map[qid].hintTs = hinted ? _now() : null;
  await _writeHexQuestsMap(doc, map);
  _log("setHint", { did, qid, hinted });
  return map[qid];
}

async function revealAllForQuest(questId, hinted = true) {
  const qid = String(questId || "").trim();
  if (!qid) return;
  const hexIds = _getQuestHexIds(qid);
  for (const did of hexIds) {
    try { await setHint(did, qid, { hinted }); } catch (e) { _warn("revealAllForQuest skip", did, e?.message); }
  }
  return hexIds.length;
}

async function clearAllHintsForQuest(questId) {
  return revealAllForQuest(questId, false);
}

function listQuestsForHex(drawingId) {
  const did = String(drawingId || "").trim();
  const doc = _findHexDrawing(did);
  if (!doc) return [];
  const map = _hexQuestsMap(doc);
  const api = _campaignApi();
  return Object.entries(map).map(([qid, entry]) => {
    const q = api?.getQuest ? api.getQuest(qid) : null;
    return {
      questId: qid,
      drawingId: did,
      hinted: !!entry?.hinted,
      hintTs: entry?.hintTs ?? null,
      addedTs: entry?.addedTs ?? null,
      name: q?.name || qid,
      status: q?.status || "active",
      description: q?.description || ""
    };
  });
}

function listHexesForQuest(questId) {
  const qid = String(questId || "").trim();
  if (!qid) return [];
  const out = [];
  for (const did of _getQuestHexIds(qid)) {
    const doc = _findHexDrawing(did);
    if (!doc) continue;
    const map = _hexQuestsMap(doc);
    const entry = map[qid] || null;
    out.push({
      drawingId: did,
      sceneId: doc.parent?.id || null,
      sceneName: doc.parent?.name || "",
      hexName: doc.flags?.[MOD]?.name || doc.text || did,
      hidden: !!doc.hidden,
      hinted: !!entry?.hinted
    });
  }
  return out;
}

function isQuestVisibleToPlayer(hexDoc, questId) {
  if (!hexDoc) return false;
  if (game?.user?.isGM) return true;
  if (hexDoc.hidden === false) return true;
  const map = hexDoc?.flags?.[MOD]?.quests || {};
  const e = map[String(questId || "")];
  return !!(e && e.hinted);
}

function visibleQuestsForHex(hexDoc) {
  const list = listQuestsForHex(hexDoc?.id);
  if (game?.user?.isGM) return list;
  const hidden = !!hexDoc?.hidden;
  return list.filter(q => !hidden || q.hinted);
}

/* ─────────────────────────────  Audit  ───────────────────────────── */

function auditOrphans() {
  const issues = { hexRefsMissingQuest: [], questRefsMissingHex: [], mismatches: [] };
  const api = _campaignApi();
  const allQuests = api?.listQuests ? api.listQuests({ status: "all" }) : [];
  const questIds = new Set(allQuests.map(q => String(q.id)));

  for (const sc of (game?.scenes ?? [])) {
    for (const dr of (sc?.drawings ?? [])) {
      const map = dr?.flags?.[MOD]?.quests || {};
      for (const qid of Object.keys(map)) {
        if (!questIds.has(qid)) {
          issues.hexRefsMissingQuest.push({ sceneId: sc.id, drawingId: dr.id, questId: qid });
        }
      }
    }
  }

  for (const q of allQuests) {
    const hexIds = Array.isArray(q.hexIds) ? q.hexIds : [];
    for (const did of hexIds) {
      const doc = _findHexDrawing(did);
      if (!doc) {
        issues.questRefsMissingHex.push({ questId: q.id, drawingId: did });
        continue;
      }
      const map = doc.flags?.[MOD]?.quests || {};
      if (!map[q.id]) {
        issues.mismatches.push({ questId: q.id, drawingId: did, side: "hexMissingQuestEntry" });
      }
    }
  }
  return issues;
}

/* ─────────────────────────────  Mount  ───────────────────────────── */

function _mount() {
  game.bbttcc ??= {};
  game.bbttcc.api ??= {};
  game.bbttcc.api.territory ??= {};
  const ns = (game.bbttcc.api.territory.questLinks ??= {});
  ns.linkHexQuest = linkHexQuest;
  ns.unlinkHexQuest = unlinkHexQuest;
  ns.setHint = setHint;
  ns.revealAllForQuest = revealAllForQuest;
  ns.clearAllHintsForQuest = clearAllHintsForQuest;
  ns.listQuestsForHex = listQuestsForHex;
  ns.listHexesForQuest = listHexesForQuest;
  ns.isQuestVisibleToPlayer = isQuestVisibleToPlayer;
  ns.visibleQuestsForHex = visibleQuestsForHex;
  ns.auditOrphans = auditOrphans;
  _log("mounted at game.bbttcc.api.territory.questLinks");
}

Hooks.once("ready", _mount);
