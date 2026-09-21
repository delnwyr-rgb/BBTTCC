import { MATERIAL_MARKET } from "/modules/bbttcc-core/scripts/economy.constants.js";
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
//   sell(faction, matKey, qty)         → { ok, qty, marks, unit, retail, remaining }  (2026-09-20: Economy marks at SELL_FRACTION of retail)
//   unitPrice(faction, matKey)         → { retail, sell, tier, rarity }
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
  // Replace wholesale (delete-then-set semantics) — a plain merge-write never
  // drops a key that hit zero [[reference_foundry_update_merges_use_minus_eq]].
  // (Backported from the dnd5e build 2026-06-12.)
  await faction.update({ [`flags.${MOD_ID}.-=${FLAG_KEY}`]: null });
  await faction.update({ [`flags.${MOD_ID}.${FLAG_KEY}`]: clean });
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

// PLAYER SEATS (2026-09-21): a steward harvesting into the faction stockpile from a player seat can't update the faction
// actor unless they own it — the ONE write a stockpile needs (an adjust) relays to the GM seat via bbttcc-core gmExec.
const RELAY_TYPE = "factions.stockpile.adjust";
function _registerRelay() {
  const gx = game.bbttcc?.api?.gmExec; if (!gx?.register) return;
  gx.register(RELAY_TYPE, async (p, meta) => {
    const F = _resolveActor(p?.factionId); if (!F) throw new Error("faction not found");
    const r = await adjust(F, String(p?.matKey || ""), Number(p?.delta) || 0, p?.opts || {});
    console.log(TAG, "relayed adjust", F.name, p?.matKey, p?.delta, `(for ${meta?.fromUserName || "?"})`);
    return r;
  });
}

async function adjust(faction, matKey, delta, opts = {}) {
  const F = _resolveActor(faction);
  if (!F || !matKey) return { ok: false, error: "missing actor or key" };
  if (!game.user?.isGM && !F.isOwner) {
    const gx = game.bbttcc?.api?.gmExec;
    if (!gx?.call) return { ok: false, error: "no permission to write the faction stockpile and no GM relay available" };
    return gx.call(RELAY_TYPE, { factionId: F.id, matKey: String(matKey), delta: Math.floor(Number(delta) || 0), opts: { name: opts?.name, img: opts?.img, lastUuid: opts?.lastUuid } });
  }
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

// ── SELL (owner ruling 2026-09-20: "can we sell resources we get from our land?") ──────────────────────────────
// Materials sell back at SELL_FRACTION of their retail unit price (rubric §1: tierBase × 0.1 × rarity; a T1 unit
// retails at 5 marks) into the faction's ECONOMY pool. The unit price comes from the material's own item when the
// stockpile remembers one (`lastUuid` → rfi.item.tier / rarityMult), else tier I. Tune SELL_FRACTION here.
const SELL_FRACTION = MATERIAL_MARKET.SELL_FRACTION;          // one table: bbttcc-core economy.constants.js
// MATERIAL FAMILIES (2026-09-21) — every minted key → its family; the family → its home OP channel (MATERIAL_MARKET).
const MATERIAL_FAMILY = Object.freeze({
  ore: ["ore-vein", "bog-iron", "heart-iron", "mountain-stone", "anchorstone", "cold-iron", "scribed-steel", "vow-bound-edge", "hex-iron-cleat", "rad-iron", "heart-iron-shaving", "pig-iron", "threshold-iron", "brace-iron", "wardiron", "blessed-steel", "mirror-alloy", "silence-alloy", "brass", "casing-brass", "lead-shot", "sheet-steel", "rivet-plate", "pre-fall-stainless", "scrap-steel"],
  salvage: ["scrap-salvage", "prefall-component", "pre-fall-component", "soft-alloy", "enamel-pin", "brass-thumb-bell", "bronze-nail", "spring-tension-arm", "pre-fall-electronics", "stubborn-batteries", "ley-tuned-magnetic-tape", "lunchbox-frame", "sealed-foil", "pre-fall-signage", "pre-fall-condiment", "actually-suspect-additives", "expanded-polyurethane", "competent-engraving", "heart-coil"],
  wood: ["ash-wood", "vow-resin", "memory-resin", "sept-stamped-haft", "vow-shaft", "oak-core", "hickory-haft", "ash-haft", "walnut-stock", "vigil-resin"],
  hide: ["herd-leather", "root-leather", "work-leather", "road-leather", "oath-leather", "sept-leather", "leather-strap", "leather-grip", "leather-cuff", "rivet-strap", "wrapped-leather", "corded-belt", "tool-loop"],
  farm: ["wild-grain", "bad-eden-meat", "wool", "sept-wool", "ground-bean"],
  herb: ["wild-herb", "reagent-moss", "mire-resin", "marrow-tincture", "low-grade-precognition"],
  weave: ["sept-cloth", "blessed-thread", "silence-silk", "hex-rope", "balance-bind", "warded-wool", "prayer-thread", "calming-thread", "ash-thread", "circle-silk", "yesodium-thread", "road-canvas", "pre-fall-cotton", "gambeson", "padded-coat", "quilted-liner", "mail"],
  sacred: ["prayer-resin", "vow-bone", "oath-ink", "sept-tuning-fork", "prayer-binding", "sacred-gold", "witness-resin", "threshold-wax", "sept-silver"],
  crystal: ["crystal-fragment", "sun-glass", "fogged-quartz", "courier-glass", "witness-glass", "focusing-lens", "focused-crystal", "anchor-quartz", "hex-glyph-plate", "hex-script", "hex-lattice"],
  yesod: ["yesodium", "tree-of-life-shard"],
  paper: ["pre-fall-paper", "wax-paper", "receipt-paper", "ink-three-colors"],
  shore: ["river-clay", "salt-block", "freshwater-pearl", "finger-bone"]
});
const _FAMILY_OF = new Map(); for (const [fam, keys] of Object.entries(MATERIAL_FAMILY)) for (const k of keys) _FAMILY_OF.set(k, fam);
function familyOf(matKey) { return _FAMILY_OF.get(String(matKey || "")) || "ore"; }
function channelFor(matKey) { const family = familyOf(matKey); return { family, channel: MATERIAL_MARKET.FAMILY_CHANNEL[family] || "economy" }; }
const TIER_BASE_MARKS = { I: 50, II: 150, III: 450, IV: 1350, 1: 50, 2: 150, 3: 450, 4: 1350 };
async function unitPrice(faction, matKey) {
  const F = _resolveActor(faction); const cur = F ? (_readMap(F)[matKey] || null) : null;
  let tier = "I", rarity = 1.0;
  try { if (cur?.lastUuid) { const src = await fromUuid(cur.lastUuid); const rfi = src?.getFlag?.("fourththing", "rfi.item") || {}; if (rfi.tier) tier = rfi.tier; if (Number(rfi.rarityMult) > 0) rarity = Number(rfi.rarityMult); } } catch (_e) {}
  const retail = Math.round((TIER_BASE_MARKS[tier] ?? 50) * 0.1 * rarity);
  const { family, channel } = channelFor(matKey);
  return { retail, sell: Math.max(1, Math.round(retail * SELL_FRACTION)), tier, rarity, family, channel };
}
// HEADROOM (2026-09-21): a sale that would push a bank over its cap is REFUSED by the OP engine (Sell Surplus tried to sell
// 79 wild herb into a 57/70 Logistics bank and got "commit refused"). Sales size themselves to the room the cap leaves.
function headroom(faction, channel) {
  const F = _resolveActor(faction); if (!F) return 0;
  const ff = F.flags?.[MOD_ID] || {}; const k = String(channel || "").toLowerCase();
  const bank = Number(ff.opBank?.[k] || 0);
  let cap = Number(ff.opCaps?.[k]);
  if (!Number.isFinite(cap) || cap <= 0) { const band = [50, 70, 90, 110, 130]; const t = Math.max(0, Math.min(4, Math.floor(Number(ff.tier ?? F.system?.tier ?? 0) || 0))); cap = band[t]; }
  return Math.max(0, Math.floor(cap - bank));
}

async function sell(faction, matKey, qtyWanted, opts = {}) {
  const F = _resolveActor(faction);
  if (!F || !matKey) return { ok: false, error: "missing actor or key" };
  const have = qty(F, matKey);
  if (have <= 0 || Math.floor(Number(qtyWanted) || 0) <= 0) return { ok: false, error: have <= 0 ? "nothing to sell" : "bad quantity", have };
  const price = await unitPrice(F, matKey); const mult = Number(opts.priceMult) > 0 ? Number(opts.priceMult) : 1;
  // the channel: the family's home at full price, any other at OFF_CHANNEL_FRACTION (owner ruling 2026-09-21)
  const channel = String(opts.channel || price.channel).toLowerCase(); const home = channel === price.channel; const chanFrac = home ? 1 : MATERIAL_MARKET.OFF_CHANNEL_FRACTION;
  const unitMarks = Math.max(1, Math.round(price.sell * mult * chanFrac));
  let n = Math.min(have, Math.max(0, Math.floor(Number(qtyWanted) || 0))); let clamped = 0;
  if (!opts.allowOvercap) { const room = headroom(F, channel); const fit = Math.floor(room / unitMarks); if (fit < n) { clamped = n - fit; n = fit; } }
  if (n <= 0) return { ok: false, error: clamped ? `the ${channel} bank is at its cap — nothing fits` : "nothing to sell", have, clamped };
  const marks = unitMarks * n;
  const op = game.bbttcc?.api?.op; if (!op?.commit) return { ok: false, error: "OP api unavailable" };
  const name = (_readMap(F)[matKey]?.name) || matKey;
  const res = await op.commit(F.id, { [channel]: marks }, { source: "stockpile-sell", label: `Sold ${n}× ${name} → ${channel}`, note: `${n} × ${unitMarks} marks (retail ${price.retail}, T${price.tier}${mult !== 1 ? `, ×${mult}` : ""}${home ? "" : `, off-channel ×${MATERIAL_MARKET.OFF_CHANNEL_FRACTION}`})`, allowOvercap: !!opts.allowOvercap });
  if (res && res.ok === false) return { ok: false, error: res.error || "commit refused", marks };
  const adj = await adjust(F, matKey, -n, { name });
  try { await ChatMessage.create({ speaker: { alias: F.name }, content: `<div class="bbttcc-stockpile-sale" style="border-left:3px solid #d4a72c;padding:.35em .6em;background:rgba(212,167,44,.08);">💰 <b>${foundry.utils.escapeHTML(F.name)}</b> sold <b>${n}× ${foundry.utils.escapeHTML(name)}</b> for <b>${marks} marks</b> of ${channel[0].toUpperCase() + channel.slice(1)}${home ? "" : " (off-channel)"} <span style="opacity:.7;">(${unitMarks}/unit · retail ${price.retail})</span>.</div>` }); } catch (_eC) {}
  try { Hooks.callAll("bbttcc:stockpile:sold", { factionId: F.id, materialKey: matKey, qty: n, marks, unit: price.sell }); } catch (_e) {}
  return { ok: true, qty: n, clamped, channel, home, marks, unit: unitMarks, retail: price.retail, remaining: adj?.after ?? qty(F, matKey) };
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
    _registerRelay();
    root.sell = sell;
    root.unitPrice = unitPrice;
    root.SELL_FRACTION = SELL_FRACTION;
    root.headroom = headroom;
    root.MARKET = MATERIAL_MARKET; root.MATERIAL_FAMILY = MATERIAL_FAMILY; root.familyOf = familyOf; root.channelFor = channelFor;
    root.depositFromCharacter = depositFromCharacter;
    root.withdrawToCharacter = withdrawToCharacter;
    console.log(TAG, "Stockpile API ready → game.bbttcc.api.factions.stockpile");
  } catch (e) {
    console.warn(TAG, "stockpile API wiring failed", e);
  }
}

Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}
