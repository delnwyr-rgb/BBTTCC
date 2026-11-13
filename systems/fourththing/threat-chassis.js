/**
 * THREAT CHASSIS — how a bestiary monster scales with its tier and bracket (owner ruling 2026-10-06).
 * ----------------------------------------------------------------------------------------------------
 * Why: NPC derived stats are recomputed from faculties + level every prepare, so the builder's stored
 * Integrity/Guard never reached play and the bracket (light/medium/heavy/boss) meant nothing. Stewards
 * meanwhile gain a faculty per level, aptitude ranks, and tier-many Strikes (striker paths) — every
 * monster at every tier was a pushover (bin/ft-sim-encounter, 2026-10-06).
 *
 * What: a monster keeps its AUTHORED faculties (its shape — what it's good at). The chassis layers on
 *   • attack   flat to-hit, on top of faculty + foe tier bonus          (a Steward's levels, folded)
 *   • rank     innate aptitude rank for its strikes — shapes the dice    (2 reroll-lowest · 4+ 3d10kh2)
 *   • damage   flat damage on a weapon hit
 *   • defense  flat Guard / Resolve (Evasion retired 2026-11-11 — a creature's would-be Evasion folds into Guard, higher wins)
 *   • pool     × Integrity and Stress max, by bracket
 *   • strikes  Strikes per round, by bracket (the GM spends them; foes aren't gated)
 *   (legendary actions RETIRED 2026-11-12 — Dave: "There are no legendary actions"; nothing ever read the row)
 * Targets (ruled 2026-10-06): 3 lights vs 1 Steward = fair · medium vs 1 Steward = fair, 3–4 rounds ·
 * heavy = take a partner · boss = full party, someone likely drops ("mob and pitchfork time").
 * SUPERSEDED 2026-11-12 (Dave: "fair" = CR — a CR N foe is an average fight for 4 level-N Stewards). Creature audit
 * GM rule: points light 1 · medium 2 · heavy 4 · boss 8; tier anchor level T1 3 · T2 8 · T3 13 · T4 18; average fight =
 * 8 points of the party's tier at the anchor, +1 per party level above / −1 below; ½ = trivial, ×1.5 = hard, ×2 = deadly;
 * one tier down counts half, never a tier up. Average = win ≥95%, someone drops 15–35%, 3–5 rounds (balanced party).
 * Tuned against four kitted Steward paths with bin/ft-sim-encounter --chassis (v1 = tuning run "c4");
 * retuned (combat balance 2026-11-12) with bin/ft-sim-combat (final package, N=2000).
 * Retune HERE only — bin/ft-sim-combat imports this table as its CONFIG.chassis default.
 *
 * Who: actorKind(actor) === "monster" (lineage/bestiary-flagged). Named NPCs (type character +
 * entityKind npc) level like Stewards and are NOT chassis'd. World setting `threatChassis` turns it off.
 */

export const THREAT_CHASSIS = {
  version: 3,   // 3 = creature audit CR retune 2026-11-12 (one boss = average fight for 4 Stewards at the tier anchor 3/8/13/18)
  // Retuned (combat balance 2026-11-12): was attack [0,3,4,4] damage [0,3,4,5] defense [0,3,5,5]
  // rank [2,4,5,5], medium pool [2,1.5,1.5,1.5] strikes [1,2,2,3], heavy pool [3,3,3,3] strikes [2,2,3,3].
  // Smooths the L6/L11/L16 tier-entry cliffs (monsters are built at L8/13/18, so the old defense row
  // stacked a second jump on the builder's). rank 5 → 4 at T3/T4 removes the free Legendary rescue
  // (_legendaryCanSave); attack carries a +1 refund at T3/T4 for it. Sim: bin/ft-sim-combat.
  //            T1 T2 T3 T4
  attack:     [ 0, 0, 2, 3 ],
  damage:     [ 0, 2, 3, 3 ],   // T4 5 → 3: T4 fights ended in ~2 rounds; pools carry T4 instead
  defense:    [ 0, 1, 2, 3 ],
  rank:       [ 2, 4, 4, 4 ],
  mobSize: 3,
  bracket: {
    // Encounter points (CR budget): light 1 · medium 2 · heavy 4 · boss 8; 8 points = average fight for 4 Stewards at the tier anchor.
    light:  { pool: [0.6, 0.6, 0.4, 0.5 ], strikes: [1, 1, 1, 2] },
    medium: { pool: [2,   1.5, 1.75, 1.25], strikes: [1, 1, 1, 2] },
    heavy:  { pool: [3,   1.5, 1.5, 1.75], strikes: [2, 2, 2, 3] },
    boss:   { pool: [3,   3.5, 3,   5   ], strikes: [2, 2, 2, 2] }
  }
};

/**
 * ENCOUNTER BUDGET — the GM's signifier (creature audit, Dave 2026-11-12: "fair" = CR; a CR N foe is an average
 * fight for 4 level-N Stewards). Points by bracket; each tier has an anchor level (its boss's CR). An average fight
 * for 4 Stewards of level L = 8 points of L's tier, +1 per level above the anchor / −1 below, × Stewards ÷ 4.
 * ½ the budget = trivial · ×1.5 = hard · ×2 = deadly. One tier down counts half (per tier); a tier UP is off the
 * chart (never use). Lights past 8 count ×1.5. A monster may print its own value: flags.fourththing.rfi.actor.points
 * (Tor-Wrath = 2). Measured with the creature-audit sim (balanced party, N=3000) — see threat-chassis v3 above.
 */
export const ENCOUNTER = {
  points: { light: 1, medium: 2, heavy: 4, boss: 8 },
  anchor: [3, 8, 13, 18],
  base: 8,
  pointsFor(actor, bracket) {
    const o = Number(actor?.flags?.fourththing?.rfi?.actor?.points);
    return (Number.isFinite(o) && o > 0) ? o : (this.points[bracket] ?? 2);
  },
  /** Budget for an average fight: party level (avg), party size. */
  budget(level, size = 4) {
    const L = Math.max(1, Math.min(20, Math.round(Number(level) || 1)));
    const t = L <= 5 ? 0 : L <= 10 ? 1 : L <= 15 ? 2 : 3;
    return { tier: t + 1, anchor: this.anchor[t], points: Math.max(1, (this.base + (L - this.anchor[t])) * (Math.max(1, size) / 4)) };
  },
  /** foes: [{ tier, bracket, points }]; party: { level, size }. → { spent, budget, ratio, band, overTier, notes } */
  rate(foes, party) {
    const B = this.budget(party?.level, party?.size);
    let spent = 0, lights = 0, overTier = 0;
    for (const f of foes ?? []) {
      let p = Number(f.points) || this.points[f.bracket] || 2;
      const d = (Number(f.tier) || 1) - B.tier;
      if (d > 0) { overTier++; }
      else if (d < 0) p = p / Math.pow(2, -d);
      if (f.bracket === "light" && d === 0 && ++lights > 8) p *= 1.5;
      spent += p;
    }
    const ratio = spent / B.points;
    const band = overTier ? "deadly" : ratio < 0.625 ? "trivial" : ratio < 1.25 ? "average" : ratio < 1.75 ? "hard" : "deadly";
    return { spent: Math.round(spent * 10) / 10, budget: Math.round(B.points * 10) / 10, ratio, band, overTier, tier: B.tier, anchor: B.anchor };
  }
};

const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
/** Legacy bracket words → chassis bracket. "elite" was the summer-2026 hand-authored tag. */
const BRACKET_ALIAS = { elite: "heavy", minion: "light", standard: "medium" };

/** True when the world wants the chassis applied (default on; safe before settings exist). */
export function threatChassisEnabled() {
  try { return game.settings.get("fourththing", "threatChassis") !== false; } catch (_e) { return true; }
}

export function registerThreatChassisSetting() {
  game.settings.register("fourththing", "threatChassis", {
    name: "Threat chassis for bestiary monsters",
    hint: "Monsters scale with tier and bracket (light/medium/heavy/boss): extra to-hit, damage, defenses, pools and Strikes. Off = raw authored faculties only (pre-2026-10-06 behaviour).",
    scope: "world", config: true, type: Boolean, default: true,
    onChange: () => { for (const a of game.actors ?? []) a.reset?.(); }
  });
}

/**
 * The chassis row for a monster, or null when it isn't one / the chassis is off.
 * @param {Actor} actor
 * @param {(a:Actor)=>string} actorKind  injected to avoid an import cycle
 */
export function threatFor(actor, actorKind) {
  if (!actor || !threatChassisEnabled()) return null;
  let kind = ""; try { kind = actorKind(actor); } catch (_e) { return null; }
  if (kind !== "monster") return null;
  const rfi = actor.flags?.fourththing?.rfi?.actor ?? {};
  const sys = actor.system?.system ?? actor.system ?? {};
  const tier = Math.max(1, Math.min(4, ROMAN[rfi.tier] || Number(rfi.tier) || Number(sys.details?.tier) || 1));
  const raw = String(rfi.bracket || "medium").toLowerCase();
  const bracket = THREAT_CHASSIS.bracket[raw] ? raw : (BRACKET_ALIAS[raw] || "medium");
  const C = THREAT_CHASSIS, B = C.bracket[bracket], t = tier - 1;
  return {
    version: C.version, tier, bracket,
    attack: C.attack[t], damage: C.damage[t], defense: C.defense[t], rank: C.rank[t],
    pool: B.pool[t], strikes: B.strikes[t],
    points: ENCOUNTER.pointsFor(actor, bracket), anchor: ENCOUNTER.anchor[t]
  };
}

/**
 * Fresh monsters start FULL. The chassis raises (or lowers) max at prepare time, but a monster's stored
 * current Integrity/Stress is whatever the builder wrote — a newly placed token would read 25/38 and look
 * pre-damaged (this already bit the pack before the chassis: Aggressive Sapling Kiddo ran 28/100).
 * Only on CREATION (new token placed / actor imported) by the creating client — never mid-fight.
 */
export function registerThreatChassisHooks() {
  const fill = async (actor) => {
    const d = actor?.system?.derived;
    if (!d?.threat) return;
    const upd = {};
    if (d.integrity && Number(d.integrity.value) < Number(d.integrity.max)) upd["system.derived.integrity.value"] = d.integrity.max;
    if (d.stress && Number(d.stress.value) < Number(d.stress.max)) upd["system.derived.stress.value"] = d.stress.max;
    if (Object.keys(upd).length) await actor.update(upd);
  };
  Hooks.on("createToken", (tokenDoc, _opts, userId) => {
    if (userId !== game.user?.id || tokenDoc.actorLink) return;
    fill(tokenDoc.actor).catch(e => console.warn("[fourththing] threat chassis token fill failed", e));
  });
  Hooks.on("createActor", (actor, _opts, userId) => {
    if (userId !== game.user?.id) return;
    fill(actor).catch(e => console.warn("[fourththing] threat chassis actor fill failed", e));
  });
}
