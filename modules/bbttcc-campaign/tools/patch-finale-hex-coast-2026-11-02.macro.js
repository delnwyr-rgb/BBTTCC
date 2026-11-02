/* patch-finale-hex-coast-2026-11-02.macro.js — RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Click-through 2026-11-02, at the Bunker door: "Count who came first." answered "The Muster — Count Who Came is at Inconvenient
 * Mountains.h — the party is at Hexen Myre.o. Plot the ride". The Bunker moved to the coast on 2026-10-20 (Dave;
 * patch-bunker-hex-coast moved the arrival trigger to Hexen Myre.o) but the finale QUEST's hex stayed "Inconvenient Mountains.h", so
 * the 40 finale beats that declare no place of their own inherited the old inland hex and every one became a ride away from the
 * Bunker. Code QUEST_MAP now says Hexen Myre.o (story-model.js); this stamps the same hex on the DATA-layer quest def (data
 * overrides code). Idempotent.
 */
(async () => {
  const DRY_RUN = true;                         // <-- set false to apply
  const KEY = "finale", HEX = "Hexen Myre.o";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const data = api?.story?.data;
  if (!data?.get || !data?.saveQuest) return ui.notifications.error("story.data API missing.");
  const cid = api.getActiveCampaignId?.(); const story = data.get(cid);
  const report = [`Finale hex → ${HEX} — ${DRY_RUN ? "DRY RUN" : "APPLY"} (campaign ${cid})`]; let changes = 0;
  const q = story?.quests?.[KEY];
  if (!q) report.push(`• ${KEY}: no data-layer quest def (code QUEST_MAP is ${HEX}) — nothing to do`);
  else if (q.hex === HEX) report.push(`• ${KEY}: already ${HEX}`);
  else { changes++; if (DRY_RUN) report.push(`• ${KEY}: would move hex ${q.hex} → ${HEX}`); else { await data.saveQuest(cid, KEY, { quest: { ...q, hex: HEX } }); report.push(`• ${KEY}: hex ${q.hex} → ${HEX} written`); } }
  console.log(report.join("\n")); globalThis.__finaleHex = { dry: DRY_RUN, changes, report };
  ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s); see console.`);
})();
