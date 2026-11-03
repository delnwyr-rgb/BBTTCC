/**
 * patch-binah-pressure-tune-2026-11-02.macro.js — live-caught in the first Bitter Sea dive (2026-11-02): every beat at Winnie's table
 * bit (worldEffects.depthExposure tick), and the Understood path is ~10 beats outside — all three Stewards hit breath 0, Drowning and
 * Crushing, 24–29 Integrity each, for choosing the RIGHT answer. Now only the attempts bite: stepping out, each object you try to name
 * (binah_obj_*), and each one that slips (binah_obj_sinks) — the table returns and the "sorted" beats are free. A clean Understood =
 * 4 bites. Also: the check-choice labels carried their own "· Logistics DC 16" and the engine appends one too ("… · Logistics DC 16 ·
 * Logistics DC 16") — the typed suffix comes off. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const BINAH_TUNE = (() => {
  const FREE = ["binah_sluice", "binah_named_tape", "binah_named_glove", "binah_named_clapper", "binah_understood", "binah_released", "binah_carried"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const id of FREE) { const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; } if (b.worldEffects?.depthExposure?.tick === true) { delete b.worldEffects.depthExposure; changes++; report.push(`✚ ${id}: no bite (not an attempt)`); } }
    const sl = beats.find(x => x && x.id === "binah_sluice");
    for (const c of (sl?.choices || [])) { const nl = String(c.label || "").replace(/\s*·\s*(Logistics|Violence) DC \d+\s*$/i, ""); if (nl !== c.label) { c.label = nl; changes++; report.push(`✚ binah_sluice: label "${nl}"`); } }
    if (sl && !/each attempt/.test(String(sl.description))) { sl.description = String(sl.description).replace("⚙ GM: every beat out here bites — breath, then crush (deep) — for anyone not in a pressure-rated suit.", "⚙ GM: each attempt out here bites — breath, then crush (deep) — for anyone not in a pressure-rated suit. Back aboard refills the air."); changes++; report.push(`✚ binah_sluice: GM note says each attempt bites`); }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = BINAH_TUNE;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = BINAH_TUNE.apply(camp);
  console.log(`[binah pressure tune 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__binahTune = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-binah-tune-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — only the attempts bite.`);
})();
