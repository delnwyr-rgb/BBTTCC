/* patch-grief-towns-evergreen.macro.js — RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Live-caught 2026-09-25: the party reached Odaroloc River.e in Act 3 and Chuckle Creek's arrival was refused —
 * the quest is Act 2 content, never started, so the act seal closed it. Owner ruling: a grief town is a PLACE;
 * it never closes with an act. Code QUEST_MAP now marks chuckle_creek / soft_landing / stillwater `evergreen`;
 * this macro stamps the same flag on the DATA-layer quest defs in campaign.story (the seeder wrote one for
 * Chuckle Creek, and data overrides code). Then re-enter the hex, or fire the arrival from the Quest Log.
 */
(async () => {
  const DRY_RUN = false;                        // <-- set false to apply
  const KEYS = ["chuckle_creek", "soft_landing", "stillwater"];
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const data = api?.story?.data;
  if (!data?.get || !data?.saveQuest) return ui.notifications.error("story.data API missing — hard-reload after the 2026-09-25 deploy.");
  const cid = api.getActiveCampaignId?.(); const story = data.get(cid);
  const report = [`Evergreen grief towns — ${DRY_RUN ? "DRY RUN" : "APPLY"} (campaign ${cid})`];
  for (const k of KEYS) {
    const q = story?.quests?.[k];
    if (!q) { report.push(`• ${k}: no data-layer quest def (code QUEST_MAP already evergreen) — nothing to do`); continue; }
    if (q.evergreen === true) { report.push(`• ${k}: already evergreen`); continue; }
    if (DRY_RUN) { report.push(`• ${k}: would set evergreen:true (act ${q.act})`); continue; }
    await data.saveQuest(cid, k, { quest: { ...q, evergreen: true } });
    report.push(`• ${k}: evergreen:true written`);
  }
  try { const v = api.sealed ? await api.sealed(cid, "chuckle_arrival") : null; if (v) report.push(`chuckle_arrival seal now: ${v.sealed ? "SEALED — " + v.why : "open"}`); } catch (_e) {}
  console.log("[patch-grief-towns-evergreen]", report.join("\n"));
  ui.notifications.info(report.join(" | "));
  ChatMessage.create({ content: `<pre style="white-space:pre-wrap">${report.map(x => foundry.utils.escapeHTML(x)).join("\n")}</pre>`, whisper: [game.user.id] });
})();
