/**
 * ITEM LADDER — graded arms and Bound Workings (owner ask 2026-10-07: "the RFI version of D&D +1/+2/+3, enspelled, etc.").
 * ----------------------------------------------------------------------------------------------------------------------
 * GRADED ARMS  `flags.fourththing.grade = { rank:1|2|3, name, attack?, damage?, defense? }`
 *   • weapon: +rank to hit (read HERE, only for the weapon being swung — attackTest's itemUuid) and +rank damage (baked
 *     into system.damage.formula as a "+N" tail so cards, sim and lint all see it).
 *   • armor / shield: +rank on each of the item's non-zero defense bonuses (guardBonus/evasionBonus/resolveBonus — the
 *     existing rank-scaled armor path; no engine read needed). The flag documents it for lint and the sheet.
 *   • grade raises the item one tier per rank (price follows the rubric); Inlaid = free · Circuited = attuned · Crowned = soulbound.
 * BOUND WORKINGS  `flags.fourththing.working = { power:{name,img,system}, charges:{value,max,recoverPer}, tier }` on a HOST item
 *   (weapon / armor / gear). The host carries a manifestation and pays for it with charges instead of Clarity:
 *   • syncBoundWorkings(actor) mints a COMPANION power item ("<Power> ⟡ <Host>", flags.fourththing.workingOf = host.id) so the
 *     ordinary cast path (sheet → ftOpenCastDialog → castManifestation) runs it with real AEs and a real uuid; the companion
 *     dies with the host. Hooks keep the pair in step on createItem / deleteItem / updateItem.
 *   • castManifestation refuses at 0 charges, spends one per cast attempt (misfires included), and casts with freeClarity.
 *     Noise and misfire still apply — a bound Working is not a miracle.
 *   • Soma Break refills (recoverPer soma-break | rest | scene | day). The same refill now also recovers technomagical
 *     `rfi.item.tech.charges` (charged gear had no recharge engine before 2026-10-07).
 * Generated content: modules/bbttcc-master-content/tools/build-item-ladder.mjs → seed-item-ladder-*.macro.js.
 */

export const GRADES = Object.freeze({
  1: { rank: 1, key: "inlaid",    name: "Inlaid",    bound: "free",      blurb: "Hex-inlay along the working edge." },
  2: { rank: 2, key: "circuited", name: "Circuited", bound: "attuned",   blurb: "A closed circuit of sigils; it answers one hand." },
  3: { rank: 3, key: "crowned",   name: "Crowned",   bound: "soulbound", blurb: "Keyed to a true name. It will not be sold." }
});
const REFILL_CADENCES = new Set(["soma-break", "rest", "scene", "day", "short-rest", "long-rest"]);

export const gradeOf = item => item?.flags?.fourththing?.grade ?? null;
export const gradeAttackBonus = item => Number(gradeOf(item)?.attack) || 0;
export const workingOf = item => item?.flags?.fourththing?.working ?? null;
export const isCompanion = item => !!item?.flags?.fourththing?.workingOf;
export function hostOf(actor, companion) { const id = companion?.flags?.fourththing?.workingOf; return id ? (actor?.items?.get?.(id) ?? null) : null; }

/** Charges available to a companion power (read from its host), or null when the item is not a bound Working. */
export function workingCharges(actor, powerItem) {
  if (!isCompanion(powerItem)) return null;
  const host = hostOf(actor, powerItem); const w = workingOf(host);
  if (!host || !w) return { value: 0, max: 0, host: null, orphan: true };
  return { value: Number(w.charges?.value) || 0, max: Number(w.charges?.max) || 0, host, recoverPer: w.charges?.recoverPer || "soma-break" };
}
export async function spendWorkingCharge(actor, powerItem) {
  const c = workingCharges(actor, powerItem); if (!c?.host || c.value <= 0) return false;
  await c.host.update({ "flags.fourththing.working.charges.value": c.value - 1 });
  return true;
}
/** Refill bound-Working charges and technomagical tech.charges on one actor (Soma Break). Returns the number of items refilled. */
export async function refillWorkingCharges(actor, { cadence = "soma-break" } = {}) {
  if (!actor?.items) return 0;
  const upd = [];
  for (const it of actor.items) {
    const w = workingOf(it);
    if (w?.charges && REFILL_CADENCES.has(String(w.charges.recoverPer || "soma-break")) && Number(w.charges.value) < Number(w.charges.max)) upd.push({ _id: it.id, "flags.fourththing.working.charges.value": Number(w.charges.max) || 0 });
    const t = it.flags?.fourththing?.rfi?.item?.tech;
    if (t?.kind === "charged" && t.charges && REFILL_CADENCES.has(String(t.charges.recoverPer || "")) && Number(t.charges.value) < Number(t.charges.max)) upd.push({ _id: it.id, "flags.fourththing.rfi.item.tech.charges.value": Number(t.charges.max) || 0 });
  }
  if (upd.length) await actor.updateEmbeddedDocuments("Item", upd);
  return upd.length;
}

function companionData(host) {
  const w = workingOf(host); const p = w?.power; if (!p?.system) return null;
  const system = foundry.utils.deepClone(p.system);
  system.clarityRequired = 0;
  if (system.manifestation) { system.manifestation.costType = "none"; system.manifestation.costValue = 0; system.manifestation.costText = `1 charge of ${host.name} (${Number(w.charges?.value) || 0}/${Number(w.charges?.max) || 0})`; }
  system.tags = Array.from(new Set([...(system.tags || []), "bound-working"]));
  return {
    name: `${p.name} ⟡ ${host.name}`, type: "power", img: p.img || host.img,
    system, flags: { fourththing: { workingOf: host.id, working: { tier: w.tier ?? system.manifestation?.tier ?? 1 } } }
  };
}
/** Mint missing companions, retire orphans. Safe to call often; only the creating client / an owner writes.
 *  Serialised per actor: a host create kicks a sync whose own companion create kicks another — without the queue the
 *  second pass could read the collection before the first write landed and mint a twin (seen live 2026-10-07). */
const _syncQueue = new Map();
export function syncBoundWorkings(actor) {
  if (!actor?.id) return Promise.resolve({ created: 0, deleted: 0 });
  const run = (_syncQueue.get(actor.id) ?? Promise.resolve()).then(() => _syncBoundWorkings(actor)).catch(e => { console.warn("[fourththing] bound Working sync failed", e); return { created: 0, deleted: 0 }; });
  _syncQueue.set(actor.id, run);
  return run;
}
async function _syncBoundWorkings(actor) {
  if (!actor?.items || !(game.user?.isGM || actor.isOwner)) return { created: 0, deleted: 0 };
  const hosts = actor.items.filter(i => workingOf(i)?.power?.system);
  const companions = actor.items.filter(isCompanion);
  const toCreate = hosts.filter(h => !companions.some(c => c.flags.fourththing.workingOf === h.id)).map(companionData).filter(Boolean);
  const seen = new Set();
  const toDelete = companions.filter(c => { const h = c.flags.fourththing.workingOf; if (!actor.items.get(h)) return true; if (seen.has(h)) return true; seen.add(h); return false; }).map(c => c.id);
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);
  return { created: toCreate.length, deleted: toDelete.length };
}

export function registerItemLadderHooks() {
  const relevant = (item) => item?.parent?.documentName === "Actor" && (workingOf(item) || isCompanion(item));
  const kick = (item, userId) => { if (userId !== game.user?.id || !relevant(item)) return; syncBoundWorkings(item.parent).catch(e => console.warn("[fourththing] bound Working sync failed", e)); };
  Hooks.on("createItem", (item, _o, userId) => kick(item, userId));
  Hooks.on("deleteItem", (item, _o, userId) => kick(item, userId));
  Hooks.on("updateItem", (item, diff, _o, userId) => { if (foundry.utils.hasProperty(diff, "flags.fourththing.working.power")) kick(item, userId); });
  Hooks.once("ready", () => { for (const a of game.actors ?? []) if (a.isOwner && a.items?.some?.(i => workingOf(i)?.power?.system)) syncBoundWorkings(a).catch(() => {}); });
}
export const ItemLadder = { GRADES, gradeOf, gradeAttackBonus, workingOf, isCompanion, hostOf, workingCharges, spendWorkingCharge, refillWorkingCharges, syncBoundWorkings };
export default ItemLadder;
