/**
 * patch-gully-stabilizer-ask-2026-11-01.macro.js — Dave, 11-01 (at the Gullywasher, stabilizer already won):
 *   "we shouldn't be asking him about the leyline stabilizer at this point since we already have it."
 *
 * fixit_gullywasher_welcome "We're here for the stabilizer. Know anything?" (Soft Power DC 14 → choice_4 / its fail) had no
 * gate. It now needs the Leyline Stabilizer chapter UNFINISHED: requires {questBucket: quest_bSwOIWzxqNBwJ5NM, isNot: "completed"}
 * (the chapter's registry id — Trade / Shared Oversight / Hard Ask all complete that bucket; unmet = hidden).
 * Idempotent (rerun = 0). Pure `apply(camp)` for the offline lint proof (node) + the Foundry runner. DRY_RUN first.
 * Backup → Data/bbttcc-exports/. GM only.
 */
const GULLY_STAB_PATCH = (() => {
  const BEAT = "fixit_gullywasher_welcome", NEXT = "fixit_gullywasher_choice_4", Q_STAB = "quest_bSwOIWzxqNBwJ5NM";
  const ROW = { questBucket: Q_STAB, isNot: "completed" };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const b = beats.find(x => x && String(x.id) === BEAT);
    const report = [], conflicts = []; let changes = 0;
    if (!b) return { changes, report, conflicts: [`${BEAT}: beat not found`] };
    const cs = (b.choices || []).filter(c => c && String(c.next) === NEXT);
    if (!cs.length) conflicts.push(`${BEAT}: no choice → ${NEXT}`);
    for (const c of cs) {
      const rows = Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : []);
      if (rows.some(r => r && r.questBucket === Q_STAB && r.isNot === "completed")) { report.push(`· ok ${BEAT} "${c.label}" hides once the stabilizer is won`); continue; }
      c.requires = [...rows, { ...ROW }];
      changes++; report.push(`✚ ${BEAT} "${c.label}": hidden once the Leyline Stabilizer chapter is completed`);
    }
    return { changes, report, conflicts };
  }
  return { apply, ROW };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = GULLY_STAB_PATCH;                                   // node: offline lint proof
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (deepClone made a write no-op once)
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = GULLY_STAB_PATCH.apply(camp);
  console.log(`[gully stabilizer ask 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__gullyStabilizerAsk = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-gully-stabilizer-ask-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Gully isn't asked about a stabilizer you already have.`);
})();
