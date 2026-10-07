/**
 * NPC AUTOMATION ENGINE (2026-10-06) — the bestiary's prose mechanics, made to happen.
 * ----------------------------------------------------------------------------------------------------
 * Owner ask (NPC Pack v1 full pass): "anything that has a described mechanical game effect should have that effect
 * actually happen in game, automated if possible, and hooked to an animation if possible."
 *
 * Weapon riders that fit the system's OWN manifestation schema (on-hit conditions, on-hit saves, save-first cones) are
 * data on the weapon (manifestation.appliedStates / resolution / riderDamage — see module.js ftOpenEngageDialog +
 * attackTest). Everything else is a RULE on the ability item:
 *
 *   flags.fourththing.npcAuto = { v: 1, rules: [ { on, if?, do, radius?, who?, limit?, label? } ], recharge? }
 *
 *   on        "attack"     the owner makes a Strike          (do.reroll: "attack" | "damage" | "damage-highest")
 *             "hit"        the owner's Strike hits            (do.condition / damage / dot / radiation / noReactions / prompt)
 *             "turnStart"  a combatant starts its turn within `radius` squares of the owner — an AURA
 *                          (who: "enemies" default | "allies" | "all"; do.save + condition / damage / prompt)
 *             "selfTurnStart" the owner starts its turn         (do.prompt / tempIntegrity / damage-to-self … )
 *             "bloodied"   the owner first drops to ≤ half Integrity (do.morale / tempIntegrity / prompt) — once per combat
 *             "zero"       the owner drops to 0 Integrity        (do.prompt)
 *             "allyDamaged" an ally within `radius` squares is about to take damage (do.ward: multiplier) — a REACTION
 *             "use"        the GM clicks ▶ Use on the feature — an ACTION: runs `do` on each targeted token (or the owner
 *                          when nothing is targeted; who:"self" forces that)
 *             "saveFail"   a target just FAILED this item's save card (save-first / on-hit-save weapons) — secondary
 *                          effects: noReactions, radiation, extra damage, a push prompt…
 *             "struck"     the owner was HIT by a Strike (if.damageType filters the weapon's type) — retaliation: `do`
 *                          runs against the ATTACKER
 *             "damaged"    the owner took damage (any source; if.damageType) — self effects only (heal, tempIntegrity, prompt)
 *             "attacked"   someone Strikes the owner (do.reroll: "attack-highest" = the attacker rerolls their highest die)
 *   if        { firstRound, targetNotActed, allyAdjacentToTarget, targetTag:[…], targetCondition:[…], weapon:"<item name>",
 *               damageType:[…], ownerNotAttacked, ownerBloodied, targetBloodied }
 *   do        { reroll, condition:{key, duration, save:{attr, dc}}, save:{attr, dc, onSave}, damage:{formula, type, track?},
 *               dot:{formula, type, ends:"action"|"rounds", rounds}, radiation:N, noReactions:true, tempIntegrity:N|"formula",
 *               heal:N|"formula", morale:{attr, dc, outcome, condition?}, ward:0.5, prompt:"…" }
 *   limit     { per: "round" | "combat" | "scene", uses: 1 }
 *   recharge  (on a WEAPON's npcAuto) { mode: "d6", min: 5 } | { mode: "combat" } — spent on use, rolled back at turn start
 *
 * Every effect goes through an existing system API (save-prompt card, applyManifestationStates, _applyDamageToActor,
 * tempIntegrity, radiation, impose) so relays, immunities and chat cards behave like everything else. Each fired rule
 * plays its item's Automated Animation (ftPlayAutoAnimation) and posts one compact chat line. Turn-start, bloodied,
 * zero and reaction rules run ONCE, on the primary GM. World setting `npcAutomation` turns the engine off.
 */

const MOD = "fourththing";
const SQ = () => Number(canvas?.scene?.grid?.distance) || 5;

export function registerNpcAutomation({ actorKind, postSavePrompt, playAnimation, ftEscapeHtml }) {
  game.settings.register(MOD, "npcAutomation", {
    name: "NPC ability automation", scope: "world", config: true, type: Boolean, default: true,
    hint: "Bestiary/NPC abilities with authored rules (auras, morale, reactions, rerolls, damage-over-time, recharge) run automatically. Off = prose only."
  });
  const on = () => { try { return game.settings.get(MOD, "npcAutomation") !== false; } catch (_e) { return true; } };
  const esc = s => (ftEscapeHtml ? ftEscapeHtml(s) : String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  const isPrimaryGM = () => game.user?.isGM && (game.users?.activeGM ? game.users.activeGM.id === game.user.id : true);

  // ── rule discovery ────────────────────────────────────────────────────────────────────────────────
  function rulesOf(actor, on) {
    const out = [];
    for (const item of actor?.items ?? []) {
      const na = item.flags?.[MOD]?.npcAuto;
      for (const rule of na?.rules ?? []) if (rule?.on === on) out.push({ item, rule });
    }
    return out;
  }
  const tokenOf = (actor) => actor?.getActiveTokens?.()[0] ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === actor?.id) ?? null;
  const squaresBetween = (a, b) => {
    const ta = tokenOf(a), tb = tokenOf(b); if (!ta || !tb) return Infinity;
    try { return Math.round(canvas.grid.measurePath([ta.center, tb.center]).distance / SQ()); }
    catch (_e) { return Math.round(Math.hypot(ta.center.x - tb.center.x, ta.center.y - tb.center.y) / canvas.grid.size); }
  };
  const disp = (actor) => tokenOf(actor)?.document?.disposition ?? (actor?.type === "character" ? 1 : -1);
  const hostile = (a, b) => disp(a) !== disp(b);

  // ── limits (per round / combat / scene), stored on the active combat so they reset with it ─────────
  function limitKey(item, rule) { return `${item.uuid}#${(item.flags[MOD].npcAuto.rules ?? []).indexOf(rule)}`; }
  function limitOk(item, rule) {
    if (!rule.limit) return true;
    const c = game.combat, used = c?.getFlag?.(MOD, "npcAutoUses") ?? {};
    const k = limitKey(item, rule), rec = used[k];
    const stamp = rule.limit.per === "round" ? `${c?.id}:${c?.round}` : rule.limit.per === "combat" ? `${c?.id}` : `${canvas?.scene?.id}`;
    return !rec || rec.stamp !== stamp || rec.n < (rule.limit.uses ?? 1);
  }
  async function limitSpend(item, rule) {
    if (!rule.limit || !game.combat || !game.user.isGM) return;
    const c = game.combat, used = foundry.utils.deepClone(c.getFlag(MOD, "npcAutoUses") ?? {});
    const k = limitKey(item, rule);
    const stamp = rule.limit.per === "round" ? `${c.id}:${c.round}` : rule.limit.per === "combat" ? `${c.id}` : `${canvas?.scene?.id}`;
    used[k] = used[k]?.stamp === stamp ? { stamp, n: used[k].n + 1 } : { stamp, n: 1 };
    await c.setFlag(MOD, "npcAutoUses", used);
  }

  // ── predicates ────────────────────────────────────────────────────────────────────────────────────
  function predicateOk(cond, { actor, target, item, ...extra }) {
    if (!cond) return true;
    const c = game.combat;
    if (cond.firstRound && !(c?.started && c.round <= 1)) return false;
    if (cond.targetNotActed && c?.started) {
      const tc = c.combatants.find(x => x.actor?.id === target?.id);
      if (!tc || c.round > 1 || (c.turns.indexOf(tc) < c.turn)) return false;
      if (c.turns.indexOf(tc) === c.turn) return false;
    }
    if (cond.allyAdjacentToTarget && target) {
      const allies = (c?.combatants ?? []).map(x => x.actor).filter(a => a && a.id !== actor.id && !hostile(a, actor));
      if (!allies.some(a => squaresBetween(a, target) <= 1)) return false;
    }
    if (cond.targetTag?.length) {
      const ct = String(target?.flags?.[MOD]?.creatureType ?? "").split(",").map(s => s.trim());
      const lin = target?.flags?.[MOD]?.rfi?.actor?.lineage;
      if (!cond.targetTag.some(t => ct.includes(t) || lin === t)) return false;
    }
    if (cond.targetCondition?.length) {
      const sys = target?.system?.system ?? target?.system ?? {};
      if (!cond.targetCondition.some(k => sys.conditions?.[k])) return false;
    }
    if (cond.weapon && item && item.name !== cond.weapon) return false;
    if (cond.damageType?.length && !cond.damageType.includes(String(extra.damageType || "").toLowerCase())) return false;
    if (cond.ownerNotAttacked && (c?.getFlag?.(MOD, "npcAutoAttacked") ?? {})[actor?.id]) return false;
    const bloodied = a => { const d = a?.system?.derived?.integrity; return d?.max > 0 && d.value <= d.max / 2; };
    if (cond.ownerBloodied && !bloodied(actor)) return false;
    if (cond.targetBloodied && !bloodied(target)) return false;
    return true;
  }

  // ── chat ──────────────────────────────────────────────────────────────────────────────────────────
  async function card(actor, item, lines, color = "#8a6ad8") {
    if (!lines.length) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll ft-npcauto-card" style="border-color:${color}">
        <div class="ft-roll-header"><span class="ft-roll-name">⚙ ${esc(item?.name ?? "Ability")}</span></div>
        <ul style="margin:0.2rem 0 0;padding-left:1.1rem;font-size:0.78rem">${lines.map(l => `<li>${l}</li>`).join("")}</ul>
      </div>`
    });
  }
  const anim = async (actor, item, hit = true) => { try { await playAnimation?.(actor, item, { hit }); } catch (_e) {} };

  // ── effect executor (shared by hit / aura / self rules) ─────────────────────────────────────────────
  async function runDo(actor, item, rule, target, { lines }) {
    const d = rule.do ?? {};
    const tName = esc(target?.name ?? "");
    if (d.condition?.key && target) {
      if (d.condition.save) {
        const mf = {
          resolution: { saveAttribute: d.condition.save.attr || "body", saveDcMode: "fixed", saveDcFixed: Number(d.condition.save.dc) || 13, onSave: "negate", statesOnFail: true },
          appliedStates: { states: [d.condition.key], duration: d.condition.duration || "1-round", saveEachRound: d.condition.duration === "until-saved", saveAttribute: d.condition.save.attr || "body" }
        };
        const dr = d.damage?.formula ? toDr(d.damage) : { op: "none" };
        await postSavePrompt(actor, target, item, mf, dr, { castDc: Number(d.condition.save.dc) || 13 });
        lines.push(`${tName}: ${esc(d.condition.save.attr)} DC ${d.condition.save.dc} or <b>${esc(d.condition.key)}</b> — save card posted`);
        return;   // damage (if any) rides the save card
      }
      await game.fourththing.applyManifestationStates(actor, target, item, { appliedStates: { states: [d.condition.key], duration: d.condition.duration || "1-round" } }, { castDc: 15 });
      lines.push(`${tName}: <b>${esc(d.condition.key)}</b>`);
    }
    if (d.save && !d.condition && target) {   // save-for-damage aura (no condition)
      const mf = { resolution: { saveAttribute: d.save.attr || "soul", saveDcMode: "fixed", saveDcFixed: Number(d.save.dc) || 13, onSave: d.save.onSave || "negate", statesOnFail: true }, appliedStates: {} };
      await postSavePrompt(actor, target, item, mf, d.damage?.formula ? toDr(d.damage) : { op: "none" }, { castDc: Number(d.save.dc) || 13 });
      lines.push(`${tName}: ${esc(d.save.attr)} DC ${d.save.dc} — save card posted`);
      return;
    }
    if (d.damage?.formula && target) {
      const roll = await new Roll(String(d.damage.formula)).evaluate();
      const track = d.damage.track || ((["psychic", "qliphothic"].includes(d.damage.type)) ? "stress" : "integrity");
      await game.fourththing.rolls._applyDamageToActor(target, roll.total, { op: "damage", track, damageType: d.damage.type || "kinetic" });
      lines.push(`${tName}: ${roll.total} ${esc(d.damage.type || "kinetic")}${track === "stress" ? " to Stress" : ""}`);
    }
    if (d.dot?.formula && target && game.user.isGM && game.combat) {
      const dots = foundry.utils.deepClone(game.combat.getFlag(MOD, "npcAutoDots") ?? []);
      dots.push({ targetId: target.id, sourceName: item.name, formula: d.dot.formula, type: d.dot.type || "kinetic", ends: d.dot.ends || "action", rounds: d.dot.rounds ?? 1 });
      await game.combat.setFlag(MOD, "npcAutoDots", dots);
      lines.push(`${tName}: ${esc(d.dot.formula)} ${esc(d.dot.type || "")} at the start of its turn${d.dot.ends === "action" ? " (an action ends it)" : ""}`);
    }
    if (d.radiation && target) {
      try {
        const rp = Number(target.system?.radiation?.rp ?? target.system?.system?.radiation?.rp) || 0;
        await (target.isOwner ? target.update({ "system.radiation.rp": rp + Number(d.radiation) }) : game.fourththing.rolls._applyDamageToActor(target, Number(d.radiation), { op: "damage", track: "radiation", damageType: "radiation" }));
        lines.push(`${tName}: +${d.radiation} Radiation`);
      } catch (e) { console.warn("[npc-automation] radiation", e); }
    }
    if (d.noReactions && target) {
      try { if (target.isOwner) await target.update({ "system.actions.reactionUsed": true }); lines.push(`${tName}: no reactions until its next turn`); } catch (_e) {}
    }
    if (d.tempIntegrity) {
      const who = rule.on === "hit" ? actor : (target ?? actor);
      const amt = typeof d.tempIntegrity === "number" ? d.tempIntegrity : (await new Roll(String(d.tempIntegrity)).evaluate()).total;
      try { await game.fourththing.tempIntegrity.grant(who, amt, item.name, { quiet: true }); lines.push(`${esc(who.name)}: +${amt} temporary Integrity`); } catch (e) { console.warn("[npc-automation] temp", e); }
    }
    if (d.heal) {   // drain-touch revenants heal themselves on a hit; "drops to 1 instead" oaths heal on zero
      // drains heal the OWNER (on hit / on a failed save / when struck); self rules heal the owner too
      const who = ["hit", "zero", "bloodied", "selfTurnStart", "saveFail", "struck", "damaged"].includes(rule.on) ? actor : (target ?? actor);
      const amt = typeof d.heal === "number" ? d.heal : (await new Roll(String(d.heal)).evaluate()).total;
      try { await game.fourththing.rolls._applyDamageToActor(who, amt, { op: "heal", track: "integrity" }); lines.push(`${esc(who.name)}: regains ${amt} Integrity`); } catch (e) { console.warn("[npc-automation] heal", e); }
    }
    if (d.prompt) lines.push(`<i>${esc(d.prompt)}</i>`);
  }
  function toDr(dmg) {
    const m = String(dmg.formula).replace(/\s+/g, "").match(/^(\d+)(d\d+)([+-]\d+)?$/);
    return m ? { op: "damage", number: Number(m[1]), die: m[2], bonus: Number(m[3]) || 0, type: dmg.type || "kinetic", flavor: dmg.flavor || "" } : { op: "none" };
  }

  // ── PUBLIC: called from attackTest ───────────────────────────────────────────────────────────────
  const api = {
    /** reroll grants for this Strike (fed into attackTest's rerollGrants) + damage-formula transform */
    attackMods(actor, item, target) {
      const out = { rerolls: [], damage: null };
      if (!on() || !actor) return out;
      for (const { item: src, rule } of rulesOf(actor, "attack")) {
        if (!predicateOk(rule.if, { actor, target, item }) || !limitOk(src, rule)) continue;
        const r = rule.do?.reroll;
        if (r === "attack") out.rerolls.push({ sourceItemName: src.name, mode: "reroll-lowest" });
        if (r === "damage" || r === "damage-highest") out.damage = { mode: r, source: src.name };
      }
      return out;
    },
    /** "damage die rerolls the lowest/highest" → the first NdX gains a die and keeps N (best / worst) */
    transformDamage(formula, mod) {
      if (!mod?.damage || !formula) return formula;
      return String(formula).replace(/(\d*)d(\d+)/, (m0, n, x) => { const k = Number(n || 1); return `${k + 1}d${x}${mod.damage.mode === "damage" ? "kh" : "kl"}${k}`; });
    },
    async onHit(actor, item, target) {
      if (!on() || !actor || !target) return;
      const lines = [];
      for (const { item: src, rule } of rulesOf(actor, "hit")) {
        if (!predicateOk(rule.if, { actor, target, item }) || !limitOk(src, rule)) continue;
        await runDo(actor, src, rule, target, { lines });
        await limitSpend(src, rule);
        await anim(actor, src, true);
      }
      await card(actor, item, lines, "#d8a24a");
    },
    /** the DEFENDER's "attacked" rules → reroll grants against the attacker (reroll-highest = worse for them) */
    defenseMods(target, attacker, item) {
      const out = { rerolls: [] };
      if (!on() || !target) return out;
      for (const { item: src, rule } of rulesOf(target, "attacked")) {
        if (!predicateOk(rule.if, { actor: target, target: attacker, item, damageType: item?.system?.damage?.type }) || !limitOk(src, rule)) continue;
        if (rule.do?.reroll === "attack-highest") out.rerolls.push({ sourceItemName: `${target.name} · ${src.name}`, mode: "reroll-highest" });
      }
      return out;
    },
    /** stamp "this monster has attacked" (ownerNotAttacked predicate) — called from attackTest for every Strike */
    async markAttacked(actor) {
      try {
        const c = game.combat; if (!c?.started || !actor || !game.user.isGM) return;
        const f = c.getFlag(MOD, "npcAutoAttacked") ?? {}; if (f[actor.id]) return;
        await c.setFlag(MOD, "npcAutoAttacked", { ...f, [actor.id]: true });
      } catch (_e) {}
    },
    /** the DEFENDER's "struck" rules (retaliation): `do` runs against the attacker */
    async onStruck(target, attacker, item) {
      if (!on() || !target || !attacker) return;
      const lines = [];
      for (const { item: src, rule } of rulesOf(target, "struck")) {
        if (!predicateOk(rule.if, { actor: target, target: attacker, item, damageType: item?.system?.damage?.type }) || !limitOk(src, rule)) continue;
        await runDo(target, src, rule, attacker, { lines }); await limitSpend(src, rule); await anim(target, src, true);
      }
      await card(target, { name: "Retaliation" }, lines, "#c0574a");
    },
    /** the owner took damage (any source) — self effects only */
    async onDamaged(actor, { amount, damageType } = {}) {
      if (!on() || !actor || !isPrimaryGM() || !(amount > 0)) return;
      for (const { item, rule } of rulesOf(actor, "damaged")) {
        if (!predicateOk(rule.if, { actor, target: null, item: null, damageType }) || !limitOk(item, rule)) continue;
        const lines = []; await runDo(actor, item, rule, actor, { lines }); await limitSpend(item, rule); await anim(actor, item); await card(actor, item, lines, "#c0574a");
      }
    },
    /** a target failed this item's save card → secondary effects on that target */
    async onSaveFail(caster, item, target) {
      if (!on() || !caster || !target) return;
      const lines = [];
      for (const { item: src, rule } of rulesOf(caster, "saveFail")) {
        if (!predicateOk(rule.if, { actor: caster, target, item }) || !limitOk(src, rule)) continue;
        await runDo(caster, src, rule, target, { lines }); await limitSpend(src, rule);
      }
      await card(caster, item, lines, "#d8a24a");
    },
    /** ▶ Use on a feature/feat/power with "use" rules — an action against the user's targets (or the owner) */
    async onUse(actor, item) {
      const rules = rulesOf(actor, "use").filter(r => r.item.id === item?.id);
      if (!on() || !rules.length) return null;
      if (item.flags?.[MOD]?.npcAuto?.recharge && !(await api.useRecharge(actor, item))) return true;   // spent — same gate as Strikes
      const targets = Array.from(game.user?.targets ?? []).map(t => t.actor).filter(Boolean);
      const lines = []; let fired = false;
      for (const { rule } of rules) {
        if (!limitOk(item, rule)) { lines.push(`<i>${esc(item.name)} is used up for this ${esc(rule.limit?.per || "round")}.</i>`); continue; }
        const tgts = rule.who === "self" || !targets.length ? [actor] : targets;
        for (const t of tgts) { if (!predicateOk(rule.if, { actor, target: t, item })) continue; await runDo(actor, item, rule, t, { lines }); fired = true; }
        await limitSpend(item, rule);
      }
      if (fired) await anim(actor, item, true);
      await card(actor, item, lines);
      return true;
    },
    /** recharge gate for a weapon Strike; returns false (and warns) when spent */
    async useRecharge(actor, item) {
      const rc = item?.flags?.[MOD]?.npcAuto?.recharge;
      if (!on() || !rc) return true;
      if (item.flags[MOD].npcAuto.spent) { ui.notifications?.warn(`${item.name} is spent — it recharges ${rc.mode === "d6" ? `on a ${rc.min}+ at the start of ${actor.name}'s turn` : "next combat"}.`); return false; }
      if (actor.isOwner) await item.update({ [`flags.${MOD}.npcAuto.spent`]: true });
      return true;
    },
  };

  // ── turn start: auras, damage-over-time, recharge, self rules ───────────────────────────────────────
  Hooks.on("combatTurnChange", async (combat) => {
    if (!on() || !isPrimaryGM() || !combat?.started) return;
    const cur = combat.combatant?.actor; if (!cur) return;
    // damage over time on the creature whose turn it is
    const dots = combat.getFlag(MOD, "npcAutoDots") ?? [];
    const mine = dots.filter(d => d.targetId === cur.id);
    if (mine.length) {
      const lines = [];
      for (const d of mine) {
        const roll = await new Roll(d.formula).evaluate();
        const track = ["psychic", "qliphothic"].includes(d.type) ? "stress" : "integrity";
        await game.fourththing.rolls._applyDamageToActor(cur, roll.total, { op: "damage", track, damageType: d.type });
        lines.push(`${esc(cur.name)} takes ${roll.total} ${esc(d.type)} from ${esc(d.sourceName)}${d.ends === "action" ? " — spend an action to end it" : ""}`);
      }
      // "action" DoTs persist until the target spends an action (GM clears via the card prompt / next combat);
      // timed DoTs tick `rounds` times
      const keep = dots.filter(d => d.targetId !== cur.id)
        .concat(mine.filter(d => d.ends === "action"))
        .concat(mine.filter(d => d.ends === "rounds" && --d.rounds > 0));
      await combat.setFlag(MOD, "npcAutoDots", keep);
      await card(cur, { name: "Lingering harm" }, lines, "#c0574a");
    }
    // recharge rolls for the current combatant's spent weapons
    for (const it of cur.items ?? []) {
      const na = it.flags?.[MOD]?.npcAuto; if (!na?.recharge || !na.spent || na.recharge.mode !== "d6") continue;
      const r = await new Roll("1d6").evaluate();
      if (r.total >= (na.recharge.min ?? 5)) { await it.update({ [`flags.${MOD}.npcAuto.spent`]: false }); await card(cur, it, [`Recharged (rolled ${r.total})`], "#4aa3d8"); }
    }
    // the owner's own turn-start rules
    for (const { item, rule } of rulesOf(cur, "selfTurnStart")) {
      if (!limitOk(item, rule)) continue;
      const lines = []; await runDo(cur, item, rule, cur, { lines }); await limitSpend(item, rule); await anim(cur, item); await card(cur, item, lines);
    }
    // AURAS: every combatant whose aura covers the creature starting its turn
    for (const c of combat.combatants) {
      const src = c.actor; if (!src || src.id === cur.id) continue;
      if ((src.system?.derived?.integrity?.value ?? 1) <= 0) continue;
      for (const { item, rule } of rulesOf(src, "turnStart")) {
        const who = rule.who || "enemies";
        if (who === "enemies" && !hostile(src, cur)) continue;
        if (who === "allies" && hostile(src, cur)) continue;
        if (squaresBetween(src, cur) > (rule.radius ?? 2)) continue;
        if (!predicateOk(rule.if, { actor: src, target: cur, item }) || !limitOk(item, rule)) continue;
        const lines = []; await runDo(src, item, rule, cur, { lines }); await limitSpend(item, rule); await anim(src, item); await card(src, item, lines);
      }
    }
  });

  // ── bloodied (≤ half Integrity, once per combat) and zero ─────────────────────────────────────────
  Hooks.on("updateActor", async (actor, changes) => {
    if (!on() || !isPrimaryGM()) return;
    const v = foundry.utils.getProperty(changes, "system.derived.integrity.value"); if (v === undefined) return;
    const max = Number(actor.system?.derived?.integrity?.max) || 0; if (!max) return;
    const fired = actor.getFlag(MOD, "npcAutoFired") ?? {};
    const combatKey = game.combat?.id ?? "none";
    if (v <= 0 && rulesOf(actor, "zero").length && fired.zero !== combatKey) {
      for (const { item, rule } of rulesOf(actor, "zero")) { const lines = []; await runDo(actor, item, rule, actor, { lines }); await anim(actor, item); await card(actor, item, lines, "#c0574a"); }
      await actor.setFlag(MOD, "npcAutoFired", { ...fired, zero: combatKey });
    } else if (v > 0 && v <= max / 2 && rulesOf(actor, "bloodied").length && fired.bloodied !== combatKey) {
      for (const { item, rule } of rulesOf(actor, "bloodied")) {
        const lines = [];
        const m = rule.do?.morale;
        if (m) {
          // an NPC's own morale check is rolled for it (GM-side): 2d10 + faculty vs DC — the GM narrates the outcome
          const fac = Number(actor.system?.attributes?.[m.attr || "soul"]?.value) || 0;
          const r = await new Roll(`2d10 + ${fac}`).evaluate();
          const ok = r.total >= (Number(m.dc) || 12);
          lines.push(`Morale — ${esc(m.attr || "soul")} ${r.total} vs DC ${m.dc}: ${ok ? "<b>holds</b>" : `<b>breaks</b> — ${esc(m.outcome || "disengages and flees")}`}`);
          if (!ok && m.condition) await game.fourththing.applyManifestationStates(actor, actor, item, { appliedStates: { states: [m.condition], duration: "scene" } }, { castDc: 15 });
        }
        await runDo(actor, item, { ...rule, do: { ...rule.do, morale: undefined } }, actor, { lines });
        await anim(actor, item); await card(actor, item, lines, "#d8a24a");
      }
      await actor.setFlag(MOD, "npcAutoFired", { ...fired, bloodied: combatKey });
    }
  });

  // ── reactions: ward an ally about to take damage (bbttcc-core damage interceptor) ─────────────────────
  const ward = async (target, baseDmg, ctx) => {
    if (!on() || !isPrimaryGM() || ctx?.op !== "damage" || !game.combat?.started || !(baseDmg > 0)) return null;
    for (const c of game.combat.combatants) {
      const src = c.actor; if (!src || src.id === target.id || hostile(src, target)) continue;
      for (const { item, rule } of rulesOf(src, "allyDamaged")) {
        if (squaresBetween(src, target) > (rule.radius ?? 6) || !limitOk(item, rule)) continue;
        if (src.system?.actions?.reactionUsed) continue;
        const mult = Number(rule.do?.ward ?? 0.5);
        await limitSpend(item, rule);
        try { if (src.isOwner) await src.update({ "system.actions.reactionUsed": true }); } catch (_e) {}
        await anim(src, item);
        const desc = await game.fourththing.rolls._applyDamageToActor(target, baseDmg, { ...ctx, perTargetMultiplier: (ctx.perTargetMultiplier ?? 1) * mult, _skipInterceptors: true });
        await card(src, item, [`Reaction: ${esc(src.name)} wards ${esc(target.name)} — damage ×${mult}`], "#4aa3d8");
        return { handled: true, description: desc };
      }
    }
    return null;
  };
  Hooks.once("ready", () => { try { game.bbttcc?.combat?.registerDamageInterceptor?.(ward); } catch (e) { console.warn("[npc-automation] interceptor", e); } });

  game.fourththing.npcAuto = api;
  return api;
}
