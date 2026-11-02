/**
 * patch-town-arrival-once-2026-11-02.macro.js — Dave, 11-02 (the town map is the hub; asked how Khezek-Tor and Lyrenn should arrive):
 * "First arrival only". Every town-arrival beat for Khezek-Tor, Lyrenn and Furrier's Fixit-Farm (campaign hexOverride lists + each hex
 * drawing's own onEnterBeatId) gets inject.oncePerHex = true: the intro / hub plays the first time the party enters that hex in its act,
 * later rides land on the town map. The beats stay repeatable, so story routes back into them still work. Allesh-Gilliam already
 * arrives on the map (patch-ag-drawing-arrival); the Forest of Early Tifaret approach keeps re-opening until finished (its own ruling).
 * BACKFILL (live-caught 11-02): the gate only counts arrivals recorded WHILE oncePerHex is set, so an intro that had already played
 * (firedCount > 0, no firedHexes entry) played once more on the next ride. Each arrival beat that has fired is stamped as fired at its
 * town hex in the injector state (bbttcc-core.campaignInjectorState) — the next ride lands on the town map.
 * Idempotent. DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign"; const TOWNS = /^(Khezek-Tor|Lyrenn|Furrier's Fixit-Farm)$/;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const ids = new Set(); const hexesOf = new Map();
  for (const sc of game.scenes) for (const d of sc.drawings) { const tf = d.flags?.["bbttcc-territory"]; const n = String(tf?.name || "").replace(/[\s ]+/g, " ").trim(); if (!TOWNS.test(n)) continue;
    const ov = camp.hexOverrides?.[d.uuid]; for (const id of [...(ov?.onEnterBeatIds || []), ov?.onEnterBeatId, ov?.beatId, tf?.campaign?.onEnterBeatId, tf?.onEnterBeatId]) if (id) { ids.add(String(id)); if (!hexesOf.has(String(id))) hexesOf.set(String(id), new Set()); hexesOf.get(String(id)).add(d.uuid); } }
  const report = []; let changes = 0;
  for (const id of ids) { const b = camp.beats.find(x => x && x.id === id); if (!b) { report.push(`⚠ ${id} not found`); continue; } b.inject = b.inject || {}; if (b.inject.oncePerHex === true) { report.push(`· ok ${id}`); continue; } b.inject.oncePerHex = true; changes++; report.push(`✚ ${id}: plays on the first arrival only (oncePerHex)`); }
  const inj = JSON.parse(JSON.stringify(game.settings.get("bbttcc-core", "campaignInjectorState") || {})); let injChanges = 0;
  for (const [id, hexes] of hexesOf) { const rec = inj.beatHistory?.[id]; if (!rec || !(Number(rec.firedCount) > 0)) continue; rec.firedHexes = rec.firedHexes || {};
    for (const h of hexes) if (!rec.firedHexes[h]) { rec.firedHexes[h] = 1; injChanges++; report.push(`✚ ${id}: already played → stamped as played at ${h}`); } }
  changes += injChanges;
  console.log(`[town arrival once 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__arrivalOnce = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-town-arrival-once-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (injChanges) await game.settings.set("bbttcc-core", "campaignInjectorState", inj);
  ui.notifications.info(`Applied ${changes} change(s) — towns introduce themselves once.`);
})();
