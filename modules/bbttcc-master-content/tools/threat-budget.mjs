/* threat-budget.mjs — the per-tier weapon damage budget for bestiary monsters (owner ruling 2026-10-06: "normalize").
 * ONE source for lint-bestiary (B2), sim-encounter (--normalize) and build-npc-pass1 (the pack fix).
 * Budget = mean of the weapon's dice, faculty excluded (the threat chassis adds tier damage on top).
 * Limited-use weapons (recharge / 1/day / 1/scene / once per) may run ×1.5 over the cap.
 * STRESS-track weapons (psychic / qliphothic damage) may run down to HALF the floor (2026-10-07 tuning pass): a Steward's
 * Stress pool is ~⅓–½ of their Integrity from T2 up, so the same dice on the Stress track hit two to three times as hard —
 * the sim had every multi-strike psychic foe reading TOO HARD at full dice. The cap is unchanged (a nuker may still nuke).
 */
export const STRESS_TYPES = new Set(["psychic", "qliphothic"]);
/** "stress" when a weapon's damage lands on the Stress track (by declared track, else by damage type). */
export const trackOf = w => { const t = String(w?.system?.damage?.track || "").toLowerCase(); if (t) return t === "stress" ? "stress" : "integrity"; return STRESS_TYPES.has(String(w?.system?.damage?.type || "").toLowerCase().split(":")[0]) ? "stress" : "integrity"; };
export const BUDGET = { 1: [3.5, 7], 2: [4.5, 10.5], 3: [7, 14], 4: [10, 20] };
export const LIMITED_RE = /recharge|1\/day|1\/scene|once per/i;
const LADDER = ["1d4", "1d6", "1d8", "1d10", "1d12", "2d6", "2d8", "2d10", "3d8", "2d12", "3d10", "4d8", "3d12", "4d10", "5d8", "4d12"];

export function meanDice(f) {
  let m = 0;
  for (const x of String(f || "").replace(/\s+/g, "").matchAll(/(\d*)d(\d+)/g)) m += Number(x[1] || 1) * (Number(x[2]) + 1) / 2;
  return m;
}
export const budgetFor = (tier, limited = false, track = "integrity") => { const [lo, hi] = BUDGET[tier] ?? BUDGET[1]; return [track === "stress" ? lo / 2 : lo, limited ? hi * 1.5 : hi]; };

/** Clamp a damage formula into the tier budget; keeps a flat "+N" tail. Returns the formula unchanged when in budget. */
export function normalizeDamage(formula, tier, limited = false, track = "integrity") {
  const m = meanDice(formula); if (!m) return formula;
  const [lo, hi] = budgetFor(tier, limited, track);
  if (m >= lo && m <= hi) return formula;
  const flat = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/g, "").replace(/^\+/, "");
  // nearest ladder step INSIDE the budget: the smallest one ≥ lo when raising, the largest one ≤ hi when lowering
  const inBand = LADDER.filter(f => meanDice(f) >= lo && meanDice(f) <= hi).sort((a, b) => meanDice(a) - meanDice(b));
  const best = m < lo ? inBand[0] : inBand[inBand.length - 1];
  return flat && /^[+-]?\d+$/.test(flat) ? `${best}${flat.startsWith("-") ? "" : "+"}${flat}` : best;
}
