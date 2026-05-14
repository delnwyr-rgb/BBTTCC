// modules/bbttcc-auto-link/scripts/character-wizard.js
// v2.0.0 — BBTTCC Character Wizard (Roll for Initiation)
// Immersive guided workflow targeting the Roll for Initiation system:
// RFI attributes, subclass selection at level 1, and one-pass actor creation
// with class / subclass / ancestry features auto-imported.

const MOD = "bbttcc-auto-link";
const AAE_SCOPE = "bbttcc-aae";
const BBTTCC_SCOPE = "bbttcc-character-options";
const GUIDED_SCOPE = MOD;
const GUIDED_KEY = "guidedCharacterCreation";

const log = (...a) => console.log("[" + MOD + "]", ...a);
const warn = (...a) => console.warn("[" + MOD + "]", ...a);

const PACK_KEYS = {
  archetype: "bbttcc-character-options.character-archetypes",
  crew: "bbttcc-character-options.crew-types",
  sephirot: "bbttcc-character-options.sephirothic-alignments",
  occult: "bbttcc-character-options.occult-associations",
  enlight: "bbttcc-character-options.enlightenment-levels"
};

const DEFAULT_ENLIGHTENMENT_IDENTIFIER = "enlightenment-unawakened";

const BBTTCC_ITEM_PACKS = [
  "bbttcc-master-content.classes",
  "bbttcc-master-content.subclasses",
  "bbttcc-master-content.doctrines",
  "bbttcc-master-content.species",
  "bbttcc-master-content.ancestries"
];

// Roll for Initiation starting array. Defaults to 2 each per template.json;
// the wizard distributes a single non-D&D starting array across the six faculties.
const STARTING_ARRAY = [5, 4, 3, 3, 2, 2];
const ATTRIBUTE_KEYS = ["violence", "intrigue", "presence", "body", "mind", "soul"];
const ATTRIBUTE_LABELS = {
  violence: "Violence",
  intrigue: "Intrigue",
  presence: "Presence",
  body: "Body",
  mind: "Mind",
  soul: "Soul"
};

const AAE_POLITICAL_PHILOSOPHIES = [
  {
    key: "marxist",
    label: "Marxist / Communist",
    blurb: "Collective welfare, structural repair, and solidarity under pressure.",
    body: "<p>You believe systems should answer for the suffering they produce. Under pressure, you look for who benefits, who is harmed, and how survival can become collective rather than hoarded.</p>"
  },
  {
    key: "liberal",
    label: "Liberal",
    blurb: "Rights, restraint, and negotiated order.",
    body: "<p>You prefer bounded power, civic legitimacy, and solutions that preserve agency. You do not default to domination when the world gets ugly.</p>"
  },
  {
    key: "social_democratic",
    label: "Social Democratic",
    blurb: "Protection, balance, and durable social cohesion.",
    body: "<p>You stabilize groups under stress. You believe functioning systems should protect people, not feed on them, and you tend to shoulder responsibility when others begin to fragment.</p>"
  },
  {
    key: "libertarian",
    label: "Libertarian",
    blurb: "Autonomy, voluntary coordination, and fewer boots on throats.",
    body: "<p>You value initiative, breathing room, and negotiated exchange over coercive control. Your shadow shows up when freedom forgets obligation.</p>"
  },
  {
    key: "authoritarian",
    label: "Authoritarian / Statist",
    blurb: "Containment, command, and stability through control.",
    body: "<p>You trust disciplined systems more than improvisational hope. Chaos looks like the first enemy to you, and your danger is mistaking overreach for competence.</p>"
  },
  {
    key: "theocratic",
    label: "Theocratic",
    blurb: "Sacred order, moral meaning, and purification.",
    body: "<p>You orient toward values that are bigger than immediate expedience. Meaning matters to you as much as outcome, sometimes more.</p>"
  },
  {
    key: "fascist",
    label: "Fascist",
    blurb: "Dominance, hardening, and victory mistaken for order.",
    body: "<p>You trend toward coercive clarity under stress. You value decisive strength, but your shadow is cruelty dressed up as necessity.</p>"
  },
  {
    key: "anarchist",
    label: "Anarchist",
    blurb: "Distributed intelligence, anti-domination, and freedom as structure.",
    body: "<p>You distrust imposed hierarchy and prefer adaptive, local, human-scale response. Your danger is underweighting the real burden of coordination.</p>"
  }
];

const IDENTITY_CATEGORY_MAP = {
  archetype: "character-archetypes",
  crew: "crew-types",
  sephirot: "sephirothic-alignments",
  occult: "occult-associations",
  enlight: "enlightenment-levels"
};

const WIZARD_TABS = [
  { key: "sorting", label: "Sorting" },
  { key: "ancestry", label: "Ancestries" },
  { key: "heritage", label: "Heritages" },
  { key: "archetype", label: "Archetypes" },
  { key: "crew", label: "Awesome Crew" },
  { key: "class", label: "Paths" },
  { key: "subclass", label: "Doctrines" },
  { key: "occult", label: "Occult Association" },
  { key: "political", label: "Political Philosophy" },
  { key: "sephirot", label: "Sephirotic Alignment" },
  { key: "baseStats", label: "Faculties" },
  { key: "review", label: "Review / Create" }
];

function canOpenWizard() {
  try {
    if (!game.user) return false;
    if (game.user.isGM) return true;
    if (typeof game.user.can === "function") return !!game.user.can("ACTOR_CREATE");
  } catch (_err) {}
  return false;
}

function isTierName(name) {
  const s = String(name || "").trim();
  return /\(Tier\s+\d+\)/i.test(s) || /[—-]\s*Tier\s+\d+$/i.test(s);
}

function normalizeChoiceName(name) {
  return String(name || "").trim();
}

function normKey(s) {
  return String(s || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function titleCase(s) {
  return String(s || "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, function (m) { return m.toUpperCase(); });
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function countOccurrences(arr, value) {
  let n = 0;
  for (let i = 0; i < arr.length; i += 1) {
    if (Number(arr[i]) === Number(value)) n += 1;
  }
  return n;
}

function factionActors() {
  const actors = (game.actors && game.actors.contents) ? game.actors.contents : [];
  return actors
    .filter(function (a) {
      try {
        return a.getFlag("bbttcc-factions", "isFaction") === true ||
          String((((a.system || {}).details || {}).type || {}).value || "").toLowerCase() === "faction";
      } catch (_err) {
        return false;
      }
    })
    .map(function (a) { return { id: a.id, name: a.name }; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
}

function looksLikePlayableSpeciesType(type) {
  const t = String(type || "").toLowerCase();
  // v2 ancestry canon (2026-04-18): wizard picker shows ONLY species-typed
  // documents — exactly the 8 v2 roots (Cryptidkin, Echo-Diver, Human,
  // Menhirkin, Oldenborn, Qliph-Scarred, Sephirotic Scion, Circuitborn).
  // Legacy race-typed variants (Florensis, Neanderthal, Earthbound, Lumenwrought,
  // Tideborne, the 4 Circuitborn Lines) stay in the compendium for backward
  // compat with existing PCs but are hidden from the wizard's species picker.
  // Heritage selection happens separately via the heritage feats.
  return t === "species";
}

function looksLikePlayableClassType(type) {
  const t = String(type || "").toLowerCase();
  return t === "class";
}

function looksLikePlayableSubclassType(type) {
  const t = String(type || "").toLowerCase();
  return t === "subclass" || t === "doctrine";
}

// Heritage feats are `type: feat` items tagged `flags.bbttcc.kind === "heritage"`
// (e.g. "Cryptidkin Heritage: Furrykin"). Type alone is insufficient — many
// non-heritage feats also use type=feat — so caller passes the bbttcc kind.
function looksLikePlayableHeritageType(type, bbttccKind) {
  const t = String(type || "").toLowerCase();
  const k = String(bbttccKind || "").toLowerCase();
  return t === "feat" && k === "heritage";
}

function guessDocumentQuote(name, bodyHtml) {
  if (/mal says/i.test(bodyHtml || "")) return "Mal has already formed an opinion.";
  if (/you are/i.test(String(bodyHtml || "").slice(0, 320))) return "Identity under pressure tends to tell on you.";
  return "Choose what actually fits who this operative becomes under stress.";
}

function getDescriptionHtml(doc) {
  if (!doc) return "";
  const sys = doc.system || {};
  const desc = sys.description || sys.details || {};
  if (typeof desc === "string") return desc;
  if (desc && typeof desc.value === "string" && desc.value.trim()) return desc.value;
  if (desc && typeof desc.chat === "string" && desc.chat.trim()) return desc.chat;
  if (typeof doc.content === "string" && doc.content.trim()) return doc.content;
  if (typeof doc.text === "string" && doc.text.trim()) return doc.text;
  return "";
}

function docToPreview(doc, fallback) {
  fallback = fallback || {};
  const body = getDescriptionHtml(doc);
  const source = (doc && doc.pack && doc.pack.metadata && (doc.pack.metadata.label || doc.pack.metadata.collection)) || fallback.source || "";
  const identifier = String((((doc || {}).system || {}).identifier) || "");
  return {
    title: (doc && doc.name) || fallback.name || "BBTTCC Option",
    subtitle: fallback.subtitle || source || "",
    kicker: fallback.previewKicker || "",
    quote: fallback.previewQuote || guessDocumentQuote((doc && doc.name) || fallback.name || "", body),
    image: (doc && (doc.img || doc.thumbnail)) || fallback.img || "",
    body: body || fallback.previewBody || "<p>No preview text is available for this option yet.</p>",
    meta: {
      source: source,
      identifier: identifier,
      type: String((doc && doc.type) || fallback.type || "")
    }
  };
}

async function indexPackChoices(packKey) {
  const pack = game.packs.get(packKey);
  if (!pack) return [];
  const idx = await pack.getIndex({ fields: ["name", "type", "img", "system.identifier", "flags.bbttcc-character-options.option.key"] });
  const rows = idx.filter(function (e) {
    return e.type === "feat" || e.type === "feat5e" || e.type === "featv2" || e.type === "featV2" || e.type === "feat-5e";
  });
  rows.sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
  return rows
    .filter(function (row) { return !isTierName(row.name); })
    .map(function (row) {
      const flagBlock = ((row.flags || {})[BBTTCC_SCOPE] || {});
      const option = flagBlock.option || {};
      return {
        id: row._id,
        name: normalizeChoiceName(row.name),
        img: row.img || "",
        source: pack.metadata.label || pack.collection,
        identifier: row["system.identifier"] || "",
        optionKey: option.key || row["flags.bbttcc-character-options.option.key"] || "",
        pack: packKey,
        type: row.type || "feat"
      };
    });
}

async function loadPackDocument(key, id) {
  const pack = game.packs.get(key);
  if (!pack || !id) return null;
  try {
    return await pack.getDocument(id);
  } catch (_err) {
    return null;
  }
}

async function findDefaultEnlightenmentChoice() {
  const packKey = PACK_KEYS.enlight;
  const pack = game.packs.get(packKey);
  if (!pack) return null;
  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "img", "system.identifier", "flags.bbttcc-character-options.option.key"] });
    const row = idx.find(function (entry) {
      return String(entry["system.identifier"] || "") === DEFAULT_ENLIGHTENMENT_IDENTIFIER;
    }) || idx.find(function (entry) {
      return String(entry.name || "").trim().toLowerCase() === "enlightenment: unawakened";
    });
    if (!row) return null;
    const flagBlock = ((row.flags || {})[BBTTCC_SCOPE] || {});
    const option = flagBlock.option || {};
    return {
      id: row._id,
      name: normalizeChoiceName(row.name),
      img: row.img || "",
      source: pack.metadata.label || pack.collection,
      identifier: row["system.identifier"] || "",
      optionKey: option.key || row["flags.bbttcc-character-options.option.key"] || "",
      pack: packKey,
      type: row.type || "feat"
    };
  } catch (e) {
    warn("findDefaultEnlightenmentChoice failed", e);
    return null;
  }
}

async function indexBBTTCCItemChoicesByType(kind) {
  const out = [];
  for (const collection of BBTTCC_ITEM_PACKS) {
    const pack = game.packs.get(collection);
    if (!pack) continue;
    try {
      const meta = pack.metadata || {};
      if (meta.type !== "Item") continue;
      const index = await pack.getIndex({ fields: ["name", "type", "img", "system.identifier", "system.classIdentifier", "flags.bbttcc.kind", "flags.bbttcc.family"] });
      for (const row of index) {
        const rowType = String(row.type || "").toLowerCase();
        // getIndex MAY deep-set nested fields (row.flags.bbttcc.kind) or expose
        // them as bracket-keyed strings, OR not load them at all on some
        // Foundry versions / pack ages. So derive kind/family from
        // system.identifier as a last-resort fallback. Heritage feats follow
        // the convention `<family>_<lineage>_heritage` (e.g.
        // `cryptidkin_furrykin_heritage`); species roots use `<family>` as
        // their identifier (e.g. `human`, `circuitborn`).
        const sys = row.system || {};
        const identifier = String(sys.identifier ?? row["system.identifier"] ?? "").toLowerCase();
        const classIdentifier = String(sys.classIdentifier ?? row["system.classIdentifier"] ?? "").toLowerCase();
        const bbttccFlags = (row.flags && row.flags.bbttcc) || {};
        let bbttccKind = String(bbttccFlags.kind ?? row["flags.bbttcc.kind"] ?? "").toLowerCase();
        let bbttccFamily = String(bbttccFlags.family ?? row["flags.bbttcc.family"] ?? "").toLowerCase();
        // Identifier-derived fallbacks
        if (!bbttccKind && rowType === "feat" && identifier.endsWith("_heritage")) bbttccKind = "heritage";
        if (!bbttccFamily) {
          if (bbttccKind === "heritage") {
            // `cryptidkin_furrykin_heritage` → family = "cryptidkin"
            const m = identifier.match(/^([a-z0-9]+)_/);
            if (m) bbttccFamily = m[1];
          } else if (rowType === "species" && identifier) {
            bbttccFamily = identifier;
          }
        }
        const keep = kind === "species" ? looksLikePlayableSpeciesType(rowType)
          : kind === "class" ? looksLikePlayableClassType(rowType)
          : kind === "subclass" ? looksLikePlayableSubclassType(rowType)
          : kind === "heritage" ? looksLikePlayableHeritageType(rowType, bbttccKind)
          : false;
        if (!keep) continue;
        const uuid = "Compendium." + pack.collection + ".Item." + row._id;
        out.push({
          id: uuid,
          uuid: uuid,
          name: normalizeChoiceName(row.name),
          type: rowType,
          source: pack.metadata.label || pack.collection,
          img: row.img || "",
          identifier: identifier,
          classIdentifier: classIdentifier,
          family: bbttccFamily,
          kind: bbttccKind
        });
      }
    } catch (e) {
      warn("indexBBTTCCItemChoicesByType failed for pack", collection, e);
    }
  }
  out.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return out;
}

async function importByUUID(uuid) {
  try {
    if (!uuid) return null;
    return await fromUuid(uuid);
  } catch (e) {
    warn("importByUUID failed", uuid, e);
    return null;
  }
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function actorHasImportedDoc(actor, doc) {
  if (!actor || !doc) return false;
  const docIdentifier = String((((doc.system || {}).identifier) || ""));
  const docType = String(doc.type || "").toLowerCase();
  const docName = String(doc.name || "");
  const items = actor.items ? (actor.items.contents || actor.items) : [];
  for (const item of items) {
    const itemIdentifier = String((((item.system || {}).identifier) || ""));
    const itemType = String(item.type || "").toLowerCase();
    const itemName = String(item.name || "");
    if (docIdentifier && itemIdentifier === docIdentifier) return true;
    if (docType && itemType === docType && docName && itemName === docName) return true;
  }
  return false;
}

// Walks a top-level item's ItemGrant advancements and collects the granted
// items that should be created at character creation (level ≤ 1). Returns
// an array of plain item objects suitable for createEmbeddedDocuments.
function stampCompendiumSource(obj, uuid) {
  if (!obj || !uuid) return;
  foundry.utils.setProperty(obj, "_stats.compendiumSource", uuid);
  foundry.utils.setProperty(obj, "flags.core.sourceId", uuid);
}

async function collectLevelOneGrants(topDoc, principleSource) {
  if (!topDoc) return [];
  const out = [];
  const top = topDoc.toObject();
  foundry.utils.setProperty(top, "flags.fourththing.principleSource", principleSource);
  stampCompendiumSource(top, topDoc.uuid);
  out.push(top);

  const advancement = (topDoc.system && topDoc.system.advancement) || {};
  const advRows = Array.isArray(advancement) ? advancement : Object.values(advancement);
  for (const adv of advRows) {
    if (!adv || adv.type !== "ItemGrant") continue;
    if ((adv.level ?? 0) > 1) continue;
    const items = ((adv.configuration || {}).items) || [];
    for (const entry of items) {
      try {
        const granted = await fromUuid(entry.uuid);
        if (!granted) continue;
        const obj = granted.toObject();
        foundry.utils.setProperty(obj, "flags.fourththing.principleSource", principleSource);
        stampCompendiumSource(obj, granted.uuid ?? entry.uuid);
        out.push(obj);
      } catch (_err) { /* skip missing grants */ }
    }
  }
  return out;
}

async function importClassAncestrySubclass(actor, opts) {
  opts = opts || {};
  const ancestryUuid = opts.ancestryUuid || "";
  const heritageUuid = opts.heritageUuid || "";
  const classUuid = opts.classUuid || "";
  const subclassUuid = opts.subclassUuid || "";

  const toImport = [];
  let ancestryDoc = null;
  let heritageDoc = null;
  let classDoc = null;
  let subclassDoc = null;

  if (ancestryUuid) {
    ancestryDoc = await importByUUID(ancestryUuid);
    if (ancestryDoc) toImport.push(...await collectLevelOneGrants(ancestryDoc, "ancestry"));
    else warn("Missing ancestry doc for uuid", ancestryUuid);
  }
  if (heritageUuid) {
    heritageDoc = await importByUUID(heritageUuid);
    // Heritage feats themselves are first-class items on the actor (they hold
    // the line-specific traits + tier-I ItemGrant). Push the heritage doc
    // itself AND any additional level-1 grants it carries.
    if (heritageDoc) {
      const heritageTop = heritageDoc.toObject();
      stampCompendiumSource(heritageTop, heritageDoc.uuid);
      toImport.push(heritageTop);
      toImport.push(...await collectLevelOneGrants(heritageDoc, "ancestry"));
    } else warn("Missing heritage doc for uuid", heritageUuid);
  }
  if (classUuid) {
    classDoc = await importByUUID(classUuid);
    if (classDoc) toImport.push(...await collectLevelOneGrants(classDoc, "class"));
    else warn("Missing class doc for uuid", classUuid);
  }
  if (subclassUuid) {
    subclassDoc = await importByUUID(subclassUuid);
    if (subclassDoc) toImport.push(...await collectLevelOneGrants(subclassDoc, "subclass"));
    else warn("Missing subclass doc for uuid", subclassUuid);
  }

  // De-duplicate by (type, name) — class/subclass/ancestry top-level items can
  // appear more than once if their advancements list themselves.
  const seen = new Set();
  const cleaned = [];
  for (const obj of toImport) {
    const key = String(obj.type || "") + "::" + String(obj.name || "");
    if (seen.has(key)) continue;
    seen.add(key);
    const c = foundry.utils.deepClone(obj);
    delete c._id;
    cleaned.push(c);
  }
  if (cleaned.length) await actor.createEmbeddedDocuments("Item", cleaned);

  return {
    ancestryDoc,
    heritageDoc,
    classDoc,
    subclassDoc,
    importedCount: cleaned.length
  };
}

async function persistFactionBothShapes(actor, factionId) {
  const faction = factionId ? game.actors.get(factionId) : null;
  const factionName = faction ? faction.name : "";
  await actor.setFlag("bbttcc-factions", "factionId", factionId || null);
  await actor.setFlag("bbttcc-territory", "faction", factionName || "");
}

function getDefaultBaseStats() {
  const out = {};
  for (const key of ATTRIBUTE_KEYS) out[key] = "";
  return out;
}

function defaultState() {
  return {
    name: "New Operative",
    defaultEnlightInitialized: false,
    factionId: "",
    speciesUuid: "",
    heritageUuid: "",
    classUuid: "",
    subclassUuid: "",
    archetypeId: "",
    crewId: "",
    sephirotId: "",
    politicalId: "",
    occultId: "",
    enlightId: "",
    createdActorId: "",
    activeTab: "sorting",
    focused: {
      ancestry: "",
      heritage: "",
      archetype: "",
      crew: "",
      class: "",
      subclass: "",
      occult: "",
      political: "",
      sephirot: "",
      enlight: ""
    },
    lists: {
      archetype: [], crew: [], sephirot: [], political: [], occult: [], enlight: [], species: [], heritages: [], classes: [], subclasses: []
    },
    sorting: {
      spec: null,
      index: 0,
      answers: {},
      resultBundle: null
    },
    baseStats: getDefaultBaseStats()
  };
}

function buildIdentityPatchFromSelections(selections) {
  const patch = {};
  if (selections.archetype) {
    patch.archetype = { key: selections.archetype.id, id: selections.archetype.id, pack: PACK_KEYS.archetype, category: IDENTITY_CATEGORY_MAP.archetype, optionKey: selections.archetype.optionKey || selections.archetype.identifier || selections.archetype.id, identifier: selections.archetype.identifier || "", name: selections.archetype.name };
  }
  if (selections.crew) {
    patch.crew = { key: selections.crew.id, id: selections.crew.id, pack: PACK_KEYS.crew, category: IDENTITY_CATEGORY_MAP.crew, optionKey: selections.crew.optionKey || selections.crew.identifier || selections.crew.id, identifier: selections.crew.identifier || "", name: selections.crew.name };
  }
  if (selections.sephirot) {
    patch.sephirothicAlignment = { key: selections.sephirot.id, id: selections.sephirot.id, pack: PACK_KEYS.sephirot, category: IDENTITY_CATEGORY_MAP.sephirot, optionKey: selections.sephirot.optionKey || selections.sephirot.identifier || selections.sephirot.id, identifier: selections.sephirot.identifier || "", name: selections.sephirot.name };
  }
  if (selections.occult) {
    patch.occult = { key: selections.occult.id, id: selections.occult.id, pack: PACK_KEYS.occult, category: IDENTITY_CATEGORY_MAP.occult, optionKey: selections.occult.optionKey || selections.occult.identifier || selections.occult.id, identifier: selections.occult.identifier || "", name: selections.occult.name };
  }
  if (selections.enlight) {
    patch.enlightenment = { key: selections.enlight.id, id: selections.enlight.id, pack: PACK_KEYS.enlight, category: IDENTITY_CATEGORY_MAP.enlight, optionKey: selections.enlight.optionKey || selections.enlight.identifier || selections.enlight.id, identifier: selections.enlight.identifier || "", name: selections.enlight.name };
  }
  return patch;
}

async function persistIdentityFlags(actor, selections) {
  const identityPatch = buildIdentityPatchFromSelections(selections);
  const identityApi = game.bbttcc && game.bbttcc.api ? game.bbttcc.api.identity : null;
  if (Object.keys(identityPatch).length) {
    try {
      if (identityApi && typeof identityApi.setIdentityFlags === "function") {
        await identityApi.setIdentityFlags(actor.id, identityPatch);
      } else {
        await actor.setFlag(BBTTCC_SCOPE, "identity", identityPatch);
      }
    } catch (e) {
      warn("persistIdentityFlags via identity API failed; storing fallback flag.", e);
      await actor.setFlag(BBTTCC_SCOPE, "identity", identityPatch);
    }
  }
  for (const entry of Object.entries(selections)) {
    const key = entry[0];
    const sel = entry[1];
    if (!sel || key === "political") continue;
    await actor.setFlag(BBTTCC_SCOPE, key, { pack: sel.pack, id: sel.id, name: sel.name, identifier: sel.identifier || sel.id });
  }
  if (selections.political && selections.political.id) {
    await actor.setFlag(AAE_SCOPE, "politicalPhilosophy", selections.political.id);
  }
}

function getActorItemIdentifier(item) {
  return String((((item || {}).system || {}).identifier) || "");
}

function getActorItemOptionKey(item) {
  const flags = (item && item.flags) ? item.flags : {};
  const bco = flags[BBTTCC_SCOPE] || {};
  const opt = bco.option || {};
  return String(opt.key || "");
}

function actorHasIdentityDoc(actor, doc) {
  if (!actor || !doc) return false;
  const docIdentifier = String((((doc.system || {}).identifier) || ""));
  const docOptionKey = String(((((doc.flags || {})[BBTTCC_SCOPE] || {}).option || {}).key || ""));
  const items = actor.items ? (actor.items.contents || actor.items) : [];
  for (const item of items) {
    if (docIdentifier && getActorItemIdentifier(item) === docIdentifier) return true;
    if (docOptionKey && getActorItemOptionKey(item) === docOptionKey) return true;
    if (!docIdentifier && !docOptionKey) {
      if (String(item.name || "") === String(doc.name || "") && String(item.type || "") === String(doc.type || "")) return true;
    }
  }
  return false;
}

async function createMissingIdentityItems(actor, selections) {
  const docs = [];
  for (const key of ["archetype", "crew", "sephirot", "occult", "enlight"]) {
    const sel = selections[key];
    if (!sel || !sel.doc) continue;
    if (actorHasIdentityDoc(actor, sel.doc)) continue;
    docs.push(sel.doc.toObject());
  }
  if (docs.length) await actor.createEmbeddedDocuments("Item", docs);
  return docs.length;
}

async function recalcActor(actor) {
  try {
    if (game.bbttcc && game.bbttcc.api && game.bbttcc.api.characterOptions && typeof game.bbttcc.api.characterOptions.recalcActor === "function") {
      await game.bbttcc.api.characterOptions.recalcActor(actor.id);
    }
  } catch (e) {
    warn("OP recalc failed (non-fatal)", e);
  }
}

async function buildSelectionsFromRaw(raw) {
  const out = { archetype: null, crew: null, sephirot: null, political: null, occult: null, enlight: null };
  for (const key of ["archetype", "crew", "sephirot", "occult", "enlight"]) {
    const pick = raw[key] || {};
    if (!pick.pack || !pick.id) continue;
    const doc = await loadPackDocument(pick.pack, pick.id);
    if (!doc) continue;
    const optFlags = doc.getFlag && doc.getFlag(BBTTCC_SCOPE, "option") || {};
    out[key] = { pack: pick.pack, id: pick.id, name: doc.name, identifier: (((doc.system || {}).identifier) || ""), optionKey: optFlags.key || "", doc: doc };
  }
  if (raw.political && raw.political.id) {
    const found = AAE_POLITICAL_PHILOSOPHIES.find(function (p) { return p.key === raw.political.id; });
    out.political = { id: raw.political.id, name: found ? found.label : raw.political.id };
  }
  return out;
}

async function storeGuidedState(actor, state) {
  await actor.setFlag(GUIDED_SCOPE, GUIDED_KEY, state);
}

function getGuidedState(actor) {
  return actor.getFlag(GUIDED_SCOPE, GUIDED_KEY) || null;
}

function resolveActor(actorOrId) {
  if (!actorOrId) return null;
  if (typeof actorOrId === "string") return game.actors.get(actorOrId) || null;
  return actorOrId;
}

async function applyBaseStatsToActor(actor, baseStats) {
  const update = {};
  for (const key of ATTRIBUTE_KEYS) {
    const value = Number(baseStats && baseStats[key]);
    if (!Number.isFinite(value)) continue;
    update["system.attributes." + key + ".value"] = value;
  }
  if (Object.keys(update).length) await actor.update(update);
}


async function createActorShellFromPayload(payload) {
  payload = payload || {};
  const defaultImg = "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/QlipothicWhorlDude2.png";
  const actor = await Actor.create({
    name: payload.name || "New Operative",
    type: "character",
    img: defaultImg,
    prototypeToken: { texture: { src: defaultImg } },
    system: { details: { alignment: "" } }
  });
  if (!actor) throw new Error("Actor.create returned null");
  return actor;
}

async function syncIdentityAndRecalc(actor) {
  try {
    const idApi = game.bbttcc && game.bbttcc.api ? game.bbttcc.api.identity : null;
    if (idApi && typeof idApi.syncOptionTiers === "function") {
      await idApi.syncOptionTiers(actor.id, { silent: true });
    }
  } catch (e) {
    warn("syncOptionTiers failed", e);
  }
  await recalcActor(actor);
  try {
    const idApi2 = game.bbttcc && game.bbttcc.api ? game.bbttcc.api.identity : null;
    if (idApi2 && typeof idApi2.syncOptionTiers === "function") {
      await idApi2.syncOptionTiers(actor.id, { silent: true });
    }
  } catch (e2) {
    warn("post-recalc syncOptionTiers failed", e2);
  }
  await recalcActor(actor);
}

async function runGuidedCreatePipeline(payload, opts) {
  opts = opts || {};
  const selections = await buildSelectionsFromRaw(payload.picks || {});
  const actor = await createActorShellFromPayload(payload);

  await persistFactionBothShapes(actor, payload.factionId || null);
  await applyBaseStatsToActor(actor, payload.baseStats || {});
  await persistIdentityFlags(actor, selections);
  await actor.setFlag(BBTTCC_SCOPE, "speciesUuid", payload.speciesUuid || "");
  await actor.setFlag(BBTTCC_SCOPE, "heritageUuid", payload.heritageUuid || "");
  await actor.setFlag(BBTTCC_SCOPE, "classUuid", payload.classUuid || "");
  await actor.setFlag(BBTTCC_SCOPE, "subclassUuid", payload.subclassUuid || "");

  const importResult = await importClassAncestrySubclass(actor, {
    ancestryUuid: payload.speciesUuid || "",
    heritageUuid: payload.heritageUuid || "",
    classUuid: payload.classUuid || "",
    subclassUuid: payload.subclassUuid || ""
  });

  await createMissingIdentityItems(actor, selections);

  await actor.setFlag(BBTTCC_SCOPE, "nativeLinks", {
    speciesUuid: payload.speciesUuid || "",
    heritageUuid: payload.heritageUuid || "",
    classUuid: payload.classUuid || "",
    subclassUuid: payload.subclassUuid || "",
    ancestryApplied: !!importResult.ancestryDoc,
    heritageApplied: !!importResult.heritageDoc,
    classApplied: !!importResult.classDoc,
    subclassApplied: !!importResult.subclassDoc,
    ancestryName: importResult.ancestryDoc ? importResult.ancestryDoc.name : "",
    heritageName: importResult.heritageDoc ? importResult.heritageDoc.name : "",
    className: importResult.classDoc ? importResult.classDoc.name : "",
    subclassName: importResult.subclassDoc ? importResult.subclassDoc.name : ""
  });

  await syncIdentityAndRecalc(actor);

  // Auto-grant tier/level-eligible path features + aptitude ranks so the
  // operative leaves the wizard fully kitted instead of needing the manual
  // "+ Apply Path Features" / "Grant Skill Ranks" buttons. Both helpers are
  // idempotent — safe even if the wizard re-runs on an existing actor.
  try {
    const prog = game.fourththing?._progression;
    if (prog?.applyPathFeatures) {
      const r = await prog.applyPathFeatures(actor);
      if (r?.error && r?.imported?.length === 0) {
        warn("auto-apply path features:", r.error);
      }
    }
    const grantSkills = game.fourththing?.applySkillGrantsFromFeatures
                     ?? game.fourththing?._progression?.applySkillGrantsFromFeatures;
    if (typeof grantSkills === "function") {
      await grantSkills(actor);
    }
    // Promote stamped class-L1 aptitude AEs (combat + armor) into source skill
    // ranks so they show on pips/label and pass the armor-rank gate. Without
    // this, transfer-AEs sit invisible on the imported class anchor — root
    // cause of "armor proficiencies not coming through from wizard".
    const promoteAEs = game.fourththing?.promoteStampedAptitudeAEs
                    ?? game.fourththing?._progression?.promoteStampedAptitudeAEs;
    if (typeof promoteAEs === "function") {
      try { await promoteAEs(actor); }
      catch (e) { warn("post-wizard promoteStampedAptitudeAEs failed", e); }
    }
  } catch (e) {
    warn("post-wizard auto-grant failed", e);
  }

  await storeGuidedState(actor, {
    stage: "complete",
    name: payload.name || actor.name || "New Operative",
    factionId: payload.factionId || "",
    speciesUuid: payload.speciesUuid || "",
    heritageUuid: payload.heritageUuid || "",
    classUuid: payload.classUuid || "",
    subclassUuid: payload.subclassUuid || "",
    picks: payload.picks || {},
    baseStats: payload.baseStats || {}
  });

  if (opts.openSheet === true && actor.sheet) {
    try { await actor.sheet.render(true); } catch (_err) {}
  }
  return actor;
}


Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc || { api: {} };
  game.bbttcc.api = game.bbttcc.api || {};
  game.bbttcc.api.autoLink = game.bbttcc.api.autoLink || {};

  game.bbttcc.api.autoLink.runGuidedCreatePipeline = runGuidedCreatePipeline;
  game.bbttcc.api.autoLink.getGuidedState = getGuidedState;

  log("Guided create pipeline ready (old wizard UI decommissioned — Tree Wizard v2 in bbttcc-sorting-engine is now canonical).");
});
