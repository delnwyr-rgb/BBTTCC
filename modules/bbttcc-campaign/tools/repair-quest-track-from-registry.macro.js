/* repair-quest-track-from-registry.macro.js — put accepted quests back on the coalition track (2026-09-09)
 *
 * Symptom: the quest REGISTRY (world setting bbttcc-campaign.quests) says a quest is
 * active — e.g. the "A Word from …" invitations you accepted when Act 2 opened —
 * but the coalition TRACK (flags.bbttcc-factions.quests on each campaign faction),
 * which is what the Quest Log shows, does not have it. Seen after the 2026-09-09
 * restore of "Act 2 Ahoy!": registry had 9 Act-2 Words, the track had none.
 *
 * Rule: every registry quest with status "active" that is in NO bucket of a
 * campaign faction's track is added to that faction's ACTIVE bucket (same entry
 * shape the engine writes). Completed/archived registry quests are left alone.
 * Idempotent. DRY_RUN default true. Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", MODF = "bbttcc-factions";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.(); const camp = api?.getCampaign?.(cid);
  if (!camp) return ui.notifications.error("No active campaign.");
  let reg = game.settings.get(NS, "quests"); if (typeof reg === "string") { try { reg = JSON.parse(reg); } catch (_e) { reg = {}; } }
  const active = Object.values(reg || {}).filter(q => String(q?.status || "active") === "active");
  const refs = [...(camp.factionIds || []), camp.factionId].filter(Boolean).map(r => String(r).replace(/^Actor\./, ""));
  const factions = [...new Set(refs)].map(id => game.actors.get(id)).filter(Boolean);
  if (!factions.length) return ui.notifications.error("Campaign has no factions.");
  const changes = []; const now = Date.now();
  for (const F of factions) {
    const cur = foundry.utils.deepClone(F.getFlag(MODF, "quests") || {});
    cur.schemaVersion = cur.schemaVersion || 1; cur.active = cur.active || {}; cur.completed = cur.completed || {}; cur.archived = cur.archived || {};
    let n = 0;
    for (const q of active) {
      const id = String(q.id || ""); if (!id) continue;
      if (cur.active[id] || cur.completed[id] || cur.archived[id]) continue;
      cur.active[id] = { v: 1, questId: id, questName: String(q.name || id), status: "active", acceptedTs: Number(q.createdTs) || now, lastTouchedTs: now, state: "", notes: "", progress: { beats: {} }, history: [{ ts: now, type: "accept", by: game.user.id, note: "repair-quest-track-from-registry" }] };
      n++; changes.push(`${F.name}: + ${q.name} (${id})`);
    }
    if (n && !DRY_RUN) { await F.unsetFlag(MODF, "quests"); await F.setFlag(MODF, "quests", cur); }
  }
  console.group(`[repair-quest-track] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} addition(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Quest track DRY RUN: ${changes.length} addition(s) in console (F12). Set DRY_RUN=false to apply.`);
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Quest track repaired from the registry.</b><ul style="font-size:12px">${changes.map(c => `<li>${foundry.utils.escapeHTML(c)}</li>`).join("")}</ul>` });
  ui.notifications.info(`Quest track repaired: ${changes.length} addition(s).`);
})();
