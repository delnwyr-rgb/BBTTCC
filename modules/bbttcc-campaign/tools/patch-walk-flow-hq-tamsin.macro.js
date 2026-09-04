/* patch-walk-flow-hq-tamsin.macro.js — Welcome Round flow polish
 * (2026-09-04, owner rulings from From-The-Top run 3 prep).
 *
 * 1) HQ MERGE: "The HQ" and "Marshal Pike, at the HQ" were separate hub
 *    choices — but going to the HQ IS visiting Pike. One hub choice now;
 *    the HQ cinematic's exit routes into Pike's welcome, whose choices
 *    already return to the Round. (hub → cinematic → Pike → Round)
 *
 * 2) TAMSIN WELCOME: Father Tamsin is a major player standing in his own
 *    B&B, yet had no Act-1 welcome/invite — every other face in town sends
 *    a card at the ACT 1 banner. New speaker beat
 *    `allesh_gilliam_tamsin_welcome` (storyPhase >= 1, invite-eligible),
 *    and the St Gilliam's cinematic now flows into it, mirroring the HQ.
 *    His Act-2 conversation (the echo story) stays gated >= 2 — the welcome
 *    is hospitality only.
 *
 * Idempotent; DRY_RUN default true; backs up campaigns. Run as GM.
 * Marker: [WALK-FLOW-2026-09-04]
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
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

  const TAMSIN_ID = "allesh_gilliam_tamsin_welcome";
  const TAMSIN_ACTOR = "I0Gieq4FAol5mklQ";   // Father Tamsin (same actor as his Act-2 conversation)
  const hub = byId.get("allesh_gilliam_town_walk");
  const hq = byId.get("allesh_gilliam_hq_cinematics");
  const stg = byId.get("allesh_gilliam_st_gilliams_cinematics");
  const yarrow = byId.get("allesh_gilliam_yarrow_welcome");
  if (!hub || !hq || !stg || !yarrow) return ui.notifications.error("Walk-flow beats missing — wrong campaign?");

  // ── 1a. hub: drop the separate Pike choice, fold him into The HQ ──────────
  {
    const chs = Array.isArray(hub.choices) ? hub.choices : [];
    const pike = chs.find(c => /marshal pike/i.test(String(c?.label || "")));
    if (!pike) { report.push(`· ok hub: separate Pike choice already gone`); }
    else {
      hub.choices = chs.filter(c => c !== pike);
      changes++;
      report.push(`✚ hub: removed "${pike.label}" (HQ is Pike's)`);
    }
    const hqChoice = (hub.choices || []).find(c => String(c?.next) === "allesh_gilliam_hq_cinematics");
    if (!hqChoice) { report.push(`⚠ hub: no choice routing to HQ cinematics — check by hand`); }
    else if (/marshal/i.test(String(hqChoice.label))) { report.push(`· ok hub: HQ choice already names the Marshal`); }
    else {
      report.push(`✚ hub: "${hqChoice.label}" -> "The HQ — Marshal Pike"`);
      hqChoice.label = "The HQ — Marshal Pike";
      changes++;
    }
  }

  // ── 1b. HQ cinematic exits into Pike's welcome ────────────────────────────
  {
    const c0 = (hq.choices || [])[0];
    if (c0 && String(c0.next) === "allesh_gilliam_yarrow_welcome") {
      report.push(`· ok hq_cinematics: already flows into Pike`);
    } else if (c0) {
      report.push(`✚ hq_cinematics: "${c0.label}" -> "Find the Marshal" (routes to Pike's welcome; his choices return to the Round)`);
      c0.label = "Find the Marshal";
      c0.next = "allesh_gilliam_yarrow_welcome";
      changes++;
    } else {
      report.push(`⚠ hq_cinematics: no choices — check by hand`);
    }
  }

  // ── 2a. Father Tamsin's welcome beat ──────────────────────────────────────
  if (byId.get(TAMSIN_ID)) {
    report.push(`· ok ${TAMSIN_ID}: already exists`);
  } else {
    const tamsin = {
      id: TAMSIN_ID,
      label: "Allesh-Gilliam — Nobody Gets Measured",
      type: "dialog",
      questId: String(hub.questId || "quest_Cq1v3hJpXarX5rXJ"),
      questStep: 434,
      timeScale: "scene",
      timePoints: 0.25,
      speakerActorId: TAMSIN_ACTOR,
      inviteText: "keeps the door of St Gilliam's open and the kettle warm — come be un-measured for an hour.",
      description:
        "St Gilliam's was a church before it was a bed-and-breakfast, and the argument isn't " +
        "settled — the pews went to firewood years ago, but the light through the windows still " +
        "lands like it's looking for somebody. Father Tamsin comes out from the back drying his " +
        "hands on a towel that has seen every kind of day. \"You'll be the coalition.\" Not a " +
        "question; the whole town has said it by now. \"I keep four rooms, a kettle, and one " +
        "policy: nobody gets measured at this door. Sit — the bread's an hour old and the chairs " +
        "hardly wobble.\" He sets out cups without asking how many you are. He counted while you " +
        "were deciding whether to come in.",
      choices: [
        {
          label: "Sit for the bread and the quiet",
          next: "allesh_gilliam_town_walk",
          description: "An hour where nobody wants anything from you. It's louder than it sounds.",
          checkStat: "", checkDC: 0, failNext: ""
        },
        {
          label: "Ask what the building used to be",
          next: "allesh_gilliam_town_walk",
          description: "He'll tell you about the church — the parts of the story that belong to daylight, anyway.",
          checkStat: "", checkDC: 0, failNext: ""
        },
        {
          label: "Thank him — the Round isn't finished",
          next: "allesh_gilliam_town_walk",
          description: "\"The kettle doesn't hold it against you. Neither do I.\"",
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
    const stgIdx = beats.indexOf(stg);
    beats.splice(stgIdx + 1, 0, tamsin);
    byId.set(TAMSIN_ID, tamsin);
    changes++;
    report.push(`✚ ${TAMSIN_ID}: created (speaker Father Tamsin, storyPhase >= 1 — joins the ACT 1 invite wave)`);
  }

  // ── 2b. St Gilliam's cinematic exits into Tamsin's welcome ────────────────
  {
    const c0 = (stg.choices || [])[0];
    if (c0 && String(c0.next) === TAMSIN_ID) {
      report.push(`· ok st_gilliams_cinematics: already flows into Tamsin`);
    } else if (c0) {
      report.push(`✚ st_gilliams_cinematics: "${c0.label}" -> "The kettle is warm — find Father Tamsin"`);
      c0.label = "The kettle is warm — find Father Tamsin";
      c0.next = TAMSIN_ID;
      changes++;
    } else {
      report.push(`⚠ st_gilliams_cinematics: no choices — check by hand`);
    }
  }

  console.log(`[patch-walk-flow-hq-tamsin] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Walk-flow DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Walk-flow: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-walk-flow-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Walk-flow APPLIED: ${changes} change(s). The HQ is Pike's; the kettle is Tamsin's.`);
})();
