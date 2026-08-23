/**
 * migrate-armor-skill-rename.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Owner rename 2026-08-22: weave → fitting (light armor), warding → bracing
 * (medium armor). Template + code + pack _source are done; this migrates the
 * LIVE WORLD so nobody's trained ranks vanish:
 *   · Actors: copy system.skills.weave/warding values into fitting/bracing
 *     (keeps the higher value if both exist; old keys left as inert residue).
 *   · Items (world + embedded): system.armorSkill "weave"/"warding" → new.
 *   · ActiveEffects (actors + items): change keys system.skills.weave.* /
 *     .warding.* → the new keys.
 * Legacy reads keep working regardless (FT.LEGACY_SKILL_ALIASES), so running
 * this is about sheet display + future writes, not about un-breaking anything.
 */
(async () => {
  const DRY_RUN = true;
  const MAP = { weave: "fitting", warding: "bracing" };
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  let actorsFixed = 0, itemsFixed = 0, aesFixed = 0;

  const fixAEs = async (doc, label) => {
    for (const ae of doc.effects ?? []) {
      const changes = foundry.utils.duplicate(ae.changes ?? []);
      let touched = false;
      for (const ch of changes) {
        for (const [oldK, newK] of Object.entries(MAP)) {
          const pat = `system.skills.${oldK}.`;
          if (String(ch.key || "").includes(pat)) { ch.key = ch.key.replace(pat, `system.skills.${newK}.`); touched = true; }
        }
      }
      if (touched) {
        aesFixed++;
        console.log(`[rename] AE "${ae.name}" on ${label}`);
        if (!DRY_RUN) await ae.update({ changes });
      }
    }
  };

  for (const a of game.actors.contents) {
    const sys = a.system?.system ?? a.system ?? {};
    const updates = {};
    for (const [oldK, newK] of Object.entries(MAP)) {
      const oldV = Number(sys.skills?.[oldK]?.value ?? 0);
      const newV = Number(sys.skills?.[newK]?.value ?? 0);
      if (oldV > 0 && oldV > newV) updates[`system.skills.${newK}.value`] = oldV;
    }
    if (Object.keys(updates).length) {
      actorsFixed++;
      console.log(`[rename] ${a.name}:`, updates);
      if (!DRY_RUN) await a.update(updates);
    }
    await fixAEs(a, a.name);
    for (const it of a.items ?? []) {
      const decl = String(it.system?.armorSkill || "");
      if (MAP[decl]) {
        itemsFixed++;
        console.log(`[rename] ${a.name} › ${it.name}: armorSkill ${decl} → ${MAP[decl]}`);
        if (!DRY_RUN) await it.update({ "system.armorSkill": MAP[decl] });
      }
      await fixAEs(it, `${a.name} › ${it.name}`);
    }
  }
  for (const it of game.items.contents) {
    const decl = String(it.system?.armorSkill || "");
    if (MAP[decl]) {
      itemsFixed++;
      console.log(`[rename] world item ${it.name}: armorSkill ${decl} → ${MAP[decl]}`);
      if (!DRY_RUN) await it.update({ "system.armorSkill": MAP[decl] });
    }
    await fixAEs(it, `world item ${it.name}`);
  }
  const msg = `[rename] ${DRY_RUN ? "DRY RUN — " : ""}actors: ${actorsFixed} · items: ${itemsFixed} · AEs: ${aesFixed}`;
  console.log(msg);
  ui.notifications.info(msg + (DRY_RUN ? " (set DRY_RUN=false to apply)" : ""));
})();
