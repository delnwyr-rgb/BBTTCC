// modules/bbttcc-factions/scripts/exchange-engine.js
// BBTTCC — Faction Exchange Engine v0.1
//
// Atomic faction-to-faction transfer of marks (per OP bucket) and Build Units.
// Two surfaces consume this:
//   - Allied Send (one-way grant; no friction)
//   - Trade dialog (bilateral exchange; tier-scaled friction)
//
// Materials are supported via faction-side stockpile (see stockpile-api.js).
// They transfer at face value — discrete units, no friction.
//
// API on game.bbttcc.api.factions.exchange:
//   plan({ from, to, offer, ask, friction }) → { ok, transfers, losses, blockedBy? }
//   share({ from, to, offer, reason })       → { ok, applied?, error? }
//   trade({ from, to, offer, ask, reason })  → { ok, applied?, error? }   (looks up tier+friction itself)
//
// Resource shape (offer / ask):
//   { marks: { economy: 30, logistics: 10 }, buildUnits: 2, materials: { "heart-iron": 3 } }
//
// Hooks:
//   bbttcc:economy:share    { fromId, toId, offer, war: {logA, logB} }
//   bbttcc:economy:exchange { fromId, toId, offer, ask, friction, transfers, losses }

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-exchange]";

const OP_KEYS = [
  "violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"
];

function _resolveActor(aOrId) {
  if (!aOrId) return null;
  if (aOrId instanceof Actor) return aOrId;
  const id = String(aOrId).replace(/^Actor\./, "");
  return game.actors?.get(id) ?? null;
}

function _safeMarks(obj) {
  const out = {};
  if (!obj) return out;
  for (const k of OP_KEYS) {
    const n = Math.max(0, Math.floor(Number(obj[k] || 0) || 0));
    if (n > 0) out[k] = n;
  }
  return out;
}
function _safeBU(v) {
  return Math.max(0, Math.floor(Number(v || 0) || 0));
}
function _safeMaterials(obj) {
  const out = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (!k) continue;
    const n = Math.max(0, Math.floor(Number(v) || 0));
    if (n > 0) out[k] = n;
  }
  return out;
}

function _emptyResource() { return { marks: {}, buildUnits: 0, materials: {} }; }
function _normResource(r) {
  return { marks: _safeMarks(r?.marks), buildUnits: _safeBU(r?.buildUnits), materials: _safeMaterials(r?.materials) };
}
function _isEmpty(r) {
  return Object.keys(r.marks).length === 0 && r.buildUnits === 0 && Object.keys(r.materials || {}).length === 0;
}

function _readBank(actor) {
  return foundry.utils.deepClone(actor.getFlag(MOD_ID, "opBank") ?? {});
}
function _readBU(actor) {
  return _safeBU(actor.getFlag(MOD_ID, "buildUnits"));
}

function _checkAffordability(actor, resource) {
  const bank = _readBank(actor);
  const bu = _readBU(actor);
  const shortfalls = [];
  for (const [k, qty] of Object.entries(resource.marks || {})) {
    const have = Number(bank[k] || 0);
    if (have < qty) shortfalls.push({ kind: "marks", bucket: k, need: qty, have });
  }
  if (resource.buildUnits > 0 && bu < resource.buildUnits) {
    shortfalls.push({ kind: "bu", need: resource.buildUnits, have: bu });
  }
  // Materials live on the faction stockpile flag.
  const stock = game?.bbttcc?.api?.factions?.stockpile;
  for (const [matKey, want] of Object.entries(resource.materials || {})) {
    const have = stock?.qty ? stock.qty(actor, matKey) : 0;
    if (have < want) shortfalls.push({ kind: "material", materialKey: matKey, need: want, have });
  }
  return { ok: shortfalls.length === 0, shortfalls };
}

// Pure plan: given offer/ask/friction, build the transfer list + losses, no side effects.
function plan({ from, to, offer, ask, friction = 0 }) {
  const A = _resolveActor(from);
  const B = _resolveActor(to);
  if (!A || !B) return { ok: false, blockedBy: "actor-not-found" };
  if (A.id === B.id) return { ok: false, blockedBy: "self-trade" };

  const o = _normResource(offer);
  const a = _normResource(ask);
  if (_isEmpty(o) && _isEmpty(a)) return { ok: false, blockedBy: "empty-trade" };

  const f = Math.max(0, Math.min(1, Number(friction) || 0));

  // Affordability check on both sides BEFORE any side effect.
  const affordA = _checkAffordability(A, o);
  if (!affordA.ok) return { ok: false, blockedBy: "insufficient-from", shortfalls: affordA.shortfalls };
  const affordB = _checkAffordability(B, a);
  if (!affordB.ok) return { ok: false, blockedBy: "insufficient-to", shortfalls: affordB.shortfalls };

  const transfers = [];
  const losses = { marks: {}, buildUnits: 0 };

  function _applyMarks(senderId, receiverId, marks) {
    for (const [k, sent] of Object.entries(marks)) {
      const received = Math.floor(sent * (1 - f));
      const lost = sent - received;
      transfers.push({ from: senderId, to: receiverId, kind: "marks", bucket: k, sent, received, lost });
      if (lost > 0) losses.marks[k] = (losses.marks[k] || 0) + lost;
    }
  }
  function _applyBU(senderId, receiverId, bu) {
    if (!bu) return;
    const received = Math.floor(bu * (1 - f));
    const lost = bu - received;
    transfers.push({ from: senderId, to: receiverId, kind: "bu", sent: bu, received, lost });
    if (lost > 0) losses.buildUnits += lost;
  }
  // Materials transfer at face value — discrete units, no friction.
  function _applyMaterials(senderId, receiverId, mats) {
    for (const [matKey, sent] of Object.entries(mats || {})) {
      transfers.push({ from: senderId, to: receiverId, kind: "material", materialKey: matKey, sent, received: sent, lost: 0 });
    }
  }

  _applyMarks(A.id, B.id, o.marks);
  _applyBU(A.id, B.id, o.buildUnits);
  _applyMaterials(A.id, B.id, o.materials);
  _applyMarks(B.id, A.id, a.marks);
  _applyBU(B.id, A.id, a.buildUnits);
  _applyMaterials(B.id, A.id, a.materials);

  return { ok: true, transfers, losses, friction: f };
}

// Aggregate transfers into per-actor delta sums for atomic op.commit / BU writes.
function _aggregateDeltas(transfers) {
  const byActor = new Map(); // actorId → { marks: {bucket: delta}, bu: delta, materials: {key: delta} }
  for (const t of transfers) {
    const sender   = byActor.get(t.from) || { marks: {}, bu: 0, materials: {} };
    const receiver = byActor.get(t.to)   || { marks: {}, bu: 0, materials: {} };
    if (t.kind === "marks") {
      sender.marks[t.bucket]   = (sender.marks[t.bucket]   || 0) - t.sent;
      receiver.marks[t.bucket] = (receiver.marks[t.bucket] || 0) + t.received;
    } else if (t.kind === "bu") {
      sender.bu   -= t.sent;
      receiver.bu += t.received;
    } else if (t.kind === "material") {
      sender.materials[t.materialKey]   = (sender.materials[t.materialKey]   || 0) - t.sent;
      receiver.materials[t.materialKey] = (receiver.materials[t.materialKey] || 0) + t.received;
    }
    byActor.set(t.from, sender);
    byActor.set(t.to,   receiver);
  }
  return byActor;
}

async function _applyDeltas(actor, delta, contextLabel) {
  const opApi = game?.bbttcc?.api?.op;

  // Marks via op-engine (one commit per actor, all buckets at once).
  // allowOvercap=true so gifts/trades into a near-cap bank don't get refused —
  // exchange income should always land (sender pre-flight already caught underflow).
  if (Object.keys(delta.marks || {}).length) {
    if (!opApi?.commit) throw new Error("op.commit not available");
    const res = await opApi.commit(actor.id, delta.marks, { source: "exchange", label: contextLabel, allowOvercap: true });
    if (!res?.committed) {
      throw new Error(`OP commit refused for ${actor.name}: ${res?.error || "unknown"}`);
    }
  }

  // BU is a single integer flag.
  if (delta.bu !== 0) {
    const cur = _readBU(actor);
    const next = Math.max(0, cur + delta.bu);
    await actor.setFlag(MOD_ID, "buildUnits", next);
  }

  // Materials: route through stockpile API so the changed hook fires per key.
  if (delta.materials && Object.keys(delta.materials).length) {
    const stock = game?.bbttcc?.api?.factions?.stockpile;
    if (!stock?.adjust) throw new Error("stockpile API not available");
    for (const [matKey, dq] of Object.entries(delta.materials)) {
      if (!dq) continue;
      const res = await stock.adjust(actor, matKey, dq, { reason: contextLabel });
      if (!res?.ok) throw new Error(`stockpile adjust refused for ${actor.name} / ${matKey}: ${res?.error || "unknown"}`);
    }
  }
}

async function _writeWarLogs(A, B, summary) {
  for (const actor of [A, B]) {
    try {
      const cur = actor.getFlag(MOD_ID, "warLogs");
      const wl = Array.isArray(cur) ? cur.slice() : [];
      wl.unshift({
        ts: Date.now(),
        date: (new Date()).toLocaleString(),
        type: "exchange",
        summary
      });
      await actor.setFlag(MOD_ID, "warLogs", wl);
    } catch (e) {
      console.warn(TAG, "war log append failed for", actor?.name, e);
    }
  }
}

function _summarize(resource) {
  const parts = [];
  for (const [k, v] of Object.entries(resource.marks || {})) {
    if (v > 0) parts.push(`${(v/10).toFixed(1).replace(/\.0$/,"")} ${k.charAt(0).toUpperCase()+k.slice(1)} OP`);
  }
  if (resource.buildUnits > 0) parts.push(`${resource.buildUnits} BU`);
  for (const [matKey, qty] of Object.entries(resource.materials || {})) {
    if (qty > 0) parts.push(`${qty}× ${matKey}`);
  }
  return parts.length ? parts.join(", ") : "—";
}

// Allied Send: unilateral one-way grant. Friction = 0.
async function share({ from, to, offer, reason } = {}) {
  const A = _resolveActor(from);
  const B = _resolveActor(to);
  if (!A || !B) return { ok: false, error: "actor not found" };

  const relApi = game?.bbttcc?.api?.factions?.relations;
  if (!relApi?.canTrade) return { ok: false, error: "relations API not loaded" };
  // Allied check: both sides must rate each other as allied for unilateral send to be permitted.
  const aRates = relApi.get(A, B);
  const bRates = relApi.get(B, A);
  if (aRates !== "allied" || bRates !== "allied") {
    return { ok: false, error: `Send requires mutual Allied tier (currently ${aRates} / ${bRates}).` };
  }

  const o = _normResource(offer);
  if (_isEmpty(o)) return { ok: false, error: "Empty offer." };

  const aff = _checkAffordability(A, o);
  if (!aff.ok) return { ok: false, error: "Insufficient resources on sender.", shortfalls: aff.shortfalls };

  // Build transfers: one-way A → B at face value (no friction).
  const transfers = [];
  for (const [k, qty] of Object.entries(o.marks)) {
    transfers.push({ from: A.id, to: B.id, kind: "marks", bucket: k, sent: qty, received: qty, lost: 0 });
  }
  if (o.buildUnits) {
    transfers.push({ from: A.id, to: B.id, kind: "bu", sent: o.buildUnits, received: o.buildUnits, lost: 0 });
  }
  for (const [matKey, qty] of Object.entries(o.materials || {})) {
    transfers.push({ from: A.id, to: B.id, kind: "material", materialKey: matKey, sent: qty, received: qty, lost: 0 });
  }

  // Apply atomically (best-effort sequential; OP engine handles its own caps/underflow).
  const deltas = _aggregateDeltas(transfers);
  try {
    for (const [actorId, delta] of deltas) {
      const actor = game.actors.get(actorId);
      await _applyDeltas(actor, delta, `Allied Send: ${A.name} → ${B.name}`);
    }
  } catch (e) {
    console.warn(TAG, "share apply failed", e);
    return { ok: false, error: e?.message || "Apply failed" };
  }

  const summary = `Allied Send: ${A.name} → ${B.name} (${_summarize(o)})${reason ? ` — ${reason}` : ""}`;
  await _writeWarLogs(A, B, summary);

  try {
    Hooks.callAll("bbttcc:economy:share", {
      fromId: A.id, toId: B.id, offer: o, transfers, reason: reason || ""
    });
  } catch (e) { console.warn(TAG, "share hook failed", e); }

  return { ok: true, applied: { transfers, summary } };
}

// Bilateral Trade: looks up mutual tier + friction, plans + applies.
async function trade({ from, to, offer, ask, reason } = {}) {
  const A = _resolveActor(from);
  const B = _resolveActor(to);
  if (!A || !B) return { ok: false, error: "actor not found" };

  const relApi = game?.bbttcc?.api?.factions?.relations;
  if (!relApi?.canTrade) return { ok: false, error: "relations API not loaded" };
  const ct = relApi.canTrade(A, B);
  if (!ct.ok) {
    return { ok: false, error: `Trade blocked (mutual tier: ${ct.mutualTier || "unknown"}).`, blockedBy: ct.blockedBy };
  }
  const friction = ct.friction ?? 0;

  const planRes = plan({ from: A, to: B, offer, ask, friction });
  if (!planRes.ok) return { ok: false, error: `Trade plan failed: ${planRes.blockedBy}`, ...planRes };

  // Apply atomically (sequential per actor; OP engine handles caps/underflow).
  const deltas = _aggregateDeltas(planRes.transfers);
  try {
    for (const [actorId, delta] of deltas) {
      const actor = game.actors.get(actorId);
      await _applyDeltas(actor, delta, `Trade: ${A.name} ↔ ${B.name}`);
    }
  } catch (e) {
    console.warn(TAG, "trade apply failed", e);
    return { ok: false, error: e?.message || "Apply failed" };
  }

  const summary = `Trade: ${A.name} ↔ ${B.name} — ${A.name} sent ${_summarize(_normResource(offer))}, received ${_summarize(_normResource(ask))} (mutual ${ct.mutualTier}, ${(friction*100)|0}% friction)${reason ? `; ${reason}` : ""}`;
  await _writeWarLogs(A, B, summary);

  try {
    Hooks.callAll("bbttcc:economy:exchange", {
      fromId: A.id, toId: B.id,
      offer: _normResource(offer), ask: _normResource(ask),
      friction, mutualTier: ct.mutualTier,
      transfers: planRes.transfers, losses: planRes.losses,
      reason: reason || ""
    });
  } catch (e) { console.warn(TAG, "exchange hook failed", e); }

  return { ok: true, applied: { transfers: planRes.transfers, losses: planRes.losses, summary, friction, mutualTier: ct.mutualTier } };
}

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.factions ??= {};
    const root = (game.bbttcc.api.factions.exchange ??= {});
    root.plan = plan;
    root.share = share;
    root.trade = trade;
    root.OP_KEYS = OP_KEYS.slice();
    console.log(TAG, "Exchange API ready → game.bbttcc.api.factions.exchange.{plan,share,trade}");
  } catch (e) {
    console.warn(TAG, "Exchange API wiring failed", e);
  }
}

Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}
