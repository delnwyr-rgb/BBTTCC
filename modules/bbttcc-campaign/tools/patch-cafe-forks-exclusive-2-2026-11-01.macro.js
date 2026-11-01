/**
 * patch-cafe-forks-exclusive-2-2026-11-01.macro.js — the BEAT AUDIT round (Dave, 11-01: "a full audit of our beats to see if
 * there are any more like this out there that we can fix proactively"). The X02 OPEN-FORK rule (lint-campaign.js, 2026-11-01)
 * found the Recalcitrant Café forks the first patch (patch-cafe-forks-exclusive-2026-11-01) missed, plus one half-open fork:
 *   Allesh-Gilliam  ag_etta_answer_skewer: "Take seconds. Don't ask." (rc_etta_skewer, the meal) vs "Ask again. What's IN it?"
 *                   (rc_etta_soured) — the answer beat is repeatable, so after the meal the souring ask still showed, and after
 *                   souring the meal still showed. Each now hides once the other is played.
 *   Fixit Farm      fixit_gullywasher_welcome: "Drink — and keep where you're from to yourself" (rc_gully_soured) is the fork
 *                   against the amber thing itself (its text drinks both rounds and refuses) — it now also needs rc_gully_amber
 *                   unplayed (the first patch only hid it behind the second round).
 *   (Pike's coffee vs "ask what's in it" is inside a once-only welcome — the engine locks it after one pick; nothing to do.)
 * Idempotent (rerun = 0). Pure `apply(camp)` (node lint proof) + Foundry runner. DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const CAFE_FORKS_2_PATCH = (() => {
  // [beatId, choice next, required-not beat mark]
  const RULES = [
    ["ag_etta_answer_skewer", "rc_etta_soured", "rc_etta_skewer"],
    ["ag_etta_answer_skewer", "rc_etta_skewer", "rc_etta_soured"],
    ["fixit_gullywasher_welcome", "rc_gully_soured", "rc_gully_amber"]
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
  module.exports = CAFE_FORKS_2_PATCH;                                 // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = CAFE_FORKS_2_PATCH.apply(camp);
  console.log(`[cafe forks exclusive 2 · 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__cafeForksExclusive2 = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-cafe-forks-exclusive-2-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Etta's skewer fork is exclusive; Gully's refusal is the amber's own fork.`);
})();
