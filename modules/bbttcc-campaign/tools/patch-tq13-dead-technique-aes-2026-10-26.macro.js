/* patch-tq13-dead-technique-aes-2026-10-26.macro.js — ruling TQ13 (Content Audit 2026-10-25, Dave 10-26). Run in BOTH worlds.
 *  Fluid Footwork and Grim Persistence shipped with two dnd5e Active Effects that fourththing never reads
 *  (`system.attributes.movement.walk +10`, `system.attributes.hp.bonuses.level +2` — the template has neither key; the
 *  mechanics are id-keyed in the derive: FT_FEAT_MOVE_GRANTS and the +2 × level Integrity bump). The pack copies lose them
 *  through TQ_items.json; this removes the same two AEs from every world actor's embedded copy (Brexit the Terrible, Garren).
 *  Keyed by technique identifier + the AE's change key, so a re-imported copy is caught too. Idempotent: rerun → 0 changes.
 *  DRY_RUN default true; GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const DEAD = {
    bbttcc_feat_fluid_footwork:   "system.attributes.movement.walk",
    bbttcc_feat_grim_persistence: "system.attributes.hp.bonuses.level"
  };
  const report = []; let changes = 0, scanned = 0;
  for (const actor of game.actors) {
    for (const it of actor.items) {
      const key = DEAD[String(it.system?.identifier ?? "")]; if (!key) continue;
      scanned++;
      const dead = it.effects.filter(e => (e.system?.changes ?? e.changes ?? []).some(c => String(c?.key ?? "") === key)).map(e => e.id);
      if (!dead.length) { report.push(`· ok ${actor.name} · ${it.name}: no dead AE`); continue; }
      changes += dead.length;
      report.push(`✚ ${actor.name} · ${it.name}: delete AE ${dead.join(", ")}`);
      if (!DRY_RUN) await it.deleteEmbeddedDocuments("ActiveEffect", dead);
    }
  }
  const line = `patch-tq13 ${DRY_RUN ? "(DRY RUN)" : "(APPLIED)"} — ${scanned} technique copies scanned · ${changes} dead AE${changes === 1 ? "" : "s"}${DRY_RUN ? " would be" : ""} removed`;
  console.log(line + "\n" + report.join("\n"));
  ui.notifications.info(line + (DRY_RUN ? " — set DRY_RUN=false to apply." : ""));
})();
