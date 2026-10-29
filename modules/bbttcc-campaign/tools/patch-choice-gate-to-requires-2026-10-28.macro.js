/**
 * patch-choice-gate-to-requires-2026-10-28.macro.js — Dave, 10-28 (screenshot): on the FIRST Act-2 arrival in Khezek-Tor the
 * switchback already offered Brennig's desk, the bench and the Official Word.
 * Cause (Claude's bug, today's KT macros): the engine reads a choice's conditions from `choice.requires` (module.js
 * _choiceHidden); today's macros wrote them to `choice.gate`, which NOTHING reads — so every one of those doors was open.
 * Fix, campaign-wide: a choice with `gate` and no `requires` gets requires = gate; `gate` is then removed from every choice
 * (where both existed, the authored `requires` already did the job and is kept as is).
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
  const report = []; let changes = 0;
  for (const b of beats) for (const ch of (b?.choices || [])) {
    if (!ch || !("gate" in ch)) continue;
    const hasReq = ch.requires != null && !(Array.isArray(ch.requires) && !ch.requires.length);
    if (!hasReq && Array.isArray(ch.gate) && ch.gate.length) { ch.requires = ch.gate; report.push(`✎ ${b.id} :: "${ch.label}" — conditions now enforced`); }
    else report.push(`· ${b.id} :: "${ch.label}" — kept its own requires, dropped the unused gate`);
    delete ch.gate; changes++;
  }
  console.log(`[choice gate → requires 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__gateToReq = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-gate-to-requires-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — choice conditions are enforced.`);
})();
