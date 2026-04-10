/* bbttcc-raid/compat-bridge.js
 * TURN-only compat bridge
 * SAFE FULL REPLACEMENT
 * Adds strategic activity: repair_rig
 *
 * Slice 2:
 * - Inject L1 Tactical Maneuvers unlocked by Character Options
 * - Display inline with normal maneuvers, tagged ⭐ [Option]
 *
 * Slice 3:
 * - Inject L2 Strategic Activities unlocked by Character Options
 * - Display in planner/activity lists, tagged ⭐ [Option]
 * - Mixed: mostly storyOnly; selected activities queue real hex tags via territory.turn.pending
 *
 * Slice 3.1 (Polish):
 * - Option maneuvers now include primaryKey/cost + normalized raidTypes (so Raid Console can surface them)
 * - Option strategics now include primaryKey/opCosts + grouping metadata (so Planner renders them like native entries)
 */

const MOD_FACTIONS  = "bbttcc-factions";
const MOD_TERRITORY = "bbttcc-territory";
const MOD_ID        = "bbttcc-raid";

const TAG = "[bbttcc-raid/compat-bridge]";
const log  = (...a)=>console.log(TAG, ...a);
const warn = (...a)=>console.warn(TAG, ...a);

/* ---------------- Utils (unchanged) ---------------- */
const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
const clamp0 = v => Math.max(0, Number(v ?? 0) || 0);
const copy = (obj)=>foundry.utils.duplicate(obj ?? {});
function zOP(){ const o={}; for (const k of OP_KEYS) o[k]=0; return o; }
function canAfford(bank=zOP(), cost=zOP()){ for (const k of OP_KEYS) if ((bank[k]||0) < (cost[k]||0)) return false; return true; }
function spendBank(bank=zOP(), cost=zOP()){ const n=copy(bank); for (const k of OP_KEYS) n[k]=clamp0((n[k]||0)-(cost[k]||0)); return n; }
function nowISO(){ try { return new Date().toLocaleString(); } catch { return ""; } }
const _stripActorId = id => (typeof id === "string" && id.startsWith("Actor.")) ? id.slice(6) : id;

/* ---------------- War Log helper (unchanged) ---------------- */
async function pushWarLog(actor, entry){
  const flags = copy(actor.flags?.[MOD_FACTIONS] ?? {});
  const wl = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
  wl.push({ ts: Date.now(), date: nowISO(), ...entry });
  await actor.update({ [`flags.${MOD_FACTIONS}.warLogs`]: wl });
}

/* ============================================================
   RIG HELPERS (UNCHANGED)
   ============================================================ */

function _getRigs(actor){
  const rigs = actor?.getFlag?.(MOD_FACTIONS, "rigs") ?? actor?.flags?.[MOD_FACTIONS]?.rigs;
  return Array.isArray(rigs) ? rigs : [];
}

async function _updateRig(actor, rigId, updater){
  const rigs = _getRigs(actor).map(r => copy(r));
  const idx = rigs.findIndex(r => String(r?.rigId||"") === String(rigId));
  if (idx < 0) return { ok:false };
  rigs[idx] = updater(rigs[idx] || {});
  await actor.update({ [`flags.${MOD_FACTIONS}.rigs`]: rigs }, { diff:true, recursive:true });
  return { ok:true, rig: rigs[idx] };
}

function _rigStateFromStep(rig, step){
  const hitTrack = Array.isArray(rig?.hitTrack) && rig.hitTrack.length
    ? rig.hitTrack
    : ["light","heavy","breached","destroyed"];
  if (step <= 0) return "intact";
  return hitTrack[step-1] || "damaged";
}

async function _promptPickRig(){
  const factions = game.actors.contents.filter(a =>
    a.getFlag?.(MOD_FACTIONS,"isFaction") === true
  );
  if (!factions.length){
    ui.notifications.warn("No faction actors found.");
    return null;
  }

  const factionId = await new Promise(resolve => {
    new Dialog({
      title: "Repair Rig — Pick Faction",
      content: `
        <select name="faction">
          ${factions.map(f=>`<option value="${f.id}">${f.name}</option>`).join("")}
        </select>
      `,
      buttons: {
        ok: { label:"Next", callback: html=>resolve(html.find("select").val()) },
        cancel: { label:"Cancel", callback: ()=>resolve(null) }
      }
    }).render(true);
  });
  if (!factionId) return null;

  const faction = game.actors.get(factionId);
  const rigs = _getRigs(faction);
  if (!rigs.length){
    ui.notifications.warn("That faction has no rigs.");
    return null;
  }

  const rigId = await new Promise(resolve => {
    new Dialog({
      title: "Repair Rig — Pick Rig",
      content: `
        <select name="rig">
          ${rigs.map(r=>`<option value="${r.rigId}">
            ${r.name} (${_rigStateFromStep(r, r.damageStep||0)})
          </option>`).join("")}
        </select>
      `,
      buttons: {
        ok: { label:"Repair", callback: html=>resolve(html.find("select").val()) },
        cancel: { label:"Cancel", callback: ()=>resolve(null) }
      }
    }).render(true);
  });

  if (!rigId) return null;
  return { faction, rigId };
}

/* ============================================================
   OPTION SPEC TABLES (NEW — UI/UX + RAID MATCHING)
   ============================================================ */

// L1 Option Maneuvers: define primary OP, baseline cost, and normalized activity keys.
// These values are intentionally light; stacking discounts come later.
const OPTION_L1_SPECS = {
  coordinated_advance:    { primaryKey:"violence",   cost:{ violence:1 },   raidTypes:["assault","occupation","liberation","siege","assault_defense"] },
  containment_protocol:   { primaryKey:"nonlethal",  cost:{ nonlethal:1 },  raidTypes:["occupation","siege","assault_defense"] },
  infernal_bargain:       { primaryKey:"intrigue",   cost:{ intrigue:1 },   raidTypes:["infiltration","espionage","ritual"] },
  liturgical_rally:       { primaryKey:"softpower",  cost:{ softpower:1 },  raidTypes:["assault","liberation","siege","ritual"] },
  make_do_and_hold:       { primaryKey:"logistics",  cost:{ logistics:1 },  raidTypes:["assault_defense","occupation","siege"] },
  turn_the_card:          { primaryKey:"intrigue",   cost:{ intrigue:1 },   raidTypes:["espionage","infiltration","propaganda"] },
  inherited_deference:    { primaryKey:"softpower",  cost:{ softpower:1 },  raidTypes:["liberation","occupation","courtly_intrigue"] },
  psychological_pressure: { primaryKey:"softpower",  cost:{ softpower:1 },  raidTypes:["propaganda","espionage","liberation"] },
  sight_of_the_tree:      { primaryKey:"faith",      cost:{ faith:1 },      raidTypes:["ritual","liberation","siege"] }
};

// L2 Option Strategics: define primary OP + baseline costs + grouping.
// Some are mechanical-tag queueing (as already implemented), others storyOnly.
const OPTION_L2_SPECS = {
  operational_cohesion:   { primaryKey:"violence",   cost:{ violence:1, logistics:1 }, groupOrder: 1 },
  stability_enforcement:  { primaryKey:"nonlethal",  cost:{ nonlethal:1, economy:1 },  groupOrder: 2, mechTag:"Stability Enforcement" },
  ritual_binding:         { primaryKey:"intrigue",   cost:{ intrigue:2, faith:1 },     groupOrder: 3 },
  consecrated_alignment:  { primaryKey:"faith",      cost:{ faith:2, softpower:1 },    groupOrder: 4, mechTag:"Consecrated Alignment" },
  never_scattered:        { primaryKey:"logistics",  cost:{ logistics:1 },             groupOrder: 5 },
  thread_the_spread:      { primaryKey:"intrigue",   cost:{ intrigue:1 },              groupOrder: 6 },
  dynastic_resonance:     { primaryKey:"softpower",  cost:{ softpower:1, diplomacy:1 },groupOrder: 7 },
  cultural_diffusion:     { primaryKey:"culture",    cost:{ softpower:2, culture:1 },  groupOrder: 8, mechTag:"Cultural Diffusion" },
  guided_ascent:          { primaryKey:"faith",      cost:{ faith:2 },                 groupOrder: 9 }
};

function _prettyTitle(key){
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

/* ============================================================
   SLICE 2 — OPTION MANEUVER INJECTION
   ============================================================ */

function getPartyOptionManeuvers(){
  const refined = game?.bbttcc?.api?.characterOptions?.refined;
  if (!refined?.getUnlocksForActor) return {};

  const actors = game.actors?.contents ?? [];
  const result = {};

  for (const a of actors) {
    if (a.type !== "character") continue;
    const unlocks = refined.getUnlocksForActor(a) || [];
    for (const u of unlocks) {
      if (!u?.l1) continue;
      const key = String(u.l1);
      result[key] ??= { count: 0, family: u.family, optionKey: u.optionKey };
      result[key].count++;
    }
  }

  return result;
}

function buildOptionManeuverDef(key, meta){
  const pretty = _prettyTitle(key);
  const spec = OPTION_L1_SPECS[key] || null;

  // Defaults if missing from spec table
  const primaryKey = spec?.primaryKey || "misc";
  const cost = spec?.cost || {};
  const raidTypes = spec?.raidTypes || ["assault","infiltration","occupation","liberation","espionage","propaganda","siege","ritual","assault_defense","courtly_intrigue"];

  return {
    kind: "maneuver",
    tier: 1,
    rarity: "option",
    source: "character-option",
    optionKey: meta?.optionKey || null,

    // UI: match existing look/feel
    label: `⭐ ${pretty} [Option]`,
    primaryKey,
    cost,           // Raid Console reads eff.cost
    opCosts: cost,  // Loader-style consumers read opCosts

    // IMPORTANT: normalized activity keys so Raid Console matching works
    raidTypes,
    defenderAccess: "Conditional",

    async apply({ actor, entry }) {
      // Narrative-safe for now; Slice 4/5 will attach real mechanical riders per maneuver.
      return `Option Maneuver executed: ${pretty}.`;
    }
  };
}

/* ============================================================
   SLICE 3 — OPTION STRATEGIC ACTIVITY INJECTION
   ============================================================ */

function getPartyOptionStrategics(){
  const refined = game?.bbttcc?.api?.characterOptions?.refined;
  if (!refined?.getUnlocksForActor) return {};

  const actors = game.actors?.contents ?? [];
  const result = {};

  for (const a of actors) {
    if (a.type !== "character") continue;
    const unlocks = refined.getUnlocksForActor(a) || [];
    for (const u of unlocks) {
      if (!u?.l2) continue;
      const key = String(u.l2);
      result[key] ??= { count: 0, family: u.family, optionKey: u.optionKey };
      result[key].count++;
    }
  }

  return result;
}

async function queueHexTag({ targetUuid, tag }) {
  if (!targetUuid) return "No target";
  const ref = await fromUuid(targetUuid);
  const doc = ref?.document ?? ref;
  if (!doc) return "Bad target UUID";

  const pending = foundry.utils.getProperty(doc, `flags.${MOD_TERRITORY}.turn.pending`) || {};
  pending.repairs = pending.repairs || {};
  pending.repairs.addModifiers = Array.isArray(pending.repairs.addModifiers)
    ? pending.repairs.addModifiers.slice() : [];

  if (!pending.repairs.addModifiers.includes(tag)) {
    pending.repairs.addModifiers.push(tag);
  }

  await doc.update({ [`flags.${MOD_TERRITORY}.turn.pending`]: pending });
  return `Queued Hex Tag: "${tag}"`;
}

function buildOptionStrategicDef(key, meta){
  const pretty = _prettyTitle(key);
  const spec = OPTION_L2_SPECS[key] || {};
  const mechTag = spec.mechTag || null;
  const storyOnly = !mechTag;

  const opCosts = spec.cost || {};
  const primaryKey = spec.primaryKey || "misc";

  const baseApply = async ({ entry }) => {
    const t = entry?.targetName || "Target";
    return `${pretty} planned for ${t}. (Option-driven; GM adjudicates.)`;
  };

  const mechApply = async ({ actor, entry }) => {
    const msgA = await baseApply({ entry });
    const tagMsg = entry?.targetUuid
      ? await queueHexTag({ targetUuid: entry.targetUuid, tag: mechTag })
      : `No target UUID provided; tag "${mechTag}" not queued.`;
    return [msgA, tagMsg].filter(Boolean).join(" • ");
  };

  return {
    kind: "strategic",
    band: "option",
    source: "character-option",
    optionKey: meta?.optionKey || null,

    // Planner polish metadata (slots into existing grouping look/feel)
    label: `⭐ ${pretty} [Option]`,
    primaryKey,
    opCosts,
    cost: opCosts,

    groupKey: "character_options",
    groupLabel: "Character Options",
    groupOrder: Number(spec.groupOrder || 90),

    storyOnly,
    apply: storyOnly ? baseApply : mechApply
  };
}

/* ============================================================
   EFFECTS REGISTRY (UNCHANGED + SAFE ADDITIONS)
   ============================================================ */

const EFFECTS = {




  /* ============================================================
   * STANDARD MANEUVERS (Core / Always-on definitions)
   * - These exist so Raid Console tooltips + costs are authoritative.
   * - If a maneuver is defined elsewhere (compendium/loader), this is still
   *   the canonical runtime metadata surface for Raid Console.
   * ============================================================ */

  radiant_rally: {
    kind: "maneuver",
    tier: 1,
    rarity: "common",
    minFactionTier: 1,
    availability: "standard",
    label: "Radiant Rally",
    primaryKey: "softpower",
    cost: { softpower: 1 },
    opCosts: { softpower: 1 },
    raidTypes: ["liberation","siege"],
    defenderAccess: "Yes",
    text: "On Success: +2 Morale (or negate Morale loss); Darkness −1."
  },

  supply_overrun: {
    kind: "maneuver",
    tier: 1,
    rarity: "common",
    minFactionTier: 1,
    availability: "standard",
    label: "Supply Overrun",
    primaryKey: "economy",
    cost: { economy: 1, violence: 1 },
    opCosts: { economy: 1, violence: 1 },
    raidTypes: ["assault","siege"],
    defenderAccess: "Yes",
    text: "On Success: capture supplies; gain +1 Economy OP next round."
  },

/* ============================================================
   NARRATIVE-UNLOCK STRATEGIC ACTIVITIES (Echo Archive Rewards)
   - These appear in the Activity Planner ONLY when unlocked.
   - Unlock gate: flags.bbttcc-factions.unlocks.strategics[unlockKey].unlocked === true
   ============================================================ */

terrain_calibration: {
  kind: "strategic",
  label: "Terrain Calibration",
  primaryKey: "logistics",
  cost: { logistics: 1 },
  opCosts: { logistics: 1 },
  tier: 1,
  rarity: "uncommon",
  source: "narrative-unlock",
  unlockKey: "terrain_calibration",
  groupKey: "echo_archive",
  groupLabel: "Echo Archive",
  groupOrder: 10,
  storyOnly: true,
  text: "Calibrate local terrain geometry; improve route certainty and reduce surprises (GM adjudicates)."
},

faultline_tuning: {
  kind: "strategic",
  label: "Faultline Tuning",
  primaryKey: "faith",
  cost: { faith: 1 },
  opCosts: { faith: 1 },
  tier: 1,
  rarity: "uncommon",
  source: "narrative-unlock",
  unlockKey: "faultline_tuning",
  groupKey: "echo_archive",
  groupLabel: "Echo Archive",
  groupOrder: 11,
  storyOnly: true,
  text: "Tune resonant faultlines and leylines; stabilize a region or reveal hidden pathways (GM adjudicates)."
},

auto_recon_sweep: {
  kind: "strategic",
  label: "Auto-Recon Sweep",
  primaryKey: "intrigue",
  cost: { intrigue: 1 },
  opCosts: { intrigue: 1 },
  tier: 1,
  rarity: "uncommon",
  source: "narrative-unlock",
  unlockKey: "auto_recon_sweep",
  groupKey: "echo_archive",
  groupLabel: "Echo Archive",
  groupOrder: 12,
  storyOnly: true,
  text: "Deploy drones/recorders to sweep nearby territory; gain intel and reduce risk on the next leg/turn (GM adjudicates)."
},



/* ============================================================
   BASE MANEUVERS (QOL TOOLTIP + REGISTRY COMPLETION)
   - These keys are referenced by Raid Console curated lists, but
     may not exist in EFFECTS in some builds. We define them here
     so tooltips + costs resolve deterministically.
   ============================================================ */

flank_attack: {
  kind: "maneuver",
  tier: 1,
  rarity: "common",
  label: "Flank Attack",
  cost: { violence: 1 },
  opCosts: { violence: 1 },
  raidTypes: ["assault","occupation","liberation"],
  defenderAccess: "No",
  text: "Strike from an unexpected angle; pressure the line and seize momentum."
},

supply_surge: {
  kind: "maneuver",
  tier: 1,
  rarity: "common",
  label: "Supply Surge",
  cost: { logistics: 1 },
  opCosts: { logistics: 1 },
  raidTypes: ["any"],
  defenderAccess: "Yes",
  text: "A sudden logistics push; gain a small tactical supply edge this round (GM adjudicates)."
},

defensive_entrenchment: {
  kind: "maneuver",
  tier: 1,
  rarity: "common",
  label: "Defensive Entrenchment",
  cost: { nonlethal: 1 },
  opCosts: { nonlethal: 1 },
  raidTypes: ["assault_defense","occupation","siege"],
  defenderAccess: "Yes",
  text: "Dig in and harden positions; defender DC +3 this round."
},

divine_favor: {
  kind: "maneuver",
  tier: 1,
  rarity: "common",
  label: "Divine Favor",
  cost: { faith: 1 },
  opCosts: { faith: 1 },
  raidTypes: ["ritual","liberation","any"],
  defenderAccess: "Conditional",
  text: "Call on providence; on success reduce Darkness pressure or negate a minor setback (GM adjudicates)."
},

  /* ============================================================
     NARRATIVE UNLOCK MANEUVERS (Encounter/Beat gated)
     - These appear in Raid Console when the faction has unlocked them
       via flags.bbttcc-factions.unlocks.maneuvers[unlockKey].unlocked === true
     - They are defined here (EFFECTS) so tooltips + costs resolve.
     ============================================================ */

  ghost_slip_infiltration: {
    kind: "maneuver",
    tier: 1,
    rarity: "uncommon",
    minFactionTier: 1,
    unlockKey: "ghost_slip_infiltration",
    label: "Ghost-Slip Infiltration",
    primaryKey: "intrigue",
    cost: { intrigue: 1 },
    opCosts: { intrigue: 1 },
    raidTypes: ["infiltration","espionage"],
    defenderAccess: "No",
    text: "Phase through the seams: ignore one defensive circumstance this round (GM adjudicates) and gain +2 to the attacker roll if the raid type is Infiltration/Espionage."
  },

  battlefield_harmony: {
    kind: "maneuver",
    tier: 1,
    rarity: "uncommon",
    minFactionTier: 1,
    unlockKey: "battlefield_harmony",
    label: "Battlefield Harmony",
    primaryKey: "softpower",
    cost: { softpower: 1 },
    opCosts: { softpower: 1 },
    raidTypes: ["assault","liberation","propaganda","courtly"],
    defenderAccess: "Conditional",
    text: "A chorus in the kill-zone: stabilize morale and coordination. On Success, treat the margin as +2 higher for outcome tiering (GM adjudicates until wired)."
  },

  sympathetic_stabilization: {
    kind: "maneuver",
    tier: 1,
    rarity: "uncommon",
    minFactionTier: 1,
    unlockKey: "sympathetic_stabilization",
    label: "Sympathetic Stabilization",
    primaryKey: "faith",
    cost: { faith: 1 },
    opCosts: { faith: 1 },
    raidTypes: ["ritual","siege","liberation","assault_defense"],
    defenderAccess: "Yes",
    text: "Bind the field with resonance. Reduce one negative consequence on Fail (or reduce incoming siege damage by 1) (GM adjudicates)."
  },

  gradient_surge: {
    kind: "maneuver",
    tier: 1,
    rarity: "uncommon",
    minFactionTier: 1,
    unlockKey: "gradient_surge",
    label: "Gradient Surge",
    primaryKey: "logistics",
    cost: { logistics: 1, economy: 1 },
    opCosts: { logistics: 1, economy: 1 },
    raidTypes: ["assault","occupation","liberation","blockade","espionage"],
    defenderAccess: "No",
    text: "Reposition through an economic gradient. Before rolling, you may convert 1 staged Economy into 1 staged Logistics (or vice versa) for this round (GM adjudicates)."
  },


  repair_fortifications: {
    kind: "strategic",
    label: "Repair Fortifications",
    cost: { economy: 2 },
    apply: async ({ actor, entry }) => {
      const targetUuid = entry?.targetUuid;
      if (!targetUuid) return "No target hex.";
      const hex = await fromUuid(targetUuid);
      const tf = copy(hex.flags?.[MOD_TERRITORY] ?? {});
      const fac = tf?.facilities?.primary;
      if (!fac) return "No facility to repair.";

      const cur = Number(fac.damageStep||0);
      if (cur <= 0) return "Already intact.";

      fac.damageStep = cur - 1;
      tf.facilities.primary = fac;
      await hex.update({ [`flags.${MOD_TERRITORY}`]: tf });
      return "Facility repaired by one step.";
    }
  },

  repair_rig: {
    kind: "strategic",
    label: "Repair Rig",
    cost: { economy: 2 },
    apply: async ({ actor }) => {
      const pick = await _promptPickRig();
      if (!pick) return "Repair cancelled.";

      const { faction, rigId } = pick;
      const rigs = _getRigs(faction);
      const rig = rigs.find(r => r.rigId === rigId);
      if (!rig) return "Rig not found.";

      const cur = Number(rig.damageStep || 0);
      if (cur <= 0) return "Rig already intact.";

      const next = cur - 1;
      const fromS = _rigStateFromStep(rig, cur);
      const toS   = _rigStateFromStep(rig, next);

      await _updateRig(faction, rigId, r => {
        r.damageStep = next;
        r.damageState = toS;
        r.lastRepairAt = Date.now();
        return r;
      });

      await pushWarLog(faction, {
        type: "raid",
        activity: "repair_rig",
        summary: `Repair Rig — ${rig.name}: ${fromS} → ${toS}`
      });

      return `Rig repaired: ${rig.name} (${fromS} → ${toS})`;
    }
  }
};

/* ============================================================
   API PUBLICATION (EXTENDED — PRESERVES ORIGINAL SHAPE)
   ============================================================ */


function _applyFxMetadata(){
  try {
    const FAMILY_BY_KEY = {
      radiant_rally: "faith",
      supply_overrun: "industrial",
      flank_attack: "martial",
      supply_surge: "industrial",
      defensive_entrenchment: "martial",
      divine_favor: "faith",
      ghost_slip_infiltration: "void",
      battlefield_harmony: "faith",
      sympathetic_stabilization: "faith",
      gradient_surge: "industrial",
      repair_fortifications: "industrial",
      repair_rig: "industrial"
    };
    for (const [k, eff] of Object.entries(EFFECTS || {})) {
      if (!eff || typeof eff !== "object") continue;
      if (!eff.fxKey) eff.fxKey = String(k);
      if (!eff.family && FAMILY_BY_KEY[k]) eff.family = FAMILY_BY_KEY[k];
    }
  } catch (e) {
    warn("FX metadata application failed (non-fatal)", e);
  }
}

function publishCompat(){
  game.bbttcc ??= { api:{} };
  game.bbttcc.api ??= {};
  game.bbttcc.api.raid ??= {};

  // Slice 2: inject option maneuvers (opt_<maneuverKey>)
  try {
    const optionMans = getPartyOptionManeuvers();
    for (const [key, meta] of Object.entries(optionMans)) {
      const effKey = `opt_${key}`;
      if (!EFFECTS[effKey]) {
        EFFECTS[effKey] = buildOptionManeuverDef(key, meta);
        log("Injected option maneuver:", effKey, meta);
      }
    }
  } catch (e) {
    warn("Option maneuver injection failed", e);
  }

  // Slice 3: inject option strategic activities (optact_<activityKey>)
  try {
    const optionActs = getPartyOptionStrategics();
    for (const [key, meta] of Object.entries(optionActs)) {
      const effKey = `optact_${key}`;
      if (!EFFECTS[effKey]) {
        EFFECTS[effKey] = buildOptionStrategicDef(key, meta);
        log("Injected option strategic activity:", effKey, meta);
      }
    }
  } catch (e) {
    warn("Option strategic injection failed", e);
  }

  // ------------------------------------------------------------
  // EFFECTS NORMALIZATION (docs parity)
  // - Normalizes raidTypes from human labels -> internal keys
  // - Normalizes defenderAccess ("Yes"/"Conditional") -> boolean
  //   while preserving the original label in defenderAccessMode.
  // This keeps console filtering consistent with documentation.
  // ------------------------------------------------------------
  function _normRaidTypeKey(raw){
    const s0 = String(raw || "").trim();
    if (!s0) return "";
    const s = s0.toLowerCase();

    // Already normalized keys
    const ok = ["assault","infiltration","espionage","blockade","occupation","liberation","propaganda","ritual","siege","courtly","infiltration_alarm","rig_combat","any"];
    if (ok.includes(s)) return s;

    // Common label aliases
    if (s.includes("ritual")) return "ritual";
    if (s.includes("tikkun")) return "ritual";
    if (s.includes("courtly")) return "courtly";
    if (s.includes("infiltration") && s.includes("alarm")) return "infiltration_alarm";

    // Defense variants (e.g., "Assault (defense)")
    if (s.includes("(defense)") || s.includes("defense")) {
      if (s.includes("assault")) return "assault_defense";
      if (s.includes("occupation")) return "occupation_defense";
      if (s.includes("siege")) return "siege_defense";
      // fallback: strip to base
    }

    // Parenthetical variants like "(pre-siege)" -> base type
    if (s.includes("assault")) return "assault";
    if (s.includes("occupation")) return "occupation";
    if (s.includes("liberation")) return "liberation";
    if (s.includes("propaganda")) return "propaganda";
    if (s.includes("espionage")) return "espionage";
    if (s.includes("blockade")) return "blockade";
    if (s.includes("infiltration")) return "infiltration";
    if (s.includes("siege")) return "siege";
    return "";
  }

  function _normalizeEffectsRegistry(){
    try {
      for (const [k, eff0] of Object.entries(EFFECTS || {})) {
        const eff = eff0;
        if (!eff || typeof eff !== "object") continue;

        // Normalize raidTypes (labels -> keys)
        if (eff.raidTypes != null) {
          const raw = eff.raidTypes;
          const arr = Array.isArray(raw) ? raw : [raw];
          const norm = [];
          for (const v of arr) {
            const nk = _normRaidTypeKey(v);
            if (nk && !norm.includes(nk)) norm.push(nk);
          }
          if (norm.length) {
            if (eff.raidTypesLabel == null) eff.raidTypesLabel = Array.isArray(raw) ? raw.slice() : String(raw);
            eff.raidTypes = norm;
          }
        }

        // Normalize defenderAccess ("Yes"/"Conditional"/"No" -> boolean) but preserve label
        if (typeof eff.defenderAccess === "string") {
          const label = String(eff.defenderAccess || "").trim();
          const lc = label.toLowerCase();
          if (eff.defenderAccessMode == null) eff.defenderAccessMode = label;
          // Yes / Conditional / True -> true, else false
          const ok = (lc === "yes" || lc === "conditional" || lc === "true" || lc === "y");
          eff.defenderAccessBool = ok;
          eff.defenderAccess = ok;
        } else if (typeof eff.defenderAccess === "boolean") {
          if (eff.defenderAccessMode == null) eff.defenderAccessMode = (eff.defenderAccess ? "Yes" : "No");
          eff.defenderAccessBool = eff.defenderAccess;
        }
      }
    } catch (e) {
      warn("EFFECTS normalization failed (non-fatal)", e);
    }
  }

  // Run normalization after injections (option maneuvers/strategics may add metadata).
  _normalizeEffectsRegistry();
  _applyFxMetadata();


  const api = {
    EFFECTS,
    getActivities: () =>
      Object.entries(EFFECTS)
        .filter(([_,e]) => e.kind === "strategic")
        .map(([key,e]) => ({ key, label:e.label, cost:e.cost })),
  };

  Object.assign(game.bbttcc.api.raid, api);
  const mod = game.modules.get(MOD_ID);
  mod.api ??= {};
  mod.api.raid = game.bbttcc.api.raid;

  log("Compat bridge published (polished option metadata for Planner + Raid Console).");
}

Hooks.once("ready", publishCompat);



/* ============================================================
 * Maneuver Availability Normalization (Standard vs Learned)
 * - Adds eff.availability: "standard" | "learned" (default: standard)
 * - Adds eff.unlockKey for learned (default: key)
 * - Policy:
 *    * Tier >= 2 => learned
 *    * Tier == 1 and key in {suppressive_fire, patch_the_breach, flash_interdict, last_stand_banner} => learned
 * ============================================================ */
(function(){
  function __bbttccNormalizeManeuverAvailability(){
    try {
      const raid = game.bbttcc?.api?.raid;
      const EFFECTS = raid?.EFFECTS || {};
      const learnedT1 = { suppressive_fire:true, patch_the_breach:true, flash_interdict:true, last_stand_banner:true };

      for (const [k, eff0] of Object.entries(EFFECTS)) {
        const eff = eff0 || {};
        if (String(eff.kind||"") !== "maneuver") continue;

        const tier = Number(eff.tier ?? eff.meta?.tier ?? 1) || 1;
        let availability = String(eff.availability || eff.meta?.availability || "").toLowerCase();

        if (!availability) {
          if (tier >= 2 || learnedT1[String(k).toLowerCase()]) availability = "learned";
          else availability = "standard";
          eff.availability = availability;
        } else {
          eff.availability = availability;
        }

        if ((eff.availability === "learned") && !eff.unlockKey) {
          eff.unlockKey = String(eff.meta?.unlockKey || k);
        }
      }
    } catch (e) {}
  }

  Hooks.once("ready", () => {
    __bbttccNormalizeManeuverAvailability();
    // retry once after late-attach overwrites
    setTimeout(__bbttccNormalizeManeuverAvailability, 250);
  });
})();
