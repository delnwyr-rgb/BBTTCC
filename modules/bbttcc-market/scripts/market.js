
// modules/bbttcc-market/scripts/market.js
// Bad Eden Market — Procurement Console (MVP)
//
// - Spend Faction Economy OP to purchase:
//   - gear (Item UUID → character inventory)
//   - rig (registry payload → flags.bbttcc-factions.rigs[] via factions API)
//   - facility (payload → hex.flags.bbttcc-territory.facilities.primary)
//   - hex_asset (payload → hex.flags.bbttcc-territory.assets[])
//
// This module is intentionally GM-driven and avoids combat/HP hooks.

const MODULE_ID = "bbttcc-market";
const MOD_FACTIONS = "bbttcc-factions";
const MOD_TERR = "bbttcc-territory";

const log  = (...a) => console.log(`[${MODULE_ID}]`, ...a);
const warn = (...a) => console.warn(`[${MODULE_ID}]`, ...a);

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* ===================== Economic Horizon (Faction Tier → Rarity Horizon) =====================

  Owner ruling 2026-10-02 (numeric faction tier → horizon):
  - Tier 0–1 → Uncommon
  - Tier 2   → Rare
  - Tier 3   → Very Rare
  - Tier 4   → Legendary
  (Legacy lettered data still reads A → Uncommon, B → Rare, C → Very Rare.)
  - Artifact → never purchasable (discovery only)

  Catalog entries MAY declare `rarity`, but for Gear we also auto-resolve rarity from the
  underlying dnd5e Item referenced by `entry.uuid` (system.rarity).
*/

const RARITY_RANK = {
  common: 1,
  uncommon: 2,
  rare: 3,
  very_rare: 4,
  legendary: 5,
  artifact: 6
};

function _tierToRarity(tier) {
  const t = Number(tier);
  if (!Number.isFinite(t) || t <= 0) return null;
  if (t === 1) return "uncommon";
  if (t === 2) return "rare";
  if (t === 3) return "very_rare";
  return "legendary"; // tier 4+
}

// "III" / "3" / 3 → 3 (RFI stamps tiers as Roman numerals; catalog fields may hold numbers).
function _tierInt(t) {
  if (t === null || t === undefined || t === "") return NaN;
  return { I: 1, II: 2, III: 3, IV: 4 }[String(t).trim().toUpperCase()] ?? Number(t);
}

function normalizeRarity(r) {
  const k = String(r || "common").trim().toLowerCase();
  return RARITY_RANK[k] ? k : "common";
}

function _normalizeExternalRarity(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "common";
  if (s === "common") return "common";
  if (s === "uncommon") return "uncommon";
  if (s === "rare") return "rare";
  if (s === "legendary") return "legendary";
  if (s === "artifact") return "artifact";
  // very rare variants
  if (s === "very_rare" || s === "very rare" || s === "very-rare" || s === "veryrare") return "very_rare";
  if (s.includes("very") && s.includes("rare")) return "very_rare";
  return "common";
}

function factionEconomicHorizon(factionActor) {
  // flags.bbttcc-factions.tier is a NUMBER 0–4 (read through the facts layer); this used to
  // compare it to the letters A/B/C, so every faction sat at Uncommon forever.
  // Owner ruling 2026-10-02: 0–1 → Uncommon, 2 → Rare, 3 → Very Rare, 4 → Legendary.
  const raw = factionActor?.getFlag?.(MOD_FACTIONS, "tier");
  const letter = String(raw ?? "").trim().toUpperCase();   // legacy lettered data
  if (letter === "C") return "very_rare";
  if (letter === "B") return "rare";
  if (letter === "A") return "uncommon";
  let tier = 0;
  try { const fx = game.bbttcc?.facts?.faction?.tier; tier = fx ? fx(factionActor) : Number(raw); } catch (_e) { tier = Number(raw); }
  if (!Number.isFinite(tier)) tier = 0;
  if (tier >= 4) return "legendary";
  if (tier === 3) return "very_rare";
  if (tier === 2) return "rare";
  return "uncommon";
}

function rarityDistance(entryRarity, horizonRarity) {
  return (RARITY_RANK[normalizeRarity(entryRarity)] - RARITY_RANK[normalizeRarity(horizonRarity)]);
}

function scaledEconomyCost(baseCost, distance) {
  const n = Number(baseCost ?? 0) || 0;
  if (distance <= 0) return 0;     // Standard Issue (within horizon)
  if (distance === 1) return n;
  if (distance === 2) return n * 2;
  return n * 4;                    // distance ≥ 3
}

// STANDARD ISSUE = the Tier I kit (owner tier convention: "T1 = chargen / standard issue").
// 2026-10-16 (owner: "even a Tier 3 forge facility frame that costs 2250 Econ marks, LOL"):
// until tonight EVERY gear row at or under the horizon was free, so a Tier 3 faction took
// 2250-mark Forge Facility Frames and 1350-mark Circuited lasers for nothing. Now only gear
// whose effective rarity sits at Uncommon or below (= Tier I on the ladder) is free within the
// horizon; tiered gear above that pays LIST PRICE within the horizon and strains ×2/×4 over it.
// Rigs / facilities / assets / actors were never free and still pay base within the horizon.
// 2026-10-17 (owner: "exempt frames and rigs in general from the freebie rule"): gear whose RFI frame
// is "vehicle" (every rig frame — Light Skiff, Landspeeder, Recon Drone …) is never Standard Issue
// either; a hull always costs its hull price. `docFrame` = resolveItemFlagPrice().docFrame.
const NEVER_FREE_FRAMES = new Set(["vehicle", "rig"]);
function isStandardIssue(kind, rarity, distance, docFrame = "") {
  return String(kind || "").toLowerCase() === "gear"
      && distance <= 0
      && !NEVER_FREE_FRAMES.has(String(docFrame || "").toLowerCase())
      && (RARITY_RANK[normalizeRarity(rarity)] <= RARITY_RANK.uncommon);
}
// The one cost rule every surface (list chip, buy dialog, purchase(), _chargeFor) must share.
function horizonEconCost(baseCost, distance, kind, rarity, docFrame = "") {
  const n = Number(baseCost ?? 0) || 0;
  if (isStandardIssue(kind, rarity, distance, docFrame)) return 0;
  if (distance <= 0) return n;            // within horizon, above the T1 kit: list price
  return scaledEconomyCost(n, distance);  // over the horizon: ×1 / ×2 / ×4
}

/**
 * Resolve the RFI item-flag price for a gear catalog entry, if present.
 * Returns null for non-gear entries or items without a stamped price.
 *
 * Wired into Phase 5 (Pricing Rubric, 2026-05-10). When present, this OVERRIDES
 * the legacy catalog `cost.economy` value — the canonical price now lives on
 * the item flag `flags.fourththing.rfi.item.price`. Catalog cost remains as a
 * fallback for entries that haven't been stamped yet.
 *
 * Shape:
 *   {
 *     marks:      number,    // total list, in marks (split sums to this)
 *     currency:   string,    // "auto" | "violence" | "nonlethal" | ... | "split"
 *     split:      object|null, // { violence: 200, intrigue: 100 } if split
 *     gmOverride: boolean,
 *     saleBack:   number,
 *     docFrame:   string     // frame (weapon/armor/tool/...) for "auto" resolution
 *   }
 */
async function resolveItemFlagPrice(entry) {
  try {
    const uuid = String(entry?.uuid || "").trim();
    if (!uuid) return null;
    const doc = await fromUuid(uuid);
    if (!doc) return null;

    // Item docs price at flags.fourththing.rfi.item.price (Phase 1).
    // Actor docs price at flags.fourththing.rfi.actor.price (Phase 8 — rigs /
    // facilities / bosses / bestiary). Both shapes are { marks, currency,
    // split?, gmOverride, saleBack }.
    let price, docFrame = "tool";
    if (doc.documentName === "Item") {
      price = foundry.utils.getProperty(doc, "flags.fourththing.rfi.item.price");
      docFrame = String(foundry.utils.getProperty(doc, "flags.fourththing.rfi.item.frame") || "tool");
    } else if (doc.documentName === "Actor") {
      price = foundry.utils.getProperty(doc, "flags.fourththing.rfi.actor.price");
      // actor "frame" is its bracket; treat as a sigil-ish for default currency
      // fallback (rigs/facilities/bosses always set explicit currency in the
      // seed macros, so the fallback is rarely exercised).
      docFrame = "rig";
    } else {
      return null;
    }
    if (!price || !Number.isFinite(Number(price.marks))) return null;
    // Bestiary creatures (2026-09-04 rubric): `marks`/`bounty` is what a faction
    // EARNS for resolving the creature; `hire` is what it PAYS to field it. The
    // market sells the hire. A boss (hire === null) is not for hire — priceless.
    let marks = Number(price.marks);
    if (doc.documentName === "Actor" && doc.flags?.fourththing?.rfi?.actor?.lineage) {
      marks = (price.hire === null || price.hire === undefined) ? -1 : Number(price.hire);
      if (!Number.isFinite(marks)) marks = -1;
    }
    return {
      marks,
      currency:   String(price.currency || "auto"),
      split:      (price.split && typeof price.split === "object") ? price.split : null,
      gmOverride: !!price.gmOverride,
      saleBack:   Number(price.saleBack) || 0,
      docFrame,
      docKind:    doc.documentName
    };
  } catch { return null; }
}

/**
 * Pool-aware OP spend. Takes a map of `{ pool: marksDelta }` (already negative)
 * and commits via the OP API. Replaces the economy-only `spendEconomyOP` for
 * pool-aware purchases; `spendEconomyOP` stays as a thin wrapper for backward
 * compat with non-RFI catalog entries.
 */
async function spendMarksByPools(factionId, deltasMap, meta = {}) {
  const total = Object.values(deltasMap).reduce((a, v) => a + (Number(v) || 0), 0);
  if (total === 0) return { ok: true, committed: true, cost: 0 };
  const opApi = game.bbttcc?.api?.op;
  if (!opApi?.commit) throw new Error("OP API not available (game.bbttcc.api.op.commit).");
  const res = await opApi.commit(factionId, deltasMap, {
    source: "market",
    label:  meta?.label || "Market Purchase",
    note:   meta?.note  || "",
    // Refunds restore a pre-purchase balance; if that balance was already
    // over cap, the engine's overcap-increase refusal must not eat the refund.
    ...(meta?.allowOvercap ? { allowOvercap: true } : {})
  });
  if (!res?.committed) return { ok: false, committed: false, underflow: res?.underflow ?? null };
  return { ok: true, committed: true, cost: Math.abs(total) };
}

async function resolveEntryRarity(entry) {
  // 1) Explicit rarity on the catalog entry wins (optional authoring)
  if (entry?.rarity) return normalizeRarity(_normalizeExternalRarity(entry.rarity));

  // 2) Gear: resolve from the referenced dnd5e Item (system.rarity), or fall
  // through to RFI tier flags on the source item (flags.rfi.item.tier).
  try {
    const kind = String(entry?.kind || "").toLowerCase();
    const uuid = String(entry?.uuid || "").trim();
    if (kind === "gear" && uuid) {
      const doc = await fromUuid(uuid);
      if (doc) {
        const sysR = foundry.utils.getProperty(doc, "system.rarity");
        const altR = foundry.utils.getProperty(doc, "system.traits.rarity") || foundry.utils.getProperty(doc, "flags.dnd5e.rarity");
        const raw = sysR || altR || "";
        const native = raw ? normalizeRarity(_normalizeExternalRarity(raw)) : null;
        // RFI tier → rarity (T1→uncommon, T2→rare, T3→very_rare, T4→legendary). Roman numerals supported.
        // 2026-10-16: the TIER IS A FLOOR, not a fallback. The Frikkin' Laser Blade Saber is stamped
        // Tier III but carries a legacy system.rarity of "uncommon", the Rad Laser Pistol / Circuited
        // Laser Pistol "common" — native rarity used to win outright, so Tier III/IV arms read as
        // Standard Issue at a Tier 0–1 horizon. Whichever of (native rarity, tier rarity) ranks
        // higher is the entry's rarity; list prices are untouched (RARITY_MULT still reads the item).
        const rfiTier = foundry.utils.getProperty(doc, "flags.fourththing.rfi.item.tier")
                     ?? foundry.utils.getProperty(doc, "flags.rfi.item.tier"); // legacy path
        const tierR = rfiTier ? _tierToRarity(_tierInt(rfiTier)) : null;
        if (native && tierR) return (RARITY_RANK[tierR] > RARITY_RANK[native]) ? tierR : native;
        if (native) return native;
        if (tierR) return normalizeRarity(tierR);
      }
    }
  } catch {}

  // 3) Non-gear: infer from declared tier-like fields (rig/facility/upgrades/assets)
  try {
    const kind = String(entry?.kind || "").toLowerCase();
    if (kind !== "gear") {
      const t =
        entry?.tier ??
        entry?.rigData?.tier ??
        entry?.facilityPatch?.tier ??
        entry?.patch?.tier ??
        entry?.rigData?.minTier ??
        entry?.facilityPatch?.minTier;
      const mapped = _tierToRarity(_tierInt(t));   // Roman numerals accepted here too (2026-10-16)
      if (mapped) return normalizeRarity(mapped);
    }
  } catch {}

  // 4) Default
  return "common";
}

/* ===================== SELL-BACK (owner ask 2026-10-17) =====================
   Gear in a character's inventory sells to the selected vendor for a % of list
   price set by the vendor faction's stance toward the selling faction. Not for
   sale: anything Standard Issue FOR THE SELLER (free kit is worth nothing),
   soulbound, artifacts, unpriced. Marks are credited to the seller faction's
   Economy bank FIRST; a refused credit (bank at cap) leaves the inventory alone.
*/
const SELL_RELAY = "market.sell";
const SELL_RATE_DEFAULT = { allied: 60, friendly: 50, neutral: 40, unfriendly: 25, hostile: 10, at_war: 0 };
const SELL_GEAR_TYPES = new Set(["weapon", "armor", "gear"]);

function _sellEnabled() {
  try { return game.settings.get(MODULE_ID, "sellBackEnabled") !== false; } catch { return true; }
}
function _sellRate(tier) {
  const def = SELL_RATE_DEFAULT[tier] ?? SELL_RATE_DEFAULT.neutral;
  try {
    const v = Number(game.settings.get(MODULE_ID, `sellRate_${tier}`));
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : def;
  } catch { return def; }
}
function _normName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

/** The faction that owns a vendor: explicit factionId, else a faction actor of the same name. */
function vendorFactionFor(vendor) {
  if (!vendor) return null;
  if (vendor.factionId) { const a = game.actors.get(vendor.factionId); if (a && isFactionActor(a)) return a; }
  const n = _normName(vendor.name);
  return n ? (allFactions().find(a => _normName(a.name) === n) || null) : null;
}

/** Stance of the vendor's faction toward the seller → { tier, rate, label, vendorFactionId, vendorFactionName }. */
function vendorStanceFor(vendor, faction) {
  const vf = vendorFactionFor(vendor);
  let tier = "neutral";
  if (vf && faction) {
    if (vf.id === faction.id) tier = "allied";
    else {
      try {
        const rel = game.bbttcc?.api?.factions?.relations;
        const t = String(rel?.get?.(vf, faction) || "");
        if (SELL_RATE_DEFAULT[t] !== undefined) tier = t;
      } catch {}
    }
  }
  const rate = _sellRate(tier);
  const tierLabel = tier.replace(/_/g, " ");
  const label = vf
    ? (faction ? (vf.id === faction.id ? `${vf.name}'s own market` : `${vf.name} is ${tierLabel} toward ${faction.name}`) : `${vf.name}'s market`)
    : "no faction ties (neutral)";
  return { tier, rate, label, vendorFactionId: vf?.id || "", vendorFactionName: vf?.name || "" };
}

/** Rarity of an owned Item doc — the same floor rule resolveEntryRarity uses for catalog gear. */
function resolveDocRarity(doc) {
  try {
    const sysR = foundry.utils.getProperty(doc, "system.rarity");
    const altR = foundry.utils.getProperty(doc, "system.traits.rarity") || foundry.utils.getProperty(doc, "flags.dnd5e.rarity");
    const raw = sysR || altR || "";
    const native = raw ? normalizeRarity(_normalizeExternalRarity(raw)) : null;
    const rfiTier = foundry.utils.getProperty(doc, "flags.fourththing.rfi.item.tier") ?? foundry.utils.getProperty(doc, "flags.rfi.item.tier");
    const tierR = rfiTier ? _tierToRarity(_tierInt(rfiTier)) : null;
    if (native && tierR) return (RARITY_RANK[tierR] > RARITY_RANK[native]) ? tierR : native;
    if (native) return native;
    if (tierR) return normalizeRarity(tierR);
  } catch {}
  return "common";
}

function isSellableGearItem(item) {
  if (!item || item.documentName !== "Item") return false;
  if (SELL_GEAR_TYPES.has(String(item.type || "").toLowerCase())) return true;
  // Anything the RFI item layer priced is gear for market purposes.
  return !!foundry.utils.getProperty(item, "flags.fourththing.rfi.item.price");
}

/**
 * What this vendor would pay for one unit of `item` sold by `faction`.
 * → { ok, reason, listMarks, rate, payout, qty, rarity, tier, bound, frame, stance }
 */
async function sellQuote(item, { faction = null, vendor = null } = {}) {
  const out = { ok: false, reason: "", listMarks: 0, rate: 0, payout: 0, qty: 1, rarity: "common", tier: "", bound: "free", frame: "tool", stance: null };
  if (!item) { out.reason = "No item"; return out; }
  const rfi = foundry.utils.getProperty(item, "flags.fourththing.rfi.item") || {};
  out.qty = Math.max(1, Number(item.system?.quantity) || 1);
  out.tier = rfi.tier ? String(rfi.tier) : "";
  out.bound = String(rfi.bound || rfi.price?.bound || "free");
  out.frame = String(rfi.frame || "tool");
  out.rarity = resolveDocRarity(item);
  if (out.rarity === "artifact") { out.reason = "Artifact — never for sale"; return out; }
  if (out.bound === "soulbound") { out.reason = "Soulbound — worthless to anyone else"; return out; }

  // List price: the stamped RFI price, else the system's rubric from tier + frame.
  let marks = Number(rfi.price?.marks);
  if (!Number.isFinite(marks)) {
    try {
      const pr = game.fourththing?.pricing;
      if (pr?.computeListPrice && out.tier) marks = Number(pr.computeListPrice({ tier: out.tier, frame: out.frame, bound: out.bound }));
    } catch {}
  }
  if (!Number.isFinite(marks) || marks < 0) { out.reason = "Unpriced — ask the GM"; return out; }
  out.listMarks = Math.round(marks);

  // Standard Issue FOR THE SELLER: free to them, so worth nothing to anyone.
  if (faction) {
    const distance = rarityDistance(out.rarity, factionEconomicHorizon(faction));
    if (isStandardIssue("gear", out.rarity, distance, out.frame)) { out.reason = "Standard Issue — free to you, worthless to them"; return out; }
  }

  const stance = vendorStanceFor(vendor, faction);
  out.stance = stance;
  out.rate = stance.rate;
  if (!(stance.rate > 0)) { out.reason = `${vendor?.name || "The vendor"} won't deal with ${faction?.name || "you"}`; return out; }
  out.payout = Math.floor(out.listMarks * stance.rate / 100);
  if (out.payout <= 0) { out.reason = "Worth less than a mark"; return out; }
  out.ok = true;
  return out;
}

/**
 * Sell `qty` units of an inventory item to a vendor. Player seats relay to the GM
 * (gmExec "market.sell", re-validated there). Credit first, then hand over the goods.
 */
async function sell({ itemUuid, factionId, vendorId, qty = 1, note = "", _relayed = false } = {}) {
  if (!game.user?.isGM) {
    const gx = game.bbttcc?.api?.gmExec;
    if (gx && typeof gx.call === "function") {
      return gx.call(SELL_RELAY, { itemUuid, factionId, vendorId, qty, note }, { timeoutMs: 30000 });
    }
  }
  if (!_sellEnabled()) throw new Error("Selling is switched off in the market settings.");
  const faction = game.actors.get(String(factionId || ""));
  if (!faction || !isFactionActor(faction)) throw new Error("Seller faction not found.");
  const vendor = _vendorsArray().map(_normalizeVendor).find(v => v.id === String(vendorId || ""));
  if (!vendor) throw new Error("Vendor not found.");
  const item = await fromUuid(String(itemUuid || "")).catch(() => null);
  if (!item || item.documentName !== "Item" || !item.parent) throw new Error("Item not found in an inventory.");
  if (!isSellableGearItem(item)) throw new Error(`${item.name} is not gear.`);

  const quote = await sellQuote(item, { faction, vendor });
  if (!quote.ok) throw new Error(quote.reason || `${item.name} cannot be sold here.`);
  const n = Math.max(1, Math.min(quote.qty, Math.round(Number(qty) || 1)));
  const payout = quote.payout * n;

  // 1) Credit first — a refused credit (Economy bank at cap) leaves the inventory untouched.
  const credit = await spendMarksByPools(faction.id, { economy: payout }, { label: `Market Sale: ${item.name}`, note: String(note || "") });
  if (!credit.ok) throw new Error(`${faction.name}'s Economy bank refused the credit (at its cap?). Spend some marks first.`);

  // 2) Hand over the goods — peel units off a stack, delete the last one.
  const owner = item.parent;
  const itemName = item.name, itemImg = item.img, itemUuidStr = String(itemUuid);
  if (quote.qty > n) await item.update({ "system.quantity": quote.qty - n });
  else await item.delete();

  // 3) Receipt (faction war log) + 4) GM whisper.
  const receipt = {
    ts: Date.now(), type: "market_sale",
    summary: `Sold: ${itemName}${n > 1 ? ` ×${n}` : ""} to ${vendor.name} (+${payout} marks at ${quote.rate}%)`,
    vendorId: vendor.id, vendorFactionId: quote.stance?.vendorFactionId || "",
    itemUuid: itemUuidStr, itemName, qty: n, listMarks: quote.listMarks, rate: quote.rate,
    stance: quote.stance?.tier || "neutral", payout, rarity: quote.rarity, sellerActorId: owner.id,
    note: String(note || "").trim()
  };
  await appendFactionReceipt(faction, receipt);
  try {
    const gmIds = (game.users ?? []).filter(u => u.isGM).map(u => u.id);
    if (gmIds.length) {
      await ChatMessage.create({
        whisper: gmIds,
        speaker: { alias: "Bad Eden Market" },
        content: `<p><b>Market Sale</b></p>
          <p><b>${esc(owner.name)}</b> (${esc(faction.name)}) sold <b>${esc(itemName)}</b>${n > 1 ? ` ×${n}` : ""} to <b>${esc(vendor.name)}</b> for <code>+${payout} marks</code>.</p>
          <p class="bbttcc-muted">List ${quote.listMarks} × ${quote.rate}% — ${esc(quote.stance?.label || "neutral")}. Rarity: <code>${esc(quote.rarity)}</code></p>
          ${receipt.note ? `<p class="bbttcc-muted">Note: ${esc(receipt.note)}</p>` : ""}`
      });
    }
  } catch {}
  return { ok: true, payout, qty: n, receipt, itemName, itemImg };
}

function rarityLabelFor(r) {
  const k = normalizeRarity(r);
  if (k === "very_rare") return "Very Rare";
  return k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
}

function chipSpecFor(rarity, horizon, distance, baseCost, econCost, poolLabel = "Econ") {
  // Returns { text, title, style }
  // poolLabel: short label of the native pool (Viol/NonL/Intr/Econ/Soft/Dip)
  // or "Split" for multi-pool items. Phase 5.
  const rLab = rarityLabelFor(rarity || "common");
  const hLab = rarityLabelFor(horizon || "uncommon");
  const d = Number(distance || 0);
  const b0 = Number(baseCost || 0) || 0;
  const e0 = Number(econCost || 0) || 0;
  const pLab = String(poolLabel || "Econ");

  if (String(rarity) === "artifact") {
    return {
      text: "Artifact",
      title: "Artifact (discovery only)",
      style: "border-color:rgba(148,163,184,.40);background:rgba(100,116,139,.15);letter-spacing:.06em;text-transform:uppercase;"
    };
  }

  if (d <= 0) {
    // Free = Standard Issue (the Tier I kit). Within the horizon but tiered above it = list price,
    // its own chip so a 2250-mark frame never wears the Standard Issue badge (2026-10-16).
    if (!e0) return {
      text: "Standard Issue",
      title: `Rarity ${rLab} (≤ Horizon ${hLab}) • Tier I kit — free`,
      style: "border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.10);"
    };
    return {
      text: `Within Horizon • ${pLab} ${e0}`,
      title: `Rarity ${rLab} (≤ Horizon ${hLab}) • list price ${b0}`,
      style: "border-color:rgba(56,189,248,.35);background:rgba(56,189,248,.10);"
    };
  }

  let mult = 1;
  if (d === 2) mult = 2;
  else if (d >= 3) mult = 4;

  const b = b0;
  const e = e0;
  const multLabel = (mult === 1) ? "x1" : (mult === 2) ? "x2" : "x4";

  const style =
    (mult >= 4) ? "border-color:rgba(239,68,68,.40);background:rgba(239,68,68,.10);" :
    (mult >= 2) ? "border-color:rgba(249,115,22,.35);background:rgba(249,115,22,.10);" :
                 "border-color:rgba(250,204,21,.35);background:rgba(250,204,21,.10);";

  return {
    text: `Strains (${multLabel}) • ${pLab} ${e}`,
    title: `Rarity ${rLab} vs Horizon ${hLab} (Δ ${d}) • Base ${b} → ${e}`,
    style
  };
}

function isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(MOD_FACTIONS, "isFaction")) return true;
    const typ = foundry.utils.getProperty(a, "system.details.type.value");
    if (typ === "faction") return true;
  } catch {}
  return false;
}

function isCharacterActor(a) {
  try { return a?.type === "character"; } catch { return false; }
}

function allFactions() {
  return game.actors?.contents?.filter?.(isFactionActor) ?? [];
}

function allCharacters() {
  return game.actors?.contents?.filter?.(isCharacterActor) ?? [];
}

/** The steward's Domain (ruling 16, 2026-10-18): the faction actor this character is linked to.
 *  Link order = the system's own (bbttcc-bridge ftResolveFactionLink): flags.bbttcc-factions.factionId →
 *  system.faction.id → the faction whose roster lists the character. One steward per Domain is the rule. */
function domainOf(actor) {
  try {
    if (!actor) return null;
    const direct = String(actor.getFlag?.(MOD_FACTIONS, "factionId") || foundry.utils.getProperty(actor, "system.faction.id") || foundry.utils.getProperty(actor, "system.system.faction.id") || "").replace(/^Actor\./, "");
    const byId = direct ? game.actors.get(direct) : null;
    if (byId && isFactionActor(byId)) return byId;
    const ids = new Set([actor.id, actor.uuid]);
    for (const f of allFactions()) {
      const roster = f.getFlag?.(MOD_FACTIONS, "roster") || [];
      for (const e of (Array.isArray(roster) ? roster : [])) {
        const k = typeof e === "string" ? e : String(e?.uuid || e?.id || "");
        if (ids.has(k) || ids.has(k.replace(/^Actor\./, ""))) return f;
      }
    }
  } catch (_e) {}
  return null;
}

function esc(s) {
  try { return foundry.utils.escapeHTML(String(s ?? "")); } catch { return String(s ?? ""); }
}

function _safeJsonParse(txt, fallback) {
  try { return JSON.parse(txt); } catch { return fallback; }
}

function _clamp0(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? Math.max(0, x) : 0;
}

function kindLabel(k) {
  const key = String(k || "").toLowerCase();
  if (key === "gear") return "Gear";
  if (key === "rig") return "Rig";
  if (key === "facility") return "Facility";
  if (key === "hex_asset") return "Hex Asset";
  if (key === "rig_upgrade") return "Rig Upgrade";
  if (key === "facility_upgrade") return "Facility Upgrade";
  if (key === "actor") return "Actor (Rig/Boss/NPC)";
  if (key === "contract") return "Contract (crew / association)";
  return "Thing";
}

function costLabel(cost) {
  // Catalog costs are MARKS (authored in marks since 2026-09-06; legacy OP rows migrated ×10 at ready).
  const c = cost && typeof cost === "object" ? cost : {};
  const econ = Number(c.economy ?? 0) || 0;
  const parts = [];
  if (econ) parts.push(`Econ ${Math.round(econ)} marks`);
  const rest = Object.entries(c).filter(([k,_]) => k !== "economy").map(([k,v]) => `${k} ${Math.round(Number(v) || 0)} marks`);
  return parts.concat(rest).join(" · ") || "0";
}

// The 9 canonical OP pool keys (matches the bbttcc-core bridge keys array and
// the op-engine bank normalization). openBuyConfirmDialog iterates these for
// the pay-from picker + balance snapshot; op.commit accepts deltas on any of
// them. Native pricing (rfi-pricing v1) only ever assigns the first six as an
// item's native pool, but any bank pool can foot the bill at ×1.5 friction.
const OP_POOLS = ["violence", "nonlethal", "intrigue", "economy", "softpower", "diplomacy", "logistics", "culture", "faith"];

// Short labels for the canonical OP pools (Phase 5). Matches the picker
// labels in rfi-pricing.js but abbreviated for tight market UI surfaces.
const POOL_SHORT_LABEL = {
  economy:   "Econ",
  violence:  "Viol",
  nonlethal: "NonL",
  intrigue:  "Intr",
  softpower: "Soft",
  diplomacy: "Dip",
  logistics: "Logi",
  culture:   "Cult",
  faith:     "Faith"
};
function poolShortLabel(k) { return POOL_SHORT_LABEL[String(k || "").toLowerCase()] ?? String(k || "Econ"); }

/**
 * Pool-aware cost label. Used by row prep (static "Cost: …" text) and chip
 * decoration. Marks-denominated for flag-priced items; falls back to legacy
 * OP-denominated catalog label otherwise.
 *
 *   flagPrice present, single pool   → "Viol 50 marks"
 *   flagPrice present, split         → "Split: Viol 200 + Intr 100"
 *   no flagPrice                     → legacy "Econ N" (catalog OP)
 */
function costLabelForEntry(entry, flagPrice) {
  if (flagPrice?.split && Object.keys(flagPrice.split).length) {
    const parts = Object.entries(flagPrice.split)
      .filter(([_, v]) => Number(v) > 0)
      .map(([k, v]) => `${poolShortLabel(k)} ${v}`);
    return `Split: ${parts.join(" + ")}`;
  }
  if (flagPrice && Number.isFinite(Number(flagPrice.marks))) {
    if (Number(flagPrice.marks) < 0) return "Priceless";
    const pricing = game.fourththing?.pricing;
    const pool = (!flagPrice.currency || flagPrice.currency === "auto")
      ? (pricing?.defaultCurrencyForFrame?.(flagPrice.docFrame) ?? "economy")
      : flagPrice.currency;
    return `${poolShortLabel(pool)} ${flagPrice.marks} marks`;
  }
  return costLabel(entry?.cost);
}


function _uuidish(v) {
  const s = String(v || "");
  return s.includes("Compendium.") || s.startsWith("Actor.") || s.startsWith("Item.") || s.startsWith("Scene.") || s.startsWith("Folder.") || s.startsWith("JournalEntry.") || s.startsWith("RollTable.");
}

function _makeId(prefix="id") {
  return `${prefix}-${Math.random().toString(36).slice(2,8)}-${Date.now().toString(36)}`;
}

function _vendorsArray() {
  const v = game.settings.get(MODULE_ID, "vendors") || [];
  return Array.isArray(v) ? v : [];
}

function _catalogArray() {
  const c = game.settings.get(MODULE_ID, "catalog") || [];
  return Array.isArray(c) ? c : [];
}

function _normalizeVendor(v) {
  const id = String(v?.id || _makeId("vendor"));
  const tags = Array.isArray(v?.tags) ? v.tags : String(v?.tags || "").split(",").map(s=>s.trim()).filter(Boolean);
  const active = (v?.active === false) ? false : true;
  // factionId (2026-10-17): the faction that OWNS this market — its stance toward the
  // seller sets the sell-back rate. Empty = no ties (neutral); resolved by name as a fallback.
  const factionId = String(v?.factionId || "");
  return { id, name: String(v?.name || id), blurb: String(v?.blurb || ""), tags: tags.map(t=>String(t)), active, factionId };
}


import "./contracts.js";   // ruling 15 (2026-10-18): hired crews / associations — game.bbttcc.api.contracts

function _normalizeEntry(e) {
  const id = String(e?.id || _makeId("entry"));
  const kind = String(e?.kind || "gear");
  const costObj = (e?.cost && typeof e.cost === "object") ? e.cost : { economy: Number(e?.econ ?? e?.cost ?? 0) || 0 };
  // Preserve-first: spread the source entry so fields this normalizer doesn't
  // model (rarity, tier, future authoring keys) survive the whole-catalog
  // re-normalization done by editor save/add/dup/del/import. Known fields are
  // then overwritten with their normalized forms.
  const out = {
    ...((e && typeof e === "object") ? e : {}),
    id,
    vendorId: String(e?.vendorId || ""),
    kind,
    name: String(e?.name || id),
    blurb: String(e?.blurb || ""),
    cost: { ...costObj, economy: Number(costObj.economy ?? 0) || 0 }
  };
  if (kind === "gear") out.uuid = String(e?.uuid || "");
  if (kind === "actor") out.uuid = String(e?.uuid || "");
  if (kind === "rig") out.rigData = e?.rigData || {};
  if (kind === "facility") out.facilityPatch = e?.facilityPatch || {};
  if (kind === "hex_asset") out.asset = e?.asset || { key:"", label:"" };
  if (kind === "rig_upgrade" || kind === "facility_upgrade") out.patch = e?.patch || {};
  if (kind === "contract") out.contract = { family: String(e?.contract?.family || "crew"), docId: String(e?.contract?.docId || ""), pack: String(e?.contract?.pack || ""), turns: Math.max(1, Number(e?.contract?.turns) || 3) };
  return out;
}

function _entryPayloadString(e) {
  const kind = String(e?.kind || "");
  if (kind === "gear") return String(e?.uuid || "");
  if (kind === "actor") return String(e?.uuid || "");
  if (kind === "rig") return JSON.stringify(e?.rigData || {}, null, 2);
  if (kind === "facility") return JSON.stringify(e?.facilityPatch || {}, null, 2);
  if (kind === "hex_asset") return JSON.stringify(e?.asset || {}, null, 2);
  if (kind === "rig_upgrade" || kind === "facility_upgrade") return JSON.stringify(e?.patch || {}, null, 2);
  if (kind === "contract") return JSON.stringify(e?.contract || {}, null, 2);
  return "";
}

/* ===================== Help / tooltip dictionary (central registry) =====================

   Registered into game.bbttcc.help (bbttcc-core) under appKey "market" at ready.
   Consumed three ways:
     - templates:   data-tooltip="{{bbttccTip 'market' '<key>'}}"
     - JS DOM:      game.bbttcc.help.tip("market", "<key>")  (horizon chips, buy dialog)
     - tours:       inert data-tour="market.<key>" anchors use the same keys.
   Style (player-facing, Dave 2026-10-19: "super simplify this for players"): one plain sentence. No pricing math, no pool names, no OP.
   The catalog-editor tips below stay GM-detailed.
*/
const MARKET_TIPS = {
  // ---- Market app (player-facing) ----
  context:   "Who is buying, and where it lands. Pick the vendor and your Domain; pick a character for gear.",
  vendor:    "Which market you are browsing. You see the ones the GM has opened.",
  faction:   "Your Domain pays. One treasury, in marks.",
  character: "Who gets the gear. It lands in their inventory.",
  hex:       "Where a facility or hex asset gets delivered. Gear and rigs ignore this.",
  deliveryFee: "The haulers' fee for bringing it out there. Dangerous ground costs more; your own well-kept holdings cost least.",
  note:      "A note for the receipt. Why, or for whom.",
  manage:    "Manage Catalogs — GM-only editor for vendors and their catalog entries. Add or rename markets, toggle player visibility, drag-drop items in, set costs.",
  catalog:   "What this vendor has. The price on each row is what your Domain pays.",
  search:    "Type to find it.",
  treasury:  "What your Domain has to spend.",
  tabs:      "Sort the stock by what it is.",
  costBand:  "Filter by price. Standard Issue is free.",
  affordOnly: "Hide what you can't afford right now.",
  category:  "Filter by kind.",
  sort:      "Sort by name or by tier.",
  openDoc:   "Open the item and read it before you spend.",
  cost:      "The price you pay.",
  chip:      "Gear cost is based on both the item and the power of your Domain. Some stuff is free because you're just that cool.",
  profChip:  "Untrained — this character has no rank in the skill this needs. You can still buy it; you just won't be good with it yet.",
  buy:       "Buy needs no explanation. Why did you even hover over this?",
  payFromPool: "Which pool pays. The right pool pays list price; a wrong one pays half again.",
  splitPay:  "This price is paid from more than one pool.",

  // ---- Catalog editor (GM-facing) ----
  editorVendor:  "Vendor — which market's catalog you are editing. The vendor fields and every entry row below belong to this vendor.",
  vendorAdd:     "Add Vendor — creates a new market ('New Vendor') and selects it, saved immediately. New markets start Active (player-visible); rename and stock it, then Save.",
  entryAdd:      "Add Entry — prepends a blank gear entry (Economy cost 10 marks) to this vendor's catalog, saved immediately. Fill in its fields, then hit Save to persist the edits.",
  vendorDel:     "Delete Market — removes the selected vendor from the vendor list.",
  save:          "Save — writes the vendor fields and every entry row on screen into the world settings. Field edits are NOT persisted until you Save; add / duplicate / delete / drop-import actions save on their own.",
  vendorActive:  "Active — player-visibility switch. Unchecked, this market is hidden from the player Market app entirely (the GM still sees it, marked '(inactive)'). Stage a market before opening it, or close one narratively.",
  vendorName:    "Name — the market's display name, shown in every vendor picker.",
  vendorBlurb:   "Blurb — one line of flavor for this market. Informational only.",
  vendorTags:    "Tags — comma-separated labels stored on the vendor. Informational metadata (readable via the market API); no mechanical effect.",
  vendorFaction: "Owning Domain — the Domain this market belongs to. Its stance toward the selling faction (relations) sets the sell-back rate: allied / friendly / neutral / unfriendly / hostile / at war, each a % of list price in module settings. Empty = no ties (neutral); a faction whose name matches the vendor's is used automatically.",
  sell:          "Sell — the ↺ Sell tab lists the Buyer Character's gear with what THIS vendor pays: list price × the stance rate. Not sellable: anything that is Standard Issue for your faction (the Tier I kit is free to you, so it is worthless to them), soulbound items, artifacts, unpriced items. Marks land in the Buyer Domain's Economy bank; a bank at its cap refuses the sale. Stacks sell by the unit.",
  sellRate:      "Sell-back rate — what the vendor pays as a % of list price, by the vendor Domain's stance toward you: allied 60 · friendly 50 · neutral 40 · unfriendly 25 · hostile 10 · at war refuses (defaults; GM tunes in module settings). Your own faction's market pays the allied rate.",
  dropzone:      "Drop zone — drag Items or whole Folders from the sidebar or a compendium here. Each item becomes a Gear entry with its UUID prefilled and a default cost of 1 Economy OP, saved immediately.",
  editorEntries: "Entries — every catalog row this vendor stocks. Edit fields inline (then Save), or use the row buttons to duplicate / delete.",
  entryName:     "Name — the entry's display name in the player catalog (independent of the underlying item's own name).",
  entryKind:     "Kind — what the purchase delivers. gear → item copy to the buyer character; rig → new rig on the buying faction; facility → merged onto the delivery hex's primary facility; hex_asset → appended to the hex's asset list; rig_upgrade / facility_upgrade → JSON patch merged onto an existing rig / the hex facility; actor → clones a prebuilt Actor (rig/boss/NPC) into the world, assigned to the buying faction; contract → hires a Crew / Occult Association for the Buyer Character for N turns ({family, docId, pack, turns}).",
  entryCost:     "Economy Cost — the base price, in Economy MARKS (whole numbers). For gear whose item carries a stamped RFI flag price (flags.fourththing.rfi.item.price), the flag price overrides this number. The final charge is scaled by the buyer's Economic Horizon (×1/×2/×4 over-horizon; Standard Issue gear is free).",
  entryBlurb:    "Blurb — one line of flavor shown under the entry in the player catalog.",
  entryPayload:  "Payload — what actually gets delivered. Gear / actor: the source document UUID. Rig: the rigData JSON. Facility: the facilityPatch JSON. Hex asset: {key, label} JSON. Upgrades: a JSON patch (rig upgrades can pick their target via patch.target rigId / name / latest).",
  entryDup:      "Duplicate — clones this entry (name suffixed '(Copy)') to the top of the catalog, saved immediately.",
  entryDel:      "Delete — removes this entry from the catalog immediately. No confirmation."
};

// data-tooltip attribute snippet for JS-built HTML strings (buy-confirm dialog).
// Guarded: bbttcc-core may be disabled, in which case this renders nothing.
function _tipAttr(key) {
  const t = game.bbttcc?.help?.tip?.("market", key) || "";
  return t ? ` data-tooltip="${esc(t)}"` : "";
}

/* ===================== Settings: vendors + catalogs ===================== */

const DEFAULT_VENDORS = [
  {
    id: "mall-of-forgotten-yesterdays",
    name: "Mall of Forgotten Yesterdays",
    blurb: "A temple of consumer ghosts. The lights still hum.",
    tags: ["mall","gear","oddities"],
    active: true
  },
  {
    id: "furriers-fixit-farm",
    name: "Furrier's Fixit Farm",
    blurb: "Repair cult, salvage orchard, and a surprisingly good coffee cart.",
    tags: ["repair","rigs","facilities"],
    active: true
  }
];

// Minimal starter catalog. Replace these UUIDs with your real compendium UUIDs.
const DEFAULT_CATALOG = [
  {
    id: "starter-medkit",
    vendorId: "mall-of-forgotten-yesterdays",
    kind: "gear",
    name: "Field Medkit (Surplus)",
    blurb: "Bandages, syringes, clean-ish gloves. Keeps you from dying of dumb.",
    uuid: "", // Compendium.x.y.Item.<id>
    cost: { economy: 10 }
  },
  {
    id: "starter-rig-war",
    vendorId: "furriers-fixit-farm",
    kind: "rig",
    name: "War Rig (Template)",
    blurb: "A bare chassis with attitude. Configure after purchase.",
    rigData: {
      name: "New Rig",
      type: "war-rig",
      hitTrack: { max: 10, current: 10 },
      damageStep: 0,
      mobilityTags: [],
      raidBonuses: { defense: 0 },
      passiveBonuses: [],
      turnEffectsRaw: []
    },
    cost: { economy: 30 }
  },
  {
    id: "starter-facility-bunker",
    vendorId: "furriers-fixit-farm",
    kind: "facility",
    name: "Bunker (Small)",
    blurb: "Walls. Doors. The feeling that the world can't reach you (it can).",
    facilityPatch: {
      version: "0.1",
      facilityType: "bunker",
      tier: 1,
      size: "small",
      structureDefenseRating: 3,
      hitTrack: ["light","heavy","breached","destroyed"],
      opModifiers: { violenceDefense: 1, faithDefense: 1 },
      raidBonuses: { defenderDcBonus: 1, attackerExtraOpCost: { violence: 1, logistics: 0 }, maxDefenderUnits: 2, notes: "" },
      travelEncounterEffects: { encounterTierAdjust: 0, hazardMitigation: ["shelter-from-weather"], description: "" },
      hazards: { radiation: 0, corruption: 0, instability: 0, notes: "" },
      hexBinding: { notes: "" },
      integration: { autoApplyRaidBonuses: true, autoApplyTurnEffects: true, turnEffects: [], resolutionHooks: {} }
    },
    cost: { economy: 40 }
  },
  {
    id: "hex-asset-workshop",
    vendorId: "furriers-fixit-farm",
    kind: "hex_asset",
    name: "Workshop Bay (Hex Asset)",
    blurb: "A place where tools exist and people argue about them.",
    asset: { key: "workshop_bay", label: "Workshop Bay" },
    cost: { economy: 20 }
  }

,
{
  id: "gear-xvli",
  vendorId: "mall-of-forgotten-yesterdays",
  kind: "gear",
  name: "Imported Item",
  blurb: "",
  uuid: "Compendium.bbttcc-master-content.items.Item.XvliX6HYw04Ao3A4",
  cost: { economy: 10 }
},
{
  id: "gear-hlvn",
  vendorId: "mall-of-forgotten-yesterdays",
  kind: "gear",
  name: "Imported Item",
  blurb: "",
  uuid: "Compendium.bbttcc-master-content.items.Item.HlvNlhDr9F2COugT",
  cost: { economy: 10 }
}
];

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "vendors", {
    name: "Vendors",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_VENDORS
  });

  game.settings.register(MODULE_ID, "catalog", {
    name: "Catalog",
    scope: "world",
    config: false,
    type: Object,
    default: DEFAULT_CATALOG
  });

  // One-time catalog unit migration flag (OP → marks, owner ruling 2026-09-06).
  game.settings.register(MODULE_ID, "catalogMarksMigrated", { scope: "world", config: false, type: Boolean, default: false });

  // Delivery freight (owner ask 2026-10-12, reframed same night): Furrier's Fixit
  // Farm — the Jackalope faction, Bad Eden's haulers — delivers facility / hex-asset
  // / facility-upgrade purchases. The RECEIVER pays, and the price follows the
  // danger of the delivery hex: how developed it is, and how hostile.
  game.settings.register(MODULE_ID, "deliveryFeeBase", {
    name: "Market: delivery fee base (marks)", hint: "Flat freight for a perfectly safe hex. Fee = base + per-danger × the hex's danger score (0–12).",
    scope: "world", config: true, type: Number, default: 10
  });
  game.settings.register(MODULE_ID, "deliveryFeePerDanger", {
    name: "Market: delivery fee per danger point (marks)", hint: "Added per danger point. Danger counts low development, no/hostile authority, wasteland/ruins, radiation, darkness, hostile modifiers, conditions, and the holder's stance toward the buyer.",
    scope: "world", config: true, type: Number, default: 5
  });
  game.settings.register(MODULE_ID, "deliveryFeePool", {
    name: "Market: delivery fee pool", hint: "Which faction OP pool pays the freight.",
    scope: "world", config: true, type: String, default: "economy",
    choices: { economy: "Economy", logistics: "Logistics", violence: "Violence", nonlethal: "Non-Lethal", intrigue: "Intrigue", softpower: "Soft Power", diplomacy: "Diplomacy", culture: "Culture", faith: "Faith" }
  });

  // Sell-back (owner ask 2026-10-17): gear sells for a % of list price set by the
  // vendor faction's stance toward the seller. Standard Issue (for the seller),
  // soulbound and artifacts never sell. Rates are world settings so the GM tunes
  // them without a deploy; proposed defaults 60/50/40/25/10/0.
  game.settings.register(MODULE_ID, "sellBackEnabled", {
    name: "Market: allow selling gear back", hint: "Shows the ↺ Sell tab. Gear sells at a % of list price by the vendor faction's stance toward the seller.",
    scope: "world", config: true, type: Boolean, default: true
  });
  for (const [tier, def] of Object.entries(SELL_RATE_DEFAULT)) {
    game.settings.register(MODULE_ID, `sellRate_${tier}`, {
      name: `Market: sell-back % when the vendor is ${tier.replace(/_/g, " ")}`,
      hint: tier === "at_war" ? "0 = the vendor refuses to trade with a faction it is at war with." : "Percent of list price the vendor pays a seller it holds at this stance.",
      scope: "world", config: true, type: Number, default: def, range: { min: 0, max: 100, step: 5 }
    });
  }

  game.settings.register(MODULE_ID, "lastContext", {
    name: "Market Context",
    scope: "client",
    config: false,
    type: Object,
    default: { vendorId: DEFAULT_VENDORS[0].id, factionId: "", characterId: "", hexUuid: "", q: "", kind: "", category: "", sort: "name", note: "", tab: "", costBand: "", affordOnly: false }
  });

  // Fallback {{bbttccTip}} helper so our templates render even when this
  // module's init runs before bbttcc-core's (or bbttcc-core is disabled —
  // a mustache with args and no helper would otherwise throw "Missing helper").
  // Delegates to the central registry at call time, so whichever module wins
  // the registration race, the lookup is identical.
  try {
    if (!Handlebars.helpers.bbttccTip) {
      Handlebars.registerHelper("bbttccTip", (appKey, key) => game.bbttcc?.help?.tip?.(appKey, key) ?? "");
    }
  } catch (e) { warn("bbttccTip fallback helper registration failed", e); }
});

/* ===================== Core purchase pipeline ===================== */

async function spendEconomyOP(factionId, econCost, meta = {}) {
  const n = Number(econCost ?? 0) || 0;
  if (!n) return { ok: true, committed: true, cost: 0 };

  const opApi = game.bbttcc?.api?.op;
  if (!opApi || typeof opApi.commit !== "function") throw new Error("OP API not available (game.bbttcc.api.op.commit).");

  // econCost is MARKS (catalog authored in marks since 2026-09-06; legacy OP catalogs are migrated ×10 at ready).
  const marksDelta = -Math.abs(Math.round(n));
  // Spending uses NEGATIVE deltas (world convention).
  const deltas = { economy: marksDelta };

  const res = await opApi.commit(factionId, deltas, {
    source: "market",
    label: meta?.label || "Market Purchase",
    note: meta?.note || ""
  });

  if (!res?.committed) {
    return { ok: false, committed: false, underflow: res?.underflow ?? null };
  }
  return { ok: true, committed: true, cost: n };
}

async function appendFactionReceipt(factionActor, receipt) {
  try {
    const cur = factionActor.getFlag(MOD_FACTIONS, "warLogs");
    const warLogs = Array.isArray(cur) ? foundry.utils.duplicate(cur) : [];
    warLogs.unshift(receipt);
    await factionActor.setFlag(MOD_FACTIONS, "warLogs", warLogs);
  } catch (e) {
    warn("appendFactionReceipt failed", e);
  }
}

async function deliverGearToCharacter(characterId, itemUuid, qty = 1) {
  if (!characterId) throw new Error("No character selected for gear delivery.");
  if (!itemUuid) throw new Error("No gear UUID set on this catalog entry.");

  const actor = game.actors.get(characterId);
  if (!actor) throw new Error("Character actor not found.");
  const src = await fromUuid(itemUuid);
  if (!src) throw new Error("Could not resolve gear UUID.");

  const data = src.toObject ? src.toObject() : foundry.utils.duplicate(src);
  delete data._id;
  data.system = data.system ?? {};
  // qty (dnd5e uses system.quantity)
  try {
    const q = Number(foundry.utils.getProperty(data, "system.quantity") ?? 1) || 1;
    foundry.utils.setProperty(data, "system.quantity", q * Math.max(1, Number(qty)||1));
  } catch {}

  // Coerce legacy dnd5e item types to fourththing-valid types BEFORE the
  // create call — the constructor rejects unknown types with a hard validation
  // error and the system's preCreateItem hook only fires on already-valid
  // documents. Reset the system block to an empty object since dnd5e fields
  // don't fit the fourththing schema; preserved RFI flags carry the meaning.
  const FT_TYPE_COERCE = {
    equipment: "gear", consumable: "gear", tool: "gear", loot: "gear", backpack: "gear"
  };
  if (FT_TYPE_COERCE[data.type]) {
    data.type   = FT_TYPE_COERCE[data.type];
    data.system = {};
  }

  // Stamp RFI item flags so the delivered copy is recognized as vendor-bought
  // gear (Inventory tab, not Manifestations). Preserves any tier/frame the
  // source already declared. Respects existing crafted-origin if the source
  // was authored as one (rare but possible for vendor-stocked manifestations).
  // Path: flags.fourththing.rfi.item — fourththing scope is the system id
  // (Foundry rejects flag scopes that aren't a registered system/module).
  data.flags = data.flags ?? {};
  data.flags.fourththing = data.flags.fourththing ?? {};
  data.flags.fourththing.rfi = data.flags.fourththing.rfi ?? {};
  data.flags.fourththing.rfi.item = data.flags.fourththing.rfi.item ?? {};
  if (data.flags.fourththing.rfi.item.origin !== "crafted") {
    data.flags.fourththing.rfi.item.origin = "vendor";
  }

  // Deliver through the system's stacking surface when available — identical
  // gear (loot/consumables) merges onto an existing ×N inventory line instead
  // of piling up duplicate rows (2026-08-27). Weapons, armor, and crafted
  // manifestations still land as individual rows (the stacker scopes itself).
  const stackApi = game.fourththing?.stack;
  if (typeof stackApi?.orCreate === "function") await stackApi.orCreate(actor, data);
  else await actor.createEmbeddedDocuments("Item", [data]);
  return true;
}

async function deliverRigToFaction(factionId, rigData) {
  const api = game.bbttcc?.api?.factions;
  if (!api || typeof api.addRig !== "function") throw new Error("Factions rig API not available (game.bbttcc.api.factions.addRig).");
  const rig = await api.addRig(factionId, rigData || {});
  return rig;
}

/**
 * Deliver an actor catalog entry (Phase 9, 2026-05-11).
 * Clones the source actor (pre-built rig / boss / NPC from a seed macro) into
 * the world as a new actor and assigns ownership to the buying faction (rigs
 * + bosses) or stamps the bestiary loyalty flag (NPCs). The original source
 * actor is untouched so the template remains reusable.
 *
 * Returns { clonedId, sourceUuid, type } for the receipt.
 */
async function deliverActorByUuid(factionId, sourceUuid) {
  if (!sourceUuid) throw new Error("No actor UUID set on this catalog entry.");
  const src = await fromUuid(sourceUuid);
  if (!src) throw new Error("Source actor UUID could not be resolved.");
  if (src.documentName !== "Actor") throw new Error(`UUID does not point to an Actor (got ${src.documentName}).`);

  // Clone source as a new world actor.
  const data = src.toObject ? src.toObject() : foundry.utils.duplicate(src);
  delete data._id;
  // Strip ownership permissions so the buyer becomes owner via standard flow.
  data.ownership = { default: 0 };

  // Assign faction ownership where the schema supports it.
  // rig accessor (2026-10-08): works on dnd5e vehicles too — rigs are owned via
  // rigs.setOwner on the CREATED actor below (the raw clone is system-shaped).
  const rigOwnerPending = !!(game.bbttcc?.rigs && (data.type === "rig" || (data.type === "vehicle" && data.flags?.["bbttcc-factions"]?.rig)));
  if (rigOwnerPending) {
    // deferred to setOwner after Actor.create
  } else if (data.type === "rig") {
    foundry.utils.setProperty(data, "system.identity.factionOwnerId", factionId);
  } else if (data.type === "boss") {
    foundry.utils.setProperty(data, "system.identity.factionId", factionId);
  } else if (data.type === "npc") {
    foundry.utils.setProperty(data, "system.faction.id", factionId);
    foundry.utils.setProperty(data, "system.faction.loyalty", 0);
  }

  // Tag the cloned actor with its source for audit + future "respawn" flows.
  foundry.utils.setProperty(data, "flags.fourththing.rfi.actor.sourceUuid", sourceUuid);
  foundry.utils.setProperty(data, "flags.fourththing.rfi.actor.acquiredAt", Date.now());

  const created = await Actor.create(data);
  if (rigOwnerPending && created && game.bbttcc?.rigs?.isRig(created)) {
    try { await game.bbttcc.rigs.setOwner(created, factionId); } catch (e) { console.warn("[bbttcc-market] rig setOwner failed", e); }
  }
  return { clonedId: created?.id ?? null, sourceUuid, type: data.type };
}


async function _getFactionRigsArray(factionActor) {
  const rigs = factionActor.getFlag(MOD_FACTIONS, "rigs");
  return Array.isArray(rigs) ? foundry.utils.duplicate(rigs) : [];
}

// Target rig for an upgrade: rigId / name when the entry names one (MUST match — a
// missing named rig is an error, never "the first rig"), else the first rig.
function _findRigIndex(rigs, target) {
  target = target || {};
  if (!Array.isArray(rigs) || !rigs.length) return -1;
  if (target.rigId || target.name) {
    let idx = -1;
    if (target.rigId) idx = rigs.findIndex(r => r?.rigId === target.rigId);
    if (idx < 0 && target.name) idx = rigs.findIndex(r => String(r?.name||"") === String(target.name));
    return idx;
  }
  return 0;
}

const _POOL_ALIAS = { soft_power: "softpower", "soft-power": "softpower", non_lethal: "nonlethal", "non-lethal": "nonlethal" };
function _normPool(k) { const s = String(k || "").trim().toLowerCase(); return _POOL_ALIAS[s] || s; }

async function applyRigUpgradePatch(factionId, patch, meta = {}) {
  const faction = game.actors.get(factionId);
  if (!faction) throw new Error("Faction not found.");

  const rigs = await _getFactionRigsArray(faction);
  if (!rigs.length) throw new Error("Faction has no rigs to upgrade.");

  const idx = _findRigIndex(rigs, patch?.target);
  if (idx < 0) throw new Error("The upgrade's target rig was not found on this faction.");

  // Merge only the patch body — never the `target` selector wrapper.
  let body = patch?.patch;
  if (!body) { body = foundry.utils.duplicate(patch || {}); delete body.target; }
  const cur = rigs[idx] || {};
  const next = foundry.utils.mergeObject(foundry.utils.duplicate(cur), foundry.utils.duplicate(body), { inplace:false, overwrite:true });
  rigs[idx] = next;
  await faction.setFlag(MOD_FACTIONS, "rigs", rigs);

  return { rigIndex: idx, rigId: next?.rigId || null };
}

async function deliverFacilityToHex(hexUuid, facilityPatch) {
  if (!hexUuid) throw new Error("Facility delivery requires a hexUuid.");
  const hex = await fromUuid(hexUuid);
  if (!hex) throw new Error("Could not resolve hexUuid for facility delivery.");

  const tf = foundry.utils.duplicate(hex.flags?.[MOD_TERR] ?? {});
  const facilitiesRoot = tf.facilities ?? {};
  const currentPrimary = facilitiesRoot.primary ?? {};
  const nextPrimary = foundry.utils.mergeObject(foundry.utils.duplicate(currentPrimary), foundry.utils.duplicate(facilityPatch || {}), { inplace:false, overwrite:true });

  const nextFacilities = foundry.utils.duplicate(facilitiesRoot);
  nextFacilities.primary = nextPrimary;

  await hex.update({ [`flags.${MOD_TERR}.facilities`]: nextFacilities });
  return true;
}


async function applyFacilityUpgradePatch(hexUuid, patch) {
  if (!hexUuid) throw new Error("Facility upgrade requires a hexUuid.");
  const hex = await fromUuid(hexUuid);
  if (!hex) throw new Error("Could not resolve hexUuid.");

  const tf = foundry.utils.duplicate(hex.flags?.[MOD_TERR] ?? {});
  const facilitiesRoot = tf.facilities ?? {};
  const currentPrimary = facilitiesRoot.primary ?? {};
  const nextPrimary = foundry.utils.mergeObject(foundry.utils.duplicate(currentPrimary), foundry.utils.duplicate(patch?.patch || patch), { inplace:false, overwrite:true });

  const nextFacilities = foundry.utils.duplicate(facilitiesRoot);
  nextFacilities.primary = nextPrimary;

  await hex.update({ [`flags.${MOD_TERR}.facilities`]: nextFacilities });
  return true;
}

async function deliverHexAsset(hexUuid, asset) {
  if (!hexUuid) throw new Error("Hex asset delivery requires a hexUuid.");
  const hex = await fromUuid(hexUuid);
  if (!hex) throw new Error("Could not resolve hexUuid for asset delivery.");

  const tf = foundry.utils.duplicate(hex.flags?.[MOD_TERR] ?? {});
  const cur = Array.isArray(tf.assets) ? tf.assets.slice() : [];
  cur.unshift({
    key: String(asset?.key || "asset"),
    label: String(asset?.label || asset?.key || "Asset"),
    ts: Date.now()
  });

  await hex.update({ [`flags.${MOD_TERR}.assets`]: cur });
  return true;
}

/**
 * Pre-purchase confirmation dialog with cross-pool override (Phase 5.5).
 *
 * For flag-priced gear: shows native pool + cost, lets buyer pick any of the
 * 9 pools to pay from, applies × 1.5 friction on non-native picks (rubric §1.5).
 * For split items: shows the per-pool breakdown, no override (split always
 * pays native — that's the whole point of split).
 * For legacy catalog entries (no flag price): skipped — returns immediately
 * with `payFromPool: null` so existing behavior is preserved.
 *
 * Resolves with `{ ok, payFromPool }` — ok=false means user cancelled.
 */
async function openBuyConfirmDialog({ entry, factionId, faction, hexUuid = "" }) {
  const flagPrice = await resolveItemFlagPrice(entry);
  // Freight line for hex-delivered kinds (2026-10-12).
  let deliveryLine = "";
  if (HEX_KINDS.has(String(entry?.kind || "").toLowerCase()) && hexUuid) {
    try {
      const dest = await fromUuid(hexUuid);
      const f = _deliveryFeeFor(dest, { factionId });
      if (dest) deliveryLine = `<p${_tipAttr("deliveryFee")}>🚚 ${esc(DELIVERY_HAULER)} delivers to <b>${esc(_hexName(dest))}</b> — danger ${f.score}${f.breakdown ? ` <span style="opacity:.75">(${esc(f.breakdown)})</span>` : ""}: <b>${f.fee ? `${f.fee} marks (${esc(poolShortLabel(f.pool))})` : "free"}</b></p>`;
    } catch (_e) {}
  }
  if (!flagPrice) {
    if (!deliveryLine) return { ok: true, payFromPool: null };   // legacy path
    const DialogV2 = foundry.applications.api?.DialogV2;
    if (!DialogV2) return { ok: true, payFromPool: null };
    const confirmed = await DialogV2.confirm({
      window: { title: `Buy — ${entry.name}` },
      content: `<p><b>${esc(entry.name)}</b> — ${esc(costLabel(entry?.cost))}</p>${deliveryLine}`,
      defaultYes: true, rejectClose: false
    }).catch(() => false);
    return { ok: !!confirmed, payFromPool: null };
  }

  // Horizon-scaled cost — MUST mirror purchase()'s math exactly, or the dialog
  // shows a different number than what actually commits (fixed 2026-07-07):
  // one shared rule, horizonEconCost() (2026-10-16): Tier I kit free within the
  // horizon, everything else list price within it, ×2/×4 over it.
  const dBaseCost = Number(flagPrice.marks);   // marks
  const dRarity = await resolveEntryRarity(entry);
  const dDistance = rarityDistance(dRarity, factionEconomicHorizon(faction));
  const dKind = String(entry.kind || "").toLowerCase();
  const dEconCost = horizonEconCost(dBaseCost, dDistance, dKind, dRarity, flagPrice?.docFrame);
  const scaledMarks = Math.round(dEconCost);
  const rawMarks = Number(flagPrice.marks) || 0;
  const scaleNote = (scaledMarks !== rawMarks)
    ? (scaledMarks === 0
        ? ` <em>(Standard Issue — free at your Horizon; list ${rawMarks} marks)</em>`
        : ` <em>(horizon-scaled from ${rawMarks} marks)</em>`)
    : "";

  // Split items: confirm-only, no override. Portions display horizon-scaled,
  // matching purchase()'s proportional split of the scaled total.
  if (flagPrice.split && Object.keys(flagPrice.split).length) {
    const dSplitSum = Object.values(flagPrice.split).reduce((a, v) => a + (Number(v) || 0), 0);
    const dScale = dSplitSum > 0 ? (scaledMarks / dSplitSum) : 1;
    const parts = Object.entries(flagPrice.split)
      .filter(([_, v]) => Number(v) > 0)
      .map(([k, v]) => `<li><strong>${POOL_SHORT_LABEL[k] ?? k}:</strong> ${Math.round((Number(v) || 0) * dScale)} marks</li>`).join("");
    const DialogV2 = foundry.applications.api?.DialogV2;
    if (!DialogV2) return { ok: true, payFromPool: null };
    const confirmed = await DialogV2.confirm({
      window: { title: `Buy — ${entry.name}` },   // AppV2 sets the title as textContent — no escape (it would show entities)
      content: `<p><b>${esc(entry.name)}</b> requires split payment:</p><ul${_tipAttr("splitPay")} data-tour="market.splitPay">${parts}</ul>${deliveryLine}
                <p style="font-size:0.85rem;opacity:0.7;">Split items always pay each portion to its native pool — no override.</p>`,
      defaultYes: true,
      rejectClose: false
    }).catch(() => false);
    return { ok: !!confirmed, payFromPool: null };
  }

  // Single-pool item — full picker.
  const pricing = game.fourththing?.pricing;
  const nativePool = (!flagPrice.currency || flagPrice.currency === "auto")
    ? (pricing?.defaultCurrencyForFrame?.(flagPrice.docFrame) ?? "economy")
    : flagPrice.currency;

  // Snapshot current opBank balances (in marks) for the live "available" readout.
  const opBank = (faction?.getFlag?.("bbttcc-factions", "opBank")) || {};
  const balances = {};
  for (const p of OP_POOLS) balances[p] = Number(opBank[p]) || 0;

  const nativeMarks = scaledMarks;
  const crossMarks = Math.round(nativeMarks * (game.fourththing?.pricing?.CROSS_POOL_FRICTION ?? 1.5));

  const opts = OP_POOLS.map(p => {
    const isNative = (p === nativePool);
    const cost = isNative ? nativeMarks : crossMarks;
    const have = balances[p];
    const enough = have >= cost;
    const note = isNative ? "native" : `× 1.5 cross-pool`;
    return `<option value="${p}"${isNative ? " selected" : ""} data-cost="${cost}">${POOL_SHORT_LABEL[p] ?? p} (${note}) — ${cost} marks · have ${have}${enough ? "" : " ⚠"}</option>`;
  }).join("");

  const DialogV2 = foundry.applications.api?.DialogV2;
  if (!DialogV2) return { ok: true, payFromPool: null };

  let savedPool = null;
  const dialog = new DialogV2({
    window: { title: `Buy — ${entry.name}` },   // AppV2 sets the title as textContent — no escape (it would show entities)
    content: `
      <form>
        <p><b>${esc(entry.name)}</b> — native pool: <strong>${POOL_SHORT_LABEL[nativePool] ?? nativePool}</strong> (${nativeMarks} marks)${scaleNote}</p>${deliveryLine}
        <div style="margin:0.6rem 0;"${_tipAttr("payFromPool")} data-tour="market.payFromPool">
          <label style="font-weight:600;display:block;margin-bottom:0.3rem;">Pay from:</label>
          <select name="payFromPool" style="width:100%;">${opts}</select>
        </div>
        <p style="font-size:0.78rem;opacity:0.6;font-style:italic;">
          Non-native pools cost × 1.5 (cross-pool friction). Pool balances shown reflect current opBank.
        </p>
      </form>`,
    buttons: [
      {
        action: "confirm",
        label: "Buy",
        default: true,
        callback: (_ev, _btn, dlg) => {
          savedPool = dlg.element.querySelector("select[name='payFromPool']")?.value || nativePool;
        }
      },
      { action: "cancel", label: "Cancel", callback: () => { savedPool = null; } }
    ],
    rejectClose: false
  });

  try { await dialog.render(true); }
  catch { /* render failure → treat as cancel */ }
  // Wait for close.
  if (typeof dialog.wait === "function") {
    await dialog.wait().catch(() => null);
  } else {
    await new Promise(resolve => {
      const tick = () => dialog.rendered ? setTimeout(tick, 100) : resolve();
      tick();
    });
  }

  if (!savedPool) return { ok: false };
  return { ok: true, payFromPool: savedPool };
}

// PLAYER SEATS (2026-10-01): a purchase delivers onto hex Drawings, creates Actors and
// can fill another seat's character — writes a player cannot make (the spend already
// relayed, so those buys always failed and auto-refunded). A player's whole purchase now
// runs on the primary GM via bbttcc-core gmExec "market.purchase", validated GM-side.
const PURCHASE_RELAY = "market.purchase";

async function purchase({ entryId, factionId, characterId, hexUuid, note, payFromPool, _relayed = false } = {}) {
  if (!game.user?.isGM) {
    const gx = game.bbttcc?.api?.gmExec;
    if (gx && typeof gx.call === "function") {
      return gx.call(PURCHASE_RELAY, { entryId, factionId, characterId, hexUuid, note, payFromPool }, { timeoutMs: 30000 });
    }
    // gmExec absent (core disabled): fall through to the direct attempt.
  }
  const faction = game.actors.get(factionId);
  if (!faction || !isFactionActor(faction)) throw new Error("Buyer faction not found.");

  const catalog = game.settings.get(MODULE_ID, "catalog") || [];
  const entry = (Array.isArray(catalog) ? catalog : []).find(e => e?.id === entryId);
  if (!entry) throw new Error("Catalog entry not found.");

  // Economic Horizon: compute spend based on rarity vs faction horizon.
  // RFI item-flag price (flags.fourththing.rfi.item.price) overrides the legacy
  // catalog cost.economy for gear entries that have been stamped. Phase 5.
  const flagPrice = await resolveItemFlagPrice(entry);
  if (flagPrice && Number(flagPrice.marks) < 0) {
    throw new Error(`${entry.name} is priceless / not for sale.`);
  }
  const baseCost = flagPrice
    ? Number(flagPrice.marks)
    : (Number(entry?.cost?.economy ?? 0) || 0);   // both MARKS

  const horizon = factionEconomicHorizon(faction);
  const rarity = await resolveEntryRarity(entry);

  if (rarity === "artifact") {
    throw new Error("Artifacts cannot be purchased. Discovery only.");
  }

  const distance = rarityDistance(rarity, horizon);
  const kind = String(entry.kind || "").toLowerCase();
  // Tier I kit is free within the horizon (Standard Issue); everything else pays list price
  // within it and strains ×2/×4 over it — horizonEconCost() is the one rule (2026-10-16).
  const econCost = horizonEconCost(baseCost, distance, kind, rarity, flagPrice?.docFrame);

  // 0) Validate delivery prerequisites BEFORE spending — the OP engine has no
  //    rollback, so a delivery failure after commit would strand the marks.
  //    Warn + throw a pre-notified error (the Market app's buy handler skips
  //    its own error toast for these; direct API callers still get the throw).
  const _abortPurchase = (msg) => {
    if (!_relayed) ui.notifications?.warn?.(msg);   // relayed: the player's seat shows the error
    const err = new Error(msg);
    err.notified = true;
    throw err;
  };
  if (kind === "gear") {
    if (!characterId) _abortPurchase("Select a Buyer Character before buying gear.");
    if (!game.actors.get(characterId)) _abortPurchase("Buyer Character not found.");
    if (!String(entry.uuid || "").trim()) _abortPurchase(`No gear UUID set on catalog entry "${entry.name}".`);
    if (!(await fromUuid(entry.uuid).catch(() => null))) _abortPurchase(`Could not resolve gear UUID for "${entry.name}".`);
  } else if (kind === "facility" || kind === "hex_asset" || kind === "facility_upgrade") {
    if (!String(hexUuid || "").trim()) _abortPurchase(`Set a Delivery Hex UUID before buying "${entry.name}" (${kindLabel(kind)}).`);
    if (!(await fromUuid(hexUuid).catch(() => null))) _abortPurchase("Delivery Hex UUID could not be resolved.");
  } else if (kind === "actor") {
    const src = String(entry.uuid || "").trim() ? await fromUuid(entry.uuid).catch(() => null) : null;
    if (!src) _abortPurchase(`Actor UUID on "${entry.name}" is missing or could not be resolved.`);
    if (src.documentName !== "Actor") _abortPurchase(`Catalog entry "${entry.name}" UUID does not point to an Actor (got ${src.documentName}).`);
  } else if (kind === "contract") {
    // ruling 15: a steward signs; one contract per family at a time
    if (!characterId) _abortPurchase("Select a Buyer Character — a contract is signed by a steward.");
    const ch = game.actors.get(characterId); if (!ch) _abortPurchase("Buyer Character not found.");
    const C = game.bbttcc?.api?.contracts; if (!C) _abortPurchase("Contracts API not available.");
    const fam = String(entry.contract?.family || ""); if (!C.FAMILIES[fam]) _abortPurchase(`Catalog entry "${entry.name}" has no contract family.`);
    if (!String(entry.contract?.docId || "").trim()) _abortPurchase(`Catalog entry "${entry.name}" names no crew document.`);
    const cur = C.get(ch, fam);
    if (C.isActive(cur)) _abortPurchase(`${ch.name} already holds a ${C.FAMILIES[fam].label.toLowerCase()} contract (${cur.displayName}, ${cur.turnsLeft === Infinity ? "standing" : cur.turnsLeft + " turn(s) left"}). Release it first.`);
  } else if (kind === "rig") {
    if (typeof game.bbttcc?.api?.factions?.addRig !== "function") _abortPurchase("Factions rig API not available — cannot deliver a rig.");
  } else if (kind === "rig_upgrade") {
    const rigs = faction.getFlag(MOD_FACTIONS, "rigs");
    if (!Array.isArray(rigs) || !rigs.length) _abortPurchase("Faction has no rigs to upgrade.");
    if (_findRigIndex(rigs, entry.patch?.target) < 0) _abortPurchase(`"${entry.name}" targets a rig this faction does not have.`);
  }

  // Build per-pool marks deltas (negative). For flag-priced gear: split items
  // pay each portion to its native pool; single-currency items pay the whole
  // amount to their native pool. Legacy catalog entries (no flag price) keep
  // the Economy-only path.
  const totalMarks = Math.round(econCost);   // marks
  let payDeltas;
  if (flagPrice?.split && Object.keys(flagPrice.split).length) {
    const splitSum = Object.values(flagPrice.split).reduce((a, v) => a + (Number(v) || 0), 0);
    const scale = splitSum > 0 ? (totalMarks / splitSum) : 1;
    payDeltas = {};
    for (const [pool, marks] of Object.entries(flagPrice.split)) {
      payDeltas[pool] = -Math.round((Number(marks) || 0) * scale);
    }
  } else if (flagPrice) {
    const pricing = game.fourththing?.pricing;
    const nativePool = (!flagPrice.currency || flagPrice.currency === "auto")
      ? (pricing?.defaultCurrencyForFrame?.(flagPrice.docFrame) ?? "economy")
      : flagPrice.currency;
    // Cross-pool override (Phase 5.5): if payFromPool was explicitly chosen
    // and differs from native, apply × 1.5 friction (rubric §1.5).
    const chosenPool = _normPool(payFromPool || nativePool);
    const isCross = (chosenPool !== _normPool(nativePool));
    const friction = isCross ? (pricing?.CROSS_POOL_FRICTION ?? 1.5) : 1.0;
    const adjustedMarks = Math.round(totalMarks * friction);
    payDeltas = { [chosenPool]: -adjustedMarks };
  } else {
    // Legacy (catalog-priced) entries are economy-native; an explicit payFromPool still works, with the same ×1.5
    // cross-pool friction as flag-priced gear (2026-10-18 — contracts are catalog-priced).
    const chosenPool = _normPool(payFromPool || "economy");
    const isCross = chosenPool !== "economy";
    const friction = isCross ? (game.fourththing?.pricing?.CROSS_POOL_FRICTION ?? 1.5) : 1.0;
    payDeltas = { [chosenPool]: -Math.round(totalMarks * friction) };
  }

  // Every pay key must be one of the nine OP pools: the OP engine silently drops an
  // unknown key and still reports committed, so the goods would be delivered free.
  {
    const norm = {};
    for (const [k, v] of Object.entries(payDeltas)) {
      const kk = _normPool(k);
      if (!OP_POOLS.includes(kk)) _abortPurchase(`"${entry.name}" names an unknown pay pool "${k}" — not bought.`);
      norm[kk] = (norm[kk] || 0) + (Number(v) || 0);
    }
    payDeltas = norm;
  }

  // 0.5) Freight (2026-10-12): hex-delivered kinds pay distance from the origin hex.
  let freightNote = "";
  if (HEX_KINDS.has(kind) && hexUuid) {
    try {
      const dest = await fromUuid(hexUuid);
      const f = _deliveryFeeFor(dest, { factionId });
      if (f.fee > 0) {
        payDeltas[f.pool] = (payDeltas[f.pool] || 0) - f.fee;
        freightNote = `${DELIVERY_HAULER} delivery to ${_hexName(dest)}: danger ${f.score}${f.breakdown ? ` (${f.breakdown})` : ""} = ${f.fee} marks (${poolShortLabel(f.pool)})`;
      }
    } catch (e) { console.warn("[bbttcc-market] freight calc failed (shipping free)", e); }
  }

  // 1) Spend
  const spendRes = await spendMarksByPools(factionId, payDeltas, { label: entry.name, note: [note, freightNote].filter(Boolean).join(" · ") });
  if (!spendRes.ok) {
    const pools = Object.keys(payDeltas).join("/");
    throw new Error(`Insufficient OP in ${pools} (or OP engine refused commit).`);
  }

  // 2) Deliver. On failure, refund the exact spend through the same payment
  //    path (mirrored deltas) so a broken delivery never strands the marks.
  let delivered = null;

  try {
    if (kind === "gear") {
      await deliverGearToCharacter(characterId, entry.uuid, 1);
      delivered = { to: "character", characterId };
    } else if (kind === "rig") {
      const rig = await deliverRigToFaction(factionId, entry.rigData);
      delivered = { to: "faction", rigId: rig?.rigId || null };
    } else if (kind === "facility") {
      await deliverFacilityToHex(hexUuid, entry.facilityPatch);
      delivered = { to: "hex", hexUuid };
    } else if (kind === "hex_asset") {
      await deliverHexAsset(hexUuid, entry.asset);
      delivered = { to: "hex", hexUuid };
    } else if (kind === "rig_upgrade") {
      const patch = entry.patch || {};
      const res = await applyRigUpgradePatch(factionId, patch, { note });
      delivered = { to: "faction", rigUpgrade: true, ...res };
    } else if (kind === "facility_upgrade") {
      const patch = entry.patch || {};
      await applyFacilityUpgradePatch(hexUuid, patch);
      delivered = { to: "hex", facilityUpgrade: true, hexUuid };
    } else if (kind === "actor") {
      // Phase 9 (2026-05-11): clone a pre-built actor (rig/boss/NPC/bestiary)
      // into the world and assign to buyer faction. Source actor template stays
      // intact for re-purchase.
      const res = await deliverActorByUuid(factionId, entry.uuid);
      delivered = { to: "faction", actorTemplate: true, ...res };
    } else if (kind === "contract") {
      const c = await game.bbttcc.api.contracts.hire(characterId, entry.contract.family, entry.contract.docId, { turns: entry.contract.turns, source: "market", entryId: entry.id, vendorId: entry.vendorId });
      delivered = { to: "character", characterId, contract: { family: entry.contract.family, until: c?.until ?? null } };
    } else {
      throw new Error(`Unsupported kind: ${kind}`);
    }
  } catch (deliverErr) {
    if (spendRes.cost > 0) {
      try {
        const refundDeltas = {};
        for (const [pool, v] of Object.entries(payDeltas)) refundDeltas[pool] = -(Number(v) || 0);
        const refundRes = await spendMarksByPools(factionId, refundDeltas, {
          label: `Refund — ${entry.name}`,
          note: `Automatic refund: delivery failed (${deliverErr?.message || deliverErr}).`,
          allowOvercap: true
        });
        if (!refundRes?.ok) throw new Error("OP engine refused the refund commit.");
        ui.notifications?.warn?.(`Delivery failed for "${entry.name}" — the spent marks were refunded.`);
      } catch (refundErr) {
        console.error(`[${MODULE_ID}] delivery failed AND the refund failed — restore the faction's OP manually`, { payDeltas, deliverErr, refundErr });
        ui.notifications?.error?.(`Delivery failed for "${entry.name}" AND the automatic refund failed — restore the faction's OP manually (see console).`);
      }
    }
    throw deliverErr;
  }

  // 3) Receipt (faction war log)
  const poolSummary = Object.entries(payDeltas)
    .filter(([_, v]) => Number(v) !== 0)
    .map(([k, v]) => `${k} ${Math.abs(v)}`)
    .join(" + ");
  const receipt = {
    ts: Date.now(),
    type: "market_purchase",
    summary: econCost
      ? `Purchased: ${entry.name} (${poolSummary || `economy ${totalMarks}`} marks)`
      : `Acquired: ${entry.name} (Standard Issue)`,
    vendorId: entry.vendorId || "",
    entryId,
    econCost,
    baseCost,
    payDeltas,           // per-pool marks spent (Phase 5)
    flagPrice,           // resolved item-flag price (or null) for audit trail
    rarity,
    horizon,
    distance,
    delivered,
    note: String(note || "").trim()
  };
  await appendFactionReceipt(faction, receipt);

  // 4) GM whisper receipt
  try {
    const gmIds = (game.users ?? []).filter(u => u.isGM).map(u => u.id);
    if (gmIds.length) {
      await ChatMessage.create({
        whisper: gmIds,
        speaker: { alias: "Bad Eden Market" },
        content: `<p><b>Market Purchase</b></p>
          <p><b>${esc(faction.name)}</b> acquired <b>${esc(entry.name)}</b> ${econCost ? `for <code>${esc(poolSummary || `economy ${totalMarks}`)} marks</code>` : `<i>(Standard Issue)</i>`}.</p>
          <p class="bbttcc-muted">Rarity: <code>${esc(rarity)}</code> • Horizon: <code>${esc(horizon)}</code> • Δ: <code>${esc(distance)}</code></p>
          ${note ? `<p class="bbttcc-muted">Note: ${esc(note)}</p>` : ""}`
      });
    }
  } catch {}

  return { ok: true, entry, receipt };
}

/* ===================== UI ===================== */


/* ===================== Tabs / cost bands / affordability (2026-10-12) =====================
   Owner ask: "an Available toggle, a list of available OPs so they know what they can
   afford, always tabbed by gear type, filterable by cost category — it's a very long list."
*/

/* ===================== Delivery hexes + freight (2026-10-12) =====================
   Owner ask: "a drop-down of hexes KNOWN by the buyer, with delivery fees — Furrier's
   Fixit Farm (the Jackalope haulers) deliver; charge the RECEIVER by the danger of the
   delivery hex: level of development and hostile factors."
   Known = the buyer faction's visited ledger (flags.bbttcc-territory.visited.byFaction)
   plus any hex it holds (flags.bbttcc-territory.factionId).
*/
const HEX_KINDS = new Set(["facility", "hex_asset", "facility_upgrade"]);
const DELIVERY_HAULER = "Furrier's Fixit Farm";
const _hexFlags = (d) => (d?.flags?.[MOD_TERR]) || {};
function _isHexDoc(d) { const tf = _hexFlags(d); return !!tf && (tf.isHex === true || tf.kind === "territory-hex"); }
function _hexName(d) { return String(_hexFlags(d).name || d?.text || d?.id || "hex"); }
function _hexDocs() {
  const out = [];
  for (const sc of (game.scenes ?? [])) for (const d of (sc.drawings?.contents ?? Array.from(sc.drawings ?? []))) if (_isHexDoc(d)) out.push(d);
  return out;
}
// Danger score 0–12 for delivering to `d`, with the itemised parts.
// Reads the same canonical stores the hex sheet reads (integration.progress,
// mods.radiation / mods.darkness with legacy fallbacks, status, type, modifiers,
// conditions) plus the holder's stance toward the buyer (relations API).
const _DANGER_MODS = {
  "hostile population": 2, "contaminated": 1, "radiation zone": 2, "supply line vulnerable": 2,
  "damaged infrastructure": 1, "difficult terrain": 1,
  "fortified": -1, "well-maintained": -1, "well maintained": -1, "strategic position": -1, "loyal population": -1
};
const _DANGER_STANCE = { at_war: 4, hostile: 3, unfriendly: 1, neutral: 0, friendly: -1, allied: -1 };
function _hexDanger(d, buyerFactionId = "") {
  const tf = _hexFlags(d);
  const parts = [];
  const add = (label, pts) => { if (pts) parts.push({ label, pts }); };
  const integ = Math.max(0, Math.min(6, Number(tf.integration?.progress ?? tf.development?.stage ?? 0) || 0));
  if (integ >= 6) add("integrated heartland", 0);
  else if (integ === 5) add("settled province", 1);
  else if (integ >= 3) add("developing territory", 2);
  else if (integ >= 1) add("outpost foothold", 3);
  else add("untouched wilderness", 4);
  const status = String(tf.status || "unclaimed").toLowerCase();
  if (status === "unclaimed") add("no authority (unclaimed)", 1);
  else if (status === "occupied") add("under occupation", 3);
  else if (status === "scorched") add("scorched ground", 4);
  const type = String(tf.type || "").toLowerCase();
  if (type === "wasteland") add("wasteland", 2);
  else if (type === "ruins") add("ruins", 1);
  else if (type === "wilderness") add("wild country", 1);
  const rad = Math.max(0, Number(tf.mods?.radiation ?? tf.radiation?.value ?? tf.radiation ?? 0) || 0);
  if (rad) add(`radiation ${rad}`, Math.min(4, Math.round(rad)));
  const dark = Math.max(0, Number(tf.mods?.darkness ?? tf.darkness?.local ?? tf.localDarkness ?? tf.darkness ?? 0) || 0);
  if (dark) add(`darkness ${dark}`, Math.min(3, Math.round(dark)));
  const mods = (Array.isArray(tf.modifiers) ? tf.modifiers : [])
    .map(m => String((m && typeof m === "object") ? (m.name ?? m.key ?? "") : m).toLowerCase().replace(/_/g, " ").trim());
  for (const m of mods) if (_DANGER_MODS[m]) add(m, _DANGER_MODS[m]);
  const conds = Array.isArray(tf.conditions) ? tf.conditions.filter(Boolean) : [];
  if (conds.length) add(`${conds.length} condition${conds.length === 1 ? "" : "s"}`, Math.min(3, conds.length));
  const fid = String(buyerFactionId || "").replace(/^Actor\./, "");
  const owner = String(tf.factionId || tf.ownerId || "").replace(/^Actor\./, "");
  if (fid && owner) {
    if (owner === fid) add("your own holding", -2);
    else {
      try {
        const rel = game.bbttcc?.api?.factions?.relations;
        const buyer = game.actors.get(fid), holder = game.actors.get(owner);
        if (rel?.get && buyer && holder) {
          // Worst of the two directions — a holder who hates you, or one you are at war with.
          const t1 = String(rel.get(holder, buyer) || "neutral"), t2 = String(rel.get(buyer, holder) || "neutral");
          const worst = (_DANGER_STANCE[t1] ?? 0) >= (_DANGER_STANCE[t2] ?? 0) ? t1 : t2;
          if (_DANGER_STANCE[worst]) add(`holder ${worst.replace(/_/g, " ")}`, _DANGER_STANCE[worst]);
        }
      } catch (_e) {}
    }
  }
  const score = Math.max(0, Math.min(12, parts.reduce((t, p) => t + p.pts, 0)));
  return { score, parts };
}
function _deliveryRate() {
  return {
    base: Math.max(0, Number(game.settings.get(MODULE_ID, "deliveryFeeBase")) || 0),
    perDanger: Math.max(0, Number(game.settings.get(MODULE_ID, "deliveryFeePerDanger")) || 0),
    pool: _normPool(game.settings.get(MODULE_ID, "deliveryFeePool") || "economy")
  };
}
const _round5 = (n) => (n <= 0 ? 0 : Math.max(0, Math.round(n / 5) * 5));
// Freight for shipping to `dest` → { fee, score, parts, pool, note, breakdown }
function _deliveryFeeFor(dest, { factionId = "" } = {}) {
  const rate = _deliveryRate();
  if (!dest) return { fee: 0, score: 0, parts: [], pool: rate.pool, note: "", breakdown: "" };
  const { score, parts } = _hexDanger(dest, factionId);
  const fee = _round5(rate.base + score * rate.perDanger);
  const breakdown = parts.map(p => `${p.label} ${p.pts > 0 ? "+" : ""}${p.pts}`).join(", ");
  return { fee, score, parts, pool: rate.pool, note: `danger ${score}`, breakdown };
}
function _knownHexesFor(factionId, hexDocs = null) {
  const fid = String(factionId || "").replace(/^Actor\./, "");
  const docs = hexDocs || _hexDocs();
  const known = [], other = [];
  for (const d of docs) {
    const tf = _hexFlags(d);
    const isKnown = !!fid && (String(tf.factionId || "") === fid || !!tf.visited?.byFaction?.[fid]);
    (isKnown ? known : other).push(d);
  }
  return { known, other };
}
function _deliveryOptionFor(d, selectedUuid, factionId) {
  const f = _deliveryFeeFor(d, { factionId });
  return { uuid: d.uuid, name: _hexName(d), fee: f.fee, score: f.score, selected: d.uuid === selectedUuid,
           label: `${_hexName(d)} — danger ${f.score} · ${f.fee ? `${f.fee} marks` : "free"}` };
}

const MARKET_TABS = [
  { key: "weapon",           label: "Weapons" },
  { key: "armor",            label: "Armor" },
  { key: "gear",             label: "Gear" },
  { key: "consumable",       label: "Consumables" },
  { key: "rig",              label: "Rigs" },
  { key: "actor",            label: "Hire" },
  { key: "facility",         label: "Facilities" },
  { key: "hex_asset",        label: "Hex Assets" },
  { key: "rig_upgrade",      label: "Rig Upgrades" },
  { key: "facility_upgrade", label: "Facility Upgrades" },
  { key: "other",            label: "Other" }
];
// Marks brackets follow the RFI tier ladder (TIER_BASE_MARKS 50/150/450/1350).
const COST_BANDS = [
  { key: "",       label: "Any cost" },
  { key: "free",   label: "Standard Issue (free)" },
  { key: "b50",    label: "≤ 50 marks" },
  { key: "b150",   label: "51–150 marks" },
  { key: "b500",   label: "151–500 marks" },
  { key: "b1500",  label: "501–1500 marks" },
  { key: "b1500p", label: "1500+ marks" },
  { key: "na",     label: "Priceless / Artifact" }
];
function _tabKeyFor({ kind, docType, isConsumable }) {
  const k = String(kind || "").toLowerCase();
  if (k === "gear") {
    if (isConsumable) return "consumable";
    if (docType === "weapon") return "weapon";
    if (docType === "armor") return "armor";
    return "gear";
  }
  if (k === "contract") return "actor";   // contracts sit on the Hire tab beside the beast / crew hires
  return MARKET_TABS.some(t => t.key === k && k !== "other") ? k : "other";
}
function _costBandFor(charge) {
  if (!charge || charge.artifact || charge.priceless) return "na";
  const m = Number(charge.marks) || 0;
  if (m <= 0) return "free";
  if (m <= 50) return "b50";
  if (m <= 150) return "b150";
  if (m <= 500) return "b500";
  if (m <= 1500) return "b1500";
  return "b1500p";
}
// Effective bill for `entry` as the buyer faction would pay it. MUST mirror
// purchase() / openBuyConfirmDialog(): horizonEconCost() (Tier I kit free within
// the horizon, list price within it otherwise, ×2/×4 over it), split items
// pay each portion to its native pool, single-currency items pay their native
// pool. No faction → list price (distance treated as 1).
function _chargeFor(entry, faction, flagPrice, rarity) {
  const kind = String(entry?.kind || "").toLowerCase();
  if (rarity === "artifact") return { artifact: true, priceless: false, marks: 0, pools: {}, rarity };
  if (flagPrice && Number(flagPrice.marks) < 0) return { artifact: false, priceless: true, marks: 0, pools: {}, rarity };
  const baseCost = flagPrice ? Number(flagPrice.marks) : (Number(entry?.cost?.economy ?? 0) || 0);
  const horizon  = faction ? factionEconomicHorizon(faction) : null;
  const distance = horizon ? rarityDistance(rarity, horizon) : 1;
  const marks = Math.round(horizonEconCost(baseCost, distance, kind, rarity, flagPrice?.docFrame));
  const pools = {};
  if (flagPrice?.split && Object.keys(flagPrice.split).length) {
    const sum = Object.values(flagPrice.split).reduce((a, v) => a + (Number(v) || 0), 0);
    const scale = sum > 0 ? (marks / sum) : 1;
    for (const [p, v] of Object.entries(flagPrice.split)) {
      const k = _normPool(p);
      pools[k] = (pools[k] || 0) + Math.round((Number(v) || 0) * scale);
    }
  } else if (flagPrice) {
    const pricing = game.fourththing?.pricing;
    const native = _normPool((!flagPrice.currency || flagPrice.currency === "auto")
      ? (pricing?.defaultCurrencyForFrame?.(flagPrice.docFrame) ?? "economy")
      : flagPrice.currency);
    pools[native] = marks;
  } else {
    pools.economy = marks;
  }
  return { artifact: false, priceless: false, marks, pools, rarity, distance, baseCost,
           standardIssue: !!faction && isStandardIssue(kind, rarity, distance, flagPrice?.docFrame) };
}
function _affordFor(charge, balances) {
  if (!charge || charge.artifact || charge.priceless) return { ok: false, short: [] };
  const short = [];
  for (const [p, need] of Object.entries(charge.pools)) {
    const have = Number(balances?.[p]) || 0;
    if (need > have) short.push({ pool: p, by: need - have });
  }
  return { ok: !short.length, short };
}
function _paysLabel(charge) {
  if (!charge) return "";
  if (charge.artifact) return "Artifact — discovery only";
  if (charge.priceless) return "Priceless";
  if (charge.standardIssue || charge.marks <= 0) return "Standard Issue — free";
  const parts = Object.entries(charge.pools).filter(([, v]) => v > 0).map(([p, v]) => `${poolShortLabel(p)} ${v}`);
  return parts.length ? `${parts.join(" + ")} marks` : "free";
}

export class BBTTCCMarketApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-market",
    window: { title: "Bad Eden Market", icon: "fas fa-store", resizable: true },
    position: { width: 980, height: 720 },
    classes: ["bbttcc", "bbttcc-market", "sheet", "bbttcc-be", "bbttcc-theme-player"],
    resizable: true
  };

  static PARTS = {
    // scrollable (2026-10-12): every filter change / tab click / buy re-renders the
    // part; without this Foundry resets the scroll to the top each time (owner:
    // "stop the interface taking you back up to the top").
    body: { template: `modules/${MODULE_ID}/templates/market-app.hbs`, scrollable: ["", ".bbttcc-market-list"] }
  };

  constructor(options = {}) {
    super(options);
    this._abort = null;
    this._docCache = new Map();
  }

  _loadCtx() {
    const c = game.settings.get(MODULE_ID, "lastContext") || {};
    return {
      vendorId: c.vendorId || DEFAULT_VENDORS[0].id,
      factionId: c.factionId || "",
      characterId: c.characterId || "",
      hexUuid: c.hexUuid || "",
      q: c.q || "",
      kind: c.kind || "",
      category: c.category || "",
      sort: c.sort || "name",
      note: c.note || "",
      // 2026-10-12 (owner ask): gear-type tab, cost-band filter, affordability toggle.
      tab: c.tab || "",
      costBand: c.costBand || "",
      affordOnly: !!c.affordOnly
    };
  }

  _saveCtx(patch) {
    const cur = this._loadCtx();
    const next = foundry.utils.mergeObject(cur, patch || {}, { inplace:false, overwrite:true });
    game.settings.set(MODULE_ID, "lastContext", next);
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const ctx = this._loadCtx();

    const vendorsRaw0 = game.settings.get(MODULE_ID, "vendors") || [];
const catalogRaw = game.settings.get(MODULE_ID, "catalog") || [];

const isGM = !!game.user?.isGM;
const vendorsRaw = (Array.isArray(vendorsRaw0) ? vendorsRaw0 : []).map(_normalizeVendor);

// Players should only see active markets.
const visibleVendors = isGM ? vendorsRaw : vendorsRaw.filter(v => v.active !== false);

// If lastContext points at an inactive market, fall back to the first active one (for players).
if (!isGM) {
  const curV = vendorsRaw.find(v => v.id === ctx.vendorId);
  if (!curV || curV.active === false) {
    ctx.vendorId = visibleVendors?.[0]?.id || "";
    this._saveCtx({ vendorId: ctx.vendorId });
  }
}

const vendors = visibleVendors.map(v => ({
  id: v.id,
  name: v.name,
  active: v.active !== false,
  displayName: (isGM && v.active === false) ? `${v.name} (inactive)` : v.name,
  selected: v.id === ctx.vendorId
}));

    const vendor = vendorsRaw.find(v => v.id === ctx.vendorId) || vendorsRaw?.[0];
    const vendorName = vendor?.name || "Vendor";

    const vendorStatusLine = (isGM && vendor && vendor.active === false) ? "Inactive: hidden from players." : "";

    // Ruling 16 (2026-10-18, steward + faction = one being): a PLAYER buys as their own steward and the
    // treasury is that steward's Domain — no faction picker. The GM keeps both pickers.
    const lockedBuyer = !isGM;
    let factions, characters;
    if (lockedBuyer) {
      const owned = allCharacters().filter(a => a?.isOwner).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
      const ch = owned.find(a => a.id === ctx.characterId) || (game.user?.character && owned.find(a => a.id === game.user.character.id)) || owned[0] || null;
      if ((ch?.id || "") !== (ctx.characterId || "")) { ctx.characterId = ch?.id || ""; this._saveCtx({ characterId: ctx.characterId }); }
      const dom = ch ? domainOf(ch) : null;
      if ((dom?.id || "") !== (ctx.factionId || "")) { ctx.factionId = dom?.id || ""; this._saveCtx({ factionId: ctx.factionId }); }
      factions = dom ? [{ id: dom.id, name: dom.name, selected: true }] : [];
      characters = owned.map(a => ({ id: a.id, name: a.name, selected: a.id === ctx.characterId }));
    } else {
      factions = allFactions()
        .filter(a => game.user?.isGM || a?.isOwner)
        .map(a => ({ id: a.id, name: a.name, selected: a.id === ctx.factionId }))
        .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
      characters = allCharacters().map(a => ({ id: a.id, name: a.name, selected: a.id === ctx.characterId }))
        .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    }

    // Buyer faction treasury (2026-10-12): every price below is measured against this.
    const buyerFaction = ctx.factionId ? game.actors.get(ctx.factionId) : null;
    const buyerBalances = {};
    {
      const ob = buyerFaction?.getFlag?.(MOD_FACTIONS, "opBank") || {};
      for (const p of OP_POOLS) buyerBalances[p] = Number(ob[p]) || 0;
    }
    const treasury = buyerFaction ? {
      name: buyerFaction.name,
      horizonLabel: rarityLabelFor(factionEconomicHorizon(buyerFaction)),
      pools: OP_POOLS.map(p => ({ key: p, short: poolShortLabel(p), marks: buyerBalances[p], zero: !(buyerBalances[p] > 0) }))
    } : null;

    // Delivery hexes known to the buyer + freight for the selected one (2026-10-12).
    const hexDocs = _hexDocs();
    const deliveryRate = _deliveryRate();
    const { known: knownHexes, other: otherHexes } = _knownHexesFor(ctx.factionId, hexDocs);
    const byFee = (a, b) => (a.fee - b.fee) || String(a.name).localeCompare(String(b.name));
    const deliveryOptions = knownHexes.map(d => _deliveryOptionFor(d, ctx.hexUuid, ctx.factionId)).sort(byFee);
    const deliveryOtherOptions = isGM ? otherHexes.map(d => _deliveryOptionFor(d, ctx.hexUuid, ctx.factionId)).sort(byFee) : [];
    const selectedHexDoc = ctx.hexUuid ? hexDocs.find(d => d.uuid === ctx.hexUuid) : null;
    const deliveryUnlisted = (ctx.hexUuid && !deliveryOptions.some(o => o.selected) && !deliveryOtherOptions.some(o => o.selected))
      ? { uuid: ctx.hexUuid, label: selectedHexDoc ? `${_hexName(selectedHexDoc)} (not known to the buyer)` : `${ctx.hexUuid} (unresolved)` }
      : null;
    const selectedFreight = selectedHexDoc ? _deliveryFeeFor(selectedHexDoc, { factionId: ctx.factionId }) : null;
    const deliveryNote = !buyerFaction
      ? "Pick a Buyer Domain to list the hexes it knows."
      : `${DELIVERY_HAULER} hauls it; the receiver pays ${deliveryRate.base} marks + ${deliveryRate.perDanger} per danger point (${poolShortLabel(deliveryRate.pool)}).`
        + (selectedFreight ? ` Selected: danger ${selectedFreight.score}${selectedFreight.breakdown ? ` (${selectedFreight.breakdown})` : ""} → ${selectedFreight.fee ? `${selectedFreight.fee} marks` : "free"}.` : "")
        + (deliveryOptions.length ? "" : " This Domain knows no hexes yet — travel somewhere first.");
    const deliveryFee = selectedFreight?.fee || 0;

    let entries = (Array.isArray(catalogRaw) ? catalogRaw : []).filter(e => e?.vendorId === ctx.vendorId);

    // Legacy `kind` filter retained for callers that set it directly; the
    // user-facing dropdown now writes `category`, which subdivides "gear"
    // catalog entries by underlying item.type (weapon / armor / gear /
    // consumable) and otherwise matches `kind` directly for non-gear rows.
    if (ctx.kind) entries = entries.filter(e => String(e.kind||"") === ctx.kind);
    if (ctx.q) {
      const q = String(ctx.q).toLowerCase();
      entries = entries.filter(e =>
        String(e.name||"").toLowerCase().includes(q) ||
        String(e.blurb||"").toLowerCase().includes(q) ||
        String(e.kind||"").toLowerCase().includes(q)
      );
    }

    // Resolve the underlying Foundry doc once per entry so we can both
    // (a) filter by item type and (b) sort by tier without re-fetching.
    // Tier is read from flags.fourththing.rfi.item.tier (Roman: I/II/III/IV).
    const TIER_RANK = { I: 1, II: 2, III: 3, IV: 4 };
    entries = await Promise.all(entries.map(async (e) => {
      const kind = String(e.kind || "").toLowerCase();
      let docUuid = "";
      let img = "";
      let docName = "";
      let docType = "";   // weapon / armor / gear / feature / power / ...
      let tier = "";      // "I" | "II" | "III" | "IV" | ""
      let isConsumable = false; // gear-doc whose frame/slot/tags say "consumable"
      if (kind === "actor") {
        // Creatures for hire (2026-09-04): show the token art, fall back to the
        // portrait; tier from the bestiary flag. Cached like gear docs.
        docUuid = String(e.uuid || "").trim();
        if (docUuid) {
          try {
            const cached = this._docCache.get(docUuid);
            const doc = cached || await fromUuid(docUuid);
            if (doc && !cached) this._docCache.set(docUuid, doc);
            img = String(doc?.prototypeToken?.texture?.src || doc?.img || "");
            docName = String(doc?.name || "");
            docType = String(doc?.type || "").toLowerCase();
            tier = String(doc?.flags?.fourththing?.rfi?.actor?.tier || "").toUpperCase();
          } catch (_e) { /* unresolved — row still renders */ }
        }
        if (!img && e.img) img = String(e.img);
      }
      if (kind === "gear") {
        docUuid = String(e.uuid || "").trim();
        if (docUuid) {
          try {
            const cached = this._docCache.get(docUuid);
            const doc = cached || await fromUuid(docUuid);
            if (doc && !cached) this._docCache.set(docUuid, doc);
            img = String(doc?.img || "");
            docName = String(doc?.name || "");
            docType = String(doc?.type || "").toLowerCase();
            tier = String(doc?.flags?.fourththing?.rfi?.item?.tier || "").toUpperCase();
            // RFI doesn't use a separate "consumable" doc type — consumables
            // are gear items flagged via rfi.frame or system.slot. Catch
            // either authoring style plus a tag fallback.
            const rfiFrame = String(doc?.flags?.fourththing?.rfi?.item?.frame || "").toLowerCase();
            const slot     = String(doc?.system?.slot || "").toLowerCase();
            const tags     = Array.isArray(doc?.system?.tags) ? doc.system.tags.map(t => String(t).toLowerCase()) : [];
            isConsumable = docType === "consumable"
              || rfiFrame === "consumable"
              || slot === "consumable"
              || tags.includes("consumable");
          } catch {}
        }
      }

      // Phase 5: resolve RFI item-flag price for gear entries and use it for
      // the static "Cost: …" label. Falls back to legacy catalog cost for
      // unstamped entries / non-gear kinds.
      const flagPrice = await resolveItemFlagPrice(e);

      // 2026-10-12: what the buyer faction would actually pay, and whether it can.
      let rarity = "common", charge = null, afford = null;
      try { rarity = await resolveEntryRarity(e); } catch (_e) {}
      try { charge = _chargeFor(e, buyerFaction, flagPrice, rarity); } catch (_e) { charge = null; }
      // Hex-delivered kinds carry the freight to the selected hex in their bill.
      if (charge && HEX_KINDS.has(String(e.kind || "").toLowerCase()) && deliveryFee > 0 && !charge.artifact && !charge.priceless) {
        charge.pools[deliveryRate.pool] = (charge.pools[deliveryRate.pool] || 0) + deliveryFee;
        charge.marks += deliveryFee;
        charge.freight = deliveryFee;
      }
      if (buyerFaction && charge) afford = _affordFor(charge, buyerBalances);
      const tabKey = _tabKeyFor({ kind: e.kind, docType, isConsumable });

      // 2026-10-12 — untiered items used to sink below Tier IV on a tier sort
      // (owner: "items with no tier fall to the bottom"). Estimate a tier from
      // rarity, else from the list price on the RFI ladder (50/150/450/1350),
      // and say so in the label. Only a row with nothing to go on stays last.
      let tierEstimated = false;
      if (!tier) {
        const byRarity = { uncommon: "I", rare: "II", very_rare: "III", legendary: "IV", common: "I" }[rarity] || "";
        const m = Number(flagPrice?.marks);
        const byPrice = Number.isFinite(m) && m > 0 ? (m < 150 ? "I" : m < 450 ? "II" : m < 1350 ? "III" : "IV") : "";
        const est = (rarity && rarity !== "common" && byRarity) ? byRarity : (byPrice || byRarity);
        if (est) { tier = est; tierEstimated = true; }
      }

      return {
        id: e.id,
        name: e.name,
        blurb: e.blurb || "",
        kind: e.kind,
        kindLabel: kindLabel(e.kind),
        costLabel: costLabelForEntry(e, flagPrice),
        img,
        docUuid,
        docName,
        docType,
        isConsumable,
        tier,
        tierEstimated,
        tierLabel: tier ? `Tier ${tier}${tierEstimated ? " (est.)" : ""}` : "",
        tierRank: TIER_RANK[tier] ?? 99,  // only a row with no tier AND no price/rarity sorts after IV
        canOpen: !!docUuid,
        tabKey,
        rarity,
        costBand: _costBandFor(charge),
        paysLabel: _paysLabel(charge),
        affordKnown: !!afford,
        canAfford: !!afford?.ok,
        shortLabel: afford && !afford.ok
          ? (charge?.artifact ? "Artifact" : charge?.priceless ? "Priceless"
             : afford.short.map(x => `${poolShortLabel(x.pool)} −${x.by}`).join(" · "))
          : ""
      };
    }));

    // Tabs are computed on the vendor's whole stock so they don't vanish while
    // filtering; counts reflect the search / cost / affordability filters.
    const stockCounts = {};
    for (const r of entries) stockCounts[r.tabKey] = (stockCounts[r.tabKey] || 0) + 1;

    // Cost band (horizon-scaled when a faction is selected, list price otherwise).
    if (ctx.costBand) entries = entries.filter(r => r.costBand === ctx.costBand);
    // Only what we can afford — needs a Buyer Faction to mean anything.
    if (ctx.affordOnly && buyerFaction) entries = entries.filter(r => r.canAfford);

    const filteredCounts = {};
    for (const r of entries) filteredCounts[r.tabKey] = (filteredCounts[r.tabKey] || 0) + 1;
    // ALPHA CUT (2026-10-17): facilities + hex assets (and their upgrades) wait for Act 2 on player seats.
    const alphaDrop = new Set();
    if (game.bbttcc?.alpha?.hidden?.("marketFacilities")) { alphaDrop.add("facility"); alphaDrop.add("facility_upgrade"); }
    if (game.bbttcc?.alpha?.hidden?.("marketHexAssets")) alphaDrop.add("hex_asset");
    const visibleTabs = MARKET_TABS.filter(t => (stockCounts[t.key] || 0) > 0 && !alphaDrop.has(t.key));
    const wantTab = String(ctx.tab || ctx.category || "").toLowerCase();
    // ↺ Sell tab (2026-10-17): the Buyer Character's gear priced at what THIS vendor pays.
    const sellEnabled = _sellEnabled();
    const sellMode = sellEnabled && wantTab === "sell";
    let activeTab = sellMode ? "" : wantTab;
    if (!sellMode && !visibleTabs.some(t => t.key === activeTab)) activeTab = visibleTabs[0]?.key || "";
    const tabs = visibleTabs.map(t => ({ key: t.key, label: t.label, count: filteredCounts[t.key] || 0, active: !sellMode && t.key === activeTab }));
    let sellRows = [], sellLine = "", sellWarn = "", sellEmpty = "";
    if (sellEnabled) {
      const sellerChar = ctx.characterId ? game.actors.get(ctx.characterId) : null;
      const stance = vendorStanceFor(vendor, buyerFaction);
      sellLine = `${vendorName} pays ${stance.rate}% of list price — ${stance.label}.`;
      if (!buyerFaction) sellWarn = "Select a Buyer Domain — it receives the marks.";
      else if (!sellerChar) sellWarn = "Select a Buyer Character — their inventory is what's for sale.";
      else if (!(stance.rate > 0)) sellWarn = `${vendorName} refuses to trade with ${buyerFaction.name}.`;
      if (sellMode && buyerFaction && sellerChar) {
        const items = (sellerChar.items?.contents ?? []).filter(isSellableGearItem);
        sellRows = await Promise.all(items.map(async (it) => {
          const q = await sellQuote(it, { faction: buyerFaction, vendor });
          const tierLabel = q.tier ? `Tier ${q.tier}` : "";
          return {
            uuid: it.uuid, name: it.name, img: it.img || "", kindLabel: kindLabel(it.type === "weapon" || it.type === "armor" ? it.type : "gear"),
            tierLabel, qty: q.qty, stack: q.qty > 1, qtyLabel: q.qty > 1 ? `×${q.qty}` : "",
            sellable: q.ok, reason: q.reason, listLabel: q.listMarks ? `${q.listMarks} marks` : "—",
            rate: q.rate, rateLabel: `${q.rate}%`, rateTitle: q.stance ? `${q.listMarks} × ${q.rate}% — ${q.stance.label}` : "",
            payout: q.payout
          };
        }));
        sellRows.sort((a, b) => (Number(b.sellable) - Number(a.sellable)) || String(a.name).localeCompare(String(b.name)));
      }
      sellEmpty = sellWarn || "Nothing in this inventory can be sold here.";
      tabs.push({ key: "sell", label: "↺ Sell", count: sellMode ? sellRows.filter(r => r.sellable).length : "", active: sellMode });
    }
    if (activeTab) entries = entries.filter(r => r.tabKey === activeTab);
    if (sellMode) entries = [];

    // Sort: Name (default) / Tier asc / Tier desc. Tier sort secondaries
    // on name so equal-tier rows stay alphabetized.
    const sortMode = String(ctx.sort || "name").toLowerCase();
    const cmpName = (a, b) => String(a.name||"").localeCompare(String(b.name||""));
    if (sortMode === "tier_asc") {
      entries.sort((a, b) => (a.tierRank - b.tierRank) || cmpName(a, b));
    } else if (sortMode === "tier_desc") {
      entries.sort((a, b) => (b.tierRank - a.tierRank) || cmpName(a, b));
    } else {
      entries.sort(cmpName);
    }

    return {
      ...context,
      apiReady: true,
      isGM,
      vendorStatusLine,
      vendors,
      vendorName,
      factions,
      characters,
      entries,
      hexUuid: ctx.hexUuid,
      q: ctx.q,
      category: ctx.category,
      sort: ctx.sort,
      note: ctx.note,
      tabs,
      activeTab,
      sellMode, sellRows, sellLine, sellWarn, sellEmpty,
      treasury,
      hasFaction: !!buyerFaction,
      lockedBuyer,
      buyerCharacterName: (characters.find(c => c.selected) || {}).name || "",
      costBands: COST_BANDS.map(b => ({ ...b, selected: b.key === String(ctx.costBand || "") })),
      affordOnly: !!ctx.affordOnly,
      deliveryOptions,
      deliveryOtherOptions,
      deliveryUnlisted,
      deliveryNote
    };
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);

    const root = this.element?.[0] ?? this.element;
    if (!root) return;

    if (this._abort) { try { this._abort.abort(); } catch {} }
    this._abort = new AbortController();
    const sig = this._abort.signal;

    const vendorSel = root.querySelector("[data-role='vendor']");
    const factionSel = root.querySelector("[data-role='faction']");
    const charSel = root.querySelector("[data-role='character']");
    const hexInp = root.querySelector("[data-role='hexUuid']");
    const qInp = root.querySelector("[data-role='q']");
    const kindSel = root.querySelector("[data-role='kind']");
    const categorySel = root.querySelector("[data-role='category']");
    const sortSel = root.querySelector("[data-role='sort']");
    const noteInp = root.querySelector("[data-role='note']");
    const costBandSel = root.querySelector("[data-role='costBand']");
    const affordChk = root.querySelector("[data-role='affordOnly']");

// --- Economic Horizon chips (UI) ---
// Adds chips near Buy buttons without modifying templates.
try {
  const ctxNow0 = this._loadCtx();
  const buyerFaction0 = ctxNow0.factionId ? game.actors.get(ctxNow0.factionId) : null;
  const horizon0 = buyerFaction0 ? factionEconomicHorizon(buyerFaction0) : null;

  const catalogAll0 = game.settings.get(MODULE_ID, "catalog") || [];
  const catalogAll = Array.isArray(catalogAll0) ? catalogAll0 : [];

  const rows = Array.from(root.querySelectorAll("[data-entry-id]"));
  if (horizon0 && rows.length) {
    for (const row of rows) {
      const entryId = row.getAttribute("data-entry-id") || (row.dataset ? row.dataset.entryId : "");
      if (!entryId) continue;
      if (row.querySelector(".bbttcc-market-chip")) continue;

      const entry = catalogAll.find(e => e && e.id === entryId);
      if (!entry) continue;

      // Phase 5: prefer RFI item-flag price (gear) over legacy catalog cost.
      const flagPrice = await resolveItemFlagPrice(entry);
  const baseCost = flagPrice
    ? Number(flagPrice.marks)
    : (Number(entry?.cost?.economy ?? 0) || 0);   // both MARKS
      const rarity = await resolveEntryRarity(entry);
      const distance = rarityDistance(rarity, horizon0);
      const kind = String(entry?.kind || "").toLowerCase();
      const econCost = horizonEconCost(baseCost, distance, kind, rarity, flagPrice?.docFrame);

      // Pool label: "Split" if multi-pool, else short label for the native pool.
      let chipPoolLabel = "Econ";
      if (flagPrice?.split && Object.keys(flagPrice.split).length) {
        chipPoolLabel = "Split";
      } else if (flagPrice) {
        const pricing = game.fourththing?.pricing;
        const pool = (!flagPrice.currency || flagPrice.currency === "auto")
          ? (pricing?.defaultCurrencyForFrame?.(flagPrice.docFrame) ?? "economy")
          : flagPrice.currency;
        chipPoolLabel = poolShortLabel(pool);
      }

      const spec = chipSpecFor(rarity, horizon0, distance, baseCost, econCost, chipPoolLabel);

      const chip = document.createElement("span");
      chip.className = "bbttcc-market-chip";
      chip.textContent = spec.text || "";
      // Central help text + this row's rarity/horizon breakdown as one Foundry
      // tooltip; fall back to a native title when the help registry is absent.
      // 2026-10-12: row-specific breakdown only — the general Horizon lesson
      // moved to the catalog header's "How buying works" (owner: tooltips
      // covered the rows above and below and all said the same thing).
      if (spec.title) chip.dataset.tooltip = esc(spec.title);
      // Tour anchor — first chip only, so the anchor is unique.
      if (!root.querySelector('[data-tour="market.chip"]')) chip.dataset.tour = "market.chip";

      chip.style.cssText =
        "display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;line-height:16px;margin-right:8px;" +
        "border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.45);color:#e5e7eb;white-space:nowrap;" +
        (spec.style || "");

      const buyBtn = row.querySelector("button[data-action='buy']");
      if (buyBtn && buyBtn.parentElement) buyBtn.parentElement.insertBefore(chip, buyBtn);
      else row.appendChild(chip);
    }
  }
} catch {}

// --- Buyer proficiency notice (2026-08-27) ---
// When a Buyer Character is selected, weapon/armor rows gated on a skill they
// have at rank 0 get an "Untrained" chip — armor at rank 0 grants NO benefit
// and weapons swing untrained, so surface that before marks are spent.
// Uses the system's equipProficiency probe (same check as the sheet warning).
try {
  const ctxProf = this._loadCtx();
  const buyer = ctxProf.characterId ? game.actors.get(ctxProf.characterId) : null;
  const profFn = game.fourththing?.equipProficiency;
  if (buyer && typeof profFn === "function") {
    const catalogAllP0 = game.settings.get(MODULE_ID, "catalog") || [];
    const catalogAllP = Array.isArray(catalogAllP0) ? catalogAllP0 : [];
    for (const row of Array.from(root.querySelectorAll("[data-entry-id]"))) {
      if (row.querySelector(".bbttcc-market-prof-chip")) continue;
      const entryId = row.getAttribute("data-entry-id") || (row.dataset ? row.dataset.entryId : "");
      const entry = catalogAllP.find(e => e && e.id === entryId);
      if (!entry || String(entry.kind || "").toLowerCase() !== "gear") continue;
      const uuid = String(entry.uuid || "").trim();
      if (!uuid) continue;
      let doc = this._docCache.get(uuid);
      if (!doc) { try { doc = await fromUuid(uuid); if (doc) this._docCache.set(uuid, doc); } catch {} }
      if (!doc || !["weapon", "armor"].includes(String(doc.type || "").toLowerCase())) continue;
      const prof = profFn(buyer, doc);
      if (!prof || prof.trained) continue;

      const chip = document.createElement("span");
      chip.className = "bbttcc-market-prof-chip";
      chip.textContent = `⚠ Untrained: ${prof.label}`;
      const why = doc.type === "armor"
        ? "this armor grants no defensive benefit while worn"
        : "this weapon is wielded untrained";
      const detail = `${buyer.name} has ${prof.label} rank 0 — ${why}. Buying is allowed; raise ${prof.label} to rank 1+ to gain its benefit.`;
      chip.dataset.tooltip = esc(detail);   // 2026-10-12: row detail only (see "How buying works")
      chip.style.cssText =
        "display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;line-height:16px;margin-right:8px;" +
        "border:1px solid rgba(251,191,36,.45);background:rgba(120,53,15,.35);color:#fbbf24;white-space:nowrap;";

      const buyBtn = row.querySelector("button[data-action='buy']");
      if (buyBtn && buyBtn.parentElement) buyBtn.parentElement.insertBefore(chip, buyBtn);
      else row.appendChild(chip);
    }
  }
} catch {}


    const persist = () => {
      // Only controls that exist on this render write their key — the category
      // dropdown became the tab strip (2026-10-12), and a missing control must
      // not wipe a stored value.
      const patch = {};
      if (vendorSel)  patch.vendorId = vendorSel.value || "";
      if (factionSel) patch.factionId = factionSel.value || "";
      if (charSel)    patch.characterId = charSel.value || "";
      if (hexInp)     patch.hexUuid = hexInp.value || "";
      if (qInp)       patch.q = qInp.value || "";
      if (kindSel)    patch.kind = kindSel.value || "";
      if (categorySel) patch.category = categorySel.value || "";
      if (sortSel)    patch.sort = sortSel.value || "name";
      if (noteInp)    patch.note = noteInp.value || "";
      if (costBandSel) patch.costBand = costBandSel.value || "";
      if (affordChk)  patch.affordOnly = !!affordChk.checked;
      this._saveCtx(patch);
    };

    [vendorSel, factionSel, charSel, kindSel, categorySel, sortSel, costBandSel, affordChk].forEach(el => {
      el?.addEventListener("change", () => { persist(); this.render(false); }, { signal: sig });
    });
    [hexInp, qInp, noteInp].forEach(el => {
      el?.addEventListener("input", () => { persist(); }, { signal: sig });
      el?.addEventListener("change", () => { persist(); this.render(false); }, { signal: sig });
    });

    root.addEventListener("click", async (ev) => {
      const ctl = ev.target?.closest?.("[data-action]");
      if (!ctl) return;
      const act = ctl.dataset.action;

      if (act === "manage") { game.bbttcc?.api?.market?.openCatalogEditor?.(); return; }

      if (act === "howto") {
        ev.preventDefault(); ev.stopPropagation();
        const tip = (k) => game.bbttcc?.help?.tip?.("market", k) || "";
        const sections = [
          ["Buy", tip("buy")], ["Cost", tip("cost")], ["Economic Horizon chip", tip("chip")],
          ["Untrained chip", tip("profChip")], ["Pay from", tip("payFromPool")], ["Split payment", tip("splitPay")],
          ["Treasury", tip("treasury")], ["Only what we can afford", tip("affordOnly")], ["Cost band", tip("costBand")],
          ["Selling", tip("sell")], ["Sell-back rate", tip("sellRate")]
        ].filter(([, v]) => v);
        const html = `<div class="bbttcc-market-howto-body">${sections.map(([h, v]) => `<p><b>${esc(h)}</b> — ${esc(v)}</p>`).join("")}</div>`;
        const DV2 = foundry.applications.api?.DialogV2;
        try {
          if (DV2?.prompt) await DV2.prompt({ window: { title: "How buying works" }, content: html, position: { width: 560 }, rejectClose: false, ok: { label: "Got it" } });
          else new Dialog({ title: "How buying works", content: html, buttons: { ok: { label: "Got it" } } }, { width: 560 }).render(true);
        } catch (_e) {}
        return;
      }

      if (act === "tab") {
        ev.preventDefault(); ev.stopPropagation();
        const tab = String(ctl.dataset.tab || "");
        // `category` kept in step so callers that pre-set it keep landing on the right tab.
        this._saveCtx({ tab, category: tab });
        this.render(false);
        return;
      }

      if (act === "openDoc") {
        ev.preventDefault(); ev.stopPropagation();
        const uuid = String(ctl.dataset.uuid || "").trim();
        if (!uuid) return;
        try {
          const doc = await fromUuid(uuid);
          if (doc?.sheet) doc.sheet.render(true, { focus: true });
          else ui.notifications?.warn?.("Doc not available.");
        } catch (e) {
          console.error(e);
          ui.notifications?.error?.("Could not open item.");
        }
        return;
      }

      if (act === "sell") {
        ev.preventDefault(); ev.stopPropagation();
        const row = ctl.closest("[data-item-uuid]");
        const itemUuid = String(row?.dataset?.itemUuid || "");
        const qty = Math.max(1, Math.round(Number(row?.querySelector?.("[data-role='sellQty']")?.value) || 1));
        const c = this._loadCtx();
        const faction = game.actors.get(c.factionId);
        const vendor = _vendorsArray().map(_normalizeVendor).find(v => v.id === c.vendorId);
        const item = await fromUuid(itemUuid).catch(() => null);
        if (!item || !faction || !vendor) { ui.notifications?.warn?.("Pick a Buyer Domain and Buyer Character first."); return; }
        const quote = await sellQuote(item, { faction, vendor });
        if (!quote.ok) { ui.notifications?.warn?.(quote.reason || "Not sellable."); return; }
        const n = Math.min(qty, quote.qty);
        const total = quote.payout * n;
        const body = `<p>Sell <b>${esc(item.name)}</b>${n > 1 ? ` ×${n}` : ""} to <b>${esc(vendor.name)}</b> for <b>${total} marks</b>?</p>
          <p class="bbttcc-muted">List ${quote.listMarks} × ${quote.rate}% (${esc(quote.stance?.label || "neutral")}) → <b>${esc(faction.name)}</b>'s Economy bank.</p>`;
        const DV2 = foundry.applications.api?.DialogV2;
        let ok = false;
        try {
          if (DV2?.confirm) ok = await DV2.confirm({ window: { title: "Sell" }, content: body, rejectClose: false, yes: { label: "Sell" }, no: { label: "Keep it" } });
          else ok = await Dialog.confirm({ title: "Sell", content: body });
        } catch (_e) { ok = false; }
        if (!ok) return;
        try {
          const res = await sell({ itemUuid, factionId: faction.id, vendorId: vendor.id, qty: n, note: c.note });
          if (res?.ok) ui.notifications?.info?.(`Sold ${res.itemName || item.name}${n > 1 ? ` ×${n}` : ""} for ${res.payout} marks.`);
          else ui.notifications?.warn?.(res?.error || "Sale did not complete.");
        } catch (e) {
          ui.notifications?.error?.(e?.message || String(e));
        }
        this.render(false);
        return;
      }

      if (act !== "buy") return;

      ev.preventDefault(); ev.stopPropagation();

      const entryEl = ctl.closest?.("[data-entry-id]");
      const entryId = entryEl?.dataset?.entryId;
      if (!entryId) return;

      const ctxNow = this._loadCtx();
      // Charge the faction the window SHOWS (lastContext can be changed from a faction sheet).
      const shownFaction = this.element?.querySelector?.("select[name='factionId']")?.value;
      if (shownFaction) ctxNow.factionId = shownFaction;

      // Phase 5.5: pre-purchase confirmation dialog with cross-pool override.
      // Resolves the catalog entry + faction, then opens openBuyConfirmDialog.
      // For legacy catalog items the dialog auto-passes through.
      const catalog = game.settings.get(MODULE_ID, "catalog") || [];
      const entry = (Array.isArray(catalog) ? catalog : []).find(e => e?.id === entryId);
      const faction = game.actors.get(ctxNow.factionId);
      let confirmRes = { ok: true, payFromPool: null };
      if (entry && faction) {
        try {
          confirmRes = await openBuyConfirmDialog({ entry, factionId: ctxNow.factionId, faction, hexUuid: ctxNow.hexUuid });
        } catch (e) { console.warn("buy-confirm dialog failed (proceeding without)", e); }
      }
      if (!confirmRes?.ok) return;  // user cancelled

      try {
        const res = await purchase({
          entryId,
          factionId: ctxNow.factionId,
          characterId: ctxNow.characterId,
          hexUuid: ctxNow.hexUuid,
          note: ctxNow.note,
          payFromPool: confirmRes.payFromPool
        });
        ui.notifications?.info?.("Purchase complete.");
        this.render(false);
      } catch (e) {
        console.error(e);
        // Pre-spend validation aborts already warned the user (err.notified).
        if (!e?.notified) ui.notifications?.error?.(e?.message || "Purchase failed.");
      }
    }, { capture: true, signal: sig });
  }
}



/* ===================== Catalog Editor (Drag & Drop) ===================== */

// Every Item uuid in a world or compendium folder, subfolders included.
async function _folderItemUuids(folder) {
  if (!folder || folder.documentName !== "Folder" || folder.type !== "Item") return [];
  const ids = new Set([folder.id, ...((folder.getSubfolders?.(true) || []).map(f => f.id))]);
  const packId = folder.pack || folder.compendium?.collection || null;
  if (packId) {
    const pack = game.packs?.get?.(packId);
    if (!pack || pack.documentName !== "Item") return [];
    const index = await pack.getIndex({ fields: ["folder"] });
    return index.filter(e => ids.has(e.folder?._id ?? e.folder)).map(e => e.uuid || pack.getUuid?.(e._id)).filter(Boolean);
  }
  return (game.items?.contents || []).filter(it => ids.has(it.folder?.id)).map(it => it.uuid);
}

export class BBTTCCMarketCatalogEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-market-catalogs",
    window: { title: "Market Catalogs", icon: "fas fa-list", resizable: true },
    position: { width: 1100, height: 780 },
    classes: ["bbttcc", "bbttcc-market", "sheet"],
    resizable: true
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/catalog-editor.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this._abort = null;
    this._saving = false;
    const vendors = _vendorsArray().map(_normalizeVendor);
    this.vendorId = vendors?.[0]?.id || "vendor";
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const vendorsRaw = _vendorsArray().map(_normalizeVendor);
    const vendorId = this.vendorId || vendorsRaw?.[0]?.id;
    const vendors = vendorsRaw.map(v => ({ id: v.id, name: v.name, active: v.active !== false, displayName: (v.active === false) ? `${v.name} (inactive)` : v.name, selected: v.id === vendorId }));
    const vendor = vendorsRaw.find(v => v.id === vendorId) || vendorsRaw[0] || _normalizeVendor({ id: "vendor", name: "Vendor" });

    const entriesRaw = _catalogArray().filter(e => String(e.vendorId) === String(vendorId)).map(_normalizeEntry);
    const entries = entriesRaw.map(e => ({
      id: e.id,
      name: e.name,
      blurb: e.blurb,
      econ: Number(e.cost?.economy ?? 0) || 0,
      payload: _entryPayloadString(e),
      kind: e.kind,
      isGear: e.kind === "gear",
      isRig: e.kind === "rig",
      isFacility: e.kind === "facility",
      isHexAsset: e.kind === "hex_asset",
      isRigUpgrade: e.kind === "rig_upgrade",
      isFacilityUpgrade: e.kind === "facility_upgrade",
      isActor: e.kind === "actor",
      isContract: e.kind === "contract"
    }));

    const vendorTagsRaw = Array.isArray(vendor.tags) ? vendor.tags.join(", ") : String(vendor.tags || "");
    // Owning faction (sell-back stance, 2026-10-17). Shows the name-matched fallback as a hint.
    const autoFaction = vendor.factionId ? null : vendorFactionFor(vendor);
    const factionOptions = allFactions()
      .map(a => ({ id: a.id, name: a.name, selected: a.id === vendor.factionId }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return {
      ...context,
      vendors,
      vendor: { ...vendor, tagsRaw: vendorTagsRaw },
      factionOptions,
      autoFactionName: autoFaction?.name || "",
      entries
    };
  }

  async _onRender(ctx, opts) {
  await super._onRender(ctx, opts);
  const root = this.element?.[0] ?? this.element;
  if (!root) return;

  // Prevent listener stacking on rerender.
  if (this._abort) { try { this._abort.abort(); } catch {} }
  this._abort = new AbortController();
  const sig = this._abort.signal;

  const vendorSel = root.querySelector("[data-role='vendor']");
  vendorSel?.addEventListener("change", () => {
    this.vendorId = vendorSel.value;
    this.render(false);
  }, { signal: sig });

  const dz = root.querySelector("[data-role='dropzone']");
  if (dz) {
    dz.addEventListener("dragover", (ev) => { ev.preventDefault(); dz.classList.add("is-over"); }, { signal: sig });
    dz.addEventListener("dragleave", () => dz.classList.remove("is-over"), { signal: sig });
    dz.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      dz.classList.remove("is-over");

      let data = {};
      try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch {}
      if (!data || typeof data !== "object") return;

      try {
        const imported = await this._importDropData(data);
        if (imported?.count) ui.notifications?.info?.(`Imported ${imported.count} item(s) into catalog.`);
        this.render(false);
      } catch (e) {
        console.error(e);
        ui.notifications?.error?.(e?.message || "Import failed.");
      }
    }, { signal: sig });
  }

  root.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("button");
    if (!btn) return;
    const act = btn.dataset.action;

    if (act === "vendor-add") return this._vendorAdd();
    if (act === "vendor-del") return this._vendorDeleteSelected(); // dialog-confirmed
    if (act === "entry-add") return this._entryAdd();
    if (act === "save") return this._saveAll();

    const row = btn.closest?.("[data-entry-id]");
    if (!row) return;
    const entryId = row.dataset.entryId;

    if (act === "del") return this._entryDelete(entryId);
    if (act === "dup") return this._entryDuplicate(entryId);
  }, { capture: true, signal: sig });
}

  _readVendorForm() {
    const root = this.element?.[0] ?? this.element;
    const vendors = _vendorsArray().map(_normalizeVendor);
    const idx = vendors.findIndex(v => v.id === this.vendorId);
    if (idx < 0) return null;

    const name = root.querySelector("[data-role='vendorName']")?.value || vendors[idx].name;
    const blurb = root.querySelector("[data-role='vendorBlurb']")?.value || "";
    const tagsRaw = root.querySelector("[data-role='vendorTags']")?.value || "";
    const active = !!root.querySelector("[data-role='vendorActive']")?.checked;
    const factionId = String(root.querySelector("[data-role='vendorFaction']")?.value || "");

    vendors[idx] = _normalizeVendor({ ...vendors[idx], name, blurb, tags: tagsRaw, active, factionId });
    return { vendors, vendorId: vendors[idx].id };
  }

  _readEntriesForm() {
    const root = this.element?.[0] ?? this.element;
    const vendorId = this.vendorId;

    const all = _catalogArray().map(_normalizeEntry);
    const keep = all.filter(e => e.vendorId !== vendorId);
    const prevById = new Map(all.filter(e => e.vendorId === vendorId).map(e => [e.id, e]));

    const rows = [...root.querySelectorAll("[data-entry-id]")];
    const entries = rows.map(row => {
      const id = row.dataset.entryId;
      const name = row.querySelector("[data-k='name']")?.value || id;
      const kind = row.querySelector("[data-k='kind']")?.value || "gear";
      const econ = Number(row.querySelector("[data-k='cost.economy']")?.value || 0) || 0;
      const blurb = row.querySelector("[data-k='blurb']")?.value || "";
      const payload = row.querySelector("[data-k='payload']")?.value || "";

      // Merge the form fields over the existing entry so fields the form
      // doesn't surface (rarity, tier, non-economy cost pools, ...) survive
      // a Save instead of being rebuilt from scratch.
      const prev = prevById.get(id) || {};
      const base = { ...prev, id, vendorId, kind, name, blurb, cost: { ...(prev.cost || {}), economy: econ } };
      if (prev.kind && prev.kind !== kind) {
        // Kind changed: drop the old kind's payload field so e.g. a stale gear
        // uuid can't ghost-price the row (resolveItemFlagPrice reads entry.uuid
        // regardless of kind).
        delete base.uuid; delete base.rigData; delete base.facilityPatch; delete base.asset; delete base.patch;
      }

      if (kind === "gear" || kind === "actor") return _normalizeEntry({ ...base, uuid: payload.trim() });
      if (kind === "contract") return _normalizeEntry({ ...base, contract: _safeJsonParse(payload, {}) });
      if (kind === "rig") return _normalizeEntry({ ...base, rigData: _safeJsonParse(payload, {}) });
      if (kind === "facility") return _normalizeEntry({ ...base, facilityPatch: _safeJsonParse(payload, {}) });
      if (kind === "hex_asset") return _normalizeEntry({ ...base, asset: _safeJsonParse(payload, {}) });
      if (kind === "rig_upgrade" || kind === "facility_upgrade") return _normalizeEntry({ ...base, patch: _safeJsonParse(payload, {}) });

      return _normalizeEntry(base);
    });

    return keep.concat(entries);
  }

  async _saveAll() {
  if (this._saving) return;
  const vf = this._readVendorForm();
  if (!vf) return;

  const nextVendors = vf.vendors;
  const nextCatalog = this._readEntriesForm();

  this._saving = true;
  try {
    await game.settings.set(MODULE_ID, "vendors", nextVendors);
    await game.settings.set(MODULE_ID, "catalog", nextCatalog);
    ui.notifications?.info?.("Catalogs saved.");
  } finally {
    this._saving = false;
  }

  this.render(false);
}

  async _vendorAdd() {
    const vendors = _vendorsArray().map(_normalizeVendor);
    const id = _makeId("vendor");
    vendors.push(_normalizeVendor({ id, name: "New Vendor", blurb: "", tags: [] }));
    await game.settings.set(MODULE_ID, "vendors", vendors);
    this.vendorId = id;
    this.render(false);
  }

  async _vendorDeleteSelected() {
    const vendorId = this.vendorId;
    const vendors = _vendorsArray().map(_normalizeVendor);
    const idx = vendors.findIndex(v => v.id === vendorId);
    if (idx < 0) return ui.notifications?.warn?.("No market selected to delete.");
    const vendor = vendors[idx];

    const entryCount = _catalogArray().filter(e => String(e?.vendorId) === String(vendorId)).length;
    const DialogV2 = foundry.applications.api?.DialogV2;
    if (!DialogV2) return ui.notifications?.warn?.("Confirmation dialog unavailable — market not deleted.");
    const confirmed = await DialogV2.confirm({
      window: { title: "Delete Market" },
      content: `<p>Delete <b>${esc(vendor.name)}</b> and its <b>${entryCount}</b> catalog entr${entryCount === 1 ? "y" : "ies"}?</p>
                <p style="font-size:0.85rem;opacity:0.7;">This cannot be undone.</p>`,
      defaultYes: false,
      rejectClose: false
    }).catch(() => false);
    if (!confirmed) return;

    vendors.splice(idx, 1);
    // Drop the vendor's entries verbatim (no re-normalization needed for a pure filter).
    const nextCatalog = _catalogArray().filter(e => String(e?.vendorId) !== String(vendorId));
    await game.settings.set(MODULE_ID, "vendors", vendors);
    await game.settings.set(MODULE_ID, "catalog", nextCatalog);
    ui.notifications?.info?.(`Deleted market "${vendor.name}" (${entryCount} entries removed).`);

    this.vendorId = vendors[0]?.id || "";
    this.render(false);
  }

  async _entryAdd() {
    const cat = _catalogArray().map(_normalizeEntry);
    const id = _makeId("entry");
    cat.unshift(_normalizeEntry({ id, vendorId: this.vendorId, kind: "gear", name: "New Entry", blurb: "", uuid: "", cost: { economy: 10 } }));
    await game.settings.set(MODULE_ID, "catalog", cat);
    this.render(false);
  }

  async _entryDelete(entryId) {
    const vendorId = this.vendorId;
    const cat = _catalogArray().map(_normalizeEntry).filter(e => !(e.vendorId === vendorId && e.id === entryId));
    await game.settings.set(MODULE_ID, "catalog", cat);
    this.render(false);
  }

  async _entryDuplicate(entryId) {
    const vendorId = this.vendorId;
    const cat = _catalogArray().map(_normalizeEntry);
    const src = cat.find(e => e.vendorId === vendorId && e.id === entryId);
    if (!src) return;
    const dup = foundry.utils.duplicate(src);
    dup.id = _makeId("entry");
    dup.name = `${dup.name} (Copy)`;
    cat.unshift(_normalizeEntry(dup));
    await game.settings.set(MODULE_ID, "catalog", cat);
    this.render(false);
  }

  async _importDropData(data) {
    const vendorId = this.vendorId;

    const type = String(data.type || "").toLowerCase();
    const uuid = data.uuid || data?.data?.uuid;
    let uuids = [];

    if (uuid && _uuidish(uuid)) {
      if (type === "item") {
        uuids = [uuid];
      } else if (type === "folder" || uuid.startsWith("Folder.") || uuid.includes(".Folder.")) {
        // fromUuid resolves world AND compendium folders; recurse into subfolders.
        uuids = await _folderItemUuids(await fromUuid(uuid).catch(() => null));
      } else {
        const doc = await fromUuid(uuid);
        if (doc?.documentName === "Item") uuids = [doc.uuid];
      }
    } else if (type === "folder" && data.id) {
      uuids = await _folderItemUuids(game.folders?.get?.(data.id));
    }

    if (!uuids.length) throw new Error("Drop did not resolve to any Items.");

    const catalog = _catalogArray().map(_normalizeEntry);
    let count = 0;

    for (const u of uuids) {
      const doc = await fromUuid(u);
      const name = doc?.name || "Item";
      const id = _makeId("gear");
      catalog.unshift(_normalizeEntry({ id, vendorId, kind: "gear", name, blurb: "", uuid: u, cost: { economy: 10 } }));
      count += 1;
    }

    await game.settings.set(MODULE_ID, "catalog", catalog);
    return { count };
  }
}
/* ===================== API surface ===================== */

Hooks.once("ready", () => {
  game.bbttcc ??= {};
  game.bbttcc.api ??= {};
  game.bbttcc.api.market ??= {};

  // Central help registry (bbttcc-core). Guarded — core may be disabled; by
  // ready, core's init has definitely run if it's enabled, so this is order-safe.
  game.bbttcc?.help?.register?.("market", MARKET_TIPS);

  game.bbttcc.api.market.purchase = purchase;
  game.bbttcc.api.market.sell = sell;
  game.bbttcc.api.market.sellQuote = sellQuote;
  game.bbttcc.api.market.vendorStanceFor = vendorStanceFor;
  game.bbttcc.api.market.domainOf = domainOf;   // ruling 16: a steward's Domain (faction actor), for the Domain tab and friends

  // GM side of the player SELL relay (2026-10-17) — the seat must own both the faction and the seller.
  try {
    game.bbttcc?.api?.gmExec?.register?.(SELL_RELAY, async (p, meta) => {
      const u = game.users?.get?.(meta?.fromUserId);
      const faction = game.actors?.get?.(String(p?.factionId || ""));
      if (!u || !faction || !isFactionActor(faction)) throw new Error("Seller faction not found.");
      if (!u.isGM && !faction.testUserPermission(u, "OWNER")) throw new Error("You can only sell for a faction you own.");
      const item = await fromUuid(String(p?.itemUuid || "")).catch(() => null);
      if (!item?.parent) throw new Error("Item not found in an inventory.");
      if (!u.isGM && !item.parent.testUserPermission(u, "OWNER")) throw new Error("You can only sell from a character you own.");
      const vendor = _vendorsArray().map(_normalizeVendor).find(v => v.id === String(p?.vendorId || ""));
      if (!u.isGM && vendor && vendor.active === false) throw new Error("That market is closed.");
      return sell({ itemUuid: p?.itemUuid, factionId: faction.id, vendorId: p?.vendorId, qty: p?.qty, note: p?.note, _relayed: !meta?.local });
    });
  } catch (eReg) { warn("gmExec market.sell registration failed", eReg); }

  // GM side of the player purchase relay — re-validate everything the seat could fake.
  try {
    game.bbttcc?.api?.gmExec?.register?.(PURCHASE_RELAY, async (p, meta) => {
      const u = game.users?.get?.(meta?.fromUserId);
      const faction = game.actors?.get?.(String(p?.factionId || ""));
      if (!u || !faction || !isFactionActor(faction)) throw new Error("Buyer faction not found.");
      if (!u.isGM && !faction.testUserPermission(u, "OWNER")) throw new Error("You can only buy for a faction you own.");
      const entry = _catalogArray().find(e => e?.id === p?.entryId);
      const vendor = entry ? _vendorsArray().map(_normalizeVendor).find(v => v.id === entry.vendorId) : null;
      if (!u.isGM && vendor && vendor.active === false) throw new Error("That market is closed.");
      return purchase({ entryId: p?.entryId, factionId: faction.id, characterId: p?.characterId, hexUuid: p?.hexUuid, note: p?.note, payFromPool: p?.payFromPool, _relayed: !meta?.local });
    });
  } catch (eReg) { warn("gmExec market.purchase registration failed", eReg); }
  game.bbttcc.api.market.openMarket = (() => {
    let inst = null;
    return () => {
      // Re-render an open window: the faction-sheet button changes lastContext, and a
      // stale on-screen faction would otherwise disagree with the one Buy charges.
      if (inst && inst.rendered) { inst.render({ force: true }); inst.bringToFront?.(); return inst; }
      inst = new BBTTCCMarketApp();
      inst.render(true, { focus: true });
      return inst;
    };
  })();

game.bbttcc.api.market.openCatalogEditor = (() => {
  let inst = null;
  return () => {
    if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
    if (inst && inst.rendered) { inst.bringToFront?.(); return inst; }
    inst = new BBTTCCMarketCatalogEditorApp();
    inst.render(true, { focus: true });
    return inst;
  };
})();


  game.bbttcc.api.market.listVendors = () => foundry.utils.duplicate(_vendorsArray().map(_normalizeVendor));

  game.bbttcc.api.market.listCatalog = () => foundry.utils.duplicate(_catalogArray().map(_normalizeEntry));

  // 2026-10-13: the hex danger score (0–12, itemised) is shared — bbttcc-travel keys the travel encounter
  // TIER off it (setting bbttcc-core.travelTierSource = "danger"). Pass a hex Drawing document (+ the
  // travelling faction id for the holder-stance part).
  game.bbttcc.api.market.hexDanger = (d, factionId = "") => _hexDanger(d, factionId);

  

  // ---------------------------
  // Player-facing launcher: Faction Sheet header button
  // - Visible to: GM, and players who own the faction actor
  // - Clicking opens the Market and preselects the faction in lastContext
  // ---------------------------
  try {
    Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
      try {
        const actor = app?.actor;
        if (!actor || !isFactionActor(actor)) return;
        const canOpen = game.user?.isGM || actor?.isOwner;
        if (!canOpen) return;

        buttons.unshift({
          label: "Market",
          class: "bbttcc-open-market",
          icon: "fas fa-store",
          onclick: async () => {
            try {
              // preselect faction for convenience
              const cur = game.settings.get(MODULE_ID, "lastContext") || {};
              const next = foundry.utils.mergeObject(cur, { factionId: actor.id }, { inplace:false, overwrite:true });
              await game.settings.set(MODULE_ID, "lastContext", next);
            } catch (_e) {}
            try { game.bbttcc?.api?.market?.openMarket?.(); } catch (e) { console.error(e); }
          }
        });
      } catch (_e) {}
    });
  } catch (_e) {}

log("ready — market API mounted at game.bbttcc.api.market (openMarket/openCatalogEditor/purchase/listVendors/listCatalog)");
});


// ── Catalog unit migration (owner ruling 2026-09-06: marks everywhere) ──────
// Legacy catalog rows were authored in OP; every consumer now reads them as MARKS.
// Runs once per world (GM), multiplies every numeric cost field ×10, stamps the flag.
Hooks.once("ready", async () => {
  try {
    if (!game.user?.isGM) return;
    if (game.settings.get(MODULE_ID, "catalogMarksMigrated")) return;
    const M = (game.bbttcc?.api?.op?.OP_TO_MARKS ?? game.fourththing?.constants?.MARKS_PER_OP ?? game.fourththing?.pricing?.MARKS_PER_OP);
    if (!Number.isFinite(Number(M))) { console.warn(`[${MODULE_ID}] catalog migration skipped — MARKS_PER_OP unavailable`); return; }
    const raw = game.settings.get(MODULE_ID, "catalog");
    const cat = Array.isArray(raw) ? foundry.utils.deepClone(raw) : [];
    let rows = 0;
    for (const e of cat) {
      if (!e || typeof e !== "object" || !e.cost || typeof e.cost !== "object") continue;
      for (const [k, v] of Object.entries(e.cost)) { const n = Number(v); if (Number.isFinite(n) && n !== 0) { e.cost[k] = Math.round(n * Number(M)); rows++; } }
    }
    if (rows) await game.settings.set(MODULE_ID, "catalog", cat);
    await game.settings.set(MODULE_ID, "catalogMarksMigrated", true);
    console.log(`[${MODULE_ID}] catalog costs migrated OP → marks (×${M}): ${rows} cost field(s) on ${cat.length} entr${cat.length === 1 ? "y" : "ies"}.`);
    if (rows) ui.notifications?.info?.(`Bad Eden Market: ${rows} catalog price(s) converted to marks (×${M}).`);
  } catch (e) { console.error(`[${MODULE_ID}] catalog marks migration failed`, e); }
});
