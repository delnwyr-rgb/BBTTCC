/**
 * patch-seal-one-quest-2026-10-29.macro.js — Dave, 10-29: "3 different quests sending them to do the same thing, which
 * I have done already — but they all still say it." The seal's instruction now lives in ONE quest (The Sealed Shaft):
 *   story khezek_tor.seal — done once Sable has taken you down and The Sealed Shaft quest is in the Log (its acceptance),
 *   or the seal is decided any way. Khezek Tor's Next moves on to the Official Word steps.
 * (The other two — The Sealed Shaft's "decide" step and That One Night's "signature" rung — are code: they PARK once the
 *  seal has been seen, until Etta + the East Wall + the Field. See story-model.js PARKED.)
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
  const report = []; const conflicts = []; let changes = 0;
  const say = (m) => { changes++; report.push(m); };

  const st = (camp.story?.scripts?.khezek_tor?.steps || []).find(x => x.id === "seal");
  if (!st) conflicts.push("story khezek_tor.seal: not found");
  else {
    const done = { anyOf: ["khezek_tor_valhaulan_seal_quest_acceptance", "khezek_tor_the_vaulhaulan_seal_restore", "khezek_tor_the_vaulhaulan_seal_redirect", "khezek_tor_the_vaulhaulan_seal_break"] };
    if (JSON.stringify(st.done) !== JSON.stringify(done)) { report.push(`   was: ${JSON.stringify(st.done)}`); st.done = done; say("✎ story khezek_tor.seal: done once The Sealed Shaft is taken (or the seal decided)"); }
    const logged = "Sable Nine took you to the sealed shaft. The seal has its own page in the Log now: The Sealed Shaft.";
    if (st.logged !== logged) { report.push(`   was: ${st.logged ?? "(none)"}`); st.logged = logged; say("✎ story khezek_tor.seal: So far line"); }
  }

  console.log(`[seal one quest 2026-10-29] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__sealOneQuest = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  if (conflicts.length) return ui.notifications.error(`${conflicts.length} conflict(s) — nothing written; see console.`);
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-seal-one-quest-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Khezek Tor hands the seal to The Sealed Shaft.`);
})();
