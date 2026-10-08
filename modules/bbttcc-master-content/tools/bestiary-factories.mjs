/* bestiary-factories.mjs — shared item/actor factories for the offline bestiary builders (build-bestiary-slots.mjs, build-named-statblocks.mjs).
 * Shapes follow the monster builder (monster-builder.js): INTEGRITY / DMG envelopes, lineage signatures, boss kit = Fractured Will + Signature + Ultimate;
 * weapon dice sit inside threat-budget.mjs's per-tier band; abilities carry npcAuto / passives the engine runs; prices follow the creature rubric. */
import { meanDice, budgetFor } from "./threat-budget.mjs";
export const FOLDER_BAD_EDEN_MONSTERS = "uMhSIaldbbcnBh0H";
export const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV" }, LEVEL = { 1: 1, 2: 8, 3: 13, 4: 18 };
export const INTEGRITY = { light: { 1: 25, 2: 32, 3: 39, 4: 46 }, medium: { 1: 40, 2: 50, 3: 60, 4: 70 }, heavy: { 1: 60, 2: 75, 3: 90, 4: 105 }, boss: { 1: 75, 2: 95, 3: 115, 4: 135 } };
const BOUNTY_BASE = { 1: 5, 2: 10, 3: 20, 4: 40 }, BR_MULT = { light: 1, medium: 1.5, heavy: 2, boss: 3 };
const r5 = n => Math.max(5, Math.round(n / 5) * 5);
export const LIN = {
  wild:       { creatureType: "beast",     resist: [],           vuln: [],             condImm: [],                               stress: 0.5, currency: "violence",  tree: "malkuth" },
  mortal:     { creatureType: "humanoid",  resist: [],           vuln: [],             condImm: [],                               stress: 0.5, currency: "violence",  tree: "malkuth" },
  revenant:   { creatureType: "undead",    resist: ["kinetic"],  vuln: ["sephirotic"], condImm: ["charmed", "shaken"],            stress: 0.8, currency: "softpower", tree: "malkuth" },
  "pre-fall": { creatureType: "construct", resist: ["kinetic"],  vuln: ["chemical"],   condImm: ["charmed", "shaken", "compelled"], stress: 0.4, currency: "intrigue",  tree: "hod" },
  sephirotic: { creatureType: "elemental", resist: ["psychic"],  vuln: ["qliphothic"], condImm: ["charmed", "shaken"],            stress: 0.7, currency: "softpower", tree: "tiferet" },
  qliphothic: { creatureType: "fiend",     resist: ["qliphothic"], vuln: ["sephirotic"], condImm: ["charmed"],                    stress: 0.5, currency: "softpower", tree: "qliphoth" },
  dream:      { creatureType: "undead",    resist: ["kinetic"],  vuln: ["sephirotic"], condImm: ["shaken"],                       stress: 1.0, currency: "nonlethal", tree: "yesod" },
  "hex-touched": { creatureType: "aberration", resist: ["kinetic"], vuln: ["sephirotic"], condImm: [],                             stress: 0.5, currency: "intrigue",  tree: "malkuth" },
};
const STRESS_TYPES = new Set(["psychic", "qliphothic"]);
export const ICON = { bite: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/BBTTCC_button_icon_wolf_1.png", fire: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/bbttcc_icons_flame_1.png", spirit: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/BBTTCC_button_icon_spirit.png",
  robot: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/BBTTCC_button_icon_robot.png", stealth: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/BBTTCC_button_icon_stealth_1.png", circuit: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/BBTTCC_button_icon_circuit_1.png",
  grave: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/bbttcc_icons_gravewarden_1.png", runner: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/bbttcc_icons_ghostly_runner_1.png", storm: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/bbttcc_button_icon_storm_warden.png",
  cone: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/BBTTCC_button_icon_fire_cone_1.png", ball: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/BBTTCC_button_icon_fireball_1.png", choir: "art/bbttcc/GOTTGAIT/BBTTCC Button Icons/bbttcc_icons_ghostly_runner_2.png" };
const id = () => Array.from({ length: 16 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 62)]).join("");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function weapon(sp, w) {
  const melee = w.melee !== false, type = w.dmg ?? "kinetic", track = STRESS_TYPES.has(type) ? "stress" : "integrity";
  const mf = { appliedStates: w.states ? { states: w.states, duration: w.duration ?? "1-round", saveEachRound: false, saveAttribute: w.save?.attr ?? "", saveDcMode: w.save ? "fixed" : "none", saveDcFixed: w.save?.dc ?? 15, saveAttributeOverrides: {} } : undefined,
    resolution: w.area ? { mode: "save", saveAttribute: w.save.attr, saveDcMode: "fixed", saveDcFixed: w.save.dc, onSave: w.onSave ?? "half", statesOnFail: true } : (w.save && !w.states ? { saveAttribute: w.save.attr, saveDcMode: "fixed", saveDcFixed: w.save.dc, onSave: "negate", statesOnFail: true } : undefined),
    area: w.area ? { shape: w.area.shape, size: w.area.size } : { shape: "none", size: 0 } };
  if (w.states && w.save && !w.area) mf.resolution = { saveAttribute: w.save.attr, saveDcMode: "fixed", saveDcFixed: w.save.dc, onSave: "negate", statesOnFail: true };
  for (const k of Object.keys(mf)) if (mf[k] === undefined) delete mf[k];
  const use = w.recharge ? " (recharges on a Soma Break)" : w.perScene ? ` (${w.perScene}/scene)` : "";
  const effect = w.area ? `${w.area.shape[0].toUpperCase() + w.area.shape.slice(1)} ${w.area.size} ft. — targets roll vs ${w.save.attr === "intrigue" ? "Evasion" : w.save.attr === "violence" ? "Guard" : "Resolve"} (DC ${w.save.dc}). ${w.onSave === "negate" ? "No effect" : "Half damage"} on success.${w.rider ? " " + w.rider : ""}`
    : (w.rider ?? "");
  return { _id: id(), name: w.name + use, type: "weapon", img: w.img ?? ICON.bite,
    system: { category: melee ? "melee" : "ranged", intent: w.intent ?? "violence", skill: w.skill ?? (melee ? "melee" : "firearms"),
      damage: { formula: w.formula, attribute: w.attribute ?? (w.intent ?? "violence"), type, damageFlavor: w.flavor ?? "", track },
      range: melee ? { short: 1, long: 1 } : { short: w.range ?? 6, long: (w.range ?? 6) * 3 }, tags: ["bestiary", `tier-${ROMAN[sp.tier].toLowerCase()}`, `lineage-${sp.lineage}`, ...(w.tags ?? [])],
      effect, flavor: w.flavorLine ?? "", manifestation: mf,
      description: { value: `<p><strong>${w.area ? "Area Attack" : "Strike"}.</strong> ${w.area ? `${w.targetText ?? `Each creature in a ${w.area.size}-ft. ${w.area.shape}`} rolls vs DC ${w.save.dc}.` : `reach ${melee ? "1 square" : `${w.range ?? 6} squares`}, one target.`} Damage: <code>${w.formula}</code> ${type}${w.flavor ? ` (${w.flavor})` : ""}${w.area ? "" : ` + ${w.attribute ?? (w.intent ?? "violence")}`}.${w.rider ? " " + esc(w.rider) : ""}</p>${w.flavorLine ? `<p><em>${esc(w.flavorLine)}</em></p>` : ""}`, chat: "" } },
    effects: [], flags: { fourththing: { rfi: { item: { tier: ROMAN[sp.tier], frame: w.area ? "save" : "attack", ...(w.area ? { aoeShape: w.area.shape, aoeSize: w.area.size, dc: w.save.dc } : {}) } }, ...(w.npcAuto ? { npcAuto: w.npcAuto } : {}) } }, folder: null, sort: 0, ownership: { default: 0 } };
}
export function ability(sp, a) {
  return { _id: id(), name: a.name, type: a.type ?? "feature", img: a.img ?? ICON.circuit,
    system: { category: a.type === "feat" ? "technique" : "principle", source: "", tags: ["bestiary", `lineage-${sp.lineage}`, ...(a.tags ?? [])],
      description: { value: `<p>${a.desc}</p>${a.flavor ? `<p><em>${esc(a.flavor)}</em></p>` : ""}`, chat: "" } },
    effects: [], flags: { fourththing: { rfi: { item: { tier: ROMAN[sp.tier], frame: a.frame ?? "feature", ...(a.lineageTrait ? { lineageTrait: sp.lineage } : {}) } }, ...(a.npcAuto ? { npcAuto: a.npcAuto } : {}), ...(a.passives ? { passives: a.passives } : {}), ...(a.triggers ? { triggers: a.triggers } : {}) } }, folder: null, sort: 0, ownership: { default: 0 } };
}
export function bossKit(sp, k) {
  const uses = { 1: 1, 2: 2, 3: 2, 4: 3 }[sp.tier];
  return [ability(sp, { name: `Fractured Will (${uses}/scene)`, tags: ["boss", "fractured-will"], desc: `When ${k.pronoun} fails a check, some part of ${k.object} refuses the outcome: ${k.pronoun} succeeds instead. ${uses} time${uses === 1 ? "" : "s"} per scene.`, flavor: k.willFlavor ?? "The mask cracks a little each time.", img: ICON.storm }),
    weapon(sp, { ...k.signature, recharge: true, tags: ["boss", "signature"] }), weapon(sp, { ...k.ultimate, perScene: 1, tags: ["boss", "ultimate"], rider: `ULTIMATE — usable only at or below half Integrity. ${k.ultimate.rider ?? ""}`.trim() })];
}
export function actor(sp) {
  const L = LIN[sp.lineage], T = ROMAN[sp.tier], integ = INTEGRITY[sp.bracket][sp.tier], stress = Math.floor(integ * L.stress);
  const bounty = r5(BOUNTY_BASE[sp.tier] * BR_MULT[sp.bracket]), hire = sp.bracket === "boss" ? null : r5(bounty * 1.5);
  const items = [...sp.items.map(i => i.type === "weapon" ? weapon(sp, i) : ability(sp, i)), ...(sp.boss ? bossKit(sp, sp.boss) : [])];
  const guard = 10 + sp.tier + (sp.bracket === "boss" ? 2 : 0);
  return { _id: sp._id ?? id(), name: sp.name, type: "npc", img: sp.img, folder: sp.folder ?? FOLDER_BAD_EDEN_MONSTERS, sort: 0, ownership: { default: 0 },
    prototypeToken: { name: sp.name, actorLink: false, disposition: sp.disposition ?? -1, texture: { src: sp.img, scaleX: 1, scaleY: 1 }, width: sp.size ?? 1, height: sp.size ?? 1 },
    flags: { "bbttcc-auto-link": { entityKind: "monster", createdViaMonsterBuilder: false, createdBy: "build-bestiary-slots.mjs 2026-10-07", lineage: sp.lineage },
      fourththing: { creatureType: L.creatureType, rfi: { actor: { tier: T, bracket: sp.bracket, archetype: sp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), lineage: sp.lineage, ...(sp.sub ? { subLineage: sp.sub } : {}), title: sp.title, ...(sp.qliphah ? { qliphah: sp.qliphah } : {}),
        bestiary: { themes: sp.themes, role: sp.role, lootTable: sp.loot }, exemplar: true,
        price: { marks: bounty, bounty, hire, ransom: hire, currency: L.currency, gmOverride: false, notes: `T${T} ${sp.bracket} ${sp.lineage} — bounty ${bounty}${hire != null ? ` / hire ${hire}` : ""} marks; credited to the pool matching the method (default ${L.currency})` } } } } },
    system: { role: sp.role, tier: sp.tier, notes: "", details: { level: LEVEL[sp.tier], tier: sp.tier, statPoints: 0, skillPoints: 0, xp: 0 },
      biography: { concept: sp.concept, notes: sp.bio }, faction: { id: null, loyalty: 0 },
      attributes: Object.fromEntries(["violence", "intrigue", "presence", "body", "mind", "soul"].map((k, i) => [k, { value: sp.attrs[i] }])), skills: {},
      derived: { integrity: { value: integ, max: integ, temp: 0 }, stress: { value: stress, max: stress }, guard: { value: guard }, evasion: { value: guard + (sp.role === "stealth" ? 2 : 0) }, resolve: { value: guard + (sp.role === "caster" ? 2 : 0) } },
      magic: { clarity: { value: 2, max: 5 }, noise: { value: 0, max: 10 }, sephirah: sp.sephirah ?? L.tree },
      conditions: {}, actions: { actionUsed: false, bonusUsed: false, reactionUsed: false, movementUsedFt: 0, movementBudgetFt: 30 },
      defenses: { resistances: [...L.resist, ...(sp.resist ?? [])], immunities: sp.immune ?? [], vulnerabilities: [...L.vuln] }, conditionImmunities: [...L.condImm],
      tags: [...new Set([...sp.themes, sp.lineage])], radiation: { rp: 0, thresholds: { minor: 25, major: 50, severe: 75 } }, darkness: { value: 0, taint: 0, fragments: [] } },
    items };
}


/** throw if any weapon on these actors sits outside the tier damage budget */
export function checkBudgets(actors) {
  const problems = [];
  for (const a of actors) for (const it of a.items) if (it.type === "weapon") {
    const limited = /recharges|\/scene/.test(it.name); const [lo, hi] = budgetFor(a.system.details.tier, limited); const m = meanDice(it.system.damage.formula);
    if (m < lo || m > hi) problems.push(`${a.name} › ${it.name}: ${it.system.damage.formula} (mean ${m}) outside T${a.system.details.tier} budget [${lo}, ${hi}]`);
  }
  return problems;
}
/** pack-dump JSONL rows (actor + embedded items) for lint-bestiary / sim-encounter */
export function dumpRows(actors) {
  const rows = [];
  for (const a of actors) { const { items, ...rest } = a; rows.push({ k: `!actors!${a._id}`, v: { ...rest, items: [] } }); for (const it of items) rows.push({ k: `!actors.items!${a._id}.${it._id}`, v: it }); }
  return rows.map(r => JSON.stringify(r)).join("\n") + "\n";
}
