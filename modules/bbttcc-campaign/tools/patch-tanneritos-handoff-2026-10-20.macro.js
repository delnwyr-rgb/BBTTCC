/* patch-tanneritos-handoff-2026-10-20.macro.js — THE NEW EPISODE'S PEN CHANGES HANDS (Dave, Story Review Ledger round 2 open asks, 2026-10-20):
 *  "I think it needs an awesome beat, where the handoff is deliberate and the Tanneritos are awesome. Donny reveals he has director experience."
 *
 *  Chuckle Creek's New Episode ending leaves the coalition writing the town ("There is a mall down the coast full of them, you're told;
 *  until you find it, the pen is yours"). The hand-off lived only in a GM note on The Showrunner. Now:
 *
 *   NEW  mall_new_episode_handoff   Crown Mall food court, Act 3, once the table holds the pen (chuckle_new_episode) and the Tanneritos
 *                                   have let them in (friendly / Donny's vibe check / the good resolution). The room goes quiet, Bev writes
 *                                   the format down, Kickflip has the broadcast master, Donny comes in off the wall: two seasons of daytime
 *                                   before the Shattering. Repeatable until the pen is handed over.
 *   NEW  mall_pen_handed            the Tanneritos take it and pay for it (the first real feeling per arc comes out of their own stock)
 *   NEW  mall_pen_kept              the coalition keeps the pen for now; the format stays on the legal pad
 *   EDIT chuckle_showrunner         the GM note points at the beat
 *
 *  Speaker ids: Donny oK6BVjLAWntCWxtp (the hand-off), none on the two outcomes. Scene = the food court Qa8fnrZWZRHGHOjn.
 *  Idempotent (id guards); DRY_RUN default true; backs up `campaigns`. GM only.
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

  const HAND = "mall_new_episode_handoff", HANDED = "mall_pen_handed", KEPT = "mall_pen_kept";
  const FOOD_COURT = "Qa8fnrZWZRHGHOjn", DONNY = "oK6BVjLAWntCWxtp";
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const base = (id, label, type, description, memoryText, requires, choices, extra = {}) => ({
    id, label, type, timeScale: "scene", timePoints: 0, questId: "quest_forgotten_yesterdays",
    tags: "quest:forgotten-yesterdays,theme.tanneritos,theme.chuckle_creek", politicalTags: "",
    description, memoryText, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    sceneId: FOOD_COURT, story: { quest: "crown_mall", chapter: "the_mall_of_forgotten_yesterdays" }, choices, worldEffects: {}, ...extra
  });

  const HAND_DESC = "You bring it up at the food court because there is nowhere else in Bad Eden to bring it up: a town down the coast that is a show, a dead woman's projector still running, and a pen that has been yours since the night you took the microphone. You expected a joke. You get silence, which here is the rarest thing a room can give you.\n\nLaser Bev puts the glitter pen down. Miss June stops a tape mid-rewind. On the halfpipe somebody bails on purpose so as not to land loud. \"Say the premise again,\" Bev says, and you do, and she writes it on the legal pad in letters that do not glitter: ONE REAL FEELING PER ARC. \"That's not a bit. That's a format. We can run a format.\"\n\nKickflip drops off the upper rail and lands without a sound. \"Chuckle Creek. Halloween '77. I have the broadcast master. Donny, tell them.\"\n\nDonny has come in off the wall, which nobody present has ever seen him do, and he fills the doorway with the courtesy of something that could fill the room. \"Two seasons of daytime, little my dudes. Before the Shattering. Studio hours, a craft table, a woman on second camera who never once missed a mark.\" A smoke ring, slow. He does not say her name. He does not have to. \"I know the difference between a show that is kind and a show that is scared. Hers is scared. Ours won't be.\"\n\nThe Tanneritos are not unserious. They are, for the first time since you met them, entirely committed, and it is a little frightening how fast that happened. The pen is on the table between you. Nobody reaches for it until you say so.";
  const HAND_MEM = "At the Crown Mall the Tanneritos asked for the New Episode's pen, on purpose and in silence. Donny directed two seasons of daytime before the Shattering.";
  const HANDED_DESC = "Bev signs the legal pad like a contract, because it is one. Miss June labels a blank tape NEW EPISODE · S01E01 and files it under KEEPERS before anything is on it. Kickflip is already drawing a shot list on a napkin that will outlast the napkin.\n\nThe Tanneritos pay for it. The first real feeling per arc comes out of their own stock, and they know it, and they sign anyway, which is the most serious thing you have seen anyone do in a windbreaker. Chuckle Creek stays on somebody else's schedule. For the first time since 2077 the somebody is a crew that would rather be good than safe.\n\nDonny goes back to the wall. The smoke rings are rounder.";
  const HANDED_MEM = "The coalition handed the New Episode's pen to the Tanneritos at the Crown Mall. Donny directs; Bev runs the format; Miss June keeps the tapes. Chuckle Creek is written by people who take fun seriously.";
  const KEPT_DESC = "You keep the pen, for now. Bev nods like a woman filing a counter-offer, which she is. \"Format's on the pad when you want it. We don't do deadlines. We do shows.\" Kickflip is back on the rail before you see him move. Donny goes back to the wall without a word, which is a review.";
  const KEPT_MEM = "The coalition kept the New Episode's pen for now. The Tanneritos' format is on Bev's legal pad, waiting.";

  // 1. the hand-off
  if (!byId.get(HAND)) {
    const nb = base(HAND, "Crown Mall — The Pen Changes Hands", "dialog", HAND_DESC, HAND_MEM,
      [{ flag: "storyPhase", gte: 3 }, { beatMark: "chuckle_new_episode" },
       { anyOf: [{ beatMark: "enc_forgotten_yesterdays_tanneritos_friendly" }, { beatMark: "enc_forgotten_yesterdays_donny_good" }, { beatMark: "enc_forgotten_yesterdays_resolution_good" }] },
       { beatMark: HANDED, not: true }],
      [ch("Hand over the pen.", HANDED, "Bev picks it up like it weighs something. It does."),
       ch("Keep writing it yourselves, for now.", KEPT, "The format stays on the pad. The offer stays open.")],
      { priority: "high", speakerActorId: DONNY, storyChain: "crown_mall" });
    nb.inject.repeatable = true; nb.inject.evergreen = true;
    const anchor = byId.get("enc_forgotten_yesterdays_tanneritos_friendly");
    const at = anchor ? camp.beats.indexOf(anchor) + 1 : camp.beats.length;
    camp.beats.splice(at, 0, nb); byId.set(HAND, nb); changes++; report.push(`✚ beat ${HAND} — ${nb.label}`);
  } else report.push(`· ok ${HAND}: present`);
  // 2. handed
  if (!byId.get(HANDED)) {
    const nb = base(HANDED, "Crown Mall — The Tanneritos Take the Pen", "narration", HANDED_DESC, HANDED_MEM,
      [{ flag: "storyPhase", gte: 3 }], [ch("Continue", "", "")], { priority: "background" });
    const at = camp.beats.indexOf(byId.get(HAND)) + 1;
    camp.beats.splice(at, 0, nb); byId.set(HANDED, nb); changes++; report.push(`✚ beat ${HANDED} — ${nb.label}`);
  } else report.push(`· ok ${HANDED}: present`);
  // 3. kept
  if (!byId.get(KEPT)) {
    const nb = base(KEPT, "Crown Mall — The Format Stays on the Pad", "narration", KEPT_DESC, KEPT_MEM,
      [{ flag: "storyPhase", gte: 3 }], [ch("Continue", "", "")], { priority: "background" });
    nb.inject.repeatable = true;
    const at = camp.beats.indexOf(byId.get(HANDED)) + 1;
    camp.beats.splice(at, 0, nb); byId.set(KEPT, nb); changes++; report.push(`✚ beat ${KEPT} — ${nb.label}`);
  } else report.push(`· ok ${KEPT}: present`);
  // 4. the GM note points at it
  {
    const b = byId.get("chuckle_showrunner");
    const from = "When the stewards meet them, the New Episode's pen can be handed off — and the Tanneritos pay for it.";
    const to = "When the stewards meet them, the New Episode's pen can be handed off at the food court (mall_new_episode_handoff) — and the Tanneritos pay for it.";
    if (!b) report.push("⚠ chuckle_showrunner: not found");
    else if (String(b.description).includes(to)) report.push("· ok chuckle_showrunner: GM note points at the beat");
    else if (String(b.description).includes(from)) { b.description = b.description.replace(from, to); changes++; report.push("✚ chuckle_showrunner: GM note points at the hand-off beat"); }
    else report.push("⚠ chuckle_showrunner: GM note baseline not found");
  }

  console.log(`[tanneritos-handoff 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-tanneritos-handoff-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the pen changes hands.`);
})();
