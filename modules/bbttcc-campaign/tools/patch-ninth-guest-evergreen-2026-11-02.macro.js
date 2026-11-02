/* patch-ninth-guest-evergreen-2026-11-02.macro.js — RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Click-through 2026-11-02: Father Tamsin's "Ask the coast" reveals the Founders' Garden on the map, but The Ninth Guest is Act 4
 * content; the Maneuver Vault carried the table into Act 5 before anyone rode there, so the act seal closed it ("was never started
 * and Act 4 is over") — a place on the map with every door shut. Owner ruling (Dave 11-02): "Ninth Guest should be a permanent
 * place … SEEING the Founder's Garden doesn't do anything bad at this point." Code QUEST_MAP now marks ninth_guest `evergreen`
 * (story-model.js); this stamps the same flag on the DATA-layer quest def (data overrides code) when one exists. Idempotent.
 */
(async () => {
  const DRY_RUN = true;                         // <-- set false to apply
  const KEYS = ["ninth_guest"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const data = api?.story?.data;
  if (!data?.get || !data?.saveQuest) return ui.notifications.error("story.data API missing.");
  const cid = api.getActiveCampaignId?.(); const story = data.get(cid);
  const report = [`Ninth Guest evergreen — ${DRY_RUN ? "DRY RUN" : "APPLY"} (campaign ${cid})`]; let changes = 0;
  for (const k of KEYS) {
    const q = story?.quests?.[k];
    if (!q) { report.push(`• ${k}: no data-layer quest def (code QUEST_MAP is evergreen) — nothing to do`); continue; }
    if (q.evergreen === true) { report.push(`• ${k}: already evergreen`); continue; }
    changes++;
    if (DRY_RUN) { report.push(`• ${k}: would set evergreen:true (act ${q.act})`); continue; }
    await data.saveQuest(cid, k, { quest: { ...q, evergreen: true } });
    report.push(`• ${k}: evergreen:true written`);
  }
  try { const v = api.sealed ? await api.sealed(cid, "founders_garden_approach") : null; if (v) report.push(`founders_garden_approach seal now: ${v.sealed ? "SEALED — " + v.why : "open"}`); } catch (_e) {}
  console.log(report.join("\n")); globalThis.__ninthGuest = { dry: DRY_RUN, changes, report };
  ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s); see console.`);
})();
