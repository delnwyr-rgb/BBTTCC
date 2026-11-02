/**
 * patch-gloomgill-intro-onward-2026-11-02.macro.js — click-through (2026-11-02): arriving at Lake Suspicious plays the Gloomgill
 * cinematic (gloomgill_intro, the hex's onEnterBeatId) — and it has NO choices, so after "Continue" the story stopped: the scene that
 * IS the act (gloomgill_intro_scene: Talk / Fight / Leave) had no route in, and the quest log went on saying "Ride to Lake Suspicious."
 * at the lake. Fixit's cinematic arrival has "Head inside → fixit_intro_scene"; Gloomgill gets the same: "Go down to the water."
 * → gloomgill_intro_scene. Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/.
 */
const GLOOM_PATCH = (() => {
  const FROM = "gloomgill_intro", TO = "gloomgill_intro_scene";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const b = beats.find(x => x && x.id === FROM); if (!b) { conflicts.push(`${FROM} not found`); return { changes, report, conflicts }; }
    if (!beats.some(x => x && x.id === TO)) { conflicts.push(`${TO} not found`); return { changes, report, conflicts }; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => c && c.next === TO)) { report.push(`· ok ${FROM}`); return { changes, report, conflicts }; }
    b.choices.push({ label: "Go down to the water.", next: TO, description: "", checkStat: "", checkDC: 0, failNext: "" }); changes++;
    report.push(`✚ ${FROM}: "Go down to the water." → ${TO}`);
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = GLOOM_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = GLOOM_PATCH.apply(camp);
  console.log(`[gloomgill intro onward 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__gloom = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-gloomgill-intro-onward-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the cinematic leads to the lake.`);
})();
