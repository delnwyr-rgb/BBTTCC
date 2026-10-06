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
  const RELAY_OPS = new Set(["heal", "phoenix", "tempHP", "addAE", "oneShot", "bank", "ward", "removeStatus", "saveAE", "fillSurge"]);
  // Riders another character may arm on you (an ally's "advantage on your next d20").
  const ARMABLE = new Set(["bonusDie", "advAttack", "reactionMiss", "autoSaveOnce"]);
  async function applyOp(targetActor, op, args = {}) {
    if (op === "oneShot") {
      const keys = (args.keys ?? []).filter(k => ARMABLE.has(k));
      if (!keys.length) return null;
      return targetActor.update(Object.fromEntries(keys.map(k => [`flags.${MOD}.oneShot.${k}`, true])));
    }
    if (op === "bank") return bankLocal(targetActor, String(args.gen ?? ""), Number(args.cap) || 1, { resonance: !!args.resonance });
    if (op === "fillSurge") return game.surgePowers?.set?.(targetActor, game.surgePowers.max(targetActor));
    if (op === "ward") {
      const until = Number(args.until) || 0;
      return targetActor.update({ [`flags.${MOD}.ward`]: { until, by: String(args.by ?? "") } });
    }
    if (op === "removeStatus") {
      for (const id of (args.ids ?? []).filter(id => CONDITIONS.includes(id))) {
        await targetActor.toggleStatusEffect?.(id, { active: false });
      }
      return true;
    }
    if (op === "saveAE") return saveOrEffect(targetActor, args);
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
        if (msg?.type !== "apply" || !game.surgePowers?.isLeader?.()) return;
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

  // ── Path helpers ───────────────────────────────────────────────────────────
  // Conditions a Path ability may end ("end one condition", "every condition").
  const CONDITIONS = ["blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated",
    "paralyzed", "poisoned", "prone", "restrained", "stunned"];

  /** The higher of the actor's spell DC and any SW5E force/tech power DC. */
  function dcOf(actor) {
    const s = actor?.system ?? {};
    const dcs = [Number(s.attributes?.spell?.dc) || 0];
    for (const k of ["force", "tech"]) dcs.push(Number(s.powercasting?.[k]?.dc) || 0);
    const best = Math.max(...dcs);
    if (best > 0) return best;
    const mod = Math.max(...Object.values(s.abilities ?? {}).map(a => Number(a?.mod) || 0), 0);
    return 8 + profOf(actor) + mod;
  }

  /** Roll a save for `actor` against args.dc; on a failure, add args.ae. Runs where the actor is owned. */
  async function saveOrEffect(actor, { ability = "wis", dc = 10, ae = null, label = "" } = {}) {
    const rolls = await actor.rollSavingThrow?.({ ability, target: Number(dc) || 10 }, { configure: false }, {
      data: { flavor: `${label}: ${CONFIG.DND5E.abilities?.[ability]?.label ?? ability} save, DC ${dc}` }
    });
    const roll = Array.isArray(rolls) ? rolls[0] : rolls;
    const failed = roll ? !roll.isSuccess : false;
    if (failed && ae?.flags?.[MOD]) await actor.createEmbeddedDocuments("ActiveEffect", [ae]);
    return failed;
  }

  // Positions from token documents, so ranges work even with the map hidden.
  function tokenDocOf(actor) {
    const scene = game.scenes?.viewed ?? game.scenes?.active ?? canvas?.scene;
    if (!actor) return null;
    if (actor.isToken) return actor.token ?? null;   // an unlinked token's own actor
    const onCanvas = actor.getActiveTokens?.(false, true) ?? [];
    const found = onCanvas.find(t => !scene || t.parent === scene) ?? onCanvas[0];
    if (found) return found;
    // No canvas (or the token is on another scene): search the scenes, the viewed/active one first.
    const scenes = [scene, ...(game.scenes ?? [])].filter(Boolean);
    for (const sc of scenes) {
      const t = sc.tokens.find(t => t.actorLink && t.actorId === actor.id);
      if (t) return t;
    }
    return null;
  }
  function distanceFt(a, b) {
    const ta = a instanceof Actor ? tokenDocOf(a) : a, tb = b instanceof Actor ? tokenDocOf(b) : b;
    const grid = ta?.parent?.grid;
    if (!ta || !tb || ta.parent !== tb.parent || !grid?.size) return Infinity;
    const center = t => ({ x: t.x + (t.width ?? 1) * grid.size / 2, y: t.y + (t.height ?? 1) * grid.size / 2 });
    const pa = center(ta), pb = center(tb);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y) / grid.size * (grid.distance || 5);
  }
  // Friendly unless the token says hostile; characters without a token count as friendly.
  function isHostile(actor) {
    const t = tokenDocOf(actor);
    if (t) return t.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE;
    return actor?.type === "npc";
  }
  /** Friendly actors within `radius` ft of `actor`'s token (always including `actor`). */
  function alliesNear(actor, radius) {
    const me = tokenDocOf(actor);
    const out = [actor];
    if (!me) return out;
    for (const t of me.parent.tokens) {
      if (!t.actor || t.actor === actor || t.hidden) continue;
      if (t.disposition < 0) continue;
      if (distanceFt(me, t) <= radius) out.push(t.actor);
    }
    return out;
  }

  /** Arm one-shot riders on `target` (owner writes directly, otherwise the GM relay). */
  async function armOn(target, keys) {
    keys = [].concat(keys).filter(Boolean);
    if (!target || !keys.length) return false;
    return writeActor(target, "oneShot", { keys });
  }

  // ── Surge generators (Path entry features) ─────────────────────────────────
  // Each generator banks at most `cap` Surge per combat round, tallied on the
  // actor at flags.surge-powers.gen.<key> = {round, count}. Only in a started combat.
  const roundKey = () => game.combat?.started ? `${game.combat.id}.${game.combat.round}` : null;
  const turnKey = () => game.combat?.started ? `${game.combat.id}.${game.combat.round}.${game.combat.turn}` : null;
  async function bankLocal(actor, gen, cap = 1, { resonance = false } = {}) {
    const rk = roundKey();
    if (!actor || !gen || !rk) return false;
    const tally = actor.flags?.[MOD]?.gen?.[gen];
    const count = tally?.round === rk ? tally.count : 0;
    if (count >= cap) return false;
    await actor.update({ [`flags.${MOD}.gen.${gen}`]: { round: rk, count: count + 1 } });
    await game.surgePowers?.grant?.(actor, 1, { resonance });
    return true;
  }
  function bank(actor, gen, cap = 1, opts = {}) {
    if (actor?.isOwner) return bankLocal(actor, gen, cap, opts);
    return writeActor(actor, "bank", { gen, cap, resonance: !!opts.resonance });
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
        // A doctrine can sharpen a shared ability (Bound Light's Forge-Weld heals more).
        const over = a.byDoctrine?.[doctrine];
        const fx = over ? foundry.utils.mergeObject(foundry.utils.deepClone(a.fx ?? {}), over.fx ?? {}) : a.fx;
        out.push({ ...a, ...(over ?? {}), fx, key: `path:${key}:${a.key}`, bucket: `path:${key}`, minProf: a.minProf ?? 0, pathKey: key });
      }
    }
    return out;
  }
  const usedKey = (entry) => entry.key.replace(/[^a-z0-9]+/gi, "_");
  // oncePer: "long" | "short" (cleared by rests) · "round" | "turn" (keyed to the combat clock).
  function useStamp(entry) {
    if (entry.oncePer === "round") return roundKey();
    if (entry.oncePer === "turn") return turnKey();
    return entry.oncePer ?? null;
  }
  function usedUp(actor, entry) {
    if (!entry.oncePer) return false;
    const stamp = useStamp(entry);
    if (!stamp) return false;   // round/turn limits only bite in combat
    return actor?.flags?.[MOD]?.used?.[usedKey(entry)] === stamp;
  }
  const evalAmount = (actor, f) => {
    const prof = profOf(actor), level = Number(get(actor, "system.details.level", 0)) || 0;
    try { return Math.max(0, Math.round(Roll.safeEval(String(f).replaceAll("@prof", prof).replaceAll("@level", level)))); }
    catch { return 0; }
  };
  // Expand ["key", type, value] rows: "__all__" as the value = every damage type; "__all__" inside
  // the key = every ability ("system.abilities.__all__.save.roll.mode"); @prof/@level in the value
  // resolve against the user of the ability.
  const aeChanges = (changes, actor = null) => (changes ?? []).flatMap(([key, type, value]) => {
    const keys = key.includes("__all__") ? Object.keys(CONFIG.DND5E.abilities ?? {}).map(k => key.replace("__all__", k)) : [key];
    const vals = value === "__all__" ? Object.keys(CONFIG.DND5E.damageTypes ?? {}) : [value];
    const mode = { add: 2, override: 5, multiply: 1, upgrade: 4, downgrade: 3 }[type] ?? 2;
    const resolve = (v) => (actor && /@(prof|level)/.test(String(v))) ? String(evalAmount(actor, v)) : String(v);
    return keys.flatMap(k => vals.map(v => ({ key: k, type, mode, value: resolve(v), priority: 20 })));
  });
  // dnd5e sets a flat-AC creature's AC (most NPCs) from ac.override before effects apply and
  // ignores ac.bonus, so on those targets an AC change goes to ac.override instead.
  function fitAC(changes, target) {
    const ac = target?._source?.system?.attributes?.ac ?? {};
    const flat = ac.calc === "flat" || (ac.calc === undefined && ac.override != null);   // dnd5e 6 stores flat AC as override
    if (!flat) return changes;
    return changes.map(c => c.key === "system.attributes.ac.bonus" ? { ...c, key: "system.attributes.ac.override" } : c);
  }

  // ── Effect application ─────────────────────────────────────────────────────
  async function applyEntry(actor, entry) {
    if (entry.fx?.dreamCache) return dreamCache(actor, entry);
    const prof = profOf(actor);
    const fx = entry.fx ?? {};
    const lines = [];
    const origin = actor.uuid;
    const resolveN = (v) => v === "prof" ? prof : Number(v) || 0;
    const formula = (f) => String(f).replaceAll("@prof", String(prof)).replaceAll("@level", String(Number(get(actor, "system.details.level", 0)) || 0));
    const shortName = entry.label.split("—")[0].trim();
    const ICON = "icons/magic/defensive/shield-barrier-glowing-blue.webp";
    const surgeAE = (data) => ({ img: ICON, origin, flags: { [MOD]: { surgeMarker: true } }, ...data });

    // Resolve targets.
    let targets = [];
    const token = casterToken(actor);
    const tgt = fx.tgt ?? "self";
    const userTargets = () => [...(game.user?.targets ?? [])].map(t => t.actor).filter(Boolean);
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
    else if (/^allies\d+$/.test(tgt)) targets = alliesNear(actor, Number(tgt.slice(6)));
    else if (tgt === "target" || tgt === "targets") {
      const foes = userTargets();
      if (!foes.length && entry._nested) return [];   // an optional second effect with no target: skip it
      if (!foes.length) { ui.notifications?.warn?.(`${entry.label}: target a token first.`); return false; }
      targets = tgt === "target" ? [foes[0]] : foes;
    }
    if (!entry._nested && usedUp(actor, entry)) {
      const when = { long: "your next long rest", short: "your next rest", round: "next round", turn: "your next turn" }[entry.oncePer];
      ui.notifications?.warn?.(`${shortName}: already used until ${when}.`);
      return false;
    }

    // Someone else's character needs the GM relay — bail (and refund) up front if no GM is online.
    const writes = fx.heal || fx.phoenix || fx.dr || fx.acBonus || fx.resistChoice || fx.ae || fx.tempHP || fx.arm
      || fx.ward || fx.endCondition || fx.save;
    if (writes && !game.users?.activeGM && targets.some(t => t && !t.isOwner)) {
      ui.notifications?.warn?.(`${entry.label}: no GM online to apply it to another character.`);
      return false;
    }
    // A stance replaces any other stance of its group (the Aurablade's four Auras).
    if (fx.stance) {
      const old = actor.effects.filter(e => e.flags?.[MOD]?.stance === fx.stance).map(e => e.id);
      if (old.length) await actor.deleteEmbeddedDocuments("ActiveEffect", old);
    }

    let chosenType = null, healedTotal = 0;
    const dc = dcOf(actor);
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
      if (fx.save) {
        // Forced save (Table Kit style): the target rolls against the user's spell/power DC.
        const ae = fx.save.ae ? surgeAE({ name: fx.save.ae.name ?? shortName, duration: { rounds: fx.save.ae.rounds ?? 1, seconds: 6 * (fx.save.ae.rounds ?? 1) },
          changes: fitAC(aeChanges(fx.save.ae.changes, actor), t), statuses: fx.save.ae.statuses ?? [] }) : null;
        const args = { ability: fx.save.ability ?? "wis", dc, ae, label: shortName };
        if (t.isOwner) {
          const failed = await saveOrEffect(t, args);
          lines.push(`${t.name} ${failed ? `fails the ${args.ability.toUpperCase()} save (DC ${dc}): ${fx.save.ae?.name ?? shortName}.` : `saves (DC ${dc}).`}`);
        } else {
          await writeActor(t, "saveAE", args);
          lines.push(`${t.name} makes a ${args.ability.toUpperCase()} save (DC ${dc}).`);
        }
      }
      if (fx.ae) {
        await addAE(t, surgeAE({ name: fx.ae.name ?? shortName,
          ...(fx.ae.rounds === 0 ? {} : { duration: { rounds: fx.ae.rounds ?? 1, seconds: 6 * (fx.ae.rounds ?? 1) } }),
          changes: fitAC(aeChanges(fx.ae.changes, actor), t), statuses: fx.ae.statuses ?? [],
          flags: { [MOD]: { surgeMarker: true, ...(fx.stance ? { stance: fx.stance } : {}) } } }));
        const how = fx.ae.rounds === 0 ? "" : (fx.ae.rounds ?? 1) > 1 ? ` for ${fx.ae.rounds} rounds` : " until your next turn";
        lines.push(`${t.name}: ${fx.ae.name ?? shortName}${how}.`);
      }
      if (fx.heal) {
        const healed = await healActor(t, formula(fx.heal), `⚡ ${entry.label}`);
        healedTotal += healed;
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
        const rounds = fx.resistRounds ?? 1;
        await addAE(t, surgeAE({ name: `${shortName} (${label})`, duration: { rounds, seconds: 6 * rounds },
          changes: [{ key: "system.traits.dr.value", mode: 2, value: type, priority: 20 }] }));
        lines.push(`${t.name}: resistance to ${label} ${rounds > 1 ? `for ${rounds} rounds` : "until next turn"}.`);
      }
      if (fx.acBonus) {
        const n = resolveN(fx.acBonus);
        await addAE(t, surgeAE({ name: `${shortName} (+${n} AC)`, duration: { rounds: 1, seconds: 6 },
          changes: fitAC(aeChanges([["system.attributes.ac.bonus", "add", String(n)]]), t) }));
        lines.push(`${t.name}: +${n} AC till next turn.`);
      }
      if (fx.arm) {
        await armOn(t, fx.arm);
        const what = { bonusDie: "advantage on their next d20 roll", advAttack: "advantage on their next attack",
          reactionMiss: "the next hit on them this round misses", autoSaveOnce: "their next save succeeds" };
        lines.push(`${t.name}: ${[].concat(fx.arm).map(k => what[k] ?? k).join("; ")}.`);
      }
      if (fx.ward) {
        const rounds = Number(fx.ward) || 1;
        await writeActor(t, "ward", { until: (game.time?.worldTime ?? 0) + 6 * rounds, by: actor.name });
        lines.push(`${t.name} is warded: the next drop to 0 HP stops at 1${rounds > 1 ? "" : " (until your next turn)"}.`);
      }
      if (fx.shareStance) {
        // Aura Unbound: allies take a timed copy of the user's current stance.
        const src = actor.effects.find(e => e.flags?.[MOD]?.stance === fx.shareStance);
        if (src && t !== actor) {
          const data = src.toObject(); delete data._id;
          data.duration = { rounds: fx.shareRounds ?? 10, seconds: 6 * (fx.shareRounds ?? 10) };
          data.flags = { [MOD]: { surgeMarker: true } };
          data.changes = fitAC(data.system?.changes ?? data.changes ?? [], t);
          if (data.system?.changes) data.system.changes = data.changes;
          data.origin = origin;
          await addAE(t, data);
          lines.push(`${t.name}: shares ${src.name}.`);
        } else if (!src && t === actor) lines.push(`${actor.name} has no Aura to share.`);
      }
      if (fx.endCondition) {
        const have = CONDITIONS.filter(id => t.statuses?.has?.(id));
        let ids = [];
        if (fx.endCondition === "all") ids = have;
        else if (have.length === 1) ids = have;
        else if (have.length > 1) {
          const pick = await foundry.applications.api.DialogV2.prompt({
            window: { title: `${shortName}: end which condition on ${t.name}?` },
            content: have.map((id, i) => `<label style="display:block"><input type="radio" name="c" value="${id}" ${i ? "" : "checked"}> ${CONFIG.statusEffects.find(e => e.id === id)?.name ? game.i18n.localize(CONFIG.statusEffects.find(e => e.id === id).name) : id}</label>`).join(""),
            ok: { label: "End it", callback: (_ev, b) => b.form.querySelector("input[name=c]:checked")?.value },
            rejectClose: false,
          }).catch(() => null);
          if (pick) ids = [pick];
        }
        if (ids.length) { await writeActor(t, "removeStatus", { ids }); lines.push(`${t.name}: no longer ${ids.join(", ")}.`); }
        else lines.push(`${t.name} has no condition to end.`);
      }
    }

    // Costs the user pays and gains the user banks.
    if (fx.selfDamage) {
      const n = fx.selfDamage === "halfHeal" ? Math.floor(healedTotal / 2) : evalAmount(actor, fx.selfDamage);
      if (n > 0) { await actor.applyDamage?.(n); lines.push(`${actor.name} takes ${n} damage.`); }
    }
    if (fx.gainSurge) { await game.surgePowers?.grant?.(actor, Number(fx.gainSurge) || 1); lines.push(`${actor.name} banks ${fx.gainSurge} Surge.`); }
    if (fx.fillSurge) { await writeActor(actor, "fillSurge"); lines.push(`${actor.name}'s Surge is full.`); }

    for (const k of [].concat(fx.oneShot ?? [])) await oneShot(actor, k);
    // A second effect on a different set of targets ("allies gain advantage, and one foe…").
    if (fx.and) {
      const more = await applyEntry(actor, { ...entry, oncePer: null, fx: fx.and, _nested: true });
      if (Array.isArray(more)) lines.push(...more);
    }
    // Absorbing Guard: the resisted type rides the next melee hit (Table Kit rider "absorbStrike").
    if (fx.absorb && chosenType) {
      await actor.update({ [`flags.${MOD}.oneShot.absorbStrike`]: true, [`flags.${MOD}.absorbType`]: chosenType });
    }
    if (entry.oncePer) await actor.update({ [`flags.${MOD}.used.${usedKey(entry)}`]: useStamp(entry) ?? true });
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
    if (kit && fx.auto && fx.note && fx.alsoNote) lines.push(`<em>${fx.note}</em>`);
    if (entry._nested) return lines;

    await cue(actor, `${entry.label} (${entry.cost} Surge)`, [entry.fiction ? `<em>${entry.fiction}</em>` : "", ...lines].filter(Boolean));
    return true;
  }

  // ── The Dream-Cache (Dreamwalker) ──────────────────────────────────────────
  // After a long rest, store one spell/power of 1st–3rd level; before the next
  // long rest, cast it once without spending a slot or points.
  const cacheOf = (actor) => actor?.flags?.[MOD]?.dreamCache ?? null;
  function dreamCacheLabel(actor) {
    const c = cacheOf(actor), item = c?.itemId ? actor.items.get(c.itemId) : null;
    if (!item) return "Dream-Cache — store a 1st–3rd level spell or power to cast free later";
    if (c.used) return `Dream-Cache — ${item.name} (spent until your next long rest)`;
    return `Dream-Cache — cast ${item.name} without spending a slot or points`;
  }
  async function dreamCache(actor, entry) {
    const c = cacheOf(actor), item = c?.itemId ? actor.items.get(c.itemId) : null;
    if (item && c.used) { ui.notifications?.warn?.("Dream-Cache: already spent; store a new one after your next long rest."); return false; }
    if (item) {
      const activity = item.system.activities?.contents?.[0];
      if (!activity) { ui.notifications?.warn?.(`Dream-Cache: ${item.name} has nothing to cast.`); return false; }
      await actor.update({ [`flags.${MOD}.dreamCache.used`]: true });
      await cue(actor, `Dream-Cache (0 Surge)`, [`<em>The dream remembers it for you.</em>`, `${actor.name} casts ${item.name} from the Dream-Cache, free.`]);
      await activity.use({ consume: { spellSlot: false, resources: false, action: true } }, { configure: false });
      return true;
    }
    const choices = actor.items.filter(i => ["spell", "power"].includes(i.type) && (Number(i.system.level) || 0) >= 1 && (Number(i.system.level) || 0) <= 3)
      .sort((a, b) => (a.system.level - b.system.level) || a.name.localeCompare(b.name));
    if (!choices.length) { ui.notifications?.warn?.("Dream-Cache: no 1st–3rd level spell or power to store."); return false; }
    const pick = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${actor.name}: store a spell in the Dream-Cache` },
      content: `<p>Cast it once, free, before your next long rest.</p><select name="spell" style="width:100%">${choices.map(i => `<option value="${i.id}">${i.name} (level ${i.system.level})</option>`).join("")}</select>`,
      ok: { label: "Store", callback: (_ev, b) => b.form.elements.spell?.value },
      rejectClose: false,
    }).catch(() => null);
    if (!pick) return false;
    await actor.update({ [`flags.${MOD}.dreamCache`]: { itemId: pick, used: false } });
    await cue(actor, "Dream-Cache (0 Surge)", [`${actor.name} stores ${actor.items.get(pick)?.name} in the Dream-Cache.`]);
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

    const entries = MENU.concat(pathEntries(actor)).map(e => e.fx?.dreamCache ? { ...e, label: dreamCacheLabel(actor) } : e);
    const entryHtml = (e) => {
      const profLocked = (e.minProf ?? 0) > prof;
      const broke = e.cost > cur;
      const spent = usedUp(actor, e);
      const gmOnly = !!e.gmOnly && !game.user.isGM;
      const disabled = profLocked || broke || spent || gmOnly;
      const why = profLocked ? `Prof +${e.minProf} required (you have +${prof})` : broke ? `Costs ${e.cost} Surge (you have ${cur})`
        : spent ? "Already used (limited use)" : gmOnly ? "Your GM confirms this one" : "";
      return `<button type="button" data-surge-key="${e.key}" ${disabled ? "disabled" : ""}
        title="${(e.fiction || "").replace(/"/g, "&quot;")}${why ? " — " + why : ""}"
        style="display:block;width:100%;height:auto;min-height:0;line-height:1.25;white-space:normal;text-align:left;margin:.2rem 0;padding:.3rem .45rem;border-radius:5px;
        border:1px solid ${disabled ? "rgba(255,255,255,.08)" : "#b9882e66"};
        background:${disabled ? "rgba(255,255,255,.02)" : "rgba(185,136,46,.08)"};
        opacity:${disabled ? ".45" : "1"};cursor:${disabled ? "not-allowed" : "pointer"}">
        <b style="color:#e8c84a">${e.cost}⚡</b> <b>${e.label.split("—")[0].trim()}</b>
        <span style="font-size:.72rem;opacity:.75;display:block;margin-top:.1rem">${e.label.includes("—") ? e.label.split("—").slice(1).join("—").trim() : ""}</span>
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
      buttons: [
        ...(canTakePath(actor) ? [{ action: "path", label: "🜂 Choose a Path…", callback: () => { pickPath(actor); } }] : []),
        { action: "close", label: "Close", default: true }],
      rejectClose: false,
    }).render(true);

    dlg.element.querySelectorAll("[data-surge-key]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const entry = entries.find(e => e.key === btn.dataset.surgeKey);
        if (!entry) return;
        // Validate the target BEFORE debiting — an ally power with no target
        // used to burn the Surge and do nothing.
        if (["ally", "target", "targets"].includes(entry.fx?.tgt) && !firstTarget()) {
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
  // Dave and Mags share the Gamemaster login, so "same user" can be two windows.
  // pre* hooks run only in the window that made the change: it stamps this id
  // on the operation options, and only that window acts on the broadcast.
  const CLIENT_ID = foundry.utils.randomID();

  function onPreCreateItem(item, data, options) {
    const path = pathOfItem(item);
    const actor = item.parent;
    if (!path?.key || !(actor instanceof Actor)) return;
    if (options?.surgePathForce) { options[`${MOD}DoctrineBy`] = CLIENT_ID; return; }
    const have = pathsOf(actor);
    const level = Number(get(actor, "system.details.level", 0)) || 0;
    const name = PATHS[path.key]?.name ?? path.key;
    let why = null;
    if (have.some(p => p.key === path.key)) why = `${actor.name} already walks the ${name}.`;
    else if (have.length >= 2) why = `${actor.name} already has two Paths.`;
    else if (have.length === 1 && level < 17) why = `A second Path opens at 17th level (${actor.name} is level ${level}).`;
    if (why) { ui.notifications?.warn?.(why); return false; }
    options[`${MOD}DoctrineBy`] = CLIENT_ID;
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
    await ensurePerk(item);
  }
  /** The doctrine perk's transfer effect, created once. */
  async function ensurePerk(item) {
    const path = pathOfItem(item), doc = PATHS[path?.key]?.doctrines?.[path?.doctrine];
    if (!doc || item.effects.some(e => e.flags?.[MOD]?.doctrinePerk)) return;
    const changes = aeChanges(doc.perk?.changes);
    if (changes.length) await item.createEmbeddedDocuments("ActiveEffect", [{ name: `${doc.name}: ${doc.perk.name}`, img: item.img,
      transfer: true, disabled: false, changes, flags: { [MOD]: { doctrinePerk: path.doctrine } } }]);
  }

  function onCreateItem(item, options, userId) {
    if (options?.[`${MOD}DoctrineBy`] !== CLIENT_ID || !(item.parent instanceof Actor)) return;
    const path = pathOfItem(item);
    if (!path?.key) return;
    if (path.doctrine) ensurePerk(item);   // copied or pre-set Path: still gets its doctrine perk
    else chooseDoctrine(item);
  }

  function onPreDeleteItem(item) {
    if (!pathOfItem(item)?.key || game.user.isGM) return;
    ui.notifications?.warn?.("A Path can't be removed or changed; ask your GM.");
    return false;
  }

  // Rests: long → every limited use and the Dream-Cache; short → "once per short rest" uses.
  function onRestCompleted(actor, result) {
    const used = actor?.flags?.[MOD]?.used ?? {};
    if (result?.longRest) {
      const update = Object.fromEntries(Object.keys(used).map(k => [`flags.${MOD}.used.${k}`, false]));
      if (cacheOf(actor)) update[`flags.${MOD}.dreamCache`] = { itemId: null, used: false };
      if (Object.keys(update).length) actor.update(update).catch(() => {});
      return;
    }
    const update = Object.fromEntries(Object.entries(used).filter(([, v]) => v === "short").map(([k]) => [`flags.${MOD}.used.${k}`, false]));
    if (Object.keys(update).length) actor.update(update).catch(() => {});
  }

  // ── Generator events ───────────────────────────────────────────────────────
  // Each Path (and doctrine) lists `bank: [{on, cap?, range?}]`. Events are
  // detected once, in the window that caused them (pre* hooks stamp CLIENT_ID,
  // roll hooks are local), then every eligible Path walker in the combat banks.
  function bankRules(actor) {
    const out = [];
    for (const p of pathsOf(actor)) {
      const def = PATHS[p.key];
      for (const r of [...(def?.bank ?? []), ...(def?.doctrines?.[p.doctrine]?.bank ?? [])]) out.push({ ...r, pathKey: p.key });
    }
    return out;
  }
  function walkers(on) {
    if (!game.combat?.started) return [];
    const seen = new Set(), out = [];
    for (const c of game.combat.combatants) {
      const a = c.actor;
      if (!a || seen.has(a.uuid)) continue;
      seen.add(a.uuid);
      for (const r of bankRules(a).filter(r => r.on === on)) out.push({ actor: a, rule: r });
    }
    return out;
  }
  const capOf = (rule, actor) => rule.cap === "halfProf" ? Math.floor(profOf(actor) / 2) : (Number(rule.cap) || 1);
  function fire(on, test, opts = {}) {
    for (const { actor, rule } of walkers(on)) {
      try { if (test(actor, rule)) bank(actor, `${rule.pathKey}_${on}`, capOf(rule, actor), opts); }
      catch (e) { console.warn(TAG, "generator", on, e); }
    }
  }

  // Damage: the Bulwark (damaged), the Soul-Smith (allyDamaged), Victory (foeDown). The ward lives here too.
  function onPreUpdateActor(actor, changes, options) {
    const hp = foundry.utils.getProperty(changes, "system.attributes.hp");
    if (!hp) return;
    const cur = actor.system?.attributes?.hp ?? {};
    const ward = actor.flags?.[MOD]?.ward;
    if (Number.isFinite(hp.value) && hp.value <= 0 && cur.value > 0 && ward?.until >= (game.time?.worldTime ?? 0)) {
      hp.value = 1;
      foundry.utils.setProperty(changes, `flags.${MOD}.ward`, { until: 0, by: "" });
      options[`${MOD}Warded`] = ward.by || true;
    }
    const lost = (Number.isFinite(hp.value) && hp.value < cur.value) || (Number.isFinite(hp.temp) && hp.temp < (cur.temp ?? 0));
    if (lost) options[`${MOD}Damaged`] = { by: CLIENT_ID, down: Number.isFinite(hp.value) && hp.value <= 0 && cur.value > 0 };
  }
  async function onUpdateActor(actor, changes, options) {
    if (options?.[`${MOD}Warded`] && options?.[`${MOD}Damaged`]?.by === CLIENT_ID) {
      cue(actor, "Ward holds", [`${actor.name} would have dropped to 0 HP; the ward holds them at 1.`]);
    }
    const dmg = options?.[`${MOD}Damaged`];
    if (dmg?.by !== CLIENT_ID || !game.combat?.started) return;
    const hostile = isHostile(actor);
    fire("damaged", (w) => w === actor);
    fire("allyDamaged", (w, r) => !hostile && distanceFt(w, actor) <= (r.range ?? 30));
    if (dmg.down) fire("foeDown", (w, r) => hostile && distanceFt(w, actor) <= (r.range ?? 30));
  }

  // Attacks: the Aurablade (meleeHit, from the damage roll that follows a hit), the Dreamwalker (enemyMiss).
  function onRollDamage(rolls, data) {
    const activity = data?.subject, attacker = activity?.actor;
    if (!attacker || activity?.item?.type !== "weapon" || activity?.attack?.type?.value !== "melee") return;
    fire("meleeHit", (w) => w === attacker);
  }
  function onRollAttack(rolls, data) {
    const activity = data?.subject, attacker = activity?.actor, roll = rolls?.[0];
    if (!attacker || !roll || !isHostile(attacker)) return;
    const usage = game.messages.get(roll.options?.originatingMessage);
    const acs = (usage?.system?.targets?.length ? usage.system.targets.map(t => t.ac)
      : [...(game.user?.targets ?? [])].map(t => t.actor?.system?.attributes?.ac?.value)).filter(ac => Number.isFinite(ac));
    if (!acs.length || roll.isCritical) return;
    const missed = roll.isFumble || acs.every(ac => roll.total < ac);
    if (missed) fire("enemyMiss", (w, r) => distanceFt(w, attacker) <= (r.range ?? 60));
  }
  // Saves: the Wyrdlens Adept (seenSaveFail) — only when the roll knew its DC.
  function onRollSave(rolls, data) {
    const roll = rolls?.[0];
    const actor = data?.subject?.actor ?? (data?.subject instanceof Actor ? data.subject : null);
    if (!roll || !actor || !Number.isFinite(roll.options?.target) || roll.isSuccess) return;
    fire("seenSaveFail", (w, r) => distanceFt(w, actor) <= (r.range ?? 60));
  }

  // Movement: the Shadow Courier (moved30) — 30 ft or more on its own turn.
  const movedThisTurn = new Map();
  function onPreUpdateToken(tokenDoc, changes, options) {
    if (!("x" in changes) && !("y" in changes)) return;
    options[`${MOD}Moved`] = { by: CLIENT_ID, x: tokenDoc.x, y: tokenDoc.y };
  }
  function onUpdateToken(tokenDoc, changes, options) {
    const m = options?.[`${MOD}Moved`];
    if (m?.by !== CLIENT_ID || !game.combat?.started) return;
    const actor = tokenDoc.actor, current = game.combat.combatant;
    if (!actor || !current || (current.tokenId !== tokenDoc.id && current.actorId !== actor.id)) return;
    const grid = tokenDoc.parent?.grid;
    if (!grid?.size) return;
    const ft = Math.hypot(tokenDoc.x - m.x, tokenDoc.y - m.y) / grid.size * (grid.distance || 5);
    const key = `${tokenDoc.uuid}:${turnKey()}`;
    const total = (movedThisTurn.get(key) ?? 0) + ft;
    movedThisTurn.set(key, total);
    if (total >= 30) fire("moved30", (w) => w === actor);
  }

  // The combat clock: the Cosmic Linguist (roundStart), the Pactkeeper (concentratingTurn).
  function onPreUpdateCombat(combat, changes, options) {
    if (!("round" in changes) && !("turn" in changes)) return;
    options[`${MOD}Clock`] = { by: CLIENT_ID, round: combat.round };
  }
  function onUpdateCombat(combat, changes, options) {
    const c = options?.[`${MOD}Clock`];
    if (c?.by !== CLIENT_ID || !combat.started || combat !== game.combat) return;
    if ("round" in changes && combat.round > (c.round ?? 0)) fire("roundStart", () => true);
    const current = combat.combatant?.actor;
    if (current?.statuses?.has?.("concentrating")) fire("concentratingTurn", (w) => w === current);
  }

  // Resonance: the Harmony Marshal banks when an ally within 30 ft banks.
  function onBanked(actor, n, { resonance } = {}) {
    if (resonance || !game.combat?.started || isHostile(actor)) return;
    fire("allyBanked", (w, r) => w !== actor && distanceFt(w, actor) <= (r.range ?? 30), { resonance: true });
  }

  // A character can take a Path when it has none, or one and is 17th level+.
  function canTakePath(actor) {
    if (!actor?.isOwner || !Object.keys(PATHS).length) return false;
    const have = pathsOf(actor), level = Number(get(actor, "system.details.level", 0)) || 0;
    const open = Object.keys(PATHS).some(k => !have.some(p => p.key === k));
    return open && (have.length === 0 || (have.length === 1 && level >= 17));
  }
  function pathItemData(key, def) {
    return {
      name: def.name, type: "feat", img: def.img ?? "icons/svg/mystery-man.svg",
      system: { description: { value: `<p><em>${def.tagline ?? ""}</em></p>${def.entry?.description ?? ""}` } },
      flags: { [MOD]: { path: { key } } }
    };
  }
  /** Pick a Path from the Surge menu; adding it then asks for the doctrine (onCreateItem). */
  async function pickPath(actor) {
    const have = pathsOf(actor);
    const options = Object.entries(PATHS).filter(([k]) => !have.some(p => p.key === k)).map(([k, d]) =>
      `<label style="display:block;margin:.35rem 0"><input type="radio" name="path" value="${k}"> <b>${d.name}</b>${d.tagline ? ` <em style="opacity:.7">“${d.tagline}”</em>` : ""}<br><span style="font-size:.8rem;opacity:.8">${(d.entry?.description ?? "").replace(/<[^>]+>/g, " ")}</span></label>`).join("");
    const key = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${actor.name}: choose a Path` },
      content: `<p>${have.length ? "Your second Path" : "Your Path"} can't be changed later.</p>${options}`,
      ok: { label: "Walk this Path", callback: (_ev, b) => b.form.querySelector("input[name=path]:checked")?.value },
      rejectClose: false,
    }).catch(() => null);
    if (!key) return;
    // Prefer the GM's world item (it carries the reaction activity); otherwise build one.
    const world = game.items.find(i => i.flags?.[MOD]?.path?.key === key);
    const data = world ? world.toObject() : pathItemData(key, PATHS[key]);
    delete data._id; delete data.folder;
    await actor.createEmbeddedDocuments("Item", [data]);
  }

  /** GM helper: create (or refresh) one world item per Path, ready to drag onto a sheet. */
  async function createPathItems() {
    if (!game.user.isGM) return [];
    await loadPaths();
    let folder = game.folders.find(f => f.type === "Item" && f.name === "Paths");
    if (!folder) folder = await Folder.create({ name: "Paths", type: "Item", color: "#b9882e" });
    const made = [];
    for (const [key, def] of Object.entries(PATHS)) {
      const data = { ...pathItemData(key, def), folder: folder.id };
      const existing = game.items.find(i => i.flags?.[MOD]?.path?.key === key);
      let item = existing;
      if (existing) await existing.update(data);
      else item = await Item.implementation.create(data);
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
    Hooks.on("dnd5e.rollDamageV2", onRollDamage);
    Hooks.on("dnd5e.rollAttackV2", onRollAttack);
    Hooks.on("dnd5e.rollSavingThrow", onRollSave);
    Hooks.on("preUpdateToken", onPreUpdateToken);
    Hooks.on("updateToken", onUpdateToken);
    Hooks.on("preUpdateCombat", onPreUpdateCombat);
    Hooks.on("updateCombat", onUpdateCombat);
    Hooks.on("surgePowers.banked", onBanked);
    game.surgePowers = Object.assign(game.surgePowers || {}, {
      openMenu, menu: MENU, applyEntry, profOf,
      paths: { debug: { clientId: () => CLIENT_ID, distanceFt, dcOf, alliesNear }, get data() { return PATHS; }, load: loadPaths, of: pathsOf, entries: pathEntries, chooseDoctrine, pick: pickPath, canTake: canTakePath, createItems: createPathItems }
    });
    console.log(TAG, `Surge Powers table ready (${MENU.length} universal entries, ${Object.keys(PATHS).length} Path(s))`);
  });
})();
