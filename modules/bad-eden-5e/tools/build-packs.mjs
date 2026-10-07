#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · build-packs.mjs — content/*.json → dnd5e documents → LevelDB packs
 * ─────────────────────────────────────────────────────────────────────────────
 * The hand-written source of truth is `content/*.json` (compact: one entry per
 * class / subclass / feature / power, prose as HTML). This expands each entry
 * into a full dnd5e 6 document, writes them to `packs/_source/<pack>/`, then
 * packs each directory with the Foundry CLI (`fvtt package pack`). Both outputs
 * are git-ignored; commit `content/`.
 *
 *   node tools/build-packs.mjs            expand + lint + pack
 *   node tools/build-packs.mjs --dry      expand + lint only (no fvtt)
 *   node tools/build-packs.mjs --no-lint  skip the leftover-term lint
 *
 * Ids are deterministic (sha1 of "<pack>:<slug>" → 16 alphanumerics), so a
 * rebuild never changes a UUID and the class ↔ feature links stay valid.
 * Every description is linted for leftover Star Wars / SW5E terms — the rules
 * text is unlicensed, so nothing of it may survive the rewrite.
 * ───────────────────────────────────────────────────────────────────────────── */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOD = "bad-eden-5e";
const CONTENT = join(ROOT, "content");
const SOURCE = join(ROOT, "packs", "_source");
const PACKS = join(ROOT, "packs");
const args = new Set(process.argv.slice(2));

/* ── ids ─────────────────────────────────────────────────────────────────── */
const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export function id(key) {
  const h = createHash("sha1").update(`${MOD}:${key}`).digest();
  let out = "";
  for (let i = 0; i < 16; i++) out += ALNUM[h[i] % ALNUM.length];
  return out;
}
const uuid = (pack, slug) => `Compendium.${MOD}.${pack}.Item.${id(`${pack}:${slug}`)}`;

/* ── the pack a kind lands in ────────────────────────────────────────────── */
const PACK_OF = { class: "classes", subclass: "subclasses", feature: "features", power: "powers" };

/* ── leftover-term lint ──────────────────────────────────────────────────── */
const BANNED = [
  /\bForce\b/, /\bthe force\b/i, /\bforce ?(point|power|cast|casting|caster|energy|sens)/i, /\btech ?(point|power|cast)/i,
  /\bJedi\b/, /\bSith\b/, /\blightsab/i, /\bblaster/i, /\bdroid/i, /\bcredits?\b/i, /\bpadawan/i, /\bholocron/i,
  /\bgalax/i, /\bhyperspace/i, /\bstarship/i, /\bRepublic\b/, /\bEmpire\b/, /\bImperial\b/,
  /\btwi'?lek/i, /\brodian/i, /\bmiraluka/i, /\bwookiee/i, /\bzabrak/i, /\btogruta/i, /\bchiss\b/i,
  /\bAshla\b/, /\bBendu\b/, /\bBogan\b/, /\blight side\b/i, /\bdark side\b/i, /\buniversal power/i,
  /\bconsular/i, /\bsentinel\b/i, /\bengineer\b/i, /\bsw5e\b/i, /Compendium\.sw5e/, /\bchapter \d+/i
];
// RFI (fourththing) vocabulary that must not survive into D&D content either — read from THE rubric
const RUBRIC = JSON.parse(readFileSync(join(ROOT, "conversion", "rubric.json"), "utf8"));
const CASED = /^\\b(Integrity|\(Violence|\(VIO|Stress damage)/;
const RFI_TERMS = RUBRIC.vocabulary.banned.map(p => new RegExp(p, CASED.test(p) ? "" : "i"));
const lintFindings = [];
/** `{{uuid:<pack>:<slug>}}` inside prose → the deterministic compendium UUID. */
const link = text => (text ?? "").replace(/\{\{uuid:([a-z]+):([a-z0-9-]+)\}\}/g, (_, p, s) => uuid(p, s));
function lint(doc, text) {
  if (!text) return;
  const plain = text.replace(/<[^>]+>/g, " ");
  for (const re of [...BANNED, ...RFI_TERMS]) {
    const m = plain.match(re);
    if (m) lintFindings.push(`${doc}: "${m[0]}"`);
  }
}

/* ── shared pieces ───────────────────────────────────────────────────────── */
const SOURCE_META = { custom: "Bad Eden", book: "", page: "", license: "", rules: "2014" };
const RECOVERY = { lr: "lr", sr: "sr", day: "day", dawn: "dawn", charges: "charges" };

function activityFor(docKey, f) {
  if (!f.activation) return {};
  const aid = id(`activity:${docKey}`);
  const hasUses = !!f.uses?.max;
  const type = f.activity ?? "utility";
  const act = {
    _id: aid, type, name: "", img: "", sort: 0,
    activation: { type: f.activation, value: f.activationCost ?? null, condition: f.condition ?? "", override: false },
    consumption: {
      targets: hasUses ? [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }] : [],
      scaling: { allowed: false, max: "" }, spellSlot: false
    },
    description: { chatFlavor: "" },
    duration: { concentration: false, value: f.duration?.value ?? "", units: f.duration?.units ?? (f.duration ? "" : "inst"), special: "", override: false },
    effects: [],
    range: f.range != null ? { value: String(f.range), units: "ft", special: "", override: false } : { units: "self", special: "", override: false },
    target: {
      template: { count: "", contiguous: false, type: "", size: "", width: "", height: "", units: "" },
      affects: { count: f.target?.count ?? "", type: f.target?.type ?? (f.range != null ? "creature" : "self"), choice: false, special: "" },
      prompt: true, override: false
    },
    uses: { spent: 0, recovery: [] },
    appliedEffects: []
  };
  if (type === "utility") act.roll = { formula: "", name: "", prompt: false, visible: false };
  if (type === "save") act.save = { ability: f.save?.ability ? [f.save.ability] : [], dc: { calculation: "spellcasting", formula: "" } };
  if (type === "attack") act.attack = { ability: "", bonus: "", critical: { threshold: null }, flat: false, type: { value: f.attack?.value ?? "ranged", classification: "spell" } };
  if (type === "save" || type === "attack" || type === "damage") act.damage = { critical: { allow: false, bonus: "" }, parts: f.damage ?? [] };
  if (type === "heal") act.healing = { custom: { enabled: true, formula: f.heal?.formula ?? "" }, number: null, denomination: 0, bonus: "", types: [f.heal?.type ?? "healing"], scaling: { mode: "", number: null } };
  return { [aid]: act };
}

function usesFor(f) {
  if (!f.uses?.max) return { max: "", spent: 0, recovery: [] };
  return { max: String(f.uses.max), spent: 0, recovery: [{ period: RECOVERY[f.uses.per] ?? f.uses.per, type: "recoverAll" }] };
}

/* ── feature ─────────────────────────────────────────────────────────────── */
function featureDoc(f, folderId) {
  const key = `features:${f.slug}`;
  lint(`feature ${f.slug}`, f.description);
  lint(`feature ${f.slug} (name)`, f.name);
  return {
    _id: id(key), name: f.name, type: "feat", img: f.img ?? "icons/magic/water/wave-water-blue.webp",
    folder: folderId ?? null, sort: (f.level ?? 0) * 100000,
    system: {
      description: { value: link(f.description), chat: "" },
      source: { ...SOURCE_META },
      uses: usesFor(f),
      type: { value: f.featType ?? "class", subtype: f.subtype ?? "" },
      requirements: f.requirements ?? "",
      prerequisites: { level: f.level ?? null, repeatable: false },
      properties: [], activities: activityFor(key, f), enchant: {}, identifier: f.slug
    },
    effects: (f.effects ?? []).map((e, i) => {
      // embedded docs need their own LevelDB key for the CLI's hierarchy walk
      const eid = /^[A-Za-z0-9]{16}$/.test(e._id ?? "") ? e._id : id(`effect:${key}:${i}`);
      return { ...e, _id: eid, _key: `!items.effects!${id(key)}.${eid}` };
    }),
    flags: { ...(f.flags ?? {}), dnd5e: { riders: { activity: [], effect: [] } } },
    _key: `!items!${id(key)}`
  };
}

/* ── power (a spell item cast through a Bad Eden tradition) ──────────────── */
const SCHOOL_TRADITION = { seph: "be5e-flow", qliph: "be5e-flow", unal: "be5e-flow", art: "be5e-artifice" };
const DAMAGE_PART = p => ({
  custom: { enabled: !!p.formula, formula: p.formula ?? "" },
  number: p.number ?? null, denomination: p.denomination ?? 0, bonus: p.bonus ?? "", types: p.types ?? [],
  scaling: { mode: p.scaling?.mode ?? "", number: p.scaling?.number ?? 1 }
});
function powerDoc(p, folderId) {
  const key = `powers:${p.slug}`;
  lint(`power ${p.slug}`, p.description);
  lint(`power ${p.slug} (name)`, p.name);
  const method = SCHOOL_TRADITION[p.school];
  if (!method) { console.error(`power ${p.slug}: unknown school "${p.school}" (seph|qliph|unal|art)`); process.exit(1); }
  const aid = id(`activity:${key}`);
  const type = p.activity ?? "utility";
  const range = p.range?.units && p.range.units !== "ft" ? { value: "", units: p.range.units, special: "" }
    : { value: p.range?.value != null ? String(p.range.value) : "", units: p.range?.value != null ? "ft" : "self", special: "" };
  const tmpl = p.target?.template ?? {};
  const target = {
    affects: { type: p.target?.type ?? (tmpl.type ? "" : (range.units === "self" ? "self" : "creature")), count: p.target?.count != null ? String(p.target.count) : "", choice: !!p.target?.choice, special: p.target?.special ?? "" },
    template: { type: tmpl.type ?? "", size: tmpl.size != null ? String(tmpl.size) : "", width: tmpl.width != null ? String(tmpl.width) : "", height: "", units: tmpl.type ? "ft" : "", count: "", contiguous: false }
  };
  const duration = { value: p.duration?.value != null ? String(p.duration.value) : "", units: p.duration?.units ?? "inst", special: "" };
  const act = {
    _id: aid, type, name: "", img: "", sort: 0,
    activation: { type: p.activation ?? "action", value: p.activationValue ?? null, condition: p.condition ?? "", override: false },
    consumption: { targets: [], scaling: { allowed: p.level > 0 && p.scaling !== "none", max: "" }, spellSlot: false },  // the engine charges points; dnd5e never touches slots
    description: { chatFlavor: "" },
    duration: { concentration: !!p.concentration, ...duration, override: false },
    effects: [], range: { ...range, override: false }, target: { ...target, prompt: true, override: false },
    uses: { spent: 0, recovery: [] }, appliedEffects: []
  };
  if (type === "utility") act.roll = { formula: p.roll ?? "", name: "", prompt: false, visible: false };
  if (type === "save") act.save = { ability: p.save?.ability ? [].concat(p.save.ability) : [], dc: { calculation: "spellcasting", formula: "" } };
  if (type === "attack") act.attack = { ability: "", bonus: "", critical: { threshold: null }, flat: false, type: { value: p.attack?.type ?? "ranged", classification: "spell" } };
  if (type === "save" || type === "attack" || type === "damage") {
    act.damage = { critical: { allow: false, bonus: "" }, parts: (p.damage ?? []).map(DAMAGE_PART) };
    if (type === "save") act.damage.onSave = p.save?.onSave ?? (p.damage?.length ? "half" : "none");
    if (type === "attack") act.damage.includeBase = false;
  }
  if (type === "heal") act.healing = { custom: { enabled: true, formula: p.heal?.formula ?? "" }, number: null, denomination: 0, bonus: "", types: [p.heal?.type ?? "healing"], scaling: { mode: p.heal?.scaling ?? "", number: 1 } };
  const properties = [];
  if (p.concentration) properties.push("concentration");
  if (p.ritual) properties.push("ritual");
  return {
    _id: id(key), name: p.name, type: "spell", img: p.img ?? "icons/magic/water/orb-water-bubbles.webp",
    folder: folderId ?? null, sort: p.level * 100000,
    system: {
      description: { value: link(p.description), chat: "" },
      source: { ...SOURCE_META },
      activation: { type: p.activation ?? "action", value: p.activationValue ?? null, condition: p.condition ?? "" },
      duration, target, range,
      uses: { max: "", spent: 0, recovery: [] },
      level: p.level, school: p.school, properties,
      materials: { value: "", consumed: false, cost: 0, supply: 0 },
      method, prepared: 1, ability: "",
      activities: { [aid]: act },
      identifier: p.slug
    },
    effects: (p.effects ?? []).map((e, i) => {
      const eid = /^[A-Za-z0-9]{16}$/.test(e._id ?? "") ? e._id : id(`effect:${key}:${i}`);
      return { ...e, _id: eid, _key: `!items.effects!${id(key)}.${eid}` };
    }),
    flags: { [MOD]: { sw5e: p.sw5e ?? "" }, dnd5e: { riders: { activity: [], effect: [] } } },
    _key: `!items!${id(key)}`
  };
}

/* ── species (a dnd5e race item: one per heritage) ───────────────────────── */
function raceDoc(r) {
  const key = `species:${r.slug}`;
  lint(`species ${r.slug}`, r.description);
  lint(`species ${r.slug} (name)`, r.name);
  const a = [];
  a.push(adv(key, "size", "Size", { configuration: { sizes: r.sizes ?? ["med"] }, value: {}, level: 0, title: "", hint: r.sizeHint ?? "" }));
  for (const [lvl, slugs] of Object.entries(r.features ?? {})) a.push(grant(key, Number(lvl), slugs, Number(lvl) === 0 ? "Traits" : `Tier ${["I", "II", "III", "IV"][[0, 5, 11, 17].indexOf(Number(lvl))] ?? lvl}`));
  for (const t of r.traits ?? []) a.push(trait(key, `trait:${t.tag}`, t.level ?? 0, t.title ?? "", t.grants ?? [], t.choices ?? []));
  const mv = r.movement ?? {};
  const se = r.senses ?? {};
  return {
    _id: id(key), name: r.name, type: "race", img: r.img, folder: null, sort: 0,
    system: {
      description: { value: link(r.description), chat: "" },
      source: { ...SOURCE_META },
      identifier: r.identifier ?? r.slug,
      advancement: a,
      movement: { walk: mv.walk ?? 30, burrow: mv.burrow ?? null, climb: mv.climb ?? null, fly: mv.fly ?? null, swim: mv.swim ?? null, units: null, hover: !!mv.hover },
      senses: { darkvision: se.darkvision ?? null, blindsight: se.blindsight ?? null, tremorsense: se.tremorsense ?? null, truesight: se.truesight ?? null, units: null, special: se.special ?? "" },
      type: { value: r.creatureType ?? "humanoid", custom: "", subtype: r.subtype ?? "" }
    },
    effects: [],
    flags: { [MOD]: { family: r.family ?? "", heritage: r.heritage ?? "" } },
    _key: `!items!${id(key)}`
  };
}

/* ── advancement helpers ─────────────────────────────────────────────────── */
const adv = (docKey, tag, type, body) => ({ _id: id(`adv:${docKey}:${tag}`), type, ...body });
const trait = (docKey, tag, level, title, grants, choices = [], extra = {}) => adv(docKey, tag, "Trait", {
  configuration: { mode: "default", allowReplacements: false, grants, choices }, value: { chosen: [] }, level, title, hint: "", ...extra
});
const grant = (docKey, level, slugs, title = "Features") => adv(docKey, `grant:${level}`, "ItemGrant", {
  configuration: { items: slugs.map(s => ({ uuid: uuid("features", s), optional: false })), optional: false,
    spell: { ability: [], preparation: "", uses: { max: "", per: "" } } },
  value: {}, level, title
});
const scale = (docKey, s) => adv(docKey, `scale:${s.identifier}`, "ScaleValue", {
  configuration: { identifier: s.identifier, type: s.type ?? "number", distance: { units: s.type === "distance" ? (s.units ?? "ft") : "" },
    scale: Object.fromEntries(Object.entries(s.scale).map(([l, v]) => [l, typeof v === "object" ? v : { value: v }])) },
  value: {}, title: s.title
});
const asi = (docKey, level, points = 2, extra = {}) => adv(docKey, `asi:${level}`, "AbilityScoreImprovement", {
  configuration: { points, fixed: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, cap: extra.cap ?? 2, locked: extra.locked ?? [], recommendation: null },
  value: {}, level, title: extra.title ?? ""
});
const choice = (docKey, c) => adv(docKey, `choice:${c.tag}`, "ItemChoice", {
  configuration: {
    choices: Object.fromEntries(Object.entries(c.choices).map(([l, n]) => [l, { count: n, replacement: false }])),
    allowDrops: c.allowDrops ?? false, type: "feat",
    // a pool entry is one of our feature slugs, or a full UUID (e.g. dnd5e's own fighting styles)
    pool: c.pool.map(s => ({ uuid: s.includes("Compendium.") ? s : uuid("features", s) })),
    restriction: { type: c.subtype ? "class" : "", subtype: c.subtype ?? "", level: "" },
    spell: { ability: [], preparation: "", uses: { max: "", per: "" } }
  },
  value: { added: {} }, title: c.title, hint: c.hint ?? ""
});

/* ── class ───────────────────────────────────────────────────────────────── */
function classDoc(c) {
  const key = `classes:${c.slug}`;
  lint(`class ${c.slug}`, c.description);
  const a = [];
  a.push(adv(key, "hp", "HitPoints", { configuration: {}, value: {}, title: "Hit Points" }));
  a.push(trait(key, "saves", 1, "Saving Throw Proficiencies", c.saves.map(s => `saves:${s}`), [], { classRestriction: "primary" }));
  a.push(trait(key, "skills", 1, "Skill Proficiencies", [], [{ count: c.skills.count, pool: c.skills.pool.map(s => `skills:${s}`) }], { classRestriction: "primary" }));
  if (c.weapons?.length) a.push(trait(key, "weapons", 1, "Weapon Proficiencies", c.weapons.map(w => `weapon:${w}`), [], { classRestriction: "primary" }));
  if (c.armor?.length) a.push(trait(key, "armor", 1, "Armor Training", c.armor.map(w => `armor:${w}`), [], { classRestriction: "primary" }));
  if (c.tools?.length) a.push(trait(key, "tools", 1, "Tool Proficiencies", c.tools.map(w => `tool:${w}`), [], { classRestriction: "primary" }));
  if (c.multiclass) {
    const g = [...(c.multiclass.weapons ?? []).map(w => `weapon:${w}`), ...(c.multiclass.armor ?? []).map(w => `armor:${w}`)];
    if (g.length) a.push(trait(key, "multiclass", 1, "Multiclass Proficiencies", g, [], { classRestriction: "secondary" }));
  }
  for (const [lvl, slugs] of Object.entries(c.features ?? {})) a.push(grant(key, Number(lvl), slugs));
  for (const s of c.scales ?? []) a.push(scale(key, s));
  for (const ch of c.choices ?? []) a.push(choice(key, ch));
  for (const lvl of c.asi ?? [4, 8, 12, 16, 19]) a.push(asi(key, lvl));
  for (const x of c.asiExtra ?? []) a.push(asi(key, x.level, x.points, x));
  if (c.subclassLevel) a.push(adv(key, "subclass", "Subclass", { configuration: {}, value: { document: null, uuid: null }, level: c.subclassLevel, title: c.subclassTitle ?? "", hint: "" }));
  return {
    _id: id(key), name: c.name, type: "class", img: c.img, folder: null, sort: 0,
    system: {
      description: { value: link(c.description), chat: "" },
      source: { ...SOURCE_META },
      identifier: c.identifier, levels: 1,
      hd: { denomination: c.hd, spent: 0, additional: "" },
      advancement: a,
      spellcasting: { progression: "none", ability: "", preparation: { formula: "" } },
      wealth: c.wealth ?? "",
      primaryAbility: { value: c.primaryAbility, all: false },
      startingEquipment: c.startingEquipment ?? []
    },
    effects: [],
    flags: { [MOD]: { casting: c.casting }, ...(c.flags ?? {}) },
    _key: `!items!${id(key)}`
  };
}

/* ── subclass ────────────────────────────────────────────────────────────── */
function subclassDoc(s) {
  const key = `subclasses:${s.slug}`;
  lint(`subclass ${s.slug}`, s.description);
  const byLevel = {};
  for (const f of s.features) (byLevel[f.level] ??= []).push(f.slug);
  const a = Object.entries(byLevel).map(([lvl, slugs]) => grant(key, Number(lvl), slugs));
  for (const sc of s.scales ?? []) a.push(scale(key, sc));
  for (const ch of s.choices ?? []) a.push(choice(key, ch));
  for (const t of s.traits ?? []) a.push(trait(key, `trait:${t.tag}`, t.level, t.title ?? "", t.grants ?? [], t.choices ?? []));
  return {
    _id: id(key), name: s.name, type: "subclass", img: s.img, folder: null, sort: 0,
    system: {
      description: { value: link(s.description), chat: "" },
      source: { ...SOURCE_META },
      identifier: s.identifier, classIdentifier: s.classIdentifier,
      advancement: a,
      spellcasting: { progression: "none", ability: "", preparation: { formula: "" } }
    },
    effects: [],
    flags: { ...(s.casting ? { [MOD]: { casting: s.casting } } : {}) },
    _key: `!items!${id(key)}`
  };
}

/* ── folders ─────────────────────────────────────────────────────────────── */
function folderDoc(pack, name, parentName = null) {
  const key = `folder:${pack}:${parentName ? parentName + "/" : ""}${name}`;
  return { _id: id(key), name, type: "Item", folder: parentName ? id(`folder:${pack}:${parentName}`) : null,
    sorting: "a", sort: 0, color: null, description: "", flags: {}, _key: `!folders!${id(key)}` };
}

/* ── main ────────────────────────────────────────────────────────────────── */
function main() {
  const files = readdirSync(CONTENT).filter(f => f.endsWith(".json")).sort();
  const docs = { classes: [], subclasses: [], features: [], powers: [], species: [] };
  const folders = { features: new Map(), powers: new Map(), species: new Map() };
  const folderFor = (pack, name, parent) => {
    const k = `${parent ? parent + "/" : ""}${name}`;
    if (!folders[pack].has(k)) folders[pack].set(k, folderDoc(pack, name, parent));
    return folders[pack].get(k)._id;
  };

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(CONTENT, file), "utf8"));
    for (const c of data.classes ?? []) docs.classes.push(classDoc(c));
    for (const s of data.subclasses ?? []) docs.subclasses.push(subclassDoc(s));
    for (const r of data.races ?? []) { const d = raceDoc(r); if (r.family) d.folder = folderFor("species", r.family, null); docs.species.push(d); }
    for (const f of data.features ?? []) {
      const fid = f.folder ? folderFor("features", f.folder, f.folderParent ?? null) : null;
      if (f.folder && f.folderParent) folderFor("features", f.folderParent, null);
      docs.features.push(featureDoc(f, fid));
    }
    for (const p of data.powers ?? []) {
      const LEVEL = ["At-will", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
      const trad = SCHOOL_TRADITION[p.school] === "be5e-artifice" ? "Artifice" : "The Flow";
      docs.powers.push(powerDoc(p, folderFor("powers", `${LEVEL[p.level] ?? p.level} level`, trad)));
      folderFor("powers", trad, null);
    }
  }
  // a power's slug must be unique, and a feature's too
  for (const pack of ["features", "powers"]) {
    const slugs = new Map();
    for (const d of docs[pack]) {
      if (slugs.has(d.system.identifier)) { console.error(`DUPLICATE ${pack} slug "${d.system.identifier}"`); process.exit(1); }
      slugs.set(d.system.identifier, d.name);
    }
  }

  // sanity: every granted / pooled feature exists
  const have = new Set(docs.features.map(d => d._id));
  const missing = [];
  for (const d of [...docs.classes, ...docs.subclasses]) {
    for (const a of d.system.advancement) {
      const refs = [...(a.configuration?.items ?? []), ...(a.configuration?.pool ?? [])].map(r => r.uuid);
      for (const u of refs) if (u.includes(".features.") && !have.has(u.split(".").pop())) missing.push(`${d.name} → ${a.title ?? a.type} L${a.level ?? "-"}: ${u}`);
    }
  }
  // every @UUID link in prose must resolve to a doc we build
  const everything = [...docs.classes, ...docs.subclasses, ...docs.features, ...docs.powers, ...docs.species];
  for (const d of docs.species) {
    for (const a of d.system.advancement) for (const r of a.configuration?.items ?? []) {
      if (r.uuid.includes(".features.") && !have.has(r.uuid.split(".").pop())) missing.push(`${d.name} → ${a.title} L${a.level}: ${r.uuid}`);
    }
  }
  const all = new Set(everything.map(d => d._id));
  const proseMissing = [];
  for (const d of everything) {
    for (const m of d.system.description.value.matchAll(/@UUID\[Compendium\.bad-eden-5e\.\w+\.Item\.(\w+)\]/g)) {
      if (!all.has(m[1])) proseMissing.push(`${d.name} (prose link): ${m[0]}`);
    }
    if (/\{\{uuid:/.test(d.system.description.value)) missing.push(`${d.name}: unresolved {{uuid}} token`);
  }
  // a prose link to a doc not built yet is a warning in --dry (content lands in batches), fatal in a real build
  if (proseMissing.length) {
    if (args.has("--dry")) console.warn(`WARN: ${proseMissing.length} prose link(s) to docs not built yet:\n  ` + proseMissing.join("\n  "));
    else missing.push(...proseMissing);
  }
  if (missing.length) { console.error("MISSING feature references:\n  " + missing.join("\n  ")); process.exit(1); }

  // dupes
  const seen = new Map();
  for (const [pack, list] of Object.entries(docs)) for (const d of list) {
    if (seen.has(d._id)) { console.error(`DUPLICATE id ${d._id}: ${seen.get(d._id)} and ${pack}/${d.name}`); process.exit(1); }
    seen.set(d._id, `${pack}/${d.name}`);
  }

  if (!args.has("--no-lint") && lintFindings.length) {
    console.error(`LINT: ${lintFindings.length} leftover term(s):\n  ` + lintFindings.join("\n  "));
    process.exit(1);
  }

  // write _source
  rmSync(SOURCE, { recursive: true, force: true });
  let total = 0;
  for (const [pack, list] of Object.entries(docs)) {
    if (!list.length) continue;
    const dir = join(SOURCE, pack);
    mkdirSync(dir, { recursive: true });
    for (const f of folders[pack]?.values() ?? []) writeFileSync(join(dir, `_folder_${f._id}.json`), JSON.stringify(f, null, 2));
    for (const d of list) { writeFileSync(join(dir, `${d.system.identifier ?? d._id}_${d._id}.json`), JSON.stringify(d, null, 2)); total++; }
    console.log(`${pack}: ${list.length} doc(s)${folders[pack]?.size ? `, ${folders[pack].size} folder(s)` : ""}`);
  }
  console.log(`expanded ${total} document(s) → ${SOURCE}`);
  if (args.has("--dry")) return;

  for (const pack of Object.keys(docs)) {
    const dir = join(SOURCE, pack);
    if (!existsSync(dir)) continue;
    rmSync(join(PACKS, pack), { recursive: true, force: true });
    const r = spawnSync("fvtt", ["package", "pack", pack, "--in", dir, "--out", PACKS], { encoding: "utf8" });
    if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(r.status ?? 1); }
    console.log(`packed ${pack}`);
  }
}

main();
