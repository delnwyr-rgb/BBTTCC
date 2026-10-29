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
 *             "enemyDamaged" an enemy within `radius` squares just took damage (do.damage: the "every wound articulate" auras)
 *   if        { firstRound, targetNotActed, allyAdjacentToTarget, targetTag:[…], targetCondition:[…], weapon:"<item name>",
 *               damageType:[…], ownerNotAttacked, ownerBloodied, ownerNotBloodied, targetBloodied, ownerAirborne, targetNotAirborne,
 *               ownerMovedSquares:N (moved ≥ N squares this turn),
 *               critical:true (the hit's best base die showed a 10) | maxDie:N, chance:0.1 (a 1-in-10 roll), ownerHidden:true }
 *   do        { reroll, condition:{key, duration, save:{attr, dc}}, save:{attr, dc, onSave}, damage:{formula, type, track?},
 *               dot:{formula, type, ends:"action"|"rounds", rounds}, radiation:N, noReactions:true, tempIntegrity:N|"formula",
 *               heal:N|"formula", morale:{attr, dc, outcome, condition?}, ward:0.5, prompt:"…",
 *               bankReroll:true|{context?,skill?,attribute?,note?}, bankBonus:{bonus,context?,skill?,attribute?,note?},
 *               removeCondition:[keys], impose:true,   (2026-10-07: the last four run on ▶ Use / hit / struck / saveFail targets)
 *               ── 2026-10-26 (BS7, "make the automations real") ──
 *               push:N | pull:N            the target is shoved N squares along the line from the owner (forced-move resist honoured)
 *               shift:N | slow:N           the subject's movement budget this turn grows / shrinks by N squares
 *               teleport:true              the owner steps to a square beside the target     swap:true  owner and target trade places
 *               clarity:±N|"-1d4"          the subject's Clarity changes            noBonusAction:true  the subject's bonus action is spent
 *               immune:{rounds:1}          the owner takes no damage until its turn comes round again
 *               evasive:{rounds:1}         until the owner's next turn, Strikes against it reroll their highest die
 *               disposition:{set:-1,rounds:3}  the owner's token turns hostile for N rounds, then returns (Broken Protocol)
 *               vanish:true                the owner's token hides and leaves the combat     hide:true  the owner's token hides
 *               spawn:{name,count:1}       pack/world actor by name, placed beside the owner (bbttcc-encounters spawner)
 *               template:{shape,size}      drops a measured template at the owner (slag, walls, haze — the GM reads the area)
 *               clearBank:true             the subject loses every banked reroll / bonus       random:[{do…},…]  one entry runs
 *             }
 *   to        "self" — the rule's `do` runs on the OWNER instead of the target (self-wounds, self-heals, own buffs)
 *   who       with `radius` on hit / saveFail / struck / bloodied / zero / selfTurnStart / use: the rule runs against EVERY
 *             combatant in range ("enemies" | "allies" | "all") — a burst
 *   narrative true — the rule is the GM-fiat tier on purpose (prompt only); the lint stops counting it as automation
 *   limit     { per: "round" | "combat" | "scene", uses: 1 }
 *   recharge  (on a WEAPON's npcAuto) { mode: "d6", min: 5 } | { mode: "combat" } | { mode: "nextTurn" } (fires every other turn)
 *             — spent on use, rolled back at turn start
 *   requires  (on a WEAPON's npcAuto) { ownerBloodied: true } — the Strike is refused until the owner is at or below half (ULTIMATES)
 *   ignoreResists (on a WEAPON's npcAuto) true — its Strikes ignore the target's resistances
 *
 * Every effect goes through an existing system API (save-prompt card, applyManifestationStates, _applyDamageToActor,
 * tempIntegrity, radiation, impose) so relays, immunities and chat cards behave like everything else. Each fired rule
 * plays its item's Automated Animation (ftPlayAutoAnimation) and posts one compact chat line. Turn-start, bloodied,
 * zero and reaction rules run ONCE, on the primary GM. World setting `npcAutomation` turns the engine off.
 */

const MOD = "fourththing";
const SQ = () => Number(canvas?.scene?.grid?.distance) || 5;

export function registerNpcAutomation({ actorKind, postSavePrompt, playAnimation, ftEscapeHtml, placeAreaTemplate }) {
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
    // 2026-10-07 (regimen pass 7): airborne / above-half / moved-this-turn predicates for the attacked-by direction
    const airborne = a => !!(a?.system?.system ?? a?.system)?.conditions?.airborne;
    if (cond.ownerNotBloodied && bloodied(actor)) return false;
    if (cond.ownerAirborne && !airborne(actor)) return false;
    if (cond.targetNotAirborne && airborne(target)) return false;
    if (Number(cond.ownerMovedSquares) > 0 && (Number((actor?.system?.system ?? actor?.system)?.actions?.movementUsedFt) || 0) < Number(cond.ownerMovedSquares) * SQ()) return false;
    // 2026-10-26 (BS7): critical hits, chance rolls, hidden owners
    if (cond.critical && !((Number(extra.maxDie) || 0) >= 10)) return false;
    if (Number(cond.maxDie) > 0 && !((Number(extra.maxDie) || 0) >= Number(cond.maxDie))) return false;
    if (Number(cond.chance) > 0 && Number(cond.chance) < 1 && !(Math.random() < Number(cond.chance))) return false;
    if (cond.ownerHidden && !tokenOf(actor)?.document?.hidden) return false;
    return true;
  }
  // ── subjects (2026-10-26): `to:"self"` and bursts (`who` + `radius` on a non-aura trigger) ──────────
  function inRange(actor, who, radius) {
    const out = [];
    for (const c of game.combat?.combatants ?? []) {
      const a = c.actor; if (!a || a.id === actor.id) continue;
      if ((a.system?.derived?.integrity?.value ?? 1) <= 0) continue;
      if (who === "enemies" && !hostile(actor, a)) continue;
      if (who === "allies" && hostile(actor, a)) continue;
      if (squaresBetween(actor, a) > (radius ?? 2)) continue;
      out.push(a);
    }
    return out;
  }
  function subjectsOf(rule, actor, target) {
    if (rule.to === "self") return [actor];
    if (rule.who && ["enemies", "allies", "all"].includes(rule.who) && rule.on !== "turnStart") return inRange(actor, rule.who, rule.radius);
    return [target ?? actor];
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
    // 2026-10-07 (regimen pass 7): banked rerolls / bonuses, condition removal and Impose — through the shared system helpers
    if (d.bankReroll && target) {
      const b = typeof d.bankReroll === "object" ? d.bankReroll : {};
      try { await game.fourththing.aid.bank(target, { from: actor.name, source: item.name, context: b.context ?? null, skill: b.skill ?? null, attribute: b.attribute ?? null, note: b.note ?? null }); lines.push(`${tName}: a reroll-lowest banked${b.note ? ` (${esc(b.note)})` : ""}`); } catch (e) { console.warn("[npc-automation] bankReroll", e); }
    }
    if (d.bankBonus && target) {
      const b = d.bankBonus;
      try { await game.fourththing.aid.bank(target, { kind: "bonus", from: actor.name, source: item.name, bonus: Number(b.bonus) || 1, context: b.context ?? null, skill: b.skill ?? null, attribute: b.attribute ?? null, note: b.note ?? null }); lines.push(`${tName}: +${Number(b.bonus) || 1} banked${b.note ? ` (${esc(b.note)})` : ""}`); } catch (e) { console.warn("[npc-automation] bankBonus", e); }
    }
    if (Array.isArray(d.removeCondition) && target) {
      const sys = target.system?.system ?? target.system ?? {};
      for (const k of d.removeCondition) {
        if (!sys.conditions?.[k]) continue;
        try { if (k === "imposed") await game.fourththing.impose.clear(target, item.name); else if (target.isOwner || game.user.isGM) await game.fourththing.toggleCondition(target, k); lines.push(`${tName}: ${esc(k)} ends`); } catch (e) { console.warn("[npc-automation] removeCondition", e); }
      }
    }
    if (d.impose && target) {
      try { await game.fourththing.impose.apply(target, { source: item.name }); lines.push(`${tName}: <b>Imposed</b>`); } catch (e) { console.warn("[npc-automation] impose", e); }
    }
    // ── 2026-10-26 (BS7): the verbs the prompt-only rules were standing in for ─────────────────────
    for (const [key, mode] of [["push", "push"], ["pull", "pull"]]) if (Number(d[key]) > 0 && target && target.id !== actor.id) {
      try { const r = await game.fourththing.triggers?.displace?.(actor, target, { who: "target", squares: Number(d[key]), mode }, item.name); lines.push(r?.summary ? esc(r.summary) : `${tName}: ${mode}ed ${d[key]}`); }
      catch (e) { console.warn("[npc-automation]", key, e); }
    }
    if (Number(d.shift) > 0 || Number(d.slow) > 0) {
      const who = target ?? actor, sys = who.system?.system ?? who.system ?? {}, delta = (Number(d.shift) || 0) - (Number(d.slow) || 0);
      try {
        if (who.isOwner || game.user.isGM) await who.update({ "system.actions.movementBudgetFt": Math.max(0, (Number(sys.actions?.movementBudgetFt) || 0) + delta * SQ()) });
        lines.push(`${esc(who.name)}: ${delta > 0 ? `may move ${delta} more square${delta === 1 ? "" : "s"} this turn` : `speed −${-delta} square${delta === -1 ? "" : "s"} this turn`}`);
      } catch (e) { console.warn("[npc-automation] shift", e); }
    }
    if ((d.teleport || d.swap) && target && target.id !== actor.id) {
      const ta = tokenOf(actor), tb = tokenOf(target);
      if (ta && tb && game.user.isGM) {
        try {
          const px = canvas.grid.size;
          if (d.swap) {
            if (!(await game.fourththing.resistsForcedMove?.(target, { reason: item.name, squares: 1 }))) {
              const [ax, ay, bx, by] = [ta.document.x, ta.document.y, tb.document.x, tb.document.y];
              await ta.document.update({ x: bx, y: by }); await tb.document.update({ x: ax, y: ay }); lines.push(`${esc(actor.name)} and ${tName} trade places`);
            } else lines.push(`${tName} holds fast — no swap`);
          } else {
            const dx = Math.sign(ta.center.x - tb.center.x) || 1, dy = Math.sign(ta.center.y - tb.center.y) || 0;
            await ta.document.update({ x: tb.document.x + dx * px, y: tb.document.y + dy * px }); lines.push(`${esc(actor.name)} steps in beside ${tName}`);
          }
        } catch (e) { console.warn("[npc-automation] teleport", e); }
      }
    }
    if (d.clarity !== undefined && d.clarity !== null && target) {
      const amt = typeof d.clarity === "number" ? d.clarity : (await new Roll(String(d.clarity).replace(/^-\s*/, "")).evaluate()).total * (String(d.clarity).trim().startsWith("-") ? -1 : 1);
      const sys = target.system?.system ?? target.system ?? {}, cur = Number(sys.magic?.clarity?.value) || 0, max = Number(sys.magic?.clarity?.max) || 5;
      const nxt = Math.max(0, Math.min(max, cur + amt));
      try { if (target.isOwner || game.user.isGM) await target.update({ "system.magic.clarity.value": nxt }); lines.push(`${tName}: Clarity ${cur} → ${nxt}`); } catch (e) { console.warn("[npc-automation] clarity", e); }
    }
    if (d.noBonusAction && target) {
      try { if (target.isOwner || game.user.isGM) await target.update({ "system.actions.bonusUsed": true }); lines.push(`${tName}: no bonus action this turn`); } catch (_e) {}
    }
    if (d.immune && game.combat) {
      const rounds = Math.max(1, Number(d.immune.rounds) || 1);
      try { await actor.setFlag(MOD, "npcAutoImmune", { combat: game.combat.id, until: game.combat.round + rounds, source: item.name }); lines.push(`${esc(actor.name)}: takes no damage until its next turn`); } catch (e) { console.warn("[npc-automation] immune", e); }
    }
    if (d.evasive && game.combat) {
      const rounds = Math.max(1, Number(d.evasive.rounds) || 1);
      try { await actor.setFlag(MOD, "npcAutoEvasive", { combat: game.combat.id, until: game.combat.round + rounds, source: item.name }); lines.push(`${esc(actor.name)}: Strikes against it reroll their highest die until its next turn`); } catch (e) { console.warn("[npc-automation] evasive", e); }
    }
    if (d.disposition && game.user.isGM) {
      const tok = tokenOf(actor);
      if (tok) {
        try {
          const prior = tok.document.disposition, set = Number(d.disposition.set ?? -1), rounds = Math.max(1, Number(d.disposition.rounds) || 3);
          if (prior !== set) {
            await tok.document.update({ disposition: set });
            if (game.combat) { const q = foundry.utils.deepClone(game.combat.getFlag(MOD, "npcAutoDisposition") ?? []); q.push({ tokenId: tok.id, sceneId: tok.scene?.id, prior, until: game.combat.round + rounds }); await game.combat.setFlag(MOD, "npcAutoDisposition", q); }
            lines.push(`${esc(actor.name)}: ${set < 0 ? "turns hostile" : set > 0 ? "turns friendly" : "stands down"} for ${rounds} round${rounds === 1 ? "" : "s"}`);
          }
        } catch (e) { console.warn("[npc-automation] disposition", e); }
      }
    }
    if ((d.vanish || d.hide) && game.user.isGM) {
      const tok = tokenOf(actor);
      try {
        if (tok && !tok.document.hidden) await tok.document.update({ hidden: true });
        if (d.vanish) { const cb = game.combat?.combatants.find(c => c.actor?.id === actor.id); if (cb) await cb.delete(); }
        lines.push(`${esc(actor.name)}: ${d.vanish ? "is gone — out of the fight" : "slips out of sight"}`);
      } catch (e) { console.warn("[npc-automation] vanish", e); }
    }
    if (d.spawn?.name && game.user.isGM && canvas?.scene) {
      try {
        const sp = game.bbttcc?.api?.encounters?._spawner;
        const n = typeof d.spawn.count === "number" ? d.spawn.count : (await new Roll(String(d.spawn.count || 1)).evaluate()).total;
        const toks = await sp?.spawnByName?.(canvas.scene, d.spawn.name, { count: n, spawnedBy: `npcAuto:${item.name}` });
        const me = tokenOf(actor);
        if (me && Array.isArray(toks)) { const px = canvas.grid.size; let i = 0; for (const t of toks) { const doc = t?.document ?? t; const ang = (i++ / Math.max(1, toks.length)) * Math.PI * 2; try { await doc.update?.({ x: me.document.x + Math.round(Math.cos(ang)) * px, y: me.document.y + Math.round(Math.sin(ang)) * px }); } catch (_e) {} } }
        lines.push(`${esc(actor.name)}: ${n} × <b>${esc(d.spawn.name)}</b> ${Array.isArray(toks) && toks.length ? "step out" : "— spawner unavailable, place by hand"}`);
      } catch (e) { console.warn("[npc-automation] spawn", e); }
    }
    if (d.template?.shape && placeAreaTemplate && game.user.isGM) {
      try { await placeAreaTemplate(actor, { shape: d.template.shape, size: Number(d.template.size) || 10 }); lines.push(`${esc(actor.name)}: ${esc(d.template.shape)} ${Math.round((Number(d.template.size) || 10) / SQ())} sq placed — the GM reads the area`); }
      catch (e) { console.warn("[npc-automation] template", e); }
    }
    if (d.clearBank && target) {
      try { await target.setFlag(MOD, "aidBanked", []); lines.push(`${tName}: every banked reroll and bonus is gone`); } catch (e) { console.warn("[npc-automation] clearBank", e); }
    }
    if (Array.isArray(d.random) && d.random.length) {
      const pick = d.random[Math.floor(Math.random() * d.random.length)];
      lines.push(`<b>${esc(item.name)}</b> rolls ${d.random.indexOf(pick) + 1} of ${d.random.length}${pick.label ? `: ${esc(pick.label)}` : ""}`);
      const sub = { ...rule, do: pick.do ?? pick, who: pick.who ?? rule.who, radius: pick.radius ?? rule.radius, to: pick.to ?? rule.to };
      for (const t of subjectsOf(sub, actor, target)) await runDo(actor, item, sub, t, { lines });
    }
    if (d.prompt) lines.push(`<i>${esc(d.prompt)}</i>`);
  }
  function toDr(dmg) {
    const m = String(dmg.formula).replace(/\s+/g, "").match(/^(\d+)(d\d+)([+-]\d+)?$/);
    return m ? { op: "damage", number: Number(m[1]), die: m[2], bonus: Number(m[3]) || 0, type: dmg.type || "kinetic", flavor: dmg.flavor || "" } : { op: "none" };
  }

  // ── 10-29: struck / saveFail fire on a PLAYER seat (attacker / save roller) — limits, DoTs, dispositions and NPC
  //    flags need the GM, so a player seat hands them to the active GM over the system socket (no GM online → run here)
  const NPC_RELAY = "ft-npcAuto";
  function relayToGM(kind, uuids) {
    if (game.user?.isGM || !game.users?.activeGM || !game.socket) return false;
    try { game.socket.emit("system.fourththing", { t: NPC_RELAY, kind, ...uuids, nonce: foundry.utils.randomID() }); return true; }
    catch (e) { console.warn("[npc-automation] relay emit failed", e); return false; }
  }
  const _relaySeen = new Set();
  async function onRelay(msg) {
    if (msg?.t !== NPC_RELAY || !isPrimaryGM()) return;
    if (msg.nonce) { if (_relaySeen.has(msg.nonce)) return; _relaySeen.add(msg.nonce); if (_relaySeen.size > 200) _relaySeen.clear(); }
    const get = async (u) => (typeof u === "string" && u) ? await fromUuid(u).catch(() => null) : null;
    try {
      if (msg.kind === "struck") {
        const target = await get(msg.targetUuid), attacker = await get(msg.attackerUuid);
        if (target && attacker) await api.onStruck(target, attacker, await get(msg.itemUuid));
      } else if (msg.kind === "saveFail") {
        const caster = await get(msg.casterUuid), target = await get(msg.targetUuid);
        if (caster && target) await api.onSaveFail(caster, await get(msg.itemUuid), target);
      }
    } catch (e) { console.warn("[npc-automation] relay", msg.kind, e); }
  }
  Hooks.once("ready", () => { try { game.socket?.on?.("system.fourththing", onRelay); } catch (e) { console.warn("[npc-automation] socket", e); } });

  // ── PUBLIC: called from attackTest ───────────────────────────────────────────────────────────────
  const api = {
    /** reroll grants for this Strike (fed into attackTest's rerollGrants) + damage-formula transform */
    attackMods(actor, item, target) {
      const out = { rerolls: [], damage: null, ignoreResists: !!item?.flags?.[MOD]?.npcAuto?.ignoreResists };
      if (!on() || !actor) return out;
      for (const { item: src, rule } of rulesOf(actor, "attack")) {
        if (!predicateOk(rule.if, { actor, target, item }) || !limitOk(src, rule)) continue;
        const r = rule.do?.reroll;
        if (r === "attack") out.rerolls.push({ sourceItemName: src.name, mode: "reroll-lowest" });
        if (r === "damage" || r === "damage-highest") out.damage = { mode: r, source: src.name };
        // 10-29: a limited attack rule is used up once it grants (same fire-and-forget as defenseMods)
        if ((r === "attack" || r === "damage" || r === "damage-highest") && rule.limit) limitSpend(src, rule).catch(() => {});
      }
      return out;
    },
    /** "damage die rerolls the lowest/highest" → the first NdX gains a die and keeps N (best / worst) */
    transformDamage(formula, mod) {
      if (!mod?.damage || !formula) return formula;
      return String(formula).replace(/(\d*)d(\d+)/, (m0, n, x) => { const k = Number(n || 1); return `${k + 1}d${x}${mod.damage.mode === "damage" ? "kh" : "kl"}${k}`; });
    },
    async onHit(actor, item, target, { maxDie = 0 } = {}) {
      if (!on() || !actor || !target) return;
      const lines = [];
      for (const { item: src, rule } of rulesOf(actor, "hit")) {
        if (!predicateOk(rule.if, { actor, target, item, maxDie }) || !limitOk(src, rule)) continue;
        for (const t of subjectsOf(rule, actor, target)) await runDo(actor, src, rule, t, { lines });
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
        if (rule.do?.reroll === "attack-highest") { out.rerolls.push({ sourceItemName: `${target.name} · ${src.name}`, mode: "reroll-highest" }); if (rule.limit) limitSpend(src, rule).catch(() => {}); }
      }
      // 2026-10-26: an `evasive` window (Frame Drift and kin) — attacks against the owner reroll their highest until its turn
      const ev = target.getFlag?.(MOD, "npcAutoEvasive");
      if (ev && ev.combat === game.combat?.id && (game.combat?.round ?? 0) <= ev.until) out.rerolls.push({ sourceItemName: `${target.name} · ${ev.source || "Evasive"}`, mode: "reroll-highest" });
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
      if (relayToGM("struck", { targetUuid: target.uuid, attackerUuid: attacker.uuid, itemUuid: item?.uuid ?? null })) return;
      const lines = [];
      for (const { item: src, rule } of rulesOf(target, "struck")) {
        if (!predicateOk(rule.if, { actor: target, target: attacker, item, damageType: item?.system?.damage?.type }) || !limitOk(src, rule)) continue;
        for (const t of subjectsOf(rule, target, attacker)) await runDo(target, src, rule, t, { lines }); await limitSpend(src, rule); await anim(target, src, true);
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
      if (relayToGM("saveFail", { casterUuid: caster.uuid, targetUuid: target.uuid, itemUuid: item?.uuid ?? null })) return;
      const lines = [];
      for (const { item: src, rule } of rulesOf(caster, "saveFail")) {
        if (!predicateOk(rule.if, { actor: caster, target, item }) || !limitOk(src, rule)) continue;
        for (const t of subjectsOf(rule, caster, target)) await runDo(caster, src, rule, t, { lines }); await limitSpend(src, rule);
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
        const tgts = rule.who === "self" || rule.to === "self" ? [actor] : ["enemies", "allies", "all"].includes(rule.who) ? inRange(actor, rule.who, rule.radius ?? 6) : (!targets.length ? [actor] : targets);
        for (const t of tgts) { if (!predicateOk(rule.if, { actor, target: t, item })) continue; await runDo(actor, item, rule, t, { lines }); fired = true; }
        await limitSpend(item, rule);
      }
      if (fired) await anim(actor, item, true);
      await card(actor, item, lines);
      return true;
    },
    /** recharge gate for a weapon Strike; returns false (and warns) when spent */
    async useRecharge(actor, item) {
      const na = item?.flags?.[MOD]?.npcAuto, rc = na?.recharge;
      if (!on() || !na) return true;
      // 2026-10-26: ULTIMATE gate — "usable only at or below half Integrity" is a refusal, not a reminder
      if (na.requires?.ownerBloodied) {
        const d = actor?.system?.derived?.integrity; if (!(d?.max > 0 && d.value <= d.max / 2)) { ui.notifications?.warn(`${item.name} is locked until ${actor.name} is at or below half Integrity.`); return false; }
      }
      if (!rc) return true;
      if (na.spent) { ui.notifications?.warn(`${item.name} is spent — it recharges ${rc.mode === "d6" ? `on a ${rc.min}+ at the start of ${actor.name}'s turn` : rc.mode === "nextTurn" ? "the turn after next" : "next combat"}.`); return false; }
      if (actor.isOwner) await item.update({ [`flags.${MOD}.npcAuto.spent`]: true, ...(rc.mode === "nextTurn" ? { [`flags.${MOD}.npcAuto.spentRound`]: game.combat?.round ?? 0 } : {}) });
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
      const na = it.flags?.[MOD]?.npcAuto; if (!na?.recharge || !na.spent) continue;
      if (na.recharge.mode === "nextTurn") {   // 2026-10-26: "vents heat" — skips exactly one of the owner's turns
        if (combat.round > (Number(na.spentRound) || 0) + 1) { await it.update({ [`flags.${MOD}.npcAuto.spent`]: false }); await card(cur, it, ["Ready again"], "#4aa3d8"); }
        continue;
      }
      if (na.recharge.mode !== "d6") continue;
      const r = await new Roll("1d6").evaluate();
      if (r.total >= (na.recharge.min ?? 5)) { await it.update({ [`flags.${MOD}.npcAuto.spent`]: false }); await card(cur, it, [`Recharged (rolled ${r.total})`], "#4aa3d8"); }
    }
    // 2026-10-26: Broken Protocol and kin — token dispositions flipped for N rounds return when their round is up
    const dq = combat.getFlag(MOD, "npcAutoDisposition") ?? [];
    if (dq.length) {
      const keep = [];
      for (const e of dq) {
        if (combat.round < e.until) { keep.push(e); continue; }
        try { const td = game.scenes.get(e.sceneId)?.tokens.get(e.tokenId); if (td) { await td.update({ disposition: e.prior }); await card(td.actor ?? cur, { name: "Protocol" }, [`${esc(td.name)} stands down — back to the directive`], "#4aa3d8"); } } catch (_e) {}
      }
      if (keep.length !== dq.length) await combat.setFlag(MOD, "npcAutoDisposition", keep);
    }
    // the owner's own turn-start rules (predicates such as allyAdjacentToTarget / chance read the owner as its own target)
    for (const { item, rule } of rulesOf(cur, "selfTurnStart")) {
      if (!limitOk(item, rule) || !predicateOk(rule.if, { actor: cur, target: cur, item })) continue;
      const lines = []; for (const t of subjectsOf(rule, cur, cur)) await runDo(cur, item, rule, t, { lines }); await limitSpend(item, rule); await anim(cur, item); await card(cur, item, lines);
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
      for (const { item, rule } of rulesOf(actor, "zero")) { if (!predicateOk(rule.if, { actor, target: actor, item }) || !limitOk(item, rule)) continue; const lines = []; for (const t of subjectsOf(rule, actor, actor)) await runDo(actor, item, rule, t, { lines }); await limitSpend(item, rule); await anim(actor, item); await card(actor, item, lines, "#c0574a"); }
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
        if (!predicateOk(rule.if, { actor, target: actor, item })) continue;
        const r2 = { ...rule, do: { ...rule.do, morale: undefined } };
        for (const t of subjectsOf(r2, actor, actor)) await runDo(actor, item, r2, t, { lines });
        await limitSpend(item, rule);
        await anim(actor, item); await card(actor, item, lines, "#d8a24a");
      }
      await actor.setFlag(MOD, "npcAutoFired", { ...fired, bloodied: combatKey });
    }
  });

  // ── reactions: ward an ally about to take damage (bbttcc-core damage interceptor) ─────────────────────
  let _inInterceptor = false;
  const ward = async (target, baseDmg, ctx) => {
    if (!on() || !isPrimaryGM() || ctx?.op !== "damage" || !game.combat?.started || !(baseDmg > 0) || _inInterceptor) return null;
    // 2026-10-26: an `immune` window (Disperse and Reform) — the owner takes nothing until its turn comes round
    const im = target.getFlag?.(MOD, "npcAutoImmune");
    if (im && im.combat === game.combat.id && game.combat.round <= im.until) {
      await card(target, { name: im.source || "Immune" }, [`${esc(target.name)} is beyond harm this round — ${baseDmg} ignored`], "#4aa3d8");
      return { handled: true, description: `${target.name} takes no damage (${im.source || "immune"})` };
    }
    // 2026-10-26: `enemyDamaged` auras (Aura of Pain / Cruelty) — the wound articulates, then the base damage proceeds
    for (const c of game.combat.combatants) {
      const src = c.actor; if (!src || src.id === target.id || !hostile(src, target)) continue;
      if ((src.system?.derived?.integrity?.value ?? 1) <= 0) continue;
      for (const { item, rule } of rulesOf(src, "enemyDamaged")) {
        if (squaresBetween(src, target) > (rule.radius ?? 4) || !limitOk(item, rule)) continue;
        if (!predicateOk(rule.if, { actor: src, target, item, damageType: ctx?.damageType })) continue;
        _inInterceptor = true;
        try { const lines = []; await runDo(src, item, rule, target, { lines }); await limitSpend(item, rule); await card(src, item, lines, "#c0574a"); }
        catch (e) { console.warn("[npc-automation] enemyDamaged", e); }
        finally { _inInterceptor = false; }
      }
    }
    for (const c of game.combat.combatants) {
      const src = c.actor; if (!src || hostile(src, target)) continue;
      for (const { item, rule } of rulesOf(src, "allyDamaged")) {
        // CO18 (2026-10-26): who:"self" = a self-ward (Stalwart Endure) — the owner IS the target; every other ward is for someone else
        if ((rule.who === "self") !== (src.id === target.id)) continue;
        if (squaresBetween(src, target) > (rule.radius ?? 6) || !limitOk(item, rule)) continue;
        if (rule.if && !predicateOk(rule.if, { actor: src, target, item, damageType: ctx?.damageType })) continue;   // if.damageType:["kinetic"] …
        if (rule.who !== "self" && src.system?.actions?.reactionUsed) continue;
        const mult = Number(rule.do?.ward ?? 0.5);
        await limitSpend(item, rule);
        try { if (rule.who !== "self" && src.isOwner) await src.update({ "system.actions.reactionUsed": true }); } catch (_e) {}
        await anim(src, item);
        const desc = await game.fourththing.rolls._applyDamageToActor(target, baseDmg, { ...ctx, perTargetMultiplier: (ctx.perTargetMultiplier ?? 1) * mult, _skipInterceptors: true });
        const lines = [rule.who === "self" ? `${esc(src.name)} endures — damage ×${mult}` : `Reaction: ${esc(src.name)} wards ${esc(target.name)} — damage ×${mult}`];
        // do.redirect: the warder takes what the ally was spared (Bravo Hold the Line / Last Stand)
        if (rule.do?.redirect && src.id !== target.id) {
          const taken = Math.max(0, Math.round(baseDmg * (ctx.perTargetMultiplier ?? 1) * (1 - mult)));
          if (taken > 0) { await game.fourththing.rolls._applyDamageToActor(src, taken, { ...ctx, perTargetMultiplier: 1, _skipInterceptors: true }); lines.push(`${esc(src.name)} takes the hit instead: ${taken}`); }
        }
        if (rule.do?.prompt) lines.push(esc(String(rule.do.prompt)));
        await card(src, item, lines, "#4aa3d8");
        return { handled: true, description: desc };
      }
    }
    return null;
  };
  Hooks.once("ready", () => { try { game.bbttcc?.combat?.registerDamageInterceptor?.(ward); } catch (e) { console.warn("[npc-automation] interceptor", e); } });

  game.fourththing.npcAuto = api;
  return api;
}
