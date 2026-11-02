/**
 * patch-lyrenn-field-door-2026-11-02.macro.js — GM click-through, Act 2 (Dave 11-02: the town map + quest markers are the hub).
 * The red thread's sprout (lyrenn_red_thread_sprouted) was reachable only from the NOW card — nothing on Lyrenn's map routed to it —
 * and the low-field door (lyrenn_low_field_exterior) was gated on the Field chapter being ACTIVE, so once the field was resolved the
 * door died although the red thread and the stone figure both live at that field.
 *   • the low-field door keeps storyPhase ≥ 2 only; "Go in" (the Field chapter) carries the chapter gate itself
 *   • the door offers "The red thread — come up overnight" (planted, not yet sprouted) and "Kneel by the stone figure" (sprouted,
 *     not yet knelt)
 *   • the sprout beat gains "Kneel by the stone figure" → lyrenn_field_remembers_forward
 *   • lyrenn_field_remembers_forward is evergreen (filed under the Field chapter, sealed by its close — it is the field's aftermath)
 *   • "Leave" / "Back to the rows" exits that dropped into the rows hub (planting, forward) now close to the town map
 * Draft-1 labels. Pure apply(camp) + runner. Idempotent (rerun = 0). DRY_RUN first. Backup. GM only.
 */
const FIELD_DOOR_PATCH = (() => {
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const by = new Map(beats.map(b => [String(b?.id), b])); const report = [], conflicts = []; let changes = 0;
    for (const id of ["lyrenn_low_field_exterior", "lyrenn_red_thread_sprouted", "lyrenn_red_thread_planting", "lyrenn_field_remembers_forward"]) if (!by.has(id)) conflicts.push(id + ": not found");
    if (conflicts.length) return { changes, report, conflicts };
    const door = by.get("lyrenn_low_field_exterior"); const req = Array.isArray(door.inject?.requires) ? door.inject.requires : [];
    const chapterGate = req.filter(r => r && r.questBucket); 
    if (chapterGate.length) { door.inject.requires = req.filter(r => !(r && r.questBucket)); for (const c of door.choices || []) if (c && c.next === "lyrenn_the_field_that_remembers_you_intro") c.requires = [...(Array.isArray(c.requires) ? c.requires : []), ...chapterGate]; changes++; report.push("✚ low-field door: open all Act 2; the Field chapter gate moves onto 'Go in'"); } else report.push("· ok low-field door gate");
    const add = (b, c) => { b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(x => x && x.next === c.next)) return report.push(`· ok ${b.id} → ${c.next}`); const at = b.choices.findIndex(x => x && /^(leave|back)/i.test(String(x.label || ""))); if (at >= 0) b.choices.splice(at, 0, c); else b.choices.push(c); changes++; report.push(`✚ ${b.id}: "${c.label}" → ${c.next}`); };
    add(door, ch("The red thread — come up overnight", "lyrenn_red_thread_sprouted", "Something at the field's edge is leaning.", { requires: [{ beatMark: "lyrenn_red_thread_planting" }, { beatMark: "lyrenn_red_thread_sprouted", not: true }] }));
    add(door, ch("Kneel by the stone figure", "lyrenn_field_remembers_forward", "The red thread leans through it.", { requires: [{ beatMark: "lyrenn_red_thread_sprouted" }, { beatMark: "lyrenn_field_remembers_forward", not: true }] }));
    add(by.get("lyrenn_red_thread_sprouted"), ch("Kneel by the stone figure", "lyrenn_field_remembers_forward", "Follow the lean.", { requires: [{ beatMark: "lyrenn_field_remembers_forward", not: true }] }));
    // the stone figure plays AFTER the Field chapter (its Quest link is that chapter, so the chapter's close sealed it — live-caught)
    { const f = by.get("lyrenn_field_remembers_forward"); f.inject = f.inject || {}; if (f.inject.evergreen !== true) { f.inject.evergreen = true; changes++; report.push("✚ lyrenn_field_remembers_forward: evergreen (plays after the Field chapter closes)"); } }
    for (const id of ["lyrenn_red_thread_planting", "lyrenn_field_remembers_forward"]) for (const c of (by.get(id).choices || [])) if (c && c.next === "lyrenn_quest_scene" && /^(leave|back to the rows)/i.test(String(c.label || ""))) { c.next = ""; changes++; report.push(`✚ ${id} "${c.label}": closes to the town map`); }
    return { changes, report, conflicts };
  }
  return { apply };
})();
if (typeof game === "undefined" && typeof module !== "undefined") { module.exports = FIELD_DOOR_PATCH; }
else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign"; if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = FIELD_DOOR_PATCH.apply(camp);
  console.log(`[lyrenn field door 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes}\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__fieldDoor = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN || !changes || conflicts.length) return ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s)`);
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-lyrenn-field-door-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps); ui.notifications.info(`Applied ${changes} change(s).`);
})();
