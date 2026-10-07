/* npc-auto-schema.mjs — validate NPC automation data against what the system ACTUALLY executes
 * (systems/fourththing/npc-automation.js rules + module.js weapon manifestation shapes). Used by lint-bestiary (M4) and the
 * pass-3 builder. Returns a list of problems (empty = valid). Unknown keys are errors: the engine would ignore them silently.
 */
export const CONDITIONS = ["staggered", "scarred", "calmed", "blinded", "prone", "shaken", "burning", "restrained", "charmed", "compelled", "imposed"];
export const ATTRS = ["violence", "intrigue", "presence", "body", "mind", "soul"];
export const DAMAGE_TYPES = ["kinetic", "electrical", "thermal", "chemical", "poison", "sephirotic", "psychic", "qliphothic", "radiation"];
const ON = ["attack", "hit", "turnStart", "selfTurnStart", "bloodied", "zero", "allyDamaged", "use", "saveFail", "struck", "damaged", "attacked"];
const IF = ["firstRound", "targetNotActed", "allyAdjacentToTarget", "targetTag", "targetCondition", "weapon", "damageType", "ownerNotAttacked", "ownerBloodied", "targetBloodied"];
const DO = ["reroll", "condition", "save", "damage", "dot", "radiation", "noReactions", "tempIntegrity", "heal", "morale", "ward", "prompt"];
const DURATIONS = ["1-round", "2-rounds", "3-rounds", "until-saved", "scene"];
const FORMULA = /^\d+(d\d+)?([+-]\d+)?$/;
// ftPlaceAreaTemplate's vocabulary (module.js SHAPE_MAP) — NOT Foundry's circle/ray/rect
export const AREA_SHAPES = ["cone", "sphere", "line", "cube", "cylinder"];
export const AREA_ALIAS = { circle: "sphere", ray: "line", rect: "cube", radius: "sphere", burst: "sphere", emanation: "sphere" };

export function validateNpcAuto(na, where = "") {
  const p = []; const err = m => p.push(`${where}${m}`);
  if (!na) return p;
  if (typeof na !== "object") return [`${where}npcAuto not an object`];
  for (const k of Object.keys(na)) if (!["v", "rules", "recharge", "spent"].includes(k)) err(`unknown npcAuto key "${k}"`);
  if (na.recharge) {
    if (!["d6", "combat"].includes(na.recharge.mode)) err(`recharge.mode "${na.recharge.mode}"`);
    if (na.recharge.mode === "d6" && !(na.recharge.min >= 2 && na.recharge.min <= 6)) err(`recharge.min ${na.recharge.min}`);
  }
  (na.rules ?? []).forEach((r, i) => {
    const w = `rule ${i} `;
    if (!ON.includes(r.on)) err(`${w}on "${r.on}"`);
    for (const k of Object.keys(r)) if (!["on", "if", "do", "radius", "who", "limit", "label"].includes(k)) err(`${w}unknown key "${k}"`);
    for (const k of Object.keys(r.if ?? {})) if (!IF.includes(k)) err(`${w}unknown if.${k}`);
    if (!r.do || !Object.keys(r.do).length) err(`${w}empty do`);
    for (const k of Object.keys(r.do ?? {})) if (!DO.includes(k)) err(`${w}unknown do.${k}`);
    const d = r.do ?? {};
    if (d.reroll && !["attack", "damage", "damage-highest", "attack-highest"].includes(d.reroll)) err(`${w}reroll "${d.reroll}"`);
    if (d.reroll && d.reroll !== "attack-highest" && r.on !== "attack") err(`${w}reroll needs on:"attack"`);
    if (d.reroll === "attack-highest" && r.on !== "attacked") err(`${w}attack-highest needs on:"attacked"`);
    if (r.on === "attacked" && d.reroll !== "attack-highest") err(`${w}on:"attacked" only supports do.reroll:"attack-highest"`);
    if (r.on === "damaged" && (d.condition || d.save || d.damage || d.dot || d.radiation || d.noReactions)) err(`${w}on:"damaged" has no target — self effects only (heal/tempIntegrity/prompt)`);
    if (r.who && r.on === "use" && !["self", "targets"].includes(r.who)) err(`${w}use who "${r.who}"`);
    for (const k of ["damageType"]) if (r.if?.[k] && !Array.isArray(r.if[k])) err(`${w}if.${k} must be an array`);
    if (r.if?.damageType) for (const t of r.if.damageType) if (!DAMAGE_TYPES.includes(t)) err(`${w}if.damageType "${t}"`);
    if (d.condition) {
      if (!CONDITIONS.includes(d.condition.key)) err(`${w}condition "${d.condition.key}"`);
      if (d.condition.duration && !DURATIONS.includes(d.condition.duration)) err(`${w}duration "${d.condition.duration}"`);
      if (d.condition.save && (!ATTRS.includes(d.condition.save.attr) || !(Number(d.condition.save.dc) > 0))) err(`${w}condition.save ${JSON.stringify(d.condition.save)}`);
    }
    if (d.save && (!ATTRS.includes(d.save.attr) || !(Number(d.save.dc) > 0))) err(`${w}save ${JSON.stringify(d.save)}`);
    for (const k of ["damage", "dot"]) if (d[k]) {
      if (!FORMULA.test(String(d[k].formula).replace(/\s+/g, ""))) err(`${w}${k}.formula "${d[k].formula}"`);
      if (d[k].type && !DAMAGE_TYPES.includes(d[k].type)) err(`${w}${k}.type "${d[k].type}"`);
    }
    if (d.dot?.ends && !["action", "rounds", "turn"].includes(d.dot.ends)) err(`${w}dot.ends "${d.dot.ends}"`);
    for (const k of ["tempIntegrity", "heal"]) if (d[k] !== undefined && !(typeof d[k] === "number" || FORMULA.test(String(d[k]).replace(/\s+/g, "")))) err(`${w}${k} "${d[k]}"`);
    if (d.morale && (!ATTRS.includes(d.morale.attr || "soul") || !(Number(d.morale.dc) > 0))) err(`${w}morale ${JSON.stringify(d.morale)}`);
    if (d.morale && r.on !== "bloodied") err(`${w}morale needs on:"bloodied"`);
    if (d.ward !== undefined && (r.on !== "allyDamaged" || !(d.ward >= 0 && d.ward < 1))) err(`${w}ward ${d.ward} (needs on:"allyDamaged", 0 ≤ ward < 1)`);
    if (r.on === "turnStart" && !(r.radius > 0)) err(`${w}aura needs radius`);
    if (r.who && r.on !== "use" && !["enemies", "allies", "all"].includes(r.who)) err(`${w}who "${r.who}"`);
    if (r.limit && (!["round", "combat", "scene"].includes(r.limit.per) || !(r.limit.uses >= 1))) err(`${w}limit ${JSON.stringify(r.limit)}`);
  });
  return p;
}

export function validateWeaponManifestation(mf, where = "") {
  const p = []; const err = m => p.push(`${where}${m}`);
  if (!mf) return p;
  const r = mf.resolution;
  if (r) {
    if (!ATTRS.includes(r.saveAttribute)) err(`resolution.saveAttribute "${r.saveAttribute}"`);
    if (!["fixed", "cast-dc", undefined].includes(r.saveDcMode)) err(`resolution.saveDcMode "${r.saveDcMode}"`);
    if (r.saveDcMode === "fixed" && !(Number(r.saveDcFixed) > 0)) err(`resolution fixed DC needs saveDcFixed`);
    if (r.onSave && !["half", "negate"].includes(r.onSave)) err(`resolution.onSave "${r.onSave}"`);
    if (r.mode && r.mode !== "save") err(`resolution.mode "${r.mode}"`);
  }
  // states: array (authored) or object-of-booleans (wizard shape) — the system normalizes both
  for (const s of statesList(mf.appliedStates?.states)) if (!CONDITIONS.includes(s)) err(`state "${s}"`);
  if (mf.appliedStates?.duration && !DURATIONS.includes(mf.appliedStates.duration)) err(`duration "${mf.appliedStates.duration}"`);
  if (mf.area && mf.area.shape && mf.area.shape !== "none" && (!AREA_SHAPES.includes(mf.area.shape) || !(mf.area.size > 0))) err(`area ${JSON.stringify(mf.area)}`);
  if (mf.riderDamage && !(mf.riderDamage.number > 0 && /^d\d+$/.test(mf.riderDamage.die))) err(`riderDamage ${JSON.stringify(mf.riderDamage)}`);
  return p;
}

export const statesList = st => Array.isArray(st) ? st : (st && typeof st === "object" ? Object.keys(st).filter(k => st[k]) : []);
