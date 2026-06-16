/* Bad Eden — World Overview · region box VISIBILITY toggle (GM macro, in-world)
 *
 * Hides/shows the overview's region hit-boxes WITHOUT moving or relabelling them.
 * Names stay visible either way; the boxes stay clickable either way (the controller
 * hit-tests their bounds, and still highlights them on hover).
 *
 *   SHOW = false  → invisible boxes, names only (the pretty play view)
 *   SHOW = true   → translucent boxes visible, so you can drag/reshape them
 */
(async () => {
  const SCOPE = "bbttcc-travel";
  const SHOW = false;   // flip to true when you want to reposition the boxes
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const hub = game.scenes.find(s => s.getFlag(SCOPE, "isWorldHub"));
  if (!hub) return ui.notifications.error("No overview hub scene found.");
  const regions = hub.drawings.filter(d => d.flags?.[SCOPE]?.regionLink);
  if (!regions.length) return ui.notifications.warn("No region links on the overview.");
  await hub.updateEmbeddedDocuments("Drawing", regions.map(d => ({
    _id: d.id,
    fillAlpha: SHOW ? 0.22 : 0,
    strokeAlpha: SHOW ? 0.9 : 0,
    textAlpha: 1
  })));
  ui.notifications.info(`${regions.length} region ${SHOW ? "boxes shown (drag to reposition)" : "boxes hidden — names only"}.`);
})();
