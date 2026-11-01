/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · riders.js — the technique riders (RFI engine → dnd5e rolls)
 * ─────────────────────────────────────────────────────────────────────────────
 * A converted technique carries flags.bad-eden-5e.riders, written by the
 * converter from the RFI handler table (TECHNIQUE_RIDERS in tools/convert-5e.mjs):
 *
 *   bank:   { n, to }      the receiver banks n uses of advantage; each is spent
 *                          on their next d20 test (rubric: banked reroll → banked
 *                          advantage). State: flags.bad-eden-5e.bank.advantage.
 *   impose: { note }       every targeted creature is Imposed: its next attack
 *                          roll or saving throw is at disadvantage (rubric:
 *                          Imposed → disadvantage). State: an Active Effect with
 *                          the `be5e-imposed` status, removed when it fires.
 *   strain: { n }          the user gains n levels of exhaustion (rubric: Strain).
 *   temp:   { formula }    informational — the feature is a native dnd5e heal
 *                          activity for temporary hit points.
 *
 * Arming happens on dnd5e.postUseActivity; consumption inside dnd5e's own roll
 * hooks on the client that makes the roll (it owns the actor and can clear the
 * state). Writes to actors the user doesn't own are whispered to the GM.
 *
 * 10-31 (review C3): the preRoll*V2 hooks fire BEFORE the roll configuration
 * dialog (BasicRoll.buildConfigure, dnd5e 6.0.5) and closing that dialog makes
 * no roll — so the pre-roll hooks only shape the config and PARK what they would
 * spend on it; dnd5e.postRollConfiguration (every roll type, `rolls` = [] when
 * the dialog was cancelled) spends it and posts the notes once rolls exist.
 *
 * 10-31 (review C52/C71): dnd5e 6.0.5 defines CONFIG.DND5E.conditionEffects
 * .attackDisadvantage (poisoned; exhaustion-3 under legacy rules) but no code
 * path consumes it, and the frightened/poisoned statuses carry no AE changes —
 * so a foe the table kit had just made Frightened attacked at a flat d20. We
 * add `frightened` to that set (and to abilityCheckDisadvantage, which dnd5e
 * DOES consume natively via hasConditionEffect) and consume the attack half
 * ourselves in onPreRollAttackConditions. The table kit keeps reading only its
 * own flag keys — one home for the rule.
 * ───────────────────────────────────────────────────────────────────────────── */
import { MOD, TRADITIONS, castingFor } from "./casting.js";

export const IMPOSED = "be5e-imposed";
const log = (...a) => console.log(`${MOD} | riders`, ...a);

function note(actor, text) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p style="margin:0">⚑ <em>${text}</em></p>` }).catch(() => {});
}
function gmNote(text) {
  const gms = game.users.filter(u => u.isGM).map(u => u.id);
  return ChatMessage.create({ content: `<p style="margin:0">⚑ <em>${text}</em></p>`, whisper: gms }).catch(() => {});
}
const targets = () => [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);

/* ── arming ───────────────────────────────────────────────────────────────── */

export async function bank(actor, n = 1, from = "Technique") {
  if (!actor) return false;
  if (!actor.isOwner) { await gmNote(`${from}: bank ${n} advantage for ${actor.name} (not owned by ${game.user.name}).`); return false; }
  const cur = Number(actor.getFlag(MOD, "bank.advantage")) || 0;
  await actor.setFlag(MOD, "bank.advantage", cur + n);
  await note(actor, `${from}: ${n} advantage banked for <b>${actor.name}</b> (${cur + n} held) — spent on the next d20 roll.`);
  return true;
}

export async function impose(target, from = "Technique", text = "") {
  if (!target) return false;
  if (target.effects.some(e => e.statuses?.has?.(IMPOSED))) { await note(target, `${from}: <b>${target.name}</b> is already Imposed.`); return true; }
  const data = {
    name: "Imposed", img: "icons/magic/control/debuff-chains-shackles-movement-red.webp", statuses: [IMPOSED],
    description: `<p>Next attack roll or saving throw is at disadvantage.${text ? ` ${text}` : ""}</p>`,
    flags: { [MOD]: { imposed: { from } } }
  };
  if (!target.isOwner) { await gmNote(`${from}: Impose ${target.name} — ${game.user.name} can't write to it. ${text}`); return false; }
  await target.createEmbeddedDocuments("ActiveEffect", [data]);
  await note(target, `${from}: <b>${target.name}</b> is Imposed — its next attack roll or saving throw is at disadvantage.${text ? ` ${text}` : ""}`);
  return true;
}

export async function strain(actor, n = 1, from = "Technique") {
  if (!actor?.isOwner) return false;
  const cur = Number(actor.system?.attributes?.exhaustion) || 0;
  const max = Number(CONFIG.DND5E?.conditionTypes?.exhaustion?.levels) || 6;
  await actor.update({ "system.attributes.exhaustion": Math.min(max, cur + n) });
  await note(actor, `${from}: <b>${actor.name}</b> gains ${n} level${n > 1 ? "s" : ""} of exhaustion (now ${Math.min(max, cur + n)}).`);
  return true;
}

/** Reclamation: points back — n = max(spec.min, spec.per5 × ⌊pool max ÷ 5⌋) per tradition (the RFI
 *  "2 Clarity" scaled to the pool, the same 5-point grain as Scarred). */
export async function restore(actor, spec = {}, from = "Technique") {
  if (!actor?.isOwner) return false;
  const casting = castingFor(actor);
  const lines = [];
  for (const [k, c] of Object.entries(casting)) {
    const n = Math.max(Number(spec.min) || 0, (Number(spec.per5) || 0) * Math.floor(c.max / 5));
    const next = Math.min(c.max, c.value + n);
    if (next > c.value) { await actor.update({ [`flags.${MOD}.points.${k}.value`]: next }); lines.push(`${next - c.value} ${TRADITIONS[k].pointsLabel}`); }
  }
  await note(actor, `${from}: <b>${actor.name}</b> ${lines.length ? `recovers ${lines.join(" and ")}` : "has nothing to recover"}.`);
  return lines.length > 0;
}

async function onPostUseActivity(activity) {
  const riders = activity?.item?.flags?.[MOD]?.riders;
  const actor = activity?.actor;
  if (!riders || !actor) return;
  const from = activity.item.name;
  if (riders.bank) {
    const r = riders.bank;
    const receiver = r.to === "ally" ? targets().find(a => a.id !== actor.id) : actor;
    if (!receiver) ui.notifications?.warn?.(`${from}: target the ally first.`);
    else await bank(receiver, Number(r.n) || 1, from);
  }
  if (riders.impose) {
    const ts = targets().filter(a => a.id !== actor.id);
    if (!ts.length) ui.notifications?.warn?.(`${from}: target a creature first.`);
    for (const t of ts) await impose(t, from, riders.impose.note ?? "");
  }
  if (riders.strain) await strain(actor, Number(riders.strain.n) || 1, from);
  if (riders.restore) await restore(actor, riders.restore, from);
}

/* ── consumption ──────────────────────────────────────────────────────────── */

const actorOf = (config) => config?.subject?.actor ?? (config?.subject instanceof Actor ? config.subject : null);

// What a pre-roll hook parked on the roll config, spent by onPostRollConfig once rolls exist (C3).
const PENDING = `${MOD}Spend`;
const pend = (config, actor) => (config[PENDING] ??= { actor, bank: 0, effects: [], notes: [] });
/** Advantage promised to rolls whose dialog is still open (or whose flag write is still in flight), by actor uuid. */
const promised = new Map();
const promise = (actor, n) => promised.set(actor.uuid, Math.max(0, (promised.get(actor.uuid) ?? 0) + n));

// Banked advantage: any d20 test.
function onPreRollD20(config) {
  const actor = actorOf(config);
  const held = (Number(actor?.flags?.[MOD]?.bank?.advantage) || 0) - (promised.get(actor?.uuid) ?? 0);
  if (!actor || held < 1) return;
  config.advantage = true;
  const p = pend(config, actor);
  p.bank += 1;
  promise(actor, 1);
  p.notes.push(`Banked advantage spent (${held - 1} left).`);
}

// Imposed: the bearer's next attack roll or saving throw.
function onPreRollImposed(config) {
  const actor = actorOf(config);
  const eff = actor?.effects?.find(e => e.statuses?.has?.(IMPOSED));
  if (!eff) return;
  config.disadvantage = true;
  const p = pend(config, actor);
  p.effects.push(eff);
  p.notes.push(`Imposed: this roll is at disadvantage (${eff.flags?.[MOD]?.imposed?.from ?? "technique"}).`);
}

/** The conditions in CONFIG.DND5E.conditionEffects.attackDisadvantage this actor is under (labels), or null. */
function attackConditions(actor) {
  if (!actor?.hasConditionEffect?.("attackDisadvantage")) return null;
  const set = CONFIG.DND5E?.conditionEffects?.attackDisadvantage ?? new Set();
  const ids = [...new Set([...set].map(p => String(p).split("-")[0]).filter(s => actor.statuses?.has?.(s)))];
  const names = ids.map(s => game.i18n.localize(CONFIG.DND5E?.conditionTypes?.[s]?.label ?? s));
  return { ids, names: names.length ? names : ["Condition"] };
}

// Frightened / Poisoned (/ legacy exhaustion-3): attack rolls at disadvantage — dnd5e defines the set, we consume it (C52/C71).
function onPreRollAttackConditions(config) {
  const actor = actorOf(config);
  const why = attackConditions(actor);
  if (!why) return;
  config.disadvantage = true;
  const sight = why.ids.includes("frightened") ? " Frightened — GM: ignore the disadvantage if the source is out of sight." : "";
  pend(config, actor).notes.push(`${why.names.join(", ")}: this attack is at disadvantage.${sight}`);
}

// dnd5e.postRollConfiguration: fires for every roll type after the dialog; `rolls` is [] when it was cancelled (C3).
function onPostRollConfig(rolls, config) {
  const p = config?.[PENDING];
  if (!p) return;
  delete config[PENDING];
  const { actor } = p;
  if (!rolls?.length) {   // dialog closed: nothing rolled, nothing spent
    if (p.bank) promise(actor, -p.bank);
    return;
  }
  if (p.bank) {
    // subtract everything still promised (a second roll made before the first flag write landed), not just ours
    const held = Number(actor.flags?.[MOD]?.bank?.advantage) || 0;
    actor.setFlag(MOD, "bank.advantage", Math.max(0, held - (promised.get(actor.uuid) ?? p.bank)))
      .catch(e => console.warn(`${MOD} | bank clear failed`, e))
      .finally(() => promise(actor, -p.bank));
  }
  for (const eff of p.effects) eff.delete().catch(e => console.warn(`${MOD} | imposed clear failed`, e));
  for (const text of p.notes) note(actor, text);
}

export const STAGGERED = "be5e-staggered";
export function registerRiderStatus() {
  const add = (id, name, img) => { if (!CONFIG.statusEffects.some(s => s.id === id)) CONFIG.statusEffects.push({ id, name, img }); };
  add(IMPOSED, "Imposed", "icons/magic/control/debuff-chains-shackles-movement-red.webp");
  // Staggered (RFI): speed halved and −2 to attack rolls; the converter's effect carries the changes.
  add(STAGGERED, "Staggered", "icons/svg/daze.svg");
  // 10-31 (review C52/C71): Frightened = disadvantage on attack rolls and ability checks (PHB). dnd5e 6.0.5's
  // sets hold only poisoned; checks are consumed natively (hasConditionEffect), attacks in onPreRollAttackConditions.
  CONFIG.DND5E?.conditionEffects?.attackDisadvantage?.add?.("frightened");
  CONFIG.DND5E?.conditionEffects?.abilityCheckDisadvantage?.add?.("frightened");
}

/** Consumable twins (convert-5e consumableActivities, 2026-10-31): `flags.bad-eden-5e.cure` = [condition words]
 *  behind "Cure <X>" utility activities; `flags.bad-eden-5e.flow` = N behind "Clear the channel" (Restore N Clarity).
 *  The activity itself is a plain utility, so the effect is applied here on the using seat. */
async function onPostUseConsumable(activity) {
  const f = activity?.item?.flags?.[MOD];
  const actor = activity?.actor;
  if (!f || !actor || (!f.cure && !f.flow)) return;
  const name = String(activity.name ?? "");
  const cure = name.match(/^Cure\s+(.+)$/i)?.[1]?.trim().toLowerCase();
  if (cure && (f.cure ?? []).includes(cure)) {
    const status = CONFIG.statusEffects.find(e => e.id === cure || e.name?.toLowerCase() === cure)?.id ?? cure;
    const had = actor.statuses?.has?.(status);
    if (had) await actor.toggleStatusEffect(status, { active: false });
    ui.notifications?.info?.(`${activity.item.name}: ${had ? `the ${cure} condition ends on ${actor.name}.` : `${actor.name} is not ${cure}.`}`);
  }
  if (f.flow && /^Clear the channel$/i.test(name)) {
    const casting = castingFor(actor);
    const key = casting.flow ? "flow" : Object.keys(casting)[0];
    if (!key) { ui.notifications?.warn?.(`${activity.item.name}: ${actor.name} has no Flow pool to restore.`); return; }
    const c = casting[key], next = Math.min(c.max, c.value + Number(f.flow));
    if (next > c.value) await actor.update({ [`flags.${MOD}.points.${key}.value`]: next });
    ui.notifications?.info?.(`${activity.item.name}: ${actor.name} regains ${next - c.value} ${key === "flow" ? "Flow" : "Artifice"} point${next - c.value === 1 ? "" : "s"}.`);
  }
}

export function activateRiders() {
  Hooks.on("dnd5e.postUseActivity", onPostUseActivity);
  Hooks.on("dnd5e.postUseActivity", onPostUseConsumable);
  Hooks.on("dnd5e.preRollD20TestV2", onPreRollD20);
  Hooks.on("dnd5e.preRollAttackV2", onPreRollImposed);
  Hooks.on("dnd5e.preRollAttackV2", onPreRollAttackConditions);
  Hooks.on("dnd5e.preRollSavingThrowV2", onPreRollImposed);
  Hooks.on("dnd5e.postRollConfiguration", onPostRollConfig);   // every roll type, after the dialog (C3)
  log("armed");
}

export const riders = { bank, impose, strain, restore, IMPOSED };
