/* bbttcc-factions · tools/reseat-dnd5e-rig-defenses.macro.js — ONE-SHOT, dnd5e worlds only (D&D port review C17/C20/C25, 2026-10-31)
 *
 * Re-seats every existing D&D rig (vehicle + flags.bbttcc-factions.rig) onto the rules the code now enforces:
 *   AC      system.attributes.ac.flat = AC_BY_BRACKET[bracket] + tier (game.bbttcc.rigs.acFor) and ac.calc "flat" —
 *           every rig minted before 10-31 sat at AC 0 / null, re-framed rigs kept the old bracket's AC
 *   HP      a 0/0 hull (a mecha vehicle "initialised as rig" had no HP row) gets HP_BY_BRACKET
 *   DT      a missing damage threshold gets DT_BY_BRACKET (never clobbers an authored one)
 *   tier    mecha 0–5 / otherwise 1–4 (the Rig tab used to write out-of-range values)
 *   heat    flags.bbttcc-factions.combat.heat clamped to 0..heatMax (2 + tier × 2) — a locked "overheated" mech cools off
 *   order   the retired dnd5e-only ORDERS flag is reset to "none" (ignored by the code either way)
 *   crew    stewards whose boardedRig flag points at a rig that no longer exists step off (sweepOrphanCrew)
 * Idempotent: re-run reports 0 changes. GM only. Paste into a script macro and run.
 */
(async () => {
  const TAG = "[reseat-dnd5e-rig-defenses]";
  if (game.system.id !== "dnd5e") return ui.notifications.warn(`${TAG} dnd5e worlds only.`);
  if (!game.user.isGM) return ui.notifications.warn(`${TAG} GM only.`);
  const R = game.bbttcc?.rigs;
  if (!R?.acFor || !R?.AC_BY_BRACKET) return ui.notifications.error(`${TAG} game.bbttcc.rigs.acFor missing — deploy bbttcc-core/scripts/rigs.js + economy.constants.js first.`);
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const rows = []; let changed = 0;
  for (const rig of R.list()) {
    const d = R.data(rig); if (!d) continue;
    const bracket = String(d.integrity.bracket || "medium").toLowerCase();
    const mecha = bracket === "mecha";
    const tier = Math.max(mecha ? 0 : 1, Math.min(mecha ? 5 : 4, Math.floor(num(d.integrity.tier, mecha ? 0 : 1))));
    const upd = {}; const notes = [];
    if (tier !== num(d.integrity.tier, 1)) { upd["flags.bbttcc-factions.rig.tier"] = tier; notes.push(`tier ${d.integrity.tier} → ${tier}`); }
    const wantAc = R.acFor(bracket, tier);
    const haveAc = num(rig._source?.system?.attributes?.ac?.flat ?? rig.system?.attributes?.ac?.flat);
    const calc = rig._source?.system?.attributes?.ac?.calc ?? rig.system?.attributes?.ac?.calc;
    if (haveAc !== wantAc || calc !== "flat") { upd["system.attributes.ac.flat"] = wantAc; upd["system.attributes.ac.calc"] = "flat"; notes.push(`AC ${haveAc || 0} → ${wantAc}`); }
    const hp = rig._source?.system?.attributes?.hp ?? rig.system?.attributes?.hp ?? {};
    if (!num(hp.max)) { const want = R.HP_BY_BRACKET[bracket] ?? 30; upd["system.attributes.hp.max"] = want; upd["system.attributes.hp.value"] = want; notes.push(`HP 0/0 → ${want}/${want}`); }
    if (!num(hp.dt)) { const want = R.DT_BY_BRACKET[bracket] ?? 0; if (want) { upd["system.attributes.hp.dt"] = want; notes.push(`DT → ${want}`); } }
    const heat = num(rig.flags?.["bbttcc-factions"]?.combat?.heat);
    const heatMax = 2 + Math.max(1, Math.min(4, tier || 1)) * 2;
    if (heat < 0 || heat > heatMax) { upd["flags.bbttcc-factions.combat.heat"] = Math.max(0, Math.min(heatMax, heat)); notes.push(`heat ${heat} → ${upd["flags.bbttcc-factions.combat.heat"]}`); }
    const order = rig.flags?.["bbttcc-factions"]?.rig?.order;
    if (order && order !== "none") { upd["flags.bbttcc-factions.rig.order"] = "none"; notes.push(`order ${order} → none (retired)`); }
    if (Object.keys(upd).length) { await rig.update(upd); changed++; rows.push({ rig: rig.name, bracket, tier, changes: notes.join("; ") }); }
  }
  let orphans = 0;
  for (const a of game.actors.contents) {
    const b = R.boardedRigOf?.(a); if (!b?.rigId) continue;
    const rig = game.actors.get(b.rigId);
    if (rig && R.isRig(rig)) continue;
    if (R.impl?.forceUnboard) { await R.impl.forceUnboard(a, { why: "reseat macro: rig no longer exists" }); orphans++; rows.push({ rig: a.name, bracket: "—", tier: "—", changes: "stepped off a missing rig" }); }
  }
  console.table(rows);
  const msg = `${TAG} ${changed} rig(s) re-seated, ${orphans} orphan crew stepped off (rerun should read 0 / 0).`;
  console.log(msg, rows);
  ui.notifications.info(msg);
  return { changed, orphans, rows };
})();
