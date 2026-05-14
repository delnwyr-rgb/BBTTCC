// Generator for the 30 spark JSON sources (10 sephirot × 3 kinds).
// Run: node _generate.mjs (writes sibling .json files into this dir).
//
// Phase A of B3 (project_tikkun_revisit_plan_2026_05_09.md). Sources are
// loaded into the bbttcc-tikkun.sparks pack by tools/load-sparks-pack.macro.js.
// Edit this generator to retune content, then re-run + re-load.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const SEPHIROT = [
  { key: "keter",   label: "Keter",   color: "#b0bec5", virtue: "Unity",        domain: "Unity / nondual force" },
  { key: "chokmah", label: "Chokmah", color: "#7e57c2", virtue: "Wisdom",       domain: "Founding insight"      },
  { key: "binah",   label: "Binah",   color: "#546e7a", virtue: "Understanding",domain: "Boundaries, law"       },
  { key: "chesed",  label: "Chesed",  color: "#4a90d9", virtue: "Mercy",        domain: "Healing, generosity"   },
  { key: "gevurah", label: "Gevurah", color: "#c03030", virtue: "Severity",     domain: "Judgment, precision force" },
  { key: "tiferet", label: "Tiferet", color: "#e8c84a", virtue: "Harmony",      domain: "Balance, integration"  },
  { key: "netzach", label: "Netzach", color: "#27ae60", virtue: "Endurance",    domain: "Momentum, triumph"     },
  { key: "hod",     label: "Hod",     color: "#d4a017", virtue: "Glory",        domain: "Sigils, form, communication" },
  { key: "yesod",   label: "Yesod",   color: "#9b59b6", virtue: "Foundation",   domain: "Dreams, illusion, gateways" },
  { key: "malkuth", label: "Malkuth", color: "#78909c", virtue: "Kingdom",      domain: "Matter, stability, manifestation" }
];

// Per-sephirah aligned/misaligned OP-pool tags. Misaligned gather → Corrupted.
const ALIGNMENT = {
  keter:   { aligned: ["faith", "soul", "diplomacy"],            misaligned: ["violence", "nonlethal"] },
  chokmah: { aligned: ["intrigue", "soul", "logistics"],         misaligned: ["violence", "siege"] },
  binah:   { aligned: ["intrigue", "diplomacy", "logistics"],    misaligned: ["violence", "nonlethal"] },
  chesed:  { aligned: ["nonlethal", "diplomacy", "softpower", "faith"], misaligned: ["violence", "siege"] },
  gevurah: { aligned: ["violence", "siege"],                     misaligned: ["softpower", "diplomacy", "nonlethal"] },
  tiferet: { aligned: ["diplomacy", "softpower", "faith"],       misaligned: ["violence"] },
  netzach: { aligned: ["violence", "siege", "logistics"],        misaligned: ["nonlethal", "intrigue"] },
  hod:     { aligned: ["intrigue", "diplomacy", "softpower"],    misaligned: ["violence", "siege"] },
  yesod:   { aligned: ["intrigue", "soul", "faith"],             misaligned: ["violence", "siege"] },
  malkuth: { aligned: ["economy", "logistics", "body"],          misaligned: ["violence"] }
};

// Per-kind defaults. Conceptual = idea/lore, Vestigial = place/object,
// Animate = creature/person. Single-mat v1 (B10 will expand multi-mat later).
const KINDS = {
  conceptual: {
    label:      "Conceptual",
    materialKey:"vow-resin",
    materialAmount: 1,
    opCost:     { pool: "soul",      amount: 2 },
    ritualDC:   18,
    descIntro:  "Idea-form. Lives in unwritten doctrine, half-remembered song, the shape of a vow."
  },
  vestigial: {
    label:      "Vestigial",
    materialKey:"anchorstone",
    materialAmount: 1,
    opCost:     { pool: "logistics", amount: 3 },
    ritualDC:   15,
    descIntro:  "Echo-form. Lives in a place or object that remembers what was done there."
  },
  animate: {
    label:      "Animate",
    materialKey:"freshwater-pearl",
    materialAmount: 1,
    opCost:     { pool: "faith",     amount: 4 },
    ritualDC:   13,
    descIntro:  "Living-form. Lives in a creature, a person, or the rite they keep."
  }
};

// Foundry stock icons. Pick varied tints by kind so the picker has visual diversity.
const KIND_ICON = {
  conceptual: "icons/svg/aura.svg",
  vestigial:  "icons/svg/anchor.svg",
  animate:    "icons/svg/dice-target.svg"
};

// 16-char alphanumeric ID — Foundry compendium-item canon (per
// feedback_foundry_document_id_format.md).
function makeId(seed) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  // Deterministic from seed string so re-runs produce the same ids.
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  let id = "";
  for (let i = 0; i < 16; i++) {
    h = (h * 1103515245 + 12345) | 0;
    id += chars[Math.abs(h) % chars.length];
  }
  return id;
}

function buildSpark(seph, kindKey) {
  const kind = KINDS[kindKey];
  const align = ALIGNMENT[seph.key];
  const name = `Spark of ${seph.virtue} (${kind.label})`;
  const identifier = `spark_${seph.key}_${kindKey}`;
  const id = makeId(identifier);

  const lore = `<p><em>${kind.descIntro}</em></p>
<p><strong>Sephirah:</strong> ${seph.label} — ${seph.domain}.</p>
<p><strong>Aligned methods:</strong> ${align.aligned.join(", ")}. <strong>Misaligned (causes Corruption):</strong> ${align.misaligned.join(", ")}.</p>
<p><em>GM hint:</em> When a quest beat resolves with a method tagged in <code>aligned</code>, the spark gathers cleanly. A method in <code>misaligned</code> still gathers it but flags it Corrupted — a repair ritual is required before it's eligible for faction integration.</p>`;

  return {
    _id: id,
    name,
    type: "spark",
    img: KIND_ICON[kindKey],
    system: {
      category: "spark",
      sephirah: seph.key,
      kind: kindKey,
      alignedMethods:    align.aligned,
      misalignedMethods: align.misaligned,
      repair: {
        materialKey:    kind.materialKey,
        materialAmount: kind.materialAmount,
        opCost:         { ...kind.opCost },
        ritualDC:       kind.ritualDC
      },
      source: "BBTTCC Tikkun v1.0",
      tags: [seph.key, kindKey, "spark"],
      description: { value: lore, chat: "" }
    },
    flags: {
      "bbttcc-tikkun": {
        sparkVersion: "1.0.0",
        identifier
      }
    },
    _stats: {
      coreVersion: "13.351",
      systemId:    "fourththing",
      systemVersion: "0.6.0",
      createdTime: 0,
      modifiedTime: 0,
      // Foundry validates lastModifiedBy as a 16-char user id. Leaving null
      // here; the load macro substitutes `game.user.id` at import time.
      lastModifiedBy: null
    },
    _key: `!items!${id}`
  };
}

let written = 0;
for (const seph of SEPHIROT) {
  for (const kindKey of Object.keys(KINDS)) {
    const obj = buildSpark(seph, kindKey);
    const filename = `${obj.flags["bbttcc-tikkun"].identifier}.json`;
    fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(obj, null, 2));
    written++;
  }
}
console.log(`Wrote ${written} spark JSON sources.`);
