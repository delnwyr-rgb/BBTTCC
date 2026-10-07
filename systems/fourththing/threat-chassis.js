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
 *   • defense  flat Guard / Evasion / Resolve
 *   • pool     × Integrity and Stress max, by bracket
 *   • strikes  Strikes per round, by bracket (the GM spends them; foes aren't gated)
 *   • legendary legendary actions per round, by bracket (bosses at EVERY tier — ruled 2026-10-06)
 * Targets (ruled 2026-10-06): 3 lights vs 1 Steward = fair · medium vs 1 Steward = fair, 3–4 rounds ·
 * heavy = take a partner · boss = full party, someone likely drops ("mob and pitchfork time").
 * Tuned against four kitted Steward paths with bin/ft-sim-encounter --chassis (v1 = tuning run "c4").
 * Retune HERE only — the sim reads the same numbers via --chassis.
 *
 * Who: actorKind(actor) === "monster" (lineage/bestiary-flagged). Named NPCs (type character +
 * entityKind npc) level like Stewards and are NOT chassis'd. World setting `threatChassis` turns it off.
 */

export const THREAT_CHASSIS = {
  version: 1,
  //            T1 T2 T3 T4
  attack:     [ 0, 3, 4, 4 ],
  damage:     [ 0, 3, 4, 5 ],
  defense:    [ 0, 3, 5, 5 ],
  rank:       [ 2, 4, 5, 5 ],
  mobSize: 3,
  bracket: {
    light:  { pool: [0.6, 0.6, 0.6, 0.6], strikes: [1, 1, 1, 2], legendary: [0, 0, 0, 0] },
    medium: { pool: [2,   1.5, 1.5, 1.5], strikes: [1, 2, 2, 3], legendary: [0, 0, 0, 0] },
    heavy:  { pool: [3,   3,   3,   3  ], strikes: [2, 2, 3, 3], legendary: [0, 0, 0, 0] },
    boss:   { pool: [5,   5,   5,   4  ], strikes: [2, 3, 3, 3], legendary: [1, 1, 1, 2] }
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
    pool: B.pool[t], strikes: B.strikes[t], legendary: B.legendary[t]
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
