/**
 * patch-kt-answers-lead-back-2026-10-28.macro.js — Dave, 10-28: "you can have a convo with Drax in Act 2 that removes your
 * ability to ask to be taken below by him."
 * "What do the crews need to hear?" leaves Calder's conversation for the Official Word opener; its answers ended on
 * "Leave him to his work." (no next) — the whole window chain closed, and Calder's list (with "Go below with you") was
 * gone until the table walked back through the Brace. Brennig's desk answers ended the same way.
 *   · ans_kt_official_word_open_* : "Leave him to his work." → "Ask Calder something else." → khezek_tor_drax_calder_convo
 *     (his other answers already say "Ask something else" and come back; his list has its own Leave).
 *   · ans_kt_brennig_desk_*        : "Leave him to his counting." → khezek_tor_quest_scene (the switchback, like every Leave).
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const report = []; const conflicts = []; let changes = 0;
  const RULES = [
    { prefix: "ans_kt_official_word_open_", from: /^Leave him to his work\.$/, label: "Ask Calder something else.", next: "khezek_tor_drax_calder_convo" },
    { prefix: "ans_kt_brennig_desk_", from: /^Leave him to his counting\.$/, label: "Leave him to his counting.", next: "khezek_tor_quest_scene" }
  ];
  for (const r of RULES) {
    if (!byId(r.next)) { conflicts.push(`${r.next}: not found`); continue; }
    const hits = beats.filter(b => String(b?.id || "").startsWith(r.prefix));
    if (!hits.length) conflicts.push(`no ${r.prefix}* beats (run patch-kt-official-word-answers first)`);
    for (const b of hits) for (const ch of (b.choices || [])) {
      const lab = String(ch?.label || "").trim();
      if (!(r.from.test(lab) || lab === r.label)) continue;
      if (ch.next === r.next && lab === r.label) continue;
      ch.label = r.label; ch.next = r.next; changes++;
      report.push(`✎ ${b.id}: "${r.label}" → ${r.next}`);
    }
  }
  console.log(`[kt answers lead back 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktLeadBack = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-lead-back-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Calder's and Brennig's answers lead back.`);
})();
