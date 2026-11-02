/**
 * patch-good-room-and-muster-return-2026-11-01.macro.js — Dave, 11-01, at Allesh-Gilliam:
 *   "Wish I could have circled back to ask the skill check on what the room is for, but it just ends and says go to KT."
 *   "I have The Muster open in my quest log. I went there, but again it won't open."
 *
 * THE GOOD ROOM — kt_good_room is once-only and both of its real choices lead to the roster, so the Presence DC 12 "what is
 * the room FOR now" rematch vanishes the moment the manifest goes on the bar, and the roster beat ENDS (no exit, no bar).
 *   • kt_back_room_roster gains "Ask what the room is FOR now." — Presence DC 12 → ans_kt_back_room_for (her answer), fail →
 *     ans_kt_back_room_for_miss (she pours; the key stays on its hook) — and "Back to the bar" → the Waiting Room hub.
 *   • both answers exit to the bar. All three are once-only like the roster (the question is asked once).
 * THE MUSTER — allesh_gilliam_muster_intro is once-only: played once (t2), the hub's door greys as "done" and the Militia
 * chapter (no rungs yet — its next rung, bandit_volunteers, waits on banditMercy ≥ 3 in the Bandit Accord) keeps saying
 * "Go to the Muster". A place, not a once-only:
 *   • the intro is repeatable with a return-aware opening and "Ask Brakk what he needs" → ans_ag_muster_brakk_needs
 *     (Brakk's answer names the condition: more spared bandits), exits to the HQ
 *   • the AG script's the_town_militia chapter line tells the truth: Brakk is drilling; the spared orbit the Muster once the
 *     reeds have counted three.
 * Draft-1 prose. Pure `apply(camp)` (node lint proof) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first.
 * Backup → Data/bbttcc-exports/. GM only.
 */
const GOOD_ROOM_MUSTER_PATCH = (() => {
  const ROSTER = "kt_back_room_roster", BAR = "allesh_gilliam_waiting_room_intro", MUSTER = "allesh_gilliam_muster_intro", HUB = "allesh_gilliam_introduction_to_hq";
  const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const beatFrom = (parent, id, label, description, choices) => ({
    id, label, type: "dialog", timeScale: "scene", timePoints: 0, questId: parent.questId || "", tags: parent.tags || "", politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ flag: "storyPhase", gte: 2 }], evergreen: parent.inject?.evergreen === true },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: parent.storyChain || "", priority: "background", ...(parent.speakerActorId ? { speakerActorId: parent.speakerActorId } : {}),
    story: parent.story ? { quest: parent.story.quest } : {}, choices, worldEffects: {}, sceneId: parent.sceneId || "", ...(parent.where ? { where: parent.where } : {})
  });
  const FOR_YES = "“A rematch,” she says, and takes the key off the hook under the good whiskey. “The Cough isn’t done coughing. When the mountain lets go again, whatever it lets go of ends up on my chairs. Last time I had a drawer and a prayer. This time I have the room, and I have read the manifest first.” She hangs the key back up, exactly on its ring mark. “That’s what it’s for. It’s for next time.”";
  const FOR_MISS = "She pours. Whatever it is, it is exactly the right thing for whoever you are, which is her whole trick. The key stays on its hook. “Ask better,” she says, not unkindly. You have the roster already; the room keeps its reasons a while longer.";
  const MUSTER_RETURN = "The bell is working and the boot on the door still points at the horizon. Captain Brakk has the farmers in two lines and is teaching the back line to stop looking at the front line’s feet. He sees you and does not stop counting.";
  const BRAKK_NEEDS = "“Hands,” Brakk says, without looking away from the lines. “I can drill a farmer into a wall in a month. I can’t drill him into a scout. The ones you let walk on the road — they already know how to be quiet in the reeds. Keep letting them walk. The reeds count, and when the count gets high enough they start turning up here on their own.” He finally looks at you. “Three, the way I hear it. You’re at one.”";
  const MUSTER_MARKER = "{{#played ans_ag_muster_brakk_needs|bandit_volunteers}}";
  const MIL_OLD = "Go to the Muster by the North Gate and see what Captain Brakk is building with the bandits you let go.";
  const MIL_NEW = "Captain Brakk is drilling farmers at the Muster by the North Gate. The spared start orbiting it once the reeds have counted three — keep sparing bandits on the road.";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    for (const id of [ROSTER, BAR, MUSTER, HUB]) if (!byId.has(id)) conflicts.push(`${id}: beat not found`);
    if (conflicts.length) return { changes, report, conflicts };
    const addBeat = (nb) => { if (byId.has(nb.id)) { report.push(`· ok beat ${nb.id}`); return byId.get(nb.id); } beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id}`); return nb; };
    const addChoice = (b, c, beforeRe = null) => { b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(x => x && x.label === c.label)) { report.push(`· ok ${b.id} "${c.label}"`); return; } const at = beforeRe ? b.choices.findIndex(x => x && beforeRe.test(String(x.label || ""))) : -1; if (at >= 0) b.choices.splice(at, 0, c); else b.choices.push(c); changes++; report.push(`✚ ${b.id}: "${c.label}"`); };
    // ── the Good Room ──
    const roster = byId.get(ROSTER);
    addBeat(beatFrom(roster, "ans_kt_back_room_for", "Allesh-Gilliam — What the Room Is For", FOR_YES, [ch("Back to the bar.", BAR, "")]));
    addBeat(beatFrom(roster, "ans_kt_back_room_for_miss", "Allesh-Gilliam — The Key Stays on Its Hook", FOR_MISS, [ch("Back to the bar.", BAR, "")]));
    addChoice(roster, ch("Ask what the room is FOR now.", "ans_kt_back_room_for", "A rematch. She takes the key off the hook under the good whiskey — if you ask it right.", { checkStat: "presence", checkDC: 12, failNext: "ans_kt_back_room_for_miss" }), /^fold it into the manifest/i);
    // a table that already holds the roster (the once-only roster beat is behind it) asks the rematch at the bar itself — until
    // Greeley answers; a miss keeps the question open (it is a rematch)
    addChoice(byId.get(BAR), ch("Ask what the back room is FOR now.", "ans_kt_back_room_for", "A rematch. She takes the key off the hook under the good whiskey — if you ask it right.", { checkStat: "presence", checkDC: 12, failNext: "ans_kt_back_room_for_miss", requires: [{ beatMark: ROSTER }, { beatMark: "ans_kt_back_room_for", not: true }] }), /^(put the manifest on the bar|leave|back to the hq)/i);
    // the roster's old end ("Fold it into the manifest" → nothing) now returns to the bar
    for (const c of roster.choices) if (c && /^fold it into the manifest/i.test(String(c.label || "")) && !String(c.next || "")) { c.next = BAR; changes++; report.push(`✚ ${ROSTER} "${c.label}" → back to the bar (was an end)`); }
    // ── the Muster ──
    const muster = byId.get(MUSTER);
    muster.inject = muster.inject || {};
    if (muster.inject.repeatable !== true) { muster.inject.repeatable = true; changes++; report.push(`✚ ${MUSTER}: repeatable (a place)`); } else report.push(`· ok ${MUSTER} repeatable`);
    if (muster.inject.evergreen !== true) { muster.inject.evergreen = true; changes++; report.push(`✚ ${MUSTER}: evergreen`); } else report.push(`· ok ${MUSTER} evergreen`);
    const d = String(muster.description || "");
    if (!d.startsWith(MUSTER_MARKER)) { muster.description = `${MUSTER_MARKER}${MUSTER_RETURN}{{else}}${d}{{/played}}`; changes++; report.push(`✚ ${MUSTER}: opening knows a return`); } else report.push(`· ok ${MUSTER} opening knows a return`);
    addBeat(beatFrom(muster, "ans_ag_muster_brakk_needs", "Allesh-Gilliam — What Brakk Needs", BRAKK_NEEDS, [ch("Back to the HQ", HUB, "")]));
    addChoice(muster, ch("Ask Brakk what he needs.", "ans_ag_muster_brakk_needs", "He is counting. He will answer without stopping."), /^leave$/i);
    const sc = camp.story?.scripts?.allesh_gilliam; const mil = sc?.chapters?.the_town_militia;
    if (!mil) report.push("⚠ allesh_gilliam script: the_town_militia chapter not found");
    else if (mil.line === MIL_NEW) report.push("· ok militia chapter line");
    else if (mil.line === MIL_OLD) { mil.line = MIL_NEW; changes++; report.push("✚ militia chapter line: names the condition (three spared)"); }
    else report.push(`⚠ militia chapter line was wordsmithed after seeding — left alone: "${mil.line}"`);
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = GOOD_ROOM_MUSTER_PATCH;                             // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = GOOD_ROOM_MUSTER_PATCH.apply(camp);
  console.log(`[good room + muster return 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__goodRoomMuster = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-good-room-muster-return-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Greeley takes the rematch; the Muster is a place.`);
})();
