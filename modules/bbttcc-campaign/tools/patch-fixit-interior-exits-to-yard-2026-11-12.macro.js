/*
 * patch-fixit-interior-exits-to-yard-2026-11-12.macro.js — Dave (2026-11-12): from the Counter, "Back to the yard" did nothing —
 * the card closed and left the party standing on the Counter interior with no menu. An exit with next "" only closes the card,
 * which is fine on the yard map but strands you on an interior scene. The Gullywasher's exits already go to fixit_town_walk
 * (Open for Browsing, on fixit_map), so the interior "Back to the yard" exits do the same:
 *   fixit_general_store_coversation (Counter interior), fixit_load_the_crate + ans_fixit_load_the_crate_ask_about_the_three_doorstops
 *   (Arc Bay interior). Exterior / yard-map exits ("" on a map-side scene) are left alone.
 * Ember Bad Eden. globalThis.__yardDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__yardDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const YARD = "fixit_town_walk";
  if (!beats.some(b => b.id === YARD)) throw new Error(YARD + " missing");
  for (const id of ["fixit_general_store_coversation", "fixit_load_the_crate", "ans_fixit_load_the_crate_ask_about_the_three_doorstops"]) {
    const b = beats.find(x => x.id === id); if (!b) throw new Error(id + " missing");
    for (const ch of (b.choices || [])) {
      if (!/^back to the yard\.?$/i.test(String(ch.label).trim()) || ch.next) continue;
      ch.next = YARD; report.changed.push(`${id}: "${ch.label}" → ${YARD}`);
    }
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("YARDEXITS " + JSON.stringify(report));
  return report;
})();
