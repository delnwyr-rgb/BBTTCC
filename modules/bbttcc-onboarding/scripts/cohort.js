/* bbttcc-onboarding/scripts/cohort.js
 * GROUP INDUCTION — Phase 1, "MVP lockstep" (2026-10-02).
 *
 * A CLASS (cohort) runs the tutorial together. Dave's rulings, binding:
 *   one faction per Steward (banner mode "each") · STRICT barriers (nobody moves
 *   to the next segment until everyone PRESENT has arrived; the GM can release a
 *   barrier; away seats don't count) · built for convention tables (12–20 seats,
 *   no cap) · trial relics are CLASS relics · the conductor is always the primary
 *   GM client · "⚑ Join the class" replaces Begin when 2+ players are connected.
 *
 * Shape of it:
 *   • Registry — world setting `cohorts` (module.js), written ONLY here on the
 *     primary GM, serialized on stage.js's activeRuns queue. Members are also in
 *     `activeRuns` (with `cohortId` + a lane from the member order), so the
 *     relay's live-run check and the lane layout work unchanged.
 *   • Conductor (primary GM) — walks SEGMENTS (beats grouped by the design's
 *     party/personal plan). Phase 1 runs EVERY segment as each member's own solo
 *     beats via the director's start({only, cohort}) — cued to all members at
 *     once — with a strict barrier after each. Graduation runs ONCE, here.
 *   • Member agent (each player client) — runs a cue, reports arrival, pings
 *     every 30 s; a reconnecting member is re-cued into the current segment and
 *     resumes (beats finished in this segment are stamped cohortSeg on the Steward).
 *   • Shared props — the proving trials and the showdown use the class key
 *     "cohort:<id>": one sigil set, one ring, one fight (beats.js), backed by the
 *     two beat ops here: classRelic and sharedProp.
 *   • GM Cohort Console (ApplicationV2) — roster + controls + a one-line feed.
 *
 * Socket (channel module.bbttcc-onboarding), GM → members:
 *   cohort-cue {cohortId, to[], segIdx, barrierId, kind, only[], seg, lanes{}, recue?}
 *   cohort-skip {cohortId, to[]} · cohort-abort {cohortId, to[]|null} · cohort-dive {to[], sceneUuid}
 *   cohort-control {op, payload} (secondary GM → primary GM)
 * Relay ops (members → GM): cohortJoin, cohortArrive, cohortPing; beat support:
 *   classRelic, sharedProp. GM-only: cohortForm/Start/Pause/Resume/Release/
 *   SkipMember/Kick/Abort/TeardownProps.
 */

const MODULE_ID = "bbttcc-onboarding";
const CHANNEL = `module.${MODULE_ID}`;
const TAG = "[onboarding/cohort]";
const SETTING = "cohorts";

const PING_MS = 30 * 1000;            // member heartbeat
const AWAY_MS = 2 * 60 * 1000;        // no ping for this long → away
const TICK_MS = 10 * 1000;            // conductor housekeeping
const RUN_REFRESH_MS = 4 * 60 * 1000; // keep members' activeRuns entries fresh (stale at 15 min)
const RECUE_GAP_MS = 20 * 1000;       // never re-cue the same seat faster than this
const FEED_MAX = 30;
const DONE_KEEP_MS = 24 * 60 * 60 * 1000;
const PROP_DATA_MAX = 4000;           // bytes of JSON a shared prop may carry
const PROP_TAKEOVER_MS = 60 * 1000;   // an unpublished shared-prop claim this old can be taken over
const FORMING_TTL_MS = 12 * 60 * 60 * 1000;   // a class nobody Started expires (review fix 2)
const IDLE_TTL_MS = 6 * 60 * 60 * 1000;       // a class with nobody present this long expires
const GRAD_RETRY_MS = 2 * 60 * 1000;          // graduatedAt but not graduated this long → retry
// The four Proving Ground trial keys (beats.js PG_TRIALS) — the only relics a class can claim.
const TRIAL_KEYS = new Set(["lava", "healing", "grove", "reef"]);

const _ns = () => globalThis.game?.bbttcc?.onboarding;
const _esc = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch (_) { return String(s ?? ""); } };
const _rid = () => { try { return foundry.utils.randomID(); } catch (_) { return Math.random().toString(36).slice(2, 12); } };
const _clone = (o) => { try { return foundry.utils.deepClone(o); } catch (_) { return JSON.parse(JSON.stringify(o ?? null)); } };
const _now = () => Date.now();

/* ─── Operator lines (WORDSMITH: Dave — all new 2026-10-02, kept few) ───────── */
const LINES = {
  joined:   "Roster's got you. Stand by for the bell — the class moves when your GM says it moves.",
  early:    "You're early. The others are still discovering which end of the vehicle is the front. Stand there looking competent; I'll ring when the class is together.",
  recue:    "You blinked. We didn't. Picking up where you dropped— *bzzt*",
  dismissed:"Class dismissed — for you, anyway. Your progress is on your Steward; the solo program still takes walk-ins.",
  start:    (n) => `${n} connections. I budgeted for one. Somebody in accounting is going to hear about this— *bzzt* —fine. Welcome, Ones. Plural. Try not to touch the walls *or each other*.`,
  gradIn:   "Training's done — all of you, more or less at once. No more sandbox, no more straw adversaries. One last door.",
  gradOut:  (n) => `${n} Ones, one world, and a strongly worded memo to accounting. You're live. Go fix what broke — and *please* fix it in roughly the same direction. *bzzt* —Operator out.`,
  noGm:     "Hold the line — the Operator lost its operator. Nobody move until the GM's back."
};

/* ─── Segments ───────────────────────────────────────────────────────────────
 * The design's plan (§4.2) with the banner moment deferred to Phase 3. In
 * Phase 1 "party" and "personal" only label the segment — both cue every
 * member at once and both end at a strict barrier. A registered beat the plan
 * doesn't know gets its own segment at its arc position, so new beats can't
 * silently drop out of class mode. */
const SEGMENT_PLAN = [
  { key: "incarnation", kind: "party",      label: "Incarnation",                 beats: ["incarnation"] },
  { key: "stretch-a",   kind: "personal",   label: "Meatsuit + Test Track",       beats: ["meatsuit", "driving"] },
  { key: "stewardship", kind: "party",      label: "Stewardship",                 beats: ["stewardship_claim", "stewardship_turn"] },
  { key: "stretch-b",   kind: "personal",   label: "Outfitting → Manifestations", beats: ["outfitting", "crew_occult", "surge", "manifestations"] },
  { key: "combat-sim",  kind: "party",      label: "Combat Sim",                  beats: ["combat_sim"] },
  { key: "travel",      kind: "party",      label: "Crossing",                    beats: ["travel"] },
  { key: "raids",       kind: "party",      label: "Three Raids",                 beats: ["raid_violence", "raid_intrigue", "raid_presence"] },
  { key: "trials",      kind: "party",      label: "Proving Trials",              beats: ["proving_trials"] },
  { key: "showdown",    kind: "party",      label: "Final Showdown",              beats: ["final_showdown"] },
  { key: "graduation",  kind: "graduation", label: "Graduation",                  beats: ["graduation"] }
];
// Segments whose class props (cohort key) are reaped once the class leaves them.
const REAP_AFTER = new Set(["trials", "showdown"]);

function buildSegments(arcIds) {
  const out = [];
  for (const id of (arcIds || [])) {
    const plan = SEGMENT_PLAN.find(p => p.beats.includes(id));
    const key = plan?.key ?? `beat:${id}`;
    const last = out[out.length - 1];
    if (last && last.key === key) { last.beats.push(id); continue; }
    out.push({ key, kind: plan?.kind ?? "personal", label: plan?.label ?? id, beats: [id] });
  }
  if (!out.some(s => s.kind === "graduation")) out.push({ ...SEGMENT_PLAN[SEGMENT_PLAN.length - 1], beats: ["graduation"] });
  // graduation is always the last segment
  const gi = out.findIndex(s => s.kind === "graduation");
  if (gi >= 0 && gi !== out.length - 1) out.push(out.splice(gi, 1)[0]);
  return out;
}

/* ─── Registry ───────────────────────────────────────────────────────────── */
function _all() { try { return _clone(game.settings.get(MODULE_ID, SETTING) ?? {}) || {}; } catch (_) { return {}; } }
function getCohort(id) { return _all()[String(id || "")] || null; }
const _isLive = (c) => !!c && c.state !== "done";
/** The most recent live class, or null. */
function liveCohort() {
  return Object.values(_all()).filter(_isLive).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0] || null;
}
/** The live class this user belongs to (not left), or null. */
function memberOf(userId = game.user?.id) {
  const uid = String(userId || "");
  return Object.values(_all()).filter(_isLive)
    .find(c => c.members?.[uid] && c.members[uid].status !== "left") || null;
}

let _fallbackQueue = Promise.resolve();
function _serialize(fn) {
  const s = _ns()?.stage?.serialize;
  if (typeof s === "function") return s(fn);
  _fallbackQueue = _fallbackQueue.then(() => fn(), () => fn());
  return _fallbackQueue;
}

/** Serialized read-modify-write of the whole registry. `fn(all)` mutates in place
 *  and returns any value; the write happens after it. GM only. */
async function _mutateAll(fn) {
  return _serialize(async () => {
    const all = _all();
    const out = await fn(all);
    const now = _now();
    for (const [id, c] of Object.entries(all)) {
      if (c?.state === "done" && now - (Number(c.ts) || 0) > DONE_KEEP_MS) delete all[id];
    }
    await game.settings.set(MODULE_ID, SETTING, all);
    return out;
  });
}
/** Same, scoped to one class. `fn(c, all)`; returns null if the class is gone. */
async function _mutate(id, fn) {
  return _mutateAll(async (all) => {
    const c = all[String(id || "")];
    if (!c) return null;
    const out = await fn(c, all);
    c.ts = _now();
    return out;
  });
}

function _feed(c, text) {
  c.feed = Array.isArray(c.feed) ? c.feed : [];
  c.feed.push({ ts: _now(), text: String(text) });
  if (c.feed.length > FEED_MAX) c.feed.splice(0, c.feed.length - FEED_MAX);
}

/* activeRuns (stage.js's registry) — members hold a lane there for the life of the class. */
function _readRuns() {
  const r = _ns()?.stage?.readRuns;
  try { return typeof r === "function" ? r() : (_clone(game.settings.get(MODULE_ID, "activeRuns") ?? {}) || {}); } catch (_) { return {}; }
}
async function _writeRuns(runs) { await game.settings.set(MODULE_ID, "activeRuns", runs); }

/** Give every non-left member a lane (stable once given), avoiding lanes held by
 *  solo runs, and write their activeRuns entries. Call INSIDE a serialized mutate. */
async function _syncRuns(c) {
  const runs = _readRuns();
  const mine = new Set(Object.keys(c.members || {}));
  const taken = new Set(Object.entries(runs).filter(([uid]) => !mine.has(uid)).map(([, e]) => Number(e?.lane) || 0));
  for (const m of Object.values(c.members || {})) if (m.status !== "left" && Number.isFinite(m.lane)) taken.add(m.lane);
  const order = Object.entries(c.members || {}).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  for (const [uid, m] of order) {
    if (m.status === "left") { delete runs[uid]; continue; }
    if (!Number.isFinite(m.lane)) { let l = 0; while (taken.has(l)) l++; m.lane = l; taken.add(l); }
    runs[uid] = { lane: m.lane, ts: _now(), name: m.name || "", cohortId: c.id };
  }
  await _writeRuns(runs);
}
async function _dropRuns(uids) {
  const runs = _readRuns();
  let n = 0;
  for (const uid of uids) if (runs[uid]) { delete runs[uid]; n++; }
  if (n) await _writeRuns(runs);
}

const PRESENT = (m) => m && (m.status === "working" || m.status === "barrier");
function _presentIds(c) { return Object.entries(c.members || {}).filter(([, m]) => PRESENT(m)).map(([uid]) => uid); }
function _barrierDone(c) {
  const pres = _presentIds(c);
  if (!pres.length) return false;                      // an empty room never advances on its own
  const arrived = new Set(c.barrier?.arrived || []);
  return pres.every(uid => arrived.has(uid));
}
function _segOf(c) { return c.segments?.[c.segmentIdx] || null; }
function _segToken(c) { return `${c.id}:${c.segmentIdx}`; }

function _userName(uid) { return game.users?.get?.(uid)?.name || "someone"; }
function _memberLabel(m, uid) { return m?.stewardName || m?.name || _userName(uid); }

/** Refresh a member's Steward/faction ids from the live world (forged mid-class, etc.). */
function _refreshIds(uid, m) {
  try {
    const user = game.users?.get?.(uid);
    const ns = _ns();
    const st = (m.stewardId && game.actors?.get?.(m.stewardId)) || ns?.resolve?.steward?.(user) || null;
    const fa = ns?.resolve?.faction?.(user, st) || null;
    m.stewardId = st?.id || m.stewardId || "";
    m.stewardName = st?.name || m.stewardName || "";
    m.factionId = fa?.id || m.factionId || "";
  } catch (_) {}
}

/* Advance logic — pure registry edits; returns the side effects to perform AFTER the write. */
function _openSegment(c, idx) {
  c.segmentIdx = idx;
  const seg = _segOf(c);
  c.barrier = { id: `${idx}:${_rid()}`, arrived: [] };
  c.beatId = seg?.beats?.[0] || "";
  for (const m of Object.values(c.members || {})) if (m.status === "barrier") m.status = "working";
  _feed(c, `▶ ${seg?.label || "segment"} (${idx + 1}/${c.segments.length})`);
  return [{ type: "cue" }];
}
function _settle(c) {
  if (c.aborting || c.state !== "running" || c.segmentIdx < 0 || !_barrierDone(c)) return [];
  return _passBarrier(c, "all present arrived");
}
function _passBarrier(c, why, { force = false } = {}) {
  const seg = _segOf(c);
  const acts = [];
  if (seg && REAP_AFTER.has(seg.key)) acts.push({ type: "reap" });
  if (seg?.kind === "graduation") {
    // Started but never finished (GM crashed / refreshed mid-graduation) → run
    // it again; _graduate is idempotent and its one-shot steps are persisted.
    if (c.graduatedAt) {
      const stuck = !c.graduated && !_graduating.has(c.id) && (force || _now() - (Number(c.graduatedAt) || 0) > GRAD_RETRY_MS);
      return stuck ? [{ type: "graduate" }] : [];
    }
    c.graduatedAt = _now();
    _feed(c, `🎓 the class is through the last door (${why})`);
    return [...acts, { type: "graduate" }];
  }
  if (c.segmentIdx + 1 >= (c.segments?.length || 0)) { c.state = "done"; _feed(c, "class complete"); return acts; }
  _feed(c, `◆ barrier passed — ${why}`);
  return [...acts, ..._openSegment(c, c.segmentIdx + 1)];
}

/* ─── Socket + side effects (GM) ─────────────────────────────────────────── */
const _graduating = new Set();  // class ids whose graduation is in flight on THIS client
const _lastCue = new Map();     // uid → { ts, barrierId } of the last cue sent (re-cue throttle)
const _lastSeen = new Map();    // uid → ts of the last ping (GM memory; never persisted per ping)

function _emit(msg) {
  try { game.socket?.emit?.(CHANNEL, { ...msg, fromUserId: game.user?.id }); } catch (e) { console.warn(TAG, "emit failed", e); }
}
function _cue(c, uids, { recue = false } = {}) {
  const seg = _segOf(c);
  if (!seg || !uids.length) return;
  const lanes = {};
  for (const uid of uids) { lanes[uid] = Number(c.members?.[uid]?.lane) || 0; _lastCue.set(uid, { ts: _now(), barrierId: c.barrier?.id || "" }); }
  _emit({ t: "cohort-cue", cohortId: c.id, to: uids, segIdx: c.segmentIdx, barrierId: c.barrier?.id || "",
          kind: seg.kind, only: seg.beats.slice(), seg: _segToken(c), label: seg.label, lanes, recue });
}

async function _perform(cohortId, acts = []) {
  if (!acts?.length) return;
  if (getCohort(cohortId)?.aborting) return;          // an Abort is tearing this class down
  for (const a of acts) {
    try {
      if (a.type === "reap") await _teardownProps(cohortId);
      else if (a.type === "graduate") await _graduate(cohortId);
      else if (a.type === "cue") {
        const c = getCohort(cohortId);
        if (c?.state === "running") {
          // Every working member at once; graduation opens with one class line first.
          if (_segOf(c)?.kind === "graduation") await _speakClass(c, LINES.gradIn);
          if (c.segmentIdx === 0) await _speakClass(c, LINES.start(Object.values(c.members).filter(m => m.status !== "left").length));
          _cue(c, _presentIds(c).filter(uid => c.members[uid].status === "working"));
        }
      }
    } catch (e) { console.warn(TAG, `side effect "${a.type}" failed`, e); }
  }
}

function _gmIds() { return (game.users?.contents ?? []).filter(u => u.isGM && u.active).map(u => u.id); }
async function _speakClass(c, line) {
  const ids = new Set([..._presentIds(c), ..._gmIds()]);
  try { await _ns()?.speak?.(line, { audience: [...ids] }); } catch (_) {}
}

/** Reap every doc carrying this class's owner key: tokens (token or actor key),
 *  wall rings, the shared Combat(s), then the spawned actors themselves. */
async function _teardownProps(cohortId) {
  const key = `cohort:${cohortId}`;
  const k = (d) => { try { return d?.getFlag?.(MODULE_ID, "ownerKey") || ""; } catch (_) { return ""; } };
  let nT = 0, nW = 0, nA = 0, nC = 0;
  for (const scene of (game.scenes?.contents ?? [])) {
    const toks = (scene.tokens?.contents ?? []).filter(t => k(t) === key || k(t.actor) === key).map(t => t.id);
    if (toks.length) { try { await scene.deleteEmbeddedDocuments("Token", toks); nT += toks.length; } catch (e) { console.warn(TAG, "prop token reap failed", e); } }
    const walls = (scene.walls?.contents ?? []).filter(w => k(w) === key).map(w => w.id);
    if (walls.length) { try { await scene.deleteEmbeddedDocuments("Wall", walls); nW += walls.length; } catch (e) { console.warn(TAG, "ring reap failed", e); } }
  }
  for (const cb of (game.combats?.contents ?? []).filter(x => k(x) === key)) { try { await cb.delete(); nC++; } catch (_) {} }
  for (const a of (game.actors?.contents ?? []).filter(x => k(x) === key && x.getFlag?.(MODULE_ID, "spawned"))) { try { await a.delete(); nA++; } catch (_) {} }
  if (nT || nW || nA || nC) console.log(TAG, `class props reaped for ${key}: ${nT} token(s), ${nW} wall(s), ${nA} actor(s), ${nC} combat(s).`);
  return { ok: true, tokens: nT, walls: nW, actors: nA, combats: nC };
}

/** ONE graduation for the class: teardown, stamp, one table-wide dive, one handoff. */
async function _graduate(cohortId) {
  if (_graduating.has(cohortId)) return;
  _graduating.add(cohortId);
  try { await _graduateOnce(cohortId); } finally { _graduating.delete(cohortId); }
}
/* Idempotent: teardown/stamps/lane release are safe to repeat; the dive and the
 * campaign handoff are one-shot, each persisted (divedAt / handoffAt) BEFORE it
 * fires, so a retry after a crash never repeats them (at-most-once). */
async function _graduateOnce(cohortId) {
  const c = getCohort(cohortId);
  if (!c || c.graduated || c.aborting) return;
  const ns = _ns();
  const present = _presentIds(c);
  const everyone = Object.entries(c.members || {}).filter(([, m]) => m.status !== "left").map(([uid]) => uid);

  // Teardown: each member's own finale props (hostile faction, hexes, raid pointer), then the class's.
  const hostileScene = ns?.resolve?.scene?.("hostile-hex");
  for (const uid of everyone) {
    const m = c.members[uid]; _refreshIds(uid, m);
    try { await ns?.runAsGM?.("teardownFinale", { factionId: m.factionId || "", sceneId: hostileScene?.id || "", ownerUserId: uid }); }
    catch (e) { console.warn(TAG, "member finale teardown failed", e); }
  }
  await _teardownProps(cohortId);

  // Stamp graduation on the PRESENT members' Stewards (the absent catch up solo).
  const seg = _segToken(c);
  for (const uid of present) {
    const st = game.actors?.get?.(c.members[uid].stewardId || "");
    if (!st) continue;
    try {
      const p = _clone(st.getFlag?.(MODULE_ID, "progress") || { currentStep: null, steps: {}, startedAt: _now(), completedAt: null });
      p.steps = p.steps || {};
      p.steps.graduation = { done: true, at: _now(), cohortSeg: seg };
      p.currentStep = null; p.completedAt = _now();
      await st.setFlag(MODULE_ID, "progress", p);
    } catch (e) { console.warn(TAG, "graduation stamp failed for", st.name, e); }
  }
  try { await game.settings.set(MODULE_ID, "completed", true); } catch (_) {}

  // Release the lanes BEFORE the dive (nothing of ours is mid-run any more).
  await _serialize(() => _dropRuns(everyone));

  // One dive. "activate" pulls the whole table — unless someone OUTSIDE the
  // class is mid-tutorial, in which case each member dives on their own screen.
  const main = ns?.resolve?.mainMap?.();
  const tx = globalThis.game?.bbttcc?.api?.transition;
  const outsiders = Object.keys(_readRuns()).filter(uid => !c.members?.[uid]).length;
  const firstDive = !c.divedAt && !!(await _mutate(cohortId, (cc) => { if (cc.divedAt) return false; cc.divedAt = _now(); return true; }));
  if (main && firstDive) {
    const d = main.dimensions ?? {};
    const focus = { x: Math.round((d.sceneX ?? 0) + (d.sceneWidth ?? main.width ?? 2000) / 2), y: Math.round((d.sceneY ?? 0) + (d.sceneHeight ?? main.height ?? 1400) / 2) };
    if (outsiders > 0) {
      _emit({ t: "cohort-dive", cohortId, to: present, sceneUuid: main.uuid });
      console.log(TAG, `graduation: ${outsiders} solo run(s) live outside the class — members dive individually (audience:"view").`);
    } else if (tx?.dive) {
      try { await tx.dive(main.uuid, { focus, audience: "activate", label: "Bad Eden" }); }
      catch (e) { console.warn(TAG, "class graduation dive failed; activating instead", e); try { await main.activate?.(); } catch (_) {} }
    } else { try { await main.activate?.(); } catch (_) {} }
  } else if (!main) console.warn(TAG, "No live Bad Eden map resolved for the class graduation dive.");

  if (firstDive) await _speakClass(c, LINES.gradOut(present.length));

  // Campaign handoff — exactly once for the class (guarded by graduatedAt,
  // persisted before this runs). Enrollment = the campaignClass flag the Join
  // button stamps; a class formed by hand with nobody enrolled stays silent.
  try {
    const resumeId = String(game.settings.get(MODULE_ID, "campaignResumeBeatId") || "").trim();
    const enrolled = everyone.filter(uid => game.users?.get?.(uid)?.getFlag?.(MODULE_ID, "campaignClass"));
    const firstHandoff = resumeId && enrolled.length && !c.handoffAt
      && !!(await _mutate(cohortId, (cc) => { if (cc.handoffAt) return false; cc.handoffAt = _now(); return true; }));
    if (firstHandoff) {
      for (const uid of everyone) { try { await game.users.get(uid)?.unsetFlag?.(MODULE_ID, "campaignClass"); } catch (_) {} }
      const stillOut = (game.users?.contents ?? []).filter(u => !c.members?.[u.id] && u.getFlag?.(MODULE_ID, "campaignClass")).map(u => u.name);
      const gmIds = (game.users?.contents ?? []).filter(u => u.isGM).map(u => u.id);
      const who = _esc(c.name || "The class");
      await ChatMessage.create({
        whisper: gmIds,
        content: stillOut.length
          ? `<div class="bbttcc-onb-handoff"><h3>🎓 ${who} graduated (${present.length})</h3><p>Still in training: <b>${_esc(stillOut.join(", "))}</b>. The orientation film unlocks when they're out too — or run the beat early from the Campaign Builder.</p></div>`
          : `<div class="bbttcc-onb-handoff"><h3>🎬 The class is out — ${who}, ${present.length} graduated</h3><p>Roll the orientation film (Teaching Slide 1) when the table's ready.</p><button type="button" class="bbttcc-onb-resume">🎬 Roll the orientation film</button></div>`
      });
    }
  } catch (e) { console.warn(TAG, "class graduation → campaign handoff failed", e); }

  await _mutate(cohortId, (cc) => {
    cc.state = "done"; cc.graduated = true;
    for (const uid of present) if (cc.members[uid]) cc.members[uid].status = "barrier";
    _feed(cc, `🎓 graduated ${present.length} — handed off to live Bad Eden`);
  });
}

/* ─── GM ops (relay) ─────────────────────────────────────────────────────── */
function _newCohort(gmId) {
  const id = _rid();
  const d = new Date();
  return {
    id, name: `Class of ${d.toLocaleDateString?.() ?? d.toISOString().slice(0, 10)}`, gmId: gmId || game.user?.id || "",
    state: "forming", bannerMode: "each", segmentIdx: -1, beatId: "", segments: [],
    barrier: { id: "", arrived: [] }, members: {}, relics: {}, props: {}, feed: [],
    createdAt: _now(), ts: _now()
  };
}
function _addMember(c, uid) {
  const user = game.users?.get?.(uid);
  const m = { stewardId: "", stewardName: "", factionId: "", name: user?.name || "", lane: null,
              status: c.state === "forming" ? "barrier" : "working", lastSeen: _now(), joinedAt: _now() };
  _refreshIds(uid, m);
  c.members[uid] = m;
  _lastSeen.set(uid, _now());
  return m;
}

const OPS = {
  /* Member: join the live class (forming or running — a late join is cued
   * straight into the current segment). Creates a forming class if none. */
  async cohortJoin({ userId }) {
    const user = game.users?.get?.(String(userId || ""));
    if (!user || user.isGM) return { ok: false, reason: "GMs conduct; they don't enrol" };
    let acts = [], cid = "";
    const res = await _mutateAll(async (all) => {
      let c = Object.values(all).filter(_isLive).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      if (!c) { c = _newCohort(_ns()?.relay?.isPrimaryGM?.() ? game.user.id : ""); all[c.id] = c; _feed(c, "class forming"); }
      cid = c.id;
      const m = c.members[user.id];
      if (m && m.status !== "left") {
        if (m.status === "away") { m.status = (c.barrier?.arrived || []).includes(user.id) || c.state === "forming" ? "barrier" : "working"; _feed(c, `${_memberLabel(m, user.id)} is back`); }
        _lastSeen.set(user.id, _now());
        return { ok: true, cohortId: c.id, state: c.state, already: true };
      }
      if (m) { delete c.members[user.id]; c.barrier.arrived = (c.barrier.arrived || []).filter(u => u !== user.id); }
      const nm = _addMember(c, user.id);
      _feed(c, `⚑ ${_memberLabel(nm, user.id)} joined${c.state === "forming" ? "" : " late"} · ${Object.values(c.members).filter(x => x.status !== "left").length} on the roster`);
      if (c.state !== "forming") { await _syncRuns(c); if (c.state === "running") acts = [{ type: "cueOne", uid: user.id }]; }
      c.ts = _now();
      return { ok: true, cohortId: c.id, state: c.state, lane: nm.lane };
    });
    for (const a of acts) if (a.type === "cueOne") { const c = getCohort(cid); if (c) _cue(c, [a.uid]); }
    return res;
  },

  /* Member: reached the barrier of the segment they were cued into. */
  async cohortArrive({ userId, cohortId, barrierId = "", ok = true, note = "" }) {
    let acts = [];
    const res = await _mutate(cohortId, (c) => {
      const m = c.members?.[userId];
      if (!m || m.status === "left") return { ok: false, gone: true };
      if (!c.barrier?.id || c.barrier.id !== barrierId) return { ok: false, stale: true };
      _lastSeen.set(userId, _now());
      c.barrier.arrived = c.barrier.arrived || [];
      if (!c.barrier.arrived.includes(userId)) c.barrier.arrived.push(userId);
      m.status = "barrier"; m.lastSeen = _now();
      const pres = _presentIds(c), arr = pres.filter(u => c.barrier.arrived.includes(u)).length;
      _feed(c, `${_memberLabel(m, userId)} reached the gate${ok ? "" : ` (${note || "couldn't run"})`} · ${arr}/${pres.length}`);
      acts = _settle(c);
      return { ok: true, waiting: Math.max(0, pres.length - arr), of: pres.length };
    });
    await _perform(cohortId, acts);
    return res ?? { ok: false, gone: true };
  },

  /* Member heartbeat. Cheap: only writes when a status flips or an arrival
   * that never landed (GM was away) is carried in. Re-cues a seat that is
   * neither running nor at the gate (a refresh mid-segment). */
  async cohortPing({ userId, cohortId, arrivedBarrierId = "", running = false }) {
    _lastSeen.set(userId, _now());
    const c0 = getCohort(cohortId);
    const m0 = c0?.members?.[userId];
    if (!_isLive(c0) || !m0 || m0.status === "left") return { ok: false, gone: true };
    const arrived0 = (c0.barrier?.arrived || []).includes(userId);
    const carriesArrival = !!arrivedBarrierId && arrivedBarrierId === c0.barrier?.id && !arrived0;
    let acts = [];
    if (m0.status === "away" || carriesArrival) {
      await _mutate(cohortId, (c) => {
        const m = c.members[userId]; if (!m || m.status === "left") return;
        const arrivedNow = carriesArrival || (c.barrier?.arrived || []).includes(userId);
        if (carriesArrival && !(c.barrier.arrived || []).includes(userId)) c.barrier.arrived.push(userId);
        if (m.status === "away") _feed(c, `${_memberLabel(m, userId)} is back`);
        m.status = arrivedNow || c.state === "forming" ? "barrier" : "working";
        m.lastSeen = _now();
        acts = _settle(c);
      });
      await _perform(cohortId, acts);
    }
    const c = getCohort(cohortId);
    const m = c?.members?.[userId];
    const atGate = (c?.barrier?.arrived || []).includes(userId);
    // Throttle only a repeat of the SAME segment's cue; a seat that missed this
    // segment's cue entirely (it was away when the class moved) is cued at once.
    const lc = _lastCue.get(userId);
    const recent = lc && lc.barrierId === c?.barrier?.id && _now() - lc.ts < RECUE_GAP_MS;
    if (c && (c.state === "running" || c.state === "paused") && c.segmentIdx >= 0 && m?.status === "working"
        && !atGate && !running && !recent) {
      _cue(c, [userId], { recue: true });
      return { ok: true, recued: true };
    }
    return { ok: true, state: c?.state };
  },

  /* Beat support: the class claims a trial relic. First claim wins; the relic is
   * recorded for EVERY member (their Steward's provingRelics flag — the GM is the
   * only writer while a class runs), the item mints on the claimer's client. */
  async classRelic({ userId, cohortId, key }) {
    const k = String(key || "");
    if (!TRIAL_KEYS.has(k)) return { ok: false, badKey: true };
    return (await _mutate(cohortId, async (c) => {
      const m = c.members?.[userId];
      if (!m || m.status === "left") return { ok: false, gone: true };
      c.relics = c.relics || {};
      const prior = c.relics[k];
      if (!prior) {
        c.relics[k] = { userId, name: _memberLabel(m, userId), at: _now() };
        _feed(c, `✦ ${_memberLabel(m, userId)} took the ${k} relic for the class · ${Object.keys(c.relics).filter(x => TRIAL_KEYS.has(x)).length}`);
      }
      const held = Object.keys(c.relics).filter(x => TRIAL_KEYS.has(x));
      for (const [uid, mm] of Object.entries(c.members)) {
        if (mm.status === "left") continue;
        const st = game.actors?.get?.(mm.stewardId || "") || (_refreshIds(uid, mm), game.actors?.get?.(mm.stewardId || ""));
        if (!st) continue;
        const cur = st.getFlag?.(MODULE_ID, "provingRelics");
        const next = [...new Set([...(Array.isArray(cur) ? cur : []), ...held])];
        if (!Array.isArray(cur) || next.length !== cur.length) {
          try { await st.setFlag(MODULE_ID, "provingRelics", next); } catch (e) { console.warn(TAG, "class relic stamp failed", st.name, e); }
        }
      }
      const by = c.relics[k];
      return { ok: by.userId === userId, first: !prior, by: by.userId, byName: by.name, held };
    })) ?? { ok: false, gone: true };
  },

  /* Beat support: claim/set/get/release one shared prop slot ("showdown",
   * "messenger"). The first claimant stages it and publishes its ids with
   * "set"; everyone else reads them (members poll the synced setting). */
  async sharedProp({ userId, cohortId, key, mode = "claim", data = null }) {
    const k = String(key || "").slice(0, 40);
    if (!k) return { ok: false };
    return (await _mutate(cohortId, (c) => {
      const m = c.members?.[userId];
      if (!m || m.status === "left") return { ok: false, gone: true };
      c.props = c.props || {};
      const p = c.props[k];
      if (mode === "claim") {
        if (!p) { c.props[k] = { by: userId, at: _now(), data: null }; return { ok: true, first: true }; }
        // The claimant re-entering before publishing (a refresh mid-staging) stages again.
        if (p.data == null && p.by === userId) { p.at = _now(); return { ok: true, first: true }; }
        // An unpublished claim held too long (idling at the door dialog) or by a
        // seat no longer present is TAKEN OVER — one stager, never N fallbacks.
        const holder = c.members?.[p.by];
        const holderGone = !holder || !PRESENT(holder) || game.users?.get?.(p.by)?.active === false;
        if (p.data == null && (holderGone || _now() - (Number(p.at) || 0) > PROP_TAKEOVER_MS)) {
          c.props[k] = { by: userId, at: _now(), data: null };
          _feed(c, `${_memberLabel(m, userId)} took over staging "${k}"`);
          return { ok: true, first: true, tookOver: true };
        }
        return { ok: true, first: false, by: p.by, data: p.data };
      }
      if (mode === "set") {
        if (!p || p.by !== userId) return { ok: false };
        let json = "";
        try { json = JSON.stringify(data ?? null); } catch (_) { return { ok: false }; }
        if (json.length > PROP_DATA_MAX) return { ok: false, tooBig: true };
        p.data = JSON.parse(json);
        return { ok: true };
      }
      if (mode === "release") { if (p && p.by === userId) delete c.props[k]; return { ok: true }; }
      return { ok: true, by: p?.by || "", data: p?.data ?? null };
    })) ?? { ok: false, gone: true };
  },

  /* ── GM-only controls ── */
  async cohortForm({ userIds = null } = {}) {
    const ids = (Array.isArray(userIds) && userIds.length ? userIds : (game.users?.contents ?? []).filter(u => u.active && !u.isGM).map(u => u.id))
      .filter(uid => { const u = game.users?.get?.(uid); return u && !u.isGM; });
    return _mutateAll(async (all) => {
      let c = Object.values(all).filter(_isLive).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
      if (c && c.state !== "forming") return { ok: false, reason: "a class is already running", cohortId: c.id };
      if (!c) { c = _newCohort(game.user?.id); all[c.id] = c; }
      let added = 0, skipped = 0;
      const runs = _readRuns();
      for (const uid of ids) {
        // A seat mid SOLO run isn't pulled in (its later runEnd would drop the class's lane).
        if (runs[uid] && runs[uid].cohortId !== c.id) { skipped++; continue; }
        if (!c.members[uid] || c.members[uid].status === "left") { delete c.members[uid]; _addMember(c, uid); added++; }
      }
      if (skipped) _feed(c, `${skipped} seat(s) mid solo run left off the roster — they can Join when done`);
      _feed(c, `⚑ class formed from present players (+${added}) · ${Object.values(c.members).filter(m => m.status !== "left").length} on the roster`);
      c.ts = _now();
      return { ok: true, cohortId: c.id, added };
    });
  },

  async cohortStart({ cohortId }) {
    let acts = [];
    const res = await _mutate(cohortId, async (c) => {
      if (c.state !== "forming") return { ok: false, reason: `class is ${c.state}` };
      const roster = Object.values(c.members).filter(m => m.status !== "left");
      if (!roster.length) return { ok: false, reason: "nobody on the roster" };
      const arc = (_ns()?.beats?.list?.() ?? []).map(b => b.id);
      c.segments = buildSegments(arc);
      c.state = "running"; c.startedAt = _now();
      for (const [uid, m] of Object.entries(c.members)) { if (m.status !== "left") { _refreshIds(uid, m); if (m.status !== "away") m.status = "working"; } }
      await _syncRuns(c);
      acts = _openSegment(c, 0);
      return { ok: true, segments: c.segments.length };
    });
    await _perform(cohortId, acts);
    return res ?? { ok: false };
  },

  async cohortPause({ cohortId }) {
    return (await _mutate(cohortId, (c) => {
      if (c.state !== "running") return { ok: false };
      c.state = "paused"; _feed(c, "⏸ paused — the class holds at the next gate");
      return { ok: true };
    })) ?? { ok: false };
  },

  async cohortResume({ cohortId }) {
    let acts = [];
    const res = await _mutate(cohortId, (c) => {
      if (c.state !== "paused") return { ok: false };
      c.state = "running"; _feed(c, "▶ resumed");
      acts = _settle(c);
      return { ok: true };
    });
    await _perform(cohortId, acts);
    return res ?? { ok: false };
  },

  /* Release the barrier now: the class moves on whoever has arrived. A member
   * still mid-segment is cued forward (their client cuts the old segment short;
   * what they missed stays unstamped for solo catch-up). */
  async cohortRelease({ cohortId }) {
    let acts = [];
    const res = await _mutate(cohortId, (c) => {
      if (!(c.state === "running" || c.state === "paused") || c.segmentIdx < 0) return { ok: false };
      const pres = _presentIds(c), arr = pres.filter(u => (c.barrier?.arrived || []).includes(u)).length;
      c.state = "running";
      acts = _passBarrier(c, `GM released (${arr}/${pres.length} had arrived)`, { force: true });
      return { ok: true };
    });
    await _perform(cohortId, acts);
    return res ?? { ok: false };
  },

  /* Skip a member past the beat they're on. Online → their client finishes the
   * beat (stamped done, as the solo skip hatch does). Not online → they're
   * marked arrived for this segment so the class isn't held for them. */
  async cohortSkipMember({ cohortId, userId }) {
    const c0 = getCohort(cohortId);
    const m0 = c0?.members?.[userId];
    if (!c0 || !m0 || m0.status === "left") return { ok: false };
    const online = !!game.users?.get?.(userId)?.active && m0.status === "working";
    if (online) {
      _emit({ t: "cohort-skip", cohortId, to: [userId] });
      await _mutate(cohortId, (c) => { _feed(c, `⏭ GM skipped ${_memberLabel(c.members[userId], userId)} past their current beat`); });
      return { ok: true, via: "client" };
    }
    let acts = [];
    await _mutate(cohortId, (c) => {
      c.barrier.arrived = c.barrier.arrived || [];
      if (!c.barrier.arrived.includes(userId)) c.barrier.arrived.push(userId);
      _feed(c, `⏭ GM waved ${_memberLabel(c.members[userId], userId)} through this gate`);
      acts = _settle(c);
    });
    await _perform(cohortId, acts);
    return { ok: true, via: "registry" };
  },

  async cohortKick({ cohortId, userId }) {
    let acts = [];
    const res = await _mutate(cohortId, async (c) => {
      const m = c.members?.[userId];
      if (!m || m.status === "left") return { ok: false };
      m.status = "left";
      c.barrier.arrived = (c.barrier?.arrived || []).filter(u => u !== userId);
      await _dropRuns([userId]);
      _feed(c, `✕ ${_memberLabel(m, userId)} left the class`);
      acts = _settle(c);
      return { ok: true };
    });
    if (res?.ok) _emit({ t: "cohort-abort", cohortId, to: [userId] });
    await _perform(cohortId, acts);
    return res ?? { ok: false };
  },

  /* Abort + teardown: every member's run stops after its current beat, the
   * class props and each member's finale props are reaped, lanes released. */
  async cohortAbort({ cohortId }) {
    // Mark the class ABORTING in one write BEFORE anything else (review fix 1):
    // _settle/_perform/_onCue all honour it, so an arrival landing during the
    // (slow) teardown can never open the next segment and cue zombie runs.
    const c = await _mutate(cohortId, (cc) => {
      if (cc.state === "done") return null;
      cc.aborting = true; cc.aborted = true;
      _feed(cc, "✕ aborting — stopping runs and tearing down");
      return _clone(cc);
    });
    if (!c) return { ok: false };
    _emit({ t: "cohort-abort", cohortId, to: null });
    const uids = Object.keys(c.members || {});
    const hostileScene = _ns()?.resolve?.scene?.("hostile-hex");
    for (const uid of uids) {
      const m = c.members[uid];
      if (m.status === "left") continue;
      try { await _ns()?.runAsGM?.("teardownFinale", { factionId: m.factionId || "", sceneId: hostileScene?.id || "", ownerUserId: uid }); } catch (_) {}
    }
    await _teardownProps(cohortId);
    await _mutate(cohortId, async (cc) => {
      cc.state = "done"; cc.aborting = false;
      await _dropRuns(uids);
      _feed(cc, "✕ class aborted by the GM — props torn down");
    });
    return { ok: true };
  },

  async cohortTeardownProps({ cohortId }) { return _teardownProps(cohortId); }
};

/* ─── Conductor housekeeping (primary GM) ────────────────────────────────── */
/** Expire abandoned classes (review fix 2): a class nobody Started within
 *  FORMING_TTL, or one with nobody present for IDLE_TTL, goes `done` and
 *  releases its lanes — a stray class must never hold the table in class mode. */
async function _expireStale() {
  const now = _now();
  for (const c0 of Object.values(_all()).filter(_isLive)) {
    if (c0.aborting) continue;
    const present = _presentIds(c0).filter(uid => game.users?.get?.(uid)?.active !== false);
    const formingStale = c0.state === "forming" && now - (Number(c0.createdAt) || 0) > FORMING_TTL_MS;
    const idleStale = !present.length && c0.idleSince && now - Number(c0.idleSince) > IDLE_TTL_MS;
    if (formingStale || idleStale) {
      await _mutate(c0.id, async (c) => {
        c.state = "done"; c.expired = true;
        await _dropRuns(Object.keys(c.members || {}));
        _feed(c, formingStale ? "⌛ expired — never started" : "⌛ expired — nobody present for hours");
      });
      console.log(TAG, `class ${c0.name} expired (${formingStale ? "never started" : "idle"}).`);
      continue;
    }
    // Track the idle window (only written when it flips).
    if (!present.length && !c0.idleSince) await _mutate(c0.id, (c) => { c.idleSince = now; });
    else if (present.length && c0.idleSince) await _mutate(c0.id, (c) => { delete c.idleSince; });
  }
}

let _lastRunRefresh = 0;
async function _tick() {
  if (!_ns()?.relay?.isPrimaryGM?.()) return;
  await _expireStale();
  const live = Object.values(_all()).filter(_isLive);
  if (!live.length) return;
  const now = _now();
  const refreshRuns = now - _lastRunRefresh > RUN_REFRESH_MS;
  for (const c0 of live) {
    // Who has gone quiet? (A fresh conductor — GM refresh — grants everyone a full grace window.)
    const goneAway = [];
    for (const [uid, m] of Object.entries(c0.members || {})) {
      if (!PRESENT(m)) continue;
      if (!_lastSeen.has(uid)) { _lastSeen.set(uid, now); continue; }
      const user = game.users?.get?.(uid);
      if (user?.active === false || now - _lastSeen.get(uid) > AWAY_MS) goneAway.push(uid);
    }
    if (c0.aborting) continue;
    if (!goneAway.length && !refreshRuns && !(c0.state === "running" && _barrierDone(c0))) continue;
    let acts = [];
    await _mutate(c0.id, async (c) => {
      for (const uid of goneAway) {
        const m = c.members[uid];
        if (m && PRESENT(m)) { m.status = "away"; _feed(c, `○ ${_memberLabel(m, uid)} went quiet — marked away`); }
      }
      if (refreshRuns && c.state !== "forming") await _syncRuns(c);
      acts = _settle(c);
    });
    await _perform(c0.id, acts);
  }
  if (refreshRuns) _lastRunRefresh = now;
}

/* ─── Member agent (player clients) ──────────────────────────────────────── */
let _cueActive = false;     // a cue is being run on this client (start() or the graduation door)
let _cueBarrier = "";
let _pendingCue = null;     // a newer cue that arrived mid-segment (barrier released)
let _arrivedBarrier = "";   // the last barrier this client reached (re-sent with pings)

const _gmOnline = () => (game.users?.contents ?? []).some(u => u.isGM && u.active);
async function _speakSelf(line) { try { await _ns()?.speak?.(line, { audience: [game.user.id, ..._gmIds()] }); } catch (_) {} }

async function _arrive(msg, result) {
  _arrivedBarrier = msg.barrierId;
  const ok = !!(result?.ok);
  const note = result?.busy ? "a solo run was open" : (result ? "" : "no Steward / didn't start");
  const r = await _ns()?.runAsGM?.("cohortArrive", { cohortId: msg.cohortId, barrierId: msg.barrierId, ok, note });
  if (r?.ok && r.waiting > 0) await _speakSelf(LINES.early);
}

async function _runCue(msg) {
  const ns = _ns();
  _cueActive = true; _cueBarrier = msg.barrierId;
  let result = null;
  try {
    if (msg.recue) await _speakSelf(LINES.recue);
    if (msg.kind === "graduation") {
      // The class's last door. The conductor graduates everyone once; this only says "I'm through".
      const pick = await ns?.ui?.choose?.({
        title: "◇ OPERATOR",
        content: `<p>You're ready — all of you. Step out of the tutorial and into the <b>living world</b>.</p><p>The door opens when the class is through it.</p>`,
        options: [{ action: "go", label: "Enter Bad Eden" }], fallback: "go"
      });
      result = { ok: true, ran: [], pick };
    } else if (memberOf(game.user.id)?.id === msg.cohortId) {
      const lane = Number(msg.lanes?.[game.user.id]) || 0;
      result = await ns?.start?.({ only: msg.only, cohort: { id: msg.cohortId, lane, seg: msg.seg } });
    } else result = { ok: false, aborted: true, ran: [] };    // left the class while the cue was queued
  } catch (e) { console.warn(TAG, "cued segment failed", e); }
  finally {
    _cueActive = false; _cueBarrier = "";
    ns?.cohortPending?.("clear");                    // a skip/abort aimed at a run that never started must not linger
  }
  if (_pendingCue) { const next = _pendingCue; _pendingCue = null; return _runCue(next); }
  if (result?.aborted) return;                    // kicked / torn down — no arrival
  if (!memberOf(game.user.id)) return;            // left the class meanwhile
  await _arrive(msg, result);
}

function _onCue(msg) {
  if (game.user?.isGM || !Array.isArray(msg.to) || !msg.to.includes(game.user.id)) return;
  // Only a live class we still belong to may start a run here (review fix 1):
  // a cue racing an Abort/Kick is dropped, never a zombie segment.
  const c = getCohort(msg.cohortId);
  const m = c?.members?.[game.user.id];
  if (!c || c.aborting || !(c.state === "running" || c.state === "paused") || !m || m.status === "left") return;
  if (_cueActive) {
    if (_cueBarrier === msg.barrierId) return;    // already on it
    _pendingCue = msg;                             // the class moved on: cut this segment short
    if (_ns()?.isRunning?.()) _ns()?.abortRun?.(); else _ns()?.cohortPending?.("abort");
    return;
  }
  _runCue(msg).catch(e => console.warn(TAG, "cue run failed", e));
}

async function _heartbeat() {
  if (game.user?.isGM) return;
  const c = memberOf(game.user.id);
  if (!c || !_gmOnline()) return;
  try {
    await _ns()?.runAsGM?.("cohortPing", { cohortId: c.id, arrivedBarrierId: _arrivedBarrier,
      running: _cueActive || !!_ns()?.isRunning?.() }, { timeoutMs: 10000 });
  } catch (_) {}
}

/** Player: join the class (the "⚑ Join the class" button). */
async function join() {
  if (game.user?.isGM) { ui.notifications?.info?.("GMs conduct the class — open the Cohort Console."); return { ok: false }; }
  const r = await _ns()?.runAsGM?.("cohortJoin", { userId: game.user.id });
  if (r?.ok) {
    if (!r.already) await _speakSelf(LINES.joined);
    _heartbeat();
  } else ui.notifications?.warn?.(`Couldn't join the class${r?.reason ? ` — ${r.reason}` : " (is a GM online?)"}.`);
  return r;
}

/* ─── Socket wiring ──────────────────────────────────────────────────────── */
function _senderIsGM(msg, senderId) {
  const u = game.users?.get?.(String(senderId || msg?.fromUserId || ""));
  return !!u?.isGM;
}
function _onSocket(msg, senderId) {
  const t = msg?.t;
  if (typeof t !== "string" || !t.startsWith("cohort-")) return;
  if (!_senderIsGM(msg, senderId)) return;           // only GMs conduct
  const forMe = msg.to == null || (Array.isArray(msg.to) && msg.to.includes(game.user?.id));
  try {
    if (t === "cohort-cue") return _onCue(msg);
    // Skip/abort only ever touch a CLASS run on this client — never a solo run
    // a non-member happens to have open when a class-wide abort goes out.
    // During the Steward forge the director isn't running yet: park the request
    // for start() to honour (review fix 7).
    if (t === "cohort-skip") {
      if (!forMe || game.user.isGM || !_cueActive) return;
      if (_ns()?.isRunning?.()) _ns()?.skipBeat?.(); else _ns()?.cohortPending?.("skip");
      return;
    }
    if (t === "cohort-abort") {
      if (!forMe || game.user.isGM) return;
      if (!getCohort(msg.cohortId)?.members?.[game.user.id]) return;
      _pendingCue = null;
      if (_cueActive) { if (_ns()?.isRunning?.()) _ns()?.abortRun?.(); else _ns()?.cohortPending?.("abort"); }
      _speakSelf(LINES.dismissed);
      return;
    }
    if (t === "cohort-dive") {
      if (!forMe || game.user.isGM) return;
      const tx = globalThis.game?.bbttcc?.api?.transition;
      fromUuid(msg.sceneUuid).then(sc => {
        if (!sc) return;
        if (tx?.dive) return tx.dive(sc.uuid, { audience: "view", label: "Bad Eden" });
        return sc.view?.();
      }).catch(e => console.warn(TAG, "member graduation dive failed", e));
      return;
    }
    if (t === "cohort-control") {
      if (!_ns()?.relay?.isPrimaryGM?.()) return;
      const fn = OPS[msg.op];
      if (fn && /^cohort[A-Z]/.test(msg.op) && !["cohortJoin", "cohortArrive", "cohortPing"].includes(msg.op)) {
        fn(msg.payload || {}).catch?.(e => console.warn(TAG, `control "${msg.op}" failed`, e));
      }
    }
  } catch (e) { console.warn(TAG, "socket handler failed", e); }
}

/** GM control entry: the primary GM runs it; a secondary GM forwards it there. */
async function _control(op, payload = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn?.("Class controls are GM-only."); return { ok: false }; }
  if (_ns()?.relay?.isPrimaryGM?.()) return OPS[op]?.(payload);
  _emit({ t: "cohort-control", op, payload });
  return { ok: true, forwarded: true };
}

/* ─── Beat-side helpers (members' clients; beats.js calls these) ─────────── */
async function classRelic(cohortId, key) {
  return (await _ns()?.runAsGM?.("classRelic", { cohortId, key })) ?? null;
}
async function sharedProp(cohortId, key, mode = "claim", data = null) {
  return (await _ns()?.runAsGM?.("sharedProp", { cohortId, key, mode, data })) ?? null;
}
/** Wait (reading the synced registry, no relay traffic) for a shared prop's data. */
async function waitProp(cohortId, key, { timeoutMs = 180000, everyMs = 1000 } = {}) {
  const until = _now() + timeoutMs;
  while (_now() < until) {
    const p = getCohort(cohortId)?.props?.[key];
    if (p?.data != null) return p.data;
    if (!p) return null;                         // released (staging failed) — caller stages its own
    await new Promise(r => setTimeout(r, everyMs));
  }
  return null;
}

/* ─── GM Cohort Console (ApplicationV2) ──────────────────────────────────── */
const STATUS_UI = {
  working: { glyph: "●", label: "working",    cls: "working" },
  barrier: { glyph: "◆", label: "at the gate", cls: "barrier" },
  away:    { glyph: "○", label: "away",       cls: "away" },
  left:    { glyph: "✕", label: "left",       cls: "left" }
};

const AppV2 = foundry?.applications?.api?.ApplicationV2;
const HBS = foundry?.applications?.api?.HandlebarsApplicationMixin;
let CohortConsole = null;
if (AppV2 && HBS) {
  CohortConsole = class CohortConsole extends HBS(AppV2) {
    static PARTS = { content: { template: `modules/${MODULE_ID}/templates/cohort-console.hbs`, scrollable: [".cc-roster"] } };
    static DEFAULT_OPTIONS = {
      id: "bbttcc-cohort-console",
      classes: ["bbttcc-cohort-console-app", "bbttcc", "bbttcc-be", "bbttcc-theme-gm"],
      tag: "section",
      window: { title: "Onboarding — Cohort Console", icon: "fas fa-people-group", resizable: true },
      position: { width: 640, height: 560 }
    };
    static _instance = null;
    static open() {
      if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
      if (!this._instance) this._instance = new this();
      this._instance.render(true, { focus: true });
      return this._instance;
    }
    // ONE window (review fix 9): any `new CohortConsole()` — the settings menu
    // constructs its own — hands back the live instance, so there is never a
    // second app with the same id that the setting hooks don't refresh.
    constructor(options) {
      if (CohortConsole._instance) return CohortConsole._instance;
      super(options || {});
      CohortConsole._instance = this;
    }

    async _prepareContext() {
      const ns = _ns();
      const all = Object.values(_all()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const c = all.find(_isLive) || all[0] || null;
      const players = (game.users?.contents ?? []).filter(u => u.active && !u.isGM).length;
      if (!c) return { cohort: null, players };
      const seg = _segOf(c);
      const arrived = new Set(c.barrier?.arrived || []);
      const rows = Object.entries(c.members || {})
        .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0))
        .map(([uid, m]) => {
          const user = game.users?.get?.(uid);
          const st = game.actors?.get?.(m.stewardId || "") || ns?.resolve?.steward?.(user) || null;
          const fa = (m.factionId && game.actors?.get?.(m.factionId)) || ns?.resolve?.faction?.(user, st) || null;
          const cur = st?.getFlag?.(MODULE_ID, "progress")?.currentStep || "";
          const beatTitle = cur ? (ns?.beats?.get?.(cur)?.title || cur) : "";
          const s = STATUS_UI[m.status] || STATUS_UI.working;
          let beat = beatTitle;
          if (m.status === "barrier") beat = c.state === "forming" ? "on the roster" : `at the gate${beatTitle ? ` · ${beatTitle}` : ""}`;
          else if (!st) beat = m.status === "working" ? "forging a Steward…" : "no Steward";
          return {
            uid, player: user?.name || m.name || uid, steward: st?.name || "—", faction: fa?.name || "—",
            beat: beat || "—", glyph: s.glyph, statusLabel: s.label, statusCls: s.cls,
            online: !!user?.active, arrived: arrived.has(uid),
            canAct: (c.state === "running" || c.state === "paused") && m.status !== "left"
          };
        });
      const present = _presentIds(c);
      const feed = (c.feed || []).slice(-10);
      const last = feed[feed.length - 1];
      return {
        cohort: { id: c.id, name: c.name, state: c.state },
        stateLabel: { forming: "forming", running: "running", paused: "paused", done: c.aborted ? "aborted" : (c.graduated ? "graduated" : "done") }[c.state] || c.state,
        segLabel: seg ? `${c.segmentIdx + 1}/${c.segments.length} · ${seg.label} (${seg.kind})` : (c.state === "forming" ? "waiting for Start" : "—"),
        presentCount: present.length,
        arrivedCount: present.filter(u => arrived.has(u)).length,
        awayCount: Object.values(c.members || {}).filter(m => m.status === "away").length,
        rosterCount: Object.values(c.members || {}).filter(m => m.status !== "left").length,
        rows, players, playersLabel: `${players} player${players === 1 ? "" : "s"}`,
        feedLine: last ? `${new Date(last.ts).toLocaleTimeString()} — ${last.text}` : "",
        feedTitle: feed.map(f => `${new Date(f.ts).toLocaleTimeString()} — ${f.text}`).join("\n"),
        canForm: c.state === "forming" || c.state === "done",
        canStart: c.state === "forming" && rows.some(r => r.statusCls !== "left"),
        canPause: c.state === "running", canResume: c.state === "paused",
        canRelease: (c.state === "running" || c.state === "paused") && c.segmentIdx >= 0,
        canAbort: c.state !== "done"
      };
    }

    async _onRender(context, options) {
      await super._onRender?.(context, options);
      const root = this.element;
      if (!root || this._boundRoot === root) return;   // one delegated listener per window element
      this._boundRoot = root;
      root.addEventListener("click", async (ev) => {
        const btn = ev.target?.closest?.("[data-cc]");
        if (!btn) return;
        ev.preventDefault();
        const act = btn.dataset.cc, uid = btn.dataset.uid || "";
        const c = (Object.values(_all()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).find(_isLive)) || null;
        const cohortId = c?.id || "";
        const confirm = async (title, html) => foundry.applications.api.DialogV2.confirm({ window: { title }, content: html });
        try {
          if (act === "form") await _control("cohortForm", {});
          else if (act === "start") await _control("cohortStart", { cohortId });
          else if (act === "pause") await _control("cohortPause", { cohortId });
          else if (act === "resume") await _control("cohortResume", { cohortId });
          else if (act === "release") { if (await confirm("Release the barrier?", "<p>Move the class to the next segment now? Anyone still mid-segment is cut short (what they miss stays open for solo catch-up).</p>")) await _control("cohortRelease", { cohortId }); }
          else if (act === "abort") { if (await confirm("Abort the class?", "<p>Stop every member's run, tear down the class's props and release all lanes? Progress already earned stays on each Steward.</p>")) await _control("cohortAbort", { cohortId }); }
          else if (act === "skip") await _control("cohortSkipMember", { cohortId, userId: uid });
          else if (act === "kick") { if (await confirm("Remove from the class?", `<p>Remove <b>${_esc(game.users?.get?.(uid)?.name || uid)}</b>? Their run stops after the current beat.</p>`)) await _control("cohortKick", { cohortId, userId: uid }); }
          else if (act === "refresh") this.render(false);
        } catch (e) { console.warn(TAG, `console action "${act}" failed`, e); ui.notifications?.error?.(`Cohort Console: ${act} failed — see console (F12).`); }
      });
    }
  };
}

function openConsole() {
  if (!CohortConsole) { ui.notifications?.warn?.("Cohort Console needs ApplicationV2."); return null; }
  return CohortConsole.open();
}
let _renderTimer = null;
function _scheduleRender() {
  if (!CohortConsole?._instance?.rendered) return;
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(() => { try { CohortConsole._instance.render(false); } catch (_) {} }, 300);
}

/* ─── Boot ───────────────────────────────────────────────────────────────── */
Hooks.once("init", () => {
  if (!CohortConsole) return;
  try {
    game.settings.registerMenu(MODULE_ID, "cohortConsole", {
      name: "Onboarding — Cohort Console (group induction)",
      label: "Open Cohort Console",
      hint: "Run the tutorial for a whole table at once: roster, barriers, pause/release, skip/kick, abort.",
      icon: "fas fa-people-group",
      type: CohortConsole,
      restricted: true
    });
  } catch (e) { console.warn(TAG, "registerMenu failed", e); }
});

Hooks.once("ready", () => {
  const ns = _ns();
  if (!ns) return console.warn(TAG, "onboarding namespace missing — group induction not installed.");
  const reg = ns.relay?.registerOp;
  if (reg) for (const [name, fn] of Object.entries(OPS)) reg(name, fn);
  else console.warn(TAG, "relay.registerOp unavailable — cohort ops not registered.");

  ns.cohort = {
    join, live: liveCohort, get: getCohort, list: _all, memberOf, segments: buildSegments,
    console: openConsole, classRelic, sharedProp, waitProp,
    form: (o = {}) => _control("cohortForm", o),
    start: (cohortId = liveCohort()?.id) => _control("cohortStart", { cohortId }),
    pause: (cohortId = liveCohort()?.id) => _control("cohortPause", { cohortId }),
    resume: (cohortId = liveCohort()?.id) => _control("cohortResume", { cohortId }),
    release: (cohortId = liveCohort()?.id) => _control("cohortRelease", { cohortId }),
    skipMember: (userId, cohortId = liveCohort()?.id) => _control("cohortSkipMember", { cohortId, userId }),
    kick: (userId, cohortId = liveCohort()?.id) => _control("cohortKick", { cohortId, userId }),
    abort: (cohortId = liveCohort()?.id) => _control("cohortAbort", { cohortId })
  };
  globalThis.BBTTCCCohortConsole = CohortConsole;

  if (!globalThis.__bbttccCohortSocketBound) {
    globalThis.__bbttccCohortSocketBound = true;
    game.socket?.on?.(CHANNEL, _onSocket);
  }

  if (game.user?.isGM) {
    // Conductor housekeeping runs on every GM client but acts only while primary
    // (a primary GM leaving hands the class to the next GM on its next tick).
    setInterval(() => { _tick().catch(e => console.warn(TAG, "tick failed", e)); }, TICK_MS);
    Hooks.on("userConnected", (user, connected) => {
      if (connected || user?.isGM || !ns.relay?.isPrimaryGM?.()) return;
      const c = memberOf(user.id);
      if (!c) return;
      let acts = [];
      _mutate(c.id, (cc) => {
        const m = cc.members[user.id];
        if (m && PRESENT(m)) { m.status = "away"; _feed(cc, `○ ${_memberLabel(m, user.id)} disconnected — away`); }
        acts = _settle(cc);
      }).then(() => _perform(c.id, acts)).catch(() => {});
    });
    // Auto-open for the GM when a class forms (once per class), keep it fresh.
    const seen = new Set(Object.values(_all()).filter(c => !_isLive(c)).map(c => c.id));
    const maybeOpen = () => {
      const c = liveCohort();
      if (c && !seen.has(c.id)) { seen.add(c.id); openConsole(); }
    };
    Hooks.on("updateSetting", (setting) => {
      if (String(setting?.key || "") !== `${MODULE_ID}.${SETTING}`) return;
      maybeOpen(); _scheduleRender();
    });
    Hooks.on("updateActor", (actor, changed) => {
      if (changed?.flags?.[MODULE_ID]?.progress !== undefined) _scheduleRender();
    });
    // Expire a stray class BEFORE deciding whether to auto-open for it.
    (ns.relay?.isPrimaryGM?.() ? _expireStale() : Promise.resolve()).catch(() => {}).then(maybeOpen);
    // A refreshed conductor resumes from the setting; members' pings carry any
    // arrivals that landed while it was gone and re-cue anyone left idle.
    if (ns.relay?.isPrimaryGM?.() && liveCohort()) console.log(TAG, `conductor resuming ${liveCohort().name}.`);
  } else {
    setInterval(() => { _heartbeat(); }, PING_MS);
    // Reconnect: say hello at once so the conductor re-cues us into the current segment.
    if (memberOf(game.user.id)) setTimeout(() => _heartbeat(), 1500);
    Hooks.on("userConnected", (user, connected) => {
      if (!user?.isGM || connected || _gmOnline() || !memberOf(game.user.id)) return;
      ui.notifications?.warn?.(`◇ OPERATOR: ${LINES.noGm}`);
    });
  }
  console.log(TAG, "group induction ready (Phase 1 lockstep).");
});

// Test seam for the offline harness (scratchpad) — not an API.
globalThis.__bbttccCohortTest = { OPS, buildSegments, _tick, _all, getCohort, liveCohort, memberOf, _lastSeen, _lastCue, LINES };
