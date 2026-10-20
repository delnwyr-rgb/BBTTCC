/* patch-coalition-ids-2026-10-19.macro.js — STORY REVIEW LEDGER Act 0–1 row 3 (Accept, Dave 2026-10-19), GLOBAL:
 *  factionEffects rows that name the playtest factions by id — The Errata Society 6H5Grt3HybAs1rSq and Sweet Release
 *  eIXghZ73kSXmP3x-style ids, with or without the "Actor." prefix — become ONE "@coalition" row carrying the same deltas, so a
 *  new table's factions receive them (the WME expands @coalition to the active roster). Where an identical @coalition row
 *  already sits beside a playtest row, the playtest row is dropped. Rows whose deltas disagree are reported and left alone.
 *  Idempotent; DRY_RUN default true; GM only; backs up `campaigns`.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const IDS = new Set(["6H5Grt3HybAs1rSq", "eIXghZ73hKSXmP3x"]);
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const report = []; let changes = 0, skipped = 0;
  const bare = (v) => String(v || "").trim().replace(/^Actor\./, "");
  const norm = (r) => JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== "factionId").sort()));
  for (const b of camp.beats) {
    const we = b.worldEffects; if (!we || !Array.isArray(we.factionEffects)) continue;
    const fx = we.factionEffects;
    const play = fx.filter(r => r && IDS.has(bare(r.factionId)));
    if (!play.length) continue;
    const shapes = new Set(play.map(norm));
    if (shapes.size !== 1) { skipped++; report.push(`⚠ ${b.id}: playtest rows disagree (${shapes.size} shapes) — left alone`); continue; }
    const shape = play[0];
    const co = fx.filter(r => r && /^@(coalition|campaign|stewards)$/i.test(String(r.factionId || "").trim()));
    const twin = co.find(r => norm(r) === norm(shape));
    const rest = fx.filter(r => !(r && IDS.has(bare(r.factionId))));
    if (twin) { we.factionEffects = rest; changes++; report.push(`✚ ${b.id}: ${play.length} playtest row(s) dropped — identical @coalition row already there`); }
    else { we.factionEffects = rest.concat([Object.assign({}, shape, { factionId: "@coalition" })]); changes++; report.push(`✚ ${b.id}: ${play.length} playtest row(s) → one @coalition row ${norm(shape)}`); }
  }
  if (!changes && !skipped) report.push("· ok no playtest faction ids left in factionEffects");
  console.log(`[patch-coalition-ids] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} beat(s) changed, ${skipped} skipped\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Coalition ids DRY RUN: ${changes} beat(s) (see console).`);
  if (!changes) return ui.notifications.info("Coalition ids: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-coalition-ids-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Coalition ids APPLIED: ${changes} beat(s) now pay @coalition.`);
})();
