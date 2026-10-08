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

// Banked advantage: any d20 test.
function onPreRollD20(config) {
  const actor = actorOf(config);
  const held = Number(actor?.flags?.[MOD]?.bank?.advantage) || 0;
  if (!actor || held < 1) return;
  config.advantage = true;
  actor.setFlag(MOD, "bank.advantage", held - 1).catch(e => console.warn(`${MOD} | bank clear failed`, e));
  note(actor, `Banked advantage spent (${held - 1} left).`);
}

// Imposed: the bearer's next attack roll or saving throw.
function onPreRollImposed(config) {
  const actor = actorOf(config);
  const eff = actor?.effects?.find(e => e.statuses?.has?.(IMPOSED));
  if (!eff) return;
  config.disadvantage = true;
  eff.delete().catch(e => console.warn(`${MOD} | imposed clear failed`, e));
  note(actor, `Imposed: this roll is at disadvantage (${eff.flags?.[MOD]?.imposed?.from ?? "technique"}).`);
}

export const STAGGERED = "be5e-staggered";
export function registerRiderStatus() {
  const add = (id, name, img) => { if (!CONFIG.statusEffects.some(s => s.id === id)) CONFIG.statusEffects.push({ id, name, img }); };
  add(IMPOSED, "Imposed", "icons/magic/control/debuff-chains-shackles-movement-red.webp");
  // Staggered (RFI): speed halved and −2 to attack rolls; the converter's effect carries the changes.
  add(STAGGERED, "Staggered", "icons/svg/daze.svg");
}

export function activateRiders() {
  Hooks.on("dnd5e.postUseActivity", onPostUseActivity);
  Hooks.on("dnd5e.preRollD20TestV2", onPreRollD20);
  Hooks.on("dnd5e.preRollAttackV2", onPreRollImposed);
  Hooks.on("dnd5e.preRollSavingThrowV2", onPreRollImposed);
  log("armed");
}

export const riders = { bank, impose, strain, restore, IMPOSED };
