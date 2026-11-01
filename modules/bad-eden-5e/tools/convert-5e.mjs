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
// the shared rig tables (bbttcc-core, pure ESM): AC / damage threshold by bracket and the tiered AC the in-world builder mints
import { RIG_DT_BY_BRACKET, rigAcFor } from "../../bbttcc-core/scripts/economy.constants.js";

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
const SKILL_NAME = { pil: "Piloting", ath: "Athletics", ste: "Stealth", inv: "Investigation", per: "Persuasion", itm: "Intimidation", ins: "Insight", his: "History", arc: "Arcana", rel: "Religion", prc: "Perception", prf: "Performance" };
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
      if (rep.includes("@ABILITY")) return fix(rep.replace("@ABILITY", ABIL_NAME[ABIL[m[1].toLowerCase()]] ?? m[1]).replace(/\\(\d)/g, (_, i) => m[Number(i)]));
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
  let description = (tagline ? `<p><em>${convertText(tagline)}</em></p>` : "") + text;
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
  // Path-discipline shifts: passives ride the feat's own effect; a mode's grants become a second,
  // disabled effect the player toggles while the stance is held (scripts/disciplines.js auto-flips
  // the ones that exist as surge-powers buffs).
  const modeEffects = [];
  if (ff.discipline?.passive) changes.push(...disciplineChanges(ff.discipline.passive, needs));
  if (ff.discipline?.mode?.key) {
    const key = ff.discipline.mode.key, stance = MODE_NAMES[key] ?? key;
    const mc = disciplineChanges(ff.discipline.mode.grants, needs);
    if (mc.length) modeEffects.push({ _id: "be5e" + sha(slug + ":mode").slice(0, 12), name: `${d.name} — ${stance} held`, img: entry.img, transfer: true, disabled: true, changes: mc, duration: {}, flags: { "bad-eden-5e": { mode: key } }, origin: null, tint: "#ffffff", statuses: [], description: `<p>On while ${stance} is active.</p>` });
    if (!MODE_NAMES[key]) needs.push(`mode "${key}" has no stance name`);
  }
  const clarityTwin = TECHNIQUE_CLARITY[idf.replace(/^bbttcc_feat_/, "")];
  if (clarityTwin) changes.push(...clarityTwin.changes);
  // the same change can arrive from ID_REROLL_GRANTS and flags.rerolls — keep one
  const seenChange = new Set(); const uniq = changes.filter(c => { const k = c.key + "=" + c.value; if (seenChange.has(k)) return false; seenChange.add(k); return true; }); changes.length = 0; changes.push(...uniq);
  if (changes.length || modeEffects.length) entry.effects = [
    ...(changes.length ? [{ _id: "be5e" + sha(slug).slice(0, 12), name: d.name, img: entry.img, transfer: true, disabled: false, changes, duration: {}, flags: {}, origin: null, tint: "#ffffff", statuses: [], description: "" }] : []),
    ...modeEffects
  ];
  if (modeEffects.length) {
    const key = ff.discipline.mode.key, stance = MODE_NAMES[key] ?? key;
    entry.description += `<p><em>5E: the effect "${d.name} — ${stance} held" is off by default; ${AUTO_MODES.has(key) ? `it switches on with the ${stance} Surge buff and off when it ends` : `switch it on while you hold ${stance}`}.</em></p>`;
  }
  // engine riders → the Bad Eden 5E rider engine (scripts/riders.js) reads flags.bad-eden-5e.riders
  // when the feature's activity is used: bank = banked advantage on the receiver's next d20,
  // impose = the target's next attack or save at disadvantage, strain = exhaustion, temp = a
  // native heal activity for temporary hit points.
  const eff = banks.effects[idf] ?? {};
  const rider = TECHNIQUE_RIDERS[idf.replace(/^bbttcc_feat_/, "")];
  if (rider) {
    entry.riders = rider.riders;
    entry.activation ??= "special";
    if (rider.heal) { entry.activity = "heal"; entry.heal = rider.heal; }
    if (rider.target) { entry.range = 30; entry.target = rider.target; }
    entry.flags = { "bad-eden-5e": { riders: rider.riders } };
  } else {
    const riders = Object.entries(eff).filter(([k, v]) => v && ["bank", "impose", "temp", "strain"].includes(k)).map(([k]) => k);
    if (riders.length) needs.push(`engine riders (${riders.join(", ")}) have no entry in TECHNIQUE_RIDERS`);
  }
  entry.description = description;
  if (eff.clarity && !rider?.riders?.restore && !clarityTwin) needs.push("Clarity rider — text only (rubric: Clarity ≙ points)");
  for (const l of leftovers(description)) needs.push(`leftover term "${l}"`);
  if (/\bClarity\b/.test(plain) && !clarityTwin && !rider && !ff.discipline) needs.push("mentions Clarity — text only (rubric: Clarity ≙ points)");
  entry.flags = { "bad-eden-5e": { ...(entry.flags?.["bad-eden-5e"] ?? {}), rfi: { id: d._id, pack: "items", identifier: idf, hash: sha(JSON.stringify({ n: d.name, h: html, f: ff, r: banks.rerolls[idf] ?? null, a: apt ?? null, e: eff })) } } };
  return { entry, needs };
}

// The RFI technique handlers (systems/fourththing/ft-class-automation.js TECHNIQUE_EFFECTS)
// re-expressed as rider declarations. `to`: self | ally (the first targeted creature that
// isn't the user) | target (every targeted creature). Amounts follow the rubric: the RFI
// rank bonus becomes the proficiency bonus.
const TECHNIQUE_RIDERS = {
  calculated_risk:        { riders: { bank: { n: 1, to: "self" } } },
  deliberate_tempo:       { riders: { bank: { n: 1, to: "self" } } },
  iron_will:              { riders: { bank: { n: 1, to: "self" } } },
  unyielding_finish:      { riders: { bank: { n: 1, to: "self" } } },
  pressure_transference:  { riders: { bank: { n: 1, to: "ally" } }, target: { count: 1, type: "ally" } },
  combat_logistics:       { riders: { temp: { formula: "@prof", to: "ally-or-self" } }, heal: { formula: "@prof", type: "temphp" }, target: { count: 1, type: "ally" } },
  last_ritual:            { riders: { temp: { formula: "@prof", to: "ally" } }, heal: { formula: "@prof", type: "temphp" }, target: { count: 1, type: "ally" } },
  relentless_advance:     { riders: { temp: { formula: "@prof", to: "self" } }, heal: { formula: "@prof", type: "temphp" } },
  controlled_aggression:  { riders: { impose: { note: "You deal minimum damage on this hit." } }, target: { count: 1, type: "enemy" } },
  disciplined_fire:       { riders: { impose: { note: "Disrupt — or Pin: the target's speed is reduced by 10 feet until the start of your next turn." } }, target: { count: 1, type: "enemy" } },
  linebreaker:            { riders: { impose: { note: "Reaction attacks it makes until the end of its next turn are at disadvantage." } }, target: { count: 1, type: "enemy" } },
  threatening_silence:    { riders: { impose: { note: "Applies to its next attack against a target other than you." } }, target: { count: 1, type: "enemy" } },
  unbroken_guard:         { riders: { impose: { note: "Its speed is 0 until the end of its current turn." } }, target: { count: 1, type: "enemy" } },
  unsettling_precision:   { riders: { impose: { note: "Applies to its next saving throw before the end of its next turn." } }, target: { count: 1, type: "enemy" } },
  darkness_hardened:      { riders: { strain: { n: 1 } } },
  // Reclamation: once per short rest, a level of exhaustion buys points back (the RFI "1 Stress
  // for 2 Clarity" on the pool's 5-point grain — see rubric conditions.scarred).
  reclamation:            { riders: { strain: { n: 1 }, restore: { per5: 2, min: 2 } } }
};

// The RFI manifestation-discipline shifts (systems/fourththing/manifestation-discipline.js) as
// dnd5e Active Effect changes — rubric `engine.discipline.*` (proposed 2026-10-07).
//   clarityMaxBonus n → points bonus on every tradition the actor casts
//   concurrencyBonus n → one more concentration (dnd5e's concentration limit)
//   upkeepScale ≤ .5 → advantage on concentration saves; < 1 → +2 on them
//   reachDiscount n → each upcast step costs n less (never below the base cost)
//   misfireBandShift → text (5E casting has no misfire table)
const DISCIPLINE_CHANGES = {
  clarityMaxBonus:  n => [{ key: "flags.bad-eden-5e.bonus.points", mode: 2, value: String(n), priority: 20 }],
  concurrencyBonus: n => [{ key: "system.attributes.concentration.limit", mode: 2, value: String(n), priority: 20 }],
  upkeepScale:      x => Number(x) <= 0.5 ? [{ key: "system.attributes.concentration.roll.mode", mode: 2, value: "1", priority: 20 }]
                        : Number(x) < 1 ? [{ key: "system.attributes.concentration.bonuses.save", mode: 2, value: "2", priority: 20 }] : [],
  reachDiscount:    n => [{ key: "flags.bad-eden-5e.discount.upcast", mode: 2, value: String(n), priority: 20 }],
  misfireBandShift: () => []
};
const MODE_NAMES = { clSentence: "the Sentence", wlRefraction: "Refraction", dwWalkingLane: "the Walking Lane", pkSealedPact: "Sealed Pact" };
const AUTO_MODES = new Set(["pkSealedPact"]);   // stances that exist as surge-powers buffs → auto-toggled
function disciplineChanges(grants, needs) {
  const out = [];
  for (const [k, v] of Object.entries(grants ?? {})) {
    const f = DISCIPLINE_CHANGES[k];
    if (!f) { needs.push(`discipline grant "${k}" has no 5E mapping`); continue; }
    if (k === "misfireBandShift") needs.push("misfire band shift is text only — 5E casting has no misfire table");
    out.push(...f(v));
  }
  return out;
}

// Clarity techniques (rubric conditions.clarity: Clarity ≙ points) with an engine twin.
const TECHNIQUE_CLARITY = {
  enduring_focus: { changes: [{ key: "system.attributes.concentration.roll.mode", mode: 2, value: "1", priority: 20 }] },
  frugal_caster:  { changes: [{ key: "flags.bad-eden-5e.discount.level1", mode: 2, value: "1", priority: 20 }] }
};

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
// Geburah spelling ruling (2026-10-26): the RFI names/keys moved gevurah → geburah, but build-packs derives each 5E
// _id from the slug — so the slug keeps the old spelling and the bad-eden-5e twins keep their uuids. Slug only; the
// name, identifier and text all read Geburah.
const LEGACY_SLUG = s => s.replace(/^gear-wardstone-of-geburah$/, "gear-wardstone-of-gevurah").replace(/^spark-geburah-/, "spark-gevurah-");
const DIE_UP = { 4: 6, 6: 8, 8: 10, 10: 12, 12: 12 };
const rarityFor = (tags, marks, attune) => tags.includes("t1-baseline") ? "" : tags.includes("capstone") || marks >= 2000 ? "legendary" : attune || marks >= 1000 ? "veryRare" : marks >= 300 ? "rare" : marks >= 150 ? "uncommon" : "common";
const rfiPrice = d => Number(d.flags?.fourththing?.rfi?.item?.price?.marks ?? 0) || 0;
const baseItem = (d, type, extra = {}) => ({
  slug: LEGACY_SLUG("gear-" + d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),   // by name: RFI identifiers collide (two "laser" weapons)
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
  const plainOf = h => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  let desc = strip(s.description?.value ?? "");
  const descPlain = plainOf(desc);
  // the flavour line is often the description's own <em> line — keep it once
  if (s.flavor && !descPlain.includes(plainOf(s.flavor).slice(0, 60))) parts.push(`<p><em>${s.flavor}</em></p>`);
  const effPlain = plainOf(s.effect);
  // the effect line is often repeated inside the description — keep it once
  if (s.effect && !(effPlain && descPlain.includes(effPlain.slice(0, 60)))) {
    parts.push(`<p>${s.effect}</p>`);
    // …and a description paragraph that only restates the effect (creature riders after the stat idiom is stripped) goes
    if (effPlain) { const effLc = effPlain.toLowerCase(); desc = desc.replace(/<p>(?!<em>)([\s\S]*?)<\/p>/g, (p, inner) => { const ss = plainOf(inner).split(/(?<=\.)\s+/).filter(x => x.length > 20); return ss.length && ss.filter(x => effLc.includes(x.toLowerCase())).length * 3 >= ss.length * 2 ? "" : p; }); }
  }
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
  // P7 (2026-10-31): `firearm` is the one test that also types the weapon firearmR — RFI's firearms skill, not a name regex;
  // a bow (by name) and rig-mounted guns are not firearms. No 'amm' anywhere: Bad Eden has no ammunition items (the Bolt-Drivers
  // are crossbow-TAGGED firearms-skill guns and keep 'lod'); re-add 'amm' on bows when an ammo consumable exists in the pack.
  const bow = /\bbow\b/i.test(d.name) || tags.includes("bow");
  const rigGun = !!d.flags?.fourththing?.rigGear;
  const firearm = s.skill === "firearms" && !bow && !rigGun;
  const gunName = /pistol|rifle|ballistic|laser|slug|gun|cannon|mortar|lance/i.test(tags.join(" ") + " " + d.name);
  const martial = ranged ? (firearm ? !(tags.includes("pistol") || tags.includes("sidearm") || /pistol/i.test(d.name)) : (rigGun || gunName) && !/pistol/i.test(d.name)) : tags.some(t => ["heavy", "two-handed", "reach", "longsword", "maul"].includes(t));
  const props = new Set();
  for (const [t, p] of [["two-handed", "two"], ["light", "lgt"], ["heavy", "hvy"], ["thrown", "thr"], ["versatile", "ver"], ["finesse", "fin"], ["reach", "rch"], ["slow-reload", "lod"]]) if (tags.includes(t)) props.add(p);
  if (firearm) props.add("fir");
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
    // Firearms (2026-10-31): RFI's firearms-skill guns are their own category (bad-eden-5e rules.js) — bows and
    // rig-mounted guns stay where they were
    type: { value: firearm ? "firearmR" : ranged ? (martial ? "martialR" : "simpleR") : (martial ? "martialM" : "simpleM"), baseItem: "" },
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
  // Big Evasion/Resolve save bonuses (+3..+5 on the legendary vestments) stand in 5E — ruled 2026-10-07.
  if (changes.length) e.effects = [{ _id: "be5e" + sha(e.slug).slice(0, 12), name: d.name, img: e.img, transfer: true, disabled: false, changes, duration: {}, flags: {}, origin: null, tint: "#ffffff", statuses: [], description: "" }];
  const extra = (ev || re) ? `<p><strong>Worn:</strong> ${[ev ? `${ev >= 0 ? "+" : ""}${ev} to Dexterity saving throws` : "", re ? `${re >= 0 ? "+" : ""}${re} to Wisdom saving throws` : ""].filter(Boolean).join(", ")}.</p>` : "";
  e.system.description.value = gearDescription(d, needs) + extra;
  return e;
}
/* ── consumables (review C46, ruled 2026-10-31) ──────────────────────────────────────────────────────────────────
 * The RFI "⚙️ Mechanical Effects — On use: …; Charges: N" block becomes real dnd5e activities where the rubric can
 * express the op; the rest stays honest prose, a chat line naming the RFI op, and a needs row:
 *   Restore NdM(+K) Integrity → heal (healing)       Restore / Reduce N Stress → heal (temphp = @prof; the Stress-points ruling)
 *   Inflict N Stress → damage, self, Nd4 psychic     Cure <condition> → utility + flags.bad-eden-5e.cure [status]; chat says what ends
 *   Restore N Clarity → utility + flags.bad-eden-5e.flow N (Clarity = Flow points)
 *   Noise · Radiation · Surge · FrameDice · BloodDebt · mutations → utility; the chat line names the op (no D&D engine yet)
 * Every activity spends one use; Charges → uses.max; the item destroys itself at 0 (autoDestroy). Wondrous items get a
 * transfer Active Effect for an unconditional damage resistance; everything else they promise is listed for an override. */
const useAct = (slug, tag, type, { name = "", flavor = "", body = {} } = {}) => ({ _id: actId(slug, tag), type, name, img: "", sort: 0,
  activation: { type: "action", value: null, condition: "", override: false },
  consumption: { targets: [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }], scaling: { allowed: false, max: "" }, spellSlot: false },
  description: { chatFlavor: flavor }, duration: { concentration: false, value: "", units: "inst", special: "", override: false }, effects: [],
  range: { value: "", units: "self", special: "", override: false },
  target: { template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "" }, affects: { count: "", type: "self", choice: false, special: "" }, prompt: false, override: false },
  uses: { spent: 0, recovery: [] }, appliedEffects: [], ...body });
const healBody = (formula, type) => ({ healing: { custom: { enabled: true, formula }, number: null, denomination: 0, bonus: "", types: [type], scaling: { mode: "", number: null } } });
const utilBody = { roll: { formula: "", name: "", prompt: false, visible: false } };
function rfiMechanics(d) {
  const h = String(d.system?.description?.value ?? "");
  const m = h.match(/Mechanical Effects[\s\S]*?(?:<\/ul>|<!-- BBTTCC:MECHANICS:END -->)/);
  return m ? m[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}
const RFI_OP_TEXT = [
  [/^Lose\s+(\d+)\s+Radiation$/i, () => "Steps you down the radiation ladder — the GM applies it on the exposure card."],
  [/^Lose\s+(\d+)\s+Surge/i, () => "Cools your Surge one band."],
  [/^Gain\s+(\d+)\s+FrameDice$/i, m => `Returns ${m[1]} Frame ${Number(m[1]) === 1 ? "Die" : "Dice"} to your pool (an RFI engine op; no D&D counterpart yet).`],
  [/^Lose\s+(\d+)\s+BloodDebt$/i, m => `Softens ${m[1]} Blood Debt ledger ${Number(m[1]) === 1 ? "entry" : "entries"} — the GM applies it.`],
  [/^Restore\s+(\d+)\s+Noise$/i, m => `Clears ${m[1]} Noise — the GM applies it.`],
  [/^Cleanse\s+(.*)$/i, m => `Strips ${m[1]} — the GM removes the radiation mutation(s).`]
];
function consumableActivities(e, mech, needs) {
  const ops = (mech.match(/On use:\s*(.*?)\s*(?:Charges:|Target:|Tier:|Cost:|$)/)?.[1] ?? "").split(/\s*;\s*/).map(x => x.trim()).filter(Boolean);
  const charges = Number(mech.match(/Charges:\s*(\d+)/)?.[1]) || 1;
  e.system.uses = { max: String(charges), spent: 0, recovery: [], autoDestroy: true };
  const acts = {}, flags = {}, text = [];
  ops.forEach((op, n) => {
    const tag = `use${n}`; let m;
    if ((m = op.match(/^Restore\s+([\dd+ ]+?)\s+Integrity$/i))) { const f = m[1].replace(/\s/g, ""); acts[actId(e.slug, tag)] = useAct(e.slug, tag, "heal", { body: healBody(f, "healing") }); text.push(`regain ${f} hit points`); }
    else if ((m = op.match(/^(?:Restore|Reduce)\s+(\d+)\s+Stress$/i))) { acts[actId(e.slug, tag)] = useAct(e.slug, tag, "heal", { name: "Steady the nerves", body: healBody("@prof", "temphp") }); text.push("gain temporary hit points equal to your proficiency bonus"); }
    else if ((m = op.match(/^Inflict\s+(\d+)\s+Stress$/i))) { acts[actId(e.slug, tag)] = useAct(e.slug, tag, "damage", { name: "The cost", body: { damage: { critical: { allow: false, bonus: "" }, parts: [{ custom: { enabled: false, formula: "" }, number: Number(m[1]), denomination: 4, bonus: "", types: ["psychic"], scaling: { mode: "", number: 1 } }] } } }); text.push(`take ${m[1]}d4 psychic damage`); }
    else if ((m = op.match(/^Cure\s+(\w+)$/i))) { const w = conditionWord(m[1]); if (!w) needs.push(`consumable: Cure "${m[1]}" — no dnd5e condition`); else if (!(flags.cure ?? []).includes(w)) { flags.cure = [...(flags.cure ?? []), w]; acts[actId(e.slug, tag)] = useAct(e.slug, tag, "utility", { name: `Cure ${cap(w)}`, flavor: `Ends the ${w} condition on you.`, body: utilBody }); text.push(`the ${w} condition ends on you`); } }
    else if ((m = op.match(/^Restore\s+(\d+)\s+Clarity$/i))) { flags.flow = Number(m[1]); acts[actId(e.slug, tag)] = useAct(e.slug, tag, "utility", { name: "Clear the channel", flavor: `Regain ${m[1]} Flow point${Number(m[1]) === 1 ? "" : "s"}.`, body: utilBody }); text.push(`regain ${m[1]} Flow point${Number(m[1]) === 1 ? "" : "s"}`); }
    else { const row = RFI_OP_TEXT.find(([re]) => re.test(op)); const line = row ? row[1](op.match(row[0])) : `${op} (an RFI engine op; the GM applies it).`; acts[actId(e.slug, tag)] = useAct(e.slug, tag, "utility", { name: op, flavor: line, body: utilBody }); text.push(line.replace(/\.$/, "")); needs.push(`consumable: "${op}" has no D&D engine — chat line only (override to automate)`); }
  });
  e.system.activities = acts;
  if (Object.keys(flags).length) e.flags = { ...(e.flags ?? {}), "bad-eden-5e": { ...(e.flags?.["bad-eden-5e"] ?? {}), ...flags } };
  if (text.length) e.system.description.value += `<p><strong>Use${charges > 1 ? ` (${charges} charges)` : ""}:</strong> ${text.join("; ")}.</p>`;
}
function wondrousPassives(e, d, needs) {
  const plain = String(e.system.description.value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const changes = [];
  for (const m of plain.matchAll(/(?:^|[.;] )((?:[^.;]){0,40}?)\b(?:grants?|gains?|have|has|you gain) resistance to ([a-z, ]+?)(?: damage)?(?=[.;,])/gi)) {
    if (/\b(while|when|once|if|until|during)\b/i.test(m[1])) continue;
    for (const w of m[2].split(/,|\band\b/).map(x => x.trim()).filter(Boolean)) for (const t of dmgTypes([w])) changes.push({ key: "system.traits.dr.value", mode: 2, value: t, priority: 20 });
  }
  if (changes.length) e.effects = [{ _id: "be5e" + sha(e.slug).slice(0, 12), name: d.name, img: e.img, transfer: true, disabled: false, changes, duration: {}, flags: {}, origin: null, tint: "#ffffff", statuses: [], description: "" }];
  if (/advantage|disadvantage|resistance|\+\d|DC \d+|saving throw|once per|\bcharges?\b/i.test(plain) && !changes.length) needs.push("wondrous: the text promises a mechanic the lane can't express — prose only; needs an override to automate");
  else if (!changes.length) needs.push("wondrous: no expressible mechanic — prose only");
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
  if (consumable) {
    const mech = rfiMechanics(d);
    if (mech) for (let i = needs.length - 1; i >= 0; i--) if (needs[i].startsWith("RFI engine block dropped")) needs.splice(i, 1);   // parsed, not dropped
    if (mech) consumableActivities(e, mech, needs); else needs.push("consumable: no RFI mechanics block — Use only spends it");
  } else if (wondrous) wondrousPassives(e, d, needs);
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
  // Rig parts (2026-10-30): frames, rig weapons and rig systems from the Rig & Boss Catalog ride along so the
  // Arc Bay sells them on D&D too. Converted like the rigs lane's mounted gear; flags.fourththing.rigGear/rigFrame
  // kept verbatim (game.bbttcc.rigs.gearOf reads that scope on either system). Frames saved as feats convert as gear.
  const isRigPart = d => !!(d.flags?.fourththing?.rigGear || d.flags?.fourththing?.rigFrame) && ["weapon", "gear", "equipment", "feat"].includes(d.type);
  const src = all.filter(d => isRigPart(d) || (["weapon", "armor", "gear", "equipment", "consumable"].includes(d.type) && !d.flags?.fourththing?.rigGear && !d.flags?.fourththing?.rigFrame && !/^Rig & Boss/.test(folderOf(d))));
  const out = [], needsAll = [];
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = [], folder = folderOf(d), rigPart = isRigPart(d);
    const e = d.type === "weapon" ? convertWeapon(d, needs) : d.type === "armor" ? convertArmor(d, needs) : (d.type === "gear" || rigPart) ? convertGear(d, needs, rigPart ? "Rig Parts" : folder) : passthrough(d, needs, folder);
    e.folder = rigPart ? "Rig Parts" : (folder.split("/")[0] || "Gear");
    for (const l of leftovers(e.system.description.value)) needs.push(`leftover term "${l}"`);
    if (!rfiPrice(d) && !e.system.price?.value) needs.push("no price in marks");
    // C64 (2026-10-31): flags.bbttcc rides along (hazardResist / radiation.tierDelta / darkness* — api.radiation protectionFor and the
    // darkness engine read it on either system) and is part of the parity hash
    e.flags = { ...(e.flags ?? {}), "bad-eden-5e": { ...(e.flags?.["bad-eden-5e"] ?? {}), rfi: { id: d._id, pack: "items", identifier: d.system?.identifier ?? "", hash: sha(JSON.stringify({ n: d.name, s: d.system, f: d.flags?.fourththing ?? {}, b: d.flags?.bbttcc ?? {} })) } } };
    if (d.flags?.bbttcc && Object.keys(d.flags.bbttcc).length) e.flags.bbttcc = JSON.parse(JSON.stringify(d.flags.bbttcc));
    if (rigPart) e.flags.fourththing = JSON.parse(JSON.stringify(d.flags?.fourththing ?? {}));
    // the market prices by flags.fourththing.rfi.item {price, frame, tier, rarity, bound} on either system (2026-10-30)
    else if (d.flags?.fourththing?.rfi?.item) e.flags.fourththing = { rfi: { item: JSON.parse(JSON.stringify(d.flags.fourththing.rfi.item)) } };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "items" };
}


/* ── creatures lane: the live NPC Pack's lineage-flagged monsters → dnd5e npc actors ── */
const CR = { 1: { light: 0.5, medium: 1, heavy: 2, boss: 4 }, 2: { light: 3, medium: 5, heavy: 6, boss: 8 }, 3: { light: 7, medium: 9, heavy: 11, boss: 13 }, 4: { light: 12, medium: 14, heavy: 16, boss: 20 } };
const CHASSIS = { damage: [0, 3, 4, 5], pool: { light: [0.6, 0.6, 0.6, 0.6], medium: [2, 1.5, 1.5, 1.5], heavy: [3, 3, 3, 3], boss: [5, 5, 5, 4] }, strikes: { light: [1, 1, 1, 2], medium: [1, 2, 2, 3], heavy: [2, 2, 3, 3], boss: [2, 3, 3, 3] }, legendary: { light: [0, 0, 0, 0], medium: [0, 0, 0, 0], heavy: [0, 0, 0, 0], boss: [1, 1, 1, 2] } };
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
/* C45 (ruled 2026-10-31): the sheet carries the RFI numbers — hp = Integrity, AC = Guard (rubric creatures: integrity.max → hp.max,
 * guard → ac.flat) — and the CR label is DERIVED from them so the number the GM sees matches the stat block: DMG p.274
 * "Monster Statistics by Challenge Rating", defensive CR from the hp band shifted 1 per 2 AC off the band's AC, offensive
 * CR from damage/round shifted 1 per 2 attack-bonus points off the band's, averaged and snapped to a legal CR. The old
 * tier×bracket table (CR above) is now only the band a needs-row compares against. */
const CR_ROWS = [ // [cr, hp max, AC, damage/round max, attack bonus, save DC]
  [0, 6, 13, 1, 3, 13], [0.125, 35, 13, 3, 3, 13], [0.25, 49, 13, 5, 3, 13], [0.5, 70, 13, 8, 3, 13], [1, 85, 13, 14, 3, 13], [2, 100, 13, 20, 3, 13], [3, 115, 13, 26, 4, 13],
  [4, 130, 14, 32, 5, 14], [5, 145, 15, 38, 6, 15], [6, 160, 15, 44, 6, 15], [7, 175, 15, 50, 6, 15], [8, 190, 16, 56, 7, 16], [9, 205, 16, 62, 7, 16], [10, 220, 17, 68, 7, 16],
  [11, 235, 17, 74, 8, 17], [12, 250, 17, 80, 8, 17], [13, 265, 18, 86, 8, 18], [14, 280, 18, 92, 8, 18], [15, 295, 18, 98, 8, 18], [16, 310, 18, 104, 9, 18], [17, 325, 19, 110, 10, 19],
  [18, 340, 19, 116, 10, 19], [19, 355, 19, 122, 10, 19], [20, 400, 19, 140, 10, 19], [21, 445, 19, 158, 11, 20], [22, 490, 19, 176, 11, 20], [23, 535, 19, 194, 11, 20], [24, 580, 19, 212, 12, 21],
  [25, 625, 19, 230, 12, 21], [26, 670, 19, 248, 12, 21], [27, 715, 19, 266, 13, 22], [28, 760, 19, 284, 13, 22], [29, 805, 19, 302, 13, 22], [30, 850, 19, 320, 14, 23]];
const crRow = (field, v) => { const i = CR_ROWS.findIndex(r => v <= r[field]); return i < 0 ? CR_ROWS.length - 1 : i; };
const crStep = (i, by) => Math.max(0, Math.min(CR_ROWS.length - 1, i + by));
function deriveCr({ hp, ac, dpr, atk }) {
  let di = crRow(1, hp); di = crStep(di, Math.trunc((ac - CR_ROWS[di][2]) / 2));
  let oi = crRow(3, dpr); oi = crStep(oi, Math.trunc((atk - CR_ROWS[oi][4]) / 2));
  const avg = (CR_ROWS[di][0] + CR_ROWS[oi][0]) / 2;
  return CR_ROWS.map(r => r[0]).reduce((best, c) => Math.abs(c - avg) < Math.abs(best - avg) ? c : best, 0);
}
const profFor = cr => Math.max(2, Math.floor((cr + 7) / 4));   // dnd5e's NPC proficiency by CR
const LINEAGE_TYPE = { qliphothic: "fiend", sephirotic: "celestial", wild: "beast", "pre-fall": "construct", "hex-touched": "monstrosity", dream: "aberration", revenant: "undead", mortal: "humanoid" };
const DND_TYPES = new Set(["aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead"]);
const DND_CI = new Set(["blinded", "charmed", "deafened", "diseased", "exhaustion", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"]);
const INTENT_SAVE = { violence: "str", intrigue: "dex", body: "con", mind: "int", soul: "wis", presence: "cha" };
// Condition words that turn up in RFI defense lists ("immune to fear") — they belong in traits.ci, not di (review C47, 2026-10-31).
// `poison` / `disease` as a damage immunity stay damage; `diseased` / `fatigue` are conditions.
const CONDITION_WORD = { fear: "frightened", feared: "frightened", frightened: "frightened", shaken: "frightened", charm: "charmed", charmed: "charmed", calmed: "charmed", compelled: "charmed",
  prone: "prone", restrained: "restrained", blinded: "blinded", stunned: "stunned", paralyzed: "paralyzed", paralysed: "paralyzed", grappled: "grappled", deafened: "deafened", petrified: "petrified",
  unconscious: "unconscious", incapacitated: "incapacitated", surprised: "surprised", diseased: "diseased", fatigue: "exhaustion", strain: "exhaustion", strained: "exhaustion", exhaustion: "exhaustion", poisoned: "poisoned" };
const conditionWord = c => { const k = String(typeof c === "string" ? c : c?.key ?? c?.type ?? "").toLowerCase(); const w = CONDITION_WORD[k] ?? String(RUBRIC.conditions[k]?.to ?? "").split(/[ (]/)[0]; return DND_CI.has(w) ? w : null; };
/** Split an RFI defenses list into damage types and condition words. */
function splitDefenses(list) {
  const damage = [], conditions = [];
  for (const r of list ?? []) { const k = String(typeof r === "string" ? r : r?.type ?? "").toLowerCase(); const w = CONDITION_WORD[k] ? conditionWord(k) : null; if (w) conditions.push(w); else damage.push(r); }
  return { damage, conditions };
}
/** A rule condition (a string or the object form {key, duration, save}) in 5E words — the object form used to print
 *  "[object Object]" into 46 feature texts and GM reminders (review C41, 2026-10-31). */
const COND_TEXT = { shaken: "frightened", calmed: "charmed (it can't willingly take violent action)", compelled: "charmed (it must spend its action on the directive)",
  staggered: "Staggered (speed halved, −2 to attack rolls)", imposed: "Imposed (disadvantage on its next attack roll or saving throw)", strained: "one level of exhaustion worse",
  burning: "burning (1d4 fire damage at the start of each of its turns)", surprised: "surprised", dying: "dying (0 hit points)", scarred: "Scarred", jolted: "unable to take reactions until the start of its next turn" };
const COND_DUR = { "1-round": " until the end of its next turn", "until-saved": " until it saves (it repeats the saving throw at the end of each of its turns)", scene: " until the end of the encounter", encounter: " until the end of the encounter", "soma-break": " until its next long rest" };
function condText(c) {
  const key = typeof c === "string" ? c : (c?.key ?? c?.condition ?? "");
  if (!key) return "affected";
  const k = String(key).toLowerCase();
  const word = COND_TEXT[k] ?? (DND_CI.has(k) ? k : String(key).replace(/\b\w/g, ch => ch.toUpperCase()));
  const dur = typeof c === "object" && c ? (COND_DUR[c.duration] ?? (c.duration ? ` (${c.duration})` : "")) : "";
  return word + dur;
}
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
    if (d.condition) bits.push(`the target is ${[].concat(d.condition).map(condText).join(" and ")}`);
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
/* ── the RFI stat-block idiom in creature prose (review C43, 2026-10-31) ─────────────────────────────────────────
 * Monster items carry their RFI numbers in the text: "<strong>Strike.</strong> reach 1 square., one target. Damage:
 * <code>2d10</code> kinetic + violence. <rider sentence>" / "Hit: <code>2d10</code> psychic + violence; half on success." /
 * "Fail: <code>1d8</code> psychic (Stress) + Staggered." / "<p><strong>Cost.</strong> 2 Clarity, +2 Noise · action</p>".
 * The dnd5e activity carries the real dice, so the stat clause is stripped BEFORE the rubric runs and the rider
 * sentence + Dave's flavour line stay. Save summaries keep their condition ("Fail: Staggered."). */
const STAT_ABIL = "(?:violence|intrigue|body|mind|soul|presence)";
const STAT_DMG = "(?:<code>)?\\d+d\\d+(?:\\s*\\+\\s*\\d+)?(?:</code>)?";
function stripStatIdiom(html) {
  if (!html) return html;
  return String(html)
    .replace(/(\d+)\+ squares?\b/g, (_, n) => `${Number(n) * 5}+ feet`)
    .replace(/(\d+)-squares?\b/g, (_, n) => `${Number(n) * 5}-foot`)              // "a 3-square. cone" → "a 15-foot cone"
    .replace(/(\d+ squares?|\d+-foot)\.\s+(?=[a-z])/g, "$1 ")                      // the stray period of the RFI range stamp
    .replace(/\bDamage goes (straight )?to (the )?Stress( track)?( straight)?\.\s*/gi, "")
    .replace(/<p>\s*<strong>\s*Cost\.\s*<\/strong>[^<]*<\/p>/g, "")
    .replace(/<strong>\s*(Strike|Working|Form)\.\s*<\/strong>\s*/g, "")
    // "reach 1 square., one target." / "range 12/36 squares, one target." / "reach 1 square., after 20+ feet of straight movement, one target."
    .replace(new RegExp(`\\b(?:reach|range)\\s+\\d+(?:\\/\\d+)?\\s+squares?\\.?,?\\s*(?:(after [^.,]*),\\s*)?(?:one target|all targets|per target|one creature|each target)[^.]*\\.\\s*`, "gi"), (_, after) => after ? `${after.charAt(0).toUpperCase()}${after.slice(1)}. ` : "")
    // "Damage: <code>2d10</code> kinetic (frame-arm) + violence." — the activity rolls it
    .replace(new RegExp(`Damage:\\s*${STAT_DMG}\\s*[a-z]+(?:\\s*\\([^)]*\\))?(?:\\s*(?:to|\\(?[Ss]tress\\)?))*\\s*(?:damage\\s*)?(?:\\+\\s*${STAT_ABIL})?\\.?\\s*`, "g"), "")
    // "Hit: <code>2d10</code> psychic (scenario-rewrite) + violence; half on success." on a save weapon
    .replace(new RegExp(`Hit:\\s*${STAT_DMG}[^.;<]*\\+\\s*${STAT_ABIL}\\s*[;.]\\s*(?:[Hh]alf on (?:a )?success\\.?\\s*)?`, "g"), "")
    // "Fail: <code>1d8</code> psychic (Stress) + Staggered." → "Fail: Staggered."; "Fail: <code>2d8</code> qliphothic (their own blow)." → ""
    .replace(new RegExp(`Fail:\\s*${STAT_DMG}\\s*[a-z]+(?:\\s+damage)?(?:\\s*\\([^)]*\\))?(?:\\s+damage)?(?:\\s*to Stress)?(?:\\s*\\+\\s*|\\s+and\\s+(?:becomes?\\s+|is\\s+)?)`, "g"), "Fail: ")
    .replace(new RegExp(`Fail:\\s*${STAT_DMG}\\s*[a-z]+(?:\\s+damage)?(?:\\s*\\([^)]*\\))?(?:\\s+damage)?(?:\\s*to Stress)?\\.\\s*`, "g"), "")
    .replace(new RegExp(`\\s*\\+\\s*${STAT_ABIL}\\b(?=[.;,]|\\s|$)`, "g"), "")
    .replace(/<p>\s*<\/p>/g, "");
}
/** A creature's embedded item with its prose pre-stripped of the stat idiom (the rubric runs after). */
const creatureItem = it => ({ ...it, system: { ...(it.system ?? {}), effect: stripStatIdiom(it.system?.effect ?? ""), description: { ...(it.system?.description ?? {}), value: stripStatIdiom(it.system?.description?.value ?? "") } } });
function monsterFeature(it0, needs, actorSlug, dc = 12) {
  const it = creatureItem(it0);
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
      // C48 (2026-10-31): the intent's own save — Mind → Intelligence, Presence → Charisma (they used to collapse to Wisdom)
      ...(dm && !self ? { save: { ability: [ability], dc: { calculation: "", formula: String(dc) } }, damage: { onSave: "half", critical: { allow: false, bonus: "" }, parts: [{ custom: { enabled: false, formula: "" }, number: Number(dm[1]), denomination: Number(dm[2]), bonus: dm[3] ?? "", types, scaling: { mode: "", number: 1 } }] } } : { roll: { formula: "", name: "", prompt: false, visible: false } }) };
    e.img = "icons/magic/unholy/orb-glowing-purple.webp";
  }
  applyUseRules(e, na, actorSlug, dc, needs, it.name);
  return e;
}

/* ── npcAuto → dnd5e automation (the monster rider slice, ruled 2026-10-07) ─
 *   use      + condition/save/damage → a save (or utility) activity on the feature,
 *                                       the condition as an applied effect
 *   hit      + damage/condition/…    → riders on the weapon's attack activity
 *   saveFail + condition/damage/…    → effects on the weapon's save activity
 *                                       (a second "— <condition>" save activity
 *                                       when the weapon only attacks)
 *   attack   + reroll                → chat flavour on the attack (no engine for
 *                                       conditional advantage yet)
 *   turnStart · selfTurnStart · bloodied · zero · struck · attacked · damaged ·
 *   allyDamaged                      → text + GM reminders (flags.bad-eden-5e.reminders,
 *                                       scripts/reminders.js)
 *   radiation · morale · ward · tempIntegrity · heal · prompt → chat flavour text
 * ─────────────────────────────────────────────────────────────────────────── */
const COND_STATUS = { restrained: "restrained", prone: "prone", blinded: "blinded", charmed: "charmed", shaken: "frightened",
  calmed: "charmed", compelled: "charmed", staggered: "be5e-staggered", imposed: "be5e-imposed", surprised: "surprised", stunned: "stunned" };
const COND_IMG = { restrained: "icons/svg/net.svg", prone: "icons/svg/falling.svg", blinded: "icons/svg/blind.svg", charmed: "icons/magic/control/hypnosis-mesmerism-eye.webp",
  shaken: "icons/svg/terror.svg", calmed: "icons/magic/control/hypnosis-mesmerism-eye.webp", compelled: "icons/magic/control/hypnosis-mesmerism-eye.webp",
  staggered: "icons/svg/daze.svg", imposed: "icons/magic/control/debuff-chains-shackles-movement-red.webp" };
const ATTR_SAVE = { violence: "str", intrigue: "dex", body: "con", mind: "int", soul: "wis", presence: "cha" };
const cap = (x) => String(x).replace(/\b\w/g, c => c.toUpperCase());
const effId = (...parts) => sha("eff" + parts.join("|")).slice(0, 16).padEnd(16, "0");
const actId = (...parts) => sha("act" + parts.join("|")).slice(0, 16).padEnd(16, "0");

/** The condition of a rule as an Active Effect (v14 change shape). */
function conditionEffect(cnd, owner, actorSlug) {
  const key = typeof cnd === "string" ? cnd : cnd?.key;
  if (!key) return null;
  const status = COND_STATUS[key];
  const dur = typeof cnd === "object" ? cnd.duration : "";
  const duration = dur === "1-round" ? { rounds: 1, turns: 0 } : {};
  const tail = dur === "until-saved" ? " It repeats the saving throw at the end of each of its turns, ending the effect on a success."
    : dur === "scene" ? " It lasts until the end of the scene (a short rest)." : "";
  const rule = String(RUBRIC.conditions[key]?.to ?? key).replace(/\s*\((text|ruling.*?)\)$/, "");
  const changes = key === "staggered" ? [
    { key: "system.attributes.movement.walk", value: "0.5", type: "multiply", priority: 20 },
    { key: "system.bonuses.mwak.attack", value: "-2", type: "add", priority: 20 },
    { key: "system.bonuses.rwak.attack", value: "-2", type: "add", priority: 20 }
  ] : [];
  return {
    _id: effId(actorSlug, owner, key), name: cap(key), img: COND_IMG[key] ?? "icons/svg/aura.svg", transfer: false, disabled: false,
    statuses: status ? [status] : [], changes, duration, description: `<p>${cap(rule)}.${tail}</p>`, origin: null, tint: "#ffffff",
    flags: { "bad-eden-5e": { rule: key, from: owner } }
  };
}
function textEffect(name, img, text, owner, actorSlug) {
  return { _id: effId(actorSlug, owner, name), name, img, transfer: false, disabled: false, statuses: [], changes: [], duration: {},
    description: `<p>${text}</p>`, origin: null, tint: "#ffffff", flags: { "bad-eden-5e": { rule: name.toLowerCase(), from: owner } } };
}
/** Flavour lines for the parts of a rule the sheet can't automate. */
function ruleFlavour(rule) {
  const d = rule.do ?? {}, bits = [];
  const cond = rule.if ?? {};
  if (cond.targetCondition) bits.push(`only if the target is ${[].concat(cond.targetCondition).join(" or ")}`);
  if (cond.targetTag) bits.push(`only against ${[].concat(cond.targetTag).join(", ")} creatures`);
  if (cond.damageType) bits.push(`only ${[].concat(cond.damageType).map(t => dmgTypes([t]).join("/")).join(" or ")} damage`);
  if (d.reroll) bits.push(/highest/.test(String(d.reroll)) ? `${/damage/.test(String(d.reroll)) ? "damage" : "attack"} rolls at disadvantage` : `${/damage/.test(String(d.reroll)) ? "damage" : "attack"} rolls with advantage`);
  if (d.tempIntegrity) bits.push(`it gains ${d.tempIntegrity} temporary hit points`);
  if (d.heal) bits.push(`it regains ${typeof d.heal === "object" ? d.heal.formula ?? d.heal.amount : d.heal} hit points`);
  if (d.radiation) bits.push("the target takes one step up the radiation ladder");
  if (d.morale) bits.push("a morale check");
  if (d.ward) bits.push("it is warded");
  if (d.prompt) bits.push(convertText(String(d.prompt).replace(/\b(damage|the \d+d\d+|it) goes to (the )?Stress( track)?/gi, "$1 is psychic damage").replace(/\bto (the )?Stress( track)?\b/gi, "as psychic damage")).replace(/<[^>]+>/g, "").replace(/\s+([.;,])/g, "$1"));
  return bits.join("; ");
}
function damagePart(dm) {
  const f = typeof dm === "object" ? String(dm.formula ?? dm.amount ?? "") : String(dm);
  const m = f.replace(/\s/g, "").match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
  const types = dmgTypes([typeof dm === "object" ? dm.type ?? "kinetic" : "kinetic"]);
  return m ? { custom: { enabled: false, formula: "" }, number: Number(m[1]), denomination: Number(m[2]), bonus: m[3] ?? "", types, scaling: { mode: "", number: 1 } }
    : { custom: { enabled: true, formula: f }, number: null, denomination: 0, bonus: "", types, scaling: { mode: "", number: 1 } };
}
function saveSpec(rule, dc) {
  const d = rule.do ?? {}; const cs = typeof d.condition === "object" ? d.condition?.save : null; const s = d.save ?? cs;
  if (!s) return null;
  return { ability: ATTR_SAVE[s.attr] ?? "wis", dc: Number(s.dc) || dc, onSave: s.onSave === "negate" ? "none" : "half" };
}
const baseActivity = (aid, type, activation = "action") => ({
  _id: aid, type, name: "", img: "", sort: 0,
  activation: { type: activation, value: null, condition: "", override: false },
  consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: false }, description: { chatFlavor: "" },
  duration: { concentration: false, value: "", units: "inst", special: "", override: false }, effects: [],
  range: { value: "60", units: "ft", special: "", override: false },
  target: { template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "" }, affects: { count: "1", type: "creature", choice: false, special: "" }, prompt: true, override: false },
  uses: { spent: 0, recovery: [] }, appliedEffects: []
});
/** `use` rules → one activity on the feature (save when anything asks for one). */
function applyUseRules(e, na, actorSlug, dc, needs, itemName) {
  const rules = (na?.rules ?? []).filter(r => r.on === "use");
  const rest = (na?.rules ?? []).filter(r => r.on !== "use");
  const flavour = rules.map(ruleFlavour).filter(Boolean);
  if (!rules.length) return;
  const self = rules.every(r => r.who === "self" && !r.do?.condition && !r.do?.damage && !r.do?.save);
  const anySave = rules.map(r => saveSpec(r, dc)).find(Boolean);
  const existing = Object.values(e.system.activities ?? {})[0];
  const act = existing ?? baseActivity(actId(actorSlug, e.slug, "use"), anySave ? "save" : "utility");
  if (!existing) e.system.activities = { [act._id]: act };
  if (self) { act.range = { value: "", units: "self", special: "", override: false }; act.target.affects = { count: "", type: "self", choice: false, special: "" }; }
  if (anySave && act.type !== "save") { act.type = "save"; delete act.attack; }
  if (anySave) {
    act.save = { ability: [anySave.ability], dc: { calculation: "", formula: String(anySave.dc) } };
    act.damage ??= { onSave: anySave.onSave, critical: { allow: false, bonus: "" }, parts: [] };
    act.damage.onSave = anySave.onSave;
  }
  e.effects ??= [];
  for (const r of rules) {
    const d = r.do ?? {};
    if (d.damage) { act.damage ??= { onSave: "half", critical: { allow: false, bonus: "" }, parts: [] }; act.damage.parts.push(damagePart(d.damage)); if (act.type === "utility") act.type = "damage"; }
    for (const c of [].concat(d.condition ?? [])) { const fx = conditionEffect(c, itemName, actorSlug); if (fx) { e.effects.push(fx); act.effects.push({ _id: fx._id, onSave: false }); } }
    if (d.noReactions) { const fx = textEffect("No Reactions", "icons/svg/paralysis.svg", "It can't take reactions until the start of its next turn.", itemName, actorSlug); e.effects.push(fx); act.effects.push({ _id: fx._id, onSave: false }); }
    if (d.dot) { const dot = d.dot; const fx = textEffect(`Ongoing ${dmgTypes([dot.type ?? "kinetic"]).join("/")} damage`, "icons/svg/blood.svg", `It takes ${dot.formula ?? dot.amount} ${dmgTypes([dot.type ?? "kinetic"]).join("/")} damage at the start of each of its turns${dot.ends === "action" ? " until it uses an action to end it" : dot.rounds ? ` for ${dot.rounds} rounds` : ""}.`, itemName, actorSlug); e.effects.push(fx); act.effects.push({ _id: fx._id, onSave: false }); }
  }
  if (flavour.length) act.description.chatFlavor = flavour.join(" · ");
  if (rest.some(r => ["radiation", "morale", "ward"].some(k => r.do?.[k]))) needs.push(`"${itemName}": radiation / morale / ward stay text (no D&D engine yet)`);
}
/** `hit` / `attack` / `saveFail` rules on a weapon → riders on its activities. */
function applyWeaponRules(e, w, actorSlug, dc) {
  const rules = w.flags?.fourththing?.npcAuto?.rules ?? [];
  // "kinetic" on a weapon rider means the weapon's own damage type, not all three
  const own = (e.system.damage?.base?.types ?? []).filter(Boolean);
  const kin = (list) => own.length && list.length > 1 && list.every(t => ["bludgeoning", "piercing", "slashing"].includes(t)) ? own : list;
  const acts = Object.values(e.system.activities ?? {});
  const attack = acts.find(a => a.type === "attack"), save0 = acts.find(a => a.type === "save");
  e.effects ??= [];
  const flavour = [];
  const link = (act, fx) => { e.effects.push(fx); act.effects.push({ _id: fx._id, ...(act.type === "save" ? { onSave: false } : {}) }); };
  const addRule = (act, r) => {
    const d = r.do ?? {};
    if (d.damage) { act.damage ??= { onSave: "half", critical: { allow: true, bonus: "" }, parts: [] }; const part = damagePart(d.damage); part.types = kin(part.types); act.damage.parts.push(part); }
    for (const c of [].concat(d.condition ?? [])) { const fx = conditionEffect(c, w.name, actorSlug); if (fx) link(act, fx); }
    if (d.noReactions) link(act, textEffect("No Reactions", "icons/svg/paralysis.svg", "It can't take reactions until the start of its next turn.", w.name, actorSlug));
    if (d.dot) { const dot = d.dot; const t = kin(dmgTypes([dot.type ?? "kinetic"])).join("/"); link(act, textEffect(`Ongoing ${t} damage`, "icons/svg/blood.svg", `It takes ${dot.formula ?? dot.amount} ${t} damage at the start of each of its turns${dot.ends === "action" ? " until it uses an action to end it" : dot.rounds ? ` for ${dot.rounds} rounds` : ""}.`, w.name, actorSlug)); }
    const f = ruleFlavour(r); if (f) flavour.push(`${r.on === "hit" ? "On a hit" : r.on === "saveFail" ? "On a failed save" : "Attack"}: ${f}`);
  };
  for (const r of rules) {
    if (r.if?.weapon && r.if.weapon !== w.name) continue;
    if (r.on === "hit" && attack) addRule(attack, r);
    else if (r.on === "attack" && attack) { const f = ruleFlavour(r); if (f) flavour.push(`Attack: ${f}`); }
    else if (r.on === "saveFail") {
      let act = save0;
      if (!act) {
        const sp = saveSpec(r, dc);
        act = baseActivity(actId(actorSlug, e.slug, "savefail"), "save");
        act.name = `${w.name} — ${[].concat(r.do?.condition ?? []).map(c => cap(typeof c === "string" ? c : c.key)).join(", ") || "save"}`;
        act.activation = { type: "", value: null, condition: "On a hit", override: false };
        act.save = { ability: [sp?.ability ?? "wis"], dc: { calculation: "", formula: String(sp?.dc ?? dc) } };
        act.damage = { onSave: sp?.onSave ?? "none", critical: { allow: false, bonus: "" }, parts: [] };
        e.system.activities[act._id] = act;
      }
      addRule(act, r);
    }
  }
  if (flavour.length && attack) attack.description.chatFlavor = [attack.description.chatFlavor, flavour.join(" · ")].filter(Boolean).join(" · ");
}
/** Everything that is a GM moment, not a roll: collected per actor for scripts/reminders.js. */
const REMINDER_ON = ["turnStart", "selfTurnStart", "bloodied", "zero", "struck", "attacked", "damaged", "allyDamaged"];
function reminderLines(items) {
  const out = {};
  for (const it of items) {
    for (const r of it.flags?.fourththing?.npcAuto?.rules ?? []) {
      if (!REMINDER_ON.includes(r.on)) continue;
      const line = autoRulesText({ rules: [r] }).replace(/<[^>]+>/g, "").trim();
      if (!line) continue;
      (out[r.on] ??= []).push({ item: it.name, text: line, ...(r.radius ? { radius: Number(r.radius) * 5 } : {}), ...(r.who ? { who: r.who } : {}) });
    }
  }
  return out;
}
function convertMonster(a, items, needs) {
  const s = a.system ?? {}, ff = a.flags?.fourththing ?? {}, rfi = ff.rfi?.actor ?? {};
  const tier = Math.max(1, Math.min(4, ROMAN[rfi.tier] || Number(rfi.tier) || Number(s.details?.tier) || 1));
  const bracketRaw = String(rfi.bracket || "medium").toLowerCase();
  const bracket = CHASSIS.pool[bracketRaw] ? bracketRaw : ({ elite: "heavy", minion: "light", standard: "medium" }[bracketRaw] ?? "medium");
  const t = tier - 1, bandCr = CR[tier][bracket];
  const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const abil = {}; for (const [k, v] of Object.entries(ABIL)) abil[v] = Math.min(30, 10 + 2 * (Number(s.attributes?.[k]?.value) || 1));
  const d = s.derived ?? {};
  // C45: hp = Integrity, AC = Guard; CR derived from what lands on the sheet (see CR_ROWS)
  const hp = Math.max(1, Math.round(Number(d.integrity?.max) || Number(d.integrity?.value) || 10));
  const ac = Math.max(5, Math.round(Number(d.guard?.value) || 10));
  const strikes = CHASSIS.strikes[bracket][t], legendary = CHASSIS.legendary[bracket][t];
  const dieAvg = f => { const m = String(f ?? "").replace(/\s/g, "").match(/^(\d+)d(\d+)(?:\+(\d+))?$/); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 + (Number(m[3]) || 0) : 0; };
  const bestDie = Math.max(0, ...items.filter(i => i.type === "weapon").map(i => dieAvg(i.system?.damage?.formula)), ...items.filter(i => i.type === "power").map(i => dieAvg(i.system?.damage)));
  const dpr = Math.round(Math.max(1, bestDie + CHASSIS.damage[t]) * strikes);
  const mod = v => Math.floor((v - 10) / 2);
  const cr = deriveCr({ hp, ac, dpr, atk: (tier + 1) + Math.max(mod(abil.str), mod(abil.dex)) });
  if (Math.abs(cr - bandCr) > 2) needs.push(`CR ${cr} derived from the stat block (${hp} hp, AC ${ac}, ~${dpr} damage/round); the Tier ${tier} ${bracket} band says CR ${bandCr}`);
  const creatureTypeRaw = [].concat(ff.creatureType ?? [])[0];
  const type = /dragon|wyrm/i.test(a.name) ? "dragon" : DND_TYPES.has(String(creatureTypeRaw)) ? creatureTypeRaw : (LINEAGE_TYPE[rfi.lineage] ?? "monstrosity");
  const themes = (rfi.bestiary?.themes ?? []).map(String); const name = a.name;
  const size = themes.includes("dragon") || /dragon|apex|colossus/i.test(name) ? "huge" : /patriarch|berserker|construct|tree|elemental|serpent|mother|warlord|wendigo/i.test(name) && bracket !== "light" ? "lg" : /tick|hound|stray|skitter|kiddo|hawk/i.test(name) && bracket === "light" ? "sm" : "med";
  if (size !== "med") needs.push(`size guessed ${size} from the name — check`);
  const dark = ["qliphothic", "dream", "revenant", "pre-fall", "hex-touched"].includes(rfi.lineage) || type !== "humanoid" ? 60 : 0;
  const prof = profFor(cr);
  const abilities = {}; for (const k of Object.keys(ABIL_NAME)) abilities[k] = { value: abil[k], proficient: 0, bonuses: { check: "", save: "" }, max: null };
  if (Number(d.evasion?.value) >= 14) abilities.dex.proficient = 1;
  if (Number(d.resolve?.value) >= 14) abilities.wis.proficient = 1;
  if ((Number(s.attributes?.body?.value) || 0) >= 4) abilities.con.proficient = 1;
  if ((Number(s.attributes?.violence?.value) || 0) >= 4) abilities.str.proficient = 1;
  const skills = {};
  for (const [k, v] of Object.entries(s.skills ?? {})) { const n = Number(v?.value) || 0; const sk = skillOf(k); if (n >= 1 && sk?.kind === "skill") skills[sk.key] = { value: n >= 2 ? 2 : 1, ability: "", bonuses: { check: "", passive: "" }, roll: { min: null, max: null, mode: 0 } }; }
  // C47: condition words in the RFI defense lists ("immune to fear") go to traits.ci, not di
  const defs = Object.fromEntries(["resistances", "immunities", "vulnerabilities"].map(k => [k, splitDefenses(s.defenses?.[k])]));
  const dr = dmgTypes(defs.resistances.damage), di = dmgTypes(defs.immunities.damage), dv = dmgTypes(defs.vulnerabilities.damage);
  const ci = [...new Set([...(s.conditionImmunities ?? []).map(conditionWord), ...defs.immunities.conditions].filter(Boolean))];
  // embedded items
  const out = [];
  const weapons = items.filter(i => i.type === "weapon");
  for (const w of weapons) {
    const needsW = [];
    const e = convertWeapon(creatureItem({ ...w, flags: w.flags ?? {} }), needsW);   // C43: stat idiom stripped before the rubric
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
    applyWeaponRules(e, w, slug, 8 + prof + Math.floor((Math.max(abil.int, abil.wis, abil.cha) - 10) / 2));
    out.push(e); for (const n of needsW) needs.push(`weapon "${w.name}": ${n}`);
  }
  const mental = Math.max(abil.int, abil.wis, abil.cha); const dc = 8 + prof + Math.floor((mental - 10) / 2);
  for (const f of items.filter(i => ["feat", "feature", "power"].includes(i.type))) out.push(monsterFeature(f, needs, slug, dc));
  for (const g0 of items.filter(i => ["armor", "gear"].includes(i.type))) { const g = creatureItem(g0), n = []; const e = g.type === "armor" ? convertArmor(g, n) : convertGear(g, n, ""); e.slug = e.slug.replace(/^gear-/, ""); out.push(e); }
  if (strikes > 1) out.unshift({ slug: "multiattack", name: "Multiattack", type: "feat", img: "icons/skills/melee/strike-sword-slashing-red.webp", system: { description: { value: `<p>It makes ${strikes} attacks.</p>` }, type: { value: "monster", subtype: "" }, uses: { max: "", spent: 0, recovery: [] }, requirements: "", prerequisites: { level: null, repeatable: false }, properties: [], activities: {}, enchant: {}, identifier: "multiattack" }, effects: [], flags: {} });
  if (legendary) out.push({ slug: "legendary-actions", name: "Legendary Actions", type: "feat", img: "icons/magic/light/explosion-star-glow-silhouette.webp", system: { description: { value: `<p>It can take ${legendary} legendary action${legendary > 1 ? "s" : ""}, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. It regains spent legendary actions at the start of its turn.</p><ul>${weapons.slice(0, 2).map(w => { const n = convertText(w.name); return `<li><strong>${n}.</strong> It makes one ${n} attack.</li>`; }).join("")}<li><strong>Move.</strong> It moves up to its speed without provoking opportunity attacks.</li></ul>` }, type: { value: "monster", subtype: "" }, uses: { max: "", spent: 0, recovery: [] }, requirements: "", prerequisites: { level: null, repeatable: false }, properties: [], activities: {}, enchant: {}, identifier: "legendary-actions" }, effects: [], flags: {} });
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
    flags: { fourththing: { rfi: { actor: rfi }, creatureType: type, kind: "monster" }, "bad-eden-5e": { reminders: reminderLines(items) } }
  };
  return actor;
}
/** The creature source is RFI canon — bbttcc-master-content/packs/_source/npcs, the lineage-flagged actors with their
 *  items embedded — like every other lane (review C40, 2026-10-31: the lane used to convert a frozen Oct-26 jsonl dump
 *  and --parity hashed that dump against itself, so 4 bosses never got a twin and 70 drifted unseen). The jsonl
 *  (conversion/sources/npcs-monsters.jsonl, refreshed with `bin/ft-dump-pack npcs`) is only a fallback when _source is
 *  absent; --parity prints its drift from canon as a warning. */
const creatureHash = (a, items) => sha(JSON.stringify({ n: a.name, s: a.system, f: a.flags?.fourththing ?? {}, i: items.map(i => [i.name, i.system, i.flags?.fourththing ?? {}]) }));
// key-order-stable twin of creatureHash for the snapshot drift line (a LevelDB dump and a _source file order their keys differently)
const stable = v => Array.isArray(v) ? `[${v.map(stable).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}` : JSON.stringify(v);
const creatureKey = (a, items) => sha(stable({ n: a.name, s: a.system, f: a.flags?.fourththing ?? {}, i: [...items.map(i => stable([i.name, i.system, i.flags?.fourththing ?? {}]))].sort() }));
function creatureSource() {
  const lineage = a => a?.flags?.fourththing?.rfi?.actor?.lineage;
  const canon = loadPack("npcs").filter(a => a.type === "npc" && lineage(a)).map(a => ({ ...a, items: a.items ?? [] }));
  const file = join(ROOT, "conversion", "sources", "npcs-monsters.jsonl");
  let snapshot = null;
  if (existsSync(file)) {
    const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
    const itemsOf = id => rows.filter(r => r.k.startsWith(`!actors.items!${id}.`)).map(r => r.v);
    snapshot = rows.filter(r => r.k.startsWith("!actors!")).map(r => r.v).filter(lineage).map(a => ({ ...a, items: itemsOf(a._id) }));
  }
  if (canon.length) return { actors: canon, from: "_source/npcs", snapshot };
  if (snapshot) { console.warn("creatures: _source/npcs is absent — converting the jsonl snapshot (fallback; refresh it with bin/ft-dump-pack npcs)"); return { actors: snapshot, from: "snapshot", snapshot }; }
  throw new Error("creatures: no RFI source — neither packs/_source/npcs nor conversion/sources/npcs-monsters.jsonl");
}
function laneCreatures() {
  const { actors, snapshot } = creatureSource();
  const out = [], needsAll = [];
  for (const a of actors.sort((x, y) => x.name.localeCompare(y.name))) {
    const needs = [], items = a.items;
    const e = convertMonster(a, items, needs);
    for (const it of e.items) {
      const prose = it.system?.description?.value ?? "";
      for (const l of leftovers(prose)) needs.push(`"${it.name}": leftover term "${l}"`);
    }
    for (const l of leftovers(e.system.details.biography.value)) needs.push(`biography: leftover term "${l}"`);
    e.flags["bad-eden-5e"] = { ...(e.flags["bad-eden-5e"] ?? {}), rfi: { id: a._id, pack: "npcs", identifier: a.name, hash: creatureHash(a, items) } };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src: actors, out, needsAll, kind: "actors", snapshot };
}

/* ── secrets / callings / sparks lanes (2026-10-08): the RFI-only packs the D&D overlay used to drop ── */
// Loaders for packs outside master-content: the _source tree of another module (paths relative to modules/).
const loadModulePack = (rel) => walk(join(ROOT, "..", rel)).map(f => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } }).filter(d => d && d._id && d.type && !String(d._key ?? "").startsWith("!folders"));
const slugOf = (prefix, name) => prefix + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rfiFlag = (d, pack, extra = {}) => ({ id: d._id, pack, identifier: d.system?.identifier ?? d.flags?.["bbttcc-tikkun"]?.identifier ?? "", hash: sha(JSON.stringify({ n: d.name, s: d.system, f: d.flags ?? {}, ...extra })) });
// The RFI sheet's per-use ability card (<div data-ft-per-use …>: "⟁ Per-Use Ability — Name" / Recovery · Action ·
// "Use: Click this feature on your sheet to invoke." / effect) is fourththing UI — dnd5e has no such button.
// Flatten it to prose: name, recovery and action kept (a Strategic Turn is faction cadence on both systems), the click line dropped.
function flattenPerUseCards(html) {
  const strip = s => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return html.replace(/<div[^>]*data-ft-per-use=[^>]*>([\s\S]*?<\/div>)\s*<\/div>/g, (_, inner) => {
    const rows = [...inner.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/g)].map(m => strip(m[1]));
    const name = (rows[0] ?? "").replace(/^⟁?\s*Per-Use Ability\s*[—–-]\s*/i, "");
    const meta = (rows[1] ?? "").replace(/\s*·\s*Use:.*$/i, "");
    const effect = rows[2] ?? "";
    return `<p><strong>${name || "Per-use ability"}</strong>${meta ? ` <em>(${meta})</em>` : ""}${effect ? ` — ${effect}` : ""}</p>`;
  });
}
const featItem = (d, slug, folder, needs) => {
  const html = convertText(flattenPerUseCards(d.system?.description?.value ?? ""));
  for (const l of leftovers(html)) needs.push(`leftover term "${l}"`);
  return { slug, name: d.name, type: "feat", img: d.img && !/fourththing/.test(d.img) ? d.img : "icons/svg/book.svg", folder,
    system: { description: { value: html, chat: "" }, type: { value: "", subtype: "" }, requirements: "", properties: [], uses: { max: "", spent: 0, recovery: [] }, identifier: slug },
    effects: [], flags: {} };
};

// Courtly secrets (bbttcc-master-content.courtly-secrets) → dnd5e feats. The secret's engine block
// (flags.bbttcc-raid.secret: effectKey / acquisition) is carried verbatim — the Courtly engine reads it on both systems.
function laneSecrets() {
  const src = loadPack("courtly-secrets").filter(d => d.type === "feat");
  const out = [], needsAll = [];
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = []; const e = featItem(d, slugOf("secret-", d.name), "Courtly Secrets", needs);
    e.flags = { "bbttcc-raid": JSON.parse(JSON.stringify(d.flags?.["bbttcc-raid"] ?? {})), "bad-eden-5e": { rfi: rfiFlag(d, "courtly-secrets") } };
    if (!d.flags?.["bbttcc-raid"]?.secret?.effectKey) needs.push("no secret effectKey");
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "items" };
}

// NPC callings (bbttcc-character-options.npc-callings) → dnd5e feats (dnd5e NPCs don't take classes). The calling
// rows (category "calling", flags.fourththing.calling {key, tier}) and the 6 calling "class" headers both become feats;
// the npc-builder reads flags + name, which carry over.
function laneCallings() {
  const src = loadModulePack("bbttcc-character-options/packs/_source/npc-callings").filter(d => ["class", "feature"].includes(d.type));
  const out = [], needsAll = [];
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = [];
    // The "Aptitude kit" through the rubric's rank rule (rank 1 = proficient, rank 2+ = expertise — the creature lane's rule):
    // signature skill rank = tier → proficient at Tier I, expertise from Tier II; secondary rank = tier − 1 → proficient at Tier II, expertise from Tier III.
    const kit = (html) => html
      .replace(/Aptitude kit/g, "Skill kit")
      .replace(/signature aptitude(<\/?[a-z]+>|\s)*([A-Z][a-z]+)(<\/?[a-z]+>|\s)*rank = tier/g, (_, a1, sk) => skillOf(sk)?.kind === "attack" ? `signature: <strong>${skillText(sk)}</strong> (proficient)` : `signature skill <strong>${skillText(sk)}</strong>: proficient at Tier I, expertise from Tier II`)
      .replace(/secondary(<\/?[a-z]+>|\s)*([A-Z][a-z]+)(<\/?[a-z]+>|\s)*rank = tier\s*[−-]\s*1/g, (_, a1, sk) => skillOf(sk)?.kind === "attack" ? `secondary: <strong>${skillText(sk)}</strong> (proficient)` : `secondary <strong>${skillText(sk)}</strong>: proficient from Tier II, expertise from Tier III`)
      .replace(/count Trained \(rank 1\) in one (\w+) aptitude/g, (_, ab) => `count as proficient in one ${ab} skill`);
    const d2 = { ...d, system: { ...d.system, description: { ...(d.system?.description ?? {}), value: kit(d.system?.description?.value ?? "") } } };
    const e = featItem(d2, slugOf("calling-", d.name), "NPC Callings", needs);
    e.system.type = { value: "monster", subtype: "" };
    e.flags = { fourththing: JSON.parse(JSON.stringify(d.flags?.fourththing ?? {})), "bbttcc-character-options": { rfiType: d.type, category: d.system?.category ?? "calling", tags: d.system?.tags ?? [] }, "bad-eden-5e": { rfi: rfiFlag(d, "npc-callings") } };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "items" };
}

// Sparks (bbttcc-tikkun.sparks, authored in bbttcc-tikkun/packs-source/sparks) → dnd5e loot. dnd5e has no `spark`
// item type and its data model strips unknown system keys, so the whole RFI spark block (sephirah, kind,
// aligned/misalignedMethods, repair) rides at flags.bbttcc-tikkun.spark; the Tikkun API reads either place.
function laneSparks() {
  const src = walk(join(ROOT, "..", "bbttcc-tikkun", "packs-source", "sparks")).filter(f => f.endsWith(".json")).map(f => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } }).filter(d => d && d.type === "spark");
  const out = [], needsAll = [];
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = []; const ident = d.flags?.["bbttcc-tikkun"]?.identifier ?? d._id;
    const html = convertText(d.system?.description?.value ?? "");
    const { description, ...spark } = JSON.parse(JSON.stringify(d.system ?? {}));
    const e = { slug: LEGACY_SLUG(slugOf("spark-", ident.replace(/^spark_/, "").replace(/_/g, "-"))), name: d.name, type: "loot", img: d.img ?? "icons/magic/light/orb-lightbulb-gray.webp", folder: "Sparks",
      system: { description: { value: html, chat: "" }, type: { value: "treasure", subtype: "" }, quantity: 1, weight: { value: 0, units: "lb" }, price: { value: 0, denomination: "gp" }, rarity: "rare", identifier: ident },
      effects: [],
      flags: { "bbttcc-tikkun": { ...(d.flags?.["bbttcc-tikkun"] ?? {}), spark }, "bad-eden-5e": { rfi: { id: d._id ?? ident, pack: "sparks", identifier: ident, hash: sha(JSON.stringify({ n: d.name, s: d.system, f: d.flags ?? {} })) } } } };
    if (!spark.sephirah) needs.push("no sephirah");
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "items" };
}

/* ── character options + doctrines lanes (2026-10-11): the twins a D&D world on Ember needs ──
 * The six bbttcc-character-options packs are declared `system: fourththing`, so dnd5e never registers them —
 * but their documents are already plain feats carrying `flags.bbttcc-character-options` (category / bonuses /
 * option.{category,key,…}), which the sorting engine, the character wizard and the character-options module
 * read on both systems. So the conversion is near-identity: name, img, prose and the flag carried verbatim.
 * Source = conversion/sources/character-options/<pack>/ — the live LevelDB (packs/<pack>/<pack>/, the `.db`
 * manifest path resolves to the NESTED dir) unpacked with `fvtt package unpack`; Ember ≡ repo on 2026-10-11
 * (132 / 72 / 6 / 60 / 13 / 10 records). Refresh: copy the nested dir aside, drop LOCK, unpack into the lane dir. */
const OPTION_LANES = {
  archetypes: { pack: "character-archetypes", prefix: "archetype-", folder: "Character Archetypes" },
  crew: { pack: "crew-types", prefix: "crew-", folder: "Crew Types" },
  enlightenment: { pack: "enlightenment-levels", prefix: "enlightenment-", folder: "Enlightenment Levels" },
  occult: { pack: "occult-associations", prefix: "occult-", folder: "Occult Associations" },
  political: { pack: "political-affiliations", prefix: "political-", folder: "Political Affiliations" },
  alignments: { pack: "sephirothic-alignments", prefix: "alignment-", folder: "Sephirothic Alignments" }
};
const parseJson = f => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } };
const folderNames = docs => new Map(docs.filter(d => String(d._key ?? "").startsWith("!folders!")).map(d => [d._id, d.name]));
// slugs are unique inside a pack: the RFI identifier when the doc has one, else the name; a collision gets the RFI id tacked on
const uniqueSlug = (taken, want, d, needs) => {
  let s = want;
  if (taken.has(s)) { s = `${want}-${String(d._id).slice(0, 4).toLowerCase()}`; needs.push(`duplicate slug "${want}" → "${s}"`); }
  taken.add(s); return s;
};

function laneOptions(key) {
  const { pack, prefix, folder } = OPTION_LANES[key];
  const all = walk(join(ROOT, "conversion", "sources", "character-options", pack)).map(parseJson).filter(d => d && d._id);
  const names = folderNames(all);
  const src = all.filter(d => d.type === "feat");
  const out = [], needsAll = [], taken = new Set();
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = [];
    const slug = uniqueSlug(taken, d.system?.identifier ? slugOf("", d.system.identifier) : slugOf(prefix, d.name), d, needs);
    const e = featItem(d, slug, names.get(d.folder) ?? folder, needs);
    const co = JSON.parse(JSON.stringify(d.flags?.["bbttcc-character-options"] ?? {}));
    if (!Object.keys(co).length) needs.push("no bbttcc-character-options flag (the pickers key on option.category/key)");
    e.flags = { "bbttcc-character-options": co, "bad-eden-5e": { rfi: rfiFlag(d, pack) } };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "items" };
}

// Doctrines (bbttcc-master-content.doctrines) → dnd5e feats. The factions module keys the compendium by
// flags.bbttcc.{kind,key} (name + img for display; embedded faction items stay entitlement wrappers) — carried verbatim.
function laneDoctrines() {
  const all = walk(join(SRC, "doctrines")).map(parseJson).filter(d => d && d._id);
  const names = folderNames(all);
  const src = all.filter(d => d.type === "feat");
  const out = [], needsAll = [], taken = new Set();
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = [], b = d.flags?.bbttcc ?? {};
    const slug = uniqueSlug(taken, slugOf("doctrine-", b.key || d.name), d, needs);
    const e = featItem(d, slug, names.get(d.folder) ?? "Doctrines", needs);
    if (!b.kind || !b.key) needs.push("no flags.bbttcc kind/key (the factions module can't match it to an entitlement)");
    e.flags = { bbttcc: JSON.parse(JSON.stringify(b)), "bad-eden-5e": { rfi: rfiFlag(d, "doctrines") } };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "items" };
}

// Rigs (bbttcc-master-content.vehicles: the five faction rigs) → dnd5e vehicles carrying the June flag layer
// `flags.bbttcc-factions.rig` — the shape game.bbttcc.rigs.create() writes on dnd5e (bbttcc-core/scripts/rigs.js):
// identity / crew / travel / output / tags → the flag, Integrity → hp (dt by bracket), defenses → traits through
// the rubric damage map. Rig gear keeps `flags.fourththing.rigGear / rigFrame` verbatim (rigs.gearOf reads that
// scope on either system); weapons and gear go through the gear lane's converters so they're real dnd5e items.
const DT_BY_BRACKET = RIG_DT_BY_BRACKET;   // one table, bbttcc-core/scripts/economy.constants.js (C47 2026-10-31)
function laneRigs() {
  const src = loadPack("vehicles").filter(d => d.type === "rig");
  const out = [], needsAll = [];
  for (const a of src.sort((x, y) => x.name.localeCompare(y.name))) {
    const needs = [], s = a.system ?? {}, integ = s.integrity ?? {}, bracket = integ.bracket ?? "medium";
    if (!(bracket in DT_BY_BRACKET)) needs.push(`unknown bracket "${bracket}"`);
    const rig = { mobility: s.identity?.mobility ?? "mobile", state: "parked", factionOwnerId: "", archetype: s.identity?.archetype ?? "",
      binding: { hexId: "", sceneId: "", tokenId: "" }, tier: Number(integ.tier ?? 1), bracket,
      crew: { slots: [], capacity: s.crew?.capacity ?? {}, crewMin: Number(s.crew?.crewMin ?? 1), crewMax: Number(s.crew?.crewMax ?? 8) },
      output: { modules: s.output?.modules ?? [], basePerTurn: s.output?.basePerTurn ?? {} }, travel: { ...(s.travel ?? {}) }, order: "none", tags: s.tags ?? [] };
    const traits = {}, ci = (s.conditionImmunities ?? []).map(conditionWord).filter(Boolean);
    for (const [k, kind] of [["resistances", "dr"], ["immunities", "di"], ["vulnerabilities", "dv"]]) {
      // C47: "fear" in an RFI immunity list is the frightened condition, not a damage type
      const { damage, conditions } = splitDefenses(s.defenses?.[k] ?? []);
      const v = resistanceTypes(damage); if (v.length) traits[kind] = { value: v, custom: "" };
      if (kind === "di") ci.push(...conditions); else if (conditions.length) needs.push(`${k}: "${conditions.join(", ")}" is a condition, not a damage type — dropped`);
    }
    if (ci.length) traits.ci = { value: [...new Set(ci)], custom: "" };
    const domains = (s.travel?.domains ?? []).map(String);
    // the same rule as bbttcc-core rigs.js: no land domain → space (dnd5e 6 has the native type) / air / water
    const vehicleType = domains.length && !domains.includes("land") ? (domains.some(d => /space|orbit/.test(d)) ? "space" : domains.some(d => /air|sky/.test(d)) ? "air" : "water") : "land";
    const items = (a.items ?? []).map(it => {
      const e = it.type === "weapon" ? convertWeapon(it, needs) : convertGear(it, needs, "");
      e.flags = { ...(e.flags ?? {}), fourththing: JSON.parse(JSON.stringify(it.flags?.fourththing ?? {})) };
      return e;
    });
    const bio = convertText(s.description?.value ?? s.details?.biography?.value ?? "");
    for (const l of leftovers(bio)) needs.push(`biography: leftover term "${l}"`);
    const flags = { "bbttcc-factions": { rig, factionId: null }, "bad-eden-5e": { rfi: rfiFlag(a, "vehicles") } };
    if (a.flags?.fourththing?.rfi) flags.fourththing = { rfi: JSON.parse(JSON.stringify(a.flags.fourththing.rfi)) };
    const e = { slug: slugOf("rig-", a.name), name: a.name, type: "vehicle", img: a.img, folder: "Rigs", prototypeToken: a.prototypeToken,
      // C47: a dnd5e vehicle's AC is flat and unset = 0 — the same tiered AC-by-bracket the in-world builder mints (economy.constants rigAcFor)
      system: { vehicleType, attributes: { hp: { value: Number(integ.value ?? integ.max ?? 30), max: Number(integ.max ?? 30), dt: DT_BY_BRACKET[bracket] ?? 0, mt: null }, ac: { flat: rigAcFor(bracket, rig.tier), calc: "flat", formula: "" } }, traits, details: { biography: { value: bio } } },
      items, effects: [], flags };
    out.push(e); if (needs.length) needsAll.push({ slug: e.slug, name: e.name, needs });
  }
  return { src, out, needsAll, kind: "actors" };
}

/* ── overrides + output ──────────────────────────────────────────────────── */
const deepMerge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? deepMerge(a[k], v) : v; return a; };

function writeLane(name, features, needsAll, about, kind = "features") {
  const ovPath = join(ROOT, "content", "overrides", `${name}.json`);
  const overrides = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, "utf8")) : {};
  let applied = 0;
  for (const f of features) if (overrides[f.slug]) { deepMerge(f, overrides[f.slug]); applied++; }
  const PACK = { manifestations: "spells", secrets: "courtly-secrets", callings: "npc-callings", sparks: "sparks", doctrines: "doctrines", rigs: "vehicles",
    ...Object.fromEntries(Object.entries(OPTION_LANES).map(([k, v]) => [k, v.pack])) };   // build-packs routes items/actors by _pack
  const doc = { _about: about, ...(PACK[name] ? { _pack: PACK[name] } : {}), _generated: { by: "tools/convert-5e.mjs", rubric: RUBRIC.version, at: new Date().toISOString().slice(0, 10), overridesApplied: applied }, [kind]: features };
  const outPath = join(ROOT, "content", `${name}.json`);
  writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
  mkdirSync(join(ROOT, "content", "_needs-human"), { recursive: true });
  const md = [`# ${name}: needs a human (${needsAll.length} of ${features.length})`, "", `Generated by tools/convert-5e.mjs with rubric v${RUBRIC.version}. Fix by editing content/overrides/${name}.json (keyed by slug), never the generated file.`, ""];
  for (const n of needsAll) { md.push(`## ${n.name} (\`${n.slug}\`)`); for (const x of n.needs) md.push(`- ${x}`); md.push(""); }
  writeFileSync(join(ROOT, "content", "_needs-human", `${name}.md`), md.join("\n"));
  return { outPath, applied };
}

function parity(name, src, features, kind = "features", extra = {}) {
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
  // creatures: how far the fallback snapshot sits from canon (a warning — the lane converts canon)
  if (extra.snapshot) {
    const canon = new Map(src.map(a => [a._id, creatureKey(a, a.items ?? [])])), snap = new Map(extra.snapshot.map(a => [a._id, creatureKey(a, a.items ?? [])]));
    const liveOnly = extra.snapshot.filter(a => !canon.has(a._id)).map(a => a.name), canonOnly = src.filter(a => !snap.has(a._id)).map(a => a.name), drift = src.filter(a => snap.has(a._id) && snap.get(a._id) !== canon.get(a._id)).map(a => a.name);
    const notes = [...liveOnly.map(n => `snapshot-only ${n}`), ...canonOnly.map(n => `canon-only ${n}`), ...drift.map(n => `drifted ${n}`)];
    console.log(`  snapshot (conversion/sources/npcs-monsters.jsonl, fallback only): ${liveOnly.length} snapshot-only · ${canonOnly.length} canon-only · ${drift.length} drifted${notes.length ? ` — ${notes.join(", ")}` : ""}`);
  }
}

/* ── manifestations → dnd5e spells (2026-10-31, Dave: "keep it trad … convert them to 5E effects and terminology and
 * level, and add them to the spell lists … limit some of them by path") ──────────────────────────────────────────────
 * The 76 starter-kit manifestations (master-content items, type power, category manifestation) become ordinary
 * slot spells (method "spell") in pack `spells`. Mechanics are rebuilt from the structured manifestation block, not
 * the RFI sentence: function → school, "X defense vs Cast DC" → saving throw, appliedStates → conditions through the
 * rubric, appliedEffects modifiers → an Active Effect (Guard/Evasion → AC, Resolve → Wis+Cha saves, Initiative),
 * squares → feet, scene → concentration up to 1 minute, upkeep folded into concentration. Level: 1st; an area that
 * imposes a condition or deals damage is 2nd. Doctrine signatures carry flags.bad-eden-5e.requiresPath (sheet guard);
 * Path-core spells are open. `classes` = the spell lists each joins (build-packs writes the spell-list pages).
 * Prose = Dave's concept line (italic) + the generated 5E mechanics + Mal's line. */
const MANIF_PATH = { "wyrdlens-adept": "wyrdlens", cosmic_linguist: "linguist", pactkeeper: "pactkeeper", dreamwalker: "dreamwalker",
  harmonymarshal: "harmony", shadow_courier: "courier", bulwark: "bulwark", "soul-smith": "soulsmith", aurablade: "aurablade" };
const MANIF_PATH_NAME = { wyrdlens: "Wyrdlens Adept", linguist: "Cosmic Linguist", pactkeeper: "Pactkeeper", dreamwalker: "Dreamwalker",
  harmony: "Harmony Marshal", courier: "Shadow Courier", bulwark: "Bulwark", soulsmith: "Soul-Smith", aurablade: "Aurablade" };
// which SRD class lists each Path's manifestations join (Wizard reaches Eldritch Knights and Arcane Tricksters)
const MANIF_CLASSES = { wyrdlens: ["wizard", "sorcerer", "bard"], linguist: ["wizard", "bard", "warlock"], pactkeeper: ["warlock", "cleric", "paladin"],
  dreamwalker: ["sorcerer", "warlock", "bard", "druid"], harmony: ["bard", "paladin", "cleric"], courier: ["wizard", "ranger", "bard"],
  bulwark: ["paladin", "cleric"], soulsmith: ["wizard", "cleric"], aurablade: ["paladin", "ranger", "sorcerer"] };
const MANIF_SCHOOL = { protect: "abj", harm: "evo", command: "enc", bind: "enc", reveal: "div", move: "con", transform: "trs", repair: "abj", heal: "abj" };
const MANIF_SAVE = { soul: "wis", mind: "int", body: "con", evasion: "dex", resolve: "wis" };
const MANIF_SAVE_NAME = { wis: "Wisdom", int: "Intelligence", con: "Constitution", dex: "Dexterity" };
const MANIF_DMG = { psychic: "psychic", electrical: "lightning", kinetic: "force", thermal: "fire", chemical: "acid", poison: "poison", energy: "lightning", sephirotic: "sephirotic", qliphothic: "qliphothic" };
const MANIF_COND = { shaken: { status: "frightened", text: "frightened" }, calmed: { status: "charmed", text: "charmed (it can't willingly take violent action)" },
  compelled: { status: "charmed", text: "charmed, and it must spend its action each turn on what the spell demands" },
  restrained: { status: "restrained", text: "restrained" }, charmed: { status: "charmed", text: "charmed" },
  prone: { status: "prone", text: "knocked prone" }, blinded: { status: "blinded", text: "blinded" },
  // C42 (2026-10-31): the same Staggered the creature lane applies — status be5e-staggered (scripts/riders.js) + speed ×½, −2 to attacks
  staggered: { status: "be5e-staggered", text: "Staggered: its speed is halved and it has a −2 penalty to attack rolls",
    changes: [{ key: "system.attributes.movement.walk", mode: 1, value: "0.5", priority: 20 }, { key: "system.bonuses.mwak.attack", mode: 2, value: "-2", priority: 20 }, { key: "system.bonuses.rwak.attack", mode: 2, value: "-2", priority: 20 }] } };
function laneManifestations() {
  const src = loadPack("items").filter(d => d.type === "power" && (d.system?.category === "manifestation" || d.system?.manifestation));
  const out = [], needsAll = [], taken = new Set();
  const sentence = s => String(s ?? "").trim().replace(/^(.)/, c => c.toUpperCase()).replace(/([^.!?])$/, "$1.");
  for (const d of src.sort((a, b) => a.name.localeCompare(b.name))) {
    const needs = [], S = d.system ?? {}, M = S.manifestation ?? {}, tags = S.tags ?? [];
    const rfiPath = (tags.find(t => t.startsWith("path:")) ?? "").slice(5);
    const pathKey = MANIF_PATH[rfiPath] ?? "";
    if (!pathKey) needs.push(`unknown path tag "${rfiPath}"`);
    const signature = tags.includes("doctrine-signature");
    const slug = uniqueSlug(taken, slugOf("manifest-", d.name), d, needs);
    const effectTxt = String(S.effect ?? "");
    const fn = M.function ?? "protect";
    const school = MANIF_SCHOOL[fn] ?? "abj";
    const self = S.target === "self" || /^(Self|Sustained vestment \(self\)|Sustained self)/i.test(effectTxt);
    const allyOrSelf = /\(or yourself\)|Self or one ally|or one touched ally/i.test(effectTxt);
    const area = M.area?.shape && M.area.shape !== "none" ? { type: M.area.shape === "cone" ? "cone" : "sphere", size: Number(M.area.size) || 15 } : null;
    const near = /within 3 squares/i.test(effectTxt) ? 15 : 30;
    const touch = /touched ally|touch/i.test(effectTxt) && !/within/i.test(effectTxt);
    const eachRound0 = /each round|re-saving each round|until they save/i.test(effectTxt) || !!(M.appliedStates ?? {}).saveEachRound;
    // a held condition with a repeat save is a Hold Person shape: concentration, up to 1 minute
    const sustained = M.duration === "scene" || M.stability === "sustained" || (eachRound0 && ((M.appliedStates ?? {}).states ?? []).length > 0);
    const forScene = /for the scene/i.test(effectTxt);
    const lasting = M.duration === "persistent" || M.stability === "bound" || M.stability === "enduring";
    const st = M.appliedStates ?? {};
    const states = (st.states ?? []).filter(Boolean);
    let saveAb = MANIF_SAVE[String(st.saveAttribute ?? (effectTxt.match(/\b(Soul|Mind|Body)\b defense/i)?.[1] ?? "")).toLowerCase()] ?? (states.length ? "wis" : "");
    const eachRound = /each round|re-saving each round|until they save/i.test(effectTxt) || !!st.saveEachRound;
    const DR = S.damageRoll ?? {};
    const dmg = DR.op === "damage" && Number(DR.number) > 0 ? { number: Number(DR.number), denomination: Number(String(DR.die ?? "d6").replace("d", "")) || 6, types: [MANIF_DMG[DR.type] ?? MANIF_DMG[S.damageType] ?? "force"] } : null;
    const mods = M.appliedEffects?.modifiers ?? [];
    const level = area && (states.length || dmg) ? 2 : 1;
    // ── the effect on the target(s)
    const changes = [];
    let buffBits = [];
    for (const m of mods) {
      const v = (m.op === "-" ? -1 : 1) * Number(m.value || 0);
      const sg = v >= 0 ? `+${v}` : `${v}`;
      if (m.stat === "guard" || m.stat === "evasion") { changes.push({ key: "system.attributes.ac.bonus", mode: 2, value: sg, priority: 20 }); buffBits.push(`${sg} ${v >= 0 ? "bonus" : "penalty"} to AC`); }
      else if (m.stat === "resolve") { changes.push({ key: "system.abilities.wis.bonuses.save", mode: 2, value: sg, priority: 20 }, { key: "system.abilities.cha.bonuses.save", mode: 2, value: sg, priority: 20 }); buffBits.push(`${sg} ${v >= 0 ? "bonus" : "penalty"} to Wisdom and Charisma saving throws`); }
      else if (m.stat === "initiative") { changes.push({ key: "system.attributes.init.bonus", mode: 2, value: sg, priority: 20 }); buffBits.push(`${sg} to initiative`); }
      else needs.push(`modifier on "${m.stat}" not mapped`);
    }
    // merge "+1 AC" twice (Guard +1 and Evasion +1) into one line
    const acSum = changes.filter(c => c.key === "system.attributes.ac.bonus").reduce((a, c) => a + Number(c.value), 0);
    if (changes.filter(c => c.key === "system.attributes.ac.bonus").length > 1) {
      const rest = changes.filter(c => c.key !== "system.attributes.ac.bonus");
      changes.length = 0; changes.push({ key: "system.attributes.ac.bonus", mode: 2, value: acSum >= 0 ? `+${acSum}` : `${acSum}`, priority: 20 }, ...rest);
      buffBits = [`${acSum >= 0 ? "+" + acSum : acSum} ${acSum >= 0 ? "bonus" : "penalty"} to AC`, ...buffBits.filter(b => !/to AC$/.test(b))];
    }
    const conds = states.map(c => MANIF_COND[String(c).toLowerCase()]).filter(Boolean);
    for (const c of states) if (!MANIF_COND[String(c).toLowerCase()]) needs.push(`state "${c}" not mapped`);
    const statuses = [...new Set(conds.map(c => c.status).filter(Boolean))];
    for (const c of conds) for (const ch of c.changes ?? []) if (!changes.some(x => x.key === ch.key)) changes.push({ ...ch });
    // C50 (ruled 2026-10-31): a damage-only harm never auto-hits — "vs Evasion" in the RFI sentence → a spell attack; otherwise a
    // save from the lane's defense table (the named defense, else Dexterity for Integrity-track damage, Wisdom for Stress-track),
    // half damage on a success, and the rider (−2 AC / −2 saves) only lands on a hit or a failed save.
    const attackSpell = !!dmg && !states.length && !saveAb && /\bvs\.? Evasion\b|\bEvasion (defense|check|save)/i.test(effectTxt);
    if (dmg && !states.length && !saveAb && !attackSpell) saveAb = MANIF_SAVE[String(effectTxt.match(/\b(Soul|Mind|Body|Resolve)\b (defense|check)/i)?.[1] ?? "").toLowerCase()] ?? ((DR.track === "stress" || dmg.types[0] === "psychic") ? "wis" : "dex");
    const durRounds = /for 1 round/i.test(effectTxt) && !eachRound && !forScene ? 1 : null;
    const effects = [];
    if (changes.length || statuses.length || conds.length) {
      const seconds = durRounds ? 6 : (sustained ? 60 : lasting ? 3600 : 60);
      effects.push({ name: d.name, img: d.img, transfer: false, disabled: false, statuses,
        changes, duration: { seconds, ...(durRounds ? { rounds: 1 } : {}) }, description: "", flags: { "bad-eden-5e": { manifestation: slug } } });
    }
    // ── the activity
    const debuff = mods.some(m => m.op === "-");
    const activity = attackSpell ? "attack" : saveAb && (states.length || dmg) ? "save" : dmg ? "damage" : fn === "heal" ? "heal" : "utility";
    // ── 5E prose
    const who = area ? (area.type === "cone" ? `Each creature in a ${area.size}-foot cone` : `Each creature of your choice in a ${area.size}-foot-radius sphere centered on a point within range`)
      : self && !allyOrSelf ? "You" : allyOrSelf ? "You or one ally within range" : (fn === "protect" || fn === "repair") && !debuff ? "One ally within range" : "One creature you can see within range";
    const lines = [];
    if (activity === "save") {
      const lasting1 = conds.every(c => c.status === "prone") ? "" : (durRounds ? " until the end of its next turn" : " for the duration");
      const onFail = [dmg ? `takes ${dmg.number}d${dmg.denomination} ${dmg.types[0]} damage` : "", conds.length ? `is ${conds.map(c => c.text).join(" and ")}${lasting1}` : ""].filter(Boolean).join(" and ");
      const an = /^[AEIOU]/.test(MANIF_SAVE_NAME[saveAb]) ? "an" : "a";
      lines.push(`${who} must make ${an} ${MANIF_SAVE_NAME[saveAb]} saving throw. On a failed save, it ${onFail}.` + (dmg && (conds.length || changes.length) ? " On a successful save, it takes half as much damage and suffers no other effect." : dmg ? " On a successful save, it takes half as much damage." : ""));
      if (eachRound && conds.length) lines.push("At the end of each of its turns, an affected creature repeats the saving throw, ending the effect on itself on a success.");
    } else if (activity === "attack") {
      lines.push(`Make a ranged spell attack against ${who === "You" ? "one creature you can see within range" : who.replace(/^One/, "one")}. On a hit, the target takes ${dmg.number}d${dmg.denomination} ${dmg.types[0]} damage.`);
    } else if (activity === "damage") {
      lines.push(`${who === "You" ? "One creature you can see within range" : who} takes ${dmg.number}d${dmg.denomination} ${dmg.types[0]} damage.`);
    }
    if (buffBits.length) {
      const subj = activity === "save" ? "On a failed save, the target also has" : activity === "attack" ? "On a hit, the target also has" : activity === "damage" ? "The target also has" : who === "You" ? "You gain" : `${who} ${area ? "gains" : "gains"}`;
      lines.push(`${subj} a ${buffBits.join(", ")} for the duration.`.replace(/^(.+?) gains a/, "$1 gains a").replace("a +", "a +").replace(" a -", " a −"));
    }
    if (!lines.length) { lines.push(sentence(convertText(effectTxt))); needs.push("no structured mechanics — 5E text is the rubric-converted RFI sentence; read it"); }
    // flavour clauses Dave wrote after the mechanics ("as the neighborhood arrives") stay in the concept line
    const concept = String(M.concept ?? "").trim();
    const mal = String(S.flavor ?? "").replace(/^Mal:\s*/, "").trim();
    const pathLine = signature
      ? `<p><strong>Path of the ${MANIF_PATH_NAME[pathKey]} only.</strong> This is a Doctrine signature; only a character who walks the Path of the ${MANIF_PATH_NAME[pathKey]} can learn or prepare it.</p>`
      : `<p><em>From the Path of the ${MANIF_PATH_NAME[pathKey]}.</em></p>`;
    const description = (concept ? `<p><em>${concept}</em></p>` : "") + lines.map(l => `<p>${l}</p>`).join("") + pathLine + (mal ? `<p><em>Mal:</em> ${mal}</p>` : "");
    for (const l of leftovers(description)) needs.push(`leftover term "${l}"`);
    const range = (self && !allyOrSelf && !area) || area?.type === "cone" ? null : touch ? { units: "touch" } : { value: near };
    const e = {
      slug, name: d.name, img: d.img, level, school, method: "spell", activation: "action",
      ...(range ? { range } : {}),
      target: area ? { template: { type: area.type === "cone" ? "cone" : "sphere", size: area.size } } : self && !allyOrSelf ? { type: "self" } : { type: "creature", count: 1 },
      // "for the scene" on an instant cast (a buff that simply lasts) → 1 minute without concentration
      duration: sustained || (forScene && !lasting) ? { value: "1", units: "minute" } : lasting ? { value: "1", units: "hour" } : durRounds ? { value: "1", units: "round" } : { units: "inst" },
      concentration: sustained,
      activity, ...(activity === "save" ? { save: { ability: saveAb, onSave: dmg ? "half" : "none" } } : {}), ...(activity === "attack" ? { attack: { type: touch ? "melee" : "ranged" } } : {}),
      ...(dmg ? { damage: [dmg] } : {}),
      effects, linkEffects: true, classes: MANIF_CLASSES[pathKey] ?? [],
      description,
      flags: { "bad-eden-5e": { rfi: rfiFlag(d, "items"), manifestation: { path: pathKey, signature }, ...(signature ? { requiresPath: pathKey } : {}) } }
    };
    out.push(e); if (needs.length) needsAll.push({ slug, name: d.name, needs });
  }
  return { src, out, needsAll, kind: "spells" };
}

/* ── main ────────────────────────────────────────────────────────────────── */
const LANES = { techniques: laneTechniques, gear: laneGear, creatures: laneCreatures, secrets: laneSecrets, callings: laneCallings, sparks: laneSparks,
  doctrines: laneDoctrines, rigs: laneRigs, manifestations: laneManifestations, ...Object.fromEntries(Object.keys(OPTION_LANES).map(k => [k, () => laneOptions(k)])) };
if (!lane || !LANES[lane]) { console.error(`usage: convert-5e.mjs <${Object.keys(LANES).join("|")}> [--write] [--parity]`); process.exit(2); }
const { src, out, needsAll, kind = "features", snapshot } = LANES[lane]();
if (flag("--parity")) { parity(lane, src, out, kind, { snapshot }); }
else if (flag("--write")) {
  const ABOUT = { techniques: "The 75 Bad Eden Core techniques as dnd5e feats.", gear: "Bad Eden weapons, armor, gear, wondrous items and consumables as dnd5e items (prices in marks).", secrets: "The Courtly Intrigue secrets as dnd5e feats (the secret engine block carried verbatim).", callings: "The NPC callings (trade + trick per tier) as dnd5e monster feats.", sparks: "The 30 Tikkun sparks as dnd5e loot; the RFI spark block rides at flags.bbttcc-tikkun.spark.", creatures: "The Bad Eden bestiary (the live NPC Pack's lineage-flagged monsters) as dnd5e npc actors, scored by tier and bracket through the threat chassis.",
    manifestations: "The starter-kit manifestations as ordinary dnd5e slot spells (pack spells) with the class lists they join; Doctrine signatures are Path-locked (flags.bad-eden-5e.requiresPath).",
    doctrines: "The faction doctrines as dnd5e feats (flags.bbttcc kind/key carried verbatim for the factions module).",
    rigs: "The five faction rigs as dnd5e vehicles carrying flags.bbttcc-factions.rig (the shape game.bbttcc.rigs writes on dnd5e); rig gear keeps flags.fourththing.rigGear/rigFrame.",
    ...Object.fromEntries(Object.entries(OPTION_LANES).map(([k, v]) => [k, `The ${v.folder} (bbttcc-character-options.${v.pack}) as dnd5e feats; flags.bbttcc-character-options carried verbatim for the pickers.`])) };
  const { outPath, applied } = writeLane(lane, out, needsAll, `GENERATED from RFI canon by tools/convert-5e.mjs (rubric v${RUBRIC.version}) — do not hand-edit; put fixes in content/overrides/${lane}.json. ${ABOUT[lane] ?? ""}`, kind);
  console.log(`${lane}: ${out.length} converted → ${outPath} (${applied} override(s) applied); ${needsAll.length} need a human → content/_needs-human/${lane}.md`);
} else {
  console.log(`${lane}: ${out.length} would convert; ${needsAll.length} need a human:`);
  for (const n of needsAll) console.log(`  ${n.name}: ${n.needs.join(" · ")}`);
}
