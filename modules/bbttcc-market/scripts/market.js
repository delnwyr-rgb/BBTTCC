
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

  - Tier A → Uncommon
  - Tier B → Rare
  - Tier C → Very Rare
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
  const tier = String(factionActor?.getFlag?.(MOD_FACTIONS, "tier") || "A").toUpperCase();
  if (tier === "C") return "very_rare";
  if (tier === "B") return "rare";
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
    return {
      marks:      Number(price.marks),
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
        if (raw) return normalizeRarity(_normalizeExternalRarity(raw));
        // No native rarity — derive from RFI tier if present (T1→uncommon,
        // T2→rare, T3→very_rare, T4→legendary). Roman numerals supported.
        const rfiTier = foundry.utils.getProperty(doc, "flags.fourththing.rfi.item.tier")
                     ?? foundry.utils.getProperty(doc, "flags.rfi.item.tier"); // legacy path
        if (rfiTier) {
          const tierInt = { I: 1, II: 2, III: 3, IV: 4 }[String(rfiTier).toUpperCase()] ?? Number(rfiTier);
          const mapped = _tierToRarity(tierInt);
          if (mapped) return normalizeRarity(mapped);
        }
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
      const mapped = _tierToRarity(t);
      if (mapped) return normalizeRarity(mapped);
    }
  } catch {}

  // 4) Default
  return "common";
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
    return {
      text: e0 ? `Standard Issue • ${pLab} ${e0}` : "Standard Issue",
      title: e0 ? `Rarity ${rLab} (≤ Horizon ${hLab}) • Base ${b0} → ${e0}` : `Rarity ${rLab} (≤ Horizon ${hLab})`,
      style: "border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.10);"
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
  return "Thing";
}

function costLabel(cost) {
  const c = cost && typeof cost === "object" ? cost : {};
  const econ = Number(c.economy ?? 0) || 0;
  const parts = [];
  if (econ) parts.push(`Econ ${econ}`);
  const rest = Object.entries(c).filter(([k,_]) => k !== "economy").map(([k,v]) => `${k} ${v}`);
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
  return { id, name: String(v?.name || id), blurb: String(v?.blurb || ""), tags: tags.map(t=>String(t)), active };
}


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
  return "";
}

/* ===================== Help / tooltip dictionary (central registry) =====================

   Registered into game.bbttcc.help (bbttcc-core) under appKey "market" at ready.
   Consumed three ways:
     - templates:   data-tooltip="{{bbttccTip 'market' '<key>'}}"
     - JS DOM:      game.bbttcc.help.tip("market", "<key>")  (horizon chips, buy dialog)
     - tours:       inert data-tour="market.<key>" anchors use the same keys.
   Style: "Name — what it is. What it does mechanically. When/why you'd use it."
*/
const MARKET_TIPS = {
  // ---- Market app (player-facing) ----
  context:   "Context — who is buying and where deliveries land. Vendor + Buyer Faction are required; Buyer Character only matters for gear, the Delivery Hex only for facility/asset purchases. All picks persist per client between sessions.",
  vendor:    "Vendor — which market you are browsing. Players only see markets the GM has flagged Active; the GM sees inactive ones suffixed '(inactive)'. Your selection is remembered per client.",
  faction:   "Buyer Faction — the faction whose OP bank pays for every purchase here (1 OP = 10 marks). Players see factions they own; the GM sees all. The purchase receipt is written to this faction's war log.",
  character: "Buyer Character — where purchased GEAR lands: a copy of the item is created in this character's inventory, stamped as vendor-bought. Required before buying gear; ignored for rigs, facilities, and hex assets.",
  hex:       "Delivery Hex UUID — target hex for facility, facility-upgrade, and hex-asset purchases (a Drawing UUID, e.g. Scene.<id>.Drawing.<id>). Facilities merge onto the hex's primary facility; assets append to its asset list. Those purchases cannot complete without it. Gear and rigs ignore this field.",
  note:      "Notes — free text stamped onto the purchase receipt (faction war log entry + GM whisper). Use it to record why, or for whom, the purchase was made.",
  manage:    "Manage Catalogs — GM-only editor for vendors and their catalog entries. Add or rename markets, toggle player visibility, drag-drop items in, set costs.",
  catalog:   "Catalog — the selected vendor's stock, filtered by search/category and sorted. Each row shows kind, RFI tier, list cost, and an Economic Horizon chip with the final price your faction actually pays.",
  search:    "Search — live filter on entry name, blurb, and kind text within the selected vendor's catalog.",
  category:  "Category — filters the list. Weapons / Armor / Gear / Consumables subdivide gear entries by the underlying item's type (consumables are detected via RFI frame, slot, or tag); the remaining options match the entry kind directly (rig, facility, hex asset, upgrades).",
  sort:      "Sort — Name (A→Z), or RFI Tier (I–IV) ascending/descending. Entries with no tier sort after Tier IV; equal-tier rows stay alphabetized.",
  openDoc:   "Open item sheet — inspect the actual item (stats, description, tier) before you spend marks on it.",
  cost:      "Cost — the list price. RFI flag-priced items show their native pool in marks (e.g. 'Viol 50 marks'); 'Split' items pay each portion to its own pool; legacy entries show catalog Economy OP (1 OP = 10 marks). The Horizon chip shows the final scaled price your faction pays.",
  chip:      "Economic Horizon — your faction's tier sets its rarity horizon (Tier A→Uncommon, B→Rare, C→Very Rare). At or under the horizon, gear is Standard Issue (free; rigs/facilities/assets still pay base cost). Above it the price strains: ×1 / ×2 / ×4 at 1 / 2 / 3+ rarity steps over. Artifacts are never purchasable — discovery only.",
  profChip:  "Untrained — the selected Buyer Character has rank 0 in the skill this weapon or armor is gated on. Armor worn at rank 0 grants NO defensive benefit; weapons are wielded untrained. You can still buy it (stockpiling, training ahead, gifting) — the chip is a warning, not a block.",
  buy:       "Buy — commits the purchase: confirmation first (flag-priced items let you pay from a non-native pool at ×1.5 friction), then the marks are spent from the Buyer Faction's OP bank and the goods are delivered — gear to the Buyer Character's inventory, rigs to the faction, facilities/assets/upgrades to the Delivery Hex, actor entries cloned into the world under the buying faction. Writes a war-log receipt and whispers the GM.",
  payFromPool: "Pay from — which OP pool covers the bill. The native pool pays list price; any other pool pays ×1.5 (cross-pool friction). Balances shown are the faction's current opBank, in marks.",
  splitPay:  "Split payment — this item's price is divided across multiple OP pools. Each portion is always paid from its native pool; there is no cross-pool override on split items.",

  // ---- Catalog editor (GM-facing) ----
  editorVendor:  "Vendor — which market's catalog you are editing. The vendor fields and every entry row below belong to this vendor.",
  vendorAdd:     "Add Vendor — creates a new market ('New Vendor') and selects it, saved immediately. New markets start Active (player-visible); rename and stock it, then Save.",
  entryAdd:      "Add Entry — prepends a blank gear entry (Economy OP cost 1) to this vendor's catalog, saved immediately. Fill in its fields, then hit Save to persist the edits.",
  vendorDel:     "Delete Market — removes the selected vendor from the vendor list.",
  save:          "Save — writes the vendor fields and every entry row on screen into the world settings. Field edits are NOT persisted until you Save; add / duplicate / delete / drop-import actions save on their own.",
  vendorActive:  "Active — player-visibility switch. Unchecked, this market is hidden from the player Market app entirely (the GM still sees it, marked '(inactive)'). Stage a market before opening it, or close one narratively.",
  vendorName:    "Name — the market's display name, shown in every vendor picker.",
  vendorBlurb:   "Blurb — one line of flavor for this market. Informational only.",
  vendorTags:    "Tags — comma-separated labels stored on the vendor. Informational metadata (readable via the market API); no mechanical effect.",
  dropzone:      "Drop zone — drag Items or whole Folders from the sidebar or a compendium here. Each item becomes a Gear entry with its UUID prefilled and a default cost of 1 Economy OP, saved immediately.",
  editorEntries: "Entries — every catalog row this vendor stocks. Edit fields inline (then Save), or use the row buttons to duplicate / delete.",
  entryName:     "Name — the entry's display name in the player catalog (independent of the underlying item's own name).",
  entryKind:     "Kind — what the purchase delivers. gear → item copy to the buyer character; rig → new rig on the buying faction; facility → merged onto the delivery hex's primary facility; hex_asset → appended to the hex's asset list; rig_upgrade / facility_upgrade → JSON patch merged onto an existing rig / the hex facility; actor → clones a prebuilt Actor (rig/boss/NPC) into the world, assigned to the buying faction.",
  entryCost:     "Economy OP Cost — the legacy base price, in Economy OP (fractional allowed; 1 OP = 10 marks). For gear whose item carries a stamped RFI flag price (flags.fourththing.rfi.item.price), the flag price overrides this number. The final charge is scaled by the buyer's Economic Horizon (×1/×2/×4 over-horizon; Standard Issue gear is free).",
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
    cost: { economy: 1 }
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
    cost: { economy: 3 }
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
    cost: { economy: 4 }
  },
  {
    id: "hex-asset-workshop",
    vendorId: "furriers-fixit-farm",
    kind: "hex_asset",
    name: "Workshop Bay (Hex Asset)",
    blurb: "A place where tools exist and people argue about them.",
    asset: { key: "workshop_bay", label: "Workshop Bay" },
    cost: { economy: 2 }
  }

,
{
  id: "gear-xvli",
  vendorId: "mall-of-forgotten-yesterdays",
  kind: "gear",
  name: "Imported Item",
  blurb: "",
  uuid: "Compendium.bbttcc-master-content.items.Item.XvliX6HYw04Ao3A4",
  cost: { economy: 1 }
},
{
  id: "gear-hlvn",
  vendorId: "mall-of-forgotten-yesterdays",
  kind: "gear",
  name: "Imported Item",
  blurb: "",
  uuid: "Compendium.bbttcc-master-content.items.Item.HlvNlhDr9F2COugT",
  cost: { economy: 1 }
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

  game.settings.register(MODULE_ID, "lastContext", {
    name: "Market Context",
    scope: "client",
    config: false,
    type: Object,
    default: { vendorId: DEFAULT_VENDORS[0].id, factionId: "", characterId: "", hexUuid: "", q: "", kind: "", category: "", sort: "name", note: "" }
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

  // econCost is in OP (catalog units); engine consumes MARKS (1 OP = 10 marks).
  const OP_TO_MARKS = (opApi.OP_TO_MARKS ?? 10);
  const marksDelta = -Math.abs(Math.round(n * OP_TO_MARKS));
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
  if (data.type === "rig") {
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
  return { clonedId: created?.id ?? null, sourceUuid, type: data.type };
}


async function _getFactionRigsArray(factionActor) {
  const rigs = factionActor.getFlag(MOD_FACTIONS, "rigs");
  return Array.isArray(rigs) ? foundry.utils.duplicate(rigs) : [];
}

async function applyRigUpgradePatch(factionId, patch, meta = {}) {
  const faction = game.actors.get(factionId);
  if (!faction) throw new Error("Faction not found.");

  const rigs = await _getFactionRigsArray(faction);
  if (!rigs.length) throw new Error("Faction has no rigs to upgrade.");

  const target = patch?.target || {};
  let idx = -1;
  if (target.rigId) idx = rigs.findIndex(r => r?.rigId === target.rigId);
  if (idx < 0 && target.name) idx = rigs.findIndex(r => String(r?.name||"") === String(target.name));
  if (idx < 0 && target.latest) idx = 0;
  if (idx < 0) idx = 0;

  const cur = rigs[idx] || {};
  const next = foundry.utils.mergeObject(foundry.utils.duplicate(cur), foundry.utils.duplicate(patch?.patch || patch), { inplace:false, overwrite:true });
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
async function openBuyConfirmDialog({ entry, factionId, faction }) {
  const flagPrice = await resolveItemFlagPrice(entry);
  if (!flagPrice) return { ok: true, payFromPool: null };   // legacy path

  // Horizon-scaled cost — MUST mirror purchase()'s math exactly, or the dialog
  // shows a different number than what actually commits (fixed 2026-07-07):
  // Standard Issue gear is free, over-horizon strains ×2/×4, non-gear kinds
  // pay base within horizon.
  const dOPtoMarks = (game.bbttcc?.api?.op?.OP_TO_MARKS ?? 10);
  const dBaseCost = Number(flagPrice.marks) / dOPtoMarks;
  const dDistance = rarityDistance(await resolveEntryRarity(entry), factionEconomicHorizon(faction));
  const dKind = String(entry.kind || "").toLowerCase();
  let dEconCost = scaledEconomyCost(dBaseCost, dDistance);
  if (dDistance <= 0 && dKind && dKind !== "gear") dEconCost = dBaseCost;
  const scaledMarks = Math.round(dEconCost * dOPtoMarks);
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
      window: { title: `Buy — ${entry.name}` },
      content: `<p><b>${entry.name}</b> requires split payment:</p><ul${_tipAttr("splitPay")} data-tour="market.splitPay">${parts}</ul>
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
    window: { title: `Buy — ${entry.name}` },
    content: `
      <form>
        <p><b>${entry.name}</b> — native pool: <strong>${POOL_SHORT_LABEL[nativePool] ?? nativePool}</strong> (${nativeMarks} marks)${scaleNote}</p>
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

async function purchase({ entryId, factionId, characterId, hexUuid, note, payFromPool } = {}) {
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
  const OP_TO_MARKS = (game.bbttcc?.api?.op?.OP_TO_MARKS ?? 10);
  const baseCost = flagPrice
    ? (Number(flagPrice.marks) / OP_TO_MARKS)
    : (Number(entry?.cost?.economy ?? 0) || 0);

  const horizon = factionEconomicHorizon(faction);
  const rarity = await resolveEntryRarity(entry);

  if (rarity === "artifact") {
    throw new Error("Artifacts cannot be purchased. Discovery only.");
  }

  const distance = rarityDistance(rarity, horizon);
  const kind = String(entry.kind || "").toLowerCase();
  let econCost = scaledEconomyCost(baseCost, distance);

  // Gear can be free if within horizon (Standard Issue). Big-ticket purchases should still cost their base Econ.
  if (distance <= 0 && kind && kind !== "gear") {
    econCost = baseCost;
  }

  // 0) Validate delivery prerequisites BEFORE spending — the OP engine has no
  //    rollback, so a delivery failure after commit would strand the marks.
  //    Warn + throw a pre-notified error (the Market app's buy handler skips
  //    its own error toast for these; direct API callers still get the throw).
  const _abortPurchase = (msg) => {
    ui.notifications?.warn?.(msg);
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
  } else if (kind === "rig") {
    if (typeof game.bbttcc?.api?.factions?.addRig !== "function") _abortPurchase("Factions rig API not available — cannot deliver a rig.");
  } else if (kind === "rig_upgrade") {
    const rigs = faction.getFlag(MOD_FACTIONS, "rigs");
    if (!Array.isArray(rigs) || !rigs.length) _abortPurchase("Faction has no rigs to upgrade.");
  }

  // Build per-pool marks deltas (negative). For flag-priced gear: split items
  // pay each portion to its native pool; single-currency items pay the whole
  // amount to their native pool. Legacy catalog entries (no flag price) keep
  // the Economy-only path.
  const totalMarks = Math.round(econCost * OP_TO_MARKS);
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
    const chosenPool = payFromPool || nativePool;
    const isCross = (chosenPool !== nativePool);
    const friction = isCross ? (pricing?.CROSS_POOL_FRICTION ?? 1.5) : 1.0;
    const adjustedMarks = Math.round(totalMarks * friction);
    payDeltas = { [chosenPool]: -adjustedMarks };
  } else {
    payDeltas = { economy: -totalMarks };
  }

  // 1) Spend
  const spendRes = await spendMarksByPools(factionId, payDeltas, { label: entry.name, note });
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

export class BBTTCCMarketApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-market",
    window: { title: "Bad Eden Market", icon: "fas fa-store", resizable: true },
    position: { width: 980, height: 720 },
    classes: ["bbttcc", "bbttcc-market", "sheet", "bbttcc-be", "bbttcc-theme-player"],
    resizable: true
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/market-app.hbs` }
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
      note: c.note || ""
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

    const factions = allFactions()
      .filter(a => game.user?.isGM || a?.isOwner)
      .map(a => ({ id: a.id, name: a.name, selected: a.id === ctx.factionId }))
      .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
const characters = allCharacters().map(a => ({ id: a.id, name: a.name, selected: a.id === ctx.characterId }))
      .sort((a,b)=>String(a.name).localeCompare(String(b.name)));

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
        tierLabel: tier ? `Tier ${tier}` : "",
        tierRank: TIER_RANK[tier] ?? 99,  // unknown tiers sort after IV
        canOpen: !!docUuid
      };
    }));

    // Category filter: subdivides "gear" catalog rows by item.type and the
    // RFI consumable convention (rfi.frame/system.slot/tags === "consumable").
    // Non-gear catalog rows match by `kind` directly.
    if (ctx.category) {
      const cat = String(ctx.category).toLowerCase();
      const GEAR_CATS = new Set(["weapon", "armor", "gear", "consumable"]);
      entries = entries.filter(r => {
        if (GEAR_CATS.has(cat)) {
          if (String(r.kind||"").toLowerCase() !== "gear") return false;
          if (cat === "consumable") return r.isConsumable;
          if (cat === "weapon")     return r.docType === "weapon";
          if (cat === "armor")      return r.docType === "armor";
          // "gear" = the catch-all bucket: gear-doc, not flagged consumable,
          // and not a weapon/armor.
          return r.docType === "gear" && !r.isConsumable;
        }
        return String(r.kind||"").toLowerCase() === cat;
      });
    }

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
      note: ctx.note
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
      const OP_TO_MARKS = (game.bbttcc?.api?.op?.OP_TO_MARKS ?? 10);
      const baseCost = flagPrice
        ? (Number(flagPrice.marks) / OP_TO_MARKS)
        : (Number(entry?.cost?.economy ?? 0) || 0);
      const rarity = await resolveEntryRarity(entry);
      const distance = rarityDistance(rarity, horizon0);
      let econCost = scaledEconomyCost(baseCost, distance);
      const kind = String(entry?.kind || "").toLowerCase();
      if (distance <= 0 && kind && kind !== "gear") econCost = baseCost;

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
      const chipHelp = game.bbttcc?.help?.tip?.("market", "chip") || "";
      if (chipHelp) chip.dataset.tooltip = spec.title ? `${chipHelp}<br><br>${esc(spec.title)}` : chipHelp;
      else if (spec.title) chip.title = spec.title;
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
      const chipHelp = game.bbttcc?.help?.tip?.("market", "profChip") || "";
      if (chipHelp) chip.dataset.tooltip = `${chipHelp}<br><br>${esc(detail)}`;
      else chip.title = detail;
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
      this._saveCtx({
        vendorId: vendorSel?.value || "",
        factionId: factionSel?.value || "",
        characterId: charSel?.value || "",
        hexUuid: hexInp?.value || "",
        q: qInp?.value || "",
        kind: kindSel?.value || "",
        category: categorySel?.value || "",
        sort: sortSel?.value || "name",
        note: noteInp?.value || ""
      });
    };

    [vendorSel, factionSel, charSel, kindSel, categorySel, sortSel].forEach(el => {
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

      if (act !== "buy") return;

      ev.preventDefault(); ev.stopPropagation();

      const entryEl = ctl.closest?.("[data-entry-id]");
      const entryId = entryEl?.dataset?.entryId;
      if (!entryId) return;

      const ctxNow = this._loadCtx();

      // Phase 5.5: pre-purchase confirmation dialog with cross-pool override.
      // Resolves the catalog entry + faction, then opens openBuyConfirmDialog.
      // For legacy catalog items the dialog auto-passes through.
      const catalog = game.settings.get(MODULE_ID, "catalog") || [];
      const entry = (Array.isArray(catalog) ? catalog : []).find(e => e?.id === entryId);
      const faction = game.actors.get(ctxNow.factionId);
      let confirmRes = { ok: true, payFromPool: null };
      if (entry && faction) {
        try {
          confirmRes = await openBuyConfirmDialog({ entry, factionId: ctxNow.factionId, faction });
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
      isActor: e.kind === "actor"
    }));

    const vendorTagsRaw = Array.isArray(vendor.tags) ? vendor.tags.join(", ") : String(vendor.tags || "");

    return {
      ...context,
      vendors,
      vendor: { ...vendor, tagsRaw: vendorTagsRaw },
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

    vendors[idx] = _normalizeVendor({ ...vendors[idx], name, blurb, tags: tagsRaw, active });
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
    cat.unshift(_normalizeEntry({ id, vendorId: this.vendorId, kind: "gear", name: "New Entry", blurb: "", uuid: "", cost: { economy: 1 } }));
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
      } else if (type === "folder" || uuid.startsWith("Folder.")) {
        const folderId = data.id || (uuid.split(".")[1] || "");
        const folder = game.folders?.get?.(folderId);
        const items = folder?.contents?.filter?.(d => d.documentName === "Item") || [];
        uuids = items.map(it => it.uuid).filter(Boolean);
      } else {
        const doc = await fromUuid(uuid);
        if (doc?.documentName === "Item") uuids = [doc.uuid];
      }
    } else if (type === "folder" && data.id) {
      const folder = game.folders?.get?.(data.id);
      const items = folder?.contents?.filter?.(d => d.documentName === "Item") || [];
      uuids = items.map(it => it.uuid).filter(Boolean);
    }

    if (!uuids.length) throw new Error("Drop did not resolve to any Items.");

    const catalog = _catalogArray().map(_normalizeEntry);
    let count = 0;

    for (const u of uuids) {
      const doc = await fromUuid(u);
      const name = doc?.name || "Item";
      const id = _makeId("gear");
      catalog.unshift(_normalizeEntry({ id, vendorId, kind: "gear", name, blurb: "", uuid: u, cost: { economy: 1 } }));
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
  game.bbttcc.api.market.openMarket = (() => {
    let inst = null;
    return () => {
      if (inst && inst.rendered) { inst.bringToTop?.(); return inst; }
      inst = new BBTTCCMarketApp();
      inst.render(true, { focus: true });
      return inst;
    };
  })();

game.bbttcc.api.market.openCatalogEditor = (() => {
  let inst = null;
  return () => {
    if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
    if (inst && inst.rendered) { inst.bringToTop?.(); return inst; }
    inst = new BBTTCCMarketCatalogEditorApp();
    inst.render(true, { focus: true });
    return inst;
  };
})();


  game.bbttcc.api.market.listVendors = () => foundry.utils.duplicate(_vendorsArray().map(_normalizeVendor));

  game.bbttcc.api.market.listCatalog = () => foundry.utils.duplicate(_catalogArray().map(_normalizeEntry));

  

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
          onclick: () => {
            try {
              // preselect faction for convenience
              const cur = game.settings.get(MODULE_ID, "lastContext") || {};
              const next = foundry.utils.mergeObject(cur, { factionId: actor.id }, { inplace:false, overwrite:true });
              game.settings.set(MODULE_ID, "lastContext", next);
            } catch (_e) {}
            try { game.bbttcc?.api?.market?.openMarket?.(); } catch (e) { console.error(e); }
          }
        });
      } catch (_e) {}
    });
  } catch (_e) {}

log("ready — market API mounted at game.bbttcc.api.market (openMarket/openCatalogEditor/purchase/listVendors/listCatalog)");
});
