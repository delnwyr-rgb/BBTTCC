/* patch-welcome-round-soma-break.macro.js — give the Welcome Round a real
 * night (2026-08-30, owner spec from the From-The-Top run).
 *
 * The hub's "Call it a day" kicked straight to the Crossroads, which carries
 * its OWN "Enough riding — make camp" closer — two day-enders in a row, no
 * night between. Owner ruling: day 1 (the Welcome Round) closes on a SOMA
 * BREAK beat; day 2 opens at the Crossroads framed as surveying the new land;
 * ag_days_end keeps its job as the TURN closer (divvy → plan → Turn Driver).
 *
 * Three idempotent operations:
 *  1. Insert beat `ag_first_night_soma_break` (questStep 430 — between the
 *     hub at 420 and the Crossroads at 450, so quest-order NEXT walks
 *     hub → night → crossroads on its own).
 *  2. Re-route the hub's "Call it a day" choice to the new beat.
 *  3. Prepend a marker-tagged day-two surveying frame to the Crossroads
 *     description.
 *
 * Bonus rhyme: the Soma Break is a TERMINAL beat, so the evening's awaited
 * beat chain settles right there — day boundaries double as chain-settlement
 * points (the lesson of the parked Joans phaseAdvance, same session).
 *
 * Idempotent; DRY_RUN default true; backs up campaigns. Run as GM.
 * Marker: [SOMA-BREAK-2026-08-30]
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const MARKER = "[SOMA-BREAK-2026-08-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = []);
  const byId = new Map(beats.map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  const NIGHT_ID = "ag_first_night_soma_break";
  const hub = byId.get("allesh_gilliam_town_walk");
  const crossroads = byId.get("ag_crossroads_first_rides");
  if (!hub) return ui.notifications.error("allesh_gilliam_town_walk not found — wrong campaign?");
  if (!crossroads) return ui.notifications.error("ag_crossroads_first_rides not found — wrong campaign?");

  // ── 1. the First Night beat (shape mirrors ag_days_end's field style) ──────
  if (byId.get(NIGHT_ID)) {
    report.push(`· ok ${NIGHT_ID}: already exists`);
  } else {
    const night = {
      id: NIGHT_ID,
      label: "Allesh-Gilliam — First Night",
      type: "dialog",
      questId: String(hub.questId || "quest_Cq1v3hJpXarX5rXJ"),
      questStep: 430,
      timeScale: "scene",
      timePoints: 0.5,
      description:
        "The town lets go of you gently — a lamp in a window here, a door pulled to there, " +
        "somebody's supper riding the air all the way down the street. Whatever Allesh-Gilliam " +
        "decided about you today, it decided it kindly enough to let you sleep on it.\n\n" +
        "<b>Take your Soma Break.</b> Clarity refills, Noise settles, and everything marked " +
        "<i>once per Soma Break</i> comes back with the morning. (Stewards: the Soma Break is " +
        "on your sheet — take it now, before the world moves.)\n\n" +
        "Tomorrow the to-do list arrives. Tonight, the ceiling of a building that answers to " +
        "you, and the specific quiet of a town that hasn't decided what to want from you yet.",
      choices: [
        {
          label: "Back into the evening — something left undone",
          next: "allesh_gilliam_town_walk",
          description: "One more door before sleep. The Welcome Round reopens.",
          checkStat: "", checkDC: 0, failNext: ""
        },
        {
          label: "Sleep. Tomorrow, the land.",
          next: "",
          description: "The day is spent and well spent. Soma Breaks all around; the chain settles here.",
          checkStat: "", checkDC: 0, failNext: ""
        }
      ],
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }] },
      playerFacingDialog: true,
      dialogPlayerFacing: true,
      playerFacingContent: true,
      showToPlayers: true,
      playerFacing: true,
      tags: "allesh_gilliam prologue spine"
    };
    // Insert right after the hub so authoring order matches quest order.
    const hubIdx = beats.indexOf(hub);
    beats.splice(hubIdx + 1, 0, night);
    byId.set(NIGHT_ID, night);
    changes++;
    report.push(`✚ ${NIGHT_ID}: created (questStep 430, timePoints 0.5, terminal sleep choice)`);
  }

  // ── 2. re-route the hub's "Call it a day" ─────────────────────────────────
  const cid = (hub.choices || []).find(c => /call it a day/i.test(String(c?.label || "")));
  if (!cid) {
    report.push(`⚠ hub: no "Call it a day" choice found — skipped re-route`);
  } else if (String(cid.next) === NIGHT_ID) {
    report.push(`· ok hub: "Call it a day" already routes to ${NIGHT_ID}`);
  } else {
    report.push(`✚ hub: "Call it a day" ${JSON.stringify(cid.next)} -> "${NIGHT_ID}"`);
    cid.next = NIGHT_ID;
    changes++;
  }

  // ── 3. crossroads day-two surveying frame ─────────────────────────────────
  if (String(crossroads.description || "").includes(MARKER)) {
    report.push(`· ok crossroads: day-two frame already present`);
  } else {
    const frame =
      `<!-- ${MARKER} -->` +
      "Morning of the second day, and the coalition rides out to learn what it now owns. " +
      "Surveying is its own kind of introduction: pacing the hexes, reading the fences, " +
      "finding out which of yesterday's handshakes came with land attached.\n\n";
    crossroads.description = frame + String(crossroads.description || "");
    changes++;
    report.push(`✚ crossroads: day-two surveying frame prepended (marker-tagged)`);
  }

  console.log(`[patch-welcome-round-soma-break] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Soma Break patch DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Soma Break patch: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-soma-break-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Soma Break patch APPLIED: ${changes} change(s). The town gets a night; the land gets a morning.`);
})();
