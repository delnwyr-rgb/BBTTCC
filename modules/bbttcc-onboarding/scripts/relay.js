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

// GM-side request handler.
function _onRequest(msg) {
  if (msg?.t !== "op-request") return;
  if (!_isPrimaryGM()) return;
  (async () => {
    let ok = false, result = null, error = null;
    try {
      const fn = OPS[msg.op];
      if (!fn) throw new Error(`unknown op "${msg.op}"`);
      result = await fn(msg.payload || {});
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
    ns.relay = { registerOp, resolveActor, resolveToken };
  }
  console.log(TAG, "GM relay ready.");
});
