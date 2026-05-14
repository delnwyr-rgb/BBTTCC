// Roll for Initiation — RFI Pricing Engine
// ─────────────────────────────────────────────────────────────────────────────
// Phase 1 implementation of systems/fourththing/PRICING_RUBRIC.md.
//
// What this module does:
//  - Defines the tier × category × currency math (§1, §1.5, §2 of the rubric).
//  - Stamps `flags.fourththing.rfi.item.price` (and optionally `.tech`) on
//    item creation via a preCreateItem hook.
//  - Injects a Pricing strip into item sheets with the Native Pool picker,
//    a marks input, sale-back readout, and a Split sub-dialog launcher.
//  - Exposes `game.fourththing.pricing` for tooling (price-stamp / price-audit
//    macros land in Phase 2).
//
// Sibling: rfi-items.js owns the umbrella `flags.fourththing.rfi.item` blob.
// We extend that namespace with a `price` and `tech` sub-object — no schema
// changes to template.json (flags are unstructured by design in Foundry).
// ─────────────────────────────────────────────────────────────────────────────

import {
  RFI_ITEM_FLAG_NS,
  RFI_ITEM_FLAG_KEY,
  RfiItems,
  tierToInt,
  tierToRoman
} from "./rfi-items.js";

// Module-load marker so we can confirm loading from the browser console.
console.log("[rfi-pricing] Module loading — registering hooks");

// ─── Constants ───────────────────────────────────────────────────────────────

// 1 OP = 10 marks (canon since 2026-05-09).
export const MARKS_PER_OP = 10;

// Tier base — geometric ×3 progression. T1: 50 / T2: 150 / T3: 450 / T4: 1350.
export const TIER_BASE_MARKS = { 1: 50, 2: 150, 3: 450, 4: 1350 };

// Frame → category multiplier (rubric §2).
export const CATEGORY_MULT_BY_FRAME = {
  weapon:     1.0,
  armor:      1.5,
  tool:       0.6,
  sigil:      1.2,
  vehicle:    5.0,
  consumable: 0.2,
  container:  0.4
};

// Six canonical OP pools used by the pricing rubric. The faction opBank also
// tracks logistics/culture/faith for raid stats, but those are out-of-scope
// for v1 pricing — defer to v2 if needed.
export const OP_POOLS = ["economy", "violence", "nonlethal", "intrigue", "softpower", "diplomacy"];

// Display labels for the picker.
export const OP_POOL_LABELS = {
  economy:   "Economy",
  violence:  "Violence",
  nonlethal: "Non-Lethal",
  intrigue:  "Intrigue",
  softpower: "Soft Power",
  diplomacy: "Diplomacy"
};

// Native pool by frame (rubric §1.5, post-armor-to-Non-Lethal move).
//  weapon  → violence (offense)
//  armor   → nonlethal (defense + coercion cluster)
//  tool    → economy (mundane utility)
//  sigil   → softpower (sacred / cultural artifact)
//  vehicle → economy (civilian default; war-rigs override to violence)
//  consumable → economy
//  container  → economy
export const NATIVE_POOL_BY_FRAME = {
  weapon:     "violence",
  armor:      "nonlethal",
  tool:       "economy",
  sigil:      "softpower",
  vehicle:    "economy",
  consumable: "economy",
  container:  "economy"
};

// Technomagical multiplier (rubric §2 / §6).
export const TECH_MULT = 2.0;

// Bound multipliers (rubric §2).
export const BOUND_MULT = {
  free:      1.0,
  attuned:   1.0,
  soulbound: 1.5
};

// Sale-back fraction of list (rubric §5). Soulbound: 0.
export const SALE_BACK_FRACTION = 0.40;

// Per-tier forge fee in marks (rubric §4). Covers tools, time, lost wax,
// sept tithe, GM-discretion fees. Charged in marks regardless of materials
// consumed; forge keeps it on failed crafts.
export const TIER_FEE_MARKS = { I: 10, II: 30, III: 90, IV: 270 };

// Rig bracket multipliers (rubric §7). Applied to tierBase to get a frame-only
// chassis price; weapon/system/output modules priced separately as items.
export const RIG_BRACKET_MULT = {
  personal: 2,   // single pilot bike/skiff/jumper
  light:    5,   // 1-2 crew scout/courier
  medium:   12,  // 4-8 crew barge/hauler
  heavy:    25,  // 4-7 crew war-rig/garrison
  siege:    50   // stationary forge/fortress/relic-installation
};

// Boss bounty / hire / ransom multipliers (rubric §9). Apply to
// tierBase × bracketMult.
export const BOSS_PRICING_MULT = {
  bounty: 0.6,   // paid out for slaying — credited to the pool matching method
  hire:   1.5,   // cost to retain a tameable / pact-bound boss
  ransom: 1.0    // cost to recover a captured / hostage boss
};

// Cross-pool surcharge (rubric §1.5).
export const CROSS_POOL_FRICTION = 1.5;

// ─── Pure math helpers ───────────────────────────────────────────────────────

export function tierBaseMarks(tier) {
  return TIER_BASE_MARKS[tierToInt(tier)] ?? TIER_BASE_MARKS[1];
}

export function categoryMult(frame) {
  return CATEGORY_MULT_BY_FRAME[frame] ?? 1.0;
}

export function defaultCurrencyForFrame(frame) {
  return NATIVE_POOL_BY_FRAME[frame] ?? "economy";
}

// Round to the nearest 5 marks (rubric §2).
function roundToFive(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(0, Math.round(n / 5) * 5);
}

/**
 * Compute the list price for a given RFI shape. Pure function.
 *  list = tierBase × categoryMult × techMult × boundMult × halfTierMult × rarityMult
 * Returns marks (integer, rounded to 5).
 */
export function computeListPrice({ tier, frame, hasTech = false, bound = "free", halfTier = false, rarityMult = 1.0 } = {}) {
  const base    = tierBaseMarks(tier);
  const cat     = categoryMult(frame);
  const tech    = hasTech ? TECH_MULT : 1.0;
  const boundM  = BOUND_MULT[bound] ?? 1.0;
  const half    = halfTier ? 1.5 : 1.0;
  const rarity  = Number.isFinite(rarityMult) ? rarityMult : 1.0;
  return roundToFive(base * cat * tech * boundM * half * rarity);
}

export function computeSaleBack(marks, bound = "free") {
  if (bound === "soulbound") return 0;
  if (!Number.isFinite(marks) || marks <= 0) return 0;
  return Math.floor(marks * SALE_BACK_FRACTION);
}

/**
 * Forge fee in marks for crafting an item at the given tier.
 * T1: 10 / T2: 30 / T3: 90 / T4: 270. Rubric §4.
 */
export function tierFeeForTier(tier) {
  return TIER_FEE_MARKS[tierToRoman(tier)] ?? 0;
}

/**
 * Per-unit material price in marks at retail (rubric §3).
 * tierBase × 0.1 × rarityMult. Used for conceptual materialsCost in craft
 * previews; actual material consumption is by inventory, not marks.
 */
export function materialUnitPriceMarks(tier, rarityMult = 1.0) {
  const r = Number(rarityMult);
  const mult = Number.isFinite(r) && r > 0 ? r : 1.0;
  return Math.round(tierBaseMarks(tier) * 0.1 * mult);
}

/**
 * Bracket multiplier for rigs (rubric §7). Default falls back to "light".
 */
export function rigBracketMult(bracket) {
  return RIG_BRACKET_MULT[String(bracket || "light").toLowerCase()] ?? RIG_BRACKET_MULT.light;
}

/**
 * Rig chassis list price in marks (rubric §7). Frame only — modules priced
 * as separate items via the standard item-price path.
 *   tierBase × bracketMult
 */
export function computeRigListPrice({ tier, bracket } = {}) {
  return roundToFive(tierBaseMarks(tier) * rigBracketMult(bracket));
}

/**
 * Boss bounty / hire / ransom prices in marks (rubric §9).
 *   bounty  = tierBase × bracketMult × 0.6
 *   hire    = tierBase × bracketMult × 1.5
 *   ransom  = tierBase × bracketMult × 1.0
 *
 * Returns { bounty, hire, ransom }. Caller decides which to use.
 */
export function computeBossPricing({ tier, bracket } = {}) {
  const base = tierBaseMarks(tier) * rigBracketMult(bracket);
  return {
    bounty: roundToFive(base * BOSS_PRICING_MULT.bounty),
    hire:   roundToFive(base * BOSS_PRICING_MULT.hire),
    ransom: roundToFive(base * BOSS_PRICING_MULT.ransom)
  };
}

/**
 * Facility list price in marks (rubric §8).
 *   max(rigBracketCost, monthlyYield × 30)
 * Floors at the rig bracket cost so cheap output facilities can't be priced
 * lower than the chassis would warrant.
 */
export function computeFacilityListPrice({ tier, bracket, monthlyYieldMarks = 0 } = {}) {
  const rigCost = computeRigListPrice({ tier, bracket });
  const yieldCost = Math.max(0, Number(monthlyYieldMarks) || 0) * 30;
  return roundToFive(Math.max(rigCost, yieldCost));
}

/**
 * Whether a chosen currency counts as a GM override vs the category default.
 * "auto" is never an override. Split mode is always an override (caller-set).
 */
export function isOverride(currency, frame) {
  if (!currency || currency === "auto") return false;
  if (currency === "split") return true;
  const def = defaultCurrencyForFrame(frame);
  return currency !== def;
}

// ─── Default builders ────────────────────────────────────────────────────────

/**
 * Build a default price sub-object for an item. Pure; does not mutate.
 * Uses RfiItems.get() to pick up frame/tier/bound from the existing rfi blob,
 * with safe fallbacks for items that haven't been stamped yet.
 */
export function defaultPriceFor(item) {
  const rfi    = RfiItems.get(item) ?? {};
  const frame  = rfi.frame ?? "tool";
  const tier   = rfi.tier  ?? "I";
  const bound  = rfi.bound ?? "free";
  const marks  = computeListPrice({ tier, frame, hasTech: false, bound });
  const currency = defaultCurrencyForFrame(frame);
  return {
    marks,
    currency,
    gmOverride:    false,
    altCurrencies: {},                // empty = engine default × 1.5 friction
    split:         null,              // null = single-currency
    rarityMult:    1.0,
    notes:         _autoNotes({ tier, frame, bound, hasTech: false, currency, override: false }),
    bound,
    saleBack:      computeSaleBack(marks, bound)
  };
}

/**
 * Tech defaults — `null` means "no tech". GM opts in by toggling on the
 * item sheet (UI lands in Phase 1); this helper gives the canonical empty
 * substructure when tech is enabled.
 */
export function emptyTechShape() {
  return {
    kind:        "charged",
    charges:     { value: 0, max: 0, recoverPer: "soma-break" },
    fuel:        null,                          // { materialKey, perActivation }
    attunement:  { required: false, slots: 1 },
    signature:   null,
    failure:     "misfire",
    origin:      "homebrew",
    shielded:    false
  };
}

function _autoNotes({ tier, frame, bound, hasTech, currency, override }) {
  const t = tierToRoman(tier);
  const techBit = hasTech ? " × tech 2.0" : "";
  const boundBit = bound === "soulbound" ? " × soulbound 1.5" : "";
  const overrideBit = override ? `; GM override ${currency}` : "";
  const cat = (CATEGORY_MULT_BY_FRAME[frame] ?? 1.0).toFixed(2).replace(/\.00$/, "");
  return `T${t} ${frame} × ${cat}${techBit}${boundBit}${overrideBit}`;
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

async function _readPrice(item) {
  const rfi = item.getFlag?.(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY) ?? {};
  return rfi.price ?? null;
}

async function _writePartialPrice(item, partial) {
  const cur = item.getFlag?.(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY) ?? {};
  const curPrice = cur.price ?? defaultPriceFor(item);
  const next = { ...curPrice, ...partial };
  // Recompute saleBack whenever marks or bound changes.
  if ("marks" in partial || "bound" in partial) {
    next.saleBack = computeSaleBack(next.marks, next.bound);
  }
  return item.setFlag(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY, { ...cur, price: next });
}

async function _writeTech(item, partialOrNull) {
  const cur = item.getFlag?.(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY) ?? {};
  const next = partialOrNull === null
    ? null
    : { ...(cur.tech ?? emptyTechShape()), ...partialOrNull };
  return item.setFlag(RFI_ITEM_FLAG_NS, RFI_ITEM_FLAG_KEY, { ...cur, tech: next });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const RfiPricing = {
  // schema
  MARKS_PER_OP, TIER_BASE_MARKS, CATEGORY_MULT_BY_FRAME, OP_POOLS, OP_POOL_LABELS,
  NATIVE_POOL_BY_FRAME, TECH_MULT, BOUND_MULT, SALE_BACK_FRACTION, CROSS_POOL_FRICTION,
  TIER_FEE_MARKS, RIG_BRACKET_MULT, BOSS_PRICING_MULT,
  // math
  tierBaseMarks, categoryMult, defaultCurrencyForFrame,
  computeListPrice, computeSaleBack, isOverride,
  tierFeeForTier, materialUnitPriceMarks,
  rigBracketMult, computeRigListPrice, computeBossPricing, computeFacilityListPrice,
  // defaults
  defaultPriceFor, emptyTechShape,
  // persistence
  async setPrice(item, partial)   { return _writePartialPrice(item, partial); },
  async setTech(item, partialOrNull) { return _writeTech(item, partialOrNull); },
  async getPrice(item)            { return _readPrice(item); },
  // dialogs
  openSplitDialog
};

// ─── preCreateItem hook: stamp defaults on creation ──────────────────────────

function _isPriceableItem(item) {
  // Price applies to gear (RfiItems considers it gear). Power/feature/feat/
  // class/subclass/race/spark are not priced.
  return RfiItems.is.isGear(item);
}

function _stampDefaultsPreCreate(item, data, _options, _userId) {
  if (!_isPriceableItem(item)) return;

  // Read whatever flags the creation payload already carries.
  const existing = foundry.utils.getProperty(data, `flags.${RFI_ITEM_FLAG_NS}.${RFI_ITEM_FLAG_KEY}`) ?? {};
  if (existing.price && Number.isFinite(existing.price.marks)) return;  // honor authored prices

  // Build a default price using whatever rfi data is already on the source.
  const seedRfi = { ...existing };
  const frame   = seedRfi.frame ?? RfiItems.defaults({ type: item.type })?.frame ?? "tool";
  const tier    = seedRfi.tier  ?? "I";
  const bound   = seedRfi.bound ?? "free";
  const hasTech = Boolean(existing.tech);   // tech items get the × 2.0 multiplier (rubric §6)
  const marks   = computeListPrice({ tier, frame, hasTech, bound });
  const currency = defaultCurrencyForFrame(frame);

  const price = {
    marks,
    currency,
    gmOverride:    false,
    altCurrencies: {},
    split:         null,
    rarityMult:    1.0,
    notes:         _autoNotes({ tier, frame, bound, hasTech, currency, override: false }),
    bound,
    saleBack:      computeSaleBack(marks, bound)
  };

  // Merge via updateSource so the creation payload carries our defaults.
  item.updateSource({
    [`flags.${RFI_ITEM_FLAG_NS}.${RFI_ITEM_FLAG_KEY}.price`]: price
  });
}

// ─── Header button injection ─────────────────────────────────────────────────
// Approach pivoted from DOM-injecting a strip into the sheet body (which
// fought the FT custom sheet's flex layout) to a header button next to the
// close/copy controls. Click → opens a DialogV2 with the pricing controls.
// Robust against any sheet layout because we only touch .window-header, which
// has a stable DOM shape across all AppV2 sheets.

// No sheet-class skip list — `_isPriceableItem(item)` is the canonical gate.
// FourthThingFeatureSheet is the *default fallback* for non-weapon/non-power
// items (gear/armor/consumable/container/material), so skipping it would hide
// the button on nearly every priceable type. Item-type gating is enough:
//   weapon/armor/gear/consumable/container/material → priceable
//   power/feature/feat/class/subclass/race/species/spark → not priceable

function _injectPricingHeaderButton(app, html) {
  try {
    if (!app?.document) return;
    if (app.document.documentName !== "Item") return;
    const item = app.document;
    if (!_isPriceableItem(item)) {
      console.debug("[rfi-pricing] skip: not priceable", item.type, item.name);
      return;
    }

    // V13 AppV2: render hooks pass the rendered *part content* as `html`, not
    // the full app root. `.window-header` lives outside the part content as
    // AppV2 chrome — use `app.element` to reach it.
    const appRoot = app.element ?? (html?.[0] ?? html);
    if (!appRoot) return;

    const header = appRoot.querySelector?.(".window-header");
    if (!header) {
      console.debug("[rfi-pricing] skip: no .window-header on", app.constructor?.name);
      return;
    }
    if (header.querySelector?.(".rfi-pricing-header-btn")) return; // idempotent

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "header-control icon fa-solid fa-coins rfi-pricing-header-btn";
    btn.setAttribute("data-tooltip", "RFI Pricing");
    btn.setAttribute("aria-label", "RFI Pricing");
    btn.style.color = "rgba(232, 200, 74, 0.95)";
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openPricingDialog(item);
    });

    // Place before the close button if present, else append.
    const closeBtn = header.querySelector?.('button[data-action="close"], button.fa-xmark');
    if (closeBtn) header.insertBefore(btn, closeBtn);
    else header.appendChild(btn);

    console.debug("[rfi-pricing] header button injected for", item.type, item.name);
  } catch (e) {
    console.warn("Roll for Initiation | RFI pricing header button injection failed", e);
  }
}

// ─── Pricing main dialog ─────────────────────────────────────────────────────

export async function openPricingDialog(item) {
  const stored = await _readPrice(item);
  const price = stored ?? defaultPriceFor(item);
  const rfi = RfiItems.get(item) ?? {};
  const frame = rfi.frame ?? "tool";
  const def = defaultCurrencyForFrame(frame);
  const tech = foundry.utils.getProperty(item, `flags.${RFI_ITEM_FLAG_NS}.${RFI_ITEM_FLAG_KEY}.tech`);

  const poolOpts = ['<option value="auto"' + (price.currency === "auto" ? " selected" : "") + '>Auto (' + (OP_POOL_LABELS[def] ?? def) + ')</option>'];
  for (const k of OP_POOLS) {
    const sel = (price.currency === k && !price.split) ? " selected" : "";
    poolOpts.push(`<option value="${k}"${sel}>${OP_POOL_LABELS[k]}${k === def ? " ★" : ""}</option>`);
  }
  if (price.split) poolOpts.push(`<option value="split" selected>Split…</option>`);

  let splitSummary = "";
  if (price.split && typeof price.split === "object") {
    const parts = Object.entries(price.split)
      .filter(([_, v]) => Number(v) > 0)
      .map(([k, v]) => `${OP_POOL_LABELS[k] ?? k} ${v}`)
      .join(" + ");
    splitSummary = parts ? `<div style="margin-top:0.4rem;opacity:0.85;font-size:0.85rem;">↗ ${parts}</div>` : "";
  }

  const overrideBadge = price.gmOverride ? `<span style="background:#d4a35f;color:#1a1a1a;padding:1px 6px;border-radius:3px;font-size:0.74rem;font-weight:700;margin-left:0.4rem">GM ✎</span>` : "";
  const techBadge = tech ? `<span style="background:#6a4ad4;color:#fff;padding:1px 6px;border-radius:3px;font-size:0.74rem;margin-left:0.4rem">⚙ tech</span>` : "";

  const content = `
    <form class="rfi-pricing-dialog">
      <div style="margin-bottom:0.6rem;font-size:0.82rem;opacity:0.7;">
        <strong>${item.name}</strong> — T${rfi.tier ?? "I"} ${frame} (bound: ${rfi.bound ?? "free"})
        ${overrideBadge}${techBadge}
      </div>

      <div style="display:flex;align-items:center;gap:0.6rem;margin:0.5rem 0;">
        <label style="min-width:5em;font-weight:600;">List</label>
        <input type="number" name="marks" value="${price.marks}" min="-1" step="5" style="width:6em;text-align:right;"/>
        <span style="opacity:0.6">marks</span>
        <span style="margin-left:1em;opacity:0.75;">↺ Sale-back: <span data-sale-back>${price.saleBack ?? 0}</span></span>
      </div>

      <div style="display:flex;align-items:center;gap:0.6rem;margin:0.5rem 0;">
        <label style="min-width:5em;font-weight:600;">Pool</label>
        <select name="currency" style="min-width:11em;">${poolOpts.join("")}</select>
        <button type="button" data-action="open-split">Split…</button>
      </div>

      ${splitSummary}

      <hr style="margin:0.6rem 0;opacity:0.3;"/>
      <div style="font-size:0.78rem;opacity:0.6;font-style:italic;">${price.notes ?? ""}</div>
      <div style="font-size:0.74rem;opacity:0.5;margin-top:0.3rem;">
        Tip: pick "Auto" to follow the §1.5 category default. Pick a specific pool to override.
        Use Split for hybrid items that draw from two pools at once.
      </div>
    </form>`;

  const DialogV2 = foundry.applications.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error("DialogV2 unavailable — please update to Foundry V13+");
    return;
  }

  const dialog = new DialogV2({
    window: { title: `Pricing — ${item.name}` },
    content,
    buttons: [
      {
        action: "save",
        label: "Save",
        default: true,
        callback: async (_ev, _btn, dlg) => {
          const form = dlg.element.querySelector("form");
          const marks = Number(form.elements.marks?.value);
          const currency = form.elements.currency?.value;
          if (!Number.isFinite(marks)) return;
          const override = isOverride(currency, frame);
          const next = {
            marks,
            currency,
            gmOverride: override,
            notes: _autoNotes({
              tier:    rfi.tier ?? "I",
              frame,
              bound:   rfi.bound ?? "free",
              hasTech: Boolean(tech),
              currency: currency === "auto" ? def : currency,
              override
            })
          };
          // If user picked a non-split currency, clear any existing split.
          if (currency !== "split") next.split = null;
          await _writePartialPrice(item, next);
        }
      },
      { action: "cancel", label: "Cancel" }
    ],
    rejectClose: false
  });

  await dialog.render(true);
  // Wire the Split button + live sale-back recompute after render.
  const form = dialog.element.querySelector("form");
  const splitBtn = form?.querySelector('[data-action="open-split"]');
  splitBtn?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    await openSplitDialog(item);
    // Close the parent dialog after split flow — the user can re-open if needed.
    dialog.close();
  });
  const marksInput = form?.elements?.marks;
  const saleBackNode = form?.querySelector('[data-sale-back]');
  marksInput?.addEventListener("input", () => {
    const v = Number(marksInput.value);
    const bound = rfi.bound ?? "free";
    if (saleBackNode) saleBackNode.textContent = String(computeSaleBack(v, bound));
  });
}

// Legacy strip helpers retained for reference/disabled — no longer used.
function _buildPricingStrip(item) {
  if (!_isPriceableItem(item)) return "";
  const rfi   = RfiItems.get(item) ?? {};
  const frame = rfi.frame ?? "tool";
  const stored = foundry.utils.getProperty(item, `flags.${RFI_ITEM_FLAG_NS}.${RFI_ITEM_FLAG_KEY}.price`);
  const price  = stored ?? defaultPriceFor(item);
  const tech   = foundry.utils.getProperty(item, `flags.${RFI_ITEM_FLAG_NS}.${RFI_ITEM_FLAG_KEY}.tech`);

  const isUnstamped = !stored;
  const def = defaultCurrencyForFrame(frame);

  const poolOpts = ['<option value="auto"' + (price.currency === "auto" ? " selected" : "") + '>Auto (' + (OP_POOL_LABELS[def] ?? def) + ')</option>'];
  for (const k of OP_POOLS) {
    const label = OP_POOL_LABELS[k];
    const sel = (price.currency === k && !price.split) ? " selected" : "";
    poolOpts.push(`<option value="${k}"${sel}>${label}${k === def ? " ★" : ""}</option>`);
  }
  poolOpts.push(`<option value="split"${price.split ? " selected" : ""}>Split…</option>`);

  // Split summary if active.
  let splitSummary = "";
  if (price.split && typeof price.split === "object") {
    const parts = Object.entries(price.split)
      .filter(([_, v]) => Number(v) > 0)
      .map(([k, v]) => `${OP_POOL_LABELS[k] ?? k} ${v}`)
      .join(" + ");
    splitSummary = parts ? `<div class="rfi-pricing-split-summary">↗ ${parts}</div>` : "";
  }

  const overrideBadge = price.gmOverride
    ? `<span class="rfi-pricing-override" title="GM override — price-audit will skip this item">GM ✎</span>`
    : "";
  const techBadge = tech
    ? `<span class="rfi-pricing-tech" title="Technomagical (×2 base multiplier)">⚙ tech</span>`
    : "";
  const unstampedBadge = isUnstamped
    ? `<span class="rfi-pricing-unstamped" title="Stamped from defaults — save to persist">unsaved</span>`
    : "";

  // CSS lives in styles/fourththing.css now (loaded once at boot). This used
  // to be inline; the inline approach was prone to FT custom sheets' flex
  // layout absorbing the strip into a tiny child of .window-content above
  // the .ft-item-sheet (which has height: 100% and squashed everything).
  return `
    <div class="rfi-pricing-strip">
      <div class="rfi-pricing-row">
        <span class="rfi-pricing-label">List</span>
        <input type="number" class="rfi-pricing-marks-input" data-rfi-pricing-action="marks"
               value="${price.marks}" min="-1" step="5" title="Total list price in marks. -1 = priceless / not for sale."/>
        <span style="opacity:0.6">marks</span>
        <span class="rfi-pricing-label" style="margin-left:0.6em">Pool</span>
        <select class="rfi-pricing-pool-select" data-rfi-pricing-action="currency">${poolOpts.join("")}</select>
        <button type="button" class="rfi-pricing-split-btn" data-rfi-pricing-action="open-split"
                title="Author multi-pool split price">Split…</button>
        <span class="rfi-pricing-saleback" title="Sale-back at 40% of list (0 if soulbound)">↺ ${price.saleBack ?? 0}</span>
        ${overrideBadge}${techBadge}${unstampedBadge}
      </div>
      ${splitSummary}
      <div class="rfi-pricing-notes">${price.notes ?? ""}</div>
    </div>`;
}

function _injectPricingStrip(sheet, html) {
  try {
    if (sheet?.constructor?.name && _PRICING_STRIP_SKIP_SHEETS.has(sheet.constructor.name)) return;
    const item = sheet?.document ?? sheet?.item;
    if (!item) return;
    if (!_isPriceableItem(item)) return;

    const root = html?.[0] ?? html;
    if (!root || root.querySelector?.(".rfi-pricing-strip")) return; // idempotent

    const stripHtml = _buildPricingStrip(item);
    if (!stripHtml) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = stripHtml.trim();
    const stripNode = wrap.querySelector(".rfi-pricing-strip");
    if (!stripNode) return;

    // Anchor priority — must always land *inside* a content container the FT
    // sheet won't squash:
    //   1. .ft-item-body  — top of the body section (FT custom sheets)
    //   2. .ft-item-sheet — between header and body, sibling-of-body
    //   3. .window-content — default ItemSheetV2 (no FT custom layout)
    //   4. root            — last-resort fallback
    // Avoid placing as a sibling of `.ft-item-sheet` itself: that element has
    // `height: 100%` and steals all flex space, collapsing the strip into a
    // tiny element next to the title bar (the bug we hit before).
    const ftBody = root.querySelector?.(".ft-item-body");
    const ftSheet = root.querySelector?.(".ft-item-sheet");
    const winContent = root.querySelector?.(".window-content");

    if (ftBody) {
      ftBody.insertBefore(stripNode, ftBody.firstChild);
    } else if (ftSheet) {
      // Append at the end of .ft-item-sheet (after header, after body content).
      ftSheet.appendChild(stripNode);
    } else if (winContent) {
      winContent.insertBefore(stripNode, winContent.firstChild);
    } else if (root) {
      root.insertBefore(stripNode, root.firstChild);
    } else {
      return;
    }

    _bindPricingStripHandlers(item, root);
  } catch (e) {
    console.warn("Roll for Initiation | RFI pricing strip injection failed", e);
  }
}

function _bindPricingStripHandlers(item, root) {
  const strip = root.querySelector(".rfi-pricing-strip");
  if (!strip) return;

  // Marks input — debounced flush on change/blur.
  const marksInput = strip.querySelector('[data-rfi-pricing-action="marks"]');
  marksInput?.addEventListener("change", async (ev) => {
    const v = Number(ev.target.value);
    if (!Number.isFinite(v)) return;
    await _writePartialPrice(item, { marks: v });
  });

  // Currency picker.
  const poolSelect = strip.querySelector('[data-rfi-pricing-action="currency"]');
  poolSelect?.addEventListener("change", async (ev) => {
    const value = ev.target.value;
    if (value === "split") {
      // Open the split dialog; don't persist a "split" string as currency.
      const result = await openSplitDialog(item);
      if (!result) {
        // User cancelled — revert dropdown to whatever currency is stored.
        const cur = (await _readPrice(item))?.currency ?? "auto";
        ev.target.value = cur;
      }
      return;
    }
    const rfi = RfiItems.get(item) ?? {};
    const override = isOverride(value, rfi.frame ?? "tool");
    await _writePartialPrice(item, {
      currency:   value,
      gmOverride: override,
      split:      null,
      notes:      _autoNotes({
        tier:    rfi.tier ?? "I",
        frame:   rfi.frame ?? "tool",
        bound:   rfi.bound ?? "free",
        hasTech: Boolean(foundry.utils.getProperty(item, `flags.${RFI_ITEM_FLAG_NS}.${RFI_ITEM_FLAG_KEY}.tech`)),
        currency: value === "auto" ? defaultCurrencyForFrame(rfi.frame ?? "tool") : value,
        override
      })
    });
    // Re-render the sheet to refresh the strip (override pill, notes, etc.).
    item.sheet?.render(false);
  });

  // Split button (separate from the dropdown's "Split…" entry).
  const splitBtn = strip.querySelector('[data-rfi-pricing-action="open-split"]');
  splitBtn?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    await openSplitDialog(item);
  });
}

// ─── Split sub-dialog ────────────────────────────────────────────────────────

/**
 * Open the multi-pool split-price authoring dialog for an item. Resolves with
 * the saved split object, or null if the user cancelled.
 */
export async function openSplitDialog(item) {
  const cur = (await _readPrice(item)) ?? defaultPriceFor(item);
  const split = cur.split ?? {};
  const totalMarks = Number(cur.marks) || 0;

  const rows = OP_POOLS.map(k => {
    const v = Number(split[k]) || 0;
    return `
      <div style="display:flex;align-items:center;gap:0.5em;margin:0.3em 0;">
        <label style="min-width:8em;">${OP_POOL_LABELS[k]}</label>
        <input type="number" name="split.${k}" value="${v}" min="0" step="5" style="width:6em;text-align:right;"/>
        <span style="opacity:0.6">marks</span>
      </div>`;
  }).join("");

  const content = `
    <form>
      <p style="font-size:0.9em;opacity:0.8;margin:0 0 0.6em 0;">
        Distribute the list price across OP pools. Each portion is paid from its native pool with no friction.
        The sum should equal the total list (<strong>${totalMarks}</strong> marks). ±2 rounding tolerance.
      </p>
      ${rows}
      <hr style="margin:0.6em 0;"/>
      <div style="display:flex;align-items:center;gap:0.5em;">
        <strong>Sum:</strong>
        <span data-split-total style="font-variant-numeric:tabular-nums;">0</span>
        <span data-split-variance style="opacity:0.7;">/ ${totalMarks}</span>
      </div>
      <p style="font-size:0.78em;opacity:0.6;margin:0.4em 0 0 0;">
        Tip: clearing all pools to 0 removes the split (single-currency mode).
      </p>
    </form>`;

  const DialogV2 = foundry.applications.api?.DialogV2;
  if (!DialogV2) {
    ui.notifications?.error("DialogV2 unavailable — please update to Foundry V13+");
    return null;
  }

  // rejectClose:true makes X-close throw — the outer try/catch maps that to
  // a clean null resolution so callers can revert UI without ambiguity.
  let savedResult = null;
  const dialog = new DialogV2({
    window: { title: `Split Price — ${item.name}` },
    content,
    buttons: [
      {
        action: "save",
        label: "Save Split",
        default: true,
        callback: async (_ev, _btn, dlg) => {
          const form = dlg.element.querySelector("form");
          const next = {};
          let sum = 0;
          for (const k of OP_POOLS) {
            const v = Math.max(0, Number(form.elements[`split.${k}`]?.value) || 0);
            if (v > 0) next[k] = v;
            sum += v;
          }
          if (sum === 0) {
            const frame = (RfiItems.get(item) ?? {}).frame ?? "tool";
            await _writePartialPrice(item, {
              split:      null,
              currency:   defaultCurrencyForFrame(frame),
              gmOverride: false
            });
            savedResult = null;
            return;
          }
          const variance = Math.abs(sum - totalMarks);
          if (variance > 2) {
            ui.notifications?.warn(`Split sum ${sum} differs from list ${totalMarks} by ${variance} (>2 marks tolerance). Saved anyway — list updated to match.`);
          }
          await _writePartialPrice(item, {
            split:      next,
            currency:   "split",
            gmOverride: true,
            marks:      sum
          });
          savedResult = next;
        }
      },
      { action: "cancel", label: "Cancel", callback: () => { savedResult = null; } }
    ],
    rejectClose: true
  });

  try {
    await dialog.render(true);
    // Live total updater — safe to bind after render resolves.
    const form = dialog.element.querySelector("form");
    const totalNode = dialog.element.querySelector("[data-split-total]");
    const varNode = dialog.element.querySelector("[data-split-variance]");
    const recompute = () => {
      let sum = 0;
      for (const k of OP_POOLS) sum += Math.max(0, Number(form?.elements?.[`split.${k}`]?.value) || 0);
      if (totalNode) totalNode.textContent = String(sum);
      if (varNode) {
        const variance = Math.abs(sum - totalMarks);
        varNode.textContent = `/ ${totalMarks}` + (variance > 2 ? `  (Δ${sum - totalMarks > 0 ? "+" : ""}${sum - totalMarks})` : " ✓");
        varNode.style.color = (sum === 0 || variance <= 2) ? "" : "#d46a6a";
      }
    };
    form?.addEventListener("input", recompute);
    recompute();
    // Wait for the dialog to close (button or X). DialogV2 exposes the
    // submission promise via `dialog.wait()` in V13+; fall back to polling
    // if unavailable.
    if (typeof dialog.wait === "function") {
      await dialog.wait().catch(() => null);
    } else {
      await new Promise(resolve => {
        const checkClosed = () => dialog.rendered ? setTimeout(checkClosed, 100) : resolve();
        checkClosed();
      });
    }
  } catch {
    // X-close path (rejectClose: true rejects) — savedResult stays null.
  }

  if (savedResult !== undefined) item.sheet?.render(false);
  return savedResult;
}

// ─── Hook registration + API exposure ────────────────────────────────────────

Hooks.on("preCreateItem", _stampDefaultsPreCreate);

// V13 AppV2 fires render hooks by leaf-class name, NOT parent. `renderItemSheetV2`
// only catches the default ItemSheetV2 — it misses FourthThingWeaponSheet/etc.
// `renderApplicationV2` is the universal wide-net hook (rest of codebase uses
// it for the same reason — see module.js:13146, 13742).
Hooks.on("renderApplicationV2", (app, html) => {
  _injectPricingHeaderButton(app, html);
});

// Defensive: also catch V1 legacy sheets (rare in v0.6.0+).
Hooks.on("renderItemSheet", (app, html) => {
  _injectPricingHeaderButton(app, html);
});

Hooks.once("init", () => {
  game.fourththing ??= {};
  game.fourththing.pricing = RfiPricing;
});

export default RfiPricing;
