/**
 * patch-kt-cage-shaft-via-sable-2026-10-28.macro.js — Dave, 10-28: "allow players to bridge to the cage shaft go below with
 * Sable Nine beat from the talk to Sable Nine beat. We don't need two."
 * The Maw offered both "Talk to Sable Nine" and "The cage shaft below Four — with Sable Nine". The cage shaft door moves
 * INTO her conversation (before Leave, same gate: the Official Word is active, Brennig's desk visited, manifest not yet
 * found), and leaves the Maw. Her answer beats' "Ask something else" return to the conversation, so it stays reachable.
 * Idempotent (rerun = 0). DRY_RUN first. Backup of `campaigns` → Data/bbttcc-exports/. GM only.
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
  const GATE = [{ questBucket: "quest_kt_official_word", is: "active" }, { beatMark: "kt_brennig_desk" }, { beatMark: "kt_dropped_manifest", not: true }];

  const sable = byId("khezek_tor_sable_nine_convo"), maw = byId("khezek_tor_the_maw");
  if (!sable || !maw) conflicts.push("Sable's conversation or the Maw not found");
  else {
    sable.choices = Array.isArray(sable.choices) ? sable.choices : [];
    if (!sable.choices.some(c => c?.next === "kt_cage_shaft")) {
      const at = sable.choices.findIndex(c => /^leave$/i.test(String(c?.label || "").trim()));
      const ch = { label: "Take us down the cage shaft below Four.", next: "kt_cage_shaft", description: "Brennig says the manifest is still down there, and you're the only one who goes below Four.", checkStat: "", checkDC: 0, failNext: "", gate: GATE };
      if (at >= 0) sable.choices.splice(at, 0, ch); else sable.choices.push(ch);
      changes++; report.push(`+ khezek_tor_sable_nine_convo: "${ch.label}" → kt_cage_shaft`);
    }
    const before = (maw.choices || []).length;
    maw.choices = (maw.choices || []).filter(c => c?.next !== "kt_cage_shaft");
    if (maw.choices.length !== before) { changes++; report.push("− khezek_tor_the_maw: cage shaft choice removed (it lives in Sable's conversation)"); }
  }

  console.log(`[kt cage shaft via sable 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktCageSable = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-cage-sable-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the cage shaft goes through Sable Nine.`);
})();
