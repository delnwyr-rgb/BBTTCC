/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · api.structures.js · Phase A
 * ─────────────────────────────────────────────────────────────────────────────
 * Material-BOM-driven Structure damage track. This file owns:
 *
 *   • Loading data tables (structural-families.json + material-family-map.json)
 *   • Pure derivation math (BOM → Plates max, Threshold, Resists, loadBearing)
 *   • Stamping a BOM onto an actor (writes flags + caches derived values)
 *   • Reading current Structure state
 *
 * Phase A scope: NO damage path. NO state transitions. NO Bulwark dispatch.
 * Those land in Phase B+. This file is pure schema + math + stamp.
 *
 * Spec: bbttcc-structures/STRUCTURE_DAMAGE_SPEC.md
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}]`;
const FAMILIES_URL = `modules/${MOD_ID}/data/structural-families.json`;
const FAMILY_MAP_URL = `modules/${MOD_ID}/data/material-family-map.json`;
const FLAG_SCOPE = MOD_ID;

let _FAMILIES = null;          // { families: {...}, stateThresholds: {...}, rubbleJitter: {...} }
let _FAMILY_MAP = null;        // { materialKeyToFamily: {...}, _heuristicHints: {...} }
let _PACK_ID_ITEMS = "bbttcc-master-content.items";

// ── Data load ────────────────────────────────────────────────────────────────

async function _loadTables() {
  if (_FAMILIES && _FAMILY_MAP) return;
  try {
    const [famResp, mapResp] = await Promise.all([fetch(FAMILIES_URL), fetch(FAMILY_MAP_URL)]);
    if (!famResp.ok) throw new Error(`families.json HTTP ${famResp.status}`);
    if (!mapResp.ok) throw new Error(`material-family-map.json HTTP ${mapResp.status}`);
    _FAMILIES = await famResp.json();
    _FAMILY_MAP = await mapResp.json();
  } catch (e) {
    console.error(TAG, "Failed to load data tables", e);
    throw e;
  }
}

// ── Family resolution ────────────────────────────────────────────────────────

/**
 * Resolve a material to its structural family.
 * Override map wins; if missing, fall back to tag-based heuristic; final
 * fallback is the default family declared in the map.
 *
 * @param {string} materialKey   from item.flags.fourththing.rfi.item.materialKey
 * @param {string[]} [tags]      from item.system.tags or .flags...rfi.item tags
 * @returns {string} family name (matches a key in FAMILIES.families)
 */
export function computeFamily(materialKey, tags = []) {
  if (!_FAMILY_MAP) {
    console.warn(TAG, "computeFamily called before tables loaded — returning 'salvage'");
    return "salvage";
  }
  const key = String(materialKey || "").toLowerCase();
  const override = _FAMILY_MAP.materialKeyToFamily?.[key];
  if (override) return override;

  const tagSet = (Array.isArray(tags) ? tags : []).map(t => String(t).toLowerCase());
  const hayKey = key;
  const rules = _FAMILY_MAP._heuristicHints?.rules ?? [];
  for (const rule of rules) {
    const needle = String(rule.ifTag || "").toLowerCase();
    if (!needle) continue;
    if (tagSet.some(t => t.includes(needle))) return rule.family;
    if (hayKey.includes(needle)) return rule.family;
  }
  return _FAMILY_MAP._heuristicHints?.defaultFamily ?? "salvage";
}

// ── Material catalog lookup ──────────────────────────────────────────────────

/**
 * Look up a material item in the Bad Eden items pack by materialKey.
 * Async — searches the pack index then loads the doc.
 *
 * @returns {Promise<{name, materialKey, tier, family, tags, img}|null>}
 */
export async function lookupMaterial(materialKey) {
  if (!materialKey) return null;
  const pack = game.packs.get(_PACK_ID_ITEMS);
  if (!pack) {
    console.warn(TAG, "Items pack not found:", _PACK_ID_ITEMS);
    return null;
  }
  const idx = await pack.getIndex({ fields: ["name", "flags.fourththing.rfi.item", "system.tags"] });
  const want = String(materialKey).toLowerCase();
  const hit = idx.find(e => {
    const k = e.flags?.fourththing?.rfi?.item?.materialKey;
    return String(k || "").toLowerCase() === want;
  });
  if (!hit) return null;
  const doc = await pack.getDocument(hit._id);
  const rfi = doc?.flags?.fourththing?.rfi?.item ?? {};
  const tags = Array.isArray(doc?.system?.tags) ? doc.system.tags : [];
  return {
    name: doc?.name ?? materialKey,
    materialKey,
    tier: rfi.tier ?? "I",
    family: computeFamily(materialKey, tags),
    tags,
    img: doc?.img ?? "icons/svg/mystery-man.svg"
  };
}

// ── Tier helpers ─────────────────────────────────────────────────────────────

const _TIER_NUM = { "I": 1, "II": 2, "III": 3, "IV": 4 };
function _tierToNum(t) {
  if (typeof t === "number") return t;
  return _TIER_NUM[String(t || "I").toUpperCase()] ?? 1;
}

// ── Pure derivation ──────────────────────────────────────────────────────────

/**
 * Derive Structure stats from a BOM. Pure function. Does not mutate actor.
 *
 * BOM entry shape: { materialKey, qty, family, tier, name?, tagsCache? }
 * If family or tier are missing from a BOM entry, falls back to computeFamily()
 * and assumes Tier I — but real stamping should always pass denormalized values.
 *
 * Resists/vulnerabilities use the canonical FT.DAMAGE_TYPES vocabulary
 * (kinetic/energy/poison/psychic/sephirotic/qliphothic/radiation) plus
 * optional flavor for flavor-modulated rules (e.g. stone vuln to
 * kinetic:concussive).
 *
 * @param {Array} bom
 * @returns {{
 *   platesMax: number,
 *   threshold: number,
 *   resists: Object,                   damageType → best factor (lowest)
 *   vulnerabilities: Object,           "type|flavor" key → entry
 *   loadBearing: boolean,
 *   breakdownByFamily: Object,
 *   totalUnits: number
 * }}
 */
export function deriveBOM(bom) {
  if (!_FAMILIES) {
    console.warn(TAG, "deriveBOM called before tables loaded; returning empty");
    return { platesMax: 0, threshold: 0, resists: {}, vulnerabilities: {}, loadBearing: false, breakdownByFamily: {}, totalUnits: 0 };
  }
  const fams = _FAMILIES.families;
  let platesMax = 0;
  let weightedTierSum = 0;
  let totalUnits = 0;
  const resists = {};         // canonical type → best factor (lowest)
  const vulnerabilities = {}; // "type|flavor" → entry
  const breakdown = {};
  let loadBearing = false;

  const mergeResist = (entry) => {
    if (!entry?.type) return;
    const t = String(entry.type).toLowerCase();
    const f = Number(entry.factor);
    if (!Number.isFinite(f) || f >= 1) return;
    if (resists[t] === undefined || f < resists[t]) resists[t] = f;
  };
  const mergeVuln = (entry) => {
    if (!entry?.type) return;
    const t = String(entry.type).toLowerCase();
    const flv = entry.flavor ? String(entry.flavor).toLowerCase() : "";
    const f = Number(entry.factor);
    if (!Number.isFinite(f) || f <= 1) return;
    const key = `${t}|${flv}`;
    if (vulnerabilities[key] === undefined || f > vulnerabilities[key].factor) {
      vulnerabilities[key] = { type: t, flavor: flv, factor: f };
    }
  };

  for (const row of (Array.isArray(bom) ? bom : [])) {
    const qty = Math.max(0, Number(row?.qty) || 0);
    if (qty <= 0) continue;
    const famKey = row.family || computeFamily(row.materialKey, row.tagsCache);
    const fam = fams[famKey];
    if (!fam) {
      console.warn(TAG, `deriveBOM: unknown family '${famKey}' for material '${row.materialKey}' — skipping`);
      continue;
    }
    const tierNum = _tierToNum(row.tier);

    platesMax += qty * (fam.plateCoef ?? 1);
    weightedTierSum += qty * tierNum * (fam.threshWeight ?? 1);
    totalUnits += qty;

    // Native resists
    for (const r of (fam.resists ?? [])) mergeResist(r);
    // Vulnerabilities
    for (const v of (fam.vulnerabilities ?? [])) mergeVuln(v);
    // Tag-driven resists (ward family)
    if (Array.isArray(fam.resistsFromTags)) {
      const tags = (Array.isArray(row.tagsCache) ? row.tagsCache : []).map(t => String(t).toLowerCase());
      for (const rule of fam.resistsFromTags) {
        const needle = String(rule.tagMatch || "").toLowerCase();
        if (!needle) continue;
        if (tags.some(t => t.includes(needle))) {
          mergeResist({ type: rule.type, factor: rule.factor });
        }
      }
    }

    if (fam.loadBearing) loadBearing = true;

    breakdown[famKey] = breakdown[famKey] ?? { qty: 0, plates: 0 };
    breakdown[famKey].qty += qty;
    breakdown[famKey].plates += qty * (fam.plateCoef ?? 1);
  }

  const threshold = totalUnits > 0 ? (weightedTierSum / totalUnits) : 0;

  return {
    platesMax,
    threshold: Number(threshold.toFixed(2)),
    resists,
    vulnerabilities,
    loadBearing,
    breakdownByFamily: breakdown,
    totalUnits
  };
}

/**
 * Resolve an incoming damageType (which may be a legacy/colloquial alias like
 * "fire" or "concussive") to its canonical FT.DAMAGE_TYPES key plus any
 * implicit flavor inferred from the alias. Returns { type, flavor }.
 *
 * Preserves the caller's explicit damageFlavor if already set; only injects
 * an alias-derived flavor when no flavor was declared.
 */
export function canonicalizeDamageType(damageType, damageFlavor = "") {
  const aliases = _FAMILIES?._typeAliases ?? {};
  const raw = String(damageType ?? "").toLowerCase();
  const explicitFlavor = String(damageFlavor ?? "").toLowerCase();
  if (!raw) return { type: "", flavor: explicitFlavor };
  // Already canonical?
  const CANON = new Set(["kinetic","energy","poison","psychic","sephirotic","qliphothic","radiation"]);
  if (CANON.has(raw)) return { type: raw, flavor: explicitFlavor };
  // Alias map
  const ali = aliases[raw];
  if (ali) {
    return {
      type: String(ali.type).toLowerCase(),
      flavor: explicitFlavor || String(ali.asFlavor ?? raw).toLowerCase()
    };
  }
  // Unknown — pass through as-is (won't match canonical resists but won't crash)
  return { type: raw, flavor: explicitFlavor };
}

// ── BOM normalization ────────────────────────────────────────────────────────

/**
 * Take a raw BOM (possibly just materialKey + qty) and return a fully
 * denormalized BOM with family / tier / name / tagsCache filled from the
 * catalog. Also records `originalQty` so the sheet panel + damage path can
 * compute material depletion percent (Phase B). Async because it hits the
 * items pack.
 */
export async function normalizeBOM(rawBom) {
  const out = [];
  for (const row of (Array.isArray(rawBom) ? rawBom : [])) {
    if (!row?.materialKey || !(Number(row.qty) > 0)) continue;
    const qty = Number(row.qty);
    // Phase B: respect existing originalQty if caller passed one (allows
    // re-stamp paths that want to preserve depletion baseline). Otherwise
    // initialize to qty.
    const originalQty = Number(row.originalQty) > 0 ? Number(row.originalQty) : qty;
    const cached = await lookupMaterial(row.materialKey);
    if (!cached) {
      // Still preserve the entry with best-effort defaults so the stamp doesn't
      // silently drop data; family resolves via heuristic on materialKey alone.
      out.push({
        materialKey: row.materialKey,
        qty,
        originalQty,
        family: row.family || computeFamily(row.materialKey, []),
        tier: row.tier || "I",
        name: row.name || row.materialKey,
        tagsCache: row.tagsCache || []
      });
      continue;
    }
    out.push({
      materialKey: row.materialKey,
      qty,
      originalQty,
      family: cached.family,
      tier: cached.tier,
      name: cached.name,
      tagsCache: cached.tags
    });
  }
  return out;
}

// ── State from plates ────────────────────────────────────────────────────────

/**
 * State = function(platesCurrent / platesMax, loadBearing).
 * Razed requires platesPct < razed.platesMin AND no load-bearing material.
 */
export function stateFromPlates(platesCurrent, platesMax, loadBearing) {
  if (!_FAMILIES) return "intact";
  const thr = _FAMILIES.stateThresholds;
  const pct = platesMax > 0 ? (platesCurrent / platesMax) : 1;
  if (pct >= thr.intact.platesMin) return "intact";
  if (pct >= thr.damaged.platesMin) return "damaged";
  if (pct >= thr.breached.platesMin) return "breached";
  if (loadBearing) return "breached"; // load-bearing lock — cannot reach razed
  return "razed";
}

// ── Stamping ─────────────────────────────────────────────────────────────────

/**
 * Stamp a BOM onto an actor. Normalizes, derives, and writes flags.
 *
 * @param {Actor} actor
 * @param {Array} rawBom              [{materialKey, qty}, ...]
 * @param {Object} opts
 *   - facilityMode (boolean)         Holdings Phase C scale
 *   - collapseProfile (object)       override defaults
 *   - resetCurrentPlates (boolean)   default true — fill current to new max
 */
export async function stampBOM(actor, rawBom, opts = {}) {
  if (!actor) throw new Error("stampBOM: actor is required");
  await _loadTables();

  const bom = await normalizeBOM(rawBom);
  const derived = deriveBOM(bom);

  const existing = actor.getFlag(FLAG_SCOPE, "plates") ?? null;
  const currentPlates = (opts.resetCurrentPlates === false && existing?.current != null)
    ? Math.min(existing.current, derived.platesMax)
    : derived.platesMax;

  const state = stateFromPlates(currentPlates, derived.platesMax, derived.loadBearing);

  const collapseProfile = opts.collapseProfile ?? {
    fallFt: 10,
    damageDice: "2d10",
    nonlethal: true,
    knockbackFt: 5,
    triggerState: "breached"
  };

  const payload = {
    hasStructure: true,
    facilityMode: !!opts.facilityMode,
    materialBOM: bom,
    state,
    plates: { current: currentPlates, max: derived.platesMax },
    threshold: derived.threshold,
    resists: derived.resists,
    vulnerabilities: derived.vulnerabilities,
    loadBearing: derived.loadBearing,
    collapseProfile,
    history: actor.getFlag(FLAG_SCOPE, "history") ?? []
  };

  await actor.update({ [`flags.${FLAG_SCOPE}`]: payload });
  return { ...payload, breakdownByFamily: derived.breakdownByFamily };
}

/**
 * Clear all Structure flags from an actor. Useful for paper-test cleanup.
 */
export async function clearStructure(actor) {
  if (!actor) return;
  await actor.update({ [`flags.-=${FLAG_SCOPE}`]: null });
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * Convenience getter for current Structure state.
 * @returns {Object|null} the full flag payload, or null if actor has no Structure.
 */
export function readState(actor) {
  if (!actor) return null;
  const f = actor.getFlag?.(FLAG_SCOPE, "hasStructure");
  if (!f) return null;
  return {
    hasStructure: true,
    facilityMode: !!actor.getFlag(FLAG_SCOPE, "facilityMode"),
    materialBOM:  actor.getFlag(FLAG_SCOPE, "materialBOM") ?? [],
    state:        actor.getFlag(FLAG_SCOPE, "state") ?? "intact",
    plates:       actor.getFlag(FLAG_SCOPE, "plates") ?? { current: 0, max: 0 },
    threshold:    actor.getFlag(FLAG_SCOPE, "threshold") ?? 0,
    resists:      actor.getFlag(FLAG_SCOPE, "resists") ?? {},
    vulnerabilities: actor.getFlag(FLAG_SCOPE, "vulnerabilities") ?? {},
    loadBearing:  !!actor.getFlag(FLAG_SCOPE, "loadBearing"),
    collapseProfile: actor.getFlag(FLAG_SCOPE, "collapseProfile") ?? null,
    history:      actor.getFlag(FLAG_SCOPE, "history") ?? []
  };
}

// ── Crew (who mans the structure) ─────────────────────────────────────────────
// Structures can be MANNED. Unlike rigs (pilot/gunner/engineer slots), a fortification
// holds an undifferentiated GARRISON pool whose capacity scales with the structure's size
// (plate count). Membership is a real relationship stored on the structure actor:
//   flags.bbttcc-structures.crew = { assigned: [{ tokenId, label, joinedStrength }] }
// Capacity is derived (not stored) unless an explicit `crewCapacity` flag overrides it.
// Live garrison STRENGTH is read from the crewing tokens by the consumer (the siege layer),
// so this stays decoupled from any one strength-flag convention.

function crewCapacity(actor) {
  if (!actor) return 0;
  const explicit = Number(actor.getFlag?.(FLAG_SCOPE, "crewCapacity"));
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const st = readState(actor);
  if (!st) return 0;
  const plateMax = Number(st.plates?.max) || 0;
  // ~0.6 garrison strength per plate, floored so even a small wall holds a token group.
  return plateMax > 0 ? Math.max(10, Math.round(plateMax * 0.6)) : 0;
}

function readCrew(actor) {
  const c = actor?.getFlag?.(FLAG_SCOPE, "crew") || {};
  const assigned = Array.isArray(c.assigned) ? c.assigned : [];
  return { capacity: crewCapacity(actor), assigned };
}

async function assignCrew(actor, { tokenId, label = "Garrison", strength = 0 } = {}) {
  if (!actor || !tokenId) return { ok: false, reason: "actor + tokenId required" };
  const c = foundry.utils.duplicate(actor.getFlag(FLAG_SCOPE, "crew") || {});
  c.assigned = Array.isArray(c.assigned) ? c.assigned : [];
  const idx = c.assigned.findIndex(m => m.tokenId === tokenId);
  const entry = { tokenId, label, joinedStrength: Number(strength) || 0 };
  if (idx >= 0) c.assigned[idx] = entry; else c.assigned.push(entry);
  await actor.setFlag(FLAG_SCOPE, "crew", c);
  return { ok: true, crew: readCrew(actor) };
}

async function releaseCrew(actor, tokenId) {
  if (!actor || !tokenId) return { ok: false };
  const c = foundry.utils.duplicate(actor.getFlag(FLAG_SCOPE, "crew") || {});
  c.assigned = (Array.isArray(c.assigned) ? c.assigned : []).filter(m => m.tokenId !== tokenId);
  await actor.setFlag(FLAG_SCOPE, "crew", c);
  return { ok: true, crew: readCrew(actor) };
}

// Fortifications are built through the rig-builder, so they inherit the generic VEHICLE crew
// model (pilot/gunner/engineer/crew) — which is nonsense on a wall ("boarded as pilot"). This
// zeroes those vehicle slots (and clears any actor stranded in them) so the rig CREW tab stops
// offering them. The wall's real garrison runs through the siege crew relationship above +
// the Siege HUD, not these vehicle seats. Idempotent; no-op if the actor has no crew schema.
async function retypeFortification(actor) {
  if (!actor?.system?.crew) return { ok: false, reason: "no crew schema" };
  const zero = { min: 0, max: 0 };
  try {
    await actor.update({
      "system.crew.capacity": { pilot: { ...zero }, gunner: { ...zero }, engineer: { ...zero }, crew: { ...zero } },
      "system.crew.slots": [],
      "system.crew.crewMin": 0,
      "system.crew.crewMax": 0
    });
  } catch (e) { return { ok: false, reason: e.message }; }
  return { ok: true };
}

// Full Repair — restore a structure to pristine: re-stamp from the original BOM (plates → max,
// state → intact) + clear the collapseFired one-shot so it can collapse again. The same logic
// behind the sheet's "Full Repair" button, exposed so reset macros / siege restore can call it.
async function fullRepair(actor) {
  const cur = readState(actor);
  if (!cur) return { ok: false, reason: "not a structure" };
  const rawBom = (cur.materialBOM || []).map(r => ({
    materialKey: r.materialKey,
    qty: Number(r.originalQty) > 0 ? r.originalQty : r.qty
  }));
  try {
    await stampBOM(actor, rawBom, { facilityMode: cur.facilityMode, collapseProfile: cur.collapseProfile, resetCurrentPlates: true });
    await actor.unsetFlag(FLAG_SCOPE, "collapseFired");
  } catch (e) { return { ok: false, reason: e.message }; }
  return { ok: true };
}

// ── API install ─────────────────────────────────────────────────────────────
// Per [[bbttcc-api-exposure-pattern]] memory: install at BOTH script-load AND
// Hooks.once("ready") to defend against load-order clobber + browser cache
// races. The API is a module-scope SINGLETON and _installApi only re-points
// game.bbttcc.api.structures at it — a fresh object per call would WIPE the
// extension keys the sibling scripts attach at ready (_wedge from
// damage-wedge, .bulwark, .triggerCollapse, .recipes): our async ready
// callback yields at the _loadTables await, the siblings attach to the
// current object, then a rebuild would clobber them. (Backported from the
// dnd5e build's structures gauntlet A4 finding 2026-06-12.)

const _API = {
  // Pure functions
  computeFamily,
  deriveBOM,
  stateFromPlates,
  canonicalizeDamageType,
  // I/O
  lookupMaterial,
  normalizeBOM,
  // Mutating
  stampBOM,
  clearStructure,
  fullRepair,
  // Reading
  readState,
  // Crew (who mans the structure)
  crew: { capacity: crewCapacity, read: readCrew, assign: assignCrew, release: releaseCrew, retypeFortification },
  // Tables (live refs; immutable in practice — load once)
  get FAMILIES() { return _FAMILIES?.families ?? {}; },
  get FAMILY_MAP() { return _FAMILY_MAP?.materialKeyToFamily ?? {}; },
  get STATE_THRESHOLDS() { return _FAMILIES?.stateThresholds ?? {}; },
  get RUBBLE_JITTER() { return _FAMILIES?.rubbleJitter ?? { formula: "1d4-1", min: 0, max: 3 }; },
  // Constants
  FLAG_SCOPE,
  MOD_ID,
  VERSION: "0.1.0-phaseA"
};

function _installApi() {
  try {
    if (!game.bbttcc) game.bbttcc = { api: {} };
    if (!game.bbttcc.api) game.bbttcc.api = {};
    game.bbttcc.api.structures = _API;
  } catch (e) {
    console.warn(TAG, "API install failed", e);
  }
}

_installApi();
Hooks.once("init",  async () => { await _loadTables(); _installApi(); });
Hooks.once("ready", async () => { await _loadTables(); _installApi(); console.log(TAG, "Phase A ready · v0.1.0"); });
