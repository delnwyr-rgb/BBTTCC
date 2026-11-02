/**
 * patch-waiting-room-act2-door-2026-11-01.macro.js — Dave, 11-01: "I went to the Waiting Room to talk to Doc Greeley about the
 * roster, but it won't let me in as we have its beats gated to act 1."
 *
 * The Waiting Room is reached only from the Act 1 Welcome Round (allesh_gilliam_town_walk, storyPhase ≤ 1) and its own
 * exterior; its intro is once-only, and both exits lead back to the Act 1 walk. In Act 2 nothing opens the bar — yet the
 * Khezek-Tor Official Word's "room" step sends the table to Greeley for the back-room roster (kt_good_room, which also needs
 * the manifest from Below Four in hand).
 *   • Pike's Act 2 hub gains the door "The Waiting Room — Doc Greeley" → allesh_gilliam_waiting_room_exterior (storyPhase ≥ 2)
 *   • allesh_gilliam_waiting_room_intro: repeatable (a bar is a hub), a return-aware opening, and Act-aware exits —
 *     "Leave" (→ the Act 1 Round) only in Act 1, "Back to the HQ" (→ Pike's hub) from Act 2 on
 *   • ag_greeley_answer_cough (once-only lore): same Act-aware exits
 *   • the Khezek-Tor script's "room" step says to bring the manifest (its beat is gated on kt_dropped_manifest)
 * Draft-1 prose. Pure `apply(camp)` (node lint proof) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first.
 * Backup → Data/bbttcc-exports/. GM only.
 */
const WAITING_ROOM_PATCH = (() => {
  const HUB = "allesh_gilliam_introduction_to_hq", EXT = "allesh_gilliam_waiting_room_exterior", INTRO = "allesh_gilliam_waiting_room_intro", COUGH = "ag_greeley_answer_cough", WALK = "allesh_gilliam_town_walk";
  const DOOR = { label: "The Waiting Room — Doc Greeley", next: EXT, description: "The clinic that's a bar. Greeley pours before you've sat, and keeps the back room shut.", checkStat: "", checkDC: 0, failNext: "", requires: [{ flag: "storyPhase", gte: 2 }] };
  const BACK = { label: "Back to the HQ", next: HUB, description: "", checkStat: "", checkDC: 0, failNext: "", requires: [{ flag: "storyPhase", gte: 2 }] };
  const MARKER = "{{#played ag_greeley_answer_cough|kt_good_room|kt_good_room_fail|kt_back_room_roster}}";
  const RETURN = "WAITING ROOM, still. The triage chairs face the counter and Doc Greeley pours before you've sat down, which means she has already decided what you need. The back room is still shut. It is always still shut.";
  const ROOM_OLD = "Ask Doc Greeley what the back room at the Waiting Room is for.";
  const ROOM_NEW = "Ask Doc Greeley what the back room at the Waiting Room is for. Bring the manifest from Below Four — she wants something to read.";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    for (const id of [HUB, EXT, INTRO, COUGH, WALK]) if (!byId.has(id)) conflicts.push(`${id}: beat not found`);
    if (conflicts.length) return { changes, report, conflicts };
    const addChoice = (b, ch, beforeRe) => { b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(c => c && c.label === ch.label)) { report.push(`· ok ${b.id} "${ch.label}"`); return; } const at = b.choices.findIndex(c => c && beforeRe.test(String(c.label || ""))); if (at >= 0) b.choices.splice(at, 0, { ...ch }); else b.choices.push({ ...ch }); changes++; report.push(`✚ ${b.id}: "${ch.label}"`); };
    const gateChoice = (b, next, row, what) => { for (const c of (b.choices || [])) { if (!c || String(c.next) !== next) continue; const rows = Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : []); if (rows.some(r => JSON.stringify(r) === JSON.stringify(row))) { report.push(`· ok ${b.id} "${c.label}" ${what}`); continue; } c.requires = [...rows, row]; changes++; report.push(`✚ ${b.id} "${c.label}": ${what}`); } };
    // 0 · the bar is EVERGREEN — its beats are Act 1 content by gate (storyPhase ≥ 1) and the director seals done acts once
    //     Act 2 opens; inject.evergreen keeps a town's standing door open across acts (lint S01's own remedy)
    for (const id of [EXT, INTRO, COUGH]) { const b = byId.get(id); b.inject = b.inject || {}; if (b.inject.evergreen !== true) { b.inject.evergreen = true; changes++; report.push(`✚ ${id}: evergreen (never act-sealed)`); } else report.push(`· ok ${id} evergreen`); }
    // 1 · the Act 2 door on Pike's hub
    addChoice(byId.get(HUB), DOOR, /^call it a day/i);
    // 2 · the bar is a hub
    const intro = byId.get(INTRO);
    intro.inject = intro.inject || {};
    if (intro.inject.repeatable !== true) { intro.inject.repeatable = true; changes++; report.push(`✚ ${INTRO}: repeatable`); } else report.push(`· ok ${INTRO} repeatable`);
    const d = String(intro.description || "");
    if (!d.startsWith(MARKER)) { intro.description = `${MARKER}${RETURN}{{else}}${d}{{/played}}`; changes++; report.push(`✚ ${INTRO}: opening knows a return`); } else report.push(`· ok ${INTRO} opening knows a return`);
    for (const id of [INTRO, COUGH]) { const b = byId.get(id); gateChoice(b, WALK, { flag: "storyPhase", lte: 1 }, "the Round exit is Act 1 only"); addChoice(b, BACK, /^(leave|back to the round)$/i); }
    // 3 · the quest log says to bring the manifest
    const step = camp.story?.scripts?.khezek_tor?.steps?.find?.(s => s && s.id === "room");
    if (!step) report.push("⚠ khezek_tor script: room step not found");
    else if (step.line === ROOM_NEW) report.push("· ok khezek_tor.room line");
    else if (step.line === ROOM_OLD) { step.line = ROOM_NEW; changes++; report.push("✚ khezek_tor.room line: bring the manifest"); }
    else report.push(`⚠ khezek_tor.room line was wordsmithed after seeding — left alone: "${step.line}"`);
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = WAITING_ROOM_PATCH;                                 // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = WAITING_ROOM_PATCH.apply(camp);
  console.log(`[waiting room act 2 door 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__waitingRoomDoor = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-waiting-room-act2-door-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Waiting Room is open from Pike's hub.`);
})();
