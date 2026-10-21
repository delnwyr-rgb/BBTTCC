/* patch-runner-loft-2026-10-20.macro.js — THE RUNNER LOFT (Dave, 2026-10-20 evening: "The route board dialog makes no sense to me and seems
 *  to come out of nowhere, and also seems to be talking about Pip's Maneuver Vault scenario? Which is an act 4 quest." → "Yes").
 *
 *  The Back Stairs open to ALLIES, which the Jackalopes become in Act 2 at Thistle's wake — but the only beats up the stairs were
 *  gated on the Maneuver Vault quest (Act 4): `fixit_route_board` (Pip's late route, Vault ACTIVE) and `fixit_route_board_after`
 *  (Vault COMPLETED). An Act-2 allied party climbed the stairs to nothing. The GM note on the stairs promised the loft's reward
 *  ("a look at the pegs tells the party what is moving between hexes this turn, and who is paying to move it") and nobody wrote it.
 *
 *   NEW  fixit_route_board_pegs   the runner loft itself — allies, Act 2+, shown whenever the Vault is NOT in play: Patter reads the
 *                                 wall; the Jackalope wagon's run (corroborates the caravan route), the Riders' circuit, the Stormborn
 *                                 paper; three questions. Repeatable (the wall is current every turn).
 *   EDIT fixit_backstairs_exterior   "Go up — the runner loft" → the pegs (Vault not active, not completed); the two Pip rows stay
 *                                 exactly as they are, so the stairs always have ONE door and it is always the right one.
 *
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const PEGS = "fixit_route_board_pegs", STAIRS = "fixit_backstairs_exterior", VAULT = "quest_NwiADv8ZDoklqwEJ", JACKALOPES = "U5YaO2p189LBMvVq", LOFT_SCENE = "v4GM6b6rvaYJFPCg";
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });

  if (!byId.get(PEGS)) {
    const nb = {
      id: PEGS, label: "Furrier's Fixit Farm — The Runner Loft", type: "dialog", timeScale: "scene", timePoints: 0,
      questId: "quest_nrkJabUwZOLAJFYn", tags: "fixit_farm jackalopes runners", politicalTags: "",
      description: "Up the back stairs the wall is pegs and chalk: every message, light cargo and rumor that crosses the coast gets a peg before it gets a road. Patter reads it for you, because the wall does not read itself.\n\nThree things moving this turn. A wagon that loads at the Long Market every third market day, salt, wax, flour, no meat, and runs two days up the mountain to a camp with no peg of its own; nobody at the Farm has been paid to carry for it, which is the part Patter finds rude. The Riders' circuit, early this month. And a line of pegs down the coast that all say the same thing, which is that somebody down there keeps buying paper.\n\nPip is on the third step with his cap on backwards, not listening, which is how Pip listens.",
      memoryText: "Allies read the wall: the runner loft above the Back Stairs. The Jackalope wagon runs up the mountain to a camp with no peg; the Riders are early; somebody down the coast keeps buying Stormborn paper.",
      outcomes: { success: null, failure: null },
      inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
        requires: [{ flag: "storyPhase", gte: 2 }, { relation: JACKALOPES, is: "allied" }, { questBucket: VAULT, isNot: "active" }, { questBucket: VAULT, isNot: "completed" }] },
      actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      sceneId: LOFT_SCENE, priority: "background", story: { quest: "fixit_farm" },
      choices: [
        ch("Ask about the wagon.", "", "\"Loads at the rope stall. Third market. Pays in advance, in coin that has never been in a pocket.\" She does not say where it goes, because the peg doesn't. Pegs are honest."),
        ch("Ask who pays for the pegs down the coast.", "", "\"Stormborn. They sell what they carry and they carry what they hear.\" Pip, from the step: \"They sold us a peg once. It was about us.\""),
        ch("Ask what Pip and Patter won't carry.", "", "Patter puts the bolts down. \"Anything that has to be early. Early is how you find out you were the cargo.\" Pip does not laugh. That is new."),
        ch("Back down the stairs.", "fixit_intro_scene", "")
      ],
      worldEffects: {}
    };
    const stairs = byId.get(STAIRS); const at = stairs ? camp.beats.indexOf(stairs) + 1 : camp.beats.length;
    camp.beats.splice(at, 0, nb); byId.set(PEGS, nb); changes++; report.push(`✚ beat ${PEGS} — ${nb.label}`);
  } else report.push(`· ok ${PEGS}: present`);

  {
    const b = byId.get(STAIRS);
    if (!b) report.push(`⚠ ${STAIRS}: not found`);
    else {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      if (b.choices.some(c => c?.next === PEGS)) report.push("· ok stairs: loft door present");
      else {
        b.choices.unshift(ch("Go up — the runner loft", PEGS, "Allies read the wall. Nobody else knows there is a wall.", { requires: [{ questBucket: VAULT, isNot: "active" }, { questBucket: VAULT, isNot: "completed" }] }));
        changes++; report.push("✚ stairs: \"Go up — the runner loft\" (whenever the Vault is not in play)");
      }
    }
  }

  console.log(`[runner-loft 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-runner-loft-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — allies read the wall.`);
})();
