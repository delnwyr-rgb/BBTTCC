/* rider-parse.mjs — turn a monster weapon's prose rider (`system.effect`) into the system's own manifestation data, so the
 * rider actually happens in play (owner ask 2026-10-06: "anything with a described mechanical effect should happen").
 * Three shapes, all executed by EXISTING system machinery (module.js, 2026-10-06 wiring):
 *   ON-HIT          "On a hit, the target is Staggered…"          → appliedStates (auto-applied on the hit)
 *   ON-HIT SAVE     "On a hit … Body vs DC 13 or be knocked Prone" → resolution{saveAttribute,fixed DC,onSave:negate,statesOnFail}
 *                                                                     + appliedStates (+ riderDamage) → save-prompt card
 *   SAVE-FIRST      "15 ft. cone. Resolve vs DC 13. Fail: …"       → resolution{mode:"save",…} (+ area) → no attack roll,
 *                                                                     a save card per target (weapon damage, half/negate)
 * Returns { shape, manifestation, notes[] } or null when the prose isn't one of these (left for the npc-automation engine).
 */
const ATTR = { body: "body", mind: "mind", soul: "soul", presence: "presence", intrigue: "intrigue", violence: "violence",
  // defenses named as saves map to the faculty that leads them (Resolve = Presence+Soul, Guard = Violence+Body, Evasion = Intrigue+Body)
  resolve: "soul", guard: "body", evasion: "intrigue", fortitude: "body", will: "soul", reflex: "intrigue", dexterity: "intrigue",
  constitution: "body", strength: "body", wisdom: "soul", charisma: "presence", intelligence: "mind" };
const COND = [
  [/\bknock(?:ed|s)? (?:it |them |the target )?prone|\bprone\b/i, "prone"], [/\bstaggered\b|\bstunned\b|\bdazed\b|\bpoisoned\b/i, "staggered"],
  [/\bshaken\b|\bfrightened\b|\bterrified\b|\bpanick?ed\b/i, "shaken"], [/\brestrained\b|\bgrappled\b|\bentangled\b|\bpinned\b/i, "restrained"],
  [/\bblind(?:ed)?\b/i, "blinded"], [/\bburning\b|\bon fire\b|catches? fire/i, "burning"], [/\bcharmed\b/i, "charmed"], [/\bcompelled\b/i, "compelled"],
  [/disadvantage on (?:its|their|the) next attack|\bimposed\b/i, "imposed"], [/\bcalmed\b/i, "calmed"], [/\bscarred\b/i, "scarred"],
];
const conditionsIn = t => [...new Set(COND.filter(([re]) => re.test(t)).map(([, k]) => k))];
function durationIn(t) {
  if (/save (?:at the end of each|each round|again at the end)|repeat(?:s)? the save|save to end|until (?:it|they) (?:succeeds?|saves?)/i.test(t)) return { duration: "until-saved", saveEachRound: true };
  if (/\b(?:for )?(?:2|two) rounds\b/i.test(t)) return { duration: "2-rounds" };
  if (/\b(?:for )?(?:3|three) rounds\b/i.test(t)) return { duration: "3-rounds" };
  if (/until the end of the scene|for the (?:rest of the )?scene|1 minute/i.test(t)) return { duration: "scene" };
  return { duration: "1-round" };
}
function saveIn(t) {
  const m = t.match(/\b(Body|Mind|Soul|Presence|Intrigue|Violence|Resolve|Guard|Evasion|Fortitude|Will|Reflex|Dexterity|Constitution|Strength|Wisdom|Charisma|Intelligence)\b(?:\s+(?:check|save|saving throw))?\s*(?:vs\.?|\(|against)?\s*DC\s*(\d+)/i)
    || t.match(/DC\s*(\d+)\s+(Body|Mind|Soul|Presence|Intrigue|Violence|Resolve|Guard|Evasion)\b/i);
  if (!m) return null;
  const [attrWord, dc] = isNaN(Number(m[1])) ? [m[1], m[2]] : [m[2], m[1]];
  return { saveAttribute: ATTR[attrWord.toLowerCase()] || "body", saveDcMode: "fixed", saveDcFixed: Number(dc) };
}
function areaIn(t) {
  const m = t.match(/(\d+)[- ](?:ft\.?|foot|feet)[- ]?(cone|line|cube|radius|sphere|burst|emanation)|radius (\d+) ?ft/i);
  if (!m) return null;
  const size = Number(m[1] || m[3]), shapeWord = (m[2] || "radius").toLowerCase();
  // ftPlaceAreaTemplate speaks the 5e words (cone/sphere/line/cube/cylinder) and maps them to Foundry's t itself
  const shape = { cone: "cone", line: "line", cube: "cube", radius: "sphere", sphere: "sphere", burst: "sphere", emanation: "sphere" }[shapeWord];
  return { shape, size };
}
function riderDamageIn(t) {
  const m = t.match(/(?:takes?|deals?|plus|and|extra|additional)\s+(\d+)(d\d+)(?:\s*\+\s*(\d+))?\s+(?:additional\s+|extra\s+)?([a-z]+)/i);
  if (!m) return null;
  const type = m[4].toLowerCase();
  const known = ["kinetic", "electrical", "thermal", "chemical", "poison", "sephirotic", "psychic", "qliphothic", "energy", "fire", "cold", "acid"];
  if (!known.includes(type)) return null;
  const alias = { fire: ["thermal", "hot"], cold: ["thermal", "cold"], acid: ["chemical", "acid"], energy: ["electrical", ""] }[type];
  return { op: "damage", number: Number(m[1]), die: m[2], bonus: Number(m[3]) || 0, type: alias ? alias[0] : type, flavor: alias ? alias[1] : "" };
}

export function parseRider(text) {
  const t = String(text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const notes = [];
  const save = saveIn(t), conds = conditionsIn(t), area = areaIn(t), dur = durationIn(t);
  const onHit = /\bon a (?:hit|failed save)|\bon hit\b|\bif (?:it|the attack) hits\b|\bhit:/i.test(t) && !/^\s*\d+[- ]?ft/i.test(t);
  const halfOnSave = /half(?: damage)?(?: on (?:a )?(?:success|save|successful save))|half on success|save for half|success: half/i.test(t);
  const noStatesOnSave = /no (?:\w+ )?(?:on|if) (?:a )?success|on success.*no |half and no|success: half(?:, no)?|negates?/i.test(t) || halfOnSave;
  const saveFirst = !!save && (!!area || /^\s*(?:one|each|every|all) (?:creature|target)|targets? (?:roll|make)|^\s*\d+[- ]?ft/i.test(t)) && !onHit;

  if (saveFirst) {
    const mf = {
      resolution: { mode: "save", ...save, onSave: halfOnSave ? "half" : "negate", statesOnFail: noStatesOnSave || !halfOnSave },
      appliedStates: conds.length ? { states: conds, ...dur, saveAttribute: dur.saveEachRound ? save.saveAttribute : undefined } : undefined,
    };
    if (area) mf.area = area; else notes.push("no area parsed — uses the GM's targets");
    if (!conds.length) notes.push("damage-only save");
    return { shape: "save-first", manifestation: clean(mf), notes };
  }
  if (onHit && save && (conds.length || riderDamageIn(t))) {
    const rd = riderDamageIn(t);
    const mf = {
      resolution: { ...save, onSave: "negate", statesOnFail: true },
      appliedStates: conds.length ? { states: conds, ...dur, saveAttribute: dur.saveEachRound ? save.saveAttribute : undefined } : undefined,
      riderDamage: rd || undefined,
    };
    return { shape: "on-hit-save", manifestation: clean(mf), notes };
  }
  if (onHit && conds.length && !save) {
    if (/\bif\b|\bunless\b|against a creature|its size or smaller|hidden|first/i.test(t)) notes.push("conditional — engine predicate needed; applied unconditionally for now");
    return { shape: "on-hit", manifestation: clean({ appliedStates: { states: conds, ...dur } }), notes };
  }
  return null;
}
function clean(o) { return JSON.parse(JSON.stringify(o)); }   // drops undefined
