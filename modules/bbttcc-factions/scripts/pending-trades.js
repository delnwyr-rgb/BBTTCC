// modules/bbttcc-factions/scripts/pending-trades.js
// BBTTCC — Async Pending-Trade API v0.1
//
// Persistent inbox of trade offers awaiting recipient action. Storage lives on
// the RECIPIENT faction (toFaction). Each entry has a state machine:
//   pending → accepted | declined | countered | expired
//
// Storage:
//   flags.bbttcc-factions.tradeInbox = [
//     { id, fromId, toId, offer, ask, reason, ts, expiresAt, status,
//       counterOf?, settledTs?, settledBy? }
//   ]
//
// API on game.bbttcc.api.factions.pending:
//   list(faction)                                  → entries (live + filtered to toId === faction.id)
//   create({ from, to, offer, ask, reason })       → { ok, id, entry }
//   accept(faction, id)                            → { ok, applied?, error? } (settles via exchange.trade)
//   decline(faction, id, reason?)                  → { ok }
//   counter(faction, id, newOffer, newAsk, reason?) → { ok, newId }
//   expireSweep(faction)                           → number expired
//
// Hooks:
//   bbttcc:trade:pending  { entry }
//   bbttcc:trade:settled  { entry, kind: "accepted"|"declined"|"countered"|"expired" }

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-pending-trades]";
const FLAG_KEY = "tradeInbox";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SOCKET_CHANNEL = `module.${MOD_ID}`;
const SOCKET_TYPE = "pendingTradeAction";

function _resolveActor(aOrId) {
  if (!aOrId) return null;
  if (aOrId instanceof Actor) return aOrId;
  const id = String(aOrId).replace(/^Actor\./, "");
  return game.actors?.get(id) ?? null;
}

function _readInbox(faction) {
  const arr = faction?.getFlag?.(MOD_ID, FLAG_KEY);
  return Array.isArray(arr) ? foundry.utils.deepClone(arr) : [];
}

async function _writeInbox(faction, arr) {
  await faction.setFlag(MOD_ID, FLAG_KEY, arr);
}

function _newId() {
  try { return foundry.utils.randomID?.(16) || globalThis.randomID?.(16); }
  catch { return Math.random().toString(36).slice(2, 18); }
}

function list(faction) {
  const F = _resolveActor(faction);
  if (!F) return [];
  return _readInbox(F).filter(e => e?.status === "pending");
}

async function create({ from, to, offer, ask, reason } = {}) {
  const A = _resolveActor(from);
  const B = _resolveActor(to);
  if (!A || !B) return { ok: false, error: "actor not found" };
  if (A.id === B.id) return { ok: false, error: "self-trade" };

  const now = Date.now();
  const entry = {
    id:        _newId(),
    fromId:    A.id,
    fromName:  A.name,
    toId:      B.id,
    toName:    B.name,
    offer:     foundry.utils.deepClone(offer || {}),
    ask:       foundry.utils.deepClone(ask   || {}),
    reason:    String(reason || ""),
    ts:        now,
    expiresAt: now + DEFAULT_TTL_MS,
    status:    "pending"
  };

  // Recipient's inbox is the source of truth.
  const inbox = _readInbox(B);
  inbox.unshift(entry);
  await _writeInbox(B, inbox);

  try { Hooks.callAll("bbttcc:trade:pending", { entry }); }
  catch (e) { console.warn(TAG, "pending hook failed", e); }

  return { ok: true, id: entry.id, entry };
}

async function _setStatus(faction, id, patch) {
  const F = _resolveActor(faction);
  if (!F) return null;
  const inbox = _readInbox(F);
  const idx = inbox.findIndex(e => e?.id === id);
  if (idx < 0) return null;
  inbox[idx] = { ...inbox[idx], ...patch };
  await _writeInbox(F, inbox);
  return inbox[idx];
}

async function accept(faction, id) {
  const F = _resolveActor(faction);
  if (!F) return { ok: false, error: "faction not found" };
  const entry = _readInbox(F).find(e => e?.id === id);
  if (!entry) return { ok: false, error: "entry not found" };
  if (entry.status !== "pending") return { ok: false, error: `entry already ${entry.status}` };

  const ex = game?.bbttcc?.api?.factions?.exchange;
  if (!ex?.trade) return { ok: false, error: "exchange API not loaded" };

  const from = game.actors.get(entry.fromId);
  const to   = game.actors.get(entry.toId);
  if (!from || !to) return { ok: false, error: "actors missing" };

  const res = await ex.trade({
    from, to,
    offer: entry.offer,
    ask:   entry.ask,
    reason: entry.reason ? `[Async] ${entry.reason}` : "[Async trade] settled from inbox"
  });
  if (!res?.ok) return { ok: false, error: res?.error || "settlement failed" };

  const updated = await _setStatus(F, id, { status: "accepted", settledTs: Date.now(), settledBy: game.user?.id || null });
  try { Hooks.callAll("bbttcc:trade:settled", { entry: updated, kind: "accepted" }); }
  catch (e) { console.warn(TAG, "settled hook failed", e); }

  return { ok: true, applied: res.applied };
}

async function decline(faction, id, reason = "") {
  const updated = await _setStatus(faction, id, {
    status: "declined", settledTs: Date.now(), settledBy: game.user?.id || null,
    declineReason: String(reason || "")
  });
  if (!updated) return { ok: false, error: "entry not found" };
  try { Hooks.callAll("bbttcc:trade:settled", { entry: updated, kind: "declined" }); }
  catch (e) { console.warn(TAG, "settled hook failed", e); }
  return { ok: true };
}

async function counter(faction, id, newOffer, newAsk, reason = "") {
  const F = _resolveActor(faction);
  if (!F) return { ok: false, error: "faction not found" };
  const entry = _readInbox(F).find(e => e?.id === id);
  if (!entry) return { ok: false, error: "entry not found" };
  if (entry.status !== "pending") return { ok: false, error: `entry already ${entry.status}` };

  // Mark original countered.
  const updated = await _setStatus(F, id, {
    status: "countered", settledTs: Date.now(), settledBy: game.user?.id || null
  });
  try { Hooks.callAll("bbttcc:trade:settled", { entry: updated, kind: "countered" }); }
  catch (e) { console.warn(TAG, "settled hook failed", e); }

  // Send a new pending in the OPPOSITE direction (recipient → original sender).
  // The new offer/ask are recipient's terms TO the original sender.
  const orig = game.actors.get(entry.fromId);
  if (!orig) return { ok: false, error: "original sender missing" };
  const created = await create({
    from: F,
    to:   orig,
    offer: newOffer,
    ask:   newAsk,
    reason: reason || `Counter-offer to "${entry.reason || "trade"}"`
  });
  if (!created?.ok) return { ok: false, error: created?.error || "counter create failed" };
  // Cross-link the chain.
  await _setStatus(orig, created.id, { counterOf: entry.id });

  return { ok: true, newId: created.id };
}

async function expireSweep(faction) {
  const F = _resolveActor(faction);
  if (!F) return 0;
  const inbox = _readInbox(F);
  const now = Date.now();
  let n = 0;
  const expired = [];
  const next = inbox.map(e => {
    if (e?.status !== "pending") return e;
    if (Number(e.expiresAt || 0) > now) return e;
    n += 1;
    const updated = { ...e, status: "expired", settledTs: now };
    expired.push(updated);
    return updated;
  });
  if (n > 0) {
    await _writeInbox(F, next);
    for (const entry of expired) {
      try { Hooks.callAll("bbttcc:trade:settled", { entry, kind: "expired" }); }
      catch (e) { console.warn(TAG, "settled hook failed", e); }
    }
  }
  return n;
}

// ── World-wide expiry sweep cron ───────────────────────────────────────────
// Walks every faction actor's inbox and ages out pending entries past their
// expiresAt. Active-GM gated to avoid multi-client write storms (mirrors the
// pattern in relationship-nudge.js). Runs once on ready, then every
// `expireSweepIntervalMinutes` minutes (default 30).

const SETTING_INTERVAL = "expireSweepIntervalMinutes";

function _isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(MOD_ID, "isFaction") === true) return true;
    const t = (foundry.utils.getProperty(a, "system.details.type.value") || "").toString().toLowerCase();
    if (t === "faction") return true;
    const cls = a.getFlag?.("core", "sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls || "").includes("BBTTCCFactionSheet");
  } catch { return false; }
}

function _isActiveGM() {
  if (!game.user?.isGM) return false;
  try {
    const active = game.users?.activeGM;
    if (active) return active.id === game.user.id;
  } catch (_e) {}
  const gms = (game.users?.contents ?? []).filter(u => u.isGM && u.active).sort((a, b) => a.id.localeCompare(b.id));
  return gms[0]?.id === game.user.id;
}

async function expireAllInboxes() {
  if (!_isActiveGM()) return 0;
  let total = 0;
  for (const actor of (game.actors?.contents ?? [])) {
    if (!_isFactionActor(actor)) continue;
    const arr = actor?.getFlag?.(MOD_ID, FLAG_KEY);
    if (!Array.isArray(arr) || !arr.length) continue;
    try { total += await expireSweep(actor); }
    catch (e) { console.warn(TAG, `expireSweep failed for ${actor.name}`, e); }
  }
  if (total > 0) console.log(TAG, `expireAllInboxes — ${total} entries aged out`);
  return total;
}

let _sweepTimer = null;
function _scheduleSweep() {
  if (_sweepTimer) { clearInterval(_sweepTimer); _sweepTimer = null; }
  let mins = 30;
  try { mins = Math.max(1, Number(game.settings.get(MOD_ID, SETTING_INTERVAL)) || 30); } catch (_e) {}
  _sweepTimer = setInterval(() => { expireAllInboxes().catch(e => console.warn(TAG, "scheduled sweep failed", e)); }, mins * 60 * 1000);
}

// ── Player → GM socket relay ───────────────────────────────────────────────
// Players can't write actor flags they don't own. Inbox actions from a non-GM
// faction owner emit a request over the module socket; the active GM picks it
// up, re-verifies that the requesting user actually owns the recipient
// faction, and runs the API locally so writes go through a permitted client.

function _userOwnsFaction(user, faction) {
  if (!user || !faction) return false;
  if (user.isGM) return true;
  try { return !!faction.testUserPermission?.(user, "OWNER"); } catch { return false; }
}

async function _handleSocketMessage(msg) {
  if (!msg || msg.t !== SOCKET_TYPE) return;
  if (!_isActiveGM()) return;
  const { factionId, entryId, action, requesterId, payload } = msg;
  const faction = game.actors?.get(factionId);
  if (!faction) { console.warn(TAG, "socket: faction missing", factionId); return; }
  const requester = game.users?.get(requesterId);
  if (!_userOwnsFaction(requester, faction)) {
    console.warn(TAG, `socket: rejected ${action} from non-owner ${requester?.name || requesterId}`);
    return;
  }
  try {
    let res = null;
    if (action === "accept")       res = await accept(faction, entryId);
    else if (action === "decline") res = await decline(faction, entryId, payload?.reason || "");
    else if (action === "counter") res = await counter(faction, entryId, payload?.offer, payload?.ask, payload?.reason || "");
    else { console.warn(TAG, "socket: unknown action", action); return; }

    if (!res?.ok) {
      ui.notifications?.warn?.(`Player ${requester.name} ${action} on ${faction.name} failed: ${res?.error || "unknown"}`);
    }
  } catch (e) {
    console.warn(TAG, `socket: ${action} threw`, e);
  }
}

function emitPlayerAction({ faction, entryId, action, payload }) {
  const factionId = faction?.id || String(faction || "").replace(/^Actor\./, "");
  if (!factionId || !entryId || !action) return false;
  try {
    game.socket?.emit?.(SOCKET_CHANNEL, {
      t: SOCKET_TYPE,
      factionId,
      entryId,
      action,
      payload: payload ?? null,
      requesterId: game.user?.id || null
    });
    return true;
  } catch (e) {
    console.warn(TAG, "socket emit failed", e);
    return false;
  }
}

function _registerSettings() {
  try {
    game.settings.register(MOD_ID, SETTING_INTERVAL, {
      name: "Pending-trade expiry sweep interval (minutes)",
      hint: "How often to walk every faction's trade inbox and flip expired entries. Active GM only. Default 30.",
      scope: "world",
      config: true,
      type: Number,
      default: 30,
      range: { min: 1, max: 720, step: 1 },
      onChange: () => _scheduleSweep()
    });
  } catch (e) { console.warn(TAG, "settings register failed", e); }
}

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.factions ??= {};
    const root = (game.bbttcc.api.factions.pending ??= {});
    root.list    = list;
    root.create  = create;
    root.accept  = accept;
    root.decline = decline;
    root.counter = counter;
    root.expireSweep = expireSweep;
    root.expireAllInboxes = expireAllInboxes;
    root.emitPlayerAction = emitPlayerAction;
    console.log(TAG, "Pending Trades API ready → game.bbttcc.api.factions.pending");
  } catch (e) {
    console.warn(TAG, "pending API wiring failed", e);
  }
}

Hooks.once("init", _registerSettings);
Hooks.once("ready", () => {
  _attach();
  // Initial sweep on world load + recurring cron. Active-GM gated inside.
  expireAllInboxes().catch(e => console.warn(TAG, "initial sweep failed", e));
  _scheduleSweep();
  // GM-side socket listener for player Accept/Decline/Counter relays.
  try {
    if (!globalThis.__bbttccPendingSocketBound) {
      globalThis.__bbttccPendingSocketBound = true;
      game.socket?.on?.(SOCKET_CHANNEL, _handleSocketMessage);
      console.log(TAG, "socket listener installed on", SOCKET_CHANNEL);
    }
  } catch (e) { console.warn(TAG, "socket bind failed", e); }
});
try { if (game?.ready) _attach(); } catch (_e) {}
