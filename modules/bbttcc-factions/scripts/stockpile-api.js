// modules/bbttcc-factions/scripts/stockpile-api.js
// Bad Eden — Faction Material Stockpile API v0.1
//
// Faction-side abstract material storage. Materials are normally items on
// character actors (frame === "material", with rfi.materialKey + rfi.charges).
// A faction stockpile is an aggregated count keyed by materialKey — fungible by
// key, no per-item tier/state. Depositing burns charges off character items;
// withdrawing clones a fresh material item back to a character (using the
// last-seen UUID/name when available, falling back to a minimal stub).
//
// Storage:
//   flags.bbttcc-factions.matStockpile = {
//     [materialKey]: { qty: int, name: string, img: string, lastUuid: string|null }
//   }
//
// API on game.bbttcc.api.factions.stockpile:
//   get(faction)                       → map (deep clone)
//   qty(faction, matKey)               → int
//   list(faction)                      → [{ key, qty, name, img }] sorted by qty desc / name asc
//   adjust(faction, matKey, delta, opts?)        → { ok, before, after }
//   depositFromCharacter(character, faction, opts?) → { ok, deposited: [{ key, qty, name }] }
//                                                     opts: { itemId?, qty?, drainAll? }
//   withdrawToCharacter(character, faction, matKey, qty, opts?) → { ok, itemId? }
//
// Hook: bbttcc:stockpile:changed { factionId, materialKey, before, after, delta }

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-stockpile]";

const FLAG_KEY = "matStockpile";

function _resolveActor(aOrId) {
  if (!aOrId) return null;
  if (aOrId instanceof Actor) return aOrId;
  const id = String(aOrId).replace(/^Actor\./, "");
  return game.actors?.get(id) ?? null;
}

function _readMap(faction) {
  return foundry.utils.deepClone(faction?.getFlag?.(MOD_ID, FLAG_KEY) ?? {});
}

async function _writeMap(faction, map) {
  // Strip zero/negative entries to keep the flag clean.
  const clean = {};
  for (const [k, v] of Object.entries(map || {})) {
    const qty = Math.max(0, Math.floor(Number(v?.qty || 0) || 0));
    if (qty <= 0) continue;
    clean[k] = {
      qty,
      name:     String(v.name || k),
      img:      String(v.img || "icons/svg/mystery-man.svg"),
      lastUuid: v.lastUuid || null
    };
  }
  await faction.setFlag(MOD_ID, FLAG_KEY, clean);
}

function _safeQty(v) {
  const n = Math.floor(Number(v) || 0);
  return Number.isFinite(n) ? n : 0;
}

function _matMetaFromItem(item) {
  const rfi = item?.getFlag?.("fourththing", "rfi.item") ?? {};
  if (rfi.frame !== "material" || !rfi.materialKey) return null;
  const qty = Math.max(0, Math.floor(Number(rfi.charges ?? 1) || 1));
  return {
    key:      String(rfi.materialKey),
    name:     String(item.name || rfi.materialKey),
    img:      String(item.img  || "icons/svg/mystery-man.svg"),
    qty,
    sourceId: item._stats?.compendiumSource || item.flags?.core?.sourceId || null,
    item
  };
}

function get(faction) {
  const F = _resolveActor(faction);
  return F ? _readMap(F) : {};
}

function qty(faction, matKey) {
  const F = _resolveActor(faction);
  if (!F || !matKey) return 0;
  const m = _readMap(F);
  return _safeQty(m[matKey]?.qty);
}

function list(faction) {
  const m = get(faction);
  const arr = Object.entries(m).map(([key, v]) => ({
    key,
    qty:  _safeQty(v?.qty),
    name: v?.name || key,
    img:  v?.img  || "icons/svg/mystery-man.svg"
  })).filter(e => e.qty > 0);
  arr.sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name));
  return arr;
}

async function adjust(faction, matKey, delta, opts = {}) {
  const F = _resolveActor(faction);
  if (!F || !matKey) return { ok: false, error: "missing actor or key" };
  const d = _safeQty(delta) - 0; // signed int via _safeQty floor
  const signedDelta = Math.floor(Number(delta) || 0);
  if (!signedDelta) return { ok: true, before: qty(F, matKey), after: qty(F, matKey), delta: 0 };

  const map = _readMap(F);
  const cur = map[matKey] || { qty: 0, name: opts?.name || matKey, img: opts?.img || "icons/svg/mystery-man.svg", lastUuid: opts?.lastUuid || null };
  const before = _safeQty(cur.qty);
  const after  = Math.max(0, before + signedDelta);
  cur.qty = after;
  if (opts?.name) cur.name = String(opts.name);
  if (opts?.img)  cur.img  = String(opts.img);
  if (opts?.lastUuid !== undefined) cur.lastUuid = opts.lastUuid;
  map[matKey] = cur;
  await _writeMap(F, map);

  try {
    Hooks.callAll("bbttcc:stockpile:changed", {
      factionId: F.id, materialKey: matKey, before, after, delta: signedDelta
    });
  } catch (e) { console.warn(TAG, "hook failed", e); }

  return { ok: true, before, after, delta: signedDelta };
}

// Pull material(s) from a character's inventory into the faction stockpile.
// opts: { itemId?, qty?, drainAll? }
//   itemId+qty       → deposit qty units from a specific material item
//   drainAll: true   → deposit ALL material-frame items on the character
async function depositFromCharacter(character, faction, opts = {}) {
  const C = _resolveActor(character);
  const F = _resolveActor(faction);
  if (!C || !F) return { ok: false, error: "actor not found" };

  const deposited = [];

  if (opts?.drainAll) {
    const items = Array.from(C.items ?? []);
    for (const it of items) {
      const meta = _matMetaFromItem(it);
      if (!meta || meta.qty <= 0) continue;
      await adjust(F, meta.key, +meta.qty, { name: meta.name, img: meta.img, lastUuid: meta.sourceId });
      await it.delete();
      deposited.push({ key: meta.key, qty: meta.qty, name: meta.name });
    }
    return { ok: true, deposited };
  }

  // Specific item path
  if (!opts?.itemId) return { ok: false, error: "itemId or drainAll required" };
  const item = C.items?.get(opts.itemId);
  if (!item) return { ok: false, error: "item not found on character" };
  const meta = _matMetaFromItem(item);
  if (!meta) return { ok: false, error: "item is not a material" };

  const want = Math.max(1, _safeQty(opts.qty || meta.qty));
  const take = Math.min(want, meta.qty);
  if (take <= 0) return { ok: false, error: "no charges to deposit" };

  await adjust(F, meta.key, +take, { name: meta.name, img: meta.img, lastUuid: meta.sourceId });
  const left = meta.qty - take;
  if (left <= 0) {
    await item.delete();
  } else {
    await item.setFlag("fourththing", "rfi.item.charges", left);
  }
  deposited.push({ key: meta.key, qty: take, name: meta.name });
  return { ok: true, deposited };
}

// Withdraw qty units of matKey to a character: decrement faction, create item.
async function withdrawToCharacter(character, faction, matKey, qtyAmt, _opts = {}) {
  const C = _resolveActor(character);
  const F = _resolveActor(faction);
  if (!C || !F || !matKey) return { ok: false, error: "missing actor or key" };
  const q = _safeQty(qtyAmt);
  if (q <= 0) return { ok: false, error: "qty must be > 0" };

  const map = _readMap(F);
  const entry = map[matKey];
  const have = _safeQty(entry?.qty);
  if (have < q) return { ok: false, error: `stockpile has ${have}, need ${q}` };

  // Build the item data to clone onto the character.
  let itemData = null;
  if (entry?.lastUuid) {
    try {
      const src = await fromUuid(entry.lastUuid);
      if (src) {
        itemData = src.toObject();
        delete itemData._id;
        foundry.utils.setProperty(itemData, "flags.fourththing.rfi.item.charges", q);
      }
    } catch (e) { console.warn(TAG, "lastUuid resolve failed", e); }
  }
  if (!itemData) {
    // Minimal stub mirroring the harvest fallback.
    itemData = {
      name: entry?.name || matKey,
      type: "gear",
      img:  entry?.img  || "icons/svg/mystery-man.svg",
      system: { slot: "material", tags: ["material", matKey] },
      flags: { fourththing: { rfi: { item: {
        tier:        "I",
        frame:       "material",
        origin:      "withdrawn",
        bound:       "free",
        materialKey: matKey,
        charges:     q
      } } } }
    };
  }

  const created = await C.createEmbeddedDocuments("Item", [itemData]);
  const newId = created?.[0]?.id || null;

  // Decrement stockpile via adjust to fire the hook.
  await adjust(F, matKey, -q, { name: entry?.name, img: entry?.img, lastUuid: entry?.lastUuid });

  return { ok: true, itemId: newId };
}

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.factions ??= {};
    const root = (game.bbttcc.api.factions.stockpile ??= {});
    root.get = get;
    root.qty = qty;
    root.list = list;
    root.adjust = adjust;
    root.depositFromCharacter = depositFromCharacter;
    root.withdrawToCharacter = withdrawToCharacter;
    console.log(TAG, "Stockpile API ready → game.bbttcc.api.factions.stockpile");
  } catch (e) {
    console.warn(TAG, "stockpile API wiring failed", e);
  }
}

Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}
