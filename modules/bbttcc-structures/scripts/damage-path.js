/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · damage-path.js · Phase B
 * ─────────────────────────────────────────────────────────────────────────────
 * Damage application for actors with hasStructure: true.
 *
 *   • computeStructureDamage(state, damage, sourceTags)
 *       Pure function. Returns the result of applying `damage` to the given
 *       Structure state, including chip queue walk + rubble jitter + state
 *       transition. Does not mutate. Phase B.1.
 *
 *   • applyStructureDamage(actor, damage, opts)
 *       Mutating. Calls compute, writes BOM/plates back to actor flags, posts
 *       chat cards, fires hooks, returns a description. If integrity overflow,
 *       caller can route the overflow into the actor's integrity track via
 *       the original _applyDamageToActor (handled in damage-wedge.js). Phase B.2.
 *
 *   • transitionState(actor, fromState, toState, ctx)
 *       Writes the state, appends a history row, posts the transition chat
 *       card, emits bbttcc:structure:stateChanged. Phase B.4.
 *
 * Collapse trigger lives in collapse.js (Phase B.5).
 * Wedge into _applyDamageToActor lives in damage-wedge.js (Phase B.3).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}/damage]`;
const FLAG_SCOPE = MOD_ID;

// ── Resist resolution ───────────────────────────────────────────────────────

/**
 * Apply structure resists/vulns to incoming damage. Returns the modified
 * damage and a list of tags that fired (for chat card).
 *
 * Structure resists are family-derived. Standard resist tags:
 *   - kinetic, piercing       (Metal, Stone)
 *   - hex-resistant, blessed  (Ward, derived from material tags)
 *   - qliphothic-resistant    (Sephirotic, Ward with qliph tag)
 *   - curse-resistant         (Sephirotic, Ward with curse tag)
 *   - foundation              (Sephirotic — fictional; no direct dmg effect)
 *   - concussive-partial      (Wood — 25% reduction vs concussive)
 *
 * Vulnerabilities are family-declared in structural-families.json.
 *
 * For Phase B we apply: resists halve damage, vulnerabilities double, immunes
 * zero. Multiple matches stack multiplicatively (×0.5 × 0.5 = ×0.25). Tags
 * are normalized lowercase; partial-match strings allowed (e.g. "hex" matches
 * "hex-resistant").
 */
function applyStructureResists(damage, resists = [], sourceTags = []) {
  const tagsLower = sourceTags.map(t => String(t).toLowerCase()).filter(Boolean);
  const resistSet = new Set(resists.map(r => String(r).toLowerCase()));

  let mult = 1;
  const firedTags = [];

  // Hard table of vulnerability tags by family (also surfaces via tag if the
  // source declared it). Keeping this simple in Phase B: any sourceTag that
  // matches a structure vulnerability doubles damage.
  // Phase B: hardcoded heuristic; Phase C+ will load from structural-families.json
  // via the API surface.
  const VULN_MAP = {
    "fire": ["wood", "cloth"],
    "heat": ["metal"],
    "holy": ["metal"],
    "concussive": ["stone"]
  };

  for (const tag of tagsLower) {
    // Resists
    for (const r of resistSet) {
      // Match if source tag IS the resist token OR a prefix/contains match
      if (r === tag || r.includes(tag) || tag.includes(r.replace("-resistant", "").replace("-partial", ""))) {
        // partial = 0.75; full = 0.5
        const factor = r.endsWith("-partial") ? 0.75 : 0.5;
        mult *= factor;
        firedTags.push(`${r}×${factor}`);
        break; // one resist match per source tag
      }
    }
    // Vulnerabilities — if source tag is a known vuln type AND structure has
    // a family that's vulnerable. We approximate via the VULN_MAP. Phase C+
    // can read from the live family table.
    if (VULN_MAP[tag]) {
      // Vulnerability: if structure's primary family matches, double.
      // For Phase B we double if any of the listed families is "implied"
      // by an existing resist (e.g. wood structure has "concussive-partial"
      // resist → it's wood → fire doubles).
      // Pragmatic: just check if no resist fires for this source tag AND
      // the family is plausibly present. Defer real implementation to
      // when the structure passes its family breakdown to this function.
    }
  }

  return {
    effDmg: Math.max(0, Math.floor(damage * mult)),
    mult,
    firedTags
  };
}

// ── Chip queue walker ───────────────────────────────────────────────────────

/**
 * Produce a chip queue from a BOM in canonical order:
 *   fragile family first (cloth → wood → salvage → memetic → ward → metal →
 *   stone → sephirotic), tier ascending within family, alphabetical tiebreak.
 *
 * Returns: [{ index, materialKey, family, tier, qty, chipOrder }]
 *   index = position in the original BOM array (for in-place qty update)
 */
function buildChipQueue(bom, FAMILIES) {
  const tierN = (t) => ({ I: 1, II: 2, III: 3, IV: 4 }[String(t || "I").toUpperCase()] ?? 1);
  const rows = [];
  for (let i = 0; i < bom.length; i++) {
    const r = bom[i];
    if (!(Number(r.qty) > 0)) continue;
    const fam = FAMILIES[r.family];
    if (!fam) continue;
    rows.push({
      index: i,
      materialKey: r.materialKey,
      family: r.family,
      tier: r.tier,
      qty: Number(r.qty),
      chipOrder: fam.chipOrder ?? 99,
      tierNum: tierN(r.tier),
      name: r.name ?? r.materialKey
    });
  }
  rows.sort((a, b) => {
    if (a.chipOrder !== b.chipOrder) return a.chipOrder - b.chipOrder;
    if (a.tierNum !== b.tierNum) return a.tierNum - b.tierNum;
    return a.materialKey.localeCompare(b.materialKey);
  });
  return rows;
}

/**
 * Chip `targetChips` material units from the queue, walking front-to-back.
 * Decrements qty on the queue entries (in place, copy) AND emits a record
 * of what got chipped per materialKey for the chat card. Stops if queue
 * exhausted before targetChips reached.
 *
 * Returns: {
 *   chipped: [{ index, materialKey, family, tier, units }],
 *   queueAfter: queue with updated qty,
 *   actualChips: number of units actually chipped (may be < target if queue exhausted)
 * }
 */
function walkChipQueue(queue, targetChips) {
  const chipped = [];
  let remaining = Math.max(0, Math.floor(targetChips));
  let actual = 0;
  const queueAfter = queue.map(q => ({ ...q }));
  for (const row of queueAfter) {
    if (remaining <= 0) break;
    const take = Math.min(row.qty, remaining);
    if (take > 0) {
      row.qty -= take;
      remaining -= take;
      actual += take;
      chipped.push({
        index: row.index,
        materialKey: row.materialKey,
        family: row.family,
        tier: row.tier,
        name: row.name,
        units: take
      });
    }
  }
  return { chipped, queueAfter, actualChips: actual };
}

// ── Pure damage computation ──────────────────────────────────────────────────

/**
 * Compute the result of applying `damage` to a Structure state. Pure.
 *
 * @param {Object} state            actor's bbttcc-structures flag payload
 *                                  (materialBOM, plates, threshold, resists, loadBearing)
 * @param {number} damage           incoming damage (post per-target mult)
 * @param {Object} opts
 *   - sourceTags: string[]         damage type/flavor tags from the source
 *   - jitterRoll: number           supply for deterministic testing; default rolls 1d4-1
 *   - FAMILIES: Object             family table from api.structures.FAMILIES
 *
 * @returns {Object} {
 *   mode: "chip-only" | "pierce" | "noop",
 *   effDmg,
 *   resistTagsFired: string[],
 *   platesLost,
 *   integrityOverflow,
 *   bomChippedRows: [{ materialKey, family, tier, units }],
 *   jitterRoll,
 *   newPlates: { current, max },
 *   newBOM: [...],
 *   newState: "intact"|"damaged"|"breached"|"razed"
 * }
 */
export function computeStructureDamage(state, damage, opts = {}) {
  const FAMILIES = opts.FAMILIES ?? game.bbttcc?.api?.structures?.FAMILIES ?? {};
  const sourceTags = opts.sourceTags ?? [];

  // 1. Apply structure resists/vulns
  const { effDmg, mult, firedTags } = applyStructureResists(damage, state.resists ?? [], sourceTags);

  // 2. Compare to threshold — chip-only or pierce
  const threshold = Number(state.threshold) || 0;
  const platesCurr = Math.max(0, Number(state.plates?.current) || 0);
  const platesMax  = Math.max(0, Number(state.plates?.max) || 0);
  const bom = JSON.parse(JSON.stringify(state.materialBOM ?? []));   // deep clone for safety
  const queue = buildChipQueue(bom, FAMILIES);

  // Roll rubble jitter
  const jitterRoll = (opts.jitterRoll != null)
    ? opts.jitterRoll
    : (Math.floor(Math.random() * 4));   // 0..3 (i.e. 1d4-1)

  let mode, platesLost = 0, integrityOverflow = 0, chipTarget = 0;

  if (effDmg <= 0) {
    mode = "noop";
  } else if (effDmg < threshold) {
    // CHIP-ONLY — 1 unit from queue front + jitter
    mode = "chip-only";
    chipTarget = 1 + jitterRoll;
  } else {
    // PIERCE — plates absorb (capped at current); overflow → integrity
    mode = "pierce";
    platesLost = Math.min(effDmg, platesCurr);
    integrityOverflow = effDmg - platesLost;
    // Family-aware chip count — walk queue, each family's chipN applies to
    // damage that's "currently chipping" within that family. Simpler model
    // for Phase B: use the AVERAGE chipN of families present, weighted by
    // qty contribution to plates. This produces a single chipTarget that
    // approximates "what fraction of plate damage chips a unit".
    let weightedChipN = 0;
    let weightTotal = 0;
    for (const r of queue) {
      const fam = FAMILIES[r.family];
      if (!fam) continue;
      const w = r.qty * (fam.plateCoef ?? 1);
      weightedChipN += w * (fam.chipN ?? 5);
      weightTotal += w;
    }
    const avgChipN = weightTotal > 0 ? (weightedChipN / weightTotal) : 5;
    chipTarget = Math.floor(platesLost / avgChipN) + jitterRoll;
  }

  // 3. Walk the chip queue
  const { chipped, queueAfter, actualChips } = walkChipQueue(queue, chipTarget);

  // 4. Apply qty changes back to the BOM array
  for (const row of queueAfter) {
    bom[row.index].qty = row.qty;
  }
  // Drop entries with qty 0
  const newBOM = bom.filter(r => Number(r.qty) > 0);

  // 5. Recompute loadBearing post-chip (sephirotic could have been chipped to 0)
  const newLoadBearing = newBOM.some(r => r.family === "sephirotic");

  // 6. New plates state
  const newPlatesCurr = Math.max(0, platesCurr - platesLost);
  const newPlatesMax  = platesMax; // max only changes on Forge actions, not damage

  // 7. New state
  const newState = computeStateFromPlates(newPlatesCurr, newPlatesMax, newLoadBearing);

  return {
    mode,
    rawDamage: damage,
    effDmg,
    resistMult: mult,
    resistTagsFired: firedTags,
    threshold,
    platesLost,
    integrityOverflow,
    bomChippedRows: chipped,
    actualChips,
    requestedChips: chipTarget,
    jitterRoll,
    newPlates: { current: newPlatesCurr, max: newPlatesMax },
    newBOM,
    newLoadBearing,
    newState,
    oldState: state.state ?? "intact"
  };
}

// State-from-plates duplicated here for purity (avoids API circular load).
function computeStateFromPlates(platesCurrent, platesMax, loadBearing) {
  const pct = platesMax > 0 ? (platesCurrent / platesMax) : 1;
  if (pct >= 0.75) return "intact";
  if (pct >= 0.50) return "damaged";
  if (pct >= 0.25) return "breached";
  if (loadBearing) return "breached";  // load-bearing lock — cannot reach razed
  return "razed";
}

// ── Mutating apply ───────────────────────────────────────────────────────────

/**
 * Apply damage to an actor's Structure. Mutates flags, posts chat card, fires
 * hooks. Returns:
 *   { description, integrityOverflow, stateChanged, newState, computeResult }
 *
 * Caller (the damage-wedge) is responsible for routing integrityOverflow
 * back into the actor's integrity track via the original _applyDamageToActor.
 */
export async function applyStructureDamage(actor, damage, opts = {}) {
  const api = game.bbttcc?.api?.structures;
  if (!api) {
    console.warn(TAG, "API not loaded — falling back to noop");
    return { description: null, integrityOverflow: damage, stateChanged: false };
  }

  const state = api.readState(actor);
  if (!state) {
    return { description: null, integrityOverflow: damage, stateChanged: false };
  }

  // Build sourceTags from damageType + damageFlavor (the fourththing convention)
  const sourceTags = [opts.damageType, opts.damageFlavor].filter(Boolean);

  const result = computeStructureDamage(state, damage, {
    sourceTags,
    FAMILIES: api.FAMILIES
  });

  if (result.mode === "noop") {
    return { description: `${actor.name}: no effect`, integrityOverflow: 0, stateChanged: false, computeResult: result };
  }

  // Persist
  await actor.update({
    [`flags.${FLAG_SCOPE}.materialBOM`]: result.newBOM,
    [`flags.${FLAG_SCOPE}.plates.current`]: result.newPlates.current,
    [`flags.${FLAG_SCOPE}.loadBearing`]: result.newLoadBearing,
    [`flags.${FLAG_SCOPE}.state`]: result.newState
  });

  // Post damage chat card
  await postDamageCard(actor, result);

  // Hook
  Hooks.callAll("bbttcc:structure:damageApplied", { actor, result });

  // State transition
  const stateChanged = result.newState !== result.oldState;
  if (stateChanged) {
    await transitionState(actor, result.oldState, result.newState, { result });
  }

  // Build description
  const platesNote = result.platesLost > 0
    ? `Plates ${state.plates.current} → ${result.newPlates.current} (−${result.platesLost})`
    : `chip-only`;
  const chipNote = result.bomChippedRows.length
    ? ` · chipped: ${result.bomChippedRows.map(r => `${r.name}×${r.units}`).join(", ")}`
    : "";
  const stateNote = stateChanged ? ` · ${result.oldState} → ${result.newState}` : "";
  const overflowNote = result.integrityOverflow > 0 ? ` · overflow ${result.integrityOverflow} → integrity` : "";
  const description = `${actor.name}: ${platesNote}${chipNote}${stateNote}${overflowNote}`;

  return {
    description,
    integrityOverflow: result.integrityOverflow,
    stateChanged,
    newState: result.newState,
    computeResult: result
  };
}

// ── State transitions ───────────────────────────────────────────────────────

const STATE_LABELS = {
  intact:   { glyph: "◇", label: "Intact",   color: "#7cc77c" },
  damaged:  { glyph: "◆", label: "Damaged",  color: "#e8c84a" },
  breached: { glyph: "◈", label: "Breached", color: "#e08a3a" },
  razed:    { glyph: "◾", label: "Razed",    color: "#888" }
};

const TRANSITION_FLAVOR = {
  "intact→damaged":   "Surface failures spread across the structure.",
  "intact→breached":  "Catastrophic — the structure breaches without warning.",
  "intact→razed":     "Catastrophic — the structure is gone in a single blow.",
  "damaged→breached": "The first walls give way.",
  "damaged→razed":    "From damaged to rubble in a single collapse.",
  "breached→razed":   "What remained falls.",
  "breached→damaged": "Partial restoration recovers the structure.",
  "damaged→intact":   "Repairs complete — structure restored.",
  "razed→breached":   "Foundation reclaimed — rebuilding underway."
};

export async function transitionState(actor, fromState, toState, ctx = {}) {
  if (!actor || fromState === toState) return;

  // Append history
  const hist = actor.getFlag(FLAG_SCOPE, "history") ?? [];
  hist.push({
    at: Date.now(),
    fromState,
    toState,
    dmg: ctx.result?.effDmg ?? 0,
    chipped: (ctx.result?.bomChippedRows ?? []).map(r => ({ k: r.materialKey, n: r.units }))
  });
  // Keep last 10
  const trimmed = hist.slice(-10);
  await actor.setFlag(FLAG_SCOPE, "history", trimmed);

  // Post chat card
  await postTransitionCard(actor, fromState, toState, ctx);

  // Emit hook
  Hooks.callAll("bbttcc:structure:stateChanged", { actor, fromState, toState, ctx });

  // Collapse trigger fires from the wedge / api caller, not here, so the
  // Phase B.5 module can detect token-on-top after state is committed.
}

// ── Chat cards ───────────────────────────────────────────────────────────────

const _esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

async function postDamageCard(actor, result) {
  const api = game.bbttcc?.api?.structures;
  const FAM = api?.FAMILIES ?? {};

  const stateLabel = STATE_LABELS[result.newState] ?? STATE_LABELS.intact;
  const platesPct = result.newPlates.max > 0 ? (result.newPlates.current / result.newPlates.max) * 100 : 0;
  const filled = Math.round(platesPct / 10);
  const platesBar = "▰".repeat(filled) + "▱".repeat(10 - filled);

  const modeTag = {
    "chip-only": `<span style="background:rgba(120,100,60,0.18); border:1px solid rgba(217,185,107,0.2); padding:1px 5px; border-radius:2px; font-size:0.7rem;">chip-only</span>`,
    "pierce":    `<span style="background:rgba(192,80,60,0.18); border:1px solid rgba(217,128,107,0.3); padding:1px 5px; border-radius:2px; font-size:0.7rem; color:#e08a3a">pierce</span>`,
    "noop":      `<span style="opacity:0.5">no effect</span>`
  }[result.mode] ?? "";

  const resistTagsHtml = result.resistTagsFired.length
    ? result.resistTagsFired.map(t => `<span style="background:rgba(80,140,80,0.18); padding:1px 4px; border-radius:2px; font-size:0.65rem; color:#9cd49c; margin-right:3px;">${_esc(t)}</span>`).join("")
    : "";

  const chippedHtml = result.bomChippedRows.length
    ? result.bomChippedRows.map(r => {
        const fam = FAM[r.family] ?? {};
        return `<span style="color:${fam.color ?? '#ccc'}; margin-right:6px; font-size:0.74rem">${fam.icon ?? '•'} ${_esc(r.name)} <b>×${r.units}</b></span>`;
      }).join("")
    : `<span style="opacity:0.5; font-style:italic">no chips</span>`;

  const jitterNote = result.jitterRoll > 0
    ? `<span style="opacity:0.6; font-size:0.66rem"> (+${result.jitterRoll} rubble jitter)</span>`
    : "";

  const overflowNote = result.integrityOverflow > 0
    ? `<div style="margin-top:4px; padding-top:4px; border-top:1px dotted #3a3528; font-size:0.74rem; color:#e08a3a">↳ <b>+${result.integrityOverflow}</b> damage overflowed to Integrity</div>`
    : "";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div style="border:1px solid #4a4538; padding:0.5rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
        <div style="font-size:0.8rem; color:#d9c47a; letter-spacing:0.08em; border-bottom:1px solid #3a3528; padding-bottom:3px; margin-bottom:5px;">
          STRUCTURE DAMAGE · ${_esc(actor.name)}
        </div>
        <div style="font-size:0.74rem; margin-bottom:4px;">
          <b>${result.rawDamage}</b> incoming
          ${result.resistMult !== 1 ? ` → <b>${result.effDmg}</b> after resists ${resistTagsHtml}` : ""}
          · vs Threshold <b>${result.threshold.toFixed?.(2) ?? result.threshold}</b>
          · ${modeTag}
        </div>
        <div style="font-size:0.74rem; margin-bottom:3px;">
          <b>Plates:</b> <span style="font-family:monospace; color:#b09a4a">${platesBar}</span>
          ${result.newPlates.current}/${result.newPlates.max}
          <span style="margin-left:8px; color:${stateLabel.color}">${stateLabel.glyph} ${stateLabel.label}</span>
        </div>
        <div style="font-size:0.74rem;">
          <b>Chipped:</b> ${chippedHtml}${jitterNote}
        </div>
        ${overflowNote}
      </div>
    `
  });
}

async function postTransitionCard(actor, fromState, toState, ctx) {
  const fromL = STATE_LABELS[fromState] ?? STATE_LABELS.intact;
  const toL   = STATE_LABELS[toState]   ?? STATE_LABELS.intact;
  const flavor = TRANSITION_FLAVOR[`${fromState}→${toState}`] ?? "";

  // Visual emphasis for downward transitions (intact→damaged, etc.); recovery
  // transitions get a milder card.
  const isDecline = ["intact","damaged","breached"].indexOf(toState) > ["intact","damaged","breached"].indexOf(fromState);
  const headerColor = isDecline ? toL.color : "#7cc77c";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div style="border:2px solid ${headerColor}; padding:0.5rem 0.7rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
        <div style="font-size:0.8rem; color:${headerColor}; letter-spacing:0.08em; margin-bottom:3px;">
          STRUCTURE STATE — ${_esc(actor.name)}
        </div>
        <div style="font-size:0.95rem; margin:6px 0; text-align:center;">
          <span style="color:${fromL.color}; opacity:0.6">${fromL.glyph} ${fromL.label}</span>
          <span style="margin:0 10px; opacity:0.4">→</span>
          <span style="color:${toL.color}; font-weight:600">${toL.glyph} ${toL.label}</span>
        </div>
        ${flavor ? `<div style="font-style:italic; font-size:0.74rem; opacity:0.7; text-align:center;">${_esc(flavor)}</div>` : ""}
      </div>
    `
  });
}
