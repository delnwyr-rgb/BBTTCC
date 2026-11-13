// D&D 5e Table Kit — "repeat the save each turn" / damage-over-time, no midi-qol (Dave 11-12).
//
// An Active Effect carries a change with key `flags.dnd5e-table-kit.overTime` (type custom) whose
// value is a comma list of k=v. The syntax deliberately matches the midi-qol OverTime strings already
// sitting in world data, so translating an old effect is a key rename:
//
//   turn=end|start            when it fires: the bearer's turn start or end (default end)
//   label=Hold Person         card title (default: the effect name)
//   saveAbility=wis           a save the bearer rolls (omit for damage only)
//   saveDC=15 | @attributes.spell.dc | $activity.dc
//                             a number, a roll-data path on the ORIGIN actor (the caster), or the
//                             origin item's save activity DC. Default: $activity.dc
//   saveRemove=true           a success ends the effect (default true when there is a save)
//   damageRoll=1d6            damage the bearer takes (roll-data @refs read from the caster)
//   damageType=fire
//   saveDamage=nodamage|halfdamage|fulldamage   what a SUCCESS does to that damage (default nodamage)
//   damageBeforeSave=true     damage lands first, then the save (Searing Smite style)
//   tempHp=@abilities.cha.mod temp HP the bearer gains (Heroism)
//   roll=1d10                 a plain roll posted on the card (Confusion's behaviour table)
//   once=true                 fire once, then remove the effect (Vitriolic Sphere's delayed acid)
//   (allowIncapacitated, rollType, saveMagic, rollMode … are accepted and ignored)
//
// Engine: on every combat turn change, ONE GM window (claim on the combat flag) walks the effects of
// the combatant whose turn just ended (turn=end) and the one whose turn starts (turn=start), rolls
// the saves/damage, and posts a public card. Legacy `flags.midi-qol.OverTime` changes are read the
// same way, so untranslated data still works — but the world should carry the kit key.

import { ID } from "./riders.js";

export const OT_KEY = `flags.${ID}.overTime`;
const LEGACY = "flags.midi-qol.OverTime";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

export function parseOverTime(value) {
  const out = {};
  for ( const part of String(value ?? "").split(",") ) {
    const i = part.indexOf("=");
    if ( i < 1 ) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const bool = v => /^(true|1|yes)$/i.test(String(v ?? ""));
  const spec = {
    turn: /^start$/i.test(out.turn) ? "start" : "end",
    label: out.label || null,
    saveAbility: (out.saveAbility || "").toLowerCase() || null,
    saveDC: out.saveDC || "$activity.dc",
    damageRoll: out.damageRoll || null,
    damageType: (out.damageType || "").toLowerCase() || null,
    saveDamage: (out.saveDamage || "nodamage").toLowerCase(),
    damageBeforeSave: bool(out.damageBeforeSave),
    tempHp: out.tempHp || null,
    once: bool(out.once),
    roll: out.roll || null,
  };
  spec.saveRemove = ("saveRemove" in out) ? bool(out.saveRemove) : !!spec.saveAbility;
  return spec;
}

function changesOf(effect) {
  return effect.changes ?? effect.system?.changes ?? [];
}
export function overTimeSpecs(actor) {
  const out = [];
  for ( const effect of actor?.appliedEffects ?? actor?.effects ?? [] ) {
    if ( effect.disabled || effect.isSuppressed ) continue;
    for ( const c of changesOf(effect) ) {
      if ( (c.key === OT_KEY) || (c.key === LEGACY) ) out.push({ effect, spec: parseOverTime(c.value), legacy: c.key === LEGACY });
    }
  }
  return out;
}

/** The effect's origin: { item, actor } of the caster, when it can be found. */
function originOf(effect) {
  // 11-12: imported effects can carry a stale `system.origin` (a chris-premades compendium item with no
  // caster) beside the real top-level origin dnd5e stamped on apply. Prefer whichever resolves to a caster.
  const resolve = (uuid) => {
    let doc = null;
    try { doc = uuid ? fromUuidSync(uuid) : null; } catch { doc = null; }
    if ( doc?.documentName === "ActiveEffect" ) doc = doc.parent;
    const item = doc?.documentName === "Item" ? doc : null;
    const actor = item?.actor ?? (doc?.documentName === "Actor" ? doc : null);
    return { item, actor };
  };
  const tries = [...new Set([effect.origin, effect._source?.origin, effect.system?.origin, effect._source?.system?.origin].filter(Boolean))].map(resolve);
  return tries.find(t => t.actor) ?? tries.find(t => t.item) ?? { item: null, actor: null };
}
function rollDataFor(effect, bearer) {
  const { item, actor } = originOf(effect);
  return item?.getRollData?.() ?? actor?.getRollData?.() ?? bearer.getRollData();
}
function resolveDC(spec, effect, bearer) {
  const raw = String(spec.saveDC ?? "").trim();
  if ( /^\d+$/.test(raw) ) return Number(raw);
  const { item, actor } = originOf(effect);
  if ( raw === "$activity.dc" || !raw ) {
    const acts = item?.system?.activities;
    const save = acts?.find?.(a => a.type === "save" && Number.isFinite(a.save?.dc?.value))
      ?? acts?.find?.(a => Number.isFinite(a.save?.dc?.value));
    if ( save ) return save.save.dc.value;
    const flagged = Number(effect.flags?.[ID]?.dc);
    if ( Number.isFinite(flagged) ) return flagged;
    return Number(actor?.system?.attributes?.spell?.dc) || null;
  }
  // midi spelled it @attributes.spelldc; dnd5e 4+ has attributes.spell.dc
  const expr = raw.replace("@attributes.spelldc", "@attributes.spell.dc");
  try {
    const data = rollDataFor(effect, null) ?? {};
    const r = Roll.replaceFormulaData(expr, data, { missing: "0" });
    const n = Roll.safeEval(r);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

async function rollDamage(spec, effect, bearer, multiplier) {
  const data = rollDataFor(effect, bearer);
  const roll = await new Roll(spec.damageRoll, data).evaluate();
  const total = Math.floor(roll.total * multiplier);
  if ( total > 0 ) await bearer.applyDamage([{ value: total, type: spec.damageType || undefined }]);
  return { roll, total };
}

async function fire(bearer, token, { effect, spec, legacy }) {
  const label = spec.label || effect.name;
  const lines = [];
  let saved = null, removed = false;

  const doSave = async () => {
    const dc = resolveDC(spec, effect, bearer);
    if ( !Number.isFinite(dc) ) { lines.push(`No save DC found — roll a ${spec.saveAbility.toUpperCase()} save by hand.`); return null; }
    const rolls = await bearer.rollSavingThrow({ ability: spec.saveAbility, target: dc }, { configure: false }, {
      data: { speaker: ChatMessage.getSpeaker({ actor: bearer, token: token?.document ?? token }), flavor: `${label}: ${spec.saveAbility.toUpperCase()} save (DC ${dc})` }
    });
    const r = Array.isArray(rolls) ? rolls[0] : rolls;
    if ( !r ) return null;
    const ok = r.isSuccess ?? (r.total >= dc);
    lines.push(`${spec.saveAbility.toUpperCase()} save DC ${dc}: <b>${r.total}</b> — ${ok ? "success" : "failure"}.`);
    return ok;
  };
  const doDamage = async (mult) => {
    if ( mult <= 0 ) { lines.push("No damage."); return; }
    const { roll, total } = await rollDamage(spec, effect, bearer, mult);
    lines.push(`${esc(spec.damageRoll)} ${esc(spec.damageType ?? "")} → <b>${total}</b>${mult < 1 ? " (half)" : ""} damage.`);
    if ( roll.dice?.length && game.modules.get("dice-so-nice")?.active ) game.dice3d?.showForRoll?.(roll, game.user, true).catch?.(() => {});
  };

  if ( spec.tempHp ) {
    try {
      const n = Math.max(0, Math.floor((await new Roll(spec.tempHp, rollDataFor(effect, bearer)).evaluate()).total));
      const cur = Number(bearer.system?.attributes?.hp?.temp) || 0;
      if ( n > cur ) { await bearer.update({ "system.attributes.hp.temp": n }); lines.push(`Gains <b>${n}</b> temporary HP.`); }
      else lines.push(`Temporary HP stays at ${cur}.`);
    } catch (e) { console.warn(`${ID} | overtime tempHp`, e); }
  }
  if ( spec.roll ) {
    try { const r = await new Roll(spec.roll).evaluate(); lines.push(`${esc(spec.roll)} → <b>${r.total}</b>`); }
    catch (e) { console.warn(`${ID} | overtime roll`, e); }
  }
  if ( spec.damageRoll && (spec.damageBeforeSave || !spec.saveAbility) ) await doDamage(1);
  if ( spec.saveAbility ) {
    saved = await doSave();
    if ( spec.damageRoll && !spec.damageBeforeSave ) {
      const mult = saved ? ({ nodamage: 0, halfdamage: 0.5, fulldamage: 1 }[spec.saveDamage] ?? 0) : 1;
      await doDamage(mult);
    }
    if ( saved && spec.saveRemove ) removed = true;
  }
  if ( spec.once ) removed = true;
  if ( removed ) {
    try { await effect.delete(); lines.push(`<b>${esc(effect.name)}</b> ends.`); }
    catch (e) { console.warn(`${ID} | overtime remove`, e); }
  }
  if ( legacy ) lines.push("<em>(read from an old midi-qol key — translate this effect to the Table Kit key)</em>");
  await ChatMessage.create({
    speaker: { alias: "Table Kit" },
    content: `<div class="tk-card"><p class="tk-title">⏳ ${esc(label)} — ${esc(bearer.name)} (${spec.turn === "start" ? "start" : "end"} of turn)</p>${lines.map(l => `<p>${l}</p>`).join("")}</div>`,
    flags: { [ID]: { overTime: true } }
  });
  // VFX: a pulse on the bearer (Sequencer + JB2A if present).
  try {
    if ( token && globalThis.Sequence && game.modules.get("sequencer")?.active ) {
      const k = removed ? "jb2a.healing_generic.200px.blue" : (spec.damageRoll ? "jb2a.impact.001.dark_red" : "jb2a.condition.curse.01.001.purple");
      if ( Sequencer.Database.entryExists(k) ) new Sequence({ moduleName: ID, softFail: true }).effect().file(k).atLocation(token).scaleToObject(1.5).play();
    }
  } catch { /* cosmetic */ }
}

async function runFor(combatant, turn) {
  const actor = combatant?.actor;
  if ( !actor ) return;
  const token = combatant.token?.object ?? actor.getActiveTokens?.()?.[0] ?? null;
  for ( const entry of overTimeSpecs(actor) ) {
    if ( entry.spec.turn !== turn ) continue;
    try { await fire(actor, token, entry); }
    catch (e) { console.error(`${ID} | overtime failed`, entry.effect?.name, e); }
  }
}

/** Last-writer-wins claim on the combat so exactly one GM window runs a turn change. */
async function claimTurn(combat, stamp) {
  const token = foundry.utils.randomID();
  try { await combat.update({ [`flags.${ID}.otClaim`]: { stamp, token } }); } catch { return false; }
  await sleep(700);
  const c = combat.flags?.[ID]?.otClaim;
  return c?.stamp === stamp && c?.token === token;
}

async function onUpdateCombat(combat, changed, options) {
  if ( !game.user.isGM || (game.users.activeGM?.id !== game.user.id) ) return;
  if ( !("turn" in changed) && !("round" in changed) ) return;
  if ( options?.direction === -1 || !combat.started ) return;
  const prevId = combat.previous?.combatantId ?? null;
  const cur = combat.combatant;
  const stamp = `${combat.round}.${combat.turn}`;
  if ( combat.flags?.[ID]?.otDone === stamp ) return;
  if ( !(await claimTurn(combat, stamp)) ) return;
  await combat.update({ [`flags.${ID}.otDone`]: stamp });
  const prev = prevId ? combat.combatants.get(prevId) : null;
  if ( prev && (prev.id !== cur?.id) ) await runFor(prev, "end");
  if ( cur ) await runFor(cur, "start");
}

export function activateOverTime() {
  Hooks.on("updateCombat", onUpdateCombat);
  Hooks.once("ready", () => {
    const kit = game.modules.get(ID);
    if ( kit ) kit.api = Object.assign(kit.api ?? {}, { overTime: { parse: parseOverTime, specs: overTimeSpecs, key: OT_KEY, runFor } });
  });
}
