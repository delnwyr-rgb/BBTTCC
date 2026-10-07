/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · mastery.js — Mastery (the RFI "mastery" aptitude rank, D&D-ified)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ruling (Dave, 2026-10-07): Mastery = reliable talent for that one skill or tool.
 * On a check with it, a d20 result of 9 or lower counts as 10.
 *
 * A feature grants it with a transfer Active Effect:
 *   flags.bad-eden-5e.mastery.<skillKey|toolId>  OVERRIDE  1     (e.g. mastery.ste, mastery.tinker)
 *   flags.bad-eden-5e.mastery.all                OVERRIDE  1     (every skill and tool)
 * dnd5e already implements the floor as the roll option `reliableTalent`; we set it
 * on the roll when the flag matches.
 * ───────────────────────────────────────────────────────────────────────────── */
import { MOD } from "./casting.js";

const apply = (type) => (config) => {
  const actor = config?.subject;
  const key = type === "skill" ? config?.skill : config?.tool;
  if (!actor || !key) return;
  const mastery = foundry.utils.getProperty(actor, `flags.${MOD}.mastery`) ?? {};
  if (!(mastery[key] || mastery.all)) return;
  config.reliableTalent = true;
  for (const r of config.rolls ?? []) { r.options ??= {}; r.options.reliableTalent = true; }
};

export function activateMastery() {
  Hooks.on("dnd5e.preRollSkillV2", apply("skill"));
  Hooks.on("dnd5e.preRollToolV2", apply("tool"));
}
