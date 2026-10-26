/* patch-market-drop-starter-rig-war.console.js — RG10 (2026-10-26). GM console, any world (Bad Eden + show world).
 * Removes the legacy `kind:"rig"` catalog entry "starter-rig-war" (and any other `kind:"rig"` row — they deliver a
 * flag rig via api.factions.addRig, not a rig actor) from the LIVE bbttcc-market "catalog" setting. Rigs sell as
 * `kind:"actor"` entries pointing at bbttcc-master-content.vehicles templates. Idempotent: rerun → 0 changes.
 * Copies the setting with JSON.parse(JSON.stringify()) (never deepClone — see feedback_settings_patch_true_copy). */
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const MOD = "bbttcc-market";
  const before = JSON.parse(JSON.stringify(game.settings.get(MOD, "catalog") || []));
  const dropped = before.filter(e => e?.id === "starter-rig-war" || String(e?.kind || "").toLowerCase() === "rig");
  const after = before.filter(e => !dropped.includes(e));
  if (!dropped.length) { console.log("[RG10] live catalog has no legacy rig rows — 0 changes"); return ui.notifications.info("RG10: nothing to drop (0 changes)."); }
  await game.settings.set(MOD, "catalog", after);
  const check = (game.settings.get(MOD, "catalog") || []).filter(e => e?.id === "starter-rig-war" || String(e?.kind || "").toLowerCase() === "rig").length;
  console.log(`[RG10] dropped ${dropped.length} legacy rig row(s):`, dropped.map(e => `${e.id} (${e.name})`), `· remaining legacy rows after write: ${check}`);
  ui.notifications.info(`RG10: dropped ${dropped.length} legacy rig catalog row(s); rerun should read 0.`);
})();
