// Roll for Initiation — RFI Item Engine
// ─────────────────────────────────────────────────────────────────────────────
// Single schema for crafted gear, looted gear, and vendor stock. All items
// share `flags.rfi.item`; origin distinguishes how they got into play.
//
// Wired in module.js init: exposes `game.fourththing.items` API.
// Sheet rendering and engine bindings live in module.js (Phase 3+).
// ─────────────────────────────────────────────────────────────────────────────

// Flag storage uses the system scope (fourththing) because Foundry validates
// flag scopes against active system + module ids — "rfi" is not registered as
// either, so getFlag/setFlag would throw. Internal labeling stays "RFI"; the
// nested "rfi.item" key keeps the path obvious. When the system is renamed to
// "rfi", flip RFI_ITEM_FLAG_NS only.
export const RFI_ITEM_FLAG_PATH = "flags.fourththing.rfi.item";
export const RFI_ITEM_FLAG_NS   = "fourththing";
export const RFI_ITEM_FLAG_KEY  = "rfi.item";

export const RFI_TIERS    = ["I", "II", "III", "IV"];
export const RFI_FRAMES   = ["weapon", "armor", "tool", "sigil", "vehicle", "consumable", "container"];
export const RFI_ORIGINS  = ["crafted", "looted", "found", "vendor", "faction-rig"];
export const RFI_BOUND    = ["free", "attuned", "soulbound"];
export const RFI_REACH    = ["self", "touch", "5", "30", "60", "120", "scene", "faction", "hex"];

// Tier ↔ Roman numeral helpers — accept either form on the way in.
const TIER_ROMAN_FROM_INT = { 1: "I", 2: "II", 3: "III", 4: "IV" };
const TIER_INT_FROM_ROMAN = { I: 1, II: 2, III: 3, IV: 4 };

export function tierToInt(tier) {
  if (typeof tier === "number") return Math.max(1, Math.min(4, Math.floor(tier)));
  if (typeof tier === "string") {
    const n = TIER_INT_FROM_ROMAN[tier.toUpperCase()];
    if (n) return n;
    const parsed = parseInt(tier, 10);
    if (!Number.isNaN(parsed)) return Math.max(1, Math.min(4, parsed));
  }
  return 1;
}

export function tierToRoman(tier) {
  return TIER_ROMAN_FROM_INT[tierToInt(tier)] ?? "I";
}

// Frame inference from item.type. Covers fourththing's native types (weapon,
// armor, gear, power, feature, feat, class, subclass, race) AND legacy dnd5e
// types still floating around the master-content pack (equipment, consumable,
// loot, container, tool, base, enchantment, spell). Null = not gear.
const FRAME_BY_TYPE = {
  // fourththing native
  weapon:      "weapon",
  armor:       "armor",
  gear:        "tool",
  power:       null,          // manifestations live elsewhere
  feature:     null,
  feat:        null,
  class:       null,
  subclass:    null,
  race:        null,
  // dnd5e legacy (master-content pack)
  equipment:   "armor",
  consumable:  "consumable",
  tool:        "tool",
  container:   "container",
  loot:        "tool",
  spell:       null,
  base:        null,
  enchantment: null,
  Item:        "tool"
};

// Default footprint by frame at tier I. Scales with tier downstream.
const FOOTPRINT_BY_FRAME = {
  weapon:     1,
  armor:      1,
  tool:       1,
  sigil:      2,
  vehicle:    3,
  consumable: 0,   // single-use; no upkeep
  container:  0
};

// Default upkeep mode by frame.
const UPKEEP_BY_FRAME = {
  weapon:     { mode: "passive", per: "scene" },
  armor:      { mode: "passive", per: "scene" },
  tool:       { mode: "passive", per: "day"   },
  sigil:      { mode: "active",  per: "scene" },
  vehicle:    { mode: "active",  per: "day"   },
  consumable: { mode: "passive", per: "none"  },
  container:  { mode: "passive", per: "none"  }
};

/**
 * Build a default RFI shape for an item that has no flags yet. Pure function;
 * does NOT mutate the item. Use `setRfiItem` to persist.
 */
export function defaultsForItem(item) {
  const itemType = item?.type ?? null;
  const frame = FRAME_BY_TYPE[itemType] ?? "tool";
  // Scale-based tier inference for legacy items (FT.MANIFESTATION_SCALES)
  const legacyScale = item?.system?.scale ?? null;
  const scaleTier = { personal: 1, scene: 2, faction: 3, hex: 4 }[legacyScale] ?? 1;
  return {
    tier:       tierToRoman(scaleTier),
    footprint:  FOOTPRINT_BY_FRAME[frame] ?? 1,
    reach:      frame === "weapon" ? "5" : (frame === "vehicle" ? "scene" : "self"),
    frame,
    signature:  "",
    origin:     "looted",
    originator: null,
    bound:      "free",
    upkeep:     UPKEEP_BY_FRAME[frame] ?? { mode: "passive", per: "scene" },
    misfire:    { tierClamp: true, table: null },
    signals:    {}
  };
}

/**
 * Read the merged RFI shape: stored flags overlay computed defaults. If the
 * item is not gear (feat/spell/base/etc.), returns null.
 */
export function getRfiItem(item) {
  if (!item) return null;
  if (FRAME_BY_TYPE[item.type] === null) return null;
  const stored = item.getFlag?.(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY) ?? null;
  const defaults = defaultsForItem(item);
  if (!stored) return defaults;
  // Shallow-merge top level; nested objects (upkeep, misfire, signals) merged separately.
  return {
    ...defaults,
    ...stored,
    upkeep:  { ...defaults.upkeep,  ...(stored.upkeep  ?? {}) },
    misfire: { ...defaults.misfire, ...(stored.misfire ?? {}) },
    signals: { ...defaults.signals, ...(stored.signals ?? {}) }
  };
}

/**
 * Persist a partial RFI shape onto an item. Merges with whatever is already
 * stored (does not blow away unset keys). Async — awaits the item update.
 */
export async function setRfiItem(item, partial = {}) {
  if (!item) throw new Error("setRfiItem: no item provided");
  const current = item.getFlag?.(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY) ?? {};
  const next = { ...current, ...partial };
  // Validate enums quietly — bad values fall back to current/default.
  if (next.tier   !== undefined) next.tier   = tierToRoman(next.tier);
  if (next.frame  !== undefined && !RFI_FRAMES.includes(next.frame))   next.frame  = current.frame  ?? defaultsForItem(item).frame;
  if (next.origin !== undefined && !RFI_ORIGINS.includes(next.origin)) next.origin = current.origin ?? "looted";
  if (next.bound  !== undefined && !RFI_BOUND.includes(next.bound))    next.bound  = current.bound  ?? "free";
  return item.setFlag(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY, next);
}

/**
 * Strip RFI flags entirely (clean revert). Use sparingly; the engine is
 * idempotent over re-stamping, so this is mostly for tests/debugging.
 */
export async function clearRfiItem(item) {
  return item.unsetFlag?.(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY);
}

/**
 * Footprint cost for upkeep at the item's stored tier. Uses the same scaling
 * the manifestation tier ruleset uses elsewhere: cost grows with tier.
 */
export function footprintCost(item) {
  const rfi = getRfiItem(item);
  if (!rfi) return 0;
  if (rfi.upkeep?.mode === "passive" && rfi.upkeep?.per === "none") return 0;
  const base = Number(rfi.footprint) || 0;
  const tierMult = { I: 1, II: 1.5, III: 2, IV: 3 }[rfi.tier] ?? 1;
  return Math.ceil(base * tierMult);
}

/**
 * Tier-clamped misfire for an item activation. Delegates to the system's
 * existing `ftResolveMisfire` via the constants on `FT`. The engine binding
 * lives in module.js so this stays pure.
 */
export function getMisfireTier(item) {
  const rfi = getRfiItem(item);
  if (!rfi || !rfi.misfire?.tierClamp) return 1;
  return tierToInt(rfi.tier);
}

/**
 * Quick predicates the sheet/engine can use without reaching into flags.
 */
export const RfiItemQueries = {
  isGear:      (item) => getRfiItem(item) !== null,
  isCrafted:   (item) => getRfiItem(item)?.origin === "crafted",
  isAttuned:   (item) => getRfiItem(item)?.bound === "attuned",
  isSoulbound: (item) => getRfiItem(item)?.bound === "soulbound",
  tapsSurge:     (item) => Boolean(getRfiItem(item)?.signals?.surge),
  tapsBloodDebt: (item) => Boolean(getRfiItem(item)?.signals?.bloodDebt),
  tapsMomentum:  (item) => Boolean(getRfiItem(item)?.signals?.momentum),
  // Sheet partition predicates — Manifestations tab vs Inventory tab.
  // A power item is always a manifestation. Gear is a manifestation when
  // a hero crafted it OR when the item carries *authored* manifestation
  // data (concept or signature filled in) OR a "manifestation" tag.
  // Note: template.json defaults manifestation.family to "form" on every
  // weapon, so a bare family check would mis-route baseline weapons (rifle,
  // saber) onto the Manifestations tab — concept/signature are the fields
  // that only get populated when someone actually authors a manifestation.
  isManifestation: (item) => {
    if (!item) return false;
    if (item.type === "power") return true;
    const mf = item.system?.manifestation;
    if (mf && (String(mf.concept ?? "").trim() || String(mf.signature ?? "").trim())) return true;
    const tags = Array.isArray(item.system?.tags) ? item.system.tags : [];
    if (tags.some(t => String(t).toLowerCase() === "manifestation")) return true;
    const rfi = getRfiItem(item);
    return rfi?.origin === "crafted";
  },
  isMundane: (item) => {
    if (!item) return false;
    if (item.type === "power") return false;
    return getRfiItem(item) !== null && !RfiItemQueries.isManifestation(item);
  }
};

/**
 * Stamp defaults onto every gear item on an actor that doesn't already have
 * RFI flags. Idempotent. Intended for one-shot migration on actor open or via
 * a GM macro — not auto-run on every render.
 */
export async function stampActorGear(actor, { force = false } = {}) {
  if (!actor?.items) return { stamped: 0, skipped: 0 };
  let stamped = 0, skipped = 0;
  for (const item of actor.items) {
    if (FRAME_BY_TYPE[item.type] === null) { skipped++; continue; }
    const has = item.getFlag?.(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY);
    if (has && !force) { skipped++; continue; }
    await setRfiItem(item, defaultsForItem(item));
    stamped++;
  }
  return { stamped, skipped };
}

/**
 * Charge an actor for an item's footprint upkeep against their Clarity track.
 * Returns { ok, paid, remaining, reason? }. If clarity is insufficient, the
 * call is a no-op and ok=false. Callers can override the cost or reason.
 *
 * Posts a chat card by default; pass `silent: true` to suppress it.
 */
export async function consumeFootprint(actor, item, { costOverride = null, reason = "upkeep", silent = false } = {}) {
  if (!actor) return { ok: false, reason: "no-actor", paid: 0, remaining: null };
  if (!item)  return { ok: false, reason: "no-item",  paid: 0, remaining: null };
  if (!RfiItems.is.isGear(item)) return { ok: false, reason: "not-gear", paid: 0, remaining: null };

  const cost = Number.isFinite(costOverride) ? Number(costOverride) : footprintCost(item);
  if (cost <= 0) return { ok: true, paid: 0, remaining: null, reason: "no-cost" };

  // Clarity lives at system.magic.clarity.value per the magic engine.
  const sys = actor.system?.system ?? actor.system ?? {};
  const clarity = Number(sys?.magic?.clarity?.value ?? 0);
  if (clarity < cost) {
    return { ok: false, reason: "insufficient-clarity", paid: 0, remaining: clarity };
  }

  const next = clarity - cost;
  await actor.update({ "system.magic.clarity.value": next });

  if (!silent) {
    const rfi = getRfiItem(item);
    const tierBadge = rfi?.tier ? ` <span style="opacity:0.6">(T${rfi.tier})</span>` : "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll ft-magic-roll">
                  <div class="ft-misfire-box standalone" style="border-color:#7aa9d4">
                    <span class="ft-misfire-label">📜 Footprint — ${item.name}${tierBadge}</span>
                    <p class="ft-misfire-desc">${reason}: −${cost} Clarity (${clarity} → ${next})</p>
                  </div></div>`
    });
  }

  return { ok: true, paid: cost, remaining: next, reason };
}

/**
 * Public API surface — mirrored onto `game.fourththing.items` in module.js.
 */
export const RfiItems = {
  // schema
  TIERS:   RFI_TIERS,
  FRAMES:  RFI_FRAMES,
  ORIGINS: RFI_ORIGINS,
  BOUND:   RFI_BOUND,
  REACH:   RFI_REACH,
  FLAG:    { ns: RFI_ITEM_FLAG_NS, key: RFI_ITEM_FLAG_KEY, path: RFI_ITEM_FLAG_PATH },
  // helpers
  tierToInt, tierToRoman,
  // read/write
  get:     getRfiItem,
  set:     setRfiItem,
  clear:   clearRfiItem,
  defaults: defaultsForItem,
  // engine
  footprintCost,
  getMisfireTier,
  consumeFootprint,
  // queries
  is:      RfiItemQueries,
  // bulk
  stampActorGear
};

export default RfiItems;
