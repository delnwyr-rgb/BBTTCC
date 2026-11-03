/**
 * patch-lock-the-turn-2026-11-02.macro.js — "DAY'S END" BECOMES "LOCK THE TURN" (Dave 2026-11-02: "Day's End doesn't make sense any longer.
 * What it means is 'I'm ready to lock this turn and move on.' It doesn't correspond meaningfully to our days and months … Same as 'call it a
 * day' instead of leave. It sounds like you're at the end of something and it's time to rest, which isn't a thing in this game really.")
 *   • ag_days_end "Allesh-Gilliam — Day's End" → "Allesh-Gilliam — Lock the Turn"; days_end_thatwards "Day's End" → "Lock the Turn"
 *   • both openings rewritten without the sunset / the-day-is-spent framing (Dave OK'd the draft)
 *   • every "Call it a day" choice (9, all route into those two beats) → "Ready to move on"
 *   • "Back to the crossroads — daylight left" → "Not yet — back to the crossroads"; "Daylight left — back to it" → "Not yet — back to it"
 *   • their four hub tooltips ("The day is spent … daylight left") → "Lock the turn, or decide you're not done yet."
 *   • the stored quest-log scripts (story.scripts) get the same words as scripts/story-scripts.js
 * Exact-match only: a field that no longer holds the old text is reported as a conflict and left alone. Idempotent (rerun = 0).
 * DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const LOCK_TURN_PATCH = (() => {
  const OLD_AG = "The sun goes down wrong-colored and gorgeous, and the day Thatwards is spent. What the evening is depends on what the day was — the ledger knows, and so does the town.\n\nAnd then — well. Then we find out what was waiting for the ink to dry.\n\nBTW, get ready for lots of extended metaphors.";
  const NEW_AG = "That's enough of the world for one stretch. Whatever you walked into today, you walked into; the rest will keep. The ledger wants to know you're done moving for now — what you settled, and what you're leaving for later. Lock it in and the month rolls on without you watching.\n\nAnd then — well. Then we find out what was waiting for the ink to dry.\n\nBTW, get ready for lots of extended metaphors.";
  const OLD_TH = "The sun goes down wrong-colored and gorgeous, wherever you are standing when it does, and the day Thatwards is spent.\n\nWhatever you settled today is settled. Whatever you didn't will keep — the frontier is patient in the way of things that have already waited a long time. Before the world moves, the ledger wants its three things.\n\nAnd then we find out what was waiting for the ink to dry.";
  const NEW_TH = "Wherever you're standing, this is where you stop pushing for now.\n\nWhatever you settled is settled. Whatever you didn't will keep — the frontier is patient in the way of things that have already waited a long time. Before the world moves, the ledger wants its three things.\n\nAnd then we find out what was waiting for the ink to dry.";
  const BEATS = {
    ag_days_end:        { label: ["Allesh-Gilliam — Day's End", "Allesh-Gilliam — Lock the Turn"], description: [OLD_AG, NEW_AG] },
    days_end_thatwards: { label: ["Day's End", "Lock the Turn"], description: [OLD_TH, NEW_TH] }
  };
  const CHOICES = [
    ["Call it a day", "Ready to move on"],
    ["Call it a day — the map has your names on it", "Ready to move on — the map has your names on it"],
    ["Back to the crossroads — daylight left", "Not yet — back to the crossroads"],
    ["Daylight left — back to it", "Not yet — back to it"]
  ];
  const SCRIPTS = [
    ["allesh_gilliam", "arrival", 2, "line", "Walk the town. Six doors, any order. Call it a day once you've been met.", "Walk the town. Six doors, any order. Ready to move on once you've been met."],
    ["allesh_gilliam", "arrival", 6, "label", "Day's End", "Lock the Turn"],
    ["lyrenn", "arrival", 1, "line", "Meet Elsin, meet Rowan, see the Green Ring. Call it a day when the rows have noticed you.", "Meet Elsin, meet Rowan, see the Green Ring. Ready to move on when the rows have noticed you."]
  ];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const [id, fields] of Object.entries(BEATS)) {
      const b = beats.find(x => x?.id === id); if (!b) { conflicts.push(`beat ${id} not found`); continue; }
      for (const [k, [from, to]] of Object.entries(fields)) {
        if (b[k] === to) continue;
        if (b[k] === from) { b[k] = to; changes++; report.push(`✚ ${id}.${k}`); } else conflicts.push(`${id}.${k} no longer holds the old text — left alone`);
      }
    }
    const CM = new Map(CHOICES);
    for (const b of beats) for (const c of (b?.choices || [])) {
      const to = CM.get(String(c?.label ?? "")); if (!to) continue;
      report.push(`✚ ${b.id}: "${c.label}" → "${to}"`); c.label = to; changes++;
    }
    // the four hub "Ready to move on" choices carried a tooltip in the same voice
    const DESC_FROM = "The day is spent. Lock the turn, or decide there's daylight left.", DESC_TO = "Lock the turn, or decide you're not done yet.";
    for (const b of beats) for (const c of (b?.choices || [])) {
      if (c?.description !== DESC_FROM) continue;
      c.description = DESC_TO; changes++; report.push(`✚ ${b.id}: "${c.label}" tooltip`);
    }
    const PIKE_FROM = "Your hexes, one working leygate, a wall on record. The day is spent.", PIKE_TO = "Your hexes, one working leygate, a wall on record. Ready when you are.";
    for (const b of beats) for (const c of (b?.choices || [])) if (c?.description === PIKE_FROM) { c.description = PIKE_TO; changes++; report.push(`✚ ${b.id}: Pike closure tooltip`); }
    // left alone on purpose: "Sleep. Tomorrow, the land." (the story's real first night + Soma Break) and "First, the night — the town lets go of you"
    for (const [q, part, i, k, from, to] of SCRIPTS) {
      const step = camp.story?.scripts?.[q]?.[part]?.steps?.[i];
      if (!step) { conflicts.push(`script ${q}.${part}.steps.${i} not found`); continue; }
      if (step[k] === to) continue;
      if (step[k] === from) { step[k] = to; changes++; report.push(`✚ script ${q}.${part}.${i}.${k}`); } else conflicts.push(`script ${q}.${part}.${i}.${k} differs — left alone`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = LOCK_TURN_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__lockTurnDry ?? true);   // <-- set false (or globalThis.__lockTurnDry = false) to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = LOCK_TURN_PATCH.apply(camp);
  console.log(`[lock the turn 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__lockTurn = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-lock-the-turn-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — Day's End is now Lock the Turn (${changes} change(s)).`);
})();
