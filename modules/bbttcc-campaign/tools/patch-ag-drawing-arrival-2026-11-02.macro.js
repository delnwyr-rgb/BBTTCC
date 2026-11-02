/**
 * patch-ag-drawing-arrival-2026-11-02.macro.js — Dave, 11-02: "I don't think Pike should be a default town hub for AG" + "the quest
 * list + town maps with quest markers over the buildings should be fine". The campaign's hexOverride no longer lists Pike's office,
 * but the Allesh-Gilliam hex DRAWING carries its own flags.bbttcc-territory.campaign.onEnterBeatId = allesh_gilliam_introduction_to_hq,
 * which readOnEnterBeatIds appends to the arrival list — so every Act 2 arrival (and "You're in Allesh-Gilliam already — go on in")
 * still opened Pike. This clears that drawing flag (scene data, not campaign data). Idempotent. DRY_RUN first. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const BEAT = "allesh_gilliam_introduction_to_hq";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const hits = [];
  for (const sc of game.scenes) for (const d of sc.drawings) { const tf = d.flags?.["bbttcc-territory"]; if (tf?.campaign?.onEnterBeatId === BEAT || tf?.onEnterBeatId === BEAT) hits.push(d); }
  const report = hits.map(d => `✚ ${d.parent.name} · ${d.flags["bbttcc-territory"].name}: drawing arrival ${BEAT} cleared`);
  console.log(`[ag drawing arrival 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${hits.length} change(s)\n` + (report.join("\n") || "· nothing to change"));
  globalThis.__agDrawing = { dry: DRY_RUN, changes: hits.length, report };
  if (DRY_RUN || !hits.length) return ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${hits.length} change(s); see console.`);
  for (const d of hits) await d.update({ "flags.bbttcc-territory.campaign.-=onEnterBeatId": null, "flags.bbttcc-territory.-=onEnterBeatId": null });
  ui.notifications.info(`Applied ${hits.length} change(s) — Allesh-Gilliam arrives on the town map.`);
})();
