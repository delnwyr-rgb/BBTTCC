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

/* ───────────────────  Visited ledger · Survey rule · Quest markers  ───────────────────
 * Owner ruling 2026-09-21/22 ("exploration is the price of the interesting ground"):
 *   visited  — per hex: flags["bbttcc-territory"].visited = { any:{first,last,n}, byFaction:{ [factionId]:{first,last,n} } }
 *              written on every bbttcc:afterTravel arrival (primary GM). The first fact the engine has
 *              ever kept about WHO HAS STOOD WHERE.
 *   survey   — a faction may plan an outpost on any visible hex; if the hex hides unplayed hex-tied
 *              story (campaign api story.hexStory) and nobody of that faction has stood there, the
 *              outpost does NOT found: the turn returns WORD (the quest starts, the hex is linked +
 *              hinted so the marker shows, and the hex remembers survey.wordSent). Founding is refused
 *              at plan time from then on until someone has visited. A hex with no story founds as before.
 *   markers  — data for the map overlay (center-hex-labels enhancer): every hex with linked quests or
 *              unplayed story, with player visibility (hinted) resolved.
 */
const _hexDocOf = (x) => x?.document ?? x;
const _hexUuidOf = (doc) => String(doc?.uuid || "");
const _hexNameOf = (doc) => String(doc?.flags?.[MOD]?.name || doc?.text || doc?.id || "the hex");
function _visitedMap(doc) { const v = doc?.flags?.[MOD]?.visited; return (v && typeof v === "object") ? v : { any: null, byFaction: {} }; }
function visitedHas(hexDoc, factionId = null) {
  const v = _visitedMap(_hexDocOf(hexDoc));
  if (!factionId) return !!v.any;
  return !!v.byFaction?.[String(factionId).replace(/^Actor\./, "")];
}
async function visitedMark(hexDoc, factionId = null, { via = "travel" } = {}) {
  const doc = _hexDocOf(hexDoc); if (!doc?.update) return null;
  const fid = String(factionId || "").replace(/^Actor\./, "");
  const v = foundry.utils.deepClone(_visitedMap(doc)); v.byFaction ??= {};
  const ts = _now(); let turn = 0; try { turn = Number(game.bbttcc?.api?.world?.getTurnNumber?.() ?? game.settings.get("bbttcc-world", "turnNumber")) || 0; } catch (_e) {}
  const bump = (rec) => ({ first: rec?.first ?? ts, firstTurn: rec?.firstTurn ?? turn, last: ts, lastTurn: turn, n: (Number(rec?.n) || 0) + 1, via });
  v.any = bump(v.any);
  if (fid) v.byFaction[fid] = bump(v.byFaction[fid]);
  await doc.update({ [`flags.${MOD}.visited`]: v });
  try { Hooks.callAll("bbttcc:hex:visited", { hexUuid: _hexUuidOf(doc), hexName: _hexNameOf(doc), factionId: fid || null, first: v.any.n === 1, via }); } catch (_e) {}
  return v;
}
function visitedList(sceneOrNull = null) {
  const out = [];
  const scenes = sceneOrNull ? [sceneOrNull] : Array.from(game.scenes ?? []);
  for (const sc of scenes) for (const d of (sc?.drawings ?? [])) { const v = d?.flags?.[MOD]?.visited; if (v?.any) out.push({ hexUuid: d.uuid, hexName: _hexNameOf(d), sceneId: sc.id, ...v }); }
  return out;
}
// Story hidden on a hex — delegated to the campaign module (it owns beats + the story store).
function _hexStory(doc) {
  try { const f = game.bbttcc?.api?.campaign?.story?.hexStory; return typeof f === "function" ? (f(doc) || null) : null; } catch (_e) { return null; }
}
function surveyCheck({ hexDoc, factionId } = {}) {
  const doc = _hexDocOf(hexDoc);
  const none = { blocked: false, wordSent: false, visited: true, questKeys: [], questIds: [], beats: [], message: "" };
  if (!doc) return none;
  const fid = String(factionId || "").replace(/^Actor\./, "");
  const visited = visitedHas(doc, fid || null);
  const st = _hexStory(doc);
  const questIds = Object.keys(_hexQuestsMap(doc));
  const hasStory = !!(st && ((st.beats?.length || 0) > 0 || (st.questKeys?.length || 0) > 0)) || questIds.length > 0;
  const survey = doc.flags?.[MOD]?.survey || null;
  const wordSent = !!survey?.wordSent;
  const name = _hexNameOf(doc);
  if (!hasStory || visited) return { ...none, visited, wordSent, questKeys: st?.questKeys || [], questIds, beats: st?.beats || [] };
  const qn = (st?.questNames || []).concat(questIds.filter(q => !(st?.registryIds || []).includes(q))).filter(Boolean);
  const message = wordSent
    ? `Word already came back from ${name}${qn.length ? ` — ${qn.join(", ")}` : ""}. Nobody of yours has stood there yet; the outpost waits until someone has.`
    : `The survey of ${name} comes back with WORD instead of a flag${qn.length ? `: ${qn.join(", ")}` : ""} — somebody has to go and stand there before an outpost can rise.`;
  return { blocked: true, visited, wordSent, questKeys: st?.questKeys || [], questIds, registryIds: st?.registryIds || [], beats: st?.beats || [], hexName: name, hexUuid: _hexUuidOf(doc), message };
}
async function surveyWord({ hexDoc, factionId, actor = null, report = null } = {}) {
  const doc = _hexDocOf(hexDoc); if (!doc) return null;
  const r = report || surveyCheck({ hexDoc: doc, factionId });
  if (!r.blocked) return r;
  const fid = String(factionId || actor?.id || "").replace(/^Actor\./, "");
  // 1. pin the story on the map: link every registry quest the story names, and hint it (players see the marker)
  const ids = Array.from(new Set([...(r.registryIds || []), ...(r.questIds || [])].filter(Boolean)));
  for (const qid of ids) {
    try { if (!_hexQuestsMap(doc)[qid]) await linkHexQuest(doc.id, qid, { hinted: true }); await setHint(doc.id, qid, { hinted: true }); }
    catch (e) { _warn("surveyWord link/hint skipped", qid, e?.message); }
  }
  // 2. the hex remembers the word
  await doc.update({ [`flags.${MOD}.survey`]: { wordSent: _now(), factionId: fid || null, questKeys: r.questKeys || [], questIds: ids } });
  // 3. the campaign starts the quest(s) and speaks
  let word = null;
  try { const f = game.bbttcc?.api?.campaign?.survey?.word; if (typeof f === "function") word = await f({ hexDoc: doc, hexUuid: _hexUuidOf(doc), hexName: _hexNameOf(doc), factionId: fid || null, actor, questKeys: r.questKeys || [], registryIds: ids, beats: r.beats || [] }); }
  catch (e) { _warn("campaign survey.word failed", e); }
  try { Hooks.callAll("bbttcc:survey:word", { hexUuid: _hexUuidOf(doc), hexName: _hexNameOf(doc), factionId: fid || null, questKeys: r.questKeys || [], registryIds: ids }); } catch (_e) {}
  return { ...r, word };
}
async function surveyClear(hexDoc) { const doc = _hexDocOf(hexDoc); if (!doc?.update) return false; await doc.update({ [`flags.${MOD}.-=survey`]: null }); return true; }
// Marker data for one scene: every territory hex with a story to show, and who may see it.
function questMarkersFor(scene = null) {
  const sc = scene || canvas?.scene; if (!sc) return [];
  const isGM = !!game.user?.isGM;
  const qapi = _campaignApi();
  const out = [];
  for (const d of (sc.drawings ?? [])) {
    const f = d?.flags?.[MOD] || {};
    if (!(f.isHex === true || String(f.kind || "").toLowerCase() === "territory-hex")) continue;
    const map = _hexQuestsMap(d);
    const linked = Object.entries(map).map(([qid, rec]) => ({ id: qid, name: String(qapi?.getQuest?.(qid)?.name || qid), hinted: !!rec?.hinted }));
    const st = isGM ? _hexStory(d) : null;
    const unplayed = st?.beats?.length || 0;
    const storyNames = (st?.questNames || []).filter(n => !linked.some(l => l.name === n));
    const anyHinted = linked.some(l => l.hinted);
    const playerVisible = anyHinted || (d.hidden === false && linked.length > 0);
    if (!linked.length && !unplayed) continue;
    if (!isGM && !playerVisible) continue;
    out.push({ drawing: d, hexUuid: d.uuid, hexName: _hexNameOf(d), linked, storyNames, unplayed, anyHinted, playerVisible, visited: visitedHas(d), wordSent: !!f.survey?.wordSent, hidden: !!d.hidden });
  }
  return out;
}
// Arrival → visited (primary GM writes; every client hears the hook).
Hooks.on("bbttcc:afterTravel", async (ctx) => {
  try {
    if (!game.user?.isGM || (game.users?.activeGM && game.users.activeGM !== game.user)) return;
    const to = _hexDocOf(ctx?.to); if (!to?.update) return;
    if (ctx?.encounter && String(ctx?.source || "") === "travel-console-relay") return;   // the relay re-emits with the encounter payload
    await visitedMark(to, ctx?.factionId || ctx?.actor?.id || null, { via: String(ctx?.source || "travel") });
  } catch (e) { _warn("visited mark on arrival failed", e); }
});

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
  // 2026-09-22 — visited ledger · Survey rule · quest markers
  game.bbttcc.api.territory.visited = { has: visitedHas, mark: visitedMark, list: visitedList };
  game.bbttcc.api.territory.survey  = { check: surveyCheck, word: surveyWord, clear: surveyClear };
  game.bbttcc.api.territory.questMarkers = { list: questMarkersFor, refresh: () => { try { Hooks.callAll("bbttcc:questMarkers:refresh"); } catch (_e) {} } };
  _log("mounted at game.bbttcc.api.territory.questLinks (+ visited · survey · questMarkers)");
}

Hooks.once("ready", _mount);
