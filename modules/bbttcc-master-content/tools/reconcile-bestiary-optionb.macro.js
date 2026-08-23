/**
 * reconcile-bestiary-optionb.macro.js — GM console/macro, run once (idempotent).
 *
 * Owner rulings 2026-08-22 (Option B — "the Body score justifies the HP"):
 *  1. TIER RECONCILE (world npc actors): system.tier is canonical; details.tier
 *     is aligned to it and details.level is moved into the tier's level band
 *     (T1→3, T2→8, T3→13, T4→18) when outside it. The engine derives tracks
 *     from faculties × level, so this is what gives a "T3" monster a T3 pool.
 *  2. SHAPES (world actors' power items): offensive manifestation powers
 *     (damageRoll op "damage", dice > 0) with shape auto/unset become
 *     shape:"save" — psychic→mind, qliphothic/sephirotic→soul, physical→body,
 *     onSave half, save DC via the formula ladder.
 *
 * The same sweep has been applied to packs/_source; compendium LevelDB packs
 * are NOT touched here (pack re-sync is its own stop→rsync→start session).
 * DRY_RUN=true prints what would change; flip to false to apply.
 */
(async () => {
  const DRY_RUN = true;
  const BAND = { 1:[1,5,3], 2:[6,10,8], 3:[11,15,13], 4:[16,99,18] };
  const SAVE_BY_TYPE = { psychic:"mind", qliphothic:"soul", sephirotic:"soul" };
  let tierFixed = 0, shapeFixed = 0;

  for (const a of game.actors.contents) {
    // --- 1. tier/level reconcile (monsters only) ---
    if (a.type === "npc") {
      const sys = a.system?.system ?? a.system ?? {};
      const tSys = Number(sys.tier), tDet = Number(sys.details?.tier), lvl = Number(sys.details?.level);
      const tier = (tSys >= 1 && tSys <= 4) ? tSys : ((tDet >= 1 && tDet <= 4) ? tDet : 1);
      const [lo, hi, mid] = BAND[tier];
      const updates = {};
      if (tSys !== tier) updates["system.tier"] = tier;
      if (tDet !== tier) updates["system.details.tier"] = tier;
      if (!(lvl >= lo && lvl <= hi)) updates["system.details.level"] = mid;
      if (Object.keys(updates).length) {
        tierFixed++;
        console.log(`[optionB] ${a.name}: tier ${tSys}/${tDet} lvl ${lvl} →`, updates);
        if (!DRY_RUN) await a.update(updates);
      }
    }
    // --- 2. offensive power shapes (all actors) ---
    for (const it of a.items ?? []) {
      if (it.type !== "power") continue;
      const s = it.system?.system ?? it.system ?? {};
      const dr = s.damageRoll ?? {};
      if (String(dr.op) !== "damage" || !(Number(dr.number) > 0)) continue;
      const shape = s.manifestation?.resolution?.shape;
      if (shape && shape !== "auto") continue;
      shapeFixed++;
      console.log(`[optionB] ${a.name} › ${it.name}: shape → save vs ${SAVE_BY_TYPE[String(dr.type)] ?? "body"}`);
      if (!DRY_RUN) await it.update({
        "system.manifestation.resolution.shape": "save",
        "system.manifestation.resolution.saveAttribute": SAVE_BY_TYPE[String(dr.type)] ?? "body",
        "system.manifestation.resolution.onSave": s.manifestation?.resolution?.onSave || "half",
        "system.manifestation.resolution.saveDcMode": s.manifestation?.resolution?.saveDcMode || "cast-dc"
      });
    }
  }
  const msg = `[optionB] ${DRY_RUN ? "DRY RUN — " : ""}tier/level reconciled: ${tierFixed} · shapes set: ${shapeFixed}`;
  console.log(msg);
  ui.notifications.info(msg + (DRY_RUN ? " (set DRY_RUN=false to apply)" : ""));
})();
