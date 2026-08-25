/**
 * patch-hub-repeatable.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Town hubs are re-entered constantly by design (every venue chain routes
 * home), but un-flagged hubs trip the "already fired — run it again?"
 * soft-confirm on every return (2026-08-24: khezek_tor_town_walk after
 * Sable's stub). Marks every settlement hub inject.repeatable = true.
 * The builder now also skips the confirm for repeatable beats — this patch
 * makes the data say what the design means. Idempotent.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  const HUBS = [
    "allesh_gilliam_town_walk",
    "khezek_tor_town_walk", "khezek_tor_main_scene",
    "lyrenn_town_walk", "lyrenn_opening_scene", "lyrenn_main_scene",
    "fixit_town_walk", "fixit_intro_scene"
  ];

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  for (const id of HUBS) {
    const b = byId.get(id);
    if (!b) { report.push(`· (absent) ${id}`); continue; }
    if (b.inject?.repeatable) { report.push(`· ok ${id} (already repeatable)`); continue; }
    b.inject = b.inject || {};
    b.inject.repeatable = true;
    changes++; report.push(`✚ ${id} → repeatable`);
  }

  console.log(`[patch-hub-repeatable] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Hub-repeatable DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-hub-repeatable-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Hub-repeatable APPLIED: ${changes} change(s). Come and go as you please.`);
})();
