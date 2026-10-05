/* ─────────────────────────────────────────────────────────────────────────────
 * Surge Powers · surge-powers.js — the universal Surge spend menu
 * ─────────────────────────────────────────────────────────────────────────────
 * The shared table of Surge spends available to every character — the
 * standalone cut of Bad Eden's Surge Unification menu (class/doctrine kits
 * removed).
 *
 *  SPEND   hard-gated: an entry you can't afford (or aren't proficient enough
 *          for) renders disabled with the reason. Spending decrements the pool
 *          via game.surgePowers.spend.
 *  EFFECTS each entry carries a compact `fx` descriptor; one applier
 *          interprets it. Wired where dnd5e natively supports it (heals,
 *          temp HP, Active Effects, initiative); the rest arm a ONE-SHOT flag
 *          (flags.surge-powers.oneShot.<key>) + post a chat card the GM
 *          applies — flag-and-narrate.
 *  PROF    scaling effects use the character's Proficiency Bonus (+2…+6):
 *          heals add Prof, DR equals Prof, auras reach Prof×5 ft, damage
 *          riders add Prof d6. High entries gate on a minimum Prof.
 *
 *  RIDERS  one-shot "next roll" riders (advantage, extra dice, maximise,
 *          auto-save, reaction miss, ignore resistance) are consumed by the
 *          D&D 5e Table Kit module inside dnd5e's own roll hooks — no midi-qol.
 *          Without the kit they stay flag-and-narrate.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(() => {
  const MOD = "surge-powers";
  const TAG = "[surge-powers/menu]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;

  const get = (o, p, d) => { try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; } };

  function profOf(actor) {
    return Number(get(actor, "system.attributes.prof", 2)) || 2;
  }

  // ── GM relay for other-actor writes ───────────────────────────────────────
  // A player can't update an actor they don't own (Field Patch / Aegis /
  // Rallying Cry / Phoenix on someone else). Owned → write directly; otherwise
  // emit on module.surge-powers and the active GM applies it (validated there).
  const SOCKET = `module.${MOD}`;
  const RELAY_OPS = new Set(["heal", "phoenix", "tempHP", "addAE"]);
  async function applyOp(targetActor, op, args = {}) {
    if (op === "heal") {
      const amount = Math.max(0, Math.min(999, Math.round(Number(args.amount) || 0)));
      const hp = Number(get(targetActor, "system.attributes.hp.value", 0)) || 0;
      const max = Number(get(targetActor, "system.attributes.hp.max", 0)) || 0;
      return targetActor.update({ "system.attributes.hp.value": Math.min(max, hp + amount) });
    }
    if (op === "phoenix") {
      const max = Number(get(targetActor, "system.attributes.hp.max", 0)) || 0;
      const hp = Number(get(targetActor, "system.attributes.hp.value", 0)) || 0;
      const half = Math.floor(max / 2);
      if (hp < half) return targetActor.update({ "system.attributes.hp.value": half, "system.attributes.death.failure": 0, "system.attributes.death.success": 0 });
      return null;
    }
    if (op === "tempHP") {
      const n = Math.max(0, Math.min(99, Math.round(Number(args.n) || 0)));
      const cur = Number(get(targetActor, "system.attributes.hp.temp", 0)) || 0;
      if (n > cur) return targetActor.update({ "system.attributes.hp.temp": n });
      return null;
    }
    if (op === "addAE") {
      const ae = args.ae;
      // Only Surge-made effects cross the relay.
      if (!ae || typeof ae !== "object" || !ae.flags?.[MOD]) throw new Error("not a Surge effect");
      return targetActor.createEmbeddedDocuments("ActiveEffect", [ae]);
    }
    throw new Error(`unknown op ${op}`);
  }
  async function writeActor(targetActor, op, args = {}) {
    if (!targetActor) return false;
    if (targetActor.isOwner) { await applyOp(targetActor, op, args); return true; }
    if (!game.users?.activeGM) {
      ui.notifications?.warn?.(`${targetActor.name}: no GM online to apply that — nothing changed.`);
      return false;
    }
    game.socket.emit(SOCKET, { type: "apply", actorUuid: targetActor.uuid, op, args, userId: game.user.id });
    return true;
  }
  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    game.socket.on(SOCKET, async (msg) => {
      try {
        if (msg?.type !== "apply" || !game.users.activeGM?.isSelf) return;
        if (!RELAY_OPS.has(msg.op) || !game.users.get(msg.userId)) return;
        const t = await fromUuid(String(msg.actorUuid || ""));
        const actor = t instanceof Actor ? t : t?.actor;
        if (!actor) return;
        await applyOp(actor, msg.op, msg.args || {});
      } catch (e) { console.warn(TAG, "GM relay apply failed", msg?.op, e); }
    });
  });

  // ── Shared appliers ────────────────────────────────────────────────────────
  async function cue(actor, title, lines) {
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="surge-powers-cue" style="border:1px solid #b9882e;border-radius:6px;padding:.4rem .6rem">
          <p style="margin:.1rem 0;font-weight:700">⚡ ${title}</p>
          ${(lines || []).map(l => `<p style="margin:.1rem 0;font-size:.82rem">${l}</p>`).join("")}
        </div>`
      });
    } catch (e) { /* best-effort */ }
  }
  async function pickDamageType(title) {
    const options = Object.entries(CONFIG.DND5E.damageTypes ?? {})
      .map(([k, v]) => `<option value="${k}">${v.label ?? k}</option>`).join("");
    return foundry.applications.api.DialogV2.prompt({
      window: { title: `${title}: choose a damage type` },
      content: `<select name="type" style="width:100%">${options}</select>`,
      ok: { label: "Resist", callback: (_ev, b) => b.form.elements.type?.value },
      rejectClose: false,
    }).catch(() => null);
  }
  function firstTarget() { return [...(game.user?.targets ?? [])][0]?.actor ?? null; }
  function casterToken(actor) {
    return actor.getActiveTokens?.(true)?.[0]?.object ?? actor.getActiveTokens?.()?.[0] ?? canvas?.tokens?.controlled?.[0] ?? null;
  }
  function alliesInRange(token, radiusFt) {
    const out = [];
    const grid = (token?.scene ?? canvas?.scene)?.grid;
    if (!token || !grid?.size || !grid?.distance) return out;
    const pxPerFt = grid.size / grid.distance;
    const cx = token.center?.x ?? token.x, cy = token.center?.y ?? token.y;
    for (const t of (canvas?.tokens?.placeables ?? [])) {
      if (!t?.actor || t === token) continue;
      if (Math.hypot(t.center.x - cx, t.center.y - cy) / pxPerFt > radiusFt) continue;
      if ((t.document?.disposition ?? 0) >= 0) out.push(t);
    }
    return out;
  }
  async function addAE(targetActor, ae) {
    try { return await writeActor(targetActor, "addAE", { ae }); }
    catch (e) { console.warn(TAG, "AE apply failed", targetActor?.name, e); return false; }
  }
  // Native dnd5e damage reduction: every damage type's amount is lowered by n per hit.
  const drAE = (n, origin) => ({
    name: `DR ${n} (Surge)`, img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", origin,
    duration: { rounds: 1, seconds: 6 },
    changes: Object.keys(CONFIG.DND5E.damageTypes ?? {}).map(type => ({
      key: `system.traits.dm.amount.${type}`, mode: 2, value: `-${n}`, priority: 20
    })),
    flags: { [MOD]: { surgeDR: n } }
  });
  async function healActor(targetActor, formula, flavor) {
    try {
      const r = await new Roll(String(formula)).evaluate();
      const amount = Math.max(1, Math.round(r.total));
      await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: targetActor }), flavor });
      if (!(await writeActor(targetActor, "heal", { amount }))) return 0;
      return amount;
    } catch (e) { console.warn(TAG, "heal failed", e); return 0; }
  }
  async function oneShot(actor, key) {
    try { await actor.update({ [`flags.${MOD}.oneShot.${key}`]: true }); } catch (e) { /* best-effort */ }
  }

  // ── The table ──────────────────────────────────────────────────────────────
  // fx fields: tgt self|ally|allyOrSelf|alliesProfSq · heal · dr ("prof"
  //   scales) · acBonus · resistChoice · oneShot(key) · auto (kit line) · note (GM line) · init
  //   (reposition) · phoenix. Gate: minProf (minimum Proficiency Bonus).
  const MENU = [
    // ── cost 1 ──
    { cost: 1, key: "bonus-die", bucket: "narr", label: "Bonus Die — your next roll rolls one extra die (keep best)",
      fiction: "Press the moment. The dice remember what they were doing.", fx: { tgt: "self", oneShot: "bonusDie", auto: "Your next d20 roll gets an extra die (keep the best).", note: "Next d20 roll: roll one extra d20 and keep the best (GM applies)." } },
    { cost: 1, key: "snap-strike", bucket: "off", label: "Snap Strike — advantage on your next attack",
      fiction: "An opening narrows. You take it.", fx: { tgt: "self", oneShot: "advAttack", auto: "Your next attack roll has advantage." } },
    { cost: 1, key: "brace", bucket: "def", label: "Brace — +1 AC till your next turn",
      fiction: "Weight settles. Stance hardens.", fx: { tgt: "self", acBonus: 1 } },
    // ── cost 2 ──
    { cost: 2, key: "reaction-miss", bucket: "def", label: "Reaction Miss — turn one incoming attack into a miss",
      fiction: "You slide sideways through the moment.", fx: { tgt: "self", oneShot: "reactionMiss", auto: "The next attack that hits you this round misses instead.", note: "One incoming attack this round becomes a miss (declare before damage; GM applies)." } },
    { cost: 2, key: "sundering-blow", bucket: "off", label: "Sundering Blow — next attack ignores resistances",
      fiction: "Whatever they call armor, it stops mattering for one breath.", fx: { tgt: "self", oneShot: "ignoreResists", auto: "Your next damage roll ignores the target's resistances.", note: "Next hit ignores damage resistances (GM applies)." } },
    { cost: 2, key: "stitch", bucket: "heal", label: "Stitch — heal self 2d6 + Prof",
      fiction: "Flesh re-knits along the seams you remember.", fx: { tgt: "self", heal: "2d6+@prof" } },
    // ── cost 3 ──
    { cost: 3, key: "reposition-init", bucket: "narr", label: "Reposition — new spot in initiative",
      fiction: "Step out of the moment. Re-enter where you choose.", fx: { tgt: "self", init: true } },
    { cost: 3, key: "refund", bucket: "narr", label: "Refund — one expended feature use",
      fiction: "The effort didn't cost you. Something else paid.", fx: { tgt: "self", note: "Refund one expended class-feature use (GM restores the use)." } },
    { cost: 3, key: "echo-strike", bucket: "off", label: "Echo Strike — extra attack at −2",
      fiction: "A second blow that was already there.", fx: { tgt: "self", oneShot: "echoStrike", note: "Make one extra attack this turn at −2 (GM adjudicates)." } },
    { cost: 3, key: "aegis", bucket: "def", label: "Aegis — ally gains DR equal to Prof this round",
      fiction: "Your stance covers theirs.", fx: { tgt: "ally", dr: "prof" } },
    // ── cost 4 ──
    { cost: 4, key: "surging-cast", bucket: "off", label: "Surging Cast — maximize one damage die of your next spell/feature",
      fiction: "The current runs hotter. Anything could come through.", fx: { tgt: "self", oneShot: "surgingCast", auto: "Your next spell/feature damage roll maximises one die.", note: "Next spell/feature damage: maximize one die (GM applies)." } },
    { cost: 4, key: "iron-word", bucket: "def", label: "Iron Word — auto-succeed one save",
      fiction: "You name what is happening. It listens.", fx: { tgt: "self", oneShot: "autoSaveOnce", auto: "Your next saving throw succeeds automatically.", note: "Automatically succeed one saving throw this round (declare before rolling)." } },
    { cost: 4, key: "field-patch", bucket: "heal", label: "Field Patch — heal ally 2d6 + Prof (in reach)",
      fiction: "Hands move faster than the wound can close.", fx: { tgt: "ally", heal: "2d6+@prof" } },
    // ── cost 5+ ──
    { cost: 5, key: "reshape-fiction", bucket: "narr", label: "Reshape Fiction — one beat (GM-gated, 1/scene)",
      fiction: "A small miracle. A door that wasn't there. A body that didn't quite fall.", fx: { tgt: "self", note: "One narrative beat reshaped (GM-gated, once per scene)." } },
    { cost: 5, key: "doomstrike", bucket: "off", label: "Doomstrike — next attack +Prof d6 damage",
      fiction: "You bring more than you swung.", fx: { tgt: "self", oneShot: "doomstrike", auto: "Your next damage roll adds Prof d6.", note: "Next hit deals +Prof d6 extra damage (GM applies)." } },
    { cost: 5, key: "steel-veil", minProf: 3, bucket: "def", label: "Steel Veil — resistance to one damage type this round",
      fiction: "Something between you and the world refuses the harm.", fx: { tgt: "self", resistChoice: true } },
    { cost: 6, key: "wrath-cascade", minProf: 3, bucket: "off", label: "Wrath Cascade — reroll all 1s and 2s on your next damage roll",
      fiction: "The dice all remember at once.", fx: { tgt: "self", oneShot: "wrathCascade", auto: "Your next damage roll rerolls 1s and 2s.", note: "Next damage roll: reroll all 1s and 2s, keep the new results (GM applies)." } },
    { cost: 7, key: "crowning-blow", minProf: 4, bucket: "off", label: "Crowning Blow — next hit is a max-die critical",
      fiction: "Inevitable. The kind of strike fables remember.", fx: { tgt: "self", oneShot: "crowningBlow", auto: "Your next damage roll is a critical with maximised dice.", note: "Next hit is a critical with maximized dice (GM applies)." } },
    { cost: 7, key: "rallying-cry", bucket: "heal", label: "Rallying Cry — heal allies within Prof×5 ft for 1d6 + Prof",
      fiction: "Your voice carries the life back into them.", fx: { tgt: "alliesProfSq", heal: "1d6+@prof" } },
    { cost: 8, key: "power-surge", minProf: 4, bucket: "off", label: "Power Surge — next attack or feature adds your Prof again",
      fiction: "You reach above your weight class for one moment.", fx: { tgt: "self", oneShot: "powerSurge", auto: "Your next attack roll adds your Proficiency Bonus again.", note: "Next attack/feature: add your Proficiency Bonus to the roll a second time (GM applies)." } },
    { cost: 9, key: "cinderwake", minProf: 6, bucket: "off", label: "Cinderwake — next damage roll: maximize all dice",
      fiction: "The dice run hot enough to leave scars.", fx: { tgt: "self", oneShot: "cinderwake", auto: "Your next damage roll is maximised.", note: "Next damage roll is maximized (GM applies)." } },
    { cost: 10, key: "final-argument", minProf: 6, bucket: "off", label: "Final Argument — next attack auto-hits, max damage, +Prof to damage",
      fiction: "There will be no negotiation.", fx: { tgt: "self", oneShot: "finalArgument", auto: "Your next attack auto-hits; its damage is maximised + Prof.", note: "Next attack auto-hits with maximized damage, plus your Proficiency Bonus (GM applies)." } },
    { cost: 10, key: "phoenix", bucket: "heal", label: "Phoenix — restore self/ally from 0 HP to half (1/encounter)",
      fiction: "Remember what you were before the wound. Be that now.", fx: { tgt: "allyOrSelf", phoenix: true } },
  ];

  // ── Paths (Bad Eden) ───────────────────────────────────────────────────────
  // A Path is an item on the character (flags.surge-powers.path = {key, doctrine})
  // that adds its own column of entries to this menu. Path content lives in
  // data/paths.json; entries share MENU's shape. Rules: chosen at 1st level, a
  // second Path opens at 17th, never the same Path twice, players can't remove one.
  let PATHS = {};
  async function loadPaths() {
    try {
      const res = await fetch(`modules/${MOD}/data/paths.json`, { cache: "no-store" });
      PATHS = (await res.json()).paths ?? {};
    } catch (e) { console.warn(TAG, "could not load Path data", e); PATHS = {}; }
    return PATHS;
  }
  function pathsOf(actor) {
    return (actor?.items ?? []).filter(i => i.flags?.[MOD]?.path?.key)
      .map(i => ({ item: i, key: i.flags[MOD].path.key, doctrine: i.flags[MOD].path.doctrine ?? null }));
  }
  function pathEntries(actor) {
    const out = [];
    for (const { key, doctrine } of pathsOf(actor)) {
      const def = PATHS[key];
      if (!def) continue;
      for (const a of def.abilities ?? []) {
        if (a.doctrine && a.doctrine !== doctrine) continue;
        out.push({ ...a, key: `path:${key}:${a.key}`, bucket: `path:${key}`, minProf: a.minProf ?? 0 });
      }
    }
    return out;
  }
  const usedKey = (entry) => entry.key.replace(/[^a-z0-9]+/gi, "_");
  function usedUp(actor, entry) {
    return !!entry.oncePer && !!actor?.flags?.[MOD]?.used?.[usedKey(entry)];
  }
  const evalAmount = (actor, f) => {
    const prof = profOf(actor), level = Number(get(actor, "system.details.level", 0)) || 0;
    try { return Math.max(0, Math.round(Roll.safeEval(String(f).replaceAll("@prof", prof).replaceAll("@level", level)))); }
    catch { return 0; }
  };
  const aeChanges = (changes) => (changes ?? []).flatMap(([key, type, value]) => {
    const vals = value === "__all__" ? Object.keys(CONFIG.DND5E.damageTypes ?? {}) : [value];
    const mode = { add: 2, override: 5, multiply: 1, upgrade: 4, downgrade: 3 }[type] ?? 2;
    return vals.map(v => ({ key, type, mode, value: String(v), priority: 20 }));
  });

  // ── Effect application ─────────────────────────────────────────────────────
  async function applyEntry(actor, entry) {
    const prof = profOf(actor);
    const fx = entry.fx ?? {};
    const lines = [];
    const origin = actor.uuid;
    const resolveN = (v) => v === "prof" ? prof : Number(v) || 0;
    const formula = (f) => String(f).replace("@prof", String(prof));

    // Resolve targets.
    let targets = [];
    const token = casterToken(actor);
    const tgt = fx.tgt ?? "self";
    let picked = ["ally", "allyOrSelf"].includes(tgt) ? firstTarget() : null;
    if (tgt === "ally" && !picked) {
      ui.notifications?.warn?.(`${entry.label}: target a token first.`);
      return false;
    }
    if (tgt === "self") targets = [actor];
    else if (tgt === "ally") targets = [picked];
    else if (tgt === "allyOrSelf") targets = [picked ?? actor];
    else if (tgt === "alliesProfSq") {
      targets = (token ? alliesInRange(token, prof * 5) : []).map(t => t.actor);
      if (!targets.length) targets = [actor];
    }
    else if (tgt === "allies10") {
      targets = [actor, ...(token ? alliesInRange(token, 10) : []).map(t => t.actor)];
    }
    else if (tgt === "target") {
      const foe = firstTarget();
      if (!foe) { ui.notifications?.warn?.(`${entry.label}: target a token first.`); return false; }
      targets = [foe];
    }
    if (usedUp(actor, entry)) {
      ui.notifications?.warn?.(`${entry.label.split("—")[0].trim()}: already used until your next long rest.`);
      return false;
    }

    // Someone else's character needs the GM relay — bail (and refund) up front if no GM is online.
    const writes = fx.heal || fx.phoenix || fx.dr || fx.acBonus || fx.resistChoice || fx.ae || fx.tempHP;
    if (writes && !game.users?.activeGM && targets.some(t => t && !t.isOwner)) {
      ui.notifications?.warn?.(`${entry.label}: no GM online to apply it to another character.`);
      return false;
    }

    const shortName = entry.label.split("—")[0].trim();
    let chosenType = null;
    for (const t of targets) {
      if (!t) continue;
      if (fx.unbroken && Number(get(t, "system.attributes.hp.value", 1)) <= 0) {
        await writeActor(t, "heal", { amount: 1 });
        lines.push(`${t.name} rises to 1 HP.`);
      }
      if (fx.tempHP) {
        const n = evalAmount(actor, fx.tempHP);   // scales with the user's Prof / level
        if (n > 0) { await writeActor(t, "tempHP", { n }); lines.push(`${t.name}: ${n} temporary HP.`); }
      }
      if (fx.ae) {
        await addAE(t, { name: fx.ae.name ?? shortName, img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", origin,
          duration: { rounds: fx.ae.rounds ?? 1, seconds: 6 * (fx.ae.rounds ?? 1) }, changes: aeChanges(fx.ae.changes),
          flags: { [MOD]: { surgeMarker: true } } });
        lines.push(`${t.name}: ${fx.ae.name ?? shortName}${(fx.ae.rounds ?? 1) > 1 ? ` for ${fx.ae.rounds} rounds` : " until your next turn"}.`);
      }
      if (fx.heal) {
        const healed = await healActor(t, formula(fx.heal), `⚡ ${entry.label}`);
        lines.push(`${t.name} heals ${healed}.`);
      }
      if (fx.phoenix) {
        const half = Math.floor((Number(get(t, "system.attributes.hp.max", 0)) || 0) / 2);
        if (!(await writeActor(t, "phoenix"))) return false;
        lines.push(t.isOwner ? `${t.name} is restored to ${half} HP.` : `${t.name} is restored to half HP.`);
      }
      if (fx.dr) { const n = resolveN(fx.dr); await addAE(t, drAE(n, origin)); lines.push(`${t.name}: each hit this round is reduced by ${n}.`); }
      if (fx.resistChoice) {
        const type = chosenType ?? await pickDamageType(shortName);
        if (!type) return false;   // cancelled → refund
        chosenType = type;
        const label = CONFIG.DND5E.damageTypes[type]?.label ?? type;
        await addAE(t, { name: `${shortName} (${label})`, img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", origin,
          duration: { rounds: 1, seconds: 6 }, changes: [{ key: "system.traits.dr.value", mode: 2, value: type, priority: 20 }],
          flags: { [MOD]: { surgeMarker: true } } });
        lines.push(`${t.name}: resistance to ${label} until next turn.`);
      }
      if (fx.acBonus) {
        const n = resolveN(fx.acBonus);
        await addAE(t, { name: `${entry.label.split("—")[0].trim()} (+${n} AC)`, img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", origin,
          duration: { rounds: 1, seconds: 6 }, changes: [{ key: "system.attributes.ac.bonus", mode: 2, value: String(n), priority: 20 }],
          flags: { [MOD]: { surgeMarker: true } } });
        lines.push(`${t.name}: +${n} AC till next turn.`);
      }
    }

    if (fx.oneShot) { await oneShot(actor, fx.oneShot); }
    // Absorbing Guard: the resisted type rides the next melee hit (Table Kit rider "absorbStrike").
    if (fx.absorb && chosenType) {
      await actor.update({ [`flags.${MOD}.oneShot.absorbStrike`]: true, [`flags.${MOD}.absorbType`]: chosenType });
    }
    if (entry.oncePer) await actor.update({ [`flags.${MOD}.used.${usedKey(entry)}`]: true });
    if (fx.init) {
      const c = game.combat?.combatants?.find?.(c => c.actor === actor || c.actor?.id === actor.id);
      if (c) {
        const v = await foundry.applications.api.DialogV2.prompt({
          window: { title: "Reposition — new initiative" },
          content: `<input type="number" name="init" value="${c.initiative ?? 0}" style="width:100%"/>`,
          ok: { label: "Set", callback: (_ev, b) => Number(b.form.elements.init?.value) },
          rejectClose: false,
        }).catch(() => null);
        if (Number.isFinite(v)) { await game.combat.setInitiative(c.id, v); lines.push(`Initiative set to ${v}.`); }
      } else lines.push("Not in combat — initiative unchanged.");
    }
    const kit = game.modules.get("dnd5e-table-kit")?.active;
    if (kit && fx.auto) lines.push(`<em>Armed: ${fx.auto}</em>`);
    else if (fx.note) lines.push(`<em>${fx.note}</em>`);

    await cue(actor, `${entry.label} (${entry.cost} Surge)`, [entry.fiction ? `<em>${entry.fiction}</em>` : "", ...lines].filter(Boolean));
    return true;
  }

  // ── Spend dialog ───────────────────────────────────────────────────────────
  const BUCKETS = [["off", "⚔ Offense"], ["def", "🛡 Defense"], ["heal", "✚ Restoration"], ["narr", "✦ Narrative"]];

  async function openMenu(actor) {
    if (!actor) actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
    if (!actor) return ui.notifications?.warn?.("Select a token or assign a character first.");
    const surge = game.surgePowers;
    if (!surge?.spend) return;
    const cur = surge.get(actor), max = surge.max(actor), prof = profOf(actor);
    // A Path still waiting on its doctrine asks first (the owner closed the prompt earlier).
    for (const p of pathsOf(actor)) if (!p.doctrine && PATHS[p.key]?.doctrines && actor.isOwner) await chooseDoctrine(p.item);

    const entries = MENU.concat(pathEntries(actor));
    const entryHtml = (e) => {
      const profLocked = (e.minProf ?? 0) > prof;
      const broke = e.cost > cur;
      const spent = usedUp(actor, e);
      const disabled = profLocked || broke || spent;
      const why = profLocked ? `Prof +${e.minProf} required (you have +${prof})` : broke ? `Costs ${e.cost} Surge (you have ${cur})`
        : spent ? "Used until your next long rest" : "";
      return `<button type="button" data-surge-key="${e.key}" ${disabled ? "disabled" : ""}
        title="${(e.fiction || "").replace(/"/g, "&quot;")}${why ? " — " + why : ""}"
        style="display:block;width:100%;text-align:left;margin:.15rem 0;padding:.3rem .45rem;border-radius:5px;
        border:1px solid ${disabled ? "rgba(255,255,255,.08)" : "#b9882e66"};
        background:${disabled ? "rgba(255,255,255,.02)" : "rgba(185,136,46,.08)"};
        opacity:${disabled ? ".45" : "1"};cursor:${disabled ? "not-allowed" : "pointer"}">
        <b style="color:#e8c84a">${e.cost}⚡</b> <b>${e.label.split("—")[0].trim()}</b>
        <span style="font-size:.72rem;opacity:.75;display:block">${e.label.includes("—") ? e.label.split("—").slice(1).join("—").trim() : ""}</span>
      </button>`;
    };
    // Universal columns, then one column per Path the character walks (with its doctrine).
    const pathCols = pathsOf(actor).filter(p => PATHS[p.key]).map(p => {
      const def = PATHS[p.key], doc = def.doctrines?.[p.doctrine]?.name;
      return [`path:${p.key}`, `🜂 ${def.name}${doc ? ` · ${doc}` : ""}`];
    });
    const cols = [...BUCKETS, ...pathCols].map(([b, title]) => {
      const list = entries.filter(e => e.bucket === b)
        .sort((a, z) => ((a.minProf ?? 0) - (z.minProf ?? 0)) || (a.cost - z.cost));
      return `<div style="flex:1;min-width:200px"><p style="margin:.2rem 0;font-weight:700;border-bottom:1px solid #b9882e44">${title}</p>
        ${list.map(entryHtml).join("") || "<p style='font-size:.72rem;opacity:.5'>—</p>"}</div>`;
    }).join("");

    const dlg = await new foundry.applications.api.DialogV2({
      window: { title: `⚡ Surge Powers — ${actor.name} (${cur}/${max})`, resizable: true },
      position: { width: 900 + 220 * pathCols.length },
      content: `<div style="display:flex;gap:.8rem;max-height:60vh;overflow:auto">${cols}</div>
        <p style="font-size:.7rem;opacity:.55;margin:.5rem 0 0">Spends are hard-gated by your pool. Mechanical effects apply now; <em>italic</em> lines are GM-applied riders.</p>`,
      buttons: [{ action: "close", label: "Close", default: true }],
      rejectClose: false,
    }).render(true);

    dlg.element.querySelectorAll("[data-surge-key]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const entry = entries.find(e => e.key === btn.dataset.surgeKey);
        if (!entry) return;
        // Validate the target BEFORE debiting — an ally power with no target
        // used to burn the Surge and do nothing.
        if (["ally", "target"].includes(entry.fx?.tgt) && !firstTarget()) {
          return ui.notifications?.warn?.(`${entry.label}: target a token first.`);
        }
        const ok = await surge.spend(actor, entry.cost);
        if (!ok) return ui.notifications?.warn?.(`Not enough Surge (${surge.get(actor)}/${entry.cost}).`);
        let applied = false;
        try { applied = (await applyEntry(actor, entry)) !== false; }
        catch (e) { console.error(TAG, "apply failed", entry.key, e); }
        if (!applied) {
          await surge.set(actor, surge.get(actor) + entry.cost);   // refund
          ui.notifications?.info?.(`${entry.label.split("—")[0].trim()}: nothing applied — ${entry.cost} Surge refunded.`);
        }
        dlg.close();
      });
    });
    return dlg;
  }

  // ── Path rules ─────────────────────────────────────────────────────────────
  const pathOfItem = (item) => item?.flags?.[MOD]?.path ?? null;

  function onPreCreateItem(item, data, options) {
    const path = pathOfItem(item);
    const actor = item.parent;
    if (!path?.key || !(actor instanceof Actor) || options?.surgePathForce) return;
    const have = pathsOf(actor);
    const level = Number(get(actor, "system.details.level", 0)) || 0;
    const name = PATHS[path.key]?.name ?? path.key;
    let why = null;
    if (have.some(p => p.key === path.key)) why = `${actor.name} already walks the ${name}.`;
    else if (have.length >= 2) why = `${actor.name} already has two Paths.`;
    else if (have.length === 1 && level < 17) why = `A second Path opens at 17th level (${actor.name} is level ${level}).`;
    if (why) { ui.notifications?.warn?.(why); return false; }
  }

  async function chooseDoctrine(item) {
    const def = PATHS[pathOfItem(item)?.key];
    if (!def?.doctrines) return;
    const options = Object.entries(def.doctrines).map(([k, d]) =>
      `<label style="display:block;margin:.35rem 0"><input type="radio" name="doctrine" value="${k}"> <b>${d.name}</b>${d.tagline ? ` <em style="opacity:.7">“${d.tagline}”</em>` : ""}<br><span style="font-size:.8rem;opacity:.8">${(d.perk?.description ?? "").replace(/<[^>]+>/g, "")}</span></label>`).join("");
    const pick = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${def.name}: choose a doctrine` },
      content: `<p>Choose once; a doctrine can't be changed later.</p>${options}`,
      ok: { label: "Choose", callback: (_ev, b) => b.form.querySelector("input[name=doctrine]:checked")?.value },
      rejectClose: false,
    }).catch(() => null);
    if (!pick) return ui.notifications?.info?.(`${def.name}: no doctrine chosen yet; you'll be asked again next time you open the Surge menu.`);
    const doc = def.doctrines[pick];
    await item.update({ name: `${def.name} (${doc.name})`, [`flags.${MOD}.path.doctrine`]: pick,
      "system.description.value": `${def.entry?.description ?? ""}<h3>Doctrine: ${doc.name}</h3>${doc.perk?.description ?? ""}` });
    const changes = aeChanges(doc.perk?.changes);
    if (changes.length) await item.createEmbeddedDocuments("ActiveEffect", [{ name: `${doc.name}: ${doc.perk.name}`, img: item.img,
      transfer: true, disabled: false, changes, flags: { [MOD]: { doctrinePerk: pick } } }]);
  }

  function onCreateItem(item, options, userId) {
    if (userId !== game.user.id || !(item.parent instanceof Actor)) return;
    const path = pathOfItem(item);
    if (path?.key && !path.doctrine) chooseDoctrine(item);
  }

  function onPreDeleteItem(item) {
    if (!pathOfItem(item)?.key || game.user.isGM) return;
    ui.notifications?.warn?.("A Path can't be removed or changed; ask your GM.");
    return false;
  }

  // Long rest: once-per-long-rest Path abilities come back.
  function onRestCompleted(actor, result) {
    if (!result?.longRest || !actor?.flags?.[MOD]?.used) return;
    actor.unsetFlag(MOD, "used").catch(() => {});
  }

  // onDamaged (the Bulwark): bank Surge the first time(s) each combat round you take damage.
  function onPreUpdateActor(actor, changes, options) {
    const hp = foundry.utils.getProperty(changes, "system.attributes.hp");
    if (!hp) return;
    const cur = actor.system?.attributes?.hp ?? {};
    const lost = (Number.isFinite(hp.value) && hp.value < cur.value) || (Number.isFinite(hp.temp) && hp.temp < (cur.temp ?? 0));
    if (lost) options[`${MOD}Damaged`] = true;
  }
  async function onUpdateActor(actor, changes, options, userId) {
    if (!options?.[`${MOD}Damaged`] || userId !== game.user.id || !game.combat?.started) return;
    for (const p of pathsOf(actor)) {
      const rule = PATHS[p.key]?.onDamaged;
      if (!rule?.surge) continue;
      const roundKey = `${game.combat.id}.${game.combat.round}`;
      const tally = actor.flags?.[MOD]?.damagedRound?.[p.key];
      const count = tally?.round === roundKey ? tally.count : 0;
      if (count >= (rule.perRound ?? 1)) continue;
      await actor.update({ [`flags.${MOD}.damagedRound.${p.key}`]: { round: roundKey, count: count + 1 } });
      await game.surgePowers?.grant?.(actor, rule.surge);
    }
  }

  /** GM helper: create (or refresh) one world item per Path, ready to drag onto a sheet. */
  async function createPathItems() {
    if (!game.user.isGM) return [];
    await loadPaths();
    let folder = game.folders.find(f => f.type === "Item" && f.name === "Paths");
    if (!folder) folder = await Folder.create({ name: "Paths", type: "Item", color: "#b9882e" });
    const made = [];
    for (const [key, def] of Object.entries(PATHS)) {
      const data = {
        name: def.name, type: "feat", img: def.img ?? "icons/svg/mystery-man.svg", folder: folder.id,
        system: { description: { value: `<p><em>${def.tagline ?? ""}</em></p>${def.entry?.description ?? ""}` } },
        flags: { [MOD]: { path: { key } } }
      };
      const existing = game.items.find(i => i.flags?.[MOD]?.path?.key === key);
      const item = existing ? await existing.update(data) && existing : await Item.implementation.create(data);
      if (!item.system.activities?.size) {
        await item.createActivity?.("utility", { name: def.entry?.name ?? "Path feature", activation: { type: "reaction" },
          description: { chatFlavor: "" } });
      }
      made.push(item.name);
    }
    return made;
  }

  // ── API ────────────────────────────────────────────────────────────────────
  Hooks.once("ready", async () => {
    if (game.system?.id !== "dnd5e") return;
    await loadPaths();
    Hooks.on("preCreateItem", onPreCreateItem);
    Hooks.on("createItem", onCreateItem);
    Hooks.on("preDeleteItem", onPreDeleteItem);
    Hooks.on("dnd5e.restCompleted", onRestCompleted);
    Hooks.on("preUpdateActor", onPreUpdateActor);
    Hooks.on("updateActor", onUpdateActor);
    game.surgePowers = Object.assign(game.surgePowers || {}, {
      openMenu, menu: MENU, applyEntry, profOf,
      paths: { get data() { return PATHS; }, load: loadPaths, of: pathsOf, entries: pathEntries, chooseDoctrine, createItems: createPathItems }
    });
    console.log(TAG, `Surge Powers table ready (${MENU.length} universal entries, ${Object.keys(PATHS).length} Path(s))`);
  });
})();
