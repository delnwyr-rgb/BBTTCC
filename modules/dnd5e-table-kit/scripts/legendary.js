// D&D 5e Table Kit — legendary actions & resistances for player characters.
//
// dnd5e only models legendary actions/resistances on NPCs (resources.legact /
// legres = { max, spent }). Characters have no such fields, so an Active Effect
// like The Targaan Blade's `system.resources.legact.max ADD 1` lands on a bare
// derived property ("+ 1") that nothing reads. This module gives characters the
// same shape the NPC model has:
//   max   — from those AE keys (evaluated, so "+ 1" stacking works)
//   spent — persisted in flags.dnd5e-table-kit.legendary.{legact,legres}
//   value — max - spent
// and shows them as pips on the character sheet, with NPC-identical recovery:
// legendary actions reset at encounter start and turn end, resistances (and
// actions) on a long rest. Spending a legendary resistance posts a chat card.

// Entry point for the whole kit (the manifest lists only this file).
import { activateRiders } from "./riders.js";
import { activateAutomation } from "./automation.js";

const ID = "dnd5e-table-kit";
const KINDS = {
  legact: { label: "DND5E.LegendaryAction.Label" },
  legres: { label: "DND5E.LegendaryResistance.Label" }
};

function toNumber(raw) {
  if ( typeof raw === "number" ) return raw;
  if ( (raw === undefined) || (raw === null) || (raw === "") ) return 0;
  try { return Number(Roll.safeEval(String(raw))) || 0; } catch { return Number(raw) || 0; }
}

function spentFlags(actor) {
  return actor?.flags?.[ID]?.legendary ?? {};
}

const LEGENDARY_KEY = /^system\.resources\.(legact|legres)\.(max|value)$/;

/**
 * Read the pool sizes straight off the actor's active effects. dnd5e's own AE
 * pass can't hold them (characters have no schema field there, so it keeps only
 * the last change per pool), so we total add/override changes ourselves. `.max`
 * wins; a pool authored only with `.value` falls back to that.
 */
function legendaryGrants(actor) {
  const totals = {};
  for ( const effect of actor.appliedEffects ?? [] ) {
    for ( const change of effect.changes ?? [] ) {
      const [, pool, field] = String(change.key).match(LEGENDARY_KEY) ?? [];
      if ( !pool ) continue;
      const slot = (totals[pool] ??= {})[field] ??= { add: 0, override: null };
      const n = toNumber(change.value);
      if ( (change.type ?? change.mode) === "override" ) slot.override = n;
      else slot.add += n;
    }
  }
  const size = slot => slot ? (slot.override ?? 0) + slot.add : null;
  return Object.fromEntries(Object.keys(KINDS).map(k => [k, size(totals[k]?.max) ?? size(totals[k]?.value) ?? 0]));
}

/** Normalise resources.legact / legres on a prepared character into the NPC shape. */
function prepareLegendaries(system) {
  const spent = spentFlags(system.parent);
  const granted = legendaryGrants(system.parent);
  system.resources ??= {};
  for ( const key of Object.keys(KINDS) ) {
    const max = Math.max(0, Math.floor(granted[key]));
    const used = Math.clamp(Number(spent[key]) || 0, 0, max);
    system.resources[key] = { max, spent: used, value: max - used };
  }
}

function patchCharacterData() {
  const proto = dnd5e.dataModels.actor.CharacterData.prototype;

  const prepare = proto.prepareDerivedData;
  proto.prepareDerivedData = function(...args) {
    const result = prepare.apply(this, args);
    try { prepareLegendaries(this); } catch(err) { console.warn(`${ID} | legendary prep failed`, err); }
    return result;
  };

  // Mirror NPCData.recoverCombatUses: actions come back at encounter start and turn end.
  const recover = proto.recoverCombatUses;
  proto.recoverCombatUses = async function(periods, results) {
    await recover?.call(this, periods, results);
    if ( this.resources?.legact?.max && (periods.includes("encounter") || periods.includes("turnEnd")) ) {
      results.actor[`flags.${ID}.legendary.legact`] = 0;
    }
  };
}

/** Long rest refreshes both pools. */
function onPreRestCompleted(actor, result) {
  if ( (actor.type !== "character") || !result.longRest ) return;
  const { legact, legres } = actor.system.resources ?? {};
  if ( legact?.max ) result.updateData[`flags.${ID}.legendary.legact`] = 0;
  if ( legres?.max ) result.updateData[`flags.${ID}.legendary.legres`] = 0;
}

async function adjust(actor, key, delta) {
  const pool = actor.system.resources?.[key];
  if ( !pool?.max ) return;
  const spent = Math.clamp(pool.spent + delta, 0, pool.max);
  if ( spent === pool.spent ) return;
  await actor.update({ [`flags.${ID}.legendary.${key}`]: spent });
  if ( (key === "legres") && (delta > 0) ) {
    const left = pool.max - spent;
    // Flip this actor's most recent failed save (last 10 minutes) to a success, the
    // same "resisted" mark dnd5e uses, so half-damage and effect automation follow.
    const recent = Date.now() - (10 * 60 * 1000);
    const failed = game.messages.contents.findLast(m => (m.type === "save") && (m.timestamp > recent)
      && (m.getAssociatedActor?.() === actor) && m.rolls?.[0]?.isFailure && !m.system?.resisted);
    if ( failed?.canUserModify(game.user, "update") ) await failed.update({ "system.resisted": true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong> uses a <strong>Legendary Resistance</strong>: `
        + `the failed saving throw succeeds instead.${failed ? "" : " <em>(No recent failed save found; mark it by hand.)</em>"}`
        + ` <em>(${left}/${pool.max} left)</em></p>`
    });
  }
}

function pipsHTML(key, pool, editable) {
  const pips = Array.fromRange(pool.max, 1).map(n => {
    const filled = pool.value >= n;
    return `<button type="button" class="pip${filled ? " filled" : ""}" data-tk-pool="${key}" `
      + `data-tk-filled="${filled}" ${editable ? "" : "disabled"} aria-pressed="${filled}"></button>`;
  }).join("");
  return `<div class="tk-pool ${key}">
    <span class="label roboto-condensed-upper">${game.i18n.localize(KINDS[key].label)}</span>
    <div class="pips">${pips}</div>
  </div>`;
}

function onRenderCharacterSheet(app, element) {
  const actor = app.actor ?? app.document;
  const root = element instanceof HTMLElement ? element : element?.[0];
  if ( !actor || !root ) return;
  root.querySelector(".tk-legendary")?.remove();
  const res = actor.system.resources ?? {};
  const pools = Object.keys(KINDS).filter(k => res[k]?.max);
  if ( !pools.length ) return;

  const anchor = root.querySelector(".sidebar .stats .meter.hit-dice")?.closest(".meter-group")
    ?? root.querySelector(".sidebar .stats");
  if ( !anchor ) return;
  const block = document.createElement("div");
  block.className = "meter-group tk-legendary";
  block.innerHTML = pools.map(k => pipsHTML(k, res[k], actor.isOwner)).join("");
  block.addEventListener("click", event => {
    const pip = event.target.closest("[data-tk-pool]");
    if ( !pip || pip.disabled ) return;
    event.preventDefault();
    event.stopPropagation();
    // Filled pip = spend one; empty pip = recover one.
    adjust(actor, pip.dataset.tkPool, pip.dataset.tkFilled === "true" ? 1 : -1);
  });
  if ( anchor.classList.contains("meter-group") ) anchor.after(block);
  else anchor.append(block);
}

export function activate() {
  if ( game.system.id !== "dnd5e" ) return;
  try { activateRiders(); } catch(err) { console.error(`${ID} | could not start riders`, err); }
  try { activateAutomation(); } catch(err) { console.error(`${ID} | could not start automation`, err); }
  try { patchCharacterData(); } catch(err) { console.error(`${ID} | could not patch CharacterData`, err); }
  Hooks.on("dnd5e.preRestCompleted", onPreRestCompleted);
  Hooks.on("renderCharacterActorSheet", onRenderCharacterSheet);
}

Hooks.once("init", activate);
