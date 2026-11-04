// Shared by the repo script and the in-world macro's logic: scale a stamped gear price from the old tier base to GEAR_TIER_BASE_MARKS.
export const RUBRIC = "gear-2026-11-03";
export const RATIO = { II: 60 / 150, III: 70 / 450, IV: 85 / 1350 };
const SKIP_FRAMES = new Set(["vehicle", "material", "trade-good"]);
const GEAR_TYPES = new Set(["weapon", "armor", "gear", "consumable", "equipment", "tool", "container"]);
const five = n => Math.max(5, Math.round(n / 5) * 5);
export function reprice(doc) {
  const it = doc?.flags?.fourththing?.rfi?.item, p = it?.price;
  if (!p || !GEAR_TYPES.has(doc.type) || p.gmOverride || p.rubric === RUBRIC || SKIP_FRAMES.has(String(it.frame || "")) || !RATIO[it.tier]) return null;
  const r = RATIO[it.tier], marks = five((Number(p.marks) || 0) * r);
  const next = { ...p, marks, rubric: RUBRIC, saleBack: it.bound === "soulbound" ? 0 : Math.floor(marks * 0.4) };
  if (p.split && typeof p.split === "object") { next.split = Object.fromEntries(Object.entries(p.split).map(([k, v]) => [k, five((Number(v) || 0) * r)])); }
  return next;
}
