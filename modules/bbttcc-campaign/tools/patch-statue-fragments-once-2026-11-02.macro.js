/**
 * patch-statue-fragments-once-2026-11-02.macro.js — click-through (2026-11-02): after Geburah Fragment I was won at Northreach
 * Expanse b, the picket still offered "Stand your ground in silence" and "Challenge the statue directly" — both live, and both route
 * to the repeatable fragment beats (_worthy on a win, _force on a miss or a challenge), so the table could take the fragment again or
 * add the contradictory mark (and with it the other "Tell him the truth" line). Each statue's answer is ONE answer: every statue
 * choice whose next/failNext is that statue's _worthy or _force fragment now requires neither fragment marked (café-forks shape).
 * Applies to all three pickets (northreach_b, mountains_q, mountains_o). Pure apply(camp) + Foundry runner. Idempotent (rerun = 0).
 * DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const STATUE_FRAG_PATCH = (() => {
  const SITES = ["northreach_b", "mountains_q", "mountains_o"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const site of SITES) {
      const id = `spark_geburah_${site}`, W = `${id}_worthy`, F = `${id}_force`;
      const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; }
      if (!beats.some(x => x && x.id === W) || !beats.some(x => x && x.id === F)) { conflicts.push(`${id}: fragment beats missing`); continue; }
      for (const c of (b.choices || [])) {
        if (!c || ![c.next, c.failNext].some(t => t === W || t === F)) continue;
        const req = Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : []);
        const has = (m) => req.some(r => r && r.beatMark === m && r.not === true);
        const add = [W, F].filter(m => !has(m)).map(m => ({ beatMark: m, not: true }));
        if (!add.length) { report.push(`· ok ${id} "${String(c.label).slice(0, 40)}"`); continue; }
        c.requires = [...req, ...add]; changes++;
        report.push(`✚ ${id} "${String(c.label).slice(0, 40)}": only until this statue is answered`);
      }
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = STATUE_FRAG_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = STATUE_FRAG_PATCH.apply(camp);
  console.log(`[statue fragments once 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__statueFrag = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-statue-fragments-once-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — each statue answers once.`);
})();
