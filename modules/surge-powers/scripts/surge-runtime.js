/* ─────────────────────────────────────────────────────────────────────────────
 * Surge Powers · surge-runtime.js — the Surge pool
 * ─────────────────────────────────────────────────────────────────────────────
 * A shared heroic-resource economy for dnd5e (standalone port of Bad Eden's
 * Surge Unification model — the shared table only, no class kits).
 *
 *  POOL   flags.surge-powers.value  · max = 2×proficiency (min 4), overridable
 *         per actor via flags.surge-powers.maxOverride. API: game.surgePowers.
 *  FILL   the KEPT d20 result on any roll (attack / save / ability check /
 *         skill / concentration) ≥ the world threshold (default 15 ⇒ 30%)
 *         banks +1 Surge; a natural 20 also "explodes" (re-roll, chaining
 *         +1 per further 20). Advantage/disadvantage flow in for free since
 *         only the kept die counts (adv → more Surge, disadv → less).
 *         A long rest also banks +proficiency as a baseline (toggleable).
 *         Casting a spell or power banks +2 (casters roll too few d20s to
 *         live on the threshold), and combat start ticks +1 to every
 *         character in the tracker — both world-tunable.
 *  SPEND  the Surge Powers menu (surge-powers.js) spends from the same pool.
 *
 *  DESIGN NOTE: Surge is a SEPARATE pool — it is NEVER added to a d20 roll
 *  total. The explosion only mints pool points; dnd5e's d20 math is untouched.
 * ─────────────────────────────────────────────────────────────────────────────
 */
(() => {
  const MOD = "surge-powers";
  const TAG = "[surge-powers/runtime]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;

  const get = (o, p, d) => { try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; } };
  const setting = (k, d) => { try { return game.settings.get(MOD, k); } catch { return d; } };

  Hooks.once("init", () => {
    if (game.system?.id && game.system.id !== "dnd5e") return;
    game.settings.register(MOD, "threshold", {
      name: "Surge threshold",
      hint: "The kept d20 result that banks +1 Surge. 15 ⇒ 30% of rolls; 16 ⇒ 25%; 20 ⇒ only naturals.",
      scope: "world", config: true, type: Number,
      range: { min: 10, max: 20, step: 1 }, default: 15
    });
    game.settings.register(MOD, "explode", {
      name: "Natural 20s explode",
      hint: "A natural 20 re-rolls a bonus d20, chaining +1 extra Surge per further 20.",
      scope: "world", config: true, type: Boolean, default: true
    });
    game.settings.register(MOD, "castGain", {
      name: "Surge per spell cast",
      hint: "Casting a spell (or using a power) banks this much Surge — casters don't roll enough d20s to live on the threshold fill alone. 0 disables.",
      scope: "world", config: true, type: Number,
      range: { min: 0, max: 5, step: 1 }, default: 2
    });
    game.settings.register(MOD, "combatTick", {
      name: "Surge per combat",
      hint: "Every character in the tracker banks this much Surge when combat starts (late joiners get it on entry), so there's always something fun to spend. 0 disables.",
      scope: "world", config: true, type: Number,
      range: { min: 0, max: 5, step: 1 }, default: 1
    });
    // SURGE HEAT (2026-10-30, the RFI ruling "C" of 10-29 brought to D&D): banked Surge IS the heat. Full + more
    // arriving = the overheat bite. RFI bites 1 Stress; D&D bites 1 level of Exhaustion (Dave's pick, 10-30).
    game.settings.register(MOD, "overheatBite", {
      name: "Overheat bite (Exhaustion)",
      hint: "When a character's Surge is already full and more arrives in combat, they gain 1 level of Exhaustion — at most once per round, and never past level 3 from Surge alone. Vent (−2 Surge) keeps you out of it.",
      // on by default only in a Bad Eden 5E world — the Kaeron War home game (same module) opts in by hand
      scope: "world", config: true, type: Boolean, default: !!game.modules.get("bad-eden-5e")?.active
    });
    game.settings.register(MOD, "restRefill", {
      name: "Long rest refill",
      hint: "A long rest banks +proficiency Surge, so the economy isn't gated entirely on high rolls.",
      scope: "world", config: true, type: Boolean, default: true
    });
    game.settings.register(MOD, "notify", {
      name: "Gain notifications",
      hint: "Show a toast notification when a character banks Surge.",
      scope: "world", config: true, type: Boolean, default: true
    });
  });

  // ── Pool ───────────────────────────────────────────────────────────────────
  function maxSurge(actor) {
    const override = Number(get(actor, `flags.${MOD}.maxOverride`));
    if (Number.isFinite(override) && override > 0) return override;
    const pb = Number(get(actor, "system.attributes.prof", 2)) || 2;
    return Math.max(4, pb * 2);  // ≈4–12 across levels 1–20
  }
  function getSurge(actor) { return Math.max(0, Math.floor(Number(get(actor, `flags.${MOD}.value`, 0)) || 0)); }

  async function setSurge(actor, n) {
    const v = Math.max(0, Math.min(maxSurge(actor), Math.floor(n)));
    try { await actor.update({ [`flags.${MOD}.value`]: v }); } catch (e) { console.warn(TAG, "setSurge failed", e); }
    // A flag write doesn't always force an open sheet to re-render the header
    // meter — refresh explicitly, including any unlinked-token sheet.
    try {
      if (actor.sheet?.rendered) actor.sheet.render(false);
      for (const t of (actor.getActiveTokens?.() ?? [])) {
        if (t.actor && t.actor !== actor && t.actor.sheet?.rendered) t.actor.sheet.render(false);
      }
    } catch (e) { /* best-effort */ }
    return v;
  }
  // ── Heat ───────────────────────────────────────────────────────────────────
  // Bands scale to the cap exactly as RFI's (_ftHeatBands): Cool < ⌈cap/2⌉ ≤ Stoked < cap ≤ Overheated (= full).
  const HEAT = {
    cool:       { label: "Cool",       color: "#7fb8e8", icon: "❄", tip: "Cool — room to bank. Spend freely, or let it build." },
    stoked:     { label: "Stoked",     color: "#e8a84a", icon: "🔥", tip: "Stoked — half full or more. Spend before it boils over." },
    overheated: { label: "Overheated", color: "#e8604a", icon: "♨", tip: "Overheated — full. Banking more in a fight costs a level of Exhaustion. Spend or Vent." }
  };
  function heat(actor) {
    const cap = maxSurge(actor), value = getSurge(actor), half = Math.ceil(cap / 2);
    const key = value >= cap ? "overheated" : value >= half ? "stoked" : "cool";
    return { cap, value, key, ...HEAT[key], overheated: key === "overheated", pips: Array.from({ length: cap }, (_, i) => i < value) };
  }
  const EXHAUSTION_CAP = 3;
  async function overheatBite(actor) {
    if (!setting("overheatBite", true) || !actor?.isOwner) return false;
    const combat = game.combat;
    if (!combat?.started || !combat.combatants?.some(c => c.actor?.id === actor.id)) return false;   // heat bites in a fight
    const stamp = `${combat.id}:${combat.round}`;
    if (get(actor, `flags.${MOD}.lastBite`) === stamp) return false;                               // once per round
    const ex = Number(get(actor, "system.attributes.exhaustion", 0)) || 0;
    await actor.update({ [`flags.${MOD}.lastBite`]: stamp });
    if (ex >= EXHAUSTION_CAP) {
      ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>♨ <b>${actor.name}</b> is Overheated, but Surge alone won't push Exhaustion past ${EXHAUSTION_CAP}. Spend or Vent.</p>` }).catch(() => {});
      return false;
    }
    await actor.update({ "system.attributes.exhaustion": ex + 1 });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>♨ <b>${actor.name}</b> is Overheated — Surge keeps coming and has nowhere to go. <b>+1 Exhaustion</b> (now ${ex + 1}). Spend Surge or <b>Vent</b> (−2) to cool down.</p>` }).catch(() => {});
    return true;
  }
  /** Vent: shed Surge on purpose (RFI default: an action, −2). */
  async function vent(actor, n = 2) {
    if (!actor) return 0;
    const before = getSurge(actor);
    if (before <= 0) { ui.notifications?.info?.(`${actor.name} has no Surge to vent.`); return 0; }
    const after = await setSurge(actor, before - n);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>💨 <b>${actor.name}</b> vents ${before - after} Surge (uses an action) — ${after}/${maxSurge(actor)}, ${heat(actor).label}.</p>` }).catch(() => {});
    return before - after;
  }

  async function grant(actor, n = 1, { quiet = false, resonance = false, noBite = false } = {}) {
    if (!actor || n <= 0) return getSurge(actor);
    const before = getSurge(actor);
    if (!noBite && before >= maxSurge(actor)) { try { await overheatBite(actor); } catch (e) { console.warn(TAG, "overheat bite failed", e); } }
    const after = await setSurge(actor, before + n);
    if (!quiet && after > before && setting("notify", true))
      ui.notifications?.info?.(`${actor.name}: +${after - before} Surge (${after}/${maxSurge(actor)})`);
    // Path engines listen (the Harmony Marshal's Resonance); `resonance` marks
    // Surge that came FROM a Resonance so it never sets off another one.
    if (after > before) Hooks.callAll("surgePowers.banked", actor, after - before, { resonance });
    return after;
  }

  // ── One acting window ──────────────────────────────────────────────────────
  // Dave and Mags share the Gamemaster login, so "the active GM" can be two
  // browser windows. GM windows heartbeat on the module socket; the lowest
  // window id seen in the last 15 s is the leader, and only the leader runs
  // GM-side work (relayed writes, combat ticks).
  const WINDOW_ID = foundry.utils.randomID();
  const peers = new Map();   // window id → last heartbeat (ms)
  function isLeader() {
    if (!game.user?.isGM || game.users.activeGM?.id !== game.user.id) return false;
    const now = Date.now();
    for (const [id, seen] of peers) {
      if (now - seen > 15000) { peers.delete(id); continue; }
      if (id < WINDOW_ID) return false;
    }
    return true;
  }
  function startHeartbeat() {
    const SOCKET = `module.${MOD}`;
    // 10-29: only a beat the server stamped as coming from this same GM user counts
    // (senderId = Foundry's real sender; a payload userId could be forged by any seat).
    game.socket.on(SOCKET, (msg, senderId) => {
      if (msg?.type === "hb" && senderId === game.user.id && game.users.get(senderId)?.isGM
        && typeof msg.id === "string" && msg.id !== WINDOW_ID) peers.set(msg.id, Date.now());
    });
    if (!game.user.isGM) return;
    const beat = () => game.socket.emit(SOCKET, { type: "hb", id: WINDOW_ID, userId: game.user.id });
    beat();
    setInterval(beat, 5000);
  }
  async function spend(actor, n = 1) {
    if (!actor || n <= 0) return true;
    const cur = getSurge(actor);
    if (cur < n) return false;        // caller decides soft vs hard
    await setSurge(actor, cur - n);
    return true;
  }

  // ── Generation ─────────────────────────────────────────────────────────────
  // Scan the KEPT (active) d20 results of a roll. Only `active` results count,
  // so dnd5e advantage/disadvantage flows in FOR FREE:
  //   • advantage    → keep the HIGHER of 2d20 → more likely ≥ threshold
  //   • disadvantage → keep the LOWER → less likely
  // (A dropped die's 20 doesn't count, same as it doesn't crit.)
  function surgeFromRoll(rollOrRolls) {
    const threshold = Number(setting("threshold", 15)) || 15;
    const rolls = Array.isArray(rollOrRolls) ? rollOrRolls : [rollOrRolls];
    let base = 0, twenties = 0;
    for (const r of rolls) {
      const d20 = r?.dice?.find?.(d => d.faces === 20);
      if (!d20) continue;
      for (const res of (d20.results ?? [])) {
        if (!res?.active) continue;            // only the resolved/kept die
        if (res.result >= threshold) base += 1;
        if (res.result === 20) twenties += 1;  // max → also explodes
      }
    }
    return { base, twenties };
  }
  async function explodeFromRoll(actor, rolls) {
    if (!actor) return;
    const { base, twenties } = surgeFromRoll(rolls);
    let total = base;
    if (setting("explode", true)) {
      for (let i = 0; i < twenties; i++) {     // each nat-20 explodes
        let guard = 0;
        while (guard++ < 12) {                 // chain (capped): +1 per further 20
          const r = await new Roll("1d20").evaluate();
          if (r.total === 20) total += 1; else break;
        }
      }
    }
    if (total > 0) await grant(actor, total);
  }

  function actorFromRollData(data, rolls) {
    return data?.subject?.actor
      ?? (data?.subject instanceof Actor ? data.subject : null)
      ?? data?.actor
      ?? data?.subject?.parent
      ?? (Array.isArray(rolls) ? rolls[0]?.data?.actor : rolls?.data?.actor)
      ?? null;
  }

  // dnd5e 5.x hook names (verified against 5.3.x): saves/checks fire WITHOUT a
  // V2 suffix. Concentration rolls via rollSavingThrow internally, so the save
  // hook already covers it — no rollConcentration listener (would double-bank).
  const ROLL_HOOKS = [
    "dnd5e.rollAttackV2", "dnd5e.rollSavingThrow", "dnd5e.rollAbilityCheck", "dnd5e.rollSkillV2"
  ];

  Hooks.once("ready", () => {
    if (game.system.id !== "dnd5e") return;
    for (const h of ROLL_HOOKS) {
      Hooks.on(h, (rolls, data) => {
        try {
          const actor = actorFromRollData(data, rolls);
          if (actor?.type === "character") explodeFromRoll(actor, rolls);
        } catch (e) { console.warn(TAG, h, "failed", e); }
      });
    }
    // Casting feeds the pool — spell/power users don't make enough d20 rolls
    // for the threshold fill to feed them. Fires on the casting client (which
    // owns the actor). dnd5e 5.x: postUseActivity (the old useItem hook is gone).
    Hooks.on("dnd5e.postUseActivity", (activity) => {
      try {
        const item = activity?.item;
        const actor = item?.actor ?? item?.parent;
        if (actor?.type !== "character") return;
        if (item?.type !== "spell" && item?.type !== "power") return;
        const n = Number(setting("castGain", 2)) || 0;
        if (n > 0) grant(actor, n);
      } catch (e) { console.warn(TAG, "cast gain failed", e); }
    });
    // Combat tick — every character banks Surge when the fight starts. 10-29:
    // combatStart fires ONLY in the window that clicked Begin Combat (not
    // broadcast), so the tick rides the broadcast updateCombat (round → 1, not a
    // step back) and only the leader window applies it; a flag on the combat
    // keeps it single-fire.
    Hooks.on("updateCombat", (combat, changed, options) => {
      try {
        if (changed?.round !== 1 || options?.direction === -1) return;
        if (!isLeader() || combat.getFlag?.(MOD, "ticked")) return;
        const n = Number(setting("combatTick", 1)) || 0;
        if (n <= 0) return;
        combat.setFlag(MOD, "ticked", true).catch(() => {});
        for (const c of (combat?.combatants ?? [])) {
          if (c.actor?.type === "character") grant(c.actor, n);
        }
      } catch (e) { console.warn(TAG, "combat tick failed", e); }
    });
    // A character dropped into an ALREADY-running combat still gets the tick.
    // (Combatants present at combatStart are created while combat.started is
    // still false, so they can't double-dip here.)
    Hooks.on("createCombatant", (combatant) => {
      try {
        if (!isLeader()) return;
        if (!combatant?.combat?.started) return;
        const n = Number(setting("combatTick", 1)) || 0;
        if (n > 0 && combatant.actor?.type === "character") grant(combatant.actor, n);
      } catch (e) { console.warn(TAG, "combat tick (late join) failed", e); }
    });
    Hooks.on("dnd5e.restCompleted", (actor, result) => {
      try {
        if (actor?.type !== "character") return;
        if (!setting("restRefill", true)) return;
        if (result?.longRest === false) return;  // short rest: no baseline refill
        const pb = Number(get(actor, "system.attributes.prof", 2)) || 2;
        grant(actor, pb, { noBite: true });   // a rest never bites
      } catch (e) { /* best-effort */ }
    });
    startHeartbeat();
    game.surgePowers = Object.assign(game.surgePowers || {}, { get: getSurge, max: maxSurge, grant, spend, set: setSurge, isLeader, heat, vent, HEAT });
    console.log(TAG, "Surge runtime ready (threshold fill + explosion + cast gain + combat tick + rest refill)");
  });
})();
