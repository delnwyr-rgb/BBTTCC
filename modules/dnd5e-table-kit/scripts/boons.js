// D&D 5e Table Kit — the 2024 EPIC BOONS, automated (Dave 2026-11-13: "the players are each about to get 2 more…
// if we could automate the lot that would be fantastic!"). Keyed by the PHB item identifier (system.identifier, e.g.
// "boon-of-combat-prowess"), so a boon a player takes later works the moment it lands on the sheet.
//
//   Combat Prowess · Peerless Aim     a missed attack → "Hit instead?" (once until your next turn) → the hit lands
//   Irresistible Offense              your bludgeoning / piercing / slashing ignores Resistance; a natural 20 adds
//                                     damage equal to the ability score this boon raised
//   Fortitude · Fortified Health      regaining HP regains +CON mod more (once per turn)
//   Recovery · Last Stand             dropping to 0 HP → 1 HP + half your HP max instead (once per long rest)
//   Energy Resistance                 "Choose Resistances" asks for two types → a lasting Resistance effect
//   Fate · Improve Fate               d20 cards of creatures within 60 ft get a 🎲 Improve Fate button (±2d4)
//   Spell Recall                      a level 1–4 slot spell rolls 1d4; on the slot's level the slot comes back
//   Dimensional Travel · Blink Steps  after an Attack / Magic action: a 30-ft teleport reminder
//   Truesight / Fortitude HP / Speed  already passive effects on the PHB items
// Turn-limited uses live in flags.dnd5e-table-kit.boons.<key> = "<combatId>:<round>:<turn>" (out of combat: per 6 s).

import { ID } from "./riders.js";

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function boonOf(actor, id) {
  return actor?.items?.find?.(i => i.system?.identifier === id || slug(i.name) === id) ?? null;
}
const turnKey = () => game.combat?.started ? `${game.combat.id}:${game.combat.round}:${game.combat.turn}` : `t:${Math.floor(Date.now() / 6000)}`;
const roundKey = () => game.combat?.started ? `${game.combat.id}:${game.combat.round}` : `t:${Math.floor(Date.now() / 6000)}`;
const usedKey = (actor, key) => actor?.flags?.[ID]?.boons?.[key];
async function card(actor, title, lines, whisperOwners = false) {
  const owners = whisperOwners ? game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id) : undefined;
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), ...(owners ? { whisper: owners } : {}),
    content: `<div class="tk-card"><p class="tk-title">${title}</p>${lines.map(l => `<p>${l}</p>`).join("")}</div>` });
}
function abilityRaised(item, actor) {
  try {
    const adv = Object.values(item.system?.advancement?.contents ?? item.system?.advancement ?? {}).find(a => a.type === "AbilityScoreImprovement");
    const asg = adv?.value?.assignments ?? {};
    const k = Object.keys(asg).find(x => asg[x]);
    if (k) return { key: k, score: Number(actor.system?.abilities?.[k]?.value) || 0 };
  } catch (_e) {}
  const s = Number(actor.system?.abilities?.str?.value) || 0, d = Number(actor.system?.abilities?.dex?.value) || 0;
  return s >= d ? { key: "str", score: s } : { key: "dex", score: d };
}

// ── Combat Prowess: Peerless Aim (attacker's client, from automation.js onRollAttack) ──────────────────────
export async function peerlessAim(actor) {
  if (!boonOf(actor, "boon-of-combat-prowess")) return false;
  if (usedKey(actor, "peerless") === roundKey()) return false;   // once until the start of your next turn ≈ once per round
  const yes = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Peerless Aim" }, content: `<p><b>${esc(actor.name)}</b> missed. Use <b>Boon of Combat Prowess</b> to hit instead?</p>`,
    rejectClose: false }).catch(() => false);
  if (!yes) return false;
  await actor.update({ [`flags.${ID}.boons.peerless`]: roundKey() });
  await card(actor, "🎯 Peerless Aim", [`${esc(actor.name)} turns the miss into a <b>hit</b>.`]);
  return true;
}

// ── Irresistible Offense (GM client, from automation.js applyDamageCard) ───────────────────────────────────
// Returns { ignoreTypes:Set|null, extra:{value,type}|null, note } for this attacker + attack roll.
export function offenseMods(attacker, attackRoll, damages) {
  const it = boonOf(attacker, "boon-of-irresistible-offense");
  if (!it) return null;
  const out = { ignoreTypes: new Set(["bludgeoning", "piercing", "slashing"]), extra: null, note: "Irresistible Offense: B/P/S ignores resistance" };
  const nat20 = (attackRoll?.dice?.[0]?.results ?? []).some(r => r.active && r.result === 20);
  if (nat20) {
    const { key, score } = abilityRaised(it, attacker);
    const type = damages.find(d => ["bludgeoning", "piercing", "slashing"].includes(d.type))?.type ?? damages[0]?.type;
    out.extra = { value: score, type, properties: new Set() };
    out.note += ` · Overwhelming Strike +${score} (${key.toUpperCase()})`;
  }
  return out;
}

// ── HP: Recovery · Last Stand and Fortitude · Fortified Health (the client making the HP change) ───────────
function installHp() {
  Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id || options?.[`${ID}NoBoons`]) return;
    const next = foundry.utils.getProperty(changes, "system.attributes.hp.value");
    if (next === undefined) return;
    const hp = actor.system?.attributes?.hp; if (!hp) return;
    const cur = Number(hp.value) || 0, max = Number(hp.max) || 0;
    // Last Stand: would drop to 0 from above 0
    if (Number(next) <= 0 && cur > 0) {
      const it = boonOf(actor, "boon-of-recovery");
      const act = it?.system?.activities?.contents?.find?.(a => /last stand/i.test(a.name ?? ""));
      const spent = Number(act?.uses?.spent ?? 0), umax = Number(act?.uses?.max ?? 1) || 1;
      const flagged = usedKey(actor, "lastStand");
      if (it && spent < umax && !flagged) {
        const to = Math.min(max, 1 + Math.floor(max / 2));
        foundry.utils.setProperty(changes, "system.attributes.hp.value", to);
        foundry.utils.setProperty(changes, `flags.${ID}.boons.lastStand`, true);
        options[`${ID}LastStand`] = to;
        if (act?.uses?.max) setTimeout(() => it.update({ [`system.activities.${act.id}.uses.spent`]: spent + 1 }).catch(() => {}), 50);
        setTimeout(() => card(actor, "🛡 Last Stand", [`${esc(actor.name)} refuses to fall — <b>1 HP</b>, then regains half their hit points (<b>${to}/${max}</b>).`]), 80);
      }
      return;
    }
    // Fortified Health: regaining HP (not a rest refill to full from a sheet edit of max)
    if (Number(next) > cur && !options[`${ID}LastStand`]) {
      if (!boonOf(actor, "boon-of-fortitude")) return;
      if (usedKey(actor, "fortified") === turnKey()) return;
      const con = Math.max(0, Number(actor.system?.abilities?.con?.mod) || 0);
      if (!con) return;
      const to = Math.min(max, Number(next) + con);
      if (to <= Number(next)) return;
      foundry.utils.setProperty(changes, "system.attributes.hp.value", to);
      foundry.utils.setProperty(changes, `flags.${ID}.boons.fortified`, turnKey());
      setTimeout(() => card(actor, "❤ Fortified Health", [`${esc(actor.name)} regains <b>+${to - Number(next)}</b> more (Boon of Fortitude).`], true), 80);
    }
  });
  // long rest: Last Stand comes back
  Hooks.on("dnd5e.restCompleted", (actor, result) => {
    if (!result?.longRest || !usedKey(actor, "lastStand")) return;
    actor.update({ [`flags.${ID}.boons.-=lastStand`]: null }).catch(() => {});
  });
}

// ── Energy Resistance: choose two types → one lasting transfer effect ──────────────────────────────────────
const ER_TYPES = ["acid", "cold", "fire", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];
async function chooseResistances(item) {
  const actor = item.actor; if (!actor) return;
  const cur = item.flags?.[ID]?.energyResist ?? [];
  const label = (t) => CONFIG.DND5E.damageTypes?.[t]?.label ?? t;
  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${actor.name} — Energy Resistances` },
    content: `<p>Choose <b>two</b> damage types to resist (you can change them after each Long Rest).</p>` +
      ER_TYPES.map(t => `<label style="display:inline-flex;gap:.3rem;width:48%;padding:.1rem"><input type="checkbox" name="er" value="${t}" ${cur.includes(t) ? "checked" : ""}/>${esc(label(t))}</label>`).join(""),
    ok: { label: "Resist these", callback: (_ev, b) => [...b.form.querySelectorAll("input[name=er]:checked")].map(i => i.value) }, rejectClose: false,
  }).catch(() => null);
  if (!picked) return;
  if (picked.length !== 2) return ui.notifications.warn("Choose exactly two damage types.");
  const name = "Energy Resistances (chosen)";
  const changes = picked.map(t => ({ key: "system.traits.dr.value", type: "add", value: t, phase: "initial", priority: 20 }));
  const have = item.effects.find(e => e.flags?.[ID]?.energyResist);
  if (have) await have.update({ name, "system.changes": changes, disabled: false });
  else await item.createEmbeddedDocuments("ActiveEffect", [{ name, img: item.img, transfer: true, flags: { [ID]: { energyResist: true } }, system: { changes } }]);
  await item.update({ [`flags.${ID}.energyResist`]: picked });
  await card(actor, "🛡 Energy Resistances", [`${esc(actor.name)} now resists <b>${picked.map(label).join("</b> and <b>")}</b>.`]);
}

// ── Fate: a 🎲 button on d20 cards of creatures within 60 ft of a boon holder ─────────────────────────────
function fateHolders(message) {
  const speakerTok = canvas?.tokens?.get?.(message.speaker?.token) ?? null;
  const out = [];
  for (const a of game.actors.contents) {
    if (a.type !== "character" || !a.isOwner) continue;
    const it = boonOf(a, "boon-of-fate"); if (!it) continue;
    if ((Number(it.system?.uses?.max) || 0) && (Number(it.system?.uses?.spent) || 0) >= Number(it.system.uses.max)) continue;
    // RAW: you or a creature you can see within 60 ft — the holder must have a token on this scene within 60 ft of the
    // roller (11-13: a holder with no token here used to get the button, and the GM's window showed every holder's)
    const t = a.getActiveTokens?.(true)?.find?.(x => x.scene === speakerTok?.scene) ?? null;
    if (!speakerTok || !t) continue;
    const d = (t === speakerTok) ? 0 : (canvas.grid.measurePath([t.center, speakerTok.center])?.distance ?? Infinity);
    if (d > 60) continue;
    out.push({ actor: a, item: it });
  }
  return out;
}
async function improveFate(message, holder, item) {
  const r0 = message.rolls?.[0]; if (!r0) return;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `${holder.name} — Improve Fate` }, content: `<p>Roll <b>2d4</b> and apply it to <b>${esc(message.speaker?.alias ?? "the roll")}</b>'s ${r0.total}:</p>`,
    buttons: [{ action: "plus", label: "+ Bonus", default: true }, { action: "minus", label: "− Penalty" }, { action: "cancel", label: "Cancel" }], rejectClose: false,
  }).catch(() => null);
  if (!choice || choice === "cancel") return;
  const r = await new Roll("2d4").evaluate();
  const total = r0.total + (choice === "plus" ? r.total : -r.total);
  const target = Number(r0.options?.target);
  const verdict = Number.isFinite(target) ? (total >= target ? " — <b>success</b>" : " — <b>failure</b>") : "";
  if (item.system?.uses?.max) await item.update({ "system.uses.spent": (Number(item.system.uses.spent) || 0) + 1 });
  await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: holder }), flavor: `🎲 Improve Fate (Boon of Fate) on ${esc(message.speaker?.alias ?? "a roll")}: ${r0.total} ${choice === "plus" ? "+" : "−"} ${r.total} = <b>${total}</b>${verdict}` });
}
function installFateButtons() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    try {
      const r0 = message.rolls?.[0];
      // dnd5e 6: the roll kind is the message type ("attack" / "save" / "check" / "skill" / "tool") or the roll's rollType
      const kind = [message.type, r0?.options?.rollType, message.flags?.dnd5e?.roll?.type].find(k => ["attack", "save", "check", "skill", "tool", "ability", "concentration", "death"].includes(k));
      const isD20 = r0 && (r0.dice?.[0]?.faces === 20) && !!kind;
      if (!isD20 || (Date.now() - message.timestamp) > 5 * 60 * 1000) return;
      const holders = fateHolders(message); if (!holders.length) return;
      const root = html instanceof HTMLElement ? html : html?.[0]; if (!root || root.querySelector(".tk-fate")) return;
      const wrap = document.createElement("div"); wrap.className = "tk-fate"; wrap.style.cssText = "display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.25rem";
      for (const h of holders) {
        const b = document.createElement("button"); b.type = "button"; b.style.cssText = "width:auto;font-size:.75rem;padding:.1rem .45rem";
        b.textContent = `🎲 Improve Fate (${h.actor.name})`;
        b.addEventListener("click", () => improveFate(message, h.actor, h.item).catch(e => ui.notifications.warn(String(e?.message ?? e))));
        wrap.appendChild(b);
      }
      // dnd5e rebuilds its roll card's content after this hook — attach at the card's outer level, after it settles
      const attach = () => { if (!root.querySelector(".tk-fate")) root.appendChild(wrap); };
      attach(); setTimeout(attach, 250); setTimeout(attach, 1000);
    } catch (_e) {}
  });
}

// ── Activity hooks: Energy Resistance chooser, Spell Recall, Blink Steps ────────────────────────────────────
function installActivity() {
  Hooks.on("dnd5e.preUseActivity", (activity) => {
    const item = activity?.item;
    if (item?.system?.identifier === "boon-of-energy-resistance" && /choose/i.test(activity.name ?? "")) {
      chooseResistances(item).catch(e => console.warn(`${ID} | energy resistance`, e));
      return false;   // the dialog replaces the nine one-type effects
    }
  });
  Hooks.on("dnd5e.postUseActivity", async (activity, usage) => {
    try {
      const item = activity?.item, actor = item?.actor;
      if (!actor || !actor.isOwner) return;
      // Spell Recall: a level 1–4 slot → 1d4; on the slot's level, the slot isn't spent
      if (item.type === "spell" && boonOf(actor, "boon-of-spell-recall")) {
        const slot = String(usage?.spell?.slot ?? "");
        const lvl = Number(slot.replace(/\D/g, "")) || 0;
        if (/^spell\d$/.test(slot) && lvl >= 1 && lvl <= 4) {
          const r = await new Roll("1d4").evaluate();
          const keep = r.total === lvl;
          if (keep) { const v = Number(actor.system?.spells?.[slot]?.value) || 0; await actor.update({ [`system.spells.${slot}.value`]: v + 1 }); }
          await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `📜 Spell Recall (level ${lvl} slot): ${r.total}${keep ? " — <b>the slot isn't expended</b>" : ""}` });
        }
      }
      // Blink Steps: after the Attack action (an attack) or the Magic action (a spell)
      if (boonOf(actor, "boon-of-dimensional-travel") && (activity.type === "attack" || item.type === "spell") && (activity.activation?.type === "action")) {
        await card(actor, "✨ Blink Steps", [`${esc(actor.name)} may teleport up to <b>30 ft</b> to an unoccupied space they can see (Boon of Dimensional Travel).`], true);
      }
    } catch (e) { console.warn(`${ID} | boon activity hook`, e); }
  });
}

export function activateBoons() {
  installHp();
  installFateButtons();
  installActivity();
}
