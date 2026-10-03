/* bbttcc-onboarding/scripts/relay.js
 * GM-relay seam — lets non-GM players run privileged ops (Actor/Token/Folder create,
 * rig mint, cleanup) by relaying to the GM client, following the codebase's native
 * game.socket pattern (cf. bbttcc-travel encounter arbitration, fourththing crew relay).
 *
 * runAsGM(op, payload):
 *   - GM caller  -> runs the registered op LOCALLY (byte-identical to direct creation).
 *   - player     -> emits an op-request to the GM, awaits the op-response (or times out).
 * Ops are registered by stage.js. Ops MUST return JSON-serialisable data (ids, not Docs);
 * callers resolve ids back to Documents via resolveActor/resolveToken (which await sync).
 */

const MODULE_ID = "bbttcc-onboarding";
const CHANNEL = `module.${MODULE_ID}`;
const TAG = "[onboarding/relay]";

const OPS = Object.create(null); // name -> async (payload) => JSON-serialisable result
function registerOp(name, fn) { OPS[name] = fn; }

/** Lowest-id active GM is the single executor (multi-GM de-dupe). */
function _isPrimaryGM() {
  if (!game.user?.isGM) return false;
  const gms = (Array.from(game.users ?? []))
    .filter(u => u.active && u.isGM)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return gms[0]?.id === game.user.id;
}

/** Run a registered op as GM. GM executes locally; player relays + awaits. */
async function runAsGM(op, payload = {}, { timeoutMs = 15000 } = {}) {
  if (game.user?.isGM) {
    const fn = OPS[op];
    if (!fn) { console.warn(TAG, `unknown op "${op}"`); return null; }
    try { return await fn(payload); }
    catch (e) { console.warn(TAG, `op "${op}" failed locally`, e); return null; }
  }
  if (!game.users?.some?.(u => u.isGM && u.active)) {
    ui.notifications?.warn?.("Onboarding: no GM online to stage tutorial targets.");
    return null;
  }
  const requestId = foundry.utils.randomID();
  return await new Promise((resolve) => {
    let done = false;
    const onResp = (msg) => {
      if (msg?.t !== "op-response" || msg.requestId !== requestId) return;
      done = true; game.socket.off(CHANNEL, onResp);
      if (!msg.ok) console.warn(TAG, `op "${op}" failed on GM:`, msg.error);
      resolve(msg.ok ? msg.result : null);
    };
    game.socket.on(CHANNEL, onResp);
    game.socket.emit(CHANNEL, { t: "op-request", requestId, op, payload, fromUserId: game.user.id });
    setTimeout(() => {
      if (done) return; done = true; game.socket.off(CHANNEL, onResp);
      console.warn(TAG, `op "${op}" timed out after ${timeoutMs}ms`);
      resolve(null);
    }, timeoutMs);
  });
}

/* ─── GM-side authorization (review 2026-10-01, GAME_REVIEW_2026_09_30 relay.js:61) ───
 * The relay used to run any op for any user with caller-supplied ids, so a player seat could grant itself
 * OWNER on any actor, delete any token, write any faction's raid session or OP, or hurt any actor. Every
 * player request is now checked against what it TOUCHES, not who it claims to be (the sender id rides in
 * the message body, so it is never the only check): actors/factions must be tutorial-spawned or the
 * sender's own (owned, assigned character, or a faction whose roster holds a character they own); hexes
 * must be a sandbox hex; tokens to delete must be tutorial-spawned. Everything except the run-registry ops
 * also needs a live tutorial run for the sender. Identity fields in the payload are forced to the sender. */
const RUN_OPS = new Set(["runBegin", "runPing", "runEnd", "runList"]);
const ACTOR_OPS = { hurt: ["actorId"], mend: ["actorId"], raiseDarkness: ["actorId"], billKill: ["foeActorId", "fallbackActorId"], foeSurrender: ["actorId"], setElevation: ["actorId"], shoveOffPerch: ["actorId"], ensureToken: ["actorId"], disembark: ["stewardId", "rigId"], foundPlayerFaction: ["stewardId"] };
const FACTION_OPS = { grantOp: "factionId", grantSecret: "factionId", setRaidSession: "factionId", clearRaidSession: "factionId", teardownFinale: "factionId", mintRig: "factionId", openRaidConsoleForGM: "factionId", claimHex: "factionId" };
const HEX_OPS = new Set(["claimHex", "unclaimHex"]);
// Group induction Phase 1 (2026-10-02). A member seat may only join, report
// arrival and heartbeat — identity forced to the sender, no live run needed to
// JOIN (that is how a seat gets one). Every class control is GM-only. The two
// beat-support ops (a class relic claim, a shared-prop claim) need a live run
// AND membership of the cohort they name.
const COHORT_MEMBER_OPS = new Set(["cohortJoin", "cohortArrive", "cohortPing", "cohortAnswer"]);   // + answer a party prompt (Phase 2)
const COHORT_GM_OPS = new Set(["cohortForm", "cohortStart", "cohortPause", "cohortResume", "cohortRelease",
                               "cohortSkipMember", "cohortKick", "cohortAbort", "cohortTeardownProps",
                               "cohortDial", "cohortResend"]);
const COHORT_BEAT_OPS = new Set(["classRelic", "sharedProp"]);
/** Is `userId` a current (not left) member of the live cohort `cohortId`? */
function _cohortMember(cohortId, userId) {
  try {
    const c = (game.settings?.get?.(MODULE_ID, "cohorts") ?? {})[String(cohortId || "")];
    const m = c?.members?.[String(userId || "")];
    return !!c && c.state !== "done" && !!m && m.status !== "left";
  } catch (_) { return false; }
}

const _spawned = (doc) => { try { return doc?.getFlag?.(MODULE_ID, "spawned") === true || doc?.getFlag?.(MODULE_ID, "foundedViaOnboarding") === true; } catch (_) { return false; } };
const _owns = (user, doc) => { try { return !!doc?.testUserPermission?.(user, "OWNER"); } catch (_) { return false; } };
function _actorMine(user, actor) {
  if (!actor) return false;
  if (_spawned(actor) || _owns(user, actor) || user?.character?.id === actor.id) return true;
  // a faction is the sender's when its roster holds a character they own
  const roster = actor.getFlag?.("bbttcc-factions", "roster");
  if (Array.isArray(roster)) for (const u of roster) {
    const id = String(u || "").split(".").pop();
    const c = game.actors?.get?.(id);
    if (c && (_owns(user, c) || user?.character?.id === c.id)) return true;
  }
  return false;
}

async function _authorize(op, payload, fromUserId) {
  const user = game.users?.get?.(String(fromUserId || ""));
  if (!user) return "unknown sender";
  if (user.isGM) return null;
  if (COHORT_GM_OPS.has(op)) return "class controls are GM-only";
  // identity fields always mean the sender
  for (const k of ["userId", "ownerUserId", "exceptUserId"]) if (k in payload) payload[k] = user.id;
  // run-scoped owner key (Combats, rings, shared props): a seat names its own,
  // or the class it is a live member of — never anyone else's
  if ("ownerKey" in payload) {
    const k = String(payload.ownerKey || "");
    const ok = k.startsWith("cohort:") && _cohortMember(k.slice(7), user.id);
    payload.ownerKey = ok ? k : `user:${user.id}`;
  }
  if (RUN_OPS.has(op)) return null;
  if (COHORT_MEMBER_OPS.has(op)) { payload.userId = user.id; return null; }
  const runs = game.settings?.get?.(MODULE_ID, "activeRuns") ?? {};
  if (!runs[user.id]) return "no live tutorial run for this seat";
  if (COHORT_BEAT_OPS.has(op)) {
    payload.userId = user.id;
    if (!_cohortMember(payload.cohortId, user.id)) return "not a member of that class";
  }
  for (const key of ACTOR_OPS[op] || []) {
    const id = String(payload[key] || ""); if (!id) continue;
    if (!_actorMine(user, game.actors?.get?.(id))) return `${key} is not a tutorial actor or yours`;
  }
  const fk = FACTION_OPS[op];
  if (fk && payload[fk] && !_actorMine(user, game.actors?.get?.(String(payload[fk])))) return "faction is not yours";
  if (HEX_OPS.has(op)) {
    const hex = payload.hexUuid ? await fromUuid(payload.hexUuid).catch(() => null) : null;
    if (!hex?.getFlag?.(MODULE_ID, "sandboxHex")) return "not a sandbox hex";
  }
  if (op === "ensureOwned") {
    // only grant OWNER on the sender's own tutorial actors: their character, spawned props, the faction they founded
    payload.actorIds = (payload.actorIds || []).filter(id => {
      const a = game.actors?.get?.(String(id || ""));
      return a && (_spawned(a) || user.character?.id === a.id || _actorMine(user, a));
    });
  }
  if (op === "cleanup") {
    payload.tokens = (payload.tokens || []).filter(t => {
      const tok = game.scenes?.get?.(t?.sceneId)?.tokens?.get?.(t?.tokenId);
      return tok && (_spawned(tok) || _spawned(tok.actor));
    });
  }
  return null;
}

// GM-side request handler.
function _onRequest(msg, senderId) {
  if (msg?.t !== "op-request") return;
  if (!_isPrimaryGM()) return;
  (async () => {
    let ok = false, result = null, error = null;
    try {
      const fn = OPS[msg.op];
      if (!fn) throw new Error(`unknown op "${msg.op}"`);
      const payload = { ...(msg.payload || {}) };
      // prefer the transport's sender id when Foundry supplies one; fall back to the message body
      const denied = await _authorize(msg.op, payload, senderId || msg.fromUserId);
      if (denied) throw new Error(`refused: ${denied}`);
      result = await fn(payload);
      ok = true;
    } catch (e) { error = String(e?.message || e); console.warn(TAG, `op "${msg.op}" failed`, e); }
    try { game.socket.emit(CHANNEL, { t: "op-response", requestId: msg.requestId, ok, result, error }); }
    catch (_) {}
  })();
}

/** Await a document appearing (creation may sync slightly after the op-response). */
async function _waitFor(getter, tries = 20, gapMs = 100) {
  for (let i = 0; i < tries; i++) { const v = getter(); if (v) return v; await new Promise(r => setTimeout(r, gapMs)); }
  return getter();
}
async function resolveActor(id) { return id ? await _waitFor(() => game.actors?.get?.(id) || null) : null; }
async function resolveToken(sceneId, tokenId) {
  if (!tokenId) return null;
  const sc = game.scenes?.get?.(sceneId);
  return await _waitFor(() => sc?.tokens?.get?.(tokenId) || null);
}

Hooks.once("ready", () => {
  if (!globalThis.__bbttccOnboardingRelayBound) {
    globalThis.__bbttccOnboardingRelayBound = true;
    game.socket?.on?.(CHANNEL, _onRequest);
  }
  const ns = globalThis.game?.bbttcc?.onboarding;
  if (ns) {
    ns.runAsGM = runAsGM;
    ns.relay = { registerOp, resolveActor, resolveToken, isPrimaryGM: _isPrimaryGM };
  }
  console.log(TAG, "GM relay ready.");
});
