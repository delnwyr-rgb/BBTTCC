/* BBTTCC Raid — Affiliation OP Contribution Table
 *
 * Per-NPC additive contribution to the faction's OP roll, derived from
 * affiliation slots on the actor.
 *
 * STORAGE PATHS (canonical):
 *   - flags.bbttcc-character-options.identity.{archetype,crew,occult,ancestry,sephirothicAlignment}
 *     (object metadata with .key/.optionKey/.identifier/.name; written by
 *      bbttcc-character-options/scripts/module.js setIdentityFlags())
 *   - flags.bbttcc-aae.politicalPhilosophy  (string enum, AAE flag — special-case per design lock)
 *
 * BOSS FALLBACK:
 *   - system.identity.archetype (free-text string, fourththing schema at
 *     template.json:497) — read as raw key when char-options identity flag absent.
 *
 * OP tracks (9 canonical): violence, nonlethal, intrigue, economy, softpower,
 *                          diplomacy, logistics, culture, faith.
 *
 * Values are integers added to the faction's OP roll value for that track at
 * roll-time (NOT to opBank — that's persistent and authored elsewhere).
 *
 * Per-item flag override: if an affiliation item carries
 *   flags.bbttcc-factions.opContribution = { violence: N, ... }
 * the engine prefers that block over the static table for that affiliation
 * key. Lets designers tune individual archetypes/crews/occults without
 * touching this file.
 */

const FCT_ID = "bbttcc-factions";
const AAE_ID = "bbttcc-aae";
const CHO_ID = "bbttcc-character-options";

const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

/* ----------------------------------------------------------------------
 * Static defaults — sephirotic alignment (10 sephiroth)
 * Mapping rationale: harmonizes with SEPH_OP in
 * bbttcc-factions/turn-extensions.enhancer.js:16 where applicable; extends
 * to fit per-NPC roll-contribution (vs. that file's per-hex turn bonus).
 *
 * Spellings match the canonical SEPH_OP keys: gevurah (not "geburah"),
 * tiferet (not "tiphereth").
 * -------------------------------------------------------------------- */
const SEPHIRAH_TABLE = {
  keter:    { faith:1 },                      // crown / sovereignty
  chokmah:  { economy:1 },                    // wisdom — matches turn-ext mapping
  binah:    { intrigue:1 },                   // understanding — matches turn-ext mapping
  chesed:   { softpower:1, diplomacy:1 },     // mercy — pacific/diplomatic flavor
  gevurah:  { violence:2 },                   // severity / war — matches turn-ext mapping
  tiferet:  { culture:1 },                    // beauty — matches turn-ext mapping
  netzach:  { violence:1 },                   // victory (turn-ext maps to "all"; per-NPC simpler = +1V)
  hod:      { faith:1 },                      // splendor — matches turn-ext mapping
  yesod:    { diplomacy:1, logistics:1 },     // foundation — matches turn-ext mapping + logistics
  malkuth:  { economy:1, logistics:1 }        // kingdom / material world
};

/* ----------------------------------------------------------------------
 * Static defaults — political persuasion (8 stances)
 * Stance keys taken from bbttcc-factions/module.js:20 AAE political options.
 * -------------------------------------------------------------------- */
const POLITICAL_TABLE = {
  authoritarian:    { violence:1, logistics:1 },
  liberal:          { economy:1, softpower:1 },
  marxist:          { nonlethal:1, economy:1 },
  "social democratic": { economy:1, diplomacy:1 },
  "social-democratic": { economy:1, diplomacy:1 },     // alt key form
  libertarian:      { intrigue:1, economy:1 },
  theocratic:       { faith:2 },
  fascist:          { violence:2 },
  anarchist:        { nonlethal:1, intrigue:1 }
};

/* ----------------------------------------------------------------------
 * Static defaults — ancestry (13 incl. 4 new non-playable)
 * Existing PC ancestries from bbttcc-master-content.ancestries pack +
 * the four new NP lineages authored in Phase F.
 *
 * Key form: lowercase, underscore-separated (matches pack file basenames).
 * Multiple key spellings per ancestry to handle tier-suffixed item names
 * ("dragon_tier1" still resolves to dragon row).
 * -------------------------------------------------------------------- */
const ANCESTRY_TABLE = {
  sephirotic:        { softpower:1, faith:1 },
  sephirotic_scion:  { softpower:1, faith:1 },
  menhirkin:         { violence:1, logistics:1 },
  oldenborn:         { intrigue:1, economy:1 },
  qliph:             { violence:1, intrigue:1 },
  qliph_scarred:     { violence:1, intrigue:1 },
  cryptidkin:        { nonlethal:1, culture:1 },
  circuitborn:       { intrigue:1, economy:1 },
  stormborn_nomad:   { violence:1, logistics:1 },
  echo_diver:        { intrigue:1, softpower:1 },
  human:             { /* tabula rasa */ },
  // Non-playable lineages (Phase F content)
  dragon:            { violence:2, logistics:1 },
  devil:             { violence:1, intrigue:1 },
  infernal:          { violence:1, intrigue:1 },
  angel:             { diplomacy:1, faith:1 },
  empyrean:          { diplomacy:1, faith:1 },
  eidolon:           { intrigue:1, faith:1 },
  outsider:          { intrigue:1, faith:1 }
};

/* ----------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------- */
function _normKey(s){
  return String(s||"").toLowerCase().trim().replace(/\s+/g,"_").replace(/-+/g,"_");
}

function _normSpaceKey(s){
  return String(s||"").toLowerCase().trim();
}

/** Reduce a tier-suffixed pack key to its ancestry root.
 *  e.g. "dragon_tier3" -> "dragon"; "cryptidkin_chupacabra_tier1" -> "cryptidkin_chupacabra" -> falls back to "cryptidkin"
 */
function _ancestryRootKey(raw){
  let k = _normKey(raw);
  k = k.replace(/_tier\d+$/, "");
  if (ANCESTRY_TABLE[k]) return k;
  // strip trailing variant tokens until we find a match or run out
  while (k.includes("_")) {
    k = k.replace(/_[^_]+$/, "");
    if (ANCESTRY_TABLE[k]) return k;
  }
  return k;
}

/** Pull the canonical key from an identity-slot object (archetype, crew, etc.)
 *  Priority: identifier > optionKey > name > key. Note: applyIdentitySlotChange
 *  in bbttcc-auto-link writes slot.key = doc.id (a Foundry ID), so it is the
 *  WORST candidate for static-table lookup — must be last fallback only.
 */
function _slotKey(slot){
  if (!slot || typeof slot !== "object") return "";
  return _normKey(slot.identifier || slot.optionKey || slot.name || slot.key || "");
}

/** Resolve the world item document for an identity slot, if loadable.
 *  Used to read per-item-flag overrides (flags.bbttcc-factions.opContribution).
 *  Returns null if the slot has no resolvable item or fromUuidSync isn't available.
 */
function _slotItemDoc(slot){
  try {
    if (!slot || typeof slot !== "object") return null;
    const id = slot.id;
    const pack = slot.pack;
    if (!id || !pack) return null;
    const uuid = `Compendium.${pack}.Item.${id}`;
    if (typeof fromUuidSync === "function") return fromUuidSync(uuid);
  } catch(_e){}
  return null;
}

/** Read per-item override flag block (or null). */
function _itemOverride(itemDoc){
  try {
    if (!itemDoc) return null;
    const block = itemDoc.getFlag?.(FCT_ID, "opContribution") || itemDoc?.flags?.[FCT_ID]?.opContribution;
    if (block && typeof block === "object" && !Array.isArray(block)) return block;
  } catch(_e){}
  return null;
}

/** Sum two contribution blocks into a fresh object. */
function _addInto(target, block){
  if (!block || typeof block !== "object") return target;
  for (const k of OP_KEYS) {
    const v = Number(block[k] || 0);
    if (Number.isFinite(v) && v) target[k] = (target[k] || 0) + v;
  }
  return target;
}

/* ----------------------------------------------------------------------
 * Per-actor contribution (full breakdown)
 *
 * Returns: {
 *   total: { violence:N, nonlethal:N, ... },     // sum across all affiliations
 *   parts: [                                     // for tooltip / chat-card breakdown
 *     { kind:"sephirah",  key:"gevurah",  ops:{violence:2}, source:"static" },
 *     { kind:"political", key:"fascist",  ops:{violence:2}, source:"static" },
 *     { kind:"ancestry",  key:"dragon",   ops:{violence:2,logistics:1}, source:"static" },
 *     { kind:"archetype", key:"warlord",  ops:{violence:1}, source:"item-flag" },
 *     ...
 *   ]
 * }
 * -------------------------------------------------------------------- */
function contributionBreakdown(actor){
  const result = { total: {}, parts: [] };
  if (!actor) return result;

  // Canonical storage: actor.flags["bbttcc-character-options"].identity (object slots).
  // Boss fallback: system.identity.archetype is a raw string in fourththing's
  // template.json — wrapped as a slot-object below so the rest of the engine
  // can treat all actors uniformly.
  const charOptId = (actor.getFlag?.(CHO_ID, "identity") || actor?.flags?.[CHO_ID]?.identity || {});
  const sysId     = foundry.utils.getProperty(actor, "system.identity") || {};

  // Wrap boss free-text archetype as a slot object so _slotKey can read it.
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

  // --- 1. Sephirotic alignment (static table; per-item override allowed)
  try {
    const slot = identity.sephirothicAlignment;
    const key = _slotKey(slot);
    if (key) {
      const itemDoc = _slotItemDoc(slot);
      const ovr = _itemOverride(itemDoc);
      const ops = ovr || SEPHIRAH_TABLE[key] || null;
      if (ops && Object.keys(ops).length) {
        const norm = {};
        _addInto(norm, ops);
        result.parts.push({ kind:"sephirah", key, ops: norm, source: ovr ? "item-flag" : "static" });
        _addInto(result.total, norm);
      }
    }
  } catch(_e){}

  // --- 2. Ancestry (static table w/ tier-stripping; per-item override allowed)
  try {
    const slot = identity.ancestry;
    const rawKey = _slotKey(slot);
    if (rawKey) {
      const itemDoc = _slotItemDoc(slot);
      const ovr = _itemOverride(itemDoc);
      const rootKey = _ancestryRootKey(rawKey);
      const ops = ovr || ANCESTRY_TABLE[rootKey] || ANCESTRY_TABLE[rawKey] || null;
      if (ops && Object.keys(ops).length) {
        const norm = {};
        _addInto(norm, ops);
        result.parts.push({ kind:"ancestry", key: rootKey || rawKey, ops: norm, source: ovr ? "item-flag" : "static" });
        _addInto(result.total, norm);
      }
    }
  } catch(_e){}

  // --- 3. Political persuasion (AAE flag special-case — schema kept dual-read per design lock)
  try {
    const stance = _normSpaceKey(actor.getFlag?.(AAE_ID, "politicalPhilosophy") || actor?.flags?.[AAE_ID]?.politicalPhilosophy);
    if (stance) {
      const ops = POLITICAL_TABLE[stance] || POLITICAL_TABLE[_normKey(stance)] || null;
      if (ops && Object.keys(ops).length) {
        const norm = {};
        _addInto(norm, ops);
        result.parts.push({ kind:"political", key: stance, ops: norm, source: "static" });
        _addInto(result.total, norm);
      }
    }
  } catch(_e){}

  // --- 4-6. Archetype / Crew / Occult — per-item-flag ONLY (no static defaults per design lock)
  for (const [slotName, kind] of [["archetype","archetype"],["crew","crew"],["occult","occult"]]) {
    try {
      const slot = identity[slotName];
      const key = _slotKey(slot);
      if (!key) continue;
      const itemDoc = _slotItemDoc(slot);
      const ovr = _itemOverride(itemDoc);
      if (!ovr || !Object.keys(ovr).length) continue;
      const norm = {};
      _addInto(norm, ovr);
      result.parts.push({ kind, key, ops: norm, source: "item-flag" });
      _addInto(result.total, norm);
    } catch(_e){}
  }

  return result;
}

/** Convenience: return only the integer value for one OP key. */
function contributionFor(actor, key){
  const k = _normSpaceKey(key);
  if (!k) return 0;
  const br = contributionBreakdown(actor);
  return Number(br.total[k] || 0);
}

/* ----------------------------------------------------------------------
 * Expose API
 * Per [[bbttcc-api-exposure-pattern]] — install at script-load AND ready
 * to survive load-order + browser-cache races.
 * -------------------------------------------------------------------- */
function _installAPI(){
  globalThis.BBTTCC_AffiliationOP = globalThis.BBTTCC_AffiliationOP || {};
  Object.assign(globalThis.BBTTCC_AffiliationOP, {
    OP_KEYS: OP_KEYS.slice(),
    SEPHIRAH_TABLE,
    POLITICAL_TABLE,
    ANCESTRY_TABLE,
    contributionBreakdown,
    contributionFor
  });
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.factions = game.bbttcc.api.factions || {};
    game.bbttcc.api.factions.affiliationOP = globalThis.BBTTCC_AffiliationOP;
  } catch(_e){}
}

_installAPI();
Hooks.once("ready", _installAPI);
