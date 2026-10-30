#!/usr/bin/env node
/* build-item-ladder.mjs — GRADED ARMS (+1/+2/+3) and BOUND WORKINGS (enspelled) for the RFI items pack (owner ask 2026-10-07).
 * Usage (repo root): node modules/bbttcc-master-content/tools/build-item-ladder.mjs <items.jsonl> [--dump out.jsonl] [--out macro.js]
 *                                                                                  [--source] [--manifest out.json] [--stamp YYYY-MM-DD]
 *   → tools/seed-item-ladder-<stamp>.macro.js [GM, DRY_RUN]: Item.create into bbttcc-master-content.items, folders "Graded Arms" /
 *     "Bound Workings" (created if missing); a name that already exists is skipped. --dump writes the same items as pack-dump rows
 *     so bin/ft-lint-items can judge them before they go live.
 *   --source   (AR13/AR14, 2026-10-26) also writes packs/_source/items/<Name>_<id>.json. A ladder record that already exists in the
 *              dump (same name) KEEPS its _id / folder / _stats / ownership, so repo _source == live and re-runs are updates, not twins.
 *   --manifest writes { "<id>": <full regenerated doc> } for the applier differ (CONTENT_AUDITS_2026_10_25/build) — re-run this
 *              after every kit or base-arm fix so Bound Working payloads and graded copies stop drifting from their bases.
 * Shapes: systems/fourththing/item-ladder.js (flags.fourththing.grade / .working); prices from systems/fourththing/rfi-pricing.js
 * (the rubric — grade raises the tier one step per rank; a bound Working is technomagical ×2 at tier = power tier + 1);
 * recipes = the base item's materialOf + grade/working materials (real materialKeys from the Crafting Materials folder).
 * Origin: ladder output is stamped rfi.item.origin "forged" (AR1) — "crafted" routed every graded arm to the Manifestations tab.
 * Text: the base's ⚙️ Mechanical Effects block is RE-STAMPED for the copy (Tier / Cost / Damage / Defense / Requires), the
 * "Standard Issue." label is dropped (graded arms are not Standard Issue), then the ⟡ ladder block is appended.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2); const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const [ITEMS] = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
if (!ITEMS) { console.error("usage: build-item-ladder.mjs <items.jsonl> [--dump out.jsonl] [--out macro.js] [--source] [--manifest out.json] [--stamp YYYY-MM-DD]"); process.exit(2); }
const STAMP = opt("--stamp", new Date().toISOString().slice(0, 10));
const OUT = opt("--out", path.join(HERE, `seed-item-ladder-${STAMP}.macro.js`)), DUMP = opt("--dump"), MANIFEST = opt("--manifest"), SOURCE = argv.includes("--source");
const SRC_DIR = path.resolve(HERE, "../packs/_source/items");
// Foundry-free import of the pricing rubric (it registers hooks at module load).
globalThis.Hooks = { on() {}, once() {}, callAll() {} }; globalThis.game = { settings: { get() { return undefined; } } };
const pricing = await import(pathToFileURL(path.resolve(HERE, "../../../systems/fourththing/rfi-pricing.js")).href);
const ladder = await import(pathToFileURL(path.resolve(HERE, "../../../systems/fourththing/item-ladder.js")).href);
const { computeListPrice, computeSaleBack, emptyTechShape } = pricing; const { GRADES } = ladder;
const ROMAN = ["", "I", "II", "III", "IV"], TIER_INT = { I: 1, II: 2, III: 3, IV: 4 };
const rows = fs.readFileSync(ITEMS, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const items = rows.filter(r => r.k.startsWith("!items!")).map(r => r.v);
const byName = n => { const it = items.find(i => i.name === n); if (!it) throw new Error(`items pack has no "${n}"`); return it; };
const existing = n => items.find(i => i.name === n) ?? null;   // an earlier ladder run's record (keeps its id)
const rfi = it => it.flags?.fourththing?.rfi?.item ?? {};
const tierOf = it => TIER_INT[rfi(it).tier] || 1;
const mats = (list) => (list || []).map(m => typeof m === "string" ? { key: m, qty: 1 } : { key: m.key, qty: Number(m.qty) || 1 });
const id = () => { const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let s = ""; for (let i = 0; i < 16; i++) s += c[Math.floor(Math.random() * c.length)]; return s; };
const strip = it => { const v = structuredClone(it); delete v._id; delete v.folder; delete v.sort; delete v.ownership; delete v._stats; delete v.effects; delete v._key; return v; };
const frameOf = it => rfi(it).frame || (it.type === "weapon" ? "weapon" : "armor");
const cap = s => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
const CUR_LABEL = { violence: "Violence", nonlethal: "Nonlethal", intrigue: "Intrigue", economy: "Economy", softpower: "Soft Power", diplomacy: "Diplomacy", logistics: "Logistics", culture: "Culture", faith: "Faith" };
const WEIGHT_SKILL = { light: "fitting", medium: "bracing", heavy: "plating", shield: "bracing" };   // = FT.ARMOR_WEIGHT_SKILL (AR5)
const gateSkill = v => { for (const t of v.system?.tags || []) { const k = WEIGHT_SKILL[String(t).toLowerCase()]; if (k) return k; } const d = String(v.system?.armorSkill || ""); return ({ weave: "fitting", warding: "bracing" })[d] || d || "fitting"; };
function priceFor(tier, frame, { tech = false, bound = "free" } = {}, currency, note) {
  const marks = computeListPrice({ tier, frame, hasTech: tech, bound });   // shield / vestment / footwear are in the tables since 2026-10-07
  return { marks, currency, gmOverride: false, altCurrencies: {}, split: null, rarityMult: 1, notes: note, bound, saleBack: computeSaleBack(marks, bound) };
}
const mech = (lines) => `\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ ${lines[0]}</strong></p>\n<ul>\n${lines.slice(1).map(l => `  <li>${l}</li>`).join("\n")}\n</ul>\n<!-- BBTTCC:LADDER:END -->`;
const LADDER_RX = /\n?<!-- BBTTCC:LADDER:START -->[\s\S]*?<!-- BBTTCC:LADDER:END -->/;
// "Standard Issue." is a T1 label (free within horizon) — graded / bound copies are not. Drop the label, keep the sentence that follows;
// also scrub the 2026-10-25 sweep's literal "(drop — graded arms are not Standard Issue)" if a base ever carries it.
const dropStandardIssue = html => String(html || "")
  .replace(/<(b|strong)>\(drop — graded arms are not Standard Issue\)<\/\1>\s*/g, "")
  .replace(/\(drop — graded arms are not Standard Issue\)\s*/g, "")
  .replace(/<(b|strong)>Standard Issue\.<\/\1>\s*/g, "")
  .replace(/Standard Issue\.\s*/g, "");
// Re-stamp the base's ⚙️ Mechanical Effects block for the copy: Tier / Cost / Defense / Damage / Requires lines.
function restampMech(html, { tier, price, defense, damage, requires }) {
  let h = String(html || "");
  h = h.replace(/(<strong>Tier:<\/strong>\s*)(T?)(?:IV|III|II|I|[1-4])\b/g, (_m, pre, t) => `${pre}${t ? `T${tier}` : ROMAN[tier]}`);
  if (price) h = h.replace(/(<strong>Cost:<\/strong>\s*)\d+\s+[A-Za-z ]+?\s+marks/g, `$1${price.marks} ${CUR_LABEL[price.currency] || cap(price.currency)} marks`);
  if (defense) h = h.replace(/(<strong>Defense:<\/strong>\s*)[^<]+/g, `$1${defense}`);
  if (damage) h = h.replace(/(<strong>Damage:<\/strong>\s*)([0-9]+d[0-9]+(?:\s*[+-]\s*\d+)?)/g, `$1${damage}`);
  if (requires) h = h.replace(/(<strong>Requires:<\/strong>\s*)[A-Za-z]+/g, `$1${cap(requires)}`);
  return h;
}
const bumpedDefense = v => [["guardBonus", "Guard"], ["evasionBonus", "Evasion"], ["resolveBonus", "Resolve"]].filter(([k]) => Number(v.system[k]) !== 0).map(([k, l]) => `${l} ${Number(v.system[k]) > 0 ? "+" : ""}${Number(v.system[k])}`).join(", ");

// ── GRADED ARMS ───────────────────────────────────────────────────────────────────────────────────────
const GRADE_MATS = {
  weapon: { 1: [["hex-iron-cleat", 1]], 2: [["hex-glyph-plate", 1], ["heart-iron", 2]], 3: [["yesodium", 1], ["vow-bound-edge", 1]] },
  armor:  { 1: [["sept-silver", 1]],    2: [["hex-glyph-plate", 1], ["wardiron", 1]],   3: [["yesodium", 1], ["hex-lattice", 1]] }
};
const GRADE_BASES = [
  // T1 baseline arms (all three grades)
  ..."Maul|Hand Axe|Combat Knife|Sap|Slug Pistol|Bolt-Driver|Hunting Rifle|Knuckle Dusters".split("|").map(n => ({ name: n, ranks: [1, 2, 3] })),
  ..."Patrolman's Plate|Bulwark Hauberk|Worker's Leathers|Drifter's Weave|Initiate's Robe|Pressed Buckler".split("|").map(n => ({ name: n, ranks: [1, 2, 3] })),
  // T2 arms — two grades (a Crowned T2 would read T4+, past the ladder)
  ..."Laser Pistol, Rad|Steelweave Hauberk|Septhide Vestments|Wardiron Targe".split("|").map(n => ({ name: n, ranks: [1, 2] }))
];
const graded = [];
for (const { name, ranks } of GRADE_BASES) {
  const base = byName(name), r = rfi(base), baseTier = tierOf(base), frame = frameOf(base), isWeapon = base.type === "weapon";
  for (const rank of ranks) {
    const G = GRADES[rank], tier = Math.min(4, baseTier + rank), v = strip(base);
    v.name = `${G.name} ${base.name}`;
    const grade = { rank, name: G.name, key: G.key };
    const lines = [`${G.name} (+${rank}). ${G.blurb}`];
    let damage = null, defense = null;
    if (isWeapon) {
      const f = String(v.system.damage.formula).replace(/\s+/g, ""); const m = f.match(/^(.+?)([+-]\d+)?$/); const tail = (Number(m[2]) || 0) + rank;
      v.system.damage.formula = `${m[1]} + ${tail}`; damage = v.system.damage.formula; grade.attack = rank; grade.damage = rank;
      lines.push(`<strong>+${rank} to hit and +${rank} damage</strong> with this weapon (the hit bonus is read from the weapon you swing).`);
    } else {
      grade.defense = rank; const bumped = [];
      for (const [k, label] of [["guardBonus", "Guard"], ["evasionBonus", "Evasion"], ["resolveBonus", "Resolve"]]) if (Number(v.system[k]) > 0) { v.system[k] = Number(v.system[k]) + rank; bumped.push(`${label} +${v.system[k]}`); }
      if (!bumped.length) { v.system.guardBonus = rank; bumped.push(`Guard +${rank}`); }
      defense = bumpedDefense(v);
      lines.push(`<strong>+${rank} on each of its defense bonuses</strong> → ${bumped.join(", ")} (rank-scaled like all armor: Trained half, Proficient full).`);
    }
    lines.push(`Grade raises it to <strong>Tier ${ROMAN[tier]}</strong> · ${G.bound === "free" ? "free to wield" : G.bound === "attuned" ? "attuned (one slot)" : "soulbound — one bearer, no sale"}.`);
    const ri = structuredClone(r); ri.tier = ROMAN[tier]; ri.bound = G.bound; ri.origin = "forged"; ri.signature = ri.signature || G.blurb;
    ri.materialOf = [...mats(r.materialOf), ...GRADE_MATS[isWeapon ? "weapon" : "armor"][rank].map(([key, qty]) => ({ key, qty }))];
    ri.price = priceFor(tier, frame, { bound: G.bound }, r.price?.currency || (isWeapon ? "violence" : "nonlethal"), `T${ROMAN[tier]} ${frame} (${G.name} +${rank} on T${ROMAN[baseTier]} ${base.name}) × bound ${G.bound}`);
    if (ri.lore) ri.lore = dropStandardIssue(ri.lore);
    v.system.description = v.system.description || { value: "", chat: "" };
    v.system.description.value = restampMech(dropStandardIssue(String(v.system.description.value || "").replace(LADDER_RX, "")), { tier, price: isWeapon ? null : ri.price, defense, damage, requires: isWeapon ? null : gateSkill(v) }) + mech(lines);
    if (v.system.manifestation && typeof v.system.manifestation === "object") v.system.manifestation.tier = tier;   // rider save DCs scale with the item tier
    v.flags = v.flags || {}; v.flags.fourththing = v.flags.fourththing || {}; v.flags.fourththing.grade = grade;
    v.flags.fourththing.rfi = { item: ri };
    v.system.tags = Array.from(new Set([...(v.system.tags || []), "graded", `grade-${G.key}`]));
    graded.push(v);
  }
}

// ── BOUND WORKINGS ────────────────────────────────────────────────────────────────────────────────────
const WORKINGS = [
  { host: "Hand Axe",          power: "Keystone Verdict",      name: "Hand Axe of the Keystone Verdict" },
  { host: "Maul",              power: "Pressure Front",        name: "Maul of the Pressure Front" },
  { host: "Combat Knife",      power: "Strikethrough",         name: "Combat Knife of Strikethrough" },
  { host: "Slug Pistol",       power: "Correspondence Strike", name: "Slug Pistol of Correspondence" },
  { host: "Sap",               power: "Sleep-Loop",            name: "Sap of the Sleep-Loop" },
  { host: "Bolt-Driver",       power: "Freeze Assets",         name: "Bolt-Driver of Frozen Assets" },
  { host: "Hunting Rifle",     power: "The Record Shows",      name: "Hunting Rifle of the Record" },
  { host: "Initiate's Robe",   power: "Thick Skin, Literally", name: "Initiate's Robe of Thick Skin" },
  { host: "Worker's Leathers", power: "Heavily Redacted",      name: "Worker's Leathers, Heavily Redacted" },
  { host: "Drifter's Weave",   power: "Standing Oath",         name: "Drifter's Weave of the Standing Oath" },
  { host: "Pressed Buckler",   power: "Mutual Aid Clause",     name: "Pressed Buckler of Mutual Aid" },
  { host: "Bulwark Hauberk",   power: "Wall of My People",     name: "Bulwark Hauberk of the Wall" },
  { host: "Patrolman's Plate", power: "The Good Dream",        name: "Patrolman's Plate of the Good Dream" },
  { host: "Boots That Knew Each Other Once", power: "Doorframe Discount", name: "Boots of the Doorframe Discount" },
  { host: "Scarf That Was a Cat (Probably)", power: "Latchkey Lullaby",  name: "Scarf of the Latchkey Lullaby" }
];
const WORKING_MATS = [["prayer-binding", 1], ["anchor-quartz", 1], ["focused-crystal", 1], ["witness-glass", 1]];   // = the recipe the 15 live Workings carry since 2026-10-07; witness-glass = the rubric §6 binding material a tech recipe must carry
const workings = [];
for (const spec of WORKINGS) {
  const host = byName(spec.host), power = byName(spec.power), r = rfi(host), frame = frameOf(host);
  const pTier = Number(power.system?.manifestation?.tier) || 1, tier = Math.min(4, Math.max(tierOf(host), pTier + 1)), v = strip(host);
  v.name = spec.name;
  const ps = structuredClone(power.system); ps.clarityRequired = 0; if (ps.manifestation) { ps.manifestation.costType = "none"; ps.manifestation.costValue = 0; }
  v.flags = v.flags || {}; v.flags.fourththing = v.flags.fourththing || {};
  // power.flags.autoanimations rides along so the companion casts with the kit power's animation (item-ladder.js companionData copies it).
  const pFlags = power.flags?.autoanimations ? { autoanimations: structuredClone(power.flags.autoanimations) } : undefined;
  v.flags.fourththing.working = { power: { name: power.name, img: power.img, system: ps, ...(pFlags ? { flags: pFlags } : {}) }, charges: { value: 3, max: 3, recoverPer: "soma-break" }, tier: pTier };
  const effect = String(power.system?.effect || "").replace(/<[^>]+>/g, "").trim();
  const ri = structuredClone(r); ri.tier = ROMAN[tier]; ri.bound = "attuned"; ri.origin = "forged"; ri.signature = ri.signature || `It remembers one Working and nothing else.`;
  ri.tech = Object.assign(emptyTechShape(), { kind: "charged", charges: { value: 3, max: 3, recoverPer: "soma-break" }, attunement: { required: true, slots: 1 }, failure: "misfire", origin: "witness-forge", signature: "bound-working" });
  ri.materialOf = [...mats(r.materialOf), ...WORKING_MATS.map(([key, qty]) => ({ key, qty }))];
  ri.price = priceFor(tier, frame, { tech: true, bound: "attuned" }, r.price?.currency || (host.type === "weapon" ? "violence" : "nonlethal"), `T${ROMAN[tier]} ${frame} × tech 2.0 (bound Working: ${power.name} T${ROMAN[pTier]}) × attuned`);
  if (ri.lore) ri.lore = dropStandardIssue(ri.lore);
  v.system.description = v.system.description || { value: "", chat: "" };
  v.system.description.value = restampMech(dropStandardIssue(String(v.system.description.value || "").replace(LADDER_RX, "")), { tier, price: host.type === "weapon" ? null : ri.price, requires: host.type === "weapon" ? null : gateSkill(v) }) + mech([
    `Bound Working — ${power.name} (T${ROMAN[pTier]}).`,
    `Carries the Working <strong>${power.name}</strong>: it appears among your Manifestations as “${power.name} ⟡ ${spec.name}” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.`,
    `<strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.`,
    `<em>${effect}</em>`,
    `Tier ${ROMAN[tier]} · attuned (one slot) · technomagical (Witness-forge binding).`
  ]);
  if (v.system.manifestation && typeof v.system.manifestation === "object") v.system.manifestation.tier = tier;
  v.flags.fourththing.rfi = { item: ri };
  v.system.tags = Array.from(new Set([...(v.system.tags || []), "bound-working"]));
  workings.push(v);
}

// ── outputs ───────────────────────────────────────────────────────────────────────────────────────────
const all = [...graded.map(v => ({ folder: "Graded Arms", v })), ...workings.map(v => ({ folder: "Bound Workings", v }))];
// Identity: an existing record of the same name keeps its id / folder / stats so _source == live and re-runs update in place.
const now = Date.now();
const withIdentity = all.map(({ folder, v }) => {
  const prev = existing(v.name); const _id = prev?._id ?? id();
  const stats = prev?._stats ? { ...prev._stats, modifiedTime: now } : { coreVersion: "14.368", systemId: "fourththing", systemVersion: "0.6.6", createdTime: now, modifiedTime: now, lastModifiedBy: null, compendiumSource: null, duplicateSource: null, exportSource: null };
  return { folder, prev, doc: { ...v, folder: prev?.folder ?? null, _id, effects: [], sort: prev?.sort ?? 0, ownership: prev?.ownership ?? { default: 0 }, _stats: stats, _key: `!items!${_id}` } };
});
if (DUMP) fs.writeFileSync(DUMP, withIdentity.map(({ doc }) => JSON.stringify({ k: doc._key, v: (({ _key, ...rest }) => rest)(doc) })).join("\n"));
if (MANIFEST) fs.writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(withIdentity.map(({ doc, prev, folder }) => [doc._id, { folder, existed: !!prev, doc }])), null, 1));
if (SOURCE) {
  let n = 0;
  const have = fs.existsSync(SRC_DIR) ? fs.readdirSync(SRC_DIR) : [];
  for (const { doc } of withIdentity) {
    // an existing file for this id keeps its name (the repo's safe-name spelling differs for punctuated names)
    const prevFile = have.find(f => f.endsWith(`_${doc._id}.json`));
    const fn = path.join(SRC_DIR, prevFile ?? `${doc.name.replace(/[^A-Za-z0-9]/g, "_")}_${doc._id}.json`);
    fs.writeFileSync(fn, JSON.stringify(doc, null, 2) + "\n"); n++;
  }
  console.log(`source → ${n} files in ${path.relative(process.cwd(), SRC_DIR)} (${withIdentity.filter(w => w.prev).length} kept their live id)`);
}
fs.writeFileSync(OUT, `/* ${path.basename(OUT)} — ITEM LADDER seed (GENERATED ${STAMP} by build-item-ladder.mjs — do not hand-edit; rebuild from a fresh dump).
 * Paste into a GM macro on EMBER and run. DRY_RUN = true prints the plan and writes nothing; flip to false to create.
 * What: ${graded.length} graded arms (Inlaid / Circuited / Crowned on the T1 baseline arms + four T2 pieces) and ${workings.length} Bound Workings
 *       (a host item carrying one Manifestation on 3 charges) into bbttcc-master-content.items, folders "Graded Arms" / "Bound Workings".
 *       A name that already exists in the pack is skipped (re-stamp existing records with the build manifest instead). Engine: systems/fourththing/item-ladder.js (needs system ≥ 0.6.6).
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.items";
const ITEMS = ${JSON.stringify(all, null, 1)};
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  if (!game.fourththing?.ladder?.GRADES) return ui.notifications.error("item-ladder engine not loaded — deploy system 0.6.6, restart, hard-reload.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(\`No pack \${PACK_ID}\`);
  const index = await pack.getIndex(); const have = new Set(index.map(i => i.name));
  const log = []; let created = 0, skipped = 0;
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    const folderId = async (name) => { let f = pack.folders.find(x => x.name === name); if (!f && !DRY_RUN) f = await Folder.create({ name, type: "Item" }, { pack: pack.collection }); return f?.id ?? null; };
    const byFolder = {}; for (const row of ITEMS) (byFolder[row.folder] ??= []).push(row.v);
    for (const [folder, docs] of Object.entries(byFolder)) {
      const fid = await folderId(folder);
      const fresh = docs.filter(d => { if (have.has(d.name)) { log.push(\`· skip \${d.name} — already in the pack\`); skipped++; return false; } return true; });
      for (const d of fresh) log.push(\`\${DRY_RUN ? "·" : "✔"} [\${folder}] \${d.name}  T\${d.flags.fourththing.rfi.item.tier} \${d.flags.fourththing.rfi.item.bound} \${d.flags.fourththing.rfi.item.price.marks} marks\`);
      if (!DRY_RUN && fresh.length) { await Item.createDocuments(fresh.map(d => ({ ...d, folder: fid })), { pack: pack.collection }); created += fresh.length; }
      else created += fresh.length;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(\`[seed-item-ladder] \${DRY_RUN ? "DRY RUN" : "CREATED"} — \${created} item(s), \${skipped} skipped\\n\` + log.join("\\n"));
  ui.notifications.info(\`seed-item-ladder \${DRY_RUN ? "dry run" : "created"}: \${created} items, \${skipped} skipped — see console (F12).\`);
})();
`);
console.log(`build-item-ladder: ${graded.length} graded + ${workings.length} bound Workings → ${OUT}${DUMP ? ` · dump ${DUMP}` : ""}${MANIFEST ? ` · manifest ${MANIFEST}` : ""}`);
for (const { folder, v } of all) { const r = v.flags.fourththing.rfi.item; console.log(`  [${folder}] ${v.name.padEnd(44)} T${String(r.tier).padEnd(3)} ${r.bound.padEnd(9)} ${String(r.price.marks).padStart(5)} marks ${v.type === "weapon" ? v.system.damage.formula : `G${v.system.guardBonus} E${v.system.evasionBonus} R${v.system.resolveBonus}`}`); }
