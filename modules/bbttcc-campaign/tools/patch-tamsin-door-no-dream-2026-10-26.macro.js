/* patch-tamsin-door-no-dream-2026-10-26.macro.js — Tamsin's door stops spoiling the dream (Dave, 2026-10-26).
 *  Why: the players don't learn about the dream from Tamsin until later in the story; the Allesh-Gilliam
 *   "Also open" line told them to ask about it.
 *   EDIT  story.scripts.allesh_gilliam.doors[tamsin].line
 *         "Ask about the dream." → "Sit with him a while."
 *  Idempotent; DRY_RUN default true; backs up `campaigns`; true copy via JSON. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const report = []; let changes = 0;

  const rep = (where, obj, field, from, to, note) => { if (!obj) return report.push(`⚠ ${where}: not found`); const d = String(obj[field] || "");
    if (d.includes(to)) return report.push(`· ok ${where}: ${note}`);
    if (d.includes(from)) { obj[field] = d.replace(from, to); changes++; return report.push(`✚ ${where}: ${note}`); }
    report.push(`⚠ ${where}: baseline ${field} not found for "${note}" — left alone`); };

  const door = (camp.story?.scripts?.allesh_gilliam?.doors || []).find(d => d && d.id === "tamsin");
  rep("story.scripts.allesh_gilliam door tamsin", door, "line", "Ask about the dream.", "Sit with him a while.", "no dream before he tells it");

  console.log(`[tamsin door, no dream 2026-10-26] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-tamsin-door-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Tamsin's door no longer mentions the dream.`);
})();
