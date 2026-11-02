/**
 * patch-sexton-back-to-picket-2026-11-02.macro.js — click-through (2026-11-02): at the first Lost Stone Statue (Northreach Expanse b)
 * "Follow the broom marks." leads to Dunmore Kell, the Sexton. He is the "sign the book AFTER" stop: his tally choices need the
 * statue answered (spark_geburah_northreach_b_worthy / _force). A table that meets him first asks its three questions and is left
 * with three greyed asks and no way back to the picket. → "Back to the picket." (→ spark_geburah_northreach_b) on the Sexton and his
 * three answer beats, shown until the statue is answered (then the tally choices are the way on).
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const SEXTON_PATCH = (() => {
  const IDS = ["statues_sexton", "ans_statues_sexton_ask_what_the_pickets_are", "ans_statues_sexton_ask_who_else_has_been", "ans_statues_sexton_ask_whose_post_they_re"];
  const STATUE = "spark_geburah_northreach_b";
  const CHOICE = () => ({ label: "Back to the picket.", next: STATUE, description: "", checkStat: "", checkDC: 0, failNext: "",
    requires: [{ beatMark: "spark_geburah_northreach_b_worthy", not: true }, { beatMark: "spark_geburah_northreach_b_force", not: true }] });
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    if (!beats.some(b => b && b.id === STATUE)) conflicts.push(`${STATUE} not found`);
    for (const id of IDS) {
      const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; }
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      if (b.choices.some(c => c && c.next === STATUE)) { report.push(`· ok ${id}`); continue; }
      b.choices.push(CHOICE()); changes++; report.push(`✚ ${id}: "Back to the picket." (until the statue is answered)`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = SEXTON_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = SEXTON_PATCH.apply(camp);
  console.log(`[sexton back to picket 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__sexton = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-sexton-back-to-picket-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Sexton points back to the picket.`);
})();
