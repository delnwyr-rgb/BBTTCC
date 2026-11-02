/**
 * patch-statue-confer-into-statue-2026-11-02.macro.js — click-through (2026-11-02): riding into Inconvenient Mountains.q the arrival
 * played "The Second Statue Has Heard" (spark_geburah_confer_2_clean) — and its only choice, "Say nothing.", went nowhere. The hex's
 * arrival list is [confer_2_clean, confer_2_bloodied, spark_geburah_mountains_q] and the arrival plays the FIRST eligible beat, so
 * the statue itself never opened: the table heard the statue had heard, and then stood in an empty basin. Same shape at the third
 * picket (confer_3_unanimous / _divided → spark_geburah_mountains_o). → each confer beat's "Say nothing." leads into its statue.
 * (The confers are once-only, so later arrivals open the statue directly.) Pure apply(camp) + Foundry runner. Idempotent (rerun = 0).
 * DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const CONFER_PATCH = (() => {
  const MAP = { spark_geburah_confer_2_clean: "spark_geburah_mountains_q", spark_geburah_confer_2_bloodied: "spark_geburah_mountains_q",
    spark_geburah_confer_3_unanimous: "spark_geburah_mountains_o", spark_geburah_confer_3_divided: "spark_geburah_mountains_o" };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const [id, to] of Object.entries(MAP)) {
      const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; }
      if (!beats.some(x => x && x.id === to)) { conflicts.push(`${to} not found`); continue; }
      const c = (b.choices || []).find(x => x && /^say nothing/i.test(String(x.label || "").trim()));
      if (!c) { conflicts.push(`${id}: no "Say nothing." choice`); continue; }
      if (c.next === to) { report.push(`· ok ${id}`); continue; }
      if (c.next) { conflicts.push(`${id}: "Say nothing." already routes to ${c.next} — left alone`); continue; }
      c.next = to; changes++; report.push(`✚ ${id} "Say nothing." → ${to} (the statue opens)`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = CONFER_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = CONFER_PATCH.apply(camp);
  console.log(`[statue confer into statue 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__confer = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-statue-confer-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the statue's warning leads to the statue.`);
})();
