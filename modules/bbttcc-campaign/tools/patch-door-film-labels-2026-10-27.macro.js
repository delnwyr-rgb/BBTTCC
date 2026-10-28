/* patch-door-film-labels-2026-10-27.macro.js — door films are named for what they show (Dave, 2026-10-27).
 *  Why: "the gates don't have exterior shots, just shots of the gates themselves." Every door cinematic was labelled
 *   "<Town> - <Place> Exterior" (seed-door-cinematics-2026-10-26 + the older hand-made exteriors), but most of the films are
 *   the gate, the room, the field — not the outside of a building.
 *  For each cinematic beat whose label ends " Exterior": resolve its film (cinematic.startSceneId → the scene's background,
 *   else sceneId). If neither the film's file name nor the scene's name says "exterior", drop " Exterior" from the label
 *   ("Allesh-Gilliam - The North Gate Exterior" → "Allesh-Gilliam - The North Gate"). Ids, routing and doors are untouched.
 *  Idempotent; DRY_RUN default true; `campaigns` written as a true JSON copy. GM only. Back up world settings first.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const report = []; let changes = 0;

  const sceneOf = async (b) => {
    const u = b.cinematic?.startSceneId;
    if (u) { const s = await fromUuid(u).catch(() => null); if (s) return s; }
    return b.sceneId ? game.scenes.get(b.sceneId) : null;
  };
  for (const b of camp.beats) {
    if (b?.type !== "cinematic" || !/ Exterior$/.test(String(b.label || ""))) continue;
    const sc = await sceneOf(b);
    const film = String(sc?.background?.src || "").split("/").pop();
    const says = /exterior/i.test(film) || /exterior/i.test(String(sc?.name || ""));
    if (says) { report.push(`· keep  ${b.label}  (${film || sc?.name || "no scene"})`); continue; }
    const to = String(b.label).replace(/ Exterior$/, "");
    report.push(`✎ ${b.id}: "${b.label}" → "${to}"  (${film || sc?.name || "no scene"})`);
    b.label = to; changes++;
  }

  console.log(`[door film labels 2026-10-27] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} label(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — every door film is named for what it shows.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — ${changes} door film label(s) renamed.`);
})();
