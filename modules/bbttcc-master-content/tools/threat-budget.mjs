/* threat-budget.mjs — the per-tier weapon damage budget for bestiary monsters (owner ruling 2026-10-06: "normalize").
 * ONE source for lint-bestiary (B2), sim-encounter (--normalize) and build-npc-pass1 (the pack fix).
 * Budget = mean of the weapon's dice, faculty excluded (the threat chassis adds tier damage on top).
 * Limited-use weapons (recharge / 1/day / 1/scene / once per) may run ×1.5 over the cap.
 */
export const BUDGET = { 1: [3.5, 7], 2: [4.5, 10.5], 3: [7, 14], 4: [10, 20] };
export const LIMITED_RE = /recharge|1\/day|1\/scene|once per/i;
const LADDER = ["1d4", "1d6", "1d8", "1d10", "1d12", "2d6", "2d8", "2d10", "3d8", "2d12", "3d10", "4d8", "3d12", "4d10", "5d8", "4d12"];

export function meanDice(f) {
  let m = 0;
  for (const x of String(f || "").replace(/\s+/g, "").matchAll(/(\d*)d(\d+)/g)) m += Number(x[1] || 1) * (Number(x[2]) + 1) / 2;
  return m;
}
export const budgetFor = (tier, limited = false) => { const [lo, hi] = BUDGET[tier] ?? BUDGET[1]; return [lo, limited ? hi * 1.5 : hi]; };

/** Clamp a damage formula into the tier budget; keeps a flat "+N" tail. Returns the formula unchanged when in budget. */
export function normalizeDamage(formula, tier, limited = false) {
  const m = meanDice(formula); if (!m) return formula;
  const [lo, hi] = budgetFor(tier, limited);
  if (m >= lo && m <= hi) return formula;
  const flat = String(formula).replace(/\s+/g, "").replace(/(\d*)d(\d+)/g, "").replace(/^\+/, "");
  // nearest ladder step INSIDE the budget: the smallest one ≥ lo when raising, the largest one ≤ hi when lowering
  const inBand = LADDER.filter(f => meanDice(f) >= lo && meanDice(f) <= hi).sort((a, b) => meanDice(a) - meanDice(b));
  const best = m < lo ? inBand[0] : inBand[inBand.length - 1];
  return flat && /^[+-]?\d+$/.test(flat) ? `${best}${flat.startsWith("-") ? "" : "+"}${flat}` : best;
}
