/* undo-repair-quest-track.macro.js — reverse the over-broad 2026-09-09 track repair
 *
 * repair-quest-track-from-registry (first version) treated the registry's default
 * status "active" as "accepted by the coalition" and pushed all 59 catalog quests
 * onto both faction tracks. Only the `word_*` invitation quests were legitimate.
 * This removes every ACTIVE track entry whose history carries the repair note and
 * whose id is not `word_*`. It also clears the Director invitations that fired
 * because those quests looked active (their once-gate + unaccepted chat cards), so
 * the real invitations can post when the quests are truly accepted.
 * DRY_RUN default true; idempotent. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", MODF = "bbttcc-factions", NOTE = "repair-quest-track-from-registry";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.(); const camp = api?.getCampaign?.(cid);
  if (!camp) return ui.notifications.error("No active campaign.");
  const refs = [...(camp.factionIds || []), camp.factionId].filter(Boolean).map(r => String(r).replace(/^Actor\./, ""));
  const factions = [...new Set(refs)].map(id => game.actors.get(id)).filter(Boolean);
  const changes = []; const writes = []; let repairTs = Infinity;
  for (const F of factions) {
    const t = foundry.utils.deepClone(F.getFlag(MODF, "quests") || {}); let n = 0;
    for (const [qid, e] of Object.entries(t.active || {})) {
      const fromRepair = (e.history || []).some(h => h && h.note === NOTE);
      if (!fromRepair || qid.startsWith("word_")) continue;
      repairTs = Math.min(repairTs, ...(e.history || []).filter(h => h?.note === NOTE).map(h => Number(h.ts) || Infinity));
      delete t.active[qid]; n++; changes.push(`${F.name}: − ${e.questName || qid}`);
    }
    if (n) writes.push([F, t]);
  }
  // Director invitations that only fired because the phantom quests looked active.
  let ds = game.settings.get(NS, "directorState"); if (typeof ds === "string") { try { ds = JSON.parse(ds); } catch (_e) { ds = {}; } } ds = foundry.utils.deepClone(ds || {});
  const phantomBeats = []; let dsDirty = false;
  if (Number.isFinite(repairTs)) for (const [beatId, rec] of Object.entries(ds.invited || {})) {
    if (Number(rec?.ts) >= repairTs) { phantomBeats.push(beatId); delete ds.invited[beatId]; dsDirty = true; changes.push(`director.invited: − ${beatId} (posted after the bad repair)`); }
  }
  const cards = game.messages.filter(m => { const inv = m.getFlag(NS, "talkInvite"); return inv && !inv.accepted && (inv.beatIds || []).some(b => phantomBeats.includes(b)); });
  const acceptedCards = game.messages.filter(m => { const inv = m.getFlag(NS, "talkInvite"); return inv && inv.accepted && (inv.beatIds || []).some(b => phantomBeats.includes(b)); });
  for (const m of cards) changes.push(`chat: delete unaccepted invitation card (${(m.getFlag(NS, "talkInvite").beatIds || []).join(",")})`);
  for (const m of acceptedCards) changes.push(`⚠ already ACCEPTED phantom invitation (${(m.getFlag(NS, "talkInvite").beatIds || []).join(",")}) — left alone; remove its word_ quest by hand if unwanted`);
  console.group(`[undo-repair] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Undo DRY RUN: ${changes.length} change(s) in console (F12). Set DRY_RUN=false to apply.`);
  for (const [F, t] of writes) { await F.unsetFlag(MODF, "quests"); await F.setFlag(MODF, "quests", t); }
  if (dsDirty) await game.settings.set(NS, "directorState", ds);
  if (cards.length) await ChatMessage.deleteDocuments(cards.map(m => m.id));
  ui.notifications.info(`Undo applied: ${changes.length} change(s).`);
})();
