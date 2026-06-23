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

// Manage rights for a faction/coalition vault: the actor's Foundry owner or a GM.
// Ownership IS affiliation in this codebase (no separate membership model).
function _canManage(actor) {
  return !!(game.user?.isGM || actor?.isOwner);
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
  return { markValue, bucket };
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
    const r = await opApi.commit(src.actor.id, neg, { source: "bank", label: ctx?.label || "Bank withdraw", allowOvercap: true });
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
        try { await opApi.commit(a.actorId, rev, { source: "bank", label: "bank bounce", allowOvercap: true }); }
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
    try { await opApi.commit(a.actorId, rev, { source: "bank", label: "rollback", allowOvercap: true }); }
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

  // Access gate: withdrawing (debiting) a faction/coalition store requires manage
  // rights. Deposits INTO a faction are open. Enforced only when asked (UI paths).
  if (context.enforceAccess && MARK_KINDS.has(src.kind) && !_canManage(src.actor)) {
    return { ok: false, error: "Only the faction owner or a GM may withdraw from this vault." };
  }

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
function factionTreasury(faction) {
  const f = _resolveActor(faction);
  if (!f) return { marks: {}, caps: {}, totals: null };
  try {
    const pv = game?.bbttcc?.api?.op?.preview?.(f.id, {}, {});
    if (pv) return { marks: pv.before || {}, caps: pv.caps || {}, totals: pv.totals || null };
  } catch (_e) {}
  return { marks: f.getFlag(FACTIONS_MOD, "opBank") || {}, caps: {}, totals: null };
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

Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}

export {
  transferVault, deposit, withdraw, listVault,
  factionTreasury, accessibleFactions, coalitionLeadFactions, setCoalitionLead,
  MOD_ID,
};
