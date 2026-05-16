/**
 * BBTTCC Sorting Engine v2 — Tree of Life Wizard (Step 5, Option A + Hex Chrome).
 *
 * Standalone Foundry ApplicationV2. Self-contained: inline HTML + CSS, no
 * Handlebars template file. Pure quiz-flow descent — NO pickers per station.
 *
 * 2026-04-23 visual revision:
 *   • Hex chrome palette — gold + deep navy/blue, less monochromatic
 *   • Bigger default size (1500×900) with responsive stretch
 *   • Review screen now 3-column: Tree | Build Table | Description Pane
 *   • Description pane updates on row hover / focus / selection — shows full
 *     Mal-voiced description of the option the player is considering, supports
 *     both sorting-engine flow AND manual override decisions
 *   • OPTION_DESCRIPTIONS authored for canonical content (paths, doctrines,
 *     ancestries, heritages, sefirot) — Step 5.7 wires non-canonical (archetype,
 *     crew, occult, philosophy) to live pack data
 *
 * Phases (unchanged):
 *   Descent → Review → Finalize
 *
 * Opens via: game.bbttcc.openTreeWizardV2(actor?)
 */

import BBTTCCSortingEngineV2 from "./bbttcc-sorting-engine-v2.js";

const MOD_ID = "bbttcc-sorting-engine";
const LOG  = (...a) => console.log(`[${MOD_ID}:wizard-v2]`, ...a);
const WARN = (...a) => console.warn(`[${MOD_ID}:wizard-v2]`, ...a);

// ============================================================================
// Tree geometry
// ============================================================================

const TREE_COORDS = {
  1:  { x: 50, y:  6 }, 2:  { x: 78, y: 20 }, 3:  { x: 22, y: 20 },
  4:  { x: 78, y: 42 }, 5:  { x: 22, y: 42 }, 6:  { x: 50, y: 55 },
  7:  { x: 78, y: 70 }, 8:  { x: 22, y: 70 }, 9:  { x: 50, y: 82 },
  10: { x: 50, y: 95 }
};
const CLASSICAL_PATHS = [
  [1,2],[1,3],[1,6],[2,3],[2,4],[2,6],[3,5],[3,6],[4,5],[4,6],[4,7],
  [5,6],[5,8],[6,7],[6,8],[6,9],[7,8],[7,9],[7,10],[8,9],[8,10],[9,10]
];
const LIGHTNING_BOLT = [[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10]];

// ============================================================================
// Faculty constants — RFI starting array
// ============================================================================

const FACULTY_KEYS = ["violence", "intrigue", "presence", "body", "mind", "soul"];
const FACULTY_LABELS = {
  violence: "Violence", intrigue: "Intrigue", presence: "Presence",
  body: "Body", mind: "Mind", soul: "Soul"
};
const FACULTY_STARTING_ARRAY = [5, 4, 3, 3, 2, 2];

// ============================================================================
// Live description loading — pulls descriptions + images from the canonical
// content packs at runtime, matching what the existing character-wizard does.
// Single source of truth: the live compendium items.
// ============================================================================

// Pack keys per Sorting Engine category. Each value can be a string OR an
// array of fallback pack keys — wizard tries each in order until item found.
// Heritage isn't a registered pack in bbttcc-master-content/module.json, so we
// scan multiple candidates (heritages live as type=feat with flags.bbttcc.kind=heritage).
const SE_PACK_KEYS = {
  archetype:  "bbttcc-character-options.character-archetypes",
  crew:       "bbttcc-character-options.crew-types",
  alignment:  "bbttcc-character-options.sephirothic-alignments",
  occult:     "bbttcc-character-options.occult-associations",
  path:       "bbttcc-master-content.classes",
  doctrine:   "bbttcc-master-content.classes",  // subclasses live in classes pack
  ancestry:   "bbttcc-master-content.ancestries",
  heritage:   ["bbttcc-master-content.ancestries", "bbttcc-master-content.items", "bbttcc-master-content.heritages"]
  // philosophy: hardcoded in bbttcc-aae module — no pack, see PHILOSOPHY_STUB_DESCS below
};

// Political philosophies aren't in a pack — they're hardcoded in bbttcc-aae.
// Short stubs here for the 8 canonical philosophies; designer can replace once
// AAE exposes a description source.
const PHILOSOPHY_STUB_DESCS = {
  "Marxist/Communist":     { body: "<p>Class struggle as the engine of history. Power flows from collective ownership; politics is the work of redistributing what has been hoarded.</p>" },
  "Liberal":               { body: "<p>Individual rights, free institutions, the rule of law. Politics is the careful work of preserving the procedures that protect liberty.</p>" },
  "Social Democratic":     { body: "<p>Markets tempered by the welfare state. Politics is the negotiation between freedom and the floor everyone deserves to stand on.</p>" },
  "Libertarian":           { body: "<p>Maximum personal freedom, minimum coercion. Politics is mostly the work of preventing politics from doing too much.</p>" },
  "Authoritarian/Statist": { body: "<p>Order through hierarchy. Politics is the responsibility of those who can hold a society's shape against the chaos that wants to break it.</p>" },
  "Theocratic":            { body: "<p>Sacred law as the foundation of governance. Politics is the work of aligning earthly order with the higher pattern.</p>" },
  "Fascist":               { body: "<p>Nation, hierarchy, and force fused into one mythic identity. Politics is the conjuring of unity through enemies and rituals of belonging.</p>" },
  "Anarchist":             { body: "<p>Voluntary association, no rulers. Politics is the abolition of coercive structures and the building of mutual aid in their place.</p>" }
};

const _DEAD_INLINE_DESCRIPTIONS_REMOVED = {
  // Inline descriptions removed 2026-04-23. Source of truth is now the live
  // compendium packs (see SE_PACK_KEYS above and _loadDescription below).
  // Mirrors the existing character-wizard.js's getDescriptionHtml + docToPreview pattern.
  _: {
    "_unused":         "_____",
    "Bulwark":           "Defenders. The wall the others stand behind. Bulwarks make a body the world has to break before it touches anyone they protect.",
    "Cosmic Linguist":   "Readers and writers of the cosmic text. Where others see weather, the Linguist sees a sentence — and sometimes edits it.",
    "Dreamwalker":       "Walkers of the porous zones between waking and sleep. Step into another's dream, drag something back, leave a door open if needed.",
    "Harmony Marshal":   "Binders and balancers. The voice that ends a brawl, the hand that holds a faction together when it tries to fall apart.",
    "Pactkeeper":        "Oath-keepers. Treaty-readers. The ones who remember what was promised and have authority to enforce it. Civic memory with teeth.",
    "Shadow Courier":    "Movement specialists. Carries people, objects, and information through spaces other people can't reach. Some doors open to a Courier; others a Courier opens for them.",
    "Soul-Smith":        "Workers of soulstuff directly. Forge a sturdier spirit, repair a fractured one, reshape a soul that's grown the wrong way.",
    "Wyrdlens Adept":    "Sees how fate's threads knot. Pulls a thread, and the knot unravels itself — sometimes mercifully, sometimes not."
  },
  doctrine: {
    // Aurablade
    "Blood Hymn":        "The Fury aura turned to song. Violence as accompaniment to a deeper rhythm.",
    "Stillheart":        "The Resolve aura held steady. The blade that does not waver because the hand has settled.",
    "Void Edge":         "The Dread aura sharpened. The cut that makes the world quieter for having happened.",
    // Bulwark
    "Path of the Avalanche":  "Defense as cascade. Each blow caught, each catch becoming the next weapon. The wall that breaks back.",
    "Path of the Cataclyst":  "Pressure-turner. Bulwarks who absorb a crisis and convert it into the next move's fuel.",
    "Path of the Mountain":   "The immovable. What you defend, you defend like geology. Slow, total, indifferent to weather.",
    // Cosmic Linguist
    "Annotator":         "Margin-reader. Sees what's been written between every line of the world and adds the gloss.",
    "Metaphor Apostle":  "Carrier of symbolic truth. The oath that's also a parable, the contract that's also a story everyone has to live inside.",
    "Redactor":          "Silencer. The Linguist who removes what shouldn't have been said — sometimes a word, sometimes a name, sometimes a person.",
    // Dreamwalker
    "Trance of the Quiet Sun":      "The dream that doesn't spill blood. Walks softly, leaves no footprint.",
    "Trance of the Sapphire Gate":  "Walks the lucid corridor between sparks. The Gate is always open if you know where to look.",
    "Trance of the Thousand Faces": "Identity as toolkit. The Dreamwalker who can wear another's shape long enough to do what's needed.",
    // Harmony Marshal
    "Mandate of Accord":      "Tunes people the way others tune instruments. Cities the way others tune choirs.",
    "Mandate of Overwatch":   "Vantage is systems-level. The voice on the radio that knows where everything is and what's about to happen.",
    "Mandate of Resolve":     "Stability without stagnation. Pressure without cruelty. The Marshal who holds a line that nobody else could.",
    // Pactkeeper
    "Archivist of Precedent":         "Keeper of every prior accord. What was decided before is what will be decided again, with the Archivist's witness.",
    "Auditor":                        "Truth-checker. Holds language up to its referent and notes the discrepancies.",
    "Steward of Living Communities":  "Civic guardian. The Pactkeeper whose oath is to a place and the people in it, not to a treaty's text.",
    // Shadow Courier
    "Route of the Black Stair":       "Couriers who move through the layers nobody admits exist. Stairs that aren't on the map.",
    "Route of the Last Mile":         "The Courier who guarantees delivery, even — especially — through the worst kilometer of the trip.",
    "Route of the Wayfarer Tongue":   "Speaker of the ten dialects of the road. Negotiator with toll-keepers, decoder of hospitality codes, fixer of borders.",
    // Soul-Smith
    "Forge of Bound Light":           "Hammer kindness into armor. Make a soul that mercy can wear under fire.",
    "Forge of the Spark Reclaimer":   "Pull lost warmth from dead relics. The Smith who works with what was already broken.",
    "Forge of Victory":               "Craft banners the world can stand beneath. The Smith whose work outlasts the war it was made for.",
    // Wyrdlens Adept
    "Refraction of Foresight":  "Precognition through a repaired pane. Sees the bend in the road before it arrives.",
    "Refraction of Mercy":      "Turns the lens toward the kinder world. Makes the more compassionate outcome more visible — sometimes that's enough.",
    "Refraction of Truth":      "Angles the Lens until truth appears. The Adept who finds what the world is hiding from itself."
  },
  ancestry: {
    "Circuitborn":      "Synthetic minds given flesh. Lineage of Exo-Knights, Parallax, Salvage, and Synapse. Post-machine spirituality; the spark learned to wear silicon.",
    "Cryptidkin":       "Descendants of beings that were never supposed to be seen. Walk the edges of the map, the seams between what's mapped and what's only rumored.",
    "Echo-Diver":       "Bloodlines shaped by descent into the memory layer of reality. Carry other lives' shadows in their posture.",
    "Human":            "The broadest canvas — Cro-Magnon, Denisovan, Florensis, Neanderthal lineages. No specialty by birth; every specialty possible.",
    "Menhirkin":        "Descended from the stone-singers. Quiet bodies with deep roots. Slow patience that outlasts most problems.",
    "Oldenborn":        "From before the last remaking — Stormborn Nomad, Rustland Scavenger, and others. Bodies that remember worlds that ended.",
    "Qliph-Scarred":    "Shaped by contact with the Qliphoth. Carry a shadow that others can feel approaching.",
    "Sephirotic Scion": "Touched by the upper sefirot at birth. Light bleeds through at the wrong moments — sometimes a gift, sometimes a wound."
  },
  heritage: {
    "Circuitborn Heritage: Exo-Knight":      "Engineered hardshell lineage. Built for siege; built to outlast siege.",
    "Circuitborn Heritage: Parallax":        "Distributed-cognition lineage. Sees from multiple angles at once; struggles with single-point-of-view conversations.",
    "Circuitborn Heritage: Salvage":         "Reclaimers of broken kin. The lineage that remembers what was scrapped.",
    "Circuitborn Heritage: Synapse":         "Bridge-builders between machine and meat. Native fluency in both alphabets.",
    "Cryptidkin Heritage: Chupacabra":       "Predator lineage — the one that hunts what hunts everyone else.",
    "Cryptidkin Heritage: Furrykin":         "Many-clade lineage of Felid, Leporid, Mustelid, Ursid, Vulpin. Each clade a different relationship with the wild.",
    "Cryptidkin Heritage: Jackalope":        "The trickster lineage. Improbable bodies that refuse to be classified.",
    "Echo-Diver Heritage: Abyssal":          "Divers who go down deepest. Carry the silence of the bottom layer.",
    "Echo-Diver Heritage: Empyrean":         "Divers who go up — into the radiant memory above. Carry too much light; need shade to rest.",
    "Echo-Diver Heritage: Tellurian":        "Divers of the earth-memory. Knows what the soil remembers about who walked it before.",
    "Human Heritage: Cro-Magnon":            "The first cohort of full sapience. Carries the ancestral fire-circle in the body.",
    "Human Heritage: Denisovan":             "Mountain lineage of cold tolerance and deep lung capacity. Quiet, durable, far-traveling.",
    "Human Heritage: Florensis":             "Small-bodied lineage of island archipelagos. Compact, agile, long-memoried.",
    "Human Heritage: Neanderthal":           "Robust lineage of cold climates. Strong-armed, careful, excellent kin-keepers.",
    "Menhirkin Heritage: Igneous":           "Born of fire-stone. Heat-tolerant; tempers run hot then cool fast.",
    "Menhirkin Heritage: Metamorphic":       "Pressure-shaped. The lineage that becomes harder under stress, softer in safety.",
    "Menhirkin Heritage: Sedimentary":       "Layer-built. Carries the strata of every prior pressure visibly in the body.",
    "Oldenborn Heritage: Earthbound":        "The lineage that never let go of the ground. Roots-in-soil even now.",
    "Oldenborn Heritage: Lumenwrought":      "Light-woven bodies of an older epoch. Glow faintly in dark places.",
    "Oldenborn Heritage: Rustland Scavenger":"The lineage that stayed when the others left. Builders out of what was abandoned.",
    "Oldenborn Heritage: Stormborn Nomad":   "Wind-walkers. Built for the long migration; never quite at rest.",
    "Qliph-Scarred Heritage: Chthonic":      "The down-Scarred. Carries the gravity of the underworld in every step.",
    "Qliph-Scarred Heritage: Diabolic":      "The Scarred who learned to bargain with what wounded them.",
    "Qliph-Scarred Heritage: Husk":          "The Scarred whose body remembers the shape of an absence. Hollows that hum.",
    "Sephirotic Scion Heritage: Cherubic":   "Touched by Tiphareth. The Scion with too much heart-light; protects others from their own warmth.",
    "Sephirotic Scion Heritage: Ophanic":    "Touched by the spinning-wheel sefirot. The Scion of patterns and cycles.",
    "Sephirotic Scion Heritage: Seraphic":   "Touched by the highest fire. The Scion who carries an edge of the unbearable."
  },
  alignment: {
    "Keter":     "Crown. The calling that precedes form. To anchor here is to live always slightly outside yourself.",
    "Chokhmah":  "Wisdom. The flash before the knowing. To anchor here is to trust your first sight.",
    "Binah":     "Understanding. The womb that gives the flash structure. To anchor here is to be the one who organizes.",
    "Chesed":    "Mercy. The hand that keeps giving. To anchor here is to trust the open hand even when it costs.",
    "Gevurah":   "Severity. The fist that cuts. To anchor here is to know that no is sometimes the kindest word.",
    "Tiphareth": "Beauty. The balancing heart. To anchor here is to live where opposites have to share a room.",
    "Netzach":   "Endurance. The fire that won't go out. To anchor here is to have a cause you won't lay down.",
    "Hod":       "Splendor. The intellect that bows. To anchor here is to know your knowing has a horizon.",
    "Yesod":     "Foundation. The funnel of the Tree. To anchor here is to be the conduit others pass through.",
    "Malkuth":   "Kingdom. Where the soul touches earth. To anchor here is to live wholly in the body and the day."
  },
  // Stubs — Step 5.7 wires to live pack data (bbttcc-character-options + bbttcc-aae)
  archetype: {
    "_stub": "Description loads from bbttcc-character-options.character-archetypes pack. (Step 5.7 — pack-wire pending.)"
  },
  crew: {
    "_stub": "Description loads from bbttcc-character-options.crew-types pack. (Step 5.7 — pack-wire pending.)"
  },
  occult: {
    "_stub": "Description loads from bbttcc-character-options.occult-associations pack. (Step 5.7 — pack-wire pending.)"
  },
  philosophy: {
    "_stub": "Description loads from bbttcc-aae module's hardcoded philosophy table. (Step 5.7 — wire pending.)"
  }
};

// ----------------------------------------------------------------------------
// Pack-based description loader — single source of truth = live compendium
// ----------------------------------------------------------------------------

// Political philosophy label → AAE flag key map.
// flags.bbttcc-aae.politicalPhilosophy expects lowercase keys.
const _PHILOSOPHY_KEY_MAP = {
  "Marxist/Communist":     "marxist",
  "Liberal":               "liberal",
  "Social Democratic":     "social_democratic",
  "Libertarian":           "libertarian",
  "Authoritarian/Statist": "authoritarian",
  "Theocratic":            "theocratic",
  "Fascist":               "fascist",
  "Anarchist":             "anarchist"
};

// Scope constants for actor flag writes
const _BBTTCC_CO_SCOPE = "bbttcc-character-options";
const _AAE_SCOPE       = "bbttcc-aae";

// Module-scope caches (shared across wizard instances within a session).
const _SE_PACK_INDEX_CACHE = new Map();   // category → Map<normalizedName, { id, img, packKey, displayName }>
const _SE_DOC_CACHE        = new Map();   // `${category}:${docId}` → { name, img, descriptionHtml, source }

function _normalizeOptionName(s) {
  let n = String(s || "")
    .replace(/\s*\(BBTTCC\)\s*$/i, "")  // strip trailing "(BBTTCC)" suffix
    .replace(/\s*\/\s*/g, "/")           // canonicalize slash spacing: " / " or "/" both → "/"
    .toLowerCase().trim();
  // Sefirot transliteration aliases — pack uses Kether/Chokmah/Geburah, spec uses Keter/Chokhmah/Gevurah.
  // Both spellings normalize to the same canonical form so lookups work either direction.
  if (n === "kether") n = "keter";
  else if (n === "chokmah") n = "chokhmah";
  else if (n === "geburah") n = "gevurah";
  return n;
}

// Per-category index rules — handles pack-specific naming patterns.
//   skipIf:           predicate returning true to exclude an entry (e.g., tier variants)
//   stripPrefix:      string prefix to strip from pack item names (e.g., "Archetype: ")
//   stripTrailingParen: when true, strip a trailing "(...)" descriptor (used for archetypes
//                      where pack names like "Archetype: Death (Transformer)" map to spec name "Death")
//   filterFn:         predicate; entry must pass to be included (used for heritage filter)
const _SE_PACK_INDEX_RULES = {
  archetype: {
    stripPrefix:        "Archetype: ",
    skipIf:             (e) => /\(Tier \d+\)/.test(e.name),
    stripTrailingParen: true   // strip role descriptors: "Death (Transformer)" → "Death"
  },
  crew: {
    stripPrefix:        "Crew Type: ",
    skipIf:             (e) => /\(Tier \d+\)/.test(e.name)
  },
  alignment: {
    stripPrefix:        "Alignment: ",
    skipIf:             (e) => /\(Tier \d+\)/.test(e.name)
  },
  occult: {
    stripPrefix:        "Occult Association: ",
    skipIf:             (e) => /\(Tier \d+\)/.test(e.name)
    // NOT stripTrailingParen — occult uses slash-separated dual names like "Biomancer / Fleshcrafter"
  },
  heritage: {
    filterFn: (e) => e.type === "feat" && (e.flags?.bbttcc?.kind === "heritage" || /\bHeritage:/i.test(e.name))
  }
};

function _applyIndexRules(category, packEntry) {
  const rules = _SE_PACK_INDEX_RULES[category] || {};
  if (rules.skipIf && rules.skipIf(packEntry)) return null;
  if (rules.filterFn && !rules.filterFn(packEntry)) return null;
  let name = packEntry.name || "";
  if (rules.stripPrefix && name.startsWith(rules.stripPrefix)) name = name.slice(rules.stripPrefix.length);
  if (rules.stripTrailingParen) name = name.replace(/\s*\([^)]+\)\s*$/, "").trim();
  return name;
}

async function _loadPackIndex(category) {
  if (_SE_PACK_INDEX_CACHE.has(category)) return _SE_PACK_INDEX_CACHE.get(category);
  const raw = SE_PACK_KEYS[category];
  if (!raw) return null;
  const candidates = Array.isArray(raw) ? raw : [raw];

  const map = new Map();
  const triedPacks = [];
  let foundAny = false;

  for (const packKey of candidates) {
    const pack = game.packs?.get(packKey);
    if (!pack) {
      triedPacks.push(`${packKey}: not registered`);
      continue;
    }
    try {
      const idx = await pack.getIndex({ fields: ["name", "img", "type", "flags.bbttcc.kind"] });
      let added = 0;
      for (const entry of idx) {
        const processedName = _applyIndexRules(category, entry);
        if (processedName == null) continue;  // skipped by rules
        const norm = _normalizeOptionName(processedName);
        if (!map.has(norm)) {
          map.set(norm, { id: entry._id, img: entry.img || "", packKey, displayName: entry.name, processedName });
          added++;
        }
      }
      foundAny = foundAny || added > 0;
      triedPacks.push(`${packKey}: +${added}`);
    } catch (e) {
      triedPacks.push(`${packKey}: error`);
      console.warn(`[bbttcc-sorting-engine:wizard-v2] failed to index ${packKey}`, e);
    }
  }

  console.log(`[bbttcc-sorting-engine:wizard-v2] index built for "${category}" — ${map.size} items (${triedPacks.join(", ")})`);
  _SE_PACK_INDEX_CACHE.set(category, foundAny ? map : null);
  return foundAny ? map : null;
}

// Fuzzy fallback when exact normalized name doesn't match: substring lookup
function _fuzzyFindEntry(idx, normName) {
  if (!idx || !normName) return null;
  // Forward: pack item name contains lookup name (e.g., "death (bbttcc)" contains "death")
  for (const [k, entry] of idx.entries()) {
    if (k === normName) continue;
    if (k.includes(normName) || normName.includes(k)) return entry;
  }
  return null;
}

async function _loadDescription(category, optionName) {
  if (!optionName) return null;

  // Philosophy uses inline stubs (no pack)
  if (category === "philosophy") {
    const stub = PHILOSOPHY_STUB_DESCS[optionName];
    if (stub) return { name: optionName, img: "", descriptionHtml: stub.body, source: "bbttcc-aae", _fromStub: true };
    return { name: optionName, img: "", descriptionHtml: `<p><em>${optionName}</em></p>`, source: "bbttcc-aae" };
  }

  if (!SE_PACK_KEYS[category]) {
    return { name: optionName, img: "", descriptionHtml: `<p><em>(${category}: no pack source configured)</em></p>` };
  }

  const idx = await _loadPackIndex(category);
  if (!idx) return { name: optionName, img: "", descriptionHtml: `<p><em>Pack not loaded for category "${category}". Run <code>game.bbttcc.dumpSEPacks()</code> in console to inspect actual pack registration.</em></p>` };

  const norm = _normalizeOptionName(optionName);
  let entry = idx.get(norm) || _fuzzyFindEntry(idx, norm);
  if (!entry) {
    const sample = [...idx.keys()].slice(0, 5).join(", ");
    return { name: optionName, img: "", descriptionHtml: `<p><em>No matching item in pack for "${optionName}".</em></p><p><small>Pack has ${idx.size} items. Sample: ${sample}…</small></p>` };
  }

  const cacheKey = `${category}:${entry.id}`;
  if (_SE_DOC_CACHE.has(cacheKey)) return _SE_DOC_CACHE.get(cacheKey);

  const pack = game.packs.get(entry.packKey);
  try {
    const doc = await pack.getDocument(entry.id);
    if (!doc) return { name: optionName, img: entry.img, descriptionHtml: "<p><em>Document not found.</em></p>" };
    const sys = doc.system || {};
    const desc = sys.description || sys.details || {};
    let html = "";
    if (typeof desc === "string") html = desc;
    else if (desc?.value) html = desc.value;
    else if (desc?.chat)  html = desc.chat;
    const result = {
      name: doc.name,
      img: doc.img || entry.img || "",
      descriptionHtml: html || `<p><em>(No description authored yet for ${doc.name}.)</em></p>`,
      source: pack.metadata?.label || pack.collection || ""
    };
    _SE_DOC_CACHE.set(cacheKey, result);
    return result;
  } catch (e) {
    console.warn(`[bbttcc-sorting-engine:wizard-v2] failed to load doc ${entry.id} from ${entry.packKey}`, e);
    return { name: optionName, img: entry.img, descriptionHtml: `<p><em>Failed to load description.</em></p>` };
  }
}

// ============================================================================
// Tree Wizard V2 ApplicationV2
// ============================================================================

const { ApplicationV2 } = foundry.applications.api;

class BBTTCCTreeWizardV2 extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "bbttcc-tree-wizard-v2",
    tag: "div",
    classes: ["bbttcc-tree-wizard-v2"],
    window: {
      title: "Sorting Engine v2 — Tree of Life",
      resizable: true,
      contentClasses: ["bbttcc-tree-wizard-v2-content"]
    },
    position: { width: 1500, height: 900 },
    // Floor so small-screen users can't shrink past where the action footers
    // are reachable. Sticky-bottom CSS on the nav rows covers the rest.
    minWidth: 880,
    minHeight: 680
  };

  constructor(options = {}) {
    super(options);
    this._actor = options.actor || null;
    this._answers = {};
    this._currentStep = 1;
    this._phase = "descent";
    this._mode = "sorting";          // "sorting" (engine resolves) | "manual" (skip descent, pick everything)
    this._yesodBloomShown = false;
    this._suggestion = null;
    this._overrides = {};
    this._heritage = null;
    this._faculties = null;
    this._chargenAptitudes = ["", "", ""];   // 3 free L1 picks; armor skills excluded; rank-0 only at apply time
    this._characterName = options.actor?.name || "";

    // Description pane state — what's currently being described in the right column
    this._focusedCategory = null;
    this._focusedOptionName = null;
  }

  // ============================================================================
  // Render
  // ============================================================================

  async _renderHTML(_context, _options) {
    _injectStylesOnce();
    if (!BBTTCCSortingEngineV2.isReady()) {
      return _errorHtml("Sorting Engine v2 spec not loaded. Check console.");
    }
    if (this._phase === "review") return this._buildReviewHtml();
    return this._buildDescentHtml();
  }

  _replaceHTML(html, element, _options) {
    element.innerHTML = html;
    this._wireHandlers(element);
  }

  // ============================================================================
  // Phase 1: Descent
  // ============================================================================

  _buildDescentHtml() {
    const spec = BBTTCCSortingEngineV2.getSpec();
    const station = spec.stations[this._currentStep - 1];
    const tallyChip = this._currentStep > 8 ? this._buildTallyChipHtml() : "";

    return `
      <div class="bbttcc-twv2-grid">
        <div class="bbttcc-twv2-tree">
          ${this._buildTreeSvg(spec)}
          ${tallyChip}
        </div>
        <div class="bbttcc-twv2-panel">
          ${this._buildStationPanelHtml(station)}
        </div>
      </div>
    `;
  }

  _buildTreeSvg(spec) {
    const bloom = this._currentStep === 9 && !this._yesodBloomShown;
    const pathsSvg = CLASSICAL_PATHS.map(([a, b]) => {
      const pa = TREE_COORDS[a], pb = TREE_COORDS[b];
      return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="bbttcc-twv2-path"/>`;
    }).join("");
    const boltSvg = LIGHTNING_BOLT.map(([a, b]) => {
      const pa = TREE_COORDS[a], pb = TREE_COORDS[b];
      const active = a < this._currentStep;
      return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="bbttcc-twv2-bolt ${active ? "is-active" : ""}"/>`;
    }).join("");
    const nodesSvg = spec.stations.map(s => {
      const p = TREE_COORDS[s.index];
      const state = bloom ? "bloom" : this._nodeState(s.index);
      return `
        <g class="bbttcc-twv2-node state-${state}" data-station-index="${s.index}">
          <circle cx="${p.x}" cy="${p.y}" r="4.5" class="bbttcc-twv2-node-dot"/>
          <text x="${p.x}" y="${p.y - 7}" class="bbttcc-twv2-node-label">${s.sefirah.english}</text>
          <text x="${p.x}" y="${p.y + 10.5}" class="bbttcc-twv2-node-sublabel">${s.station}</text>
        </g>`;
    }).join("");
    return `
      <svg viewBox="-4 -8 108 122" preserveAspectRatio="xMidYMid meet" class="bbttcc-twv2-svg">
        <g class="bbttcc-twv2-paths-layer">${pathsSvg}</g>
        <g class="bbttcc-twv2-bolt-layer">${boltSvg}</g>
        <g class="bbttcc-twv2-nodes-layer">${nodesSvg}</g>
      </svg>
    `;
  }

  _buildTallyChipHtml() {
    const tally = BBTTCCSortingEngineV2.previewPillarTallyAtStep8(this._answers);
    const label = BBTTCCSortingEngineV2.classifyPillarTally(tally);
    return `<div class="bbttcc-twv2-tally-chip" title="Pillar lean as of Hod">${label}</div>`;
  }

  _nodeState(idx) {
    const station = BBTTCCSortingEngineV2.getSpec().stations[idx - 1];
    if (!station) return "dim";
    const answeredCount = station.questions.filter(q => this._answers[q.id]).length;
    const allAnswered = answeredCount === station.questions.length;
    if (idx < this._currentStep && allAnswered) return "lit";
    if (idx < this._currentStep) return "partial";
    if (idx === this._currentStep) return "current";
    return "dim";
  }

  _buildStationPanelHtml(station) {
    const stepBadge = `<div class="bbttcc-twv2-step-badge">Step ${this._currentStep} of 10 · ${station.sefirah.hebrew} · ${station.sefirah.english} · Pillar: ${station.pillar}</div>`;
    const title = `<h2 class="bbttcc-twv2-panel-title">${station.sefirah.english} — ${station.station}</h2>`;
    const orientation = `<blockquote class="bbttcc-twv2-orientation">${station.orientation}</blockquote>`;
    const questionsHtml = station.questions.map((q, i) => this._buildQuestionHtml(q, i)).join("");
    return `<div class="bbttcc-twv2-panel-scroll">${stepBadge}${title}${orientation}${questionsHtml}</div>${this._buildNavHtml(station)}`;
  }

  _buildQuestionHtml(q, idx) {
    const answersHtml = q.answers.map(a => {
      const checked = this._answers[q.id] === a.key ? "checked" : "";
      return `
        <label class="bbttcc-twv2-answer ${checked ? "is-selected" : ""}" data-question-id="${q.id}" data-answer-key="${a.key}">
          <input type="radio" name="q-${q.id}" value="${a.key}" ${checked} class="bbttcc-twv2-answer-radio"/>
          <span class="bbttcc-twv2-answer-key">${a.key}</span>
          <span class="bbttcc-twv2-answer-text">${_esc(a.text)}</span>
        </label>
      `;
    }).join("");
    return `
      <div class="bbttcc-twv2-question">
        <div class="bbttcc-twv2-question-meta">Question ${idx + 1} · ${q.axis}</div>
        <p class="bbttcc-twv2-question-prompt">${_esc(q.prompt)}</p>
        <div class="bbttcc-twv2-answers">${answersHtml}</div>
      </div>
    `;
  }

  _buildNavHtml(station) {
    const allAnswered = station.questions.every(q => this._answers[q.id]);
    const hasPrev = this._currentStep > 1;
    const isLast = this._currentStep === 10;
    let nextBtn = "";
    if (allAnswered) {
      nextBtn = isLast
        ? `<button type="button" data-action="finish-descent" class="bbttcc-twv2-btn bbttcc-twv2-btn-primary">See Your Descent's Suggestion ▶</button>`
        : `<button type="button" data-action="next" class="bbttcc-twv2-btn">Next ▶</button>`;
    } else {
      nextBtn = `<button type="button" disabled class="bbttcc-twv2-btn is-disabled">Answer both questions to continue</button>`;
    }
    return `
      <div class="bbttcc-twv2-nav">
        ${hasPrev ? `<button type="button" data-action="prev" class="bbttcc-twv2-btn">◀ Back</button>` : ""}
        ${nextBtn}
      </div>
      <div class="bbttcc-twv2-skip-row">
        <button type="button" data-action="skip-descent" class="bbttcc-twv2-skip-link" title="Skip the quiz and pick everything manually">
          Skip the descent — I know better than ten thousand years of hypersigil knowledge
        </button>
      </div>
    `;
  }

  // ============================================================================
  // Phase 2: Review (3 columns: Tree | Build Table | Description Pane)
  // ============================================================================

  _buildReviewHtml() {
    const spec = BBTTCCSortingEngineV2.getSpec();
    const sug = this._suggestion;
    const tally = sug.pillarTally;
    const label = sug.classification;

    // Default focus: the suggested path (or first available option in manual mode)
    if (!this._focusedCategory) {
      this._focusedCategory = "path";
      this._focusedOptionName = sug.build.path?.name || sug.rankings.path?.[0]?.name || null;
    }

    const isManual = this._mode === "manual";
    const heritageOptions = this._heritageOptionsFor(this._effective("ancestry"));
    const facultiesHtml = this._buildFacultiesHtml();
    const chargenAptitudesHtml = this._buildChargenAptitudesHtml();
    const treeFinal = this._buildFinalTreeSvg(spec, this._effective("alignment"));

    const buildRows = [
      this._buildRow("archetype",  "Archetype",            sug.build.archetype,  sug.rankings.archetype),
      this._buildRow("ancestry",   "Ancestry",             sug.build.ancestry,   sug.rankings.ancestry),
      this._buildHeritageRow(heritageOptions),
      this._buildRow("crew",       "Awesome Crew",         sug.build.crew,       sug.rankings.crew),
      this._buildRow("path",       "Path (Class)",         sug.build.path,       sug.rankings.path),
      this._buildRow("doctrine",   "Doctrine",             sug.build.doctrine,   this._currentDoctrineRanking(), "(filtered by Path)"),
      this._buildRow("philosophy", "Political Philosophy", sug.build.philosophy, sug.rankings.philosophy),
      this._buildRow("occult",     "Occult Association",   sug.build.occult,     sug.rankings.occult),
      this._buildRow("alignment",  "Sephirotic Alignment", sug.build.alignment,  sug.rankings.alignment)
    ].join("");

    const titleText = isManual ? "Build Your Character" : "Your Descent's Suggestion";
    const ledeText = isManual
      ? "Manual mode. The Tree didn't watch you descend, but it's still here. Pick what you know is yours. Hover any line to read what it means."
      : "The Tree has watched you descend. This is what it sees. Hover any line to read what it means; tweak any line if it doesn't fit.";
    const tallyHtml = isManual
      ? `<div class="bbttcc-twv2-tally-chip bbttcc-twv2-tally-chip-muted">Manual</div>`
      : `<div class="bbttcc-twv2-tally-chip">${label}</div>
         <div class="bbttcc-twv2-tally-detail">Mercy ${tally.mercy} · Severity ${tally.severity} · Neutral ${tally.neutral}</div>`;

    return `
      <div class="bbttcc-twv2-review">
        <div class="bbttcc-twv2-review-grid">
          <div class="bbttcc-twv2-review-tree">
            ${treeFinal}
            ${tallyHtml}
          </div>

          <div class="bbttcc-twv2-review-body">
            <div class="bbttcc-twv2-review-scroll">
              <h2 class="bbttcc-twv2-review-title">${titleText}</h2>
              <p class="bbttcc-twv2-review-lede">${ledeText}</p>
              <div class="bbttcc-twv2-name-row">
                <label class="bbttcc-twv2-name-label">Operative Name</label>
                <input type="text" data-character-name class="bbttcc-twv2-name-input" value="${_esc(this._characterName || "")}" placeholder="New Operative"/>
              </div>
              <div class="bbttcc-twv2-build-table">${buildRows}</div>
              <div class="bbttcc-twv2-faculties">
                <div class="bbttcc-twv2-section-title">Malkuth — Faculty Allocation</div>
                <p class="bbttcc-twv2-section-note">Distribute the starting array <strong>[5, 4, 3, 3, 2, 2]</strong> across the six RFI faculties. Each value used exactly once.</p>
                ${facultiesHtml}
              </div>
              <div class="bbttcc-twv2-chargen-aptitudes">
                <div class="bbttcc-twv2-section-title">Yesod — Aptitude Picks</div>
                <p class="bbttcc-twv2-section-note">Choose <strong>3 free aptitudes</strong> at character creation. Armor skills (Plating, Weave, Warding) come from your Path. Picks granted at rank&nbsp;1; if a class or heritage already grants the skill, that pick is dropped at finalize.</p>
                ${chargenAptitudesHtml}
              </div>
            </div>
            <div class="bbttcc-twv2-review-nav">
              <button type="button" data-action="back-to-descent" class="bbttcc-twv2-btn">◀ Back to Descent</button>
              <button type="button" data-action="finalize" class="bbttcc-twv2-btn bbttcc-twv2-btn-primary">Create Character ▶</button>
            </div>
          </div>

          <div class="bbttcc-twv2-describe-pane" data-describe-pane>
            ${this._buildDescriptionPaneHtml()}
          </div>
        </div>
      </div>
    `;
  }

  _buildFinalTreeSvg(spec, alignmentName) {
    const pathsSvg = CLASSICAL_PATHS.map(([a, b]) => {
      const pa = TREE_COORDS[a], pb = TREE_COORDS[b];
      return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="bbttcc-twv2-path"/>`;
    }).join("");
    const boltSvg = LIGHTNING_BOLT.map(([a, b]) => {
      const pa = TREE_COORDS[a], pb = TREE_COORDS[b];
      return `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}" class="bbttcc-twv2-bolt is-active"/>`;
    }).join("");
    const nodesSvg = spec.stations.map(s => {
      const p = TREE_COORDS[s.index];
      const isAnchor = s.sefirah.english === alignmentName;
      const stateClass = isAnchor ? "current" : "lit";
      return `
        <g class="bbttcc-twv2-node state-${stateClass}" data-station-index="${s.index}">
          <circle cx="${p.x}" cy="${p.y}" r="${isAnchor ? 5.5 : 4.5}" class="bbttcc-twv2-node-dot"/>
          <text x="${p.x}" y="${p.y - 7}" class="bbttcc-twv2-node-label">${s.sefirah.english}</text>
        </g>`;
    }).join("");
    return `
      <svg viewBox="-4 -8 108 122" preserveAspectRatio="xMidYMid meet" class="bbttcc-twv2-svg">
        <g>${pathsSvg}</g><g>${boltSvg}</g><g>${nodesSvg}</g>
      </svg>
    `;
  }

  _buildRow(category, label, suggestion, ranked, note = "") {
    const overrideName = this._overrides[category];
    const effective = overrideName || suggestion?.name || "—";
    const isOverridden = !!overrideName;
    const hint = note ? `<span class="bbttcc-twv2-row-note">${note}</span>` : "";
    const optionsHtml = (ranked || []).map(r => {
      const sel = r.name === effective ? "selected" : "";
      const score = (typeof r.score === "number") ? ` (${r.score})` : "";
      return `<option value="${_esc(r.name)}" ${sel}>${_esc(r.name)}${score}</option>`;
    }).join("");
    return `
      <div class="bbttcc-twv2-row" data-row-category="${category}" data-row-effective="${_esc(effective)}">
        <div class="bbttcc-twv2-row-label">${label}${hint}</div>
        <div class="bbttcc-twv2-row-value ${isOverridden ? "is-overridden" : ""}">
          <select data-override-category="${category}" class="bbttcc-twv2-row-select">${optionsHtml}</select>
          ${isOverridden ? `<span class="bbttcc-twv2-overridden-badge">tweaked</span>` : `<span class="bbttcc-twv2-suggested-badge">suggested</span>`}
        </div>
      </div>
    `;
  }

  _heritageOptionsFor(ancestryName) {
    const map = {
      "Circuitborn":      ["Exo-Knight", "Parallax", "Salvage", "Synapse"],
      "Cryptidkin":       ["Chupacabra", "Furrykin", "Jackalope"],
      "Echo-Diver":       ["Abyssal", "Empyrean", "Tellurian"],
      "Human":            ["Cro-Magnon", "Denisovan", "Florensis", "Neanderthal"],
      "Menhirkin":        ["Igneous", "Metamorphic", "Sedimentary"],
      "Oldenborn":        ["Earthbound", "Lumenwrought", "Rustland Scavenger", "Stormborn Nomad"],
      "Qliph-Scarred":    ["Chthonic", "Diabolic", "Husk"],
      "Sephirotic Scion": ["Cherubic", "Ophanic", "Seraphic"]
    };
    return (map[ancestryName] || []).map(h => `${ancestryName} Heritage: ${h}`);
  }

  _buildHeritageRow(options) {
    const current = this._heritage || "";
    const optsHtml = options.length
      ? `<option value="">— Pick a heritage —</option>` + options.map(o =>
          `<option value="${_esc(o)}" ${o === current ? "selected" : ""}>${_esc(o)}</option>`).join("")
      : `<option value="">(no heritages for this ancestry)</option>`;
    return `
      <div class="bbttcc-twv2-row" data-row-category="heritage" data-row-effective="${_esc(current)}">
        <div class="bbttcc-twv2-row-label">Heritage<span class="bbttcc-twv2-row-note">(player picks; filtered by Ancestry)</span></div>
        <div class="bbttcc-twv2-row-value ${current ? "is-overridden" : ""}">
          <select data-heritage-pick class="bbttcc-twv2-row-select">${optsHtml}</select>
          <span class="bbttcc-twv2-suggested-badge">${current ? "selected" : "needs pick"}</span>
        </div>
      </div>
    `;
  }

  _buildFacultiesHtml() {
    const f = this._faculties || this._defaultFacultyDistribution();
    return `
      <div class="bbttcc-twv2-faculty-grid">
        ${FACULTY_KEYS.map(k => {
          const optsHtml = FACULTY_STARTING_ARRAY.map(v => `<option value="${v}" ${f[k] === v ? "selected" : ""}>${v}</option>`).join("");
          return `
            <label class="bbttcc-twv2-faculty">
              <span class="bbttcc-twv2-faculty-label">${FACULTY_LABELS[k]}</span>
              <select data-faculty-key="${k}" class="bbttcc-twv2-faculty-select">${optsHtml}</select>
            </label>
          `;
        }).join("")}
      </div>
      <div class="bbttcc-twv2-faculty-warn" data-faculty-warn></div>
    `;
  }

  _defaultFacultyDistribution() {
    return Object.fromEntries(FACULTY_KEYS.map((k, i) => [k, FACULTY_STARTING_ARRAY[i]]));
  }

  // ── Chargen Aptitude Picks (3 free L1 picks) ─────────────────────────────
  // Armor skills are excluded universally (granted by Path). All 20 remaining
  // aptitudes are offered; conflicts with class/heritage grants are resolved
  // at finalize (skipped picks are reported in chat). Class-known auto-grants
  // are surfaced as disabled options up-front so the player doesn't waste a
  // pick — see _autoGrantedAptitudeKeys().
  //
  // PLAN mirrors master-content/tools/stamp-class-l1-aptitudes.macro.js. Each
  // class gets its armor skill + one or more combat skills. TCCs keep their
  // single PLAN combat skill; non-TCCs get all three combat aptitudes
  // (melee/brawl/firearms) — they're the front-line bodies and shouldn't have
  // to choose. Keep the PLAN map and the TCC set in sync if either changes.
  _classL1Plan() {
    return {
      "Bulwark":          { combat: "melee", armor: "plating" },
      "Aurablade":        { combat: "melee", armor: "weave"   },
      "Cosmic Linguist":  { combat: "brawl", armor: "weave"   },
      "Pactkeeper":       { combat: "brawl", armor: "warding" },
      "Dreamwalker":      { combat: "brawl", armor: "weave"   },
      "Harmony Marshal":  { combat: "melee", armor: "warding" },
      "Soul-Smith":       { combat: "melee", armor: "plating" },
      "Wyrdlens Adept":   { combat: "brawl", armor: "weave"   },
      "Shadow Courier":   { combat: "brawl", armor: "weave"   }
    };
  }

  _isTCCClass(className) {
    // Mirrors FT_TCC_IDENTIFIERS in systems/fourththing/module.js.
    return new Set([
      "Cosmic Linguist", "Pactkeeper", "Dreamwalker", "Wyrdlens Adept"
    ]).has(className);
  }

  _classL1Grants(className) {
    const row = this._classL1Plan()[className];
    if (!row) return [];
    const grants = [row.armor];
    if (this._isTCCClass(className)) grants.push(row.combat);
    else grants.push("melee", "brawl", "firearms");
    return Array.from(new Set(grants));
  }

  _autoGrantedAptitudeKeys() {
    return new Set(this._classL1Grants(this._effective("class")));
  }

  _buildChargenAptitudesHtml() {
    const APTITUDES = [
      ["melee",         "Melee (Violence)"],
      ["brawl",         "Brawl (Violence)"],
      ["firearms",      "Firearms (Violence)"],
      ["athletics",     "Athletics (Violence)"],
      ["stealth",       "Stealth (Intrigue)"],
      ["hacking",       "Hacking (Intrigue)"],
      ["tinkering",     "Tinkering (Intrigue)"],
      ["streetwise",    "Streetwise (Intrigue)"],
      ["diplomacy",     "Diplomacy (Presence)"],
      ["intimidation",  "Intimidation (Presence)"],
      ["empathy",       "Empathy (Presence)"],
      ["performance",   "Performance (Presence)"],
      ["perception",    "Perception (Mind)"],
      ["investigation", "Investigation (Mind)"],
      ["lore",          "Lore (Mind)"],
      ["occult",        "Occult (Mind)"],
      ["faith",         "Faith (Soul)"],
      ["meditation",    "Meditation (Soul)"],
      ["ritual",        "Ritual (Soul)"],
      ["insight",       "Insight (Soul)"]
    ];
    const slots = this._chargenAptitudes;
    const autoGranted = this._autoGrantedAptitudeKeys();
    return `
      <div class="bbttcc-twv2-chargen-aptitude-grid">
        ${[0, 1, 2].map(i => {
          const cur = slots[i] || "";
          const usedElsewhere = slots.filter((s, j) => j !== i && s);
          const optsHtml = `<option value="">— pick an aptitude —</option>` +
            APTITUDES
              .filter(([k]) => !usedElsewhere.includes(k))
              .map(([k, label]) => {
                const isAuto = autoGranted.has(k);
                const isSelected = cur === k;
                // Class auto-grants: render as disabled (greyed) so the player
                // can't pick them. Selected-but-now-auto picks fall through
                // here too — we keep them visible so the chat-finalize "pick
                // dropped" message still has something to talk about, but mark
                // them as redundant inline.
                const labelOut = isAuto ? `${label} — granted by class` : label;
                const disabled = isAuto && !isSelected ? "disabled" : "";
                return `<option value="${k}" ${isSelected ? "selected" : ""} ${disabled}>${labelOut}</option>`;
              })
              .join("");
          return `
            <label class="bbttcc-twv2-chargen-aptitude">
              <span class="bbttcc-twv2-chargen-aptitude-label">Pick ${i + 1}</span>
              <select data-chargen-aptitude-slot="${i}" class="bbttcc-twv2-chargen-aptitude-select">${optsHtml}</select>
            </label>
          `;
        }).join("")}
      </div>
    `;
  }

  _effective(category) {
    return this._overrides[category] || this._suggestion?.build?.[category]?.name || null;
  }

  // --- Description pane (pack-data driven) ---

  _buildDescriptionPaneHtml(loadedDoc = null) {
    const cat = this._focusedCategory;
    const name = this._focusedOptionName;

    if (!name) {
      return `
        <div class="bbttcc-twv2-describe-empty">
          <div class="bbttcc-twv2-describe-empty-title">Hover any row to read.</div>
          <div class="bbttcc-twv2-describe-empty-sub">The Tree's suggestion is on the left. Tweak any line if it doesn't fit. Open the dropdowns to see alternatives. The description here loads live from the compendium.</div>
        </div>
      `;
    }

    const traitWeights = this._traitWeightsFor(cat, name);
    const traitWeightHtml = traitWeights ? `
      <div class="bbttcc-twv2-describe-section">
        <div class="bbttcc-twv2-describe-section-title">Traits weighted by Sorting Engine</div>
        <div class="bbttcc-twv2-describe-traits">
          ${Object.entries(traitWeights).filter(([k]) => !k.startsWith("_")).map(([t, w]) => `<span class="bbttcc-twv2-trait-pill">${_esc(t)} ×${w}</span>`).join("")}
        </div>
      </div>` : "";

    const rankInfo = this._rankInfoFor(cat, name);

    if (!loadedDoc) {
      // Loading state — the async fetch is in flight
      return `
        <div class="bbttcc-twv2-describe-content">
          <div class="bbttcc-twv2-describe-cat">${_esc(this._categoryLabel(cat))}</div>
          <h3 class="bbttcc-twv2-describe-name">${_esc(name)}</h3>
          ${rankInfo}
          <div class="bbttcc-twv2-describe-body bbttcc-twv2-describe-loading"><em>Loading description from compendium…</em></div>
          ${traitWeightHtml}
        </div>
      `;
    }

    const imgHtml = loadedDoc.img
      ? `<img src="${_esc(loadedDoc.img)}" alt="" class="bbttcc-twv2-describe-img"/>`
      : "";
    const sourceLine = loadedDoc.source
      ? `<div class="bbttcc-twv2-describe-source">from ${_esc(loadedDoc.source)}</div>`
      : "";

    return `
      <div class="bbttcc-twv2-describe-content">
        <div class="bbttcc-twv2-describe-cat">${_esc(this._categoryLabel(cat))}</div>
        <div class="bbttcc-twv2-describe-header">
          ${imgHtml}
          <div class="bbttcc-twv2-describe-header-text">
            <h3 class="bbttcc-twv2-describe-name">${_esc(loadedDoc.name || name)}</h3>
            ${sourceLine}
            ${rankInfo}
          </div>
        </div>
        <div class="bbttcc-twv2-describe-body">${loadedDoc.descriptionHtml}</div>
        ${traitWeightHtml}
      </div>
    `;
  }

  _traitWeightsFor(category, name) {
    const spec = BBTTCCSortingEngineV2.getSpec();
    if (!spec) return null;
    if (category === "doctrine") {
      // Find which class this doctrine belongs to
      for (const [className, doctrines] of Object.entries(spec.resolverWeights.doctrine)) {
        if (className.startsWith("_")) continue;
        if (doctrines && doctrines[name]) return doctrines[name];
      }
      return null;
    }
    if (category === "heritage") return null; // not in resolverWeights
    return spec.resolverWeights[category]?.[name] || null;
  }

  _rankInfoFor(category, name) {
    if (!this._suggestion?.rankings) return "";
    const ranked = this._suggestion.rankings[category];
    if (!Array.isArray(ranked) || ranked.length === 0) return "";
    const entry = ranked.find(r => r.name === name);
    if (!entry) return "";
    const rank = ranked.indexOf(entry) + 1;
    const total = ranked.length;
    const isSuggested = rank === 1;
    const bonus = entry.alignmentBonus ? ` (+${entry.alignmentBonus} alignment)` : "";
    return `<div class="bbttcc-twv2-describe-rank">
      <span class="${isSuggested ? "is-top" : ""}">Rank ${rank} of ${total}</span>
      <span class="bbttcc-twv2-describe-score">Score ${entry.score}${bonus}</span>
    </div>`;
  }

  _categoryLabel(cat) {
    const map = {
      archetype: "Archetype", ancestry: "Ancestry", heritage: "Heritage",
      crew: "Awesome Crew", path: "Path (Class)", doctrine: "Doctrine",
      philosophy: "Political Philosophy", occult: "Occult Association",
      alignment: "Sephirotic Alignment"
    };
    return map[cat] || cat;
  }

  async _refreshDescribePane() {
    const root = this.element;
    if (!root) return;
    const pane = root.querySelector("[data-describe-pane]");
    if (!pane) return;

    const cat = this._focusedCategory;
    const name = this._focusedOptionName;

    // Render loading state immediately so the pane responds to focus changes
    pane.innerHTML = this._buildDescriptionPaneHtml(null);

    if (!name) return;

    try {
      const doc = await _loadDescription(cat, name);
      // If focus moved while we were fetching, drop this result
      if (this._focusedCategory !== cat || this._focusedOptionName !== name) return;
      // Re-query the pane (DOM may have re-rendered during the fetch)
      const livePane = this.element?.querySelector("[data-describe-pane]");
      if (livePane) livePane.innerHTML = this._buildDescriptionPaneHtml(doc);
    } catch (e) {
      WARN("description load failed", e);
    }
  }

  // ============================================================================
  // Handlers
  // ============================================================================

  _wireHandlers(root) {
    // Action buttons
    root.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", ev => this._onAction(ev, el));
    });

    if (this._phase === "descent") {
      root.querySelectorAll(".bbttcc-twv2-answer").forEach(label => {
        label.addEventListener("click", ev => {
          const qId = label.dataset.questionId;
          const aKey = label.dataset.answerKey;
          if (!qId || !aKey) return;
          this._answers[qId] = aKey;
          this.render({ force: true });
          ev.preventDefault();
        });
      });
      if (this._currentStep === 9 && !this._yesodBloomShown) {
        setTimeout(() => {
          this._yesodBloomShown = true;
          this.render({ force: true });
        }, 1100);
      }
    } else if (this._phase === "review") {
      // Kick off initial async description load for the focused option
      if (this._focusedOptionName) this._refreshDescribePane();
      // Override dropdowns
      root.querySelectorAll("[data-override-category]").forEach(sel => {
        sel.addEventListener("change", ev => {
          const cat = sel.dataset.overrideCategory;
          const val = sel.value;
          if (val === this._suggestion?.build?.[cat]?.name) delete this._overrides[cat];
          else this._overrides[cat] = val;
          // Update focus to the changed thing
          this._focusedCategory = cat;
          this._focusedOptionName = val;
          this.render({ force: true });
        });
        // While dropdown is open, focus follows the highlighted option for live description
        sel.addEventListener("focus", () => {
          this._focusedCategory = sel.dataset.overrideCategory;
          this._focusedOptionName = sel.value;
          this._refreshDescribePane();
        });
      });
      // Character name input
      const nameEl = root.querySelector("[data-character-name]");
      if (nameEl) {
        nameEl.addEventListener("input", () => {
          this._characterName = nameEl.value;
        });
      }
      // Heritage pick
      const heritageEl = root.querySelector("[data-heritage-pick]");
      if (heritageEl) {
        heritageEl.addEventListener("change", () => {
          this._heritage = heritageEl.value || null;
          this._focusedCategory = "heritage";
          this._focusedOptionName = this._heritage;
          this.render({ force: true });
        });
        heritageEl.addEventListener("focus", () => {
          this._focusedCategory = "heritage";
          this._focusedOptionName = heritageEl.value;
          this._refreshDescribePane();
        });
      }
      // Row hover → focus description on row's effective option
      root.querySelectorAll("[data-row-category]").forEach(row => {
        row.addEventListener("mouseenter", () => {
          this._focusedCategory = row.dataset.rowCategory;
          this._focusedOptionName = row.dataset.rowEffective || null;
          this._refreshDescribePane();
        });
      });
      // Faculty validation
      root.querySelectorAll("[data-faculty-key]").forEach(sel => {
        sel.addEventListener("change", () => {
          const f = {};
          root.querySelectorAll("[data-faculty-key]").forEach(s => {
            f[s.dataset.facultyKey] = Number(s.value);
          });
          this._faculties = f;
          this._validateFaculties(root);
        });
      });
      this._validateFaculties(root);
      // Chargen aptitude picks
      root.querySelectorAll("[data-chargen-aptitude-slot]").forEach(sel => {
        sel.addEventListener("change", () => {
          const idx = Number(sel.dataset.chargenAptitudeSlot);
          this._chargenAptitudes[idx] = sel.value || "";
          this.render({ force: true });
        });
      });
    }
  }

  _validateFaculties(root) {
    const warn = root.querySelector("[data-faculty-warn]");
    if (!warn) return true;
    const f = this._faculties || this._defaultFacultyDistribution();
    const used = FACULTY_KEYS.map(k => f[k]).sort((a, b) => b - a);
    const required = [...FACULTY_STARTING_ARRAY].sort((a, b) => b - a);
    const valid = used.length === required.length && used.every((v, i) => v === required[i]);
    warn.textContent = valid ? "" : `Each value in [5,4,3,3,2,2] must be used exactly once. Currently: [${used.join(",")}]`;
    warn.style.display = valid ? "none" : "block";
    return valid;
  }

  async _onAction(ev, el) {
    ev.preventDefault();
    ev.stopPropagation();
    const action = el.dataset.action;
    switch (action) {
      case "prev":              return this._onPrev();
      case "next":              return this._onNext();
      case "finish-descent":    return this._onFinishDescent();
      case "skip-descent":      return this._onSkipDescent();
      case "back-to-descent":   return this._onBackToDescent();
      case "finalize":          return this._onFinalize();
    }
  }

  async _onSkipDescent() {
    this._mode = "manual";
    this._suggestion = this._buildManualSuggestion();
    this._faculties = this._defaultFacultyDistribution();
    this._heritage = null;
    this._overrides = {};
    this._focusedCategory = null;
    this._focusedOptionName = null;
    this._phase = "review";
    LOG("descent skipped — entering manual mode");
    await this.render({ force: true });
  }

  _buildManualSuggestion() {
    // Manual-mode suggestion: alphabetically-ranked options with score=0 and null bests.
    // Player picks every category explicitly via the override dropdowns.
    const spec = BBTTCCSortingEngineV2.getSpec();
    const alphaOpts = (catKey) => Object.keys(spec.resolverWeights[catKey] || {})
      .filter(k => !k.startsWith("_"))
      .sort()
      .map(name => ({ name, score: 0 }));
    return {
      build: {
        archetype: null, ancestry: null, heritage: null, crew: null,
        path: null, doctrine: null, philosophy: null, occult: null, alignment: null,
        faculties: null
      },
      rankings: {
        archetype:  alphaOpts("archetype"),
        ancestry:   alphaOpts("ancestry"),
        crew:       alphaOpts("crew"),
        path:       alphaOpts("class"),
        doctrine:   [],   // populated reactively from effective path via _currentDoctrineRanking
        philosophy: alphaOpts("philosophy"),
        occult:     alphaOpts("occult"),
        alignment:  alphaOpts("alignment")
      },
      traitMap: {},
      pillarTally: { mercy: 0, severity: 0, neutral: 0 },
      classification: "—"
    };
  }

  // Doctrine options depend on the currently-effective path. Always recompute so that
  // changing the path override (or starting in manual mode) refreshes doctrine choices.
  _currentDoctrineRanking() {
    const spec = BBTTCCSortingEngineV2.getSpec();
    const effPath = this._effective("path");
    if (!effPath) return [];
    const docs = spec.resolverWeights.doctrine?.[effPath];
    if (!docs || typeof docs !== "object") return [];
    const names = Object.keys(docs).filter(k => !k.startsWith("_"));
    // If engine produced rankings, preserve scores; else flat 0
    const engineDoctrine = this._suggestion?.rankings?.doctrine || [];
    const scoreMap = new Map(engineDoctrine.map(r => [r.name, r.score]));
    return names.map(n => ({ name: n, score: scoreMap.get(n) ?? 0 }))
                .sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  }

  async _onPrev() {
    if (this._currentStep > 1) {
      this._currentStep -= 1;
      await this.render({ force: true });
    }
  }

  async _onNext() {
    const station = BBTTCCSortingEngineV2.getSpec().stations[this._currentStep - 1];
    const allAnswered = station.questions.every(q => this._answers[q.id]);
    if (!allAnswered) {
      ui.notifications?.warn("Answer both questions before advancing.");
      return;
    }
    if (this._currentStep < 10) {
      this._currentStep += 1;
      await this.render({ force: true });
    }
  }

  async _onFinishDescent() {
    const spec = BBTTCCSortingEngineV2.getSpec();
    const totalQs = spec.stations.reduce((n, s) => n + s.questions.length, 0);
    const answered = Object.keys(this._answers).length;
    if (answered < totalQs) {
      ui.notifications?.warn(`Descent incomplete (${answered} of ${totalQs} answered).`);
      return;
    }
    this._suggestion = BBTTCCSortingEngineV2.runFullDescent(this._answers);
    this._faculties = this._defaultFacultyDistribution();
    this._heritage = null;
    this._overrides = {};
    this._focusedCategory = null;
    this._focusedOptionName = null;
    this._phase = "review";
    LOG("descent complete", { build: this._suggestion.build, pillar: this._suggestion.pillarTally });
    await this.render({ force: true });
  }

  async _onBackToDescent() {
    this._phase = "descent";
    this._currentStep = 10;
    await this.render({ force: true });
  }

  async _onFinalize() {
    const root = this.element;
    const valid = this._validateFaculties(root);
    if (!valid) {
      ui.notifications?.warn("Faculty allocation is invalid. Use each value of [5,4,3,3,2,2] exactly once.");
      return;
    }
    if (!this._heritage) {
      ui.notifications?.warn("Heritage is required — pick one from the dropdown.");
      return;
    }
    const confirmed = this._buildConfirmedBuild();
    // No more dry-run branch — finalize always creates a new actor via the pipeline.
    // Prefer the known-good pipeline from bbttcc-auto-link. It creates a new actor
    // and runs the full creation flow (actor shell + base stats + identity flags +
    // per-category shortcut flags + item imports + nativeLinks + identity sync +
    // recalc). Same path the native character wizard uses on its own Finalize.
    const pipeline = game.bbttcc?.api?.autoLink?.runGuidedCreatePipeline;
    if (!pipeline) {
      ui.notifications?.error("Pipeline unavailable — bbttcc-auto-link's runGuidedCreatePipeline is not exposed. Is the module loaded?");
      WARN("game.bbttcc.api.autoLink.runGuidedCreatePipeline missing");
      return;
    }

    try {
      const payload = await this._buildPipelinePayload(confirmed);
      LOG("pipeline payload:", payload);

      const created = await pipeline(payload, { openSheet: true });

      // Stamp the Sorting Engine's own records on the newly-created actor
      if (created) {
        try {
          await BBTTCCSortingEngineV2.writePillarTally(created, this._suggestion.pillarTally);
          await created.setFlag(MOD_ID, "lastDescent", {
            timestamp: Date.now(),
            confirmedBuild: confirmed,
            traitMap: this._suggestion.traitMap,
            classification: this._suggestion.classification,
            mode: this._mode
          });
        } catch (e) {
          WARN("pillar tally / lastDescent write failed (actor created successfully)", e);
        }
        // Apply class L1 grants + chargen aptitude picks. Class L1 lands
        // first so the picks see them as conflicts and skip cleanly. Only
        // writes to rank-0 skills (idempotent — safe even if the AE-promotion
        // path already fired). The explicit grant here is a safety net: in
        // practice the stamped AEs on class T1 anchors don't always make it
        // through import → promotion, so armor/combat aptitudes can go missing
        // without this step.
        try {
          const ARMOR = new Set(["plating", "weave", "warding"]);
          const picks = (this._chargenAptitudes || []).filter(s => s && !ARMOR.has(s));
          const sys = created.system?.system ?? created.system ?? {};
          const skills = sys.skills ?? {};
          const updates = {};

          // 1) Class L1 (armor + combat — triple combat for non-TCCs)
          const classApplied = [];
          for (const k of this._classL1Grants(this._effective("class"))) {
            const cur = Number(skills[k]?.value ?? 0);
            if (cur > 0) continue;
            updates[`system.skills.${k}.value`] = 1;
            classApplied.push(k);
            // Mirror into the local view so step 2 sees the grant as a conflict.
            skills[k] = { ...(skills[k] || {}), value: 1 };
          }

          // 2) Chargen picks — rank-0 only, conflicts reported in chat
          const applied = [];
          const conflicted = [];
          for (const k of picks) {
            const cur = Number(skills[k]?.value ?? 0);
            if (cur > 0) {
              conflicted.push({ skill: k, rank: cur });
              continue;
            }
            updates[`system.skills.${k}.value`] = 1;
            applied.push(k);
            skills[k] = { ...(skills[k] || {}), value: 1 };
          }

          if (Object.keys(updates).length) await created.update(updates);
          if (classApplied.length || applied.length || conflicted.length) {
            const classHtml = classApplied.length
              ? `<p style="margin:0.2rem 0;color:#8fb9ff;font-size:0.82rem">Class L1 grants (rank 1): <b>${classApplied.join(", ")}</b></p>`
              : "";
            const appliedHtml = applied.length
              ? `<p style="margin:0.2rem 0;color:#6fcf97;font-size:0.82rem">Applied at rank 1: <b>${applied.join(", ")}</b></p>`
              : "";
            const conflictHtml = conflicted.length
              ? `<p style="margin:0.2rem 0;color:#d4a35f;font-size:0.78rem">Already granted by class/heritage (pick dropped — re-spend a free aptitude point if you wish): ${conflicted.map(c => `${c.skill} (rank ${c.rank})`).join(", ")}</p>`
              : "";
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: created }),
              content: `<div class="fourththing-roll">
                <div class="ft-roll-header"><span class="ft-roll-name">⊕ Chargen Aptitudes — ${created.name}</span></div>
                ${classHtml}${appliedHtml}${conflictHtml}
              </div>`
            });
          }
        } catch (e) {
          WARN("chargen aptitude apply failed (actor created successfully)", e);
        }
      }

      const headline = this._mode === "manual"
        ? `Created ${created?.name || "new operative"} manually`
        : `Created ${created?.name || "new operative"} — ${this._suggestion.classification}`;
      ui.notifications?.info(headline);
      LOG("finalize via pipeline complete", { actor: created?.name, mode: this._mode });
      this.close();
    } catch (e) {
      WARN("pipeline finalize failed", e);
      ui.notifications?.error(`Finalize failed: ${e.message}`);
    }
  }

  /**
   * Build the payload that runGuidedCreatePipeline expects.
   * Payload shape traced from bbttcc-auto-link/scripts/character-wizard.js:818+ and :820
   * (buildSelectionsFromRaw). Single source of truth = the live wizard.
   */
  async _buildPipelinePayload(build) {
    const resolveUuid = async (category, name) => {
      if (!name) return "";
      const idx = await _loadPackIndex(category);
      if (!idx) return "";
      const norm = _normalizeOptionName(name);
      const entry = idx.get(norm) || _fuzzyFindEntry(idx, norm);
      if (!entry) return "";
      return `Compendium.${entry.packKey}.Item.${entry.id}`;
    };

    const resolvePick = async (category, name) => {
      if (!name) return null;
      const idx = await _loadPackIndex(category);
      if (!idx) return null;
      const norm = _normalizeOptionName(name);
      const entry = idx.get(norm) || _fuzzyFindEntry(idx, norm);
      if (!entry) return null;
      return { pack: entry.packKey, id: entry.id };
    };

    const politicalKey = _PHILOSOPHY_KEY_MAP[build.philosophy?.name] || "";

    const payload = {
      name:         this._characterName || this._actor?.name || "New Operative",
      factionId:    "",
      baseStats:    build.faculties || this._defaultFacultyDistribution(),
      speciesUuid:  await resolveUuid("ancestry",  build.ancestry?.name),
      heritageUuid: await resolveUuid("heritage",  build.heritage?.name),
      classUuid:    await resolveUuid("path",      build.path?.name),
      subclassUuid: await resolveUuid("doctrine",  build.doctrine?.name),
      picks: {
        archetype: await resolvePick("archetype", build.archetype?.name),
        crew:      await resolvePick("crew",      build.crew?.name),
        sephirot:  await resolvePick("alignment", build.alignment?.name),  // build.alignment → pipeline's "sephirot" slot
        occult:    await resolvePick("occult",    build.occult?.name),
        political: politicalKey ? { id: politicalKey } : null
      }
    };

    // Strip nulls from picks (pipeline skips missing picks gracefully)
    for (const k of Object.keys(payload.picks)) {
      if (!payload.picks[k]) delete payload.picks[k];
    }
    return payload;
  }

  /**
   * Legacy direct-apply method — kept as a fallback only if the pipeline API isn't available.
   * Preferred path is runGuidedCreatePipeline via game.bbttcc.api.autoLink.
   */
  async _applyConfirmedBuildToActor(actor, build) {
    const log = [], warn = [];

    // ---- 1. Resolve + create embedded Items (ancestry, heritage, path, doctrine) ----
    const itemCategoriesToImport = ["ancestry", "heritage", "path", "doctrine"];
    const itemDataToCreate = [];
    const existingNames = new Set((actor.items?.contents || actor.items || []).map(i => i.name));

    for (const cat of itemCategoriesToImport) {
      const name = build[cat]?.name;
      if (!name) continue;
      try {
        const idx = await _loadPackIndex(cat);
        if (!idx) { warn.push(`${cat}: pack not loaded`); continue; }
        const norm = _normalizeOptionName(name);
        const entry = idx.get(norm) || _fuzzyFindEntry(idx, norm);
        if (!entry) { warn.push(`${cat}: no pack match for "${name}"`); continue; }
        const pack = game.packs.get(entry.packKey);
        const doc  = pack ? await pack.getDocument(entry.id) : null;
        if (!doc)  { warn.push(`${cat}: failed to load doc ${entry.id}`); continue; }
        if (existingNames.has(doc.name)) {
          log.push(`${cat}: "${doc.name}" already on actor, skipped`);
          continue;
        }
        itemDataToCreate.push(doc.toObject());
      } catch (e) {
        warn.push(`${cat}: ${e.message}`);
      }
    }

    if (itemDataToCreate.length) {
      try {
        const created = await actor.createEmbeddedDocuments("Item", itemDataToCreate);
        log.push(`items created: ${created.map(i => i.name).join(", ")}`);
      } catch (e) {
        warn.push(`item creation failed: ${e.message}`);
      }
    }

    // ---- 2. Identity flags (archetype, crew, sephirot/alignment, occult) ----
    const identityPatch = {};
    const perCategoryFlags = {};
    const identityMap = [
      ["archetype",  "archetype",             "archetype"],
      ["crew",       "crew",                  "crew"],
      ["alignment",  "sephirothicAlignment",  "sephirot"],   // build.alignment → patch.sephirothicAlignment, flag slot "sephirot"
      ["occult",     "occult",                "occult"]
    ];
    for (const [buildKey, patchKey, flagSlot] of identityMap) {
      const name = build[buildKey]?.name;
      if (!name) continue;
      try {
        const idx = await _loadPackIndex(buildKey);
        if (!idx) { warn.push(`${buildKey}: pack not indexed, identity flag skipped`); continue; }
        const norm = _normalizeOptionName(name);
        const entry = idx.get(norm) || _fuzzyFindEntry(idx, norm);
        if (!entry) { warn.push(`${buildKey}: no pack match for "${name}"`); continue; }
        const patchEntry = {
          key:        entry.id,
          id:         entry.id,
          pack:       entry.packKey,
          optionKey:  entry.id,
          identifier: entry.id,
          name:       entry.displayName || name
        };
        identityPatch[patchKey] = patchEntry;
        perCategoryFlags[flagSlot] = {
          pack:       entry.packKey,
          id:         entry.id,
          name:       entry.displayName || name,
          identifier: entry.id
        };
      } catch (e) {
        warn.push(`${buildKey}: ${e.message}`);
      }
    }

    if (Object.keys(identityPatch).length) {
      // Prefer the module's identity API if exposed; fall back to direct setFlag.
      const identityApi = game.bbttcc?.api?.identity;
      try {
        if (identityApi && typeof identityApi.setIdentityFlags === "function") {
          await identityApi.setIdentityFlags(actor.id, identityPatch);
          log.push(`identity flags via game.bbttcc.api.identity (${Object.keys(identityPatch).join(", ")})`);
        } else {
          await actor.setFlag(_BBTTCC_CO_SCOPE, "identity", identityPatch);
          log.push(`identity flags via setFlag fallback (${Object.keys(identityPatch).join(", ")})`);
        }
      } catch (e) {
        warn.push(`identity flag write failed: ${e.message}`);
      }
      // Also write per-category shortcut flags (matches existing wizard pattern)
      for (const [slot, data] of Object.entries(perCategoryFlags)) {
        try {
          await actor.setFlag(_BBTTCC_CO_SCOPE, slot, data);
        } catch (e) {
          warn.push(`per-category flag ${slot}: ${e.message}`);
        }
      }
    }

    // ---- 3. Political philosophy (AAE scope) ----
    if (build.philosophy?.name) {
      const key = _PHILOSOPHY_KEY_MAP[build.philosophy.name];
      if (key) {
        try {
          await actor.setFlag(_AAE_SCOPE, "politicalPhilosophy", key);
          log.push(`political philosophy: ${build.philosophy.name} → ${key}`);
        } catch (e) {
          warn.push(`political philosophy write failed: ${e.message}`);
        }
      } else {
        warn.push(`political philosophy "${build.philosophy.name}" has no AAE key mapping`);
      }
    }

    // ---- 4. RFI faculty attributes ----
    if (build.faculties) {
      const update = {};
      for (const key of FACULTY_KEYS) {
        const v = Number(build.faculties[key] ?? 0);
        update[`system.attributes.${key}.value`] = v;
      }
      try {
        await actor.update(update);
        log.push(`faculties: ${FACULTY_KEYS.map(k => `${FACULTY_LABELS[k].slice(0,3)}=${build.faculties[k]}`).join(" ")}`);
      } catch (e) {
        warn.push(`faculty update failed: ${e.message}`);
      }
    }

    return { log, warn };
  }

  _buildConfirmedBuild() {
    const sug = this._suggestion.build;
    const eff = (cat) => {
      const overrideName = this._overrides[cat];
      if (overrideName) return { name: overrideName, _overridden: true };
      return sug[cat];
    };
    return {
      archetype:  eff("archetype"),
      ancestry:   eff("ancestry"),
      heritage:   { name: this._heritage, _playerPick: true },
      crew:       eff("crew"),
      path:       eff("path"),
      doctrine:   eff("doctrine"),
      philosophy: eff("philosophy"),
      occult:     eff("occult"),
      alignment:  eff("alignment"),
      faculties:  { ...this._faculties, _playerPick: true }
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function _esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function _errorHtml(msg) {
  return `<div class="bbttcc-twv2-error"><strong>Tree Wizard error:</strong> ${msg}</div>`;
}

// ============================================================================
// Styles — Hex Chrome (gold + deep navy/blue)
// ============================================================================

let _stylesInjected = false;
function _injectStylesOnce() {
  if (_stylesInjected) return;
  const css = `
    /* === HEX CHROME palette ===
       gold:        #ffd24a (accent, primary)
       blue:        #5fa8ff (secondary accent, paths, focus)
       midnight:    #0a1428 (deep base)
       slate-blue:  rgba(20, 35, 65, 0.55) (panel surface)
       text:        #f4f0e0 (warm off-white)
    */
    .bbttcc-tree-wizard-v2-content {
      padding: 14px 16px 16px 16px;
      color: #f4f0e0;
      background: linear-gradient(135deg, #0a1428 0%, #0d1e3a 50%, #0a1428 100%);
      height: 100%;
      max-height: 100%;
      overflow: hidden;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .bbttcc-twv2-grid {
      display: grid;
      grid-template-columns: minmax(360px, 34%) 1fr;
      gap: 22px;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }
    .bbttcc-twv2-panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }
    .bbttcc-twv2-panel-scroll {
      flex: 1 1 auto;
      overflow-y: auto;
      min-height: 0;
      padding-right: 6px;
    }

    /* Tree column */
    .bbttcc-twv2-tree { display: flex; flex-direction: column; align-items: center; padding: 10px; }
    .bbttcc-twv2-svg { width: 100%; max-width: 560px; aspect-ratio: 1/1.05; }
    .bbttcc-twv2-path { stroke: rgba(95, 168, 255, 0.18); stroke-width: 0.3; fill: none; }
    .bbttcc-twv2-bolt { stroke: rgba(255, 215, 80, 0.18); stroke-width: 0.6; fill: none; }
    .bbttcc-twv2-bolt.is-active {
      stroke: rgba(255, 215, 80, 0.85); stroke-width: 0.95;
      filter: drop-shadow(0 0 1.5px rgba(255,215,80,0.7));
    }
    .bbttcc-twv2-node-dot { fill: #1a2540; stroke: #5fa8ff; stroke-width: 0.4; transition: all 0.35s ease; }
    .bbttcc-twv2-node-label { font-size: 2.4px; text-anchor: middle; fill: rgba(244,240,224,0.82); font-weight: 600; }
    .bbttcc-twv2-node-sublabel { font-size: 1.7px; text-anchor: middle; fill: rgba(95,168,255,0.6); letter-spacing: 0.06em; }
    .bbttcc-twv2-node.state-dim .bbttcc-twv2-node-dot { fill: #14233a; stroke: #2d4870; }
    .bbttcc-twv2-node.state-partial .bbttcc-twv2-node-dot { fill: #2d4870; stroke: #5fa8ff; }
    .bbttcc-twv2-node.state-lit .bbttcc-twv2-node-dot {
      fill: #d4a44a; stroke: #f0c968;
      filter: drop-shadow(0 0 1.2px rgba(212,164,74,0.7));
    }
    .bbttcc-twv2-node.state-current .bbttcc-twv2-node-dot {
      fill: #ffd24a; stroke: #fff3b0;
      filter: drop-shadow(0 0 3px rgba(255,210,74,0.95));
      animation: bbttccTwv2Pulse 1.5s ease-in-out infinite;
    }
    .bbttcc-twv2-node.state-bloom .bbttcc-twv2-node-dot {
      fill: #ffd24a; stroke: #fff3b0;
      filter: drop-shadow(0 0 4px rgba(255,210,74,1)) drop-shadow(0 0 8px rgba(95,168,255,0.6));
      animation: bbttccTwv2Bloom 1s ease-out;
    }
    @keyframes bbttccTwv2Pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
    @keyframes bbttccTwv2Bloom {
      0%   { opacity: 0.2; transform: scale(0.8); transform-origin: center; }
      100% { opacity: 1;   transform: scale(1); }
    }
    .bbttcc-twv2-tally-chip {
      margin-top: 10px; padding: 7px 14px;
      border: 1px solid rgba(255,215,80,0.5);
      border-radius: 16px;
      background: linear-gradient(90deg, rgba(255,215,80,0.12), rgba(95,168,255,0.08));
      color: #ffd24a; font-size: 12.5px; font-weight: 600; letter-spacing: 0.4px;
      box-shadow: 0 0 12px rgba(255,215,80,0.18);
    }
    .bbttcc-twv2-tally-detail {
      margin-top: 6px; font-size: 11px; color: rgba(95,168,255,0.65); letter-spacing: 0.3px;
    }

    /* Panel column (descent) */
    .bbttcc-twv2-panel {
      padding: 14px 18px 14px 18px;
      border-left: 1px solid rgba(95,168,255,0.18);
      background: linear-gradient(180deg, rgba(20,35,65,0.35) 0%, rgba(20,35,65,0.15) 100%);
      border-radius: 6px;
      overflow-y: auto; max-height: calc(100vh - 100px);
    }
    .bbttcc-twv2-step-badge {
      font-size: 11px; color: rgba(95,168,255,0.85);
      text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 8px;
    }
    .bbttcc-twv2-panel-title {
      font-size: 22px; font-weight: 700; color: #ffd24a;
      margin: 0 0 12px 0; text-shadow: 0 0 10px rgba(255,215,80,0.3);
    }
    .bbttcc-twv2-orientation {
      margin: 0 0 18px 0; padding: 12px 16px;
      border-left: 3px solid rgba(255,215,80,0.55);
      background: rgba(20,35,65,0.4);
      color: rgba(244,240,224,0.88); font-style: italic;
      font-size: 14.5px; line-height: 1.55;
      border-radius: 0 4px 4px 0;
    }

    /* Quiz */
    .bbttcc-twv2-question { margin-bottom: 22px; }
    .bbttcc-twv2-question-meta {
      font-size: 10.5px; color: rgba(255,215,80,0.62);
      text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px;
    }
    .bbttcc-twv2-question-prompt { font-size: 16px; color: #fff; font-weight: 500; margin: 0 0 12px 0; line-height: 1.45; }
    .bbttcc-twv2-answers { display: flex; flex-direction: column; gap: 7px; }
    .bbttcc-twv2-answer {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 14px;
      border: 1px solid rgba(95,168,255,0.18); border-radius: 4px;
      background: rgba(20,35,65,0.25); cursor: pointer; transition: all 0.15s ease;
    }
    .bbttcc-twv2-answer:hover {
      background: rgba(20,35,65,0.5); border-color: rgba(95,168,255,0.5);
      transform: translateX(2px);
    }
    .bbttcc-twv2-answer.is-selected {
      background: linear-gradient(90deg, rgba(255,215,80,0.12), rgba(95,168,255,0.08));
      border-color: rgba(255,215,80,0.65);
      box-shadow: inset 0 0 0 1px rgba(255,215,80,0.25), 0 0 8px rgba(255,215,80,0.15);
    }
    .bbttcc-twv2-answer-radio { margin: 3px 0 0 0; }
    .bbttcc-twv2-answer-key {
      font-weight: 700; color: #ffd24a; font-size: 13.5px; min-width: 18px;
    }
    .bbttcc-twv2-answer-text { font-size: 14px; color: rgba(244,240,224,0.9); line-height: 1.45; }

    /* Skip-descent pill */
    .bbttcc-twv2-skip-row {
      flex: 0 0 auto;
      margin-top: 10px; padding: 10px 0 4px 0;
      border-top: 1px dashed rgba(95,168,255,0.18);
      text-align: center;
    }
    .bbttcc-twv2-skip-link {
      display: inline-block; cursor: pointer;
      padding: 9px 20px; border-radius: 999px;
      background: linear-gradient(135deg, rgba(95,168,255,0.12) 0%, rgba(20,35,65,0.6) 100%);
      border: 1px solid rgba(95,168,255,0.55);
      color: rgba(244,240,224,0.88); font-size: 13px;
      font-style: italic; letter-spacing: 0.4px; line-height: 1.3;
      transition: all 0.2s ease;
      box-shadow: 0 0 0 0 rgba(255,215,80,0);
    }
    .bbttcc-twv2-skip-link:hover {
      background: linear-gradient(135deg, rgba(255,215,80,0.18) 0%, rgba(95,168,255,0.18) 100%);
      border-color: rgba(255,215,80,0.7);
      color: #ffd24a;
      box-shadow: 0 0 14px rgba(255,215,80,0.25);
      transform: translateY(-1px);
    }

    .bbttcc-twv2-tally-chip-muted {
      color: rgba(95,168,255,0.7) !important;
      border-color: rgba(95,168,255,0.4) !important;
      background: rgba(95,168,255,0.08) !important;
      box-shadow: none !important;
    }

    /* Nav — non-scrolling flex item at the bottom of .bbttcc-twv2-panel.
       The questions area scrolls above it; this row stays pinned. */
    .bbttcc-twv2-nav {
      flex: 0 0 auto;
      display: flex; gap: 10px; margin-top: 14px;
      padding: 12px 6px 4px 0;
      border-top: 1px solid rgba(95,168,255,0.22);
      background: rgba(10,20,40,0.0);
    }
    .bbttcc-twv2-btn {
      padding: 9px 16px; font-size: 13.5px; cursor: pointer;
      background: rgba(20,35,65,0.5); border: 1px solid rgba(95,168,255,0.4); color: #f4f0e0;
      border-radius: 3px; transition: all 0.15s ease;
    }
    .bbttcc-twv2-btn:hover { background: rgba(95,168,255,0.18); border-color: rgba(95,168,255,0.7); }
    .bbttcc-twv2-btn.is-disabled { opacity: 0.4; cursor: not-allowed; }
    .bbttcc-twv2-btn.is-disabled:hover { background: rgba(20,35,65,0.5); border-color: rgba(95,168,255,0.4); }
    .bbttcc-twv2-btn-primary {
      background: linear-gradient(90deg, rgba(255,215,80,0.22), rgba(255,215,80,0.15));
      border-color: rgba(255,215,80,0.7); color: #ffd24a; font-weight: 600;
      box-shadow: 0 0 12px rgba(255,215,80,0.18);
    }
    .bbttcc-twv2-btn-primary:hover {
      background: linear-gradient(90deg, rgba(255,215,80,0.32), rgba(255,215,80,0.22));
      box-shadow: 0 0 18px rgba(255,215,80,0.3);
    }

    /* Review screen — 3 columns: Tree | Build Table | Description Pane */
    .bbttcc-twv2-review { height: 100%; min-height: 0; display: flex; flex-direction: column; }
    .bbttcc-twv2-review-grid {
      display: grid;
      grid-template-columns: minmax(280px, 22%) minmax(440px, 1fr) minmax(300px, 28%);
      gap: 18px;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }
    .bbttcc-twv2-review-tree { display: flex; flex-direction: column; align-items: center; padding: 8px; min-height: 0; }
    .bbttcc-twv2-review-body {
      display: flex; flex-direction: column;
      min-height: 0; height: 100%;
      padding: 10px 14px;
      background: rgba(20,35,65,0.2); border-radius: 6px;
      border: 1px solid rgba(95,168,255,0.15);
      overflow: hidden;
    }
    .bbttcc-twv2-review-scroll {
      flex: 1 1 auto;
      overflow-y: auto;
      min-height: 0;
      padding-right: 6px;
    }
    .bbttcc-twv2-review-title {
      color: #ffd24a; font-size: 24px; margin: 0 0 6px 0;
      text-shadow: 0 0 14px rgba(255,215,80,0.3);
    }
    .bbttcc-twv2-review-lede { color: rgba(244,240,224,0.72); font-size: 14px; line-height: 1.55; margin: 0 0 22px 0; }

    /* Character name input (review) */
    .bbttcc-twv2-name-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 14px; margin-bottom: 18px;
      background: linear-gradient(90deg, rgba(255,215,80,0.08), rgba(20,35,65,0.5));
      border: 1px solid rgba(255,215,80,0.35); border-radius: 4px;
    }
    .bbttcc-twv2-name-label {
      font-size: 12px; color: rgba(255,215,80,0.85); font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;
    }
    .bbttcc-twv2-name-input {
      flex: 1; padding: 7px 12px; font-size: 16px;
      background: rgba(10,20,40,0.7); color: #ffd24a;
      border: 1px solid rgba(255,215,80,0.4); border-radius: 3px;
      font-weight: 600;
    }
    .bbttcc-twv2-name-input:focus {
      outline: none; border-color: rgba(255,215,80,0.8);
      box-shadow: 0 0 8px rgba(255,215,80,0.25);
    }

    .bbttcc-twv2-build-table { display: flex; flex-direction: column; gap: 7px; margin-bottom: 24px; }
    .bbttcc-twv2-row {
      display: grid; grid-template-columns: 200px 1fr; gap: 14px;
      padding: 10px 14px; background: rgba(20,35,65,0.3); border-radius: 4px;
      border: 1px solid rgba(95,168,255,0.18); align-items: center;
      transition: all 0.18s ease; cursor: pointer;
    }
    .bbttcc-twv2-row:hover {
      background: rgba(95,168,255,0.1);
      border-color: rgba(95,168,255,0.45);
      box-shadow: 0 0 10px rgba(95,168,255,0.15);
    }
    .bbttcc-twv2-row-label { color: rgba(244,240,224,0.78); font-size: 13.5px; font-weight: 500; }
    .bbttcc-twv2-row-note { display: block; font-size: 10.5px; color: rgba(95,168,255,0.55); font-weight: 400; margin-top: 2px; }
    .bbttcc-twv2-row-value { display: flex; gap: 9px; align-items: center; }
    .bbttcc-twv2-row-select {
      flex: 1; padding: 6px 10px; font-size: 13.5px;
      background: rgba(10,20,40,0.7); color: #f4f0e0;
      border: 1px solid rgba(95,168,255,0.3); border-radius: 3px;
    }
    .bbttcc-twv2-row-value.is-overridden .bbttcc-twv2-row-select { border-color: rgba(255,170,80,0.7); }
    .bbttcc-twv2-suggested-badge, .bbttcc-twv2-overridden-badge {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 8px;
      border-radius: 10px; font-weight: 600; white-space: nowrap;
    }
    .bbttcc-twv2-suggested-badge {
      color: rgba(255,215,80,0.9); border: 1px solid rgba(255,215,80,0.4);
      background: rgba(255,215,80,0.08);
    }
    .bbttcc-twv2-overridden-badge {
      color: #ffaa50; border: 1px solid rgba(255,170,80,0.55);
      background: rgba(255,170,80,0.12);
    }

    /* Faculty allocation */
    .bbttcc-twv2-faculties {
      padding: 16px 16px 14px 16px;
      background: linear-gradient(180deg, rgba(20,35,65,0.35), rgba(20,35,65,0.2));
      border: 1px solid rgba(95,168,255,0.22); border-radius: 4px; margin-bottom: 22px;
    }
    .bbttcc-twv2-section-title { color: #ffd24a; font-size: 15px; font-weight: 600; margin-bottom: 6px; }
    .bbttcc-twv2-section-note { color: rgba(244,240,224,0.65); font-size: 12.5px; margin: 0 0 12px 0; line-height: 1.5; }
    .bbttcc-twv2-faculty-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .bbttcc-twv2-faculty { display: flex; flex-direction: column; gap: 5px; }
    .bbttcc-twv2-faculty-label {
      font-size: 11.5px; color: rgba(95,168,255,0.85);
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .bbttcc-twv2-faculty-select {
      padding: 6px 10px; font-size: 13.5px;
      background: rgba(10,20,40,0.7); color: #f4f0e0;
      border: 1px solid rgba(95,168,255,0.3); border-radius: 3px;
    }
    .bbttcc-twv2-faculty-warn {
      color: #ff8888; font-size: 12.5px; margin-top: 10px; display: none;
    }

    .bbttcc-twv2-review-nav {
      flex: 0 0 auto;
      display: flex; gap: 12px; justify-content: flex-end;
      padding: 12px 6px 4px 0;
      border-top: 1px solid rgba(95,168,255,0.22);
      margin-top: 12px;
    }

    /* Description pane (3rd column) */
    .bbttcc-twv2-describe-pane {
      padding: 18px 18px 14px 18px;
      background: linear-gradient(160deg, rgba(20,35,65,0.5) 0%, rgba(15,28,55,0.7) 100%);
      border: 1px solid rgba(95,168,255,0.3); border-radius: 6px;
      overflow-y: auto; max-height: 100%;
      box-shadow: inset 0 0 30px rgba(95,168,255,0.05);
    }
    .bbttcc-twv2-describe-empty {
      display: flex; flex-direction: column; gap: 8px;
      color: rgba(95,168,255,0.6); padding-top: 30px;
    }
    .bbttcc-twv2-describe-empty-title {
      font-size: 14px; color: rgba(244,240,224,0.7); font-weight: 500;
    }
    .bbttcc-twv2-describe-empty-sub {
      font-size: 13px; color: rgba(244,240,224,0.55); line-height: 1.5;
    }
    .bbttcc-twv2-describe-cat {
      font-size: 11px; color: rgba(95,168,255,0.85);
      text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 4px;
    }
    .bbttcc-twv2-describe-name {
      font-size: 22px; color: #ffd24a; margin: 0 0 4px 0; font-weight: 700;
      text-shadow: 0 0 10px rgba(255,215,80,0.25); line-height: 1.2;
    }
    .bbttcc-twv2-describe-header {
      display: flex; gap: 14px; align-items: flex-start; margin-bottom: 12px;
    }
    .bbttcc-twv2-describe-header-text { flex: 1; min-width: 0; }
    .bbttcc-twv2-describe-img {
      width: 72px; height: 72px; flex-shrink: 0;
      object-fit: cover; border-radius: 6px;
      border: 1px solid rgba(255,215,80,0.4);
      box-shadow: 0 0 12px rgba(95,168,255,0.2);
      background: rgba(10,20,40,0.7);
    }
    .bbttcc-twv2-describe-source {
      font-size: 11px; color: rgba(95,168,255,0.7);
      letter-spacing: 0.4px; margin-bottom: 6px; font-style: italic;
    }
    .bbttcc-twv2-describe-loading {
      color: rgba(95,168,255,0.55) !important;
      border-left-color: rgba(95,168,255,0.4) !important;
    }
    /* Style the description body's HTML — pack content uses standard tags */
    .bbttcc-twv2-describe-body p { margin: 0 0 10px 0; }
    .bbttcc-twv2-describe-body p:last-child { margin-bottom: 0; }
    .bbttcc-twv2-describe-body strong { color: #ffd24a; }
    .bbttcc-twv2-describe-body em { color: rgba(95,168,255,0.85); }
    .bbttcc-twv2-describe-body ul, .bbttcc-twv2-describe-body ol { margin: 0 0 10px 18px; padding: 0; }
    .bbttcc-twv2-describe-body li { margin-bottom: 4px; }
    .bbttcc-twv2-describe-body h1, .bbttcc-twv2-describe-body h2,
    .bbttcc-twv2-describe-body h3, .bbttcc-twv2-describe-body h4 {
      color: #ffd24a; margin: 14px 0 6px 0; font-size: 15px;
    }
    .bbttcc-twv2-describe-body a { color: #5fa8ff; text-decoration: underline; }
    .bbttcc-twv2-describe-rank {
      display: flex; gap: 12px; margin-bottom: 14px; font-size: 11.5px;
      color: rgba(95,168,255,0.75); letter-spacing: 0.4px;
    }
    .bbttcc-twv2-describe-rank .is-top { color: #ffd24a; font-weight: 600; }
    .bbttcc-twv2-describe-score { color: rgba(244,240,224,0.65); }
    .bbttcc-twv2-describe-body {
      font-size: 14px; color: rgba(244,240,224,0.9); line-height: 1.6;
      margin-bottom: 18px; padding: 12px 14px;
      background: rgba(20,35,65,0.35); border-left: 2px solid rgba(255,215,80,0.4);
      border-radius: 0 4px 4px 0;
    }
    .bbttcc-twv2-describe-section {
      margin-top: 16px; padding-top: 14px;
      border-top: 1px solid rgba(95,168,255,0.18);
    }
    .bbttcc-twv2-describe-section-title {
      font-size: 11px; color: rgba(95,168,255,0.85);
      text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 8px;
    }
    .bbttcc-twv2-describe-traits { display: flex; flex-wrap: wrap; gap: 6px; }
    .bbttcc-twv2-trait-pill {
      font-size: 11.5px; padding: 3px 9px; border-radius: 10px;
      background: rgba(95,168,255,0.15); border: 1px solid rgba(95,168,255,0.35);
      color: rgba(244,240,224,0.85);
    }

    /* Errors */
    .bbttcc-twv2-error {
      padding: 18px; color: #ff8888;
      background: rgba(80,20,20,0.4); border: 1px solid rgba(255,70,70,0.4);
      border-radius: 4px;
    }
  `;
  const style = document.createElement("style");
  style.id = "bbttcc-twv2-styles";
  style.textContent = css;
  document.head.appendChild(style);
  _stylesInjected = true;
}

// ============================================================================
// Public entry
// ============================================================================

Hooks.once("ready", () => {
  game.bbttcc ??= {};
  game.bbttcc.openTreeWizardV2 = (actorOrNull) => {
    const actor = (actorOrNull && actorOrNull.documentName === "Actor") ? actorOrNull : null;
    const w = new BBTTCCTreeWizardV2({ actor });
    w.render({ force: true });
    return w;
  };

  // Diagnostic: dump actual canonical names from each pack so we can match spec → pack
  game.bbttcc.dumpSEPacks = async (category = null) => {
    const cats = category ? [category] : Object.keys(SE_PACK_KEYS);
    const out = {};
    for (const cat of cats) {
      const raw = SE_PACK_KEYS[cat];
      const candidates = Array.isArray(raw) ? raw : [raw];
      const found = [];
      for (const packKey of candidates) {
        const pack = game.packs?.get(packKey);
        if (!pack) {
          found.push({ packKey, status: "NOT REGISTERED" });
          continue;
        }
        try {
          const idx = await pack.getIndex({ fields: ["name", "type", "flags.bbttcc.kind", "system.classIdentifier"] });
          const items = [...idx].map(i => ({
            name: i.name,
            type: i.type,
            kind: i.flags?.bbttcc?.kind,
            classIdentifier: i["system.classIdentifier"]
          }));
          found.push({ packKey, status: `OK (${idx.size} items)`, items });
        } catch (e) {
          found.push({ packKey, status: `ERROR: ${e.message}` });
        }
      }
      out[cat] = found;
    }
    console.log("[bbttcc-sorting-engine] SE pack dump:", out);
    return out;
  };

  LOG("Option A wizard ready (Hex Chrome) — call game.bbttcc.openTreeWizardV2(actor) to open.");
  LOG("Diagnostic: game.bbttcc.dumpSEPacks() returns per-category pack contents.");
});

export default BBTTCCTreeWizardV2;
