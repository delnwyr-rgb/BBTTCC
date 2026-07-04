/* capture-npc-placement.macro.js — print placement snippets for selected tokens
 *
 * Select one or more tokens, run this: prints a ready-to-paste placement rule
 * (actorId, sceneId, exact x/y) for seed-npc-placements.macro.js or direct
 * campaign.npcPlacements authoring. Read-only.
 */
(() => {
  const toks = canvas?.tokens?.controlled ?? [];
  if (!toks.length) return ui.notifications.warn("Select the token(s) whose spot you want to capture.");
  const out = toks.map(t => JSON.stringify({
    actorId: t.actor?.id || null, actorName: t.actor?.name || t.name,
    sceneId: canvas.scene.id, sceneName: canvas.scene.name,
    x: t.document.x, y: t.document.y
  }, null, 1));
  console.log("[capture-npc-placement]\n" + out.join("\n"));
  ui.notifications.info(`Captured ${toks.length} placement snippet(s) — see console.`);
})();
