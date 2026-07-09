/**
 * Repair — "Aptitude capped at rank 1 / can't be raised on the sheet."
 *
 * ROOT CAUSE (found 2026-06-16, world roll-for-initiation-bad-eden):
 *   Crew-Type and Archetype proficiency grants ("<Crew> T1 Skills",
 *   "Crew Type Tier 1 Proficiencies", "Archetype Tier 1 Proficiencies") were
 *   authored as Active-Effect changes of type "downgrade" with value 1 on
 *   `system.skills.<key>.value`.
 *
 *   In Foundry v14, change type "downgrade" means "cap the value at no MORE
 *   than this" (min(current, value)). So a downgrade-to-1 FORCES the skill to
 *   rank 1: the player can edit the stored base rank (pips / number input write
 *   fine — e.g. Thaarlbriindt's Athletics base was raised to 2), but the
 *   downgrade effect caps the effective/displayed value straight back to 1.
 *   Net effect: the aptitude looks "stuck at 1" and refuses to go up.
 *
 *   A proficiency grant should FLOOR the skill ("at least rank 1"), which is
 *   change type "upgrade" (max(current, value)) — never "downgrade".
 *
 * FIX: flip every `system.skills.*.value` change of type "downgrade" to
 *   "upgrade" on all actors' effects and their embedded items' transfer
 *   effects. Idempotent — re-running finds nothing once clean.
 *
 * Foundry v14.364 note: AE changes live at `system.changes`, each keyed by the
 *   string `type` ("add"|"upgrade"|"downgrade"|"override"|"multiply"|custom).
 *   The numeric `mode` is a deprecated shim getter — we write `type` only.
 *
 * GM-only. Run from the macro hotbar; reopen character sheets afterward.
 */
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("Repair Aptitude Grants — GM only.");

  const SKILL_RE = /^system\.skills\.[^.]+\.value$/;
  let actorsTouched = 0, effectsFixed = 0, changesFixed = 0;
  const log = [];

  const fixEffect = async (effect, ownerLabel) => {
    const changes = effect.changes ?? [];
    let dirty = false;
    const next = changes.map((c) => {
      const clone = foundry.utils.deepClone(c);
      if (SKILL_RE.test(String(clone.key || "")) && clone.type === "downgrade") {
        dirty = true;
        changesFixed++;
        clone.type = "upgrade";
        delete clone.mode; // never persist the deprecated numeric shim
      }
      return clone;
    });
    if (dirty) {
      await effect.update({ "system.changes": next });
      effectsFixed++;
      log.push(`${ownerLabel}: "${effect.name}"`);
    }
    return dirty;
  };

  for (const actor of game.actors.contents) {
    let touched = false;
    for (const effect of actor.effects.contents) {
      if (await fixEffect(effect, actor.name)) touched = true;
    }
    for (const item of actor.items.contents) {
      for (const effect of item.effects.contents) {
        if (await fixEffect(effect, `${actor.name} ▸ ${item.name}`)) touched = true;
      }
    }
    if (touched) actorsTouched++;
  }

  console.log("[repair-aptitude-grants]", { actorsTouched, effectsFixed, changesFixed }, log);
  ui.notifications.info(
    `Aptitude repair: flipped ${changesFixed} grant change(s) downgrade→upgrade ` +
    `on ${effectsFixed} effect(s) across ${actorsTouched} actor(s). Reopen sheets to confirm.`
  );
})();
