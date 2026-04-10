// modules/bbttcc-auto-link/scripts/character-wizard.js
// v1.1.0 — BBTTCC Character Wizard
// Immersive guided workflow with embedded sorting, standard-array base stats,
// and a single deterministic creation pipeline.

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
  "bbttcc-master-content.species",
  "bbttcc-master-content.ancestries"
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma"
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
  { key: "archetype", label: "Archetypes" },
  { key: "crew", label: "Awesome Crew" },
  { key: "class", label: "Classes" },
  { key: "occult", label: "Occult Association" },
  { key: "political", label: "Political Philosophy" },
  { key: "sephirot", label: "Sephirotic Alignment" },
    { key: "baseStats", label: "Base Stats" },
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

function ensureWizardStyleOnce() {
  if (document.getElementById("bbttcc-character-wizard-style")) return;

  const style = document.createElement("style");
  style.id = "bbttcc-character-wizard-style";
  style.textContent = `
    #bbttcc-character-wizard, #bbttcc-character-wizard .window-content { height: 100%; }
    #bbttcc-character-wizard .window-content { padding: 0; overflow: hidden; }
    .bbttcc-cw {
      height: 100%; min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
      color: #f7f5ea; background: linear-gradient(180deg, #041033 0%, #051533 100%);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    .bbttcc-cw__header { padding: 18px 26px 12px 26px; border-bottom: 1px solid rgba(228,191,49,0.28); background: linear-gradient(180deg, rgba(4,17,48,0.98), rgba(4,17,48,0.90)); }
    .bbttcc-cw__title-row { display:flex; align-items:end; justify-content:space-between; gap:16px; }
    .bbttcc-cw__title { margin:0; font-size:26px; font-weight:800; color:#f3e6a6; letter-spacing:0.02em; }
    .bbttcc-cw__subtitle { margin:4px 0 0 0; color:rgba(255,255,255,0.85); font-size:13px; }
    .bbttcc-cw__meta { display:flex; gap:16px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
    .bbttcc-cw__pill { border:1px solid rgba(228,191,49,0.45); border-radius:999px; padding:6px 12px; font-size:12px; color:#f3e6a6; background:rgba(228,191,49,0.08); }
    .bbttcc-cw__tabs { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .bbttcc-cw__tab { border-radius:999px; border:2px solid rgba(117,72,181,0.72); background:rgba(41,20,89,0.32); color:#fff; padding:10px 16px; font-size:13px; font-weight:700; cursor:pointer; }
    .bbttcc-cw__tab.is-active, .bbttcc-cw__tab.is-complete { border-color:rgba(228,191,49,0.92); color:#f3e6a6; }
    .bbttcc-cw__body { min-height:0; flex:1; display:grid; grid-template-columns:minmax(420px,1.2fr) minmax(420px,1fr); gap:20px; padding:20px 24px 18px 24px; overflow:hidden; }
    .bbttcc-cw__left, .bbttcc-cw__right { min-height:0; display:flex; flex-direction:column; gap:16px; }
    .bbttcc-cw__card { border:1px solid rgba(228,191,49,0.36); background:rgba(4,11,29,0.82); box-shadow:0 8px 20px rgba(0,0,0,0.24); }
    .bbttcc-cw__card--gold { border-width:2px; }
    .bbttcc-cw__card-head { padding:14px 16px 10px 16px; border-bottom:1px solid rgba(228,191,49,0.18); }
    .bbttcc-cw__card-title { margin:0; color:#f3e6a6; font-size:18px; font-weight:800; }
    .bbttcc-cw__card-subtitle { margin:4px 0 0 0; color:rgba(255,255,255,0.78); font-size:12px; }
    .bbttcc-cw__card-body { padding:16px; min-height:0; overflow:auto; }
    .bbttcc-cw__basics { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .bbttcc-cw__field label { display:block; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#cbbf7e; margin-bottom:6px; }
    .bbttcc-cw__field input, .bbttcc-cw__field select { width:100%; box-sizing:border-box; border-radius:10px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.05); color:#fff; padding:10px 12px; min-height:42px; }
    .bbttcc-cw__choice-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(138px, 1fr)); gap:0; border-top:1px solid rgba(228,191,49,0.18); border-left:1px solid rgba(228,191,49,0.18); }
    .bbttcc-cw__choice { min-height:104px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:14px 10px; text-align:center; cursor:pointer; border-right:1px solid rgba(228,191,49,0.18); border-bottom:1px solid rgba(228,191,49,0.18); background:#02113d; color:#ffffff; }
    .bbttcc-cw__choice.is-focused { box-shadow: inset 0 0 0 2px rgba(160,118,237,0.8); }
    .bbttcc-cw__choice.is-selected { background: rgba(228,191,49,0.10); color:#f3e6a6; box-shadow: inset 0 0 0 2px rgba(228,191,49,0.94); }
    .bbttcc-cw__choice-img { width:44px; height:44px; border-radius:8px; object-fit:cover; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); }
    .bbttcc-cw__choice-name { font-weight:800; font-size:13px; line-height:1.15; }
    .bbttcc-cw__choice-source { font-size:10px; opacity:0.7; }
    .bbttcc-cw__preview { display:flex; flex-direction:column; min-height:0; flex:1; }
    .bbttcc-cw__preview-head { display:grid; grid-template-columns:minmax(0, 1fr) 180px; gap:16px; align-items:stretch; }
    .bbttcc-cw__preview-title { margin:0; color:#fff; font-size:32px; font-weight:900; letter-spacing:0.02em; text-transform:uppercase; }
    .bbttcc-cw__preview-quote { margin:6px 0 0 0; color:#f3e6a6; font-style:italic; }
    .bbttcc-cw__preview-kicker { margin-top:10px; color:rgba(255,255,255,0.88); line-height:1.45; font-size:13px; }
    .bbttcc-cw__preview-img-wrap { border:2px solid rgba(228,191,49,0.88); background:rgba(0,0,0,0.18); min-height:180px; display:flex; align-items:center; justify-content:center; }
    .bbttcc-cw__preview-img { width:100%; height:100%; object-fit:contain; }
    .bbttcc-cw__preview-body { margin-top:14px; min-height:0; overflow:auto; color:#f7f5ea; line-height:1.5; }
    .bbttcc-cw__preview-body table { width:100%; border-collapse:collapse; }
    .bbttcc-cw__preview-body th, .bbttcc-cw__preview-body td { border:1px solid rgba(255,255,255,0.12); padding:6px 8px; }
    .bbttcc-cw__mini-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:14px; }
    .bbttcc-cw__mini, .bbttcc-cw__summary-item, .bbttcc-cw__stat-row { padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); }
    .bbttcc-cw__mini-label, .bbttcc-cw__summary-label, .bbttcc-cw__stat-label { font-size:10px; text-transform:uppercase; color:#cbbf7e; letter-spacing:0.06em; }
    .bbttcc-cw__mini-value, .bbttcc-cw__summary-value { margin-top:4px; color:#fff; font-size:14px; font-weight:700; }
    .bbttcc-cw__sorting-prompt { font-size:22px; line-height:1.45; color:#fff; margin:0 0 14px 0; }
    .bbttcc-cw__sorting-answers { display:grid; gap:10px; }
    .bbttcc-cw__sorting-answer { display:block; width:100%; text-align:left; padding:14px 16px; border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.04); color:#fff; }
    .bbttcc-cw__sorting-answer.is-active { background:rgba(80,120,255,0.18); border-color:rgba(120,170,255,0.9); }
    .bbttcc-cw__sorting-answer-key { display:inline-block; width:28px; font-weight:800; }
    .bbttcc-cw__summary-grid, .bbttcc-cw__stats-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .bbttcc-cw__stat-row { display:grid; grid-template-columns:1fr 140px; align-items:end; gap:12px; }
    .bbttcc-cw__array-chip { display:inline-flex; align-items:center; justify-content:center; min-width:40px; height:32px; padding:0 8px; margin-right:8px; border-radius:999px; border:1px solid rgba(228,191,49,0.35); background:rgba(228,191,49,0.08); color:#f3e6a6; font-weight:700; }
    .bbttcc-cw__error { color:#ffb2b2; font-weight:700; }
    .bbttcc-cw__hint { color:rgba(255,255,255,0.74); font-size:12px; line-height:1.45; }
    .bbttcc-cw__footer { display:flex; justify-content:space-between; align-items:center; gap:14px; padding:12px 24px 18px 24px; border-top:1px solid rgba(228,191,49,0.18); }
    .bbttcc-cw__footer-note { color:rgba(255,255,255,0.74); font-size:12px; }
    .bbttcc-cw__actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
    .bbttcc-cw__btn { border-radius:12px; border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.05); color:#fff; padding:10px 16px; cursor:pointer; font-weight:700; }
    .bbttcc-cw__btn--primary { border-color:rgba(228,191,49,0.88); background:rgba(228,191,49,0.16); color:#f3e6a6; }
    .bbttcc-cw__btn:disabled { opacity:0.45; cursor:not-allowed; }
    .bbttcc-cw__empty { color:rgba(255,255,255,0.75); line-height:1.5; }
    .bbttcc-cw__badge { display:inline-flex; align-items:center; gap:8px; margin-top:10px; border-radius:999px; padding:7px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); }
    .bbttcc-cw__badge strong { color:#f3e6a6; }
    @media (max-width: 1200px) { .bbttcc-cw__body { grid-template-columns:1fr; overflow:auto; } .bbttcc-cw__preview-head { grid-template-columns:1fr; } }
  `;
  document.head.appendChild(style);
}

function listPoliticalPhilosophiesForWizard() {
  return AAE_POLITICAL_PHILOSOPHIES.map(function (p) {
    return {
      id: p.key,
      name: p.label,
      img: "",
      previewKicker: p.blurb,
      previewQuote: "",
      previewBody: p.body,
      source: "AAE Canon"
    };
  });
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
  return t === "species" || t === "race" || t === "ancestry";
}

function looksLikePlayableClassType(type) {
  const t = String(type || "").toLowerCase();
  return t === "class";
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
      const index = await pack.getIndex({ fields: ["name", "type", "img", "system.identifier"] });
      for (const row of index) {
        const rowType = String(row.type || "").toLowerCase();
        const keep = kind === "species" ? looksLikePlayableSpeciesType(rowType) : kind === "class" ? looksLikePlayableClassType(rowType) : false;
        if (!keep) continue;
        const uuid = "Compendium." + pack.collection + ".Item." + row._id;
        out.push({
          id: uuid,
          uuid: uuid,
          name: normalizeChoiceName(row.name),
          type: rowType,
          source: pack.metadata.label || pack.collection,
          img: row.img || "",
          identifier: row["system.identifier"] || ""
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

function getExpectedGrantedUuids(doc) {
  const out = [];
  const adv = (doc && doc.system && Array.isArray(doc.system.advancement)) ? doc.system.advancement : [];
  for (let i = 0; i < adv.length; i += 1) {
    const row = adv[i] || {};
    if (String(row.type || "") !== "ItemGrant") continue;
    const items = (((row.configuration || {}).items) || []);
    for (let j = 0; j < items.length; j += 1) {
      const uuid = String((items[j] || {}).uuid || "").trim();
      if (uuid) out.push(uuid);
    }
  }
  return out;
}

function actorHasGrantedUuid(actor, uuid) {
  if (!actor || !uuid) return false;
  const items = actor.items ? (actor.items.contents || actor.items) : [];
  for (const item of items) {
    const sourceId = String((((item.flags || {}).dnd5e || {}).sourceId) || "");
    if (sourceId === uuid) return true;
  }
  return false;
}

function actorHasResolvedAdvancement(actor, doc) {
  if (!actor || !doc) return false;
  if (!actorHasImportedDoc(actor, doc)) return false;
  const expected = getExpectedGrantedUuids(doc);
  if (!expected.length) return true;
  for (let i = 0; i < expected.length; i += 1) {
    if (!actorHasGrantedUuid(actor, expected[i])) return false;
  }
  return true;
}

async function applyViaAdvancement(actor, doc, opts) {
  opts = opts || {};
  if (!actor || !doc) return false;
  try {
    const liveActor = game.actors.get(actor.id) || actor;
    const sheet = liveActor.sheet || actor.sheet;
    const retries = Number(opts.retries || 60);
    const delay = Number(opts.delay || 100);
    const allowDirectEmbedFallback = opts.allowDirectEmbedFallback === true;

    if (sheet && typeof sheet._onDropSingleItem === "function") {
      await sheet._onDropSingleItem(new PointerEvent("click"), doc.toObject());
      for (let i = 0; i < retries; i += 1) {
        const currentActor = game.actors.get(actor.id) || actor;
        if (actorHasResolvedAdvancement(currentActor, doc)) return true;
        await sleep(delay);
      }
      warn("applyViaAdvancement did not fully resolve in time.", liveActor.name, doc.name, { expectedGrantCount: getExpectedGrantedUuids(doc).length });
    } else {
      warn("Actor sheet missing _onDropSingleItem.", liveActor.name, doc.name);
    }

    if (allowDirectEmbedFallback) {
      const currentActor = game.actors.get(actor.id) || actor;
      if (!actorHasImportedDoc(currentActor, doc)) {
        await currentActor.createEmbeddedDocuments("Item", [doc.toObject()]);
        await sleep(50);
      }
      return actorHasImportedDoc(game.actors.get(actor.id) || actor, doc);
    }

    return actorHasResolvedAdvancement(game.actors.get(actor.id) || actor, doc);
  } catch (e) {
    warn("applyViaAdvancement failed", actor && actor.name, doc && doc.name, e);
    return false;
  }
}

async function persistFactionBothShapes(actor, factionId) {
  const faction = factionId ? game.actors.get(factionId) : null;
  const factionName = faction ? faction.name : "";
  await actor.setFlag("bbttcc-factions", "factionId", factionId || null);
  await actor.setFlag("bbttcc-territory", "faction", factionName || "");
}

function getDefaultBaseStats() {
  return { str: "", dex: "", con: "", int: "", wis: "", cha: "" };
}

function defaultState() {
  return {
    name: "New Operative",
    defaultEnlightInitialized: false,
    factionId: "",
    speciesUuid: "",
    classUuid: "",
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
      archetype: "",
      crew: "",
      class: "",
      occult: "",
      political: "",
      sephirot: "",
      enlight: ""
    },
    lists: {
      archetype: [], crew: [], sephirot: [], political: [], occult: [], enlight: [], species: [], classes: []
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
  for (const key of ABILITY_KEYS) {
    const value = Number(baseStats && baseStats[key]);
    if (!Number.isFinite(value)) continue;
    update["system.abilities." + key + ".value"] = value;
  }
  if (Object.keys(update).length) await actor.update(update);
}

function extractArchetypeAssignments(doc) {
  const adv = (doc && doc.system && Array.isArray(doc.system.advancement)) ? doc.system.advancement : [];
  for (let i = 0; i < adv.length; i += 1) {
    const row = adv[i] || {};
    if (String(row.type || "") !== "AbilityScoreImprovement") continue;
    const assignments = (((row.value || {}).assignments) || {});
    const out = {};
    let found = false;
    for (const key of ABILITY_KEYS) {
      const n = Number(assignments[key] || 0) || 0;
      if (n) {
        out[key] = n;
        found = true;
      }
    }
    if (found) return out;
  }
  return null;
}

async function applyArchetypeBonusesToActor(actor, selections) {
  const doc = selections && selections.archetype ? selections.archetype.doc : null;
  if (!doc) return false;
  const assignments = extractArchetypeAssignments(doc);
  if (!assignments) return false;
  const update = {};
  for (const key of Object.keys(assignments)) {
    const current = Number((((actor.system || {}).abilities || {})[key] || {}).value || 0) || 0;
    update["system.abilities." + key + ".value"] = current + Number(assignments[key] || 0);
  }
  if (Object.keys(update).length) {
    await actor.update(update);
    return true;
  }
  return false;
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

async function beginGuidedCreateFromPayload(payload, opts) {
  opts = opts || {};
  const selections = await buildSelectionsFromRaw(payload.picks || {});
  const actor = await createActorShellFromPayload(payload);

  await persistFactionBothShapes(actor, payload.factionId || null);
  await applyBaseStatsToActor(actor, payload.baseStats || {});
  await persistIdentityFlags(actor, selections);
  await actor.setFlag(BBTTCC_SCOPE, "speciesUuid", payload.speciesUuid || "");
  await actor.setFlag(BBTTCC_SCOPE, "classUuid", payload.classUuid || "");

  let ancestryDoc = null;
  let ancestryAppliedOk = false;
  if (payload.speciesUuid) {
    ancestryDoc = await importByUUID(payload.speciesUuid);
    if (!ancestryDoc) warn("Missing ancestry doc for uuid", payload.speciesUuid);
  }
  if (ancestryDoc) {
    ancestryAppliedOk = await applyViaAdvancement(actor, ancestryDoc, {
      retries: 80,
      delay: 100,
      allowDirectEmbedFallback: false
    });
    await sleep(250);
  }

  await actor.setFlag(BBTTCC_SCOPE, "nativeLinks", {
    speciesUuid: payload.speciesUuid || "",
    classUuid: payload.classUuid || "",
    ancestryApplied: !!ancestryAppliedOk,
    classApplied: false,
    ancestryName: ancestryDoc ? ancestryDoc.name : "",
    className: ""
  });

  await storeGuidedState(actor, {
    stage: "awaiting_identity",
    name: payload.name || actor.name || "New Operative",
    factionId: payload.factionId || "",
    speciesUuid: payload.speciesUuid || "",
    classUuid: payload.classUuid || "",
    picks: payload.picks || {},
    baseStats: payload.baseStats || {}
  });

  if (opts.openSheet === true && actor.sheet) {
    try { await actor.sheet.render(true); } catch (_err) {}
  }
  return actor;
}

async function applyGuidedIdentity(actorOrId) {
  const actor = resolveActor(actorOrId);
  const state = actor ? getGuidedState(actor) : null;
  if (!actor) throw new Error("Actor not found.");
  if (!state) throw new Error("No guided state found on actor.");

  const selections = await buildSelectionsFromRaw(state.picks || {});
  await persistIdentityFlags(actor, selections);
  await createMissingIdentityItems(actor, selections);
  await applyArchetypeBonusesToActor(actor, selections);
  await syncIdentityAndRecalc(actor);

  await storeGuidedState(actor, Object.assign({}, state, {
    stage: "awaiting_class"
  }));
  return actor;
}

async function continueGuidedCreate(actorOrId) {
  const actor = resolveActor(actorOrId);
  const state = actor ? getGuidedState(actor) : null;
  if (!actor) throw new Error("Actor not found.");
  if (!state) throw new Error("No guided state found on actor.");

  let classDoc = null;
  let classAppliedOk = false;
  if (state.classUuid) {
    classDoc = await importByUUID(state.classUuid);
    if (!classDoc) warn("Missing class doc for uuid", state.classUuid);
  }
  if (classDoc) {
    classAppliedOk = await applyViaAdvancement(actor, classDoc, {
      retries: 60,
      delay: 100,
      allowDirectEmbedFallback: false
    });
    await sleep(250);
  }

  await syncIdentityAndRecalc(actor);

  await actor.setFlag(BBTTCC_SCOPE, "nativeLinks", {
    speciesUuid: state.speciesUuid || "",
    classUuid: state.classUuid || "",
    ancestryApplied: !!(state.speciesUuid),
    classApplied: !!classAppliedOk,
    ancestryName: "",
    className: classDoc ? classDoc.name : ""
  });

  await storeGuidedState(actor, Object.assign({}, state, {
    stage: "complete"
  }));
  return actor;
}

async function runSilentCreationPipeline(payload, opts) {
  opts = opts || {};
  const actor = await beginGuidedCreateFromPayload(payload, { openSheet: false });
  await applyGuidedIdentity(actor);
  await continueGuidedCreate(actor);
  if (opts.openSheet === true && actor.sheet) {
    try { await actor.sheet.render(true); } catch (_err) {}
  }
  return actor;
}

class BBTTCC_CharacterWizard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-character-wizard",
    title: "Create BBTTCC Character",
    width: 1660,
    height: 980,
    resizable: true,
    classes: ["bbttcc", "bbttcc-character-wizard", "bbttcc-immersive"]
  };

  static PARTS = {
    body: { template: "modules/" + MOD + "/templates/character-wizard.hbs" }
  };

  get _bbttccState() {
    if (!this.__bbttcc) this.__bbttcc = defaultState();
    return this.__bbttcc;
  }

  async _loadAllLists() {
    if (this.__listsLoaded) return;
    const results = await Promise.all([
      indexPackChoices(PACK_KEYS.archetype),
      indexPackChoices(PACK_KEYS.crew),
      indexPackChoices(PACK_KEYS.sephirot),
      Promise.resolve(listPoliticalPhilosophiesForWizard()),
      indexPackChoices(PACK_KEYS.occult),
      indexBBTTCCItemChoicesByType("species"),
      indexBBTTCCItemChoicesByType("class")
    ]);
    this._bbttccState.lists = { archetype: results[0], crew: results[1], sephirot: results[2], political: results[3], occult: results[4], enlight: [], species: results[5], classes: results[6] };
    const st = this._bbttccState;
    if (!st.focused.ancestry && st.lists.species[0]) st.focused.ancestry = st.lists.species[0].id;
    if (!st.focused.archetype && st.lists.archetype[0]) st.focused.archetype = st.lists.archetype[0].id;
    if (!st.focused.crew && st.lists.crew[0]) st.focused.crew = st.lists.crew[0].id;
    if (!st.focused.class && st.lists.classes[0]) st.focused.class = st.lists.classes[0].id;
    if (!st.focused.occult && st.lists.occult[0]) st.focused.occult = st.lists.occult[0].id;
    if (!st.focused.political && st.lists.political[0]) st.focused.political = st.lists.political[0].id;
    if (!st.focused.sephirot && st.lists.sephirot[0]) st.focused.sephirot = st.lists.sephirot[0].id;
    this.__listsLoaded = true;
    await this._ensureDefaultEnlightenmentSelection();
  }

  async _ensureDefaultEnlightenmentSelection() {
    const st = this._bbttccState;
    if (st.defaultEnlightInitialized) return;
    st.defaultEnlightInitialized = true;

    const choice = await findDefaultEnlightenmentChoice();
    if (!choice) {
      warn("Default enlightenment choice not found:", DEFAULT_ENLIGHTENMENT_IDENTIFIER);
      return;
    }

    st.lists.enlight = [choice];
    st.enlightId = choice.id;
    st.focused.enlight = choice.id;
  }

  async _ensureSortingSpec() {
    const sorting = this._bbttccState.sorting;
    if (sorting.spec) return sorting.spec;
    const sortingApi = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.sorting : null;
    if (!sortingApi || typeof sortingApi.loadSpec !== "function") return null;
    sorting.spec = await sortingApi.loadSpec();
    return sorting.spec;
  }

  _getCreatedActor() {
    if (!this._bbttccState.createdActorId) return null;
    return game.actors.get(this._bbttccState.createdActorId) || null;
  }

  _getCurrentGuidedStage() {
    const actor = this._getCreatedActor();
    if (!actor) return "";
    const guided = getGuidedState(actor);
    return guided && guided.stage ? String(guided.stage) : "";
  }


  _getRootElement() {
    const el = this.element;
    if (el instanceof HTMLElement) return el;
    if (el && el[0] instanceof HTMLElement) return el[0];
    return null;
  }

  _getWindowElement() {
    const root = this._getRootElement();
    if (!root) return null;
    if (root.classList && (root.classList.contains("window-app") || root.classList.contains("application"))) return root;
    const win = root.closest ? root.closest(".window-app, .application") : null;
    if (win instanceof HTMLElement) return win;
    return root;
  }

  _applyFullscreenChrome() {
    const win = this._getWindowElement();
    if (!(win instanceof HTMLElement)) return;
    win.classList.add("bbttcc-immersive");
    win.style.width = "calc(100vw - 24px)";
    win.style.height = "calc(100vh - 24px)";
    win.style.left = "12px";
    win.style.top = "12px";
    win.style.maxWidth = "none";
    win.style.maxHeight = "none";
  }

  _bringWizardToFront() {
    const win = this._getWindowElement();
    if (!win) return;
    try { if (typeof this.bringToFront === "function") this.bringToFront(); } catch (_err) {}
  }

  _keepWizardOnTop() {
    this._applyFullscreenChrome();
    this._bringWizardToFront();
  }

  _applySortingPayloadToState(payload) {
    payload = payload || {};
    const picks = payload.picks || {};
    const st = this._bbttccState;
    st.name = payload.name || st.name || "New Operative";
    st.factionId = payload.factionId || st.factionId || "";
    st.speciesUuid = payload.speciesUuid || "";
    st.classUuid = payload.classUuid || "";
    st.archetypeId = (picks.archetype && picks.archetype.id) ? picks.archetype.id : "";
    st.crewId = (picks.crew && picks.crew.id) ? picks.crew.id : "";
    st.sephirotId = (picks.sephirot && picks.sephirot.id) ? picks.sephirot.id : "";
    st.politicalId = (picks.political && picks.political.id) ? picks.political.id : "";
    st.occultId = (picks.occult && picks.occult.id) ? picks.occult.id : "";
    if (picks.enlight && picks.enlight.id) st.enlightId = picks.enlight.id;
    st.focused.ancestry = st.speciesUuid || st.focused.ancestry;
    st.focused.class = st.classUuid || st.focused.class;
    st.focused.archetype = st.archetypeId || st.focused.archetype;
    st.focused.crew = st.crewId || st.focused.crew;
    st.focused.sephirot = st.sephirotId || st.focused.sephirot;
    st.focused.political = st.politicalId || st.focused.political;
    st.focused.occult = st.occultId || st.focused.occult;
    st.focused.enlight = st.enlightId || st.focused.enlight;
  }

  _getSelectedIdForTab(tabKey) {
    const st = this._bbttccState;
    if (tabKey === "ancestry") return st.speciesUuid;
    if (tabKey === "class") return st.classUuid;
    if (tabKey === "archetype") return st.archetypeId;
    if (tabKey === "crew") return st.crewId;
    if (tabKey === "sephirot") return st.sephirotId;
    if (tabKey === "political") return st.politicalId;
    if (tabKey === "occult") return st.occultId;
    if (tabKey === "enlight") return st.enlightId;
    return "";
  }

  _setSelectedIdForTab(tabKey, value) {
    const st = this._bbttccState;
    if (tabKey === "ancestry") st.speciesUuid = value || "";
    if (tabKey === "class") st.classUuid = value || "";
    if (tabKey === "archetype") st.archetypeId = value || "";
    if (tabKey === "crew") st.crewId = value || "";
    if (tabKey === "sephirot") st.sephirotId = value || "";
    if (tabKey === "political") st.politicalId = value || "";
    if (tabKey === "occult") st.occultId = value || "";
    if (tabKey === "enlight") st.enlightId = value || "";
  }

  _getFocusedIdForTab(tabKey) {
    const st = this._bbttccState;
    if (tabKey === "ancestry") return st.focused.ancestry;
    if (tabKey === "class") return st.focused.class;
    if (tabKey === "archetype") return st.focused.archetype;
    if (tabKey === "crew") return st.focused.crew;
    if (tabKey === "sephirot") return st.focused.sephirot;
    if (tabKey === "political") return st.focused.political;
    if (tabKey === "occult") return st.focused.occult;
    if (tabKey === "enlight") return st.focused.enlight;
    return "";
  }

  _setFocusedIdForTab(tabKey, value) {
    const st = this._bbttccState;
    if (tabKey === "ancestry") st.focused.ancestry = value || "";
    if (tabKey === "class") st.focused.class = value || "";
    if (tabKey === "archetype") st.focused.archetype = value || "";
    if (tabKey === "crew") st.focused.crew = value || "";
    if (tabKey === "sephirot") st.focused.sephirot = value || "";
    if (tabKey === "political") st.focused.political = value || "";
    if (tabKey === "occult") st.focused.occult = value || "";
    if (tabKey === "enlight") st.focused.enlight = value || "";
  }

  _getItemsForTab(tabKey) {
    const lists = this._bbttccState.lists;
    if (tabKey === "ancestry") return lists.species || [];
    if (tabKey === "class") return lists.classes || [];
    if (tabKey === "archetype") return lists.archetype || [];
    if (tabKey === "crew") return lists.crew || [];
    if (tabKey === "sephirot") return lists.sephirot || [];
    if (tabKey === "political") return lists.political || [];
    if (tabKey === "occult") return lists.occult || [];
    if (tabKey === "enlight") return lists.enlight || [];
    return [];
  }

  _getAvailableStatOptionsFor(abilityKey) {
    const chosen = [];
    for (const key of ABILITY_KEYS) {
      if (key === abilityKey) continue;
      const value = Number(this._bbttccState.baseStats[key]);
      if (Number.isFinite(value)) chosen.push(value);
    }
    const options = [];
    for (let i = 0; i < STANDARD_ARRAY.length; i += 1) {
      const value = STANDARD_ARRAY[i];
      const usedElsewhere = countOccurrences(chosen, value);
      const totalAllowed = countOccurrences(STANDARD_ARRAY, value);
      if (usedElsewhere < totalAllowed) options.push(value);
    }
    const current = Number(this._bbttccState.baseStats[abilityKey]);
    if (Number.isFinite(current) && options.indexOf(current) === -1) options.push(current);
    options.sort(function (a, b) { return b - a; });
    return options;
  }

  _getRemainingArrayValues() {
    const chosen = [];
    for (const key of ABILITY_KEYS) {
      const value = Number(this._bbttccState.baseStats[key]);
      if (Number.isFinite(value)) chosen.push(value);
    }
    const remaining = [];
    for (let i = 0; i < STANDARD_ARRAY.length; i += 1) {
      const value = STANDARD_ARRAY[i];
      if (countOccurrences(chosen, value) < countOccurrences(STANDARD_ARRAY, value)) remaining.push(value);
    }
    remaining.sort(function (a, b) { return b - a; });
    return remaining;
  }

  _isBaseStatsComplete() {
    const values = [];
    for (const key of ABILITY_KEYS) {
      const value = Number(this._bbttccState.baseStats[key]);
      if (!Number.isFinite(value)) return false;
      values.push(value);
    }
    if (values.length !== STANDARD_ARRAY.length) return false;
    const sortedA = values.slice().sort(function (a, b) { return a - b; });
    const sortedB = STANDARD_ARRAY.slice().sort(function (a, b) { return a - b; });
    for (let i = 0; i < sortedA.length; i += 1) {
      if (sortedA[i] !== sortedB[i]) return false;
    }
    return true;
  }

  _getBaseStatsError() {
    if (this._isBaseStatsComplete()) return "";
    const remaining = this._getRemainingArrayValues();
    if (!remaining.length) return "Base stats are incomplete or duplicated.";
    return "Assign every value from the standard array once: " + STANDARD_ARRAY.join(" / ") + ".";
  }

  async _resolvePreviewForChoice(tabKey, choiceId) {
    if (!choiceId) return null;
    const items = this._getItemsForTab(tabKey);
    const item = items.find(function (entry) { return String(entry.id) === String(choiceId); }) || null;
    if (!item) return null;
    if (tabKey === "political") {
      return { title: item.name, subtitle: item.source || "AAE Canon", kicker: item.previewKicker || "", quote: item.previewQuote || "Political philosophy is what you become when pressure stops letting you pretend.", image: item.img || "", body: item.previewBody || "<p>No preview text is available for this option yet.</p>", meta: { source: item.source || "AAE Canon", identifier: item.id, type: "political" } };
    }
    const cacheKey = tabKey + "::" + choiceId;
    this.__previewCache = this.__previewCache || {};
    if (this.__previewCache[cacheKey]) return this.__previewCache[cacheKey];
    let doc = null;
    if (tabKey === "ancestry" || tabKey === "class") doc = await importByUUID(choiceId);
    else if (item.pack) doc = await loadPackDocument(item.pack, choiceId);
    const preview = docToPreview(doc, item);
    this.__previewCache[cacheKey] = preview;
    return preview;
  }

  _summaryCellHtml(label, value) {
    return "<div class='bbttcc-cw__summary-item'><div class='bbttcc-cw__summary-label'>" + esc(label) + "</div><div class='bbttcc-cw__summary-value'>" + esc(titleCase(value || "—")) + "</div></div>";
  }

  _buildSortingPreviewFromResult(bundle) {
    const result = bundle ? bundle.result : null;
    if (!result) {
      return { title: "Sorting Engine", subtitle: "Who Are You Under Pressure?", kicker: "Choose the answer that feels most true when the roof is on fire.", quote: "Tell me how you solve problems, and I’ll tell you what you are.", image: "", body: "<p>The Sorting Engine can pre-populate ancestry, class, archetype, crew, occult association, political philosophy, and Sephirotic alignment. You can still override anything manually afterward.</p>", meta: { source: "BBTTCC Sorting Engine", identifier: "sorting", type: "wizard" } };
    }
    const short = result.short || {};
    const traitHtml = (result.topTraits || []).map(function (pair) { return "<li><strong>" + esc(titleCase(pair[0])) + ":</strong> " + esc(String(pair[1])) + "</li>"; }).join("");
    return {
      title: "Sorting Result",
      subtitle: "BBTTCC Identity Stack",
      kicker: titleCase(short.class || "") + " / " + titleCase(short.ancestry || ""),
      quote: result.expanded ? result.expanded.malVerdict : "Mal has thoughts, which is usually dangerous.",
      image: "",
      body: "<div class='bbttcc-cw__summary-grid'>" + this._summaryCellHtml("Philosophy", short.philosophy) + this._summaryCellHtml("Alignment", short.alignment) + this._summaryCellHtml("Archetype", short.archetype) + this._summaryCellHtml("Crew Type", short.crew) + this._summaryCellHtml("Occult Association", short.occult) + this._summaryCellHtml("Class", short.class) + this._summaryCellHtml("Ancestry", short.ancestry) + "</div>" + "<h3>What this means</h3><p>" + esc((result.expanded && result.expanded.meaning) || "") + "</p>" + "<h3>What you are good at</h3><p>" + esc((result.expanded && result.expanded.strengths) || "") + "</p>" + "<h3>What may break you</h3><p>" + esc((result.expanded && result.expanded.breaks) || "") + "</p>" + "<h3>Top Traits</h3><ul>" + traitHtml + "</ul>",
      meta: { source: "BBTTCC Sorting Engine", identifier: "sorting-result", type: "result" }
    };
  }

  _buildBaseStatsPreview() {
    const rows = [];
    for (const key of ABILITY_KEYS) {
      rows.push(this._summaryCellHtml(ABILITY_LABELS[key], this._bbttccState.baseStats[key] || "—"));
    }
    const remaining = this._getRemainingArrayValues();
    const archetypeName = this._getSelectedName("archetype");
    return {
      title: "Base Stats",
      subtitle: "Standard array assignment",
      kicker: "Set the standard array first. After creation, the wizard applies ancestry, class, identity items, and then archetype score bonuses on top.",
      quote: "Build the spine first. Then layer the weirdness on top.",
      image: "",
      body: "<div class='bbttcc-cw__summary-grid'>" + rows.join("") + "</div>" + "<h3>Remaining Values</h3><p>" + (remaining.length ? remaining.join(" / ") : "All assigned.") + "</p>" + "<h3>Archetype Bonus Timing</h3><p>The selected archetype, <strong>" + esc(archetypeName) + "</strong>, will apply its built-in ability bonuses only after these base values are stored.</p>",
      meta: { source: "Character Wizard", identifier: "base-stats", type: "assignment" }
    };
  }

  _buildReviewPreview() {
    const st = this._bbttccState;
    const missing = this._getMissingRequiredSelections();
    const stage = this._getCurrentGuidedStage();
    let subtitle = "Ready to create";
    let kicker = "The wizard will create the actor shell, store base stats, launch ancestry, apply BBTTCC identity, continue into class setup, and keep the final sheet closed until requested.";
    let quote = "Now we stop talking and make the person.";
    let stageBlurb = "<p>Everything required is in place. When you click <strong>Create Character</strong>, the wizard will start the staged guided flow.</p>";

    if (missing.length) {
      subtitle = "Still missing a few required picks";
      kicker = "Finish the missing selections, then create the operative without ever leaving the wizard.";
      quote = "A little less chaos before we hit the button.";
      stageBlurb = "<h3>Missing</h3><ul>" + missing.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>";
    } else if (stage === "awaiting_identity") {
      subtitle = "Ancestry step complete";
      kicker = "Finish any ancestry prompts on the sheet, then return here and apply the BBTTCC identity package before class setup.";
      quote = "Put the bones in first. Then the ideology. Then the profession.";
      stageBlurb = "<p>The actor shell exists and ancestry has been launched. Next step: <strong>Apply BBTTCC Identity</strong>.</p>";
    } else if (stage === "awaiting_class") {
      subtitle = "Identity applied";
      kicker = "Base identity items and tiers are now on the actor. Continue into class setup next.";
      quote = "Now you get to become employable.";
      stageBlurb = "<p>BBTTCC identity has been reconciled. Next step: <strong>Continue Class Setup</strong>.</p>";
    } else if (stage === "complete") {
      subtitle = "Character complete";
      kicker = "Ancestry, BBTTCC identity, and class have all been processed in staged order.";
      quote = "Now you stop touching the machine and go play.";
      stageBlurb = "<p>The creation pipeline is complete. Use <strong>Open Finished Character</strong> whenever you want the final sheet.</p>";
    }

    return {
      title: "Final Review",
      subtitle: subtitle,
      kicker: kicker,
      quote: quote,
      image: "",
      body: "<div class='bbttcc-cw__summary-grid'>" +
        this._summaryCellHtml("Name", st.name || "New Operative") +
        this._summaryCellHtml("Faction", this._getFactionName(st.factionId) || "None") +
        this._summaryCellHtml("Ancestry", this._getSelectedName("ancestry")) +
        this._summaryCellHtml("Class", this._getSelectedName("class")) +
        this._summaryCellHtml("Archetype", this._getSelectedName("archetype")) +
        this._summaryCellHtml("Crew", this._getSelectedName("crew")) +
        this._summaryCellHtml("Occult", this._getSelectedName("occult")) +
        this._summaryCellHtml("Political", this._getSelectedName("political")) +
        this._summaryCellHtml("Alignment", this._getSelectedName("sephirot")) +
        this._summaryCellHtml("Base Stats", this._isBaseStatsComplete() ? "Assigned" : "Incomplete") +
        "</div>" +
        stageBlurb +
        (st.createdActorId ? ("<div class='bbttcc-cw__badge'><span>Created Actor:</span> <strong>" + esc((game.actors.get(st.createdActorId) || {}).name || st.name || "Operative") + "</strong></div>") : ""),
      meta: { source: "Character Wizard", identifier: "review", type: "summary" }
    };
  }

  async _buildPreviewForActiveTab() {
    const tabKey = this._bbttccState.activeTab;
    if (tabKey === "sorting") return this._buildSortingPreviewFromResult(this._bbttccState.sorting.resultBundle);
    if (tabKey === "review") return this._buildReviewPreview();
    if (tabKey === "baseStats") return this._buildBaseStatsPreview();
    const focusedId = this._getFocusedIdForTab(tabKey) || this._getSelectedIdForTab(tabKey);
    return await this._resolvePreviewForChoice(tabKey, focusedId);
  }

  _getFactionName(factionId) {
    if (!factionId) return "";
    const faction = game.actors.get(factionId);
    return faction ? faction.name : "";
  }

  _getSelectedName(tabKey) {
    const value = this._getSelectedIdForTab(tabKey);
    if (!value) return "Not chosen";
    const items = this._getItemsForTab(tabKey);
    const found = items.find(function (item) { return String(item.id) === String(value); });
    return found ? found.name : "Chosen";
  }

  _getMissingRequiredSelections() {
    const missing = [];
    if (!this._bbttccState.speciesUuid) missing.push("Ancestry");
    if (!this._bbttccState.classUuid) missing.push("Class");
    if (!this._bbttccState.archetypeId) missing.push("Archetype");
    if (!this._bbttccState.crewId) missing.push("Awesome Crew");
    if (!this._bbttccState.occultId) missing.push("Occult Association");
    if (!this._bbttccState.politicalId) missing.push("Political Philosophy");
    if (!this._bbttccState.sephirotId) missing.push("Sephirotic Alignment");
    if (!this._isBaseStatsComplete()) missing.push("Base Stats");
    return missing;
  }

  _isReadyToCreate() {
    return this._getMissingRequiredSelections().length === 0;
  }

  _buildPayloadFromState() {
    const st = this._bbttccState;
    return {
      name: st.name || "New Operative",
      factionId: st.factionId || "",
      speciesUuid: st.speciesUuid || "",
      classUuid: st.classUuid || "",
      baseStats: st.baseStats || {},
      picks: {
        archetype: { pack: PACK_KEYS.archetype, id: st.archetypeId || "" },
        crew: { pack: PACK_KEYS.crew, id: st.crewId || "" },
        sephirot: { pack: PACK_KEYS.sephirot, id: st.sephirotId || "" },
        political: { pack: null, id: st.politicalId || "" },
        occult: { pack: PACK_KEYS.occult, id: st.occultId || "" },
        enlight: { pack: PACK_KEYS.enlight, id: st.enlightId || "" }
      }
    };
  }

  _buildChoiceItemsForContext(tabKey) {
    const items = this._getItemsForTab(tabKey);
    const selectedId = this._getSelectedIdForTab(tabKey);
    const focusedId = this._getFocusedIdForTab(tabKey) || selectedId;
    return items.map(function (item) { return Object.assign({}, item, { selected: String(item.id) === String(selectedId), focused: String(item.id) === String(focusedId) }); });
  }

  _buildTabsContext() {
    const self = this;
    return WIZARD_TABS.map(function (tab) {
      let done = false;
      if (tab.key === "sorting") done = !!(self._bbttccState.sorting && self._bbttccState.sorting.resultBundle);
      if (["ancestry", "class", "archetype", "crew", "occult", "political", "sephirot"].includes(tab.key)) done = !!self._getSelectedIdForTab(tab.key);
      if (tab.key === "baseStats") done = self._isBaseStatsComplete();
      if (tab.key === "review") done = self._isReadyToCreate();
      return { key: tab.key, label: tab.label, active: self._bbttccState.activeTab === tab.key, complete: done };
    });
  }

  _buildBaseStatsRowsContext() {
    const rows = [];
    for (const key of ABILITY_KEYS) {
      const selected = String(this._bbttccState.baseStats[key] || "");
      rows.push({
        key: key,
        label: ABILITY_LABELS[key],
        selected: selected,
        options: this._getAvailableStatOptionsFor(key).map(function (value) {
          return { value: String(value), selected: String(value) === selected };
        })
      });
    }
    return rows;
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;
    await this._loadAllLists();
    await this._ensureSortingSpec();
    const st = this._bbttccState;
    const activeTab = st.activeTab;
    const preview = await this._buildPreviewForActiveTab();
    const sorting = st.sorting;
    const sortingSpec = sorting.spec;
    const sortingQuestion = (sortingSpec && sortingSpec.questions && sortingSpec.questions[sorting.index]) ? sortingSpec.questions[sorting.index] : null;
    const sortingAnswers = [];
    if (sortingQuestion && sortingQuestion.answers) {
      Object.keys(sortingQuestion.answers).forEach((key) => {
        sortingAnswers.push({ key: key, text: sortingQuestion.answers[key].text, selected: String(sorting.answers[String(sortingQuestion.id)] || "") === String(key) });
      });
    }
    return Object.assign({}, context, {
      canCreateActors: canOpenWizard(),
      wizardName: st.name || "New Operative",
      wizardFactionId: st.factionId || "",
      factions: factionActors().map((f) => Object.assign({}, f, { selected: String(f.id) === String(st.factionId || "") })),
      tabs: this._buildTabsContext(),
      activeTab: activeTab,
      isChoiceTab: ["ancestry", "class", "archetype", "crew", "occult", "political", "sephirot"].includes(activeTab),
      isSortingTab: activeTab === "sorting",
      isReviewTab: activeTab === "review",
      showBaseStats: activeTab === "baseStats",
      activeItems: this._buildChoiceItemsForContext(activeTab),
      activeChoiceTitle: (WIZARD_TABS.find(function (tab) { return tab.key === activeTab; }) || {}).label || "Choices",
      focusedChoiceId: this._getFocusedIdForTab(activeTab) || this._getSelectedIdForTab(activeTab) || "",
      preview: preview || { title: "BBTTCC Character Wizard", subtitle: "", kicker: "", quote: "", image: "", body: "<p>No preview is available yet.</p>", meta: { source: "", identifier: "", type: "" } },
      sortingProgressLabel: sortingSpec ? ("Question " + (sorting.index + 1) + " of " + sortingSpec.questions.length + " • " + Object.keys(sorting.answers || {}).length + " answered") : "Loading Sorting Engine…",
      sortingQuestion: sortingQuestion,
      sortingAnswers: sortingAnswers,
      sortingHasResult: !!sorting.resultBundle,
      sortingCanGoBack: sorting.index > 0,
      sortingAtEnd: !!(sortingSpec && sortingQuestion && sorting.index === sortingSpec.questions.length - 1),
      readyToCreate: this._isReadyToCreate(),
      currentGuidedStage: this._getCurrentGuidedStage(),
      stageAwaitingIdentity: this._getCurrentGuidedStage() === "awaiting_identity",
      stageAwaitingClass: this._getCurrentGuidedStage() === "awaiting_class",
      stageComplete: this._getCurrentGuidedStage() === "complete",
      createdActorName: ((this._getCreatedActor() || {}).name) || "",
      hasCreatedActor: !!this._getCreatedActor(),
      baseStatsRows: this._buildBaseStatsRowsContext(),
      baseStatsRemaining: this._getRemainingArrayValues().map(String),
      baseStatsComplete: this._isBaseStatsComplete(),
      baseStatsError: this._getBaseStatsError()
    });
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);
    ensureWizardStyleOnce();
    const root = this._getRootElement();
    if (!(root instanceof HTMLElement)) return;
    if (this.__bbttccRenderAbort) {
      try { this.__bbttccRenderAbort.abort(); } catch (_e) {}
    }
    const aborter = new AbortController();
    this.__bbttccRenderAbort = aborter;

    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest ? ev.target.closest("[data-action]") : null;
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (!action) return;
      ev.preventDefault();
      if (action === "switchTab") return this._handleSwitchTab(btn.getAttribute("data-tab"));
      if (action === "focusChoice") return this._handleFocusChoice(btn.getAttribute("data-tab"), btn.getAttribute("data-choice-id"));
      if (action === "chooseChoice") return this._handleChooseChoice(btn.getAttribute("data-tab"), btn.getAttribute("data-choice-id"));
      if (action === "sortingPick") return this._handleSortingPick(btn.getAttribute("data-key"));
      if (action === "sortingPrev") return this._handleSortingPrev();
      if (action === "sortingNext") return this._handleSortingNext();
      if (action === "sortingReset") return this._handleSortingReset();
      if (action === "sortingUse") return this._handleSortingUseResult();
      if (action === "createCharacter") return this._handleCreateCharacter();
      if (action === "openActor") return this._handleOpenActor();
    }, { capture: true, signal: aborter.signal });

    root.addEventListener("change", async (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("input[name='name']")) {
        this._bbttccState.name = String(target.value || "").trim() || "New Operative";
        return;
      }
      if (target.matches("select[name='factionId']")) {
        this._bbttccState.factionId = String(target.value || "").trim();
        return;
      }
      if (target.matches("select[data-bbttcc-stat]")) {
        const key = String(target.getAttribute("data-bbttcc-stat") || "");
        if (ABILITY_KEYS.indexOf(key) !== -1) {
          const value = String(target.value || "").trim();
          this._bbttccState.baseStats[key] = value || "";
          await this.render(true);
        }
      }
    }, { signal: aborter.signal });

    this._keepWizardOnTop();
  }

  async _handleSwitchTab(tabKey) {
    if (!tabKey) return;
    this._bbttccState.activeTab = tabKey;
    await this.render(true);
    this._keepWizardOnTop();
  }

  async _handleFocusChoice(tabKey, choiceId) {
    if (!tabKey || !choiceId) return;
    this._setFocusedIdForTab(tabKey, choiceId);
    const selected = this._getSelectedIdForTab(tabKey);
    if (String(selected) === String(choiceId)) {
      await this._handleChooseChoice(tabKey, choiceId);
      return;
    }
    await this.render(true);
  }

  async _handleChooseChoice(tabKey, choiceId) {
    if (!tabKey || !choiceId) return;
    this._setFocusedIdForTab(tabKey, choiceId);
    this._setSelectedIdForTab(tabKey, choiceId);
    await this.render(true);
  }

  async _handleSortingPick(answerKey) {
    const sorting = this._bbttccState.sorting;
    const spec = await this._ensureSortingSpec();
    const question = (spec && spec.questions && spec.questions[sorting.index]) ? spec.questions[sorting.index] : null;
    if (!question || !answerKey) return;
    sorting.answers[String(question.id)] = answerKey;
    await this.render(true);
  }

  async _handleSortingPrev() {
    const sorting = this._bbttccState.sorting;
    if (sorting.index > 0) sorting.index -= 1;
    await this.render(true);
  }

  async _handleSortingNext() {
    const sorting = this._bbttccState.sorting;
    const sortingApi = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.sorting : null;
    const spec = await this._ensureSortingSpec();
    const question = (spec && spec.questions && spec.questions[sorting.index]) ? spec.questions[sorting.index] : null;
    if (!question) return;
    if (!sorting.answers[String(question.id)]) {
      ui.notifications.warn("Pick an answer first.");
      return;
    }
    if (sorting.index < spec.questions.length - 1) {
      sorting.index += 1;
      await this.render(true);
      return;
    }
    if (!sortingApi || typeof sortingApi.runTest !== "function") {
      ui.notifications.error("Sorting API unavailable.");
      return;
    }
    try {
      sorting.resultBundle = await sortingApi.runTest(sorting.answers, { chat: false, spec: spec });
      await this.render(true);
    } catch (err) {
      console.error(err);
      ui.notifications.error("Failed to compute sorting result.");
    }
  }

  async _handleSortingReset() {
    this._bbttccState.sorting = { spec: this._bbttccState.sorting.spec, index: 0, answers: {}, resultBundle: null };
    await this.render(true);
  }

  async _handleSortingUseResult() {
    const sorting = this._bbttccState.sorting;
    const sortingApi = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.sorting : null;
    if (!sorting.resultBundle || !sortingApi || typeof sortingApi.buildGuidedPayloadFromResult !== "function") {
      ui.notifications.warn("Run the Sorting Engine first.");
      return;
    }
    try {
      const payload = await sortingApi.buildGuidedPayloadFromResult(sorting.resultBundle.result, { name: this._bbttccState.name || "New Operative", factionId: this._bbttccState.factionId || "" });
      this._applySortingPayloadToState(payload);
      this._bbttccState.activeTab = "ancestry";
      await this.render(true);
      ui.notifications.info("Sorting result applied to the Character Wizard.");
    } catch (err) {
      console.error(err);
      ui.notifications.error("Could not apply Sorting result to the wizard.");
    }
  }

  async _handleCreateCharacter() {
    if (this.__createBusy) return;
    if (!canOpenWizard()) {
      ui.notifications.warn("You do not have permission to create actors.");
      return;
    }

    const stage = this._getCurrentGuidedStage();
    const actor = this._getCreatedActor();

    this.__createBusy = true;
    try {
      if (!actor) {
        if (!this._isReadyToCreate()) {
          ui.notifications.warn("Finish the required selections first.");
          this._bbttccState.activeTab = this._isBaseStatsComplete() ? "review" : "baseStats";
          await this.render(true);
          return;
        }
        const payload = this._buildPayloadFromState();
        ui.notifications.info("Creating BBTTCC character shell and launching ancestry…");
        const created = await beginGuidedCreateFromPayload(payload, { openSheet: true });
        this._bbttccState.createdActorId = created.id;
        this._bbttccState.activeTab = "review";
        await this.render(true);
        this._keepWizardOnTop();
        ui.notifications.info("Finish ancestry setup, then return here and click Apply BBTTCC Identity.");
        return;
      }

      if (stage === "awaiting_identity") {
        ui.notifications.info("Applying BBTTCC identity…");
        await applyGuidedIdentity(actor.id);
        this._bbttccState.activeTab = "review";
        await this.render(true);
        this._keepWizardOnTop();
        ui.notifications.info("Identity applied. Continue into class setup when ready.");
        return;
      }

      if (stage === "awaiting_class") {
        ui.notifications.info("Launching class setup…");
        await continueGuidedCreate(actor.id);
        this._bbttccState.activeTab = "review";
        await this.render(true);
        this._keepWizardOnTop();
        ui.notifications.info("Class setup launched. Complete any native class prompts, then open the finished character when ready.");
        return;
      }

      if (stage === "complete") {
        await this._handleOpenActor();
        return;
      }

      ui.notifications.warn("The guided stage is not ready yet.");
    } catch (e) {
      console.error("[" + MOD + "] Wizard create/stage failed", e);
      ui.notifications.error("Could not continue BBTTCC character creation. See console for details.");
    } finally {
      this.__createBusy = false;
    }
  }

  async _handleOpenActor() {
    const actor = this._getCreatedActor();
    if (!actor || !actor.sheet) return;
    await actor.sheet.render(true);
  }
}

Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc || { api: {} };
  game.bbttcc.api = game.bbttcc.api || {};
  game.bbttcc.api.autoLink = game.bbttcc.api.autoLink || {};

  game.bbttcc.api.autoLink.openCharacterWizard = function () {
    if (!canOpenWizard()) {
      ui.notifications.warn("Character creation requires actor creation permission.");
      return null;
    }
    return new BBTTCC_CharacterWizard().render(true, { focus: true });
  };

  game.bbttcc.api.autoLink.beginGuidedCreateFromPayload = beginGuidedCreateFromPayload;
  game.bbttcc.api.autoLink.applyGuidedIdentity = applyGuidedIdentity;
  game.bbttcc.api.autoLink.continueGuidedCreate = continueGuidedCreate;
  game.bbttcc.api.autoLink.runSilentCreationPipeline = runSilentCreationPipeline;
  game.bbttcc.api.autoLink.getGuidedState = getGuidedState;

  log("Character Wizard ready — immersive guided workflow with base stats enabled.");
});
