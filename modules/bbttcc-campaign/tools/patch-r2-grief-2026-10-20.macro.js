/* patch-r2-grief-2026-10-20.macro.js — Story Review Ledger ROUND 2, "Act 2 grief towns" row 1 (Accept, Dave 2026-10-20).
 *   chuckle_showrunner  the GM note said "the Tanneritos (Act 4, the Crown Mall)"; the Mall is Act 3 since the 10-19 Acts 4–6 macro.
 *  Guarded by the live baseline; idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const rep = (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };
  rep("chuckle_showrunner", "if the Tanneritos (Act 4, the Crown Mall) are already in play", "if the Tanneritos (Act 3, the Crown Mall) are already in play", "the Mall is Act 3");

  console.log(`[r2 grief 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-r2-grief-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — round 2, grief towns.`);
})();
