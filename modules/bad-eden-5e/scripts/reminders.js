/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · reminders.js — the GM moments of a monster's npcAuto rules
 * ─────────────────────────────────────────────────────────────────────────────
 * The converter keeps the triggers a roll can't carry as text on the actor:
 *   flags.bad-eden-5e.reminders.<on> = [{ item, text, radius?, who? }]
 *   on ∈ turnStart · selfTurnStart · bloodied · zero · struck · attacked ·
 *        damaged · allyDamaged
 * This whispers the active GM a card at the matching moment:
 *   combatTurnChange     → the new combatant's selfTurnStart lines, plus every
 *                          combatant's turnStart lines (auras fire on any turn)
 *   dnd5e.applyDamage    → struck/damaged on any damage; bloodied when HP first
 *                          drops to half or less; zero at 0 HP
 *   dnd5e.rollAttackV2   → attacked, for each targeted creature that has them
 * Only the active GM client posts, so a table with several GM windows gets one card.
 * ───────────────────────────────────────────────────────────────────────────── */
import { MOD } from "./casting.js";

const remindersOf = (actor) => actor?.flags?.[MOD]?.reminders ?? null;
const isActiveGM = () => game.user.isGM && game.users.activeGM?.id === game.user.id;

function card(title, lines) {
  if (!lines.length) return;
  const gms = game.users.filter(u => u.isGM).map(u => u.id);
  const body = lines.map(l => `<li><b>${foundry.utils.escapeHTML(l.item)}</b> — ${foundry.utils.escapeHTML(l.text)}${l.radius ? ` <em>(${l.radius} ft${l.who ? `, ${l.who}` : ""})</em>` : ""}</li>`).join("");
  return ChatMessage.create({ content: `<div class="be5e-reminder"><p style="margin:0"><b>⚑ ${foundry.utils.escapeHTML(title)}</b></p><ul style="margin:.2rem 0 0;padding-left:1.1em">${body}</ul></div>`, whisper: gms, speaker: { alias: "Bad Eden" } }).catch(() => {});
}

function onTurnChange(combat, prior, current) {
  if (!isActiveGM() || !current?.combatantId) return;
  const me = combat.combatants.get(current.combatantId)?.actor;
  if (!me) return;
  const lines = [];
  for (const l of remindersOf(me)?.selfTurnStart ?? []) lines.push({ ...l, item: `${me.name}: ${l.item}` });
  for (const c of combat.combatants) {
    const a = c.actor; if (!a) continue;
    for (const l of remindersOf(a)?.turnStart ?? []) lines.push({ ...l, item: `${a.name}: ${l.item}` });
  }
  card(`Start of ${me.name}'s turn`, lines);
}

const halfOrLess = (actor) => { const hp = actor.system?.attributes?.hp; return hp && hp.max > 0 && hp.value <= Math.floor(hp.max / 2); };
const wasAbove = new WeakMap();

function onPreApplyDamage(actor) { wasAbove.set(actor, !halfOrLess(actor)); }
function onApplyDamage(actor, amount) {
  if (!isActiveGM()) return;
  const r = remindersOf(actor); if (!r) return;
  const lines = [];
  if (amount > 0) for (const l of [...(r.struck ?? []), ...(r.damaged ?? [])]) lines.push(l);
  if (amount > 0 && wasAbove.get(actor) && halfOrLess(actor)) for (const l of r.bloodied ?? []) lines.push({ ...l, item: `Bloodied — ${l.item}` });
  if ((actor.system?.attributes?.hp?.value ?? 1) <= 0) for (const l of r.zero ?? []) lines.push({ ...l, item: `At 0 HP — ${l.item}` });
  card(`${actor.name} takes ${amount} damage`, lines);
}

function onRollAttack(rolls, data) {
  if (!isActiveGM()) return;
  const attacker = data?.subject?.actor?.name ?? "someone";
  for (const t of game.user.targets ?? []) {
    const a = t.actor; const r = remindersOf(a)?.attacked;
    if (r?.length) card(`${a.name} is attacked by ${attacker}`, r);
  }
}

export function activateReminders() {
  Hooks.on("combatTurnChange", onTurnChange);
  Hooks.on("dnd5e.preApplyDamage", onPreApplyDamage);
  Hooks.on("dnd5e.applyDamage", onApplyDamage);
  Hooks.on("dnd5e.rollAttackV2", onRollAttack);
}
