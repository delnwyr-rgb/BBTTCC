/**
 * settle-story-doctrine.macro.js — GM macro. Back-grants every doctrine unlock the story already earned.
 *
 * THE STORY HANDS OUT DOCTRINE (owner ruling 2026-09-21): a beat's unlocks.strategics/maneuvers grant the doctrine item
 * to every coalition faction as the beat plays. This settles what was earned BEFORE the beats carried unlocks (the
 * P19/S16 seeders stamp them; the beats already played won't fire again). Dry list, then a confirm dialog.
 */
(async () => {
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const D = game.bbttcc?.api?.factions?.doctrine;
  if (!api?.getActiveCampaignId || !D?.grant) return ui.notifications.error("Campaign / doctrine API not ready.");
  const cid = api.getActiveCampaignId(); const camp = api.getCampaign?.(cid); if (!camp) return ui.notifications.error("No active campaign.");
  const store = game.settings.get("bbttcc-campaign", "storyState"); const st = store?.played ? store : (store && typeof store === "object" ? store[cid] || Object.values(store).find(x => x && x.played) : null) || {};
  const targets = Array.from(new Set([].concat(camp.factionIds || [], camp.factionId ? [camp.factionId] : []).map(x => String(x || "").replace(/^Actor\./, "")))).map(id => game.actors.get(id)).filter(Boolean);
  if (!targets.length) return ui.notifications.error("The campaign has no coalition factions on its roster.");
  const rows = [];
  for (const b of (camp.beats || [])) {
    if (!b?.unlocks || !st.played?.[b.id]) continue;
    for (const kind of ["maneuver", "strategic"]) { const list = b.unlocks[kind === "maneuver" ? "maneuvers" : "strategics"]; if (!Array.isArray(list)) continue;
      for (const key of list) for (const F of targets) { const owned = D.ownedKeys?.(F, kind) || new Set(); if (!owned.has(String(key).toLowerCase())) rows.push({ beat: b.id, kind, key: String(key).toLowerCase(), faction: F }); } }
  }
  console.table(rows.map(r => ({ beat: r.beat, kind: r.kind, key: r.key, faction: r.faction.name })));
  if (!rows.length) return ui.notifications.info("Story doctrine: everything the story earned is already held.");
  const yes = await Dialog.confirm({ title: "Settle story doctrine", content: `<p><b>${rows.length}</b> doctrine grant(s) the story already earned (table in the console). Grant them now?</p>` });
  if (!yes) return;
  let n = 0; for (const r of rows) { try { const res = await D.grant(r.faction, { kind: r.kind, key: r.key, silent: false }); if (res?.ok && !res.already) n++; } catch (e) { console.warn("[settle-story-doctrine]", r, e); } }
  ui.notifications.info(`Story doctrine settled — ${n} item(s) granted.`);
})();
