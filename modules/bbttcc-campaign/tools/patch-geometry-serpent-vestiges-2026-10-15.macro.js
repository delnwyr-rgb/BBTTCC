/* patch-geometry-serpent-vestiges-2026-10-15.macro.js — the Geometry Serpent's
 * Win / Lose / Run outcome beats each re-served the parent's Win/Lose/Run trio
 * with next:"" (three dead buttons, no close) — the same disease as the Broken
 * Bridge (patch-broken-bridge-2026-10-15) and the bandit vestige strip. Found
 * by the 2026-10-15 campaign sweep for outcome beats re-serving a parent menu.
 *
 * Fix: each outcome beat ends on a single "Onward". The parley beats already
 * close properly (Continue / So be it) and are untouched. Idempotent; DRY_RUN
 * default true; backs up `campaigns` before the write. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw); // never mutate the live cache on a dry run
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const ONWARD = () => ({ label: "Onward", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" });
  const isVestige = (c) => /^(win|lose|run)$/i.test(String(c?.label || "").trim());
  const TARGETS = ["enc_geometry_serpent_outcomes_win", "enc_geometry_serpent_outcomes_lose", "enc_geometry_serpent_outcomes_run"];

  for (const id of TARGETS) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND — skipped`); continue; }
    const chs = Array.isArray(b.choices) ? b.choices : [];
    const vestiges = chs.filter(isVestige);
    const kept = chs.filter(c => !isVestige(c));
    if (vestiges.length || !chs.length) {
      b.choices = kept.length ? kept : [ONWARD()];
      changes++;
      report.push(`✚ ${id}: stripped ${vestiges.length} vestigial choice(s)${kept.length ? `, kept ${kept.length}` : " → Onward"}`);
    } else report.push(`· ok ${id}: ${chs.length} choice(s), no vestiges`);
  }

  console.log(`[patch-geometry-serpent-vestiges] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Geometry Serpent vestige strip DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Geometry Serpent vestige strip: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-geometry-serpent-vestiges-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Geometry Serpent vestige strip APPLIED: ${changes} change(s). QED.`);
})();
