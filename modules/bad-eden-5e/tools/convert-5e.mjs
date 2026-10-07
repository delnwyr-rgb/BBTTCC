#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · convert-5e.mjs — the conversion seam (RFI canon → 5E content)
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads RFI canon (bbttcc-master-content/packs/_source + the fourththing engine
 * banks), applies conversion/rubric.json, and writes 5E content candidates:
 *
 *   node tools/convert-5e.mjs techniques            preview (counts + needs-human list)
 *   node tools/convert-5e.mjs techniques --write    write content/<lane>.json + content/_needs-human/<lane>.md
 *   node tools/convert-5e.mjs techniques --parity   missing / stale / orphaned vs content/<lane>.json
 *
 * Prose is Dave's and is kept; only mechanics vocabulary is substituted. Every
 * converted entry carries flags.bad-eden-5e.rfi = { id, pack, identifier, hash }
 * so --parity can tell when the RFI source moved. Hand fixes go in
 * content/overrides/<lane>.json (keyed by slug, deep-merged last) so they survive
 * a regeneration. Run `node tools/build-packs.mjs --dry` afterwards: the lint is
 * the last word on leftover vocabulary.
 *
 * Lanes: techniques (the 75 Bad Eden Core techniques → dnd5e feats). Gear and
 * creatures follow once their rubric sections are ruled.
 * ───────────────────────────────────────────────────────────────────────────── */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "..", "..");
const SRC = join(REPO, "modules", "bbttcc-master-content", "packs", "_source");
const SYS = join(REPO, "systems", "fourththing");
const RUBRIC = JSON.parse(readFileSync(join(ROOT, "conversion", "rubric.json"), "utf8"));
const args = process.argv.slice(2);
const lane = args.find(a => !a.startsWith("--"));
const flag = f => args.includes(f);

/* ── helpers ─────────────────────────────────────────────────────────────── */
const sha = s => createHash("sha1").update(s).digest("hex").slice(0, 12);
const walk = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".json") ? [join(dir, e.name)] : []) : [];
const loadPack = pack => walk(join(SRC, pack)).map(f => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } }).filter(d => d && d._id && d.type);
const ABIL = { violence: "str", intrigue: "dex", body: "con", mind: "int", soul: "wis", presence: "cha" };
const ABIL_NAME = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const SKILL_NAME = { ath: "Athletics", ste: "Stealth", inv: "Investigation", per: "Persuasion", itm: "Intimidation", ins: "Insight", his: "History", arc: "Arcana", rel: "Religion", prc: "Perception", prf: "Performance" };
const skillOf = rfi => RUBRIC.skills[String(rfi).toLowerCase()];
const skillText = rfi => { const s = skillOf(rfi); if (!s) return rfi; if (s.text) return s.text; return s.kind === "skill" ? SKILL_NAME[s.key] : s.kind === "tool" ? `${s.key}'s tools` : rfi; };

/** Apply the rubric's vocabulary to a run of HTML/text (Dave's words stay; mechanics move). */
export function convertText(html) {
  let s = html;
  // squares first (numbers), then the ordered substitution table
  s = s.replace(/\b(\d+) squares?\b/gi, (_, n) => `${Number(n) * 5} feet`);
  s = s.replace(/\bshift (\d+) squares?\b/gi, (_, n) => `move ${Number(n) * 5} feet`);
  for (const [pat, rep] of RUBRIC.vocabulary.replace) {
    // a lower-case mechanics row also matches its sentence-initial capital ("Kinetic damage", "Reroll the lowest die")
    const first = pat.match(/^\\b([a-z])/)?.[1];
    const re = new RegExp(first ? pat.replace(/^\\b[a-z]/, `\\b[${first}${first.toUpperCase()}]`) : pat, "g");
    s = s.replace(re, (...m) => {
      const cap = first && /^[A-Z]/.test(m[0]);
      const fix = out => cap ? out.charAt(0).toUpperCase() + out.slice(1) : out;
      if (rep.includes("@ABILITY")) return fix(rep.replace("@ABILITY", ABIL_NAME[ABIL[m[1].toLowerCase()]] ?? m[1]));
      if (rep.includes("@SAVE")) { const sv = { resolve: "Wisdom", evasion: "Dexterity", guard: "Armor Class" }[m[1].toLowerCase()] ?? m[1]; return fix(rep.replace("@SAVE", sv).replace(/\\(\d)/g, (_, i) => m[Number(i)])); }
      if (/\\1 saving throw/.test(rep)) { const sv = { resolve: "Wisdom", evasion: "Dexterity" }[m[1].toLowerCase()] ?? m[1]; return fix(rep.replace("\\1", sv).replace(/\\(\d)/g, (_, i) => m[Number(i)])); }
      if (rep.includes("@SKILL")) return fix(skillText(m[1]));
      if (rep.includes("@SQUARES")) return fix(rep.replace("@SQUARES", String(Number(m[1]) * 5)));
      return fix(rep.replace(/\\(\d)/g, (_, i) => m[Number(i)]));
    });
  }
  return s;
}

/** Leftover banned terms after conversion — what a human must look at. */
const CASED = /^\\b(Integrity|\(Violence|\(VIO|Stress damage)/;
export function leftovers(text) {
  const plain = text.replace(/<[^>]+>/g, " ");
  return RUBRIC.vocabulary.banned.map(p => plain.match(new RegExp(p, CASED.test(p) ? "" : "i"))).filter(Boolean).map(m => m[0]);
}

/* ── the RFI engine banks, read from source ──────────────────────────────── */
function engineBanks() {
  const ca = readFileSync(join(SYS, "ft-class-automation.js"), "utf8");
  const pr = readFileSync(join(SYS, "ft-progression.js"), "utf8");
  const mj = readFileSync(join(SYS, "module.js"), "utf8");
  // TECHNIQUE_EFFECTS: per id, which helpers the handler calls (bank / impose / temp / note / strain)
  const effBody = ca.match(/export const TECHNIQUE_EFFECTS = \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const effects = {};
  for (const m of effBody.matchAll(/\n  (bbttcc_feat_[a-z_]+):\s*([\s\S]*?)(?=\n  bbttcc_feat_|$)/g)) {
    const b = m[2];
    effects[m[1]] = {
      bank: /_tq\.bank\(/.test(b), impose: /_tq\.impose\(/.test(b), temp: /_tq\.temp\(/.test(b), note: /_tq\.note\(/.test(b),
      strain: /strain\.gain\(/.test(b), clarity: /clarity/.test(b), ally: /_tq\.ally\(/.test(b)
    };
  }
  // ID_REROLL_GRANTS and ITEM_APTITUDE_GRANTS are plain object literals — evaluate them
  const lit = (src, re) => { const m = src.match(re); return m ? new Function(`return {${m[1]}\n}`)() : {}; };
  const rerolls = lit(pr, /export const ID_REROLL_GRANTS = \{([\s\S]*?)\n\};/);
  const aptitudes = lit(pr, /const ITEM_APTITUDE_GRANTS = \{([\s\S]*?)\n\};/);
  const derives = new Set([...mj.matchAll(/"(bbttcc_feat_[a-z_]+)"/g)].map(x => x[1]));
  return { effects, rerolls, aptitudes, derives };
}

/* ── techniques lane ─────────────────────────────────────────────────────── */
const PATHS = { pactkeeper: "Path of the Pactkeeper", bulwark: "Path of the Bulwark", aurablade: "Path of the Aurablade", "harmony marshal": "Path of the Harmony Marshal", "shadow courier": "Path of the Shadow Courier", "wyrdlens adept": "Path of the Wyrdlens Adept", "cosmic linguist": "Path of the Cosmic Linguist", dreamwalker: "Path of the Dreamwalker", "soul-smith": "Path of the Soul-Smith" };

function rerollEffects(rows) {
  // unconditional rows → roll-mode Active Effects; conditional → nothing (text carries it)
  const changes = [];
  for (const r of rows ?? []) {
    if (r.vs || r.when) continue;
    const abl = r.attribute ? ABIL[r.attribute] : null;
    const sk = r.skill ? skillOf(r.skill) : null;
    if (r.context === "initiative") changes.push({ key: "system.attributes.init.roll.mode", mode: 2, value: "1", priority: 20 });
    else if ((r.context === "check") && sk?.kind === "skill") changes.push({ key: `system.skills.${sk.key}.roll.mode`, mode: 2, value: "1", priority: 20 });
    else if ((r.context === "check") && abl) changes.push({ key: `system.abilities.${abl}.check.roll.mode`, mode: 2, value: "1", priority: 20 });
    else if ((r.context === "save" || r.context === "defense") && abl) changes.push({ key: `system.abilities.${abl}.save.roll.mode`, mode: 2, value: "1", priority: 20 });
  }
  return changes;
}

function convertTechnique(d, banks) {
  const s = d.system, ff = d.flags?.fourththing ?? {}, idf = s.identifier ?? "";
  const slug = "feat-" + idf.replace(/^bbttcc_feat_/, "").replace(/_/g, "-");
  const needs = [];
  // prose: tagline + the Rules section, minus the engine note
  const html = s.description?.value ?? "";
  const tagline = html.match(/<h2>[^<]*<\/h2>\s*<p><em>(.*?)<\/em><\/p>/s)?.[1] ?? "";
  let rules = html.match(/<h3>Rules<\/h3>([\s\S]*)/)?.[1] ?? html.replace(/<h2>[^<]*<\/h2>\s*<p><em>.*?<\/em><\/p>\s*(<hr\s*\/?>)?/s, "");
  rules = rules.replace(/<p class="ft-engine-note">[\s\S]*?<\/p>/g, "").replace(/<div[^>]*data-ft-phase5[^>]*><\/div>/g, "").trim();
  // Path-specific techniques: "<strong>Requires:</strong> Pactkeeper" in a styled <p> or <span>, followed by a ⚙ engine line
  let requirements = "";
  const req = rules.match(/<strong>Requires:<\/strong>\s*([^<]+)/);
  if (req) {
    const raw = req[1].trim(); const k = raw.toLowerCase().replace(/-/g, " ");
    requirements = PATHS[k] ?? raw;
    if (!PATHS[k]) needs.push(`requirement "${raw}" has no Path mapping`);
  }
  rules = rules.replace(/<(p|span)[^>]*>\s*<strong>Requires:<\/strong>[^<]*<\/\1>/g, "").replace(/<(p|span)[^>]*>\s*⚙[\s\S]*?<\/\1>/g, "").replace(/⚙[^<]*/g, "").replace(/<p>\s*<\/p>/g, "").trim();
  let text = convertText(rules).replace(/\s+([.,;:])/g, "$1").replace(/\s{2,}/g, " ");
  const description = (tagline ? `<p><em>${convertText(tagline)}</em></p>` : "") + text;
  const plain = text.replace(/<[^>]+>/g, " ");
  // uses and recovery from the converted text
  const entry = { slug, name: d.name, featType: "feat", subtype: "general", level: null, requirements, folder: "Techniques", img: d.img && !d.img.includes("fourththing") ? d.img : "icons/skills/melee/strike-sword-slashing-red.webp", description };
  if (/once per long rest/i.test(plain) || /\b1\/long rest/i.test(plain)) entry.uses = { max: "1", per: "lr" };
  else if (/once per short rest/i.test(plain) || /\b1\/short rest/i.test(plain)) entry.uses = { max: "1", per: "sr" };
  else if (/number of (times|uses) equal to your proficiency bonus[\s\S]*?(long rest)/i.test(plain)) entry.uses = { max: "@prof", per: "lr" };
  else if (/number of (times|uses) equal to your proficiency bonus[\s\S]*?(short rest)/i.test(plain)) entry.uses = { max: "@prof", per: "sr" };
  if (/\b(use|using) your reaction\b|\bas a reaction\b|\breaction —/i.test(plain)) entry.activation = "reaction";
  else if (/\bas a bonus action\b|\bbonus action —/i.test(plain)) entry.activation = "bonus";
  else if (/\bas an action\b|\baction —/i.test(plain)) entry.activation = "action";
  else if (entry.uses) entry.activation = "special";
  // Active Effects from the engine banks + flags
  const changes = [];
  changes.push(...rerollEffects(banks.rerolls[idf]));
  changes.push(...rerollEffects(ff.rerolls));
  for (const r of ff.grants?.resistances ?? []) {
    const t = typeof r === "string" ? r : r.flavor && RUBRIC.damage[r.type]?.to?.[r.flavor] ? RUBRIC.damage[r.type].to[r.flavor] : r.type;
    const to = RUBRIC.damage[t]?.to ?? t;
    for (const x of [].concat(typeof to === "object" && !Array.isArray(to) ? to.default : to)) changes.push({ key: "system.traits.dr.value", mode: 2, value: x, priority: 20 });
  }
  const DND_CI = new Set(["blinded", "charmed", "deafened", "diseased", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"]);
  for (const c of ff.grants?.conditionImmunities ?? []) { const to = String(RUBRIC.conditions[c]?.to ?? c).split(/[ (]/)[0]; if (DND_CI.has(to)) changes.push({ key: "system.traits.ci.value", mode: 2, value: to, priority: 20 }); else needs.push(`condition immunity "${c}" is text only (no dnd5e condition "${to}")`); }
  // aptitude grants → Trait advancements on the feat (a proficiency, or a choice between two)
  const apt = banks.aptitudes[d.name.toLowerCase().replace(/^technique:\s*/i, "").trim()];
  const traitKey = k => { const sk = skillOf(k); return sk?.kind === "skill" ? `skills:${sk.key}` : sk?.kind === "tool" ? `tool:${sk.key}` : null; };
  if (apt) {
    const traits = [];
    for (const [k, v] of Object.entries(apt)) {
      if (k === "choice") { const pool = v.map(traitKey).filter(Boolean); if (pool.length === v.length) traits.push({ tag: "choice", title: "Proficiency", choices: [{ count: 1, pool }] }); else needs.push(`skill choice ${v.join(" / ")} has an unmapped skill`); continue; }
      const tk = traitKey(k);
      if (tk) traits.push({ tag: k, title: "Proficiency", grants: [tk] }); else needs.push(`proficiency "${k}" has no 5E key`);
    }
    if (traits.length) entry.traits = traits;
  }
  // the same change can arrive from ID_REROLL_GRANTS and flags.rerolls — keep one
  const seenChange = new Set(); const uniq = changes.filter(c => { const k = c.key + "=" + c.value; if (seenChange.has(k)) return false; seenChange.add(k); return true; }); changes.length = 0; changes.push(...uniq);
  if (changes.length) entry.effects = [{ _id: "be5e" + sha(slug).slice(0, 12), name: d.name, img: entry.img, transfer: true, disabled: false, changes, duration: {}, flags: {}, origin: null, tint: "#ffffff", statuses: [], description: "" }];
  // riders the sheet can't do yet
  const eff = banks.effects[idf] ?? {};
  const riders = Object.entries(eff).filter(([k, v]) => v && ["bank", "impose", "temp", "strain", "clarity"].includes(k)).map(([k]) => k);
  if (riders.length) needs.push(`engine riders (${riders.join(", ")}) are text only until the table-kit rider pass`);
  if (ff.discipline) needs.push(`Path-discipline mechanic (${JSON.stringify(ff.discipline).slice(0, 80)}) — needs the Paths engine`);
  for (const l of leftovers(description)) needs.push(`leftover term "${l}"`);
  if (/\bClarity\b/.test(plain)) needs.push("mentions Clarity (ruling owed)");
  entry.flags = { "bad-eden-5e": { rfi: { id: d._id, pack: "items", identifier: idf, hash: sha(JSON.stringify({ n: d.name, h: html, f: ff, r: banks.rerolls[idf] ?? null, a: apt ?? null, e: eff })) } } };
  return { entry, needs };
}

function laneTechniques() {
  const banks = engineBanks();
  const src = loadPack("items").filter(d => d.type === "feat" && d.system?.category === "technique" && !d.flags?.fourththing?.rigFrame && !d.flags?.fourththing?.rigGear);
  const out = [], needsAll = [];
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const { entry, needs } = convertTechnique(d, banks);
    out.push(entry);
    if (needs.length) needsAll.push({ slug: entry.slug, name: entry.name, needs });
  }
  return { src, out, needsAll };
}


/* ── gear lane: weapons, armor, gear, equipment, consumables → dnd5e items ── */
const WEAPON_TYPE_HINTS = { bludgeoning: /maul|hammer|blunt|bludgeon|sap|subdual|staff|cudgel|spatula|club|mace|foam/i, slashing: /axe|chop|saber|sword|blade|edge|reaver|scythe/i, piercing: /knife|stab|stylus|bolt|crossbow|rifle|pistol|ballistic|slug|spear|pike|dart|driver/i };
const ENERGY_FLAVOR = { laser: "fire", light: "fire", fire: "fire", thermal: "fire", cold: "cold", ice: "cold", lightning: "lightning", electrical: "lightning", shock: "lightning", resonance: "thunder", sonic: "thunder", quantum: "force", psychic: "psychic" };
function weaponDamageType(s, tags) {
  const t = String(s.damage?.type ?? "kinetic"), fl = String(s.damage?.damageFlavor ?? ""), hay = `${tags.join(" ")} ${fl} ${s.identifier ?? ""}`;
  if (t === "kinetic") { for (const [k, re] of Object.entries(WEAPON_TYPE_HINTS)) if (re.test(hay)) return k; return s.category === "ranged" ? "piercing" : "bludgeoning"; }
  if (t === "energy" || t === "electrical" || t === "thermal") { for (const [k, v] of Object.entries(ENERGY_FLAVOR)) if (hay.toLowerCase().includes(k)) return v; return t === "thermal" ? "fire" : "lightning"; }
  if (t === "chemical") return "acid";
  return t; // poison, psychic, sephirotic, qliphothic
}
const DIE_UP = { 4: 6, 6: 8, 8: 10, 10: 12, 12: 12 };
const rarityFor = (tags, marks, attune) => tags.includes("t1-baseline") ? "" : tags.includes("capstone") || marks >= 2000 ? "legendary" : attune || marks >= 1000 ? "veryRare" : marks >= 300 ? "rare" : marks >= 150 ? "uncommon" : "common";
const rfiPrice = d => Number(d.flags?.fourththing?.rfi?.item?.price?.marks ?? 0) || 0;
const baseItem = (d, type, extra = {}) => ({
  slug: "gear-" + d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),   // by name: RFI identifiers collide (two "laser" weapons)
  name: d.name, type, img: d.img && !/fourththing|bbttcc/.test(d.img) ? d.img : extra.img ?? "icons/svg/item-bag.svg",
  system: { description: { value: "", chat: "" }, identified: true, unidentified: { description: "" }, container: null, quantity: 1, weight: { value: extra.weight ?? 1, units: "lb" }, price: { value: rfiPrice(d), denomination: "gp" }, rarity: "", attunement: "", attuned: false, equipped: false, uses: { max: "", spent: 0, recovery: [] }, properties: [], identifier: d.system?.identifier || undefined },
  effects: [], flags: {}
});
function gearDescription(d, needs = []) {
  const s = d.system ?? {};
  const parts = [];
  // "⚙️ Mechanical Effects …" blocks are RFI engine notes (BloodDebt / FrameDice / Stress ops) — not sheet text in 5E
  const strip = h => String(h ?? "")
    .replace(/<!-- BBTTCC:MECHANICS:START -->[\s\S]*?<!-- BBTTCC:MECHANICS:END -->/g, m => { const t = m.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); needs.push(`RFI engine block dropped: "${t.replace(/^.*?⚙️ Mechanical Effects\s*/, "").slice(0, 110)}"`); return ""; })
    .replace(/(<hr\s*\/?>\s*)?<p>\s*<strong>\s*⚙️?[^<]*Mechanical Effects[\s\S]*?<\/ul>/g, m => { const t = m.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); needs.push(`RFI engine block dropped: "${t.replace(/^.*?Mechanical Effects\s*/, "").slice(0, 110)}"`); return ""; });
  if (s.flavor) parts.push(`<p><em>${s.flavor}</em></p>`);
  const desc = strip(s.description?.value ?? "");
  const effPlain = String(s.effect ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // the effect line is often repeated inside the description — keep it once
  if (s.effect && !(effPlain && desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").includes(effPlain.slice(0, 60)))) parts.push(`<p>${s.effect}</p>`);
  if (desc) parts.push(desc);
  return convertText(parts.join("")).replace(/\s+([.,;:])/g, "$1");
}
function convertWeapon(d, needs) {
  const s = d.system, tags = (s.tags ?? []).map(String);
  const e = baseItem(d, "weapon", { weight: s.category === "ranged" ? 5 : 3, img: "icons/weapons/swords/sword-guard-blue.webp" });
  const m = String(s.damage?.formula ?? "1d6").replace(/\s/g, "").match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  const number = m ? Number(m[1]) : 1, denom = m ? Number(m[2]) : 6, bonus = m?.[3] ? Number(m[3]) : 0;
  if (!m) needs.push(`damage formula "${s.damage?.formula}" not NdM(+K)`);
  const dtype = weaponDamageType(s, tags);
  const attune = tags.includes("attunement") || tags.includes("soulbound");
  const ranged = s.category === "ranged";
  const firearm = /pistol|rifle|ballistic|laser|slug|gun/i.test(tags.join(" ") + " " + d.name);
  const martial = ranged ? (firearm && !tags.includes("pistol") && !tags.includes("sidearm") && !/pistol/i.test(d.name)) : tags.some(t => ["heavy", "two-handed", "reach", "longsword", "maul"].includes(t));
  const props = new Set();
  for (const [t, p] of [["two-handed", "two"], ["light", "lgt"], ["heavy", "hvy"], ["thrown", "thr"], ["versatile", "ver"], ["finesse", "fin"], ["reach", "rch"], ["slow-reload", "lod"]]) if (tags.includes(t)) props.add(p);
  if (firearm) props.add("fir");
  if (ranged && !firearm) props.add("amm");
  if (bonus && !tags.includes("t1-baseline")) props.add("mgc");
  const magical = bonus && !tags.includes("t1-baseline") ? bonus : null;
  if (bonus && !magical) needs.push(`flat +${bonus} dropped (baseline weapon)`);
  const reach = !ranged && (tags.includes("reach") ? 10 : 5);
  if (!ranged && Number(s.range?.short) > 2) needs.push(`melee range ${s.range.short} squares read as reach ${reach} ft`);
  Object.assign(e.system, {
    rarity: rarityFor(tags, rfiPrice(d), attune), attunement: attune ? "required" : "",
    range: ranged ? { value: Number(s.range?.short || 6) * 5, long: Number(s.range?.long || s.range?.short || 6) * 5, units: "ft", reach: null } : { value: null, long: null, units: "ft", reach },
    damage: { base: { number, denomination: denom, types: [dtype], custom: { enabled: false }, scaling: { number: 1 }, bonus: "" },
      versatile: props.has("ver") ? { number, denomination: DIE_UP[denom] ?? denom, types: [dtype], bonus: "", custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } } : { number: null, denomination: null, bonus: "", types: [], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } } },
    armor: { value: null }, hp: { value: null, max: null, dt: null, conditions: "" },
    type: { value: ranged ? (martial ? "martialR" : "simpleR") : (martial ? "martialM" : "simpleM"), baseItem: "" },
    magicalBonus: magical, properties: [...props], proficient: null, ammunition: {}, mastery: "",
    activities: { [sha("act" + e.slug).slice(0, 16).padEnd(16, "0")]: { type: "attack", activation: { type: "action", value: 1, condition: "", override: false }, consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: true }, description: { chatFlavor: "" }, duration: { concentration: false, value: "", units: "inst", special: "", override: false }, effects: [], range: { override: false }, target: { template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "" }, affects: { count: "", type: "", choice: false, special: "" }, prompt: false, override: false }, attack: { ability: "", bonus: "", critical: { threshold: null }, flat: false, type: { value: ranged ? "ranged" : "melee", classification: "weapon" } }, damage: { critical: { bonus: "" }, includeBase: true, parts: [] }, uses: { spent: 0, recovery: [], max: "" }, sort: 0, name: "", img: "", appliedEffects: [] } }
  });
  e.system.description.value = gearDescription(d, needs);
  return e;
}
const SHIELD_RE = /shield|buckler|tower|pavise|targe|aegis/i;
function armorBand(tags, name) {
  if (tags.includes("shield") || (SHIELD_RE.test(name) && !tags.includes("vestment"))) return "shield";
  if (tags.includes("medium")) return "medium";
  if ((tags.includes("heavy") || tags.includes("plate")) && !tags.includes("light")) return "heavy";
  return "light";
}
function resistanceTypes(list) {
  const out = [];
  for (const r of list ?? []) {
    const t = typeof r === "string" ? r : r.flavor && RUBRIC.damage[r.type]?.to?.[r.flavor] ? RUBRIC.damage[r.type].to[r.flavor] : r.type;
    const to = RUBRIC.damage[t]?.to ?? (t === "energy" ? "lightning" : t);
    for (const x of [].concat(typeof to === "object" && !Array.isArray(to) ? to.default : to)) if (typeof x === "string" && /^[a-z]+$/.test(x)) out.push(x);
  }
  return [...new Set(out)];
}
function convertArmor(d, needs, src = null) {
  const s = src ?? d.system, tags = (s.tags ?? d.system?.tags ?? []).map(String);
  const band = armorBand(tags, d.name);
  const g = Number(s.guardBonus) || 0, ev = Number(s.evasionBonus) || 0, re = Number(s.resolveBonus) || 0;
  const attune = tags.includes("attunement") || tags.includes("soulbound");
  const e = baseItem(d, "equipment", { weight: { light: 10, medium: 20, heavy: 40, shield: 6 }[band], img: band === "shield" ? "icons/equipment/shield/heater-steel-worn.webp" : "icons/equipment/chest/breastplate-leather-brown.webp" });
  const ac = band === "shield" ? Math.max(2, g) : { light: 10, medium: 12, heavy: 14 }[band] + g;
  Object.assign(e.system, {
    rarity: rarityFor(tags, rfiPrice(d), attune), attunement: attune ? "required" : "",
    armor: { value: ac, magicalBonus: null, dex: band === "light" || band === "shield" ? null : band === "medium" ? 2 : 0 },
    hp: { value: null, max: null, dt: null, conditions: "" },
    type: { value: band, baseItem: "" }, properties: band === "heavy" ? ["stealthDisadvantage"] : [],
    speed: { value: null, conditions: "" }, strength: band === "heavy" ? (ac >= 17 ? 15 : 13) : null, proficient: null, activities: {}
  });
  const changes = [];
  if (ev) changes.push({ key: "system.abilities.dex.bonuses.save", mode: 2, value: String(ev), priority: 20 });
  if (re) changes.push({ key: "system.abilities.wis.bonuses.save", mode: 2, value: String(re), priority: 20 });
  for (const t of resistanceTypes(s.resistances)) changes.push({ key: "system.traits.dr.value", mode: 2, value: t, priority: 20 });
  if (Math.abs(re) > 2 || Math.abs(ev) > 2) needs.push(`save bonus Evasion ${ev >= 0 ? "+" : ""}${ev} / Resolve ${re >= 0 ? "+" : ""}${re} carried as-is (large for 5E — ruling?)`);
  if (changes.length) e.effects = [{ _id: "be5e" + sha(e.slug).slice(0, 12), name: d.name, img: e.img, transfer: true, disabled: false, changes, duration: {}, flags: {}, origin: null, tint: "#ffffff", statuses: [], description: "" }];
  const extra = (ev || re) ? `<p><strong>Worn:</strong> ${[ev ? `${ev >= 0 ? "+" : ""}${ev} to Dexterity saving throws` : "", re ? `${re >= 0 ? "+" : ""}${re} to Wisdom saving throws` : ""].filter(Boolean).join(", ")}.</p>` : "";
  e.system.description.value = gearDescription(d, needs) + extra;
  return e;
}
function convertGear(d, needs, folder) {
  const s = d.system, tags = (s.tags ?? []).map(String), marks = rfiPrice(d);
  const consumable = s.slot === "consumable" || tags.includes("consumable") || tags.includes("potion") || tags.includes("single-use") || /Consumables/.test(folder);
  const wondrous = /Wondrous/.test(folder) || tags.includes("wondrous") || tags.includes("attunement");
  let e;
  if (consumable) {
    e = baseItem(d, "consumable", { weight: 0.5, img: "icons/consumables/potions/bottle-round-corked-glowing-red.webp" });
    Object.assign(e.system, { type: { value: tags.includes("potion") ? "potion" : "trinket", subtype: "" }, uses: { max: "1", spent: 0, recovery: [], autoDestroy: true }, damage: { base: { number: null, denomination: null, types: [], custom: { enabled: false }, scaling: { number: 1 } }, replace: false }, magicalBonus: null, activities: {}, rarity: rarityFor(tags, marks, false) });
  } else if (wondrous) {
    e = baseItem(d, "equipment", { weight: 1, img: "icons/sundries/misc/lantern-copper-lit.webp" });
    const attune = tags.includes("attunement") || tags.includes("soulbound");
    Object.assign(e.system, { type: { value: "trinket", baseItem: "" }, armor: { value: null, magicalBonus: null, dex: null }, hp: { value: null, max: null, dt: null, conditions: "" }, speed: { value: null, conditions: "" }, strength: null, proficient: null, activities: {}, rarity: rarityFor(tags, marks, attune), attunement: attune ? "required" : "" });
  } else {
    e = baseItem(d, "loot", { weight: 1, img: s.slot === "material" ? "icons/commodities/materials/bowl-powder-grey.webp" : "icons/containers/bags/pack-leather-brown.webp" });
    Object.assign(e.system, { type: { value: s.slot === "material" ? "material" : "gear", subtype: "" }, rarity: "" });
    delete e.system.uses; delete e.system.equipped; delete e.system.attuned; delete e.system.attunement;
  }
  e.system.description.value = gearDescription(d, needs);
  return e;
}
function passthrough(d, needs, folder) {
  // equipment / consumable docs that were already written in dnd5e shape (the June port era)
  const s = JSON.parse(JSON.stringify(d.system));
  if ("guardBonus" in s) return convertArmor(d, needs, s);
  const e = baseItem(d, d.type, { weight: Number(s.weight?.value) || 1 });
  for (const k of ["guardBonus", "evasionBonus", "resolveBonus", "armorSkill", "resistances", "slot", "tags", "crewed", "crew"]) delete s[k];
  e.system = { ...e.system, ...s, description: { value: gearDescription({ ...d, system: { description: s.description } }, needs), chat: "" } };
  const marks = rfiPrice(d); if (marks) e.system.price = { value: marks, denomination: "gp" };
  if (d.type === "equipment" && !e.system.type?.value) e.system.type = { value: /Wondrous/.test(folder) || e.system.rarity ? "trinket" : "clothing", baseItem: "" };
  if (!e.system.rarity && e.system.attunement) e.system.rarity = "rare";
  return e;
}
function laneGear() {
  const all = loadPack("items");
  const byId = new Map(all.map(d => [d._id, d]));
  const folderOf = d => { const p = []; let f = d.folder; while (f && byId.has(f)) { p.unshift(byId.get(f).name); f = byId.get(f).folder; } return p.join("/"); };
  const src = all.filter(d => ["weapon", "armor", "gear", "equipment", "consumable"].includes(d.type) && !d.flags?.fourththing?.rigGear && !d.flags?.fourththing?.rigFrame && !/^Rig & Boss/.test(folderOf(d)));
  const out = [], needsAll = [];
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = [], folder = folderOf(d);
    const e = d.type === "weapon" ? convertWeapon(d, needs) : d.type === "armor" ? convertArmor(d, needs) : d.type === "gear" ? convertGear(d, needs, folder) : passthrough(d, needs, folder);
    e.folder = folder.split("/")[0] || "Gear";
    for (const l of leftovers(e.system.description.value)) needs.push(`leftover term "${l}"`);
    if (!rfiPrice(d) && !e.system.price?.value) needs.push("no price in marks");
    e.flags = { "bad-eden-5e": { rfi: { id: d._id, pack: "items", identifier: d.system?.identifier ?? "", hash: sha(JSON.stringify({ n: d.name, s: d.system, f: d.flags?.fourththing ?? {} })) } } };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "items" };
}


/* ── creatures lane: the live NPC Pack's lineage-flagged monsters → dnd5e npc actors ── */
const CR = { 1: { light: 0.5, medium: 1, heavy: 2, boss: 4 }, 2: { light: 3, medium: 5, heavy: 6, boss: 8 }, 3: { light: 7, medium: 9, heavy: 11, boss: 13 }, 4: { light: 12, medium: 14, heavy: 16, boss: 20 } };
const CHASSIS = { damage: [0, 3, 4, 5], pool: { light: [0.6, 0.6, 0.6, 0.6], medium: [2, 1.5, 1.5, 1.5], heavy: [3, 3, 3, 3], boss: [5, 5, 5, 4] }, strikes: { light: [1, 1, 1, 2], medium: [1, 2, 2, 3], heavy: [2, 2, 3, 3], boss: [2, 3, 3, 3] }, legendary: { light: [0, 0, 0, 0], medium: [0, 0, 0, 0], heavy: [0, 0, 0, 0], boss: [1, 1, 1, 2] } };
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
const acFor = cr => cr < 4 ? 13 : cr < 5 ? 14 : cr < 8 ? 15 : cr < 10 ? 16 : cr < 13 ? 17 : cr < 17 ? 18 : 19;
const LINEAGE_TYPE = { qliphothic: "fiend", sephirotic: "celestial", wild: "beast", "pre-fall": "construct", "hex-touched": "monstrosity", dream: "aberration", revenant: "undead", mortal: "humanoid" };
const DND_TYPES = new Set(["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"]);
const DND_CI = new Set(["blinded", "charmed", "deafened", "diseased", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"]);
const INTENT_SAVE = { violence: "str", intrigue: "dex", body: "con", mind: "int", soul: "wis", presence: "cha" };
function dmgTypes(list) {
  const out = [];
  for (const r of list ?? []) {
    const t = typeof r === "string" ? r : r.type, fl = typeof r === "string" ? "" : (r.flavor ?? "");
    if (t === "physical" || t === "kinetic") { out.push("bludgeoning", "piercing", "slashing"); continue; }
    const m = RUBRIC.damage[t]?.to;
    if (!m) { if (/^[a-z]+$/.test(t)) out.push(t); continue; }
    if (typeof m === "object" && !Array.isArray(m)) out.push(...[].concat(m[fl] ?? m.default));
    else out.push(...[].concat(m).filter(x => typeof x === "string" && /^[a-z]+$/.test(x)));
  }
  return [...new Set(out)];
}
function autoRulesText(na) {
  // npcAuto rules → a readable line each (the rubric's effect table); the rider automation is a later pass
  const lines = [];
  for (const r of na?.rules ?? []) {
    const on = { hit: "When it hits with an attack", use: "When it uses this", saveFail: "When a target fails its save", turnStart: "At the start of each turn", selfTurnStart: "At the start of its turn", attack: "When it attacks", bloodied: "When it is bloodied", struck: "When it is hit", zero: "When it drops to 0 hit points", attacked: "When it is attacked", allyDamaged: "When an ally takes damage", damaged: "When it takes damage" }[r.on] ?? `On ${r.on}`;
    const d = r.do ?? {}, bits = [];
    if (d.damage) bits.push(`deal ${typeof d.damage === "object" ? `${d.damage.formula ?? d.damage.amount ?? ""} ${dmgTypes([d.damage.type ?? "kinetic"]).join("/")}`.trim() : d.damage} damage`);
    if (d.heal) bits.push(`regain ${typeof d.heal === "object" ? d.heal.formula ?? d.heal.amount : d.heal} hit points`);
    if (d.tempIntegrity) bits.push(`gain ${d.tempIntegrity} temporary hit points`);
    if (d.condition) bits.push(`the target is ${[].concat(d.condition).map(c => RUBRIC.conditions[c]?.to?.split(/[ (]/)[0] ?? c).join(", ")}`);
    if (d.reroll) bits.push(typeof d.reroll === "object" && d.reroll.mode === "reroll-highest" ? "the roll is at disadvantage" : "the roll is at advantage");
    if (d.save) bits.push(`the target makes a ${ABIL_NAME[INTENT_SAVE[d.save.ability] ?? d.save.ability] ?? "Wisdom"} saving throw`);
    if (d.noReactions) bits.push("the target can't take reactions until the start of its next turn");
    if (d.dot) bits.push(`the target takes ${typeof d.dot === "object" ? d.dot.formula ?? d.dot.amount : d.dot} damage at the start of each of its turns`);
    if (d.radiation) bits.push("the target takes one step up the radiation ladder");
    if (d.morale) bits.push("a morale check");
    if (d.ward) bits.push("it is warded");
    if (d.prompt) bits.push(convertText(String(d.prompt)).replace(/<[^>]+>/g, ""));
    const lim = r.limit ? ` (${r.limit.uses ?? 1}/${{ combat: "encounter", scene: "short rest", round: "round", "soma-break": "long rest" }[r.limit.per] ?? r.limit.per})` : "";
    if (bits.length) lines.push(`<p><strong>${on}${lim}:</strong> ${bits.join("; ")}.</p>`);
  }
  return lines.join("");
}
function monsterFeature(it, needs, actorSlug, dc = 12) {
  const s = it.system ?? {}, na = it.flags?.fourththing?.npcAuto;
  const e = { slug: it.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: it.name, type: "feat", img: it.img && !/fourththing|bbttcc/.test(it.img) ? it.img : "icons/svg/aura.svg", system: {}, effects: [], flags: {} };
  const text = convertText([s.effect ? `<p>${s.effect}</p>` : "", s.description?.value ?? ""].join("")).replace(/<!-- BBTTCC[\s\S]*?-->/g, "");
  const auto = autoRulesText(na);
  const uses = {};
  const lim = (na?.rules ?? []).find(r => r.limit)?.limit;
  if (lim) { uses.max = String(lim.uses ?? 1); uses.recovery = [{ period: lim.per === "round" ? "round" : lim.per === "soma-break" ? "lr" : "sr", type: "recoverAll" }]; }
  if (/recharges? on a (Soma Break|long rest)/i.test(it.name + text)) { uses.max = "1"; uses.recovery = [{ period: "lr", type: "recoverAll" }]; }
  e.name = it.name.replace(/\s*\(recharges on a Soma Break\)/i, " (1/Long Rest)");
  e.system = { description: { value: text + auto, chat: "" }, type: { value: "monster", subtype: "" }, uses: { max: uses.max ?? "", spent: 0, recovery: uses.recovery ?? [] }, requirements: "", prerequisites: { level: null, repeatable: false }, properties: [], activities: {}, enchant: {}, identifier: e.slug };
  if (it.type === "power") {
    const dm = String(s.damage ?? "").replace(/\s/g, "").match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
    const ability = INTENT_SAVE[s.intent] ?? "wis";
    const aid = sha("act" + actorSlug + e.slug).slice(0, 16).padEnd(16, "0");
    const types = dmgTypes([s.damageType ?? s.damageRoll?.type ?? "psychic"]);
    const self = s.target === "self" || s.range === "self";
    e.system.activities[aid] = { _id: aid, type: dm && !self ? "save" : "utility", name: "", img: "", sort: 0,
      activation: { type: s.activation === "bonus" ? "bonus" : s.activation === "reaction" ? "reaction" : "action", value: null, condition: "", override: false },
      consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: false }, description: { chatFlavor: "" },
      duration: { concentration: false, value: "", units: "inst", special: "", override: false }, effects: [],
      range: { value: self ? "" : "60", units: self ? "self" : "ft", special: "", override: false },
      target: { template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "" }, affects: { count: self ? "" : "1", type: self ? "self" : "creature", choice: false, special: "" }, prompt: true, override: false },
      uses: { spent: 0, recovery: [] }, appliedEffects: [],
      ...(dm && !self ? { save: { ability: [ability === "str" || ability === "con" ? "con" : ability === "dex" ? "dex" : "wis"], dc: { calculation: "", formula: String(dc) } }, damage: { onSave: "half", critical: { allow: false, bonus: "" }, parts: [{ custom: { enabled: false, formula: "" }, number: Number(dm[1]), denomination: Number(dm[2]), bonus: dm[3] ?? "", types, scaling: { mode: "", number: 1 } }] } } : { roll: { formula: "", name: "", prompt: false, visible: false } }) };
    e.img = "icons/magic/unholy/orb-glowing-purple.webp";
  }
  if (na?.rules?.length) needs.push(`"${it.name}": ${na.rules.length} automation rule(s) rendered as text (rider pass later)`);
  return e;
}
function convertMonster(a, items, needs) {
  const s = a.system ?? {}, ff = a.flags?.fourththing ?? {}, rfi = ff.rfi?.actor ?? {};
  const tier = Math.max(1, Math.min(4, ROMAN[rfi.tier] || Number(rfi.tier) || Number(s.details?.tier) || 1));
  const bracketRaw = String(rfi.bracket || "medium").toLowerCase();
  const bracket = CHASSIS.pool[bracketRaw] ? bracketRaw : ({ elite: "heavy", minion: "light", standard: "medium" }[bracketRaw] ?? "medium");
  const cr = CR[tier][bracket], t = tier - 1;
  const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const abil = {}; for (const [k, v] of Object.entries(ABIL)) abil[v] = Math.min(30, 10 + 2 * (Number(s.attributes?.[k]?.value) || 1));
  const d = s.derived ?? {};
  const hp = Math.max(5, Math.round((Number(d.integrity?.max) || 10) * CHASSIS.pool[bracket][t]));
  const ac = acFor(cr);
  const creatureTypeRaw = [].concat(ff.creatureType ?? [])[0];
  const type = /dragon|wyrm/i.test(a.name) ? "dragon" : DND_TYPES.has(String(creatureTypeRaw)) ? creatureTypeRaw : (LINEAGE_TYPE[rfi.lineage] ?? "monstrosity");
  const themes = (rfi.bestiary?.themes ?? []).map(String); const name = a.name;
  const size = themes.includes("dragon") || /dragon|apex|colossus/i.test(name) ? "huge" : /patriarch|berserker|construct|tree|elemental|serpent|mother|warlord|wendigo/i.test(name) && bracket !== "light" ? "lg" : /tick|hound|stray|skitter|kiddo|hawk/i.test(name) && bracket === "light" ? "sm" : "med";
  if (size !== "med") needs.push(`size guessed ${size} from the name — check`);
  const dark = ["qliphothic", "dream", "revenant", "pre-fall", "hex-touched"].includes(rfi.lineage) || type !== "humanoid" ? 60 : 0;
  const prof = Math.max(2, Math.ceil(cr / 4) + 1);
  const abilities = {}; for (const k of Object.keys(ABIL_NAME)) abilities[k] = { value: abil[k], proficient: 0, bonuses: { check: "", save: "" }, max: null };
  if (Number(d.evasion?.value) >= 14) abilities.dex.proficient = 1;
  if (Number(d.resolve?.value) >= 14) abilities.wis.proficient = 1;
  if ((Number(s.attributes?.body?.value) || 0) >= 4) abilities.con.proficient = 1;
  if ((Number(s.attributes?.violence?.value) || 0) >= 4) abilities.str.proficient = 1;
  const skills = {};
  for (const [k, v] of Object.entries(s.skills ?? {})) { const n = Number(v?.value) || 0; const sk = skillOf(k); if (n >= 1 && sk?.kind === "skill") skills[sk.key] = { value: n >= 2 ? 2 : 1, ability: "", bonuses: { check: "", passive: "" }, roll: { min: null, max: null, mode: 0 } }; }
  const dr = dmgTypes(s.defenses?.resistances), di = dmgTypes(s.defenses?.immunities), dv = dmgTypes(s.defenses?.vulnerabilities);
  const ci = (s.conditionImmunities ?? []).map(c => String(RUBRIC.conditions[c]?.to ?? c).split(/[ (]/)[0]).filter(c => DND_CI.has(c));
  const strikes = CHASSIS.strikes[bracket][t], legendary = CHASSIS.legendary[bracket][t];
  // embedded items
  const out = [];
  const weapons = items.filter(i => i.type === "weapon");
  for (const w of weapons) {
    const needsW = [];
    const e = convertWeapon({ ...w, flags: w.flags ?? {} }, needsW);
    e.slug = e.slug.replace(/^gear-/, "");
    e.system.proficient = 1; e.system.price = { value: 0, denomination: "gp" };
    const bonus = CHASSIS.damage[t]; if (bonus) e.system.damage.base.bonus = String(bonus);
    const tags = (w.system?.tags ?? []).map(String);
    if (tags.includes("aoe") || tags.some(x => x.startsWith("shape-"))) {
      // an area weapon: a save activity with a template instead of an attack
      const act = Object.values(e.system.activities)[0]; const shape = (tags.find(x => x.startsWith("shape-")) ?? "shape-cone").replace("shape-", "");
      const sizeFt = Number(w.system?.range?.short || 3) * 5;
      act.type = "save"; delete act.attack;
      const ability = w.system?.damage?.track === "stress" || w.system?.damage?.type === "psychic" ? "wis" : "dex";
      act.save = { ability: [ability], dc: { calculation: "", formula: String(8 + prof + Math.floor((abil[INTENT_SAVE[w.system?.damage?.attribute] ?? "cha"] - 10) / 2)) } };
      act.damage = { onSave: "half", critical: { allow: false, bonus: "" }, parts: [{ custom: { enabled: false, formula: "" }, number: e.system.damage.base.number, denomination: e.system.damage.base.denomination, bonus: "", types: e.system.damage.base.types, scaling: { mode: "", number: 1 } }] };
      act.target = { template: { count: "", contiguous: false, type: { cone: "cone", sphere: "sphere", line: "line", burst: "radius" }[shape] ?? "cone", size: String(sizeFt), width: shape === "line" ? "5" : "", height: "", units: "ft" }, affects: { count: "", type: "", choice: false, special: "" }, prompt: true, override: false };
      act.range = { value: "", units: "self", special: "", override: false };
      e.system.damage.base = { number: null, denomination: null, types: [], custom: { enabled: false }, scaling: { number: 1 }, bonus: "" };
    }
    out.push(e); for (const n of needsW) needs.push(`weapon "${w.name}": ${n}`);
  }
  const mental = Math.max(abil.int, abil.wis, abil.cha); const dc = 8 + prof + Math.floor((mental - 10) / 2);
  for (const f of items.filter(i => ["feat", "feature", "power"].includes(i.type))) out.push(monsterFeature(f, needs, slug, dc));
  for (const g of items.filter(i => ["armor", "gear"].includes(i.type))) { const n = []; const e = g.type === "armor" ? convertArmor(g, n) : convertGear(g, n, ""); e.slug = e.slug.replace(/^gear-/, ""); out.push(e); }
  if (strikes > 1) out.unshift({ slug: "multiattack", name: "Multiattack", type: "feat", img: "icons/skills/melee/strike-sword-slashing-red.webp", system: { description: { value: `<p>It makes ${strikes} attacks.</p>` }, type: { value: "monster", subtype: "" }, uses: { max: "", spent: 0, recovery: [] }, requirements: "", prerequisites: { level: null, repeatable: false }, properties: [], activities: {}, enchant: {}, identifier: "multiattack" }, effects: [], flags: {} });
  if (legendary) out.push({ slug: "legendary-actions", name: "Legendary Actions", type: "feat", img: "icons/magic/light/explosion-star-glow-silhouette.webp", system: { description: { value: `<p>It can take ${legendary} legendary action${legendary > 1 ? "s" : ""}, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. It regains spent legendary actions at the start of its turn.</p><ul>${weapons.slice(0, 2).map(w => `<li><strong>${w.name}.</strong> It makes one ${w.name} attack.</li>`).join("")}<li><strong>Move.</strong> It moves up to its speed without provoking opportunity attacks.</li></ul>` }, type: { value: "monster", subtype: "" }, uses: { max: "", spent: 0, recovery: [] }, requirements: "", prerequisites: { level: null, repeatable: false }, properties: [], activities: {}, enchant: {}, identifier: "legendary-actions" }, effects: [], flags: {} });
  // the sheet text: concept + notes + bestiary line
  const bio = [s.biography?.concept ? `<p><em>${s.biography.concept}</em></p>` : "", s.notes ? `<p>${s.notes}</p>` : "", s.biography?.notes ? `<p>${s.biography.notes}</p>` : "",
    `<p><strong>Lineage:</strong> ${rfi.lineage}${rfi.subLineage ? ` (${rfi.subLineage})` : ""} · <strong>Tier ${rfi.tier ?? tier}</strong>, ${bracket}${rfi.bestiary?.role ? ` · ${rfi.bestiary.role}` : ""}${rfi.price?.bounty != null ? ` · bounty ${rfi.price.bounty} marks${rfi.price.hire != null ? `, hire ${rfi.price.hire}` : ""}` : ""}</p>`].join("");
  const actor = {
    slug, name, type: "npc", img: a.img, folder: rfi.lineage ? rfi.lineage.replace(/\b\w/g, c => c.toUpperCase()) : "Monsters",
    prototypeToken: { name, displayName: 30, actorLink: false, width: size === "huge" ? 3 : size === "lg" ? 2 : 1, height: size === "huge" ? 3 : size === "lg" ? 2 : 1, texture: { src: a.prototypeToken?.texture?.src ?? a.img }, disposition: -1, displayBars: 20, bar1: { attribute: "attributes.hp" } },
    system: {
      abilities, skills,
      attributes: { ac: { flat: ac, calc: "flat", formula: "" }, hp: { value: hp, max: hp, temp: 0, tempmax: 0, formula: "" }, init: { ability: "", bonus: "", roll: { min: null, max: null, mode: 0 } },
        movement: { burrow: 0, climb: /serpent|skitter|swarm|hound|tick|stray|lurker/i.test(name) ? 30 : 0, fly: /hawk|wraith|avatar|dragon/i.test(name) ? 60 : 0, swim: /bog|marsh|reed|salt/i.test(name) ? 30 : 0, walk: 30, units: "ft", hover: /wraith|avatar/i.test(name) },
        attunement: { max: 3 }, senses: { darkvision: dark, blindsight: 0, tremorsense: 0, truesight: 0, units: "ft", special: "" }, spellcasting: "", exhaustion: 0, concentration: { ability: "", roll: { min: null, max: null, mode: 0 }, bonuses: { save: "" }, limit: 1 }, hd: { spent: 0 }, death: { ability: "", roll: { min: null, max: null, mode: 0 }, success: 0, failure: 0 } },
      details: { biography: { value: convertText(bio), public: "" }, alignment: "", race: null, type: { value: type, subtype: rfi.subLineage ?? "", swarm: /swarm/i.test(name) ? "med" : "", custom: "" }, environment: "", cr, spellLevel: 0, ideal: "", bond: "", flaw: "" },
      traits: { size, di: { value: di, bypasses: [], custom: "" }, dr: { value: dr, bypasses: [], custom: "" }, dv: { value: dv, bypasses: [], custom: "" }, ci: { value: ci, custom: "" }, languages: { value: [], custom: "" }, dm: { amount: {}, bypasses: [] } },
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, bonuses: { mwak: { attack: "", damage: "" }, rwak: { attack: "", damage: "" }, msak: { attack: "", damage: "" }, rsak: { attack: "", damage: "" }, abilities: { check: "", save: "", skill: "" }, spell: { dc: "" } },
      resources: { legact: { value: legendary, max: legendary }, legres: { value: 0, max: 0 }, lair: { value: false, initiative: null } }
    },
    items: out, effects: [],
    flags: { fourththing: { rfi: { actor: rfi }, creatureType: type, kind: "monster" } }
  };
  return actor;
}
function laneCreatures() {
  const file = join(ROOT, "conversion", "sources", "npcs-monsters.jsonl");
  const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  const actors = rows.filter(r => r.k.startsWith("!actors!")).map(r => r.v).filter(a => a.flags?.fourththing?.rfi?.actor?.lineage);
  const itemsOf = id => rows.filter(r => r.k.startsWith(`!actors.items!${id}.`)).map(r => r.v);
  const out = [], needsAll = [];
  for (const a of actors.sort((x, y) => x.name.localeCompare(y.name))) {
    const needs = [], items = itemsOf(a._id);
    const e = convertMonster(a, items, needs);
    for (const it of e.items) for (const l of leftovers(it.system?.description?.value ?? "")) needs.push(`"${it.name}": leftover term "${l}"`);
    for (const l of leftovers(e.system.details.biography.value)) needs.push(`biography: leftover term "${l}"`);
    e.flags["bad-eden-5e"] = { rfi: { id: a._id, pack: "npcs", identifier: a.name, hash: sha(JSON.stringify({ n: a.name, s: a.system, f: a.flags?.fourththing ?? {}, i: items.map(i => [i.name, i.system, i.flags?.fourththing ?? {}]) })) } };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src: actors, out, needsAll, kind: "actors" };
}

/* ── overrides + output ──────────────────────────────────────────────────── */
const deepMerge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? deepMerge(a[k], v) : v; return a; };

function writeLane(name, features, needsAll, about, kind = "features") {
  const ovPath = join(ROOT, "content", "overrides", `${name}.json`);
  const overrides = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, "utf8")) : {};
  let applied = 0;
  for (const f of features) if (overrides[f.slug]) { deepMerge(f, overrides[f.slug]); applied++; }
  const doc = { _about: about, _generated: { by: "tools/convert-5e.mjs", rubric: RUBRIC.version, at: new Date().toISOString().slice(0, 10), overridesApplied: applied }, [kind]: features };
  const outPath = join(ROOT, "content", `${name}.json`);
  writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
  mkdirSync(join(ROOT, "content", "_needs-human"), { recursive: true });
  const md = [`# ${name}: needs a human (${needsAll.length} of ${features.length})`, "", `Generated by tools/convert-5e.mjs with rubric v${RUBRIC.version}. Fix by editing content/overrides/${name}.json (keyed by slug), never the generated file.`, ""];
  for (const n of needsAll) { md.push(`## ${n.name} (\`${n.slug}\`)`); for (const x of n.needs) md.push(`- ${x}`); md.push(""); }
  writeFileSync(join(ROOT, "content", "_needs-human", `${name}.md`), md.join("\n"));
  return { outPath, applied };
}

function parity(name, src, features, kind = "features") {
  const outPath = join(ROOT, "content", `${name}.json`);
  if (!existsSync(outPath)) { console.log(`parity ${name}: no content/${name}.json yet — ${src.length} missing`); return; }
  const have = JSON.parse(readFileSync(outPath, "utf8"))[kind] ?? [];
  const byId = new Map(have.map(f => [f.flags?.["bad-eden-5e"]?.rfi?.id, f]));
  const missing = [], stale = [];
  for (const f of features) {
    const twin = byId.get(f.flags["bad-eden-5e"].rfi.id);
    if (!twin) missing.push(f.name);
    else if (twin.flags["bad-eden-5e"].rfi.hash !== f.flags["bad-eden-5e"].rfi.hash) stale.push(f.name);
  }
  const srcIds = new Set(features.map(f => f.flags["bad-eden-5e"].rfi.id));
  const orphaned = have.filter(f => f.flags?.["bad-eden-5e"]?.rfi && !srcIds.has(f.flags["bad-eden-5e"].rfi.id)).map(f => f.name);
  console.log(`parity ${name}: ${missing.length} missing · ${stale.length} stale · ${orphaned.length} orphaned (of ${features.length} RFI docs)`);
  for (const [k, v] of Object.entries({ missing, stale, orphaned })) if (v.length) console.log(`  ${k}: ${v.join(", ")}`);
  if (missing.length || stale.length || orphaned.length) process.exitCode = 1;
}

/* ── main ────────────────────────────────────────────────────────────────── */
const LANES = { techniques: laneTechniques, gear: laneGear, creatures: laneCreatures };
if (!lane || !LANES[lane]) { console.error(`usage: convert-5e.mjs <${Object.keys(LANES).join("|")}> [--write] [--parity]`); process.exit(2); }
const { src, out, needsAll, kind = "features" } = LANES[lane]();
if (flag("--parity")) { parity(lane, src, out, kind); }
else if (flag("--write")) {
  const ABOUT = { techniques: "The 75 Bad Eden Core techniques as dnd5e feats.", gear: "Bad Eden weapons, armor, gear, wondrous items and consumables as dnd5e items (prices in marks).", creatures: "The Bad Eden bestiary (the live NPC Pack's lineage-flagged monsters) as dnd5e npc actors, scored by tier and bracket through the threat chassis." };
  const { outPath, applied } = writeLane(lane, out, needsAll, `GENERATED from RFI canon by tools/convert-5e.mjs (rubric v${RUBRIC.version}) — do not hand-edit; put fixes in content/overrides/${lane}.json. ${ABOUT[lane] ?? ""}`, kind);
  console.log(`${lane}: ${out.length} converted → ${outPath} (${applied} override(s) applied); ${needsAll.length} need a human → content/_needs-human/${lane}.md`);
} else {
  console.log(`${lane}: ${out.length} would convert; ${needsAll.length} need a human:`);
  for (const n of needsAll) console.log(`  ${n.name}: ${n.needs.join(" · ")}`);
}
