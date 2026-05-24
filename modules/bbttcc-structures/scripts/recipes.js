/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · recipes.js · Phase D
 * ─────────────────────────────────────────────────────────────────────────────
 * Four recipe modes per spec §9, all sharing the materialOf grammar:
 *
 *   • build(recipeId, factionActor, opts)
 *       Withdraws recipe.materialOf from the faction stockpile, spawns a new
 *       Rig actor with facilityMode + BOM stamped, optionally drops a token
 *       at the requested canvas position. Returns the new actor.
 *
 *   • harden(targetActor, materialOf, factionActor)
 *       Withdraws materialOf from faction stockpile, appends to the target's
 *       BOM (originalQty also bumped — added units are not "depleted"),
 *       re-derives plates max + adds the new material's plate contribution
 *       to plates.current.
 *
 *   • repair(targetActor, materialOf, factionActor)
 *       Withdraws materialOf from faction stockpile, restores qty on chipped
 *       BOM rows toward originalQty, adds the corresponding plate
 *       contribution back to plates.current (capped at plates.max).
 *
 *   • reclamation = Bulwark Ruin to Renewal (Phase C). The sheet's Reclamation
 *     button just calls the Phase C handler.
 *
 * All withdrawals go through game.bbttcc.api.factions.stockpile.adjust with
 * negative delta. Stockpile must have sufficient qty before the call — the
 * canBuild / canHarden / canRepair helpers check and return a missing[] list.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}/recipes]`;
const FLAG_SCOPE = MOD_ID;
const RECIPES_URL = `modules/${MOD_ID}/data/structure-recipes.json`;

let _RECIPES = null;
let _RECIPES_BY_ID = null;

async function _loadRecipes() {
  if (_RECIPES) return;
  try {
    const resp = await fetch(RECIPES_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    _RECIPES = data.recipes ?? [];
    _RECIPES_BY_ID = {};
    for (const r of _RECIPES) _RECIPES_BY_ID[r.id] = r;
  } catch (e) {
    console.error(TAG, "Failed to load structure-recipes.json", e);
    _RECIPES = [];
    _RECIPES_BY_ID = {};
  }
}

// ── Stockpile helpers ───────────────────────────────────────────────────────

function _stockApi() {
  return game.bbttcc?.api?.factions?.stockpile ?? null;
}

/**
 * Check faction stockpile for a materialOf cost. Returns { ok, missing }.
 *   missing = [{ key, name, need, have }] for any insufficient material.
 */
export function canAfford(faction, materialOf) {
  const api = _stockApi();
  if (!api) return { ok: false, missing: [], error: "Stockpile API not available" };
  if (!faction) return { ok: false, missing: [], error: "No faction supplied" };
  const missing = [];
  for (const cost of (materialOf ?? [])) {
    const have = api.qty?.(faction, cost.key) ?? 0;
    const need = Math.max(0, Math.floor(Number(cost.qty) || 0));
    if (have < need) {
      missing.push({ key: cost.key, name: cost.name ?? cost.key, need, have });
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Withdraw materialOf from faction stockpile. Caller must have already
 * verified canAfford. Returns { ok, withdrawn: [{key, qty}] }.
 */
async function withdraw(faction, materialOf) {
  const api = _stockApi();
  if (!api?.adjust) return { ok: false, error: "Stockpile API not available", withdrawn: [] };
  const withdrawn = [];
  for (const cost of (materialOf ?? [])) {
    const qty = Math.max(0, Math.floor(Number(cost.qty) || 0));
    if (qty <= 0) continue;
    const res = await api.adjust(faction, cost.key, -qty);
    if (res?.ok === false) {
      console.warn(TAG, "withdraw step failed", res);
      return { ok: false, error: res.error ?? "withdraw failed", withdrawn };
    }
    withdrawn.push({ key: cost.key, qty });
  }
  return { ok: true, withdrawn };
}

// ── Recipe listing + lookup ─────────────────────────────────────────────────

export function listRecipes() {
  return [...(_RECIPES ?? [])];
}

export function recipeById(id) {
  return _RECIPES_BY_ID?.[id] ?? null;
}

// ── Build ───────────────────────────────────────────────────────────────────

/**
 * Build a Structure: spawn a new Rig actor with hasStructure + facilityMode +
 * BOM stamped from the recipe. Withdraws cost from faction stockpile.
 *
 * @param {string} recipeId
 * @param {Actor}  factionActor
 * @param {Object} opts
 *   - actorName        override name (else uses recipe.name)
 *   - dropPosition     { x, y, sceneId? } where to place token; if absent,
 *                      no token is created and the actor sits in the directory
 *   - skipCostCheck    GM bypass for paper-testing
 */
export async function build(recipeId, factionActor, opts = {}) {
  await _loadRecipes();
  const recipe = recipeById(recipeId);
  if (!recipe) return { ok: false, error: `Unknown recipe: ${recipeId}` };

  const cost = recipe.materialOf ?? [];
  if (!opts.skipCostCheck) {
    const aff = canAfford(factionActor, cost);
    if (!aff.ok) return { ok: false, error: "Insufficient materials", missing: aff.missing };
  }

  const api = game.bbttcc?.api?.structures;
  if (!api?.stampBOM) return { ok: false, error: "Structures API not loaded" };

  // Withdraw materials
  if (!opts.skipCostCheck) {
    const w = await withdraw(factionActor, cost);
    if (!w.ok) return { ok: false, error: w.error ?? "Withdrawal failed" };
  }

  // Create the Rig actor
  const actorName = opts.actorName ?? recipe.name;
  const actorData = {
    name: actorName,
    type: "rig",
    img: recipe.tokenImg ?? "icons/svg/castle.svg",
    system: {
      identity: {
        archetype: `Structure: ${recipe.name}`,
        mobility: "stationary",
        state: "parked",
        factionOwnerId: factionActor?.id ?? ""
      }
    }
  };
  const newActor = await Actor.create(actorData);
  if (!newActor) return { ok: false, error: "Actor.create returned null" };

  // Stamp the BOM (Phase A API)
  const stampOpts = {
    facilityMode: !!recipe.facilityMode,
    collapseProfile: recipe.collapseProfileOverride
      ? { fallFt: 10, damageDice: "2d10", nonlethal: true, knockbackFt: 5, triggerState: "breached", ...recipe.collapseProfileOverride }
      : undefined
  };
  await api.stampBOM(newActor, cost.map(c => ({ materialKey: c.key, qty: c.qty })), stampOpts);

  // Optionally drop a token on canvas
  let token = null;
  if (opts.dropPosition && canvas?.scene) {
    const grid = canvas.scene.grid;
    const w = (recipe.footprintGrid?.w ?? 1) * grid.size;
    const h = (recipe.footprintGrid?.h ?? 1) * grid.size;
    const tokenData = await newActor.getTokenDocument({
      x: opts.dropPosition.x - w / 2,
      y: opts.dropPosition.y - h / 2,
      width: recipe.footprintGrid?.w ?? 1,
      height: recipe.footprintGrid?.h ?? 1,
      texture: { src: recipe.tokenImg ?? newActor.img },
      displayName: 30,
      disposition: 0,
      actorLink: true
    });
    [token] = await canvas.scene.createEmbeddedDocuments("Token", [tokenData.toObject()]);
  }

  // Chat card
  await postBuildCard(newActor, recipe, factionActor);

  return { ok: true, actor: newActor, token, recipe };
}

// ── Harden ──────────────────────────────────────────────────────────────────

/**
 * Append materials to an existing Structure's BOM. Increases plates max + adds
 * plate value to plates.current. Withdraws cost from faction stockpile.
 *
 * @param {Actor} targetActor   the Structure
 * @param {Array} additions     [{ key, qty }]
 * @param {Actor} factionActor  payer
 */
export async function harden(targetActor, additions, factionActor) {
  if (!targetActor) return { ok: false, error: "No target" };
  if (!Array.isArray(additions) || !additions.length) return { ok: false, error: "No additions" };

  const cost = additions.map(a => ({ key: a.key, qty: Math.max(0, Math.floor(Number(a.qty) || 0)) }))
                        .filter(a => a.qty > 0);
  if (!cost.length) return { ok: false, error: "All additions have zero qty" };

  const aff = canAfford(factionActor, cost);
  if (!aff.ok) return { ok: false, error: "Insufficient materials", missing: aff.missing };

  const api = game.bbttcc?.api?.structures;
  if (!api) return { ok: false, error: "Structures API not loaded" };

  const w = await withdraw(factionActor, cost);
  if (!w.ok) return { ok: false, error: w.error };

  // Read current BOM, merge additions (by materialKey; bump qty + originalQty)
  const currentBom = targetActor.getFlag(FLAG_SCOPE, "materialBOM") ?? [];
  const merged = currentBom.map(r => ({ ...r }));
  for (const add of cost) {
    const existing = merged.find(r => r.materialKey === add.key);
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + add.qty;
      existing.originalQty = (Number(existing.originalQty) || 0) + add.qty;
    } else {
      // New material — normalize via API so family/tier get filled
      merged.push({ materialKey: add.key, qty: add.qty, originalQty: add.qty });
    }
  }
  const normalized = await api.normalizeBOM(merged);
  // Restore originalQty values from merged (normalizeBOM may reset for new entries)
  for (const r of normalized) {
    const found = merged.find(m => m.materialKey === r.materialKey);
    if (found && Number(found.originalQty) > 0) r.originalQty = found.originalQty;
  }

  // Derive new plates max
  const derived = api.deriveBOM(normalized);

  // Compute plate contribution from ADDITIONS only (so current goes up by that)
  const FAMILIES = api.FAMILIES;
  let addedPlateValue = 0;
  for (const add of cost) {
    const row = normalized.find(r => r.materialKey === add.key);
    if (!row) continue;
    const fam = FAMILIES[row.family];
    addedPlateValue += (add.qty) * (fam?.plateCoef ?? 0);
  }

  const oldPlates = targetActor.getFlag(FLAG_SCOPE, "plates") ?? { current: 0, max: 0 };
  const newCurrent = Math.min(derived.platesMax, (Number(oldPlates.current) || 0) + addedPlateValue);

  // Write
  await targetActor.update({
    [`flags.${FLAG_SCOPE}.materialBOM`]:    normalized,
    [`flags.${FLAG_SCOPE}.plates.current`]: newCurrent,
    [`flags.${FLAG_SCOPE}.plates.max`]:     derived.platesMax,
    [`flags.${FLAG_SCOPE}.threshold`]:      derived.threshold,
    [`flags.${FLAG_SCOPE}.resists`]:        derived.resists,
    [`flags.${FLAG_SCOPE}.vulnerabilities`]: derived.vulnerabilities,
    [`flags.${FLAG_SCOPE}.loadBearing`]:    derived.loadBearing,
    [`flags.${FLAG_SCOPE}.state`]:          api.stateFromPlates(newCurrent, derived.platesMax, derived.loadBearing)
  });

  await postHardenCard(targetActor, factionActor, w.withdrawn, addedPlateValue, derived.platesMax);

  return { ok: true, addedPlateValue, newPlatesMax: derived.platesMax };
}

// ── Repair ──────────────────────────────────────────────────────────────────

/**
 * Refill chipped BOM rows by withdrawing matching materials from stockpile.
 * Phase D simple model: SAME-MATERIAL only (cross-family substitution at
 * 1.5× cost penalty is a Phase D+ enhancement).
 *
 * Restores qty toward originalQty per row. Adds back the corresponding plate
 * contribution (qty × familyCoef) to plates.current, capped at plates.max.
 *
 * @param {Actor} targetActor
 * @param {Actor} factionActor
 * @param {Object} opts
 *   - maxSpend       cap total units spent (undefined = repair to full)
 *   - selective      { [materialKey]: qty }  repair specific amounts
 */
export async function repair(targetActor, factionActor, opts = {}) {
  if (!targetActor) return { ok: false, error: "No target" };

  const api = game.bbttcc?.api?.structures;
  if (!api) return { ok: false, error: "Structures API not loaded" };
  const stockApi = _stockApi();
  if (!stockApi) return { ok: false, error: "Stockpile API not available" };

  const bom = targetActor.getFlag(FLAG_SCOPE, "materialBOM") ?? [];
  if (!bom.length) return { ok: false, error: "No BOM on target" };

  // Determine what to repair
  const refillCost = [];
  const refillPlan = []; // [{ key, qty, rowIndex }]
  for (let i = 0; i < bom.length; i++) {
    const row = bom[i];
    const qty = Number(row.qty) || 0;
    const orig = Math.max(qty, Number(row.originalQty) || 0);
    let need = orig - qty;
    if (need <= 0) continue;

    if (opts.selective) {
      const want = Number(opts.selective[row.materialKey]) || 0;
      need = Math.min(need, Math.max(0, want));
    }
    if (need <= 0) continue;

    const have = stockApi.qty?.(factionActor, row.materialKey) ?? 0;
    const take = Math.min(need, have);
    if (take <= 0) continue;
    refillCost.push({ key: row.materialKey, qty: take });
    refillPlan.push({ key: row.materialKey, qty: take, rowIndex: i });
  }

  if (!refillCost.length) {
    return { ok: false, error: "Nothing to repair (either fully topped up, or stockpile is empty for chipped materials)" };
  }

  // Withdraw
  const w = await withdraw(factionActor, refillCost);
  if (!w.ok) return { ok: false, error: w.error };

  // Apply: bump qty on each row, accumulate plate value
  const FAMILIES = api.FAMILIES;
  const newBom = bom.map(r => ({ ...r }));
  let addedPlateValue = 0;
  for (const plan of refillPlan) {
    const row = newBom[plan.rowIndex];
    row.qty = (Number(row.qty) || 0) + plan.qty;
    const fam = FAMILIES[row.family];
    addedPlateValue += plan.qty * (fam?.plateCoef ?? 0);
  }

  // Re-derive (loadBearing may flip back on if sephirotic refilled, resists may change)
  const derived = api.deriveBOM(newBom);
  const oldPlates = targetActor.getFlag(FLAG_SCOPE, "plates") ?? { current: 0, max: derived.platesMax };
  const newCurrent = Math.min(derived.platesMax, (Number(oldPlates.current) || 0) + addedPlateValue);

  await targetActor.update({
    [`flags.${FLAG_SCOPE}.materialBOM`]:    newBom,
    [`flags.${FLAG_SCOPE}.plates.current`]: newCurrent,
    [`flags.${FLAG_SCOPE}.plates.max`]:     derived.platesMax,
    [`flags.${FLAG_SCOPE}.threshold`]:      derived.threshold,
    [`flags.${FLAG_SCOPE}.resists`]:        derived.resists,
    [`flags.${FLAG_SCOPE}.vulnerabilities`]: derived.vulnerabilities,
    [`flags.${FLAG_SCOPE}.loadBearing`]:    derived.loadBearing,
    [`flags.${FLAG_SCOPE}.state`]:          api.stateFromPlates(newCurrent, derived.platesMax, derived.loadBearing)
  });

  await postRepairCard(targetActor, factionActor, refillPlan, addedPlateValue, newCurrent, derived.platesMax);

  return { ok: true, refilledRows: refillPlan, addedPlateValue, newPlatesCurrent: newCurrent };
}

// ── Chat cards ──────────────────────────────────────────────────────────────

const _esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

async function postBuildCard(actor, recipe, faction) {
  const rows = (recipe.materialOf ?? []).map(c =>
    `<li>${_esc(c.name ?? c.key)} <b>×${c.qty}</b></li>`
  ).join("");
  const raiser = faction?.name ? `<b>${_esc(faction.name)}</b> raises` : "Raised:";
  await ChatMessage.create({
    speaker: faction ? ChatMessage.getSpeaker({ actor: faction }) : ChatMessage.getSpeaker(),
    content: `<div style="border:2px solid #d9c47a; padding:0.5rem 0.7rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
      <div style="font-size:0.82rem; color:#d9c47a; letter-spacing:0.1em;">⧉ STRUCTURE BUILT — ${_esc(recipe.name)}</div>
      <div style="font-size:0.74rem; margin-top:3px;">
        ${raiser} <b>${_esc(actor.name)}</b>.
      </div>
      <ul style="margin:4px 0 0 18px; padding:0; font-size:0.72rem;">${rows}</ul>
      ${recipe.specialNote ? `<div style="margin-top:5px; font-size:0.7rem; font-style:italic; opacity:0.7">${_esc(recipe.specialNote)}</div>` : ""}
    </div>`
  });
}

async function postHardenCard(actor, faction, withdrawn, addedPlateValue, newMax) {
  const rows = withdrawn.map(w => `<li>${_esc(w.key)} <b>×${w.qty}</b></li>`).join("");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div style="border:1px solid #c08060; padding:0.5rem 0.7rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
      <div style="font-size:0.76rem; color:#e8c8a0; letter-spacing:0.08em;">⧆ HARDENED — ${_esc(actor.name)}</div>
      <div style="font-size:0.72rem; margin-top:3px;">
        +<b>${addedPlateValue}</b> Plates contributed · new max <b>${newMax}</b> · materials drawn from <b>${_esc(faction?.name ?? "—")}</b>:
      </div>
      <ul style="margin:4px 0 0 18px; padding:0; font-size:0.72rem;">${rows}</ul>
    </div>`
  });
}

async function postRepairCard(actor, faction, plan, addedPlateValue, newCurrent, max) {
  const rows = plan.map(p => `<li>${_esc(p.key)} <b>+${p.qty}</b></li>`).join("");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div style="border:1px solid #80a060; padding:0.5rem 0.7rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
      <div style="font-size:0.76rem; color:#a0d090; letter-spacing:0.08em;">⊕ REPAIRED — ${_esc(actor.name)}</div>
      <div style="font-size:0.72rem; margin-top:3px;">
        +<b>${addedPlateValue}</b> Plates · now <b>${newCurrent}/${max}</b> · drawn from <b>${_esc(faction?.name ?? "—")}</b>:
      </div>
      <ul style="margin:4px 0 0 18px; padding:0; font-size:0.72rem;">${rows}</ul>
    </div>`
  });
}

// ── Install + API expose ───────────────────────────────────────────────────

Hooks.once("ready", async () => {
  await _loadRecipes();
  if (game.bbttcc?.api?.structures) {
    game.bbttcc.api.structures.recipes = {
      list: listRecipes,
      byId: recipeById,
      canAfford,
      build,
      harden,
      repair,
      reload: async () => { _RECIPES = null; await _loadRecipes(); return listRecipes(); }
    };
  }
  console.log(TAG, `loaded ${_RECIPES?.length ?? 0} structure recipes`);
});
