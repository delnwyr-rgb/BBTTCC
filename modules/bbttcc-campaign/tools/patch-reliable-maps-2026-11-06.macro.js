/*
 * patch-reliable-maps-2026-11-06.macro.js — Dave's two Absolutely Reliable maps replace the stand-in. Below decks (hM1o5Wlfw5PrztCU): the hub, galley, bunks and her beats.
 * Top deck (bi4IZQVrL3Ltuqd2): the control station. The vault opens on both. The stand-in scene loses its flag and is left for Dave to delete.
 * Ember Bad Eden. globalThis.__reliableMapsDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__reliableMapsDry !== false, MOD = "bbttcc-campaign", BELOW = "hM1o5Wlfw5PrztCU", DECK = "bi4IZQVrL3Ltuqd2", report = { DRY_RUN, text: [] };
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  for (const sid of [BELOW, DECK]) {
    const s = game.scenes.get(sid); if (!s) throw new Error(`scene ${sid} not found`);
    if (!s.getFlag(MOD, "reliableScene") || s.ownership.default < 2) { report.text.push(`flag ${s.name}`); if (!DRY_RUN) await s.update({ [`flags.${MOD}.reliableScene`]: true, "ownership.default": 2 }); }
  }
  for (const s of game.scenes) if (s.getFlag(MOD, "reliableScene") && s.id !== BELOW && s.id !== DECK) { report.text.push(`unflag ${s.name}`); if (!DRY_RUN) await s.unsetFlag(MOD, "reliableScene"); }
  const beats = foundry.utils.deepClone(c.beats);
  const PLACE = { reliable_aboard: BELOW, reliable_galley: BELOW, reliable_bunks: BELOW, reliable_the_lease: BELOW, reliable_lease_home: BELOW, reliable_lease_terms: BELOW, rc_gearbox_coffee: BELOW, ag_first_signature: BELOW, ag_days_end: BELOW, reliable_helm: DECK };
  for (const [bid, sid] of Object.entries(PLACE)) { const b = beats.find(x => x.id === bid); if (b && b.sceneId !== sid) { b.sceneId = sid; report.text.push(`${bid}`); } }
  if (!DRY_RUN && report.text.length) await C.saveCampaign(id, { ...c, beats });
  console.log("RELIABLEMAPS " + JSON.stringify(report));
})();
