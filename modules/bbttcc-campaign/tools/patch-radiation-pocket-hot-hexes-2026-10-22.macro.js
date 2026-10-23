/* patch-radiation-pocket-hot-hexes-2026-10-22.macro.js — ONE RADIATION SWITCH (owner ruling 2026-10-22).
 * The Radiation Pocket is not a random encounter: it depends on a hex already being hot.
 *  1. `enc_minor_radiation_pocket` comes OFF every encounter table (it was on 15 travel tables). Hot hexes with no
 *     arrival beat of their own now play it on entry (bbttcc-travel api.travel.js, RADIATION_POCKET_BEAT).
 *  2. Its "Cleanse the Darkness" ending gets `worldEffects.hexRadiation = { level: 0 }` — the hex it happened on is
 *     cleaned (blank hex → the party's recorded position). The other endings stay narrative.
 *  3. The Pocket itself plays ONCE PER HEX (its inject said oncePerHex:false, which beat the arrival default) —
 *     Reset Console re-arms it for a retake.
 * Idempotent; DRY_RUN default true; returns the removed table entries + the ending's before-value (the backup). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const POCKET = "enc_minor_radiation_pocket";
  const CLEANSE = "enc_minor_radiation_pocket_cleanse_the_darkness";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : JSON.parse(JSON.stringify(tablesRaw || {}));   // a TRUE copy — deepClone hands back non-plain objects by reference, so an in-place edit can hit the settings cache and settings.set then sees "no change"
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));   // a TRUE copy (see above / deepClone shares non-plain objects)
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beatList = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(beatList.map(b => [b.id, b]));

  const report = [], backup = { tableEntries: {}, cleanse: null };
  let tableChanges = 0, beatChanges = 0;

  // 1. off the tables
  for (const [tid, t] of Object.entries(tables)) {
    if (!t || !Array.isArray(t.entries)) continue;
    const keep = [], gone = [];
    for (const e of t.entries) (String(e?.beatId || "") === POCKET ? gone : keep).push(e);
    if (!gone.length) continue;
    backup.tableEntries[tid] = gone;
    t.entries = keep; tableChanges += gone.length;
    report.push(`✖ ${tid}: ${POCKET} removed (${gone.length})`);
  }
  if (!tableChanges) report.push(`· ok: ${POCKET} is on no table`);

  // 2. the Cleanse ending cleans the hex
  const cb = byId.get(CLEANSE);
  if (!cb) report.push(`✖ ${CLEANSE}: beat not found`);
  else {
    const we = (cb.worldEffects && typeof cb.worldEffects === "object") ? cb.worldEffects : (cb.worldEffects = {});
    const rows = Array.isArray(we.hexRadiation) ? we.hexRadiation : (we.hexRadiation ? [we.hexRadiation] : []);
    if (rows.some(r => r && Number(r.level) === 0 && !r.hexName && !r.targetHexUuid)) report.push(`· ok ${CLEANSE}: hexRadiation 0 present`);
    else { backup.cleanse = { hexRadiation: we.hexRadiation ?? null }; we.hexRadiation = { level: 0 }; beatChanges++; report.push(`✚ ${CLEANSE}: hexRadiation { level 0 } (cleans the hex it happened on)`); }
  }
  // 3. once per hex
  const pb = byId.get(POCKET);
  if (!pb) report.push(`⚠ ${POCKET}: beat not found — hot hexes will have nothing to play`);
  else if (pb.inject?.oncePerHex === true) report.push(`· ok ${POCKET}: oncePerHex`);
  else { backup.pocketInject = { oncePerHex: pb.inject?.oncePerHex ?? null }; pb.inject = Object.assign({}, pb.inject || {}, { oncePerHex: true }); beatChanges++; report.push(`✚ ${POCKET}: inject.oncePerHex ${backup.pocketInject.oncePerHex} → true`); }

  const summary = `radiation pocket patch — ${tableChanges} table entr${tableChanges === 1 ? "y" : "ies"} removed, ${beatChanges} beat change(s)${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log(summary + "\n" + report.join("\n"));
  ui.notifications.info(summary);
  if (!DRY_RUN) {
    if (tableChanges) await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
    if (beatChanges) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  return { dryRun: DRY_RUN, tableChanges, beatChanges, report, backup };
})();
