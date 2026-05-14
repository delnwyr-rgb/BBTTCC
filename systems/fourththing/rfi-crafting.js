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

function _normalizeRecipe(materialOfArr) {
  return (materialOfArr ?? []).map(m => {
    if (typeof m === "string") return { key: m, qty: 1 };
    return { key: String(m.key), qty: Math.max(1, Number(m.qty || 1)) };
  });
}

export const RfiCrafting = {
  /**
   * Sum every material-frame item on the actor by its materialKey.
   * Stacks pull from `flags.fourththing.rfi.item.charges` (default 1).
   */
  inventory(actor) {
    const map = {};
    if (!actor?.items) return map;
    for (const item of actor.items) {
      const rfi = item.getFlag?.("fourththing", "rfi.item");
      if (!rfi || rfi.frame !== "material" || !rfi.materialKey) continue;
      const qty = Number(rfi.charges ?? 1);
      map[rfi.materialKey] = (map[rfi.materialKey] || 0) + qty;
    }
    return map;
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
      if (matIndex[rfi.materialKey]) continue;
      const matTier = rfi.tier ?? "I";
      const rarityMult = Number(foundry.utils.getProperty(item, "flags.fourththing.rfi.item.price.rarityMult"))
        || 1.0;
      matIndex[rfi.materialKey] = { tier: matTier, rarityMult };
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
  async recipesAvailable(actor, { includeMissing = false } = {}) {
    const inv = RfiCrafting.inventory(actor);
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
      const ok = missing.length === 0;
      if (ok || includeMissing) {
        out.push({ item, ok, missing, recipe, difficulty: RfiCrafting.difficulty(item) });
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
      const need = remaining[rfi.materialKey] || 0;
      if (need <= 0) continue;
      const have = Number(rfi.charges ?? 1);
      const take = Math.min(have, need);
      remaining[rfi.materialKey] -= take;
      const left = have - take;
      if (left <= 0) {
        await item.delete();
      } else {
        await item.setFlag("fourththing", "rfi.item.charges", left);
      }
      if (Object.values(remaining).every(v => v <= 0)) break;
    }
  },

  /**
   * Attempt to craft. Rolls 2d10 + (skill attribute). On success, drains
   * materials and creates a fresh copy of the recipe item on the actor with
   * origin="crafted" + originator=actor.uuid. On failure, drains half the
   * materials (rounded up) and produces nothing. Posts a chat receipt.
   */
  async tryCraft(actor, recipeItem) {
    const check = RfiCrafting.canCraft(actor, recipeItem);
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
