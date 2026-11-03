/**
 * patch-gloomgill-intro-dialog-2026-11-03.macro.js — THE EXAM'S DOOR OPENS (failure pass 2026-11-03, live-caught at Lake Suspicious).
 * gloomgill_intro is type "cinematic" with no scene chain (cinematic.enabled false), so the engine handed it to the Encounter
 * engine's scenario runner, which shows the text with one "Continue" that closes it and DROPS the beat's own choice
 * ("Go down to the water." → gloomgill_intro_scene). The table could never reach the Exam, and the Resume card looped on
 * "Pick up: Gloomgill - Intro". It is the only cinematic beat with no chain and a routed choice (offline scan); it becomes a
 * dialog beat, so its choice routes.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const GLOOMGILL_INTRO = (() => {
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const b = beats.find(x => x?.id === "gloomgill_intro"); if (!b) { conflicts.push("gloomgill_intro not found"); return { changes, report, conflicts }; }
    const chained = !!(b.cinematic && b.cinematic.enabled && (b.cinematic.startSceneId || b.cinematic.nextSceneId));
    if (b.type === "cinematic" && !chained) { b.type = "dialog"; changes++; report.push("✚ gloomgill_intro: type cinematic → dialog (its choice routes)"); }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = GLOOMGILL_INTRO;
} else (async () => {
  const DRY_RUN = (globalThis.__gloomDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = GLOOMGILL_INTRO.apply(camp);
  console.log(`[gloomgill intro dialog 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__gloom = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-gloomgill-intro-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — Gloomgill's intro routes (${changes}).`);
})();
