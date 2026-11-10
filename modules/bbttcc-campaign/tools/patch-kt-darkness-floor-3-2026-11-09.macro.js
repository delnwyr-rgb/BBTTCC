/*
 * patch-kt-darkness-floor-3-2026-11-09.macro.js — Dave 2026-11-09, after hex Darkness started feeding by pips (3 +1 · 4 +2 ·
 * 5 +3 · 6 +4, per hex) and spreading like Radiation: "I really like the idea of KT being urgent … But I don't want it to be
 * impossibly urgent … So, maybe we set it at 3." Khezek-Tor sat at 5 pips on a story floor of 5 (Grengon would take +3 a turn).
 *   1. Campaign: every hexDarkness row on Khezek-Tor that sets floor 5 (khezek_tor_main_scene, khezek_tor_quest_scene,
 *      khezek_tor_town_walk) → floor 3, so a later beat can't lift it back. The shipment rows (+2 accept / +1 ignore /
 *      set 2) and the seal endings are untouched — the shipment is how it grows.
 *   2. World: the Khezek-Tor hex → 3 pips, darknessFloor 3.
 * Ember Bad Eden. globalThis.__ktFloor3Dry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__ktFloor3Dry !== false;
  const HEX = "Khezek-Tor", FROM = 5, TO = 3, MODT = "bbttcc-territory";
  const report = { DRY_RUN, beats: [], hex: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  for (const b of beats) {
    const hd = b.worldEffects?.hexDarkness;
    const rows = Array.isArray(hd) ? hd : (hd && typeof hd === "object" ? [hd] : []);
    for (const r of rows) if (r?.hexName === HEX && Number(r.floor) === FROM) { r.floor = TO; report.beats.push(`${b.id}: floor ${FROM} → ${TO}`); }
  }
  let doc = null;
  for (const s of game.scenes) for (const d of s.drawings) if (d.flags?.[MODT]?.name === HEX) doc = d;
  if (!doc) throw new Error(`${HEX} hex not found`);
  const tf = doc.flags[MODT], pips = Number(tf.mods?.darkness || 0), floor = Number(tf.darknessFloor || 0);
  const upd = {};
  if (floor !== TO) { upd[`flags.${MODT}.darknessFloor`] = TO; report.hex.push(`floor ${floor} → ${TO}`); }
  if (pips !== TO) { upd[`flags.${MODT}.mods`] = { ...(tf.mods || {}), darkness: TO }; report.hex.push(`pips ${pips} → ${TO}`); }
  if (!DRY_RUN) {
    if (report.beats.length) await C.saveCampaign(cid, { ...c, beats });
    if (Object.keys(upd).length) await doc.update(upd, { parent: doc.parent });
  }
  console.log("KTFLOOR3 " + JSON.stringify(report));
  return report;
})();
