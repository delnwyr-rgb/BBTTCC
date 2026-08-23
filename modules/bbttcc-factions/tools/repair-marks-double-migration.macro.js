/**
 * repair-marks-double-migration.macro.js — GM console/macro, run once per victim.
 *
 * Repairs a faction whose opBank/opCaps were ×10-inflated by the marks
 * migration re-running on a post-migration (marks-native) actor — the
 * "phantom 298-OP treasury" (root-caused 2026-08-22; op-engine now carries an
 * epoch guard so this cannot recur).
 *
 * What it does: divides every opBank + opCaps bucket (and opCapPer, if set)
 * by 10, rounds, and stamps opBankMarksMigrated so no sweep touches it again.
 * Spends made while inflated can't be perfectly unwound — eyeball the result
 * and hand-adjust any bucket that looks off.
 *
 * Usage:  set NAME, paste into the GM console (or run as a script macro).
 */
(async () => {
  const NAME = "The Errata Society";           // ← faction to repair
  const MOD = "bbttcc-factions";
  const a = game.actors.getName(NAME);
  if (!a) return ui.notifications.error(`No actor named "${NAME}"`);
  const f = foundry.utils.duplicate(a.flags?.[MOD] ?? {});
  const div = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, Math.round((Number(v) || 0) / 10)]));
  const updates = { [`flags.${MOD}.opBankMarksMigrated`]: true };
  if (f.opBank) updates[`flags.${MOD}.opBank`] = div(f.opBank);
  if (f.opCaps) updates[`flags.${MOD}.opCaps`] = div(f.opCaps);
  if (Number(f.opCapPer) > 0) updates[`flags.${MOD}.opCapPer`] = Math.round(Number(f.opCapPer) / 10);
  console.log(`[repair] ${NAME} before:`, JSON.stringify({ opBank: f.opBank, opCaps: f.opCaps, opCapPer: f.opCapPer }));
  await a.update(updates, { diff: true, recursive: true });
  const after = a.flags?.[MOD] ?? {};
  console.log(`[repair] ${NAME} after:`, JSON.stringify({ opBank: after.opBank, opCaps: after.opCaps, opCapPer: after.opCapPer }));
  ui.notifications.info(`${NAME}: opBank/opCaps divided by 10 and stamped migrated. Check the sheet.`);
})();
