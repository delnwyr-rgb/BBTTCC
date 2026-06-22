/**
 * Fix Aptitude Grants — EVERYWHERE (actors + compendium packs), live, no restart.
 *
 * ROOT CAUSE (recurring "aptitude stuck at rank 1 / can't be raised"):
 *   Crew-type and archetype grants ("<Crew> T1 Skills", "Archetype Tier 1
 *   Proficiencies", etc.) ship Active-Effect changes of type "downgrade" value 1
 *   on `system.skills.<key>.value`. In Foundry v14 "downgrade" = min(current,
 *   value) → it CAPS the aptitude at 1 instead of FLOORING it. A proficiency
 *   grant must be "upgrade" (max(current, value)).
 *
 *   The Character Wizard re-imports these straight from the still-dirty
 *   compendium on every new build, so fixing only actors never sticks. This
 *   macro flips BOTH the live actors AND the two source compendium packs
 *   (character-archetypes, crew-types) so the data itself is correct.
 *
 *   A creation-time guard in bbttcc-auto-link/scripts/character-wizard.js now
 *   also normalizes downgrade→upgrade on any future item/effect creation, so
 *   this is belt-and-suspenders + data hygiene.
 *
 * Idempotent. GM-only. Edits compendium packs through the API (safe while the
 * world runs — no pm2 stop). Run once per running instance (ember, then foundry).
 */
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("Fix Aptitude Grants — GM only.");

  const SKILL_RE = /^system\.skills\.[^.]+\.value$/;
  const PACK_IDS = [
    "bbttcc-character-options.character-archetypes",
    "bbttcc-character-options.crew-types",
  ];

  // Returns {next, dirty}: a changes array with skill-value "downgrade" → "upgrade".
  const normalize = (changes) => {
    let dirty = false;
    const next = (changes ?? []).map((c) => {
      const x = foundry.utils.deepClone(c);
      if (SKILL_RE.test(String(x.key || "")) && x.type === "downgrade") {
        dirty = true; x.type = "upgrade"; delete x.mode;
      }
      return x;
    });
    return { next, dirty };
  };

  const fixEffect = async (effect) => {
    const { next, dirty } = normalize(effect.changes);
    if (dirty) await effect.update({ "system.changes": next });
    return dirty;
  };

  // ── 1) All world actors (and their embedded item effects) ──────────────────
  let aActors = 0, aEffects = 0;
  for (const actor of game.actors.contents) {
    let touched = false;
    for (const e of actor.effects.contents) if (await fixEffect(e)) { aEffects++; touched = true; }
    for (const it of actor.items.contents)
      for (const e of it.effects.contents) if (await fixEffect(e)) { aEffects++; touched = true; }
    if (touched) aActors++;
  }

  // ── 2) Source compendium packs ─────────────────────────────────────────────
  let pEffects = 0;
  const packReport = [];
  for (const id of PACK_IDS) {
    const pack = game.packs.get(id);
    if (!pack) { packReport.push(`${id}: NOT FOUND`); continue; }
    const wasLocked = pack.locked;
    try {
      if (wasLocked) await pack.configure({ locked: false });
      let n = 0;
      const docs = await pack.getDocuments();
      for (const doc of docs)
        for (const e of doc.effects) if (await fixEffect(e)) { n++; pEffects++; }
      packReport.push(`${pack.metadata.label}: ${n} effect(s) fixed (${docs.length} docs)`);
    } catch (err) {
      packReport.push(`${id}: ERROR ${err.message}`);
      console.error("[fix-aptitude-everywhere]", id, err);
    } finally {
      if (wasLocked) await pack.configure({ locked: true });
    }
  }

  console.log("[fix-aptitude-everywhere]", { aActors, aEffects, pEffects, packReport });
  ui.notifications.info(
    `Aptitude fix complete — actors: ${aEffects} effect(s) on ${aActors} actor(s); ` +
    `packs: ${pEffects} effect(s). See console for per-pack detail. Reopen sheets to confirm.`
  );
})();
