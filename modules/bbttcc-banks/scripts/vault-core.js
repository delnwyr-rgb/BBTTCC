// modules/bbttcc-banks/scripts/vault-core.js
// Bad Eden — Banks & Loot: Vault Core v0.1 (Phase 1)
//
// One primitive — a Vault — serves personal banks, faction/coalition treasuries,
// and lootable containers. A Vault is a logical store with two channels:
//   - items: gear/manifestation item documents (carryable, layer = "physical")
//   - marks: faction-tier OP energy (layer = "energy"; lives in opBank, NEVER on a steward)
//
// transferVault({ source, target, items, marks }) moves both channels atomically,
// credit-before-debit with full rollback — modeled on the faction exchange engine's
// _applyDeltasAtomic (modules/bbttcc-factions/scripts/exchange-engine.js).
//
// A "VaultRef" names a location: { kind, actor | actorId }.
//   kind "inventory"  → the actor's live Foundry item collection (steward pack, loot corpse)
//   kind "personal"   → steward vault flag (items only; marks live with the faction)
//   kind "faction"    → faction actor: items in a vault flag, marks in opBank
//   kind "coalition"  → designated lead faction: items in a coalitionVault flag, marks in opBank
//
// Phase 1 wires inventory <-> personal fully; the faction/coalition marks path is
// scaffolded against game.bbttcc.api.op.commit so Phase 2 plugs straight in.
//
// API on game.bbttcc.api.banks:
//   transferVault({ source, target, items, marks, context }) → { ok, moved?, error? }
//   deposit(actor, itemId, { scope })   → move a carried item into a bank
//   withdraw(actor, stashId, { scope }) → move a stashed item back to inventory
//   listVault(actor, scope)             → stashed entries
//   openPersonalBank(actor)             → open the Personal Bank app (defined in personal-bank-app.js)
//
// Hooks:
//   bbttcc:vault:changed { sourceId, targetId, kinds, context }

const MOD_ID = "bbttcc-banks";
const TAG    = "[bbttcc-banks]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// Kinds that hold marks (faction-tier energy). Stewards never do.
const MARK_KINDS = new Set(["faction", "coalition"]);

// OP buckets (mirror of op-engine OP_KEYS) — salvage refines into one of these.
const OP_BUCKETS = [
  "violence", "nonlethal", "intrigue", "economy", "softpower", "diplomacy", "logistics", "culture", "faith"
];

const FACTIONS_MOD = "bbttcc-factions";

// Manage rights for a faction/coalition vault: the actor's Foundry owner or a GM —
// and, since the steward IS the Domain (ruling 16, 2026-10-17), whoever owns one of
// the Domain's stewards.
// 10-29: takes the user to check (default this seat) so the GM relay can authorize the REAL
// sender — a steward-owner without Domain ownership can't setFlag the faction actor, so their
// faction/coalition item moves now run on the GM (see _relayTransfer / "banks.transferVault").
function _canManage(actor, user = game.user) {
  if (!actor || !user) return false;
  if (user.isGM || actor.testUserPermission?.(user, "OWNER")) return true;
  try { if (_isFactionActor(actor)) return stewardsOf(actor).some(c => c.testUserPermission?.(user, "OWNER")); } catch (_e) {}
  return false;
}

// ---- Steward ⇄ Domain (ruling 16: one being) ------------------------------
// domainOf(steward)  → the faction actor this character is linked to (flag factionId →
//                      system.faction.id → the faction's roster → factionName), or null.
// stewardsOf(domain) → the character actors linked to this faction (same four paths).
function _linkId(char) {
  try {
    return String(char?.getFlag?.(FACTIONS_MOD, "factionId")
      || foundry.utils.getProperty(char, "system.faction.id")
      || foundry.utils.getProperty(char, "system.system.faction.id") || "").replace(/^Actor\./, "");
  } catch (_e) { return ""; }
}
function _linkName(char) {
  try {
    return String(char?.getFlag?.(FACTIONS_MOD, "factionName")
      || foundry.utils.getProperty(char, "system.faction.name")
      || foundry.utils.getProperty(char, "system.system.faction.name") || "").trim();
  } catch (_e) { return ""; }
}
function _rosterHas(faction, char) {
  try {
    const roster = faction.getFlag?.(FACTIONS_MOD, "roster") || [];
    const ids = new Set([char.id, char.uuid]);
    for (const e of (Array.isArray(roster) ? roster : [])) {
      const k = typeof e === "string" ? e : String(e?.uuid || e?.id || "");
      if (ids.has(k) || ids.has(k.replace(/^Actor\./, ""))) return true;
    }
  } catch (_e) {}
  return false;
}
function _linked(char, faction) {
  const id = _linkId(char);
  if (id) return id === faction.id;
  if (_rosterHas(faction, char)) return true;
  const nm = _linkName(char);
  return !!nm && nm === String(faction.name || "").trim();
}
function domainOf(stewardOrId) {
  const c = _resolveActor(stewardOrId);
  if (!c) return null;
  if (_isFactionActor(c)) return c;
  const id = _linkId(c);
  const byId = id ? game.actors?.get(id) : null;
  if (byId && _isFactionActor(byId)) return byId;
  const factions = (game.actors?.contents || []).filter(_isFactionActor);
  return factions.find(f => _rosterHas(f, c)) || (() => { const nm = _linkName(c); return nm ? factions.find(f => String(f.name || "").trim() === nm) : null; })() || null;
}
function stewardsOf(domainOrId) {
  const f = _resolveActor(domainOrId);
  if (!f || !_isFactionActor(f)) return [];
  return (game.actors?.contents || []).filter(a => a?.type === "character" && _linked(a, f));
}

function _isFactionActor(a) {
  try {
    if (a?.getFlag?.(FACTIONS_MOD, "isFaction") === true) return true;
    return String(a?.system?.details?.type?.value || "").toLowerCase() === "faction";
  } catch { return false; }
}

// Is this item a REAL manifestation (ephemeral — not physical loot/gear)?
// Uses the system's own predicate when available: a mundane weapon carries only an
// EMPTY template-default manifestation block and is NOT a manifestation. A real one
// has concept/signature filled, is type "power", is tagged, or is crafted-origin.
// (systems/fourththing/rfi-items.js → game.fourththing.items.is.isManifestation)
function isRealManifestation(it) {
  try {
    const sys = game?.fourththing?.items?.is?.isManifestation;
    if (typeof sys === "function") return !!sys(it);
  } catch (_e) {}
  if (!it) return false;
  if (it.type === "power") return true;
  const mf = it.system?.manifestation;
  if (mf && (String(mf.concept ?? "").trim() || String(mf.signature ?? "").trim())) return true;
  const tags = Array.isArray(it.system?.tags) ? it.system.tags : [];
  if (tags.some(t => String(t).toLowerCase() === "manifestation")) return true;
  try { return it.getFlag?.("fourththing", "rfi.item")?.origin === "crafted"; } catch { return false; }
}

// Salvage payload: an item that refines into Marks when banked at a faction.
// Stamped at flags["bbttcc-banks"].salvage = { markValue, bucket }.
function _salvageOf(payload) {
  const s = payload?.flags?.[MOD_ID]?.salvage;
  if (!s) return null;
  const markValue = Math.max(0, Math.floor(Number(s.markValue) || 0));
  if (markValue <= 0) return null;
  let bucket = String(s.bucket || "economy").toLowerCase();
  if (!OP_BUCKETS.includes(bucket)) bucket = "economy";
  // 10-29: markValue is PER UNIT — a merged xN salvage row (sheet drop / stack.merge keep the first
  // row's flag) used to refine once and delete all N units. Total = per-unit value × quantity.
  const qty = Math.max(1, Math.floor(Number(payload?.system?.quantity ?? 1)) || 1);
  return { markValue: markValue * qty, unitValue: markValue, qty, bucket };
}

function _resolveActor(aOrId) {
  if (!aOrId) return null;
  if (aOrId instanceof Actor) return aOrId;
  const id = String(aOrId).replace(/^Actor\./, "");
  return game.actors?.get(id) ?? null;
}

// Per-kind flag key on the owning actor (faction vault and a coalition vault can
// coexist on the same lead faction, so they need distinct keys).
function _flagKeyForKind(kind) {
  return kind === "coalition" ? "coalitionVault" : "vault";
}

function _holdsMarks(kind) { return MARK_KINDS.has(kind); }

// Normalize an incoming ref into { actor, kind }.
function _resolveRef(ref) {
  if (!ref) return null;
  const actor = (ref.actor instanceof Actor) ? ref.actor : _resolveActor(ref.actorId ?? ref.actor);
  if (!actor) return null;
  const kind = String(ref.kind || "inventory");
  return { actor, kind };
}

// Strip an item source object down to something safely creatable on a new actor.
function _creatable(obj) {
  const o = foundry.utils.deepClone(obj);
  delete o._id;
  delete o.ownership;
  delete o.folder;
  delete o.sort;
  return o;
}

// Wrap a creatable item payload as a stash entry for a flag-store vault.
function _wrapStash(payload, ctx) {
  const rfi = payload?.flags?.fourththing?.rfi?.item || null;
  return {
    stashId: foundry.utils.randomID(),
    name: payload?.name || "Item",
    img: payload?.img || "icons/svg/item-bag.svg",
    type: payload?.type || "item",
    qty: Math.max(1, Math.floor(Number(payload?.system?.quantity ?? rfi?.charges ?? 1)) || 1),
    tier: rfi?.tier ?? payload?.system?.manifestation?.tier ?? payload?.system?.tier ?? null,
    frame: rfi?.frame ?? payload?.system?.manifestation?.form ?? null,
    data: payload,
    depositedAt: Date.now(),
    depositedBy: ctx?.userId || game.user?.id || null,
  };
}

// ---- Flag-store readers/writers --------------------------------------------

function _readStash(actor, kind) {
  const v = actor.getFlag(MOD_ID, _flagKeyForKind(kind)) || {};
  return Array.isArray(v.items) ? foundry.utils.deepClone(v.items) : [];
}
async function _writeStash(actor, kind, items) {
  await actor.setFlag(MOD_ID, _flagKeyForKind(kind), { items });
}

/**
 * Resolve the items being moved out of the SOURCE.
 * Returns [{ ref, payload }] — ref is the source's removal handle (item id for
 * inventory, stashId for a flag store); payload is a creatable item object.
 */
function _collectItems(src, itemKeys) {
  const out = [];
  if (!itemKeys?.length) return out;
  if (src.kind === "inventory") {
    for (const id of itemKeys) {
      const it = src.actor.items?.get?.(String(id));
      if (!it) continue;
      out.push({ ref: it.id, payload: _creatable(it.toObject()) });
    }
  } else {
    const stash = _readStash(src.actor, src.kind);
    for (const sid of itemKeys) {
      const entry = stash.find(e => e?.stashId === sid);
      if (!entry) continue;
      out.push({ ref: entry.stashId, payload: _creatable(entry.data || {}) });
    }
  }
  return out;
}

// ---- Item channel ----------------------------------------------------------

// Add payloads to the target; record what we added for rollback.
async function _addItems(tgt, payloads, addedLog, ctx) {
  if (!payloads.length) return;
  if (tgt.kind === "inventory") {
    const created = await tgt.actor.createEmbeddedDocuments("Item", payloads);
    addedLog.push({ kind: "inventory", actor: tgt.actor, ids: created.map(c => c.id) });
  } else {
    const stash = _readStash(tgt.actor, tgt.kind);
    const entries = payloads.map(p => _wrapStash(p, ctx));
    await _writeStash(tgt.actor, tgt.kind, stash.concat(entries));
    addedLog.push({ kind: "flag", actor: tgt.actor, vaultKind: tgt.kind, stashIds: entries.map(e => e.stashId) });
  }
}

// Remove refs from the source. deleteEmbeddedDocuments / setFlag are each single
// DB ops, so this either fully applies or throws without partial state.
async function _removeItems(src, refs) {
  if (!refs.length) return;
  if (src.kind === "inventory") {
    await src.actor.deleteEmbeddedDocuments("Item", refs.map(String));
  } else {
    const stash = _readStash(src.actor, src.kind);
    const drop = new Set(refs.map(String));
    await _writeStash(src.actor, src.kind, stash.filter(e => !drop.has(String(e?.stashId))));
  }
}

// ---- Marks channel (faction-tier energy via op-engine) ---------------------
// Scaffolded for Phase 2. Moves { bucket: qty } from source→target, debiting the
// source's opBank and crediting the target's, capped (overflow bounces).
async function _moveMarks(src, tgt, marks, ctx) {
  const clean = {};
  for (const [k, v] of Object.entries(marks || {})) {
    const n = Math.floor(Number(v) || 0);
    if (n > 0) clean[k] = n;
  }
  if (!Object.keys(clean).length) return [];

  const opApi = game?.bbttcc?.api?.op;
  if (!opApi?.commit) throw new Error("op.commit unavailable — bbttcc-factions not loaded");

  const applied = []; // { actorId, delta } — reversible
  // Debit source first only if it actually holds marks; credit target after.
  if (_holdsMarks(src.kind)) {
    const neg = {}; for (const [k, v] of Object.entries(clean)) neg[k] = -v;
    // review P1 (2026-10-28): noDiscount on every bank debit/reversal — a move is not a spend, and a
    // discounted debit reversed at full value minted marks on every cap bounce.
    const r = await opApi.commit(src.actor.id, neg, { source: "bank", label: ctx?.label || "Bank withdraw", allowOvercap: true, noDiscount: true });
    if (!r?.committed) throw new Error(`marks debit refused for ${src.actor.name}: ${r?.error || "insufficient"}`);
    applied.push({ actorId: src.actor.id, delta: neg });
  }
  if (_holdsMarks(tgt.kind)) {
    const pos = { ...clean };
    const r = await opApi.commit(tgt.actor.id, pos, { source: "bank", label: ctx?.label || "Bank deposit", allowOvercap: !!ctx?.allowOvercap });
    if (!r?.committed) {
      // Cap bounce: reverse any debit we already applied, then signal the bounce.
      for (const a of applied) {
        const rev = {}; for (const [k, v] of Object.entries(a.delta)) rev[k] = -v;
        try { await opApi.commit(a.actorId, rev, { source: "bank", label: "bank bounce", allowOvercap: true, noDiscount: true }); }
        catch (re) { console.error(TAG, "marks bounce reversal failed", re); }
      }
      const err = new Error(`marks credit refused for ${tgt.actor.name} (over cap)`);
      err.bounced = true;
      throw err;
    }
    applied.push({ actorId: tgt.actor.id, delta: pos });
  }
  return applied;
}

async function _reverseMarks(applied) {
  const opApi = game?.bbttcc?.api?.op;
  if (!opApi?.commit) return;
  for (const a of (applied || []).reverse()) {
    const rev = {}; for (const [k, v] of Object.entries(a.delta)) rev[k] = -v;
    try { await opApi.commit(a.actorId, rev, { source: "bank", label: "rollback", allowOvercap: true, noDiscount: true }); }
    catch (re) { console.error(TAG, "marks rollback failed", re); }
  }
}

// ---- Rollback --------------------------------------------------------------

async function _rollbackAdds(addedLog) {
  for (const a of (addedLog || []).reverse()) {
    try {
      if (a.kind === "inventory") {
        await a.actor.deleteEmbeddedDocuments("Item", a.ids);
      } else if (a.kind === "flag") {
        const stash = _readStash(a.actor, a.vaultKind);
        const drop = new Set(a.stashIds.map(String));
        await _writeStash(a.actor, a.vaultKind, stash.filter(e => !drop.has(String(e?.stashId))));
      }
    } catch (re) { console.error(TAG, "rollback (adds) failed", re); }
  }
}

// ---- The engine ------------------------------------------------------------

/**
 * Move items and/or marks from one vault to another, atomically.
 * @param {object} p
 * @param {object} p.source   VaultRef { kind, actor|actorId }
 * @param {object} p.target   VaultRef { kind, actor|actorId }
 * @param {string[]} [p.items]  item ids (inventory source) or stashIds (flag source)
 * @param {object} [p.marks]    { bucket: qty } faction-tier marks to move
 * @param {object} [p.context]  { label, allowOvercap, userId }
 * @returns {Promise<{ok:boolean, moved?:number, marks?:object, error?:string, bounced?:boolean}>}
 */
async function transferVault({ source, target, items = [], marks = null, context = {} } = {}) {
  const src = _resolveRef(source);
  const tgt = _resolveRef(target);
  if (!src || !tgt) return { ok: false, error: "Vault source/target could not be resolved." };
  if (!items.length && !marks) return { ok: false, error: "Nothing to transfer." };

  // 10-29: faction/coalition vault flags live on the Domain actor, which a steward-owner
  // (ruling 16) often can't write, and two seats writing the same {items} array raced (a Take
  // duplicated, a Store lost an item). Player seats relay those moves to the primary GM, which
  // runs them one at a time per vault actor.
  if (!game.user?.isGM && (MARK_KINDS.has(src.kind) || MARK_KINDS.has(tgt.kind))) {
    return _relayTransfer(src, tgt, items, marks, context);
  }

  // Access gate: withdrawing (debiting) a faction/coalition store requires manage
  // rights. Deposits INTO a faction are open. Enforced only when asked (UI paths).
  if (context.enforceAccess && MARK_KINDS.has(src.kind) && !_canManage(src.actor)) {
    return { ok: false, error: "Only the faction owner or a GM may withdraw from this vault." };
  }

  // 10-29: serialize per vault actor so the stash is re-read inside the lock — a Take whose
  // entry another seat already took now fails "not found" instead of duplicating the item.
  return _withVaultLock([src.actor.uuid, tgt.actor.uuid], () => _transferLocked(src, tgt, items, marks, context));
}

async function _transferLocked(src, tgt, items, marks, context) {

  // Resolve item payloads from the source up front (fail fast on stale handles).
  const moving = _collectItems(src, items);
  if (items.length && moving.length !== items.length) {
    return { ok: false, error: "Some items were not found in the source vault." };
  }

  // Transmutation: when depositing into a marks-holder (faction/coalition), salvage
  // items refine into Marks instead of being stored. Everything else is stored as-is.
  let itemPayloads = moving.map(m => m.payload);
  let transmuted = null;
  if (_holdsMarks(tgt.kind)) {
    itemPayloads = [];
    const acc = {};
    for (const m of moving) {
      const sv = _salvageOf(m.payload);
      if (sv) acc[sv.bucket] = (acc[sv.bucket] || 0) + sv.markValue;
      else itemPayloads.push(m.payload);
    }
    if (Object.keys(acc).length) transmuted = acc;
  }

  // Combine explicit marks with any transmuted salvage marks.
  let effMarks = marks ? { ...marks } : null;
  if (transmuted) {
    effMarks = effMarks || {};
    for (const [k, v] of Object.entries(transmuted)) effMarks[k] = (effMarks[k] || 0) + v;
  }

  const addedLog = [];
  let marksApplied = [];
  try {
    // 1. Credit target (items + marks land first). A cap bounce on marks throws,
    //    rolling everything back so salvage stays in the source ("treasury full").
    await _addItems(tgt, itemPayloads, addedLog, context);
    if (effMarks) marksApplied = await _moveMarks(src, tgt, effMarks, context);
    // 2. Debit source — remove every moved handle (stored items + transmuted salvage).
    await _removeItems(src, moving.map(m => m.ref));
  } catch (e) {
    await _rollbackAdds(addedLog);
    await _reverseMarks(marksApplied);
    warn("transferVault rolled back", e);
    return { ok: false, error: e?.message || "Transfer failed (rolled back).", bounced: !!e?.bounced };
  }

  _fireChanged(src, tgt, context);
  return { ok: true, moved: itemPayloads.length, marks: effMarks || null, transmuted };
}

// ---- Serialization + GM relay (10-29) ----------------------------------------

// Per-actor promise chains. A transfer registers its tail on every key it touches
// synchronously before awaiting, so the order is total and two-key locks can't deadlock.
const _vaultQueues = new Map();
function _withVaultLock(keys, fn) {
  const ks = [...new Set(keys.filter(Boolean).map(String))];
  const prior = ks.map(k => _vaultQueues.get(k)).filter(Boolean);
  const run = Promise.all(prior).then(() => fn());
  const done = run.then(() => {}, () => {});
  for (const k of ks) _vaultQueues.set(k, done);
  done.then(() => { for (const k of ks) if (_vaultQueues.get(k) === done) _vaultQueues.delete(k); });
  return run;
}

async function _relayTransfer(src, tgt, items, marks, context) {
  const gx = game?.bbttcc?.api?.gmExec;
  if (!gx?.call) return { ok: false, error: "No GM relay available — a GM must be connected to use the Domain vault." };
  try {
    const res = await gx.call("banks.transferVault", {
      source: { kind: src.kind, actorUuid: src.actor.uuid },
      target: { kind: tgt.kind, actorUuid: tgt.actor.uuid },
      items: (items || []).map(String),
      marks: marks || null,
      label: String(context?.label || "").slice(0, 60),
    });
    if (res?.ok) _fireChanged(src, tgt, context);   // the GM fired it on its seat; refresh this one too
    return res || { ok: false, error: "The GM returned no result." };
  } catch (e) {
    return { ok: false, error: String(e?.message || e || "Vault relay failed.") };
  }
}

async function _resolveRelayRef(ref) {
  const kind = String(ref?.kind || "");
  if (!["inventory", "personal", "faction", "coalition"].includes(kind)) return null;
  let doc = null;
  try { doc = ref?.actorUuid ? await fromUuid(String(ref.actorUuid)) : null; } catch (_e) { doc = null; }
  const actor = (doc instanceof Actor) ? doc : (doc?.actor instanceof Actor ? doc.actor : null);
  return actor ? { actor, kind } : null;
}

// GM side of the relay. Never trust the payload's ids: authorize meta.fromUserId (the real
// socket sender) against every actor the move touches.
async function _onRelayedTransfer(payload, meta) {
  const user = game.users?.get?.(meta?.fromUserId);
  if (!user) return { ok: false, error: "Unknown requesting user." };
  const src = await _resolveRelayRef(payload?.source);
  const tgt = await _resolveRelayRef(payload?.target);
  if (!src || !tgt) return { ok: false, error: "Vault source/target could not be resolved." };
  if (!MARK_KINDS.has(src.kind) && !MARK_KINDS.has(tgt.kind)) return { ok: false, error: "Only Domain vault moves are relayed." };
  // Explicit marks moves are GM-only (no UI sends them; an inventory source would mint marks).
  if (payload?.marks && !user.isGM) return { ok: false, error: "Moving marks directly is GM-only." };
  const owns = (a) => !!a?.testUserPermission?.(user, "OWNER");
  // Source: you give what is yours; you withdraw from a Domain you may manage.
  if (MARK_KINDS.has(src.kind)) {
    if (!_canManage(src.actor, user)) return { ok: false, error: "Only the faction owner, one of its stewards, or a GM may withdraw from this vault." };
  } else if (!owns(src.actor)) return { ok: false, error: "You don't own that source." };
  // Target: deposits INTO a Domain are open; anything else must land on an actor you own.
  if (!MARK_KINDS.has(tgt.kind) && !owns(tgt.actor)) return { ok: false, error: "You don't own that recipient." };
  const items = Array.isArray(payload?.items) ? payload.items.map(String).slice(0, 50) : [];
  const context = {
    label: String(payload?.label || "Bank").slice(0, 60),
    userId: user.id,
    requestedBy: meta?.fromUserName || user.name,
  };
  return _withVaultLock([src.actor.uuid, tgt.actor.uuid], () => _transferLocked(src, tgt, items, payload?.marks || null, context));
}

function _registerRelay() {
  try { game?.bbttcc?.api?.gmExec?.register?.("banks.transferVault", _onRelayedTransfer); }
  catch (e) { warn("banks.transferVault relay registration failed", e); }
}

// ---- Refresh + hook --------------------------------------------------------

function _rerenderOpenBankApps(actorIds) {
  try {
    const ids = new Set(actorIds.filter(Boolean).map(String));
    foundry.applications?.instances?.forEach?.((app) => {
      const aid = app?.actor?.id ? String(app.actor.id) : "";
      if (app?.options?.id?.startsWith?.("bbttcc-bank") && app.rendered && (!aid || ids.has(aid))) {
        app.render(false);
      }
    });
  } catch (e) { warn("bank app refresh failed", e); }
}

function _fireChanged(src, tgt, context) {
  const sourceId = src?.actor?.id || null;
  const targetId = tgt?.actor?.id || null;
  try {
    Hooks.callAll("bbttcc:vault:changed", {
      sourceId, targetId, kinds: { source: src?.kind, target: tgt?.kind }, context: context || {}
    });
  } catch (e) { warn("vault changed hook failed", e); }
  // Re-render involved sheets + any open bank apps.
  try {
    for (const a of [src?.actor, tgt?.actor]) {
      if (a?.sheet?.rendered) a.sheet.render(false);
    }
  } catch (_e) {}
  _rerenderOpenBankApps([sourceId, targetId]);
}

// ---- Convenience API -------------------------------------------------------

function listVault(actor, scope = "personal") {
  const a = _resolveActor(actor);
  if (!a) return [];
  return _readStash(a, scope);
}

// Deposit a carried item from a steward into a vault.
// dest: { scope, actorId? } — scope "personal" (self) | "faction" | "coalition";
// actorId names the faction / lead actor (defaults to the steward for personal).
async function deposit(steward, itemId, dest = {}) {
  const a = _resolveActor(steward);
  if (!a) return { ok: false, error: "Actor not found." };
  const kind = dest.scope || dest.kind || "personal";
  const targetActor = dest.actorId ? _resolveActor(dest.actorId) : a;
  if (!targetActor) return { ok: false, error: "Destination vault not found." };
  return transferVault({
    source: { kind: "inventory", actor: a },
    target: { kind, actor: targetActor },
    items: [itemId],
    context: { label: "Deposit", userId: game.user?.id },
  });
}

// Withdraw a stashed item out of a vault into a steward's inventory.
// holder = the vault-owning actor; dest: { fromScope|scope, toActorId? }.
async function withdraw(holder, stashId, dest = {}) {
  const h = _resolveActor(holder);
  if (!h) return { ok: false, error: "Actor not found." };
  const kind = dest.fromScope || dest.scope || "personal";
  const toActor = dest.toActorId ? _resolveActor(dest.toActorId) : h;
  if (!toActor) return { ok: false, error: "Recipient not found." };
  return transferVault({
    source: { kind, actor: h },
    target: { kind: "inventory", actor: toActor },
    items: [stashId],
    context: { label: "Withdraw", userId: game.user?.id, enforceAccess: true },
  });
}

// Read a faction's Marks treasury (current per-bucket marks + caps) via the OP engine.
// Synchronous on purpose: op.preview() is async, so the old call here always returned an empty
// object and every bank window read "Treasury empty" (fixed 2026-10-18). The bank IS the opBank flag.
function factionTreasury(faction) {
  const f = _resolveActor(faction);
  if (!f) return { marks: {}, caps: {}, totals: null };
  const marks = {}; const raw = f.getFlag(FACTIONS_MOD, "opBank") || {};
  for (const k of OP_BUCKETS) marks[k] = Math.max(0, Math.round(Number(raw?.[k]) || 0));
  let caps = {};
  try { caps = game?.bbttcc?.facts?.faction?.caps?.(f) || {}; } catch (_e) { caps = {}; }
  const total = Object.values(marks).reduce((a, b) => a + b, 0);
  const capTotal = OP_BUCKETS.reduce((a, k) => a + (Number(caps?.[k]) || 0), 0);
  return { marks, caps, totals: { marks: total, cap: capTotal } };
}

// Factions this user owns (ownership = affiliation).
function accessibleFactions(user = game.user) {
  return (game.actors?.contents || []).filter(a => _isFactionActor(a) && a.isOwner);
}

// Factions flagged as Coalition Treasury hosts.
function coalitionLeadFactions() {
  return (game.actors?.contents || []).filter(a => _isFactionActor(a) && a.getFlag(MOD_ID, "coalitionLead") === true);
}

async function setCoalitionLead(faction, on) {
  const f = _resolveActor(faction);
  if (!f) return { ok: false, error: "Faction not found." };
  await f.setFlag(MOD_ID, "coalitionLead", !!on);
  try { if (f.sheet?.rendered) f.sheet.render(false); } catch (_e) {}
  return { ok: true };
}

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    const root = (game.bbttcc.api.banks ??= {});
    root.transferVault = transferVault;
    root.deposit = deposit;
    root.withdraw = withdraw;
    root.listVault = listVault;
    root.factionTreasury = factionTreasury;
    root.accessibleFactions = accessibleFactions;
    root.coalitionLeadFactions = coalitionLeadFactions;
    root.setCoalitionLead = setCoalitionLead;
    root.canManage = _canManage;
    root.domainOf = domainOf;           // ruling 16 (2026-10-17): steward → its Domain (faction actor)
    root.stewardsOf = stewardsOf;       //                         Domain → its stewards
    root.isFactionActor = _isFactionActor;
    root.isRealManifestation = isRealManifestation;
    root.OP_BUCKETS = OP_BUCKETS.slice();
    // openPersonalBank / openFactionBank are installed by the app files.
    root.MOD_ID = MOD_ID;
    log("Vault core ready → game.bbttcc.api.banks.{transferVault,deposit,withdraw,listVault,factionTreasury,…}");
  } catch (e) {
    warn("Vault core wiring failed", e);
  }
}

Hooks.once("ready", () => { _attach(); _registerRelay(); });
try { if (game?.ready) { _attach(); _registerRelay(); } } catch (_e) {}

export {
  transferVault, deposit, withdraw, listVault,
  factionTreasury, accessibleFactions, coalitionLeadFactions, setCoalitionLead,
  domainOf, stewardsOf,
  MOD_ID,
};
