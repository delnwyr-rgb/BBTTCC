// D&D 5e Table Kit — "next roll" riders, no midi-qol.
//
// Surge Powers arms one-shot riders as flags.surge-powers.oneShot.<key>. This
// file consumes them inside dnd5e's own roll pipeline, on the client that makes
// the roll (which owns the actor, so it can clear the flag):
//
//   any d20  bonusDie       → advantage on the next d20 test (one extra die, keep best)
//   attack   advAttack      → advantage                     (Snap Strike)
//            powerSurge     → + Prof to the attack roll      (Power Surge)
//            finalArgument  → auto-hit (roll option read by automation.js), then
//                             max damage + Prof on the following damage roll
//   damage   doomstrike     → + Prof d6                       (Doomstrike)
//            surgingCast    → maximise one die (spell/feature) (Surging Cast)
//            wrathCascade   → reroll 1s and 2s once            (Wrath Cascade)
//            cinderwake     → maximise every die               (Cinderwake)
//            crowningBlow   → critical with maximised dice     (Crowning Blow)
//            ignoreResists  → message flag; automation applies with resistance ignored
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
  if ( take(actor, ["bonusDie"]).size ) {
    config.advantage = true;
    note(actor, "Bonus Die: rolling an extra d20, keeping the best.");
  }
}

/**
 * Effect-driven attack modes (dnd5e 6 has no native AE key for these):
 *   flags.dnd5e-table-kit.advantage.attack            scope — the bearer's attacks have advantage
 *   flags.dnd5e-table-kit.disadvantage.attack         scope — the bearer's attacks have disadvantage
 *   flags.dnd5e-table-kit.grants.advantage.attack     truthy, on the TARGET — attacks against it have advantage
 *   flags.dnd5e-table-kit.grants.disadvantage.attack  truthy, on the TARGET — attacks against it have disadvantage
 * Scope: "all" | "weapon" | "melee" | "ranged" | an ability key ("str", "dex"…) for attacks using it.
 * Advantage and disadvantage together cancel, exactly as dnd5e resolves them.
 */
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
  if ( targets.some(t => t.flags?.[ID]?.grants?.advantage?.attack) ) config.advantage = true;
  if ( targets.some(t => t.flags?.[ID]?.grants?.disadvantage?.attack) ) config.disadvantage = true;
}

function onPreRollAttack(config) {
  const actor = actorOf(config.subject);
  if ( !actor ) return;
  applyEffectAttackModes(config, actor);
  const got = take(actor, ["advAttack", "powerSurge"]);
  if ( got.has("advAttack") ) config.advantage = true;
  if ( got.has("powerSurge") ) {
    config.rolls ??= [{}];
    config.rolls[0].parts = [...(config.rolls[0].parts ?? []), String(profOf(actor))];
  }
  // Final Argument stays armed for its damage half; flag this attack as a sure hit.
  if ( armed(actor, "finalArgument") ) {
    config.rolls ??= [{}];
    foundry.utils.setProperty(config.rolls[0], `options.${ID}AutoHit`, true);
  }
}

function onPreRollSave(config, dialog, message) {
  const actor = actorOf(config.subject);
  if ( take(actor, ["autoSaveOnce"]).size ) {
    foundry.utils.setProperty(message, "data.system.resisted", true);
    note(actor, "Iron Word: this saving throw succeeds automatically.");
  }
}

/* -------------------------------------------- */
/*  Damage                                      */
/* -------------------------------------------- */

const DAMAGE_KEYS = ["doomstrike", "surgingCast", "wrathCascade", "cinderwake", "crowningBlow", "finalArgument",
  "ignoreResists"];

function onPreRollDamage(config, dialog, message) {
  const activity = config.subject;
  const actor = actorOf(activity);
  if ( !actor ) return;
  const isWeapon = activity?.item?.type === "weapon";
  const keys = DAMAGE_KEYS.filter(k => (k !== "surgingCast") || !isWeapon);
  const got = take(actor, keys);
  if ( !got.size ) return;

  const plan = config[ID] = {};
  const prof = profOf(actor);
  if ( got.has("crowningBlow") || got.has("finalArgument") || got.has("cinderwake") ) plan.maximize = true;
  if ( got.has("crowningBlow") ) {
    config.isCritical = true;
    for ( const r of config.rolls ?? [] ) foundry.utils.setProperty(r, "options.isCritical", true);
  }
  if ( got.has("doomstrike") ) plan.extra = `${prof}d6`;
  if ( got.has("finalArgument") ) plan.flat = prof;
  if ( got.has("surgingCast") ) plan.maxOne = true;
  if ( got.has("wrathCascade") ) plan.reroll = true;
  if ( got.has("ignoreResists") ) foundry.utils.setProperty(message, `data.flags.${ID}.ignoreResist`, true);
  plan.labels = [...got];
}

function appendTerms(roll, formula) {
  roll.terms.push(new OperatorTerm({ operator: "+" }), ...Roll.parse(formula, roll.data));
}

function onPostDamageConfig(rolls, config) {
  const plan = config[ID];
  const roll = rolls?.[0];
  if ( !plan || !roll ) return;
  const dice = rolls.flatMap(r => r.terms.filter(t => t instanceof Die));
  if ( plan.reroll ) dice.forEach(d => d.modifiers.push("r<=2"));
  if ( plan.maximize ) dice.forEach(d => d.modifiers.push(`min${d.faces}`));
  else if ( plan.maxOne && dice.length ) {
    const die = [...dice].sort((a, b) => b.faces - a.faces)[0];
    const owner = rolls.find(r => r.terms.includes(die));
    if ( die.number > 1 ) { die.number -= 1; appendTerms(owner, String(die.faces)); }
    else owner.terms.splice(owner.terms.indexOf(die), 1, new NumericTerm({ number: die.faces }));
  }
  if ( plan.extra ) appendTerms(roll, plan.extra);
  if ( plan.flat ) appendTerms(roll, String(plan.flat));
  rolls.forEach(r => r.resetFormula());
}

/* -------------------------------------------- */

export function activateRiders() {
  Hooks.on("dnd5e.preRollD20TestV2", onPreRollD20);
  Hooks.on("dnd5e.preRollAttackV2", onPreRollAttack);
  Hooks.on("dnd5e.preRollSavingThrowV2", onPreRollSave);
  Hooks.on("dnd5e.preRollDamageV2", onPreRollDamage);
  Hooks.on("dnd5e.postDamageRollConfiguration", onPostDamageConfig);
}

export { armed, consume, take };
