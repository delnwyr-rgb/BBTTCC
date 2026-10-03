/* patch-burnt-flats-quest-registry-2026-10-02.macro.js — GM, world script macro.
 *
 * Fixes the 6 lint ERRORs (Q01 ×4, Q02 ×2) found on Golden Master 13 (2026-10-02):
 * the Widening Trail retrofit (2026-09-27) moved the Burnt Flats chapter's beats onto a NEW quest id
 * `quest_burnt_flats` that was never added to the quest registry, while the story data uses the old
 * Flats registry entry `quest_x8T2VkPUjhvp2vDM` as the PARENT Widening Trail quest — so the Quest Log
 * shows the whole Trail as "The Burnt Flats" and the Flats' own accept/complete rows name a quest that
 * doesn't exist.
 *
 * Registry-only fix (beats and campaign.story are untouched):
 *   • registers `quest_burnt_flats` as "The Burnt Flats", taking over the Flats description;
 *   • renames `quest_x8T2VkPUjhvp2vDM` to "The Widening Trail" with a Trail description (draft — WORDSMITH).
 *
 * HOW TO RUN: 1) as-is (DRY_RUN = true) → read the console (F12); 2) set DRY_RUN = false, run again
 * (a backup of the quests setting downloads first); 3) F5. Idempotent: a second apply changes nothing.
 * On a golden master: apply, then save the golden again.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const TAG = "[patch-burnt-flats-registry]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const MAIN = "quest_x8T2VkPUjhvp2vDM", FLATS = "quest_burnt_flats";
  const TRAIL_NAME = "The Widening Trail";
  // WORDSMITH (draft 1): the Trail's own quest-log description
  const TRAIL_DESC = "Six places in a line toward the coast, and every one of them is a little wrong in the same direction. A chapel that keeps re-aligning, ash that won't cool, a mire that sings, pilings with shoulders. Somebody is routing something inland. Follow the tilt.";

  const raw = game.settings.get("bbttcc-campaign", "quests");
  const quests = foundry.utils.deepClone(typeof raw === "string" ? JSON.parse(raw) : (raw || {}));
  const main = quests[MAIN];
  if (!main) return ui.notifications.error(`${TAG} ${MAIN} is not in the quest registry — nothing to fix here.`);

  const lines = []; let changes = 0;
  const now = Date.now();

  if (!quests[FLATS]) {
    // the Flats keeps the Flats description that has been sitting on the main entry
    const flatsDesc = (main.name === "The Burnt Flats") ? main.description : (main.flatsDescription || main.description || "");
    quests[FLATS] = { id: FLATS, v: 1, name: "The Burnt Flats", description: flatsDesc, tags: [], status: main.status || "active",
      order: Number(main.order || now) + 1, campaignId: main.campaignId, createdTs: now, updatedTs: now };
    changes++; lines.push(`+ registered ${FLATS} "The Burnt Flats"`);
  } else lines.push(`· ${FLATS} already registered`);

  if (main.name !== TRAIL_NAME) {
    quests[MAIN] = { ...main, name: TRAIL_NAME, description: TRAIL_DESC, updatedTs: now };
    changes++; lines.push(`✎ ${MAIN} renamed "${main.name}" → "${TRAIL_NAME}"`);
  } else lines.push(`· ${MAIN} already named "${TRAIL_NAME}"`);

  console.log(TAG, (DRY_RUN ? "DRY RUN" : "APPLY"), "\n  " + lines.join("\n  "));
  if (!changes) return ui.notifications.info(`${TAG} nothing to do — already fixed.`);
  if (DRY_RUN) return ui.notifications.info(`${TAG} DRY RUN: ${changes} change(s). Set DRY_RUN = false to apply.`);

  try { foundry.utils.saveDataToFile(JSON.stringify(raw), "application/json", `backup-quests-before-burnt-flats-${now}.json`); }
  catch (e) { return ui.notifications.error(`${TAG} backup failed — not writing. ${e?.message || e}`); }
  await game.settings.set("bbttcc-campaign", "quests", quests);
  ui.notifications.info(`${TAG} applied ${changes} change(s). F5 now.`);
})();
