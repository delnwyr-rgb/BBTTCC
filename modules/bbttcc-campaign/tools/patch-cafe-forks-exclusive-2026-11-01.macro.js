/**
 * patch-cafe-forks-exclusive-2026-11-01.macro.js — Dave, 11-01 (at the Gullywasher, Dougan's name earned):
 *   "I think that I have already done the Dougan thing and earned his name? But it looks like I can still take the keep it
 *    to myself beat. All that's left are the skilled questions."
 *
 * The Recalcitrant Café forks (patch-recalcitrant-cafe-2026-10-13) offer a MEAL and a SOURED request side by side, but
 * neither hid the other once picked: the soured beats are once-only (so they lock themselves), the meal is once-only too,
 * but "refuse" stayed on the menu after the meal was eaten / the second round paid, and the meal stayed after souring.
 * The fork is now exclusive both ways, by `choice.requires` (unmet = hidden — [[feedback_choice_conditions_are_requires]]):
 *   Gullywasher  "Drink — and keep where you're from to yourself" → needs the second round UNPAID (rc_gully_second_round not)
 *                "Drink the amber thing" · "Second round. Tell him where you're from." → need NOT soured (rc_gully_soured not)
 *                (the soured beat narrates drinking both and refusing; Gully took the glass — no going back for the name)
 *   Khezek Tor   "Ask Bez for it without the gray bits" → needs the bench UNEATEN (rc_bez_bench not)
 *                "Eat what Bez gives you" (town walk + quest scene) → needs NOT soured (rc_bez_soured not)
 *                "Hop a lift for a look at the Brace" → needs the tar UNDRUNK (rc_drax_tar not)
 *                "Drink the miner's coffee" / "Drax Calder's tar" → needs NOT soured (rc_drax_soured not)
 * Existing requires rows are kept; a row is added only when that exact row is missing. Idempotent (rerun = 0).
 * Pure `apply(camp)` for the offline lint proof (node) + the Foundry runner. DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const CAFE_FORKS_PATCH = (() => {
  // [beatId, choice next, required-not beat mark]
  const RULES = [
    ["fixit_gullywasher_welcome", "rc_gully_soured", "rc_gully_second_round"],
    ["fixit_gullywasher_welcome", "rc_gully_amber", "rc_gully_soured"],
    ["fixit_gullywasher_welcome", "rc_gully_second_round", "rc_gully_soured"],
    ["rc_gully_amber", "rc_gully_second_round", "rc_gully_soured"],
    ["khezek_tor_town_walk", "rc_bez_soured", "rc_bez_bench"],
    ["khezek_tor_town_walk", "rc_bez_bench", "rc_bez_soured"],
    ["khezek_tor_quest_scene", "rc_bez_bench", "rc_bez_soured"],
    ["khezek_tor_drax_welcome", "rc_drax_soured", "rc_drax_tar"],
    ["khezek_tor_drax_welcome", "rc_drax_tar", "rc_drax_soured"],
    ["khezek_tor_quest_scene", "rc_drax_tar", "rc_drax_soured"]
  ];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    for (const [beatId, next, notMark] of RULES) {
      const b = byId.get(beatId);
      if (!b) { conflicts.push(`${beatId}: beat not found`); continue; }
      if (!byId.has(notMark)) { conflicts.push(`${notMark}: gate beat not found`); continue; }
      const cs = (b.choices || []).filter(c => c && String(c.next) === next);
      if (!cs.length) { conflicts.push(`${beatId}: no choice → ${next}`); continue; }
      for (const c of cs) {
        const rows = Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : []);
        if (rows.some(r => r && r.beatMark === notMark && r.not === true)) { report.push(`· ok ${beatId} "${c.label}" needs ${notMark} unplayed`); continue; }
        c.requires = [...rows, { beatMark: notMark, not: true }];
        changes++; report.push(`✚ ${beatId} "${c.label}": hidden once ${notMark} is played`);
      }
    }
    return { changes, report, conflicts };
  }
  return { apply, RULES };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = CAFE_FORKS_PATCH;                                   // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = CAFE_FORKS_PATCH.apply(camp);
  console.log(`[cafe forks exclusive 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__cafeForksExclusive = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-cafe-forks-exclusive-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the café forks are exclusive: a meal hides the refusal, a refusal hides the meal.`);
})();
