// modules/bbttcc-auto-link/scripts/character-sheet.js
// Bad Eden Character & NPC Sheet registration + render enhancements.
//
// Hex Chrome Bad Eden Identity tab with inline editing.
// - Registers custom sheets that extend the default 5E character and NPC sheets.
// - Adds Hex Chrome root class on render.
// - Injects a Bad Eden tab that can read & write core Bad Eden identity fields.
// - Sparks/Tikkun is read-only here and sourced from the Tikkun API.
// - Enlightenment picker drives a single Enlightenment item + OP recalcs.
// - Tiered Options Identity:
//   • Reads bbttcc-character-options.identity via game.bbttcc.api.identity.getIdentityFlags
//   • AUTO-BACKFILLS identity flags for legacy actors based on current items
//   • Derives display labels for Archetype/Crew/Occult/Political/Sephirot/Enlightenment
//   • GM editing controls: identity dropdowns update items + flags immediately on change
//   • Exposes game.bbttcc.api.autoLink.inspectIdentity(actorId) for debugging.

const MOD  = "bbttcc-auto-link";
const AAE_SCOPE = "bbttcc-aae";
const LOG  = (...a) => console.log(`[${MOD}]`, ...a);
const WARN = (...a) => console.warn(`[${MOD}]`, ...a);

/* Bad Eden TAB HEALER (multi-sheet) */
/* Bad Eden TAB HEALER (multi-sheet)
 * When other sheets (notably faction sheets) open, Foundry's tab controllers can rebuild DOM and
 * leave the Bad Eden tab body empty on already-open character sheets. This healer keeps a registry
 * of processed character sheet roots and re-ensures their Bad Eden tab after ANY actor sheet render.
 *
 * Design goals:
 * - No render loops (no app.render calls)
 * - Debounced refresh (single pass per tick)
 */
const __BBTTCC_TAB_HEAL = globalThis.__BBTTCC_TAB_HEAL || (globalThis.__BBTTCC_TAB_HEAL = {
  sheets: {},   // appId -> { app, root }
  timer: null
});

function _bbttccRegisterSheet(app, root) {
  try {
    if (!app || !root) return;
    const id = String(app.appId ?? app._appId ?? app.id ?? Math.random());
    __BBTTCC_TAB_HEAL.sheets[id] = { app, root };
  } catch {/* ignore */}
}

function _bbttccScheduleHeal() {
  try {
    if (__BBTTCC_TAB_HEAL.timer) return;
    __BBTTCC_TAB_HEAL.timer = setTimeout(async () => {
      __BBTTCC_TAB_HEAL.timer = null;
      try {
        const entries = Object.values(__BBTTCC_TAB_HEAL.sheets || {});
        for (const ent of entries) {
          try {
            const app = ent?.app;
            const root = ent?.root;
            if (!app || !root) continue;
            if (!root.isConnected) continue;

            const actor = app.actor ?? app.object;
            if (!actor) continue;
            if (!(actor.type === "character" || actor.type === "npc")) continue;
            if (actor.getFlag?.("bbttcc-factions", "isFaction")) continue;

            await ensureBBTTCCTab(app, root);
          } catch {/* ignore */}
        }
      } catch (e) {
        WARN("Bad Eden tab healer failed", e);
      }
    }, 0);
  } catch {/* ignore */}
}


/* ---------------------------------------
 * Blood Debt (Identity tab) — manual GM authoring + ledger
 * Canonical storage:
 *   flags.bbttcc.identity.bloodDebt = { value:Number, ledger:Array }
 * Legacy mirror (optional):
 *   flags.bbttcc.bloodDebt = Number
 * ------------------------------------ */

function getBloodDebtModel(actor) {
  try {
    const f = actor?.flags ?? {};
    const v1 = f?.bbttcc?.identity?.bloodDebt;
    if (v1 && typeof v1 === "object") {
      return {
        value: Number(v1.value ?? 0) || 0,
        ledger: Array.isArray(v1.ledger) ? v1.ledger : []
      };
    }

    // Legacy fallbacks (keep tolerant; worlds drift)
    const legacy =
      Number(f?.bbttcc?.bloodDebt ?? f?.["bbttcc-core"]?.bloodDebt ?? f?.bbttcc?.blood_debt ?? 0) || 0;

    return { value: legacy, ledger: [] };
  } catch {
    return { value: 0, ledger: [] };
  }
}

function labelForBloodDebtSource(key) {
  const k = String(key || "other");
  if (k === "death") return "Death";
  if (k === "transference") return "Transference";
  if (k === "pact") return "Pact";
  if (k === "great_work") return "Great Work";
  if (k === "atonement") return "Atonement";
  return "Other";
}

function formatBloodDebtLedgerEntry(e) {
  const ts = Number(e?.ts) || 0;
  const delta = Number(e?.delta) || 0;
  const when = ts ? new Date(ts).toLocaleString() : "—";
  return {
    ts,
    delta,
    deltaLabel: (delta > 0 ? `+${delta}` : `${delta}`),
    source: String(e?.source || "other"),
    sourceLabel: labelForBloodDebtSource(e?.source),
    note: String(e?.note || "").trim(),
    gmId: e?.gmId || null,
    gmName: String(e?.gmName || "GM"),
    when
  };
}

async function applyBloodDebtDelta(actor, { delta, source = "other", note = "" } = {}) {
  delta = Number(delta || 0);
  if (!delta) return null;

  const model = getBloodDebtModel(actor);
  const cur = Number(model.value || 0) || 0;
  const next = Math.max(0, cur + delta);

  const gm = game.user;
  const entry = {
    ts: Date.now(),
    delta,
    source: String(source || "other"),
    note: String(note || "").trim(),
    gmId: gm?.id || null,
    gmName: gm?.name || "GM"
  };

  const ledger = [entry].concat(model.ledger || []).slice(0, 20);

  // Canonical write + legacy mirror for compatibility (safe to remove later)
  await actor.update({
    "flags.bbttcc.identity.bloodDebt": { value: next, ledger },
    "flags.bbttcc.bloodDebt": next
  });

  return { value: next, entry };
}

function isPlain(o) {
  return o && typeof o === "object" && !Array.isArray(o);
}

// Esoteric Magic (Cosmic Linguist) integration
const ESOTERIC_MAGIC_SCOPE = "esoteric-magic";
const ESOTERIC_FEAT_IDS = new Set([
  "redactor_semantic_redaction",
  "redactor_persistent_deletion",
  "redactor_name_stripping",
  "redactor_redline_the_draft",
  "redactor_total_redaction",
  "syntax_wardens_counter",
  "syntax_constraint_grammar",
  "syntax_no_exception_ward",
  "syntax_parse_error",
  "syntax_seal_the_sentence",
  "syntax_absolute_syntax"
]);

function isCosmicLinguist(actor) {
  try {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    return items.some(it => String(it?.type) === "class" && String(it?.system?.identifier || "") === "cosmic_linguist");
  } catch {
    return false;
  }
}


function isTitanbound(actor) {
  try {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    return items.some(it => String(it?.type) === "class" && String(it?.system?.identifier || "") === "titanbound");
  } catch {
    return false;
  }
}

function getTitanboundDie(level) {
  const lvl = Math.max(1, Number(level) || 1);
  if (lvl >= 17) return "d12";
  if (lvl >= 11) return "d10";
  if (lvl >= 5) return "d8";
  return "d6";
}

function getTitanboundState(actor) {
  const enabled = isTitanbound(actor);
  if (!enabled) return { enabled: false, dice: 0, maxDice: 0, die: "d6", stress: 0 };

  const level = _bbttccGetClassLevel(actor, "titanbound");
  const maxDice = Math.max(1, Number(_bbttccGet(actor, "system.abilities.con.mod", 0)) || 0);
  const dice = Math.max(0, Number(actor?.getFlag?.(MOD, "titanbound.frameDice") ?? 0) || 0);
  const stress = Math.max(0, Number(actor?.getFlag?.(MOD, "titanbound.stress") ?? 0) || 0);

  return {
    enabled: true,
    dice: Math.min(dice, maxDice),
    maxDice,
    die: getTitanboundDie(level),
    stress
  };
}

function getEsotericApi() {
  return game.modules?.get(ESOTERIC_MAGIC_SCOPE)?.api || null;
}

function getEsotericState(actor) {
  const api = getEsotericApi();
  if (api?.getResonanceState) {
    try {
      return api.getResonanceState(actor);
    } catch (e) {
      WARN("Esoteric getResonanceState failed", e);
    }
  }
  const raw = actor?.flags?.[ESOTERIC_MAGIC_SCOPE]?.resonance || {};
  return {
    dice: Number(raw.dice) || 0,
    maxDice: Number(raw.maxDice) || 0,
    die: String(raw.die || "d6"),
    strain: Number(raw.strain) || 0,
    bySephirah: raw.bySephirah || {},
    lastGain: raw.lastGain || { combatRound: null, ts: 0 }
  };
}

async function setEsotericState(actor, patch) {
  const current = getEsotericState(actor);
  const next = foundry.utils.mergeObject(foundry.utils.deepClone(current), patch || {}, { inplace: false, overwrite: true });
  await actor.setFlag(ESOTERIC_MAGIC_SCOPE, "resonance", next);
  return next;
}

function patchEsotericDisplayCardRoutingOnce() {
  const KEY = "__bbttcc_esoteric_displaycard_patch_v1";
  if (globalThis[KEY]) return;

  const ItemCls = CONFIG?.Item?.documentClass;
  const proto = ItemCls?.prototype;
  if (!proto) return;

  const fnName = (typeof proto.displayCard === "function") ? "displayCard" : (typeof proto._displayCard === "function") ? "_displayCard" : null;
  if (!fnName) return;

  const original = proto[fnName];
  proto[fnName] = async function(...args) {
    try {
      const item = this;
      if (item && String(item.type) === "feat") {
        const ident = String(item.system?.identifier || item.flags?.bbttcc?.identifier || "");
        if (ESOTERIC_FEAT_IDS.has(ident) && item.parent) {
          // Important: schedule so Dialogs render after the click pipeline completes.
          setTimeout(() => {
            try {
              Hooks.callAll("dnd5e.useItem", item, {}, {});
            } catch (e) {
              WARN("Esoteric scheduled useItem failed", e);
            }
          }, 0);
          return null;
        }
      }
    } catch (e) {
      WARN("Esoteric displayCard patch failed", e);
    }
    return original.apply(this, args);
  };

  globalThis[KEY] = { fnName };
  LOG("Esoteric Magic routing patched", { fnName });
}



/* ---------------------------------------
 * Bad Eden Class Resources (Dice Pools + Pushback) — v1
 *
 * Goal:
 * - Provide first-class sheet UI for class-specific dice pools (single pool, scaling die)
 * - Provide pushback tracks (Trace / Pressure / Structural Stress / Burn, etc.)
 * - Option C: auto-spend + auto-roll + pushback tick on native dnd5e item use
 *
 * Canonical storage (Actor flags):
 *   flags.bbttcc.resources.pools.<key> = {
 *     dice: Number, maxDice: Number, die: "d6|d8|d10|d12",
 *     limitPerRound: Number, lastGain: { combatRound:Number|null, ts:Number }
 *   }
 *   flags.bbttcc.resources.tracks.<key> = { value:Number, ts:Number }
 *
 * Item metadata (preferred, authorable):
 *   item.flags.bbttcc.resourceCost = { pool:"access", dice:1, roll:true }
 *   item.flags.bbttcc.pushback     = { track:"trace", on:"use|fail|success", amount:1 }
 *
 * Heuristic fallback (for legacy items without flags):
 * - Parses item description text for "Spend X Access Dice" and "Gain +Y Trace" style phrasing.
 * ------------------------------------ */

const BBTTCC_RESOURCES_KEY = "resources";

const BBTTCC_RESOURCES_SCOPE = MOD; // store resources under an active module scope

const BBTTCC_CLASS_RESOURCES = [
  // Shadowjack
  {
    classId: "shadowjack",
    pools: [
      { key: "access", label: "Access Dice", ability: "dex", limitPerRound: 1, progression: { 1:"d6", 5:"d8", 11:"d10", 17:"d12" } }
    ],
    tracks: [
      { key: "trace", label: "Trace", bands: [
        { min: 0, label: "Clear" },
        { min: 1, label: "Pinged" },
        { min: 2, label: "Flagged" },
        { min: 3, label: "Burned Routes" },
        { min: 4, label: "Compromised" }
      ]}
    ]
  },

  // Pactkeeper (Civic Charge + Administrative Pressure)
  {
    classId: "pactkeeper",
    pools: [
      { key: "civic", label: "Civic Charge", ability: "wis", limitPerRound: 1, progression: { 1:"d6", 5:"d8", 11:"d10", 17:"d12" } }
    ],
    tracks: [
      { key: "pressure", label: "Administrative Pressure", bands: [
        { min: 0, label: "Clear" },
        { min: 1, label: "Low" },
        { min: 4, label: "Moderate" },
        { min: 7, label: "High" }
      ]}
    ]
  },

  // Titanbound (Frame Dice + Structural Stress) — formerly "graveward" in this registry.
  // Renamed 2026-04-13 to match the Bad Eden Resource Action JSON Suite manifest.
  {
    classId: "titanbound",
    pools: [
      { key: "frame", label: "Frame Dice", ability: "con", limitPerRound: 1, progression: { 1:"d6", 5:"d8", 11:"d10", 17:"d12" } }
    ],
    tracks: [
      { key: "stress", label: "Structural Stress", bands: [
        { min: 0, label: "Stable" },
        { min: 2, label: "Strained" },
        { min: 4, label: "Cracked" },
        { min: 6, label: "Failing" }
      ]}
    ]
  },

  // Cosmic Linguist (Resonance Dice + Strain track). Primary ability is Intelligence.
  {
    classId: "cosmic_linguist",
    pools: [
      { key: "resonance", label: "Resonance Dice", ability: "int", limitPerRound: 1, progression: { 1:"d6", 5:"d8", 11:"d10", 17:"d12" } }
    ],
    tracks: [
      { key: "strain", label: "Strain", bands: [
        { min: 0, label: "Aligned" },
        { min: 1, label: "Drifting" },
        { min: 3, label: "Skewed" },
        { min: 5, label: "Backlash" }
      ]}
    ]
  },

  // Aurablade (Burn track). Note: Burn is described as a state track (not a die pool) in your class text.
  {
    classId: "aurablade",
    pools: [],
    tracks: [
      { key: "burn", label: "Burn", bands: [
        { min: 0, label: "Controlled (0–1)" },
        { min: 2, label: "Engaged (2–3)" },
        { min: 4, label: "Overheated (4+)" }
      ]}
    ]
  }
];

/* ---------------------------------------
 * Bad Eden Action Dialog Registry
 * ---------------------------------------
 * Specs for the dialogs that open when a resource-action item is used (keyed
 * by `flags.bbttcc.opensDialog` on the item). Each option:
 *   - label/icon/hint: UI
 *   - roll:true       — roll the associated pool die and include the result
 *   - narrative       — chat-card line; supports {{var}} substitution via
 *                       narrativeVars(actor) => { var: value }
 *   - setAura         — aurablade: write aura state to actor flag
 *   - burnDelta/burnSet — aurablade: mutate burn track directly
 *
 * Dialogs for items that DO spend a pool die (dicePool engine, cost > 0) only
 * commit the spend after the user picks an option — Cancel closes the dialog
 * without cost. Dialogs for stateTrack items (aurablade aura/burn) don't
 * consume a pool.
 */
const BBTTCC_ACTION_DIALOGS = {
  titanbound_frame: {
    title: "Titanbound — Spend Frame Die",
    blurb: "Spend 1 Frame Die. Pick how to apply it:",
    options: [
      { id: "reduce", label: "Reduce Damage", icon: "fas fa-shield-halved",
        hint: "Roll the Frame Die; reduce incoming damage by the result.",
        roll: true, narrative: "Incoming damage reduced by the Frame Die result." },
      { id: "knockback", label: "Knockback", icon: "fas fa-wind",
        hint: "Next hit this turn pushes target (5 × die result) feet.",
        roll: true, narrative: "Next hit knocks target back (5 × die) feet." },
      { id: "topple", label: "Topple", icon: "fas fa-person-falling",
        hint: "Next hit forces a Strength save or knocks target prone. DC = 10 + prof + STR mod.",
        roll: false,
        narrative: "Next hit forces DC {{dc}} Strength save or knocked prone.",
        narrativeVars: (actor) => ({
          dc: 10 + Number(actor?.system?.attributes?.prof || 0) + Number(actor?.system?.abilities?.str?.mod || 0)
        }) },
      { id: "brace", label: "Brace", icon: "fas fa-anchor",
        hint: "Resist forced movement until the start of your next turn.",
        roll: false, narrative: "Braced — resists forced movement until start of next turn." },
      { id: "ignore_terrain", label: "Ignore Difficult Terrain", icon: "fas fa-shoe-prints",
        hint: "Move through difficult terrain at normal speed this turn.",
        roll: false, narrative: "Moves through difficult terrain at normal speed this turn." }
    ]
  },

  pactkeeper_civic: {
    title: "Pactkeeper — Spend Civic Charge",
    blurb: "Spend 1 Civic Charge. Apply to a bureaucratic/authority effect:",
    options: [
      { id: "stabilization", label: "Stabilization", icon: "fas fa-scale-balanced",
        hint: "Roll; stabilize a creature or contract. Use as temp HP or save bonus.",
        roll: true, narrative: "Stabilization applied (Civic Charge result)." },
      { id: "authority", label: "Authority Boost", icon: "fas fa-gavel",
        hint: "Roll; add to your next Persuasion or Intimidation roll.",
        roll: true, narrative: "Authority Boost — add result to next Persuasion/Intimidation." },
      { id: "enforcement", label: "Enforcement", icon: "fas fa-handcuffs",
        hint: "Roll; target makes a save or is restrained/detained by binding ruling.",
        roll: true, narrative: "Enforcement — target save vs restraint (die as bonus)." },
      { id: "containment", label: "Containment", icon: "fas fa-lock",
        hint: "Freeze an ongoing effect, contract, or bureaucratic action until end of your next turn.",
        roll: false, narrative: "Effect contained until end of your next turn." },
      { id: "closure", label: "Closure", icon: "fas fa-stamp",
        hint: "Close an open contract, loophole, or obligation on the target.",
        roll: false, narrative: "Ruling closed — contract or obligation resolved." }
    ]
  },

  cosmic_resonance: {
    title: "Cosmic Linguist — Resonance Channel",
    blurb: "Spend 1 Resonance Die. Weave into your next spellcast:",
    options: [
      { id: "dc_bonus", label: "+1 Spell Save DC", icon: "fas fa-plus",
        hint: "Your next spell's save DC is increased by 1.",
        roll: false, narrative: "Next spell: +1 save DC." },
      { id: "extra_die", label: "Extra Damage/Effect Die", icon: "fas fa-dice-d20",
        hint: "Add one additional die of damage or effect to your next spell.",
        roll: true, narrative: "Next spell: +1 die of damage/effect (result shown for reference)." },
      { id: "extend", label: "Extend Duration", icon: "fas fa-clock",
        hint: "Extend your next spell's duration one step (round → minute → 10 min → hour …).",
        roll: false, narrative: "Next spell: duration extended one step." },
      { id: "disadvantage", label: "Impose Disadvantage", icon: "fas fa-thumbs-down",
        hint: "Target of your next spell has disadvantage on one save against it.",
        roll: false, narrative: "Next spell: target has disadvantage on one save." },
      { id: "stabilize", label: "Stabilize vs Counter", icon: "fas fa-shield-heart",
        hint: "Your next spell has advantage against counterspell or dispel magic.",
        roll: false, narrative: "Next spell: advantage vs counterspell/dispel." }
    ]
  },

  aurablade_change_aura: {
    title: "Aurablade — Change Aura",
    blurb: "Project one aura. Aura state is stored on the actor and visible on the Class Resources card.",
    options: [
      { id: "fury", label: "Fury", icon: "fas fa-fire",
        hint: "Offensive: aggressive bonuses and increased threat.",
        setAura: "fury", narrative: "Aura shifted to Fury." },
      { id: "resolve", label: "Resolve", icon: "fas fa-shield-halved",
        hint: "Defensive: damage resistance and save bonuses.",
        setAura: "resolve", narrative: "Aura shifted to Resolve." },
      { id: "mercy", label: "Mercy", icon: "fas fa-heart",
        hint: "Supportive: allied healing and de-escalation.",
        setAura: "mercy", narrative: "Aura shifted to Mercy." },
      { id: "dread", label: "Dread", icon: "fas fa-skull",
        hint: "Intimidation: fear and morale effects.",
        setAura: "dread", narrative: "Aura shifted to Dread." }
    ]
  },

  aurablade_stabilize_burn: {
    title: "Aurablade — Stabilize Burn",
    blurb: "Manage your current Burn track.",
    options: [
      { id: "cool1", label: "Cool (-1)", icon: "fas fa-temperature-arrow-down",
        hint: "Reduce Burn by 1.",
        burnDelta: -1, narrative: "Burn reduced by 1." },
      { id: "cool2", label: "Cool (-2)", icon: "fas fa-snowflake",
        hint: "Reduce Burn by 2.",
        burnDelta: -2, narrative: "Burn reduced by 2." },
      { id: "clear", label: "Clear", icon: "fas fa-check",
        hint: "Reset Burn to 0.",
        burnSet: 0, narrative: "Burn fully cleared." },
      { id: "hold", label: "Hold Steady", icon: "fas fa-pause",
        hint: "Prevent Burn from escalating this round.",
        narrative: "Burn held steady — no escalation this round." }
    ]
  },

  shadowjack_access: {
    title: "Shadowjack — Spend Access Die",
    blurb: "Spend 1 Access Die. Pick an intrusion use:",
    options: [
      { id: "bypass_lock", label: "Bypass Lock / Barrier", icon: "fas fa-unlock",
        hint: "Roll; overcome a simple lock, ward, or physical barrier.",
        roll: true, narrative: "Bypass check (die result shown) — GM adjudicates against barrier DC." },
      { id: "reduce_alarm", label: "Reduce Alarm Escalation", icon: "fas fa-volume-low",
        hint: "Roll; lower the current alarm/awareness level by the die result.",
        roll: true, narrative: "Alarm escalation reduced by the die result." },
      { id: "backdoor", label: "Create Temporary Backdoor", icon: "fas fa-door-open",
        hint: "Establish a persistent re-entry point lasting a scene.",
        roll: false, narrative: "Temporary backdoor established — re-entry for the scene." },
      { id: "misreport", label: "Misreport Your Presence", icon: "fas fa-user-secret",
        hint: "Adversary systems log a false location/identity for you.",
        roll: false, narrative: "Adversary records show a false location or identity." },
      { id: "slip_check", label: "Slip a Check", icon: "fas fa-eye-slash",
        hint: "Roll; pass a reaction / zone / detection check using the die result.",
        roll: true, narrative: "Detection / reaction / zone check slipped (die as bonus)." }
    ]
  },

  pactkeeper_precedent: {
    title: "Pactkeeper — Invoke Precedent",
    blurb: "Cite the record. Invoking Precedent REDUCES Administrative Pressure by 2.",
    options: [
      { id: "cite", label: "Cite Precedent", icon: "fas fa-book",
        hint: "Force a reroll by asserting consistency. If the action violates an established precedent, the reroll takes the WORSE result.",
        roll: false, pressureDelta: -2,
        narrative: "Precedent cited — one roll must be re-rolled. Worse of the two if it violates established precedent." },
      { id: "establish", label: "Establish Record", icon: "fas fa-stamp",
        hint: "Lock an outcome as official for purposes of consequence and future precedent.",
        roll: false, pressureDelta: -2,
        narrative: "Outcome locked as official record. A new Precedent is established." },
      { id: "suppress", label: "Suppress Contradiction", icon: "fas fa-ban",
        hint: "Nullify paradox, contradictory magic, or narrative retcons for one moment.",
        roll: false, pressureDelta: -2,
        narrative: "Contradiction suppressed — paradox or retcon nullified for this moment." }
    ]
  },

  aurablade_burn: {
    title: "Aurablade — Trigger Aura Effect",
    blurb: "Invoke your currently-projected aura. This gains +1 Burn (max 1/round).",
    options: [
      { id: "aura_hit", label: "Hit with Aura-Enhanced Attack", icon: "fas fa-crosshairs",
        hint: "You hit with an attack granted or enhanced by your Aura. +1 Burn.",
        burnGain: 1,
        narrative: "Aura-enhanced hit — {{aura}}, current Burn band: {{burnBand}}. +1 Burn.",
        narrativeVars: (actor) => _bbttccAurabladeNarrativeVars(actor) },
      { id: "aura_save", label: "Force Save via Aura Feature", icon: "fas fa-bolt",
        hint: "You force a saving throw using an Aura feature. +1 Burn.",
        burnGain: 1,
        narrative: "Aura-forced save — {{aura}}, current Burn band: {{burnBand}}. +1 Burn.",
        narrativeVars: (actor) => _bbttccAurabladeNarrativeVars(actor) },
      { id: "escalate", label: "Escalate Without Pause", icon: "fas fa-fire-flame-curved",
        hint: "GM-flagged high-risk continuation. +1 Burn.",
        burnGain: 1,
        narrative: "Escalating without pause — {{aura}}, current Burn band: {{burnBand}}. +1 Burn.",
        narrativeVars: (actor) => _bbttccAurabladeNarrativeVars(actor) },
      { id: "linger", label: "Linger in Aura", icon: "fas fa-hourglass",
        hint: "Remain in the same Aura too long without stabilizing. +1 Burn.",
        burnGain: 1,
        narrative: "Lingering in {{aura}} — emotional strain builds. Current Burn band: {{burnBand}}. +1 Burn.",
        narrativeVars: (actor) => _bbttccAurabladeNarrativeVars(actor) }
    ]
  }
};

/**
 * Compute narrative substitution vars for Aurablade dialog options:
 *   {{aura}} → current aura label (or "No Aura Set")
 *   {{burnBand}} → current burn band label from BBTTCC_CLASS_RESOURCES
 */
function _bbttccAurabladeNarrativeVars(actor) {
  const auraKey = String(actor?.getFlag?.(MOD, "aurablade.currentAura") || "");
  const auraLabel = BBTTCC_AURA_LABELS[auraKey] || "No Aura Set";

  let burnBand = "Controlled";
  try {
    const spec = _bbttccFindTrackSpec(actor, "burn");
    if (spec) {
      const st = _bbttccTrackState(actor, spec);
      burnBand = st?.bandLabel || "Controlled";
    }
  } catch {/* ignore */}

  return { aura: auraLabel, burnBand };
}

const BBTTCC_AURA_LABELS = {
  fury: "Fury",
  resolve: "Resolve",
  mercy: "Mercy",
  dread: "Dread"
};

/* ---------------------------------------
 * Bad Eden Resource Action Suite — UUID healer
 * ---------------------------------------
 * Class items in the suite carry an ItemGrant advancement flagged with
 * `flags.bbttcc.resourceSuite = true`. The advancement references resource
 * items by UUID. When the resource items are re-imported into the
 * `bbttcc-master-content.classes` pack they may receive fresh IDs, breaking
 * those references and silently failing the level-up grant.
 *
 * The healer runs on sheet open: for any class item with the Bad Eden suite
 * flag, it (a) repairs broken UUIDs by mapping the original suite UUID →
 * canonical identifier → live compendium UUID, and (b) ensures any items
 * the grant SHOULD have produced are present on the actor (catches up
 * actors who already had a failed grant before the healer existed).
 */
const BBTTCC_RESOURCE_PACK = "bbttcc-master-content.classes";

/**
 * Canonical list of resource-suite identifiers each class should grant at
 * level 1. Keyed by `flags.bbttcc.classId` on the ItemGrant advancement.
 *
 * This is the SOURCE OF TRUTH for what a class should have. The healer uses
 * it to rebuild the advancement's UUID list from the live compendium on each
 * sheet open, so the advancement never needs to be manually re-patched when
 * compendium items get re-imported with new IDs.
 */
const BBTTCC_CLASS_EXPECTED_GRANTS = {
  titanbound:      ["titanbound_frame_resource", "titanbound_spend_frame_die", "titanbound_structural_stress"],
  shadowjack:      ["shadowjack_access_pool", "shadowjack_spend_access_die", "shadowjack_trace_track"],
  pactkeeper:      ["pactkeeper_civic_charge", "pactkeeper_spend_civic_charge", "pactkeeper_administrative_pressure", "pactkeeper_invoke_precedent_action"],
  cosmic_linguist: ["cosmic_linguist_resonance_pool", "cosmic_linguist_resonance_channel_action", "cosmic_linguist_strain_track"],
  aurablade:       ["aurablade_burn_state", "aurablade_action", "aurablade_change_aura", "aurablade_stabilize_burn"]
};

const BBTTCC_RESOURCE_ORIGINAL_UUID_TO_IDENTIFIER = {
  "Compendium.bbttcc-master-content.classes.Item.TbFrmResA01X9QpL": "titanbound_frame_resource",
  "Compendium.bbttcc-master-content.classes.Item.TbFrmActB02Y7MrK": "titanbound_spend_frame_die",
  "Compendium.bbttcc-master-content.classes.Item.TbStrTrkC03N6HsJ": "titanbound_structural_stress",
  "Compendium.bbttcc-master-content.classes.Item.SjAccResD04K5GtH": "shadowjack_access_pool",
  "Compendium.bbttcc-master-content.classes.Item.SjAccActE05J4FsG": "shadowjack_spend_access_die",
  "Compendium.bbttcc-master-content.classes.Item.SjTrcTrkF06H3ErF": "shadowjack_trace_track",
  "Compendium.bbttcc-master-content.classes.Item.PkCivResG07G2DqE": "pactkeeper_civic_charge",
  "Compendium.bbttcc-master-content.classes.Item.PkCivActH08F1CpD": "pactkeeper_spend_civic_charge",
  "Compendium.bbttcc-master-content.classes.Item.PkPrsTrkI09E0BoC": "pactkeeper_administrative_pressure",
  "Compendium.bbttcc-master-content.classes.Item.PkPrdActJ10D9AnB": "pactkeeper_invoke_precedent_action",
  "Compendium.bbttcc-master-content.classes.Item.ClResResK11C8ZmA": "cosmic_linguist_resonance_pool",
  "Compendium.bbttcc-master-content.classes.Item.ClResActL12B7YxZ": "cosmic_linguist_resonance_channel_action",
  "Compendium.bbttcc-master-content.classes.Item.ClStrTrkM13A6WvY": "cosmic_linguist_strain_track",
  "Compendium.bbttcc-master-content.classes.Item.AbBrnResN14Z5UtX": "aurablade_burn_state",
  "Compendium.bbttcc-master-content.classes.Item.AbBrnActO15Y4TsW": "aurablade_action",
  "Compendium.bbttcc-master-content.classes.Item.AbAurActP16X3SrV": "aurablade_change_aura",
  "Compendium.bbttcc-master-content.classes.Item.AbStbActQ17W2RqU": "aurablade_stabilize_burn"
};

let _bbttccResourceItemIndexCache = null;

/**
 * Build (and cache for the session) a map of canonical resource identifier →
 * current compendium UUID, by reading flags.bbttcc.identifier and
 * system.identifier from the master-content classes pack index.
 *
 * Pass `{ force: true }` to bypass the cache (e.g., after the user re-imports
 * items into the compendium mid-session — the healer does this automatically
 * when it notices expected identifiers missing from the cached index).
 */
async function _bbttccGetResourceItemIndex({ force = false } = {}) {
  if (_bbttccResourceItemIndexCache && !force) return _bbttccResourceItemIndexCache;
  try {
    const pack = game.packs?.get?.(BBTTCC_RESOURCE_PACK);
    if (!pack) {
      _bbttccResourceItemIndexCache = new Map();
      return _bbttccResourceItemIndexCache;
    }
    const idx = await pack.getIndex({ fields: ["flags.bbttcc.identifier", "system.identifier"] });
    const map = new Map();
    for (const entry of idx) {
      const id = entry.flags?.bbttcc?.identifier || entry.system?.identifier;
      if (id) map.set(String(id), `Compendium.${BBTTCC_RESOURCE_PACK}.Item.${entry._id}`);
    }
    _bbttccResourceItemIndexCache = map;
    return map;
  } catch (e) {
    WARN("Failed to build Bad Eden resource item index", e);
    _bbttccResourceItemIndexCache = new Map();
    return _bbttccResourceItemIndexCache;
  }
}

/**
 * Get the live index, but if any of the expected identifiers for the given
 * classIds are missing, force a refresh once. Catches the case where the
 * user re-imported items into the compendium during the current session.
 */
async function _bbttccGetFreshResourceIndex(classIds) {
  let idx = await _bbttccGetResourceItemIndex();
  const expected = new Set();
  for (const cid of classIds) {
    for (const id of (BBTTCC_CLASS_EXPECTED_GRANTS[cid] || [])) expected.add(id);
  }
  const missing = [...expected].filter(id => !idx.has(id));
  if (missing.length) {
    idx = await _bbttccGetResourceItemIndex({ force: true });
  }
  return idx;
}

/**
 * Get a class item's advancements as an array regardless of the underlying
 * data shape. dnd5e v5 stores `system.advancement` as an OBJECT keyed by
 * `_id`; older / variant data may store it as an array. Always returns array.
 */
function _bbttccAdvancementsArray(classItem) {
  const raw = classItem?.toObject?.()?.system?.advancement;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

/**
 * Repair ItemGrant advancements on this actor's class items and backfill any
 * resource items that should be present but aren't.
 *
 * Strategy (2026-04-14 rewrite):
 *   The healer is driven by `flags.bbttcc.classId` on the advancement, NOT
 *   by the advancement's UUID list. For each resource-suite grant, it looks
 *   up the expected identifier list from BBTTCC_CLASS_EXPECTED_GRANTS, maps
 *   each identifier to the CURRENT compendium UUID via the live pack index,
 *   and rebuilds the grant's items array from scratch. This is robust to
 *   arbitrary UUID drift — any stale intermediate UUIDs get replaced, not
 *   just the ones in a static table.
 *
 * Idempotent: only writes when the current items array actually differs from
 * the computed target.
 */
// Guards against the render→write→render cascade that caused the 2026-04-17
// freezes. `_HEAL_IN_FLIGHT` is a Set of actor IDs currently executing a heal
// pass — any re-entry (e.g., triggered by the heal's own actor.update firing
// renderActorSheet) is short-circuited. `_HEAL_RECENT` records the last
// completion timestamp per actor; heals are skipped if one just ran within
// the cooldown window. Cooldown is generous because the heal is idempotent
// in the steady state (`uuidSeq` equality at _bbttccHealResourceGrants:833),
// so skipping a few cycles after an update settles is safe.
const _BBTTCC_HEAL_IN_FLIGHT = new Set(); // Set<actorId>
const _BBTTCC_HEAL_RECENT    = new WeakMap(); // Actor -> lastCompletedTs
const _BBTTCC_HEAL_COOLDOWN_MS = 1500;

async function _bbttccHealResourceGrants(actor) {
  if (!actor || !(actor instanceof Actor)) return;
  // Only owners/GMs can update actor items; bail silently for limited viewers.
  if (!game.user?.isGM && actor.isOwner !== true) return;

  const actorId = String(actor.id || "");
  if (actorId && _BBTTCC_HEAL_IN_FLIGHT.has(actorId)) return;
  const lastCompleted = _BBTTCC_HEAL_RECENT.get(actor) ?? 0;
  if (Date.now() - lastCompleted < _BBTTCC_HEAL_COOLDOWN_MS) return;
  if (actorId) _BBTTCC_HEAL_IN_FLIGHT.add(actorId);
  try {
    await _bbttccHealResourceGrantsCore(actor);
  } finally {
    _BBTTCC_HEAL_RECENT.set(actor, Date.now());
    if (actorId) _BBTTCC_HEAL_IN_FLIGHT.delete(actorId);
  }
}

async function _bbttccHealResourceGrantsCore(actor) {
  const allItems = actor.items?.contents ?? [];
  const suiteClasses = allItems.filter(it =>
    it.type === "class" &&
    _bbttccAdvancementsArray(it).some(adv =>
      adv?.type === "ItemGrant" && adv?.flags?.bbttcc?.resourceSuite === true)
  );
  if (!suiteClasses.length) return;

  // Collect the classIds this actor needs so we can refresh the pack index if
  // any expected identifier is missing (e.g. the user just re-imported).
  const classIds = new Set();
  for (const cls of suiteClasses) {
    for (const adv of _bbttccAdvancementsArray(cls)) {
      if (adv?.type === "ItemGrant" && adv?.flags?.bbttcc?.resourceSuite) {
        const cid = String(adv?.flags?.bbttcc?.classId || "");
        if (cid) classIds.add(cid);
      }
    }
  }

  const liveIndex = await _bbttccGetFreshResourceIndex([...classIds]);
  if (!liveIndex.size) {
    WARN(`Bad Eden resource pack '${BBTTCC_RESOURCE_PACK}' has no items in its index; cannot heal grants`);
    return;
  }

  for (const classItem of suiteClasses) {
    const advancements = _bbttccAdvancementsArray(classItem);
    let docChanged = false;

    const healed = advancements.map(adv => {
      if (adv?.type !== "ItemGrant" || !adv?.flags?.bbttcc?.resourceSuite) return adv;

      const classId = String(adv?.flags?.bbttcc?.classId || "");
      const expectedIdentifiers = BBTTCC_CLASS_EXPECTED_GRANTS[classId];
      if (!expectedIdentifiers?.length) return adv;

      // Rebuild the items array from the canonical identifier list. Preserve
      // any per-item flags (e.g., `optional`) by copying them from the
      // existing entry whose identifier matches, when possible.
      const currentItems = adv.configuration?.items || [];
      const targetItems = [];
      for (const identifier of expectedIdentifiers) {
        const freshUuid = liveIndex.get(identifier);
        if (!freshUuid) {
          // Item not in the live pack — leave whatever's currently configured
          // for this slot (or nothing). Warn once per sheet open.
          WARN(`Bad Eden resource item '${identifier}' not found in ${BBTTCC_RESOURCE_PACK}; skipping`);
          continue;
        }
        // Try to preserve the existing ref's meta fields if one matches this identifier
        // via the live index reverse lookup.
        const existingMatch = currentItems.find(ref => {
          const refUuid = String(ref?.uuid || "");
          // Does any identifier in liveIndex map to this UUID?
          for (const [id, u] of liveIndex.entries()) if (u === refUuid && id === identifier) return true;
          return false;
        });
        if (existingMatch) {
          targetItems.push({ ...existingMatch, uuid: freshUuid });
        } else {
          targetItems.push({ uuid: freshUuid, optional: false });
        }
      }

      // Compare to detect change (order + uuid only, ignore key order)
      const uuidSeq = (arr) => arr.map(r => String(r?.uuid || "")).join("|");
      if (uuidSeq(currentItems) === uuidSeq(targetItems)) return adv;

      docChanged = true;
      return foundry.utils.mergeObject(adv, { configuration: { items: targetItems } }, { inplace: false });
    });

    if (docChanged) {
      try {
        // dnd5e v5 stores advancement as an object keyed by _id. Rebuild the
        // object from the healed array (any advancement without an _id is
        // dropped — they shouldn't exist in well-formed data).
        const healedObject = {};
        for (const adv of healed) {
          if (adv?._id) healedObject[adv._id] = adv;
        }
        await classItem.update({ "system.advancement": healedObject });
        LOG(`Healed Bad Eden resource grant UUIDs on ${actor.name} :: ${classItem.name}`);
      } catch (e) {
        WARN(`Failed to update advancements on ${classItem.name}`, e);
        continue;
      }
    }

    // Ensure all expected resource items actually exist on the actor.
    await _bbttccEnsureGrantedResourceItems(actor, healed, liveIndex, classItem);
  }
}

/**
 * For each Bad Eden resource-suite ItemGrant advancement on the class item,
 * make sure every EXPECTED resource item is present on the actor:
 *   1. Detects existing items by identifier (multi-key) AND by compendium source
 *      UUID, to avoid duplicates from earlier backfills/imports that may have
 *      lost flag data.
 *   2. De-duplicates: if the actor already has multiple items for the same
 *      identifier, deletes the extras (keeps the oldest by createdTime).
 *   3. Backfills any truly missing items, tagging them with
 *      `flags.dnd5e.advancementOrigin` so the dnd5e sheet associates them
 *      with the class advancement (otherwise they appear under "Other Features").
 */
async function _bbttccEnsureGrantedResourceItems(actor, advancements, liveIndex, classItem) {
  // Collect (identifier, advancementId) pairs from all resource-suite grants
  // on this class. We need the advancementId to set advancementOrigin properly.
  const wantedByIdentifier = new Map(); // identifier -> { advancementId, classItemId }
  for (const adv of advancements) {
    if (adv?.type !== "ItemGrant" || !adv?.flags?.bbttcc?.resourceSuite) continue;
    const classId = String(adv?.flags?.bbttcc?.classId || "");
    const list = BBTTCC_CLASS_EXPECTED_GRANTS[classId];
    if (!list?.length) continue;
    for (const id of list) {
      wantedByIdentifier.set(id, {
        advancementId: String(adv?._id || ""),
        classItemId: String(classItem?.id || "")
      });
    }
  }
  if (!wantedByIdentifier.size) return;

  // Build reverse lookups for matching existing items to identifiers.
  const uuidToIdentifier = new Map();
  for (const [id, uuid] of liveIndex.entries()) uuidToIdentifier.set(uuid, id);

  // Build identifier → canonical source-item name map (for name-based fallback
  // dedup when flags/sourceIds got stripped on a previous import).
  const nameToIdentifier = new Map();
  for (const id of wantedByIdentifier.keys()) {
    const uuid = liveIndex.get(id);
    if (!uuid) continue;
    try {
      const src = await fromUuid(uuid);
      if (src?.name) nameToIdentifier.set(String(src.name).trim(), id);
    } catch {/* ignore */}
  }

  // Group existing items by their effective identifier. An item "owns" an
  // identifier if any of these match:
  //   - flags.bbttcc.identifier
  //   - system.identifier
  //   - flags.core.sourceId / _stats.compendiumSource resolves via liveIndex
  //   - exact name match against a current suite item (fallback for items
  //     created before flag preservation was reliable)
  const itemsByIdentifier = new Map(); // identifier -> [Item, ...]
  for (const it of (actor.items?.contents ?? [])) {
    let id = it.flags?.bbttcc?.identifier || it.system?.identifier;
    if (!id) {
      const sourceUuid = String(it.flags?.core?.sourceId || it._stats?.compendiumSource || "");
      if (sourceUuid) id = uuidToIdentifier.get(sourceUuid);
    }
    if (!id) {
      // Final fallback: exact name match (covers stripped-flag duplicates)
      id = nameToIdentifier.get(String(it.name || "").trim());
    }
    if (!id) continue;
    id = String(id);
    if (!wantedByIdentifier.has(id)) continue; // not a resource-suite identifier
    if (!itemsByIdentifier.has(id)) itemsByIdentifier.set(id, []);
    itemsByIdentifier.get(id).push(it);
  }

  // De-duplicate: keep the oldest (lowest createdTime), delete the rest.
  const dupesToDelete = [];
  for (const [id, items] of itemsByIdentifier.entries()) {
    if (items.length <= 1) continue;
    const sorted = items.slice().sort((a, b) =>
      Number(a._stats?.createdTime ?? 0) - Number(b._stats?.createdTime ?? 0));
    for (const extra of sorted.slice(1)) dupesToDelete.push(extra.id);
  }
  if (dupesToDelete.length) {
    try {
      await actor.deleteEmbeddedDocuments("Item", dupesToDelete);
      LOG(`Removed ${dupesToDelete.length} duplicate Bad Eden resource item(s) on ${actor.name}`);
    } catch (e) {
      WARN(`Failed to delete duplicate resource items on ${actor.name}`, e);
    }
  }

  // Backfill anything still missing.
  const missing = [...wantedByIdentifier.keys()].filter(id => !itemsByIdentifier.has(id));
  if (!missing.length) return;

  const docs = [];
  for (const id of missing) {
    const uuid = liveIndex.get(id);
    if (!uuid) continue;
    try {
      const src = await fromUuid(uuid);
      if (!src) continue;
      const data = src.toObject();
      // Tag with advancement origin so the dnd5e sheet groups it under the
      // class instead of "Other Features". Format: "<classItemId>.<advancementId>"
      const origin = wantedByIdentifier.get(id);
      if (origin?.classItemId && origin?.advancementId) {
        foundry.utils.setProperty(data, "flags.dnd5e.advancementOrigin",
          `${origin.classItemId}.${origin.advancementId}`);
      }
      // Stamp the source UUID so future runs can match by source even if the
      // bbttcc/system identifiers ever get stripped.
      foundry.utils.setProperty(data, "flags.core.sourceId", uuid);
      docs.push(data);
    } catch (e) {
      WARN(`Failed to fetch resource item '${id}' for backfill grant`, e);
    }
  }
  if (!docs.length) return;

  try {
    await actor.createEmbeddedDocuments("Item", docs);
    LOG(`Backfilled ${docs.length} missing Bad Eden resource item(s) on ${actor.name}: ${missing.join(", ")}`);
  } catch (e) {
    WARN(`Failed to create backfill resource items on ${actor.name}`, e);
  }
}

function _bbttccGet(obj, path, fallback) {
  try { return foundry.utils.getProperty(obj, path) ?? fallback; } catch { return fallback; }
}
function _bbttccClone(x) {
  try { return foundry.utils.deepClone(x || {}); } catch { return JSON.parse(JSON.stringify(x || {})); }
}
function _bbttccStripHtml(s) {
  try {
    const tmp = document.createElement("div");
    tmp.innerHTML = String(s || "");
    return (tmp.textContent || tmp.innerText || "").trim();
  } catch {
    return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function _bbttccHasClass(actor, classId) {
  try {
    const items = actor?.items?.contents ?? actor?.items ?? [];
    return items.some(it => String(it?.type) === "class" && String(it?.system?.identifier || "") === String(classId));
  } catch { return false; }
}

function _bbttccGetClassLevel(actor, classId) {
  try {
    // dnd5e v5+ commonly provides actor.system.classes.<id>.levels
    const fromSys = Number(_bbttccGet(actor, `system.classes.${classId}.levels`, null));
    if (Number.isFinite(fromSys) && fromSys > 0) return Math.floor(fromSys);

    // Some worlds expose actor.classes map
    const fromMap = Number(_bbttccGet(actor, `classes.${classId}.levels`, null));
    if (Number.isFinite(fromMap) && fromMap > 0) return Math.floor(fromMap);

    // Fallback: look for embedded class item with system.levels
    const items = actor?.items?.contents ?? actor?.items ?? [];
    const cls = items.find(it => String(it?.type) === "class" && String(it?.system?.identifier || "") === String(classId));
    const lvl = Number(cls?.system?.levels ?? 0);
    return (Number.isFinite(lvl) && lvl > 0) ? Math.floor(lvl) : 0;
  } catch { return 0; }
}

function _bbttccDieForLevel(level, progression) {
  const L = Math.max(0, Math.floor(Number(level || 0) || 0));
  const prog = progression && typeof progression === "object" ? progression : { 1:"d6", 5:"d8", 11:"d10", 17:"d12" };
  let best = "d6";
  for (const [k, die] of Object.entries(prog)) {
    const at = Math.floor(Number(k || 0) || 0);
    if (at > 0 && L >= at) best = String(die || best);
  }
  return best;
}

function _bbttccActorResources(actor) {
  const raw = actor?.getFlag?.(BBTTCC_RESOURCES_SCOPE, BBTTCC_RESOURCES_KEY)
    || actor?.flags?.[BBTTCC_RESOURCES_SCOPE]?.[BBTTCC_RESOURCES_KEY]
    || actor?.flags?.bbttcc?.[BBTTCC_RESOURCES_KEY]
    || {};
  const base = (raw && typeof raw === "object") ? _bbttccClone(raw) : {};
  base.pools  = (base.pools  && typeof base.pools  === "object") ? base.pools  : {};
  base.tracks = (base.tracks && typeof base.tracks === "object") ? base.tracks : {};
  return base;
}

async function _bbttccSetActorResources(actor, patch) {
  const current = _bbttccActorResources(actor);
  const next = foundry.utils.mergeObject(_bbttccClone(current), patch || {}, { inplace: false, overwrite: true });
  await actor.setFlag(BBTTCC_RESOURCES_SCOPE, BBTTCC_RESOURCES_KEY, next);
  return next;
}

function _bbttccCurrentCombatRound() {
  try {
    const c = game.combat;
    if (!c) return null;
    const r = Number(c.round || 0);
    if (Number.isFinite(r) && r > 0) return Math.floor(r);
  } catch {}
  return null;
}

function _bbttccPoolState(actor, poolSpec) {
  const res = _bbttccActorResources(actor);
  const key = String(poolSpec?.key || "").trim();
  const cur = res.pools[key] && typeof res.pools[key] === "object" ? _bbttccClone(res.pools[key]) : {};
  const classLevel = _bbttccGetClassLevel(actor, poolSpec.classId);
  const die = _bbttccDieForLevel(classLevel, poolSpec.progression);

  let maxDice = 1;
  try {
    const abil = String(poolSpec.ability || "").trim().toLowerCase();
    const mod = Number(_bbttccGet(actor, `system.abilities.${abil}.mod`, 0) || 0);
    maxDice = Math.max(1, mod);
  } catch {}

  const out = {
    key,
    label: String(poolSpec.label || key),
    die,
    dice: Math.max(0, Math.floor(Number(cur.dice || 0) || 0)),
    maxDice,
    limitPerRound: Math.max(0, Math.floor(Number(poolSpec.limitPerRound ?? cur.limitPerRound ?? 0) || 0)),
    lastGain: cur.lastGain && typeof cur.lastGain === "object" ? cur.lastGain : { combatRound: null, ts: 0 }
  };

  // Clamp
  out.dice = Math.min(out.dice, out.maxDice);

  return out;
}

function _bbttccTrackState(actor, trackSpec) {
  const res = _bbttccActorResources(actor);
  const key = String(trackSpec?.key || "").trim();
  const cur = res.tracks[key] && typeof res.tracks[key] === "object" ? _bbttccClone(res.tracks[key]) : {};
  const value = Math.max(0, Math.floor(Number(cur.value || 0) || 0));

  // pick band label
  let band = null;
  const bands = Array.isArray(trackSpec?.bands) ? trackSpec.bands : [];
  for (const b of bands) {
    if (!b) continue;
    const min = Math.floor(Number(b.min || 0) || 0);
    if (value >= min) band = b;
  }

  return {
    key,
    label: String(trackSpec.label || key),
    value,
    bandLabel: band ? String(band.label || "") : ""
  };
}

async function _bbttccGainPoolDice(actor, poolSpec, n) {
  n = Math.max(0, Math.floor(Number(n || 0) || 0));
  if (!n) return null;

  const st = _bbttccPoolState(actor, poolSpec);
  const round = _bbttccCurrentCombatRound();
  const limit = st.limitPerRound || 0;

  // Enforce "gain only 1 per round" style limiter (if enabled and in combat)
  if (limit > 0 && round != null) {
    const lastR = Number(st.lastGain?.combatRound ?? null);
    if (Number.isFinite(lastR) && lastR === round) {
      ui.notifications?.warn?.(`${st.label}: already gained this round.`);
      return st;
    }
  }

  const nextDice = Math.min(st.maxDice, st.dice + n);
  const patch = {
    pools: {
      [st.key]: {
        dice: nextDice,
        maxDice: st.maxDice,
        die: st.die,
        limitPerRound: st.limitPerRound,
        lastGain: { combatRound: (round != null ? round : null), ts: Date.now() }
      }
    }
  };
  await _bbttccSetActorResources(actor, patch);
  return _bbttccPoolState(actor, poolSpec);
}

async function _bbttccSpendPoolDice(actor, poolSpec, n) {
  n = Math.max(0, Math.floor(Number(n || 0) || 0));
  if (!n) return null;

  const st = _bbttccPoolState(actor, poolSpec);
  if (st.dice < n) {
    ui.notifications?.warn?.(`${st.label}: not enough dice (${st.dice}/${st.maxDice}).`);
    return st;
  }

  const nextDice = Math.max(0, st.dice - n);
  const patch = { pools: { [st.key]: { dice: nextDice, maxDice: st.maxDice, die: st.die, limitPerRound: st.limitPerRound, lastGain: st.lastGain } } };
  await _bbttccSetActorResources(actor, patch);
  return _bbttccPoolState(actor, poolSpec);
}

async function _bbttccAdjustTrack(actor, trackSpec, delta) {
  delta = Math.floor(Number(delta || 0) || 0);
  if (!delta) return null;
  const st = _bbttccTrackState(actor, trackSpec);
  const next = Math.max(0, st.value + delta);
  const patch = { tracks: { [st.key]: { value: next, ts: Date.now() } } };
  await _bbttccSetActorResources(actor, patch);
  return _bbttccTrackState(actor, trackSpec);
}


// ---- Aurablade Burn helpers (Burn is both resource access + pushback) ----
function _bbttccAdvanceCombatTurn(combat, turns) {
  try {
    turns = Math.max(0, Math.floor(Number(turns || 0) || 0));
    const total = combat?.turns?.length || 0;
    let round = Number(combat?.round || 0) || 0;
    let turn = Number(combat?.turn || 0) || 0;
    if (!total) return { round, turn };
    let t = turn + turns;
    while (t >= total) { t -= total; round += 1; }
    return { round, turn: t };
  } catch { return { round: (combat?.round || 0), turn: (combat?.turn || 0) }; }
}

async function _bbttccSetBurn(actor, value) {
  const spec = _bbttccFindTrackSpec(actor, "burn");
  if (!spec) return null;
  const res = _bbttccActorResources(actor);
  const cur = res.tracks?.burn && typeof res.tracks.burn === "object" ? _bbttccClone(res.tracks.burn) : {};
  const meta = cur.meta && typeof cur.meta === "object" ? _bbttccClone(cur.meta) : {};
  const v = Math.max(0, Math.floor(Number(value || 0) || 0));
  await _bbttccSetActorResources(actor, { tracks: { burn: { value: v, ts: Date.now(), meta } } });
  return _bbttccTrackState(actor, spec);
}

async function _bbttccLockBurn(actor, turns) {
  const spec = _bbttccFindTrackSpec(actor, "burn");
  if (!spec) return null;
  const combat = game?.combat;
  if (!combat) return null;
  const until = _bbttccAdvanceCombatTurn(combat, turns);
  const res = _bbttccActorResources(actor);
  const cur = res.tracks?.burn && typeof res.tracks.burn === "object" ? _bbttccClone(res.tracks.burn) : {};
  const meta = cur.meta && typeof cur.meta === "object" ? _bbttccClone(cur.meta) : {};
  meta.lock = { combatId: combat.id, untilRound: until.round, untilTurn: until.turn, ts: Date.now() };
  await _bbttccSetActorResources(actor, { tracks: { burn: { value: Math.max(0, Math.floor(Number(cur.value || 0) || 0)), ts: Date.now(), meta } } });
  return _bbttccTrackState(actor, spec);
}

async function _bbttccScheduleBurnDelta(actor, rounds, delta) {
  delta = Math.floor(Number(delta || 0) || 0);
  if (!delta) return null;
  const combat = game?.combat;
  if (!combat) return null;
  const res = _bbttccActorResources(actor);
  const cur = res.tracks?.burn && typeof res.tracks.burn === "object" ? _bbttccClone(res.tracks.burn) : {};
  const meta = cur.meta && typeof cur.meta === "object" ? _bbttccClone(cur.meta) : {};
  const timers = Array.isArray(meta.timers) ? meta.timers.slice() : [];

  // "end of next round" is approximated as: apply at start of round+2 (turn 0).
  const atRound = (Number(combat.round || 0) || 0) + Math.max(1, Math.floor(Number(rounds || 1) || 1)) + 1;
  timers.push({ type: "delta", combatId: combat.id, atRound, atTurn: 0, delta, ts: Date.now() });
  meta.timers = timers;

  await _bbttccSetActorResources(actor, { tracks: { burn: { value: Math.max(0, Math.floor(Number(cur.value || 0) || 0)), ts: Date.now(), meta } } });
  return true;
}

async function _bbttccScheduleBurnSetEndOfTurn(actor, value) {
  const combat = game?.combat;
  if (!combat) return null;
  const res = _bbttccActorResources(actor);
  const cur = res.tracks?.burn && typeof res.tracks.burn === "object" ? _bbttccClone(res.tracks.burn) : {};
  const meta = cur.meta && typeof cur.meta === "object" ? _bbttccClone(cur.meta) : {};
  const timers = Array.isArray(meta.timers) ? meta.timers.slice() : [];
  const next = _bbttccAdvanceCombatTurn(combat, 1);
  timers.push({ type: "set", combatId: combat.id, atRound: next.round, atTurn: next.turn, set: Math.max(0, Math.floor(Number(value || 0) || 0)), ts: Date.now() });
  meta.timers = timers;
  await _bbttccSetActorResources(actor, { tracks: { burn: { value: Math.max(0, Math.floor(Number(cur.value || 0) || 0)), ts: Date.now(), meta } } });
  return true;
}


async function _bbttccRollDie(die) {
  const d = String(die || "d6").trim().toLowerCase();
  const formula = "1" + (d.startsWith("d") ? d : ("d" + d.replace(/\D+/g, "")));
  const roll = await (new Roll(formula)).evaluate({ async: true });
  return roll;
}

// Preferred metadata format (authorable flags)
function _bbttccReadItemMeta(item) {
  try {
    let cost = _bbttccGet(item, "flags.bbttcc.resourceCost", null);
    let pb   = _bbttccGet(item, "flags.bbttcc.pushback", null);
    let burn = _bbttccGet(item, "flags.bbttcc.burn", null);

    // Bridge for the Bad Eden Resource Action JSON Suite (2026-04-13).
    // Items in the new suite use a flat schema:
    //   flags.bbttcc = { resourceAction: true, engine, classId, pool, track, cost, opensDialog, ... }
    // Translate into the legacy resourceCost / burn / pushback shape that the
    // useItem hook below already understands. We only fill in fields the legacy
    // schema didn't already provide, so hand-authored flags still win.
    if (!cost && !pb && !burn && _bbttccGet(item, "flags.bbttcc.resourceAction", false) === true) {
      const f = item.flags?.bbttcc || {};
      const engine = String(f.engine || "").trim();
      const dice = Math.max(0, Math.floor(Number(f.cost || 0) || 0));
      if (engine === "dicePool" && f.pool && dice > 0) {
        cost = { pool: String(f.pool), dice, roll: true };
      } else if (engine === "stateTrack" && String(f.track || "") === "burn") {
        // Aurablade actions don't carry an explicit min/delta in the manifest,
        // so we just signal "this item touches burn" — text-inference fills in
        // specific min/delta/range values from the description.
        burn = burn || {};
      }
      // No standalone "track" engine entries in the manifest are actions today
      // (only display rows), so nothing to translate for engine === "track".
    }

    const meta = {};
    if (cost && typeof cost === "object") {
      meta.resourceCost = {
        pool: String(cost.pool || "").trim(),
        dice: Math.max(0, Math.floor(Number(cost.dice || 0) || 0)),
        roll: (cost.roll !== false)
      };
    }
    if (pb && typeof pb === "object") {
      meta.pushback = {
        track: String(pb.track || "").trim(),
        on: String(pb.on || "use").trim().toLowerCase(),
        amount: Math.floor(Number(pb.amount || 0) || 0)
      };
    }

    
if (burn && typeof burn === "object") {
  const b = {};
  if (burn.min != null) b.min = Math.max(0, Math.floor(Number(burn.min || 0) || 0));
  if (burn.delta != null) b.delta = Math.floor(Number(burn.delta || 0) || 0);
  if (burn.set != null) b.set = Math.max(0, Math.floor(Number(burn.set || 0) || 0));
  if (burn.lockTurns != null) b.lockTurns = Math.max(0, Math.floor(Number(burn.lockTurns || 0) || 0));
  if (burn.range && typeof burn.range === "object") {
    b.range = { min: Math.max(0, Math.floor(Number(burn.range.min || 0) || 0)), max: Math.max(0, Math.floor(Number(burn.range.max || 0) || 0)) };
  }
  if (burn.delayed && typeof burn.delayed === "object") {
    b.delayed = { rounds: Math.max(0, Math.floor(Number(burn.delayed.rounds || 0) || 0)), delta: Math.floor(Number(burn.delayed.delta || 0) || 0) };
  }
  if (burn.after && typeof burn.after === "object") {
    b.after = { when: String(burn.after.when || "endOfTurn"), set: Math.max(0, Math.floor(Number(burn.after.set || 0) || 0)) };
  }
  meta.burn = b;
}

    if (meta.resourceCost || meta.pushback || meta.burn) return meta;
  } catch {}
  return null;
}

// Heuristic legacy parsing fallback (kept intentionally narrow & safe)
function _bbttccInferItemMetaFromText(item) {
  try {
    const txt = _bbttccStripHtml(_bbttccGet(item, "system.description.value", "")) || "";
    if (!txt) return null;

    const pools = [
      { key: "access",  rx: /\baccess\s+dice?\b/i },
      { key: "civic",   rx: /\bcivic\s+charge\s+dice?\b/i },
      { key: "frame",   rx: /\bframe\s+die(?:s)?\b/i }
    ];
    const tracks = [
      { key: "trace",   rx: /\btrace\b/i },
      { key: "pressure",rx: /\bpressure\b/i },
      { key: "stress",  rx: /\bstructural\s+stress\b/i },
      { key: "burn",    rx: /\bburn\b/i }
    ];

    // Spend X <Pool> Dice
    let resourceCost = null;
    const spendMatch = txt.match(/\bspend\s+(\d+)\s+([a-z\s]+?)\s+(?:die|dice)\b/i);
    if (spendMatch) {
      const n = Math.max(0, Math.floor(Number(spendMatch[1] || 0) || 0));
      const name = String(spendMatch[2] || "");
      const p = pools.find(p => p.rx.test(name));
      if (p && n) resourceCost = { pool: p.key, dice: n, roll: true };
    }

    // Gain +X <Track> (very common phrasing: "Gain +1 Trace")
    let pushback = null;
    const gainMatch = txt.match(/\b(?:gain|add|adds)\s+\+?(\d+)\s+([a-z\s]+)\b/i);
    if (gainMatch) {
      const n = Math.floor(Number(gainMatch[1] || 0) || 0);
      const name = String(gainMatch[2] || "");
      const t = tracks.find(t => t.rx.test(name));
      if (t && n) pushback = { track: t.key, on: "use", amount: n };
    }

    if (!resourceCost && !pushback) return null;
    

// Burn (Aurablade special): Burn is both resource access + pushback.
// We infer:
// - burnReq: "Burn 3+" / "Burn 1–3"
// - burnSet: "enter Burn 4" / "Burn drops to 0"
// - burnDelta: "gain +1 Burn" (handled by pushback matcher as well, but we prefer explicit burn meta)
let burn = null;

// Requirement: Burn X+
const burnReqPlus = txt.match(/\bBurn\s+(\d+)\s*\+\b/i);
if (burnReqPlus) {
  burn = burn || {};
  burn.min = Math.max(0, Math.floor(Number(burnReqPlus[1] || 0) || 0));
}

// Requirement: Burn A–B / Burn A-B
const burnReqRange = txt.match(/\bBurn\s+(\d+)\s*[–\-]\s*(\d+)\b/i);
if (burnReqRange) {
  burn = burn || {};
  burn.range = {
    min: Math.max(0, Math.floor(Number(burnReqRange[1] || 0) || 0)),
    max: Math.max(0, Math.floor(Number(burnReqRange[2] || 0) || 0))
  };
}

// Set: "enter Burn X" / "immediately enter Burn X"
const burnEnter = txt.match(/\b(?:enter|entering)\s+Burn\s+(\d+)\b/i);
if (burnEnter) {
  burn = burn || {};
  burn.set = Math.max(0, Math.floor(Number(burnEnter[1] || 0) || 0));
}

// Set: "Burn drops to 0"
const burnDrop = txt.match(/\bBurn\s+drops\s+to\s+(\d+)\b/i);
if (burnDrop) {
  burn = burn || {};
  const v = Math.max(0, Math.floor(Number(burnDrop[1] || 0) || 0));

  // If the text also contains "enter Burn X" (e.g., Final Crescendo), treat drop as an end-of-turn aftermath.
  if (typeof burn.set === "number" && burn.set !== v) {
    burn.after = { when: "endOfTurn", set: v };
  } else {
    burn.set = v;
  }
}

// Freeze: "freeze your current Burn level ... until the start of your next turn"
if (/\bfreeze\s+your\s+current\s+Burn\s+level\b/i.test(txt) && /until\s+the\s+start\s+of\s+your\s+next\s+turn\b/i.test(txt)) {
  burn = burn || {};
  burn.lockTurns = 1;
}

// Delayed: "Burn drops to 0" + "gain 2 Burn at the end of next round"
const delayedBurn = txt.match(/\bgain\s+(\d+)\s+Burn\s+at\s+the\s+end\s+of\s+next\s+round\b/i);
if (delayedBurn) {
  burn = burn || {};
  burn.delayed = { rounds: 1, delta: Math.max(0, Math.floor(Number(delayedBurn[1] || 0) || 0)) };
}
return { resourceCost, pushback, burn };
  } catch {}
  return null;
}

function _bbttccGetActiveResourceSpec(actor) {
  // Return only the class resource specs that apply to this actor.
  const specs = [];
  for (const cls of BBTTCC_CLASS_RESOURCES) {
    if (!cls || !cls.classId) continue;
    if (!_bbttccHasClass(actor, cls.classId)) continue;

    const pools = (cls.pools || []).map(p => Object.assign({}, p, { classId: cls.classId }));
    const tracks = (cls.tracks || []).map(t => Object.assign({}, t, { classId: cls.classId }));
    specs.push({ classId: cls.classId, pools, tracks });
  }
  return specs;
}

function _bbttccRenderResourceCard(section, actor) {
  const specs = _bbttccGetActiveResourceSpec(actor);
  if (!specs.length) return;

  // Build HTML
  const wrap = document.createElement("div");
  wrap.className = "bbttcc-card bbttcc-resource-card";
  wrap.innerHTML = `
    <div class="bbttcc-card-header">
      <div class="bbttcc-card-title">Class Resources</div>
      <div class="bbttcc-card-subtitle">Dice pools + pushback tracks</div>
    </div>
    <div class="bbttcc-card-body" data-bbttcc-resources="1"></div>
  `;

  const body = wrap.querySelector("[data-bbttcc-resources='1']");
  const rows = [];

  for (const cls of specs) {
    for (const p of (cls.pools || [])) {
      const st = _bbttccPoolState(actor, p);
      rows.push(`
        <div class="bbttcc-resource-row" data-bbttcc-pool="${st.key}">
          <div class="bbttcc-resource-main">
            <div class="bbttcc-resource-name">${st.label}</div>
            <div class="bbttcc-resource-meta">Die: <b>${st.die}</b> • Dice: <b>${st.dice}</b>/<b>${st.maxDice}</b></div>
          </div>
          <div class="bbttcc-resource-actions">
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="pool-gain" data-pool="${st.key}">+ Gain</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="pool-spend" data-pool="${st.key}">– Spend</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="pool-spendroll" data-pool="${st.key}">Spend &amp; Roll</button>
          </div>
        </div>
      `);
    }
    for (const t of (cls.tracks || [])) {
      const st = _bbttccTrackState(actor, t);
      rows.push(`
        <div class="bbttcc-resource-row" data-bbttcc-track="${st.key}">
          <div class="bbttcc-resource-main">
            <div class="bbttcc-resource-name">${st.label}</div>
            <div class="bbttcc-resource-meta">Value: <b>${st.value}</b>${st.bandLabel ? ` • <span class="bbttcc-chip">${st.bandLabel}</span>` : ""}</div>
          </div>
          <div class="bbttcc-resource-actions">
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="track-add" data-track="${st.key}">+1</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="track-sub" data-track="${st.key}">-1</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="track-clear" data-track="${st.key}">Clear</button>
          </div>
        </div>
      `);
    }
  }

  // Aurablade current-aura indicator. Shown only for actors that have the
  // class. Pure display — aura state changes come from the Change Aura dialog.
  if (_bbttccHasClass(actor, "aurablade")) {
    const cur = String(actor.getFlag?.(MOD, "aurablade.currentAura") || "") || "";
    const curLabel = BBTTCC_AURA_LABELS[cur] || "None";
    rows.push(`
      <div class="bbttcc-resource-row" data-bbttcc-aura="1">
        <div class="bbttcc-resource-main">
          <div class="bbttcc-resource-name">Current Aura</div>
          <div class="bbttcc-resource-meta"><span class="bbttcc-chip bbttcc-aura-chip" data-aura="${foundry.utils.escapeHTML(cur)}">${foundry.utils.escapeHTML(curLabel)}</span></div>
        </div>
      </div>
    `);
  }

  body.innerHTML = rows.join("");

  // Insert near top of Bad Eden tab body (after existing action bar if present)
  const target = section.querySelector(".bbttcc-card")?.parentElement || section;
  target.appendChild(wrap);
}

/**
 * Mount the Class Resources card into the dnd5e v5 sidebar (right under the
 * existing HP / Hit Dice / Favorites cards). Idempotent — safe to call on
 * every render; a stale card is removed first.
 *
 * Renders nothing for actors that don't have any of our supported classes,
 * so the sidebar stays clean for normal characters.
 */
function _bbttccMountSidebarResourceCard(app, root) {
  try {
    const actor = app?.actor ?? app?.object;
    if (!actor || !root) return;

    // Bail early if no relevant class — keeps the sidebar uncluttered for
    // characters that don't use any Bad Eden class resource pools.
    if (!_bbttccGetActiveResourceSpec(actor).length) {
      // Clean up any leftover card from a previous class swap.
      root.querySelectorAll(".bbttcc-resource-card").forEach(el => el.remove());
      return;
    }

    const sidebar = _findQuickbarMount(root);
    if (!sidebar) return;

    // Remove any prior render so we don't stack duplicates across re-renders.
    sidebar.querySelectorAll(".bbttcc-resource-card").forEach(el => el.remove());

    _bbttccRenderResourceCard(sidebar, actor);
    _bbttccWireResourceCardEvents(app, sidebar);

    // Make sure the dnd5e.preUseActivity hook is installed so action items
    // route through Bad Eden dialogs (titanbound_frame, aurablade_burn, etc).
    _bbttccInstallUseItemHookOnce();
    // Combat-tick processing for Burn timers / lock expiry (Aurablade).
    _bbttccInstallBurnTimerHookOnce();
    // Damage → pool auto-accrual (Titanbound Frame Die, etc.)
    _bbttccInstallAutoAccrualHookOnce();
  } catch (e) {
    WARN("Failed to mount sidebar resource card", e);
  }
}

function _bbttccFindPoolSpec(actor, poolKey) {
  const specs = _bbttccGetActiveResourceSpec(actor);
  for (const cls of specs) {
    for (const p of (cls.pools || [])) if (String(p.key) === String(poolKey)) return p;
  }
  return null;
}
function _bbttccFindTrackSpec(actor, trackKey) {
  const specs = _bbttccGetActiveResourceSpec(actor);
  for (const cls of specs) {
    for (const t of (cls.tracks || [])) if (String(t.key) === String(trackKey)) return t;
  }
  return null;
}

function _bbttccWireResourceCardEvents(app, section) {
  const actor = app?.actor ?? app?.object;
  if (!actor) return;

  const root = section.querySelector(".bbttcc-resource-card");
  if (!root) return;

  const bind = (sel, fn) => {
    const els = root.querySelectorAll(sel);
    els.forEach(el => el.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try { await fn(ev); app.render(false); } catch (e) { WARN("Resource action failed", e); }
    }));
  };

  bind("[data-bbttcc-action='pool-gain']", async (ev) => {
    const key = String(ev.currentTarget.dataset.pool || "");
    const spec = _bbttccFindPoolSpec(actor, key);
    if (!spec) return;
    await _bbttccGainPoolDice(actor, spec, 1);
  });

  bind("[data-bbttcc-action='pool-spend']", async (ev) => {
    const key = String(ev.currentTarget.dataset.pool || "");
    const spec = _bbttccFindPoolSpec(actor, key);
    if (!spec) return;
    await _bbttccSpendPoolDice(actor, spec, 1);
  });

  bind("[data-bbttcc-action='pool-spendroll']", async (ev) => {
    const key = String(ev.currentTarget.dataset.pool || "");
    const spec = _bbttccFindPoolSpec(actor, key);
    if (!spec) return;
    const st = await _bbttccSpendPoolDice(actor, spec, 1);
    if (!st) return;
    const roll = await _bbttccRollDie(st.die);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flavor: `${st.label} — Spend & Roll (${st.die})`
    });
  });

  bind("[data-bbttcc-action='track-add']", async (ev) => {
    const key = String(ev.currentTarget.dataset.track || "");
    const spec = _bbttccFindTrackSpec(actor, key);
    if (!spec) return;
    await _bbttccAdjustTrack(actor, spec, +1);
  });

  bind("[data-bbttcc-action='track-sub']", async (ev) => {
    const key = String(ev.currentTarget.dataset.track || "");
    const spec = _bbttccFindTrackSpec(actor, key);
    if (!spec) return;
    await _bbttccAdjustTrack(actor, spec, -1);
  });

  bind("[data-bbttcc-action='track-clear']", async (ev) => {
    const key = String(ev.currentTarget.dataset.track || "");
    const spec = _bbttccFindTrackSpec(actor, key);
    if (!spec) return;
    const patch = { tracks: { [key]: { value: 0, ts: Date.now() } } };
    await _bbttccSetActorResources(actor, patch);
  });
}

// Option C: Hook native item use and auto-spend/roll/tick.
/**
 * Open the Bad Eden action dialog for an item. Returns the picked option id, or
 * null if the user cancelled. Handles pool gating (not enough dice → warn +
 * bail), commits the pool spend on pick (not on open), optionally rolls the
 * pool die, and posts a chat card describing the chosen effect.
 *
 * Safe to call even if the item has no registered dialog — returns null.
 */
async function _bbttccOpenActionDialog(actor, item, dialogKey) {
  const spec = BBTTCC_ACTION_DIALOGS[dialogKey];
  if (!spec) return null;

  const flags = item?.flags?.bbttcc || {};
  const cost = Math.max(0, Math.floor(Number(flags.cost || 0) || 0));
  const poolKey = String(flags.pool || "");
  let poolSpec = null;
  let poolState = null;
  if (cost > 0 && poolKey) {
    poolSpec = _bbttccFindPoolSpec(actor, poolKey);
    if (poolSpec) poolState = _bbttccPoolState(actor, poolSpec);
    if (poolSpec && poolState && poolState.dice < cost) {
      ui.notifications?.warn?.(`${poolState.label}: not enough dice (${poolState.dice}/${poolState.maxDice}).`);
      return null;
    }
  }

  const escape = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const poolLine = poolState
    ? `<div class="bbttcc-dialog-pool">Pool: <b>${escape(poolState.label)}</b> — ${poolState.dice}/${poolState.maxDice} (${escape(poolState.die)})</div>`
    : "";

  const buttonsHtml = spec.options.map(o => `
    <button type="button" class="bbttcc-dialog-option" data-opt="${escape(o.id)}">
      <div class="bbttcc-dialog-option-head">
        ${o.icon ? `<i class="${escape(o.icon)}"></i> ` : ""}<strong>${escape(o.label)}</strong>
      </div>
      ${o.hint ? `<div class="bbttcc-dialog-option-hint">${escape(o.hint)}</div>` : ""}
    </button>
  `).join("");

  const content = `
    <div class="bbttcc-action-dialog">
      ${spec.blurb ? `<p class="bbttcc-dialog-blurb">${escape(spec.blurb)}</p>` : ""}
      ${poolLine}
      <div class="bbttcc-dialog-options">${buttonsHtml}</div>
    </div>
  `;

  const choice = await new Promise((resolve) => {
    let settled = false;
    const finalize = (v) => { if (!settled) { settled = true; resolve(v); } };
    const dlg = new Dialog({
      title: spec.title,
      content,
      buttons: { cancel: { label: "Cancel", callback: () => finalize(null) } },
      default: "cancel",
      close: () => finalize(null),
      render: (html) => {
        const root = html instanceof jQuery ? html[0] : html;
        if (!root) return;
        root.querySelectorAll(".bbttcc-dialog-option").forEach(btn => {
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            const optId = String(ev.currentTarget.dataset.opt || "");
            finalize(optId);
            try { dlg.close(); } catch {/* ignore */}
          });
        });
      }
    }, { classes: ["bbttcc-dialog"] });
    dlg.render(true);
  });

  if (!choice) return null;
  const option = spec.options.find(o => o.id === choice);
  if (!option) return null;

  await _bbttccExecuteDialogOption(actor, item, spec, option, poolSpec);
  return option.id;
}

/**
 * Apply the mechanical + narrative effects of a chosen dialog option, post
 * the chat card, and commit any pool spend / state change. Split out of
 * _bbttccOpenActionDialog for readability.
 */
async function _bbttccExecuteDialogOption(actor, item, spec, option, poolSpec) {
  let dieRoll = null;
  let rolledDie = null;

  // Commit pool spend (and optionally roll)
  if (poolSpec) {
    const after = await _bbttccSpendPoolDice(actor, poolSpec, 1);
    if (after && option.roll) {
      dieRoll = await _bbttccRollDie(after.die);
      rolledDie = after.die;
    }
  }

  // State-track mutations (aurablade)
  if (option.setAura) {
    try { await actor.setFlag(MOD, "aurablade.currentAura", String(option.setAura)); }
    catch (e) { WARN("Failed to set aura flag", e); }
  }
  if (typeof option.burnDelta === "number" && option.burnDelta) {
    const burnSpec = _bbttccFindTrackSpec(actor, "burn");
    if (burnSpec) await _bbttccAdjustTrack(actor, burnSpec, Math.floor(option.burnDelta));
  }
  if (typeof option.burnSet === "number") {
    try { await _bbttccSetBurn(actor, Math.max(0, Math.floor(option.burnSet))); }
    catch (e) { WARN("Failed to set burn", e); }
  }

  // Aurablade Burn gain: +N Burn, respecting the class's explicit
  // "max 1 Burn per round" rule. Tracked via a per-actor flag keyed on the
  // current combat round; out-of-combat rounds don't block.
  if (typeof option.burnGain === "number" && option.burnGain > 0) {
    const round = _bbttccCurrentCombatRound();
    const lastRound = Number(actor?.getFlag?.(MOD, "aurablade.lastBurnGainRound") ?? NaN);
    const blocked = round != null && Number.isFinite(lastRound) && lastRound === round;
    if (blocked) {
      ui.notifications?.warn?.("Burn already gained this round (max 1/round).");
    } else {
      const burnSpec = _bbttccFindTrackSpec(actor, "burn");
      if (burnSpec) {
        await _bbttccAdjustTrack(actor, burnSpec, Math.max(1, Math.floor(option.burnGain)));
        if (round != null) {
          try { await actor.setFlag(MOD, "aurablade.lastBurnGainRound", round); }
          catch (e) { WARN("Failed to store lastBurnGainRound", e); }
        }
      }
    }
  }

  // Administrative Pressure mutations (pactkeeper — Invoke Precedent COOLS).
  if (typeof option.pressureDelta === "number" && option.pressureDelta) {
    const pressureSpec = _bbttccFindTrackSpec(actor, "pressure");
    if (pressureSpec) {
      await _bbttccAdjustTrack(actor, pressureSpec, Math.floor(option.pressureDelta));
    }
  }

  // Build narrative with optional {{var}} substitutions
  let narrative = option.narrative || option.flavor || "";
  if (narrative && typeof option.narrativeVars === "function") {
    try {
      const vars = option.narrativeVars(actor) || {};
      narrative = String(narrative).replace(/\{\{(\w+)\}\}/g, (_, k) =>
        vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : "");
    } catch (e) { WARN("narrativeVars failed", e); }
  }

  // Post chat card. If we rolled, use the Roll's native chat (includes the
  // dice animation) with our flavor. Otherwise build a plain ChatMessage.
  const title = `<strong>${item?.name ?? "Bad Eden"}</strong> — ${option.label}`;
  if (dieRoll) {
    const flavor = narrative
      ? `${title}<br/><em>${narrative}</em>`
      : title;
    await dieRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor
    }, { __bbttccSkipResources: true });
  } else {
    const body = `
      <div class="bbttcc-action-result">
        <div class="bbttcc-action-title">${title}</div>
        ${narrative ? `<div class="bbttcc-action-narrative">${narrative}</div>` : ""}
      </div>
    `;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: body,
      flags: { [MOD]: { bbttccAction: true } }
    });
  }
}

/**
 * Install the auto-accrual hook (once per session). For classes with a
 * quantifiable trigger for pool gain we listen to HP/state changes and credit
 * the pool automatically, respecting the pool's `limitPerRound`.
 *
 * Current triggers:
 *   - Titanbound: take damage > proficiency bonus in a single hit → +1 Frame Die
 */
function _bbttccInstallAutoAccrualHookOnce() {
  const KEY = "__bbttcc_auto_accrual_hook_v1";
  if (globalThis[KEY]) return;
  globalThis[KEY] = true;

  // preUpdateActor: detect HP drop and stash the delta for the post hook.
  Hooks.on("preUpdateActor", (actor, changes, options /* , userId */) => {
    try {
      const oldHp = actor?.system?.attributes?.hp?.value;
      const newHp = foundry.utils.getProperty(changes, "system.attributes.hp.value");
      if (typeof oldHp !== "number" || typeof newHp !== "number") return;
      const damage = oldHp - newHp;
      if (damage > 0) options.__bbttccHpDrop = damage;
    } catch {/* ignore */}
  });

  // updateActor: apply class-specific auto-accrual rules. Gate by userId so
  // only the client issuing the update runs the follow-up write.
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    try {
      const damage = Number(options?.__bbttccHpDrop || 0) || 0;
      if (damage <= 0) return;
      if (game.user?.id !== userId) return;
      if (!actor || !(actor instanceof Actor)) return;
      if (actor.getFlag?.("bbttcc-factions", "isFaction")) return;

      // Titanbound: damage > prof → +1 Frame Die (pool's own limitPerRound
      // check inside _bbttccGainPoolDice prevents double-dipping per round).
      if (_bbttccHasClass(actor, "titanbound")) {
        const prof = Number(actor?.system?.attributes?.prof || 0) || 0;
        if (damage > prof) {
          const poolSpec = _bbttccFindPoolSpec(actor, "frame");
          if (poolSpec) {
            const before = _bbttccPoolState(actor, poolSpec);
            if (before.dice < before.maxDice) {
              const round = _bbttccCurrentCombatRound();
              const lastR = Number(before.lastGain?.combatRound ?? null);
              const blocked = before.limitPerRound > 0 && round != null
                && Number.isFinite(lastR) && lastR === round;
              if (!blocked) {
                await _bbttccGainPoolDice(actor, poolSpec, 1);
                await ChatMessage.create({
                  speaker: ChatMessage.getSpeaker({ actor }),
                  content: `<p><strong>${actor.name}</strong> — Titanbound absorbs <b>${damage}</b> damage (exceeds prof ${prof}). <strong>+1 Frame Die</strong>.</p>`,
                  flags: { [MOD]: { bbttccAction: true } }
                });
              }
            }
          }
        }
      }
    } catch (e) {
      WARN("Auto-accrual hook failed", e);
    }
  });
}

function _bbttccInstallUseItemHookOnce() {
  const KEY = "__bbttcc_class_resources_useItemHook_v1";
  if (globalThis[KEY]) return;

  // dnd5e v5+ replaced the `dnd5e.useItem` hook with the activity-based
  // `dnd5e.preUseActivity` hook. We listen on the new hook synchronously so
  // we can return `false` to cancel the native usage flow when our dialog
  // takes over. The legacy meta-based spend logic runs fire-and-forget after
  // the hook returns (only for items that do NOT open a Bad Eden dialog).
  Hooks.on("dnd5e.preUseActivity", (activity, usageConfig /* , dialogConfig, messageConfig */) => {
    try {
      const item = activity?.item;
      if (!item) return;
      // Guard against re-entry from Bad Eden's own chat-card path
      if (usageConfig && usageConfig.__bbttccSkipResources) return;

      const actor = item.parent;
      if (!actor || !(actor instanceof Actor)) return;
      if (actor.getFlag?.("bbttcc-factions", "isFaction")) return;

      // Only process actors that have one of our supported class specs
      const specs = _bbttccGetActiveResourceSpec(actor);
      if (!specs.length) return;

      // Dialog short-circuit (synchronous return false to cancel the native
      // activity flow; dialog opens async and handles its own spend+roll+chat).
      const opensDialog = String(item?.flags?.bbttcc?.opensDialog || "");
      if (opensDialog && BBTTCC_ACTION_DIALOGS[opensDialog]) {
        _bbttccOpenActionDialog(actor, item, opensDialog)
          .catch(e => WARN("Bad Eden dialog failed", e));
        return false; // cancel the native dnd5e activity use
      }

      // Legacy / non-dialog items: spend + pushback + burn run async after
      // the native flow continues. Fire-and-forget.
      _bbttccLegacyUseItemHandler(actor, item).catch(e => WARN("Legacy use handler failed", e));
      // Return undefined → native dnd5e flow continues (chat card, etc.)
    } catch (e) {
      WARN("preUseActivity hook failed", e);
    }
  });

  globalThis[KEY] = true;
}

/**
 * Legacy item-use handler — preserves the pre-dialog spend/pushback/burn
 * behavior for items that have Bad Eden flags but no `opensDialog`. Runs as a
 * fire-and-forget side effect; the native dnd5e activity flow continues
 * normally and posts its own chat card.
 *
 * (All current Resource Action Suite items have `opensDialog` set, so this
 * function is exercised only by hand-authored or older items.)
 */
async function _bbttccLegacyUseItemHandler(actor, item) {
      // Determine meta (flags preferred; heuristic fallback allowed)
      const meta = _bbttccReadItemMeta(item) || _bbttccInferItemMetaFromText(item);
      if (!meta || (!meta.resourceCost && !meta.pushback && !meta.burn)) return;

      // If pushback is conditional on success/fail we can’t reliably know here for all item types,
      // so v1 supports: on="use" only (others are ignored until we have a consistent result hook).
      const pb = meta.pushback;
      if (pb && pb.on && pb.on !== "use") {
        // ignore non-use in v1 (safe)
      }

      // Spend + Roll
      let spendRoll = null;

      if (meta.resourceCost) {
        const poolKey = String(meta.resourceCost.pool || "");
        const poolSpec = _bbttccFindPoolSpec(actor, poolKey);
        if (!poolSpec) return;

        // Ensure die/max are current (state computation does this)
        const st = _bbttccPoolState(actor, poolSpec);
        const n = Math.max(0, Math.floor(Number(meta.resourceCost.dice || 0) || 0));
        if (n <= 0) return;

        if (st.dice < n) {
          ui.notifications?.warn?.(`${st.label}: not enough dice to use ${item.name}.`);
          return;
        }

        const afterSpend = await _bbttccSpendPoolDice(actor, poolSpec, n);
        if (meta.resourceCost.roll !== false) {
          spendRoll = await _bbttccRollDie(afterSpend.die);
          // Post a clean Bad Eden message (small + readable), *in addition* to the native dnd5e card.
          await spendRoll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: actor }),
            flavor: `${item.name} — spent ${n} ${afterSpend.label} (${afterSpend.die})`
          }, { __bbttccSkipResources: true });
        }
      }

      // Pushback tick
      if (pb && pb.amount) {
        const trackKey = String(pb.track || "");
        const trackSpec = _bbttccFindTrackSpec(actor, trackKey);
        if (trackSpec) {
          await _bbttccAdjustTrack(actor, trackSpec, pb.amount);
        }
      }



// Aurablade Burn (Burn = resource access + pushback)
if (meta.burn) {
  const burnSpec = _bbttccFindTrackSpec(actor, "burn");
  if (burnSpec) {
    const burnState = _bbttccTrackState(actor, burnSpec);
    const burnVal = burnState.value;

    // Gate warnings (we cannot reliably cancel the native item workflow here, so we warn loudly)
    if (typeof meta.burn.min === "number" && burnVal < meta.burn.min) {
      ui?.notifications?.warn?.(`${item.name}: requires Burn ${meta.burn.min}+ (current ${burnVal}).`);
    }
    if (meta.burn.range && typeof meta.burn.range.min === "number" && typeof meta.burn.range.max === "number") {
      const a = meta.burn.range.min, b = meta.burn.range.max;
      if (burnVal < a || burnVal > b) ui?.notifications?.warn?.(`${item.name}: requires Burn ${a}–${b} (current ${burnVal}).`);
    }

    // Respect temporary Burn lock (e.g., Emotional Lock)
    const lock = _bbttccGet(burnState, "meta.lock", null);
    const isLocked = lock && lock.combatId && game?.combat && lock.combatId === game.combat.id
      && typeof lock.untilRound === "number" && typeof lock.untilTurn === "number"
      && (game.combat.round < lock.untilRound || (game.combat.round === lock.untilRound && game.combat.turn < lock.untilTurn));

    if (!isLocked) {
      // Apply Burn set/delta
      if (typeof meta.burn.set === "number") {
        await _bbttccSetBurn(actor, meta.burn.set);
      } else if (typeof meta.burn.delta === "number" && meta.burn.delta) {
        await _bbttccAdjustTrack(actor, burnSpec, Math.floor(Number(meta.burn.delta || 0) || 0));
      } else if (meta.pushback && meta.pushback.track === "burn" && meta.pushback.amount) {
        // already handled by pushback tick above
      }

      // Apply 1-turn lock if requested
      if (meta.burn.lockTurns && game?.combat) {
        await _bbttccLockBurn(actor, meta.burn.lockTurns);
      }

      

// End-of-turn aftermath (e.g., Final Crescendo: enter Burn 4, then Burn drops to 0)
if (meta.burn.after && meta.burn.after.when === "endOfTurn" && typeof meta.burn.after.set === "number" && game?.combat) {
  await _bbttccScheduleBurnSetEndOfTurn(actor, meta.burn.after.set);
}
// Schedule delayed Burn delta
      if (meta.burn.delayed && game?.combat) {
        const d = meta.burn.delayed;
        await _bbttccScheduleBurnDelta(actor, d.rounds || 1, d.delta || 0);
      }
    } else {
      ui?.notifications?.info?.(`${item.name}: Burn is currently locked and cannot be changed until next turn.`);
    }
  }
}
}

/**
 * Install the combat-tick hook that processes scheduled Burn timers and
 * Burn-lock expiry for Aurablade. Once-per-session.
 */
function _bbttccInstallBurnTimerHookOnce() {
  const KEY = "__bbttcc_burn_timer_hook_v1";
  if (globalThis[KEY]) return;
  globalThis[KEY] = true;

  Hooks.on("updateCombat", async (combat, changed) => {
    try {
      if (!combat || !("round" in changed || "turn" in changed)) return;
      // Only relevant in an active combat
      const r = Number(combat.round || 0) || 0;
      const t = Number(combat.turn || 0) || 0;

      for (const c of (combat.combatants || [])) {
        const a = c?.actor;
        if (!a) continue;
        const burnSpec = _bbttccFindTrackSpec(a, "burn");
        if (!burnSpec) continue;

        const res = _bbttccActorResources(a);
        const cur = res.tracks?.burn && typeof res.tracks.burn === "object" ? _bbttccClone(res.tracks.burn) : null;
        if (!cur) continue;
        const meta = cur.meta && typeof cur.meta === "object" ? _bbttccClone(cur.meta) : {};
        const timers = Array.isArray(meta.timers) ? meta.timers.slice() : [];
        if (!timers.length && !meta.lock) continue;

        let did = false;
        const remaining = [];
        for (const tm of timers) {
          if (!tm || tm.combatId !== combat.id) { remaining.push(tm); continue; }
          if (Number(tm.atRound || 0) === r && Number(tm.atTurn || 0) === t) {
            if (tm.type === "delta" && tm.delta) {
              await _bbttccAdjustTrack(a, burnSpec, Math.floor(Number(tm.delta || 0) || 0));
              did = true;
            } else if (tm.type === "set" && typeof tm.set === "number") {
              await _bbttccSetBurn(a, tm.set);
              did = true;
            }
          } else {
            remaining.push(tm);
          }
        }
        meta.timers = remaining;

        // Lock expiry
        if (meta.lock && meta.lock.combatId === combat.id) {
          const untilR = Number(meta.lock.untilRound || 0) || 0;
          const untilT = Number(meta.lock.untilTurn || 0) || 0;
          if (r > untilR || (r === untilR && t >= untilT)) {
            delete meta.lock;
            did = true;
          }
        }

        if (did) {
          const nextVal = Math.max(0, Math.floor(Number((a.getFlag?.(BBTTCC_RESOURCES_SCOPE, BBTTCC_RESOURCES_KEY)?.tracks?.burn?.value) || cur.value || 0) || 0));
          await _bbttccSetActorResources(a, { tracks: { burn: { value: nextVal, ts: Date.now(), meta } } });
        }
      }
    } catch (e) { WARN("Bad Eden Burn timers failed", e); }
  });

  LOG("Bad Eden class resources: hooks installed (preUseActivity + Burn timer)");
}
/* ---------------------------------------
 * Pack & category mappings for identity families
 * ------------------------------------ */

const PACK_KEYS = {
  archetype:   "bbttcc-character-options.character-archetypes",
  crew:        "bbttcc-character-options.crew-types",
  sephirot:    "bbttcc-character-options.sephirothic-alignments",
  // political philosophy uses AAE canon registry (flags), not a pack
  occult:      "bbttcc-character-options.occult-associations",
  ancestry:    "bbttcc-master-content.ancestries"
};
/* ---------------------------------------
 * AAE Political Philosophy (Canon) — v1
 * Stored on actor: actor.getFlag(AAE_SCOPE, "politicalPhilosophy")
 * ------------------------------------ */

const AAE_POLITICAL_PHILOSOPHIES = [
  {
    key: "marxist",
    label: "Marxist / Communist",
    happiness: "Collective emancipation; non-alienated work",
    suffering: "Exploitation and alienation"
  },
  {
    key: "liberal",
    label: "Liberal",
    happiness: "Protected rights; consent and autonomy",
    suffering: "Rights violations and coercion"
  },
  {
    key: "social_democratic",
    label: "Social Democratic",
    happiness: "Dignity through welfare and harm reduction",
    suffering: "Preventable poverty and neglect"
  },
  {
    key: "libertarian",
    label: "Libertarian",
    happiness: "Voluntary exchange; minimal coercion",
    suffering: "Interference and forced compliance"
  },
  {
    key: "authoritarian",
    label: "Authoritarian / Statist",
    happiness: "Order, safety, and predictability",
    suffering: "Chaos and fragmentation"
  },
  {
    key: "theocratic",
    label: "Theocratic",
    happiness: "Alignment with sacred moral order",
    suffering: "Corruption, heresy, profanation"
  },
  {
    key: "fascist",
    label: "Fascist",
    happiness: "Mythic unity, strength, dominance",
    suffering: "Weakness, dissent, pluralism"
  },
  {
    key: "anarchist",
    label: "Anarchist",
    happiness: "Mutual aid; no imposed hierarchy",
    suffering: "Domination and coercive authority"
  }
];

function listPoliticalPhilosophyOptions() {
  return AAE_POLITICAL_PHILOSOPHIES.map(p => ({ id: p.key, name: p.label }));
}

function getPoliticalPhilosophyDef(key) {
  return AAE_POLITICAL_PHILOSOPHIES.find(p => p.key === String(key)) ?? null;
}

function labelForPoliticalPhilosophy(key) {
  return getPoliticalPhilosophyDef(key)?.label ?? "—";
}


const IDENTITY_SLOTS = {
  archetype: {
    pack: PACK_KEYS.archetype,
    categories: ["character-archetypes", "archetype", "archetypes", "bbttcc-archetype"]
  },
  crew: {
    pack: PACK_KEYS.crew,
    categories: ["crew-types", "crew", "crews", "bbttcc-crew"]
  },
  occult: {
    pack: PACK_KEYS.occult,
    categories: ["occult-associations", "occult", "bbttcc-occult"]
  },
  political: {
    pack: null,
    categories: ["political-philosophy", "political", "politics", "bbttcc-political"]
  },
  sephirothicAlignment: {
    pack: PACK_KEYS.sephirot,
    categories: ["sephirothic-alignments", "alignment", "alignments", "bbttcc-alignment"]
  },
  ancestry: {
    pack: PACK_KEYS.ancestry,
    categories: ["ancestries", "ancestry", "species", "bbttcc-ancestry"],
    // 2026-05-15 — Ancestry items are dnd5e/fourththing `species` type, not feat.
    // indexPack accepts this via the extraTypes hint below.
    extraTypes: ["species"]
  }
};

async function indexPack(key, extraTypes) {
  const pack = game.packs.get(key);
  if (!pack) return [];
  const idx = await pack.getIndex({ fields: ["name", "type"] });

  const allow = new Set(["feat", "feat5e", "featv2", "featV2", "feat-5e"]);
  if (Array.isArray(extraTypes)) {
    for (const t of extraTypes) if (t) allow.add(String(t));
  }

  const rows = idx.filter(e => allow.has(e.type));

  rows.sort((A, B) => A.name.localeCompare(B.name));
  return rows.map(({ _id, name }) => ({ id: _id, name }));
}

async function buildIdentityOptions() {
  const [archetypeAll, crewAll, sephirot, politicalAll, occultAll, ancestryAll] = await Promise.all([
    indexPack(PACK_KEYS.archetype),
    indexPack(PACK_KEYS.crew),
    indexPack(PACK_KEYS.sephirot),
    Promise.resolve(listPoliticalPhilosophyOptions()),
    indexPack(PACK_KEYS.occult),
    indexPack(PACK_KEYS.ancestry, IDENTITY_SLOTS.ancestry?.extraTypes)
  ]);

  // Helper: true if a name looks like a tiered option, e.g. "(Tier 2)"
  const isTierName = (entry) => {
    const name = String(entry?.name || "").trim();
    return /(?:\(\s*Tier\s+\d+\s*\)|[—-]\s*Tier\s+\d+)$/i.test(name);
  };

  // Only show BASE archetype items in the dropdown, e.g. "Archetype: Warlord"
  const archetypeBase = archetypeAll.filter(entry => !isTierName(entry));

  // Only show BASE crew types (no "(Tier X)" entries)
  const crewBase = crewAll.filter(entry => !isTierName(entry));

  // Future-proof: only base occult / political entries once tiers exist for them
  const politicalBase = politicalAll.filter(entry => !isTierName(entry));
  const occultBase    = occultAll.filter(entry => !isTierName(entry));

  return {
    archetype: {
      pack: PACK_KEYS.archetype,
      list: archetypeBase
    },
    crew: {
      pack: PACK_KEYS.crew,
      list: crewBase
    },
    sephirothicAlignment: {
      pack: PACK_KEYS.sephirot,
      list: sephirot
    },
    political: {
      pack: null,
      list: politicalBase
    },
    occult: {
      pack: PACK_KEYS.occult,
      list: occultBase
    },
    ancestry: {
      pack: PACK_KEYS.ancestry,
      list: ancestryAll.filter(entry => !isTierName(entry))
    }
  };
}

/* ---------------------------------------
 * Locate base 5E character & NPC sheets
 * ------------------------------------ */

function findBaseCharacterSheet() {
  try {
    const charSheets = CONFIG?.Actor?.sheetClasses?.character;
    if (!charSheets) return null;

    for (const [id, entry] of Object.entries(charSheets)) {
      if (entry?.cls && entry.default) return { id, cls: entry.cls };
    }

    for (const [id, entry] of Object.entries(charSheets)) {
      if (!entry?.cls) continue;
      const name = entry.cls.name || "";
      if (id.includes("dnd5e") || id.includes("CharacterActorSheet") || name.includes("CharacterActorSheet")) {
        return { id, cls: entry.cls };
      }
    }

    const [firstId, firstEntry] = Object.entries(charSheets)[0] || [];
    if (firstId && firstEntry?.cls) return { id: firstId, cls: firstEntry.cls };

    return null;
  } catch (err) {
    WARN("Error while locating base character sheet", err);
    return null;
  }
}

function findBaseNPCSheet() {
  try {
    const npcSheets = CONFIG?.Actor?.sheetClasses?.npc;
    if (!npcSheets) return null;

    for (const [id, entry] of Object.entries(npcSheets)) {
      if (entry?.cls && entry.default) return { id, cls: entry.cls };
    }

    for (const [id, entry] of Object.entries(npcSheets)) {
      if (!entry?.cls) continue;
      const name = entry.cls.name || "";
      if (id.includes("dnd5e") || id.toLowerCase().includes("npc") || name.toLowerCase().includes("npc")) {
        return { id: id, cls: entry.cls };
      }
    }

    const [firstId, firstEntry] = Object.entries(npcSheets)[0] || [];
    if (firstId && firstEntry?.cls) return { id: firstId, cls: firstEntry.cls };

    return null;
  } catch (err) {
    WARN("Error while locating base NPC sheet", err);
    return null;
  }
}



/* ---------------------------------------
 * Native Bad Eden quick controls helpers
 * ------------------------------------ */

async function openBBTTCCIdentityChooser(actor, app, slotKey) {
  const options = await buildIdentityOptions();
  const map = {
    archetype: { label: "Archetype", list: options.archetype.list },
    crew: { label: "Crew Type", list: options.crew.list },
    occult: { label: "Occult Association", list: options.occult.list },
    sephirothicAlignment: { label: "Sephirotic Alignment", list: options.sephirothicAlignment.list },
    political: { label: "Political Philosophy", list: options.political.list },
    ancestry: { label: "Ancestry", list: options.ancestry.list }
  };
  const cfg = map[slotKey];
  if (!cfg) return;

  // Determine current value so the dropdown can reflect it on open.
  let currentValue = "";
  if (slotKey === "political") {
    currentValue = String(actor.getFlag(AAE_SCOPE, "politicalPhilosophy") ?? "") || "";
  } else {
    const curFlags = await getIdentityFlagsSafe(actor);
    currentValue = String(curFlags?.[slotKey]?.key ?? curFlags?.[slotKey]?.id ?? "") || "";
  }

  const selectHtml = `
    <div class="bbttcc-field">
      <label>${cfg.label}</label>
      <select id="bbttcc-native-chooser">
        <option value=""${currentValue ? "" : " selected"}>—</option>
        ${cfg.list.map(o => `<option value="${o.id}"${o.id === currentValue ? " selected" : ""}>${foundry.utils.escapeHTML(o.name)}</option>`).join("")}
      </select>
    </div>
  `;

  const selected = await Dialog.wait({
    title: `Set ${cfg.label}`,
    content: selectHtml,
    buttons: {
      cancel: { label: "Cancel", callback: () => null },
      apply: {
        label: "Apply",
        callback: (html) => (html instanceof HTMLElement ? html : html[0])?.querySelector("#bbttcc-native-chooser")?.value || null
      }
    },
    default: "apply"
  });

  if (!selected) return;

  if (slotKey === "political") {
    await actor.setFlag(AAE_SCOPE, "politicalPhilosophy", selected || null);
  } else {
    const patch = await applyIdentitySlotChange(actor, slotKey, selected);
    const idApi = game.bbttcc?.api?.identity;
    if (patch && idApi?.getIdentityFlags && idApi?.setIdentityFlags) {
      const current = await getIdentityFlagsSafe(actor);
      const merged = foundry.utils.mergeObject(foundry.utils.deepClone(current), patch, { inplace: false, overwrite: true });
      await idApi.setIdentityFlags(actor.id ?? actor, merged);
      try {
        await idApi.syncOptionTiers?.(actor.id ?? actor, { silent: true });
      } catch (e) {
        WARN("openBBTTCCIdentityChooser — syncOptionTiers failed", e);
      }
    }
  }

  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  app.render(false);
}

async function openBBTTCCTikkunPopup(actor, app) {
  const api = game.bbttcc?.api?.tikkun || null;
  const sparksMap = api?.getAllSparks ? (api.getAllSparks(actor.id ?? actor) || {}) : {};
  const sparks = Object.values(sparksMap || {});
  const integrated = sparks.filter(s => s?.integrated).length;
  const total = sparks.length || 0;
  const enlight = actor.getFlag("bbttcc-character-options", "enlightenment")?.level || "unawakened";

  const content = `
    <div class="bbttcc-field">
      <label>Integrated Sparks</label>
      <div><b>${integrated}</b> / ${total}</div>
    </div>
    <div class="bbttcc-field">
      <label>Enlightenment</label>
      <select id="bbttcc-native-enlightenment">
        ${ENLIGHTENMENT.map(e => `<option value="${e.key}" ${e.key === enlight ? "selected" : ""}>${e.label}</option>`).join("")}
      </select>
    </div>
  `;

  const result = await Dialog.wait({
    title: "Great Work / Enlightenment",
    content,
    buttons: {
      close: { label: "Close", callback: () => ({ action: "close" }) },
      save: {
        label: "Save",
        callback: (html) => ({ action: "save", level: (html instanceof HTMLElement ? html : html[0])?.querySelector("#bbttcc-native-enlightenment")?.value || enlight })
      }
    },
    default: "save"
  });

  if (result?.action === "save" && result.level) {
    const display = labelForEnlight(result.level);
    await actor.setFlag("bbttcc-character-options", "enlightenment", { level: result.level, display });
    await syncEnlightenmentItem(actor, result.level);
    await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
    Hooks.callAll("bbttcc:enlightenmentChanged", { actorId: actor.id, level: result.level, display });
    app.render(false);
  }
}

function openBBTTCCRadiationPopup(actor) {
  try {
    const modApi = game.modules?.get("bbttcc-radiation")?.api || null;
    if (typeof modApi?.openRadiationTracker === "function") {
      const tok = actor?.getActiveTokens?.()?.[0] || actor;
      modApi.openRadiationTracker(tok);
      return;
    }
  } catch (e) {
    WARN("Open Radiation Tracker failed", e);
  }
  ui.notifications?.warn?.("Radiation tracker not available.");
}


function _buildQuickbarHTML(actor) {
  const factions = factionsList();
  const currentFactionId = actor.getFlag?.("bbttcc-factions", "factionId") || "";
  const optionsHtml = factions.map(f => {
    const sel = f.id === currentFactionId ? " selected" : "";
    const safe = foundry.utils.escapeHTML(f.name);
    return `<option value="${f.id}"${sel}>${safe}</option>`;
  }).join("");

  return `
    <section class="bbttcc-quickbar" data-bbttcc-quickbar="1" data-bbttcc-debug="quickbar-injected">
      <div class="bbttcc-quickbar-card">
        <div class="bbttcc-quickbar-title">Bad Eden</div>
        <div class="bbttcc-quickbar-subtitle">Faction, character options, and pop-out trackers.</div>
        <div class="bbttcc-quickbar-grid">
          <div class="bbttcc-quickbar-actions">
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="open-faction"><i class="fas fa-flag"></i> Faction</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-action="open-bridge"><i class="fas fa-exchange-alt"></i> Bridge</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-open="radiation"><i class="fas fa-radiation"></i> Radiation</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-open="greatwork"><i class="fas fa-sparkles"></i> Tikkun</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-choose="archetype">Archetype</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-choose="crew">Crew Type</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-choose="occult">Occult</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-choose="political">Philosophy</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-choose="sephirothicAlignment">Sephirotic</button>
            <button type="button" class="bbttcc-button-link" data-bbttcc-choose="ancestry">Ancestry</button>
          </div>
          <div class="bbttcc-field bbttcc-field-tight">
            <label>Faction</label>
            <select data-bbttcc="factionId">
              <option value="">—</option>
              ${optionsHtml}
            </select>
          </div>
        </div>
      </div>
    </section>`;
}

function _pruneNativeQuickbarSideTabs(root) {
  try {
    const selectors = [
      `a.item[data-tab="bbttcc"]`,
      `a.item[data-tab="bbttcc-radiation"]`,
      `a.item[data-tab="bbttcc-tikkun"]`,
      `[role="tab"][data-tab="bbttcc"]`,
      `[role="tab"][data-tab="bbttcc-radiation"]`,
      `[role="tab"][data-tab="bbttcc-tikkun"]`,
      `.tab[data-tab="bbttcc"]`,
      `.tab[data-tab="bbttcc-radiation"]`,
      `.tab[data-tab="bbttcc-tikkun"]`,
      `[data-bbttcc-radiation-overlay]`,
      `[data-bbttcc-tikkun-overlay]`,
      `.bbttcc-radiation-overlay`,
      `.bbttcc-tikkun-overlay`
    ];
    root.querySelectorAll(selectors.join(",")).forEach(el => {
      try { el.remove(); } catch { el.style.display = "none"; }
    });
  } catch (e) {
    WARN("Failed to prune native quickbar side tabs", e);
  }
}

/**
 * Locate the Bad Eden quickbar mount target inside a character/NPC sheet.
 *
 * dnd5e v5+ structure (the only structure we currently support):
 *   <form class="character vertical-tabs">
 *     <header.sheet-header>
 *     <section.main-content id="main">
 *       <div.sidebar>          ← target: prepend quickbar here
 *         <div.card>            ← portrait/AC/HP
 *         <div.card>            ← favorites
 *     <section.tab-body id="tabs">
 *     <section.ability-scores>
 *     <nav.tabs.tabs-right>
 *
 * Returns the element the quickbar should be prepended into, or null if no
 * suitable mount target is found.
 */
function _findQuickbarMount(root) {
  if (!root) return null;

  // Primary path: dnd5e v5+ sidebar
  const v5Sidebar = root.querySelector(".main-content > .sidebar");
  if (v5Sidebar) return v5Sidebar;

  // Legacy fallback: pre-AppV2 dnd5e (or other systems) that still use sheet-body
  const legacySidebar =
    root.querySelector(".sheet-body > .sidebar") ||
    root.querySelector(".sheet-body > .sheet-sidebar");
  if (legacySidebar) return legacySidebar;

  // Last-resort fallback: any sidebar-classed element anywhere
  return root.querySelector(".sidebar, .sheet-sidebar");
}

/**
 * Kept for backwards compatibility — older code paths still call this. Under
 * the Option B refactor we no longer create a `.bbttcc-sidebar-stack` wrapper
 * (dnd5e v5 manages its own sidebar/main column layout). We just locate and
 * return the existing sidebar element so callers can treat it as the stack.
 */
function _ensureNativeSidebarStack(root) {
  return _findQuickbarMount(root);
}

function _mountQuickbar(root, quick) {
  if (!root || !quick) return quick;

  const mount = _findQuickbarMount(root);
  if (mount) {
    if (quick.parentNode !== mount || quick !== mount.firstElementChild) {
      mount.prepend(quick);
    }
    return quick;
  }

  // No sidebar at all — leave the quickbar wherever it currently is rather than
  // dumping it at the top of the form (which previously caused a full-width
  // header and broke the dnd5e layout).
  WARN("_mountQuickbar: no sidebar mount target found; leaving quickbar in place");
  return quick;
}


function _bbttccIsCharacterSheetRoot(root) {
  try {
    const cl = root?.classList;
    if (!cl) return false;
    const isCharacter = cl.contains("character") || cl.contains("character-sheet");
    const isNpc = cl.contains("npc") || cl.contains("npc-sheet");
    return !!(isCharacter && !isNpc);
  } catch {
    return false;
  }
}

function _bbttccMarkCharacterWindowScroll(root) {
  try {
    if (!_bbttccIsCharacterSheetRoot(root)) return;
    const wc = root.closest?.(".window-content");
    if (wc) wc.dataset.bbttccWindowScroll = "1";
    const app = root.closest?.(".application, .window-app");
    if (app) app.dataset.bbttccWindowScroll = "1";
  } catch {/* ignore */}
}

function _bbttccStripCharacterShellClasses(root) {
  try {
    if (!_bbttccIsCharacterSheetRoot(root)) return;
    root.removeAttribute("data-bbttcc-shell-mode");
    root.dataset.bbttccRootShellOff = "1";
    _bbttccMarkCharacterWindowScroll(root);
    // NOTE (Option B refactor, 2026-04-13): do NOT remove "vertical-tabs" or
    // "tab-*" classes. In dnd5e v5+, "vertical-tabs" is part of
    // CharacterActorSheet.DEFAULT_OPTIONS.classes and the sheet's flex layout
    // depends on it. Stripping these classes collapses the entire sheet into a
    // single full-width vertical stack with no scroll. Earlier versions of this
    // function stripped them under the assumption they were our own legacy
    // shell-mode markers; under Option B we leave the dnd5e class list alone
    // and only set the data attribute that drives our chrome-neutralization
    // CSS (form[data-bbttcc-root-shell-off="1"]).
  } catch {/* ignore */}
}

function _bbttccInstallCharacterShellNormalizer(root) {
  try {
    if (!_bbttccIsCharacterSheetRoot(root)) return;
    if (root.dataset.bbttccCharacterShellBound === "1") {
      _bbttccStripCharacterShellClasses(root);
      return;
    }
    root.dataset.bbttccCharacterShellBound = "1";

    let timer = null;
    const schedule = () => {
      try { clearTimeout(timer); } catch {/* ignore */}
      timer = setTimeout(() => _bbttccStripCharacterShellClasses(root), 0);
    };

    root.addEventListener("click", (ev) => {
      const hit = ev.target?.closest?.("[data-action='tab'], .item[data-tab], .sheet-tabs .item, nav.tabs .item");
      if (!hit) return;
      schedule();
      setTimeout(schedule, 30);
      setTimeout(schedule, 100);
    }, true);

    const observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes" && m.attributeName === "class") {
          schedule();
          return;
        }
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    root.__bbttccCharacterShellObserver = observer;

    schedule();
    setTimeout(schedule, 30);
    setTimeout(schedule, 100);
  } catch {/* ignore */}
}

function hydrateNativeBBTTCCQuickbar(app, root) {
  const actor = app?.actor ?? app?.object;
  if (!actor || !root) return;

  root.classList.add("bbttcc-character-sheet");
  root.dataset.bbttccNative = "1";

  // NOTE (Option B refactor): we used to force window-content overflow:auto and
  // form height:auto / min-height:0 here. dnd5e v5+ uses flex layout with
  // explicit heights and per-tab `scrollable: [""]` for internal scrolling.
  // Forcing height:auto on the form breaks that flex layout. The window-scroll
  // safety net is now applied via CSS keyed on data-bbttcc-window-scroll="1",
  // which _bbttccMarkCharacterWindowScroll() sets below — no inline styles.

  _bbttccMarkCharacterWindowScroll(root);
  _bbttccInstallCharacterShellNormalizer(root);
  _bbttccStripCharacterShellClasses(root);
  patchEsotericDisplayCardRoutingOnce();
  applyBBTTCCSheetCuration(app, root);

  // Find any quickbar element present in the DOM (HBS template or console quickbar from another module)
  let quick =
    root.querySelector("[data-bbttcc-quickbar='1']") ||
    root.querySelector("[data-bbttcc-console-quickbar='1']");

  if (quick) {
    quick = _mountQuickbar(root, quick);
  }

  // If no quickbar exists at all, build one dynamically
  if (!quick) {
    try {
      const html = _buildQuickbarHTML(actor);
      const frag = document.createRange().createContextualFragment(html);
      const injected = frag.firstElementChild;

      const mount = _findQuickbarMount(root);
      if (!mount) {
        WARN("hydrateNativeBBTTCCQuickbar: no sidebar mount target found; aborting injection");
        return;
      }
      mount.prepend(injected);
      quick = injected;
      LOG("Quickbar injected dynamically into sidebar", actor.name);
    } catch (e) {
      WARN("Failed to inject quickbar dynamically", e);
      return;
    }
  }

  if (!quick) return;

  quick = _mountQuickbar(root, quick);

  const quickbars = [...root.querySelectorAll('[data-bbttcc-quickbar="1"], [data-bbttcc-console-quickbar="1"]')];
  quickbars.slice(1).forEach(el => el.remove());

  _pruneNativeQuickbarSideTabs(root);
  setTimeout(() => _pruneNativeQuickbarSideTabs(root), 0);
  setTimeout(() => _pruneNativeQuickbarSideTabs(root), 75);

  const factionSelect = quick.querySelector("[data-bbttcc='factionId']");
  if (factionSelect) {
    factionSelect.value = actor.getFlag("bbttcc-factions", "factionId") || "";
  }

  if (quick.dataset.bbttccQuickbarBound === "1") return;
  quick.dataset.bbttccQuickbarBound = "1";

  if (factionSelect) {
    factionSelect.addEventListener("change", async (ev) => {
      await persistFaction(actor, String(ev.currentTarget.value || ""));
    });
  }

  quick.querySelectorAll("[data-bbttcc-choose]").forEach((btn) => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const slot = String(ev.currentTarget.dataset.bbttccChoose || "");
      await openBBTTCCIdentityChooser(actor, app, slot);
    });
  });

  const radBtn = quick.querySelector("[data-bbttcc-open='radiation']");
  if (radBtn) radBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    openBBTTCCRadiationPopup(actor);
  });

  const gwBtn = quick.querySelector("[data-bbttcc-open='greatwork']");
  if (gwBtn) gwBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    await openBBTTCCTikkunPopup(actor, app);
  });

  const openBridgeBtn = quick.querySelector("[data-bbttcc-action='open-bridge']");
  if (openBridgeBtn) {
    openBridgeBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      try {
        const api = game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
        const bridge = api ? api.bridge : null;
        if (bridge && typeof bridge.open === "function") bridge.open(actor.id);
        else ui.notifications?.warn?.("Bridge API not available.");
      } catch (e) {
        WARN("Open Bridge failed", e);
      }
    });
  }

  const openFactionBtn = quick.querySelector("[data-bbttcc-action='open-faction']");
  if (openFactionBtn) {
    openFactionBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const factionId = actor.getFlag("bbttcc-factions", "factionId") || "";
      if (!factionId) return ui.notifications?.warn?.("No faction linked for this character yet.");
      const faction = game.actors.get(factionId);
      if (!faction) return ui.notifications?.warn?.("Linked faction actor not found.");
      faction.sheet?.render(true, { focus: true });
    });
  }

  // Heal any broken Bad Eden Resource Suite ItemGrant UUIDs and backfill missing
  // resource items, then mount the Class Resources card. The heal kicks off
  // an actor.update() if anything needs repair, which will trigger another
  // sheet render — the mount is idempotent so the eventual second pass is fine.
  _bbttccHealResourceGrants(actor)
    .catch(e => WARN("Resource grant heal failed", e))
    .finally(() => _bbttccMountSidebarResourceCard(app, root));

  // 2026-05-15 — Mount the read-only Affiliations card directly under the quickbar
  // so the OP-contribution breakdown is visible at a glance.
  _ftMountAffiliationsCard(app, root);

  // 2026-05-15 — Inject ▶ Use buttons next to items that match FEATURE_ROUTER /
  // NAME_ROUTER. The native fourththing sheets render these via hbs templates,
  // but Bad Eden-wrapped dnd5e sheets have no equivalent hook — this bridges
  // the gap so NP ancestry abilities + class techniques get a clickable
  // invoke surface on both PC and NPC Bad Eden sheets.
  //
  // Belt-and-suspenders: dnd5e v5 AppV2 sometimes re-renders the items
  // partial after our initial hook fires, which would wipe the injected
  // buttons. Re-mount after a short delay so the buttons survive.
  _ftMountActionableUseButtons(app, root);
  setTimeout(() => _ftMountActionableUseButtons(app, root), 100);
  setTimeout(() => _ftMountActionableUseButtons(app, root), 500);
}


/* ---------------------------------------
 * Sheet registration
 * ------------------------------------ */

/**
 * Bad Eden sheet integration — Foundry v13 / dnd5e v5+ (ApplicationV2)
 *
 * dnd5e's CharacterActorSheet/NPCActorSheet extend ActorSheetV2 (AppV2),
 * which IGNORES the legacy V1 hooks (`get template()`, `getData()`,
 * `activateListeners()`). Trying to override them does nothing — the
 * native dnd5e PARTS render runs unchanged.
 *
 * Therefore, BBTTCCCharacterSheet and BBTTCCNPCSheet below are intentionally
 * thin marker subclasses. They exist only so:
 *   1. Users can pick "Bad Eden Character Sheet" in the sheet picker, and
 *   2. The renderActorSheet hook can detect them by constructor name and
 *      run hydrateNativeBBTTCCQuickbar() to DOM-inject the Bad Eden quickbar.
 *
 * All Bad Eden UI is added via DOM injection in hydrateNativeBBTTCCQuickbar,
 * NOT via Handlebars template override. The bbttcc-native-*.hbs files in
 * templates/actors/ are unused dead code (kept on disk for now in case of
 * a future Option-A refactor that owns the AppV2 PARTS map).
 */
export function registerBBTTCCCharacterSheet() {
  const baseChar = findBaseCharacterSheet();
  const baseNPC  = findBaseNPCSheet();

  if (!baseChar?.cls) {
    WARN("Could not locate a base character sheet; Bad Eden Character Sheet will not be registered.");
  } else {
    // Marker subclass — see comment above. Do NOT add V1 overrides here.
    class BBTTCCCharacterSheet extends baseChar.cls {}

    const sheetId = `${MOD}.BBTTCCCharacterSheet`;

    Actors.registerSheet(MOD, BBTTCCCharacterSheet, {
      types: ["character"],
      makeDefault: false,
      label: "Bad Eden Character Sheet"
    });

    CONFIG.Bad Eden ??= {};
    CONFIG.Bad Eden.autoLink ??= {};
    CONFIG.Bad Eden.autoLink.characterSheetId = sheetId;

    LOG("Registered Bad Eden Character Sheet", {
      sheetId,
      baseSheetId: baseChar.id,
      baseClass: baseChar.cls.name
    });
  }

  if (!baseNPC?.cls) {
    WARN("Could not locate a base NPC sheet; Bad Eden NPC Sheet will not be registered.");
  } else {
    // Marker subclass — see comment on registerBBTTCCCharacterSheet above.
    // Bad Eden UI is added via DOM injection in the renderActorSheet hook, not here.
    class BBTTCCNPCSheet extends baseNPC.cls {}

    const npcSheetId = `${MOD}.BBTTCCNPCSheet`;

    Actors.registerSheet(MOD, BBTTCCNPCSheet, {
      types: ["npc"],
      makeDefault: false,
      label: "Bad Eden NPC Sheet"
    });

    CONFIG.Bad Eden ??= {};
    CONFIG.Bad Eden.autoLink ??= {};
    CONFIG.Bad Eden.autoLink.npcSheetId = npcSheetId;

    LOG("Registered Bad Eden NPC Sheet", {
      sheetId: npcSheetId,
      baseSheetId: baseNPC.id,
      baseClass: baseNPC.cls.name
    });
  }
}

export function getBBTTCCCharacterSheetId() {
  return foundry.utils.getProperty(CONFIG, "Bad Eden.autoLink.characterSheetId");
}

/* ---------------------------------------
 * Shared helpers
 * ------------------------------------ */

function getRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html && html[0] instanceof HTMLElement) return html[0];
  return null;
}

/* ---------------------------------------
 * Bad Eden Native Sheet Curation Layer
 * ------------------------------------ */

function isBBTTCCActor(actor) {
  try {
    if (!actor) return false;

    // You can tighten this later if needed
    return (
      actor.type === "character" ||
      actor.type === "npc"
    );
  } catch {
    return false;
  }
}

function isBBTTCCItemFromElement(el) {
  try {
    const text = (el.textContent || "").toLowerCase();

    // Strong signals
    if (text.includes("bbttcc")) return true;

    // Known Bad Eden content hints
    if (text.includes("echo diver")) return true;
    if (text.includes("pactkeeper")) return true;
    if (text.includes("furrykin")) return true;

    return false;
  } catch {
    return false;
  }
}

function applyBBTTCCSheetCuration(app, root) {
  try {
    const actor = app?.actor ?? app?.object;
    if (!isBBTTCCActor(actor) || !root) return;

    /* ---------------------------------------
     * 1. Hide ONLY stock Background controls
     * ------------------------------------ */

    const hideIfBackgroundControl = (el) => {
      try {
        if (!el || el.dataset?.bbttccHiddenBg === "1") return false;

        const text = String(el.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        const html = String(el.innerHTML || "").toLowerCase();

        // Strong signals that this is an actual background advancement/control row,
        // not the whole Details tab.
        const mentionsBackground = text.includes("background");
        const looksInteractive =
          /button|select|dropdown|compendium browser|choose|replace|remove|item-control|advancement/.test(html) ||
          el.querySelector("button, select, a, .item-control, [data-action], [data-tooltip]");

        if (!mentionsBackground || !looksInteractive) return false;

        // Never hide the main tab containers / bodies / sheet wrappers.
        if (
          el.matches?.(".tab, .sheet-body, .sheet-content, .tab-body, main, form") ||
          el.querySelector?.(".traits, .details, .inventory, .favorites")
        ) {
          return false;
        }

        el.style.display = "none";
        el.dataset.bbttccHiddenBg = "1";
        return true;
      } catch {
        return false;
      }
    };

    const hideBackgroundButtons = () => {
      try {
        // Only inspect likely clickable/control elements — no "*" sweep.
        root.querySelectorAll("button, a, [data-action], .item, .entry, .trait").forEach(el => {
          try {
            if (!el || el.dataset?.bbttccHiddenBgButton === "1") return;

            const text = String(el.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
            if (!text) return;

            const isAddBackground =
              text === "add background" ||
              text === "background" ||
              text.startsWith("add background");

            if (!isAddBackground) return;

            // Never hide giant structural containers.
            if (
              el.matches?.("main, form, .sheet-body, .sheet-content, .tab, .tab-body, .window-content") ||
              el.querySelector?.(".details, .traits, .inventory, .favorites, .skills")
            ) {
              return;
            }

            // Prefer the button/tile itself, then a very small wrapper.
            const box =
              el.closest("button") ||
              el.closest("a") ||
              el.closest("[data-action]") ||
              el.closest(".item") ||
              el.closest(".entry") ||
              el.closest(".trait") ||
              el;

            box.style.display = "none";
            box.style.pointerEvents = "none";
            box.dataset.bbttccHiddenBgButton = "1";
          } catch {/* ignore */}
        });
      } catch {/* ignore */}
    };   

    /* ---------------------------------------
     * 2. Observe and filter pickers
     * ------------------------------------ */

    if (root.__bbttccObserverAttached) return;
    root.__bbttccObserverAttached = true;

    const observerScope = root.closest?.(".window-app, .application") || root;

    const filterChooserEntries = () => {
      try {
        observerScope.querySelectorAll(".directory-item, .item, li").forEach(el => {
          try {
            if (!observerScope.contains(el)) return;

            const text = (el.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
            if (!text) return;

            const isSpeciesEntry = text.includes("species");
            const isClassEntry = text.includes("class");
            const isBackgroundEntry = text.includes("background");

            // Only touch actual chooser entries inside this sheet/window scope.
            if (!isSpeciesEntry && !isClassEntry && !isBackgroundEntry) return;

            // Always suppress background choices for Bad Eden
            if (isBackgroundEntry) {
              el.style.display = "none";
              return;
            }

            // Keep Bad Eden entries, hide vanilla ones
            if (!isBBTTCCItemFromElement(el)) {
              el.style.display = "none";
            }
          } catch {/* ignore */}
        });
      } catch {/* ignore */}
    };

    filterChooserEntries();

    const observer = new MutationObserver(() => {
      try {
        filterChooserEntries();

        // Also hide any newly-rendered background control rows on the sheet itself
        root.querySelectorAll([
          ".advancement",
          ".form-group",
          ".form-group--standard",
          ".resource",
          ".items-header",
          ".items-section",
          ".item",
          ".trait",
          ".entry"
        ].join(", ")).forEach(hideIfBackgroundControl);

        hideBackgroundButtons();
      } catch {/* ignore */}
    });

    observer.observe(observerScope, {
      childList: true,
      subtree: true
    });

    root.__bbttccObserver = observer;

  } catch (err) {
    WARN("Bad Eden curation failed", err);
  }
}

function factionsList() {
  return (game.actors?.contents ?? [])
    .filter(a =>
      a.getFlag?.("bbttcc-factions", "isFaction") === true ||
      String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction"
    )
    .map(a => ({ id: a.id, name: a.name }))
    .sort((A, B) => A.name.localeCompare(B.name));
}

function resolveFactionForActor(actor) {
  const byId = actor.getFlag?.("bbttcc-factions", "factionId");
  if (byId && game.actors.get(byId)) {
    return { id: byId, name: game.actors.get(byId).name };
  }

  const legacyName = actor.flags?.["bbttcc-territory"]?.faction;
  if (legacyName) {
    const match = factionsList().find(f => f.name === legacyName);
    if (match) return { id: match.id, name: match.name };
    return { id: "", name: legacyName };
  }

  return { id: "", name: "" };
}

function normalizeTikkunSparks(actor) {
  const tApi = game.bbttcc?.api?.tikkun;

  try {
    if (tApi?.getAllSparks) {
      const map    = tApi.getAllSparks(actor.id ?? actor) || {};
      const sparks = Object.values(map);
      if (!sparks.length) return 0;

      const integrated = sparks.filter(s => s?.integrated).length;
      return integrated;
    }
  } catch (e) {
    WARN("normalizeTikkunSparks via Tikkun API failed", e);
  }

  const raw = actor?.getFlag?.("bbttcc-tikkun", "sparks") ?? 0;
  if (raw == null) return 0;

  try {
    if (typeof raw === "object") {
      if (typeof raw.integrated === "number") return raw.integrated;
      if (typeof raw.total === "number") return raw.total;
      return 0;
    }
  } catch {/* ignore */}

  if (typeof raw === "number" || typeof raw === "string") {
    return Number(raw) || 0;
  }

  return 0;
}

/* ---------------------------------------
 * Enlightenment model
 * ------------------------------------ */

const ENLIGHTENMENT = [
  { key: "unawakened",    label: "Unawakened" },
  { key: "awakening",     label: "Awakening" },
  { key: "seeking",       label: "Seeking" },
  { key: "wisdom",        label: "Wisdom" },
  { key: "understanding", label: "Understanding" },
  { key: "enlightened",   label: "Enlightened" },
  { key: "qliphothic",    label: "Qliphothic" }
];

const labelForEnlight = (k) =>
  ENLIGHTENMENT.find(x => x.key === String(k))?.label ?? "Unawakened";

const ENLIGHTENMENT_ITEM_DATA = {
  unawakened: {
    name: "Enlightenment: Unawakened",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { economy: 1 } } }
  },
  awakening: {
    name: "Enlightenment: Awakening",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { intrigue: 1, softpower: 1 } } }
  },
  seeking: {
    name: "Enlightenment: Seeking",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { intrigue: 1, softpower: 2 } } }
  },
  wisdom: {
    name: "Enlightenment: Wisdom",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { diplomacy: 1, intrigue: 1, softpower: 1 } } }
  },
  understanding: {
    name: "Enlightenment: Understanding",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { softpower: 2, diplomacy: 1 } } }
  },
  enlightened: {
    name: "Enlightenment: Enlightened",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { diplomacy: 3, softpower: 2 } } }
  },
  qliphothic: {
    name: "Enlightenment: Qliphothic",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { violence: 2, intrigue: 2 } } }
  }
};

async function syncEnlightenmentItem(actor, levelKey) {
  const items = actor.items?.filter(
    it => it.getFlag?.("bbttcc-character-options", "category") === "enlightenment-levels"
  ) ?? [];
  const toDelete = items.map(it => it.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);

  const src = ENLIGHTENMENT_ITEM_DATA[levelKey];
  if (!src) return;

  const worldSrc = game.items?.find(
    i =>
      i.name === src.name &&
      i.getFlag?.("bbttcc-character-options", "category") === "enlightenment-levels"
  );

  const createData = worldSrc ? worldSrc.toObject() : foundry.utils.deepClone(src);
  foundry.utils.setProperty(
    createData,
    'flags["bbttcc-character-options"].category',
    "enlightenment-levels"
  );

  await actor.createEmbeddedDocuments("Item", [createData]);
}

/* ---------------------------------------
 * Identity helpers
 * ------------------------------------ */

function pickOptionItem(actor, categoryAliases) {
  const items = actor.items?.contents ?? actor.items ?? [];

  const isTierItem = (it) => {
    const s = String(it?.name || "").trim();
    return /\(Tier\s+\d+\)/i.test(s) || /[—-]\s*Tier\s+\d+$/i.test(s);
  };

  // Prefer BASE item (no Tier in name)
  const base = items.find(it => {
    const cat = it.getFlag?.("bbttcc-character-options", "category");
    return categoryAliases.includes(cat) && !isTierItem(it);
  });

  if (base) return base;

  // Fallback (legacy actors): return anything
  return items.find(it => {
    const cat = it.getFlag?.("bbttcc-character-options", "category");
    return categoryAliases.includes(cat);
  }) ?? null;
}

function pickSephirotItem(actor) {
  return pickOptionItem(actor, IDENTITY_SLOTS.sephirothicAlignment.categories);
}

function matchesIdentityFamilyItem(it, slotKey, cfg) {
  const name = String(it?.name || "");
  const ident = String(it?.system?.identifier || "");
  const cat = String(it?.getFlag?.("bbttcc-character-options", "category") || "");

  if (cfg?.categories?.includes(cat)) return true;

  if (slotKey === "archetype") {
    if (/^Archetype:/i.test(name)) return true;
    if (ident.startsWith("archetype-")) return true;
    return false;
  }

  if (slotKey === "crew") {
    if (/^Crew Type:/i.test(name)) return true;
    if (ident.startsWith("crew-")) return true;
    return false;
  }

  if (slotKey === "occult") {
    if (/^Occult Association:/i.test(name)) return true;
    if (
      ident.startsWith("occult-") ||
      ident.startsWith("occult_association-") ||
      ident.startsWith("occult-association-")
    ) return true;
    return false;
  }

  if (slotKey === "sephirothicAlignment") {
    if (/^Alignment:/i.test(name)) return true;
    if (ident.startsWith("alignment-")) return true;
    return false;
  }

  return false;
}

async function deleteIdentityFamilyItems(actor, slotKey, cfg) {
  const items = actor.items?.contents ?? actor.items ?? [];
  const toDelete = items
    .filter(it => matchesIdentityFamilyItem(it, slotKey, cfg))
    .map(it => it.id);

  if (toDelete.length) {
    LOG("Bad Eden Identity — deleting identity family items", {
      slotKey,
      actor: actor.name,
      ids: toDelete
    });
    await actor.deleteEmbeddedDocuments("Item", toDelete);
  }

  return toDelete;
}

/** Extra-tough delete for Sephirotic Alignment spam. */
async function deleteSephirotItems(actor) {
  const items = actor.items?.contents ?? actor.items ?? [];
  const toDelete = items.filter(it => {
    const name  = String(it.name ?? "");
    const ident = String(it.system?.identifier ?? "");
    const cat   = it.getFlag?.("bbttcc-character-options", "category");
    return (
      IDENTITY_SLOTS.sephirothicAlignment.categories.includes(cat) ||
      /^alignment\b/i.test(name) ||
      ident.startsWith("alignment-")
    );
  }).map(it => it.id);

  if (toDelete.length) {
    LOG("Bad Eden Identity — deleting Sephirot items", { actor: actor.name, ids: toDelete });
    await actor.deleteEmbeddedDocuments("Item", toDelete);
  }
}

async function backfillIdentityFlagsFromItems(actor, identityFlags) {
  try {
    const idApi = game.bbttcc?.api?.identity;
    if (!idApi?.setIdentityFlags) return identityFlags;

    const next = foundry.utils.deepClone(identityFlags ?? {});
    const partial = {};

    const archetypeItem = pickOptionItem(actor, IDENTITY_SLOTS.archetype.categories);
    const crewItem      = pickOptionItem(actor, IDENTITY_SLOTS.crew.categories);
    const politicalItem = null; // political philosophy is stored as an AAE flag
    const occultItem    = pickOptionItem(actor, IDENTITY_SLOTS.occult.categories);
    const enlightItem   = pickOptionItem(actor, ["enlightenment-levels"]);
    const sephItem      = pickSephirotItem(actor);

    const ensure = (slot, item, slotCfg) => {
      if (!item) return;
      const current = next[slot];
      if (current && current.key) return;
      const itemId = item.id ?? item._id ?? null;
      if (!itemId) return;

      partial[slot] = {
        key: itemId,
        pack: current?.pack ?? null,
        category: slotCfg.categories[0]
      };
    };

    ensure("archetype",   archetypeItem, IDENTITY_SLOTS.archetype);
    ensure("crew",        crewItem,      IDENTITY_SLOTS.crew);
    ensure("sephirothicAlignment", sephItem, IDENTITY_SLOTS.sephirothicAlignment);
    ensure("occult",      occultItem,    IDENTITY_SLOTS.occult);
    ensure("enlightenment", enlightItem, { categories: ["enlightenment-levels"] });

    if (!Object.keys(partial).length) return identityFlags;

    const merged = foundry.utils.mergeObject(next, partial, { inplace: false, overwrite: true });
    await idApi.setIdentityFlags(actor.id ?? actor, merged);
    return merged;
  } catch (e) {
    WARN("backfillIdentityFlagsFromItems error", e);
    return identityFlags;
  }
}

async function getIdentityFlagsSafe(actor) {
  try {
    const idApi = game.bbttcc?.api?.identity;
    if (!idApi?.getIdentityFlags) return {};
    const raw = idApi.getIdentityFlags(actor.id ?? actor) || {};
    const base = isPlain(raw) ? raw : {};
    return await backfillIdentityFlagsFromItems(actor, base);
  } catch (e) {
    WARN("getIdentityFlagsSafe error", e);
    return {};
  }
}

function buildIdentityDisplay(actor, identityFlags = {}) {
  const labelFromItem = (item, fallback) =>
    item ? String(item.name ?? fallback) : fallback;

  const archetypeItem = pickOptionItem(actor, IDENTITY_SLOTS.archetype.categories);
  const crewItem      = pickOptionItem(actor, IDENTITY_SLOTS.crew.categories);
  const politicalItem = pickOptionItem(actor, IDENTITY_SLOTS.political.categories);
  const occultItem    = pickOptionItem(actor, IDENTITY_SLOTS.occult.categories);
  const enlightItem   = pickOptionItem(actor, ["enlightenment-levels"]);
  const sephItem      = pickSephirotItem(actor);

  return {
    archetype: {
      label: labelFromItem(archetypeItem, "—"),
      itemId: archetypeItem?._id ?? archetypeItem?.id ?? null,
      category: IDENTITY_SLOTS.archetype.categories[0],
      key:  identityFlags.archetype?.key ?? null,
      pack: identityFlags.archetype?.pack ?? null
    },
    crew: {
      label: labelFromItem(crewItem, "—"),
      itemId: crewItem?._id ?? crewItem?.id ?? null,
      category: IDENTITY_SLOTS.crew.categories[0],
      key:  identityFlags.crew?.key ?? null,
      pack: identityFlags.crew?.pack ?? null
    },
    sephirothicAlignment: {
      label: labelFromItem(sephItem, "—"),
      itemId: sephItem?._id ?? sephItem?.id ?? null,
      category: IDENTITY_SLOTS.sephirothicAlignment.categories[0],
      key:  identityFlags.sephirothicAlignment?.key ?? null,
      pack: identityFlags.sephirothicAlignment?.pack ?? null
    },
    political: (() => {
      const polKey = actor.getFlag?.(AAE_SCOPE, "politicalPhilosophy") || null;
      const polDef = AAE_POLITICAL_PHILOSOPHIES.find(p => p.key === String(polKey)) || null;
      return {
        label: polDef?.label ?? "—",
        happiness: polDef?.happiness ?? "",
        suffering: polDef?.suffering ?? "",
        itemId: null,
        category: IDENTITY_SLOTS.political.categories[0],
        key:  identityFlags.political?.key ?? null,
        pack: identityFlags.political?.pack ?? null
      };
    })(),
    occult: {
      label: labelFromItem(occultItem, "—"),
      itemId: occultItem?._id ?? occultItem?.id ?? null,
      category: IDENTITY_SLOTS.occult.categories[0],
      key:  identityFlags.occult?.key ?? null,
      pack: identityFlags.occult?.pack ?? null
    },
    enlightenment: {
      label: labelFromItem(
        enlightItem,
        labelForEnlight(
          (actor.getFlag?.("bbttcc-character-options", "enlightenment")?.level) ?? "unawakened"
        )
      ),
      itemId: enlightItem?._id ?? enlightItem?.id ?? null,
      category: "enlightenment-levels",
      key:  identityFlags.enlightenment?.key ?? null,
      pack: identityFlags.enlightenment?.pack ?? null
    }
  };
}

/**
 * Apply a change for a single identity slot (archetype/crew/…).
 * Called directly from the dropdown change handler.
 */
async function applyIdentitySlotChange(actor, slotKey, newKey) {
  // Special case: Political Philosophy is AAE flag-based identity, not an embedded item.
  if (slotKey === "political") {
    const polKey = String(newKey ?? "").trim();
    await actor.setFlag(AAE_SCOPE, "politicalPhilosophy", polKey || null);
    return { political: { key: polKey || null, pack: null, category: "political-philosophy" } };
  }

  const cfg = IDENTITY_SLOTS[slotKey];
  if (!cfg) {
    WARN("applyIdentitySlotChange — unknown slot", slotKey);
    return null;
  }

  const { pack, categories } = cfg;
  const patch = {};

  // Delete ALL items in this identity family, not only category-perfect matches.
  if (slotKey === "sephirothicAlignment") {
    await deleteSephirotItems(actor);
  } else {
    await deleteIdentityFamilyItems(actor, slotKey, cfg);
  }

  if (!newKey) {
    patch[slotKey] = { key: null, id: null, pack: null, category: categories[0], optionKey: null, identifier: "" };
    return patch;
  }

  const p = game.packs.get(pack);
  if (!p) {
    WARN("applyIdentitySlotChange — pack not found", slotKey, pack);
    patch[slotKey] = { key: newKey, id: newKey, pack, category: categories[0] };
    return patch;
  }

  const doc = await p.getDocument(newKey).catch((e) => {
    WARN("applyIdentitySlotChange — pack getDocument failed", slotKey, newKey, e);
    return null;
  });

  if (!doc) {
    patch[slotKey] = { key: newKey, id: newKey, pack, category: categories[0] };
    return patch;
  }

  LOG("Bad Eden Identity — adding item for slot", {
    slotKey,
    actor: actor.name,
    item: doc.name,
    id: doc.id
  });

  // 2026-05-15 — For ancestry, mirror the wizard's UUID-import cascade so the
  // NPC receives the species' level-1 ItemGrants (size, traits, tier-I feats)
  // rather than just the bare top-level species item. Other slots remain
  // pure top-level embeds.
  if (slotKey === "ancestry") {
    const cascade = await _ftCollectAncestryGrants(doc);
    if (cascade.length) {
      try { await actor.createEmbeddedDocuments("Item", cascade); }
      catch (e) { WARN("Ancestry cascade import failed", e); }
    }
  } else {
    await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
  }

  const opt =
    doc.getFlag?.("bbttcc-character-options", "option") ||
    {};

  patch[slotKey] = {
    key: doc.id,
    id: doc.id,
    pack,
    category: categories[0],
    optionKey: String(opt.key || "").trim() || null,
    identifier: String(doc.system?.identifier || "").trim(),
    name: String(doc.name || "")
  };

  return patch;
}

async function syncLegacyIdentityMirror(actor, slotKey, patch) {
  const slotData = patch?.[slotKey] || null;

  const mirrorKeyMap = {
    archetype: "archetype",
    crew: "crew",
    occult: "occult",
    sephirothicAlignment: "sephirot"
  };

  const mirrorKey = mirrorKeyMap[slotKey];
  if (!mirrorKey) return;

  if (!slotData || !slotData.key) {
    try {
      await actor.unsetFlag("bbttcc-character-options", mirrorKey);
    } catch (_e) {
      await actor.setFlag("bbttcc-character-options", mirrorKey, null);
    }
    return;
  }

  await actor.setFlag("bbttcc-character-options", mirrorKey, {
    pack: slotData.pack || null,
    id: slotData.id || slotData.key || null,
    key: slotData.optionKey || null,
    name: slotData.name || "",
    identifier: slotData.identifier || "",
    category: slotData.category || null
  });
}


async function reconcileIdentityFromSection(actor, section) {
  const idApi = game.bbttcc?.api?.identity;
  const currentFlags = await getIdentityFlagsSafe(actor);
  const nextFlags = foundry.utils.deepClone(currentFlags || {});

  const desired = {
    archetype: String(section.querySelector("[data-bbttcc-identity='archetype']")?.value || "").trim(),
    crew: String(section.querySelector("[data-bbttcc-identity='crew']")?.value || "").trim(),
    occult: String(section.querySelector("[data-bbttcc-identity='occult']")?.value || "").trim(),
    sephirothicAlignment: String(section.querySelector("[data-bbttcc-identity='sephirothicAlignment']")?.value || "").trim()
  };

  // Remove all family items first so base items cannot drift/stick across edits.
  await deleteIdentityFamilyItems(actor, "archetype", IDENTITY_SLOTS.archetype);
  await deleteIdentityFamilyItems(actor, "crew", IDENTITY_SLOTS.crew);
  await deleteIdentityFamilyItems(actor, "occult", IDENTITY_SLOTS.occult);
  await deleteSephirotItems(actor);

  for (const slotKey of ["archetype", "crew", "occult", "sephirothicAlignment"]) {
    const cfg = IDENTITY_SLOTS[slotKey];
    const newKey = desired[slotKey];

    if (!newKey) {
      nextFlags[slotKey] = {
        key: null,
        id: null,
        pack: null,
        category: cfg.categories[0],
        optionKey: null,
        identifier: "",
        name: ""
      };
      await syncLegacyIdentityMirror(actor, slotKey, { [slotKey]: null });
      continue;
    }

    const p = game.packs.get(cfg.pack);
    if (!p) {
      WARN("reconcileIdentityFromSection — pack not found", slotKey, cfg.pack);
      nextFlags[slotKey] = {
        key: newKey,
        id: newKey,
        pack: cfg.pack,
        category: cfg.categories[0],
        optionKey: null,
        identifier: "",
        name: ""
      };
      await syncLegacyIdentityMirror(actor, slotKey, { [slotKey]: nextFlags[slotKey] });
      continue;
    }

    const doc = await p.getDocument(newKey).catch((e) => {
      WARN("reconcileIdentityFromSection — getDocument failed", slotKey, newKey, e);
      return null;
    });

    if (!doc) {
      nextFlags[slotKey] = {
        key: newKey,
        id: newKey,
        pack: cfg.pack,
        category: cfg.categories[0],
        optionKey: null,
        identifier: "",
        name: ""
      };
      await syncLegacyIdentityMirror(actor, slotKey, { [slotKey]: nextFlags[slotKey] });
      continue;
    }

    await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
    const opt = doc.getFlag?.("bbttcc-character-options", "option") || {};

    nextFlags[slotKey] = {
      key: doc.id,
      id: doc.id,
      pack: cfg.pack,
      category: cfg.categories[0],
      optionKey: String(opt.key || "").trim() || null,
      identifier: String(doc.system?.identifier || "").trim(),
      name: String(doc.name || "")
    };

    await syncLegacyIdentityMirror(actor, slotKey, { [slotKey]: nextFlags[slotKey] });
  }

  if (idApi?.setIdentityFlags) {
    await idApi.setIdentityFlags(actor.id, nextFlags);
    try {
      await idApi.syncOptionTiers?.(actor.id, { silent: true });
    } catch (e) {
      WARN("reconcileIdentityFromSection — syncOptionTiers failed", e);
    }
  } else {
    await actor.setFlag("bbttcc-character-options", "identity", nextFlags);
  }

  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  return nextFlags;
}


/* ---------------------------------------
 * Persistence helpers
 * ------------------------------------ */

async function persistFaction(actor, factionId) {
  const name = factionId ? (game.actors.get(factionId)?.name || "") : "";
  await actor.setFlag("bbttcc-factions", "factionId", factionId || null);
  await actor.setFlag("bbttcc-territory", "faction", name || "");
}

/* ---------------------------------------
 * Bad Eden Identity tab
 * ------------------------------------ */

async function ensureBBTTCCTab(app, root) {
  const actor = app?.actor ?? app?.object;
  if (!actor) return;
  if (root?.dataset?.bbttccNative === "1" || root?.querySelector?.('[data-bbttcc-native="1"]')) return;

  // Prefer Foundry v13 primary tab semantics (same strategy as Tikkun/Radiation enhancers)
  const nav =
    root.querySelector(".sheet-tabs[data-group='primary']") ||
    root.querySelector(".tabs[data-group='primary']") ||
    root.querySelector("nav.sheet-tabs") ||
    root.querySelector("nav.tabs") ||
    root.querySelector(".tabs");

  const body =
    root.querySelector(".tab-body[data-group='primary']") ||
    root.querySelector(".tab-body[data-container-id]") ||
    root.querySelector(".tab-body") ||
    root.querySelector(".sheet-body") ||
    root.querySelector(".sheet-content") ||
    root;

  if (!nav || !body) { WARN('Bad Eden tab injection: missing nav/body', { ctor: app?.constructor?.name, hasNav: !!nav, hasBody: !!body }); return; }

  const exampleItem =
    nav.querySelector("a.item[data-action='tab'][data-group='primary'][data-tab]") ||
    nav.querySelector("a.item[data-tab]") ||
    nav.querySelector(".item[data-tab]") ||
    nav.querySelector(".item");

  const group  = (exampleItem?.dataset?.group || nav.dataset?.group || "primary");
  const action = (exampleItem?.dataset?.action || "tab");

  let navItem = nav.querySelector("[data-tab='bbttcc']");
  if (!navItem) {
    navItem = document.createElement(exampleItem?.tagName?.toLowerCase() || "a");
    navItem.classList.add("item");
    navItem.dataset.tab = "bbttcc";
    navItem.textContent = "Bad Eden";
    if (group) navItem.dataset.group = group;
    if (action) navItem.dataset.action = action;
    nav.appendChild(navItem);
  }

  let section = body.querySelector(".tab[data-tab='bbttcc']");
  if (!section) {
    section = document.createElement("section");
    section.classList.add("tab", "bbttcc-tab");
    section.dataset.tab = "bbttcc";
    if (group) section.dataset.group = group;
    body.appendChild(section);
  }

  try {
    const actor = app.actor ?? app.object;
    const resolvedFaction = resolveFactionForActor(actor);
    const radPoints = actor?.getFlag?.("bbttcc-radiation", "points");
    const radRP     = actor?.getFlag?.("bbttcc-radiation", "rp");

    const enlightenmentFlag =
      actor?.getFlag?.("bbttcc-character-options", "enlightenment") ?? {};

    const identityFlags   = await getIdentityFlagsSafe(actor);
    const identityDisplay = buildIdentityDisplay(actor, identityFlags);
    const identityOptions = await buildIdentityOptions();

    const isGM = game.user?.isGM ?? false;
    const isEditable = !!(app && (app.isEditable || app?.options?.editable));
    const isOwner = !!(actor && actor.isOwner);
    const canEditIdentityOptions = !!isEditable && (isGM || isOwner);

    const context = {
      actor,
      system: actor?.system,
      isGM,
      bbttcc: {
        canEditIdentityOptions,

        factionName: resolvedFaction.name,
        factionId: resolvedFaction.id,
        factions: factionsList(),

        radiationPoints: radPoints ?? radRP ?? 0,
        tikkunSparks: normalizeTikkunSparks(actor),
        raidXP: actor?.getFlag?.("bbttcc-raid", "experience") ?? 0,


        bloodDebt: (() => {
          const bd = getBloodDebtModel(actor);
          const ledger = (bd.ledger || []).slice(0, 10).map(formatBloodDebtLedgerEntry);
          return { value: Number(bd.value) || 0, ledger };
        })(),
        // Esoteric Magic (Cosmic Linguist)
        esoteric: (() => {
          const enabled = !!game.modules?.get(ESOTERIC_MAGIC_SCOPE)?.active;
          const isLinguist = enabled && isCosmicLinguist(actor);
          if (!isLinguist) return { enabled: false };
          const st = getEsotericState(actor) || {};
          return {
            enabled: true,
            dice: Number(st.dice) || 0,
            maxDice: Number(st.maxDice) || 0,
            die: String(st.die || "d6"),
            strain: Number(st.strain) || 0
          };
        })(),
        titanbound: (() => {
          const st = getTitanboundState(actor) || {};
          return {
            enabled: !!st.enabled,
            dice: Number(st.dice) || 0,
            maxDice: Number(st.maxDice) || 0,
            die: String(st.die || "d6"),
            stress: Number(st.stress) || 0
          };
        })(),


        enlightenment: {
          level: enlightenmentFlag.level ?? "unawakened",
          display: enlightenmentFlag.display ?? labelForEnlight(enlightenmentFlag.level ?? "unawakened")
        },

        enlightenmentLevels: ENLIGHTENMENT,

        identity: {
          flags: identityFlags,
          display: identityDisplay
        },

        identityOptions
      }
    };

    const inner = await foundry.applications.handlebars.renderTemplate(
      "modules/bbttcc-auto-link/templates/actors/bbttcc-tab.hbs",
      context
    );
    section.innerHTML = inner;

    // Inject a Bridge launcher into the Bad Eden tab (Character sheet) — uses the same pattern as Open Faction Sheet.
    try {
      const actions = section.querySelector('.bbttcc-card .bbttcc-card-actions');
      if (actions && !actions.querySelector('[data-bbttcc-action="open-bridge"]')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bbttcc-button-link';
        b.setAttribute('data-bbttcc-action', 'open-bridge');
        b.innerHTML = '<i class="fas fa-exchange-alt"></i> Open Bridge';
        actions.appendChild(b);
      }
    } catch (_eB) {}


    // Bad Eden Class Resources (dice pools + pushback) — inject UI + ensure useItem hook is active
    try {
      _bbttccInstallUseItemHookOnce();
      _bbttccInstallBurnTimerHookOnce();
      _bbttccInstallAutoAccrualHookOnce();
      _bbttccRenderResourceCard(section, actor);
    } catch (eR) { /* non-fatal */ }

    wireBBTTCCTabEvents(app, section);
  } catch (err) {
    WARN("Failed to render Bad Eden tab template; falling back to placeholder.", err);
    section.innerHTML = `<div class="bbttcc-tab-placeholder">
      <p style="margin:0;">Bad Eden identity panel failed to load.</p>
    </div>`;
  }
}

/* ---------------------------------------
 * Save & wiring for the tab
 * ------------------------------------ */

async function saveFromTab(actor, root) {
  const newFactionId = root.querySelector("[data-bbttcc='factionId']")?.value || "";
  const newRad   = Number(root.querySelector("[data-bbttcc='radiation']")?.value ?? 0);
  const newRaid  = Number(root.querySelector("[data-bbttcc='raid']")?.value ?? 0);

  const lvlKey  = String(root.querySelector("[data-bbttcc='enlightenment-level']")?.value ?? "unawakened");
  const display = labelForEnlight(lvlKey);

  await persistFaction(actor, newFactionId);

  await actor.setFlag("bbttcc-radiation", "points", newRad);
  await actor.setFlag("bbttcc-radiation", "rp", newRad);

  await actor.setFlag("bbttcc-raid", "experience", newRaid);
  await actor.setFlag("bbttcc-character-options", "enlightenment", { level: lvlKey, display });

  await syncEnlightenmentItem(actor, lvlKey);

  // Identity is handled live via dropdown change handlers now.

  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  Hooks.callAll("bbttcc:enlightenmentChanged", { actorId: actor.id, level: lvlKey, display });

  ui.notifications?.info?.("Bad Eden values saved.");
}

function wireBBTTCCTabEvents(app, section) {
  const actor = app.actor ?? app.object;
  if (!actor) return;


  const isGM = game.user?.isGM ?? false;
  const isEditable = !!(app && (app.isEditable || app?.options?.editable));
  const isOwner = !!actor.isOwner;
  const canEditIdentityOptions = !!isEditable && (isGM || isOwner);

  const factionSelect = section.querySelector("[data-bbttcc='factionId']");
  if (factionSelect) {
    factionSelect.value = actor.getFlag("bbttcc-factions", "factionId") || "";
  }

  const enlightSelect = section.querySelector("[data-bbttcc='enlightenment-level']");
  if (enlightSelect) {
    const current = actor.getFlag("bbttcc-character-options", "enlightenment")?.level || "unawakened";
    enlightSelect.value = current;

    // If the sheet is in Edit mode for an owner (or GM), let Enlightenment update live.
    if (canEditIdentityOptions) {
      enlightSelect.addEventListener("change", async (ev) => {
        const lvlKey = String(ev.currentTarget.value ?? "unawakened").trim() || "unawakened";
        const display = labelForEnlight(lvlKey);
        try {
          await actor.setFlag("bbttcc-character-options", "enlightenment", { level: lvlKey, display });
          await syncEnlightenmentItem(actor, lvlKey);
          await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
          Hooks.callAll("bbttcc:enlightenmentChanged", { actorId: actor.id, level: lvlKey, display });
          app.render(false);
        } catch (e) {
          WARN("Bad Eden Enlightenment Change — error", e);
        }
      });
    }
  }

  const radInput = section.querySelector("[data-bbttcc='radiation']");
  if (radInput) {
    const radPoints = actor.getFlag("bbttcc-radiation", "points");
    const radRP     = actor.getFlag("bbttcc-radiation", "rp");
    radInput.value = radPoints ?? radRP ?? 0;
  }

  const sparksInput = section.querySelector("[data-bbttcc-readonly='sparks']");
  if (sparksInput) {
    sparksInput.value = normalizeTikkunSparks(actor);
  }

  const raidInput = section.querySelector("[data-bbttcc='raid']");
  if (raidInput) {
    raidInput.value = actor.getFlag("bbttcc-raid", "experience") ?? 0;
  }

  // Preselect identity dropdowns from flags
  const identityRaw = actor.getFlag("bbttcc-character-options", "identity") || {};
  const setSelectValue = (slot) => {
    const sel = section.querySelector(`[data-bbttcc-identity='${slot}']`);
    if (!sel) return;
    const key = identityRaw?.[slot]?.key;
    if (key) sel.value = key;
  };

  setSelectValue("archetype");
  setSelectValue("crew");
  setSelectValue("occult");
  // political philosophy is stored on AAE flags
  const polSel = section.querySelector(`[data-bbttcc-identity='political']`);
  if (polSel) polSel.value = actor.getFlag(AAE_SCOPE, "politicalPhilosophy") || "";
  setSelectValue("sephirothicAlignment");

  // Live identity change handlers
  const attachIdentityChange = (slot) => {
    if (!canEditIdentityOptions) return;
    const sel = section.querySelector(`[data-bbttcc-identity='${slot}']`);
    if (!sel) return;

    sel.addEventListener("change", async (ev) => {
      const newKey = String(ev.currentTarget.value ?? "").trim();
      LOG("Bad Eden Identity Change — slot", { slot, newKey, actor: actor.name });

      try {
        await reconcileIdentityFromSection(actor, section);
        app.render(false);
      } catch (e) {
        WARN("Bad Eden Identity Change — error", slot, e);
      }
    });
  };

  attachIdentityChange("archetype");
  attachIdentityChange("crew");
  attachIdentityChange("occult");
  // Political Philosophy change handler (AAE flag based) — GM only.
  const polSelect = section.querySelector(`[data-bbttcc-identity='political']`);
  if (polSelect && isGM) {
    polSelect.addEventListener("change", async (ev) => {
      const newKey = String(ev.currentTarget.value ?? "").trim();
      LOG("Bad Eden Political Philosophy Change", { newKey, actor: actor.name });
      try {
        await actor.setFlag(AAE_SCOPE, "politicalPhilosophy", newKey || null);
        await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
        app.render(false);
      } catch (e) {
        WARN("Bad Eden Political Philosophy Change — error", e);
      }
    });
  }
  attachIdentityChange("sephirothicAlignment");

  const saveBtn = section.querySelector("[data-bbttcc-action='save']");
  if (saveBtn) {
    saveBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await saveFromTab(actor, section);
      app.render(false);
    });
  }

  const recalcBtn = section.querySelector("[data-bbttcc-action='recalc']");
  if (recalcBtn) {
    recalcBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
      ui.notifications?.info?.("Bad Eden OPs recalculated.");
    });


  /* ---------------------------------------
   * Blood Debt — GM-only controls (manual)
   * ------------------------------------ */
  const bdGet = () => {
    const deltaRaw = section.querySelector("[data-bbttcc-blooddebt='delta']")?.value;
    const source   = section.querySelector("[data-bbttcc-blooddebt='source']")?.value || "other";
    const note     = section.querySelector("[data-bbttcc-blooddebt='note']")?.value || "";
    const delta    = Number(deltaRaw || 0) || 0;
    return { delta, source, note };
  };

  const bindBD = (action, fn) => {
    const b = section.querySelector(`[data-bbttcc-action='${action}']`);
    if (!b) return;
    b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      try { await fn(); app.render(false); } catch (e) { WARN("Blood Debt action failed", action, e); }
    });
  };

  if (game.user?.isGM) {
    bindBD("blooddebt-add", async () => {
      const f = bdGet();
      const d = Math.abs(f.delta || 0) || 1;
      await applyBloodDebtDelta(actor, { delta: d, source: f.source, note: f.note });
      ui.notifications?.info?.(`Blood Debt +${d} applied.`);
    });

    bindBD("blooddebt-reduce", async () => {
      const f = bdGet();
      const d = Math.abs(f.delta || 0) || 1;
      await applyBloodDebtDelta(actor, { delta: -d, source: f.source, note: f.note });
      ui.notifications?.info?.(`Blood Debt -${d} applied.`);
    });

    bindBD("blooddebt-declare-death", async () => {
      // Standard baseline: +2, source=death
      const note = section.querySelector("[data-bbttcc-blooddebt='note']")?.value || "";
      await applyBloodDebtDelta(actor, { delta: 2, source: "death", note });
      ui.notifications?.info?.("Death declared. Blood Debt +2 applied.");
    });

    bindBD("blooddebt-reset", async () => {
      const ok = await Dialog.confirm({
        title: "Reset Blood Debt?",
        content: `<p>This will set Blood Debt to <b>0</b> and clear the ledger for <b>${actor.name}</b>.</p>`
      });
      if (!ok) return;

      await actor.update({
        "flags.bbttcc.identity.bloodDebt": { value: 0, ledger: [] },
        "flags.bbttcc.bloodDebt": 0
      });
      ui.notifications?.info?.("Blood Debt reset.");
    });
  }

  }



  // Esoteric Magic (Cosmic Linguist) — GM test controls
  const esWrap = section.querySelector("[data-bbttcc-esoteric='1']");
  if (esWrap && game.modules?.get(ESOTERIC_MAGIC_SCOPE)?.active) {
    const bind = (action, fn) => {
      const b = esWrap.querySelector(`[data-bbttcc-action='${action}']`);
      if (!b) return;
      b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try { await fn(); app.render(false); } catch (e) { WARN("Esoteric action failed", action, e); }
      });
    };

    bind("esoteric-add-die", async () => {
      if (!isCosmicLinguist(actor)) return;
      const st = getEsotericState(actor);
      const next = Math.min((Number(st.dice) || 0) + 1, Number(st.maxDice) || 0 || 1);
      await setEsotericState(actor, { dice: next });
    });

    bind("esoteric-clear-dice", async () => {
      if (!isCosmicLinguist(actor)) return;
      await setEsotericState(actor, { dice: 0 });
    });

    bind("esoteric-add-strain", async () => {
      if (!isCosmicLinguist(actor)) return;
      const st = getEsotericState(actor);
      await setEsotericState(actor, { strain: (Number(st.strain) || 0) + 1 });
    });

    bind("esoteric-clear-strain", async () => {
      if (!isCosmicLinguist(actor)) return;
      await setEsotericState(actor, { strain: 0 });
    });
  }

  // Titanbound (Frame Dice / Structural Stress) — GM test controls
  const titanWrap = section.querySelector("[data-bbttcc-titanbound='1']");
  if (titanWrap) {
    const bind = (action, fn) => {
      const b = titanWrap.querySelector(`[data-bbttcc-action='${action}']`);
      if (!b) return;
      b.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try { await fn(); app.render(false); } catch (e) { WARN("Titanbound action failed", action, e); }
      });
    };

    bind("titanbound-add-die", async () => {
      if (!isTitanbound(actor)) return;
      const st = getTitanboundState(actor);
      const next = Math.min((Number(st.dice) || 0) + 1, Number(st.maxDice) || 1);
      await actor.setFlag(MOD, "titanbound.frameDice", next);
    });

    bind("titanbound-clear-dice", async () => {
      if (!isTitanbound(actor)) return;
      await actor.setFlag(MOD, "titanbound.frameDice", 0);
    });

    bind("titanbound-add-stress", async () => {
      if (!isTitanbound(actor)) return;
      const st = getTitanboundState(actor);
      await actor.setFlag(MOD, "titanbound.stress", (Number(st.stress) || 0) + 1);
    });

    bind("titanbound-clear-stress", async () => {
      if (!isTitanbound(actor)) return;
      await actor.setFlag(MOD, "titanbound.stress", 0);
    });
  }

  // Bad Eden Class Resources — wire UI buttons (dice pools + pushback)
  try { _bbttccWireResourceCardEvents(app, section); } catch (_eResWire) {}

  const openBridgeBtn = section.querySelector("[data-bbttcc-action='open-bridge']");
  if (openBridgeBtn) {
    openBridgeBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      try {
        const api = game.bbttcc && game.bbttcc.api ? game.bbttcc.api : null;
        const bridge = api ? api.bridge : null;
        if (bridge && typeof bridge.open === "function") bridge.open(actor.id);
        else ui.notifications?.warn?.("Bridge API not available.");
      } catch (e) {
        WARN("Open Bridge failed", e);
      }
    });
  }

  const openFactionBtn = section.querySelector("[data-bbttcc-action='open-faction']");
  if (openFactionBtn) {
    openFactionBtn.addEventListener("click", (ev) => {
      ev.preventDefault();

      const factionId = actor.getFlag("bbttcc-factions", "factionId") || "";
      if (!factionId) {
        return ui.notifications?.warn?.("No faction linked for this character yet.");
      }

      const faction = game.actors.get(factionId);
      if (!faction) {
        return ui.notifications?.warn?.("Linked faction actor not found.");
      }

      faction.sheet?.render(true, { focus: true });
    });
  }
}

/* ---------------------------------------
 * Hooks: render Bad Eden sheets
 * ------------------------------------ */

// Per-(app, render) dedupe. Foundry v13 AppV2 sheets fire both `renderActorSheet`
// and their constructor-named render hook for the same render pass. Without
// this guard, enhanceBBTTCCSheet ran 2–4 times per sheet open, multiplying
// every downstream write (heal, quickbar hydrate, tab install) and feeding
// the render→write→render freeze cascade diagnosed 2026-04-17.
const _bbttccEnhanceRecent = new WeakMap(); // app -> lastInvokedTs (ms)
const _BBTTCC_ENHANCE_DEDUPE_MS = 120;

async function enhanceBBTTCCSheet(app, html) {
  try {
    // De-dupe rapid double-fires for the same app instance (covers multi-hook
    // fan-out from AppV2 + constructor-named hooks, and back-to-back renders
    // triggered by tab-switch reflows).
    if (app) {
      const now = Date.now();
      const last = _bbttccEnhanceRecent.get(app) ?? 0;
      if (now - last < _BBTTCC_ENHANCE_DEDUPE_MS) return;
      _bbttccEnhanceRecent.set(app, now);
    }

    const actor = app?.actor ?? app?.object;
    if (!actor) return;

    // Only PCs/NPCs; faction actors do not receive the Bad Eden tab here.
    const isPC = (actor.type === "character" || actor.type === "npc");

    const root = getRoot(html);
    if (!root) return;

    // Register character/npc non-faction sheets for healer refreshes.
    try {
      if (isPC && !actor.getFlag?.("bbttcc-factions", "isFaction")) {
        _bbttccRegisterSheet(app, root);
      }
    } catch {/* ignore */}

    // Any actor sheet render can destabilize existing tab DOM. Heal other open character sheets on next tick.
    _bbttccScheduleHeal();

    root.classList.add("bbttcc-character-sheet");
    _bbttccMarkCharacterWindowScroll(root);
    _bbttccInstallCharacterShellNormalizer(root);
    _bbttccStripCharacterShellClasses(root);

    const configuredSheetClass = String(actor.getFlag?.("core", "sheetClass") || "");
    const ctorName = String(app?.constructor?.name || "");
    const isBBTTCCRegisteredSheet =
      configuredSheetClass === `${MOD}.BBTTCCCharacterSheet` ||
      configuredSheetClass === `${MOD}.BBTTCCNPCSheet` ||
      ctorName === "BBTTCCCharacterSheet" ||
      ctorName === "BBTTCCNPCSheet";

    if (isBBTTCCRegisteredSheet || root.dataset?.bbttccNative === "1" || root.querySelector?.('[data-bbttcc-native="1"]')) {
      root.dataset.bbttccNative = "1";
      hydrateNativeBBTTCCQuickbar(app, root);
      return;
    }

    // 2026-05-15 — Boss sheet (fourththing) gets a slim Affiliations surface
    // so bosses can author affiliations and contribute OP to their faction.
    if (String(actor.type || "").toLowerCase() === "boss") {
      _ftMountBossAffiliationsSurface(app, root);
      return;
    }

    if (isPC && !actor.getFlag?.("bbttcc-factions", "isFaction")) {
      // Ensure Esoteric Magic feats route through dnd5e.useItem (dialog-safe)
      patchEsotericDisplayCardRoutingOnce();
      await ensureBBTTCCTab(app, root);
	  applyBBTTCCSheetCuration(app, root);

      // Safety net: some other enhancers (or the tab controller) may re-render / rebuild tabs
      // immediately after this hook fires. Re-ensure once on a short delay.
      setTimeout(async () => {
        try {
          const liveRoot = getRoot(app.element);
          if (!liveRoot) return;
          liveRoot.classList.add("bbttcc-character-sheet");
          _bbttccMarkCharacterWindowScroll(liveRoot);
          _bbttccInstallCharacterShellNormalizer(liveRoot);
          _bbttccStripCharacterShellClasses(liveRoot);
          await ensureBBTTCCTab(app, liveRoot);
        } catch (e) {
          WARN("Post-render re-ensure failed", e);
        }
      }, 50);
    }

  } catch (err) {
    WARN("Failed during Bad Eden sheet enhancement", err);
  }
}

/* ---------------------------------------
 * 2026-05-15 — Affiliation card + ancestry cascade helpers
 * Sprint: NPC affiliation integration. See affiliation-op-table.enhancer.js
 * in bbttcc-raid for the OP-contribution engine these helpers feed.
 * ------------------------------------ */

/** Recursive ItemGrant cascade walker. Mirrors character-wizard.js:418
 *  collectLevelOneGrants but RECURSES into granted items so two-layer
 *  chains import in one drop. Common case: Echo-Diver species → Heritage
 *  feat → tier features. Without recursion only the species + heritage
 *  land; tier features are silently dropped.
 *
 *  Cycle detection via visited UUID set; depth cap as a safety belt.
 */
async function _ftCollectAncestryGrants(topDoc, _visited = null, _depth = 0, _MAX_DEPTH = 3) {
  if (!topDoc) return [];
  const visited = _visited || new Set();
  if (topDoc.uuid && visited.has(topDoc.uuid)) return [];
  if (topDoc.uuid) visited.add(topDoc.uuid);

  const out = [];
  const stamp = (obj, uuid) => {
    try {
      foundry.utils.setProperty(obj, "_stats.compendiumSource", uuid);
      foundry.utils.setProperty(obj, "flags.core.sourceId", uuid);
      foundry.utils.setProperty(obj, "flags.fourththing.principleSource", "ancestry");
    } catch(_e){}
  };
  const top = topDoc.toObject();
  stamp(top, topDoc.uuid);
  out.push(top);

  if (_depth >= _MAX_DEPTH) return out;

  const advancement = topDoc.system?.advancement || {};
  const advRows = Array.isArray(advancement) ? advancement : Object.values(advancement);
  for (const adv of advRows) {
    if (!adv || adv.type !== "ItemGrant") continue;
    if ((adv.level ?? 0) > 1) continue;
    const items = adv.configuration?.items || [];
    for (const entry of items) {
      try {
        const granted = await fromUuid(entry.uuid);
        if (!granted) continue;
        // Recurse into the granted doc so heritage→tier-feat chains land.
        const sub = await _ftCollectAncestryGrants(granted, visited, _depth + 1, _MAX_DEPTH);
        out.push(...sub);
      } catch (_err) { /* skip missing grants */ }
    }
  }

  if (_depth > 0) return out;

  // De-dup by (type, name) and strip _id so createEmbeddedDocuments mints fresh ones.
  // Only the outermost call returns the cleaned set.
  const seen = new Set();
  const cleaned = [];
  for (const obj of out) {
    const key = String(obj.type || "") + "::" + String(obj.name || "");
    if (seen.has(key)) continue;
    seen.add(key);
    const c = foundry.utils.deepClone(obj);
    delete c._id;
    cleaned.push(c);
  }
  return cleaned;
}

/** Pretty label for an affiliation slot value. */
function _ftAffLabel(slot) {
  if (!slot || typeof slot !== "object") return "";
  const raw = slot.name || slot.identifier || slot.optionKey || slot.key || "";
  return String(raw).replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase()).trim();
}

/** Render the read-only Affiliations card HTML for an actor. */
function _ftBuildAffiliationsCardHTML(actor) {
  // Canonical storage: actor.flags["bbttcc-character-options"].identity. Boss
  // schema also has a free-text system.identity.archetype string; show that
  // as fallback so every actor type renders consistently.
  const charOptId = (actor.getFlag?.("bbttcc-character-options", "identity") || actor?.flags?.["bbttcc-character-options"]?.identity || {});
  const sysId     = foundry.utils.getProperty(actor, "system.identity") || {};
  const bossArchString = (typeof sysId.archetype === "string" && sysId.archetype.trim())
    ? { key: sysId.archetype.trim(), name: sysId.archetype.trim() }
    : null;
  const identity = {
    archetype:            charOptId.archetype            || bossArchString || sysId.archetype || null,
    crew:                 charOptId.crew                 || sysId.crew     || null,
    occult:               charOptId.occult               || sysId.occult   || null,
    ancestry:             charOptId.ancestry             || sysId.ancestry || null,
    sephirothicAlignment: charOptId.sephirothicAlignment || sysId.sephirothicAlignment || null
  };
  const polKey   = String(actor.getFlag?.(AAE_SCOPE, "politicalPhilosophy") ?? "") || "";
  const polLabel = polKey ? labelForPoliticalPhilosophy(polKey) : "";

  // OP contribution breakdown (engine API exposed by bbttcc-raid)
  let parts = [], total = {};
  try {
    const api = globalThis.BBTTCC_AffiliationOP || game?.bbttcc?.api?.factions?.affiliationOP;
    if (api?.contributionBreakdown) {
      const br = api.contributionBreakdown(actor);
      parts = br?.parts || [];
      total = br?.total || {};
    }
  } catch (_e) {}

  // Index parts by kind for fast lookup
  const partByKind = {};
  for (const p of parts) partByKind[p.kind] = p;

  const fmtOps = (ops) => {
    const entries = Object.entries(ops || {}).filter(([, v]) => Number(v));
    if (!entries.length) return "<em>no OP contribution</em>";
    return entries.map(([k, v]) => `<span class="bbttcc-aff-pill">${(v > 0 ? "+" : "") + v} ${k}</span>`).join(" ");
  };

  const row = (icon, label, slotLabel, kind, kindKey) => {
    const part = partByKind[kind];
    const opsHtml = part ? fmtOps(part.ops) : "";
    const tip = part
      ? `${kind}: ${kindKey || part.key}\nOPs: ${Object.entries(part.ops).filter(([,v]) => v).map(([k,v]) => (v > 0 ? "+" : "") + v + " " + k).join(", ") || "—"}\nSource: ${part.source}`
      : "";
    const tipAttr = tip ? ` data-tooltip="${foundry.utils.escapeHTML(tip)}"` : "";
    return `<div class="bbttcc-aff-row"${tipAttr}>
      <div class="bbttcc-aff-row-label"><i class="${icon}"></i> ${label}</div>
      <div class="bbttcc-aff-row-value">${slotLabel ? foundry.utils.escapeHTML(slotLabel) : "<em>—</em>"}</div>
      <div class="bbttcc-aff-row-ops">${opsHtml}</div>
    </div>`;
  };

  const totalEntries = Object.entries(total).filter(([, v]) => Number(v));
  const totalHtml = totalEntries.length
    ? totalEntries.map(([k, v]) => `<span class="bbttcc-aff-pill bbttcc-aff-pill-total">${(v > 0 ? "+" : "") + v} ${k}</span>`).join(" ")
    : `<em>no faction OP contribution</em>`;

  return `<section class="bbttcc-affiliations-card" data-bbttcc-affiliations="1">
    <div class="bbttcc-aff-title">Affiliations <span class="bbttcc-aff-subtitle">contributes to faction OP roll</span></div>
    <div class="bbttcc-aff-rows">
      ${row("fas fa-user-tag",  "Archetype",          _ftAffLabel(identity.archetype),            "archetype",  identity.archetype?.key)}
      ${row("fas fa-users",     "Crew Type",          _ftAffLabel(identity.crew),                 "crew",       identity.crew?.key)}
      ${row("fas fa-eye",       "Occult Association", _ftAffLabel(identity.occult),               "occult",     identity.occult?.key)}
      ${row("fas fa-dna",       "Ancestry",           _ftAffLabel(identity.ancestry),             "ancestry",   identity.ancestry?.key)}
      ${row("fas fa-star",      "Sephirotic Alignment", _ftAffLabel(identity.sephirothicAlignment), "sephirah", identity.sephirothicAlignment?.key)}
      ${row("fas fa-landmark",  "Political Philosophy", polLabel,                                 "political",  polKey)}
    </div>
    <div class="bbttcc-aff-total">
      <div class="bbttcc-aff-total-label">Total OP contribution</div>
      <div class="bbttcc-aff-total-pills">${totalHtml}</div>
    </div>
  </section>`;
}

/** Build the chooser button row HTML used by the boss-sheet mount.
 *  Mirrors the NPC quickbar's six chooser buttons (incl. ancestry).
 */
function _ftBuildBossAffChooserRowHTML() {
  return `<div class="bbttcc-quickbar-actions bbttcc-quickbar-options" data-bbttcc-boss-chooser="1">
    <button type="button" class="bbttcc-button-link" data-bbttcc-choose="archetype">Archetype</button>
    <button type="button" class="bbttcc-button-link" data-bbttcc-choose="crew">Crew Type</button>
    <button type="button" class="bbttcc-button-link" data-bbttcc-choose="occult">Occult</button>
    <button type="button" class="bbttcc-button-link" data-bbttcc-choose="political">Philosophy</button>
    <button type="button" class="bbttcc-button-link" data-bbttcc-choose="sephirothicAlignment">Sephirotic</button>
    <button type="button" class="bbttcc-button-link" data-bbttcc-choose="ancestry">Ancestry</button>
  </div>`;
}

/** Mount the Affiliations card + chooser row on a boss sheet.
 *  Boss sheet is a custom fourththing template; we inject inside the body
 *  area near the top so the surface is visible without tab switching.
 */
function _ftMountBossAffiliationsSurface(app, root) {
  try {
    const actor = app?.actor ?? app?.object;
    if (!actor || !root) return;
    if (String(actor.type || "").toLowerCase() !== "boss") return;

    // Drop any prior surface (re-render path)
    root.querySelectorAll("[data-bbttcc-boss-aff='1']").forEach(el => el.remove());

    // Find a mount target — boss sheet has .ft-identity at top of sheet body
    const mount =
      root.querySelector(".ft-boss-identity") ||
      root.querySelector(".ft-identity") ||
      root.querySelector(".sheet-body") ||
      root.querySelector("form") ||
      root;
    if (!mount) return;

    const wrap = document.createElement("section");
    wrap.dataset.bbttccBossAff = "1";
    wrap.className = "bbttcc-boss-aff-wrap";
    wrap.innerHTML = `
      ${_ftBuildBossAffChooserRowHTML()}
      ${_ftBuildAffiliationsCardHTML(actor)}
    `;
    // Insert directly after the identity block (or prepend to body fallback)
    if (mount.parentNode && mount.classList?.contains("ft-identity")) {
      mount.parentNode.insertBefore(wrap, mount.nextSibling);
    } else {
      mount.prepend(wrap);
    }

    // Wire chooser buttons
    wrap.querySelectorAll("[data-bbttcc-choose]").forEach((btn) => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const slot = String(ev.currentTarget.dataset.bbttccChoose || "");
        await openBBTTCCIdentityChooser(actor, app, slot);
      });
    });
  } catch (e) {
    WARN("Boss affiliations surface mount failed", e);
  }
}

/** Mount or refresh the Affiliations card just below the Bad Eden quickbar. */
function _ftMountAffiliationsCard(app, root) {
  try {
    const actor = app?.actor ?? app?.object;
    if (!actor || !root) return;
    if (!["character","npc"].includes(String(actor.type || "").toLowerCase())) return;

    const quick = root.querySelector("[data-bbttcc-quickbar='1']") || root.querySelector("[data-bbttcc-console-quickbar='1']");
    if (!quick) return;

    // Drop any prior card so we re-render with fresh data
    const existing = root.querySelector("[data-bbttcc-affiliations='1']");
    if (existing) existing.remove();

    const html = _ftBuildAffiliationsCardHTML(actor);
    const frag = document.createRange().createContextualFragment(html);
    quick.parentNode?.insertBefore(frag, quick.nextSibling);
  } catch (e) {
    WARN("Affiliations card mount failed", e);
  }
}

/* ---------------------------------------
 * 2026-05-15 — ▶ Use button bridge for Bad Eden-wrapped (dnd5e) sheets
 *
 * The fourththing native sheets render a ▶ Use button via their hbs templates
 * (character-sheet.hbs:1228, npc-sheet.hbs:567) gated on isActionableFeature.
 * Bad Eden uses dnd5e-wrapped sheets instead, which have NO equivalent hook,
 * so items routed via FEATURE_ROUTER never get a clickable invoke surface.
 *
 * This injector scans the rendered item list for items where
 * isActionableFeature(item) === true and injects a ▶ button next to the
 * item name. Click → dispatchFeatureAction → opens the per-cadence dialog
 * (per-scene / per-soma-break / per-soma-break-tier / info) from
 * fourththing's ft-class-automation.js.
 *
 * Idempotent — drops any prior injection before adding fresh ones.
 * ------------------------------------ */
function _ftMountActionableUseButtons(app, root) {
  try {
    const actor = app?.actor ?? app?.object;
    if (!actor || !root) return;
    if (!["character","npc"].includes(String(actor.type || "").toLowerCase())) return;

    const cls = game.fourththing?._classAutomation;
    const isActionable = cls?.isActionableFeature;
    const dispatch     = cls?.dispatchFeatureAction;
    if (typeof isActionable !== "function" || typeof dispatch !== "function") return;

    // Drop any prior injections so re-renders don't double-stamp.
    root.querySelectorAll("[data-bbttcc-ft-use='1']").forEach(el => el.remove());

    const items = actor.items?.contents ?? Array.from(actor.items ?? []);
    let added = 0;
    for (const item of items) {
      let actionable = false;
      try { actionable = !!isActionable(item); } catch(_e){}
      if (!actionable) continue;

      // dnd5e v5 item rows: <li class="item" data-item-id="...">
      const row = root.querySelector(`[data-item-id="${item.id}"]`);
      if (!row) continue;

      // Pick an injection target — prefer the item name cell so the button
      // sits next to the label. Fall back to the item-controls cell.
      const mount =
        row.querySelector(".item-name") ||
        row.querySelector(".item-row .name") ||
        row.querySelector(".item-controls") ||
        row;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.bbttccFtUse = "1";
      btn.className = "bbttcc-ft-use-btn";
      btn.title = "Activate / invoke this feature (Roll For Initiation)";
      btn.innerHTML = "▶";
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try { await dispatch(actor, item); }
        catch (e) { WARN("dispatchFeatureAction failed", item?.name, e); }
      });

      // Mount as first child of the name cell so it's visible at a glance.
      if (mount.classList.contains("item-controls")) mount.prepend(btn);
      else mount.insertBefore(btn, mount.firstChild);
      added++;
    }

    if (added) LOG(`Mounted ${added} ▶ Use button(s) for actionable features on ${actor.name}.`);
  } catch (e) {
    WARN("Actionable Use button injection failed", e);
  }
}

// Hook registration strategy (2026-04-17 freeze fix):
//   In Foundry v13 + dnd5e v5, AppV2 actor sheets reliably fire
//   `renderActorSheet` in addition to their constructor-named hook. That
//   single hook covers dnd5e CharacterActorSheet/NPCActorSheet, Bad Eden
//   marker subclasses, and the legacy V1 path. The four extra hooks we
//   used to register all fired for the SAME render, fanning every sheet
//   open into 4–6 calls of `_bbttccHealResourceGrants` — each of which
//   can write to the actor and trigger another render cascade. The
//   `_bbttccEnhanceInFlight` / `_bbttccEnhanceRecent` guards inside
//   `enhanceBBTTCCSheet` defend against any residual duplicate fires.
Hooks.on("renderActorSheet", enhanceBBTTCCSheet);

/* ---------------------------------------
 * Ready hook: inspectIdentity debug helper
 * ------------------------------------ */

Hooks.once("ready", () => {
  try {
    game.bbttcc = game.bbttcc ?? { api: {} };
    game.bbttcc.api = game.bbttcc.api ?? {};
    game.bbttcc.api.autoLink = game.bbttcc.api.autoLink ?? {};

    game.bbttcc.api.autoLink.inspectIdentity = async (actorOrId) => {
      const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
      if (!actor) return null;
      const flags   = await getIdentityFlagsSafe(actor);
      const display = buildIdentityDisplay(actor, flags);
      return { flags, display };
    };

    LOG("autoLink.inspectIdentity API ready (Identity Integration + live editing).");
  } catch (err) {
    WARN("Failed to expose inspectIdentity API", err);
  }
});
