// D&D 5e Table Kit — "next roll" riders, no midi-qol.
//
// Surge Powers arms one-shot riders as flags.surge-powers.oneShot.<key>. This
// file consumes them inside dnd5e's own roll pipeline, on the client that makes
// the roll (which owns the actor, so it can clear the flag):
//
//   any d20  bonusDie       → advantage on the next d20 test (one extra die, keep best)
//   attack   advAttack      → advantage                     (Snap Strike)
//            powerSurge     → + Prof to the attack roll, SPENT on the attack (hit or miss), and
//                             + Prof to THAT attack's damage only (Power Surge; RFI Tier Surge twin)
//            finalArgument  → auto-hit (roll option read by automation.js), then
//                             max damage + Prof on the following damage roll
//   damage   doomstrike     → + Prof d6                       (Doomstrike)
//            surgingCast    → maximise one die (spell/feature) (Surging Cast)
//            wrathCascade   → reroll 1s and 2s once            (Wrath Cascade)
//            cinderwake     → maximise every die               (Cinderwake)
//            crowningBlow   → critical with maximised dice     (Crowning Blow)
//            ignoreResists  → message flag; automation applies with resistance ignored
//            pressHarder    → melee only: + Prof flat damage           (Aurablade: Press Harder)
//            (RFI parity 11-13: the HIT riders — doomstrike, crowningBlow, finalArgument, ignoreResists,
//             absorbStrike, pressHarder — stay armed when this activity's last attack is a known miss)
//   save     autoSaveOnce   → the save is marked resisted (forced success)  (Iron Word)
//
// reactionMiss is consumed by automation.js when damage would be applied.

export const ID = "dnd5e-table-kit";
const SURGE = "surge-powers";
const { Die, NumericTerm, OperatorTerm } = foundry.dice.terms;

/** Riders consumed locally but whose flag update hasn't round-tripped yet. */
const spent = new Set();

function armed(actor, key) {
  if ( !actor ) return false;
  if ( spent.has(`${actor.uuid}.${key}`) ) return false;
  return actor.flags?.[SURGE]?.oneShot?.[key] === true;
}

function consume(actor, ...keys) {
  const update = {};
  for ( const key of keys ) {
    spent.add(`${actor.uuid}.${key}`);
    update[`flags.${SURGE}.oneShot.${key}`] = false;
  }
  actor.update(update).catch(err => console.warn(`${ID} | could not clear rider`, keys, err))
    .finally(() => keys.forEach(k => spent.delete(`${actor.uuid}.${k}`)));
}

/** Take every armed rider in `keys`, returning the ones that were armed. */
function take(actor, keys) {
  const hits = keys.filter(k => armed(actor, k));
  if ( hits.length ) consume(actor, ...hits);
  return new Set(hits);
}

// 10-29: the preRoll*V2 hooks fire BEFORE the roll configuration dialog, and closing that
// dialog makes no roll — so the pre-roll hooks only shape the config and mark what they
// would spend here; onPostRollConfig spends it (and posts the notes) once rolls exist.
const PENDING = `${ID}Spend`;

/** Pick every armed rider in `keys` for this roll without spending it yet. */
function pick(config, actor, keys, text) {
  const hits = keys.filter(k => armed(actor, k));
  if ( !hits.length ) return new Set();
  const p = config[PENDING] ??= { actor, keys: new Set(), notes: [] };
  hits.forEach(k => p.keys.add(k));
  if ( text ) p.notes.push(text);
  return new Set(hits);
}

/** Park Active Effects to delete once this roll is actually made (midi/DAE `specialDuration: 1Attack`). */
function expireAfter(config, actor, effects, text) {
  if ( !effects.length ) return;
  const p = config[PENDING] ??= { actor, keys: new Set(), notes: [] };
  (p.effects ??= []).push(...effects);
  if ( text ) p.notes.push(text);
}

function onPostRollConfig(rolls, config) {
  const p = config?.[PENDING];
  if ( !p ) return;
  delete config[PENDING];
  if ( !rolls?.length ) return;   // dialog closed: nothing rolled, nothing spent
  if ( p.keys.size ) consume(p.actor, ...p.keys);
  if ( p.clearSurgeDamage ) clearSurgeDamage(p.actor);
  for ( const effect of p.effects ?? [] ) {
    if ( p.actor?.isOwner ) effect.delete().catch(err => console.warn(`${ID} | could not expire effect`, effect.name, err));
    else ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM"), speaker: { alias: "Table Kit" },
      content: `<p style="margin:0">⚡ <em>${foundry.utils.escapeHTML(effect.name)}</em> on <em>${foundry.utils.escapeHTML(p.actor?.name ?? "?")}</em> has been used — remove it (this seat can't).</p>` }).catch(() => {});
  }
  for ( const text of p.notes ) note(p.actor, text);
}

const profOf = actor => Number(actor?.system?.attributes?.prof) || 2;
const actorOf = subject => subject?.actor ?? (subject instanceof Actor ? subject : null);

function note(actor, text) {
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p style="margin:0">⚡ <em>${text}</em></p>`
  }).catch(() => {});
}

/* -------------------------------------------- */
/*  d20 tests                                   */
/* -------------------------------------------- */

function onPreRollD20(config) {
  const actor = actorOf(config.subject);
  if ( pick(config, actor, ["bonusDie"], "Bonus Die: rolling an extra d20, keeping the best.").size ) {
    config.advantage = true;
  }
}

/**
 * Effect-driven attack modes (dnd5e 6 has no native AE key for these):
 *   flags.dnd5e-table-kit.advantage.attack            scope — the bearer's attacks have advantage
 *   flags.dnd5e-table-kit.disadvantage.attack         scope — the bearer's attacks have disadvantage
 *   flags.dnd5e-table-kit.grants.advantage.attack     truthy, on the TARGET — attacks against it have advantage
 *   flags.dnd5e-table-kit.grants.disadvantage.attack  truthy, on the TARGET — attacks against it have disadvantage
 *                                                     (or a creature-type list: only attackers of those types)
 * Scope: "all" | "weapon" | "melee" | "ranged" | an ability key ("str", "dex"…) for attacks using it.
 * Advantage and disadvantage together cancel, exactly as dnd5e resolves them.
 *
 * 10-31 (review C53): content authored for midi tables writes the same intent as
 *   flags.midi-qol.advantage.attack.{all|mwak|rwak|msak|rsak|<ability>} = 1   (and disadvantage / grants.*)
 *   flags.dnd5e.advantage.attack.{…}                                         (no such native key in dnd5e 6)
 * (the rig actions' Hold Position / Aimed Shot AEs). Both are honoured here as aliases, and an effect
 * carrying flags.dae.specialDuration ["1Attack"] expires once the bearer's attack roll is made.
 */
const MIDI_SCOPES = { mwak: ["weapon", "melee"], rwak: ["weapon", "ranged"], msak: ["spell", "melee"], rsak: ["spell", "ranged"] };
function midiMatches(obj, activity) {
  if ( !obj || (typeof obj !== "object") ) return false;
  const on = v => !!v && (v !== "0") && (v !== "false");
  if ( on(obj.all) ) return true;
  const kind = activity?.attack?.type?.classification ?? ((activity?.item?.type === "weapon") ? "weapon" : "spell");
  const range = activity?.attack?.type?.value;
  for ( const [key, [cls, rng]] of Object.entries(MIDI_SCOPES) ) {
    if ( on(obj[key]) && (kind === cls) && (range === rng) ) return true;
  }
  return Object.keys(CONFIG.DND5E.abilities ?? {}).some(a => on(obj[a]) && (activity?.ability === a));
}
const midiFlag = (actor, path, activity) => [actor?.flags?.["midi-qol"], actor?.flags?.dnd5e]
  .some(f => midiMatches(foundry.utils.getProperty(f ?? {}, path), activity));
function attackMatches(scope, activity) {
  if ( !scope ) return false;
  if ( (scope === true) || (scope === "all") || (scope === "1") ) return true;
  const isWeapon = activity?.item?.type === "weapon";
  const type = activity?.attack?.type?.value;   // "melee" | "ranged"
  if ( scope === "weapon" ) return isWeapon;
  if ( (scope === "melee") || (scope === "ranged") ) return type === scope;
  if ( scope in (CONFIG.DND5E.abilities ?? {}) ) return activity?.ability === scope;
  return false;
}

/** 11-12: a grants.* flag is truthy ("all"/1/true) or a list of creature types the ATTACKER must be
 *  (Protection from Evil and Good: "aberration,celestial,elemental,fey,fiend,undead"). */
function grantsMatch(value, attacker) {
  if ( !value ) return false;
  const v = String(value).trim().toLowerCase();
  if ( ["1", "true", "all"].includes(v) || (value === true) ) return true;
  const types = v.split(/[,\s]+/).filter(Boolean);
  const d = attacker?.system?.details ?? {};
  const t = String(d.type?.value ?? d.race?.system?.type?.value ?? d.race?.type?.value ?? "").toLowerCase();
  return !!t && types.includes(t);
}

function attackTargets(activity) {
  const fromUser = [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
  return fromUser;
}

function applyEffectAttackModes(config, actor) {
  const activity = config.subject;
  const mine = actor.flags?.[ID] ?? {};
  if ( attackMatches(mine.advantage?.attack, activity) ) config.advantage = true;
  if ( attackMatches(mine.disadvantage?.attack, activity) ) config.disadvantage = true;
  const targets = attackTargets(activity);
  if ( targets.some(t => grantsMatch(t.flags?.[ID]?.grants?.advantage?.attack, actor)) ) config.advantage = true;
  if ( targets.some(t => grantsMatch(t.flags?.[ID]?.grants?.disadvantage?.attack, actor)) ) config.disadvantage = true;
  // midi-qol / flags.dnd5e aliases (C53)
  if ( midiFlag(actor, "advantage.attack", activity) ) config.advantage = true;
  if ( midiFlag(actor, "disadvantage.attack", activity) ) config.disadvantage = true;
  if ( targets.some(t => midiFlag(t, "grants.advantage.attack", activity)) ) config.advantage = true;
  if ( targets.some(t => midiFlag(t, "grants.disadvantage.attack", activity)) ) config.disadvantage = true;
  // DAE-style one-attack effects (Aimed Shot) go once this attack is really rolled.
  const oneShot = (actor.effects ?? []).filter(e => !e.disabled
    && [].concat(e.flags?.dae?.specialDuration ?? []).includes("1Attack"));
  expireAfter(config, actor, oneShot, oneShot.length ? `${oneShot.map(e => e.name).join(", ")}: used on this attack.` : "");
}

function onPreRollAttack(config) {
  const actor = actorOf(config.subject);
  if ( !actor ) return;
  applyEffectAttackModes(config, actor);
  const got = pick(config, actor, ["advAttack", "powerSurge"]);
  if ( got.has("advAttack") ) config.advantage = true;
  // surge repricing mirror 2026-11-13 (Dave: heals = Nd6 × PB; Tier → PB)
  // RFI parity 11-13 (Dave): Tier Surge is consumed on the Strike whether it hits or misses
  // (module.js _ftReadSurgeOneShots → consumed, not consumedOnHit). So Power Surge is SPENT on this
  // attack roll; its +PB damage half is re-armed as a separate one-shot for THIS activity's damage
  // (armSurgeDamage on dnd5e.rollAttackV2, once the roll exists and only if it isn't a known miss).
  if ( got.has("powerSurge") ) {
    const prof = profOf(actor);
    config.rolls ??= [{}];
    config.rolls[0].parts = [...(config.rolls[0].parts ?? []), String(prof)];
    foundry.utils.setProperty(config.rolls[0], `options.${ID}PowerSurge`, prof);
    config[PENDING].notes.push(`Power Surge: + ${prof} to this attack (spent, hit or miss) and + ${prof} to its damage.`);
  }
  // Final Argument and Crowning Blow stay armed for their damage half; flag this attack as a sure hit.
  if ( armed(actor, "finalArgument") || armed(actor, "crowningBlow") ) {
    config.rolls ??= [{}];
    foundry.utils.setProperty(config.rolls[0], `options.${ID}AutoHit`, true);
  }
}

function onPreRollSave(config, dialog, message) {
  const actor = actorOf(config.subject);
  if ( pick(config, actor, ["autoSaveOnce"], "Iron Word: this saving throw succeeds automatically.").size ) {
    foundry.utils.setProperty(message, "data.system.resisted", true);
  }
}

/* -------------------------------------------- */
/*  Attack outcome + Power Surge damage half    */
/* -------------------------------------------- */

// RFI parity 11-13: last attack per actor → { activity uuid, hit: true | false | null (no target / unknown) }.
const lastAttack = new Map();
// Power Surge damage half: flags.dnd5e-table-kit.surgeDamage = { activity, item, bonus, at, combat, round, turn }.
// `surgeLocal` mirrors it on this client so an auto-damage roll right after the attack sees it before the
// flag update round-trips; `surgeUsed` remembers each claimed half (actor uuid | at) so a flag whose arm or
// clear is still in flight can never be claimed twice (review 11-13: auto-damage claims the half before the
// arm update lands, so a clear that only checked actor.flags was a no-op and the arm then left it re-claimable).
const SURGE_DMG = "surgeDamage";
const surgeLocal = new Map();
const surgeUsed = new Set();
const surgeKey = (actor, s) => `${actor.uuid}|${s?.at}`;
const SURGE_DMG_TTL = 10 * 60 * 1000;   // out of combat nothing ends a turn, so a stale half lapses after 10 min

function rollHits(roll, ac) {
  if ( roll?.options?.[`${ID}AutoHit`] ) return true;
  if ( roll?.isCritical ) return true;
  if ( roll?.isFumble ) return false;
  if ( (ac === null) || (ac === undefined) || !Number.isFinite(Number(ac)) ) return null;
  return roll.total >= Number(ac);
}

/** true = hit at least one target, false = missed every known target, null = no target to judge by. */
function attackOutcome(roll) {
  const usage = game.messages?.get?.(roll?.options?.originatingMessage);
  const targets = usage?.system?.targets?.length ? usage.system.targets
    : [...(game.user?.targets ?? [])].map(t => ({ ac: t.actor?.system?.attributes?.ac?.value ?? null }));
  if ( roll?.options?.[`${ID}AutoHit`] || roll?.isCritical ) return true;
  if ( roll?.isFumble ) return false;
  const res = targets.map(t => rollHits(roll, t.ac)).filter(r => r !== null);
  if ( !res.length ) {
    const t = Number(roll?.options?.target);
    return Number.isFinite(t) && (roll?.total !== undefined) ? roll.total >= t : null;
  }
  return res.some(Boolean);
}

const combatStamp = () => {
  const c = game.combat;
  return c?.started ? { combat: c.id, round: c.round, turn: c.turn } : { combat: null, round: null, turn: null };
};

function surgeDamageOf(actor) {
  if ( !actor ) return null;
  const s = surgeLocal.get(actor.uuid) ?? actor.flags?.[ID]?.[SURGE_DMG];
  if ( !s?.bonus || surgeUsed.has(surgeKey(actor, s)) ) return null;
  const now = combatStamp();
  if ( s.combat ) {   // armed in combat: lapses once that turn is over
    if ( (s.combat !== now.combat) || (s.round !== now.round) || (s.turn !== now.turn) ) return null;
  } else if ( (Date.now() - (s.at ?? 0)) > SURGE_DMG_TTL ) return null;
  return s;
}

function armSurgeDamage(actor, data) {
  surgeLocal.set(actor.uuid, data);
  actor.update({ [`flags.${ID}.${SURGE_DMG}`]: data })
    .catch(err => console.warn(`${ID} | could not arm Power Surge damage`, err));
}

function clearSurgeDamage(actor) {
  if ( !actor ) return;
  const local = surgeLocal.get(actor.uuid);
  const flag = actor.flags?.[ID]?.[SURGE_DMG];
  for ( const s of [local, flag] ) if ( s?.at ) surgeUsed.add(surgeKey(actor, s));
  surgeLocal.delete(actor.uuid);
  if ( !local && !flag ) return;   // an arm still in flight is covered by surgeUsed; the null update lands after it
  actor.update({ [`flags.${ID}.${SURGE_DMG}`]: null })
    .catch(err => console.warn(`${ID} | could not clear Power Surge damage`, err));
}

function onRollAttack(rolls, { subject: activity }={}) {
  const actor = actorOf(activity);
  const roll = rolls?.[0];
  if ( !actor || !roll ) return;
  const hit = attackOutcome(roll);
  lastAttack.set(actor.uuid, { activity: activity.uuid, hit });
  // A new attack ends the previous attack's unclaimed Power Surge damage ("THAT attack's damage only");
  // a Power Surge attack that didn't miss outright re-arms the half for itself.
  const bonus = Number(roll.options?.[`${ID}PowerSurge`]) || 0;
  if ( bonus && (hit !== false) ) {
    armSurgeDamage(actor, { activity: activity.uuid, item: activity.item?.uuid ?? null, bonus, at: Date.now(), ...combatStamp() });
  }
  else if ( surgeLocal.has(actor.uuid) || actor.flags?.[ID]?.[SURGE_DMG] ) clearSurgeDamage(actor);
}

/** Turn end: the active GM clears every combatant's unclaimed Power Surge damage. */
function onUpdateCombat(combat, change) {
  if ( !(("turn" in change) || ("round" in change)) ) return;
  surgeLocal.clear();
  if ( !game.users?.activeGM?.isSelf ) return;
  for ( const c of combat.combatants ?? [] ) {
    if ( c.actor?.flags?.[ID]?.[SURGE_DMG] ) clearSurgeDamage(c.actor);
  }
}

/* -------------------------------------------- */
/*  Damage                                      */
/* -------------------------------------------- */

const DAMAGE_KEYS = ["doomstrike", "surgingCast", "wrathCascade", "cinderwake", "crowningBlow", "finalArgument",
  "ignoreResists", "absorbStrike", "pressHarder"];
// RFI parity 11-13 (module.js consumedOnHit: sundering-blow, doomstrike, crowning-blow, final-argument, max-dice):
// these wait for a HIT — a damage roll after this activity's known miss leaves them armed.
const HIT_KEYS = new Set(["doomstrike", "crowningBlow", "finalArgument", "ignoreResists", "absorbStrike", "pressHarder"]);

function onPreRollDamage(config, dialog, message) {
  const activity = config.subject;
  const actor = actorOf(activity);
  if ( !actor ) return;
  const isWeapon = activity?.item?.type === "weapon";
  const isMelee = activity?.attack?.type?.value === "melee";
  const meleeOnly = new Set(["absorbStrike", "pressHarder"]);
  const last = lastAttack.get(actor.uuid);
  const knownMiss = (last?.activity === activity?.uuid) && (last.hit === false);
  const keys = DAMAGE_KEYS.filter(k => ((k !== "surgingCast") || !isWeapon) && (!meleeOnly.has(k) || isMelee)
    && !(knownMiss && HIT_KEYS.has(k)));
  const got = pick(config, actor, keys);
  // Power Surge's damage half belongs to the attack that spent it: this activity only, once.
  const surge = surgeDamageOf(actor);
  const surgeHere = !!surge && ((surge.activity === activity?.uuid) || (!!surge.item && (surge.item === activity?.item?.uuid)));
  if ( !got.size && !surgeHere ) return;

  const plan = config[ID] = {};
  const prof = profOf(actor);
  if ( surgeHere ) {
    const p = config[PENDING] ??= { actor, keys: new Set(), notes: [] };
    p.clearSurgeDamage = true;
    plan.flat = (plan.flat ?? 0) + Number(surge.bonus);
    got.add("powerSurge");
  }
  if ( got.has("crowningBlow") || got.has("finalArgument") || got.has("cinderwake") ) plan.maximize = true;
  if ( got.has("crowningBlow") || got.has("finalArgument") ) {
    config.isCritical = true;
    for ( const r of config.rolls ?? [] ) foundry.utils.setProperty(r, "options.isCritical", true);
  }
  if ( got.has("doomstrike") ) plan.extra = `${prof}d6x`;   // sixes explode
  // Final Argument: + Prof d6, maximised and doubled with the critical (it lands after dnd5e's crit doubling).
  if ( got.has("finalArgument") ) plan.flat = (plan.flat ?? 0) + (prof * 6 * 2);
  if ( got.has("pressHarder") ) plan.flat = (plan.flat ?? 0) + prof;
  if ( got.has("surgingCast") ) plan.maxOne = true;
  if ( got.has("wrathCascade") ) plan.reroll = true;
  if ( got.has("ignoreResists") || got.has("finalArgument") ) foundry.utils.setProperty(message, `data.flags.${ID}.ignoreResist`, true);
  // Absorbing Guard (Path of the Bulwark): 1d6 of the absorbed type rides the next melee hit.
  if ( got.has("absorbStrike") ) plan.absorbType = actor.flags?.[SURGE]?.absorbType || null;
  plan.labels = [...got];
}

function appendTerms(roll, formula) {
  roll.terms.push(new OperatorTerm({ operator: "+" }), ...Roll.parse(formula, roll.data));
}

function onPostDamageConfig(rolls, config) {
  const plan = config[ID];
  const roll = rolls?.[0];
  if ( !plan || !roll ) return;
  // review 2026-11-13: Doomstrike's dice join the roll BEFORE maximize, so Crowning Blow / Final Argument
  // max them too (RFI: "incl. Doomstrike dice"), and a critical doubles them like any rider dice
  // (dnd5e has already doubled the base dice by this hook).
  if ( plan.extra ) {
    const crit = !!(roll.isCritical || roll.options?.isCritical || config.isCritical);
    const extra = crit ? plan.extra.replace(/^(\d+)d/, (_, n) => `${Number(n) * 2}d`) : plan.extra;
    appendTerms(roll, extra);
  }
  const dice = rolls.flatMap(r => r.terms.filter(t => t instanceof Die));
  if ( plan.reroll ) dice.forEach(d => d.modifiers.push("r<=2"));
  if ( plan.maximize ) {
    // Replace each die with its maximum as a flat number. (A `min{faces}` modifier totals
    // correctly but the card's dice breakdown still shows the original faces, e.g. 1,3,3,3.)
    // This runs after dnd5e has already doubled dice for a critical, so crits stay doubled.
    for ( const r of rolls ) r.terms = r.terms.map(t => (t instanceof Die)
      ? new NumericTerm({ number: (t.number ?? 1) * t.faces }) : t);
  }
  else if ( plan.maxOne && dice.length ) {
    const die = [...dice].sort((a, b) => b.faces - a.faces)[0];
    const owner = rolls.find(r => r.terms.includes(die));
    if ( die.number > 1 ) { die.number -= 1; appendTerms(owner, String(die.faces)); }
    else owner.terms.splice(owner.terms.indexOf(die), 1, new NumericTerm({ number: die.faces }));
  }
  if ( plan.absorbType ) rolls.push(new CONFIG.Dice.DamageRoll("1d6", roll.data, { type: plan.absorbType }));
  if ( plan.flat ) appendTerms(roll, String(plan.flat));
  rolls.forEach(r => r.resetFormula());
}

/* -------------------------------------------- */

export function activateRiders() {
  Hooks.on("dnd5e.preRollD20TestV2", onPreRollD20);
  Hooks.on("dnd5e.preRollAttackV2", onPreRollAttack);
  Hooks.on("dnd5e.rollAttackV2", onRollAttack);              // before automation's auto-damage (activated after)
  Hooks.on("updateCombat", onUpdateCombat);
  Hooks.on("dnd5e.preRollSavingThrowV2", onPreRollSave);
  Hooks.on("dnd5e.preRollDamageV2", onPreRollDamage);
  Hooks.on("dnd5e.postDamageRollConfiguration", onPostDamageConfig);
  Hooks.on("dnd5e.postRollConfiguration", onPostRollConfig);   // every roll type, last
}

export { armed, consume, take };
