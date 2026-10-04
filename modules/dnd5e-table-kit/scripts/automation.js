// D&D 5e Table Kit — midi-style automation built on dnd5e's own pipeline.
//
// Every roll we make is made the way dnd5e's chat-card buttons make it (tagged
// with the usage card as its origin), so dnd5e's own bookkeeping keeps working:
// hit/miss pills, half damage on a successful save, concentration links, the
// manual apply trays as a fallback.
//
//   ATTACKER  attack roll hits a target   → roll damage (crit carried over)
//   GM        damage/healing card         → apply to hit targets (save multiplier,
//                                           Sundering Blow, Reaction Miss) + Undo card
//   GM        save activity used          → roll each target's save
//   GM        save results in / attack hit → apply the activity's effects
//
// GM work is claimed per message (last writer wins) so two GM windows — even on
// the same user account — never double-apply.

import { ID, armed, consume } from "./riders.js";

const SURGE = "surge-powers";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setting = key => { try { return game.settings.get(ID, key); } catch { return null; } };

function registerSettings() {
  const reg = (key, data) => game.settings.register(ID, key, { scope: "world", config: true, ...data });
  reg("autoDamage", {
    name: "Auto-roll damage on a hit",
    hint: "When an attack hits at least one targeted token, roll its damage right away (critical hits roll critical damage).",
    type: Boolean, default: true
  });
  reg("autoApply", {
    name: "Auto-apply damage and healing",
    hint: "The GM's client applies damage/healing cards to the tokens they hit, honouring resistances and half-on-save, and posts a GM-only summary with an Undo button.",
    type: Boolean, default: true
  });
  reg("autoSaves", {
    name: "Auto-roll target saves",
    hint: "When a save-based activity is used, roll the saving throw for each targeted token.",
    type: String, default: "all",
    choices: { off: "Off", npc: "NPC targets only (players roll their own)", all: "All targets" }
  });
  reg("autoEffects", {
    name: "Auto-apply activity effects",
    hint: "Apply an activity's effects to targets that fail its save, or that its attack hits.",
    type: Boolean, default: true
  });
  reg("autoBuffs", {
    name: "Auto-apply buffs",
    hint: "When a spell, power or feature with no save or attack (Bless, Haste, Shield, Mage Armor, Reckless Attack…) is used, apply its effects: to the caster for Self abilities, otherwise to the targeted tokens (or to the caster if nothing is targeted and it's an ally/willing-creature ability).",
    type: Boolean, default: true
  });
}

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

const isActiveGM = () => game.user.isGM && (game.users.activeGM?.id === game.user.id);

/** Last-writer-wins claim so exactly one GM client handles a message. */
async function claim(message, tag) {
  const token = foundry.utils.randomID();
  try { await message.update({ [`flags.${ID}.claim.${tag}`]: token }); } catch { return false; }
  await sleep(700);
  return message.flags?.[ID]?.claim?.[tag] === token;
}

function originOf(message) {
  const origin = message.system?.origin;
  if ( origin instanceof ChatMessage ) return origin;
  return game.messages.get(origin?.id ?? origin ?? message.getFlag("dnd5e", "originatingMessage")) ?? null;
}

function resolveTarget(descriptor) {
  const TF = dnd5e.dataModels?.fields?.TargetsField ?? dnd5e.dataModels?.chatMessage?.fields?.TargetsField;
  const resolved = TF?.resolve?.(descriptor);
  if ( resolved?.actor ) return { actor: resolved.actor, uuid: resolved.token?.document?.uuid ?? descriptor.token };
  const lookup = uuid => { try { return uuid ? fromUuidSync(uuid) : null; } catch { return null; } };
  const doc = lookup(descriptor.token) ?? lookup(descriptor.actor);
  const actor = doc?.actor ?? (doc instanceof Actor ? doc : null);
  return actor ? { actor, uuid: descriptor.token ?? actor.uuid } : null;
}

/** Did this attack roll hit a target with the given AC? */
function attackHits(roll, ac) {
  if ( roll.options?.[`${ID}AutoHit`] ) return true;
  if ( roll.isCritical ) return true;
  if ( roll.isFumble ) return false;
  if ( (ac === null) || (ac === undefined) ) return false;   // total cover / unknown
  return roll.total >= ac;
}

/** Save outcomes for a usage card, keyed by token UUID. */
function saveOutcomes(usage) {
  const out = new Map();
  for ( const m of usage?.getAssociatedRolls?.("save") ?? [] ) {
    const roll = m.rolls?.[0];
    const uuid = m.getAssociatedToken?.()?.uuid;
    if ( !roll || !uuid ) continue;
    out.set(uuid, (roll.isSuccess || m.system?.forceSuccess) ? "success" : "failure");
  }
  return out;
}

async function gmCard(title, lines, flags={}) {
  return ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: { alias: "Table Kit" },
    content: `<div class="tk-card"><p class="tk-title">${title}</p>${lines.map(l => `<p>${l}</p>`).join("")}</div>`,
    flags: { [ID]: flags }
  });
}

/* -------------------------------------------- */
/*  Attacker: roll damage on a hit              */
/* -------------------------------------------- */

async function onRollAttack(rolls, { subject: activity }={}) {
  if ( !setting("autoDamage") || !activity?.damage?.parts?.length ) return;
  const roll = rolls?.[0];
  const usage = game.messages.get(roll?.options?.originatingMessage);
  if ( !roll || !usage ) return;
  const targets = usage.system?.targets?.length ? usage.system.targets : [...game.user.targets].map(t => ({
    ac: t.actor?.system.attributes?.ac?.value ?? null
  }));
  if ( !targets.length || !targets.some(t => attackHits(roll, t.ac)) ) return;

  const lastAttack = usage.getAssociatedRolls("attack").pop();
  const { ability, ammunitionItem: ammunition, mode: attackMode } = lastAttack?.system ?? {};
  // Carry the attack's own targets so the damage card lands on what was attacked,
  // even if the roller has since changed (or never had) token targets.
  const attacked = lastAttack?.system?.targets?.length ? lastAttack.system.targets : usage.system?.targets;
  const system = { origin: usage.id };
  if ( attacked?.length ) system.targets = attacked.map(t => (t.toObject ? t.toObject() : { ...t }));
  await activity.rollDamage(
    { ability, ammunition, attackMode, isCritical: roll.isCritical },
    { configure: false },
    { data: { system } }
  );
}

/* -------------------------------------------- */
/*  GM: apply damage / healing                  */
/* -------------------------------------------- */

async function applyDamageCard(message) {
  const usage = originOf(message);
  let descriptors = message.system?.targets ?? [];
  if ( !descriptors.length ) {
    // Fall back to whatever the attack (or the usage card) recorded as targeted.
    const attackMsg = usage?.getAssociatedRolls?.("attack").pop();
    descriptors = attackMsg?.system?.targets?.length ? attackMsg.system.targets : (usage?.system?.targets ?? []);
  }
  if ( !descriptors.length ) {
    // Untargeted healing from a Self ability (Rage's temp HP, Second Wind) lands on the user.
    const act = message.getAssociatedActivity?.() ?? usage?.getAssociatedActivity?.();
    const self = (act?.target?.affects?.type === "self") || (act?.range?.units === "self");
    const caster = message.getAssociatedActor?.() ?? act?.actor;
    if ( (message.type === "healing") && self && caster ) descriptors = [{ actor: caster.uuid, name: caster.name }];
  }
  if ( !descriptors.length ) return;
  const activity = message.getAssociatedActivity?.() ?? usage?.getAssociatedActivity?.();
  const DamageRoll = CONFIG.Dice.DamageRoll;
  const rolls = message.rolls.filter(r => r instanceof DamageRoll);
  if ( !rolls.length ) return;

  // Which targets does this land on?
  const attack = (activity?.type === "attack") ? usage?.getAssociatedRolls("attack").pop() : null;
  if ( (activity?.type === "attack") && !attack ) return;   // damage without an attack roll: leave it manual
  const attackRoll = attack?.rolls?.[0];
  const attackAC = new Map((attack?.system?.targets ?? []).map(t => [t.token, t.ac]));

  // Save-based: wait briefly for outcomes to land before halving.
  const onSave = message.system?.onSave;
  let outcomes = saveOutcomes(usage);
  if ( onSave && (activity?.type === "save") ) {
    for ( let i = 0; (i < 12) && (outcomes.size < descriptors.length); i++ ) {
      await sleep(500);
      outcomes = saveOutcomes(usage);
    }
  }

  const damages = dnd5e.dice.aggregateDamageRolls(rolls, { respectProperties: true }).map(r => ({
    value: Math.max(0, r.total), type: r.options.type, properties: new Set(r.options.properties ?? [])
  }));
  const ignoreResist = !!message.flags?.[ID]?.ignoreResist;
  const lines = [];
  const undo = [];

  for ( const descriptor of descriptors ) {
    const target = resolveTarget(descriptor);
    if ( !target?.actor ) continue;
    const { actor, uuid } = target;
    const name = descriptor.name ?? actor.name;

    if ( attackRoll && !attackHits(attackRoll, attackAC.get(descriptor.token) ?? descriptor.ac) ) continue;

    // Surge: Reaction Miss turns the first incoming hit into a miss.
    if ( attackRoll && armed(actor, "reactionMiss") ) {
      consume(actor, "reactionMiss");
      lines.push(`<strong>${name}</strong>: Reaction Miss! The hit is turned aside.`);
      continue;
    }

    let multiplier = 1;
    const outcome = outcomes.get(uuid) ?? outcomes.get(descriptor.token);
    if ( onSave && (outcome === "success") ) multiplier = { full: 1, half: 0.5, none: 0 }[onSave] ?? 1;

    const hp = actor.system.attributes?.hp;
    if ( !hp ) continue;
    const before = { value: hp.value, temp: hp.temp ?? 0 };
    const options = { isDelta: true, multiplier, origin: message, originatingMessage: message };
    if ( ignoreResist ) options.ignore = { resistance: true };
    await actor.applyDamage(damages, options);
    const after = actor.system.attributes.hp;
    const delta = (before.value + before.temp) - (after.value + (after.temp ?? 0));
    undo.push({ uuid: actor.uuid, value: before.value, temp: before.temp });
    const what = delta >= 0 ? `takes <strong>${delta}</strong>` : `heals <strong>${-delta}</strong>`;
    const why = [multiplier !== 1 ? (multiplier ? "half, saved" : "saved, no damage") : null,
      ignoreResist ? "resistance ignored" : null].filter(Boolean).join("; ");
    lines.push(`<strong>${name}</strong> ${what}${why ? ` <em>(${why})</em>` : ""} → ${after.value}/${after.max} HP`);
  }

  if ( lines.length ) {
    const source = message.flavor || activity?.item?.name || "Damage";
    await gmCard(`⚔ ${source}`, lines, undo.length ? { undo } : {});
  }
}

async function undoDamage(message) {
  const entries = message.flags?.[ID]?.undo ?? [];
  for ( const { uuid, value, temp } of entries ) {
    const actor = await fromUuid(uuid);
    await actor?.update({ "system.attributes.hp.value": value, "system.attributes.hp.temp": temp || null });
  }
  await message.update({ [`flags.${ID}.undone`]: true });
}

/* -------------------------------------------- */
/*  GM: target saves & effects                  */
/* -------------------------------------------- */

async function rollTargetSaves(usage, activity) {
  const mode = setting("autoSaves");
  if ( !mode || (mode === "off") ) return;
  const ability = activity.save?.ability?.first?.() ?? [...(activity.save?.ability ?? [])][0];
  const dc = activity.save?.dc?.value;
  if ( !ability || !Number.isFinite(dc) ) return;
  const bonus = CONFIG.Dice.BasicRoll.constructParts({ activityBonus: activity.save.bonus }, activity.getRollData());

  for ( const descriptor of usage.system?.targets ?? [] ) {
    const target = resolveTarget(descriptor);
    const actor = target?.actor;
    if ( !actor ) continue;
    if ( (mode === "npc") && actor.hasPlayerOwner ) continue;
    const token = fromUuidSync(target.uuid);
    const config = { ability, target: dc };
    if ( bonus.parts.length ) config.rolls = [bonus];
    await actor.rollSavingThrow(config, { configure: false }, {
      data: {
        speaker: ChatMessage.getSpeaker({ actor, token }),
        system: { ...activity.messageSources, origin: usage.id }
      }
    });
  }
}

/** What an effect does, ignoring its name — identical copies (Mirror Image's duplicates) share one. */
function effectSignature(effect) {
  const changes = (effect.changes ?? []).map(c => `${c.key}|${c.type ?? c.mode}|${c.value}`).sort().join(";");
  return `${[...(effect.statuses ?? [])].sort().join(",")}#${changes}`;
}

/**
 * Apply the usage card's effects to the given actors, exactly as dnd5e's effect tray does.
 * If an actor would receive several *different* effects (Eyebite's Asleep/Panicked/Sickened,
 * Protection from Energy's five types), that's a choice for a person: nothing is applied and
 * the effect names come back in `choices`. Identical copies all apply.
 * @returns {Promise<{applied: string[], choices: string[]|null}>}
 */
async function applyEffects(usage, actors, { successes=new Set(), filter=null }={}) {
  const result = { applied: [], choices: null };
  if ( !actors.length ) return result;
  const effects = (await usage.system?.getEffects?.() ?? []).filter(e => e.type !== "enchantment");
  if ( !effects.length ) return result;
  const activity = usage.getAssociatedActivity?.();
  const profiles = new Map((activity?.effects ?? []).map(p => [p._id ?? p.effect?.id, p]));
  const Tray = customElements.get("effect-application");
  const shim = { chatMessage: usage };
  const applied = result.applied;
  for ( const actor of actors ) {
    // On a successful save, only effects flagged "apply on save" land.
    const eligible = effects.filter(effect => (!filter || filter(effect, actor))
      && (!successes.has(actor) || profiles.get(effect.id)?.onSave));
    if ( new Set(eligible.map(effectSignature)).size > 1 ) {
      result.choices = eligible.map(e => e.name);
      continue;
    }
    for ( const effect of eligible ) {
      try {
        const { action, data } = await Tray.prototype._prepareEffectData.call(shim, effect, actor);
        if ( action === "update" ) await actor.effects.get(data._id).update(data);
        else await ActiveEffect.implementation.create(data, { parent: actor });
        applied.push(`${actor.name}: ${effect.name}`);
      } catch(err) { console.warn(`${ID} | effect apply failed`, effect.name, actor.name, err); }
    }
  }
  return result;
}

/** GM summary for an effects pass, including a "pick one" prompt when a choice was left open. */
async function reportEffects(title, { applied, choices }, extra=[]) {
  const lines = [...applied];
  if ( choices ) lines.push(`Pick which effect to apply from the card's Effects tray (${choices.join(", ")}).`);
  if ( lines.length ) await gmCard(`✦ ${title}`, [...lines, ...(applied.length ? extra : [])]);
}

/**
 * Activity types whose effects are buffs/self-effects rather than save or attack riders.
 * "damage" is left out on purpose: its effects are hit riders (Spirit Shroud, smites).
 */
const BUFF_TYPES = new Set(["utility", "heal"]);
/** Range units that mean "a real distance to someone else", so targets are meant literally. */
const REACH = new Set(["ft", "mi", "m", "km", "touch", "any"]);
/** Target kinds that are friendly, so an untargeted cast can fall back to the caster. */
const FRIENDLY = new Set(["self", "ally", "willing"]);

/** Conditions that mark an effect as a debuff for whoever gets hit, never a self-buff. */
const HARMFUL = new Set(["blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated",
  "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious", "bleeding", "cursed",
  "shocked", "slowed", "weakened", "ignited", "corroded"]);

/**
 * Who a buff lands on: the caster for Self abilities, else the usage card's targets.
 * `inferred` is true when "it's for the caster" is a guess (range Self, or nothing
 * targeted) rather than the activity explicitly saying it affects self.
 */
function buffRecipients(message, activity) {
  const none = { actors: [], inferred: false, fallback: false };
  const caster = message.getAssociatedActor?.() ?? activity.actor;
  if ( !caster ) return none;
  const affects = activity.target?.affects?.type ?? "";
  const range = activity.range?.units ?? "";
  const template = activity.target?.template?.type ?? "";

  // 1. The activity says outright that it affects its user.
  if ( affects === "self" ) return { actors: [caster], inferred: false, fallback: false };
  // 2. Range Self with no other target description: a personal effect (potions, Disguise Self).
  if ( (range === "self") && !affects && !template ) return { actors: [caster], inferred: true, fallback: false };
  // Anything else at range Self (auras, "creature" at range self, emanations) is ambiguous: leave it manual.
  if ( !REACH.has(range) ) return none;

  // 3. A real range: whoever the user targeted.
  const targeted = (message.system?.targets ?? []).map(d => resolveTarget(d)?.actor).filter(Boolean);
  if ( targeted.length ) return { actors: [...new Set(targeted)], inferred: false, fallback: false };
  // 4. Nothing targeted on an ally/willing ability: the caster is the obvious recipient.
  if ( FRIENDLY.has(affects) ) return { actors: [caster], inferred: true, fallback: true };
  return none;
}

async function onBuff(message, activity) {
  if ( !setting("autoBuffs") || !message.system?.effects?.length ) return;
  const { actors, inferred, fallback } = buffRecipients(message, activity);
  if ( !actors.length ) return;
  if ( !(await claim(message, "buffs")) ) return;
  // dnd5e already narrows the card to the cast level (Aid at 3rd → one effect); applyEffects
  // turns any remaining choice (Protection from Energy, Fire Shield) into a "pick one" note.
  // A guessed self-target never receives a debuff (Blinding Smite's Blinded is for the foe).
  const filter = inferred ? effect => !(effect.statuses?.size && [...effect.statuses].some(s => HARMFUL.has(s))) : null;
  const result = await applyEffects(message, actors, { filter });
  const note = fallback ? ["<em>Nothing was targeted, so it went on the caster.</em>"] : [];
  await reportEffects(activity.item?.name ?? "Effects", result, note);
}

async function onUsage(message) {
  const activity = message.getAssociatedActivity?.();
  if ( BUFF_TYPES.has(activity?.type) ) return onBuff(message, activity);
  if ( activity?.type !== "save" ) return;
  if ( !message.system?.targets?.length ) return;
  if ( !(await claim(message, "saves")) ) return;
  await rollTargetSaves(message, activity);

  // Give any player-rolled saves a moment, then apply effects to failures.
  const want = message.system.targets.length;
  let outcomes = saveOutcomes(message);
  for ( let i = 0; (i < 20) && (outcomes.size < want); i++ ) { await sleep(500); outcomes = saveOutcomes(message); }
  const failed = [], succeeded = new Set();
  for ( const descriptor of message.system.targets ) {
    const target = resolveTarget(descriptor);
    if ( !target?.actor ) continue;
    const o = outcomes.get(target.uuid) ?? outcomes.get(descriptor.token);
    if ( o === "failure" ) failed.push(target.actor);
    else if ( o === "success" ) { failed.push(target.actor); succeeded.add(target.actor); }
  }
  if ( !setting("autoEffects") ) return;
  await reportEffects(activity.item?.name ?? "Effects", await applyEffects(message, failed, { successes: succeeded }));
}

async function onAttackCard(message) {
  if ( !setting("autoEffects") ) return;
  const usage = originOf(message);
  const roll = message.rolls?.[0];
  if ( !usage || !roll ) return;
  const effects = await usage.system?.getEffects?.() ?? [];
  if ( !effects.length ) return;
  if ( !(await claim(message, "effects")) ) return;
  const hit = [];
  for ( const descriptor of message.system?.targets ?? [] ) {
    if ( !attackHits(roll, descriptor.ac) ) continue;
    const target = resolveTarget(descriptor);
    if ( target?.actor ) hit.push(target.actor);
  }
  await reportEffects(usage.getAssociatedItem?.()?.name ?? "Effects", await applyEffects(usage, hit));
}

/* -------------------------------------------- */
/*  Wiring                                      */
/* -------------------------------------------- */

async function onCreateMessage(message) {
  if ( !isActiveGM() ) return;
  try {
    if ( message.type === "usage" ) return await onUsage(message);
    if ( message.type === "attack" ) return await onAttackCard(message);
    if ( ((message.type === "damage") || (message.type === "healing")) && setting("autoApply") ) {
      if ( await claim(message, "apply") ) await applyDamageCard(message);
    }
  } catch(err) { console.error(`${ID} | automation failed for message ${message.id}`, err); }
}

function onRenderMessage(message, html) {
  const undo = message.flags?.[ID]?.undo;
  if ( !undo?.length || !game.user.isGM ) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const card = root?.querySelector(".tk-card");
  if ( !card || card.querySelector(".tk-undo") ) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tk-undo";
  button.disabled = !!message.flags[ID].undone;
  button.innerHTML = message.flags[ID].undone ? "Undone" : `<i class="fa-solid fa-rotate-left"></i> Undo`;
  button.addEventListener("click", async () => { button.disabled = true; await undoDamage(message); });
  card.append(button);
}

export function activateAutomation() {
  registerSettings();
  Hooks.on("dnd5e.rollAttackV2", (rolls, data) => {
    onRollAttack(rolls, data).catch(err => console.error(`${ID} | auto damage failed`, err));
  });
  Hooks.on("createChatMessage", onCreateMessage);
  Hooks.on("renderChatMessageHTML", onRenderMessage);
}

export { applyDamageCard, applyEffects, attackHits, rollTargetSaves, saveOutcomes, undoDamage };
