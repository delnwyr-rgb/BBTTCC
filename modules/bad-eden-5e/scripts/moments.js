// Bad Eden 5E · the RFI announcements on a D&D table (2026-10-31, Dave mid-shoot: "all the alerts that we have in
// RFI … not just the combat related ones. Level up, all of that").
//
// bbttcc-fx-integration's moment bridge turns hooks into the on-screen MOMENTS ("+N SURGE" by the token, SURGE FULL,
// LEVEL UP / TIER UP, LAST STAND, ENLIGHTENMENT …). The bbttcc:* ones (receipts, adversary, sparks, Domain tier,
// quest/chapter) come from shared modules and already fire here; the four below are emitted by the RFI SYSTEM, so on
// dnd5e this file emits them with the same names and payloads (systems/fourththing/module.js _ftEmitSurgeBanked,
// fourththing.leveledUp ~1091, enlightenmentStepped ~18633, enteredLastStand ~19359). Hooks.callAll is local: each
// emitter runs only on the client that caused the change, so every moment plays exactly once.
import { MOD } from "./casting.js";

const tierFor = level => level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;   // Bad Eden tiers (bad-eden-5e rubric)
const charLevel = actor => (actor?.items ?? []).filter(i => i.type === "class").reduce((s, i) => s + (Number(i.system?.levels) || 0), 0);
const tokenIdOf = actor => { try { return actor?.getActiveTokens?.(true, false)?.[0]?.id ?? null; } catch (_e) { return null; } };
const emit = (hook, payload) => { try { Hooks.callAll(hook, payload); } catch (e) { console.warn(`${MOD} | moment ${hook} failed`, e); } };

const ENL = "bbttcc-character-options";
const ENL_LADDER = ["unawakened", "awakening", "seeking", "understanding", "wisdom", "enlightened"];

export function activateMoments() {
  // ── Surge banked (surge-powers fires surgePowers.banked on the granting client) ──
  Hooks.on("surgePowers.banked", (actor, amount) => {
    if (!actor || !(amount > 0)) return;
    const S = game.surgePowers;
    emit("fourththing.surgeBanked", { actorId: actor.id, actorUuid: actor.uuid, actorName: actor.name, tokenId: tokenIdOf(actor),
      amount, value: S?.get?.(actor) ?? 0, cap: S?.max?.(actor) ?? 0, fromHarvest: false });
  });

  // ── Level up / tier up (a class item's levels rise on this client) ──
  // dnd5e's AdvancementManager commits a level-up as ONE Item update batch holding EVERY item on the actor
  // (diff:false), and Foundry hands the same options object to every document in that batch — so the class item's
  // preUpdate stash is visible to every feature, weapon and spell in it (review C1: ~30 TIER UP cards). Only class
  // items announce, and a per-actor memory of the last announced level keeps the two paths (an existing class's
  // update; the create of a new one — a multiclass dip arrives already at its final levels, review P1) from
  // announcing the same level twice.
  const announced = new Map();   // actorId → { to, at }
  const announce = (actor, from, to) => {
    if (!actor || !(to > from)) return;
    const last = announced.get(actor.id);
    if (last && last.to === to && Date.now() - last.at < 5000) return;
    announced.set(actor.id, { to, at: Date.now() });
    const tierFrom = tierFor(from), tier = tierFor(to);
    emit("fourththing.leveledUp", { actorId: actor.id, actorUuid: actor.uuid, actorName: actor.name, from, to, tierFrom, tier, tierUp: tier > tierFrom });
  };
  Hooks.on("preUpdateItem", (item, changes, options) => {
    if (item.type !== "class" || item.parent?.type !== "character" || !foundry.utils.hasProperty(changes, "system.levels")) return;
    options.be5eLevelFrom = charLevel(item.parent);
  });
  Hooks.on("updateItem", (item, changes, options, userId) => {
    if (userId !== game.user.id || options.be5eLevelFrom == null || item.type !== "class" || item.parent?.type !== "character") return;
    announce(item.parent, options.be5eLevelFrom, charLevel(item.parent));
  });
  // a first class landing on a character is level 0 → 1 (the wizard's import); a later one is a dip on top of the rest
  Hooks.on("createItem", (item, _options, userId) => {
    if (userId !== game.user.id || item.type !== "class" || item.parent?.type !== "character") return;
    const actor = item.parent, to = charLevel(actor), from = Math.max(0, to - (Number(item.system?.levels) || 0));
    if (to <= 0) return;
    announce(actor, from, to);
  });

  // ── Last Stand (a character falls to 0 HP) + Enlightenment steps ──
  Hooks.on("preUpdateActor", (actor, changes, options) => {
    if (actor.type !== "character") return;
    if (foundry.utils.hasProperty(changes, "system.attributes.hp.value")) options.be5eHpFrom = Number(actor.system?.attributes?.hp?.value) || 0;
    if (foundry.utils.hasProperty(changes, `flags.${ENL}.enlightenment`)) options.be5eEnlFrom = String(actor.getFlag(ENL, "enlightenment")?.level || "unawakened");
  });
  Hooks.on("updateActor", (actor, _changes, options, userId) => {
    if (userId !== game.user.id || actor.type !== "character") return;
    if (options.be5eHpFrom > 0 && (Number(actor.system?.attributes?.hp?.value) || 0) <= 0) emit("fourththing.enteredLastStand", actor);
    if (options.be5eEnlFrom != null) {
      const from = options.be5eEnlFrom, to = String(actor.getFlag(ENL, "enlightenment")?.level || "unawakened");
      if (ENL_LADDER.indexOf(to) > ENL_LADDER.indexOf(from)) emit("fourththing.enlightenmentStepped", { actorId: actor.id, from, to, source: "dnd5e" });
    }
  });
}
