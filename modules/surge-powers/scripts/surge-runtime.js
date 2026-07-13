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
  async function grant(actor, n = 1, { quiet = false } = {}) {
    if (!actor || n <= 0) return getSurge(actor);
    const before = getSurge(actor);
    const after = await setSurge(actor, before + n);
    if (!quiet && after > before && setting("notify", true))
      ui.notifications?.info?.(`${actor.name}: +${after - before} Surge (${after}/${maxSurge(actor)})`);
    return after;
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

  const ROLL_HOOKS = [
    "dnd5e.rollAttackV2", "dnd5e.rollSavingThrowV2", "dnd5e.rollAbilityCheckV2",
    "dnd5e.rollSkillV2", "dnd5e.rollAbilityTestV2", "dnd5e.rollConcentrationV2"
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
    Hooks.on("dnd5e.restCompleted", (actor, result) => {
      try {
        if (actor?.type !== "character") return;
        if (!setting("restRefill", true)) return;
        if (result?.longRest === false) return;  // short rest: no baseline refill
        const pb = Number(get(actor, "system.attributes.prof", 2)) || 2;
        grant(actor, pb);
      } catch (e) { /* best-effort */ }
    });
    game.surgePowers = Object.assign(game.surgePowers || {}, { get: getSurge, max: maxSurge, grant, spend, set: setSurge });
    console.log(TAG, "Surge runtime ready (threshold fill + explosion + rest refill)");
  });
})();
