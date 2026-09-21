// Roll for Initiation — RFI Crafting & Gathering Engine
// ─────────────────────────────────────────────────────────────────────────────
// Materials are gear items with frame="material" and a materialKey flag. They
// stack via flags.fourththing.rfi.item.charges (N units per stack). Recipes
// are ANY item with a populated `materialOf` array — the engine reads that
// directly, so every item we've already authored is a craftable target.
//
// Public API on `game.fourththing.craft`:
//   inventory(actor)         → { materialKey: totalUnits } map
//   recipeFor(item)          → [{ key, qty }] requirements
//   difficulty(item)         → { dc, skill, tier }
//   canCraft(actor, item)    → { ok, missing, recipe, difficulty }
//   recipesAvailable(actor)  → [{ item, check }] for items in active library
//                              (currently: items already in any compendium the
//                              GM has unlocked + the world's items)
//   tryCraft(actor, item)    → rolls, deducts, creates output, posts chat
//
// On a successful craft, output item flags.origin = "crafted" and originator
// = actor.uuid (matches the schema we shipped in Phase 2).
// ─────────────────────────────────────────────────────────────────────────────

import RfiItems from "./rfi-items.js";
import { tierFeeForTier, materialUnitPriceMarks } from "./rfi-pricing.js";

const TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };

// KEY ALIASES (owner ruling 2026-09-20 — one thing, two spellings): the recipe libraries say `pre-fall-component` and
// `scrap-steel`; the material items and the hex nodes say `prefall-component` and `scrap-salvage`. The Forge treats each
// pair as ONE key so what the land yields satisfies what the recipes ask. Add a row here rather than minting a twin item.
const KEY_ALIASES = Object.freeze({
  "prefall-component": "pre-fall-component",
  "scrap-salvage":     "scrap-steel"
});
function canonKey(key) { const k = String(key || ""); return KEY_ALIASES[k] || k; }

// THE RECIPE BOOK (owner ruling 2026-09-20 — "everyone has everything; we could use some variety"): a recipe is KNOWN
// to a steward when its slug sits in the COMMON book, in their faction's book, or in their own. One world setting holds
// all three (`fourththing.recipeBook = { common:[], factions:{ <actorId>:[] }, stewards:{ <actorId>:[] } }`); beats teach
// through worldEffects.recipeGrants; `seed-recipe-books` deals the opening hands. An EMPTY book gates nothing (back-compat).
const BOOK_SETTING = "recipeBook";
function slugOf(itemOrName) {
  const n = typeof itemOrName === "string" ? itemOrName : String(itemOrName?.name || "");
  return n.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function _readBook() {
  let b = null; try { b = game.settings.get("fourththing", BOOK_SETTING); } catch (_e) {}
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (_e) { b = null; } }
  b = (b && typeof b === "object") ? foundry.utils.deepClone(b) : {};
  b.common = Array.isArray(b.common) ? b.common : []; b.factions = (b.factions && typeof b.factions === "object") ? b.factions : {}; b.stewards = (b.stewards && typeof b.stewards === "object") ? b.stewards : {};
  return b;
}
async function _writeBook(b) { await game.settings.set("fourththing", BOOK_SETTING, b); return b; }
// EMOTIONAL INGREDIENTS ARE RECEIPTS (owner ruling 2026-09-21): a recipe key no ore can fill (regret, team-spirit,
// summer-memory…) is satisfied by a RECEIPT the steward's faction holds — a courtly-secret Item whose `ingredientKey`
// flag, or the slug of its name, equals the key. One Receipt = one unit; the Forge spends it (the Receipt is consumed).
function _receiptKey(item) {
  const sec = item?.flags?.["bbttcc-raid"]?.secret; if (!sec) return null;
  return String(sec.ingredientKey || slugOf(item.name) || "").trim() || null;
}
function _bookEmpty(b) { return !b.common.length && !Object.values(b.factions).some(a => Array.isArray(a) && a.length) && !Object.values(b.stewards).some(a => Array.isArray(a) && a.length); }

function _normalizeRecipe(materialOfArr) {
  return (materialOfArr ?? []).map(m => {
    if (typeof m === "string") return { key: canonKey(m), qty: 1 };
    return { key: canonKey(m.key), qty: Math.max(1, Number(m.qty || 1)) };
  });
}

export const RfiCrafting = {
  /**
   * Sum every material-frame item on the actor by its materialKey.
   * Stacks pull from `flags.fourththing.rfi.item.charges` (default 1).
   */
  inventory(actor, { includeFaction = true } = {}) {
    const map = {};
    if (!actor?.items) return map;
    for (const item of actor.items) {
      const rfi = item.getFlag?.("fourththing", "rfi.item");
      if (!rfi || rfi.frame !== "material" || !rfi.materialKey) continue;
      const qty = Number(rfi.charges ?? 1);
      const k = canonKey(rfi.materialKey);
      map[k] = (map[k] || 0) + qty;
    }
    // THE FACTION STOCKPILE COUNTS (owner ruling 2026-09-20): a steward short in the pockets forges from the faction's
    // stockpile. Pockets first, stockpile second (see _spend).
    if (includeFaction) { try { const F = RfiCrafting.factionOf(actor); const stock = game.bbttcc?.api?.factions?.stockpile; if (F && stock?.get) for (const [k0, v] of Object.entries(stock.get(F) || {})) { const k = canonKey(k0); const q = Number(v?.qty || 0); if (q > 0) map[k] = (map[k] || 0) + q; } } catch (_e) {} }
    if (includeFaction) { try { for (const [k, items] of Object.entries(RfiCrafting.receiptIngredients(actor))) map[k] = (map[k] || 0) + items.length; } catch (_e) {} }
    return map;
  },

  /** The steward's faction's Receipts as ingredients → { key: [Item, …] } (see _receiptKey). */
  receiptIngredients(actor) {
    const out = {}; const F = RfiCrafting.factionOf(actor); if (!F) return out;
    for (const it of (F.items?.contents || F.items || [])) { const k = _receiptKey(it); if (!k) continue; (out[k] = out[k] || []).push(it); }
    return out;
  },

  /** Recipe-side spelling of a material key (see KEY_ALIASES). */
  canonKey,
  KEY_ALIASES,

  /** The recipe book — who knows what. */
  recipes: {
    slugOf,
    book: _readBook,
    /** Slugs this steward may forge: common ∪ their faction's ∪ their own. `null` = the book is empty, nothing is gated. */
    knownSet(actor) {
      const b = _readBook(); if (_bookEmpty(b)) return null;
      const out = new Set(b.common.map(String));
      const F = RfiCrafting.factionOf(actor); if (F && Array.isArray(b.factions[F.id])) for (const x of b.factions[F.id]) out.add(String(x));
      if (actor?.id && Array.isArray(b.stewards[actor.id])) for (const x of b.stewards[actor.id]) out.add(String(x));
      return out;
    },
    isKnown(actor, item) { const k = RfiCrafting.recipes.knownSet(actor); return k === null ? true : k.has(slugOf(item)); },
    /** learn(["combat-knife", item, "Hand Axe"], { scope: "common" | "faction" | "steward", id? }) → { added: [slugs] } */
    async learn(what, { scope = "faction", id = null } = {}) {
      const slugs = [].concat(what || []).map(slugOf).filter(Boolean); if (!slugs.length) return { added: [] };
      const b = _readBook(); let list;
      if (scope === "common") list = b.common;
      else { const key = String(id || "").replace(/^Actor\./, ""); if (!key) return { added: [], error: "id required" }; const bag = scope === "steward" ? b.stewards : b.factions; list = (bag[key] = Array.isArray(bag[key]) ? bag[key] : []); }
      const added = slugs.filter(x => !list.includes(x)); list.push(...added);
      if (added.length) await _writeBook(b);
      try { Hooks.callAll("fourththing.recipesLearned", { scope, id, added }); } catch (_e) {}
      return { added };
    },
    async forget(what, { scope = "faction", id = null } = {}) {
      const slugs = new Set([].concat(what || []).map(slugOf)); const b = _readBook();
      if (scope === "common") b.common = b.common.filter(x => !slugs.has(x));
      else { const key = String(id || "").replace(/^Actor\./, ""); const bag = scope === "steward" ? b.stewards : b.factions; if (Array.isArray(bag[key])) bag[key] = bag[key].filter(x => !slugs.has(x)); }
      await _writeBook(b); return { ok: true };
    },
    async setBook(b) { return _writeBook(b && typeof b === "object" ? b : {}); }
  },

  /** The steward's faction actor (system.faction.id), or null. */
  factionOf(actor) {
    const id = String(foundry.utils.getProperty(actor ?? {}, "system.faction.id") || "").replace(/^Actor\./, "");
    return id ? (game.actors?.get?.(id) || null) : null;
  },

  /**
   * Read the recipe (materials + qty) off an item's RFI flags. Returns [] for
   * items with no `materialOf`.
   */
  recipeFor(item) {
    const rfi = item?.getFlag?.("fourththing", "rfi.item")
             ?? foundry.utils.getProperty(item ?? {}, "flags.fourththing.rfi.item")
             ?? {};
    return _normalizeRecipe(rfi.materialOf);
  },

  /**
   * DC + skill for a craft attempt. DC = 8 + (tier * 3). Skill defaults to
   * Soul (the ritualcraft skill); items can override via
   * flags.fourththing.rfi.item.craftSkill.
   */
  difficulty(item) {
    const rfi = item?.getFlag?.("fourththing", "rfi.item")
             ?? foundry.utils.getProperty(item ?? {}, "flags.fourththing.rfi.item")
             ?? {};
    const tierInt = TIER_INT[rfi.tier] ?? 1;
    return {
      tier:  rfi.tier ?? "I",
      dc:    8 + tierInt * 3,
      skill: rfi.craftSkill ?? "soul"
    };
  },

  /**
   * Compute the marks-denominated cost of crafting an item (rubric §4).
   * Returns:
   *   tierFee       — marks deducted from the steward's faction Economy pool
   *                   when the craft is initiated (non-refundable on failure)
   *   materialsCost — conceptual retail value of consumed materials, summed
   *                   per recipe entry from the actor's inventory using
   *                   tier × 0.1 × rarityMult. Informational only.
   *   total         — tierFee + materialsCost (used for "this craft is worth
   *                   X marks" framing in the chat receipt)
   *   tier          — output item tier ("I"–"IV")
   *   factionId     — actor.system.faction.id (null if unset; fee won't deduct)
   *
   * The actual marks deduction at craft-time is only `tierFee`. Materials are
   * consumed off the inventory by `_spend`; the rubric models them as already-
   * paid (you harvested or bought them earlier). materialsCost is shown for
   * profit-margin clarity.
   */
  computeCraftCost(actor, recipeItem) {
    const rfiOut = recipeItem?.getFlag?.("fourththing", "rfi.item")
                ?? foundry.utils.getProperty(recipeItem ?? {}, "flags.fourththing.rfi.item")
                ?? {};
    const tier = rfiOut.tier ?? "I";
    const tierFee = tierFeeForTier(tier);
    const recipe = RfiCrafting.recipeFor(recipeItem);

    // Build a quick materialKey → {tier, rarityMult} index from the actor's
    // inventory so we can price each recipe portion.
    const matIndex = {};
    for (const item of actor?.items ?? []) {
      const rfi = item.getFlag?.("fourththing", "rfi.item");
      if (!rfi || rfi.frame !== "material" || !rfi.materialKey) continue;
      const mk = canonKey(rfi.materialKey);
      if (matIndex[mk]) continue;
      const matTier = rfi.tier ?? "I";
      const rarityMult = Number(foundry.utils.getProperty(item, "flags.fourththing.rfi.item.price.rarityMult"))
        || 1.0;
      matIndex[mk] = { tier: matTier, rarityMult };
    }

    let materialsCost = 0;
    for (const r of recipe) {
      const meta = matIndex[r.key];
      if (!meta) continue;  // material not in inventory (shouldn't reach here — canCraft already gated)
      materialsCost += r.qty * materialUnitPriceMarks(meta.tier, meta.rarityMult);
    }

    const factionId = foundry.utils.getProperty(actor ?? {}, "system.faction.id") || null;

    return {
      tier,
      tierFee,
      materialsCost,
      total: tierFee + materialsCost,
      factionId
    };
  },

  /**
   * Check whether the actor has enough materials. Returns missing list with
   * have/need for each shortfall.
   */
  canCraft(actor, recipeItem) {
    const recipe = RfiCrafting.recipeFor(recipeItem);
    const inv = RfiCrafting.inventory(actor);
    const missing = recipe
      .map(r => ({ key: r.key, need: r.qty, have: inv[r.key] || 0 }))
      .filter(x => x.have < x.need);
    return {
      ok: recipe.length > 0 && missing.length === 0,
      hasRecipe: recipe.length > 0,
      missing,
      recipe,
      difficulty: RfiCrafting.difficulty(recipeItem)
    };
  },

  /**
   * Walk world items + visible compendia for recipe targets the actor has
   * materials for. Excludes items that ARE materials themselves and items
   * whose recipe is empty.
   */
  async recipesAvailable(actor, { includeMissing = false, includeUnknown = false } = {}) {
    const inv = RfiCrafting.inventory(actor);
    const knownSet = RfiCrafting.recipes.knownSet(actor);   // null = nothing gated
    const candidates = [];

    // World items.
    for (const item of (game.items ?? [])) {
      if (item?.getFlag?.("fourththing", "rfi.item.frame") === "material") continue;
      const r = RfiCrafting.recipeFor(item);
      if (!r.length) continue;
      candidates.push(item);
    }

    // Compendium items — only packs that are visible to the user.
    for (const pack of (game.packs ?? [])) {
      if (pack.documentName !== "Item") continue;
      const docs = await pack.getDocuments();
      for (const item of docs) {
        if (item?.getFlag?.("fourththing", "rfi.item.frame") === "material") continue;
        const r = RfiCrafting.recipeFor(item);
        if (!r.length) continue;
        candidates.push(item);
      }
    }

    const out = [];
    for (const item of candidates) {
      const recipe = RfiCrafting.recipeFor(item);
      const missing = recipe
        .map(r => ({ key: r.key, need: r.qty, have: inv[r.key] || 0 }))
        .filter(x => x.have < x.need);
      const known = knownSet === null ? true : knownSet.has(slugOf(item));
      if (!known && !includeUnknown) continue;
      const ok = missing.length === 0 && known;
      if (ok || includeMissing) {
        out.push({ item, ok, known, missing, recipe, difficulty: RfiCrafting.difficulty(item) });
      }
    }
    return out.sort((a, b) => {
      const ai = TIER_INT[a.difficulty.tier] ?? 1;
      const bi = TIER_INT[b.difficulty.tier] ?? 1;
      return ai - bi || a.item.name.localeCompare(b.item.name);
    });
  },

  /**
   * Spend the listed materials off the actor. Drains stacks (decrement
   * charges); deletes the item when its charge hits 0.
   */
  async _spend(actor, recipe) {
    const remaining = {};
    for (const r of recipe) remaining[r.key] = (remaining[r.key] || 0) + r.qty;

    // Iterate a snapshot so we can delete safely.
    const items = Array.from(actor.items ?? []);
    for (const item of items) {
      const rfi = item.getFlag?.("fourththing", "rfi.item");
      if (!rfi || rfi.frame !== "material" || !rfi.materialKey) continue;
      const mk = canonKey(rfi.materialKey);
      const need = remaining[mk] || 0;
      if (need <= 0) continue;
      const have = Number(rfi.charges ?? 1);
      const take = Math.min(have, need);
      remaining[mk] -= take;
      const left = have - take;
      if (left <= 0) {
        await item.delete();
      } else {
        await item.setFlag("fourththing", "rfi.item.charges", left);
      }
      if (Object.values(remaining).every(v => v <= 0)) break;
    }
    // what the pockets couldn't cover comes out of the faction stockpile (2026-09-20)
    try {
      const F = RfiCrafting.factionOf(actor); const stock = game.bbttcc?.api?.factions?.stockpile;
      if (F && stock?.adjust && stock?.get) for (const [key, need0] of Object.entries(remaining)) {
        let need = need0; if (need <= 0) continue;
        // the stockpile is keyed by the item's own spelling — every alias of the recipe key may pay
        for (const [k0, v] of Object.entries(stock.get(F) || {})) {
          if (need <= 0) break; if (canonKey(k0) !== key) continue;
          const have = Number(v?.qty || 0); const take = Math.min(have, need); if (take <= 0) continue;
          await stock.adjust(F, k0, -take, {}); need -= take;
        }
        remaining[key] = need;
      }
    } catch (eS) { console.warn("Roll for Initiation | forge stockpile draw failed", eS); }
    // …and what neither covers may be a RECEIPT — an emotional ingredient the faction holds; the Forge spends it
    try {
      const rec = RfiCrafting.receiptIngredients(actor);
      for (const [key, need0] of Object.entries(remaining)) {
        let need = need0; const items = rec[key] || [];
        while (need > 0 && items.length) { const it = items.shift(); try { await it.delete(); need -= 1; console.log("Roll for Initiation | forge spent a Receipt:", it.name, "as", key); } catch (eD) { console.warn("Roll for Initiation | receipt spend failed", eD); break; } }
        remaining[key] = need;
      }
    } catch (eR) { console.warn("Roll for Initiation | forge receipt spend failed", eR); }
  },

  /**
   * Attempt to craft. Rolls 2d10 + (skill attribute). On success, drains
   * materials and creates a fresh copy of the recipe item on the actor with
   * origin="crafted" + originator=actor.uuid. On failure, drains half the
   * materials (rounded up) and produces nothing. Posts a chat receipt.
   */
  async tryCraft(actor, recipeItem, { force = false } = {}) {
    const check = RfiCrafting.canCraft(actor, recipeItem);
    if (!force && !RfiCrafting.recipes.isKnown(actor, recipeItem)) {
      ui.notifications?.warn(`${actor.name} doesn't know how to make ${recipeItem.name} yet.`);
      return { ok: false, reason: "unknown-recipe" };
    }
    if (!check.hasRecipe) {
      ui.notifications?.warn(`${recipeItem.name} has no recipe (no materialOf tags).`);
      return { ok: false, reason: "no-recipe" };
    }
    if (!check.ok) {
      ui.notifications?.warn(`Missing materials: ${check.missing.map(m => `${m.key} (${m.have}/${m.need})`).join(", ")}`);
      return { ok: false, reason: "missing-materials", missing: check.missing };
    }

    // ── Forge fee (rubric §4, Phase 6) ──
    // Deduct the tier-scaled marks fee from the steward's faction Economy pool
    // BEFORE the roll, so the forge keeps it on a failed craft (rubric: "no
    // marks-fee refund. Forge keeps the fee.")
    const cost = RfiCrafting.computeCraftCost(actor, recipeItem);
    let feeReceipt = null;
    if (cost.tierFee > 0) {
      if (!cost.factionId) {
        ui.notifications?.warn(`Cannot craft ${recipeItem.name}: ${actor.name} has no faction set to pay the forge fee (${cost.tierFee} marks).`);
        return { ok: false, reason: "no-faction", tierFee: cost.tierFee };
      }
      const opApi = game.bbttcc?.api?.op;
      if (!opApi?.commit) {
        ui.notifications?.warn("OP API unavailable — cannot charge forge fee.");
        return { ok: false, reason: "no-op-api" };
      }
      const res = await opApi.commit(cost.factionId, { economy: -cost.tierFee }, {
        source: "forge",
        label:  `Forge fee — ${recipeItem.name}`,
        note:   `T${cost.tier} forge fee (${cost.tierFee} marks). Materials @ retail: ${cost.materialsCost} marks. Total economic value: ${cost.total} marks.`
      });
      if (!res?.committed) {
        ui.notifications?.warn(`Forge fee refused: insufficient Economy OP (need ${cost.tierFee} marks).`);
        return { ok: false, reason: "insufficient-marks", tierFee: cost.tierFee, underflow: res?.underflow };
      }
      feeReceipt = { committed: cost.tierFee, factionId: cost.factionId };
    }

    const { dc, skill } = check.difficulty;
    const sys  = actor.system?.system ?? actor.system;
    const baseAttr = Number(sys?.attributes?.[skill]?.value ?? 0);

    // Passive AE bonuses (mode 2 = ADD) on the attribute being used.
    const aeContribs = [];
    let aeAttr = 0;
    for (const effect of actor.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || change.key !== `system.attributes.${skill}.value`) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        aeAttr += v;
        aeContribs.push({ src, label: skill, value: v });
      }
    }
    const attr = baseAttr + aeAttr;
    const formula = `2d10 + ${attr}`;
    const roll = new Roll(formula);
    await roll.evaluate();
    const total = roll.total;
    const margin = total - dc;
    const success = margin >= 0;
    // "Great Success" — margin ≥ 5 — counts as a Yesodium-canonical
    // Harmonization. Recipes that require harmonization (e.g. Yesodic
    // exemplars) only stamp `harmonized: true` on a great success.
    const greatSuccess = margin >= 5;
    // Critical Failure — failure by 5 or more — triggers Reversion-grade
    // outcomes. We surface it in the chat receipt; the engine still costs
    // half materials (no extra penalty in this MVP).
    const criticalFailure = margin <= -5;

    const recipeFlag = recipeItem.getFlag?.("fourththing", "rfi.item") ?? {};
    const requiresHarm = !!recipeFlag.requiresHarmonization;

    if (success) {
      await RfiCrafting._spend(actor, check.recipe);
      const data = recipeItem.toObject();
      delete data._id;
      // Stamp crafted origin + originator (Phase 2 schema).
      foundry.utils.setProperty(data, "flags.fourththing.rfi.item.origin",     "crafted");
      foundry.utils.setProperty(data, "flags.fourththing.rfi.item.originator", actor.uuid);
      // Harmonization — only stamps when the recipe asked for it AND the
      // forge roll cleared the Great Success threshold. Other recipes ignore.
      if (requiresHarm) {
        foundry.utils.setProperty(data, "flags.fourththing.rfi.item.harmonized", greatSuccess);
      }
      await actor.createEmbeddedDocuments("Item", [data]);
    } else {
      const halfRecipe = check.recipe.map(r => ({ key: r.key, qty: Math.ceil(r.qty / 2) }));
      await RfiCrafting._spend(actor, halfRecipe);
    }

    const matLine = check.recipe.map(r => `${r.key} ×${r.qty}`).join(", ");
    const outcomeLine = success
      ? (greatSuccess
          ? (requiresHarm ? "✦ <b>Great Success</b> — Harmonized." : "✦ <b>Great Success</b> — exceptional craft.")
          : "✓ <b>Success</b> — added to inventory.")
      : (criticalFailure
          ? "✗ <b>Critical Failure</b> — slag and dream-fracture; half materials gone."
          : "✗ <b>Failed</b> — half materials wasted.");
    const feeLine = (cost.tierFee > 0)
      ? `Forge fee: ${cost.tierFee} marks (T${cost.tier}, Economy)${cost.materialsCost > 0 ? ` · Materials @ retail: ${cost.materialsCost} marks` : ""}${!success ? " — <i>forge keeps it</i>" : ""}<br>`
      : "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll ft-magic-roll">
                  <div class="ft-misfire-box standalone" style="border-color:${success ? (greatSuccess ? "#d4a35f" : "#5fb35f") : "#d46a6a"}">
                    <span class="ft-misfire-label">⚒ Forging — ${recipeItem.name}${requiresHarm && greatSuccess ? " <span style='color:#d4a35f'>· HARMONIZED</span>" : ""}</span>
                    <p class="ft-misfire-desc">
                      ${formula} → <b>${total}</b> vs DC ${dc} (${skill}, margin ${margin >= 0 ? "+" : ""}${margin})<br>
                      ${aeContribs.length ? `<span style="color:#e8c84a;font-size:0.78rem">Passives: ${aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")}</span><br>` : ""}
                      Materials: ${matLine}<br>
                      ${feeLine}${outcomeLine}
                    </p>
                  </div></div>`
    });

    return {
      ok: true,
      success, greatSuccess, criticalFailure,
      total, dc, margin,
      harmonized: success && requiresHarm && greatSuccess,
      item: success ? recipeItem.uuid : null,
      cost,            // { tier, tierFee, materialsCost, total, factionId }
      feeReceipt       // { committed, factionId } or null
    };
  }
};

export default RfiCrafting;
