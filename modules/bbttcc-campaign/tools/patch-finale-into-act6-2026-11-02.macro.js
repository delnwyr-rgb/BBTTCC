/**
 * patch-finale-into-act6-2026-11-02.macro.js — click-through (2026-11-02): after the finale the quest log said "Gloomgill — Begin Act
 * Six." but a6_title_card is place "anywhere" with no route, trigger or button — nothing could ever play it (firedCount 0). Every finale
 * ending's last beat ends on a route-less "Continue" (rewards_major "Sky-Forged Gifts", rewards_standard, rewards_intel_only,
 * outcome_neutral_fail, outcome_hostile_fail) — and a6_title_card's own requires is exactly "one of those played". → each of their
 * "Continue" choices leads into a6_title_card ("THE EXAM"). Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first.
 * Backup → Data/bbttcc-exports/. GM only.
 */
const ACT6_PATCH = (() => {
  const TO = "a6_title_card";
  const FROM = ["raid_thatwards_rewards_major", "raid_thatwards_rewards_standard", "raid_thatwards_rewards_intel_only", "raid_thatwards_outcome_neutral_fail", "raid_thatwards_outcome_hostile_fail"];
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    if (!beats.some(b => b && b.id === TO)) { conflicts.push(`${TO} not found`); return { changes, report, conflicts }; }
    for (const id of FROM) {
      const b = beats.find(x => x && x.id === id); if (!b) { conflicts.push(`${id} not found`); continue; }
      const c = (b.choices || []).find(x => x && /^continue$/i.test(String(x.label || "").trim()));
      if (!c) { conflicts.push(`${id}: no "Continue"`); continue; }
      if (c.next === TO) { report.push(`· ok ${id}`); continue; }
      if (c.next) { conflicts.push(`${id}: "Continue" already routes to ${c.next} — left alone`); continue; }
      c.next = TO; changes++; report.push(`✚ ${id} "Continue" → ${TO} (Act Six opens)`);
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = ACT6_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = ACT6_PATCH.apply(camp);
  console.log(`[finale into act 6 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__act6 = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-finale-into-act6-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the finale opens Act Six.`);
})();
