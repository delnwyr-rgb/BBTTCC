/**
 * settle-story-awards.macro.js — GM macro/console. Back-pays every story award the store already holds.
 *
 * STORY AWARDS (owner ruling 2026-09-20): a quest closed pays 30 marks across its two themed channels, a chapter ended
 * pays 10, a creature overcome pays its bestiary bounty by method. The engine pays as beats resolve; this settles what
 * was earned BEFORE the engine existed (the ledger keeps it from paying twice). Dry run lists what would be paid; then asks.
 */
(async () => {
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const awards = api?.awards;
  if (!awards?.settle) return ui.notifications.error("Story awards API not ready (F5 after deploying bbttcc-campaign).");
  const cid = api.getActiveCampaignId?.(); const camp = cid ? api.getCampaign?.(cid) : null;
  const store = game.settings.get("bbttcc-campaign", "storyState"); const st = store?.played ? store : (store && typeof store === "object" ? Object.values(store).find(x => x && x.played) : null) || {};
  const ledger = awards.ledger() || {}; const rows = [];
  for (const [q, r] of Object.entries(st.closed || {})) if (!ledger[`quest:${q}`]) rows.push(`quest ${q} (${r?.name}) → ${JSON.stringify(awards.rewardFor(q))}`);
  for (const [q, cs] of Object.entries(st.chapters || {})) for (const [c, r] of Object.entries(cs || {})) if (r?.ending && !ledger[`chapter:${q}.${c}`]) rows.push(`chapter ${q}·${c} (${r.ending.name}) → ${JSON.stringify(awards.rewardFor(q, c))}`);
  for (const b of (camp?.beats || [])) if (b?.award?.method && st.played?.[b.id]) { const n = Number(st.played[b.id].n || 1); for (let i = 1; i <= n; i++) if (!ledger[`creature:${b.id}:${i}`]) rows.push(`creature ${b.award.creature || b.award.creatureId || b.id} — ${b.award.method} (play ${i})`); }
  console.log(`[settle-story-awards] ${rows.length} unpaid award(s):\n` + rows.map(r => "  " + r).join("\n"));
  if (!rows.length) return ui.notifications.info("Story awards: everything the store holds is already paid.");
  const yes = await Dialog.confirm({ title: "Settle story awards", content: `<p><b>${rows.length}</b> unpaid award(s) (details in the console). Pay them now to every coalition faction?</p>` });
  if (!yes) return;
  const out = await awards.settle(cid);
  ui.notifications.info(`Story awards settled — quests ${out?.quests ?? 0}, chapters ${out?.chapters ?? 0}, creatures ${out?.creatures ?? 0}.`);
})();
