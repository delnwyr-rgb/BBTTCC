// bbttcc-core/scripts/gm-exec.js
// THE SEAT PRIMITIVE (Phase 1 of the engine roadmap, 2026-08-29).
//
// A Foundry world is a distributed system: GM seats can write the world,
// player seats mostly can't. Every player-driven feature used to hand-build
// its own "do this on the GM's seat" relay (encounter arbitration, arrivals,
// raid session writes, mirrors). This is that relay built ONCE:
//
//   game.bbttcc.api.gmExec.register(type, handler)
//     GM-side handler registry. handler(payload, meta) -> serializable result.
//     meta = { fromUserId, fromUserName, local }
//
//   await game.bbttcc.api.gmExec.call(type, payload, { timeoutMs = 15000 })
//     From ANY seat. On a GM seat it runs the handler locally; on a player
//     seat it relays to the PRIMARY GM (lowest active GM id), awaits the ack,
//     and returns the handler's result — or throws on error/timeout.
//
// Rules for handlers:
//  - VALIDATE the payload. Handlers run with GM authority on behalf of player
//    seats; never trust ids blindly, and stamp meta.fromUserName into any
//    world-visible effect (war logs, chat) so provenance survives.
//  - RETURN FAST. A handler that kicks a long process (a beat chain, a scene
//    sequence) should start it fire-and-forget and return a receipt — the
//    caller's ack should never wait minutes.
//
// The API surface (register/call) is published at PARSE time so any module's
// ready hook can register regardless of load order; the socket listener arms
// at ready.

(() => {
  const TAG = "[bbttcc-core/gm-exec]";
  const CHANNEL = "module.bbttcc-core";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  const HANDLERS = new Map();   // type -> handler(payload, meta)
  const PENDING  = new Map();   // callId -> { resolve, reject, timer }
  let _seq = 0;

  function primaryGmId() {
    try {
      const gms = (game.users?.contents || [])
        .filter(u => u.active && u.isGM)
        .sort((a, b) => a.id.localeCompare(b.id));
      return gms[0]?.id || null;
    } catch (_e) { return null; }
  }

  function register(type, handler) {
    if (typeof type !== "string" || !type || typeof handler !== "function") {
      warn("register: bad args", type);
      return false;
    }
    if (HANDLERS.has(type)) log(`register: replacing handler '${type}'`);
    HANDLERS.set(type, handler);
    return true;
  }

  async function _runLocal(type, payload, meta) {
    const fn = HANDLERS.get(type);
    if (!fn) throw new Error(`gmExec: no handler registered for '${type}'`);
    return await fn(payload, meta);
  }

  async function call(type, payload = {}, { timeoutMs = 15000 } = {}) {
    if (game.user?.isGM) {
      // Any GM seat has authority — run locally, no relay.
      return _runLocal(type, payload, {
        fromUserId: game.user.id, fromUserName: game.user.name, local: true
      });
    }
    const id = `${game.user?.id || "u"}:${Date.now()}:${++_seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        PENDING.delete(id);
        reject(new Error(`gmExec '${type}' timed out (${timeoutMs}ms) — is a GM connected?`));
      }, timeoutMs);
      PENDING.set(id, { resolve, reject, timer });
      try {
        game.socket.emit(CHANNEL, { op: "exec", id, type, payload, fromUserId: game.user?.id || null });
      } catch (e) {
        PENDING.delete(id); clearTimeout(timer); reject(e);
      }
    });
  }

  function publish() {
    try {
      game.bbttcc = game.bbttcc || { api: {} };
      game.bbttcc.api = game.bbttcc.api || {};
      game.bbttcc.api.gmExec = { register, call, primaryGmId, types: () => [...HANDLERS.keys()] };
    } catch (e) { warn("publish failed:", e); }
  }

  Hooks.once("init", publish);
  Hooks.once("ready", () => {
    publish();   // re-assert in case a later module replaced game.bbttcc.api
    try {
      game.socket?.on?.(CHANNEL, async (msg) => {
        try {
          if (!msg || typeof msg !== "object") return;

          if (msg.op === "exec") {
            if (!game.user?.isGM) return;
            if (primaryGmId() !== game.user.id) return;   // exactly one GM answers
            let ack;
            try {
              const fromUser = game.users?.get?.(msg.fromUserId) || null;
              const result = await _runLocal(msg.type, msg.payload || {}, {
                fromUserId: msg.fromUserId || null,
                fromUserName: fromUser?.name || "unknown",
                local: false
              });
              ack = { op: "ack", id: msg.id, ok: true, result };
            } catch (e) {
              warn(`handler '${msg.type}' failed:`, e);
              ack = { op: "ack", id: msg.id, ok: false, error: String(e?.message || e) };
            }
            try { game.socket.emit(CHANNEL, ack); } catch (_eA) {}
            return;
          }

          if (msg.op === "ack") {
            const p = PENDING.get(msg.id);
            if (!p) return;                 // someone else's call, or resolved
            PENDING.delete(msg.id);
            clearTimeout(p.timer);
            if (msg.ok) p.resolve(msg.result);
            else p.reject(new Error(msg.error || "gmExec handler failed"));
          }
        } catch (e) { warn("socket receiver failed:", e); }
      });
      log(`seat primitive armed (channel ${CHANNEL}); handlers: ${HANDLERS.size}`);
    } catch (e) { warn("arm failed:", e); }
  });

  // Publish at parse time — load-order safe for every module's ready hook —
  // and re-asserted at init + ready above in case a later module replaces the
  // api object.
  try { globalThis.game = globalThis.game || {}; } catch (_eG) {}
  publish();
})();
