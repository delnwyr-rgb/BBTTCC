/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-core · dice.js — the system-agnostic CHARACTER check (2026-10-08)
 * ─────────────────────────────────────────────────────────────────────────────
 * Owner ruling 2026-10-08 (the dice split): faction-level contests — raid rounds,
 * siege contests, the OP roll, strategic checks — are shared mechanics and stay
 * on the 2d10 die in BOTH flavours. CHARACTER checks (a steward cracking a lock,
 * harvesting a hex, leading a ritual, piloting a chase) use the system's own
 * check: the RFI canon die (`game.fourththing.rolls.checkFormula`, 2d10 with
 * exploding tens) on fourththing, a d20 on dnd5e. Modules call these instead
 * of reaching for `game.fourththing.rolls` with a 2d10 literal fallback.
 *
 *   game.bbttcc.dice.isRFI()                       true on fourththing
 *   game.bbttcc.dice.checkFormula(opts)            "2d10x10" (RFI) | "1d20" (dnd5e; advantage/disadvantage modes)
 *   game.bbttcc.dice.abilityKey(rfiAttr)           "soul" → "wis" on dnd5e (identity on RFI)
 *   game.bbttcc.dice.abilityMod(actor, rfiAttr)    the attribute value (RFI) | the ability modifier (dnd5e)
 *   game.bbttcc.dice.skillRef(rfiSkill)            { kind: skill|tool|attack, key } from the conversion rubric
 *   game.bbttcc.dice.skillBonus(actor, rfiSkill)   flat bonus the skill adds (RFI: attr + rank; dnd5e: skill total)
 *   await game.bbttcc.dice.skillCheck(actor, { skill, attribute, label })   → { total, roll, isFumble }
 *   await game.bbttcc.dice.check(actor, { attribute, bonus, dc, label })     → { total, ok, roll }
 *   await game.bbttcc.dice.flatCheck({ bonus, dc, label })                   → { total, ok, dc, bonus, roll }
 *
 * The RFI→5E maps mirror modules/bad-eden-5e/conversion/rubric.json (abilities,
 * skills). Keep them in step when the rubric changes.
 * ───────────────────────────────────────────────────────────────────────────── */
const TAG = "[bbttcc-core/dice]";
const ABILITY = { violence: "str", intrigue: "dex", body: "con", mind: "int", soul: "wis", presence: "cha" };
const SKILLS = {
  brawl: { kind: "attack", key: "melee" }, melee: { kind: "attack", key: "melee" }, firearms: { kind: "attack", key: "ranged" },
  athletics: { kind: "skill", key: "ath" }, stealth: { kind: "skill", key: "ste" }, streetwise: { kind: "skill", key: "inv" },
  diplomacy: { kind: "skill", key: "per" }, intimidation: { kind: "skill", key: "itm" }, empathy: { kind: "skill", key: "ins" },
  insight: { kind: "skill", key: "ins" }, investigation: { kind: "skill", key: "inv" }, lore: { kind: "skill", key: "his" },
  occult: { kind: "skill", key: "arc" }, faith: { kind: "skill", key: "rel" }, ritual: { kind: "skill", key: "rel" },
  meditation: { kind: "skill", key: "rel" }, perception: { kind: "skill", key: "prc" }, performance: { kind: "skill", key: "prf" },
  hacking: { kind: "tool", key: "tinker" }, tinkering: { kind: "tool", key: "tinker" }, piloting: { kind: "tool", key: "land" },
  plating: { kind: "tool", key: "smith" }, fitting: { kind: "tool", key: "carpenter" }, bracing: { kind: "tool", key: "mason" }
};
const ATTACK_ABILITY = { melee: "str", ranged: "dex" };

const isRFI = () => game.system?.id === "fourththing";
const rfiRolls = () => game.fourththing?.rolls;
const rawSys = (actor) => actor?.system?.system ?? actor?.system ?? {};
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function checkFormula({ mode = "normal", explode = true } = {}) {
  if (isRFI() && typeof rfiRolls()?.checkFormula === "function") return rfiRolls().checkFormula({ mode, explode });
  if (isRFI()) return "2d10x10";
  return mode === "advantage" ? "2d20kh" : mode === "disadvantage" ? "2d20kl" : "1d20";
}

const abilityKey = (attr) => (isRFI() ? attr : (ABILITY[String(attr ?? "").toLowerCase()] ?? attr));

function abilityMod(actor, attr) {
  if (!actor) return 0;
  if (isRFI()) return num(rawSys(actor)?.attributes?.[attr]?.value);
  return num(actor.system?.abilities?.[abilityKey(attr)]?.mod);
}

const skillRef = (skill) => SKILLS[String(skill ?? "").toLowerCase()] ?? null;

/** The flat bonus a skill adds to the check die: RFI attribute + rank; dnd5e the sheet's skill/tool/attack total. */
function skillBonus(actor, skill, attribute) {
  if (!actor) return 0;
  if (isRFI()) {
    const sk = rawSys(actor)?.skills?.[skill] ?? {};
    return abilityMod(actor, attribute || sk.attribute || "violence") + num(sk.value);
  }
  const ref = skillRef(skill);
  if (ref?.kind === "skill") return num(actor.system?.skills?.[ref.key]?.total);
  if (ref?.kind === "tool") return num(actor.system?.tools?.[ref.key]?.total ?? actor.system?.abilities?.int?.mod);
  if (ref?.kind === "attack") return abilityMod(actor, ATTACK_ABILITY[ref.key] === "str" ? "violence" : "intrigue") + num(actor.system?.attributes?.prof);
  return abilityMod(actor, attribute || "violence");
}

const firstRoll = (res) => (Array.isArray(res) ? res[0] : res?.roll ?? res);
const d20Fumble = (roll) => roll?.dice?.[0]?.faces === 20 && roll.dice[0].results?.find(r => r.active)?.result === 1;

/** A skill check in the system's own voice. Returns { total, roll, isFumble } or undefined when nothing rolled. */
async function skillCheck(actor, { skill, attribute, label } = {}) {
  if (!actor || !skill) return;
  if (isRFI() && typeof rfiRolls()?.skillCheck === "function") return rfiRolls().skillCheck(actor, { skill, attribute, label });
  const ref = skillRef(skill);
  const dialog = { configure: false }, message = { create: true, data: label ? { flavor: label } : {} };
  let res = null;
  try {
    if (ref?.kind === "skill" && typeof actor.rollSkill === "function") res = await actor.rollSkill({ skill: ref.key }, dialog, message);
    else if (ref?.kind === "tool" && typeof actor.rollToolCheck === "function") res = await actor.rollToolCheck({ tool: ref.key }, dialog, message);
    else if (typeof actor.rollAbilityCheck === "function") res = await actor.rollAbilityCheck({ ability: abilityKey(attribute || (ref?.kind === "attack" ? (ATTACK_ABILITY[ref.key] === "str" ? "violence" : "intrigue") : "violence")) }, dialog, message);
  } catch (e) { console.warn(TAG, "system roll failed, falling back to a plain check", e); }
  const roll = firstRoll(res);
  if (roll?.total == null) {
    // No sheet roll available (a bare actor type): plain die + the skill's bonus.
    const plain = await new Roll(`${checkFormula()} + @b`, { b: skillBonus(actor, skill, attribute) }).evaluate();
    await plain.toMessage({ flavor: label || `${skill} check`, speaker: ChatMessage.getSpeaker({ actor }) }).catch(() => {});
    return { total: plain.total, roll: plain, isFumble: d20Fumble(plain) };
  }
  return { total: num(roll.total), roll, isFumble: !!(roll.isFumble ?? d20Fumble(roll)) };
}

/** An attribute check: the check die + the attribute (RFI value / dnd5e modifier) + bonus, vs dc. */
async function check(actor, { attribute = "violence", bonus = 0, dc = null, label = "", speaker } = {}) {
  const b = abilityMod(actor, attribute) + num(bonus);
  const roll = await new Roll(`${checkFormula()} + @b`, { b }).evaluate();
  const ok = dc == null ? null : roll.total >= num(dc);
  if (label !== false) await roll.toMessage({
    flavor: `${label || "Check"}${dc != null ? ` vs DC ${dc} — ${ok ? "success" : "failure"}` : ""}`,
    speaker: speaker ?? ChatMessage.getSpeaker({ actor })
  }).catch(() => {});
  return { total: roll.total, ok, roll, bonus: b, dc };
}

/** A flat check with no actor: the check die + bonus vs dc (the RFI flatCheck on fourththing). */
async function flatCheck({ bonus = 0, dc = null, label = "", mode = "normal" } = {}) {
  if (isRFI() && typeof rfiRolls()?.flatCheck === "function") return rfiRolls().flatCheck({ bonus, dc, label, mode });
  const roll = await new Roll(`${checkFormula({ mode })} + @b`, { b: num(bonus) }).evaluate();
  const ok = dc == null ? null : roll.total >= num(dc);
  if (label) await roll.toMessage({ flavor: `${label}${dc != null ? ` vs DC ${dc} — ${ok ? "success" : "failure"}` : ""}` }).catch(() => {});
  return { total: roll.total, ok, dc, bonus: num(bonus), roll };
}

/* ── Active Effect keys: the RFI aeBonus channels → their dnd5e twins ─────────
 * RFI folds `system.derived.<defense>.aeBonus` into Guard / Evasion / Resolve and the
 * max pools; dnd5e has native bonus fields for the same things (rubric: Guard → AC,
 * Evasion → Dex save, Resolve → Wis save, Integrity → HP, Stress → temp max HP,
 * casting → spell DC). RFI skill ranks → the mapped skill's check bonus. */
const AE_KEYS = {
  "system.derived.guard.aeBonus":     "system.attributes.ac.bonus",
  "system.derived.evasion.aeBonus":   "system.abilities.dex.bonuses.save",
  "system.derived.resolve.aeBonus":   "system.abilities.wis.bonuses.save",
  "system.derived.initiative.bonus":  "system.attributes.init.bonus",
  "system.derived.integrity.aeBonus": "system.attributes.hp.bonuses.overall",
  "system.derived.stress.aeBonus":    "system.attributes.hp.tempmax",
  "system.magic.castBonus":           "system.bonuses.spell.dc"
};
function aeKey(key) {
  if (isRFI()) return key;
  const k = String(key ?? "");
  if (AE_KEYS[k]) return AE_KEYS[k];
  const m = k.match(/^system\.skills\.([a-z]+)\.value$/);
  if (m) { const ref = skillRef(m[1]); if (ref?.kind === "skill") return `system.skills.${ref.key}.bonuses.check`; if (ref?.kind === "tool") return `system.tools.${ref.key}.bonuses.check`; }
  const a = k.match(/^system\.attributes\.([a-z]+)\.value$/);
  if (a && ABILITY[a[1]]) return `system.abilities.${ABILITY[a[1]]}.value`;
  return k;
}
/** Translate a whole changes[] for the running system (keys only; modes/values untouched). */
const aeChanges = (changes) => (changes ?? []).map(c => ({ ...c, key: aeKey(c.key) }));

/* ── Document types: the RFI-only Actor/Item types → their dnd5e twins ───────── */
const ACTOR_TYPES = { rig: "vehicle", boss: "npc" };
const ITEM_TYPES = { gear: "loot", feature: "feat" };
const types = {
  actor: (t) => (isRFI() ? t : (ACTOR_TYPES[t] ?? t)),
  item: (t) => (isRFI() ? t : (ITEM_TYPES[t] ?? t)),
  hasActor: (t) => (globalThis.Actor?.TYPES ?? []).includes(t),
  hasItem: (t) => (globalThis.Item?.TYPES ?? []).includes(t)
};

/* ── Compendium twins: RFI-format packs → their dnd5e conversions (bad-eden-5e lanes, 2026-10-08) ──
 * On dnd5e the RFI-native packs aren't registered (the D&D overlay drops them); the bad-eden-5e
 * converter builds dnd5e twins under these ids. `game.bbttcc.packs.get(rfiId)` returns whichever exists. */
const PACK_TWINS = {
  "bbttcc-master-content.courtly-secrets": "bad-eden-5e.courtly-secrets",
  "bbttcc-character-options.npc-callings": "bad-eden-5e.npc-callings",
  "bbttcc-tikkun.sparks": "bad-eden-5e.sparks"
};
const packs = {
  id: (rfiId) => (isRFI() ? rfiId : (game.packs?.get(rfiId) ? rfiId : (PACK_TWINS[rfiId] ?? rfiId))),
  get: (rfiId) => game.packs?.get(packs.id(rfiId)) ?? null,
  is: (pack, rfiId) => !!pack && (pack === rfiId || pack === PACK_TWINS[rfiId]),
  TWINS: PACK_TWINS
};

Hooks.once("init", () => {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.packs = packs;
  game.bbttcc.dice = { isRFI, checkFormula, abilityKey, abilityMod, skillRef, skillBonus, skillCheck, check, flatCheck, aeKey, aeChanges, ABILITY, SKILLS, AE_KEYS };
  game.bbttcc.types = types;
  console.log(TAG, `installed game.bbttcc.dice (${isRFI() ? "RFI canon die" : "d20"})`);
});
