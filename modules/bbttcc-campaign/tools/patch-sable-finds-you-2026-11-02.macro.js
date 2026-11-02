/**
 * patch-sable-finds-you-2026-11-02.macro.js — click-through (2026-11-02): after the second Lost Stone Statue the quest log said
 * "Meet Sable Nine on the mountain road. They have come to find you." — but statues_sable_bleeding is place "anywhere", has no route
 * into it and no hex trigger, so nothing ever played it; the log said "you are here" with no way in. Sable comes to the table:
 * Fragment II's exits (spark_geburah_mountains_q_worthy "Continue the search", _force "Move on") lead into statues_sable_bleeding.
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const SABLE_PATCH = (() => {
  const TO = "statues_sable_bleeding"; const FROM = ["spark_geburah_mountains_q_worthy", "spark_geburah_mountains_q_force"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    if (!beats.some(b => b && b.id === TO)) { conflicts.push(`${TO} not found`); return { changes, report, conflicts }; }
    for (const id of FROM) {
      const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; }
      const ch = b.choices || []; if (ch.length !== 1) { conflicts.push(`${id}: expected one exit, found ${ch.length}`); continue; }
      const c = ch[0]; if (c.next === TO) { report.push(`· ok ${id}`); continue; }
      if (c.next) { conflicts.push(`${id}: "${c.label}" already routes to ${c.next} — left alone`); continue; }
      c.next = TO; changes++; report.push(`✚ ${id} "${c.label}" → ${TO} (Sable Nine finds you)`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = SABLE_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = SABLE_PATCH.apply(camp);
  console.log(`[sable finds you 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__sable = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-sable-finds-you-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Sable Nine comes to find you.`);
})();
