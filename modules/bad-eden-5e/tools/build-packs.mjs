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
import { readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
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
  /\bconsular/i, /\bsentinel\b/i, /\b(Armormech|Armstech|Astrotech|Audiotech|Biochem|Biotech|Cybertech|Gadgeteer|Unstable|Construction|Artificer) Engineering\b/, /\bsw5e\b/i, /Compendium\.sw5e/, /\bchapter \d+/i
];
// RFI (fourththing) vocabulary that must not survive into D&D content either — read from THE rubric
const RUBRIC = JSON.parse(readFileSync(join(ROOT, "conversion", "rubric.json"), "utf8"));
const CASED = /^\\b(Integrity|\(Violence|\(VIO|Stress damage)/;
const RFI_TERMS = RUBRIC.vocabulary.banned.map(p => new RegExp(p, CASED.test(p) ? "" : "i"));
const lintFindings = [];
/** `{{uuid:<pack>:<slug>}}` inside prose → the deterministic compendium UUID. */
const link = text => (text ?? "").replace(/\{\{uuid:([a-z]+):([a-z0-9-]+)\}\}/g, (_, p, s) => p === "tables" ? `Compendium.${MOD}.tables.RollTable.${id(`tables:${s}`)}` : uuid(p, s));
function lint(doc, text, { rfi = false } = {}) {
  if (!text) return;
  const plain = text.replace(/<[^>]+>/g, " ");
  // RFI-origin content is ours: only the RFI vocabulary list applies (a Bad Eden blaster is a Bad Eden blaster)
  for (const re of rfi ? RFI_TERMS : [...BANNED, ...RFI_TERMS]) {
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
  const rfi = { rfi: !!f.flags?.["bad-eden-5e"]?.rfi || f.featType === "race" };
  lint(`feature ${f.slug}`, f.description, rfi);
  lint(`feature ${f.slug} (name)`, f.name, rfi);
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
      properties: [], activities: activityFor(key, f), enchant: {}, identifier: f.slug,
      // feats may carry Trait advancements (a skill or tool proficiency, or a choice between two)
      ...(f.traits?.length ? { advancement: f.traits.map(t => trait(key, `trait:${t.tag}`, t.level ?? 0, t.title ?? "", t.grants ?? [], t.choices ?? [])) } : {})
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
function powerDoc(p, folderId, pack = "powers") {
  const key = `${pack}:${p.slug}`;
  const slotSpell = p.method === "spell";   // 2026-10-31: manifestations are ordinary slot spells (dnd5e schools)
  lint(`power ${p.slug}`, p.description, { rfi: slotSpell });
  lint(`power ${p.slug} (name)`, p.name, { rfi: slotSpell });
  const method = slotSpell ? "spell" : SCHOOL_TRADITION[p.school];
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
    consumption: { targets: [], scaling: { allowed: p.level > 0 && p.scaling !== "none", max: "" }, spellSlot: slotSpell },  // points engines charge their own pool; slot spells spend slots
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
  if (slotSpell) properties.unshift("vocal", "somatic");
  const effects = (p.effects ?? []).map((e, i) => {
    const eid = /^[A-Za-z0-9]{16}$/.test(e._id ?? "") ? e._id : id(`effect:${key}:${i}`);
    return { ...e, _id: eid, _key: `!items.effects!${id(key)}.${eid}` };
  });
  // the activity applies the spell's effects (save: on a failed save only)
  if (p.linkEffects) act.effects = effects.map(e => ({ _id: e._id, onSave: false, level: {} }));
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
      method, prepared: slotSpell ? 0 : 1, ability: "",
      activities: { [aid]: act },
      identifier: p.slug
    },
    effects,
    flags: { [MOD]: { sw5e: p.sw5e ?? "", ...(p.flags?.[MOD] ?? {}) }, dnd5e: { riders: { activity: [], effect: [] } } },
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

/* ── roll tables (e.g. the Instability table) ────────────────────────────── */
function tableDoc(t) {
  const key = `tables:${t.slug}`;
  const tid = id(key);
  const results = t.results.map((r, i) => {
    const rid = id(`${key}:r${i}`);
    lint(`table ${t.slug} #${i + 1}`, r);
    return { _id: rid, type: "text", text: link(r), img: "icons/svg/d20-black.svg", weight: 1, range: [i + 1, i + 1], drawn: false, documentCollection: "", documentId: null, flags: {}, _key: `!tables.results!${tid}.${rid}` };
  });
  return {
    _id: tid, name: t.name, img: t.img ?? "icons/svg/d20-grey.svg", description: link(t.description ?? ""), results,
    formula: t.formula ?? `1d${t.results.length}`, replacement: true, displayRoll: true, folder: null, sort: 0, flags: { [MOD]: { kind: t.kind ?? "table" } },
    _key: `!tables!${tid}`
  };
}

/* ── raw dnd5e items (the gear lane hands us complete system objects) ────── */
function rawItemDoc(it, folderId) {
  const key = `gear:${it.slug}`;
  const rfi = { rfi: !!it.flags?.["bad-eden-5e"]?.rfi };
  lint(`item ${it.slug}`, it.system?.description?.value ?? "", rfi);
  lint(`item ${it.slug} (name)`, it.name, rfi);
  const sys = { ...it.system, source: { ...SOURCE_META }, identifier: it.system?.identifier ?? it.slug };
  sys.description = { value: link(sys.description?.value ?? ""), chat: "" };
  return {
    _id: id(key), name: it.name, type: it.type, img: it.img, folder: folderId ?? null, sort: 0, system: sys,
    effects: (it.effects ?? []).map((e, i) => { const eid = /^[A-Za-z0-9]{16}$/.test(e._id ?? "") ? e._id : id(`effect:${key}:${i}`); return { ...e, _id: eid, _key: `!items.effects!${id(key)}.${eid}` }; }),
    flags: { ...(it.flags ?? {}), dnd5e: { riders: { activity: [], effect: [] } } },
    _key: `!items!${id(key)}`
  };
}

/* ── Archetype origins (2026-10-30): the Archetype IS the 5E background ─────
 * content/archetype-origins.json → dnd5e `background` items in pack
 * `archetypes`. A 2024-shaped origin: ASI (3 points, cap 2, the three named
 * abilities), the two Tier 1 skills, one Origin feat, then ItemGrants of the
 * Archetype's own cards (raw items in character-archetypes, id gear:<slug>):
 * base + Tier 1 at 0, Tier 2/3/4 at 5/11/17. Prose = the base card's quote and
 * lede + a benefits list built from the row. */
const ABIL_LONG = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const SKILL_LONG = { acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana", ath: "Athletics", dec: "Deception", his: "History", ins: "Insight", itm: "Intimidation", inv: "Investigation", med: "Medicine", nat: "Nature", prc: "Perception", prf: "Performance", per: "Persuasion", rel: "Religion", slt: "Sleight of Hand", ste: "Stealth", sur: "Survival" };
const cardUuid = slug => `Compendium.${MOD}.character-archetypes.Item.${id(`gear:${slug}`)}`;
function backgroundDoc(b, originFeats, cards) {
  const key = `archetypes:${b.slug}`;
  const base = cards.get(b.card);
  if (!base) throw new Error(`archetype origin ${b.slug}: no card "${b.card}" in character-archetypes`);
  for (const t of [1, 2, 3, 4]) if (!cards.get(`${b.card}-t${t}`)) throw new Error(`archetype origin ${b.slug}: no Tier ${t} card "${b.card}-t${t}"`);
  const abil = b.abilities.map(a => ABIL_LONG[a]);
  const skills = b.skills.map(k => SKILL_LONG[k]);
  // the card's quote + first paragraph of lede (the "Archetype Effects" list stays on the card itself)
  const baseHtml = String(base.system?.description?.value ?? "").replace(/<div[^>]*display:none[^>]*><\/div>/g, "");
  const lede = (baseHtml.match(/<p>[\s\S]*?<\/p>/g) ?? []).slice(0, 2).join("");
  const desc = `${lede}<h3>Archetype</h3><ul>`
    + `<li><p><strong>Ability Scores:</strong> ${abil.join(", ")}. Increase one by 2 and a different one by 1, or all three by 1 (none above 20).</p></li>`
    + `<li><p><strong>Skills:</strong> ${skills.join(" and ")}.</p></li>`
    + `<li><p><strong>Origin Feat:</strong> choose one (Alert, Magic Initiate, Savage Attacker or Skilled).</p></li>`
    + `<li><p><strong>Archetype Cards:</strong> @UUID[${cardUuid(b.card)}]{${base.name.replace(/^Archetype:\s*/, "")}} and its Tier 1 card now; Tier 2, 3 and 4 at levels 5, 11 and 17.</p></li></ul>`;
  lint(`archetype origin ${b.slug}`, desc, { rfi: true });
  const a = [];
  const locked = Object.keys(ABIL_LONG).filter(k => !b.abilities.includes(k));
  a.push({ ...asi(key, 0, 3, { cap: 2, locked, title: "Archetype Ability Scores" }),
    hint: `Your Archetype lets you increase ${abil.slice(0, 2).join(", ")} and ${abil[2]}: one by 2 and a different one by 1, or all three by 1. None can rise above 20.` });
  a.push(trait(key, "skills", 0, "Archetype Skills", b.skills.map(k => `skills:${k}`), [], { hint: `Your Archetype grants proficiency in ${skills.join(" and ")}.` }));
  a.push(adv(key, "origin-feat", "ItemChoice", {
    configuration: { choices: { 0: { count: 1, replacement: false } }, allowDrops: false, type: "feat",
      pool: originFeats.map(u => ({ uuid: u })), restriction: { type: "", subtype: "", level: "" },
      spell: { ability: [], preparation: "", uses: { max: "", per: "" } } },
    value: { added: {} }, level: 0, title: "Origin Feat", hint: "Choose one Origin feat."
  }));
  const cardGrant = (level, slugs, title) => adv(key, `card:${level}`, "ItemGrant", {
    configuration: { items: slugs.map(s => ({ uuid: cardUuid(s), optional: false })), optional: false,
      spell: { ability: [], preparation: "", uses: { max: "", per: "" } } },
    value: {}, level, title
  });
  a.push(cardGrant(0, [b.card, `${b.card}-t1`], "Archetype"));
  a.push(cardGrant(5, [`${b.card}-t2`], "Archetype Tier II"));
  a.push(cardGrant(11, [`${b.card}-t3`], "Archetype Tier III"));
  a.push(cardGrant(17, [`${b.card}-t4`], "Archetype Tier IV"));
  return {
    _id: id(key), name: b.name, type: "background", img: base.img, folder: null, sort: 0,
    system: {
      description: { value: desc, chat: "" },
      source: { ...SOURCE_META, rules: "2024" },
      identifier: `archetype-${b.slug}`,
      advancement: a,
      startingEquipment: [],
      wealth: ""
    },
    effects: [],
    flags: { [MOD]: { archetype: { slug: b.slug, card: b.card, key: base.flags?.["bbttcc-character-options"]?.option?.key ?? "" } } },
    _key: `!items!${id(key)}`
  };
}

/* ── raw dnd5e actors (the creatures lane hands us complete npc documents) ── */
function rawActorDoc(a, folderId) {
  const key = `monsters:${a.slug}`;
  const aid = id(key);
  lint(`actor ${a.slug}`, a.system?.details?.biography?.value ?? "", { rfi: true });
  const items = (a.items ?? []).map((it, i) => {
    const ikey = `${key}:${i}:${it.slug ?? "item"}`; const iid = id(ikey);   // index-qualified: a monster can carry two features of one name
    lint(`actor ${a.slug} › ${it.name}`, it.system?.description?.value ?? "", { rfi: true });
    const sys = { ...it.system, source: { ...SOURCE_META }, identifier: it.system?.identifier ?? it.slug };
    sys.description = { value: link(sys.description?.value ?? ""), chat: "" };
    return { _id: iid, name: it.name, type: it.type, img: it.img, sort: (i + 1) * 100000, system: sys,
      // keep an authored id (the converter links activities to effects by it); mint one otherwise
      effects: (it.effects ?? []).map((e, j) => { const eid = /^[A-Za-z0-9]{16}$/.test(e._id ?? "") ? e._id : id(`effect:${ikey}:${j}`); return { ...e, _id: eid, _key: `!actors.items.effects!${aid}.${iid}.${eid}` }; }),
      flags: { ...(it.flags ?? {}), dnd5e: { riders: { activity: [], effect: [] } } }, _key: `!actors.items!${aid}.${iid}` };
  });
  return {
    _id: aid, name: a.name, type: a.type ?? "npc", img: a.img, folder: folderId ?? null, sort: 0,
    prototypeToken: a.prototypeToken ?? { name: a.name },
    system: { ...a.system, source: { ...SOURCE_META } },
    items, effects: (a.effects ?? []).map((e, j) => { const eid = id(`effect:${key}:${j}`); return { ...e, _id: eid, _key: `!actors.effects!${aid}.${eid}` }; }),
    flags: a.flags ?? {}, _key: `!actors!${aid}`
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
  return { _id: id(key), name, type: pack === "monsters" ? "Actor" : pack === "tables" ? "RollTable" : "Item", folder: parentName ? id(`folder:${pack}:${parentName}`) : null,
    sorting: "a", sort: 0, color: null, description: "", flags: {}, _key: `!folders!${id(key)}` };
}

/* ── main ────────────────────────────────────────────────────────────────── */
function main() {
  const files = readdirSync(CONTENT).filter(f => f.endsWith(".json")).sort();
  // item lanes route by the content file's `_pack` (default gear): courtly-secrets / npc-callings / sparks (2026-10-08)
  // 2026-10-11: + the six character-options twins, doctrines and vehicles (rigs) — the packs a D&D world on Ember needs
  const TWIN_PACKS = ["spells", "spell-lists", "archetypes", "character-archetypes", "crew-types", "enlightenment-levels", "occult-associations", "political-affiliations", "sephirothic-alignments", "doctrines", "vehicles"];
  const docs = { classes: [], subclasses: [], features: [], powers: [], species: [], tables: [], gear: [], monsters: [], "courtly-secrets": [], "npc-callings": [], sparks: [], ...Object.fromEntries(TWIN_PACKS.map(p => [p, []])) };
  const folders = { features: new Map(), powers: new Map(), species: new Map(), gear: new Map(), monsters: new Map(), "courtly-secrets": new Map(), "npc-callings": new Map(), sparks: new Map(), ...Object.fromEntries(TWIN_PACKS.map(p => [p, new Map()])) };
  const folderFor = (pack, name, parent) => {
    const k = `${parent ? parent + "/" : ""}${name}`;
    if (!folders[pack].has(k)) folders[pack].set(k, folderDoc(pack, name, parent));
    return folders[pack].get(k)._id;
  };

  const pendingBackgrounds = [];
  const spellLists = {};   // class identifier → spell UUIDs (2026-10-31: the manifestations join the SRD lists)
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(CONTENT, file), "utf8"));
    for (const c of data.classes ?? []) docs.classes.push(classDoc(c));
    for (const s of data.subclasses ?? []) docs.subclasses.push(subclassDoc(s));
    for (const t of data.tables ?? []) docs.tables.push(tableDoc(t));
    const actorPack = data._pack === "vehicles" ? "vehicles" : "monsters";   // the rigs lane routes its vehicles by _pack
    for (const a of data.actors ?? []) docs[actorPack].push(rawActorDoc(a, a.folder ? folderFor(actorPack, a.folder, null) : null));
    const itemPack = docs[data._pack] && folders[data._pack] ? data._pack : "gear";
    for (const it of data.items ?? []) docs[itemPack].push(rawItemDoc(it, it.folder ? folderFor(itemPack, it.folder, it.folderParent ?? null) : null));
    if (data.backgrounds) pendingBackgrounds.push(data);
    for (const sp of data.spells ?? []) {
      const LEVEL = ["Cantrips", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];
      docs.spells.push(powerDoc(sp, folderFor("spells", LEVEL[sp.level] ?? `Level ${sp.level}`, null), "spells"));
      for (const c of sp.classes ?? []) (spellLists[c] ??= []).push(`Compendium.${MOD}.spells.Item.${id(`spells:${sp.slug}`)}`);
    }
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
  // Archetype origins resolve against the cards once every lane is loaded
  if (pendingBackgrounds.length) {
    const cards = new Map(JSON.parse(readFileSync(join(CONTENT, "archetypes.json"), "utf8")).items.map(it => [it.slug, it]));
    for (const data of pendingBackgrounds) for (const b of data.backgrounds) docs.archetypes.push(backgroundDoc(b, data.originFeats ?? [], cards));
  }
  // One journal, one "spells" page per class: dnd5e merges pages by (type, identifier) into the class's list.
  // module.json flags.dnd5e.spellLists names these pages (printed below; ids are deterministic).
  if (Object.keys(spellLists).length) {
    const jid = id("spell-lists:bad-eden");
    const CLASS_NAME = { bard: "Bard", cleric: "Cleric", druid: "Druid", paladin: "Paladin", ranger: "Ranger", sorcerer: "Sorcerer", warlock: "Warlock", wizard: "Wizard" };
    const pages = Object.keys(spellLists).sort().map((c, i) => {
      const pid = id(`spell-lists:bad-eden:${c}`);
      return { _id: pid, name: `${CLASS_NAME[c] ?? c} Spells (Bad Eden)`, type: "spells", sort: i * 1000, title: { show: true, level: 1 },
        system: { type: "class", identifier: c, grouping: "level", description: { value: "<p>Bad Eden manifestations on this class's spell list.</p>" }, spells: [...new Set(spellLists[c])].sort(), unlinkedSpells: [] },
        _key: `!journal.pages!${jid}.${pid}` };
    });
    docs["spell-lists"].push({ _id: jid, name: "Bad Eden Spell Lists", folder: null, sort: 0, pages, flags: {}, _key: `!journal!${jid}` });
    console.log("spellLists flag: " + JSON.stringify(pages.map(p => `Compendium.${MOD}.spell-lists.JournalEntry.${jid}.JournalEntryPage.${p._id}`)));
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
  const everything = [...docs.classes, ...docs.subclasses, ...docs.features, ...docs.powers, ...docs.species, ...docs.gear, ...docs.monsters];
  const tableIds = new Set(docs.tables.map(t => t._id));
  for (const d of docs.species) {
    for (const a of d.system.advancement) for (const r of a.configuration?.items ?? []) {
      if (r.uuid.includes(".features.") && !have.has(r.uuid.split(".").pop())) missing.push(`${d.name} → ${a.title} L${a.level}: ${r.uuid}`);
    }
  }
  const all = new Set(everything.map(d => d._id));
  const proseMissing = [];
  for (const d of everything) {
    const prose = d.system?.description?.value ?? d.system?.details?.biography?.value ?? "";
    for (const m of prose.matchAll(/@UUID\[Compendium\.bad-eden-5e\.\w+\.(Item|RollTable)\.(\w+)\]/g)) {
      if (!(m[1] === "RollTable" ? tableIds : all).has(m[2])) proseMissing.push(`${d.name} (prose link): ${m[0]}`);
    }
    if (/\{\{uuid:/.test(prose)) missing.push(`${d.name}: unresolved {{uuid}} token`);
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
    for (const d of list) { writeFileSync(join(dir, `${d.system?.identifier ?? d.name.replace(/[^A-Za-z0-9]+/g, "_")}_${d._id}.json`), JSON.stringify(d, null, 2)); total++; }
    console.log(`${pack}: ${list.length} doc(s)${folders[pack]?.size ? `, ${folders[pack].size} folder(s)` : ""}`);
  }
  console.log(`expanded ${total} document(s) → ${SOURCE}`);
  if (args.has("--dry")) return;

  // Pack into a scratch dir and verify by unpacking BEFORE touching packs/.
  // A running Foundry holds each LevelDB's LOCK; packing straight into it
  // silently produced truncated databases (2026-10-07: 1 of 4 classes, 0 of
  // 28 species), and swapping a directory under a live handle is no better:
  // LevelDB deletes "obsolete" files BY PATH, so the old process wiped the new
  // tables on its next compaction/shutdown and repaired the pack to empty.
  // So: refuse while any process holds a pack open. Quit Foundry, build, relaunch.
  const held = Object.keys(docs).map(pack => join(PACKS, pack, "LOCK")).filter(existsSync);
  if (held.length) {
    const l = spawnSync("lsof", ["-t", ...held], { encoding: "utf8" });
    const pids = [...new Set((l.stdout || "").split(/\s+/).filter(Boolean))];
    if (pids.length) {
      console.error(`packs are open by process ${pids.join(", ")} (Foundry?) — quit it before building, or the packs come out truncated.`);
      process.exit(1);
    }
  }
  const stage = mkdtempSync(join(tmpdir(), "bad-eden-5e-packs-"));
  for (const pack of Object.keys(docs)) {
    const dir = join(SOURCE, pack);
    if (!existsSync(dir)) continue;
    const want = readdirSync(dir).filter(f => f.endsWith(".json")).length;
    const r = spawnSync("fvtt", ["package", "pack", pack, "--in", dir, "--out", stage], { encoding: "utf8" });
    if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(r.status ?? 1); }
    const check = join(stage, `_verify_${pack}`);
    const u = spawnSync("fvtt", ["package", "unpack", pack, "--in", stage, "--out", check], { encoding: "utf8" });
    const got = u.status === 0 ? readdirSync(check).filter(f => f.endsWith(".json")).length : -1;
    if (got !== want) {
      console.error(`${pack}: packed ${got} record(s) but the source holds ${want} — refusing to install a truncated pack.`);
      console.error(`  (is Foundry running with this module loaded? quit it, or pack from a copy)`);
      process.exit(1);
    }
    rmSync(check, { recursive: true, force: true });
    rmSync(join(PACKS, pack), { recursive: true, force: true });
    cpSync(join(stage, pack), join(PACKS, pack), { recursive: true });
    console.log(`packed ${pack} (${got} records, verified)`);
  }
  rmSync(stage, { recursive: true, force: true });
}

main();
