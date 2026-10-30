/**
 * patch-fixit-answer-beats-2026-10-30.macro.js — Dave, 10-30: "Drink the Coffee doesn't do anything and just loops back to
 * the main arc bay menu." The last two description-as-answer choices in the campaign (next = their own hub, the answer
 * sitting in the button's description — the pattern the 10-26 dead-end sweep turned into ans_* beats):
 *   fixit_arc_bay_conversation "Drink the coffee."  → NEW ans_fixit_arc_bay_drink_the_coffee (Back to the bay / Leave)
 *   fixit_town_walk           "Browse the yard"     → NEW ans_fixit_town_walk_browse_the_yard (Back to the yard)
 * The answer text moves into the new beat (same words); the parent's choice description is cleared. Answer beats route
 * BACK to their hub (never end the chain). Same scene + speaker as the parent.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const B = (id) => beats.find(x => x && String(x.id) === id);
  const report = []; const conflicts = []; let changes = 0;
  const ch = (label, next) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" });

  const ROWS = [
    { hub: "fixit_arc_bay_conversation", match: /^Drink the coffee/i, id: "ans_fixit_arc_bay_drink_the_coffee",
      label: "Furrier's Fixit Farm — Arc Bay — Drink the coffee",
      exits: [ch("Back to the bay.", "fixit_arc_bay_conversation"), ch("Leave", "fixit_intro_scene")] },
    { hub: "fixit_town_walk", match: /^Browse the yard/i, id: "ans_fixit_town_walk_browse_the_yard",
      label: "Furrier's Fixit Farm — Browse the Yard",
      exits: [ch("Back to the yard.", "fixit_town_walk")] }
  ];
  for (const r of ROWS) {
    const hub = B(r.hub); if (!hub) { conflicts.push(`${r.hub}: beat not found`); continue; }
    const c = (hub.choices || []).find(x => r.match.test(String(x.label || "")));
    if (!c) { conflicts.push(`${r.hub}: choice not found`); continue; }
    let ans = B(r.id);
    const text = String(c.description || "").trim();
    if (!ans) {
      if (!text) { conflicts.push(`${r.hub}: no answer text on the choice and no ${r.id} yet`); continue; }
      ans = { id: r.id, label: r.label, type: "dialog", tags: "answer fixit", politicalTags: "", speakerActorId: hub.speakerActorId ?? null,
        sceneId: hub.sceneId ?? null, hexName: null, targetHexUuid: null, outcomes: { success: null, failure: null }, actors: [],
        encounter: { key: "", tier: null, actorName: "" }, refs: {}, playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true,
        playerFacingContent: true, showToPlayers: true, description: text, choices: r.exits,
        inject: { repeatable: true, evergreen: true, requires: JSON.parse(JSON.stringify(hub.inject?.requires || [])) },
        dialogueOffer: false, timeScale: "moment", timePoints: 0, worldEffects: {}, ...(hub.where ? { where: hub.where } : {}) };
      beats.push(ans); changes++; report.push(`✚ ${r.id}: new answer beat (${text.slice(0, 60)}…)`);
    }
    if (c.next !== r.id) { report.push(`✎ ${r.hub} "${c.label}": next ${c.next} → ${r.id}`); c.next = r.id; changes++; }
    if (String(c.description || "").trim()) { c.description = ""; changes++; report.push(`✎ ${r.hub} "${c.label}": answer text moved off the button`); }
  }
  if (!Array.isArray(camp.beats)) conflicts.push("campaign beats are not an array — cannot add beats safely");

  console.log(`[fixit answer beats 2026-10-30] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__fixitAns = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-fixit-answers-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the coffee and the yard have their own answers.`);
})();
