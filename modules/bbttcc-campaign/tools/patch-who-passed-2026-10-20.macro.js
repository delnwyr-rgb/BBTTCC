/* patch-who-passed-2026-10-20.macro.js — CONVOY RECEIPTS THAT CARRY INFORMATION (Dave, Story Review Ledger round 2 open asks: "Love it let's go!").
 *
 *  The Stormborn stall already promised it ("if you ask the right nomad the right way, paper: who passed this way, what they were carrying,
 *  and which road they were afraid of"). Now the paper exists:
 *
 *   EDIT enc_trade_convoy_stall            + "Ask the right nomad the right way." → the paper (before "Back on the road")
 *   NEW  enc_trade_convoy_paper            the stall-keeper names a price and two kinds of paper; repeatable (the convoy is a travelling vendor)
 *   NEW  enc_trade_convoy_paper_friend     5 marks from the treasury → Receipt "Who Passed — a Friend"  (favorShift: produced in a court it wins
 *                                          a courtier over / sours one against your opponent — the Riders' desk, Legansus, any Parley)
 *   NEW  enc_trade_convoy_paper_warning    5 marks → Receipt "Who Passed — a Warning" (stirThePot: +2 Suspicion on the one you name)
 *   EDIT map_legansus_waystation_intro + legansus_allied_welcome   + "Hand the Riders a Stormborn paper." (needs a paper bought) — the
 *                                          after-text tells the table to produce it from the Domain's Assets and say the name
 *   FIX  "The Caravan Route" Receipt truth  still said "two days coastward of the Long Market" (camp seam) → "two days up the mountain"
 *
 *  One paper, one name, one use: Receipts are consumed when produced; the GM hears the faction's name at the table.
 *  Idempotent (id / text guards); DRY_RUN default true; backs up `campaigns`. GM only.
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

  const STALL = "enc_trade_convoy_stall", PAPER = "enc_trade_convoy_paper", FRIEND = "enc_trade_convoy_paper_friend", WARN = "enc_trade_convoy_paper_warning";
  const SCENE = "X7sdv0sd81jNlpqy";
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const cost = () => [{ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: { economy: -5 }, allowOvercap: false }];
  const base = (id, label, type, description, memoryText, choices, worldEffects, repeatable) => ({
    id, label, type, timeScale: "scene", timePoints: 0, questId: "quest_travel_encounters", tags: "travel trade_convoy stormborn receipt", politicalTags: "",
    description, memoryText, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [] },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    sceneId: SCENE, priority: "background", choices, worldEffects
  });

  /* 1 · the stall sells paper */
  {
    const b = byId.get(STALL);
    if (!b) report.push(`⚠ ${STALL}: not found`);
    else {
      b.choices = Array.isArray(b.choices) ? b.choices : [];
      if (b.choices.some(c => c && c.next === PAPER)) report.push(`· ok ${STALL}: paper door present`);
      else {
        const road = b.choices.findIndex(c => /back on the road/i.test(String(c?.label || "")));
        const door = ch("Ask the right nomad the right way.", PAPER, "She does not look up. \"Paper's extra.\"");
        if (road >= 0) b.choices.splice(road, 0, door); else b.choices.push(door);
        changes++; report.push(`✚ ${STALL}: "Ask the right nomad the right way." → ${PAPER}`);
      }
    }
  }
  /* 2 · the paper */
  const PAPER_DESC = "The right nomad turns out to be the same nomad, which is the joke, and she has heard it. From under the counter comes a tin box, and from the tin box a fold of waxed paper written small on both sides: who passed this way, what they were carrying, and which road they were afraid of. Stormborn don't keep secrets. They keep prices.\n\n\"Five marks a sheet. Two kinds.\" She holds up one finger, then another. \"A friend's name, for when you want somebody at a table to warm to you. A warning, for when you want a room to start wondering about somebody who isn't you.\" She shrugs. \"Same paper. Depends which way you fold it.\"\n\n<i>A Stormborn paper is a Receipt. Produce it in a court or at a Parley from your Domain's Assets, say the name, and the room acts on it. One paper, one name, one use.</i>";
  const PAPER_MEM = "The Stormborn stall sells paper: who passed, what they carried, which road they feared. Five marks a sheet, a friend's name or a warning.";
  if (!byId.get(PAPER)) {
    const nb = base(PAPER, "Trade Convoy — Who Passed", "dialog", PAPER_DESC, PAPER_MEM,
      [ch("Buy a friend's name. (5 marks)", FRIEND, "She writes a name in the margin and folds it toward you."),
       ch("Buy a warning. (5 marks)", WARN, "She writes a name in the margin and folds it away from you."),
       ch("Not today.", "", "\"Buy or move.\" You move.")],
      WE(), true);
    const stall = byId.get(STALL); const at = stall ? camp.beats.indexOf(stall) + 1 : camp.beats.length;
    camp.beats.splice(at, 0, nb); byId.set(PAPER, nb); changes++; report.push(`✚ beat ${PAPER} — ${nb.label}`);
  } else report.push(`· ok ${PAPER}: present`);
  /* 3 · a friend */
  if (!byId.get(FRIEND)) {
    const nb = base(FRIEND, "Trade Convoy — Who Passed, a Friend", "narration",
      "Five marks go into the tin. The paper goes into your coat. On it, in a hand that has written a great many of these: a name, a road, a load, and the one thing about them that a stranger could not know. Say it at the right table and somebody there will remember being owed.",
      "Bought a Stormborn paper: a friend's name. Produce it in a court to win a courtier over.",
      [ch("Continue", "", "")],
      WE({ factionEffects: cost(), receipts: [{ label: "Who Passed — a Friend", effectKey: "favorShift", acquisition: "earned", source: { name: "the Stormborn stall" },
        truth: "A Stormborn paper: who passed this way, what they carried, which road they feared. Produce it in a court or at a Parley and say the faction's name — the room warms to them, or to you on their behalf. One paper, one name, one use." }] }), true);
    const at = camp.beats.indexOf(byId.get(PAPER)) + 1;
    camp.beats.splice(at, 0, nb); byId.set(FRIEND, nb); changes++; report.push(`✚ beat ${FRIEND} — ${nb.label} (5 marks, Receipt favorShift)`);
  } else report.push(`· ok ${FRIEND}: present`);
  /* 4 · a warning */
  if (!byId.get(WARN)) {
    const nb = base(WARN, "Trade Convoy — Who Passed, a Warning", "narration",
      "Five marks go into the tin. The paper goes into your coat, folded the other way. On it: a name, a road, a load, and the road they would not take, which is the part a room will want to hear. Say it at the right table and the room will start looking at somebody who is not you.",
      "Bought a Stormborn paper: a warning. Produce it in a court to stir the pot against the one you name.",
      [ch("Continue", "", "")],
      WE({ factionEffects: cost(), receipts: [{ label: "Who Passed — a Warning", effectKey: "stirThePot", acquisition: "earned", source: { name: "the Stormborn stall" },
        truth: "A Stormborn paper: who passed this way, what they carried, which road they were afraid of. Produce it in a court or at a Parley and say the faction's name — the room grows wary of them. One paper, one name, one use." }] }), true);
    const at = camp.beats.indexOf(byId.get(FRIEND)) + 1;
    camp.beats.splice(at, 0, nb); byId.set(WARN, nb); changes++; report.push(`✚ beat ${WARN} — ${nb.label} (5 marks, Receipt stirThePot)`);
  } else report.push(`· ok ${WARN}: present`);
  /* 5 · the Riders' desk takes paper */
  for (const id of ["map_legansus_waystation_intro", "legansus_allied_welcome"]) {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); continue; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => /stormborn paper/i.test(String(c?.label || "")))) { report.push(`· ok ${id}: paper row present`); continue; }
    const row = ch("Hand the Riders a Stormborn paper.", "", "Produce Who Passed from your Domain's Assets and say the name. A Rider writes it in the margin of the verification log, and the next time that faction comes up on the circuit, the Riders already have an opinion.",
      { requires: [{ anyOf: [{ beatMark: FRIEND }, { beatMark: WARN }] }] });
    const seq = b.choices.findIndex(c => /seven positions/i.test(String(c?.label || "")));
    if (seq >= 0) b.choices.splice(seq, 0, row); else b.choices.push(row);
    changes++; report.push(`✚ ${id}: "Hand the Riders a Stormborn paper." (needs a paper bought)`);
  }
  /* 6 · the Caravan Route Receipt's truth, camp seam */
  for (const b of camp.beats) {
    for (const r of ((b.worldEffects || {}).receipts || [])) {
      if (r && r.label === "The Caravan Route" && typeof r.truth === "string") {
        if (r.truth.includes("two days up the mountain from the Long Market")) { report.push(`· ok ${b.id}: Caravan Route truth`); continue; }
        if (!r.truth.includes("two days coastward of the Long Market")) { report.push(`⚠ ${b.id}: Caravan Route truth baseline not found`); continue; }
        r.truth = r.truth.replace("two days coastward of the Long Market", "two days up the mountain from the Long Market"); changes++; report.push(`✚ ${b.id}: Caravan Route Receipt truth — up the mountain`);
      }
    }
  }

  console.log(`[who-passed 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-who-passed-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Stormborn sell paper.`);
})();
