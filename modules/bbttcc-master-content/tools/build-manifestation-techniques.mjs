#!/usr/bin/env node
/**
 * build-manifestation-techniques.mjs  (2026-06-23)
 * ─────────────────────────────────────────────────────────────────────────────
 * Folds the 16 manifestation-centered Techniques into the REPO LevelDB items
 * pack (modules/bbttcc-master-content/packs/items) — the version-controlled
 * counterpart to the in-world seeder create-manifestation-techniques.macro.js.
 * KEEP THE SPECS IN THIS FILE IN SYNC WITH THAT MACRO.
 *
 * ADDITIVE + idempotent: reads existing records first, resolves the "BBTTCC
 * Feats" folder by name, upserts each feat by system.identifier (reusing the
 * existing _id if present), and batch-puts. Never deletes. Safe to re-run.
 *
 * USAGE (repo root or anywhere):
 *   node build-manifestation-techniques.mjs --dry     # read + print plan, no writes
 *   node build-manifestation-techniques.mjs           # write into the repo pack
 *
 * The repo pack is the git copy, separate from any running Foundry Data dir, so
 * it is safe to open directly. This does NOT touch live — live got the same 16
 * via the in-world macro.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));           // .../tools
const PACK_DIR = join(ROOT, "..", "packs", "items");
const CL_PATH = "/opt/homebrew/lib/node_modules/@foundryvtt/foundryvtt-cli/node_modules/classic-level/index.js";
const FOLDER_NAME = "BBTTCC Feats";
const SOURCE_TAG = "BBTTCC Manifestation Techniques v1";
const PACK_FLAG = "bbttcc-manifestation-techniques-v1";
const DRY = process.argv.includes("--dry");

const B62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function fid(seed) {
  const h = createHash("sha256").update("ft-manif-tech:" + seed).digest();
  let out = "";
  for (let i = 0; i < 16; i++) out += B62[h[i] % 62];
  return out;
}
const STAMP = {
  coreVersion: "14.364", systemId: "fourththing", systemVersion: "0.6.0",
  createdTime: 1782518400000, modifiedTime: 1782518400000, lastModifiedBy: "manifTechBuild0",
  compendiumSource: null, duplicateSource: null, exportSource: null
};

// ── SPECS (identical to create-manifestation-techniques.macro.js) ────────────
const SPECS = [
  { slug: "deep_well", name: "Deep Well", theme: "Clarity economy", access: "General",
    img: "icons/magic/water/orb-water-bubbles.webp",
    flavor: "Your reservoir of will runs deeper than most stewards'.",
    rules: "<p>Your maximum <strong>Clarity</strong> increases by <strong>2</strong>. A deeper reservoir lets you hold more manifestations at once and absorb a bad misfire without running dry.</p>",
    autoNote: "Applies automatically: +2 Clarity max.",
    ft: { discipline: { passive: { clarityMaxBonus: 2 } } } },
  { slug: "drawing_deep", name: "Drawing Deep", theme: "Clarity economy", access: "Cosmic Linguist",
    img: "icons/magic/symbols/runes-star-blue.webp",
    flavor: "You hold the Sentence open and let the meaning pour in.",
    rules: "<p>While your <strong>Sentence</strong> stance is active, your maximum <strong>Clarity</strong> increases by <strong>3</strong> — but the open channel costs you <strong>+1 Noise per scene</strong> for as long as the stance is held.</p>",
    autoNote: "Applies automatically while the Sentence stance is active: +3 Clarity max. (The +1 Noise/scene upkeep is tracked narratively.)",
    ft: { discipline: { mode: { key: "clSentence", grants: { clarityMaxBonus: 3 } } } } },
  { slug: "frugal_caster", name: "Frugal Caster", theme: "Clarity economy", access: "General",
    img: "icons/magic/light/explosion-star-glow-blue.webp",
    flavor: "You wring every drop of meaning from a working.",
    rules: "<p>Reduce the <strong>Clarity</strong> cost of any <strong>Tier&nbsp;1</strong> manifestation you cast by <strong>1</strong> (minimum&nbsp;0).</p>",
    ft: {} },
  { slug: "reclamation", name: "Reclamation", theme: "Clarity economy", access: "General",
    img: "icons/magic/control/buff-flight-wings-blue.webp",
    flavor: "You tear reserve will out of your own composure.",
    rules: "<p>Once per scene, you may take <strong>1 Stress</strong> to immediately recover <strong>2 Clarity</strong>, up to your maximum.</p>",
    ft: {} },
  { slug: "many_hands", name: "Many Hands", theme: "Concurrency & upkeep", access: "General",
    img: "icons/magic/control/hypnosis-mesmerism-eye.webp",
    flavor: "You keep more plates spinning than anyone has a right to.",
    rules: "<p>You can sustain <strong>one additional manifestation</strong> before upkeep begins charging you for the overflow. Increases your manifestation <strong>concurrency by 1</strong>.</p>",
    autoNote: "Applies automatically: +1 manifestation concurrency.",
    ft: { discipline: { passive: { concurrencyBonus: 1 } } } },
  { slug: "light_footprint", name: "Light Footprint", theme: "Concurrency & upkeep", access: "General",
    img: "icons/magic/movement/trail-streak-zigzag-yellow.webp",
    flavor: "Your sustained workings sit lightly on the world.",
    rules: "<p>The ongoing <strong>upkeep</strong> cost of maintaining your sustained manifestations is <strong>halved</strong>.</p>",
    autoNote: "Applies automatically: upkeep cost ×0.5.",
    ft: { discipline: { passive: { upkeepScale: 0.5 } } } },
  { slug: "refracted_attention", name: "Refracted Attention", theme: "Concurrency & upkeep", access: "Wyrdlens-Adept",
    img: "icons/magic/perception/eye-ringed-glow-angry-blue.webp",
    flavor: "Through the lens, one mind looks out of many windows.",
    rules: "<p>While your <strong>Refraction</strong> stance is active, you split your focus across more threads: hold <strong>+1 manifestation</strong> and pay only <strong>three-quarters</strong> upkeep on what you sustain.</p>",
    autoNote: "Applies automatically while the Refraction stance is active: +1 concurrency, upkeep ×0.75.",
    ft: { discipline: { mode: { key: "wlRefraction", grants: { concurrencyBonus: 1, upkeepScale: 0.75 } } } } },
  { slug: "bound_and_bargained", name: "Bound and Bargained", theme: "Concurrency & upkeep", access: "Pactkeeper",
    img: "icons/magic/symbols/runes-carved-stone-purple.webp",
    flavor: "A sealed pact holds itself; you need only keep the terms.",
    rules: "<p>While your <strong>Sealed Pact</strong> stance is active, the bindings carry their own weight: the <strong>upkeep</strong> cost of your sustained manifestations is <strong>halved</strong>.</p>",
    autoNote: "Applies automatically while the Sealed Pact stance is active: upkeep ×0.5.",
    ft: { discipline: { mode: { key: "pkSealedPact", grants: { upkeepScale: 0.5 } } } } },
  { slug: "steady_hand", name: "Steady Hand", theme: "Misfire & risk", access: "General",
    img: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
    flavor: "When it goes wrong, your discipline pulls the backlash short.",
    rules: "<p>When a manifestation misfires, the result lands <strong>one band safer</strong> — your control biases the backlash toward the mild end of the table.</p>",
    autoNote: "Applies automatically: misfire band shifted −1 (safer).",
    ft: { discipline: { passive: { misfireBandShift: -1 } } } },
  { slug: "pay_the_toll", name: "Pay the Toll", theme: "Misfire & risk", access: "General",
    img: "icons/magic/death/skull-energy-light-purple.webp",
    flavor: "You have made your peace with the price of reaching.",
    rules: "<p>The <strong>Blood-Debt</strong> cost of reaching beyond your grasp is reduced by <strong>1</strong> (minimum&nbsp;0).</p>",
    autoNote: "Applies automatically: reach Blood-Debt cost −1.",
    ft: { discipline: { passive: { reachDiscount: 1 } } } },
  { slug: "lucid_footing", name: "Lucid Footing", theme: "Misfire & risk", access: "Dreamwalker",
    img: "icons/magic/control/sleep-bubble-purple.webp",
    flavor: "In the Lane, the dream cushions your mistakes.",
    rules: "<p>While you walk the <strong>Lane</strong>, misfires land <strong>two bands safer</strong> and the <strong>Blood-Debt</strong> cost of reaching is reduced by <strong>1</strong>.</p>",
    autoNote: "Applies automatically while the Walking-Lane stance is active: misfire band −2, reach Blood-Debt −1.",
    ft: { discipline: { mode: { key: "dwWalkingLane", grants: { misfireBandShift: -2, reachDiscount: 1 } } } } },
  { slug: "quiet_casting", name: "Quiet Casting", theme: "Misfire & risk", access: "General",
    img: "icons/magic/air/wind-vortex-swirl-gray.webp",
    flavor: "Your workings leave a fainter signature on the world.",
    rules: "<p>Reduce the <strong>Noise</strong> you generate on each cast by <strong>1</strong> (minimum&nbsp;0).</p>",
    ft: {} },
  { slug: "sure_recitation", name: "Sure Recitation", theme: "Reach, scale & signature", access: "General — Tier 2+",
    img: "icons/magic/symbols/runes-triangle-orange.webp",
    flavor: "You speak your workings cleanly, even under pressure.",
    rules: "<p>On any manifestation <strong>cast roll</strong>, you may <strong>reroll the lowest die</strong>, keeping the new result if it is higher.</p>",
    autoNote: "Applies automatically: reroll the lowest die on every manifestation cast.",
    prereqLevel: 6,
    ft: { rerolls: [ { context: "caster-check", mode: "reroll-lowest", note: "Sure Recitation" } ] } },
  { slug: "overreach", name: "Overreach", theme: "Reach, scale & signature", access: "General",
    img: "icons/magic/fire/flame-burning-hand-purple.webp",
    flavor: "You stretch a working past where it ought to reach.",
    rules: "<p>When you cast a manifestation, you may treat your tier as <strong>one higher</strong> for determining its <strong>footprint and scale only</strong> (range, area, and number of targets). Its Clarity cost and Cast DC remain those of your actual tier.</p>",
    ft: {} },
  { slug: "wide_working", name: "Wide Working", theme: "Reach, scale & signature", access: "General",
    img: "icons/magic/light/explosion-star-glow-orange.webp",
    flavor: "What you shape, you shape broadly.",
    rules: "<p>Increase the <strong>area size</strong> of any area-of-effect manifestation you cast by one step (e.g. a 10&nbsp;ft burst becomes 15&nbsp;ft; a 15&nbsp;ft cone becomes 20&nbsp;ft).</p>",
    ft: {} },
  { slug: "signature_ascendant", name: "Signature Ascendant", theme: "Reach, scale & signature", access: "General",
    img: "icons/magic/symbols/star-solid-gold.webp",
    flavor: "The working that defines you grows as you do.",
    rules: "<p>Your <strong>signature manifestation</strong> counts as <strong>one tier higher</strong> for all effects (damage, healing, footprint, scale), though its Clarity cost is unchanged. If you have not yet designated a signature manifestation, you may do so when you take this Technique.</p>",
    ft: {} }
];

function buildDescription(spec) {
  const flavor = spec.flavor ? `<p><em>${spec.flavor}</em></p>` : "";
  const reqLine = (spec.access && spec.access !== "General")
    ? `<p style="font-size:0.8rem;opacity:0.85;margin:0.5rem 0 0"><strong>Requires:</strong> ${spec.access}</p>` : "";
  const autoLine = spec.autoNote
    ? `<p style="font-size:0.74rem;opacity:0.7;margin:0.5rem 0 0">⚙ ${spec.autoNote}</p>`
    : `<p style="font-size:0.74rem;opacity:0.7;margin:0.5rem 0 0">✍ Applied by the GM/player — no automatic engine effect.</p>`;
  return `<h2>${spec.name}</h2>${flavor}<hr /><h3>Rules</h3>${spec.rules}${reqLine}${autoLine}`;
}

function buildFeatDoc(spec, id, folderId) {
  const identifier = `bbttcc_feat_${spec.slug}`;
  return {
    _id: id,
    name: spec.name,
    type: "feat",
    img: spec.img || "icons/magic/symbols/runes-star-blue.webp",
    folder: folderId,
    sort: 0,
    system: {
      category: "technique",
      source: { custom: SOURCE_TAG, rules: "2024", revision: 1 },
      tags: [],
      description: { value: buildDescription(spec), chat: "" },
      identifier,
      uses: { max: "", spent: 0, recovery: [] },
      requirements: (spec.access && spec.access !== "General") ? spec.access : "",
      type: { value: "feat", subtype: "" },
      activities: {},
      advancement: {},
      crewed: false,
      enchant: {},
      prerequisites: { items: [], repeatable: false, level: spec.prereqLevel ?? null },
      properties: []
    },
    effects: [],
    flags: {
      bbttcc: { pack: PACK_FLAG, theme: spec.theme },
      fourththing: spec.ft || {}
    },
    ownership: { default: 0 },
    _stats: { ...STAMP }
  };
}

const { ClassicLevel } = await import(CL_PATH);
const db = new ClassicLevel(PACK_DIR, { keyEncoding: "utf8", valueEncoding: "json" });
await db.open();

try {
  // Read existing folders + feat items.
  const folders = [];
  const itemsByIdentifier = new Map();
  let totalItems = 0;
  for await (const [key, val] of db.iterator()) {
    if (key.startsWith("!folders!")) folders.push(val);
    else if (key.startsWith("!items!")) {
      totalItems++;
      const ident = val?.system?.identifier;
      if (ident) itemsByIdentifier.set(ident, val);
    }
  }

  let folder = folders.find(f => f.name === FOLDER_NAME && f.type === "Item")
            ?? folders.find(f => f.name === FOLDER_NAME);
  let newFolderDoc = null;
  if (!folder) {
    const fId = fid("folder:" + FOLDER_NAME);
    newFolderDoc = { _id: fId, name: FOLDER_NAME, type: "Item", folder: null, sorting: "a", sort: 0, color: "#6f4bd8", description: "", flags: {}, _stats: { ...STAMP } };
    folder = newFolderDoc;
  }
  const folderId = folder._id;

  const batch = db.batch();
  const plan = [];
  let created = 0, updated = 0;
  for (const spec of SPECS) {
    const identifier = `bbttcc_feat_${spec.slug}`;
    const existing = itemsByIdentifier.get(identifier);
    const id = existing?._id ?? fid("item:" + spec.slug);
    const doc = buildFeatDoc(spec, id, folderId);
    if (existing?.sort) doc.sort = existing.sort;
    if (existing) updated++; else created++;
    plan.push(`${existing ? "UPDATE" : "CREATE"}  ${id}  ${spec.name}  [${spec.access}]  ${spec.autoNote ? "⚙" : "✍"}`);
    if (!DRY) batch.put(`!items!${id}`, doc);
  }
  if (!DRY && newFolderDoc) batch.put(`!folders!${newFolderDoc._id}`, newFolderDoc);

  console.log(`Pack: ${PACK_DIR}`);
  console.log(`Existing items: ${totalItems} | folder "${FOLDER_NAME}": ${newFolderDoc ? "WILL CREATE " + folderId : "found " + folderId}`);
  plan.forEach(p => console.log("  " + p));

  if (DRY) {
    console.log(`\n[dry] ${SPECS.length} planned (${created} create, ${updated} update), no writes.`);
  } else {
    await batch.write();
    console.log(`\n[written] ${created} created, ${updated} updated${newFolderDoc ? " + 1 folder created" : ""}. Pack items: ${totalItems} → ${totalItems + created}.`);
  }
} finally {
  await db.close();
}
